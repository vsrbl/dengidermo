// nncckkrr net v2: three modes.
//   solo  — no network at all, sim runs locally
//   host  — sim runs here; guests connect via WebRTC (direct) with ws relay fallback
//   guest — inputs go to the host's browser, not to a far-away server
// The Render server is ONLY a phonebook (signaling + relay fallback), never the game.
import { VERSION, PROTOCOL, GAME_SPEED } from '../shared/protocol.v2-0-48.js';
import { LocalRoom } from './local.v2-0-48.js';

export { VERSION, PROTOCOL, GAME_SPEED };

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
const newId = () => Math.random().toString(36).slice(2, 10);
const safeSendDc = (dc, obj) => {
  if (!dc || dc.readyState !== 'open') return false;
  try { dc.send(JSON.stringify(obj)); return true; } catch { return false; }
};

export class Net {
  constructor() {
    this.mode = null;          // 'solo' | 'host' | 'guest'
    this.id = null;
    this.roomId = null;
    this.ping = 0;
    this.connected = false;   // signaling ws connected
    this.direct = false;       // guest: unreliable WebRTC input/snapshot channel open
    this.ctrlDirect = false;   // guest: reliable WebRTC command channel open
    this.handlers = {};
    this.room = null;          // LocalRoom when solo/host
    this.ws = null;            // signaling socket
    this.peers = new Map();    // host: gid -> {pc, dc, ctrlDc, open, ctrlOpen}
    this._pc = null;           // guest: peer connection
    this._dc = null;           // guest: unreliable channel
    this._ctrlDc = null;       // guest: reliable channel
    this._pingTimer = null;
  }

  on(type, fn) { this.handlers[type] = fn; }
  emit(type, m) { if (this.handlers[type]) this.handlers[type](m); }

  // ---------------------------------------------------------- solo / host
  startSolo(name, skin = null) {
    this.mode = 'solo';
    this.id = newId();
    this.roomId = 'SOLO';
    this.room = new LocalRoom('SOLO', (m) => this._deliverLocal(m));
    this.room.addHost(this.id, name, skin);
  }

  // host: register room on signaling server, then run sim locally
  hostRoom(name, skin = null) {
    this.mode = 'host';
    this.id = newId();
    this._hostName = name;
    this._skin = skin;
    this._wsSend({ t: 'host' });
  }

