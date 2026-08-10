import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACTIVE_CORES, ENEMIES } from '../shared/data.v2-1.js';
import {
  buildSnapshot,
  createPlayer,
  createRun,
  damageEnemy,
  startRoom,
  staticStrikeProfile,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:19[5-9]|200)$/);
if (VERSION === 'v2.1.195') assert.equal(BUILD_ID, 'static_core_strike_spawn_immunity');
assert.equal(PROTOCOL, 14);

const enemy = (id, x, y, hp = 1000, spawnDelay = 0) => {
  const def = ENEMIES.grunt;
  return {
    id, kind: 'grunt', x, y, hp, maxHp: hp, size: def.size,
    spd: 0, dmg: 0, armor: 0, fireCd: 999, bulletSpd: 0,
    spawnDelay, state: 'move', st: 0
  };
};

// STATIC CORE once again adds its own non-cascading room storm.
{
  const p = createPlayer('core-owner', 'CORE OWNER', 0);
  p.stats.debtEngine = 2;
  const players = new Map([[p.id, p]]);
  const run = createRun(1951);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  const snap = buildSnapshot(run, players);
  assert.equal(run.staticRainStacks, 2);
  assert.deepEqual(run.staticRainSources, [{ id: 'debt_engine', level: 2 }]);
  assert.equal(run.staticRainCanSeedNext, false);
  assert.equal(snap.room.debtEngineRainStacks, 2);
  assert.equal(snap.room.staticCoreStormDisabled, 0);
}

// The contract cleansing prize clears stored debt and permanently silences the
// STATIC CORE source. New explicit debt remains legal after that cleansing.
{
  const p = createPlayer('cleansed-core', 'CLEANSED CORE', 0);
  p.stats.debtEngine = 3;
  const players = new Map([[p.id, p]]);
  const run = createRun(1952);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  run.staticDebt = 2;
  run.staticDebtSources = { cursed_chest: 2 };
  run.contractFavorsActive = [{ id: 'clear_debt', label: 'CLEAR STATIC STORM', tier: 'common', uses: 1, used: 0, persistent: 1 }];
  startRoom(run, players);
  assert.equal(run.staticCoreStormDisabled, true);
  assert.equal(run.staticRainStacks, 0);
  assert.deepEqual(run.staticRainSources, []);
  assert.equal(run.contractFavorsUsedThisRoom[0]?.coreCleared, 1);

  startRoom(run, players);
  assert.equal(run.staticRainStacks, 0, 'STATIC CORE storm returned after contract cleansing');
  run.staticDebt = 1;
  run.staticDebtSources = { casino_bet: 1 };
  startRoom(run, players);
  assert.equal(run.staticRainStacks, 1);
  assert.deepEqual(run.staticRainSources, [{ id: 'casino_bet', level: 1 }]);
}

// New ABL core: every level hits harder, recovers faster and has a wider diameter.
assert.ok(ACTIVE_CORES.static_strike);
const strikeProfiles = [1, 2, 3].map(staticStrikeProfile);
assert.ok(strikeProfiles[1].damage > strikeProfiles[0].damage);
assert.ok(strikeProfiles[2].damage > strikeProfiles[1].damage);
assert.ok(strikeProfiles[1].radius > strikeProfiles[0].radius);
assert.ok(strikeProfiles[2].radius > strikeProfiles[1].radius);
assert.ok(strikeProfiles[1].cooldownBase < strikeProfiles[0].cooldownBase);
assert.ok(strikeProfiles[2].cooldownBase < strikeProfiles[1].cooldownBase);
assert.equal(strikeProfiles[0].delay, 1.15);

// STATIC STRIKE lands at the cursor after the normal warning. It damages only
// materialized enemies; players inside the light-cyan area are never harmed.
{
  const p = createPlayer('strike-owner', 'STRIKE OWNER', 0);
  const ally = createPlayer('strike-ally', 'STRIKE ALLY', 1);
  const players = new Map([[p.id, p], [ally.id, ally]]);
  const run = createRun(1953);
  startRoom(run, players);
  run.plan.walls = [];
  run.plan.category = 'boss';
  run.director.pauseT = 999;
  const x = p.x + 360, y = p.y;
  p.aimX = x; p.aimY = y;
  ally.x = x; ally.y = y + 62;
  p.active = { core: 'static_strike', level: 1, mutations: [] };
  p.activeCd = 0;
  const live = enemy('strike-live', x - 22, y, 1000, 0);
  const staging = enemy('strike-staging', x + 24, y, 1000, 8);
  run.enemies = [live, staging];
  const liveHp = live.hp, stagingHp = staging.hp, ownerHp = p.hp, allyHp = ally.hp;

  p.wantActive = true;
  step(run, players, 1 / 60, 10);
  assert.equal(live.hp, liveHp);
  assert.equal(run.pendingActiveStrikes.length, 1);
  assert.ok(run.fx.some(f => f.t === 'rain_warn' && f.ally === 1 && f.active === 1));
  assert.ok(p.activeCd > 0 && p.activeCd <= strikeProfiles[0].cooldownBase);

  step(run, players, 1 / 60, 10 + strikeProfiles[0].delay + 0.01);
  assert.ok(live.hp < liveHp, 'friendly Static Storm did not hit the live enemy');
  assert.equal(staging.hp, stagingHp, 'friendly Static Storm hit an enemy still materializing');
  assert.equal(p.hp, ownerHp);
  assert.equal(ally.hp, allyHp);
  assert.ok(run.fx.some(f => f.t === 'rain_hit' && f.ally === 1 && f.active === 1));
}

// The central damage gate protects both armor and HP during spawn warning, then
// opens normally when spawnDelay reaches zero.
{
  const p = createPlayer('spawn-gate', 'SPAWN GATE', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1954);
  startRoom(run, players);
  const target = enemy('armored-staging', 800, 500, 500, 2);
  target.shellHp = 80;
  target.shellMax = 80;
  run.enemies = [target];
  damageEnemy(run, players, target, 100, p.id, 0, 0, 0, 'weapon');
  assert.equal(target.hp, 500);
  assert.equal(target.shellHp, 80);
  target.spawnDelay = 0;
  damageEnemy(run, players, target, 25, p.id, 0, 0, 0, 'weapon');
  assert.equal(target.shellHp, 55);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const audio = fs.readFileSync(new URL('../src/audio.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /function enemyCombatReady\(e\)/);
assert.match(sim, /if \(!enemyCombatReady\(e\)\) return 0/);
assert.match(data, /static_strike:[\s\S]*\+быстрее восстановление[\s\S]*\+диаметр/);
assert.match(effects, /f\.ally \? '#bdfbff' : '#b45cff'/);
assert.match(audio, /case 'rain_hit': this\.play\('static_storm'\)/);
assert.match(i18n, /STATIC STRIKE/);
assert.match(i18n, /СТАТИК-УДАР/);

console.log('v2.1.195 checks passed: STATIC CORE restored with contract silence, cursor storm active, spawn-phase immunity');
