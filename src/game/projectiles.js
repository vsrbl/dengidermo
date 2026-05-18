import { WORLD, GREEN } from "../core/constants.js";
import { angleToVec, clamp, dist2, norm, segmentCircleHit } from "../core/math.js";
import { SpatialGrid } from "../core/spatialGrid.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { ENEMIES } from "../data/enemies.js";
import {
  DAMAGE_TAGS,
  EFFECT_HOOKS,
  applyProjectileStatuses,
  cloneEffect,
  createEffectContext,
  dealDamage,
  effectCommand,
  getEffect,
  healProjectileOwner,
  resolveProjectileDamage,
  runEffectHook,
  sourceId,
  tickEnemyStatuses
} from "./effects.js";
import { dropLoot } from "./loot.js";
import { nextId, pushEvent } from "./state.js";

const enemyGrid = new SpatialGrid(112);
const CHILD_DEPTH_MAX = 2;

function rebuildEnemyGrid(state) {
  enemyGrid.clear();
  for (const e of Object.values(state.enemies)) enemyGrid.insert(e);
}

function nearestEnemy(state, projectile, maxRange = 620) {
  if (projectile.targetId && state.enemies[projectile.targetId]) return state.enemies[projectile.targetId];

  let best = null;
  let bestD = maxRange * maxRange;
  for (const e of enemyGrid.query(projectile.x, projectile.y, maxRange)) {
    if (!state.enemies[e.id]) continue;
    if (projectile.hitIds?.[e.id]) continue;
    const d = dist2(projectile.x, projectile.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) projectile.targetId = best.id;
  return best;
}

function killEnemy(state, enemy, source = null, hit = null) {
  if (!state.enemies[enemy.id]) return;
  const data = ENEMIES[enemy.kind];
  const sid = sourceId(source);

  // v35.1: projectile kills have a formal hook now. No current upgrade uses it
  // yet, but future on-kill effects should attach here instead of branching
  // inside projectile collision code.
  if (source && typeof source === "object") {
    const ctx = createEffectContext({
      state,
      projectile: source,
      sourceId: sid,
      weaponId: source.weaponId || null,
      enemy,
      target: enemy,
      hit,
      position: { x: enemy.x, y: enemy.y },
      tags: hit?.tags || [],
      rng: state.rng
    });
    runEffectHook(source, EFFECT_HOOKS.PROJECTILE_KILL, ctx, {});
  }

  dropLoot(state, enemy.x, enemy.y, enemy.kind === "boss" ? 1 : 0.32, sid);
  pushEvent(state, { type: "kill", kind: enemy.kind, x: enemy.x, y: enemy.y, score: data.score, sourceId: sid });
  delete state.enemies[enemy.id];
}

function addImpulse(enemy, fromX, fromY, force) {
  const d = norm(enemy.x - fromX, enemy.y - fromY);
  enemy.kx = (enemy.kx || 0) + d.x * force;
  enemy.ky = (enemy.ky || 0) + d.y * force;
}


const SHAKE_MAX_POWER = 12;

function addShake(state, power = 2.5, life = 0.12) {
  const p = Math.max(0, Math.min(SHAKE_MAX_POWER, Number.isFinite(power) ? power : 0));
  if (p <= 0) return;
  const l = Math.max(0.05, Math.min(0.32, Number.isFinite(life) ? life : 0.12));

  // Multiple shake sources can land during the same host tick. Aggregate
  // impulses per tick and combine them as energy, not as a linear sum.
  // Renderer then consumes each aggregate shake once and decays it locally.
  const tick = state.tick || 0;
  const existing = state.effects.find((fx) => fx.type === "shake" && fx.tick === tick);
  if (existing) {
    const current = Math.max(0, existing.power || 0);
    existing.power = Math.min(SHAKE_MAX_POWER, Math.hypot(current, p));
    existing.life = Math.max(existing.life || 0, l);
    existing.maxLife = Math.max(existing.maxLife || 0, l);
    return;
  }

  state.effects.push({
    id: nextId("sh"),
    type: "shake",
    tick,
    power: p,
    life: l,
    maxLife: l
  });
}

function addSpark(state, x, y, amount = 3, power = 110, color = GREEN) {
  for (let i = 0; i < amount; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(power * 0.45, power);
    state.effects.push({
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

function statusColor(type) {
  if (type === "freeze") return "#ffffff";
  if (type === "poison") return GREEN;
  return "#ff3048";
}

function addDamageText(state, x, y, amount, critical = false) {
  state.effects.push({
    type: "damageText",
    x: Math.round(x),
    y: Math.round(y - (critical ? 18 : 12)),
    vy: critical ? -34 : -24,
    text: `${critical ? "!" : ""}${Math.max(1, Math.round(amount))}`,
    color: critical ? GREEN : "#ffffff",
    life: critical ? 0.42 : 0.3,
    maxLife: critical ? 0.42 : 0.3
  });
}

function addStatusBurst(state, x, y, applied) {
  for (const item of applied || []) {
    const color = statusColor(item.type);
    state.effects.push({
      type: "statusBurst",
      status: item.type,
      x: Math.round(x),
      y: Math.round(y),
      r: item.type === "freeze" ? 34 : 26,
      color,
      life: 0.22,
      maxLife: 0.22
    });
    addSpark(state, x, y, item.type === "freeze" ? 3 : 2, item.type === "burn" ? 150 : 115, color);
  }
}

function executeEffectCommands(state, commands, ctx = {}) {
  for (const command of commands || []) {
    if (!command || typeof command.type !== "string") continue;
    if (command.type === "spark") {
      addSpark(state, command.x ?? ctx.position?.x ?? 0, command.y ?? ctx.position?.y ?? 0, command.amount ?? 3, command.power ?? 110, command.color ?? GREEN);
    } else if (command.type === "shake") {
      addShake(state, command.power ?? 2.5, command.life ?? 0.12);
    } else if (command.type === "visual" && command.event) {
      state.effects.push(command.event);
    } else if (command.type === "chainLightning") {
      chainLightning(state, ctx.projectile, ctx.enemy, command.effect);
    } else if (command.type === "explode") {
      explode(state, ctx.projectile, command.effect, command.x, command.y);
    } else if (command.type === "splitRockets") {
      spawnSplitProjectiles(state, ctx.projectile, command.effect);
    } else if (command.type === "clusterBomb") {
      spawnClusterExplosions(state, ctx.projectile, command.effect);
    }
  }
}

function runProjectileHook(state, projectile, hook, context, handlers) {
  const ctx = createEffectContext({
    state,
    projectile,
    sourceId: sourceId(projectile),
    weaponId: projectile?.weaponId || null,
    rng: state.rng,
    ...context
  });
  runEffectHook(projectile, hook, ctx, handlers);
  executeEffectCommands(state, ctx.commands, ctx);
  return ctx;
}

function tickEnemyStatusDamage(state, dt) {
  for (const enemy of Object.values(state.enemies)) {
    const tick = tickEnemyStatuses(enemy, dt);
    if (tick.damage > 0) {
      const damage = dealDamage(state, enemy, {
        amount: tick.damage,
        sourceId: tick.sources?.[0] || null,
        tags: [DAMAGE_TAGS.STATUS]
      });
      if (tick.active && state.rng.next() < 5 * dt) addSpark(state, enemy.x, enemy.y, 1, 80);
      if (tick.active && state.rng.next() < 2.2 * dt) {
        state.effects.push({
          type: "statusTick",
          x: Math.round(enemy.x),
          y: Math.round(enemy.y),
          r: 18 + Math.min(16, tick.damage * 1.5),
          color: tick.sources?.length ? GREEN : "#ffffff",
          life: 0.16,
          maxLife: 0.16
        });
      }
      if (damage.killed) killEnemy(state, enemy, tick.sources?.[0] || null, damage);
    }
  }
}

function dealProjectileDamage(state, projectile, enemy, baseDamage, eventX = enemy.x, eventY = enemy.y, tags = [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT]) {
  const hit = resolveProjectileDamage(state, projectile, baseDamage, enemy, tags);
  const damage = dealDamage(state, enemy, {
    amount: hit.amount,
    sourceId: projectile.ownerId,
    weaponId: projectile.weaponId,
    projectileId: projectile.id,
    tags: hit.tags
  });
  healProjectileOwner(state, projectile, damage.done, hit.tags);
  pushEvent(state, { type: "hit", x: eventX, y: eventY, amount: hit.amount, crit: hit.critical, sourceId: projectile.ownerId, tags: hit.tags });
  addDamageText(state, eventX, eventY, hit.amount, hit.critical);
  if (hit.critical) {
    addSpark(state, eventX, eventY, 5, 190);
    state.effects.push({ type: "critFlash", x: Math.round(eventX), y: Math.round(eventY), r: 30, life: 0.18, maxLife: 0.18, color: GREEN });
  }
  const ctx = runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_HIT, {
    enemy,
    target: enemy,
    hit,
    damage,
    position: { x: eventX, y: eventY },
    tags: hit.tags
  }, {
    hitShake(effect, c) {
      return effectCommand("shake", { power: (effect.power || 2.5) * (c.hit?.critical ? 1.25 : 1), life: effect.life || 0.12 });
    }
  });
  hit.commands = ctx.commands;
  hit.damage = damage;
  return hit;
}

function explode(state, projectile, effect, x = projectile.x, y = projectile.y) {
  const radius = (effect.radius || 80) * (projectile.explosionRadiusMult || 1);
  const damage = (effect.damage || projectile.damage) * (projectile.explosionDamageMult || 1);
  const force = (effect.force || 220) * (projectile.knockbackMult || 1);

  for (const e of enemyGrid.query(x, y, radius + 80)) {
    if (!state.enemies[e.id]) continue;
    const r = radius + e.radius;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 > r * r) continue;
    const falloff = Math.max(0.35, 1 - Math.sqrt(d2) / Math.max(1, r));
    const explosionHit = dealProjectileDamage(state, projectile, e, damage * falloff, e.x, e.y, [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.EXPLOSION]);
    addStatusBurst(state, e.x, e.y, applyProjectileStatuses(projectile, e));
    addImpulse(e, x, y, force * falloff);
    if (e.hp <= 0) killEnemy(state, e, projectile, explosionHit.damage || explosionHit);
  }

  const life = effect.visual === "large" ? 0.36 : 0.24;
  state.effects.push({
    type: "explosion",
    x: Math.round(x),
    y: Math.round(y),
    r: radius,
    life,
    maxLife: life,
    color: GREEN
  });
  addSpark(state, x, y, effect.visual === "large" ? 14 : 7, effect.visual === "large" ? 260 : 170);
  pushEvent(state, { type: "explosion", x, y, radius, sourceId: projectile.ownerId });
}

function chainLightning(state, projectile, firstEnemy, effect) {
  const jumps = Math.max(0, Math.floor(effect.jumps || 0));
  if (!jumps || !firstEnemy) return;
  const range = effect.range || 260;
  const falloff = Math.max(0.1, Math.min(1, effect.falloff || 0.72));
  let damage = effect.damage || Math.max(4, projectile.damage * 0.55);
  let from = firstEnemy;
  const hit = new Set([firstEnemy.id]);

  for (let i = 0; i < jumps; i += 1) {
    let best = null;
    let bestD = range * range;
    for (const e of enemyGrid.query(from.x, from.y, range)) {
      if (!state.enemies[e.id] || hit.has(e.id)) continue;
      const d = dist2(from.x, from.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    hit.add(best.id);
    const chainHit = dealProjectileDamage(state, projectile, best, damage, best.x, best.y, [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.CHAIN]);
    state.effects.push({
      type: "chain",
      amount: Math.round(chainHit.amount),
      x: Math.round(from.x),
      y: Math.round(from.y),
      x2: Math.round(best.x),
      y2: Math.round(best.y),
      life: 0.14,
      maxLife: 0.14,
      color: GREEN
    });
    if (best.hp <= 0) killEnemy(state, best, projectile, chainHit.damage || chainHit);
    from = best;
    damage *= falloff;
  }
}

function spawnSplitProjectiles(state, projectile, effect) {
  const depth = projectile.childDepth || 0;
  if (depth >= CHILD_DEPTH_MAX) return;
  const count = Math.max(0, Math.min(12, Math.floor(effect.count || 0)));
  if (!count) return;
  const baseAngle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
  const spread = effect.spread ?? Math.PI * 0.92;
  const speed = effect.speed || projectile.speed * 0.82;
  const damage = effect.damage || projectile.damage * 0.45;
  const childEffects = (projectile.effects || [])
    .filter((e) => e.type !== "splitRockets")
    .map((e) => cloneEffect(e));

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = baseAngle - spread / 2 + spread * t;
    const dir = angleToVec(angle);
    const id = nextId("pr");
    state.projectiles[id] = {
      ...projectile,
      id,
      x: projectile.x + dir.x * 14,
      y: projectile.y + dir.y * 14,
      vx: dir.x * speed,
      vy: dir.y * speed,
      speed,
      damage,
      radius: Math.max(3, projectile.radius * 0.68),
      distance: 0,
      range: Math.min(projectile.range || 520, effect.range || 460),
      life: Math.min(projectile.life || 0.55, 0.75),
      effects: childEffects,
      hitIds: {},
      pierced: 0,
      ricocheted: 0,
      exploded: false,
      expiredEffectsFired: false,
      childDepth: depth + 1,
      targetId: null
    };
  }
}

function spawnClusterExplosions(state, projectile, effect) {
  const count = Math.max(0, Math.min(16, Math.floor(effect.count || 0)));
  if (!count) return;
  const radius = effect.radius || 46;
  const damage = effect.damage || projectile.damage * 0.42;
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const d = state.rng.range(18, effect.spread || 120);
    explode(state, projectile, { type: "explode", radius, damage, force: effect.force || 110, visual: "small" }, projectile.x + Math.cos(a) * d, projectile.y + Math.sin(a) * d);
  }
}

function fireExpireEffects(state, projectile) {
  if (projectile.expiredEffectsFired) return;
  projectile.expiredEffectsFired = true;

  runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_EXPIRE, {
    position: { x: projectile.x, y: projectile.y }
  }, {
    explode(effect, c) {
      if (c.projectile.exploded) return null;
      c.projectile.exploded = true;
      return effectCommand("explode", { effect });
    },
    splitRockets(effect) {
      return effectCommand("splitRockets", { effect });
    },
    clusterBomb(effect) {
      return effectCommand("clusterBomb", { effect });
    },
    screenShake(effect) {
      if (!(effect.power > 0)) return null;
      return effectCommand("shake", { power: Math.min(12, effect.power), life: effect.life || 0.22 });
    }
  });
}

function registerHit(projectile, enemy) {
  if (!projectile.hitIds) projectile.hitIds = {};
  projectile.hitIds[enemy.id] = true;
}

function canHit(projectile, enemy) {
  return !projectile.hitIds?.[enemy.id];
}

function applyProjectileHit(state, projectile, enemy) {
  const weapon = WEAPONS[projectile.weaponId] || WEAPONS[START_WEAPON];
  registerHit(projectile, enemy);
  const hit = dealProjectileDamage(state, projectile, enemy, projectile.damage, enemy.x, enemy.y);
  addStatusBurst(state, enemy.x, enemy.y, applyProjectileStatuses(projectile, enemy));
  addImpulse(enemy, projectile.x, projectile.y, (weapon.knockback || 120) * (projectile.knockbackMult || 1));

  runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_HIT, {
    enemy,
    target: enemy,
    hit,
    position: { x: enemy.x, y: enemy.y },
    tags: hit.tags || []
  }, {
    spark(effect, c) {
      const fallback = c.projectile.kind === "bullet" ? 2 : 4;
      const amount = c.hit?.critical ? Math.max(6, (effect.count ?? fallback) + 3) : (effect.count ?? fallback);
      return effectCommand("spark", { x: c.position.x, y: c.position.y, amount, power: c.hit?.critical ? 210 : 120 });
    },
    chainLightning(effect) {
      return effectCommand("chainLightning", { effect });
    }
  });

  if (enemy.hp <= 0) killEnemy(state, enemy, projectile, hit.damage || hit);

  const pierce = getEffect(projectile, "pierce");
  const canPierce = pierce && projectile.pierced < (pierce.count || 0);
  const explodeEffect = getEffect(projectile, "explode");

  // Explosive projectiles used to terminate before pierce could do real work.
  // That made combinations like SEEKER + PIERCE feel visual-only: the first
  // impact drew the green explosion, but the projectile never carried damage
  // through to the next target. Impact explosions now resolve immediately,
  // while the projectile may continue if pierce still has charges. Split/cluster
  // stay reserved for the final expire path, so rocket upgrades do not fan out
  // on every pierced enemy.
  if (explodeEffect && canPierce) {
    explode(state, projectile, explodeEffect);
    projectile.pierced += 1;
    projectile.targetId = null;
    return false;
  }

  if (explodeEffect) {
    fireExpireEffects(state, projectile);
    return true;
  }

  if (canPierce) {
    projectile.pierced += 1;
    projectile.targetId = null;
    return false;
  }
  return true;
}

function applyHoming(state, projectile, _weapon, dt) {
  const ctx = runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_UPDATE, {
    dt,
    homing: { strength: 0, acquireRange: 0 }
  }, {
    homing(effect, c) {
      c.homing.strength += effect.strength || 0;
      c.homing.acquireRange = Math.max(c.homing.acquireRange || 0, effect.acquireRange || 0);
    },
    homingCore(effect, c) {
      c.homing.strength += effect.strength || 0;
      c.homing.acquireRange = Math.max(c.homing.acquireRange || 0, effect.acquireRange || 0);
    }
  });
  const homing = ctx.homing;
  if (!(homing.strength > 0 || homing.acquireRange > 0)) return;
  homing.acquireRange = Math.max(homing.acquireRange || 0, 620);
  const target = nearestEnemy(state, projectile, homing.acquireRange || 620);
  if (!target) return;

  const desired = norm(target.x - projectile.x, target.y - projectile.y);
  const current = norm(projectile.vx, projectile.vy);
  const strength = (homing.strength || 8) * dt;
  const nx = current.x + (desired.x - current.x) * clamp(strength, 0, 1);
  const ny = current.y + (desired.y - current.y) * clamp(strength, 0, 1);
  const nd = norm(nx, ny);
  projectile.vx = nd.x * projectile.speed;
  projectile.vy = nd.y * projectile.speed;
}

