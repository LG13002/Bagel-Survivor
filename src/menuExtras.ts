// The menu pages added for replay (M18): the Daily Run card, the Bakery's Looks tab and the Goals page's Stats tab.
// Each fills a pop-up that `MenuScene` has already opened.
import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime } from './config';
import { BAGELS, STAGES, WEAPONS, stageById, type WeaponId } from './data';
import { TWISTS, dailyBonus, dailyFor, dailyResult, dailyStreak, daysBefore, today, weekday } from './daily';
import { Face } from './face';
import { LOOKS, LOOK_SLOTS, Wear, lookTex, ownsLook, toggleLook, trailBit, TRAIL_EVERY, worn, type LookDef, type LookSlot } from './looks';
import { persist, type SaveData } from './save';
import { segmented } from './settingsPanel';
import { sfx } from './sfx';
import { bigBagel } from './textures';
import { HEADER, button, fit, txt } from './ui';

const INK = 0x24160d;
type Box = Phaser.GameObjects.Container;

/** A bagel picture with living eyes and the looks given, inside a pop-up. `r` is its radius on screen (device px). */
function dressed(scene: Phaser.Scene, c: Box, x: number, y: number, r: number, tex: string, looks: { hat?: string; sprinkle?: string }): Phaser.GameObjects.Image {
  const im = scene.add.image(x, y, bigBagel(scene, tex, false)).setScale(r / (62 * S));
  c.add(im);
  new Wear(scene, im, 62, looks.sprinkle, (o) => c.add(o));
  const face = new Face(scene, im, 62, (o) => c.add(o));
  face.idle = true;
  new Wear(scene, im, 62, looks.hat, (o) => c.add(o));
  return im;
}

// ---------------------------------------------------------------- Daily Run

