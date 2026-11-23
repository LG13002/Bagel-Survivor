import Phaser from 'phaser';
import { reducedFlash, settings } from '../settings';
import { COLORS, CSS, S, ZOOM, fmtTime, safeInsets } from '../config';
import { MAX_SLOTS, TOPPINGS } from '../data';
import { button, fit, pill, txt } from '../ui';
import type { GameScene } from '../scenes/GameScene';

/**
 * The run's screen overlay: level badge and XP bar, timer, kill count, mode badges, the build row, the boss health
 * bar, edge arrows to off-screen bosses and chests, banners and boss cards. Made fresh for every run.
 */
export class Hud {
  private xpBar: Phaser.GameObjects.Graphics;
  private badge: Phaser.GameObjects.Graphics;
  private level: Phaser.GameObjects.Text;
  private timer: Phaser.GameObjects.Text;
  private quickBadge: Phaser.GameObjects.Container;
  private crispyBadge: Phaser.GameObjects.Container;
  private kills: Phaser.GameObjects.Container;
  private aged: Phaser.GameObjects.Container | null;
  private pause: Phaser.GameObjects.Container;
  private build: Phaser.GameObjects.Container;
  private bossName: Phaser.GameObjects.Text;
  /** The boss bar's frame: name plate, ink outline, track and (for bosses with a second phase) the half-health mark. */
  private bossBg: Phaser.GameObjects.Graphics;
  /** The pale bar that trails behind the red one, so a big hit shows as a chunk coming off. */
  private bossGhost: Phaser.GameObjects.Rectangle;
  private bossFill: Phaser.GameObjects.Rectangle;
  private bossMark: Phaser.GameObjects.Graphics;
  private bossShown = '';
  private ghost = 1;
  /** The screen's edge tint for the stage (always on), and the red glow at low health. */
  private lowGlow: Phaser.GameObjects.Image;
  private slots: string[] = [];
  private arrowGfx: Phaser.GameObjects.Graphics;
  private bossBarW = 0;
  private buildSig = '';
  private xpShown = 0;
  private xpBarW = 0;
  private lastTimerSec = -1;
  private lastLevelShown = 0;
  /** Banners on screen (each new one goes below the last). */
  private banners = 0;

  constructor(private g: GameScene) {
    this.arrowGfx = g.ui(g.add.graphics().setDepth(800));
    this.xpBar = g.ui(g.add.graphics());
    this.badge = g.ui(g.add.graphics());
    this.level = g.ui(txt(g, 0, 0, '1', 17, CSS.dark, { stroke: false }));
    this.timer = g.ui(txt(g, 0, 0, '0:00', 26));
    this.quickBadge = g.ui(
      (g.endless ? pill(g, 0, 0, 'ic_clock', 'ENDLESS', { size: 11, h: 22, color: CSS.gold }) : pill(g, 0, 0, 'ic_bolt', 'QUICK', { size: 11, h: 22, color: CSS.gold })).setVisible(g.quick || g.endless),
    );
    this.crispyBadge = g.ui(pill(g, 0, 0, 'ic_flame', 'EXTRA CRISPY', { size: 11, h: 22, color: '#ff9a5c' }).setVisible(g.crispy));
    this.kills = g.ui(pill(g, 0, 0, 'en_crumb', '0', { size: 14, h: 28 }));
    this.aged = g.bagel.quirkId === 'aged' ? g.ui(pill(g, 0, 0, 'ic_bk_oven', '+30%', { size: 14, h: 28, color: CSS.gold })) : null;
    this.pause = g.ui(button(g, 0, 0, 36 * S, 36 * S, 'II', () => g.panels.openPause(), { color: COLORS.panelLight, textColor: CSS.cream, size: 16, radius: 11 }));
    this.build = g.ui(g.add.container(0, 0));
    this.bossBg = g.ui(g.add.graphics().setVisible(false));
    this.bossGhost = g.ui(g.add.rectangle(0, 0, 10, 10, 0xffe2c4).setOrigin(0, 0.5).setVisible(false));
    this.bossFill = g.ui(g.add.rectangle(0, 0, 10, 10, COLORS.red).setOrigin(0, 0.5).setVisible(false));
    this.bossMark = g.ui(g.add.graphics().setVisible(false));
    this.bossName = g.ui(txt(g, 0, 0, '', 14, CSS.gold).setVisible(false));
    this.lowGlow = g.ui(g.add.image(0, 0, 'vignette').setOrigin(0).setTint(0xff2a1a).setAlpha(0).setDepth(-5));
  }

