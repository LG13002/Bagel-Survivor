import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { MAX_LEVEL, MAX_SLOTS, TOPPINGS, WEAPONS, type ToppingId, type WeaponId } from '../data';
import { load, persist } from '../save';
import { weaponOpen } from '../progress';
import { sfx } from '../sfx';
import { buildSettings } from '../settingsPanel';
import { button, drawPips, panel, pill, txt } from '../ui';
import { COMBO } from '../weapons';
import type { GameScene } from '../scenes/GameScene';
import type { Choice } from './state';
import { TIPS, markTip, nextHint, openMenu, tipDue } from '../tips';
import { tipBox } from './tutor';

/**
 * The pop-ups that pause a run: level-up cards, chests and the pause menu. Only one is open at a time. Made fresh
 * for every run.
 */
export class Panels {
  private overlay: Phaser.GameObjects.Container | null = null;
  /** Looping animations on the open panel, stopped when it closes. */
  private overlayTweens: Phaser.Tweens.Tween[] = [];

  constructor(private g: GameScene) {}

  close(): void {
    for (const tw of this.overlayTweens) tw.stop();
    this.overlayTweens = [];
    this.overlay?.destroy();
    this.overlay = null;
  }

  /** A fresh full-screen container for a panel, with a dark backdrop that swallows taps. */
  private open(alpha: number): { c: Phaser.GameObjects.Container; dim: Phaser.GameObjects.Rectangle } {
    const g = this.g;
    const c = g.add.container(0, 0);
    g.ui(c);
    this.overlay = c;
    const dim = g.add.rectangle(0, 0, g.scale.width, g.scale.height, 0x120c08, alpha).setOrigin(0);
    dim.setInteractive(); // swallow taps
    c.add(dim);
    return { c, dim };
  }

  // ---------------------------------------------------------------- Level up

  private describe(c: Choice): { icon: string; name: string; tag: string; desc: string } {
    const g = this.g;
    switch (c.kind) {
      case 'wnew': {
        const d = WEAPONS[c.id as WeaponId];
        return { icon: d.icon, name: d.name, tag: 'NEW WEAPON', desc: d.blurb };
      }
      case 'wup': {
        const w = g.weaponOf(c.id!)!;
        return { icon: w.def.icon, name: w.def.name, tag: `LV ${w.level + 1}`, desc: w.def.levels[w.level] };
      }
      case 'tnew': {
        const d = TOPPINGS[c.id as ToppingId];
        return { icon: d.icon, name: d.name, tag: 'NEW TOPPING', desc: d.blurb };
      }
      case 'tup': {
        const d = TOPPINGS[c.id as ToppingId];
        return { icon: d.icon, name: d.name, tag: `LV ${(g.toppings.get(c.id as ToppingId) ?? 0) + 1}`, desc: d.blurb };
      }
      case 'heal':
        return { icon: 'ic_heal', name: 'Fresh Out the Oven', tag: 'HEAL', desc: 'Restore 30 health.' };
      case 'coin':
        return { icon: 'ic_coin', name: 'Tip Jar', tag: 'DOUGH', desc: '+15 Dough at the end of the run.' };
    }
  }

  /** True if taking this choice completes an evolution recipe. */
  isCombo(c: Choice): boolean {
    const g = this.g;
    if (c.kind === 'wnew' || c.kind === 'wup') {
      const def = WEAPONS[c.id as WeaponId];
      return g.toppings.has(def.evolveWith);
    }
    if (c.kind === 'tnew') return g.weapons.some((w) => !w.evolved && w.def.evolveWith === c.id);
    return false;
  }

  /** The other half of a card's evolution recipe: the topping a weapon needs, or the weapon a topping evolves. */
  private partner(c: Choice): { icon: string; owned: boolean } | null {
    const g = this.g;
    if (c.kind === 'wnew' || c.kind === 'wup') {
      const def = WEAPONS[c.id as WeaponId];
      return { icon: TOPPINGS[def.evolveWith].icon, owned: g.toppings.has(def.evolveWith) };
    }
    if (c.kind === 'tnew' || c.kind === 'tup') {
      const def = Object.values(WEAPONS).find((w) => w.evolveWith === c.id);
      if (!def || !weaponOpen(load(), def.id)) return null;
      const own = g.weaponOf(def.id);
      if (own?.evolved) return null;
      return { icon: def.icon, owned: !!own };
    }
    return null;
  }

