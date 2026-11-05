// All tunable game content lives here.
import type { SongId } from './music';

export type WeaponId = 'sesame' | 'storm' | 'puddle' | 'lox' | 'coffee' | 'pin' | 'knife' | 'jar' | 'toastpop' | 'iron';
export type ToppingId = 'butter' | 'dough' | 'caffeine' | 'oven' | 'salt' | 'glaze' | 'honey' | 'jam' | 'seasoning' | 'frosting';

/** How a locked weapon is earned. 'boss' = beat that boss or mini-boss once; 'mugs' = Warm Mugs picked up in total; 'cookbook' = evolutions found. */
export interface WeaponGoal {
  kind: 'boss' | 'mugs' | 'cookbook';
  boss?: string;
  target: number;
  text: string;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  blurb: string;
  levels: string[]; // description of what level N (index N-1) adds; index 0 = on pickup
  evolveWith: ToppingId;
  evoName: string;
  evoBlurb: string;
  /** Locked weapons never show on level-up cards until this goal is met. */
  unlock?: WeaponGoal;
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
  knife: {
    id: 'knife',
    name: 'Piercing Butter Knife',
    icon: 'ic_knife',
    blurb: 'Knives pierce every enemy in a line.',
    levels: ['Knives pierce every enemy in a line.', '+1 knife', '+50% damage', '+1 knife', 'Longer, faster knives'],
    evolveWith: 'honey',
    evoName: 'Cutlery Drawer',
    evoBlurb: 'Fans of knives in four directions.',
    unlock: { kind: 'boss', boss: 'waffle', target: 1, text: 'Beat the Frozen Waffle' },
  },
  jar: {
    id: 'jar',
    name: 'Jam Jar Lob',
    icon: 'ic_jar',
    blurb: 'Lobbed jars leave sticky, slowing jam.',
    levels: ['Lobbed jars leave sticky, slowing jam.', '+1 jar', 'Bigger pools', '+1 jar', 'More damage, longer pools'],
    evolveWith: 'jam',
    evoName: 'Jam Session',
    evoBlurb: 'Big pools pull enemies to the middle.',
    unlock: { kind: 'mugs', target: 15, text: 'Pick up 15 Warm Mugs' },
  },
  toastpop: {
    id: 'toastpop',
    name: 'Toaster Pop',
    icon: 'ic_toastpop',
    blurb: 'Toast pops up and lands on enemies.',
    levels: ['Toast pops up and lands on enemies.', '+1 toast', '+50% damage', '+1 toast', 'Bigger splash, pops faster'],
    evolveWith: 'seasoning',
    evoName: 'Toast Barrage',
    evoBlurb: 'A rain of toast across the screen.',
    unlock: { kind: 'boss', boss: 'fburn', target: 1, text: 'Beat the Freezer Burn' },
  },
  iron: {
    id: 'iron',
    name: 'Waffle Smash',
    icon: 'ic_iron',
    blurb: 'Heavy stamps around you, big shove.',
    levels: ['Heavy stamps around you, big shove.', '+40% damage', 'Bigger stamp', 'A second stamp on a nearby enemy', 'Faster, and dazes enemies'],
    evolveWith: 'frosting',
    evoName: 'Belgian Slam',
    evoBlurb: 'A giant stamp and a shockwave ring.',
    unlock: { kind: 'cookbook', target: 6, text: 'Discover 6 evolutions' },
  },
};

export interface ToppingDef {
  id: ToppingId;
  name: string;
  icon: string;
  blurb: string;
  /** Offered only once this weapon is unlocked (the new toppings arrive with their weapons). */
  weapon?: WeaponId;
}

export const TOPPINGS: Record<ToppingId, ToppingDef> = {
  butter: { id: 'butter', name: 'Extra Butter', icon: 'ic_butter', blurb: '+10% area' },
  dough: { id: 'dough', name: 'Fresh Dough', icon: 'ic_dough', blurb: '+15% max health, heal 15' },
  caffeine: { id: 'caffeine', name: 'Caffeine', icon: 'ic_caffeine', blurb: '+8% attack speed' },
  oven: { id: 'oven', name: 'Hot Oven', icon: 'ic_oven', blurb: '+10% damage' },
  salt: { id: 'salt', name: 'Salt Crystals', icon: 'ic_salt', blurb: '+25% pickup range' },
  glaze: { id: 'glaze', name: 'Glaze', icon: 'ic_glaze', blurb: '+7% move speed' },
  honey: { id: 'honey', name: 'Honey', icon: 'ic_honey', blurb: '+1 projectile (at levels 1 and 4)', weapon: 'knife' },
  jam: { id: 'jam', name: 'Jam', icon: 'ic_jam', blurb: '+15% duration: puddles, pools, boomerangs', weapon: 'jar' },
  seasoning: { id: 'seasoning', name: 'Everything Seasoning', icon: 'ic_seasoning', blurb: '+luck: better cards and chests', weapon: 'toastpop' },
  frosting: { id: 'frosting', name: 'Cream Cheese Frosting', icon: 'ic_frosting', blurb: '-1 damage from every hit', weapon: 'iron' },
};

