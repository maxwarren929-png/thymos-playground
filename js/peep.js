const FACE_LABELS = {
  0: "neutral",
  1: "calm",
  2: "blink",
  3: "shocked",
  4: "uneasy",
  5: "annoyed",
  6: "happy",
  7: "worried",
  8: "friendly",
  9: "angry",
  10: "furious",
  11: "panicked",
  12: "crying",
};

class Peep {
  constructor(config, x, y) {
    this.id = config.id;
    this.name = config.name;
    this.district = config.district;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.bodyFrame = Math.random() < 0.5 ? 0 : 1;
    this.isRed = Math.random() < 0.05;
    this.faceFrame = Math.floor(Math.random() * 13);
    this.faceLabel = FACE_LABELS[this.faceFrame] || "unknown";
    this.alive = true;
    this.health = 4;
    this.maxHealth = 4;
    this.stats = Peep.createStats(config.stats);
    this.weapon = null;
    this.hasWeapon = false;
    this.kills = 0;
    this.state = "rush_center";
    this.goal = "rush_center";
    this.goalTarget = null;
    this.goalTime = 0;
    this.openingGoal = "rush_center";
    this.openingComplete = false;
    this.lastGoalLogAt = 0;
    this.stateTime = 0;
    this.attackTime = 0;
    this.attackApplied = false;
    this.attackTarget = null;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTime = 0;
    this.hop = Math.random();
    this.flip = Math.random() < 0.5 ? -1 : 1;
    this._deathBy = null;
    this.hitFlash = 0;
    this.relationships = new Map();
    this.memories = [];
    this.allianceId = null;
    this.lastAllianceProposal = new Map();
    this.betrayalCooldown = randomRange(2, 5);
    this.profile = Peep.createProfile(this.stats);
    this.openingGoal = this.chooseOpeningGoal();
    this.goal = this.openingGoal;
    this.retreatAngle = Math.atan2(this.y - 900, this.x - 1500) + randomRange(-0.6, 0.6);
  }

  static createStats(overrides = {}) {
    const stat = () => 1 + Math.floor(Math.random() * 10);
    return {
      strength: clampStat(overrides.strength ?? stat()),
      speed: clampStat(overrides.speed ?? stat()),
      eyesight: clampStat(overrides.eyesight ?? stat()),
      loyalty: clampStat(overrides.loyalty ?? stat()),
      aggression: clampStat(overrides.aggression ?? stat()),
      friendliness: clampStat(overrides.friendliness ?? stat()),
    };
  }

  static createProfile(stats) {
    const roll = Math.random();
    const awareness = 120 + stats.eyesight * 24;
    const caution = Math.max(0, 11 - stats.aggression);
    if (roll < 0.25) {
      return {
        type: "runner",
        centerTime: randomRange(0.4, 1.8),
        enemyAwareness: awareness + 55,
        huntRangeArmed: 85,
        huntRangeUnarmed: 0,
        fleeRangeArmed: 80 + caution * 6,
        fleeRangeUnarmed: 150 + caution * 12,
        retreatAfterWeapon: true,
        retreatDuration: randomRange(2.8, 5.5),
      };
    }
    if (roll < 0.52) {
      return {
        type: "scavenger",
        centerTime: randomRange(2.8, 5),
        enemyAwareness: awareness + 25,
        huntRangeArmed: 90 + stats.aggression * 8,
        huntRangeUnarmed: stats.aggression * 5,
        fleeRangeArmed: 55 + caution * 5,
        fleeRangeUnarmed: 110 + caution * 9,
        retreatAfterWeapon: true,
        retreatDuration: randomRange(1.8, 3.5),
      };
    }
    if (roll < 0.76) {
      return {
        type: "wanderer",
        centerTime: randomRange(0.8, 3.2),
        enemyAwareness: awareness,
        huntRangeArmed: 65 + stats.aggression * 7,
        huntRangeUnarmed: stats.aggression * 4,
        fleeRangeArmed: 45 + caution * 5,
        fleeRangeUnarmed: 85 + caution * 8,
        retreatAfterWeapon: Math.random() < 0.5,
        retreatDuration: randomRange(1.4, 3),
      };
    }
    if (roll < 0.95) {
      return {
        type: "hunter",
        centerTime: randomRange(3.5, 5),
        enemyAwareness: awareness + 70,
        huntRangeArmed: 150 + stats.aggression * 20,
        huntRangeUnarmed: 55 + stats.aggression * 10,
        fleeRangeArmed: 35,
        fleeRangeUnarmed: 90,
        retreatAfterWeapon: false,
        retreatDuration: 0,
      };
    }
    return {
      type: "berserker",
      centerTime: 5,
      enemyAwareness: Infinity,
      huntRangeArmed: Infinity,
      huntRangeUnarmed: Infinity,
      fleeRangeArmed: 0,
      fleeRangeUnarmed: 0,
      retreatAfterWeapon: false,
      retreatDuration: 0,
    };
  }

