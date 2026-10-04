const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companions";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TamerCompanionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(tamer, options = {}) {
    super(options);
    this.tamer = tamer;
  }

  static DEFAULT_OPTIONS = {
    id: "tamer-companion-manager",
    classes: ["tamer-companion-manager"],
    window: {
      title: "Tamer Companions",
      icon: "fa-solid fa-paw",
      resizable: true
    },
    position: { width: 760, height: 650 },
    actions: {
      refresh: this._onRefresh,
      addCompanion: this._onAddCompanion,
      openCompanion: this._onOpenCompanion,
      summonCompanion: this._onSummonCompanion,
      dismissCompanion: this._onDismissCompanion,
      unlinkCompanion: this._onUnlinkCompanion,
      openTamer: this._onOpenTamer
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/companion-manager.hbs`,
      root: true
    }
  };

  async _prepareContext() {
    const level = TamerCompanionManager.getTamerLevel(this.tamer);
    const slots = TamerCompanionManager.getPocketFamilySlots(level);
    const records = TamerCompanionManager.records(this.tamer);

    const companions = await Promise.all(records.map(async (record, index) => {
      const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
      const token = record.tokenUuid ? await fromUuid(record.tokenUuid).catch(() => null) : null;
      return {
        index,
        slot: index + 1,
        name: actor?.name ?? record.name ?? "Unlinked Companion",
        img: actor?.img ?? "icons/svg/mystery-man.svg",
        type: actor?.system?.details?.type?.value ?? actor?.system?.details?.type ?? "Creature",
        hp: actor?.system?.attributes?.hp?.value ?? 0,
        hpMax: actor?.system?.attributes?.hp?.max ?? 0,
        ac: actor?.system?.attributes?.ac?.value ?? 0,
        vessel: record.vesselName || "No vessel assigned",
        linked: Boolean(actor),
        summoned: Boolean(token)
      };
    }));

    return {
      tamer: { name: this.tamer.name, img: this.tamer.img, level },
      pocketFamily: {
        slots,
        occupied: companions.length,
        empty: Array.from({ length: Math.max(0, slots - companions.length) }, (_, i) => i)
      },
      companions
    };
  }

  static records(actor) {
    return foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  }

  static async save(actor, records) {
    await actor.setFlag(MODULE_ID, FLAG_KEY, records);
  }

  static isTamer(actor) {
    return Boolean(actor?.items?.some(item => {
      if (item.type !== "class") return false;
      return String(item.name ?? "").trim().toLowerCase() === "tamer"
        || String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer";
    }));
  }

  static getTamerLevel(actor) {
    const cls = actor?.items?.find(item =>
      item.type === "class" &&
      (String(item.name ?? "").trim().toLowerCase() === "tamer" ||
       String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer")
    );
    const classLevel = Number(cls?.system?.levels ?? cls?.system?.level ?? 0);
    return classLevel > 0 ? classLevel : Number(actor?.system?.details?.level ?? 0);
  }

  static getPocketFamilySlots(level) {
    if (level >= 19) return 5;
    if (level >= 15) return 4;
    if (level >= 11) return 3;
    if (level >= 3) return 2;
    if (level >= 1) return 1;
    return 0;
  }

  static async summonedRecord(records) {
    for (const record of records) {
      if (!record.tokenUuid) continue;
      const token = await fromUuid(record.tokenUuid).catch(() => null);
      if (token) return { record, token };
    }
    return null;
  }

  static tamerToken(tamer) {
    return canvas?.tokens?.controlled?.find(t => t.actor?.id === tamer.id)
      ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === tamer.id)
      ?? null;
  }

  static findAdjacentSpace(tamerToken) {
    const grid = canvas.grid.size;
    const x = tamerToken.document.x;
    const y = tamerToken.document.y;
    const candidates = [
      { x: x + grid, y },
      { x: x - grid, y },
      { x, y: y + grid },
      { x, y: y - grid }
    ];

    for (const p of candidates) {
      const occupied = canvas.tokens.placeables.some(t =>
        t.document.x === p.x && t.document.y === p.y
      );
      if (!occupied && p.x >= 0 && p.y >= 0) return p;
    }
    return null;
  }

  static async summon(tamer, record) {
    if (!canvas?.scene) return ui.notifications.warn("A scene must be active.");
    const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    if (!actor) return ui.notifications.error("The companion Actor could not be found.");

    const records = this.records(tamer);
    if (await this.summonedRecord(records)) {
      ui.notifications.warn("Another companion is already summoned.");
      return false;
    }

    const tamerToken = this.tamerToken(tamer);
    if (!tamerToken) {
      ui.notifications.warn("Place the Tamer's token on the current scene first.");
      return false;
    }

    const position = this.findAdjacentSpace(tamerToken);
    if (!position) {
      ui.notifications.warn("No adjacent unoccupied space was found.");
      return false;
    }

    const tokenDoc = await actor.getTokenDocument(position);
    const created = await canvas.scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
    const target = records.find(r => r.id === record.id);
    target.tokenUuid = created[0].uuid;
    target.status = "summoned";
    await this.save(tamer, records);
    ui.notifications.info(`${actor.name} has been summoned.`);
    return true;
  }

  static async dismiss(tamer, record) {
    const records = this.records(tamer);
    const target = records.find(r => r.id === record.id);
    if (!target) return false;

    if (target.tokenUuid) {
      const token = await fromUuid(target.tokenUuid).catch(() => null);
      if (token) await token.delete();
    }

    target.tokenUuid = null;
    target.status = "in-vessel";
    await this.save(tamer, records);
    ui.notifications.info(`${target.name ?? "Companion"} returned to its vessel.`);
    return true;
  }

  static open(actor) {
    if (!actor) return ui.notifications.warn("No Actor was provided.");
    if (!this.isTamer(actor)) return ui.notifications.warn("This Actor does not have a Tamer class.");
    if (!(actor.isOwner || game.user.isGM)) return ui.notifications.warn("You do not have permission.");
    return new TamerCompanionManager(actor).render({ force: true });
  }

  async _onRefresh() {
    await this.render({ force: true });
  }

  async _onAddCompanion() {
    const records = TamerCompanionManager.records(this.tamer);
    const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
    if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available.");

    const available = game.actors.contents
      .filter(a => a.id !== this.tamer.id && (a.isOwner || game.user.isGM))
      .filter(a => !records.some(r => r.actorUuid === a.uuid))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!available.length) return ui.notifications.warn("No available Actors were found.");

    const options = available.map(a =>
      `<option value="${a.uuid}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Link Companion" },
      content: `<form><div class="form-group"><label>Companion Actor</label><select name="actorUuid">${options}</select></div></form>`,
      buttons: [
        { action: "cancel", label: "Cancel" },
        {
          action: "link",
          label: "Link Companion",
          default: true,
          callback: (event, button, dialog) => dialog.element.querySelector("[name='actorUuid']")?.value
        }
      ]
    });

    if (!result) return;
    const actor = await fromUuid(result).catch(() => null);
    if (!actor) return ui.notifications.error("Could not resolve that Actor.");

    records.push({
      id: foundry.utils.randomID(),
      actorUuid: actor.uuid,
      name: actor.name,
      vesselUuid: null,
      vesselName: "",
      tokenUuid: null,
      status: "in-vessel",
      improvements: [],
      bespokeImprovements: [],
      bonusHitDice: 0
    });

    await TamerCompanionManager.save(this.tamer, records);
    await this.render({ force: true });
  }

  async _onOpenCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    const actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    actor?.sheet?.render({ force: true });
  }

  async _onSummonCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    if (record && await TamerCompanionManager.summon(this.tamer, record)) await this.render({ force: true });
  }

  async _onDismissCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    if (record && await TamerCompanionManager.dismiss(this.tamer, record)) await this.render({ force: true });
  }

  async _onUnlinkCompanion(event, target) {
    const records = TamerCompanionManager.records(this.tamer);
    const record = records[Number(target.dataset.index)];
    if (!record) return;

    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Unlink Companion" },
      content: `<p>Unlink <strong>${foundry.utils.escapeHTML(record.name ?? "this companion")}</strong>?</p>`,
      yes: { label: "Unlink" },
      no: { label: "Cancel" }
    });

    if (!yes) return;
    if (record.tokenUuid) {
      const token = await fromUuid(record.tokenUuid).catch(() => null);
      if (token) await token.delete();
    }

    records.splice(Number(target.dataset.index), 1);
    await TamerCompanionManager.save(this.tamer, records);
    await this.render({ force: true });
  }

  async _onOpenTamer() {
    await this.tamer.sheet?.render({ force: true });
  }
}

