import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, UPGRADES } from '../shared/data.v2-1.js';
import {
  createPlayer,
  createRun,
  fireProcessControllerProtocol,
  makeWeaponChestChoices,
  startRoom,
  staticStrikeProfile,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:20[5-9]|21[0-5])$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.205' ? 'saw_failsafe_static_strike_sync' : VERSION === 'v2.1.206' ? 'low_stake_lock_overload_guard' : VERSION === 'v2.1.207' ? 'install_choice_identity_sync' : VERSION === 'v2.1.208' ? 'boss_bag_trinode_q_silence_casino_wpn' : VERSION === 'v2.1.209' ? 'contract_choice_root_lock_mirror_static_sync' : VERSION === 'v2.1.210' ? 'trinode_parts_radial_break_sync' : VERSION === 'v2.1.211' ? 'trinode_chase_loop_hp_splitter_audio' : VERSION === 'v2.1.212' ? 'boss_q_silence_fullscreen_signal' : VERSION === 'v2.1.215' ? 'install_preview_anchor_phase_signal' : 'solo_offline_hard_fallback');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

function enemy(kind, id, x, y, hp = null) {
  const def = ENEMIES[kind] || ENEMIES.grunt;
  const health = hp ?? def.hp;
  return { id, kind, x, y, hp: health, maxHp: health, size: def.size, spawnDelay: 0, shellHp: 0, shellMax: 0, dirX: 1, dirY: 0 };
}
function sawFixture(seed = 20501) {
  const p = createPlayer(`saw-${seed}`, 'SAW QA', 0, { hero: 'process_controller' });
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.plan = { ...run.plan, category: 'boss', w: 1600, h: 1000, walls: [], modifierIds: [] };
  run.fx = []; run.bullets = [];
  p.x = 500; p.y = 500; p.aimX = 700; p.aimY = 500;
  p.weapons = ['command_pulse', 'process_saw']; p.weaponIdx = 1;
  p.stats.sawFallbackDamage = 1;
  p.fire = true; p.fireWasDown = false;
  return { p, players, run };
}

// The passive is a real, one-time WPN option and only appears after SAW exists.
{
  const upgrade = UPGRADES.find(x => x.id === 'saw_fallback_damage');
  assert.ok(upgrade, 'SAW fallback upgrade is absent from upgrade data');
  const p = createPlayer('saw-pool', 'SAW POOL', 0, { hero: 'process_controller' });
  p.weapons = ['command_pulse', 'process_saw'];
  let state = 20503;
  const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  let offered = false;
  for (let i = 0; i < 240; i++) {
    if (makeWeaponChestChoices(p, rng, 5, 2).some(x => x.upgrade === 'saw_fallback_damage')) { offered = true; break; }
  }
  assert.equal(offered, true, 'SAW fallback never enters Controller WPN offers');
  upgrade.apply(p.stats);
  assert.equal(p.stats.sawFallbackDamage, 1);
  for (let i = 0; i < 80; i++) assert.equal(makeWeaponChestChoices(p, rng, 5, 2).some(x => x.upgrade === 'saw_fallback_damage'), false, 'one-time SAW passive was offered twice');
}

// Mixed pulse: a valid early process is captured, while a target above the
// current assimilation tier takes weapon-scaled fallback damage.
{
  const { p, players, run } = sawFixture(20504);
  const capturable = enemy('grunt', 'saw-cap', 670, 500, 100);
  const blockedTier = enemy('warden', 'saw-tier', 730, 500, 400);
  run.enemies = [capturable, blockedTier];
  const before = blockedTier.hp;
  fireProcessControllerProtocol(run, players, p, 1 / 60);
  assert.ok(p.processController.controlled.some(x => x.kind === 'grunt'), 'SAW failed to capture a valid target');
  assert.ok(blockedTier.hp < before, 'SAW did not damage a target blocked by assimilation tier');
  assert.ok(p.processController.weaponCooldowns.process_saw > 0, 'successful fallback pulse did not start SAW cooldown');
  assert.ok(run.fx.some(f => f.t === 'ctrl_saw' && f.captured >= 1 && f.damaged >= 1), 'mixed SAW result is not reported');
}

