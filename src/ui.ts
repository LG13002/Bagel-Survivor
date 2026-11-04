import Phaser from 'phaser';
import { COLORS, CSS, FONT, S } from './config';
import { sfx } from './sfx';

/** Text sized in CSS px (scaled by S internally). */
export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: string = CSS.cream,
  opts: { bold?: boolean; wrap?: number; align?: string; stroke?: boolean } = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${Math.round(size * S)}px`,
    color,
    fontStyle: opts.bold === false ? 'normal' : 'bold',
    align: opts.align ?? 'center',
    wordWrap: opts.wrap ? { width: opts.wrap * S, useAdvancedWrap: true } : undefined,
  });
  if (opts.stroke !== false) t.setStroke('#1d140d', Math.max(2, size * 0.22 * S));
  t.setOrigin(0.5);
  return t;
}

export interface ButtonOpts {
  color?: number;
  textColor?: string;
  size?: number;
  radius?: number;
  /** Texture shown to the left of the label (e.g. a Dough coin on a price). */
  icon?: string;
  /** Draw a chevron instead of text: -1 points left, 1 points right. */
  chevron?: -1 | 1;
  /** Greyed out: still pressable, but looks unavailable. */
  muted?: boolean;
}

const INK_HEX = 0x24160d;

/** Chunky Cartoon button: ink outline, thick bottom edge, press-down squish and a click.
 *  x/y/w/h are in device pixels (callers multiply by S). Works while tweens are paused. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onTap: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const color = opts.muted ? COLORS.panelLight : (opts.color ?? COLORS.gold);
  const g = scene.add.graphics();
  const r = Math.min((opts.radius ?? 14) * S, h / 2);
  const edge = 5 * S;
  const lw = 2.5 * S;
  const draw = (pressed: boolean) => {
    const dy = pressed ? edge - 1.5 * S : 0;
    g.clear();
    // Bottom edge (the "thickness" of the button) with its outline.
    g.fillStyle(INK_HEX, 1).fillRoundedRect(-w / 2 - lw / 2, -h / 2 + edge - lw / 2, w + lw, h + lw, r);
    g.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(28).color, 1).fillRoundedRect(-w / 2 + lw / 2, -h / 2 + edge + lw / 2, w - lw, h - lw, r);
    // Face
    g.fillStyle(INK_HEX, 1).fillRoundedRect(-w / 2 - lw / 2, -h / 2 + dy - lw / 2, w + lw, h + lw, r);
    g.fillStyle(color, 1).fillRoundedRect(-w / 2 + lw / 2, -h / 2 + dy + lw / 2, w - lw, h - lw, r - lw / 2);
    g.fillStyle(0xffffff, opts.muted ? 0.08 : 0.22).fillRoundedRect(-w / 2 + 7 * S, -h / 2 + dy + 4 * S, w - 14 * S, Math.min(h * 0.3, 14 * S), Math.min(r * 0.6, 7 * S));
    if (opts.chevron) {
      const k = Math.min(w, h) * 0.17;
      const cx = opts.chevron * k * 0.35;
      g.lineStyle(5 * S, INK_HEX, 1);
      g.beginPath();
      g.moveTo(cx - opts.chevron * k, dy - k * 1.3);
      g.lineTo(cx + opts.chevron * k * 0.4, dy);
      g.lineTo(cx - opts.chevron * k, dy + k * 1.3);
      g.strokePath();
      g.lineStyle(2.4 * S, 0xfff3dc, 1);
      g.beginPath();
      g.moveTo(cx - opts.chevron * k, dy - k * 1.3);
      g.lineTo(cx + opts.chevron * k * 0.4, dy);
      g.lineTo(cx - opts.chevron * k, dy + k * 1.3);
      g.strokePath();
    }
  };
  const t = txt(scene, 0, 0, opts.chevron ? '' : label, opts.size ?? 22, opts.muted ? CSS.muted : (opts.textColor ?? CSS.dark), { stroke: false });
  const parts: Phaser.GameObjects.GameObject[] = [g, t];
  let ic: Phaser.GameObjects.Image | null = null;
  if (opts.icon) {
    const isz = (opts.size ?? 22) * 1.15 * S;
    ic = scene.add.image(0, 0, opts.icon);
    ic.setScale(isz / ic.height);
    if (opts.muted) ic.setAlpha(0.55);
    const total = ic.displayWidth + 5 * S + t.width;
    ic.x = -total / 2 + ic.displayWidth / 2;
    t.x = ic.x + ic.displayWidth / 2 + 5 * S + t.width / 2;
    parts.push(ic);
  }
  draw(false);
  const c = scene.add.container(x, y, parts);
  c.setSize(w, h + edge);
  c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h + edge), Phaser.Geom.Rectangle.Contains);
  let armed = false;
  const shift = (pressed: boolean) => {
    const dy = pressed ? edge - 1.5 * S : 0;
    t.y = dy;
    if (ic) ic.y = dy;
  };
  c.on('pointerdown', () => {
    armed = true;
    draw(true);
    shift(true);
    sfx('click');
  });
  const reset = () => {
    armed = false;
    draw(false);
    shift(false);
  };
  c.on('pointerout', reset);
  c.on('pointerup', () => {
    const fire = armed;
    reset();
    if (fire) onTap();
  });
  c.setData('label', t);
  return c;
}

/** A small dark pill with an icon and a value, e.g. Dough or best time. Centered on x/y. */
export function pill(scene: Phaser.Scene, x: number, y: number, icon: string, value: string, opts: { size?: number; color?: string; h?: number } = {}): Phaser.GameObjects.Container {
  const size = opts.size ?? 14;
  const h = (opts.h ?? 28) * S;
  const t = txt(scene, 0, 0, value, size, opts.color ?? CSS.cream, { stroke: false });
  const ic = scene.add.image(0, 0, icon);
  ic.setScale((h * 0.78) / ic.height);
  const pad = 9 * S;
  const w = pad + ic.displayWidth + 5 * S + t.width + pad * 1.2;
  const g = scene.add.graphics();
  g.fillStyle(0x1d140d, 0.82).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.lineStyle(1.5 * S, COLORS.panelLight, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  ic.x = -w / 2 + pad + ic.displayWidth / 2 - 2 * S;
  t.setOrigin(0, 0.5);
  t.x = ic.x + ic.displayWidth / 2 + 5 * S;
  const c = scene.add.container(x, y, [g, ic, t]);
  c.setSize(w, h);
  c.setData('label', t);
  return c;
}

/** Level pips: `filled` solid dots, then an optional glowing "next" dot, then empty dots. */
export function drawPips(g: Phaser.GameObjects.Graphics, x: number, y: number, total: number, filled: number, next: boolean, color: number, r = 4 * S, gap = 12 * S): void {
  for (let i = 0; i < total; i++) {
    const cx = x + i * gap;
    g.fillStyle(INK_HEX, 1).fillCircle(cx, y, r + 1.5 * S);
    if (i < filled) g.fillStyle(color, 1).fillCircle(cx, y, r);
    else if (next && i === filled) {
      g.fillStyle(0xffffff, 1).fillCircle(cx, y, r);
      g.lineStyle(1.5 * S, color, 1).strokeCircle(cx, y, r + 2.5 * S);
    } else g.fillStyle(0x3d2e22, 1).fillCircle(cx, y, r * 0.8);
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color = COLORS.panel): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x1d140d, 1).fillRoundedRect(x - w / 2, y - h / 2 + 6 * S, w, h, 16 * S);
  g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 16 * S);
  g.lineStyle(3 * S, INK_HEX, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16 * S);
  g.lineStyle(1.5 * S, COLORS.panelLight, 1).strokeRoundedRect(x - w / 2 + 4 * S, y - h / 2 + 4 * S, w - 8 * S, h - 8 * S, 13 * S);
  return g;
}
