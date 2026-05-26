# v39.4.2 — Unified Render server entry

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

v39.4.2 changes the default server entry:

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
