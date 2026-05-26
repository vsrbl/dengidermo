# v39.4.9 — Colyseus server-mode compact combat snapshots

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

v39.4.6 changes the default server entry:

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

## v39.4.6 playable browser server mode

The menu now separates the old browser-hosted flow from the new server-authoritative flow:

```text
CREATE P2P LEGACY / JOIN P2P LEGACY -> old WebRTC/P2P path
PLAY SERVER -> Colyseus nn_arena path
```

The unified Render server serves the Colyseus browser SDK from `/vendor/colyseus.js`, so the client does not depend on a CDN. `PLAY SERVER` connects to `nn_arena`, sends input-only frames, and renders the Colyseus schema state as a temporary `SERVER ARENA` snapshot. This is intentionally a small playable vertical slice: players, enemies, projectiles, server-owned movement, and server-owned shooting. Loot, upgrades, room flow, casino, and existing content migration remain future v39.4.x work.


## v39.4.6 SDK loading hotfix

Ships `vendor/colyseus.js` with the project and serves that first from `/vendor/colyseus.js`, so `PLAY SERVER` does not depend on a missing generated `dist` file or a Render-only dynamic route.


## v39.4.6 server-mode feel hotfix

PLAY SERVER now uses local client-side movement prediction with soft server correction instead of rendering the local player directly from Colyseus schema patches. The temporary Colyseus arena also patches at 60Hz to reduce visible stutter while the authoritative migration is still in spike mode.


## v39.4.7 server-mode input ack + reconciliation

PLAY SERVER now uses server-processed `lastProcessedInputSeq` from the Colyseus schema as the local reconciliation ack. Inputs are queued on receipt, applied by the fixed server tick, and only then exposed as processed in player state. The browser keeps a bounded pending-input buffer, discards frames up to the server ack, replays unacked frames from the authoritative pose, and renders the corrected predicted local player.

Diagnostics now expose local seq, server ack seq, pending input count, prediction error, snap count, server tick, and the Colyseus session id. The old P2P buttons remain compatibility-only and are not part of this path.


## v39.4.9 remote interpolation buffer

PLAY SERVER now separates local and remote rendering responsibilities:

```text
local player -> inputSeq ack/replay prediction and reconciliation
remote players -> bounded interpolation buffer
enemies/projectiles -> bounded interpolation buffer
```

The browser stores recent server snapshots and renders non-local entities about 110ms behind the newest received state. This avoids drawing every Colyseus schema patch raw and creates the foundation for smoother remote players, enemies, and projectiles before the later compact high-load snapshot protocol. The local player still uses the v39.4.7 server-processed ack/replay path, so movement remains responsive while server authority is preserved.

HUD diagnostics now include interpolation delay and buffered frame count as `INT<delay>/B<frames>`.


## v39.4.9 compact combat snapshots

Server mode now keeps player identity and input ack data in Colyseus Schema, but sends fast combat entities through a compact `combatSnapshot` message. Enemies and projectiles are encoded as dense rows and merged into the client render snapshot before the remote interpolation buffer. This prepares high-load projectile/enemy traffic for meat-grinder gameplay without trusting the client for combat, loot, economy, or casino outcomes.
