let nextCreatureId = 0;

class Creature {
  constructor(config, x, y) {
    this.id = nextCreatureId++;
    this.name = config.name || `Creature ${this.id + 1}`;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.bodyFrame = Math.random() < 0.5 ? 0 : 1;
    this.isRed = Math.random() < CONSTANTS.CREATURE_VISUAL.RED_CHANCE;
    this.faceFrame = Math.floor(Math.random() * CONSTANTS.CREATURE_VISUAL.FACE_FRAME_COUNT);

    this.alive = true;
    this.health = CONSTANTS.CREATURE.HEALTH_START;
    this.maxHealth = CONSTANTS.CREATURE.HEALTH_MAX;
    this.hunger = CONSTANTS.CREATURE.HUNGER_START;
    this.maxHunger = CONSTANTS.CREATURE.HUNGER_MAX;
    this.thirst = CONSTANTS.CREATURE.THIRST_START;
    this.maxThirst = CONSTANTS.CREATURE.THIRST_MAX;

    this.age = 0;
    this.maxAge = CONSTANTS.CREATURE.MAX_AGE + Math.random() * 20;
    this.generation = config.generation || 0;
    this.parentId = config.parentId || null;

    this.state = "wander";
    this.stateTime = 0;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTime = 0;
    this.hop = Math.random();
    this.flip = Math.random() < 0.5 ? -1 : 1;

    this.reproductionCooldown = 0;
    this.mateTarget = null;
    this.followTarget = null;

    // Allele-based genetics (two alleles per trait)
    this.alleles = Creature.createAlleles(config.genome, config.parentAlleles);
    this.genome = Creature.expressGenome(this.alleles);
    this.diet = config.diet || "herbivore";
    this.speciesId = config.speciesId || Creature._nextSpeciesId++;
    this.speciesName = config.speciesName || Creature._generateSpeciesName(this.genome, this.diet);
    this.visualScale = 0.5 + this.genome.size * 0.3;

    this.nearestBush = null;
    this.nearestWater = null;
    this.huntTarget = null;
    this.attackTimer = 0;

    // Memory v2: spatial memory with confidence
    this.memories = [];
    this.exploreTarget = null;
    this.totalDistanceTraveled = 0;

    // Exposure tracking for custom trait discovery
    this.exposure = {
      injured: 0,
      near_water: 0,
      starving: 0,
      near_same_diet: 0,
      fled: 0,
      low_health: 0,
      far_travel: 0,
    };
    this._lastExposureCheck = 0;
    this._lastDiscoveryCheck = 0;

    // Custom traits (list of trait keys)
    this.customTraits = config.customTraits ? [...config.customTraits] : [];

    // Social learning
    this._followCooldown = 0;

    // Drives system
    this.drives = {};
    for (const key of Object.keys(CONSTANTS.DRIVES.BASELINE)) {
      this.drives[key] = CONSTANTS.DRIVES.BASELINE[key] + (Math.random() - 0.5) * 0.2;
      this.drives[key] = Math.max(0, Math.min(1, this.drives[key]));
    }
    this._lastDriveThreat = false;

    // Language system
    this.urgency = 0;
    this.signalCooldown = 0;
    this.productionVocab = config.productionVocab ? this._mutateVocab(config.productionVocab)
      : this._generateInitialVocab();
    this.episodicMemory = [];
    this.focus = null;
    this._lastSemanticState = null;
    this._lastBroadcastTime = 0;
    this._gameTimeAtBirth = performance.now();
    this._pendingInferences = []; // { time, tokens, signalOrigin } for temporal learning
  }

  // === SPECIATION ===

  static _nextSpeciesId = 1;

  static _generateSpeciesName(genome, diet) {
    const S = CONSTANTS.SPECIATION;
    const sizeIdx = Math.round((genome.size - 0.5) / 1.5 * (S.NAME_SIZE_PARTS.length - 1));
    const speedIdx = Math.round((genome.speed - 0.5) / 2.0 * (S.NAME_SPEED_PARTS.length - 1));
    const strengthIdx = Math.round((genome.strength - 0.5) / 1.5 * (S.NAME_STRENGTH_PARTS.length - 1));
    const eyesightIdx = Math.round((genome.eyesight - 0.5) / 1.5 * (S.NAME_EYESIGHT_PARTS.length - 1));
    const size = S.NAME_SIZE_PARTS[Math.max(0, Math.min(S.NAME_SIZE_PARTS.length - 1, sizeIdx))];
    const speed = S.NAME_SPEED_PARTS[Math.max(0, Math.min(S.NAME_SPEED_PARTS.length - 1, speedIdx))];
    const strength = S.NAME_STRENGTH_PARTS[Math.max(0, Math.min(S.NAME_STRENGTH_PARTS.length - 1, strengthIdx))];
    const eyesight = S.NAME_EYESIGHT_PARTS[Math.max(0, Math.min(S.NAME_EYESIGHT_PARTS.length - 1, eyesightIdx))];
    const dietPart = S.NAME_DIET_PARTS[diet] || "Creature";
    // Pick two dominant traits + diet
    const parts = [strength, speed];
    return `${size} ${parts[0]} ${parts[1]} ${dietPart}`;
  }

  static geneticDistance(a, b) {
    let totalDist = 0;
    const traits = Object.keys(GENOME_REGISTRY);
    for (const name of traits) {
      const al = a.alleles[name] || [0.5, 0.5];
      const bl = b.alleles[name] || [0.5, 0.5];
      const d1 = Math.abs(al[0] - bl[0]) + Math.abs(al[1] - bl[1]);
      const d2 = Math.abs(al[0] - bl[1]) + Math.abs(al[1] - bl[0]);
      totalDist += Math.min(d1, d2) / 2;
    }
    return totalDist / traits.length;
  }

  speciesColor() {
    const S = CONSTANTS.SPECIATION;
    const hue = (this.speciesId * S.COLOR_HUE_STEP) % 360;
    return `hsl(${hue}, ${S.COLOR_SATURATION * 100}%, ${S.COLOR_LIGHTNESS * 100}%)`;
  }

  // === LANGUAGE SYSTEM ===

