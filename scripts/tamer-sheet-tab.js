const MODULE_ID = "tamer-companion-manager";
const TAB_ID = "tcm-companions";

class TamerCompanionSheetTab {
  static controllers = new WeakMap();

  static getRoot(app, element) {
    if (element instanceof HTMLElement) return element;
    if (element?.[0] instanceof HTMLElement) return element[0];
    if (app?.element instanceof HTMLElement) return app.element;
    return null;
  }

  static getActor(app) {
    return app?.actor ?? app?.document ?? null;
  }

  static async attach(app, element) {
    const root = this.getRoot(app, element);
    const actor = this.getActor(app);
    if (!root || !actor || !TamerCompanionManager.isTamer(actor)) return;
    if (!(actor.isOwner || game.user.isGM)) return;

    const nav = root.querySelector("nav.sheet-tabs.tabs, nav.sheet-tabs, nav.tabs");
    const body = root.querySelector(".sheet-body");
    if (!nav || !body) return;

    const group = nav.dataset.group || "primary";
    let tab = nav.querySelector(`[data-tab="${TAB_ID}"]`);
    let content = body.querySelector(`.tcm-sheet-tab-content[data-tab="${TAB_ID}"]`);

    if (!tab) {
      tab = document.createElement("a");
      tab.className = "item tcm-sheet-tab";
      tab.dataset.tab = TAB_ID;
      tab.dataset.group = group;
      tab.href = "#";
      tab.innerHTML = '<i class="fa-solid fa-paw"></i><span>Companions</span>';
      nav.appendChild(tab);
    }

    if (!content) {
      content = document.createElement("div");
      content.className = "tab tcm-sheet-tab-content";
      content.dataset.tab = TAB_ID;
      content.dataset.group = group;
      content.hidden = true;
      body.appendChild(content);
    }

    let controller = this.controllers.get(app);
    if (!controller) {
      controller = Object.create(TamerCompanionManager.prototype);
      controller.tamer = actor;
      controller._tcmSheetApp = app;
      controller._tcmSheetRoot = root;
      controller._tcmSheetContent = content;
      controller.render = async () => this.renderController(controller);
      controller.close = async () => {};
      this.controllers.set(app, controller);

      tab.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await this.activate(app, root, nav, body, tab, content, controller);
      });

      root.addEventListener("dragover", event => this.onDragOver(event));
      root.addEventListener("drop", event => this.onDrop(event, controller));
      content.addEventListener("click", event => this.onAction(event, controller), true);
      content.addEventListener("change", event => this.onChange(event, controller), true);

