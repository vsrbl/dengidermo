import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { fireWeapon } from '../src/game/combat.js';
import { updateProjectiles } from '../src/game/projectiles.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { finishEnemyKill } from '../src/game/enemyDeath.js';
import { giveWeapon, switchWeapon } from '../src/game/inventory.js';
import { WEAPONS } from '../src/data/weapons.js';
import { DAMAGE_TAGS, EFFECT_DEFS, dealPlayerDamage } from '../src/game/effects.js';

function fresh(weaponId = 'shotgun') {
  const state = createGameState(`FEEL-${weaponId}`);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0; p.hp = 100; p.maxHp = 100;
  state.spawnTimer = 9999;
  giveWeapon(p, weaponId, true);
  switchWeapon(p, weaponId);
  return { state, p };
}

function runAndWatchShake(state, seconds = 1, dt = 1 / 240) {
  const steps = Math.ceil(seconds / dt);
  let saw = false;
  let maxPower = 0;
  for (let i = 0; i < steps; i += 1) {
    updateProjectiles(state, dt);
    const total = state.effects
      .filter((fx) => fx.type === 'shake')
      .reduce((sum, fx) => sum + fx.power, 0);
    if (total > 0) saw = true;
    maxPower = Math.max(maxPower, total);
  }
  return { saw, maxPower };
}

function disableArmor(enemy) {
  if (enemy?.armor) {
    enemy.armor.hp = 0;
    enemy.armor.broken = true;
    enemy.armor.regenCooldown = 9999;
  }
  return enemy;
}

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('shotgun spread is tight enough for a compact cone', () => {
  const spread = WEAPONS.shotgun.spread;
  const pellets = WEAPONS.shotgun.pellets;
  const totalCone = spread * Math.max(0, pellets - 1);
  assert.ok(spread <= 0.14, `per-pellet spread too wide: ${spread}`);
  assert.ok(totalCone <= 0.75, `total cone too wide: ${totalCone}`);
  assert.ok(totalCone >= 0.45, `total cone too narrow / loses shotgun identity: ${totalCone}`);
});

test('camera shake is intentionally rocket-only for now', () => {
  assert.ok(EFFECT_DEFS.hitShake, 'missing hitShake effect definition');
  assert.ok(EFFECT_DEFS.hitShake.hooks.includes('projectile:hit'), 'hitShake is not attached to projectile hit hook');
  assert.equal(WEAPONS.shotgun.effects?.some((effect) => effect.type === 'hitShake'), false, 'shotgun should not have hitShake right now');
  assert.equal(WEAPONS.seeker.effects?.some((effect) => effect.type === 'hitShake'), false, 'seeker should not have hitShake right now');
  const rocketHitShake = WEAPONS.rocket.effects?.find((effect) => effect.type === 'hitShake');
  const rocketScreenShake = WEAPONS.rocket.effects?.find((effect) => effect.type === 'screenShake');
  assert.ok(rocketHitShake, 'rocket has no hitShake effect');
  assert.ok(rocketHitShake.power >= 5 && rocketHitShake.power <= 7, `rocket hitShake power out of range: ${rocketHitShake.power}`);
  assert.ok(rocketScreenShake, 'rocket has no screenShake effect');
  assert.ok(rocketScreenShake.power >= 9 && rocketScreenShake.power <= 12, `rocket screenShake power out of range: ${rocketScreenShake.power}`);
});

test('shotgun and seeker hits deal damage without camera shake', () => {
  for (const weaponId of ['shotgun', 'seeker']) {
    const { state } = fresh(weaponId);
    const e = disableArmor(spawnEnemy(state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500));
    const before = e.hp;
    const ok = fireWeapon(state, 'p1', { angle: 0, weapon: weaponId, fireSeq: 1 });
    assert.equal(ok, true, `${weaponId} failed to fire`);
    const watched = runAndWatchShake(state, weaponId === 'shotgun' ? 0.45 : 1.2);
    assert.ok(e.hp < before, `${weaponId} did not damage boss (${before} -> ${e.hp})`);
    assert.equal(watched.saw, false, `${weaponId} should not create camera shake right now`);
    assert.equal(watched.maxPower, 0, `${weaponId} created unexpected shake power: ${watched.maxPower}`);
  }
});

