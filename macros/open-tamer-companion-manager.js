const Manager = globalThis.TamerCompanionManager;

if (!Manager) {
  ui.notifications.error("Tamer Companion Manager is not initialized.");
} else {
  (async () => {
    const tamer = await Manager.chooseTamer();
    if (!tamer) return;

    const manager = new Manager({ tamer });
    await manager.render({ force: true });
  })().catch(error => {
    console.error("Tamer Companion Manager | Failed to open manager.", error);
    ui.notifications.error("Tamer Companion Manager could not be opened. Check the console for details.");
  });
}
