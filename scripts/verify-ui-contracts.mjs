import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const index = read('index.html');
const ui = read('src/ui.js');
const input = read('src/input.js');
const style = read('style.css');
const entrySuffix = VERSION.replace(/^v/, '').replaceAll('.', '-');

assert.ok(index.includes(`id="menuStatus"`), 'menu must include visible status line');
assert.ok(index.includes(`id="bootError"`), 'index must include fatal boot error box');
assert.ok(index.includes(`window.NN_SHOW_BOOT_ERROR`), 'boot error handler must exist before module entry');
assert.ok(index.includes(`src/main.v${entrySuffix}.js?v=${VERSION.replace(/^v/, '')}`), 'index must use cache-busted versioned module entry');
assert.ok(index.includes(`${VERSION.toUpperCase()} | BUILD ${BUILD_ID.split('-').at(-1)}`), 'HUD should expose version and build');
assert.ok(ui.includes('setMenuStatus'), 'UI must expose setMenuStatus');
assert.ok(ui.includes('SERVER OK') || ui.includes('release'), 'UI/status layer must render release/server status');
assert.ok(input.includes('event.code') || input.includes('.code'), 'movement input must use keyboard codes, not layout-dependent characters');
assert.ok(input.includes('e.code === "KeyE"') && input.includes('onInteract'), 'E must be reserved for explicit interact requests');
assert.ok(input.includes('e.code === "KeyQ"') && input.includes('future active item'), 'Q must be reserved for a future active item/ability slot');
assert.ok(!/KeyQ[\s\S]{0,160}onWeaponCycle|onWeaponCycle[\s\S]{0,160}KeyQ/.test(input), 'Q must not cycle weapons');
assert.ok(!/KeyE[\s\S]{0,160}onWeaponCycle|onWeaponCycle[\s\S]{0,160}KeyE/.test(input), 'E must not cycle weapons');
assert.ok(input.includes('addEventListener("wheel"') && input.includes('onWeaponCycle'), 'mouse wheel should remain the quick weapon-cycle control');
assert.ok(style.includes('.boot-error'), 'boot error must be styled visibly');
assert.ok(style.includes('.menu-status'), 'menu status must be styled visibly');

console.log('ui contract verification passed');
