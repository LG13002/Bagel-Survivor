import Phaser from 'phaser';
import { COLORS, CSS, FONT, S } from './config';

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
}

/** A rounded button. x/y/w/h are in device pixels (callers multiply by S). */
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
  const color = opts.color ?? COLORS.gold;
  const g = scene.add.graphics();
  const r = (opts.radius ?? 14) * S;
  const draw = (pressed: boolean) => {
    g.clear();
    g.fillStyle(0x1d140d, 1).fillRoundedRect(-w / 2, -h / 2 + 4 * S, w, h, r);
    g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2 + (pressed ? 3 * S : 0), w, h, r);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 6 * S, -h / 2 + 4 * S + (pressed ? 3 * S : 0), w - 12 * S, h * 0.32, r * 0.6);
  };
  draw(false);
  const t = txt(scene, 0, 0, label, opts.size ?? 22, opts.textColor ?? CSS.dark, { stroke: false });
  const c = scene.add.container(x, y, [g, t]);
  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
  let armed = false;
  c.on('pointerdown', () => {
    armed = true;
    draw(true);
    t.y = 3 * S;
  });
  const reset = () => {
    armed = false;
    draw(false);
    t.y = 0;
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

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color = COLORS.panel): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x1d140d, 1).fillRoundedRect(x - w / 2, y - h / 2 + 5 * S, w, h, 16 * S);
  g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 16 * S);
  g.lineStyle(2 * S, COLORS.panelLight, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16 * S);
  return g;
}
