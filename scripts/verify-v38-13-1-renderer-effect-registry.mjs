import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { EFFECT_RENDERERS, drawEffect } from '../src/render/effectRenderers.js';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ENEMIES } from '../src/data/enemies.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const rendererSrc = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const effectRenderersSrc = readFileSync(new URL('../src/render/effectRenderers.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function mockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    globalAlpha: 1,
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText() {}
  };
}

const visualEffects = [
  'spark',
  'portal',
  'chain',
  'damageText',
  'critFlash',
  'statusBurst',
  'statusTick',
  'ricochet',
  'afterimage',
  'dashBurst',
  'droneBeam',
  'orbitalHit',
  'explosion'
];

test('v38.13.3 is registered as renderer effect registry foundation', () => {
  assert.equal(VERSION, 'v38.13.3');
  assert.equal(pkg.version, '38.13.3');
  assert.equal(serverPkg.version, '38.13.3');
  assert.match(serverSrc, /nncckkrr signaling v38\.13\.3/);
  assert.match(pkg.scripts['check:all'], /check:v38-13-1/);
  assert.equal(pkg.scripts['check:v38-13-1'], 'node scripts/verify-v38-13-1-renderer-effect-registry.mjs');
});

test('renderer delegates visual effect drawing to the registry module', () => {
  assert.match(rendererSrc, /import \{ drawEffect \} from "\.\/render\/effectRenderers\.js";/);
  assert.doesNotMatch(rendererSrc, /function drawEffect\(/, 'drawEffect implementation should not live in renderer.js');
  for (const type of visualEffects) {
    assert.doesNotMatch(rendererSrc, new RegExp(`fx\\.type === ["']${type}["']`), `${type} branch drifted back into renderer.js`);
  }
  assert.match(rendererSrc, /for \(const fx of snapshot\.effects \|\| \[\]\) drawEffect\(ctx, fx, renderCam\);/);
});

test('effect renderer registry exposes every current visual effect type', () => {
  assert.ok(Object.isFrozen(EFFECT_RENDERERS), 'EFFECT_RENDERERS should be immutable');
  for (const type of visualEffects) {
    assert.equal(typeof EFFECT_RENDERERS[type], 'function', `${type} renderer missing`);
  }
  assert.equal(typeof EFFECT_RENDERERS.shake, 'function', 'shake should be explicitly ignored by draw registry, not accidentally drawn');
  assert.match(effectRenderersSrc, /export const EFFECT_RENDERERS = Object\.freeze\(\{/);
  assert.match(effectRenderersSrc, /export function drawEffect\(ctx, fx, cam\)/);
});

test('drawEffect dispatches through registry and safely ignores unknown types', () => {
  const ctx = mockCtx();
  const cam = { x: 10, y: 20 };
  assert.equal(drawEffect(ctx, { type: 'unknown', x: 0, y: 0, life: 1 }, cam), false);
  assert.equal(drawEffect(ctx, null, cam), false);
  assert.equal(drawEffect(ctx, { type: 'shake', life: 0.1, maxLife: 0.1, power: 4 }, cam), true);
});

test('all current effect renderers can render with minimal effect payloads', () => {
  const cam = { x: 10, y: 20 };
  const base = { x: 100, y: 120, x2: 180, y2: 180, vx: 1, vy: 0, r: 32, radius: 80, amount: 7, status: 'burn', text: '12', angle: 0, skin: 'green', life: 0.1, maxLife: 0.2 };
  for (const type of visualEffects) {
    const ctx = mockCtx();
    assert.equal(drawEffect(ctx, { ...base, type }, cam), true, `${type} renderer did not dispatch`);
    assert.equal(ctx.globalAlpha, 1, `${type} renderer leaked ctx.globalAlpha`);
  }
});

test('v38.13.3 is architecture-only: baseline content remains unchanged', () => {
  assert.deepEqual(Object.keys(ENEMIES).sort(), ['boss', 'grunt', 'runner', 'shooter', 'tank']);
  for (const room of ROOM_SEQUENCE) assert.equal(room.layout, 'open_arena', `${room.id} should keep open_arena in v38.13.3`);
  for (const modifier of Object.values(ROOM_MODIFIERS)) assert.deepEqual(modifier.hooks, {}, `${modifier.id} should remain identity-only in v38.13.3`);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.3 renderer effect registry checks passed`);
