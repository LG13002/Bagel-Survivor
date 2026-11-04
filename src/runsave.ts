// Saves the in-progress run so it survives iOS closing the app while you're in a match.
export interface RunSnapshot {
  v: 1;
  savedAt: number;
  bagel: string;
  practice: boolean;
  now: number;
  level: number;
  xp: number;
  pendingLevels: number;
  hp: number;
  weapons: { id: string; level: number; evolved: boolean }[];
  toppings: [string, number][];
  kills: number;
  coins: number;
  rerolls: number;
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
