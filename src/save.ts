import { ENEMY_BOOK, STAGES } from './data';

/** Player options, changed on the Settings screen. */
export interface Settings {
  /** Volumes, 0 to 100. */
  music: number;
  sound: number;
  shake: 'on' | 'reduced' | 'off';
  flash: 'normal' | 'reduced';
  /** Battery saver: fewer sparks, no trails. */
  saver: boolean;
  /** Left-handed HUD: the pause button and build row swap sides. */
  lefty: boolean;
  /** Tips: the first-run tutorial, the one-time notes and the rotating hints. */
  tips: boolean;
}

export interface SaveData {
  /** Save format version: `load` runs each upgrade step in `STEPS` once, in order. */
  v?: number;
  settings?: Settings;
  /** Game version whose "What's new" card has been seen. */
  seenVersion?: string;
  /** When a backup code was last copied (ms since 1970), and when the reminder was last waved away. */
  backupAt?: number;
  backupNudge?: number;
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
  /** Secrets found: 'combo' (Lox and Schmear). The Rainbow bagel counts as found once unlocked. */
  secrets?: string[];
  /** Paid challenges already seen on the Goals page (the rest give the Goals button a red dot). */
  goalsSeen?: string[];
  /** One-time tips already shown (ids in `tips.ts`). "Replay tutorial" empties it. */
  tips?: string[];
  /** Menu buttons that have opened: 'bakery', 'goals', 'cookbook'. */
  open?: string[];
  /** Opened menu buttons not tapped yet (they wear a NEW tag). */
  fresh?: string[];
  /** The intro comic has been watched or skipped. */
  intro?: boolean;
  /** The ending and its credits have been seen (the Stale King fell): the title screen turns to morning. */
  ending?: boolean;
}

/** Best single-run numbers (practice runs never count). */
export interface RunRecords {
  /** Most enemies flattened by one rolling can. */
  strike?: number;
  /** Most patches of Stale creep burned away in one run. */
  creep?: number;
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
/** The last save that loaded cleanly, kept as a spare in case the main one is ever unreadable. */
const SPARE_KEY = 'everything-bagel-save-spare';
const CODE_PREFIX = 'EB1:';

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

/**
 * Upgrade steps, one per save format change. Step N takes a save from version N to N + 1, and each runs once.
 * To change the save's shape, add a step at the end: never edit or reorder the old ones.
 */
const STEPS: ((d: SaveData) => void)[] = [
  // 0 to 1: fix-ups for saves from before versions existed.
  (d) => {
    // Saves from before stage select: every clear so far was a Stage 1 clear.
    if (!d.stageClears) d.stageClears = d.clears > 0 ? { stage1: d.clears } : {};
    // Saves from before M8 that cleared the Freezer beat both of its bosses on the way.
    if ((d.stageClears.stage2 ?? 0) > 0) d.beaten = [...new Set([...(d.beaten ?? []), 'waffle', 'fburn'])];
    // Saves from before the Enemies tab: every enemy of a stage already cleared counts as met.
    if (!d.met) d.met = STAGES.filter((st) => (d.stageClears?.[st.id] ?? 0) > 0).flatMap((st) => ENEMY_BOOK[st.id].map((e) => e.kind));
  },
  // 1 to 2: the Settings screen. The old Music and Sound switches become volumes.
  (d) => {
    d.settings = { music: d.music === false ? 0 : 100, sound: d.sound === false ? 0 : 100, shake: 'on', flash: 'normal', saver: false, lefty: false, ...(d.settings ?? {}) } as Settings;
  },
  // 2 to 3: tips and the menu that opens as you go. A save that has been played keeps every menu button open and
  // skips the tips for things it has already done; a brand-new save starts with both.
  (d) => {
    d.settings = { ...d.settings!, tips: d.settings?.tips ?? true };
    const played = d.totalKills > 0 || d.bestTime > 0 || d.dough > 0 || d.clears > 0;
    if (!played) return;
    d.open = ['bakery', 'goals', 'cookbook'];
    const seen = new Set([...(d.tips ?? []), 'move', 'fire', 'seeds', 'cards', 'chest', 'bakery', 'bun']);
    if (d.cookbook.length) seen.add('evolve');
    if ((d.stageClears?.stage1 ?? 0) > 0) for (const id of ['quick', 'endless', 'crispy', 'practice']) seen.add(id);
    if (d.stageTime?.stage2) for (const id of ['freezer', 'mug']) seen.add(id);
    if (d.stageTime?.stage3) for (const id of ['oven', 'grease']) seen.add(id);
    if ((d.best && Object.keys(d.best).some((k) => k.endsWith(':blueberry')))) seen.add('dash');
    d.tips = [...seen];
  },
];
export const SAVE_VERSION = STEPS.length;

/** Brings a save of any age up to the current format. */
function upgrade(data: SaveData): SaveData {
  for (let v = data.v ?? 0; v < STEPS.length; v++) STEPS[v](data);
  data.v = Math.max(data.v ?? 0, STEPS.length);
  return data;
}

/** A save read from storage or a backup code: an object with the fields every save has had since day one. */
function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || typeof d.dough !== 'number' || !Array.isArray(d.unlocked)) return null;
    return { ...fresh(), ...d };
  } catch {
    return null;
  }
}

let cache: SaveData | null = null;
let recovered = false;

/** True once if the main save was unreadable and the spare was loaded in its place (the menu says so). */
export function takeRecovered(): boolean {
  const r = recovered;
  recovered = false;
  return r;
}

export function load(): SaveData {
  if (cache) return cache;
  let data: SaveData | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    data = parseSave(raw);
    if (data) {
      // A good load: keep it as the spare.
      localStorage.setItem(SPARE_KEY, raw!);
    } else if (raw) {
      data = parseSave(localStorage.getItem(SPARE_KEY));
      recovered = !!data;
    }
  } catch {
    // Storage blocked (private mode etc.): play without saving.
  }
  cache = upgrade(data ?? fresh());
  return cache;
}

export function persist(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/** Keeps the save as it is right now as the spare, before something replaces it. */
function keepSpare(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) localStorage.setItem(SPARE_KEY, raw);
  } catch {
    // ignore
  }
}

/** The whole save as a block of text the player can keep somewhere safe. */
export function backupCode(): string {
  const json = JSON.stringify(load());
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

/** Replaces the save with the one in a backup code. Returns false (and changes nothing) if the code isn't a save. */
export function restoreCode(code: string): boolean {
  const text = code.replace(/\s+/g, '');
  if (!text.startsWith(CODE_PREFIX)) return false;
  let data: SaveData | null = null;
  try {
    const bin = atob(text.slice(CODE_PREFIX.length));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    data = parseSave(new TextDecoder().decode(bytes));
  } catch {
    data = null;
  }
  if (!data) return false;
  keepSpare();
  cache = upgrade(data);
  persist();
  return true;
}

/** Starts over. The old save stays as the spare, and the player's settings are kept. */
export function resetSave(): void {
  const keep = load().settings;
  keepSpare();
  cache = upgrade(fresh());
  if (keep) cache.settings = keep;
  persist();
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
