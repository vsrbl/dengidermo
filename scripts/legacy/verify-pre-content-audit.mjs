import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ROOM_LAYOUTS } from '../src/data/layouts.js';
import { RARE_ROOM_RULES } from '../src/game/runPlanner.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.ok(ROOM_SEQUENCE.length === 4, 'pre-content baseline should keep 4-room sequence');
assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'baseline room cadence must remain unchanged');
for (const room of ROOM_SEQUENCE) {
  assert.equal(room.layout, 'open_arena', `baseline room must not enable wall layouts yet: ${room.id}`);
  assert.ok(Array.isArray(room.modifiers), `room must keep explicit modifier identity list: ${room.id}`);
}
assert.equal(RARE_ROOM_RULES.length, 0, 'rare room rules must stay disabled before v39 content');
assert.equal((ROOM_LAYOUTS.open_arena.walls || []).length, 0, 'open_arena must remain wall-free baseline');
assert.equal((ROOM_LAYOUTS.open_arena.spawnAnchors || []).length, 0, 'open_arena must keep fallback spawn path for baseline');
assert.ok((ROOM_LAYOUTS.twin_pillars?.tags || []).includes('future'), 'wall layout twin_pillars must remain future-tagged');
assert.ok((ROOM_LAYOUTS.split_lanes?.tags || []).includes('future'), 'wall layout split_lanes must remain future-tagged');

for (const [id, modifier] of Object.entries(ROOM_MODIFIERS)) {
  assert.equal(modifier.category, 'identity', `room modifier must remain identity-only before v39: ${id}`);
  assert.deepEqual(Object.keys(modifier.hooks || {}), [], `room modifier hooks must stay empty before v39: ${id}`);
}

const constants = read('src/core/constants.js');
assert.ok(!/export\s+const\s+START_WEAPON\b/.test(constants), 'START_WEAPON must not return to constants');
assert.ok(/export\s+const\s+START_WEAPON\s*=/.test(read('src/data/weapons.js')), 'START_WEAPON source of truth must remain data/weapons.js');

const transport = read('src/net/transport.js');
assert.ok(!transport.includes('Compatibility path'), 'transport must not reintroduce legacy compatibility fallback');
assert.ok(!transport.includes('pre-handshake'), 'transport must not mention pre-handshake fallback');
assert.ok(transport.includes('server_mismatch'), 'transport must keep explicit server mismatch path');
assert.ok(transport.includes('SERVER_HELLO_TIMEOUT_MS'), 'transport must keep bounded mandatory handshake timeout');

const clientRuntime = read('src/app/clientRuntime.js');
assert.ok(clientRuntime.includes('GEOMETRY MISMATCH / RELOAD'), 'geometry mismatch must be visible before wall content');
assert.ok(clientRuntime.includes('geometry_mismatch'), 'geometry mismatch state must be tracked explicitly');

const effectsBarrel = read('src/game/effects.js');
assert.ok(effectsBarrel.length < 1200, 'effects.js should remain a small public barrel after split');
assert.ok(effectsBarrel.includes('./effects/damage.js'), 'effects barrel must re-export damage pipeline');
assert.ok(effectsBarrel.includes('./effects/status.js'), 'effects barrel must re-export status pipeline');

const projectiles = read('src/game/projectiles.js');
assert.ok(projectiles.includes('dealDamage'), 'projectiles must keep damage through official pipeline');
assert.ok(projectiles.includes('finishEnemyKill'), 'projectiles must keep kills through official pipeline');
assert.ok(!/enemy\.hp\s*[-+]?=/.test(projectiles), 'projectiles must not directly mutate enemy hp');

const gameplayFiles = fs.readdirSync(path.join(root, 'src/game')).filter((file) => file.endsWith('.js'));
for (const file of gameplayFiles) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

for (const staleSuffix of ['38-13-7', '38-13-8', '38-14-1', '38-14-2', '38-14-3']) {
  assert.ok(!exists(`src/main.v${staleSuffix}.js`), `stale entry must not remain before content: v${staleSuffix}`);
}

console.log('pre-content audit passed: baseline content remains disabled and architecture guardrails are intact');
