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
    this.isRed = Math.random() < CONSTANTS.PEEP.RED_CHANCE;
    this.faceFrame = Math.floor(Math.random() * CONSTANTS.PEEP.FACE_FRAME_COUNT);
    this.faceLabel = FACE_LABELS[this.faceFrame] || "unknown";
    this.alive = true;
    this.isPlayerControlled = false;
    this.health = CONSTANTS.PEEP.DEFAULT_HEALTH;
    this.maxHealth = CONSTANTS.PEEP.DEFAULT_MAX_HEALTH;
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
    this.loverId = null;
    this.isLoverDead = false;
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
    this.betrayalCooldown = randomRange(CONSTANTS.ALLIANCE.BETRAYAL_COOLDOWN_MIN, CONSTANTS.ALLIANCE.BETRAYAL_COOLDOWN_MAX);
    this.laserCooldown = 0;
    this.laserDuration = 0;
    this.laserPhase = "idle";
    this.laserWindUp = 0;
    this.laserAimX = 0;
    this.laserAimY = 0;

    // Abilities & Traits
    this.isFlying = false;
    this.hasLaserEyes = false;
    this.healOnKill = 0;
    this.regeneration = 0;
    this.armor = 0;
    this.damageReduction = 0;
    this.lifesteal = 0;
    this.hasSuperSpeed = false;
    this.hasMomentum = false;
    this.trailPositions = [];
    this.visualScale = 1;
    this.speedDebuff = 1;
    this.stealthModifier = 1;
    this.scavengerMultiplier = 1;
    this.explodeOnDeath = false;
    this.loverMournTimer = 0;
    this.allianceBonus = 0;
    this.canCommand = false;
    this.commandTargetId = null;
    this.commandType = null;
    this.commandTimer = 0;
    this.recruitmentRange = CONSTANTS.ALLIANCE.VICINITY;
    this.shoutText = "";
    this.shoutType = "social";
    this.shoutTimer = 0;
    this.shoutDuration = 0;
    this.lastShoutTime = 0;
    this.conversationCooldown = 0;
    this.lastLootShoutAt = 0;
    this.sharedLootTarget = null;

    // AI Brain Properties
    this.isAI = !!config.isAI;
    this.aiMemorySummary = "I have just entered the arena. I must survive.";
    this.aiGoalOverride = null; // { goal, targetId, shout, expiresAt }
    this.isThinking = false;

    this.applyTraits(config.traits || []);
    this.applyAbilities(config.abilities || {});
    this.profile = Peep.createProfile(this.stats);

    this.centerX = config.center?.x ?? 1500;
    this.centerY = config.center?.y ?? 900;
    this.openingGoal = this.chooseOpeningGoal();
    this.goal = this.openingGoal;
    this.retreatAngle = Math.atan2(this.y - this.centerY, this.x - this.centerX) + randomRange(-0.6, 0.6);
  }

  shout(text, type = "social", duration = CONSTANTS.DIALOGUE.DEFAULT_DURATION) {
    this.shoutText = text;
    this.shoutType = type;
    this.shoutTimer = duration;
    this.shoutDuration = duration;
    this.lastShoutTime = performance.now();
  }

  static randomLine(pool, weapon = null) {
    const line = pool[Math.floor(Math.random() * pool.length)];
    return weapon ? line.replace("{weapon}", weapon) : line;
  }

  static DIALOGUE = {
    found_weapon: [
      "Found a {weapon}!",
      "Got myself a {weapon}!",
      "Yes, a {weapon}!",
      "{weapon}, check it out!",
      "Nice, a {weapon}!",
    ],
    vengeance: [
      "You'll pay for that!",
      "That was my friend!",
      "I'll make you regret that!",
      "You're dead meat!",
      "For my ally!",
    ],
    fleeing: [
      "Fall back!",
      "Not worth it!",
      "I'm out!",
      "Too hot!",
      "Getting out of here!",
    ],
    defend: [
      "I've got your back!",
      "I'm coming!",
      "Hang in there!",
      "On my way!",
      "Don't worry!",
    ],
    attack: [
      "Flank them!",
      "Get them!",
      "Attack now!",
      "Move in!",
      "Together!",
    ],
    betray: [
      "Sorry about this...",
      "Nothing personal.",
      "It's just business.",
      "Can't trust anyone.",
      "Goodbye.",
    ],
    taunt: [
      "Is that all you've got?",
      "Not so tough now!",
      "Stay down.",
      "Too easy.",
      "Any last words?",
    ],
    panic: [
      "NO!!!",
      "Not like this!",
      "This can't be happening!",
      "I don't want to die!",
    ],
    lover_died: [
      "NOOOOO!!!",
      "Not you too!",
      "Why?!",
      "I can't go on!",
    ],
    revenge: [
      "ENOUGH!",
      "I'll kill you!",
      "You're mine!",
      "Time to die!",
    ],
    affirm: [
      "Right behind you!",
      "On it!",
      "Let's go!",
      "Copy that!",
      "With you!",
    ],
    encourage: [
      "You've got this!",
      "Keep fighting!",
      "Don't give up!",
      "We'll make it!",
      "Stay strong!",
    ],
    respond_ally: [
      "Together we're stronger!",
      "I'm right here!",
      "We've got this!",
      "Let's show them!",
      "For the alliance!",
    ],
    respond_enemy: [
      "You talk too much.",
      "Come say that closer.",
      "We'll see about that.",
      "Big talk for someone about to die.",
      "Shut up and fight.",
    ],
    loot_response: [
      "Nice find!",
      "Save some for me!",
      "I'm jealous!",
      "Good, we needed that!",
      "Keep it safe!",
    ],
  };

  applyTraits(traitNames) {
    traitNames.forEach(name => {
        const trait = TRAIT_LIBRARY[name.toLowerCase()];
        if (!trait) return;
        if (trait.stats) this.applyStats(trait.stats);
        if (trait.abilities) this.applyAbilities(trait.abilities);
        if (trait.startingWeapon) {
          const weapon = trait.startingWeapon === "random"
            ? ["gun", "bat", "shotgun", "axe"][Math.floor(Math.random() * 4)]
            : trait.startingWeapon;
          this.equipWeapon(weapon);
        }
    });
  }

  applyStats(stats) {
    for (const [name, value] of Object.entries(stats)) {
      if (Object.prototype.hasOwnProperty.call(STAT_REGISTRY, name)) {
        this.stats[name] = clampStat(value);
      }
    }
  }

  applyAbilities(abilities) {
    const previousMaxHealth = this.maxHealth;
    const { maxHealth, maxHealthDelta, ...rest } = abilities;
    Object.assign(this, rest);
    if (maxHealth !== undefined) {
      this.maxHealth = Math.max(1, Number(maxHealth) || 1);
    }
    if (maxHealthDelta !== undefined) {
      this.maxHealth = Math.max(1, this.maxHealth + (Number(maxHealthDelta) || 0));
    }
    if (this.maxHealth !== previousMaxHealth) {
      this.health = Math.min(this.maxHealth, this.health + Math.max(0, this.maxHealth - previousMaxHealth));
    }
    this.damageReduction = Math.max(0, Math.min(0.9, Number(this.damageReduction) || 0));
    this.stealthModifier = Math.max(0.2, Math.min(2, Number(this.stealthModifier) || 1));
    this.scavengerMultiplier = Math.max(0.2, Math.min(4, Number(this.scavengerMultiplier) || 1));
    this.speedDebuff = Math.max(0.2, Math.min(2, Number(this.speedDebuff) || 1));
  }

    // --- ROMANCE LOGIC ---
    tryFallInLove(peeps, world, dt) {
      if (this.loverId) return;
      const MIN_COURTSHIP = CONSTANTS.ROMANCE.MIN_COURTSHIP; // seconds of cumulative proximity needed
      for (const other of peeps) {
        if (other === this || other.loverId || !other.alive) continue;
        const rel = this.relationshipWith(other);
        const dist = Math.hypot(other.x - this.x, other.y - this.y);
        if (dist < CONSTANTS.ROMANCE.PROXIMITY_RANGE) {
          // Accumulate proximity time for both tributes
          rel.timeNear += dt;
          if (rel.timeNear >= MIN_COURTSHIP && rel.trust > CONSTANTS.ROMANCE.MIN_TRUST && rel.bond > CONSTANTS.ROMANCE.MIN_BOND) {
            this.loverId = other.id;
            other.loverId = this.id;
            world.logEvent({
                type: "romance",
                proposer: this.name,
                candidate: other.name,
                timestamp: performance.now(),
                x: this.x,
                y: this.y
            });
          }
        }
      }
    }

    isLover(other) {
      return this.loverId === other.id;
    }

    hearShouts(world) {
      if (this.conversationCooldown > 0 || this.shoutTimer > 0) return;
      for (const other of world.peeps) {
        if (other === this || !other.alive) continue;
        // Only respond to shouts that started in the last 0.3s
        if (other.shoutTimer <= 0 || other.shoutTimer > other.shoutDuration - CONSTANTS.DIALOGUE.LISTEN_WINDOW) continue;
        const dist = Math.hypot(other.x - this.x, other.y - this.y);
        if (dist > CONSTANTS.DIALOGUE.MAX_DIST) continue;
        if (Math.random() > CONSTANTS.DIALOGUE.RESPONSE_CHANCE) continue;
        const isAlly = this.isAlliedWith(other, world);
        const rel = this.relationshipWith(other);
        let pool = null;
        if (isAlly || rel.bond > 50) {
          if (other.shoutType === "tactical") pool = Peep.DIALOGUE.affirm;
          else if (other.shoutType === "loot") pool = Peep.DIALOGUE.loot_response;
          else pool = Peep.DIALOGUE.respond_ally;
        } else if (rel.anger > 40) {
          pool = Peep.DIALOGUE.respond_enemy;
        } else if (Math.random() < 0.3) {
          pool = Math.random() < 0.5 ? Peep.DIALOGUE.encourage : Peep.DIALOGUE.taunt;
        }
        if (pool) {
          this.shout(Peep.randomLine(pool), "social", 2.0);
          this.conversationCooldown = CONSTANTS.DIALOGUE.CONVERSATION_COOLDOWN;
        }
        break;
      }
    }

    handlePlayerInput(dt, world) {
      const keys = world.keysPressed || {};
      const aimAngle = world.aimAngle || 0;
      const attackQueued = world.attackQueued || false;

      // Always face aim direction
      this.flip = Math.cos(aimAngle) < 0 ? -1 : 1;

      if (this.state === "attack") {
        // Attack animation is handled by updateAttack called from the main update branch
        return;
      }

      // Movement (WASD / Arrow keys)
      let mx = 0, my = 0;
      if (keys["KeyW"] || keys["ArrowUp"]) my -= 1;
      if (keys["KeyS"] || keys["ArrowDown"]) my += 1;
      if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
      if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;

      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len;
        my /= len;
      }

      const moveSpeed = this.hasWeapon ? CONSTANTS.SPEED.PLAYER_ARMED : CONSTANTS.SPEED.PLAYER_UNARMED;
      this.applyVelocity(mx * moveSpeed * this.speedMultiplier(), my * moveSpeed * this.speedMultiplier(), dt);
      this.setState("wander");

      // Attack on click — target enemy nearest to aim ray
      if (attackQueued) {
        const attackRange = this.getAttackRange() + 15;
        const aimX = this.x + Math.cos(aimAngle) * attackRange;
        const aimY = this.y + Math.sin(aimAngle) * attackRange;

        let bestTarget = null;
        let bestScore = Infinity;
        for (const peep of world.peeps) {
          if (!this.canHarm(peep, world)) continue;
          const dToAim = Math.hypot(peep.x - aimX, peep.y - aimY);
          const dToSelf = Math.hypot(peep.x - this.x, peep.y - this.y);
          if (dToSelf <= attackRange + 15) {
            const score = dToAim + dToSelf * 0.3;
            if (score < bestScore) {
              bestTarget = peep;
              bestScore = score;
            }
          }
        }

        if (bestTarget) {
          this.attackTarget = bestTarget;
          this.setState("attack");
          this.attackTime = 0;
          this.attackApplied = false;
        }
      }

      // Auto-pickup weapons
      this.pickUpWeapon(world.groundWeapons);
    }

    static createStats(overrides = {}) {
      const stats = {};
      for (const [name, config] of Object.entries(STAT_REGISTRY)) {
          stats[name] = clampStat(overrides[name] ?? (config.min + Math.floor(Math.random() * (config.max - config.min + 1))));
      }
      return stats;
    }

  static createProfile(stats) {
    const roll = Math.random();
    const awareness = CONSTANTS.PROFILE.AWARENESS_BASE + stats.eyesight * CONSTANTS.PROFILE.AWARENESS_PER_EYESIGHT;
    const caution = Math.max(0, CONSTANTS.PROFILE.CAUTION_FORMULA_BASE - stats.aggression);
    if (roll < CONSTANTS.PROFILE.RUNNER_CHANCE) {
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
    if (roll < CONSTANTS.PROFILE.SCAVENGER_CHANCE) {
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
    if (roll < CONSTANTS.PROFILE.WANDERER_CHANCE) {
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
    if (roll < CONSTANTS.PROFILE.HUNTER_CHANCE) {
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
        timeNear: 0,
      });
    }
  }

  relationshipWith(other) {
    if (!other) return null;
    if (!this.relationships.has(other.id)) {
      this.relationships.set(other.id, { trust: 15, fear: 0, anger: 0, bond: 0, lastSeen: 0, timeNear: 0 });
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
      rel.trust = Math.max(0, rel.trust - CONSTANTS.ALLIANCE.TRUST_ATTACKED * weight);
      rel.anger = Math.min(100, rel.anger + CONSTANTS.ALLIANCE.ANGER_ATTACKED * weight);
      rel.fear = Math.min(100, rel.fear + CONSTANTS.ALLIANCE.FEAR_ATTACKED * weight);
    } else if (type === "fought_beside_me") {
      rel.trust = Math.min(100, rel.trust + CONSTANTS.ALLIANCE.TRUST_FOUGHT * weight);
      rel.bond = Math.min(100, rel.bond + CONSTANTS.ALLIANCE.BOND_FOUGHT * weight);
    } else if (type === "killed_ally") {
      rel.trust = Math.max(0, rel.trust - CONSTANTS.ALLIANCE.TRUST_KILLED_ALLY * weight);
      rel.anger = Math.min(100, rel.anger + CONSTANTS.ALLIANCE.ANGER_KILLED_ALLY * weight);
      this.shout(Peep.randomLine(Peep.DIALOGUE.vengeance), "social", 2.2);
    } else if (type === "betrayed_me") {
      rel.trust = Math.max(0, rel.trust - CONSTANTS.ALLIANCE.TRUST_BETRAYED * weight);
      rel.anger = Math.min(100, rel.anger + CONSTANTS.ALLIANCE.ANGER_BETRAYED * weight);
      rel.bond = Math.max(0, rel.bond - CONSTANTS.ALLIANCE.BOND_BETRAYED * weight);
    }
  }

  equipWeapon(type) {
    this.weapon = type;
    this.hasWeapon = true;
    // Always reset ranged timers so old weapon state never leaks
    this.laserPhase = "idle";
    this.laserCooldown = 0;
    this.laserDuration = 0;
    this.laserWindUp = 0;
    if (this.profile && this.profile.retreatAfterWeapon) {
      this.retreatAngle = Math.atan2(this.y - this.centerY, this.x - this.centerX) + randomRange(-0.5, 0.5);
      this.setState("retreat");
    }
  }

  canStartAttack() {
    const w = WEAPON_REGISTRY[this.weapon];
    if (!w?.ranged) return true;
    return this.laserPhase === "idle" && this.laserCooldown <= 0;
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
      const detectionDist = dist / (peep.stealthModifier || 1);
      if (detectionDist > range) continue;
      const rel = this.relationshipWith(peep);
      const weaponThreat = peep.hasWeapon ? 18 : 0;
      const weakTarget = (peep.maxHealth - peep.health) * 7;
      const score = 120 - detectionDist * 0.25 + rel.anger * 1.2 - rel.fear * 0.35 + weaponThreat + weakTarget + this.stats.aggression * 4;
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
    const reducedAmount = amount * (1 - this.damageReduction);
    const finalAmount = Math.max(0.5, reducedAmount - this.armor);
    this.health -= finalAmount;
    this.hitFlash = CONSTANTS.PEEP.HIT_FLASH_DURATION;
    if (this.health <= 0) {
      this._deathBy = killer || null;
      this.alive = false;
      if (killer) {
        killer.kills += 1;
        if (killer.healOnKill) {
          killer.health = Math.min(killer.maxHealth, killer.health + killer.healOnKill);
        }
      }
    }
  }

  die() {
    const weaponConfig = WEAPON_REGISTRY[this.weapon];
    const canDrop = weaponConfig ? weaponConfig.droppable : true;

    return {
      id: this.id,
      name: this.name,
      district: this.district,
      x: this.x,
      y: this.y,
      weapon: canDrop ? this.weapon : null,
      side: this.bodyFrame,
      kills: this.kills,
      killedBy: this._deathBy,
    };
  }

  update(dt, world) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.betrayalCooldown = Math.max(0, this.betrayalCooldown - dt);
    this.laserCooldown = Math.max(0, this.laserCooldown - dt);
    this.laserDuration = Math.max(0, this.laserDuration - dt);
    this.laserWindUp = Math.max(0, this.laserWindUp - dt);
    this.stateTime += dt;
    this.commandTimer = Math.max(0, this.commandTimer - dt);
    this.conversationCooldown = Math.max(0, this.conversationCooldown - dt);
    this.shoutTimer = Math.max(0, this.shoutTimer - dt);

    if (this.loverMournTimer > 0) {
      this.loverMournTimer -= dt;
      if (this.loverMournTimer <= 0) {
        this.loverId = null;
        this.isLoverDead = false;
      }
    }

    if (this.regeneration > 0 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + this.regeneration * dt);
    }

    if (this.isPlayerControlled) {
      this.handlePlayerInput(dt, world);
      if (this.state === "attack") this.updateAttack(dt, world);
      this.animate(Math.hypot(this.vx, this.vy), dt);
      this.x += this.vx * dt * 60;
      this.y += this.vy * dt * 60;
      this.clamp(world);
      return;
    }

    // Command Logic
    if (this.canCommand && this.allianceId && this.commandTimer <= 0) {
        this.processCommands(world);
    }

    // Listen to commands if in an alliance
    const alliance = world.getAlliance?.(this.allianceId);
    // Clear stale commands if the alliance has no alive leader
    if (alliance?.commandTargetId) {
      const hasAliveLeader = world.peeps.some(p => p.alive && p.canCommand && p.allianceId === this.allianceId);
      if (!hasAliveLeader) alliance.commandTargetId = null;
    }
    let orderTarget = null;
    if (alliance?.commandTargetId) {
        orderTarget = world.peeps.find(p => p.id === alliance.commandTargetId && p.alive);
    }

    // Listen for loot targets shared by allies
    if (this.allianceId && !this.hasWeapon) {
        const loudAlly = world.peeps.find(p => p.alive && p.allianceId === this.allianceId && p.sharedLootTarget);
        if (loudAlly) {
            const dist = Math.hypot(loudAlly.sharedLootTarget.x - this.x, loudAlly.sharedLootTarget.y - this.y);
            if (dist < 300) this.sharedLootTarget = loudAlly.sharedLootTarget;
        }
    }

    // ... rest of update
    this.pickUpWeapon(world.groundWeapons);
    this.updateSeenRelationships(world);
    this.considerAlliance(world);
    this.tryFallInLove(world.peeps, world, dt);
    this.hearShouts(world);
    if (this.considerBetrayal(world)) return;

    // --- AI BRAIN OVERRIDE ---
    let finalGoal = null;
    let finalTarget = null;
    let isAiControlled = false;

    if (this.isAI && this.aiGoalOverride && performance.now() < this.aiGoalOverride.expiresAt) {
        finalGoal = this.aiGoalOverride.goal;
        finalTarget = world.peeps.find(p => p.id === this.aiGoalOverride.targetId && p.alive);
        isAiControlled = true;

        // Emergency Override: If AI is "tweaking" (e.g. trying to scavenge while being hit)
        // or just in extreme danger, force a survival state.
        const immediateThreat = this.findNearestEnemy(world.peeps, world, 80);
        if (immediateThreat.target && finalGoal !== "hunt" && finalGoal !== "flee") {
            finalGoal = "flee";
            finalTarget = immediateThreat.target;
        }

        if (this.aiGoalOverride.shout) {
            this.shout(this.aiGoalOverride.shout, "ai_brain", CONSTANTS.DIALOGUE.AI_BRAIN_DURATION);
            this.aiGoalOverride.shout = null; // Fire once
        }
    }

    if (this.state === "attack") {
      this.updateAttack(dt, world);
    } else if (this.state === "retreat" && this.stateTime < this.profile.retreatDuration) {
      this.setGoal("flee", null, world);
      this.setState("retreat");
      this.moveInDirection(this.retreatAngle, this.hasWeapon ? CONSTANTS.SPEED.RETREAT_ARMED : CONSTANTS.SPEED.RETREAT_UNARMED, dt);
    } else if (this.state === "panic" && this.stateTime < 4.0) {
      this.setGoal("flee", null, world);
      if (this.stateTime < 0.1 && this.shoutTimer <= 0) {
        this.shout("NOOOOO!!!", "social", CONSTANTS.DIALOGUE.PANIC_DURATION);
      }
      this.wander(dt, world);
      const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
      const targetVx = Math.cos(this.wanderAngle) * CONSTANTS.SPEED.PANIC * this.speedMultiplier();
      const targetVy = Math.sin(this.wanderAngle) * CONSTANTS.SPEED.PANIC * this.speedMultiplier();
      this.vx = this.vx * (1 - blend) + targetVx * blend;
      this.vy = this.vy * (1 - blend) + targetVy * blend;
      if (Math.abs(this.vx) > CONSTANTS.MOVEMENT.VELOCITY_FLIP_THRESHOLD) this.flip = this.vx < 0 ? -1 : 1;
    } else {
      const aliveCount = world.peeps.filter(p => p.alive).length;
      const infiniteEyes = aliveCount <= 3 || this.hasLaserEyes;

      const threatRange = infiniteEyes ? Infinity : this.profile.enemyAwareness;
      const threat = this.findNearestEnemy(world.peeps, world, threatRange);

      if (isAiControlled) {
          // AI Logic
          this.setGoal(finalGoal, finalTarget, world);
          if (finalGoal === "flee" && finalTarget) {
              this.setState("flee");
              this.moveAwayFrom(finalTarget.x, finalTarget.y, this.hasWeapon ? 2.1 : 2.75, dt);
          } else if (finalGoal === "hunt" && finalTarget) {
              this.setState("charge");
              const dist = Math.hypot(finalTarget.x - this.x, finalTarget.y - this.y);
              if (dist <= this.getAttackRange() && this.canStartAttack()) {
                  this.attackTarget = finalTarget;
                  this.setState("attack");
                  this.attackTime = 0;
                  this.attackApplied = false;
              } else {
                  this.moveToward(finalTarget.x, finalTarget.y, CONSTANTS.SPEED.CHARGE, dt);
              }
          } else if (finalGoal === "scavenge_weapon") {
              const weapon = this.findNearestWeapon(world.groundWeapons, true, world);
              if (weapon) {
                  this.setState("scavenge");
                  this.moveToward(weapon.x, weapon.y, CONSTANTS.SPEED.SCAVENGE, dt);
              } else {
                  this.setState("wander");
                  this.wander(dt, world);
              }
          } else if (finalGoal === "regroup") {
              const ally = this.findRegroupAlly(world) || world.peeps.find(p => p.alive && p !== this && p.allianceId === this.allianceId);
              if (ally) {
                  this.setState("regroup");
                  this.moveToward(ally.x, ally.y, CONSTANTS.SPEED.REGROUP, dt);
              } else {
                  this.setState("wander");
                  this.wander(dt, world);
              }
          } else if (finalGoal === "hide") {
              this.setState("hide");
                  this.moveInDirection(this.retreatAngle, CONSTANTS.SPEED.HIDE, dt);
          } else {
              this.setState("wander");
              this.wander(dt, world);
          }
      } else if (this.shouldFlee(threat)) {
        this.setGoal("flee", threat.target, world);
        this.setState("flee");
        if (this.stateTime < 0.1) this.shout(Peep.randomLine(Peep.DIALOGUE.fleeing), "tactical", CONSTANTS.DIALOGUE.TACTICAL_DURATION);
        this.moveAwayFrom(threat.target.x, threat.target.y, this.hasWeapon ? CONSTANTS.SPEED.FLEE_ARMED : CONSTANTS.SPEED.FLEE_UNARMED, dt);
      } else {
        const baseHuntRange = this.hasWeapon
          ? Math.max(this.profile.huntRangeArmed, this.getAttackRange())
          : this.profile.huntRangeUnarmed;
        const huntRange = infiniteEyes ? Infinity : baseHuntRange;

        // Command Priority
        let finalEnemy = this.findNearestEnemy(world.peeps, world, huntRange);
        if (orderTarget && this.canHarm(orderTarget, world)) {
            const distToOrder = Math.hypot(orderTarget.x - this.x, orderTarget.y - this.y);
            if (infiniteEyes || distToOrder < huntRange * 1.5) {
                finalEnemy = { target: orderTarget, dist: distToOrder };
            }
        }

        const weapon = !this.hasWeapon ? (this.sharedLootTarget || this.findNearestWeapon(world.groundWeapons, infiniteEyes, world)) : null;
        if (weapon && !this.hasWeapon && performance.now() - this.lastLootShoutAt > 15000) {
            this.shout(Peep.randomLine(Peep.DIALOGUE.found_weapon, weapon.type || 'weapon'), "social", CONSTANTS.DIALOGUE.SOCIAL_DURATION);
            this.sharedLootTarget = weapon;
            this.lastLootShoutAt = performance.now();
        }

        const ally = this.findRegroupAlly(world);
        
        // Defender Mode: Find lover in trouble
        let loverInTrouble = null;
        if (this.loverId) {
          const lover = world.peeps.find(p => p.id === this.loverId && p.alive);
          if (lover && (lover.state === "flee" || lover.state === "panic" || world.peeps.some(p => p.alive && p.attackTarget === lover))) {
            loverInTrouble = lover;
          }
        }

        if (!this.openingComplete && world.elapsed < 4.5) {
          this.executeOpeningGoal(dt, world, weapon);
        } else if (loverInTrouble) {
          this.setGoal("defend", loverInTrouble, world);
          this.setState("charge");
          if (this.stateTime < 0.1) this.shout(Peep.randomLine(Peep.DIALOGUE.defend), "tactical", CONSTANTS.DIALOGUE.DEFEND_DURATION);
          this.moveToward(loverInTrouble.x, loverInTrouble.y, 2.75, dt);
        } else if (finalEnemy.target) {
          this.setGoal("hunt", finalEnemy.target, world);
          this.setState("charge");
          if (finalEnemy.dist <= this.getAttackRange() && this.canStartAttack()) {
            this.attackTarget = finalEnemy.target;
            this.setState("attack");
            this.attackTime = 0;
            this.attackApplied = false;
          } else {
            this.moveToward(finalEnemy.target.x, finalEnemy.target.y, 2.35, dt);
          }
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
          this.sharedLootTarget = null;
          this.wander(dt, world);
        }
      }
    }

    this.animate(Math.hypot(this.vx, this.vy), dt);
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
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
      this.moveToward(weapon.x, weapon.y, CONSTANTS.SPEED.GRAB_WEAPON, dt);
      return;
    }
    if (this.openingGoal === "skirt_center") {
      this.setGoal("scavenge_weapon", null, world);
      this.setState("scavenge");
      const angle = Math.atan2(this.y - world.center.y, this.x - world.center.x) + CONSTANTS.MOVEMENT.SKirtCenterAngleOffset;
      const x = world.center.x + Math.cos(angle) * CONSTANTS.MOVEMENT.SKirtCenterRadius;
      const y = world.center.y + Math.sin(angle) * CONSTANTS.MOVEMENT.SKirtCenterRadius;
      this.moveToward(x, y, CONSTANTS.SPEED.SKIRT_CENTER, dt);
      return;
    }

    this.setGoal("rush_center", null, world);
    this.setState("rush_center");
      const centerDist = Math.hypot(world.center.x - this.x, world.center.y - this.y);
      if (this.stateTime > this.profile.centerTime || centerDist < 120) {
        this.openingComplete = true;
        this.setState("wander");
      }
      this.moveToward(world.center.x, world.center.y, CONSTANTS.SPEED.RUSH_CENTER, dt);
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
    if (world?.logGoal && now - this.lastGoalLogAt > CONSTANTS.GOAL_LOGGING.COOLDOWN) {
      this.lastGoalLogAt = now;
      world.logGoal(this, goal, target);
    }
  }

  goalLabel() {
    return this.goal.replace(/_/g, " ");
  }

  findRegroupAlly(world) {
    if (!this.allianceId || this.health <= 1) return null;
    
    // Hysteresis: prevent stuttering by using a large trigger gap
    const isRegrouping = this.goal === "regroup";
    const minRange = CONSTANTS.REGROUP.MIN_RANGE; // Stop regrouping when this close
    const triggerRange = CONSTANTS.REGROUP.TRIGGER_RANGE; // Only start regrouping if further than this
    
    const rangeThreshold = isRegrouping ? minRange : triggerRange;
    const maxRange = this.profile.enemyAwareness * (isRegrouping ? CONSTANTS.REGROUP.RANGE_MULT_REGROUPING : CONSTANTS.REGROUP.RANGE_MULT_DEFAULT);

    const allies = world.peeps
      .filter((peep) => peep.alive && peep !== this && this.isAlliedWith(peep, world))
      .map((peep) => ({ peep, dist: Math.hypot(peep.x - this.x, peep.y - this.y) }))
      .filter((item) => item.dist > rangeThreshold && item.dist < maxRange)
      .sort((a, b) => a.dist - b.dist);
    
    if (!allies.length) return null;
    const wantsCompany = this.stats.friendliness + this.stats.loyalty >= CONSTANTS.REGROUP.WANTS_COMPANY_FRIENDLINESS_LOYALTY || this.health <= CONSTANTS.REGROUP.WANTS_COMPANY_HEALTH;
    return wantsCompany ? allies[0].peep : null;
  }

  shouldHide(world) {
    if (this.hasWeapon && this.stats.aggression >= CONSTANTS.HIDE.AGGRESSION_WEAPON_THRESHOLD) return false;
    if (this.health <= 2 && this.stats.aggression <= CONSTANTS.HIDE.AGGRESSION_THRESHOLD) return true;
    const alive = world.peeps.filter((peep) => peep.alive).length;
    return alive <= CONSTANTS.HIDE.ALIVE_THRESHOLD && this.stats.aggression <= CONSTANTS.HIDE.AGGRESSION_THRESHOLD && Math.random() < CONSTANTS.HIDE.CHANCE;
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
    
    // Recruitment Logic: Leaders can merge alliances
    const canRecruit = this.canCommand;
    if (!canRecruit && currentAlliance && currentAlliance.members.length >= 3 && currentAlliance.strength > 50) return;

    const candidates = world.peeps
      .filter((peep) => peep !== this && peep.alive && !this.isAlliedWith(peep, world))
      .map((peep) => ({ peep, dist: Math.hypot(peep.x - this.x, peep.y - this.y), rel: this.relationshipWith(peep) }))
      .filter((item) => item.dist <= this.recruitmentRange && (canRecruit || item.rel.anger < 25))
      .sort((a, b) => this.allianceDesire(b.peep, b.rel, b.dist) - this.allianceDesire(a.peep, a.rel, a.dist));

    const candidate = candidates[0];
    if (!candidate) return;
    const last = this.lastAllianceProposal.get(candidate.peep.id) || 0;
    if (performance.now() - last < CONSTANTS.ALLIANCE.PROPOSAL_COOLDOWN) return;
    if (this.allianceDesire(candidate.peep, candidate.rel, candidate.dist) < (canRecruit ? CONSTANTS.ALLIANCE.LEADER_DESIRE_THRESHOLD : CONSTANTS.ALLIANCE.DESIRE_THRESHOLD)) return;

    this.lastAllianceProposal.set(candidate.peep.id, performance.now());
    world.requestAlliance(this, candidate.peep);
  }

  processCommands(world) {
    const alliance = world.getAlliance?.(this.allianceId);
    if (!alliance) return;

    // Reset old commands
    if (alliance.commandTargetId) {
        const target = world.peeps.find(p => p.id === alliance.commandTargetId);
        if (!target || !target.alive) {
            alliance.commandTargetId = null;
        }
    }

    // 1. HELP! If the leader is being attacked, call everyone.
    const attacker = world.peeps.find(p => p.alive && p.attackTarget === this);
    if (attacker) {
        alliance.commandTargetId = attacker.id;
        alliance.commandType = "bodyguard";
        this.commandTimer = 4.0;
        this.shout(Peep.randomLine(Peep.DIALOGUE.defend), "tactical");
        return;
    }

    const members = world.peeps.filter(p => p.alive && p.allianceId === this.allianceId);
    const enemies = world.peeps.filter(p => p.alive && !this.isAlliedWith(p, world));
    const hurtMembers = members.filter(p => p.health <= Math.max(1.5, p.maxHealth * 0.45));
    if (members.length >= 2 && enemies.length >= members.length && hurtMembers.length >= Math.ceil(members.length / 2)) {
        alliance.commandTargetId = null;
        alliance.commandType = "fallback";
        this.commandTimer = 5.0;
        this.shout(Peep.randomLine(Peep.DIALOGUE.fleeing), "tactical");
        return;
    }

    // 2. KILL ORDER! Randomly pick a target.
    if (Math.random() < 0.05) {
        // Prioritize non-allies
        let targetPool = enemies;
        
        // If only allies left, betrayal!
        if (targetPool.length === 0) {
            targetPool = world.peeps.filter(p => p.alive && p !== this);
        }

        if (targetPool.length > 0) {
            const target = targetPool[Math.floor(Math.random() * targetPool.length)];
            alliance.commandTargetId = target.id;
            alliance.commandType = members.length >= 3 ? "pincer" : "attack";
            this.commandTimer = 8.0; // Commands last a while
            this.shout(Peep.randomLine(Peep.DIALOGUE.attack), "tactical");
        }
    }
  }

  allianceDesire(other, rel, dist) {
    const dangerNeed = this.health <= 2 || !this.hasWeapon ? CONSTANTS.ALLIANCE.DESIRE_DANGER_NEED : 0;
    const friendliness = this.stats.friendliness * CONSTANTS.ALLIANCE.DESIRE_FRIENDLINESS_MULT;
    const loyalty = this.stats.loyalty * CONSTANTS.ALLIANCE.DESIRE_LOYALTY_MULT;
    const aggressionPenalty = this.stats.aggression * CONSTANTS.ALLIANCE.DESIRE_AGGRESSION_PENALTY_MULT;
    const distancePenalty = dist * CONSTANTS.ALLIANCE.DESIRE_DIST_PENALTY_MULT;
    return friendliness + loyalty + rel.trust * CONSTANTS.ALLIANCE.DESIRE_TRUST_MULT + rel.bond * CONSTANTS.ALLIANCE.DESIRE_BOND_MULT + dangerNeed + this.allianceBonus - rel.anger * CONSTANTS.ALLIANCE.DESIRE_ANGER_PENALTY_MULT - aggressionPenalty - distancePenalty;
  }

  considerBetrayal(world) {
    if (!world.breakAlliance || this.betrayalCooldown > 0 || !this.allianceId) return false;
    const allies = world.peeps.filter((peep) => peep.alive && peep !== this && this.isAlliedWith(peep, world));
    if (!allies.length) return false;
    const alive = world.peeps.filter((peep) => peep.alive);
    const latePressure = alive.length <= Math.max(3, allies.length + 1) ? CONSTANTS.ALLIANCE.BETRAYAL_LATE_PRESSURE : 0;
    let best = null;
    let bestScore = -Infinity;

    for (const ally of allies) {
      const rel = this.relationshipWith(ally);
      const opportunity = (ally.hasWeapon && !this.hasWeapon ? CONSTANTS.ALLIANCE.BETRAYAL_WEAPON_OPPORTUNITY : 0) + (ally.health <= 2 ? CONSTANTS.ALLIANCE.BETRAYAL_HEALTH_OPPORTUNITY : 0);
      const score = this.stats.aggression * CONSTANTS.ALLIANCE.BETRAYAL_AGGRESSION_MULT + opportunity + latePressure + world.betrayalPressure - this.stats.loyalty * CONSTANTS.ALLIANCE.BETRAYAL_LOYALTY_PENALTY_MULT - rel.bond * CONSTANTS.ALLIANCE.BETRAYAL_BOND_PENALTY_MULT - rel.trust * CONSTANTS.ALLIANCE.BETRAYAL_TRUST_PENALTY_MULT;
      if (score > bestScore) {
        best = ally;
        bestScore = score;
      }
    }

    if (!best || bestScore < CONSTANTS.ALLIANCE.BETRAYAL_SCORE_MIN) return false;
    world.breakAlliance(this, best);
    this.betrayalCooldown = randomRange(CONSTANTS.ALLIANCE.POST_BETRAYAL_COOLDOWN_MIN, CONSTANTS.ALLIANCE.POST_BETRAYAL_COOLDOWN_MAX);
    this.attackTarget = best;
    this.setState("charge");
    return true;
  }

  findNearestWeapon(groundWeapons, infiniteEyes = false, world = null) {
    const range = infiniteEyes ? Infinity : (90 + this.stats.eyesight * 32) * this.scavengerMultiplier;
    let nearest = null;
    let nearestDist = range;
    const alliance = world?.getAlliance?.(this.allianceId);
    const loot = alliance?.lootTarget;
    if (loot && performance.now() < loot.expiresAt) {
      const lootDist = Math.hypot(loot.x - this.x, loot.y - this.y);
      const stillExists = groundWeapons.some(w => w.type === loot.type && Math.hypot(w.x - loot.x, w.y - loot.y) < 8);
      if (stillExists && lootDist < range * 1.35) {
        nearest = loot;
        nearestDist = lootDist;
      }
    }
    for (const weapon of groundWeapons) {
      const dist = Math.hypot(weapon.x - this.x, weapon.y - this.y);
      if (dist < nearestDist) {
        nearest = weapon;
        nearestDist = dist;
      }
    }
    if (nearest && alliance && performance.now() - this.lastLootShoutAt > 8000) {
      alliance.lootTarget = {
        type: nearest.type,
        x: nearest.x,
        y: nearest.y,
        expiresAt: performance.now() + 6500,
      };
      this.lastLootShoutAt = performance.now();
      this.shout(Peep.randomLine(Peep.DIALOGUE.found_weapon, this.weaponLabel(nearest.type)), "loot");
    }
    return nearest;
  }

  weaponLabel(type) {
    if (type === "gun") return "glock";
    if (type === "shotgun") return "shotgun";
    if (type === "bat") return "bat";
    if (type === "axe") return "axe";
    return "weapon";
  }

  shouldFlee(threat) {
    if (this.name.toLowerCase() === "superman") return false;
    if (!threat.target) return false;
    
    let fleeRange = this.hasWeapon ? this.profile.fleeRangeArmed : this.profile.fleeRangeUnarmed;
    
    // Hysteresis / Debouncing:
    // If already fleeing, stay in flee state until danger is 50% further away.
    // If hunting, don't flee until danger is 20% closer.
    if (this.state === "flee") {
      fleeRange *= CONSTANTS.FLEE.HYSTERESIS_FLEE_MULT;
    } else if (this.state === "charge" || this.state === "attack") {
      fleeRange *= CONSTANTS.FLEE.HYSTERESIS_HUNT_MULT;
    }

    if (threat.dist > fleeRange) return false;

    // Courage/Anger logic: If we are very angry at this person, we are less likely to flee
    const rel = this.relationshipWith(threat.target);
    const angerCourage = (rel?.anger || 0) * CONSTANTS.FLEE.ANGER_COURAGE_MULT; // Increased weight
    if (this.stats.aggression + angerCourage >= CONSTANTS.FLEE.AGGRESSION_COURAGE_THRESHOLD && this.health > CONSTANTS.FLEE.HEALTH_COURAGE_THRESHOLD) {
        if (this.state === "flee" && Math.random() < CONSTANTS.FLEE.REVENGE_SHOUT_CHANCE) this.shout(Peep.randomLine(Peep.DIALOGUE.revenge), "tactical");
        return false;
    }

    if (this.profile.type === "berserker") return false;
    if (this.health <= 1) return true;
    if (!this.hasWeapon && threat.target.hasWeapon) return true;
    return this.profile.type === "runner" || (this.profile.type === "wanderer" && Math.random() < 0.4);
  }

  updateAttack(dt, world) {
    this.attackTime += dt;

    const weaponConfig = WEAPON_REGISTRY[this.weapon];
    const isRanged = weaponConfig?.ranged;

    // Non-laser ranged: plant feet during wind-up and firing
    if (isRanged && !this.hasLaserEyes && (this.laserPhase === "charging" || this.laserPhase === "firing")) {
      this.vx *= 0.05;
      this.vy *= 0.05;
    }

    // Super Speed: never slow down while hunting or fleeing
    if (!this.hasSuperSpeed || (this.state !== "flee" && this.state !== "charge")) {
      const damping = Math.pow(CONSTANTS.COMBAT.ATTACK_DAMPING_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
      this.vx *= damping;
      this.vy *= damping;
    }

    if (!this.attackTarget?.alive || !this.canHarm(this.attackTarget, world)) {
      this.setState("charge");
      return;
    }

    // Face the target
    if (this.attackTarget.x !== this.x) {
      this.flip = this.attackTarget.x < this.x ? -1 : 1;
    }

    const dist = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);

    if (isRanged) {
        const r = weaponConfig;
        if (this.laserPhase === "idle" && this.laserCooldown <= 0 && dist <= r.range && this.attackTarget) {
            this.laserPhase = "charging";
            this.laserWindUp = r.windUp ?? CONSTANTS.LASER.WIND_UP;
            this.laserAimX = this.attackTarget.x;
            this.laserAimY = this.attackTarget.y;
            if (this.hasLaserEyes) {
                this.setState("charge");
            }
            return;
        } else if (this.laserPhase === "charging" && this.laserWindUp <= 0) {
            this.laserPhase = "firing";
            this.laserDuration = r.fireDuration ?? CONSTANTS.LASER.FIRE_DURATION;

            if (!this.hasLaserEyes && this.attackTarget?.alive) {
                const aimAngle = Math.atan2(this.laserAimY - (this.y - 20), this.laserAimX - this.x);
                const barrelX = this.x + Math.cos(aimAngle) * 24;
                const barrelY = (this.y - 20) + Math.sin(aimAngle) * 8;

                world.spawnProjectile({
                    x: barrelX,
                    y: barrelY,
                    targetX: this.laserAimX,
                    targetY: this.laserAimY,
                    speed: this.weapon === "shotgun" ? 550 : 700,
                    maxDistance: r.range * 1.5,
                    damage: r.damage,
                    weapon: this.weapon,
                    ownerId: this.id,
                });

                // Shell casing ejection (perpendicular, behind gun)
                const ejectAngle = aimAngle + (this.flip > 0 ? Math.PI / 2 : -Math.PI / 2);
                world.spawnEffect?.("shell", {
                    x: barrelX,
                    y: barrelY,
                    vx: Math.cos(ejectAngle) * (80 + Math.random() * 40) - Math.cos(aimAngle) * 30,
                    vy: Math.sin(ejectAngle) * (60 + Math.random() * 30) - 120,
                    groundY: this.y,
                    gravity: 400,
                    bounce: 0.4,
                    rotation: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * 30,
                    life: 0.6,
                    maxLife: 0.6,
                });

                // Sonic crack line – a long flash from barrel to target
                world.spawnEffect?.("sonic_crack", {
                    x: barrelX,
                    y: barrelY,
                    targetX: this.laserAimX,
                    targetY: this.laserAimY,
                    life: 0.04,
                    maxLife: 0.04,
                });

                // Camera shake
                world.triggerShake?.(this.weapon === "shotgun" ? 3.5 : 2, 0.12);
            } else {
                const dodgeDist = Math.hypot(
                    (this.attackTarget?.x || this.laserAimX) - this.laserAimX,
                    (this.attackTarget?.y || this.laserAimY) - this.laserAimY
                );
                if (dodgeDist < (r.dodgeDistance ?? CONSTANTS.LASER.DODGE_DISTANCE) && this.attackTarget?.alive) {
                    this.attackTarget.takeDamage(r.damage, this);
                    if (this.lifesteal) this.health = Math.min(this.maxHealth, this.health + r.damage * this.lifesteal);
                    this.attackTarget.remember("attacked_me", this, 1);
                }
            }
            return;
        } else if (this.laserPhase === "firing" && this.laserDuration <= 0) {
            this.laserPhase = "cooldown";
            this.laserCooldown = r.cooldown ?? CONSTANTS.LASER.COOLDOWN;
        } else if (this.laserPhase === "cooldown" && this.laserCooldown <= 0) {
            this.laserPhase = "idle";
        }
        if (this.laserPhase !== "idle" && dist > r.range + CONSTANTS.LASER.RANGE_BUFFER) {
            this.setState("charge");
            return;
        }
    }

    if (!this.attackApplied && this.attackTime >= CONSTANTS.COMBAT.ATTACK_APPLY_TIME) {
      if (!isRanged && dist <= this.getAttackRange() + CONSTANTS.COMBAT.ATTACK_RANGE_BUFFER) {
        const damage = this.getDamage();
        this.attackTarget.takeDamage(damage, this);
        if (this.lifesteal) this.health = Math.min(this.maxHealth, this.health + damage * this.lifesteal);
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
      // Super Speed: hit-and-run — zoom away immediately after attacking
      if (this.hasSuperSpeed) {
        this.setState("flee");
      }
    }
    if (!this.hasSuperSpeed && this.attackTime >= CONSTANTS.COMBAT.ATTACK_MAX_TIME) this.setState("charge");
    this.animate(0.5, dt);
  }

  setState(state) {
    if (this.state === state) return;
    // If leaving attack with a non-laser ranged weapon, reset phase so it never strands mid-cycle
    if (this.state === "attack" && !this.hasLaserEyes) {
      const w = WEAPON_REGISTRY[this.weapon];
      if (w?.ranged) {
        this.laserPhase = "idle";
        this.laserWindUp = 0;
        this.laserDuration = 0;
      }
    }
    this.state = state;
    this.stateTime = 0;
  }

  getAttackRange() {
    const weaponConfig = WEAPON_REGISTRY[this.weapon];
    return weaponConfig ? weaponConfig.range : WEAPON_REGISTRY.fists.range;
  }

  getDamage() {
    const isMelee = !this.weapon || this.weapon === "fists" || this.weapon === "bat" || this.weapon === "axe";
    const meleeBonus = isMelee ? Math.max(0, Math.floor((this.stats.strength - CONSTANTS.COMBAT.MELEE_STAT_THRESHOLD) / CONSTANTS.COMBAT.MELEE_STAT_DIVISOR)) : 0;
    const weaponConfig = WEAPON_REGISTRY[this.weapon];
    let damage = (!weaponConfig || this.weapon === "fists") ? WEAPON_REGISTRY.fists.damage + meleeBonus : weaponConfig.damage + meleeBonus;
    if (this.hasMomentum && this.state === "charge") {
      const speedBonus = Math.floor(this.speedMultiplier() * CONSTANTS.COMBAT.MOMENTUM_SPEED_MULT);
      damage += speedBonus;
    }
    return damage;
  }

  pickUpWeapon(groundWeapons) {
    if (this.hasWeapon) return;
    const pickupRange = CONSTANTS.WEAPON_ITEM.PICKUP_RANGE * this.scavengerMultiplier;
    const index = groundWeapons.findIndex((weapon) => Math.hypot(weapon.x - this.x, weapon.y - this.y) <= pickupRange);
    if (index >= 0) {
      const [weapon] = groundWeapons.splice(index, 1);
      this.equipWeapon(weapon.type);
      if (this.shoutTimer <= 0) this.shout(Peep.randomLine(Peep.DIALOGUE.found_weapon, this.weaponLabel(weapon.type)), "loot");
    }
  }

  wander(dt, world) {
    this.wanderTime -= dt;
    if (this.wanderTime <= 0) {
      this.wanderTime = 0.8 + Math.random() * 1.8;
      
      // Tethered Wandering: If in an alliance, bias the angle toward the nearest ally
      let biasAngle = null;
      if (this.allianceId && world) {
        const nearestAlly = world.peeps.find(p => p.alive && p !== this && p.allianceId === this.allianceId);
        if (nearestAlly) {
          biasAngle = Math.atan2(nearestAlly.y - this.y, nearestAlly.x - this.x);
        }
      }

      if (biasAngle !== null && Math.random() < 0.4) {
        // 40% chance to drift toward ally instead of fully random
        this.wanderAngle = biasAngle + (-0.5 + Math.random() * 1.0);
      } else {
        this.wanderAngle += -1.1 + Math.random() * 2.2;
      }
    }
    this.applyVelocity(Math.cos(this.wanderAngle) * CONSTANTS.SPEED.WANDER * this.speedMultiplier(), Math.sin(this.wanderAngle) * CONSTANTS.SPEED.WANDER * this.speedMultiplier(), dt);
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
    const base = CONSTANTS.MOVEMENT.BASE_MULTIPLIER + this.stats.speed * CONSTANTS.MOVEMENT.STAT_COEFFICIENT;
    let mult = this.isFlying ? base * CONSTANTS.MOVEMENT.FLYING_BONUS : base;
    if (this.hasSuperSpeed && CONSTANTS.MOVEMENT.SUPER_SPEED_STATES.includes(this.state)) mult *= CONSTANTS.MOVEMENT.SUPER_SPEED_MULT;
    return mult * this.speedDebuff;
  }

  applyVelocity(vx, vy, dt) {
    const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    this.vx = this.vx * (1 - blend) + vx * blend;
    this.vy = this.vy * (1 - blend) + vy * blend;
    if (Math.abs(this.vx) > CONSTANTS.MOVEMENT.VELOCITY_FLIP_THRESHOLD) this.flip = this.vx < 0 ? -1 : 1;
  }

  animate(speed, dt) {
    this.hop = (this.hop + (speed / 40) * dt * 60) % 1;
  }

  clamp(world) {
    // Clamp position to world bounds with 24px margin
    const min = CONSTANTS.MOVEMENT.WORLD_MARGIN;
    const maxX = world.width - CONSTANTS.MOVEMENT.WORLD_MARGIN;
    const maxY = world.height - CONSTANTS.MOVEMENT.WORLD_MARGIN;
    
    // Zero out velocity pointing into the wall when clamped
    if (this.x <= min && this.vx < 0) this.vx = 0;
    if (this.x >= maxX && this.vx > 0) this.vx = 0;
    if (this.y <= min && this.vy < 0) this.vy = 0;
    if (this.y >= maxY && this.vy > 0) this.vy = 0;
    
    this.x = Math.max(min, Math.min(maxX, this.x));
    this.y = Math.max(min, Math.min(maxY, this.y));
  }

  render(ctx, sprites, spriteCache) {
    if (!this.alive) return;

    // Store trail for motion blur
    this.trailPositions.push({ x: this.x, y: this.y, hop: this.hop, flip: this.flip });
    if (this.trailPositions.length > CONSTANTS.SUPER_SPEED.TRAIL_LENGTH) this.trailPositions.shift();

    const phase = Math.sin(this.hop * Math.PI * 2);
    const bounce = 1 + Math.max(0, -phase) * CONSTANTS.PEEP.VISUAL_BOUNCE;
    const bob = this.isFlying ? CONSTANTS.PEEP.FLY_HEIGHT : Math.abs(phase) * CONSTANTS.PEEP.BOB_HEIGHT;
    const rotation = phase * 0.1;
    const scaleX = CONSTANTS.PEEP.BASE_SCALE * bounce * this.flip * this.visualScale;
    const scaleY = CONSTANTS.PEEP.BASE_SCALE / bounce * this.visualScale;
    
    // Use cached sprite lookups (passed from render()) to avoid per-peep Map.get() overhead
    const bodyAtlas = spriteCache?.body || sprites.get("body");
    const redAtlas = spriteCache?.red || sprites.get("body_red");
    const loveHatAtlas = spriteCache?.loveHat || sprites.get("lovehat");
    const loverShirtAtlas = spriteCache?.loverShirt || sprites.get("lover_shirt");
    
    // Choose face atlas based on state
    let faceAtlas;
    let faceAtlasName;
    if (this.state === "charge" || this.state === "attack") {
      faceAtlas = spriteCache?.faceMurder || sprites.get("face_murder");
      faceAtlasName = "face_murder";
    } else if (this.state === "flee" || this.state === "retreat" || this.state === "panic") {
      faceAtlas = spriteCache?.faceNervous || sprites.get("face_nervous");
      faceAtlasName = "face_nervous";
    } else {
      faceAtlas = spriteCache?.face || sprites.get("face");
      faceAtlasName = "face";
    }
    let faceFrame = Math.random() < CONSTANTS.PEEP.FACE_BLINK_CHANCE ? 2 : this.faceFrame;
    if (this.state === "panic") faceFrame = CONSTANTS.PEEP.PANIC_FACE_FRAME; // Crying face when panicking
    const bodyName = `body${this.bodyFrame}`;

    ctx.save();
    ctx.translate(this.x, this.y - bob);
    
    // Draw body base + red overlay + love assets
    const drewBody = bodyAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    if (this.isRed) redAtlas?.draw(ctx, `body_red${this.bodyFrame}`, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    if (this.loverId) {
        loverShirtAtlas?.draw(ctx, `lover_shirt${this.bodyFrame}`, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
        loveHatAtlas?.draw(ctx, "lovehat0", 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    }
    
    this.renderFace(ctx, faceAtlas, faceAtlasName, faceFrame, scaleX, scaleY, rotation);
    if (!drewBody) this.drawFallback(ctx);
    if (this.weapon) this.renderWeapon(ctx, sprites);
    this.renderHitFlash(ctx);

    // Laser eyes glow red during wind-up
    if (this.hasLaserEyes && this.laserPhase === "charging") {
      const t = performance.now() / 1000;
      const intensity = 0.7 + Math.sin(t * 20) * 0.3;
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = `rgba(255, 0, 0, ${intensity})`;
      ctx.fillStyle = `rgba(255, 60, 60, ${intensity})`;
      ctx.beginPath(); ctx.arc(-6, -31, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -31, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(255, 200, 200, ${intensity * 0.6})`;
      ctx.beginPath(); ctx.arc(-6, -31, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -31, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Ghost after-images when super speed is active (drawn after the peep, before shout)
    if (this.hasSuperSpeed && (this.state === "flee" || this.state === "charge")) {
      for (let i = 0; i < this.trailPositions.length - 1; i++) {
        const t = this.trailPositions[i];
        ctx.save();
        ctx.globalAlpha = ((i + 1) / this.trailPositions.length) * 0.25;
        const ghostPhase = Math.sin(t.hop * Math.PI * 2);
        const ghostBob = Math.abs(ghostPhase) * CONSTANTS.PEEP.BOB_HEIGHT;
        const ghostSX = CONSTANTS.PEEP.BASE_SCALE * (1 + Math.max(0, -ghostPhase) * CONSTANTS.PEEP.VISUAL_BOUNCE) * t.flip * this.visualScale;
        const ghostSY = CONSTANTS.PEEP.BASE_SCALE / (1 + Math.max(0, -ghostPhase) * CONSTANTS.PEEP.VISUAL_BOUNCE) * this.visualScale;
        ctx.translate(t.x, t.y - ghostBob);
        ctx.scale(ghostSX, ghostSY);
        bodyAtlas?.draw(ctx, bodyName, 0, 0, { scaleX: 1, scaleY: 1, rotation: 0, anchorY: 0.72 });
        ctx.restore();
      }
    }

    this.renderShout(ctx);
  }

  renderShout(ctx) {
    if (!this.shoutText || this.shoutTimer <= 0) return;
    const progress = 1 - this.shoutTimer / Math.max(0.01, this.shoutDuration || 2.5);
    const alpha = Math.min(1, this.shoutTimer / 0.25, (1 - progress) / 0.18);
    const y = this.y - CONSTANTS.DIALOGUE.SHOUT_HEIGHT_OFFSET - progress * CONSTANTS.DIALOGUE.SHOUT_RISE; // Slightly higher
    const paddingX = CONSTANTS.DIALOGUE.PADDING_X;
    const h = CONSTANTS.DIALOGUE.BUBBLE_HEIGHT;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = "700 12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = Math.min(CONSTANTS.DIALOGUE.MAX_WIDTH, ctx.measureText(this.shoutText).width + paddingX * 2);
    const color = this.shoutType === "tactical" ? "#ffd866" : this.shoutType === "loot" ? "#7de3ff" : "#ffffff";
    
    ctx.fillStyle = "rgba(10, 10, 14, 0.92)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    const bx = this.x - w / 2;
    const by = y - h / 2;
    const r = CONSTANTS.DIALOGUE.BUBBLE_RADIUS;
    
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + w, by, bx + w, by + h, r);
    ctx.arcTo(bx + w, by + h, bx, by + h, r);
    ctx.lineTo(bx + w * 0.58, by + h);
    ctx.lineTo(bx + w * 0.5, by + h + 8);
    ctx.lineTo(bx + w * 0.42, by + h);
    ctx.arcTo(bx, by + h, bx, by, r);
    ctx.arcTo(bx, by, bx + w, by, r);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.fillText(this.shoutText, this.x, y);
    ctx.restore();
  }

  drawBubble(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(x + w * 0.58, y + h);
    ctx.lineTo(x + w * 0.5, y + h + 6);
    ctx.lineTo(x + w * 0.42, y + h);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  static drawFaceWithOutline(ctx, faceAtlas, faceName, faceFrame, scaleX, scaleY, rotation) {
    const faceY = -12;
    if (faceFrame === 9 || faceFrame === 10 || faceFrame === 11) {
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

  renderFace(ctx, faceAtlas, atlasName, faceFrame, scaleX, scaleY, rotation) {
    const faceName = `${atlasName}${faceFrame}`;
    Peep.drawFaceWithOutline(ctx, faceAtlas, faceName, faceFrame, scaleX, scaleY, rotation);
  }

  hasRedMouthFace(faceFrame) {
    return faceFrame === 9 || faceFrame === 10 || faceFrame === 11;
  }

  renderWeapon(ctx, sprites) {
    const wConf = WEAPON_REGISTRY[this.weapon];
    const isRanged = wConf?.ranged;

    // === RANGED CHARGING CROSSHAIR ===
    if (isRanged && this.laserPhase === "charging") {
        ctx.save();
        const aimX = this.laserAimX - this.x;
        const aimY = this.laserAimY - this.y;
        const t = performance.now() / 1000;
        const pulse = 12 + Math.sin(t * 18) * 6;
        const rotation = t * 4;
        const isLaser = this.hasLaserEyes;
        
        // Outer glow ring
        ctx.shadowBlur = 25;
        ctx.shadowColor = isLaser ? "#ff0000" : "#ffd700";
        ctx.strokeStyle = isLaser ? "rgba(255, 40, 40, 0.6)" : "rgba(255, 215, 0, 0.5)";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(aimX, aimY, pulse + 8, rotation, rotation + Math.PI * 2);
        ctx.stroke();
        
        // Inner solid ring
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(aimX, aimY, pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Crosshair lines
        ctx.strokeStyle = isLaser ? "rgba(255, 60, 60, 0.7)" : "rgba(255, 215, 0, 0.7)";
        ctx.lineWidth = 1;
        const crossSize = pulse + 4;
        ctx.beginPath();
        ctx.moveTo(aimX - crossSize, aimY); ctx.lineTo(aimX - pulse * 0.5, aimY);
        ctx.moveTo(aimX + crossSize, aimY); ctx.lineTo(aimX + pulse * 0.5, aimY);
        ctx.moveTo(aimX, aimY - crossSize); ctx.lineTo(aimX, aimY - pulse * 0.5);
        ctx.moveTo(aimX, aimY + crossSize); ctx.lineTo(aimX, aimY + pulse * 0.5);
        ctx.stroke();
        
        // Center dot
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(aimX, aimY, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    // === RANGED FIRING VISUALS ===
    if (isRanged && this.laserDuration > 0) {
        ctx.save();
        const targetRelX = this.laserAimX - this.x;
        const targetRelY = (this.laserAimY - 20) - this.y;
        
        if (this.hasLaserEyes) {
            const eyeY = -30;
            const eyeXOffset = 5;
            const eyes = [{ x: -eyeXOffset, y: eyeY }, { x: eyeXOffset, y: eyeY }];
            
            // Outer intense glow
            ctx.shadowBlur = 30;
            ctx.shadowColor = "#ff3300";
            ctx.strokeStyle = "rgba(255, 80, 0, 0.5)";
            ctx.lineWidth = 6;
            eyes.forEach(eye => {
                ctx.beginPath();
                ctx.moveTo(eye.x, eye.y);
                ctx.lineTo(targetRelX, targetRelY);
                ctx.stroke();
            });
            
            // Middle glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#ff6600";
            ctx.strokeStyle = "rgba(255, 180, 80, 0.7)";
            ctx.lineWidth = 3;
            eyes.forEach(eye => {
                ctx.beginPath();
                ctx.moveTo(eye.x, eye.y);
                ctx.lineTo(targetRelX, targetRelY);
                ctx.stroke();
            });
            
            // Core white-hot beam
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
            ctx.lineWidth = 1.5;
            eyes.forEach(eye => {
                ctx.beginPath();
                ctx.moveTo(eye.x, eye.y);
                ctx.lineTo(targetRelX, targetRelY);
                ctx.stroke();
            });
        } else {
            // Gun / shotgun — barrel-aligned tracer, muzzle flash, recoil
            const aimAngle = Math.atan2(this.laserAimY - this.y, this.laserAimX - this.x);
            const gunX = this.flip * 24;
            const gunY = -18;
            const barrelTipX = gunX + Math.cos(aimAngle) * 20;
            const barrelTipY = gunY + Math.sin(aimAngle) * 20;

            // Recoil kick — strongest at start of firing
            const fd = WEAPON_REGISTRY[this.weapon]?.fireDuration ?? 0.4;
            const recoilAmount = 5 * (this.laserDuration / fd);
            const recoilX = -Math.cos(aimAngle) * recoilAmount;
            const recoilY = -Math.sin(aimAngle) * recoilAmount;
            const startX = barrelTipX + recoilX;
            const startY = barrelTipY + recoilY;

            // Outer tracer glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#ffd700";
            ctx.strokeStyle = "rgba(255, 215, 0, 0.85)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(targetRelX, targetRelY);
            ctx.stroke();

            // Core white tracer
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(targetRelX, targetRelY);
            ctx.stroke();

            // Muzzle flash at barrel
            ctx.save();
            ctx.translate(startX, startY);
            const flashIntensity = Math.min(1, this.laserDuration * 20);

            // Bright star core
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#fff";
            ctx.fillStyle = `rgba(255, 255, 240, ${flashIntensity})`;
            ctx.beginPath();
            ctx.moveTo(4, 0); ctx.lineTo(1, 1); ctx.lineTo(0, 4); ctx.lineTo(-1, 1);
            ctx.lineTo(-4, 0); ctx.lineTo(-1, -1); ctx.lineTo(0, -4); ctx.lineTo(1, -1);
            ctx.closePath();
            ctx.fill();

            // Orange halo
            ctx.shadowBlur = 12;
            ctx.shadowColor = "#ffaa00";
            ctx.fillStyle = `rgba(255, 180, 40, ${flashIntensity * 0.7})`;
            ctx.beginPath();
            ctx.arc(0, 0, 7 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // Impact flash (shared)
        ctx.shadowBlur = 40;
        ctx.shadowColor = this.hasLaserEyes ? "#ff0000" : "#ffd700";
        ctx.fillStyle = `rgba(255, 255, 200, ${Math.min(1, this.laserDuration * 3)})`;
        ctx.beginPath();
        ctx.arc(targetRelX, targetRelY, 8 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.hasLaserEyes ? `rgba(255, 100, 50, ${Math.min(1, this.laserDuration * 2)})` : `rgba(255, 215, 0, ${Math.min(1, this.laserDuration * 2)})`;
        ctx.beginPath();
        ctx.arc(targetRelX, targetRelY, 14 + Math.random() * 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        return;
    }

    const weaponConfig = WEAPON_REGISTRY[this.weapon];
    // ... rest of existing renderWeapon
    if (!weaponConfig || !weaponConfig.atlas || this.weapon === 'laser_eyes') return;
    
    const atlas = sprites.get(weaponConfig.atlas);
    const isAttacking = this.state === "attack" && this.attackTime < CONSTANTS.COMBAT.ATTACK_WEAPON_FRAME_DURATION;
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
    ctx.globalAlpha = Math.min(CONSTANTS.PEEP.HIT_FLASH_ALPHA_MAX, this.hitFlash * CONSTANTS.PEEP.HIT_FLASH_ALPHA_MULT);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "#ff473f";
    ctx.beginPath();
    ctx.arc(0, CONSTANTS.PEEP.HIT_FLASH_OFFSET_Y, CONSTANTS.PEEP.HIT_FLASH_RADIUS, 0, Math.PI * 2);
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
      shoutText: this.shoutText,
      shoutType: this.shoutType,
      shoutTimer: this.shoutTimer,
      shoutDuration: this.shoutDuration,
      faceFrame: this.faceFrame,
      weapon: this.weapon,
      isRed: this.isRed,
      isFlying: this.isFlying,
      hasLaserEyes: this.hasLaserEyes,
      hasSuperSpeed: this.hasSuperSpeed,
      laserPhase: this.laserPhase,
      laserDuration: this.laserDuration,
      laserWindUp: this.laserWindUp,
      laserAimX: this.laserAimX,
      laserAimY: this.laserAimY,
      visualScale: this.visualScale,
      loverId: this.loverId,
      isLoverDead: this.isLoverDead,
      bodyFrame: this.bodyFrame,
      alive: this.alive,
      attackTargetX: this.attackTarget?.x,
      attackTargetY: this.attackTarget?.y,
    };
  }

  static renderFromSnapshot(ctx, snapshot, sprites, spriteCache, time = 0) {
    // Allow dead peeps to render so their bodies don't vanish in replays
    
    const phase = Math.sin(snapshot.hop * Math.PI * 2);
    const bounce = 1 + Math.max(0, -phase) * 0.08;
    const bob = snapshot.isFlying ? CONSTANTS.PEEP.FLY_HEIGHT : Math.abs(phase) * CONSTANTS.PEEP.BOB_HEIGHT;
    const rotation = phase * 0.1;
    const scale = snapshot.visualScale || 1;
    const scaleX = CONSTANTS.PEEP.BASE_SCALE * bounce * snapshot.flip * scale;
    const scaleY = CONSTANTS.PEEP.BASE_SCALE / bounce * scale;
    const bodyAtlas = spriteCache?.body || sprites.get("body");
    const redAtlas = spriteCache?.red || sprites.get("body_red");
    
    // Dead tribute: render as corpse
    if (!snapshot.alive) {
      const weaponIndex = ["gun", "bat", "shotgun", "axe"].indexOf(snapshot.weapon || null);
      const corpseFrame = Math.max(0, (weaponIndex + 2) * 2 + snapshot.bodyFrame) % 12;
      ctx.save();
      ctx.translate(snapshot.x, snapshot.y - 4);
      sprites.get("gore_bodies")?.draw(ctx, `gore_bodies${corpseFrame}`, 0, 0, { scale: CONSTANTS.EFFECTS.CORPSE.SCALE, rotation: 0 });
      ctx.restore();
      return;
    }
    
    let faceAtlas;
    let faceAtlasName;
    if (snapshot.state === "charge" || snapshot.state === "attack") {
      faceAtlas = spriteCache?.faceMurder || sprites.get("face_murder");
      faceAtlasName = "face_murder";
    } else if (snapshot.state === "flee" || snapshot.state === "retreat" || snapshot.state === "panic") {
      faceAtlas = spriteCache?.faceNervous || sprites.get("face_nervous");
      faceAtlasName = "face_nervous";
    } else {
      faceAtlas = spriteCache?.face || sprites.get("face");
      faceAtlasName = "face";
    }
    let faceFrame = Math.random() < CONSTANTS.PEEP.FACE_BLINK_CHANCE ? 2 : snapshot.faceFrame;
    if (snapshot.state === "panic") faceFrame = CONSTANTS.PEEP.PANIC_FACE_FRAME; // Crying face when panicking
    const faceName = `${faceAtlasName}${faceFrame}`;
    const bodyName = `body${snapshot.bodyFrame}`;

    ctx.save();
    ctx.translate(snapshot.x, snapshot.y - bob);
    
    // Body
    bodyAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    if (snapshot.isRed) redAtlas?.draw(ctx, `body_red${snapshot.bodyFrame}`, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    
    // Romance
    if (snapshot.loverId) {
        const loverShirtAtlas = sprites.get("lover_shirt");
        const loveHatAtlas = sprites.get("lovehat");
        loverShirtAtlas?.draw(ctx, `lover_shirt${snapshot.bodyFrame}`, 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
        loveHatAtlas?.draw(ctx, "lovehat0", 0, 0, { scaleX, scaleY, rotation, anchorY: 0.72 });
    }
    
    // Face
    Peep.drawFaceWithOutline(ctx, faceAtlas, faceName, faceFrame, scaleX, scaleY, rotation);
    
    // Laser eyes glow red during wind-up (replay)
    if (snapshot.hasLaserEyes && snapshot.laserPhase === "charging") {
      const intensity = 0.7 + Math.sin(time * 20) * 0.3;
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = `rgba(255, 0, 0, ${intensity})`;
      ctx.fillStyle = `rgba(255, 60, 60, ${intensity})`;
      ctx.beginPath(); ctx.arc(-6, -31, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -31, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(255, 200, 200, ${intensity * 0.6})`;
      ctx.beginPath(); ctx.arc(-6, -31, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -31, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    
    const wConf = WEAPON_REGISTRY[snapshot.weapon];
    const isRangedSnap = wConf?.ranged;
    const isLaserSnap = snapshot.hasLaserEyes;

    // Ranged Visuals — charging crosshair
    if (isRangedSnap && snapshot.laserPhase === "charging") {
        ctx.save();
        const aimX = snapshot.laserAimX - snapshot.x;
        const aimY = snapshot.laserAimY - snapshot.y;
        const pulse = 12 + Math.sin(time * 18) * 6;
        const rotation = time * 4;
        
        ctx.shadowBlur = 25;
        ctx.shadowColor = isLaserSnap ? "#ff0000" : "#ffd700";
        ctx.strokeStyle = isLaserSnap ? "rgba(255, 40, 40, 0.6)" : "rgba(255, 215, 0, 0.5)";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(aimX, aimY, pulse + 8, rotation, rotation + Math.PI * 2);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(aimX, aimY, pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = isLaserSnap ? "rgba(255, 60, 60, 0.7)" : "rgba(255, 215, 0, 0.7)";
        ctx.lineWidth = 1;
        const crossSize = pulse + 4;
        ctx.beginPath();
        ctx.moveTo(aimX - crossSize, aimY); ctx.lineTo(aimX - pulse * 0.5, aimY);
        ctx.moveTo(aimX + crossSize, aimY); ctx.lineTo(aimX + pulse * 0.5, aimY);
        ctx.moveTo(aimX, aimY - crossSize); ctx.lineTo(aimX, aimY - pulse * 0.5);
        ctx.moveTo(aimX, aimY + crossSize); ctx.lineTo(aimX, aimY + pulse * 0.5);
        ctx.stroke();
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(aimX, aimY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // Ranged Visuals — firing beam / tracer
    if (isRangedSnap && snapshot.laserDuration > 0) {
        ctx.save();
        const targetRelX = snapshot.laserAimX - snapshot.x;
        const targetRelY = (snapshot.laserAimY - 20) - snapshot.y;
        
        if (isLaserSnap) {
            const eyeY = -30;
            const eyeXOffset = 5;
            const eyes = [{ x: -eyeXOffset, y: eyeY }, { x: eyeXOffset, y: eyeY }];
            
            ctx.shadowBlur = 30;
            ctx.shadowColor = "#ff3300";
            ctx.strokeStyle = "rgba(255, 80, 0, 0.5)";
            ctx.lineWidth = 6;
            eyes.forEach(eye => {
                ctx.beginPath();
                ctx.moveTo(eye.x, eye.y);
                ctx.lineTo(targetRelX, targetRelY);
                ctx.stroke();
            });
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#ff6600";
            ctx.strokeStyle = "rgba(255, 180, 80, 0.7)";
            ctx.lineWidth = 3;
            eyes.forEach(eye => {
                ctx.beginPath();
                ctx.moveTo(eye.x, eye.y);
                ctx.lineTo(targetRelX, targetRelY);
                ctx.stroke();
            });
            
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
            ctx.lineWidth = 1.5;
            eyes.forEach(eye => {
                ctx.beginPath();
                ctx.moveTo(eye.x, eye.y);
                ctx.lineTo(targetRelX, targetRelY);
                ctx.stroke();
            });
        } else {
            // Gun / shotgun — barrel-aligned tracer, muzzle flash, recoil (replay)
            const aimAngle = Math.atan2(snapshot.laserAimY - snapshot.y, snapshot.laserAimX - snapshot.x);
            const gunX = snapshot.flip * 24;
            const gunY = -18;
            const barrelTipX = gunX + Math.cos(aimAngle) * 20;
            const barrelTipY = gunY + Math.sin(aimAngle) * 20;

            const fd = WEAPON_REGISTRY[snapshot.weapon]?.fireDuration ?? 0.4;
            const recoilAmount = 5 * (snapshot.laserDuration / fd);
            const recoilX = -Math.cos(aimAngle) * recoilAmount;
            const recoilY = -Math.sin(aimAngle) * recoilAmount;
            const startX = barrelTipX + recoilX;
            const startY = barrelTipY + recoilY;

            ctx.shadowBlur = 10;
            ctx.shadowColor = "#ffd700";
            ctx.strokeStyle = "rgba(255, 215, 0, 0.85)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(targetRelX, targetRelY);
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(targetRelX, targetRelY);
            ctx.stroke();

            // Muzzle flash at barrel
            ctx.save();
            ctx.translate(startX, startY);
            const flashIntensity = Math.min(1, snapshot.laserDuration * 20);
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#fff";
            ctx.fillStyle = `rgba(255, 255, 240, ${flashIntensity})`;
            ctx.beginPath();
            ctx.moveTo(4, 0); ctx.lineTo(1, 1); ctx.lineTo(0, 4); ctx.lineTo(-1, 1);
            ctx.lineTo(-4, 0); ctx.lineTo(-1, -1); ctx.lineTo(0, -4); ctx.lineTo(1, -1);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 12;
            ctx.shadowColor = "#ffaa00";
            ctx.fillStyle = `rgba(255, 180, 40, ${flashIntensity * 0.7})`;
            ctx.beginPath();
            ctx.arc(0, 0, 7 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        ctx.shadowBlur = 40;
        ctx.shadowColor = isLaserSnap ? "#ff0000" : "#ffd700";
        ctx.fillStyle = `rgba(255, 255, 200, ${Math.min(1, snapshot.laserDuration * 3)})`;
        ctx.beginPath();
        ctx.arc(targetRelX, targetRelY, 8 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isLaserSnap ? `rgba(255, 100, 50, ${Math.min(1, snapshot.laserDuration * 2)})` : `rgba(255, 215, 0, ${Math.min(1, snapshot.laserDuration * 2)})`;
        ctx.beginPath();
        ctx.arc(targetRelX, targetRelY, 14 + Math.random() * 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    // Weapon
    if (snapshot.weapon && snapshot.weapon !== "laser_eyes") {
      const wAtlas = sprites.get(`weapons_${snapshot.weapon}`);
      const isAttacking = snapshot.state === "attack" && snapshot.attackTime < CONSTANTS.COMBAT.ATTACK_WEAPON_FRAME_DURATION;
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

    // Shout in Recap
    if (snapshot.shoutText && snapshot.shoutTimer > 0) {
        ctx.save();
        const progress = 1 - snapshot.shoutTimer / Math.max(0.01, snapshot.shoutDuration || 2.5);
        const alpha = Math.min(1, snapshot.shoutTimer / 0.25, (1 - progress) / 0.18);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        
        const y = -104 - progress * 18;
        const paddingX = 10;
        const h = 24;
        ctx.font = "700 12px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const w = Math.min(180, ctx.measureText(snapshot.shoutText).width + paddingX * 2);
        const color = snapshot.shoutType === "tactical" ? "#ffd866" : snapshot.shoutType === "loot" ? "#7de3ff" : "#ffffff";
        
        ctx.fillStyle = "rgba(10, 10, 14, 0.92)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        const bx = -w / 2;
        const by = y - h / 2;
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + w, by, bx + w, by + h, r);
        ctx.arcTo(bx + w, by + h, bx, by + h, r);
        ctx.lineTo(bx + w * 0.58, by + h);
        ctx.lineTo(bx + w * 0.5, by + h + 8);
        ctx.lineTo(bx + w * 0.42, by + h);
        ctx.arcTo(bx, by + h, bx, by, r);
        ctx.arcTo(bx, by, bx + w, by, r);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(snapshot.shoutText, 0, y);
        ctx.restore();
    }
    ctx.restore();
  }

  renderMugshot(sprites) {
    const canvas = document.createElement("canvas");
    canvas.width = CONSTANTS.PEEP.MUGSHOT_WIDTH;
    canvas.height = CONSTANTS.PEEP.MUGSHOT_HEIGHT;
    const ctx = canvas.getContext("2d");
    
    ctx.save();
    ctx.translate(CONSTANTS.PEEP.MUGSHOT_WIDTH / 2, CONSTANTS.PEEP.MUGSHOT_TRANSLATE_Y);
    const scaleX = CONSTANTS.PEEP.MUGSHOT_SCALE;
    const scaleY = CONSTANTS.PEEP.MUGSHOT_SCALE;
    const bodyAtlas = sprites.get("body");
    const redAtlas = sprites.get("body_red");
    const faceAtlas = sprites.get("face");
    const bodyName = `body${this.bodyFrame}`;
    const faceName = `face${this.faceFrame}`;

    bodyAtlas?.draw(ctx, bodyName, 0, 0, { scaleX, scaleY, anchorY: 0.72 });
    if (this.isRed) redAtlas?.draw(ctx, `body_red${this.bodyFrame}`, 0, 0, { scaleX, scaleY, anchorY: 0.72 });
    faceAtlas?.draw(ctx, faceName, 0, -12 * scaleY, { scaleX, scaleY, anchorY: 0.65 });
    
    ctx.restore();
    return canvas.toDataURL();
  }
}

function clampStat(value) {
  return Math.max(1, Math.min(10, Number(value) || 1));
}
