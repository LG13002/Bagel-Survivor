// Looks: hats, trails and sprinkles a bagel can wear. They change nothing about play. Most are bought with Dough in
// the Bakery's Looks tab; a few are earned. One hat, one trail and one finish (sprinkles or the gold glaze) at a time,
// on whichever bagel is playing.
import Phaser from 'phaser';
import { ctex, ink, linear, radial, rng, type Ctx } from './art';
import { CHALLENGES } from './goals';
import type { SaveData } from './save';

const TAU = Math.PI * 2;

export type LookSlot = 'hat' | 'trail' | 'sprinkle';
export const LOOK_SLOTS: LookSlot[] = ['hat', 'trail', 'sprinkle'];

export interface LookDef {
  id: string;
  slot: LookSlot;
  name: string;
  /** Dough price. Earned looks have `earn` instead. */
  cost?: number;
  earn?: { text: string; done(save: SaveData): boolean };
}

const challenge = (id: string) => (s: SaveData) => (s.goalsPaid ?? []).includes(id);

export const LOOKS: LookDef[] = [
  // Hats
  { id: 'beanie', slot: 'hat', name: 'Beanie', cost: 60 },
  { id: 'chef', slot: 'hat', name: "Chef's Hat", cost: 80 },
  { id: 'flower', slot: 'hat', name: 'Flower', cost: 90 },
  { id: 'bow', slot: 'hat', name: 'Bow', cost: 100 },
  { id: 'cowboy', slot: 'hat', name: 'Cowboy Hat', cost: 120 },
  { id: 'propeller', slot: 'hat', name: 'Propeller Cap', cost: 150 },
  { id: 'headphones', slot: 'hat', name: 'Headphones', cost: 200 },
  { id: 'party', slot: 'hat', name: 'Party Hat', earn: { text: 'Play the Daily Run 7 days in a row', done: challenge('daily7') } },
  { id: 'tophat', slot: 'hat', name: 'Top Hat', earn: { text: 'Fill every Bakery upgrade', done: challenge('bakeryfull') } },
  { id: 'crown', slot: 'hat', name: 'Crown', earn: { text: 'Beat the Stale King', done: (s) => (s.stageClears?.stage5 ?? 0) > 0 } },
  // Trails
  { id: 'crumbs', slot: 'trail', name: 'Crumbs', cost: 80 },
  { id: 'flour', slot: 'trail', name: 'Flour Puffs', cost: 100 },
  { id: 'steam', slot: 'trail', name: 'Steam', cost: 120 },
  { id: 'hearts', slot: 'trail', name: 'Hearts', cost: 150 },
  { id: 'sparkles', slot: 'trail', name: 'Sparkles', cost: 180 },
  { id: 'stars', slot: 'trail', name: 'Stars', earn: { text: 'Clear a Daily Run', done: challenge('daily1') } },
  // Sprinkles, and the gold glaze that takes their place
  { id: 'choc', slot: 'sprinkle', name: 'Chocolate', cost: 140 },
  { id: 'berry', slot: 'sprinkle', name: 'Strawberry', cost: 140 },
  { id: 'sugar', slot: 'sprinkle', name: 'Sugar', cost: 160 },
  { id: 'rainbow', slot: 'sprinkle', name: 'Rainbow', cost: 300 },
  { id: 'gold', slot: 'sprinkle', name: 'Golden Bagel', earn: { text: `Finish all ${CHALLENGES.length} challenges`, done: (s) => CHALLENGES.every((c) => (s.goalsPaid ?? []).includes(c.id)) } },
];

export const lookById = (id: string | undefined): LookDef | undefined => LOOKS.find((l) => l.id === id);

export function ownsLook(save: SaveData, l: LookDef): boolean {
  return l.earn ? l.earn.done(save) : (save.looks?.owned ?? []).includes(l.id);
}

/** What is being worn, by slot. Anything not owned (a pasted save, a look whose goal changed) counts as off. */
export function worn(save: SaveData): { hat?: string; trail?: string; sprinkle?: string } {
  const out: { hat?: string; trail?: string; sprinkle?: string } = {};
  for (const slot of LOOK_SLOTS) {
    const l = lookById(save.looks?.[slot]);
    if (l && l.slot === slot && ownsLook(save, l)) out[slot] = l.id;
  }
  return out;
}

