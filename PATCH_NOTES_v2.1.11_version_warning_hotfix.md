# PATCH NOTES — v2.1.11_version_warning_hotfix

## Summary
Fixes a false `UPDATE REQUIRED` warning on the main menu. The game could still run because the network protocol was compatible, but the menu compared the client version string against a stale signaling-server version string and displayed an update warning anyway.

## Why this patch exists
After `v2.1.10`, the client version moved forward but `server/index.js` still declared an older hardcoded server version. The `/health` probe returned that older version, and `src/main.v2-1.js` treated any version-string mismatch as `UPDATE REQUIRED`.

That was too strict: the signaling server is not the gameplay simulation, and if the protocol number matches, the game can remain compatible even when the deployment version text is behind.

## Changes

### Version source
- Updated `shared/protocol.v2-1.js`:
  - `VERSION = 'v2.1.11'`
  - `BUILD_ID = 'version-warning-hotfix'`
- Updated `package.json` to `2.1.11`.
- Updated `index.html` and `404.html` cache query strings to `2.1.11`.

### Server version handling
- `server/index.js` no longer keeps stale duplicated constants for:
  - `VERSION`
  - `BUILD_ID`
  - `PROTOCOL`
  - message/rate limits
- The signaling server now imports these from `shared/protocol.v2-1.js`.
- This keeps `/health`, WebSocket `hello_ok`, and the client constants aligned when the archive is deployed together.

### Menu warning behavior
- `src/main.v2-1.js` health probe now checks `protocol`, not just `version`.
- `UPDATE REQUIRED` now appears only when the server protocol is incompatible.
- A version-string mismatch with the same protocol is treated as network-ready instead of a blocking/error-looking update state.

## Files touched
- `shared/protocol.v2-1.js`
- `server/index.js`
- `src/main.v2-1.js`
- `index.html`
- `404.html`
- `package.json`

## QA
Run:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/protocol.v2-1.js').then(m=>console.log(m.VERSION,m.BUILD_ID,m.PROTOCOL))"
node -e "import('./src/main.v2-1.js').catch(e=>{ if(!String(e).includes('document')) throw e; console.log('main browser-only import skipped as expected') })"
unzip -t terminal_casino_roguelike_2.1.11_version_warning_hotfix.zip
```

Manual smoke:
- Open main menu.
- With a same-protocol backend, status should show `NETWORK READY`, not `UPDATE REQUIRED`.
- If the backend protocol changes, `UPDATE REQUIRED` should still appear.
- Solo should remain playable even if the backend is waking/unavailable.

## Follow-up risk
If a future server/client change is gameplay-breaking but keeps the same `PROTOCOL`, the client will not show `UPDATE REQUIRED`. In that case, bump `PROTOCOL`, not only `VERSION`.
