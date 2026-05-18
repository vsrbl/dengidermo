import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { applyUpgrade, offerUpgradeChoices } from '../src/game/upgrades.js';
import { RARITY_META, UPGRADES, canOfferUpgrade, rollUpgradeOffer, scoreUpgradeCandidate } from '../src/data/upgrades.js';
import { activeSynergies, synergyEffectsForPlayer, synergyOfferMeta, SYNERGY_RULES } from '../src/data/synergies.js';
import { buildPlayerEffects, buildProjectileEffects, EFFECT_DEFS } from '../src/game/effects.js';
import { WEAPONS } from '../src/data/weapons.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { fireWeapon } from '../src/game/combat.js';
import { updateHostWorld } from '../src/game/simulation.js';
import { updateCompanions } from '../src/game/companions.js';

const upgradesSrc = readFileSync(new URL('../src/data/upgrades.js', import.meta.url), 'utf8');
const synergiesSrc = readFileSync(new URL('../src/data/synergies.js', import.meta.url), 'utf8');
const gameUpgradesSrc = readFileSync(new URL('../src/game/upgrades.js', import.meta.url), 'utf8');
const effectsSrc = readFileSync(new URL('../src/game/effects.js', import.meta.url), 'utf8');
const companionsSrc = readFileSync(new URL('../src/game/companions.js', import.meta.url), 'utf8');
const uiSrc = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function base(seed = 'V37') {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.hp = 100; p.maxHp = 100;
  state.spawnTimer = 9999;
  return { state, p };
}

function tick(state, seconds = 1, dt = 1 / 120) {
  for (let i = 0; i < Math.ceil(seconds / dt); i += 1) updateHostWorld(state, { p1: { aimAngle: 0 } }, dt);
}

test('upgrade economy has rarity metadata and anti-duplicate scoring', () => {
  assert.ok(RARITY_META.common && RARITY_META.uncommon && RARITY_META.rare, 'rarity table incomplete');
  assert.equal(RARITY_META.corrupted.reservedFor, 'future cursed upgrades');
  for (const upgrade of Object.values(UPGRADES)) {
    assert.ok(upgrade.rarity, `${upgrade.id} missing rarity`);
    assert.ok(Array.isArray(upgrade.tags) && upgrade.tags.length, `${upgrade.id} missing tags`);
    assert.ok(Number.isFinite(upgrade.maxStacks), `${upgrade.id} missing maxStacks`);
  }
  const { state, p } = base('RARITY-SCORE');
  const first = scoreUpgradeCandidate(p, 'heavyPayload', state).score;
  p.upgrades.offered.heavyPayload = 3;
  p.upgrades.taken.heavyPayload = 2;
  const later = scoreUpgradeCandidate(p, 'heavyPayload', state).score;
  assert.ok(later < first, 'repeat/stack penalty should lower repeated offer score');
});

test('offer generator respects maxStacks and stores offer metadata in snapshot', () => {
  const { state, p } = base('OFFER-META');
  p.upgrades.taken.teleportDash = UPGRADES.teleportDash.maxStacks;
  assert.equal(canOfferUpgrade(p, 'teleportDash'), false, 'maxed single-stack upgrade still offerable');
  const offer = rollUpgradeOffer(state.rng, p, 3, state);
  assert.equal(offer.choices.includes('teleportDash'), false, 'roll offered maxed upgrade');
  offerUpgradeChoices(state, p, 3);
  const snap = makeSnapshot(state).players.find((player) => player.id === 'p1');
  assert.equal(snap.upgrades.choices.length, 3, 'snapshot missing choices');
  for (const id of snap.upgrades.choices) {
    assert.ok(snap.upgrades.offers[id]?.rarity, `snapshot missing offer rarity for ${id}`);
    assert.ok(Number.isFinite(snap.upgrades.offers[id]?.nextStack), `snapshot missing stack meta for ${id}`);
  }
});

