const DEBUG = false;

const GAME_CONSTANTS = {
  worldDimensions: { width: 3000, height: 1800 },
  universeDimensions: { width: 7500, height: 4500 },
  spawnRadius: 460,
};

const GENOME_REGISTRY = {
  size: { min: 0.5, max: 2.0, category: "physical" },
  speed: { min: 0.5, max: 2.5, category: "physical" },
  metabolism: { min: 0.3, max: 2.0, category: "physical" },
  fertility: { min: 0.2, max: 1.5, category: "physical" },
  eyesight: { min: 0.5, max: 2.0, category: "physical" },
  strength: { min: 0.5, max: 2.0, category: "physical" },
  intelligence: { min: 0.3, max: 2.0, category: "physical" },
  hungerWeight: { min: 0.2, max: 3.0, category: "personality" },
  thirstWeight: { min: 0.2, max: 3.0, category: "personality" },
  fearWeight: { min: 0.0, max: 3.0, category: "personality" },
  mateWeight: { min: 0.0, max: 3.0, category: "personality" },
  exploreWeight: { min: 0.0, max: 3.0, category: "personality" },
  memoryTrust: { min: 0.0, max: 2.0, category: "personality" },
  signalTrust: { min: 0.0, max: 2.0, category: "personality" },
  riskTolerance: { min: 0.0, max: 2.0, category: "personality" },
  socialPull: { min: 0.0, max: 2.0, category: "personality" },
  aggressionBias: { min: 0.0, max: 2.0, category: "personality" },
};

