import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { BAGELS, BAKERY, ENEMIES, ENEMY_BOOK, STAGES, TOPPINGS, WEAPONS, stageById, type StageDef, type WeaponId } from '../data';
import { CHALLENGES, claimGoals, unseenGoals } from '../goals';
import { COMBO } from '../weapons';
import { checkUnlocks, checkWeaponUnlocks, goalStatus, modesOpen, weaponGoalStatus, weaponOpen, pickedStage, stagePlayable, stageUnlocked } from '../progress';
import { clearRun, loadRun } from '../runsave';
import { bestStage, getBest, load, persist, type BestScore, type RunMode, type SaveData } from '../save';
import { makeTextures } from '../textures';
import { button, drawPips, panel, pill, txt } from '../ui';
import { musicOn, setMusic, setSound, sfx, soundOn, unlockAudio } from '../sfx';
import { playMusic } from '../music';

/** Height of the menu's stage button row, in CSS px. */
const STAGE_ROW = 48;
const STAGE_ROW_COMPACT = 40;
const SECRET_BAGEL_HINT = 'A secret bagel. Keep clearing stages to find it.';
const SECRET_RECIPE_HINT = 'A secret recipe. Keep evolving weapons to find it.';
/** Charred brown for the stage button and card frame when Extra Crispy is on. */
const CRISPY_COLOR = 0x6b2e14;

/** One best line: "Endless: 12:34", "Full: ♛ cleared · 412 kills", ... */
function bestText(label: string, best: BestScore | undefined, endless: boolean): string {
  if (!best) return `${label}: no runs yet`;
  if (endless) return `${label}: ${fmtTime(best.time)}`;
  return best.cleared ? `${label}: ♛ cleared · ${best.kills} kills` : `${label}: ${fmtTime(best.time)} · ${best.kills} kills`;
}

export class MenuScene extends Phaser.Scene {
  private idx = 0;
  private root!: Phaser.GameObjects.Container;
  private bakery: Phaser.GameObjects.Container | null = null;
  private doughPill: Phaser.GameObjects.Container | null = null;
  private slideFrom = 0;
  /** Card shown in the stage picker. */
  private stageIdx = 0;

  constructor() {
    super('menu');
  }

  create(): void {
    makeTextures(this);
    playMusic('menu');
    const save = load();
    // Goals met by older saves (or handed out in preview builds) unlock on opening the game.
    // Challenges already done by older saves pay out here too (the Goals button gets a red dot).
    if (checkUnlocks(save).length + checkWeaponUnlocks(save).length + claimGoals(save).length) persist();
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
    const stage = pickedStage(save);
    // Endless and Extra Crispy open per stage after a clear; until then the run is Full or Quick.
    const open = modesOpen(save, stage);
    const mode: RunMode = save.endless && open ? 'endless' : save.quick ? 'quick' : 'full';
    const crispy = !!save.crispy && open;
    const c = this.add.container(0, 0);
    this.root = c;

    const floor = this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0).setTileScale(1).setAlpha(0.35);
    c.add(floor);
    this.tweens.add({ targets: floor, tilePositionY: -128 * S, duration: 8000, repeat: -1 });

    // Dough counter
    const dp = pill(this, 0, top + 28 * S, 'coin', `${save.dough} Dough`, { size: 16, color: CSS.gold, h: 32 });
    dp.x = 14 * S + dp.width / 2;
    c.add(dp);
    this.doughPill = dp;

    // Title
    // Short screens (e.g. iPhone mini, or the in-app preview with its top bar) get a compact layout.
    const compact = (bottom - top) / S < 720;
    const k = compact ? 0.7 : 1;
    const titleY = top + (compact ? 62 * S : Math.max(96 * S, H * 0.13));
    c.add(txt(this, W / 2, titleY, 'EVERYTHING', 40 * k, CSS.gold));
    c.add(txt(this, W / 2, titleY + 44 * k * S, 'BAGEL', 54 * k, CSS.cream));
    // Short screens skip the tagline to make room for the bagel.
    if (!compact) c.add(txt(this, W / 2, titleY + 86 * k * S, mode === 'endless' ? 'Survive the Stale as long as you can' : mode === 'quick' ? 'Survive the Stale for 3 minutes' : 'Survive the Stale for 5 minutes', 15, CSS.muted, { bold: false }));

    // Bagel picker
    const bagel = BAGELS[this.idx];
    const locked = !save.unlocked.includes(bagel.id);
    // A secret bagel stays a mystery until it's found: no name, no goal.
    const hidden = locked && !!bagel.secret;
    const gs = locked && bagel.goal && !hidden ? goalStatus(save, bagel) : null;
    // Description first, so the picker can be sized to fit above the buttons on any screen height.
    const desc = txt(this, W / 2, 0, hidden ? SECRET_BAGEL_HINT : gs ? `Unlock: ${bagel.goal!.text}` : bagel.quirk, 14, '#e8d8c0', {
      wrap: Math.min(W / S - 60, 320),
      bold: false,
    }).setOrigin(0.5, 0);
    const extraBelow = gs && !compact ? 26 * S : 0; // progress bar under a locked bagel's goal
    const stageRow = compact ? STAGE_ROW_COMPACT : STAGE_ROW;
    const buttonsTop = bottom - 150 * S - 66 * S - 48 * S - stageRow * S - (compact ? 26 : 32) * S; // top of the stage button, with a gap
    const titleBottom = titleY + (compact ? 64 * k + 8 : 86 * k + 16) * S;
    // Below the bagel: dots, name, best line, then the description.
    const sp = compact ? 0.84 : 1; // tighter spacing under the bagel on short screens
    const belowBagel = 94 * sp * S + desc.height + extraBelow;
    const avail = buttonsTop - titleBottom;
    const R = Math.max(30 * S, Math.min((compact ? 58 : 74) * S, (avail - belowBagel - (compact ? 10 : 24) * S) / 2)); // on-screen bagel radius
    const hs = R / (62 * S); // hero texture scale (bagel radius is 62 in the 160 '_big' texture)
    const by = titleBottom + Math.max(12 * S, (avail - (2 * R + belowBagel)) / 2) + R;
    const dotsY = by + R + 22 * sp * S;
    desc.setY(by + R + 90 * sp * S);

