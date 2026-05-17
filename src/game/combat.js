import { angleToVec, clamp } from "../core/math.js";
import { WORLD } from "../core/constants.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { makeProjectile } from "./projectiles.js";
import { pushEvent } from "./state.js";

function canFire(player, weapon, now) {
  return now + 0.018 >= player.nextFireAt && player.hp > 0 && weapon;
}

export function fireWeapon(state, playerId, payload = {}) {
  const player = state.players[playerId];
  if (!player) return false;

  const weaponId = WEAPONS[player.weapon] ? player.weapon : START_WEAPON;
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  if (!canFire(player, weapon, state.time)) return false;

  const originMax = 120;
  let x = Number.isFinite(payload.x) ? payload.x : player.x;
  let y = Number.isFinite(payload.y) ? payload.y : player.y;
  const dx = x - player.x;
  const dy = y - player.y;
  if (dx * dx + dy * dy > originMax * originMax) {
    x = player.x;
    y = player.y;
  }
  x = clamp(x, 0, WORLD.w);
  y = clamp(y, 0, WORLD.h);

  const angle = Number.isFinite(payload.angle) ? payload.angle : player.angle;
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
    state.projectiles[pelletId] = makeProjectile({
      id: pelletId,
      ownerId: playerId,
      weaponId,
      x: x + pelletDir.x * (player.radius + weapon.radius + 1),
      y: y + pelletDir.y * (player.radius + weapon.radius + 1),
      angle: pelletAngle,
      pelletIndex: i
    });
  }

  player.angle = angle;
  player.nextFireAt = state.time + 1 / weapon.fireRate;
  pushEvent(state, { type: "shoot", playerId, weaponId, x, y, angle, fireSeq: seq });
  return true;
}
