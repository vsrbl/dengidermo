// nncckkrr room: lifecycle, tick loop, snapshots
import { S, SIM_HZ, SNAPSHOT_HZ, MAX_PLAYERS } from './protocol.js';
import {
  createRun, createPlayer, startRoom, step, buildSnapshot, buildWalls,
  handleCasino, handlePick
} from './sim.js';

const TICK_MS = 1000 / SIM_HZ;
const SNAP_EVERY = Math.max(1, Math.round(SIM_HZ / SNAPSHOT_HZ));
const EMPTY_TTL_MS = 60_000;

export class Room {
  constructor(id, onEmpty) {
    this.id = id;
    this.onEmpty = onEmpty;
    this.players = new Map();   // playerId -> player state
    this.sockets = new Map();   // playerId -> ws
    this.run = createRun((Math.random() * 1e9) >>> 0);
    startRoom(this.run, this.players);
    this.tickN = 0;
    this.emptySince = Date.now();
    this.lastTickAt = Date.now();
    this.offersSent = new Map(); // playerId -> offer ref already pushed
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  get playerCount() { return this.players.size; }

  addPlayer(playerId, name, ws) {
    if (this.players.size >= MAX_PLAYERS) return { error: 'room full' };
    const idx = this.players.size;
    const p = createPlayer(playerId, name, idx);
    // late joiner starts fresh economy (doc rule), spawns at room spawn
    this.players.set(playerId, p);
    this.sockets.set(playerId, ws);
    this.emptySince = null;
    this.send(ws, {
      t: S.WELCOME, id: playerId, roomId: this.id,
      walls: buildWalls(this.run),
      world: { w: this.run.plan.w, h: this.run.plan.h }
    });
    this.broadcastFx({ t: 'join', id: playerId, name: p.name });
    return { ok: true, player: p };
  }

  removePlayer(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    this.players.delete(playerId);
    this.sockets.delete(playerId);
    this.offersSent.delete(playerId);
    this.broadcastFx({ t: 'leave', id: playerId, name: p.name });
    if (this.players.size === 0) this.emptySince = Date.now();
  }

  handleInput(playerId, m) {
    const p = this.players.get(playerId);
    if (!p) return;
    const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
    p.lastSeq = Math.max(p.lastSeq, num(m.seq) | 0);
    p.moveX = Math.max(-1, Math.min(1, num(m.mx)));
    p.moveY = Math.max(-1, Math.min(1, num(m.my)));
    p.aimX = Math.max(0, Math.min(this.run.plan.w, num(m.ax)));
    p.aimY = Math.max(0, Math.min(this.run.plan.h, num(m.ay)));
    p.fire = !!m.fire;
    if (m.dash) p.wantDash = true;
    if (m.inter) p.wantInteract = true;
    if (typeof m.wpn === 'number' && m.wpn >= 0 && m.wpn <= 8) p.wantWeapon = m.wpn | 0;
  }

  handleCasino(playerId, stake) {
    const p = this.players.get(playerId);
    if (!p) return;
    handleCasino(this.run, this.players, p, String(stake || ''));
  }

  handlePick(playerId, choiceIdx) {
    const p = this.players.get(playerId);
    if (!p) return;
    handlePick(this.run, this.players, p, choiceIdx);
  }

  tick() {
    const now = Date.now();
    let dt = (now - this.lastTickAt) / 1000;
    this.lastTickAt = now;
    dt = Math.min(dt, 0.1); // clamp spiral of death
    if (this.players.size > 0) {
      const prevDepth = this.run.runDepth;
      const prevSeed = this.run.plan.seed;
      step(this.run, this.players, dt, now / 1000);
      // room changed -> resend walls
      if (this.run.plan.seed !== prevSeed || this.run.runDepth !== prevDepth) {
        const wallMsg = { t: 'walls', walls: buildWalls(this.run), world: { w: this.run.plan.w, h: this.run.plan.h } };
        this.broadcast(wallMsg);
      }
      // push pending upgrade offers
      for (const [pid, p] of this.players) {
        const sent = this.offersSent.get(pid);
        if (p.offer && sent !== p.offer) {
          this.offersSent.set(pid, p.offer);
          const ws = this.sockets.get(pid);
          if (ws) this.send(ws, { t: S.OFFER, choices: p.offer.choices, pending: p.economy.pending });
        }
        if (!p.offer && sent) this.offersSent.delete(pid);
      }
      this.tickN++;
      if (this.tickN % SNAP_EVERY === 0) {
        const snap = buildSnapshot(this.run, this.players);
        this.broadcast(snap);
      }
    } else if (this.emptySince && now - this.emptySince > EMPTY_TTL_MS) {
      this.close();
    }
  }

  broadcastFx(fx) { this.run.fx.push(fx); }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.sockets.values()) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  close() {
    clearInterval(this.timer);
    for (const ws of this.sockets.values()) {
      try { ws.send(JSON.stringify({ t: S.ROOM_CLOSED })); ws.close(); } catch {}
    }
    this.players.clear();
    this.sockets.clear();
    this.onEmpty(this.id);
  }
}
