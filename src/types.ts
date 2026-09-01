export type GameState = 'title' | 'loadout' | 'playing' | 'paused';

export type MainWeaponId = 'springfield' | 'kentucky' | 'sword' | 'brown_bess';
export type SubWeaponId = 'flintlock_pistol' | 'knife' | 'machete' | 'grenade';
export type ToolId = 'axe' | 'shovel' | 'pickaxe' | 'med_kit';
export type SpecialtyId = 'healer' | 'attacker' | 'builder' | 'tank' | 'speedster';

export interface WeaponInfo {
  id: string;
  name: string;
  category: 'main' | 'sub' | 'tool';
  type: string;
  damage: number;
  fireRate: number; // in rounds/sec or attacks/sec
  reloadTime: number; // in seconds (e.g. 3.5s for Springfield, 5.0s for Kentucky, 3.0s for Brown Bess)
  isFirearm: boolean;
  range: number;
  accuracy: number;
  description: string;
  icon: string;
  lore: string;
}

export interface SpecialtyInfo {
  id: SpecialtyId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  modifiers: {
    healthMultiplier: number;    // e.g. 1.8 for tank, 0.8 for speedster
    speedMultiplier: number;     // e.g. 1.35 for speedster, 0.9 for tank, 0.95 for attacker
    damageMultiplier: number;    // e.g. 1.2 for attacker, 0.7 for tank
    healRateMultiplier: number;  // e.g. 1.5 for healer
    buildRateMultiplier: number; // e.g. 1.2 for builder
  };
  pros: string[];
  cons: string[];
}

export interface PlayerLoadout {
  mainWeapon: MainWeaponId;
  subWeapon: SubWeaponId;
  tool: ToolId;
  tools?: ToolId[]; // Up to 3 equipped utility tools
  specialty: SpecialtyId;
}

export interface TerrainConfig {
  seed: number;
  width: number;
  depth: number;
  resolution: number;
  baselineY: number;      // 20
  maxMountainY: number;   // 120 (100 feet higher from y=20)
  minValleyY: number;     // -5
  mountainScale: number;
  detailScale: number;
}

export interface PlayerInventory {
  wood: number; // Wood Timber harvested from felled trees
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  heading: number; // in degrees 0-360
  pitch: number;
  speed: number;
  isGrounded: boolean;
  isSwimming: boolean;
  isUnderwater: boolean;
  breath: number; // in seconds (0.0 to 5.0)
  maxBreath: number; // 5.0
  altitude: number; // relative to terrain
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  isExhausted: boolean;
  isDead: boolean;
  causeOfDeath: string;
  activeSlot: 'main' | 'sub' | 'tool';
  selectedToolIndex: number;
  equippedTools: ToolId[];
  isReloading: boolean;
  reloadProgress: number; // 0.0 to 1.0
  reloadTimeTotal: number;
  slotReloads: Record<'main' | 'sub' | 'tool', { isReloading: boolean; progress: number; remaining: number }>;
  inventory: PlayerInventory;
  isBuildingMode: boolean;
  selectedBuilding: BuildingId;
  buildingRotation: number;
  isCrouching: boolean;
  isConstructing: boolean;
  constructionProgress: number; // 0.0 to 1.0
  constructionTimeTotal: number; // total in seconds
  constructionRemaining: number; // remaining in seconds
  constructingBuildingName: string;
  perspective: 'first' | 'third';
  isClimbing: boolean;
}

export interface Landmark {
  id: string;
  name: string;
  x: number;
  z: number;
  y: number;
  type: 'fort' | 'camp' | 'flag' | 'tower' | 'monument';
  description: string;
}

export interface WorldObstacle {
  id?: string;
  x: number;
  z: number;
  y: number;
  radius: number;
  height: number;
  type: 'tree' | 'rock' | 'structure' | 'building';
  health?: number;
  maxHealth?: number;
  isFelled?: boolean;
}

