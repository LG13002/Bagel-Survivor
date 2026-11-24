import Phaser from 'phaser';
import { COLORS, CSS, S, ZOOM } from '../config';
import { MAX_LEVEL } from '../data';
import { TIPS, markTip, tipDue, tipsOn, type TipId } from '../tips';
import { sfx } from '../sfx';
import { txt } from '../ui';
import type { GameScene } from '../scenes/GameScene';

/** Slide a tip box up into place with its soft two-note sound (the tips on panels and the menu). */
export function tipIn<T extends Phaser.GameObjects.Container>(scene: Phaser.Scene, box: T, delay = 250): T {
  const y = box.y;
  box.setAlpha(0).setY(y + 18 * S);
  scene.tweens.add({ targets: box, y, alpha: 1, delay, duration: 260, ease: 'Cubic.Out', onStart: () => sfx('tip') });
  return box;
}

/** A tip's box: cream text on a dark plate with a gold edge. Centred on x/y (device px). */
export function tipBox(scene: Phaser.Scene, x: number, y: number, text: string, size = 15): Phaser.GameObjects.Container {
  const t = txt(scene, 0, 0, text, size, CSS.cream, { stroke: false, wrap: Math.min(scene.scale.width / S - 64, 300) });
  const w = t.width + 30 * S;
  const h = t.height + 18 * S;
  const g = scene.add.graphics();
  g.fillStyle(0x24160d, 1).fillRoundedRect(-w / 2 - 2.5 * S, -h / 2 - 2.5 * S, w + 5 * S, h + 5 * S, 14 * S);
  g.fillStyle(0x2b2118, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12 * S);
  g.lineStyle(1.5 * S, COLORS.gold, 0.9).strokeRoundedRect(-w / 2 + 3 * S, -h / 2 + 3 * S, w - 6 * S, h - 6 * S, 9 * S);
  const c = scene.add.container(x, y, [g, t]);
  c.setSize(w, h);
  return c;
}

interface Trigger {
  id: TipId;
  /** The moment has come. */
  when: () => boolean;
  /** Keep the tip up until this is true (it still leaves after MAX_HOLD). */
  until?: () => boolean;
}

/** How long a tip stays, and the pause before the next one, in seconds of real time. */
const SHOW = 4.2;
const MAX_HOLD = 12;
const GAP = 0.7;
const FADE = 0.25;

/**
 * The run's one-time tips: small notes under the bagel that never pause the action, one at a time, each shown once per
 * save. Also draws the ghost thumb for the first tip and the arrow over the first seed. Made fresh for every run.
 */
export class Tutor {
  private waiting: Trigger[] = [];
  private queue: Trigger[] = [];
  private cur: { tip: Trigger; box: Phaser.GameObjects.Container; age: number; leaving: number } | null = null;
  private gfx: Phaser.GameObjects.Graphics;
  private gap = 0.8;
  private checkT = 0;
  private clock = 0;

  constructor(private g: GameScene) {
    this.gfx = g.ui(g.add.graphics().setDepth(850));
    // Practice runs start mid-stage with a full build: no teaching there.
    if (!tipsOn() || g.practice) return;
    const r = () => g.run;
    const p = g.player;
    const all: Trigger[] = [
      { id: 'move', when: () => true, until: () => Math.hypot(p.x, p.y) > 30 },
      { id: 'fire', when: () => r().kills >= 1 },
      { id: 'seeds', when: () => r().kills >= 1 && g.loot.has('xp'), until: () => r().xp > 0 || r().level > 1 },
      { id: 'dash', when: () => g.bagel.quirkId === 'dash' && g.now > 4 },
      { id: 'freezer', when: () => !!g.stage.frost && g.now > 3 },
      { id: 'mug', when: () => !!g.stage.mug && g.loot.has('mug') },
      { id: 'oven', when: () => !!g.stage.coils && g.now > 3 },
      { id: 'grease', when: () => !!g.stage.grease && g.now > 14 },
      { id: 'shelves', when: () => !!g.stage.shelves && g.now > 3 },
      { id: 'cans', when: () => g.hz.canSeen },
      { id: 'lane', when: () => g.foes.charging > 0 },
      { id: 'evolve', when: () => g.weapons.some((w) => w.level >= MAX_LEVEL && !w.evolved) },
      { id: 'bun', when: () => g.loot.has('bun') },
    ];
    this.waiting = all.filter((t) => tipDue(t.id));
  }

