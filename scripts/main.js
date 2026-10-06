const MODULE_ID = "tamer-companion-manager";

Hooks.once("init", () => {
  globalThis.TamerCompanionManager = {
    moduleId: MODULE_ID
  };
});
