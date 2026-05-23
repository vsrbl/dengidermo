import { angleToVec } from "../core/math.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { cloneEffect } from "./effects.js";

export function makeProjectile({ id, ownerId, weaponId, x, y, angle, pelletIndex = 0, effects = null }) {
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const dir = angleToVec(angle);
  const projectileEffects = Array.isArray(effects)
    ? effects.map((effect) => cloneEffect(effect))
    : (weapon.effects || []).map((effect) => cloneEffect(effect));
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

export function makeEnemyProjectile({ id, enemyId, x, y, angle, speed = 420, damage = 8, radius = 5, range = 720, knockback = 120, color = "red" }) {
  const dir = angleToVec(angle);
  return {
    id,
    ownerId: enemyId,
    ownerType: "enemy",
    enemyId,
    weaponId: "enemy_shot",
    hostile: true,
    kind: "enemyBullet",
    x,
    y,
    vx: dir.x * speed,
    vy: dir.y * speed,
    speed,
    damage,
    radius,
    range,
    knockback,
    distance: 0,
    life: range / Math.max(1, speed),
    color,
    hitPadding: 3
  };
}
