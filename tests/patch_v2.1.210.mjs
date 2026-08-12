import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import { createPlayer, createRun, damageEnemy, handleDevCommand, startRoom, step } from '../shared/sim.v2-1.js';
import { BUILD_ID, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.21[0-5]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.210' ? 'trinode_parts_radial_break_sync' : VERSION === 'v2.1.211' ? 'trinode_chase_loop_hp_splitter_audio' : VERSION === 'v2.1.212' ? 'boss_q_silence_fullscreen_signal' : VERSION === 'v2.1.215' ? 'install_preview_anchor_phase_signal' : 'solo_offline_hard_fallback');
assert.equal(ENEMIES.boss_trinode.spd, 154 * 1.15);

function fixture(seed = 21001) {
  const p = createPlayer(`tri-${seed}`, 'TRI QA', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.enemies = [];
  run.bullets = [];
  run.fx = [];
  assert.equal(handleDevCommand(run, players, p, { action: 'spawn_boss', kind: 'boss_trinode' }), true);
  const boss = run.enemies.find(e => e.kind === 'boss_trinode');
  boss.spawnDelay = 0;
  boss.shellHp = 0;
  boss.shellMax = 0;
  boss.backgroundAddCd = 999;
  return { p, players, run, boss };
}

// Each square owns its HP. Excess damage cannot leak into the next section,
// and every section (including the final one) emits a destruction cue.
{
  const { p, players, run, boss } = fixture(21011);
  assert.equal(boss.trinodeParts.length, 3);
  const originalHp = boss.trinodeParts.map(x => x.hp);
  damageEnemy(run, players, boss, originalHp[0] + 99999, p.id, 0, 0, 0, 'qa');
  assert.equal(boss.trinodeParts.length, 2);
  assert.equal(boss.trinodeParts[0].hp, originalHp[1]);
  boss.trinodeUnlockT = 0;
  damageEnemy(run, players, boss, originalHp[1] + 99999, p.id, 0, 0, 0, 'qa');
  assert.equal(boss.trinodeParts.length, 1);
  assert.equal(boss.trinodeParts[0].hp, originalHp[2]);
  boss.trinodeUnlockT = 0;
  damageEnemy(run, players, boss, originalHp[2], p.id, 0, 0, 0, 'qa');
  const breaks = run.fx.filter(f => f.t === 'trinode_break');
  assert.deepEqual(breaks.map(f => f.left), [2, 1, 0]);
  assert.equal(run.enemies.includes(boss), false);
}

// The exposed square alone fires the ordinary ten-way boss radial. Old
// per-edge bullets and red boss-burst circle events are absent.
{
  const { p, players, run, boss } = fixture(21012);
  p.x = 300;
  p.y = 300;
  boss.trinodeShotCd = 0;
  step(run, players, 1 / 60, 1);
  const shots = run.bullets.filter(b => b.from === 'e');
  assert.equal(shots.length, 10);
  for (const b of shots) {
    const originX = b.x - b.vx / 60;
    const originY = b.y - b.vy / 60;
    assert.ok(Math.hypot(originX - boss.trinodeParts[0].x, originY - boss.trinodeParts[0].y) < 0.01);
    assert.notEqual(b.kind, 'trinode_edge');
  }
  assert.equal(run.fx.filter(f => f.t === 'trinode_shot').length, 1);
  assert.equal(run.fx.some(f => f.t === 'boss_burst'), false);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const audio = fs.readFileSync(new URL('../src/audio.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');

const triRender = render.slice(render.indexOf("kind === 'boss_trinode'"), render.indexOf("kind === 'boss_croupier'"));
assert.doesNotMatch(triRender, /Math\.PI \/ 4|bossHpBar/);
assert.match(triRender, /COL\.cyan/);
assert.match(triRender, /COL\.purple/);
assert.match(effects, /case 'trinode_break':[\s\S]{0,900}SECTION DESTROYED/);
assert.match(audio, /case 'trinode_break':[\s\S]{0,160}trinode_section_break/);
assert.doesNotMatch(sim, /ROOM_WAGER_DECISION_TIME|roomWagerOffer\.expires/);
assert.match(hud, /wager_accept_click/);
assert.match(hud, /wager_skip_click/);
assert.doesNotMatch(hud, /offer\.expires/);
assert.match(audio, /case 'wager_accept_click':/);
assert.match(audio, /case 'wager_skip_click':/);

console.log('v2.1.210 checks passed: independent TRI sections, active-part radial fire, break FX/audio, +15% speed, persistent wager and button sounds');
