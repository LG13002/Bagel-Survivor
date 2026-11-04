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
  practice?: boolean;
  noHealClear?: boolean;
  /** Per bagel, per stage best runs, keyed 'stage:bagel'. */
  best?: Record<string, BestScore>;
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

/** Best run for one bagel on one stage. A clear beats any time; then longer time, then more kills. */
export interface BestScore {
  time: number;
  kills: number;
  cleared: boolean;
}

export const STAGE = 'stage1';
/** High scores for Quick Runs of stage 1 are kept separately. */
export const QUICK_STAGE = 'stage1q';

function bestKey(stage: string, bagel: string): string {
  return `${stage}:${bagel}`;
}

export function getBest(save: SaveData, bagel: string, stage = STAGE): BestScore | undefined {
  return save.best?.[bestKey(stage, bagel)];
}

function better(a: BestScore, b: BestScore | undefined): boolean {
  if (!b) return true;
  if (a.cleared !== b.cleared) return a.cleared;
  if (a.cleared) return a.kills > b.kills; // both clears: the menu shows kills, so rank by kills
  if (a.time !== b.time) return a.time > b.time;
  return a.kills > b.kills;
}

/** Records the run if it beats the stored best. Returns true for a new best. */
export function recordBest(save: SaveData, bagel: string, score: BestScore, stage = STAGE): boolean {
  if (!better(score, getBest(save, bagel, stage))) return false;
  save.best = { ...(save.best ?? {}), [bestKey(stage, bagel)]: score };
  return true;
}
