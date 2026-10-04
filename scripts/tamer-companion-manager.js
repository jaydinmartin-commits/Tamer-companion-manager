const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companions";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TamerCompanionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.tamer = options.tamer ?? game?.actors?.contents?.find(a => TamerCompanionManager.isTamer(a) && (a.isOwner || game.user.isGM)) ?? null;
    this._tcmDragDrop = new foundry.applications.ux.DragDrop({ dragSelector: null, dropSelector: ".tcm-drop-zone", permissions: { drop: () => this._canAcceptCompanionDrop() }, callbacks: { drop: event => this._onDropCompanion(event), dragover: event => this._onDragOverCompanion(event) } });
  }

  static DEFAULT_OPTIONS = { id: "tamer-companion-manager", classes: ["tamer-companion-manager"], window: { title: "Tamer Companions", icon: "fa-solid fa-paw", resizable: true }, position: { width: 760, height: 650 }, actions: { refresh: this._onRefresh, addCompanion: this._onAddCompanion, openCompanion: this._onOpenCompanion, summonCompanion: this._onSummonCompanion, dismissCompanion: this._onDismissCompanion, unlinkCompanion: this._onUnlinkCompanion, openTamer: this._onOpenTamer, trainCompanion: this._onTrainCompanion, soulBond: this._onSoulBond } };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/companion-manager.hbs`, root: true } };

  async _prepareContext() {
    const level = TamerCompanionManager.getTamerLevel(this.tamer), slots = TamerCompanionManager.getPocketFamilySlots(level), records = TamerCompanionManager.records(this.tamer);
    const companions = await Promise.all(records.map(async (record, index) => { const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null; const token = record.tokenUuid ? await fromUuid(record.tokenUuid).catch(() => null) : null; const progression = actor ? TamerCompanionManager.getProgression(record, actor, level) : { target: 0, chosen: 0, pending: 0, bonusHitDice: 0, asiHitDice: 0 }; return { index, slot: index + 1, name: actor?.name ?? record.name ?? "Unlinked Companion", img: actor?.img ?? "icons/svg/mystery-man.svg", type: actor?.system?.details?.type?.value ?? actor?.system?.details?.type ?? "Creature", hp: actor?.system?.attributes?.hp?.value ?? 0, hpMax: actor?.system?.attributes?.hp?.max ?? 0, ac: actor?.system?.attributes?.ac?.value ?? 0, vessel: record.vesselName || "No vessel assigned", linked: Boolean(actor), summoned: Boolean(token), progression }; }));
    const soulBondMax = 5 * level, soulBondPool = Number(this.tamer.getFlag(MODULE_ID, "soulBondPool") ?? soulBondMax);\n    if (Number(this.tamer.getFlag(MODULE_ID, "soulBondPool")) !== soulBondPool) await this.tamer.setFlag(MODULE_ID, "soulBondPool", soulBondPool);\n    return { tamer: { name: this.tamer.name, img: this.tamer.img, level }, pocketFamily: { slots, occupied: companions.length, empty: Array.from({ length: Math.max(0, slots - companions.length) }, (_, i) => i) }, limits: { size: TamerCompanionManager.getMaxCompanionSize(level), cr: TamerCompanionManager.getMaxCompanionCR(level) }, soulBond: { pool: soulBondPool, max: soulBondMax }, companions };
  }

  static records(actor) { return foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG_KEY) ?? []); }
  static async save(actor, records) { await actor.setFlag(MODULE_ID, FLAG_KEY, records); }
  static isTamer(actor) { return Boolean(actor?.items?.some(item => item.type === "class" && (String(item.name ?? "").trim().toLowerCase() === "tamer" || String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer"))); }
  static getTamerLevel(actor) { const cls = actor?.items?.find(item => item.type === "class" && (String(item.name ?? "").trim().toLowerCase() === "tamer" || String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer")); const classLevel = Number(cls?.system?.levels ?? cls?.system?.level ?? 0); return classLevel > 0 ? classLevel : Number(actor?.system?.details?.level ?? 0); }
  static getPocketFamilySlots(level) { if (level >= 19) return 5; if (level >= 15) return 4; if (level >= 11) return 3; if (level >= 3) return 2; if (level >= 1) return 1; return 0; }

  static getMaxCompanionSize(level) { if (level >= 13) return "Huge"; if (level >= 9) return "Large"; if (level >= 5) return "Medium"; return "Small"; }
  static getMaxCompanionCR(level) { if (level >= 19) return 6; if (level >= 16) return 5; if (level >= 13) return 4; if (level >= 10) return 3; if (level >= 7) return 2; if (level >= 4) return 1; return 0.5; }
  static getASILevels(level) { return [4, 8, 12, 16, 19].filter(l => level >= l).length; }
  static isMonsterTrainerImprovement(item) { return String(item?.type ?? "").toLowerCase() === "monster-trainer-improvement" || String(item?.system?.type ?? "").toLowerCase() === "monster-trainer-improvement" || String(item?.system?.identifier ?? "").toLowerCase() === "monster-trainer-improvement"; }
  static getMonsterTrainerImprovements(actor) { return actor?.items?.filter(item => this.isMonsterTrainerImprovement(item)) ?? []; }
  static getTrainingOptions() {
    return [
      { id: "speed", name: "Speed Training", description: "Increase one existing speed by 15 feet, up to 150% of its base speed." },
      { id: "toughen", name: "Toughen Up", description: "Gain an additional Hit Die and increase maximum hit points by the rolled die plus Constitution modifier." },
      { id: "ability", name: "Ability Boost", description: "Increase one ability score by 1, to a maximum of 20." },
      { id: "throat", name: "Go For the Throat", description: "Gain +1 to attack and damage rolls with natural weapons or unarmed strikes." },
      { id: "save", name: "Survival Instincts", description: "Gain proficiency in one saving throw." },
      { id: "war", name: "War Training", description: "Gain proficiency with one armour type or two weapons." }
    ];
  }
  static getImprovementTarget(level) { return Math.max(0, level - 1); }
  static getProgression(record, actor, level) {
    const target = this.getImprovementTarget(level);
    const chosen = (record.improvements ?? []).length;
    return { target, chosen, pending: Math.max(0, target - chosen), bonusHitDice: Number(record.bonusHitDice ?? 0), asiHitDice: this.getASILevels(level) };
  }
  static async applyTrainingChoice(actor, record, choice) {
    record.improvements ??= [];
    record.improvements.push(choice);
    if (choice.type === "ability") {
      const key = choice.ability;
      const path = `system.abilities.${key}.value`;
      const current = Number(foundry.utils.getProperty(actor, path) ?? 0);
      if (current < 20) await actor.update({ [path]: Math.min(20, current + 1) });
    } else if (choice.type === "speed") {
      const key = choice.speed;
      const path = `system.attributes.movement.${key}`;
      const current = Number(foundry.utils.getProperty(actor, path) ?? 0);
      if (current > 0) await actor.update({ [path]: current + 15 });
    } else if (choice.type === "toughen") {
      const die = Number(actor.system?.attributes?.hd?.faces ?? 8) || 8;
      const con = Number(actor.system?.abilities?.con?.mod ?? 0);
      const roll = await new Roll(`1d${die}`).evaluate();
      const hp = Math.max(1, Number(roll.total ?? die) + Math.max(0, con));
      record.bonusHitDice = Number(record.bonusHitDice ?? 0) + 1;
      record.bonusHP = Number(record.bonusHP ?? 0) + hp;
      const max = Number(actor.system?.attributes?.hp?.max ?? 0);
      const value = Number(actor.system?.attributes?.hp?.value ?? 0);
      await actor.update({ "system.attributes.hp.max": max + hp, "system.attributes.hp.value": value + hp });
    }
  }
  static async addMonsterTrainerImprovement(tamer, record, actor, item) {
    if (!this.isMonsterTrainerImprovement(item)) return ui.notifications.warn("That Item is not a Monster Trainer Improvement.");
    const existing = this.getMonsterTrainerImprovements(actor);
    const level = this.getTamerLevel(tamer);
    const target = this.getImprovementTarget(level, actor);
    if (existing.length >= target) return ui.notifications.warn(`${actor.name} has no unassigned Monster Trainer Improvements available.`);
    if (existing.some(i => i.name === item.name && String(i.system?.identifier ?? "") === String(item.system?.identifier ?? ""))) return ui.notifications.warn(`${actor.name} already has ${item.name}.`);
    const data = item.toObject();
    delete data._id;
    const created = await actor.createEmbeddedDocuments("Item", [data]);
    if (!created?.length) return false;
    const records = this.records(tamer);
    const targetRecord = records.find(r => r.id === record.id);
    if (targetRecord) {
      targetRecord.improvements ??= [];
      targetRecord.improvements.push({ itemUuid: created[0].uuid, itemId: created[0].id, name: created[0].name, assignedAtLevel: level });
      await this.save(tamer, records);
    }
    ui.notifications.info(`${item.name} added to ${actor.name}.`);
    return true;
  }
  static async _onDropImprovement(event, index) {
    event.preventDefault();
    const record = this.records(this.tamer)[Number(index)];
    const actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    if (!record || !actor) return;
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return ui.notifications.warn("Drop a Monster Trainer Improvement Item here.");
    const item = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
    if (!item) return ui.notifications.error("The dropped Item could not be resolved.");
    await this.addMonsterTrainerImprovement(this.tamer, record, actor, item);
    await this.render({ force: true });
  }
  static async openTraining(tamer, record, actor) {
    const level = this.getTamerLevel(tamer);
    const progression = this.getProgression(record, actor, level);
    if (!progression.pending) return ui.notifications.info(`${actor.name} has no unassigned Monster Trainer improvements.`);
    const options = this.getTrainingOptions().map(o => `<option value="${o.id}">${o.name} — ${o.description}</option>`).join("");
    const content = `<div class="tcm-training-dialog">
      <p><strong>${actor.name}</strong> has <strong>${progression.pending}</strong> unassigned Monster Trainer improvement(s).</p>
      <div class="form-group"><label>Improvement</label><select name="improvement">${options}</select></div>
      <div class="form-group tcm-training-extra" data-for="ability"><label>Ability</label><select name="ability"><option value="str">Strength</option><option value="dex">Dexterity</option><option value="con">Constitution</option><option value="int">Intelligence</option><option value="wis">Wisdom</option><option value="cha">Charisma</option></select></div>
      <div class="form-group tcm-training-extra" data-for="speed"><label>Speed</label><select name="speed"><option value="walk">Walking</option><option value="burrow">Burrowing</option><option value="climb">Climbing</option><option value="fly">Flying</option><option value="swim">Swimming</option></select></div>
      <p class="hint">The selected improvement is permanently recorded on this companion. Ability, speed, and Toughen Up changes are applied to the companion Actor.</p>
    </div>`;
    const result = await foundry.applications.api.DialogV2.input({
      window: { title: `Train ${actor.name}` }, content,
      ok: { label: "Apply Training" }
    });
    if (!result?.improvement) return;
    const choice = { type: result.improvement, ability: result.ability, speed: result.speed, atLevel: level, id: foundry.utils.randomID() };
    await this.applyTrainingChoice(actor, record, choice);
    const records = this.records(tamer), target = records.find(r => r.id === record.id);
    if (target) Object.assign(target, record);
    await this.save(tamer, records);
    ui.notifications.info(`${actor.name}: ${this.getTrainingOptions().find(o => o.id === choice.type)?.name ?? "Training"} applied.`);
  }
  static async spendSoulBond(tamer, records, index, amount) {
    const pool = Number(tamer.getFlag(MODULE_ID, "soulBondPool") ?? 5 * this.getTamerLevel(tamer));
    if (pool <= 0) return ui.notifications.warn("The Tamer's Soul Bond healing pool is empty.");
    const record = records[index], actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    if (!actor) return ui.notifications.error("The companion Actor could not be found.");
    const hp = Number(actor.system?.attributes?.hp?.value ?? 0), max = Number(actor.system?.attributes?.hp?.max ?? 0);
    const healing = Math.max(0, Math.min(Number(amount) || 0, pool, max - hp));
    if (!healing) return ui.notifications.warn("That companion does not need healing, or the amount is invalid.");
    await actor.update({ "system.attributes.hp.value": hp + healing });
    await tamer.setFlag(MODULE_ID, "soulBondPool", pool - healing);
    ui.notifications.info(`Soul Bond restored ${healing} HP to ${actor.name}. ${pool - healing} healing remains.`);
  }

  static async summonedRecord(records) { for (const record of records) { if (!record.tokenUuid) continue; const token = await fromUuid(record.tokenUuid).catch(() => null); if (token) return { record, token }; } return null; }
  static tamerToken(tamer) { return canvas?.tokens?.controlled?.find(t => t.actor?.id === tamer.id) ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === tamer.id) ?? null; }
  static findAdjacentSpace(tamerToken) { const grid = canvas.grid.size, x = tamerToken.document.x, y = tamerToken.document.y, candidates = [{ x: x + grid, y }, { x: x - grid, y }, { x, y: y + grid }, { x, y: y - grid }]; for (const p of candidates) { const occupied = canvas.tokens.placeables.some(t => t.document.x === p.x && t.document.y === p.y); if (!occupied && p.x >= 0 && p.y >= 0) return p; } return null; }

  static async summon(tamer, record) {
    if (!canvas?.scene) return ui.notifications.warn("A scene must be active.");
    const actor = record.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null;
    if (!actor) return ui.notifications.error("The companion Actor could not be found.");
    const records = this.records(tamer);
    if (await this.summonedRecord(records)) { ui.notifications.warn("Another companion is already summoned."); return false; }
    const tamerToken = this.tamerToken(tamer); if (!tamerToken) { ui.notifications.warn("Place the Tamer's token on the current scene first."); return false; }
    const position = this.findAdjacentSpace(tamerToken); if (!position) { ui.notifications.warn("No adjacent unoccupied space was found."); return false; }
    const tokenDoc = await actor.getTokenDocument(position), created = await canvas.scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]), target = records.find(r => r.id === record.id);
    if (!target || !created?.[0]) return false; target.tokenUuid = created[0].uuid; target.status = "summoned"; await this.save(tamer, records); ui.notifications.info(`${actor.name} has been summoned.`); return true;
  }

  static async dismiss(tamer, record) { const records = this.records(tamer), target = records.find(r => r.id === record.id); if (!target) return false; if (target.tokenUuid) { const token = await fromUuid(target.tokenUuid).catch(() => null); if (token) await token.delete(); } target.tokenUuid = null; target.status = "in-vessel"; await this.save(tamer, records); ui.notifications.info(`${target.name ?? "Companion"} returned to its vessel.`); return true; }
  static async open(actor) { actor ??= game.actors.contents.find(a => this.isTamer(a) && (a.isOwner || game.user.isGM)); if (!actor) return ui.notifications.warn("No Tamer Actor was found. Create a character with the Tamer class first."); if (!this.isTamer(actor)) return ui.notifications.warn("This Actor does not have a Tamer class."); if (!(actor.isOwner || game.user.isGM)) return ui.notifications.warn("You do not have permission."); try { return await new TamerCompanionManager({ tamer: actor }).render({ force: true }); } catch (error) { console.error("[Tamer Companion Manager] Failed to open manager.", error); ui.notifications.error("The Tamer Companion Manager could not be opened. See the browser console for details."); return null; } }
  _canAcceptCompanionDrop() { if (!this.tamer || !TamerCompanionManager.isTamer(this.tamer)) return false; const records = TamerCompanionManager.records(this.tamer), max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer)); return records.length < max; }
  _onDragOverCompanion(event) { if (!this._canAcceptCompanionDrop()) return; event.dataTransfer.dropEffect = "link"; }
  async _onDropCompanion(event) { event.preventDefault(); if (!this._canAcceptCompanionDrop()) return ui.notifications.warn("No Pocket Family slot is available."); const data = TextEditor.getDragEventData(event); if (data?.type !== "Actor") return ui.notifications.warn("Only Actor documents can be added as companions."); let actor = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null; if (!actor && globalThis.Actor?.implementation?.fromDropData) actor = await Actor.implementation.fromDropData(data).catch(() => null); if (!actor) return ui.notifications.error("The dropped Actor could not be resolved."); await this._linkCompanion(actor); }
  async _linkCompanion(actor) { const records = TamerCompanionManager.records(this.tamer), max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer)); if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available."); if (actor.id === this.tamer.id || actor.uuid === this.tamer.uuid) return ui.notifications.warn("The Tamer cannot be linked as their own companion."); if (!(actor.isOwner || game.user.isGM)) return ui.notifications.warn("You do not have permission to use that Actor as a companion."); if (records.some(r => r.actorUuid === actor.uuid)) return ui.notifications.warn(`${actor.name} is already linked to this Tamer.`); records.push({ id: foundry.utils.randomID(), actorUuid: actor.uuid, name: actor.name, vesselUuid: null, vesselName: "", tokenUuid: null, status: "in-vessel", improvements: [], bespokeImprovements: [], bonusHitDice: 0 }); await TamerCompanionManager.save(this.tamer, records); ui.notifications.info(`${actor.name} has been bonded as a companion.`); await this.render({ force: true }); return true; }
  async _onRender(context, options) { await super._onRender(context, options); if (this.element) this._tcmDragDrop.bind(this.element); }
  static async _onRefresh() { await this.render({ force: true }); }
  static async _onAddCompanion() { const records = TamerCompanionManager.records(this.tamer), max = TamerCompanionManager.getPocketFamilySlots(TamerCompanionManager.getTamerLevel(this.tamer)); if (records.length >= max) return ui.notifications.warn("No Pocket Family slot is available."); const available = game.actors.contents.filter(a => a.id !== this.tamer.id && (a.isOwner || game.user.isGM)).filter(a => !records.some(r => r.actorUuid === a.uuid)).sort((a,b) => a.name.localeCompare(b.name)); if (!available.length) return ui.notifications.warn("No available Actors were found."); const options = available.map(a => `<option value="${foundry.utils.escapeHTML(a.uuid)}">${foundry.utils.escapeHTML(a.name)}</option>`).join(""); const result = await foundry.applications.api.DialogV2.input({ window: { title: "Link Companion" }, content: `<div class="form-group"><label for="tcm-companion-actor">Companion Actor</label><select id="tcm-companion-actor" name="actorUuid">${options}</select></div>`, ok: { label: "Link Companion" } }); if (!result?.actorUuid) return; const actor = await fromUuid(result.actorUuid).catch(() => null); if (!actor) return ui.notifications.error("Could not resolve that Actor."); await this._linkCompanion(actor); }
  static async _onOpenCompanion(event, target) { const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)], actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null; actor?.sheet?.render({ force: true }); }

  static async _onSummonCompanion(event, target) {
    const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)]; if (!record) return;
    const manager = this, tamerSheet = manager.tamer?.sheet, sheetWasRendered = Boolean(tamerSheet?.rendered);
    await manager.close();
    if (sheetWasRendered) await tamerSheet.close();
    // Do not re-render either window. Both remain closed after summoning.
    await TamerCompanionManager.summon(manager.tamer, record);
  }

  static async _onTrainCompanion(event, target) { const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)], actor = record?.actorUuid ? await fromUuid(record.actorUuid).catch(() => null) : null; if (!record || !actor) return; await TamerCompanionManager.openTraining(this.tamer, record, actor); await this.render({ force: true }); }
  static async _onSoulBond() { const records = TamerCompanionManager.records(this.tamer); const choices = records.map((r,i) => `<option value="${i}">${foundry.utils.escapeHTML(r.name ?? `Companion ${i+1}`)}</option>`).join(""); if (!choices) return ui.notifications.warn("No companions are bonded."); const pool = Number(this.tamer.getFlag(MODULE_ID, "soulBondPool") ?? 5 * TamerCompanionManager.getTamerLevel(this.tamer)); const result = await foundry.applications.api.DialogV2.input({ window: { title: "Soul Bond" }, content: `<div class="form-group"><label>Companion</label><select name="index">${choices}</select></div><div class="form-group"><label>Healing (max ${pool})</label><input type="number" name="amount" min="1" max="${pool}" value="${pool}"></div><p class="hint">Soul Bond has a pool of 5 × Tamer level. It replenishes on a long rest and is spent among companions after a short rest.</p>`, ok: { label: "Restore HP" } }); if (!result) return; await TamerCompanionManager.spendSoulBond(this.tamer, records, Number(result.index), Number(result.amount)); await this.render({ force: true }); }
  static async _onDismissCompanion(event, target) { const record = TamerCompanionManager.records(this.tamer)[Number(target.dataset.index)]; if (record && await TamerCompanionManager.dismiss(this.tamer, record)) await this.render({ force: true }); }
  static async _onUnlinkCompanion(event, target) { const records = TamerCompanionManager.records(this.tamer), record = records[Number(target.dataset.index)]; if (!record) return; const yes = await foundry.applications.api.DialogV2.confirm({ window: { title: "Unlink Companion" }, content: `<p>Unlink <strong>${foundry.utils.escapeHTML(record.name ?? "this companion")}</strong>?</p>`, yes: { label: "Unlink" }, no: { label: "Cancel" } }); if (!yes) return; if (record.tokenUuid) { const token = await fromUuid(record.tokenUuid).catch(() => null); if (token) await token.delete(); } records.splice(Number(target.dataset.index), 1); await TamerCompanionManager.save(this.tamer, records); await this.render({ force: true }); }
  static async _onOpenTamer() { await this.tamer.sheet?.render({ force: true }); }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "openManager", { name: "Tamer Companion Manager", label: "Open Companion Manager", hint: "Open the Tamer Companion Manager using the first Tamer Actor you own.", icon: "fa-solid fa-paw", type: TamerCompanionManager, restricted: false });
  game.tamerCompanionManager = { open: actor => TamerCompanionManager.open(actor), isTamer: actor => TamerCompanionManager.isTamer(actor), getTamerLevel: actor => TamerCompanionManager.getTamerLevel(actor), getPocketFamilySlots: level => TamerCompanionManager.getPocketFamilySlots(level) };
  const addCompanionControl = (app, controls) => { const actor = app?.actor; if (!actor || !TamerCompanionManager.isTamer(actor)) return; if (controls.some(c => c.action === "tamer-companion-manager")) return; controls.unshift({ action: "tamer-companion-manager", label: "Companions", icon: "fa-solid fa-paw", ownership: "OWNER", onClick: () => TamerCompanionManager.open(actor) }); };
  Hooks.on("getHeaderControlsApplicationV2", addCompanionControl);
  Hooks.on("getHeaderControlsActorSheetV2", addCompanionControl);
});

globalThis.TamerCompanionManager = TamerCompanionManager;
