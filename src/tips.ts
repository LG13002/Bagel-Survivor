// Onboarding: the one-time tips, the rotating hints, and the menu buttons that open as you go.
import { load, persist, type SaveData } from './save';

/** One-time tips. Each shows once per save (again after "Replay tutorial"), and never with Tips off. */
export const TIPS = {
  // The first run
  move: 'Drag anywhere to move.',
  fire: 'Your bagel fires on its own.',
  seeds: 'Grab seeds to level up.',
  cards: 'Orange is a weapon, blue is a topping. Dots show its level.',
  chest: 'Chests level up what you already own.',
  bakery: 'Spend your Dough on permanent upgrades.',
  // Later, the first time each thing comes up
  evolve: 'Max a weapon, own its topping, then open a chest.',
  bun: 'Touch the bun to pull in every seed.',
  freezer: "Ice makes you slide. Stand still too long and you'll freeze!",
  mug: 'A Warm Mug thaws you out.',
  oven: 'Glowing coils flare up. Step off them!',
  grease: 'Grease pops leave a slippery slick. Knobs block enemy shots.',
  dash: 'Flick to dash.',
  // Menu, the first time each mode is picked
  quick: 'Quick Run: the whole stage in about 3 minutes. More XP, a little less Dough.',
  endless: 'Endless: beat the boss, then see how long you can last.',
  crispy: 'Extra Crispy: tougher enemies, 1.5x Dough.',
  practice: 'Practice: starts at 2:30 with 12 level-ups. No Dough, no unlocks.',
} as const;
export type TipId = keyof typeof TIPS;

export function tipsOn(): boolean {
  return load().settings?.tips !== false;
}

/** True if this tip should still be shown. */
export function tipDue(id: TipId): boolean {
  return tipsOn() && !(load().tips ?? []).includes(id);
}

export function markTip(id: TipId): void {
  const save = load();
  if ((save.tips ?? []).includes(id)) return;
  save.tips = [...(save.tips ?? []), id];
  persist();
}

/** Settings, "Replay tutorial": every one-time tip shows again. */
export function replayTutorial(): void {
  const save = load();
  save.tips = [];
  save.settings!.tips = true;
  persist();
}

/** Short hints that take turns at the bottom of the pause and results screens. */
export const HINTS = [
  'Orange cards are weapons. Blue cards are toppings.',
  'You can carry 4 weapons and 4 toppings, each up to level 5.',
  'To evolve: max a weapon, own its topping, then open a chest.',
  'Elites drop a chest. The mini-boss always drops a golden toaster.',
  'Golden toasters give three upgrades at once.',
  'The Sticky Bun pulls in every seed on the floor. Save it for a big pile.',
  'Arrows on the edge of the screen point to chests, buns and bosses.',
  'Keep moving in circles: crumbs bunch up behind you.',
  'A gold COMBO card completes an evolution recipe.',
  'Big seeds are worth more. Pink ones are worth the most.',
  'Getting hit shoves nearby crumbs back. Use the gap to escape.',
  'Dough buys permanent upgrades in the Bakery.',
  'Quick Runs give more XP, so you level up faster.',
  'Clearing a stage opens Endless and Extra Crispy for it.',
  'Extra Crispy pays 1.5x Dough.',
  'Practice runs start at 2:30, ready to try a boss.',
  'Every bagel has its own quirk. Read it under its name on the shelf.',
  'The Goals page shows what unlocks every bagel and weapon.',
  'Challenges on the Goals page pay Dough the moment you finish them.',
  'In the Freezer, a Warm Mug heals a little and keeps frost away.',
  'In the Toaster Oven, coil flare-ups burn enemies too.',
  'Copy a backup code in Settings to keep your save safe.',
];
let hintAt = Math.floor(Math.random() * HINTS.length);

/** The next hint in the rotation, or '' with Tips off. */
export function nextHint(): string {
  if (!tipsOn()) return '';
  hintAt = (hintAt + 1) % HINTS.length;
  return HINTS[hintAt];
}

// ---------------------------------------------------------------- The menu's bottom bar

/** Bottom-bar buttons that start locked on a new save. Settings is always open. */
export type MenuItem = 'bakery' | 'goals' | 'cookbook';

/** What a locked button says when tapped. */
export const MENU_LOCK: Record<MenuItem, string> = {
  bakery: 'The Bakery opens after your first run.',
  goals: 'Goals open after your first run.',
  cookbook: 'The Cookbook opens after your first evolution.',
};

export function menuOpen(save: SaveData, id: MenuItem): boolean {
  return (save.open ?? []).includes(id);
}

/** Opens bottom-bar buttons (each gets a NEW tag until it's tapped). The caller saves. */
export function openMenu(save: SaveData, ...ids: MenuItem[]): void {
  for (const id of ids) {
    if (menuOpen(save, id)) continue;
    save.open = [...(save.open ?? []), id];
    save.fresh = [...(save.fresh ?? []), id];
  }
}

export function menuFresh(save: SaveData, id: MenuItem): boolean {
  return (save.fresh ?? []).includes(id);
}

/** A NEW button was tapped. */
export function clearFresh(save: SaveData, id: MenuItem): void {
  if (!menuFresh(save, id)) return;
  save.fresh = (save.fresh ?? []).filter((x) => x !== id);
  persist();
}