export type StageId = 'stage1' | 'stage2' | 'stage3';

/** One spawn-table step: regular enemies picked by weight until stage time `until` (seconds). */
export interface MixStep {
  until: number;
  table: [EnemyKind, number][];
}

/** Everything that makes one stage what it is. The run reads all of this from the picked stage. */
export interface StageDef {
  id: StageId;
  num: number;
  name: string;
  /** One line on the stage card. */
  story: string;
  /** Picture on the stage card and the menu's stage button. */
  thumb: string;
  /** Difficulty pips on the stage card, 1 to 3. */
  pips: number;
  /** Clear this stage to unlock this one (null = always open). */
  unlockAfter: StageId | null;
  unlockText: string;
  /** False until the stage's content exists: shown as "Coming soon" and can't be picked. */
  built: boolean;
  floor: string; // tiling texture, 256 × 256
  props: 'counter' | 'freezer';
  /** Freezer hazards: slippery ice patches on the floor, frost when standing still, Warm Mug drops. */
  ice?: boolean;
  frost?: boolean;
  mug?: boolean;
  /** Dough multiplier for runs on this stage. */
  dough: number;
  // Difficulty dials
  /** Extra health on regular enemies (bosses and elites excluded). */
  hpBonus: number;
  /** Regular enemy health is hpBonus × (1 + stageT / hpGrowth): lower grows faster over the run. */
  hpGrowth: number;
  /** Spawn speed: 1 = Stage 1's pace, higher spawns faster. */
  spawnRate: number;
  /** Contact damage multiplier for every enemy. */
  dmg: number;
  // Cast
  mix: MixStep[];
  /** The ring waves every 30s after the mini-boss: alternating kinds. */
  wave: { kinds: [EnemyKind, EnemyKind]; banner: string };
  /** Lines of fast enemies every 20s from 2:00, or null for none. */
  lines: EnemyKind | null;
  /** Elites at 0:45 and every 60s after, taking turns through this list. */
  elites: { kind: EnemyKind; banner: string; color: string }[];
  /** One-off surprise elites at a stage time. */
  extras?: { at: number; kind: EnemyKind; banner: string; color: string }[];
  mini: { kind: EnemyKind; name: string; banner: string };
  /** `card`: a big announcement card when the boss arrives, instead of the plain banner. */
  boss: { kind: EnemyKind; name: string; banner: string; card?: string };
  music: { run: SongId; boss: SongId };
}

const BAKERY_STAGE: StageDef = {
  id: 'stage1',
  num: 1,
  name: 'The Bakery',
  story: 'The Stale has crept onto the counter. Hold the line!',
  thumb: 'thumb_stage1',
  pips: 1,
  unlockAfter: null,
  unlockText: '',
  built: true,
  floor: 'floor_stage1',
  props: 'counter',
  dough: 1,
  hpBonus: 1.1,
  hpGrowth: 180,
  spawnRate: 1,
  dmg: 1,
  mix: [
    { until: 45, table: [['crumb', 1]] },
    { until: 90, table: [['crumb', 70], ['mold', 30]] },
    { until: 150, table: [['crumb', 50], ['mold', 30], ['knife', 20]] },
    { until: Infinity, table: [['crumb', 40], ['mold', 32], ['knife', 28]] },
  ],
  wave: { kinds: ['moldling', 'crumb'], banner: 'The crumbs close in!' },
  lines: 'ant',
  elites: [{ kind: 'elite', banner: 'A Giant Mold appears!', color: '#9fd36a' }],
  mini: { kind: 'croissant', name: 'Crusty Croissant', banner: 'Crusty Croissant!' },
  boss: { kind: 'toaster', name: 'The Toaster Tyrant', banner: 'THE TOASTER TYRANT' },
  music: { run: 'run', boss: 'boss' },
};

