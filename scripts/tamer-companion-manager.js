const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companions";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TamerCompanionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer ?? null;
    this._tcmDragDrop = new foundry.applications.ux.DragDrop({ dragSelector: null, dropSelector: ".tcm-drop-zone", permissions: { drop: () => this._canAcceptCompanionDrop() }, callbacks: { drop: event => this._onDropCompanion(event), dragover: event => this._onDragOverCompanion(event) } });
  }

  static DEFAULT_OPTIONS = { id: "tamer-companion-manager", classes: ["tamer-companion-manager"], window: { title: "Tamer Companions", icon: "fa-solid fa-paw", resizable: true }, position: { width: 760, height: 650 }, actions: { refresh: this._onRefresh, addCompanion: this._onAddCompanion, openCompanion: this._onOpenCompanion, summonCompanion: this._onSummonCompanion, dismissCompanion: this._onDismissCompanion, unlinkCompanion: this._onUnlinkCompanion, openTamer: this._onOpenTamer, trainCompanion: this._onTrainCompanion } };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/companion-manager.hbs`, root: true } };

  async _prepareContext() {
    // The Settings submenu constructs this Application without a Tamer.
    // Choose the Tamer before the first render so the manager never opens
    // against a placeholder and never needs a second window/render cycle.
    if (!this.tamer) {
      this.tamer = await TamerCompanionManager.chooseTamer();
      if (!this.tamer) {
        this._tcmCancelInitialOpen = true;
        return {
          tamer: { name: "Select a Tamer", img: "icons/svg/mystery-man.svg", level: 0 },
          pocketFamily: { slots: 0, occupied: 0, empty: [] },
          limits: { size: "Small", cr: 0.5 },
          soulBond: { current: 0, max: 0 },
          companions: []
        };
      }
    }

    const level = TamerCompanionManager.getTamerLevel(this.tamer), slots = TamerCompanionManager.getPocketFamilySlots(level), records = TamerCompanionManager.records(this.tamer);
    const companions = await Promise.all(records.map(async (record, index) => { const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null; const token = record.tokenUuid ? await fromUuid(record.tokenUuid).catch(() => null) : null; const currentActor = token?.actor ?? actor; const progression = actor ? TamerCompanionManager.getProgression(record, actor, level) : { target: 0, chosen: 0, pending: 0, bonusHitDice: 0, asiHitDice: 0 }; return { index, slot: index + 1, name: currentActor?.name ?? actor?.name ?? record.name ?? "Unlinked Companion", img: currentActor?.img ?? actor?.img ?? "icons/svg/mystery-man.svg", type: currentActor?.system?.details?.type?.value ?? currentActor?.system?.details?.type ?? "Creature", hp: currentActor?.system?.attributes?.hp?.value ?? 0, hpMax: currentActor?.system?.attributes?.hp?.max ?? 0, ac: currentActor?.system?.attributes?.ac?.value ?? 0, vessel: record.vesselName || "No vessel assigned", linked: Boolean(actor), summoned: Boolean(token), progression }; }));
    const soulBondFeature = TamerCompanionManager.getSoulBondFeature(this.tamer);
    const soulBond = soulBondFeature ? { current: Number(soulBondFeature.system?.uses?.value ?? 0), max: Number(soulBondFeature.system?.uses?.max ?? 0) } : { current: 0, max: 0 };
    return { tamer: { name: this.tamer.name, img: this.tamer.img, level }, pocketFamily: { slots, occupied: companions.length, empty: Array.from({ length: Math.max(0, slots - companions.length) }, (_, i) => i) }, limits: { size: TamerCompanionManager.getMaxCompanionSize(level), cr: TamerCompanionManager.getMaxCompanionCR(level) }, soulBond, companions };
  }

  static records(actor) { return foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG_KEY) ?? []); }
  static async save(actor, records) { await actor.setFlag(MODULE_ID, FLAG_KEY, records); }
  static isTamer(actor) { return Boolean(actor?.items?.some(item => item.type === "class" && (String(item.name ?? "").trim().toLowerCase() === "tamer" || String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer"))); }
  static getTamerLevel(actor) { const cls = actor?.items?.find(item => item.type === "class" && (String(item.name ?? "").trim().toLowerCase() === "tamer" || String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer")); const classLevel = Number(cls?.system?.levels ?? cls?.system?.level ?? 0); return classLevel > 0 ? classLevel : Number(actor?.system?.details?.level ?? 0); }
  static getPocketFamilySlots(level) { if (level >= 19) return 5; if (level >= 15) return 4; if (level >= 11) return 3; if (level >= 3) return 2; if (level >= 1) return 1; return 0; }

  static getMaxCompanionSize(level) { if (level >= 13) return "Huge"; if (level >= 9) return "Large"; if (level >= 5) return "Medium"; return "Small"; }
  static getMaxCompanionCR(level) { if (level >= 19) return 6; if (level >= 16) return 5; if (level >= 13) return 4; if (level >= 10) return 3; if (level >= 7) return 2; if (level >= 4) return 1; return 0.5; }
  static getStandardImprovementSources() { return foundry.utils.deepClone(game.settings.get(MODULE_ID, "standardImprovementSources") ?? []); }
  static async getStandardImprovementItems() { return this.resolveSources(this.getStandardImprovementSources()); }
  static async resolveSources(sources) {
    const found = new Map();
    const visit = async uuid => {
      const doc = await fromUuid(uuid).catch(() => null);
      if (!doc) return;
      if (doc.documentName === "Item") { found.set(doc.uuid, doc); return; }
      if (doc.documentName === "Folder") for (const child of doc.contents ?? []) await visit(child.uuid);
    };
    for (const source of sources ?? []) await visit(source.uuid ?? source);
    return [...found.values()].sort((a,b) => a.name.localeCompare(b.name));
  }
  static getImprovementRegistry() { return foundry.utils.deepClone(game.settings.get(MODULE_ID, "improvementTrees") ?? []); }
  static async findBespokeTree(actor) {
    const name=String(actor?.name??"").trim().toLowerCase();
    return name ? this.getImprovementRegistry().find(t=>String(t.matchName??"").trim().toLowerCase()===name) ?? null : null;
  }
  static async resolveTreeItems(tree) { return this.resolveSources(tree?.sources ?? []); }
  static async getAvailableImprovements(actor,record) {
    const standard=await this.getStandardImprovementItems(), tree=await this.findBespokeTree(actor), bespoke=tree?await this.resolveTreeItems(tree):[];
    const owned=new Set((record?.improvements??[]).map(x=>String(x.sourceUuid??"")));
    const seen=new Set();
    return [...standard.map(item=>({item,tree:"Monster Trainer Improvements"})),...bespoke.map(item=>({item,tree:tree.name}))]
      .filter(e=>{if(owned.has(e.item.uuid)||seen.has(e.item.uuid))return false;seen.add(e.item.uuid);return true;});
  }
  static getImprovementDescriptionHTML(item) {
    return String(item?.system?.description?.value ?? "").trim();
  }

  static getImprovementDescription(item) {
    const raw = this.getImprovementDescriptionHTML(item);
    if (!raw) return "";
    return raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  }

  static normalizeImprovementName(name) {
    return String(name ?? "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  }

  static actorHasImprovement(actor, prerequisiteName) {
    const normalized = this.normalizeImprovementName(prerequisiteName);
    if (!normalized || !actor?.items) return false;
    return actor.items.some(item =>
      this.normalizeImprovementName(item.name) === normalized
      || this.normalizeImprovementName(item.system?.identifier) === normalized
    );
  }

  static parseImprovementPrerequisites(item) {
    const flags = item?.flags?.[MODULE_ID] ?? {};
    const system = item?.system ?? {};

    // Prefer explicit prerequisite data when the source Item provides it.
    const structuredLevel = Number(
      flags.minimumTamerLevel ??
      system.minimumTamerLevel ??
      system.prerequisites?.minimumTamerLevel ??
      system.requirements?.minimumTamerLevel ??
      0
    );

    const structuredNames = [
      ...(Array.isArray(flags.prerequisiteImprovements) ? flags.prerequisiteImprovements : []),
      ...(Array.isArray(system.prerequisites?.improvements) ? system.prerequisites.improvements : []),
      ...(Array.isArray(system.requirements?.improvements) ? system.requirements.improvements : [])
    ]
      .map(x => String(x?.name ?? x?.label ?? x ?? "").trim())
      .filter(Boolean);

    if (structuredLevel > 0 || structuredNames.length) {
      return {
        text: [
          structuredLevel > 0 ? `Tamer level ${structuredLevel}` : "",
          structuredNames.join(", ")
        ].filter(Boolean).join(", "),
        level: structuredLevel > 0 ? structuredLevel : 0,
        names: structuredNames
      };
    }

    // The Heliana/Tamer Items store prerequisites in their description text,
    // e.g. "Prerequisite: 5th-level tamer, Growth I".
    const text = this.getImprovementDescription(item);
    const match = text.match(/Prerequisite\s*:\s*([^\n.]+)/i);
    if (!match) return { text: "", level: 0, names: [] };

    const raw = match[1].trim();

    // Accept the source's normal forms:
    //   5th-level tamer
    //   9th-level tamer
    //   tamer level 9
    // and tolerate HTML/text normalization that leaves spaces around the hyphen.
    const levelMatch =
      raw.match(/(\\d+)\\s*(?:st|nd|rd|th)?\\s*-?\\s*level\\s+tamer/i) ??
      raw.match(/tamer\s+level\s+(\d+)/i);

    const level = levelMatch ? Number(levelMatch[1]) : 0;

    const names = raw
      .replace(/\\d+\\s*(?:st|nd|rd|th)?\\s*-?\\s*level\\s+tamer/ig, "")
      .replace(/tamer\s+level\s+\d+/ig, "")
      .split(/,|\\band\\b/i)
      .map(x => x.trim())
      .filter(x =>
        x &&
        !/^—$/.test(x) &&
        !/^become(?: a)? tamer(?:’s|')? companion$/i.test(x)
      );

    return { text: raw, level, names };
  }

  static getImprovementEligibility(item, actor, level, selectedSourceUuids, optionsByName) {
    const prereq = this.parseImprovementPrerequisites(item);
    const missing = [];
    if (prereq.level && level < prereq.level) missing.push(`Tamer level ${prereq.level}`);

    for (const name of prereq.names) {
      const normalized = this.normalizeImprovementName(name);
      if (!normalized) continue;
      if (this.actorHasImprovement(actor, name)) continue;
      const sourceUuid = optionsByName.get(normalized);
      if (!sourceUuid || !selectedSourceUuids.has(sourceUuid)) missing.push(name);
    }

    return { eligible: missing.length === 0, prerequisite: prereq.text, missing };
  }

  static async manageImprovements(tamer, record, actor) {
    const level = this.getTamerLevel(tamer);
    const progression = this.getProgression(record, actor, level);
    const standard = await this.getStandardImprovementItems();
    const tree = await this.findBespokeTree(actor);
    const bespoke = tree ? await this.resolveTreeItems(tree) : [];
    const sources = new Map();
    for (const item of standard) sources.set(item.uuid, { item, tree: "Monster Trainer Improvements" });
    for (const item of bespoke) sources.set(item.uuid, { item, tree: tree.name });

    const selected = new Map((record?.improvements ?? []).map(entry => [String(entry.sourceUuid ?? ""), entry]));
    const options = [...sources.values()];
    for (const entry of selected.values()) {
      if (sources.has(entry.sourceUuid)) continue;
      const item = entry.itemUuid ? await fromUuid(entry.itemUuid).catch(() => null) : null;
      if (item) options.push({ item, tree: "Selected Improvement" });
    }
    if (!options.length) return ui.notifications.info(`${actor.name} has no registered improvement Items available.`);

    const groups = new Map();
    for (const entry of options) {
      if (!groups.has(entry.tree)) groups.set(entry.tree, []);
      groups.get(entry.tree).push(entry);
    }

    const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
    const selectedUuids = new Set(selected.keys());
    const optionsByName = new Map();
    for (const { item } of options) optionsByName.set(this.normalizeImprovementName(item.name), item.uuid);

    // Level requirements come from the improvement Item's prerequisite text,
    // while the actual Tamer level is read from the Tamer's Tamer class Item.
    // Improvements above the current level are hidden; missing named prerequisites
    // remain visible and locked so the player can see what they need.
    const visibleGroups = [...groups.entries()].map(([treeName, entries]) => [
      treeName,
      entries.filter(({ item }) => {
        const prereq = this.parseImprovementPrerequisites(item);
        return selected.has(item.uuid) || !prereq.level || level >= prereq.level;
      })
    ]).filter(([, entries]) => entries.length);

    const groupHtml = visibleGroups.map(([treeName, entries]) => `
      <section class="tcm-advancement-group">
        <h3>${esc(treeName)}</h3>
        <div class="tcm-advancement-options">
          ${entries.sort((a,b) => a.item.name.localeCompare(b.item.name)).map(({item}) => {
            const uuid = item.uuid;
            const prereq = this.parseImprovementPrerequisites(item);
            const eligibility = this.getImprovementEligibility(item, actor, level, selectedUuids, optionsByName);
            const locked = !selected.has(uuid) && !eligibility.eligible;
            const prereqData = encodeURIComponent(JSON.stringify(prereq));
            const tooltipHtml = this.getImprovementDescriptionHTML(item);

            return `
              <label class="tcm-advancement-option${locked ? " is-locked" : ""}"
                data-tooltip-html="${esc(tooltipHtml)}"
                data-tooltip-class="tcm-improvement-tooltip"
                data-tooltip-direction="RIGHT">
                <input type="checkbox" name="improvement" value="${esc(uuid)}"${selected.has(uuid) ? " checked" : ""}${locked ? " disabled" : ""} data-prerequisites="${esc(prereqData)}">
                <span class="tcm-advancement-check"></span>
                <img class="tcm-advancement-icon" src="${esc(item.img || "icons/svg/item-bag.svg")}" alt="">
                <span class="tcm-advancement-text">
                  <strong>${esc(item.name)}</strong>
                  ${eligibility.missing.length ? `<em class="tcm-improvement-prerequisite">Requires: ${esc(eligibility.missing.join(", "))}</em>` : ""}
                </span>
              </label>`;
          }).join("")}
        </div>
      </section>`).join("");

    const content = `
      <div class="tcm-advancement">
        <div class="tcm-advancement-header">
          <div>
            <h2>Choose Improvement</h2>
            <p>Choose up to <strong>${progression.target}</strong> improvement${progression.target === 1 ? "" : "s"}. Hover over an improvement for its full description. Locked improvements show their prerequisites.</p>
          </div>
          <div class="tcm-advancement-count"><strong class="tcm-selected-count">${selected.size}</strong> / ${progression.target}</div>
        </div>
        <div class="tcm-advancement-list">${groupHtml}</div>
      </div>`;

    const result = await foundry.applications.api.DialogV2.wait({
      classes: ["tcm-improvement-dialog"],
      window: { title: `Choose Improvement — ${actor.name}`, resizable: true },
      position: { width: 760, height: 680 },
      content,
      buttons: [
        { action: "save", label: "Save Changes", default: true, callback: (event, button) => {
          const values = [...button.form.querySelectorAll('input[name="improvement"]:checked')].map(input => input.value);
          if (values.length > progression.target) {
            ui.notifications.warn(`This companion can have at most ${progression.target} selected improvement${progression.target === 1 ? "" : "s"}.`);
            return null;
          }
          return values;
        }},
        { action: "cancel", label: "Cancel" }
      ],
      render: dialog => {
        const root = dialog.element;
        const boxes = [...root.querySelectorAll('input[name="improvement"]')];
        const count = root.querySelector(".tcm-selected-count");
        const updateCount = () => {
          const selectedNow = new Set(boxes.filter(input => input.checked).map(input => input.value));
          const n = selectedNow.size;
          if (count) count.textContent = n;
          for (const input of boxes) {
            let prereq = { level: 0, names: [] };
            try { prereq = JSON.parse(decodeURIComponent(input.dataset.prerequisites || "")); } catch {}
            const missing = [];
            if (prereq.level && level < prereq.level) missing.push(`Tamer level ${prereq.level}`);
            for (const name of prereq.names ?? []) {
              if (this.actorHasImprovement(actor, name)) continue;
              const uuid = optionsByName.get(this.normalizeImprovementName(name));
              if (!uuid || !selectedNow.has(uuid)) missing.push(name);
            }
            const locked = !input.checked && missing.length > 0;
            input.dataset.locked = locked ? "true" : "false";
            input.disabled = locked || (!input.checked && n >= progression.target);
            const option = input.closest(".tcm-advancement-option");
            option?.classList.toggle("is-locked", locked);
            const note = option?.querySelector(".tcm-improvement-prerequisite");
            if (note) note.textContent = missing.length ? `Requires: ${missing.join(", ")}` : "";
          }
        };
        for (const input of boxes) {
          const option = input.closest(".tcm-advancement-option");
          if (option?.classList.contains("is-locked")) input.dataset.locked = "true";
          input.addEventListener("change", updateCount);
        }
        updateCount();
      }
    });

    if (!Array.isArray(result)) return false;
    const desired = new Set(result);
    const availableByUuid = new Map(options.map(({ item }) => [item.uuid, item]));
    const availableByName = new Map(options.map(({ item }) => [this.normalizeImprovementName(item.name), item.uuid]));

    // Validate the complete final selection, not just what the actor already owns.
    // A prerequisite is satisfied when that exact improvement is already owned or
    // is part of the final selection being saved. This allows selecting Growth I
    // and Growth II together, while preventing Growth II from being saved alone.
    const missingPrerequisites = [];
    for (const sourceUuid of desired) {
      const item = availableByUuid.get(sourceUuid);
      if (!item) continue;
      const eligibility = this.getImprovementEligibility(item, actor, level, desired, availableByName);
      if (!eligibility.eligible) {
        missingPrerequisites.push(`${item.name}: ${eligibility.missing.join(", ")}`);
      }
    }
    if (missingPrerequisites.length) {
      ui.notifications.warn(`Cannot save improvements because prerequisites are missing: ${missingPrerequisites.join("; ")}.`);
      return false;
    }
    const current = new Map((record?.improvements ?? []).map(entry => [String(entry.sourceUuid ?? ""), entry]));
    const records = this.records(tamer);
    const target = records.find(r => r.id === record.id);
    if (!target) return false;
    target.improvements ??= [];

    for (const [sourceUuid, entry] of current) {
      if (desired.has(sourceUuid)) continue;
      const removed = await this.deleteImprovementItem(actor, entry.itemUuid);
      if (!removed) return false;
      target.improvements = target.improvements.filter(x => String(x.sourceUuid ?? "") !== sourceUuid);
    }
    for (const sourceUuid of desired) {
      if (current.has(sourceUuid)) continue;
      const source = await fromUuid(sourceUuid).catch(() => null);
      if (!source || source.documentName !== "Item") {
        ui.notifications.warn(`Could not resolve improvement ${sourceUuid}; it was not added.`);
        continue;
      }
      const data = source.toObject(); delete data._id;
      const added = await this.addImprovementItem(actor, data, source.uuid);
      if (!added) return false;
      target.improvements.push({ itemUuid: added.uuid, itemId: added.id, sourceUuid: source.uuid, name: added.name, assignedAtLevel: level });
    }
    await this.save(tamer, records);
    ui.notifications.info(`${actor.name}'s improvements were updated.`);
    return true;
  }

  /**
   * Refresh open Actor sheets after D&D 5e performs an advancement bulk update.
   * The system updates the Actor synchronously, but an already-rendered sheet
   * may still be displaying its previous prepared data until it is rendered.
   */
  static async refreshActorSheets(actor) {
    for (const app of Object.values(actor?.apps ?? {})) {
      if (!app?.rendered) continue;
      try {
        await app.render({ force: true });
      } catch (error) {
        console.warn("[Tamer Companion Manager] Could not refresh an Actor sheet.", error);
      }
    }
  }

  /**
   * Add an improvement while respecting any D&D 5e Advancements configured on
   * the source Item. Directly embedding an Item would copy the advancement
   * definition but bypass the system's player-choice workflow.
   */
  static async addImprovementItem(actor, data, sourceUuid) {
    const AdvancementManager = globalThis.dnd5e?.applications?.advancement?.AdvancementManager;
    const hasAdvancement = data.system?.advancement?.size > 0
      || Object.keys(data.system?.advancement ?? {}).length > 0;

    if (!hasAdvancement || !AdvancementManager) {
      const created = await actor.createEmbeddedDocuments("Item", [data]);
      if (created?.[0]) await this.refreshActorSheets(actor);
      return created?.[0] ?? null;
    }

    const manager = AdvancementManager.forNewItem(actor, data);
    if (!manager?.steps?.length) {
      const created = await actor.createEmbeddedDocuments("Item", [data]);
      if (created?.[0]) await this.refreshActorSheets(actor);
      return created?.[0] ?? null;
    }

    return await new Promise(async resolve => {
      let completed = false;
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const originalClose = manager.close.bind(manager);
      manager.close = async options => {
        const result = await originalClose(options);
        if (!completed) finish(null);
        return result;
      };

      const hookId = Hooks.once("dnd5e.advancementManagerComplete", async completedManager => {
        if (completedManager !== manager) return;
        completed = true;
        const created = actor.items.find(item => item.flags?.dnd5e?.sourceId === sourceUuid)
          ?? actor.items.find(item => item.name === data.name && item.id !== data._id);
        await this.refreshActorSheets(actor);
        finish(created ?? null);
      });

      try {
        await manager.render(true);
      } catch (error) {
        Hooks.off("dnd5e.advancementManagerComplete", hookId);
        console.error("[Tamer Companion Manager] Improvement advancement failed.", error);
        ui.notifications.error(`The advancement for ${data.name} could not be completed. See the browser console for details.`);
        finish(null);
      }
    });
  }

  /**
   * Remove an improvement through the official D&D 5e Advancement Manager so
   * Ability Score, proficiency, HP, speed, and other advancement changes are
   * reversed before the Item is deleted.
   */
  static async deleteImprovementItem(actor, itemUuid) {
    const AdvancementManager = globalThis.dnd5e?.applications?.advancement?.AdvancementManager;
    const item = itemUuid ? await fromUuid(itemUuid).catch(() => null) : null;
    if (!item || item.documentName !== "Item") return true;

    if (!AdvancementManager || !item.hasAdvancement) {
      await item.delete();
      await this.refreshActorSheets(actor);
      return true;
    }

    const manager = AdvancementManager.forDeletedItem(actor, item.id);
    if (!manager?.steps?.length) {
      await item.delete();
      await this.refreshActorSheets(actor);
      return true;
    }

    return await new Promise(async resolve => {
      let completed = false;
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const originalClose = manager.close.bind(manager);
      manager.close = async options => {
        const result = await originalClose(options);
        if (!completed) finish(false);
        return result;
      };

      const hookId = Hooks.once("dnd5e.advancementManagerComplete", async completedManager => {
        if (completedManager !== manager) return;
        completed = true;
        await this.refreshActorSheets(actor);
        finish(true);
      });

      try {
        await manager.render(true);
      } catch (error) {
        Hooks.off("dnd5e.advancementManagerComplete", hookId);
        console.error("[Tamer Companion Manager] Improvement removal advancement failed.", error);
        ui.notifications.error(`The advancement effects from ${item.name} could not be removed. See the browser console for details.`);
        finish(false);
      }
    });
  }

  static getProgression(record,actor,level) {
    const chosen = (record?.improvements ?? []).length;
    // Monster Trainer grants one improvement whenever you gain a level beyond 1st.
    // Therefore a 1st-level Tamer has 0 choices, a 2nd-level Tamer has 1, etc.
    const target = Math.max(0, Number(level) - 1);
    const bespokeHitDice = record?.bespokeTreeId ? [3, 5, 11, 17].filter(l => Number(level) >= l).length : 0;
    return {
      target,
      chosen,
      pending: Math.max(0, target - chosen),
      bespokeHitDice,
      bonusHitDice: bespokeHitDice,
      bespokeTree: record?.bespokeTreeId ?? null
    };
  }

  static getSoulBondFeature(tamer) {
    return tamer?.items?.find(item => String(item.name ?? '').trim().toLowerCase() === 'soul bond' || String(item.system?.identifier ?? '').trim().toLowerCase() === 'soul-bond') ?? null;
  }

  static async openSoulBond(tamer) {
    const feature = this.getSoulBondFeature(tamer);
    if (!feature) return false;
    const available = Number(feature.system?.uses?.value ?? 0);
    if (available <= 0) return false;
    const records = this.records(tamer), damaged = [];
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const baseActor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
      const token = record.tokenUuid ? await fromUuid(record.tokenUuid).catch(() => null) : null;
      const actor = token?.actor ?? baseActor;
      if (!actor) continue;
      const hp = Number(actor.system?.attributes?.hp?.value ?? 0), max = Number(actor.system?.attributes?.hp?.max ?? 0);
      if (hp < max) damaged.push({ index, actor, hp, max, missing: max - hp });
    }
    if (!damaged.length) return false;
    const rows = damaged.map(({ index, actor, hp, max, missing }) =>
      '<div class="form-group"><label><strong>' + foundry.utils.escapeHTML(actor.name) + '</strong> — ' + hp + ' / ' + max + ' HP (missing ' + missing + ')</label><input type="number" name="heal-' + index + '" min="0" max="' + Math.min(available, missing) + '" value="0" step="1"></div>'
    ).join('');
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Soul Bond — Short Rest', resizable: true },
      position: { width: 520, height: 520 },
      content: '<p>Soul Bond can restore up to <strong>' + available + ' HP</strong> among your companions.</p><p class="hint">Allocate the healing below. The amount spent is deducted from the Soul Bond limited-use feature.</p><div class="tcm-soul-bond-list">' + rows + '</div>',
      buttons: [
        { action: 'restore', label: 'Restore HP', default: true, callback: (event, button) => {
          const healing = damaged.map(({ index }) => { const input = button.form.querySelector('[name="heal-' + index + '"]'); return { index, amount: Math.max(0, Number(input?.value ?? 0)) }; });
          const total = healing.reduce((sum, entry) => sum + entry.amount, 0);
          if (total > available) { ui.notifications.warn('Soul Bond has only ' + available + ' HP of healing remaining.'); return null; }
          if (healing.some(entry => entry.amount > damaged.find(d => d.index === entry.index).missing)) { ui.notifications.warn('Healing cannot exceed a companion\'s missing HP.'); return null; }
          if (!total) return null;
          return healing;
        } },
        { action: 'cancel', label: 'Skip' }
      ]
    });
    if (!Array.isArray(result)) return false;
    const freshFeature = this.getSoulBondFeature(tamer);
    if (!freshFeature) return false;
    const current = Number(freshFeature.system?.uses?.value ?? 0), total = result.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
    if (total <= 0) return false;
    if (total > current) return ui.notifications.warn('Soul Bond no longer has enough healing available.');
    let actualHealing = 0;
    for (const entry of result) {
      if (!entry.amount) continue;
      const record = records[entry.index], baseActor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null, token = record?.tokenUuid ? await fromUuid(record.tokenUuid).catch(() => null) : null, actor = token?.actor ?? baseActor;
      if (!actor) continue;
      const hp = Number(actor.system?.attributes?.hp?.value ?? 0), max = Number(actor.system?.attributes?.hp?.max ?? 0), healing = Math.min(Number(entry.amount), Math.max(0, max - hp));
      if (healing) { await actor.update({ 'system.attributes.hp.value': hp + healing }); actualHealing += healing; }
    }
    if (!actualHealing) return false;
    const spent = Number(freshFeature.system?.uses?.spent ?? 0);
    await freshFeature.update({ 'system.uses.spent': spent + actualHealing });
    ui.notifications.info('Soul Bond restored ' + actualHealing + ' HP among your companions. ' + Math.max(0, current - actualHealing) + ' use' + (current - actualHealing === 1 ? '' : 's') + ' remain.');
    return true;
  }
  static async summonedRecord(records) { for (const record of records) { if (!record.tokenUuid) continue; const token = await fromUuid(record.tokenUuid).catch(() => null); if (token) return { record, token }; } return null; }
  static tamerToken(tamer) { return canvas?.tokens?.controlled?.find(t => t.actor?.id === tamer.id) ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === tamer.id) ?? null; }
  static findAdjacentSpace(tamerToken) { const grid = canvas.grid.size, x = tamerToken.document.x, y = tamerToken.document.y, candidates = [{ x: x + grid, y }, { x: x - grid, y }, { x, y: y + grid }, { x, y: y - grid }]; for (const p of candidates) { const occupied = canvas.tokens.placeables.some(t => t.document.x === p.x && t.document.y === p.y); if (!occupied && p.x >= 0 && p.y >= 0) return p; } return null; }

  static async summon(tamer, record) {
    if (!canvas?.scene) return ui.notifications.warn("A scene must be active.");
    const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    if (!actor) return ui.notifications.error("The companion Actor could not be found.");
    const records = this.records(tamer);
    if (await this.summonedRecord(records)) { ui.notifications.warn("Another companion is already summoned."); return false; }
    const tamerToken = this.tamerToken(tamer); if (!tamerToken) { ui.notifications.warn("Place the Tamer's token on the current scene first."); return false; }
    const position = this.findAdjacentSpace(tamerToken); if (!position) { ui.notifications.warn("No adjacent unoccupied space was found."); return false; }
    const tokenDoc = await actor.getTokenDocument(position), created = await canvas.scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]), target = records.find(r => r.id === record.id);
    if (!target || !created?.[0]) return false; target.tokenUuid = created[0].uuid; target.status = "summoned"; await this.save(tamer, records); ui.notifications.info(`${actor.name} has been summoned.`); return true;
  }

  static async dismiss(tamer, record) { const records = this.records(tamer), target = records.find(r => r.id === record.id); if (!target) return false; if (target.tokenUuid) { const token = await fromUuid(target.tokenUuid).catch(() => null); if (token) await token.delete(); } target.tokenUuid = null; target.status = "in-vessel"; await this.save(tamer, records); ui.notifications.info(`${target.name ?? "Companion"} returned to its vessel.`); return true; }
  static async open(actor) {
    if (!actor) actor = await this.chooseTamer();
    if (!actor) return null;
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
  _canAcceptCompanionDrop() { if (!this.tamer || !TamerCompanionManager.isTamer(this.tamer)) return false; const records = TamerCompanionManager.records(this.tamer), max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer)); return records.length < max; }
  _onDragOverCompanion(event) { if (!this._canAcceptCompanionDrop()) return; event.dataTransfer.dropEffect = "link"; }
  async _onDropCompanion(event) { event.preventDefault(); if (!this._canAcceptCompanionDrop()) return ui.notifications.warn("No Pocket Family slot is available."); const data = TextEditor.getDragEventData(event); if (data?.type !== "Actor") return ui.notifications.warn("Only Actor documents can be added as companions."); let actor = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null; if (!actor && globalThis.Actor?.implementation?.fromDropData) actor = await Actor.implementation.fromDropData(data).catch(() => null); if (!actor) return ui.notifications.error("The dropped Actor could not be resolved."); await this._linkCompanion(actor); }
  async _linkCompanion(actor) {
    const records=TamerCompanionManager.records(this.tamer), max=TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
    if(records.length>=max)return ui.notifications.warn("No Pocket Family slot is available.");
    if(actor.id===this.tamer.id||actor.uuid===this.tamer.uuid)return ui.notifications.warn("The Tamer cannot be linked as their own companion.");
    if(!(actor.isOwner||game.user.isGM))return ui.notifications.warn("You do not have permission to use that Actor as a companion.");
    if(records.some(r=>r.actorUuid===actor.uuid))return ui.notifications.warn(`${actor.name} is already linked to this Tamer.`);
    const tree=await TamerCompanionManager.findBespokeTree(actor);
    records.push({id:foundry.utils.randomID(),actorUuid:actor.uuid,name:actor.name,vesselUuid:null,vesselName:"",tokenUuid:null,status:"in-vessel",improvements:[],bespokeTreeId:tree?.id??null,bonusHitDice:0});
    await TamerCompanionManager.save(this.tamer,records);
    ui.notifications.info(tree?`${actor.name} has been bonded with ${tree.name} improvements available.`:`${actor.name} has been bonded as a companion.`);
    await this.render({force:true}); return true;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if (this._tcmCancelInitialOpen) await this.close();
  }

  async _onRender(context, options) { await super._onRender(context, options); if (this.element) this._tcmDragDrop.bind(this.element); }
  static async _onRefresh() { await this.render({ force: true }); }

  static async chooseTamer() {
    const tamers = game.actors.contents
      .filter(actor => TamerCompanionManager.isTamer(actor) && (actor.isOwner || game.user.isGM))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!tamers.length) {
      ui.notifications.warn("No Tamer Actors were found that you can manage.");
      return null;
    }
    if (tamers.length === 1) return tamers[0];

    const options = tamers.map(actor => {
      const level = TamerCompanionManager.getTamerLevel(actor);
      return `<option value="${foundry.utils.escapeHTML(actor.uuid)}">${foundry.utils.escapeHTML(actor.name)} — Level ${level}</option>`;
    }).join("");

    const result = await foundry.applications.api.DialogV2.input({
      window: { title: "Select Tamer Companion Storage" },
      content: `
        <p>Select which Tamer's Pocket Family you want to manage.</p>
        <div class="form-group">
          <label for="tcm-tamer-select">Tamer</label>
          <select id="tcm-tamer-select" name="tamerUuid">${options}</select>
        </div>
      `,
      ok: { label: "Open Companion Manager" }
    });
    if (!result?.tamerUuid) return null;
    return await fromUuid(result.tamerUuid).catch(() => null);
  }
  static async _onAddCompanion() { const records = TamerCompanionManager.records(this.tamer), max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer)); if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available."); const available = game.actors.contents.filter(a => a.id !== this.tamer.id && (a.isOwner || game.user.isGM)).filter(a => !records.some(r => r.actorUuid === a.uuid)).sort((a,b) => a.name.localeCompare(b.name)); if (!available.length) return ui.notifications.warn("No available Actors were found."); const options = available.map(a => `<option value="${foundry.utils.escapeHTML(a.uuid)}">${foundry.utils.escapeHTML(a.name)}</option>`).join(""); const result = await foundry.applications.api.DialogV2.input({ window: { title: "Link Companion" }, content: `<div class="form-group"><label for="tcm-companion-actor">Companion Actor</label><select id="tcm-companion-actor" name="actorUuid">${options}</select></div>`, ok: { label: "Link Companion" } }); if (!result?.actorUuid) return; const actor = await fromUuid(result.actorUuid).catch(() => null); if (!actor) return ui.notifications.error("Could not resolve that Actor."); await this._linkCompanion(actor); }
  static async _onOpenCompanion(event, target) { const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)], actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null; actor?.sheet?.render({ force: true }); }

  static async _onSummonCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)]; if (!record) return;
    const manager = this, tamerSheet = manager.tamer?.sheet, sheetWasRendered = Boolean(tamerSheet?.rendered);
    await manager.close();
    if (sheetWasRendered) await tamerSheet.close();
    // Do not re-render either window. Both remain closed after summoning.
    await TamerCompanionManager.summon(manager.tamer, record);
  }

  static async _onTrainCompanion(event,target) {
    const record=TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    const actor=record?.actorUuid?await fromUuid(record.actorUuid).catch(()=>null):null;
    if(!record||!actor)return;
    const progression=TamerCompanionManager.getProgression(record,actor,TamerCompanionManager.getTamerLevel(this.tamer));
    if(progression.target<=0 && progression.chosen<=0) return ui.notifications.info(`${actor.name} does not have an improvement available until Tamer level 2.`);
    if(await TamerCompanionManager.manageImprovements(this.tamer,record,actor))await this.render({force:true});
  }

  static async _onDismissCompanion(event, target) { const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)]; if (record && await TamerCompanionManager.dismiss(this.tamer, record)) await this.render({ force: true }); }
  static async _onUnlinkCompanion(event, target) { const records = TamerCompanionManager.records(this.tamer), record = records[Number(target.dataset.index)]; if (!record) return; const yes = await foundry.applications.api.DialogV2.confirm({ window: { title: "Unlink Companion" }, content: `<p>Unlink <strong>${foundry.utils.escapeHTML(record.name ?? "this companion")}</strong>?</p>`, yes: { label: "Unlink" }, no: { label: "Cancel" } }); if (!yes) return; if (record.tokenUuid) { const token = await fromUuid(record.tokenUuid).catch(() => null); if (token) await token.delete(); } records.splice(Number(target.dataset.index), 1); await TamerCompanionManager.save(this.tamer, records); await this.render({ force: true }); }
  static async _onOpenTamer() { await this.tamer.sheet?.render({ force: true }); }
}

