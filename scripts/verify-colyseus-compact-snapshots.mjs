import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  buildServerSnapshot,
  compactCombatDiagnostics,
  compactEnemiesToEntities,
  compactProjectilesToEntities,
  isCompactCombatSnapshot
} from '../src/net/colyseusRuntime.js';
import { VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const pkg = readJson('package.json');
assert.equal(pkg.scripts?.['check:colyseus-compact-snapshots'], 'node scripts/verify-colyseus-compact-snapshots.mjs', 'root package must expose compact snapshot verifier');
assert.ok((pkg.scripts?.['check:all'] || '').includes('npm run check:colyseus-compact-snapshots'), 'check:all must include compact snapshot verifier');

const coreSource = read('server/authoritative/arenaCore.js');
assert.ok(coreSource.includes("COMPACT_COMBAT_SNAPSHOT_PROTOCOL = 'compact-combat-snapshot-v1'"), 'arena core must declare compact combat snapshot protocol');
assert.ok(coreSource.includes('function compactCombatSnapshot'), 'arena core must build compact combat snapshots');
const roomSource = read('server/colyseus/rooms/AuthoritativeArenaRoom.js');
assert.ok(roomSource.includes("this.broadcast('combatSnapshot', compactCombatSnapshot(this.arena))"), 'room must broadcast compact combat snapshots outside schema maps');
assert.ok(roomSource.includes('syncFastCombat: false'), 'room must avoid mutating enemy/projectile schema maps in the fast combat tick path');
assert.ok(roomSource.includes('colyseus-authoritative-combat-damage-v4'), 'room join protocol must advertise compact snapshot protocol');
const schemaSource = read('server/colyseus/schema.js');
assert.ok(schemaSource.includes('syncFastCombat = options.syncFastCombat !== false'), 'schema sync must make fast combat maps optional');
const clientSource = read('src/net/colyseusClient.js');
assert.ok(clientSource.includes("room.onMessage('combatSnapshot'"), 'client adapter must receive combatSnapshot messages');
const runtimeSource = read('src/net/colyseusRuntime.js');
assert.ok(runtimeSource.includes('compactCombatSnapshot: runtime.latestCombatSnapshot'), 'runtime must merge compact combat snapshots into renderer snapshots');
const uiSource = read('src/ui.js');
assert.ok(uiSource.includes('CMP${reconcile.compactEnemyCount'), 'HUD must expose compact snapshot entity diagnostics');

const core = require(path.join(root, 'server/authoritative/arenaCore.js'));
assert.equal(core.COMPACT_COMBAT_SNAPSHOT_PROTOCOL, 'compact-combat-snapshot-v1', 'core export must expose protocol');
const arena = core.createArenaState({ seed: 11, enemyCount: 1 });
core.addPlayer(arena, 'p1', { sessionId: 's1', name: 'CMP' });
core.applyInput(arena, 'p1', { seq: 1, shoot: true, aimX: 1, aimY: 0 });
core.stepArena(arena, core.FIXED_DT_MS);
const compact = core.compactCombatSnapshot(arena);
assert.equal(compact.protocol, 'compact-combat-snapshot-v1', 'server compact payload must carry protocol');
assert.equal(compact.counts.enemies, Object.keys(arena.enemies).length, 'compact payload enemy count must match arena');
assert.equal(compact.counts.projectiles, Object.keys(arena.projectiles).length, 'compact payload projectile count must match arena');
assert.ok(compact.byteEstimate > 0, 'compact payload must report approximate byte size');
assert.ok(Array.isArray(compact.enemies[0]), 'compact enemies must be array rows, not schema objects');

const authoredCompact = {
  protocol: 'compact-combat-snapshot-v1',
  tick: 77,
  timeMs: 1283,
  enemies: [['e-fast', 123, 456, 9, 18]],
  projectiles: [['b-fast', 10, 20, 333.3, -12.5, 'p1', 5]],
  counts: { enemies: 1, projectiles: 1 },
  byteEstimate: 111
};
assert.ok(isCompactCombatSnapshot(authoredCompact), 'runtime must validate compact combat snapshot shape');
assert.equal(compactCombatDiagnostics(authoredCompact).source, 'compact-message', 'diagnostics must identify compact-message source');
assert.equal(compactEnemiesToEntities(authoredCompact)[0].id, 'e-fast', 'runtime must decode compact enemy rows');
assert.equal(compactProjectilesToEntities(authoredCompact)[0].vx, 333.3, 'runtime must decode compact projectile velocity');

const fakeRoomState = {
  tick: 77,
  timeMs: 1283,
  players: new Map([['p1', { name: 'CMP', sessionId: 's1', x: 400, y: 300, hp: 100, maxHp: 100, angle: 0, online: true, lastInputSeq: 4, lastProcessedInputSeq: 4, serverTick: 77 }]]),
  enemies: new Map([['stale-schema-enemy', { x: 999, y: 999, hp: 40 }]]),
  projectiles: new Map([['stale-schema-projectile', { x: 999, y: 999, vx: 0, vy: 0, ownerId: 'p1' }]])
};
const rendererSnapshot = buildServerSnapshot(fakeRoomState, 'p1', { compactCombatSnapshot: authoredCompact });
assert.equal(rendererSnapshot.combatSnapshot.protocol, 'compact-combat-snapshot-v1', 'renderer snapshot must carry compact diagnostics');
assert.equal(rendererSnapshot.enemies[0].id, 'e-fast', 'compact enemies must override stale schema enemy maps');
assert.equal(rendererSnapshot.projectiles[0].id, 'b-fast', 'compact projectiles must override stale schema projectile maps');
assert.equal(rendererSnapshot.projectiles[0].ownerId, 'p1', 'compact projectile owner must survive decoding');

console.log(`Colyseus compact combat snapshot verification passed for ${VERSION}`);
