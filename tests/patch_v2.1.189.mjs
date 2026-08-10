import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { buildSnapshot, createPlayer, createRun, handleRerollOffer, startRoom } from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';
import { reconcileRerollAvailability } from '../src/reroll-sync.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:189|19[0-5])$/);
if (VERSION === 'v2.1.189') assert.equal(BUILD_ID, 'reroll_charge_sync_hotfix');
assert.equal(PROTOCOL, 14);

// Initial authoritative state: two charges are available.
let sync = reconcileRerollAvailability(2, 0, null);
assert.deepEqual(sync, { serverLeft: 2, pending: 0, seen: 2, available: 2 });

// One optimistic click hides exactly one charge while the snapshot is stale.
sync = reconcileRerollAvailability(2, 1, sync.seen);
assert.deepEqual(sync, { serverLeft: 2, pending: 1, seen: 2, available: 1 });

// Critical regression: when the server confirms 2 -> 1, the optimistic click is
// acknowledged. The remaining server charge must stay visible in the chest.
sync = reconcileRerollAvailability(1, sync.pending, sync.seen);
assert.deepEqual(sync, { serverLeft: 1, pending: 0, seen: 1, available: 1 });

// The final click and acknowledgement cleanly reach zero.
sync = reconcileRerollAvailability(1, 1, sync.seen);
assert.equal(sync.available, 0);
sync = reconcileRerollAvailability(0, sync.pending, sync.seen);
assert.deepEqual(sync, { serverLeft: 0, pending: 0, seen: 0, available: 0 });

// Two fast clicks before snapshots are also reconciled one acknowledgement at a time.
sync = reconcileRerollAvailability(2, 2, 2);
assert.equal(sync.available, 0);
sync = reconcileRerollAvailability(1, sync.pending, sync.seen);
assert.deepEqual(sync, { serverLeft: 1, pending: 1, seen: 1, available: 0 });
sync = reconcileRerollAvailability(0, sync.pending, sync.seen);
assert.deepEqual(sync, { serverLeft: 0, pending: 0, seen: 0, available: 0 });

// Server-side behavior remains authoritative and spends only one of two charges.
const player = createPlayer('reroll189', 'REROLL', 0);
const players = new Map([[player.id, player]]);
const run = createRun(189);
startRoom(run, players);
run.contractFavorsActive = [{ id: 'epic_reroll', label: 'DOUBLE REROLL', uses: 2, used: 0, persistent: 1 }];
player.weaponChestOffer = {
  choices: WEAPON_CHEST_REWARDS.slice(0, 3),
  slotCount: 3,
  valueTier: 0,
  chestId: 'qa',
  rerollAnimSeq: 0
};
assert.equal(handleRerollOffer(run, players, player, 'weapon'), true);
assert.equal(run.contractFavorsActive[0].used, 1);
const snapshot = buildSnapshot(run, players);
const reroll = snapshot.room.contractFavors.active.find(f => f.id === 'epic_reroll');
assert.ok(reroll);
assert.equal(reroll.uses, 1);

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
assert.match(hud, /reconcileRerollAvailability/);
assert.match(hud, /localRerollServerLeft/);
assert.doesNotMatch(hud, /return Math\.max\(0, serverLeft - Math\.max\(0, Number\(this\.localRerollSpent/);

console.log('v2.1.189 checks passed: optimistic rerolls reconcile with server charges without double subtraction');
