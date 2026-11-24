import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { MAX_LEVEL, MAX_SLOTS, TOPPINGS, WEAPONS, type ToppingId, type WeaponId } from '../data';
import { load, persist } from '../save';
import { weaponOpen } from '../progress';
import { sfx } from '../sfx';
import { buildSettings } from '../settingsPanel';
import { button, drawPips, panel, pill, txt } from '../ui';
import { COMBOS } from '../weapons';
import type { GameScene } from '../scenes/GameScene';
import type { Choice } from './state';
import { SKIP_HEAL } from './modes';
import { TIPS, markTip, nextHint, openMenu, tipDue } from '../tips';
import { tipBox, tipIn } from './tutor';

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

  /** Is this card still worth offering after another one was taken (Pretzel's second pick)? */
  private stillGood(c: Choice): boolean {
    const g = this.g;
    switch (c.kind) {
      case 'wnew':
        return g.weapons.length < MAX_SLOTS && !g.weaponOf(c.id!);
      case 'wup': {
        const w = g.weaponOf(c.id!);
        return !!w && w.level < MAX_LEVEL && !w.evolved;
      }
      case 'tnew':
        return g.toppings.size < MAX_SLOTS && !g.toppings.has(c.id as ToppingId);
      case 'tup':
        return (g.toppings.get(c.id as ToppingId) ?? 0) < MAX_LEVEL;
      default:
        return true;
    }
  }

  /** `second`: Pretzel's Twisted second pick, from what is left of the same hand. */
  openLevelUp(second?: Choice[]): void {
    const g = this.g;
    const run = g.run;
    g.setPaused('levelup');
    sfx('level');
    const W = g.scale.width;
    const H = g.scale.height;
    const ins = safeInsets();
    const openedAt = performance.now();
    const { c } = this.open(0.65);

    const choices = second ?? g.choices();
    // Day-Old Bin: cards marked for the bin. Nothing is binned until a card is picked, so a slip can be undone.
    const marked = new Set<Choice>();
    const canBin = (o: Choice) => o.kind !== 'heal' && o.kind !== 'coin';
    const binning = run.banishes > 0 && choices.filter(canBin).length > 0 && choices.length > 1;
    const commit = () => marked.forEach((o) => g.banish(o));
    // Pretzel: every 5th level reached lets you take two cards from the hand.
    const reached = run.level - run.pendingLevels + 1;
    const twist = !second && g.bagel.quirkId === 'twist' && reached % 5 === 0 && choices.length > 1;
    const cw = Math.min(W - 28 * S, 400 * S);
    const ch = 84 * S;
    const gap = 12 * S;
    const bottom = H - ins.bottom * S - 86 * S;
    const startY = bottom - choices.length * (ch + gap) + gap + ch / 2;
    const title = txt(g, W / 2, startY - ch / 2 - 56 * S, second ? 'TWISTED!' : 'LEVEL UP!', 34, CSS.gold);
    const sub = txt(g, W / 2, startY - ch / 2 - 24 * S, second ? 'Pick one more' : twist ? `Level ${reached}: Twisted! Pick two` : `Level ${reached}: pick one`, 15, twist || second ? CSS.gold : CSS.muted);
    c.add([title, sub]);
    // The first level-up explains the cards.
    if (!g.practice && tipDue('cards')) {
      markTip('cards');
      c.add(tipIn(g, tipBox(g, W / 2, Math.max(ins.top * S + 40 * S, title.y - 62 * S), TIPS.cards, 14)));
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
      const hasBin = binning && canBin(choice);
      const desc = txt(g, tx, 0, info.desc, 13, '#e8d8c0', { wrap: (cw - (hasBin ? 138 : 100) * S) / S, align: 'left', bold: false, stroke: false }).setOrigin(0, 0).setLineSpacing(-2 * S);
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
        armed = false;
        // A card marked for the bin can't be picked: tapping it takes it back out.
        if (marked.has(choice)) {
          draw(false);
          toggleBin();
          return;
        }
        commit();
        g.applyChoice(choice);
        if (twist) {
          // The rest of the hand comes back for a second pick (cards the first pick made pointless are dropped).
          const rest = choices.filter((o) => o !== choice && !marked.has(o) && this.stillGood(o));
          if (rest.length) {
            this.close();
            this.openLevelUp(rest);
            return;
          }
        }
        run.pendingLevels--;
        this.close();
        g.effects.burst(g.player.x, g.player.y, COLORS.xp, 12, 50);
        if (run.pendingLevels > 0) this.openLevelUp();
        else g.setPaused('');
      });
      // The cards are dealt face down and flip over one after another.
      const back = g.add.graphics();
      back.fillStyle(0x1d140d).fillRoundedRect(-cw / 2, -ch / 2 + 5 * S, cw, ch, 16 * S);
      back.fillStyle(tile, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 16 * S);
      back.lineStyle(3.5 * S, col).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 16 * S);
      back.fillStyle(0xffffff, 0.1).fillRoundedRect(-cw / 2 + 10 * S, -ch / 2 + 10 * S, cw - 20 * S, ch - 20 * S, 10 * S);
      back.setPosition(W / 2, y + 40 * S).setAlpha(0);
      card.scaleY = 0;
      g.tweens.add({ targets: back, alpha: 1, y, delay: 60 * i, duration: 130, ease: 'Cubic.Out' });
      g.tweens.add({ targets: back, scaleY: 0, delay: 60 * i + 130, duration: 80, ease: 'Sine.In', onComplete: () => {
        back.destroy();
        sfx('flip');
      } });
      g.tweens.add({ targets: card, scaleY: 1, delay: 60 * i + 210, duration: 150, ease: 'Back.Out' });
      c.add([back, card]);
      // The bin button on the card's right edge. It sits outside the card so its tap never picks the card.
      let toggleBin = () => {};
      if (hasBin) {
        const bx = W / 2 + cw / 2 - 26 * S;
        const by = y - 6 * S;
        const ring = g.add.graphics();
        const bi = g.add.image(bx, by, 'ic_bin').setScale(0.62);
        const undo = txt(g, W / 2, y, 'IN THE BIN  ·  tap to undo', 14, CSS.cream).setVisible(false);
        const paint = () => {
          const on = marked.has(choice);
          ring.clear();
          ring.fillStyle(on ? COLORS.red : 0x1d140d, 1).fillCircle(bx, by, 17 * S);
          ring.lineStyle(2 * S, on ? 0xfff3dc : 0x6b563f, 1).strokeCircle(bx, by, 17 * S);
          card.setAlpha(on ? 0.16 : 1);
          undo.setVisible(on);
        };
        paint();
        toggleBin = () => {
          if (performance.now() - openedAt < 350) return;
          if (marked.has(choice)) marked.delete(choice);
          // One card always stays to pick, and no more bins than you have left.
          else if (marked.size < run.banishes && marked.size < choices.length - 1) {
            marked.add(choice);
            sfx('bin');
          } else return;
          paint();
          binLeft?.setText(binText());
        };
        const zone = g.add.zone(bx, by, 44 * S, 44 * S).setInteractive();
        zone.on('pointerup', toggleBin);
        [ring, bi, zone].forEach((o) => (o as Phaser.GameObjects.Image).setAlpha(0));
        g.tweens.add({ targets: [ring, bi], alpha: 1, delay: 60 * i + 330, duration: 120 });
        c.add([ring, bi, undo, zone]);
      }
    });
    // How many bins are left, under the cards.
    const binText = () => {
      const n = run.banishes - marked.size;
      return n === 1 ? '1 bin left' : `${n} bins left`;
    };
    let binLeft: Phaser.GameObjects.Text | null = null;
    if (binning) {
      const both = run.rerolls > 0 && !second;
      binLeft = txt(g, both ? W / 2 + 96 * S : W / 2, bottom + 40 * S, binText(), 14, CSS.muted).setOrigin(both ? 0 : 0.5, 0.5);
      c.add([g.add.image(binLeft.x - (both ? 16 * S : binLeft.width / 2 + 16 * S), bottom + 39 * S, 'ic_bin').setScale(0.5), binLeft]);
      // The first time a bin is on offer, say what it does.
      if (!g.practice && tipDue('banish') && !tipDue('cards')) {
        markTip('banish');
        c.add(tipIn(g, tipBox(g, W / 2, Math.max(ins.top * S + 40 * S, title.y - 62 * S), TIPS.banish, 14)));
      }
    }

    if (run.rerolls > 0 && !second) {
      const rb = button(
        g,
        binning ? W / 2 - 22 * S : W / 2,
        bottom + 40 * S,
        170 * S,
        46 * S,
        `Reroll (${run.rerolls})`,
        () => {
          if (performance.now() - openedAt < 350) return;
          commit();
          run.rerolls--;
          this.close();
          this.openLevelUp();
        },
        { color: COLORS.panelLight, textColor: CSS.cream, size: 17 },
      );
      c.add(rb);
    }

    // Skip: take no card at all (the owner's ask: a one-weapon run must be possible when every card is a new weapon).
    // It sits up beside the title, away from the thumb, and asks twice so a slip never costs a level.
    let sure = false;
    const sx = W - 44 * S;
    const sy = title.y;
    const skip = button(
      g,
      sx,
      sy,
      64 * S,
      30 * S,
      'Skip',
      () => {
        if (performance.now() - openedAt < 350) return;
        if (!sure) {
          sure = true;
          skipText.setText('Sure?');
          skipText.setColor(CSS.gold);
          return;
        }
        commit();
        // A small heal, so passing on a hand is worth something (the owner's pick). It counts as healing taken.
        if (g.player.hp < g.stats.maxHp) {
          g.player.hp = Math.min(g.stats.maxHp, g.player.hp + SKIP_HEAL);
          run.healsTaken++;
          sfx('sip');
        }
        run.pendingLevels--;
        this.close();
        if (run.pendingLevels > 0) this.openLevelUp();
        else g.setPaused('');
      },
      { color: COLORS.panelLight, textColor: CSS.muted, size: 13 },
    );
    const skipText = skip.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;
    // The title is centred: when it would run under the button, it moves left to make room.
    const over = title.x + title.width / 2 + 8 * S - (sx - 32 * S);
    if (over > 0) {
      title.x -= over;
      sub.x -= Math.min(over, Math.max(0, sub.x + sub.width / 2 + 8 * S - (sx - 32 * S)));
    }
    c.add([skip, txt(g, sx, sy + 28 * S, `+${SKIP_HEAL} health`, 11, CSS.muted)]);
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
    run.chestsOpened++;
    // A secret recipe: the first gold toaster after both weapons of a combo are evolved merges them. It goes ahead
    // of any normal evolution that's waiting (that one comes from the next chest). With two combos ready, the pair
    // that was finished first merges first.
    const ready = !gold
      ? []
      : COMBOS.map((def) => ({ def, keep: g.weaponOf(def.keep), drop: g.weaponOf(def.drop) }))
          .filter((m) => !!m.keep?.evolved && !!m.drop?.evolved && !m.keep.combo)
          .sort((a, b) => Math.max(a.keep!.evolvedAt, a.drop!.evolvedAt) - Math.max(b.keep!.evolvedAt, b.drop!.evolvedAt));
    const merge = ready[0];
    const evo = merge ? undefined : g.weapons.find((w) => w.level >= MAX_LEVEL && !w.evolved && g.toppings.has(w.def.evolveWith));
    sfx(evo || merge ? 'evolve' : gold ? 'gold' : 'basket');
    let title: string;
    const lines: string[] = [];
    let icon = 'ic_heal';
    if (merge) {
      const { def, keep, drop } = merge;
      drop!.destroy();
      g.weapons.splice(g.weapons.indexOf(drop!), 1);
      // The kept weapon starts over, so nothing of the old evolution is left on the floor.
      keep!.destroy();
      keep!.combo = true;
      title = 'SECRET RECIPE!';
      lines.push(`${drop!.def.evoName} + ${keep!.def.evoName}\nbecame ${def.name}!`, 'A weapon slot is free again.');
      icon = def.icon;
      run.foundCombos.push(def.name);
      const save = load();
      if (!(save.secrets ?? []).includes(def.id)) save.secrets = [...(save.secrets ?? []), def.id];
      persist();
    } else if (evo) {
      evo.evolved = true;
      evo.evolvedAt = g.now;
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
    // One text per reward, so they can come out one at a time. The panel grows to hold them.
    const wrap = Math.min(W / S - 70, 300);
    const rewards = line.split('\n').map((l) => txt(g, W / 2, 0, l, 16, '#e8d8c0', { wrap, bold: false }));
    const blockH = rewards.reduce((a, r) => a + r.height, 0);
    const extra = Math.max(0, blockH - 44 * S);
    c.add(panel(g, W / 2, H / 2 + extra / 2, Math.min(W - 40 * S, 340 * S), 250 * S + extra));
    const cy = H / 2 - 60 * S;
    const im = g.add.image(W / 2, cy, icon).setScale(2.2);
    const t1 = txt(g, W / 2, H / 2 + 6 * S, title, evo || gold ? 28 : 24, evo || gold ? CSS.gold : CSS.cream);
    let ry = H / 2 + 56 * S + extra / 2 - blockH / 2;
    for (const r of rewards) {
      r.setY(ry + r.height / 2);
      ry += r.height;
    }
    const t3 = txt(g, W / 2, H / 2 + 100 * S + extra, 'Tap to continue', 13, CSS.muted).setAlpha(0);
    c.add([im, t1, ...rewards, t3]);
    // The first chest explains what chests do.
    if (!g.practice && tipDue('chest')) {
      markTip('chest');
      c.add(tipIn(g, tipBox(g, W / 2, H / 2 - 125 * S - 44 * S, TIPS.chest, 14)));
    }
    g.tweens.resumeAll();

    // The reveal: every step is a tween that can be jumped to its end, so a tap skips straight to the rewards.
    const ends: (() => void)[] = [];
    type Target = Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    const play = (target: Target, to: Partial<Record<'x' | 'y' | 'scale' | 'alpha' | 'angle', number>>, cfg: Phaser.Types.Tweens.TweenBuilderConfig | object, onEnd?: () => void): void => {
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        onEnd?.();
      };
      const tw = g.tweens.add({ targets: target, ...to, ...cfg, onComplete: end });
      ends.push(() => {
        tw.stop();
        if (!target.scene) return;
        for (const [k, v] of Object.entries(to)) {
          if (k === 'scale') target.setScale(v);
          else (target as unknown as Record<string, number>)[k] = v;
        }
        end();
      });
    };
    /** A flash of ring and stars around the icon. */
    const pop = () => {
      if (!c.scene) return;
      const ring = g.add.image(W / 2, cy, 'hitring').setTint(0xffe2a0).setScale(1);
      c.add(ring);
      g.tweens.add({ targets: ring, scale: 5.5, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
      for (let i = 0; i < 8; i++) {
        const st = g.add.image(W / 2, cy, 'star4').setTint(i % 2 ? 0xffffff : 0xffd34d).setScale(2.2);
        c.add(st);
        const a = (i / 8) * Math.PI * 2 + 0.3;
        g.tweens.add({ targets: st, x: W / 2 + Math.cos(a) * 92 * S, y: cy + Math.sin(a) * 70 * S, angle: 200, scale: 0.4, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => st.destroy() });
      }
    };
    /** Title, then the rewards one after another, then the tap line. */
    const payOut = (at: number) => {
      t1.setScale(0.4).setAlpha(0);
      play(t1, { scale: 1, alpha: 1 }, { delay: at, duration: 220, ease: 'Back.Out' });
      rewards.forEach((r, i) => {
        const y = r.y;
        r.setAlpha(0).setY(y - 22 * S);
        play(r, { y, alpha: 1 }, { delay: at + 140 + i * 130, duration: 220, ease: 'Back.Out', onStart: () => sfx('tick') });
      });
      play(t3, { alpha: 1 }, { delay: at + 240 + rewards.length * 130, duration: 200 });
    };
    if (evo || merge) {
      // Old and new side by side: the two halves of the recipe slide together and become the new weapon.
      const parts = merge ? [WEAPONS.lox.icon, WEAPONS.puddle.icon] : [evo!.def.icon, TOPPINGS[evo!.def.evolveWith].icon];
      im.setScale(0).setAlpha(0);
      const halves = parts.map((ic, i) => g.add.image(W / 2 + (i ? 52 : -52) * S, cy, ic).setScale(1.5));
      const plus = txt(g, W / 2, cy, '+', 26, CSS.cream);
      const star = g.add.image(W / 2 + 34 * S, cy - 30 * S, 'ic_star').setScale(0).setVisible(!merge);
      c.add([...halves, plus, star]);
      let merged = false;
      const join = () => {
        if (merged) return;
        merged = true;
        halves.forEach((h) => h.destroy());
        plus.destroy();
        pop();
      };
      halves.forEach((h, i) => play(h, { x: W / 2 }, { delay: 380, duration: 300, ease: 'Back.In' }, i ? join : undefined));
      play(plus, { alpha: 0 }, { delay: 380, duration: 200 });
      play(im, { scale: 2.2, alpha: 1 }, { delay: 680, duration: 320, ease: 'Back.Out' });
      play(star, { scale: 0.8, angle: 360 }, { delay: 760, duration: 420, ease: 'Back.Out' });
      payOut(760);
    } else if (gold) {
      // The golden toaster rattles, pops, and the rewards come out.
      im.setScale(1.9);
      play(im, { angle: 0 }, { duration: 420, ease: 'Linear', onUpdate: (tw: Phaser.Tweens.Tween) => im.setAngle(Math.sin(tw.progress * 26) * 9 * (1 - tw.progress * 0.3)) }, pop);
      play(im, { scale: 2.2 }, { delay: 420, duration: 260, ease: 'Back.Out', onStart: () => im.setScale(2.9) });
      payOut(480);
    } else {
      im.setScale(0.5);
      play(im, { scale: 2.2 }, { duration: 380, ease: 'Back.Out' });
      payOut(160);
    }
    const openedAt = performance.now();
    let skipped = false;
    dim.on('pointerup', () => {
      const dt = performance.now() - openedAt;
      // The first moments ignore taps (a thumb lifting off the joystick). After that a tap skips the reveal,
      // and a tap once it's all shown carries on.
      if (dt < 250) return;
      if (!skipped && t3.alpha < 1) {
        skipped = true;
        ends.splice(0).forEach((end) => end());
        return;
      }
      if (dt < 600) return;
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
    // Rerolls and bins left, for anyone who has bought them.
    const ranks = load().upgrades;
    if (ranks.reroll || ranks.bin) stats.push(pill(g, 0, top + 74 * S, 'ic_bk_reroll', `${run.rerolls}`, { size: 14, h: 28 }));
    if (ranks.bin) stats.push(pill(g, 0, top + 74 * S, 'ic_bin', `${run.banishes}`, { size: 14, h: 28 }));
    const gap = (stats.length > 3 ? 5 : 8) * S;
    const sw = stats.reduce((a, p) => a + p.width, 0) + gap * (stats.length - 1);
    const sk = Math.min(1, (pw - 16 * S) / sw);
    let x = W / 2 - (sw * sk) / 2;
    for (const p of stats) {
      p.setScale(sk);
      p.x = x + (p.width * sk) / 2;
      x += (p.width + gap) * sk;
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
