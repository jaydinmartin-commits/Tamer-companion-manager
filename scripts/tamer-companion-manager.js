const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companions";

const DEFAULT_SPLICER_AUGMENTS = [
  {id:"water-breathing",name:"Water Breathing",description:"The companion can breathe only water.",cost:0,repeatable:false,maxCount:1},
  {id:"amphibious",name:"Amphibious",description:"The companion can breathe both air and water.",cost:1,repeatable:false,maxCount:1},
  {id:"darkvision",name:"Darkvision",description:"The companion gains darkvision to 60 feet. If it already has darkvision, increase its range by 60 feet, to a maximum of 120 feet.",cost:1,repeatable:true,maxCount:2},
  {id:"extra-limb",name:"Extra Limb",description:"The companion gains one additional limb, allowing it to grapple one additional target. This augment can be taken up to four times.",cost:1,repeatable:true,maxCount:4},
  {id:"fins-webbing",name:"Fins & Webbing",description:"The companion gains a swimming speed of 30 feet, or its existing slower swimming speed becomes 30 feet.",cost:1,repeatable:false,maxCount:1},
  {id:"illumination",name:"Illumination",description:"The companion sheds bright light in a 10-foot radius and dim light for an additional 10 feet.",cost:1,repeatable:false,maxCount:1},
  {id:"keen-hearing",name:"Keen Hearing",description:"The companion has advantage on Wisdom (Perception) checks that rely on hearing.",cost:1,repeatable:false,maxCount:1},
  {id:"keen-sight",name:"Keen Sight",description:"The companion has advantage on Wisdom (Perception) checks that rely on sight.",cost:1,repeatable:false,maxCount:1},
  {id:"keen-smell",name:"Keen Smell",description:"The companion has advantage on Wisdom (Perception) checks that rely on smell.",cost:1,repeatable:false,maxCount:1},
  {id:"powerful-build",name:"Powerful Build",description:"The companion counts as one size larger when determining carrying capacity and the amount it can push, drag, or lift.",cost:1,repeatable:false,maxCount:1},
  {id:"prehensile-tail",name:"Prehensile Tail",description:"The companion gains a climbing speed of 30 feet, or its existing slower climbing speed becomes 30 feet.",cost:1,repeatable:false,maxCount:1},
  {id:"slippery",name:"Slippery",description:"The companion has advantage on ability checks and saving throws made to escape a grapple.",cost:1,repeatable:false,maxCount:1},
  {id:"sure-footed",name:"Sure-Footed",description:"The companion has advantage on Strength and Dexterity saving throws against being knocked prone.",cost:1,repeatable:false,maxCount:1},
  {id:"web-sense-web-walk",name:"Web Sense + Web Walk",description:"The companion knows the exact location of creatures touching the same web and ignores movement restrictions caused by webbing.",cost:1,repeatable:false,maxCount:1},
  {id:"burrowing-claws",name:"Burrowing Claws",description:"The companion gains a burrowing speed of 15 feet and leaves no opening behind, or its existing slower burrowing speed becomes 15 feet.",cost:2,repeatable:false,maxCount:1},
  {id:"long-limbed",name:"Long Limbed",description:"The companion's melee attack reach increases by 5 feet.",cost:2,repeatable:false,maxCount:1},
  {id:"mimicry",name:"Mimicry",description:"The companion can mimic simple sounds. A creature can identify the imitation with a successful DC 8 + proficiency bonus Wisdom (Insight) check.",cost:2,repeatable:false,maxCount:1},
  {id:"natural-armour",name:"Natural Armour",description:"The companion gains a +1 bonus to AC. This augment can be taken up to three times, increasing the bonus by 1 each time.",cost:2,repeatable:true,maxCount:3},
  {id:"poisonous-touch",name:"Poisonous Touch",description:"The first time each turn the companion hits with a weapon, the attack deals an extra 1d4 poison damage. A second application is available at 9th level and increases the extra damage to 2d4.",cost:2,repeatable:true,maxCount:2,minLevelForSecond:9,exclusiveGroup:"elemental-touch"},
  {id:"spider-climb",name:"Spider Climb",description:"The companion can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",cost:2,repeatable:false,maxCount:1},
  {id:"camouflage",name:"Camouflage",description:"The companion has advantage on Dexterity (Stealth) checks while it is not moving.",cost:3,repeatable:false,maxCount:1},
  {id:"corrosive-touch",name:"Corrosive Touch",description:"The first time each turn the companion hits with a weapon, the attack deals an extra 1d6 acid damage. A second application is available at 13th level and increases the extra damage to 2d6.",cost:3,repeatable:true,maxCount:2,minLevelForSecond:13,exclusiveGroup:"elemental-touch"},
  {id:"tremorsense",name:"Tremorsense",description:"The companion gains tremorsense to 15 feet. A second application increases the range by another 15 feet, to a maximum of 30 feet.",cost:3,repeatable:true,maxCount:2},
  {id:"wings",name:"Wings",description:"The companion gains a flying speed of 30 feet, or its existing slower flying speed becomes 30 feet.",cost:3,repeatable:false,maxCount:1},
  {id:"blindsight-echolocation",name:"Blindsight + Echolocation",description:"The companion gains blindsight to 15 feet. A second application increases the range by another 15 feet, to a maximum of 30 feet. The companion cannot use this blindsight while deafened.",cost:4,repeatable:true,maxCount:2},
  {id:"decaying-touch",name:"Decaying Touch",description:"The first time each turn the companion hits with a weapon, the attack deals an extra 1d8 necrotic damage. A second application is available at 17th level and increases the extra damage to 2d8.",cost:4,repeatable:true,maxCount:2,minLevelForSecond:17,exclusiveGroup:"elemental-touch"},
  {id:"flyby",name:"Flyby",description:"The companion does not provoke opportunity attacks when it flies out of an enemy's reach.",cost:4,repeatable:false,maxCount:1},
  {id:"growth-hormone",name:"Growth Hormone",description:"The companion increases by one size category, its Hit Die size increases by one step, and its hit point maximum increases by 1 per Hit Die. This augment can be taken multiple times, but the companion cannot exceed the maximum size permitted by the Tamer's level.",cost:4,repeatable:true,maxCount:4,growth:true}
];