class TamerCompanionImprovementRegistry extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={id:"tamer-bespoke-improvements",window:{title:"Bespoke Companion Improvements",icon:"fa-solid fa-tree"},position:{width:720,height:620},actions:{addTree:this._onAddTree,saveTree:this._onSaveTree,editTree:this._onEditTree,removeTree:this._onRemoveTree,cancelEdit:this._onCancelEdit,removeStandardSource:this._onRemoveStandardSource,removeTreeSource:this._onRemoveTreeSource}};
  static PARTS={main:{template:`modules/${MODULE_ID}/templates/improvement-registry.hbs`,root:true}};
  constructor(options={}){super(options);this.editing=null;}
  async _prepareContext(){return{trees:TamerCompanionManager.getImprovementRegistry(),standardSources:TamerCompanionManager.getStandardImprovementSources(),editing:this.editing};}
  static async _onAddTree(){this.editing={id:foundry.utils.randomID(),name:"",matchName:"",sources:[]};await this.render({force:true});}
  static async _onEditTree(event,target){this.editing=TamerCompanionManager.getImprovementRegistry().find(t=>t.id===target.dataset.id)??null;if(this.editing)await this.render({force:true});}
  static async _onCancelEdit(){this.editing=null;await this.render({force:true});}
  static async _onSaveTree(event,target){
    if(!this.editing)return;
    const form=target.closest("form"),name=String(form?.elements?.name?.value??"").trim(),matchName=String(form?.elements?.matchName?.value??"").trim();
    if(!name||!matchName)return ui.notifications.warn("Enter both a tree name and an exact companion name.");
    const trees=TamerCompanionManager.getImprovementRegistry(),tree={...this.editing,name,matchName,updatedAt:Date.now()};
    const i=trees.findIndex(t=>t.id===tree.id);if(i>=0)trees[i]=tree;else trees.push(tree);
    await game.settings.set(MODULE_ID,"improvementTrees",trees);this.editing=null;await this.render({force:true});
  }
  static async _onRemoveTree(event,target){const trees=TamerCompanionManager.getImprovementRegistry().filter(t=>t.id!==target.dataset.id);await game.settings.set(MODULE_ID,"improvementTrees",trees);await this.render({force:true});}
  static async _onRemoveStandardSource(event,target){
    const uuid=target.dataset.uuid;
    if(!uuid)return;
    const sources=TamerCompanionManager.getStandardImprovementSources().filter(x=>(x.uuid??x)!==uuid);
    await game.settings.set(MODULE_ID,"standardImprovementSources",sources);
    await this.render({force:true});
  }
  static async _onRemoveTreeSource(event,target){
    const uuid=target.dataset.uuid;
    if(!uuid||!this.editing)return;
    this.editing.sources=(this.editing.sources??[]).filter(x=>(x.uuid??x)!==uuid);
    await this.render({force:true});
  }
  async _onRender(context,options){
    await super._onRender(context,options);if(!this.element)return;
    const drop=new foundry.applications.ux.DragDrop({dragSelector:null,dropSelector:".tcm-tree-drop-zone, .tcm-standard-drop-zone",permissions:{drop:()=>true},callbacks:{drop:async event=>{
      event.preventDefault();
      const data=TextEditor.getDragEventData(event);if(!["Item","Folder"].includes(data?.type))return ui.notifications.warn("Drop an Item or Folder here.");
      const doc=data.uuid?await fromUuid(data.uuid).catch(()=>null):null;if(!doc)return ui.notifications.error("The dropped document could not be resolved.");
      const standardZone=event.target.closest(".tcm-standard-drop-zone");
      if(standardZone){
        const sources=TamerCompanionManager.getStandardImprovementSources();
        if(!sources.some(x=>(x.uuid??x)===doc.uuid))sources.push({uuid:doc.uuid,name:doc.name,type:doc.documentName});
        await game.settings.set(MODULE_ID,"standardImprovementSources",sources);
      } else {
        if(!this.editing)return;
        this.editing.sources??=[];if(!this.editing.sources.some(x=>(x.uuid??x)===doc.uuid))this.editing.sources.push({uuid:doc.uuid,name:doc.name,type:doc.documentName});
      }
      await this.render({force:true});
    }}});
    drop.bind(this.element);
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "improvementTrees", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(MODULE_ID, "standardImprovementSources", { scope: "world", config: false, type: Array, default: [] });
  game.settings.registerMenu(MODULE_ID, "openImprovementRegistry", { name: "Bespoke Companion Improvements", label: "Register Improvements", hint: "Register additional improvement trees for bespoke companions.", icon: "fa-solid fa-tree", type: TamerCompanionImprovementRegistry, restricted: true });
  game.settings.registerMenu(MODULE_ID, "openManager", { name: "Tamer Companion Manager", label: "Open Companion Manager", hint: "Open the Tamer Companion Manager using the first Tamer Actor you own.", icon: "fa-solid fa-paw", type: TamerCompanionManager, restricted: false });
  game.tamerCompanionManager = { open: actor => TamerCompanionManager.open(actor), isTamer: actor => TamerCompanionManager.isTamer(actor), getTamerLevel: actor => TamerCompanionManager.getTamerLevel(actor), getPocketFamilySlots: level => TamerCompanionManager.getPocketFamilySlots(level) };
  const addCompanionControl = (app, controls) => { const actor = app?.actor; if (!actor || !TamerCompanionManager.isTamer(actor)) return; if (controls.some(c => c.action === "tamer-companion-manager")) return; controls.unshift({ action: "tamer-companion-manager", label: "Companions", icon: "fa-solid fa-paw", ownership: "OWNER", onClick: () => TamerCompanionManager.open(actor) }); };
  Hooks.on("getHeaderControlsApplicationV2", addCompanionControl);
  Hooks.on("getHeaderControlsActorSheetV2", addCompanionControl);
  Hooks.on("dnd5e.restCompleted", async (actor, result, config) => {
    if (config?.type !== "short" || !TamerCompanionManager.isTamer(actor)) return;
    if (!(actor.isOwner || game.user.isGM)) return;
    try {
      if (await TamerCompanionManager.openSoulBond(actor)) {
        for (const app of Object.values(ui.windows ?? {})) {
          if (app instanceof TamerCompanionManager && app.tamer?.id === actor.id) await app.render({ force: true });
        }
      }
    } catch (error) {
      console.error("[Tamer Companion Manager] Soul Bond short-rest handling failed.", error);
      ui.notifications.error("Soul Bond could not be processed. See the browser console for details.");
    }
  });
});

globalThis.TamerCompanionManager = TamerCompanionManager;

globalThis.TamerCompanionImprovementRegistry = TamerCompanionImprovementRegistry;