// =============================================================================
// CONSTANTS — Single source of truth for all game parameters
// =============================================================================
const CONSTANTS = {
  CANVAS: {
    LOGICAL_WIDTH: 960,
    LOGICAL_HEIGHT: 540,
    HALF_WIDTH: 480,
    HALF_HEIGHT: 270,
    GRID_SPACING: 100,
    ZOOM_HINT_DURATION: 5000,
  },

  UI: {
    PANEL_BREAKPOINT: 860,
    SIDEBAR_WIDTH: 236,
    MARGIN: 32,
    MIN_WIDTH: 320,
    MIN_HEIGHT: 240,
    LOG_MAX_ENTRIES: 30,
    TOOLTIP_WIDTH: 176,
    TOOLTIP_HEIGHT: 180,
    TOOLTIP_HEALTH_BAR_WIDTH: 28,
    TOOLTIP_FONT_NAME: '12px Segoe UI, sans-serif',
    TOOLTIP_FONT_STATS: '9px Segoe UI, sans-serif',
  },

  CREATURE: {
    COUNT_MIN: 2,
    COUNT_MAX: 24,
    COUNT_DEFAULT: 12,
    NAME_MAX_LENGTH: 24,
    HUNGER_MAX: 100,
    HUNGER_START: 80,
    THIRST_MAX: 100,
    THIRST_START: 80,
    HEALTH_MAX: 10,
    HEALTH_START: 10,
    MATURITY_AGE: 15,
    MAX_AGE: 60,
    REPRODUCTION_COOLDOWN: 8,
    REPRODUCTION_HUNGER_COST: 30,
    REPRODUCTION_RANGE: 80,
  },

  FOOD: {
    COUNT: 40,
    PICKUP_RANGE: 25,
    HUNGER_VALUE: 25,
    SPAWN_INTERVAL: 3,
    SCALE: 0.35,
  },

  WATER: {
    PICKUP_RANGE: 30,
    THIRST_RESTORE: 30,
    RADIUS: 40,
  },

  RESOURCE_DRAIN: {
    HUNGER_IDLE: 0.3,
    HUNGER_WANDER: 0.8,
    HUNGER_FLEE: 1.8,
    THIRST_IDLE: 0.2,
    THIRST_WANDER: 0.5,
    THIRST_FLEE: 1.2,
  },

  BUSH: {
    PICKUP_RANGE: 25,
    COUNT_DEFAULT: 20,
    MAX_FOOD_DEFAULT: 3,
    REGROW_TIME_DEFAULT: 3,
    MIN_COUNT: 5,
    MAX_COUNT: 60,
    MIN_MAX_FOOD: 1,
    MAX_MAX_FOOD: 10,
    MIN_REGROW: 1,
    MAX_REGROW: 10,
  },

  HUNT: {
    DAMAGE: 1,
    ATTACK_RANGE: 24,
    HUNGER_RESTORE_MULT: 8,
  },

  CUSTOM_TRAIT_LIBRARY: {
    thick_hide: {
      name: "Thick Hide", icon: "🛡",
      desc: "Tougher skin from frequent injuries",
      discover: { exposure: "injured", minTimes: 4, chance: 0.03 },
      effect: { strength: 0.3, speed: -0.1 },
    },
    webbed_feet: {
      name: "Webbed Feet", icon: "🦆",
      desc: "Better at moving near water",
      discover: { exposure: "near_water", minDuration: 30, chance: 0.025 },
      effect: { speed: 0.25, metabolism: -0.1 },
    },
    fast_metabolism: {
      name: "Fast Metabolism", icon: "⚡",
      desc: "Quick energy but hungrier",
      discover: { exposure: "starving", minTimes: 6, chance: 0.03 },
      effect: { speed: 0.3, metabolism: 0.4 },
    },
    pack_hunter: {
      name: "Pack Hunter", icon: "🐺",
      desc: "Hunts better near allies",
      discover: { exposure: "near_same_diet", minCount: 3, duration: 20, chance: 0.02 },
      effect: { strength: 0.2, eyesight: 0.2 },
    },
    keen_eyes: {
      name: "Keen Eyes", icon: "👁",
      desc: "Exceptional vision from scanning for threats",
      discover: { exposure: "fled", minTimes: 8, chance: 0.025 },
      effect: { eyesight: 0.4, metabolism: 0.1 },
    },
    resilient: {
      name: "Resilient", icon: "💪",
      desc: "Withstood many hardships",
      discover: { exposure: "low_health", minTimes: 5, chance: 0.02 },
      effect: { strength: 0.2, metabolism: -0.15 },
    },
    explorer: {
      name: "Explorer", icon: "🧭",
      desc: "Adapted to covering ground",
      discover: { exposure: "far_travel", minDistance: 5000, chance: 0.015 },
      effect: { speed: 0.2, eyesight: 0.15 },
    },
  },

  GENETICS: {
    MUTATION_RATE: 0.12,
    MUTATION_MAGNITUDE: 0.15,
    DOMINANCE_WEIGHT: 0.7,
  },

  MEMORY: {
    BASE_MAX: 3,
    MAX_PER_INTEL: 8,
    BASE_DURATION: 10,
    DURATION_PER_INTEL: 80,
    FUZZ_BASE: 180,
    FUZZ_PER_INTEL: -80,
    CONFIDENCE_DECAY: 0.02,
    OUTCOME_CONFIRM_BOOST: 0.2,
    OUTCOME_DEPLETED_PENALTY: -0.4,
    OUTCOME_MISSING_PENALTY: -0.6,
    CONFIRM_RANGE: 80,
  },

  EXPLORATION: {
    CURIOSITY_BASE: 0.3,
    CURIOSITY_PER_INTEL: 0.5,
    EXPLORE_RANGE: 400,
  },

  SOCIAL: {
    FOLLOW_RANGE: 150,
    FOLLOW_CHANCE: 0.3,
    FOLLOW_SPEED_BONUS: 1.1,
  },

  DRIVES: {
    DECAY_RATE: 0.08,
    BASELINE: { curiosity: 0.2, happiness: 0.5, fear: 0.05, loneliness: 0.15, aggression: 0.2 },
    BOOSTS: {
      curiosity: { explore: 0.3, new_memory: 0.1 },
      happiness: { eat: 0.25, drink: 0.15, reproduce: 0.5, starve: -0.4, injured: -0.3 },
      fear: { threat_seen: 0.4, injured: 0.3, safe_period: -0.05 },
      loneliness: { near_ally: -0.15, isolated: 0.1, reproduce: -0.3 },
      aggression: { hunt_success: 0.3, attacked: 0.4, idle: -0.02 },
    },
    EFFECTS: {
      curiosity: { speed_bonus: 0.2, explore_bias: 1.5 },
      happiness: { speed_bonus: 0.15, wander_variance: 0.3 },
      fear: { flee_distance: 1.5, flee_speed: 1.2 },
      loneliness: { mate_seek_range: 1.3 },
      aggression: { hunt_range: 1.2, damage_bonus: 0.2 },
    },
  },

  TRAIT_DISCOVERY: {
    CHECK_INTERVAL: 5,
    MAX_TRAITS: 4,
    INHERIT_CHANCE: 0.55,
    MUTATE_TRAIT_CHANCE: 0.08,
  },

  LANGUAGE: {
    MAX_VOCAB: 32,
    MAX_EPISODIC_MEMORY: 60,
    TEMPORAL_WINDOW: 5,
    SIGNAL_RANGE_BASE: 150,
    SIGNAL_RANGE_PER_INTEL: 50,
    SIGNAL_COOLDOWN: 2,
    URGENCY_THRESHOLD_BASE: 0.8,
    URGENCY_PER_INTEL: -0.15,
    TOKENS_PER_BROADCAST_MIN: 1,
    TOKENS_PER_BROADCAST_MAX: 4,
    BAYES_PSEUDOCOUNT: 1,
    INFERENCE_WINDOW: 6,
    INHERIT_VOCAB_CHANCE: 0.6,
    VOCAB_MUTATE_CHANCE: 0.12,
    VOCAB_MUTATE_TOKEN_FLIP: 0.15,
    MAX_TOKEN_VALUE: 65535,
  },

  HOUND: {
    START_COUNT: 2,
    MAX_PER_PREY: 0.08,
    REPRODUCTION_COOLDOWN: 15,
    SPEED_BASE: 1.8,
    SPEED_RANGE: 0.3,
    DAMAGE_BASE: 1.5,
    DAMAGE_RANGE: 0.5,
    ADAPT_RATE_BASE: 0.3,
    ADAPT_RATE_RANGE: 0.6,
    PERCEPTION_RANGE: 350,
    PATROL_TIME: 6,
    STALK_TIME: 4,
    FLANK_SPEED: 1.3,
    FLANK_DIST: 180,
    RUSH_SPEED_MULT: 1.6,
    RUSH_DIST: 100,
    FEINT_DIST: 140,
    FEINT_TIME: 2,
    HUNGER_MAX: 80,
    HUNGER_DRAIN: 0.2,
    HUNGER_FROM_KILL: 40,
    START_HEALTH: 8,
    MUTATION_RATE: 0.15,
    MUTATION_MAGNITUDE: 0.12,
  },

  SPECIATION: {
    COMPATIBILITY_THRESHOLD: 0.15,
    HYBRID_SPLIT_CHANCE: 0.05,
    NAME_SIZE_PARTS: ["Tiny", "Small", "Medium", "Large", "Massive"],
    NAME_SPEED_PARTS: ["Slow", "Steady", "Swift", "Rapid", "Blazing"],
    NAME_STRENGTH_PARTS: ["Weak", "Mild", "Sturdy", "Strong", "Mighty"],
    NAME_EYESIGHT_PARTS: ["Blind", "Dim", "Keen", "Sharp", "Eagle"],
    NAME_DIET_PARTS: { herbivore: "Grazer", carnivore: "Hunter", omnivore: "Forager" },
    COLOR_HUE_STEP: 137,
    COLOR_SATURATION: 0.35,
    COLOR_LIGHTNESS: 0.3,
  },

  CAMERA: {
    DEFAULT_ZOOM: 0.5,
    ZOOM_MIN: 0.2,
    ZOOM_MAX: 2.0,
    ZOOM_STEP: 1.1,
    PAN_THRESHOLD: 2,
    TRACKING_ZOOM: 0.8,
    FOCUS_EASE_POW: 0.04,
  },

  CREATURE_VISUAL: {
    BASE_SCALE: 0.65,
    VISUAL_BOUNCE: 0.08,
    BOB_HEIGHT: 10,
    BODY_ANCHOR_Y: 0.72,
    FACE_ANCHOR_Y: 0.65,
    FACE_OFFSET_Y: -12,
    RED_CHANCE: 0.05,
    BODY_FRAME_COUNT: 2,
    FACE_FRAME_COUNT: 13,
    MUGSHOT_WIDTH: 80,
    MUGSHOT_HEIGHT: 80,
    MUGSHOT_SCALE: 0.6,
    MUGSHOT_TRANSLATE_Y: 65,
  },

  MOVEMENT: {
    BASE_MULTIPLIER: 0.78,
    VELOCITY_BLEND_BASE: 0.9,
    VELOCITY_FLIP_THRESHOLD: 0.05,
    PHYSICS_TICK_RATE: 60,
    WORLD_MARGIN: 24,
  },

  SPEED: {
    WANDER: 1.15,
    FLEE: 2.5,
    MATE_SEEK: 1.5,
  },

  BACKGROUND: {
    FILL_COLOR: '#101015',
    GRID_COLOR: 'rgba(255,255,255,0.025)',
    GRID_LINE_WIDTH: 1,
    FALLBACK_GRID_COLOR: '#1a1a24',
    FALLBACK_GRID_LINE_WIDTH: 2,
    FALLBACK_GRID_SPACING: 100,
  },

  CURSOR: {
    RADIUS: 16,
    FRAME_RATE: 12,
    FRAME_COUNT: 5,
    SCALE: 0.42,
    FOLLOW_POW: 0.65,
  },

  MAP: {
    BUSH_COUNT_DEFAULT: 20,
    MAX_FOOD_PER_BUSH_DEFAULT: 3,
    BUSH_REGROW_DEFAULT: 3,
    WATER_COUNT_DEFAULT: 12,
  },

  EVOLUTION: {
    GENERATION_LOG_INTERVAL: 5,
    TRAIT_HISTORY_MAX: 100,
  },
};
