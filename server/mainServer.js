'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { Server } = require('@colyseus/core');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { AuthoritativeArenaRoom } = require('./colyseus/rooms/AuthoritativeArenaRoom');

const PORT = Number(process.env.PORT || process.env.COLYSEUS_PORT || 2567);
const SERVER_VERSION = 'v39.4.1';
const SERVER_BUILD_ID = 'v39.4.1-20260526';
const SERVER_RELEASE_CHANNEL = 'prod';
const SIGNALING_PROTOCOL_VERSION = 2;
const COLYSEUS_PROTOCOL = 'colyseus-authoritative-spike-v1';
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

function publicFilePath(name) {
  const file = path.resolve(PROJECT_ROOT, name);
  if (!file.startsWith(`${PROJECT_ROOT}${path.sep}`)) return null;
  return file;
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
    legacySignaling: false
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

app.use('/src', express.static(path.join(PROJECT_ROOT, 'src'), {
  fallthrough: false,
  index: false,
  setHeaders: noStoreStatic
}));

app.get('/', (_req, res) => {
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

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 3000,
    pingMaxRetries: 2,
    maxPayload: 16 * 1024,
    perMessageDeflate: false
  })
});

gameServer.define('nn_arena', AuthoritativeArenaRoom);

gameServer.listen(PORT).then(() => {
  console.log(`nncckkrr unified Colyseus ${SERVER_VERSION} protocol ${SIGNALING_PROTOCOL_VERSION} colyseus ${COLYSEUS_PROTOCOL} build ${SERVER_BUILD_ID} on ${PORT}`);
});
