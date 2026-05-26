import { angleToVec, norm } from "../../core/math.js";
import { WEAPONS, START_WEAPON } from "../../data/weapons.js";
import { nextId } from "../entityIds.js";
import { pushVisualEffect } from "../effectCommands.js";
import { makeEnemyProjectile } from "../projectiles.js";
import { applyEnemyTouchDamage, enemySpeed, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy) {
  if (!enemy.echoState || typeof enemy.echoState !== "object") {
    enemy.echoState = { fireAt: 0, blurAt: 0, strafeSide: 1 };
  }
  return enemy.echoState;
}

function targetWeaponId(target) {
  const id = target?.inventory?.activeWeapon || target?.activeWeapon || START_WEAPON;
  return WEAPONS[id] ? id : START_WEAPON;
}

function fireEchoWeapon(state, enemy, target, weaponId, cfg, rt) {
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const now = state.time || 0;
  const fireDelay = 1 / Math.max(0.1, (weapon.fireRate || 1) * (cfg.fireRateScale || 0.72));
  if ((rt.fireAt || 0) > now) return;
  rt.fireAt = now + fireDelay;
  const baseAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  const pellets = Math.max(1, Math.min(weapon.pellets || 1, weaponId === "shotgun" ? 7 : 3));
  const speed = Math.max(120, (weapon.bulletSpeed || 420) * (cfg.projectileSpeedScale || 0.86));
  const damage = Math.max(2, Math.round((weapon.damage || 8) * (cfg.damageScale || 0.62)));
  const baseId = nextId("echp");
  for (let i = 0; i < pellets; i += 1) {
    const offset = pellets === 1 ? 0 : (i - (pellets - 1) / 2) * (weapon.spread || 0.08);
    const angle = baseAngle + offset;
    const dir = angleToVec(angle);
    const projectile = makeEnemyProjectile({
      id: pellets === 1 ? baseId : `${baseId}-${i}`,
      enemyId: enemy.id,
      x: enemy.x + dir.x * (enemy.radius + (weapon.radius || 5) + 3),
      y: enemy.y + dir.y * (enemy.radius + (weapon.radius || 5) + 3),
      angle,
      speed,
      damage,
      radius: Math.max(4, Math.min(7, weapon.radius || 5)),
      range: Math.min(900, weapon.range || 650),
      knockback: Math.max(120, weapon.knockback || 170),
      color: "purple"
    });
    projectile.weaponId = `echo_${weaponId}`;
    projectile.hitPadding = Math.max(3, weapon.hitPadding || 4);
    state.projectiles[projectile.id] = projectile;
  }
  pushVisualEffect(state, {
    type: "anomalyLine",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    x2: Math.round(enemy.x + Math.cos(baseAngle) * 44),
    y2: Math.round(enemy.y + Math.sin(baseAngle) * 44),
    color: "#b45cff",
    life: 0.08,
    maxLife: 0.08
  });
}

export function updateEchoEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.echo || {};
  const rt = runtime(enemy);
  const toTarget = norm(target.x - enemy.x, target.y - enemy.y);
  const tangent = { x: -toTarget.y * (rt.strafeSide || 1), y: toTarget.x * (rt.strafeSide || 1) };
  const d = Math.max(1, Math.hypot(target.x - enemy.x, target.y - enemy.y));
  if (d < 120) rt.strafeSide *= -1;
  const preferred = cfg.preferredRange || 260;
  const rangePush = Math.max(-1, Math.min(1, (d - preferred) / preferred));
  const speed = enemySpeed(state, enemy, data, updateCtx);
  const desiredX = (toTarget.x * rangePush + tangent.x * (cfg.strafe || 0.64)) * speed;
  const desiredY = (toTarget.y * rangePush + tangent.y * (cfg.strafe || 0.64)) * speed;
  const turn = 1 - Math.exp(-9 * dt);
  enemy.vx += (desiredX - enemy.vx) * turn;
  enemy.vy += (desiredY - enemy.vy) * turn;
  moveEnemyWithVelocity(enemy, geometry, dt);
  const now = state.time || 0;
  if ((rt.blurAt || 0) <= now) {
    rt.blurAt = now + (cfg.blurEvery || 0.08);
    pushVisualEffect(state, {
      type: "afterimage",
      x: Math.round(enemy.x - Math.sign(enemy.vx || 1) * 14),
      y: Math.round(enemy.y - Math.sign(enemy.vy || 1) * 14),
      angle: Math.atan2(enemy.vy || toTarget.y, enemy.vx || toTarget.x),
      life: 0.16,
      maxLife: 0.16,
      skin: "purple"
    });
  }
  fireEchoWeapon(state, enemy, target, targetWeaponId(target), cfg, rt);
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
