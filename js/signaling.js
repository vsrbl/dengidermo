export class SignalingClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.handlers = new Set();
    this.statusHandlers = new Set();
    this.queue = [];
  }

  connect() {
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener("open", () => {
      this.emitStatus("online");
      const pending = [...this.queue];
      this.queue = [];
      for (const message of pending) this.send(message);
    });

    this.socket.addEventListener("message", event => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      for (const handler of this.handlers) handler(message);
    });

    this.socket.addEventListener("close", () => this.emitStatus("offline"));
    this.socket.addEventListener("error", () => this.emitStatus("error"));
  }

  onMessage(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  emitStatus(status) {
    for (const handler of this.statusHandlers) handler(status);
  }

  send(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.queue.push(message);
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }
}