function handleWallOrEnd(state, projectile) {
  const outX = projectile.x < 0 || projectile.x > WORLD.w;
  const outY = projectile.y < 0 || projectile.y > WORLD.h;
  const out = outX || outY;
  const exhausted = projectile.life <= 0 || projectile.distance >= projectile.range;
  if (!out && !exhausted) return false;

  if (out) {
    const ricochet = getEffect(projectile, "ricochet");
    if (ricochet && projectile.ricocheted < (ricochet.count || 0)) {
      projectile.ricocheted += 1;
      projectile.x = clamp(projectile.x, 0, WORLD.w);
      projectile.y = clamp(projectile.y, 0, WORLD.h);
      if (outX) projectile.vx *= -1;
      if (outY) projectile.vy *= -1;
      projectile.targetId = null;
      projectile.hitIds = {};
      addSpark(state, projectile.x, projectile.y, 5, 165);
      const ctx = createEffectContext({
        state,
        projectile,
        sourceId: sourceId(projectile),
        weaponId: projectile.weaponId || null,
        position: { x: projectile.x, y: projectile.y },
        normal: { x: outX ? -Math.sign(projectile.vx || 1) : 0, y: outY ? -Math.sign(projectile.vy || 1) : 0 },
        rng: state.rng
      });
      ctx.queue(effectCommand("visual", {
        event: {
          type: "ricochet",
          x: Math.round(projectile.x),
          y: Math.round(projectile.y),
          vx: Math.round(projectile.vx),
          vy: Math.round(projectile.vy),
          life: 0.16,
          maxLife: 0.16,
          color: GREEN
        }
      }));
      ctx.queue(effectCommand("shake", { power: 2.2, life: 0.09, source: "ricochet" }));
      executeEffectCommands(state, ctx.commands, ctx);
      return false;
    }
  }

  fireExpireEffects(state, projectile);
  return true;
}