  _generateInitialVocab() {
    const vocab = [];
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const len = 1 + Math.floor(Math.random() * 2);
      const tokens = [];
      for (let j = 0; j < len; j++) {
        tokens.push(Math.floor(Math.random() * CONSTANTS.LANGUAGE.MAX_TOKEN_VALUE));
      }
      const situation = this._randomSituation();
      vocab.push({ tokens, situation, confidence: 0.3 + Math.random() * 0.3, positive: 1, negative: 0 });
    }
    return vocab;
  }

  _randomSituation() {
    const focusTypes = ["none", "bush", "water", "hound", "creature"];
    const ft = focusTypes[Math.floor(Math.random() * focusTypes.length)];
    const nb = Math.random() < 0.5 ? "0" : "1";
    const ab = Math.random() < 0.5 ? "0" : "1";
    const vb = Math.random() < 0.5 ? "0" : "1";
    const sb = Math.random() < 0.5 ? "0" : "1";
    return `${ft}_${nb}${ab}${vb}${sb}`;
  }

  _situationFromState(state, focusType) {
    const ft = focusType || "none";
    const nb = state[0] > 0.5 ? "1" : "0";
    const ab = state[1] > 0.5 ? "1" : "0";
    const vb = state[2] > 0.5 ? "1" : "0";
    const sb = state[3] > 0.5 ? "1" : "0";
    return `${ft}_${nb}${ab}${vb}${sb}`;
  }

  _mutateVocab(parentVocab) {
    const vocab = [];
    for (const entry of parentVocab) {
      if (Math.random() < CONSTANTS.LANGUAGE.INHERIT_VOCAB_CHANCE) {
        const newEntry = { ...entry, tokens: [...entry.tokens] };
        if (Math.random() < CONSTANTS.LANGUAGE.VOCAB_MUTATE_CHANCE) {
          // Mutate: flip tokens, add, or remove
          for (let i = 0; i < newEntry.tokens.length; i++) {
            if (Math.random() < CONSTANTS.LANGUAGE.VOCAB_MUTATE_TOKEN_FLIP) {
              newEntry.tokens[i] = Math.floor(Math.random() * CONSTANTS.LANGUAGE.MAX_TOKEN_VALUE);
            }
          }
          const action = Math.random();
          if (action < 0.1 && newEntry.tokens.length < CONSTANTS.LANGUAGE.TOKENS_PER_BROADCAST_MAX) {
            newEntry.tokens.push(Math.floor(Math.random() * CONSTANTS.LANGUAGE.MAX_TOKEN_VALUE));
          } else if (action < 0.2 && newEntry.tokens.length > 1) {
            newEntry.tokens.pop();
          }
        }
        vocab.push(newEntry);
      }
    }
    // Chance of a new random entry
    if (Math.random() < 0.15) {
      vocab.push(this._generateEntryForSituation(this._randomSituation()));
    }
    return vocab.slice(0, CONSTANTS.LANGUAGE.MAX_VOCAB);
  }

  _generateEntryForSituation(situation) {
    const len = 1 + Math.floor(Math.random() * 2);
    const tokens = [];
    for (let j = 0; j < len; j++) {
      tokens.push(Math.floor(Math.random() * CONSTANTS.LANGUAGE.MAX_TOKEN_VALUE));
    }
    return { tokens, situation, confidence: 0.3, positive: 1, negative: 0 };
  }

  computeSemanticState() {
    const need = 1 - (this.hunger / this.maxHunger + this.thirst / this.maxThirst) / 2;
    const arousal = Math.max(
      this.drives.fear || 0,
      this.state === "flee" ? 0.8 : 0,
      this.state === "hunt" ? 0.6 : 0,
    );
    const valence = this.drives.happiness || 0.5;
    const social = Math.max(0, Math.min(1, 1 - (this.drives.loneliness || 0.5)));
    return [need, arousal, valence, social];
  }

  computeFocus(world) {
    // Priority: hound (threat) > bush (food if hungry) > water (if thirsty) > creature > none
    const viewRange = this.getEyesight();
    const isHungry = this.hunger < CONSTANTS.CREATURE.HUNGER_MAX * 0.45;
    const isThirsty = this.thirst < CONSTANTS.CREATURE.THIRST_MAX * 0.45;

    // Check for hounds
    for (const h of world.hounds || []) {
      if (!h.alive) continue;
      const d = Math.hypot(h.x - this.x, h.y - this.y);
      if (d < viewRange) return { type: "hound", id: h.id, x: h.x, y: h.y, state: h.state };
    }

    // Check for food bush (if hungry)
    if (isHungry) {
      let best = null, bestDist = viewRange;
      for (const bush of world.bushes) {
        if (bush.food <= 0) continue;
        const d = Math.hypot(bush.x - this.x, bush.y - this.y);
        if (d < bestDist) { bestDist = d; best = bush; }
      }
      if (best) return { type: "bush", id: best.id || 0, x: best.x, y: best.y, food: best.food };
    }

    // Check for water (if thirsty)
    if (isThirsty) {
      let best = null, bestDist = viewRange;
      for (const w of world.water) {
        const d = Math.hypot(w.x - this.x, w.y - this.y);
        if (d < bestDist) { bestDist = d; best = w; }
      }
      if (best) return { type: "water", id: best.id || 0, x: best.x, y: best.y };
    }

    // Nearby creature
    let nearestCreature = null, nearestCDist = viewRange;
    for (const c of world.creatures) {
      if (c === this || !c.alive) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y);
      if (d < nearestCDist) { nearestCDist = d; nearestCreature = c; }
    }
    if (nearestCreature) return { type: "creature", id: nearestCreature.id, x: nearestCreature.x, y: nearestCreature.y, diet: nearestCreature.diet };

    return { type: "none", x: 0, y: 0 };
  }

  computeUrgency(newState) {
    let urgency = 0;
    const oldState = this._lastSemanticState;
    if (oldState) {
      const change = Math.abs(newState[0] - oldState[0]) + Math.abs(newState[1] - oldState[1])
        + Math.abs(newState[2] - oldState[2]) + Math.abs(newState[3] - oldState[3]);
      urgency += change * 2;
    }
    urgency += (this.drives.fear || 0) * 2;
    urgency += (this.drives.curiosity || 0) * 0.5;
    urgency += (this.drives.loneliness || 0) * 0.3;
    const threshold = CONSTANTS.LANGUAGE.URGENCY_THRESHOLD_BASE + (this.getIntel() || 0.5) * CONSTANTS.LANGUAGE.URGENCY_PER_INTEL;
    return { urgency, threshold };
  }

  composeSignal(situation, focus) {
    // Find best-matching vocabulary entry for this situation
    let best = null, bestConf = 0;
    for (const entry of this.productionVocab) {
      if (entry.situation !== situation) continue;
      if (entry.confidence > bestConf) { bestConf = entry.confidence; best = entry; }
    }
    // If no match or low confidence, invent
    if (!best || bestConf < 0.2) {
      const len = CONSTANTS.LANGUAGE.TOKENS_PER_BROADCAST_MIN
        + Math.floor(Math.random() * (CONSTANTS.LANGUAGE.TOKENS_PER_BROADCAST_MAX - CONSTANTS.LANGUAGE.TOKENS_PER_BROADCAST_MIN + 1));
      const tokens = [];
      for (let i = 0; i < len; i++) {
        tokens.push(Math.floor(Math.random() * CONSTANTS.LANGUAGE.MAX_TOKEN_VALUE));
      }
      const newEntry = { tokens, situation, confidence: 0.3, positive: 1, negative: 0 };
      this.productionVocab.push(newEntry);
      if (this.productionVocab.length > CONSTANTS.LANGUAGE.MAX_VOCAB) this.productionVocab.shift();
      return tokens;
    }
    return best.tokens;
  }

  broadcast(world) {
    if (this.signalCooldown > 0) return;
    const state = this._lastSemanticState || this.computeSemanticState();
    const focus = this.computeFocus(world);
    const situation = this._situationFromState(state, focus.type);
    const tokens = this.composeSignal(situation, focus);

    const signal = {
      tokens,
      focus,
      state,
      time: performance.now(),
      origin: { x: this.x, y: this.y },
      creatureId: this.id,
    };

    // Send to nearby creatures
    const range = CONSTANTS.LANGUAGE.SIGNAL_RANGE_BASE + (this.getIntel() || 0.5) * CONSTANTS.LANGUAGE.SIGNAL_RANGE_PER_INTEL;
    for (const other of world.creatures) {
      if (other === this || !other.alive) continue;
      const d = Math.hypot(other.x - this.x, other.y - this.y);
      if (d < range) other.receiveSignal(signal);
    }

    this.urgency = 0;
    this.signalCooldown = CONSTANTS.LANGUAGE.SIGNAL_COOLDOWN;
    this._lastBroadcastTime = performance.now();
  }

  receiveSignal(signal) {
    // Store in episodic memory
    const ownState = this.computeSemanticState();
    this.episodicMemory.push({
      time: performance.now(),
      signal,
      ownStateAtHearing: ownState,
    });
    if (this.episodicMemory.length > CONSTANTS.LANGUAGE.MAX_EPISODIC_MEMORY) {
      this.episodicMemory.shift();
    }

    // Store for temporal inference
    this._pendingInferences.push({
      time: performance.now(),
      tokens: signal.tokens,
      signalOrigin: signal.origin,
      focusType: signal.focus?.type,
    });
    if (this._pendingInferences.length > 50) this._pendingInferences.shift();
  }

  processLanguageInference(eventOutcome, world) {
    // On significant event, look back at recent signals and learn associations
    const now = performance.now();
    const window = CONSTANTS.LANGUAGE.INFERENCE_WINDOW * 1000;
    const recent = this._pendingInferences.filter(p => now - p.time < window);
    if (recent.length === 0) return;

    const situation = this._situationFromState(this.computeSemanticState(), this.focus?.type || "none");

    for (const p of recent) {
      const key = p.tokens.join(",");
      // Update Bayesian confidence
      let found = false;
      for (const entry of this.productionVocab) {
        if (entry.tokens.join(",") === key) {
          if (eventOutcome === "positive") entry.positive++;
          else entry.negative++;
          entry.confidence = entry.positive / (entry.positive + entry.negative + CONSTANTS.LANGUAGE.BAYES_PSEUDOCOUNT);
          entry.situation = situation; // Update situation association
          found = true;
          break;
        }
      }
      if (!found) {
        // New learned association
        this.productionVocab.push({
          tokens: [...p.tokens],
          situation,
          confidence: 0.3,
          positive: eventOutcome === "positive" ? 1 : 0,
          negative: eventOutcome === "positive" ? 0 : 1,
        });
        if (this.productionVocab.length > CONSTANTS.LANGUAGE.MAX_VOCAB) this.productionVocab.shift();
      }
    }

    // Keep high-confidence entries, prune low-confidence
    this.productionVocab = this.productionVocab.filter(e => e.confidence > 0.05 || e.positive + e.negative > 3);
  }

  _evaluateSignals(world) {
    const now = performance.now();
    const recentWindow = CONSTANTS.LANGUAGE.INFERENCE_WINDOW * 1000;
    const isHungry = this.hunger < CONSTANTS.CREATURE.HUNGER_MAX * 0.45;
    const isThirsty = this.thirst < CONSTANTS.CREATURE.THIRST_MAX * 0.45;
    if (!isHungry && !isThirsty) return null;

    let best = null, bestConf = 0;
    for (const ep of this.episodicMemory) {
      if (now - ep.time > recentWindow) continue;
      const sigTokens = ep.signal.tokens.join(",");
      for (const entry of this.productionVocab) {
        if (entry.tokens.join(",") !== sigTokens) continue;
        if (entry.positive > entry.negative && entry.confidence > 0.4 && entry.confidence > bestConf) {
          const d = Math.hypot(ep.signal.origin.x - this.x, ep.signal.origin.y - this.y);
          if (d < 500) { bestConf = entry.confidence; best = ep.signal; }
        }
      }
    }
    if (best) return { x: best.origin.x, y: best.origin.y };
    return null;
  }

  // === REASONING SYSTEM ===

  _getBestMemory() {
    const isHungry = this.hunger < this.maxHunger * 0.45;
    const isThirsty = this.thirst < this.maxThirst * 0.45;
    if (!isHungry && !isThirsty) return null;
    const memBush = isHungry ? this.recall("bush") : null;
    const memWater = isThirsty ? this.recall("water") : null;
    if (!memBush && !memWater) return null;
    if (memWater && (!memBush || memWater.confidence > memBush.confidence)) return memWater;
    return memBush;
  }

  _buildOptions(world, signalTarget) {
    const o = [];
    if (this.threat) o.push(this._optFlee());
    if (this.huntTarget) o.push(this._optHunt());
    if (this.nearestWater) o.push(this._optDrink());
    if (this.nearestBush && this.nearestBush.food > 0 && (this.diet === "herbivore" || this.diet === "omnivore"))
      o.push(this._optEat());
    if (this.followTarget) o.push(this._optFollow());
    const memTarget = this._getBestMemory();
    if (memTarget) o.push(this._optRecall(memTarget));
    if (signalTarget) o.push(this._optSignal(signalTarget));
    if (this.mateTarget && this.reproductionCooldown <= 0 && this.age >= CONSTANTS.CREATURE.MATURITY_AGE && this.hunger > this.maxHunger * 0.5)
      o.push(this._optMate());
    if (this.exploreTarget && Math.hypot(this.exploreTarget.x - this.x, this.exploreTarget.y - this.y) > 60)
      o.push(this._optExplore());
    o.push(this._optExploreNew(world));
    o.push(this._optWander());
    return o;
  }

  _reason(world, dt, signalTarget) {
    const intel = this.genome.intelligence;
    const noiseRange = 0.5 - intel * 0.22;

    let options = this._buildOptions(world, signalTarget);

    for (const opt of options) {
      opt.score += (Math.random() - 0.5) * noiseRange;
    }

    options.sort((a, b) => b.score - a.score);
    return options[0];
  }

  // === SCORING + EXECUTION ===

  _optFlee() {
    const d = Math.hypot(this.threat.x - this.x, this.threat.y - this.y);
    const viewRange = this.getEyesight();
    const proximity = 1 - d / viewRange;
    let score = proximity * this.genome.fearWeight * 2;
    score += this.drives.fear * this.genome.fearWeight * 0.7;
    score += this.diet === "herbivore" ? this.genome.fearWeight * 0.5 : 0;
    const threatStrength = this.threat.genome?.strength || this.threat.damage || 2;
    const relStrength = this.genome.strength / threatStrength;
    const riskMod = Math.max(0, 1.5 - relStrength * 2) * (1 + (1 - this.genome.riskTolerance) * 0.5);
    score += riskMod;
    const speedBonus = CONSTANTS.SPEED.FLEE * this.genome.speed * (1 + this.drives.fear * 0.2);
    return {
      name: "flee", score,
      execute: (dt) => this.moveAwayFrom(this.threat.x, this.threat.y, speedBonus, dt),
    };
  }

  _optHunt() {
    let score = 0;
    const hungerDeficit = 1 - this.hunger / this.maxHunger;
    score += hungerDeficit * this.genome.hungerWeight * 1.2;
    score += this.drives.aggression * this.genome.aggressionBias * 1.2;
    if (this.diet === "carnivore") score += this.genome.aggressionBias * 0.8;
    else if (this.hunger < 20) score += 0.5;
    else score -= this.genome.riskTolerance * 0.5;
    const huntSpeed = CONSTANTS.SPEED.FLEE * this.genome.speed * 0.9 * (1 + this.drives.aggression * 0.15);
    return {
      name: "hunt", score,
      execute: (dt, world) => {
        const dist = Math.hypot(this.huntTarget.x - this.x, this.huntTarget.y - this.y);
        if (dist < CONSTANTS.HUNT.ATTACK_RANGE) this.attack(this.huntTarget, world);
        else this.moveToward(this.huntTarget.x, this.huntTarget.y, huntSpeed, dt);
      },
    };
  }

  _optDrink() {
    const thirstDeficit = 1 - this.thirst / this.maxThirst;
    let score = thirstDeficit * this.genome.thirstWeight * 1.3;
    const d = Math.hypot(this.nearestWater.x - this.x, this.nearestWater.y - this.y);
    score += (1 - d / this.getEyesight()) * 0.5;
    return {
      name: "drink", score,
      execute: (dt) => this.moveToward(this.nearestWater.x, this.nearestWater.y, this.getSpeed(), dt),
    };
  }

  _optEat() {
    const hungerDeficit = 1 - this.hunger / this.maxHunger;
    let score = hungerDeficit * this.genome.hungerWeight * 1.3;
    const d = Math.hypot(this.nearestBush.x - this.x, this.nearestBush.y - this.y);
    score += (1 - d / this.getEyesight()) * 0.5;
    if (this.threat) score -= (1 - this.genome.riskTolerance * 0.7) * 1.5;
    return {
      name: "eat", score,
      execute: (dt) => this.moveToward(this.nearestBush.x, this.nearestBush.y, this.getSpeed(), dt),
    };
  }

  _optFollow() {
    let score = this.genome.socialPull * 0.3;
    score += (1 - this.drives.loneliness) * this.genome.socialPull * 0.3;
    score += this.genome.intelligence * 0.15;
    return {
      name: "follow", score,
      execute: (dt) => {
        this._followCooldown = 5;
        this.moveToward(this.followTarget.x, this.followTarget.y, this.getSpeed() * CONSTANTS.SOCIAL.FOLLOW_SPEED_BONUS, dt);
      },
    };
  }

  _optRecall(memTarget) {
    let score = 0.2;
    score += memTarget.confidence * this.genome.memoryTrust * 1.2;
    score += this.genome.intelligence * 0.2;
    const d = Math.hypot(memTarget.x - this.x, memTarget.y - this.y);
    score += (1 - Math.min(1, d / 500)) * 0.3;
    return {
      name: "recall", score,
      execute: (dt, world) => {
        this.moveToward(memTarget.x, memTarget.y, this.getSpeed(), dt);
        const dist = Math.hypot(memTarget.x - this.x, memTarget.y - this.y);
        if (dist < CONSTANTS.MEMORY.CONFIRM_RANGE) this.confirmMemory(memTarget.type, memTarget.x, memTarget.y, world);
      },
    };
  }

  _optSignal(signalTarget) {
    let score = this.genome.signalTrust * 0.2;
    score += this.genome.intelligence * 0.2;
    const isHungry = this.hunger < this.maxHunger * 0.45;
    const isThirsty = this.thirst < this.maxThirst * 0.45;
    if (!isHungry && !isThirsty) score -= this.genome.signalTrust * 0.3;
    return {
      name: "signal", score,
      execute: (dt) => this.moveToward(signalTarget.x, signalTarget.y, this.getSpeed(), dt),
    };
  }

  _optMate() {
    let score = this.drives.loneliness * this.genome.mateWeight * 1.2;
    score += this.genome.fertility * 0.3;
    return {
      name: "mate", score,
      execute: (dt, world) => {
        const d = Math.hypot(this.mateTarget.x - this.x, this.mateTarget.y - this.y);
        const rangeMult = 1 + this.drives.loneliness * 0.3;
        if (d < CONSTANTS.CREATURE.REPRODUCTION_RANGE * rangeMult) this.reproduce(this.mateTarget, world);
        else this.moveToward(this.mateTarget.x, this.mateTarget.y, CONSTANTS.SPEED.MATE_SEEK * this.genome.speed * (1 + this.drives.loneliness * 0.2), dt);
      },
    };
  }

  _optExplore() {
    let score = this.genome.exploreWeight * 0.3;
    score += this.drives.curiosity * this.genome.exploreWeight * 0.6;
    const hungerDeficit = 1 - this.hunger / this.maxHunger;
    const thirstDeficit = 1 - this.thirst / this.maxThirst;
    if (hungerDeficit < 0.3 && thirstDeficit < 0.3) score += this.genome.exploreWeight * 0.3;
    return {
      name: "explore", score,
      execute: (dt) => this.moveToward(this.exploreTarget.x, this.exploreTarget.y, this.getSpeed() * 0.9, dt),
    };
  }

  _optExploreNew(world) {
    let score = this.genome.exploreWeight * 0.15;
    score += this.drives.curiosity * this.genome.exploreWeight * 0.4;
    return {
      name: "explore_new", score,
      execute: (dt) => {
        this.pickExploreTarget(world);
        this.wander(dt);
      },
    };
  }

  _optWander() {
    return {
      name: "wander", score: 0.05,
      execute: (dt) => this.wander(dt),
    };
  }

  // === GENETICS V2 ===

  static createAlleles(genomeOverrides, parentAlleles) {
    const alleles = {};
    for (const [name, range] of Object.entries(GENOME_REGISTRY)) {
      if (parentAlleles) {
        // Offspring: one allele from each parent
        const a = parentAlleles[0]?.[name] ?? (range.min + Math.random() * (range.max - range.min));
        const b = parentAlleles[1]?.[name] ?? (range.min + Math.random() * (range.max - range.min));
        alleles[name] = [a, b];
      } else if (genomeOverrides?.[name] != null) {
        // Setup slider: both alleles set to override value
        const v = genomeOverrides[name];
        // Add slight natural variation
        const spread = (range.max - range.min) * 0.02;
        alleles[name] = [
          Math.max(range.min, Math.min(range.max, v + (Math.random() - 0.5) * spread)),
          Math.max(range.min, Math.min(range.max, v + (Math.random() - 0.5) * spread)),
        ];
      } else {
        // New creature: random alleles
        const v1 = range.min + Math.random() * (range.max - range.min);
        const v2 = range.min + Math.random() * (range.max - range.min);
        alleles[name] = [v1, v2];
      }
      // Mutate a random allele
      if (Math.random() < CONSTANTS.GENETICS.MUTATION_RATE) {
        const idx = Math.random() < 0.5 ? 0 : 1;
        const delta = (Math.random() - 0.5) * 2 * CONSTANTS.GENETICS.MUTATION_MAGNITUDE * (range.max - range.min);
        alleles[name][idx] = Math.max(range.min, Math.min(range.max, alleles[name][idx] + delta));
      }
    }
    return alleles;
  }

  static expressGenome(alleles) {
    const genome = {};
    for (const [name, [a, b]] of Object.entries(alleles)) {
      const dominant = Math.max(a, b);
      const recessive = Math.min(a, b);
      genome[name] = dominant * CONSTANTS.GENETICS.DOMINANCE_WEIGHT + recessive * (1 - CONSTANTS.GENETICS.DOMINANCE_WEIGHT);
    }
    return genome;
  }

  static inheritAlleles(parentA, parentB) {
    const allelesA = {}, allelesB = {};
    for (const name of Object.keys(GENOME_REGISTRY)) {
      // Pick one random allele from each parent
      allelesA[name] = parentA.alleles[name][Math.random() < 0.5 ? 0 : 1];
      allelesB[name] = parentB.alleles[name][Math.random() < 0.5 ? 0 : 1];
    }
    return [allelesA, allelesB];
  }

  // === INTELLIGENCE V2 ===

  getIntel() {
    return this.genome.intelligence;
  }

  getMaxMemories() {
    return CONSTANTS.MEMORY.BASE_MAX + Math.floor(this.getIntel() * CONSTANTS.MEMORY.MAX_PER_INTEL);
  }

  getMemoryDuration() {
    return CONSTANTS.MEMORY.BASE_DURATION + this.getIntel() * CONSTANTS.MEMORY.DURATION_PER_INTEL;
  }

  getMemoryFuzz() {
    return Math.max(20, CONSTANTS.MEMORY.FUZZ_BASE + this.getIntel() * CONSTANTS.MEMORY.FUZZ_PER_INTEL);
  }

  remember(type, x, y, confidence = 1) {
    const now = performance.now();
    this.memories = this.memories.filter(m => now - m.createdAt < this.getMemoryDuration() * 1000);
    if (this.memories.length >= this.getMaxMemories()) this.memories.shift();
    const fuzzX = x + (Math.random() - 0.5) * this.getMemoryFuzz();
    const fuzzY = y + (Math.random() - 0.5) * this.getMemoryFuzz();
    this.memories.push({ type, x: fuzzX, y: fuzzY, confidence, createdAt: now });
  }

  recall(type) {
    const now = performance.now();
    let best = null, bestScore = -Infinity;
    for (const m of this.memories) {
      if (m.type !== type) continue;
      const age = (now - m.createdAt) / 1000;
      const score = m.confidence - age * CONSTANTS.MEMORY.CONFIDENCE_DECAY;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  pickExploreTarget(world) {
    const range = CONSTANTS.EXPLORATION.EXPLORE_RANGE * (0.5 + this.getIntel() * 0.5);
    const angle = Math.random() * Math.PI * 2;
    this.exploreTarget = {
      x: this.x + Math.cos(angle) * range * (0.5 + Math.random() * 0.5),
      y: this.y + Math.sin(angle) * range * (0.5 + Math.random() * 0.5),
    };
  }

  findFollowTarget(world) {
    if (this._followCooldown > 0) return null;
    if (this.getIntel() < 0.8) return null;
    if (Math.random() > CONSTANTS.SOCIAL.FOLLOW_CHANCE * this.getIntel()) return null;

    // Only follow if we're seeking resources
    const isHungry = this.hunger < CONSTANTS.CREATURE.HUNGER_MAX * 0.45;
    const isThirsty = this.thirst < CONSTANTS.CREATURE.THIRST_MAX * 0.45;
    if (!isHungry && !isThirsty) return null;

    for (const other of world.creatures) {
      if (other === this || !other.alive) continue;
      if (other.diet !== this.diet) continue;
      const d = Math.hypot(other.x - this.x, other.y - this.y);
      if (d > CONSTANTS.SOCIAL.FOLLOW_RANGE) continue;
      if (other.state === "wander" && !other.nearestBush && !other.nearestWater) continue;
      const headingToResource = (isHungry && other.nearestBush) || (isThirsty && other.nearestWater);
      if (headingToResource) return other;
    }
    return null;
  }

  // === CUSTOM TRAITS ===

  checkTraitDiscovery(dt) {
    this._lastDiscoveryCheck += dt;
    if (this._lastDiscoveryCheck < CONSTANTS.TRAIT_DISCOVERY.CHECK_INTERVAL) return;
    this._lastDiscoveryCheck = 0;

    if (this.customTraits.length >= CONSTANTS.TRAIT_DISCOVERY.MAX_TRAITS) return;

    const knownKeys = new Set(this.customTraits);
    for (const [key, traitDef] of Object.entries(CONSTANTS.CUSTOM_TRAIT_LIBRARY)) {
      if (knownKeys.has(key)) continue;
      const disc = traitDef.discover;
      const exp = this.exposure[disc.exposure];
      if (exp == null) continue;

      let qualifies = false;
      if (disc.minTimes != null) qualifies = exp >= disc.minTimes;
      else if (disc.minDuration != null) qualifies = exp >= disc.minDuration;
      else if (disc.minCount != null && disc.duration != null) qualifies = exp >= disc.duration;
      else if (disc.minDistance != null) qualifies = exp >= disc.minDistance;

      if (qualifies && Math.random() < disc.chance) {
        this.customTraits.push(key);
        // Apply trait effect to expressed genome
        for (const [stat, delta] of Object.entries(traitDef.effect)) {
          const range = GENOME_REGISTRY[stat];
          if (range) {
            this.genome[stat] = Math.max(range.min, Math.min(range.max, this.genome[stat] + delta));
          }
        }
        return;
      }
    }
  }

  // === DRIVES ===

  updateDrives(dt, world) {
    const decay = CONSTANTS.DRIVES.DECAY_RATE;
    const BL = CONSTANTS.DRIVES.BASELINE;
    const boosts = CONSTANTS.DRIVES.BOOSTS;

    for (const key of Object.keys(this.drives)) {
      this.drives[key] += (BL[key] - this.drives[key]) * decay * dt;
    }

    // Curiosity: exploring and creating new memories
    if (this.exploreTarget) {
      this.drives.curiosity += boosts.curiosity.explore * dt;
    }

    // Happiness: hunger/thirst/health state
    if (this.hunger > this.maxHunger * 0.8) this.drives.happiness += boosts.happiness.eat * dt;
    if (this.hunger < this.maxHunger * 0.2) this.drives.happiness += boosts.happiness.starve * dt;
    if (this.thirst < this.maxThirst * 0.2) this.drives.happiness += boosts.happiness.starve * dt * 0.5;

    // Fear: threats
    const hadThreat = this._lastDriveThreat;
    if (hadThreat) this.drives.fear += boosts.fear.threat_seen * dt;
    else this.drives.fear += boosts.fear.safe_period * dt;

    // Loneliness: nearby allies
    let nearAlly = false;
    for (const other of world.creatures) {
      if (other === this || !other.alive) continue;
      if (Math.hypot(other.x - this.x, other.y - this.y) < 150) {
        if (other.diet === this.diet) nearAlly = true;
        break;
      }
    }
    if (nearAlly) this.drives.loneliness += boosts.loneliness.near_ally * dt;
    else this.drives.loneliness += boosts.loneliness.isolated * dt;

    // Aggression: attacks
    if (this.attackTimer > 0 || this.state === "hunt") {
      this.drives.aggression += boosts.aggression.hunt_success * dt;
    }

    // Clamp all drives
    for (const key of Object.keys(this.drives)) {
      this.drives[key] = Math.max(0, Math.min(1, this.drives[key]));
    }
  }

  getDriveEffect(drive) {
    const v = this.drives[drive] || 0;
    const eff = CONSTANTS.DRIVES.EFFECTS[drive];
    return eff || {};
  }

  // === OUTCOME-BASED LEARNING ===

  confirmMemory(type, x, y, world) {
    const range = CONSTANTS.MEMORY.CONFIRM_RANGE;
    const boost = CONSTANTS.MEMORY.OUTCOME_CONFIRM_BOOST;
    const depletedPen = CONSTANTS.MEMORY.OUTCOME_DEPLETED_PENALTY;
    const missingPen = CONSTANTS.MEMORY.OUTCOME_MISSING_PENALTY;

    if (type === "bush") {
      const bush = world.bushes.find(b => Math.hypot(b.x - x, b.y - y) < range);
      if (bush) {
        if (bush.food > 0) this.adjustMemory("bush", x, y, boost);
        else this.adjustMemory("bush", x, y, depletedPen);
      } else {
        this.adjustMemory("bush", x, y, missingPen);
      }
    } else if (type === "water") {
      const water = world.water.find(w => Math.hypot(w.x - x, w.y - y) < range);
      if (water) this.adjustMemory("water", x, y, boost);
      else this.adjustMemory("water", x, y, missingPen);
    } else if (type === "threat") {
      // Confirming a threat: if a creature is still there, boost; if not, big penalty
      const stillThreat = world.creatures.some(c =>
        c !== this && c.alive && c.genome.strength > this.genome.strength * 1.3 &&
        Math.hypot(c.x - x, c.y - y) < range
      );
      if (stillThreat) this.adjustMemory("threat", x, y, boost);
      else this.adjustMemory("threat", x, y, missingPen);
    }
  }

  adjustMemory(type, x, y, delta) {
    let best = null, bestDist = Infinity;
    for (const m of this.memories) {
      if (m.type !== type) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bestDist) { bestDist = d; best = m; }
    }
    if (best) {
      best.confidence = Math.max(0, Math.min(1, best.confidence + delta));
    }
  }

  // === BEHAVIOR ===

  getSpeed() {
    return CONSTANTS.SPEED.WANDER * this.genome.speed;
  }

  getEyesight() {
    return 120 + this.genome.eyesight * 80;
  }

  getHungerDrainMultiplier() {
    let mult = 1;
    mult += (this.genome.size - 1) * 0.6;
    mult += (this.genome.strength - 1) * 0.3;
    mult += (this.genome.eyesight - 1) * 0.2;
    mult += (this.getIntel() - 1) * 0.25;
    mult += (this.genome.metabolism - 1) * 0.5;
    return Math.max(0.3, mult);
  }

  getThirstDrainMultiplier() {
    let mult = 1;
    mult += (this.genome.size - 1) * 0.5;
    mult += (this.genome.speed - 1) * 0.2;
    return Math.max(0.3, mult);
  }

  update(dt, world) {
    if (!this.alive) return;

    this.age += dt;
    this.stateTime += dt;
    this.reproductionCooldown = Math.max(0, this.reproductionCooldown - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this._followCooldown = Math.max(0, this._followCooldown - dt);
    this.hop += dt * (1 + this.genome.speed * 0.5);

    // Track distance for explorer trait
    this.totalDistanceTraveled += Math.hypot(this.vx, this.vy) * dt * 60;
    this.exposure.far_travel = this.totalDistanceTraveled;

    // Resource drain
    const moveSpeed = Math.hypot(this.vx, this.vy);
    let drainCategory = moveSpeed > 0.5 ? "WANDER" : "IDLE";
    if (this.state === "flee") drainCategory = "FLEE";

    const hungerDrain = CONSTANTS.RESOURCE_DRAIN[`HUNGER_${drainCategory}`] * this.getHungerDrainMultiplier();
    const thirstDrain = CONSTANTS.RESOURCE_DRAIN[`THIRST_${drainCategory}`] * this.getThirstDrainMultiplier();

    this.hunger -= hungerDrain * dt;
    this.thirst -= thirstDrain * dt;

    // Exposure tracking
    this.exposure.starving = this.hunger < 10 ? this.exposure.starving + dt : 0;

    // Death conditions
    if (this.hunger <= 0 || this.thirst <= 0 || this.health <= 0) {
      this.alive = false;
      return;
    }

    // Aging damage
    if (this.age > this.maxAge) {
      this.health -= 0.1 * dt;
    }

    const viewRange = this.getEyesight();
    const isCarnivore = this.diet === "carnivore";
    const isOmnivore = this.diet === "omnivore";
    const isHerbivore = this.diet === "herbivore";
    const isHungry = this.hunger < CONSTANTS.CREATURE.HUNGER_MAX * 0.45;
    const isThirsty = this.thirst < CONSTANTS.CREATURE.THIRST_MAX * 0.45;
    const isStarving = this.hunger < CONSTANTS.CREATURE.HUNGER_MAX * 0.2;

    // === PERCEPTION ===

    this.nearestBush = null;
    let nearestBushDist = viewRange;
    for (const bush of world.bushes) {
      if (bush.food <= 0) continue;
      const d = Math.hypot(bush.x - this.x, bush.y - this.y);
      if (d < nearestBushDist) { nearestBushDist = d; this.nearestBush = bush; }
    }

    this.nearestWater = null;
    let nearestWaterDist = viewRange;
    for (const w of world.water) {
      const d = Math.hypot(w.x - this.x, w.y - this.y);
      if (d < nearestWaterDist) { nearestWaterDist = d; this.nearestWater = w; }
    }

    // Update exposure: near_water
    if (this.nearestWater && nearestWaterDist < CONSTANTS.WATER.PICKUP_RANGE * 2) {
      this.exposure.near_water += dt;
    } else {
      this.exposure.near_water = Math.max(0, this.exposure.near_water - dt);
    }

    // Update exposure: near_same_diet
    let nearbySameDiet = 0;
    for (const other of world.creatures) {
      if (other === this || !other.alive) continue;
      if (other.diet !== this.diet) continue;
      if (Math.hypot(other.x - this.x, other.y - this.y) < 120) nearbySameDiet++;
    }
    if (nearbySameDiet >= 2) {
      this.exposure.near_same_diet += dt;
    } else {
      this.exposure.near_same_diet = Math.max(0, this.exposure.near_same_diet - dt * 0.5);
    }

    // Remember resources
    if (this.nearestBush) this.remember("bush", this.nearestBush.x, this.nearestBush.y);
    if (this.nearestWater) this.remember("water", this.nearestWater.x, this.nearestWater.y);

    // Threat detection (creatures + hounds)
    const fleeThreshold = viewRange * 0.35;
    let threat = null, threatDist = Infinity;
    if (isHerbivore || (isOmnivore && !isStarving)) {
      for (const other of world.creatures) {
        if (other === this || !other.alive) continue;
        if (other.genome.strength > this.genome.strength * 1.3 && other.hunger > this.hunger * 1.2) {
          const d = Math.hypot(other.x - this.x, other.y - this.y);
          if (d < fleeThreshold * (1 + this.genome.eyesight * 0.15) && d < threatDist) {
            threatDist = d; threat = other;
          }
        }
      }
      // Hounds as threats
      for (const h of world.hounds || []) {
        if (!h.alive) continue;
        const d = Math.hypot(h.x - this.x, h.y - this.y);
        if (d < fleeThreshold * 1.5 && d < threatDist) {
          threatDist = d; threat = h;
        }
      }
    }
    this._lastDriveThreat = !!threat;
    if (threat) {
      this.remember("threat", threat.x, threat.y);
      this.exposure.fled += dt;
    }

    // === HUNTING ===
    this.huntTarget = null;
    if (isCarnivore || (isOmnivore && isStarving)) {
      if (isHungry || isStarving) {
        let bestPrey = null, bestPreyDist = viewRange * 0.8;
        for (const other of world.creatures) {
          if (other === this || !other.alive) continue;
          if (other.genome.strength >= this.genome.strength * 1.1) continue;
          const d = Math.hypot(other.x - this.x, other.y - this.y);
          if (d < bestPreyDist) { bestPreyDist = d; bestPrey = other; }
        }
        if (bestPrey) this.huntTarget = bestPrey;
      }
    }

    // === MATE SEEKING ===
    this.mateTarget = null;
    if (this.reproductionCooldown <= 0 && this.hunger > CONSTANTS.CREATURE.HUNGER_MAX * 0.6 && this.age > CONSTANTS.CREATURE.MATURITY_AGE) {
      let mateDist = CONSTANTS.CREATURE.REPRODUCTION_RANGE * 3;
      for (const other of world.creatures) {
        if (other === this || !other.alive) continue;
        if (other.reproductionCooldown > 0) continue;
        if (other.age < CONSTANTS.CREATURE.MATURITY_AGE) continue;
        if (other.hunger < CONSTANTS.CREATURE.HUNGER_MAX * 0.5) continue;
        const d = Math.hypot(other.x - this.x, other.y - this.y);
        if (d < mateDist) { mateDist = d; this.mateTarget = other; }
      }
    }

    // === SOCIAL LEARNING ===
    this.followTarget = null;
    if (!threat && !this.huntTarget) {
      this.followTarget = this.findFollowTarget(world);
    }

    // === TRAIT DISCOVERY ===
    this.checkTraitDiscovery(dt);

    // === DRIVES UPDATE ===
    this.updateDrives(dt, world);

    // === LANGUAGE SYSTEM ===
    this.signalCooldown = Math.max(0, this.signalCooldown - dt);
    // Compute semantic state
    const semanticState = this.computeSemanticState();
    this._lastSemanticState = semanticState;
    // Compute focus
    this.focus = this.computeFocus(world);
    // Check urgency and broadcast
    const { urgency, threshold } = this.computeUrgency(semanticState);
    this.urgency += urgency * dt;
    if (this.urgency > threshold) {
      this.broadcast(world);
    }
    // React to received signals
    const signalTarget = this._evaluateSignals(world);

    // === REASONING (utility-based decision making) ===
    const decision = this._reason(world, dt, signalTarget);
    this.state = decision.name;
    decision.execute(dt, world);

    // === EAT FROM BUSH ===
    if (this.nearestBush && (isHerbivore || isOmnivore)) {
      const d = Math.hypot(this.nearestBush.x - this.x, this.nearestBush.y - this.y);
      if (d < CONSTANTS.BUSH.PICKUP_RANGE && this.nearestBush.food > 0) {
        this.hunger = Math.min(this.maxHunger, this.hunger + CONSTANTS.FOOD.HUNGER_VALUE);
        this.nearestBush.food -= 1;
        // Outcome-based learning: confirm bush memory
        this.confirmMemory("bush", this.nearestBush.x, this.nearestBush.y, world);
        // Language: positive outcome — food found
        this.processLanguageInference("positive", world);
      }
    }

    // === DRINK WATER ===
    if (this.nearestWater) {
      const d = Math.hypot(this.nearestWater.x - this.x, this.nearestWater.y - this.y);
      if (d < CONSTANTS.WATER.PICKUP_RANGE) {
        this.thirst = Math.min(this.maxThirst, this.thirst + CONSTANTS.WATER.THIRST_RESTORE * dt * 3);
        // Outcome-based learning: confirm water memory
        this.confirmMemory("water", this.nearestWater.x, this.nearestWater.y, world);
        // Language: positive outcome — water found
        this.processLanguageInference("positive", world);
      }
    }

    // Movement integration
    const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vx *= (1 - blend);
    this.vy *= (1 - blend);
    if (Math.abs(this.vx) > CONSTANTS.MOVEMENT.VELOCITY_FLIP_THRESHOLD) this.flip = this.vx < 0 ? -1 : 1;
    this.clamp(world);

    // Health tracking for resilient trait
    if (this.health < this.maxHealth * 0.4) this.exposure.low_health += dt;
  }

  attack(target, world) {
    if (this.attackTimer > 0) return;
    if (!target.alive) { this.huntTarget = null; return; }

    this.attackTimer = 0.5;
    const damage = CONSTANTS.HUNT.DAMAGE * (this.genome.strength / target.genome.strength);
    target.health -= damage;
    target.exposure.injured += 1;

    if (target.health <= 0) {
      target.alive = false;
      this.huntTarget = null;
      this.hunger = Math.min(this.maxHunger, this.hunger + target.genome.size * CONSTANTS.HUNT.HUNGER_RESTORE_MULT);
    }
  }

  wander(dt) {
    this.wanderTime -= dt;
    if (this.wanderTime <= 0) {
      this.wanderAngle += (Math.random() - 0.5) * (1.5 - this.getIntel() * 0.3);
      this.wanderTime = 1 + Math.random() * (3 - this.getIntel() * 0.5);
    }
    const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    const targetVx = Math.cos(this.wanderAngle) * this.getSpeed();
    const targetVy = Math.sin(this.wanderAngle) * this.getSpeed();
    this.vx = this.vx * (1 - blend) + targetVx * blend;
    this.vy = this.vy * (1 - blend) + targetVy * blend;
  }

  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    this.vx = this.vx * (1 - blend) + (dx / d) * speed * blend;
    this.vy = this.vy * (1 - blend) + (dy / d) * speed * blend;
  }

  moveAwayFrom(tx, ty, speed, dt) {
    const dx = this.x - tx, dy = this.y - ty, d = Math.hypot(dx, dy) || 1;
    const blend = 1 - Math.pow(CONSTANTS.MOVEMENT.VELOCITY_BLEND_BASE, dt * CONSTANTS.MOVEMENT.PHYSICS_TICK_RATE);
    this.vx = this.vx * (1 - blend) + (dx / d) * speed * blend;
    this.vy = this.vy * (1 - blend) + (dy / d) * speed * blend;
  }

  reproduce(mate, world) {
    if (this.reproductionCooldown > 0 || mate.reproductionCooldown > 0) return;
    if (this.hunger < CONSTANTS.CREATURE.REPRODUCTION_HUNGER_COST) return;
    if (mate.hunger < CONSTANTS.CREATURE.REPRODUCTION_HUNGER_COST) return;

    // Speciation gate: genetic distance must be below threshold
    const dist = Creature.geneticDistance(this, mate);
    if (dist > CONSTANTS.SPECIATION.COMPATIBILITY_THRESHOLD) return;

    const cost = CONSTANTS.CREATURE.REPRODUCTION_HUNGER_COST * (1 + (this.genome.fertility - 1) * 0.4);
    this.hunger -= cost;
    mate.hunger -= cost * 0.5;
    this.reproductionCooldown = CONSTANTS.CREATURE.REPRODUCTION_COOLDOWN;
    mate.reproductionCooldown = CONSTANTS.CREATURE.REPRODUCTION_COOLDOWN;

    // Inherit alleles
    const [allelesA, allelesB] = Creature.inheritAlleles(this, mate);

    // Inherit custom traits
    const childTraits = [];
    const allParentTraits = new Set([...this.customTraits, ...mate.customTraits]);
    for (const key of allParentTraits) {
      if (Math.random() < CONSTANTS.TRAIT_DISCOVERY.INHERIT_CHANCE) {
        childTraits.push(key);
      } else if (Math.random() < CONSTANTS.TRAIT_DISCOVERY.MUTATE_TRAIT_CHANCE) {
        // Trait mutation: gain a random new trait
        const allKeys = Object.keys(CONSTANTS.CUSTOM_TRAIT_LIBRARY);
        const newKey = allKeys[Math.floor(Math.random() * allKeys.length)];
        if (!childTraits.includes(newKey)) childTraits.push(newKey);
      }
    }

    // Inherit language vocab (mutated combined vocab from both parents)
    const childVocab = this._mutateVocab([...this.productionVocab, ...mate.productionVocab]);

    // Diet: 85% chance same as parent, 15% random
    const childDiet = Math.random() < 0.85 ? this.diet : ["herbivore", "carnivore", "omnivore"][Math.floor(Math.random() * 3)];

    const childConfig = {
      name: `Gen${this.generation + 1}-${nextCreatureId}`,
      parentAlleles: [allelesA, allelesB],
      diet: childDiet,
      generation: this.generation + 1,
      parentId: this.id,
      customTraits: childTraits,
      productionVocab: childVocab,
    };

    // Speciation: determine species ID and name
    const sameSpecies = this.speciesId === mate.speciesId;
    const split = sameSpecies && Math.random() < CONSTANTS.SPECIATION.HYBRID_SPLIT_CHANCE;
    const hybrid = !sameSpecies;
    if (split || hybrid) {
      childConfig.speciesId = Creature._nextSpeciesId++;
      // Name auto-generated by constructor from expressed genome
      if (hybrid) {
        childConfig.name = `Hybrid ${this.speciesName} × ${mate.speciesName} #${nextCreatureId}`;
      }
      // Log speciation event
      if (typeof world.logSpeciation === "function") {
        world.logSpeciation({
          type: hybrid ? "hybrid" : "split",
          parentSpeciesA: this.speciesName,
          parentSpeciesB: mate.speciesName,
          childSpeciesId: childConfig.speciesId,
          generation: this.generation + 1,
        });
      }
    } else {
      childConfig.speciesId = this.speciesId;
      childConfig.speciesName = this.speciesName;
    }

    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = (Math.random() - 0.5) * 40;
    world.spawnCreature(childConfig, this.x + offsetX, this.y + offsetY);
    world.logBirth(this, mate);
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
      id: this.id, name: this.name, x: this.x, y: this.y,
      vx: this.vx, vy: this.vy, alive: this.alive,
      health: this.health, maxHealth: this.maxHealth,
      hunger: this.hunger, maxHunger: this.maxHunger,
      thirst: this.thirst, maxThirst: this.maxThirst,
      age: this.age, generation: this.generation,
      bodyFrame: this.bodyFrame, faceFrame: this.faceFrame,
      hop: this.hop, flip: this.flip,
      visualScale: this.visualScale,
      genome: { ...this.genome },
      state: this.state, diet: this.diet,
      speciesId: this.speciesId,
      speciesName: this.speciesName,
      customTraits: [...this.customTraits],
      vocabSize: this.productionVocab?.length || 0,
      topVocab: (this.productionVocab || []).slice(0, 3).map(e => ({
        tokens: [...e.tokens], situation: e.situation, confidence: e.confidence,
      })),
      episodicMemorySize: this.episodicMemory?.length || 0,
      urgency: this.urgency,
    };
  }

  render(ctx, sprites, spriteCache) {
    if (!this.alive) return;
    const bobPhase = Math.sin(this.hop * Math.PI * 2);
    const bob = Math.abs(bobPhase) * CONSTANTS.CREATURE_VISUAL.BOB_HEIGHT;
    const sx = CONSTANTS.CREATURE_VISUAL.BASE_SCALE * (1 + Math.max(0, -bobPhase) * CONSTANTS.CREATURE_VISUAL.VISUAL_BOUNCE) * this.flip * this.visualScale;
    const sy = CONSTANTS.CREATURE_VISUAL.BASE_SCALE / (1 + Math.max(0, -bobPhase) * CONSTANTS.CREATURE_VISUAL.VISUAL_BOUNCE) * this.visualScale;
    ctx.save();
    ctx.translate(this.x, this.y - bob);

    // Species color aura
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = this.speciesColor();
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.scale(sx, sy);
    const body = this.isRed ? spriteCache.red : spriteCache.body;
    body?.draw(ctx, `body${this.bodyFrame}`, 0, 0, { scaleX: 1, scaleY: 1, rotation: 0, anchorY: CONSTANTS.CREATURE_VISUAL.BODY_ANCHOR_Y });
    ctx.save();
    ctx.translate(0, CONSTANTS.CREATURE_VISUAL.FACE_OFFSET_Y);
    spriteCache.face?.draw(ctx, `face${this.faceFrame}`, 0, 0, { anchorY: CONSTANTS.CREATURE_VISUAL.FACE_ANCHOR_Y });
    ctx.restore();
    ctx.restore();
  }

  renderMugshot(sprites) {
    const c = document.createElement("canvas");
    c.width = CONSTANTS.CREATURE_VISUAL.MUGSHOT_WIDTH;
    c.height = CONSTANTS.CREATURE_VISUAL.MUGSHOT_HEIGHT;
    const cx = c.getContext("2d");
    const body = this.isRed ? sprites.get("body_red") : sprites.get("body");
    const face = sprites.get("face");
    cx.save();
    cx.translate(CONSTANTS.CREATURE_VISUAL.MUGSHOT_WIDTH / 2, CONSTANTS.CREATURE_VISUAL.MUGSHOT_TRANSLATE_Y);
    cx.scale(CONSTANTS.CREATURE_VISUAL.MUGSHOT_SCALE, CONSTANTS.CREATURE_VISUAL.MUGSHOT_SCALE);
    body?.draw(cx, `body${this.bodyFrame}`, 0, 0, { scaleX: 1, scaleY: 1, anchorY: CONSTANTS.CREATURE_VISUAL.BODY_ANCHOR_Y });
    cx.translate(0, CONSTANTS.CREATURE_VISUAL.FACE_OFFSET_Y);
    face?.draw(cx, `face${this.faceFrame}`, 0, 0, { anchorY: CONSTANTS.CREATURE_VISUAL.FACE_ANCHOR_Y });
    cx.restore();
    return c.toDataURL();
  }
}