export const MAIN_WEAPONS: Record<MainWeaponId, WeaponInfo> = {
  springfield: {
    id: 'springfield',
    name: 'Springfield Model 1795',
    category: 'main',
    type: 'Flintlock Musket Rifle',
    damage: 75,
    fireRate: 0.5,
    reloadTime: 3.5, // 3.5 seconds reload
    isFirearm: true,
    range: 120,
    accuracy: 85,
    description: 'First American-manufactured military musket with standardized parts and robust rifled barrel.',
    icon: '🎯',
    lore: 'Produced in the Springfield Armory created by General George Washington.'
  },
  kentucky: {
    id: 'kentucky',
    name: 'Kentucky Long Rifle',
    category: 'main',
    type: 'Precision Rifled Flintlock',
    damage: 95,
    fireRate: 0.35,
    reloadTime: 5.0, // 5.0 seconds reload (tight patched round ball)
    isFirearm: true,
    range: 220,
    accuracy: 98,
    description: 'Deadly frontier rifle renowned for extreme long-range accuracy and rifled spiral barrel.',
    icon: '🦅',
    lore: 'Wielded by colonial sharpshooters and frontiersmen against British officers.'
  },
  sword: {
    id: 'sword',
    name: 'Imperial Broadsword',
    category: 'main',
    type: 'Massive Double-Edged Broadsword',
    damage: 65,
    fireRate: 2.2,
    reloadTime: 0, // Melee weapon
    isFirearm: false,
    range: 5.5,
    accuracy: 95,
    description: 'Imposing 1.45m broad double-edged steel blade with wide central fuller groove, carved antique bronze crossguard, braided grip, and lobed tea-cosy pommel.',
    icon: '⚔️',
    lore: 'A masterwork heirloom blade forged in the grand broadsword tradition, delivering devastating cleaves.'
  },
  brown_bess: {
    id: 'brown_bess',
    name: 'Brown Bess Musket',
    category: 'main',
    type: 'Heavy 0.75 Caliber Musket',
    damage: 85,
    fireRate: 0.45,
    reloadTime: 3.0, // 3.0 seconds reload (fast paper cartridge smoothbore)
    isFirearm: true,
    range: 90,
    accuracy: 70,
    description: 'Heavy smoothbore musket with devastating stopping power and standard bayonet lug.',
    icon: '💥',
    lore: 'The most widespread service arm of the Revolutionary War era.'
  }
};

export const SUB_WEAPONS: Record<SubWeaponId, WeaponInfo> = {
  flintlock_pistol: {
    id: 'flintlock_pistol',
    name: 'Flintlock Pistols',
    category: 'sub',
    type: 'Sidearm Flintlock',
    damage: 48,
    fireRate: 1.0,
    reloadTime: 2.2,
    isFirearm: true,
    range: 45,
    accuracy: 78,
    description: 'Reliable brass-mounted officer sidearm capable of rapid emergency defense.',
    icon: '🔫',
    lore: 'Commonly kept in saddle holsters or officer waist belts for close encounters.'
  },
  knife: {
    id: 'knife',
    name: 'Frontier Hunting Knives',
    category: 'sub',
    type: 'Dual Stealth Blades',
    damage: 35,
    fireRate: 3.5,
    reloadTime: 0,
    isFirearm: false,
    range: 3,
    accuracy: 98,
    description: 'Quick deer-antler handled fighting knife with rapid strike rate and silent takedown.',
    icon: '🗡️',
    lore: 'Essential tool of the Minutemen rangers for stealthy scouting.'
  },
  machete: {
    id: 'machete',
    name: 'Colonial Heavy Machete',
    category: 'sub',
    type: 'Broad Chopping Blade',
    damage: 55,
    fireRate: 1.8,
    reloadTime: 0,
    isFirearm: false,
    range: 4,
    accuracy: 90,
    description: 'Broad curved steel cleaver excels in clearing thick brush and devastating melee.',
    icon: '🪓',
    lore: 'Frontier clearing tool modified for close-quarters infantry defense.'
  },
  grenade: {
    id: 'grenade',
    name: 'Black Powder Grenades',
    category: 'sub',
    type: 'Throwable Cast-Iron Explosive Orb',
    damage: 100, // 100 direct / 50 indirect
    fireRate: 0.3,
    reloadTime: 80.0, // 2x reload time: 80 seconds
    isFirearm: false,
    range: 35,
    accuracy: 80,
    description: 'Massive 3X black powder blast with 10.5 yd lethal direct (100 HP) & 30 yd splash shockwave (50 HP, 80s reload).',
    icon: '💣',
    lore: 'Used by colonial assault sappers and grenadiers against fortified redoubts.'
  }
};

