import { GREEN } from "../core/constants.js";
import { nextId } from "./entityIds.js";
import { applyStatusToEnemy } from "./effects/status.js";

const SHAKE_MAX_POWER = 12;

export function pushVisualEffect(state, event = {}) {
  // ARCHITECTURE GUARD: gameplay systems should emit render-only feedback
  // through this helper/command executor, not by ad-hoc state.effects.push().
  // This keeps visuals separate from damage/world authority and makes future
  // replay/snapshot filtering safer.
  if (!state || !event || typeof event.type !== "string") return null;
  const fx = { ...event };
  state.effects.push(fx);
  return fx;
}

function normalizeShakeAudience(options = {}) {
  if (!options || typeof options !== "object") return {};
  const audience = typeof options.audience === "string" ? options.audience : null;
  const targetId = typeof options.targetId === "string" ? options.targetId : null;
  const ownerId = typeof options.ownerId === "string" ? options.ownerId : null;
  const out = {};
  if (audience) out.audience = audience;
  if (targetId) out.targetId = targetId;
  if (ownerId) out.ownerId = ownerId;
  return out;
}

function shakeAudienceKey(meta = {}) {
  const audience = meta.audience || (meta.targetId ? "target" : (meta.ownerId ? "owner" : "global"));
  return `${audience}:${meta.targetId || "-"}:${meta.ownerId || "-"}`;
}

export function addShake(state, power = 2.5, life = 0.12, source = null, options = {}) {
  const p = Math.max(0, Math.min(SHAKE_MAX_POWER, Number.isFinite(power) ? power : 0));
  if (p <= 0) return null;
  const l = Math.max(0.05, Math.min(0.32, Number.isFinite(life) ? life : 0.12));

  // Multiple shake sources can land during the same host tick. Aggregate
  // impulses per tick and combine them as energy, not as a linear sum.
  // Renderer then consumes each aggregate shake once and decays it locally.
  const tick = state.tick || 0;
  const meta = normalizeShakeAudience(options);
  const audienceKey = shakeAudienceKey(meta);
  const existing = state.effects.find((fx) => fx.type === "shake" && fx.tick === tick && (fx.audienceKey || shakeAudienceKey(fx)) === audienceKey);
  if (existing) {
    const current = Math.max(0, existing.power || 0);
    existing.power = Math.min(SHAKE_MAX_POWER, Math.hypot(current, p));
    existing.life = Math.max(existing.life || 0, l);
    existing.maxLife = Math.max(existing.maxLife || 0, l);
    if (source) {
      if (!Array.isArray(existing.sources)) existing.sources = existing.source ? [existing.source] : [];
      if (!existing.sources.includes(source)) existing.sources.push(source);
      existing.source = existing.sources[0] || source;
    }
    return existing;
  }

  const fx = {
    id: nextId("sh"),
    type: "shake",
    tick,
    power: p,
    life: l,
    maxLife: l,
    audience: meta.audience || (meta.targetId ? "target" : (meta.ownerId ? "owner" : "global")),
    audienceKey
  };
  if (meta.targetId) fx.targetId = meta.targetId;
  if (meta.ownerId) fx.ownerId = meta.ownerId;
  if (source) fx.source = source;
  pushVisualEffect(state, fx);
  return fx;
}

export function addSpark(state, x, y, amount = 3, power = 110, color = GREEN) {
  for (let i = 0; i < amount; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(power * 0.45, power);
    pushVisualEffect(state, {
      type: "spark",
      x: Math.round(x),
      y: Math.round(y),
      vx: Math.round(Math.cos(a) * v),
      vy: Math.round(Math.sin(a) * v),
      life: 0.18,
      maxLife: 0.18,
      color
    });
  }
}

export function executeEffectCommands(state, commands, ctx = {}, handlers = {}) {
  const executed = [];
  if (!Array.isArray(commands)) return executed;

  for (const command of commands) {
    if (!command || typeof command.type !== "string") continue;
    executed.push(command);

    if (command.type === "spark") {
      addSpark(
        state,
        command.x ?? ctx.position?.x ?? 0,
        command.y ?? ctx.position?.y ?? 0,
        command.amount ?? 3,
        command.power ?? 110,
        command.color ?? GREEN
      );
    } else if (command.type === "shake") {
      const ownerId = command.ownerId || ctx.projectile?.ownerId || ctx.sourcePlayer?.id || null;
      const audience = command.audience || (ownerId ? "owner" : null);
      addShake(state, command.power ?? 2.5, command.life ?? 0.12, command.source || null, { audience, ownerId, targetId: command.targetId || null });
    } else if (command.type === "visual" && command.event) {
      pushVisualEffect(state, command.event);
    } else if (command.type === "status" && command.target && command.status) {
      const status = applyStatusToEnemy(command.target, command.status, command.effect || {}, command.source || ctx.projectile || ctx.sourceId || null);
      if (!Array.isArray(ctx.appliedStatuses)) ctx.appliedStatuses = [];
      ctx.appliedStatuses.push({ type: command.status, status, effect: command.effect, target: command.target });
    } else if (handlers[command.type]) {
      handlers[command.type](command, ctx, state);
    }
  }

  return executed;
}
