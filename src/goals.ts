import { BAGELS, STAGES } from './data';
import { fmtTime } from './config';
import type { SaveData } from './save';
import type { GoalStatus } from './progress';

/** A challenge on the Goals page: a one-time Dough reward for something fun. */
export interface ChallengeDef {
  id: string;
  name: string;
  /** Dough paid once, the first time it's done. */
  reward: number;
  icon: string;
  status(save: SaveData): GoalStatus;
}

const BUILT = STAGES.filter((st) => st.built);
/** The six bagels you can unlock without secrets (Plain to Onion). */
const STARTERS = BAGELS.slice(0, 6).map((b) => b.id);

function count(n: number, target: number, best = false): GoalStatus {
  const v = Math.min(n, target);
  return { done: n >= target, frac: Math.min(1, n / target), progress: `${best ? 'best ' : ''}${v.toLocaleString()} of ${target.toLocaleString()}` };
}

function flag(done: boolean): GoalStatus {
  return { done, frac: done ? 1 : 0, progress: done ? 'done' : 'not yet' };
}

/** A clear is recorded in the bests: any key starting with this mode prefix (e.g. 'stage2q') that was cleared. */
function clearedBest(save: SaveData, test: (stage: string, bagel: string) => boolean): boolean {
  return Object.entries(save.best ?? {}).some(([k, b]) => {
    const [stage, bagel] = k.split(':');
    return b.cleared && test(stage, bagel);
  });
}

function crispyCleared(save: SaveData): number {
  return BUILT.filter((st) => (save.crispyClears?.[st.id] ?? 0) > 0).length;
}

/** Longest Endless run: the record, or older Endless bests ('stage1e:', 'stage1ex:'). */
function endlessBest(save: SaveData): number {
  let t = save.records?.endless ?? 0;
  for (const [k, b] of Object.entries(save.best ?? {})) if (/^stage\d+ex?:/.test(k)) t = Math.max(t, b.time);
  return t;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'nohit', name: 'Beat a stage boss without getting hit in the fight', reward: 60, icon: 'ic_crown', status: (s) => flag(!!s.noHitBoss) },
  { id: 'kills', name: 'Defeat 1,000 enemies in one run', reward: 30, icon: 'en_crumb', status: (s) => count(s.records?.kills ?? 0, 1000, true) },
  { id: 'level', name: 'Reach level 25 in one run', reward: 30, icon: 'ic_bolt', status: (s) => count(s.records?.level ?? 1, 25, true) },
  { id: 'evos', name: 'Evolve 4 weapons in one run', reward: 40, icon: 'ic_star', status: (s) => count(s.records?.evos ?? 0, 4, true) },
  { id: 'noheal', name: 'Clear a stage without picking up any healing', reward: 50, icon: 'heal', status: (s) => flag(!!s.noHealClear) },
  {
    id: 'all3',
    name: `Clear all ${BUILT.length} stages`,
    reward: 75,
    icon: 'ic_crown',
    status: (s) => count(BUILT.filter((st) => (s.stageClears?.[st.id] ?? 0) > 0).length, BUILT.length),
  },
  { id: 'crispy1', name: 'Clear a stage on Extra Crispy', reward: 60, icon: 'ic_flame', status: (s) => flag(crispyCleared(s) > 0) },
  { id: 'crispy3', name: `Clear all ${BUILT.length} stages on Extra Crispy`, reward: 150, icon: 'ic_flame', status: (s) => count(crispyCleared(s), BUILT.length) },
  {
    id: 'endless10',
    name: 'Survive 10:00 in Endless',
    reward: 60,
    icon: 'ic_clock',
    status: (s) => {
      const t = endlessBest(s);
      return { done: t >= 600, frac: Math.min(1, t / 600), progress: `best ${fmtTime(Math.min(t, 600))} of 10:00` };
    },
  },
  { id: 'endless3', name: 'Beat the boss 3 times in one Endless run', reward: 100, icon: 'ic_crown', status: (s) => count(s.records?.endlessBosses ?? 0, 3, true) },
  {
    id: 'quickall',
    name: 'Clear a Quick Run on every stage',
    reward: 40,
    icon: 'ic_bolt',
    status: (s) => count(BUILT.filter((st) => clearedBest(s, (k) => k === `${st.id}q` || k === `${st.id}qx`)).length, BUILT.length),
  },
  {
    id: 'bagels6',
    name: 'Clear a stage with each of the first 6 bagels',
    reward: 100,
    icon: 'bagel_plain',
    status: (s) => count(STARTERS.filter((id) => clearedBest(s, (_, b) => b === id)).length, STARTERS.length),
  },
];

/** Pays every challenge that is done but not paid yet. Returns the ones it paid. */
export function claimGoals(save: SaveData): ChallengeDef[] {
  const paid = new Set(save.goalsPaid ?? []);
  const out = CHALLENGES.filter((c) => !paid.has(c.id) && c.status(save).done);
  for (const c of out) {
    save.dough += c.reward;
    paid.add(c.id);
  }
  if (out.length) save.goalsPaid = [...paid];
  return out;
}

/** Challenges paid but not yet seen on the Goals page (they give the Goals button a red dot). */
export function unseenGoals(save: SaveData): string[] {
  const seen = new Set(save.goalsSeen ?? []);
  return (save.goalsPaid ?? []).filter((id) => !seen.has(id));
}
