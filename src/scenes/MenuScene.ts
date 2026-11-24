import Phaser from 'phaser';
import { Face } from '../face';
import { COLORS, CSS, S, VERSION, fmtTime, safeInsets } from '../config';
import { BAGELS, BAKERY, ENEMIES, ENEMY_BOOK, STAGES, TOPPINGS, WEAPONS, stageById, type StageDef, type WeaponId } from '../data';
import { CHALLENGES, claimGoals, unseenGoals } from '../goals';
import { COMBOS } from '../weapons';
import { checkUnlocks, checkWeaponUnlocks, goalStatus, modesOpen, weaponGoalStatus, weaponOpen, pickedStage, stagePlayable, stageUnlocked } from '../progress';
import { clearRun, loadRun } from '../runsave';
import { bestStage, getBest, load, persist, takeRecovered, type BestScore, type RunMode, type SaveData } from '../save';
import { ctex } from '../art';
import { bigBagel, makeEnemyTextures, makeTextures } from '../textures';
import { HEADER, button, drawPips, fit, pill, popupFrame, txt } from '../ui';
import { sfx, unlockAudio } from '../sfx';
import { playMusic } from '../music';
import { buildSettings, segmented } from '../settingsPanel';
import { WHATS_NEW } from '../whatsnew';
import { wipeOpen, wipeTo } from '../wipe';
import { MENU_LOCK, TIPS, clearFresh, markTip, menuFresh, menuOpen, tipDue, type MenuItem, type TipId } from '../tips';
import { tipBox, tipIn } from '../run/tutor';

const SECRET_BAGEL_HINT = 'A secret bagel. Keep clearing stages to find it.';
const SECRET_RECIPE_HINT = 'A secret recipe. Keep evolving weapons to find it.';
/** Charred brown for the stage row and card frame when Extra Crispy is on. */
const CRISPY_COLOR = 0x6b2e14;
const INK = 0x24160d;
/** Blue for anything about practice runs (the PLAY button, the picker's switch note). */
const PRACTICE_COLOR = 0x5aa9e6;
/** The backup reminder comes back this long after the last backup or the last "Later". */
const BACKUP_EVERY_MS = 30 * 24 * 3600 * 1000;

/**
 * A best-score line. The stage picker's list: "Endless: 12:34", "Full: ♛ cleared · 412 kills".
 * Under the bagel on the menu (big): "Stage 1 best: 3:20  ·  140 kills", "♛ Stage 1 cleared  ·  412 kills".
 */
function bestText(label: string, best: BestScore | undefined, endless: boolean, big = false): string {
  const head = big ? `${label} best` : label;
  const dot = big ? '  ·  ' : ' · ';
  if (!best) return `${head}: no runs yet`;
  if (endless) return `${head}: ${fmtTime(best.time)}`;
  if (best.cleared) return big ? `♛ ${label} cleared${dot}${best.kills} kills` : `${label}: ♛ cleared${dot}${best.kills} kills`;
  return `${head}: ${fmtTime(best.time)}${dot}${best.kills} kills`;
}

export class MenuScene extends Phaser.Scene {
  private idx = 0;
  private root!: Phaser.GameObjects.Container;
  /** The open pop-up (Bakery, Goals, Cookbook, Settings, the stage picker or a notice), if any. */
  private popup: Phaser.GameObjects.Container | null = null;
  private doughPill: Phaser.GameObjects.Container | null = null;
  private slideFrom = 0;
  /** Card shown in the stage picker. */
  private stageIdx = 0;
  /** A pop-up to open straight away (the first run's results screen sends the player to the Bakery). */
  private openOn = '';

  constructor() {
    super('menu');
  }

  init(data: { open?: string }): void {
    this.openOn = data?.open ?? '';
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
    if (!wipeOpen()) this.cameras.main.fadeIn(250, 43, 33, 24);
    if (this.openOn === 'bakery' && menuOpen(save, 'bakery')) {
      clearFresh(save, 'bakery');
      this.openBakery();
    } else this.greet(save);
  }

  /** One note at most each time the menu opens: a recovered save, what's new after an update, or the backup reminder. */
  private greet(save: SaveData): void {
    const played = save.totalKills > 0 || save.dough > 0;
    if (takeRecovered()) {
      this.notice('SAVE RESTORED', "Your save couldn't be read, so the game loaded its spare copy. Your last run or two may be missing.", [['OK', () => this.closePopup(false)]]);
      return;
    }
    if (save.seenVersion !== VERSION) {
      save.seenVersion = VERSION;
      persist();
      // Someone opening the game for the first time has nothing to compare with.
      if (played) {
        this.notice("WHAT'S NEW", WHATS_NEW.lines.map((l) => `• ${l}`).join('\n'), [['Nice!', () => this.closePopup(false)]], WHATS_NEW.title);
        return;
      }
    }
    const last = Math.max(save.backupAt ?? 0, save.backupNudge ?? 0);
    if (save.clears > 0 && Date.now() - last > BACKUP_EVERY_MS) {
      save.backupNudge = Date.now();
      persist();
      this.notice('BACK UP YOUR SAVE?', 'Your progress lives on this phone only. A backup code keeps it safe if the browser data is ever cleared. It takes a few seconds.', [
        ['Later', () => this.closePopup(false)],
        ['Back up', () => this.openSettings(1)],
      ]);
    }
  }

