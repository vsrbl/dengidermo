import assert from 'node:assert/strict';
import { WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { createPlayer, makeAbilityChestChoices, makeWeaponChestChoices, rareTierTwoChance } from '../shared/sim.v2-1.js';
import { generateRoom } from '../shared/mapgen.v2-1.js';

const HEROES = ['base', 'living_casino', 'process_controller', 'impact_driver'];
const TIERS = [0, 1, 2, 3];
const REMOVED_IDS = new Set(['impact_push_cooldown']);

function rng32(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6D2B79F5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function player(hero) {
  return createPlayer(`audit_${hero}`, hero, 0, { hero });
}

function key(option) {
  return String(option?.upgrade || option?.weapon || option?.stat || option?.kind || option?.id || 'unknown');
}

assert.equal(WEAPON_CHEST_REWARDS.some(x => REMOVED_IDS.has(String(x?.id))), false, 'removed cards must not remain in the source pool');

const report = {};
for (let heroIndex = 0; heroIndex < HEROES.length; heroIndex++) {
  const hero = HEROES[heroIndex];
  report[hero] = {};
  for (const tier of TIERS) {
    const p = player(hero);
    const rng = rng32(0xA11D0000 + heroIndex * 0x1000 + tier);
    const counts = new Map();
    const rolls = 30000;
    for (let i = 0; i < rolls; i++) {
      const choices = makeWeaponChestChoices(p, rng, 1, tier);
      assert.equal(choices.length, 1, `${hero} tier ${tier}: one-choice chest must never be empty`);
      const option = choices[0];
      assert.equal(REMOVED_IDS.has(String(option.id)), false, `${hero} tier ${tier}: removed option returned`);
      assert.equal(option.disabled, 0, `${hero} tier ${tier}: disabled option returned`);
      counts.set(key(option), (counts.get(key(option)) || 0) + 1);
    }
    for (const slots of [1, 2, 3, 5]) {
      for (let i = 0; i < 600; i++) {
        const choices = makeWeaponChestChoices(p, rng, slots, tier);
        assert.equal(choices.length, slots, `${hero} tier ${tier}: expected ${slots} choices, got ${choices.length}`);
        assert.equal(new Set(choices.map(x => x.id)).size, choices.length, `${hero} tier ${tier}: duplicate choice in one chest`);
        assert.equal(choices.some(x => REMOVED_IDS.has(String(x.id))), false, `${hero} tier ${tier}: removed option in multi-choice chest`);
      }
    }
    const seen = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    assert.ok(seen.length >= 8, `${hero} tier ${tier}: suspiciously small active pool (${seen.length})`);
    assert.ok(seen.every(([, n]) => n >= 25), `${hero} tier ${tier}: eligible option starvation detected`);
    report[hero][tier] = {
      activeOptions: seen.length,
      minPct: +(100 * seen.at(-1)[1] / rolls).toFixed(2),
      maxPct: +(100 * seen[0][1] / rolls).toFixed(2),
      options: Object.fromEntries(seen.map(([id, n]) => [id, +(100 * n / rolls).toFixed(2)]))
    };
  }
}

// Repeat the structural checks in progressed builds, where conditional cards
// enter or leave the pool. This catches stale weights after one-time unlocks.
const progressed = HEROES.map(player);
for (const p of progressed) {
  p.weapons = [...new Set([...p.weapons, 'shotgun', 'seeker', 'rocketgun', 'quarantine_anchor', 'process_saw'])];
  Object.assign(p.stats, {
    bulletFire: 1, bulletFreeze: 1, bulletPoison: 1, bulletChain: 2,
    bulletChainStatuses: 0, drones: 2, droneElementLink: 0,
    impactPushBounce: 1, jumpRebound: 1, ctrlCaptureTier: 3, qrnLinks: 3
  });
}
for (let heroIndex = 0; heroIndex < progressed.length; heroIndex++) {
  const p = progressed[heroIndex];
  const rng = rng32(0xF00D0000 + heroIndex);
  const seen = new Set();
  for (let i = 0; i < 10000; i++) {
    const choices = makeWeaponChestChoices(p, rng, 5, 3);
    assert.equal(choices.length, 5, `${p.hero} progressed: rare WPN chest must have five choices`);
    assert.equal(new Set(choices.map(x => x.id)).size, 5, `${p.hero} progressed: duplicate WPN card`);
    for (const option of choices) {
      assert.equal(REMOVED_IDS.has(String(option.id)), false, `${p.hero} progressed: removed card returned`);
      seen.add(String(option.id));
    }
  }
  assert.ok(seen.size >= 10, `${p.hero} progressed: suspiciously narrow pool (${seen.size})`);
}

// ABL cards use a separate pool. Driver WPN removals must not leak into it and
// every rarity that promises five choices must still be fillable.
for (const hero of HEROES) {
  const p = player(hero);
  const rng = rng32(0xAB100000 + HEROES.indexOf(hero));
  for (const slots of [1, 2, 3, 5]) {
    const fresh = makeAbilityChestChoices(p, rng, slots, 3);
    assert.equal(fresh.length, slots, `${hero}: fresh ABL chest must have ${slots} choices`);
    assert.equal(new Set(fresh.map(x => x.id)).size, slots, `${hero}: duplicate fresh ABL card`);
    assert.equal(fresh.some(x => String(x.id).startsWith('impact_')), false, `${hero}: WPN card leaked into ABL chest`);
  }
  p.active.core = 'field_snap';
  p.active.level = 3;
  p.active.mutations = [];
  p.active.mutationLevels = {};
  for (let i = 0; i < 1000; i++) {
    const developed = makeAbilityChestChoices(p, rng, 5, 3);
    assert.equal(developed.length, 5, `${hero}: developed rare ABL chest must have five choices`);
    assert.equal(new Set(developed.map(x => x.id)).size, 5, `${hero}: duplicate developed ABL card`);
  }
}

assert.deepEqual(TIERS.map(tier => +rareTierTwoChance(tier, 0).toFixed(2)), [0.18, 0.25, 0.38, 0.51]);

// Removing a reward card must not affect world/chest rarity. This roll happens
// in map generation before a hero-specific reward pool is ever consulted.
const rarity = {};
for (let loop = 0; loop < 6; loop++) {
  const counts = [0, 0, 0, 0];
  let total = 0;
  for (let seed = 1; seed <= 2500; seed++) {
    const room = generateRoom((seed * 2654435761) >>> 0, 1, loop, { category: 'normal', modifierIds: [] });
    for (const x of room.interactables || []) {
      if (!['weapon_chest', 'ability_chest'].includes(x?.chest)) continue;
      counts[Math.max(0, Math.min(3, Number(x.chestTier) | 0))]++;
      total++;
    }
  }
  assert.ok(total > 100, `loop ${loop}: not enough choice chests sampled`);
  rarity[loop + 1] = counts.map(n => +(100 * n / total).toFixed(2));
}

console.log(JSON.stringify({ report, rarity }, null, 2));
console.log('chest-weight-audit-v3.0.2-ok');
