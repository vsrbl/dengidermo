import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateRoom } from '../shared/mapgen.v2-1.js';
import { buildSnapshot, createRun, startRoom } from '../shared/sim.v2-1.js';
import { normalizeRunSeed } from '../src/local.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:199|20[0-4])$/);
if (VERSION === 'v2.1.199') assert.equal(BUILD_ID, 'opening_choice_chests_seed_input');
assert.equal(PROTOCOL, 14);

const starterChests = plan => plan.interactables.filter(o => o?.firstRoomGuaranteed);
const starterBscChests = plan => plan.interactables.filter(o => o?.firstRoomGuaranteedBsc);
const plan = generateRoom(123456, 0, 0);
const starters = starterChests(plan);
assert.equal(starters.length, 2, 'first sector must add exactly two guaranteed choice chests');
for (const chest of starters) {
  assert.ok(['weapon_chest', 'ability_chest'].includes(chest.chest), 'starter chest is not a choice chest');
  assert.equal(chest.chestTier, 0, 'starter chest must use the minimum value tier');
  assert.equal(chest.slotCount, 2, 'starter chest must contain a real two-option choice');
  assert.equal(chest.costMul, 0.55, 'starter chest must use the minimum paid profile');
  assert.ok(Number.isFinite(chest.x) && Number.isFinite(chest.y), 'starter chest was not placed in the room');
}
const starterBsc = starterBscChests(plan);
assert.equal(starterBsc.length, ['v2.1.200', 'v2.1.201', 'v2.1.202', 'v2.1.203', 'v2.1.204'].includes(VERSION) ? 3 : 0, 'first sector BSC additive count is wrong');
for (const chest of starterBsc) {
  assert.equal(chest.chest, 'basic_chest');
  assert.equal(chest.chestTier, 0);
  assert.equal(chest.slotCount, 0);
  assert.equal(chest.costMul, 1);
}
const run = createRun(123456);
startRoom(run, new Map());
const starterObjects = buildSnapshot(run, new Map()).objects.filter(o => String(o?.[0] || '').startsWith('starter_choice_'));
assert.deepEqual(starterObjects.map(o => o[6]), [35, 35], 'starter choice chests are not at the minimum current price');

// Existing first-sector objects retain their v2.1.198 seeded layout. The two
// guaranteed chests are appended and use a separate seed stream.
assert.deepEqual(
  plan.interactables.filter(o => !o?.firstRoomGuaranteed && !o?.firstRoomGuaranteedBsc).map(o => [o.id, o.type, o.chest || '', o.x, o.y, o.chestTier ?? null, o.slotCount ?? null, o.costMul ?? null]),
  [
    ['c1', 'chest', 'basic_chest', 620, 843, 0, 0, 1],
    ['c2', 'chest', 'basic_chest', 324, 670, 0, 0, 1],
    ['c3', 'chest', 'ability_chest', 560, 667, 1, 2, 1],
    ['c4', 'chest', 'ability_chest', 185, 816, 0, 2, 1],
    ['b5', 'bet', '', 400, 386, null, null, null]
  ],
  'existing first-sector generation changed'
);
assert.equal(starterChests(generateRoom(123456 + 7919, 1, 0)).length, 0, 'starter chest rule leaked into later sectors');
assert.equal(starterBscChests(generateRoom(123456 + 7919, 1, 0)).length, 0, 'starter BSC rule leaked into later sectors');
assert.deepEqual(generateRoom(777, 0, 0), generateRoom(777, 0, 0), 'same seed no longer reproduces the opening sector');
const signatures = new Set(Array.from({ length: 32 }, (_, i) => starterChests(generateRoom(i + 1, 0, 0)).map(o => o.chest).join(',')));
assert.ok(signatures.size > 1, 'starter choice chest types are not seed-randomized');

assert.equal(normalizeRunSeed('', () => 0.25), 250000000, 'empty seed did not preserve random seed generation');
assert.equal(normalizeRunSeed('123456'), 123456);
assert.equal(normalizeRunSeed('4294967297'), 1, 'numeric seeds must normalize to uint32');
assert.equal(normalizeRunSeed('-1'), 0xffffffff);
assert.equal(normalizeRunSeed('terminal'), normalizeRunSeed('terminal'), 'text seed hash is not deterministic');
assert.notEqual(normalizeRunSeed('terminal'), normalizeRunSeed('casino'), 'different text seeds collapsed');

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fallback = fs.readFileSync(new URL('../404.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
const net = fs.readFileSync(new URL('../src/net.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
for (const html of [index, fallback]) assert.match(html, /id="seed-input"/);
assert.match(main, /startSolo\(playerName\(\), saveSkin\(\), menuSeed\(\)\)/);
assert.match(main, /const seedInput = menuSeed\(\);[\s\S]*createRoom\(seedInput\)/);
assert.match(net, /new LocalRoom\('SOLO',[\s\S]*seedInput\)/);
assert.match(net, /new LocalRoom\(m\.code,[\s\S]*this\._hostSeed\)/);
assert.match(i18n, /SEED \(ПУСТО = СЛУЧАЙНЫЙ\)/);
assert.match(i18n, /SEED \(EMPTY = RANDOM\)/);

console.log('v2.1.199 checks passed: additive starter choice chests, minimum profile, deterministic seed input, RU/EN menu flow');
