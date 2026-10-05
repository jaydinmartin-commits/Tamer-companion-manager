const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companions";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TamerCompanionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer ?? null;
    this._tcmDragDrop = new foundry.applications.ux.DragDrop({ dragSelector: null, dropSelector: ".tcm-drop-zone", permissions: { drop: selector => this._canAcceptCompanionDrop(selector) }, callbacks: { drop: event => this._onDropManager(event), dragover: event => this._onDragOverManager(event) } });
    this._onNativeVesselDrop = this._onNativeVesselDrop.bind(this);
    this._onNativeVesselDragOver = this._onNativeVesselDragOver.bind(this);
  }

  static DEFAULT_OPTIONS = { id: "tamer-companion-manager", classes: ["tamer-companion-manager"], window: { title: "Tamer Companions", icon: "fa-solid fa-paw", resizable: true }, position: { width: 760, height: 650 }, actions: { refresh: this._onRefresh, addCompanion: this._onAddCompanion, openCompanion: this._onOpenCompanion, summonCompanion: this._onSummonCompanion, dismissCompanion: this._onDismissCompanion, unlinkCompanion: this._onUnlinkCompanion, openTamer: this._onOpenTamer, trainCompanion: this._onTrainCompanion, clearVessel: this._onClearVessel } };
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
    const companions = await Promise.all(records.map(async (record, index) => { const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null; const token = record.tokenUuid ? await fromUuid(record.tokenUuid).catch(() => null) : null; const currentActor = token?.actor ?? actor; const progression = actor ? TamerCompanionManager.getProgression(record, actor, level) : { target: 0, chosen: 0, pending: 0, bonusHitDice: 0, asiHitDice: 0 }; const vessel = await TamerCompanionManager.getVessel(record, this.tamer); return { index, slot: index + 1, name: currentActor?.name ?? actor?.name ?? record.name ?? "Unlinked Companion", img: currentActor?.img ?? actor?.img ?? "icons/svg/mystery-man.svg", type: currentActor?.system?.details?.type?.value ?? currentActor?.system?.details?.type ?? "Creature", hp: currentActor?.system?.attributes?.hp?.value ?? 0, hpMax: currentActor?.system?.attributes?.hp?.max ?? 0, ac: currentActor?.system?.attributes?.ac?.value ?? 0, vessel: vessel?.name ?? record.vesselName ?? "No vessel assigned", vesselImg: vessel?.img ?? "icons/svg/item-bag.svg", vesselEquipped: Boolean(vessel?.system?.equipped), linked: Boolean(actor), summoned: Boolean(token), progression }; }));
    const soulBondFeature = TamerCompanionManager.getSoulBondFeature(this.tamer);
    const soulBond = soulBondFeature ? { current: Number(soulBondFeature.system?.uses?.value ?? 0), max: Number(soulBondFeature.system?.uses?.max ?? 0) } : { current: 0, max: 0 };
    return { tamer: { name: this.tamer.name, img: this.tamer.img, level }, pocketFamily: { slots, occupied: companions.length, empty: Array.from({ length: Math.max(0, slots - companions.length) }, (_, i) => i) }, limits: { size: TamerCompanionManager.getMaxCompanionSize(level), cr: TamerCompanionManager.getMaxCompanionCR(level) }, soulBond, companions };
  }

  static records(actor) { return foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG_KEY) ?? []); }
  static async getVessel(record, tamer) {
    if (!record?.vesselUuid || !tamer) return null;
    const vessel = await fromUuid(record.vesselUuid).catch(() => null);
    if (!vessel || vessel.documentName !== "Item" || vessel.parent?.uuid !== tamer.uuid) return null;
    return vessel;
  }
  static async setVessel(tamer, record, item) {
    if (!tamer || !record || !item || item.documentName !== "Item") return false;
    if (item.parent?.uuid !== tamer.uuid) { ui.notifications.warn("A companion vessel must be an Item on the Tamer."); return false; }
    const records = this.records(tamer), target = records.find(r => r.id === record.id);
    if (!target) return false;
    if (records.some(r => r.id !== target.id && r.vesselUuid === item.uuid)) { ui.notifications.warn("That vessel is already assigned to another companion."); return false; }
    target.vesselUuid = item.uuid; target.vesselName = item.name;
    await this.save(tamer, records);
    ui.notifications.info(`${item.name} is now the vessel for ${target.name ?? "this companion"}.`);
    return true;
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
    const selected = new Map((record?.improvements ?? []).filter(entry => !entry?.isBonus).map(entry => [String(entry.sourceUuid ?? ""), entry]));
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
          const selectedNow = new Set(boxes.filter(input => input.checked).map(input => input.value));
          const n = selectedNow.size;
          if (count) count.textContent = n;

          for (const input of boxes) {
            let prereq = { level: 0, names: [] };
            try { prereq = JSON.parse(decodeURIComponent(input.closest(".tcm-advancement-option")?.dataset.prerequisites || "")); } catch {}

            const missing = [];
            if (prereq.level && level < prereq.level) missing.push(`Tamer level ${prereq.level}`);
            for (const name of prereq.names ?? []) {
              if (this.actorHasImprovement(actor, name)) continue;
              const uuids = optionsByName.get(this.normalizeImprovementName(name)) ?? new Set();
              if (![...uuids].some(uuid => selectedNow.has(uuid))) missing.push(name);
            }

            const option = input.closest(".tcm-advancement-option");
            const selected = input.checked;
            const unavailable = !selected && missing.length > 0;

            option.hidden = unavailable;
            option.classList.toggle("is-prerequisite-hidden", unavailable);
            input.disabled = unavailable || (!selected && n >= progression.target);
          }
        };

        for (const input of boxes) input.addEventListener("change", updateCount);
        updateCount();
        hideTooltip();
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
    const current = new Map((record?.improvements ?? []).filter(entry => !entry?.isBonus).map(entry => [String(entry.sourceUuid ?? ""), entry]));
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
    const formula = String(actor?.system?.attributes?.hd?.formula ?? "").match(/d(4|6|8|10|12)/i);
    return formula ? Number(formula[1]) : 8;
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
        for (const app of Object.values(ui.windows ?? {})) {
          if (app instanceof TamerCompanionManager && app.tamer?.id === tamer.id) {
            await app.render({ force: true });
          }
        }
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
  static async summonedRecord(records) { for (const record of records) { if (!record.tokenUuid) continue; const token = await fromUuid(record.tokenUuid).catch(() => null); if (token) return { record, token }; } return null; }
  static tamerToken(tamer) { return canvas?.tokens?.controlled?.find(t => t.actor?.id === tamer.id) ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === tamer.id) ?? null; }
  static findAdjacentSpace(tamerToken) { const grid = canvas.grid.size, x = tamerToken.document.x, y = tamerToken.document.y, candidates = [{ x: x + grid, y }, { x: x - grid, y }, { x, y: y + grid }, { x, y: y - grid }]; for (const p of candidates) { const occupied = canvas.tokens.placeables.some(t => t.document.x === p.x && t.document.y === p.y); if (!occupied && p.x >= 0 && p.y >= 0) return p; } return null; }

  static async summon(tamer, record) {
    if (!canvas?.scene) return ui.notifications.warn("A scene must be active.");
    const vessel = await this.getVessel(record, tamer);
    if (!vessel) return ui.notifications.warn("This companion has no valid vessel assigned. Assign its vessel to the companion first.");
    if (vessel.system?.equipped !== true) return ui.notifications.warn(`${vessel.name} must be equipped before this companion can be summoned.`);
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
  _onNativeVesselDragOver(event) {
    const zone = event.target?.closest?.(".tcm-vessel-drop-zone");
    if (!zone) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }
  async _onNativeVesselDrop(event) {
    const zone = event.target?.closest?.(".tcm-vessel-drop-zone");
    if (!zone) return;
    event.preventDefault();
    event.stopPropagation();
    await this._onDropVessel(event);
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
    if (!this._canAcceptCompanionDrop(event)) return ui.notifications.warn("No Pocket Family slot is available.");
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Actor") return ui.notifications.warn("Only Actor documents can be added as companions.");
    let actor = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
    if (!actor && globalThis.Actor?.implementation?.fromDropData) actor = await Actor.implementation.fromDropData(data).catch(() => null);
    if (!actor) return ui.notifications.error("The dropped Actor could not be resolved.");
    await this._linkCompanion(actor);
  }
  async _linkCompanion(actor) {
    const records=TamerCompanionManager.records(this.tamer), max=TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer));
    if(records.length>=max)return ui.notifications.warn("No Pocket Family slot is available.");
    if(actor.id===this.tamer.id||actor.uuid===this.tamer.uuid)return ui.notifications.warn("The Tamer cannot be linked as their own companion.");
    if(!(actor.isOwner||game.user.isGM))return ui.notifications.warn("You do not have permission to use that Actor as a companion.");
    if(records.some(r=>r.actorUuid===actor.uuid))return ui.notifications.warn(`${actor.name} is already linked to this Tamer.`);

    const tree=await TamerCompanionManager.findBespokeTree(actor);
    const record={id:foundry.utils.randomID(),actorUuid:actor.uuid,name:actor.name,vesselUuid:null,vesselName:"",tokenUuid:null,status:"in-vessel",improvements:[],bespokeTreeId:tree?.id??null,bonusHitDice:0,hitDiceApplied:0,hitDiceChoices:{}};

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
          ui.notifications.error(`Could not grant automatic improvement "${source.name}" to ${actor.name}.`);
          return false;
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
    ui.notifications.info(tree?`${actor.name} has been bonded with ${tree.name} improvements available.`:`${actor.name} has been bonded as a companion.`);
    await this.render({force:true}); return true;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if (this._tcmCancelInitialOpen) await this.close();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.element) return;
    this._tcmDragDrop.bind(this.element);
    this.element.addEventListener("dragover", this._onNativeVesselDragOver);
    this.element.addEventListener("drop", this._onNativeVesselDrop);
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
  static async _onClearVessel(event, target) { const records = TamerCompanionManager.records(this.tamer), record = records[Number(target.dataset.index)]; if (!record) return; await TamerCompanionManager.clearVessel(this.tamer, record); await this.render({ force: true }); }
  static async _onUnlinkCompanion(event, target) { const records = TamerCompanionManager.records(this.tamer), record = records[Number(target.dataset.index)]; if (!record) return; const yes = await foundry.applications.api.DialogV2.confirm({ window: { title: "Unlink Companion" }, content: `<p>Unlink <strong>${foundry.utils.escapeHTML(record.name ?? "this companion")}</strong>?</p>`, yes: { label: "Unlink" }, no: { label: "Cancel" } }); if (!yes) return; if (record.tokenUuid) { const token = await fromUuid(record.tokenUuid).catch(() => null); if (token) await token.delete(); } records.splice(Number(target.dataset.index), 1); await TamerCompanionManager.save(this.tamer, records); await this.render({ force: true }); }
  static async _onOpenTamer() { await this.tamer.sheet?.render({ force: true }); }
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
    if (!packs.length) return { packs: [], selectedSource: "all", entries: [] };
    if (this.source !== "all" && !packs.some(pack => pack.collection === this.source)) this.source = "all";

    const selectedPacks = this.source === "all" ? packs : packs.filter(pack => pack.collection === this.source);
    const entries = [];
    for (const pack of selectedPacks) {
      try {
        const index = await pack.getIndex({ fields: ["name", "img", "type"] });
        for (const entry of index.values()) {
          entries.push({
            id: entry._id,
            name: entry.name ?? "Unnamed Actor",
            img: entry.img ?? "icons/svg/mystery-man.svg",
            type: entry.type ?? "",
            source: pack.collection,
            sourceTitle: pack.title
          });
        }
      } catch (error) {
        console.warn("[Tamer Companion Manager] Could not index companion compendium.", pack.collection, error);
      }
    }
    entries.sort((a,b) => a.name.localeCompare(b.name) || a.sourceTitle.localeCompare(b.sourceTitle));
    return {
      selectedAll: this.source === "all",
      packs: packs.map(pack => ({ collection: pack.collection, title: pack.title, selected: this.source === pack.collection })),
      selectedSource: this.source,
      entries
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

    try {
      const actor = await game.actors.importFromCompendium(pack, documentId);
      if (!actor) return ui.notifications.error("The companion could not be imported into the World.");
      await this.close();
      await this.manager?._linkCompanion(actor);
    } catch (error) {
      console.error("[Tamer Companion Manager] Failed to import companion from compendium.", error);
      ui.notifications.error("The companion could not be imported from that compendium. See the browser console for details.");
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
  game.settings.registerMenu(MODULE_ID, "openImprovementRegistry", { name: "Bespoke Companion Improvements", label: "Register Improvements", hint: "Register additional improvement trees for bespoke companions.", icon: "fa-solid fa-tree", type: TamerCompanionImprovementRegistry, restricted: true });
  game.settings.registerMenu(MODULE_ID, "openCompanionSources", { name: "Companion Sources", label: "Configure Companion Sources", hint: "Choose which Actor compendiums the Add Companion browser can use.", icon: "fa-solid fa-database", type: TamerCompanionSourceRegistry, restricted: true });
  game.settings.registerMenu(MODULE_ID, "openManager", { name: "Tamer Companion Manager", label: "Open Companion Manager", hint: "Open the Tamer Companion Manager using the first Tamer Actor you own.", icon: "fa-solid fa-paw", type: TamerCompanionManager, restricted: false });
  game.tamerCompanionManager = { open: actor => TamerCompanionManager.open(actor), isTamer: actor => TamerCompanionManager.isTamer(actor), getTamerLevel: actor => TamerCompanionManager.getTamerLevel(actor), getPocketFamilySlots: level => TamerCompanionManager.getPocketFamilySlots(level) };
  const addCompanionControl = (app, controls) => { const actor = app?.actor; if (!actor || !TamerCompanionManager.isTamer(actor)) return; if (controls.some(c => c.action === "tamer-companion-manager")) return; controls.unshift({ action: "tamer-companion-manager", label: "Companions", icon: "fa-solid fa-paw", ownership: "OWNER", onClick: () => TamerCompanionManager.open(actor) }); };
  Hooks.on("getHeaderControlsApplicationV2", addCompanionControl);
  Hooks.on("getHeaderControlsActorSheetV2", addCompanionControl);
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
      await TamerCompanionManager.syncCompanionImprovements(actor, {
        allowAutomaticPrompt: levelIncreased,
        levelDecreased
      });

      // Consume the captured transition after synchronization. Later duplicate
      // advancement-complete hooks have no level transition to trigger a picker.
      TamerCompanionManager._pendingLevelTransitions.delete(transitionKey);

      for (const app of Object.values(ui.windows ?? {})) {
        if (app instanceof TamerCompanionManager && app.tamer?.id === actor.id) {
          await app.render({ force: true });
        }
      }
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
        for (const app of Object.values(ui.windows ?? {})) {
          if (app instanceof TamerCompanionManager && app.tamer?.id === actor.id) await app.render({ force: true });
        }
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
    if (!Object.hasOwn(changes?.system?.details ?? {}, "level")) return;
    await syncTamerCompanionAdvancement(actor);
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