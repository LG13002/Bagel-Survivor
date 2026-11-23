import Phaser from 'phaser';
import { xpNeeded } from '../data';

export type PauseReason = '' | 'levelup' | 'pause' | 'chest' | 'over';

/** A level-up card or a chest upgrade. */
export interface Choice {
  kind: 'wnew' | 'wup' | 'tnew' | 'tup' | 'heal' | 'coin';
  id?: string;
}

/** What the results screen gets when a run ends. */
export interface RunResult {
  victory: boolean;
  practice: boolean;
  quick: boolean;
  /** Endless run (time survived is the score); cleared = its boss fell along the way. */
  endless?: boolean;
  cleared?: boolean;
  crispy?: boolean;
  time: number;
  level: number;
  kills: number;
  dough: number;
  bagel: string;
  stage: string;
  newUnlock: string;
  /** Names of weapons this run unlocked, or ''. */
  newWeapon: string;
  /** Name of a stage this run opened up, or ''. */
  newStage: string;
  newBest: boolean;
  evolutions: string[];
  /** Challenges finished this run, with the Dough each paid. */
  goals: { name: string; reward: number }[];
  /** The secret combo evolution was made this run. */
  combo?: boolean;
  /** This was the stage's first clear (the results screen adds a line of story). */
  firstClear?: boolean;
}

/**
 * The run's own values: progress, rewards, and the bagel's status effects. A fresh one is made at the start of
 * every run (`GameScene.init`), so nothing carries over from the last run. Add new run values here (or to one of the
 * run's parts in `src/run/`), never as a plain field on GameScene: the scene object is reused between runs.
 */
export class RunState {
  level = 1;
  xp = 0;
  xpNext = xpNeeded(1);
  pendingLevels = 0;
  kills = 0;
  /** Dough picked up during the run (coins, tip jars, chests). */
  coins = 0;
  rerolls: number;
  evolutionsThisRun: string[] = [];
  miniKilled = false;
  healsTaken = 0;
  /** No hits taken since the current boss arrived (for the no-hit challenge). */
  bossClean = false;
  /** A boss fell this run without landing a hit. */
  noHitBoss = false;
  /** Lox and Schmear was made this run (shown on the results screen). */
  foundCombo = false;
  /** Bakery ranks read once per run: luck, Second Bake and Hard Crust. */
  luck: number;
  reviveRank: number;
  revived = false;
  armor: number;
  /** Warm Mugs picked up this run (they count toward Jam Jar Lob's unlock). */
  runMugs = 0;
  /** Seconds until the next resume snapshot. */
  snapT = 0;
  // Blueberry's dash, Asiago's age, Cinnamon Raisin's kill heal, Poppy's mines and Onion's aura
  dashT = 0;
  dashV = { x: 0, y: 0 };
  dashReadyAt = 0;
  dashFlash = 0;
  agedPct = 0;
  raisinKills = 0;
  mines: { img: Phaser.GameObjects.Image; x: number; y: number; life: number }[] = [];
  mineT = 0;
  auraImg: Phaser.GameObjects.Image | null = null;
  auraT = 0;
  // Freezer footing: sliding on ice, and frost while standing still
  onIce = false;
  vel = { x: 0, y: 0 };
  stillT = 0;
  /** 0..1 frost ring; at 1 the bagel is frozen (slowed) until it walks it off. */
  frost = 0;
  frozen = false;
  /** A Warm Mug keeps frost away until this time. */
  mugUntil = 0;

  constructor(up: Record<string, number>) {
    this.luck = up.luck ?? 0;
    this.reviveRank = up.revive ?? 0;
    this.armor = up.armor ?? 0;
    this.rerolls = 1 + (up.reroll ?? 0);
  }
}
