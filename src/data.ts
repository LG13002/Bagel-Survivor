// All tunable game content lives here.

export type WeaponId = 'sesame' | 'storm' | 'puddle' | 'lox' | 'coffee' | 'pin';
export type ToppingId = 'butter' | 'dough' | 'caffeine' | 'oven' | 'salt' | 'glaze';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  blurb: string;
  levels: string[]; // description of what level N (index N-1) adds; index 0 = on pickup
  evolveWith: ToppingId;
  evoName: string;
  evoBlurb: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sesame: {
    id: 'sesame',
    name: 'Sesame Shot',
    icon: 'ic_sesame',
    blurb: 'Fires seeds at the nearest enemy.',
    levels: ['Fires seeds at the nearest enemy.', '+1 seed', '+50% damage', '+1 seed', 'Seeds pierce +1, fire faster'],
    evolveWith: 'caffeine',
    evoName: 'Seed Gatling',
    evoBlurb: 'A stream of piercing seeds.',
  },
  storm: {
    id: 'storm',
    name: 'Seed Storm',
    icon: 'ic_storm',
    blurb: 'Seeds orbit you like a shield.',
    levels: ['Seeds orbit you like a shield.', '+1 orbiting seed', '+50% damage', '+1 orbiting seed', 'Wider and faster orbit'],
    evolveWith: 'oven',
    evoName: 'Everything Inferno',
    evoBlurb: 'Three rings of flaming seeds.',
  },
  puddle: {
    id: 'puddle',
    name: 'Cream Cheese Puddle',
    icon: 'ic_puddle',
    blurb: 'Sticky puddles that slow and hurt.',
    levels: ['Sticky puddles that slow and hurt.', '+1 puddle', 'Bigger puddles', '+1 puddle', 'More damage, lasts longer'],
    evolveWith: 'butter',
    evoName: 'Schmear Flood',
    evoBlurb: 'The floor around you becomes schmear.',
  },
  lox: {
    id: 'lox',
    name: 'Lox Boomerang',
    icon: 'ic_lox',
    blurb: 'A salmon slice flies out and back.',
    levels: ['A salmon slice flies out and back.', '+1 boomerang', '+50% damage', '+1 boomerang', 'Bigger, flies further'],
    evolveWith: 'glaze',
    evoName: 'Lox Cyclone',
    evoBlurb: 'Boomerangs never stop circling.',
  },
  coffee: {
    id: 'coffee',
    name: 'Hot Coffee Splash',
    icon: 'ic_coffee',
    blurb: 'Scalding splash where you are heading.',
    levels: ['Scalding splash where you are heading.', '+40% damage', 'Wider splash', 'Splash both ways', 'Faster and longer reach'],
    evolveWith: 'salt',
    evoName: 'Espresso Nova',
    evoBlurb: 'Splashes in every direction.',
  },
  pin: {
    id: 'pin',
    name: 'Rolling Pin',
    icon: 'ic_pin',
    blurb: 'Rolls across the screen, big knockback.',
    levels: ['Rolls across the screen, big knockback.', '+1 pin', '+50% damage', '+1 pin', 'Bigger pins'],
    evolveWith: 'dough',
    evoName: 'Baker’s Dozen',
    evoBlurb: 'Thirteen pins in every direction.',
  },
};

export interface ToppingDef {
  id: ToppingId;
  name: string;
  icon: string;
  blurb: string;
}

export const TOPPINGS: Record<ToppingId, ToppingDef> = {
  butter: { id: 'butter', name: 'Extra Butter', icon: 'ic_butter', blurb: '+10% area' },
  dough: { id: 'dough', name: 'Fresh Dough', icon: 'ic_dough', blurb: '+15% max health, heal 15' },
  caffeine: { id: 'caffeine', name: 'Caffeine', icon: 'ic_caffeine', blurb: '+8% attack speed' },
  oven: { id: 'oven', name: 'Hot Oven', icon: 'ic_oven', blurb: '+10% damage' },
  salt: { id: 'salt', name: 'Salt Crystals', icon: 'ic_salt', blurb: '+25% pickup range' },
  glaze: { id: 'glaze', name: 'Glaze', icon: 'ic_glaze', blurb: '+7% move speed' },
};

