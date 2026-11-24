import Phaser from 'phaser';
import { S } from '../config';
import { rng } from '../art';
import { COUNTER_PROPS, FREEZER_PROPS, OVEN_PROPS, type PropDef } from '../floors';
import { PANTRY_PROPS } from '../pantry';
import { BIN_PROPS } from '../breadbin';
import type { StageDef } from '../data';
import type { GameScene } from '../scenes/GameScene';

const PROP_SETS: Record<StageDef['props'], PropDef[]> = { counter: COUNTER_PROPS, freezer: FREEZER_PROPS, oven: OVEN_PROPS, pantry: PANTRY_PROPS, bin: BIN_PROPS };
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
/** A solid box: a pantry shelf, or a short-lived wall (a noodle knot, Mother Dough's dough). Centre and half sizes. */
export interface Wall {
  x: number;
  y: number;
  hw: number;
  hh: number;
  img: Phaser.GameObjects.Image;
  /** Short-lived walls: seconds left, and seconds of warning before it turns solid. */
  life?: number;
  warn?: number;
}
/** Shelf size (long side, short side), and the flow field's cell size and reach. */
/** Shelves are laid out on their own grid of cells this size, one or two to a cell. */
export const SHELF_CELL = 288;
export const SHELF_LEN = 176;
export const SHELF_W = 40;
const FCELL = 32;
const FW = 30;
const FH = 44;
const FLOW_EVERY = 0.2;

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
  /** Every solid wall near the camera: the Pantry's shelves plus any short-lived walls that have turned solid. */
  walls: Wall[] = [];
  /** Short-lived walls (still warning, or solid). */
  temps: Wall[] = [];
  private shelfChunks = new Map<string, Wall[]>();
  private shelfCenter = '';
  // The flow field: steps to the player for every cell near them, so enemies can walk around walls.
  private fdist = new Int16Array(FW * FH);
  private flos = new Int8Array(FW * FH);
  private fx0 = 0;
  private fy0 = 0;
  private flowT = 0;
  private queue = new Int32Array(FW * FH);

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
    if (st.shelves) this.updateShelves();
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

  /** Make the shelf cells around the player and drop far ones. */
  private updateShelves(): void {
    const C = SHELF_CELL;
    const g = this.g;
    const p = g.player;
    const pcx = Math.floor(p.x / C);
    const pcy = Math.floor(p.y / C);
    const key0 = `${pcx},${pcy}`;
    if (this.shelfCenter === key0) return;
    this.shelfCenter = key0;
    const rx = Math.ceil((g.viewW() / 2 + 200) / C);
    const ry = Math.ceil((g.viewH() / 2 + 200) / C);
    const keep = new Set<string>();
    for (let cx = pcx - rx; cx <= pcx + rx; cx++)
      for (let cy = pcy - ry; cy <= pcy + ry; cy++) {
        const key = `${cx},${cy}`;
        keep.add(key);
        if (!this.shelfChunks.has(key)) this.shelfChunks.set(key, this.makeShelves(cx, cy));
      }
    for (const [key, list] of this.shelfChunks)
      if (!keep.has(key)) {
        for (const w of list) w.img.destroy();
        this.shelfChunks.delete(key);
      }
    this.gatherWalls();
  }

  private gatherWalls(): void {
    this.walls = [...this.shelfChunks.values()].flat();
    for (const w of this.temps) if (!w.warn) this.walls.push(w);
    this.flowT = 0;
  }

  /** Short-lived walls count down, turn solid when their warning ends, and melt away. Also keeps the flow field fresh. */
  tick(dt: number): void {
    const g = this.g;
    if (this.temps.length) {
      let changed = false;
      for (let i = this.temps.length - 1; i >= 0; i--) {
        const w = this.temps[i];
        if (w.warn) {
          w.warn -= dt;
          w.img.setAlpha(0.35 + 0.2 * Math.sin(g.now * 22));
          if (w.warn <= 0) {
            w.warn = 0;
            w.img.setAlpha(1);
            changed = true;
            // Anything standing where it lands is nudged out by the usual push.
            g.effects.burst(w.x, w.y, 0xf3e3c0, 8, 50);
          }
          continue;
        }
        w.life! -= dt;
        if (w.life! < 0.6) w.img.setAlpha(Math.max(0, w.life! / 0.6));
        if (w.life! <= 0) {
          w.img.destroy();
          this.temps.splice(i, 1);
          changed = true;
        }
      }
      if (changed) this.gatherWalls();
    }
    if (g.stage.shelves) {
      this.flowT -= dt;
      if (this.flowT <= 0) {
        this.flowT = FLOW_EVERY;
        this.buildFlow();
      }
    }
  }

  /** A wall that warns for `warn` seconds, then is solid for `life` seconds. */
  addTemp(tex: string, x: number, y: number, hw: number, hh: number, warn: number, life: number): Wall {
    const img = this.g.img(tex, x, y, 29);
    img.setDisplaySize(hw * 2 + 8, hh * 2 + 8).setAlpha(0.4);
    const w: Wall = { x, y, hw, hh, img, warn, life };
    this.temps.push(w);
    return w;
  }

  /** Is this circle touching a solid wall? */
  inWall(x: number, y: number, r: number): boolean {
    for (const w of this.walls) if (Math.abs(x - w.x) < w.hw + r && Math.abs(y - w.y) < w.hh + r) return true;
    return false;
  }

  /** Does the straight line from a to b cross a wall (grown by `pad`)? */
  private blocked(ax: number, ay: number, bx: number, by: number, pad: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    for (const w of this.walls) {
      // Slab test against the box.
      let t0 = 0;
      let t1 = 1;
      const x0 = w.x - w.hw - pad;
      const x1 = w.x + w.hw + pad;
      const y0 = w.y - w.hh - pad;
      const y1 = w.y + w.hh + pad;
      if (Math.abs(dx) < 1e-6) {
        if (ax <= x0 || ax >= x1) continue;
      } else {
        let a = (x0 - ax) / dx;
        let b = (x1 - ax) / dx;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 >= t1) continue;
      }
      if (Math.abs(dy) < 1e-6) {
        if (ay <= y0 || ay >= y1) continue;
      } else {
        let a = (y0 - ay) / dy;
        let b = (y1 - ay) / dy;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 >= t1) continue;
      }
      return true;
    }
    return false;
  }

  /** Steps to the player from every cell near them, flooding outward around walls. */
  private buildFlow(): void {
    const p = this.g.player;
    const d = this.fdist;
    d.fill(-1);
    this.flos.fill(-1);
    this.fx0 = Math.floor(p.x / FCELL) - (FW >> 1);
    this.fy0 = Math.floor(p.y / FCELL) - (FH >> 1);
    // Mark cells inside a wall (grown a little, so paths keep off the corners).
    const PAD = 9;
    for (const w of this.walls) {
      const cx0 = Math.max(0, Math.floor((w.x - w.hw - PAD) / FCELL) - this.fx0);
      const cx1 = Math.min(FW - 1, Math.floor((w.x + w.hw + PAD) / FCELL) - this.fx0);
      const cy0 = Math.max(0, Math.floor((w.y - w.hh - PAD) / FCELL) - this.fy0);
      const cy1 = Math.min(FH - 1, Math.floor((w.y + w.hh + PAD) / FCELL) - this.fy0);
      for (let cy = cy0; cy <= cy1; cy++)
        for (let cx = cx0; cx <= cx1; cx++) {
          const mx = (cx + this.fx0 + 0.5) * FCELL;
          const my = (cy + this.fy0 + 0.5) * FCELL;
          if (Math.abs(mx - w.x) < w.hw + PAD && Math.abs(my - w.y) < w.hh + PAD) d[cy * FW + cx] = -2;
        }
    }
    const q = this.queue;
    let head = 0;
    let tail = 0;
    const start = (FH >> 1) * FW + (FW >> 1);
    d[start] = 0;
    q[tail++] = start;
    while (head < tail) {
      const i = q[head++];
      const cx = i % FW;
      const cy = (i - cx) / FW;
      const nd = d[i] + 1;
      if (cx > 0 && d[i - 1] === -1) (d[i - 1] = nd), (q[tail++] = i - 1);
      if (cx < FW - 1 && d[i + 1] === -1) (d[i + 1] = nd), (q[tail++] = i + 1);
      if (cy > 0 && d[i - FW] === -1) (d[i - FW] = nd), (q[tail++] = i - FW);
      if (cy < FH - 1 && d[i + FW] === -1) (d[i + FW] = nd), (q[tail++] = i + FW);
    }
  }

  /** Is there a wall in this point's flow cell or one of its neighbours? A quick "could anything here touch a wall". */
  nearWall(x: number, y: number): boolean {
    const cx = Math.floor(x / FCELL) - this.fx0;
    const cy = Math.floor(y / FCELL) - this.fy0;
    // Outside the field: can't tell, so say yes.
    if (cx < 1 || cy < 1 || cx >= FW - 1 || cy >= FH - 1) return true;
    const d = this.fdist;
    const i = cy * FW + cx;
    return (
      d[i] === -2 || d[i - 1] === -2 || d[i + 1] === -2 || d[i - FW] === -2 || d[i + FW] === -2 ||
      d[i - FW - 1] === -2 || d[i - FW + 1] === -2 || d[i + FW - 1] === -2 || d[i + FW + 1] === -2
    );
  }

  /**
   * Which way should an enemy at (x, y) walk to reach the player? Straight at them when nothing is in the way;
   * otherwise toward the neighbouring cell that is fewest steps from the player. Returns false to mean "straight".
   */
  steer(x: number, y: number, r: number, out: { x: number; y: number }): boolean {
    const cx = Math.floor(x / FCELL) - this.fx0;
    const cy = Math.floor(y / FCELL) - this.fy0;
    if (cx < 0 || cy < 0 || cx >= FW || cy >= FH) return false;
    const i = cy * FW + cx;
    const p = this.g.player;
    if (this.flos[i] < 0) this.flos[i] = this.blocked((cx + this.fx0 + 0.5) * FCELL, (cy + this.fy0 + 0.5) * FCELL, p.x, p.y, 12) ? 0 : 1;
    // A clear cell is only a hint: check this enemy's own line when it stands close to a wall's corner.
    if (this.flos[i] === 1 && (!this.nearWall(x, y) || !this.blocked(x, y, p.x, p.y, r * 0.8))) return false;
    const d = this.fdist;
    let best = d[i] < 0 ? 32000 : d[i];
    let bx = 0;
    let by = 0;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
        const v = d[ny * FW + nx];
        if (v < 0) continue;
        // No cutting a corner between two blocked cells.
        if (ox && oy && (d[cy * FW + nx] < 0 || d[ny * FW + cx] < 0)) continue;
        const cost = v + (ox && oy ? 0.4 : 0);
        if (cost < best) {
          best = cost;
          bx = ox;
          by = oy;
        }
      }
    if (!bx && !by) return false;
    // Aim at the middle of that cell, so it rounds corners instead of hugging them.
    const tx = (cx + bx + this.fx0 + 0.5) * FCELL - x;
    const ty = (cy + by + this.fy0 + 0.5) * FCELL - y;
    const l = Math.hypot(tx, ty) || 1;
    out.x = tx / l;
    out.y = ty / l;
    return true;
  }

  /** Is this point on one of the floor's ice patches? */
  onIce(x: number, y: number): boolean {
    for (const list of this.ice.values()) if (inPatch(list, x, y)) return true;
    return false;
  }

  /** Slide something out of any rack post or wall it overlaps. */
  pushOut(o: { x: number; y: number }, r: number): void {
    for (const w of this.walls) {
      const dx = o.x - w.x;
      const dy = o.y - w.y;
      const px = w.hw + r - Math.abs(dx);
      if (px <= 0) continue;
      const py = w.hh + r - Math.abs(dy);
      if (py <= 0) continue;
      // Rounded corners: past the end of both sides, push out from the corner point.
      const ex = Math.abs(dx) - w.hw;
      const ey = Math.abs(dy) - w.hh;
      if (ex > 0 && ey > 0) {
        const d2 = ex * ex + ey * ey;
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2) || 0.01;
        o.x += Math.sign(dx) * (ex / d) * (r - d);
        o.y += Math.sign(dy) * (ey / d) * (r - d);
      } else if (px < py) o.x += Math.sign(dx || 1) * px;
      else o.y += Math.sign(dy || 1) * py;
    }
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

  /**
   * Seeded shelves for one shelf cell: none, one, or two side by side with an aisle between. Rows of cells mostly
   * agree on which way their shelves run, so they line up into long aisles. Every shelf stays at least 56 from its
   * cell's edges, so the cell borders are always open corridors 112 wide: a grid of ways through that no layout
   * can close.
   */
  private makeShelves(cx: number, cy: number): Wall[] {
    const C = SHELF_CELL;
    const h = (Math.imul(cx, 2654435761) ^ Math.imul(cy, 40503)) >>> 0;
    const rand = rng((h % 2147483646) + 1);
    rand();
    rand();
    const r = rand();
    const out: Wall[] = [];
    if (r < 0.12) return out;
    const rowsAcross = ((cy % 3) + 3) % 3 !== 0;
    const horiz = rand() < (rowsAcross ? 0.78 : 0.22);
    const mx = (cx + 0.5) * C;
    const my = (cy + 0.5) * C;
    const offs = r > 0.65 ? [-52, 52] : [(Math.floor(rand() * 3) - 1) * 48];
    for (const o of offs) {
      const x = horiz ? mx : mx + o;
      const y = horiz ? my + o : my;
      const hw = (horiz ? SHELF_LEN : SHELF_W) / 2;
      const hh = (horiz ? SHELF_W : SHELF_LEN) / 2;
      // The run starts at an open crossroads.
      if (Math.abs(x) < hw + 110 && Math.abs(y) < hh + 110) continue;
      const v = Math.floor(rand() * 3);
      const img = this.g.img(`shelf_${horiz ? 'h' : 'v'}${v}`, x, y + 5, 29);
      out.push({ x, y, hw, hh, img });
    }
    return out;
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
