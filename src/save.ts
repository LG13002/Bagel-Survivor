import { ENEMY_BOOK, STAGES } from './data';

export interface SaveData {
  dough: number;
  upgrades: Record<string, number>;
  unlocked: string[];
  selected: string;
  cookbook: string[];
  bestTime: number;
  totalKills: number;
  clears: number;
  sound?: boolean;
  music?: boolean;
  /** Last chosen run length: true = Quick Run (3:00). */
  quick?: boolean;
  /** Last chosen mode was Endless (only on stages you've cleared; never with quick). */
  endless?: boolean;
  /** Extra Crispy (the hard toggle) is on. Only applies on stages you've cleared. */
  crispy?: boolean;
  /** Clears per stage id with Extra Crispy on (shows a flame star on the stage card). */
  crispyClears?: Record<string, number>;
  practice?: boolean;
  noHealClear?: boolean;
  /** Per bagel, per stage best runs, keyed 'stage:bagel' ('stage1q:plain' for Quick Runs). */
  best?: Record<string, BestScore>;
  /** Last stage picked on the menu. */
  stage?: string;
  /** Clears per stage id (Full and Quick both count). */
  stageClears?: Record<string, number>;
  /** Longest survival per stage id, in seconds (a Quick Run clear counts as 3:00). */
  stageTime?: Record<string, number>;
  /** Weapons unlocked through goals (the 6 starter weapons are always open). */
  weapons?: string[];
  /** Bosses and mini-bosses beaten at least once, by enemy kind. */
  beaten?: string[];
  /** Warm Mugs picked up, all runs together. */
  mugs?: number;
  /** Enemy kinds met at least once (the Cookbook's Enemies tab shows the rest as "???"). */
  met?: string[];
  /** Best single-run numbers, for the Goals page's challenges. */
  records?: RunRecords;
  /** Beat a stage boss without getting hit during the fight. */
  noHitBoss?: boolean;
  /** Challenges whose Dough reward has been paid. */
  goalsPaid?: string[];
  /** Paid challenges already seen on the Goals page (the rest give the Goals button a red dot). */
  goalsSeen?: string[];
}

/** Best single-run numbers (practice runs never count). */
export interface RunRecords {
  kills?: number;
  level?: number;
  /** Evolutions in one run. */
  evos?: number;
  /** Longest Endless run, in seconds. */
  endless?: number;
  /** Most boss kills in one Endless run. */
  endlessBosses?: number;
}

const KEY = 'everything-bagel-save-v1';

function fresh(): SaveData {
  return {
    dough: 0,
    upgrades: {},
    unlocked: ['plain'],
    selected: 'plain',
    cookbook: [],
    bestTime: 0,
    totalKills: 0,
    clears: 0,
  };
}

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;
  let data = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = { ...data, ...JSON.parse(raw) };
  } catch {
    // Storage blocked (private mode etc.): play without saving.
  }
  // Saves from before stage select: every clear so far was a Stage 1 clear.
  if (!data.stageClears) data.stageClears = data.clears > 0 ? { stage1: data.clears } : {};
  // Saves from before M8 that cleared the Freezer beat both of its bosses on the way.
  if ((data.stageClears.stage2 ?? 0) > 0) data.beaten = [...new Set([...(data.beaten ?? []), 'waffle', 'fburn'])];
  // Saves from before the Enemies tab: every enemy of a stage already cleared counts as met.
  if (!data.met) data.met = STAGES.filter((st) => (data.stageClears?.[st.id] ?? 0) > 0).flatMap((st) => ENEMY_BOOK[st.id].map((e) => e.kind));
  cache = data;
  return data;
}

export function persist(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/** Best run for one bagel on one stage. A clear beats any time; then longer time, then more kills. Endless ranks by time only. */
export interface BestScore {
  time: number;
  kills: number;
  cleared: boolean;
  endless?: boolean;
}

/** Run modes: Full (5:00), Quick (3:00) or Endless (keeps going after the boss). */
export type RunMode = 'full' | 'quick' | 'endless';

/** Key for a stage's bests. Quick and Endless keep their own ('stage1q', 'stage1e'), and Extra Crispy adds an 'x' ('stage1qx'). */
export function bestStage(stage: string, mode: RunMode | boolean, crispy = false): string {
  const m = mode === true || mode === 'quick' ? 'q' : mode === 'endless' ? 'e' : '';
  return `${stage}${m}${crispy ? 'x' : ''}`;
}

function bestKey(stage: string, bagel: string): string {
  return `${stage}:${bagel}`;
}

export function getBest(save: SaveData, bagel: string, stage: string): BestScore | undefined {
  return save.best?.[bestKey(stage, bagel)];
}

function better(a: BestScore, b: BestScore | undefined): boolean {
  if (!b) return true;
  if (a.endless) return a.time > b.time;
  if (a.cleared !== b.cleared) return a.cleared;
  if (a.cleared) return a.kills > b.kills; // both clears: the menu shows kills, so rank by kills
  if (a.time !== b.time) return a.time > b.time;
  return a.kills > b.kills;
}

/** Records the run if it beats the stored best. Returns true for a new best. */
export function recordBest(save: SaveData, bagel: string, score: BestScore, stage: string): boolean {
  if (!better(score, getBest(save, bagel, stage))) return false;
  save.best = { ...(save.best ?? {}), [bestKey(stage, bagel)]: score };
  return true;
}
