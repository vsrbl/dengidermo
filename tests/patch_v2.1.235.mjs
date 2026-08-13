import assert from 'node:assert/strict';
import { UPGRADES, WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { createPlayer, impactDriverWeaponChoiceWeight, makeWeaponChestChoices } from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.235');
assert.equal(BUILD_ID, 'driver_sequential_weapon_odds');
assert.equal(PROTOCOL, 17);

const wallOption = WEAPON_CHEST_REWARDS.find(x => x.id === 'impact_wall_unlock');
const pushOption = WEAPON_CHEST_REWARDS.find(x => x.id === 'impact_push_unlock');
const normalOption = WEAPON_CHEST_REWARDS.find(x => x.id === 'impact_damage');
const wallUpgrade = UPGRADES.find(x => x.id === 'impact_wall_unlock');
const pushUpgrade = UPGRADES.find(x => x.id === 'impact_push_unlock');
assert.ok(wallOption && pushOption && normalOption && wallUpgrade && pushUpgrade);

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function offeredIds(p, seed, rolls = 250) {
  const rng = seeded(seed);
  const ids = [];
  for (let i = 0; i < rolls; i++) {
    for (const choice of makeWeaponChestChoices(p, rng, 5, 2)) ids.push(String(choice.upgrade || choice.id));
  }
  return ids;
}

// Stage 1: only the first real gun is eligible and its exact normal weight is x2.
{
  const p = createPlayer('driver-stage-1', 'DRIVER', 0, { hero: 'impact_driver' });
  assert.equal(impactDriverWeaponChoiceWeight(p, wallOption, 0), 2);
  assert.equal(impactDriverWeaponChoiceWeight(p, normalOption, 0), 1);
  assert.equal(impactDriverWeaponChoiceWeight(p, wallOption, 2), 2.9);
  assert.equal(impactDriverWeaponChoiceWeight(p, normalOption, 2), 1.45);
  const ids = offeredIds(p, 235001);
  assert.ok(ids.includes('impact_wall_unlock'), 'the first gun never appeared');
  assert.ok(!ids.includes('impact_push_unlock'), 'the second gun appeared before the first');
}

// Stage 2: after the first gun is owned, it disappears and the second receives x2.
{
  const p = createPlayer('driver-stage-2', 'DRIVER', 0, { hero: 'impact_driver' });
  wallUpgrade.apply(p.stats);
  assert.equal(impactDriverWeaponChoiceWeight(p, pushOption, 0), 2);
  assert.equal(impactDriverWeaponChoiceWeight(p, normalOption, 0), 1);
  assert.equal(impactDriverWeaponChoiceWeight(p, pushOption, 2), 2.9);
  const ids = offeredIds(p, 235002);
  assert.ok(!ids.includes('impact_wall_unlock'), 'the owned first gun appeared again');
  assert.ok(ids.includes('impact_push_unlock'), 'the second gun never appeared after the first');
}

// Stage 3: after both discoveries, neither unlock card can return or keep a boost.
{
  const p = createPlayer('driver-stage-3', 'DRIVER', 0, { hero: 'impact_driver' });
  wallUpgrade.apply(p.stats);
  pushUpgrade.apply(p.stats);
  const ids = offeredIds(p, 235003);
  assert.ok(!ids.includes('impact_wall_unlock'));
  assert.ok(!ids.includes('impact_push_unlock'));
  assert.equal(impactDriverWeaponChoiceWeight(p, normalOption, 2), 1.45);
}

console.log('v2.1.235 checks passed: ordered Driver gun unlocks receive exact x2 WPN weight');
