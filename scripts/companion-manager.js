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
    }
  };

  static PARTS = {
    main: {
      template: "modules/tamer-companion-manager/templates/companion-manager.hbs"
    }
  };

  constructor(options = {}) {
    super(options);
    this.tamer = null;
  }

  setTamer(actor) {
    this.tamer = actor;
    return this;
  }

  async _prepareContext() {
    const companions = this.tamer ? TamerRecords.read(this.tamer) : [];
    return {
      moduleId: MODULE_ID,
      tamer: this.tamer,
      companions
    };
  }
}

globalThis.TamerCompanionManager = TamerCompanionManager;
