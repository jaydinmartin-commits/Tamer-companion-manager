const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if (!actor) return ui.notifications.warn("Select a Tamer token or assign a character first.");
game.tamerCompanionManager.open(actor);
