import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import { generateRoom } from '../shared/mapgen.v2-1.js';
import {
  buildSnapshot,
  captureEnemyAsProcess,
  controlledHeraldSummon,
  createPlayer,
  createRun,
  damageControlledProcess,
  handleDevCommand,
  startRoom,
  step,
  stepProcessControllerState
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:20[0-9]|21[0-4])$/);
if (VERSION === 'v2.1.200') assert.equal(BUILD_ID, 'controller_inherited_slots_anchor_pressure');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

function controllerFixture(seed = 200) {
  const player = createPlayer(`ctrl-${seed}`, 'CTRL', 0, { hero: 'process_controller' });
  player.stats.ctrlCaptureTier = 4;
  const players = new Map([[player.id, player]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.plan.walls = [];
  run.fx = [];
  return { player, players, run };
}

function hostile(kind, id, x = 720, y = 620) {
  const def = ENEMIES[kind] || ENEMIES.grunt;
  return {
    id, kind, x, y,
    hp: def.hp, maxHp: def.hp, size: def.size,
    spawnDelay: 0, shellHp: 0, fireCd: def.fireCd || 0,
    dirX: 1, dirY: 0
  };
}

// Summons fill ordinary capacity first and create temporary slots only for overflow.
{
  const fx = controllerFixture(201);
  const herald = hostile('herald', 'herald');
  fx.run.enemies = [herald];
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, herald, 'command'), true);
  const ally = fx.player.processController.controlled[0];
  const target = hostile('tank', 'target', 980, 620);
  fx.run.enemies = [target];
  assert.equal(controlledHeraldSummon(fx.run, fx.player, fx.player.processController, ally, target, 0, () => 0), 2);
  const children = fx.player.processController.controlled.filter(m => m.id !== ally.id);
  assert.equal(children.filter(m => !m.bonusSlot).length, 1, 'free ordinary slot was skipped');
  assert.equal(children.filter(m => m.bonusSlot).length, 1, 'overflow summon did not receive a temporary slot');
  const hud = buildSnapshot(fx.run, fx.players).players[0].find(value => value?.hero === 'process_controller');
  assert.equal(hud.regular, 2);
  assert.equal(hud.temporary, 1);
  assert.equal(hud.processes.filter(m => m.bonus).length, 1);
}

// Controlled SHT gets +35% real projectile range and cannot shoot beyond it.
{
  const fx = controllerFixture(2011);
  const shooter = hostile('shooter', 'shooter', 500, 620);
  fx.run.enemies = [shooter];
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, shooter, 'command'), true);
  const ally = fx.player.processController.controlled[0];
  const target = hostile('tank', 'range-target', ally.x + 410, ally.y);
  fx.run.enemies = [target];
  ally.atkCd = 0;
  stepProcessControllerState(fx.run, fx.players, fx.player, 0.001);
  const shot = fx.run.bullets.find(b => b.kind === 'ctrl_shot');
  assert.ok(shot, 'controlled shooter did not use its extended base range');
  assert.ok(shot.maxDist >= 425, `controlled shooter range was not extended by 35%: ${shot.maxDist}`);
  fx.run.bullets = [];
  target.x = ally.x + shot.maxDist + (target.size || 24) + 30;
  ally.atkCd = 0;
  stepProcessControllerState(fx.run, fx.players, fx.player, 0.001);
  assert.equal(fx.run.bullets.some(b => b.kind === 'ctrl_shot'), false, 'controlled shooter fired beyond projectile reach');
}

// A controlled splitter frees its own slot, then keeps all allied fragments.
{
  const fx = controllerFixture(202);
  const splitter = hostile('splitter', 'splitter');
  const grunt = hostile('grunt', 'grunt', 760, 650);
  fx.run.enemies = [splitter, grunt];
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, splitter, 'command'), true);
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, grunt, 'command'), true);
  const ally = fx.player.processController.controlled.find(m => m.kind === 'splitter');
  damageControlledProcess(fx.run, fx.player, ally, 999999, 0, 0, 'qa');
  const fragments = fx.player.processController.controlled.filter(m => m.kind === 'splitter' && m.id !== ally.id);
  assert.ok(fragments.length >= 2);
  assert.equal(fragments.filter(m => !m.bonusSlot).length, 1);
  assert.equal(fragments.filter(m => m.bonusSlot).length, fragments.length - 1);
}