/** The Daily card: today's stage, bagel and twist, your result and streak, the last seven days, and PLAY. */
export function fillDaily(scene: Phaser.Scene, c: Box, top: number, pw: number, ph: number, save: SaveData, onPlay: () => void, onShare: () => void): void {
  const W = scene.scale.width;
  const date = today();
  const d = dailyFor(date);
  const stage = stageById(d.stage);
  const bagel = BAGELS.find((b) => b.id === d.bagel) ?? BAGELS[0];
  const res = dailyResult(save, date);
  const streak = dailyStreak(save, date);
  const lx = W / 2 - pw / 2 + 18 * S;
  const iw = pw - 36 * S;

  // Where and who: the stage's picture and the day's bagel, side by side.
  const tileW = (iw - 10 * S) / 2;
  const tileH = 108 * S;
  const ty = top + (HEADER + 40) * S;
  const tiles = scene.add.graphics();
  for (const i of [0, 1]) {
    const x = lx + i * (tileW + 10 * S);
    tiles.fillStyle(0x1d140d, 0.7).fillRoundedRect(x, ty, tileW, tileH, 12 * S);
  }
  c.add(tiles);
  const pic = scene.add.image(lx + tileW / 2, ty + 44 * S, stage.thumb);
  pic.setScale(Math.min((tileW - 20 * S) / pic.width, (66 * S) / pic.height));
  c.add(pic);
  c.add(fit(txt(scene, lx + tileW / 2, ty + 92 * S, stage.name, 14, CSS.cream, { stroke: false }), tileW - 12 * S));
  const bx = lx + tileW + 10 * S + tileW / 2;
  const looks = worn(save);
  dressed(scene, c, bx, ty + 48 * S, 30 * S, bagel.tex, looks);
  c.add(fit(txt(scene, bx, ty + 92 * S, bagel.name, 14, CSS.cream, { stroke: false }), tileW - 12 * S));

  // The twist.
  const tw = TWISTS[d.twist];
  const sy = ty + tileH + 10 * S;
  const sh = 54 * S;
  const strip = scene.add.graphics();
  strip.fillStyle(INK, 1).fillRoundedRect(lx - 2.5 * S, sy - 2.5 * S, iw + 5 * S, sh + 5 * S, 13 * S);
  strip.fillStyle(0x5a4126, 1).fillRoundedRect(lx, sy, iw, sh, 11 * S);
  strip.lineStyle(2 * S, COLORS.gold, 0.9).strokeRoundedRect(lx + 2 * S, sy + 2 * S, iw - 4 * S, sh - 4 * S, 9 * S);
  c.add(strip);
  c.add(txt(scene, W / 2, sy + 18 * S, `TWIST: ${tw.name}`, 16, CSS.gold));
  c.add(fit(txt(scene, W / 2, sy + 38 * S, tw.blurb, 12, CSS.cream, { bold: false, stroke: false }), iw - 20 * S));
  c.add(fit(txt(scene, W / 2, sy + sh + 14 * S, 'Same kit for everyone: every Bakery upgrade at rank 2.', 11, CSS.muted, { bold: false, stroke: false }), iw));

  // Today's result and the streak.
  const ry = sy + sh + 42 * S;
  const line1 = res ? `${res.c ? '♛ Cleared in' : 'Lasted'} ${fmtTime(res.t)}  ·  ${res.k.toLocaleString()} defeated` : `Not played yet  ·  +${dailyBonus(streak + 1)} bonus Dough`;
  c.add(fit(txt(scene, W / 2, ry, line1, 15, res ? CSS.gold : CSS.cream, { stroke: false }), iw));
  const best = save.daily?.best ?? 0;
  const line2 = streak > 0 ? `Streak: ${streak} day${streak === 1 ? '' : 's'}${best > streak ? `  ·  best ${best}` : ''}` : best > 0 ? `No streak right now  ·  best ${best}` : 'Play every day to build a streak';
  c.add(txt(scene, W / 2, ry + 21 * S, line2, 12, CSS.muted, { bold: false, stroke: false }));

  // The last seven days: a crown for a clear, a tick for a try, and the time.
  const wy = ry + 42 * S;
  const cw = iw / 7;
  const wh = 54 * S;
  const week = scene.add.graphics();
  c.add(week);
  for (let i = 0; i < 7; i++) {
    const day = daysBefore(date, 6 - i);
    const r = save.daily?.days[day];
    const x = lx + cw * (i + 0.5);
    const isToday = i === 6;
    week.fillStyle(0x1d140d, isToday ? 0.9 : 0.55).fillRoundedRect(x - cw / 2 + 2 * S, wy, cw - 4 * S, wh, 8 * S);
    if (isToday) week.lineStyle(2 * S, COLORS.gold, 1).strokeRoundedRect(x - cw / 2 + 2 * S, wy, cw - 4 * S, wh, 8 * S);
    c.add(txt(scene, x, wy + 10 * S, weekday(day), 10, isToday ? CSS.gold : CSS.muted, { stroke: false }));
    if (r) {
      c.add(scene.add.image(x, wy + 27 * S, r.c ? 'ic_crown' : 'ic_check').setScale(r.c ? 0.5 : 0.48));
      c.add(txt(scene, x, wy + 44 * S, fmtTime(r.t), 10, CSS.cream, { bold: false, stroke: false }));
    } else c.add(txt(scene, x, wy + 30 * S, '·', 20, CSS.muted, { stroke: false }));
  }

  // PLAY, or once today's score is in: Share and a replay for fun.
  const by = top + ph - 62 * S;
  const note = res ? 'Replays are just for fun: no score, no Dough.' : 'One scored try a day. A new run arrives at midnight.';
  c.add(txt(scene, W / 2, top + ph - 20 * S, note, 11, CSS.muted, { bold: false, stroke: false }));
  if (!res) {
    const play = button(scene, W / 2, by, Math.min(iw, 250 * S), 56 * S, 'PLAY', onPlay, { size: 28 });
    c.add(play);
    scene.tweens.add({ targets: play, scale: 1.03, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  } else {
    const bw = (iw - 10 * S) / 2;
    c.add(button(scene, lx + bw / 2, by, bw, 52 * S, 'Share', onShare, { size: 20 }));
    c.add(button(scene, lx + bw + 10 * S + bw / 2, by, bw, 52 * S, 'Play again', onPlay, { size: 18, color: COLORS.panelLight, textColor: CSS.cream }));
  }
}

// ---------------------------------------------------------------- Looks

const SLOT_NAMES = ['Hats', 'Trails', 'Sprinkles'];

/**
 * The Bakery's Looks tab: your bagel wearing its looks, a row of what there is, and one button to buy, wear or take
 * off the one you tapped. Tapping a look you don't own tries it on. `redraw` reopens the tab on a slot and look.
 */
export function fillLooks(scene: Phaser.Scene, c: Box, top: number, pw: number, ph: number, save: SaveData, slotIdx: number, pick: string, setWallet: (v: number) => void, redraw: (slot: number, pick: string) => void): void {
  const W = scene.scale.width;
  const slot: LookSlot = LOOK_SLOTS[slotIdx] ?? 'hat';
  const list = LOOKS.filter((l) => l.slot === slot);
  const on = worn(save);
  const sel: LookDef = list.find((l) => l.id === pick) ?? list.find((l) => l.id === on[slot]) ?? list[0];
  const owned = ownsLook(save, sel);
  const isOn = on[slot] === sel.id;
  const lx = W / 2 - pw / 2 + 18 * S;
  const iw = pw - 36 * S;

  // The bagel, wearing what it has on plus the look being tried.
  const stageY = top + 162 * S;
  const stageH = 150 * S;
  const bg = scene.add.graphics();
  bg.fillStyle(0x1d140d, 0.7).fillRoundedRect(lx, stageY, iw, stageH, 14 * S);
  c.add(bg);
  const bagel = BAGELS.find((b) => b.id === save.selected) ?? BAGELS[0];
  const bx = lx + 76 * S;
  const byy = stageY + stageH / 2 + 16 * S;
  const R = 46 * S;
  c.add(scene.add.ellipse(bx, byy + R, R * 1.6, R * 0.28, 0x120c08, 0.5));
  const show = { ...on, [slot]: sel.id };
  const hero = dressed(scene, c, bx, byy, R, bagel.tex, show);
  scene.tweens.add({ targets: hero, y: byy - 4 * S, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  if (show.trail) {
    // The trail streams out behind, as if the bagel were rolling along.
    const id = show.trail;
    const ev = scene.time.addEvent({ delay: TRAIL_EVERY[id] * 1000, loop: true, callback: () => {
      const b = trailBit(id);
      const x0 = bx + R * 0.9 + Math.random() * 6 * S;
      const y0 = byy + R * 0.5 + (Math.random() - 0.5) * 10 * S;
      const im = scene.add.image(x0, y0, b.tex).setAlpha(b.alpha).setScale(b.s0 * 1.4);
      if (b.tint) im.setTint(b.tint);
      c.add(im);
      scene.tweens.add({ targets: im, x: x0 + 70 * S + b.dx * 1.4 * S, y: y0 + b.dy * 1.4 * S, scale: b.s1 * 1.4, rotation: b.spin, alpha: 0, duration: b.ms * 1.5, onComplete: () => im.destroy() });
    } });
    c.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  }
  // Its name, what it costs or how to earn it, and the one button.
  const tx = lx + 148 * S;
  const room = lx + iw - 12 * S - tx;
  c.add(fit(txt(scene, tx, stageY + 30 * S, sel.name, 18, CSS.gold).setOrigin(0, 0.5), room));
  const state = isOn ? 'Wearing it' : owned ? 'Yours' : sel.earn ? sel.earn.text : 'Trying it on';
  const st = txt(scene, tx, stageY + 50 * S, state, 12, owned ? '#c9e6a8' : CSS.muted, { bold: false, stroke: false, wrap: room / S, align: 'left' }).setOrigin(0, 0);
  c.add(st);
  const bwid = Math.min(room, 150 * S);
  const byb = stageY + stageH - 30 * S;
  if (owned) {
    c.add(button(scene, tx + bwid / 2, byb, bwid, 40 * S, isOn ? 'Take off' : 'Wear', () => {
      sfx('pop');
      toggleLook(save, sel);
      persist();
      redraw(slotIdx, sel.id);
    }, isOn ? { size: 17, color: COLORS.panelLight, textColor: CSS.cream } : { size: 18 }));
  } else if (sel.cost !== undefined) {
    const cost = sel.cost;
    const b = button(scene, tx + bwid / 2, byb, bwid, 40 * S, `${cost}`, () => {
      if (save.dough < cost) {
        scene.tweens.add({ targets: b, x: { from: b.x - 6 * S, to: b.x }, duration: 260, ease: 'Elastic.Out' });
        sfx('lock');
        return;
      }
      sfx('buy');
      save.dough -= cost;
      const looks = save.looks ?? { owned: [] };
      looks.owned = [...looks.owned, sel.id];
      looks[slot] = sel.id;
      save.looks = looks;
      persist();
      setWallet(save.dough);
      redraw(slotIdx, sel.id);
    }, { size: 18, icon: 'coin', muted: save.dough < cost });
    c.add(b);
  } else c.add(scene.add.image(tx + 14 * S, byb, 'ic_lock').setScale(0.7));

  // Hats, trails or sprinkles.
  c.add(segmented(scene, W / 2, stageY + stageH + 28 * S, iw, 32 * S, SLOT_NAMES, slotIdx, (i) => redraw(i, ''), 14));

  // The row of looks: five to a row.
  const COLS = 5;
  const cw = iw / COLS;
  const chh = 74 * S;
  const gy = stageY + stageH + 54 * S;
  const cells = scene.add.graphics();
  c.add(cells);
  list.forEach((l, i) => {
    const x = lx + cw * ((i % COLS) + 0.5);
    const y = gy + Math.floor(i / COLS) * chh;
    const mine = ownsLook(save, l);
    const wearing = on[slot] === l.id;
    cells.fillStyle(wearing ? 0x6b4f2a : 0x4a3828, 1).fillRoundedRect(x - cw / 2 + 3 * S, y + 3 * S, cw - 6 * S, chh - 6 * S, 10 * S);
    if (l.id === sel.id) cells.lineStyle(2.5 * S, COLORS.gold, 1).strokeRoundedRect(x - cw / 2 + 3 * S, y + 3 * S, cw - 6 * S, chh - 6 * S, 10 * S);
    const iy = y + 30 * S;
    if (slot === 'trail') {
      const b = trailBit(l.id);
      for (const [dx, dy, sc] of [[-11, 5, 0.9], [1, -5, 1.3], [12, 4, 1]] as [number, number, number][]) {
        const im = scene.add.image(x + dx * S, iy + dy * S, b.tex).setScale(sc * 1.2);
        if (b.tint) im.setTint(b.tint);
        if (!mine) im.setAlpha(0.75);
        c.add(im);
      }
    } else {
      // A hat sits high on its bagel, so the pair is nudged down to stay in the cell.
      const k = slot === 'hat' ? 0.95 : 1.1;
      const cy = iy + (slot === 'hat' ? 7 * S : 0);
      const body = scene.add.image(x, cy, 'bagel_plain').setScale(k);
      const top2 = scene.add.image(x, cy, lookTex(scene, l.id)).setScale(k);
      if (slot === 'hat') body.setAlpha(0.45);
      if (!mine) top2.setAlpha(0.85);
      c.add([body, top2]);
    }
    if (wearing) c.add(scene.add.image(x + cw / 2 - 13 * S, y + 14 * S, 'ic_check').setScale(0.42));
    if (mine) c.add(txt(scene, x, y + 60 * S, wearing ? 'On' : 'Yours', 10, wearing ? CSS.gold : '#c9e6a8', { stroke: false }));
    else if (l.cost !== undefined) {
      const t = txt(scene, x + 6 * S, y + 60 * S, `${l.cost}`, 11, save.dough >= l.cost ? CSS.gold : CSS.muted, { stroke: false });
      c.add(t);
      c.add(scene.add.image(t.x - t.width / 2 - 7 * S, y + 60 * S, 'coin').setScale(0.75));
    } else c.add(scene.add.image(x, y + 60 * S, 'ic_lock').setScale(0.36));
    const z = scene.add.zone(x, y + chh / 2, cw, chh).setInteractive();
    z.on('pointerup', () => {
      sfx('click');
      redraw(slotIdx, l.id);
    });
    c.add(z);
  });
  const have = LOOKS.filter((l) => ownsLook(save, l)).length;
  c.add(txt(scene, W / 2, top + ph - 18 * S, `${have} of ${LOOKS.length} looks collected. Looks change nothing about play.`, 11, CSS.muted, { bold: false, stroke: false }));
}

// ---------------------------------------------------------------- Stats

function hours(sec: number): string {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** The key with the biggest count, or '' when there is none. */
function favourite(counts: Record<string, number> | undefined): string {
  let best = '';
  for (const [k, n] of Object.entries(counts ?? {})) if (n > (counts?.[best] ?? 0)) best = k;
  return best;
}

/** The Goals page's Stats tab: lifetime numbers, then the best Endless time on each stage. */
export function fillStats(scene: Phaser.Scene, c: Box, top: number, pw: number, ph: number, save: SaveData): void {
  const W = scene.scale.width;
  const st = save.stats;
  const favBagel = BAGELS.find((b) => b.id === favourite(st?.bagels));
  const favWeapon = WEAPONS[favourite(st?.weapons) as WeaponId];
  const streak = dailyStreak(save);
  const rows: [string, string, string?][] = [
    ['Runs played', (st?.runs ?? 0).toLocaleString()],
    ['Time played', hours(st?.secs ?? 0)],
    ['Enemies defeated', save.totalKills.toLocaleString()],
    ['Bosses beaten', (st?.bosses ?? save.clears).toLocaleString()],
    ['Dough coins picked up', (save.coinsTotal ?? 0).toLocaleString()],
    ['Favourite bagel', favBagel?.name ?? 'none yet', favBagel?.tex],
    ['Favourite weapon', favWeapon?.name ?? 'none yet', favWeapon?.icon],
    ['Daily streak', `${streak} day${streak === 1 ? '' : 's'} (best ${save.daily?.best ?? 0})`],
  ];
  const lx = W / 2 - pw / 2 + 22 * S;
  const rx = W / 2 + pw / 2 - 22 * S;
  const y0 = top + 148 * S;
  const rowH = 30 * S;
  const g = scene.add.graphics();
  c.add(g);
  rows.forEach(([k, v, icon], i) => {
    const y = y0 + i * rowH + rowH / 2;
    if (i % 2 === 0) g.fillStyle(0x1d140d, 0.4).fillRoundedRect(lx - 8 * S, y - rowH / 2 + 1 * S, pw - 28 * S, rowH - 2 * S, 7 * S);
    c.add(txt(scene, lx, y, k, 14, CSS.muted, { bold: false, stroke: false }).setOrigin(0, 0.5));
    const t = fit(txt(scene, rx, y, v, 14, CSS.cream, { stroke: false }).setOrigin(1, 0.5), pw * 0.46);
    c.add(t);
    if (icon) {
      const im = scene.add.image(t.x - t.displayWidth - 14 * S, y, icon);
      im.setScale((22 * S) / im.height);
      c.add(im);
    }
  });
  // Best Endless time on each stage, across every bagel.
  const ey = y0 + rows.length * rowH + 22 * S;
  c.add(txt(scene, W / 2, ey, 'BEST ENDLESS TIMES', 12, CSS.gold, { stroke: false }));
  const built = STAGES.filter((s2) => s2.built);
  const cw = (pw - 36 * S) / built.length;
  built.forEach((s2, i) => {
    let best = 0;
    for (const [k, b] of Object.entries(save.best ?? {})) if (k.startsWith(`${s2.id}e:`) || k.startsWith(`${s2.id}ex:`)) best = Math.max(best, b.time);
    const x = W / 2 - (pw - 36 * S) / 2 + cw * (i + 0.5);
    const pic = scene.add.image(x, ey + 34 * S, `${s2.thumb}_sm`);
    pic.setScale(Math.min((cw - 14 * S) / pic.width, (34 * S) / pic.height));
    if (!best) pic.setTint(0x777777);
    c.add(pic);
    c.add(txt(scene, x, ey + 64 * S, best ? fmtTime(best) : '--', 13, best ? CSS.cream : CSS.muted, { stroke: false }));
  });
  c.add(txt(scene, W / 2, top + ph - 20 * S, 'Runs, time and favourites are counted from version 0.18 on.', 11, CSS.muted, { bold: false, stroke: false, wrap: (pw - 40 * S) / S }));
}