  /** Lay everything out for the current screen size and safe area. */
  layout(): void {
    const W = this.g.scale.width;
    const top = safeInsets().top * S;
    const pad = 12 * S;
    const row1 = top + 24 * S;
    const b = this.badge;
    // Left-handed: the pause button moves to the left edge, and the kills and build row to the right.
    const lefty = settings().lefty;
    const bx = lefty ? pad + 46 * S + 20 * S : pad + 20 * S;
    b.setPosition(bx, row1);
    b.clear();
    b.fillStyle(0x24160d, 1).fillCircle(0, 0, 20 * S);
    b.fillStyle(COLORS.xp, 1).fillCircle(0, 0, 17 * S);
    b.fillStyle(0xffffff, 0.3).fillEllipse(-4 * S, -7 * S, 18 * S, 8 * S);
    this.level.setPosition(bx, row1 + 1 * S);
    this.pause.setPosition(lefty ? pad + 18 * S : W - pad - 18 * S, row1);
    this.xpBarW = W - (pad + 34 * S) - (pad + 46 * S);
    this.xpBar.setPosition(bx + 14 * S, row1);
    this.drawXpBar();
    this.timer.setPosition(W / 2, top + 60 * S);
    this.quickBadge.setPosition(W / 2 + 46 * S + this.quickBadge.width / 2, top + 60 * S);
    this.crispyBadge.setPosition(W / 2, top + 88 * S);
    this.kills.setPosition(lefty ? W - pad - this.kills.width / 2 : pad + this.kills.width / 2, top + 60 * S);
    const agedY = top + (this.g.quick || this.g.endless ? 96 : 60) * S;
    this.aged?.setPosition(lefty ? pad + this.aged.width / 2 : W - pad - this.aged.width / 2, agedY);
    this.build.setPosition(lefty ? W - pad - (3 * 28 + 24) * S : pad, top + 90 * S);
    this.bossName.setPosition(W / 2, top + 141 * S);
    const bw = Math.min(W - 40 * S, 320 * S);
    this.bossBg.setPosition(W / 2, top + 158 * S);
    this.bossMark.setPosition(W / 2, top + 158 * S);
    this.bossFill.setPosition(W / 2 - bw / 2 + 2 * S, top + 158 * S).setSize(bw - 4 * S, 7 * S);
    this.bossGhost.setPosition(W / 2 - bw / 2 + 2 * S, top + 158 * S).setSize(bw - 4 * S, 7 * S);
    this.bossBarW = bw - 4 * S;
    this.bossShown = '';
    this.lowGlow.setDisplaySize(W, this.g.scale.height);
  }

  update(): void {
    const g = this.g;
    const run = g.run;
    const target = Math.min(1, run.xp / run.xpNext);
    // Ease the bar toward its value; snap down after a level-up.
    const nx = target < this.xpShown ? target : this.xpShown + (target - this.xpShown) * 0.25;
    if (Math.abs(nx - this.xpShown) > 0.001) {
      this.xpShown = nx;
      this.drawXpBar();
    }
    const sec = Math.floor(g.now);
    if (sec !== this.lastTimerSec) {
      this.lastTimerSec = sec;
      this.timer.setText(fmtTime(sec));
    }
    if (run.level !== this.lastLevelShown) {
      this.lastLevelShown = run.level;
      this.level.setText(`${run.level}`);
      this.level.setFontSize(Math.round((run.level >= 10 ? 15 : 17) * S));
    }
    setLabel(this.kills, `${run.kills}`);
    if (this.aged) setLabel(this.aged, `+${run.agedPct}%`);
    this.drawBuildRow();
    const b = g.foes.boss ?? g.foes.mini;
    const show = !!b && b.alive;
    this.bossName.setVisible(show);
    this.bossBg.setVisible(show);
    this.bossFill.setVisible(show);
    this.bossGhost.setVisible(show);
    if (b && show) {
      const isBoss = b.kind === g.stage.boss.kind;
      const mark = isBoss && !!g.stage.boss.phase2;
      if (this.bossShown !== b.kind) {
        this.bossShown = b.kind;
        this.ghost = b.hp / b.maxHp;
        this.bossName.setText(isBoss ? g.stage.boss.name : g.stage.mini.name);
        this.drawBossFrame(isBoss, mark);
      }
      const frac = Math.max(0, b.hp / b.maxHp);
      this.ghost = frac > this.ghost ? frac : Math.max(frac, this.ghost - 0.006);
      this.bossFill.setSize(this.bossBarW * frac, 7 * S);
      this.bossGhost.setSize(this.bossBarW * this.ghost, 7 * S);
      // Past the half-health mark the bar burns hotter.
      this.bossFill.setFillStyle(mark && b.enraged ? 0xff7a2a : COLORS.red);
    } else this.bossShown = '';
    this.bossMark.setVisible(show && !!b && b.kind === g.stage.boss.kind && !!g.stage.boss.phase2);
    // Low health: the screen's edges glow red and beat like the heartbeat (a steady glow when flashing is Reduced).
    const hpFrac = g.player.hp / g.stats.maxHp;
    const low = g.player.hp > 0 && hpFrac < 0.25;
    const want = low ? (reducedFlash() ? 0.42 : 0.34 + 0.2 * Math.max(0, Math.sin(performance.now() / 135))) : 0;
    const la = this.lowGlow.alpha + (want - this.lowGlow.alpha) * 0.2;
    this.lowGlow.setAlpha(la < 0.01 ? 0 : la);
    this.drawArrows();
  }

