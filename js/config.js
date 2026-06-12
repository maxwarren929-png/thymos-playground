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
};

const WEAPON_REGISTRY = {
  gun: { damage: 3, range: 180, atlas: "weapons_gun", description: "Long range firearm", droppable: true },
  shotgun: { damage: 3, range: 125, atlas: "weapons_shotgun", description: "Medium range shotgun", droppable: true },
  axe: { damage: 3, range: 56, atlas: "weapons_axe", description: "Heavy melee axe", droppable: true },
  bat: { damage: 3, range: 52, atlas: "weapons_bat", description: "Swift melee bat", droppable: true },
  laser_eyes: { damage: 100, range: Infinity, atlas: null, description: "Superman's vision", droppable: false },
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
  }
};

const CHARACTER_LIBRARY = {
  superman: {
    name: "Superman",
    traits: ["flight", "lasereyes"],
    stats: { strength: 100, speed: 100 }
  }
};
