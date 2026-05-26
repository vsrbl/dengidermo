import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, RELEASE_CHANNEL, SIGNALING_PROTOCOL_VERSION, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const readJson = (rel) => JSON.parse(read(rel));
const expectedVersion = VERSION.replace(/^v/, '');
const suffix = expectedVersion.replaceAll('.', '-');
const currentEntry = `src/main.v${suffix}.js`;
const VERSIONED_APP_MODULES = Object.freeze([
  'session',
  'clientRuntime',
  'hostRuntime',
  'upgradeClient',
  'devControls',
  'releaseIntegrity',
  'casinoClient'
]);

function assertOnlyCurrentVersionedFiles() {
  const srcDir = path.join(root, 'src');
  const appDir = path.join(srcDir, 'app');
  for (const file of fs.readdirSync(srcDir)) {
    if (!/^main\.v.+\.js$/.test(file)) continue;
    assert.equal(`src/${file}`, currentEntry, `stale versioned entry should not ship: src/${file}`);
  }
  for (const file of fs.readdirSync(appDir)) {
    const match = file.match(/^(.+)\.v(.+)\.js$/);
    if (!match) continue;
    const [, name] = match;
    assert.ok(VERSIONED_APP_MODULES.includes(name), `unknown versioned app module should not ship: src/app/${file}`);
    assert.equal(file, `${name}.v${suffix}.js`, `stale versioned module should not ship: src/app/${file}`);
  }
}

function assertNoRuntimeStaleVersion(rel, stale) {
  const src = read(rel);
  assert.ok(!src.includes(stale), `${rel} must not contain stale runtime version ${stale}`);
}

const manifest = readJson('release.json');
const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const srcPkg = readJson('src/package.json');

