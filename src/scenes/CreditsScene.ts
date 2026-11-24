import Phaser from 'phaser';
import { COLORS, CSS, S, VERSION, safeInsets } from '../config';
import { BAGELS, STAGES } from '../data';
import { playMusic } from '../music';
import { load, persist } from '../save';
import { unlockAudio } from '../sfx';
import { bigBagel, makeTextures } from '../textures';
import { button, txt } from '../ui';
import type { RunResult } from '../run/state';
import { wipeOpen, wipeTo } from '../wipe';

/**
 * The credits: a short scroll after the ending comic (and any time from Settings, About). It carries no personal
 * names: the game's title, a thank you, the font's credit and a few of the player's own numbers. A tap speeds it up;
 * at the end it goes on to the results of the run that won (or back to the menu).
 */
export class CreditsScene extends Phaser.Scene {
  private result?: RunResult;
  private leaving = false;
  private roll: Phaser.GameObjects.Container | null = null;
  private endY = 0;
  private fast = false;

  constructor() {
    super('credits');
  }

  init(data: { result?: RunResult }): void {
    this.result = data?.result;
  }

  create(): void {
    makeTextures(this);
    playMusic('ending');
    this.leaving = false;
    this.fast = false;
    // Seeing the credits is what marks the ending as seen (the title screen turns to morning from here on).
    const save = load();
    if (!save.ending) {
      save.ending = true;
      persist();
    }
    this.build();
    const onResize = () => {
      this.children.removeAll(true);
      this.build();
    };
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    wipeOpen();
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    if (this.result) {
      this.cameras.main.fadeOut(500, 18, 12, 8);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('results', this.result));
    } else wipeTo(this, 'menu');
  }

  private build(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const ins = safeInsets();
    const top = ins.top * S;
    this.add.rectangle(0, 0, W, H, COLORS.bg).setOrigin(0);
    const glow = this.add.graphics();
    glow.fillStyle(0xf2b84b, 0.1).fillCircle(W / 2, H * 0.45, Math.min(W, H) * 0.62);
    glow.fillStyle(0xf2b84b, 0.1).fillCircle(W / 2, H * 0.45, Math.min(W, H) * 0.4);

    const c = this.add.container(0, 0);
    this.roll = c;
    const save = load();
    const wrap = Math.min(W / S - 48, 340);
    let y = 0;
    const line = (text: string, size: number, color: string, gap: number) => {
      const t = txt(this, W / 2, y, text, size, color, { wrap }).setOrigin(0.5, 0).setLineSpacing(3 * S);
      c.add(t);
      y += t.height + gap * S;
    };
    line('EVERYTHING', 34, CSS.gold, 0);
    line('BAGEL', 56, CSS.cream, 26);
    // The bagel that is picked now takes the bow.
    const hero = BAGELS.find((b) => b.id === save.selected) ?? BAGELS[0];
    const im = this.add.image(W / 2, y + 62 * S, bigBagel(this, hero.tex)).setScale(0.75);
    c.add(im);
    this.tweens.add({ targets: im, y: im.y - 6 * S, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    y += 150 * S;
    line('The Stale King has crumbled.', 20, CSS.cream, 4);
    line('The bakery is warm again.', 20, CSS.cream, 44);
    line('THANK YOU FOR PLAYING', 24, CSS.gold, 44);
    line('Your bakery so far', 15, CSS.muted, 10);
    const stages = STAGES.filter((s) => (save.stageClears?.[s.id] ?? 0) > 0).length;
    line(`${save.totalKills.toLocaleString('en-US')} of the Stale defeated`, 18, CSS.cream, 6);
    line(`${save.clears} stage ${save.clears === 1 ? 'clear' : 'clears'} across ${stages} of ${STAGES.length} stages`, 18, CSS.cream, 6);
    line(`${save.unlocked.length} of ${BAGELS.length} bagels on the shelf`, 18, CSS.cream, 44);
    line('Every picture is drawn in code, and every sound and song is made in code.', 15, CSS.muted, 30);
    line('Font', 15, CSS.muted, 4);
    line('Titan One, by Rodrigo Fuenzalida', 17, CSS.cream, 2);
    line('SIL Open Font License', 14, CSS.muted, 30);
    line('Built with Phaser', 15, CSS.muted, 44);
    line('Still to do: Endless, Extra Crispy, and everything on the Goals page.', 17, CSS.cream, 44);
    line(`v${VERSION.replace(/\.0$/, '')}`, 13, CSS.muted, 0);
    c.y = H * 0.78;
    // It stops with the last lines resting in the middle of the screen.
    this.endY = Math.min(H * 0.4 - y, top + 70 * S);

    const zone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    const builtAt = performance.now();
    zone.on('pointerdown', () => {
      if (performance.now() - builtAt < 400) return;
      unlockAudio();
      this.fast = true;
    });
    zone.on('pointerup', () => (this.fast = false));
    zone.on('pointerout', () => (this.fast = false));
    this.add.rectangle(0, 0, W, top + 58 * S, COLORS.bg).setOrigin(0);
    button(this, W - 50 * S, top + 30 * S, 72 * S, 34 * S, 'Skip', () => this.finish(), { size: 15, color: COLORS.panelLight, textColor: CSS.cream, radius: 12 });
    txt(this, 18 * S, top + 30 * S, 'Hold to speed up', 12, CSS.muted, { stroke: false }).setOrigin(0, 0.5);
  }

  update(_t: number, dtMs: number): void {
    const c = this.roll;
    if (!c || this.leaving) return;
    const dt = Math.min(0.05, dtMs / 1000);
    if (c.y > this.endY) c.y = Math.max(this.endY, c.y - (this.fast ? 300 : 46) * S * dt);
    else {
      // The end: hold a moment, then move on.
      this.roll = null;
      this.time.delayedCall(2600, () => this.finish());
    }
  }
}
