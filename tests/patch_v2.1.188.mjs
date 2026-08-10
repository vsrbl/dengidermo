import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import {
  alliedProjectileBlastChance,
  captureEnemyAsProcess,
  controlledHeraldNextSummonCd,
  controlledHeraldSummon,
  createPlayer,
  createRun,
  damagePlayer,
  startRoom,
  step,
  stepProcessControllerState,
  voidPreviewEnd
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:18[89]|19[0-6])$/);
if (VERSION === 'v2.1.188') assert.equal(BUILD_ID, 'drone_void_herald_contract_healer_hotfix');
assert.equal(PROTOCOL, 14);

// Normal BLAST CHANCE stays on hero/process bullets. Drones require DRONE BLAST.
const blast = createPlayer('blast188', 'BLAST', 0, { hero: 'process_controller' });
blast.stats.procBlast = 0.30;
assert.equal(alliedProjectileBlastChance(blast, 'weapon'), 0.30);
assert.equal(alliedProjectileBlastChance(blast, 'control'), 0.30);
assert.equal(alliedProjectileBlastChance(blast, 'drone'), 0);
blast.stats.droneProc = 2;
assert.equal(alliedProjectileBlastChance(blast, 'drone'), 0.20);

// First Void Cut press creates only the anchor. With no mouse movement it must not
// invent a direction, render a side line, consume cooldown, or create a laser.
const voidPlayer = createPlayer('void188', 'VOID', 0);
const voidPlayers = new Map([[voidPlayer.id, voidPlayer]]);
const voidRun = createRun(188);
startRoom(voidRun, voidPlayers);
voidPlayer.active = { core: 'void_cut', level: 2, mutations: [] };
voidPlayer.aimX = voidPlayer.x + 180;
voidPlayer.aimY = voidPlayer.y;
voidPlayer.wantActive = true;
step(voidRun, voidPlayers, 1 / 60, 1);
assert.ok(voidPlayer.activeTargeting, 'Void Cut did not arm its first point');
voidPlayer.aimX = voidPlayer.activeTargeting.x;
voidPlayer.aimY = voidPlayer.activeTargeting.y;
assert.deepEqual(voidPreviewEnd(voidRun, voidPlayer, voidPlayer.activeTargeting.x, voidPlayer.activeTargeting.y), {
  x: voidPlayer.activeTargeting.x,
  y: voidPlayer.activeTargeting.y
});
voidPlayer.wantActive = true;
step(voidRun, voidPlayers, 1 / 60, 2);
assert.equal(voidPlayer.activeCd, 0);
assert.equal(voidRun.activeFields.some(f => f.kind === 'void_laser'), false);
voidPlayer.aimX += 140;
voidPlayer.wantActive = true;
step(voidRun, voidPlayers, 1 / 60, 3);
assert.ok(voidRun.activeFields.some(f => f.kind === 'void_laser'), 'valid moved Void Cut segment did not build');

