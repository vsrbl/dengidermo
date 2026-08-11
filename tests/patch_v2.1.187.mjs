import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, UPGRADES, WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import {
  activeCoreUsesPlacementTarget,
  alliedProjectileBlastChance,
  captureEnemyAsProcess,
  controlledFireBullet,
  controlledProcessDeathHealPercent,
  controlledProcessDeathHealValue,
  createPlayer,
  createRun,
  damageControlledProcess,
  expireControlledProcess,
  startRoom,
  step,
  stepProcessControllerState,
  weaponChoiceEligible,
  weaponRangeMultiplier
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:18[7-9]|19[0-9]|(?:20[0-9]|210))$/);
if (VERSION === 'v2.1.187') assert.equal(BUILD_ID, 'controller_boss_range_blast_sustain_rework');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

// Signal Spike now deploys at the cursor on the first Q; no radius-target state exists.
const qPlayer = createPlayer('q187', 'Q187', 0);
const qPlayers = new Map([[qPlayer.id, qPlayer]]);
const qRun = createRun(187);
startRoom(qRun, qPlayers);
qPlayer.active = { core: 'signal_spike', level: 1, mutations: [] };
qPlayer.aimX = qPlayer.x + 180;
qPlayer.aimY = qPlayer.y + 30;
qPlayer.wantActive = true;
step(qRun, qPlayers, 1 / 60, 1);
assert.equal(activeCoreUsesPlacementTarget('signal_spike'), false);
assert.equal(activeCoreUsesPlacementTarget('void_cut'), true);
assert.equal(qPlayer.activeTargeting, null);
assert.ok(qRun.activeFields.some(field => field.kind === 'signal_spike'));

// v2.1.187 shared BLAST with drones; v2.1.188 keeps only controlled-process inheritance
// and restores the dedicated DRONE BLAST gate.
const blastPlayer = createPlayer('blast187', 'BLAST', 0, { hero: 'process_controller' });
blastPlayer.stats.procBlast = 0.20;
assert.equal(alliedProjectileBlastChance(blastPlayer, 'drone'), VERSION === 'v2.1.187' ? 0.20 : 0);
assert.equal(alliedProjectileBlastChance(blastPlayer, 'control'), 0.20);
blastPlayer.stats.droneProc = 2;
assert.equal(alliedProjectileBlastChance(blastPlayer, 'drone'), VERSION === 'v2.1.187' ? 0.40 : 0.20);
const bulletRun = { bullets: [], fx: [], tick: 1 };
controlledFireBullet(bulletRun, blastPlayer, { id: 'proc', x: 0, y: 0 }, { id: 'enemy', x: 100, y: 0 }, 10, 300, 1, 4);
assert.equal(bulletRun.bullets[0].proc, 0.20);

// The renamed range module remains available to Controller and scales every hero family.
const rangeOption = WEAPON_CHEST_REWARDS.find(x => x.id === 'bullet_range');
const rangeUpgrade = UPGRADES.find(x => x.id === 'bullet_range');
assert.ok(rangeOption && rangeUpgrade);
assert.equal(rangeOption.label, 'ДАЛЬНОСТЬ ОРУЖИЯ +22%');
assert.equal(weaponChoiceEligible(blastPlayer, rangeOption), true);
assert.equal(weaponRangeMultiplier(blastPlayer), 1);
rangeUpgrade.apply(blastPlayer.stats);
assert.equal(Math.round(weaponRangeMultiplier(blastPlayer) * 100), 122);

// CTRL death-heal progression is cumulative and doubled: 2%, 5%, 9%, 14%.
const healUpgrade = UPGRADES.find(x => x.id === 'ctrl_process_death_heal');
const healOption = WEAPON_CHEST_REWARDS.find(x => x.id === 'ctrl_process_death_heal');
assert.ok(healUpgrade && healOption && weaponChoiceEligible(blastPlayer, healOption));
const expectedPercent = [2, 5, 9, 14];
const healPlayer = createPlayer('heal187', 'HEAL', 0, { hero: 'process_controller' });
for (let i = 0; i < expectedPercent.length; i++) {
  healUpgrade.apply(healPlayer.stats);
  assert.equal(controlledProcessDeathHealPercent(healPlayer), expectedPercent[i]);
}
healPlayer.stats.ctrlDeathHeal = 2;
assert.equal(controlledProcessDeathHealValue(healPlayer, { maxHp: 400 }), 20);
healPlayer.hp = 50;
const healRun = { fx: [] };
expireControlledProcess(healRun, healPlayer, { id: 'dead', kind: 'tank', x: 0, y: 0, size: 30, maxHp: 400 }, 'hp');
assert.equal(healPlayer.hp, 70);
expireControlledProcess(healRun, healPlayer, { id: 'ttl', kind: 'tank', x: 0, y: 0, size: 30, maxHp: 400 }, 'ttl');
  assert.equal(healPlayer.hp, ['v2.1.198', 'v2.1.199', 'v2.1.200', 'v2.1.201', 'v2.1.202', 'v2.1.203', 'v2.1.204', 'v2.1.205', 'v2.1.206', 'v2.1.207', 'v2.1.208', 'v2.1.209', 'v2.1.210'].includes(VERSION) ? 90 : 70, 'signal expiry healing does not match this patch generation');