// Simultaneous splits share the same slot ledger; no sibling silently replaces another.
{
  const fx = controllerFixture(2021);
  const first = hostile('splitter', 'split-a');
  const second = hostile('splitter', 'split-b', 780, 650);
  fx.run.enemies = [first, second];
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, first, 'command'), true);
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, second, 'command'), true);
  for (const ally of fx.player.processController.controlled) ally.ttl = 0.001;
  stepProcessControllerState(fx.run, fx.players, fx.player, 0.01);
  const children = fx.player.processController.controlled.filter(m => m.kind === 'splitter' && m.splitStage === 1);
  assert.ok(children.length >= 4, 'simultaneous allied split children were dropped');
  assert.equal(children.filter(m => !m.bonusSlot).length, 2);
  assert.equal(children.filter(m => m.bonusSlot).length, children.length - 2);
}

// The splitting boss remains allied and its third fragment receives overflow capacity.
{
  const fx = controllerFixture(203);
  const chorus = hostile('boss_hunter_chorus', 'chorus');
  fx.run.enemies = [chorus];
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, chorus, 'command'), true);
  const ally = fx.player.processController.controlled[0];
  damageControlledProcess(fx.run, fx.player, ally, 999999, 0, 0, 'qa');
  const fragments = fx.player.processController.controlled.filter(m => m.bossFragmentParent === ally.id);
  assert.equal(fragments.length, 3);
  assert.equal(fragments.filter(m => !m.bonusSlot).length, 2);
  assert.equal(fragments.filter(m => m.bonusSlot).length, 1);
  assert.ok(fragments.every(m => m.alliedBoss && m.staticStormDisabled));
}

// Anchor Cashier starts the standard boss add director at full HP.
{
  const p = createPlayer('anchor-pressure', 'ANCHOR', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(204);
  startRoom(run, players);
  run.plan.category = 'boss';
  run.enemies = [];
  run.director.pauseT = 0;
  assert.equal(handleDevCommand(run, players, p, { action: 'spawn_boss', kind: 'boss_anchor_cashier' }), true);
  const boss = run.enemies.find(e => e.kind === 'boss_anchor_cashier');
  boss.backgroundAddCd = 999;
  assert.equal(boss.hp, boss.maxHp);
  step(run, players, 1 / 60, 1);
  assert.ok(run.enemies.some(e => e !== boss && e.packRole !== 'boss_background'), 'full-HP Anchor Cashier did not receive its boss add pack');
}

// Three BSCs are purely additive to the opening room and never leak later.
{
  for (let seed = 1; seed <= 128; seed++) {
    const opening = generateRoom(seed, 0, 0);
    const starterBsc = opening.interactables.filter(o => o.firstRoomGuaranteedBsc);
    assert.equal(starterBsc.length, 3, `opening BSC count changed for seed ${seed}`);
    assert.ok(starterBsc.every(o => o.chest === 'basic_chest' && Number.isFinite(o.x) && Number.isFinite(o.y)));
    assert.equal(generateRoom(seed, 1, 0).interactables.some(o => o.firstRoomGuaranteedBsc), false);
  }
}

const hudSource = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
assert.match(hudSource, /pc-life-chip filled temporary/);
assert.match(hudSource, /controller-temporary-slots/);
assert.match(css, /pc-life-grid-temporary/);
assert.match(css, /pc-life-chip\.temporary/);

console.log('v2.1.200 checks passed: allied child slots, temporary HUD rows, full-HP Anchor pressure, three additive opening BSC chests');
