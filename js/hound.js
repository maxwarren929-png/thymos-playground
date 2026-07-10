let nextHoundId = 0;

class Hound {
  constructor(config, x, y) {
    this.id = nextHoundId++;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    this.alive = true;
    this.health = CONSTANTS.HOUND.START_HEALTH;
    this.hunger = CONSTANTS.HOUND.HUNGER_MAX;

    this.speed = (config.speed || 0) + (CONSTANTS.HOUND.SPEED_BASE + (Math.random() - 0.5) * CONSTANTS.HOUND.SPEED_RANGE * 2);
    this.damage = (config.damage || 0) + (CONSTANTS.HOUND.DAMAGE_BASE + (Math.random() - 0.5) * CONSTANTS.HOUND.DAMAGE_RANGE * 2);
    this.adaptationRate = config.adaptationRate != null ? config.adaptationRate
      : (CONSTANTS.HOUND.ADAPT_RATE_BASE + Math.random() * CONSTANTS.HOUND.ADAPT_RATE_RANGE);

    this.state = "patrol";
    this.stateTimer = 0;
    this.target = null;
    this.flankDir = Math.random() < 0.5 ? -1 : 1;
    this.feintActive = false;
    this.feintTimer = 0;

    this.reproductionCooldown = 0;
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.patrolTarget = null;

    this.age = 0;
    this.maxAge = 80 + Math.random() * 30;
    this.generation = config.generation || 0;
  }

  getEffectiveSpeed() {
    return this.speed;
  }

  getAdaptationRate() {
    return Math.max(0.05, Math.min(1, this.adaptationRate));
  }

