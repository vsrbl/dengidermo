'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { Server } = require('@colyseus/core');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { AuthoritativeArenaRoom } = require('./colyseus/rooms/AuthoritativeArenaRoom');
const { attachLegacySignaling } = require('./legacySignaling');

const PORT = Number(process.env.PORT || process.env.COLYSEUS_PORT || 2567);
const SERVER_VERSION = 'v39.4.10';
const SERVER_BUILD_ID = 'v39.4.10-20260527';
const SERVER_RELEASE_CHANNEL = 'prod';
const SIGNALING_PROTOCOL_VERSION = 2;
const COLYSEUS_PROTOCOL = 'colyseus-authoritative-combat-damage-v4';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_FILES = new Set(['index.html', 'config.js', 'release.json', 'style.css', '.nojekyll', 'CNAME']);

function sendJson(res, status, body) {
  res.status(status).set({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  }).send(JSON.stringify(body));
}

function noStoreStatic(res) {
  res.set({
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
}


function colyseusSdkBrowserBundlePath() {
  const bundled = path.join(PROJECT_ROOT, 'vendor', 'colyseus.js');
  if (fs.existsSync(bundled)) return bundled;
  try {
    const pkg = require.resolve('@colyseus/sdk/package.json');
    const packaged = path.join(path.dirname(pkg), 'dist', 'colyseus.js');
    if (fs.existsSync(packaged)) return packaged;
  } catch {}
  return path.join(PROJECT_ROOT, 'node_modules', '@colyseus', 'sdk', 'dist', 'colyseus.js');
}

function publicFilePath(name) {
  const file = path.resolve(PROJECT_ROOT, name);
  if (!file.startsWith(`${PROJECT_ROOT}${path.sep}`)) return null;
  return file;
}


function requestPath(req) {
  try {
    return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    return '/';
  }
}

function isColyseusUpgrade(req) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  // Colyseus joins through /matchmake over HTTP and then upgrades to /<processId>/<roomId>?sessionId=...
  return /^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(url.pathname)
    || url.searchParams.has('sessionId')
    || url.searchParams.has('reconnectionToken')
    || url.searchParams.has('skipHandshake');
}

function isLegacySignalingUpgrade(req) {
  return !isColyseusUpgrade(req);
}

const app = express();
app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  sendJson(res, 200, {
    ok: true,
    mode: 'unified-colyseus-authoritative',
    authority: 'server',
    version: SERVER_VERSION,
    buildId: SERVER_BUILD_ID,
    channel: SERVER_RELEASE_CHANNEL,
    protocol: SIGNALING_PROTOCOL_VERSION,
    colyseusProtocol: COLYSEUS_PROTOCOL,
    rooms: ['nn_arena'],
    legacySignaling: true
  });
});

app.get('/net2', (_req, res) => {
  sendJson(res, 200, {
    ok: true,
    message: 'nncckkrr Colyseus authoritative server is live',
    authority: 'server',
    room: 'nn_arena',
    join: 'Use @colyseus/sdk joinOrCreate("nn_arena")',
    version: SERVER_VERSION,
    buildId: SERVER_BUILD_ID,
    protocol: COLYSEUS_PROTOCOL
  });
});

app.get('/fingerprint', (_req, res) => {
  sendJson(res, 200, {
    ok: true,
    visibleBuild: 'v39.4.10-server-mode-combat-damage',
    authority: 'server',
    defaultOnlineMode: 'colyseus',
    legacyMode: 'p2p-compat-only',
    version: SERVER_VERSION,
    buildId: SERVER_BUILD_ID
  });
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});


app.get('/vendor/colyseus.js', (_req, res, next) => {
  const bundle = colyseusSdkBrowserBundlePath();
  if (!fs.existsSync(bundle)) return next();
  noStoreStatic(res);
  res.type('application/javascript; charset=utf-8');
  res.sendFile(bundle);
});

app.get('/legacy', (_req, res) => {
  sendJson(res, 200, {
    ok: true,
    mode: 'legacy-signaling-compat',
    version: SERVER_VERSION,
    buildId: SERVER_BUILD_ID,
    protocol: SIGNALING_PROTOCOL_VERSION,
    rooms: legacySignaling.roomCount(),
    websocket: '/'
  });
});

app.use('/src', express.static(path.join(PROJECT_ROOT, 'src'), {
  fallthrough: false,
  index: false,
  setHeaders: noStoreStatic
}));

app.get('/', (_req, res) => {
  noStoreStatic(res);
  res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

app.get('/server', (_req, res) => {
  noStoreStatic(res);
  res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

app.get('/:file', (req, res, next) => {
  const file = String(req.params.file || '');
  if (!PUBLIC_FILES.has(file)) return next();
  const resolved = publicFilePath(file);
  if (!resolved || !fs.existsSync(resolved)) return next();
  noStoreStatic(res);
  res.sendFile(resolved);
});

app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).type('text/plain; charset=utf-8').send('not found');
    return;
  }
  sendJson(res, 404, { ok: false, error: 'not_found' });
});

const httpServer = http.createServer(app);

const colyseusTransport = new WebSocketTransport({
  noServer: true,
  pingInterval: 3000,
  pingMaxRetries: 2,
  maxPayload: 16 * 1024,
  perMessageDeflate: false
});

const gameServer = new Server({ transport: colyseusTransport });

gameServer.define('nn_arena', AuthoritativeArenaRoom);
colyseusTransport.attachToServer(httpServer, { filter: isColyseusUpgrade });

const legacySignaling = attachLegacySignaling(httpServer, { filter: isLegacySignalingUpgrade });

process.on('SIGTERM', () => {
  legacySignaling.close();
});


gameServer.listen(PORT).then(() => {
  console.log(`nncckkrr unified Colyseus+legacy ${SERVER_VERSION} protocol ${SIGNALING_PROTOCOL_VERSION} colyseus ${COLYSEUS_PROTOCOL} build ${SERVER_BUILD_ID} on ${PORT}`);
});
