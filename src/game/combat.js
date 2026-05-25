import { angleToVec, clamp, vecToAngle } from "../core/math.js";
import { WORLD } from "../core/constants.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { getActiveWeaponId, hasWeapon, switchWeapon } from "./inventory.js";
import { makeProjectile } from "./projectiles.js";
import { buildProjectileEffects } from "./effects.js";
import { pushEvent } from "./events.js";

function statMult(player, key) {
  return Math.max(0.1, player.stats?.[key] || 1);
}

function canFire(player, weaponId, weapon, now) {
  const nextAt = player.cooldowns?.[weaponId] || 0;
  return now + 0.018 >= nextAt && player.hp > 0 && weapon;
}

function applyProjectileStats(player, projectile) {
  const speedMult = statMult(player, "projectileSpeedMult");
  const damageMult = statMult(player, "damageMult");
  projectile.damage = Math.max(1, Math.round(projectile.damage * damageMult));
  projectile.vx *= speedMult;
  projectile.vy *= speedMult;
  projectile.speed *= speedMult;
  projectile.explosionRadiusMult = statMult(player, "explosionRadiusMult");
  projectile.explosionDamageMult = statMult(player, "explosionDamageMult");
  projectile.knockbackMult = statMult(player, "knockbackMult");
  return projectile;
}

export function fireWeapon(state, playerId, payload = {}) {
  const player = state.players[playerId];
  if (!player) return false;

  if (payload.weapon && hasWeapon(player, payload.weapon)) switchWeapon(player, payload.weapon);
  const weaponId = getActiveWeaponId(player);
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  if (!canFire(player, weaponId, weapon, state.time)) return false;

  const x = clamp(player.x, 0, WORLD.w);
  const y = clamp(player.y, 0, WORLD.h);

  const angle = (Number.isFinite(payload.aimX) && Number.isFinite(payload.aimY))
    ? vecToAngle(payload.aimX - x, payload.aimY - y)
    : (Number.isFinite(payload.angle) ? payload.angle : player.angle);
  const dir = angleToVec(angle);
  const seq = payload.fireSeq || Math.floor(state.time * 1000);
  const pellets = weapon.pellets || 1;
  const baseId = `${playerId}-${seq}`;

  player.kx = (player.kx || 0) - dir.x * (weapon.recoil || 0);
  player.ky = (player.ky || 0) - dir.y * (weapon.recoil || 0);

  for (let i = 0; i < pellets; i += 1) {
    const offset = pellets === 1 ? 0 : (i - (pellets - 1) / 2) * weapon.spread;
    const pelletAngle = angle + offset;
    const pelletDir = angleToVec(pelletAngle);
    const pelletId = pellets === 1 ? baseId : `${baseId}-${i}`;
    const projectile = makeProjectile({
      id: pelletId,
      ownerId: playerId,
      weaponId,
      x: x + pelletDir.x * (player.radius + weapon.radius + 1),
      y: y + pelletDir.y * (player.radius + weapon.radius + 1),
      angle: pelletAngle,
      pelletIndex: i,
      effects: buildProjectileEffects(player, weapon, weaponId)
    });
    state.projectiles[pelletId] = applyProjectileStats(player, projectile);
  }

  player.angle = angle;
  if (!player.cooldowns) player.cooldowns = {};
  player.cooldowns[weaponId] = state.time + 1 / (weapon.fireRate * statMult(player, "fireRateMult"));
  pushEvent(state, { type: "shoot", playerId, weaponId, x, y, angle, fireSeq: seq });
  return true;
}