/** Puts a look on, or takes it off if it is already on. */
export function toggleLook(save: SaveData, l: LookDef): void {
  const looks = save.looks ?? { owned: [] };
  looks[l.slot] = looks[l.slot] === l.id ? undefined : l.id;
  save.looks = looks;
}

// ---------------------------------------------------------------- Art
// Every hat and finish is drawn on an 80 by 80 square with the bagel (radius 15.5) in the middle, so a worn look
// only has to copy its bagel's position, size and spin.

/** The side of the square a look is drawn on, with the bagel (radius 15.5) in the middle. */
export const LOOK_BOX = 80;
const BOX = LOOK_BOX;
const C0 = BOX / 2;
const R0 = 15.5;
/** The top of the bagel. */
const TOP = C0 - R0;

const HATS: Record<string, (c: Ctx) => void> = {
  chef: (c) => {
    // Three puffs over a band.
    const puffs: [number, number, number][] = [[-7, -7, 6.5], [7, -7, 6.5], [0, -10.5, 7.5]];
    for (const [x, y, r] of puffs) {
      c.beginPath();
      c.arc(C0 + x, TOP + y, r, 0, TAU);
      ink(c, 4);
    }
    c.fillStyle = '#fffaf0';
    for (const [x, y, r] of puffs) {
      c.beginPath();
      c.arc(C0 + x, TOP + y, r, 0, TAU);
      c.fill();
    }
    c.beginPath();
    c.roundRect(C0 - 10, TOP - 4, 20, 7.5, 2);
    c.fillStyle = '#f1e6d2';
    c.fill();
    ink(c, 2);
    c.strokeStyle = 'rgba(160,130,90,0.5)';
    c.lineWidth = 1;
    for (const x of [-4.5, 0, 4.5]) {
      c.beginPath();
      c.moveTo(C0 + x, TOP - 2);
      c.lineTo(C0 + x, TOP + 1.5);
      c.stroke();
    }
  },
  beanie: (c) => {
    c.beginPath();
    c.arc(C0, TOP + 3.5, 12, Math.PI, 0);
    c.closePath();
    c.fillStyle = linear(c, 0, TOP - 9, 0, TOP + 4, [[0, '#f0705a'], [1, '#c8402e']]);
    c.fill();
    ink(c, 2);
    c.beginPath();
    c.roundRect(C0 - 13.5, TOP - 0.5, 27, 6, 3);
    c.fillStyle = '#fff3dc';
    c.fill();
    ink(c, 2);
    c.strokeStyle = 'rgba(120,90,60,0.55)';
    c.lineWidth = 1;
    for (let x = -10; x <= 10; x += 4) {
      c.beginPath();
      c.moveTo(C0 + x, TOP + 1);
      c.lineTo(C0 + x, TOP + 4);
      c.stroke();
    }
    c.beginPath();
    c.arc(C0, TOP - 9.5, 4, 0, TAU);
    c.fillStyle = '#fff3dc';
    c.fill();
    ink(c, 2);
  },
  crown: (c) => {
    c.beginPath();
    c.moveTo(C0 - 11, TOP + 3.5);
    c.lineTo(C0 - 12.5, TOP - 9);
    c.lineTo(C0 - 6, TOP - 3.5);
    c.lineTo(C0, TOP - 12.5);
    c.lineTo(C0 + 6, TOP - 3.5);
    c.lineTo(C0 + 12.5, TOP - 9);
    c.lineTo(C0 + 11, TOP + 3.5);
    c.closePath();
    c.fillStyle = linear(c, 0, TOP - 12, 0, TOP + 4, [[0, '#ffe58a'], [1, '#e8a52c']]);
    c.fill();
    ink(c, 2);
    for (const [x, y, col] of [[-12.5, -9, '#e0533d'], [0, -12.5, '#6cc7f0'], [12.5, -9, '#e0533d']] as [number, number, string][]) {
      c.beginPath();
      c.arc(C0 + x, TOP + y, 2.1, 0, TAU);
      c.fillStyle = col;
      c.fill();
      ink(c, 1.4);
    }
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(C0 - 9, TOP - 0.5, 18, 1.6);
  },
  party: (c) => {
    c.save();
    c.translate(C0 + 2, TOP + 2);
    c.rotate(0.14);
    c.beginPath();
    c.moveTo(-8.5, 1);
    c.lineTo(0, -19);
    c.lineTo(8.5, 1);
    c.closePath();
    c.fillStyle = '#f2b84b';
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = '#e0533d';
    c.lineWidth = 3;
    for (let y = -17; y < 4; y += 6.5) {
      c.beginPath();
      c.moveTo(-10, y + 3);
      c.lineTo(10, y - 2);
      c.stroke();
    }
    c.restore();
    c.beginPath();
    c.moveTo(-8.5, 1);
    c.lineTo(0, -19);
    c.lineTo(8.5, 1);
    c.closePath();
    ink(c, 2);
    c.beginPath();
    c.arc(0, -19.5, 3.2, 0, TAU);
    c.fillStyle = '#fff3dc';
    c.fill();
    ink(c, 1.8);
    c.restore();
  },
  propeller: (c) => {
    c.beginPath();
    c.arc(C0, TOP + 3.5, 10.5, Math.PI, 0);
    c.closePath();
    c.fillStyle = '#e0533d';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = '#f2b84b';
    c.fillRect(C0 - 3.5, TOP - 8, 7, 12);
    c.restore();
    c.beginPath();
    c.arc(C0, TOP + 3.5, 10.5, Math.PI, 0);
    c.closePath();
    ink(c, 2);
    // Brim
    c.beginPath();
    c.roundRect(C0 - 4, TOP + 0.5, 19, 4, 2);
    c.fillStyle = '#c8402e';
    c.fill();
    ink(c, 1.8);
    // Stalk and blades
    c.beginPath();
    c.moveTo(C0, TOP - 7);
    c.lineTo(C0, TOP - 12);
    ink(c, 2.4);
    for (const d of [-1, 1]) {
      c.beginPath();
      c.ellipse(C0 + d * 6, TOP - 12.5, 6, 2.3, d * -0.18, 0, TAU);
      c.fillStyle = d < 0 ? '#fff3dc' : '#f2b84b';
      c.fill();
      ink(c, 1.6);
    }
    c.beginPath();
    c.arc(C0, TOP - 12.5, 1.8, 0, TAU);
    c.fillStyle = '#24160d';
    c.fill();
  },
  cowboy: (c) => {
    // Brim, curled up at the ends.
    c.beginPath();
    c.moveTo(C0 - 19, TOP - 2);
    c.quadraticCurveTo(C0 - 10, TOP + 6, C0, TOP + 4);
    c.quadraticCurveTo(C0 + 10, TOP + 6, C0 + 19, TOP - 2);
    c.quadraticCurveTo(C0 + 10, TOP + 1, C0, TOP);
    c.quadraticCurveTo(C0 - 10, TOP + 1, C0 - 19, TOP - 2);
    c.closePath();
    c.fillStyle = '#9a6a3c';
    c.fill();
    ink(c, 2);
    // Crown with a pinch.
    c.beginPath();
    c.moveTo(C0 - 9, TOP + 1.5);
    c.lineTo(C0 - 8, TOP - 10);
    c.quadraticCurveTo(C0 - 4, TOP - 13.5, C0, TOP - 9.5);
    c.quadraticCurveTo(C0 + 4, TOP - 13.5, C0 + 8, TOP - 10);
    c.lineTo(C0 + 9, TOP + 1.5);
    c.closePath();
    c.fillStyle = linear(c, 0, TOP - 13, 0, TOP + 2, [[0, '#b98356'], [1, '#8a5d3b']]);
    c.fill();
    ink(c, 2);
    c.beginPath();
    c.moveTo(C0 - 8.8, TOP - 1.8);
    c.lineTo(C0 + 8.8, TOP - 1.8);
    ink(c, 2.6, '#5e3c22');
  },
  bow: (c) => {
    const y = TOP - 2.5;
    for (const d of [-1, 1]) {
      c.beginPath();
      c.moveTo(C0, y);
      c.quadraticCurveTo(C0 + d * 6, y - 9, C0 + d * 12, y - 6);
      c.quadraticCurveTo(C0 + d * 13.5, y, C0 + d * 12, y + 6);
      c.quadraticCurveTo(C0 + d * 6, y + 7, C0, y);
      c.closePath();
      c.fillStyle = linear(c, 0, y - 8, 0, y + 7, [[0, '#ff9ab5'], [1, '#e8557e']]);
      c.fill();
      ink(c, 2);
    }
    c.beginPath();
    c.roundRect(C0 - 3, y - 3.5, 6, 7, 2.2);
    c.fillStyle = '#ff7a9c';
    c.fill();
    ink(c, 2);
  },
  tophat: (c) => {
    c.beginPath();
    c.roundRect(C0 - 8.5, TOP - 15, 17, 17, 1.5);
    c.fillStyle = linear(c, C0 - 9, 0, C0 + 9, 0, [[0, '#4a4350'], [0.4, '#2e2933'], [1, '#1f1b24']]);
    c.fill();
    ink(c, 2);
    c.fillStyle = '#e0533d';
    c.fillRect(C0 - 7.5, TOP - 4.5, 15, 4);
    c.beginPath();
    c.roundRect(C0 - 14, TOP + 0.5, 28, 4.5, 2.2);
    c.fillStyle = '#2e2933';
    c.fill();
    ink(c, 2);
  },
  flower: (c) => {
    const x = C0 + 10;
    const y = TOP + 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      c.beginPath();
      c.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 3, a, 0, TAU);
      c.fillStyle = '#fff3dc';
      c.fill();
      ink(c, 1.6);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      c.beginPath();
      c.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.2, 2.2, a, 0, TAU);
      c.fillStyle = '#fff3dc';
      c.fill();
    }
    c.beginPath();
    c.arc(x, y, 3.4, 0, TAU);
    c.fillStyle = '#f2b84b';
    c.fill();
    ink(c, 1.6);
  },
  headphones: (c) => {
    c.beginPath();
    c.arc(C0, C0 - 1, R0 + 2.5, Math.PI * 1.04, Math.PI * 1.96);
    ink(c, 5.5);
    c.beginPath();
    c.arc(C0, C0 - 1, R0 + 2.5, Math.PI * 1.04, Math.PI * 1.96);
    ink(c, 2.6, '#56506a');
    for (const d of [-1, 1]) {
      c.beginPath();
      c.roundRect(C0 + d * (R0 + 2) - 4, C0 - 6.5, 8, 13, 3.5);
      c.fillStyle = '#e0533d';
      c.fill();
      ink(c, 2);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(C0 + d * (R0 + 2) - 1.8, C0 - 4, 1.6, 5);
    }
  },
};

