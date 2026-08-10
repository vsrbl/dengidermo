import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  activeCoreUsesPlacementTarget,
  createPlayer,
  createRun,
  processControllerWeaponCooldown,
  setProcessControllerWeaponCooldown,
  startRoom,
  step,
  stepProcessControllerWeaponCooldowns
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:18[6-9]|19[0-9]|200)$/);
if (VERSION === 'v2.1.186') assert.equal(BUILD_ID, 'active_targeting_controller_cooldowns_hotfix');
assert.ok(PROTOCOL >= 13);

for (const core of ['blood_ring', 'field_snap', 'bullet_freeze', 'shell_ripper', 'black_box', 'debt_pulse']) {
  assert.equal(activeCoreUsesPlacementTarget(core), false, `${core} incorrectly requires placement targeting`);
}
assert.equal(activeCoreUsesPlacementTarget('signal_spike'), VERSION === 'v2.1.186');
assert.equal(activeCoreUsesPlacementTarget('void_cut'), true);

function pressQ(core) {
  const player = createPlayer(`q-${core}`, 'Q QA', 0);
  const players = new Map([[player.id, player]]);
  const run = createRun(186);
  startRoom(run, players);
  player.active = { core, level: 1, mutations: [] };
  player.wantActive = true;
  step(run, players, 1 / 60, 1);
  return { player, run };
}

const instantResults = new Map();
for (const core of ['blood_ring', 'field_snap', 'bullet_freeze', 'shell_ripper', 'black_box', 'debt_pulse']) {
  const result = pressQ(core);
  instantResults.set(core, result);
  assert.equal(result.player.activeTargeting, null, `${core} opened a placement preview`);
  assert.ok(result.player.activeCd > 0, `${core} did not cast on the first Q press`);
}
const ring = instantResults.get('blood_ring');
assert.ok(ring.run.activeFields.some(field => field.kind === 'blood_ring'), 'Blood Ring field was not deployed');

const spike = pressQ('signal_spike');
if (VERSION === 'v2.1.186') {
  assert.equal(spike.player.activeTargeting?.kind, 'radius', 'Signal Spike lost its placement preview');
  assert.equal(spike.player.activeTargeting?.core, 'signal_spike');
} else {
  assert.equal(spike.player.activeTargeting, null, 'Signal Spike kept the removed radius preview');
  assert.ok(spike.run.activeFields.some(field => field.kind === 'signal_spike'), 'Signal Spike did not deploy on one Q');
}

const cut = pressQ('void_cut');
assert.equal(cut.player.activeTargeting?.kind, 'void', 'Void Cut lost its line builder preview');

const controller = createPlayer('ctrl-cd', 'CTRL CD', 0, { hero: 'process_controller' });
controller.weapons = ['command_pulse', 'quarantine_anchor', 'process_saw'];
controller.weaponIdx = 0;
setProcessControllerWeaponCooldown(controller, 'command_pulse', 6);
setProcessControllerWeaponCooldown(controller, 'quarantine_anchor', 0);
setProcessControllerWeaponCooldown(controller, 'process_saw', 12);
controller.weaponIdx = 1;
stepProcessControllerWeaponCooldowns(controller, 1);
assert.equal(processControllerWeaponCooldown(controller, 'command_pulse'), 5, 'CMD cooldown did not continue in background');
assert.equal(processControllerWeaponCooldown(controller, 'quarantine_anchor'), 0, 'unused QRN inherited another weapon cooldown');
assert.equal(processControllerWeaponCooldown(controller, 'process_saw'), 11, 'SAW cooldown did not continue in background');
assert.equal(controller.cd, 0, 'selected ready weapon did not mirror its own cooldown');
controller.weaponIdx = 2;
stepProcessControllerWeaponCooldowns(controller, 2);
assert.equal(processControllerWeaponCooldown(controller, 'command_pulse'), 3);
assert.equal(processControllerWeaponCooldown(controller, 'process_saw'), 9);
assert.equal(controller.cd, 9, 'switching back did not restore the selected weapon cooldown');

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /if \(a\.core !== 'signal_spike'\)[\s\S]*castActiveCore\(run, players, p\);[\s\S]*return;/);
if (VERSION === 'v2.1.186') {
  assert.match(render, /if \(subtle\)[\s\S]*ctx\.arc\(ix, iy, rr, 0, Math\.PI \* 2\)/);
  assert.match(render, /drawRadius\(q, true\)/);
} else {
  assert.doesNotMatch(render, /drawRadius\(q/);
}
assert.match(i18n, /blood_ring: 'Q сразу запускает кровавое кольцо вокруг героя\.'/);
assert.match(i18n, /blood_ring: 'Press Q to deploy the blood ring around you\.'/);

console.log('v2.1.186 compatibility checks passed: selective Q targeting, independent controller weapon cooldowns, RU/EN copy');