// Stage 3 borrows Stage 1's cast and floor until its own content is built (M9).
// Their difficulty dials are first guesses, tuned with the bot benchmark when each stage is built.
export const STAGES: StageDef[] = [
  BAKERY_STAGE,
  {
    ...BAKERY_STAGE,
    id: 'stage2',
    num: 2,
    name: 'The Freezer',
    story: 'The Stale is freezing the leftovers solid. Thaw them out.',
    thumb: 'thumb_stage2',
    pips: 2,
    unlockAfter: 'stage1',
    unlockText: 'Beat the Toaster Tyrant',
    built: true,
    floor: 'floor_stage2',
    props: 'freezer',
    ice: true,
    frost: true,
    mug: true,
    dough: 1.5,
    hpGrowth: 160,
    // Contact damage trimmed so hazards and the new elites carry the extra difficulty (bot: ~12% more damage taken than Stage 1).
    dmg: 0.94,
    mix: [
      { until: 45, table: [['fcrumb', 1]] },
      { until: 90, table: [['fcrumb', 65], ['popsicle', 35]] },
      { until: 120, table: [['fcrumb', 45], ['popsicle', 25], ['icecube', 18], ['peapod', 12]] },
      { until: Infinity, table: [['fcrumb', 36], ['popsicle', 22], ['icecube', 16], ['peapod', 12], ['fmold', 14]] },
    ],
    wave: { kinds: ['popsicle', 'fcrumb'], banner: 'The frost closes in!' },
    lines: 'sprinkle',
    elites: [
      { kind: 'scoop', banner: 'An Ice Cream Scoop! Mind the melt.', color: '#f7a8c2' },
      { kind: 'fcroissant', banner: 'A Frosted Croissant appears!', color: '#bfe6fb' },
    ],
    extras: [{ at: 240, kind: 'tyrantjr', banner: 'Tyrant Jr. wants a turn!', color: '#ffb36b' }],
    mini: { kind: 'waffle', name: 'Frozen Waffle', banner: 'Frozen Waffle!' },
    boss: { kind: 'fburn', name: 'The Freezer Burn', banner: 'THE FREEZER BURN', card: 'Time to feel the burn!' },
    music: { run: 'frun', boss: 'fboss' },
  },
  {
    ...BAKERY_STAGE,
    id: 'stage3',
    num: 3,
    name: 'The Toaster Oven',
    story: 'Deep in the oven, the Stale is burning everything to a crisp.',
    thumb: 'thumb_stage3',
    pips: 3,
    unlockAfter: 'stage2',
    unlockText: 'Beat the Freezer Burn',
    built: false,
    dough: 2,
    hpGrowth: 145,
  },
];

export function stageById(id: string | undefined): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export const MAX_LEVEL = 5;
export const MAX_SLOTS = 4;

export type Quirk = 'none' | 'trail' | 'raisin' | 'tank' | 'aura' | 'dash' | 'aged';

/** stageclear / stagetime: clear, or survive `target` seconds in, the goal's `stage`. */
export type GoalKind = 'clear' | 'time' | 'kills' | 'noheal' | 'cookbook' | 'stageclear' | 'stagetime';