  /** A small card over the menu: a title, a few lines and one or two buttons (the last one is the gold one). */
  private notice(title: string, body: string, buttons: [string, () => void][], lead?: string): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.popup?.destroy();
    const c = this.add.container(0, 0);
    this.popup = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    const pw = Math.min(W - 40 * S, 340 * S);
    const text = txt(this, W / 2, 0, body, 14, '#e8d8c0', { bold: false, stroke: false, wrap: (pw - 44 * S) / S, align: lead ? 'left' : 'center' }).setOrigin(0.5, 0).setLineSpacing(3 * S);
    const leadH = lead ? 34 * S : 0;
    const ph = (HEADER + 22) * S + leadH + text.height + 84 * S;
    const top = H / 2 - ph / 2;
    c.add(popupFrame(this, W / 2, H / 2, pw, ph, title, buttons[0][1]));
    if (lead) c.add(txt(this, W / 2, top + (HEADER + 30) * S, lead, 18, CSS.gold));
    text.setY(top + (HEADER + 22) * S + leadH);
    c.add(text);
    const bw = buttons.length > 1 ? (pw - 54 * S) / 2 : 170 * S;
    buttons.forEach(([label, fn], i) => {
      const main = i === buttons.length - 1;
      const x = buttons.length > 1 ? W / 2 + (i ? 1 : -1) * (bw / 2 + 6 * S) : W / 2;
      c.add(button(this, x, top + ph - 42 * S, bw, 46 * S, label, fn, main ? { size: 19 } : { size: 19, color: COLORS.panelLight, textColor: CSS.cream }));
    });
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200, delay: 250 });
  }

  /** The Settings screen (Game, Save and About tabs). */
  private openSettings(tab = 0): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.popup?.destroy();
    const c = this.add.container(0, 0);
    this.popup = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    buildSettings(this, c, {
      tab,
      onClose: () => this.closePopup(false),
      onIntro: () => wipeTo(this, 'intro'),
      onEnding: () => wipeTo(this, 'intro', { ending: true }),
      onCredits: () => wipeTo(this, 'credits'),
      // A pasted or reset save changes everything the menu shows: start the menu again from it.
      onSaveReplaced: () => this.scene.restart(),
    });
  }

  private build(): void {
    // Looping animations from the last layout (bouncing bagel, pulsing PLAY) go with it.
    this.tweens.killAll();
    this.root?.destroy();
    this.popup?.destroy();
    this.popup = null;
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
    const practice = !!save.practice && mode !== 'endless';
    const c = this.add.container(0, 0);
    this.root = c;

    // The layout is planned from the bottom up: bottom bar, order ticket, the bagel's name and notes, then the
    // shelf. The bagel gets whatever height is left, so short screens (iPhone mini, the in-app preview) still fit.
    const compact = (bottom - top) / S < 720;
    const barH = (compact ? 58 : 70) * S;
    const barTop = bottom - barH;
    const cw = Math.min(W - 32 * S, 360 * S);
    const th = (compact ? 194 : 232) * S;
    const ty = barTop - (compact ? 9 : 14) * S - th;
    const plateH = (compact ? 34 : 42) * S;
    const infoH = (compact ? 50 : 62) * S;
    const shelfH = 28 * S;
    const shelfBottom = ty - 6 * S - infoH - plateH - 10 * S;
    const shelfTop = shelfBottom - shelfH;
    const R = Math.max(34 * S, Math.min((compact ? 74 : 88) * S, (shelfTop - top - 56 * S) / 2, W * 0.24));
    const by = shelfTop - R * 0.97;

    // Back wall: staggered tiles, with a warm light behind the bagel.
    const wall = this.add.graphics();
    wall.fillStyle(0x3a2a1e, 1).fillRect(0, 0, W, H);
    wall.fillStyle(0x4a382a, 1);
    const tile = 44 * S;
    for (let y = shelfTop - Math.ceil(shelfTop / tile) * tile, row = 0; y < shelfBottom + tile * 0.9; y += tile, row++) {
      for (let x = row % 2 ? -tile / 2 : 0; x < W; x += tile) wall.fillRoundedRect(x + 2 * S, y + 2 * S, tile - 4 * S, tile - 4 * S, 5 * S);
    }
    c.add(wall);
    ctex(this, 'menu_glow', 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,220,140,0.55)');
      gr.addColorStop(0.55, 'rgba(255,205,120,0.18)');
      gr.addColorStop(1, 'rgba(255,205,120,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
    const glow = this.add.image(W / 2, by, 'menu_glow').setScale((R * 5.2) / (64 * S));
    c.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.8, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // Everything under the shelf sits in its shade.
    const shade = this.add.graphics();
    shade.fillStyle(0x1d140d, 0.38).fillRect(0, shelfBottom, W, H - shelfBottom);
    shade.fillStyle(0x120c08, 0.3).fillRect(0, shelfBottom, W, 9 * S);
    c.add(shade);

    // Dough counter
    const dp = pill(this, 0, top + 28 * S, 'coin', `${save.dough} Dough`, { size: 16, color: CSS.gold, h: 32 });
    dp.x = 14 * S + dp.width / 2;
    c.add(dp);
    this.doughPill = dp;

    // The shelf: your bagel in the middle, its neighbours waiting on either side.
    const bagel = BAGELS[this.idx];
    const locked = !save.unlocked.includes(bagel.id);
    // A secret bagel stays a mystery until it's found: no name, no goal.
    const hidden = locked && !!bagel.secret;
    const gs = locked && bagel.goal && !hidden ? goalStatus(save, bagel) : null;
    const shelf = this.add.graphics();
    shelf.fillStyle(0x8a5d3b, 1).fillRect(0, shelfTop, W, shelfH - 8 * S);
    shelf.fillStyle(0xb98356, 1).fillRect(0, shelfTop, W, 4 * S);
    shelf.fillStyle(0x5e3c22, 1).fillRect(0, shelfBottom - 8 * S, W, 8 * S);
    shelf.fillStyle(INK, 1).fillRect(0, shelfTop - 1.5 * S, W, 3 * S).fillRect(0, shelfBottom - 1.5 * S, W, 3 * S);
    c.add(shelf);
    const r2 = R * 0.5;
    const nx = Math.min(W / 2 - r2 - 4 * S, R + r2 + 34 * S);
    for (const d of [-1, 1]) {
      const nb = BAGELS[(this.idx + d + BAGELS.length) % BAGELS.length];
      const x = W / 2 + d * nx;
      c.add(this.add.ellipse(x, shelfTop + 1 * S, r2 * 1.7, r2 * 0.3, 0x120c08, 0.4));
      const im = this.add.image(x, shelfTop - r2 * 0.97, bigBagel(this, nb.tex)).setScale(r2 / (62 * S));
      if (save.unlocked.includes(nb.id)) im.setAlpha(0.62);
      else im.setTint(0x222222).setAlpha(0.8);
      c.add(im);
    }
    const hs = R / (62 * S); // hero texture scale (bagel radius is 62 in the 160 '_big' texture)
    const shadow = this.add.ellipse(W / 2, shelfTop + 1 * S, R * 1.7, R * 0.3, 0x120c08, 0.5);
    c.add(shadow);
    // An unlocked bagel is alive: its eyes blink and glance about. A locked one is a dark shape.
    const hero = this.add.image(W / 2, by, bigBagel(this, bagel.tex, locked)).setScale(hs);
    if (locked) hero.setTint(0x222222);
    c.add(hero);
    let face: Face | null = null;
    if (!locked) {
      face = new Face(this, hero, 62, (o) => c.add(o));
      face.idle = true;
    }
    const bob = () => this.tweens.add({ targets: hero, y: by - 7 * S, scaleX: hs * 1.03, scaleY: hs * 0.97, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    bob();
    // Tap the bagel and it hops.
    const hop = () => {
      this.tweens.killTweensOf(hero);
      hero.setPosition(W / 2, by).setScale(hs * 1.12, hs * 0.86).setAlpha(1);
      face?.blink();
      sfx('pop');
      this.tweens.add({ targets: hero, y: by - 30 * S, scaleX: hs * 0.95, scaleY: hs * 1.07, duration: 170, ease: 'Quad.Out', yoyo: true, onComplete: () => {
        hero.setScale(hs);
        bob();
      } });
    };
    this.tweens.add({ targets: shadow, scaleX: 0.88, alpha: 0.34, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const slide: (Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [hero];
    if (locked) {
      const lock = this.add.image(W / 2, by + R * 0.1, 'ic_lock').setScale(Math.max(1.3, hs * 1.8));
      c.add(lock);
      slide.push(lock);
    }
    // One dot per bagel along the shelf's front edge: gold for this one, cream when unlocked, faint when locked.
    const dots = this.add.graphics();
    BAGELS.forEach((b, i) => {
      const x = W / 2 + (i - (BAGELS.length - 1) / 2) * 14 * S;
      const on = i === this.idx;
      dots.fillStyle(INK, 0.55).fillCircle(x, shelfTop + 12 * S, (on ? 5.5 : 4) * S);
      if (on) dots.fillStyle(COLORS.gold, 1);
      else dots.fillStyle(COLORS.cream, save.unlocked.includes(b.id) ? 0.9 : 0.35);
      dots.fillCircle(x, shelfTop + 12 * S, (on ? 4 : 2.8) * S);
    });
    c.add(dots);

    // Name plate, hanging from the shelf.
    const plateY = shelfBottom + 10 * S + plateH / 2;
    const nameT = txt(this, 0, -1 * S, hidden ? '???' : bagel.name, compact ? 19 : 22, locked ? CSS.muted : CSS.dark, { stroke: false });
    const plateW = Math.max(150 * S, nameT.width + 48 * S);
    const pg = this.add.graphics();
    pg.lineStyle(2.5 * S, INK, 1).lineBetween(-plateW / 2 + 16 * S, -plateH / 2, -plateW / 2 + 16 * S, -plateH / 2 - 12 * S).lineBetween(plateW / 2 - 16 * S, -plateH / 2, plateW / 2 - 16 * S, -plateH / 2 - 12 * S);
    pg.fillStyle(INK, 1).fillRoundedRect(-plateW / 2 - 2.5 * S, -plateH / 2 - 2.5 * S, plateW + 5 * S, plateH + 8 * S, 12 * S);
    pg.fillStyle(locked ? 0x3d2e22 : 0xb9822c, 1).fillRoundedRect(-plateW / 2, -plateH / 2 + 3 * S, plateW, plateH, 10 * S);
    pg.fillStyle(locked ? COLORS.panelLight : COLORS.gold, 1).fillRoundedRect(-plateW / 2, -plateH / 2, plateW, plateH, 10 * S);
    pg.fillStyle(0xffffff, locked ? 0.08 : 0.28).fillRoundedRect(-plateW / 2 + 7 * S, -plateH / 2 + 4 * S, plateW - 14 * S, 9 * S, 5 * S);
    const plate = this.add.container(W / 2, plateY, [pg, nameT]);
    c.add(plate);
    slide.push(plate);

    // Under the plate: what the bagel does (or how to unlock it), then its best run here.
    const infoTop = plateY + plateH / 2 + (compact ? 9 : 12) * S;
    const desc = txt(this, W / 2, infoTop, hidden ? SECRET_BAGEL_HINT : gs ? `Unlock: ${bagel.goal!.text}` : bagel.quirk, 14, '#f0e2c8', {
      wrap: Math.min(W / S - 40, 340),
      bold: false,
    }).setOrigin(0.5, 0);
    // Long notes shrink to two lines' worth of room.
    const lineRoom = infoH - (compact ? 9 : 12) * S - 19 * S;
    if (desc.height > lineRoom) desc.setScale(Math.max(0.78, lineRoom / desc.height));
    c.add(desc);
    const subY = Math.min(ty - 13 * S, desc.y + desc.displayHeight + 10 * S);
    if (gs) c.add(txt(this, W / 2, subY, gs.progress, 13, CSS.gold));
    else if (!locked) {
      const best = getBest(save, bagel.id, bestStage(stage.id, mode, crispy));
      const label = `Stage ${stage.num}${mode === 'quick' ? ' Quick' : mode === 'endless' ? ' Endless' : ''}${crispy ? ' Crispy' : ''}`;
      c.add(txt(this, W / 2, subY, bestText(label, best, mode === 'endless', true), 13, best ? CSS.gold : CSS.muted));
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
    // Swipe along the shelf, or tap a neighbour, to switch bagels.
    const zone = this.add.zone(W / 2, shelfTop - R, W, 2 * R + 30 * S).setInteractive();
    c.add(zone);
    let sx: number | null = null;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (sx = p.x));
    const onUp = (p: Phaser.Input.Pointer) => {
      if (sx === null) return;
      const dx = p.x - sx;
      const tapped = sx;
      sx = null;
      if (Math.abs(dx) > 40 * S) go(dx < 0 ? 1 : -1);
      else if (Math.abs(dx) < 12 * S && Math.abs(tapped - W / 2) > R + 8 * S && zone.getBounds().contains(p.x, p.y)) go(tapped < W / 2 ? -1 : 1);
      else if (Math.abs(dx) < 12 * S && !locked && Math.abs(tapped - W / 2) < R && zone.getBounds().contains(p.x, p.y)) hop();
    };
    this.input.on('pointerup', onUp);
    c.once(Phaser.GameObjects.Events.DESTROY, () => this.input.off('pointerup', onUp));
    // Slide the new bagel in from the side it came from.
    if (this.slideFrom) {
      const off = this.slideFrom * 110 * S;
      for (const o of slide) {
        const x0 = o.x;
        o.x = x0 + off;
        o.alpha = 0;
        this.tweens.add({ targets: o, x: x0, alpha: 1, duration: 220, ease: 'Cubic.Out' });
      }
      this.slideFrom = 0;
    }

    // The order ticket: where (stage, Extra Crispy), how long (mode) and PLAY.
    const tl = W / 2 - cw / 2;
    const tk = this.add.graphics();
    tk.fillStyle(INK, 1).fillRoundedRect(tl - 2.5 * S, ty - 2.5 * S, cw + 5 * S, th + 10 * S, 13 * S);
    tk.fillStyle(0xd9c9a8, 1).fillRoundedRect(tl, ty + 5 * S, cw, th, 10 * S);
    tk.fillStyle(COLORS.cream, 1).fillRoundedRect(tl, ty, cw, th, 10 * S);
    c.add(tk);
    const pad = 14 * S;
    c.add(txt(this, W / 2, ty + (compact ? 11 : 14) * S, "TODAY'S ORDER", compact ? 10 : 11, '#9a7a56', { stroke: false }));
    const rowH = (compact ? 38 : 42) * S;
    const rowY = ty + (compact ? 22 : 27) * S + rowH / 2;
    const fw = rowH;
    const toastY = ty - 22 * S;
    c.add(this.stageRow(stage, tl + pad + (cw - 2 * pad - fw - 8 * S) / 2, rowY, cw - 2 * pad - fw - 8 * S, rowH, crispy));
    c.add(this.crispyButton(tl + cw - pad - fw / 2, rowY - 2 * S, fw, crispy, open, toastY));
    // Tear line between the stage and the mode.
    const tearY = rowY + rowH / 2 + (compact ? 8 : 10) * S;
    const tear = this.add.graphics();
    tear.fillStyle(INK, 0.3);
    for (let x = tl + pad; x < tl + cw - pad - 6 * S; x += 12 * S) tear.fillRect(x, tearY - 1 * S, 7 * S, 2 * S);
    c.add(tear);
    // Full / Quick / Endless switch. Remembers the last choice.
    {
      const sw = cw - 2 * pad;
      const sh = (compact ? 34 : 38) * S;
      const y = tearY + (compact ? 8 : 11) * S + sh / 2;
      const seg = sw / 3;
      const modes: [RunMode, string, string | null][] = [
        ['full', 'Full 5:00', null],
        ['quick', 'Quick 3:00', 'ic_bolt'],
        ['endless', 'Endless', 'ic_clock'],
      ];
      const sel = modes.findIndex((m) => m[0] === mode);
      const g = this.add.graphics();
      g.fillStyle(INK, 1).fillRoundedRect(W / 2 - sw / 2 - 2.5 * S, y - sh / 2 - 2.5 * S, sw + 5 * S, sh + 5 * S, sh / 2 + 2.5 * S);
      g.fillStyle(0x3d2e22, 1).fillRoundedRect(W / 2 - sw / 2, y - sh / 2, sw, sh, sh / 2);
      const x0 = W / 2 - sw / 2 + sel * seg;
      g.fillStyle(COLORS.gold, 1).fillRoundedRect(x0 + 3 * S, y - sh / 2 + 3 * S, seg - 6 * S, sh - 6 * S, sh / 2 - 3 * S);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(x0 + 10 * S, y - sh / 2 + 6 * S, seg - 20 * S, 8 * S, 4 * S);
      c.add(g);
      modes.forEach(([m, label, icon], i) => {
        const on = i === sel;
        const lockedMode = m === 'endless' && !open;
        const cx = W / 2 - sw / 2 + seg * (i + 0.5);
        const shift = icon ? 9 * S : 0;
        const t = txt(this, cx + shift, y, label, 13, on ? CSS.dark : CSS.muted, { stroke: false });
        if (lockedMode) t.setAlpha(0.6);
        // Keep the label and its icon inside their third of the switch.
        const room = seg - 16 * S - (icon ? 20 * S : 0);
        if (t.width > room) t.setScale(room / t.width);
        c.add(t);
        if (icon) c.add(this.add.image(t.x - t.displayWidth / 2 - 10 * S, y, lockedMode ? 'ic_lock' : icon).setScale(lockedMode ? 0.4 : 0.46).setAlpha(on ? 1 : 0.6));
        const z = this.add.zone(cx, y, seg, sh + 8 * S).setInteractive();
        z.on('pointerup', () => {
          if (on) return;
          if (lockedMode) {
            sfx('lock');
            this.toast('Clear this stage to unlock Endless', toastY);
            return;
          }
          sfx('click');
          save.quick = m === 'quick';
          save.endless = m === 'endless';
          persist();
          this.build();
          if (m !== 'full') this.firstTime(m, toastY);
        });
        c.add(z);
      });
    }
    // PLAY. A run that was cut short (the phone closed the game) can be picked up from here too.
    const playH = (compact ? 58 : 68) * S;
    const playY = ty + th - (compact ? 10 : 14) * S - 5 * S - playH / 2;
    const playW = cw - 2 * pad;
    const start = () => {
      if (locked) return;
      unlockAudio();
      clearRun();
      wipeTo(this, 'game', { bagel: bagel.id, stage: stage.id, practice, quick: mode === 'quick', endless: mode === 'endless', crispy });
    };
    const saved = loadRun();
    const playLabel = locked ? 'LOCKED' : practice ? 'PRACTICE' : 'PLAY';
    const playColor = locked ? COLORS.panelLight : practice ? PRACTICE_COLOR : COLORS.gold;
    if (saved) {
      const name = BAGELS.find((b) => b.id === saved.bagel)?.name ?? 'run';
      const rw = playW * 0.58;
      const rb = button(this, tl + pad + rw / 2, playY, rw, playH, '', () => {
        unlockAudio();
        this.cameras.main.fadeOut(200, 18, 12, 8);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { resume: true }));
      }, { color: COLORS.green });
      const l1 = txt(this, 0, -9 * S, `RESUME ${fmtTime(saved.now)}`, compact ? 18 : 20, CSS.dark, { stroke: false });
      const l2 = txt(this, 0, 13 * S, `${saved.endless ? 'Endless ' : saved.quick ? 'Quick ' : ''}${name}, Stage ${stageById(saved.stage).num}`, 11, '#2f4a1a', { stroke: false });
      if (l2.width > rw - 16 * S) l2.setScale((rw - 16 * S) / l2.width);
      rb.add([l1, l2]);
      this.pressWith(rb, [l1, l2]);
      c.add(rb);
      const nw = playW - rw - 8 * S;
      c.add(button(this, tl + cw - pad - nw / 2, playY, nw, playH, locked ? 'LOCKED' : practice ? 'PRACTICE' : 'NEW RUN', start, { size: locked || !practice ? 18 : 15, color: playColor }));
    } else {
      const play = button(this, W / 2, playY, playW, playH, playLabel, start, { size: compact ? 30 : 34, color: playColor });
      c.add(play);
      if (!locked) this.tweens.add({ targets: play, scale: 1.03, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    // Bottom bar: Bakery, Goals, Cookbook and Settings. A red dot on Goals means a challenge was just finished.
    const bar = this.add.graphics();
    bar.fillStyle(0x1d140d, 0.94).fillRect(0, barTop, W, H - barTop);
    bar.fillStyle(INK, 1).fillRect(0, barTop - 1.5 * S, W, 3 * S);
    bar.fillStyle(COLORS.panelLight, 0.7).fillRect(0, barTop + 1.5 * S, W, 1.5 * S);
    c.add(bar);
    // On a new save only Settings is open: the Bakery and Goals open after the first run, the Cookbook after the
    // first evolution. A button that just opened wears a NEW tag until it's tapped.
    const items: [string, string, () => void, MenuItem | null][] = [
      ['Bakery', 'ic_bk_oven', () => this.openBakery(), 'bakery'],
      ['Goals', 'ic_star', () => this.openGoals(unseenGoals(save).length ? 1 : 0), 'goals'],
      ['Cookbook', 'ic_book', () => this.openCookbook(), 'cookbook'],
      ['Settings', 'ic_gear', () => this.openSettings(), null],
    ];
    const barW = Math.min(W, 440 * S);
    const iw = barW / items.length;
    items.forEach(([label, icon, fn, id], i) => {
      const x = W / 2 - barW / 2 + iw * (i + 0.5);
      const iy = barTop + (compact ? 22 : 27) * S;
      const isz = (compact ? 30 : 36) * S;
      const im = this.add.image(x, iy, icon);
      const sc = isz / im.height;
      im.setScale(sc);
      c.add(im);
      const shut = !!id && !menuOpen(save, id);
      const isNew = !!id && menuFresh(save, id);
      c.add(txt(this, x, barTop + (compact ? 46 : 56) * S, label, compact ? 11 : 12, shut ? '#7d6f5c' : '#e9dcc3', { stroke: false }));
      if (shut) {
        im.setTint(0x3a3028).setAlpha(0.7);
        c.add(this.add.image(x + isz * 0.34, iy + isz * 0.26, 'ic_lock').setScale(sc * 0.55));
      }
      if (isNew) {
        const tag = this.add.container(x + isz * 0.5, iy - isz * 0.42);
        const tg = this.add.graphics();
        tg.fillStyle(INK, 1).fillRoundedRect(-17 * S, -9 * S, 34 * S, 18 * S, 9 * S);
        tg.fillStyle(COLORS.red, 1).fillRoundedRect(-15 * S, -7 * S, 30 * S, 14 * S, 7 * S);
        tag.add([tg, txt(this, 0, 0, 'NEW', 9, CSS.cream, { stroke: false })]);
        tag.setAngle(8);
        c.add(tag);
        this.tweens.add({ targets: tag, scale: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      } else if (label === 'Goals' && !shut && unseenGoals(save).length) {
        const dot = this.add.graphics();
        dot.fillStyle(INK, 1).fillCircle(x + isz * 0.46, iy - isz * 0.4, 7.5 * S);
        dot.fillStyle(COLORS.red, 1).fillCircle(x + isz * 0.46, iy - isz * 0.4, 5.5 * S);
        c.add(dot);
        this.tweens.add({ targets: dot, alpha: 0.55, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      const z = this.add.zone(x, barTop + barH / 2, iw, barH).setInteractive();
      let armed = false;
      z.on('pointerdown', () => {
        armed = true;
        im.setScale(sc * 0.88);
        sfx('click');
      });
      const reset = () => {
        armed = false;
        im.setScale(sc);
      };
      z.on('pointerout', reset);
      z.on('pointerup', () => {
        const fire = armed;
        reset();
        if (!fire) return;
        if (shut) {
          sfx('lock');
          this.toast(MENU_LOCK[id!], barTop - 26 * S);
          return;
        }
        if (isNew) clearFresh(save, id!);
        fn();
      });
      c.add(z);
    });
  }

  /** The first time a mode is picked, a note says what it is. */
  private firstTime(id: TipId, y: number): void {
    if (!tipDue(id)) return;
    markTip(id);
    this.toast(TIPS[id], y);
  }

  /** Makes extra parts of a button (pictures, a second line) move with its press. */
  private pressWith(b: Phaser.GameObjects.Container, parts: { y: number }[]): void {
    const base = parts.map((o) => o.y);
    b.on('pointerdown', () => parts.forEach((o, i) => (o.y = base[i] + 3.5 * S)));
    const up = () => parts.forEach((o, i) => (o.y = base[i]));
    b.on('pointerup', up);
    b.on('pointerout', up);
  }

  /** Short note that floats up and fades, e.g. why a locked mode can't be picked. */
  private toast(text: string, y: number): void {
    const t = txt(this, 0, 0, text, 14, CSS.cream, { stroke: false, wrap: Math.min(this.scale.width / S - 60, 320) });
    const g = this.add.graphics();
    const w = t.width + 28 * S;
    const h = t.height + 14 * S;
    g.fillStyle(0x24160d, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(h / 2, 16 * S));
    // Its bottom edge stays where a one-line note's would be, however many lines it has. Longer notes stay longer.
    const cy = y + 16 * S - h / 2;
    const box = this.add.container(this.scale.width / 2, cy, [g, t]);
    this.root.add(box);
    this.tweens.add({ targets: box, y: cy - 18 * S, alpha: 0, delay: 1000 + text.length * 35, duration: 500, onComplete: () => box.destroy() });
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
      if (save.crispy) {
        markTip('crispy');
        this.toast(TIPS.crispy, toastY);
      }
    }, { color: on ? COLORS.red : COLORS.panelLight, radius: 12 });
    const fl = this.add.image(0, 0, 'ic_flame').setScale(0.62).setAlpha(open ? (on ? 1 : 0.55) : 0.3);
    b.add(fl);
    if (!open) b.add(this.add.image(w * 0.22, h * 0.2, 'ic_lock').setScale(0.38));
    return b;
  }

  /** The ticket's stage line: the stage's picture and name on a paper-colored button. Opens the stage picker. Charred when Extra Crispy is on. */
  private stageRow(stage: StageDef, x: number, y: number, w: number, h: number, crispy: boolean): Phaser.GameObjects.Container {
    const b = button(this, x, y - 2 * S, w, h, '', () => this.openStages(), { color: crispy ? CRISPY_COLOR : 0xf3dfb4, radius: 12 });
    const pic = this.add.image(-w / 2 + 8 * S, 0, `${stage.thumb}_sm`).setOrigin(0, 0.5);
    pic.setScale((h - 12 * S) / pic.height);
    if (crispy) pic.setTint(0xffb08a);
    const label = txt(this, pic.x + pic.displayWidth + 8 * S, -1 * S, stage.name, 17, crispy ? '#ffd2b0' : CSS.dark, { stroke: false }).setOrigin(0, 0.5);
    const more = txt(this, w / 2 - 15 * S, -2 * S, '›', 26, crispy ? '#ffb08a' : '#9a6a2c', { stroke: false });
    const room = more.x - 12 * S - label.x;
    if (label.width > room) label.setScale(room / label.width);
    b.add([pic, label, more]);
    this.pressWith(b, [pic, label, more]);
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
    const pw = Math.min(W - 24 * S, 400 * S);
    const ph = Math.min(H - 20 * S, 566 * S);
    const close = () => this.closePopup(true);
    const { c, top } = this.openPopup('PICK A STAGE', pw, ph, close);

    const st = STAGES[this.stageIdx];
    const unlocked = stageUnlocked(save, st);
    const playable = stagePlayable(save, st);
    const picked = pickedStage(save).id === st.id;
    const card = this.add.container(W / 2, 0);
    c.add(card);

    // Picture, darkened with a lock until it can be played.
    const picY = top + 150 * S;
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

    if (st.boss.kind === 'king' && (save.stageClears?.[st.id] ?? 0) > 0) {
      // The last stage wears a gold stamp once the Stale King has fallen.
      const rib = this.add.container(pic.displayWidth / 2 - 46 * S, picY + pic.displayHeight / 2 - 10 * S);
      const g = this.add.graphics();
      const rw = 104 * S;
      g.fillStyle(0x24160d, 1).fillRoundedRect(-rw / 2 - 2 * S, -15 * S, rw + 4 * S, 30 * S, 8 * S);
      g.fillStyle(COLORS.gold, 1).fillRoundedRect(-rw / 2, -13 * S, rw, 26 * S, 7 * S);
      rib.add([g, txt(this, 0, 0, 'CLEARED', 15, CSS.dark, { stroke: false })]);
      rib.setAngle(-6);
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
    for (let i = 0; i < 5; i++) {
      const f = this.add.image((i - 2) * 24 * S, y, 'ic_flame').setScale(0.6);
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
      dots.fillStyle(on ? COLORS.gold : stagePlayable(save, s2) ? COLORS.panelLight : 0x1d140d).fillCircle(x, top + (HEADER + 20) * S, (on ? 4 : 3) * S);
    });
    c.add(dots);

    // Bottom: the Practice switch, then Pick this stage (or why it can't be picked yet).
    const by = top + ph - 40 * S;
    if (playable) {
      const py = by - 56 * S;
      const lx = W / 2 - pw / 2 + 24 * S;
      c.add(txt(this, lx, py - 8 * S, 'PRACTICE RUN', 13, save.practice ? '#8fc7f2' : CSS.cream, { stroke: false }).setOrigin(0, 0.5));
      c.add(txt(this, lx, py + 9 * S, 'Starts at 2:30. Pays no Dough.', 11, CSS.muted, { bold: false, stroke: false }).setOrigin(0, 0.5));
      const sw = 116 * S;
      c.add(segmented(this, W / 2 + pw / 2 - 24 * S - sw / 2, py, sw, 32 * S, ['Off', 'On'], save.practice ? 1 : 0, (i) => {
        save.practice = i === 1;
        persist();
        this.drawStages(save, 0);
        if (save.practice && tipDue('practice')) {
          markTip('practice');
          const note = tipIn(this, tipBox(this, W / 2, py - 62 * S, TIPS.practice, 14), 0);
          this.popup?.add(note);
          this.tweens.add({ targets: note, alpha: 0, delay: 4200, duration: 400, onComplete: () => note.destroy() });
        }
      }, 14));
    }
    const pickLabel = playable ? (picked ? 'Picked' : 'Pick this stage') : st.built ? 'Locked' : 'Coming soon';
    c.add(
      button(this, W / 2, by, Math.min(pw - 48 * S, 240 * S), 48 * S, pickLabel, () => {
        if (!playable) {
          sfx('lock');
          return;
        }
        save.stage = st.id;
        persist();
        close();
      }, { size: 19, muted: !playable }),
    );
  }

  /**
   * Opens a pop-up, replacing any open one: a dark backdrop that swallows taps and the shared frame (header bar, title,
   * back button) centred on screen, with an optional line under the header. Returns the pop-up's container and the
   * panel's top edge.
   */
  private openPopup(title: string, pw: number, ph: number, onBack: () => void, sub?: string): { c: Phaser.GameObjects.Container; top: number } {
    const W = this.scale.width;
    const H = this.scale.height;
    this.popup?.destroy();
    const c = this.add.container(0, 0);
    this.popup = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x120c08, 0.75).setOrigin(0).setInteractive());
    c.add(popupFrame(this, W / 2, H / 2, pw, ph, title, onBack));
    const top = H / 2 - ph / 2;
    if (sub !== undefined) c.add(txt(this, W / 2, top + (HEADER + 21) * S, sub, 13, CSS.cream, { bold: false, stroke: false }));
    return { c, top };
  }

  /** The row of tabs under a pop-up's header: the same switch as the menu's mode picker. `dot` puts a red dot on one tab. */
  private tabs(c: Phaser.GameObjects.Container, top: number, pw: number, labels: string[], sel: number, onPick: (i: number) => void, dot = -1): void {
    const W = this.scale.width;
    const w = pw - 36 * S;
    c.add(segmented(this, W / 2, top + (HEADER + 54) * S, w, 34 * S, labels, sel, onPick, labels.length > 2 && w < 330 * S ? 13 : 15));
    if (dot >= 0 && dot !== sel) {
      const g = this.add.graphics();
      const x = W / 2 - w / 2 + (w / labels.length) * (dot + 1) - 10 * S;
      g.fillStyle(INK, 1).fillCircle(x, top + (HEADER + 54 - 13) * S, 7 * S);
      g.fillStyle(COLORS.red, 1).fillCircle(x, top + (HEADER + 54 - 13) * S, 5 * S);
      c.add(g);
    }
  }

  /** Close the open pop-up. rebuild: redraw the menu behind it (after something it shows may have changed). */
  private closePopup(rebuild: boolean): void {
    this.popup?.destroy();
    this.popup = null;
    if (rebuild) this.build();
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
    const save = load();
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
      rows = [
        bagelFound
          ? { icon: rainbow.tex, name: `${rainbow.name} bagel`, sub: `Found! ${rainbow.goal!.text}.`, frac: 1, done: true }
          : { icon: 'ic_secret', name: '???', sub: SECRET_BAGEL_HINT, frac: 0, done: false },
        ...COMBOS.map((cd) =>
          (save.secrets ?? []).includes(cd.id)
            ? { icon: cd.icon, name: cd.name, sub: `Found! Evolve ${WEAPONS[cd.drop].evoName} and ${WEAPONS[cd.keep].evoName}, then open a gold toaster.`, frac: 1, done: true }
            : { icon: 'ic_secret', name: '???', sub: SECRET_RECIPE_HINT, frac: 0, done: false },
        ),
      ];
      sub = `${rows.filter((r) => r.done).length} of ${rows.length} secrets found`;
    }
    const PER = 5;
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages - 1);
    const shown = rows.slice(page * PER, page * PER + PER);
    const pw = Math.min(W - 24 * S, 400 * S);
    const rowH = 68 * S;
    const ph = 150 * S + PER * rowH + 58 * S;
    const { c, top } = this.openPopup('GOALS', pw, ph, () => this.closePopup(true), sub);
    this.tabs(c, top, pw, ['Unlocks', 'Challenges', 'Secrets'], tab, (i) => this.openGoals(i), unseenGoals(save).length > 0 ? 1 : -1);
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
    const by = top + 150 * S + PER * rowH + 24 * S;
    if (pages > 1) {
      const go = (d: number) => this.openGoals(tab, (page + d + pages) % pages);
      c.add(button(this, W / 2 - 60 * S, by, 44 * S, 40 * S, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 20 }));
      c.add(txt(this, W / 2, by, `${page + 1} / ${pages}`, 15, CSS.cream));
      c.add(button(this, W / 2 + 60 * S, by, 44 * S, 40 * S, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 20 }));
    }
  }

  /** The Cookbook's three tabs: Evolutions, Weapons and Enemies. */
  private cookbookTabs(c: Phaser.GameObjects.Container, tab: number, top: number, pw: number): void {
    this.tabs(c, top, pw, ['Evolutions', 'Weapons', 'Enemies'], tab, (i) => this.openCookbook(i));
  }

  private openCookbook(tab = 0, page = 0): void {
    if (tab === 2) {
      this.openEnemies(page);
      return;
    }
    const W = this.scale.width;
    const save = load();
    const all = Object.keys(WEAPONS) as WeaponId[];
    const locked = all.filter((id) => WEAPONS[id].unlock);
    // Five rows a page keeps it on screen on small phones. The secret combos are the last Evolutions rows.
    const PER = 5;
    const evoRows: (WeaponId | 'combo' | 'toastjam')[] = [...all, ...COMBOS.map((cd) => cd.id)];
    const rows = tab === 0 ? evoRows : locked;
    const ids = rows.slice(page * PER, page * PER + PER);
    const pages = Math.ceil(rows.length / PER);
    const pw = Math.min(W - 24 * S, 400 * S);
    const rowH = 60 * S;
    const ph = 160 * S + PER * rowH + (pages > 1 ? 46 : 0) * S;
    const opened = locked.filter((id) => weaponOpen(save, id)).length;
    const sub = tab === 0 ? `${save.cookbook.length} of ${all.length} evolutions found` : `${opened} of ${locked.length} weapons unlocked`;
    const { c, top } = this.openPopup('THE COOKBOOK', pw, ph, () => this.closePopup(false), sub);
    this.cookbookTabs(c, tab, top, pw);
    const lx = W / 2 - pw / 2 + 20 * S;
    const small = (x: number, y: number, s: string, wrap: number) =>
      txt(this, x, y, s, 12, CSS.muted, { bold: false, stroke: false, wrap, align: 'left' }).setOrigin(0, 0.5);
    ids.forEach((id, i) => {
      const y = top + 160 * S + i * rowH;
      const cd = COMBOS.find((o) => o.id === id);
      if (cd) {
        const found = (save.secrets ?? []).includes(cd.id);
        c.add(this.add.image(lx + 18 * S, y, found ? WEAPONS[cd.drop].icon : 'ic_secret').setScale(0.9));
        c.add(txt(this, lx + 44 * S, y, '+', 18, CSS.muted));
        c.add(this.add.image(lx + 70 * S, y, found ? WEAPONS[cd.keep].icon : 'ic_secret').setScale(0.9));
        const tx = lx + 98 * S;
        c.add(txt(this, tx, y - 10 * S, found ? cd.name : '???', 16, found ? CSS.gold : CSS.muted).setOrigin(0, 0.5));
        c.add(small(tx, y + 11 * S, found ? `${WEAPONS[cd.drop].evoName} + ${WEAPONS[cd.keep].evoName}` : 'A secret recipe', (pw - 120 * S) / S));
        return;
      }
      if (id === 'combo' || id === 'toastjam') return;
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
    const by = top + 160 * S + PER * rowH - 10 * S;
    if (pages > 1) {
      const go = (d: number) => this.openCookbook(tab, (page + d + pages) % pages);
      c.add(button(this, W / 2 - 60 * S, by + 4 * S, 44 * S, 40 * S, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 20 }));
      c.add(txt(this, W / 2, by + 4 * S, `${page + 1} / ${pages}`, 15, CSS.cream));
      c.add(button(this, W / 2 + 60 * S, by + 4 * S, 44 * S, 40 * S, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 20 }));
    }
  }

  /** Cookbook Enemies tab: one page per stage. Enemies not met yet are dark shapes; beaten bosses get a crown. Tap one to read about it. */
  private openEnemies(stageIdx: number, pick = 0): void {
    const W = this.scale.width;
    const save = load();
    makeEnemyTextures(this);
    // Only stages that exist have a page.
    const BOOK = STAGES.filter((s2) => s2.built);
    const st = BOOK[stageIdx] ?? BOOK[0];
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
    const ph = 150 * S + gridRows * cellH + infoH + 62 * S;
    const total = Object.values(ENEMY_BOOK).flat();
    const { c, top } = this.openPopup('THE COOKBOOK', pw, ph, () => this.closePopup(false), `${total.filter((e) => met.has(e.kind)).length} of ${total.length} enemies met`);
    this.cookbookTabs(c, 2, top, pw);
    const gx = W / 2 - pw / 2 + 14 * S;
    const gy = top + 144 * S;
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
      this.openEnemies((stageIdx + d + BOOK.length) % BOOK.length);
    };
    c.add(button(this, W / 2 - pw / 2 + 44 * S, ny, 44 * S, 40 * S, '', () => go(-1), { color: COLORS.panelLight, chevron: -1, radius: 20 }));
    c.add(txt(this, W / 2, ny, `Stage ${st.num}: ${st.name}`, 15, CSS.cream));
    c.add(button(this, W / 2 + pw / 2 - 44 * S, ny, 44 * S, 40 * S, '', () => go(1), { color: COLORS.panelLight, chevron: 1, radius: 20 }));
  }

  private openBakery(tab = 0): void {
    const W = this.scale.width;
    const save = load();
    const pw = Math.min(W - 24 * S, 400 * S);
    const cardH = 78 * S;
    const gap = 10 * S;
    const list = BAKERY.filter((u) => (u.tab ?? 0) === tab);
    const tabH = 50 * S;
    const ph = 122 * S + tabH + list.length * (cardH + gap);
    const { c, top } = this.openPopup('THE BAKERY', pw, ph, () => this.closePopup(true));
    const wallet = pill(this, W / 2, top + (HEADER + 26) * S, 'coin', `${save.dough} Dough to spend`, { size: 15, color: CSS.gold, h: 30 });
    c.add(wallet);
    const setWallet = (v: number) => {
      (wallet.getData('label') as Phaser.GameObjects.Text).setText(`${v} Dough to spend`);
      if (this.doughPill) (this.doughPill.getData('label') as Phaser.GameObjects.Text).setText(`${v} Dough`);
    };
    const cw = pw - 28 * S;
    // Two tabs so all eight upgrades fit on a phone: Basics and Extras.
    const tabsTop = top + 16 * S;
    this.tabs(c, tabsTop, pw, ['Basics', 'Extras'], tab, (i) => this.openBakery(i));
    const refreshers: (() => void)[] = [];
    list.forEach((u, i) => {
      const y = top + 108 * S + tabH + cardH / 2 + i * (cardH + gap);
      const row = this.add.container(W / 2, y);
      c.add(row);
      const bg = this.add.graphics();
      const lx = -cw / 2;
      const pips = this.add.graphics();
      const textRoom = cw - 74 * S - 112 * S;
      const nameT = fit(txt(this, lx + 74 * S, -18 * S, u.name, 17, CSS.cream).setOrigin(0, 0.5), textRoom);
      const blurb = fit(txt(this, lx + 74 * S, 4 * S, u.blurb, 12, CSS.muted, { bold: false, stroke: false }).setOrigin(0, 0.5), textRoom);
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
                setWallet(Math.round(tw.getValue() ?? save.dough));
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
  }
}
