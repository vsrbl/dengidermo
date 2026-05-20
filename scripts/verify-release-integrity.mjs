import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, SIGNALING_PROTOCOL_VERSION, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const expectedPackageVersion = VERSION.replace(/^v/, '');
const versionRe = VERSION.replaceAll('.', '\\.' );
const entrySuffix = expectedPackageVersion.replaceAll('.', '-');

function assertContains(src, needle, label) {
  assert.ok(src.includes(needle), `${label || 'source'} must include ${needle}`);
}

const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const constants = read('src/core/constants.js');
const server = read('server/server.js');
const index = read('index.html');
const ui = read('src/ui.js');
const releaseModule = read(`src/app/releaseIntegrity.v${entrySuffix}.js`);
const entry = read(`src/main.v${entrySuffix}.js`);
const session = read(`src/app/session.v${entrySuffix}.js`);

assert.equal(pkg.version, expectedPackageVersion, 'root package version must match frontend VERSION');
assert.equal(serverPkg.version, expectedPackageVersion, 'server package version must match frontend VERSION');
assertContains(constants, `export const BUILD_ID = "${BUILD_ID}"`, 'constants');
assertContains(constants, `export const SIGNALING_PROTOCOL_VERSION = ${SIGNALING_PROTOCOL_VERSION}`, 'constants');
assert.match(index, new RegExp(`V${versionRe.replace(/^v/, '')}`, 'i'), 'index HUD must expose version');
assertContains(index, `content="${BUILD_ID}"`, 'index build meta');
assertContains(index, `content="${SIGNALING_PROTOCOL_VERSION}"`, 'index protocol meta');
assertContains(index, `style.css?v=${expectedPackageVersion}`, 'index style cache query');
assertContains(index, `config.js?v=${expectedPackageVersion}`, 'index config cache query');
assertContains(index, `src/main.v${entrySuffix}.js?v=${expectedPackageVersion}`, 'index module cache query');
assertContains(server, `const SERVER_VERSION = "${VERSION}"`, 'server version');
assertContains(server, `const SERVER_BUILD_ID = "${BUILD_ID}"`, 'server build');
assertContains(server, `const SIGNALING_PROTOCOL_VERSION = ${SIGNALING_PROTOCOL_VERSION}`, 'server protocol');
assert.match(server, /url\.pathname === "\/health"/, 'server /health must tolerate query strings');
assertContains(server, 'buildId: SERVER_BUILD_ID', 'server health build');
assertContains(server, 'protocol: SIGNALING_PROTOCOL_VERSION', 'server health protocol');
assertContains(server, 'cache-control', 'server no-store headers');
assertContains(server, 'type: "hello", version: SERVER_VERSION, buildId: SERVER_BUILD_ID, protocol: SIGNALING_PROTOCOL_VERSION', 'server hello contract');
assertContains(entry, 'checkReleaseIntegrity', 'entry release health check');
assertContains(entry, 'initialReleaseState', 'entry release initial state');
assertContains(entry, `./app/releaseIntegrity.v${entrySuffix}.js`, 'entry versioned release module');
assertContains(session, 'app.release?.blockConnection', 'session must block protocol-incompatible server');
assertContains(ui, 'BUILD_ID', 'HUD must display build id');
assertContains(releaseModule, 'DEPLOY MISMATCH', 'release path must expose deploy mismatch wording');
console.log(`release integrity verification passed for ${VERSION} ${BUILD_ID} protocol ${SIGNALING_PROTOCOL_VERSION}`);
