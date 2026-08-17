import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { generateRoom } from '../shared/mapgen.v2-1.js';
import { createPlayer, impactDriverWeaponChoiceWeight, makeWeaponChestChoices, rareTierTwoChance } from '../shared/sim.v2-1.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [index, fallback, sim, mapgen, hud, render, css, i18n, pkg] = await Promise.all([
  read('../index.html'), read('../404.html'), read('../shared/sim.v2-1.js'), read('../shared/mapgen.v2-1.js'),
  read('../src/hud.v2-1.js'), read('../src/render.v2-1.js'), read('../style.css'), read('../src/i18n.v2-1.js'), read('../package.json')
]);

assert.equal(VERSION, 'v3.0.3');
assert.equal(BUILD_ID, 'five_band_chest_rarity_visuals');
assert.equal(PROTOCOL, 17);
assert.equal(JSON.parse(pkg).version, '3.0.3');
assert.equal(index, fallback);
for (const html of [index, fallback]) {
  assert.match(html, /style\.css\?v=3\.0\.3/);
  assert.match(html, /main\.v2-1\.js\?v=3\.0\.3/);
}

const seenTiers = new Set();
for (let loop = 0; loop < 6; loop++) {
  for (let seed = 1; seed <= 6000; seed++) {
    const room = generateRoom((seed * 2654435761 + loop * 1013904223) >>> 0, 1, loop, { category: 'normal', modifierIds: [] });
    for (const o of room.interactables || []) {
      if (!['weapon_chest', 'ability_chest'].includes(o?.chest)) continue;
      assert.ok(o.chestTier >= 0 && o.chestTier <= 4, `invalid chest tier ${o.chestTier}`);
      assert.equal(o.slotCount, o.chestTier + 1, `tier ${o.chestTier} must have ${o.chestTier + 1} slots`);
      seenTiers.add(o.chestTier);
    }
  }
}
assert.deepEqual([...seenTiers].sort(), [0, 1, 2, 3, 4], 'all five rarity bands must generate naturally');

for (let seed = 1; seed <= 200; seed++) {
  const first = generateRoom(seed, 0, 0, { category: 'normal', modifierIds: [] });
  const starter = (first.interactables || []).filter(o => o.firstRoomGuaranteed);
  assert.equal(starter.length, 2);
  for (const o of starter) {
    assert.equal(o.chestTier, 1, 'starter two-slot chest must be GOOD');
    assert.equal(o.slotCount, 2);
    assert.equal(o.costMul, 0.43, 'starter final price preservation multiplier changed');
  }
}

const driver = createPlayer('driver', 'driver', 0, { hero: 'impact_driver' });
const weightedProbe = { kind: 'weapon_upgrade', upgrade: 'impact_damage' };
assert.equal(impactDriverWeaponChoiceWeight(driver, weightedProbe, 4), impactDriverWeaponChoiceWeight(driver, weightedProbe, 3), 'UNIQUE must keep old top reward weighting');
assert.equal(rareTierTwoChance(4, 0), rareTierTwoChance(3, 0), 'UNIQUE must not change RAR reward math in visual-only patch');
assert.equal(makeWeaponChestChoices(driver, () => 0.417, 5, 4).length, 5);

assert.match(mapgen, /score >= 1\.02[\s\S]*chestTier = 4[\s\S]*score >= 0\.94[\s\S]*chestTier = 3/);
assert.match(sim, /UNIQUE[\s\S]*УНИКАЛЬНЫЙ/);
assert.match(sim, /o\.chestTier = 4; o\.slotCount = 5;[\s\S]*BOSS KEY/);
assert.match(hud, /class="chest-rarity-badge"/);
assert.doesNotMatch(hud, /chest-tier-4|chest-rarity-card/);
assert.doesNotMatch(render, /rawValueTier|rarityColors|const pips/);
for (let tier = 0; tier <= 4; tier++) {
  assert.match(css, new RegExp(`\\.chest-offer-meta\\.tier-${tier} \\.chest-rarity-badge`));
}
assert.doesNotMatch(css, /chest-rarity-card|unique-chest-mark|#weapon-modal\.chest-tier/);
assert.match(i18n, /'UNIQUE': 'УНИКАЛЬНЫЙ'/);

console.log('v3.0.3 checks passed: fixed 1–5 rarity slots, UNIQUE tier, and rarity styling limited to the top badge');
