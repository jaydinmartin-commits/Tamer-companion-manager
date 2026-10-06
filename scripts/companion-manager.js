import { HandlebarsApplicationMixin, ApplicationV2 } from foundry.applications.api;
import { TamerRecords } from "./data/tamer-records.js";

const MODULE_ID = "tamer-companion-manager";

export class TamerCompanionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tamer-companion-manager",
    classes: ["tamer-companion-manager"],
    window: {
      title: "Tamer Companion Manager",
      resizable: true
    },
    position: {
      width: 900,
      height: 700
    },
    actions: {
      refresh: TamerCompanionManager._onRefresh,
      addCompanion: TamerCompanionManager._onAddCompanion,
      removeCompanion: TamerCompanionManager._onRemoveCompanion
    }
  };

  static PARTS = {
    main: {
      template: "modules/tamer-companion-manager/templates/companion-manager.hbs",
      root: true
    }
  };

  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer ?? null;
  }

  setTamer(actor) {
    this.tamer = actor;
    return this;
  }

  async _prepareContext() {
    return {
      moduleId: MODULE_ID,
      tamer: this.tamer,
      companions: this.tamer ? TamerRecords.read(this.tamer) : []
    };
  }

  static async chooseTamer() {
    const candidates = (game.actors?.contents ?? []).filter(TamerRecords.isTamer);
    if (candidates.length === 1) return candidates[0];
    if (!candidates.length) {
      ui.notifications.warn("No Tamer actors were found.");
      return null;
    }

    const options = candidates.map(actor =>
      `<option value="${actor.uuid}">${foundry.utils.escapeHTML(actor.name)}</option>`
    ).join("");

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Select Tamer" },
      content: `<form><label>Tamer <select name="tamer">${options}</select></label></form>`,
      buttons: [{
        action: "select",
        label: "Open",
        default: true,
        callback: (event, button, dialog) => button.form.elements.tamer.value
      }, {
        action: "cancel",
        label: "Cancel"
      }]
    });

    return result ? fromUuid(result).catch(() => null) : null;
  }

  static async chooseActor() {
    const candidates = (game.actors?.contents ?? []).filter(actor => actor.type !== "character");
    if (!candidates.length) {
      ui.notifications.warn("No non-character Actors are available to add.");
      return null;
    }

    const options = candidates.map(actor =>
      `<option value="${actor.uuid}">${foundry.utils.escapeHTML(actor.name)}</option>`
    ).join("");

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Add Companion" },
      content: `<form><label>Companion <select name="actor">${options}</select></label></form>`,
      buttons: [{
        action: "select",
        label: "Add",
        default: true,
        callback: (event, button) => button.form.elements.actor.value
      }, {
        action: "cancel",
        label: "Cancel"
      }]
    });

    return result ? fromUuid(result).catch(() => null) : null;
  }

  static async _onRefresh() {
    await this.render({ force: true });
  }

  static async _onAddCompanion() {
    if (!this.tamer) return;
    const actor = await this.constructor.chooseActor();
    if (!actor) return;

    const record = await TamerRecords.add(this.tamer, actor);
    if (!record) {
      ui.notifications.error("The companion could not be added.");
      return;
    }

    await this.render({ force: true });
  }

  static async _onRemoveCompanion(event, target) {
    const recordId = target?.dataset?.recordId;
    if (!recordId || !this.tamer) return;

    const removed = await TamerRecords.remove(this.tamer, recordId);
    if (removed) await this.render({ force: true });
  }
}

globalThis.TamerCompanionManager = TamerCompanionManager;
