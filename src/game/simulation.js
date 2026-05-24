import { PLAYER_ACCEL, PLAYER_FRICTION, PLAYER_HP, PLAYER_SPEED, WORLD } from "../core/constants.js";
import { clamp, norm, vecToAngle } from "../core/math.js";
import { moveCircleInLocation, roomGeometrySnapshot } from "./roomGeometry.js";
import { currentLocation } from "./roomFlow.js";
import { updateEnemies, updateSpawner } from "./enemies.js";
import { updateLoot } from "./loot.js";
import { updateInteractables } from "./interactables.js";
import { updateRewardPickups } from "./rewardPickups.js";
import { updateEconomyPickups } from "./economyPickups.js";
import { updateProjectiles } from "./projectiles.js";
import { updateCompanions } from "./companions.js";
import { updatePortals } from "./portals.js";
import { respawnPlayer } from "./state.js";
import { tickPlayerEffects } from "./effects.js";
import { tickActiveAbilities } from "./abilities.js";
import { applyDevPlayerGuards, tickDevMode } from "./dev.js";
import { syncAllPlayerStatSnapshots } from "./statSnapshots.js";
import { tickVisualEffects } from "./visualEffects.js";

export function emptyInput() {
  return { left: false, right: false, up: false, down: false, aimAngle: 0, fire: false };
}

function smoothFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

export function movePlayer(player, input, dt, loc = null) {
  const xAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const yAxis = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const d = norm(xAxis, yAxis);
  const moving = xAxis || yAxis;
  const speed = PLAYER_SPEED * (player.stats?.speedMult || 1);
  const targetVx = moving ? d.x * speed : 0;
  const targetVy = moving ? d.y * speed : 0;
  const t = smoothFactor(moving ? PLAYER_ACCEL : PLAYER_FRICTION, dt);

  player.vx += (targetVx - player.vx) * t;
  player.vy += (targetVy - player.vy) * t;
  player.kx = (player.kx || 0) * Math.exp(-12 * dt);
  player.ky = (player.ky || 0) * Math.exp(-12 * dt);

  const dx = (player.vx + (player.kx || 0)) * dt;
  const dy = (player.vy + (player.ky || 0)) * dt;
  if (loc) {
    const moved = moveCircleInLocation(roomGeometrySnapshot(loc), player.x, player.y, dx, dy, player.radius);
    player.x = moved.x;
    player.y = moved.y;
    if (moved.hitX) player.vx = 0;
    if (moved.hitY) player.vy = 0;
  } else {
    player.x = clamp(player.x + dx, player.radius, WORLD.w - player.radius);
    player.y = clamp(player.y + dy, player.radius, WORLD.h - player.radius);
  }
  if (Number.isFinite(input.aimAngle)) player.angle = input.aimAngle;
}

function bool(value) {
  return value === true;
}

export function normalizeHostInput(raw = {}) {
  const input = emptyInput();
  input.left = bool(raw.left);
  input.right = bool(raw.right);
  input.up = bool(raw.up);
  input.down = bool(raw.down);
  input.fire = bool(raw.fire);
  input.aimAngle = Number.isFinite(raw.aimAngle) ? raw.aimAngle : 0;
  return input;
}

export function updatePlayers(state, inputs, dt) {
  const ids = Object.keys(state.players).sort();
  const loc = currentLocation(state);
  for (const [index, id] of ids.entries()) {
    const player = state.players[id];
    const input = normalizeHostInput(inputs[id]);

    if (player.hp <= 0) {
      player.deadTimer += dt;
      if (player.deadTimer >= 1.2) respawnPlayer(player, index, loc);
      continue;
    }

    movePlayer(player, input, dt, loc);
    if (player.hp <= 0) player.deadTimer = 0;
  }
}

export function updateHostWorld(state, inputs, dt) {
  const safeDt = Math.min(0.05, dt);
  state.time += safeDt;
  state.locationTime = (state.locationTime || 0) + safeDt;
  state.tick += 1;
  tickDevMode(state, safeDt);
  for (const p of Object.values(state.players)) {
    tickPlayerEffects(p, safeDt, state);
    tickActiveAbilities(p, safeDt);
  }
  updatePlayers(state, inputs, safeDt);
  updateSpawner(state, safeDt);
  updateEnemies(state, safeDt);
  updateCompanions(state, safeDt);
  updateProjectiles(state, safeDt);
  updateInteractables(state, safeDt);
  updateRewardPickups(state, safeDt);
  updateEconomyPickups(state, safeDt);
  updateLoot(state, safeDt);
  updatePortals(state, safeDt);
  tickVisualEffects(state, safeDt);
  applyDevPlayerGuards(state);

  for (const p of Object.values(state.players)) {
    if (p.hp < -10) p.hp = 0;
    if (p.hp <= 0 && p.deadTimer === 0) p.deadTimer = 0.001;
    p.hp = clamp(p.hp, 0, p.maxHp || PLAYER_HP);
  }
  syncAllPlayerStatSnapshots(state);
}

export function makeShootPayload(playerId, pose, weapon, fireSeq) {
  return {
    playerId,
    fireSeq,
    weapon,
    angle: pose.angle
  };
}

export function inputAimFromMouse(pose, worldMouse) {
  return vecToAngle(worldMouse.x - pose.x, worldMouse.y - pose.y);
}