test('rocket hit/explosion creates visible controlled runtime camera shake', () => {
  const { state } = fresh('rocket');
  disableArmor(spawnEnemy(state, 'boss', 700, 500));
  const ok = fireWeapon(state, 'p1', { angle: 0, weapon: 'rocket', fireSeq: 2 });
  assert.equal(ok, true, 'rocket failed to fire');
  const watched = runAndWatchShake(state, 1.8);
  assert.ok(watched.saw, 'rocket hit/explosion did not create shake');
  assert.ok(watched.maxPower >= 6 && watched.maxPower <= 12.1, `rocket shake is not visible/controlled: ${watched.maxPower}`);
});



test('economy pickup dopamine feel contracts are wired', () => {
  const economyPickups = readFileSync(new URL('../src/game/economyPickups.js', import.meta.url), 'utf8');
  const lootEffects = readFileSync(new URL('../src/game/effects/loot.js', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
  const pickupRenderer = readFileSync(new URL('../src/render/pickupRenderers.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.ok(economyPickups.includes('spawnX') && economyPickups.includes('popDistance'), 'economy pickups should snapshot spawn origin/pop data for client pop-out');
  assert.ok(lootEffects.includes('BASELINE_ECONOMY_ATTRACT_RADIUS'), 'economy pickups should have weak baseline magnet');
  assert.ok(lootEffects.includes('CLEAR_ECONOMY_ATTRACT_RADIUS_BONUS'), 'post-clear pickup radius boost should be explicit and bounded');
  assert.ok(renderer.includes('drawEconomyPickup') && pickupRenderer.includes('pickupVisualPosition') && pickupRenderer.includes('drawPickupTrail'), 'renderer should delegate pickup pop/trail feel from snapshot data to pickupRenderers');
  assert.ok(ui.includes('economyDisplayValues') && ui.includes('install-pulse-3'), 'HUD should tick economy values and scale INSTALL queue pulse');
});




test('player damage numbers render above damaged players and HP HUD red is low-health only', () => {
  const renderer = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
  const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.ok(renderer.includes('drawPlayerDamageNumber'), 'renderer must draw player damage numbers from player.damageImpact');
  assert.ok(renderer.includes('`-${amount}`'), 'player damage number must show the damage received as a negative number');
  assert.ok(renderer.includes('impact.amount'), 'player damage number must use authoritative lastDamageImpact amount');
  assert.ok(!/#hpText\.hp-hit-slam\s*\{[^}]*color\s*:\s*var\(--red\)/m.test(style), 'HP hit-slam class must not leave the HUD HP permanently red');
  assert.ok(/#hpText\.hp-low\s*\{[^}]*color\s*:\s*var\(--red\)/m.test(style), 'HP HUD should be red only in the low-HP state');
});

test('ORB shield facing is snapshot-visible for the renderer', () => {
  const { state, p } = fresh('shotgun');
  p.x = 500; p.y = 500;
  const orb = spawnEnemy(state, 'orbiter', 650, 500);
  updateEnemies(state, 1 / 60);
  assert.ok(Number.isFinite(orb.projectileDefenseFacingX), 'orbiter behavior should set shield facing X');
  assert.ok(Number.isFinite(orb.projectileDefenseFacingY), 'orbiter behavior should set shield facing Y');
  const snapOrb = makeSnapshot(state).enemies.find((e) => e.id === orb.id);
  assert.ok(Number.isFinite(snapOrb.projectileDefenseFacingX), 'snapshot should expose ORB shield facing X');
  assert.ok(Number.isFinite(snapOrb.projectileDefenseFacingY), 'snapshot should expose ORB shield facing Y');
  const enemyRenderers = readFileSync(new URL('../src/render/enemyRenderers.js', import.meta.url), 'utf8');
  assert.ok(enemyRenderers.includes('projectileDefenseFacingX') && enemyRenderers.includes('Math.atan2'), 'ORB renderer should orient the shield arc from snapshot facing');
});

test('player damage creates visible local impact contract without bypassing damage pipeline', () => {
  const { state, p } = fresh('shotgun');
  const hit = dealPlayerDamage(state, p, {
    amount: 18,
    sourceId: 'verify-enemy',
    sourceType: 'verifyEnemyTouch',
    enemyId: 'verify-enemy',
    sourceX: p.x - 40,
    sourceY: p.y,
    tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH]
  });
  assert.equal(hit.done, 18, 'verify damage should actually damage player');
  assert.ok(p.lastDamageImpact?.seq >= 1, 'player should store lastDamageImpact for body/HUD hit feedback');
  assert.ok(state.effects.some((fx) => fx.type === 'playerHit' && fx.targetId === p.id), 'player damage should spawn a world-space playerHit pulse');
  assert.ok(state.effects.some((fx) => fx.type === 'playerDamageImpact' && fx.targetId === p.id), 'player damage should spawn a local screen impact effect');
  assert.ok(state.effects.some((fx) => fx.type === 'shake' && String(fx.source || '').includes(p.id)), 'player damage should add controlled camera shake');
  const renderer = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
  const screenEffects = readFileSync(new URL('../src/render/screenEffects.js', import.meta.url), 'utf8');
  const effects = readFileSync(new URL('../src/render/effectRenderers.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.ok(renderer.includes('drawLocalDamageImpactOverlay') && screenEffects.includes('drawLocalDamageImpactOverlay'), 'renderer should delegate local damage screen overlay to screenEffects');
  assert.ok(screenEffects.includes('drawDirectionalHitMarker'), 'screenEffects should draw a directional hit marker');
  assert.ok(effects.includes('playerHit: drawPlayerHit'), 'effect renderer should include playerHit world pulse');
  assert.ok(ui.includes('hp-hit-slam') && ui.includes('hp-low'), 'HUD should slam on HP drops and pulse at low HP');
});


test('kill combo dopamine moments are host-authoritative and economy rewards use playerEconomy', () => {
  const { state, p } = fresh('shotgun');
  const killCombos = readFileSync(new URL('../src/game/killCombos.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.ok(killCombos.includes('registerKillCombo'), 'kill combo registration must live in game/killCombos.js');
  assert.ok(killCombos.includes('grantMoney(state, player') && killCombos.includes('grantXp(state, player'), 'combo milestone rewards must use playerEconomy grant pipelines');
  assert.ok(killCombos.includes('SIGNAL KILL CHAIN') && killCombos.includes('NNCCKKRR KILL BREACH'), 'combo labels should use nncckkrr setting language with KILL clarity');
  assert.ok(killCombos.includes('KILL_COMBO_VISIBLE_THRESHOLD = 1'), 'combo counter should be visible immediately while milestone names/rewards stay gated');
  for (let i = 0; i < 24; i += 1) {
    const enemy = spawnEnemy(state, 'grunt', 620 + i * 3, 500);
    enemy.hp = 1;
    finishEnemyKill(state, enemy, { ownerId: p.id, kind: 'verifyProjectile' }, { sourceId: p.id, done: 1, killed: true });
    state.time += 0.08;
  }
  assert.ok(state.events.some((event) => event.type === 'kill_combo' && event.count >= 1), 'combo UI should emit immediate kill counter events before 25 kills');
  const enemy25 = spawnEnemy(state, 'grunt', 700, 500);
  enemy25.hp = 1;
  finishEnemyKill(state, enemy25, { ownerId: p.id, kind: 'verifyProjectile' }, { sourceId: p.id, done: 1, killed: true });
  assert.ok(state.events.some((event) => event.type === 'kill_combo' && event.action === 'stack' && event.playerId === p.id && event.count >= 25), 'twenty-five rapid kills should emit local kill_combo stack events');
  assert.ok(state.events.some((event) => event.type === 'economy' && event.action === 'grant_money' && event.sourceType === 'kill_combo'), 'combo milestone should grant GLD through economy events');
  assert.ok(state.events.some((event) => event.type === 'economy' && event.action === 'grant_xp' && event.sourceType === 'kill_combo'), 'combo milestone should grant EXP through economy events');
  assert.ok(main.includes('createMomentFeed') && main.includes('createKillComboFeed'), 'main loop must route events into moment/combo UI feeds');
  assert.ok(ui.includes('setScreenMoment') && ui.includes('setKillCombo'), 'UI should expose screen moment and kill combo renderers');
  assert.ok(style.includes('.screen-moment') && style.includes('.kill-combo') && style.includes('comboCountSlam'), 'dopamine moments and combo counter must have animated styles');
  assert.ok(style.includes('PixelLocal') && style.includes('-webkit-font-smoothing: none'), 'center moment/combo labels should use explicit pixel-terminal font styling');
});


test('screen moments use durable queue and EXIT OPEN trusts host-gated event', () => {
  const momentFeed = readFileSync(new URL('../src/momentFeed.js', import.meta.url), 'utf8');
  const portals = readFileSync(new URL('../src/game/portals.js', import.meta.url), 'utf8');
  assert.ok(momentFeed.includes('MOMENT_FEED_SCHEMA_VERSION = 2'), 'moment feed schema should reflect queued/gated exit hotfix');
  assert.ok(portals.includes('portalActive: true'), 'portal open event should mark the host-gated active portal state');
  assert.ok(momentFeed.includes('!event.portalActive && !matchingPortal?.active'), 'EXIT OPEN should display only when the host-gated event or snapshot says active');
  assert.ok(momentFeed.includes('if (!moment) continue'), 'non-ready moment candidates must not be marked seen and lost forever');
  assert.ok(momentFeed.includes('function buildLoopMoment') && momentFeed.includes('RUN ESCALATION') && momentFeed.includes('LOOP ${loop}'), 'loop changes should create queued full-screen moments');
});

test('orbiter pressure slows players and snapshots the pressure count', () => {
  const pressure = readFileSync(new URL('../src/game/orbiterPressure.js', import.meta.url), 'utf8');
  const simulation = readFileSync(new URL('../src/game/simulation.js', import.meta.url), 'utf8');
  const snapshot = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
  assert.ok(pressure.includes('ORBITER_SLOW_PER_ORB = 0.35'), 'one orbiter should slow by 35%');
  assert.ok(simulation.includes('updateOrbiterPressure(state)'), 'host simulation must update orbiter pressure before player movement');
  assert.ok(simulation.includes('player.orbiterSlowMult'), 'player movement speed must consume orbiter slow multiplier');
  assert.ok(snapshot.includes('orbiterPressure: orbiterPressureSnapshot(p)'), 'snapshot must expose orbiter pressure for UI/prediction');
});

test('central dopamine typography uses sharper Press Start 2P display font without bundling font files', () => {
  const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.ok(style.includes('fonts.googleapis.com/css2?family=Press+Start+2P'), 'style should load the sharper selected web pixel font');
  assert.ok(style.includes('--display-pixel-font: "Press Start 2P"'), 'central display font stack should use Press Start 2P first');
  assert.ok(style.includes('font-family: var(--display-pixel-font)'), 'screen moments/combo should use the display pixel font variable');
});

test('linked armor is data-driven and can appear on random non-tank enemies', () => {
  const variants = readFileSync(new URL('../src/data/armorVariants.js', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../src/game/enemyArmorVariants.js', import.meta.url), 'utf8');
  const loopScaling = readFileSync(new URL('../src/data/loopScaling.js', import.meta.url), 'utf8');
  assert.ok(variants.includes('requiresArmor: false'), 'linked armor should not be tank-only');
  assert.ok(variants.includes('grantsArmor'), 'linked armor should grant an armor shell to eligible non-armor enemies');
  assert.ok(variants.includes('"runner"') && variants.includes('"charger"') && variants.includes('"orbiter"'), 'linked armor should be allowed on normal/anomaly mobs, not just tank');
  assert.ok(runtime.includes('ensureVariantArmor(enemy, variant)') && runtime.includes('enemy.armor = {'), 'armor variant runtime should grant armor through the variant armor pipeline without import cycles');
  assert.ok(runtime.includes('target?.armor?.variant?.id === variant?.id'), 'linked red armor should not chain to another linked red armor mob');
  assert.ok(loopScaling.includes('variantChance: 0.13'), 'linked armor chance should be higher than the earlier rare 4%');
});

test('enemy pathfinding replaces wall detour anti-stuck steering', () => {
  const common = readFileSync(new URL('../src/game/enemyBehaviors/common.js', import.meta.url), 'utf8');
  const pathfinding = readFileSync(new URL('../src/game/enemyPathfinding.js', import.meta.url), 'utf8');
  assert.ok(common.includes('enemyPathDirection'), 'enemy movement should ask the pathfinding layer for blocked target directions');
  assert.ok(pathfinding.includes('ENEMY_PATHFINDING_SCHEMA_VERSION = 2') && pathfinding.includes('buildFlowField') && pathfinding.includes('flowByKey'), 'enemy pathfinding module should own the cached nav-grid flow-field solver');
  assert.ok(!common.includes('applyWallDetour') && !common.includes('wallStuckFor'), 'old wall-detour jitter steering should be removed');
});

let failed = 0;
for (const [status, name, e] of results) {
  if (status === 'ok') console.log('PASS', name);
  else { failed += 1; console.error('FAIL', name); console.error(e?.stack || e); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} feel checks passed`);
