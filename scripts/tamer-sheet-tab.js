import { TamerCompanionManager } from "./tamer-companion-manager.js";

const MODULE_ID = "tamer-companion-manager";
const TAB_ID = "tcm-companions";

class TamerCompanionSheetTab {
  static controllers = new WeakMap();

  static rootOf(app, element) {
    if (element instanceof HTMLElement) return element;
    if (element?.[0] instanceof HTMLElement) return element[0];
    return app?.element instanceof HTMLElement ? app.element : null;
  }

  static actorOf(app) {
    return app?.actor ?? app?.document ?? null;
  }

  static findBody(root) {
    // dnd5e v6 ApplicationV2 uses a dedicated container for all native tab
    // bodies. Keep the embedded Companion Manager inside that container so
    // the native header, ability scores, and collapsible portrait/sidebar
    // remain outside of it and continue to control the sheet layout.
    return root.querySelector('[data-container-id="tabs"]')
      ?? root.querySelector(".tab-body")
      ?? root.querySelector(".sheet-body")
      ?? root.querySelector(".sheet-content");
  }

  static async renderCompanionImprovements(app, root, actor) {
    const link = actor?.getFlag(MODULE_ID, "companionLink");
    if (!link?.tamerUuid || !link?.recordId) return;

    const tamer = await fromUuid(link.tamerUuid).catch(() => null);
    if (!tamer || !TamerCompanionManager.isTamer(tamer)) return;

    const record = TamerCompanionManager.records(tamer).find(r => String(r?.id) === String(link.recordId));
    if (!record) return;

    const targetTab = root.querySelector('[data-container-id="tabs"] .tab')
      ?? root.querySelector(".tab-body .tab")
      ?? root.querySelector(".sheet-body .tab")
      ?? root.querySelector(".sheet-content .tab");
    if (!targetTab) return;

    let section = targetTab.querySelector("[data-tcm-companion-improvements]");
    if (!section) {
      section = document.createElement("details");
      section.className = "tcm-companion-improvements-sheet";
      section.dataset.tcmCompanionImprovements = "true";
      targetTab.prepend(section);
    }

    const entries = (record.improvements ?? []).filter(entry => !entry?.isBonus);
    const grouped = new Map();
    for (const entry of entries) {
      const key = String(entry?.sourceUuid ?? entry?.name ?? entry?.itemUuid ?? "");
      if (!key) continue;
      const existing = grouped.get(key);
      if (existing) existing.count += 1;
      else grouped.set(key, { name: String(entry?.name ?? "Improvement"), count: 1 });
    }

    const rows = [...grouped.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(entry => `<li><span>${foundry.utils.escapeHTML(entry.name)}</span>${entry.count > 1 ? `<strong>×${entry.count}</strong>` : ""}</li>`)
      .join("");

    const bonusEntries = (record.improvements ?? []).filter(entry => entry?.isBonus);
    const bonusRows = [...new Map(bonusEntries.map(entry => [
      String(entry?.sourceUuid ?? entry?.name ?? entry?.itemUuid ?? foundry.utils.randomID()),
      String(entry?.name ?? "Improvement")
    ])).values()]
      .sort((a, b) => a.localeCompare(b))
      .map(name => `<li><span>${foundry.utils.escapeHTML(name)}</span><em>Granted</em></li>`)
      .join("");

    const total = entries.length;
    const target = Math.max(0, TamerCompanionManager.getProgression(record, actor, TamerCompanionManager.getTamerLevel(tamer)).target);
    const titleCount = target ? `${total}/${target}` : String(total);
    const repeatable = [...grouped.values()].filter(entry => entry.count > 1);
    const repeatableOptions = repeatable
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(entry => `<option value="${foundry.utils.escapeHTML(entry.name)}">${foundry.utils.escapeHTML(entry.name)} ×${entry.count}</option>`)
      .join("");

    section.innerHTML = `
      <summary>
        <span><i class="fa-solid fa-arrow-up-right-dots" aria-hidden="true"></i> Improvements</span>
        <strong>${titleCount}</strong>
      </summary>
      <div class="tcm-companion-improvements-body">
        ${repeatableOptions ? `
          <label class="tcm-companion-repeatable-select">
            <span>Repeatable Improvements</span>
            <select aria-label="Repeatable Improvements">
              ${repeatableOptions}
            </select>
          </label>` : ""}
        ${rows ? `<ul>${rows}</ul>` : `<p>No selected improvements.</p>`}
        ${bonusRows ? `<div class="tcm-companion-improvements-bonus"><small>Bespoke</small><ul>${bonusRows}</ul></div>` : ""}
      </div>`;
  }
  static async attach(app, element) {
    const root = this.rootOf(app, element);
    const actor = this.actorOf(app);
    if (!root || !actor) return;
    if (!(actor.isOwner || game.user.isGM)) return;

    // Companion Actors get their own lightweight Improvements disclosure on
    // the native character sheet. This is separate from the locked manager UI.
    if (!TamerCompanionManager.isTamer(actor)) {
      await this.renderCompanionImprovements(app, root, actor);
      return;
    }

    const nav = root.querySelector("nav.sheet-tabs, nav.tabs, [role='tablist']");
    const body = this.findBody(root);
    if (!nav || !body) return;

    let tab = nav.querySelector(`[data-tcm-tab="${TAB_ID}"]`);
    if (!tab) {
      tab = document.createElement("button");
      tab.className = "item tcm-sheet-tab";
      tab.dataset.tcmTab = TAB_ID;
      tab.type = "button";
      tab.innerHTML = '<i class="fa-solid fa-paw" aria-hidden="true"></i>';
      tab.title = "Companions";
      tab.setAttribute("aria-label", "Companions");
      nav.appendChild(tab);
    }

    let content = body.querySelector(`.tcm-sheet-tab-content[data-tcm-tab="${TAB_ID}"]`);
    if (!content) {
      content = document.createElement("div");
      content.className = "tab tcm-sheet-tab-content";
      content.dataset.tcmTab = TAB_ID;
      body.appendChild(content);
    }

    let controller = this.controllers.get(app);
    if (!controller) {
      controller = Object.create(TamerCompanionManager.prototype);
      this.controllers.set(app, controller);
    }

    // The companion tab is intentionally NOT a native ActorSheetV2 tab.
    // Using data-tab here makes Foundry's ApplicationV2 tab handler treat our
    // injected button as part of the sheet's own tab configuration.
    if (!tab.dataset.tcmBound) {
      tab.dataset.tcmBound = "true";
      tab.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        controller._tcmTabActive = true;
        void this.activate(root, nav, body, tab, content, controller);
      });
    }

