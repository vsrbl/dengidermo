import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  controlledProcessDeathHealValue,
  createPlayer,
  createRun,
  expireControlledProcess,
  startRoom,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:19[89]|20[0-4])$/);
if (VERSION === 'v2.1.198') assert.equal(BUILD_ID, 'controller_process_lifetime_heal_hotfix');
assert.equal(PROTOCOL, 14);

const process = (id, extra = {}) => ({
  id, kind: 'tank', x: 500, y: 500, size: 30,
  hp: 400, maxHp: 400, ttl: 0.01, maxT: 20,
  state: 'move', st: 0, ...extra
});

// A natural lifetime timeout frees the occupied process slot and pays healing.
{
  const p = createPlayer('ttl-heal198', 'TTL HEAL', 0, { hero: 'process_controller' });
  const players = new Map([[p.id, p]]);
  const run = createRun(1980);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  run.director.pauseT = 999;
  run.enemies = [];
  p.stats.ctrlDeathHeal = 2;
  p.hp = 50;
  p.processController.controlled = [process('natural-timeout')];
  step(run, players, 1 / 60, 1);
  assert.equal(p.processController.controlled.length, 0, 'expired process did not free its slot');
  assert.equal(p.hp, 70, 'natural lifetime completion did not restore HP');
}

// The same lifetime continues during INSTALL, so an INSTALL timeout also pays.
{
  const p = createPlayer('install-heal198', 'INSTALL HEAL', 0, { hero: 'process_controller' });
  const players = new Map([[p.id, p]]);
  const run = createRun(1981);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  p.stats.ctrlDeathHeal = 2;
  p.hp = 50;
  p.processController.pendingControlled = [process('install-timeout')];
  p.economy.pending = 1;
  run.phase = 'install';
  step(run, players, 1 / 60, 1);
  assert.equal(p.processController.pendingControlled.length, 0);
  assert.equal(p.hp, 70, 'INSTALL lifetime completion did not restore HP');
}

// Combat destruction and bomber self-destruct still pay; external release does not.
{
  const p = createPlayer('reason-heal198', 'REASON HEAL', 0, { hero: 'process_controller' });
  p.stats.ctrlDeathHeal = 2;
  assert.equal(controlledProcessDeathHealValue(p, process('value')), 20);
  const run = { fx: [] };
  p.hp = 10;
  expireControlledProcess(run, p, process('hp'), 'hp');
  expireControlledProcess(run, p, process('bomb'), 'self_destruct');
  expireControlledProcess(run, p, process('ttl'), 'ttl');
  expireControlledProcess(run, p, process('install'), 'install');
  assert.equal(p.hp, 90);
  expireControlledProcess(run, p, process('portal'), 'portal');
  expireControlledProcess(run, p, process('released'), 'released');
  assert.equal(p.hp, 90, 'external process removal incorrectly restored HP');
  const paid = process('paid', { deathHealPaid: 1 });
  expireControlledProcess(run, p, paid, 'ttl');
  assert.equal(p.hp, 90, 'one process paid healing more than once');
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /reason === 'ttl' \|\| reason === 'install'/);
assert.match(data, /Гибель или завершение срока процесса/);
assert.match(i18n, /process death or completed control lifetime/);

console.log('v2.1.198 checks passed: HP death, self-destruct, natural TTL and INSTALL timeout heal; external release does not');
