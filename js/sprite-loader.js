class SpriteAtlas {
  constructor(jsonPath, pngPath) {
    this.jsonPath = jsonPath;
    this.pngPath = pngPath;
    this.frames = new Map();
    this.image = null;
    this.loaded = false;
  }

  async load() {
    const [json, image] = await Promise.all([
      fetch(this.jsonPath).then((response) => response.json()),
      SpriteAtlas.loadImage(this.pngPath),
    ]);

    this.image = image;
    Object.entries(json.frames || {}).forEach(([rawName, data]) => {
      const name = rawName.replace(/(\D+)0+(\d+)/, "$1$2");
      this.frames.set(name, data.frame);
    });
    this.loaded = true;
    return this;
  }

  static loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${path}`));
      image.src = path;
    });
  }

  get(name) {
    return this.frames.get(name) || null;
  }

  draw(ctx, name, x, y, options = {}) {
    const frame = this.get(name);
    if (!frame || !this.image) return false;

    const scaleX = options.scaleX ?? options.scale ?? 1;
    const scaleY = options.scaleY ?? options.scale ?? 1;
    const rotation = options.rotation ?? 0;
    const alpha = options.alpha ?? 1;
    const anchorX = options.anchorX ?? 0.5;
    const anchorY = options.anchorY ?? 0.5;
    const filter = options.filter ?? "none";

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.filter = filter;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(
      this.image,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -frame.w * anchorX,
      -frame.h * anchorY,
      frame.w,
      frame.h
    );
    ctx.restore();
    return true;
  }
}

class SpriteLayers {
  constructor() {
    this.atlases = new Map();
  }

  add(name, jsonPath, pngPath) {
    const atlas = new SpriteAtlas(jsonPath, pngPath);
    this.atlases.set(name, atlas);
    return atlas;
  }

  get(name) {
    return this.atlases.get(name) || null;
  }

  async loadAll() {
    const results = await Promise.allSettled(
      [...this.atlases.values()].map((atlas) => atlas.load())
    );
    results.forEach((result) => {
      if (result.status === "rejected") console.warn(result.reason);
    });
  }
}
