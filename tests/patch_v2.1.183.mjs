import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPON_CHEST_REWARDS, defaultStats } from '../shared/data.v2-1.js';
import {
  bossRewardBlockedForPlayer,
  signalSpikeAimRangeForLevel,
  signalSpikeRadiusForLevel,
  weaponChoiceEligible
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:18[3-9]|19[0-9]|20[0-4])$/);
if (VERSION === 'v2.1.183') assert.equal(BUILD_ID, 'projectile_link_status_r_compat');
assert.ok(PROTOCOL >= 10);

const statusLink = WEAPON_CHEST_REWARDS.find(x => x.id === 'bullet_chain_status_link');
assert.ok(statusLink, 'missing status link WPN upgrade');
const player = { id: 'qa', hero: 'base', stats: defaultStats(), weapons: ['shotgun'] };

// The unlock is passive and one-time: it only needs the base link and also covers future statuses.
player.stats.bulletFire = 1;
assert.equal(weaponChoiceEligible(player, statusLink), false, 'status link appeared before projectile link');
player.stats.bulletChain = 1;
player.stats.bulletFire = 0;
assert.equal(weaponChoiceEligible(player, statusLink), true, 'passive status link requires a pre-existing status');
player.stats.bulletChainStatuses = 1;
assert.equal(weaponChoiceEligible(player, statusLink), false, 'one-time status link appeared twice');

// Signal Spike range and area now grow noticeably at every early level.
assert.ok(signalSpikeAimRangeForLevel(2) - signalSpikeAimRangeForLevel(1) >= 20);
assert.ok(signalSpikeRadiusForLevel(2) - signalSpikeRadiusForLevel(1) >= 7);
assert.ok(signalSpikeAimRangeForLevel(12) > signalSpikeAimRangeForLevel(3));
assert.ok(signalSpikeRadiusForLevel(12) > signalSpikeRadiusForLevel(3));

// TARGET LOCK must not hijack manual multi-channel heroes; other R rewards remain valid.
const base = { hero: 'base', stats: defaultStats() };
const casino = { hero: 'living_casino', stats: defaultStats() };
const controller = { hero: 'process_controller', stats: defaultStats() };
assert.equal(bossRewardBlockedForPlayer('sig_target_lock', base), false);
assert.equal(bossRewardBlockedForPlayer('sig_target_lock', casino), true);
assert.equal(bossRewardBlockedForPlayer('sig_target_lock', controller), true);
assert.equal(bossRewardBlockedForPlayer('sig_redline_boost', casino), false);
assert.equal(bossRewardBlockedForPlayer('sig_ghost_decoy', controller), false);

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');

assert.match(sim, /b\.elem && owner\?\.stats\?\.bulletChainStatuses > 0/);
assert.doesNotMatch(sim, /best\.hp > 0 && b\.elem\) applyBulletElements/);
assert.match(data, /Статусы сами по цепи не переходят/);
assert.match(i18n, /Statuses do not transfer by default/);
assert.match(i18n, /Статусы сами по цепи не переходят/);
assert.match(hud, /bullet_chain_status_link/);

console.log('v2.1.183 checks passed: gated status link, damage-only base chain, Signal Spike scaling, R compatibility, RU/EN');
