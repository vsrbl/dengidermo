import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'legacy') continue;
      walk(full, out);
    } else if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) {
      out.push(path.relative(root, full).replaceAll(path.sep, '/'));
    }
  }
  return out;
}

function withoutComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function failOnPattern(files, pattern, message, allow = new Set()) {
  const offenders = [];
  for (const rel of files) {
    if (allow.has(rel)) continue;
    const src = withoutComments(read(rel));
    if (pattern.test(src)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `${message}: ${offenders.join(', ')}`);
}

const srcFiles = walk(path.join(root, 'src')).sort();
const gameFiles = srcFiles.filter((rel) => rel.startsWith('src/game/'));
const clientFiles = [
  'src/main.js',
  ...srcFiles.filter((rel) => rel.startsWith('src/app/') && !rel.includes('.v39-'))
].filter((rel) => fs.existsSync(path.join(root, rel)));

const gameRandomOffenders = [];
for (const rel of gameFiles) {
  const src = withoutComments(read(rel));
  if (/\bMath\.random\s*\(/.test(src)) gameRandomOffenders.push(rel);
}
assert.deepEqual(gameRandomOffenders, [], `gameplay randomness must use state.rng / seeded resolvers, not Math.random: ${gameRandomOffenders.join(', ')}`);

failOnPattern(
  gameFiles,
  /\b(?:enemy|target|e|best)\.hp\s*(?:[-+*/%]=|=\s*\1?\s*[-+])/,
  'enemy hp must not be mutated outside official damage/spawn pipelines',
  new Set([
    'src/game/effects/damage.js',
    'src/game/enemies.js',
    'src/game/enemyElites.js'
  ])
);

failOnPattern(
  gameFiles,
  /\b(?:player|p)\.hp\s*(?:[-+*/%]=|=\s*(?:Math\.min|Math\.max|clamp|[^;]*[-+]\s*[^;]*))/,
  'player hp must not be mutated outside official player health pipelines',
  new Set([
    'src/game/effects/damage.js',
    'src/game/state.js',
    'src/game/simulation.js',
    'src/game/dev.js'
  ])
);

failOnPattern(
  gameFiles,
  /state\.effects\.push\s*\(/,
  'visual effects must go through pushVisualEffect/effectCommands',
  new Set(['src/game/effectCommands.js'])
);

failOnPattern(
  gameFiles,
  /\.economy\.(?:money|xp|lifetimeXp|level|pendingUpgradeCount)\s*(?:[-+*/%]=|=)/,
  'player economy must not be mutated outside playerEconomy pipeline',
  new Set(['src/game/playerEconomy.js'])
);

failOnPattern(
  gameFiles,
  /\bplayer\.weapon\b|\bplayer\[['"]weapon['"]\]/,
  'player.weapon must not be resurrected; use player.inventory.activeWeapon'
);

failOnPattern(
  srcFiles,
  /import\s*\{[^}]*\bSTART_WEAPON\b[^}]*\}\s*from\s*["'][^"']*core\/constants\.js["']/,
  'START_WEAPON must only be imported from src/data/weapons.js'
);

failOnPattern(
  gameFiles,
  /\bmodifierId\s*={2,3}\s*["']|\bmodifier\.id\s*={2,3}\s*["']/,
  'game systems must not special-case modifier ids'
);

failOnPattern(
  gameFiles,
  /\broom\.id\s*={2,3}\s*["']|\blocation\.id\s*={2,3}\s*["']/,
  'game systems must not special-case room ids'
);

const clientForbiddenImports = [
  /from\s+["']\.\.\/game\/effects\.js["']/,
  /from\s+["']\.\.\/game\/enemyDeath\.js["']/,
  /from\s+["']\.\.\/game\/loot\.js["']/,
  /from\s+["']\.\.\/game\/roomFlow\.js["']/,
  /from\s+["']\.\.\/game\/director\.js["']/,
  /from\s+["']\.\.\/game\/enemies\.js["']/
];
const clientOffenders = [];
for (const rel of clientFiles) {
  const src = withoutComments(read(rel));
  if (rel === 'src/app/hostRuntime.js') continue;
  if (clientForbiddenImports.some((pattern) => pattern.test(src))) clientOffenders.push(rel);
  if (/\b(dealDamage|dealPlayerDamage|healPlayer|spawnEnemy|finishEnemyKill|beginRoomTransition|offerUpgradeChoices)\s*\(/.test(src)) clientOffenders.push(`${rel} runtime-authority-call`);
}
assert.deepEqual([...new Set(clientOffenders)], [], `client/prediction code must not own host-authoritative gameplay: ${clientOffenders.join(', ')}`);

const simulation = read('src/game/simulation.js');

function lineCount(rel) {
  return read(rel).split(/\r?\n/).length;
}
assert.ok(lineCount('style.css') <= 1300, 'style.css must stay below cleanup guard threshold');
assert.ok(lineCount('src/renderer.js') <= 750, 'renderer.js must stay below cleanup guard threshold until render split');
assert.ok(lineCount('src/ui.js') <= 500, 'ui.js must stay below cleanup guard threshold after UI split prep');
const pathfindingSrc = read('src/game/enemyPathfinding.js');
assert.match(pathfindingSrc, /ENEMY_PATHFINDING_SCHEMA_VERSION = 2/, 'enemy pathfinding must use the v39.3.22i flow-field schema');
assert.match(pathfindingSrc, /buildFlowField/, 'enemy pathfinding must build shared flow fields instead of per-enemy path searches');
assert.match(pathfindingSrc, /flowByKey/, 'enemy pathfinding must cache flow fields per room/target cell');
assert.doesNotMatch(pathfindingSrc, /function computePathDirection/, 'per-enemy computePathDirection BFS must not return');
assert.doesNotMatch(pathfindingSrc, /pathfindNextAt/, 'per-enemy path recalculation timers must not return');
const inputRuntime = read('src/input.js');
const clientRuntime = read('src/app/clientRuntime.js');
const combatRuntime = read('src/game/combat.js');
const hostRuntime = read('src/app/hostRuntime.js');
assert.match(simulation, /normalizeHostInput/, 'host simulation must sanitize network input before applying player movement');
assert.doesNotMatch(simulation, /acceptClientPose/, 'host simulation must not accept client-submitted px\/py as authoritative position');
assert.doesNotMatch(simulation, /\binput\.p[xy]\b/, 'host movement must ignore client-submitted position fields');
assert.doesNotMatch(inputRuntime, /\binput\.p[xy]\b/, 'client input packets should not include local pose fields');
assert.doesNotMatch(clientRuntime, /inputState\.p[xy]/, 'guest runtime must not attach local pose to input messages');
assert.doesNotMatch(combatRuntime, /payload\.(?:x|y)|originMax/, 'host combat must use authoritative player position for projectile origins');
assert.match(hostRuntime, /normalizeHostInput\(msg\.input\)/, 'host runtime must sanitize remote input packets before storing them');
assert.match(hostRuntime, /normalizeHostInput\(request\.input\)/, 'host runtime must sanitize ability input packets before applying abilities');

assert.match(hostRuntime, /updateHostWorld\(/, 'host runtime must own simulation ticking');
assert.match(hostRuntime, /fireWeapon\(/, 'host runtime must validate/execute weapon fire');
assert.match(read('src/game/combat.js'), /hasWeapon\(player, payload\.weapon\)/, 'host combat must validate requested weapon ownership');
assert.match(read('src/game/roomFlow.js'), /clearLocationRuntime\(state\)/, 'roomFlow must own transition runtime cleanup');

const rewardResolver = read('src/game/rewardResolver.js');
assert.doesNotMatch(rewardResolver, /spawnLoot\s*\(/, 'rewardResolver must not spawn legacy loot directly; use reward commands/pickups');
assert.doesNotMatch(rewardResolver, /giveWeapon\s*\(/, 'rewardResolver must not grant inventory directly; use reward pickup claim pipeline');
assert.doesNotMatch(rewardResolver, /healPlayer\s*\(/, 'rewardResolver must not heal directly; use reward pickup claim pipeline');
assert.match(rewardResolver, /executeRewardCommand\(/, 'rewardResolver must execute rewards through rewardCommands');
const rewardCommands = read('src/game/rewardCommands.js');
assert.match(rewardCommands, /spawnRewardPickup\(/, 'rewardCommands must create physical reward pickups for pickup rewards');
const rewardPickups = read('src/game/rewardPickups.js');
assert.match(rewardPickups, /claimRewardPickup/, 'reward pickup claim contract must exist');
assert.match(rewardPickups, /healPlayer\(state, player/, 'reward pickup healing must use healPlayer pipeline');
assert.match(rewardPickups, /giveWeapon\(player, data\.weaponId/, 'reward pickup weapon grant must use inventory pipeline');
assert.match(rewardPickups, /applyAbilityReward\(player, pickup\)/, 'reward pickup ability grant must use ability reward pipeline');
const effectsDamage = read('src/game/effects/damage.js');
const leechBehavior = read('src/game/enemyBehaviors/leech.js');
assert.match(effectsDamage, /export function healEnemy\(/, 'enemy recovery must have an official healEnemy pipeline');
assert.match(leechBehavior, /healEnemy\(state, ally/, 'LCH/leech support healing must use healEnemy pipeline');
assert.doesNotMatch(withoutComments(leechBehavior), /\bally\.hp\s*=/, 'LCH/leech must not mutate ally.hp directly');
const economyPickups = read('src/game/economyPickups.js');
assert.match(read('src/game/playerEconomy.js'), /sharedEconomyCreditRecipients/, 'playerEconomy must own shared pickup recipient eligibility');
assert.match(read('src/game/playerEconomy.js'), /sharedEconomyCreditRecipientIds/, 'playerEconomy must expose shared pickup recipient ids for integration/debug validation');
assert.match(economyPickups, /sharedEconomyCreditRecipients\(state\)/, 'economy pickups must use shared pickup credit recipients for alive eligible players');
assert.match(economyPickups, /validateRewardSourceEconomyType\(sourceContractId, type\)/, 'economy pickups must reject forbidden source/type combinations at spawn time');
assert.match(economyPickups, /ECONOMY_PICKUP_DELIVERY\.SHARED_ALIVE_PLAYERS/, 'economy pickup delivery must use the shared alive-player delivery constant');
assert.match(economyPickups, /ECONOMY_PICKUP_RECIPIENT_RULES\.ALIVE_PLAYERS_AT_CLAIM/, 'economy pickup recipient rule must use the alive-at-claim contract constant');
assert.match(economyPickups, /grantMoney\(state, player/, 'money pickups must grant through playerEconomy pipeline');
assert.match(economyPickups, /grantXp\(state, player/, 'XP pickups must grant through playerEconomy pipeline');
assert.match(economyPickups, /healPlayer\(state, player/, 'heal economy pickups must use healPlayer pipeline');
assert.match(economyPickups, /sharedCredit: true/, 'shared economy pickup grants must mark sharedCredit context');
const rewardSources = read('src/data/rewardSources.js');
assert.match(rewardSources, /ENEMY_REGULAR[\s\S]*ECONOMY_PICKUP_TYPES\.MONEY[\s\S]*ECONOMY_PICKUP_TYPES\.XP/, 'regular enemy reward source must allow money/xp');
assert.match(rewardSources, /validateRewardSourceEconomyType/, 'reward source contracts must expose source/type validation for integration hardening');
assert.doesNotMatch(rewardSources.match(/ENEMY_REGULAR[\s\S]*?rewardTypes: Object\.freeze\(\[\]\)/)?.[0] || '', /ECONOMY_PICKUP_TYPES\.HEAL/, 'regular enemy reward source must not allow HEA');
const dropResolver = read('src/game/dropResolver.js');
assert.match(dropResolver, /rewardSourceAllowsEconomyType/, 'enemy drops must be filtered through reward source contract');
assert.match(dropResolver, /resolveEconomyDropHook\(/, 'enemy drops must route through the explicit economy drop hook resolver');
const economyDropHooks = read('src/game/economyDropHooks.js');
assert.match(economyDropHooks, /resolveLootRoll\(/, 'economy drop hook foundation must participate in loot roll hooks');
assert.match(economyDropHooks, /ECONOMY_DROP_HOOK_SCHEMA_VERSION/, 'economy drop hook foundation must expose a schema version');
assert.match(economyDropHooks, /luckProc/, 'economy drop hooks must mark successful lucky value rolls');
assert.match(economyDropHooks, /modifierProc/, 'economy drop hooks must mark modifier-driven value rolls');
assert.match(dropResolver, /spawnEconomyPickup\(/, 'enemy drops must create economy pickups through dropResolver/economyPickups');
const enemyDeath = read('src/game/enemyDeath.js');
assert.match(enemyDeath, /spawnEnemyDrops\(state, enemy/, 'enemy kill finalizer must route baseline drops through spawnEnemyDrops');
assert.doesNotMatch(enemyDeath, /dropLoot\(/, 'enemy kill finalizer must not call legacy dropLoot');
assert.doesNotMatch(enemyDeath, /from "\.\/loot\.js"/, 'enemy kill finalizer must not import legacy loot');
const economyData = read('src/data/economy.js');
assert.match(economyData, /ECONOMY_PICKUP_DELIVERY/, 'economy data must expose pickup delivery constants');
assert.match(economyData, /ECONOMY_PICKUP_RECIPIENT_RULES/, 'economy data must expose pickup recipient-rule constants');
const playerEconomy = read('src/game/playerEconomy.js');
assert.match(playerEconomy, /queuePendingLevelUpUpgrades/, 'playerEconomy must own pending level-up queue creation');
assert.match(playerEconomy, /LEVEL_UP_QUEUE_SOURCE/, 'pending level-up queues must expose an explicit queue source');
assert.match(playerEconomy, /levelQueueSeq/, 'pending level-up queues must carry a durable sequence for snapshots/events');
const upgradesGame = read('src/game/upgrades.js');
assert.match(upgradesGame, /offerQueuedUpgradesToPlayers/, 'queued level-up upgrade offer contract must exist');
assert.match(upgradesGame, /requiresPendingUpgrade/, 'queued upgrade offers must be marked as requiring pending XP queue credit');
assert.match(upgradesGame, /UPGRADE_OFFER_SOURCES\.QUEUED_LEVEL_UP/, 'queued upgrade offers must use explicit queued_level_up source metadata');
assert.match(upgradesGame, /consumePendingUpgrade/, 'choosing an upgrade must consume a pending level-up queue entry');
assert.match(upgradesGame, /stale_offer_rejected/, 'stale queued offers must be rejectable without applying an upgrade');
assert.match(read('src/game/roomFlow.js'), /offerQueuedUpgradesToPlayers/, 'roomFlow must offer upgrades from XP queue rather than unconditional room rewards');

const statSnapshots = read('src/game/statSnapshots.js');
assert.match(statSnapshots, /STAT_SNAPSHOT_SCHEMA_VERSION/, 'stat snapshot foundation must expose a durable schema version');
assert.match(statSnapshots, /buildPlayerStatSnapshot/, 'stat snapshot foundation must expose buildPlayerStatSnapshot()');
assert.match(statSnapshots, /buildProjectileEffects\(/, 'stat snapshot must derive projectile/effect stats from the official effect pipeline');
assert.match(statSnapshots, /buildPlayerEffects\(/, 'stat snapshot must derive player utility stats from the official player effect pipeline');
assert.match(statSnapshots, /dashConfig\(/, 'stat snapshot must include active ability/dash-derived runtime stats through ability pipeline');
assert.match(statSnapshots, /getActiveWeaponDef\(/, 'stat snapshot must include active weapon-derived stats through inventory pipeline');
assert.match(read('src/game/state.js'), /statSnapshot: buildPlayerStatSnapshot\(p, state\)/, 'network snapshots must include computed statSnapshot for future TAB HUD');
assert.match(read('src/game/simulation.js'), /syncAllPlayerStatSnapshots\(state\)/, 'host simulation must refresh player stat snapshots from runtime state');

const abilityRewards = read('src/game/abilityRewards.js');
assert.match(abilityRewards, /grantAbility\(player/, 'ability rewards must grant abilities through abilityInventory pipeline');
assert.match(abilityRewards, /grantAbilityShard\(player/, 'ability rewards must grant shards through abilityInventory pipeline');

const casino = read('src/game/casino.js');
assert.match(casino, /spendMoney\(state, player/, 'casino stake spending must use playerEconomy pipeline');
assert.match(casino, /grantMoney\(state, player/, 'casino money payouts must use playerEconomy pipeline');
assert.match(casino, /grantXp\(state, player/, 'casino XP payouts must use playerEconomy pipeline');
assert.match(casino, /executeReward\(state/, 'casino non-economy payouts must route through reward commands');
assert.match(casino, /validateCasinoSpin/, 'casino must expose host-side spin validation');
assert.doesNotMatch(read('src/app/casinoClient.js'), /spendMoney|grantMoney|grantXp|executeRewardTable|spawnRewardPickup/, 'casino client must not grant rewards or mutate economy');
assert.match(read('src/app/hostRuntime.js'), /requestCasinoSpin\(/, 'host runtime must own casino spin request execution');
assert.match(read('src/render/casinoRenderers.js'), /drawCasinoInteractable/, 'casino visuals must live in casino renderer registry');


const snapshotBudget = read('src/game/snapshotBudget.js');
const visualEffectsRuntime = read('src/game/visualEffects.js');
const simulationRuntime = read('src/game/simulation.js');
const companionsRuntime = read('src/game/companions.js');
const stateRuntime = read('src/game/state.js');
const rendererRuntime = read('src/renderer.js');
assert.match(snapshotBudget, /SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES\s*=\s*64 \* 1024/, 'snapshot budget must track the server websocket message limit');
assert.match(snapshotBudget, /SNAPSHOT_WARNING_BYTES\s*=\s*52 \* 1024/, 'snapshot budget must expose a pre-limit warning threshold');
assert.match(snapshotBudget, /budgetEffects/, 'snapshot budget must own priority-aware effect trimming');
assert.match(snapshotBudget, /visualEffectPriority/, 'snapshot budget must share visual-effect priority with lifecycle runtime');
assert.match(visualEffectsRuntime, /export function tickVisualEffects/, 'visual effect lifecycle must live outside projectiles.js');
assert.match(visualEffectsRuntime, /VISUAL_EFFECT_LIFECYCLE_MAX_ACTIVE/, 'visual effect lifecycle must have an active-effect safety budget');
assert.match(simulationRuntime, /tickVisualEffects\(state, safeDt\)/, 'host simulation must tick visual effect lifecycle explicitly');
assert.doesNotMatch(read('src/game/projectiles.js'), /state\.effects\s*=\s*state\.effects\.filter|fx\.life\s*-=\s*dt/, 'projectiles.js must not own visual effect lifecycle pruning');
assert.match(companionsRuntime, /companionSnapshots\(state\)/, 'companions must expose compressed network snapshots separately from host runtime entities');
assert.match(companionsRuntime, /COMPANION_SNAPSHOT_INDIVIDUAL_LIMIT/, 'companion snapshot compression must have an explicit per-owner/kind preview budget');
assert.match(companionsRuntime, /group:\s*true/, 'companion snapshot compression must emit group markers for huge stacks');
assert.match(stateRuntime, /const companionPacket = companionSnapshots\(state\)/, 'makeSnapshot must use compressed companion snapshots, not raw companion entities');
assert.doesNotMatch(stateRuntime, /Object\.values\(state\.companions \|\| \{\}\)\.map\(\(c\) => companionSnapshot\(c\)\)/, 'makeSnapshot must not send every companion entity during unlimited-stack runs');
assert.match(stateRuntime, /const effectPacket = budgetEffects\(state\.effects\)/, 'makeSnapshot must route effects through the snapshot effect budget');
assert.match(stateRuntime, /snapshot\.budget = buildSnapshotBudgetMeta/, 'makeSnapshot must expose snapshot budget metadata for tests/debug HUDs');
assert.match(rendererRuntime, /function drawCompanionGroup/, 'renderer must support compressed companion group markers');

const chests = read('src/game/chests.js');
assert.match(chests, /executeRewardTable\(/, 'chests must resolve rewards through reward tables/reward commands');
assert.match(chests, /CHEST_STATES\.OPENING/, 'chest runtime must expose opening state');
assert.doesNotMatch(chests, /giveWeapon\s*\(/, 'chests must not grant inventory directly');
assert.doesNotMatch(chests, /healPlayer\s*\(/, 'chests must not heal directly; rewards go through pickups');
assert.match(read('src/game/interactables.js'), /activateChest\(/, 'interactable activation must delegate chest openings to the chest system');
assert.match(read('src/render/chestRenderers.js'), /drawChestInteractable/, 'chest visuals must live in chest renderer registry');
const abilities = read('src/game/abilities.js');
assert.match(abilities, /legacyDash[\s\S]+inventoryDash[\s\S]+maxCharges/, 'dash ability must combine legacy upgrade compatibility with stacked ability loot charges');

console.log(`universal game architecture verification passed (${gameFiles.length} game modules scanned)`);
