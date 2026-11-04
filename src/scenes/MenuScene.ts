import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { BAGELS, BAKERY, STAGES, TOPPINGS, WEAPONS, stageById, type StageDef, type WeaponId } from '../data';
import { goalStatus, pickedStage, stagePlayable, stageUnlocked } from '../progress';
import { clearRun, loadRun } from '../runsave';
import { bestStage, getBest, load, persist, type SaveData } from '../save';
import { makeTextures } from '../textures';
import { button, drawPips, panel, pill, txt } from '../ui';
import { musicOn, setMusic, setSound, sfx, soundOn, unlockAudio } from '../sfx';
import { playMusic } from '../music';

/** Height of the menu's stage button row, in CSS px. */
const STAGE_ROW = 48;
const STAGE_ROW_COMPACT = 40;

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
    if (!compact) c.add(txt(this, W / 2, titleY + 86 * k * S, save.quick ? 'Survive the Stale for 3 minutes' : 'Survive the Stale for 5 minutes', 15, CSS.muted, { bold: false }));

    // Bagel picker
    const bagel = BAGELS[this.idx];
    const locked = !save.unlocked.includes(bagel.id);
    const gs = locked && bagel.goal ? goalStatus(save, bagel) : null;
    // Description first, so the picker can be sized to fit above the buttons on any screen height.
    const desc = txt(this, W / 2, 0, gs ? `Unlock: ${bagel.goal!.text}` : bagel.quirk, 14, '#e8d8c0', {
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
    const nameT = txt(this, W / 2, by + R + 48 * sp * S, bagel.name, compact ? 22 : 26, locked ? CSS.muted : CSS.cream);
    c.add(nameT);
    slide.push(nameT);
    // Short screens have no room for a locked bagel's progress bar: its progress goes in the best line's place.
    if (gs && compact) c.add(txt(this, W / 2, by + R + 72 * sp * S, gs.progress, 14, CSS.muted, { bold: false }));
    if (!locked) {
      const best = getBest(save, bagel.id, bestStage(stage.id, !!save.quick));
      const label = `Stage ${stage.num}${save.quick ? ' Quick' : ''}`;
      const line = !best ? `${label} best: no runs yet` : best.cleared ? `♛ ${label} cleared  ·  ${best.kills} kills` : `${label} best: ${fmtTime(best.time)}  ·  ${best.kills} kills`;
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
      const label = `Resume ${saved.quick ? 'Quick ' : ''}${name}, Stage ${stageById(saved.stage).num}, ${fmtTime(saved.now)}`;
      const rb = button(this, W / 2, playY - 66 * S, Math.min(W - 60 * S, 300 * S), 44 * S, label, () => {
        unlockAudio();
        this.cameras.main.fadeOut(200, 18, 12, 8);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { resume: true }));
      }, { color: COLORS.green, textColor: CSS.dark, size: label.length > 34 ? 14 : 16, radius: 12 });
      c.add(rb);
    } else {
      toggle(W / 2 - tw - 8 * S, () => `Practice: ${save.practice ? 'On' : 'Off'}`, () => {
        save.practice = !save.practice;
        persist();
      });
      toggle(W / 2, () => `Music: ${musicOn() ? 'On' : 'Off'}`, () => setMusic(!musicOn()));
      toggle(W / 2 + tw + 8 * S, () => `Sound: ${soundOn() ? 'On' : 'Off'}`, () => setSound(!soundOn()));
    }
    // Full / Quick switch: a two-part pill above the toggles. Remembers the last choice.
    {
      const sw = Math.min(W - 60 * S, 300 * S);
      const sh = 38 * S;
      const y = playY - 66 * S - 52 * S;
      const g = this.add.graphics();
      g.fillStyle(0x24160d, 1).fillRoundedRect(W / 2 - sw / 2 - 2.5 * S, y - sh / 2 - 2.5 * S, sw + 5 * S, sh + 5 * S, sh / 2 + 2.5 * S);
      g.fillStyle(0x1d140d, 1).fillRoundedRect(W / 2 - sw / 2, y - sh / 2, sw, sh, sh / 2);
      const x0 = save.quick ? W / 2 : W / 2 - sw / 2;
      g.fillStyle(COLORS.gold, 1).fillRoundedRect(x0 + 3 * S, y - sh / 2 + 3 * S, sw / 2 - 6 * S, sh - 6 * S, sh / 2 - 3 * S);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(x0 + 10 * S, y - sh / 2 + 6 * S, sw / 2 - 20 * S, 8 * S, 4 * S);
      c.add(g);
      const half = (quick: boolean, label: string) => {
        const on = !!save.quick === quick;
        const cx = W / 2 + (quick ? sw / 4 : -sw / 4);
        const t = txt(this, cx + (quick ? 9 * S : 0), y, label, 15, on ? CSS.dark : CSS.muted, { stroke: false });
        c.add(t);
        if (quick) c.add(this.add.image(t.x - t.width / 2 - 11 * S, y, 'ic_bolt').setScale(0.55).setAlpha(on ? 1 : 0.6));
        const z = this.add.zone(cx, y, sw / 2, sh + 8 * S).setInteractive();
        z.on('pointerup', () => {
          if (on) return;
          sfx('click');
          save.quick = quick;
          persist();
          this.build();
        });
        c.add(z);
      };
      half(false, 'Full 5:00');
      half(true, 'Quick 3:00');
      // Stage button above the switch: shows the picked stage and opens the stage picker.
      c.add(this.stageButton(stage, W / 2, y - sh / 2 - 12 * S - ((compact ? STAGE_ROW_COMPACT : STAGE_ROW) / 2 - 4) * S, sw, compact));
    }
    const play = button(this, W / 2, playY, Math.min(W - 60 * S, 280 * S), 70 * S, locked ? 'LOCKED' : 'PLAY', () => {
      if (locked) return;
      unlockAudio();
      clearRun();
      this.cameras.main.fadeOut(200, 18, 12, 8);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { bagel: bagel.id, stage: stage.id, practice: !!save.practice, quick: !!save.quick }));
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
    const stats = [
      pill(this, 0, bottom - 24 * S, 'ic_clock', `Best ${fmtTime(save.bestTime)}`, { size: 13, h: 26 }),
      pill(this, 0, bottom - 24 * S, 'ic_crown', `${save.clears} clears`, { size: 13, h: 26 }),
      pill(this, 0, bottom - 24 * S, 'ic_book', `${save.cookbook.length}/6`, { size: 13, h: 26 }),
    ];
    const gap = 8 * S;
    let x = W / 2 - (stats.reduce((a, p) => a + p.width, 0) + gap * (stats.length - 1)) / 2;
    for (const p of stats) {
      p.x = x + p.width / 2;
      x += p.width + gap;
      c.add(p);
    }
  }

  /** Chunky button with the stage's picture, its name and a chevron. */
  private stageButton(stage: StageDef, x: number, y: number, w: number, compact: boolean): Phaser.GameObjects.Container {
    const h = (compact ? 34 : 40) * S;
    const b = button(this, x, y, w, h, '', () => this.openStages(), { color: COLORS.panelLight, radius: 12 });
    const pic = this.add.image(-w / 2 + 12 * S, 0, `${stage.thumb}_sm`).setOrigin(0, 0.5);
    pic.setScale((h - 10 * S) / pic.height);
    const label = txt(this, pic.x + pic.displayWidth + 9 * S, 0, `Stage ${stage.num}: ${stage.name}`, 15, CSS.cream, { stroke: false }).setOrigin(0, 0.5);
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
    card.add(pic);
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
    card.add(txt(this, 0, y, st.name, 24, unlocked ? CSS.cream : CSS.muted));
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
      const line = (quick: boolean) => {
        const best = getBest(save, bagel.id, bestStage(st.id, quick));
        const label = quick ? 'Quick' : 'Full';
        return !best ? `${label}: no runs yet` : best.cleared ? `${label}: ♛ cleared · ${best.kills} kills` : `${label}: ${fmtTime(best.time)} · ${best.kills} kills`;
      };
      card.add(txt(this, 0, y, `${bagel.name}'s bests`, 13, CSS.gold, { stroke: false }));
      card.add(txt(this, 0, y + 20 * S, `${line(false)}\n${line(true)}`, 13, CSS.cream, { bold: false, stroke: false }).setOrigin(0.5, 0));
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
    const cardH = 78 * S;
    const gap = 10 * S;
    const ph = 168 * S + BAKERY.length * (cardH + gap);
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
    const refreshers: (() => void)[] = [];
    BAKERY.forEach((u, i) => {
      const y = top + 104 * S + cardH / 2 + i * (cardH + gap);
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
