import Phaser from 'phaser';
import { S } from '../config';
import { rng } from '../art';
import { COUNTER_PROPS, FREEZER_PROPS, OVEN_PROPS, type PropDef } from '../floors';
import type { StageDef } from '../data';
import type { GameScene } from '../scenes/GameScene';

const PROP_SETS: Record<StageDef['props'], PropDef[]> = { counter: COUNTER_PROPS, freezer: FREEZER_PROPS, oven: OVEN_PROPS };
/** Floor chunk size: props, ice patches and rack posts are seeded per chunk. */
const CHUNK = 384;
/** Rack post (oven knob) radius. */
export const POST_R = 17;

export interface IcePatch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  imgs: Phaser.GameObjects.Image[];
}
interface Post {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
}

/**
 * What lies on the floor around you: props, the Freezer's ice patches and the oven's rack posts. Everything is seeded
 * by its chunk's coordinates, so the same spot always looks the same. Chunks near the camera exist; far ones are
 * dropped. Made fresh for every run.
 */
export class Floor {
  /** Every rack post near the camera (solid: you and enemies slide around them; they block enemy shots). */
  posts: Post[] = [];
  private center = '';
  private props = new Map<string, Phaser.GameObjects.Image[]>();
  private ice = new Map<string, IcePatch[]>();
  private postChunks = new Map<string, Post[]>();

  constructor(private g: GameScene) {}

  /** Make the chunks around the player and drop far ones (only when the player crosses into a new chunk). */
  update(): void {
    const C = CHUNK;
    const g = this.g;
    const p = g.player;
    const st = g.stage;
    const rx = Math.ceil((g.viewW() / 2 + 160) / C);
    const ry = Math.ceil((g.viewH() / 2 + 160) / C);
    const pcx = Math.floor(p.x / C);
    const pcy = Math.floor(p.y / C);
    const key0 = `${pcx},${pcy}`;
    if (this.center === key0) return;
    this.center = key0;
    const keep = new Set<string>();
    const props = PROP_SETS[st.props];
    const total = props.reduce((a, d) => a + d.weight, 0);
    for (let cx = pcx - rx; cx <= pcx + rx; cx++)
      for (let cy = pcy - ry; cy <= pcy + ry; cy++) {
        const key = `${cx},${cy}`;
        keep.add(key);
        if (this.props.has(key)) continue;
        const h = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0;
        const rand = rng((h % 2147483646) + 1);
        rand();
        rand();
        const n = rand() < 0.35 ? 2 : 3;
        const list: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < n; i++) {
          let r = rand() * total;
          let def = props[0];
          for (const d of props) {
            r -= d.weight;
            if (r <= 0) {
              def = d;
              break;
            }
          }
          // Each prop gets its own horizontal band of the chunk so they rarely overlap.
          const x = (cx + 0.15 + rand() * 0.7) * C;
          const y = (cy + (i + 0.2 + rand() * 0.6) / n) * C;
          const im = g.img(def.key, x, y, 1);
          im.setRotation(def.spin ? rand() * Math.PI * 2 : (rand() - 0.5) * 0.4);
          list.push(im);
        }
        this.props.set(key, list);
        if (st.ice) this.ice.set(key, this.makeIce(cx, cy));
        if (st.posts) this.postChunks.set(key, this.makePosts(cx, cy));
      }
    for (const [key, list] of this.props)
      if (!keep.has(key)) {
        for (const im of list) im.destroy();
        this.props.delete(key);
        for (const ip of this.ice.get(key) ?? []) {
          // The twinkles loop forever: stop their animations along with them.
          g.tweens.killTweensOf(ip.imgs);
          ip.imgs.forEach((im) => im.destroy());
        }
        this.ice.delete(key);
        for (const po of this.postChunks.get(key) ?? []) po.img.destroy();
        this.postChunks.delete(key);
      }
    if (st.posts) this.posts = [...this.postChunks.values()].flat();
  }

  /** Is this point on one of the floor's ice patches? */
  onIce(x: number, y: number): boolean {
    for (const list of this.ice.values()) if (inPatch(list, x, y)) return true;
    return false;
  }

  /** Slide something out of any rack post it overlaps. */
  pushOut(o: { x: number; y: number }, r: number): void {
    for (const po of this.posts) {
      const dx = o.x - po.x;
      const dy = o.y - po.y;
      const rr = r + POST_R;
      if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01;
      o.x = po.x + (dx / d) * rr;
      o.y = po.y + (dy / d) * rr;
    }
  }

  /** Seeded rack posts (drawn as oven knobs) for one floor chunk: about 1 on average, never near where a run starts. */
  private makePosts(cx: number, cy: number): Post[] {
    const C = CHUNK;
    const h = (Math.imul(cx, 49979687) ^ Math.imul(cy, 1500450271)) >>> 0;
    const rand = rng((h % 2147483646) + 1);
    rand();
    const r = rand();
    const n = r < 0.2 ? 2 : r < 0.8 ? 1 : 0;
    const out: Post[] = [];
    for (let i = 0; i < n; i++) {
      const x = (cx + 0.15 + rand() * 0.7) * C;
      const y = (cy + (i + 0.2 + rand() * 0.6) / Math.max(1, n)) * C;
      if (Math.hypot(x, y) < 240) continue;
      out.push({ x, y, img: this.g.img('post', x, y, 29) });
    }
    return out;
  }

  /** Seeded ice patches for one floor chunk: 0 to 2, never near where a run starts. */
  private makeIce(cx: number, cy: number): IcePatch[] {
    const C = CHUNK;
    const g = this.g;
    const h = (Math.imul(cx, 83492791) ^ Math.imul(cy, 2971215073)) >>> 0;
    const rand = rng((h % 2147483646) + 1);
    rand();
    const n = rand() < 0.45 ? 1 : rand() < 0.3 ? 2 : 0;
    const out: IcePatch[] = [];
    for (let i = 0; i < n; i++) {
      const rx = 80 + rand() * 60;
      const ry = rx * (0.6 + rand() * 0.2);
      const x = (cx + 0.2 + rand() * 0.6) * C;
      const y = (cy + 0.2 + rand() * 0.6) * C;
      if (Math.hypot(x, y) < 170 + rx) continue;
      const base = g.img('ice_patch', x, y, 1.5);
      base.setScale((rx * 2) / 200 / S, (ry * 2) / 120 / S);
      const imgs = [base];
      for (let k = 0; k < 3; k++) {
        const tw = g.img('twinkle', x + (rand() - 0.5) * rx * 1.2, y + (rand() - 0.5) * ry * 1.1, 1.6);
        tw.setScale(0.2 / S);
        g.tweens.add({ targets: tw, scale: { from: 0.2 / S, to: 1.1 / S }, alpha: { from: 0.3, to: 1 }, duration: 700 + k * 230, yoyo: true, repeat: -1, delay: k * 300, ease: 'Sine.InOut' });
        imgs.push(tw);
      }
      out.push({ x, y, rx, ry, imgs });
    }
    return out;
  }
}

/** Is the point inside any of these ice patches (ellipses)? */
export function inPatch(list: IcePatch[], x: number, y: number): boolean {
  for (const ip of list) {
    const dx = (x - ip.x) / ip.rx;
    const dy = (y - ip.y) / ip.ry;
    if (dx * dx + dy * dy < 1) return true;
  }
  return false;
}