  initializeRelationships(peeps) {
    this.relationships.clear();
    for (const peep of peeps) {
      if (peep === this) continue;
      const sameDistrict = peep.district === this.district;
      this.relationships.set(peep.id, {
        trust: sameDistrict ? 75 : randomRange(10, 25),
        fear: 0,
        anger: 0,
        bond: sameDistrict ? 70 : randomRange(0, 10),
        lastSeen: 0,
      });
    }
  }

  relationshipWith(other) {
    if (!other) return null;
    if (!this.relationships.has(other.id)) {
      this.relationships.set(other.id, { trust: 15, fear: 0, anger: 0, bond: 0, lastSeen: 0 });
    }
    return this.relationships.get(other.id);
  }

  remember(type, actor, weight = 1, extra = {}) {
    if (!actor || actor === this) return;
    const memory = { type, actorId: actor.id, time: performance.now(), weight, ...extra };
    this.memories.unshift(memory);
    this.memories = this.memories.slice(0, 12);

    const rel = this.relationshipWith(actor);
    if (!rel) return;
    if (type === "attacked_me") {
      rel.trust = Math.max(0, rel.trust - 18 * weight);
      rel.anger = Math.min(100, rel.anger + 22 * weight);
      rel.fear = Math.min(100, rel.fear + 8 * weight);
    } else if (type === "fought_beside_me") {
      rel.trust = Math.min(100, rel.trust + 8 * weight);
      rel.bond = Math.min(100, rel.bond + 10 * weight);
    } else if (type === "killed_ally") {
      rel.trust = Math.max(0, rel.trust - 35 * weight);
      rel.anger = Math.min(100, rel.anger + 45 * weight);
    } else if (type === "betrayed_me") {
      rel.trust = Math.max(0, rel.trust - 60 * weight);
      rel.anger = Math.min(100, rel.anger + 55 * weight);
      rel.bond = Math.max(0, rel.bond - 35 * weight);
    }
  }

  equipWeapon(type) {
    this.weapon = type;
    this.hasWeapon = true;
    if (this.profile.retreatAfterWeapon) {
      this.retreatAngle = Math.atan2(this.y - 900, this.x - 1500) + randomRange(-0.5, 0.5);
      this.setState("retreat");
    }
  }

  isAlliedWith(other, world) {
    if (!other || other === this) return false;
    return Boolean(world?.areAllied?.(this, other));
  }

  canHarm(other, world) {
    return other && other.alive && other !== this && !this.isAlliedWith(other, world);
  }

  findNearestEnemy(peeps, world, range = Infinity) {
    let nearest = null;
    let nearestDist = range;
    let nearestScore = -Infinity;
    for (const peep of peeps) {
      if (!this.canHarm(peep, world)) continue;
      const dist = Math.hypot(peep.x - this.x, peep.y - this.y);
      if (dist > range) continue;
      const rel = this.relationshipWith(peep);
      const weaponThreat = peep.hasWeapon ? 18 : 0;
      const weakTarget = (peep.maxHealth - peep.health) * 7;
      const score = 120 - dist * 0.25 + rel.anger * 1.2 - rel.fear * 0.35 + weaponThreat + weakTarget + this.stats.aggression * 4;
      if (score > nearestScore) {
        nearest = peep;
        nearestDist = dist;
        nearestScore = score;
      }
    }
    return { target: nearest, dist: nearestDist };
  }