  openLevelUp(): void {
    const g = this.g;
    const run = g.run;
    g.setPaused('levelup');
    sfx('level');
    const W = g.scale.width;
    const H = g.scale.height;
    const ins = safeInsets();
    const openedAt = performance.now();
    const { c } = this.open(0.65);

    const choices = g.choices();
    const cw = Math.min(W - 28 * S, 400 * S);
    const ch = 84 * S;
    const gap = 12 * S;
    const bottom = H - ins.bottom * S - 86 * S;
    const startY = bottom - choices.length * (ch + gap) + gap + ch / 2;
    const title = txt(g, W / 2, startY - ch / 2 - 56 * S, 'LEVEL UP!', 34, CSS.gold);
    const sub = txt(g, W / 2, startY - ch / 2 - 24 * S, `Level ${run.level - run.pendingLevels + 1}: pick one`, 15, CSS.muted);
    c.add([title, sub]);
    // The first level-up explains the cards.
    if (!g.practice && tipDue('cards')) {
      markTip('cards');
      c.add(tipBox(g, W / 2, Math.max(ins.top * S + 40 * S, title.y - 62 * S), TIPS.cards, 14));
    }
    g.tweens.resumeAll();
    title.setScale(0.5);
    g.tweens.add({ targets: title, scale: 1, duration: 260, ease: 'Back.Out' });

    choices.forEach((choice, i) => {
      const y = startY + i * (ch + gap);
      const info = this.describe(choice);
      const combo = this.isCombo(choice);
      const card = g.add.container(W / 2, y);
      const gr = g.add.graphics();
      const kind = choice.kind;
      // Color by type so a card reads before its text does.
      const col = combo ? COLORS.gold : kind === 'wnew' || kind === 'wup' ? 0xf08a3c : kind === 'tnew' || kind === 'tup' ? 0x5aa9e6 : COLORS.green;
      const tile = Phaser.Display.Color.ValueToColor(col).darken(35).color;
      const draw = (pressed: boolean) => {
        const dy = pressed ? 3 * S : 0;
        gr.clear();
        gr.fillStyle(0x1d140d).fillRoundedRect(-cw / 2, -ch / 2 + 5 * S, cw, ch, 16 * S);
        gr.fillStyle(pressed ? COLORS.panelLight : COLORS.panel).fillRoundedRect(-cw / 2, -ch / 2 + dy, cw, ch, 16 * S);
        gr.lineStyle(3.5 * S, col).strokeRoundedRect(-cw / 2, -ch / 2 + dy, cw, ch, 16 * S);
        gr.fillStyle(tile, 1).fillRoundedRect(-cw / 2 + 12 * S, -30 * S + dy, 60 * S, 60 * S, 12 * S);
        gr.lineStyle(2 * S, 0x24160d, 1).strokeRoundedRect(-cw / 2 + 12 * S, -30 * S + dy, 60 * S, 60 * S, 12 * S);
        gr.fillStyle(0xffffff, 0.12).fillRoundedRect(-cw / 2 + 16 * S, -26 * S + dy, 52 * S, 18 * S, 8 * S);
      };
      draw(false);
      const icon = g.add.image(-cw / 2 + 42 * S, 0, info.icon).setScale(1.4);
      const tx = -cw / 2 + 86 * S;
      // Ribbon on the top-right corner holds the tag, so long names never run into it.
      const label = combo ? '★ COMBO' : kind === 'wup' ? 'WEAPON' : kind === 'tup' ? 'TOPPING' : info.tag;
      const tag = txt(g, 0, 0, label, 11, kind === 'heal' || kind === 'coin' || combo ? CSS.dark : '#ffffff', { stroke: false });
      const rw = tag.width + 16 * S;
      const rib = g.add.graphics();
      rib.fillStyle(col, 1).fillRoundedRect(cw / 2 - rw - 10 * S, -ch / 2 - 9 * S, rw, 20 * S, 10 * S);
      rib.lineStyle(2 * S, 0x24160d, 1).strokeRoundedRect(cw / 2 - rw - 10 * S, -ch / 2 - 9 * S, rw, 20 * S, 10 * S);
      tag.setPosition(cw / 2 - rw / 2 - 10 * S, -ch / 2 + 1 * S);
      const name = txt(g, tx, -18 * S, info.name, 18, CSS.cream).setOrigin(0, 0.5);
      const maxName = cw - 100 * S;
      if (name.width > maxName) name.setScale(maxName / name.width);
      const desc = txt(g, tx, 0, info.desc, 13, '#e8d8c0', { wrap: (cw - 100 * S) / S, align: 'left', bold: false, stroke: false }).setOrigin(0, 0).setLineSpacing(-2 * S);
      card.add([gr, icon, name, desc, rib, tag]);
      // Level pips: current level filled, the level you'd get glowing.
      const lvl = kind === 'wup' ? g.weaponOf(choice.id!)!.level : kind === 'tup' ? (g.toppings.get(choice.id as ToppingId) ?? 0) : kind === 'wnew' || kind === 'tnew' ? 0 : -1;
      if (lvl >= 0) {
        const pg = g.add.graphics();
        drawPips(pg, tx + 5 * S, 30 * S, MAX_LEVEL, lvl, true, col, 3.6 * S, 12 * S);
        card.add(pg);
      }
      // What it evolves with, in the bottom corner: a weapon's card shows its topping, a topping's card its weapon.
      // Bright once you own the other half.
      const partner = this.partner(choice);
      if (partner) {
        const pi = g.add.image(cw / 2 - 20 * S, 29 * S, partner.icon).setScale(0.6).setAlpha(partner.owned ? 1 : 0.8);
        const pl = txt(g, pi.x - 14 * S, 30 * S, kind === 'wnew' || kind === 'wup' ? 'EVOLVES WITH' : 'EVOLVES', 9, partner.owned ? CSS.gold : CSS.muted, { stroke: false }).setOrigin(1, 0.5);
        card.add([pl, pi]);
      }
      // The note sits between the name and the level pips (or the card's bottom edge when there are none),
      // centred in that gap. A note too tall for it, such as two lines above the pips, shrinks to fit.
      const noteTop = -6 * S;
      const noteRoom = (lvl >= 0 ? 29 : 38) * S;
      if (desc.height > noteRoom) desc.setScale(noteRoom / desc.height);
      desc.setY(noteTop + (noteRoom - desc.displayHeight) / 2);
      if (combo) {
        const sp = g.add.image(-cw / 2 + 66 * S, -24 * S, 'ic_star').setScale(0.55);
        card.add(sp);
        this.overlayTweens.push(g.tweens.add({ targets: sp, angle: 360, duration: 2400, repeat: -1 }));
      }
      card.setSize(cw, ch);
      card.setInteractive(new Phaser.Geom.Rectangle(0, 0, cw, ch), Phaser.Geom.Rectangle.Contains);
      let armed = false;
      card.on('pointerdown', () => {
        // Ignore taps in the first moments so a thumb lifting off the joystick can't pick by accident.
        if (performance.now() - openedAt < 350) return;
        armed = true;
        draw(true);
      });
      card.on('pointerout', () => {
        armed = false;
        draw(false);
      });
      card.on('pointerup', () => {
        if (!armed) return;
        g.applyChoice(choice);
        run.pendingLevels--;
        this.close();
        g.effects.burst(g.player.x, g.player.y, COLORS.xp, 12, 50);
        if (run.pendingLevels > 0) this.openLevelUp();
        else g.setPaused('');
      });
      card.setAlpha(0);
      card.y = y + 60 * S;
      g.tweens.add({ targets: card, alpha: 1, y, delay: 70 * i, duration: 240, ease: 'Back.Out' });
      c.add(card);
    });

    if (run.rerolls > 0) {
      const rb = button(
        g,
        W / 2,
        bottom + 40 * S,
        170 * S,
        46 * S,
        `Reroll (${run.rerolls})`,
        () => {
          if (performance.now() - openedAt < 350) return;
          run.rerolls--;
          this.close();
          this.openLevelUp();
        },
        { color: COLORS.panelLight, textColor: CSS.cream, size: 17 },
      );
      c.add(rb);
    }
  }

