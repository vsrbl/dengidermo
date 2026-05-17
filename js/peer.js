export class PeerConnection {
  constructor({ sendSignal, onOpen, onClose, onData, onState }) {
    this.sendSignal = sendSignal;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onData = onData;
    this.onState = onState;
    this.channel = null;
    this.pendingCandidates = [];

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    this.pc.addEventListener("icecandidate", event => {
      if (!event.candidate) return;
      this.sendSignal({ kind: "ice-candidate", candidate: event.candidate });
    });

    this.pc.addEventListener("datachannel", event => {
      this.setupChannel(event.channel);
    });

    this.pc.addEventListener("connectionstatechange", () => {
      this.onState?.(this.pc.connectionState);
    });

    this.pc.addEventListener("iceconnectionstatechange", () => {
      this.onState?.(this.pc.iceConnectionState);
    });
  }

  async createOffer() {
    this.setupChannel(this.pc.createDataChannel("game", { ordered: true }));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ kind: "offer", offer });
  }

  async handleSignal(data) {
    if (data.kind === "offer") {
      await this.pc.setRemoteDescription(data.offer);
      await this.flushCandidates();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.sendSignal({ kind: "answer", answer });
      return;
    }

    if (data.kind === "answer") {
      await this.pc.setRemoteDescription(data.answer);
      await this.flushCandidates();
      return;
    }

    if (data.kind === "ice-candidate") {
      if (!this.pc.remoteDescription) {
        this.pendingCandidates.push(data.candidate);
        return;
      }
      await this.pc.addIceCandidate(data.candidate);
    }
  }

  async flushCandidates() {
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const candidate of candidates) {
      await this.pc.addIceCandidate(candidate);
    }
  }

  send(data) {
    if (!this.channel || this.channel.readyState !== "open") return false;
    this.channel.send(JSON.stringify(data));
    return true;
  }

  close() {
    this.channel?.close();
    this.pc.close();
  }

  setupChannel(channel) {
    this.channel = channel;

    channel.addEventListener("open", () => {
      this.onOpen?.();
      this.send({ type: "hello", time: Date.now() });
    });

    channel.addEventListener("message", event => {
      try {
        this.onData?.(JSON.parse(event.data));
      } catch {
        this.onData?.({ type: "raw", value: event.data });
      }
    });

    channel.addEventListener("close", () => this.onClose?.());
  }
}
