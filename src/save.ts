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
  practice?: boolean;
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
