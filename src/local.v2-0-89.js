// nncckkrr local room: the simulation runs in the HOST'S BROWSER (or solo, offline).
// Host input is applied directly (zero latency); guests connect via WebRTC/relay.
import { S, SIM_HZ, SNAPSHOT_HZ, MAX_PLAYERS, GAME_SPEED } from '../shared/protocol.v2-0-89.js';
import {
  createRun, createPlayer, startRoom, step, buildSnapshot, buildWalls,
  handleCasino, handlePick, handleWeaponPick, handleAbilityPick, handleRerollOffer, handleDevCommand
} from '../shared/sim.v2-0-89.js';

const TICK_MS = 1000 / SIM_HZ;
const SNAP_EVERY = Math.max(1, Math.round(SIM_HZ / SNAPSHOT_HZ));

export class LocalRoom {
  // onLocal(msg): synchronous delivery to the host's own client
  constructor(roomId, onLocal) {
    this.id = roomId;
    this.onLocal = onLocal;
    this.players = new Map();     // playerId -> sim player
    this.channels = new Map();    // guestId -> { send(obj) } current best transport
    this.run = createRun((Math.random() * 1e9) >>> 0);
    startRoom(this.run, this.players);
    this.tickN = 0;
    this.guestFx = [];            // fx accumulated between guest snapshots
    this.offersSent = new Map();
    this.weaponOffersSent = new Map();
    this.abilityOffersSent = new Map();
    this.lastTickAt = performance.now();
    this.simNow = this.lastTickAt / 1000;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.hostId = null;
  }

  get playerCount() { return this.players.size; }

  welcomeMsg(playerId) {
    return {
      t: S.WELCOME, id: playerId, roomId: this.id,
      walls: buildWalls(this.run),
      world: { w: this.run.plan.w, h: this.run.plan.h }
    };
  }

  addHost(playerId, name, skin = null) {
    this.hostId = playerId;
    const p = createPlayer(playerId, name, 0, skin);
    this.players.set(playerId, p);
    this.onLocal(this.welcomeMsg(playerId));
  }

  addGuest(guestId, name, channel, skin = null) {
    if (this.players.size >= MAX_PLAYERS) {
      channel.send({ t: S.ERROR, error: 'room full' });
      return false;
    }
    const p = createPlayer(guestId, name, this.players.size, skin);
    this.players.set(guestId, p);
    this.channels.set(guestId, channel);
    channel.send(this.welcomeMsg(guestId), true);
    this.run.fx.push({ t: 'join', id: guestId, name: p.name });
    return true;
  }

  removeGuest(guestId) {
    const p = this.players.get(guestId);
    if (!p) return;
    this.players.delete(guestId);
    this.channels.delete(guestId);
    this.offersSent.delete(guestId);
    this.weaponOffersSent.delete(guestId);
    this.abilityOffersSent.delete(guestId);
    this.run.fx.push({ t: 'leave', id: guestId, name: p.name });
  }

