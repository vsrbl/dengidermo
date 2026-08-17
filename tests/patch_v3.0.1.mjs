import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import * as DATA from '../shared/data.v2-1.js';
import { buildSnapshot, createPlayer, createRun, makeAbilityChestChoices, makeWeaponChestChoices, ROOM_WAGER_CONDITIONS, ROOM_WAGER_PRIZES, ROOM_WAGER_STAKES } from '../shared/sim.v2-1.js';
import { P } from '../src/state.v2-1.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [index, fallbackPage, main, hud, i18n, effects, render, sim, dataSource, css, pkg] = await Promise.all([
  read('../index.html'), read('../404.html'), read('../src/main.v2-1.js'), read('../src/hud.v2-1.js'),
  read('../src/i18n.v2-1.js'), read('../src/effects.v2-1.js'), read('../src/render.v2-1.js'), read('../shared/sim.v2-1.js'), read('../shared/data.v2-1.js'),
  read('../style.css'), read('../package.json')
]);

assert.equal(VERSION, 'v3.0.1');
assert.equal(BUILD_ID, 'complete_ru_en_localization_audit');
assert.equal(PROTOCOL, 17, 'text-only release must preserve network compatibility');
assert.equal(JSON.parse(pkg).version, '3.0.1');
for (const html of [index, fallbackPage]) {
  assert.match(html, /style\.css\?v=3\.0\.1/);
  assert.match(html, /main\.v2-1\.js\?v=3\.0\.1/);
}
assert.equal(index, fallbackPage, 'index.html and 404.html must stay identical');
assert.doesNotMatch(index, /сетевой сектора|следующей сектора|секторми|главная угрозаа|к секторе/);
assert.doesNotMatch(index + fallbackPage + main + hud + render + css, /game-3d|webgl3d|true-3d/i, 'v3.0.1 must stay on the stable 2D renderer');

const CYRILLIC = /[А-Яа-яЁё]/;
const FORBIDDEN_RU_WORD = /\b(?:SEED|HOLD|WAIT|READY|WAGER|CONTRACT|CONDITION|REWARD|PRIZE|LOCKED|UNLOCKED|DAMAGE|SPEED|RANGE|WEAPON|ABILITY|CHEST|INSTALL|PICK|SELECT|TARGET|BOSS|ROOM|PLAYER|FREE|COST|PRICE|ACTIVE|COMPLETE|FAILED|NEXT|LEVEL|BEST|UNKNOWN|NULL|WPN|ABL|RAR|SKN|GLD|EXP|HP|CMD|CTRL|SAW|SEK|SHG|RKT|SPIKE|FWL|LVC|STATIC\s+STORM)\b/i;
const failures = [];
const checkEn = (value, path) => { if (typeof value === 'string' && CYRILLIC.test(value)) failures.push(`EN contains Cyrillic at ${path}: ${value}`); };
const checkRu = (value, path) => {
  const visible = typeof value === 'string' ? value.replace(/\$?\{[^}]*\}/g, '').replace(/<[^>]*>/g, ' ') : '';
  if (visible && FORBIDDEN_RU_WORD.test(visible)) failures.push(`RU contains untranslated word at ${path}: ${value}`);
};

function walk(value, path = 'root', seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value)) {
    for (const [key, field] of Object.entries(value)) {
      if (/en$/i.test(key) || key === 'en') checkEn(field, `${path}.${key}`);
      if (/ru$/i.test(key) || key === 'ru') checkRu(field, `${path}.${key}`);
    }
  }
  for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, seen);
}
walk(DATA, 'data');
walk({ ROOM_WAGER_CONDITIONS, ROOM_WAGER_PRIZES, ROOM_WAGER_STAKES }, 'wagers');

for (const [path, source] of [['i18n', i18n], ['hud', hud], ['main', main], ['effects', effects], ['render', render], ['sim', sim], ['data', dataSource]]) {
  const patterns = [
    /localText\(\s*'((?:\\.|[^'\\])*)'\s*,\s*'((?:\\.|[^'\\])*)'\s*\)/g,
    /localText\(\s*"((?:\\.|[^"\\])*)"\s*,\s*"((?:\\.|[^"\\])*)"\s*\)/g,
    /localText\(\s*`((?:\\.|[^`\\])*)`\s*,\s*`((?:\\.|[^`\\])*)`\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      checkRu(match[1], `${path}:localText@${match.index}`);
      checkEn(match[2], `${path}:localText@${match.index}`);
    }
  }
  for (const match of source.matchAll(/\b(?:en|[A-Za-z_$][\w$]*En)\s*:\s*'((?:\\.|[^'\\])*)'/g)) checkEn(match[1], `${path}:enField@${match.index}`);
  for (const match of source.matchAll(/\b(?:ru|[A-Za-z_$][\w$]*Ru)\s*:\s*'((?:\\.|[^'\\])*)'/g)) checkRu(match[1], `${path}:ruField@${match.index}`);
}