const SPRINKLES: Record<string, string[]> = {
  rainbow: ['#e0533d', '#f2b84b', '#fff3dc', '#ff7ab8', '#a56be0', '#ff9a3c'],
  berry: ['#ff7a9c', '#ffb3c6', '#e8557e'],
  choc: ['#5a3420', '#7a4a2c', '#3d2414'],
  sugar: ['#ffffff', '#fff3dc', '#f6e6c8'],
};

function drawSprinkles(c: Ctx, cols: string[]): void {
  const rand = rng(77);
  for (let i = 0; i < 26; i++) {
    const a = rand() * TAU;
    const d = R0 * (0.5 + rand() * 0.36);
    const x = C0 + Math.cos(a) * d;
    const y = C0 + Math.sin(a) * d;
    const t = rand() * Math.PI;
    const dx = Math.cos(t) * 1.7;
    const dy = Math.sin(t) * 1.7;
    c.beginPath();
    c.moveTo(x - dx, y - dy);
    c.lineTo(x + dx, y + dy);
    ink(c, 2.2);
    c.beginPath();
    c.moveTo(x - dx, y - dy);
    c.lineTo(x + dx, y + dy);
    ink(c, 1.3, cols[i % cols.length]);
  }
}

/** The Golden Bagel: a gold glaze over the whole ring, inside the ink outline, with a few glints. */
function drawGold(c: Ctx): void {
  const hole = R0 * 0.36;
  c.beginPath();
  c.arc(C0, C0, R0 - 1.1, 0, TAU);
  c.moveTo(C0 + hole + 1.1, C0);
  c.arc(C0, C0, hole + 1.1, 0, TAU, true);
  c.fillStyle = radial(c, C0, C0, R0, [[0, '#fff6b8'], [0.45, '#ffd24a'], [1, '#d6941c']]);
  c.globalAlpha = 0.9;
  c.fill('evenodd');
  c.globalAlpha = 1;
  c.beginPath();
  c.arc(C0, C0, R0 * 0.72, Math.PI * 1.1, Math.PI * 1.6);
  ink(c, R0 * 0.13, 'rgba(255,255,255,0.75)');
  c.fillStyle = '#ffffff';
  for (const [x, y, s] of [[8, 6, 2.2], [-10, 8, 1.6], [5, -11, 1.4]] as [number, number, number][]) {
    c.beginPath();
    c.moveTo(C0 + x, C0 + y - s);
    c.quadraticCurveTo(C0 + x, C0 + y, C0 + x + s, C0 + y);
    c.quadraticCurveTo(C0 + x, C0 + y, C0 + x, C0 + y + s);
    c.quadraticCurveTo(C0 + x, C0 + y, C0 + x - s, C0 + y);
    c.quadraticCurveTo(C0 + x, C0 + y, C0 + x, C0 + y - s);
    c.fill();
  }
}