function bossSource(kind, id, hp = null) {
  const def = ENEMIES[kind];
  return {
    id, kind, x: 760, y: 640, hp: hp ?? def.hp, maxHp: def.hp, size: def.size,
    spd: def.spd, dmg: def.dmg, armor: def.armor, fireCd: def.fireCd,
    bulletSpd: def.bulletSpd, spawnDelay: 0, state: 'move', st: 0,
    bossCastCd: 0, bossPhase: 0, shellHp: 0
  };
}
function controllerFixture(seed = 187) {
  const player = createPlayer(`ctrl-${seed}`, 'CTRL', 0, { hero: 'process_controller' });
  player.stats.ctrlCaptureTier = 4;
  const players = new Map([[player.id, player]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.bullets = [];
  run.fx = [];
  return { player, players, run };
}

// Captured bosses retain identity, captured HP and their unique allied runtime.
const bossFx = controllerFixture(188);
const croupier = bossSource('boss_croupier', 'captured-croupier', 420);
bossFx.run.enemies = [croupier];
assert.equal(captureEnemyAsProcess(bossFx.run, bossFx.players, bossFx.player, croupier, 'command'), true);
const alliedCroupier = bossFx.player.processController.controlled[0];
assert.equal(alliedCroupier.kind, 'boss_croupier');
assert.equal(alliedCroupier.alliedBoss, 1);
assert.equal(alliedCroupier.hp, 420);
assert.equal(alliedCroupier.staticStormDisabled, 1);
bossFx.run.portal.open = false;
bossFx.run.enemies = [{ id: 'hostile', kind: 'grunt', x: 980, y: 640, hp: 500, maxHp: 500, size: 24, spawnDelay: 0 }];
alliedCroupier.bossCastCd = 0;
stepProcessControllerState(bossFx.run, bossFx.players, bossFx.player, 0.10);
assert.ok(alliedCroupier.ctrlBossMarks.length > 0, 'Croupier lost its marked-area boss attack');
assert.ok(bossFx.run.bullets.some(b => b.from === 'p' && b.source === 'control'), 'captured boss did not fire allied bullets');
assert.equal(bossFx.run.bullets.some(b => b.from === 'e'), false, 'captured boss still fired hostile bullets');

for (const kind of ['boss_anchor_cashier', 'boss_hunter_chorus', 'boss_hunter_duelist', 'boss_hunter_marksman', 'boss_hunter_trapper', 'boss_q_revisor']) {
  const fx = controllerFixture(200 + kind.length);
  const source = bossSource(kind, `captured-${kind}`);
  fx.run.enemies = [source];
  assert.equal(captureEnemyAsProcess(fx.run, fx.players, fx.player, source, 'command'), true, `${kind} could not be captured at assimilation IV`);
  const ally = fx.player.processController.controlled[0];
  fx.run.portal.open = false;
  const hostile = { id: `hostile-${kind}`, kind: 'tank', x: 940, y: 640, hp: 5000, maxHp: 5000, size: 34, spawnDelay: 0 };
  fx.run.enemies = [hostile];
  ally.bossCastCd = 0;
  ally.bossDashCd = 0;
  ally.bossVolleyCd = 0;
  const hpBefore = hostile.hp;
  for (let i = 0; i < 45; i++) stepProcessControllerState(fx.run, fx.players, fx.player, 0.10);
  const acted = fx.run.bullets.some(b => b.from === 'p' && b.source === 'control')
    || (ally.ctrlBossMarks || []).length > 0
    || hostile.hp < hpBefore
    || fx.player.processController.controlled.length > 1;
  assert.equal(acted, true, `${kind} did not execute its allied boss behavior`);
  assert.equal(fx.run.bullets.some(b => b.from === 'e'), false, `${kind} created hostile bullets`);
  assert.equal(ally.staticStormDisabled, 1, `${kind} did not disable captured-boss Static Storm output`);
}

// Hunter Chorus dies into three allied boss fragments, never hostile fragments.
const splitFx = controllerFixture(189);
const chorus = bossSource('boss_hunter_chorus', 'captured-chorus');
splitFx.run.enemies = [chorus];
assert.equal(captureEnemyAsProcess(splitFx.run, splitFx.players, splitFx.player, chorus, 'command'), true);
const alliedChorus = splitFx.player.processController.controlled[0];
damageControlledProcess(splitFx.run, splitFx.player, alliedChorus, 999999, 0, 0, 'qa');
const fragmentKinds = splitFx.player.processController.controlled.filter(x => x.bossFragmentParent === alliedChorus.id).map(x => x.kind).sort();
assert.deepEqual(fragmentKinds, ['boss_hunter_duelist', 'boss_hunter_marksman', 'boss_hunter_trapper']);
for (const child of splitFx.player.processController.controlled.filter(x => x.bossFragmentParent === alliedChorus.id)) {
  assert.equal(child.alliedBoss, 1);
  assert.equal(child.staticStormDisabled, 1);
}
assert.equal(splitFx.run.enemies.some(e => ENEMIES[e.kind]?.bossFragment), false);

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(render, /drawRadius\(q/);
assert.doesNotMatch(sim, /armActiveRadius|activePreviewRadius|activePreviewCenter/);
for (const kind of ['boss_croupier', 'boss_anchor_cashier', 'boss_hunter_chorus', 'boss_hunter_duelist', 'boss_hunter_marksman', 'boss_hunter_trapper', 'boss_q_revisor']) {
  assert.match(sim, new RegExp(`m\\.kind === '${kind}'`), `missing allied runtime for ${kind}`);
}
const controlledBossBlock = sim.slice(sim.indexOf('function stepControlledBoss('), sim.indexOf('function stepControlledProcess('));
assert.doesNotMatch(controlledBossBlock, /staticDebt|addStaticDebt|static_rain|stepBossBackgroundPressure/);
assert.match(i18n, /дальность оружия всех героев/i);
assert.match(i18n, /weapon range for every hero/i);

console.log('v2.1.187 compatibility checks passed: one-press Spike, controller blast/range, CTRL death heal, allied bosses');
