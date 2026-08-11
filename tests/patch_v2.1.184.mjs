import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UPGRADES, WEAPON_CHEST_REWARDS, defaultStats } from '../shared/data.v2-1.js';
import {
  applyControlledProcessStatuses,
  bulletElementString,
  controlledProcessContactCarriesStatuses,
  controlledProcessDamageValue,
  controlledProcessFireRateMul,
  damageEnemy,
  weaponChoiceEligible
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:18[4-9]|19[0-9]|20[0-8])$/);
if (VERSION === 'v2.1.184') assert.equal(BUILD_ID, 'controller_process_inheritance_audit');
assert.ok(PROTOCOL >= 11);

const player = {
  id: 'ctrl-qa', hero: 'process_controller', alive: true, hp: 40,
  stats: defaultStats(), weapons: ['command_pulse'], activeBuffT: 0,
  wagerDmgMul: 1, tempDmgMulT: 0, tempDmgMulRoom: 0
};
const contactOption = WEAPON_CHEST_REWARDS.find(x => x.id === 'ctrl_process_contact_status');
const contactUpgrade = UPGRADES.find(x => x.id === 'ctrl_process_contact_status');
assert.ok(contactOption && contactUpgrade, 'missing CTRL living projectile WPN passive');
assert.equal(weaponChoiceEligible(player, contactOption), true, 'contact status passive should not require a pre-existing status');
assert.equal(controlledProcessContactCarriesStatuses(player), false);

// Ranged process shots always inherit weapon statuses without the new passive.
player.stats.bulletFire = 1;
assert.match(bulletElementString(player, 'control'), /fire/);

// The passive affects body/contact attacks and dynamically includes future statuses.
contactUpgrade.apply(player.stats);
assert.equal(controlledProcessContactCarriesStatuses(player), true);
assert.equal(weaponChoiceEligible(player, contactOption), false, 'one-time contact passive appeared twice');
player.stats.bulletFreeze = 1;
player.stats.bulletPoison = 1;
assert.match(bulletElementString(player, 'control'), /fire/);
assert.match(bulletElementString(player, 'control'), /freeze/);
assert.match(bulletElementString(player, 'control'), /poison/);
const statusTarget = { id: 'status-target', kind: 'grunt', x: 80, y: 80, hp: 200, maxHp: 200, size: 20 };
const statusRun = { fx: [], enemies: [statusTarget] };
const players = new Map([[player.id, player]]);
assert.equal(applyControlledProcessStatuses(statusRun, players, player, statusTarget, 20, 1), true);
assert.ok(statusTarget.burnT > 0 && statusTarget.chillT > 0 && statusTarget.poisonT > 0, 'body hit did not apply every status');

// General FIRE RATE, CTRL fire rate, and temporary Q overclock multiply together.
player.stats.fireMul = 1;
player.stats.ctrlFire = 0;
player.stats.activeOver = 0;
player.activeBuffT = 0;
assert.equal(controlledProcessFireRateMul(player), 1);
player.stats.fireMul = 1.12;
player.stats.ctrlFire = 1;
player.stats.activeOver = 1;
player.activeBuffT = 2;
assert.ok(Math.abs(controlledProcessFireRateMul(player) - (1.12 * 1.18 * 1.85)) < 1e-9);

// CTRL power and every global/weapon/temporary damage multiplier use one path.
player.stats.ctrlPower = 1;
player.stats.dmgMul = 1.15;
player.stats.weaponDmgMul = 1.18;
player.wagerDmgMul = 1.5;
player.tempDmgMul = 2;
player.tempDmgMulT = 1;
assert.ok(Math.abs(controlledProcessDamageValue(player, 10) - (11.7 * 1.15 * 1.18 * 1.5 * 2)) < 1e-9);

// Real controller-owned damage returns health through normal lifesteal.
player.stats.lifesteal = 0.10;
player.hp = 40;
const lifeTarget = { id: 'life-target', kind: 'grunt', x: 100, y: 100, hp: 100, maxHp: 100, size: 20 };
const lifeRun = { fx: [] };
damageEnemy(lifeRun, players, lifeTarget, 20, player.id, 0, 0, 0, 'ctrl_grunt');
assert.equal(lifeTarget.hp, 80);
assert.equal(player.hp, 42);

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(sim, /source === 'control' && !\(p\.stats/);
assert.match(sim, /const elem = bulletElementString\(p, 'control'\)/);
assert.match(sim, /const fireMul = controlledProcessFireRateMul\(p\)/);
assert.match(data, /CTRL: ЖИВОЙ СНАРЯД/);
assert.match(i18n, /Their shots always inherit statuses by default/);
assert.match(i18n, /Их выстрелы наследуют статусы всегда/);

console.log('v2.1.184 checks passed: passive link fix, ranged status baseline, body-status passive, fire/damage inheritance, lifesteal, RU/EN');