export const MAX_LEVEL = 5;
export const MAX_SLOTS = 4;

export interface BagelDef {
  id: string;
  name: string;
  tex: string;
  weapon: WeaponId;
  quirk: string;
  unlock: string;
  hp: number;
  speed: number;
  choices: number;
  allStats: number; // flat bonus multiplier on damage/area/speed
}

export const BAGELS: BagelDef[] = [
  {
    id: 'plain',
    name: 'Plain Jane',
    tex: 'bagel_plain',
    weapon: 'sesame',
    quirk: '+10% to all stats. The easy starter.',
    unlock: '',
    hp: 100,
    speed: 140,
    choices: 3,
    allStats: 0.1,
  },
  {
    id: 'everything',
    name: 'Everything Ed',
    tex: 'bagel_everything',
    weapon: 'storm',
    quirk: '4 upgrade choices instead of 3. Lower health.',
    unlock: 'Clear Stage 1 to unlock',
    hp: 75,
    speed: 145,
    choices: 4,
    allStats: 0,
  },
];

export interface UpgradeDef {
  id: string;
  name: string;
  blurb: string;
  costs: number[];
}

export const BAKERY: UpgradeDef[] = [
  { id: 'hp', name: 'Thicker Crust', blurb: '+10 max health per rank', costs: [20, 45, 90, 160, 260] },
  { id: 'dmg', name: 'Hotter Oven', blurb: '+6% damage per rank', costs: [25, 55, 110, 190, 300] },
  { id: 'speed', name: 'Quick Rise', blurb: '+4% move speed per rank', costs: [15, 35, 70, 130, 210] },
  { id: 'magnet', name: 'Sticky Seeds', blurb: '+15% pickup range per rank', costs: [15, 35, 70, 130, 210] },
];

export type EnemyKind = 'crumb' | 'mold' | 'moldling' | 'knife' | 'ant' | 'elite' | 'croissant' | 'toaster';

export interface EnemyDef {
  tex: string;
  hp: number;
  speed: number;
  dmg: number;
  radius: number;
  xp: number;
  mass: number; // knockback resistance
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  crumb: { tex: 'en_crumb', hp: 8, speed: 62, dmg: 5, radius: 9, xp: 1, mass: 1 },
  mold: { tex: 'en_mold', hp: 22, speed: 40, dmg: 8, radius: 12, xp: 2, mass: 1.6 },
  moldling: { tex: 'en_moldling', hp: 8, speed: 55, dmg: 5, radius: 8, xp: 1, mass: 1 },
  knife: { tex: 'en_knife', hp: 26, speed: 50, dmg: 12, radius: 10, xp: 3, mass: 1.3 },
  ant: { tex: 'en_ant', hp: 12, speed: 95, dmg: 6, radius: 7, xp: 1, mass: 0.8 },
  elite: { tex: 'en_mold', hp: 260, speed: 46, dmg: 14, radius: 24, xp: 15, mass: 5 },
  croissant: { tex: 'en_croissant', hp: 1300, speed: 72, dmg: 15, radius: 30, xp: 30, mass: 12 },
  toaster: { tex: 'en_toaster', hp: 5000, speed: 38, dmg: 25, radius: 36, xp: 0, mass: 40 },
};

// Run pacing (seconds)
export const RUN = {
  eliteAt: 45,
  eliteEvery: 60,
  miniBossAt: 150,
  bossAt: 270,
  waveEvery: 30,
  antsFrom: 120,
  antsEvery: 20,
  maxEnemies: 260,
  earlyMaxEnemies: 180, // cap before 3:00
};

/** XP needed to go from level `lvl` to `lvl + 1`. */
export function xpNeeded(lvl: number): number {
  return Math.round(4 + lvl * 2 + Math.pow(lvl, 1.55));
}