export interface BagelDef {
  id: string;
  name: string;
  tex: string;
  weapon: WeaponId;
  quirk: string;
  quirkId: Quirk;
  goal: { kind: GoalKind; target: number; text: string; stage?: StageId } | null;
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
    quirkId: 'none',
    goal: null,
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
    quirkId: 'none',
    goal: { kind: 'clear', target: 1, text: 'Clear Stage 1' },
    hp: 75,
    speed: 145,
    choices: 4,
    allStats: 0,
  },
  {
    id: 'poppy',
    name: 'Poppy',
    tex: 'bagel_poppy',
    weapon: 'lox',
    quirk: 'Leaves a trail of poppy seeds that hurt enemies. Starts with Lox Boomerang.',
    quirkId: 'trail',
    goal: { kind: 'time', target: 180, text: 'Survive 3:00 in one run' },
    hp: 90,
    speed: 150,
    choices: 3,
    allStats: 0,
  },
  {
    id: 'cinnamon',
    name: 'Cinnamon Raisin',
    tex: 'bagel_cinnamon',
    weapon: 'pin',
    quirk: 'Heals 1 health for every 20 enemies defeated. Starts with Rolling Pin.',
    quirkId: 'raisin',
    goal: { kind: 'kills', target: 1000, text: 'Defeat 1,000 enemies in total' },
    hp: 100,
    speed: 140,
    choices: 3,
    allStats: 0,
  },
  {
    id: 'pumpernickel',
    name: 'Pumpernickel',
    tex: 'bagel_pumpernickel',
    weapon: 'coffee',
    quirk: 'Tanky and slow. Enemies that touch you take damage and bounce off.',
    quirkId: 'tank',
    goal: { kind: 'noheal', target: 1, text: 'Beat the Toaster Tyrant without picking up a heal' },
    hp: 160,
    speed: 122,
    choices: 3,
    allStats: 0,
  },
  {
    id: 'onion',
    name: 'Onion Olly',
    tex: 'bagel_onion',
    weapon: 'puddle',
    quirk: 'A tear-gas aura slows and hurts enemies near you. Starts with Cream Cheese Puddle.',
    quirkId: 'aura',
    goal: { kind: 'cookbook', target: 3, text: 'Discover 3 evolutions' },
    hp: 90,
    speed: 140,
    choices: 3,
    allStats: 0,
  },
  // Phase 2: the Freezer bagels
  {
    id: 'blueberry',
    name: 'Blueberry',
    tex: 'bagel_blueberry',
    weapon: 'lox',
    quirk: 'Juicy Dash: flick to dash, safe from hits (5s cooldown). Starts with Lox Boomerang.',
    quirkId: 'dash',
    goal: { kind: 'stageclear', target: 1, stage: 'stage2', text: 'Clear the Freezer' },
    hp: 90,
    speed: 145,
    choices: 3,
    allStats: 0,
  },
  {
    id: 'asiago',
    name: 'Asiago',
    tex: 'bagel_asiago',
    weapon: 'puddle',
    quirk: 'Aged: +1% damage every 10s, up to +30%. Starts with Cream Cheese Puddle.',
    quirkId: 'aged',
    goal: { kind: 'stagetime', target: 180, stage: 'stage2', text: 'Survive 3:00 in the Freezer' },
    hp: 100,
    speed: 138,
    choices: 3,
    allStats: 0,
  },
];

export interface UpgradeDef {
  id: string;
  icon: string;
  name: string;
  blurb: string;
  costs: number[];
  /** Bakery tab: 0 = Basics, 1 = Extras. */
  tab?: 0 | 1;
}

export const BAKERY: UpgradeDef[] = [
  { id: 'hp', icon: 'ic_bk_crust', name: 'Thicker Crust', blurb: '+10 max health per rank', costs: [20, 45, 90, 160, 260] },
  { id: 'dmg', icon: 'ic_bk_oven', name: 'Hotter Oven', blurb: '+6% damage per rank', costs: [25, 55, 110, 190, 300] },
  { id: 'speed', icon: 'ic_bk_rise', name: 'Quick Rise', blurb: '+4% move speed per rank', costs: [15, 35, 70, 130, 210] },
  { id: 'magnet', icon: 'ic_bk_sticky', name: 'Sticky Seeds', blurb: '+15% pickup range per rank', costs: [15, 35, 70, 130, 210] },
  // Extras (Phase 2)
  { id: 'luck', icon: 'ic_bk_luck', name: 'Lucky Seed', blurb: '+5% luck: better cards', costs: [25, 55, 110, 190, 300], tab: 1 },
  { id: 'reroll', icon: 'ic_bk_reroll', name: 'Reroll Rack', blurb: '+1 reroll per run', costs: [30, 60, 110, 180, 270], tab: 1 },
  { id: 'revive', icon: 'ic_bk_revive', name: 'Second Bake', blurb: 'Revive once per run', costs: [60, 120, 200, 300, 420], tab: 1 },
  { id: 'armor', icon: 'ic_bk_armor', name: 'Hard Crust', blurb: '-1 damage per hit taken', costs: [25, 55, 110, 190, 300], tab: 1 },
];

export type EnemyKind =
  | 'crumb' | 'mold' | 'moldling' | 'knife' | 'ant' | 'elite' | 'croissant' | 'toaster'
  // The Freezer
  | 'fcrumb' | 'icecube' | 'peapod' | 'popsicle' | 'pophalf' | 'fmold' | 'fmoldling' | 'sprinkle'
  | 'scoop' | 'fcroissant' | 'tyrantjr' | 'waffle' | 'wafflesq' | 'fburn';

