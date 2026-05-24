// Public effects API barrel. Keep imports across gameplay modules pointed here
// while implementation stays split by responsibility.
export * from "./effects/defs.js";
export * from "./effects/core.js";
export * from "./effects/damage.js";
export * from "./effects/status.js";
export * from "./effects/loot.js";
export { sourceId, ownerPlayer } from "./sourceIds.js";