test('synergy rules are data-driven and influence offers without UI hardcoding', () => {
  assert.ok(SYNERGY_RULES.length >= 4, 'not enough synergy rules registered');
  assert.match(synergiesSrc, /ARCHITECTURE GUARD: synergy rules are data/, 'synergy guard missing');
  assert.match(gameUpgradesSrc, /rollUpgradeOffer/, 'game upgrade offers do not use economy offer generator');
  assert.match(uiSrc, /upgrade-meta/, 'UI does not render rarity/synergy metadata');
  const { state, p } = base('SYNERGY-OFFER');
  p.upgrades.taken.burnMark = 1;
  const chain = synergyOfferMeta(p, 'chainFork', UPGRADES.chainFork);
  assert.ok(chain.hints.includes('BURN CHAIN'), 'candidate that completes a synergy should expose hint');
  assert.ok(scoreUpgradeCandidate(p, 'chainFork', state).score > scoreUpgradeCandidate(p, 'chainFork', { ...state, locationIndex: 0 }).score * 0.9, 'score should remain valid for synergy candidate');
});

test('runtime synergy effects merge through existing effect pipeline', () => {
  const { p } = base('RUNTIME-SYNERGY');
  p.upgrades.taken.burnMark = 1;
  p.upgrades.taken.chainFork = 1;
  p.upgrades.taken.critChip = 1;
  p.upgrades.taken.lifesteal = 1;
  p.upgrades.taken.drone = 1;
  p.upgrades.taken.teamAura = 1;
  const active = activeSynergies(p).map((rule) => rule.id);
  assert.ok(active.includes('burnChain'), 'burn+chain synergy inactive');
  assert.ok(active.includes('critLeech'), 'crit+lifesteal synergy inactive');
  assert.ok(active.includes('droneAura'), 'drone+team aura synergy inactive');
  assert.ok(synergyEffectsForPlayer(p, 'projectile').some((effect) => effect.type === 'chainStatus'), 'burnChain did not create projectile derived effect');
  assert.ok(buildProjectileEffects(p, WEAPONS.shotgun, 'shotgun').some((effect) => effect.type === 'chainStatus'), 'derived projectile synergy did not reach projectile effects');
  assert.ok(buildPlayerEffects(p).some((effect) => effect.type === 'companionBoost'), 'derived player synergy did not reach player effects');
  assert.ok(EFFECT_DEFS.chainStatus && EFFECT_DEFS.companionBoost, 'synergy effect defs missing');
});

test('burn + chain is real gameplay, not just an offer hint', () => {
  const { state, p } = base('BURN-CHAIN-GAMEPLAY');
  p.upgrades.taken.burnMark = 1;
  p.upgrades.taken.chainFork = 1;
  p.x = 420; p.y = 500;
  const e1 = spawnEnemy(state, 'grunt', 560, 500);
  const e2 = spawnEnemy(state, 'grunt', 650, 500);
  fireWeapon(state, 'p1', { x: p.x, y: p.y, aimAngle: 0, weaponId: 'shotgun', fireSeq: 1 });
  tick(state, 0.45);
  assert.ok(!state.enemies[e1.id] || state.enemies[e1.id].status?.burn || state.effects.some((fx) => fx.type === 'chain'), 'first enemy did not process hit/chain');
  assert.ok(!state.enemies[e2.id] || state.enemies[e2.id].status?.burn || state.enemies[e2.id].hp < 100, 'chain target did not receive real chained status/damage');
});

test('companion synergy changes companion damage through PLAYER_TICK pipeline', () => {
  const { state, p } = base('COMPANION-SYNERGY');
  p.upgrades.taken.drone = 1;
  const enemyA = spawnEnemy(state, 'boss', p.x + 240, p.y);
  updateCompanions(state, 0.1);
  const beforeA = enemyA.hp;
  tick(state, 2.0);
  const damageWithout = beforeA - (state.enemies[enemyA.id]?.hp || 0);

  const { state: state2, p: p2 } = base('COMPANION-SYNERGY-ON');
  p2.upgrades.taken.drone = 1;
  p2.upgrades.taken.teamAura = 1;
  const enemyB = spawnEnemy(state2, 'boss', p2.x + 240, p2.y);
  updateCompanions(state2, 0.1);
  const beforeB = enemyB.hp;
  tick(state2, 2.0);
  const damageWith = beforeB - (state2.enemies[enemyB.id]?.hp || 0);
  assert.ok(damageWith > damageWithout, `companion synergy did not raise damage (${damageWithout} -> ${damageWith})`);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v37 economy checks passed`);
