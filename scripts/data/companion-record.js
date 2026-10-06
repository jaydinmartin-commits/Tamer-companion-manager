const MODULE_ID = "tamer-companion-manager";
const FLAG_KEY = "companionManager";

export const CompanionRecord = Object.freeze({
  create({ id, name = "", actorUuid = null } = {}) {
    if (!id) throw new Error("CompanionRecord requires an id.");
    return {
      id: String(id),
      name: String(name),
      actorUuid: actorUuid ? String(actorUuid) : null,
      improvements: []
    };
  },

  normalize(record) {
    if (!record || !record.id) return null;
    return {
      id: String(record.id),
      name: String(record.name ?? ""),
      actorUuid: record.actorUuid ? String(record.actorUuid) : null,
      improvements: Array.isArray(record.improvements)
        ? record.improvements.map(String)
        : []
    };
  },

  read(actor) {
    const value = actor?.getFlag?.(MODULE_ID, FLAG_KEY);
    return Array.isArray(value?.companions)
      ? value.companions.map(this.normalize).filter(Boolean)
      : [];
  }
});