/** The picture of a hat or finish, for a bagel drawn with radius `r` (logical px). Returns its texture key. */
export function lookTex(scene: Phaser.Scene, id: string, r = R0): string {
  const key = `look_${id}_${Math.round(r * 10)}`;
  const k = r / R0;
  ctex(scene, key, BOX * k, BOX * k, (c) => {
    c.scale(k, k);
    if (HATS[id]) {
      // Hats that sit on top ride a little high, so the eyes stay clear.
      if (id !== 'headphones' && id !== 'flower') c.translate(0, -5);
      HATS[id](c);
    }
    else if (id === 'gold') drawGold(c);
    else if (SPRINKLES[id]) drawSprinkles(c, SPRINKLES[id]);
  });
  return key;
}

/** Small pictures the trails are made of, and the calendar and trophy icons. Safe to call again. */
export function makeLookTextures(scene: Phaser.Scene): void {
  ctex(scene, 'lk_heart', 12, 12, (c) => {
    c.beginPath();
    c.moveTo(6, 10.2);
    c.bezierCurveTo(-1.5, 5.5, 1.5, 0.6, 6, 3.8);
    c.bezierCurveTo(10.5, 0.6, 13.5, 5.5, 6, 10.2);
    c.fillStyle = '#ff7a9c';
    c.fill();
    ink(c, 1.3);
  });
  ctex(scene, 'lk_star', 12, 12, (c) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const d = i % 2 ? 2.3 : 5;
      c.lineTo(6 + Math.cos(a) * d, 6 + Math.sin(a) * d);
    }
    c.closePath();
    c.fillStyle = '#ffd95a';
    c.fill();
    ink(c, 1.3);
  });
  ctex(scene, 'lk_puff', 16, 16, (c) => {
    const g = c.createRadialGradient(8, 8, 1, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 16);
  });
  ctex(scene, 'lk_crumb', 7, 6, (c) => {
    c.beginPath();
    c.roundRect(1, 1, 5, 4, 1.4);
    c.fillStyle = '#c8935a';
    c.fill();
    ink(c, 1.1);
  });
  ctex(scene, 'lk_spark', 12, 12, (c) => {
    c.beginPath();
    c.moveTo(6, 0.5);
    c.quadraticCurveTo(6, 6, 11.5, 6);
    c.quadraticCurveTo(6, 6, 6, 11.5);
    c.quadraticCurveTo(6, 6, 0.5, 6);
    c.quadraticCurveTo(6, 6, 6, 0.5);
    c.fillStyle = '#fff2b0';
    c.fill();
  });
  // A calendar page: the Daily Run's button.
  ctex(scene, 'ic_cal', 36, 36, (c) => {
    c.beginPath();
    c.roundRect(5, 7, 26, 25, 5);
    c.fillStyle = '#fff3dc';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = '#e0533d';
    c.fillRect(5, 7, 26, 9);
    c.restore();
    c.beginPath();
    c.roundRect(5, 7, 26, 25, 5);
    ink(c, 2.4);
    for (const x of [12, 24]) {
      c.beginPath();
      c.moveTo(x, 4.5);
      c.lineTo(x, 10);
      ink(c, 3);
    }
    // A little bagel where the date would be.
    c.beginPath();
    c.arc(18, 23.5, 5.2, 0, TAU);
    c.fillStyle = '#e8a852';
    c.fill();
    ink(c, 1.8);
    c.beginPath();
    c.arc(18, 23.5, 1.6, 0, TAU);
    c.fillStyle = '#fff3dc';
    c.fill();
    ink(c, 1.4);
  });
  // The Golden Bagel trophy.
  ctex(scene, 'ic_goldbagel', 36, 36, (c) => {
    c.beginPath();
    c.arc(18, 18, 12.5, 0, TAU);
    c.moveTo(22.5, 18);
    c.arc(18, 18, 4.5, 0, TAU, true);
    c.fillStyle = radial(c, 18, 18, 12.5, [[0, '#fff6b8'], [0.45, '#ffd24a'], [1, '#d6941c']]);
    c.fill('evenodd');
    ink(c, 2.4);
    c.beginPath();
    c.arc(18, 18, 9, Math.PI * 1.1, Math.PI * 1.6);
    ink(c, 1.8, 'rgba(255,255,255,0.8)');
  });
}

