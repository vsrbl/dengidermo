import { parseServerMessage, type InputMessage, type ServerMessage } from './protocol';

declare global {
  interface Window {
    NN_BACKEND_WS_URL?: string;
    NN_BACKEND_HTTP_URL?: string;
    NN_SIGNALING_URL?: string;
    NN_COLYSEUS_URL?: string;
  }
}

const LOCAL_WS_URL = 'ws://localhost:8787/ws';
const PRODUCTION_WS_URL = 'wss://dengidermo-1.onrender.com/ws';

function isLocalhost(): boolean {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function httpUrlToWsUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/ws';
    }
    return url.toString();
  } catch {
    return null;
  }
}

function resolveWsUrl(): string {
  if (isLocalhost()) return import.meta.env.VITE_WS_URL || LOCAL_WS_URL;

  if (typeof window.NN_BACKEND_WS_URL === 'string' && window.NN_BACKEND_WS_URL.trim() !== '') {
    return window.NN_BACKEND_WS_URL.trim();
  }

  const httpUrl =
    window.NN_BACKEND_HTTP_URL ||
    window.NN_SIGNALING_URL ||
    window.NN_COLYSEUS_URL;

  if (typeof httpUrl === 'string' && httpUrl.trim() !== '') {
    const wsUrl = httpUrlToWsUrl(httpUrl.trim());
    if (wsUrl !== null) return wsUrl;
  }

  return import.meta.env.VITE_WS_URL || PRODUCTION_WS_URL;
}

export type ConnectionStatus = 'closed' | 'connecting' | 'open';

export class NetClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private readonly listeners = new Set<(message: ServerMessage) => void>();
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();
  private readonly url: string;

  status: ConnectionStatus = 'closed';
  pingMs: number | null = null;
  lastCloseReason = '';

  constructor(url = resolveWsUrl()) {
    this.url = url;
  }

  connect(): void {
    this.disconnect(false);
    this.setStatus('connecting');

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.setStatus('open');
      socket.send(JSON.stringify({ t: 'hello' }));
      this.startPingLoop();
    });

    socket.addEventListener('message', (event) => {
      const message = decode(event.data);
      if (message === null) return;

      if (message.t === 'pong') {
        this.pingMs = Math.max(0, performance.now() - message.clientTime);
      }

      for (const listener of this.listeners) {
        listener(message);
      }
    });

    socket.addEventListener('close', (event) => {
      this.lastCloseReason = event.reason || `code ${event.code}`;
      if (this.socket === socket) {
        this.socket = null;
        this.setStatus('closed');
        this.scheduleReconnect();
      }
    });

    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  disconnect(allowReconnect = false): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const socket = this.socket;
    this.socket = null;

    if (socket !== null && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1000, 'client reconnect');
    }

    if (!allowReconnect) {
      this.setStatus('closed');
    }
  }

  reconnectNow(): void {
    this.disconnect(false);
    this.connect();
  }

  onMessage(listener: (message: ServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  sendInput(input: InputMessage): void {
    const socket = this.socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(input));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 900);
  }

  private startPingLoop(): void {
    const tick = (): void => {
      const socket = this.socket;
      if (socket === null || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ t: 'ping', clientTime: performance.now() }));
      window.setTimeout(tick, 1000);
    };
    tick();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

function decode(data: unknown): ServerMessage | null {
  try {
    if (typeof data !== 'string') return null;
    return parseServerMessage(JSON.parse(data));
  } catch {
    return null;
  }
}
