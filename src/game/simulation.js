import { PLAYER_ACCEL, PLAYER_FRICTION, PLAYER_HP, PLAYER_SPEED, WORLD } from "../core/constants.js";
import { clamp, norm, vecToAngle } from "../core/math.js";
import { updateEnemies, updateSpawner } from "./enemies.js";
import { updateLoot } from "./loot.js";
import { updateProjectiles } from "./projectiles.js";
import { updatePortals } from "./portals.js";
import { respawnPlayer } from "./state.js";

export function emptyInput() {
  return { left: false, right: false, up: false, down: false, aimAngle: 0, fire: false, px: null, py: null };
}

function smoothFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

export function movePlayer(player, input, dt) {
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

  player.x = clamp(player.x + (player.vx + (player.kx || 0)) * dt, player.radius, WORLD.w - player.radius);
  player.y = clamp(player.y + (player.vy + (player.ky || 0)) * dt, player.radius, WORLD.h - player.radius);
  if (Number.isFinite(input.aimAngle)) player.angle = input.aimAngle;
}

export function acceptClientPose(player, input, dt) {
  if (!Number.isFinite(input.px) || !Number.isFinite(input.py)) return;
  const maxDrift = 48 + PLAYER_SPEED * (player.stats?.speedMult || 1) * dt * 2.8;
  const dx = input.px - player.x;
  const dy = input.py - player.y;
  const d2 = dx * dx + dy * dy;
  if (d2 <= maxDrift * maxDrift) {
    player.x = clamp(input.px, player.radius, WORLD.w - player.radius);
    player.y = clamp(input.py, player.radius, WORLD.h - player.radius);
  }
}

export function updatePlayers(state, inputs, dt) {
  const ids = Object.keys(state.players).sort();
  for (const [index, id] of ids.entries()) {
    const player = state.players[id];
    const input = inputs[id] || emptyInput();

    if (player.hp <= 0) {
      player.deadTimer += dt;
      if (player.deadTimer >= 1.2) respawnPlayer(player, index);
      continue;
    }

    movePlayer(player, input, dt);
    if (id !== "p1") acceptClientPose(player, input, dt);
    if (player.hp <= 0) player.deadTimer = 0;
  }
}

export function updateHostWorld(state, inputs, dt) {
  const safeDt = Math.min(0.05, dt);
  state.time += safeDt;
  state.locationTime = (state.locationTime || 0) + safeDt;
  state.tick += 1;
  updatePlayers(state, inputs, safeDt);
  updateSpawner(state, safeDt);
  updateEnemies(state, safeDt);
  updateProjectiles(state, safeDt);
  updateLoot(state);
  updatePortals(state, safeDt);

  for (const p of Object.values(state.players)) {
    if (p.hp < -10) p.hp = 0;
    if (p.hp <= 0 && p.deadTimer === 0) p.deadTimer = 0.001;
    p.hp = clamp(p.hp, 0, PLAYER_HP);
  }
}

export function makeShootPayload(playerId, pose, weapon, fireSeq) {
  return {
    playerId,
    fireSeq,
    weapon,
    x: Math.round(pose.x),
    y: Math.round(pose.y),
    angle: pose.angle
  };
}

export function inputAimFromMouse(pose, worldMouse) {
  return vecToAngle(worldMouse.x - pose.x, worldMouse.y - pose.y);
}