  // ---------------------------------------------------------- signaling ws
  connect(url, name, skin = null) {
    this._name = name;
    this._skin = skin;
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => { this._wsSend({ t: 'hello', name, skin: this._skin, proto: PROTOCOL }); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'hello_ok') {
          this.connected = true;
          if (!settled) { settled = true; resolve(m); }
          return;
        }
        this._onSignal(m);
      };
      ws.onerror = () => { if (!settled) { settled = true; reject(new Error('ws error')); } };
      ws.onclose = (ev) => {
        this.connected = false;
        if (!settled) { settled = true; reject(new Error('closed: ' + ev.code)); }
        // guest on relay (no direct rtc) loses the game when signaling drops
        if (this.mode === 'guest' && !this.direct && !this.ctrlDirect) this.emit('_closed', ev);
        if (this.mode === 'host') this._wsDown = true; // existing rtc guests keep playing
      };
    });
  }

  _wsSend(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }

  async _onSignal(m) {
    switch (m.t) {
      case 'host_ok': {
        this.roomId = m.code;
        this.room = new LocalRoom(m.code, (x) => this._deliverLocal(x));
        this.room.addHost(this.id, this._hostName, this._skin);
        break;
      }
      case 'guest_join': {            // host side: new guest via relay; offer WebRTC upgrade
        if (!this.room) break;
        const gid = m.gid;
        const relayCh = { send: (obj) => this._wsSend({ t: 'h', to: gid, d: obj }) };
        const peer = { pc: null, dc: null, ctrlDc: null, open: false, ctrlOpen: false, relayCh };
        peer.ch = {
          send: (obj, reliable = false) => {
            const sent = reliable
              ? safeSendDc(peer.ctrlDc, obj)
              : safeSendDc(peer.dc, obj);
            if (!sent) relayCh.send(obj);
          }
        };
        this.peers.set(gid, peer);
        if (!this.room.addGuest(gid, String(m.name || 'PLAYER').slice(0, 12), peer.ch, m.skin)) { this.peers.delete(gid); break; }
        try {
          const pc = new RTCPeerConnection(ICE);
          peer.pc = pc;
          const onMsg = (ev) => { try { this.room.handleMsg(gid, JSON.parse(ev.data)); } catch {} };
          const dc = pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
          peer.dc = dc;
          dc.onopen = () => { peer.open = true; };
          dc.onclose = () => { peer.open = false; };
          dc.onmessage = onMsg;
          const ctrlDc = pc.createDataChannel('ctrl', { ordered: true });
          peer.ctrlDc = ctrlDc;
          ctrlDc.onopen = () => { peer.ctrlOpen = true; };
          ctrlDc.onclose = () => { peer.ctrlOpen = false; };
          ctrlDc.onmessage = onMsg;
          pc.onicecandidate = (e) => { if (e.candidate) this._wsSend({ t: 'rtc', to: gid, d: { ice: e.candidate } }); };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this._wsSend({ t: 'rtc', to: gid, d: { sdp: pc.localDescription } });
        } catch { /* relay keeps working */ }
        break;
      }
      case 'guest_leave': {
        if (this.room) this.room.removeGuest(m.gid);
        const peer = this.peers.get(m.gid);
        if (peer) { try { peer.pc?.close(); } catch {} this.peers.delete(m.gid); }
        break;
      }
      case 'join_ok': this.roomId = m.code; break;
      case 'rtc': {
        try {
          if (this.mode === 'host') {
            const peer = this.peers.get(m.from);
            if (!peer || !peer.pc) break;
            if (m.d.sdp) await peer.pc.setRemoteDescription(m.d.sdp);
            if (m.d.ice) await peer.pc.addIceCandidate(m.d.ice);
          } else if (this.mode === 'guest') {
            if (m.d.sdp) {
              const pc = new RTCPeerConnection(ICE);
              this._pc = pc;
              pc.ondatachannel = (e) => {
                const dc = e.channel;
                const isCtrl = dc.label === 'ctrl';
                if (isCtrl) this._ctrlDc = dc; else this._dc = dc;
                dc.onopen = () => { if (isCtrl) this.ctrlDirect = true; else this.direct = true; };
                dc.onclose = () => { if (isCtrl) this.ctrlDirect = false; else this.direct = false; };
                dc.onmessage = (ev) => { try { this._dispatch(JSON.parse(ev.data)); } catch {} };
              };
              pc.onicecandidate = (e) => { if (e.candidate) this._wsSend({ t: 'rtc', to: 'host', d: { ice: e.candidate } }); };
              await pc.setRemoteDescription(m.d.sdp);
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              this._wsSend({ t: 'rtc', to: 'host', d: { sdp: pc.localDescription } });
              this._pendIce?.forEach(c => pc.addIceCandidate(c).catch(() => {}));
              this._pendIce = null;
            } else if (m.d.ice) {
              if (this._pc) await this._pc.addIceCandidate(m.d.ice);
              else (this._pendIce ??= []).push(m.d.ice);
            }
          }
        } catch {}
        break;
      }
      case 'g': {                     // host: guest game message via relay
        if (this.room) this.room.handleMsg(m.from, m.d);
        break;
      }
      case 'h': this._dispatch(m.d); break;   // guest: host game message via relay
      case 'error': this.emit('error', m); break;
      case 'room_closed': this._dispatch({ t: 'room_closed' }); break;
    }
  }

  // ---------------------------------------------------------- guest
  joinRoom(code) {
    this.mode = 'guest';
    this._wsSend({ t: 'join', code, skin: this._skin });
    if (!this._pingTimer) {
      this._pingTimer = setInterval(() => this._toHost({ t: 'ping', ts: performance.now() }, true), 2000);
    }
  }

  // ---------------------------------------------------------- delivery
  _deliverLocal(m) {           // from LocalRoom to the host's own client — zero latency
    if (m.t === 'welcome') { this.roomId = m.roomId; }
    this.emit(m.t, m);
  }

  _dispatch(m) {               // guest: message from host
    if (m.t === 'pong') { this.ping = Math.round(performance.now() - m.ts); return; }
    this.emit(m.t, m);
  }

  _toHost(m, reliable = false) {
    if (reliable && this.ctrlDirect && safeSendDc(this._ctrlDc, m)) return;
    if (!reliable && this.direct && safeSendDc(this._dc, m)) return;
    this._wsSend({ t: 'g', d: m });
  }

  // ---------------------------------------------------------- game API (same as v1)
  createRoom() { this.hostRoom(this._name, this._skin); }
  sendInput(i) { this._game({ t: 'input', ...i }, false); }
  sendCasino(stake) { this._game({ t: 'casino', stake, skins: Array.isArray(this._skinUnlocks) ? this._skinUnlocks : [] }, true); }
  sendPick(choice) { this._game({ t: 'pick', choice }, true); }
  sendWeaponPick(choice) { this._game({ t: 'weapon_pick', choice }, true); }
  sendAbilityPick(choice) { this._game({ t: 'ability_pick', choice }, true); }
  sendDev(cmd) { this._game({ t: 'dev', cmd }, true); }
  _game(m, reliable = false) {
    if (this.room) { this.room.handleMsg(this.id, m); this.ping = 0; }
    else if (this.mode === 'guest') this._toHost(m, reliable);
  }
}
