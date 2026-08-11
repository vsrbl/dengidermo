import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import { createPlayer, createRun, startRoom, step } from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:19[7-9]|20[0-8])$/);
if (VERSION === 'v2.1.197') assert.equal(BUILD_ID, 'field_snap_pull_visual_only_hotfix');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

const p = createPlayer('snap-visual197', 'SNAP VISUAL', 0);
const players = new Map([[p.id, p]]);
const run = createRun(1970);
run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
startRoom(run, players);
run.plan.walls = [];
run.director.pauseT = 999;
p.active = { core: 'field_snap', level: 3, mutations: [] };
p.activeCd = 0;

const def = ENEMIES.grunt;
const target = {
  id: 'snap-target', kind: 'grunt', x: p.x + 170, y: p.y,
  hp: 900, maxHp: 900, size: def.size, spd: def.spd, dmg: def.dmg,
  armor: 0, fireCd: 0, spawnDelay: 0, state: 'move', st: 0
};
run.enemies = [target];
p.wantActive = true;
step(run, players, 1 / 60, 1);

assert.ok(run.fx.some(f => f.t === 'active' && String(f.label || '').includes('FIELD SNAP')), 'one-shot pull animation was removed');
assert.ok(run.activeFields.some(f => f.kind === 'snap_field'), 'FIELD SNAP utility field was removed');

run.fx = [];
for (let i = 0; i < 12; i++) step(run, players, 1 / 60, 2 + i / 60);
assert.ok(run.activeFields.some(f => f.kind === 'snap_field'), 'FIELD SNAP utility field did not persist');
assert.ok((target.activeSlowT || 0) > 0, 'invisible FIELD SNAP utility stopped controlling enemies');
assert.equal(run.fx.filter(f => f.t === 'active_field' && f.kind === 'snap_field').length, 0, 'lingering FIELD SNAP animation still appears around the hero');

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /else if \(f\.kind !== 'snap_field'\) run\.fx\.push/);

console.log('v2.1.197 checks passed: one-shot FIELD SNAP pull visual, invisible lingering utility');