  // ---------------------------------------------------------------- Chests

  /** Upgrades a chest can hand out: levels for owned weapons and toppings, in random order. Never a new item. */
  private chestUpgrades(): Choice[] {
    const g = this.g;
    const out: Choice[] = [];
    for (const w of g.weapons) if (w.level < MAX_LEVEL && !w.evolved) out.push({ kind: 'wup', id: w.def.id });
    for (const [id, lv] of g.toppings) if (lv < MAX_LEVEL) out.push({ kind: 'tup', id });
    return Phaser.Utils.Array.Shuffle(out);
  }

  openChest(gold: boolean): void {
    const g = this.g;
    const run = g.run;
    g.setPaused('chest');
    // The secret recipe: the first gold toaster after Schmear Flood and Lox Cyclone are both evolved merges them.
    // It goes ahead of any normal evolution that's waiting (that one comes from the next chest).
    const lox = g.weaponOf('lox');
    const flood = g.weaponOf('puddle');
    const merge = gold && !!lox?.evolved && !!flood?.evolved && !lox.combo;
    const evo = merge ? undefined : g.weapons.find((w) => w.level >= MAX_LEVEL && !w.evolved && g.toppings.has(w.def.evolveWith));
    sfx(evo || merge ? 'evolve' : gold ? 'gold' : 'basket');
    let title: string;
    const lines: string[] = [];
    let icon = 'ic_heal';
    if (merge) {
      flood!.destroy();
      g.weapons.splice(g.weapons.indexOf(flood!), 1);
      lox!.combo = true;
      title = 'SECRET RECIPE!';
      lines.push(`Schmear Flood + Lox Cyclone\nbecame ${COMBO.name}!`, 'A weapon slot is free again.');
      icon = COMBO.icon;
      run.foundCombo = true;
      const save = load();
      if (!(save.secrets ?? []).includes('combo')) save.secrets = [...(save.secrets ?? []), 'combo'];
      persist();
    } else if (evo) {
      evo.evolved = true;
      title = 'EVOLUTION!';
      lines.push(`${evo.def.name} became ${evo.def.evoName}`);
      if (!gold) lines.push(evo.def.evoBlurb);
      icon = evo.def.icon;
      run.evolutionsThisRun.push(evo.def.id);
      const save = load();
      if (!save.cookbook.includes(evo.def.id)) save.cookbook.push(evo.def.id);
      // The first evolution opens the Cookbook on the menu.
      if (!g.practice) openMenu(save, 'cookbook');
      persist();
    } else {
      title = gold ? 'GOLDEN TOASTER!' : 'BREAD BASKET';
      const dough = gold ? 15 : 5;
      run.coins += dough;
      lines.push(`+${dough} Dough`);
    }
    const ups = merge ? 1 : evo ? (gold ? 2 : 0) : gold ? 3 : 1;
    const got: string[] = [];
    // Chests only level up what you already own: empty slots are left for you to fill from level-up cards.
    for (let i = 0; i < ups; i++) {
      const opts = this.chestUpgrades();
      const pick = opts.find((c) => c.kind === 'wup') ?? opts[0];
      if (!pick) break;
      const info = this.describe(pick);
      g.applyChoice(pick);
      got.push(`${info.name} ${info.tag.startsWith('LV') ? info.tag.replace('LV', 'Lv') : '(new)'}`);
    }
    if (!evo && !merge) icon = gold ? 'goldchest' : 'chest';
    if (!evo && !merge && !got.length) {
      g.player.hp = g.stats.maxHp;
      got.push('Fully healed!');
    }
    const line = (merge ? [...lines, ...got] : [...got, ...lines]).join('\n');
    const W = g.scale.width;
    const H = g.scale.height;
    const { c, dim } = this.open(0.7);
    const extra = Math.max(0, line.split('\n').length - 2) * 20 * S;
    c.add(panel(g, W / 2, H / 2 + extra / 2, Math.min(W - 40 * S, 340 * S), 250 * S + extra));
    const im = g.add.image(W / 2, H / 2 - 60 * S, icon).setScale(2.2);
    const t1 = txt(g, W / 2, H / 2 + 6 * S, title, evo || gold ? 28 : 24, evo || gold ? CSS.gold : CSS.cream);
    const t2 = txt(g, W / 2, H / 2 + 56 * S + extra / 2, line, 16, '#e8d8c0', { wrap: Math.min(W / S - 70, 300), bold: false });
    const t3 = txt(g, W / 2, H / 2 + 100 * S + extra, 'Tap to continue', 13, CSS.muted).setAlpha(0);
    c.add([im, t1, t2, t3]);
    // The first chest explains what chests do.
    if (!g.practice && tipDue('chest')) {
      markTip('chest');
      c.add(tipBox(g, W / 2, H / 2 - 125 * S - 44 * S, TIPS.chest, 14));
    }
    g.tweens.resumeAll();
    im.setScale(0.5);
    g.tweens.add({ targets: im, scale: 2.2, angle: evo ? 360 : 0, duration: 500, ease: 'Back.Out' });
    g.tweens.add({ targets: t3, alpha: 1, delay: 600, duration: 200 });
    const openedAt = performance.now();
    dim.on('pointerup', () => {
      if (performance.now() - openedAt < 600) return;
      this.close();
      g.setPaused('');
    });
  }

