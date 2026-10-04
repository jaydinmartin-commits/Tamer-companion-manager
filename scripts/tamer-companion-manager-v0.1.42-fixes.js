/* v0.1.42 targeted fixes for the Tamer Companion Manager improvement picker. */
Hooks.once("ready", () => {
  const TCM = globalThis.TamerCompanionManager;
  if (!TCM) return;

  const normalize = name => String(name ?? "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const asLevel = value => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const asNames = value => {
    if (Array.isArray(value)) return value.flatMap(asNames).filter(Boolean);
    if (value && typeof value === "object") {
      return asNames(value.name ?? value.label ?? value.value ?? "");
    }
    return String(value ?? "")
      .split(/,|\\band\\b/i)
      .map(s => s.trim())
      .filter(Boolean);
  };

  /*
   * Item data is authoritative when a structured requirement exists.
   * The description parser remains only as a backwards-compatible fallback
   * for existing improvement Items which predate this metadata.
   */
  TCM.parseImprovementPrerequisites = function(item) {
    const flags = item?.flags?.["tamer-companion-manager"] ?? {};
    const system = item?.system ?? {};

    const level = asLevel(
      flags.minimumTamerLevel ??
      flags.tamerLevel ??
      system.minimumTamerLevel ??
      system.tamerLevel ??
      system.prerequisites?.minimumTamerLevel ??
      system.prerequisite?.minimumTamerLevel ??
      system.requirements?.minimumTamerLevel ??
      system.requirements?.tamerLevel
    );

    const structuredNames = asNames(
      flags.prerequisites ??
      flags.prerequisiteImprovements ??
      system.prerequisites?.improvements ??
      system.prerequisite?.improvements ??
      system.requirements?.improvements
    );

    if (level || structuredNames.length) {
      return {
        text: [
          level ? `Tamer level ${level}` : "",
          structuredNames.join(", ")
        ].filter(Boolean).join(", "),
        level,
        names: structuredNames
      };
    }

    const text = TCM.getImprovementDescription(item);
    const match = text.match(/Prerequisite\\s*:\\s*([^\\.\\n]+)/i);
    if (!match) return { text: "", level: 0, names: [] };

    const raw = match[1].trim();
    const levelMatch = raw.match(/(?:(?:tamer\\s+)?level\\s+)?(\\d+)(?:st|nd|rd|th)?-?level\\s+tamer/i);
    const parsedLevel = levelMatch ? Number(levelMatch[1]) : 0;

    const names = raw
      .replace(/(?:(?:tamer\\s+)?level\\s+)?\\d+(?:st|nd|rd|th)?-?level\\s+tamer/ig, "")
      .replace(/tamer\\s+level\\s+\\d+/ig, "")
      .split(/,|\\band\\b/i)
      .map(x => x.trim())
      .filter(x => x && !/^—$/.test(x) && !/^become(?: a)? tamer(?:’s|')? companion$/i.test(x));

    return { text: raw, level: parsedLevel, names };
  };

  TCM.getImprovementEligibility = function(item, actor, level, selectedSourceUuids, optionsByName) {
    const prereq = this.parseImprovementPrerequisites(item);
    const missing = [];

    if (prereq.level && level < prereq.level) {
      missing.push(`Tamer level ${prereq.level}`);
    }

    for (const name of prereq.names) {
      const normalized = normalize(name);
      if (!normalized || this.actorHasImprovement(actor, name)) continue;

      const sourceUuid = optionsByName.get(normalized);
      if (!sourceUuid || !selectedSourceUuids.has(sourceUuid)) {
        missing.push(name);
      }
    }

    return { eligible: missing.length === 0, prerequisite: prereq.text, missing };
  };

  /*
   * v0.1.41 used a plain lowercase map in one place while prerequisite
   * matching used normalized names elsewhere. Keep both sides identical.
   */
  const originalManage = TCM.manageImprovements;
  TCM.manageImprovements = async function(tamer, record, actor) {
    return originalManage.call(this, tamer, record, actor);
  };

  /*
   * DialogV2 owns the footer. Keep the picker content as the only scrolling
   * region and explicitly restore the footer after every render/resize.
   */
  const repairPickerLayout = dialog => {
    const root = dialog?.element;
    if (!root?.matches?.(".tcm-improvement-dialog, .tcm-improvement-dialog *")) return;

    const content = root.querySelector(".dialog-content");
    const advancement = root.querySelector(".tcm-advancement");
    const list = root.querySelector(".tcm-advancement-list");
    const footer = root.querySelector(".form-footer, footer.form-footer, .dialog-buttons");

    if (content) {
      content.style.minHeight = "0";
      content.style.overflow = "hidden";
      content.style.display = "flex";
      content.style.flexDirection = "column";
    }
    if (advancement) {
      advancement.style.minHeight = "0";
      advancement.style.height = "100%";
      advancement.style.overflow = "hidden";
      advancement.style.display = "flex";
      advancement.style.flexDirection = "column";
    }
    if (list) {
      list.style.minHeight = "0";
      list.style.height = "100%";
      list.style.flex = "1 1 auto";
      list.style.overflowY = "auto";
      list.style.overflowX = "hidden";
    }
    if (footer) {
      footer.style.flex = "0 0 auto";
      footer.style.position = "relative";
      footer.style.zIndex = "10";
      footer.style.display = "flex";
    }
  };

  Hooks.on("renderApplicationV2", app => {
    if (app?.element?.classList?.contains("tcm-improvement-dialog")) {
      repairPickerLayout(app);
      queueMicrotask(() => repairPickerLayout(app));
    }
  });

  Hooks.on("renderDialogV2", dialog => {
    if (dialog?.element?.classList?.contains("tcm-improvement-dialog")) {
      repairPickerLayout(dialog);
      queueMicrotask(() => repairPickerLayout(dialog));
    }
  });

  // Repair the picker whenever Foundry reports a window resize.
  window.addEventListener("resize", () => {
    for (const app of Object.values(ui?.windows ?? {})) {
      if (app?.element?.classList?.contains("tcm-improvement-dialog")) {
        repairPickerLayout(app);
      }
    }
  });

  console.info("[Tamer Companion Manager] v0.1.42 picker fixes loaded.");
});