export interface EnemyDef {
  tex: string;
  hp: number;
  speed: number;
  dmg: number;
  radius: number;
  xp: number;
  mass: number; // knockback resistance
  /** How it moves: chase (default), 'line' (flies straight across, like ants), 'charge' (stops, shakes, dashes), 'shoot' (keeps its distance and fires). */
  ai?: 'line' | 'charge' | 'shoot';
  /** Dash speed for chargers. */
  dash?: number;
  /** Splits into these when beaten. */
  split?: { kind: EnemyKind; n: number };
  /** Colour of the crumbs it bursts into. */
  burst?: number;
  /** Elites, mini-bosses and bosses: flat health (no growth over the run), never recycled or capped. */
  flat?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  crumb: { tex: 'en_crumb', hp: 8, speed: 62, dmg: 5, radius: 9, xp: 1, mass: 1 },
  mold: { tex: 'en_mold', hp: 22, speed: 40, dmg: 8, radius: 12, xp: 2, mass: 1.6, split: { kind: 'moldling', n: 2 }, burst: 0x76a83e },
  moldling: { tex: 'en_moldling', hp: 8, speed: 55, dmg: 5, radius: 8, xp: 1, mass: 1, burst: 0x76a83e },
  knife: { tex: 'en_knife', hp: 26, speed: 50, dmg: 12, radius: 10, xp: 3, mass: 1.3, ai: 'charge', dash: 430, burst: 0xdfe5ea },
  ant: { tex: 'en_ant', hp: 12, speed: 95, dmg: 6, radius: 7, xp: 1, mass: 0.8, ai: 'line' },
  elite: { tex: 'en_elite', hp: 260, speed: 46, dmg: 14, radius: 24, xp: 15, mass: 5, burst: 0x76a83e, flat: true },
  croissant: { tex: 'en_croissant', hp: 1300, speed: 72, dmg: 15, radius: 30, xp: 30, mass: 12, flat: true },
  toaster: { tex: 'en_toaster', hp: 5000, speed: 38, dmg: 25, radius: 36, xp: 0, mass: 40, flat: true },
  // The Freezer
  fcrumb: { tex: 'en_fcrumb', hp: 8, speed: 71, dmg: 5, radius: 9, xp: 1, mass: 1, burst: 0xcfe9f7 },
  icecube: { tex: 'en_icecube', hp: 30, speed: 44, dmg: 13, radius: 12, xp: 3, mass: 2, ai: 'charge', dash: 380, burst: 0xbfe6fb },
  peapod: { tex: 'en_peapod', hp: 20, speed: 50, dmg: 6, radius: 11, xp: 3, mass: 1.2, ai: 'shoot', burst: 0x7fc24a },
  popsicle: { tex: 'en_popsicle', hp: 24, speed: 46, dmg: 8, radius: 11.5, xp: 2, mass: 1.4, split: { kind: 'pophalf', n: 2 }, burst: 0xf0705a },
  pophalf: { tex: 'en_pophalf', hp: 9, speed: 60, dmg: 5, radius: 8, xp: 1, mass: 1, burst: 0xf0705a },
  fmold: { tex: 'en_fmold', hp: 70, speed: 38, dmg: 10, radius: 16, xp: 5, mass: 3, split: { kind: 'fmoldling', n: 2 }, burst: 0x9cc7b8 },
  fmoldling: { tex: 'en_fmoldling', hp: 10, speed: 52, dmg: 5, radius: 9, xp: 1, mass: 1, burst: 0x9cc7b8 },
  sprinkle: { tex: 'en_sprinkle', hp: 10, speed: 105, dmg: 6, radius: 7, xp: 1, mass: 0.8, ai: 'line', burst: 0xffffff },
  scoop: { tex: 'en_scoop', hp: 300, speed: 40, dmg: 14, radius: 24, xp: 15, mass: 5, burst: 0xf59ab4, flat: true },
  fcroissant: { tex: 'en_fcroissant', hp: 650, speed: 66, dmg: 14, radius: 23, xp: 20, mass: 8, burst: 0xcfe9f7, flat: true },
  tyrantjr: { tex: 'en_tyrantjr', hp: 900, speed: 44, dmg: 18, radius: 23, xp: 20, mass: 10, burst: 0xb8c3cc, flat: true },
  waffle: { tex: 'en_waffle', hp: 1500, speed: 62, dmg: 16, radius: 30, xp: 30, mass: 12, split: { kind: 'wafflesq', n: 4 }, burst: 0xdda04a, flat: true },
  wafflesq: { tex: 'en_wafflesq', hp: 30, speed: 72, dmg: 7, radius: 11, xp: 2, mass: 1.2, burst: 0xdda04a },
  fburn: { tex: 'en_fburn', hp: 6000, speed: 34, dmg: 25, radius: 44, xp: 0, mass: 40, burst: 0xd9472e, flat: true },
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
