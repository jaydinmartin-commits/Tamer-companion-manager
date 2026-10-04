const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companions";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TamerCompanionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer
      ?? game?.actors?.contents?.find(a => TamerCompanionManager.isTamer(a) && (a.isOwner || game.user.isGM))
      ?? null;

    this._tcmDragDrop = new foundry.applications.ux.DragDrop({
      dragSelector: null,
      dropSelector: ".tcm-drop-zone",
      permissions: {
        drop: () => this._canAcceptCompanionDrop()
      },
      callbacks: {
        drop: event => this._onDropCompanion(event),
        dragover: event => this._onDragOverCompanion(event)
      }
    });
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

  static async summon(tamer, record) {
    if (!canvas?.scene || !canvas.tokens) {
      ui.notifications.warn("A scene must be active."); return false;
    }
    const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    if (!actor) { ui.notifications.error("The companion Actor could not be found."); return false; }
    const records = this.records(tamer);
    if (await this.summonedRecord(records)) { ui.notifications.warn("Another companion is already summoned."); return false; }
    const tamerToken = this.tamerToken(tamer);
    if (!tamerToken) { ui.notifications.warn("Place the Tamer's token on the current scene first."); return false; }

    const grid = canvas.grid;
    const size = grid.size;
    const tokenDoc = await actor.getTokenDocument({}, { parent: canvas.scene });
    const tokenWidth = Number(tokenDoc.width ?? 1);
    const tokenHeight = Number(tokenDoc.height ?? 1);
    const tamerCenter = tamerToken.center;
    const candidates = [];
    for (let radius = 1; radius <= 3; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          candidates.push({ x: tamerToken.document.x + dx * size, y: tamerToken.document.y + dy * size });
        }
      }
    }
    const occupied = canvas.tokens.placeables.filter(token => token.document?.id !== tamerToken.document?.id);
    const withinFiveFeet = candidate => {
      const center = { x: candidate.x + tokenWidth * size / 2, y: candidate.y + tokenHeight * size / 2 };
      return grid.measureDistance(tamerCenter, center) <= 5;
    };
    const overlapsToken = candidate => {
      const left = candidate.x, right = candidate.x + tokenWidth * size, top = candidate.y, bottom = candidate.y + tokenHeight * size;
      return occupied.some(token => {
        const tx = token.document.x, ty = token.document.y;
        const tw = Number(token.document.width ?? 1) * size, th = Number(token.document.height ?? 1) * size;
        return left < tx + tw && right > tx && top < ty + th && bottom > ty;
      });
    };
    const inBounds = candidate => {
      const sceneWidth = Number(canvas.scene.width ?? 0) * size, sceneHeight = Number(canvas.scene.height ?? 0) * size;
      if (!sceneWidth || !sceneHeight) return true;
      return candidate.x >= 0 && candidate.y >= 0 && candidate.x + tokenWidth * size <= sceneWidth && candidate.y + tokenHeight * size <= sceneHeight;
    };
    const position = candidates.find(candidate => withinFiveFeet(candidate) && inBounds(candidate) && !overlapsToken(candidate));
    if (!position) { ui.notifications.warn("No unoccupied space within 5 feet of the Tamer was found."); return false; }
    tokenDoc.updateSource({ x: position.x, y: position.y });
    const created = await canvas.scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
    const placed = created?.[0];
    if (!placed) { ui.notifications.error("The companion Token could not be created."); return false; }
    const recordsAfterPlacement = this.records(tamer);
    const target = recordsAfterPlacement.find(r => r.id === record.id);
    if (!target) { await placed.delete(); return false; }
    target.tokenUuid = placed.uuid;
    target.status = "summoned";
    await this.save(tamer, recordsAfterPlacement);
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

  static async open(actor) {
    actor ??= game.actors.contents.find(a => this.isTamer(a) && (a.isOwner || game.user.isGM));
    if (!actor) return ui.notifications.warn("No Tamer Actor was found. Create a character with the Tamer class first.");
    if (!this.isTamer(actor)) return ui.notifications.warn("This Actor does not have a Tamer class.");
    if (!(actor.isOwner || game.user.isGM)) return ui.notifications.warn("You do not have permission.");
    try {
      return await new TamerCompanionManager({ tamer: actor }).render({ force: true });
    } catch (error) {
      console.error("[Tamer Companion Manager] Failed to open manager.", error);
      ui.notifications.error("The Tamer Companion Manager could not be opened. See the browser console for details.");
      return null;
    }
  }

  _canAcceptCompanionDrop() {
    if (!this.tamer || !TamerCompanionManager.isTamer(this.tamer)) return false;
    const records = TamerCompanionManager.records(this.tamer);
    const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
    return records.length < max;
  }

  _onDragOverCompanion(event) {
    if (!this._canAcceptCompanionDrop()) return;
    event.dataTransfer.dropEffect = "link";
  }

  async _onDropCompanion(event) {
    event.preventDefault();

    if (!this._canAcceptCompanionDrop()) {
      ui.notifications.warn("No Pocket Family slot is available.");
      return;
    }

    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Actor") {
      ui.notifications.warn("Only Actor documents can be added as companions.");
      return;
    }

    let actor = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
    if (!actor && globalThis.Actor?.implementation?.fromDropData) {
      actor = await Actor.implementation.fromDropData(data).catch(() => null);
    }

    if (!actor) {
      ui.notifications.error("The dropped Actor could not be resolved.");
      return;
    }

    await this._linkCompanion(actor);
  }

  async _linkCompanion(actor) {
    const records = TamerCompanionManager.records(this.tamer);
    const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));

    if (records.length >= max) {
      ui.notifications.warn("No Pocket Family slot is available.");
      return false;
    }

    if (actor.id === this.tamer.id || actor.uuid === this.tamer.uuid) {
      ui.notifications.warn("The Tamer cannot be linked as their own companion.");
      return false;
    }

    if (!(actor.isOwner || game.user.isGM)) {
      ui.notifications.warn("You do not have permission to use that Actor as a companion.");
      return false;
    }

    if (records.some(r => r.actorUuid === actor.uuid)) {
      ui.notifications.warn(`${actor.name} is already linked to this Tamer.`);
      return false;
    }

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
    ui.notifications.info(`${actor.name} has been bonded as a companion.`);
    await this.render({ force: true });
    return true;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.element) this._tcmDragDrop.bind(this.element);
  }

  static async _onRefresh() {
    await this.render({ force: true });
  }

  static async _onAddCompanion() {
    const records = TamerCompanionManager.records(this.tamer);
    const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));

    if (records.length >= max) {
      return ui.notifications.warn("No Pocket Family slot is available.");
    }

    const available = game.actors.contents
      .filter(a => a.id !== this.tamer.id && (a.isOwner || game.user.isGM))
      .filter(a => !records.some(r => r.actorUuid === a.uuid))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!available.length) {
      return ui.notifications.warn("No available Actors were found.");
    }

    const options = available
      .map(a => `<option value="${foundry.utils.escapeHTML(a.uuid)}">${foundry.utils.escapeHTML(a.name)}</option>`)
      .join("");

    const result = await foundry.applications.api.DialogV2.input({
      window: { title: "Link Companion" },
      content: `
        <div class="form-group">
          <label for="tcm-companion-actor">Companion Actor</label>
          <select id="tcm-companion-actor" name="actorUuid">
            ${options}
          </select>
        </div>
      `,
      ok: {
        label: "Link Companion"
      }
    });

    if (!result?.actorUuid) return;

    const actor = await fromUuid(result.actorUuid).catch(() => null);
    if (!actor) {
      return ui.notifications.error("Could not resolve that Actor.");
    }

    await this._linkCompanion(actor);
  }

  static async _onOpenCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    const actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    actor?.sheet?.render({ force: true });
  }

  static async _onSummonCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    if (!record) return;

    // Close both the manager and the Tamer's Actor sheet so neither UI
    // window can intercept Foundry's native canvas placement workflow.
    const manager = this;
    const tamerSheet = manager.tamer?.sheet;
    const sheetWasRendered = Boolean(tamerSheet?.rendered);

    await manager.close();
    if (sheetWasRendered) await tamerSheet.close();

    try {
      await TamerCompanionManager.summon(manager.tamer, record);
    } finally {
      if (sheetWasRendered) await tamerSheet.render({ force: true });
      await manager.render({ force: true });
    }
  }

  static async _onDismissCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    if (record && await TamerCompanionManager.dismiss(this.tamer, record)) await this.render({ force: true });
  }

  static async _onUnlinkCompanion(event, target) {
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

  static async _onOpenTamer() {
    await this.tamer.sheet?.render({ force: true });
  }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "openManager", {
    name: "Tamer Companion Manager",
    label: "Open Companion Manager",
    hint: "Open the Tamer Companion Manager using the first Tamer Actor you own.",
    icon: "fa-solid fa-paw",
    type: TamerCompanionManager,
    restricted: false
  });

  game.tamerCompanionManager = {
    open: actor => TamerCompanionManager.open(actor),
    isTamer: actor => TamerCompanionManager.isTamer(actor),
    getTamerLevel: actor => TamerCompanionManager.getTamerLevel(actor),
    getPocketFamilySlots: level => TamerCompanionManager.getPocketFamilySlots(level)
  };

  const addCompanionControl = (app, controls) => {
    const actor = app?.actor;
    if (!actor || !TamerCompanionManager.isTamer(actor)) return;
    if (controls.some(c => c.action === "tamer-companion-manager")) return;

    controls.unshift({
      action: "tamer-companion-manager",
      label: "Companions",
      icon: "fa-solid fa-paw",
      ownership: "OWNER",
      onClick: () => TamerCompanionManager.open(actor)
    });
  };

  Hooks.on("getHeaderControlsApplicationV2", addCompanionControl);
  Hooks.on("getHeaderControlsActorSheetV2", addCompanionControl);
});

globalThis.TamerCompanionManager = TamerCompanionManager;
