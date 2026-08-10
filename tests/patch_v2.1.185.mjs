import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, defaultStats } from '../shared/data.v2-1.js';
import { createPlayer, createRun, damageEnemy, pickSlotMobMode, startRoom, step } from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:18[5-9]|190)$/);
if (VERSION === 'v2.1.185') assert.equal(BUILD_ID, 'boss_casino_gold_fever_audit');
assert.ok(PROTOCOL >= 12);
assert.equal(ENEMIES.slot_mob.hp, 3060, 'Casino Mob HP was not halved');

const used = [];
for (let i = 0; i < 3; i++) {
  const mode = pickSlotMobMode(used, () => 0);
  assert.ok(mode && !used.includes(mode), 'Casino Mob repeated a phase');
  used.push(mode);
}

const slotPlayer = createPlayer('slot-qa', 'SLOT QA', 0);
const slotPlayers = new Map([[slotPlayer.id, slotPlayer]]);
const slotRun = createRun(185);
startRoom(slotRun, slotPlayers);
slotRun.enemies = [];
slotRun.spawned = 0;
const slot = { id: 'slot', kind: 'slot_mob', x: slotRun.plan.w / 2, y: slotRun.plan.h / 2, hp: 100, maxHp: 100, size: 44, slotLives: 1, slotUsedModes: [] };
slotRun.enemies.push(slot);
damageEnemy(slotRun, slotPlayers, slot, 51, null, 0, 0, 0, 'qa');
assert.equal(slot.slotHalfWaveDone, 1, 'Casino Mob did not mark its half-HP wave as used');
assert.equal(slotRun.enemies.filter(e => e.packRole === 'slot_half_wave').length, 3, 'Casino Mob did not summon its small fast wave');
damageEnemy(slotRun, slotPlayers, slot, 1, null, 0, 0, 0, 'qa');
assert.equal(slotRun.enemies.filter(e => e.packRole === 'slot_half_wave').length, 3, 'Casino Mob repeated its half-HP wave');

const bossPlayer = createPlayer('boss-qa', 'BOSS QA', 0);
const bossPlayers = new Map([[bossPlayer.id, bossPlayer]]);
const bossRun = createRun(123);
bossRun.runDepth = 3;
startRoom(bossRun, bossPlayers);
const primaryBoss = bossRun.enemies.find(e => ENEMIES[e.kind]?.boss && !ENEMIES[e.kind]?.bossFragment);
assert.ok(primaryBoss, 'boss test room did not create its primary boss');
for (let i = 0; i < 180 && bossRun.phase === 'play'; i++) step(bossRun, bossPlayers, 0.02, i * 0.02);
assert.equal(bossRun.enemies.filter(e => e.packRole === 'boss_background').length, 1, 'boss did not add one basic enemy from the start');
assert.equal(primaryBoss.hp, primaryBoss.maxHp, 'boss background test accidentally entered the old low-HP pack phase');

const player = {
  id: 'gold-qa', alive: true, hp: 40, stats: defaultStats(),
  economy: { money: 0 }
};
player.stats.lifesteal = 0.10;
const players = new Map([[player.id, player]]);
const target = () => ({ id: 'target', kind: 'grunt', x: 10, y: 10, hp: 100, maxHp: 100, size: 20 });
damageEnemy({ fx: [], plan: { modifierIds: ['greed'] } }, players, target(), 20, player.id, 0, 0, 0, 'qa');
assert.equal(player.hp, 40, 'Gold Fever lifesteal restored HP');
assert.equal(player.economy.money, 2, 'Gold Fever lifesteal did not restore credits');
player.economy.money = 0;
damageEnemy({ fx: [], plan: { modifierIds: [] } }, players, target(), 20, player.id, 0, 0, 0, 'qa');
assert.equal(player.hp, 42, 'normal lifesteal stopped restoring HP');
assert.equal(player.economy.money, 0, 'normal lifesteal restored credits');

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');

// New background pressure is additive; the pre-existing low-HP boss pack remains.
assert.match(sim, /stepBossBackgroundPressure\(run, players, e, def, dt\)/);
assert.match(sim, /boss\.hp < boss\.maxHp \* 0\.55/);
assert.match(sim, /packRole: 'boss_background'/);
assert.match(sim, /count: 1/);
assert.match(sim, /spawnSlotMobHalfWave\(run, players, e\)/);
assert.match(sim, /usedModes: e\.slotUsedModes \|\| \[\]/);

// INSTALL preview regression guard: left-side modifiers, optional contract, RU/EN.
assert.match(html, /id="install-next-room"/);
assert.match(css, /right:\s*calc\(100% \+ 14px\)/);
assert.match(hud, /const contract = next\.objective[\s\S]*?: '';/);
assert.match(hud, /'МОДИФИКАТОРЫ', 'MODIFIERS'/);
assert.match(hud, /lifesteal returns credits instead of HP/);

console.log('v2.1.185 checks passed: Casino Mob balance/phases/wave, additive boss pressure, Gold Fever lifesteal, INSTALL preview RU/EN');