    // Deactivate our custom tab before the native sheet handles a normal
    // tab click. Do not manipulate native tab bodies here; ApplicationV2 owns
    // their visibility and will finish the transition itself.
    if (!nav.dataset.tcmNativeBound) {
      nav.dataset.tcmNativeBound = "true";
      nav.addEventListener("click", event => {
        const nativeTab = event.target?.closest?.("[data-tab]");
        if (!nativeTab || nativeTab === tab) return;
        controller._tcmTabActive = false;
        controller._tcmRendered = false;
        root.classList.remove("tcm-companions-active");
        content.classList.remove("active");
        content.hidden = true;
        content.style.removeProperty("display");
        content.style.removeProperty("pointer-events");
        tab.classList.remove("active");
        tab.setAttribute("aria-selected", "false");
      }, true);
    }

    if (!content.dataset.tcmBound) {
      content.dataset.tcmBound = "true";
      content.addEventListener("click", event => { void this.action(event, controller); }, true);
      content.addEventListener("change", event => { void this.change(event, controller); }, true);

      // dnd5e's native Actor drop handler also listens on the character sheet.
      // When the Companion tab is active, an Actor dropped onto an empty
      // companion slot must be consumed here first; otherwise the native
      // sheet interprets the Actor drop as a Polymorph operation.
      content.addEventListener("dragover", event => {
        if (!controller._tcmTabActive) return;
        const zone = event.target?.closest?.(".tcm-drop-zone");
        if (!zone || !content.contains(zone)) return;
        const data = globalThis.TextEditor?.getDragEventData?.(event);
        if (data?.type !== "Actor") return;
        event.preventDefault();
        event.stopPropagation();
      }, true);

      content.addEventListener("drop", event => {
        if (!controller._tcmTabActive) return;
        const zone = event.target?.closest?.(".tcm-drop-zone");
        if (!zone || !content.contains(zone)) return;
        const data = foundry.applications.ux.TextEditor?.getDragEventData?.(event)
          ?? TextEditor?.getDragEventData?.(event);
        if (data?.type !== "Actor") return;

        event.preventDefault();
        event.stopImmediatePropagation();
        void controller._onDropCompanion(event);
      }, true);
    }

