// terminal casino roguelike server simulation — single source of truth, no client authority
import {
  WEAPONS, WEAPON_ORDER, ENEMIES, SPAWN_POOLS, UPGRADES, CHESTS,
  WEAPON_CHEST_REWARDS, ABILITY_CHEST_REWARDS, HERO_UPGRADES, BOSS_SIGNATURE_UPGRADE_IDS, ACTIVE_CORES, ACTIVE_MUTATIONS, ACTIVE_MUTATION_SLOTS,
  rollUpgradeChoices, defaultStats, spinCasino, rollRoomSkin, UPGRADE_LABELS, SKIN_PRESETS, BET_STAKES, ROOM_MODS, SPECIAL_ROOMS, ROOM_SEQUENCE
} from './data.v2-1.js';
import { generateRoom, spawnPoint, enemySpawnPoint, portalSpot, mulberry32, WALL_T } from './mapgen.v2-1.js';

const PLAYER_SIZE = 28;
const PLAYER_SPEED = 260;
const PLAYER_HP = 100;
const DASH_DIST = 175;
const DASH_REGEN = 2.5;
const DASH_INVULN = 0.3;
const PICKUP_BASE_MAGNET = 95;
const PICKUP_COLLECT = 30;
const TOUCH_CD = 0.6;
const PLAYER_HIT_INVULN = 0.12;
const DIFFICULTY_MULT = 2; // requested harder pass: roughly 2x pressure versus v2.0.2
const MAX_ENEMIES = 60;
const MAX_BULLETS = 220;
const MAX_PICKUPS = 90;
const INTERACT_DIST = 95;
const FINAL_TARGET_LOOPS = 10;
const ROOMS_PER_LOOP = 4;
const FINAL_TARGET_DEPTH = FINAL_TARGET_LOOPS * ROOMS_PER_LOOP;
const FINAL_BOSS_DEPTH = FINAL_TARGET_DEPTH - 1;
const GOLD_FEVER_DAMAGE_MULT = 5;
const PLAYER_ORBITALS_REMOVED = true;
const OFFER_TIMEOUT = 24;
const STATIC_RAIN_MAX_LEVEL = 99; // no player-facing cap; HUD shows the true stacked level
const HERALD_PATH_FOLLOW_SPEED = 145; // v2.1: herald call-line reroutes slowly; dash changes the route, it does not cancel the line.
const clampStaticRainLevel = v => Math.max(0, Math.min(STATIC_RAIN_MAX_LEVEL, v | 0));



const COMBO_PRIZE_UPGRADE_IDS = new Set(['combo_gld', 'combo_exp', 'combo_hp']);
function comboPrizeUpgradeIdForPlayer(p) {
  const type = String(p?.stats?.comboPrize || 'gld').toLowerCase();
  return COMBO_PRIZE_UPGRADE_IDS.has(`combo_${type}`) ? `combo_${type}` : 'combo_gld';
}
function playerHasBulletElement(p) {
  const s = p?.stats || {};
  return !!((s.bulletFire || 0) > 0 || (s.bulletFreeze || 0) > 0 || (s.bulletPoison || 0) > 0 || (s.tempFire || 0) > 0);
}
function installUpgradeBlockedReason(p, id) {
  const s = p?.stats || {};
  if (!id) return 'NO UPGRADE';
  // Upgrade should never appear before its base system exists.
  if (id === 'droneproc' && !(s.drones > 0)) return 'NEED DRONE';
  if (id === 'drone_element_link' && !(s.drones > 0)) return 'NEED DRONE';
  if (id === 'drone_element_link' && !playerHasBulletElement(p)) return 'NEED ELEMENT';
  if ((id === 'element_amp' || id === 'element_spread') && !playerHasBulletElement(p)) return 'NEED ELEMENT';
  if ((id === 'q_snap' || id === 'q_blood' || id === 'q_over') && !ensureActive(p).core) return 'NEED Q';
  return '';
}
function installUpgradeEligible(p, id) { return !installUpgradeBlockedReason(p, id); }
function eligibleHeroUpgrades(p, tierRoll = null, used = new Set(), comboFilter = () => true) {
  return HERO_UPGRADES.filter(u => {
    if (!u || used.has(u.id)) return false;
    if (!installUpgradeEligible(p, u.id)) return false;
    if (!comboFilter(u.id)) return false;
    if (tierRoll === null || tierRoll === undefined) return true;
    if (tierRoll > 90) return u.tier === 2;
    if (tierRoll > 47) return u.tier === 1;
    return u.tier === 0;
  });
}
function rollCleanInstallChoices(run, p, count = 3) {
  const playerKey = String(p?.id || 'player');
  if (!run.installComboPrizeOfferSeen || typeof run.installComboPrizeOfferSeen !== 'object') run.installComboPrizeOfferSeen = {};
  const canOfferComboPrize = !run.installComboPrizeOfferSeen[playerKey];
  const forbiddenComboPrize = comboPrizeUpgradeIdForPlayer(p);
  const used = new Set();
  const choices = [];
  let comboPrizeOffered = false;
  const luck = p?.stats?.luck || 0;
  function accept(id) {
    if (!id || used.has(id)) return false;
    if (!installUpgradeEligible(p, id)) return false;
    const isComboPrize = COMBO_PRIZE_UPGRADE_IDS.has(id);
    if (isComboPrize) {
      if (!canOfferComboPrize || comboPrizeOffered || id === forbiddenComboPrize) return false;
      comboPrizeOffered = true;
    }
    used.add(id);
    choices.push(id);
    return true;
  }
  // Roll extra candidates first, then filter. This preserves the normal feel but prevents
  // repeated combo-prize offers and never offers the prize type already installed.
  for (const id of rollUpgradeChoices(Math.random, luck, count + 7)) {
    if (choices.length >= count) break;
    accept(id);
  }
  let guard = 0;
  while (choices.length < count && guard++ < 120) {
    const tierRoll = Math.random() * 100 + luck * 4;
    const comboFilter = id => {
      if (!COMBO_PRIZE_UPGRADE_IDS.has(id)) return true;
      return canOfferComboPrize && !comboPrizeOffered && id !== forbiddenComboPrize;
    };
    const pool = eligibleHeroUpgrades(p, tierRoll, used, comboFilter);
    const fallback = eligibleHeroUpgrades(p, null, used, comboFilter);
    const list = pool.length ? pool : fallback;
    if (!list.length) break;
    accept(list[Math.floor(Math.random() * list.length)]?.id);
  }
  if (comboPrizeOffered) run.installComboPrizeOfferSeen[playerKey] = 1;
  return choices.slice(0, count);
}
function makeInstallOffer(run, p) {
  if (!run) return null;
  run.installOfferSeq = ((run.installOfferSeq || 0) + 1) | 0;
  if (run.installOfferSeq <= 0) run.installOfferSeq = 1;
  return { id: run.installOfferSeq, choices: rollCleanInstallChoices(run, p, 3), expires: OFFER_TIMEOUT, total: OFFER_TIMEOUT };
}


const BOSS_SIGNATURE_POOLS = {
  boss_croupier: ['sig_payout_swap', 'sig_false_zero', 'sig_quarantine_buffer', 'sig_emergency_cleanse'],
  boss_hunter_chorus: ['sig_deaf_command', 'sig_hunt_route', 'sig_insurance_process', 'sig_incomplete_delete'],
  boss_hunter_duelist: ['sig_deaf_command', 'sig_hunt_route', 'sig_insurance_process'],
  boss_hunter_marksman: ['sig_deaf_command', 'sig_hunt_route', 'sig_false_zero'],
  boss_hunter_trapper: ['sig_deaf_command', 'sig_incomplete_delete', 'sig_quarantine_buffer'],
  boss_q_revisor: ['sig_red_overdrive', 'sig_aim_glitch', 'sig_quarantine_buffer', 'sig_insurance_process'],
  boss_anchor_cashier: ['sig_emergency_cleanse', 'sig_incomplete_delete', 'sig_false_zero', 'sig_quarantine_buffer'],
  boss: ['sig_quarantine_buffer', 'sig_emergency_cleanse', 'sig_false_zero', 'sig_insurance_process']
};
function bossSignatureChoicesForKind(kind = '', rng = Math.random) {
  const pool = (BOSS_SIGNATURE_POOLS[kind] || BOSS_SIGNATURE_POOLS.boss || []).filter(id => BOSS_SIGNATURE_UPGRADE_IDS.includes(id));
  const fallback = BOSS_SIGNATURE_UPGRADE_IDS.filter(id => !pool.includes(id));
  const merged = [...pool, ...fallback];
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < 3 && guard++ < 80 && used.size < merged.length) {
    const id = merged[Math.floor(rng() * merged.length)];
    if (!id || used.has(id)) continue;
    used.add(id); out.push(id);
  }
  return out;
}
function makeBossSignatureOffer(run, p) {
  if (!run || !p?.bossSignaturePending) return null;
  run.installOfferSeq = ((run.installOfferSeq || 0) + 1) | 0;
  if (run.installOfferSeq <= 0) run.installOfferSeq = 1;
  const choices = (p.bossSignatureChoices || []).filter(id => BOSS_SIGNATURE_UPGRADE_IDS.includes(id)).slice(0, 3);
  return { id: run.installOfferSeq, kind: 'boss_signature', choices: choices.length ? choices : bossSignatureChoicesForKind(p.bossSignatureKind || run.lastBossKind || 'boss'), expires: OFFER_TIMEOUT + 8, total: OFFER_TIMEOUT + 8 };
}
function queueBossSignatureReward(run, players, bossKind = 'boss') {
  const choices = bossSignatureChoicesForKind(bossKind, Math.random);
  run.lastBossKind = bossKind || run.lastBossKind || 'boss';
  for (const p of players.values()) {
    if (!p.connected) continue;
    p.bossSignaturePending = true;
    p.bossSignatureKind = bossKind || 'boss';
    p.bossSignatureChoices = choices.slice(0, 3);
  }
  run.fx.push({ t: 'boss_signature', label: 'THREAT SIGNATURE', kind: bossKind, choices });
}

function ensureInstallOffer(run, p) {
  if (!p || !p.connected) return null;
  if (!p.offer && p.bossSignaturePending) p.offer = makeBossSignatureOffer(run, p);
  if (p.offer) return p.offer;
  if ((p.economy?.pending || 0) <= 0) return null;
  if (!p.offer) p.offer = makeInstallOffer(run, p);
  return p.offer;
}

function installWaitSnapshot(run, players) {
  if (!run || run.phase !== 'install') return null;
  const list = [];
  let total = 0, waiting = 0, ready = 0;
  let nextExpires = 0, nextTotal = 0;
  for (const p of players.values()) {
    if (!p.connected) continue;
    total++;
    const hasOffer = !!p.offer;
    const pendingInstall = Math.max(0, p.economy?.pending || 0);
    const pendingSignature = !!p.bossSignaturePending;
    const needsPick = hasOffer || pendingInstall > 0 || pendingSignature;
    if (needsPick) {
      waiting++;
      if (p.offer && Number.isFinite(Number(p.offer.expires))) {
        const ex = Math.max(0, Number(p.offer.expires));
        nextExpires = nextExpires > 0 ? Math.min(nextExpires, ex) : ex;
        const totalEx = Math.max(1, Number(p.offer.total || p.offer.expires || 0));
        nextTotal = nextTotal > 0 ? Math.max(nextTotal, totalEx) : totalEx;
      }
    } else ready++;
    list.push({
      id: p.id,
      name: p.name || p.id,
      waiting: needsPick ? 1 : 0,
      picked: needsPick ? 0 : 1,
      pending: pendingInstall,
      signature: pendingSignature ? 1 : 0,
      offerId: p.offer?.id || 0,
      kind: p.offer?.kind || (pendingSignature ? 'boss_signature' : ''),
      total: p.offer?.total || 0
    });
  }
  return { total, waiting, ready, players: list, nextExpires: Math.max(0, nextExpires || 0), nextTotal: Math.max(1, nextTotal || nextExpires || 0) };
}

// v2.1: active abilities were reading too hard. Keep the fantasy, but cut duration/radius/power by ~1.5x.
const ACTIVE_BALANCE_SCALE = 2 / 3;
const activeScale = v => v * ACTIVE_BALANCE_SCALE;
const activeSoftMul = v => 1 - (1 - v) * ACTIVE_BALANCE_SCALE;

export const ENEMY_KINDS = Object.keys(ENEMIES); // index -> kind
const KIND_IDX = Object.fromEntries(ENEMY_KINDS.map((k, i) => [k, i]));
const SKIN_BY_ID = Object.fromEntries(SKIN_PRESETS.map(s => [s.id, s]));
const ROOM_ARCHETYPES = ['panic_box','compact','standard','wide','long_lane','lounge','boss'];
function sanitizeDevRoomOverride(cmd = {}) {
  const category = ROOM_SEQUENCE.includes(cmd.category) || cmd.category === 'chill' ? String(cmd.category) : '';
  const specialRoomId = cmd.specialRoomId && SPECIAL_ROOMS[cmd.specialRoomId] ? String(cmd.specialRoomId) : '';
  const archetype = ROOM_ARCHETYPES.includes(cmd.archetype) ? String(cmd.archetype) : '';
  const modifierIds = Array.isArray(cmd.modifierIds)
    ? [...new Set(cmd.modifierIds.map(String).filter(id => ROOM_MODS[id]))].slice(0, 4)
    : [];
  if (!category && !specialRoomId && !archetype && !modifierIds.length) return null;
  return { category: category || '', specialRoomId: specialRoomId || '', archetype: archetype || '', modifierIds };
}
function devOverrideLabel(o = {}) {
  if (!o) return 'AUTO';
  const bits = [];
  if (o.category) bits.push(o.category.toUpperCase());
  if (o.specialRoomId) bits.push(o.specialRoomId.toUpperCase());
  if (o.archetype) bits.push(o.archetype.toUpperCase());
  if (o.modifierIds?.length) bits.push(o.modifierIds.map(x => x.toUpperCase()).join('+'));
  return bits.join(' / ') || 'AUTO';
}

function loopEconomyMul(run) {
  // Reward/economy multiplier: keep payouts readable and avoid feeding the loop too hard.
  const loop = Math.max(0, Math.floor((run?.runDepth || 0) / 4));
  const late = Math.max(0, loop - 2);
  return Math.max(1, Math.min(80, Math.pow(1.42, loop) + late * 0.55));
}

function loopBscLootMul(run) {
  const loop = Math.max(0, Math.floor((run?.runDepth || 0) / 4));
  const late = Math.max(0, loop - 2);
  // BSC loot must keep up with late-loop prices faster than normal mob drops.
  return Math.max(1, Math.min(520, Math.pow(1.42, loop * 4) + late * 2.4));
}
function mobLootMul(run) {
  const loop = Math.max(0, Math.floor((run?.runDepth || 0) / 4));
  const late = Math.max(0, loop - 1);
  // Moderate scaling: every loop is worth more, but mob drops do not explode.
  return Math.max(1, Math.min(9, 1 + loop * 0.22 + late * 0.10));
}
function loopCostMul(run, speedDiv = 1) {
  // Price scaling can be tuned per system without touching loot scaling.
  // Higher speedDiv = slower price growth across depth/loop.
  const div = Math.max(0.25, Number(speedDiv) || 1);
  const depth = Math.max(0, Number(run?.runDepth || 0) / div);
  const loop = Math.max(0, Math.floor(depth / 4));
  const within = depth % 4;
  const base = Math.pow(3.52, loop) * (1 + within * 0.27);
  const late = Math.max(0, loop - 2);
  return Math.max(1, Math.min(340, base + late * late * 1.72));
}
function roundCost(v) { return Math.max(1, Math.round(v / 5) * 5); }
function staticSourceAdd(map, source, level) {
  const id = String(source || 'static_debt');
  const n = Math.max(0, level | 0);
  if (!n) return map || {};
  const out = map && typeof map === 'object' ? map : {};
  out[id] = Math.max(0, (out[id] || 0) | 0) + n;
  return out;
}
function sourceListFromMap(map = {}, fallbackId = 'static_debt', expectedTotal = 0) {
  const out = [];
  let sum = 0;
  for (const [id, raw] of Object.entries(map || {})) {
    const level = Math.max(0, raw | 0);
    if (!level) continue;
    out.push({ id, level });
    sum += level;
  }
  const expected = Math.max(0, expectedTotal | 0);
  if (expected > sum) out.push({ id: fallbackId, level: expected - sum });
  return out;
}
function normalizeStaticSources(sources = []) {
  const out = [];
  for (const src of sources || []) {
    const id = String(src?.id || 'static').trim() || 'static';
    const level = Math.max(0, src?.level | 0);
    if (!level) continue;
    const prev = out.find(x => x.id === id);
    if (prev) prev.level += level;
    else out.push({ id, level });
  }
  const rawTotal = out.reduce((n, x) => n + Math.max(0, x.level | 0), 0);
  return { total: clampStaticRainLevel(rawTotal), rawTotal, sources: out };
}
function addStaticDebt(run, stacks = 1, source = 'static_debt') {
  if (!run) return 0;
  const cur = run.staticDebt === true ? 1 : Math.max(0, run.staticDebt || 0);
  const add = Math.max(1, stacks | 0);
  const next = clampStaticRainLevel(cur + add);
  const applied = Math.max(0, next - cur);
  run.staticDebt = next;
  if (applied > 0) run.staticDebtSources = staticSourceAdd(run.staticDebtSources, source, applied);
  return applied;
}
function playerDebtEngineStacks(players) {
  let n = 0;
  if (!players?.values) return 0;
  for (const p of players.values()) n += Math.max(0, p?.stats?.debtEngine || 0);
  return Math.min(STATIC_RAIN_MAX_LEVEL, n | 0);
}
function debtEngineEligiblePlan(plan) {
  return !!plan && plan.category !== 'boss' && plan.specialRoomId !== 'chill_room';
}
function pendingStaticRainSources(run) {
  if (!run) return [];
  const debt = run.staticDebt === true ? 1 : Math.max(0, run.staticDebt || 0);
  const carry = Math.max(0, run.staticRainCarry || 0);
  const out = [];
  if (debt > 0) out.push(...sourceListFromMap(run.staticDebtSources, 'static_debt', debt));
  if (carry > 0) out.push(...sourceListFromMap(run.staticRainCarrySources, 'previous_room_hits', carry));
  return out;
}
function pendingStaticRainLevel(run) {
  return normalizeStaticSources(pendingStaticRainSources(run)).total;
}
function planStaticNaturalLevel(plan = {}) {
  const mods = plan?.modifierIds || plan?.mods || [];
  return mods.includes('static_rain') ? 1 : 0;
}
function planStaticEligible(plan = {}) {
  const cat = plan?.category || plan?.cat || '';
  const special = plan?.specialRoomId || plan?.special || '';
  return !!plan && cat !== 'boss' && special !== 'chill_room';
}
function staticRainActiveBreakdown(run) {
  if (!run) return { total: 0, rawTotal: 0, sources: [] };
  const sources = Array.isArray(run.staticRainSources) ? [...run.staticRainSources] : [];
  const virus = Math.max(0, run.casinoVirus?.activeRainStacks || 0);
  if (virus > 0) sources.push({ id: 'casino_virus', level: virus });
  return normalizeStaticSources(sources);
}
function nextStaticRainBreakdown(run, players = null, plan = null) {
  if (!run) return { total: 0, rawTotal: 0, sources: [], banked: 0, eligible: false };
  const p = plan || run.plan || {};
  const eligible = planStaticEligible(p);
  const sources = [];
  const natural = eligible ? planStaticNaturalLevel(p) : 0;
  if (natural > 0) sources.push({ id: 'room_modifier', level: natural });
  const pendingSources = pendingStaticRainSources(run);
  const pendingTotal = normalizeStaticSources(pendingSources).total;
  if (eligible && pendingTotal > 0) sources.push(...pendingSources);
  const debtEngine = eligible ? playerDebtEngineStacks(players) : 0;
  if (debtEngine > 0) sources.push({ id: 'debt_engine', level: debtEngine });
  const bd = normalizeStaticSources(sources);
  bd.banked = pendingTotal > 0 && !eligible ? pendingTotal : 0;
  bd.eligible = eligible;
  return bd;
}
function nextStaticRainLevel(run, players = null) {
  return nextStaticRainBreakdown(run, players, run?.plan || null).total;
}
function staticRainCurrentMode(run) {
  const bd = staticRainActiveBreakdown(run);
  if (!(bd.total > 0)) return '';
  if ((run.casinoVirus?.activeRainStacks || 0) > 0 && !(run.staticRainStacks > 0)) return 'casino_virus';
  if (run.debtEngineRainStacks > 0 && !run.plan?.modifierIds?.includes('static_rain')) return 'debt_engine';
  if (run.staticRainFromPending && run.staticRainCanSeedNext) return 'paid+seed';
  if (run.staticRainFromPending) return 'paid';
  if (run.staticRainCanSeedNext) return 'seeding';
  return run.plan?.modifierIds?.includes('static_rain') ? 'natural' : 'layer';
}

const REMOVED_ROOM_MODS = new Set(['debt_floor', 'shell_market', 'hunted_exit', 'mirror_room', 'static_wires', 'anchor_gravity']);
function normalizeRoomModifiers(mods = []) {
  const out = [];
  for (const raw of mods || []) {
    let m = raw === 'mirror_room' ? 'moving_room' : raw;
    if (!m || REMOVED_ROOM_MODS.has(m)) continue;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}
function hasMod(run, id) { return !!run?.plan?.modifierIds?.includes(id); }
function isGreedRoom(run) { return hasMod(run, 'greed'); }
function isBloodTaxRoom(run) { return hasMod(run, 'blood_tax'); }
function individualGreedGoldGrant(run, p, amount, label = 'GREED GLD') {
  amount = Math.round(Number(amount) || 0);
  if (!p || !amount) return;
  p.economy.money += amount;
  recordPickupStat(run, 'GLD', Math.max(0, amount));
  run.fx.push({ t: 'pick', id: p.id, name: p.name || '', type: 'GLD', val: amount, x: Math.round(p.x), y: Math.round(p.y), label, personal: 1 });
}
function playerMoneyCost(run, p, amount, srcX = p?.x, srcY = p?.y, label = 'GLD HIT') {
  amount = Math.max(0, Math.round(Number(amount) || 0));
  if (!p || !amount) return 0;
  p.economy.money -= amount; // GREED SIGNAL allows personal GLD debt below zero.
  if (run?.roomStats) run.roomStats.greedDebt = Math.min(0, (run.roomStats.greedDebt || 0) - amount);
  run.fx.push({ t: 'gld_hit', id: p.id, cost: amount, balance: p.economy.money, x: Math.round(srcX ?? p.x), y: Math.round(srcY ?? p.y), label });
  return amount;
}
function bloodTaxHpCost(cost) {
  // Blood Payment has its own HP economy: late-loop GLD prices must not all collapse to 100 HP.
  // Sqrt compression keeps LOW/MID/HIGH distinct and allows deliberate lethal bets.
  const raw = Math.max(1, Number(cost) || 0);
  return Math.max(4, Math.min(92, roundCost(6 + Math.sqrt(raw) * 2.85)));
}
function canPayBloodCost(p, hpCost) { return !!p?.alive && p.hp > 0 && hpCost > 0; }
function payBloodCost(run, p, hpCost, srcX = p?.x, srcY = p?.y, radius = 48) {
  hpCost = Math.max(1, Math.round(Number(hpCost) || 0));
  if (!p?.alive) return false;
  p.hp -= hpCost;
  if (run?.roomStats) { run.roomStats.damageTaken += hpCost; run.roomStats.bloodTaxes = (run.roomStats.bloodTaxes || 0) + 1; }
  run?.fx?.push({ t: 'blood_tax_hit', id: p.id, x: Math.round(srcX ?? p.x), y: Math.round(srcY ?? p.y), r: radius, cost: hpCost });
  if (p.hp <= 0) {
    const favor = consumeContractFavor(run, ['portal_insurance']);
    if (favor) {
      p.hp = Math.min(maxHp(p), 50);
      p.alive = true;
      p.invuln = Math.max(p.invuln || 0, 1.0);
      run.fx.push({ t: 'favor_used', id: favor.id, label: favorLabel(favor), body: '50 HP RESTORED', playerId: p.id });
    } else {
      p.hp = 0; p.alive = false; run.fx.push({ t: 'pdown', id: p.id });
    }
  }
  return true;
}
function forceBigRoomForHunter(run) {
  if (!hasMod(run, 'hunter_contract')) return;
  run.plan.roomArchetype = 'wide';
}
function chestValueInfo(run, o = {}) {
  const type = String(o?.chest || '');
  const rawMul = Math.max(1, Number(o?.costMul || 1));
  const special = String(run?.plan?.specialRoomId || '');
  let tier = 0;
  if (type === 'rare_chest') tier = 1;
  if (type === 'cursed_chest') tier = 2;
  if (rawMul >= 1.75 || special === 'reward_pocket') tier = Math.max(tier, 1);
  if (rawMul >= 7.0) tier = Math.max(tier, 2);
  if (rawMul >= 9.0) tier = Math.max(tier, 3);
  const label = tier >= 3 ? 'PREMIUM' : tier >= 2 ? 'VALUABLE' : tier >= 1 ? 'GOOD' : 'SIMPLE';
  const choiceBonus = tier >= 3 ? 2 : tier >= 1 ? 1 : 0;
  const costValueMul = tier >= 3 ? 1.28 : tier >= 2 ? 1.18 : tier >= 1 ? 1.08 : 1;
  return { tier, label, choiceBonus, costValueMul, rawMul };
}
function effectiveChestCost(run, o) {
  const def = CHESTS[o?.chest];
  if (!def || !def.cost) return 0;
  if (run?.plan?.specialRoomId === 'chill_room') return roundCost(def.cost * 0.72);
  const info = chestValueInfo(run, o);
  let mul = loopCostMul(run, 1.42) * Math.max(1, Number(o?.costMul || 1)) * info.costValueMul;
  return roundCost(def.cost * mul);
}
function casinoStakeCost(run, stakeKey) {
  const base = BET_STAKES[stakeKey];
  if (!base) return 0;
  return roundCost(base * loopCostMul(run, 1.85));
}
function takeCasinoHoldChoices(p, max = 2) {
  const n = Math.max(0, Math.min(max, p?.casinoHoldChoices || 0));
  if (n > 0) p.casinoHoldChoices = Math.max(0, (p.casinoHoldChoices || 0) - n);
  return n;
}
function casinoLockOptionsForStake(stakeKey = 'low') {
  if (stakeKey === 'high') return ['JCK','RAR','WPN','ABL','SKN','GLD'];
  if (stakeKey === 'mid') return ['RAR','WPN','ABL','GLD','EXP','HEA'];
  return ['WPN','GLD','EXP','HEA','CSH'];
}
function grantRareCasinoPrize(run, p, source = 'CASINO RAR') {
  const rng = Math.random;
  const pool = eligibleHeroUpgrades(p, null).filter(u => u.tier === 1);
  const fallback = eligibleHeroUpgrades(p, null).filter(u => u.tier <= 1);
  const list = pool.length ? pool : fallback;
  const u = list[Math.floor(rng() * list.length)];
  if (!u) return '';
  u.apply(p.stats);
  p.hp = Math.min(p.hp, maxHp(p));
  run.fx.push({ t: 'install', id: p.id, label: `${source}: ${u.label}`, personal: 1 });
  return u.label;
}
function casinoStakeTable(run) {
  const table = { low: casinoStakeCost(run, 'low'), mid: casinoStakeCost(run, 'mid'), high: casinoStakeCost(run, 'high') };
  if (isBloodTaxRoom(run)) return { low: bloodTaxHpCost(table.low), mid: bloodTaxHpCost(table.mid), high: bloodTaxHpCost(table.high) };
  return table;
}
function roomModRewardTags(mods = [], special = '') {
  const tags = [];
  if (mods.includes('greed')) tags.push('GLD BONUS');
  if (mods.includes('casino_virus')) tags.push('3 SPINS');
  if (mods.includes('blood_tax')) tags.push('HP COSTS');
  if (mods.includes('skin_cache') || special === 'reward_pocket') tags.push('REWARD↑');
  if (special === 'chill_room') tags.push('SAFE / SHOP');
  return tags.slice(0, 4);
}
function roomPlanMods(plan = {}) { return (plan.modifierIds || plan.mods || []).filter(Boolean); }
function roomPlanSpecial(plan = {}) { return plan.specialRoomId || plan.special || ''; }
function roomPlanCategory(plan = {}) { return plan.category || plan.cat || ''; }
function roomPlanArchetype(plan = {}) { return plan.roomArchetype || plan.archetype || 'standard'; }
function roomDangerScore(plan = {}, staticLevel = 0) {
  const mods = roomPlanMods(plan);
  const special = roomPlanSpecial(plan);
  const cat = roomPlanCategory(plan);
  const arch = roomPlanArchetype(plan);
  if (cat === 'boss') return 5;
  if (special === 'chill_room') return 0;
  let score = 1;
  if (arch === 'panic_box') score += 1;
  else if (arch === 'compact') score += 0.6;
  else if (arch === 'long_lane') score += 0.5;
  else if (arch === 'wide') score += 0.45;
  if (special === 'signal_contract') score += 0.9;
  if (special === 'debt_node') score += 0.75;
  if (special === 'reward_pocket') score += 0.25;
  for (const m of mods) {
    if (m === 'static_rain') score += 0.35 + Math.max(0, staticLevel || 1) * 0.32;
    else if (m === 'hunter_contract' || m === 'casino_virus') score += 1.05;
    else if (m === 'prism_grid' || m === 'moving_room') score += 0.8;
    else if (m === 'blood_tax') score += 0.65;
    else if (m === 'echo_walls') score += 0.7;
    else if (m === 'blackout') score += 0.55;
    else if (m === 'greed' || m === 'skin_cache') score += 0.25;
  }
  return Math.max(0, Math.min(5, Math.round(score)));
}
function roomDangerLabel(level) {
  return ['SAFE', 'LOW', 'MED', 'HIGH', 'SEVERE', 'BOSS'][Math.max(0, Math.min(5, level | 0))] || 'MED';
}
function roomThreatTags(plan = {}, staticLevel = 0) {
  const mods = roomPlanMods(plan);
  const arch = roomPlanArchetype(plan);
  const special = roomPlanSpecial(plan);
  const tags = [];
  if (arch === 'panic_box') tags.push('CLOSE RANGE');
  else if (arch === 'compact') tags.push('DASH SPACE');
  else if (arch === 'wide') tags.push('CROSSFIRE');
  else if (arch === 'long_lane') tags.push('LANES');
  else if (arch === 'lounge') tags.push('SHOP');
  // Static Storm is shown only in the unified top-right stack readout, not duplicated as a threat tag.
  if (mods.includes('hunter_contract')) tags.push('LOCKED WAVES');
  if (mods.includes('casino_virus')) tags.push('3 VIRUS SPINS');
  if (mods.includes('moving_room')) tags.push('DANGER ZONES');
  if (mods.includes('prism_grid')) tags.push('PRISM SLOW');
  if (mods.includes('blood_tax')) tags.push('HP SHOP');
  if (mods.includes('echo_walls')) tags.push('50% ECHO SHOTS');
  if (special === 'signal_contract') tags.push('PRIORITY TARGET');
  if (special === 'chill_room') tags.push('NO ENEMIES');
  return tags.slice(0, 5);
}
function roomTip(plan = {}, staticLevel = 0, staticMode = '') {
  const mods = roomPlanMods(plan);
  const arch = roomPlanArchetype(plan);
  const special = roomPlanSpecial(plan);
  if (special === 'chill_room') return 'SAFE ROOM: buy, BET, then leave when ready.';
  if (roomPlanCategory(plan) === 'boss') return 'BOSS FLOOR: hold space, clear adds, watch burst windows.';
  if (mods.includes('static_rain')) return String(staticMode).startsWith('paid') ? (staticMode === 'paid+seed' ? 'STATIC STACK: banked storm is spent here; natural room strikes still seed the next level.' : 'STATIC PAYOFF: survive the level; strikes here do not seed another storm.') : 'STATIC SEED: each real strike raises the next eligible room level.';
  if (mods.includes('hunter_contract')) return 'HUNTER WAVES: portal stays locked until every wave is dead.';
  if (mods.includes('casino_virus')) return 'CASINO VIRUS: 3 slot events apply after their roll animation; then kill all enemies.';
  if (mods.includes('moving_room')) return 'SHIFTING ZONES: hollow red zones move, slow, and pulse damage.';
  if (mods.includes('prism_grid')) return 'PRISM GRID: pale floor cells slow movement and bullets inside them.';
  if (mods.includes('blood_tax')) return 'BLOOD PAYMENT: bets and buys cost HP. Death Insurance can save a lethal payment.';
  if (mods.includes('echo_walls')) return 'ECHO SHOTS: every projectile has 50% chance to echo, including enemy shots.';
  if (mods.includes('greed')) return 'GOLD FEVER: everything is GLD. Enemies and chests pay more gold; mistakes cost gold instead of HP.';
  if (arch === 'panic_box') return 'PANIC BOX: use dash as a reset, not only as speed.';
  if (arch === 'long_lane') return 'LONG LANE: watch chargers and prism angles before committing.';
  if (arch === 'wide') return 'WIDE FIELD: pick a side and collapse ranged nests.';
  return 'CLEAN ROOM: read the enemy pack and save dash for mistakes.';
}
function roomIntel(plan = {}, staticLevel = 0, staticMode = '') {
  const mods = roomPlanMods(plan);
  const special = roomPlanSpecial(plan);
  const danger = roomDangerScore(plan, staticLevel);
  return {
    danger, dangerLabel: roomDangerLabel(danger),
    threatTags: roomThreatTags(plan, staticLevel),
    rewardTags: roomModRewardTags(mods, special),
    tip: roomTip(plan, staticLevel, staticMode)
  };
}

function roomObjectiveForPlan(plan = {}, depth = 0) {
  const mods = roomPlanMods(plan);
  const arch = roomPlanArchetype(plan);
  const special = roomPlanSpecial(plan);
  const cat = roomPlanCategory(plan);
  if (cat === 'boss') return { id: 'boss_cut', label: 'BOSS CUT', reward: 'FAVOR', goal: 'Kill the boss.' };
  if (special === 'chill_room') return { id: 'lounge_cashout', label: 'SAFE CASHOUT', reward: 'SHOP', goal: 'Leave when ready.' };
  if (mods.includes('hunter_contract')) return { id: 'hunter_waves', label: 'HUNTER WAVES', reward: 'FAVOR', goal: 'Survive every locked hunter wave.' };
  if (mods.includes('casino_virus')) return { id: 'virus_clean', label: 'VIRUS CLEANUP', reward: 'FAVOR', goal: 'Survive 3 virus spins, then kill every enemy.' };
  if (mods.includes('prism_grid')) return { id: 'grid_slow_clear', label: 'PRISM CLEANUP', reward: 'FAVOR', goal: 'Clear the room while the prism cells slow the fight.' };
  if (mods.includes('blood_tax')) return { id: 'blood_paid', label: 'BLOOD CLEANUP', reward: 'FAVOR', goal: 'Spend HP if you dare, then clear the room.' };
  if (mods.includes('static_rain')) return { id: 'static_clean', label: 'STATIC CLEANUP', reward: 'FAVOR', goal: 'Kill every enemy while taking low damage.' };
  if (mods.includes('skin_cache')) return { id: 'cache_claim', label: 'CACHE CLAIM', reward: 'FAVOR', goal: 'Kill every enemy and claim the cache.' };
  if (arch === 'panic_box' || arch === 'compact') return { id: 'fast_clear', label: 'FAST CLEANUP', reward: 'FAVOR', goal: `Kill every enemy before ${fastClearTimeLimit({ plan })}s.` };
  if (arch === 'wide' || arch === 'long_lane') return { id: 'no_hit', label: 'NO-HIT CLEANUP', reward: 'FAVOR', goal: 'Kill every enemy without taking damage.' };
  return { id: 'clean_signal', label: 'FULL CLEANUP', reward: 'FAVOR', goal: 'Kill every enemy in the room.' };
}
function shouldOfferRoomContract(plan = {}, depth = 0, seed = 1) {
  const loop = Math.floor(Math.max(0, depth || 0) / 4);
  if (loop <= 0) return false;
  if (!plan || plan.specialRoomId === 'chill_room') return false;
  const mods = roomPlanMods(plan);
  const rng = mulberry32(((seed || 1) ^ 0xC0472AC7 ^ ((depth || 0) * 2654435761)) >>> 0);
  let chance = 0.68 + Math.min(0.12, Math.max(0, loop - 1) * 0.025);
  if (mods.some(m => ['hunter_contract','casino_virus','static_rain','prism_grid','blood_tax','skin_cache'].includes(m))) chance += 0.12;
  if (roomPlanCategory(plan) === 'boss') chance += 0.08;
  return rng() < Math.min(0.86, chance);
}
function enemyInsideWall(run, e) {
  if (!run?.plan?.walls || !e) return false;
  const half = Math.max(4, (e.size || 24) * 0.28);
  return run.plan.walls.some(w => aabbHit(e.x, e.y, half, w));
}
function enemyInsideWorld(run, e, margin = 180) {
  if (!run?.plan || !e) return false;
  return Number.isFinite(e.x) && Number.isFinite(e.y)
    && e.x >= -margin && e.y >= -margin
    && e.x <= (run.plan.w || 0) + margin && e.y <= (run.plan.h || 0) + margin;
}
function isCombatEnemy(run, e) {
  if (!e || e.hp <= 0) return false;
  if (!ENEMIES[e.kind]) return false;
  if (!enemyInsideWorld(run, e)) return false;
  // If an enemy center is buried in a solid wall, it is not a visible combatant.
  // It will be rescued by sanitizeEnemiesForRoom before it can block cleanup forever.
  if (enemyInsideWall(run, e)) return false;
  return true;
}
function combatEnemies(run) {
  return (run?.enemies || []).filter(e => isCombatEnemy(run, e));
}
function roomHasLiveEnemies(run) {
  return combatEnemies(run).length > 0;
}
function roomQuotaReached(run) {
  const q = Math.max(0, run?.plan?.quota || 0);
  return (run?.kills || 0) >= q || (run?.spawned || 0) >= q;
}
function liveEnemyCount(run) {
  return combatEnemies(run).length;
}
function rescueEnemyToFloor(run, players, e) {
  if (!run || !e) return false;
  const alive = players ? [...players.values()].filter(p => p.alive) : [];
  const p = enemySpawnPoint(mulberry32(((run.tick || 1) * 2654435761 ^ (e.id || '').length * 2246822519) >>> 0), run.plan.walls, alive);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || enemyInsideWall(run, { ...e, x: p.x, y: p.y })) return false;
  const ox = e.x, oy = e.y;
  e.x = p.x; e.y = p.y; e.vx = 0; e.vy = 0; e._stuckT = 0;
  run.fx.push({ t: 'blink', id: e.id, fx: Math.round(ox), fy: Math.round(oy), tx: Math.round(p.x), ty: Math.round(p.y) });
  return true;
}
function sanitizeEnemiesForRoom(run, players = null, dt = 0) {
  if (!run?.enemies) return;
  const before = run.enemies.length;
  run.enemies = run.enemies.filter(e => e && e.hp > 0 && ENEMIES[e.kind] && enemyInsideWorld(run, e, 420));
  if (before !== run.enemies.length && run.roomStats) run.roomStats.cleanedGhostEnemies = (run.roomStats.cleanedGhostEnemies || 0) + before - run.enemies.length;
  for (const e of run.enemies) {
    if (!e || e.hp <= 0) continue;
    if (enemyInsideWall(run, e)) {
      e._stuckT = (e._stuckT || 0) + Math.max(0.05, dt || 0.05);
      if (e._stuckT > 0.75 && players) rescueEnemyToFloor(run, players, e);
    } else {
      e._stuckT = 0;
    }
  }
}
function fastClearTimeLimit(run) {
  const q = Math.max(0, run?.plan?.quota || 0);
  const mods = roomPlanMods(run?.plan || {});
  const arch = roomPlanArchetype(run?.plan || {});
  let limit = 34 + q * 1.55;
  if (arch === 'panic_box') limit -= 3;
  if (arch === 'compact') limit -= 1;
  if (arch === 'wide') limit += 7;
  if (arch === 'long_lane') limit += 10;
  if (mods.includes('casino_virus') || mods.includes('hunter_contract')) limit += 18;
  if (mods.includes('static_rain') || mods.includes('prism_grid') || mods.includes('moving_room')) limit += 8;
  // Spawn waves have real pauses. The contract is still "kill everything fast",
  // but the deadline scales with room size/quota so it cannot become impossible
  // just because the director has not released the last enemies yet.
  return Math.max(42, Math.min(95, Math.round(limit)));
}
function roomObjectiveProgress(run, st = run?.roomStats || {}) {
  const obj = run?.roomObjective;
  if (!obj) return null;
  const time = roomSolvedTime(run, st);
  const fastLimit = fastClearTimeLimit(run);
  const lowDamageLimit = 60 + Math.floor((run?.runDepth || 0) * 1.5);
  const progress = {
    boss_cut: run?.plan?.category === 'boss' ? `${Math.max(0, run?.enemies?.length || 0)} enemies` : '—',
    lounge_cashout: 'READY',
    hunter_waves: run?.hunterWave ? `${Math.min(run.hunterWave.index || 0, run.hunterWave.total || 0)}/${run.hunterWave.total || 0} WAVES` : 'WAVES',
    virus_clean: run?.casinoVirus ? `${Math.max(0, (run.casinoVirus.spinsLeft || 0) + (run.casinoVirus.pendingEvent ? 1 : 0))} SPINS LEFT · ${liveEnemyCount(run)} LEFT` : '3 SPINS',
    wire_ghost: (st.wireTouches || 0) <= 0 ? 'CLEAN' : `${st.wireTouches} TOUCH`,
    grid_ghost: (st.prismHits || 0) <= 0 ? 'CLEAN' : `${st.prismHits} HIT`,
    grid_slow_clear: `${liveEnemyCount(run)} LEFT`,
    blood_paid: `${liveEnemyCount(run)} LEFT${isBloodTaxRoom(run) ? ' · HP PRICES' : ''}`, 
    static_clean: `${Math.round(st.damageTaken || 0)}/${lowDamageLimit} DMG`,
    cache_claim: `${liveEnemyCount(run)} LEFT`,
    fast_clear: `${Math.round(time)}/${fastLimit}s · ${liveEnemyCount(run)} LEFT`,
    no_hit: (st.damageTaken || 0) <= 0 ? 'CLEAN' : `${Math.round(st.damageTaken || 0)} DMG`,
    clean_signal: `${liveEnemyCount(run)} LEFT`
  };
  return progress[obj.id] || '—';
}
function roomObjectiveBasePayout(id = '', depth = 0) {
  id = String(id || '');
  const gld = (id.includes('shell') || id.includes('blood') || id.includes('no_hit') || id === 'clean_signal')
    ? 12 + Math.floor(depth * 1.4)
    : 6 + Math.floor(depth * 0.7);
  const exp = (id.includes('fast') || id.includes('wire') || id.includes('grid') || id.includes('static') || id === 'clean_signal')
    ? 10 + Math.floor(depth * 1.25)
    : 5 + Math.floor(depth * 0.65);
  return { gld: Math.max(0, gld), exp: Math.max(0, exp) };
}
function contractChainPayout(depth = 0, chain = 0) {
  chain = Math.max(0, Math.floor(chain || 0));
  return {
    gld: chain >= 2 ? Math.min(80, 4 * chain + Math.floor(depth * 0.65)) : 0,
    exp: chain >= 2 ? Math.min(70, 3 * chain + Math.floor(depth * 0.55)) : 0
  };
}

const CONTRACT_FAVOR_DEFS = {
  free_reroll: { id: 'free_reroll', label: 'CHEST REROLL', labelRu: 'ПЕРЕБРОС ВЫБОРА', tier: 'common', uses: 1, desc: 'One WPN/ABL choice reroll in the next room.' },
  clear_debt: { id: 'clear_debt', label: 'CLEAR STATIC STORM', labelRu: 'СНЯТЬ СТАТИК-ШТОРМ', tier: 'common', uses: 1, desc: 'Removes one banked Static Storm level before the next room starts.' },
  portal_insurance: { id: 'portal_insurance', label: 'DEATH INSURANCE', labelRu: 'СТРАХОВКА ОТ СМЕРТИ', tier: 'rare', uses: 1, desc: 'Once next room, lethal damage restores you to 50 HP.' },
  epic_reroll: { id: 'epic_reroll', label: 'DOUBLE REROLL', labelRu: 'ДВА ПЕРЕБРОСА ВЫБОРА', tier: 'epic', uses: 2, desc: 'Two WPN/ABL choice rerolls in the next room.' },
  double_favor: { id: 'double_favor', label: 'DOUBLE NEXT PRIZE', labelRu: 'ДВОЙНОЙ СЛЕДУЮЩИЙ ПРИЗ', tier: 'epic', uses: 1, desc: 'If the next room contract succeeds, it grants two contract prizes.' }
};
function favorDef(id) { return CONTRACT_FAVOR_DEFS[String(id || '')] || null; }
function favorLabel(f = {}) { return String((favorDef(f.id)?.label) || f.label || f.id || 'FAVOR'); }
function makeContractFavor(id, sourceChain = 1) {
  const d = favorDef(id) || CONTRACT_FAVOR_DEFS.free_reroll;
  return { id: d.id, label: d.label, labelRu: d.labelRu, tier: d.tier, uses: d.uses || 1, used: 0, sourceChain: Math.max(1, sourceChain | 0), nextRoomOnly: 1 };
}
function activeContractFavors(run) {
  return Array.isArray(run?.contractFavorsActive) ? run.contractFavorsActive : [];
}
function pendingContractFavors(run) {
  return Array.isArray(run?.contractFavorsPending) ? run.contractFavorsPending : [];
}
function activeFavorUses(run, ids = []) {
  const set = new Set(ids.map(String));
  let n = 0;
  for (const f of activeContractFavors(run)) if (set.has(String(f.id))) n += Math.max(0, (f.uses || 0) - (f.used || 0));
  return n;
}
function hasActiveContractFavor(run, id) { return activeFavorUses(run, [id]) > 0; }
function consumeContractFavor(run, ids = []) {
  const set = new Set(ids.map(String));
  for (const f of activeContractFavors(run)) {
    if (!set.has(String(f.id))) continue;
    const left = Math.max(0, (f.uses || 0) - (f.used || 0));
    if (left <= 0) continue;
    f.used = (f.used || 0) + 1;
    return f;
  }
  return null;
}
function removeOneSourceLevel(map = {}) {
  const order = ['cursed_chest','casino_bet','active_casino','bad_tape','debt_pulse','active_reaction','static_debt','previous_room_hits','room_strikes'];
  for (const k of [...order, ...Object.keys(map || {})]) {
    if ((map?.[k] || 0) > 0) {
      map[k] = Math.max(0, (map[k] || 0) - 1);
      if (!map[k]) delete map[k];
      return true;
    }
  }
  return false;
}
function reduceOneStaticDebt(run) {
  const curDebt = run.staticDebt === true ? 1 : Math.max(0, run.staticDebt || 0);
  if (curDebt > 0) { run.staticDebt = clampStaticRainLevel(curDebt - 1); removeOneSourceLevel(run.staticDebtSources || {}); return true; }
  const carry = Math.max(0, run.staticRainCarry || 0);
  if (carry > 0) { run.staticRainCarry = clampStaticRainLevel(carry - 1); removeOneSourceLevel(run.staticRainCarrySources || {}); return true; }
  return false;
}
function activatePendingContractFavors(run) {
  const incoming = pendingContractFavors(run).map(f => ({ ...f, activeDepth: run.runDepth || 0, used: Math.max(0, f.used || 0) }));
  run.contractFavorsPending = [];
  run.contractFavorsActive = incoming;
  run.contractFavorsUsedThisRoom = [];
  for (const f of incoming) {
    if (f.id === 'clear_debt') {
      const ok = reduceOneStaticDebt(run);
      f.used = f.uses || 1;
      run.contractFavorsUsedThisRoom.push({ id: f.id, label: favorLabel(f), ok: ok ? 1 : 0 });
      run.fx.push({ t: 'favor_used', id: f.id, label: favorLabel(f), body: ok ? 'NEXT ROOM STATIC STORM CLEARED' : 'NO STATIC STORM TO CLEAR' });
    }
  }
  if (incoming.length) run.fx.push({ t: 'favor_active', favors: incoming.map(f => favorSnapshotItem(f, true)) });
}
function hasClearableUpcomingStatic(run) {
  const curDebt = run?.staticDebt === true ? 1 : Math.max(0, run?.staticDebt || 0);
  const carry = Math.max(0, run?.staticRainCarry || 0);
  return curDebt > 0 || carry > 0;
}
function nextRoomHasContractTarget(run) {
  const nx = run?.nextRoomPreview || null;
  if (!nx) return false;
  if (nx.special === 'chill_room' || nx.cat === 'chill') return false;
  return !!nx.objective && nx.objective.id && nx.objective.id !== 'lounge_cashout';
}
function contractFavorPool(chain = 1, run = null) {
  let pool = chain >= 4
    ? ['epic_reroll', 'portal_insurance', 'double_favor']
    : chain >= 2
      ? ['free_reroll', 'clear_debt', 'portal_insurance']
      : ['free_reroll', 'clear_debt'];
  // Do not offer the Static Storm remover when there is no banked/upcoming storm to remove.
  if (!hasClearableUpcomingStatic(run)) pool = pool.filter(id => id !== 'clear_debt');
  // Double prize only makes sense when the next location actually has a contract target.
  if (!nextRoomHasContractTarget(run)) pool = pool.filter(id => id !== 'double_favor');
  // When DOUBLE NEXT PRIZE is active, it doubles the next room payout instead of rolling itself again.
  if (hasActiveContractFavor(run, 'double_favor')) pool = pool.filter(id => id !== 'double_favor');
  return pool.length ? pool : ['free_reroll'];
}
function rollContractFavor(run, chain = 1, slot = 0) {
  const pool = contractFavorPool(chain, run);
  const rng = mulberry32(((run?.seedBase || 1) ^ ((run?.runDepth || 0) * 2246822519) ^ (chain * 3266489917) ^ (slot * 668265263)) >>> 0);
  return makeContractFavor(pool[Math.floor(rng() * pool.length)] || 'free_reroll', chain);
}
function buildContractFavors(run, chain = 1, count = 1) {
  count = Math.max(1, Math.min(2, count | 0));
  const favors = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let f = rollContractFavor(run, chain, i);
    if (used.has(f.id)) {
      const pool = contractFavorPool(chain, run).filter(id => !used.has(id));
      if (pool.length) f = makeContractFavor(pool[i % pool.length], chain);
    }
    used.add(f.id);
    favors.push(f);
  }
  return favors;
}
function favorSnapshotItem(f = {}, active = false) {
  const def = favorDef(f.id) || {};
  const left = active ? Math.max(0, (f.uses || 0) - (f.used || 0)) : Math.max(0, f.uses || 0);
  return { id: f.id, label: favorLabel(f), labelRu: f.labelRu || def.labelRu || '', tier: f.tier || def.tier || 'common', uses: left, usesTotal: Math.max(0, f.uses || def.uses || 0), used: Math.max(0, f.used || 0), status: active ? (left > 0 ? 'active' : 'used') : 'pending', desc: def.desc || '', nextRoomOnly: 1 };
}
function grantContractFavors(run, chain = 1, count = 1) {
  const want = Math.max(1, Math.min(2, count | 0));
  let planned = Array.isArray(run?.roomObjective?.prizePreview) && run.roomObjective.prizePreview.length
    ? run.roomObjective.prizePreview.map(f => makeContractFavor(f.id, chain))
    : buildContractFavors(run, chain, want);
  // DOUBLE NEXT PRIZE must pay extra prizes, not clone itself into the payout.
  if (want > 1) planned = planned.filter(f => f.id !== 'double_favor');
  const used = new Set(planned.map(f => f.id));
  while (planned.length < want) {
    const extra = buildContractFavors(run, chain, want).find(f => !used.has(f.id) && f.id !== 'double_favor') || makeContractFavor('free_reroll', chain);
    used.add(extra.id);
    planned.push(extra);
  }
  const favors = planned.slice(0, want);
  run.contractFavorsPending = favors;
  run.fx.push({ t: 'favor_earned', favors: favors.map(f => favorSnapshotItem(f, false)) });
  return favors;
}
function contractFavorSnapshot(run) {
  return {
    active: activeContractFavors(run).map(f => favorSnapshotItem(f, true)),
    pending: pendingContractFavors(run).map(f => favorSnapshotItem(f, false)),
    used: Array.isArray(run?.contractFavorsUsedThisRoom) ? run.contractFavorsUsedThisRoom : []
  };
}
function contractPrizePreview(run, chain = 1, count = 1) {
  return buildContractFavors(run, chain, count).map(f => favorSnapshotItem(f, false));
}
function attachContractPrizePreview(run) {
  if (!run?.roomObjective || run.roomObjective.id === 'lounge_cashout') return;
  const chain = Math.max(1, (run?.runMemory?.contractStreak || 0) + 1);
  const count = hasActiveContractFavor(run, 'double_favor') ? 2 : 1;
  run.roomObjective.prizePreview = contractPrizePreview(run, chain, count);
}
function roomObjectivePayoutText(obj = {}, depth = 0, chain = 0) {
  if (!obj?.id) return '';
  if (obj.id === 'lounge_cashout') return 'SHOP';
  const preview = Array.isArray(obj.prizePreview) ? obj.prizePreview : [];
  if (preview.length) return preview.map(f => `${favorLabel(f)}${(f.uses || 0) > 1 ? ' x' + f.uses : ''}`).join(' + ');
  return 'NEXT ROOM PRIZE';
}
function decorateRoomObjective(obj, depth = 0, chain = 0, state = {}) {
  if (!obj) return null;
  return { ...obj, reward: roomObjectivePayoutText(obj, depth, chain), ...state };
}
function roomObjectiveDoneRaw(obj, run, st = {}, time = 0) {
  if (!obj) return false;
  const lowDamageLimit = 60 + Math.floor((run?.runDepth || 0) * 1.5);
  if (obj.id === 'boss_cut') return true;
  if (obj.id === 'lounge_cashout') return true;
  if (obj.id === 'hunter_waves') return roomSolvedAt(run, st) > 0 && !!run?.hunterWave?.done && !roomHasLiveEnemies(run);
  if (obj.id === 'virus_clean') return roomSolvedAt(run, st) > 0 && !!run?.casinoVirus?.done && !roomHasLiveEnemies(run);
  if (obj.id === 'wire_ghost') return (st.wireTouches || 0) <= 0;
  if (obj.id === 'grid_ghost') return (st.prismHits || 0) <= 0;
  if (obj.id === 'grid_slow_clear') return !roomHasLiveEnemies(run);
  if (obj.id === 'blood_paid') return !roomHasLiveEnemies(run);
  if (obj.id === 'static_clean') return (st.damageTaken || 0) <= lowDamageLimit && !roomHasLiveEnemies(run);
  if (obj.id === 'cache_claim') return !roomHasLiveEnemies(run);
  if (obj.id === 'fast_clear') return time > 0 && time <= fastClearTimeLimit(run) && !roomHasLiveEnemies(run);
  if (obj.id === 'no_hit') return (st.damageTaken || 0) <= 0 && !roomHasLiveEnemies(run);
  if (obj.id === 'clean_signal') return !roomHasLiveEnemies(run);
  return false;
}
function roomObjectiveFailReason(obj, run, st = {}, time = 0) {
  if (!obj) return '';
  const solved = roomSolvedAt(run, st) > 0;
  const lowDamageLimit = 60 + Math.floor((run?.runDepth || 0) * 1.5);
  if (obj.id === 'wire_ghost' && (st.wireTouches || 0) > 0) return 'WIRE TOUCHED';
  if (obj.id === 'grid_ghost' && (st.prismHits || 0) > 0) return 'LANE HIT';
  if (obj.id === 'no_hit' && (st.damageTaken || 0) > 0) return 'DAMAGE TAKEN';
  if (obj.id === 'static_clean' && (st.damageTaken || 0) > lowDamageLimit) return 'TOO MUCH DMG';
  if (obj.id === 'fast_clear' && time > fastClearTimeLimit(run)) return 'TIME LOST';
  if (['virus_clean','hunter_waves','grid_slow_clear','blood_paid','static_clean','cache_claim','fast_clear','no_hit','clean_signal'].includes(obj.id) && roomHasLiveEnemies(run)) return 'ENEMIES LEFT';
  if (!solved) return '';
  if (obj.id === 'hunter_waves' && !run?.hunterWave?.done) return 'WAVES LEFT';
  if (obj.id === 'virus_clean' && !run?.casinoVirus?.done) return 'SPINS LEFT';
  if (obj.id === 'blood_paid' && (st.bloodTaxes || 0) <= 0) return 'NO BLOOD PAID';
  return '';
}
function roomObjectiveEarlyFailReason(obj, run, st = run?.roomStats || {}) {
  if (!obj) return '';
  const time = roomSolvedTime(run, st);
  const lowDamageLimit = 60 + Math.floor((run?.runDepth || 0) * 1.5);
  if (obj.id === 'wire_ghost' && (st.wireTouches || 0) > 0) return 'WIRE TOUCHED';
  if (obj.id === 'grid_ghost' && (st.prismHits || 0) > 0) return 'LANE HIT';
  if (obj.id === 'no_hit' && (st.damageTaken || 0) > 0) return 'DAMAGE TAKEN';
  if (obj.id === 'static_clean' && (st.damageTaken || 0) > lowDamageLimit) return 'TOO MUCH DMG';
  if (obj.id === 'fast_clear' && time > fastClearTimeLimit(run) && roomSolvedAt(run, st) <= 0) return 'TIME LOST';
  return '';
}
function roomObjectiveEarlyDoneRaw(obj, run, st = run?.roomStats || {}) {
  if (!obj) return false;
  if (obj.id === 'hunter_waves') return !!run?.hunterWave?.done;
  if (obj.id === 'virus_clean') return !!run?.casinoVirus?.done;
  if (obj.id === 'fast_clear') return roomSolvedAt(run, st) > 0 && roomSolvedTime(run, st) <= fastClearTimeLimit(run) && !roomHasLiveEnemies(run);
  if (obj.id === 'clean_signal') return roomQuotaReached(run) && !roomHasLiveEnemies(run);
  if (obj.id === 'boss_cut') return roomSolvedAt(run, st) > 0;
  return false;
}
function makeRoomObjectiveLiveResult(run, status, failReason = '') {
  const obj = run?.roomObjective;
  if (!obj) return null;
  const st = run?.roomStats || {};
  const depth = run?.runDepth || 0;
  const base = roomObjectiveBasePayout(obj.id, depth);
  const done = status === 'done';
  return {
    ...obj,
    reward: roomObjectivePayoutText(obj, depth, Math.max(1, (run?.runMemory?.contractStreak || 0) + 1)),
    done: done ? 1 : 0,
    status,
    statusLabel: done ? 'DONE' : status === 'failed' ? 'FAILED' : 'ACTIVE',
    failReason: failReason || '',
    locked: done || status === 'failed' ? 1 : 0,
    bonusGld: 0,
    bonusExp: 0,
    progress: roomObjectiveProgress(run, st)
  };
}
function updateRoomObjectiveLiveState(run) {
  const obj = run?.roomObjective;
  if (!obj || run.roomObjectiveSettlement || roomSolvedAt(run) > 0) return;
  if (run.roomObjectiveLiveState?.locked) return;
  const st = run.roomStats || {};
  const failReason = roomObjectiveEarlyFailReason(obj, run, st);
  if (failReason) {
    run.roomObjectiveLiveState = makeRoomObjectiveLiveResult(run, 'failed', failReason);
    run.fx.push({ t: 'contract_fail', label: obj.label, body: failReason });
    return;
  }
  if (roomObjectiveEarlyDoneRaw(obj, run, st)) {
    run.roomObjectiveLiveState = makeRoomObjectiveLiveResult(run, 'done', '');
    run.fx.push({ t: 'contract_done', label: obj.label, body: 'DONE' });
  }
}
function roomObjectiveStatus(run, st = run?.roomStats || {}) {
  const obj = run?.roomObjective;
  if (!obj) return { status: '', statusLabel: '', failReason: '', done: 0, locked: 0 };
  if (run?.roomObjectiveSettlement) {
    return { status: run.roomObjectiveSettlement.status, statusLabel: run.roomObjectiveSettlement.statusLabel, failReason: run.roomObjectiveSettlement.failReason || '', done: run.roomObjectiveSettlement.done ? 1 : 0, locked: 1 };
  }
  if (run?.roomObjectiveLiveState?.locked) {
    return { status: run.roomObjectiveLiveState.status, statusLabel: run.roomObjectiveLiveState.statusLabel, failReason: run.roomObjectiveLiveState.failReason || '', done: run.roomObjectiveLiveState.done ? 1 : 0, locked: 1 };
  }
  const time = roomSolvedTime(run, st);
  const solved = roomSolvedAt(run, st) > 0;
  if (!solved) return { status: 'active', statusLabel: 'ACTIVE', failReason: '', done: 0, locked: 0 };
  const failReason = roomObjectiveFailReason(obj, run, st, time);
  if (failReason) return { status: 'failed', statusLabel: 'FAILED', failReason, done: 0, locked: 1 };
  const done = roomObjectiveDoneRaw(obj, run, st, time);
  return done ? { status: 'done', statusLabel: 'DONE', failReason: '', done: 1, locked: 1 } : { status: 'failed', statusLabel: 'FAILED', failReason: 'NOT DONE', done: 0, locked: 1 };
}
function evaluateRoomObjective(run, st = {}, time = 0) {
  const obj = run?.roomObjective;
  if (!obj) return null;
  const status = roomObjectiveStatus(run, st);
  const done = !!status.done;
  const depth = run?.runDepth || 0;
  const base = roomObjectiveBasePayout(obj.id, depth);
  const previewChain = Math.max(0, (run?.runMemory?.contractStreak || 0) + 1);
  return { ...obj, reward: roomObjectivePayoutText(obj, depth, previewChain), done: done ? 1 : 0, status: status.status, statusLabel: status.statusLabel, failReason: status.failReason, bonusGld: 0, bonusExp: 0, progress: roomObjectiveProgress(run, st) };
}
function frozenRoomStatsAtPortalOpen(run) {
  const st = { ...(run?.roomStats || {}) };
  if (run?.roomStats?.solvedAt && !st.solvedAt) st.solvedAt = run.roomStats.solvedAt;
  return st;
}
function settleRoomObjectiveAtPortalOpen(run) {
  if (!run?.roomObjective || run.roomObjectiveSettlement) return run?.roomObjectiveSettlement || null;
  const st = frozenRoomStatsAtPortalOpen(run);
  const time = roomSolvedTime(run, st);
  const live = run.roomObjectiveLiveState?.locked ? { ...run.roomObjectiveLiveState } : null;
  const result = live || evaluateRoomObjective(run, st, time);
  if (!result) return null;
  run.roomObjectiveSettlement = { ...result, settledAt: roomSolvedAt(run, st), solvedTime: Math.round(time), progress: result.progress || roomObjectiveProgress(run, st) };
  run.roomObjectiveFrozenStats = st;
  if (!live) {
    run.fx.push({
      t: result.done ? 'contract_done' : 'contract_fail',
      label: result.label,
      body: result.done ? 'DONE · PRIZE AFTER ROOM CHECK' : (result.failReason || 'FAILED')
    });
  }
  return run.roomObjectiveSettlement;
}
function playableRectForArchetype(archetype) {
  const defs = {
    panic_box: { w: 1120, h: 760 }, compact: { w: 1420, h: 960 }, standard: { w: 2200, h: 1500 },
    wide: { w: 2200, h: 1500 }, long_lane: { w: 2200, h: 920 }, lounge: { w: 1500, h: 920 }, boss: { w: 2200, h: 1500 }
  };
  const d = defs[archetype] || defs.standard;
  const x = Math.round((2200 - d.w) / 2), y = Math.round((1500 - d.h) / 2);
  return { x, y, right: x + d.w, bottom: y + d.h };
}

function makeRoomWires(seed, archetype) {
  const rng = mulberry32((seed ^ 0x517A7E) >>> 0);
  const rr = playableRectForArchetype(archetype || 'standard');
  const wires = [];
  const count = archetype === 'long_lane' ? 4 : archetype === 'panic_box' ? 2 : 3;
  for (let i = 0; i < count; i++) {
    const vertical = archetype === 'long_lane' ? (i % 2 === 0) : rng() < 0.5;
    if (vertical) {
      const x = Math.round(rr.x + 180 + rng() * Math.max(80, rr.right - rr.x - 360));
      const y1 = Math.round(rr.y + 115 + rng() * 80);
      const y2 = Math.round(rr.bottom - 115 - rng() * 80);
      wires.push({ x1: x, y1, x2: x, y2, w: 34 + Math.round(rng() * 14) });
    } else {
      const y = Math.round(rr.y + 155 + rng() * Math.max(80, rr.bottom - rr.y - 310));
      const x1 = Math.round(rr.x + 140 + rng() * 110);
      const x2 = Math.round(rr.right - 140 - rng() * 110);
      wires.push({ x1, y1: y, x2, y2: y, w: 34 + Math.round(rng() * 14) });
    }
  }
  return wires;
}


function makePrismSlowZones(seed, archetype) {
  const rng = mulberry32((seed ^ 0x9A11C0DE) >>> 0);
  const rr = playableRectForArchetype(archetype || 'standard');
  const zones = [];
  const vertical = (archetype === 'long_lane') || rng() < 0.55;
  const count = archetype === 'panic_box' ? 2 : 3 + (archetype === 'wide' ? 1 : 0);
  for (let i = 0; i < count; i++) {
    if (vertical) {
      const x = Math.round(rr.x + 180 + (i + 0.5) * Math.max(120, (rr.right - rr.x - 360) / count));
      zones.push({ x: x - 42, y: rr.y + 100, w: 84, h: rr.bottom - rr.y - 200, slow: 0.333 });
    } else {
      const y = Math.round(rr.y + 150 + (i + 0.5) * Math.max(120, (rr.bottom - rr.y - 300) / count));
      zones.push({ x: rr.x + 120, y: y - 42, w: rr.right - rr.x - 240, h: 84, slow: 0.333 });
    }
  }
  return zones;
}
function makeMovingWalls(seed, archetype) {
  const rng = mulberry32((seed ^ 0xB10C5EED) >>> 0);
  const rr = playableRectForArchetype(archetype || 'standard');
  const walls = [];
  const count = archetype === 'panic_box' ? 2 : 3;
  for (let i = 0; i < count; i++) {
    const vertical = i % 2 === 0;
    if (vertical) {
      const w = 54, h = Math.min(420, Math.max(260, (rr.bottom - rr.y) * 0.34));
      const y = Math.round(rr.y + 150 + rng() * Math.max(80, rr.bottom - rr.y - h - 300));
      const min = rr.x + 145, max = rr.right - 145 - w;
      const x = Math.round(min + rng() * Math.max(1, max - min));
      walls.push({ id: `mw${i}`, x, y, w, h, axis: 'x', min, max, dir: rng() < 0.5 ? -1 : 1, speed: 62 + rng() * 36, dmgCd: 0 });
    } else {
      const w = Math.min(520, Math.max(320, (rr.right - rr.x) * 0.24)), h = 54;
      const x = Math.round(rr.x + 170 + rng() * Math.max(80, rr.right - rr.x - w - 340));
      const min = rr.y + 130, max = rr.bottom - 130 - h;
      const y = Math.round(min + rng() * Math.max(1, max - min));
      walls.push({ id: `mw${i}`, x, y, w, h, axis: 'y', min, max, dir: rng() < 0.5 ? -1 : 1, speed: 54 + rng() * 34, dmgCd: 0 });
    }
  }
  return walls;
}
function rectHitCircle(cx, cy, r, rect) {
  const qx = clamp(cx, rect.x, rect.x + rect.w);
  const qy = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, qx, qy) < r * r;
}
function pushCircleOutOfRect(ent, r, rect) {
  if (!rectHitCircle(ent.x, ent.y, r, rect)) return false;
  const left = Math.abs(ent.x - rect.x);
  const right = Math.abs(ent.x - (rect.x + rect.w));
  const top = Math.abs(ent.y - rect.y);
  const bottom = Math.abs(ent.y - (rect.y + rect.h));
  const m = Math.min(left, right, top, bottom);
  if (m === left) ent.x = rect.x - r;
  else if (m === right) ent.x = rect.x + rect.w + r;
  else if (m === top) ent.y = rect.y - r;
  else ent.y = rect.y + rect.h + r;
  return true;
}
function makeNextRoomPreview(run) {
  if (!run) return null;
  const depth = (run.runDepth || 0) + 1;
  const loop = Math.floor(depth / 4);
  const seed = (run.seedBase + depth * 7919) >>> 0;
  const plan = generateRoom(seed, depth, loop, run.devNextRoomOverride || null);
  plan.modifierIds = normalizeRoomModifiers(plan.modifierIds || []);
  if (plan.modifierIds.includes('greed')) plan.modifierIds = plan.modifierIds.filter(m => m !== 'skin_cache');
  const intel = roomIntel(plan, 0, '');
  const offer = shouldOfferRoomContract(plan, depth, seed);
  const obj = offer ? roomObjectiveForPlan(plan, depth) : null;
  if (obj) obj.prizePreview = contractPrizePreview(run, Math.max(1, (run.runMemory?.contractStreak || 0) + 1), 1);
  return {
    id: plan.roomId, cat: plan.category, special: plan.specialRoomId || '', archetype: plan.roomArchetype || 'standard',
    mods: (plan.modifierIds || []).slice(0, 4), quota: plan.quota || 0,
    danger: intel.danger, dangerLabel: intel.dangerLabel, threatTags: intel.threatTags, rewardTags: intel.rewardTags, tip: intel.tip,
    objective: obj ? decorateRoomObjective(obj, depth, Math.max(1, (run.runMemory?.contractStreak || 0) + 1), { status: 'planned', statusLabel: 'NEXT', progress: '—' }) : null
  };
}
function initRoomStats(run) {
  run.roomObjectiveSettlement = null;
  run.roomObjectiveLiveState = null;
  run.roomObjectiveFrozenStats = null;
  run.roomStats = { kills: 0, gld: 0, exp: 0, hea: 0, damageTaken: 0, shellBreaks: 0, prismHits: 0, bloodTaxes: 0, wireTouches: 0, huntedWaves: 0, startedAt: run.now || 0, solvedAt: 0 };
}
function markRoomSolved(run, reason = 'portal_open') {
  if (!run) return;
  const now = run.now || 0;
  if (!run.portalOpenedAt) run.portalOpenedAt = now;
  if (run.roomStats && !run.roomStats.solvedAt) {
    run.roomStats.solvedAt = now;
    run.roomStats.solvedReason = reason;
  }
}
function roomSolvedAt(run, st = run?.roomStats || {}) {
  return Math.max(0, st?.solvedAt || run?.portalOpenedAt || 0);
}
function roomSolvedTime(run, st = run?.roomStats || {}) {
  const start = st?.startedAt || 0;
  const end = roomSolvedAt(run, st) || run?.now || start;
  return Math.max(0, end - start);
}

function finalLoopProgress(run) {
  return Math.max(0, Math.min(FINAL_TARGET_LOOPS, Math.floor(Math.max(0, run?.runDepth || 0) / ROOMS_PER_LOOP) + ((run?.plan?.category === 'boss' && run?.portal?.open) ? 1 : 0)));
}
function isFinalBossRoom(run) {
  return !!run && run?.plan?.category === 'boss' && Math.max(0, run.runDepth || 0) >= FINAL_BOSS_DEPTH;
}
function finalRunSummary(run, players) {
  const mem = run?.runMemory || {};
  const connected = [...players.values()].filter(p => p.connected);
  return {
    version: 'v2.1.54',
    result: 'complete',
    loopsTarget: FINAL_TARGET_LOOPS,
    loopsCleared: FINAL_TARGET_LOOPS,
    depth: Math.max(0, run?.runDepth || 0),
    roomsCleared: Math.max(0, mem.roomsCleared || 0),
    kills: Math.max(0, mem.totalKills || 0),
    bosses: Math.max(0, mem.bossesDefeated || 0),
    gld: Math.max(0, Math.round(mem.totalGld || 0)),
    exp: Math.max(0, Math.round(mem.totalExp || 0)),
    hea: Math.max(0, Math.round(mem.totalHea || 0)),
    damage: Math.max(0, Math.round(mem.totalDamageTaken || 0)),
    bestCombo: Math.max(1, Math.round((mem.bestCombo || 1) * 10) / 10),
    noHitBest: Math.max(0, mem.bestNoHitStreak || 0),
    fastBest: Math.max(0, mem.bestFastStreak || 0),
    contractsDone: Math.max(0, mem.objectivesDone || 0),
    contractsSeen: Math.max(0, mem.objectivesSeen || 0),
    favorsEarned: Math.max(0, mem.favorsEarned || 0),
    signatures: connected.reduce((n, p) => n + Object.entries(p.stats || {}).filter(([k, v]) => k.startsWith('sig') && Number(v || 0) > 0).length, 0),
    players: connected.map(p => ({
      id: p.id, name: p.name, hp: Math.round(p.hp || 0), maxHp: maxHp(p), level: p.economy?.level || 0,
      gld: Math.round(p.economy?.money || 0), xp: Math.round(p.economy?.xp || 0), weapons: (p.weapons || []).slice(),
      q: activeCoreLabel(p), dash: dashMax(p), drones: p.stats?.drones || 0, orbitals: 0,
      skin: p.skin?.id || 'terminal_mint', alive: p.alive ? 1 : 0
    }))
  };
}
function completeRun(run, players) {
  if (!run || run.phase === 'won') return;
  run.finalSummary = finalRunSummary(run, players);
  run.phase = 'won';
  run.phaseT = 0;
  run.enemies = [];
  run.bullets = [];
  run.activeFields = [];
  if (run.portal) run.portal.open = true;
  run.fx.push({ t: 'run_complete', summary: run.finalSummary });
}

function recordPickupStat(run, type, val) {
  if (!run.roomStats) return;
  if (type === 'GLD') run.roomStats.gld += val || 0;
  else if (type === 'EXP') run.roomStats.exp += val || 0;
  else if (type === 'HEA') run.roomStats.hea += val || 0;
}
function addRunTape(run, label, tone = 'neutral') {
  if (!run) return;
  const clean = String(label || '').trim().slice(0, 42);
  if (!clean) return;
  if (!run.tapeLog) run.tapeLog = [];
  const depth = run.runDepth || 0;
  if (run.tapeLog[0]?.label === clean && run.tapeLog[0]?.depth === depth) return;
  run.tapeLog.unshift({ label: clean, tone, depth, at: Math.round(run.now || 0) });
  run.tapeLog = run.tapeLog.slice(0, 10);
}
function updateRunMemoryFromRoom(run, st, flags = {}) {
  if (!run) return;
  const mem = run.runMemory || (run.runMemory = {});
  mem.roomsCleared = (mem.roomsCleared || 0) + 1;
  mem.totalKills = (mem.totalKills || 0) + Math.max(0, st?.kills || run.kills || 0);
  mem.totalGld = (mem.totalGld || 0) + Math.max(0, st?.gld || 0) + Math.max(0, flags.bonusGld || 0) + Math.max(0, flags.objectiveGld || 0) + Math.max(0, flags.contractGld || 0);
  mem.totalExp = (mem.totalExp || 0) + Math.max(0, st?.exp || 0) + Math.max(0, flags.bonusExp || 0) + Math.max(0, flags.objectiveExp || 0) + Math.max(0, flags.contractExp || 0);
  mem.totalHea = (mem.totalHea || 0) + Math.max(0, st?.hea || 0);
  mem.highestDepth = Math.max(mem.highestDepth || 0, Math.max(0, run.runDepth || 0));
  mem.loopsCleared = Math.max(mem.loopsCleared || 0, finalLoopProgress(run));
  mem.totalDamageTaken = (mem.totalDamageTaken || 0) + Math.max(0, st?.damageTaken || 0);
  mem.noHitStreak = flags.noHit ? (mem.noHitStreak || 0) + 1 : 0;
  mem.fastStreak = flags.fast ? (mem.fastStreak || 0) + 1 : 0;
  mem.bestNoHitStreak = Math.max(mem.bestNoHitStreak || 0, mem.noHitStreak || 0);
  mem.bestFastStreak = Math.max(mem.bestFastStreak || 0, mem.fastStreak || 0);
  mem.skinRoomsSeen = (mem.skinRoomsSeen || 0) + (run.skinRoomReward ? 1 : 0);
  mem.staticPaid = (mem.staticPaid || 0) + (run.staticRainFromPending ? 1 : 0);
  mem.shellBreaks = (mem.shellBreaks || 0) + Math.max(0, st?.shellBreaks || 0);
  mem.huntedWaves = (mem.huntedWaves || 0) + Math.max(0, st?.huntedWaves || 0);
  mem.objectivesSeen = (mem.objectivesSeen || 0) + (flags.objectiveSeen ? 1 : 0);
  mem.objectivesDone = (mem.objectivesDone || 0) + (flags.objectiveDone ? 1 : 0);
  mem.objectiveGld = (mem.objectiveGld || 0) + Math.max(0, flags.objectiveGld || 0);
  mem.objectiveExp = (mem.objectiveExp || 0) + Math.max(0, flags.objectiveExp || 0);
  if (flags.objectiveSeen) mem.contractStreak = flags.objectiveDone ? (mem.contractStreak || 0) + 1 : 0;
  mem.bestContractStreak = Math.max(mem.bestContractStreak || 0, mem.contractStreak || 0);
  mem.contractGld = (mem.contractGld || 0) + Math.max(0, flags.contractGld || 0);
  mem.contractExp = (mem.contractExp || 0) + Math.max(0, flags.contractExp || 0);
  mem.favorsEarned = (mem.favorsEarned || 0) + Math.max(0, flags.favorsEarned || 0);
}
function rewardShellMarket(run, x, y) {
  // Shell Market modifier was removed in v2.1. Keep shell-break memory only.
  if (run?.roomStats) run.roomStats.shellBreaks = (run.roomStats.shellBreaks || 0) + 1;
}

function dashFx(run, p, fx, fy, tx, ty, extra = {}) {
  const id = skinId(p?.skin?.id || 'terminal_mint');
  const meta = SKIN_BY_ID[id] || SKIN_BY_ID.terminal_mint || {};
  run.fx.push({
    t: 'dash', id: p.id, fx: Math.round(fx), fy: Math.round(fy), tx: Math.round(tx), ty: Math.round(ty),
    skinId: id, skinRarity: meta.rarity || 'basic', dashColor: meta.dash || p.skin?.outline || '#66f6ff',
    dashAlt: meta.dashAlt || p.skin?.barrel || '#f3f3f3', dashStyle: meta.dashStyle || 'terminal',
    legendarySfx: meta.legendarySfx || '', ...extra
  });
}

let nextId = 1;
const nid = () => (nextId++).toString(36);

// ---------------------------------------------------------------- helpers
function aabbHit(x, y, half, w) {
  return x + half > w.x && x - half < w.x + w.w && y + half > w.y && y - half < w.y + w.h;
}
function collideWalls(x, y, half, walls, ox, oy) {
  // axis-separated slide
  let nx = x, ny = y;
  for (const w of walls) {
    if (aabbHit(nx, oy, half, w)) {
      nx = nx > w.x + w.w / 2 ? w.x + w.w + half : w.x - half;
    }
  }
  for (const w of walls) {
    if (aabbHit(nx, ny, half, w)) {
      ny = ny > w.y + w.h / 2 ? w.y + w.h + half : w.y - half;
    }
  }
  return { x: nx, y: ny };
}
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function norm(dx, dy) { const d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function distToSegment2(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = ax + vx * t, cy = ay + vy * t;
  return dist2(px, py, cx, cy);
}
function activeAimPoint(p, maxRange = 520, minRange = 90) {
  const d = norm((p.aimX ?? p.x + (p.dirX || 1) * maxRange) - p.x, (p.aimY ?? p.y + (p.dirY || 0) * maxRange) - p.y);
  const raw = Math.hypot((p.aimX ?? p.x) - p.x, (p.aimY ?? p.y) - p.y);
  const len = Math.max(minRange, Math.min(maxRange, raw || maxRange));
  return { x: p.x + d.x * len, y: p.y + d.y * len, dir: d, len };
}
function aimPointFrom(p, sx, sy, maxRange = 520, minRange = 80) {
  let tx = p.aimX ?? (sx + (p.dirX || 1) * maxRange);
  let ty = p.aimY ?? (sy + (p.dirY || 0) * maxRange);
  let dx = tx - sx, dy = ty - sy;
  if (Math.hypot(dx, dy) < 4) { dx = p.aimX - p.x; dy = p.aimY - p.y; }
  if (Math.hypot(dx, dy) < 4) { dx = p.dirX || 1; dy = p.dirY || 0; }
  const d = norm(dx, dy);
  const raw = Math.hypot(tx - sx, ty - sy);
  const len = Math.max(minRange, Math.min(maxRange, raw || maxRange));
  return { x: sx + d.x * len, y: sy + d.y * len, dir: d, len };
}

function rotateVec(v, a) {
  const c = Math.cos(a), si = Math.sin(a);
  return { x: v.x * c - v.y * si, y: v.x * si + v.y * c };
}
function wallPenalty(x, y, half, walls) {
  let penalty = 0;
  for (const w of walls) if (aabbHit(x, y, half, w)) penalty += 1;
  return penalty;
}
function segmentBlockedByWalls(ax, ay, bx, by, walls, pad = 18) {
  for (const w of walls || []) {
    const steps = Math.max(5, Math.ceil(Math.hypot(bx - ax, by - ay) / 70));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (aabbHit(x, y, pad, w)) return w;
    }
  }
  return null;
}
function buildHeraldFloorPath(run, h, target, fixedSeed = 0) {
  const walls = run.plan?.walls || [];
  const sx = Math.round(h.x), sy = Math.round(h.y), tx = Math.round(target.x), ty = Math.round(target.y);
  // v2.1: Herald cast marks one fixed floor sigil per cast.
  // The seed is created at cast start so the drawing stays stable instead of crawling over the floor.
  const seed = fixedSeed || h.heraldCastSeed || ((parseInt(String(h.id || '1'), 36) || 1) + Math.floor((run.now || 0) * 0.45));
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const directBlock = segmentBlockedByWalls(sx, sy, tx, ty, walls, 20);
  const dx = tx - sx, dy = ty - sy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / len, ny = dy / len;
  const px = -ny, py = nx;
  const bend = 42 + rng() * 78;
  const points = [[sx, sy]];
  const count = directBlock ? (3 + Math.floor(rng() * 2)) : (2 + Math.floor(rng() * 4));
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const side = (i % 2 ? 1 : -1) * bend * (0.75 + rng() * 0.55);
    const forwardNoise = (rng() - 0.5) * 45;
    let x = sx + dx * t + nx * forwardNoise + px * side;
    let y = sy + dy * t + ny * forwardNoise + py * side;
    if (directBlock && i === 2) {
      const pad = 70;
      const around = [
        [directBlock.x - pad, directBlock.y - pad], [directBlock.x + directBlock.w + pad, directBlock.y - pad],
        [directBlock.x + directBlock.w + pad, directBlock.y + directBlock.h + pad], [directBlock.x - pad, directBlock.y + directBlock.h + pad]
      ];
      const pick = around[Math.floor(rng() * around.length)] || [x, y];
      x = pick[0]; y = pick[1];
    }
    x = Math.round(clamp(x, WALL_T + 35, run.plan.w - WALL_T - 35));
    y = Math.round(clamp(y, WALL_T + 35, run.plan.h - WALL_T - 35));
    points.push([x, y]);
  }
  points.push([tx, ty]);
  // If one jagged segment crosses a wall, fall back to the old one-corner detour and keep it broken after that.
  for (let i = 1; i < points.length; i++) {
    const block = segmentBlockedByWalls(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], walls, 18);
    if (block) {
      const pad = 62;
      const c = [
        Math.round(clamp(block.x + (rng() < 0.5 ? -pad : block.w + pad), WALL_T + 35, run.plan.w - WALL_T - 35)),
        Math.round(clamp(block.y + (rng() < 0.5 ? -pad : block.h + pad), WALL_T + 35, run.plan.h - WALL_T - 35))
      ];
      points.splice(i, 0, c);
      break;
    }
  }
  return points;
}
function enemySpeed(e) {
  let mul = 1;
  if (e.rallyT > 0) mul *= 1.24;
  if (e.anchorT > 0) mul *= 0.94;
  if (e.leechLinkT > 0) mul *= 0.96;
  if ((e.frozenT || 0) > 0 || (e.stunT || 0) > 0) mul *= 0.015;
  if (e.activeSlowT > 0) mul *= (e.activeSlowMul || 0.55);
  return e.spd * mul;
}
function enemyDamageValue(e, mul = 1) {
  let m = mul;
  if (e.rallyT > 0) m *= 1.14;
  if (e.anchorT > 0) m *= 1.08;
  return Math.max(1, Math.round(e.dmg * m));
}
function enemyBulletSpeed(base, e) {
  let m = 1;
  if (e.rallyT > 0) m *= 1.12;
  if (e.anchorT > 0) m *= 1.08;
  return base * m;
}
function enemyFireCooldown(base, e) {
  let m = 1;
  if (e.rallyT > 0) m *= 1.16;
  if (e.anchorT > 0) m *= 1.08;
  return Math.max(0.28, base / m);
}
function playerWeaponId(p) {
  return p?.weapons?.[p.weaponIdx || 0] || 'shotgun';
}
function echoMimicCooldown(wid, def, e) {
  const base = wid === 'rocketgun' ? 2.65 : (wid === 'seeker' ? 1.55 : 1.25);
  return enemyFireCooldown(base * 1.18, e);
}
function fireEchoMimicShot(run, players, e, target, toT, def) {
  if (!target?.alive || run.bullets.length >= MAX_BULLETS) return;
  const wid = playerWeaponId(target);
  const baseAng = Math.atan2(toT.y, toT.x);
  const srcX = e.x + toT.x * 24;
  const srcY = e.y + toT.y * 24;
  if (wid === 'shotgun') {
    const pellets = 5;
    for (let i = 0; i < pellets && run.bullets.length < MAX_BULLETS; i++) {
      const off = (i - (pellets - 1) / 2) * 0.095 + (Math.random() - 0.5) * 0.05;
      const a = baseAng + off;
      const sp = enemyBulletSpeed(520, e);
      run.bullets.push({ id: nid(), x: srcX, y: srcY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: enemyDamageValue(e, 0.42), from: 'e', life: 0.72, delay: 0.10 + i * 0.012, size: 5, kind: 'shotgun', echoProc: 1, bornTick: run.tick || 0 });
    }
  } else if (wid === 'seeker') {
    const sp = enemyBulletSpeed(255, e);
    run.bullets.push({ id: nid(), x: srcX, y: srcY, vx: toT.x * sp, vy: toT.y * sp, dmg: enemyDamageValue(e, 0.92), from: 'e', life: 1.85, delay: 0.18, size: 5, kind: 'seeker', homing: 3.6, targetId: target.id, echoProc: 1, bornTick: run.tick || 0 });
  } else if (wid === 'rocketgun') {
    const sp = enemyBulletSpeed(245, e);
    run.bullets.push({ id: nid(), x: srcX, y: srcY, vx: toT.x * sp, vy: toT.y * sp, dmg: enemyDamageValue(e, 1.08), from: 'e', life: 2.15, delay: 0.22, size: 9, kind: 'rocketgun', aoe: 76, enemyRocket: 1, detonateDist: 470, travelled: 0, echoProc: 1, bornTick: run.tick || 0 });
  } else {
    const sp = enemyBulletSpeed(280, e);
    run.bullets.push({ id: nid(), x: srcX, y: srcY, vx: toT.x * sp, vy: toT.y * sp, dmg: enemyDamageValue(e, 0.85), from: 'e', life: 2.0, delay: 0.16, size: 6, kind: 'shotgun', echoProc: 1, bornTick: run.tick || 0 });
  }
  e.mimicWeapon = wid;
  run.fx.push({ t: 'echo_shot', id: e.id, x: Math.round(e.x), y: Math.round(e.y), weapon: wid, enemy: 1 });
}

const PLAIN_ARMOR_KINDS = new Set(['tank','charger','bouncer','shooter','splitter','prism','pulse','anchor','leech','herald','warden','boss']);
const LINKED_ARMOR_KINDS = new Set(['tank','charger','bouncer','shooter','splitter','prism','pulse','anchor','leech','herald','warden']);
const ARMOR_CLASS_BIAS = {
  tank: 0.16, anchor: 0.14, herald: 0.17, warden: 1.0,
  charger: 0.05, bouncer: 0.05, shooter: 0.04, splitter: 0.06,
  prism: 0.07, pulse: 0.07, leech: 0.08
};
function hasShellArmor(e) {
  return !!(e && ((e.shellMax || 0) > 0 || (e.shellHp || 0) > 0 || e.shellType));
}
function shellChance(run, kind, def, elite, type) {
  const df = difficulty(run);
  if (def?.boss) return type === 'plain' ? 1 : 0;
  if (kind === 'warden' || def?.armorWarden) return type === 'linked' ? 1 : 0;
  const bias = ARMOR_CLASS_BIAS[kind] || 0;
  const shellMarket = 0; // Shell Market modifier removed
  if (type === 'linked') {
    if (df.loop <= 0) return 0;
    return Math.min(0.46, Math.max(0, -0.09 + df.loop * 0.035 + df.late * 0.06 + run.runDepth * 0.006 + bias * 0.45 + shellMarket * 0.10 + (elite ? 0.08 : 0)));
  }
  if (run.runDepth < 2 && !elite) return 0;
  return Math.min(0.78, Math.max(0, -0.03 + df.loop * 0.055 + df.late * 0.07 + run.runDepth * 0.008 + bias + shellMarket * 0.18 + (def?.armor ? 0.10 : 0) + (elite ? 0.14 : 0)));
}
function shellMaxForArmor(run, def, e, type) {
  const df = difficulty(run);
  let mul = type === 'linked' ? 0.40 : 0.28;
  if (def?.boss) mul = 0.34;
  if (def?.armorWarden) mul = def.shellMul ?? 0.52;
  if (def?.armor && !def?.boss) mul += 0.08;
  if (e.elite) mul += 0.08;
  mul *= 1 + df.loop * 0.055 + df.late * 0.10;
  return Math.max(type === 'linked' ? 18 : 12, Math.round(e.maxHp * mul));
}
function rollShellArmor(run, kind, def, e, elite) {
  if (def?.boss) return { type: 'plain', max: shellMaxForArmor(run, def, e, 'plain'), source: 'boss' };
  if (kind === 'warden' || def?.armorWarden) return { type: 'linked', max: shellMaxForArmor(run, def, e, 'linked'), source: 'native' };
  const canLinked = LINKED_ARMOR_KINDS.has(kind);
  const canPlain = PLAIN_ARMOR_KINDS.has(kind);
  if (!canLinked && !canPlain) return null;
  const linkedChance = canLinked ? shellChance(run, kind, def, elite, 'linked') : 0;
  const plainChance = canPlain ? shellChance(run, kind, def, elite, 'plain') : 0;
  const r = Math.random();
  if (r < linkedChance) return { type: 'linked', max: shellMaxForArmor(run, def, e, 'linked'), source: 'roll' };
  if (r < linkedChance + plainChance) return { type: 'plain', max: shellMaxForArmor(run, def, e, 'plain'), source: 'roll' };
  return null;
}
function isLinkableShellBattery(e) {
  if (!e || e.hp <= 0) return false;
  const def = ENEMIES[e.kind] || {};
  // Battery targets must be genuinely unarmored. Never link to another shell carrier,
  // another linked-armor carrier, boss, or already broken armored mob; otherwise chains can become unfair.
  if (def.boss || e.kind === 'warden' || def.armorWarden) return false;
  if (hasShellArmor(e)) return false;
  return true;
}

function movingWallDangerPenalty(run, x, y, half = 14) {
  if (!run?.plan?.modifierIds?.includes('moving_room') || !run.movingWalls?.length) return 0;
  let penalty = 0;
  for (const w of run.movingWalls) {
    const pad = half + 82;
    const nearestX = clamp(x, w.x - pad, w.x + w.w + pad);
    const nearestY = clamp(y, w.y - pad, w.y + w.h + pad);
    const insidePad = x >= w.x - pad && x <= w.x + w.w + pad && y >= w.y - pad && y <= w.y + w.h + pad;
    if (insidePad) penalty += 3.2;
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    if (dist2(x, y, cx, cy) < (Math.max(w.w, w.h) + pad * 2) ** 2) penalty += 1.15;
  }
  return penalty;
}

function steerMove(run, e, dir, speedValue, dt, opts = {}) {
  const walls = run.plan?.walls || [];
  const half = e.size / 2;
  const base = norm(dir.x || 0, dir.y || 0);
  const amount = Math.max(0, speedValue * dt);
  if (!amount) return { x: e.x, y: e.y, moved: 0, blocked: false };
  const target = opts.target || null;
  const sideBias = e.steerSide || ((parseInt(e.id, 36) || 1) % 2 ? 1 : -1);
  const directLook = Math.max(half + 18, Math.min(95, amount * 7 + half));
  const directBlocked = wallPenalty(e.x + base.x * directLook, e.y + base.y * directLook, half, walls) > 0;
  const angles = directBlocked
    ? [0, 0.42 * sideBias, -0.42 * sideBias, 0.82 * sideBias, -0.82 * sideBias, 1.22 * sideBias, -1.22 * sideBias, 1.58 * sideBias, -1.58 * sideBias, Math.PI]
    : [0, 0.25 * sideBias, -0.25 * sideBias, 0.55 * sideBias, -0.55 * sideBias];
  let best = null;
  for (const a of angles) {
    const v = rotateVec(base, a);
    const ox = e.x, oy = e.y;
    const nx0 = ox + v.x * amount;
    const ny0 = oy + v.y * amount;
    const c = collideWalls(nx0, ny0, half, walls, ox, oy);
    const moved = Math.hypot(c.x - ox, c.y - oy);
    const lookPenalty = wallPenalty(ox + v.x * directLook, oy + v.y * directLook, half, walls);
    const spikePenalty = movingWallDangerPenalty(run, c.x + v.x * (half + 18), c.y + v.y * (half + 18), half);
    let score = moved * 1.3 - lookPenalty * 95 - spikePenalty * 430 - Math.abs(a) * 8;
    if (target) score -= Math.hypot(target.x - c.x, target.y - c.y) * 0.035;
    if (a * sideBias > 0) score += 2.5;
    if (!best || score > best.score) best = { x: c.x, y: c.y, moved, score, angle: a, blocked: lookPenalty > 0 || moved < amount * 0.35 };
  }
  if (!best) return { x: e.x, y: e.y, moved: 0, blocked: true };
  const prevX = e.x, prevY = e.y;
  e.x = best.x; e.y = best.y;
  if (best.moved < amount * 0.25 || best.blocked) e.stuckT = (e.stuckT || 0) + dt;
  else e.stuckT = Math.max(0, (e.stuckT || 0) - dt * 2);
  if ((e.stuckT || 0) > 0.45) {
    e.steerSide = -(e.steerSide || sideBias);
    e.stuckT = 0.12;
    run.fx.push({ t: 'path_turn', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
  }
  return { x: e.x, y: e.y, moved: Math.hypot(e.x - prevX, e.y - prevY), blocked: best.blocked };
}
function resolveEnemyCrowd(run, walls, dt) {
  const arr = run.enemies;
  const n = arr.length;
  const maxPairs = n > 42 ? 3 : 5;
  for (let pass = 0; pass < maxPairs; pass++) {
    for (let i = 0; i < n; i++) {
      const a = arr[i]; if (!a) continue;
      for (let j = i + 1; j < n; j++) {
        const b = arr[j]; if (!b) continue;
        const minD = (a.size + b.size) / 2 + 5;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 0.001) { dx = ((i * 17 + j * 31) % 100) / 50 - 1; dy = ((i * 29 + j * 13) % 100) / 50 - 1; d = Math.hypot(dx, dy) || 1; }
        const nx = dx / d, ny = dy / d;
        const overlap = (minD - d) * 0.5;
        const heavyA = ENEMIES[a.kind]?.boss || a.kind === 'tank' || a.kind === 'anchor' || a.kind === 'herald' || a.kind === 'damper';
        const heavyB = ENEMIES[b.kind]?.boss || b.kind === 'tank' || b.kind === 'anchor' || b.kind === 'herald' || b.kind === 'damper';
        const am = heavyA ? 0.35 : 0.65;
        const bm = heavyB ? 0.35 : 0.65;
        const ac = collideWalls(a.x - nx * overlap * am, a.y - ny * overlap * am, a.size / 2, walls, a.x, a.y);
        const bc = collideWalls(b.x + nx * overlap * bm, b.y + ny * overlap * bm, b.size / 2, walls, b.x, b.y);
        a.x = ac.x; a.y = ac.y; b.x = bc.x; b.y = bc.y;
      }
    }
  }
}

function tickElementalStatuses(run, players, e, dt) {
  if (!e || e.hp <= 0) return;
  if ((e.burnT || 0) > 0) {
    e.burnT = Math.max(0, (e.burnT || 0) - dt);
    e.burnTickT = (e.burnTickT || 0) - dt;
    if (e.burnTickT <= 0 && e.burnT > 0) {
      e.burnTickT = 0.45;
      damageEnemy(run, players, e, Math.max(1, (e.burnDps || 3.0) * 0.45), e.burnOwner || null, 0, 0, 0, 'fire');
      if (e.hp <= 0) return;
      run.fx.push({ t: 'active_mutation', label: 'BURN', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 20), tone: 'red', owner: e.burnOwner || '' });
    }
  }
  if ((e.poisonT || 0) > 0) {
    e.poisonT = Math.max(0, (e.poisonT || 0) - dt);
    e.poisonTickT = (e.poisonTickT || 0) - dt;
    if (e.poisonTickT <= 0 && e.poisonT > 0) {
      e.poisonTickT = 0.60;
      damageEnemy(run, players, e, Math.max(1, (e.poisonDps || 2.2) * 0.60), e.poisonOwner || null, 0, 0, 0, 'poison');
      if (e.hp <= 0) return;
      run.fx.push({ t: 'active_mutation', label: 'POISON', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 18), tone: 'green', owner: e.poisonOwner || '' });
    }
  }
  // Passive synergy: poison + fire periodically spits a tiny square volatile tick.
  if ((e.burnT || 0) > 0 && (e.poisonT || 0) > 0 && (e.elemComboCd || 0) <= 0) {
    e.elemComboCd = 0.85;
    const owner = e.burnOwner || e.poisonOwner || null;
    damageEnemy(run, players, e, Math.max(2, ((e.burnDps || 2) + (e.poisonDps || 2)) * 0.42), owner, 0, 0, 0, 'fire');
    if (e.hp > 0) run.fx.push({ t: 'active_mutation', label: 'VOLATILE MIX', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 34), tone: 'red', owner: owner || '' });
  }
}

function stepEnemySynergies(run, players, dt) {
  if (run.plan?.specialRoomId === 'chill_room') return;
  const alive = [...players.values()].filter(p => p.alive);
  for (const e of run.enemies) {
    e.rallyT = Math.max(0, (e.rallyT || 0) - dt);
    e.anchorT = Math.max(0, (e.anchorT || 0) - dt);
    e.leechLinkT = Math.max(0, (e.leechLinkT || 0) - dt);
    e.orbShieldT = Math.max(0, (e.orbShieldT || 0) - dt);
    e.armorLockT = Math.max(0, (e.armorLockT || 0) - dt);
    if (e.armorLockT <= 0) e.armorLinkId = '';
    e.activeSlowT = Math.max(0, (e.activeSlowT || 0) - dt);
    e.chillT = Math.max(0, (e.chillT || 0) - dt);
    e.frozenT = Math.max(0, (e.frozenT || 0) - dt);
    e.stunT = Math.max(0, (e.stunT || 0) - dt);
    e.freezeFxT = Math.max(0, (e.freezeFxT || 0) - dt);
    e.exposedT = Math.max(0, (e.exposedT || 0) - dt);
    if (e.exposedT <= 0) e.exposedMul = 1;
    e.elemComboCd = Math.max(0, (e.elemComboCd || 0) - dt);
    tickElementalStatuses(run, players, e, dt);
    e.shellRegenDelay = Math.max(0, (e.shellRegenDelay || 0) - dt);
    if ((e.shellMax || 0) > 0 && e.hp > 0 && (e.shellHp || 0) < e.shellMax && (e.shellRegenDelay || 0) <= 0) {
      const beforeShell = Math.max(0, e.shellHp || 0);
      const regen = Math.max(3.5, e.shellMax * (e.shellType === 'linked' ? 0.10 : 0.14)) * dt;
      e.shellHp = Math.min(e.shellMax, beforeShell + regen);
      if (beforeShell <= 0 && e.shellHp > 0) {
        e.shellFlashT = Math.max(e.shellFlashT || 0, 0.22);
        run.fx.push({ t: 'armor_restore', id: e.id, shellType: e.shellType || 'plain', x: Math.round(e.x), y: Math.round(e.y), left: Math.round(e.shellHp || 0) });
      }
    }
    e.shellFlashT = Math.max(0, (e.shellFlashT || 0) - dt);
    e.comboCd = Math.max(0, (e.comboCd || 0) - dt);
    e.packRoleT = Math.max(0, (e.packRoleT || 0) - dt);
  }
  const anchors = run.enemies.filter(e => e.kind === 'anchor');
  for (const a of anchors) {
    const def = ENEMIES.anchor;
    let count = 0;
    for (const e of run.enemies) {
      if (e.id === a.id || ENEMIES[e.kind]?.boss) continue;
      if (dist2(e.x, e.y, a.x, a.y) < def.fieldR * def.fieldR) { e.anchorT = 0.26; count++; }
    }
    if (count && (a.comboCd || 0) <= 0) { a.comboCd = 0.85; run.fx.push({ t: 'enemy_combo', label: 'ANCHOR FIELD', x: Math.round(a.x), y: Math.round(a.y) }); }
  }
  const dampers = run.enemies.filter(e => e.kind === 'damper' && e.hp > 0);
  for (const d of dampers) {
    const def = ENEMIES.damper;
    let guarded = 0;
    for (const e of run.enemies) {
      if (e.id === d.id || ENEMIES[e.kind]?.boss || e.hp <= 0) continue;
      const near = dist2(e.x, e.y, d.x, d.y) < (def.fieldR + 360) ** 2;
      if (!near) continue;
      if (['shooter','prism','pulse','orbiter','echo'].includes(e.kind)) {
        if (!e.escortAnchorId || e.escortAnchorId === d.id) attachRotaryGuard(e, d, guarded, 6);
        e.dmpNestT = Math.max(e.dmpNestT || 0, 1.0);
        guarded++;
      } else if (e.kind === 'herald') {
        e.preferredNestId = d.id;
        e.rallyT = Math.max(e.rallyT || 0, 1.4);
        guarded++;
      } else if (['runner','charger','tank','bouncer','splitter'].includes(e.kind) && dist2(e.x, e.y, d.x, d.y) < (def.fieldR + 140) ** 2) {
        // Melee mobs are tagged as protected by DMP, but no longer get pulled into
        // the field. The old pull made them jitter around the moving DMP core.
        e.rallyT = Math.max(e.rallyT || 0, 0.45);
        e.dmpNestT = Math.max(e.dmpNestT || 0, 0.45);
        guarded++;
      }
      if (guarded >= 9) break;
    }
    if (guarded && (d.comboCd || 0) <= 0) { d.comboCd = 1.15; run.fx.push({ t: 'enemy_combo', label: 'DMP NEST', x: Math.round(d.x), y: Math.round(d.y) }); }
  }
  const heralds = run.enemies.filter(e => e.kind === 'herald');
  for (const h of heralds) {
    h.rallyCd = (h.rallyCd || 0) - dt;
    if (h.rallyCd > 0) continue;
    h.rallyCd = 1.15;
    const target = nearestAlive(players, h.x, h.y, run);
    let rallied = 0;
    for (const e of run.enemies) {
      if (e.id === h.id || ENEMIES[e.kind]?.boss || e.kind === 'anchor') continue;
      if (dist2(e.x, e.y, h.x, h.y) < 560 * 560) {
        e.rallyT = Math.max(e.rallyT || 0, 2.1);
        if (target) e.rallyTargetId = target.id;
        rallied++;
        if (rallied >= 7) break;
      }
    }
    if (rallied) run.fx.push({ t: 'enemy_combo', label: 'HERALD RALLY', x: Math.round(h.x), y: Math.round(h.y) });
  }
  const orbiters = run.enemies.filter(e => e.kind === 'orbiter');
  for (const o of orbiters) {
    let guarded = 0;
    for (const e of run.enemies) {
      if (e.id === o.id || ENEMIES[e.kind]?.boss) continue;
      if (!['shooter','prism','pulse','leech'].includes(e.kind)) continue;
      if (dist2(e.x, e.y, o.x, o.y) < 230 * 230) { e.orbShieldT = 0.30; guarded++; }
    }
    if (guarded && (o.comboCd || 0) <= 0) { o.comboCd = 1.0; run.fx.push({ t: 'enemy_combo', label: 'ORB GUARD', x: Math.round(o.x), y: Math.round(o.y) }); }
  }

  // Linked armor is now a general armor class, not only a WRD gimmick:
  // any eligible shell carrier that spawned with linked armor can anchor its shell to a nearby unarmored battery mob.
  // The link never targets another armored/shelled enemy, another linked-armor carrier, or boss.
  const linkedCarriers = run.enemies.filter(e => e.shellType === 'linked' && (e.shellHp || 0) > 0);
  for (const carrier of linkedCarriers) {
    const def = ENEMIES[carrier.kind] || {};
    const radius = def.linkR || 340;
    let best = null, bd = radius * radius;
    for (const e of run.enemies) {
      if (e.id === carrier.id || !isLinkableShellBattery(e)) continue;
      const d = dist2(carrier.x, carrier.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      carrier.armorLockT = 0.34;
      carrier.armorLinkId = best.id;
      best.armorBatteryT = 0.34;
      if ((carrier.comboCd || 0) <= 0) {
        carrier.comboCd = carrier.kind === 'warden' ? 0.75 : 1.05;
        run.fx.push({ t: 'armor_link', x: Math.round(carrier.x), y: Math.round(carrier.y), x2: Math.round(best.x), y2: Math.round(best.y), label: carrier.kind === 'warden' ? 'WARDEN LINK' : 'ARMOR LINK' });
      }
    }
  }
  // Splitting enemies agitate nearby runners: a small swarm moment after a split pack appears.
  const splitters = run.enemies.filter(e => e.kind === 'splitter');
  for (const s of splitters) {
    if ((s.splitStage || 0) <= 0 || (s.comboCd || 0) > 0) continue;
    let aggro = 0;
    for (const e of run.enemies) {
      if (e.id === s.id || !['runner','grunt','glitch'].includes(e.kind)) continue;
      if (dist2(e.x, e.y, s.x, s.y) < 300 * 300) { e.rallyT = Math.max(e.rallyT || 0, 1.1); aggro++; }
    }
    if (aggro) { s.comboCd = 2.2; run.fx.push({ t: 'enemy_combo', label: 'SPL SWARM', x: Math.round(s.x), y: Math.round(s.y) }); }
  }
}

function resolveEnemyPlayerOverlap(run, e, p, walls, opts = {}) {
  if (!p || !p.alive || !e) return null;
  const pad = opts.pad ?? 7;
  const minD = (PLAYER_SIZE + e.size) / 2 + pad;
  let dx = p.x - e.x;
  let dy = p.y - e.y;
  let d = Math.hypot(dx, dy);
  if (d >= minD) return null;
  if (d < 0.001) {
    dx = (p.aimX || p.x + 1) - p.x;
    dy = (p.aimY || p.y) - p.y;
    d = Math.hypot(dx, dy) || 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  const overlap = minD - d;
  const bossy = ENEMIES[e.kind]?.boss || e.kind === 'tank';
  const enemyMove = overlap * (bossy ? 0.42 : 0.78);
  const playerMove = overlap * (bossy ? 0.78 : 0.48) + (opts.playerKick ?? 0);
  const ec = collideWalls(e.x - nx * enemyMove, e.y - ny * enemyMove, e.size / 2, walls, e.x, e.y);
  const pc = collideWalls(p.x + nx * playerMove, p.y + ny * playerMove, PLAYER_SIZE / 2, walls, p.x, p.y);
  e.x = ec.x; e.y = ec.y;
  p.x = pc.x; p.y = pc.y;
  if (opts.fx && Math.random() < 0.18) run.fx.push({ t: 'body_push', x: Math.round((e.x + p.x) / 2), y: Math.round((e.y + p.y) / 2) });
  return { nx, ny, overlap };
}
function resolveEnemyPlayerBodies(run, players, walls) {
  for (const e of run.enemies) {
    for (const p of players.values()) resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 8 });
  }
}
function chanceStacks(v) {
  const full = Math.floor(Math.max(0, v));
  return full + (Math.random() < Math.max(0, v - full) ? 1 : 0);
}
function openPortal(run) {
  if (run.portal.open) return;
  if (run.pendingStrikes?.length) run.pendingStrikes = [];
  if (run.casinoVirus) { run.casinoVirus.activeRainStacks = 0; run.casinoVirus.rainT = 0; }
  run.portal.open = true;
  markRoomSolved(run, 'portal_open');
  settleRoomObjectiveAtPortalOpen(run);
  run.fx.push({ t: 'portal_open', x: run.portal.x, y: run.portal.y, skinRarity: run.skinRoomReward?.rarity || '' });
  if (run.skinRoomReward && !run.skinRoomReward.claimed) {
    run.fx.push({ t: 'skin_room_ready', skinRarity: run.skinRoomReward.rarity, x: run.portal.x, y: run.portal.y });
  }
}
function roomDirectorMinWaves(run) {
  const arch = roomPlanArchetype(run?.plan || {});
  if (arch === 'wide' || arch === 'long_lane') return 2;
  if (arch === 'panic_box' || arch === 'compact') return 2;
  return 2;
}
function roomDirectorMinAge(run) {
  const arch = roomPlanArchetype(run?.plan || {});
  const q = Math.max(0, run?.plan?.quota || 0);
  const loop = Math.floor(Math.max(0, run?.runDepth || 0) / 4);
  let t = 11.5 + Math.min(8, q * 0.34) + Math.min(4, loop * 0.7);
  if (arch === 'wide' || arch === 'long_lane') t += 3.0;
  if (arch === 'panic_box' || arch === 'compact') t -= 1.2;
  return Math.max(10, Math.min(24, t));
}
function roomDirectorTarget(run) {
  const plan = run?.plan || {};
  const q = Math.max(1, plan.quota || 1);
  const df = difficulty(run || {});
  const arch = roomPlanArchetype(plan);
  let extra = 2;
  if (arch === 'wide' || arch === 'long_lane') extra = 4;
  else if (arch === 'standard') extra = 3;
  else if (arch === 'panic_box' || arch === 'compact') extra = 2;
  extra += Math.min(4, Math.max(0, df.loop) + Math.floor(Math.max(0, df.late) * 0.6));
  if ((plan.modifierIds || []).some(m => ['static_rain','prism_grid','moving_room','blood_tax','skin_cache'].includes(m))) extra += 1;
  if ((plan.modifierIds || []).includes('casino_virus') && (run?.casinoVirus?.spinsLeft || 0) > 0) extra += 3 + Math.min(3, df.loop);
  return Math.max(q + 1, Math.round(q + extra));
}
function roomPacingReady(run) {
  if (!run || (run.spawned || 0) <= 0) return false;
  const target = roomDirectorTarget(run);
  const age = Math.max(0, (run.now || 0) - (run.roomStats?.startedAt || run.now || 0));
  const waves = Math.max(0, run.director?.waveIndex || 0);
  const minWaves = roomDirectorMinWaves(run);
  const minAge = roomDirectorMinAge(run);
  const enoughKills = (run.kills || 0) >= Math.max(1, run.plan?.quota || 1);
  const enoughSpawn = (run.spawned || 0) >= target;
  // Room pacing is a gate, not a command to spend the whole director budget.
  // A clean room can open after a short staged fight, but not after the first tiny pack.
  return enoughSpawn || (enoughKills && waves >= minWaves && age >= minAge);
}
function quotaCanOpenPortal(run) {
  if (run.plan?.category === 'boss') return false;
  if (roomHasLiveEnemies(run)) return false;
  if (hasMod(run, 'hunter_contract')) return !!run.hunterWave?.done;
  if (hasMod(run, 'casino_virus')) return !!run.casinoVirus?.done;
  return roomPacingReady(run);
}


// ---------------------------------------------------------------- player combo
function createComboState(ownerId = '') {
  return { ownerId: ownerId || '', score: 0, mult: 1, count: 0, timer: 0, window: 0, lastMethod: '', recent: [], flash: 0, drop: 0, best: 1, tier: 0, lastGain: 0, lastLabel: '', lastActorId: '', lastPayout: null };
}
function ensureCombo(run, ownerId = '') {
  if (ownerId) {
    if (!run.playerCombos || typeof run.playerCombos !== 'object') run.playerCombos = {};
    if (!run.playerCombos[ownerId]) run.playerCombos[ownerId] = createComboState(ownerId);
    return run.playerCombos[ownerId];
  }
  if (!run.combo) run.combo = createComboState();
  return run.combo;
}
function playerNameForFx(players, id) {
  const p = id && players?.get ? players.get(id) : null;
  return String(p?.name || '').slice(0, 12);
}
function comboMultiplierFromScore(score) {
  const s = Math.max(0, Number(score) || 0);
  if (s <= 0.01) return 1;
  return Math.round((1 + Math.min(8.9, Math.pow(s / 42, 0.78) * 0.85)) * 10) / 10;
}
function comboTier(mult) {
  if (mult >= 7) return 4;
  if (mult >= 5) return 3;
  if (mult >= 3) return 2;
  if (mult >= 1.6) return 1;
  return 0;
}
function comboSourceFromBullet(b = {}) {
  const k = String(b.kind || '');
  if (b.ricocheted) return 'ricochet';
  if (b.mine) return 'rocketgun';
  if (k === 'shotgun' || k === 'seeker' || k === 'rocketgun') return k;
  if (k === 'drone') return 'drone';
  if (k === 'active_shrapnel' || k === 'active_noise') return 'ability';
  if (k === 'mine') return 'rocketgun';
  return k || 'weapon';
}
function comboSourceLabel(method) {
  return ({
    shotgun: 'SHOTGUN', seeker: 'SEEKER', rocketgun: 'ROCKETGUN', ricochet: 'RICOCHET',
    ability: 'Q', dash: 'DASH', drone: 'DRONE',
    fire: 'BURN', burn: 'BURN', poison: 'POISON', freeze: 'FREEZE', status: 'STATUS',
    blast: 'BLAST', chain: 'CHAIN', weapon: 'WEAPON'
  })[method] || String(method || 'HIT').toUpperCase();
}
function comboRewardType(run, players, c = {}) {
  const ownerId = c.ownerId || c.lastActorId || '';
  const owner = ownerId && players?.get ? players.get(ownerId) : null;
  const first = owner || [...(players?.values?.() || [])].find(p => p && p.connected);
  const type = String(first?.stats?.comboPrize || 'gld').toLowerCase();
  return type === 'exp' || type === 'hp' ? type : 'gld';
}
function comboRewardLabel(type) {
  return type === 'exp' ? 'EXP' : type === 'hp' ? 'HP' : 'GLD';
}
function comboReelOutcome(run, kills = 0, mult = 1) {
  const tier = comboTier(mult);
  if (tier <= 0 || kills < 2) return null;
  const r = Math.random();
  if (tier >= 4 && r < 0.10) return 'JCK';
  if (tier >= 3 && r < 0.18) return 'WPN';
  if (tier >= 2 && r < 0.28) return 'DASH';
  if (r < 0.48) return 'GLD';
  if (r < 0.68) return 'EXP';
  if (r < 0.84) return 'HEA';
  return tier >= 3 ? 'STC' : null;
}
function applyComboReelOutcome(run, players, owner, outcome, kills = 0, mult = 1) {
  if (!outcome || !owner) return null;
  const econ = loopEconomyMul(run);
  const base = Math.max(1, Math.round(kills * Math.max(1, mult)));
  const symbols = outcome === 'JCK' ? ['JCK','JCK','JCK'] : outcome === 'WPN' ? ['WPN','HOLD','WPN'] : outcome === 'DASH' ? ['DASH','DASH','OK'] : outcome === 'STC' ? ['GLD','GLD','STC'] : [outcome, outcome, outcome];
  let label = outcome;
  let val = 0;
  if (outcome === 'GLD') { val = Math.round(base * 0.55 * econ); owner.economy.money += val; label = `GLD +${val}`; }
  else if (outcome === 'EXP') { val = Math.round(base * 0.45 * econ); addXp(run, owner, val); label = `EXP +${val}`; }
  else if (outcome === 'HEA') { val = Math.max(1, Math.round(base * 0.08)); owner.hp = Math.min(maxHp(owner), owner.hp + val); label = `HP +${val}`; }
  else if (outcome === 'DASH') { owner.dashCharges = Math.min(dashMax(owner), owner.dashCharges + 1); label = 'DASH CHARGE'; }
  else if (outcome === 'WPN') { owner.casinoHoldChoices = Math.min(3, (owner.casinoHoldChoices || 0) + 1); label = 'NEXT CHEST +1 OPTION'; }
  else if (outcome === 'JCK') { val = Math.round(base * 1.6 * econ); owner.economy.money += val; label = `JACKPOT GLD +${val}`; }
  else if (outcome === 'STC') { addStaticDebt(run, 1, 'combo_reel'); label = 'STATIC STORM BANKED'; }
  run.fx.push({ t: 'combo_reel', id: owner.id, name: owner.name || '', personal: 1, outcome, label, symbols, kills, mult: Math.round(mult * 10) / 10 });
  return { outcome, label, val };
}
function awardComboPayout(run, players, c = {}, reason = 'break') {
  const kills = Math.max(0, c.count | 0);
  const mult = Math.max(1, Number(c.mult || comboMultiplierFromScore(c.score || 0)) || 1);
  if (!kills) return null;
  const ownerId = c.ownerId || c.lastActorId || '';
  const owner = ownerId && players?.get ? players.get(ownerId) : null;
  if (!owner || !owner.connected) return null;
  const type = comboRewardType(run, players, c);
  const raw = kills * mult;
  let amount = type === 'hp' ? Math.max(0, Math.round(raw * 0.1)) : Math.max(1, Math.round(raw * loopEconomyMul(run)));
  const link = owner.casinoComboLink ? 1 : 0;
  if (link) { amount *= 2; owner.casinoComboLink = 0; }
  if (amount <= 0) return null;
  if (type === 'gld') owner.economy.money += amount;
  else if (type === 'exp') addXp(run, owner, amount);
  else if (type === 'hp' && owner.alive) owner.hp = Math.min(maxHp(owner), owner.hp + amount);
  const payout = { id: owner.id, name: owner.name || '', personal: 1, type, amount, kills, mult: Math.round(mult * 10) / 10, reason, label: comboRewardLabel(type), link };
  c.lastPayout = payout;
  run.fx.push({ t: 'combo_payout', ...payout });
  const reel = comboReelOutcome(run, kills, mult);
  if (reel) applyComboReelOutcome(run, players, owner, reel, kills, mult);
  if (run.runMemory) {
    run.runMemory.comboPayouts = (run.runMemory.comboPayouts || 0) + 1;
    if (type === 'gld') run.runMemory.totalGld = (run.runMemory.totalGld || 0) + amount;
    if (type === 'exp') run.runMemory.totalExp = (run.runMemory.totalExp || 0) + amount;
    if (type === 'hp') run.runMemory.totalHea = (run.runMemory.totalHea || 0) + amount;
  }
  return payout;
}
function resetComboChain(c) {
  c.score = 0; c.mult = 1; c.count = 0; c.timer = 0; c.lastMethod = ''; c.recent = []; c.tier = 0; c.lastGain = 0; c.lastLabel = ''; c.window = 0; c.lastActorId = '';
}
function awardAllComboPayouts(run, players, reason = 'room_transition') {
  if (!run?.playerCombos || typeof run.playerCombos !== 'object') return;
  for (const c of Object.values(run.playerCombos)) {
    if (c && (c.count || 0) > 0 && (c.score || 0) > 0) awardComboPayout(run, players, c, reason);
  }
}
function registerComboEvent(run, actor, method, enemy = null, scale = 1) {
  if (!run || run.phase !== 'play' || !actor || !actor.alive) return;
  method = String(method || 'hit').toLowerCase();
  if (method === 'shell' || method === 'armor') return; // armor breaks are support feedback, not a kill method
  if (!method || method === 'dev' || method === 'hit') method = 'weapon';
  const c = ensureCombo(run, actor.id || '');
  const def = enemy?.kind ? ENEMIES[enemy.kind] : null;
  const score = Math.max(1, def?.score || 1);
  let gain = (7 + score * 4.5) * Math.max(0.1, Number(scale) || 1);
  if (enemy?.elite) gain *= 1.65;
  if (def?.boss) gain *= 4.5;
  const recent = Array.isArray(c.recent) ? c.recent : [];
  if (method !== c.lastMethod) gain *= 1.45;
  else gain *= 0.72;
  if (!recent.includes(method)) gain *= 1.22;
  const repeated = recent.filter(x => x === method).length;
  if (repeated >= 2) gain *= 0.66;
  c.score = Math.max(0, c.score || 0) + gain;
  // The visible combo number is a kill count. Support actions such as shell breaks can
  // feed the multiplier and method list, but they should not inflate "kills".
  const isKill = Math.max(0, Number(scale) || 0) >= 0.99;
  if (isKill) c.count = Math.max(0, c.count | 0) + 1;
  c.lastMethod = method;
  c.lastActorId = actor.id || c.lastActorId || '';
  c.recent = [method, ...recent].slice(0, 5);
  c.timer = Math.max(c.timer || 0, Math.min(5.2, 2.65 + Math.min(1.55, comboMultiplierFromScore(c.score) * 0.18) + Math.min(0.8, score * 0.08)));
  c.window = c.timer;
  c.flash = 0.34;
  c.drop = 0;
  c.lastGain = Math.round(gain);
  c.lastLabel = comboSourceLabel(method);
  const oldTier = c.tier || 0;
  c.mult = comboMultiplierFromScore(c.score);
  c.best = Math.max(c.best || 1, c.mult || 1);
  c.tier = comboTier(c.mult);
  if (run.runMemory) run.runMemory.bestCombo = Math.max(run.runMemory.bestCombo || 1, c.best || 1);
  if (c.tier > oldTier || (isKill && c.count === 1)) run.fx.push({ t: 'combo_tick', mult: c.mult, tier: c.tier, method, label: c.lastLabel, x: Math.round(actor.x || 0), y: Math.round(actor.y || 0), id: actor.id });
}
function damageCombo(run, p, dmg = 0) {
  if (!run || !p) return;
  const c = ensureCombo(run, p.id || '');
  if ((c.score || 0) <= 0) return;
  const rawLoss = Math.max(8, c.score * 0.16 + Math.max(0, Number(dmg) || 0) * 0.55);
  const loss = Math.min(c.score * 0.45, rawLoss);
  c.score = Math.max(0.5, c.score - loss);
  c.mult = comboMultiplierFromScore(c.score);
  c.tier = comboTier(c.mult);
  c.timer = c.score > 0 ? Math.max(1.15, Math.min(c.timer || 0, 2.4)) : 0;
  c.drop = 0.45;
  c.flash = 0.10;
  if (c.score <= 0) { c.count = 0; c.lastMethod = ''; c.recent = []; c.lastLabel = ''; }
  if (p.casinoComboLink) { p.casinoComboLink = 0; run.fx.push({ t: 'combo_link_break', id: p.id, dmg: Math.round(dmg || 0) }); }
  run.fx.push({ t: 'combo_drop', mult: c.mult, id: p.id, dmg: Math.round(dmg || 0) });
}
function stepOneCombo(run, players, c, dt) {
  c.flash = Math.max(0, (c.flash || 0) - dt);
  c.drop = Math.max(0, (c.drop || 0) - dt);
  if ((c.score || 0) <= 0) { c.score = 0; c.mult = 1; c.timer = 0; c.tier = 0; return; }
  c.timer = Math.max(0, (c.timer || 0) - dt);
  if (c.timer <= 0) {
    awardComboPayout(run, players, c, 'timeout');
    const ownerId = c.ownerId || c.lastActorId || '';
    resetComboChain(c);
    c.ownerId = ownerId;
    run.fx.push({ t: 'combo_break', id: ownerId, name: playerNameForFx(players, ownerId), personal: ownerId ? 1 : 0 });
    return;
  }
  c.mult = comboMultiplierFromScore(c.score);
  c.tier = comboTier(c.mult);
}
function stepCombo(run, players, dt) {
  if (!run.playerCombos || typeof run.playerCombos !== 'object') run.playerCombos = {};
  for (const p of players.values()) if (p?.connected) ensureCombo(run, p.id || '');
  for (const c of Object.values(run.playerCombos)) stepOneCombo(run, players, c, dt);
}
function comboPreviewPayout(run, players, c = {}) {
  const kills = Math.max(0, c.count | 0);
  const mult = Math.max(1, Number(c.mult || comboMultiplierFromScore(c.score || 0)) || 1);
  const type = comboRewardType(run, players, c);
  const raw = kills * mult;
  const amount = type === 'hp' ? Math.max(0, Math.round(raw * 0.1)) : Math.max(0, Math.round(raw * loopEconomyMul(run)));
  return { type, amount, label: comboRewardLabel(type) };
}
function comboSnapshotFor(run, players, ownerId = '') {
  const c = ensureCombo(run, ownerId || '');
  const prize = comboPreviewPayout(run, players, c);
  return {
    ownerId: c.ownerId || ownerId || '', score: Math.round(c.score || 0), mult: c.mult || 1, count: c.count || 0,
    timer: Math.max(0, Math.round((c.timer || 0) * 10) / 10), window: Math.max(0.1, Math.round((c.window || 3) * 10) / 10),
    lastMethod: c.lastMethod || '', recent: (c.recent || []).slice(0, 4), flash: c.flash || 0, drop: c.drop || 0, tier: c.tier || 0, best: c.best || 1, lastLabel: c.lastLabel || '', lastPayout: c.lastPayout || null,
    prizeType: prize.type, prizeLabel: prize.label, prizeAmount: prize.amount
  };
}
function comboSnapshot(run, players) {
  const connected = [...(players?.values?.() || [])].filter(p => p && p.connected);
  let best = null;
  for (const p of connected) {
    const snap = comboSnapshotFor(run, players, p.id);
    if (!best || (snap.score || 0) > (best.score || 0)) best = snap;
  }
  return best || comboSnapshotFor(run, players, '');
}
function playerCombosSnapshot(run, players) {
  const out = {};
  for (const p of players.values()) if (p?.connected) out[p.id] = comboSnapshotFor(run, players, p.id);
  return out;
}

// ---------------------------------------------------------------- state
export function createRun(seedBase) {
  return {
    seedBase: seedBase >>> 0,
    runDepth: 0,
    phase: 'play',           // play | install | lost
    phaseT: 0,
    staticDebt: 0,
    staticDebtSources: {},
    staticRainCarry: 0,
    staticRainCarrySources: {},
    // Skin pity is run-local and player-facing only through more frequent SKN CACHE rooms.
    // It rises after non-boss rooms without a skin and resets on a skin room.
    skinPity: 0,
    staticRainStacks: 0,
    staticRainSources: [],
    staticRainNaturalLevel: 0,
    staticRainDebtLevel: 0,
    staticRainCarryLevel: 0,
    staticRainCanSeedNext: false,
    staticRainFromPending: false,
    roomStaticRainFalls: 0,
    roomStats: null, roomObjective: null, roomObjectiveSettlement: null, roomObjectiveLiveState: null, roomObjectiveFrozenStats: null, contractFavorsPending: [], contractFavorsActive: [], contractFavorsUsedThisRoom: [], nextRoomPreview: null, devNextRoomOverride: null, roomSockets: [], roomWires: [], movingWalls: [], prismZones: [], hunterWave: null, casinoVirus: null, prismLaneT: 0, pendingPrismLanes: [], pendingBloodTax: [], portalOpenedAt: 0, huntedExitOpenedAt: 0, huntedExitSpawnT: 0, combo: createComboState(), playerCombos: {},
    runMemory: { roomsCleared: 0, totalKills: 0, totalGld: 0, totalExp: 0, totalHea: 0, totalDamageTaken: 0, bossesDefeated: 0, loopsCleared: 0, highestDepth: 0, noHitStreak: 0, fastStreak: 0, bestNoHitStreak: 0, bestFastStreak: 0, skinRoomsSeen: 0, staticPaid: 0, shellBreaks: 0, huntedWaves: 0, objectivesSeen: 0, objectivesDone: 0, objectiveGld: 0, objectiveExp: 0, contractStreak: 0, bestContractStreak: 0, contractGld: 0, contractExp: 0, favorsEarned: 0, bestCombo: 1 },
    tapeLog: [],
    finalSummary: null, completedAt: 0,
    plan: null,
    enemies: [], bullets: [], pickups: [], activeFields: [], pendingCasinoRolls: [],
    portal: null,
    kills: 0, spawned: 0,
    directorT: 1.2,
    director: null, // v1 encounter director: room mode + wave cadence
    rainT: 3,
    fx: [],                  // dopamine events flushed each snapshot
    hunterSpawned: false, hunterTarget: null, roomAge: 0,
    tick: 0
  };
}


function skinPart(v, fallback) {
  const x = String(v || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(x) ? x.toLowerCase() : fallback;
}
function skinId(v) {
  const x = String(v || 'terminal_mint').trim().toLowerCase();
  return /^[a-z0-9_\-]{2,32}$/.test(x) ? x : 'terminal_mint';
}
export function sanitizeSkin(skin = {}) {
  skin = skin || {};
  return {
    id: skinId(skin.id),
    fill: skinPart(skin.fill, '#f3f3f3'),
    outline: skinPart(skin.outline, '#00ff66'),
    barrel: skinPart(skin.barrel, '#00ff66')
  };
}

export function createPlayer(id, name, idx, skin = null) {
  const sp = spawnPoint(idx);
  return {
    id, name: String(name || 'p?').slice(0, 12), idx, skin: sanitizeSkin(skin),
    x: sp.x, y: sp.y, hp: PLAYER_HP, alive: true,
    aimX: sp.x, aimY: sp.y - 100,
    moveX: 0, moveY: 0, fire: false,
    weapons: ['shotgun'], weaponIdx: 0, cd: 0,
    shgCharges: 4, shgReload: 0, fireWasDown: false,
    sekSwarmCd: 0, shgLongshotCd: 0,
    recoilT: 0, recoilX: 0, recoilY: 0,
    dashCharges: 1, dashTimer: 0, invuln: 0, activeCd: 0, activeBuffT: 0,
    stats: defaultStats(),
    active: { core: null, level: 0, mutations: [] },
    economy: { money: 0, xp: 0, level: 0, nextLevelXp: 40, pending: 0, lifetimeXp: 0 },
    lastSeq: 0,
    droneCd: 0, orbHits: new Map(),
    offer: null, bossSignaturePending: false, bossSignatureChoices: null, bossSignatureKind: '',
    weaponChestOffer: null,
    abilityChestOffer: null,
    touch: new Map(),
    wantDash: false, wantInteract: false, wantActive: false, wantWeapon: -1, wantSecondary: false,
    connected: true
  };
}
export function maxHp(p) { return Math.max(20, PLAYER_HP + p.stats.maxHpAdd); }
export function speed(p) {
  const route = Math.min(0.18, ((p.huntRouteT || 0) / Math.max(1, 4.0)) * 0.14 * Math.max(0, p.stats?.sigHuntRoute || 0));
  return PLAYER_SPEED * p.stats.spdMul * (1 + route) * (p.slowT > 0 ? (p.slowMul || 0.6) : 1);
}
export function dashMax(p) { return 1 + p.stats.dashAdd; }

export function startRoom(run, players) {
  const seed = (run.seedBase + run.runDepth * 7919) >>> 0;
  const loopIndex = Math.floor(run.runDepth / 4);
  run.plan = generateRoom(seed, run.runDepth, loopIndex, run.devNextRoomOverride || null);
  run.plan.finalBoss = (run.plan.category === 'boss' && run.runDepth >= FINAL_BOSS_DEPTH) ? 1 : 0;
  run.bossKind = '';
  run.plan.modifierIds = normalizeRoomModifiers(run.plan.modifierIds || []);
  if (run.plan.modifierIds.includes('greed')) run.plan.modifierIds = run.plan.modifierIds.filter(m => m !== 'skin_cache');
  activatePendingContractFavors(run);
  forceBigRoomForHunter(run);
  const naturalStaticRain = run.plan.modifierIds.includes('static_rain');
  const naturalStaticLevel = naturalStaticRain && debtEngineEligiblePlan(run.plan) ? 1 : 0;
  const debtStacks = run.staticDebt === true ? 1 : Math.max(0, run.staticDebt || 0);
  const carryStacks = Math.max(0, run.staticRainCarry || 0);
  const pendingRainStacks = clampStaticRainLevel(debtStacks + carryStacks);
  const debtEngineStacks = debtEngineEligiblePlan(run.plan) ? playerDebtEngineStacks(players) : 0;
  const incomingSources = [];
  if (naturalStaticLevel > 0) incomingSources.push({ id: 'room_modifier', level: naturalStaticLevel });
  if (debtStacks > 0) incomingSources.push(...sourceListFromMap(run.staticDebtSources, 'static_debt', debtStacks));
  if (carryStacks > 0) incomingSources.push(...sourceListFromMap(run.staticRainCarrySources, 'previous_room_hits', carryStacks));
  if (debtEngineStacks > 0) incomingSources.push({ id: 'debt_engine', level: debtEngineStacks });
  const incomingBreakdown = normalizeStaticSources(incomingSources);
  const incomingRainStacks = incomingBreakdown.total;
  run.staticRainStacks = 0;
  run.staticRainSources = [];
  run.staticRainNaturalLevel = 0;
  run.staticRainDebtLevel = 0;
  run.staticRainCarryLevel = 0;
  run.debtEngineRainStacks = 0;
  run.staticRainCanSeedNext = false;
  run.staticRainFromPending = false;
  run.roomStaticRainFalls = 0;
  awardAllComboPayouts(run, players, 'room_transition');
  run.combo = createComboState();
  run.playerCombos = {};
  run.roomContractStakes = {};
  initRoomStats(run);
  run.roomObjective = shouldOfferRoomContract(run.plan, run.runDepth, seed) ? roomObjectiveForPlan(run.plan, run.runDepth) : null;
  attachContractPrizePreview(run);
  run.nextRoomPreview = makeNextRoomPreview(run);
  run.roomSockets = [];
  run.roomWires = [];
  run.movingWalls = [];
  run.prismZones = [];
  run.hunterWave = null;
  run.casinoVirus = null;
  run.huntedExitOpenedAt = 0;
  run.huntedExitSpawnT = 0;
  run.prismLaneT = 1.8 + Math.random() * 1.4;
  run.pendingPrismLanes = [];
  run.pendingBloodTax = [];
  run.pendingStrikes = [];
  if (hasMod(run, 'anchor_gravity')) {
    const srng = mulberry32((seed ^ 0xA44C07) >>> 0);
    const rr = playableRectForArchetype(run.plan.roomArchetype || 'standard');
    const count = 1 + (loopIndex >= 4 && srng() < 0.45 ? 1 : 0);
    const keepAway = [
      { x: run.plan.w / 2, y: run.plan.h / 2, r: 230 },
      { x: run.plan.w / 2 + 260, y: run.plan.h / 2, r: 190 },
      { x: run.plan.w / 2 - 260, y: run.plan.h / 2, r: 190 }
    ];
    for (let si = 0; si < count; si++) {
      let sx = run.plan.w / 2, sy = run.plan.h / 2;
      for (let tries = 0; tries < 10; tries++) {
        const a = srng() * Math.PI * 2;
        const d = 310 + srng() * 390;
        sx = clamp(run.plan.w / 2 + Math.cos(a) * d, rr.x + 210, rr.right - 210);
        sy = clamp(run.plan.h / 2 + Math.sin(a) * d, rr.y + 180, rr.bottom - 180);
        if (!keepAway.some(k => dist2(sx, sy, k.x, k.y) < k.r * k.r)) break;
      }
      run.roomSockets.push({ x: Math.round(sx), y: Math.round(sy), r: 230 + Math.round(srng() * 55), inner: 52 });
    }
  }
  if ((run.plan.modifierIds || []).includes('prism_grid')) {
    run.prismZones = makePrismSlowZones(seed, run.plan.roomArchetype || 'standard');
  }
  if ((run.plan.modifierIds || []).includes('moving_room')) {
    run.movingWalls = makeMovingWalls(seed, run.plan.roomArchetype || 'standard');
  }
  if ((run.plan.modifierIds || []).includes('hunter_contract')) {
    const total = 2 + Math.min(5, Math.floor((run.runDepth || 0) / 4) + Math.floor((run.runDepth || 0) / 10));
    run.hunterWave = { total, index: 0, waiting: 0.35, done: false };
  }
  if ((run.plan.modifierIds || []).includes('casino_virus')) {
    run.casinoVirus = { spinsLeft: 3, totalSpins: 3, appliedSpins: 0, nextSpin: 6, done: false, lastLabel: 'WAITING', activeRainStacks: 0, rainT: 0, spinSeq: 0, rainKind: '', lastSymbols: [], pendingEvent: null };
  }
  if (incomingRainStacks > 0 && debtEngineEligiblePlan(run.plan)) {
    if (!run.plan.modifierIds.includes('static_rain')) run.plan.modifierIds.push('static_rain');
    run.debtEngineRainStacks = Math.max(0, debtEngineStacks || 0);
    run.staticRainStacks = incomingRainStacks;
    run.staticRainSources = incomingBreakdown.sources;
    run.staticRainNaturalLevel = naturalStaticLevel;
    run.staticRainDebtLevel = debtStacks;
    run.staticRainCarryLevel = carryStacks;
    run.staticRainFromPending = pendingRainStacks > 0;
    // Only a natural room modifier can seed the next storm. Banked debt, Debt Engine, and Casino Virus do not cascade by themselves.
    run.staticRainCanSeedNext = naturalStaticLevel > 0;
    if (pendingRainStacks > 0) {
      run.staticDebt = 0;
      run.staticDebtSources = {};
      run.staticRainCarry = 0;
      run.staticRainCarrySources = {};
    }
  }
  run.skinRoomReward = null;
  if (run.plan.category !== 'boss' && !isGreedRoom(run)) {
    const skinRng = mulberry32((seed ^ 0x5A11C0DE ^ (run.runDepth * 1319)) >>> 0);
    const mods = run.plan.modifierIds || [];
    const special = !!run.plan.specialRoomId;
    // v2.1: skin rooms were too rare. Raise the base rate and add soft pity.
    // Rule of thumb: normal rooms can show SKN CACHE often enough to feel collectible;
    // special/greed/casino/moving/debt rooms push the chance higher.
    const pity = Math.max(0, run.skinPity || 0);
    let skinChance = 0.075 + Math.min(0.055, loopIndex * 0.010) + Math.min(0.120, pity * 0.022);
    if (special) skinChance += 0.045;
    if (run.plan.specialRoomId === 'reward_pocket') skinChance += 0.050;
    if (mods.includes('greed') || mods.includes('casino_virus') || mods.includes('moving_room') || mods.includes('hunter_contract')) skinChance += 0.034;
    if (mods.includes('skin_cache')) skinChance = Math.max(skinChance, 1);
    // After several misses, stop letting bad RNG hide the collection system.
    if (pity >= 5) skinChance = Math.max(skinChance, 0.70);
    if (pity >= 7) skinChance = 1;
    skinChance = Math.min(0.320, skinChance);
    if (skinRng() < skinChance) {
      const skin = rollRoomSkin(skinRng, run.runDepth, mods);
      run.skinRoomReward = { id: skin.id, rarity: skin.rarity || 'uncommon', claimed: false };
      run.skinPity = 0;
      if (!mods.includes('skin_cache')) mods.push('skin_cache');
    } else {
      run.skinPity = Math.min(8, pity + 1);
    }
  }
  run.enemies = []; run.bullets = []; run.pickups = []; run.activeFields = [];
  run.pendingStrikes = []; run.pendingActives = []; run.pendingCasinoRolls = [];
  run.hunterSpawned = false; run.hunterTarget = null; run.roomAge = 0; run.portalOpenedAt = 0;
  run.kills = 0; run.spawned = 0;
  run.directorT = 1.4; run.director = null; run.rainT = 3.5;
  const pp = portalSpot(seed + 0x51F15EED, run.plan.walls, run.plan.interactables);
  run.portal = { x: pp.x, y: pp.y, open: false };
  run.director = createDirectorState(run);
  run.phase = 'play'; run.phaseT = 0;
  let i = 0;
  for (const p of players.values()) {
    const sp = spawnPoint(i++);
    p.x = sp.x; p.y = sp.y;
    if (!p.alive) { p.alive = true; p.hp = Math.round(maxHp(p) * 0.5); }
    else p.hp = Math.min(maxHp(p), p.hp + 15);
    p.invuln = 1.2;
    p.quarantineT = (p.stats.sigQuarantineBuffer || 0) > 0 ? 10 : 0;
    p.quarantineHp = (p.stats.sigQuarantineBuffer || 0) > 0 ? 34 + Math.min(36, (p.stats.sigQuarantineBuffer - 1) * 10) : 0;
    p.emergencyCleanseUsed = false; p.emergencyCleanseT = 0; p.emergencyCleansePulse = 0;
    p.insuranceProcessUsed = false;
    p.huntRouteT = 0; p.redOverdriveShots = 0; p.aimGlitchT = 0;
    p.offer = null;
    p.weaponChestOffer = null;
  }
  if (run.director && [...players.values()].some(p => p.connected && (p.stats?.sigDeafCommand || 0) > 0)) {
    const stacks = Math.max(...[...players.values()].map(p => p.connected ? (p.stats?.sigDeafCommand || 0) : 0), 0);
    run.director.pauseT = Math.max(run.director.pauseT || 0, 2.0 + Math.min(2.4, stacks * 0.55));
    run.fx.push({ t: 'active_mutation', label: 'DEAF COMMAND', x: run.plan.w / 2, y: run.plan.h / 2, r: 120, tone: 'cyan' });
  }
  if (run.plan.specialRoomId === 'chill_room') {
    run.director = null;
    openPortal(run);
  }
  if (run.plan.category === 'boss') {
    const bossKind = chooseBossKind(run);
    const boss = spawnEnemy(run, players, bossKind, false);
    if (isFinalBossRoom(run)) { boss.maxHp = Math.round((boss.maxHp || boss.hp || 1) * 1.35); boss.hp = boss.maxHp; boss.finalBoss = 1; }
    run.bossKind = bossKind;
    run.fx.push({ t: 'boss_intro', label: ENEMIES[bossKind]?.label || 'BOS', kind: bossKind, x: Math.round(boss.x), y: Math.round(boss.y), active: boss.bossActiveCore || '' });
  }
  else if (run.plan.modifierIds.includes('hunter_contract')) {
    run.fx.push({ t: 'contract', label: 'HUNTER WAVES', body: `0/${run.hunterWave?.total || 2} WAVES · PORTAL LOCKED` });
  }
  if (run.plan.specialRoomId === 'reward_pocket') {
    for (let r = 0; r < 4; r++) dropPickup(run, run.portal.x + (Math.random() - 0.5) * 120, run.portal.y + (Math.random() - 0.5) * 120, Math.random() < 0.6 ? 'GLD' : 'EXP', 16 + Math.round(Math.random() * 18), { personal: 1, label: 'REWARD POCKET' });
  }
  const entryIntel = roomIntel(run.plan, run.staticRainStacks || 0, staticRainCurrentMode(run));
  run.fx.push({ t: 'room', roomId: run.plan.roomId, loop: loopIndex, depth: run.runDepth, mods: run.plan.modifierIds, cat: run.plan.category, special: run.plan.specialRoomId, archetype: run.plan.roomArchetype || 'standard', director: run.director?.label || '', skinRarity: run.skinRoomReward?.rarity || '', danger: entryIntel.danger, dangerLabel: entryIntel.dangerLabel, threatTags: entryIntel.threatTags, rewardTags: entryIntel.rewardTags, tip: entryIntel.tip });
  if (run.skinRoomReward) run.fx.push({ t: 'skin_room', skinRarity: run.skinRoomReward.rarity, x: run.portal.x, y: run.portal.y });
  if (run.director?.label) run.fx.push({ t: 'director_room', label: run.director.label, intent: run.director.mode, x: run.portal.x, y: run.portal.y });
}

export function resetRun(run, players) {
  run.runDepth = 0;
  run.staticDebt = 0;
  run.staticDebtSources = {};
  run.staticRainCarry = 0;
  run.staticRainCarrySources = {};
  run.staticRainStacks = 0;
  run.staticRainSources = [];
  run.staticRainNaturalLevel = 0;
  run.staticRainDebtLevel = 0;
  run.staticRainCarryLevel = 0;
  run.staticRainCanSeedNext = false;
  run.staticRainFromPending = false;
  run.roomStaticRainFalls = 0;
  run.combo = createComboState();
  run.playerCombos = {};
  run.roomStats = null; run.roomObjective = null; run.roomObjectiveSettlement = null; run.roomObjectiveLiveState = null; run.roomObjectiveFrozenStats = null; run.contractFavorsPending = []; run.contractFavorsActive = []; run.contractFavorsUsedThisRoom = []; run.nextRoomPreview = null; run.devNextRoomOverride = null; run.roomSockets = []; run.roomWires = []; run.movingWalls = []; run.prismZones = []; run.hunterWave = null; run.casinoVirus = null; run.pendingPrismLanes = []; run.pendingBloodTax = []; run.pendingStrikes = []; run.portalOpenedAt = 0; run.huntedExitOpenedAt = 0; run.huntedExitSpawnT = 0;
  run.runMemory = { roomsCleared: 0, totalKills: 0, totalGld: 0, totalExp: 0, totalHea: 0, totalDamageTaken: 0, bossesDefeated: 0, loopsCleared: 0, highestDepth: 0, noHitStreak: 0, fastStreak: 0, bestNoHitStreak: 0, bestFastStreak: 0, skinRoomsSeen: 0, staticPaid: 0, shellBreaks: 0, huntedWaves: 0, objectivesSeen: 0, objectivesDone: 0, objectiveGld: 0, objectiveExp: 0, contractStreak: 0, bestContractStreak: 0, contractGld: 0, contractExp: 0, favorsEarned: 0, bestCombo: 1 };
  run.tapeLog = [];
  run.finalSummary = null;
  run.completedAt = 0;
  for (const p of players.values()) {
    p.weapons = ['shotgun']; p.weaponIdx = 0; p.cd = 0;
    p.shgCharges = 4; p.shgReload = 0; p.fireWasDown = false; p.sekSwarmCd = 0; p.shgLongshotCd = 0; p.recoilT = 0; p.recoilX = 0; p.recoilY = 0;
    p.stats = defaultStats();
    p.active = { core: null, level: 0, mutations: [] };
    p.economy = { money: 0, xp: 0, level: 0, nextLevelXp: 40, pending: 0, lifetimeXp: 0 };
    p.dashCharges = 1; p.activeCd = 0; p.activeBuffT = 0; p.alive = true; p.hp = PLAYER_HP; p.offer = null; p.bossSignaturePending = false; p.bossSignatureChoices = null; p.bossSignatureKind = ''; p.weaponChestOffer = null; p.abilityChestOffer = null;
  }
  startRoom(run, players);
}

// ---------------------------------------------------------------- spawning
function difficulty(run) {
  const loop = Math.floor(run.runDepth / 4);
  const late = Math.max(0, loop - 2);
  const depth = run.runDepth;
  // First loop is deliberately readable. After several loops, pressure ramps hard.
  const hpBase = 0.74 + depth * 0.055 + loop * 0.11 + Math.pow(late, 1.55) * 0.34;
  const dmgBase = 0.62 + depth * 0.045 + loop * 0.09 + Math.pow(late, 1.45) * 0.26;
  return {
    loop, late,
    // Keep control readable, but make the room pressure about 2x: denser spawns, bigger quotas, harsher elites.
    hp: hpBase * 1.30,
    dmg: dmgBase * 1.25,
    eliteChance: loop <= 0 ? 0 : Math.min(0.58, (0.045 + loop * 0.035 + late * 0.04) * 1.75),
    eliteHp: 1.75 + loop * 0.16,
    eliteDmg: 1.34 + loop * 0.07,
    maxActive: Math.min(MAX_ENEMIES, Math.round((8 + depth * 1.15 + loop * 4 + Math.pow(late, 1.5) * 8) * DIFFICULTY_MULT)),
    addCap: Math.min(42, Math.round((8 + loop * 3 + late * 4) * DIFFICULTY_MULT))
  };
}
function scaling(run) {
  return difficulty(run).hp;
}
function spawnPool(run) {
  const loop = Math.floor(run.runDepth / 4);
  if (run.runDepth === 0) return ['grunt','grunt','grunt','runner'];
  if (run.runDepth === 1) return ['grunt','grunt','runner','shooter'];
  if (run.runDepth === 2) return ['grunt','runner','runner','shooter','charger'];
  if (loop === 1) return ['grunt','runner','shooter','charger','bomber','bouncer','splitter'];
  if (loop === 2) return ['grunt','runner','shooter','charger','bomber','bouncer','tank','glitch','anchor','leech','pulse','damper','warden'];
  return SPAWN_POOLS[Math.min(loop, SPAWN_POOLS.length - 1)];
}

// v2.1.9: Event/modifier spawn gates. Room modifiers that create extra enemies must
// respect run difficulty instead of pulling late-loop bodies on loop 0. This is stricter
// than the normal director pool because forced events can stack with room rules.
const MODIFIER_ENEMY_MIN_LOOP = {
  grunt: 0, runner: 0, shooter: 0, charger: 0,
  bomber: 1, bouncer: 1, splitter: 1,
  tank: 2, glitch: 2, anchor: 2, leech: 2, pulse: 2, damper: 2, warden: 2,
  echo: 3, orbiter: 3, prism: 3, herald: 3, boss: 99
};
function modifierLoop(run) { return Math.max(0, Math.floor((run?.runDepth || 0) / 4)); }
function enemyAllowedForModifier(run, kind) {
  if (!ENEMIES[kind]) return false;
  const loop = modifierLoop(run);
  const minLoop = MODIFIER_ENEMY_MIN_LOOP[kind] ?? 0;
  if (loop < minLoop) return false;
  return spawnPool(run).includes(kind);
}
function filterModifierEnemyPool(run, requested, fallback = ['grunt','runner']) {
  const seen = new Set();
  const out = [];
  for (const k of requested || []) {
    if (seen.has(k)) continue;
    if (enemyAllowedForModifier(run, k)) { out.push(k); seen.add(k); }
  }
  if (out.length) return out;
  for (const k of fallback) if (enemyAllowedForModifier(run, k) && !seen.has(k)) { out.push(k); seen.add(k); }
  return out.length ? out : ['grunt'];
}
function modifierEnemyKind(run, requested, fallback = ['grunt','runner']) {
  const pool = filterModifierEnemyPool(run, requested, fallback);
  return pool[Math.floor(Math.random() * pool.length)] || 'grunt';
}


// ---------------------------------------------------------------- director v1: encounter packs, wave cadence, room intent
const ENCOUNTER_PACKS = [
  {
    id: 'warm_swarm', label: 'SWARM PACK', intent: 'swarm', minDepth: 0, weight: 4.8, minGap: 4.2, maxGap: 6.6,
    roles: [
      { pick: ['grunt'], count: [2, 4], opts: { noArmor: true } },
      { pick: ['runner'], count: [1, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'ranged_line', label: 'RANGED LINE', intent: 'ranged', minDepth: 1, weight: 3.2, minGap: 5.2, maxGap: 7.4,
    roles: [
      { pick: ['shooter'], count: [1, 2] },
      { pick: ['grunt','runner'], count: [2, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'damper_nest', label: 'DAMPER NEST', intent: 'control', minLoop: 2, weight: 2.3, minGap: 7.2, maxGap: 10.4, supportCap: 4,
    roles: [
      { pick: ['damper'], count: [1, 1], opts: { noArmor: true } },
      { pick: ['shooter','prism','pulse'], count: [1, 3] },
      { pick: ['grunt','runner','tank'], count: [2, 3] }
    ]
  },
  {
    id: 'pinball_panic', label: 'PINBALL PANIC', intent: 'chaos', minLoop: 1, weight: 2.0, minGap: 5.8, maxGap: 8.2,
    roles: [
      { pick: ['bouncer'], count: [1, 2] },
      { pick: ['runner','bomber','glitch'], count: [2, 4] }
    ]
  },
  {
    id: 'splitter_swarm', label: 'SPLITTER SWARM', intent: 'swarm', minLoop: 1, weight: 2.4, minGap: 5.4, maxGap: 7.7,
    roles: [
      { pick: ['splitter'], count: [1, 2] },
      { pick: ['runner','grunt','glitch'], count: [2, 4], opts: { noArmor: true } }
    ]
  },
  {
    id: 'anchor_battery', label: 'ANCHOR BATTERY', intent: 'control', minLoop: 2, weight: 2.1, minGap: 7.0, maxGap: 10.0, supportCap: 3,
    roles: [
      { pick: ['anchor'], count: [1, 1], opts: { forcePlain: true } },
      { pick: ['shooter','prism','pulse'], count: [1, 3] },
      { pick: ['grunt','runner','tank'], count: [2, 4] }
    ]
  },
  {
    id: 'leech_wall', label: 'LEECH WALL', intent: 'support', minLoop: 2, weight: 2.0, minGap: 7.2, maxGap: 10.5, supportCap: 4,
    roles: [
      { pick: ['leech'], count: [1, 1], opts: { noArmor: true } },
      { pick: ['tank','charger','bouncer'], count: [1, 2], opts: { forcePlain: true } },
      { pick: ['grunt','runner'], count: [2, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'armor_link_pack', label: 'ARMOR LINK PACK', intent: 'armor', minLoop: 1, weight: 2.4, minGap: 7.0, maxGap: 10.0, armorCap: 3,
    roles: [
      { pick: ['tank','charger','shooter','splitter','warden'], count: [1, 1], opts: { forceLinked: true } },
      { pick: ['grunt','runner','echo','splitter'], count: [2, 3], opts: { noArmor: true } },
      { pick: ['runner','glitch'], count: [0, 2], opts: { noArmor: true } }
    ]
  },
  {
    id: 'prism_crossfire', label: 'PRISM CROSSFIRE', intent: 'ranged', minLoop: 3, weight: 1.8, minGap: 7.2, maxGap: 10.2, supportCap: 4,
    roles: [
      { pick: ['prism','pulse'], count: [1, 2] },
      { pick: ['orbiter','shooter','damper'], count: [1, 2] },
      { pick: ['grunt','runner'], count: [2, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'herald_damper_choir', label: 'HERALD DAMPER CHOIR', intent: 'director', minLoop: 3, weight: 2.5, minGap: 9.0, maxGap: 13.4, supportCap: 6,
    formation: 'herald_damper_rotary', note: 'DMP protects HRD while SHT/PRS/PLS rotate as a firing choir.',
    roles: [
      { pick: ['damper'], count: [1, 1], opts: { noArmor: true, packRole: 'nest_core' } },
      { pick: ['herald'], count: [1, 1], opts: { forcePlain: true, packRole: 'summon_core' } },
      { pick: ['shooter','prism','pulse'], count: [2, 3], opts: { noArmor: true, packRole: 'rotary_guard' } },
      { pick: ['runner','glitch'], count: [1, 2], opts: { noArmor: true, packRole: 'screen' } }
    ]
  },
  {
    id: 'anchor_prism_cage', label: 'ANCHOR PRISM CAGE', intent: 'control', minLoop: 3, weight: 2.0, minGap: 8.0, maxGap: 11.2, supportCap: 5,
    note: 'ANC pulls the player into PRS/PLS lanes while CHG/BNC breaks escapes.',
    roles: [
      { pick: ['anchor'], count: [1, 1], opts: { forcePlain: true, packRole: 'control_core' } },
      { pick: ['prism','pulse'], count: [2, 3], opts: { noArmor: true, packRole: 'lane_guard' } },
      { pick: ['charger','bouncer'], count: [1, 2] }
    ]
  },
  {
    id: 'warden_battery_wall', label: 'WARDEN BATTERY WALL', intent: 'armor', minLoop: 2, weight: 1.8, minGap: 8.4, maxGap: 12.0, supportCap: 4, armorCap: 5,
    note: 'WRD coordinates shell carriers; GRT/RUN are readable batteries, LCH can sustain the wall.',
    roles: [
      { pick: ['warden'], count: [1, 1], opts: { forcePlain: true, packRole: 'armor_core' } },
      { pick: ['tank','charger','bouncer'], count: [1, 2], opts: { forceLinked: true, packRole: 'shell_carrier' } },
      { pick: ['grunt','runner'], count: [2, 4], opts: { noArmor: true, packRole: 'battery' } },
      { pick: ['leech'], count: [0, 1], opts: { noArmor: true, packRole: 'sustain' } }
    ]
  },
  {
    id: 'leech_bruiser_wall', label: 'LEECH BRUISER WALL', intent: 'support', minLoop: 2, weight: 1.7, minGap: 7.6, maxGap: 10.8, supportCap: 4,
    note: 'LCH keeps TNK/CHG/BNC alive while SHT/PLS forces ranged pressure.',
    roles: [
      { pick: ['leech'], count: [1, 1], opts: { noArmor: true, packRole: 'sustain_core' } },
      { pick: ['tank','charger','bouncer'], count: [2, 3], opts: { forcePlain: true, packRole: 'front_wall' } },
      { pick: ['shooter','pulse'], count: [1, 2], opts: { noArmor: true, packRole: 'backline' } }
    ]
  },
  {
    id: 'splitter_herald_flood', label: 'SPLITTER HERALD FLOOD', intent: 'director', minLoop: 3, weight: 1.5, minGap: 8.6, maxGap: 12.4, supportCap: 4,
    note: 'HRD starts delayed back-spawns while SPL seeds turn the front into a messy flood.',
    roles: [
      { pick: ['herald'], count: [1, 1], opts: { noArmor: true, packRole: 'summon_core' } },
      { pick: ['splitter'], count: [1, 2], opts: { noArmor: true, packRole: 'swarm_seed' } },
      { pick: ['runner','grunt','glitch'], count: [2, 4], opts: { noArmor: true, packRole: 'flood' } }
    ]
  },
  {
    id: 'echo_glitch_scramble', label: 'ECHO GLITCH SCRAMBLE', intent: 'mirror', minLoop: 2, weight: 1.6, minGap: 6.6, maxGap: 9.2,
    note: 'ECH mirror shots and GLT blinks break the player\'s stable kiting path.',
    roles: [
      { pick: ['echo'], count: [1, 2], opts: { noArmor: true, packRole: 'mirror_core' } },
      { pick: ['glitch'], count: [1, 2], opts: { noArmor: true, packRole: 'disruptor' } },
      { pick: ['bouncer','runner','shooter'], count: [1, 3], opts: { noArmor: true, packRole: 'noise' } }
    ]
  },
  {
    id: 'herald_event', label: 'HERALD SIGNAL', intent: 'director', minLoop: 3, weight: 1.3, minGap: 8.5, maxGap: 12.5, supportCap: 3,
    roles: [
      { pick: ['herald'], count: [1, 1], opts: { forceLinked: true } },
      { pick: ['runner','glitch','bouncer'], count: [3, 5], opts: { noArmor: true } },
      { pick: ['prism','pulse'], count: [0, 1] }
    ]
  },
  {
    id: 'prism_grid_cage', label: 'PRISM GRID CAGE', intent: 'ranged', minLoop: 1, weight: 2.2, requireMod: 'prism_grid', minGap: 6.8, maxGap: 9.4, supportCap: 5,
    note: 'Room lanes plus PRS/PLS force route reading instead of circular kiting.',
    roles: [
      { pick: ['prism','pulse'], count: [1, 2], opts: { noArmor: true, packRole: 'lane_core' } },
      { pick: ['shooter','orbiter'], count: [1, 2], opts: { noArmor: true, packRole: 'lane_guard' } },
      { pick: ['charger','runner'], count: [1, 3], opts: { noArmor: true, packRole: 'displacer' } }
    ]
  },
  {
    id: 'blood_tax_panic', label: 'BLOOD TAX PANIC', intent: 'chaos', minLoop: 1, weight: 2.0, requireMod: 'blood_tax', minGap: 5.8, maxGap: 8.2,
    note: 'Extra GLD appears in dangerous death zones; fast mobs make greed timing matter.',
    roles: [
      { pick: ['bomber','bouncer'], count: [1, 2], opts: { noArmor: true, packRole: 'tax_core' } },
      { pick: ['runner','glitch','grunt'], count: [3, 5], opts: { noArmor: true, packRole: 'pressure' } }
    ]
  },

  {
    id: 'echo_wall_scramble', label: 'ECHO SHOT SCRAMBLE', intent: 'mirror', minLoop: 2, weight: 2.1, requireMod: 'echo_walls', minGap: 6.4, maxGap: 9.0,
    note: 'Extra echo pressure makes ECH/GLT packs feel like broken tape playback.',
    roles: [
      { pick: ['echo'], count: [1, 2], opts: { noArmor: true, packRole: 'tape_core' } },
      { pick: ['glitch','bouncer'], count: [1, 2], opts: { noArmor: true, packRole: 'scramble' } },
      { pick: ['shooter','runner'], count: [1, 3], opts: { noArmor: true, packRole: 'noise' } }
    ]
  },
  {
    id: 'anchor_gravity_cage_removed', label: 'ANCHOR GRAVITY CAGE', intent: 'control', minLoop: 99, weight: 0, requireMod: 'anchor_gravity', minGap: 7.4, maxGap: 10.8, supportCap: 5,
    note: 'Gravity sockets bend routes while ANC/PRS/PLS punish bad positioning.',
    roles: [
      { pick: ['anchor'], count: [1, 1], opts: { forcePlain: true, packRole: 'gravity_core' } },
      { pick: ['prism','pulse','shooter'], count: [1, 3], opts: { noArmor: true, packRole: 'socket_guard' } },
      { pick: ['charger','bouncer'], count: [1, 2], opts: { packRole: 'push' } }
    ]
  },


  {
    id: 'casino_chaos', label: 'CASINO CHAOS', intent: 'chaos', minLoop: 1, weight: 1.0, requireMod: 'casino_virus', minGap: 5.6, maxGap: 8.2,
    roles: [
      { pick: ['bouncer','glitch','bomber'], count: [2, 4] },
      { pick: ['runner','splitter'], count: [2, 4], opts: { noArmor: true } }
    ]
  },
  {
    id: 'moving_wall_pressure', label: 'SHIFTING WALL PRESSURE', intent: 'control', minLoop: 1, weight: 1.7, requireMod: 'moving_room', minGap: 6.2, maxGap: 8.8,
    roles: [
      { pick: ['echo'], count: [1, 2], opts: { noArmor: true } },
      { pick: ['shooter','glitch','runner'], count: [2, 4], opts: { noArmor: true } }
    ]
  }
];

const DIRECTOR_MODES = [
  { id: 'swarm_route', label: 'SWARM ROUTE', weight: 3.0, intents: { swarm: 1.8, chaos: 1.2 } },
  { id: 'crossfire', label: 'CROSSFIRE ROOM', weight: 2.0, minDepth: 1, intents: { ranged: 1.8, control: 1.1 } },
  { id: 'armor_puzzle', label: 'ARMOR PUZZLE', weight: 1.7, minLoop: 1, intents: { armor: 2.0, support: 1.2 } },
  { id: 'control_zone', label: 'CONTROL ZONE', weight: 1.6, minLoop: 2, intents: { control: 2.0, ranged: 1.2 } },
  { id: 'support_wall', label: 'SUPPORT WALL', weight: 1.4, minLoop: 2, intents: { support: 2.0, armor: 1.2 } },
  { id: 'nest_siege', label: 'NEST SIEGE', weight: 1.3, minLoop: 3, intents: { director: 2.0, control: 1.6, ranged: 1.2 } },
  { id: 'signal_chaos', label: 'SIGNAL CHAOS', weight: 1.2, minLoop: 3, intents: { chaos: 1.8, director: 1.4, mirror: 1.2 } }
];
function createDirectorState(run) {
  const mode = pickDirectorMode(run);
  return {
    mode: mode.id,
    label: mode.label,
    intents: mode.intents || {},
    waveIndex: 0,
    lastPack: '',
    lastIntent: '',
    lastCrowdForm: '',
    lastCrowdCombo: '',
    pauseT: run.plan.category === 'boss' ? 1.4 : 1.2,
    used: {}
  };
}
function pickDirectorMode(run) {
  const df = difficulty(run);
  const mods = run.plan?.modifierIds || [];
  const special = run.plan?.specialRoomId || '';
  if (mods.includes('hunter_contract')) return { id: 'hunter', label: 'HUNTER EVENT', intents: { director: 2.2, swarm: 1.2, ranged: 1.1 } };
  if (mods.includes('casino_virus')) return { id: 'casino', label: 'CASINO VIRUS ROOM', intents: { chaos: 2.4, swarm: 1.3 } };
  if (mods.includes('prism_grid')) return { id: 'prism_grid', label: 'PRISM GRID', intents: { ranged: 2.1, control: 1.6 } };
  if (mods.includes('blood_tax')) return { id: 'blood_tax', label: 'BLOOD TAX', intents: { chaos: 1.8, swarm: 1.5, support: 1.1 } };
  if (mods.includes('echo_walls')) return { id: 'echo_walls', label: 'ECHO SHOTS', intents: { mirror: 2.2, ranged: 1.2 } };
  if (mods.includes('moving_room')) return { id: 'moving_room', label: 'SHIFTING ZONES', intents: { control: 2.0, swarm: 1.1, chaos: 1.1 } };
  if (special === 'reward_pocket') return { id: 'greed_pocket', label: 'GREED POCKET', intents: { swarm: 1.3, armor: 1.2, chaos: 1.1 } };
  if (special === 'signal_contract') return { id: 'contract', label: 'SIGNAL CONTRACT', intents: { control: 1.3, support: 1.3, armor: 1.3, chaos: 1.3 } };
  const candidates = DIRECTOR_MODES.filter(m => (m.minLoop ?? 0) <= df.loop && (m.minDepth ?? 0) <= run.runDepth);
  return weightedPick(candidates, m => m.weight || 1) || DIRECTOR_MODES[0];
}
function weightedPick(arr, weightFn) {
  let total = 0;
  for (const x of arr) total += Math.max(0, weightFn(x));
  if (total <= 0) return arr[0] || null;
  let r = Math.random() * total;
  for (const x of arr) {
    r -= Math.max(0, weightFn(x));
    if (r <= 0) return x;
  }
  return arr[arr.length - 1] || null;
}
function countLive(run, pred) { let n = 0; for (const e of run.enemies) if (pred(e)) n++; return n; }
function packEligible(run, pack) {
  const df = difficulty(run);
  if ((pack.minLoop ?? 0) > df.loop || (pack.minDepth ?? 0) > run.runDepth) return false;
  if (pack.requireMod && !(run.plan?.modifierIds || []).includes(pack.requireMod)) return false;
  if (pack.intent === 'director' && countLive(run, e => e.kind === 'herald') > 0) return false;
  if (pack.supportCap && countLive(run, e => ['anchor','leech','herald','orbiter','prism','pulse','damper'].includes(e.kind)) >= pack.supportCap) return false;
  if (pack.armorCap && countLive(run, e => (e.shellHp || 0) > 0) >= pack.armorCap) return false;
  return true;
}
function archetypeIntentMul(archetype, intent) {
  const table = {
    panic_box: { swarm: 1.35, chaos: 1.28, support: 0.82, ranged: 0.74, director: 0.74 },
    compact: { swarm: 1.16, chaos: 1.16, armor: 1.08, ranged: 0.92 },
    standard: {},
    wide: { ranged: 1.28, control: 1.20, director: 1.12, swarm: 0.86, chaos: 0.92 },
    long_lane: { ranged: 1.30, control: 1.25, chaos: 1.08, support: 0.88, swarm: 0.88 },
    lounge: { chaos: 0.45, swarm: 0.45, ranged: 0.45, armor: 0.45, support: 0.45, control: 0.45, director: 0.45 },
    boss: { director: 1.2, ranged: 1.05, swarm: 0.92 }
  };
  return table[archetype]?.[intent] || 1;
}
function modPackFitMul(run, pack) {
  const mods = run.plan?.modifierIds || [];
  let m = 1;
  if (mods.includes('prism_grid') && ['ranged','control'].includes(pack.intent)) m *= 1.22;
  if (mods.includes('blood_tax') && ['swarm','chaos'].includes(pack.intent)) m *= 1.18;
  if (mods.includes('echo_walls') && ['mirror','ranged'].includes(pack.intent)) m *= 1.22;
  if (mods.includes('moving_room') && ['control','swarm','chaos'].includes(pack.intent)) m *= 1.18;
  return m;
}
function choosePack(run) {
  const dir = run.director || createDirectorState(run);
  const candidates = ENCOUNTER_PACKS.filter(p => packEligible(run, p));
  const pool = spawnPool(run);
  const modeIntents = dir.intents || {};
  return weightedPick(candidates, p => {
    let w = p.weight || 1;
    w *= modeIntents[p.intent] || 1;
    w *= archetypeIntentMul(run.plan?.roomArchetype || 'standard', p.intent);
    w *= modPackFitMul(run, p);
    if (p.id === dir.lastPack) w *= 0.22;
    if (p.intent === dir.lastIntent) w *= 0.60;
    // If the room is already crowded, favor tiny/simple packs and avoid support/armor escalation.
    const df = difficulty(run);
    const fullness = run.enemies.length / Math.max(1, df.maxActive);
    if (fullness > 0.62 && ['armor','support','director','control'].includes(p.intent)) w *= 0.45;
    if (p.roles.some(r => r.pick.some(k => pool.includes(k)))) w *= 1.1;
    return w;
  }) || ENCOUNTER_PACKS[0];
}
function chooseKindFrom(candidates, pool) {
  const allowed = candidates.filter(k => pool.includes(k) && ENEMIES[k]);
  const src = allowed.length ? allowed : candidates.filter(k => ENEMIES[k]);
  return src[Math.floor(Math.random() * src.length)] || 'grunt';
}
function roleCount(role, run) {
  const [a, b] = role.count || [1, 1];
  let n = a + Math.floor(Math.random() * (b - a + 1));
  const df = difficulty(run);
  if (df.late > 0 && Math.random() < Math.min(0.45, df.late * 0.10)) n += 1;
  return Math.max(0, n);
}
function spawnClusterPoint(run, players) {
  return enemySpawnPoint(mulberry32((Math.random() * 1e9) >>> 0), run.plan.walls, [...players.values()].filter(pl => pl.alive));
}


// ---------------------------------------------------------------- crowd forms v2.1.3
// Enemy packs still use the old encounter roles, but their spawn geometry now has a readable shape.
// These names are internal director grammar only; no form labels are sent to normal combat UI.
const CROWD_FORM_WEIGHTS_BY_ARCHETYPE = {
  panic_box: { ring: 30, fan: 26, cloud: 24, pinch: 16, stream: 10, wall: 3, lane: 2, nest: 1 },
  compact: { ring: 26, pinch: 24, nest: 18, fan: 17, cloud: 15, stream: 9, wall: 6, lane: 3 },
  standard: { wall: 20, fan: 19, pinch: 19, stream: 18, cloud: 14, ring: 10, nest: 9, lane: 7 },
  wide: { lane: 28, wall: 24, nest: 22, stream: 16, fan: 10, pinch: 9, ring: 5, cloud: 5 },
  long_lane: { wall: 34, lane: 30, stream: 20, pinch: 16, fan: 8, nest: 7, ring: 3, cloud: 3 },
  lounge: { cloud: 12, fan: 8, ring: 5, wall: 4, stream: 4, pinch: 3, lane: 2, nest: 2 },
  boss: { ring: 22, stream: 20, fan: 18, lane: 16, wall: 10, pinch: 8, cloud: 5, nest: 4 }
};
const CROWD_FORM_COMBOS = {
  wall: ['lane','stream','pinch'],
  fan: ['stream','ring','pinch'],
  ring: ['nest','lane','cloud'],
  nest: ['ring','stream','wall'],
  lane: ['wall','ring','pinch'],
  stream: ['fan','wall','nest'],
  pinch: ['wall','stream','lane'],
  cloud: ['fan','ring','stream']
};
function playerCentroid(players) {
  const alive = [...players.values()].filter(p => p?.alive);
  if (!alive.length) return { x: 1100, y: 750 };
  let x = 0, y = 0;
  for (const p of alive) { x += p.x || 1100; y += p.y || 750; }
  return { x: x / alive.length, y: y / alive.length };
}
function weightedPickKey(weights) {
  let total = 0;
  for (const k of Object.keys(weights || {})) total += Math.max(0, weights[k] || 0);
  if (total <= 0) return 'cloud';
  let r = Math.random() * total;
  for (const k of Object.keys(weights)) {
    r -= Math.max(0, weights[k] || 0);
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0] || 'cloud';
}
function addFormWeight(weights, key, value) {
  weights[key] = Math.max(0, (weights[key] || 0) + value);
}
function chooseCrowdForm(run, pack, opts = {}) {
  const df = difficulty(run);
  const arch = run.plan?.roomArchetype || 'standard';
  const mods = run.plan?.modifierIds || [];
  const weights = { ...(CROWD_FORM_WEIGHTS_BY_ARCHETYPE[arch] || CROWD_FORM_WEIGHTS_BY_ARCHETYPE.standard) };
  const intent = pack?.intent || '';

  if (intent === 'swarm') { addFormWeight(weights, 'stream', 12); addFormWeight(weights, 'cloud', 10); addFormWeight(weights, 'fan', 8); addFormWeight(weights, 'ring', 5); }
  if (intent === 'chaos') { addFormWeight(weights, 'cloud', 14); addFormWeight(weights, 'fan', 10); addFormWeight(weights, 'pinch', 6); }
  if (intent === 'ranged') { addFormWeight(weights, 'lane', 13); addFormWeight(weights, 'wall', 11); addFormWeight(weights, 'pinch', 4); }
  if (intent === 'control') { addFormWeight(weights, 'nest', 12); addFormWeight(weights, 'lane', 9); addFormWeight(weights, 'ring', 7); }
  if (intent === 'armor' || intent === 'support') { addFormWeight(weights, 'wall', 11); addFormWeight(weights, 'nest', 8); addFormWeight(weights, 'pinch', 5); }
  if (intent === 'director') { addFormWeight(weights, 'nest', 15); addFormWeight(weights, 'stream', 7); addFormWeight(weights, 'wall', 5); }
  if (intent === 'mirror') { addFormWeight(weights, 'ring', 10); addFormWeight(weights, 'fan', 7); addFormWeight(weights, 'pinch', 6); }

  if (mods.includes('blackout')) { addFormWeight(weights, 'ring', 12); addFormWeight(weights, 'pinch', 9); addFormWeight(weights, 'cloud', 7); }
  if (mods.includes('static_rain')) { addFormWeight(weights, 'stream', 12); addFormWeight(weights, 'pinch', 8); addFormWeight(weights, 'wall', 6); }
  if (mods.includes('greed')) { addFormWeight(weights, 'cloud', 11); addFormWeight(weights, 'fan', 9); addFormWeight(weights, 'stream', 6); }
  if (mods.includes('hunter_contract')) { addFormWeight(weights, 'stream', 18); addFormWeight(weights, 'fan', 10); addFormWeight(weights, 'pinch', 8); }
  if (mods.includes('casino_virus')) { addFormWeight(weights, 'cloud', 16); addFormWeight(weights, 'fan', 10); addFormWeight(weights, 'ring', 7); }
  if (mods.includes('moving_room')) { addFormWeight(weights, 'wall', 12); addFormWeight(weights, 'pinch', 10); addFormWeight(weights, 'lane', 8); }
  if (mods.includes('prism_grid')) { addFormWeight(weights, 'lane', 18); addFormWeight(weights, 'wall', 12); addFormWeight(weights, 'pinch', 7); }
  if (mods.includes('blood_tax')) { addFormWeight(weights, 'cloud', 13); addFormWeight(weights, 'fan', 8); addFormWeight(weights, 'stream', 8); }
  if (mods.includes('echo_walls')) { addFormWeight(weights, 'fan', 10); addFormWeight(weights, 'pinch', 8); addFormWeight(weights, 'lane', 6); }
  if (mods.includes('skin_cache')) { addFormWeight(weights, 'nest', 16); addFormWeight(weights, 'wall', 7); addFormWeight(weights, 'ring', 7); }

  if (pack?.crowdForm) addFormWeight(weights, pack.crowdForm, 999);
  if (run.director?.lastCrowdForm && weights[run.director.lastCrowdForm]) weights[run.director.lastCrowdForm] *= 0.38;

  let primary = weightedPickKey(weights);
  let secondary = '';
  const secondaryChance = opts.forceSecondary ? 1 : (df.loop < 2 ? 0 : Math.min(0.70, 0.16 + (df.loop - 2) * 0.11 + df.late * 0.08));
  if (!pack?.crowdForm && (opts.allowSecondary ?? true) && Math.random() < secondaryChance) {
    const comboWeights = {};
    for (const f of CROWD_FORM_COMBOS[primary] || []) comboWeights[f] = (weights[f] || 1) + 10;
    secondary = weightedPickKey(comboWeights);
    if (secondary === primary) secondary = '';
  }
  return { primary, secondary };
}
function preferredCrowdSide(run, focus, form) {
  const arch = run.plan?.roomArchetype || 'standard';
  const dirs = arch === 'long_lane'
    ? [{ x: -1, y: 0 }, { x: 1, y: 0 }]
    : [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }];
  const rr = playableRectForArchetype(arch);
  const cx = (rr.x + rr.right) / 2, cy = (rr.y + rr.bottom) / 2;
  let weights = dirs.map(d => 1);
  // Prefer the side opposite the player's current drift from room center, so waves enter from visible edges.
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const dot = (focus.x - cx) * d.x + (focus.y - cy) * d.y;
    if (dot < 0) weights[i] += 0.7;
    if (form === 'pinch' || form === 'ring') weights[i] += 0.25;
  }
  let total = weights.reduce((a, b) => a + b, 0), r = Math.random() * total;
  for (let i = 0; i < dirs.length; i++) { r -= weights[i]; if (r <= 0) return dirs[i]; }
  return dirs[0];
}
function safeCrowdSpawnPos(run, raw, fallback) {
  const rr = playableRectForArchetype(run.plan?.roomArchetype || 'standard');
  const margin = 72;
  const fx = fallback?.x ?? (rr.x + rr.right) / 2;
  const fy = fallback?.y ?? (rr.y + rr.bottom) / 2;
  const clampPos = (x, y) => ({ x: clamp(x, rr.x + margin, rr.right - margin), y: clamp(y, rr.y + margin, rr.bottom - margin) });
  let p = clampPos(raw.x, raw.y);
  let c = collideWalls(p.x, p.y, 34, run.plan.walls || [], fx, fy);
  c = clampPos(c.x, c.y);
  if (wallPenalty(c.x, c.y, 34, run.plan.walls || []) <= 0) return c;
  const tries = [54, 96, 145, 210, 285];
  for (const rad of tries) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.18;
      p = clampPos(raw.x + Math.cos(a) * rad, raw.y + Math.sin(a) * rad);
      c = collideWalls(p.x, p.y, 34, run.plan.walls || [], fx, fy);
      c = clampPos(c.x, c.y);
      if (wallPenalty(c.x, c.y, 34, run.plan.walls || []) <= 0) return c;
    }
  }
  return enemySpawnPoint(mulberry32((Math.random() * 1e9) >>> 0), run.plan.walls, []);
}
function createCrowdLayout(run, players, pack, count, opts = {}) {
  const picked = chooseCrowdForm(run, pack, opts);
  const focus = playerCentroid(players);
  const rr = playableRectForArchetype(run.plan?.roomArchetype || 'standard');
  const w = rr.right - rr.x, h = rr.bottom - rr.y;
  const primary = picked.primary || 'cloud';
  const secondary = picked.secondary || '';
  const side = preferredCrowdSide(run, focus, primary);
  const side2 = { x: -side.x, y: -side.y };
  const perp = { x: -side.y, y: side.x };
  const baseDist = clamp(Math.min(w, h) * 0.38 + 170 + Math.random() * 90, 330, 680);
  const nestDir = rotateVec(side, (Math.random() - 0.5) * 0.9);
  const nestRaw = { x: focus.x + nestDir.x * clamp(baseDist * 0.88, 280, 560), y: focus.y + nestDir.y * clamp(baseDist * 0.88, 280, 560) };
  const nestCenter = safeCrowdSpawnPos(run, nestRaw, focus);
  return {
    primary, secondary, focus, side, side2, perp, baseDist, nestCenter,
    center: safeCrowdSpawnPos(run, { x: focus.x + side.x * baseDist, y: focus.y + side.y * baseDist }, focus),
    seed: Math.random() * Math.PI * 2,
    count: Math.max(1, count || 1)
  };
}
function selectCrowdFormForIndex(layout, idx, plannedItem) {
  const role = plannedItem?.opts?.packRole || '';
  if (role.includes('core') || role.includes('sustain') || role.includes('summon')) return layout.primary === 'nest' || layout.secondary === 'nest' ? 'nest' : layout.primary;
  if (!layout.secondary) return layout.primary;
  // Combined forms: most bodies express the primary shape, every third / backline body expresses the secondary layer.
  if (role.includes('backline') || role.includes('guard') || role.includes('lane')) return layout.secondary;
  return (idx % 3 === 2) ? layout.secondary : layout.primary;
}
function crowdSpawnPos(run, players, layout, idx, total, plannedItem) {
  const form = selectCrowdFormForIndex(layout, idx, plannedItem);
  const focus = layout.focus || playerCentroid(players);
  const side = form === layout.secondary ? layout.side2 : layout.side;
  const perp = { x: -side.y, y: side.x };
  const n = Math.max(1, total || 1);
  const k = idx - (n - 1) / 2;
  const row = Math.floor(idx / 5);
  const jitter = () => (Math.random() - 0.5);
  let raw;

  if (form === 'wall') {
    const spacing = 64;
    raw = { x: focus.x + side.x * (layout.baseDist + row * 42) + perp.x * k * spacing, y: focus.y + side.y * (layout.baseDist + row * 42) + perp.y * k * spacing };
  } else if (form === 'fan') {
    const spread = clamp(0.22 + n * 0.035, 0.35, 0.82);
    const t = n <= 1 ? 0 : (idx / (n - 1)) - 0.5;
    const dir = rotateVec(side, t * spread * 2);
    raw = { x: focus.x + dir.x * (layout.baseDist + row * 56), y: focus.y + dir.y * (layout.baseDist + row * 56) };
  } else if (form === 'ring') {
    const a = layout.seed + (idx / n) * Math.PI * 2 + row * 0.18;
    const r = clamp(layout.baseDist * 0.86 + (idx % 2) * 46, 300, 610);
    raw = { x: focus.x + Math.cos(a) * r, y: focus.y + Math.sin(a) * r };
  } else if (form === 'nest') {
    const role = plannedItem?.opts?.packRole || '';
    if (role.includes('core') || role.includes('sustain') || role.includes('summon')) raw = { ...layout.nestCenter };
    else {
      const a = layout.seed + idx * 2.399;
      const r = role.includes('guard') || role.includes('lane') ? 160 + (idx % 3) * 38 : 225 + (idx % 4) * 34;
      raw = { x: layout.nestCenter.x + Math.cos(a) * r, y: layout.nestCenter.y + Math.sin(a) * r };
    }
  } else if (form === 'lane') {
    const spacing = 82;
    const lane = (idx % 2 === 0 ? -1 : 1) * 70;
    raw = { x: focus.x + side.x * (layout.baseDist + row * 72) + perp.x * (k * spacing + lane), y: focus.y + side.y * (layout.baseDist + row * 72) + perp.y * (k * spacing + lane) };
  } else if (form === 'stream') {
    const lane = (idx % 3) - 1;
    const depth = Math.floor(idx / 3);
    raw = { x: focus.x + side.x * (layout.baseDist + depth * 92) + perp.x * lane * 58, y: focus.y + side.y * (layout.baseDist + depth * 92) + perp.y * lane * 58 };
  } else if (form === 'pinch') {
    const s = idx % 2 === 0 ? side : { x: -side.x, y: -side.y };
    const p = { x: -s.y, y: s.x };
    const lane = Math.floor(idx / 2) - Math.floor(n / 4);
    raw = { x: focus.x + s.x * (layout.baseDist + Math.floor(idx / 4) * 42) + p.x * lane * 78, y: focus.y + s.y * (layout.baseDist + Math.floor(idx / 4) * 42) + p.y * lane * 78 };
  } else { // cloud
    const a = layout.seed + idx * 2.11 + jitter() * 0.65;
    const r = clamp(layout.baseDist * (0.55 + Math.random() * 0.55), 230, 620);
    raw = { x: focus.x + Math.cos(a) * r, y: focus.y + Math.sin(a) * r };
  }

  // Anchor gravity should bend the crowd shapes toward sockets without pulling everything into a single heap.
  if (hasMod(run, 'anchor_gravity') && run.roomSockets?.length) {
    const so = run.roomSockets[Math.floor(Math.random() * run.roomSockets.length)];
    const bend = form === 'ring' || form === 'stream' || form === 'pinch' ? 0.22 : 0.14;
    raw.x = raw.x * (1 - bend) + (so.x || raw.x) * bend;
    raw.y = raw.y * (1 - bend) + (so.y || raw.y) * bend;
  }
  return safeCrowdSpawnPos(run, raw, focus);
}
function offsetSpawnPos(run, center, idx, total) {
  const a = (idx / Math.max(1, total)) * Math.PI * 2 + Math.random() * 0.55;
  const r = 55 + Math.random() * 170 + Math.floor(idx / 4) * 35;
  const x = center.x + Math.cos(a) * r;
  const y = center.y + Math.sin(a) * r;
  return collideWalls(x, y, 32, run.plan.walls, center.x, center.y);
}

function attachRotaryGuard(e, anchor, idx = 0, total = 1) {
  if (!e || !anchor) return;
  const sameAnchor = e.escortAnchorId === anchor.id;
  e.escortAnchorId = anchor.id;
  if (!sameAnchor || !Number.isFinite(e.escortPhase)) e.escortPhase = (idx / Math.max(1, total)) * Math.PI * 2 + Math.random() * 0.22;
  if (!sameAnchor || !Number.isFinite(e.escortSpin)) e.escortSpin = (idx % 2 === 0 ? 1 : -1) * (0.28 + Math.random() * 0.12);
  if (!sameAnchor || !Number.isFinite(e.escortR)) e.escortR = 175 + (idx % 3) * 42 + Math.floor(idx / 3) * 24;
  e.rallyT = Math.max(e.rallyT || 0, 0.55);
}
function applyPackFormation(run, pack, spawned) {
  if (!pack || !spawned?.length) return;
  for (const e of spawned) {
    if (e?.packRole) e.packRoleT = 3.0;
  }
  if (pack.formation === 'herald_damper_rotary') {
    const damper = spawned.find(e => e.kind === 'damper') || run.enemies.find(e => e.kind === 'damper' && e.hp > 0);
    const herald = spawned.find(e => e.kind === 'herald') || run.enemies.find(e => e.kind === 'herald' && e.hp > 0);
    const anchor = damper || herald;
    const guards = spawned.filter(e => ['shooter','prism','pulse'].includes(e.kind));
    guards.forEach((g, i) => attachRotaryGuard(g, anchor, i, guards.length));
    if (herald && damper) {
      herald.summonCd = Math.min(herald.summonCd || 9, 1.9);
      herald.preferredNestId = damper.id;
    }
    if (anchor) run.fx.push({ t: 'enemy_combo', label: 'HRD DMP CHOIR', x: Math.round(anchor.x), y: Math.round(anchor.y) });
  }
  if (pack.id === 'anchor_prism_cage') {
    const anchor = spawned.find(e => e.kind === 'anchor');
    if (anchor) {
      const lanes = spawned.filter(e => ['prism','pulse'].includes(e.kind));
      lanes.forEach((g, i) => attachRotaryGuard(g, anchor, i, lanes.length));
      run.fx.push({ t: 'enemy_combo', label: 'CAGE LANES', x: Math.round(anchor.x), y: Math.round(anchor.y) });
    }
  }
  if (pack.id === 'warden_battery_wall') {
    const w = spawned.find(e => e.kind === 'warden');
    if (w) run.fx.push({ t: 'enemy_combo', label: 'WRD BATTERY', x: Math.round(w.x), y: Math.round(w.y) });
  }
  if (pack.id === 'leech_bruiser_wall') {
    const l = spawned.find(e => e.kind === 'leech');
    if (l) run.fx.push({ t: 'enemy_combo', label: 'LCH WALL', x: Math.round(l.x), y: Math.round(l.y) });
  }
  if (pack.id === 'splitter_herald_flood') {
    const h = spawned.find(e => e.kind === 'herald') || spawned.find(e => e.kind === 'splitter');
    if (h) run.fx.push({ t: 'enemy_combo', label: 'FLOOD CALL', x: Math.round(h.x), y: Math.round(h.y) });
  }
  if (pack.id === 'echo_glitch_scramble') {
    const e = spawned.find(x => x.kind === 'echo') || spawned[0];
    if (e) run.fx.push({ t: 'enemy_combo', label: 'SCRAMBLE', x: Math.round(e.x), y: Math.round(e.y) });
  }
}
function escortOrbitMove(run, e, dt, spd, target) {
  if (!e.escortAnchorId) return false;
  const anchor = run.enemies.find(a => a.id === e.escortAnchorId && a.hp > 0);
  if (!anchor) { e.escortAnchorId = ''; return false; }
  e.escortPhase = (e.escortPhase || 0) + (e.escortSpin || 0.8) * dt;
  const r = e.escortR || 170;
  const desired = { x: anchor.x + Math.cos(e.escortPhase) * r, y: anchor.y + Math.sin(e.escortPhase) * r };
  const d = Math.hypot(desired.x - e.x, desired.y - e.y);
  if (d > 14) {
    const mv = norm(desired.x - e.x, desired.y - e.y);
    steerMove(run, e, mv, spd * 1.05, dt, { target: desired });
  }
  e.escortFxT = Math.max(0, (e.escortFxT || 0) - dt);
  if (e.escortFxT <= 0) {
    e.escortFxT = 1.2 + Math.random() * 0.7;
    run.fx.push({ t: 'enemy_combo', label: 'ROTARY GUARD', x: Math.round(e.x), y: Math.round(e.y) });
  }
  return true;
}

function spawnEncounterPack(run, players, pack, budgetLeft) {
  const pool = spawnPool(run);
  let planned = [];
  for (const role of pack.roles) {
    const n = roleCount(role, run);
    for (let i = 0; i < n; i++) planned.push({ kind: chooseKindFrom(role.pick, pool), opts: role.opts || {} });
  }
  const df = difficulty(run);
  const roomLeft = Math.max(0, df.maxActive - run.enemies.length);
  const count = Math.max(0, Math.min(planned.length, roomLeft, budgetLeft));
  if (!count) return 0;
  const layout = createCrowdLayout(run, players, pack, count);
  const center = layout.center || spawnClusterPoint(run, players);
  const spawnedEnemies = [];
  for (let i = 0; i < count; i++) {
    const pos = crowdSpawnPos(run, players, layout, i, count, planned[i]);
    const e = spawnEnemy(run, players, planned[i].kind, true, pos, planned[i].opts);
    spawnedEnemies.push(e);
  }
  applyPackFormation(run, pack, spawnedEnemies);
  run.fx.push({ t: 'director_wave', label: pack.label, intent: pack.intent, x: Math.round(center.x), y: Math.round(center.y), count });
  if (run.director) {
    run.director.waveIndex++;
    run.director.lastPack = pack.id;
    run.director.lastIntent = pack.intent;
    run.director.lastCrowdForm = layout.primary || '';
    run.director.lastCrowdCombo = layout.secondary ? `${layout.primary}+${layout.secondary}` : (layout.primary || '');
    run.director.used[pack.id] = (run.director.used[pack.id] || 0) + 1;
  }
  return count;
}
function nextWaveDelay(run, pack) {
  const df = difficulty(run);
  const greed = run.plan?.modifierIds?.includes('greed');
  const min = pack.minGap ?? 4.5;
  const max = pack.maxGap ?? 7.0;
  const base = min + Math.random() * Math.max(0.2, max - min);
  const pressure = Math.max(0.68, 1 - df.loop * 0.035 - df.late * 0.055);
  const crowded = run.enemies.length / Math.max(1, df.maxActive);
  const crowdPause = crowded > 0.58 ? 1.4 + crowded * 3.2 : 0;
  return Math.max(1.0, base * pressure / (greed ? 1.12 : 1) + crowdPause);
}

function directorTotalBudget(run) {
  // Small encounter target, not a mandatory full-room meat budget.
  // This keeps the old room feel while preventing one-pack instant clears.
  return roomDirectorTarget(run);
}
function directorCanStillSpawn(run) {
  if (!run || run.phase !== 'play' || run.portal?.open) return false;
  const plan = run.plan || {};
  if (plan.category === 'boss') return false;
  if ((plan.modifierIds || []).includes('hunter_contract')) return false;
  if ((plan.modifierIds || []).includes('casino_virus') && (run.casinoVirus?.spinsLeft || 0) <= 0) return false;
  return Math.max(0, run.spawned || 0) < directorTotalBudget(run);
}
function directorExhausted(run) {
  return !directorCanStillSpawn(run);
}


function heraldUpdateAimPoint(run, h, target, dt, reset = false) {
  if (!target) return { x: h.x, y: h.y, id: '', alive: false };
  if (reset || !Number.isFinite(h.heraldAimX) || !Number.isFinite(h.heraldAimY)) {
    h.heraldAimX = target.x;
    h.heraldAimY = target.y;
  } else {
    const dx = target.x - h.heraldAimX;
    const dy = target.y - h.heraldAimY;
    const d = Math.hypot(dx, dy);
    const maxStep = HERALD_PATH_FOLLOW_SPEED * Math.max(0, dt || 0);
    if (d <= maxStep || d < 0.001) {
      h.heraldAimX = target.x;
      h.heraldAimY = target.y;
    } else {
      h.heraldAimX += dx / d * maxStep;
      h.heraldAimY += dy / d * maxStep;
    }
  }
  h.heraldAimX = clamp(h.heraldAimX, WALL_T + 42, run.plan.w - WALL_T - 42);
  h.heraldAimY = clamp(h.heraldAimY, WALL_T + 42, run.plan.h - WALL_T - 42);
  return { x: h.heraldAimX, y: h.heraldAimY, id: target.id, alive: target.alive };
}

function heraldSummonPoint(run, h, target) {
  const away = norm(target.x - h.x, target.y - h.y);
  const baseDist = 230 + Math.random() * 80;
  const per = { x: -away.y, y: away.x };
  const tries = [0, -90, 90, -155, 155, -230, 230];
  for (const off of tries) {
    let x = target.x + away.x * baseDist + per.x * off;
    let y = target.y + away.y * baseDist + per.y * off;
    x = clamp(x, 70, Math.max(80, run.plan.w - 70));
    y = clamp(y, 70, Math.max(80, run.plan.h - 70));
    const c = collideWalls(x, y, 34, run.plan.walls || [], target.x, target.y);
    if (wallPenalty(c.x, c.y, 34, run.plan.walls || []) <= 0) return { x: c.x, y: c.y, dx: away.x, dy: away.y };
  }
  return { x: target.x + away.x * 180, y: target.y + away.y * 180, dx: away.x, dy: away.y };
}
function finishHeraldSummon(run, players, h, target) {
  if (!target?.alive || h.hp <= 0) return;
  const df = difficulty(run);
  if (run.enemies.length >= df.maxActive) return;
  const sp = heraldSummonPoint(run, h, target);
  const pool = filterModifierEnemyPool(run, ['grunt','runner','runner','glitch','bouncer','pulse'], ['grunt','runner']);
  const n = Math.min(6, 2 + Math.min(3, df.loop));
  const per = { x: -sp.dy, y: sp.dx };
  for (let i = 0; i < n && run.enemies.length < df.maxActive; i++) {
    const row = i - (n - 1) / 2;
    const ahead = 18 + Math.floor(i / 3) * 24;
    const pos = collideWalls(sp.x + per.x * row * 34 + sp.dx * ahead, sp.y + per.y * row * 34 + sp.dy * ahead, 24, run.plan.walls || [], sp.x, sp.y);
    const e = spawnEnemy(run, players, pool[Math.floor(Math.random() * pool.length)] || 'grunt', false, pos, { noArmor: true });
    e.rallyT = Math.max(e.rallyT || 0, 1.6);
    e.rallyTargetId = target.id;
  }
  run.fx.push({ t: 'summon', kind: 'herald', x: Math.round(sp.x), y: Math.round(sp.y), x2: Math.round(target.x), y2: Math.round(target.y), hx: Math.round(h.x), hy: Math.round(h.y), dx: Math.round(sp.dx * 100), dy: Math.round(sp.dy * 100), count: n });
}

function spawnEnemy(run, players, kind, canElite = true, pos = null, opts = {}) {
  const def = ENEMIES[kind] || ENEMIES.grunt;
  if (!ENEMIES[kind]) kind = 'grunt';
  const rng = Math.random;
  const p = pos || enemySpawnPoint(mulberry32((Math.random() * 1e9) >>> 0), run.plan.walls, [...players.values()].filter(pl => pl.alive));
  const df = difficulty(run);
  const elite = canElite && rng() < df.eliteChance;
  const hpMul = Math.max(0.42, df.hp) * (elite ? df.eliteHp : 1);
  const dmgMul = Math.max(0.40, df.dmg) * (elite ? df.eliteDmg : 1);
  const e = {
    id: nid(), kind, x: p.x, y: p.y,
    hp: Math.max(4, Math.round(def.hp * hpMul)),
    maxHp: Math.max(4, Math.round(def.hp * hpMul)),
    dmg: Math.max(1, Math.round(def.dmg * dmgMul)),
    size: Math.round(def.size * (elite ? 1.18 : 1)),
    spd: def.spd, elite,
    state: 'move', st: 0, // state timer
    vx: 0, vy: 0, fireCd: (def.fireCd || 0) * (0.75 + rng() * 0.75),
    dirX: 0, dirY: 0, aux: 0,
    spawnDelay: (opts.noSpawnWarn || def.boss || opts.packRole === 'hunter_chorus_fragment') ? 0 : 1.05
  };
  if (e.spawnDelay > 0) run.fx.push({ t: 'spawn_warning', x: Math.round(e.x), y: Math.round(e.y), r: Math.round((e.size || 24) + 44), delay: e.spawnDelay, kind });
  let shell = null;
  if (opts.noArmor) shell = null;
  else if (opts.forceLinked) shell = { type: 'linked', max: shellMaxForArmor(run, def, e, 'linked'), source: 'director' };
  else if (opts.forcePlain) shell = { type: 'plain', max: shellMaxForArmor(run, def, e, 'plain'), source: 'director' };
  else shell = rollShellArmor(run, kind, def, e, elite);
  if (shell && shell.max > 0) {
    e.shellType = shell.type;          // 'plain' = breakable by damage, 'linked' = unbreakable while battery-link is alive
    e.shellSource = shell.source;      // native / roll / boss, for debugging and future tuning
    e.shellMax = shell.max;
    e.shellHp = shell.max;
    e.shellFlashT = 0;
    e.shellRegenDelay = 0;
    if (shell.type === 'linked') e.armorLinkId = '';
  }
  if (kind === 'damper') { e.state = 'field'; e.dirX = 1; e.dirY = 0; e.fireCd = 0; }
  if (kind === 'bouncer') {
    const a = rng() * Math.PI * 2;
    e.vx = Math.cos(a) * def.spd; e.vy = Math.sin(a) * def.spd;
  }
  if (kind === 'splitter') e.splitStage = 0;
  if (kind === 'orbiter') e.phase = rng() * Math.PI * 2;
  if (kind === 'herald') e.summonCd = def.summonCd * (0.55 + rng() * 0.5);
  if (kind === 'leech') e.healCd = def.healCd * (0.6 + rng() * 0.6);
  if (kind === 'echo') { e.fireCd = echoMimicCooldown('shotgun', def, e) * (0.75 + rng() * 0.5); e.mimicWeapon = 'shotgun'; }
  if (def.boss) {
    const depthLevel = Math.max(0, Number(run?.runDepth || 0));
    const bossDepthMul = 1 + Math.min(0.85, depthLevel * 0.015 + Math.floor(depthLevel / 4) * 0.035);
    e.maxHp = Math.max(1, Math.round(e.maxHp * bossDepthMul));
    e.hp = e.maxHp;
    e.bossKind = kind;
    e.bossCastCd = (def.fireCd || 2.3) * (0.8 + rng() * 0.55);
    e.bossMarks = [];
    e.bossPhase = 0;
    if (kind === 'boss_q_revisor') {
      e.state = 'move';
      e.bossDashCd = 0.65 + rng() * 0.55;
      e.bossVolleyCd = 0.95 + rng() * 0.45;
    }
  }
  if (opts.packRole) e.packRole = opts.packRole;
  if (opts.escortAnchorId) e.escortAnchorId = opts.escortAnchorId;
  run.enemies.push(e);
  run.spawned++;
  return e;
}

const BOSS_ROTATION = ['boss_croupier', 'boss_anchor_cashier', 'boss_hunter_chorus', 'boss_q_revisor'];
function chooseBossKind(run) {
  if (isFinalBossRoom(run)) return 'boss_croupier';
  const idx = Math.max(0, Math.floor((run.runDepth || 0) / 4)) % BOSS_ROTATION.length;
  return BOSS_ROTATION[idx] || 'boss_croupier';
}
function isBossKind(kind) { return !!(ENEMIES[kind] && ENEMIES[kind].boss); }
function stepBossMarks(run, players, e, dt) {
  if (!Array.isArray(e.bossMarks)) e.bossMarks = [];
  for (const m of [...e.bossMarks]) {
    m.t -= dt;
    if (m.t > 0) continue;
    e.bossMarks = e.bossMarks.filter(x => x !== m);
    if (m.line) {
      run.fx.push({ t: 'active_line', kind: 'boss_line', x1: Math.round(m.x1), y1: Math.round(m.y1), x2: Math.round(m.x2), y2: Math.round(m.y2), width: m.w || 54, hitWidth: m.w || 54, tone: m.tone || 'red' });
      for (const p of players.values()) if (p.alive && distToSegment2(p.x, p.y, m.x1, m.y1, m.x2, m.y2) < ((m.w || 54) + PLAYER_SIZE / 2) ** 2) damagePlayer(run, p, m.dmg || 24, m.x2, m.y2);
    } else {
      run.fx.push({ t: 'rain_hit', x: Math.round(m.x), y: Math.round(m.y), r: m.r || 90, stacks: 1 });
      for (const p of players.values()) if (p.alive && dist2(p.x, p.y, m.x, m.y) < ((m.r || 90) + PLAYER_SIZE / 2) ** 2) damagePlayer(run, p, m.dmg || 20, m.x, m.y);
      if (m.adds && run.enemies.length < difficulty(run).addCap) {
        const pool = m.addPool || ['grunt', 'runner'];
        const count = Math.min(m.adds, Math.max(0, difficulty(run).addCap - run.enemies.length));
        for (let i = 0; i < count; i++) {
          const pos = offsetSpawnPos(run, { x: m.x, y: m.y }, i, count);
          spawnEnemy(run, players, pool[Math.floor(Math.random() * pool.length)] || 'grunt', false, pos, { noArmor: true });
        }
      }
    }
  }
}
function bossRadial(run, e, count, spd, dmg, size = 8, life = 3.0, spin = 0) {
  if (run.bullets.length > MAX_BULLETS - count - 2) return;
  const base = (run.now || 0) * 0.35 + spin;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * Math.PI * 2;
    run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, from: 'e', life, size });
  }
  run.fx.push({ t: 'boss_burst', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
}
function bossAimBurst(run, e, target, count, spread, spd, dmg, size = 7) {
  if (!target || run.bullets.length > MAX_BULLETS - count - 2) return;
  const base = Math.atan2(target.y - e.y, target.x - e.x);
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : i / (count - 1) - 0.5;
    const a = base + t * spread;
    run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, from: 'e', life: 2.8, size });
  }
  e.dirX = Math.cos(base); e.dirY = Math.sin(base);
}
function warnBossCircle(run, e, x, y, r, dmg, delay = 0.95, tone = 'red', extra = {}) {
  if (!Array.isArray(e.bossMarks)) e.bossMarks = [];
  e.bossMarks.push({ x, y, r, dmg, t: delay, ...extra });
  run.fx.push({ t: 'rain_warn', x: Math.round(x), y: Math.round(y), r, dur: delay, stacks: 1, tone });
}
function warnBossLine(run, e, x1, y1, x2, y2, w, dmg, delay = 0.65, tone = 'purple') {
  if (!Array.isArray(e.bossMarks)) e.bossMarks = [];
  e.bossMarks.push({ line: 1, x1, y1, x2, y2, w, dmg, t: delay, tone });
  run.fx.push({ t: 'active_line', kind: 'boss_warn', x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), width: w, hitWidth: w, tone });
}
function bossMoveKeep(run, e, target, toT, dT, spd, dt, keep = 460, sideMul = 0.18) {
  const mv = dT > keep + 80 ? 1 : dT < keep - 100 ? -0.75 : 0;
  const side = { x: -toT.y * sideMul, y: toT.x * sideMul };
  steerMove(run, e, { x: toT.x * mv + side.x, y: toT.y * mv + side.y }, spd, dt, { target });
}
function bossPullPlayers(run, players, e, r, pull, dt, slowMul = 0.62) {
  for (const p of players.values()) {
    if (!p.alive) continue;
    const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
    if (d < r) {
      p.slowT = 0.18; p.slowMul = Math.min(p.slowMul || 1, slowMul);
      const n = norm(e.x - p.x, e.y - p.y);
      const cc = collideWalls(p.x + n.x * pull * dt, p.y + n.y * pull * dt, PLAYER_SIZE / 2, run.plan.walls || [], p.x, p.y);
      p.x = cc.x; p.y = cc.y;
    }
  }
}
function chorusLiveBossFragments(run) {
  return (run?.enemies || []).filter(x => x && x.hp > 0 && ENEMIES[x.kind]?.bossFragment);
}
function spawnHunterChorusFragments(run, players, dead) {
  const kinds = ['boss_hunter_duelist', 'boss_hunter_marksman', 'boss_hunter_trapper'];
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < kinds.length && run.enemies.length < MAX_ENEMIES; i++) {
    const a = base + (i / kinds.length) * Math.PI * 2;
    const pos = {
      x: clamp(dead.x + Math.cos(a) * 115, 90, run.plan.w - 90),
      y: clamp(dead.y + Math.sin(a) * 115, 90, run.plan.h - 90)
    };
    const frag = spawnEnemy(run, players, kinds[i], false, pos, { noArmor: true, packRole: 'hunter_chorus_fragment' });
    frag.bossFragmentParent = dead.id;
    frag.bossCastCd = 0.75 + i * 0.18;
    frag.state = 'move';
    frag.dirX = Math.cos(a);
    frag.dirY = Math.sin(a);
  }
  run.fx.push({ t: 'split', x: Math.round(dead.x), y: Math.round(dead.y), boss: 1, kind: 'hunter_chorus' });
  run.fx.push({ t: 'summon', kind: 'hunter_chorus_split', x: Math.round(dead.x), y: Math.round(dead.y), count: kinds.length });
}
function stepCroupierBoss(run, players, e, def, target, toT, dT, spd, dt) {
  bossMoveKeep(run, e, target, toT, dT, spd, dt, 500, 0.22);
  e.bossCastCd -= dt;
  if (e.bossCastCd <= 0) {
    e.bossPhase = (e.bossPhase || 0) + 1;
    const loop = difficulty(run).loop;
    const dx = target.x - e.x, dy = target.y - e.y;
    const n = norm(dx, dy); const per = { x: -n.y, y: n.x };
    const stakeCount = 2 + (loop >= 2 ? 1 : 0);
    for (let i = 0; i < stakeCount; i++) {
      const row = i - (stakeCount - 1) / 2;
      const x = clamp(target.x + per.x * row * 130 + n.x * (80 + i * 24), 90, run.plan.w - 90);
      const y = clamp(target.y + per.y * row * 130 + n.y * (80 + i * 24), 90, run.plan.h - 90);
      const add = (e.bossPhase % 3 === 0 && i === stakeCount - 1) ? { adds: 2 + Math.min(2, loop), addPool: loop < 2 ? ['grunt','runner'] : ['grunt','runner','shooter','bouncer'] } : {};
      warnBossCircle(run, e, x, y, 72 + Math.min(28, loop * 7), enemyDamageValue(e, 0.78), 0.92, 'red', add);
    }
    bossAimBurst(run, e, target, 3 + Math.min(2, loop), 0.52, def.bulletSpd, enemyDamageValue(e, 0.52), 7);
    e.bossCastCd = Math.max(1.45, def.fireCd - Math.min(0.55, loop * 0.08));
  }
  touchDamage(run, e, players, dt);
}
function stepAnchorCashierBoss(run, players, e, def, target, toT, dT, spd, dt) {
  bossMoveKeep(run, e, target, toT, dT, spd, dt, 430, 0.10);
  const r = def.fieldR || 430;
  bossPullPlayers(run, players, e, r, def.pull || 190, dt, 0.58);
  for (const b of run.bullets) if (b.from === 'e' && dist2(b.x, b.y, e.x, e.y) < (r + b.size) ** 2) {
    const n = norm(e.x - b.x, e.y - b.y); b.vx += n.x * 70 * dt; b.vy += n.y * 70 * dt;
  }
  e.fxT = (e.fxT || 0) - dt;
  if (e.fxT <= 0) { e.fxT = 0.18; run.fx.push({ t: 'active_field', kind: 'anchor_boss', x: Math.round(e.x), y: Math.round(e.y), r, tone: 'purple' }); }
  e.bossCastCd -= dt;
  if (e.bossCastCd <= 0) {
    const loop = difficulty(run).loop;
    bossRadial(run, e, 8 + Math.min(6, loop * 2), def.bulletSpd || 215, enemyDamageValue(e, 0.50), 8, 3.0, e.bossPhase || 0);
    const x = clamp(target.x + (Math.random() - 0.5) * 180, 90, run.plan.w - 90);
    const y = clamp(target.y + (Math.random() - 0.5) * 180, 90, run.plan.h - 90);
    warnBossCircle(run, e, x, y, 105 + Math.min(34, loop * 8), enemyDamageValue(e, 0.82), 1.05, 'purple');
    e.bossPhase = (e.bossPhase || 0) + 0.6;
    e.bossCastCd = Math.max(1.75, def.fireCd - Math.min(0.55, loop * 0.09));
  }
  touchDamage(run, e, players, dt);
}
function stepHunterChorusBoss(run, players, e, def, target, toT, dT, spd, dt) {
  // The chorus is the shell phase: fewer adds, no unclear red beam lines.
  bossMoveKeep(run, e, target, toT, dT, spd, dt, 400, 0.34);
  e.bossCastCd -= dt;
  if (e.bossCastCd <= 0) {
    e.bossPhase = ((e.bossPhase || 0) + 1) % 3;
    const loop = difficulty(run).loop;
    if (e.bossPhase === 0) {
      bossAimBurst(run, e, target, 4 + Math.min(2, loop), 0.52, def.bulletSpd || 270, enemyDamageValue(e, 0.44), 6);
    } else if (e.bossPhase === 1) {
      bossRadial(run, e, 7 + Math.min(5, loop), Math.max(185, (def.bulletSpd || 270) * 0.76), enemyDamageValue(e, 0.34), 6, 2.45, e.bossPhase || 0);
    } else if (run.enemies.length < difficulty(run).addCap && liveEnemyCount(run) < 7 + Math.min(4, loop)) {
      const pool = loop < 2 ? ['runner'] : ['runner','charger'];
      const n = loop >= 3 ? 2 : 1;
      for (let i = 0; i < n && run.enemies.length < difficulty(run).addCap; i++) {
        const pos = offsetSpawnPos(run, target, i, n);
        const add = spawnEnemy(run, players, pool[Math.floor(Math.random() * pool.length)] || 'runner', false, pos, { noArmor: true, packRole: 'hunter_chorus' });
        add.rallyT = Math.max(add.rallyT || 0, 0.85);
        add.rallyTargetId = target.id;
      }
      run.fx.push({ t: 'summon', kind: 'hunter_chorus', x: Math.round(e.x), y: Math.round(e.y), x2: Math.round(target.x), y2: Math.round(target.y), count: n });
    }
    e.bossCastCd = Math.max(1.75, def.fireCd - Math.min(0.35, loop * 0.06));
  }
  touchDamage(run, e, players, dt);
}
function stepHunterDuelistBoss(run, players, e, def, target, toT, dT, spd, dt, walls) {
  if (!e.state) e.state = 'move';
  e.bossCastCd -= dt;
  if (e.state === 'move') {
    if (dT < 430 && e.bossCastCd <= 0) { e.state = 'windup'; e.st = 0; e.dirX = toT.x; e.dirY = toT.y; }
    else steerMove(run, e, toT, spd, dt, { target });
  } else if (e.state === 'windup') {
    e.dirX = toT.x; e.dirY = toT.y;
    if (e.st >= 0.52) { e.state = 'charge'; e.st = 0; bossRadial(run, e, 6, 190, enemyDamageValue(e, 0.22), 5, 1.35, e.bossPhase || 0); }
  } else if (e.state === 'charge') {
    const c = collideWalls(e.x + (e.dirX || 1) * 560 * dt, e.y + (e.dirY || 0) * 560 * dt, e.size / 2, walls || [], e.x, e.y);
    const blocked = (c.x === e.x && c.y === e.y); e.x = c.x; e.y = c.y;
    for (const p of players.values()) if (p.alive) {
      const sep = resolveEnemyPlayerOverlap(run, e, p, walls || [], { pad: 12, playerKick: 22, fx: true });
      if (sep) { damagePlayer(run, p, enemyDamageValue(e, 0.92), e.x, e.y); e.state = 'cool'; e.st = 0; }
    }
    if (e.st >= 0.44 || blocked) { e.state = 'cool'; e.st = 0; }
  } else if (e.state === 'cool') {
    if (e.st >= 0.95) { e.state = 'move'; e.st = 0; e.bossCastCd = 0.95; }
  }
  touchDamage(run, e, players, dt);
}
function stepHunterMarksmanBoss(run, players, e, def, target, toT, dT, spd, dt) {
  bossMoveKeep(run, e, target, toT, dT, spd, dt, 520, 0.20);
  e.bossCastCd -= dt;
  if (e.bossCastCd <= 0) {
    bossAimBurst(run, e, target, 4, 0.38, def.bulletSpd || 300, enemyDamageValue(e, 0.36), 5);
    e.bossCastCd = 1.25;
  }
  touchDamage(run, e, players, dt);
}
function stepHunterTrapperBoss(run, players, e, def, target, toT, dT, spd, dt) {
  bossMoveKeep(run, e, target, toT, dT, spd, dt, 450, 0.28);
  e.bossCastCd -= dt;
  if (e.bossCastCd <= 0) {
    const side = { x: -toT.y, y: toT.x };
    for (let i = -1; i <= 1; i += 2) {
      const x = clamp(target.x + side.x * i * 82 + (Math.random() - 0.5) * 55, 80, run.plan.w - 80);
      const y = clamp(target.y + side.y * i * 82 + (Math.random() - 0.5) * 55, 80, run.plan.h - 80);
      warnBossCircle(run, e, x, y, 62, enemyDamageValue(e, 0.52), 0.78, 'red');
    }
    bossRadial(run, e, 5, def.bulletSpd || 235, enemyDamageValue(e, 0.24), 5, 1.9, e.bossPhase || 0);
    e.bossPhase = (e.bossPhase || 0) + 0.4;
    e.bossCastCd = 1.85;
  }
  touchDamage(run, e, players, dt);
}
function stepQRevisorBoss(run, players, e, def, target, toT, dT, spd, dt, walls) {
  // Reworked from ability mimic into a readable dash boss: charger-like windup, faster dash, radial shots.
  if (!e.state) e.state = 'move';
  e.bossVolleyCd = Math.max(0, (e.bossVolleyCd || 0.9) - dt);
  if (e.bossVolleyCd <= 0 && e.state !== 'charge') {
    bossRadial(run, e, 8 + Math.min(4, difficulty(run).loop), def.bulletSpd || 245, enemyDamageValue(e, 0.30), 6, 2.15, e.bossPhase || 0);
    e.bossPhase = (e.bossPhase || 0) + 0.36;
    e.bossVolleyCd = e.state === 'windup' ? 1.20 : 1.55;
  }
  e.bossDashCd = Math.max(0, (e.bossDashCd || 0) - dt);
  if (e.state === 'move') {
    if (dT < 620 && e.bossDashCd <= 0) {
      e.state = 'windup'; e.st = 0; e.dirX = toT.x; e.dirY = toT.y;
    } else {
      bossMoveKeep(run, e, target, toT, dT, spd, dt, 470, 0.12);
    }
  } else if (e.state === 'windup') {
    e.dirX = toT.x; e.dirY = toT.y;
    if ((e.fxT || 0) <= 0) { e.fxT = 0.12; run.fx.push({ t: 'boss_burst', id: e.id, x: Math.round(e.x), y: Math.round(e.y), windup: 1 }); }
    else e.fxT -= dt;
    if (e.st >= (def.windup || 0.48)) { e.state = 'charge'; e.st = 0; }
  } else if (e.state === 'charge') {
    const c = collideWalls(e.x + (e.dirX || 1) * (def.chargeSpd || 720) * dt, e.y + (e.dirY || 0) * (def.chargeSpd || 720) * dt, e.size / 2, walls || [], e.x, e.y);
    const blocked = (c.x === e.x && c.y === e.y); e.x = c.x; e.y = c.y;
    for (const p of players.values()) if (p.alive) {
      const sep = resolveEnemyPlayerOverlap(run, e, p, walls || [], { pad: 14, playerKick: 28, fx: true });
      if (sep) { damagePlayer(run, p, enemyDamageValue(e, 1.05), e.x, e.y); e.state = 'cool'; e.st = 0; }
    }
    if (e.st >= (def.chargeTime || 0.52) || blocked) { e.state = 'cool'; e.st = 0; bossRadial(run, e, 10, def.bulletSpd || 245, enemyDamageValue(e, 0.26), 6, 1.75, e.bossPhase || 0); }
  } else if (e.state === 'cool') {
    bossMoveKeep(run, e, target, toT, dT, spd * 0.72, dt, 500, 0.18);
    if (e.st >= (def.chargeCd || 1.05)) { e.state = 'move'; e.st = 0; e.bossDashCd = 0.75; }
  }
  touchDamage(run, e, players, dt);
}
function stepBossEnemy(run, players, e, def, target, toT, dT, spd, dt, walls) {
  stepBossMarks(run, players, e, dt);
  if (e.kind === 'boss_croupier') return stepCroupierBoss(run, players, e, def, target, toT, dT, spd, dt);
  if (e.kind === 'boss_anchor_cashier') return stepAnchorCashierBoss(run, players, e, def, target, toT, dT, spd, dt);
  if (e.kind === 'boss_hunter_chorus') return stepHunterChorusBoss(run, players, e, def, target, toT, dT, spd, dt);
  if (e.kind === 'boss_hunter_duelist') return stepHunterDuelistBoss(run, players, e, def, target, toT, dT, spd, dt, walls);
  if (e.kind === 'boss_hunter_marksman') return stepHunterMarksmanBoss(run, players, e, def, target, toT, dT, spd, dt);
  if (e.kind === 'boss_hunter_trapper') return stepHunterTrapperBoss(run, players, e, def, target, toT, dT, spd, dt);
  if (e.kind === 'boss_q_revisor') return stepQRevisorBoss(run, players, e, def, target, toT, dT, spd, dt, walls);
  steerMove(run, e, toT, spd, dt, { target });
  e.fireCd -= dt;
  if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS - 12) {
    e.fireCd = def.fireCd * (e.hp < e.maxHp * 0.5 ? 0.65 : 1);
    bossRadial(run, e, 10, def.bulletSpd || 230, enemyDamageValue(e, 0.6), 9, 3.2, Math.random() * Math.PI * 2);
  }
  touchDamage(run, e, players, dt);
}

function director(run, players, dt) {
  if (run.phase !== 'play') return;
  if (run.plan?.specialRoomId === 'chill_room') return;
  const alive = [...players.values()].filter(p => p.alive);
  if (!alive.length) return;
  const plan = run.plan;
  const df = difficulty(run);

  if (!run.director) run.director = createDirectorState(run);

  if (plan.category === 'boss') {
    // Boss adds now use tiny encounter packs instead of pure random trickle.
    const boss = run.enemies.find(e => ENEMIES[e.kind]?.boss);
    if (boss && boss.hp < boss.maxHp * 0.55) {
      run.director.pauseT -= dt;
      if (run.director.pauseT <= 0 && run.enemies.length < df.addCap) {
        const pool = df.loop < 2 ? ['grunt','runner'] : ['grunt','runner','shooter','bouncer','glitch','leech'];
        const center = { x: boss.x + (Math.random() - 0.5) * 480, y: boss.y + (Math.random() - 0.5) * 360 };
        const n = Math.min(df.addCap - run.enemies.length, 2 + Math.min(5, df.loop + Math.floor(Math.random() * 3)));
        for (let i = 0; i < n; i++) {
          const pos = offsetSpawnPos(run, center, i, n);
          const kind = pool[Math.floor(Math.random() * pool.length)];
          spawnEnemy(run, players, kind, df.loop >= 3, pos, { noArmor: df.loop < 2 });
        }
        run.fx.push({ t: 'director_wave', label: df.loop >= 2 ? 'BOSS ADD PACK' : 'BOSS SWARM', intent: 'boss', x: Math.round(center.x), y: Math.round(center.y), count: n });
        run.director.pauseT = Math.max(1.7, (6.8 - df.loop * 0.42 - df.late * 0.55) / DIFFICULTY_MULT + Math.random() * 1.4);
      }
    }
    return;
  }

  if (run.portal.open) return; // calm after objective
  if (plan.modifierIds.includes('hunter_contract')) return; // Hunter Waves own all spawns.
  if (plan.modifierIds.includes('casino_virus') && (run.casinoVirus?.spinsLeft || 0) <= 0) return; // After 3 spins, stop director so cleanup can open portal.

  const greed = plan.modifierIds.includes('greed');
  const casinoVirusActive = plan.modifierIds.includes('casino_virus') && (run.casinoVirus?.spinsLeft || 0) > 0;
  const totalBudget = directorTotalBudget(run);
  if (run.spawned >= totalBudget) {
    const lowVirusPressure = casinoVirusActive && run.enemies.length <= Math.max(1, Math.floor(df.maxActive * 0.18));
    if (!lowVirusPressure) return;
  }
  // If the first pack dies instantly, stage one more small beat, but do not turn
  // the room into a budget-drain arena.
  if (run.enemies.length <= 0 && !roomPacingReady(run) && run.spawned < totalBudget) run.director.pauseT = Math.min(run.director.pauseT || 0, 2.15);

  // Anti-spam: when the room is already full, stop creating waves and let the player read the encounter.
  const fullness = run.enemies.length / Math.max(1, df.maxActive);
  if (fullness > 0.82) {
    run.director.pauseT = Math.max(run.director.pauseT, 1.8);
    return;
  }

  run.director.pauseT -= dt * (greed ? 1.12 : 1);
  if (run.director.pauseT > 0) return;

  const budgetLeft = Math.max(2, totalBudget - run.spawned);
  const pack = choosePack(run);
  const spawned = spawnEncounterPack(run, players, pack, budgetLeft);
  if (!spawned) {
    run.director.pauseT = 1.0;
    return;
  }
  run.director.pauseT = nextWaveDelay(run, pack);
}

// ---------------------------------------------------------------- damage

function playerSigStack(p, key) { return Math.max(0, Number(p?.stats?.[key] || 0) || 0); }
function teamSigStack(players, key) {
  let n = 0;
  for (const p of players.values()) if (p.connected) n = Math.max(n, playerSigStack(p, key));
  return n;
}

const SIGNATURE_LABEL_BY_STAT = {
  sigQuarantineBuffer: 'QUARANTINE BUFFER', sigEmergencyCleanse: 'EMERGENCY CLEANSE', sigPayoutMirror: 'PAYOUT MIRROR', sigFalseZero: 'FALSE ZERO', sigDeafCommand: 'DEAF COMMAND', sigHuntRoute: 'HUNT ROUTE', sigRedOverdrive: 'RED OVERDRIVE', sigAimGlitch: 'AIM GLITCH', sigIncompleteDelete: 'INCOMPLETE DELETE', sigInsuranceProcess: 'INSURANCE PROCESS'
};
function activeBossSignatureLabels(players) {
  const out = [];
  const seen = new Set();
  for (const p of players.values()) {
    if (!p.connected) continue;
    for (const [stat, label] of Object.entries(SIGNATURE_LABEL_BY_STAT)) {
      if ((p.stats?.[stat] || 0) > 0 && !seen.has(label)) { seen.add(label); out.push(label); }
    }
  }
  return out.slice(0, 12);
}
function maybeDoubleResourceBySignature(run, players, type, val, actor = null) {
  const stack = actor ? playerSigStack(actor, 'sigPayoutMirror') : teamSigStack(players, 'sigPayoutMirror');
  if (!stack || !(type === 'GLD' || type === 'HEA' || type === 'hp' || type === 'gld')) return val;
  const chance = Math.min(0.18, 0.06 + stack * 0.025);
  if (Math.random() >= chance) return val;
  const label = (type === 'HEA' || type === 'hp') ? 'HP x2' : 'GLD x2';
  run.fx.push({ t: 'active_mutation', label: `PAYOUT ${label}`, x: Math.round(actor?.x || run.portal?.x || run.plan?.w / 2 || 0), y: Math.round(actor?.y || run.portal?.y || run.plan?.h / 2 || 0), r: 92, tone: type === 'GLD' || type === 'gld' ? 'gold' : 'green' });
  return Math.max(0, Math.round(val * 2));
}
function scatterEnemiesFromPlayer(run, p, radius = 360) {
  let count = 0;
  for (const e of run.enemies) {
    if (!e || e.hp <= 0) continue;
    const d2 = dist2(e.x, e.y, p.x, p.y);
    if (d2 > (radius + (e.size || 20)) ** 2) continue;
    const n = norm(e.x - p.x, e.y - p.y);
    const force = ENEMIES[e.kind]?.boss ? 110 : 260;
    e.x += n.x * force; e.y += n.y * force;
    e.activeSlowT = Math.max(e.activeSlowT || 0, ENEMIES[e.kind]?.boss ? 0.25 : 0.8);
    e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.55);
    count++;
  }
  run.fx.push({ t: 'active_mutation', label: 'INSURANCE PROCESS', x: Math.round(p.x), y: Math.round(p.y), r: radius, tone: 'red', count });
}
function stepSignatureModules(run, players, dt) {
  for (const p of players.values()) {
    if (!p.connected || !p.alive) continue;
    p.quarantineT = Math.max(0, (p.quarantineT || 0) - dt);
    if ((p.quarantineT || 0) <= 0) p.quarantineHp = 0;
    p.aimGlitchT = Math.max(0, (p.aimGlitchT || 0) - dt);
    if (playerSigStack(p, 'sigHuntRoute') > 0) {
      const moving = Math.hypot(p.moveX || 0, p.moveY || 0) > 0.12 && run.phase === 'play';
      p.huntRouteT = clamp((p.huntRouteT || 0) + (moving ? dt : -dt * 2.2), 0, 4.0 + playerSigStack(p, 'sigHuntRoute') * 0.8);
    } else p.huntRouteT = 0;
    if (playerSigStack(p, 'sigEmergencyCleanse') > 0 && !p.emergencyCleanseUsed && p.hp > 0 && p.hp <= maxHp(p) * 0.30) {
      p.emergencyCleanseUsed = true; p.emergencyCleanseT = 20; p.emergencyCleansePulse = 0;
      run.fx.push({ t: 'active_mutation', label: 'EMERGENCY CLEANSE', x: Math.round(p.x), y: Math.round(p.y), r: 300, tone: 'cyan' });
    }
    p.emergencyCleanseT = Math.max(0, (p.emergencyCleanseT || 0) - dt);
    if ((p.emergencyCleanseT || 0) > 0) {
      p.emergencyCleansePulse = Math.max(0, (p.emergencyCleansePulse || 0) - dt);
      if (p.emergencyCleansePulse <= 0) {
        p.emergencyCleansePulse = 0.32;
        const r = 270 + Math.min(90, playerSigStack(p, 'sigEmergencyCleanse') * 20);
        let erased = 0;
        for (const b of run.bullets) {
          if (b.from === 'e' && dist2(b.x, b.y, p.x, p.y) <= (r + (b.size || 4)) ** 2) { b.life = -1; erased++; }
        }
        if (erased) run.fx.push({ t: 'active_mutation', label: `CLEANSE ${erased}`, x: Math.round(p.x), y: Math.round(p.y), r, tone: 'cyan' });
      }
    }
    if ((p.aimGlitchT || 0) > 0) {
      const r = 220 + Math.min(80, playerSigStack(p, 'sigAimGlitch') * 20);
      for (const b of run.bullets) {
        if (b.from !== 'e' || dist2(b.x, b.y, p.x, p.y) > (r + (b.size || 4)) ** 2) continue;
        const n = norm(b.x - p.x, b.y - p.y);
        const sp = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        b.vx = b.vx * 0.92 + n.x * sp * 0.08;
        b.vy = b.vy * 0.92 + n.y * sp * 0.08;
      }
    }
  }
}

function damagePlayer(run, p, dmg, srcX, srcY, opts = {}) {
  if (!p.alive || p.invuln > 0 || p.devGod) return;
  dmg = Math.max(0, Math.round(Number(dmg) || 0));
  if (isGreedRoom(run)) dmg = Math.max(1, Math.round(dmg * GOLD_FEVER_DAMAGE_MULT));
  if (opts.enemyBullet && playerSigStack(p, 'sigFalseZero') > 0) {
    const chance = Math.min(0.24, 0.10 + playerSigStack(p, 'sigFalseZero') * 0.035);
    if (Math.random() < chance) {
      p.invuln = Math.max(p.invuln, PLAYER_HIT_INVULN * 0.55);
      run.fx.push({ t: 'active_mutation', label: 'FALSE ZERO', x: Math.round(srcX ?? p.x), y: Math.round(srcY ?? p.y), r: 62, tone: 'cyan', playerId: p.id });
      return;
    }
  }
  if ((p.quarantineT || 0) > 0 && (p.quarantineHp || 0) > 0) {
    const absorbed = Math.min(dmg, Math.round(p.quarantineHp || 0));
    p.quarantineHp = Math.max(0, (p.quarantineHp || 0) - absorbed);
    dmg = Math.max(0, dmg - absorbed);
    run.fx.push({ t: 'active_mutation', label: 'QUARANTINE BUFFER', x: Math.round(p.x), y: Math.round(p.y), r: 86, tone: 'cyan', absorbed });
    if (dmg <= 0) { p.invuln = Math.max(p.invuln, PLAYER_HIT_INVULN * 0.75); return; }
  }
  if (run.roomStats) run.roomStats.damageTaken += dmg;
  if (isGreedRoom(run)) {
    playerMoneyCost(run, p, dmg, srcX ?? p.x, srcY ?? p.y, 'GREED HIT');
    damageCombo(run, p, dmg);
    p.invuln = Math.max(p.invuln, PLAYER_HIT_INVULN);
    return;
  }
  p.hp -= dmg;
  p.invuln = Math.max(p.invuln, PLAYER_HIT_INVULN);
  run.fx.push({ t: 'phit', id: p.id, dmg, x: Math.round(srcX ?? p.x), y: Math.round(srcY ?? p.y) });
  damageCombo(run, p, dmg);
  if (playerSigStack(p, 'sigInsuranceProcess') > 0 && !p.insuranceProcessUsed && p.hp > 0 && p.hp <= maxHp(p) * 0.10) {
    p.insuranceProcessUsed = true;
    scatterEnemiesFromPlayer(run, p, 340 + Math.min(120, playerSigStack(p, 'sigInsuranceProcess') * 30));
  }
  if (p.hp <= 0) {
    const favor = consumeContractFavor(run, ['portal_insurance']);
    if (favor) {
      p.hp = Math.min(maxHp(p), 50);
      p.alive = true;
      p.invuln = Math.max(p.invuln, 1.0);
      run.fx.push({ t: 'favor_used', id: favor.id, label: favorLabel(favor), body: '50 HP RESTORED', playerId: p.id });
      return;
    }
    p.hp = 0; p.alive = false;
    run.fx.push({ t: 'pdown', id: p.id });
  }
}

function damageEnemy(run, players, e, dmg, owner, knock, kx, ky, source = 'hit') {
  const def = ENEMIES[e.kind];
  // Armor is a real shell class: it absorbs hits before HP.
  // Plain shell loses shell HP from shots. Linked shell loses nothing while its unarmored battery mob is alive nearby.
  const rawDmg = Math.max(1, Math.round(dmg));
  const shellActive = (e.shellHp || 0) > 0;
  if (shellActive) {
    const locked = e.shellType === 'linked' && ((e.armorLockT || 0) > 0 && !!e.armorLinkId);
    e.shellFlashT = 0.16;
    if (locked) {
      run.fx.push({ t: 'armor_shell', locked: 1, shellType: e.shellType || 'linked', id: e.id, link: e.armorLinkId, dmg: rawDmg, x: Math.round(e.x), y: Math.round(e.y) });
      return;
    }
    e.shellRegenDelay = Math.max(e.shellRegenDelay || 0, 4.2);
    e.shellHp = Math.max(0, (e.shellHp || 0) - rawDmg);
    run.fx.push({ t: 'armor_shell', id: e.id, shellType: e.shellType || 'plain', dmg: rawDmg, left: Math.round(e.shellHp || 0), x: Math.round(e.x), y: Math.round(e.y) });
    if (e.shellHp <= 0) {
      e.armorLockT = 0;
      e.armorLinkId = '';
      run.fx.push({ t: 'armor_break', id: e.id, shellType: e.shellType || 'plain', x: Math.round(e.x), y: Math.round(e.y) });
      // Armor break is not a kill cause. Do not add БРОНЯ / SHELL to combo reasons.
      rewardShellMarket(run, e.x, e.y);
    }
    return;
  }
  if (e.anchorT > 0) dmg *= 0.88;
  if (e.leechLinkT > 0) dmg *= 0.82;
  if ((e.exposedT || 0) > 0) dmg *= Math.max(1, e.exposedMul || 1.25);
  if (e.orbShieldT > 0) dmg *= 0.76;
  if (e.kind === 'orbiter' && def.shield && (kx || ky)) {
    // Front shield faces the player/target. Hits coming into the shield face are reduced.
    const incomingTowardEnemy = norm(kx || 0, ky || 0);
    const face = norm(e.dirX || 1, e.dirY || 0);
    const dot = incomingTowardEnemy.x * face.x + incomingTowardEnemy.y * face.y;
    if (dot > 0.25) { dmg *= (1 - def.shield); run.fx.push({ t: 'shield', x: Math.round(e.x), y: Math.round(e.y), id: e.id }); }
  }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  run.fx.push({ t: 'ehit', id: e.id, dmg, x: Math.round(e.x), y: Math.round(e.y) });
  if (knock && !def.boss && e.kind !== 'bouncer' && !def.immobile) {
    e.x += kx * knock * 0.02; e.y += ky * knock * 0.02;
  }
  const p = owner ? players.get(owner) : null;
  if (p && p.stats.lifesteal > 0 && p.alive) {
    p.hp = Math.min(maxHp(p), p.hp + dmg * p.stats.lifesteal);
  }
  if (e.hp <= 0) killEnemy(run, players, e, p, source);
}


function spreadElementStatusesOnKill(run, players, dead, killer) {
  if (!killer || !killer.stats || !(killer.stats.elementSpread || 0)) return;
  const hasBurn = (dead.burnT || 0) > 0;
  const hasPoison = (dead.poisonT || 0) > 0;
  const hasFreeze = (dead.frozenT || 0) > 0;
  if (!hasBurn && !hasPoison && !hasFreeze) return;
  const spread = Math.min(3, killer.stats.elementSpread || 1);
  const r = 92 + spread * 18;
  let count = 0;
  for (const n of run.enemies) {
    if (!n || n.id === dead.id || n.hp <= 0) continue;
    if (dist2(n.x, n.y, dead.x, dead.y) > (r + n.size / 2) ** 2) continue;
    if (hasBurn) { n.burnT = Math.max(n.burnT || 0, Math.min(1.9 + spread * 0.25, (dead.burnT || 1.2) * 0.55)); n.burnDps = Math.max(n.burnDps || 0, (dead.burnDps || 2) * 0.55); n.burnOwner = killer.id; }
    if (hasPoison) { n.poisonT = Math.max(n.poisonT || 0, Math.min(3.2 + spread * 0.35, (dead.poisonT || 1.8) * 0.62)); n.poisonDps = Math.max(n.poisonDps || 0, (dead.poisonDps || 1.5) * 0.58); n.poisonOwner = killer.id; }
    if (hasFreeze) activeFreezeEnemy(run, n, Math.min(0.24, 0.10 + spread * 0.035));
    count++;
    if (count >= 2 + spread) break;
  }
  if (count) run.fx.push({ t: 'active_mutation', label: 'STATUS SPREAD', x: Math.round(dead.x), y: Math.round(dead.y), r: Math.round(r), tone: hasPoison ? 'green' : hasFreeze ? 'cyan' : 'red', owner: killer.id });
}

function killEnemy(run, players, e, killer, source = 'hit') {
  const def = ENEMIES[e.kind];
  run.enemies = run.enemies.filter(x => x.id !== e.id);
  run.kills++;
  if (run.roomStats) run.roomStats.kills++;
  run.fx.push({ t: 'kill', x: Math.round(e.x), y: Math.round(e.y), kind: e.kind, elite: e.elite, size: e.size });
  registerComboEvent(run, killer, source, e, 1);
  spreadElementStatusesOnKill(run, players, e, killer);
  if (e.kind === 'splitter' && (e.splitStage || 0) < 2) {
    const children = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < children && run.enemies.length < MAX_ENEMIES; i++) {
      const ch = spawnEnemy(run, players, 'splitter', false);
      ch.x = e.x + (Math.random() - 0.5) * 70; ch.y = e.y + (Math.random() - 0.5) * 70;
      ch.splitStage = (e.splitStage || 0) + 1;
      ch.size = Math.max(16, Math.round(e.size * 0.68));
      ch.maxHp = Math.max(10, Math.round(e.maxHp * 0.38)); ch.hp = ch.maxHp;
      ch.spd = Math.round(e.spd * 1.35); ch.dmg = Math.max(5, Math.round(e.dmg * 0.72));
    }
    run.fx.push({ t: 'split', x: Math.round(e.x), y: Math.round(e.y) });
  }
  if (e.kind === 'boss_hunter_chorus') {
    spawnHunterChorusFragments(run, players, e);
    return;
  }
  if (e.hunter || e.id === run.hunterTarget) {
    run.hunterTarget = null;
    run.fx.push({ t: 'contract_done', x: Math.round(e.x), y: Math.round(e.y) });
    for (const p of players.values()) if (p.alive && p.connected) {
      const pool = HERO_UPGRADES.filter(u => u.tier === 1 || u.tier === 2);
      const u = pool[Math.floor(Math.random() * pool.length)];
      if (u) { u.apply(p.stats); p.hp = Math.min(p.hp, maxHp(p)); run.fx.push({ t: 'install', id: p.id, label: 'HUNTER: ' + u.label, cursed: !!u.cursed }); }
    }
  }
  if (run.plan.modifierIds.includes('casino_virus') && e.elite && Math.random() < 0.42) {
    if (Math.random() < 0.62) {
      const val = 18 + Math.round(Math.random() * 26);
      if (killer) grantPersonalEconomy(run, players, killer, 'GLD', val, 'CASINO VIRUS', e.x, e.y);
      else dropPickup(run, e.x, e.y, 'GLD', val, { personal: 1, label: 'CASINO VIRUS' });
      run.fx.push({ t: 'casino_tick', x: Math.round(e.x), y: Math.round(e.y), good: 1 });
    }
    else {
      // Casino Virus static is local to this room. It must not create next-room Static Storm debt.
      if (run.casinoVirus) { run.casinoVirus.activeRainStacks = Math.max(run.casinoVirus.activeRainStacks || 0, 2); run.casinoVirus.rainT = Math.min(run.casinoVirus.rainT || 0.25, 0.25); }
      run.fx.push({ t: 'casino_tick', x: Math.round(e.x), y: Math.round(e.y), good: 0, localStatic: 1 });
    }
  }
  // drops
  const greed = run.plan.modifierIds.includes('greed');
  const mult = (e.elite ? 2.5 : 1) * (def.boss ? 1 : 1);
  const goldMul = (killer ? killer.stats.goldMul : 1) * (greed ? 1.6 : 1);
  dropPickup(run, e.x, e.y, 'GLD', Math.max(1, Math.round(def.gld * mult * goldMul * scaling(run) * 0.6 * mobLootMul(run))));
  dropPickup(run, e.x + 14, e.y - 8, 'EXP', Math.max(1, Math.round(def.xp * mult * (1 + (mobLootMul(run) - 1) * 0.45))));
  if ((e.elite && Math.random() < 0.35) || def.boss) dropPickup(run, e.x - 14, e.y + 8, 'HEA', 25);
  if (!def.boss && killer && playerSigStack(killer, 'sigIncompleteDelete') > 0 && (e.elite || (def.score || 0) >= 3) && Math.random() < Math.min(0.28, 0.10 + playerSigStack(killer, 'sigIncompleteDelete') * 0.035)) {
    dropPersonalPickup(run, killer, e.x + 8, e.y + 12, 'HEA', 6 + Math.round(Math.random() * 8), 'INCOMPLETE DELETE');
    run.fx.push({ t: 'active_mutation', label: 'INCOMPLETE DELETE', x: Math.round(e.x), y: Math.round(e.y), r: 70, tone: 'green' });
  }
  if (def.boss) {
    run.fx.push({ t: 'boss_down', x: Math.round(e.x), y: Math.round(e.y), fragment: def.bossFragment ? 1 : 0 });
    const otherBossAlive = run.enemies.some(x => x && x.hp > 0 && ENEMIES[x.kind]?.boss);
    if (!def.bossFragment || !otherBossAlive) {
      if (run.runMemory) run.runMemory.bossesDefeated = (run.runMemory.bossesDefeated || 0) + 1;
      // boss reward burst
      const burst = def.bossFragment ? 4 : 6;
      for (let i = 0; i < burst; i++) dropPickup(run, e.x + (Math.random() - 0.5) * 160, e.y + (Math.random() - 0.5) * 160, Math.random() < 0.7 ? 'GLD' : 'EXP', 20 + Math.round(Math.random() * 20));
      queueBossSignatureReward(run, players, run.bossKind || e.kind || 'boss');
      openPortal(run);
    }
  }
  // proc blast on kill? (proc handled at bullet hit)
  if (quotaCanOpenPortal(run)) openPortal(run);
}

function dropPickup(run, x, y, type, val, opts = {}) {
  const personal = opts.personal ? 1 : 0;
  const owner = String(opts.owner || opts.ownerId || '');
  const label = String(opts.label || '');
  if (run.pickups.length >= MAX_PICKUPS) {
    // merge into nearest same-type/same-scope pickup only. Personal casino/Q loot must never merge into team loot.
    let best = null, bd = Infinity;
    for (const pk of run.pickups) {
      if (pk.type !== type) continue;
      if (!!pk.personal !== !!personal) continue;
      if (String(pk.owner || '') !== owner) continue;
      const d = dist2(pk.x, pk.y, x, y);
      if (d < bd) { bd = d; best = pk; }
    }
    if (best) { best.val += val; return; }
    return;
  }
  run.pickups.push({ id: nid(), type, x: Math.round(x), y: Math.round(y), val, personal, owner, label });
}
function dropPersonalPickup(run, p, x, y, type, val, label = 'PERSONAL LOOT') {
  dropPickup(run, x, y, type, val, { personal: 1, owner: p?.id || '', label });
}
function grantPersonalEconomy(run, players, p, type, val, label = 'PERSONAL LOOT', x = p?.x, y = p?.y) {
  if (!p || !p.connected) return 0;
  val = Math.max(0, Math.round(Number(val) || 0));
  if (!val) return 0;
  if (type === 'GLD' || type === 'gld') {
    val = maybeDoubleResourceBySignature(run, players, 'GLD', val, p);
    p.economy.money += val;
    recordPickupStat(run, 'GLD', val);
    run.fx.push({ t: 'pick', id: p.id, name: p.name || '', type: 'GLD', val, x: Math.round(x ?? p.x), y: Math.round(y ?? p.y), personal: 1, label });
  } else if (type === 'EXP' || type === 'exp') {
    addXp(run, p, val);
    recordPickupStat(run, 'EXP', val);
    run.fx.push({ t: 'pick', id: p.id, name: p.name || '', type: 'EXP', val, x: Math.round(x ?? p.x), y: Math.round(y ?? p.y), personal: 1, label });
  } else if (type === 'HEA' || type === 'HP' || type === 'hp') {
    val = maybeDoubleResourceBySignature(run, players, 'HEA', val, p);
    if (p.alive) p.hp = Math.min(maxHp(p), p.hp + val);
    recordPickupStat(run, 'HEA', val);
    run.fx.push({ t: 'pick', id: p.id, name: p.name || '', type: 'HEA', val, x: Math.round(x ?? p.x), y: Math.round(y ?? p.y), personal: 1, label });
  }
  return val;
}

function grantPickupEconomy(run, players, collector, type, val, pk = null) {
  if (pk?.personal) {
    return grantPersonalEconomy(run, players, collector, type, val, pk.label || 'PERSONAL LOOT', pk.x, pk.y);
  }
  // Only normal enemy loot and BSC chest drops are team credit: one player collects, every connected player receives it.
  if (type === 'GLD' || type === 'EXP') {
    recordPickupStat(run, type, val);
    for (const p of players.values()) {
      if (!p.connected) continue;
      if (type === 'GLD') p.economy.money += val;
      else addXp(run, p, val);
    }
    return;
  }
  // HEA remains local to the player who actually touched the pickup, so one heal orb does not heal the whole squad.
  if (type === 'HEA' && collector) { val = maybeDoubleResourceBySignature(run, players, type, val, collector); recordPickupStat(run, type, val); collector.hp = Math.min(maxHp(collector), collector.hp + val); }
}

function addXp(run, p, val) {
  p.economy.xp += val; p.economy.lifetimeXp += val;
  while (p.economy.xp >= p.economy.nextLevelXp) {
    p.economy.xp -= p.economy.nextLevelXp;
    p.economy.level++;
    p.economy.pending++;
    p.economy.nextLevelXp = Math.round(40 * Math.pow(1.32, p.economy.level));
    run.fx.push({ t: 'levelup', id: p.id, level: p.economy.level, pending: p.economy.pending });
  }
}


function bulletElementString(p, source = 'weapon') {
  if (!p || !p.stats) return '';
  if (source === 'drone' && !(p.stats.droneElementLink || 0)) return '';
  const parts = [];
  if ((p.stats.bulletFire || 0) > 0) parts.push('fire');
  if ((p.stats.bulletFreeze || 0) > 0) parts.push('freeze');
  if ((p.stats.bulletPoison || 0) > 0) parts.push('poison');
  return parts.join('+');
}
function bulletElementPower(p, source = 'weapon') {
  if (!p || !p.stats) return 0;
  const stacks = (p.stats.bulletFire || 0) + (p.stats.bulletFreeze || 0) + (p.stats.bulletPoison || 0);
  const link = source === 'drone' ? Math.min(1, 0.52 + (p.stats.droneElementLink || 0) * 0.16) : 1;
  const amp = 1 + (p.stats.bulletElementAmp || 0) * 0.25;
  return Math.max(0, stacks) * link * amp;
}
function applyBulletElements(run, players, e, b, strength = 1) {
  if (!e || e.hp <= 0 || !b) return;
  const owner = b.owner || null;
  const p = owner ? players.get(owner) : null;
  // Robust fallback: old/projectile code may forget to copy b.elem, but owner stats are the source of truth.
  const elem = String(b.elem || (p ? bulletElementString(p, b.source || 'weapon') : ''));
  if (!elem) return;
  const fireStacks = Math.max(p?.stats?.bulletFire || 0, elem.includes('fire') ? 1 : 0);
  const freezeStacks = Math.max(p?.stats?.bulletFreeze || 0, elem.includes('freeze') ? 1 : 0);
  const poisonStacks = Math.max(p?.stats?.bulletPoison || 0, elem.includes('poison') ? 1 : 0);
  const power = Math.max(0.65, Number(b.elemPower || (p ? bulletElementPower(p, b.source || 'weapon') : 1) || 1)) * strength;
  const hitFx = (label, tone, rAdd = 22) => run.fx.push({ t: 'element_hit', label, tone, x: Math.round(e.x), y: Math.round(e.y), r: Math.round((e.size || 18) + rAdd), owner: owner || '' });

  if (elem.includes('fire')) {
    if ((e.frozenT || 0) > 0 && (e.elemComboCd || 0) <= 0) {
      e.elemComboCd = 0.40;
      const crack = Math.max(2, (b.dmg || 6) * (0.16 + fireStacks * 0.05) * strength);
      e.frozenT *= 0.42;
      damageEnemy(run, players, e, crack, owner, 0, 0, 0, 'freeze');
      if (e.hp <= 0) return;
      run.fx.push({ t: 'active_mutation', label: 'THERMAL CRACK', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 30), tone: 'red', owner: owner || '' });
    }
    e.burnT = Math.max(e.burnT || 0, 1.65 + fireStacks * 0.28 * power);
    e.burnDps = Math.max(e.burnDps || 0, (2.4 + fireStacks * 0.9) * power);
    e.burnOwner = owner;
    hitFx('BURN', 'red', 24);
  }
  if (elem.includes('poison')) {
    e.poisonT = Math.max(e.poisonT || 0, 3.2 + poisonStacks * 0.42 * power);
    e.poisonDps = Math.max(e.poisonDps || 0, (1.7 + poisonStacks * 0.55) * power);
    e.poisonOwner = owner;
    // Slow rot: poison makes chill/freeze stick a little longer.
    if (elem.includes('freeze') || (e.frozenT || 0) > 0) {
      e.activeSlowT = Math.max(e.activeSlowT || 0, 0.70 + poisonStacks * 0.08);
      e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.70);
    }
    hitFx('POISON', 'green', 22);
  }
  if (elem.includes('freeze')) {
    const chill = 0.70 + freezeStacks * 0.10 * power;
    e.chillT = Math.max(e.chillT || 0, chill + ((e.poisonT || 0) > 0 ? 0.22 : 0));
    e.activeSlowT = Math.max(e.activeSlowT || 0, e.chillT);
    e.activeSlowMul = Math.min(e.activeSlowMul || 1, (e.poisonT || 0) > 0 ? 0.52 : 0.64);
    // Every freeze bullet now has visible CHILL; full freeze-lock is still a stronger proc.
    hitFx((e.frozenT || 0) > 0 ? 'FROZEN' : 'CHILL', 'cyan', 26);
    const chance = Math.min(0.55, 0.18 + freezeStacks * 0.065 + ((e.poisonT || 0) > 0 ? 0.08 : 0));
    if (Math.random() < chance * Math.min(1.25, power)) {
      activeFreezeEnemy(run, e, 0.14 + freezeStacks * 0.03 + ((e.poisonT || 0) > 0 ? 0.05 : 0));
      hitFx('FROZEN', 'cyan', 30);
    }
  }
  if (elem.includes('fire') && (elem.includes('poison') || (e.poisonT || 0) > 0) && (e.elemComboCd || 0) <= 0) {
    e.elemComboCd = 0.65;
    damageEnemy(run, players, e, Math.max(2, (b.dmg || 6) * 0.18 * strength), owner, 0, 0, 0, 'fire');
    if (e.hp > 0) run.fx.push({ t: 'active_mutation', label: 'VOLATILE MIX', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 32), tone: 'red', owner: owner || '' });
  }
}


function applyWeaponChain(run, players, startEnemy, b) {
  const owner = b?.owner ? players.get(b.owner) : null;
  const level = Math.min(100, Math.max(0, owner?.stats?.bulletChain || 0));
  if (!level || !startEnemy || !b || b.from !== 'p') return;
  const visited = new Set([startEnemy.id]);
  let from = { x: startEnemy.x, y: startEnemy.y, id: startEnemy.id, size: startEnemy.size || 18 };
  let dmg = Math.max(1, (b.dmg || 4) * 0.54);
  // Each WPN LINK stack adds both one possible jump and more connection reach.
  // Early stacks are modest; very long builds can eventually bridge whole packs.
  const linkRange = Math.min(1600, 145 + level * 14);
  let jumps = 0;
  run.fx.push({ t: 'weapon_chain_lock', x: Math.round(startEnemy.x), y: Math.round(startEnemy.y), r: Math.round((startEnemy.size || 18) + 14), tone: 'cyan' });
  for (let i = 0; i < level; i++) {
    let best = null, bd = Infinity;
    for (const e of run.enemies) {
      if (!e || e.hp <= 0 || visited.has(e.id)) continue;
      const d = dist2(e.x, e.y, from.x, from.y);
      if (d < bd && d <= (linkRange + e.size / 2) ** 2) { bd = d; best = e; }
    }
    if (!best) break;
    visited.add(best.id);
    const n = norm(best.x - from.x, best.y - from.y);
    run.fx.push({
      t: 'weapon_chain_link', x1: Math.round(from.x), y1: Math.round(from.y),
      x2: Math.round(best.x), y2: Math.round(best.y), range: Math.round(linkRange), jump: i + 1
    });
    run.fx.push({ t: 'weapon_chain_lock', x: Math.round(best.x), y: Math.round(best.y), r: Math.round((best.size || 18) + 14), tone: 'cyan' });
    damageEnemy(run, players, best, dmg, b.owner, (b.knock || 0) * 0.18, n.x, n.y, 'chain');
    if (best.hp > 0 && b.elem) applyBulletElements(run, players, best, b, Math.max(0.25, 0.62 * Math.pow(0.96, i)));
    jumps++;
    from = { x: best.x, y: best.y, id: best.id, size: best.size || 18 };
    dmg = Math.max(1, dmg * 0.86);
  }
  if (jumps) run.fx.push({ t: 'active_mutation', label: `WPN LINK x${jumps}`, x: Math.round(startEnemy.x), y: Math.round(startEnemy.y), r: Math.round(60 + Math.min(145, jumps * 7)), tone: 'cyan', owner: b.owner || '' });
}

// ---------------------------------------------------------------- shooting
function globalDamageMul(p) {
  return Math.max(0.05, Number(p?.stats?.dmgMul) || 1);
}
function weaponDamageMul(p) {
  return globalDamageMul(p) * Math.max(0.05, Number(p?.stats?.weaponDmgMul) || 1);
}
function weaponDamageValue(p, base, scale = 1) {
  return Math.max(0, Number(base) || 0) * weaponDamageMul(p) * Math.max(0, Number(scale) || 0);
}
function fireWeapon(run, players, p, dt) {
  p.cd = Math.max(0, (p.cd || 0) - dt);
  if (!p.fire) { p.fireWasDown = false; return; }
  if (!p.alive) return;
  const w = WEAPONS[p.weapons[p.weaponIdx]];
  if (!w) return;
  const tempFire = p.activeBuffT > 0 ? 1.65 + p.stats.activeOver * 0.20 : 1;
  const dir = norm(p.aimX - p.x, p.aimY - p.y);
  if (w.id === 'shotgun') {
    if (p.fireWasDown) return;
    if ((p.shgCharges ?? 4) <= 0) { p.fireWasDown = true; return; }
    p.fireWasDown = true;
    p.shgCharges = Math.max(0, (p.shgCharges ?? 4) - 1);
    p.cd = 0; // shotgun is gated by click edges + 4-charge ammo, not by cooldown
  } else {
    if (p.cd > 0) return;
    p.cd = w.cooldown / (p.stats.fireMul * tempFire);
  }

  const echoBase = p.stats.echoShot + (run.plan.modifierIds.includes('echo_walls') ? 0.50 : 0);
  const echoMul = w.id === 'seeker' ? 0.38 : (w.id === 'rocketgun' ? 0.18 : 1);
  const shots = 1 + chanceStacks(echoBase * echoMul);
  const pellets = w.pellets + (w.id === 'shotgun' ? p.stats.shgPellets : 0);
  const rangeMul = Math.max(0.25, p.stats.bulletRange || 1);
  const homing = (w.homing || 0) + (w.id === 'seeker' ? p.stats.sekChain * 0.7 : 0);
  const life = (w.life + (w.id === 'seeker' ? p.stats.sekChain * 0.10 : 0)) * rangeMul;
  const maxDist = w.maxDist ? Math.round(w.maxDist * rangeMul + (w.id === 'seeker' ? p.stats.sekChain * 35 : 0)) : 0;
  const detonateDist = w.detonateDist ? Math.round(((w.detonateDist || 0) + (w.id === 'rocketgun' ? p.stats.rktCluster * 35 : 0)) * rangeMul) : 0;
  const elem = bulletElementString(p, 'weapon');
  const elemPower = bulletElementPower(p, 'weapon');
  const originX = p.x + dir.x * 24;
  const originY = p.y + dir.y * 24;
  for (let s = 0; s < shots; s++) {
    const delay = s * (w.id === 'shotgun' ? 0.018 : 0.055);
    for (let i = 0; i < pellets; i++) {
      if (run.bullets.length >= MAX_BULLETS) break;
      const spreadKick = w.id === 'shotgun' ? (Math.random() - 0.5) * w.spread : (Math.random() - 0.5) * w.spread;
      const ang = Math.atan2(dir.y, dir.x) + spreadKick;
      run.bullets.push({
        id: nid(), x: originX, y: originY,
        vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
        dmg: weaponDamageValue(p, w.dmg), from: 'p', owner: p.id,
        life, delay, size: w.size, aoe: w.aoe || 0, homing,
        knock: w.knock || 0, proc: p.stats.procBlast, kind: w.id, travelled: 0, detonateDist, maxDist, rangeMul,
        bounces: (p.stats.bulletBounce || 0) + (w.id === 'shotgun' ? (p.stats.shgBounce || 0) : 0),
        sekSplit: w.id === 'seeker' ? p.stats.sekSplit : 0,
        rktCluster: w.id === 'rocketgun' ? p.stats.rktCluster : 0,
        rktMines: w.id === 'rocketgun' ? p.stats.rktMines : 0,
        rktStun: w.id === 'rocketgun' ? p.stats.rktStun : 0,
        rktScatter: w.id === 'rocketgun' ? p.stats.rktScatter : 0,
        rktRemote: w.id === 'rocketgun' ? p.stats.rktRemote : 0,
        elem, elemPower, echoProc: s > 0 ? 1 : 0,
        mineDist: 0, bornTick: run.tick || 0
      });
    }
  }
  const recoil = w.id === 'shotgun' ? 36 : (w.id === 'rocketgun' ? 54 : 18);
  p.recoilT = Math.max(p.recoilT || 0, w.id === 'rocketgun' ? 0.16 : 0.09);
  p.recoilX = -dir.x * recoil;
  p.recoilY = -dir.y * recoil;
  run.fx.push({
    t: 'shot', id: p.id, w: w.label, kind: w.id,
    x: Math.round(p.x), y: Math.round(p.y), mx: Math.round(originX), my: Math.round(originY),
    dx: Math.round(dir.x * 100), dy: Math.round(dir.y * 100), ammo: p.shgCharges ?? 0
  });
  if (shots > 1) run.fx.push({ t: 'echo_shot', id: p.id, x: Math.round(originX), y: Math.round(originY), weapon: w.id, count: shots - 1 });
}
function explode(run, players, x, y, r, dmg, owner, hurtPlayers = false, style = 'blast', elem = '', elemPower = 0, opts = {}) {
  let hitCount = 0;
  for (const e of [...run.enemies]) {
    if ((e.spawnDelay || 0) > 0) continue;
    if (dist2(e.x, e.y, x, y) < (r + e.size / 2) ** 2) {
      hitCount++;
      const n = norm(e.x - x, e.y - y);
      if (opts.stun && !ENEMIES[e.kind]?.boss) {
        const dur = Math.min(1.8, 0.42 + (opts.stunStacks || 1) * 0.18);
        e.stunT = Math.max(e.stunT || 0, dur);
        e.activeSlowT = Math.max(e.activeSlowT || 0, dur);
        e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.12);
        e.fireCd = Math.max(e.fireCd || 0, Math.min(0.22, dur * 0.45));
      }
      if (elem) applyBulletElements(run, players, e, { owner, dmg, elem, elemPower }, 0.58);
      const knock = opts.scatter ? Math.max(220, opts.knock || 260) : 0;
      damageEnemy(run, players, e, activeScale(dmg), owner, knock, n.x, n.y, opts.comboMethod || (style === 'rocket' ? 'rocketgun' : 'blast'));
    }
  }
  run.fx.push({ t: 'blast', x: Math.round(x), y: Math.round(y), r: Math.round(r), style, elem, stun: opts.stun ? 1 : 0, scatter: opts.scatter ? 1 : 0, hits: hitCount });
  if (hurtPlayers) {
    for (const p of players.values()) {
      if (p.alive && dist2(p.x, p.y, x, y) < (r + PLAYER_SIZE / 2) ** 2) damagePlayer(run, p, dmg, x, y);
    }
  }
}

function rocketControlOpts(b) {
  return {
    stun: (b.rktStun || 0) > 0,
    stunStacks: Math.max(1, b.rktStun || 0),
    scatter: (b.rktScatter || 0) > 0,
    knock: 260 + Math.max(0, b.rktScatter || 0) * 80
  };
}
function rocketExplode(run, players, b, x = b.x, y = b.y, r = b.aoe || 70, dmg = b.dmg) {
  explode(run, players, x, y, r, dmg, b.owner, false, 'rocket', b.elem || '', b.elemPower || 0, { ...rocketControlOpts(b), comboMethod: comboSourceFromBullet(b) });
}

function rocketAftermath(run, players, b) {
  if (b.rktCluster > 0) {
    const pieces = Math.min(10, b.rktCluster * 2);
    for (let i = 0; i < pieces; i++) {
      const a = (i / pieces) * Math.PI * 2 + Math.random() * 0.35;
      const d = 52 + Math.random() * 74;
      rocketExplode(run, players, b, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, (38 + b.rktCluster * 5), b.dmg * 0.36);
    }
  }
}

function spawnSeekerFragments(run, owner, x, y, count, dmg, opts = {}) {
  if (count <= 0) return;
  const n = Math.min(8, count * 2);
  for (let i = 0; i < n && run.bullets.length < MAX_BULLETS; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.35;
    run.bullets.push({ id: nid(), x, y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg, from: 'p', owner, life: 0.85 * (opts.rangeMul || 1), size: 4, homing: 6.0, kind: 'seeker', travelled: 0, maxDist: Math.round(420 * 0.85 * (opts.rangeMul || 1)), bounces: opts.bounces || 0, elem: opts.elem || '', elemPower: opts.elemPower || 0 });
  }
}


function applyDamperFieldsToBullet(run, b, dt) {
  if (b.from !== 'p') return false;
  const dampers = run.enemies.filter(e => e.kind === 'damper' && e.hp > 0);
  if (!dampers.length) return false;
  for (const d of dampers) {
    const def = ENEMIES.damper;
    const r = def.fieldR || 260;
    if (dist2(b.x, b.y, d.x, d.y) > r * r) continue;
    const before = Math.hypot(b.vx || 0, b.vy || 0);
    const damp = Math.pow(def.bulletDamp || 0.02, dt);
    b.vx *= damp;
    b.vy *= damp;
    b.life -= dt * 1.25;
    b.dampedT = 0.18;
    b.dampFxCd = (b.dampFxCd || 0) - dt;
    if (b.dampFxCd <= 0) {
      b.dampFxCd = 0.16;
      run.fx.push({ t: 'bullet_damp', x: Math.round(b.x), y: Math.round(b.y), id: d.id });
    }
    const after = Math.hypot(b.vx || 0, b.vy || 0);
    if (after < (def.stopSpd || 36) || before < (def.stopSpd || 36)) {
      run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind || '' });
      b.life = -1;
      return true;
    }
    return false;
  }
  return false;
}

function stepBullets(run, players, dt) {
  const walls = run.plan.walls;
  for (const b of run.bullets) {
    if (b.delay > 0) {
      b.delay -= dt;
      if (b.delay <= 0 && b.mine) {
        rocketExplode(run, players, b, b.x, b.y, b.aoe || 55, b.dmg);
        b.life = -1;
      }
      continue;
    }
    b.life -= dt;
    if (run.plan?.modifierIds?.includes('echo_walls') && b.from === 'e' && !b.echoChecked && !b.echoProc && b.life > 0 && run.bullets.length < MAX_BULLETS && Math.random() < 0.50) {
      const sp = Math.hypot(b.vx || 0, b.vy || 0) || 260;
      const a = Math.atan2(b.vy || 0, b.vx || 1) + (Math.random() - 0.5) * 0.32;
      run.bullets.push({ ...b, id: nid(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, delay: 0.12, life: Math.max(0.45, b.life * 0.84), echoProc: 1, echoChecked: 1, bornTick: run.tick || 0 });
    }
    b.echoChecked = 1;
    if (hasMod(run, 'prism_grid') && run.prismZones?.length) {
      for (const z of run.prismZones) if (rectHitCircle(b.x, b.y, (b.size || 5) + 2, z)) { const m = Math.pow(0.333, dt * 6); b.vx *= m; b.vy *= m; b.gridSlowT = 0.12; break; }
    }
    if (applyDamperFieldsToBullet(run, b, dt)) continue;
    if (b.homing > 0 && b.from === 'p') {
      let best = null, bd = 330 * 330;
      if (b.targetId) {
        const locked = run.enemies.find(e => e.id === b.targetId && e.hp > 0);
        if (locked) { best = locked; bd = dist2(locked.x, locked.y, b.x, b.y); }
      }
      if (!best || bd > 520 * 520) {
        best = null; bd = 330 * 330;
        for (const e of run.enemies) {
          const d = dist2(e.x, e.y, b.x, b.y);
          if (d < bd) { bd = d; best = e; }
        }
      }
      if (best) {
        const want = norm(best.x - b.x, best.y - b.y);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx += (want.x * sp - b.vx) * b.homing * dt;
        b.vy += (want.y * sp - b.vy) * b.homing * dt;
        const n = norm(b.vx, b.vy);
        b.vx = n.x * sp; b.vy = n.y * sp;
      }
    } else if (b.homing > 0 && b.from === 'e') {
      let best = null, bd = 520 * 520;
      if (b.targetId) {
        const locked = players.get(b.targetId);
        if (locked?.alive) { best = locked; bd = dist2(locked.x, locked.y, b.x, b.y); }
      }
      if (!best || bd > 720 * 720) {
        best = null; bd = 520 * 520;
        for (const p of players.values()) if (p.alive) {
          const d = dist2(p.x, p.y, b.x, b.y);
          if (d < bd) { bd = d; best = p; }
        }
      }
      if (best) {
        const want = norm(best.x - b.x, best.y - b.y);
        const sp = Math.hypot(b.vx, b.vy) || 240;
        b.vx += (want.x * sp - b.vx) * b.homing * dt;
        b.vy += (want.y * sp - b.vy) * b.homing * dt;
        const n = norm(b.vx, b.vy);
        b.vx = n.x * sp; b.vy = n.y * sp;
      }
    }
    const ox = b.x, oy = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (applyDamperFieldsToBullet(run, b, dt)) continue;
    const moved = Math.hypot(b.x - ox, b.y - oy);
    b.travelled = (b.travelled || 0) + moved;
    if (b.rktMines > 0) {
      b.mineDist = (b.mineDist || 0) + moved;
      if (b.mineDist > 160 && run.bullets.length < MAX_BULLETS) {
        b.mineDist = 0;
        run.bullets.push({ id: nid(), x: b.x, y: b.y, vx: 0, vy: 0, dmg: b.dmg * 0.34, from: 'p', owner: b.owner, life: 1.0 * (b.rangeMul || 1), delay: 0.42, size: 10, aoe: (50 + b.rktMines * 6) * 2, kind: 'mine', mine: true, rangeMul: b.rangeMul || 1, elem: b.elem || '', elemPower: b.elemPower || 0, rktStun: b.rktStun || 0, rktScatter: b.rktScatter || 0, bornTick: run.tick || 0 });
        run.fx.push({ t: 'mine', x: Math.round(b.x), y: Math.round(b.y) });
      }
    }
    if (b.detonateDist && b.travelled >= b.detonateDist) {
      if ((b.kind === 'rocketgun' || b.mine) && b.from === 'p') { rocketExplode(run, players, b, b.x, b.y, b.aoe || 70, b.dmg); rocketAftermath(run, players, b); }
      else explode(run, players, b.x, b.y, b.aoe || 70, b.dmg, b.owner, b.from === 'e', b.from === 'e' ? 'danger' : 'blast', b.elem || '', b.elemPower || 0);
      b.life = -1; continue;
    }
    if (b.maxDist && b.travelled >= b.maxDist) {
      const n = norm(b.vx || 1, b.vy || 0);
      run.fx.push({ t: 'impact', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, range: 1, dx: Math.round(n.x * 80), dy: Math.round(n.y * 80) });
      b.life = -1; continue;
    }
    // walls
    let hitWall = false, hitWallAxis = '', hitWallObj = null;
    for (const w of walls) {
      if (aabbHit(b.x, b.y, b.size / 2, w)) {
        hitWall = true; hitWallObj = w;
        const bh = (b.size || 4) / 2;
        const overlapX = Math.min(b.x + bh - w.x, w.x + w.w - (b.x - bh));
        const overlapY = Math.min(b.y + bh - w.y, w.y + w.h - (b.y - bh));
        hitWallAxis = Math.abs(b.vx || 0) > Math.abs(b.vy || 0) * 1.25 ? 'x' : (Math.abs(b.vy || 0) > Math.abs(b.vx || 0) * 1.25 ? 'y' : (overlapX < overlapY ? 'x' : 'y'));
        break;
      }
    }
    if (hitWall) {
      if (b.bounces > 0) {
        const half = (b.size || 4) / 2 + 0.75;
        if (hitWallAxis === 'x') {
          const fromLeft = ox < hitWallObj.x || (ox <= hitWallObj.x + hitWallObj.w && b.vx > 0);
          b.x = fromLeft ? hitWallObj.x - half : hitWallObj.x + hitWallObj.w + half;
          b.y = oy;
          b.vx *= -0.82;
        } else {
          const fromTop = oy < hitWallObj.y || (oy <= hitWallObj.y + hitWallObj.h && b.vy > 0);
          b.y = fromTop ? hitWallObj.y - half : hitWallObj.y + hitWallObj.h + half;
          b.x = ox;
          b.vy *= -0.82;
        }
        b.bounces--; b.ricocheted = (b.ricocheted || 0) + 1; b.life *= 0.90;
        run.fx.push({ t: 'ricochet', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, rocket: b.kind === 'rocketgun' ? 1 : 0, left: b.bounces, dx: Math.round((b.vx || 0) / 10), dy: Math.round((b.vy || 0) / 10) });
        continue;
      }
      run.fx.push({ t: 'impact', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, wall: 1, dx: Math.round((b.vx || 0) / 10), dy: Math.round((b.vy || 0) / 10) });
      if (b.aoe) { if ((b.kind === 'rocketgun' || b.mine) && b.from === 'p') rocketExplode(run, players, b, b.x, b.y, b.aoe, b.dmg); else explode(run, players, b.x, b.y, b.aoe, b.dmg, b.owner, b.from === 'e', b.from === 'e' ? 'danger' : 'blast', b.elem || '', b.elemPower || 0); if (b.from === 'p') rocketAftermath(run, players, b); }
      b.life = -1; continue;
    }
    if (b.from === 'p') {
      for (const e of run.enemies) {
        if ((e.spawnDelay || 0) > 0) continue;
        if (dist2(e.x, e.y, b.x, b.y) < ((e.size + b.size) / 2 + 4) ** 2) {
          if (b.aoe) { if ((b.kind === 'rocketgun' || b.mine) && b.from === 'p') rocketExplode(run, players, b, b.x, b.y, b.aoe, b.dmg); else explode(run, players, b.x, b.y, b.aoe, b.dmg, b.owner, b.from === 'e', b.from === 'e' ? 'danger' : 'blast', b.elem || '', b.elemPower || 0); if (b.from === 'p') rocketAftermath(run, players, b); }
          else {
            const n = norm(b.vx, b.vy);
            run.fx.push({ t: 'impact', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, dx: Math.round(n.x * 100), dy: Math.round(n.y * 100) });
            applyBulletElements(run, players, e, b, 1);
            let hitDmg = b.dmg;
            const redOwner = b.owner ? players.get(b.owner) : null;
            if (redOwner && (redOwner.redOverdriveShots || 0) > 0 && playerSigStack(redOwner, 'sigRedOverdrive') > 0) {
              hitDmg *= 1.20 + Math.min(0.18, playerSigStack(redOwner, 'sigRedOverdrive') * 0.04);
              redOwner.redOverdriveShots = Math.max(0, (redOwner.redOverdriveShots || 0) - 1);
              run.fx.push({ t: 'active_mutation', label: 'RED OVERDRIVE', x: Math.round(b.x), y: Math.round(b.y), r: 84, tone: 'red', owner: redOwner.id });
            }
            damageEnemy(run, players, e, hitDmg, b.owner, b.knock, n.x, n.y, comboSourceFromBullet(b));
            applyWeaponChain(run, players, e, b);
            if (b.sekSplit > 0) spawnSeekerFragments(run, b.owner, b.x, b.y, b.sekSplit, b.dmg * 0.48, { rangeMul: b.rangeMul || 1, bounces: b.bounces || 0, elem: b.elem || '', elemPower: b.elemPower || 0 });
            const blasts = chanceStacks(b.proc || 0);
            for (let bi = 0; bi < blasts; bi++) explode(run, players, b.x, b.y, 70, b.dmg * 0.8, b.owner, false, 'proc');
          }
          b.life = -1; break;
        }
      }
    } else {
      for (const p of players.values()) {
        if (p.alive && dist2(p.x, p.y, b.x, b.y) < ((PLAYER_SIZE + b.size) / 2 + 2) ** 2) {
          if (b.aoe) explode(run, players, b.x, b.y, b.aoe, b.dmg, null, true, b.kind === 'rocketgun' ? 'danger' : 'blast');
          else damagePlayer(run, p, b.dmg, b.x, b.y, { enemyBullet: true });
          b.life = -1; break;
        }
      }
    }
  }
  run.bullets = run.bullets.filter(b => b.life > 0);
}
// ---------------------------------------------------------------- enemies
function blackBoxFieldForPlayer(run, p) {
  if (!run?.activeFields || !p?.alive) return null;
  let best = null;
  for (const f of run.activeFields) {
    if (f.kind !== 'black_box' || f.owner !== p.id || f.ttl <= 0) continue;
    if (!best || (f.ttl || 0) > (best.ttl || 0)) best = f;
  }
  return best;
}
function playerHiddenFromEnemy(run, p, ex, ey) {
  const f = blackBoxFieldForPlayer(run, p);
  if (!f) return false;
  // BLACK BOX is stealth, not a global freeze: enemies outside the box lose this player as a valid target.
  // Enemies that already got inside the box can still stumble into danger, so the zone is a rescue window, not invincibility.
  const r = (f.r || 0) + 18;
  return dist2(ex, ey, f.x ?? p.x, f.y ?? p.y) > r * r;
}
function nearestAlive(players, x, y, run = null) {
  let best = null, bd = Infinity;
  for (const p of players.values()) {
    if (!p.alive) continue;
    if (run && playerHiddenFromEnemy(run, p, x, y)) continue;
    const d = dist2(p.x, p.y, x, y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function stepEnemies(run, players, dt) {
  if (run.phase !== 'play') return;
  sanitizeEnemiesForRoom(run, players, dt);
  const walls = run.plan.walls;
  stepEnemySynergies(run, players, dt);
  for (const e of [...run.enemies]) {
    const def = ENEMIES[e.kind];
    if ((e.spawnDelay || 0) > 0) {
      e.spawnDelay = Math.max(0, (e.spawnDelay || 0) - dt);
      e.st = 0;
      e.fireCd = Math.max(e.fireCd || 0, 0.16);
      continue;
    }
    if ((e.frozenT || 0) > 0 || (e.stunT || 0) > 0) {
      if (typeof e.vx === 'number') e.vx *= Math.pow(0.02, dt * 8);
      if (typeof e.vy === 'number') e.vy *= Math.pow(0.02, dt * 8);
      e.fireCd = Math.max(e.fireCd || 0, 0.12);
      // Frozen/stunned means no movement, no firing, no windup progress and no contact damage.
      continue;
    }
    const target = nearestAlive(players, e.x, e.y, run);
    e.st += dt;
    const half = e.size / 2;
    const spd = enemySpeed(e);

    if (e.kind === 'bouncer') {
      let nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      for (const w of walls) {
        if (aabbHit(nx, e.y, half, w)) { e.vx *= -1; nx = e.x; }
        if (aabbHit(e.x, ny, half, w)) { e.vy *= -1; ny = e.y; }
      }
      e.x = nx; e.y = ny;
      if (!e.touchCds) e.touchCds = new Map();
      for (const [k, v] of e.touchCds) { const nv = v - dt; if (nv <= 0) e.touchCds.delete(k); else e.touchCds.set(k, nv); }
      for (const p of players.values()) {
        if (!p.alive || playerHiddenFromEnemy(run, p, e.x, e.y)) continue;
        const sep = resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 10, playerKick: def.push * 0.10, fx: true });
        if (sep) {
          if (!e.touchCds.has(p.id)) { damagePlayer(run, p, enemyDamageValue(e), e.x, e.y); e.touchCds.set(p.id, TOUCH_CD * 0.55); }
          e.vx = -sep.nx * def.spd; e.vy = -sep.ny * def.spd;
        }
      }
      continue;
    }

    if (!target) continue;
    const toT = norm(target.x - e.x, target.y - e.y);
    const dT = Math.hypot(target.x - e.x, target.y - e.y);

    if (e.kind === 'shooter') {
      const inFormation = escortOrbitMove(run, e, dt, spd, target);
      let mv = 0;
      if (!inFormation) {
        if (dT > def.keep + 40) mv = 1; else if (dT < def.keep - 60) mv = -1;
        if (mv !== 0) { steerMove(run, e, { x: toT.x * mv, y: toT.y * mv }, spd, dt, { target }); }
      }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const bspd = enemyBulletSpeed(def.bulletSpd, e);
        run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: toT.x * bspd, vy: toT.y * bspd, dmg: enemyDamageValue(e), from: 'e', life: 2.6, size: 7 });
        run.fx.push({ t: 'eshot', id: e.id });
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'charger') {
      if (e.state === 'move') {
        if (dT < 300) { e.state = 'windup'; e.st = 0; e.dirX = toT.x; e.dirY = toT.y; }
        else { steerMove(run, e, toT, spd, dt, { target }); }
      } else if (e.state === 'windup') {
        e.dirX = toT.x; e.dirY = toT.y;
        if (e.st >= def.windup) { e.state = 'charge'; e.st = 0; }
      } else if (e.state === 'charge') {
        const c = collideWalls(e.x + e.dirX * def.chargeSpd * dt, e.y + e.dirY * def.chargeSpd * dt, half, walls, e.x, e.y);
        const blocked = (c.x === e.x && c.y === e.y); e.x = c.x; e.y = c.y;
        for (const p of players.values()) if (p.alive) {
          const sep = resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 10, playerKick: 16, fx: true });
          if (sep) { damagePlayer(run, p, enemyDamageValue(e), e.x, e.y); e.state = 'cool'; e.st = 0; }
        }
        if (e.st >= def.chargeTime || blocked) { e.state = 'cool'; e.st = 0; }
      } else if (e.state === 'cool') { if (e.st >= def.chargeCd) { e.state = 'move'; e.st = 0; } }
    } else if (e.kind === 'bomber') {
      if (e.state === 'move') {
        steerMove(run, e, toT, spd, dt, { target });
        if (dT < 80) { e.state = 'fuse'; e.st = 0; run.fx.push({ t: 'fuse', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: def.blast, dur: def.fuse }); }
      } else if (e.state === 'fuse') {
        if (e.st >= def.fuse) {
          explode(run, players, e.x, e.y, def.blast, e.dmg, null, true, 'danger');
          run.enemies = run.enemies.filter(x => x.id !== e.id); run.kills++;
          run.fx.push({ t: 'kill', x: Math.round(e.x), y: Math.round(e.y), kind: e.kind, elite: e.elite, size: e.size });
          dropPickup(run, e.x, e.y, 'GLD', Math.round(def.gld * scaling(run) * 0.6 * mobLootMul(run))); dropPickup(run, e.x + 10, e.y, 'EXP', Math.max(1, Math.round(def.xp * (1 + (mobLootMul(run) - 1) * 0.45))));
          if (quotaCanOpenPortal(run)) openPortal(run);
        }
      }
    } else if (e.kind === 'glitch') {
      if (e.state === 'move') {
        steerMove(run, e, toT, spd, dt, { target });
        if (e.st >= def.blinkCd && dT < 600) {
          const a = Math.random() * Math.PI * 2; const bx = target.x + Math.cos(a) * 90, by = target.y + Math.sin(a) * 90;
          run.fx.push({ t: 'blink', id: e.id, fx: Math.round(e.x), fy: Math.round(e.y), tx: Math.round(bx), ty: Math.round(by) });
          e.x = bx; e.y = by; e.state = 'strike'; e.st = 0;
        }
      } else if (e.state === 'strike') {
        if (e.st >= def.strikeCd) { if (dT < 75) damagePlayer(run, target, enemyDamageValue(e), e.x, e.y); run.fx.push({ t: 'gstrike', x: Math.round(e.x), y: Math.round(e.y) }); e.state = 'move'; e.st = 0; }
      }
    } else if (e.kind === 'echo') {
      const wid = playerWeaponId(target);
      const keep = wid === 'rocketgun' ? 410 : (wid === 'seeker' ? 360 : 300);
      let mv = dT > keep ? 0.92 : dT < keep * 0.70 ? -0.88 : 0.12;
      const side = { x: -toT.y * 0.24, y: toT.x * 0.24 };
      if (mv !== 0 || Math.abs(side.x) + Math.abs(side.y) > 0) { steerMove(run, e, { x: toT.x * mv + side.x, y: toT.y * mv + side.y }, spd * 0.92, dt, { target }); }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS) {
        e.fireCd = echoMimicCooldown(wid, def, e);
        fireEchoMimicShot(run, players, e, target, toT, def);
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'orbiter') {
      e.phase += dt * 1.15;
      const desired = { x: target.x + Math.cos(e.phase) * def.orbitR, y: target.y + Math.sin(e.phase) * def.orbitR };
      const mv = norm(desired.x - e.x, desired.y - e.y);
      steerMove(run, e, mv, spd, dt, { target: desired });
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const bspd = enemyBulletSpeed(def.bulletSpd, e);
        run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: toT.x * bspd, vy: toT.y * bspd, dmg: enemyDamageValue(e), from: 'e', life: 2.1, size: 6 });
      }
      e.dirX = toT.x; e.dirY = toT.y;
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'damper') {
      // v2.1: DMP is no longer a static turret. It slowly walks the nest toward the player,
      // while keeping enough distance to remain a protection core instead of a body-blocker.
      const protectedNest = run.enemies.some(o => o && o.hp > 0 && o.id !== e.id && (o.dmpNestT || 0) > 0 && dist2(o.x, o.y, e.x, e.y) < (def.fieldR + 210) ** 2);
      const desired = protectedNest ? 0.00 : (dT > 620 ? 0.28 : dT < 360 ? -0.14 : 0.00);
      const side = { x: -toT.y * (protectedNest ? 0.015 : 0.035), y: toT.x * (protectedNest ? 0.015 : 0.035) };
      const drift = { x: toT.x * desired + side.x, y: toT.y * desired + side.y };
      if (Math.abs(drift.x) + Math.abs(drift.y) > 0.02) steerMove(run, e, drift, spd * (desired < 0 ? 0.30 : 0.34), dt, { target });
      e.dirX = toT.x; e.dirY = toT.y;
      e.fxT = (e.fxT || 0) - dt;
      if (e.fxT <= 0) {
        e.fxT = 0.18;
        run.fx.push({ t: 'damper_field', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: def.fieldR });
      }
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'anchor') {
      steerMove(run, e, toT, spd, dt, { target });
      for (const p of players.values()) {
        if (!p.alive) continue;
        const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
        if (d < def.fieldR) {
          p.slowT = 0.18; p.slowMul = 0.56;
          const n = norm(e.x - p.x, e.y - p.y);
          const cc = collideWalls(p.x + n.x * def.pull * dt, p.y + n.y * def.pull * dt, PLAYER_SIZE / 2, walls, p.x, p.y); p.x = cc.x; p.y = cc.y;
        }
      }
      for (const pk of [...run.pickups]) {
        if (dist2(pk.x, pk.y, e.x, e.y) < (def.fieldR + 90) ** 2) {
          const n = norm(e.x - pk.x, e.y - pk.y); pk.x += n.x * 180 * dt; pk.y += n.y * 180 * dt;
          if (dist2(pk.x, pk.y, e.x, e.y) < (e.size * 0.7) ** 2) { run.pickups = run.pickups.filter(x => x !== pk); run.fx.push({ t: 'consume', x: Math.round(e.x), y: Math.round(e.y) }); }
        }
      }
      e.fxT = (e.fxT || 0) - dt;
      if (e.fxT <= 0) { e.fxT = 0.22; run.fx.push({ t: 'field', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: def.fieldR }); }
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'splitter') {
      steerMove(run, e, toT, spd, dt, { target });
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'prism') {
      const inFormation = escortOrbitMove(run, e, dt, spd, target);
      let mv = dT > 360 ? 1 : dT < 260 ? -1 : 0;
      if (!inFormation && mv !== 0) { steerMove(run, e, { x: toT.x * mv, y: toT.y * mv }, spd, dt, { target }); }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS - 3) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const base = Math.atan2(toT.y, toT.x);
        const bspd = enemyBulletSpeed(def.beamSpd, e);
        for (const da of [-0.34, 0, 0.34]) run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(base + da) * bspd, vy: Math.sin(base + da) * bspd, dmg: enemyDamageValue(e), from: 'e', life: 2.3, size: 5 });
        run.fx.push({ t: 'prism', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'pulse') {
      const inFormation = escortOrbitMove(run, e, dt, spd, target);
      if (!inFormation) steerMove(run, e, toT, spd, dt, { target });
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS - 5) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const nx = -toT.y, ny = toT.x;
        const wspd = enemyBulletSpeed(def.waveSpd, e);
        for (let i = -2; i <= 2; i++) run.bullets.push({ id: nid(), x: e.x + nx * i * 18, y: e.y + ny * i * 18, vx: toT.x * wspd, vy: toT.y * wspd, dmg: enemyDamageValue(e), from: 'e', life: 1.4, size: 9 });
        run.fx.push({ t: 'pulse_wave', id: e.id, x: Math.round(e.x), y: Math.round(e.y), dx: toT.x, dy: toT.y });
      }
      e.dirX = toT.x; e.dirY = toT.y;
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'leech') {
      let ally = null, missing = 0;
      for (const a of run.enemies) {
        if (a.id === e.id || a.hp >= a.maxHp) continue;
        const miss = a.maxHp - a.hp;
        if (miss > missing && dist2(a.x, a.y, e.x, e.y) < def.linkR * def.linkR) { ally = a; missing = miss; }
      }
      if (ally) {
        const toA = norm(ally.x - e.x, ally.y - e.y);
        const dd = Math.hypot(ally.x - e.x, ally.y - e.y);
        if (dd > 170) { steerMove(run, e, toA, spd, dt, { target: ally }); }
        e.healCd -= dt;
        e.fxT = (e.fxT || 0) - dt;
        if (e.fxT <= 0) { e.fxT = 0.18; run.fx.push({ t: 'leech_link', id: e.id, target: ally.id, x: Math.round(e.x), y: Math.round(e.y), x2: Math.round(ally.x), y2: Math.round(ally.y) }); }
        if (e.healCd <= 0) { e.healCd = def.healCd; ally.hp = Math.min(ally.maxHp, ally.hp + def.heal); ally.leechLinkT = Math.max(ally.leechLinkT || 0, 1.4); run.fx.push({ t: 'heal_enemy', x: Math.round(ally.x), y: Math.round(ally.y), val: def.heal }); }
      } else {
        steerMove(run, e, toT, spd, dt, { target });
        touchDamage(run, e, players, dt);
      }
    } else if (e.kind === 'herald') {
      const keep = 420;
      e.summonCd -= dt;
      e.fxT = (e.fxT || 0) - dt;
      if ((e.summonWindT || 0) > 0) {
        e.state = 'cast';
        e.summonWindT -= dt;
        const maxT = e.summonWindMax || 1.12;
        const pfill = clamp(1 - Math.max(0, e.summonWindT) / maxT, 0, 1);
        const aim = { x: e.heraldAimX, y: e.heraldAimY, id: target.id, alive: target.alive };
        if (!Number.isFinite(aim.x) || !Number.isFinite(aim.y)) {
          const a0 = heraldUpdateAimPoint(run, e, target, dt, true);
          e.heraldCastSeed = ((Math.random() * 0x7fffffff) >>> 0) ^ ((run.tick || 0) * 2654435761);
          e.heraldFloorPath = buildHeraldFloorPath(run, e, a0, e.heraldCastSeed);
          aim.x = a0.x; aim.y = a0.y; aim.alive = a0.alive;
        }
        if (e.fxT <= 0) {
          e.fxT = 0.055;
          const pts = Array.isArray(e.heraldFloorPath) ? e.heraldFloorPath : buildHeraldFloorPath(run, e, aim, e.heraldCastSeed || 0);
          run.fx.push({ t: 'herald_cast', id: e.id, target: target.id, x: Math.round(e.x), y: Math.round(e.y), x2: Math.round(aim.x), y2: Math.round(aim.y), points: pts, seed: e.heraldCastSeed || 0, p: Math.round(pfill * 100), dur: maxT });
        }
        if (e.summonWindT <= 0) {
          finishHeraldSummon(run, players, e, aim);
          e.summonCd = Math.max(2.4, def.summonCd + 0.35 - difficulty(run).loop * 0.18);
          e.fxT = 0; e.heraldAimX = NaN; e.heraldAimY = NaN; e.heraldFloorPath = null; e.heraldCastSeed = 0;
        }
      } else {
        if (e.state === 'cast') e.state = 'move';
        let movedByNest = false;
        const nest = e.preferredNestId ? run.enemies.find(n => n.id === e.preferredNestId && n.hp > 0) : null;
        if (nest) {
          const nd = Math.hypot(nest.x - e.x, nest.y - e.y);
          const dmpR = Math.max(170, (ENEMIES.damper?.fieldR || 280) - 64);
          const desired = { x: nest.x + Math.cos((run.now || 0) * 0.30 + (parseInt(e.id, 36) || 1)) * dmpR * 0.46, y: nest.y + Math.sin((run.now || 0) * 0.30 + (parseInt(e.id, 36) || 1)) * dmpR * 0.34 };
          if (nd > dmpR || nd < 92) { steerMove(run, e, norm(desired.x - e.x, desired.y - e.y), spd * 0.72, dt, { target: desired }); movedByNest = true; }
        }
        const mv = dT > keep ? 1 : dT < keep - 120 ? -0.7 : 0;
        if (!movedByNest && mv !== 0) { steerMove(run, e, { x: toT.x * mv, y: toT.y * mv }, spd, dt, { target }); }
        if (e.summonCd <= 0 && run.enemies.length < difficulty(run).maxActive && dT < 760) {
          e.summonWindMax = 1.20;
          e.summonWindT = e.summonWindMax;
          e.fxT = 0;
          const aim = heraldUpdateAimPoint(run, e, target, dt, true);
          e.heraldCastSeed = ((Math.random() * 0x7fffffff) >>> 0) ^ ((run.tick || 0) * 2654435761) ^ (parseInt(String(e.id || '1'), 36) || 1);
          e.heraldFloorPath = buildHeraldFloorPath(run, e, aim, e.heraldCastSeed);
          run.fx.push({ t: 'herald_cast', id: e.id, target: target.id, x: Math.round(e.x), y: Math.round(e.y), x2: Math.round(aim.x), y2: Math.round(aim.y), points: e.heraldFloorPath, seed: e.heraldCastSeed, p: 0, dur: e.summonWindMax, start: 1 });
        }
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (isBossKind(e.kind)) {
      stepBossEnemy(run, players, e, def, target, toT, dT, spd, dt, walls);
    } else {
      steerMove(run, e, toT, spd, dt, { target });
      touchDamage(run, e, players, dt);
    }
  }
  // Anti-zator pass: enemies should surround/flow, not stack into one blocked clump.
  resolveEnemyCrowd(run, walls, dt);
  // Safety pass: even ranged/non-touch enemies must never remain inside a player.
  resolveEnemyPlayerBodies(run, players, walls);
  sanitizeEnemiesForRoom(run, players, dt);
}

function touchDamage(run, e, players, dt) {
  if ((e.stunT || 0) > 0 || (e.frozenT || 0) > 0) return;
  const walls = run.plan?.walls || [];
  if (!e.touchCds) e.touchCds = new Map();
  for (const p of players.values()) {
    if (!p.alive || playerHiddenFromEnemy(run, p, e.x, e.y)) continue;
    const key = p.id;
    const sep = resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 9, playerKick: 6, fx: true });
    const cd = e.touchCds.get(key) || 0;
    if (cd > 0) {
      const nv = cd - dt;
      if (nv <= 0) e.touchCds.delete(key); else e.touchCds.set(key, nv);
      continue;
    }
    if (sep) {
      damagePlayer(run, p, enemyDamageValue(e), e.x, e.y);
      e.touchCds.set(key, TOUCH_CD);
    }
  }
}

// ---------------------------------------------------------------- companions
// drones/orbitals: positions derived deterministically from player pos + time
export function orbitalPos(p, i, total, now, run = null) {
  const count = Math.max(1, total || 1);
  const phase = (i / count) * Math.PI * 2;
  const spin = now * (1.72 + Math.min(0.42, Math.max(0, p?.stats?.orbSpeed || 0) * 0.035));
  const ang = spin + phase;
  const ring = Math.floor(i / 8);
  const r = 64 + 16 * ring + Math.sin(now * 2.15 + phase * 1.7) * 4.5;
  const radial = { x: Math.cos(ang), y: Math.sin(ang) };
  const tangent = { x: -radial.y, y: radial.x };
  const base = { x: p.x + radial.x * r, y: p.y + radial.y * r };
  if (!run || !(p?.stats?.orbitals > 0)) return base;

  const rangeBonus = Math.max(0, p.stats.orbRange || 0);
  const speedBonus = Math.max(0, p.stats.orbSpeed || 0);
  const enemyRange = 176 + rangeBonus * 48;
  const bulletRange = (p.stats.orbReflect || 0) > 0 ? 74 + rangeBonus * 20 + (p.stats.orbReflect || 0) * 12 : 0;
  let target = null, bd = Infinity, bulletTarget = false;

  // v2.1.24: orbitals are "endless SEEKER shots" first, bullet reflectors second.
  // They always prefer a living enemy over a bullet so reflection never makes them ignore damage duty.
  for (const e of run.enemies || []) {
    if (!e || e.hp <= 0) continue;
    const d = dist2(e.x, e.y, base.x, base.y);
    if (d < bd && d <= enemyRange * enemyRange) { bd = d; target = e; bulletTarget = false; }
  }

  if (!target && bulletRange > 0) {
    for (const b of run.bullets || []) {
      if (b.from !== 'e' || (b.delay || 0) > 0 || b.life <= 0) continue;
      const d = dist2(b.x, b.y, base.x, base.y);
      if (d < bd && d <= bulletRange * bulletRange) { bd = d; target = b; bulletTarget = true; }
    }
  }

  if (!target) return base;

  const d = Math.max(1, Math.sqrt(bd));
  const range = bulletTarget ? bulletRange : enemyRange;
  const influence = Math.max(0, Math.min(1, 1 - d / Math.max(1, range)));
  const skimDir = ((i + Math.floor(now * 0.85)) % 2 === 0) ? 1 : -1;

  if (bulletTarget) {
    // Reflect only when no enemy needs the orbital. It cuts toward the bullet briefly, then returns.
    const cut = Math.pow(influence, 1.35);
    return {
      x: base.x + (target.x - base.x) * (0.22 + cut * 0.30) + tangent.x * skimDir * cut * 5,
      y: base.y + (target.y - base.y) * (0.22 + cut * 0.30) + tangent.y * skimDir * cut * 5
    };
  }

  // Enemy seeking: like a SEEKER projectile that never expires. It dives through a target,
  // then the base orbit pulls it back around for another pass.
  const seek = 0.34 + Math.pow(influence, 0.70) * (0.54 + speedBonus * 0.018);
  const wobble = Math.sin(now * (6.0 + speedBonus * 0.18) + phase) * (4.5 + speedBonus * 0.7) * influence;
  const pass = Math.cos(now * (4.1 + speedBonus * 0.12) + phase) * 3.5 * influence;
  return {
    x: base.x + (target.x - base.x) * Math.min(0.92, seek) + tangent.x * wobble + radial.x * pass,
    y: base.y + (target.y - base.y) * Math.min(0.92, seek) + tangent.y * wobble + radial.y * pass
  };
}
function stepCompanions(run, players, dt, now) {
  for (const p of players.values()) {
    if (!p.alive) continue;
    // drones: auto-fire nearest enemy
    if (p.stats.drones > 0) {
      p.droneCd -= dt;
      if (p.droneCd <= 0 && run.enemies.length && run.bullets.length < MAX_BULLETS) {
        p.droneCd = Math.max(0.18, 0.8 / Math.sqrt(p.stats.drones));
        let best = null, bd = 480 * 480;
        for (const e of run.enemies) {
          const d = dist2(e.x, e.y, p.x, p.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const di = Math.floor(Math.random() * p.stats.drones);
          const dp = orbitalPos(p, di, Math.max(1, p.stats.drones), now + 100);
          const n = norm(best.x - dp.x, best.y - dp.y);
          const elem = bulletElementString(p, 'drone');
          const elemPower = bulletElementPower(p, 'drone');
          run.bullets.push({ id: nid(), x: dp.x, y: dp.y, vx: n.x * 520, vy: n.y * 520, dmg: weaponDamageValue(p, 8), from: 'p', owner: p.id, life: 1.1 * (p.stats.bulletRange || 1), size: 4, proc: p.stats.droneProc ? Math.min(0.9, p.stats.procBlast * 0.55 + p.stats.droneProc * 0.10) : 0, kind: 'drone', travelled: 0, maxDist: Math.round(570 * (p.stats.bulletRange || 1)), bounces: p.stats.bulletBounce || 0, rangeMul: p.stats.bulletRange || 1, elem, elemPower });
        }
      }
    }
    // orbitals: contact damage with per-enemy cooldown
    if (false && p.stats.orbitals > 0) {
      for (const [k, v] of p.orbHits) { if (v <= now) p.orbHits.delete(k); }
      for (let i = 0; i < p.stats.orbitals; i++) {
        const op = orbitalPos(p, i, p.stats.orbitals, now, run);
        if (p.stats.orbReflect > 0) {
          for (const b of [...run.bullets]) {
            if (b.from === 'e' && dist2(b.x, b.y, op.x, op.y) < (24 + p.stats.orbReflect * 8 + Math.max(0, p.stats.orbRange || 0) * 5) ** 2) {
              run.bullets = run.bullets.filter(x => x !== b);
              run.fx.push({ t: 'bullet_cut', id: p.id, x: Math.round(op.x), y: Math.round(op.y), count: 1 });
            }
          }
        }
        for (const e of run.enemies) {
          if (p.orbHits.has(e.id)) continue;
          if (dist2(e.x, e.y, op.x, op.y) < ((e.size / 2) + 16 + Math.max(0, p.stats.orbRange || 0) * 2) ** 2) {
            damageEnemy(run, players, e, (18 + Math.max(0, p.stats.orbSpeed || 0) * 3) * p.stats.dmgMul, p.id, 0, 0, 0, 'orbital');
            p.orbHits.set(e.id, now + 0.28);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- pickups
function stepPickups(run, players, dt) {
  for (const pk of [...run.pickups]) {
    let best = null, bd = Infinity;
    for (const p of players.values()) {
      if (!p.alive) continue;
      if (pk.owner && pk.owner !== p.id) continue;
      const d = dist2(p.x, p.y, pk.x, pk.y);
      const magnet = PICKUP_BASE_MAGNET * p.stats.magnetMul;
      if (d < magnet * magnet && d < bd) { bd = d; best = p; }
    }
    if (best) {
      const n = norm(best.x - pk.x, best.y - pk.y);
      const pull = 340 * dt;
      pk.x += n.x * pull; pk.y += n.y * pull;
      if (dist2(best.x, best.y, pk.x, pk.y) < PICKUP_COLLECT * PICKUP_COLLECT) {
        run.pickups = run.pickups.filter(x => x.id !== pk.id);
        grantPickupEconomy(run, players, best, pk.type, pk.val, pk);
        if (!pk.personal) run.fx.push({ t: 'pick', id: best.id, name: best.name || '', type: pk.type, val: pk.val, x: Math.round(pk.x), y: Math.round(pk.y), team: (pk.type === 'GLD' || pk.type === 'EXP') ? 1 : 0 });
      }
    }
  }
}


function spawnHunterWave(run, players) {
  const hw = run.hunterWave;
  if (!hw || hw.done || hw.index >= hw.total) return 0;
  hw.index += 1;
  const wave = hw.index;
  const df = difficulty(run);
  const requested = wave <= 1
    ? ['grunt','runner','runner']
    : wave === 2
      ? ['runner','shooter','charger','bouncer']
      : ['runner','shooter','charger','bouncer','glitch','tank','pulse','leech','herald'];
  const pool = filterModifierEnemyPool(run, requested, ['grunt','runner','shooter','charger']);
  const count = Math.min(16, 4 + wave * 2 + Math.floor((run.runDepth || 0) / 3));
  const hunterForm = wave <= 1 ? 'stream' : (wave === 2 ? 'pinch' : (wave % 2 ? 'fan' : 'ring'));
  const layout = createCrowdLayout(run, players, { id: 'hunter_wave', intent: 'swarm', crowdForm: hunterForm }, count, { mode: 'hunter', allowSecondary: df.loop >= 3, forceSecondary: df.loop >= 6 && wave >= 3 });
  const center = layout.center || spawnClusterPoint(run, players);
  for (let i = 0; i < count && run.enemies.length < df.maxActive; i++) {
    const kind = pool[Math.floor(Math.random() * pool.length)] || 'grunt';
    const pos = crowdSpawnPos(run, players, layout, i, count, { kind, opts: { noArmor: wave <= 1 || df.loop <= 0 } });
    const canElite = df.loop > 0 && wave >= 2 && Math.random() < Math.min(0.85, 0.12 * wave + df.loop * 0.04);
    const e = spawnEnemy(run, players, kind, canElite, pos, { noArmor: wave <= 1 || df.loop <= 0 });
    e.hunterWave = wave;
    e.rallyT = Math.max(e.rallyT || 0, 1.1);
  }
  if (run.roomStats) run.roomStats.huntedWaves = Math.max(run.roomStats.huntedWaves || 0, wave);
  run.fx.push({ t: 'director_wave', label: `HUNTER WAVE ${wave}/${hw.total}`, intent: 'director', x: Math.round(center.x), y: Math.round(center.y), count });
  return count;
}
function stepHunterWaves(run, players, dt) {
  if (!hasMod(run, 'hunter_contract') || !run.hunterWave || run.portal.open) return;
  const hw = run.hunterWave;
  if (run.enemies.length <= 0) {
    if (hw.index >= hw.total) {
      hw.done = true;
      run.fx.push({ t: 'contract_done', label: 'HUNTER WAVES', body: 'ALL WAVES CLEAR' });
      openPortal(run);
      return;
    }
    hw.waiting = Math.max(0, (hw.waiting || 0) - dt);
    if (hw.waiting <= 0) {
      spawnHunterWave(run, players);
      hw.waiting = Math.max(1.8, 4.4 - Math.min(1.8, hw.index * 0.35));
    }
  }
}
function casinoVirusSymbols(label = '') {
  const l = String(label || '').toUpperCase();
  if (l.includes('BIG STATIC')) return ['BIG', 'RAIN', 'LVL5'];
  if (l.includes('STATIC')) return ['STC', 'RAIN', 'LVL2'];
  if (l.includes('ELITE')) return ['ELT', 'PACK', 'RED'];
  if (l.includes('BOSS')) return ['HER', 'BOSS', 'BAD'];
  if (l.includes('JACKPOT')) return ['GLD', 'GLD', 'PAY'];
  return ['MOB', 'PACK', 'BAD'];
}
function buildCasinoVirusEvent(run, players) {
  const roll = Math.random();
  const center = spawnClusterPoint(run, players);
  const df = difficulty(run);
  const loop = df.loop;
  const mobPool = filterModifierEnemyPool(run, ['runner','glitch','bouncer','shooter','charger'], ['grunt','runner','shooter']);
  const elitePool = filterModifierEnemyPool(run, ['tank','charger','leech','warden','damper','prism'], ['runner','shooter','charger','bomber']);
  const mobN = Math.min(10, 4 + Math.floor(Math.random() * 4) + Math.floor((run.runDepth || 0) / 5));

  if (loop <= 0) {
    if (roll < 0.46) return { kind: 'mob_pack', label: 'VIRUS MOB PACK', center, n: mobN, pool: mobPool };
    if (roll < 0.72) return { kind: 'static', label: 'VIRUS STATIC STORM', center, stacks: 1 };
    if (roll < 0.90) return { kind: 'elite_pack', label: 'VIRUS GUARD PACK', center, n: 2 + Math.floor(Math.random() * 2), pool: elitePool };
    return { kind: 'jackpot', label: 'VIRUS SLOT JACKPOT', center, n: 5 };
  }
  if (loop === 1) {
    if (roll < 0.34) return { kind: 'mob_pack', label: 'VIRUS MOB PACK', center, n: mobN, pool: mobPool };
    if (roll < 0.58) return { kind: 'static', label: 'VIRUS STATIC STORM', center, stacks: 2 };
    if (roll < 0.82) return { kind: 'elite_pack', label: 'VIRUS ELITE PACK', center, n: 2 + Math.floor(Math.random() * 3), pool: elitePool };
    return { kind: 'jackpot', label: 'VIRUS SLOT JACKPOT', center, n: 6 };
  }
  if (roll < 0.26) return { kind: 'mob_pack', label: 'VIRUS MOB PACK', center, n: mobN + Math.min(3, loop), pool: mobPool };
  if (roll < 0.48) return { kind: 'static', label: 'VIRUS STATIC STORM', center, stacks: Math.min(3, 2 + Math.floor(loop / 4)) };
  if (roll < 0.66) return { kind: 'big_static', label: 'BIG STATIC STORM', center, stacks: Math.min(STATIC_RAIN_MAX_LEVEL, 4 + Math.floor(loop / 2)) };
  if (roll < 0.84) return { kind: 'elite_pack', label: 'VIRUS ELITE PACK', center, n: 3 + Math.floor(Math.random() * 3) + Math.min(2, df.late), pool: elitePool };
  if (roll < 0.94 && loop >= 3) return { kind: 'mini_boss', label: 'VIRUS MINI BOSS', center };
  return { kind: 'jackpot', label: 'VIRUS SLOT JACKPOT', center, n: 6 + Math.min(4, loop) };
}

function safeRunNow(run) {
  const n = Number(run?.now);
  return Number.isFinite(n) ? n : 0;
}

function scheduleCasinoVirusEvent(run, players) {
  const cv = run.casinoVirus;
  if (!cv || cv.spinsLeft <= 0 || cv.pendingEvent) return;
  cv.spinsLeft -= 1;
  const ev = buildCasinoVirusEvent(run, players);
  const symbols = casinoVirusSymbols(ev.label);
  cv.lastLabel = ev.label;
  cv.lastSymbols = symbols;
  cv.spinSeq = (cv.spinSeq || 0) + 1;
  const now = safeRunNow(run);
  cv.pendingEvent = { ...ev, symbols, applyAt: now + 1.45 };
  cv.nextSpin = 0;
  // The outcome is visible now, but its gameplay effect is delayed until the reels stop.
  run.fx.push({ t: 'casino_virus_spin', label: ev.label, symbols, spinsLeft: cv.spinsLeft, nextSpin: 0, seq: cv.spinSeq, x: Math.round(ev.center.x), y: Math.round(ev.center.y), rainStacks: cv.activeRainStacks || 0, rainKind: cv.rainKind || '', pending: 1 });
}
function applyCasinoVirusEvent(run, players, ev) {
  if (!ev) return 0;
  const cv = run.casinoVirus || {};
  const center = ev.center || spawnClusterPoint(run, players);
  const df = difficulty(run);
  let spawned = 0;
  if (ev.kind === 'mob_pack' || ev.kind === 'elite_pack') {
    const n = Math.max(1, ev.n | 0);
    const pool = filterModifierEnemyPool(run, Array.isArray(ev.pool) && ev.pool.length ? ev.pool : ['runner','glitch','bouncer','shooter','charger'], ['grunt','runner','shooter']);
    const form = ev.kind === 'mob_pack' ? 'cloud' : (ev.kind === 'elite_pack' ? 'fan' : 'ring');
    const layout = createCrowdLayout(run, players, { id: 'casino_virus_event', intent: 'chaos', crowdForm: form }, n, { mode: 'casino', allowSecondary: df.loop >= 3 });
    center.x = layout.center.x; center.y = layout.center.y;
    for (let i = 0; i < n && run.enemies.length < MAX_ENEMIES; i++) {
      const kind = pool[Math.floor(Math.random() * pool.length)] || 'grunt';
      const noArmor = (ev.kind === 'mob_pack' && i < 2) || df.loop <= 0;
      const canElite = df.loop > 0 && (ev.kind === 'elite_pack' || i > 3);
      const pos = crowdSpawnPos(run, players, layout, i, n, { kind, opts: { noArmor } });
      const e = spawnEnemy(run, players, kind, canElite, pos, { noArmor });
      if (e) { e.virusSpawn = true; spawned++; }
    }
    run.fx.push({ t: 'director_wave', label: ev.label, intent: 'chaos', x: Math.round(center.x), y: Math.round(center.y), count: spawned });
  } else if (ev.kind === 'static' || ev.kind === 'big_static') {
    if (!(cv.activeRainStacks > 0)) cv.rainT = ev.kind === 'big_static' ? 0.12 : 0.18;
    cv.activeRainStacks = Math.max(cv.activeRainStacks || 0, Math.max(1, ev.stacks || 2));
    cv.rainKind = cv.activeRainStacks >= 5 ? 'big' : 'static';
    run.fx.push({ t: 'contract_done', label: 'CASINO VIRUS', body: ev.kind === 'big_static' ? 'BIG ROOM STATIC STORM STARTED' : 'ROOM STATIC STORM STARTED' });
  } else if (ev.kind === 'mini_boss') {
    if (df.loop < 3 || !enemyAllowedForModifier(run, 'herald')) return 0;
    const e = spawnEnemy(run, players, 'herald', true, center, { noArmor: true });
    if (e) {
      e.maxHp = Math.round(e.maxHp * 1.65); e.hp = e.maxHp; e.dmg = Math.round(e.dmg * 1.25); e.virusBoss = true; e.virusSpawn = true; spawned = 1;
      run.fx.push({ t: 'director_wave', label: ev.label, intent: 'director', x: Math.round(center.x), y: Math.round(center.y), count: 1 });
    }
  } else if (ev.kind === 'jackpot') {
    const n = Math.max(1, ev.n || 6);
    for (let i = 0; i < n; i++) dropPickup(run, center.x + (Math.random() - 0.5) * 180, center.y + (Math.random() - 0.5) * 150, 'GLD', 10 + Math.round(Math.random() * 18), { personal: 1, label: 'CASINO JACKPOT' });
    run.fx.push({ t: 'contract_done', label: 'CASINO VIRUS', body: 'SLOT JACKPOT PAID' });
  }
  cv.lastAppliedLabel = ev.label;
  cv.appliedSpins = Math.max(0, (cv.appliedSpins || 0)) + 1;
  return spawned;
}

function stepCasinoVirusRain(run, players, dt) {
  const cv = run.casinoVirus;
  if (!hasMod(run, 'casino_virus') || !cv || !(cv.activeRainStacks > 0) || run.portal.open) return;
  const stacks = Math.max(1, Math.min(STATIC_RAIN_MAX_LEVEL, cv.activeRainStacks || 1));
  const pressure = Math.max(0, stacks - 1);
  cv.rainT = Math.max(0, (cv.rainT || 0) - dt);
  if (cv.rainT > 0) return;
  cv.rainT = Math.max(0.95, 2.35 - pressure * 0.18) + Math.random() * Math.max(0.55, 1.25 - pressure * 0.07);
  const alive = [...players.values()].filter(p => p.alive);
  const strikeCount = 1 + (stacks >= 4 ? 1 : 0) + (stacks >= 6 ? 1 : 0);
  for (let i = 0; i < strikeCount; i++) {
    const target = alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
    const spread = Math.max(130, 260 - pressure * 12);
    const x = target ? target.x + (Math.random() - 0.5) * spread : WALL_T + Math.random() * (run.plan.w - WALL_T * 2);
    const y = target ? target.y + (Math.random() - 0.5) * spread : WALL_T + Math.random() * (run.plan.h - WALL_T * 2);
    const r = 70 + pressure * 7;
    run.fx.push({ t: 'rain_warn', x: Math.round(x), y: Math.round(y), r, dur: 1.15, stacks, virus: 1 });
    if (!run.pendingStrikes) run.pendingStrikes = [];
    run.pendingStrikes.push({ x, y, r, dmgP: 15 + pressure * 4, dmgE: 55 + pressure * 12, at: (run.now || 0) + 1.15, stacks, virus: 1 });
  }
}

function stepCasinoVirus(run, players, dt) {
  if (!hasMod(run, 'casino_virus') || !run.casinoVirus || run.portal.open) return;
  const cv = run.casinoVirus;
  const now = safeRunNow(run);
  if ((cv.spinsLeft || 0) <= 0 && !cv.pendingEvent && (cv.appliedSpins || 0) < (cv.totalSpins || 3)) cv.appliedSpins = (cv.totalSpins || 3);
  if (cv.pendingEvent) {
    const applyAt = Number.isFinite(Number(cv.pendingEvent.applyAt)) ? Number(cv.pendingEvent.applyAt) : now;
    cv.nextSpin = Math.max(0, applyAt - now);
    if (now >= applyAt) {
      const ev = cv.pendingEvent;
      cv.pendingEvent = null;
      applyCasinoVirusEvent(run, players, ev);
      cv.nextSpin = cv.spinsLeft > 0 ? (liveEnemyCount(run) <= 0 ? 1.15 : 6) : 0;
    } else {
      return;
    }
  }
  if (cv.spinsLeft > 0) {
    if (liveEnemyCount(run) <= 0) cv.nextSpin = Math.min(Number.isFinite(Number(cv.nextSpin)) ? Number(cv.nextSpin) : 6, 1.15);
    cv.nextSpin = Math.max(0, (Number.isFinite(Number(cv.nextSpin)) ? Number(cv.nextSpin) : 6) - dt);
    if (cv.nextSpin <= 0) scheduleCasinoVirusEvent(run, players);
  } else if (!cv.pendingEvent && liveEnemyCount(run) <= 0 && (cv.appliedSpins || 0) >= (cv.totalSpins || 3)) {
    cv.done = true;
    run.fx.push({ t: 'contract_done', label: 'CASINO VIRUS', body: '3 SPINS CLEARED' });
    openPortal(run);
  }
}
function tryCleanupPortal(run) {
  if (!run || run.phase !== 'play' || run.portal?.open || run.plan?.category === 'boss') return;
  if (hasMod(run, 'casino_virus')) {
    const cv = run.casinoVirus;
    if (cv && !cv.pendingEvent && (cv.spinsLeft || 0) <= 0 && (cv.appliedSpins || 0) >= (cv.totalSpins || 3) && liveEnemyCount(run) <= 0) {
      cv.done = true;
      openPortal(run);
    }
    return;
  }
  if (quotaCanOpenPortal(run)) openPortal(run);
}
function stepMovingWalls(run, players, dt) {
  if (!hasMod(run, 'moving_room') || !run.movingWalls?.length) return;
  for (const w of run.movingWalls) {
    const step = (w.speed || 60) * (w.dir || 1) * dt;
    if (w.axis === 'x') { w.x += step; if (w.x < w.min || w.x > w.max) { w.x = clamp(w.x, w.min, w.max); w.dir *= -1; } }
    else { w.y += step; if (w.y < w.min || w.y > w.max) { w.y = clamp(w.y, w.min, w.max); w.dir *= -1; } }
    w.fxT = Math.max(0, (w.fxT || 0) - dt);
    const zoneDmg = 7 + Math.floor((run.runDepth || 0) * 0.32);
    let hitSomething = false;
    for (const p of players.values()) if (p.alive && rectHitCircle(p.x, p.y, PLAYER_SIZE / 2, w)) {
      p.slowT = Math.max(p.slowT || 0, 0.28);
      p.slowMul = Math.min(p.slowMul || 1, 0.50);
      p.zoneHitCd = Math.max(0, (p.zoneHitCd || 0) - dt);
      if ((p.zoneHitCd || 0) <= 0) {
        damagePlayer(run, p, zoneDmg, w.x + w.w / 2, w.y + w.h / 2);
        p.zoneHitCd = 0.55;
        hitSomething = true;
      }
    }
    for (const e of [...run.enemies]) if (e.hp > 0 && rectHitCircle(e.x, e.y, (e.size || 24) / 2, w)) {
      e.activeSlowT = Math.max(e.activeSlowT || 0, 0.36);
      e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.52);
      e.zoneHitCd = Math.max(0, (e.zoneHitCd || 0) - dt);
      if ((e.zoneHitCd || 0) <= 0) {
        damageEnemy(run, players, e, zoneDmg * 1.7, null, 0, 0, 0);
        e.zoneHitCd = 0.55;
        hitSomething = true;
      }
    }
    if (hitSomething && w.fxT <= 0) {
      w.fxT = 0.25;
      run.fx.push({ t: 'moving_zone_hit', x: Math.round(w.x + w.w / 2), y: Math.round(w.y + w.h / 2), w: Math.round(w.w), h: Math.round(w.h) });
    }
  }
}
function stepPrismSlowGrid(run, players, dt) {
  if (!hasMod(run, 'prism_grid') || !run.prismZones?.length) return;
  for (const z of run.prismZones) {
    for (const p of players.values()) if (p.alive && rectHitCircle(p.x, p.y, PLAYER_SIZE / 2, z)) { p.slowT = Math.max(p.slowT || 0, 0.22); p.slowMul = Math.min(p.slowMul || 1, 0.333); }
    for (const e of run.enemies) if (e.hp > 0 && rectHitCircle(e.x, e.y, (e.size || 24) / 2, z)) { e.activeSlowT = Math.max(e.activeSlowT || 0, 0.28); e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.333); }
    for (const b of run.bullets) if (rectHitCircle(b.x, b.y, (b.size || 5) + 2, z)) { const m = Math.pow(0.333, dt * 6); b.vx *= m; b.vy *= m; b.gridSlowT = 0.12; }
  }
}
// ---------------------------------------------------------------- room mods
function stepMods(run, players, dt) {
  if (run.phase !== 'play') return;
  run.roomAge = (run.roomAge || 0) + dt;
  stepMovingWalls(run, players, dt);
  stepPrismSlowGrid(run, players, dt);
  stepHunterWaves(run, players, dt);
  stepCasinoVirus(run, players, dt);
  // Casino Virus static now stacks into the single Static Storm system; no separate rain loop.
  // HUNTER WAVES are handled by stepHunterWaves(); no priority-target escalation.

  if (hasMod(run, 'anchor_gravity') && run.roomSockets?.length) {
    for (const s of run.roomSockets) {
      if ((Math.floor((run.now || 0) * 2) % 5) === 0 && Math.random() < 0.012) run.fx.push({ t: 'active_field', kind: 'anchor_gravity', x: s.x, y: s.y, r: s.r, tone: 'purple' });
      for (const p of players.values()) {
        if (!p.alive) continue;
        const d = dist2(p.x, p.y, s.x, s.y);
        if (d > s.r * s.r || d < 16) continue;
        const dist = Math.sqrt(d);
        const n = norm(s.x - p.x, s.y - p.y);
        const core = Math.max(0, 1 - dist / s.r);
        const inner = Math.max(46, s.inner || s.r * 0.22);
        const tangent = { x: -n.y, y: n.x };
        const innerMul = dist < inner ? 1 : 0.42;
        const dashMul = (p.dashT || p.invuln || 0) > 0.04 ? 0.28 : 1;
        const pull = (44 + 236 * Math.pow(core, 1.85)) * innerMul * dashMul;
        const swirl = (18 + 42 * core) * (dist < inner ? 0.35 : 1) * dashMul;
        const nx = p.x + (n.x * pull + tangent.x * swirl) * dt;
        const ny = p.y + (n.y * pull + tangent.y * swirl) * dt;
        const c = collideWalls(nx, ny, PLAYER_SIZE / 2, run.plan.walls, p.x, p.y);
        p.x = c.x; p.y = c.y;
        p.slowT = Math.max(p.slowT || 0, 0.12);
        p.slowMul = Math.min(p.slowMul || 1, dist < inner ? 0.78 : 0.90);
      }
      for (const e of run.enemies) {
        if (!e || e.hp <= 0 || ENEMIES[e.kind]?.boss) continue;
        const d = dist2(e.x, e.y, s.x, s.y);
        if (d > s.r * s.r || d < 12) continue;
        const dist = Math.sqrt(d);
        const n = norm(s.x - e.x, s.y - e.y);
        const core = Math.max(0, 1 - dist / s.r);
        const force = (e.kind === 'damper' ? 12 : 36 + 88 * core) * core;
        e.x += n.x * force * dt; e.y += n.y * force * dt;
      }
      for (const b of run.bullets) {
        const d = dist2(b.x, b.y, s.x, s.y);
        const maxR = s.r + 80;
        if (d > maxR ** 2 || d < 1) continue;
        const dist = Math.sqrt(d);
        const n = norm(s.x - b.x, s.y - b.y);
        const sp = Math.max(80, Math.hypot(b.vx || 0, b.vy || 0));
        const core = Math.max(0, 1 - dist / maxR);
        const mass = b.from === 'p' ? 0.34 : 0.58;
        const pull = (240 + 1040 * Math.pow(core, 1.35)) * mass;
        const tangent = { x: -n.y, y: n.x };
        b.vx += (n.x * pull + tangent.x * 42 * core * mass) * dt;
        b.vy += (n.y * pull + tangent.y * 42 * core * mass) * dt;
        if (dist < 24 && b.from !== 'p') {
          b.life = -1;
          run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: 'anchor_gravity' });
        } else {
          const ns = Math.hypot(b.vx || 0, b.vy || 0) || sp;
          const maxSp = Math.max(sp * 1.08, 620);
          if (ns > maxSp) { b.vx = b.vx / ns * maxSp; b.vy = b.vy / ns * maxSp; }
          b.anchorWarpT = 0.12;
        }
      }
      for (const pk of run.pickups) {
        const d = dist2(pk.x, pk.y, s.x, s.y);
        if (d > (s.r * 0.65) ** 2 || d < 16) continue;
        const dist = Math.sqrt(d);
        const n = norm(s.x - pk.x, s.y - pk.y);
        const core = Math.max(0, 1 - dist / (s.r * 0.65));
        pk.x += n.x * (12 + 36 * core) * dt; pk.y += n.y * (12 + 36 * core) * dt;
      }
    }
  }
  if (false && run.plan.modifierIds.includes('prism_grid')) {
    run.prismLaneT = (run.prismLaneT || 2.5) - dt;
    if (run.prismLaneT <= 0) {
      run.prismLaneT = Math.max(2.7, 6.2 - Math.min(2.6, (run.runDepth || 0) * 0.06)) + Math.random() * 1.8;
      const vertical = Math.random() < 0.5;
      const alive = [...players.values()].filter(p => p.alive);
      const target = alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
      const lane = vertical
        ? { x1: Math.round(target ? target.x + (Math.random() - 0.5) * 240 : WALL_T + Math.random() * (run.plan.w - WALL_T * 2)), y1: WALL_T, x2: 0, y2: run.plan.h - WALL_T }
        : { x1: WALL_T, y1: Math.round(target ? target.y + (Math.random() - 0.5) * 180 : WALL_T + Math.random() * (run.plan.h - WALL_T * 2)), x2: run.plan.w - WALL_T, y2: 0 };
      if (vertical) { lane.x2 = lane.x1; } else { lane.y2 = lane.y1; }
      lane.at = (run.now || 0) + 0.90; lane.w = 42; lane.dmgP = 13 + Math.floor((run.runDepth || 0) * 0.35); lane.dmgE = 42 + Math.floor((run.runDepth || 0) * 1.4);
      if (!run.pendingPrismLanes) run.pendingPrismLanes = [];
      run.pendingPrismLanes.push(lane);
      run.fx.push({ t: 'active_line', kind: 'room_lane', x1: lane.x1, y1: lane.y1, x2: lane.x2, y2: lane.y2, width: lane.w, tone: 'cyan' });
    }
  }
  if (run.pendingPrismLanes?.length) {
    for (const lane of [...run.pendingPrismLanes]) {
      if ((run.now || 0) < lane.at) continue;
      run.pendingPrismLanes = run.pendingPrismLanes.filter(x => x !== lane);
      run.fx.push({ t: 'active_line_tick', kind: 'room_lane', x1: lane.x1, y1: lane.y1, x2: lane.x2, y2: lane.y2, width: lane.w, tone: 'cyan' });
      for (const p of players.values()) if (p.alive && distToSegment2(p.x, p.y, lane.x1, lane.y1, lane.x2, lane.y2) < (lane.w + PLAYER_SIZE / 2) ** 2) { if (run.roomStats) run.roomStats.prismHits = (run.roomStats.prismHits || 0) + 1; damagePlayer(run, p, lane.dmgP, (lane.x1 + lane.x2) / 2, (lane.y1 + lane.y2) / 2); }
      for (const e of [...run.enemies]) if (distToSegment2(e.x, e.y, lane.x1, lane.y1, lane.x2, lane.y2) < (lane.w + e.size / 2) ** 2) damageEnemy(run, players, e, lane.dmgE, null, 0, 0, 0);
    }
  }
  if (run.pendingBloodTax?.length) {
    for (const b of [...run.pendingBloodTax]) {
      if ((run.now || 0) < b.at) continue;
      run.pendingBloodTax = run.pendingBloodTax.filter(x => x !== b);
      run.fx.push({ t: 'blood_tax_hit', x: Math.round(b.x), y: Math.round(b.y), r: b.r });
      if (run.roomStats) run.roomStats.bloodTaxes = (run.roomStats.bloodTaxes || 0) + 1;
      for (const p of players.values()) if (p.alive && dist2(p.x, p.y, b.x, b.y) < (b.r + PLAYER_SIZE / 2) ** 2) damagePlayer(run, p, b.dmgP, b.x, b.y);
      for (const e of [...run.enemies]) if (dist2(e.x, e.y, b.x, b.y) < (b.r + e.size / 2) ** 2) damageEnemy(run, players, e, b.dmgE, null, 0, 0, 0);
    }
  }
  const activeStatic = staticRainActiveBreakdown(run);
  if ((activeStatic.total || 0) > 0) {
    if (run.plan?.specialRoomId === 'chill_room') return;
    const stacks = Math.max(1, Math.min(STATIC_RAIN_MAX_LEVEL, activeStatic.total || 1));
    const pressure = Math.max(0, stacks - 1);
    const harsh = Math.max(0, stacks - 5);
    run.rainT -= dt;
    if (run.rainT <= 0) {
      run.rainT = Math.max(1.25, 3.45 - Math.sqrt(pressure) * 0.34 - Math.sqrt(harsh) * 0.22) + Math.random() * Math.max(0.85, 2.10 - Math.sqrt(pressure) * 0.18);
      const alive = [...players.values()].filter(p => p.alive);
      const strikeCount = 1 + (stacks >= 5 ? 1 : 0) + (stacks >= 14 ? 1 : 0);
      for (let si = 0; si < strikeCount; si++) {
        const nearPlayer = Math.random() < Math.min(0.78, 0.38 + pressure * 0.04 + harsh * 0.06) && alive.length;
        const target = nearPlayer ? alive[Math.floor(Math.random() * alive.length)] : null;
        const spread = Math.max(150, 300 - Math.sqrt(pressure) * 34 - Math.sqrt(harsh) * 24);
        const x = target ? target.x + (Math.random() - 0.5) * spread
          : WALL_T + Math.random() * (run.plan.w - WALL_T * 2);
        const y = target ? target.y + (Math.random() - 0.5) * spread
          : WALL_T + Math.random() * (run.plan.h - WALL_T * 2);
        const r = Math.min(132, 58 + Math.sqrt(pressure) * 12 + Math.sqrt(harsh) * 8);
        const dmgP = Math.min(58, 14 + Math.sqrt(pressure) * 7 + Math.sqrt(harsh) * 8);
        const dmgE = Math.min(170, 46 + Math.sqrt(pressure) * 20 + Math.sqrt(harsh) * 18);
        run.fx.push({ t: 'rain_warn', x: Math.round(x), y: Math.round(y), r, dur: 1.25, stacks });
        if (!run.pendingStrikes) run.pendingStrikes = [];
        run.pendingStrikes.push({ x, y, r, dmgP, dmgE, at: run.now + 1.25, stacks });
      }
    }
  }
  if (run.pendingStrikes) {
    for (const s of [...run.pendingStrikes]) {
      if (run.now >= s.at) {
        run.pendingStrikes = run.pendingStrikes.filter(x => x !== s);
        run.fx.push({ t: 'rain_hit', x: Math.round(s.x), y: Math.round(s.y), r: s.r, stacks: s.stacks || run.staticRainStacks || 1 });
        let playerHits = 0;
        for (const p of players.values()) {
          if (p.alive && dist2(p.x, p.y, s.x, s.y) < (s.r + PLAYER_SIZE / 2) ** 2) {
            playerHits++;
            damagePlayer(run, p, s.dmgP || 25, s.x, s.y);
          }
        }
        if (!s.virus && run.staticRainCanSeedNext && playerHits > 0) run.roomStaticRainFalls = (run.roomStaticRainFalls || 0) + playerHits;
        for (const e of [...run.enemies]) {
          if (dist2(e.x, e.y, s.x, s.y) < (s.r + e.size / 2) ** 2) damageEnemy(run, players, e, s.dmgE || 60, null, 0, 0, 0);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- interact
function tryInteract(run, players, p) {
  if (!p.alive) return;
  // portal first
  if (run.portal.open && dist2(p.x, p.y, run.portal.x, run.portal.y) < INTERACT_DIST ** 2) {
    beginTransition(run, players);
    return;
  }
  for (const o of run.plan.interactables) {
    if (o.opened) continue;
    if (dist2(p.x, p.y, o.x, o.y) > INTERACT_DIST ** 2) continue;
    if (o.type === 'chest') { openChest(run, players, p, o); return; }
    // bet handled via casino message (modal), but E near bet just notifies client to open modal
    if (o.type === 'bet') { run.fx.push({ t: 'bet_ui', id: p.id, obj: o.id }); return; }
  }
}


function weaponChoiceDisabled(p, opt) {
  if (!opt) return 'НЕТ ВАРИАНТА';
  if (opt.kind === 'weapon' && p.weapons.includes(opt.weapon)) return 'УЖЕ ЕСТЬ';
  if (opt.kind === 'weapon_upgrade' && opt.reqWeapon && !p.weapons.includes(opt.reqWeapon)) return `НУЖЕН ${WEAPONS[opt.reqWeapon]?.label || opt.reqWeapon}`;
  if (opt.kind === 'weapon_upgrade') {
    const id = opt.upgrade || opt.id;
    if (id === 'drone_element_link' && !(p?.stats?.drones > 0)) return 'НУЖЕН DRONE';
    if (id === 'drone_element_link' && !playerHasBulletElement(p)) return 'НУЖЕН СТАТУС';
    if ((id === 'element_amp' || id === 'element_spread') && !playerHasBulletElement(p)) return 'НУЖЕН ОГОНЬ/ХОЛОД/ЯД';
  }
  return '';
}
function weaponChoiceEligible(p, opt) { return !weaponChoiceDisabled(p, opt); }

function weaponChoiceWeight(p, opt, qualityTier = 0) {
  if (!opt) return 1;
  let w = 1;
  if (opt.kind === 'weapon' && !p.weapons.includes(opt.weapon)) w += 2.2 + qualityTier * 0.9;
  if (opt.kind === 'weapon_upgrade' && opt.reqWeapon && p.weapons.includes(opt.reqWeapon)) w += 1.5 + qualityTier * 0.55;
  if (opt.kind === 'weapon_upgrade' && !opt.reqWeapon) w += qualityTier >= 2 ? 0.45 : 0;
  if (opt.kind === 'stat') w *= qualityTier >= 2 ? 0.65 : 0.9;
  return Math.max(0.1, w);
}
function weightedPickOption(rng, pool, weightFn, used = new Set()) {
  const list = pool.filter(x => x && !used.has(x.id));
  if (!list.length) return null;
  const weighted = list.map(x => [x, Math.max(0.05, weightFn(x))]);
  const total = weighted.reduce((a, [,w]) => a + w, 0) || 1;
  let r = rng() * total;
  for (const [x,w] of weighted) { r -= w; if (r <= 0) return x; }
  return weighted[0][0];
}
function makeWeaponChestChoices(p, rng = Math.random, count = 3, qualityTier = 0) {
  const pool = WEAPON_CHEST_REWARDS
    .filter(opt => weaponChoiceEligible(p, opt))
    .map(opt => ({ ...opt, disabled: 0, disabledReason: '', valueTier: qualityTier }));
  const choices = [];
  const used = new Set();
  const want = Math.max(3, Math.min(5, count | 0));
  let guard = 0;
  while (choices.length < want && guard++ < 120 && pool.length) {
    const opt = weightedPickOption(rng, pool, x => weaponChoiceWeight(p, x, qualityTier), used);
    if (!opt) break;
    used.add(opt.id);
    choices.push(opt);
  }
  return choices;
}


function ensureActive(p) {
  if (!p.active || typeof p.active !== 'object') p.active = { core: null, level: 0, mutations: [] };
  if (!Array.isArray(p.active.mutations)) p.active.mutations = [];
  p.active.mutations = p.active.mutations.filter(id => ACTIVE_MUTATIONS[id]).slice(0, ACTIVE_MUTATION_SLOTS);
  if (p.active.core && !ACTIVE_CORES[p.active.core]) { p.active.core = null; p.active.level = 0; p.active.mutations = []; }
  if (p.active.core && (!p.active.level || p.active.level < 1)) p.active.level = 1;
  if (p.active.core !== 'void_cut') delete p.active.voidChain;
  return p.active;
}
function activeHasMutation(p, id) { return ensureActive(p).mutations.includes(id); }
function activeMutationLabels(p) { return ensureActive(p).mutations.map(id => ACTIVE_MUTATIONS[id]?.label || id.toUpperCase()); }
function addActiveChoiceMeta(opt) {
  const tone = opt.tone || (opt.kind && String(opt.kind).includes('mutation') ? 'purple' : 'cyan');
  return { ...opt, tone };
}
function makeCoreChoice(coreId, kind, p) {
  const c = ACTIVE_CORES[coreId];
  const a = ensureActive(p);
  const current = a.core ? ACTIVE_CORES[a.core]?.label : 'НЕТ Q';
  const replace = kind === 'active_core_replace';
  return addActiveChoiceMeta({
    id: `${kind}_${coreId}`, kind, core: coreId,
    label: replace ? `ЗАМЕНИТЬ Q: ${c.label}` : `Q: ${c.label}`,
    actionLabel: replace ? 'ЗАМЕНИТЬ Q' : 'УСТАНОВИТЬ Q',
    group: 'Q', role: c.role || 'ACTIVE',
    preview: replace ? `${current} → ${c.label}. Текущие мутации сохранятся.` : `Q станет ${c.label} I.`,
    desc: c.desc,
    tone: c.tone
  });
}
function makeUpgradeCoreChoice(p) {
  const a = ensureActive(p); const c = ACTIVE_CORES[a.core];
  return addActiveChoiceMeta({
    id: `active_upgrade_${a.core}_${a.level + 1}`, kind: 'active_upgrade_core', core: a.core,
    label: `${c.label} ${roman(a.level)} → ${roman(a.level + 1)}`,
    actionLabel: 'УСИЛИТЬ Q', group: 'POWER', role: c.role || 'ACTIVE',
    preview: a.core === 'signal_spike' ? `${roman(a.level + 1)}: +1 заряд SPIKE. Зона держится дольше и бьёт сильнее.` : (a.core === 'void_cut' ? `${roman(a.level + 1)}: +1 точка связи. Каждый сегмент луча становится намного длиннее.` : `${roman(a.level + 1)}: ${c.upgrade?.join(' · ') || '+сила'}.`),
    desc: c.desc, tone: c.tone
  });
}
function makeMutationChoice(mutId, p, replaceIdx = -1) {
  const m = ACTIVE_MUTATIONS[mutId]; const a = ensureActive(p);
  const replace = replaceIdx >= 0;
  const old = replace ? ACTIVE_MUTATIONS[a.mutations[replaceIdx]]?.label || a.mutations[replaceIdx] : '';
  return addActiveChoiceMeta({
    id: replace ? `active_replace_mut_${replaceIdx}_${mutId}` : `active_mut_${mutId}`,
    kind: replace ? 'active_replace_mutation' : 'active_add_mutation', mutation: mutId, replaceIdx,
    label: replace ? `MUTATE: ${old} → ${m.label}` : `MUTATION: ${m.label}`,
    actionLabel: replace ? 'ЗАМЕНИТЬ МУТАЦИЮ' : 'ДОБАВИТЬ МУТАЦИЮ',
    group: 'MUTATION', role: m.role || 'SIGNAL',
    preview: `${m.label} усиливает текущую Q и меняет её поведение.`,
    desc: m.desc, tone: m.tone
  });
}
function roman(n) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let out = '';
  for (const [v, sym] of table) while (n >= v) { out += sym; n -= v; }
  return out || 'I';
}
function pickUnique(rng, arr, used = new Set()) {
  const pool = arr.filter(x => !used.has(x));
  if (!pool.length) return null;
  const x = pool[Math.floor(rng() * pool.length)]; used.add(x); return x;
}
function makeAbilityChestChoices(p, rng = Math.random, count = 3, qualityTier = 0) {
  const a = ensureActive(p);
  const choices = [];
  const used = new Set();
  const want = Math.max(3, Math.min(5, count | 0));
  const coreIds = Object.keys(ACTIVE_CORES);
  const mutIds = Object.keys(ACTIVE_MUTATIONS);
  if (!a.core) {
    while (choices.length < want) {
      const id = pickUnique(rng, coreIds, used); if (!id) break;
      choices.push(makeCoreChoice(id, 'active_core_install', p));
    }
    return choices;
  }

  if (a.core === 'signal_spike' || a.core === 'void_cut' || a.level < 3) choices.push(makeUpgradeCoreChoice(p));
  const availableMuts = mutIds.filter(id => !a.mutations.includes(id));
  if (a.mutations.length < ACTIVE_MUTATION_SLOTS && availableMuts.length) {
    choices.push(makeMutationChoice(pickUnique(rng, availableMuts, used), p));
  } else if (availableMuts.length && a.mutations.length) {
    const idx = Math.floor(rng() * a.mutations.length);
    choices.push(makeMutationChoice(pickUnique(rng, availableMuts, used), p, idx));
  }
  const otherCores = coreIds.filter(id => id !== a.core);
  if (otherCores.length) choices.push(makeCoreChoice(pickUnique(rng, otherCores, used), 'active_core_replace', p));

  // One side-grade keeps ABL chests useful for mobility builds without stealing the Q identity.
  while (choices.length < want) {
    const side = ABILITY_CHEST_REWARDS[Math.floor(rng() * ABILITY_CHEST_REWARDS.length)];
    if (!side || used.has(side.id)) break;
    used.add(side.id);
    choices.push(addActiveChoiceMeta({ ...side, actionLabel: 'SIDE UPGRADE', group: 'MOBILITY', role: 'DASH SIDE', preview: side.desc, tone: 'cyan', valueTier: qualityTier }));
  }
  while (choices.length < want && availableMuts.length) choices.push(makeMutationChoice(pickUnique(rng, availableMuts, used), p));
  return choices.slice(0, want);
}

function applyAbilityChestOption(run, players, p, opt) {
  if (!opt) return false;
  const a = ensureActive(p);
  let label = opt.label || opt.id;
  if (opt.kind === 'active_core_install') {
    if (!ACTIVE_CORES[opt.core]) return false;
    p.active.core = opt.core; p.active.level = 1; p.active.mutations = [];
    if (opt.core === 'signal_spike') p.active.spikeCharges = 1; else delete p.active.spikeCharges;
    label = `Q: ${ACTIVE_CORES[opt.core].label} I`;
  } else if (opt.kind === 'active_core_replace') {
    if (!ACTIVE_CORES[opt.core]) return false;
    p.active.core = opt.core; p.active.level = Math.max(1, p.active.level || 1);
    if (opt.core === 'signal_spike') p.active.spikeCharges = signalSpikeMaxCharges(p); else delete p.active.spikeCharges;
    label = `Q REPLACED: ${ACTIVE_CORES[opt.core].label} ${roman(p.active.level)}`;
  } else if (opt.kind === 'active_upgrade_core') {
    if (!a.core) return false;
    const oldLevel = Math.max(1, p.active.level || 1);
    p.active.level = (p.active.core === 'signal_spike' || p.active.core === 'void_cut') ? oldLevel + 1 : Math.min(3, oldLevel + 1);
    if (p.active.core === 'signal_spike') {
      const maxCharges = signalSpikeMaxCharges(p);
      p.active.spikeCharges = Math.min(maxCharges, (typeof p.active.spikeCharges === 'number' ? p.active.spikeCharges : oldLevel) + 1);
      p.activeCd = Math.min(p.activeCd || 0, signalSpikeRecharge(p));
    }
    if (p.active.core === 'void_cut') {
      delete p.active.voidChain;
      p.activeCd = 0;
      run.fx.push({ t: 'active_mutation', label: `VOID POINTS ${roman(voidLaserMaxSegments(p))}`, x: Math.round(p.x), y: Math.round(p.y), r: 90, tone: 'purple' });
    }
    label = `Q UPGRADE: ${ACTIVE_CORES[p.active.core].label} ${roman(p.active.level)}`;
  } else if (opt.kind === 'active_add_mutation') {
    if (!a.core || !ACTIVE_MUTATIONS[opt.mutation]) return false;
    if (!p.active.mutations.includes(opt.mutation)) {
      if (p.active.mutations.length >= ACTIVE_MUTATION_SLOTS) return false;
      p.active.mutations.push(opt.mutation);
    }
    label = `Q MUTATION: ${ACTIVE_MUTATIONS[opt.mutation].label}`;
  } else if (opt.kind === 'active_replace_mutation') {
    if (!a.core || !ACTIVE_MUTATIONS[opt.mutation]) return false;
    const idx = Math.max(0, Math.min(p.active.mutations.length - 1, opt.replaceIdx | 0));
    if (!p.active.mutations.length) return false;
    p.active.mutations[idx] = opt.mutation;
    p.active.mutations = [...new Set(p.active.mutations)].slice(0, ACTIVE_MUTATION_SLOTS);
    label = `Q MUTATION: ${ACTIVE_MUTATIONS[opt.mutation].label}`;
  } else if (opt.kind === 'ability_upgrade') {
    const u = UPGRADES.find(x => x.id === opt.upgrade);
    if (!u) return false;
    u.apply(p.stats);
    p.dashCharges = Math.min(dashMax(p), p.dashCharges + (opt.upgrade === 'dash' ? 1 : 0));
    label = u.label;
  } else if (opt.kind === 'stat') {
    if (opt.stat === 'spd') p.stats.spdMul *= 1.12;
    else if (opt.stat === 'dashflow') p.stats.dashRegenMul *= 1.2;
    else return false;
  } else return false;
  ensureActive(p);
  p.hp = Math.min(p.hp, maxHp(p));
  p.dashCharges = Math.min(dashMax(p), p.dashCharges);
  run.fx.push({ t: 'ability_get', id: p.id, label, x: Math.round(p.x), y: Math.round(p.y) });
  run.fx.push({ t: 'chest_open', id: p.id, name: p.name || '', personal: 1, chest: 'ABL', rewards: [label], x: Math.round(p.x), y: Math.round(p.y) });
  return true;
}

function applyRandomCasinoAbility(run, players, p, pl = {}) {
  const choices = makeAbilityChestChoices(p, Math.random);
  const opt = choices.find(o => !o.disabled) || choices[0];
  if (!opt) return false;
  const beforeFx = run.fx.length;
  const ok = applyAbilityChestOption(run, players, p, opt);
  if (ok) {
    pl.abilityLabel = opt.actionLabel ? `${opt.actionLabel}: ${opt.label}` : opt.label;
    // Casino results should be compact; remove chest_open duplicate if it was just pushed.
    run.fx = run.fx.filter((f, i) => i < beforeFx || f.t !== 'chest_open');
  }
  return ok;
}

function applyWeaponChestOption(run, players, p, opt) {
  if (!opt) return false;
  const disabledReason = weaponChoiceDisabled(p, opt);
  if (disabledReason) {
    run.fx.push({ t: 'denied', id: p.id, x: Math.round(p.x), y: Math.round(p.y), reason: disabledReason, chest: 'WPN' });
    return false;
  }
  if (opt.kind === 'weapon') {
    if (!p.weapons.includes(opt.weapon)) {
      p.weapons.push(opt.weapon);
      run.fx.push({ t: 'weapon_get', id: p.id, w: WEAPONS[opt.weapon]?.label || opt.label });
    }
  } else if (opt.kind === 'weapon_upgrade') {
    const u = UPGRADES.find(x => x.id === opt.upgrade);
    if (!u) return false;
    u.apply(p.stats);
    run.fx.push({ t: 'weapon_mod', id: p.id, label: u.label, w: u.branch });
  } else if (opt.kind === 'stat') {
    if (opt.stat === 'dmg') p.stats.weaponDmgMul = Math.max(0.05, Number(p.stats.weaponDmgMul) || 1) * 1.18;
    else if (opt.stat === 'fire') p.stats.fireMul *= 1.14;
    run.fx.push({ t: 'weapon_mod', id: p.id, label: opt.label, w: 'ALL' });
  } else return false;
  p.hp = Math.min(p.hp, maxHp(p));
  p.dashCharges = Math.min(dashMax(p), p.dashCharges);
  run.fx.push({ t: 'chest_open', id: p.id, name: p.name || '', personal: 1, chest: 'WPN', rewards: [opt.label], x: Math.round(p.x), y: Math.round(p.y) });
  return true;
}

function openChest(run, players, p, o) {
  const def = CHESTS[o.chest];
  const value = chestValueInfo(run, o);
  const cost = effectiveChestCost(run, o);
  if (cost > 0) {
    if (isBloodTaxRoom(run)) {
      const hpCost = bloodTaxHpCost(cost);
      if (!canPayBloodCost(p, hpCost)) {
        run.fx.push({ t: 'denied', id: p.id, obj: o.id, x: o.x, y: o.y, cost: hpCost, have: Math.round(p.hp), chest: def.label, hpCost: 1, reason: 'NO HP' });
        return;
      }
      payBloodCost(run, p, hpCost, o.x, o.y, 48);
      if (!p.alive) return;
    } else {
      if (p.economy.money < cost) {
        run.fx.push({ t: 'denied', id: p.id, obj: o.id, x: o.x, y: o.y, cost, have: p.economy.money, chest: def.label });
        return;
      }
      p.economy.money -= cost;
    }
  }
  const paidCost = cost > 0 ? (isBloodTaxRoom(run) ? bloodTaxHpCost(cost) : cost) : 0;
  const paidUnit = isBloodTaxRoom(run) ? 'HP' : 'GLD';
  o.opened = true;
  const rng = Math.random;
  const rewards = [];
  if (isGreedRoom(run)) {
    const table = { basic_chest: 32, weapon_chest: 62, ability_chest: 56, rare_chest: 82, cursed_chest: 110 };
    const base = table[o.chest] || 42;
    const val = Math.round((base + rng() * base * 0.65) * loopEconomyMul(run));
    individualGreedGoldGrant(run, p, val, 'GREED CHEST');
    run.fx.push({ t: 'chest_open', id: p.id, name: p.name || '', personal: 1, costPaid: paidCost, costUnit: paidUnit, obj: o.id, chest: def.label, rewards: [`GLD +${val}`], x: o.x, y: o.y, greed: 1 });
    return;
  }
  if (o.chest === 'basic_chest') {
    const n = 3 + Math.floor(rng() * 3);
    // BSC was free/cheap early loot, but late-loop chest prices now scale hard.
    // Keep BSC relevant by scaling its GLD/EXP payout with the same economy curve.
    const lootMul = loopBscLootMul(run);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const kind = rng() < 0.6 ? 'GLD' : 'EXP';
      const val = Math.max(1, Math.round((6 + rng() * 10) * lootMul));
      dropPickup(run, o.x + Math.cos(a) * 50, o.y + Math.sin(a) * 50, kind, val);
    }
    if (rng() < 0.15) dropPickup(run, o.x, o.y - 50, 'HEA', Math.round(20 + Math.min(60, 5 * Math.log2(lootMul + 1))));
    rewards.push(`LOOT x${Math.round(lootMul * 10) / 10}`);
  } else if (o.chest === 'weapon_chest') {
    const hold = takeCasinoHoldChoices(p, 2);
    const count = 3 + value.choiceBonus + hold;
    p.weaponChestOffer = { choices: makeWeaponChestChoices(p, rng, count, value.tier), chestId: o.id, valueTier: value.tier, valueLabel: value.label };
    run.fx.push({ t: 'weapon_offer', id: p.id, obj: o.id, x: o.x, y: o.y });
    const tag = value.tier > 0 ? `WPN ${value.label}` : 'ВЫБОР WPN';
    const extra = hold ? `HOLD +${hold} OPTION` : '';
    run.fx.push({ t: 'chest_open', id: p.id, name: p.name || '', personal: 1, costPaid: paidCost, costUnit: paidUnit, obj: o.id, chest: def.label, value: value.label, rewards: [tag, extra].filter(Boolean), x: o.x, y: o.y });
    return;
  } else if (o.chest === 'ability_chest') {
    const hold = takeCasinoHoldChoices(p, 2);
    const count = 3 + value.choiceBonus + hold;
    p.abilityChestOffer = { choices: makeAbilityChestChoices(p, rng, count, value.tier), chestId: o.id, valueTier: value.tier, valueLabel: value.label };
    run.fx.push({ t: 'ability_offer', id: p.id, obj: o.id, x: o.x, y: o.y });
    const tag = value.tier > 0 ? `ABL ${value.label}` : 'ВЫБОР ABL';
    const extra = hold ? `HOLD +${hold} OPTION` : '';
    run.fx.push({ t: 'chest_open', id: p.id, name: p.name || '', personal: 1, costPaid: paidCost, costUnit: paidUnit, obj: o.id, chest: def.label, value: value.label, rewards: [tag, extra].filter(Boolean), x: o.x, y: o.y });
    return;
  } else if (o.chest === 'rare_chest') {
    const pool = eligibleHeroUpgrades(p, null).filter(u => u.tier === 1);
    const fallback = eligibleHeroUpgrades(p, null).filter(u => u.tier <= 1);
    const list = pool.length ? pool : fallback;
    const picks = Math.max(1, value.tier >= 3 ? 2 : 1);
    const used = new Set();
    for (let i = 0; i < picks; i++) {
      const avail = list.filter(u => u && !used.has(u.id));
      const u = avail[Math.floor(rng() * avail.length)];
      if (u) {
        used.add(u.id);
        u.apply(p.stats);
        p.hp = Math.min(p.hp, maxHp(p));
        rewards.push(u.label);
      }
    }
    if (value.tier >= 2) {
      const val = Math.round((22 + rng() * 28) * loopEconomyMul(run));
      p.economy.money += val;
      rewards.push(`GLD +${val}`);
    }
  } else if (o.chest === 'cursed_chest') {
    const pool = eligibleHeroUpgrades(p, null).filter(u => u.tier === 2);
    const fallback = eligibleHeroUpgrades(p, null).filter(u => u.cursed);
    const list = pool.length ? pool : fallback;
    const u = list[Math.floor(rng() * list.length)];
    if (u) {
      u.apply(p.stats);
      p.hp = Math.min(p.hp, maxHp(p));
      rewards.push(u.label, 'CURSE: STATIC STORM');
    } else rewards.push('CURSE: STATIC STORM');
    addStaticDebt(run, value.tier >= 3 ? 2 : 1, 'cursed_chest');
  }
  run.fx.push({ t: 'chest_open', id: p.id, name: p.name || '', personal: o.chest !== 'basic_chest' ? 1 : 0, costPaid: paidCost, costUnit: paidUnit, obj: o.id, chest: def.label, value: value.label, rewards, x: o.x, y: o.y, cursed: !!def.cursed });
}



export function handleWeaponPick(run, players, p, choiceIdx) {
  if (!p.weaponChestOffer) return false;
  const idx = choiceIdx | 0;
  if (idx < 0 || idx >= p.weaponChestOffer.choices.length) return false;
  const opt = p.weaponChestOffer.choices[idx];
  const ok = applyWeaponChestOption(run, players, p, opt);
  if (ok) p.weaponChestOffer = null;
  return ok;
}

export function handleAbilityPick(run, players, p, choiceIdx) {
  if (!p.abilityChestOffer) return false;
  const idx = choiceIdx | 0;
  if (idx < 0 || idx >= p.abilityChestOffer.choices.length) return false;
  const opt = p.abilityChestOffer.choices[idx];
  const ok = applyAbilityChestOption(run, players, p, opt);
  if (ok) p.abilityChestOffer = null;
  return ok;
}

export function handleRerollOffer(run, players, p, kind = '') {
  if (!p) return false;
  const k = String(kind || '').toLowerCase();
  if (k === 'weapon' && !p.weaponChestOffer) return false;
  if (k === 'ability' && !p.abilityChestOffer) return false;
  const favor = consumeContractFavor(run, ['free_reroll', 'epic_reroll']);
  if (!favor) {
    run.fx.push({ t: 'denied', id: p.id, x: Math.round(p.x), y: Math.round(p.y), reason: 'NO FAVOR REROLL' });
    return false;
  }
  if (k === 'weapon') {
    p.weaponChestOffer = { choices: makeWeaponChestChoices(p, Math.random), chestId: p.weaponChestOffer.chestId || 'favor' };
  } else if (k === 'ability') {
    p.abilityChestOffer = { choices: makeAbilityChestChoices(p, Math.random), chestId: p.abilityChestOffer.chestId || 'favor' };
  } else return false;
  run.fx.push({ t: 'favor_used', id: favor.id, label: favorLabel(favor), body: k.toUpperCase() + ' REROLLED', playerId: p.id });
  return true;
}

export function handleDevCommand(run, players, p, cmd = {}) {
  if (!p || !cmd || typeof cmd !== 'object') return false;
  const action = String(cmd.action || '');
  if (action === 'set_active') {
    const core = String(cmd.core || '');
    if (!ACTIVE_CORES[core]) return false;
    const muts = Array.isArray(cmd.mutations) ? cmd.mutations.filter(id => ACTIVE_MUTATIONS[id]).slice(0, ACTIVE_MUTATION_SLOTS) : ensureActive(p).mutations;
    const rawLevel = Math.max(1, Number(cmd.level || 1) | 0);
    const levelCap = (core === 'signal_spike' || core === 'void_cut') ? 12 : 3;
    p.active = { core, level: Math.max(1, Math.min(levelCap, rawLevel)), mutations: [...new Set(muts)] };
    if (core === 'signal_spike') p.active.spikeCharges = signalSpikeMaxCharges(p);
    if (core === 'void_cut') delete p.active.voidChain;
    p.activeCd = 0;
    run.fx.push({ t: 'active_mutation', label: `DEV Q: ${ACTIVE_CORES[core].label} ${roman(p.active.level)}`, x: Math.round(p.x), y: Math.round(p.y), r: 120, tone: ACTIVE_CORES[core].tone || 'cyan' });
    return true;
  }
  if (action === 'reset_cd') {
    p.activeCd = 0; p.dashCharges = dashMax(p); p.hp = maxHp(p);
    run.fx.push({ t: 'active_mutation', label: 'DEV READY', x: Math.round(p.x), y: Math.round(p.y), r: 90, tone: 'green' });
    return true;
  }
  if (action === 'open_portal') {
    openPortal(run);
    run.fx.push({ t: 'active_mutation', label: 'DEV PORTAL OPEN', x: Math.round(run.portal.x), y: Math.round(run.portal.y), r: 150, tone: 'green' });
    return true;
  }
  if (action === 'weapon_offer') {
    p.weaponChestOffer = { choices: makeWeaponChestChoices(p, Math.random), chestId: 'dev' };
    run.fx.push({ t: 'weapon_offer', id: p.id, obj: 'dev', x: Math.round(p.x), y: Math.round(p.y) });
    return true;
  }
  if (action === 'ability_offer') {
    p.abilityChestOffer = { choices: makeAbilityChestChoices(p, Math.random), chestId: 'dev' };
    run.fx.push({ t: 'ability_offer', id: p.id, obj: 'dev', x: Math.round(p.x), y: Math.round(p.y) });
    return true;
  }
  if (action === 'set_next_room') {
    const override = sanitizeDevRoomOverride(cmd);
    if (!override) return false;
    run.devNextRoomOverride = override;
    run.nextRoomPreview = makeNextRoomPreview(run);
    run.fx.push({ t: 'active_mutation', label: `DEV NEXT: ${devOverrideLabel(override)}`, x: Math.round(p.x), y: Math.round(p.y), r: 120, tone: 'cyan' });
    return true;
  }
  if (action === 'clear_next_room') {
    run.devNextRoomOverride = null;
    run.nextRoomPreview = makeNextRoomPreview(run);
    run.fx.push({ t: 'active_mutation', label: 'DEV NEXT: AUTO', x: Math.round(p.x), y: Math.round(p.y), r: 100, tone: 'purple' });
    return true;
  }
  if (action === 'give_all_weapons') {
    p.weapons = [...new Set([...p.weapons, ...WEAPON_ORDER])];
    p.weaponIdx = Math.min(p.weaponIdx || 0, p.weapons.length - 1);
    run.fx.push({ t: 'weapon_mod', id: p.id, label: 'DEV ALL WPN', w: 'ALL' });
    return true;
  }
  if (action === 'money_xp') {
    p.economy.money += 500;
    addXp(run, p, 160);
    run.fx.push({ t: 'pick', id: p.id, type: 'GLD', val: 500, x: Math.round(p.x), y: Math.round(p.y) });
    return true;
  }
  if (action === 'clear_enemies') {
    let guard = 0;
    while (run.enemies.length && guard++ < 500) {
      const batch = [...run.enemies];
      for (const e of batch) if (run.enemies.includes(e)) killEnemy(run, players, e, p, 'dev');
    }
    run.bullets = run.bullets.filter(b => b.from === 'p');
    run.fx.push({ t: 'active_mutation', label: 'DEV KILL ALL', x: Math.round(p.x), y: Math.round(p.y), r: 180, tone: 'purple' });
    tryCleanupPortal(run);
    return true;
  }
  if (action === 'spawn_pack') {
    const kinds = ['grunt','runner','shooter','tank','charger','bouncer','glitch','damper'];
    for (let i = 0; i < 8 && run.enemies.length < MAX_ENEMIES; i++) spawnEnemy(run, players, kinds[i % kinds.length], i > 4);
    run.fx.push({ t: 'director_wave', label: 'DEV PACK', x: Math.round(p.x), y: Math.round(p.y), count: 8, intent: 'swarm' });
    return true;
  }
  if (action === 'god') {
    p.devGod = !!cmd.enabled;
    p.hp = maxHp(p);
    p.invuln = p.devGod ? 999999 : 0;
    run.fx.push({ t: 'active_mutation', label: p.devGod ? 'DEV GOD ON' : 'DEV GOD OFF', x: Math.round(p.x), y: Math.round(p.y), r: 110, tone: p.devGod ? 'green' : 'red' });
    return true;
  }

  if (action === 'give_all_installs') {
    for (const u of HERO_UPGRADES) {
      if (!u || u.bossSig || u.branch === 'Q' || u.id?.startsWith?.('orb')) continue;
      try { u.apply(p.stats); } catch {}
    }
    p.stats.orbitals = 0; p.stats.orbSpeed = 0; p.stats.orbRange = 0; p.stats.orbReflect = 0;
    p.hp = Math.min(maxHp(p), Math.max(p.hp, maxHp(p)));
    p.dashCharges = dashMax(p);
    run.fx.push({ t: 'active_mutation', label: 'DEV ALL INSTALLS', x: Math.round(p.x), y: Math.round(p.y), r: 150, tone: 'green' });
    return true;
  }
  if (action === 'give_all_weapon_mods') {
    p.weapons = [...new Set([...p.weapons, ...WEAPON_ORDER])];
    for (const r of WEAPON_CHEST_REWARDS) {
      const id = r?.upgrade;
      if (!id || String(id).startsWith('orb')) continue;
      const u = UPGRADES.find(x => x.id === id);
      if (u) { try { u.apply(p.stats); } catch {} }
    }
    p.stats.orbitals = 0; p.stats.orbSpeed = 0; p.stats.orbRange = 0; p.stats.orbReflect = 0;
    run.fx.push({ t: 'weapon_mod', id: p.id, label: 'DEV ALL WPN MODS', w: 'ALL' });
    return true;
  }
  if (action === 'give_all_signatures') {
    for (const id of BOSS_SIGNATURE_UPGRADE_IDS) {
      const u = UPGRADES.find(x => x.id === id);
      if (u) { try { u.apply(p.stats); } catch {} }
    }
    run.fx.push({ t: 'boss_signature', label: 'DEV SIGNATURES', kind: 'dev', choices: BOSS_SIGNATURE_UPGRADE_IDS.slice(0, 3) });
    return true;
  }
  if (action === 'boss_signature_offer') {
    p.bossSignaturePending = true;
    p.bossSignatureKind = String(cmd.kind || run.bossKind || run.lastBossKind || 'boss');
    p.bossSignatureChoices = bossSignatureChoicesForKind(p.bossSignatureKind, Math.random);
    p.offer = makeBossSignatureOffer(run, p);
    if (run.phase !== 'install') { run.phase = 'install'; run.phaseT = 0; }
    run.fx.push({ t: 'boss_signature', label: 'DEV SIGNATURE OFFER', kind: p.bossSignatureKind, choices: p.bossSignatureChoices });
    return true;
  }
  if (action === 'spawn_boss') {
    const kinds = ['boss_croupier','boss_hunter_chorus','boss_q_revisor','boss_anchor_cashier','boss'];
    const kind = kinds.includes(cmd.kind) ? cmd.kind : 'boss_croupier';
    const b = spawnEnemy(run, players, kind, false, null, { noArmor: true });
    b.hp = b.maxHp;
    run.bossKind = kind;
    run.fx.push({ t: 'boss_intro', label: ENEMIES[kind]?.label || 'BOS', kind, x: Math.round(b.x), y: Math.round(b.y) });
    return true;
  }
  if (action === 'set_final_room') {
    run.runDepth = FINAL_BOSS_DEPTH;
    run.fx.push({ t: 'active_mutation', label: 'DEV FINAL DEPTH READY', x: Math.round(p.x), y: Math.round(p.y), r: 130, tone: 'purple' });
    return true;
  }
  if (action === 'win_run') {
    run.finalSummary = finalRunSummary(run, players);
    run.phase = 'won'; run.phaseT = 0;
    openPortal(run);
    run.fx.push({ t: 'run_complete', summary: run.finalSummary });
    return true;
  }
  return false;
}

export function handleCasino(run, players, p, stakeKey, knownUnlockedSkins = []) {
  const fail = (error) => ({ ok: false, error, stakeKey });
  if (!p.alive) return fail('ИГРОК DOWN');
  if (run.phase !== 'play') return fail('BET ДОСТУПЕН ТОЛЬКО В БОЮ');
  const baseStake = BET_STAKES[stakeKey];
  const stake = casinoStakeCost(run, stakeKey);
  if (!baseStake || !stake) return fail('НЕВЕРНАЯ СТАВКА');
  const near = run.plan.interactables.find(o => o.type === 'bet' && dist2(p.x, p.y, o.x, o.y) < (INTERACT_DIST + 30) ** 2);
  if (!near) return fail('ПОДОЙДИ К BET TERMINAL');
  if (isBloodTaxRoom(run)) {
    const hpCost = bloodTaxHpCost(stake);
    if (!canPayBloodCost(p, hpCost)) {
      run.fx.push({ t: 'denied', id: p.id, obj: near.id, hpCost: 1, cost: hpCost, have: Math.round(p.hp), reason: 'NO HP' });
      return fail('НЕДОСТАТОЧНО HP');
    }
    payBloodCost(run, p, hpCost, near.x, near.y, 54);
    if (!p.alive) return fail('HP PAID');
  } else {
    if (p.economy.money < stake) {
      run.fx.push({ t: 'denied', id: p.id, obj: near.id });
      return fail('НЕДОСТАТОЧНО GLD');
    }
    p.economy.money -= stake;
  }
  const priorLock = String(p.casinoLockSymbol || '').toUpperCase();
  let res = spinCasino(Math.random, stakeKey, p.stats.luck, knownUnlockedSkins, { lockSymbol: priorLock });
  if (res.usedLock) p.casinoLockSymbol = '';
  res.stake = stake;
  const pl = res.payload;
  const stakeScale = Math.max(1, stake / Math.max(1, baseStake));
  const greedGoldBonus = isGreedRoom(run) && pl.gld ? 1.35 : 1;
  if (pl.gld) pl.gld = Math.round(pl.gld * stakeScale * greedGoldBonus);
  if (pl.xp) pl.xp = Math.round(pl.xp * Math.min(4, Math.sqrt(stakeScale)));
  if (pl.gld) p.economy.money += pl.gld;
  if (pl.xp) addXp(run, p, pl.xp);
  if (pl.heal) p.hp = Math.min(maxHp(p), p.hp + pl.heal);
  if (pl.hold) { p.casinoHoldChoices = Math.min(3, (p.casinoHoldChoices || 0) + (stakeKey === 'high' ? 2 : 1)); pl.holdLabel = `NEXT CHEST +${stakeKey === 'high' ? 2 : 1} OPTION`; }
  if (pl.lock) { const opts = casinoLockOptionsForStake(stakeKey); p.casinoLockSymbol = opts[Math.floor(Math.random() * opts.length)] || 'WPN'; pl.lockLabel = `NEXT BET LOCK: ${p.casinoLockSymbol}`; }
  if (pl.comboLink) { p.casinoComboLink = 1; pl.comboLabel = 'NEXT COMBO PAYOUT x2 IF NOT HIT'; }
  if (pl.rare) { pl.rareLabel = grantRareCasinoPrize(run, p, 'CASINO RAR'); }
  if (pl.dash) { p.stats.dashAdd += 1; p.dashCharges = Math.min(dashMax(p), p.dashCharges + 1); }
  if (pl.ability) {
    if (!applyRandomCasinoAbility(run, players, p, pl)) {
      p.stats.dashAdd += 1; pl.dash = 1; pl.abilityLabel = 'DASH +1';
      p.dashCharges = Math.min(dashMax(p), p.dashCharges + 1);
    }
  }
  if (pl.weapon) {
    const unowned = WEAPON_ORDER.filter(w => !p.weapons.includes(w));
    if (unowned.length) { const w = unowned[Math.floor(Math.random() * unowned.length)]; p.weapons.push(w); pl.weaponLabel = WEAPONS[w].label; }
    else { p.stats.weaponDmgMul = Math.max(0.05, Number(p.stats.weaponDmgMul) || 1) * 1.15; pl.weaponLabel = 'WEAPON DMG +15%'; }
  }
  if (pl.static) addStaticDebt(run, pl.debt ? 2 : 1, pl.debt ? 'casino_debt' : 'casino_bet');
  if (run.roomObjective && run.roomObjective.id && run.roomObjective.id !== 'lounge_cashout') {
    if (!run.roomContractStakes || typeof run.roomContractStakes !== 'object') run.roomContractStakes = {};
    run.roomContractStakes[p.id] = Math.max(0, (run.roomContractStakes[p.id] || 0)) + Math.max(0, stake | 0);
    pl.contractStake = run.roomContractStakes[p.id];
    run.fx.push({ t: 'contract_wager', id: p.id, name: p.name || '', stake, total: run.roomContractStakes[p.id], label: run.roomObjective.label || 'SIGNAL CONTRACT' });
  }
  const seq = (p.casinoSeq = (p.casinoSeq || 0) + 1);
  const fx = { ok: true, t: 'casino', id: p.id, name: p.name || '', personal: 1, seq, symbols: res.symbols, outcome: res.outcome, payload: res.payload, stake, lockUsed: res.usedLock ? 1 : 0, lockSymbol: res.lockSymbol || priorLock || '', hpStake: isBloodTaxRoom(run) ? bloodTaxHpCost(stake) : 0, greed: isGreedRoom(run) ? 1 : 0, bloodTax: isBloodTaxRoom(run) ? 1 : 0 };
  run.fx.push(fx);
  return fx;
}


// ---------------------------------------------------------------- transition
function beginTransition(run, players) {
  if (run.phase !== 'play') return;
  if (run.plan?.modifierIds?.includes('static_rain')) {
    const falls = Math.max(0, run.roomStaticRainFalls || 0);
    if (run.staticRainCanSeedNext && falls > 0) {
      // Only real player hits can seed the next room. Do not let warning circles or enemy-only strikes self-stack the storm.
      // Carry is based on real hits, not raw strike count. Multiple hits make the next storm worse,
      // but they no longer turn into dozens of full Static Storm levels.
      const carried = clampStaticRainLevel(Math.ceil(Math.sqrt(Math.max(0, falls))));
      if (carried > Math.max(0, run.staticRainCarry || 0)) {
        run.staticRainCarry = carried;
        run.staticRainCarrySources = { previous_room_hits: carried };
      }
    }
  }
  const st = run.roomStats || {};
  const time = roomSolvedTime(run, st);
  const noHit = (st.damageTaken || 0) <= 0 ? 1 : 0;
  const fast = time > 0 && time <= fastClearTimeLimit(run) && !roomHasLiveEnemies(run) ? 1 : 0;
  const tapes = [];
  if (noHit) tapes.push('NO HIT TAPE');
  if (fast) tapes.push('FAST CLEAN');
  if (run.plan?.modifierIds?.includes('prism_grid')) tapes.push('PRISM SLOW CLEARED');
  if (run.plan?.modifierIds?.includes('blood_tax') && (st.bloodTaxes || 0) > 0) tapes.push('BLOOD TAX PAID');
  if (run.plan?.modifierIds?.includes('hunter_contract') && run.hunterWave?.done) tapes.push('HUNTER WAVES CLEARED');
  if (run.plan?.modifierIds?.includes('casino_virus') && run.casinoVirus?.done) tapes.push('VIRUS SPINS CLEARED');
  const bonusGld = noHit ? 10 + Math.floor((run.runDepth || 0) * 1.5) : 0;
  const bonusExp = fast ? 8 + Math.floor((run.runDepth || 0) * 1.2) : 0;
  const objResult = run.roomObjectiveSettlement || settleRoomObjectiveAtPortalOpen(run) || evaluateRoomObjective(run, st, time);
  const objectiveBonusGld = 0;
  const objectiveBonusExp = 0;
  const prevContractStreak = Math.max(0, run.runMemory?.contractStreak || 0);
  const contractChain = objResult?.done ? prevContractStreak + 1 : 0;
  const doubleFavor = objResult?.done ? consumeContractFavor(run, ['double_favor']) : null;
  const earnedFavors = objResult?.done ? grantContractFavors(run, contractChain, doubleFavor ? 2 : 1) : [];
  let contractBonusGld = 0;
  let contractBonusExp = 0;
  const contractStakeEntries = Object.entries(run.roomContractStakes || {}).map(([id, amount]) => [id, Math.max(0, amount | 0)]).filter(([, amount]) => amount > 0);
  if (objResult && contractStakeEntries.length) {
    for (const [id, amount] of contractStakeEntries) {
      const pp = players.get(id);
      if (!pp || !pp.connected) continue;
      if (objResult.done) {
        const chainMul = 1 + Math.min(1.25, Math.max(0, contractChain - 1) * 0.22);
        const pay = Math.round(amount * (1.35 + Math.min(0.75, (run.runDepth || 0) * 0.025)) * chainMul);
        const xp = Math.round(Math.sqrt(amount) * (4 + Math.min(8, contractChain)));
        pp.economy.money += pay;
        addXp(run, pp, xp);
        contractBonusGld += pay; contractBonusExp += xp;
        run.fx.push({ t: 'contract_wager_paid', id, name: pp.name || '', label: objResult.label, stake: amount, gld: pay, exp: xp, chain: contractChain });
      } else {
        if (amount >= casinoStakeCost(run, 'mid') || Math.random() < 0.35) addStaticDebt(run, 1, 'contract_wager');
        run.fx.push({ t: 'contract_wager_lost', id, name: pp.name || '', label: objResult.label, stake: amount, reason: objResult.failReason || '' });
      }
    }
  }
  run.roomContractStakes = {};
  if (bonusGld || bonusExp) {
    for (const p of players.values()) if (p.connected) {
      if (bonusGld) p.economy.money += bonusGld;
      if (bonusExp) addXp(run, p, bonusExp);
    }
  }
  updateRunMemoryFromRoom(run, st, { noHit, fast, bonusGld, bonusExp, objectiveSeen: !!objResult, objectiveDone: !!objResult?.done, objectiveGld: 0, objectiveExp: 0, contractGld: contractBonusGld, contractExp: contractBonusExp, favorsEarned: earnedFavors.length });
  for (const tape of tapes) addRunTape(run, tape, tape.includes('NO HIT') || tape.includes('FAST') ? 'green' : tape.includes('STATIC') || tape.includes('WIRE') ? 'cyan' : tape.includes('BLOOD') ? 'red' : 'purple');
  if (objResult?.done) {
    addRunTape(run, `CONTRACT DONE ${objResult.label}`, 'gold');
    const favorText = earnedFavors.length ? earnedFavors.map(f => `${favorLabel(f)}${(f.uses || 0) > 1 ? ' x' + f.uses : ''}`).join(' + ') : 'NEXT ROOM PRIZE';
    run.fx.push({ t: 'contract_paid', label: objResult.label, body: favorText, favors: earnedFavors.map(f => favorSnapshotItem(f, false)) });
  } else if (objResult) {
    addRunTape(run, `CONTRACT FAILED ${objResult.label}`, 'red');
    // Failure banner is emitted at portal-open settlement. ROOM CHECK repeats the reason.
  }
  if (contractChain >= 3) addRunTape(run, `CONTRACT CHAIN x${contractChain}`, 'gold');
  if (run.skinRoomReward) addRunTape(run, `HIDDEN SKIN ${String(run.skinRoomReward.rarity || '').toUpperCase()}`, 'purple');
  run.fx.push({ t: 'room_invoice', roomId: run.plan?.roomId || '', solvedTime: Math.round(time), kills: st.kills ?? run.kills, gld: Math.round(st.gld || 0), exp: Math.round(st.exp || 0), hea: Math.round(st.hea || 0), dmg: Math.round(st.damageTaken || 0), noHit, fast, staticPaid: run.staticRainFromPending ? 1 : 0, nextStatic: nextStaticRainLevel(run, players), archetype: run.plan?.roomArchetype || 'standard', shellBreaks: st.shellBreaks || 0, prismHits: st.prismHits || 0, bloodTaxes: st.bloodTaxes || 0, wireTouches: st.wireTouches || 0, huntedWaves: st.huntedWaves || 0, bonusGld, bonusExp, objectiveBonusGld, objectiveBonusExp, contractChain, contractBonusGld, contractBonusExp, contractFavorsEarned: earnedFavors.map(f => favorSnapshotItem(f, false)), objective: objResult ? { id: objResult.id, label: objResult.label, done: objResult.done, status: objResult.done ? 'paid' : 'failed', statusLabel: objResult.done ? 'PAID' : 'FAILED', failReason: objResult.failReason || '', progress: objResult.progress, prizePreview: objResult.prizePreview || [], bonusGld: objectiveBonusGld, bonusExp: objectiveBonusExp } : null, tapes: tapes.slice(0, 4) });
  if (isFinalBossRoom(run)) {
    run.contractFavorsActive = [];
    run.contractFavorsUsedThisRoom = [];
    awardAllComboPayouts(run, players, 'room_transition');
    run.combo = createComboState();
    run.playerCombos = {};
    completeRun(run, players);
    return;
  }
  run.contractFavorsActive = [];
  run.contractFavorsUsedThisRoom = [];
  awardAllComboPayouts(run, players, 'room_transition');
  run.combo = createComboState();
  run.playerCombos = {};
  run.phase = 'install';
  run.phaseT = 0;
  run.enemies = []; run.bullets = [];
  if (run.skinRoomReward && !run.skinRoomReward.claimed) {
    run.skinRoomReward.claimed = true;
    run.fx.push({ t: 'skin_unlock', skinId: run.skinRoomReward.id, skinRarity: run.skinRoomReward.rarity, source: 'room' });
  }
  run.fx.push({ t: 'transition', skinRarity: run.skinRoomReward?.rarity || '' });
  // Combo-prize type choices are side-grades, not a whole upgrade row.
  // In one upgrade-selection phase a player may see at most one such option.
  run.installComboPrizeOfferSeen = {};
  for (const p of players.values()) {
    if (!p.connected) continue;
    if (p.bossSignaturePending) p.offer = makeBossSignatureOffer(run, p);
    else if (p.economy.pending > 0) p.offer = makeInstallOffer(run, p);
  }
}

export function handlePick(run, players, p, choiceIdx, offerId = 0) {
  if (run.phase !== 'install' || !p.offer) return false;
  const expectedOfferId = Math.max(0, p.offer.id | 0);
  const incomingOfferId = Math.max(0, offerId | 0);
  if (incomingOfferId && expectedOfferId && incomingOfferId !== expectedOfferId) return false;
  const idx = choiceIdx | 0;
  if (idx < 0 || idx >= p.offer.choices.length) return false;
  const id = p.offer.choices[idx];
  const u = UPGRADES.find(x => x.id === id);
  if (!u) return false;
  const wasBossSignature = p.offer?.kind === 'boss_signature' || BOSS_SIGNATURE_UPGRADE_IDS.includes(id);
  u.apply(p.stats);
  p.hp = Math.min(p.hp, maxHp(p));
  p.dashCharges = Math.min(dashMax(p), p.dashCharges);
  if (wasBossSignature) {
    p.bossSignaturePending = false;
    p.bossSignatureChoices = null;
    p.bossSignatureKind = '';
  } else {
    p.economy.pending = Math.max(0, p.economy.pending - 1);
  }
  run.fx.push({ t: 'install', id: p.id, label: u.label, cursed: !!u.cursed, bossSignature: wasBossSignature ? 1 : 0 });
  p.offer = p.bossSignaturePending ? makeBossSignatureOffer(run, p) : (p.economy.pending > 0 ? makeInstallOffer(run, p) : null);
  return true;
}

function stepInstall(run, players, dt) {
  run.phaseT += dt;
  let waiting = false;
  for (const p of players.values()) {
    if (!p.connected) {
      // A dropped player must not hold the whole multiplayer INSTALL phase hostage.
      p.offer = null;
      p.bossSignaturePending = false;
      p.bossSignatureChoices = null;
      continue;
    }
    ensureInstallOffer(run, p);
    if (!p.offer) continue;
    p.offer.expires -= dt;
    if (p.offer.expires <= 0) handlePick(run, players, p, 0, p.offer.id); // auto-pick first, one queued INSTALL at a time
    ensureInstallOffer(run, p);
    if (p.offer) waiting = true;
  }
  // v2.1 hotfix: do not advance just because a global install timer expired.
  // Multiple players can have multiple queued INSTALL choices; every pending stack must be offered or auto-picked.
  if (!waiting) {
    run.runDepth++;
    startRoom(run, players);
  }
}

// ---------------------------------------------------------------- active ability core/mutation runtime
function activeCoreLabel(p) {
  const a = ensureActive(p);
  const c = ACTIVE_CORES[a.core];
  if (!c) return 'НЕТ АКТИВКИ';
  const muts = activeMutationLabels(p);
  const chargeTag = a.core === 'signal_spike' ? ` [${ensureSignalSpikeCharges(p)}/${signalSpikeMaxCharges(p)}]` : (a.core === 'void_cut' ? ` [LINK ${roman(voidLaserMaxSegments(p))}]` : '');
  return `Q: ${c.label} ${roman(a.level || 1)}${chargeTag}${muts.length ? ' +' + muts.join('+') : ''}`;
}
function activeCoreDesc(p) {
  const a = ensureActive(p);
  const c = ACTIVE_CORES[a.core];
  if (!c) return 'Q сейчас пустая. Открой ABL-сундук, чтобы выбрать активку.';
  const muts = a.mutations.map(id => ACTIVE_MUTATIONS[id]).filter(Boolean);
  const chargeLine = a.core === 'signal_spike'
    ? `\nЗаряды: ${ensureSignalSpikeCharges(p)}/${signalSpikeMaxCharges(p)}. Улучшения дают больше зарядов, дольше поле и выше урон.`
    : (a.core === 'void_cut' ? `\nЗвенья луча: ${roman(voidLaserMaxSegments(p))}. Улучшения добавляют новые звенья и дальность.` : '');
  return `${c.label} ${roman(a.level || 1)}\n${c.desc}${chargeLine}` + (muts.length ? `\nМутации: ${muts.map(m => `${m.label} — ${m.desc}`).join(' / ')}` : '\nМутации: нет. Открой ABL-сундук, чтобы добавить мутацию.');
}

function activeCooldown(p) {
  const a = ensureActive(p);
  const lvl = Math.max(1, a.level || 1);
  const base = a.core === 'blood_ring' ? 7.2
    : a.core === 'field_snap' ? 6.8
    : a.core === 'bullet_freeze' ? 8.2
    : a.core === 'shell_ripper' ? 7.6
    : a.core === 'void_cut' ? 6.4
    : a.core === 'signal_spike' ? 8.0
    : a.core === 'black_box' ? 8.4
    : a.core === 'debt_pulse' ? 8.8
    : 6.5;
  return Math.max(1.8, base - (lvl - 1) * 0.65 - p.stats.luck * 0.07);
}

function signalSpikeMaxCharges(p) {
  const a = ensureActive(p);
  return a.core === 'signal_spike' ? Math.max(1, a.level || 1) : 0;
}
function ensureSignalSpikeCharges(p) {
  const a = ensureActive(p);
  if (a.core !== 'signal_spike') { delete a.spikeCharges; return 0; }
  const max = signalSpikeMaxCharges(p);
  if (typeof a.spikeCharges !== 'number') a.spikeCharges = max;
  a.spikeCharges = Math.max(0, Math.min(max, Math.floor(a.spikeCharges)));
  return a.spikeCharges;
}
function signalSpikeRecharge(p) {
  return Math.max(1.15, activeCooldown(p) * 0.72);
}
function voidLaserMaxSegments(p) {
  const a = ensureActive(p);
  return a.core === 'void_cut' ? Math.max(1, Math.min(12, a.level || 1)) : 0;
}
function voidLaserSegmentLen(lvl) {
  const extra = Math.max(0, lvl - 1);
  return Math.round(260 + Math.min(3200, extra * 360));
}
function voidLaserSegmentTtl(lvl) {
  const extra = Math.max(0, lvl - 1);
  return Math.min(9.0, 2.25 + extra * 0.85);
}
function voidLaserChainWindow(lvl) {
  return Math.min(6.0, Math.max(1.4, voidLaserSegmentTtl(lvl) + 0.45));
}
function activeField(run, f) {
  if (!run.activeFields) run.activeFields = [];
  const ttl = Math.max(0.05, Number(f.ttl) || 0.05);
  run.activeFields.push({ id: nid(), tickT: 0.08, fxT: 0.02, age: 0, maxT: ttl, baseR: f.r, ...f, ttl });
}
function activeDurationForLevel(lvl, low, high) {
  const t = Math.max(0, Math.min(1, (Math.max(1, lvl) - 1) / 2));
  return activeScale(low + (high - low) * t);
}
function activeRadiusForLevel(lvl, low, high) {
  return Math.round(activeDurationForLevel(lvl, low, high));
}
function activeExposeEnemy(run, e, lvl, owner) {
  const oldMul = e.exposedMul || 1;
  e.exposedT = Math.max(e.exposedT || 0, activeScale(3.6 + lvl * 0.65));
  e.exposedMul = Math.max(oldMul, 1 + ((1.24 + lvl * 0.08) - 1) * ACTIVE_BALANCE_SCALE);
  e.shellFlashT = Math.max(e.shellFlashT || 0, 0.18);
  run.fx.push({ t: 'active_mutation', label: 'EXPOSED', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 46 + lvl * 10), tone: 'purple', owner });
}
function activeTargets(run, x, y, r) {
  return run.enemies.filter(e => (e.hp || 0) > 0 && dist2(e.x, e.y, x, y) < (r + e.size / 2) ** 2);
}
function activeHungerTargets(run, x, y, r) {
  return activeTargets(run, x, y, r).filter(e => !ENEMIES[e.kind]?.boss || (e.hp || 0) > 0);
}

function activeFreezeEnemy(run, e, hold = 0.28) {
  if (!e) return;
  e.frozenT = Math.max(e.frozenT || 0, hold);
  e.activeSlowT = Math.max(e.activeSlowT || 0, hold);
  e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.015);
  e.fireCd = Math.max(e.fireCd || 0, Math.min(0.45, hold));
  if (typeof e.vx === 'number') e.vx *= 0.04;
  if (typeof e.vy === 'number') e.vy *= 0.04;
  if ((e.freezeFxT || 0) <= 0) {
    e.freezeFxT = 0.20;
    run.fx.push({ t: 'enemy_frozen', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 18), kind: e.kind });
  }
}
function activeDamageEnemy(run, players, e, dmg, owner, kind = 'active') {
  const before = e.hp;
  damageEnemy(run, players, e, activeScale(dmg), owner, 0, 0, 0, kind === 'dash' ? 'dash' : 'ability');
  return Math.max(0, before - Math.max(0, e.hp || 0));
}
function activeCrackShell(run, e, dmg, forceBreakLink = false) {
  if ((e.shellHp || 0) <= 0) return 0;
  const d = Math.max(1, Math.round(activeScale(dmg)));
  if (forceBreakLink) { e.armorLockT = 0; e.armorLinkId = ''; }
  e.shellRegenDelay = Math.max(e.shellRegenDelay || 0, 5.8);
  e.shellHp = Math.max(0, (e.shellHp || 0) - d);
  run.fx.push({ t: 'armor_shell', id: e.id, shellType: e.shellType || 'plain', dmg: d, left: Math.round(e.shellHp || 0), x: Math.round(e.x), y: Math.round(e.y), active: 1 });
  if (e.shellHp <= 0) { run.fx.push({ t: 'armor_break', id: e.id, shellType: e.shellType || 'plain', x: Math.round(e.x), y: Math.round(e.y), active: 1 }); rewardShellMarket(run, e.x, e.y); }
  return d;
}
function activeShrapnel(run, p, x, y, power = 1) {
  const n = Math.min(18, 8 + Math.floor(power * 3) + ensureActive(p).mutations.length);
  const rangeMul = p.stats.bulletRange || 1;
  for (let i = 0; i < n && run.bullets.length < MAX_BULLETS; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.12;
    run.bullets.push({ id: nid(), x, y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: activeScale(weaponDamageValue(p, 7 + power * 2)), from: 'p', owner: p.id, life: 0.75 * rangeMul, size: 4, proc: p.stats.procBlast * 0.35, kind: 'active_shrapnel', travelled: 0, maxDist: Math.round(450 * rangeMul), bounces: p.stats.bulletBounce || 0, rangeMul, elem: bulletElementString(p, 'weapon'), elemPower: bulletElementPower(p, 'weapon') });
  }
  run.fx.push({ t: 'active_mutation', label: 'SHRAPNEL', x: Math.round(x), y: Math.round(y), r: 85, tone: 'cyan' });
}

function activeCasinoMutationPayoutMul(run) {
  // CASINO mutation is a risky Q-side payout, so its GLD/EXP scales with the same late-run economy used by chests.
  const costMul = loopCostMul(run, 1.25);
  const econMul = loopEconomyMul(run);
  return Math.max(1, Math.min(340, Math.max(costMul, econMul)));
}
function activeCasinoMutationPayout(run, base, variance = 0) {
  const raw = Number(base || 0) + Math.random() * Math.max(0, Number(variance || 0));
  return Math.max(1, Math.round(raw * activeCasinoMutationPayoutMul(run)));
}

function buildActiveCasinoRoll(run, p, ctx) {
  const lvl = Math.max(1, ensureActive(p).level || 1);
  const luck = Math.max(0, p.stats.luck || 0);
  const r = Math.random() + luck * 0.012;
  let outcome = 'GLD', label = 'CASINO GLD', tone = 'green';
  let symbols = ['GLD', 'GLD', 'Q'];

  if (r < 0.11) { outcome = 'HIT'; label = 'CASINO HIT'; tone = 'red'; symbols = ['DMG', 'DMG', 'BAD']; }
  else if (r < 0.18) { outcome = 'DEBT'; label = 'STATIC STORM'; tone = 'purple'; symbols = ['STC', 'STORM', 'Q']; }
  else if (r < 0.38) { outcome = 'DOUBLE'; label = 'Q x2'; tone = 'cyan'; symbols = ['Q', 'Q', 'COPY']; }
  else if (r < 0.43) { outcome = 'TEN'; label = 'Q x10'; tone = 'green'; symbols = ['Q', 'Q', '10']; }
  else if (r < 0.62) { outcome = 'GLD'; label = 'CASINO GLD'; tone = 'green'; symbols = ['GLD', 'GLD', 'PAY']; }
  else if (r < 0.78) { outcome = 'EXP'; label = 'CASINO EXP'; tone = 'cyan'; symbols = ['EXP', 'EXP', 'UP']; }
  else { outcome = 'HEAL'; label = 'CASINO HEAL'; tone = 'green'; symbols = ['HEA', 'HEA', 'OK']; }

  return { owner: p.id, x: ctx.x, y: ctx.y, hitCount: ctx.hitCount || 0, core: ctx.core || ensureActive(p).core, lvl, outcome, label, tone, symbols };
}
function applyActiveCasinoRoll(run, players, cr) {
  const p = players.get(cr.owner);
  if (!p?.alive) return;
  const lvl = Math.max(1, cr.lvl || ensureActive(p).level || 1);
  if (cr.outcome === 'HIT') {
    const dmg = Math.round(9 + lvl * 5 + Math.random() * 8);
    p.hp = Math.max(1, p.hp - dmg);
    p.invuln = Math.max(p.invuln || 0, 0.18);
    run.fx.push({ t: 'phit', id: p.id, dmg, x: Math.round(p.x), y: Math.round(p.y) });
  } else if (cr.outcome === 'DEBT') {
    addStaticDebt(run, 1, 'active_casino');
  } else if (cr.outcome === 'DOUBLE') {
    if (!run.pendingActives) run.pendingActives = [];
    run.pendingActives.push({ owner: p.id, at: run.now + 0.22, core: cr.core || ensureActive(p).core, level: lvl, echo: 1, skipCasino: 1 });
  } else if (cr.outcome === 'TEN') {
    if (!run.pendingActives) run.pendingActives = [];
    for (let i = 0; i < 10; i++) run.pendingActives.push({ owner: p.id, at: run.now + 0.14 + i * 0.14, core: cr.core || ensureActive(p).core, level: 1, echo: 1, skipCasino: 1 });
  } else if (cr.outcome === 'GLD') {
    grantPersonalEconomy(run, players, p, 'GLD', activeCasinoMutationPayout(run, 10 + lvl * 5, 28), 'Q CASINO', cr.x, cr.y);
  } else if (cr.outcome === 'EXP') {
    grantPersonalEconomy(run, players, p, 'EXP', activeCasinoMutationPayout(run, 10 + lvl * 6, 18), 'Q CASINO', cr.x, cr.y);
  } else if (cr.outcome === 'HEAL') {
    grantPersonalEconomy(run, players, p, 'HEA', 10 + lvl * 5 + (cr.hitCount || 0), 'Q CASINO', cr.x, cr.y);
  }
  run.fx.push({ t: 'active_casino_roll', phase: 'result', id: p.id, x: Math.round(cr.x), y: Math.round(cr.y), symbols: cr.symbols, outcome: cr.outcome, label: cr.label, tone: cr.tone });
  run.fx.push({ t: 'active_mutation', label: cr.label, x: Math.round(cr.x), y: Math.round(cr.y), r: cr.outcome === 'TEN' ? 155 : cr.outcome === 'DOUBLE' ? 130 : 104, tone: cr.tone, squareBlast: cr.outcome === 'HIT' || cr.outcome === 'DEBT' ? 1 : 0 });
}
function activeCasinoRoll(run, p, ctx, opts = {}) {
  if (opts.skipCasino) return;
  if (!run.pendingCasinoRolls) run.pendingCasinoRolls = [];
  const cr = buildActiveCasinoRoll(run, p, ctx);
  cr.at = run.now + 1.48;
  run.pendingCasinoRolls.push(cr);
  // Start the visible roll immediately, but do not apply the reward/penalty until the reels stop.
  run.fx.push({ t: 'active_casino_roll', phase: 'spin', id: p.id, x: Math.round(ctx.x), y: Math.round(ctx.y), symbols: ['?', '?', '?'], outcome: 'SPIN', label: 'ROLLING...', tone: 'green' });
  run.fx.push({ t: 'active_mutation', label: 'CASINO ROLL', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 92, tone: 'green' });
}

function activeNoise(run, label, x, y, r = 110, tone = 'cyan', extra = {}) {
  run.fx.push({ t: 'active_mutation', label, x: Math.round(x), y: Math.round(y), r: Math.round(r), tone, ...extra });
}
function activeHasAll(p, ...ids) {
  const muts = ensureActive(p).mutations || [];
  return ids.every(id => muts.includes(id));
}
function activeNeedles(run, p, x, y, count, speed, dmg, kind = 'active_noise') {
  const rangeMul = p.stats.bulletRange || 1;
  const n = Math.max(1, Math.min(18, count | 0));
  const off = Math.random() * Math.PI * 2;
  for (let i = 0; i < n && run.bullets.length < MAX_BULLETS; i++) {
    const a = off + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.26;
    run.bullets.push({ id: nid(), x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: activeScale(weaponDamageValue(p, dmg)), from: 'p', owner: p.id, life: 0.62 * rangeMul, size: 3 + Math.min(3, n / 8), proc: p.stats.procBlast * 0.25, kind, travelled: 0, maxDist: Math.round(380 * rangeMul), bounces: p.stats.bulletBounce || 0, rangeMul, elem: bulletElementString(p, 'weapon'), elemPower: bulletElementPower(p, 'weapon') });
  }
}
function applyActiveUnstableReactions(run, players, p, ctx, opts = {}) {
  const a = ensureActive(p);
  const muts = a.mutations || [];
  if (muts.length < 2 || opts.echo) return;
  const lvl = Math.max(1, a.level || 1);
  // Intentional grime: not a deterministic clean banner. Mutations leak into each other with noisy odds.
  const baseChance = Math.min(0.88, 0.56 + (muts.length - 2) * 0.13 + p.stats.luck * 0.01);
  if (Math.random() > baseChance) return;
  let fired = 0;
  const roll = () => Math.random() < (fired ? 0.34 : 0.92);

  if (activeHasAll(p, 'static', 'blood') && roll()) {
    activeField(run, { kind: 'red_static', owner: p.id, x: ctx.x, y: ctx.y, r: Math.round((ctx.r || 130) * 0.66), ttl: activeDurationForLevel(lvl, 3.75, 4.5), tickEvery: 0.34, dmg: (5 + lvl * 2) * p.stats.dmgMul, slow: 0.48, damp: 0.33 });
    activeNoise(run, 'RED STATIC', ctx.x, ctx.y, (ctx.r || 130) * 0.74, 'red');
    fired++;
  }
  if (activeHasAll(p, 'echo', 'shrapnel') && roll()) {
    const ox = ctx.x + (Math.random() - 0.5) * 90;
    const oy = ctx.y + (Math.random() - 0.5) * 90;
    activeNeedles(run, p, ox, oy, 7 + lvl * 2, 430 + lvl * 35, 4 + lvl * 2, 'bad_copy');
    activeNoise(run, 'BAD COPY', ox, oy, 88 + lvl * 12, 'purple');
    fired++;
  }
  if (activeHasAll(p, 'static', 'shrapnel') && roll()) {
    activeNeedles(run, p, ctx.x, ctx.y, 5 + lvl, 250, 5 + lvl, 'slow_shrapnel');
    activeField(run, { kind: 'static', owner: p.id, x: ctx.x, y: ctx.y, r: activeRadiusForLevel(lvl, 100, 160), ttl: activeDurationForLevel(lvl, 3.75, 4.5), dmg: 0, slow: 0.28, damp: 0.18 });
    activeNoise(run, 'SLOW NEEDLES', ctx.x, ctx.y, 84, 'cyan');
    fired++;
  }
  if (activeHasAll(p, 'blood', 'leech') && roll()) {
    const heal = Math.min(22, 4 + (ctx.hitCount || 0) * 2.2 + lvl * 3);
    if (heal > 0) p.hp = Math.min(maxHp(p), p.hp + heal);
    activeNoise(run, `RED FEED +${Math.round(heal)}`, p.x, p.y, 76 + lvl * 8, 'green');
    fired++;
  }
  if (activeHasAll(p, 'armor_crack', 'leech') && roll()) {
    let cracked = 0;
    for (const e of run.enemies) {
      if (dist2(e.x, e.y, ctx.x, ctx.y) < ((ctx.r || 130) + 55 + e.size / 2) ** 2) cracked += activeCrackShell(run, e, 18 + lvl * 8, false);
    }
    if (cracked > 0) {
      p.hp = Math.min(maxHp(p), p.hp + Math.min(20, 4 + cracked * 0.08));
      activeNoise(run, 'SHELL FEED', ctx.x, ctx.y, (ctx.r || 130) + 70, 'green');
      fired++;
    }
  }
  if (activeHasAll(p, 'casino', 'void') && roll()) {
    if (Math.random() < 0.45) {
      dropPersonalPickup(run, p, p.x + (Math.random() - 0.5) * 80, p.y + (Math.random() - 0.5) * 80, 'GLD', 7 + Math.round(Math.random() * 18), 'Q FALSE WIN');
      activeNoise(run, 'FALSE WIN', p.x, p.y, 96, 'green');
    } else {
      p.invuln = Math.max(p.invuln || 0, 0.7 + lvl * 0.05);
      activeNoise(run, 'VOID CREDIT', p.x, p.y, 108, 'purple');
    }
    fired++;
  }
  if (ctx.core === 'bullet_freeze' && activeHasAll(p, 'shrapnel') && (ctx.hitCount || 0) > 0 && roll()) {
    const n = Math.min(14, 3 + (ctx.hitCount || 0));
    activeNeedles(run, p, ctx.x, ctx.y, n, 360, 5 + lvl * 1.5, 'frozen_shatter');
    activeNoise(run, 'SHATTER', ctx.x, ctx.y, ctx.r || 150, 'cyan');
    fired++;
  }
  if (ctx.core === 'shell_ripper' && activeHasAll(p, 'shrapnel') && roll()) {
    activeNeedles(run, p, ctx.x, ctx.y, 8 + lvl * 2, 470, 6 + lvl * 2, 'shell_shard');
    activeNoise(run, 'SHELL SHARDS', ctx.x, ctx.y, (ctx.r || 140) + 30, 'purple');
    fired++;
  }
  if (ctx.core === 'field_snap' && activeHasAll(p, 'blood', 'echo') && roll()) {
    explode(run, players, ctx.x, ctx.y, activeScale(64 + lvl * 12), activeScale(8 + lvl * 4 + (ctx.hitCount || 0)) * p.stats.dmgMul, p.id, false, 'blood');
    activeNoise(run, 'LATE PULSE', ctx.x, ctx.y, 102 + lvl * 12, 'red');
    fired++;
  }
  if (activeHasAll(p, 'anchor', 'static') && roll()) {
    activeField(run, { kind: 'anchor_field', owner: p.id, x: ctx.x, y: ctx.y, r: activeRadiusForLevel(lvl, 150, 230), ttl: activeDurationForLevel(lvl, 3.6, 5.2), tickEvery: 0.36, pull: activeRadiusForLevel(lvl, 125, 230), dmg: (3 + lvl * 2) * p.stats.dmgMul, slow: 0.24, damp: 0.16 });
    activeNoise(run, 'DEAD ZONE', ctx.x, ctx.y, 170 + lvl * 22, 'purple');
    fired++;
  }
  if (activeHasAll(p, 'hunger', 'blood') && roll()) {
    const bite = Math.min(34, 8 + (ctx.hitCount || 0) * 2.6 + lvl * 4);
    explode(run, players, ctx.x, ctx.y, activeScale(70 + lvl * 14), activeScale(bite) * p.stats.dmgMul, p.id, false, 'blood');
    p.hp = Math.min(maxHp(p), p.hp + Math.min(16, 2 + (ctx.hitCount || 0) * 1.2));
    activeNoise(run, 'RED HUNGER', ctx.x, ctx.y, 112 + lvl * 16, 'red');
    fired++;
  }
  if (activeHasAll(p, 'bad_tape', 'casino') && roll()) {
    if (Math.random() < 0.58) dropPersonalPickup(run, p, ctx.x, ctx.y, 'GLD', 11 + Math.round(Math.random() * 26), 'Q FALSE REEL');
    else addStaticDebt(run, 1, 'bad_tape');
    activeNoise(run, 'FALSE REEL', ctx.x, ctx.y, 118, Math.random() < 0.5 ? 'green' : 'purple');
    fired++;
  }
}

function applyActiveMutations(run, players, p, ctx, opts = {}) {
  const a = ensureActive(p);
  const lvl = a.level || 1;
  let mods = opts.skipEcho ? a.mutations.filter(id => id !== 'echo') : a.mutations;
  if (opts.skipCasino) mods = mods.filter(id => id !== 'casino');
  for (const id of mods) {
    if (id === 'static') {
      activeField(run, { kind: 'static', owner: p.id, x: ctx.x, y: ctx.y, r: Math.round(activeScale((ctx.r || 120) * 0.86)), ttl: activeDurationForLevel(lvl, 4.5, 6.0), dmg: 0, slow: 0.30, damp: 0.24 });
      run.fx.push({ t: 'active_mutation', label: 'STATIC', x: Math.round(ctx.x), y: Math.round(ctx.y), r: Math.round(activeScale((ctx.r || 120) * 0.86)), tone: 'cyan' });
    } else if (id === 'blood') {
      if (p.hp > 16) p.hp = Math.max(1, p.hp - Math.max(4, Math.round(maxHp(p) * 0.035)));
      explode(run, players, ctx.x, ctx.y, activeScale(92 + lvl * 16), activeScale(14 + lvl * 5 + (ctx.hitCount || 0) * 1.5) * p.stats.dmgMul, p.id, false, 'blood');
      run.fx.push({ t: 'active_mutation', label: 'BLOOD', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 105 + lvl * 16, tone: 'red' });
    } else if (id === 'echo' && !opts.echo) {
      if (!run.pendingActives) run.pendingActives = [];
      run.pendingActives.push({ owner: p.id, at: run.now + 0.58, core: a.core, level: Math.max(1, lvl - 1), echo: 1 });
      run.fx.push({ t: 'active_mutation', label: 'ECHO ARMED', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 90, tone: 'purple' });
    } else if (id === 'shrapnel') activeShrapnel(run, p, ctx.x, ctx.y, lvl);
    else if (id === 'casino') activeCasinoRoll(run, p, ctx, opts);
    else if (id === 'void') {
      p.invuln = Math.max(p.invuln || 0, 0.48 + lvl * 0.08);
      run.fx.push({ t: 'active_mutation', label: 'VOID PHASE', x: Math.round(p.x), y: Math.round(p.y), r: activeScale(80), tone: 'purple', squareBlast: 1 });
    } else if (id === 'leech') {
      const heal = Math.min(30, 5 + (ctx.hitCount || 0) * 3 + (ctx.damageDone || 0) * 0.035);
      if (heal > 0) p.hp = Math.min(maxHp(p), p.hp + heal);
      run.fx.push({ t: 'active_mutation', label: `LEECH +${Math.round(heal)}`, x: Math.round(p.x), y: Math.round(p.y), r: 72, tone: 'green' });
    } else if (id === 'armor_crack') {
      let cracked = 0;
      for (const e of run.enemies) if (dist2(e.x, e.y, ctx.x, ctx.y) < ((ctx.r || 130) + 35 + e.size / 2) ** 2) cracked += activeCrackShell(run, e, 38 + lvl * 18, true);
      if (cracked) run.fx.push({ t: 'active_mutation', label: 'ARMOR CRACK', x: Math.round(ctx.x), y: Math.round(ctx.y), r: activeScale((ctx.r || 120) + 55), tone: 'purple' });
    } else if (id === 'anchor') {
      activeField(run, { kind: 'anchor_field', owner: p.id, x: ctx.x, y: ctx.y, r: Math.round(activeScale((ctx.r || 130) * 0.58 + 88)), ttl: activeDurationForLevel(lvl, 2.9, 4.4), tickEvery: 0.30, pull: activeRadiusForLevel(lvl, 120, 240), dmg: (2 + lvl * 2) * p.stats.dmgMul, slow: 0.32, damp: 0.20 });
      run.fx.push({ t: 'active_mutation', label: 'ANCHOR', x: Math.round(ctx.x), y: Math.round(ctx.y), r: Math.round(activeScale((ctx.r || 130) * 0.62 + 95)), tone: 'purple' });
    } else if (id === 'hunger') {
      const r = Math.round(activeScale((ctx.r || 130) + 42 + lvl * 8));
      const ttl = activeDurationForLevel(lvl, 2.15, 3.05);
      activeField(run, {
        kind: 'hunger_charge', owner: p.id, x: ctx.x, y: ctx.y, r, ttl,
        tickEvery: 0.22, fxT: 0.01, charge: 0, chargeHits: 0, lvl, dmgMul: p.stats.dmgMul || 1
      });
      run.fx.push({ t: 'active_mutation', label: 'HUNGER CHARGE', x: Math.round(ctx.x), y: Math.round(ctx.y), r, tone: 'red' });
    } else if (id === 'bad_tape' && !opts.echo) {
      if (!run.pendingActives) run.pendingActives = [];
      run.pendingActives.push({ owner: p.id, at: run.now + 0.46, core: a.core, level: Math.max(1, lvl - 1), echo: 1 });
      run.pendingActives.push({ owner: p.id, at: run.now + 0.92, core: a.core, level: Math.max(1, lvl - 1), echo: 1 });
      run.fx.push({ t: 'active_mutation', label: 'BAD TAPE', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 104, tone: 'purple' });
    }
  }
}
function castActiveCore(run, players, p, opts = {}) {
  const a = ensureActive(p);
  const core = opts.core || a.core;
  const lvl = opts.level || a.level || 1;
  const ctx = { x: p.x, y: p.y, r: 120, hitCount: 0, damageDone: 0, core };
  if (core === 'blood_ring') {
    ctx.r = activeRadiusForLevel(lvl, 205, 335);
    activeField(run, { kind: 'blood_ring', owner: p.id, follow: 1, x: p.x, y: p.y, r: ctx.r, ttl: activeDurationForLevel(lvl, 4.8, 7.5), tickEvery: 0.32, dmg: (11 + lvl * 9) * p.stats.dmgMul });
    run.fx.push({ t: 'active', id: p.id, label: `BLOOD RING ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  } else if (core === 'field_snap') {
    ctx.r = activeRadiusForLevel(lvl, 310, 455);
    const pull = activeRadiusForLevel(lvl, 105, 205);
    for (const e of [...activeTargets(run, p.x, p.y, ctx.r)]) {
      const n = norm(p.x - e.x, p.y - e.y);
      e.x += n.x * pull; e.y += n.y * pull;
      e.activeSlowT = Math.max(e.activeSlowT || 0, 0.32);
      e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(0.62));
      ctx.damageDone += activeDamageEnemy(run, players, e, (18 + lvl * 11) * p.stats.dmgMul, p.id);
      ctx.hitCount++;
    }
    for (const pk of run.pickups) if (dist2(pk.x, pk.y, p.x, p.y) < (ctx.r + 140) ** 2) { const n = norm(p.x - pk.x, p.y - pk.y); pk.x += n.x * activeScale(160); pk.y += n.y * activeScale(160); }
    activeField(run, { kind: 'snap_field', owner: p.id, follow: 1, x: p.x, y: p.y, r: Math.round(ctx.r * 0.78), ttl: activeDurationForLevel(lvl, 1.8, 2.7), tickEvery: 0.28, dmg: (3 + lvl * 2) * p.stats.dmgMul, slow: 0.68, damp: 0.36, oneShotPull: 1 });
    run.fx.push({ t: 'active', id: p.id, label: `FIELD SNAP ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  } else if (core === 'bullet_freeze') {
    ctx.r = activeRadiusForLevel(lvl, 245, 405);
    let cut = 0;
    for (const b of run.bullets) {
      if (b.from !== 'e') continue;
      if (dist2(b.x, b.y, p.x, p.y) < (ctx.r + b.size) ** 2) {
        b.vx *= 0.035; b.vy *= 0.035; b.life = Math.min(b.life, 1.65 + lvl * 0.28); cut++;
        run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: 'freeze' });
      }
    }
    for (const e of [...activeTargets(run, p.x, p.y, ctx.r)]) { activeFreezeEnemy(run, e, 0.82 + lvl * 0.16); ctx.hitCount++; }
    ctx.hitCount += cut;
    activeField(run, { kind: 'freeze_aura', owner: p.id, follow: 1, x: p.x, y: p.y, r: ctx.r, ttl: activeDurationForLevel(lvl, 5.1, 7.8), dmg: 0, freezeHold: 0.26 + lvl * 0.04, damp: 0.035 });
    run.fx.push({ t: 'active', kind: 'freeze_aura', id: p.id, label: `BULLET FREEZE ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  } else if (core === 'shell_ripper') {
    ctx.r = activeRadiusForLevel(lvl, 240, 380);
    for (const e of [...activeTargets(run, p.x, p.y, ctx.r)]) {
      const shell = activeCrackShell(run, e, 88 + lvl * 58, true);
      if (shell) ctx.hitCount++;
      ctx.damageDone += shell;
      if (!shell) { activeExposeEnemy(run, e, lvl, p.id); ctx.damageDone += activeDamageEnemy(run, players, e, (14 + lvl * 8) * p.stats.dmgMul, p.id); ctx.hitCount++; }
    }
    run.fx.push({ t: 'active', id: p.id, label: `SHELL RIPPER ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  } else if (core === 'void_cut') {
    const extra = Math.max(0, lvl - 1);
    const startX = Math.round(opts.startX ?? p.x), startY = Math.round(opts.startY ?? p.y);
    const segmentIndex = Math.max(1, opts.segmentIndex || 1);
    // v2.1: VOID LASER is now a builder. Level I = one short segment.
    // Every upgrade adds +1 available point/segment and makes each segment much longer.
    const laserLen = voidLaserSegmentLen(lvl);
    const aim = aimPointFrom(p, startX, startY, laserLen, 80);
    const end = collideWalls(aim.x, aim.y, 5, run.plan.walls || [], startX, startY);
    const width = Math.max(6, Math.round(7 + Math.min(8, extra * 0.22)));
    const visualWidth = Math.max(1.25, Math.round(width * 0.18));
    const ttl = voidLaserSegmentTtl(lvl);
    const laserDmg = (32 + lvl * 16 + segmentIndex * 3) * p.stats.dmgMul;
    ctx.x = Math.round((startX + end.x) / 2);
    ctx.y = Math.round((startY + end.y) / 2);
    ctx.r = Math.round(Math.hypot(end.x - startX, end.y - startY) * 0.5 + width);
    ctx.endX = Math.round(end.x); ctx.endY = Math.round(end.y);
    ctx.segmentIndex = segmentIndex; ctx.maxSegments = voidLaserMaxSegments(p);
    p.invuln = Math.max(p.invuln || 0, 0.05 + lvl * 0.014);
    let cut = 0;
    for (const b of run.bullets) if (b.from === 'e' && distToSegment2(b.x, b.y, startX, startY, end.x, end.y) < (width + b.size) ** 2) { b.life = -1; cut++; }
    for (const e of [...run.enemies]) if (distToSegment2(e.x, e.y, startX, startY, end.x, end.y) < (width + e.size / 2) ** 2) {
      e.activeSlowT = Math.max(e.activeSlowT || 0, 0.08 + lvl * 0.014);
      e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(0.24));
      ctx.damageDone += activeDamageEnemy(run, players, e, laserDmg, p.id);
      ctx.hitCount++;
    }
    activeField(run, {
      kind: 'void_laser', owner: p.id, x: ctx.x, y: ctx.y, r: width,
      x1: Math.round(startX), y1: Math.round(startY), x2: ctx.endX, y2: ctx.endY, width, visualWidth,
      ttl, tickEvery: 0.18, dmg: (4 + lvl * 2.4) * p.stats.dmgMul, slow: 0.20, damp: 0.02
    });
    const segTag = ctx.maxSegments > 1 ? ` ${segmentIndex}/${ctx.maxSegments}` : '';
    run.fx.push({ t: 'active_line', kind: 'void_laser', id: p.id, label: `VOID LINK${segTag}${cut ? ' / ERASE ' + cut : ''}`, x1: Math.round(startX), y1: Math.round(startY), x2: ctx.endX, y2: ctx.endY, width: visualWidth, hitWidth: width, laserLen, ttl, tone: 'purple' });
    run.fx.push({ t: 'active_mutation', label: segmentIndex > 1 ? `VOID LINK ${roman(segmentIndex)}` : `VOID LASER ${roman(lvl)}`, x: Math.round(startX + (end.x - startX) * 0.12), y: Math.round(startY + (end.y - startY) * 0.12), r: Math.max(24, width * 2), tone: 'purple', squareBlast: 1 });
  } else if (core === 'signal_spike') {
    const extra = Math.max(0, lvl - 1);
    const aimRange = Math.round(activeScale(390 + Math.min(280, extra * 24)));
    const aim = activeAimPoint(p, aimRange, 140);
    ctx.x = Math.round(aim.x); ctx.y = Math.round(aim.y); ctx.r = Math.round(activeScale(158 + Math.min(82, extra * 10)));
    const ttl = activeScale(4.9 + Math.min(3.0, extra * 0.32));
    const dmg = (8.5 + lvl * 2.35) * p.stats.dmgMul;
    activeField(run, { kind: 'signal_spike', owner: p.id, x: ctx.x, y: ctx.y, r: ctx.r, ttl, tickEvery: 0.40, pull: Math.round(activeScale(34 + Math.min(70, extra * 5))), dmg, slow: 0.44, damp: 0.20 });
    for (const b of run.bullets) if (b.from === 'e' && dist2(b.x, b.y, ctx.x, ctx.y) < (ctx.r + b.size) ** 2) { b.vx *= 0.25; b.vy *= 0.25; ctx.hitCount++; }
    const chargeInfo = opts.echo ? '' : ` ${ensureSignalSpikeCharges(p)}/${signalSpikeMaxCharges(p)}`;
    run.fx.push({ t: 'active', id: p.id, label: `SIGNAL SPIKE ${roman(lvl)}${chargeInfo}`, x: ctx.x, y: ctx.y, r: ctx.r });
  } else if (core === 'black_box') {
    ctx.r = activeRadiusForLevel(lvl, 210, 340);
    let confused = 0, jammed = 0;
    // On cast, enemies already inside the box are briefly confused. Enemies outside simply stop seeing the owner via target selection.
    for (const e of [...activeTargets(run, p.x, p.y, ctx.r)]) {
      e.activeSlowT = Math.max(e.activeSlowT || 0, 0.30 + lvl * 0.06);
      e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(0.52));
      e.fireCd = Math.max(e.fireCd || 0, 0.36 + lvl * 0.10);
      confused++;
    }
    // Not a freeze aura: only a short signal jam to clear immediate incoming trash on entry.
    for (const b of run.bullets) if (b.from === 'e' && dist2(b.x, b.y, p.x, p.y) < (ctx.r + b.size) ** 2 && Math.random() < 0.18 + lvl * 0.05) { b.life = -1; jammed++; }
    activeField(run, { kind: 'black_box', owner: p.id, follow: 1, x: p.x, y: p.y, r: ctx.r, ttl: activeDurationForLevel(lvl, 4.2, 6.4), tickEvery: 0.44, dmg: 0, slow: 0.52, damp: 0.0, stealth: 1 });
    run.fx.push({ t: 'active', id: p.id, label: `BLACK BOX ${roman(lvl)}${jammed ? ' / JAM ' + jammed : ''}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r, kind: 'black_box' });
    run.fx.push({ t: 'black_box_cast', id: p.id, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r, lvl });
    ctx.hitCount += confused + jammed;
  } else if (core === 'debt_pulse') {
    ctx.r = activeRadiusForLevel(lvl, 340, 560);
    let debtRoll = Math.random() < Math.max(0.10, 0.22 - p.stats.luck * 0.012);
    if (activeHasMutation(p, 'casino')) debtRoll = Math.random() < Math.max(0.06, 0.16 - p.stats.luck * 0.015);
    for (const e of [...activeTargets(run, p.x, p.y, ctx.r)]) {
      const n = norm(e.x - p.x, e.y - p.y);
      e.x += n.x * activeScale(34 + lvl * 15); e.y += n.y * activeScale(34 + lvl * 15);
      activeExposeEnemy(run, e, lvl + 1, p.id);
      ctx.damageDone += activeDamageEnemy(run, players, e, (24 + lvl * 18) * p.stats.dmgMul, p.id);
      ctx.hitCount++;
    }
    if (debtRoll) { addStaticDebt(run, 1, 'debt_pulse'); run.fx.push({ t: 'debt', id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); }
    else if (ctx.hitCount >= 4) dropPersonalPickup(run, p, p.x + (Math.random() - 0.5) * 90, p.y + (Math.random() - 0.5) * 90, 'GLD', 10 + lvl * 8 + Math.round(Math.random() * 18), 'Q DEBT PULSE');
    run.fx.push({ t: 'active', id: p.id, label: `STATIC PULSE ${roman(lvl)}${debtRoll ? ' / STATIC' : ''}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  }
  if (!opts.chainSegment) {
    applyActiveMutations(run, players, p, ctx, { echo: opts.echo, skipEcho: opts.echo, skipCasino: opts.skipCasino });
    applyActiveUnstableReactions(run, players, p, ctx, { echo: opts.echo });
  }
  return ctx;
}
function stepActiveFields(run, players, dt) {
  if (!run.activeFields) run.activeFields = [];
  if (!run.pendingActives) run.pendingActives = [];
  if (!run.pendingCasinoRolls) run.pendingCasinoRolls = [];
  for (const cr of [...run.pendingCasinoRolls]) {
    if (run.now >= cr.at) {
      run.pendingCasinoRolls = run.pendingCasinoRolls.filter(x => x !== cr);
      applyActiveCasinoRoll(run, players, cr);
    }
  }
  for (const pe of [...run.pendingActives]) {
    if (run.now >= pe.at) {
      run.pendingActives = run.pendingActives.filter(x => x !== pe);
      const p = players.get(pe.owner);
      if (p?.alive) castActiveCore(run, players, p, { core: pe.core, level: pe.level, echo: 1, skipCasino: pe.skipCasino });
    }
  }
  for (const f of [...run.activeFields]) {
    const owner = players.get(f.owner);
    if (f.follow && owner?.alive) { f.x = owner.x; f.y = owner.y; }
    f.age = (f.age || 0) + dt;
    if (f.growTo) {
      const t = Math.max(0, Math.min(1, (f.age || 0) / Math.max(0.05, f.growTime || f.maxT || 1)));
      const ease = 1 - Math.pow(1 - t, 2);
      f.r = Math.round((f.startR ?? f.baseR ?? f.r) + (f.growTo - (f.startR ?? f.baseR ?? f.r)) * ease);
    }
    f.ttl -= dt; f.tickT -= dt; f.fxT -= dt;
    const fieldTone = (f.kind === 'blood_ring' || f.kind === 'hunger_charge') ? 'red'
      : (f.kind === 'red_static' || f.kind === 'void_tear' || f.kind === 'void_line' || f.kind === 'void_laser' || f.kind === 'black_box' || f.kind === 'anchor_field') ? 'purple'
      : 'cyan';
    if (f.fxT <= 0) {
      f.fxT = (f.kind === 'void_line' || f.kind === 'void_laser') ? 0.10 : 0.18;
      if ((f.kind === 'void_line' || f.kind === 'void_laser')) run.fx.push({ t: 'active_line', kind: f.kind, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2, width: f.visualWidth || f.width || f.r || 42, hitWidth: f.width || f.r || 42, tone: fieldTone });
      else run.fx.push({ t: 'active_field', kind: f.kind, x: Math.round(f.x), y: Math.round(f.y), r: f.r, tone: fieldTone });
    }
    if (f.kind === 'hunger_charge') {
      const targets = activeHungerTargets(run, f.x, f.y, f.r || 120);
      if (targets.length) {
        const lvl = Math.max(1, f.lvl || 1);
        const gain = targets.length * (2.2 + lvl * 0.62);
        f.charge = Math.min(140, (f.charge || 0) + gain * dt * 4.5);
        f.chargeHits = Math.min(99, (f.chargeHits || 0) + targets.length * dt * 1.6);
        for (const e of targets) {
          e.activeSlowT = Math.max(e.activeSlowT || 0, 0.10);
          e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(0.82));
        }
      }
      if (f.tickT <= 0) {
        f.tickT = f.tickEvery || 0.22;
        run.fx.push({ t: 'active_tick', kind: 'hunger_charge', x: Math.round(f.x), y: Math.round(f.y), r: Math.round((f.r || 120) + Math.min(36, (f.charge || 0) * 0.22)), tone: 'red' });
      }
      if (f.ttl <= 0 && !f.released) {
        f.released = 1;
        const lvl = Math.max(1, f.lvl || 1);
        const charge = Math.max(0, f.charge || 0);
        const biteDmg = 9 + lvl * 4.5 + charge * 0.72;
        const biteR = Math.round(activeScale(76 + lvl * 12 + Math.min(62, charge * 0.30)));
        if (charge > 0.1) explode(run, players, f.x, f.y, biteR, biteDmg * (f.dmgMul || 1), f.owner, false, 'blood');
        run.fx.push({ t: 'active_mutation', label: charge > 0.1 ? `DIGITAL BITE ${Math.round(biteDmg)}` : 'DIGITAL BITE', x: Math.round(f.x), y: Math.round(f.y), r: biteR, tone: 'red', squareBlast: 1 });
      }
    }
    if (f.kind === 'static' || f.kind === 'red_static' || f.kind === 'freeze_aura' || f.kind === 'signal_spike' || f.kind === 'black_box' || f.kind === 'void_tear' || f.kind === 'void_line' || f.kind === 'void_laser' || f.kind === 'anchor_field') {
      if ((f.kind === 'void_line' || f.kind === 'void_laser')) {
        const rr = (f.width || f.r || 42);
        for (const e of run.enemies) if (!f.bulletsOnly && distToSegment2(e.x, e.y, f.x1, f.y1, f.x2, f.y2) < (rr + e.size / 2) ** 2) {
          e.activeSlowT = Math.max(e.activeSlowT || 0, 0.20);
          e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(f.slow || 0.55));
        }
        for (const b of run.bullets) if (b.from === 'e' && distToSegment2(b.x, b.y, f.x1, f.y1, f.x2, f.y2) < (rr + b.size) ** 2) {
          const damp = Math.pow(activeSoftMul(f.damp || 0.10), dt * 6.0);
          b.vx *= damp; b.vy *= damp;
          if (Math.hypot(b.vx, b.vy) < 85) { b.life = -1; run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind || '' }); }
        }
      } else if (f.kind === 'freeze_aura') {
        // True freeze: no damage. Enemies caught in the aura stop moving, stop shooting and display an ice/signal shell.
        for (const e of run.enemies) if (!f.bulletsOnly && dist2(e.x, e.y, f.x, f.y) < (f.r + e.size / 2) ** 2) {
          activeFreezeEnemy(run, e, f.freezeHold || 0.28);
        }
        for (const b of run.bullets) if (b.from === 'e' && dist2(b.x, b.y, f.x, f.y) < (f.r + b.size) ** 2) {
          const damp = Math.pow(activeSoftMul(f.damp || 0.035), dt * 9.0);
          b.vx *= damp; b.vy *= damp;
          if (Math.hypot(b.vx, b.vy) < 18 && Math.random() < dt * 5.0) run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: 'freeze' });
        }
      } else if (f.kind === 'black_box') {
        // Stealth box: it does not freeze the room. Inside enemies are only briefly disoriented; outside enemies ignore the owner via nearestAlive().
        for (const e of run.enemies) if (!f.bulletsOnly && dist2(e.x, e.y, f.x, f.y) < (f.r + e.size / 2) ** 2) {
          e.activeSlowT = Math.max(e.activeSlowT || 0, 0.12);
          e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(f.slow || 0.52));
          e.fireCd = Math.max(e.fireCd || 0, 0.16);
        }
        // Light border jam only, so the ability reads as hiding/target drop instead of another BULLET FREEZE.
        for (const b of run.bullets) if (b.from === 'e' && dist2(b.x, b.y, f.x, f.y) < (f.r + b.size) ** 2 && Math.random() < dt * 0.85) {
          b.life = -1; run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: 'box_jam' });
        }
      } else {
      for (const e of run.enemies) if (!f.bulletsOnly && dist2(e.x, e.y, f.x, f.y) < (f.r + e.size / 2) ** 2) {
        e.activeSlowT = Math.max(e.activeSlowT || 0, 0.22);
        e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(f.slow || 0.55));
        if (f.kind === 'signal_spike' || f.kind === 'anchor_field') { const n = norm(f.x - e.x, f.y - e.y); e.x += n.x * (f.pull || 65) * dt; e.y += n.y * (f.pull || 65) * dt; }
      }
      for (const b of run.bullets) if (dist2(b.x, b.y, f.x, f.y) < (f.r + b.size) ** 2) {
        const damp = Math.pow(activeSoftMul(f.damp || 0.45), dt * (f.kind === 'freeze_aura' ? 5.2 : 3.0));
        b.vx *= damp; b.vy *= damp;
        const stopSpeed = f.kind === 'freeze_aura' ? 58 : 32;
        if (Math.hypot(b.vx, b.vy) < stopSpeed && b.from === 'e') { b.life = -1; run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind || '' }); }
      }
      }
    }
    if (f.kind === 'snap_field') {
      // FIELD SNAP pull happens once on cast. The lingering field only slows, damages and damps bullets.
      for (const e of run.enemies) if (dist2(e.x, e.y, f.x, f.y) < (f.r + e.size / 2) ** 2) {
        e.activeSlowT = Math.max(e.activeSlowT || 0, 0.18);
        e.activeSlowMul = Math.min(e.activeSlowMul || 1, activeSoftMul(f.slow || 0.72));
      }
      for (const b of run.bullets) if (b.from === 'e' && dist2(b.x, b.y, f.x, f.y) < (f.r + b.size) ** 2) { const damp = Math.pow(activeSoftMul(f.damp || 0.36), dt * 2.4); b.vx *= damp; b.vy *= damp; }
    }
    if (f.tickT <= 0) {
      f.tickT = f.tickEvery || 0.35;
      if (f.kind === 'blood_ring' || f.kind === 'red_static' || f.kind === 'snap_field' || f.kind === 'signal_spike' || f.kind === 'void_tear' || f.kind === 'void_line' || f.kind === 'void_laser' || f.kind === 'anchor_field') {
        const p = players.get(f.owner);
        if ((f.kind === 'void_line' || f.kind === 'void_laser')) {
          const rr = f.width || f.r || 42;
          for (const e of [...run.enemies]) if (distToSegment2(e.x, e.y, f.x1, f.y1, f.x2, f.y2) < (rr + e.size / 2) ** 2) activeDamageEnemy(run, players, e, f.dmg || 8, f.owner);
          run.fx.push({ t: 'active_line_tick', kind: f.kind, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2, width: f.visualWidth || Math.max(2, Math.round(rr * 0.42)), hitWidth: rr, tone: 'purple' });
        } else {
          for (const e of [...activeTargets(run, f.x, f.y, f.r)]) activeDamageEnemy(run, players, e, f.dmg || 8, f.owner);
          run.fx.push({ t: 'active_tick', kind: f.kind, x: Math.round(f.x), y: Math.round(f.y), r: f.r, tone: f.kind === 'red_static' ? 'purple' : fieldTone });
        }
        if (p && activeHasMutation(p, 'leech') && (f.kind === 'blood_ring' || f.kind === 'red_static' || f.kind === 'signal_spike')) p.hp = Math.min(maxHp(p), p.hp + 1.2);
      }
    }
  }
  run.activeFields = run.activeFields.filter(f => f.ttl > 0);
  run.bullets = run.bullets.filter(b => b.life > 0);
}

// ---------------------------------------------------------------- players
function doActive(run, players, p) {
  const a = ensureActive(p);
  if (!a.core) { run.fx.push({ t: 'active_denied', id: p.id, reason: 'missing', label: 'NO ACTIVE', x: Math.round(p.x), y: Math.round(p.y) }); p.activeCd = 0.25; return; }
  if (a.core === 'signal_spike') {
    if ((p.spikePlaceCd || 0) > 0) return;
    const max = signalSpikeMaxCharges(p);
    const charges = ensureSignalSpikeCharges(p);
    if (charges <= 0) {
      run.fx.push({ t: 'active_denied', id: p.id, reason: 'NO SPIKE CHARGES', label: `SPIKE RECHARGE ${Math.ceil((p.activeCd || 0) * 10) / 10}s`, x: Math.round(p.x), y: Math.round(p.y) });
      return;
    }
    a.spikeCharges = charges - 1;
    p.spikePlaceCd = 0.12;
    if (a.spikeCharges < max && (p.activeCd || 0) <= 0) p.activeCd = signalSpikeRecharge(p);
    castActiveCore(run, players, p);
    return;
  }
  if (a.core === 'void_cut') {
    const now = run.now || 0;
    const ch = a.voidChain;
    if (ch && ch.remaining > 0 && ch.expires > now) {
      const ctx = castActiveCore(run, players, p, { startX: ch.x, startY: ch.y, segmentIndex: (ch.index || 1) + 1, chainSegment: 1, skipCasino: 1 });
      const remaining = Math.max(0, (ch.remaining || 0) - 1);
      if (remaining > 0 && ctx?.endX != null) a.voidChain = { x: ctx.endX, y: ctx.endY, remaining, index: (ch.index || 1) + 1, expires: now + voidLaserChainWindow(a.level || 1) };
      else delete a.voidChain;
      p.voidChainPlaceCd = 0.10;
      return;
    }
    delete a.voidChain;
  }
  if (p.activeCd > 0) return;
  p.activeCd = activeCooldown(p);
  const ctx = castActiveCore(run, players, p);
  if (a.core === 'void_cut') {
    const max = voidLaserMaxSegments(p);
    if (max > 1 && ctx?.endX != null) a.voidChain = { x: ctx.endX, y: ctx.endY, remaining: max - 1, index: 1, expires: (run.now || 0) + voidLaserChainWindow(a.level || 1) };
  }
}


function spawnSeekerSwarm(run, players, p) {
  const lvl = Math.max(0, p?.stats?.sekSwarm || 0) | 0;
  if (!p?.alive || !lvl || run.phase !== 'play') return false;
  if ((p.weapons[p.weaponIdx] || '') !== 'seeker') return false;
  if ((p.sekSwarmCd || 0) > 0) {
    run.fx.push({ t: 'denied', id: p.id, reason: `SEK CD ${Math.ceil((p.sekSwarmCd || 0) * 10) / 10}s`, x: Math.round(p.x), y: Math.round(p.y) });
    return false;
  }
  const w = WEAPONS.seeker;
  const count = Math.min(35, lvl * 5);
  const dir = norm(p.aimX - p.x, p.aimY - p.y);
  const rangeMul = Math.max(0.25, p.stats.bulletRange || 1);
  const elem = bulletElementString(p, 'weapon');
  const elemPower = bulletElementPower(p, 'weapon');
  const homing = (w.homing || 0) + (p.stats.sekChain || 0) * 0.85 + 1.0;
  const life = (w.life + (p.stats.sekChain || 0) * 0.12) * rangeMul;
  const maxDist = Math.round((w.maxDist || 620) * rangeMul + (p.stats.sekChain || 0) * 42);
  const originX = p.x + dir.x * 24;
  const originY = p.y + dir.y * 24;
  const targets = run.enemies
    .filter(e => e.hp > 0)
    .sort((a, b) => dist2(a.x, a.y, originX, originY) - dist2(b.x, b.y, originX, originY))
    .slice(0, Math.max(1, Math.min(count, 12)));
  const fan = Math.min(1.35, 0.42 + count * 0.022);
  const usedTargets = new Set();
  for (let i = 0; i < count && run.bullets.length < MAX_BULLETS; i++) {
    const target = targets.length ? targets[i % targets.length] : null;
    if (target) usedTargets.add(target.id);
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const jitter = (Math.random() - 0.5) * (target ? 0.11 : 0.07);
    const baseAng = target ? Math.atan2(target.y - originY, target.x - originX) : Math.atan2(dir.y, dir.x) + (t - 0.5) * fan;
    const ang = baseAng + jitter;
    run.bullets.push({
      id: nid(), x: originX, y: originY,
      vx: Math.cos(ang) * (w.speed + 60), vy: Math.sin(ang) * (w.speed + 60),
      dmg: weaponDamageValue(p, w.dmg, 0.76), from: 'p', owner: p.id,
      life, delay: Math.floor(i / 5) * 0.025, size: w.size, aoe: 0, homing,
      knock: (w.knock || 0) * 0.85, proc: p.stats.procBlast, kind: 'seeker', travelled: 0, maxDist, rangeMul,
      bounces: p.stats.bulletBounce || 0,
      sekSplit: p.stats.sekSplit || 0,
      targetId: target?.id || '',
      elem, elemPower, echoProc: 1, bornTick: run.tick || 0
    });
  }
  p.sekSwarmCd = 2.65 + Math.max(0, lvl - 1) * 0.38;
  p.recoilT = Math.max(p.recoilT || 0, 0.10);
  p.recoilX = -dir.x * 24; p.recoilY = -dir.y * 24;
  run.fx.push({ t: 'active_mutation', label: `SEK SWARM x${count}${usedTargets.size ? ` / ${usedTargets.size} TARGETS` : ''}`, x: Math.round(originX), y: Math.round(originY), r: Math.round(60 + count * 3), tone: 'cyan', owner: p.id });
  run.fx.push({ t: 'shot', id: p.id, w: 'SEK', kind: 'seeker_swarm', x: Math.round(p.x), y: Math.round(p.y), mx: Math.round(originX), my: Math.round(originY), dx: Math.round(dir.x * 100), dy: Math.round(dir.y * 100), ammo: 0 });
  return true;
}

function fireShotgunLongshot(run, players, p) {
  const lvl = Math.max(0, p?.stats?.shgLongshot || 0) | 0;
  if (!p?.alive || !lvl || run.phase !== 'play') return false;
  if ((p.weapons[p.weaponIdx] || '') !== 'shotgun') return false;
  if ((p.shgLongshotCd || 0) > 0) {
    run.fx.push({ t: 'denied', id: p.id, reason: `SHG CD ${Math.ceil((p.shgLongshotCd || 0) * 10) / 10}s`, x: Math.round(p.x), y: Math.round(p.y) });
    return false;
  }
  const charges = Math.max(0, p.shgCharges ?? WEAPONS.shotgun.charges);
  if (charges <= 0) {
    
    return false;
  }
  const w = WEAPONS.shotgun;
  const dir = norm(p.aimX - p.x, p.aimY - p.y);
  const rangeStack = 1.5 + lvl * 0.5; // lvl1=2x, lvl2=2.5x, lvl3=3x
  const dmgStack = 1.0 + lvl * 0.2;   // lvl1=1.2x, lvl2=1.4x, lvl3=1.6x
  const rangeMul = Math.max(0.25, p.stats.bulletRange || 1) * rangeStack;
  const pellets = w.pellets + (p.stats.shgPellets || 0);
  const elem = bulletElementString(p, 'weapon');
  const elemPower = bulletElementPower(p, 'weapon');
  const originX = p.x + dir.x * 28;
  const originY = p.y + dir.y * 28;
  const slugDmg = weaponDamageValue(p, w.dmg * pellets * charges * 0.55 * dmgStack);
  run.bullets.push({
    id: nid(), x: originX, y: originY,
    vx: dir.x * 930, vy: dir.y * 930,
    dmg: slugDmg, from: 'p', owner: p.id,
    life: w.life * rangeMul, delay: 0, size: 8, aoe: 0, homing: 0,
    knock: 165 + lvl * 28, proc: p.stats.procBlast, kind: 'shotgun_slug', travelled: 0,
    maxDist: Math.round(w.speed * w.life * rangeMul), rangeMul,
    bounces: (p.stats.bulletBounce || 0) + (p.stats.shgBounce || 0),
    elem, elemPower, longshot: lvl, bornTick: run.tick || 0
  });
  p.shgCharges = 0;
  p.shgReload = Math.min(p.shgReload || 0, 0) - (0.34 + 0.10 * lvl + 0.08 * charges);
  p.shgLongshotCd = 0.36 + lvl * 0.08;
  p.fireWasDown = true;
  p.recoilT = Math.max(p.recoilT || 0, 0.18);
  p.recoilX = -dir.x * (58 + lvl * 10); p.recoilY = -dir.y * (58 + lvl * 10);
  run.fx.push({ t: 'active_mutation', label: `SHG LONGSHOT x${Math.round(rangeStack * 10) / 10}`, x: Math.round(originX), y: Math.round(originY), r: Math.round(70 + lvl * 18), tone: 'cyan', owner: p.id });
  run.fx.push({ t: 'shot', id: p.id, w: 'SHG', kind: 'shotgun_longshot', x: Math.round(p.x), y: Math.round(p.y), mx: Math.round(originX), my: Math.round(originY), dx: Math.round(dir.x * 100), dy: Math.round(dir.y * 100), ammo: 0 });
  return true;
}

function doSecondaryWeapon(run, players, p) {
  const wid = p?.weapons?.[p.weaponIdx] || '';
  if (wid === 'rocketgun') {
    if (!(p?.stats?.rktRemote || 0)) { run.fx.push({ t: 'denied', id: p.id, reason: 'NO RKT REMOTE', x: Math.round(p.x), y: Math.round(p.y) }); return false; }
    return detonateOldestRemoteRocket(run, players, p);
  }
  if (wid === 'seeker') {
    if (!(p?.stats?.sekSwarm || 0)) { run.fx.push({ t: 'denied', id: p.id, reason: 'NO SEK SWARM', x: Math.round(p.x), y: Math.round(p.y) }); return false; }
    return spawnSeekerSwarm(run, players, p);
  }
  if (wid === 'shotgun') {
    if (!(p?.stats?.shgLongshot || 0)) { run.fx.push({ t: 'denied', id: p.id, reason: 'NO SHG LONGSHOT', x: Math.round(p.x), y: Math.round(p.y) }); return false; }
    return fireShotgunLongshot(run, players, p);
  }
  return false;
}

function detonateOldestRemoteRocket(run, players, p) {
  if (!p?.alive || !(p.stats?.rktRemote || 0) || run.phase !== 'play') return false;
  let best = null;
  for (const b of run.bullets) {
    if (b.from !== 'p' || b.owner !== p.id || b.kind !== 'rocketgun' || b.mine || b.life <= 0) continue;
    if (!best || (b.bornTick || 0) < (best.bornTick || 0) || ((b.bornTick || 0) === (best.bornTick || 0) && String(b.id) < String(best.id))) best = b;
  }
  if (!best) {
    run.fx.push({ t: 'denied', id: p.id, reason: 'NO RKT', x: Math.round(p.x), y: Math.round(p.y) });
    return false;
  }
  run.fx.push({ t: 'active_mutation', label: 'RKT DETONATE', x: Math.round(best.x), y: Math.round(best.y), r: Math.round(best.aoe || 94), tone: 'red', owner: p.id });
  rocketExplode(run, players, best, best.x, best.y, best.aoe || 94, best.dmg);
  rocketAftermath(run, players, best);
  best.life = -1;
  return true;
}

function stepPlayers(run, players, dt) {
  for (const p of players.values()) {
    if (!p.connected) continue;
    p.invuln = Math.max(0, p.invuln - dt);
    p.activeCd = Math.max(0, (p.activeCd || 0) - dt);
    p.sekSwarmCd = Math.max(0, (p.sekSwarmCd || 0) - dt);
    p.shgLongshotCd = Math.max(0, (p.shgLongshotCd || 0) - dt);
    p.spikePlaceCd = Math.max(0, (p.spikePlaceCd || 0) - dt);
    p.voidChainPlaceCd = Math.max(0, (p.voidChainPlaceCd || 0) - dt);
    if (p.active?.core === 'void_cut' && p.active.voidChain && p.active.voidChain.expires <= (run.now || 0)) delete p.active.voidChain;
    if (p.active?.core === 'signal_spike') {
      const a = ensureActive(p);
      const maxSpike = signalSpikeMaxCharges(p);
      const curSpike = ensureSignalSpikeCharges(p);
      if (curSpike < maxSpike && (p.activeCd || 0) <= 0) {
        a.spikeCharges = Math.min(maxSpike, curSpike + 1);
        if (a.spikeCharges < maxSpike) p.activeCd = signalSpikeRecharge(p);
        run.fx.push({ t: 'active_mutation', label: `SPIKE CHARGE ${a.spikeCharges}/${maxSpike}`, x: Math.round(p.x), y: Math.round(p.y), r: 70, tone: 'cyan' });
      }
    } else if (p.active?.spikeCharges !== undefined) delete p.active.spikeCharges;
    p.activeBuffT = Math.max(0, (p.activeBuffT || 0) - dt);
    p.slowT = Math.max(0, (p.slowT || 0) - dt);
    // weapon recoil / ammo regen
    if (typeof p.shgCharges !== 'number') p.shgCharges = 4;
    if (typeof p.shgReload !== 'number') p.shgReload = 0;
    const shgDef = WEAPONS.shotgun;
    if (p.shgCharges < shgDef.charges) {
      // SHG is a shell/charge weapon: fire-rate upgrades help only slightly so the reload remains readable.
      const reloadScale = Math.max(0.55, 0.78 + Math.min(1.5, Math.max(0, p.stats.fireMul - 1)) * 0.18);
      p.shgReload += dt * reloadScale;
      const every = shgDef.chargeRegen;
      while (p.shgCharges < shgDef.charges && p.shgReload >= every) { p.shgReload -= every; p.shgCharges++; }
    } else p.shgReload = 0;
    if ((p.recoilT || 0) > 0 && run.phase === 'play') {
      const step = Math.min(dt, p.recoilT);
      const c = collideWalls(p.x + (p.recoilX || 0) * step, p.y + (p.recoilY || 0) * step, PLAYER_SIZE / 2, run.plan.walls, p.x, p.y);
      p.x = c.x; p.y = c.y; p.recoilT -= step;
    }
    // dash regen
    const dm = dashMax(p);
    if (p.dashCharges < dm) {
      p.dashTimer += dt;
      if (p.dashTimer >= DASH_REGEN / Math.max(0.25, p.stats.dashRegenMul || 1)) { p.dashTimer = 0; p.dashCharges++; }
    } else p.dashTimer = 0;

    if (!p.alive) continue;
    // movement
    let mx = p.moveX, my = p.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > 0.01 && run.phase === 'play') {
      const s = speed(p);
      const c = collideWalls(p.x + mx * s * dt, p.y + my * s * dt, PLAYER_SIZE / 2, run.plan.walls, p.x, p.y);
      p.x = c.x; p.y = c.y;
    }
    // dash
    if (p.wantDash && p.dashCharges > 0 && run.phase === 'play') {
      let dx = mx, dy = my;
      if (Math.hypot(dx, dy) < 0.01) { const n = norm(p.aimX - p.x, p.aimY - p.y); dx = n.x; dy = n.y; }
      const n = norm(dx, dy);
      const c = collideWalls(p.x + n.x * DASH_DIST, p.y + n.y * DASH_DIST, PLAYER_SIZE / 2, run.plan.walls, p.x, p.y);
      const ox = p.x, oy = p.y;
      dashFx(run, p, p.x, p.y, c.x, c.y);
      if (p.stats.voidStep > 0) {
        const stacks = Math.max(1, p.stats.voidStep | 0);
        const riftW = 102 + Math.min(86, stacks * 14);
        const riftDmg = (14 + stacks * 9) * p.stats.dmgMul;
        let hit = 0;
        for (const e of run.enemies) {
          if (distToSegment2(e.x, e.y, ox, oy, c.x, c.y) < (riftW + e.size / 2) ** 2) {
            activeDamageEnemy(run, players, e, riftDmg, p.id, 'dash');
            e.activeSlowT = Math.max(e.activeSlowT || 0, 0.16 + stacks * 0.03);
            e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.70);
            hit++;
          }
        }
        run.fx.push({ t: 'dash_void', id: p.id, x1: Math.round(ox), y1: Math.round(oy), x2: Math.round(c.x), y2: Math.round(c.y), w: Math.round(riftW), dmg: Math.round(riftDmg), count: hit, stacks });
      }
      if (p.stats.dashClone > 0) explode(run, players, ox, oy, 138 + p.stats.dashClone * 8, (10 + p.stats.dashClone * 5) * p.stats.dmgMul, p.id, false, 'echo');
      if (p.stats.dashCut > 0) {
        const stacks = Math.max(1, p.stats.dashCut | 0);
        const stunR = 162 + Math.min(96, stacks * 16);
        const stunDur = Math.min(4.0, 0.72 + stacks * 0.42);
        let stunned = 0;
        for (const e of run.enemies) {
          if (distToSegment2(e.x, e.y, ox, oy, c.x, c.y) < (stunR + e.size / 2) ** 2) {
            e.stunT = Math.max(e.stunT || 0, stunDur);
            e.activeSlowT = Math.max(e.activeSlowT || 0, stunDur);
            e.activeSlowMul = Math.min(e.activeSlowMul || 1, 0.04);
            e.fireCd = Math.max(e.fireCd || 0, Math.min(0.30, stunDur * 0.5));
            stunned++;
          }
        }
        if (stunned) run.fx.push({ t: 'dash_stun', id: p.id, x: Math.round((ox + c.x) / 2), y: Math.round((oy + c.y) / 2), r: Math.round(stunR), dur: Math.round(stunDur * 10) / 10, count: stunned });
      }
      p.x = c.x; p.y = c.y;
      p.dashCharges--;
      if (playerSigStack(p, 'sigRedOverdrive') > 0) p.redOverdriveShots = Math.max(p.redOverdriveShots || 0, 1);
      if (playerSigStack(p, 'sigAimGlitch') > 0) p.aimGlitchT = Math.max(p.aimGlitchT || 0, 1.15 + playerSigStack(p, 'sigAimGlitch') * 0.15);
      p.invuln = Math.max(p.invuln, DASH_INVULN);
    }
    p.wantDash = false;
    if (p.wantActive && run.phase === 'play') doActive(run, players, p);
    p.wantActive = false;
    if (p.wantSecondary && run.phase === 'play') doSecondaryWeapon(run, players, p);
    p.wantSecondary = false;
    // weapon switch
    if (p.wantWeapon >= 0 && p.wantWeapon < p.weapons.length) p.weaponIdx = p.wantWeapon;
    p.wantWeapon = -1;
    // interact
    if (p.wantInteract && run.phase === 'play') tryInteract(run, players, p);
    p.wantInteract = false;
    // fire
    if (run.phase === 'play') fireWeapon(run, players, p, dt);
  }
}

// ---------------------------------------------------------------- main step
export function step(run, players, dt, now) {
  run.now = now;
  run.tick++;
  if (run.phase === 'lost') {
    run.phaseT += dt;
    if (run.phaseT > 4) resetRun(run, players);
    return;
  }
  if (run.phase === 'won') {
    stepPickups(run, players, dt);
    return;
  }
  if (run.phase === 'install') {
    stepPickups(run, players, dt);
    stepInstall(run, players, dt);
    return;
  }
  stepSignatureModules(run, players, dt);
  stepPlayers(run, players, dt);
  stepActiveFields(run, players, dt);
  director(run, players, dt);
  stepEnemies(run, players, dt);
  stepBullets(run, players, dt);
  stepCompanions(run, players, dt, now);
  stepPickups(run, players, dt);
  stepMods(run, players, dt);
  stepCombo(run, players, dt);
  tryCleanupPortal(run);
  updateRoomObjectiveLiveState(run);
  // all dead?
  const connected = [...players.values()].filter(p => p.connected);
  if (connected.length && connected.every(p => !p.alive)) {
    run.phase = 'lost'; run.phaseT = 0;
    run.fx.push({ t: 'run_lost', depth: run.runDepth, loop: Math.floor(run.runDepth / 4) });
  }
}

// ---------------------------------------------------------------- active ability snapshot
function activeSummary(p) {
  ensureActive(p);
  return { label: activeCoreLabel(p), desc: activeCoreDesc(p) };
}

// ---------------------------------------------------------------- snapshot
export function buildSnapshot(run, players) {
  sanitizeEnemiesForRoom(run, players, 0.05);
  const ps = [];
  for (const p of players.values()) {
    if (!p.connected) continue;
    ps.push([
      p.id, Math.round(p.x), Math.round(p.y), Math.round(p.hp), maxHp(p),
      p.alive ? 1 : 0, Math.round(p.aimX), Math.round(p.aimY),
      p.weaponIdx, p.weapons.map(w => WEAPONS[w].label),
      p.dashCharges, dashMax(p),
      p.economy.level, p.economy.pending, Math.round(p.economy.money),
      Math.round(p.economy.xp), p.economy.nextLevelXp,
      p.stats.drones, 0, p.lastSeq, p.name, p.invuln > 0 ? 1 : 0,
      Math.round(speed(p)), Math.ceil((p.activeCd || 0) * 10) / 10, p.activeBuffT > 0 ? 1 : 0,
      activeSummary(p).label, activeSummary(p).desc,
      p.shgCharges ?? 4, (p.shgCharges ?? 4) >= WEAPONS.shotgun.charges ? 0 : Math.max(0, Math.ceil(((WEAPONS.shotgun.chargeRegen - (p.shgReload || 0)) / Math.max(0.55, 0.78 + Math.min(1.5, Math.max(0, p.stats.fireMul - 1)) * 0.18)) * 10) / 10),
      p.skin?.fill || '#f3f3f3', p.skin?.outline || '#00ff66', p.skin?.barrel || '#00ff66', p.skin?.id || 'terminal_mint',
      p.dashCharges < dashMax(p) ? Math.max(0, Math.ceil((DASH_REGEN / Math.max(0.25, p.stats.dashRegenMul || 1) - (p.dashTimer || 0)) * 10) / 10) : 0,
      Math.ceil((DASH_REGEN / Math.max(0.25, p.stats.dashRegenMul || 1)) * 10) / 10
    ]);
  }
  const es = combatEnemies(run).map(e => [
    e.id, KIND_IDX[e.kind], Math.round(e.x), Math.round(e.y),
    Math.round((e.hp / e.maxHp) * 100), e.size, e.state, e.elite ? 1 : 0,
    Math.round((e.dirX || 0) * 100), Math.round((e.dirY || 0) * 100),
    e.shellMax ? Math.round(((e.shellHp || 0) / e.shellMax) * 100) : 0,
    (e.armorLockT || 0) > 0 && e.armorLinkId ? 1 : 0,
    e.armorLinkId || '',
    e.shellType || '',
    (e.exposedT || 0) > 0 ? Math.round((e.exposedMul || 1.25) * 100) : 0,
    (e.frozenT || 0) > 0 ? 1 : 0,
    (e.burnT || 0) > 0 ? 1 : 0,
    (e.poisonT || 0) > 0 ? 1 : 0,
    (e.chillT || 0) > 0 ? 1 : 0,
    (e.stunT || 0) > 0 ? 1 : 0,
    ((e.shellMax || 0) > 0 && (e.shellHp || 0) > 0 && (e.shellHp || 0) < (e.shellMax || 0) && (e.shellRegenDelay || 0) <= 0) ? 1 : 0,
    Math.ceil(Math.max(0, e.spawnDelay || 0) * 10) / 10
  ]);
  const bs = run.bullets
    // Delay-buffered echo/enemy shots exist in simulation before launch, but should not be drawn
    // as floating bullets at their future origin. Mines remain visible during their arm delay.
    .filter(b => (b.delay || 0) <= 0 || b.mine)
    .map(b => [
      b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.size, b.from === 'p' ? 1 : 0, b.kind === 'rocketgun' ? 1 : 0, b.kind || '', b.elem || '', b.echoProc ? 1 : 0, b.longshot || 0, b.owner || ''
    ]);
  const cs = [];
  for (const p of players.values()) {
    if (!p.connected || !p.alive) continue;
    const drones = Math.max(0, p.stats.drones | 0);
    for (let i = 0; i < drones; i++) {
      // Drones intentionally use the same phase offset as drone firing origins.
      // This makes the rendered drone match the real projectile origin.
      const dp = orbitalPos(p, i, Math.max(1, drones), run.now + 100);
      cs.push([`drn:${p.id}:${i}`, p.id, 'drone', i, Math.round(dp.x), Math.round(dp.y)]);
    }
  }
  const ks = run.pickups.map(k => [k.id, k.type, Math.round(k.x), Math.round(k.y), k.personal ? 1 : 0, k.owner || '']);
  const os = run.plan.interactables.map(o => {
    const blood = isBloodTaxRoom(run);
    const value = o.type === 'chest' ? chestValueInfo(run, o) : null;
    return [
      o.id, o.type, o.type === 'chest' ? CHESTS[o.chest].label : 'BET',
      o.x, o.y, o.opened ? 1 : 0, o.type === 'chest' ? (blood ? bloodTaxHpCost(effectiveChestCost(run, o)) : effectiveChestCost(run, o)) : 0,
      (o.type === 'chest' && blood) ? 'HP' : 'GLD', value?.label || '', value?.tier || 0
    ];
  });
  const staticMode = staticRainCurrentMode(run);
  const currentStaticBreakdown = staticRainActiveBreakdown(run);
  const nextStaticBreakdownForCurrent = nextStaticRainBreakdown(run, players, run.plan);
  const nextStatic = nextStaticBreakdownForCurrent.total;
  const debtEngineRoomStacks = debtEngineEligiblePlan(run.plan) ? playerDebtEngineStacks(players) : 0;
  const currentIntel = roomIntel(run.plan, currentStaticBreakdown.total || 0, staticMode);
  const bossEnemy = run.enemies.find(e => ENEMIES[e.kind]?.boss);
  const bossHpPct = bossEnemy ? Math.max(0, Math.min(100, Math.round((bossEnemy.hp / Math.max(1, bossEnemy.maxHp || bossEnemy.hp || 1)) * 100))) : 0;
  const roomAge = Math.max(0, Math.round((run.now || 0) - (run.roomStats?.startedAt || run.now || 0)));
  let nextPreview = run.nextRoomPreview ? { ...run.nextRoomPreview, mods: [...(run.nextRoomPreview.mods || [])] } : null;
  if (nextPreview) {
    const nextBreakdown = nextStaticRainBreakdown(run, players, nextPreview);
    if (nextBreakdown.total > 0 && !nextPreview.mods.includes('static_rain')) nextPreview.mods.push('static_rain');
    const debtEngineNext = nextBreakdown.sources.find(s => s.id === 'debt_engine')?.level || 0;
    const ni = roomIntel(nextPreview, nextBreakdown.total, nextBreakdown.sources.some(s => s.id !== 'room_modifier') ? 'paid' : (debtEngineNext > 0 ? 'debt_engine' : 'natural'));
    nextPreview = { ...nextPreview, ...ni, staticRainLevel: nextBreakdown.total, staticRainBreakdown: nextBreakdown, debtEngineRainLevel: debtEngineNext, staticBanked: nextBreakdown.banked || 0 };
  }
  // Player-facing cleanup: internal enemy synergy markers (DMP NEST, ROTARY GUARD, etc.)
  // are noisy debug/readability overlays. Keep the gameplay synergies, but never send
  // these combo-label FX to the client.
  const fx = run.fx.filter(f => f?.t !== 'enemy_combo');
  run.fx = [];
  return {
    t: 's', tick: run.tick, now: run.now,
    room: {
      id: run.plan.roomId, cat: run.plan.category, special: run.plan.specialRoomId || '',
      loop: run.plan.loopIndex, depth: run.runDepth, inLoop: run.plan.roomInLoop,
      mods: run.plan.modifierIds, quota: Math.max(run.plan.quota || 0, directorTotalBudget(run)), baseQuota: run.plan.quota || 0, kills: run.kills, liveEnemies: liveEnemyCount(run), spawned: run.spawned, archetype: run.plan.roomArchetype || 'standard',
      w: run.plan.w, h: run.plan.h,
      portal: [Math.round(run.portal.x), Math.round(run.portal.y), run.portal.open ? 1 : 0],
      phase: run.phase, solvedTime: Math.round(roomSolvedTime(run)), solved: roomSolvedAt(run) > 0 ? 1 : 0, age: roomAge, bossKind: run.bossKind || '', bossHpPct,
      finalBoss: isFinalBossRoom(run) ? 1 : 0, runGoal: { loops: FINAL_TARGET_LOOPS, rooms: FINAL_TARGET_DEPTH, loop: finalLoopProgress(run), depth: Math.min(FINAL_TARGET_DEPTH, Math.max(0, (run.runDepth || 0) + (run.phase === 'won' ? 1 : 0))) }, finalSummary: run.finalSummary || null,
      skinReward: (run.skinRoomReward && !run.skinRoomReward.claimed) ? (run.skinRoomReward.rarity || 'uncommon') : '',
      director: run.director?.label || '', directorIntent: run.director?.lastIntent || '', directorWave: run.director?.waveIndex || 0,
      staticRainStacks: currentStaticBreakdown.total || 0, staticRainBaseStacks: run.staticRainStacks || 0, staticRainBreakdown: currentStaticBreakdown, staticRainNext: nextStatic, staticRainNextBreakdown: nextStaticBreakdownForCurrent, staticRainMode: staticMode, debtEngineStacks: debtEngineRoomStacks, debtEngineRainStacks: run.debtEngineRainStacks || 0,
      danger: currentIntel.danger, dangerLabel: currentIntel.dangerLabel, threatTags: currentIntel.threatTags, rewardTags: currentIntel.rewardTags, tip: currentIntel.tip,
      objective: run.roomObjective ? { ...decorateRoomObjective(run.roomObjective, run.runDepth || 0, Math.max(1, (run.runMemory?.contractStreak || 0) + 1), run.roomObjectiveSettlement ? { status: run.roomObjectiveSettlement.status, statusLabel: run.roomObjectiveSettlement.statusLabel, failReason: run.roomObjectiveSettlement.failReason || '', done: run.roomObjectiveSettlement.done ? 1 : 0, locked: 1 } : roomObjectiveStatus(run)), progress: run.roomObjectiveSettlement ? run.roomObjectiveSettlement.progress : roomObjectiveProgress(run) } : null,
      next: nextPreview, sockets: run.roomSockets || [], wires: run.roomWires || [], movingWalls: run.movingWalls || [], prismZones: run.prismZones || [],
      hunterWave: run.hunterWave || null, casinoVirus: run.casinoVirus || null, betStakes: casinoStakeTable(run), contractWagers: { ...(run.roomContractStakes || {}) },
      runMemory: { ...(run.runMemory || {}) }, tapeLog: (run.tapeLog || []).slice(0, 10), skinPity: run.skinPity || 0, contractFavors: contractFavorSnapshot(run), combo: comboSnapshot(run, players), playerCombos: playerCombosSnapshot(run, players), signaturesActive: activeBossSignatureLabels(players), installWait: installWaitSnapshot(run, players)
    },
    players: ps, enemies: es, bullets: bs, companions: cs, pickups: ks, objects: os, fx
  };
}

export function buildWalls(run) {
  return run.plan.walls;
}