  takeDamage(amount, killer) {
    if (!this.alive) return;
    this.health -= amount;
    this.hitFlash = 0.18;
    if (this.health <= 0) {
      this._deathBy = killer || null;
      this.alive = false;
      if (killer) killer.kills += 1;
    }
  }

  die() {
    return {
      id: this.id,
      name: this.name,
      district: this.district,
      x: this.x,
      y: this.y,
      weapon: this.weapon,
      side: this.bodyFrame,
      kills: this.kills,
      killedBy: this._deathBy,
    };
  }

  update(dt, world) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.betrayalCooldown = Math.max(0, this.betrayalCooldown - dt);
    this.stateTime += dt;
    this.goalTime += dt;
    this.pickUpWeapon(world.groundWeapons);
    this.updateSeenRelationships(world);
    this.considerAlliance(world);
    if (this.considerBetrayal(world)) return;

    if (this.state === "attack") {
      this.updateAttack(dt, world);
      return;
    }

    if (this.state === "retreat" && this.stateTime < this.profile.retreatDuration) {
      this.setGoal("flee", null, world);
      this.moveInDirection(this.retreatAngle, this.hasWeapon ? 2.35 : 2.7, dt);
      this.animate(Math.hypot(this.vx, this.vy), dt);
      this.clamp(world);
      return;
    }

    const aliveCount = world.peeps.filter(p => p.alive).length;
    const infiniteEyes = aliveCount <= 3;

    const threatRange = infiniteEyes ? Infinity : this.profile.enemyAwareness;
    const threat = this.findNearestEnemy(world.peeps, world, threatRange);
    if (this.shouldFlee(threat)) {
      this.setGoal("flee", threat.target, world);
      this.setState("flee");
      this.moveAwayFrom(threat.target.x, threat.target.y, this.hasWeapon ? 2.1 : 2.75, dt);
      this.animate(Math.hypot(this.vx, this.vy), dt);
      this.clamp(world);
      return;
    }

    const baseHuntRange = this.hasWeapon
      ? Math.max(this.profile.huntRangeArmed, this.getAttackRange())
      : this.profile.huntRangeUnarmed;
    const huntRange = infiniteEyes ? Infinity : baseHuntRange;
    const enemy = this.findNearestEnemy(world.peeps, world, huntRange);
    const weapon = !this.hasWeapon ? this.findNearestWeapon(world.groundWeapons, infiniteEyes) : null;
    const ally = this.findRegroupAlly(world);

    if (!this.openingComplete && world.elapsed < 4.5) {
      this.executeOpeningGoal(dt, world, weapon);
    } else if (enemy.target) {
      this.setGoal("hunt", enemy.target, world);
      this.setState("charge");
      if (enemy.dist <= this.getAttackRange()) {
        this.attackTarget = enemy.target;
        this.setState("attack");
        this.attackTime = 0;
        this.attackApplied = false;
        return;
      }
      this.moveToward(enemy.target.x, enemy.target.y, 2.35, dt);
    } else if (weapon) {
      this.setGoal("scavenge_weapon", null, world);
      this.setState("scavenge");
      this.moveToward(weapon.x, weapon.y, 2.05, dt);
    } else if (ally) {
      this.setGoal("regroup", ally, world);
      this.setState("regroup");
      this.moveToward(ally.x, ally.y, 1.65, dt);
    } else if (this.shouldHide(world)) {
      this.setGoal("hide", null, world);
      this.setState("hide");
      this.moveInDirection(this.retreatAngle, 0.85, dt);
    } else {
      this.setGoal("wander", null, world);
      this.setState("wander");
      this.wander(dt);
    }

