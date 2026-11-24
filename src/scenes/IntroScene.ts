import Phaser from 'phaser';
import { COLORS, CSS, S, safeInsets } from '../config';
import { ctex } from '../art';
import { drawBin, drawCreep, drawDawn, drawFall, drawMorning, drawRoll, drawThaw } from '../comic';
import { playMusic } from '../music';
import { load, persist } from '../save';
import { sfx, unlockAudio } from '../sfx';
import { bigBagel, makeEnemyTextures, makeTextures, staleCrumb } from '../textures';
import type { RunResult } from '../run/state';
import { button, txt } from '../ui';
import { wipeOpen, wipeTo } from '../wipe';

type Page = { draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; text: string };
/** The ending: shown before the results screen the first time the Stale King falls (and any time from Settings, About). */
const ENDING: Page[] = [
  { draw: drawFall, text: 'The Stale King cracks, crumbles, and falls to croutons.' },
  { draw: drawThaw, text: 'The grey drains out of the kitchen, one plank at a time.' },
  { draw: (c, w, h) => drawMorning(c, w, h), text: 'The lights come back on. The bakery is warm again.' },
  { draw: (c, w, h) => drawMorning(c, w, h, true), text: 'Fresh, every morning. Well rolled, bagels!' },
];
const INTRO: Page[] = [
  { draw: drawDawn, text: 'Every morning, the bakery wakes up warm and fresh.' },
  { draw: drawCreep, text: 'But something old is spreading. The Stale creeps across the counter, turning everything hard and grey.' },
  { draw: drawBin, text: 'Deep in the bread bin, the Stale King waits for the whole bakery to crumble.' },
  { draw: drawRoll, text: 'Not on our watch. Roll out, bagels!' },
];

/**
 * The intro comic: four panels that tell the story, shown once after the title screen on a new save (and any time from
 * Settings, About). Tap to turn the page; Skip jumps to the menu. Each panel has a little motion on top of its backdrop.
 */
export class IntroScene extends Phaser.Scene {
  /** The ending is playing, not the intro; `result` is the run to show on the results screen after the credits. */
  private ending = false;
  private result?: RunResult;
  private pages: Page[] = INTRO;
  private page = 0;
  private root: Phaser.GameObjects.Container | null = null;
  private leaving = false;

  constructor() {
    super('intro');
  }

  init(data: { ending?: boolean; result?: RunResult }): void {
    this.ending = !!data?.ending;
    this.result = data?.result;
    this.pages = this.ending ? ENDING : INTRO;
  }