Hooks.once("init", () => {
  game.tamerCompanionManager = {
    open: actor => TamerCompanionManager.open(actor),
    isTamer: actor => TamerCompanionManager.isTamer(actor),
    getTamerLevel: actor => TamerCompanionManager.getTamerLevel(actor),
    getPocketFamilySlots: level => TamerCompanionManager.getPocketFamilySlots(level)
  };
});

Hooks.once("ready", () => {
  // Foundry v14 / ApplicationV2 uses getHeaderControlsApplicationV2
  // rather than the legacy getActorSheetHeaderButtons hook.
  Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
    if (!app?.actor || !TamerCompanionManager.isTamer(app.actor)) return;

    controls.unshift({
      label: "Companions",
      icon: "fa-solid fa-paw",
      onClick: () => TamerCompanionManager.open(app.actor)
    });
  });

  // Expose the public API for integrations, but no macro is required.
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      open: actor => TamerCompanionManager.open(actor),
      isTamer: actor => TamerCompanionManager.isTamer(actor),
      getTamerLevel: actor => TamerCompanionManager.getTamerLevel(actor),
      getPocketFamilySlots: level => TamerCompanionManager.getPocketFamilySlots(level)
    };
  }
});

globalThis.TamerCompanionManager = TamerCompanionManager;
