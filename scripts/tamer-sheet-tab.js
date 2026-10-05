const MODULE_ID = "tamer-companion-manager";
const TAB_ID = "tcm-companions";

class TamerCompanionSheetTab {
  static controllers = new WeakMap();

  static rootOf(app, element) {
    if (element instanceof HTMLElement) return element;
    if (element?.[0] instanceof HTMLElement) return element[0];
    if (app?.element instanceof HTMLElement) return app.element;
    return null;
  }

  static actorOf(app) {
    return app?.actor ?? app?.document ?? null;
  }

  static async attach(app, element) {
    const root = this.rootOf(app, element);
    const actor = this.actorOf(app);
    if (!root || !actor || !TamerCompanionManager.isTamer(actor)) return;
    if (!(actor.isOwner || game.user.isGM)) return;

    const nav = root.querySelector("nav.sheet-tabs, nav.tabs, [role='tablist']");
    if (!nav) return;

    let body = root.querySelector(".sheet-body");
    if (!body) {
      body = root.querySelector(".window-content");
    }
    if (!body) return;

    let tab = nav.querySelector(`[data-tab="${TAB_ID}"]`);
    if (!tab) {
      tab = document.createElement("a");
      tab.className = "item tcm-sheet-tab";
      tab.dataset.tab = TAB_ID;
      tab.href = "#";
      tab.innerHTML = '<i class="fa-solid fa-paw" aria-hidden="true"></i>';
      tab.title = "Companions";
      tab.setAttribute("aria-label", "Companions");
      nav.appendChild(tab);
    }

    let content = body.querySelector(`.tcm-sheet-tab-content[data-tab="${TAB_ID}"]`);
    if (!content) {
      content = document.createElement("div");
      content.className = "tab tcm-sheet-tab-content";
      content.dataset.tab = TAB_ID;
      content.hidden = true;
      body.appendChild(content);
    }

    let controller = this.controllers.get(app);
    if (!controller) {
      controller = Object.create(TamerCompanionManager.prototype);
      controller.tamer = actor;
      controller._tcmSheetContent = content;
      this.controllers.set(app, controller);

      tab.addEventListener("click", async event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        await this.activate(root, nav, body, tab, content, controller);
      });

      content.addEventListener("click", event => this.action(event, controller), true);
      content.addEventListener("change", event => this.change(event, controller), true);
    }

    controller.tamer = actor;
    controller._tcmSheetContent = content;
    await this.render(controller);
  }

  static async render(controller) {
    const context = await TamerCompanionManager.prototype._prepareContext.call(controller);
    const records = TamerCompanionManager.records(controller.tamer);
    const assigned = new Set(records.map(record => record?.vesselUuid).filter(Boolean));
    const vesselItems = [...(controller.tamer.items?.contents ?? [])]
      .filter(item => item?.documentName === "Item" && item.type !== "class")
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
      `modules/${MODULE_ID}/templates/companion-manager.hbs`,
      context
    );
    controller._tcmSheetContent.querySelector(".tcm-root")?.classList.add("tcm-embedded");
  }

  static async activate(root, nav, body, tab, content, controller) {
    const group = nav.dataset.group;
    for (const link of nav.querySelectorAll("[data-tab]")) {
      if (group && link.dataset.group && link.dataset.group !== group) continue;
      link.classList.toggle("active", link === tab);
      link.setAttribute("aria-selected", link === tab ? "true" : "false");
    }

    for (const section of body.querySelectorAll(".tab[data-tab]")) {
      if (section === content) continue;
      if (group && section.dataset.group && section.dataset.group !== group) continue;
      section.classList.remove("active");
      section.hidden = true;
    }

    tab.classList.add("active");
    content.classList.add("active");
    content.hidden = false;
    await this.render(controller);
  }

  static async action(event, controller) {
    const target = event.target?.closest?.("[data-action]");
    if (!target || !controller._tcmSheetContent.contains(target)) return;

    const action = target.dataset.action;
    const index = Number(target.dataset.index);
    const records = TamerCompanionManager.records(controller.tamer);
    const record = records[index];

    event.preventDefault();
    event.stopPropagation();

    try {
      if (action === "refresh") return this.render(controller);

      if (action === "addCompanion") {
        const max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(controller.tamer));
        if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available.");
        await new TamerCompanionBrowser({ tamer: controller.tamer, manager: controller }).render({ force: true });
        return;
      }

      if (action === "openCompanion") {
        const actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
        return actor?.sheet?.render({ force: true });
      }

      if (action === "summonCompanion" && record) {
        await TamerCompanionManager.summon(controller.tamer, record);
        return this.render(controller);
      }

      if (action === "dismissCompanion" && record) {
        await TamerCompanionManager.dismiss(controller.tamer, record);
        return this.render(controller);
      }

      if (action === "clearVessel" && record) {
        await TamerCompanionManager.clearVessel(controller.tamer, record);
        return this.render(controller);
      }

      if (action === "trainCompanion" && record) {
        const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
        if (!actor) return;
        await TamerCompanionManager.manageImprovements(controller.tamer, record, actor);
        return this.render(controller);
      }

      if (action === "unlinkCompanion" && record) {
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
      return this.render(controller);
    }

    const item = await fromUuid(uuid).catch(() => null);
    if (!item || item.parent?.uuid !== controller.tamer.uuid) {
      ui.notifications.warn("The selected vessel is not a valid Item on this Tamer.");
      return;
    }
    await TamerCompanionManager.setVessel(controller.tamer, record, item);
    await this.render(controller);
  }
}

Hooks.once("init", () => {
  Hooks.on("renderActorSheetV2", (app, element) => TamerCompanionSheetTab.attach(app, element));
  Hooks.on("renderActorSheet", (app, html) => TamerCompanionSheetTab.attach(app, html));
  Hooks.on("renderApplicationV2", (app, element) => TamerCompanionSheetTab.attach(app, element));
});

globalThis.TamerCompanionSheetTab = TamerCompanionSheetTab;
