const DEBUG = false;

const GAME_CONSTANTS = {
  dayLength: 60,
  worldDimensions: { width: 3000, height: 1800 },
  universeDimensions: { width: 7500, height: 4500 },
  spawnRadius: 460,
  cornucopiaRadius: 120,
};

const STAT_REGISTRY = {
  strength: { min: 1, max: 10 },
  speed: { min: 1, max: 10 },
  eyesight: { min: 1, max: 10 },
  loyalty: { min: 1, max: 10 },
  aggression: { min: 1, max: 10 },
  friendliness: { min: 1, max: 10 },
  honesty: { min: 1, max: 10 },
  cunning: { min: 1, max: 10 },
  stamina: { min: 1, max: 10 },
};

const WEAPON_REGISTRY = {
  gun: { damage: 3, range: 180, atlas: "weapons_gun", description: "Long range firearm", droppable: true, ranged: true, windUp: 0.2, fireDuration: 0.08, cooldown: 1.2, dodgeDistance: 20 },
  shotgun: { damage: 3, range: 125, atlas: "weapons_shotgun", description: "Medium range shotgun", droppable: true, ranged: true, windUp: 0.25, fireDuration: 0.12, cooldown: 1.5, dodgeDistance: 15 },
  axe: { damage: 3, range: 56, atlas: "weapons_axe", description: "Heavy melee axe", droppable: true },
  bat: { damage: 3, range: 52, atlas: "weapons_bat", description: "Swift melee bat", droppable: true },
  laser_eyes: { damage: 6, range: 500, atlas: null, description: "Superman's vision", droppable: false, ranged: true, windUp: 0.35, fireDuration: 0.4, cooldown: 2.5, dodgeDistance: 30 },
  fists: { damage: 1, range: 42, atlas: null, description: "Basic unarmed attack", droppable: false },
};

const TRAIT_LIBRARY = {
  flight: {
    name: "Flight",
    abilities: { isFlying: true }
  },
  lasereyes: {
    name: "Laser Eyes",
    abilities: { hasLaserEyes: true },
    startingWeapon: "laser_eyes"
  },
  bloodthirsty: {
    name: "Bloodthirsty",
    stats: { aggression: 10 }
  },
  sprinter: {
    name: "Sprinter",
    stats: { speed: 5 }
  },
  tank: {
    name: "Tank",
    stats: { strength: 3 },
    abilities: { maxHealth: 8 }
  },
  sniper: {
    name: "Sniper",
    stats: { eyesight: 5 },
    startingWeapon: "gun"
  },
  pacifist: {
    name: "Pacifist",
    stats: { friendliness: 8, aggression: 1 }
  },
  stealthy: {
    name: "Stealthy",
    abilities: { stealthModifier: 0.5 }
  },
  lucky: {
    name: "Lucky",
    abilities: { damageReduction: 0.2 }
  },
  scavenger: {
    name: "Scavenger",
    abilities: { scavengerMultiplier: 2.0 }
  },
  berserker: {
    name: "Berserker",
    stats: { aggression: 10, strength: 5 },
    abilities: { maxHealthDelta: -2 }
  },
  glass_cannon: {
    name: "Glass Cannon",
    stats: { strength: 10, aggression: 8 },
    abilities: { maxHealthDelta: -3 }
  },
  psychopath: {
    name: "Psychopath",
    stats: { aggression: 10 },
    abilities: { healOnKill: 1 }
  },
  medic: {
    name: "Medic",
    abilities: { regeneration: 0.15 }
  },
  thick_skinned: {
    name: "Thick Skinned",
    abilities: { armor: 1 }
  },
  vampiric: {
    name: "Vampiric",
    abilities: { lifesteal: 0.4 }
  },
  giant: {
    name: "Giant",
    stats: { strength: 4 },
    abilities: { maxHealth: 12, visualScale: 1.5, speedDebuff: 0.7 }
  },
  tiny: {
    name: "Tiny",
    stats: { speed: 4 },
    abilities: { maxHealthDelta: -2, visualScale: 0.65 }
  },
  explosive: {
    name: "Explosive",
    abilities: { explodeOnDeath: true }
  },
  charismatic: {
    name: "Charismatic",
    stats: { friendliness: 10, loyalty: 5 },
    abilities: { allianceBonus: 50, canCommand: true, recruitmentRange: 200 }
  },
  superspeed: {
    name: "Super Speed",
    abilities: { hasSuperSpeed: true }
  },
  momentum: {
    name: "Momentum",
    abilities: { hasMomentum: true }
  },
  armed: {
    name: "Armed",
    startingWeapon: "random"
  },
  gunslinger: {
    name: "Gunslinger",
    startingWeapon: "gun"
  },
  brawler: {
    name: "Brawler",
    startingWeapon: "bat"
  },
  woodsman: {
    name: "Woodsman",
    startingWeapon: "axe"
  },
  shotgunner: {
    name: "Shotgunner",
    startingWeapon: "shotgun"
  }
};

