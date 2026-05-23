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

const hostRuntime = read('src/app/hostRuntime.js');
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
const abilityRewards = read('src/game/abilityRewards.js');
assert.match(abilityRewards, /grantAbility\(player/, 'ability rewards must grant abilities through abilityInventory pipeline');
assert.match(abilityRewards, /grantAbilityShard\(player/, 'ability rewards must grant shards through abilityInventory pipeline');
const abilities = read('src/game/abilities.js');
assert.match(abilities, /legacyDash \|\| inventoryDash/, 'dash ability must preserve legacy upgrade compatibility while allowing ability loot');

console.log(`universal game architecture verification passed (${gameFiles.length} game modules scanned)`);