  update(dt, world) {
    if (!this.alive) return;

    this.age += dt;
    this.stateTimer += dt;
    this.reproductionCooldown = Math.max(0, this.reproductionCooldown - dt);
    this.hunger -= CONSTANTS.HOUND.HUNGER_DRAIN * dt;

    // Reproduction: spawn when prey is plentiful
    if (this.reproductionCooldown <= 0 && this.hunger > CONSTANTS.HOUND.HUNGER_MAX * 0.5) {
      const preyCount = (world.creatures || []).filter(c => c.alive).length;
      const houndCount = (world.hounds || []).filter(h => h.alive).length;
      const maxHounds = Math.max(1, Math.floor(preyCount * CONSTANTS.HOUND.MAX_PER_PREY));
      if (houndCount < maxHounds) {
        this.reproduce(world);
      }
    }

    if (this.hunger <= 0 || this.health <= 0) {
      this.alive = false;
      return;
    }
    if (this.age > this.maxAge) {
      this.health -= 0.15 * dt;
    }

    // Find nearest prey
    const preyRange = CONSTANTS.HOUND.PERCEPTION_RANGE;
    let nearestPrey = null, nearestDist = preyRange;
    for (const c of world.creatures) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y);
      if (d < nearestDist) { nearestDist = d; nearestPrey = c; }
    }

    const adapt = this.getAdaptationRate();
    // Higher adaptation = faster state switching
    const stateSwitchSpeed = 0.5 + adapt * 1.5;

    // State machine
    switch (this.state) {
      case "patrol": {
        if (nearestPrey && nearestDist < preyRange * 0.8) {
          this.switchState("stalk", nearestPrey);
          break;
        }
        this.patrol(dt);
        break;
      }

      case "stalk": {
        if (!nearestPrey || nearestDist > preyRange * 1.2) {
          this.switchState("patrol");
          break;
        }
        if (nearestDist < CONSTANTS.HOUND.RUSH_DIST) {
          // Close enough — decide rush or feint
          if (Math.random() < adapt * 0.4 && nearestDist > 60) {
            this.switchState("feint", nearestPrey);
          } else {
            this.switchState("rush", nearestPrey);
          }
          break;
        }
        // Flank if been stalking a while
        if (this.stateTimer > CONSTANTS.HOUND.STALK_TIME * (2 - adapt)) {
          this.switchState("flank", nearestPrey);
          break;
        }
        // Approach slowly
        this.moveToward(nearestPrey.x, nearestPrey.y, this.speed * 0.5, dt);
        break;
      }

      case "flank": {
        if (!nearestPrey || nearestDist > preyRange * 1.2) {
          this.switchState("patrol");
          break;
        }
        if (nearestDist < CONSTANTS.HOUND.RUSH_DIST) {
          this.switchState("rush", nearestPrey);
          break;
        }
        // Circle around
        const angle = Math.atan2(nearestPrey.y - this.y, nearestPrey.x - this.x);
        const flankAngle = angle + Math.PI / 2 * this.flankDir;
        const flankX = nearestPrey.x + Math.cos(flankAngle) * CONSTANTS.HOUND.FLANK_DIST * (0.5 + adapt * 0.5);
        const flankY = nearestPrey.y + Math.sin(flankAngle) * CONSTANTS.HOUND.FLANK_DIST * (0.5 + adapt * 0.5);
        const toFlankDist = Math.hypot(flankX - this.x, flankY - this.y);
        if (toFlankDist > 30) {
          this.moveToward(flankX, flankY, this.speed * CONSTANTS.HOUND.FLANK_SPEED, dt);
        } else {
          this.switchState("rush", nearestPrey);
        }
        break;
      }

      case "rush": {
        if (!nearestPrey || nearestDist > preyRange * 1.5) {
          this.switchState("patrol");
          break;
        }
        this.moveToward(nearestPrey.x, nearestPrey.y, this.speed * CONSTANTS.HOUND.RUSH_SPEED_MULT, dt);
        if (nearestDist < 20) {
          this.attack(nearestPrey, world);
          this.switchState("stalk", null);
        }
        if (this.stateTimer > 3) {
          this.switchState("stalk", nearestPrey);
        }
        break;
      }

      case "feint": {
        if (!nearestPrey || nearestDist > preyRange * 1.2) {
          this.switchState("patrol");
          break;
        }
        if (!this.feintActive) {
          // Rush toward prey
          this.moveToward(nearestPrey.x, nearestPrey.y, this.speed * CONSTANTS.HOUND.RUSH_SPEED_MULT, dt);
          if (nearestDist < CONSTANTS.HOUND.FEINT_DIST) {
            this.feintActive = true;
            this.feintTimer = 0;
          }
        } else {
          this.feintTimer += dt;
          // Stop and wait, or circle
          const stopX = this.x + (this.feintTimer < CONSTANTS.HOUND.FEINT_TIME ? 0 : Math.cos(this.flankDir * 2) * 100 * dt);
          const stopY = this.y + (this.feintTimer < CONSTANTS.HOUND.FEINT_TIME ? 0 : Math.sin(this.flankDir * 2) * 100 * dt);
          if (this.feintTimer < CONSTANTS.HOUND.FEINT_TIME) {
            // Decelerate
            this.vx *= 0.9;
            this.vy *= 0.9;
          } else {
            this.moveToward(stopX, stopY, this.speed * 0.8, dt);
          }
          if (this.feintTimer > CONSTANTS.HOUND.FEINT_TIME * 2) {
            this.feintActive = false;
            this.switchState(nearestDist < CONSTANTS.HOUND.RUSH_DIST ? "rush" : "flank", nearestPrey);
          }
        }
        break;
      }
    }

    // Movement integration
    const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vx *= (1 - blend);
    this.vy *= (1 - blend);
    this.clamp(world);
  }

  attack(prey, world) {
    if (!prey.alive) return;
    const dmg = this.damage * (1 + (Math.random() - 0.5) * 0.2);
    prey.health -= dmg;
    if (typeof prey.processLanguageInference === "function") {
      prey.processLanguageInference("negative", world);
    }
    if (prey.health <= 0) {
      prey.alive = false;
      this.hunger = Math.min(CONSTANTS.HOUND.HUNGER_MAX, this.hunger + CONSTANTS.HOUND.HUNGER_FROM_KILL);
    }
  }

  switchState(newState, target) {
    this.state = newState;
    this.stateTimer = 0;
    this.target = target;
    this.feintActive = false;
  }

  reproduce(world) {
    this.reproductionCooldown = CONSTANTS.HOUND.REPRODUCTION_COOLDOWN;
    const childSpeed = this.speed + (Math.random() - 0.5) * 2 * CONSTANTS.HOUND.MUTATION_MAGNITUDE * CONSTANTS.HOUND.SPEED_RANGE;
    const childDamage = this.damage + (Math.random() - 0.5) * 2 * CONSTANTS.HOUND.MUTATION_MAGNITUDE * CONSTANTS.HOUND.DAMAGE_RANGE;
    let childAdapt = this.adaptationRate + (Math.random() - 0.5) * 2 * CONSTANTS.HOUND.MUTATION_MAGNITUDE * 0.3;
    childAdapt = Math.max(0.05, Math.min(1, childAdapt));

    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 60;
    if (typeof world.spawnHound === "function") {
      world.spawnHound({
        speed: childSpeed,
        damage: childDamage,
        adaptationRate: childAdapt,
        generation: this.generation + 1,
      }, this.x + offsetX, this.y + offsetY);
    }
  }

  patrol(dt) {
    this.stateTimer += dt;
    if (this.stateTimer > CONSTANTS.HOUND.PATROL_TIME || !this.patrolTarget) {
      const range = 400;
      const angle = this.patrolAngle + (Math.random() - 0.5) * Math.PI;
      this.patrolAngle = angle;
      this.patrolTarget = {
        x: this.x + Math.cos(angle) * range * (0.3 + Math.random() * 0.7),
        y: this.y + Math.sin(angle) * range * (0.3 + Math.random() * 0.7),
      };
      this.stateTimer = 0;
    }
    if (this.patrolTarget) {
      this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.6, dt);
    }
  }

  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    this.vx = this.vx * (1 - blend) + (dx / d) * speed * blend;
    this.vy = this.vy * (1 - blend) + (dy / d) * speed * blend;
  }

  clamp(world) {
    const margin = CONSTANTS.MOVEMENT.WORLD_MARGIN;
    this.x = Math.max(margin, Math.min(world.width - margin, this.x));
    this.y = Math.max(margin, Math.min(world.height - margin, this.y));
    if (this.x <= margin || this.x >= world.width - margin) this.vx *= -0.5;
    if (this.y <= margin || this.y >= world.height - margin) this.vy *= -0.5;
  }

  getSnapshot() {
    return {
      id: this.id, x: this.x, y: this.y, alive: this.alive,
      health: this.health, hunger: this.hunger, age: this.age,
      speed: this.speed, damage: this.damage, adaptationRate: this.adaptationRate,
      state: this.state, generation: this.generation,
    };
  }

  render(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Body — large dark shape
    const size = 16;
    ctx.fillStyle = "#1a0a0a";
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Inner
    ctx.fillStyle = "#2d0f0f";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeSpread = 6;
    ctx.fillStyle = "#cc2222";
    ctx.beginPath();
    ctx.arc(-eyeSpread, -3, 3, 0, Math.PI * 2);
    ctx.arc(eyeSpread, -3, 3, 0, Math.PI * 2);
    ctx.fill();

    // State indicator
    const stateColors = {
      patrol: "#444",
      stalk: "#884400",
      flank: "#886600",
      rush: "#cc2200",
      feint: "#6600aa",
    };
    ctx.fillStyle = stateColors[this.state] || "#444";
    ctx.beginPath();
    ctx.arc(0, 10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