export function updateProjectiles(state, dt) {
  tickEnemyStatusDamage(state, dt);
  rebuildEnemyGrid(state);

  for (const p of Object.values(state.projectiles)) {
    const weapon = WEAPONS[p.weaponId] || WEAPONS[START_WEAPON];
    const prevX = p.x;
    const prevY = p.y;

    applyHoming(state, p, weapon, dt);

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.distance += Math.hypot(p.x - prevX, p.y - prevY);

    let remove = false;
    const sweep = Math.hypot(p.x - prevX, p.y - prevY);
    const range = p.radius + sweep + 64;
    for (const e of enemyGrid.query(p.x, p.y, range)) {
      if (!state.enemies[e.id] || !canHit(p, e)) continue;
      const hitRadius = e.radius + p.radius + (weapon.hitPadding || 3);
      if (!segmentCircleHit(prevX, prevY, p.x, p.y, e.x, e.y, hitRadius)) continue;
      remove = applyProjectileHit(state, p, e);
      if (remove) break;
    }

    if (!remove) remove = handleWallOrEnd(state, p);
    if (remove) delete state.projectiles[p.id];
  }

  for (const fx of state.effects) fx.life -= dt;
  state.effects = state.effects.filter((fx) => fx.life > 0);
}

export function makeProjectile({ id, ownerId, weaponId, x, y, angle, pelletIndex = 0, effects = null }) {
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const dir = angleToVec(angle);
  const projectileEffects = Array.isArray(effects) ? effects.map((effect) => cloneEffect(effect)) : (weapon.effects || []).map((effect) => cloneEffect(effect));
  return {
    id,
    ownerId,
    weaponId,
    kind: weapon.projectile,
    x,
    y,
    vx: dir.x * weapon.bulletSpeed,
    vy: dir.y * weapon.bulletSpeed,
    speed: weapon.bulletSpeed,
    damage: weapon.damage,
    radius: weapon.radius,
    range: weapon.range,
    distance: 0,
    life: weapon.range / weapon.bulletSpeed,
    color: weapon.color,
    effects: projectileEffects,
    pelletIndex,
    pierced: 0,
    ricocheted: 0,
    exploded: false,
    expiredEffectsFired: false,
    targetId: null,
    hitIds: {},
    childDepth: 0
  };
}
