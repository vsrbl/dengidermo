import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  enemySpawnPoint,
  generateRoom,
  isEnemySpawnReachable,
  mulberry32
} from '../shared/mapgen.v2-1.js';

const player = { x: 1100, y: 750, alive: true };
let checked = 0;
for (let loop = 0; loop < 6; loop++) {
  for (let seed = 1; seed <= 80; seed++) {
    const room = generateRoom(seed * 7919 + loop, loop * 4, loop);
    for (let i = 0; i < 8; i++) {
      const p = enemySpawnPoint(mulberry32(seed * 101 + loop * 1009 + i), room.walls, [player], { half: 24 });
      assert.equal(isEnemySpawnReachable(p, room.walls, [player], 24), true, `unreachable generated spawn: loop=${loop} seed=${seed}`);
      checked++;
    }
  }
}

// A sealed pocket must be rejected, but the explicit Wall Jumper bypass remains intact.
const pocketWalls = [
  { x: 1380, y: 480, w: 40, h: 420 },
  { x: 1780, y: 480, w: 40, h: 420 },
  { x: 1380, y: 480, w: 440, h: 40 },
  { x: 1380, y: 860, w: 440, h: 40 }
];
const sealed = { x: 1600, y: 690 };
assert.equal(isEnemySpawnReachable(sealed, pocketWalls, [player], 24), false);
const relocated = enemySpawnPoint(mulberry32(181), pocketWalls, [player], { preferred: sealed, half: 24 });
assert.equal(isEnemySpawnReachable(relocated, pocketWalls, [player], 24), true);
assert.notDeepEqual(relocated, sealed);
assert.deepEqual(enemySpawnPoint(mulberry32(181), pocketWalls, [player], { preferred: sealed, half: 24, skipReachability: true }), sealed);

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const input = fs.readFileSync(new URL('../src/input.v2-1.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const page404 = fs.readFileSync(new URL('../404.html', import.meta.url), 'utf8');

assert.match(sim, /const FINAL_TARGET_LOOPS = 6;/);
assert.doesNotMatch(sim, /snap_field[^\n]+dmg: [1-9]/);
assert.doesNotMatch(sim, /ctx\.damageDone \+= activeDamageEnemy\(run, players, e, \(18 \+ lvl \* 11\)/);
assert.doesNotMatch(sim, /return tier >= 3 \? 'STC'/);
assert.match(sim, /bulletCorrosionArmorDamage/);
assert.match(sim, /if \(out\.length === 1\) while \(out\.length < max\) out\.push\(out\[0\]\)/);
assert.match(data, /Каждый уровень быстрее разрушает броню/);
assert.match(hud, /each stack strips armor faster/);
assert.doesNotMatch(hud, /function comboExplain/);
assert.doesNotMatch(input, /Space[^\n]+inspectMode/);
assert.match(index, /v2\.1\.(?:18[1-9]|19[0-9]|(?:20[0-9]|21[0-5]))/);
assert.match(page404, /v2\.1\.(?:18[1-9]|19[0-9]|(?:20[0-9]|21[0-5]))/);
assert.doesNotMatch(index, /hud-inspect/);
assert.doesNotMatch(page404, /hud-inspect/);

console.log(`v2.1.181 checks passed: ${checked} generated spawn points + sealed-pocket guard + patch invariants`);
