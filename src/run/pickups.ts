import type { Pickup } from '../entities';
import { S } from '../config';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';

/** A Warm Mug keeps frost away for this long. */
const MUG_SAFE = 5;
/** Seconds a dropped seed spends hopping out. */
const HOP = 0.26;

/**
 * Things on the floor to pick up: seeds (XP), coins, heals, chests, the Sticky Bun and the Warm Mug. Made fresh for
 * every run.
 */
export class Pickups {
  list: Pickup[] = [];

  constructor(private g: GameScene) {}

  /** A seed worth `value` XP. With more than 300 on the floor it merges into the nearest seed instead. */
  dropXp(x: number, y: number, value: number): void {
    if (this.list.length > 300) {
      // Too many seeds on the floor: fold this one into the nearest existing seed.
      let g: Pickup | null = null;
      let bd = Infinity;
      for (const p of this.list) {
        if (p.kind !== 'xp' || p.magnet) continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) {
          bd = d;
          g = p;
        }
      }
      if (g) {
        g.value += value;
        g.sprite.setTexture(gemTex(g.value));
        return;
      }
    }
    this.drop('xp', x, y, value);
  }

  drop(kind: Pickup['kind'], x: number, y: number, value: number, land = true): void {
    const g = this.g;
    // Nothing lands inside a shelf: it slides out to the nearest open floor.
    if (g.floor.walls.length) {
      const o = { x, y };
      g.floor.pushOut(o, kind === 'xp' || kind === 'coin' || kind === 'heal' ? 8 : 16);
      x = o.x;
      y = o.y;
    }
    const tex = kind === 'xp' ? gemTex(value) : kind;
    const isChest = kind === 'chest' || kind === 'goldchest' || kind === 'bun' || kind === 'mug';
    const sprite = g.img(tex, x, y, isChest ? 12 : 10);
    const base = sprite.scaleX;
    if (isChest) {
      // Chests, buns and mugs fall in and land with a bounce, then bob.
      if (land) {
        sprite.y = y - 46;
        sprite.setScale(base * 0.85, base * 1.2);
        g.tweens.add({ targets: sprite, scaleX: base, scaleY: base, duration: 420, ease: 'Bounce.Out' });
        g.tweens.add({ targets: sprite, y, duration: 420, ease: 'Bounce.Out', onComplete: () => this.bob(sprite, kind, y, base) });
      } else this.bob(sprite, kind, y, base);
    }
    const it: Pickup = { sprite, x, y, kind, value, magnet: false };
    if (!isChest && land) {
      // Seeds, coins and hearts hop out of what dropped them.
      it.hop = HOP;
      sprite.setScale(base * 0.5);
    }
    this.list.push(it);
  }

  private bob(sprite: Pickup['sprite'], kind: Pickup['kind'], y: number, base: number): void {
    if (!sprite.scene) return;
    this.g.tweens.add({ targets: sprite, y: y - 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    if (kind === 'bun' || kind === 'mug') this.g.tweens.add({ targets: sprite, scale: base * 1.15, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  has(kind: Pickup['kind']): boolean {
    return this.list.some((it) => it.kind === kind);
  }

  update(dt: number): void {
    const g = this.g;
    const p = g.player;
    const mag = g.stats.magnet;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const d = Math.hypot(dx, dy) || 1;
      if (it.kind === 'chest' || it.kind === 'goldchest' || it.kind === 'bun') {
        // Chests drift to you; the Sticky Bun waits until you walk onto it.
        if (d < 70 && it.kind !== 'bun') {
          it.x += (dx / d) * 200 * dt;
          it.y += (dy / d) * 200 * dt;
          it.sprite.x = it.x;
        }
        // One panel at a time: a second chest touched in the same instant waits until the first panel closes.
        if (d < 24 && !g.paused) this.collect(it, i);
        continue;
      }
      if (it.hop) {
        it.hop = Math.max(0, it.hop - dt);
        const k = 1 - it.hop / HOP;
        it.sprite.y = it.y - Math.sin(Math.PI * k) * 13;
        it.sprite.setScale((0.5 + 0.5 * k) / S);
      }
      if (!it.magnet && d < mag) it.magnet = true;
      if (it.magnet) {
        if (it.hop) {
          it.hop = 0;
          it.sprite.setScale(1 / S);
        }
        const sp = 260 + Math.max(0, 420 - d * 2);
        it.x += (dx / d) * sp * dt;
        it.y += (dy / d) * sp * dt;
        it.sprite.setPosition(it.x, it.y);
        if (d < p.radius + 4) this.collect(it, i);
      }
    }
  }

  /** The Sticky Bun: pull every seed and coin on the floor to the player. */
  private vacuum(): void {
    for (const p of this.list) if (p.kind === 'xp' || p.kind === 'coin') p.magnet = true;
  }

  private collect(it: Pickup, idx: number): void {
    const g = this.g;
    const run = g.run;
    const p = g.player;
    // Chests, buns and mugs bob forever: stop that along with the sprite.
    if (it.kind !== 'xp' && it.kind !== 'coin' && it.kind !== 'heal') g.tweens.killTweensOf(it.sprite);
    it.sprite.destroy();
    this.list.splice(idx, 1);
    switch (it.kind) {
      case 'xp':
        g.gainXp(it.value);
        sfx('xp');
        break;
      case 'coin':
        run.coins += 1;
        run.coinPickups++;
        break;
      case 'heal':
        run.healsTaken++;
        p.hp = Math.min(g.stats.maxHp, p.hp + it.value);
        g.effects.burst(p.x, p.y, 0x7fbf4d, 8, 30);
        break;
      case 'chest':
        g.panels.openChest(false);
        break;
      case 'goldchest':
        g.panels.openChest(true);
        break;
      case 'mug':
        // Warms you up: clears frost, a small heal (not counted as a heal for unlock goals), a few seconds frost-free.
        p.hp = Math.min(g.stats.maxHp, p.hp + 10);
        run.frost = 0;
        run.frozen = false;
        run.stillT = 0;
        p.sprite.clearTint();
        run.mugUntil = g.now + MUG_SAFE;
        sfx('sip');
        run.runMugs++;
        g.effects.burst(p.x, p.y, 0xff9a5c, 10, 40);
        break;
      case 'bun':
        this.vacuum();
        sfx('swoosh');
        sfx('coin');
        g.effects.burst(p.x, p.y, 0xf0a24a, 14, 60);
        break;
    }
  }
}

function gemTex(v: number): string {
  return v <= 2 ? 'gem1' : v <= 9 ? 'gem2' : 'gem3';
}