    controller.tamer = actor;
    controller._tcmSheetContent = content;
    controller._tcmSheetApp = app;
    controller._tcmRefresh = async () => {
      if (!controller._tcmSheetContent?.isConnected) return false;
      await this.render(controller);
      return true;
    };

    // Do not rebuild the Companion Manager every time the native Actor Sheet
    // renders. ActorSheetV2 can re-render for many unrelated document/UI
    // changes. The companion tab is rendered lazily when opened, which avoids
    // repeated UUID resolution, flag cloning, template rendering, and DOM
    // replacement while the native sheet is being used.
    if (controller._tcmTabActive) {
      // ApplicationV2 can replace the tab body while the controller object
      // survives. In that case _tcmRendered may still be true even though the
      // new content element has never been populated.
      const actorChanged = controller._tcmRenderedActorUuid !== actor.uuid;
      const contentReplaced = controller._tcmSheetContent !== content;
      const contentEmpty = !content.querySelector(".tcm-root");
      if (actorChanged || contentReplaced || !controller._tcmRendered || contentEmpty) {
        await this.activate(root, nav, body, tab, content, controller);
      } else {
        this.activateVisualState(root, tab, content);
      }
    }
  }

  static async render(controller) {
    const context = await TamerCompanionManager.prototype._prepareContext.call(controller);
    const records = TamerCompanionManager.records(controller.tamer);
    const assigned = new Set(records.map(record => record?.vesselUuid).filter(Boolean));
    const vesselItems = [...(controller.tamer.items?.contents ?? [])]
      .filter(item => TamerCompanionManager.isValidVesselItem(item))
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

    for (const companion of context.companions ?? []) {
      const record = records[companion.index];
      companion.vessels = vesselItems
        .filter(item => item.uuid === record?.vesselUuid || !assigned.has(item.uuid))
        .map(item => ({
          uuid: item.uuid,
          name: item.name,
          equipped: item.system?.equipped === true,
          selected: item.uuid === record?.vesselUuid
        }));
    }

    controller._tcmSheetContent.innerHTML = await renderTemplate(
      "modules/" + MODULE_ID + "/templates/companion-manager.hbs",
      context
    );
    controller._tcmSheetContent.querySelector(".tcm-root")?.classList.add("tcm-embedded");
    controller._tcmRenderedActorUuid = controller.tamer?.uuid ?? null;
    controller._tcmRendered = true;
  }

  static activateVisualState(root, tab, content) {
    // Do not toggle native tab bodies here. ApplicationV2 owns their
    // visibility. The companion-active class lets CSS temporarily replace
    // the native content without corrupting ApplicationV2's tab state.
    root.classList.add("tcm-companions-active");
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    content.hidden = false;
    content.classList.add("active");
    content.style.display = "flex";
    content.style.pointerEvents = "auto";
  }

  static async activate(root, nav, body, tab, content, controller) {
    this.activateVisualState(root, tab, content);
    await this.render(controller);
  }

  static async action(event, controller) {
    const target = event.target?.closest?.("[data-action]");
    if (!target || !controller._tcmSheetContent.contains(target)) return;

    event.preventDefault();
    event.stopPropagation();

    const action = target.dataset.action;
    const index = Number(target.dataset.index);
    const records = TamerCompanionManager.records(controller.tamer);
    const record = records[index];

    try {
      if (action === "refresh") return this.render(controller);

      if (action === "openTamer") {
        return controller.tamer.sheet?.render({ force: true });
      }

      if (action === "addCompanion") {
        const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(controller.tamer));
        if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available.");
        await TamerCompanionManager._onAddCompanion.call(controller);
        // The browser performs the import and bond asynchronously. Rebuild the
        // embedded manager from the Tamer's persisted flag once the browser closes.
        await this.render(controller);
        return;
      }

      if (!record) return;

      if (action === "openCompanion") {
        const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
        return actor?.sheet?.render({ force: true });
      }

      if (action === "summonCompanion") {
        const sheet = controller._tcmSheetApp;
        const sheetWasRendered = Boolean(sheet?.rendered);
        const summoned = await TamerCompanionManager.summon(controller.tamer, record);
        if (summoned && sheetWasRendered) await sheet.close();
        return;
      }

      if (action === "dismissCompanion") {
        const sheet = controller._tcmSheetApp;
        const sheetWasRendered = Boolean(sheet?.rendered);
        const dismissed = await TamerCompanionManager.dismiss(controller.tamer, record);
        if (dismissed && sheetWasRendered) await sheet.close();
        else if (dismissed) return this.render(controller);
        return;
      }

      if (action === "clearVessel") {
        await TamerCompanionManager.clearVessel(controller.tamer, record);
        return;
      }

      if (action === "trainCompanion") {
        const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
        if (!actor) return;
        await TamerCompanionManager.manageImprovements(controller.tamer, record, actor);
        return this.render(controller);
      }

      if (action === "unlinkCompanion") {
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
        const companion = await TamerCompanionManager.resolveCompanionActor(record);
        if (companion?.getFlag(MODULE_ID, "companionLink")?.tamerUuid === controller.tamer.uuid) {
          await companion.unsetFlag(MODULE_ID, "companionLink");
        }
        records.splice(index, 1);
        await TamerCompanionManager.save(controller.tamer, records);
        return this.render(controller);
      }
    } catch (error) {
      console.error("[Tamer Companion Manager] Sheet-tab action failed.", error);
      ui.notifications.error("The Companion Manager action could not be completed. See the console for details.");
    }
  }

  static async change(event, controller) {
    const select = event.target?.closest?.("[data-tcm-vessel]");
    if (!select || !controller._tcmSheetContent.contains(select)) return;

    event.stopPropagation();
    const index = Number(select.dataset.index);
    const record = TamerCompanionManager.records(controller.tamer)[index];
    if (!record) return;

    const uuid = String(select.value ?? "");
    if (!uuid) {
      await TamerCompanionManager.clearVessel(controller.tamer, record);
      return;
    }

    const item = await fromUuid(uuid).catch(() => null);
    if (!item || item.parent?.uuid !== controller.tamer.uuid) {
      ui.notifications.warn("The selected vessel is not a valid Item on this Tamer.");
      return;
    }

    await TamerCompanionManager.setVessel(controller.tamer, record, item);
  }
}

Hooks.once("init", () => {
  // dnd5e v6 uses an ActorSheetV2-derived sheet whose concrete ApplicationV2
  // class can vary. The generic ApplicationV2 render hook is the stable v14
  // entry point and lets us attach to the sheet without depending on a
  // specific ActorSheetV2 hook name.
  Hooks.on("renderApplicationV2", (app, element) => {
    if (!app?.actor && !app?.document?.documentName) return;
    void TamerCompanionSheetTab.attach(app, element);
  });
});
