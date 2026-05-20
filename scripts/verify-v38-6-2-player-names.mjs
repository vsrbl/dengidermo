import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const uiSrc = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const mainSrc = [
  readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/app/session.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/app/hostRuntime.js', import.meta.url), 'utf8')
].join('\n');
const transportSrc = readFileSync(new URL('../src/net/transport.js', import.meta.url), 'utf8');
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const rendererSrc = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('v38.13.7 is registered', () => {
  assert.equal(VERSION, 'v38.13.7');
  assert.equal(pkg.version, '38.13.7');
  assert.equal(serverPkg.version, '38.13.7');
  assert.match(htmlSrc, /V38\.13\.7/);
  assert.match(serverSrc, /nncckkrr signaling v38\.13\.7/);
  assert.match(pkg.scripts['check:all'], /check:v38-6-2/);
});

test('main menu exposes a thin player name field', () => {
  assert.match(htmlSrc, /id="nameInput"/);
  assert.match(htmlSrc, />NAME<\/span>/);
  assert.match(uiSrc, /nameInput: document\.getElementById\("nameInput"\)/);
  assert.match(uiSrc, /import \{ normalizePlayerName \} from "\.\/core\/names\.js"/);
  assert.match(mainSrc, /localStorage\.getItem\("nncckkrr\.name"\)/);
  assert.match(mainSrc, /localStorage\.setItem\("nncckkrr\.name"/);
});

test('nickname metadata travels through signaling without replacing player ids', () => {
  assert.match(transportSrc, /connectHost\(roomId, options = \{\}\)/);
  assert.match(transportSrc, /type: "create", roomId, maxPlayers: MAX_PLAYERS, name: options\.name/);
  assert.match(transportSrc, /type: "join", roomId, name: options\.name/);
  assert.match(serverSrc, /function roomNames\(room\)/);
  assert.match(serverSrc, /normalizePlayerName\(msg\.name/);
  assert.match(serverSrc, /players: playerList, names/);
  assert.match(transportSrc, /this\.players = new Set/);
  assert.match(transportSrc, /this\.names = new Map/);
});

test('join lifecycle no longer emits a redundant players broadcast', () => {
  assert.doesNotMatch(serverSrc, /broadcast\(room, \{ type: "players"/);
  assert.match(transportSrc, /if \(Array\.isArray\(msg\.players\)\) this\.players = new Set\(msg\.players\)/);
  assert.match(transportSrc, /this\.syncNames\(msg\.names\)/);
});

test('host snapshots carry display names only as presentation metadata', () => {
  assert.match(stateSrc, /name: displayPlayerName\(options\.name/);
  assert.match(stateSrc, /name: p\.name \|\| p\.id\.toUpperCase\(\)/);
  assert.match(mainSrc, /addPlayer\(app\.hostState, id, index, \{ name: session\.playerDisplayName\(id\) \}\)/);
  assert.match(mainSrc, /applyHostPlayerNames\(\)/);
  assert.match(mainSrc, /app\.players = app\.players\.filter\(\(player\) => player !== id\)/);
  assert.match(rendererSrc, /String\(p\.name \|\| p\.id\)\.slice\(0, 12\)/);

  const state = createGameState('NAME-TEST');
  addPlayer(state, 'p2', 1, { name: 'guest_two' });
  const snap = makeSnapshot(state);
  assert.equal(snap.players[0].id, 'p2');
  assert.equal(snap.players[0].name, 'GUEST_TWO');
});

test('explicit leave is owned by transport close', () => {
  assert.match(mainSrc, /transport\?\.close\(true\);/);
  assert.doesNotMatch(mainSrc, /sendLeaveNotice\?\.\(\)/);
  assert.doesNotMatch(mainSrc, /const leavingRole = role/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.7 player name checks passed`);