  // message from a guest (via rtc or relay) or from the host's own client
  handleMsg(playerId, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'input') this.handleInput(playerId, m);
    else if (m.t === 'casino') {
      const p = this.players.get(playerId);
      if (!p) return;
      const result = handleCasino(this.run, this.players, p, String(m.stake || ''), Array.isArray(m.skins) ? m.skins : []);
      this.sendTo(playerId, { ...(result || { ok: false, error: 'BET FAILED' }), t: 'casino_result' }, true);
    } else if (m.t === 'pick') {
      const p = this.players.get(playerId);
      if (!p) return;
      const ok = handlePick(this.run, this.players, p, m.choice);
      if (ok && !p.offer) this.sendTo(playerId, { t: 'offer_close', pending: p.economy.pending }, true);
      else if (!ok) this.sendTo(playerId, { t: 'error', error: 'invalid INSTALL choice' }, true);
    } else if (m.t === 'weapon_pick') {
      const p = this.players.get(playerId);
      if (!p) return;
      const ok = handleWeaponPick(this.run, this.players, p, m.choice);
      if (ok && !p.weaponChestOffer) this.sendTo(playerId, { t: 'weapon_offer_close' }, true);
      else if (!ok) this.sendTo(playerId, { t: 'error', error: 'invalid WPN choice' }, true);
    } else if (m.t === 'ability_pick') {
      const p = this.players.get(playerId);
      if (!p) return;
      const ok = handleAbilityPick(this.run, this.players, p, m.choice);
      if (ok && !p.abilityChestOffer) this.sendTo(playerId, { t: 'ability_offer_close' }, true);
      else if (!ok) this.sendTo(playerId, { t: 'error', error: 'invalid ABL choice' }, true);
    } else if (m.t === 'reroll_offer') {
      const p = this.players.get(playerId);
      if (!p) return;
      const ok = handleRerollOffer(this.run, this.players, p, m.kind || '');
      if (!ok) this.sendTo(playerId, { t: 'error', error: 'no contract reroll available' }, true);
    } else if (m.t === 'dev') {
      if (playerId !== this.hostId) { this.sendTo(playerId, { t: 'error', error: 'dev mode доступен только host/solo' }, true); return; }
      const p = this.players.get(playerId);
      if (!p) return;
      const ok = handleDevCommand(this.run, this.players, p, m.cmd || {});
      if (!ok) this.sendTo(playerId, { t: 'error', error: 'invalid dev command' }, true);
    } else if (m.t === 'ping') {
      this.sendTo(playerId, { t: 'pong', ts: m.ts }, true);
    }
  }

  handleInput(playerId, m) {
    const p = this.players.get(playerId);
    if (!p) return;
    const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
    const seq = num(m.seq) | 0;
    if (seq <= p.lastSeq) return; // unordered rtc input: never apply stale packets
    p.lastSeq = seq;
    p.moveX = Math.max(-1, Math.min(1, num(m.mx)));
    p.moveY = Math.max(-1, Math.min(1, num(m.my)));
    p.aimX = Math.max(0, Math.min(this.run.plan.w, num(m.ax)));
    p.aimY = Math.max(0, Math.min(this.run.plan.h, num(m.ay)));
    p.fire = !!m.fire;
    if (m.dash) p.wantDash = true;
    if (m.inter) p.wantInteract = true;
    if (m.active) p.wantActive = true;
    if (m.secondary) p.wantSecondary = true;
    if (typeof m.wpn === 'number' && m.wpn >= 0 && m.wpn <= 8) p.wantWeapon = m.wpn | 0;
  }

  tick() {
    const now = performance.now();
    let dt = (now - this.lastTickAt) / 1000;
    this.lastTickAt = now;
    dt = Math.min(dt, 0.1) * GAME_SPEED;
    this.simNow += dt;
    if (this.players.size === 0) return;

    const prevDepth = this.run.runDepth;
    const prevSeed = this.run.plan.seed;
    step(this.run, this.players, dt, this.simNow);

    if (this.run.plan.seed !== prevSeed || this.run.runDepth !== prevDepth) {
      const wallMsg = { t: 'walls', walls: buildWalls(this.run), world: { w: this.run.plan.w, h: this.run.plan.h } };
      this.onLocal(wallMsg);
      this.broadcastGuests(wallMsg, true);
    }

    // upgrade offers
    for (const [pid, p] of this.players) {
      const sent = this.offersSent.get(pid);
      if (p.offer && sent !== p.offer) {
        this.offersSent.set(pid, p.offer);
        const msg = { t: S.OFFER, choices: p.offer.choices, pending: p.economy.pending };
        if (pid === this.hostId) this.onLocal(msg);
        else this.sendTo(pid, msg, true);
      }
      if (!p.offer && sent) this.offersSent.delete(pid);
    }

    // WPN chest choice offers
    for (const [pid, p] of this.players) {
      const sent = this.weaponOffersSent.get(pid);
      if (p.weaponChestOffer && sent !== p.weaponChestOffer) {
        this.weaponOffersSent.set(pid, p.weaponChestOffer);
        const msg = { t: 'weapon_offer', choices: p.weaponChestOffer.choices };
        if (pid === this.hostId) this.onLocal(msg);
        else this.sendTo(pid, msg, true);
      }
      if (!p.weaponChestOffer && sent) this.weaponOffersSent.delete(pid);
    }

    // ABL chest choice offers
    for (const [pid, p] of this.players) {
      const sent = this.abilityOffersSent.get(pid);
      if (p.abilityChestOffer && sent !== p.abilityChestOffer) {
        this.abilityOffersSent.set(pid, p.abilityChestOffer);
        const msg = { t: 'ability_offer', choices: p.abilityChestOffer.choices };
        if (pid === this.hostId) this.onLocal(msg);
        else this.sendTo(pid, msg, true);
      }
      if (!p.abilityChestOffer && sent) this.abilityOffersSent.delete(pid);
    }

    this.tickN++;
    // host: full-rate snapshot every tick (zero-latency feel)
    const snap = buildSnapshot(this.run, this.players);
    this.onLocal(snap);
    // guests: snapshot at SNAPSHOT_HZ with all fx accumulated since last one
    if (this.channels.size > 0) {
      this.guestFx.push(...snap.fx);
      if (this.tickN % SNAP_EVERY === 0) {
        const gsnap = { ...snap, fx: this.guestFx };
        this.guestFx = [];
        this.broadcastGuests(gsnap);
      }
    } else this.guestFx = [];
  }

  sendTo(playerId, msg, reliable = false) {
    if (playerId === this.hostId) this.onLocal(msg);
    else {
      const ch = this.channels.get(playerId);
      if (ch) ch.send(msg, reliable);
    }
  }

  broadcastGuests(msg, reliable = false) {
    for (const ch of this.channels.values()) ch.send(msg, reliable);
  }

  close() {
    clearInterval(this.timer);
    this.broadcastGuests({ t: S.ROOM_CLOSED }, true);
    this.players.clear();
    this.channels.clear();
  }
}
