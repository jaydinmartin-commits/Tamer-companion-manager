const MODULE_ID = "tamer-companion-manager";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
    }
  };

  static PARTS = {
    main: {
      template: "modules/tamer-companion-manager/templates/companion-manager.hbs"
    }
  };

  async _prepareContext() {
    return {
      moduleId: MODULE_ID,
      companions: []
    };
  }
}

globalThis.TamerCompanionManager = TamerCompanionManager;
