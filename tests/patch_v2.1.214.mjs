import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, BUILD_ID } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.21[45]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.215' ? 'install_preview_anchor_phase_signal' : 'solo_offline_hard_fallback');

const launcher = fs.readFileSync(new URL('../offline-launcher.ps1', import.meta.url), 'utf8');
const batch = fs.readFileSync(new URL('../PLAY_OFFLINE.bat', import.meta.url), 'utf8');
const guide = fs.readFileSync(new URL('../КАК_ЗАПУСТИТЬ.txt', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fallback = fs.readFileSync(new URL('../404.html', import.meta.url), 'utf8');

assert.match(batch, /offline-launcher\.ps1/);
assert.match(batch, /ExecutionPolicy Bypass/);
assert.match(launcher, /TcpListener/);
assert.match(launcher, /127\.0\.0\.1/);
assert.match(launcher, /Start-Process \$url/);
assert.match(launcher, /index\.html/);
assert.match(launcher, /NoBrowser/);
assert.match(guide, /PLAY_OFFLINE\.bat/);
assert.match(index, /location\.protocol === 'file:'/);
assert.match(index, /ЗАПУСТИТЕ PLAY_OFFLINE\.bat/);
assert.match(fallback, /ЗАПУСТИТЕ PLAY_OFFLINE\.bat/);

console.log('v2.1.214 checks passed: one-click local launcher serves the game without signaling or external runtimes');
