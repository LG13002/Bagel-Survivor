// Run modes and their dials: Practice, Quick, Endless and Extra Crispy.

/** Practice runs start at 2:30 with a head start of level-ups. */
export const PRACTICE_START = 150;
export const PRACTICE_LEVELS = 12;
/** Quick Run: the full run's schedule plays this much faster (5:00 squeezed into 3:00). */
export const QUICK_PACE = 5 / 3;
export const QUICK_XP = 1.6;
export const QUICK_DOUGH = 0.75;
/** Extra Crispy (the hard toggle): more health on every enemy, faster spawns, more Dough. */
export const CRISPY_HP = 1.4;
export const CRISPY_SPAWN = 1.2;
export const CRISPY_DOUGH = 1.5;
/** Everything that hurts you hits this much harder. Health and spawns alone barely moved damage taken (you're already
 * being hit about as often as the 0.9s hit immunity allows), so this carries most of Extra Crispy's extra danger. */
export const CRISPY_DMG = 1.25;
/** Endless, after the first boss falls: elites more often, the mini-boss and the boss come back. */
export const ENDLESS_ELITE_EVERY = 45;
export const ENDLESS_MINI_EVERY = 120;
export const ENDLESS_BOSS_EVERY = 180;
/** Each returning boss has this much more health than the last. */
export const ENDLESS_BOSS_HP = 1.5;
/** Spawns get this much faster per minute after 5:00. */
export const ENDLESS_SPAWN_RAMP = 0.1;
/** Dough per full minute survived after 5:00. */
export const ENDLESS_DOUGH_MIN = 10;

/** When a stage boss falls, the next SLOWMO_TIME seconds (real time) play at SLOWMO speed. */
export const SLOWMO = 0.3;
export const SLOWMO_TIME = 0.5;
/** The Stale King's fall is the end of the story: a longer moment. */
export const KING_SLOWMO_TIME = 1.1;

/** Regular enemies' health in every stage, against the numbers in `ENEMIES` (the owner asked for a more manageable crowd). */
export const CROWD_HP = 0.8;
/**
 * How many regular enemies there are in every stage, against the original pacing: slower spawns, a lower cap and
 * smaller waves. Seeds are worth more by the same share (`CROWD_XP`), so levels come at the same pace.
 */
export const CROWD_COUNT = 0.82;
export const CROWD_XP = 1 / CROWD_COUNT;
/** How many chargers may be winding up or dashing at once; the rest keep walking until one finishes. */
export const MAX_CHARGING = 3;
/** Seconds of safety after a hit. */
export const HIT_GRACE = 1.1;
/** The opening left in a ring wave, in radians, so there is always a way out. */
export const WAVE_GAP = 1.9;
/** How long a charger's dash lasts, in seconds (its lane is drawn this long). */
export const CHARGE_TIME = 0.5;

/** Max health gained for every level reached in a run (the owner's ask after M17: surviving shouldn't hang on Fresh Dough). The gain heals too. */
export const LEVEL_HP = 2;