const CHARACTER_LIBRARY = {
  superman: {
    name: "Superman",
    traits: ["flight", "lasereyes"],
    stats: { strength: 100, speed: 100 },
    abilities: { maxHealth: 16 }
  },
  leader: {
    name: "Leader",
    traits: ["charismatic"],
    stats: { friendliness: 20, loyalty: 10, eyesight: 8 }
  },
  a_train: {
    name: "A-Train",
    traits: ["superspeed", "momentum"],
    stats: { strength: 5, speed: 50, eyesight: 8, loyalty: 4, aggression: 8, friendliness: 5 }
  },
};

// =============================================================================
// UNHARDCODED CONSTANTS — The single source of truth for all game parameters
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
    TOOLTIP_HEIGHT: 118,
    TOOLTIP_HEALTH_BAR_WIDTH: 28,
    TOOLTIP_FONT_TITLE: '9px Segoe UI, sans-serif',
    TOOLTIP_FONT_NAME: '12px Segoe UI, sans-serif',
    TOOLTIP_FONT_STATS: '9px Segoe UI, sans-serif',
    VICTORY_CROWN_COLOR: '#ffd700',
    DEATH_LOG_CANNON_CLASS: 'cannon',
  },

  TRIBUTE: {
    COUNT_MIN: 2,
    COUNT_MAX: 24,
    COUNT_DEFAULT: 12,
    NAME_MAX_LENGTH: 24,
  },

  DISTRICT: {
    MIN: 1,
    MAX: 12,
  },

  DAY: {
    LENGTH: 60,
    NIGHT_TRANSITION_START: 5,
    NIGHT_OVERLAY_OPACITY: 0.5,
    NIGHT_VIGNETTE_MULTIPLIER: 1.5,
    NIGHT_BG_COLOR: 'rgba(0, 0, 15, ',
  },

  CAMERA: {
    DEFAULT_ZOOM: 0.45,
    PLAYER_ZOOM: 0.75,
    ZOOM_MIN: 0.3,
    ZOOM_MAX: 2.0,
    ZOOM_STEP: 1.1,
    PAN_THRESHOLD: 2,
    TRACKING_ZOOM: 0.8,
    FOCUS_DURATION_DEFAULT: 1.5,
    FOCUS_DURATION_FATAL: 2.4,
    FOCUS_DURATION_HIT: 1.1,
    PLAYER_EASE_POW: 0.01,
    FOCUS_EASE_POW: 0.04,
  },

  SLOW_MO: {
    SCALE: 0.28,
    DURATION: 1.15,
    OVERLAY_ALPHA_BASE: 0.08,
    TEXT_ALPHA: 0.85,
    TEXT_Y: 28,
    TEXT_X: 22,
  },

  PEEP: {
    DEFAULT_HEALTH: 4,
    DEFAULT_MAX_HEALTH: 4,
    RED_CHANCE: 0.05,
    BODY_FRAME_COUNT: 2,
    FACE_FRAME_COUNT: 13,
    FACE_BLINK_CHANCE: 0.008,
    PANIC_FACE_FRAME: 12,
    BASE_SCALE: 0.65,
    VISUAL_BOUNCE: 0.08,
    BOB_HEIGHT: 10,
    FLY_HEIGHT: -20,
    HIT_FLASH_DURATION: 0.18,
    HIT_FLASH_ALPHA_MAX: 0.55,
    HIT_FLASH_ALPHA_MULT: 3,
    HIT_FLASH_RADIUS: 34,
    HIT_FLASH_OFFSET_Y: -28,
    BODY_ANCHOR_Y: 0.72,
    FACE_ANCHOR_Y: 0.65,
    FACE_OFFSET_Y: -12,
    LASER_EYE_OFFSET_X: 6,
    LASER_EYE_OFFSET_Y: -31,
    LASER_EYE_GLOW_RADIUS_SMALL: 3,
    LASER_EYE_GLOW_RADIUS_LARGE: 5,
    MUGSHOT_WIDTH: 80,
    MUGSHOT_HEIGHT: 80,
    MUGSHOT_SCALE: 0.6,
    MUGSHOT_TRANSLATE_Y: 65,
  },

  MOVEMENT: {
    BASE_MULTIPLIER: 0.78,
    STAT_COEFFICIENT: 0.045,
    FLYING_BONUS: 1.4,
    SUPER_SPEED_MULT: 15,
    SUPER_SPEED_STATES: ['flee', 'charge'],
    SPEED_DEBUFF_MIN: 0.2,
    SPEED_DEBUFF_MAX: 2.0,
    VELOCITY_BLEND_BASE: 0.9,
    VELOCITY_FLIP_THRESHOLD: 0.05,
    PHYSICS_TICK_RATE: 60,
    WORLD_MARGIN: 24,
    OPENING_DURATION: 4.5,
    SKirtCenterRadius: 230,
    SKirtCenterAngleOffset: 0.65,
  },

  SPEED: {
    PLAYER_ARMED: 2.35,
    PLAYER_UNARMED: 2.75,
    RETREAT_ARMED: 2.35,
    RETREAT_UNARMED: 2.7,
    PANIC: 2.4,
    SCAVENGE: 2.05,
    CHARGE: 2.35,
    RUSH_CENTER: 3.2,
    GRAB_WEAPON: 2.8,
    SKIRT_CENTER: 2.4,
    FLEE_ARMED: 2.1,
    FLEE_UNARMED: 2.75,
    WANDER: 1.15,
    REGROUP: 1.65,
    HIDE: 0.85,
  },

  COMBAT: {
    ATTACK_APPLY_TIME: 0.15,
    ATTACK_MAX_TIME: 2.0,
    ATTACK_DAMPING_BASE: 0.75,
    ATTACK_RANGE_BUFFER: 10,
    ATTACK_WEAPON_FRAME_DURATION: 0.75,
    MELEE_STAT_DIVISOR: 3,
    MELEE_STAT_THRESHOLD: 5,
    MIN_DAMAGE: 0.5,
    MOMENTUM_SPEED_MULT: 1.5,
    MOMENTUM_DAMAGE_MULT: 1.5, // speedMult * this -> bonus damage
  },

  LASER: {
    WIND_UP: 0.35,
    FIRE_DURATION: 0.4,
    COOLDOWN: 2.5,
    DODGE_DISTANCE: 30,
    RANGE_BUFFER: 10,
    CHARGE_BLINK_RATE: 20,
    CHARGE_GLOW_BLUR: 14,
    CHARGE_PULSE_SIZE: 12,
    CHARGE_PULSE_SPEED: 18,
    BEAM_OUTER_BLUR: 30,
    BEAM_MIDDLE_BLUR: 15,
    BEAM_CORE_WIDTH: 1.5,
    BEAM_OUTER_WIDTH: 6,
    BEAM_MIDDLE_WIDTH: 3,
    BEAM_IMPACT_FLASH_BLUR: 40,
    BEAM_IMPACT_INNER_RADIUS: 8,
    BEAM_IMPACT_OUTER_RADIUS: 14,
  },

  SUPER_SPEED: {
    TRAIL_LENGTH: 8,
    RECAP_TRAIL_LENGTH: 6,
    GHOST_ALPHA_BASE: 0.25,
    GHOST_BOUNCE: 10,
    GHOST_SCALE_BOUNCE: 0.08,
  },

  WEAPON_ITEM: {
    PICKUP_RANGE: 35,
    DROP_SCATTER: 16,
    GROUND_SCALE: 0.45,
    GROUND_ALPHA: 0.08,
    GROUND_RADIUS: 18,
    FALLBACK_RADIUS: 7,
    FALLBACK_COLOR: '#d6a91c',
  },

  EFFECTS: {
    SPLAT: {
      LIFE_MIN: 3,
      LIFE_MAX: 5,
      SCALE_MIN: 0.3,
      SCALE_MAX: 0.7,
      FRAMES: 3,
    },
    GORE: {
      WEAPON_COUNT_MIN: 20,
      WEAPON_COUNT_MAX: 30,
      UNARMED_COUNT_MIN: 5,
      UNARMED_COUNT_MAX: 12,
      SPEED_MIN: 1.2,
      SPEED_WEAPON_MAX: 5,
      SPEED_UNARMED_MAX: 2.6,
      LIFE_MIN: 2,
      LIFE_MAX: 4,
      Z_MIN: -6,
      Z_MAX: -22,
      VZ_MIN: -4,
      VZ_MAX: -1,
      VR_MIN: -0.16,
      VR_MAX: 0.16,
      SCALE_MIN: 0.4,
      SCALE_MAX: 0.75,
    },
    HIT_GORE: {
      FISTS_COUNT_MIN: 2,
      FISTS_COUNT_MAX: 4,
      WEAPON_COUNT_MIN: 4,
      WEAPON_COUNT_MAX: 9,
      SPEED_MIN: 0.6,
      SPEED_MAX: 2.5,
      GUN_SPEED_MAX: 3.8,
      LIFE_MIN: 0.7,
      LIFE_MAX: 1.5,
      Z_MIN: -4,
      Z_MAX: -14,
      VZ_MIN: -3,
      VZ_MAX: -0.8,
      VR_MIN: -0.14,
      VR_MAX: 0.14,
      SCALE_MIN: 0.28,
      SCALE_MAX: 0.55,
    },
    CORPSE: {
      SCALE: 0.62,
      ALPHA_MULT: 1.4,
      LIFE: 10,
      VX_MIN: -1.5,
      VX_MAX: 1.5,
      VY_MIN: -1.5,
      VY_MAX: 1.5,
      VZ_MIN: -3.5,
      VZ_MAX: -1.5,
      VZ_GRAVITY: 0.15,
      ROTATION_SPEED: 4,
    },
    SHOCKWAVE: {
      SPEED: 360,
      START_RADIUS: 10,
      LIFE: 0.6,
      COLOR: 'rgba(255, 230, 120, ',
      LINE_WIDTH: 3,
    },
    EXPLOSION: {
      DAMAGE: 2,
      RANGE: 150,
    },
  },

  FOG: {
    INNER_RADIUS_MULT: 0.35,
    MID_STOP: 0.65,
    MID_ALPHA: 0.55,
    OUTER_ALPHA: 0.82,
    BASE_ALPHA: 0.82,
    DEFAULT_AWARENESS: 250,
  },

  ALLIANCE: {
    VICINITY: 105,
    START_STRENGTH_DISTRICT: 82,
    START_STRENGTH_CROSS: 58,
    DESIRE_THRESHOLD: 42,
    LEADER_DESIRE_THRESHOLD: 30,
    PROPOSAL_COOLDOWN: 6000,
    BETRAYAL_COOLDOWN_MIN: 2,
    BETRAYAL_COOLDOWN_MAX: 5,
    POST_BETRAYAL_COOLDOWN_MIN: 8,
    POST_BETRAYAL_COOLDOWN_MAX: 14,
    MAX_MEMBERS_BEFORE_RECRUIT_CAP: 3,
    MIN_STRENGTH_FOR_RECRUIT_CAP: 50,
    FINAL_PRESSURE_STRENGTH_DRAIN: 0.08,
    MIN_TOTAL_FOR_PRESSURE: 2,
    TRUST_ATTACKED: 18,
    ANGER_ATTACKED: 22,
    FEAR_ATTACKED: 8,
    TRUST_FOUGHT: 8,
    BOND_FOUGHT: 10,
    TRUST_KILLED_ALLY: 35,
    ANGER_KILLED_ALLY: 45,
    TRUST_BETRAYED: 60,
    ANGER_BETRAYED: 55,
    BOND_BETRAYED: 35,
    TRUST_NEWBIE: 15,
    DESIRE_FRIENDLINESS_MULT: 6,
    DESIRE_LOYALTY_MULT: 2,
    DESIRE_AGGRESSION_PENALTY_MULT: 3,
    DESIRE_DIST_PENALTY_MULT: 0.04,
    DESIRE_TRUST_MULT: 0.4,
    DESIRE_BOND_MULT: 0.35,
    DESIRE_DANGER_NEED: 14,
    DESIRE_ANGER_PENALTY_MULT: 0.9,
    BETRAYAL_AGGRESSION_MULT: 9,
    BETRAYAL_LOYALTY_PENALTY_MULT: 10,
    BETRAYAL_BOND_PENALTY_MULT: 0.8,
    BETRAYAL_TRUST_PENALTY_MULT: 0.45,
    BETRAYAL_WEAPON_OPPORTUNITY: 10,
    BETRAYAL_HEALTH_OPPORTUNITY: 16,
    BETRAYAL_LATE_PRESSURE: 30,
    BETRAYAL_SCORE_MIN: 35,
  },

  ROMANCE: {
    MIN_COURTSHIP: 15,
    PROXIMITY_RANGE: 120,
    MIN_TRUST: 80,
    MIN_BOND: 70,
    MOURN_TIMER: 20,
  },

  DIALOGUE: {
    DEFAULT_DURATION: 2.5,
    TACTICAL_DURATION: 1.2,
    DEFEND_DURATION: 1.5,
    PANIC_DURATION: 3.0,
    AI_BRAIN_DURATION: 3.0,
    SOCIAL_DURATION: 2.0,
    LOOT_DURATION: 2.0,
    GOSSIP_DURATION: 2.5,
    SHOUT_HEIGHT_OFFSET: 110,
    SHOUT_RISE: 20,
    MAX_WIDTH: 180,
    PADDING_X: 10,
    BUBBLE_HEIGHT: 24,
    BUBBLE_RADIUS: 8,
    TAIL_LEFT: 0.42,
    TAIL_CENTER: 0.5,
    TAIL_RIGHT: 0.58,
    TAIL_LENGTH: 8,
    RESPONSE_CHANCE: 0.2,
    GOSSIP_RESPONSE_CHANCE: 0.35,
    MAX_DIST: 250,
    LISTEN_WINDOW: 0.3,
    CONVERSATION_COOLDOWN: 5.0,
    LOOT_SHOUT_COOLDOWN: 15000,
    ALLY_LOOT_COOLDOWN: 8000,
    LOOT_SHARE_DIST: 300,
    LOOT_VALIDATION_DIST: 8,
    ALLY_LOOT_MULT: 1.35,
    LOOT_TARGET_TTL: 6500,
  },

  GOSSIP: {
    VICINITY: 100,
    COOLDOWN: 7.0,
    SHARE_CHANCE: 0.12,
    MAX_ENTRIES: 8,
    BELIEF_DIRECT: 1.0,
    BELIEF_GOSSIP: 0.65,
    BELIEF_LOSS_PER_HOP: 0.2,
    EMOTION_MULT: 0.5,
    OBSERVE_RANGE_MULT: 1.8,
    ACKNOWLEDGE_CHANCE: 0.6,
    DIALOGUE_CHANCE: 0.7,
    TRUST_IMPACT_KILL: 12,
    TRUST_IMPACT_BETRAYAL: 18,
    FEAR_IMPACT_KILL: 10,
    ANGER_IMPACT_BETRAYAL: 15,
  },

  REGROUP: {
    MIN_RANGE: 60,
    TRIGGER_RANGE: 200,
    RANGE_MULT_REGROUPING: 1.4,
    RANGE_MULT_DEFAULT: 1.15,
    WANTS_COMPANY_FRIENDLINESS_LOYALTY: 11,
    WANTS_COMPANY_HEALTH: 2,
  },

  HIDE: {
    ALIVE_THRESHOLD: 6,
    AGGRESSION_THRESHOLD: 3,
    AGGRESSION_WEAPON_THRESHOLD: 5,
    CHANCE: 0.02,
  },

  AI: {
    BRAIN_INTERVAL: 8.5,
    BRAIN_RESET: 8.0,
    OVERRIDE_DURATION: 10000,
    CONCURRENCY: 3,
    EMERGENCY_THREAT_RANGE: 80,
    API_TEST_TIMEOUT: 3000,
    API_TEST_DEBOUNCE: 1500,
    TEMPERATURE: 0.7,
    MAX_TOKENS: 256,
    NEARBY_ENEMIES_MAX: 3,
    NEARBY_ALLIES_MAX: 3,
    NEARBY_WEAPONS_MAX: 3,
    ALLY_RANGE_MULT: 1.5,
    MEMORIES_CONTEXT_MAX: 5,
    MEMORIES_MAX: 12,
    MODEL_GITHUB: 'gpt-4o-mini',
    MODEL_GEMINI: 'gemini-1.5-flash',
    GITHUB_ENDPOINT: 'https://models.inference.ai.azure.com/chat/completions',
    GEMINI_ENDPOINT_TEMPLATE: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
  },

  PROFILE: {
    RUNNER_CHANCE: 0.25,
    SCAVENGER_CHANCE: 0.52,
    WANDERER_CHANCE: 0.76,
    HUNTER_CHANCE: 0.95,
    AWARENESS_BASE: 120,
    AWARENESS_PER_EYESIGHT: 24,
    CAUTION_FORMULA_BASE: 11,
    CENTER_TIME_MIN: 0.4,
    CENTER_TIME_MAX: 1.8,
  },

  RECAP: {
    ROLLING_HISTORY_MAX: 180,
    CAPTURE_FRAMES: 60,
    REPLAY_SCALE: 0.8,
    REPLAY_BASE_ZOOM: 1.0,
    CLIP_PADDING: 250,
    REPLAY_CANVAS_WIDTH: 400,
    REPLAY_CANVAS_HEIGHT: 250,
    REPLAY_FPS: 60,
    HIGHLIGHT_MAX_PER_DAY: 3,
    BLOODBATH_THRESHOLD: 3,
    BLOODBATH_WINDOW: 10000,
    DEATH_FRAME_FALLBACK: 0.75,
    DYNAMIC_CLIP_ZOOM_MIN: 0.15,
    DYNAMIC_CLIP_ZOOM_MAX: 1.5,
    SCANLINES_GAP: 4,
    SCANLINE_HEIGHT: 2,
    SCANLINE_ALPHA: 0.1,
  },

  CURSOR: {
    RADIUS: 16,
    FRAME_RATE: 12,
    FRAME_COUNT: 5,
    SCALE: 0.42,
    FOLLOW_POW: 0.65,
  },

  GOAL_LOGGING: {
    COOLDOWN: 5000,
    IGNORED_GOALS: ['wander', 'rush_center'],
  },

  EVENT: {
    TRIGGER_DELAY: 1000,
    API_TEST_DEBOUNCE: 1500,
    START_BTN_TIMEOUT: 1200,
  },

  BETRAYAL_PRESSURE: {
    ALIVE_2: 38,
    ALIVE_3: 30,
    ALIVE_5: 20,
    ALIVE_8: 10,
  },

  FLEE: {
    HYSTERESIS_FLEE_MULT: 1.5,
    HYSTERESIS_HUNT_MULT: 0.8,
    ANGER_COURAGE_MULT: 0.75,
    AGGRESSION_COURAGE_THRESHOLD: 11,
    HEALTH_COURAGE_THRESHOLD: 1.2,
    REVENGE_SHOUT_CHANCE: 0.05,
  },

  OPENING_GOAL: {
    BERSERker_AGGRESSION: 8,
    HUNTER_AGGRESSION: 6,
    GRAB_WEAPON_SPEED: 7,
    GRAB_WEAPON_AGGRESSION: 6,
    FLEE_AGGRESSION: 3,
    SKIRT_EYESIGHT: 7,
    SKIRT_AGGRESSION: 5,
    RUSH_CENTER_CHANCE: 0.65,
  },

  NIGHT: {
    OVERLAY_COLOR: 'rgba(0, 0, 15, ',
    VIGNETTE_INNER_RADIUS: 100,
    VIGNETTE_OUTER_RADIUS: 720,
    VIGNETTE_COLOR: 'rgba(0,0,5, ',
  },

  BACKGROUND: {
    FILL_COLOR: '#101015',
    GRID_COLOR: 'rgba(255,255,255,0.025)',
    GRID_LINE_WIDTH: 1,
    TILE_GRID_SIZE: 3,
    TILE_OFFSET_MULT: 1.5,
    FALLBACK_GRID_COLOR: '#1a1a24',
    FALLBACK_GRID_LINE_WIDTH: 2,
    FALLBACK_GRID_SPACING: 100,
  },

  STAMINA: {
    MAX: 100,
    START: 100,
    DRAIN_CHARGE: 8,
    DRAIN_FLEE: 7,
    DRAIN_RUSH: 6,
    DRAIN_PANIC: 10,
    DRAIN_ATTACK: 4,
    REGEN_WANDER: 4,
    REGEN_HIDE: 7,
    REGEN_IDLE: 5,
    LOW_THRESHOLD: 25,
    EXHAUSTED_THRESHOLD: 10,
    SPEED_PENALTY_LOW: 0.7,
    SPEED_PENALTY_EXHAUSTED: 0.45,
  },

  DANGER_ZONE: {
    RADIUS_BASE: 140,
    RADIUS_PER_SEVERITY: 20,
    MAX_RADIUS: 320,
    LIFETIME: 30,
    DECAY_START: 18,
    WANDER_AVOIDANCE: 0.6,
    ENEMY_ROUTE_PENALTY: 28,
    MAX_PER_PEEP: 8,
  },

  REVENGE: {
    DURATION: 45,
    COOLDOWN: 20,
    EYESIGHT_MULT: 1.4,
    PRIORITY_SCORE: 200,
  },

  BAIT: {
    MIN_CUNNING: 6,
    SCAN_RADIUS: 220,
    LURK_OFFSET: 55,
    ENGAGE_RANGE: 70,
    DURATION: 12,
    COOLDOWN: 18,
    MIN_WEAPONS_NEARBY: 1,
  },

  COMBAT_BARK: {
    HIT_CHANCE: 0.5,
    KILL_CHANCE: 1.0,
    MISS_CHANCE: 0.35,
    COOLDOWN: 1.2,
  },

  GAME_PHASE: {
    OPENING_SECS: 10,
    EARLY_ALIVE_FRAC: 0.66,
    LATE_ALIVE: 5,
    ENDGAME_ALIVE: 3,
  },

  CASUAL_CHAT: {
    CHANCE: 0.012,
    ALLY_PROXIMITY: 140,
    COOLDOWN: 16,
    RESPONSE_CHANCE: 0.7,
    MIN_bond: 35,
    STRESS_MAX: 0.25,
    DURATION: 3.0,
  },

  ALLIANCE_POSTURE: {
    DECISION_INTERVAL: 6,
    DEFENSIVE_OUTNUMBER_MULT: 1.3,
    AGGRESSIVE_HUNT_MULT: 1.3,
    FLANK_ANGLE: 2.4,
    BAIT_MEMBER_CUNNING_MIN: 6,
    SWAP_THRESHOLD: 4,
  },

  COLLISION: {
    SOFT_RADIUS: 40,
    SOFT_FORCE: 1.2,
    SOFT_ALLY_REDUCTION: 0.5,
  },
};
