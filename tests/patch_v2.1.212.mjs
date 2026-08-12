import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPlayer, createRun, handleDevCommand, startRoom, step } from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.21[2-4]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.212' ? 'boss_q_silence_fullscreen_signal' : 'solo_offline_hard_fallback');
assert.equal(PROTOCOL, 15);

// The authoritative boss debuff still owns the duration. The visual reads this
// snapshot value and must disappear naturally when the gameplay timer reaches 0.
{
  const p = createPlayer('silence-visual-212', 'VISUAL QA', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(21201);
  run.runDepth = 3;
  startRoom(run, players);
  assert.equal(run.plan.category, 'boss');
  assert.equal(p.bossQSilenceT, 30);
  step(run, players, 1, 1);
  assert.ok(p.bossQSilenceT <= 29 && p.bossQSilenceT > 28.9);
  for (let i = 0; i < 30; i++) step(run, players, 1, i + 2);
  assert.equal(p.bossQSilenceT, 0);
  assert.equal(handleDevCommand(run, players, p, { action: 'boss_q_silence', seconds: 30 }), true);
  assert.equal(p.bossQSilenceT, 30);
  assert.ok(run.fx.some(f => f.t === 'boss_q_silence' && f.id === p.id));
}

const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
assert.match(render, /drawBossSilenceOverlay\(seconds, now\)/);
assert.match(render, /meRow\?\.\[P\.QSILENCE\]/);
assert.match(render, /createRadialGradient/);
assert.match(render, /Q-КАНАЛ ЗАГЛУШЕН/);
assert.match(render, /Q CHANNEL MUTED/);
assert.match(render, /BOSS LOCK/);
assert.match(render, /bossSilenceEntry/);
assert.match(render, /scanY/);
assert.match(render, /strokeRect\(frame/);
const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
assert.match(main, /Q SILENCE 30s/);
const input = fs.readFileSync(new URL('../src/input.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
assert.doesNotMatch(input, /addEventListener\('pointerrawupdate'/);
assert.match(input, /updateCursorPosition\(\)/);
assert.match(input, /_cursorLastVisible/);
assert.match(hud, /addEventListener\('pointermove'/);
assert.match(hud, /if \(!mods\.length && !hasStaticIntel && !hasContractIntel\)/);
assert.match(css, /\.install-next-room[\s\S]{0,700}height: auto !important/);
assert.match(css, /\.contract-choice-card[\s\S]{0,180}transition: none !important/);

console.log('v2.1.212 checks passed: authoritative boss Q silence drives a full-screen animated RU/EN signal');