function controllerFixture(seed = 188) {
  const player = createPlayer(`ctrl-${seed}`, 'CTRL', 0, { hero: 'process_controller' });
  player.stats.ctrlCaptureTier = 3;
  const players = new Map([[player.id, player]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.fx = [];
  return { player, players, run };
}

// Controlled Herald calls only small rank-one allied waves, without a red floor line.
assert.equal(controlledHeraldNextSummonCd(() => 0), 10);
assert.ok(controlledHeraldNextSummonCd(() => 0.999999) < 20);
const heraldFx = controllerFixture(189);
const heraldDef = ENEMIES.herald;
const hostileHerald = { id: 'herald-hostile', kind: 'herald', x: 700, y: 620, hp: heraldDef.hp, maxHp: heraldDef.hp, size: heraldDef.size, spawnDelay: 0, shellHp: 0 };
heraldFx.run.enemies = [hostileHerald];
assert.equal(captureEnemyAsProcess(heraldFx.run, heraldFx.players, heraldFx.player, hostileHerald, 'command'), true);
const alliedHerald = heraldFx.player.processController.controlled[0];
assert.ok(alliedHerald.summonCd >= 10 && alliedHerald.summonCd < 20);
const target = { id: 'herald-target', kind: 'tank', x: 980, y: 620, hp: 1000, maxHp: 1000, size: 36, spawnDelay: 0 };
heraldFx.run.enemies = [target];
heraldFx.run.fx = [];
const made = controlledHeraldSummon(heraldFx.run, heraldFx.player, heraldFx.player.processController, alliedHerald, target, 0, () => 0);
assert.equal(made, 2);
const rankOne = new Set(['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer']);
for (const child of heraldFx.player.processController.controlled.slice(1)) assert.equal(rankOne.has(child.kind), true, `non-rank-one Herald summon: ${child.kind}`);
assert.equal(heraldFx.run.fx.some(f => f.t === 'herald_cast'), false);
assert.ok(heraldFx.run.fx.some(f => f.t === 'summon' && f.ally === 1));

// No-damage contracts fail only on actual HP loss, not shields or Gold Fever credits.
const damagePlayerFixture = createPlayer('contract188', 'CONTRACT', 0);
const damagePlayers = new Map([[damagePlayerFixture.id, damagePlayerFixture]]);
const damageRun = createRun(190);
startRoom(damageRun, damagePlayers);
damagePlayerFixture.wagerStats = { damage: 0 };
damagePlayerFixture.quarantineT = 5;
damagePlayerFixture.quarantineHp = 40;
const fullHp = damagePlayerFixture.hp;
damagePlayer(damageRun, damagePlayerFixture, 12, damagePlayerFixture.x, damagePlayerFixture.y);
assert.equal(damagePlayerFixture.hp, fullHp);
assert.equal(damagePlayerFixture.wagerStats.damage, 0);
damagePlayerFixture.invuln = 0;
damagePlayerFixture.quarantineT = 0;
damagePlayerFixture.quarantineHp = 0;
damageRun.plan.modifierIds = ['greed'];
damagePlayerFixture.economy.money = 100;
damagePlayer(damageRun, damagePlayerFixture, 3, damagePlayerFixture.x, damagePlayerFixture.y);
assert.equal(damagePlayerFixture.hp, fullHp);
assert.equal(damagePlayerFixture.wagerStats.damage, 0);
assert.ok(damagePlayerFixture.economy.money < 100);
damagePlayerFixture.invuln = 0;
damageRun.plan.modifierIds = [];
damagePlayer(damageRun, damagePlayerFixture, 7, damagePlayerFixture.x, damagePlayerFixture.y);
assert.equal(damagePlayerFixture.hp, fullHp - 7);
assert.equal(damagePlayerFixture.wagerStats.damage, 7);

// Controlled healers follow the injured hero from outside heal range, then heal nearby.
const healerFx = controllerFixture(191);
healerFx.run.plan.walls = [];
const leechDef = ENEMIES.leech;
const hostileLeech = { id: 'leech-hostile', kind: 'leech', x: healerFx.player.x + 520, y: healerFx.player.y, hp: leechDef.hp, maxHp: leechDef.hp, size: leechDef.size, spawnDelay: 0, shellHp: 0 };
healerFx.run.enemies = [hostileLeech];
assert.equal(captureEnemyAsProcess(healerFx.run, healerFx.players, healerFx.player, hostileLeech, 'command'), true);
const alliedLeech = healerFx.player.processController.controlled[0];
healerFx.run.enemies = [];
healerFx.player.hp = 50;
const beforeDistance = Math.hypot(alliedLeech.x - healerFx.player.x, alliedLeech.y - healerFx.player.y);
stepProcessControllerState(healerFx.run, healerFx.players, healerFx.player, 0.25);
assert.ok(Math.hypot(alliedLeech.x - healerFx.player.x, alliedLeech.y - healerFx.player.y) < beforeDistance);
alliedLeech.x = healerFx.player.x + 80;
alliedLeech.y = healerFx.player.y;
alliedLeech.healCd = 0;
const hpBeforeHeal = healerFx.player.hp;
stepProcessControllerState(healerFx.run, healerFx.players, healerFx.player, 0.10);
assert.ok(healerFx.player.hp > hpBeforeHeal, 'controlled healer did not prioritize the hero');

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
const controlledHeraldBlock = sim.slice(sim.indexOf('export function controlledHeraldSummon'), sim.indexOf('function stepControlledBouncer'));
assert.doesNotMatch(controlledHeraldBlock, /herald_cast|buildHeraldFloorPath/);
assert.match(effects, /f\.ally \? '#66f6ff'/);
assert.match(i18n, /Drones require DRONE BLAST/);
assert.match(i18n, /Дронам нужен DRONE BLAST/);

console.log('v2.1.188 checks passed: drone blast gate, stable Void Cut anchor, allied Herald waves, HP-only contract, healer follow');
