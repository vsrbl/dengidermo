import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import {
  buildSnapshot,
  createPlayer,
  createRun,
  damageEnemy,
  startRoom,
  stepAnchorCashierBoss
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.20[4-8]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.204' ? 'armor_spam_anchor_phase_cycle' : VERSION === 'v2.1.205' ? 'saw_failsafe_static_strike_sync' : VERSION === 'v2.1.206' ? 'low_stake_lock_overload_guard' : VERSION === 'v2.1.207' ? 'install_choice_identity_sync' : 'boss_bag_trinode_q_silence_casino_wpn');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

// Linked armor remains invulnerable while its battery link is alive, but one
// rapid burst cannot create one red event per pellet/status tick.
{
  const p = createPlayer('armor-owner', 'ARMOR OWNER', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20401);
  startRoom(run, players);
  run.fx = [];
  const e = {
    id: 'linked-shell', kind: 'tank', x: 500, y: 400, hp: 300, maxHp: 300, size: 42,
    spawnDelay: 0, shellType: 'linked', shellHp: 120, shellMax: 120,
    armorLockT: 1, armorLinkId: 'battery', shellImpactFxT: 0
  };
  for (let i = 0; i < 40; i++) damageEnemy(run, players, e, 20, p.id, 0, 0, 0, 'qa_burst');
  assert.equal(e.hp, 300, 'linked shell leaked damage into HP');
  assert.equal(e.shellHp, 120, 'linked shell lost armor while locked');
  assert.equal(run.fx.filter(f => f.t === 'armor_shell').length, 1, 'linked armor impact FX still spams per hit');
}

// The Anchor Cashier alternates one 10-second keep-out/static-pulse phase and
// one 5-second shots-only opening. The rest of the boss data is untouched.
{
  const p = createPlayer('anchor-target', 'ANCHOR TARGET', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20402);
  startRoom(run, players);
  p.x = 800; p.y = 500; p.aimX = 600; p.aimY = 500;
  run.plan = { ...run.plan, category: 'boss', w: 1600, h: 1000, walls: [], modifierIds: [] };
  run.fx = []; run.bullets = [];
  const def = ENEMIES.boss_anchor_cashier;
  const boss = {
    id: 'anchor-boss', kind: 'boss_anchor_cashier', x: 600, y: 500,
    hp: def.hp, maxHp: def.hp, size: def.size, spawnDelay: 0,
    dirX: 1, dirY: 0, bossPhase: 0, bossCastCd: 0, bossMarks: [], fxT: 0,
    anchorCyclePhase: 'field', anchorPhaseT: 10
  };
  run.enemies = [boss];
  const fieldStartX = p.x;
  stepAnchorCashierBoss(run, players, boss, def, p, { x: 1, y: 0 }, 200, def.spd, 0.1);
  assert.equal(boss.anchorCyclePhase, 'field');
  assert.ok(Math.abs(boss.anchorPhaseT - 9.9) < 1e-9, 'field phase is not ten seconds');
  assert.ok(p.x > fieldStartX, 'field phase does not keep the player away');
  assert.ok(run.fx.some(f => f.t === 'active_field'), 'field phase lost its surrounding zone');
  assert.ok(run.fx.some(f => f.t === 'boss_burst'), 'field phase lost static radial pulses');

  boss.anchorPhaseT = 0.01; boss.bossCastCd = 999; run.fx = []; run.bullets = [];
  stepAnchorCashierBoss(run, players, boss, def, p, { x: 1, y: 0 }, 200, def.spd, 0.02);
  assert.equal(boss.anchorCyclePhase, 'shots');
  assert.ok(Math.abs(boss.anchorPhaseT - 4.99) < 1e-9, 'shots phase is not five seconds');
  assert.ok(run.fx.some(f => f.t === 'anchor_phase' && f.phase === 'shots'), 'shots transition animation is missing');

  const shotStartX = p.x;
  boss.bossCastCd = 0; boss.bossMarks = []; run.fx = []; run.bullets = [];
  stepAnchorCashierBoss(run, players, boss, def, p, { x: 1, y: 0 }, 200, def.spd, 0.1);
  assert.equal(p.x, shotStartX, 'shots-only phase still applies the surrounding field');
  assert.equal(run.fx.some(f => f.t === 'active_field' || f.t === 'rain_warn' || f.t === 'boss_burst'), false, 'shots-only phase emitted a field, zone, or static pulse');
  assert.ok(run.bullets.length >= 4 && run.bullets.every(b => b.from === 'e'), 'shots-only phase did not fire its aimed volley');
  assert.equal(boss.bossMarks.length, 0, 'shots-only phase created a floor zone');
  assert.equal(buildSnapshot(run, players).enemies[0][25], 0, 'snapshot still marks the field visible during shots');

  boss.anchorPhaseT = 0.01; boss.bossCastCd = 999; run.fx = [];
  stepAnchorCashierBoss(run, players, boss, def, p, { x: 1, y: 0 }, 200, def.spd, 0.02);
  assert.equal(boss.anchorCyclePhase, 'field');
  assert.ok(run.fx.some(f => f.t === 'anchor_phase' && f.phase === 'field'), 'field transition animation is missing');
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(sim, /run\.fx\.push\(\{ t: 'path_turn'/, 'navigation correction still sends red combat FX');
assert.doesNotMatch(effects.match(/case 'armor_shell':[\s\S]*?break;/)?.[0] || '', /this\.float/, 'armor hit text spam remains');
assert.doesNotMatch(effects.match(/case 'armor_link':[\s\S]*?break;/)?.[0] || '', /this\.float/, 'armor link refresh text spam remains');
assert.match(render, /if \(anchorField\)/, 'boss field renderer ignores the shots-only phase');

console.log('v2.1.204 checks passed: silent navigation/armor spam, exact Anchor Cashier 10s/5s phase cycle');
