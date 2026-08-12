import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, BUILD_ID } from '../shared/protocol.v2-1.js';

assert.equal(VERSION, 'v2.1.215');
assert.equal(BUILD_ID, 'install_preview_anchor_phase_signal');

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const audio = fs.readFileSync(new URL('../src/audio.v2-1.js', import.meta.url), 'utf8');
const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');

assert.match(hud, /this\.installPreviewSig === previewSig && el\.children\.length && el\.textContent\.trim\(\)/);
assert.match(hud, /next\.objectiveChoices/);
assert.match(hud, /onLangChange\(\(\) => \{[\s\S]*this\.installPreviewSig = ''/);
assert.match(hud, /if \(this\.latestRoom\) this\.renderInstallNextRoom\(this\.latestRoom\)/);
assert.match(sim, /force_room_wager_offer[\s\S]*run\.nextRoomPreview = makeNextRoomPreview\(run, players\)/);
assert.match(hud, /el\.replaceChildren\(\)/);
assert.match(hud, /el\.setAttribute\('aria-hidden', 'false'\)/);
assert.match(hud, /const staticSig = staticBd \? JSON\.stringify/);
assert.match(css, /\.install-next-room:empty\s*\{[^}]*display:\s*none\s*!important/);

assert.match(effects, /kind: 'anchorPhaseShift'/);
assert.match(effects, /e\.kind === 'anchorPhaseShift'/);
assert.match(effects, /FIELD ONLINE/);
assert.match(effects, /FIELD OFFLINE/);
assert.match(audio, /case 'anchor_phase_field':/);
assert.match(audio, /case 'anchor_phase_shots':/);
assert.match(audio, /case 'anchor_phase': this\.play\(f\.phase === 'field' \? 'anchor_phase_field' : 'anchor_phase_shots'\)/);

console.log('v2.1.215 checks passed: stable INSTALL intel content and distinct Anchor phase animation/audio');