  /** Called every frame with real seconds passed. Tips hide (and their clocks stop) while a panel is open. */
  update(dt: number): void {
    const g = this.g;
    const cur = this.cur;
    this.gfx.clear();
    if (g.paused) {
      cur?.box.setVisible(false);
      return;
    }
    this.clock += dt;
    this.checkT -= dt;
    if (this.checkT <= 0 && this.waiting.length) {
      this.checkT = 0.2;
      for (let i = 0; i < this.waiting.length; i++) {
        const t = this.waiting[i];
        if (!t.when()) continue;
        this.waiting.splice(i--, 1);
        // Another run, or the Settings screen, may have used it up since this run began.
        if (tipDue(t.id)) this.queue.push(t);
      }
    }
    if (!cur) {
      this.gap -= dt;
      const next = this.gap <= 0 ? this.queue.shift() : undefined;
      if (next) this.show(next);
      return;
    }
    cur.box.setVisible(true);
    cur.age += dt;
    const held = cur.tip.until ? !cur.tip.until() && cur.age < MAX_HOLD : false;
    if (!cur.leaving && cur.age > (cur.tip.until ? 1.5 : SHOW) && !held) cur.leaving = cur.age;
    const out = cur.leaving ? (cur.age - cur.leaving) / FADE : 0;
    cur.box.setAlpha(Math.min(1, cur.age / FADE) * (1 - Math.min(1, out)));
    // It slides up into place as it fades in.
    const k = Math.min(1, cur.age / FADE);
    cur.box.setScale(0.85 + 0.15 * k);
    cur.box.setY(g.scale.height / 2 + 96 * S + (1 - k) * (1 - k) * 22 * S);
    if (!cur.leaving) {
      if (cur.tip.id === 'move') this.drawThumb();
      if (cur.tip.id === 'seeds') this.drawSeedArrow();
    }
    if (out >= 1) {
      cur.box.destroy();
      this.cur = null;
      this.gap = GAP;
    }
  }

  private show(tip: Trigger): void {
    const g = this.g;
    markTip(tip.id);
    const box = g.ui(tipBox(g, g.scale.width / 2, g.scale.height / 2 + 96 * S, TIPS[tip.id]).setDepth(850).setAlpha(0));
    this.cur = { tip, box, age: 0, leaving: 0 };
    sfx('tip');
  }

  /** A ghost joystick sliding side to side, low on the screen, until a thumb goes down. */
  private drawThumb(): void {
    const g = this.g;
    if (g.input.activePointer.isDown) return;
    const gfx = this.gfx;
    const W = g.scale.width;
    const H = g.scale.height;
    const x = W / 2;
    const y = Math.min(H * 0.82, H / 2 + 210 * S);
    const max = 40 * S;
    const k = Math.sin(this.clock * 2.4);
    gfx.fillStyle(0x000000, 0.2).fillCircle(x, y, max + 8 * S);
    gfx.lineStyle(3 * S, 0xfff3dc, 0.3).strokeCircle(x, y, max + 8 * S);
    gfx.fillStyle(0xfff3dc, 0.55).fillCircle(x + k * max * 0.8, y, 20 * S);
  }

  /** A bouncing arrow over the seed nearest the bagel. */
  private drawSeedArrow(): void {
    const g = this.g;
    const p = g.player;
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const it of g.loot.list) {
      if (it.kind !== 'xp') continue;
      const d = (it.x - p.x) ** 2 + (it.y - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    if (!best) return;
    const sx = g.scale.width / 2 + (best.x - p.x) * S * ZOOM;
    const sy = g.scale.height / 2 + (best.y - p.y) * S * ZOOM - (16 + 5 * Math.sin(this.clock * 7)) * S;
    const gfx = this.gfx;
    const a = 9 * S;
    gfx.fillStyle(0x24160d, 1).fillTriangle(sx - a - 3 * S, sy - a - 3 * S, sx + a + 3 * S, sy - a - 3 * S, sx, sy + 4 * S);
    gfx.fillStyle(COLORS.gold, 1).fillTriangle(sx - a, sy - a, sx + a, sy - a, sx, sy);
  }
}
