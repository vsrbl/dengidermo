import { WORLD } from "../core/constants.js";
import { EFFECT_HOOKS } from "./effects.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "./roomModifiers.js";
import {
  applyProjectileWallPosition,
  resolveProjectileWallEnd,
  resolveRicochetCommands
} from "./projectileBehaviors.js";

export function handleWallOrEnd(state, projectile, wallHit = null, context = {}) {
  const wallState = resolveProjectileWallEnd(projectile, wallHit, WORLD);
  if (!wallState.shouldEnd) return false;

  if (wallState.out || wallState.hitWall) {
    applyProjectileWallPosition(projectile, wallState);
    const wallCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PROJECTILE_WALL, {
      projectile,
      weaponId: projectile.weaponId || null,
      ownerType: projectile.ownerType || "player",
      position: wallState.position,
      normal: wallState.normal,
      wallId: wallHit?.wall?.id || null,
      outX: wallState.hookOutX,
      outY: wallState.hookOutY,
      didRicochet: false,
      tags: ["projectile", "wall", projectile.ownerType || "player"]
    });

    const ctx = context.runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_WALL, {
      position: wallCtx.position,
      normal: wallCtx.normal,
      wallId: wallCtx.wallId,
      outX: wallCtx.outX,
      outY: wallCtx.outY,
      didRicochet: !!wallCtx.didRicochet,
      tags: wallCtx.tags || []
    }, {
      ricochet(effect, c) {
        return resolveRicochetCommands(effect, c);
      }
    });

    if (ctx.didRicochet) return false;
  }

  context.fireExpireEffects(state, projectile);
  return true;
}