assert.equal(manifest.version, VERSION, 'release.json version must match constants');
assert.equal(manifest.buildId, BUILD_ID, 'release.json buildId must match constants');
assert.equal(manifest.channel, RELEASE_CHANNEL, 'release.json channel must match constants');
assert.equal(manifest.protocol, SIGNALING_PROTOCOL_VERSION, 'release.json protocol must match constants');
assert.equal(manifest.entry, `./${currentEntry}?v=${expectedVersion}`, 'release.json entry must match current cache-busted entry');
assert.equal(manifest.style, `./style.css?v=${expectedVersion}`, 'release.json style URL must match index cache bust');
assert.equal(manifest.config, `./config.js?v=${expectedVersion}`, 'release.json config URL must match index cache bust');
assert.ok(/^https:\/\//.test(manifest.signalingUrl), 'release.json signalingUrl should be explicit https URL');
assert.equal(manifest.healthPath, '/health', 'release.json healthPath must be /health');

assert.equal(pkg.version, expectedVersion, 'root package version must match release');
assert.equal(serverPkg.version, expectedVersion, 'server package version must match release');
assert.equal(srcPkg.version, expectedVersion, 'src package version must match release');

const index = read('index.html');
assert.ok(index.includes(`name="nncckkrr-version" content="${VERSION}"`), 'index version meta must match release');
assert.ok(index.includes(`name="nncckkrr-build" content="${BUILD_ID}"`), 'index build meta must match release');
assert.ok(index.includes(`name="nncckkrr-protocol" content="${SIGNALING_PROTOCOL_VERSION}"`), 'index protocol meta must match release');
assert.ok(index.includes(`name="nncckkrr-release-manifest" content="./release.json?v=${expectedVersion}"`), 'index must expose release manifest meta');
assert.ok(index.includes(`href="./style.css?v=${expectedVersion}"`), 'index stylesheet must be cache-busted to release version');
assert.ok(index.includes(`src="./config.js?v=${expectedVersion}"`), 'index config must be cache-busted to release version');
assert.ok(index.includes(`src="./${currentEntry}?v=${expectedVersion}"`), 'index entry must be cache-busted to release version');
assert.ok(index.includes(`${VERSION.toUpperCase()} | BUILD ${BUILD_ID.replace(`${VERSION}-`, '').toUpperCase()}`), 'index HUD must expose current version/build');

assert.ok(exists(currentEntry), 'current versioned entry must exist');
assertOnlyCurrentVersionedFiles();
const entry = read(currentEntry);
for (const name of VERSIONED_APP_MODULES) {
  const versioned = `src/app/${name}.v${suffix}.js`;
  const unversioned = `src/app/${name}.js`;
  assert.ok(exists(versioned), `current versioned app module must exist: ${versioned}`);
  assert.equal(read(unversioned), read(versioned), `versioned and unversioned app module must stay byte-identical: ${name}`);
  assert.ok(entry.includes(`./app/${name}.v${suffix}.js`), `entry must import current ${name} module`);
}

for (const stale of ['v38.13.', 'v38.14.1', 'v38.14.2', 'v38.14.3', 'v38.14.4', 'v38.14.5']) {
  assertNoRuntimeStaleVersion('index.html', stale);
  assertNoRuntimeStaleVersion('src/core/constants.js', stale);
  assertNoRuntimeStaleVersion('server/server.js', stale);
  assertNoRuntimeStaleVersion('release.json', stale);
}
for (const staleSuffix of ['38-13-7', '38-13-8', '38-14-1', '38-14-2', '38-14-3', '38-14-4', '38-14-5']) {
  assert.ok(!exists(`src/main.v${staleSuffix}.js`), `stale versioned entry should not ship: src/main.v${staleSuffix}.js`);
  for (const name of VERSIONED_APP_MODULES) {
    assert.ok(!exists(`src/app/${name}.v${staleSuffix}.js`), `stale versioned module should not ship: ${name}.v${staleSuffix}.js`);
  }
}

const server = read('server/server.js');
const mainServer = read('server/mainServer.js');
const renderYaml = read('render.yaml');
assert.equal(pkg.scripts?.start, 'node server/mainServer.js', 'Render npm start must boot unified Colyseus server');
assert.equal(pkg.scripts?.['start:legacy-signaling'], 'node server/server.js', 'legacy signaling server must stay available behind explicit script');
assert.ok(renderYaml.includes('startCommand: npm start'), 'Render must run npm start');
assert.ok(server.includes(`const SERVER_VERSION = "${VERSION}"`), 'legacy server version constant must match release');
assert.ok(server.includes(`const SERVER_BUILD_ID = "${BUILD_ID}"`), 'server build constant must match release');
assert.ok(server.includes(`const SIGNALING_PROTOCOL_VERSION = ${SIGNALING_PROTOCOL_VERSION}`), 'server protocol constant must match release');
assert.ok(server.includes('channel: SERVER_RELEASE_CHANNEL'), 'server health must expose release channel');
assert.ok(server.includes('buildId: SERVER_BUILD_ID'), 'server health must expose build id');
assert.ok(server.includes('protocol: SIGNALING_PROTOCOL_VERSION'), 'server health must expose protocol');
assert.ok(server.includes(`nncckkrr signaling ${VERSION} protocol`), 'server banner must include current version/protocol');

assert.ok(mainServer.includes(`const SERVER_VERSION = '${VERSION}'`), 'unified server version constant must match release');
assert.ok(mainServer.includes(`const SERVER_BUILD_ID = '${BUILD_ID}'`), 'unified server build constant must match release');
assert.ok(mainServer.includes(`const SIGNALING_PROTOCOL_VERSION = ${SIGNALING_PROTOCOL_VERSION}`), 'unified server protocol constant must match release');
assert.ok(mainServer.includes("gameServer.define('nn_arena'"), 'unified Render entry must define nn_arena Colyseus room');
assert.ok(mainServer.includes("legacySignaling: false"), 'unified Render entry must explicitly mark legacy signaling disabled');
assert.ok(mainServer.includes("app.get('/health'"), 'unified Render entry must expose /health');
assert.ok(mainServer.includes("app.use('/src'"), 'unified Render entry must serve the browser modules');
assert.ok(mainServer.includes("nncckkrr unified Colyseus"), 'unified server banner must identify the Colyseus entry');

const releaseModule = read(`src/app/releaseIntegrity.v${suffix}.js`);
assert.ok(releaseModule.includes('SERVER OK'), 'release module must expose ok status');
assert.ok(releaseModule.includes('DEPLOY MISMATCH'), 'release module must expose deploy mismatch status');
assert.ok(releaseModule.includes('SERVER PROTOCOL'), 'release module must expose protocol mismatch status');
assert.ok(releaseModule.includes('channel'), 'release module should keep channel metadata');

console.log(`deploy sanity verification passed for ${VERSION} ${BUILD_ID} protocol ${SIGNALING_PROTOCOL_VERSION}`);
