export class AssetStore {
  constructor() {
    this.images = new Map();
  }

  async loadImage(id, src) {
    if (!src) return null;
    if (this.images.has(id)) return this.images.get(id);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });
    this.images.set(id, img);
    return img;
  }

  image(id) {
    return this.images.get(id) || null;
  }
}
