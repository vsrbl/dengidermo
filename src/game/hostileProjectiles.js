import { GREEN, RED } from "../core/constants.js";
import { norm, segmentCircleHitT } from "../core/math.js";
import { dealPlayerDamage } from "./effects.js";
import { hostileProjectileDamageTags } from "./damageSourceMatrix.js";
import { addSpark } from "./effectCommands.js";
import { firstSolidWallHitInState } from "./roomGeometry.js";
import { applyPlayerImpulse } from "./playerImpulse.js";

function addPlayerImpulse(state, player, fromX, fromY, force = 0, source = null) {
  if (!(force > 0)) return;
  const d = norm(player.x - fromX, player.y - fromY);
  applyPlayerImpulse(state, player, {
    x: d.x * force,
    y: d.y * force,
    sourceId: source?.ownerId || source?.enemyId || null,
    sourceType: "enemyProjectile",
    reason: "hostile_projectile_hit"
  });
}

function hostileProjectileHitPadding(projectile) {
  return Math.max(0, projectile.hitPadding ?? 3);
}

function projectileSparkColor(projectile) {
  return projectile.color === "red" ? RED : GREEN;
}

export function updateHostileProjectile(state, projectile, dt, runtime) {
  const { moveProjectileWithRoomHooks, handleWallOrEnd } = runtime;
  const { prevX, prevY } = moveProjectileWithRoomHooks(state, projectile, dt, ["projectile", "update", "enemy", "hostile"]);
  const wallHit = firstSolidWallHitInState(state, prevX, prevY, projectile.x, projectile.y, projectile.radius || 0);
  let remove = false;

  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    const hitRadius = (player.radius || 0) + (projectile.radius || 0) + hostileProjectileHitPadding(projectile);
    const hitT = segmentCircleHitT(prevX, prevY, projectile.x, projectile.y, player.x, player.y, hitRadius);
    if (hitT === null) continue;
    if (wallHit && wallHit.t <= hitT) continue;

    dealPlayerDamage(state, player, {
      amount: projectile.damage || 1,
      sourceId: projectile.ownerId || null,
      sourceType: "enemyProjectile",
      enemyId: projectile.enemyId || projectile.ownerId || null,
      tags: hostileProjectileDamageTags()
    });
    addPlayerImpulse(state, player, projectile.x, projectile.y, projectile.knockback || 0, projectile);
    addSpark(state, player.x, player.y, 3, 115, projectileSparkColor(projectile));
    remove = true;
    break;
  }

  if (!remove && wallHit) addSpark(state, wallHit.x, wallHit.y, 2, 90, projectileSparkColor(projectile));
  if (!remove) remove = handleWallOrEnd(state, projectile, wallHit);
  if (remove) delete state.projectiles[projectile.id];
}
