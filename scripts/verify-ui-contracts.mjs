import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const index = read('index.html');
const ui = [
  read('src/ui.js'),
  read('src/ui/statPanel.js'),
  read('src/ui/procFeed.js'),
  read('src/ui/screenMoment.js'),
  read('src/ui/killCombo.js'),
  read('src/ui/format.js'),
  read('src/ui/dom.js'),
  read('src/ui/roomIds.js')
].join('\n');
const main = read('src/main.js');
const rewardFeed = read('src/rewardEventFeed.js');
const input = read('src/input.js');
const style = read('style.css');
const entrySuffix = VERSION.replace(/^v/, '').replaceAll('.', '-');

assert.ok(index.includes(`id="menuStatus"`), 'menu must include visible status line');
assert.ok(index.includes(`id="bootError"`), 'index must include fatal boot error box');
assert.ok(index.includes(`id="statPanel"`), 'index must include TAB stat panel mount point');
assert.ok(index.includes(`id="procFeed"`), 'index must include proc/reward event feed mount point');
assert.ok(index.includes(`id="screenMoment"`), 'index must include full-screen dopamine moment mount point');
assert.ok(index.includes(`id="killCombo"`), 'index must include kill combo mount point');
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
assert.ok(input.includes('e.code === "Tab"') && input.includes('isTabHeld'), 'TAB must be tracked as hold-to-view UI state, not a gameplay command');
assert.ok(input.includes('uiState.tabHeld = true') && input.includes('uiState.tabHeld = false'), 'TAB must open on keydown and close on keyup/blur as a hold-to-view panel');
assert.ok(!/input\.tabHeld|tabHeld\s*[:=][^;]*(?:emptyInput|return input)/.test(input), 'TAB hold state must not be sampled into gameplay/network input');
assert.ok(style.includes('.boot-error'), 'boot error must be styled visibly');
assert.ok(style.includes('.menu-status'), 'menu status must be styled visibly');
assert.ok(style.includes('.stat-panel') && style.includes('.stat-panel.open'), 'TAB stat terminal panel must have open/closed styles');
assert.ok(style.includes('.proc-feed') && style.includes('.proc-feed-row'), 'proc/reward event feed must have terminal feed styles');
assert.ok(style.includes('install-pulse-2') && style.includes('installPulseOverflow'), 'INSTALL xN HUD pulse should scale up for x2/x3+ queues');
assert.ok(style.includes('.economy-xp-track') && style.includes('.economy-install-line'), 'economy HUD must show XP progress and a separate INSTALL queue line');
assert.ok(ui.includes('renderEconomyHud') && ui.includes('EXIT TO INSTALL') && ui.includes('INSTALL READY'), 'economy HUD must make queued INSTALL state explicit before and during safe upgrade selection');
assert.ok(ui.includes('QUEUE') && ui.includes('economyQueueLabel'), 'TAB stat panel must expose INSTALL queue status instead of only a raw count');
assert.ok(ui.includes('renderStatPanel') && ui.includes('statSnapshot'), 'TAB stat panel must render from computed player.statSnapshot');
assert.ok(read('src/ui.js').length < 22000, 'src/ui.js should stay below monolith threshold after split prep');
assert.ok(ui.includes('src/ui/*') || read('src/ui/statPanel.js').includes('renderStatPanel'), 'UI split prep modules must own extracted stat/proc helpers');
assert.ok(ui.includes('statPanelOpen') && ui.includes('!!open'), 'TAB stat panel must be driven by explicit local UI open state');
assert.ok(ui.includes('renderProcFeed') && ui.includes('setProcFeed'), 'UI must render proc/reward feed items from an explicit event-feed channel');
assert.ok(ui.includes('economyDisplayValues') && ui.includes('tweenNumber'), 'economy HUD should tick GLD/EXP values instead of only snapping instantly');
assert.ok(ui.includes('restartInstallPulse'), 'INSTALL queue HUD pulse should be explicit and tiered');
assert.ok(ui.includes('TEMP SIGNALS') && ui.includes('ALLIES'), 'TAB stat panel must show temporary signals and compact allies');

assert.ok(ui.includes('safeExpProgressText') && ui.includes('economy-exp-line'), 'EXP HUD must use safe formatting on a dedicated line, never a dangling slash string');
assert.ok(ui.includes('LOOP ${loop} / DEPTH ${depth}') && ui.includes('statSection("RUN"') && ui.includes('statSection("PLAYER"') && ui.includes('statSection("STATS"'), 'TAB panel must show clean run/player/stats sections with LOOP/DEPTH');
assert.ok(!ui.includes('HOLD TAB / DIAGNOSTIC') && !ui.includes('SYSTEM STATS'), 'TAB panel should not lead with debug/diagnostic wording');
assert.ok(style.includes('clip-path: inset(0 0 100% 0)') && style.includes('scaleY') && style.includes('translate(-50%'), 'TAB stat panel must open top-down from the top HUD area');
const statPanelCss = style.slice(style.indexOf('.stat-panel {'), style.indexOf('.proc-feed {'));
assert.ok(!statPanelCss.includes('clip-path: inset(0 100% 0 0)') && !statPanelCss.includes('scaleX(0.94)'), 'TAB stat panel must not use the old sideways reveal');
assert.ok(main.includes('createRewardEventFeed') && main.includes('snapshot?.events'), 'main loop must route authoritative snapshot events into reward event feed');
assert.ok(main.includes('createMomentFeed') && main.includes('createKillComboFeed'), 'main loop must route authoritative snapshot events into screen moment and kill combo feeds');
assert.ok(ui.includes('renderScreenMoment') && ui.includes('renderKillCombo'), 'UI split modules must render full-screen moments and kill combo counter');
assert.ok(style.includes('.screen-moment') && style.includes('.kill-combo') && style.includes('screenMomentSweep'), 'dopamine moment and kill combo overlays must be styled/animated');
assert.ok(rewardFeed.includes('LUCK PROC') && rewardFeed.includes('INSTALL +') && rewardFeed.includes('INSTALL OK') && rewardFeed.includes('RARE HEA'), 'reward event feed must define core dopamine messages');
assert.ok(rewardFeed.includes('seen') && rewardFeed.includes('lifeMs'), 'reward event feed must dedupe and expire events');

console.log('ui contract verification passed');