      nav.addEventListener("click", event => {
        const clicked = event.target?.closest?.("[data-tab]");
        if (!clicked || clicked === tab) return;
        queueMicrotask(() => {
          if (tab.classList.contains("active")) {
            tab.classList.remove("active");
            content.classList.remove("active");
            content.hidden = true;
          }
        });
      });
    } else {
      controller.tamer = actor;
      controller._tcmSheetRoot = root;
      controller._tcmSheetContent = content;
    }

    await this.renderController(controller);
  }

  static async renderController(controller) {
    const context = await TamerCompanionManager.prototype._prepareContext.call(controller);
    const html = await renderTemplate(
      `modules/${MODULE_ID}/templates/companion-manager.hbs`,
      context
    );
    controller._tcmSheetContent.innerHTML = html;
    controller._tcmSheetContent.querySelector(".tcm-root")?.classList.add("tcm-embedded");
  }

  static async activate(app, root, nav, body, tab, content, controller) {
    const group = nav.dataset.group || "primary";

    for (const link of nav.querySelectorAll("[data-tab]")) {
      if ((link.dataset.group || group) !== group) continue;
      link.classList.toggle("active", link === tab);
      link.setAttribute("aria-selected", link === tab ? "true" : "false");
    }

    for (const section of body.querySelectorAll(`.tab[data-group="${CSS.escape(group)}"]`)) {
      section.classList.toggle("active", section === content);
      section.hidden = section !== content;
    }

    tab.classList.add("active");
    content.classList.add("active");
    content.hidden = false;
    await this.renderController(controller);
  }

  static async onAction(event, controller) {
    const target = event.target?.closest?.("[data-tcm-action]");
    if (!target || !controller._tcmSheetContent.contains(target)) return;

    event.preventDefault();
    event.stopPropagation();

    const action = target.dataset.tcmAction;
    const tamer = controller.tamer;

    try {
      if (action === "refresh") {
        await this.renderController(controller);
        return;
      }

      if (action === "addCompanion") {
        const records = TamerCompanionManager.records(tamer);
        const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(tamer));
        if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available.");
        await new TamerCompanionBrowser({ tamer, manager: controller }).render({ force: true });
        return;
      }

      const index = Number(target.dataset.index);
      const record = TamerCompanionManager.records(tamer)[index];

      if (action === "openCompanion") {
        const actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
        await actor?.sheet?.render({ force: true });
        return;
      }

      if (action === "summonCompanion") {
        if (record && await TamerCompanionManager.summon(tamer, record)) await this.renderController(controller);
        return;
      }

      if (action === "dismissCompanion") {
        if (record && await TamerCompanionManager.dismiss(tamer, record)) await this.renderController(controller);
        return;
      }

      if (action === "clearVessel") {
        if (record) {
          await TamerCompanionManager.clearVessel(tamer, record);
          await this.renderController(controller);
        }
        return;
      }

      if (action === "trainCompanion") {
        const actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
        if (!record || !actor) return;
        const level = TamerCompanionManager.getTamerLevel(tamer);
        const progression = TamerCompanionManager.getProgression(record, actor, level);
        if (progression.target <= 0 && progression.chosen <= 0) {
          return ui.notifications.info(`${actor.name} does not have an improvement available until Tamer level 2.`);
        }
        if (await TamerCompanionManager.manageImprovements(tamer, record, actor)) {
          await this.renderController(controller);
        }
        return;
      }

      if (action === "unlinkCompanion") {
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
        const records = TamerCompanionManager.records(tamer);
        records.splice(index, 1);
        await TamerCompanionManager.save(tamer, records);
        await this.renderController(controller);
      }
    } catch (error) {
      console.error("[Tamer Companion Manager] Embedded tab action failed.", error);
      ui.notifications.error("The Companion Manager action could not be completed. See the console for details.");
    }
  }

  static async onChange(event, controller) {
    const select = event.target?.closest?.("[data-tcm-action='setVessel']");
    if (!select || !controller._tcmSheetContent.contains(select)) return;
    event.preventDefault();
    event.stopPropagation();
    const index = Number(select.dataset.index);
    const record = TamerCompanionManager.records(controller.tamer)[index];
    if (!record) return;
    try {
      const uuid = String(select.value ?? "").trim();
      if (!uuid) {
        await TamerCompanionManager.clearVessel(controller.tamer, record);
      } else {
        const item = await fromUuid(uuid).catch(() => null);
        if (!item) return ui.notifications.error("The selected vessel could not be found.");
        if (item.parent?.uuid !== controller.tamer.uuid) return ui.notifications.warn("The selected vessel must be an Item owned by the Tamer.");
        await TamerCompanionManager.setVessel(controller.tamer, record, item);
      }
      await this.renderController(controller);
    } catch (error) {
      console.error("[Tamer Companion Manager] Vessel selection failed.", error);
      ui.notifications.error("The vessel selection could not be completed.");
    }
  }

  static onDragOver(event) {
    const zone = event.target?.closest?.(".tcm-vessel-drop-zone, .tcm-drop-zone");
    if (!zone) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = zone.classList.contains("tcm-vessel-drop-zone") ? "copy" : "link";
  }

  static async onDrop(event, controller) {
    const zone = event.target?.closest?.(".tcm-vessel-drop-zone, .tcm-drop-zone");
    if (!zone) return;
    event.preventDefault();
    event.stopPropagation();

    if (zone.classList.contains("tcm-vessel-drop-zone")) {
      await TamerCompanionManager.prototype._onDropVessel.call(controller, event);
    } else {
      await TamerCompanionManager.prototype._onDropCompanion.call(controller, event);
    }
    await this.renderController(controller);
  }
}

Hooks.once("init", () => {
  Hooks.on("renderActorSheetV2", (app, element) => TamerCompanionSheetTab.attach(app, element));
  Hooks.on("renderActorSheet", (app, html) => TamerCompanionSheetTab.attach(app, html));
});

globalThis.TamerCompanionSheetTab = TamerCompanionSheetTab;
