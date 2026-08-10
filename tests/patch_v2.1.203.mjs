import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACTIVE_MUTATIONS, ENEMIES } from '../shared/data.v2-1.js';
import { isEnemySpawnReachable } from '../shared/mapgen.v2-1.js';
import {
  buildSnapshot,
  captureEnemyAsProcess,
  controlledProcessDamageValue,
  createPlayer,
  createRun,
  damageControlledProcess,
  playerDamageValue,
  startRoom,
  stepProcessControllerState
} from '../shared/sim.v2-1.js';
import { P } from '../src/state.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.20[34]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.203' ? 'controlled_split_spawn_tab_build_dossier' : 'armor_spam_anchor_phase_cycle');
assert.equal(PROTOCOL, 14);

function aabbHit(x, y, half, wall) {
  return x + half > wall.x && x - half < wall.x + wall.w && y + half > wall.y && y - half < wall.y + wall.h;
}
function hostile(kind, id, x, y) {
  const def = ENEMIES[kind] || ENEMIES.grunt;
  return { id, kind, x, y, hp: def.hp, maxHp: def.hp, size: def.size, spawnDelay: 0, shellHp: 0, dirX: 1, dirY: 0 };
}

// Split children are relocated before entering the controller roster. They may
// not inherit a raw wall/overlap coordinate from their parent.
{
  const p = createPlayer('split-safe', 'SPLIT SAFE', 0, { hero: 'process_controller' });
  p.stats.ctrlCaptureTier = 4;
  p.x = 420; p.y = 520; p.aimX = 900; p.aimY = 520;
  const players = new Map([[p.id, p]]);
  const run = createRun(20301);
  startRoom(run, players);
  const wall = { x: 535, y: 410, w: 190, h: 230 };
  run.plan.walls = [wall];
  run.fx = [];
  const splitter = hostile('splitter', 'splitter-wall', 505, 520);
  run.enemies = [splitter];
  assert.equal(captureEnemyAsProcess(run, players, p, splitter, 'command'), true);
  const parent = p.processController.controlled[0];
  damageControlledProcess(run, p, parent, 999999, 0, 0, 'qa');
  const children = p.processController.controlled.filter(m => m.id !== parent.id && m.kind === 'splitter');
  assert.ok(children.length >= 2, 'splitter did not create allied children');
  for (const child of children) {
    assert.equal(child.controlledProcess, 1);
    assert.equal(run.plan.walls.some(w => aabbHit(child.x, child.y, child.size / 2 + 3, w)), false, 'child spawned in a wall');
    assert.equal(isEnemySpawnReachable(child, run.plan.walls, [p], child.size / 2), true, 'child spawned outside the player-reachable component');
  }

  // Legacy/corrupt coordinates are rescued once, without hostile red path-turn FX.
  const rescued = children[0];
  rescued.x = 610; rescued.y = 520; rescued._spawnValidated = 0;
  const target = hostile('tank', 'move-target', 900, 520);
  run.enemies = [target];
  run.fx = [];
  stepProcessControllerState(run, players, p, 1 / 60);
  assert.equal(run.plan.walls.some(w => aabbHit(rescued.x, rescued.y, rescued.size / 2 + 3, w)), false, 'runtime rescue left process in wall');
  assert.equal(run.fx.some(f => f.t === 'path_turn' && children.some(c => c.id === f.id)), false, 'controlled child emitted hostile path correction spam');
  const before = children.map(c => ({ id: c.id, x: c.x, y: c.y }));
  for (let i = 0; i < 45; i++) stepProcessControllerState(run, players, p, 1 / 60);
  assert.ok(children.some(c => {
    const old = before.find(x => x.id === c.id);
    return old && Math.hypot(c.x - old.x, c.y - old.y) > 5;
  }), 'all split children remained stationary after safe placement');
}

// One global damage path covers actives/dashes/R-owned damage, weapons and CTRL.
{
  const p = createPlayer('damage-audit', 'DAMAGE AUDIT', 0, { hero: 'process_controller' });
  p.stats.dmgMul = 1.5;
  p.stats.weaponDmgMul = 1.2;
  p.stats.ctrlPower = 0;
  p.wagerDmgMul = 1.4;
  p.tempDmgMul = 2;
  p.tempDmgMulT = 5;
  assert.ok(Math.abs(playerDamageValue(p, 10) - 42) < 1e-9, 'general player damage missed a global multiplier');
  assert.ok(Math.abs(controlledProcessDamageValue(p, 10) - 50.4) < 1e-9, 'controlled process missed global or weapon damage');
}

// TAB receives exact raw levels plus derived totals and uncapped mutation levels.
{
  const p = createPlayer('tab-build', 'TAB BUILD', 0);
  p.stats.dmgMul = 1.5;
  p.stats.weaponDmgMul = 1.2;
  p.stats.luck = 7;
  p.stats.bulletFire = 3;
  p.active = { core: 'black_box', level: 4, mutations: ['static', 'casino'], mutationLevels: { static: 12, casino: 1 } };
  const players = new Map([[p.id, p]]);
  const run = createRun(20302);
  startRoom(run, players);
  p.wagerDmgMul = 1.4;
  const row = buildSnapshot(run, players).players[0];
  const build = row[P.BUILD];
  assert.equal(build.stats.luck, 7);
  assert.equal(build.stats.bulletFire, 3);
  assert.ok(Math.abs(build.derived.damageMul - 2.1) < 1e-9);
  assert.ok(Math.abs(build.derived.weaponDamageMul - 2.52) < 1e-9);
  assert.equal(build.active.level, 4);
  assert.deepEqual(build.active.mutations, [{ id: 'static', level: 12 }, { id: 'casino', level: 1 }]);
  assert.ok(build.active.mutations.every(m => ACTIVE_MUTATIONS[m.id]));
}

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const page404 = fs.readFileSync(new URL('../404.html', import.meta.url), 'utf8');
const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
assert.match(index, /id="tab-build"/);
assert.match(page404, /id="tab-build"/);
assert.match(hud, /ВЕСЬ ИСХОДЯЩИЙ УРОН/);
assert.match(hud, /ALL OUTGOING DAMAGE/);
assert.match(hud, /Q \/ МУТАЦИИ/);
assert.match(hud, /Q \/ MUTATIONS/);
assert.match(css, /full build dossier without browser or panel scrollbars/);
assert.match(css, /#tab-panel \.panel \{[\s\S]*?overflow: hidden !important;/);
assert.doesNotMatch(sim, /run\.fx\.push\(\{ t: 'path_turn'/);
assert.doesNotMatch(sim, /\* p\.stats\.dmgMul/);

console.log('v2.1.203 checks passed: safe controlled splits, damage inheritance, complete compact TAB build dossier');