  /** The boss bar's frame: a dark name plate, the bar's ink outline and track, and the half-health mark. */
  private drawBossFrame(isBoss: boolean, mark: boolean): void {
    const bw = this.bossBarW + 4 * S;
    const gr = this.bossBg;
    gr.clear();
    const nw = this.bossName.width + 26 * S;
    // Name plate: a tab sitting on the bar.
    gr.fillStyle(0x24160d, 1).fillRoundedRect(-nw / 2 - 2 * S, -29 * S, nw + 4 * S, 26 * S, { tl: 10 * S, tr: 10 * S, bl: 0, br: 0 });
    gr.fillStyle(isBoss ? 0x5a1d12 : 0x4a3a1c, 1).fillRoundedRect(-nw / 2, -27 * S, nw, 24 * S, { tl: 8 * S, tr: 8 * S, bl: 0, br: 0 });
    gr.fillStyle(0x24160d, 1).fillRoundedRect(-bw / 2 - 2.5 * S, -8 * S, bw + 5 * S, 16 * S, 8 * S);
    gr.fillStyle(0x1d140d, 1).fillRoundedRect(-bw / 2, -5.5 * S, bw, 11 * S, 5.5 * S);
    const m = this.bossMark;
    m.clear();
    if (mark) {
      // A notch at half health, where the boss changes.
      m.fillStyle(0x24160d, 1).fillRect(-2.5 * S, -8 * S, 5 * S, 16 * S);
      m.fillStyle(COLORS.gold, 1).fillRect(-1 * S, -6.5 * S, 2 * S, 13 * S);
      m.fillStyle(0x24160d, 1).fillTriangle(-6 * S, 8 * S, 6 * S, 8 * S, 0, 2 * S);
      m.fillStyle(COLORS.gold, 1).fillTriangle(-3.5 * S, 7.5 * S, 3.5 * S, 7.5 * S, 0, 4 * S);
    }
  }

  /** Chunky XP bar: ink outline, fill, and a shine; drawn behind the level badge. */
  private drawXpBar(): void {
    const g = this.xpBar;
    const w = this.xpBarW;
    const hh = 14 * S;
    g.clear();
    g.fillStyle(0x24160d, 1).fillRoundedRect(-8 * S, -hh / 2 - 2.5 * S, w + 10.5 * S, hh + 5 * S, hh / 2 + 2.5 * S);
    g.fillStyle(0x1d140d, 1).fillRoundedRect(-6 * S, -hh / 2, w + 6 * S, hh, hh / 2);
    const fw = Math.max(0, Math.min(1, this.xpShown)) * (w + 6 * S);
    if (fw > 2 * S) {
      g.fillStyle(COLORS.xp, 1).fillRoundedRect(-6 * S, -hh / 2, Math.max(fw, hh), hh, hh / 2);
      g.fillStyle(0xffffff, 0.35).fillRoundedRect(-2 * S, -hh / 2 + 2.5 * S, Math.max(fw - 8 * S, 4 * S), hh * 0.28, 2 * S);
    }
  }