export const TOOLS: Record<ToolId, WeaponInfo> = {
  axe: {
    id: 'axe',
    name: 'Woodsman Felling Axes',
    category: 'tool',
    type: 'Heavy Forged Tomahawk/Axe',
    damage: 15,
    fireRate: 1.4,
    reloadTime: 0,
    isFirearm: false,
    range: 4,
    accuracy: 88,
    description: 'Deals 15 damage per chop. Breaks 45 HP timber trees in exactly 3 swings.',
    icon: '🪓',
    lore: 'Essential camp equipment of Continental Army pioneers and woodsmen.'
  },
  shovel: {
    id: 'shovel',
    name: 'Shovels',
    category: 'tool',
    type: 'Forged Steel Spadework Shovel',
    damage: 5,
    fireRate: 1.2,
    reloadTime: 0,
    isFirearm: false,
    range: 4,
    accuracy: 85,
    description: 'Digs 3 feet of dirt per 4 swings into the earth. Deals 5 melee damage.',
    icon: '🪏',
    lore: 'Pivotal during the Battle of Bunker Hill for digging earthworks and overnight defensive redoubts.'
  },
  pickaxe: {
    id: 'pickaxe',
    name: 'Frontier Pickaxe',
    category: 'tool',
    type: 'Forged Steel Mining Pick',
    damage: 10,
    fireRate: 1.1,
    reloadTime: 0,
    isFirearm: false,
    range: 4,
    accuracy: 90,
    description: 'Deals 10 damage per strike. Shatters 50 HP stone boulders in exactly 5 hits.',
    icon: '⛏️',
    lore: 'Pioneer entrenching mattock used to break shale, granite, and excavate mountain trails.'
  },
  med_kit: {
    id: 'med_kit',
    name: 'Continental Field Med Kit Box',
    category: 'tool',
    type: 'Medical Kit Box & Bandages',
    damage: 20, // Heals 20 HP
    fireRate: 0.8,
    reloadTime: 60.0, // 1 minute (60 seconds) reload cooldown
    isFirearm: false,
    range: 0,
    accuracy: 100,
    description: 'Heals 20 Health. 1 minute (60s) reload cooldown.',
    icon: '🧰',
    lore: 'Prescribed by colonial field surgeons to keep troops healthy in bitter winter camps.'
  }
};

export const SPECIALTIES: Record<SpecialtyId, SpecialtyInfo> = {
  healer: {
    id: 'healer',
    name: 'Healer',
    tagline: 'Field Surgeon & Medic',
    description: 'Heals 50% faster than other players and restores health over time.',
    icon: '❤️',
    modifiers: {
      healthMultiplier: 1.0,
      speedMultiplier: 1.0,
      damageMultiplier: 1.0,
      healRateMultiplier: 1.5,
      buildRateMultiplier: 1.0
    },
    pros: ['+50% Faster Health Regeneration', 'Automatic Passive Healing in Camp'],
    cons: ['Standard Combat Speed', 'Standard Combat Damage']
  },
  attacker: {
    id: 'attacker',
    name: 'Attacker',
    tagline: 'Vanguard Shock Trooper',
    description: '20% more Damage with all firearms and blades, with a slight 5% speed penalty.',
    icon: '⚔️',
    modifiers: {
      healthMultiplier: 1.0,
      speedMultiplier: 0.95,
      damageMultiplier: 1.20,
      healRateMultiplier: 1.0,
      buildRateMultiplier: 1.0
    },
    pros: ['+20% Weapon Damage on All Attacks', 'Devastating Critical Strikes'],
    cons: ['-5% Movement Speed Penalty']
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    tagline: 'Continental Military Engineer',
    description: 'Builds fortifications and field structures 20% faster than other soldiers.',
    icon: '🔨',
    modifiers: {
      healthMultiplier: 1.0,
      speedMultiplier: 1.0,
      damageMultiplier: 1.0,
      healRateMultiplier: 1.0,
      buildRateMultiplier: 1.20
    },
    pros: ['+20% Faster Build & Repair Speed', 'Bonus Efficiency with Tools (Axe/Shovel)'],
    cons: ['Standard Health & Speed']
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    tagline: 'Ironclad Grenadier Sentinel',
    description: '80% more Health to withstand heavy fire, but has -30% damage and -10% speed.',
    icon: '🛡️',
    modifiers: {
      healthMultiplier: 1.80,
      speedMultiplier: 0.90,
      damageMultiplier: 0.70,
      healRateMultiplier: 1.0,
      buildRateMultiplier: 1.0
    },
    pros: ['+80% Maximum Health Pool', 'Massive Blast & Impact Resistance'],
    cons: ['-30% Attack Damage', '-10% Slower Movement Speed']
  },
  speedster: {
    id: 'speedster',
    name: 'Speedster',
    tagline: 'Minuteman Courier Scout',
    description: '+35% faster movement and sprint speed across terrain, but has -20% health.',
    icon: '⚡',
    modifiers: {
      healthMultiplier: 0.80,
      speedMultiplier: 1.35,
      damageMultiplier: 1.0,
      healRateMultiplier: 1.0,
      buildRateMultiplier: 1.0
    },
    pros: ['+35% Blazing Movement & Sprint Speed', 'Rapid Mountain Ridge Traversal'],
    cons: ['-20% Reduced Maximum Health']
  }
};

