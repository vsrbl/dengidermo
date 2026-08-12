import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import { isEnemySpawnReachable } from '../shared/mapgen.v2-1.js';
import {
  bossLoopHpMultiplier, bossOrderForRun, createPlayer, createRun,
  damageEnemy, handleDevCommand, startRoom
} from '../shared/sim.v2-1.js';
import { BUILD_ID, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.21[1-5]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.211' ? 'trinode_chase_loop_hp_splitter_audio' : VERSION === 'v2.1.212' ? 'boss_q_silence_fullscreen_signal' : VERSION === 'v2.1.215' ? 'install_preview_anchor_phase_signal' : 'solo_offline_hard_fallback');
assert.equal(ENEMIES.boss_trinode.hp, 1680 * 4);

function playerMap(id = 'qa211') {
  const p = createPlayer(id, 'QA', 0);
  return { p, players: new Map([[p.id, p]]) };
}

// TRI always receives its own connected, wall-heavy chase arena and never
// loses it to the once-per-run ROOT LOCKDOWN selection.
{
  const { p, players } = playerMap('tri-room-211');
  const run = createRun(21101);
  const triIndex = bossOrderForRun(run).indexOf('boss_trinode');
  assert.ok(triIndex >= 0);
  run.runMemory.bossesDefeated = triIndex;
  run.runDepth = 3 + triIndex * 4;
  run.devNextRoomOverride = { category: 'boss', modifierIds: [] };
  startRoom(run, players);
  const boss = run.enemies.find(e => e.kind === 'boss_trinode');
  assert.ok(boss);
  assert.equal(run.plan.roomArchetype, 'trinode_chase');
  assert.equal(run.plan.trinodeChase, 1);
  assert.equal(run.rootLock, null);
  const internalWalls = run.plan.walls.filter(w => w.x >= 0 && w.y >= 0 && w.x + w.w <= run.plan.w && w.y + w.h <= run.plan.h);
  assert.ok(internalWalls.length >= 12, `TRI arena has only ${internalWalls.length} internal walls`);
  const inside = (x, y, pad = 0) => run.plan.walls.some(w => x + pad > w.x && x - pad < w.x + w.w && y + pad > w.y && y - pad < w.y + w.h);
  assert.equal(inside(p.x, p.y, 16), false);
  assert.equal(inside(boss.x, boss.y, boss.size / 2), false);
  assert.equal(isEnemySpawnReachable({ x: boss.x, y: boss.y }, run.plan.walls, [p], boss.size / 2), true);
}

// Every boss definition receives explicit monotonic loop HP scaling.
{
  assert.equal(bossLoopHpMultiplier({ runDepth: 3 }), 1);
  assert.equal(bossLoopHpMultiplier({ runDepth: 7 }), 1.25);
  assert.equal(bossLoopHpMultiplier({ runDepth: 11 }), 1.5);
  const bossKinds = ['boss_croupier', 'boss_anchor_cashier', 'boss_hunter_chorus', 'boss_q_revisor', 'boss', 'boss_trinode'];
  for (const kind of bossKinds) {
    const hpAt = depth => {
      const { p, players } = playerMap(`${kind}-${depth}`);
      const run = createRun(21110 + depth);
      run.runDepth = depth;
      startRoom(run, players);
      run.enemies = [];
      assert.equal(handleDevCommand(run, players, p, { action: 'spawn_boss', kind }), true);
      return run.enemies.find(e => e.kind === kind).maxHp;
    };
    assert.ok(hpAt(7) > hpAt(3), `${kind} did not gain HP on loop 2`);
  }
}

// Every destroyed TRI square ejects a fresh splitter pack. Those splitters
// retain their ordinary two-stage split-on-death behavior.
{
  const { p, players } = playerMap('tri-split-211');
  const run = createRun(21130);
  startRoom(run, players);
  run.enemies = [];
  assert.equal(handleDevCommand(run, players, p, { action: 'spawn_boss', kind: 'boss_trinode' }), true);
  const boss = run.enemies.find(e => e.kind === 'boss_trinode');
  boss.spawnDelay = 0;
  boss.shellHp = 0;
  boss.shellMax = 0;
  for (let section = 0; section < 3; section++) {
    const hp = boss.trinodeParts[0].hp;
    damageEnemy(run, players, boss, hp + 999999, p.id, 0, 0, 0, 'qa');
    if (section < 2) boss.trinodeUnlockT = 0;
    assert.equal(run.enemies.filter(e => e.packRole === 'trinode_splitter_pack').length, (section + 1) * 2);
  }
  const seedSplitter = run.enemies.find(e => e.packRole === 'trinode_splitter_pack');
  const splittersBefore = run.enemies.filter(e => e.kind === 'splitter').length;
  damageEnemy(run, players, seedSplitter, seedSplitter.hp + 9999, p.id, 0, 0, 0, 'qa');
  assert.ok(run.enemies.filter(e => e.kind === 'splitter').length > splittersBefore, 'TRI pack splitter did not split on death');
  assert.equal(run.fx.filter(f => f.t === 'summon' && f.kind === 'trinode_splitter_pack').length, 3);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const audio = fs.readFileSync(new URL('../src/audio.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /roomArchetype = 'trinode_chase'/);
assert.match(sim, /packRole: 'trinode_splitter_pack'/);
assert.match(audio, /case 'trinode_break': this\.play\('trinode_section_break'\); break;/);
assert.doesNotMatch(audio, /case 'trinode_break':[^\n]*slot_overload[^\n]*blast[^\n]*impact/);
assert.match(audio, /trinode_section_break: 0\.32/);

console.log('v2.1.211 checks passed: TRI chase arena, x4 base HP, all-boss loop HP scaling, splitter packs and dedicated transition audio');
