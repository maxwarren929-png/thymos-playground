class CursorEntity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.radius = CONSTANTS.CURSOR.RADIUS;
    this.frameTimer = 0;
  }

  mouseMoved(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  update(dt) {
    this.frameTimer += dt;
    const follow = 1 - Math.pow(CONSTANTS.CURSOR.FOLLOW_POW, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    this.x += (this.targetX - this.x) * follow;
    this.y += (this.targetY - this.y) * follow;
  }

  render(ctx, sprites) {
    const atlas = sprites.get("cursor");
    const frame = Math.floor(this.frameTimer * CONSTANTS.CURSOR.FRAME_RATE) % CONSTANTS.CURSOR.FRAME_COUNT;
    if (atlas?.draw(ctx, `cursor${frame}`, this.x, this.y, { scale: CONSTANTS.CURSOR.SCALE })) return;

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
