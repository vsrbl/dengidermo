export class AudioBus {
  constructor() {
    this.enabled = false;
    this.sounds = new Map();
  }

  enable() {
    this.enabled = true;
  }

  add(id, audio) {
    this.sounds.set(id, audio);
  }

  play(id) {
    if (!this.enabled) return;
    const src = this.sounds.get(id);
    if (!src) return;
    const node = src.cloneNode ? src.cloneNode() : null;
    if (node) node.play().catch(() => {});
  }
}
