# Netrogue Starter — nncckkrr.space ready

Fresh multiplayer ASCII roguelike foundation. This is intentionally small: no P2P, no legacy transport, no database, no old game logic.

## Architecture

```text
Browser client on GitHub Pages  ->  WebSocket  ->  authoritative Node server on Render
```

The client sends only input. The server owns position, collision, map, and room state.

## Local development

```bash
npm install
npm run dev:server
npm run dev:client
```

Open the Vite client URL. For local development the client defaults to `ws://localhost:8787/ws`.

## Production

Frontend:
- GitHub Pages serves the built client.
- The included GitHub Actions workflow builds `client/` and deploys it to Pages.
- `client/public/CNAME` contains `nncckkrr.space`.

Backend:
- Render runs `npm run build:server` and `npm run start:server`.
- WebSocket endpoint: `wss://dengidermo-1.onrender.com/ws`.
- Health endpoint: `https://dengidermo-1.onrender.com/health`.

## Network rules

1. Clients never send position.
2. Server never trusts gameplay state from clients.
3. Inputs are sequence-numbered.
4. Server simulation is fixed-tick.
5. Snapshots are small and contain only current room state.
6. Client prediction is allowed only for local feeling; server remains authoritative.


## Deployment setup

See `PAGES_AND_RENDER_SETUP.md`.
