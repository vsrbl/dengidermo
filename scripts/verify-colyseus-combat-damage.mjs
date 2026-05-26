import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  buildServerSnapshot,
  compactCombatDiagnostics,
  compactPickupsToEconomyPickups,
  isCompactCombatSnapshot,
  sampleRemoteInterpolation
} from '../src/net/colyseusRuntime.js';
import { VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const pkg = readJson('package.json');
assert.equal(pkg.scripts?.['check:colyseus-combat-damage'], 'node scripts/verify-colyseus-combat-damage.mjs', 'root package must expose combat damage verifier');
assert.ok((pkg.scripts?.['check:all'] || '').includes('npm run check:colyseus-combat-damage'), 'check:all must include combat damage verifier');

const coreSource = read('server/authoritative/arenaCore.js');
assert.ok(coreSource.includes("authority: 'server-owned-combat-damage-v1'"), 'compact combat snapshot must advertise server-owned combat authority');
assert.ok(coreSource.includes('function damageEnemy'), 'arena core must use a server-owned enemy damage function');
assert.ok(coreSource.includes('function killEnemy'), 'arena core must use a server-owned enemy death function');
assert.ok(coreSource.includes('function damagePlayer'), 'arena core must use a server-owned player damage function');
assert.ok(coreSource.includes('function spawnCombatPickup'), 'arena core must spawn combat pickups on the server');
assert.ok(coreSource.includes('stepEnemyContactDamage(state)'), 'fixed server tick must apply enemy contact damage server-side');
assert.ok(coreSource.includes('stepPickups(state, boundedDtMs)'), 'fixed server tick must own pickup lifetime server-side');

const roomSource = read('server/colyseus/rooms/AuthoritativeArenaRoom.js');
assert.ok(roomSource.includes('colyseus-authoritative-combat-damage-v4'), 'room join protocol must advertise combat damage protocol');
assert.ok(roomSource.includes("this.broadcast('combatSnapshot', compactCombatSnapshot(this.arena))"), 'room must broadcast authoritative combat snapshots');
const mainServerSource = read('server/mainServer.js');
assert.ok(mainServerSource.includes("const COLYSEUS_PROTOCOL = 'colyseus-authoritative-combat-damage-v4'"), 'health must advertise combat damage protocol');

const runtimeSource = read('src/net/colyseusRuntime.js');
assert.ok(runtimeSource.includes('compactPickupsToEconomyPickups'), 'runtime must decode server-owned compact pickups');
assert.ok(runtimeSource.includes('server-owned-combat-damage-v1'), 'runtime diagnostics must identify server-owned combat authority');
assert.ok(runtimeSource.includes('base.economyPickups = interpolateEntityList'), 'remote interpolation must carry server-owned pickups');
const uiSource = read('src/ui.js');
assert.ok(uiSource.includes('compactPickupCount'), 'HUD must expose compact pickup count');
assert.ok(uiSource.includes('serverEnemyHits'), 'HUD must expose server damage counters');

const core = require(path.join(root, 'server/authoritative/arenaCore.js'));
const arena = core.createArenaState({ seed: 410, enemyCount: 0 });
const player = core.addPlayer(arena, 'p1', { sessionId: 's1', name: 'DMG', x: 400, y: 300 });
arena.enemies.e1 = { id: 'e1', x: player.x + 40, y: player.y, hp: 20, maxHp: 20, radius: 18, lastTouchMsByPlayer: {} };

core.applyInput(arena, 'p1', { seq: 1, shoot: true, aimX: 1, aimY: 0 });
core.stepArena(arena, core.FIXED_DT_MS);
assert.equal(arena.metrics.enemyHits, 1, 'server projectile must damage enemy inside the fixed tick');
assert.equal(arena.metrics.enemyKills, 1, 'server projectile damage must route through enemy death');
assert.equal(arena.enemies.e1, undefined, 'dead enemy must be removed only by server kill pipeline');
assert.equal(Object.keys(arena.pickups).length, 2, 'enemy death must spawn basic server-owned money/xp pickups');
assert.equal(arena.metrics.pickupsSpawned, 2, 'pickup spawn metric must count server-owned drops');
assert.ok(arena.combatEvents.some((event) => event.type === 'enemy_killed'), 'combat events must include enemy_killed');
assert.ok(arena.combatEvents.some((event) => event.type === 'pickup_spawned'), 'combat events must include pickup_spawned');

const compact = core.compactCombatSnapshot(arena);
assert.ok(isCompactCombatSnapshot(compact), 'compact payload must still validate after adding pickups and combat diagnostics');
assert.equal(compact.combat.authority, 'server-owned-combat-damage-v1', 'compact payload must mark server-owned combat authority');
assert.equal(compact.counts.pickups, 2, 'compact payload must include pickup count');
assert.equal(compact.pickups.length, 2, 'compact payload must include pickup rows');
assert.equal(compactCombatDiagnostics(compact).enemyKills, 1, 'runtime diagnostics must decode enemy kill count');
assert.equal(compactCombatDiagnostics(compact).pickupCount, 2, 'runtime diagnostics must decode pickup count');
const decodedPickups = compactPickupsToEconomyPickups(compact);
assert.equal(decodedPickups.length, 2, 'runtime must convert compact pickup rows to economyPickups');
assert.ok(decodedPickups.some((pickup) => pickup.type === 'money'), 'money pickup must survive compact decoding');
assert.ok(decodedPickups.some((pickup) => pickup.type === 'xp'), 'xp pickup must survive compact decoding');

const fakeRoomState = {
  tick: compact.tick,
  timeMs: compact.timeMs,
  players: new Map([['p1', { name: 'DMG', sessionId: 's1', x: player.x, y: player.y, hp: player.hp, maxHp: 100, angle: 0, online: true, lastInputSeq: 1, lastProcessedInputSeq: 1, serverTick: compact.tick }]]),
  enemies: new Map(),
  projectiles: new Map()
};
const rendererSnapshot = buildServerSnapshot(fakeRoomState, 'p1', { compactCombatSnapshot: compact });
assert.equal(rendererSnapshot.economyPickups.length, 2, 'renderer snapshot must expose server-owned pickups');
assert.equal(rendererSnapshot.combatSnapshot.damageAuthority, 'server-owned-combat-damage-v1', 'renderer snapshot must expose combat authority diagnostics');
const sampled = sampleRemoteInterpolation([
  { tick: 1, time: 1, receivedAt: 1000, snapshot: rendererSnapshot },
  { tick: 2, time: 2, receivedAt: 1100, snapshot: { ...rendererSnapshot, tick: rendererSnapshot.tick + 1, time: rendererSnapshot.time + 0.016 } }
], 1050, 'p1', null);
assert.equal(sampled.economyPickups.length, 2, 'remote interpolation must preserve server-owned pickups');

const contactArena = core.createArenaState({ seed: 411, enemyCount: 0 });
const contactPlayer = core.addPlayer(contactArena, 'p1', { sessionId: 's1', name: 'TOUCH', x: 500, y: 500 });
contactArena.enemies.eTouch = { id: 'eTouch', x: 500, y: 500, hp: 40, maxHp: 40, radius: 18, lastTouchMsByPlayer: {} };
const hpBefore = contactPlayer.hp;
core.stepArena(contactArena, core.FIXED_DT_MS);
assert.ok(contactPlayer.hp < hpBefore, 'enemy contact must damage player on the authoritative server tick');
assert.equal(contactArena.metrics.playerHits, 1, 'player damage metric must count enemy contact hits');
const afterFirstTouchHp = contactPlayer.hp;
core.stepArena(contactArena, core.FIXED_DT_MS);
assert.equal(contactPlayer.hp, afterFirstTouchHp, 'enemy contact damage must respect server-owned cooldown');

console.log(`Colyseus server-owned combat/damage verification passed for ${VERSION}`);
