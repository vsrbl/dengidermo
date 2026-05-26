# v39.4.5 — Colyseus SDK loading hotfix

This patch makes the default Render process boot the Colyseus authoritative server path instead of the old browser-host P2P signaling server.

## Default production entry

```bash
npm start
```

now runs:

```bash
node server/mainServer.js
```

`server/mainServer.js` owns the Render HTTP server and attaches Colyseus WebSocket transport to the same port.

## Runtime endpoints

- `/health` — release health used by the existing frontend release-integrity check.
- `/net2` — Colyseus/net2 diagnostic endpoint.
- `/` — current browser build `index.html`.
- `/src/*` — current browser modules for the static client.
- Colyseus room: `nn_arena`.

## What changed from v39.4.0

v39.4.0 added a side-by-side Colyseus spike, but Render still booted `server/server.js`, which meant production remained the old signaling/P2P relay server.

v39.4.5 changes the default server entry:

```text
Render -> npm start -> server/mainServer.js -> Colyseus authoritative server
```

The old P2P signaling server is still present for rollback/testing, but it is no longer the default Render entry:

```bash
npm run start:legacy-signaling
```

Colyseus-only standalone remains available:

```bash
npm run start:colyseus
```

## Important state

This patch still does not migrate the visible gameplay client to Colyseus. It only makes Render capable of running the authoritative Colyseus server by default and serving the current static browser build from that same process.

The next playable patch should connect the browser to `nn_arena` from an explicit experimental online mode.

## v39.4.5 playable browser server mode

The menu now separates the old browser-hosted flow from the new server-authoritative flow:

```text
CREATE P2P LEGACY / JOIN P2P LEGACY -> old WebRTC/P2P path
PLAY SERVER -> Colyseus nn_arena path
```

The unified Render server serves the Colyseus browser SDK from `/vendor/colyseus.js`, so the client does not depend on a CDN. `PLAY SERVER` connects to `nn_arena`, sends input-only frames, and renders the Colyseus schema state as a temporary `SERVER ARENA` snapshot. This is intentionally a small playable vertical slice: players, enemies, projectiles, server-owned movement, and server-owned shooting. Loot, upgrades, room flow, casino, and existing content migration remain future v39.4.x work.


## v39.4.5 SDK loading hotfix

Ships `vendor/colyseus.js` with the project and serves that first from `/vendor/colyseus.js`, so `PLAY SERVER` does not depend on a missing generated `dist` file or a Render-only dynamic route.