  create(): void {
    makeTextures(this);
    if (this.ending) makeEnemyTextures(this);
    playMusic(this.ending ? 'ending' : 'menu');
    this.page = 0;
    this.leaving = false;
    this.root = null;
    this.build(false);
    const onResize = () => this.build(false);
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
      this.dropArt();
    });
    if (!wipeOpen()) this.cameras.main.fadeIn(250, 43, 33, 24);
  }

  /** The backdrops are drawn at the panel's size, so they go when the size changes or the comic ends. */
  private dropArt(): void {
    for (let i = 0; i < this.pages.length; i++) if (this.textures.exists(`comic_${i}`)) this.textures.remove(`comic_${i}`);
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    if (this.ending) {
      // The credits follow, and then the results of the run that won it (or the menu, when watched from Settings).
      wipeTo(this, 'credits', { result: this.result });
      return;
    }
    const save = load();
    save.intro = true;
    persist();
    wipeTo(this, 'menu');
  }

  private build(slide: boolean): void {
    this.tweens.killAll();
    this.root?.destroy();
    this.children.removeAll(true);
    if (!slide) this.dropArt();
    const W = this.scale.width;
    const H = this.scale.height;
    const ins = safeInsets();
    const top = ins.top * S;
    const bottom = H - ins.bottom * S;
    this.add.rectangle(0, 0, W, H, COLORS.bg).setOrigin(0);
    const c = this.add.container(0, 0);
    this.root = c;

    // The panel takes the upper part of the screen; the words sit under it.
    const pw = Math.min(W - 28 * S, 372 * S);
    const ph = Math.min(pw * 0.86, bottom - top - 62 * S - 168 * S);
    const px = W / 2 - pw / 2;
    const py = top + 62 * S;
    const lw = Math.round(pw / S);
    const lh = Math.round(ph / S);
    const pg = this.pages[this.page];
    ctex(this, `comic_${this.page}`, lw, lh, (cx) => pg.draw(cx, lw, lh));

    // Paper behind, picture and its moving parts clipped to the panel, ink frame on top.
    const paper = this.add.graphics();
    paper.fillStyle(0x24160d, 1).fillRoundedRect(px - 9 * S, py - 9 * S, pw + 18 * S, ph + 18 * S, 14 * S);
    paper.fillStyle(COLORS.cream, 1).fillRoundedRect(px - 6 * S, py - 6 * S, pw + 12 * S, ph + 12 * S, 11 * S);
    c.add(paper);
    const art = this.add.container(px, py);
    art.add(this.add.image(0, 0, `comic_${this.page}`).setOrigin(0).setDisplaySize(pw, ph));
    this.actors(art, pw, ph);
    const shape = this.make.graphics({}, false);
    shape.fillStyle(0xffffff).fillRoundedRect(px, py, pw, ph, 6 * S);
    art.setMask(shape.createGeometryMask());
    c.add(art);
    c.once(Phaser.GameObjects.Events.DESTROY, () => shape.destroy());
    const frame = this.add.graphics();
    frame.lineStyle(3 * S, 0x24160d, 1).strokeRoundedRect(px, py, pw, ph, 6 * S);
    c.add(frame);

    // Words
    const words = txt(this, W / 2, py + ph + 26 * S, pg.text, 18, CSS.cream, { wrap: Math.min(W / S - 44, 350) }).setOrigin(0.5, 0).setLineSpacing(3 * S);
    const wordRoom = bottom - 70 * S - words.y;
    if (words.height > wordRoom) words.setScale(wordRoom / words.height);
    c.add(words);
    // Page dots and the prompt
    const dots = this.add.graphics();
    this.pages.forEach((_, i) => {
      const x = W / 2 + (i - (this.pages.length - 1) / 2) * 16 * S;
      dots.fillStyle(0x24160d, 1).fillCircle(x, bottom - 52 * S, 5.5 * S);
      dots.fillStyle(i === this.page ? COLORS.gold : COLORS.panelLight, 1).fillCircle(x, bottom - 52 * S, (i === this.page ? 4.2 : 3.2) * S);
    });
    c.add(dots);
    const last = this.page === this.pages.length - 1;
    const tap = txt(this, W / 2, bottom - 26 * S, last && !this.ending ? 'Tap to start' : 'Tap to continue', 15, CSS.muted, { stroke: false });
    c.add(tap);
    this.tweens.add({ targets: tap, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    if (slide) {
      for (const o of [art, words]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, duration: 260 });
      }
      const x0 = art.x;
      art.x = x0 + 26 * S;
      this.tweens.add({ targets: art, x: x0, duration: 260, ease: 'Cubic.Out' });
    }

    // Tap anywhere to turn the page. The Skip button sits on top, so it gets its own taps.
    const builtAt = performance.now();
    const zone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    zone.on('pointerup', () => {
      // A moment's guard, so the tap that opened the comic (or a double tap) doesn't flip two pages.
      if (performance.now() - builtAt < 300 || this.leaving) return;
      unlockAudio();
      if (last) return this.finish();
      this.page++;
      sfx('swoosh');
      this.build(true);
    });
    c.add(zone);
    if (!last) c.add(button(this, W - 50 * S, top + 30 * S, 72 * S, 34 * S, 'Skip', () => this.finish(), { size: 15, color: COLORS.panelLight, textColor: CSS.cream, radius: 12 }));
  }

  /** The moving parts of the current panel, in panel coordinates (0,0 is its top-left). */
  private actors(art: Phaser.GameObjects.Container, w: number, h: number): void {
    const bagel = (tex: string, x: number, y: number, r: number) => {
      const im = this.add.image(x, y, bigBagel(this, tex)).setScale(r / (62 * S));
      art.add(im);
      return im;
    };
    if (this.ending) {
      this.endingActors(art, w, h, bagel);
      return;
    }
    if (this.page === 0) {
      // Bagels waking up on the shelf.
      const shelf = h * 0.84;
      const r = h * 0.105;
      [['bagel_everything', 0.2], ['bagel_plain', 0.5], ['bagel_poppy', 0.8]].forEach(([tex, fx], i) => {
        const k = i === 1 ? 1.25 : 1;
        const im = bagel(tex as string, w * (fx as number), shelf - r * k * 0.95, r * k);
        const s0 = im.scaleX;
        this.tweens.add({ targets: im, y: im.y - 5 * S, scaleX: s0 * 1.03, scaleY: s0 * 0.97, duration: 800 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    } else if (this.page === 1) {
      // A worried bagel on the fresh side; grey crumbs shuffling in from the stale side.
      const hero = bagel('bagel_plain', w * 0.17, h * 0.56, h * 0.13);
      this.tweens.add({ targets: hero, x: hero.x - 4 * S, angle: -5, duration: 240, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const crumb = staleCrumb(this);
      const spots: [number, number, number][] = [[0.5, 0.3, 1.5], [0.62, 0.62, 2.1], [0.74, 0.2, 1.3], [0.8, 0.44, 1.8], [0.9, 0.76, 2.4], [0.94, 0.28, 1.6], [0.7, 0.86, 1.4]];
      spots.forEach(([fx, fy, sc], i) => {
        const im = this.add.image(w * fx + 30 * S, h * fy, crumb).setScale(sc);
        art.add(im);
        this.tweens.add({ targets: im, x: w * fx - 14 * S, duration: 5200, ease: 'Sine.Out' });
        this.tweens.add({ targets: im, angle: i % 2 ? 9 : -9, y: im.y - 4 * S, duration: 300 + i * 40, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    } else if (this.page === 2) {
      // The crown above the eyes, catching the light.
      const crown = this.add.image(w / 2, h * 0.565, 'ic_crown');
      crown.setScale((w * 0.2) / crown.width).setTint(0xb8b0a0);
      art.add(crown);
      this.tweens.add({ targets: crown, y: crown.y - 2 * S, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const glint = this.add.graphics({ x: w / 2 + w * 0.085, y: h * 0.53 });
      const a = 10 * S;
      glint.fillStyle(0xffffff, 1).fillTriangle(-a, 0, 0, -a * 0.22, 0, a * 0.22).fillTriangle(a, 0, 0, -a * 0.22, 0, a * 0.22).fillTriangle(0, -a, -a * 0.22, 0, a * 0.22, 0).fillTriangle(0, a, -a * 0.22, 0, a * 0.22, 0);
      art.add(glint);
      glint.setScale(0);
      this.tweens.add({ targets: glint, scale: 1, angle: 90, duration: 380, yoyo: true, hold: 120, repeat: -1, repeatDelay: 1300, delay: 500, ease: 'Sine.InOut' });
    } else {
      // Three bagels rolling out across the counter.
      const floor = h * 0.8;
      [['bagel_everything', 0.2, 0.11], ['bagel_poppy', 0.4, 0.125], ['bagel_plain', 0.68, 0.17]].forEach(([tex, fx, fr], i) => {
        const r = h * (fr as number);
        const x1 = w * (fx as number);
        const im = bagel(tex as string, x1 - w * 0.5, floor - r * 0.95, r);
        this.tweens.add({ targets: im, x: x1, angle: 360, duration: 700, delay: i * 110, ease: 'Cubic.Out' });
        this.tweens.add({ targets: im, y: im.y - 9 * S, duration: 260, delay: 700 + i * 110, yoyo: true, repeat: -1, ease: 'Sine.Out' });
      });
    }
  }

  /** The ending's moving parts. */
  private endingActors(art: Phaser.GameObjects.Container, w: number, h: number, bagel: (tex: string, x: number, y: number, r: number) => Phaser.GameObjects.Image): void {
    if (this.page === 0) {
      // Croutons fly out of the crack, and the crown tumbles away.
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        const im = this.add.image(w / 2, h * 0.52, 'en_knight').setScale(0.8 + (i % 3) * 0.25);
        art.add(im);
        const d = h * (0.34 + (i % 2) * 0.12);
        this.tweens.add({ targets: im, x: w / 2 + Math.cos(a) * d, y: h * 0.52 + Math.sin(a) * d * 0.8, angle: (i % 2 ? 1 : -1) * 200, duration: 900, delay: i * 60, ease: 'Cubic.Out' });
        this.tweens.add({ targets: im, y: h * 0.8 - (i % 3) * 4 * S, duration: 600, delay: 900 + i * 60, ease: 'Bounce.Out' });
      }
      const crown = this.add.image(w / 2, h * 0.3, 'ic_crown');
      crown.setScale((w * 0.2) / crown.width);
      art.add(crown);
      this.tweens.add({ targets: crown, x: w * 0.8, angle: 220, duration: 1500, ease: 'Sine.Out' });
      this.tweens.add({ targets: crown, y: h * 0.76, duration: 1500, ease: 'Bounce.Out' });
    } else if (this.page === 1) {
      // A bagel rolls across, and the last grey crumbs fade as it comes.
      const hero = bagel('bagel_plain', -w * 0.1, h * 0.56, h * 0.13);
      this.tweens.add({ targets: hero, x: w * 0.4, angle: 360, duration: 1800, ease: 'Cubic.Out' });
      const crumb = staleCrumb(this);
      const spots: [number, number, number][] = [[0.6, 0.3, 1.5], [0.7, 0.66, 2], [0.8, 0.22, 1.3], [0.86, 0.48, 1.8], [0.94, 0.78, 2.2]];
      spots.forEach(([fx, fy, sc], i) => {
        const im = this.add.image(w * fx, h * fy, crumb).setScale(sc);
        art.add(im);
        this.tweens.add({ targets: im, x: w * fx + 40 * S, alpha: 0, duration: 1500, delay: 500 + i * 220, ease: 'Sine.In' });
        this.tweens.add({ targets: im, angle: i % 2 ? 9 : -9, duration: 260 + i * 40, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    } else if (this.page === 2) {
      // Bagels on the shelf, looking up as the lamps glow.
      const shelf = h * 0.84;
      const r = h * 0.105;
      [['bagel_everything', 0.24], ['bagel_plain', 0.5], ['bagel_poppy', 0.76]].forEach(([tex, fx], i) => {
        const k = i === 1 ? 1.25 : 1;
        const im = bagel(tex as string, w * (fx as number), shelf - r * k * 0.95, r * k);
        const s0 = im.scaleX;
        this.tweens.add({ targets: im, y: im.y - 5 * S, scaleX: s0 * 1.03, scaleY: s0 * 0.97, duration: 800 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
      for (const lx of [0.13, 0.87]) {
        const glow = this.add.circle(w * lx, h * 0.27, w * 0.11, 0xfff0a8, 0.5);
        art.add(glow);
        glow.setScale(0.2).setAlpha(0);
        this.tweens.add({ targets: glow, scale: 1, alpha: 0.5, duration: 500, delay: lx < 0.5 ? 300 : 700, ease: 'Back.Out' });
        this.tweens.add({ targets: glow, alpha: 0.32, duration: 900, delay: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    } else {
      // Everyone hops on the shelf, and sprinkles rain down.
      const shelf = h * 0.84;
      const r = h * 0.1;
      const cast = ['bagel_everything', 'bagel_cinnamon', 'bagel_plain', 'bagel_blueberry', 'bagel_poppy'];
      cast.forEach((tex, i) => {
        const k = i === 2 ? 1.3 : 1;
        const im = bagel(tex, w * (0.12 + i * 0.19), shelf - r * k * 0.95, r * k);
        this.tweens.add({ targets: im, y: im.y - (14 + (i % 2) * 8) * S, duration: 300 + i * 30, delay: i * 90, yoyo: true, repeat: -1, ease: 'Quad.Out' });
        this.tweens.add({ targets: im, angle: i % 2 ? 8 : -8, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
      const cols = [0xe0533d, 0xf2b84b, 0x7fbf4d, 0x6cc7f0, 0xa77ee0, 0xffffff];
      for (let i = 0; i < 22; i++) {
        const sp = this.add.rectangle(w * ((i * 0.618) % 1), -10 * S, 3 * S, 8 * S, cols[i % cols.length]).setAngle(i * 47);
        art.add(sp);
        this.tweens.add({ targets: sp, y: h + 10 * S, angle: sp.angle + 300, duration: 2200 + (i % 5) * 300, delay: (i % 7) * 260, repeat: -1 });
      }
    }
  }
}
