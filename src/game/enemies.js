import { WORLD } from "../core/constants.js";
import { clamp, dist2, norm } from "../core/math.js";
import { ENEMIES } from "../data/enemies.js";
import { nextId } from "./state.js";
import { DAMAGE_TAGS, dealPlayerDamage, enemySlowMult } from "./effects.js";
import { devEnemyDamageMult, devEnemySpeedMult } from "./dev.js";
import { updateDirectorSpawner } from "./director.js";
import { resolveSpawnPoint } from "./spawnZones.js";

function nearestAlivePlayer(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of Object.values(state.players)) {
    if (p.hp <= 0) continue;
    const d = dist2(x, y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function spawnEnemy(state, kind, x = null, y = null, options = {}) {
  const data = ENEMIES[kind];
  if (!data) return null;
  const id = nextId("en");
  let spawnZone = options.zone || null;
  if (x === null || y === null) {
    const point = resolveSpawnPoint(state, spawnZone || "edge_random");
    x = point.x;
    y = point.y;
    spawnZone = spawnZone || "edge_random";
  }
  state.enemies[id] = {
    id,
    kind,
    x,
    y,
    spawnZone,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    hp: data.hp,
    maxHp: data.hp,
    radius: data.radius,
    shootAt: 0
  };
  return state.enemies[id];
}

export function updateSpawner(state, dt) {
  // v38: enemies.js owns enemy entities and movement; room pacing decisions live in director.js.
  updateDirectorSpawner(state, dt, spawnEnemy);
}

export function updateEnemies(state, dt) {
  for (const enemy of Object.values(state.enemies)) {
    const data = ENEMIES[enemy.kind];
    const target = nearestAlivePlayer(state, enemy.x, enemy.y);
    if (!target) continue;

    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const dir = norm(dx, dy);
    let speed = data.speed * enemySlowMult(enemy) * devEnemySpeedMult(state);
    if (data.behavior === "ranged" && d < 300) speed *= -0.45;

    const targetVx = dir.x * speed;
    const targetVy = dir.y * speed;
    const t = 1 - Math.exp(-8 * dt);
    enemy.vx += (targetVx - enemy.vx) * t;
    enemy.vy += (targetVy - enemy.vy) * t;
    enemy.kx = (enemy.kx || 0) * Math.exp(-6.8 * dt);
    enemy.ky = (enemy.ky || 0) * Math.exp(-6.8 * dt);

    enemy.x = clamp(enemy.x + (enemy.vx + (enemy.kx || 0)) * dt, enemy.radius, WORLD.w - enemy.radius);
    enemy.y = clamp(enemy.y + (enemy.vy + (enemy.ky || 0)) * dt, enemy.radius, WORLD.h - enemy.radius);

    const touchR = enemy.radius + target.radius;
    if (dist2(enemy.x, enemy.y, target.x, target.y) <= touchR * touchR) {
      // ARCHITECTURE GUARD: player damage must flow through dealPlayerDamage().
      // Never mutate player.hp directly here; future armor/thorns/aura hooks depend on this contract.
      dealPlayerDamage(state, target, {
        amount: data.damage * devEnemyDamageMult(state) * dt,
        sourceId: enemy.id,
        sourceType: "enemyTouch",
        enemyId: enemy.id,
        tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH]
      });
      const push = norm(target.x - enemy.x, target.y - enemy.y);
      target.kx = (target.kx || 0) + push.x * 70;
      target.ky = (target.ky || 0) + push.y * 70;
    }
  }
}