// ---------------------------------------------------------------- Wearing

/**
 * A worn hat or finish: one picture that follows a bagel picture's position, squash, spin and fade every frame
 * (the way `Face` does). Make the finish before the bagel's `Face` and the hat after it, so they stack in that order.
 */
export class Wear {
  private im: Phaser.GameObjects.Image | null = null;

  /**
   * @param r the bagel's radius in the target picture, in logical px (15.5, 62 for the big ones)
   * @param add puts the picture where it belongs (a layer or a container), above the bagel
   */
  constructor(private scene: Phaser.Scene, private target: Phaser.GameObjects.Image, r: number, id: string | undefined, add: (o: Phaser.GameObjects.Image) => void) {
    if (!id) return;
    this.im = scene.add.image(0, 0, lookTex(scene, id, r));
    add(this.im);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    target.once(Phaser.GameObjects.Events.DESTROY, () => this.destroy());
    this.sync();
  }

  setDepth(d: number): this {
    this.im?.setDepth(d);
    return this;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    this.im?.destroy();
    this.im = null;
  }

  private sync(): void {
    const t = this.target;
    if (!this.im || !t.scene) return;
    this.im.setVisible(t.visible && t.alpha > 0.02).setPosition(t.x, t.y).setScale(t.scaleX, t.scaleY).setRotation(t.rotation).setAlpha(t.alpha);
  }
}