  /** Small icons of the current weapons (top row) and toppings (bottom row) with their levels. */
  private drawBuildRow(): void {
    const g = this.g;
    const sig = g.weapons.map((w) => `${w.def.id}${w.level}${w.evolved ? '*' : ''}`).join(',') + '|' + [...g.toppings].map(([id, lv]) => `${id}${lv}`).join(',');
    if (sig === this.buildSig) return;
    const first = this.buildSig === '';
    this.buildSig = sig;
    const c = this.build;
    c.removeAll(true);
    const was = this.slots;
    this.slots = [];
    const sz = 24 * S;
    const step = 28 * S;
    const slot = (x: number, y: number, icon: string | null, lv: string, evolved: boolean) => {
      const gr = g.add.graphics();
      gr.fillStyle(0x1d140d, icon ? 0.85 : 0.45).fillRoundedRect(x, y, sz, sz, 6 * S);
      gr.lineStyle(1.5 * S, evolved ? COLORS.gold : COLORS.panelLight, icon ? 1 : 0.5).strokeRoundedRect(x, y, sz, sz, 6 * S);
      c.add(gr);
      const id = `${icon}${lv}`;
      const n = this.slots.push(id) - 1;
      if (!icon) return;
      const sc = (sz * 0.82) / (36 * S);
      const im = g.add.image(x + sz / 2, y + sz / 2, icon).setScale(sc);
      c.add(im);
      const t = txt(g, x + sz - 1 * S, y + sz - 2 * S, lv, 10, evolved ? CSS.gold : CSS.cream).setOrigin(1, 1);
      c.add(t);
      // A slot that just changed pops, with a ring in its color.
      if (first || was[n] === id) return;
      im.setScale(sc * 2.1);
      g.tweens.add({ targets: im, scale: sc, duration: 380, ease: 'Back.Out' });
      t.setScale(2);
      g.tweens.add({ targets: t, scale: 1, duration: 380, ease: 'Back.Out' });
      const ring = g.add.graphics();
      ring.lineStyle(2.5 * S, evolved ? COLORS.gold : 0xfff3dc, 1).strokeRoundedRect(-sz / 2, -sz / 2, sz, sz, 6 * S);
      ring.setPosition(x + sz / 2, y + sz / 2);
      c.add(ring);
      g.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 420, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    };
    for (let i = 0; i < MAX_SLOTS; i++) {
      const w = g.weapons[i];
      slot(i * step, 0, w ? w.icon : null, w ? (w.evolved ? '★' : `${w.level}`) : '', !!w?.evolved);
    }
    const tops = [...g.toppings];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const tp = tops[i];
      slot(i * step, step, tp ? TOPPINGS[tp[0]].icon : null, tp ? `${tp[1]}` : '', false);
    }
  }

  /** Arrows on the screen edge pointing at off-screen bosses, elites and chests. */
  private drawArrows(): void {
    const g = this.g;
    const gfx = this.arrowGfx;
    gfx.clear();
    const W = g.scale.width;
    const H = g.scale.height;
    const p = g.player;
    const ins = safeInsets();
    const m = 26 * S;
    const top = (ins.top + 152) * S;
    const bottom = H - (ins.bottom + 26) * S;
    const targets: { x: number; y: number; color: number }[] = [];
    for (const e of g.foes.bigs) {
      if (!e.alive) continue;
      targets.push({ x: e.x, y: e.y, color: e.boss ? COLORS.red : e.kind === g.stage.mini.kind ? COLORS.gold : COLORS.green });
    }
    for (const it of g.loot.list) {
      if (it.kind === 'chest') targets.push({ x: it.x, y: it.y, color: 0xf3d9a0 });
      else if (it.kind === 'goldchest') targets.push({ x: it.x, y: it.y, color: 0xffc21f });
      else if (it.kind === 'bun') targets.push({ x: it.x, y: it.y, color: 0xf0a24a });
    }
    const pulse = 1 + 0.12 * Math.sin(g.now * 8);
    for (const t of targets) {
      const sx = W / 2 + (t.x - p.x) * S * ZOOM;
      const sy = H / 2 + (t.y - p.y) * S * ZOOM;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const dx = sx - W / 2;
      const dy = sy - H / 2;
      // Scale the direction until it touches the inset screen edge.
      const kx = dx > 0 ? (W - m - W / 2) / dx : dx < 0 ? (m - W / 2) / dx : Infinity;
      const ky = dy > 0 ? (bottom - H / 2) / dy : dy < 0 ? (top - H / 2) / dy : Infinity;
      const k = Math.min(kx, ky);
      const ax = W / 2 + dx * k;
      const ay = H / 2 + dy * k;
      const a = Math.atan2(dy, dx);
      const r = 13 * S * pulse;
      const pts = [0, 2.5, -2.5].map((o, i) => ({
        x: ax + Math.cos(a + o) * (i === 0 ? r : r * 0.8),
        y: ay + Math.sin(a + o) * (i === 0 ? r : r * 0.8),
      }));
      gfx.fillStyle(0x1d140d, 0.85).fillCircle(ax, ay, r * 0.95);
      gfx.fillStyle(t.color, 1).fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    }
  }

  /** A line of text that pops in near the top, then floats up and fades. `line`: a smaller second line (what a mini-boss says). */
  banner(text: string, color: string, size: number, line?: string): void {
    const g = this.g;
    const W = g.scale.width;
    const top = safeInsets().top * S;
    const slot = this.banners;
    this.banners += line ? 2 : 1;
    const y = top + (190 + slot * 40) * S;
    const parts = [txt(g, 0, 0, text, size, color, { wrap: W / S - 40 })];
    if (line) parts.push(txt(g, 0, (size * 0.5 + 16) * S, line, 17, CSS.cream, { wrap: W / S - 40 }));
    const t = g.ui(g.add.container(W / 2, y, parts));
    t.setAlpha(0).setScale(0.6);
    g.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    g.tweens.add({ targets: t, alpha: 0, y: y - 30 * S, delay: line ? 2400 : 1600, duration: 500, onComplete: () => {
      t.destroy();
      this.banners -= line ? 2 : 1;
    } });
  }

  /** Big announcement card for a boss's arrival. */
  bossCard(name: string, line: string): void {
    const g = this.g;
    const W = g.scale.width;
    const top = safeInsets().top * S;
    const w = Math.min(W - 32 * S, 340 * S);
    const h = 100 * S;
    const gr = g.add.graphics();
    gr.fillStyle(0x24160d, 1).fillRoundedRect(-w / 2 - 4 * S, -h / 2 - 4 * S, w + 8 * S, h + 8 * S, 20 * S);
    // Themed per stage: icy blue in the Freezer, glowing red-hot in the oven, toasted brown on the countertop.
    const th = g.stage.coils ? CARD_HOT : g.stage.frost ? CARD_ICY : g.stage.shelves ? CARD_DOUGH : CARD_TOAST;
    gr.fillStyle(th.fill, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 16 * S);
    gr.lineStyle(2 * S, th.edge, 0.85).strokeRoundedRect(-w / 2 + 5 * S, -h / 2 + 5 * S, w - 10 * S, h - 10 * S, 12 * S);
    const t1 = fit(txt(g, 0, -17 * S, name.toUpperCase(), 26, th.name), w - 24 * S);
    const t2 = fit(txt(g, 0, 22 * S, line, 19, th.line), w - 24 * S);
    const card = g.ui(g.add.container(W / 2, top + 220 * S, [gr, t1, t2]));
    card.setScale(0.5).setAlpha(0);
    g.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 320, ease: 'Back.Out' });
    g.tweens.add({ targets: card, alpha: 0, y: card.y - 30 * S, delay: 2600, duration: 500, onComplete: () => card.destroy() });
  }
}

const CARD_HOT = { fill: 0x4a170c, edge: 0xffb36b, name: CSS.gold, line: '#ffe2c4' };
const CARD_ICY = { fill: 0x1d3a57, edge: 0xbfe6fb, name: CSS.red, line: '#dff4ff' };
const CARD_DOUGH = { fill: 0x3d3324, edge: 0xf3e3c0, name: '#fff3dc', line: '#f2d9a6' };
const CARD_TOAST = { fill: 0x5a3416, edge: 0xf2b84b, name: CSS.gold, line: '#fff3dc' };

/** Change a pill's text only when it differs (setText re-renders the text texture). */
function setLabel(pillC: Phaser.GameObjects.Container, s: string): void {
  const t = pillC.getData('label') as Phaser.GameObjects.Text;
  if (t.text !== s) t.setText(s);
}