function objectLiteral(source, marker) {
  const markerAt = source.indexOf(marker), start = source.indexOf('{', markerAt);
  assert.ok(markerAt >= 0 && start >= 0, `missing object ${marker}`);
  let depth = 0, quote = '', escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated object ${marker}`);
}
const ruCatalog = objectLiteral(i18n, 'const RU =');
const enCatalog = objectLiteral(i18n, 'const EN =');
for (const match of ruCatalog.matchAll(/:\s*'((?:\\.|[^'\\])*)'/g)) checkRu(match[1], `i18n:RU-catalog@${match.index}`);
for (const match of enCatalog.matchAll(/:\s*'((?:\\.|[^'\\])*)'/g)) checkEn(match[1], `i18n:EN-catalog@${match.index}`);

assert.ok(ROOM_WAGER_STAKES.length >= 3 && ROOM_WAGER_CONDITIONS.length >= 3 && ROOM_WAGER_PRIZES.length >= 3);
for (const [kind, rows] of [['stake', ROOM_WAGER_STAKES], ['condition', ROOM_WAGER_CONDITIONS], ['prize', ROOM_WAGER_PRIZES]]) {
  for (const row of rows) {
    assert.ok(row.ru && row.en, `${kind} ${row.id} must have both RU and EN text`);
    checkRu(row.ru, `wager.${kind}.${row.id}.ru`);
    checkEn(row.en, `wager.${kind}.${row.id}.en`);
  }
}
assert.equal(failures.length, 0, failures.slice(0, 30).join('\n'));

assert.match(hud, /objectiveExplain|contract.*[Ee]xplain/s, 'contract cards need a detailed hover description');
assert.match(hud, /stakeTextRu|stakeTextEn/, 'wager hover must describe the stake');
assert.match(hud, /conditionTextRu|conditionTextEn/, 'wager hover must describe the condition');
assert.match(hud, /prizeTextRu|prizeTextEn/, 'wager hover must describe the prize');
assert.match(sim, /playerText:[\s\S]*activeLabelEn:[\s\S]*activeLabelRu:[\s\S]*specialDescEn:[\s\S]*specialDescRu/, 'snapshot must carry localized Q/R text');
assert.match(hud, /playerText/, 'HUD must consume localized Q/R snapshot text instead of exposing canonical simulation labels');
assert.match(effects, /casinoSymbolText/, 'casino reel symbols must be localized too');
assert.match(render, /CANVAS_LABEL_RU[\s\S]*canvasLabelText/, 'world-space canvas labels need a central RU translation layer');
assert.match(render, /label\(text,[\s\S]*canvasLabelText\(text\)/, 'every normal canvas label must use the translation layer');
assert.match(hud, /casinoDisplaySymbol/, 'all casino symbols need a language-aware display helper');
assert.doesNotMatch(hud, /textContent\s*=\s*['"]ФИКС['"]|textContent\s*=\s*reelPool\[|textContent\s*=\s*casinoSymbols\[/, 'casino animations must not bypass symbol localization');
assert.doesNotMatch(hud, /localText\(\s*['"]BET['"]\s*,\s*['"]BET['"]\s*\)|SLOT MOB[^'"`]*['"`]/, 'casino UI must not expose canonical English labels in RU');
assert.doesNotMatch(index + fallbackPage, /30\.0s|УЛУЧШЕНИЕ x0/, 'initial hidden HTML must use localized timer and multiplier typography');
assert.doesNotMatch(index + fallbackPage, />BET TERMINAL<|>READY<|>LOW<br>|>MID<br>|>HIGH<br>|>PLAY<|>8BIT<|>TERMINAL MINT</, 'the default RU document must not flash English placeholders before boot');
assert.match(i18n, /document\.title\s*=\s*localText[\s\S]*getElementById\('logo'\)[\s\S]*setExplainId\('hud-lang'/, 'language switching must update the tab title, logo, and HUD language tooltip');
assert.match(hud, /low:\s*localText\([^)]*'LOW'\)[\s\S]*mid:\s*localText\([^)]*'MID'\)[\s\S]*high:\s*localText\([^)]*'HIGH'\)/, 'casino stake labels must switch language with the HUD');
assert.match(sim, /lastLabelEn[\s\S]*lastLabelRu/, 'casino virus snapshot must preserve both language variants');
for (const receiptField of ['abilityLabelPairs', 'weaponLabelPairs', 'rareLabelPairs']) {
  assert.match(sim, new RegExp(`\\b${receiptField}\\b`), `casino receipts must preserve ${receiptField}`);
}
assert.match(sim, /captureLabelEn[\s\S]*captureLabelRu/, 'controller capture HUD must preserve localized enemy names');
assert.match(effects, /TRANSITION RESTORED[\s\S]*PORTAL LOCKED[\s\S]*WAGERS OFF/, 'rare and debug effects need explicit RU translations');
assert.match(main, /contentText\(p, getLang\(\), 'name'\)/, 'skin preview must use the localized skin name');
assert.doesNotMatch(main, /hud\.feed\(\s*['`]DEV\b/, 'debug feed must obey the active language too');
assert.match(main, /РЕЖИМ ОТЛАДКИ[\s\S]*DEBUG MODE/, 'the hidden debug panel must be bilingual');

for (const hero of ['base', 'living_casino', 'process_controller', 'impact_driver']) {
  const player = createPlayer(`locale-${hero}`, hero.toUpperCase(), 0, { hero });
  for (let trial = 1; trial <= 48; trial++) {
    let seed = trial * 2654435761 >>> 0;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
    for (const [kind, choices] of [
      ['weapon', makeWeaponChestChoices(player, rng, 5, trial % 4)],
      ['ability', makeAbilityChestChoices(player, rng, 5, trial % 4)]
    ]) {
      for (const choice of choices) {
        assert.ok(choice.labelRu && choice.labelEn, `${hero} ${kind} choice ${choice.id} lacks a localized label`);
        checkRu(choice.labelRu, `${hero}.${kind}.${choice.id}.labelRu`);
        checkEn(choice.labelEn, `${hero}.${kind}.${choice.id}.labelEn`);
        const bodyRu = choice.descRu || choice.previewRu;
        const bodyEn = choice.descEn || choice.previewEn;
        assert.ok(bodyRu && bodyEn, `${hero} ${kind} choice ${choice.id} lacks a localized description`);
        checkRu(bodyRu, `${hero}.${kind}.${choice.id}.bodyRu`);
        checkEn(bodyEn, `${hero}.${kind}.${choice.id}.bodyEn`);
      }
    }
  }
}

const controller = createPlayer('locale-controller', 'LOCALE', 0, { hero: 'process_controller' });
controller.connected = true;
const controllerRun = createRun(301001);
controllerRun.plan = { roomId: 'locale-room', category: 'combat', specialRoomId: 'chill_room', loopIndex: 0, roomInLoop: 0, w: 1600, h: 1000, interactables: [], modifierIds: [], quota: 0, walls: [] };
controllerRun.portal = { x: 1400, y: 800, open: false };
const controllerSnapshot = buildSnapshot(controllerRun, new Map([[controller.id, controller]]));
const controllerHud = controllerSnapshot.players[0][P.CTRL];
for (const field of ['selectedEn', 'selectedRu', 'selectedNameEn', 'selectedNameRu', 'captureLabelEn', 'captureLabelRu']) {
  assert.ok(field in controllerHud, `controller HUD is missing ${field}`);
}
for (const field of ['selectedEn', 'selectedRu', 'selectedNameEn', 'selectedNameRu']) {
  assert.ok(controllerHud?.[field], `controller HUD is missing ${field}`);
}
checkEn(controllerHud.selectedEn, 'snapshot.controller.selectedEn');
checkEn(controllerHud.selectedNameEn, 'snapshot.controller.selectedNameEn');
checkRu(controllerHud.selectedRu, 'snapshot.controller.selectedRu');
checkRu(controllerHud.selectedNameRu, 'snapshot.controller.selectedNameRu');
assert.equal(failures.length, 0, failures.slice(0, 30).join('\n'));

console.log('v3.0.1 checks passed: stable 2D base, complete RU/EN pairs, detailed contract and wager hovers, no cross-language leaks');
