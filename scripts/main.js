import { TamerCompanionManager } from "./companion-manager.js";
import { TamerRecords } from "./data/tamer-records.js";

const MODULE_ID = "tamer-companion-manager";

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = {
    TamerCompanionManager,
    TamerRecords
  };
});