export const DEFAULT_LOADOUT: PlayerLoadout = {
  mainWeapon: 'springfield',
  subWeapon: 'flintlock_pistol',
  tool: 'axe',
  tools: ['axe', 'shovel', 'med_kit'],
  specialty: 'attacker'
};

// ==========================================
// 1776 Frontier Building & Construction System
// ==========================================

export type BuildingId = 'campfire' | 'palisade' | 'bridge' | 'cabin' | 'watchtower';

export interface BuildingBlueprint {
  id: BuildingId;
  name: string;
  category: 'utility' | 'defense' | 'shelter';
  woodCost: number;
  buildTime: number; // in seconds
  description: string;
  icon: string;
  width: number;
  height: number;
  depth: number;
  health: number;
}

export const BUILDING_BLUEPRINTS: Record<BuildingId, BuildingBlueprint> = {
  campfire: {
    id: 'campfire',
    name: 'Frontier Campfire',
    category: 'utility',
    woodCost: 6, // 6 Wood Timber
    buildTime: 1.5, // 1.5s build time
    description: 'Stone-ringed burning timber fire with warm glow & embers.',
    icon: '🔥',
    width: 1.6,
    height: 0.8,
    depth: 1.6,
    health: 60
  },
  palisade: {
    id: 'palisade',
    name: 'Log Palisade Wall',
    category: 'defense',
    woodCost: 12, // 12 Wood Timber
    buildTime: 2.5, // 2.5s build time
    description: 'Defensive wooden log barricade with sharpened spikes for fortresses.',
    icon: '🪵',
    width: 4.2,
    height: 3.2,
    depth: 0.9,
    health: 180
  },
  bridge: {
    id: 'bridge',
    name: 'Timber Plank Ramp / Bridge',
    category: 'utility',
    woodCost: 15, // 15 Wood Timber
    buildTime: 3.0, // 3.0s build time
    description: 'Elevated wooden ramp to cross ocean water, trenches, or ascend cliffs.',
    icon: '🪜',
    width: 3.2,
    height: 1.6,
    depth: 5.5,
    health: 150
  },
  cabin: {
    id: 'cabin',
    name: 'Frontier Log Cabin',
    category: 'shelter',
    woodCost: 35, // 35 Wood Timber
    buildTime: 5.0, // 5.0s build time
    description: 'Solid four-walled wooden cabin with pitched roof and doorway shelter.',
    icon: '🛖',
    width: 5.2,
    height: 3.8,
    depth: 5.2,
    health: 350
  },
  watchtower: {
    id: 'watchtower',
    name: 'Continental Watchtower',
    category: 'defense',
    woodCost: 50, // 50 Wood Timber
    buildTime: 6.5, // 6.5s build time
    description: 'High wooden lookout post with top observation deck for long-range reconnaissance.',
    icon: '🏰',
    width: 4.2,
    height: 8.5,
    depth: 4.2,
    health: 500
  }
};
