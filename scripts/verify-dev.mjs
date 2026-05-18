import assert from "node:assert/strict";
import { readDevConfig } from "../src/dev/mode.js";
import { createGameState, addPlayer, makeSnapshot } from "../src/game/state.js";
import { applyDevCommand, applyDevPlayerGuards, areDevSpawnsPaused, devEnemyDamageMult, devEnemySpeedMult, hasDevMode } from "../src/game/dev.js";
import { spawnEnemy, updateSpawner } from "../src/game/enemies.js";
import { updateHostWorld, emptyInput } from "../src/game/simulation.js";

function makeDevState(room = "DEVTEST") {
  const config = readDevConfig(`https://nncckkrr.space/#dev=void-v33-test&calm=1`);
  const state = createGameState(room, { dev: config });
  addPlayer(state, "p1", 0);
  return state;
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

run("secret token gates dev mode", () => {
  assert.equal(readDevConfig("https://nncckkrr.space/").enabled, false);
  assert.equal(readDevConfig("https://nncckkrr.space/#dev=wrong").enabled, false);
  const cfg = readDevConfig("https://nncckkrr.space/#dev=void-v33-test&calm=1&god=1");
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.calm, true);
  assert.equal(cfg.god, true);
});

run("normal game state has no dev snapshot", () => {
  const state = createGameState("NORMAL");
  addPlayer(state, "p1", 0);
  assert.equal(hasDevMode(state), false);
  assert.equal(makeSnapshot(state).dev, null);
});

run("dev state is host-owned and visible in snapshot only as status", () => {
  const state = makeDevState();
  assert.equal(hasDevMode(state), true);
  const snap = makeSnapshot(state);
  assert.equal(snap.dev.enabled, true);
  assert.equal(snap.dev.calm, true);
  assert.equal(typeof snap.dev.god, "boolean");
  assert.equal("access" in snap.dev, false);
});

run("calm profile keeps a real but lower threat pressure phase", () => {
  const state = makeDevState();
  assert.ok(devEnemySpeedMult(state) > 0 && devEnemySpeedMult(state) < 1);
  assert.ok(devEnemyDamageMult(state) > 0 && devEnemyDamageMult(state) < 1);
  state.locationTime = 1.0;
  for (let i = 0; i < 24; i += 1) {
    state.spawnTimer = 0;
    updateSpawner(state, 0.2);
  }
  const count = Object.keys(state.enemies).length;
  assert.ok(count >= 1, `expected enemies, got ${count}`);
  assert.ok(count <= 10, `calm cap exceeded: ${count}`);
  assert.equal(state.director.phase, "pressure");
});

run("spawn pause stops new enemies without freezing the world", () => {
  const state = makeDevState();
  applyDevCommand(state, "toggle-spawns");
  assert.equal(areDevSpawnsPaused(state), true);
  state.locationTime = 1.0;
  state.spawnTimer = 0;
  updateSpawner(state, 1);
  assert.equal(Object.keys(state.enemies).length, 0);
  state.time += 1;
  assert.equal(state.time, 1);
});

run("clear-hostiles removes enemies and projectiles only", () => {
  const state = makeDevState();
  spawnEnemy(state, "grunt", 200, 200);
  state.projectiles.px = { id: "px" };
  state.loot.l1 = { id: "l1", kind: "heal", x: 1, y: 1 };
  assert.ok(Object.keys(state.enemies).length > 0);
  assert.ok(Object.keys(state.projectiles).length > 0);
  applyDevCommand(state, "clear-hostiles");
  assert.equal(Object.keys(state.enemies).length, 0);
  assert.equal(Object.keys(state.projectiles).length, 0);
  assert.equal(Object.keys(state.loot).length, 1);
});

run("god mode is explicit and protects players only when enabled", () => {
  const state = makeDevState();
  const player = state.players.p1;
  player.hp = -5;
  applyDevPlayerGuards(state);
  assert.equal(player.hp, -5);
  applyDevCommand(state, "toggle-god");
  applyDevPlayerGuards(state);
  assert.equal(player.hp, 1);
});

run("dev commands are ignored on non-dev state", () => {
  const state = createGameState("NODEV");
  addPlayer(state, "p1", 0);
  spawnEnemy(state, "grunt", 200, 200);
  assert.equal(applyDevCommand(state, "clear-hostiles"), false);
  assert.equal(Object.keys(state.enemies).length, 1);
});

run("ready-portal keeps game flow intact", () => {
  const state = makeDevState();
  state.locationTime = 0.25;
  assert.ok(state.portalReadyAt > state.locationTime);
  applyDevCommand(state, "ready-portal");
  assert.ok(state.portalReadyAt <= state.locationTime);
});

run("host simulation survives dev mode toggles", () => {
  const state = makeDevState();
  applyDevCommand(state, "toggle-god");
  applyDevCommand(state, "toggle-spawns");
  for (let i = 0; i < 30; i += 1) updateHostWorld(state, { p1: emptyInput() }, 1 / 30);
  assert.ok(Number.isFinite(state.time));
  assert.equal(state.players.p1.hp >= 1, true);
  assert.equal(makeSnapshot(state).dev.enabled, true);
});

console.log("All 10 dev checks passed");
