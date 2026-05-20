import assert from 'node:assert/strict';
import { BUILD_ID, SIGNALING_PROTOCOL_VERSION, VERSION } from '../src/core/constants.js';
import { checkReleaseIntegrity, healthUrlFor, initialReleaseState } from '../src/app/releaseIntegrity.v38-13-8.js';

assert.equal(VERSION, 'v38.13.8');
assert.equal(BUILD_ID, 'v38.13.8-20260520');
assert.equal(SIGNALING_PROTOCOL_VERSION, 2);
assert.equal(healthUrlFor('https://dengidermo-1.onrender.com'), 'https://dengidermo-1.onrender.com/health');
assert.equal(healthUrlFor('wss://example.test/socket'), 'https://example.test/socket/health');

const initial = initialReleaseState('https://dengidermo-1.onrender.com');
assert.equal(initial.status, 'checking');
assert.equal(initial.clientVersion, VERSION);
assert.equal(initial.clientBuildId, BUILD_ID);
assert.equal(initial.protocol, SIGNALING_PROTOCOL_VERSION);
assert.equal(initial.blockConnection, false);

const oldFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { ok: true, version: VERSION, buildId: BUILD_ID, protocol: SIGNALING_PROTOCOL_VERSION };
    }
  });
  const ok = await checkReleaseIntegrity('https://server.test');
  assert.equal(ok.status, 'ok');
  assert.equal(ok.blockConnection, false);

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { ok: true, version: 'v38.13.7', buildId: 'v38.13.7-20260520', protocol: SIGNALING_PROTOCOL_VERSION };
    }
  });
  const deployMismatch = await checkReleaseIntegrity('https://server.test');
  assert.equal(deployMismatch.status, 'deploy_mismatch');
  assert.equal(deployMismatch.blockConnection, false, 'patch deploy mismatch is visible but should not block same-protocol connections');

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { ok: true, version: VERSION, buildId: BUILD_ID, protocol: 999 };
    }
  });
  const protocolMismatch = await checkReleaseIntegrity('https://server.test');
  assert.equal(protocolMismatch.status, 'protocol_mismatch');
  assert.equal(protocolMismatch.blockConnection, true, 'protocol mismatch must block CREATE/JOIN');

  globalThis.fetch = async () => { throw new Error('offline'); };
  const unreachable = await checkReleaseIntegrity('https://server.test');
  assert.equal(unreachable.status, 'health_unreachable');
  assert.equal(unreachable.blockConnection, false, 'health failure should be visible but Transport still owns final connection result');
} finally {
  globalThis.fetch = oldFetch;
}

console.log('All v38.13.8 release/deploy integrity checks passed');
