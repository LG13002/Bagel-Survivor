// The Daily Run: one run a day that is the same on every phone. The day's stage, bagel and twist come from the date
// alone, and the results never leave the phone (no server, no accounts).
import { BAGELS, BAKERY, STAGES } from './data';
import type { SaveData } from './save';

export type TwistId = 'elites' | 'seeds' | 'rush' | 'glass' | 'lucky' | 'bargain' | 'fast';

export const TWISTS: Record<TwistId, { name: string; blurb: string }> = {
  elites: { name: 'Double Elites', blurb: 'Every elite brings a friend.' },
  seeds: { name: 'Seeds Pay Dough', blurb: 'Every 12th seed is worth a Dough coin.' },
  rush: { name: 'Rush Hour', blurb: '30% more enemies, 30% more XP.' },
  glass: { name: 'Glass Bagel', blurb: 'Half health, double damage.' },
  lucky: { name: 'Lucky Day', blurb: '4 cards on every level-up.' },
  bargain: { name: 'Bargain Bin', blurb: '3 extra rerolls and 3 extra bins.' },
  fast: { name: 'Fast Forward', blurb: 'The whole run at Quick Run pace.' },
};
const TWIST_IDS = Object.keys(TWISTS) as TwistId[];

/** The twists' numbers. */
export const RUSH = 1.3;
export const SEEDS_PER_COIN = 12;
export const BARGAIN = 3;

/** Dough for playing the day's run, and for each day of the streak after the first (capped). */
export const DAILY_PAY = 30;
export const STREAK_PAY = 5;
export const STREAK_PAY_DAYS = 5;

/** Everyone plays the Daily with the same kit, whatever they own: every Bakery upgrade at this rank. */
const KIT_RANK = 2;
export const DAILY_KIT: Record<string, number> = Object.fromEntries(BAKERY.map((u) => [u.id, KIT_RANK]));

export interface Daily {
  /** Local date, YYYY-MM-DD. */
  date: string;
  stage: string;
  bagel: string;
  twist: TwistId;
}

export interface DailyResult {
  /** Seconds survived. */
  t: number;
  /** Enemies defeated. */
  k: number;
  /** The boss fell. */
  c: boolean;
}

/** What the save keeps: the last day played, the streak as of that day, the best streak, and the last two weeks. */
export interface DailySave {
  last?: string;
  streak: number;
  best: number;
  /** Daily Runs cleared, all time. */
  wins?: number;
  days: Record<string, DailyResult>;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Bots set `?day=YYYY-MM-DD` to play another day. */
const FORCED = new URLSearchParams(location.search).get('day');

/** Today on this phone's clock. */
export function today(): string {
  return FORCED && /^\d{4}-\d{2}-\d{2}$/.test(FORCED) ? FORCED : fmt(new Date());
}

/** The date `n` days before `date`. */
export function daysBefore(date: string, n: number): string {
  const d = parse(date);
  d.setDate(d.getDate() - n);
  return fmt(d);
}

/** A short date for cards: "Nov 24". */
export function niceDate(date: string): string {
  return parse(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** One letter for the day of the week: "T". */
export function weekday(date: string): string {
  return parse(date).toLocaleDateString('en-US', { weekday: 'narrow' });
}

/** A long date for the Daily card: "Tuesday, Nov 24". */
export function longDate(date: string): string {
  return parse(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** The bonus Dough the day's scored run pays at this streak length. */
export function dailyBonus(streak: number): number {
  return DAILY_PAY + STREAK_PAY * Math.min(STREAK_PAY_DAYS, Math.max(0, streak - 1));
}

/** The day's run, worked out from the date alone, so every phone agrees. */
export function dailyFor(date: string): Daily {
  // FNV-1a over the date, then a small generator for the three picks.
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stages = STAGES.filter((st) => st.built);
  const bagels = BAGELS.filter((b) => !b.secret);
  return {
    date,
    stage: stages[Math.floor(next() * stages.length)].id,
    bagel: bagels[Math.floor(next() * bagels.length)].id,
    twist: TWIST_IDS[Math.floor(next() * TWIST_IDS.length)],
  };
}

/** The day's scored result, if it has been played. */
export function dailyResult(save: SaveData, date = today()): DailyResult | undefined {
  return save.daily?.days[date];
}

/** The streak as it stands on `date`: it survives until a whole day is missed. */
export function dailyStreak(save: SaveData, date = today()): number {
  const d = save.daily;
  if (!d?.last) return 0;
  return d.last === date || d.last === daysBefore(date, 1) ? d.streak : 0;
}

/** Records the day's scored run. Returns the new streak and the day's bonus Dough (already added to the save). */
export function recordDaily(save: SaveData, date: string, result: DailyResult): { streak: number; bonus: number } {
  const d: DailySave = save.daily ?? { streak: 0, best: 0, days: {} };
  const streak = dailyStreak(save, date) + (d.last === date ? 0 : 1);
  const days: Record<string, DailyResult> = { [date]: result };
  // Two weeks of history is plenty for the card's last-7-days row.
  for (let i = 1; i < 14; i++) {
    const k = daysBefore(date, i);
    if (d.days[k]) days[k] = d.days[k];
  }
  save.daily = { last: date, streak, best: Math.max(d.best, streak), wins: (d.wins ?? 0) + (result.c && d.last !== date ? 1 : 0), days };
  const bonus = dailyBonus(streak);
  save.dough += bonus;
  return { streak, bonus };
}