  // ---------------------------------------------------------------- Pause

  openPause(): void {
    const g = this.g;
    if (g.paused) return;
    g.setPaused('pause');
    g.writeSnapshot();
    this.drawPause();
  }

  /** Draws the pause screen (the run is already paused). */
  private drawPause(): void {
    const g = this.g;
    const run = g.run;
    const W = g.scale.width;
    const H = g.scale.height;
    const { c } = this.open(0.7);
    const pw = Math.min(W - 32 * S, 340 * S);
    // A hint takes turns along the bottom (not with Tips off).
    const hint = nextHint();
    const ph = (hint ? 512 : 470) * S;
    const top = H / 2 - ph / 2;
    c.add(panel(g, W / 2, H / 2, pw, ph));
    if (hint) {
      const ht = txt(g, W / 2, top + 479 * S, `TIP: ${hint}`, 12, CSS.muted, { bold: false, stroke: false, wrap: (pw - 36 * S) / S });
      if (ht.height > 34 * S) ht.setScale((34 * S) / ht.height);
      c.add(ht);
    }
    c.add(txt(g, W / 2, top + 36 * S, g.practice ? 'PAUSED (PRACTICE)' : g.quick ? 'PAUSED (QUICK)' : g.endless ? 'PAUSED (ENDLESS)' : 'PAUSED', 26, CSS.gold));

    // Run so far
    const stats = [
      pill(g, 0, top + 74 * S, 'ic_clock', fmtTime(g.now), { size: 14, h: 28 }),
      pill(g, 0, top + 74 * S, 'en_crumb', `${run.kills}`, { size: 14, h: 28 }),
      pill(g, 0, top + 74 * S, 'coin', `+${g.practice ? 0 : g.runDough(false)}`, { size: 14, h: 28, color: CSS.gold }),
    ];
    const gap = 8 * S;
    let x = W / 2 - (stats.reduce((a, p) => a + p.width, 0) + gap * 2) / 2;
    for (const p of stats) {
      p.x = x + p.width / 2;
      x += p.width + gap;
      c.add(p);
    }

    // Your build: weapons on top, toppings below, each with level pips.
    const cell = Math.min(70 * S, (pw - 30 * S) / MAX_SLOTS);
    const gx = W / 2 - (cell * MAX_SLOTS) / 2;
    const row = (y: number, label: string, items: { icon: string; lv: number; evolved: boolean; needs?: string; has?: boolean }[], col: number) => {
      c.add(txt(g, gx + 4 * S, y - 12 * S, label, 12, CSS.muted, { bold: true, stroke: false }).setOrigin(0, 0.5));
      for (let i = 0; i < MAX_SLOTS; i++) {
        const it = items[i];
        const cx = gx + cell * i + cell / 2;
        const gr = g.add.graphics();
        const t = 48 * S;
        gr.fillStyle(it ? Phaser.Display.Color.ValueToColor(col).darken(35).color : 0x1d140d, it ? 1 : 0.5).fillRoundedRect(cx - t / 2, y, t, t, 10 * S);
        gr.lineStyle(2 * S, it?.evolved ? COLORS.gold : 0x24160d, 1).strokeRoundedRect(cx - t / 2, y, t, t, 10 * S);
        c.add(gr);
        if (!it) continue;
        c.add(g.add.image(cx, y + t / 2, it.icon).setScale(1.1));
        if (it.evolved) c.add(g.add.image(cx + t / 2 - 4 * S, y + 4 * S, 'ic_star').setScale(0.5));
        else {
          const pg = g.add.graphics();
          drawPips(pg, cx - 2 * 8 * S, y + t + 9 * S, MAX_LEVEL, it.lv, false, col, 2.8 * S, 8 * S);
          c.add(pg);
        }
        if (it.needs) {
          // The topping this weapon evolves with, on its corner: gold-ringed once you own it.
          const bx = cx + t / 2 - 3 * S;
          const by = y + 3 * S;
          const bg = g.add.graphics();
          bg.fillStyle(0x24160d, 1).fillCircle(bx, by, 11 * S);
          bg.fillStyle(it.has ? 0x3f5f86 : 0x4a3a2c, 1).fillCircle(bx, by, 9 * S);
          if (it.has) bg.lineStyle(1.5 * S, COLORS.gold, 1).strokeCircle(bx, by, 9 * S);
          c.add(bg);
          c.add(g.add.image(bx, by, it.needs).setScale(0.42).setAlpha(it.has ? 1 : 0.8));
        }
      }
    };
    row(top + 116 * S, 'WEAPONS', g.weapons.map((w) => ({ icon: w.icon, lv: w.level, evolved: w.evolved, needs: w.evolved ? undefined : TOPPINGS[w.def.evolveWith].icon, has: g.toppings.has(w.def.evolveWith) })), 0xf08a3c);
    row(top + 196 * S, 'TOPPINGS', [...g.toppings].map(([id, lv]) => ({ icon: TOPPINGS[id].icon, lv, evolved: false })), 0x5aa9e6);

    c.add(
      button(g, W / 2, top + 300 * S, 200 * S, 52 * S, 'Resume', () => {
        this.close();
        g.setPaused('');
      }),
    );
    let confirm = false;
    const quit = button(g, W / 2, top + 364 * S, 200 * S, 44 * S, 'Quit run', () => {
      // Ask once, so a stray tap can't end a good run.
      if (!confirm) {
        confirm = true;
        (quit.getData('label') as Phaser.GameObjects.Text).setText('Tap again to quit');
        return;
      }
      this.close();
      g.paused = '';
      g.endRun(false, true);
    }, { color: COLORS.panelLight, textColor: CSS.cream, size: 17 });
    c.add(quit);
    // Volume, shake and the rest can be changed mid-run.
    c.add(button(g, W / 2, top + 420 * S, 200 * S, 44 * S, 'Settings', () => this.openSettings(), { color: COLORS.panelLight, textColor: CSS.cream, size: 17 }));
  }

  /** Settings, from the pause screen. The back button returns to the pause screen. */
  private openSettings(): void {
    const g = this.g;
    this.close();
    const { c } = this.open(0.7);
    buildSettings(g, c, {
      inRun: true,
      onClose: () => {
        this.close();
        g.hud.layout(); // the left-handed setting moves the HUD
        this.drawPause();
      },
    });
  }
}
