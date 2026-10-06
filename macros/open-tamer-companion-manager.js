const Manager = globalThis.TamerCompanionManager;
if (!Manager) {
  return ui.notifications.error("Tamer Companion Manager is not initialized.");
}
new Manager().render({ force: true });