/** One puff of a trail: which picture, and how it moves. Used by the run and by the Looks tab's preview. */
export interface TrailBit {
  tex: string;
  tint?: number;
  /** Start and end scale (1 = the picture's own size), drift in px, spin in radians, life in ms, start alpha. */
  s0: number;
  s1: number;
  dx: number;
  dy: number;
  spin: number;
  ms: number;
  alpha: number;
}

/** Seconds between a trail's puffs. */
export const TRAIL_EVERY: Record<string, number> = { flour: 0.07, sparkles: 0.09, hearts: 0.16, crumbs: 0.08, steam: 0.09, stars: 0.14 };

export function trailBit(id: string): TrailBit {
  const j = () => Math.random() - 0.5;
  switch (id) {
    case 'flour':
      return { tex: 'lk_puff', tint: 0xfff0d0, s0: 0.6, s1: 1.5, dx: j() * 10, dy: j() * 8 - 3, spin: 0, ms: 520, alpha: 0.6 };
    case 'sparkles':
      return { tex: 'lk_spark', s0: 0.9, s1: 0.1, dx: j() * 18, dy: j() * 18, spin: 1.5, ms: 420, alpha: 1 };
    case 'hearts':
      return { tex: 'lk_heart', s0: 0.7, s1: 1.1, dx: j() * 10, dy: -16, spin: j() * 0.6, ms: 620, alpha: 0.95 };
    case 'crumbs':
      return { tex: 'lk_crumb', s0: 1, s1: 0.6, dx: j() * 16, dy: 5 + Math.random() * 5, spin: j() * 5, ms: 460, alpha: 1 };
    case 'steam':
      return { tex: 'lk_puff', tint: 0xc9c4bc, s0: 0.5, s1: 1.3, dx: j() * 8, dy: -20, spin: 0, ms: 640, alpha: 0.5 };
    default:
      return { tex: 'lk_star', s0: 0.9, s1: 0.4, dx: j() * 14, dy: j() * 14, spin: 3 * (Math.random() < 0.5 ? -1 : 1), ms: 560, alpha: 1 };
  }
}
