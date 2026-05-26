'use strict';

const http = require('node:http');
const { Server } = require('@colyseus/core');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { AuthoritativeArenaRoom } = require('./colyseus/rooms/AuthoritativeArenaRoom');

const PORT = Number(process.env.PORT || process.env.COLYSEUS_PORT || 2567);
const SERVER_VERSION = 'v39.4.1';
const SERVER_BUILD_ID = 'v39.4.1-20260526';
const SERVER_RELEASE_CHANNEL = 'net2-colyseus-spike';
const COLYSEUS_PROTOCOL = 'colyseus-authoritative-spike-v1';

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  res.end(json);
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      mode: 'colyseus-authoritative',
      version: SERVER_VERSION,
      buildId: SERVER_BUILD_ID,
      channel: SERVER_RELEASE_CHANNEL,
      protocol: COLYSEUS_PROTOCOL,
      rooms: ['nn_arena']
    });
    return;
  }
  if (url.pathname === '/') {
    sendJson(res, 200, {
      ok: true,
      message: 'nncckkrr Colyseus authoritative spike server',
      join: 'room nn_arena via @colyseus/sdk joinOrCreate()'
    });
    return;
  }
  sendJson(res, 404, { ok: false, error: 'not_found' });
});

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
  console.log(`nncckkrr Colyseus ${SERVER_VERSION} ${COLYSEUS_PROTOCOL} on ${PORT}`);
});
