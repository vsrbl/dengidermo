// nncckkrr net client: ws transport, ping, message dispatch
export const PROTOCOL = 1;
export const VERSION = 'v1.0.0';

export class Net {
  constructor() {
    this.ws = null;
    this.id = null;
    this.roomId = null;
    this.ping = 0;
    this.connected = false;
    this.handlers = {}; // type -> fn
    this._pingTimer = null;
  }

  on(type, fn) { this.handlers[type] = fn; }
  emit(type, m) { if (this.handlers[type]) this.handlers[type](m); }

  connect(url, name) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.send({ t: 'hello', name, proto: PROTOCOL });
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'hello_ok') {
          this.id = m.id;
          this.connected = true;
          this._pingTimer = setInterval(() => {
            this.send({ t: 'ping', ts: performance.now() });
          }, 2000);
          if (!settled) { settled = true; resolve(m); }
          return;
        }
        if (m.t === 'pong') {
          if (typeof m.ts === 'number') this.ping = Math.round(performance.now() - m.ts);
          return;
        }
        if (m.t === 'welcome') this.roomId = m.roomId;
        this.emit(m.t, m);
      };
      ws.onerror = () => { if (!settled) { settled = true; reject(new Error('ws error')); } };
      ws.onclose = (ev) => {
        this.connected = false;
        clearInterval(this._pingTimer);
        if (!settled) { settled = true; reject(new Error('closed: ' + ev.code)); }
        this.emit('_closed', ev);
      };
    });
  }

  send(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  createRoom() { this.send({ t: 'create' }); }
  joinRoom(roomId) { this.send({ t: 'join', roomId }); }
  sendInput(i) { this.send({ t: 'input', ...i }); }
  sendCasino(stake) { this.send({ t: 'casino', stake }); }
  sendPick(choice) { this.send({ t: 'pick', choice }); }
}
