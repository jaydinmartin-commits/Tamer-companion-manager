import { CompanionRecord } from "./companion-record.js";

const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companionManager";

export class TamerRecords {
  static isTamer(actor) {
    return Boolean(actor?.items?.some(item =>
      item.type === "class" &&
      (
        String(item.name ?? "").trim().toLowerCase() === "tamer" ||
        String(item.system?.identifier ?? "").trim().toLowerCase() === "tamer"
      )
    ));
  }

  static read(actor) {
    if (!this.isTamer(actor)) return [];
    return CompanionRecord.read(actor);
  }

  static async write(actor, companions) {
    if (!actor?.setFlag || !this.isTamer(actor)) return false;

    const normalized = companions
      .map(CompanionRecord.normalize)
      .filter(Boolean);

    await actor.setFlag(MODULE_ID, FLAG_KEY, { companions: normalized });
    return true;
  }
}