    const shadow = this.add.ellipse(W / 2, by + R * 1.02, R * 1.7, R * 0.34, 0x120c08, 0.45);
    c.add(shadow);
    const hero = this.add.image(W / 2, by, `${bagel.tex}_big`).setScale(hs);
    if (locked) hero.setTint(0x222222);
    c.add(hero);
    this.tweens.add({ targets: hero, y: by - 10 * k * S, scaleX: hs * 1.03, scaleY: hs * 0.97, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: shadow, scaleX: 0.85, alpha: 0.3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const slide: Phaser.GameObjects.GameObject[] = [hero, shadow];
    if (locked) {
      const lock = this.add.image(W / 2, by + R * 0.1, 'ic_lock').setScale(Math.max(1.3, hs * 1.8));
      c.add(lock);
      slide.push(lock);
    }
    const nameT = txt(this, W / 2, by + R + 48 * sp * S, hidden ? '???' : bagel.name, compact ? 22 : 26, locked ? CSS.muted : CSS.cream);
    c.add(nameT);
    slide.push(nameT);
    // Short screens have no room for a locked bagel's progress bar: its progress goes in the best line's place.
    if (gs && compact) c.add(txt(this, W / 2, by + R + 72 * sp * S, gs.progress, 14, CSS.muted, { bold: false }));
    if (!locked) {
      const best = getBest(save, bagel.id, bestStage(stage.id, mode, crispy));
      const label = `Stage ${stage.num}${mode === 'quick' ? ' Quick' : mode === 'endless' ? ' Endless' : ''}${crispy ? ' Crispy' : ''}`;
      const line = !best
        ? `${label} best: no runs yet`
        : mode === 'endless'
          ? `${label} best: ${fmtTime(best.time)}`
          : best.cleared
            ? `♛ ${label} cleared  ·  ${best.kills} kills`
            : `${label} best: ${fmtTime(best.time)}  ·  ${best.kills} kills`;
      c.add(txt(this, W / 2, by + R + 72 * sp * S, line, 14, best ? CSS.gold : CSS.muted, { bold: !!best }));
    }
    c.add(desc);
    if (gs && !compact) {
      const bw = Math.min(W - 100 * S, 240 * S);
      const y = desc.y + desc.height + 14 * S;
      const g = this.add.graphics();
      g.fillStyle(0x24160d, 1).fillRoundedRect(W / 2 - bw / 2 - 2 * S, y - 7 * S, bw + 4 * S, 14 * S, 7 * S);
      g.fillStyle(0x3d2e22, 1).fillRoundedRect(W / 2 - bw / 2, y - 5 * S, bw, 10 * S, 5 * S);
      if (gs.frac > 0) g.fillStyle(COLORS.gold, 1).fillRoundedRect(W / 2 - bw / 2, y - 5 * S, Math.max(10 * S, bw * gs.frac), 10 * S, 5 * S);
      c.add(g);
      c.add(txt(this, W / 2, y + 17 * S, gs.progress, 12, CSS.muted, { bold: false, stroke: false }));
    }
    const go = (d: number) => {
      this.idx = (this.idx + d + BAGELS.length) % BAGELS.length;
      if (save.unlocked.includes(BAGELS[this.idx].id)) {
        save.selected = BAGELS[this.idx].id;
        persist();
      }
      this.slideFrom = d;
      sfx('swoosh');
      if (!save.unlocked.includes(BAGELS[this.idx].id)) sfx('lock');
      this.build();
    };
    const dots = this.add.graphics();
    BAGELS.forEach((b, i) => {
      const x = W / 2 + (i - (BAGELS.length - 1) / 2) * 14 * S;
      const on = i === this.idx;
      dots.fillStyle(on ? COLORS.gold : save.unlocked.includes(b.id) ? COLORS.panelLight : 0x1d140d).fillCircle(x, dotsY, (on ? 4 : 3) * S);
    });
    c.add(dots);
    const ad = 50 * S;
    const ax = Math.min(W / 2 - 36 * S, R + 70 * S);
    c.add(button(this, W / 2 - ax, by, ad, ad, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 25 }));
    c.add(button(this, W / 2 + ax, by, ad, ad, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 25 }));
    // Swipe on the bagel to switch.
    const zone = this.add.zone(W / 2, by, Math.max(2 * R + 40 * S, W - 2 * ax - ad), 2 * R + 40 * S).setInteractive();
    c.add(zone);
    let sx: number | null = null;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (sx = p.x));
    const onUp = (p: Phaser.Input.Pointer) => {
      if (sx === null) return;
      const dx = p.x - sx;
      sx = null;
      if (Math.abs(dx) > 40 * S) go(dx < 0 ? 1 : -1);
    };
    this.input.on('pointerup', onUp);
    c.once(Phaser.GameObjects.Events.DESTROY, () => this.input.off('pointerup', onUp));
    // Slide the new bagel in from the side it came from.
    if (this.slideFrom) {
      const off = this.slideFrom * 130 * S;
      for (const o of slide as (Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject)[]) {
        const x0 = o.x;
        o.x = x0 + off;
        o.alpha = 0;
        this.tweens.add({ targets: o, x: x0, alpha: (o as unknown) === shadow ? 0.45 : 1, duration: 220, ease: 'Cubic.Out' });
      }
      this.slideFrom = 0;
    }

    // Buttons
    const playY = bottom - 150 * S;
    const tw = Math.min((Math.min(W - 60 * S, 300 * S) - 16 * S) / 3, 100 * S);
    const toggle = (x: number, label: () => string, flip: () => void) => {
      const b = button(this, x, playY - 66 * S, tw, 40 * S, label(), () => {
        unlockAudio();
        flip();
        (b.getData('label') as Phaser.GameObjects.Text).setText(label());
      }, { color: COLORS.panel, textColor: CSS.cream, size: 13, radius: 10 });
      c.add(b);
    };
    const saved = loadRun();
    if (saved) {
      const name = BAGELS.find((b) => b.id === saved.bagel)?.name ?? 'run';
      const label = `Resume ${saved.endless ? 'Endless ' : saved.quick ? 'Quick ' : ''}${name}, Stage ${stageById(saved.stage).num}, ${fmtTime(saved.now)}`;
      const rb = button(this, W / 2, playY - 66 * S, Math.min(W - 60 * S, 300 * S), 44 * S, label, () => {
        unlockAudio();
        this.cameras.main.fadeOut(200, 18, 12, 8);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { resume: true }));
      }, { color: COLORS.green, textColor: CSS.dark, size: label.length > 34 ? 14 : 16, radius: 12 });
      c.add(rb);
    } else {
      // Practice is off in Endless.
      toggle(W / 2 - tw - 8 * S, () => `Practice: ${save.practice && mode !== 'endless' ? 'On' : 'Off'}`, () => {
        if (mode === 'endless') {
          sfx('lock');
          this.toast('No practice runs in Endless', playY - 66 * S - 40 * S);
          return;
        }
        save.practice = !save.practice;
        persist();
      });
      toggle(W / 2, () => `Music: ${musicOn() ? 'On' : 'Off'}`, () => setMusic(!musicOn()));
      toggle(W / 2 + tw + 8 * S, () => `Sound: ${soundOn() ? 'On' : 'Off'}`, () => setSound(!soundOn()));
    }
    // Full / Quick / Endless switch: a three-part pill above the toggles. Remembers the last choice.
    {
      const sw = Math.min(W - 60 * S, 300 * S);
      const sh = 38 * S;
      const y = playY - 66 * S - 52 * S;
      const seg = sw / 3;
      const modes: [RunMode, string, string | null][] = [
        ['full', 'Full 5:00', null],
        ['quick', 'Quick 3:00', 'ic_bolt'],
        ['endless', 'Endless', 'ic_clock'],
      ];
      const sel = modes.findIndex((m) => m[0] === mode);
      const g = this.add.graphics();
      g.fillStyle(0x24160d, 1).fillRoundedRect(W / 2 - sw / 2 - 2.5 * S, y - sh / 2 - 2.5 * S, sw + 5 * S, sh + 5 * S, sh / 2 + 2.5 * S);
      g.fillStyle(0x1d140d, 1).fillRoundedRect(W / 2 - sw / 2, y - sh / 2, sw, sh, sh / 2);
      const x0 = W / 2 - sw / 2 + sel * seg;
      g.fillStyle(COLORS.gold, 1).fillRoundedRect(x0 + 3 * S, y - sh / 2 + 3 * S, seg - 6 * S, sh - 6 * S, sh / 2 - 3 * S);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(x0 + 10 * S, y - sh / 2 + 6 * S, seg - 20 * S, 8 * S, 4 * S);
      c.add(g);
      modes.forEach(([m, label, icon], i) => {
        const on = i === sel;
        const lockedMode = m === 'endless' && !open;
        const cx = W / 2 - sw / 2 + seg * (i + 0.5);
        const shift = icon ? 8 * S : 0;
        const t = txt(this, cx + shift, y, label, 14, on ? CSS.dark : CSS.muted, { stroke: false });
        if (lockedMode) t.setAlpha(0.6);
        c.add(t);
        if (icon) c.add(this.add.image(t.x - t.width / 2 - 10 * S, y, lockedMode ? 'ic_lock' : icon).setScale(lockedMode ? 0.42 : 0.5).setAlpha(on ? 1 : 0.6));
        const z = this.add.zone(cx, y, seg, sh + 8 * S).setInteractive();
        z.on('pointerup', () => {
          if (on) return;
          if (lockedMode) {
            sfx('lock');
            this.toast('Clear this stage to unlock Endless', y - sh / 2 - (compact ? STAGE_ROW_COMPACT : STAGE_ROW) * S - 30 * S);
            return;
          }
          sfx('click');
          save.quick = m === 'quick';
          save.endless = m === 'endless';
          persist();
          this.build();
        });
        c.add(z);
      });
      // Stage button above the switch: shows the picked stage and opens the stage picker.
      // The flame button beside it is the Extra Crispy toggle.
      const rowY = y - sh / 2 - 12 * S - ((compact ? STAGE_ROW_COMPACT : STAGE_ROW) / 2 - 4) * S;
      const fw = (compact ? 34 : 40) * S;
      c.add(this.stageButton(stage, W / 2 - (fw + 8 * S) / 2, rowY, sw - fw - 8 * S, compact, crispy));
      c.add(this.crispyButton(W / 2 + sw / 2 - fw / 2, rowY, fw, crispy, open, rowY - fw / 2 - 26 * S));
    }
    const play = button(this, W / 2, playY, Math.min(W - 60 * S, 280 * S), 70 * S, locked ? 'LOCKED' : 'PLAY', () => {
      if (locked) return;
      unlockAudio();
      clearRun();
      this.cameras.main.fadeOut(200, 18, 12, 8);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { bagel: bagel.id, stage: stage.id, practice: !!save.practice && mode !== 'endless', quick: mode === 'quick', endless: mode === 'endless', crispy }));
    }, { size: 32, color: locked ? COLORS.panelLight : COLORS.gold });
    c.add(play);
    if (!locked) this.tweens.add({ targets: play, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // Bottom row: Bakery, Goals and Cookbook. A red dot on Goals means a challenge was just finished.
    const rowW = Math.min(W - 40 * S, 300 * S);
    const bw = (rowW - 16 * S) / 3;
    const bottomRow: [string, () => void][] = [
      ['BAKERY', () => this.openBakery()],
      ['GOALS', () => this.openGoals(unseenGoals(save).length ? 1 : 0)],
      ['COOKBOOK', () => this.openCookbook()],
    ];
    bottomRow.forEach(([label, fn], i) => {
      const b = button(this, W / 2 + (i - 1) * (bw + 8 * S), playY + 80 * S, bw, 54 * S, label, fn, {
        color: COLORS.panelLight,
        textColor: CSS.cream,
        size: bw < 96 * S ? 15 : 17,
      });
      c.add(b);
      if (label === 'GOALS' && unseenGoals(save).length) {
        const dot = this.add.graphics();
        dot.fillStyle(0x24160d, 1).fillCircle(bw / 2 - 6 * S, -27 * S + 4 * S, 9 * S);
        dot.fillStyle(COLORS.red, 1).fillCircle(bw / 2 - 6 * S, -27 * S + 4 * S, 6.5 * S);
        b.add(dot);
        this.tweens.add({ targets: dot, alpha: 0.55, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    });
    const stats = [
      pill(this, 0, bottom - 24 * S, 'ic_clock', `Best ${fmtTime(save.bestTime)}`, { size: 13, h: 26 }),
      pill(this, 0, bottom - 24 * S, 'ic_crown', `${save.clears} clears`, { size: 13, h: 26 }),
      pill(this, 0, bottom - 24 * S, 'ic_book', `${save.cookbook.length}/${Object.keys(WEAPONS).length}`, { size: 13, h: 26 }),
    ];
    const gap = 8 * S;
    let x = W / 2 - (stats.reduce((a, p) => a + p.width, 0) + gap * (stats.length - 1)) / 2;
    for (const p of stats) {
      p.x = x + p.width / 2;
      x += p.width + gap;
      c.add(p);
    }
  }

  /** Short note that floats up and fades, e.g. why a locked mode can't be picked. */
  private toast(text: string, y: number): void {
    const t = txt(this, 0, 0, text, 14, CSS.cream, { stroke: false });
    const g = this.add.graphics();
    const w = t.width + 28 * S;
    const h = 32 * S;
    g.fillStyle(0x24160d, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const box = this.add.container(this.scale.width / 2, y, [g, t]);
    this.root.add(box);
    this.tweens.add({ targets: box, y: y - 18 * S, alpha: 0, delay: 1300, duration: 500, onComplete: () => box.destroy() });
  }

  /** Square flame button: turns Extra Crispy on and off (locked until the stage is cleared). */
  private crispyButton(x: number, y: number, w: number, on: boolean, open: boolean, toastY: number): Phaser.GameObjects.Container {
    const h = w;
    const b = button(this, x, y, w, h, '', () => {
      if (!open) {
        sfx('lock');
        this.toast('Clear this stage to unlock Extra Crispy', toastY);
        return;
      }
      const save = load();
      save.crispy = !save.crispy;
      persist();
      this.build();
      if (save.crispy) this.toast('Extra Crispy: tougher enemies, 1.5x Dough', toastY);
    }, { color: on ? COLORS.red : COLORS.panelLight, radius: 12 });
    const fl = this.add.image(0, 0, 'ic_flame').setScale(0.62).setAlpha(open ? (on ? 1 : 0.55) : 0.3);
    b.add(fl);
    if (!open) b.add(this.add.image(w * 0.22, h * 0.2, 'ic_lock').setScale(0.38));
    return b;
  }

  /** Chunky button with the stage's picture, its name and a chevron. Charred when Extra Crispy is on. */
  private stageButton(stage: StageDef, x: number, y: number, w: number, compact: boolean, crispy = false): Phaser.GameObjects.Container {
    const h = (compact ? 34 : 40) * S;
    const b = button(this, x, y, w, h, '', () => this.openStages(), { color: crispy ? CRISPY_COLOR : COLORS.panelLight, radius: 12 });
    const pic = this.add.image(-w / 2 + 12 * S, 0, `${stage.thumb}_sm`).setOrigin(0, 0.5);
    pic.setScale((h - 10 * S) / pic.height);
    if (crispy) pic.setTint(0xffb08a);
    const name = w < 260 * S ? stage.name.replace(/^The /, '') : stage.name;
    const label = txt(this, pic.x + pic.displayWidth + 9 * S, 0, `Stage ${stage.num}: ${name}`, 15, crispy ? '#ffd2b0' : CSS.cream, { stroke: false }).setOrigin(0, 0.5);
    const more = txt(this, w / 2 - 16 * S, -1 * S, '›', 26, CSS.gold, { stroke: false });
    b.add([pic, label, more]);
    // Move the extras with the button's press squish.
    const moving = [pic, label, more];
    const base = moving.map((o) => o.y);
    b.on('pointerdown', () => moving.forEach((o, i) => (o.y = base[i] + 3.5 * S)));
    const up = () => moving.forEach((o, i) => (o.y = base[i]));
    b.on('pointerup', up);
    b.on('pointerout', up);
    return b;
  }

  /** Stage picker: one card per stage, flipped with swipes or chevrons. */
  private openStages(): void {
    const save = load();
    this.stageIdx = Math.max(0, STAGES.indexOf(pickedStage(save)));
    this.drawStages(save, 0);
  }

  private drawStages(save: SaveData, slideFrom: number): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bakery?.destroy();
    const c = this.add.container(0, 0);
    this.bakery = c;
    const close = () => {
      c.destroy();
      this.bakery = null;
      this.build();
    };
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    const pw = Math.min(W - 24 * S, 400 * S);
    const ph = Math.min(H - 24 * S, 540 * S);
    c.add(panel(this, W / 2, H / 2, pw, ph));
    const top = H / 2 - ph / 2;
    c.add(txt(this, W / 2, top + 34 * S, 'PICK A STAGE', 26, CSS.gold));

    const st = STAGES[this.stageIdx];
    const unlocked = stageUnlocked(save, st);
    const playable = stagePlayable(save, st);
    const picked = pickedStage(save).id === st.id;
    const card = this.add.container(W / 2, 0);
    c.add(card);

    // Picture, darkened with a lock until it can be played.
    const picY = top + 145 * S;
    const pic = this.add.image(0, picY, st.thumb);
    pic.setScale(Math.min((pw - 120 * S) / pic.width, (120 * S) / pic.height));
    if (!playable) pic.setTint(0x55504a);
    const crispyOn = playable && !!save.crispy && modesOpen(save, st);
    if (crispyOn) {
      // Extra Crispy: a toasted, charred frame and a warmer picture.
      pic.setTint(0xffb08a);
      const fr = this.add.graphics();
      const fw2 = pic.displayWidth + 12 * S;
      const fh2 = pic.displayHeight + 12 * S;
      fr.lineStyle(7 * S, CRISPY_COLOR, 1).strokeRoundedRect(-fw2 / 2, picY - fh2 / 2, fw2, fh2, 10 * S);
      fr.lineStyle(2 * S, 0xff8a3c, 0.9).strokeRoundedRect(-fw2 / 2 + 4 * S, picY - fh2 / 2 + 4 * S, fw2 - 8 * S, fh2 - 8 * S, 7 * S);
      card.add(fr);
    }
    card.add(pic);
    if (crispyOn) card.add(this.add.image(pic.displayWidth / 2 - 4 * S, picY - pic.displayHeight / 2 + 4 * S, 'ic_flame').setScale(0.7));
    if (!unlocked) card.add(this.add.image(0, picY, 'ic_lock').setScale(1.6));
    if (!st.built) {
      const rib = this.add.container(0, picY + pic.displayHeight / 2 - 4 * S);
      const g = this.add.graphics();
      const rw = 150 * S;
      g.fillStyle(0x24160d, 1).fillRoundedRect(-rw / 2 - 2 * S, -15 * S, rw + 4 * S, 30 * S, 8 * S);
      g.fillStyle(COLORS.red, 1).fillRoundedRect(-rw / 2, -13 * S, rw, 26 * S, 7 * S);
      rib.add([g, txt(this, 0, 0, 'COMING SOON', 15, CSS.cream, { stroke: false })]);
      rib.setAngle(-4);
      card.add(rib);
    }

    let y = picY + pic.displayHeight / 2 + 30 * S;
    card.add(txt(this, 0, y, `STAGE ${st.num}`, 13, CSS.muted, { stroke: false }));
    y += 24 * S;
    const nameT = txt(this, 0, y, st.name, 24, unlocked ? CSS.cream : CSS.muted);
    card.add(nameT);
    // Flame star: cleared on Extra Crispy at least once.
    if ((save.crispyClears?.[st.id] ?? 0) > 0) card.add(this.add.image(nameT.width / 2 + 18 * S, y, 'ic_flame').setScale(0.55).setTint(0xffd27a));
    y += 30 * S;
    // Difficulty: one flame per step up.
    for (let i = 0; i < 3; i++) {
      const f = this.add.image((i - 1) * 26 * S, y, 'ic_flame').setScale(0.65);
      if (i >= st.pips) f.setAlpha(0.22);
      card.add(f);
    }
    y += 24 * S;
    const story = txt(this, 0, y, st.story, 14, '#e8d8c0', { bold: false, wrap: (pw - 60 * S) / S }).setOrigin(0.5, 0);
    card.add(story);
    y += story.height + 18 * S;
    if (unlocked && st.built) {
      const bagel = BAGELS.find((b) => b.id === save.selected) ?? BAGELS[0];
      const line = (m: RunMode) => {
        const label = m === 'quick' ? 'Quick' : m === 'endless' ? 'Endless' : 'Full';
        return bestText(label, getBest(save, bagel.id, bestStage(st.id, m, crispyOn)), m === 'endless');
      };
      const lines = [line('full'), line('quick')];
      if (modesOpen(save, st)) lines.push(line('endless'));
      card.add(txt(this, 0, y, `${bagel.name}'s bests${crispyOn ? ' (Extra Crispy)' : ''}`, 13, crispyOn ? '#ff9a5c' : CSS.gold, { stroke: false }));
      card.add(txt(this, 0, y + 20 * S, lines.join('\n'), 13, CSS.cream, { bold: false, stroke: false }).setOrigin(0.5, 0));
    } else {
      card.add(txt(this, 0, y, `Unlock: ${st.unlockText}`, 15, CSS.gold));
      const note = unlocked ? 'Goal done! This stage is still being baked.' : `Clear Stage ${stageById(st.unlockAfter ?? undefined).num} first`;
      card.add(txt(this, 0, y + 22 * S, note, 12, CSS.muted, { bold: false, stroke: false }));
    }

    if (slideFrom) {
      card.x = W / 2 + slideFrom * 120 * S;
      card.alpha = 0;
      this.tweens.add({ targets: card, x: W / 2, alpha: 1, duration: 220, ease: 'Cubic.Out' });
    }

    // Flip between stages: chevrons beside the picture, swipe, and dots.
    const go = (d: number) => {
      this.stageIdx = (this.stageIdx + d + STAGES.length) % STAGES.length;
      sfx('swoosh');
      if (!stagePlayable(save, STAGES[this.stageIdx])) sfx('lock');
      this.drawStages(save, d);
    };
    const ad = 44 * S;
    const ax = pw / 2 - 30 * S;
    c.add(button(this, W / 2 - ax, picY, ad, ad, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 22 }));
    c.add(button(this, W / 2 + ax, picY, ad, ad, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 22 }));
    const zone = this.add.zone(W / 2, picY, pw - 2 * ad - 30 * S, 150 * S).setInteractive();
    c.add(zone);
    let sx: number | null = null;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (sx = p.x));
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (sx === null) return;
      const dx = p.x - sx;
      sx = null;
      if (Math.abs(dx) > 40 * S) go(dx < 0 ? 1 : -1);
    });
    const dots = this.add.graphics();
    STAGES.forEach((s2, i) => {
      const x = W / 2 + (i - (STAGES.length - 1) / 2) * 14 * S;
      const on = i === this.stageIdx;
      dots.fillStyle(on ? COLORS.gold : stagePlayable(save, s2) ? COLORS.panelLight : 0x1d140d).fillCircle(x, top + 64 * S, (on ? 4 : 3) * S);
    });
    c.add(dots);

    // Bottom: Back, and Play this stage (or why it can't be played yet).
    const by = top + ph - 40 * S;
    const bw = (pw - 50 * S) / 2;
    c.add(button(this, W / 2 - bw / 2 - 5 * S, by, bw, 48 * S, 'Back', close, { color: COLORS.panelLight, textColor: CSS.cream, size: 19 }));
    const pickLabel = playable ? (picked ? 'Picked' : 'Pick') : st.built ? 'Locked' : 'Soon';
    c.add(
      button(this, W / 2 + bw / 2 + 5 * S, by, bw, 48 * S, pickLabel, () => {
        if (!playable) {
          sfx('lock');
          return;
        }
        save.stage = st.id;
        persist();
        close();
      }, { size: 20, muted: !playable }),
    );
  }

  /** Scales an icon (any texture: bagel, weapon icon, stage picture) to fit a square box. */
  private fitIcon(x: number, y: number, key: string, box: number): Phaser.GameObjects.Image {
    const im = this.add.image(x, y, key);
    im.setScale(Math.min(box / im.width, box / im.height));
    return im;
  }

  /** The Goals page: Unlocks (bagels, weapons, stages), Challenges (one-time Dough rewards) and Secrets. */
  private openGoals(tab = 0, page = 0): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const save = load();
    this.bakery?.destroy();
    const c = this.add.container(0, 0);
    this.bakery = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    interface Row { icon: string; dark?: boolean; name: string; sub: string; frac: number; done: boolean; reward?: number; isNew?: boolean }
    let rows: Row[] = [];
    let sub = '';
    if (tab === 0) {
      for (const b of BAGELS) {
        if (!b.goal || b.secret) continue;
        const st = goalStatus(save, b);
        const done = save.unlocked.includes(b.id);
        rows.push({ icon: b.tex, dark: !done, name: b.name, sub: done ? 'Unlocked' : `${b.goal.text}: ${st.progress}`, frac: done ? 1 : st.frac, done });
      }
      for (const w of Object.values(WEAPONS)) {
        if (!w.unlock) continue;
        const st = weaponGoalStatus(save, w);
        const done = weaponOpen(save, w.id);
        rows.push({ icon: w.icon, dark: !done, name: w.name, sub: done ? 'Unlocked' : `${w.unlock.text}: ${st.progress}`, frac: done ? 1 : st.frac, done });
      }
      for (const st of STAGES) {
        if (!st.unlockAfter || !st.built) continue;
        const done = stageUnlocked(save, st);
        rows.push({ icon: `${st.thumb}_sm`, dark: !done, name: `Stage ${st.num}: ${st.name}`, sub: done ? 'Unlocked' : st.unlockText, frac: done ? 1 : 0, done });
      }
      sub = `${rows.filter((r) => r.done).length} of ${rows.length} unlocked`;
    } else if (tab === 1) {
      const fresh = new Set(unseenGoals(save));
      rows = CHALLENGES.map((ch) => {
        const st = ch.status(save);
        const done = (save.goalsPaid ?? []).includes(ch.id);
        return { icon: ch.icon, name: ch.name, sub: done ? `Done! +${ch.reward} Dough` : st.progress, frac: done ? 1 : st.frac, done, reward: ch.reward, isNew: fresh.has(ch.id) };
      });
      const earned = CHALLENGES.filter((ch) => (save.goalsPaid ?? []).includes(ch.id)).reduce((a, ch) => a + ch.reward, 0);
      sub = `${rows.filter((r) => r.done).length} of ${rows.length} done · ${earned} Dough earned`;
      // Seen now: the red dot on the Goals button goes away.
      if (fresh.size) {
        save.goalsSeen = [...(save.goalsPaid ?? [])];
        persist();
      }
    } else {
      const rainbow = BAGELS.find((b) => b.secret)!;
      const bagelFound = save.unlocked.includes(rainbow.id);
      const comboFound = (save.secrets ?? []).includes('combo');
      rows = [
        bagelFound
          ? { icon: rainbow.tex, name: `${rainbow.name} bagel`, sub: `Found! ${rainbow.goal!.text}.`, frac: 1, done: true }
          : { icon: 'ic_secret', name: '???', sub: SECRET_BAGEL_HINT, frac: 0, done: false },
        comboFound
          ? { icon: COMBO.icon, name: COMBO.name, sub: 'Found! Evolve Schmear Flood and Lox Cyclone, then open a gold toaster.', frac: 1, done: true }
          : { icon: 'ic_secret', name: '???', sub: SECRET_RECIPE_HINT, frac: 0, done: false },
      ];
      sub = `${rows.filter((r) => r.done).length} of ${rows.length} secrets found`;
    }
    const PER = 5;
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages - 1);
    const shown = rows.slice(page * PER, page * PER + PER);
    const pw = Math.min(W - 24 * S, 400 * S);
    const rowH = 68 * S;
    const ph = 150 * S + PER * rowH + 52 * S + 66 * S;
    c.add(panel(this, W / 2, H / 2, pw, ph));
    const top = H / 2 - ph / 2;
    c.add(txt(this, W / 2, top + 36 * S, 'GOALS', 28, CSS.gold));
    c.add(txt(this, W / 2, top + 64 * S, sub, 14, CSS.cream, { bold: false }));
    const cw = pw - 28 * S;
    const tw = (cw - 16 * S) / 3;
    const unseen = unseenGoals(save).length > 0;
    ['Unlocks', 'Challenges', 'Secrets'].forEach((label, i) => {
      const on = i === tab;
      const b = button(this, W / 2 + (i - 1) * (tw + 8 * S), top + 104 * S, tw, 38 * S, label, () => {
        if (!on) this.openGoals(i);
      }, { size: tw < 110 * S ? 14 : 16, muted: !on });
      c.add(b);
      if (i === 1 && unseen && !on) {
        const dot = this.add.graphics();
        dot.fillStyle(0x24160d, 1).fillCircle(tw / 2 - 5 * S, -16 * S, 7 * S);
        dot.fillStyle(COLORS.red, 1).fillCircle(tw / 2 - 5 * S, -16 * S, 5 * S);
        b.add(dot);
      }
    });
    const lx = W / 2 - pw / 2 + 20 * S;
    const textX = lx + 46 * S;
    const rightW = 58 * S;
    const textW = pw - 40 * S - 46 * S - rightW;
    shown.forEach((r, i) => {
      const y = top + 150 * S + i * rowH + rowH / 2;
      const ic = this.fitIcon(lx + 16 * S, y - 2 * S, r.icon, 32 * S);
      if (r.dark) ic.setTint(0x55504a);
      c.add(ic);
      const name = txt(this, textX, y - 29 * S, r.name, 14, r.done ? CSS.gold : CSS.cream, { stroke: false, wrap: textW / S, align: 'left' }).setOrigin(0, 0);
      c.add(name);
      const note = txt(this, textX, name.y + name.height + 1 * S, r.sub, 12, r.done ? '#c9e6a8' : CSS.muted, { bold: false, stroke: false, wrap: textW / S, align: 'left' }).setOrigin(0, 0);
      c.add(note);
      // Progress bar along the bottom of the row.
      const barY = Math.max(y + 22 * S, note.y + note.height + 4 * S);
      const g = this.add.graphics();
      g.fillStyle(0x1d140d, 1).fillRoundedRect(textX, barY - 3 * S, textW, 6 * S, 3 * S);
      if (r.frac > 0) g.fillStyle(r.done ? COLORS.green : COLORS.gold, 1).fillRoundedRect(textX, barY - 3 * S, Math.max(6 * S, textW * r.frac), 6 * S, 3 * S);
      c.add(g);
      const rx = W / 2 + pw / 2 - 20 * S - rightW / 2;
      if (r.done) c.add(this.add.image(rx, y, 'ic_check').setScale(0.8));
      else if (r.reward) {
        c.add(this.add.image(rx - 16 * S, y, 'coin').setScale(1.1));
        c.add(txt(this, rx - 6 * S, y, `+${r.reward}`, 14, CSS.gold, { stroke: false }).setOrigin(0, 0.5));
      } else if (tab === 0) c.add(this.add.image(rx, y, 'ic_lock').setScale(0.6).setAlpha(0.7));
      if (r.isNew) {
        const tag = txt(this, rx, y - 22 * S, 'NEW!', 11, CSS.red);
        c.add(tag);
        this.tweens.add({ targets: tag, scale: 1.15, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    });
    let by = top + 150 * S + PER * rowH + 22 * S;
    if (pages > 1) {
      const go = (d: number) => this.openGoals(tab, (page + d + pages) % pages);
      c.add(button(this, W / 2 - 60 * S, by, 44 * S, 40 * S, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 20 }));
      c.add(txt(this, W / 2, by, `${page + 1} / ${pages}`, 15, CSS.cream));
      c.add(button(this, W / 2 + 60 * S, by, 44 * S, 40 * S, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 20 }));
    }
    by += 46 * S;
    c.add(
      button(this, W / 2, by + 20 * S, 160 * S, 46 * S, 'Done', () => {
        c.destroy();
        this.bakery = null;
        this.build();
      }, { size: 20 }),
    );
  }

  /** The Cookbook's three tabs: Evolutions, Weapons and Enemies. */
  private cookbookTabs(c: Phaser.GameObjects.Container, tab: number, top: number, pw: number): void {
    const W = this.scale.width;
    const cw = pw - 28 * S;
    const tw = (cw - 16 * S) / 3;
    ['Evolutions', 'Weapons', 'Enemies'].forEach((label, i) => {
      const on = i === tab;
      c.add(
        button(this, W / 2 + (i - 1) * (tw + 8 * S), top + 104 * S, tw, 38 * S, label, () => {
          if (!on) this.openCookbook(i);
        }, { size: tw < 110 * S ? 14 : 16, muted: !on }),
      );
    });
  }

  private openCookbook(tab = 0, page = 0): void {
    if (tab === 2) {
      this.openEnemies(page);
      return;
    }
    const W = this.scale.width;
    const H = this.scale.height;
    const save = load();
    this.bakery?.destroy();
    const c = this.add.container(0, 0);
    this.bakery = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    const all = Object.keys(WEAPONS) as WeaponId[];
    const locked = all.filter((id) => WEAPONS[id].unlock);
    // Five rows a page keeps it on screen on small phones. The secret combo is the last Evolutions row.
    const PER = 5;
    const evoRows: (WeaponId | 'combo')[] = [...all, 'combo'];
    const ids = tab === 0 ? evoRows.slice(page * PER, page * PER + PER) : locked;
    const pages = tab === 0 ? Math.ceil(evoRows.length / PER) : 1;
    const pw = Math.min(W - 24 * S, 400 * S);
    const rowH = 60 * S;
    const ph = 160 * S + PER * rowH + (pages > 1 ? 46 : 0) * S + 66 * S;
    c.add(panel(this, W / 2, H / 2, pw, ph));
    const top = H / 2 - ph / 2;
    c.add(txt(this, W / 2, top + 36 * S, 'THE COOKBOOK', 28, CSS.gold));
    const opened = locked.filter((id) => weaponOpen(save, id)).length;
    const sub = tab === 0 ? `${save.cookbook.length} of ${all.length} evolutions found` : `${opened} of ${locked.length} weapons unlocked`;
    c.add(txt(this, W / 2, top + 64 * S, sub, 14, CSS.cream, { bold: false }));
    this.cookbookTabs(c, tab, top, pw);
    const lx = W / 2 - pw / 2 + 20 * S;
    const small = (x: number, y: number, s: string, wrap: number) =>
      txt(this, x, y, s, 12, CSS.muted, { bold: false, stroke: false, wrap, align: 'left' }).setOrigin(0, 0.5);
    ids.forEach((id, i) => {
      const y = top + 160 * S + i * rowH;
      if (id === 'combo') {
        const found = (save.secrets ?? []).includes('combo');
        c.add(this.add.image(lx + 18 * S, y, found ? WEAPONS.puddle.icon : 'ic_secret').setScale(0.9));
        c.add(txt(this, lx + 44 * S, y, '+', 18, CSS.muted));
        c.add(this.add.image(lx + 70 * S, y, found ? WEAPONS.lox.icon : 'ic_secret').setScale(0.9));
        const tx = lx + 98 * S;
        c.add(txt(this, tx, y - 10 * S, found ? COMBO.name : '???', 16, found ? CSS.gold : CSS.muted).setOrigin(0, 0.5));
        c.add(small(tx, y + 11 * S, found ? 'Schmear Flood + Lox Cyclone' : 'A secret recipe', (pw - 120 * S) / S));
        return;
      }
      const w = WEAPONS[id];
      if (tab === 0) {
        const t = TOPPINGS[w.evolveWith];
        const found = save.cookbook.includes(id);
        c.add(this.add.image(lx + 18 * S, y, w.icon).setScale(0.9));
        c.add(txt(this, lx + 44 * S, y, '+', 18, CSS.muted));
        const ti = this.add.image(lx + 70 * S, y, t.icon).setScale(0.9);
        if (!found) ti.setTintFill(0x1d140d);
        c.add(ti);
        const tx = lx + 98 * S;
        c.add(txt(this, tx, y - 10 * S, found ? w.evoName : '???', 16, found ? CSS.gold : CSS.muted).setOrigin(0, 0.5));
        c.add(small(tx, y + 11 * S, found ? `${w.name} + ${t.name}` : `Max it + a mystery topping`, (pw - 120 * S) / S));
      } else {
        const open = weaponOpen(save, id);
        const st = weaponGoalStatus(save, w);
        const ic = this.add.image(lx + 18 * S, y, w.icon).setScale(0.9);
        if (!open) ic.setTintFill(0x1d140d);
        c.add(ic);
        const tx = lx + 46 * S;
        c.add(txt(this, tx, y - 10 * S, w.name, 16, open ? CSS.gold : CSS.cream).setOrigin(0, 0.5));
        c.add(small(tx, y + 11 * S, open ? w.blurb : `${w.unlock!.text} (${st.progress})`, (pw - 70 * S) / S));
      }
    });
    let by = top + 160 * S + PER * rowH - 10 * S;
    if (pages > 1) {
      const go = (d: number) => this.openCookbook(0, (page + d + pages) % pages);
      c.add(button(this, W / 2 - 60 * S, by + 4 * S, 44 * S, 40 * S, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 20 }));
      c.add(txt(this, W / 2, by + 4 * S, `${page + 1} / ${pages}`, 15, CSS.cream));
      c.add(button(this, W / 2 + 60 * S, by + 4 * S, 44 * S, 40 * S, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 20 }));
      by += 46 * S;
    }
    c.add(
      button(this, W / 2, by + 28 * S, 160 * S, 46 * S, 'Done', () => {
        c.destroy();
        this.bakery = null;
      }, { size: 20 }),
    );
  }

  /** Cookbook Enemies tab: one page per stage. Enemies not met yet are dark shapes; beaten bosses get a crown. Tap one to read about it. */
  private openEnemies(stageIdx: number, pick = 0): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const save = load();
    this.bakery?.destroy();
    const c = this.add.container(0, 0);
    this.bakery = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    const st = STAGES[stageIdx];
    const list = ENEMY_BOOK[st.id];
    const beaten = new Set(save.beaten ?? []);
    // A beaten boss was certainly met (older saves recorded wins before meetings).
    const met = new Set([...(save.met ?? []), ...beaten]);
    const COLS = 5;
    const pw = Math.min(W - 24 * S, 400 * S);
    const cellW = (pw - 28 * S) / COLS;
    const cellH = 70 * S;
    const gridRows = 3; // the biggest cast (the Freezer, 14) fits in 3 rows
    const infoH = 70 * S;
    const ph = 150 * S + gridRows * cellH + infoH + 62 * S + 66 * S;
    c.add(panel(this, W / 2, H / 2, pw, ph));
    const top = H / 2 - ph / 2;
    c.add(txt(this, W / 2, top + 36 * S, 'THE COOKBOOK', 28, CSS.gold));
    const total = Object.values(ENEMY_BOOK).flat();
    c.add(txt(this, W / 2, top + 64 * S, `${total.filter((e) => met.has(e.kind)).length} of ${total.length} enemies met`, 14, CSS.cream, { bold: false }));
    this.cookbookTabs(c, 2, top, pw);
    const gx = W / 2 - pw / 2 + 14 * S;
    const gy = top + 140 * S;
    const info = this.add.container(0, 0);
    c.add(info);
    const sel = this.add.graphics();
    c.add(sel);
    const showInfo = (i: number) => {
      info.removeAll(true);
      sel.clear();
      const e = list[i];
      if (!e) return;
      const cx = gx + (i % COLS) * cellW;
      const cy = gy + Math.floor(i / COLS) * cellH;
      sel.lineStyle(2.5 * S, COLORS.gold, 1).strokeRoundedRect(cx + 2 * S, cy + 2 * S, cellW - 4 * S, cellH - 4 * S, 10 * S);
      const known = met.has(e.kind);
      const iy = gy + gridRows * cellH + 8 * S;
      const g = this.add.graphics();
      g.fillStyle(0x1d140d, 0.8).fillRoundedRect(gx, iy, pw - 28 * S, infoH - 8 * S, 12 * S);
      info.add(g);
      const title = known ? e.name + (e.role && beaten.has(e.kind) ? '  ♛' : '') : '???';
      info.add(txt(this, W / 2, iy + 17 * S, title, 16, known ? CSS.gold : CSS.muted, { stroke: false }));
      const line = known ? e.blurb : `Not met yet. Look for it in ${st.name}.`;
      info.add(txt(this, W / 2, iy + 38 * S, line, 12, '#e8d8c0', { bold: false, stroke: false, wrap: (pw - 48 * S) / S }).setOrigin(0.5, 0));
    };
    list.forEach((e, i) => {
      const cx = gx + (i % COLS) * cellW + cellW / 2;
      const cy = gy + Math.floor(i / COLS) * cellH;
      const known = met.has(e.kind);
      const big = e.role === 'mini' || e.role === 'boss';
      const g = this.add.graphics();
      g.fillStyle(big ? 0x5a4126 : 0x4a3828, 1).fillRoundedRect(cx - cellW / 2 + 4 * S, cy + 4 * S, cellW - 8 * S, cellH - 8 * S, 9 * S);
      if (big) g.lineStyle(2 * S, COLORS.gold, 0.8).strokeRoundedRect(cx - cellW / 2 + 4 * S, cy + 4 * S, cellW - 8 * S, cellH - 8 * S, 9 * S);
      c.add(g);
      const pic = this.fitIcon(cx, cy + 26 * S, ENEMIES[e.kind].tex, (big ? 40 : 32) * S);
      if (!known) pic.setTintFill(0x1d140d);
      c.add(pic);
      const short = known ? e.name.replace(/^The /, '') : '???';
      c.add(txt(this, cx, cy + 54 * S, short, 9, known ? CSS.cream : CSS.muted, { stroke: false, wrap: (cellW - 8 * S) / S }).setOrigin(0.5, 0.5).setLineSpacing(-2 * S));
      if (e.role && beaten.has(e.kind)) c.add(this.add.image(cx + cellW / 2 - 13 * S, cy + 13 * S, 'ic_crown').setScale(0.45));
      const z = this.add.zone(cx, cy + cellH / 2, cellW, cellH).setInteractive();
      z.on('pointerup', () => {
        sfx('click');
        showInfo(i);
      });
      c.add(z);
    });
    c.bringToTop(sel);
    showInfo(Math.min(pick, list.length - 1));
    // Flip between stages.
    const ny = gy + gridRows * cellH + infoH + 30 * S;
    const go = (d: number) => {
      sfx('swoosh');
      this.openEnemies((stageIdx + d + STAGES.length) % STAGES.length);
    };
    c.add(button(this, W / 2 - pw / 2 + 44 * S, ny, 44 * S, 40 * S, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 20 }));
    c.add(txt(this, W / 2, ny, `Stage ${st.num}: ${st.name}`, 15, CSS.cream));
    c.add(button(this, W / 2 + pw / 2 - 44 * S, ny, 44 * S, 40 * S, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 20 }));
    c.add(
      button(this, W / 2, ny + 66 * S, 160 * S, 46 * S, 'Done', () => {
        c.destroy();
        this.bakery = null;
      }, { size: 20 }),
    );
  }

  private openBakery(tab = 0): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const save = load();
    this.bakery?.destroy();
    const c = this.add.container(0, 0);
    this.bakery = c;
    const dim = this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive();
    c.add(dim);
    const pw = Math.min(W - 24 * S, 400 * S);
    const cardH = 78 * S;
    const gap = 10 * S;
    const list = BAKERY.filter((u) => (u.tab ?? 0) === tab);
    const tabH = 50 * S;
    const ph = 168 * S + tabH + list.length * (cardH + gap);
    c.add(panel(this, W / 2, H / 2, pw, ph));
    const top = H / 2 - ph / 2;
    c.add(txt(this, W / 2, top + 36 * S, 'THE BAKERY', 28, CSS.gold));
    const wallet = pill(this, W / 2, top + 70 * S, 'coin', `${save.dough} Dough to spend`, { size: 15, color: CSS.gold, h: 30 });
    c.add(wallet);
    let shown = save.dough;
    const setWallet = (v: number) => {
      (wallet.getData('label') as Phaser.GameObjects.Text).setText(`${v} Dough to spend`);
      if (this.doughPill) (this.doughPill.getData('label') as Phaser.GameObjects.Text).setText(`${v} Dough`);
    };
    const cw = pw - 28 * S;
    // Two tabs so all eight upgrades fit on a phone: Basics and Extras.
    const tw = (cw - 10 * S) / 2;
    ['Basics', 'Extras'].forEach((label, i) => {
      const on = i === tab;
      c.add(
        button(this, W / 2 + (i ? 1 : -1) * (tw / 2 + 5 * S), top + 112 * S, tw, 38 * S, label, () => {
          if (!on) this.openBakery(i);
        }, { size: 16, muted: !on }),
      );
    });
    const refreshers: (() => void)[] = [];
    list.forEach((u, i) => {
      const y = top + 104 * S + tabH + cardH / 2 + i * (cardH + gap);
      const row = this.add.container(W / 2, y);
      c.add(row);
      const bg = this.add.graphics();
      const lx = -cw / 2;
      const pips = this.add.graphics();
      const nameT = txt(this, lx + 74 * S, -18 * S, u.name, 17, CSS.cream).setOrigin(0, 0.5);
      const blurb = txt(this, lx + 74 * S, 4 * S, u.blurb, 12, CSS.muted, { bold: false, stroke: false }).setOrigin(0, 0.5);
      const icon = this.add.image(lx + 38 * S, 0, u.icon).setScale(1.25);
      row.add([bg, icon, nameT, blurb, pips]);
      let btn: Phaser.GameObjects.Container | null = null;
      const draw = () => {
        const rank = save.upgrades[u.id] ?? 0;
        const maxed = rank >= u.costs.length;
        const cost = maxed ? 0 : u.costs[rank];
        const afford = !maxed && save.dough >= cost;
        bg.clear();
        bg.fillStyle(0x1d140d, 1).fillRoundedRect(-cw / 2, -cardH / 2 + 4 * S, cw, cardH, 14 * S);
        bg.fillStyle(0x4a3828, 1).fillRoundedRect(-cw / 2, -cardH / 2, cw, cardH, 14 * S);
        bg.lineStyle(2.5 * S, maxed ? COLORS.gold : 0x24160d, 1).strokeRoundedRect(-cw / 2, -cardH / 2, cw, cardH, 14 * S);
        bg.fillStyle(0x7a4f2c, 1).fillRoundedRect(lx + 10 * S, -26 * S, 56 * S, 52 * S, 12 * S);
        bg.lineStyle(2 * S, 0x24160d, 1).strokeRoundedRect(lx + 10 * S, -26 * S, 56 * S, 52 * S, 12 * S);
        pips.clear();
        drawPips(pips, lx + 80 * S, 24 * S, u.costs.length, rank, false, COLORS.gold, 4 * S, 13 * S);
        btn?.destroy();
        btn = null;
        if (maxed) {
          const badge = this.add.container(cw / 2 - 52 * S, 0);
          const bgm = this.add.graphics();
          bgm.fillStyle(0x24160d, 1).fillRoundedRect(-38 * S, -17 * S, 76 * S, 34 * S, 17 * S);
          bgm.fillStyle(COLORS.gold, 1).fillRoundedRect(-36 * S, -15 * S, 72 * S, 30 * S, 15 * S);
          badge.add([bgm, txt(this, 0, 0, 'MAX', 17, CSS.dark, { stroke: false })]);
          btn = badge;
        } else {
          btn = button(this, cw / 2 - 54 * S, -3 * S, 92 * S, 42 * S, `${cost}`, () => {
            if (save.dough < cost) {
              this.tweens.add({ targets: row, x: { from: W / 2 - 6 * S, to: W / 2 }, duration: 260, ease: 'Elastic.Out' });
              return;
            }
            sfx('buy');
            const from = save.dough;
            save.dough -= cost;
            save.upgrades[u.id] = rank + 1;
            persist();
            // Pop the new pip and count the Dough down, without redrawing the whole screen.
            const pop = this.add.circle(W / 2 + lx + 80 * S + rank * 13 * S, y + 24 * S, 7 * S, COLORS.gold);
            c.add(pop);
            this.tweens.add({ targets: pop, scale: { from: 2.2, to: 0.6 }, alpha: { from: 1, to: 0 }, duration: 380, ease: 'Cubic.Out', onComplete: () => pop.destroy() });
            this.tweens.addCounter({
              from,
              to: save.dough,
              duration: 400,
              onUpdate: (tw) => {
                shown = Math.round(tw.getValue() ?? save.dough);
                setWallet(shown);
              },
              onComplete: () => sfx('coin'),
            });
            for (const r of refreshers) r();
          }, { size: 18, icon: 'coin', muted: !afford });
        }
        row.add(btn);
      };
      draw();
      refreshers.push(draw);
    });
    c.add(
      button(this, W / 2, top + ph - 38 * S, 160 * S, 46 * S, 'Done', () => {
        c.destroy();
        this.bakery = null;
        this.build();
      }, { size: 20 }),
    );
  }
}