const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TamerCompanionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer ?? null;
    this._tcmDragDrop = new foundry.applications.ux.DragDrop({ dragSelector: null, dropSelector: ".tcm-drop-zone", permissions: { drop: selector => this._canAcceptCompanionDrop(selector) }, callbacks: { drop: event => this._onDropManager(event), dragover: event => this._onDragOverManager(event) } });
  }

  static DEFAULT_OPTIONS = { id: "tamer-companion-manager", classes: ["tamer-companion-manager"], window: { title: "Tamer Companions", icon: "fa-solid fa-paw", resizable: true }, position: { width: 760, height: 650 }, actions: { refresh: this._onRefresh, addCompanion: this._onAddCompanion, openCompanion: this._onOpenCompanion, summonCompanion: this._onSummonCompanion, dismissCompanion: this._onDismissCompanion, unlinkCompanion: this._onUnlinkCompanion, openTamer: this._onOpenTamer, trainCompanion: this._onTrainCompanion, clearVessel: this._onClearVessel, openSplicer: this._onOpenSplicer } };
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

    const level = TamerCompanionManager.getTamerLevel(this.tamer);
    const slots = TamerCompanionManager.getPocketFamilySlots(level);
    const records = TamerCompanionManager.records(this.tamer);
    const splicerEnabled = TamerCompanionManager.isSplicer(this.tamer);
    const splicerRegistry = splicerEnabled ? TamerCompanionManager.getSplicerAugmentRegistry() : null;
    const splicerCosts = splicerRegistry
      ? new Map(splicerRegistry.map(a => [String(a.id), Number(a.cost ?? 0)]))
      : null;

    // Resolve each linked document once per render. The previous implementation
    // resolved summoned tokens and vessels once during reconciliation and then
    // resolved them again while building the card context. On a normal manager
    // render that meant multiple asynchronous UUID lookups per companion.
    const resolved = await Promise.all(records.map(async record => {
      const actor = await TamerCompanionManager.resolveCompanionActor(record);
      const token = record?.tokenUuid
        ? await fromUuid(record.tokenUuid).catch(() => null)
        : null;
      const vessel = record?.vesselUuid
        ? await TamerCompanionManager.getVessel(record, this.tamer)
        : null;
      return { record, actor, token, vessel };
    }));

    let stateChanged = false;
    for (const entry of resolved) {
      const record = entry.record;
      if (record?.tokenUuid && !entry.token) {
        record.tokenUuid = null;
        record.status = "in-vessel";
        entry.token = null;
        stateChanged = true;
      }
      if (record?.vesselUuid && !entry.vessel) {
        record.vesselUuid = null;
        record.vesselName = "";
        stateChanged = true;
      }
    }
    if (stateChanged) await TamerCompanionManager.save(this.tamer, records);

    const getSpent = (assignments) => (assignments ?? []).reduce((total, entry) => {
      const cost = splicerCosts?.get(String(entry?.id));
      return total + (cost == null
        ? 0
        : cost * Math.max(0, Math.floor(Number(entry?.count ?? 0))));
    }, 0);

    const companions = resolved.map(({ record, actor, token, vessel }, index) => {
      const currentActor = token?.actor ?? actor;
      const progression = actor
        ? TamerCompanionManager.getProgression(record, actor, level)
        : { target: 0, chosen: 0, pending: 0, bonusHitDice: 0, asiHitDice: 0, totalBonusHitDice: 0 };
      const splicerActive = splicerEnabled
        ? TamerCompanionManager.getSplicerAssignments(record)
        : [];
      const splicerPending = splicerEnabled
        ? TamerCompanionManager.getSplicerPendingAssignments(record)
        : [];
      const activeSpent = splicerEnabled ? getSpent(splicerActive) : 0;
      const pendingSpent = splicerEnabled ? getSpent(splicerPending) : 0;

      return {
        index,
        slot: index + 1,
        name: currentActor?.name ?? actor?.name ?? record.name ?? "Unlinked Companion",
        img: currentActor?.img ?? actor?.img ?? "icons/svg/mystery-man.svg",
        type: currentActor?.system?.details?.type?.value ?? currentActor?.system?.details?.type ?? "Creature",
        hp: currentActor?.system?.attributes?.hp?.value ?? 0,
        hpMax: currentActor?.system?.attributes?.hp?.max ?? 0,
        ac: currentActor?.system?.attributes?.ac?.value ?? 0,
        vessel: vessel?.name ?? record.vesselName ?? "No vessel assigned",
        vesselImg: vessel?.img ?? "icons/svg/item-bag.svg",
        vesselEquipped: Boolean(vessel?.system?.equipped),
        linked: Boolean(actor),
        summoned: Boolean(token),
        progression,
        splicer: {
          enabled: splicerEnabled,
          active: splicerActive,
          pending: JSON.stringify(splicerActive) !== JSON.stringify(splicerPending),
          spent: pendingSpent,
          pendingSpent
        }
      };
    });
    const soulBondFeature = TamerCompanionManager.getSoulBondFeature(this.tamer);
    const soulBond = soulBondFeature ? { current: Number(soulBondFeature.system?.uses?.value ?? 0), max: Number(soulBondFeature.system?.uses?.max ?? 0) } : { current: 0, max: 0 };
    return { tamer: { name: this.tamer.name, img: this.tamer.img, level }, pocketFamily: { slots, occupied: companions.length, empty: Array.from({ length: Math.max(0, slots - companions.length) }, (_, i) => i) }, limits: { size: TamerCompanionManager.getMaxCompanionSize(level), cr: TamerCompanionManager.getMaxCompanionCR(level) }, soulBond, paradigms: { splicer: TamerCompanionManager.isSplicer(this.tamer) }, companions };
  }

  static records(actor) { return foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG_KEY) ?? []); }

  static async resolveCompanionActor(record) {
    if (!record) return null;
    if (record.actorUuid) {
      const actor = await fromUuid(record.actorUuid).catch(() => null);
      if (actor?.documentName === "Actor") return actor;
    }
    if (record.actorId) {
      const actor = game.actors?.get(record.actorId) ?? null;
      if (actor?.documentName === "Actor") return actor;
    }
    return null;
  }

  static isValidVesselItem(item) {
    if (!item || item.documentName !== "Item") return false;

    // D&D5e item types that can function as a physical companion vessel.
    // Keep this deliberately narrow so classes, spells, feats, backgrounds,
    // etc. can never appear in the vessel selector.
    const allowedTypes = new Set([
      "equipment",
      "weapon",
      "consumable",
      "tool",
      "loot",
      "container"
    ]);

    return allowedTypes.has(String(item.type ?? "").toLowerCase());
  }

  static async getVessel(record, tamer) {
    if (!record?.vesselUuid || !tamer) return null;
    const vessel = await fromUuid(record.vesselUuid).catch(() => null);
    if (!vessel || !this.isValidVesselItem(vessel) || vessel.parent?.uuid !== tamer.uuid) return null;
    return vessel;
  }
  static async setVessel(tamer, record, item) {
    if (!tamer || !record || !this.isValidVesselItem(item)) return false;
    if (item.parent?.uuid !== tamer.uuid) { ui.notifications.warn("A companion vessel must be an Item on the Tamer."); return false; }
    const records = this.records(tamer), target = records.find(r => r.id === record.id);
    if (!target) return false;
    if (records.some(r => r.id !== target.id && r.vesselUuid === item.uuid)) { ui.notifications.warn("That vessel is already assigned to another companion."); return false; }
    target.vesselUuid = item.uuid; target.vesselName = item.name;
    await this.save(tamer, records);
    ui.notifications.info(`${item.name} is now the vessel for ${target.name ?? "this companion"}.`);
    return true;
  }
  static async refreshOpenManagers(tamer) {
    if (!tamer) return;
    for (const app of Object.values(ui.windows ?? {})) {
      if (app instanceof TamerCompanionManager && app.tamer?.id === tamer.id) {
        await app.render({ force: true });
      }
    }
  }

  static async clearVessel(tamer, record) {
    const records = this.records(tamer), target = records.find(r => r.id === record?.id);
    if (!target) return false;
    target.vesselUuid = null; target.vesselName = "";
    await this.save(tamer, records);
    return true;
  }
  static async save(actor, records) { await actor.setFlag(MODULE_ID, FLAG_KEY, records); }
  static isTamer(actor) { return Boolean(actor?.items?.some(item => item.type === "class" && (String(item.name ?? "").trim().toLowerCase() === "tamer" || String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer"))); }
  static getTamerLevel(actor) { const cls = actor?.items?.find(item => item.type === "class" && (String(item.name ?? "").trim().toLowerCase() === "tamer" || String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer")); const classLevel = Number(cls?.system?.levels ?? cls?.system?.level ?? 0); return classLevel > 0 ? classLevel : Number(actor?.system?.details?.level ?? 0); }
  static getPocketFamilySlots(level) { if (level >= 19) return 6; if (level >= 15) return 5; if (level >= 11) return 4; if (level >= 7) return 3; if (level >= 3) return 2; if (level >= 1) return 1; return 0; }

  static getMaxCompanionSize(level) { if (level >= 13) return "Huge"; if (level >= 9) return "Large"; if (level >= 5) return "Medium"; return "Small"; }
  static getMaxCompanionCR(level) { if (level >= 19) return 6; if (level >= 16) return 5; if (level >= 13) return 4; if (level >= 10) return 3; if (level >= 7) return 2; if (level >= 4) return 1; return 0.5; }
  static getCompanionEligibility(actor, tamer) {
    const level = this.getTamerLevel(tamer);
    const maxCR = this.getMaxCompanionCR(level);
    const maxSize = this.getMaxCompanionSize(level);
    const sizeOrder = { tiny: 0, small: 1, medium: 2, large: 3, huge: 4, gargantuan: 5 };
    const rawSize = actor?.system?.traits?.size ?? actor?.system?.details?.size ?? "";
    const size = String(rawSize ?? "").trim().toLowerCase();
    const rawCR = actor?.system?.details?.cr ?? actor?.system?.details?.cr?.value ?? 0;
    const cr = Number(rawCR);
    const typeValue = actor?.system?.details?.type?.value ?? actor?.system?.details?.type ?? actor?.system?.traits?.creatureType ?? "";
    const creatureType = typeof typeValue === "object"
      ? String(typeValue.value ?? typeValue.type ?? "").trim().toLowerCase()
      : String(typeValue).trim().toLowerCase();
    const errors = [];
    if (["humanoid", "giant", "swarm"].includes(creatureType)) errors.push("Creature type cannot be humanoid, giant, or swarm.");
    if (Number.isFinite(cr) && cr > maxCR) errors.push("CR " + cr + " exceeds your maximum companion CR of " + maxCR + ".");
    const maxRank = sizeOrder[String(maxSize).toLowerCase()] ?? 0;
    const sizeRank = sizeOrder[size];
    if (sizeRank !== undefined && sizeRank > maxRank) errors.push("Size " + size + " exceeds your maximum companion size of " + maxSize + ".");
    return {
      valid: errors.length === 0,
      errors,
      level,
      maxCR,
      maxSize,
      creatureType,
      cr: Number.isFinite(cr) ? cr : null,
      size: size || "unknown"
    };
  }


  static isSplicer(actor) {
    return Boolean(actor?.items?.some(item => {
      const name = String(item.name ?? "").trim().toLowerCase();
      const identifier = String(item.system?.identifier ?? "").trim().toLowerCase();
      return name === "splicer" || identifier === "splicer";
    }));
  }

  static getSplicerAugmentRegistry() {
    const configured = foundry.utils.deepClone(game.settings.get(MODULE_ID, "splicerAugments") ?? []);
    return configured.length ? configured : foundry.utils.deepClone(DEFAULT_SPLICER_AUGMENTS);
  }

  static getSplicerTotalPoints(tamer) {
    const level = this.getTamerLevel(tamer);
    return level >= 3 ? level : 0;
  }

  static getSplicerAssignments(record) {
    return Array.isArray(record?.splicer?.augments) ? foundry.utils.deepClone(record.splicer.augments) : [];
  }

  static getSplicerPendingAssignments(record) {
    return Array.isArray(record?.splicer?.pendingAugments)
      ? foundry.utils.deepClone(record.splicer.pendingAugments)
      : this.getSplicerAssignments(record);
  }

  static getSplicerSpentPoints(record, assignments = null, registry = null) {
    const augmentRegistry = registry ?? new Map(
      this.getSplicerAugmentRegistry().map(a => [String(a.id), a])
    );
    const source = Array.isArray(assignments) ? assignments : this.getSplicerAssignments(record);
    return source.reduce((total, entry) => {
      const augment = augmentRegistry instanceof Map
        ? augmentRegistry.get(String(entry?.id))
        : augmentRegistry.find?.(a => String(a.id) === String(entry?.id));
      return total + (augment
        ? Number(augment.cost ?? 0) * Math.max(0, Math.floor(Number(entry?.count ?? 0)))
        : 0);
    }, 0);
  }

  static getSplicerSharedSpentPoints(tamer, excludeRecordId = null) {
    return this.records(tamer).reduce((total, record) => {
      if (!record || (excludeRecordId && record.id === excludeRecordId)) return total;
      return total + this.getSplicerSpentPoints(record, this.getSplicerPendingAssignments(record));
    }, 0);
  }

  static getSplicerAvailablePoints(tamer, record = null, assignments = null) {
    const total = this.getSplicerTotalPoints(tamer);
    const otherSpent = this.getSplicerSharedSpentPoints(tamer, record?.id ?? null);
    const currentSpent = record ? this.getSplicerSpentPoints(record, assignments ?? this.getSplicerPendingAssignments(record)) : 0;
    return Math.max(0, total - otherSpent - currentSpent);
  }

  static validateSplicerAssignments(tamer, record, assignments) {
    const level = this.getTamerLevel(tamer);
    const registry = new Map(this.getSplicerAugmentRegistry().map(a => [String(a.id), a]));
    const normalized = [];
    const seen = new Set();
    const errors = [];

    for (const raw of Array.isArray(assignments) ? assignments : []) {
      const id = String(raw?.id ?? "").trim();
      const count = Math.floor(Number(raw?.count ?? 0));
      if (!id || count <= 0) continue;
      const augment = registry.get(id);
      if (!augment) { errors.push(`Unknown Splicer augment: ${id}`); continue; }
      if (seen.has(id)) { errors.push(`Duplicate Splicer augment entry: ${augment.name}`); continue; }
      seen.add(id);

      const maxCount = Number(augment.maxCount ?? (augment.repeatable ? 999 : 1));
      if (!augment.repeatable && count > 1) errors.push(`${augment.name} cannot be taken more than once.`);
      if (count > maxCount) errors.push(`${augment.name} can be taken at most ${maxCount} times.`);
      if (count > 1 && augment.minLevelForSecond && level < Number(augment.minLevelForSecond)) {
        errors.push(`${augment.name} requires Tamer level ${augment.minLevelForSecond} for its second application.`);
      }
      normalized.push({ id, count });
    }

    for (const entry of normalized) {
      const augment = registry.get(entry.id);
      if (!augment?.exclusiveGroup) continue;
      const conflict = normalized.find(other => other.id !== entry.id && registry.get(other.id)?.exclusiveGroup === augment.exclusiveGroup);
      if (conflict) errors.push(`${augment.name} cannot be combined with ${registry.get(conflict.id)?.name ?? conflict.id}.`);
    }

    const spent = this.getSplicerSpentPoints(record, normalized);
    const total = this.getSplicerTotalPoints(tamer);
    const otherSpent = this.getSplicerSharedSpentPoints(tamer, record?.id ?? null);
    const sharedSpent = otherSpent + spent;
    if (sharedSpent > total) errors.push(`Shared Splicer Points exceeded: ${sharedSpent}/${total} spent.`);

    return { valid: errors.length === 0, errors, assignments: normalized, spent, otherSpent, sharedSpent, total, available: Math.max(0, total - sharedSpent) };
  }

  static async setSplicerAssignments(tamer, record, assignments) {
    if (!tamer || !record || !this.isSplicer(tamer)) return false;
    const validation = this.validateSplicerAssignments(tamer, record, assignments);
    if (!validation.valid) {
      ui.notifications.error(validation.errors[0] ?? "The Splicer augment selection is invalid.");
      return false;
    }
    const records = this.records(tamer);
    const target = records.find(entry => entry.id === record.id);
    if (!target) return false;
    target.splicer ??= {};
    target.splicer.pendingAugments = validation.assignments;
    await this.save(tamer, records);
    return true;
  }

  static async syncSplicerAugmentItems(record, assignments) {
    if (!record?.actorUuid) return false;
    const actor = await fromUuid(record.actorUuid).catch(() => null);
    if (!actor) return false;

    const tagged = actor.items.filter(item => item.flags?.[MODULE_ID]?.splicerAugment?.recordId === record.id);
    if (tagged.length) await actor.deleteEmbeddedDocuments("Item", tagged.map(item => item.id));

    const registry = new Map(this.getSplicerAugmentRegistry().map(a => [String(a.id), a]));
    const create = [];
    for (const entry of assignments ?? []) {
      const augment = registry.get(String(entry?.id));
      const count = Math.max(0, Math.floor(Number(entry?.count ?? 0)));
      if (!augment || !count) continue;
      const source = augment.uuid ? await fromUuid(augment.uuid).catch(() => null) : null;
      if (!source || source.documentName !== "Item") continue;

      for (let n = 1; n <= count; n++) {
        const data = source.toObject();
        delete data._id;
        data.flags ??= {};
        data.flags[MODULE_ID] ??= {};
        data.flags[MODULE_ID].splicerAugment = {
          recordId: record.id,
          augmentId: String(augment.id),
          application: n
        };
        create.push(data);
      }
    }
    if (create.length) await actor.createEmbeddedDocuments("Item", create);
    await this.refreshActorSheets(actor);
    return true;
  }

  static async applyPendingSplicerChanges(tamer) {
    if (!tamer || !this.isSplicer(tamer)) return false;
    const records = this.records(tamer);
    let changed = false;

    for (const record of records) {
      const pending = Array.isArray(record?.splicer?.pendingAugments) ? record.splicer.pendingAugments : null;
      if (!pending) continue;
      await this.syncSplicerAugmentItems(record, pending);
      record.splicer.augments = foundry.utils.deepClone(pending);
      delete record.splicer.pendingAugments;
      changed = true;
    }

    if (changed) await this.save(tamer, records);
    return changed;
  }

  static async clearSplicerAugmentItems(record) {
    if (!record?.actorUuid) return;
    const actor = await fromUuid(record.actorUuid).catch(() => null);
    if (!actor) return;
    const tagged = actor.items.filter(item => item.flags?.[MODULE_ID]?.splicerAugment?.recordId === record.id);
    if (tagged.length) await actor.deleteEmbeddedDocuments("Item", tagged.map(item => item.id));
    await this.refreshActorSheets(actor);
  }

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
    const trees = this.getImprovementRegistry();
    const identifier = String(actor?.system?.identifier ?? "").trim().toLowerCase();
    const name = String(actor?.name ?? "").trim().toLowerCase();

    // Prefer the stable D&D5e Actor identifier so bespoke companions can be
    // renamed without losing their improvement tree.
    if (identifier) {
      const byIdentifier = trees.find(tree =>
        String(tree.matchIdentifier ?? "").trim().toLowerCase() === identifier
      );
      if (byIdentifier) return byIdentifier;
    }

    // Backward-compatible fallback for existing trees that only have a name.
    return name
      ? trees.find(tree =>
          String(tree.matchName ?? "").trim().toLowerCase() === name
        ) ?? null
      : null;
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
        names: structuredNames,
        freeOnTaming: structuredNames.some(name => /^(?:become(?: a)? tamer(?:['’]s)? companion|become(?: a)? tamers companion)$/i.test(String(name).trim()))
      };
    }

    // The source stores prerequisites in the first description paragraph,
    // e.g. "Prerequisite: 5th-level tamer, Growth I". Stop at the end of
    // that paragraph so the feature's actual description is never treated
    // as another prerequisite.
    const html = this.getImprovementDescriptionHTML(item);
    const htmlMatch = html.match(
      /Prerequisite\s*:\s*([\s\S]*?)(?:<\/p>|<br\s*\/?>|<\/li>|$)/i
    );

    let raw = "";
    if (htmlMatch) {
      raw = htmlMatch[1]
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      const text = this.getImprovementDescription(item);
      const match = text.match(/Prerequisite\s*:\s*([^\n.]+)/i);
      if (!match) return { text: "", level: 0, names: [] };
      raw = match[1].trim();
    }

    if (!raw) return { text: "", level: 0, names: [], freeOnTaming: false };

    const levelMatch =
      raw.match(/(\d+)\s*(?:st|nd|rd|th)?\s*-?\s*level\s+tamer/i) ??
      raw.match(/tamer\s+level\s+(\d+)/i);

    const level = levelMatch ? Number(levelMatch[1]) : 0;
    const freeOnTaming = raw.split(/,|\band\b/i).some(part => /^(?:become(?: a)? tamer(?:['’]s)? companion|become(?: a)? tamers companion)$/i.test(String(part).trim()));

    const names = raw
      .replace(/\d+\s*(?:st|nd|rd|th)?\s*-?\s*level\s+tamer/ig, "")
      .replace(/tamer\s+level\s+\d+/ig, "")
      .split(/,|\band\b/i)
      .map(x => x.trim())
      .filter(x =>
        x &&
        !/^—$/.test(x) &&
        !/^become(?: a)? tamer(?:['’]s|')? companion$/i.test(x)
      );

    return { text: raw, level, names, freeOnTaming };
  }

  static getImprovementEligibility(item, actor, level, selectedSourceUuids, optionsByName) {
    const prereq = this.parseImprovementPrerequisites(item);
    const missing = [];
    if (prereq.level && level < prereq.level) missing.push(`Tamer level ${prereq.level}`);

    for (const name of prereq.names) {
      const normalized = this.normalizeImprovementName(name);
      if (!normalized) continue;
      if (this.actorHasImprovement(actor, name)) continue;
      const sourceUuids = optionsByName.get(normalized) ?? new Set();
      if (![...sourceUuids].some(uuid => selectedSourceUuids.has(uuid))) missing.push(name);
    }

    return { eligible: missing.length === 0, prerequisite: prereq.text, missing };
  }

  static getImprovementSelectionLimit(item, actor, level) {
    const name = this.normalizeImprovementName(item?.name ?? "");
    const repeatableCore = new Set(["speed training","toughen up","ability boost","survival instincts","war training"]);
    if (name === "go for the throat") return level >= 9 ? 3 : level >= 5 ? 2 : 1;
    if (repeatableCore.has(name)) return 20;
    const description = this.getImprovementDescription(item);
    if (/can be taken multiple times|can be taken up to \d+ times|a second application/i.test(description)) return 20;
    return 1;
  }

  static getImprovementCountMap(entries = []) {
    const counts = new Map();
    for (const entry of entries) {
      if (entry?.isBonus) continue;
      const uuid = String(entry?.sourceUuid ?? "");
      if (uuid) counts.set(uuid, (counts.get(uuid) ?? 0) + 1);
    }
    return counts;
  }

  static async manageImprovements(tamer, record, actor) {
    const level = this.getTamerLevel(tamer);
    const progression = this.getProgression(record, actor, level);
    const standard = await this.getStandardImprovementItems();
    const registeredTree = record?.bespokeTreeId
      ? this.getImprovementRegistry().find(tree => String(tree.id) === String(record.bespokeTreeId))
      : null;
    const tree = registeredTree ?? await this.findBespokeTree(actor);
    const bespoke = tree ? await this.resolveTreeItems(tree) : [];
    const sources = new Map();
    for (const item of standard) sources.set(item.uuid, { item, tree: "Monster Trainer Improvements" });
    for (const item of bespoke) sources.set(item.uuid, { item, tree: tree.name });

    const bonusSelected = new Set((record?.improvements ?? []).filter(entry => entry?.isBonus).map(entry => String(entry.sourceUuid ?? "")));
    const selectedEntries = (record?.improvements ?? []).filter(entry => !entry?.isBonus);
    const selectedCounts = this.getImprovementCountMap(selectedEntries);
    const selected = new Map();
    for (const entry of selectedEntries) {
      const uuid = String(entry.sourceUuid ?? "");
      if (!selected.has(uuid)) selected.set(uuid, entry);
    }
    const options = [...sources.values()].filter(({ item }) => !bonusSelected.has(item.uuid));
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
    for (const { item } of options) {
      const key = this.normalizeImprovementName(item.name);
      if (!key) continue;
      const uuids = optionsByName.get(key) ?? new Set();
      uuids.add(item.uuid);
      optionsByName.set(key, uuids);
    }

    // Level requirements come from the improvement Item's prerequisite text,
    // while the actual Tamer level is read from the Tamer's Tamer class Item.
    // Improvements above the current level are hidden; missing named prerequisites
    // remain visible and locked so the player can see what they need.
    // Level-ineligible improvements are not rendered at all.
    // Improvements whose named prerequisites are not yet met remain in the
    // DOM only when their level is available, but are hidden until their
    // prerequisite is selected. This lets dependent improvements appear
    // immediately when their prerequisite is chosen.
    // Universal Monster Trainer and bespoke improvements share one choice list.
    const mergedEntries = [...groups.values()].flat();

    const visibleEntries = mergedEntries.filter(({ item }) => {
      const prereq = this.parseImprovementPrerequisites(item);
      return !prereq.freeOnTaming && (selected.has(item.uuid) || !prereq.level || level >= prereq.level);
    });

    const groupHtml = `
      <section class="tcm-advancement-group tcm-unified-improvement-group">
        <div class="tcm-advancement-options">
          ${visibleEntries.sort((a,b) => a.item.name.localeCompare(b.item.name)).map(({item}) => {
            const uuid = item.uuid;
            const prereq = this.parseImprovementPrerequisites(item);
            const eligibility = this.getImprovementEligibility(item, actor, level, selectedUuids, optionsByName);
            const initiallyHidden = !selected.has(uuid) && !eligibility.eligible;
            const prereqData = encodeURIComponent(JSON.stringify(prereq));
            const tooltipHtml = this.getImprovementDescriptionHTML(item);
            const requirementText = prereq.text ? `Requires: ${prereq.text}` : "";

            return `
              <label class="tcm-advancement-option${initiallyHidden ? " is-prerequisite-hidden" : ""}"
                data-tcm-tooltip="${esc(tooltipHtml)}"
                data-prerequisites="${esc(prereqData)}"
                ${initiallyHidden ? 'hidden' : ''}>
                <input type="checkbox" name="improvement" value="${esc(uuid)}"${selected.has(uuid) ? " checked" : ""}${initiallyHidden ? " disabled" : ""}>
                <span class="tcm-advancement-check"></span>
                <img class="tcm-advancement-icon" src="${esc(item.img || "icons/svg/item-bag.svg")}" alt="">
                <span class="tcm-advancement-text">
                  <strong>${esc(item.name)}</strong>
                  ${requirementText ? `<em class="tcm-improvement-prerequisite">${esc(requirementText)}</em>` : ""}
                </span>
              </label>`;
          }).join("")}
        </div>
      </section>`;


    const content = `
      <div class="tcm-advancement">
        <div class="tcm-advancement-header">
          <div>
            <h2>Choose Improvement</h2>
            <p>Choose up to <strong>${progression.target}</strong> improvement${progression.target === 1 ? "" : "s"}. Hover over an improvement for its full description.</p>
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
          const values = [];
          for (const option of button.form.querySelectorAll(".tcm-improvement-quantity")) {
            const n = Math.max(0, Number(option.dataset.count ?? 0));
            for (let i = 0; i < n; i++) values.push(option.dataset.uuid);
          }
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

        // Cursor-following tooltip for improvement descriptions.
        let tooltip = document.querySelector(".tcm-improvement-tooltip.tcm-cursor-tooltip");
        if (!tooltip) {
          tooltip = document.createElement("div");
          tooltip.className = "tcm-improvement-tooltip tcm-cursor-tooltip";
          tooltip.setAttribute("role", "tooltip");
          document.body.appendChild(tooltip);
        }

        const hideTooltip = () => {
          tooltip.style.display = "none";
          tooltip.setAttribute("aria-hidden", "true");
        };

        const moveTooltip = event => {
          if (tooltip.style.display === "none") return;
          const offset = 14;
          const rect = tooltip.getBoundingClientRect();
          let left = event.clientX + offset;
          let top = event.clientY + offset;

          if (left + rect.width > window.innerWidth - 8) {
            left = event.clientX - rect.width - offset;
          }
          if (top + rect.height > window.innerHeight - 8) {
            top = event.clientY - rect.height - offset;
          }

          tooltip.style.left = `${Math.max(8, left)}px`;
          tooltip.style.top = `${Math.max(8, top)}px`;
        };

        const showTooltip = (event, option) => {
          const html = option?.dataset?.tcmTooltip || "";
          if (!html) return;
          tooltip.innerHTML = html;
          tooltip.style.display = "block";
          tooltip.setAttribute("aria-hidden", "false");
          // Force layout before positioning so width/height are available.
          tooltip.getBoundingClientRect();
          moveTooltip(event);
        };

        // Delegate the events from the picker itself. This is more reliable
        // across Foundry's DialogV2 application/shadow-DOM rendering than
        // attaching individual pointer handlers to every row.
        root.addEventListener("mouseover", event => {
          const option = event.target.closest?.(".tcm-advancement-option");
          if (!option || !root.contains(option)) return;
          showTooltip(event, option);
        });

        root.addEventListener("mousemove", event => {
          const option = event.target.closest?.(".tcm-advancement-option");
          if (option && root.contains(option)) moveTooltip(event);
        });

        root.addEventListener("mouseout", event => {
          const option = event.target.closest?.(".tcm-advancement-option");
          if (!option || !root.contains(option)) return;
          const next = event.relatedTarget;
          if (next && option.contains(next)) return;
          hideTooltip();
        });

        root.addEventListener("mouseleave", hideTooltip);
        hideTooltip();

        const updateCount = () => {
          const options = [...root.querySelectorAll('.tcm-improvement-quantity')];
          const counts = new Map(options.map(option => [option.dataset.uuid, Math.max(0, Number(option.dataset.count ?? 0))]));
          const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
          if (count) count.textContent = total;
          for (const option of options) {
            let prereq = { level: 0, names: [] };
            try { prereq = JSON.parse(decodeURIComponent(option.dataset.prerequisites || '')); } catch {}
            const selectedNow = new Set([...counts.entries()].filter(([, n]) => n > 0).map(([uuid]) => uuid));
            const missing = [];
            if (prereq.level && level < prereq.level) missing.push(`Tamer level ${prereq.level}`);
            for (const name of prereq.names ?? []) {
              if (this.actorHasImprovement(actor, name)) continue;
              const uuids = optionsByName.get(this.normalizeImprovementName(name)) ?? new Set();
              if (![...uuids].some(uuid => selectedNow.has(uuid))) missing.push(name);
            }
            const current = Math.max(0, Number(option.dataset.count ?? 0));
            const limit = option.dataset.limit === 'repeatable' ? Math.max(1, progression.target) : 1;
            const unavailable = current === 0 && missing.length > 0;
            option.hidden = unavailable;
            option.classList.toggle('is-prerequisite-hidden', unavailable);
            option.classList.toggle('is-selected', current > 0);
            const minus = option.querySelector('[data-improvement-minus]');
            const plus = option.querySelector('[data-improvement-plus]');
            const value = option.querySelector('[data-improvement-count]');
            if (value) value.textContent = current;
            if (minus) minus.disabled = current <= 0;
            if (plus) plus.disabled = unavailable || total >= progression.target || current >= limit;
          }
        };

        root.addEventListener('click', event => {
          const plus = event.target.closest?.('[data-improvement-plus]');
          const minus = event.target.closest?.('[data-improvement-minus]');
          if (!plus && !minus) return;
          const option = event.target.closest?.('.tcm-improvement-quantity');
          if (!option) return;
          event.preventDefault();
          event.stopPropagation();
          const current = Math.max(0, Number(option.dataset.count ?? 0));
          option.dataset.count = String(Math.max(0, current + (plus ? 1 : -1)));
          updateCount();
        });

        for (const input of boxes) input.addEventListener('change', updateCount);
        updateCount();
        hideTooltip();
      }
    });

    if (!Array.isArray(result)) return false;
    const desiredCounts = new Map();
    for (const uuid of result) desiredCounts.set(uuid, (desiredCounts.get(uuid) ?? 0) + 1);
    const desired = new Set(desiredCounts.keys());
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
    const currentEntries = (record?.improvements ?? []).filter(entry => !entry?.isBonus);
    const currentCounts = this.getImprovementCountMap(currentEntries);
    const records = this.records(tamer);
    const target = records.find(r => r.id === record.id);
    if (!target) return false;
    target.improvements ??= [];

    const entriesByUuid = new Map();
    for (const entry of currentEntries) {
      const uuid = String(entry.sourceUuid ?? '');
      if (!entriesByUuid.has(uuid)) entriesByUuid.set(uuid, []);
      entriesByUuid.get(uuid).push(entry);
    }
    for (const [sourceUuid, entries] of entriesByUuid) {
      const removeCount = Math.max(0, entries.length - (desiredCounts.get(sourceUuid) ?? 0));
      for (let i = 0; i < removeCount; i++) {
        const entry = entries[entries.length - 1 - i];
        const removed = await this.deleteImprovementItem(actor, entry.itemUuid);
        if (!removed) return false;
        target.improvements = target.improvements.filter(x => String(x.itemUuid ?? '') !== String(entry.itemUuid ?? ''));
      }
    }
    for (const [sourceUuid, desiredCount] of desiredCounts) {
      const addCount = Math.max(0, desiredCount - (currentCounts.get(sourceUuid) ?? 0));
      if (!addCount) continue;
      const source = await fromUuid(sourceUuid).catch(() => null);
      if (!source || source.documentName !== 'Item') {
        ui.notifications.warn(`Could not resolve improvement ${sourceUuid}; it was not added.`);
        continue;
      }
      for (let i = 0; i < addCount; i++) {
        const data = source.toObject(); delete data._id;
        const added = await this.addImprovementItem(actor, data, source.uuid);
        if (!added) return false;
        target.improvements.push({ itemUuid: added.uuid, itemId: added.id, sourceUuid: source.uuid, name: added.name, assignedAtLevel: level });
      }
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
    if (manager) this._internalAdvancementManagers.add(manager);
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

      const hookId = Hooks.on("dnd5e.advancementManagerComplete", async completedManager => {
        if (completedManager !== manager) return;
        Hooks.off("dnd5e.advancementManagerComplete", hookId);
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
    if (manager) this._internalAdvancementManagers.add(manager);
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
    const chosen = (record?.improvements ?? []).filter(entry => !entry?.isBonus).length;
    // Monster Trainer grants one improvement whenever you gain a level beyond 1st.
    // Therefore a 1st-level Tamer has 0 choices, a 2nd-level Tamer has 1, etc.
    const target = Math.max(0, Number(level) - 1);
    const asiLevels = [4, 8, 12, 16, 19];
    const asiHitDice = asiLevels.filter(l => Number(level) >= l).length;
    const bespokeTree = record?.bespokeTreeId ?? null;
    const sharedResilienceLevels = bespokeTree ? [3, 5, 11, 17] : [];
    const sharedResilienceHitDice = sharedResilienceLevels.filter(l => Number(level) >= l).length;
    return {
      target,
      chosen,
      pending: Math.max(0, target - chosen),
      asiHitDice,
      bonusHitDice: asiHitDice,
      sharedResilienceHitDice,
      totalBonusHitDice: asiHitDice + sharedResilienceHitDice,
      bespokeTree
    };
  }

  static getCompanionHitDie(actor) {
    const denomination = Number(actor?.system?.attributes?.hd?.denomination ?? 0);
    if (denomination > 0) return denomination;
    const formula = String(actor?.system?.attributes?.hp?.formula ?? "").match(/d(4|6|8|10|12)/i);
    return formula ? Number(formula[1]) : 8;
  }

  static getCompanionHitDieFormula(actor) {
    const formula = String(actor?.system?.attributes?.hp?.formula ?? "").trim();
    const match = formula.match(/^(\d+)d(4|6|8|10|12)(?:\s*[+-]\s*\d+)?$/i) || formula.match(/^(\d+)d(4|6|8|10|12)/i);
    if (!match) return { count: 1, denomination: this.getCompanionHitDie(actor) };
    return { count: Math.max(0, Number(match[1])), denomination: Number(match[2]) };
  }

  static getTamerProficiency(tamer) {
    return Math.max(0, Number(tamer?.system?.attributes?.prof ?? 0));
  }

  static async syncCompanionNativeStats(tamer, {notify = false} = {}) {
    if (!tamer || !this.isTamer(tamer)) return false;
    const records = this.records(tamer);
    const tamerProf = this.getTamerProficiency(tamer);
    let changed = false;

    for (const record of records) {
      const actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
      if (!actor) continue;

      const effects = actor.effects.filter(effect => effect.flags?.[MODULE_ID]?.tamerProficiency);
      let effect = effects[0] ?? null;
      if (effects.length > 1) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", effects.slice(1).map(e => e.id));
        changed = true;
      }

      const change = {
        key: "system.attributes.prof",
        type: "override",
        value: String(tamerProf)
      };

      if (!effect) {
        const created = await actor.createEmbeddedDocuments("ActiveEffect", [{
          name: "Tamer Proficiency",
          img: "icons/skills/social/diplomacy-peace-alliance.webp",
          disabled: false,
          transfer: false,
          changes: [change],
          flags: {
            [MODULE_ID]: {
              tamerProficiency: true,
              tamerUuid: tamer.uuid
            }
          }
        }]);
        effect = created?.[0] ?? null;
        if (effect) changed = true;
      } else {
        const existing = effect.changes?.[0];
        const needsUpdate = effect.disabled
          || existing?.key !== change.key
          || existing?.type !== change.type
          || String(existing?.value ?? "") !== change.value
          || effect.flags?.[MODULE_ID]?.tamerUuid !== tamer.uuid;
        if (needsUpdate) {
          await effect.update({
            disabled: false,
            changes: [change],
            ["flags." + MODULE_ID + ".tamerProficiency.tamerUuid"]: tamer.uuid
          });
          changed = true;
        }
      }

      const formula = this.getCompanionHitDieFormula(actor);
      if (record.hitDiceBaseCount === undefined) {
        // Older records may already have had Tamer Hit Dice applied before
        // native synchronization existed. Recover the original companion
        // count by subtracting the recorded Tamer-applied dice.
        const previouslyApplied = this.getAppliedHitDice(record);
        record.hitDiceBaseCount = Math.max(1, formula.count - previouslyApplied);
        record.hitDiceBaseDenomination = formula.denomination;
        changed = true;
      }

      const baseCount = Math.max(0, Number(record.hitDiceBaseCount ?? formula.count));
      const denomination = Number(record.hitDiceBaseDenomination ?? formula.denomination ?? 4);
      const target = this.getProgression(record, actor, this.getTamerLevel(tamer)).totalBonusHitDice;
      const desiredCount = Math.max(1, baseCount + target);
      const con = this.getCompanionConstitutionModifier(actor);
      const conTotal = desiredCount * con;
      const conText = conTotal >= 0 ? `+ ${conTotal}` : `- ${Math.abs(conTotal)}`;
      const desiredFormula = `${desiredCount}d${denomination} ${conText}`;

      if (String(actor.system?.attributes?.hp?.formula ?? "").trim() !== desiredFormula) {
        await actor.update({"system.attributes.hp.formula": desiredFormula});
        changed = true;
      }
    }

    if (changed) {
      await this.save(tamer, records);
      await this.refreshOpenManagers(tamer);
      if (notify) ui.notifications.info("Companion proficiency and Hit Dice have been synchronized with the Tamer.");
    }
    return changed;
  }
  static getCompanionConstitutionModifier(actor) { return Number(actor?.system?.abilities?.con?.mod ?? 0); }
  static getAppliedHitDice(record) { return Math.max(0, Number(record?.hitDiceApplied ?? 0)); }

  static async promptCompanionHitDie(actor, {level, index, total, defaultAverage = false} = {}) {
    const DialogV2 = foundry.applications.api.DialogV2;
    if (!DialogV2) {
      ui.notifications.error("Foundry's DialogV2 API is unavailable; the companion Hit Die could not be applied.");
      return null;
    }

    const die = this.getCompanionHitDie(actor);
    const average = Math.floor(die / 2) + 1;
    const con = this.getCompanionConstitutionModifier(actor);
    const previousHP = Number(actor.system?.attributes?.hp?.max ?? actor.system?.attributes?.hp?.value ?? 0);
    const averageGain = Math.max(average + con, 0);
    const averageFinal = previousHP + averageGain;
    const stepText = total > 1 ? `Step ${index} of ${total}` : "Step 1 of 1";
    const initialChoice = defaultAverage ? "average" : "roll";

    const content = `
      <section class="tcm-hp-advancement">
        <header class="tcm-hp-advancement-header">
          <div class="tcm-hp-advancement-class">Tamer • Level ${level} • ${stepText}</div>
        </header>

        <div class="tcm-hp-advancement-section">
          <h2>Hit Points</h2>
          <div class="tcm-hp-advancement-rule"></div>
          <div class="tcm-hp-advancement-summary">
            <div><span>PREV.</span><strong data-tcm-hp-prev>${previousHP}</strong></div>
            <b>+</b>
            <div><span data-tcm-hp-method-label>AVG.</span><strong data-tcm-hp-gain>${averageGain}</strong></div>
            <b>=</b>
            <div><span>FINAL</span><strong data-tcm-hp-final>${averageFinal}</strong></div>
          </div>
        </div>

        <fieldset class="tcm-hp-advancement-options">
          <legend>OPTIONS</legend>

          <label class="tcm-hp-option ${initialChoice === "average" ? "is-selected" : ""}">
            <input type="radio" name="hitPointMethod" value="average" ${initialChoice === "average" ? "checked" : ""}>
            <span>Take Average</span>
            <strong>+${averageGain}</strong>
            <i class="fa-solid fa-check"></i>
          </label>

          <label class="tcm-hp-option ${initialChoice === "roll" ? "is-selected" : ""}">
            <input type="radio" name="hitPointMethod" value="roll" ${initialChoice === "roll" ? "checked" : ""}>
            <span>Roll d${die}</span>
            <strong data-tcm-roll-result>${initialChoice === "roll" ? "Roll to determine" : ""}</strong>
            <i class="fa-solid fa-dice-d20"></i>
          </label>

          <p class="tcm-hp-advancement-note">${actor.name} gains this Hit Die from Tamer training. Constitution modifier: ${con >= 0 ? "+" : ""}${con}.</p>
        </fieldset>
      </section>
    `;

    let rolledValue = null;

    const result = await DialogV2.wait({
      window: { title: "Advancement" },
      classes: ["tcm-hp-advancement-dialog"],
      position: { width: 640, height: 500 },
      content,
      modal: true,
      rejectClose: false,
      buttons: [{
        action: "next",
        label: "NEXT",
        icon: "fa-solid fa-angles-right",
        default: true,
        class: "tcm-hp-next",
        callback: async (event, button, dialog) => {
          const choice = dialog.element?.querySelector("input[name='hitPointMethod']:checked")?.value ?? "average";
          if (choice === "average") return {mode: "avg", die, raw: average};

          if (rolledValue === null) {
            const roll = await new Roll(`1d${die}`).evaluate({async: true});
            rolledValue = Number(roll.total);
          }
          return {mode: "roll", die, raw: rolledValue};
        }
      }],
      render: (_event, dialog) => {
        const root = dialog.element?.querySelector(".tcm-hp-advancement");
        if (!root) return;

        const updatePreview = async () => {
          const choice = root.querySelector("input[name='hitPointMethod']:checked")?.value ?? "average";
          const gainEl = root.querySelector("[data-tcm-hp-gain]");
          const finalEl = root.querySelector("[data-tcm-hp-final]");
          const methodEl = root.querySelector("[data-tcm-hp-method-label]");
          const rollEl = root.querySelector("[data-tcm-roll-result]");

          root.querySelectorAll(".tcm-hp-option").forEach(option => {
            option.classList.toggle("is-selected", option.querySelector("input")?.checked === true);
          });

          if (choice === "average") {
            const gain = averageGain;
            gainEl.textContent = gain;
            finalEl.textContent = averageFinal;
            methodEl.textContent = "AVG.";
            rollEl.textContent = "";
            rolledValue = null;
            return;
          }

          if (rolledValue === null) {
            const roll = await new Roll(`1d${die}`).evaluate({async: true});
            rolledValue = Number(roll.total);
          }

          const gain = Math.max(rolledValue + con, 0);
          gainEl.textContent = gain;
          finalEl.textContent = previousHP + gain;
          methodEl.textContent = "ROLL.";
          rollEl.textContent = `+${gain}`;
        };

        root.querySelectorAll("input[name='hitPointMethod']").forEach(input => {
          input.addEventListener("change", () => updatePreview());
        });

        if (initialChoice === "roll") updatePreview();
      }
    });

    if (result === null) return null;
    return result?.mode === "roll" || result?.mode === "avg" ? result : null;
  }
  static async applyCompanionHitDice(tamer, record, actor, targetCount, level) {
    const applied = this.getAppliedHitDice(record);
    const pending = Math.max(0, Number(targetCount) - applied);
    if (!pending) return true;
    const choices = [];
    let defaultAverage = false;
    for (let i = 0; i < pending; i++) {
      const choice = await this.promptCompanionHitDie(actor, {level, index: i + 1, total: pending, defaultAverage});
      if (!choice) return false;
      choices.push(choice);
      defaultAverage = choice.mode === "avg";
    }
    const con = this.getCompanionConstitutionModifier(actor);
    let hpGain = 0;
    const appliedChoices = foundry.utils.deepClone(record.hitDiceChoices ?? {});
    for (const choice of choices) {
      const gain = Math.max(choice.raw + con, 0);
      hpGain += gain;
      const nextIndex = applied + Object.keys(appliedChoices).length + 1;
      appliedChoices[String(nextIndex)] = {level: Number(level), mode: choice.mode, die: choice.die, roll: choice.raw, con, hpGain: gain};
    }
    const hp = Number(actor.system?.attributes?.hp?.value ?? 0);
    const hpMax = Number(actor.system?.attributes?.hp?.max ?? 0);
    await actor.update({"system.attributes.hp.value": hp + hpGain, "system.attributes.hp.max": hpMax + hpGain});
    record.hitDiceApplied = applied + pending;
    record.hitDiceChoices = appliedChoices;
    return true;
  }

  static async removeCompanionHitDice(tamer, record, actor, targetCount, level) {
    const applied = this.getAppliedHitDice(record);
    const target = Math.max(0, Number(targetCount));
    const removeCount = Math.max(0, applied - target);
    if (!removeCount) return true;

    const choices = foundry.utils.deepClone(record.hitDiceChoices ?? {});
    const keys = Object.keys(choices)
      .sort((a, b) => Number(b) - Number(a))
      .slice(0, removeCount);

    let hpReduction = 0;
    for (const key of keys) {
      hpReduction += Math.max(0, Number(choices[key]?.hpGain ?? 0));
      delete choices[key];
    }

    const hpMax = Number(actor.system?.attributes?.hp?.max ?? 0);
    const hpValue = Number(actor.system?.attributes?.hp?.value ?? 0);
    const newMax = Math.max(0, hpMax - hpReduction);
    const newValue = Math.min(hpValue, newMax);

    await actor.update({
      "system.attributes.hp.value": newValue,
      "system.attributes.hp.max": newMax
    });

    record.hitDiceApplied = target;
    record.hitDiceChoices = choices;

    if (hpReduction > 0 && level !== undefined) {
      ui.notifications.info(
        `${actor.name} lost ${hpReduction} maximum HP from ${removeCount} Tamer Hit Die${removeCount === 1 ? "" : "s"} after leveling down.`
      );
    }
    return true;
  }

  static _improvementSyncLocks = new Map();
  static _internalAdvancementManagers = new WeakSet();
  // When a level-down removes higher-level improvements, Foundry may fire
  // several advancement hooks for the same final level. Remember that this
  // level was reached by rollback so duplicate hooks cannot reopen the picker.
  static _improvementRollbackLocks = new Map();

  static async syncCompanionImprovements(tamer, {notify = true, allowAutomaticPrompt = false, levelDecreased = false} = {}) {
    if (!tamer || !this.isTamer(tamer)) return false;
    const lockKey = tamer.uuid ?? tamer.id;
    if (this._improvementSyncLocks.has(lockKey)) return this._improvementSyncLocks.get(lockKey);

    const operation = (async () => {
      const level = this.getTamerLevel(tamer);
      const rollbackLockLevel = this._improvementRollbackLocks.get(lockKey);
      if (rollbackLockLevel !== undefined && rollbackLockLevel !== level) {
        this._improvementRollbackLocks.delete(lockKey);
      }
      const records = this.records(tamer);
      let changed = false;

      for (const record of records) {
        const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
        if (!actor) continue;

        record.improvements ??= [];
        const progression = this.getProgression(record, actor, level);
        const selectedEntries = record.improvements.filter(entry => !entry?.isBonus);

        // Leveling down is determined by the actual Tamer level transition,
        // not by whether an improvement happens to contain assignedAtLevel.
        // This also repairs older records created before assignedAtLevel was
        // introduced by removing any excess non-bonus improvements.
        if (levelDecreased) {
          const excess = Math.max(0, selectedEntries.length - progression.target);
          if (excess > 0) {
            const entriesToRemove = [...selectedEntries]
              .map((entry, index) => ({entry, index}))
              .sort((a, b) => {
                const aLevel = Number(a.entry.assignedAtLevel ?? 0);
                const bLevel = Number(b.entry.assignedAtLevel ?? 0);
                if (aLevel !== bLevel) return bLevel - aLevel;
                return b.index - a.index;
              })
              .slice(0, excess)
              .map(({entry}) => entry);

            this._improvementRollbackLocks.set(lockKey, level);
            for (const entry of entriesToRemove) {
              const removed = await this.deleteImprovementItem(actor, entry.itemUuid);
              if (!removed) continue;
              record.improvements = record.improvements.filter(entry2 => entry2 !== entry);
              changed = true;
            }
          } else {
            this._improvementRollbackLocks.set(lockKey, level);
          }
        }

        // Automatic selection is only legal when the Tamer actually advanced
        // to a higher level. Being behind the target is not sufficient because
        // duplicate advancement hooks and level-down reconciliation can also
        // temporarily produce pending choices.
        const refreshed = this.getProgression(record, actor, level);
        const rollbackLocked = this._improvementRollbackLocks.get(lockKey) === level;
        if (allowAutomaticPrompt && !rollbackLocked && refreshed.pending > 0) {
          const managed = await this.manageImprovements(tamer, record, actor);
          if (managed) changed = true;
        }
      }

      if (changed) await this.save(tamer, records);
      if (notify && changed) {
                  await TamerCompanionManager.refreshOpenManagers(tamer);
      }
      return changed;
    })();

    this._improvementSyncLocks.set(lockKey, operation);
    try {
      return await operation;
    } finally {
      this._improvementSyncLocks.delete(lockKey);
    }
  }

  static _hitDieSyncLocks = new Map();

  static async syncCompanionHitDice(tamer, {notify = true} = {}) {
    if (!tamer || !this.isTamer(tamer)) return false;
    const lockKey = tamer.uuid ?? tamer.id;
    if (this._hitDieSyncLocks.has(lockKey)) return this._hitDieSyncLocks.get(lockKey);

    const operation = (async () => {
      const level = this.getTamerLevel(tamer), records = this.records(tamer);
    let changed = false;
    for (const record of records) {
      const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
      if (!actor) continue;
      const target = this.getProgression(record, actor, level).totalBonusHitDice;
      const before = this.getAppliedHitDice(record);

      if (target < before) {
        const removed = await this.removeCompanionHitDice(tamer, record, actor, target, level);
        if (!removed) continue;
        changed = true;
        continue;
      }

      if (target <= before) continue;

      const applied = await this.applyCompanionHitDice(tamer, record, actor, target, level);
      if (!applied) continue;
      changed = true;
      if (notify) ui.notifications.info(`${actor.name} received ${target - before} bonus Hit Die${target - before === 1 ? "" : "s"}.`);
    }
      if (changed) await this.save(tamer, records);
      return changed;
    })();

    this._hitDieSyncLocks.set(lockKey, operation);
    try {
      return await operation;
    } finally {
      this._hitDieSyncLocks.delete(lockKey);
    }
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
  static async summonedRecord(records) {
    for (const record of records) {
      if (!record?.tokenUuid) continue;
      const token = await fromUuid(record.tokenUuid).catch(() => null);
      if (token) return { record, token };
    }
    return null;
  }
  static tamerToken(tamer) {
    return canvas?.tokens?.controlled?.find(t => t.actor?.id === tamer.id) ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === tamer.id) ?? null;
  }
  static findSummonSpace(tamerToken, maxFeet = 30) {
    const grid = canvas.grid.size, origin = tamerToken.document, sceneGrid = canvas.scene?.grid;
    const pixelsPerFoot = (sceneGrid?.size ?? grid) / (sceneGrid?.distance ?? 5), maxPixels = maxFeet * pixelsPerFoot;
    const width = Math.max(1, Number(tamerToken.document.width ?? 1)), height = Math.max(1, Number(tamerToken.document.height ?? 1));
    const originCenter = { x: origin.x + (width * grid) / 2, y: origin.y + (height * grid) / 2 };
    const occupied = new Set((canvas.tokens?.placeables ?? []).map(token => `${token.document.x}:${token.document.y}`));
    const maxCells = Math.ceil(maxPixels / grid), candidates = [];
    for (let dx = -maxCells; dx <= maxCells; dx++) {
      for (let dy = -maxCells; dy <= maxCells; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = origin.x + dx * grid, y = origin.y + dy * grid;
        if (x < 0 || y < 0 || occupied.has(`${x}:${y}`)) continue;
        const center = { x: x + (width * grid) / 2, y: y + (height * grid) / 2 }, distance = Math.hypot(center.x - originCenter.x, center.y - originCenter.y);
        if (distance > maxPixels) continue;
        if (canvas.visibility?.testVisibility && !canvas.visibility.testVisibility(center)) continue;
        candidates.push({ x, y, distance });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ?? null;
  }

  static async summon(tamer, record) {
    if (!canvas?.scene) { ui.notifications.warn("A scene must be active."); return false; }
    const vessel = await this.getVessel(record, tamer);
    if (!vessel) { ui.notifications.warn("This companion has no valid vessel assigned. Assign its vessel to the companion first."); return false; }
    if (vessel.system?.equipped !== true) { ui.notifications.warn(`${vessel.name} must be equipped before this companion can be summoned.`); return false; }
    const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    if (!actor) return ui.notifications.error("The companion Actor could not be found.");
    const records = this.records(tamer);
    if (await this.summonedRecord(records)) { ui.notifications.warn("Another companion is already summoned."); return false; }
    const tamerToken = this.tamerToken(tamer); if (!tamerToken) { ui.notifications.warn("Place the Tamer's token on the current scene first."); return false; }
    const position = this.findSummonSpace(tamerToken, 30); if (!position) { ui.notifications.warn("No unoccupied space within 30 feet and line of sight was found."); return false; }
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
  _canAcceptCompanionDrop(selector) {
    if (selector === ".tcm-vessel-drop-zone") return Boolean(this.tamer && TamerCompanionManager.isTamer(this.tamer));
    if (selector === ".tcm-drop-zone") {
      if (!this.tamer || !TamerCompanionManager.isTamer(this.tamer)) return false;
      const records = TamerCompanionManager.records(this.tamer), max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
      return records.length < max;
    }
    return false;
  }
  _onDragOverManager(event) {
    const target = event.target?.closest?.(".tcm-vessel-drop-zone");
    event.dataTransfer.dropEffect = target ? "copy" : "link";
  }
  async _onDropManager(event) {
    event.preventDefault();
    if (event.target.closest(".tcm-vessel-drop-zone")) return this._onDropVessel(event);
    return this._onDropCompanion(event);
  }
  async _onDropVessel(event) {
    const zone = event.target.closest(".tcm-vessel-drop-zone"), index = Number(zone?.dataset.index);
    const record = TamerCompanionManager.records(this.tamer)[index];
    if (!record) return;
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return ui.notifications.warn("Drag an Item from the Tamer inventory to assign it as the vessel.");
    const item = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
    if (!item) return ui.notifications.error("The vessel Item could not be resolved.");
    if (item.parent?.uuid !== this.tamer.uuid) return ui.notifications.warn("The vessel must be an Item owned by the Tamer.");
    if (await TamerCompanionManager.setVessel(this.tamer, record, item)) await this.render({ force: true });
  }
  async _onDropCompanion(event) {
    event.preventDefault();
    if (!this._canAcceptCompanionDrop(".tcm-drop-zone")) return ui.notifications.warn("No Pocket Family slot is available.");
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Actor") return ui.notifications.warn("Only Actor documents can be added as companions.");
    let actor = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
    if (!actor && globalThis.Actor?.implementation?.fromDropData) actor = await Actor.implementation.fromDropData(data).catch(() => null);
    if (!actor) return ui.notifications.error("The dropped Actor could not be resolved.");
    await this._linkCompanion(actor);
  }
  async _linkCompanion(actor) {
    const records=TamerCompanionManager.records(this.tamer), max=TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
    if(records.length>=max){
      console.warn("[Tamer Companion Manager] Companion link rejected: Pocket Family is full.", { records: records.length, max, tamer: this.tamer?.uuid });
      return ui.notifications.warn("No Pocket Family slot is available.");
    }
    if(actor.id===this.tamer.id||actor.uuid===this.tamer.uuid){
      console.warn("[Tamer Companion Manager] Companion link rejected: Actor is the Tamer.", { actor: actor.uuid, tamer: this.tamer.uuid });
      return ui.notifications.warn("The Tamer cannot be linked as their own companion.");
    }
    if(!(actor.isOwner||game.user.isGM)){
      console.warn("[Tamer Companion Manager] Companion link rejected: insufficient Actor ownership.", { actor: actor.uuid, isOwner: actor.isOwner, user: game.user?.id });
      return ui.notifications.warn("You do not have permission to use that Actor as a companion.");
    }
    if(records.some(r=>r.actorUuid===actor.uuid)){
      console.warn("[Tamer Companion Manager] Companion link rejected: Actor already linked.", { actor: actor.uuid, tamer: this.tamer.uuid });
      return ui.notifications.warn(`${actor.name} is already linked to this Tamer.`);
    }

    const eligibility = TamerCompanionManager.getCompanionEligibility(actor, this.tamer);
    if (!eligibility.valid) {
      console.warn("[Tamer Companion Manager] Companion link rejected by Tamer restrictions.", {
        actor: actor.uuid,
        tamer: this.tamer.uuid,
        errors: eligibility.errors
      });
      return ui.notifications.warn(actor.name + " cannot become this Tamer's companion: " + eligibility.errors.join(" "));
    }

    const tree=await TamerCompanionManager.findBespokeTree(actor);
    const baseHitDieFormula=TamerCompanionManager.getCompanionHitDieFormula(actor);
    const record={id:foundry.utils.randomID(),actorId:actor.id,actorUuid:actor.uuid,name:actor.name,vesselUuid:null,vesselName:"",tokenUuid:null,status:"in-vessel",improvements:[],bespokeTreeId:tree?.id??null,bonusHitDice:0,hitDiceApplied:0,hitDiceChoices:{},hitDiceBaseCount:baseHitDieFormula.count,hitDiceBaseDenomination:baseHitDieFormula.denomination};

    // Bespoke improvements with "become a tamer's companion" as their
    // prerequisite are granted automatically when the creature is tamed.
    // They are recorded as bonus improvements and never consume a normal
    // Monster Trainer improvement choice.
    if(tree){
      const bespoke=await TamerCompanionManager.resolveTreeItems(tree);
      for(const source of bespoke){
        const prereq=TamerCompanionManager.parseImprovementPrerequisites(source);
        if(!prereq.freeOnTaming) continue;
        if(TamerCompanionManager.actorHasImprovement(actor,source.name)) continue;
        const data=source.toObject();
        delete data._id;
        const added=await TamerCompanionManager.addImprovementItem(actor,data,source.uuid);
        if(!added){
          // A bespoke improvement is supplemental to the bond. Never allow
          // failure to add one optional improvement to discard the companion
          // record itself.
          console.warn("[Tamer Companion Manager] Could not grant automatic bespoke improvement; continuing with bond.", { actor: actor.uuid, improvement: source.name, source: source.uuid });
          ui.notifications.warn(`${actor.name} was bonded, but the automatic improvement "${source.name}" could not be added.`);
          continue;
        }
        record.improvements.push({
          itemUuid:added.uuid,
          itemId:added.id,
          sourceUuid:source.uuid,
          name:added.name,
          assignedAtLevel:TamerCompanionManager.getTamerLevel(this.tamer),
          isBonus:true,
          bonusReason:"Become a Tamer's Companion"
        });
      }
    }

    records.push(record);
    const targetHitDice = TamerCompanionManager.getProgression(record, actor, TamerCompanionManager.getTamerLevel(this.tamer)).totalBonusHitDice;
    if (targetHitDice > 0) {
      const applied = await TamerCompanionManager.applyCompanionHitDice(this.tamer, record, actor, targetHitDice, TamerCompanionManager.getTamerLevel(this.tamer));
      if (!applied) ui.notifications.info(`${actor.name} was bonded successfully; its bonus Hit Die training remains pending.`);
    }
    await TamerCompanionManager.save(this.tamer,records);
    await TamerCompanionManager.syncCompanionNativeStats(this.tamer);
    ui.notifications.info(tree?`${actor.name} has been bonded with ${tree.name} improvements available.`:`${actor.name} has been bonded as a companion.`);
    await this.render({force:true});
    if (this._tcmRefresh) await this._tcmRefresh();
    return true;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if (this._tcmCancelInitialOpen) await this.close();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.element) return;
    this._tcmDragDrop.bind(this.element);
  }
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
  static async _onAddCompanion() {
    const records = TamerCompanionManager.records(this.tamer);
    const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
    if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available.");
    const browser = new TamerCompanionBrowser({ tamer: this.tamer, manager: this });
    await browser.render({ force: true });
  }
  static async _onOpenCompanion(event, target) { const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)], actor = await TamerCompanionManager.resolveCompanionActor(record); actor?.sheet?.render({ force: true }); }

  static async _onSummonCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    if (!record) return;
    const manager = this;
    const tamerSheet = manager.tamer?.sheet;
    const managerWasRendered = Boolean(manager.rendered);
    const sheetWasRendered = Boolean(tamerSheet?.rendered);
    const summoned = await TamerCompanionManager.summon(manager.tamer, record);
    if (!summoned) return;
    if (managerWasRendered) await manager.close();
    if (sheetWasRendered) await tamerSheet.close();
  }

  static async _onTrainCompanion(event,target) {
    const record=TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    const actor=record?.actorUuid?await fromUuid(record.actorUuid).catch(()=>null):null;
    if(!record||!actor)return;
    const progression=TamerCompanionManager.getProgression(record,actor,TamerCompanionManager.getTamerLevel(this.tamer));
    if(progression.target<=0 && progression.chosen<=0) return ui.notifications.info(`${actor.name} does not have an improvement available until Tamer level 2.`);
    if(await TamerCompanionManager.manageImprovements(this.tamer,record,actor))await this.render({force:true});
  }

  static async _onOpenSplicer(event, target) {
    if (!TamerCompanionManager.isSplicer(this.tamer)) return;
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)];
    if (!record) return;
    await new TamerSplicerAugmentManager({ tamer: this.tamer, record }).render({ force: true });
  }

  static async _onDismissCompanion(event, target) { const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)]; if (record && await TamerCompanionManager.dismiss(this.tamer, record)) await this.render({ force: true }); }
  static async _onClearVessel(event, target) { const records = TamerCompanionManager.records(this.tamer), record = records[Number(target.dataset.index)]; if (!record) return; await TamerCompanionManager.clearVessel(this.tamer, record); await this.render({ force: true }); }
  static async _onUnlinkCompanion(event, target) { const records = TamerCompanionManager.records(this.tamer), record = records[Number(target.dataset.index)]; if (!record) return; const yes = await foundry.applications.api.DialogV2.confirm({ window: { title: "Unlink Companion" }, content: `<p>Unlink <strong>${foundry.utils.escapeHTML(record.name ?? "this companion")}</strong>?</p>`, yes: { label: "Unlink" }, no: { label: "Cancel" } }); if (!yes) return; if (record.tokenUuid) { const token = await fromUuid(record.tokenUuid).catch(() => null); if (token) await token.delete(); } await TamerCompanionManager.clearSplicerAugmentItems(record); records.splice(Number(target.dataset.index), 1); await TamerCompanionManager.save(this.tamer, records); await this.render({ force: true }); }
  static async _onOpenTamer() { await this.tamer.sheet?.render({ force: true }); }
}



class TamerSplicerAugmentManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tcm-splicer-augment-manager",
    classes: ["tcm-splicer-augment-manager"],
    window: { title: "Splicer Augments", icon: "fa-solid fa-dna", resizable: true },
    position: { width: 760, height: 720 },
    actions: { increment: this._onIncrement, decrement: this._onDecrement, save: this._onSave, cancel: this._onCancel }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/splicer-augment-manager.hbs`, root: true } };

  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer ?? null;
    this.record = options.record ?? null;
    this.assignments = TamerCompanionManager.getSplicerPendingAssignments(this.record);
  }

  async _prepareContext() {
    const registry = TamerCompanionManager.getSplicerAugmentRegistry();
    const counts = new Map(this.assignments.map(a => [String(a.id), Number(a.count ?? 0)]));
    const total = TamerCompanionManager.getSplicerTotalPoints(this.tamer);
    const otherSpent = TamerCompanionManager.getSplicerSharedSpentPoints(this.tamer, this.record?.id ?? null);
    const spent = TamerCompanionManager.getSplicerSpentPoints(this.record, this.assignments);
    return {
      tamer: { name: this.tamer?.name ?? "Tamer", level: TamerCompanionManager.getTamerLevel(this.tamer) },
      companion: { name: this.record?.name ?? "Companion" },
      total, otherSpent, spent, sharedSpent: otherSpent + spent,
      available: Math.max(0, total - otherSpent - spent),
      pending: JSON.stringify(this.assignments) !== JSON.stringify(TamerCompanionManager.getSplicerAssignments(this.record)),
      augments: registry.map(a => ({
        ...a,
        count: Math.max(0, Math.floor(counts.get(String(a.id)) ?? 0)),
        maxCount: Number(a.maxCount ?? (a.repeatable ? 999 : 1))
      }))
    };
  }

  static async _onIncrement(event, target) {
    const id = String(target.dataset.id ?? "");
    const augment = TamerCompanionManager.getSplicerAugmentRegistry().find(a => String(a.id) === id);
    if (!augment) return;
    const current = Number(this.assignments.find(a => String(a.id) === id)?.count ?? 0);
    const max = Number(augment.maxCount ?? (augment.repeatable ? 999 : 1));
    if (!augment.repeatable && current >= 1) return;
    if (current >= max) return;
    if (current >= 1 && augment.minLevelForSecond && TamerCompanionManager.getTamerLevel(this.tamer) < Number(augment.minLevelForSecond)) {
      return ui.notifications.warn(`${augment.name} requires Tamer level ${augment.minLevelForSecond} for its second application.`);
    }
    const next = this.assignments.map(a => ({ ...a }));
    const entry = next.find(a => String(a.id) === id);
    if (entry) entry.count = current + 1;
    else next.push({ id, count: 1 });
    const validation = TamerCompanionManager.validateSplicerAssignments(this.tamer, this.record, next);
    if (!validation.valid) return ui.notifications.warn(validation.errors[0]);
    this.assignments = validation.assignments;
    await this.render({ force: true });
  }

  static async _onDecrement(event, target) {
    const id = String(target.dataset.id ?? "");
    const next = this.assignments.map(a => ({ ...a }));
    const entry = next.find(a => String(a.id) === id);
    if (!entry) return;
    entry.count--;
    this.assignments = next.filter(a => a.count > 0);
    await this.render({ force: true });
  }

  static async _onSave() {
    const validation = TamerCompanionManager.validateSplicerAssignments(this.tamer, this.record, this.assignments);
    if (!validation.valid) return ui.notifications.error(validation.errors[0]);
    if (!await TamerCompanionManager.setSplicerAssignments(this.tamer, this.record, validation.assignments)) return;
    ui.notifications.info("Splicer augment changes are pending until your next long rest.");
    await this.close();
    await TamerCompanionManager.refreshOpenManagers(this.tamer);
  }

  static async _onCancel() { await this.close(); }
}

class TamerCompanionBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tcm-companion-browser",
    classes: ["tcm-companion-browser"],
    window: { title: "Choose Companion", icon: "fa-solid fa-paw", resizable: true },
    position: { width: 820, height: 680 },
    actions: { selectCompanion: this._onSelectCompanion, refresh: this._onRefresh }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/companion-browser.hbs`, root: true } };

  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer ?? null;
    this.manager = options.manager ?? null;
    this.source = options.source ?? "all";
  }

  static isActorPack(pack) {
    return !!pack && (
      pack.documentName === "Actor" ||
      pack.documentClass?.documentName === "Actor" ||
      pack.metadata?.type === "Actor"
    );
  }

  static getConfiguredPacks() {
    const configured = foundry.utils.deepClone(game.settings.get(MODULE_ID, "companionSourcePacks") ?? []);
    return configured.map(collection => game.packs.get(String(collection)))
      .filter(pack => TamerCompanionBrowser.isActorPack(pack))
      .filter(pack => game.user.isGM || pack.visible)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async _prepareContext() {
    const packs = TamerCompanionBrowser.getConfiguredPacks();
    if (!packs.length) return { packs: [], selectedSource: "all", entries: [], eligibleCount: 0, totalCount: 0, limits: null };
    if (this.source !== "all" && !packs.some(pack => pack.collection === this.source)) this.source = "all";
    const selectedPacks = this.source === "all" ? packs : packs.filter(pack => pack.collection === this.source);
    const entries = [];
    let totalCount = 0;
    for (const pack of selectedPacks) {
      try {
        const index = await pack.getIndex({ fields: ["name","img","type","system.details.cr","system.details.type","system.traits.size"] });
        for (const entry of index.values()) {
          totalCount++;
          const actorLike = {
            system: {
              details: { cr: entry.system?.details?.cr, type: entry.system?.details?.type },
              traits: { size: entry.system?.traits?.size }
            }
          };
          const eligibility = TamerCompanionManager.getCompanionEligibility(actorLike, this.tamer);
          entries.push({
            id: entry._id,
            name: entry.name ?? "Unnamed Actor",
            img: entry.img ?? "icons/svg/mystery-man.svg",
            type: eligibility.creatureType || entry.type || "Creature",
            cr: eligibility.cr,
            size: eligibility.size,
            eligible: eligibility.valid,
            restrictionReason: eligibility.errors.join(" "),
            source: pack.collection,
            sourceTitle: pack.title,
            search: String(entry.name ?? "") + " " + String(pack.title ?? "") + " " + String(eligibility.creatureType ?? "")
          });
        }
      } catch (error) {
        console.warn("[Tamer Companion Manager] Could not index companion compendium.", pack.collection, error);
      }
    }
    entries.sort((a,b) => Number(b.eligible) - Number(a.eligible) || a.name.localeCompare(b.name) || a.sourceTitle.localeCompare(b.sourceTitle));
    const level = TamerCompanionManager.getTamerLevel(this.tamer);
    return {
      selectedAll: this.source === "all",
      packs: packs.map(pack => ({ collection: pack.collection, title: pack.title, selected: this.source === pack.collection })),
      selectedSource: this.source,
      entries,
      eligibleCount: entries.filter(entry => entry.eligible).length,
      totalCount,
      limits: { cr: TamerCompanionManager.getMaxCompanionCR(level), size: TamerCompanionManager.getMaxCompanionSize(level) }
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.element) return;
    const search = this.element.querySelector("[name='tcm-companion-search']");
    const source = this.element.querySelector("[name='tcm-companion-source']");
    const list = this.element.querySelector(".tcm-companion-browser-list");
    const empty = this.element.querySelector(".tcm-companion-browser-empty");
    const count = this.element.querySelector(".tcm-companion-browser-count");

    const filter = () => {
      const query = String(search?.value ?? "").trim().toLowerCase();
      let shown = 0;
      for (const row of list?.querySelectorAll(".tcm-companion-browser-entry") ?? []) {
        const matches = !query || String(row.dataset.search ?? "").toLowerCase().includes(query);
        row.hidden = !matches;
        if (matches) shown++;
      }
      if (count) count.textContent = `${shown} companion${shown === 1 ? "" : "s"}`;
      if (empty) empty.hidden = shown !== 0;
    };

    search?.addEventListener("input", filter);
    source?.addEventListener("change", async event => {
      this.source = event.currentTarget.value;
      await this.render({ force: true });
    });
    filter();
  }

  static async _onRefresh() { await this.render({ force: true }); }

  static async _onSelectCompanion(event, target) {
    const packCollection = target.dataset.pack;
    const documentId = target.dataset.id;
    const pack = game.packs.get(packCollection);
    if (!TamerCompanionBrowser.isActorPack(pack)) return ui.notifications.error("That companion source is no longer available.");
    if (!game.user.isGM && !pack.visible) return ui.notifications.warn("You do not have permission to access that compendium.");
    if (!game.user.isGM && !game.user.can("ACTOR_CREATE")) return ui.notifications.error("You do not have permission to create World Actors. The companion cannot be imported.");

    try {
      const source = await pack.getDocument(documentId);
      if (!source || source.documentName !== "Actor") return ui.notifications.error("The selected compendium entry is not an Actor.");
      const eligibility = TamerCompanionManager.getCompanionEligibility(source, this.tamer);
      if (!eligibility.valid) return ui.notifications.warn(source.name + " cannot become this Tamer's companion: " + eligibility.errors.join(" "));
      const records = TamerCompanionManager.records(this.tamer);
      const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
      if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available.");
      if (records.some(record => record.actorUuid === source.uuid)) return ui.notifications.warn(source.name + " is already linked to this Tamer.");
      const imported = await game.actors.importDocument(source, { keepId: false });
      if (!imported?.id) return ui.notifications.error("The companion could not be imported into the World.");

      const actor = game.actors.get(imported.id)
        ?? await fromUuid(imported.uuid).catch(() => null);
      if (!actor || actor.documentName !== "Actor") {
        return ui.notifications.error("The imported companion Actor could not be resolved in the World.");
      }

      await this.close();
      const linked = await this.manager?._linkCompanion(actor);
      if (linked === false) return ui.notifications.error("The creature was imported, but could not be bonded to this Tamer.");
      if (this.manager?._tcmRefresh) await this.manager._tcmRefresh();
    } catch (error) {
      console.error("[Tamer Companion Manager] Failed to import companion.", { error, pack: pack.collection, documentId });
      return ui.notifications.error("The companion could not be imported. See the browser console for details.");
    }
  }
}

class TamerCompanionSourceRegistry extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tcm-companion-sources",
    classes: ["tcm-companion-sources"],
    window: { title: "Companion Sources", icon: "fa-solid fa-database", resizable: true },
    position: { width: 720, height: 640 },
    actions: { save: this._onSave, cancel: this._onCancel }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/companion-sources.hbs`, root: true } };

  async _prepareContext() {
    const selected = new Set(foundry.utils.deepClone(game.settings.get(MODULE_ID, "companionSourcePacks") ?? []).map(String));
    const packs = [...game.packs.values()]
      .filter(pack => TamerCompanionBrowser.isActorPack(pack))
      .sort((a,b) => a.title.localeCompare(b.title))
      .map(pack => ({
        collection: pack.collection,
        title: pack.title,
        packageName: pack.metadata?.packageName ?? pack.metadata?.package ?? "",
        selected: selected.has(pack.collection),
        visible: pack.visible
      }));
    return { packs, selectedCount: packs.filter(pack => pack.selected).length };
  }

  static async _onSave(event, target) {
    const inputs = [...document.querySelectorAll(
      "#tcm-companion-sources input[name='companionSourcePack'], .tcm-source-registry input[name='companionSourcePack']"
    )];
    const selected = inputs
      .filter(input => input.checked)
      .map(input => String(input.value))
      .filter(collection => game.packs.has(collection));

    if (!inputs.length) {
      return ui.notifications.error("Could not find the Companion Sources selections. Please reopen the window and try again.");
    }

    await game.settings.set(MODULE_ID, "companionSourcePacks", selected);

    const stored = foundry.utils.deepClone(
      game.settings.get(MODULE_ID, "companionSourcePacks") ?? []
    ).map(String);

    if (stored.length !== selected.length || selected.some(collection => !stored.includes(collection))) {
      console.error("[Tamer Companion Manager] Companion source setting did not persist.", { selected, stored });
      return ui.notifications.error("The companion sources could not be saved. See the browser console for details.");
    }

    ui.notifications.info(`Companion sources updated. ${stored.length} Actor compendium${stored.length === 1 ? "" : "s"} enabled.`);
    await this.close();
  }

  static async _onCancel() { await this.close(); }
}


class TamerSplicerAugmentRegistry extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tcm-splicer-augments",
    classes: ["tcm-splicer-augments"],
    window: { title: "Splicer Augments", icon: "fa-solid fa-dna", resizable: true },
    position: { width: 900, height: 720 },
    actions: {
      save: this._onSave,
      cancel: this._onCancel,
      remove: this._onRemove,
      clearLink: this._onClearLink
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/splicer-augment-registry.hbs`,
      root: true
    }
  };

  async _prepareContext() {
    return {
      augments: TamerCompanionManager.getSplicerAugmentRegistry()
    };
  }

  static _extractItemUuid(data) {
    if (!data) return "";
    const direct = data.uuid ?? data.documentUuid ?? data.uuidString;
    if (typeof direct === "string" && direct.startsWith("Item.")) return direct;
    const nested = data.data?.uuid ?? data.document?.uuid;
    if (typeof nested === "string" && nested.startsWith("Item.")) return nested;
    return "";
  }

  static async _resolveItem(uuid) {
    if (!uuid) return null;
    try {
      return await fromUuid(uuid);
    } catch (error) {
      console.warn("[Tamer Companion Manager] Could not resolve Splicer augment Item UUID.", uuid, error);
      return null;
    }
  }

  static async _onDrop(event) {
    event.preventDefault();
    const uuid = this._extractItemUuid(foundry.applications.ux.TextEditor.getDragEventData?.(event));
    if (!uuid) return ui.notifications.warn("Drop an existing Foundry Item/Feature.");
    const item = await this._resolveItem(uuid);
    if (!item || item.type === "class") return ui.notifications.warn("That drop does not reference a usable Item Feature.");
    const row = event.target.closest(".tcm-splicer-registry-row");
    if (!row) return;
    row.dataset.uuid = item.uuid;
    const uuidInput = row.querySelector("[name='uuid']");
    const nameInput = row.querySelector("[name='name']");
    if (uuidInput) uuidInput.value = item.uuid;
    if (nameInput) nameInput.value = item.name;
    const icon = row.querySelector("[data-role='icon']");
    if (icon) icon.src = item.img;
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element;
    if (!root) return;
    root.ondragover = event => {
      if (event.target.closest(".tcm-splicer-registry-row")) event.preventDefault();
    };
    root.ondrop = event => TamerSplicerAugmentRegistry._onDrop(event);
  }

  static async _onSave() {
    const rows = [...document.querySelectorAll("#tcm-splicer-augment-registry .tcm-splicer-registry-row")];
    const augments = [];
    for (const row of rows) {
      const uuid = String(row.querySelector("[name='uuid']")?.value ?? row.dataset.uuid ?? "").trim();
      const item = uuid ? await this._resolveItem(uuid) : null;
      if (!item) {
        if (uuid) ui.notifications.warn(`Could not resolve Splicer augment Item UUID: ${uuid}`);
        continue;
      }
      augments.push({
        id: String(row.dataset.id ?? foundry.utils.randomID()),
        uuid: item.uuid,
        name: item.name,
        description: item.system?.description?.value ?? item.description ?? "",
        img: item.img,
        cost: Math.max(0, Math.floor(Number(row.querySelector("[name='cost']")?.value ?? 0))),
        repeatable: Boolean(row.querySelector("[name='repeatable']")?.checked),
        maxCount: Math.max(1, Math.floor(Number(row.querySelector("[name='maxCount']")?.value ?? 1))),
        minLevelForSecond: Math.max(0, Math.floor(Number(row.querySelector("[name='minLevelForSecond']")?.value ?? 0))) || null,
        exclusiveGroup: String(row.querySelector("[name='exclusiveGroup']")?.value ?? "").trim() || null,
        growth: Boolean(row.querySelector("[name='growth']")?.checked)
      });
    }
    await game.settings.set(MODULE_ID, "splicerAugments", augments);
    ui.notifications.info(`Splicer augment registry saved. ${augments.length} linked augment${augments.length === 1 ? "" : "s"} configured.`);
    await this.close();
  }

  static async _onRemove(event, target) {
    target?.closest(".tcm-splicer-registry-row")?.remove();
  }

  static async _onClearLink(event, target) {
    const row = target?.closest(".tcm-splicer-registry-row");
    if (!row) return;
    row.dataset.uuid = "";
    const uuidInput = row.querySelector("[name='uuid']");
    if (uuidInput) uuidInput.value = "";
    const icon = row.querySelector("[data-role='icon']");
    if (icon) icon.src = "icons/svg/item-bag.svg";
  }

  static async _onCancel() { await this.close(); }
}

class TamerCompanionImprovementRegistry extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={id:"tamer-bespoke-improvements",window:{title:"Bespoke Companion Improvements",icon:"fa-solid fa-tree"},position:{width:720,height:620},actions:{addTree:this._onAddTree,saveTree:this._onSaveTree,editTree:this._onEditTree,removeTree:this._onRemoveTree,cancelEdit:this._onCancelEdit,removeStandardSource:this._onRemoveStandardSource,removeTreeSource:this._onRemoveTreeSource}};
  static PARTS={main:{template:`modules/${MODULE_ID}/templates/improvement-registry.hbs`,root:true}};
  constructor(options={}){super(options);this.editing=null;}
  async _prepareContext(){return{trees:TamerCompanionManager.getImprovementRegistry(),standardSources:TamerCompanionManager.getStandardImprovementSources(),editing:this.editing};}
  static async _onAddTree(){this.editing={id:foundry.utils.randomID(),name:"",matchName:"",matchIdentifier:"",sources:[]};await this.render({force:true});}
  static async _onEditTree(event,target){this.editing=TamerCompanionManager.getImprovementRegistry().find(t=>t.id===target.dataset.id)??null;if(this.editing)await this.render({force:true});}
  static async _onCancelEdit(){this.editing=null;await this.render({force:true});}
  static async _onSaveTree(event,target){
    if(!this.editing)return;
    const form=target.closest("form"),
      name=String(form?.elements?.name?.value??"").trim(),
      matchName=String(form?.elements?.matchName?.value??"").trim(),
      matchIdentifier=String(form?.elements?.matchIdentifier?.value??"").trim();
    if(!name)return ui.notifications.warn("Enter a tree name.");
    if(!matchIdentifier && !matchName)return ui.notifications.warn("Enter either an Actor Identifier or an exact companion name.");
    const trees=TamerCompanionManager.getImprovementRegistry(),
      tree={...this.editing,name,matchName,matchIdentifier,updatedAt:Date.now()};
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
  game.settings.register(MODULE_ID, "companionSourcePacks", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(MODULE_ID, "splicerAugments", { scope: "world", config: false, type: Array, default: foundry.utils.deepClone(DEFAULT_SPLICER_AUGMENTS) });
  game.settings.registerMenu(MODULE_ID, "openImprovementRegistry", { name: "Bespoke Companion Improvements", label: "Register Improvements", hint: "Register additional improvement trees for bespoke companions.", icon: "fa-solid fa-tree", type: TamerCompanionImprovementRegistry, restricted: true });
  game.settings.registerMenu(MODULE_ID, "openCompanionSources", { name: "Companion Sources", label: "Configure Companion Sources", hint: "Choose which Actor compendiums the Add Companion browser can use.", icon: "fa-solid fa-database", type: TamerCompanionSourceRegistry, restricted: true });
  game.settings.registerMenu(MODULE_ID, "openSplicerAugments", { name: "Splicer Augments", label: "Configure Splicer Augments", hint: "Configure the Splicer augment registry, including costs and repeatability.", icon: "fa-solid fa-dna", type: TamerSplicerAugmentRegistry, restricted: true });
  game.settings.registerMenu(MODULE_ID, "openManager", { name: "Tamer Companion Manager", label: "Open Companion Manager", hint: "Open the Tamer Companion Manager using the first Tamer Actor you own.", icon: "fa-solid fa-paw", type: TamerCompanionManager, restricted: false });
  game.tamerCompanionManager = { open: actor => TamerCompanionManager.open(actor), isTamer: actor => TamerCompanionManager.isTamer(actor), getTamerLevel: actor => TamerCompanionManager.getTamerLevel(actor), getPocketFamilySlots: level => TamerCompanionManager.getPocketFamilySlots(level) };
  TamerCompanionManager._pendingLevelTransitions = new Map();

  const captureLevelTransition = (actor, oldLevel, newLevel) => {
    if (!actor || !TamerCompanionManager.isTamer(actor)) return;
    const before = Number(oldLevel);
    const after = Number(newLevel);
    if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) return;
    TamerCompanionManager._pendingLevelTransitions.set(actor.uuid ?? actor.id, {
      before,
      after,
      direction: after > before ? "up" : "down"
    });
  };

  const syncTamerCompanionAdvancement = async actor => {
    if (!actor || !TamerCompanionManager.isTamer(actor)) return;
    if (!(actor.isOwner || game.user.isGM)) return;
    try {
      const transitionKey = actor.uuid ?? actor.id;
      const transition = TamerCompanionManager._pendingLevelTransitions.get(transitionKey);
      const levelIncreased = transition?.direction === "up";
      const levelDecreased = transition?.direction === "down";

      // Resolve companion Hit Dice first so the HP choice is completed
      // before the improvement picker is presented on a level-up.
      await TamerCompanionManager.syncCompanionHitDice(actor);
      await TamerCompanionManager.syncCompanionNativeStats(actor);
      await TamerCompanionManager.syncCompanionImprovements(actor, {
        allowAutomaticPrompt: levelIncreased,
        levelDecreased
      });

      // Consume the captured transition after synchronization. Later duplicate
      // advancement-complete hooks have no level transition to trigger a picker.
      TamerCompanionManager._pendingLevelTransitions.delete(transitionKey);

              await TamerCompanionManager.refreshOpenManagers(actor);
    } catch (error) {
      console.error("[Tamer Companion Manager] Companion advancement synchronization failed.", error);
      ui.notifications.error("Companion advancement could not be synchronized. See the console for details.");
    }
  };

  const syncTamerCompanionHitDice = async actor => {
    if (!actor || !TamerCompanionManager.isTamer(actor)) return;
    if (!(actor.isOwner || game.user.isGM)) return;
    try {
      if (await TamerCompanionManager.syncCompanionHitDice(actor)) {
                  await TamerCompanionManager.refreshOpenManagers(actor);
      }
    } catch (error) {
      console.error("[Tamer Companion Manager] Companion Hit Die synchronization failed.", error);
      ui.notifications.error("Companion Hit Dice could not be synchronized. See the browser console for details.");
    }
  };

  // Capture the level transition before Foundry mutates the Actor. This is
  // authoritative for distinguishing level-up from level-down.
  Hooks.on("preUpdateActor", (actor, changes) => {
    if (!TamerCompanionManager.isTamer(actor)) return;
    const current = TamerCompanionManager.getTamerLevel(actor);
    const next = changes?.system?.details?.level;
    if (next !== undefined) captureLevelTransition(actor, current, next);
  });

  // Some D&D 5e advancement flows update the Tamer class Item's level instead
  // of the Actor's aggregate level first.
  Hooks.on("preUpdateItem", (item, changes) => {
    if (item?.type !== "class") return;
    const actor = item.parent;
    if (!actor || !TamerCompanionManager.isTamer(actor)) return;
    const current = Number(item.system?.levels ?? item.system?.level ?? 0);
    const next = changes?.system?.levels ?? changes?.system?.level;
    if (next !== undefined) captureLevelTransition(actor, current, next);
  });

  // Primary trigger: the Actor's overall level changes during the D&D 5e advancement.
  Hooks.on("updateActor", async (actor, changes) => {
    if (!TamerCompanionManager.isTamer(actor)) return;
    if (!(actor.isOwner || game.user.isGM)) return;

    // Avoid synchronizing every companion on every Tamer Actor update.
    // Only changes that can affect companion proficiency/HP or advancement
    // need the synchronization pass.
    const systemChanges = changes?.system ?? {};
    const detailsChanges = systemChanges?.details ?? {};
    const abilitiesChanged = Boolean(systemChanges?.abilities);
    const levelChanged = Object.hasOwn(detailsChanges, "level");
    const profRelevant =
      levelChanged ||
      Boolean(systemChanges?.attributes?.prof) ||
      Boolean(systemChanges?.details?.level) ||
      Boolean(systemChanges?.classes);

    if (!profRelevant && !abilitiesChanged) return;
    if (levelChanged) {
      await syncTamerCompanionAdvancement(actor);
      return;
    }
    await TamerCompanionManager.syncCompanionNativeStats(actor);
  });

  // Secondary trigger: some class advancement flows update the class Item directly.
  Hooks.on("updateItem", async (item, changes) => {
    if (item?.type !== "class") return;
    const actor = item.parent;
    if (!actor || !TamerCompanionManager.isTamer(actor)) return;
    if (!Object.hasOwn(changes?.system ?? {}, "levels")) return;
    await syncTamerCompanionAdvancement(actor);
  });

  // Final fallback: the complete advancement flow has finished.
  Hooks.on("dnd5e.advancementManagerComplete", async manager => {
    if (manager && TamerCompanionManager._internalAdvancementManagers.has(manager)) return;
    await syncTamerCompanionAdvancement(manager?.actor);
  });
  // If a vessel Item is deleted outside the manager, remove only the dead
  // vessel association. The companion Actor and Pocket Family record remain intact.
  Hooks.on("deleteItem", async item => {
    if (!item?.uuid || item.type === "class") return;

    // Only a Tamer owning the deleted Item can reference it as a vessel.
    // Avoid scanning every Actor in the world for every unrelated Item
    // deletion. The common case is an Item on an Actor, so inspect that
    // parent first; world-level deletion has no valid vessel association.
    const tamer = item.parent?.documentName === "Actor" ? item.parent : null;
    if (!tamer || !TamerCompanionManager.isTamer(tamer)) return;
    if (!(tamer.isOwner || game.user.isGM)) return;

    const records = TamerCompanionManager.records(tamer);
    let changed = false;
    for (const record of records) {
      if (record?.vesselUuid !== item.uuid) continue;
      record.vesselUuid = null;
      record.vesselName = "";
      changed = true;
    }
    if (changed) {
      await TamerCompanionManager.save(tamer, records);
      await TamerCompanionManager.refreshOpenManagers(tamer);
    }
  });

  Hooks.on("dnd5e.restCompleted", async (actor, result, config) => {
    if (!TamerCompanionManager.isTamer(actor)) return;
    if (!(actor.isOwner || game.user.isGM)) return;
    try {
      if (config?.type === "long" && TamerCompanionManager.isSplicer(actor)) {
        if (await TamerCompanionManager.applyPendingSplicerChanges(actor)) {
          await TamerCompanionManager.refreshOpenManagers(actor);
          ui.notifications.info("Splicer augment changes are now active.");
        }
      }
      if (config?.type === "short") {
        if (await TamerCompanionManager.openSoulBond(actor)) {
          await TamerCompanionManager.refreshOpenManagers(actor);
        }
      }
    } catch (error) {
      console.error("[Tamer Companion Manager] Tamer rest handling failed.", error);
      ui.notifications.error("Tamer rest handling could not be completed. See the browser console for details.");
    }
  });
});

export {
  TamerCompanionManager,
  TamerCompanionImprovementRegistry,
  TamerSplicerAugmentRegistry,
  TamerSplicerAugmentManager
};
