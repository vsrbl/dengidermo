import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  blackBoxRadiusForLevel,
  buildSnapshot,
  createPlayer,
  createRun,
  startRoom,
  staticStrikeHitsEnemy,
  staticStrikeProfile
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:20[1-9]|210)$/);
if (VERSION === 'v2.1.201') assert.equal(BUILD_ID, 'static_strike_install_storm_clarity');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

// STATIC STRIKE level I is exactly 1.5x tighter than the previous 88px
// gameplay radius, while later levels still grow.
const strike = [1, 2, 3].map(staticStrikeProfile);
assert.equal(strike[0].radius, Math.round(88 / 1.5));
assert.ok(strike[1].radius > strike[0].radius);
assert.ok(strike[2].radius > strike[1].radius);

// The collision is inclusive circle-to-body contact: exact edge and a point
// just inside hit, while a point just outside does not.
const edgeEnemy = { id: 'edge', kind: 'grunt', x: 0, y: 0, hp: 100, size: 24, spawnDelay: 0 };
const hit = { x: 100, y: 100, r: strike[0].radius };
edgeEnemy.x = hit.x + hit.r + edgeEnemy.size / 2;
edgeEnemy.y = hit.y;
assert.equal(staticStrikeHitsEnemy(hit, edgeEnemy), true);
edgeEnemy.x -= 0.01;
assert.equal(staticStrikeHitsEnemy(hit, edgeEnemy), true);
edgeEnemy.x += 0.02;
assert.equal(staticStrikeHitsEnemy(hit, edgeEnemy), false);
edgeEnemy.x = hit.x;
edgeEnemy.spawnDelay = 1;
assert.equal(staticStrikeHitsEnemy(hit, edgeEnemy), false);

// BLACK BOX upgrades make the detection footprint smaller, not larger.
const box = [1, 2, 3].map(blackBoxRadiusForLevel);
assert.ok(box[1] < box[0]);
assert.ok(box[2] < box[1]);

// Debt/Core storms stay out of the real modifier list. The forecast keeps its
// exact sources, while a genuine room modifier remains visible as a modifier.
const p = createPlayer('storm-ui', 'STORM UI', 0);
const players = new Map([[p.id, p]]);
const run = createRun(2011);
run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
run.staticDebt = 2;
run.staticDebtSources = { cursed_chest: 2 };
startRoom(run, players);
let snap = buildSnapshot(run, players);
assert.ok(run.plan.modifierIds.includes('static_rain'), 'runtime storm tag missing');
assert.ok(!snap.room.mods.includes('static_rain'), 'debt storm leaked into player-facing modifiers');

run.staticDebt = 2;
run.staticDebtSources = { cursed_chest: 2 };
run.nextRoomPreview = { id: 'forecast', cat: 'grid', special: '', archetype: 'standard', mods: [], quota: 10 };
snap = buildSnapshot(run, players);
assert.ok(!snap.room.next.mods.includes('static_rain'));
assert.equal(snap.room.next.staticRainBreakdown.total, 2);
assert.deepEqual(snap.room.next.staticRainBreakdown.sources, [{ id: 'cursed_chest', level: 2 }]);

run.nextRoomPreview.mods = ['static_rain'];
snap = buildSnapshot(run, players);
assert.ok(snap.room.next.mods.includes('static_rain'));
assert.equal(snap.room.next.staticRainBreakdown.total, 3);
assert.ok(snap.room.next.staticRainBreakdown.sources.some(s => s.id === 'room_modifier' && s.level === 1));

p.stats.debtEngine = 1;
run.nextRoomPreview = { id: 'boss-forecast', cat: 'boss', special: '', archetype: 'boss', mods: [], quota: 1 };
snap = buildSnapshot(run, players);
assert.equal(snap.room.next.staticRainBreakdown.total, 1);
assert.ok(snap.room.next.staticRainBreakdown.sources.some(s => s.id === 'debt_engine' && s.level === 1));
assert.equal(snap.room.next.staticRainBreakdown.banked, 2);
assert.deepEqual(snap.room.next.staticRainBreakdown.bankedSources, [{ id: 'cursed_chest', level: 2 }]);
assert.equal(snap.room.next.staticRainBreakdown.deferredCore, 0);

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
assert.match(hud, /ШТОРМ СЛЕД\. СЕКТОРА/);
assert.match(hud, /СТАТИК В ЗАПАСЕ/);
assert.match(hud, /СТАТИК-ЯДРО НА ПАУЗЕ/);
assert.match(effects, /staticStrikeFlash/);
assert.doesNotMatch(effects, /f\.active && f\.ally[^\n]*kind: 'strike'/);
assert.match(css, /\.install-next-static-sources/);
assert.match(data, /−радиус обнаружения/);

console.log('v2.1.201 checks passed: exact Static Strike edge, no residual field, separated storm forecast, shrinking Black Box');