// A full process roster turns otherwise capturable targets into damage targets.
{
  const { p, players, run } = sawFixture(20505);
  p.processController.controlled = [
    { id: 'full-a', kind: 'grunt', hp: 20, maxHp: 20, ttl: 10 },
    { id: 'full-b', kind: 'runner', hp: 20, maxHp: 20, ttl: 10 }
  ];
  const target = enemy('grunt', 'full-target', 700, 500, 240);
  run.enemies = [target];
  fireProcessControllerProtocol(run, players, p, 1 / 60);
  assert.ok(target.hp < 240, 'full slots did not trigger SAW fallback damage');
  assert.equal(p.processController.controlled.length, 2, 'SAW overfilled regular process slots');
}

// Armor is not bypassed: fallback damage correctly hits the shell first.
{
  const { p, players, run } = sawFixture(20506);
  const armored = enemy('tank', 'shell-target', 700, 500, 500);
  armored.shellType = 'plain'; armored.shellMax = 120; armored.shellHp = 120;
  run.enemies = [armored];
  fireProcessControllerProtocol(run, players, p, 1 / 60);
  assert.ok(armored.shellHp < 120, 'SAW fallback bypassed or failed to damage armor');
  assert.equal(armored.hp, 500, 'SAW fallback leaked through an active shell');
}

// STATIC STRIKE uses one radius and one timing chain for warning, collision and
// impact. The damage happens exactly when the short full-radius impact appears.
{
  const p = createPlayer('strike-sync', 'STRIKE SYNC', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20507);
  startRoom(run, players);
  run.plan = { ...run.plan, category: 'boss', w: 1600, h: 1000, walls: [], modifierIds: [] };
  run.director.pauseT = 999;
  p.x = 400; p.y = 500; p.aimX = 800; p.aimY = 500;
  p.active = { core: 'static_strike', level: 1, mutations: [] }; p.activeCd = 0;
  const profile = staticStrikeProfile(1);
  const target = enemy('grunt', 'strike-edge-205', p.aimX + profile.radius + ENEMIES.grunt.size / 2, p.aimY, 500);
  run.enemies = [target]; run.fx = [];
  p.wantActive = true;
  step(run, players, 1 / 60, 20);
  const warning = run.fx.find(f => f.t === 'rain_warn' && f.active);
  const pending = run.pendingActiveStrikes[0];
  assert.equal(warning.r, profile.radius);
  assert.equal(pending.r, profile.radius);
  assert.equal(warning.dur, profile.delay);
  assert.equal(target.hp, 500, 'STATIC STRIKE damaged before the warning completed');
  run.fx = [];
  step(run, players, 1 / 60, 20 + profile.delay + 0.001);
  const impact = run.fx.find(f => f.t === 'rain_hit' && f.active);
  assert.ok(target.hp < 500, 'STATIC STRIKE missed a body touching the displayed edge');
  assert.equal(impact.r, profile.radius, 'impact animation radius differs from collision radius');
  assert.equal(run.activeFields.some(f => f.kind === 'static_strike'), false, 'STATIC STRIKE left a residual field');
}

const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
assert.match(effects, /const isStaticStrike = f\.kind === 'static_strike'/);
assert.match(effects, /if \(!isStaticStrike\) this\.add/);
assert.match(effects, /finishedStaticStrikes/);
const strikeFlashBlock = effects.match(/else if \(e\.kind === 'staticStrikeFlash'\) \{([\s\S]*?)\n\s*\} else if/)?.[1] || '';
assert.doesNotMatch(strikeFlashBlock, /ctx\.arc|Math\.cos\(a\)/, 'STATIC STRIKE left a circular/radial area after impact');

console.log('v2.1.205 checks passed: SAW failsafe WPN passive and synchronized exact-radius STATIC STRIKE');
