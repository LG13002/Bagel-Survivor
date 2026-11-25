// Saves the in-progress run so it survives iOS closing the app while you're in a match.
export interface RunSnapshot {
  v: 1;
  savedAt: number;
  bagel: string;
  /** Stage id; snapshots from before stage select are Stage 1. */
  stage?: string;
  practice: boolean;
  quick?: boolean;
  endless?: boolean;
  crispy?: boolean;
  /** A Daily Run: its date, and whether it is the day's scored run. */
  daily?: string;
  dailyScored?: boolean;
  chestsOpened?: number;
  seedN?: number;
  endlessCleared?: boolean;
  nextMini?: number;
  nextBoss?: number;
  bossRound?: number;
  buns?: number;
  now: number;
  level: number;
  xp: number;
  pendingLevels: number;
  hp: number;
  weapons: { id: string; level: number; evolved: boolean; combo?: boolean; at?: number }[];
  toppings: [string, number][];
  kills: number;
  coins: number;
  rerolls: number;
  /** Day-Old Bin: banishes left, cards binned, and how many this run. */
  banishes?: number;
  banished?: string[];
  banishedN?: number;
  /** Dough coins picked up off the floor. */
  coinPickups?: number;
  nextWave: number;
  nextAnts: number;
  nextElite: number;
  miniSpawned: boolean;
  miniHp: number;
  miniKilled: boolean;
  bossSpawned: boolean;
  bossHp: number;
  evolutions: string[];
  healsTaken: number;
  /** No hits taken since the current boss arrived. */
  bossClean?: boolean;
  /** A boss fell this run without landing a hit. */
  noHitBoss?: boolean;
  /** Most enemies one rolling can has flattened so far. */
  canBest?: number;
  creepBurned?: number;
  /** Second Bake already used this run. */
  revived?: boolean;
  mugs?: number;
  /** Surprise elites (the stage's `extras`, by index) that have already arrived. */
  extras?: number[];
  /** Elites that were alive: they come back on resume with the health they had. */
  elites?: { kind: string; hp: number; bun: boolean }[];
}

const KEY = 'everything-bagel-run-v1';
/** Saved runs older than this are dropped. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveRun(s: RunSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function loadRun(): RunSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RunSnapshot;
    if (s.v !== 1 || Date.now() - s.savedAt > MAX_AGE_MS) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
