import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { BAGELS, BAKERY, TOPPINGS, WEAPONS, type WeaponId } from '../data';
import { goalStatus } from '../progress';
import { clearRun, loadRun } from '../runsave';
import { load, persist } from '../save';
import { makeTextures } from '../textures';
import { button, panel, txt } from '../ui';
import { setSound, soundOn, unlockAudio } from '../sfx';

export class MenuScene extends Phaser.Scene {
  private idx = 0;
  private root!: Phaser.GameObjects.Container;
  private bakery: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('menu');
  }

  create(): void {
    makeTextures(this);
    const save = load();
    this.idx = Math.max(0, BAGELS.findIndex((b) => b.id === save.selected));
    this.build();
    const onResize = () => this.build();
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    this.cameras.main.fadeIn(250, 43, 33, 24);
  }

  private build(): void {
    this.root?.destroy();
    this.bakery?.destroy();
    this.bakery = null;
    const W = this.scale.width;
    const H = this.scale.height;
    const ins = safeInsets();
    const top = ins.top * S;
    const bottom = H - ins.bottom * S;
    const save = load();
    const c = this.add.container(0, 0);
    this.root = c;

    const floor = this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0).setTileScale(1).setAlpha(0.35);
    c.add(floor);
    this.tweens.add({ targets: floor, tilePositionY: -128 * S, duration: 8000, repeat: -1 });

    // Dough counter
    c.add(this.add.image(24 * S, top + 30 * S, 'coin').setScale(1.3));
    c.add(txt(this, 40 * S, top + 30 * S, `${save.dough} Dough`, 17, CSS.gold).setOrigin(0, 0.5));

    // Title
    // Short screens (e.g. iPhone mini, or the in-app preview with its top bar) get a compact layout.
    const compact = (bottom - top) / S < 720;
    const k = compact ? 0.78 : 1;
    const titleY = top + (compact ? 66 * S : Math.max(90 * S, H * 0.13));
    c.add(txt(this, W / 2, titleY, 'EVERYTHING', 40 * k, CSS.gold));
    c.add(txt(this, W / 2, titleY + 44 * k * S, 'BAGEL', 54 * k, CSS.cream));
    c.add(txt(this, W / 2, titleY + 86 * k * S, 'Survive the Stale for 5 minutes', 15, CSS.muted, { bold: false }));

    // Bagel picker
    const bagel = BAGELS[this.idx];
    const locked = !save.unlocked.includes(bagel.id);
    // Description first, so the picker can be placed to fit above the buttons on any screen height.
    const desc = txt(this, W / 2, 0, locked && bagel.goal ? `Locked: ${bagel.goal.text}\n(${goalStatus(save, bagel).progress})` : bagel.quirk, 14, locked ? CSS.red : '#e8d8c0', {
      wrap: Math.min(W / S - 60, 320),
      bold: false,
    }).setOrigin(0.5, 0);
    const buttonsTop = bottom - 150 * S - 66 * S - (compact ? 36 : 40) * S; // top of the toggles row, with a gap
    const titleBottom = titleY + (86 * k + 14) * S;
    const hs = compact ? 2.6 : 3.4; // hero scale
    const descOff = (compact ? 92 : 114) * S;
    const by = Math.max(titleBottom + hs * 18 * S, Math.min(H * 0.47, buttonsTop - descOff - desc.height));
    desc.setY(by + descOff);
    const hero = this.add.image(W / 2, by, bagel.tex).setScale(hs);
    if (locked) hero.setTint(0x222222);
    c.add(hero);
    this.tweens.add({ targets: hero, y: by - 10 * k * S, scaleX: hs * 1.03, scaleY: hs * 0.97, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    c.add(txt(this, W / 2, by + (compact ? 72 : 92) * S, bagel.name, compact ? 22 : 26, locked ? CSS.muted : CSS.cream));
    c.add(desc);
    const arrow = (dx: number, label: string, d: number) =>
      button(this, W / 2 + dx, by, 48 * S, 56 * S, label, () => {
        this.idx = (this.idx + d + BAGELS.length) % BAGELS.length;
        if (save.unlocked.includes(BAGELS[this.idx].id)) {
          save.selected = BAGELS[this.idx].id;
          persist();
        }
        this.build();
      }, { color: COLORS.panelLight, textColor: CSS.cream, size: 24 });
    const dots = this.add.graphics();
    BAGELS.forEach((b, i) => {
      const x = W / 2 + (i - (BAGELS.length - 1) / 2) * 14 * S;
      const on = i === this.idx;
      dots.fillStyle(on ? COLORS.gold : save.unlocked.includes(b.id) ? COLORS.panelLight : 0x1d140d).fillCircle(x, by + (compact ? 52 : 66) * S, (on ? 4 : 3) * S);
    });
    c.add(dots);
    const ax = Math.min(W / 2 - 34 * S, 140 * S);
    c.add(arrow(-ax, '<', -1));
    c.add(arrow(ax, '>', 1));

    // Buttons
    const playY = bottom - 150 * S;
    const tw = Math.min((W - 72 * S) / 2, 134 * S);
    const toggle = (x: number, label: () => string, flip: () => void) => {
      const b = button(this, x, playY - 66 * S, tw, 40 * S, label(), () => {
        unlockAudio();
        flip();
        (b.getData('label') as Phaser.GameObjects.Text).setText(label());
      }, { color: COLORS.panel, textColor: CSS.cream, size: 14, radius: 10 });
      c.add(b);
    };
    const saved = loadRun();
    if (saved) {
      const name = BAGELS.find((b) => b.id === saved.bagel)?.name ?? 'run';
      const rb = button(this, W / 2, playY - 66 * S, Math.min(W - 60 * S, 280 * S), 44 * S, `Resume ${name} at ${fmtTime(saved.now)}`, () => {
        unlockAudio();
        this.cameras.main.fadeOut(200, 18, 12, 8);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { resume: true }));
      }, { color: COLORS.green, textColor: CSS.dark, size: 16, radius: 12 });
      c.add(rb);
    } else {
      toggle(W / 2 - tw / 2 - 6 * S, () => `Practice: ${save.practice ? 'On' : 'Off'}`, () => {
        save.practice = !save.practice;
        persist();
      });
      toggle(W / 2 + tw / 2 + 6 * S, () => `Sound: ${soundOn() ? 'On' : 'Off'}`, () => setSound(!soundOn()));
    }
    const play = button(this, W / 2, playY, Math.min(W - 60 * S, 280 * S), 70 * S, locked ? 'LOCKED' : 'PLAY', () => {
      if (locked) return;
      unlockAudio();
      clearRun();
      this.cameras.main.fadeOut(200, 18, 12, 8);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { bagel: bagel.id, practice: !!save.practice }));
    }, { size: 32, color: locked ? COLORS.panelLight : COLORS.gold });
    c.add(play);
    if (!locked) this.tweens.add({ targets: play, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const bw = (Math.min(W - 60 * S, 280 * S) - 10 * S) / 2;
    c.add(
      button(this, W / 2 - bw / 2 - 5 * S, playY + 80 * S, bw, 54 * S, 'BAKERY', () => this.openBakery(), {
        color: COLORS.panelLight,
        textColor: CSS.cream,
        size: 19,
      }),
    );
    c.add(
      button(this, W / 2 + bw / 2 + 5 * S, playY + 80 * S, bw, 54 * S, 'COOKBOOK', () => this.openCookbook(), {
        color: COLORS.panelLight,
        textColor: CSS.cream,
        size: 19,
      }),
    );
    c.add(
      txt(this, W / 2, bottom - 22 * S, `Best ${fmtTime(save.bestTime)}  ·  Clears ${save.clears}  ·  Cookbook ${save.cookbook.length}/6`, 13, CSS.muted, {
        bold: false,
      }),
    );
  }

  private openCookbook(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const save = load();
    this.bakery?.destroy();
    const c = this.add.container(0, 0);
    this.bakery = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    const ids = Object.keys(WEAPONS) as WeaponId[];
    const pw = Math.min(W - 24 * S, 400 * S);
    const rowH = 62 * S;
    const ph = 160 * S + ids.length * rowH;
    c.add(panel(this, W / 2, H / 2, pw, ph));
    const top = H / 2 - ph / 2;
    c.add(txt(this, W / 2, top + 36 * S, 'THE COOKBOOK', 28, CSS.gold));
    c.add(txt(this, W / 2, top + 64 * S, `${save.cookbook.length} of ${ids.length} evolutions found`, 14, CSS.cream, { bold: false }));
    const lx = W / 2 - pw / 2 + 20 * S;
    ids.forEach((id, i) => {
      const w = WEAPONS[id];
      const t = TOPPINGS[w.evolveWith];
      const found = save.cookbook.includes(id);
      const y = top + 108 * S + i * rowH;
      c.add(this.add.image(lx + 18 * S, y, w.icon).setScale(0.9));
      c.add(txt(this, lx + 44 * S, y, '+', 18, CSS.muted));
      const ti = this.add.image(lx + 70 * S, y, t.icon).setScale(0.9);
      if (!found) ti.setTintFill(0x1d140d);
      c.add(ti);
      const tx = lx + 98 * S;
      c.add(txt(this, tx, y - 10 * S, found ? w.evoName : '???', 16, found ? CSS.gold : CSS.muted).setOrigin(0, 0.5));
      c.add(
        txt(this, tx, y + 11 * S, found ? `${w.name} + ${t.name}` : `Max it + a mystery topping`, 12, CSS.muted, {
          bold: false,
          stroke: false,
          wrap: (pw - 120 * S) / S,
          align: 'left',
        }).setOrigin(0, 0.5),
      );
    });
    c.add(
      txt(this, W / 2, top + ph - 82 * S, 'Evolve: max a weapon, own its topping, open a chest.', 12, CSS.muted, { bold: false, wrap: (pw - 40 * S) / S }),
    );
    c.add(
      button(this, W / 2, top + ph - 40 * S, 160 * S, 46 * S, 'Done', () => {
        c.destroy();
        this.bakery = null;
      }, { size: 20 }),
    );
  }

  private openBakery(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const save = load();
    this.bakery?.destroy();
    const c = this.add.container(0, 0);
    this.bakery = c;
    const dim = this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive();
    c.add(dim);
    const pw = Math.min(W - 24 * S, 400 * S);
    const rowH = 78 * S;
    const ph = 150 * S + BAKERY.length * rowH;
    c.add(panel(this, W / 2, H / 2, pw, ph));
    const top = H / 2 - ph / 2;
    c.add(txt(this, W / 2, top + 36 * S, 'THE BAKERY', 28, CSS.gold));
    c.add(txt(this, W / 2, top + 66 * S, `${save.dough} Dough to spend`, 15, CSS.cream, { bold: false }));
    BAKERY.forEach((u, i) => {
      const y = top + 112 * S + i * rowH;
      const rank = save.upgrades[u.id] ?? 0;
      const maxed = rank >= u.costs.length;
      const cost = maxed ? 0 : u.costs[rank];
      const lx = W / 2 - pw / 2 + 18 * S;
      c.add(txt(this, lx, y - 14 * S, u.name, 17, CSS.cream).setOrigin(0, 0.5));
      c.add(txt(this, lx, y + 8 * S, u.blurb, 12, CSS.muted, { bold: false, stroke: false }).setOrigin(0, 0.5));
      const pips = this.add.graphics();
      for (let k = 0; k < u.costs.length; k++) {
        pips.fillStyle(k < rank ? COLORS.gold : 0x1d140d).fillRoundedRect(lx + k * 18 * S, y + 22 * S, 14 * S, 6 * S, 3 * S);
      }
      c.add(pips);
      const afford = !maxed && save.dough >= cost;
      c.add(
        button(this, W / 2 + pw / 2 - 62 * S, y, 96 * S, 44 * S, maxed ? 'MAX' : `${cost}`, () => {
          if (!afford) return;
          save.dough -= cost;
          save.upgrades[u.id] = rank + 1;
          persist();
          this.build();
          this.openBakery();
        }, { color: afford ? COLORS.gold : COLORS.panelLight, textColor: afford ? CSS.dark : CSS.muted, size: 18 }),
      );
    });
    c.add(
      button(this, W / 2, top + ph - 40 * S, 160 * S, 46 * S, 'Done', () => {
        c.destroy();
        this.bakery = null;
      }, { size: 20 }),
    );
  }
}
