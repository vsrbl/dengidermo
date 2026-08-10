import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import {
  armorCrackMutationProfile,
  buildSnapshot,
  createPlayer,
  createRun,
  shellRipperDamageProfile,
  shellRipperLockDuration,
  startRoom,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:19[6-9]|20[0-4])$/);
if (VERSION === 'v2.1.196') assert.equal(BUILD_ID, 'casino_hit_core_favor_shell_ripper_hotfix');
assert.equal(PROTOCOL, 14);

const enemy = (kind, id, x, y, hp = null) => {
  const def = ENEMIES[kind];
  return {
    id, kind, x, y, hp: hp ?? def.hp, maxHp: hp ?? def.hp, size: def.size,
    spd: def.spd, dmg: def.dmg, armor: def.armor || 0, fireCd: 0,
    bulletSpd: def.bulletSpd || 0, spawnDelay: 0, state: 'move', st: 0
  };
};

function casinoHitFixture(seed, mode = 'normal') {
  const p = createPlayer(`casino-${mode}`, `CASINO ${mode}`, 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  run.director.pauseT = 999;
  run.enemies = [];
  p.invuln = 0;
  p.wagerStats = { ...p.wagerStats, damage: 0 };
  p.economy.money = 100;
  if (mode === 'shield') p.aegisShield = 50;
  if (mode === 'invuln') p.invuln = 5;
  if (mode === 'greed') run.plan.modifierIds = ['greed'];
  run.pendingCasinoRolls = [{
    owner: p.id, at: 0, lvl: 1, outcome: 'HIT', x: p.x, y: p.y,
    symbols: ['DMG', 'DMG', 'BAD'], label: 'CASINO HIT', tone: 'red'
  }];
  return { p, players, run };
}

const originalRandom = Math.random;
try {
  Math.random = () => 0;

  // CASINO HIT is real HP damage and therefore uses the shared damage path.
  {
    const { p, players, run } = casinoHitFixture(1961, 'normal');
    step(run, players, 1 / 60, 1);
    assert.equal(p.hp, 86);
    assert.equal(p.wagerStats.damage, 14);
    assert.equal(run.roomStats.damageTaken, 14);
  }

  // Shared shields and invulnerability now protect against the mutation hit.
  {
    const { p, players, run } = casinoHitFixture(1962, 'shield');
    step(run, players, 1 / 60, 1);
    assert.equal(p.hp, 100);
    assert.equal(p.aegisShield, 36);
    assert.equal(p.wagerStats.damage, 0);
    assert.equal(run.roomStats.damageTaken, 0);
  }
  {
    const { p, players, run } = casinoHitFixture(1963, 'invuln');
    step(run, players, 1 / 60, 1);
    assert.equal(p.hp, 100);
    assert.equal(p.wagerStats.damage, 0);
    assert.equal(run.roomStats.damageTaken, 0);
  }

  // Gold Fever converts the same hit to credits and keeps HP-only contracts clean.
  {
    const { p, players, run } = casinoHitFixture(1964, 'greed');
    step(run, players, 1 / 60, 1);
    assert.equal(p.hp, 100);
    assert.ok(p.economy.money < 100);
    assert.equal(p.wagerStats.damage, 0);
    assert.equal(run.roomStats.damageTaken, 0);
  }
} finally {
  Math.random = originalRandom;
}

// A run with only STATIC CORE must consider CLEAR STATIC STORM a useful prize.
// A clean run without Core or banked debt must still filter that prize out.
let coreClearSeen = 0;
let cleanClearSeen = 0;
for (let seed = 19600; seed < 19840; seed++) {
  for (const withCore of [false, true]) {
    const p = createPlayer(`core-${seed}-${withCore}`, 'CORE POOL', 0);
    if (withCore) p.stats.debtEngine = 1;
    const players = new Map([[p.id, p]]);
    const run = createRun(seed);
    run.runDepth = 4;
    run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
    startRoom(run, players);
    const previews = [run.roomObjective?.prizePreview, run.nextRoomPreview?.objective?.prizePreview]
      .filter(Array.isArray).flat();
    const hasClear = previews.some(x => x?.id === 'clear_debt');
    if (withCore && hasClear) coreClearSeen++;
    if (!withCore && hasClear) cleanClearSeen++;
  }
}
assert.ok(coreClearSeen > 0, 'STATIC CORE never enabled CLEAR STATIC STORM in contract prizes');
assert.equal(cleanClearSeen, 0, 'CLEAR STATIC STORM appeared without Core or banked debt');

// SHELL RIPPER halves its raw unarmored HP damage and doubles armor damage.
{
  const profile = shellRipperDamageProfile(3);
  assert.equal(profile.healthDamage, (14 + 3 * 8) * 0.5);
  assert.equal(profile.armorDamage, (88 + 3 * 58) * 2);
}

// Locked enemies keep only ordinary chase/contact behavior. Shooting, healing,
// auras, summons, boss telegraphs, and every special silhouette stay disabled.
{
  const p = createPlayer('ripper196', 'RIPPER LOCK', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1965);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  run.plan.walls = [];
  run.plan.category = 'boss';
  run.director.pauseT = 999;
  p.active = { core: 'shell_ripper', level: 3, mutations: [] };
  p.activeCd = 0;
  const shooter = enemy('shooter', 'locked-shooter', p.x + 150, p.y, 800);
  const healer = enemy('leech', 'locked-healer', p.x + 170, p.y + 45, 800);
  const anchor = enemy('anchor', 'locked-anchor', p.x + 190, p.y - 45, 800);
  const wounded = enemy('grunt', 'wounded', p.x + 210, p.y + 45, 800);
  wounded.hp = 300;
  const boss = enemy('boss_anchor_cashier', 'locked-boss', p.x + 220, p.y, 1200);
  boss.bossMarks = [{ x: p.x, y: p.y, r: 100, dmg: 99, t: 0.2 }];
  boss.backgroundAddCd = 0;
  run.enemies = [shooter, healer, anchor, wounded, boss];
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  for (const e of [shooter, healer, anchor, wounded, boss]) {
    assert.ok(e.abilityLockT > shellRipperLockDuration(3) - 0.05, `${e.kind} was not ability-locked`);
  }
  assert.deepEqual(boss.bossMarks, [], 'pending boss ability survived SHELL RIPPER');
  const shooterStartX = shooter.x;
  const woundedHp = wounded.hp;
  run.bullets = [];
  step(run, players, 0.5, 2);
  assert.ok(shooter.x < shooterStartX, 'ability-locked enemy lost ordinary chase movement');
  assert.equal(run.bullets.filter(b => b.from === 'e').length, 0, 'ability-locked enemy fired');
  assert.equal(wounded.hp, woundedHp, 'ability-locked healer healed another enemy');
  assert.equal(wounded.anchorT || 0, 0, 'ability-locked anchor kept its aura active');
  assert.equal(run.enemies.filter(e => e.packRole === 'boss_background').length, 0, 'ability-locked boss summoned adds');
  const lockedRow = buildSnapshot(run, players).enemies.find(row => row[0] === shooter.id);
  assert.equal(lockedRow.at(-1), 1, 'SHELL LOCK visual state was not serialized');
}

// ARMOR BREAK mutation is one heavy armor-only blast across the Q activation zone.
{
  const profile = armorCrackMutationProfile(3, 260);
  assert.deepEqual(profile, { radius: 260, armorDamage: 540 });
  const p = createPlayer('armor-break196', 'ARMOR BREAK', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1966);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  run.plan.walls = [];
  run.director.pauseT = 999;
  p.active = { core: 'field_snap', level: 3, mutations: ['armor_crack'] };
  p.activeCd = 0;
  const armored = enemy('tank', 'armor-zone', p.x + 120, p.y, 1000);
  armored.shellHp = 1000; armored.shellMax = 1000;
  const unarmored = enemy('grunt', 'hp-zone', p.x - 120, p.y, 1000);
  run.enemies = [armored, unarmored];
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  assert.ok(armored.shellHp < 1000, 'ARMOR BREAK did not damage armor in the Q zone');
  assert.equal(armored.hp, 1000, 'ARMOR BREAK leaked through armor into HP');
  assert.equal(unarmored.hp, 1000, 'ARMOR BREAK dealt HP damage to an unarmored enemy');
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /bodyRu: coreCleared \? 'НАКОПЛЕННЫЙ СТАТИК И ШТОРМ ЯДРА СНЯТЫ'/);
assert.match(sim, /bodyEn: coreCleared \? 'BANKED STATIC AND CORE STORM CLEARED'/);
assert.match(hud, /навсегда глушит шторм Статик-ядра/);
assert.match(hud, /permanently silences Static Core storms/);
assert.match(hud, /case 'favor_used': \{[\s\S]*?this\.wagerFxBody\(f\)/);
assert.match(sim, /The stripped body still walks and deals ordinary contact damage/);
assert.match(render, /SHELL LOCK/);
assert.match(render, /abilityLock/);

console.log(`v2.1.196 checks passed: Casino damage, Static Core pool (${coreClearSeen} samples), SHELL LOCK suppression/visuals, armor-only mutation, RU/EN`);