    this.animate(Math.hypot(this.vx, this.vy), dt);
    this.clamp(world);
  }

  executeOpeningGoal(dt, world, weapon) {
    if (this.openingGoal === "flee_center") {
      this.setGoal("flee", null, world);
      this.setState("flee");
      this.moveInDirection(this.retreatAngle, 2.65, dt);
      return;
    }
    if (this.openingGoal === "grab_weapon" && this.hasWeapon) {
      this.openingComplete = true;
      return;
    }
    if (this.openingGoal === "grab_weapon" && weapon) {
      this.setGoal("scavenge_weapon", null, world);
      this.setState("scavenge");
      this.moveToward(weapon.x, weapon.y, 2.8, dt);
      return;
    }
    if (this.openingGoal === "skirt_center") {
      this.setGoal("scavenge_weapon", null, world);
      this.setState("scavenge");
      const angle = Math.atan2(this.y - world.center.y, this.x - world.center.x) + 0.65;
      const x = world.center.x + Math.cos(angle) * 230;
      const y = world.center.y + Math.sin(angle) * 230;
      this.moveToward(x, y, 2.4, dt);
      return;
    }

    this.setGoal("rush_center", null, world);
    this.setState("rush_center");
      const centerDist = Math.hypot(world.center.x - this.x, world.center.y - this.y);
      if (this.stateTime > this.profile.centerTime || centerDist < 120) {
        this.openingComplete = true;
        this.setState("wander");
      }
      this.moveToward(world.center.x, world.center.y, 3.2, dt);
  }

  chooseOpeningGoal() {
    if (this.profile.type === "berserker" || this.stats.aggression >= 8) return "rush_center";
    if (this.profile.type === "hunter" && this.stats.aggression >= 6) return "rush_center";
    if (this.stats.speed >= 7 && this.stats.aggression <= 6) return "grab_weapon";
    if (this.profile.type === "runner" || this.stats.aggression <= 3) return "flee_center";
    if (this.stats.eyesight >= 7 && this.stats.aggression <= 5) return "skirt_center";
    return Math.random() < 0.65 ? "rush_center" : "skirt_center";
  }

  setGoal(goal, target = null, world = null) {
    if (this.goal === goal && this.goalTarget === target) return;
    this.goal = goal;
    this.goalTarget = target;
    this.goalTime = 0;
    const now = performance.now();
    if (world?.logGoal && now - this.lastGoalLogAt > 5000) {
      this.lastGoalLogAt = now;
      world.logGoal(this, goal, target);
    }
  }

  goalLabel() {
    return this.goal.replace(/_/g, " ");
  }

  findRegroupAlly(world) {
    if (!this.allianceId || this.health <= 1) return null;
    const allies = world.peeps
      .filter((peep) => peep.alive && peep !== this && this.isAlliedWith(peep, world))
      .map((peep) => ({ peep, dist: Math.hypot(peep.x - this.x, peep.y - this.y) }))
      .filter((item) => item.dist > 130 && item.dist < this.profile.enemyAwareness * 1.15)
      .sort((a, b) => a.dist - b.dist);
    if (!allies.length) return null;
    const wantsCompany = this.stats.friendliness + this.stats.loyalty >= 11 || this.health <= 2;
    return wantsCompany ? allies[0].peep : null;
  }

  shouldHide(world) {
    if (this.hasWeapon && this.stats.aggression >= 5) return false;
    if (this.health <= 2 && this.stats.aggression <= 6) return true;
    const alive = world.peeps.filter((peep) => peep.alive).length;
    return alive <= 6 && this.stats.aggression <= 3 && Math.random() < 0.02;
  }

  updateSeenRelationships(world) {
    for (const peep of world.peeps) {
      if (peep === this || !peep.alive) continue;
      const dist = Math.hypot(peep.x - this.x, peep.y - this.y);
      if (dist <= this.profile.enemyAwareness) {
        const rel = this.relationshipWith(peep);
        rel.lastSeen = performance.now();
        if (peep.hasWeapon && !this.hasWeapon) rel.fear = Math.min(100, rel.fear + 0.025);
      }
    }
  }

  considerAlliance(world) {
    if (!world.requestAlliance) return;
    if (this.stats.friendliness + this.stats.loyalty < 9) return;
    const currentAlliance = world.getAlliance?.(this.allianceId);
    if (currentAlliance && currentAlliance.members.length >= 3 && currentAlliance.strength > 50) return;

    const candidates = world.peeps
      .filter((peep) => peep !== this && peep.alive && !this.isAlliedWith(peep, world))
      .map((peep) => ({ peep, dist: Math.hypot(peep.x - this.x, peep.y - this.y), rel: this.relationshipWith(peep) }))
      .filter((item) => item.dist <= world.allianceVicinity && item.rel.anger < 25)
      .sort((a, b) => this.allianceDesire(b.peep, b.rel, b.dist) - this.allianceDesire(a.peep, a.rel, a.dist));

    const candidate = candidates[0];
    if (!candidate) return;
    const last = this.lastAllianceProposal.get(candidate.peep.id) || 0;
    if (performance.now() - last < 6000) return;
    if (this.allianceDesire(candidate.peep, candidate.rel, candidate.dist) < 42) return;

    this.lastAllianceProposal.set(candidate.peep.id, performance.now());
    world.requestAlliance(this, candidate.peep);
  }

  allianceDesire(other, rel, dist) {
    const dangerNeed = this.health <= 2 || !this.hasWeapon ? 14 : 0;
    const friendliness = this.stats.friendliness * 6;
    const loyalty = this.stats.loyalty * 2;
    const aggressionPenalty = this.stats.aggression * 3;
    const distancePenalty = dist * 0.04;
    return friendliness + loyalty + rel.trust * 0.4 + rel.bond * 0.35 + dangerNeed - rel.anger * 0.9 - aggressionPenalty - distancePenalty;
  }

  considerBetrayal(world) {
    if (!world.breakAlliance || this.betrayalCooldown > 0 || !this.allianceId) return false;
    const allies = world.peeps.filter((peep) => peep.alive && peep !== this && this.isAlliedWith(peep, world));
    if (!allies.length) return false;
    const alive = world.peeps.filter((peep) => peep.alive);
    const latePressure = alive.length <= Math.max(3, allies.length + 1) ? 30 : 0;
    let best = null;
    let bestScore = -Infinity;

    for (const ally of allies) {
      const rel = this.relationshipWith(ally);
      const opportunity = (ally.hasWeapon && !this.hasWeapon ? 10 : 0) + (ally.health <= 2 ? 16 : 0);
      const score = this.stats.aggression * 9 + opportunity + latePressure + world.betrayalPressure - this.stats.loyalty * 10 - rel.bond * 0.8 - rel.trust * 0.45;
      if (score > bestScore) {
        best = ally;
        bestScore = score;
      }
    }

    if (!best || bestScore < 35) return false;
    world.breakAlliance(this, best);
    this.betrayalCooldown = randomRange(8, 14);
    this.attackTarget = best;
    this.setState("charge");
    return false;
  }

  findNearestWeapon(groundWeapons, infiniteEyes = false) {
    const range = infiniteEyes ? Infinity : (90 + this.stats.eyesight * 32);
    let nearest = null;
    let nearestDist = range;
    for (const weapon of groundWeapons) {
      const dist = Math.hypot(weapon.x - this.x, weapon.y - this.y);
      if (dist < nearestDist) {
        nearest = weapon;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  shouldFlee(threat) {
    if (!threat.target) return false;
    
    let fleeRange = this.hasWeapon ? this.profile.fleeRangeArmed : this.profile.fleeRangeUnarmed;
    
    // Hysteresis / Debouncing: 
    // If already fleeing, stay in flee state until danger is 20% further away.
    // If hunting, don't flee until danger is 20% closer.
    if (this.state === "flee") {
      fleeRange *= 1.2;
    } else if (this.state === "charge" || this.state === "attack") {
      fleeRange *= 0.8;
    }

    if (threat.dist > fleeRange) return false;
    if (this.profile.type === "berserker") return false;
    if (this.health <= 1) return true;
    if (!this.hasWeapon && threat.target.hasWeapon) return true;
    return this.profile.type === "runner" || (this.profile.type === "wanderer" && Math.random() < 0.4);
  }

  updateAttack(dt, world) {
    this.attackTime += dt;
    const damping = Math.pow(0.75, dt * 60);
    this.vx *= damping;
    this.vy *= damping;

    if (!this.attackTarget?.alive || !this.canHarm(this.attackTarget, world)) {
      this.setState("charge");
      return;
    }

    // Face the target
    if (this.attackTarget.x !== this.x) {
      this.flip = this.attackTarget.x < this.x ? -1 : 1;
    }

    if (!this.attackApplied && this.attackTime >= 0.15) {
      const dist = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
      if (dist <= this.getAttackRange() + 10) {
        this.attackTarget.takeDamage(this.getDamage(), this);
        this.attackTarget.remember("attacked_me", this, 1);
        for (const peep of world.peeps) {
          if (peep !== this && peep !== this.attackTarget && peep.alive && world.areAllied?.(peep, this)) {
            peep.remember("fought_beside_me", this, 0.35);
          }
        }
        world.hitEvents.push({
          x: this.attackTarget.x,
          y: this.attackTarget.y,
          weapon: this.weapon || "fists",
          side: this.attackTarget.bodyFrame,
          target: this.attackTarget,
          killer: this,
          fatal: !this.attackTarget.alive,
        });
      }
      this.attackApplied = true;
    }

    if (this.attackTime >= 0.42) this.setState("charge");
    this.animate(0.5, dt);
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
  }

  getAttackRange() {
    if (this.weapon === "gun") return 180;
    if (this.weapon === "shotgun") return 125;
    if (this.weapon === "axe") return 56;
    if (this.weapon === "bat") return 52;
    return 42;
  }

  getDamage() {
    const meleeBonus = Math.max(0, Math.floor((this.stats.strength - 5) / 3));
    if (!this.weapon) return 1 + meleeBonus;
    if (this.weapon === "gun" || this.weapon === "shotgun") return 3;
    return 3 + meleeBonus;
  }

  pickUpWeapon(groundWeapons) {
    if (this.hasWeapon) return;
    const index = groundWeapons.findIndex((weapon) => Math.hypot(weapon.x - this.x, weapon.y - this.y) <= 35);
    if (index >= 0) {
      const [weapon] = groundWeapons.splice(index, 1);
      this.equipWeapon(weapon.type);
    }
  }

  wander(dt) {
    this.wanderTime -= dt;
    if (this.wanderTime <= 0) {
      this.wanderTime = 0.8 + Math.random() * 1.8;
      this.wanderAngle += -1.1 + Math.random() * 2.2;
    }
    this.applyVelocity(Math.cos(this.wanderAngle) * 1.15 * this.speedMultiplier(), Math.sin(this.wanderAngle) * 1.15 * this.speedMultiplier(), dt);
  }

  moveToward(x, y, speed, dt) {
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.applyVelocity((dx / dist) * speed * this.speedMultiplier(), (dy / dist) * speed * this.speedMultiplier(), dt);
  }

  moveAwayFrom(x, y, speed, dt) {
    const dx = this.x - x;
    const dy = this.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    this.applyVelocity((dx / dist) * speed * this.speedMultiplier(), (dy / dist) * speed * this.speedMultiplier(), dt);
  }

  moveInDirection(angle, speed, dt) {
    this.applyVelocity(Math.cos(angle) * speed * this.speedMultiplier(), Math.sin(angle) * speed * this.speedMultiplier(), dt);
  }

  speedMultiplier() {
    return 0.78 + this.stats.speed * 0.045;
  }

  applyVelocity(vx, vy, dt) {
    const blend = 1 - Math.pow(0.9, dt * 60);
    this.vx = this.vx * (1 - blend) + vx * blend;
    this.vy = this.vy * (1 - blend) + vy * blend;
    if (Math.abs(this.vx) > 0.05) this.flip = this.vx < 0 ? -1 : 1;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
  }

  animate(speed, dt) {
    this.hop = (this.hop + (speed / 40) * dt * 60) % 1;
  }

  clamp(world) {
    this.x = Math.max(24, Math.min(world.width - 24, this.x));
    this.y = Math.max(24, Math.min(world.height - 24, this.y));
  }

  render(ctx, sprites) {
    if (!this.alive) return;
    const phase = Math.sin(this.hop * Math.PI * 2);
    const bounce = 1 + Math.max(0, -phase) * 0.08;
    const bob = Math.abs(phase) * 10;
    const rotation = phase * 0.1;
    const scaleX = 0.65 * bounce * this.flip;
    const scaleY = 0.65 / bounce;
    
    const bodyAtlas = sprites.get("body");
    const redAtlas = sprites.get("body_red");
    
    // Choose face atlas based on state
    let faceAtlasName = "face";
    if (this.state === "charge" || this.state === "attack") faceAtlasName = "face_murder";
    else if (this.state === "flee" || this.state === "retreat") faceAtlasName = "face_nervous";
    
    const faceAtlas = sprites.get(faceAtlasName);
    const faceFrame = Math.random() < 0.008 ? 2 : this.faceFrame;
    const bodyName = `body${this.bodyFrame}`;

    ctx.save();
    ctx.translate(this.x, this.y - bob);
    
    const drewBody = bodyAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    if (this.isRed) redAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    
    this.renderFace(ctx, faceAtlas, faceAtlasName, faceFrame, scaleX, scaleY, rotation);
    if (!drewBody) this.drawFallback(ctx);
    if (this.weapon) this.renderWeapon(ctx, sprites);
    this.renderHitFlash(ctx);
    ctx.restore();
  }

  renderFace(ctx, faceAtlas, atlasName, faceFrame, scaleX, scaleY, rotation) {
    const faceName = `${atlasName}${faceFrame}`;
    const faceY = -12;
    if (this.hasRedMouthFace(faceFrame)) {
      const outlineOffsets = [
        [-1.4, 0],
        [1.4, 0],
        [0, -1.4],
        [0, 1.4],
      ];
      for (const [x, y] of outlineOffsets) {
        faceAtlas?.draw(ctx, faceName, x, faceY + y, {
          scaleX,
          scaleY,
          rotation,
          anchorY: 0.65,
          filter: "brightness(0)",
          alpha: 0.85,
        });
      }
    }
    faceAtlas?.draw(ctx, faceName, 0, faceY, { scaleX, scaleY, rotation, anchorY: 0.65 });
  }

  hasRedMouthFace(faceFrame) {
    return faceFrame === 9 || faceFrame === 10 || faceFrame === 11;
  }

  renderWeapon(ctx, sprites) {
    const atlas = sprites.get(`weapons_${this.weapon}`);
    const isAttacking = this.state === "attack" && this.attackTime < 0.28;
    const frame = isAttacking ? 6 : 4;
    const offsetX = this.flip * 24;
    
    let weaponRotation = this.flip < 0 ? -0.08 : 0.08;

    // Dynamic Aiming
    if (isAttacking && this.attackTarget) {
      const dx = this.attackTarget.x - this.x;
      const dy = (this.attackTarget.y - 20) - (this.y - 20); // Aim for chest
      const angle = Math.atan2(dy, dx);
      
      if (this.weapon === "gun" || this.weapon === "shotgun") {
        // Ranged weapons: Full aim, accounting for body flip
        weaponRotation = this.flip < 0 ? angle + Math.PI : angle;
      } else {
        // Melee weapons: Clamped tilt for a natural swing
        const tilt = Math.max(-0.6, Math.min(0.6, angle));
        weaponRotation = this.flip < 0 ? tilt + Math.PI : tilt;
      }
    }

    atlas?.draw(ctx, `weapon_${this.weapon}${frame}`, offsetX, -18, {
      scaleX: 0.36 * this.flip,
      scaleY: 0.36,
      rotation: weaponRotation,
    });
  }

  drawFallback(ctx) {
    ctx.fillStyle = this.isRed ? "#d94b42" : "#efefef";
    ctx.beginPath();
    ctx.arc(0, -20, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  renderHitFlash(ctx) {
    if (this.hitFlash <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, this.hitFlash * 3);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "#ff473f";
    ctx.beginPath();
    ctx.arc(0, -28, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  getSnapshot() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      hop: this.hop,
      flip: this.flip,
      state: this.state,
      attackTime: this.attackTime,
      hitFlash: this.hitFlash,
      faceFrame: this.faceFrame,
      weapon: this.weapon,
      isRed: this.isRed,
      bodyFrame: this.bodyFrame,
      alive: this.alive,
      attackTargetX: this.attackTarget?.x,
      attackTargetY: this.attackTarget?.y,
    };
  }

  static renderFromSnapshot(ctx, snapshot, sprites) {
    if (!snapshot.alive && snapshot.state !== "death_frame") return;
    
    const phase = Math.sin(snapshot.hop * Math.PI * 2);
    const bounce = 1 + Math.max(0, -phase) * 0.08;
    const bob = Math.abs(phase) * 10;
    const rotation = phase * 0.1;
    const scaleX = 0.65 * bounce * snapshot.flip;
    const scaleY = 0.65 / bounce;
    const bodyAtlas = sprites.get("body");
    const redAtlas = sprites.get("body_red");
    
    let faceAtlasName = "face";
    if (snapshot.state === "charge" || snapshot.state === "attack") faceAtlasName = "face_murder";
    else if (snapshot.state === "flee" || snapshot.state === "retreat") faceAtlasName = "face_nervous";
    
    const faceAtlas = sprites.get(faceAtlasName);
    const faceName = `${faceAtlasName}${snapshot.faceFrame}`;
    const bodyName = `body${snapshot.bodyFrame}`;

    ctx.save();
    ctx.translate(snapshot.x, snapshot.y - bob);
    
    // Body
    bodyAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    if (snapshot.isRed) redAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    
    // Face
    const faceY = -12;
    faceAtlas?.draw(ctx, faceName, 0, faceY, { scaleX, scaleY, rotation, anchorY: 0.65 });
    
    // Weapon
    if (snapshot.weapon) {
      const wAtlas = sprites.get(`weapons_${snapshot.weapon}`);
      const isAttacking = snapshot.state === "attack" && snapshot.attackTime < 0.28;
      const wFrame = isAttacking ? 6 : 4;
      const wOffsetX = snapshot.flip * 24;
      let wRot = snapshot.flip < 0 ? -0.08 : 0.08;

      if (isAttacking && snapshot.attackTargetX !== undefined) {
        const dx = snapshot.attackTargetX - snapshot.x;
        const dy = snapshot.attackTargetY - snapshot.y;
        const angle = Math.atan2(dy, dx);
        if (snapshot.weapon === "gun" || snapshot.weapon === "shotgun") {
          wRot = snapshot.flip < 0 ? angle + Math.PI : angle;
        } else {
          const tilt = Math.max(-0.6, Math.min(0.6, angle));
          wRot = snapshot.flip < 0 ? tilt + Math.PI : tilt;
        }
      }
      wAtlas?.draw(ctx, `weapon_${snapshot.weapon}${wFrame}`, wOffsetX, -18, {
        scaleX: 0.36 * snapshot.flip,
        scaleY: 0.36,
        rotation: wRot,
      });
    }
    ctx.restore();
  }

  renderMugshot(sprites) {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    
    ctx.translate(40, 65);
    const scaleX = 0.6;
    const scaleY = 0.6;
    const bodyAtlas = sprites.get("body");
    const redAtlas = sprites.get("body_red");
    const faceAtlas = sprites.get("face");
    const bodyName = `body${this.bodyFrame}`;
    const faceName = `face${this.faceFrame}`;

    bodyAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, anchorY: 0.72 });
    if (this.isRed) redAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, anchorY: 0.72 });
    faceAtlas?.draw(ctx, faceName, 0, -12 * scaleY, { scaleX, scaleY, anchorY: 0.65 });
    
    return canvas.toDataURL();
  }
}

function clampStat(value) {
  return Math.max(1, Math.min(10, Number(value) || 1));
}
