import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { load } from '../save';
import { button, fit, panel, pill, txt } from '../ui';
import { Face } from '../face';
import { Wear, makeLookTextures, worn } from '../looks';
import { dailyResult, niceDate } from '../daily';
import { shareScore } from '../scoreCard';
import { sfx } from '../sfx';
import { shake } from '../settings';
import { bigBagel } from '../textures';
import type { RunResult } from './GameScene';
import { BAGELS, WEAPONS, stageById } from '../data';
import { nearestGoals, weaponGoalStatus, weaponOpen } from '../progress';
import { wipeOpen, wipeTo } from '../wipe';
import { TIPS, markTip, menuOpen, nextHint, tipDue } from '../tips';

export class ResultsScene extends Phaser.Scene {
  private result!: RunResult;
  /** This is the screen that points a new player at the Bakery (decided once, so a resize keeps it). */
  private toBakery = false;
  private hint = '';
  /** The count-up has been shown (a resize redraws the finished screen), and whether it is running now. */
  private played = false;
  private playing = false;
  constructor() {
    super('results');
  }

  init(data: RunResult): void {
    this.result = data;
  }

  create(): void {
    const save = load();
    // The first run's results point at the Bakery, as long as there's something to buy.
    this.toBakery = !this.result.practice && tipDue('bakery') && menuOpen(save, 'bakery') && save.dough >= 20;
    if (this.toBakery) markTip('bakery');
    this.hint = nextHint();
    this.played = false;
    this.playing = false;
    this.build();
    const onResize = () => {
      this.playing = false;
      this.time.removeAllEvents();
      this.tweens.killAll();
      this.children.removeAll(true);
      this.build();
    };
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    if (!wipeOpen()) this.cameras.main.fadeIn(300, 18, 12, 8);
  }

  private build(): void {
    const r = this.result;
    const W = this.scale.width;
    const H = this.scale.height;
    const ins = safeInsets();
    const save = load();
    this.add.tileSprite(0, 0, W, H, 'floor_stage1').setOrigin(0).setAlpha(0.3);

    const pw = Math.min(W - 28 * S, 380 * S);
    const compact = (H - (ins.top + ins.bottom) * S) / S < 720; // short screens: smaller panel, fewer notes
    const ph = (compact ? 410 : 480) * S;
    const cy = compact ? ins.top * S + 14 * S + ph / 2 : Math.min(H / 2 - 40 * S, ins.top * S + 40 * S + ph / 2);
    panel(this, W / 2, cy, pw, ph);
    const top = cy - ph / 2;
    // Endless always ends in going stale, so its title is the score: time survived.
    const dy = r.daily;
    makeLookTextures(this);
    const looks = worn(save);
    // A hat needs headroom: the title and its line move up a little, the bagel down.
    const hat = looks.hat ? 1 : 0;
    const title = dy ? (r.victory ? 'DAILY CLEARED!' : 'DAILY RUN OVER') : r.endless ? `SURVIVED ${fmtTime(r.time)}` : r.practice ? (r.victory ? 'PRACTICE CLEARED!' : 'PRACTICE OVER') : r.victory ? 'STAGE CLEARED!' : 'YOU WENT STALE';
    txt(this, W / 2, top + (44 - 5 * hat) * S, title, r.practice || dy ? 26 : 30, r.victory || r.endless ? CSS.gold : CSS.red);
    const st = stageById(r.stage);
    const tags = [r.quick ? 'Quick' : '', r.endless ? 'Endless' : '', r.crispy ? 'Extra Crispy' : ''].filter(Boolean).join(', ');
    fit(txt(this, W / 2, top + (72 - 8 * hat) * S, dy ? `${niceDate(dy.date)}: ${st.name}, ${dy.twist}` : `Stage ${st.num}: ${st.name}${tags ? ` (${tags})` : ''}`, 13, r.crispy ? '#ff9a5c' : CSS.muted, { stroke: false }), pw - 30 * S);
    // The bagel: pleased with itself after a win, flat and glum after going stale.
    const bagelDef = BAGELS.find((b) => b.id === r.bagel);
    const hero = this.add.image(W / 2, top + 119 * S, bigBagel(this, bagelDef?.tex ?? 'bagel_plain', false)).setScale(hat ? 0.4 : 0.44).setY(top + (119 + 7 * hat) * S);
    new Wear(this, hero, 62, looks.sprinkle, () => undefined);
    const face = new Face(this, hero, 62, () => undefined);
    new Wear(this, hero, 62, looks.hat, () => undefined);
    const won = r.victory || (!!r.endless && !!r.cleared);
    face.mood = won ? 'happy' : 'sad';
    if (!won) hero.setScale(hat ? 0.46 : 0.5, hat ? 0.31 : 0.33).setY(top + (126 + 5 * hat) * S);

    // Everything is laid out finished. Then, the first time the screen shows, it plays in: the numbers count up,
    // the Dough flies to the purse, a new best stamps down. `finals` jump each piece to its finished state (a tap).
    const finals: (() => void)[] = [];
    const idles: (() => void)[] = [];
    const play = !this.played;
    this.played = true;

    let stamp: Phaser.GameObjects.Text | null = null;
    if (r.newBest) {
      const nbText = r.endless ? 'NEW ENDLESS BEST!' : r.quick ? 'NEW QUICK BEST!' : 'NEW BEST!';
      const nb = (stamp = txt(this, W / 2 + Math.min(pw / 2 - 64 * S, 110 * S), top + 96 * S, nbText, r.quick || r.endless ? 14 : 17, CSS.gold).setAngle(-12));
      finals.push(() => nb.setScale(1).setAlpha(1));
      idles.push(() => this.tweens.add({ targets: nb, scale: 1.12, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    }

    const rows: [string, number, (n: number) => string][] = [
      [r.endless ? 'Time survived' : 'Time', r.time, (n) => fmtTime(n)],
      ['Level', r.level, (n) => `${Math.round(n)}`],
      ['Crumbs defeated', r.kills, (n) => `${Math.round(n)}`],
      ['Dough earned', r.practice ? 0 : r.dough, (n) => (r.practice ? (dy ? 'none (replay)' : 'none (practice)') : `+${Math.round(n)}`)],
    ];
    const values = rows.map(([k, v, show], i) => {
      const y = top + 160 * S + i * 34 * S;
      txt(this, W / 2 - pw / 2 + 28 * S, y, k, 17, CSS.muted, { bold: false }).setOrigin(0, 0.5);
      const t = txt(this, W / 2 + pw / 2 - 28 * S, y, show(v), 19, i === 3 ? CSS.gold : CSS.cream).setOrigin(1, 0.5);
      finals.push(() => t.setText(show(v)).setScale(1));
      return t;
    });

    // The purse: all your Dough, sitting on the panel's top edge. This run's pay flies into it.
    const paid = r.practice ? 0 : r.dough + r.goals.reduce((a, g) => a + g.reward, 0);
    const purse = r.practice ? null : pill(this, 0, top, 'coin', `${save.dough}`, { size: 14, h: 28, color: CSS.gold });
    if (purse) {
      purse.setX(W / 2 + pw / 2 - purse.width / 2 - 14 * S);
      const label = purse.getData('label') as Phaser.GameObjects.Text;
      finals.push(() => {
        label.setText(`${save.dough}`);
        purse.setScale(1);
      });
    }

    // What to chase next
    const notes: string[] = [];
    // The first clear of a stage moves the story on.
    if (r.firstClear) notes.push(st.outro);
    // The end of the story points at what is left.
    if (r.firstClear && st.boss.kind === 'king') notes.push('Still to do: Endless, Extra Crispy and the Goals page.');
    // Finished challenges: first, as one line, or a total when several land at once.
    if (r.goals.length === 1) notes.push(`GOAL DONE: ${r.goals[0].name}, +${r.goals[0].reward} Dough`);
    else if (r.goals.length > 1) notes.push(`${r.goals.length} GOALS DONE! +${r.goals.reduce((a, g) => a + g.reward, 0)} Dough. See the Goals page.`);
    if (r.endless && r.cleared) notes.push('The boss fell, so this run counts as a stage clear.');
    if (dy?.scored) notes.unshift(`Day ${dy.streak} of your Daily streak: +${dy.bonus} bonus Dough. Come back tomorrow!`);
    else if (dy) notes.unshift("Today's score is already in, so this one was just for fun.");
    if (r.practice && !dy) notes.push('Practice runs start at 2:30 with 12 level-ups and pay no Dough.');
    if (r.newStage) notes.push(`NEW STAGE: ${r.newStage}!`);
    for (const name of r.combos ?? []) notes.push(`SECRET RECIPE FOUND: ${name}!`);
    if (r.newUnlock) notes.push(`NEW BAGEL UNLOCKED: ${r.newUnlock}!`);
    if (r.newWeapon) notes.push(`NEW WEAPON: ${r.newWeapon}!`);
    if (r.evolutions.length) notes.push(`Evolved: ${r.evolutions.join(', ')}`);
    if (save.cookbook.length < 6) notes.push(`Cookbook ${save.cookbook.length}/${Object.keys(WEAPONS).length}: max a weapon, own its topping, open a chest`);
    const by = Math.min(H - ins.bottom * S - 110 * S, cy + ph / 2 + 60 * S);
    const bw = Math.min(W - 60 * S, 260 * S);
    const again = () => this.go('game', dy ? { daily: true } : { bagel: r.bagel, stage: r.stage, practice: r.practice, quick: r.quick, endless: r.endless, crispy: r.crispy });
    // A Daily Run's score card can be shared from here (and from the Daily card on the menu).
    const share = () => {
      const res = dy && dailyResult(save, dy.date);
      if (dy && res) shareScore(this, { date: dy.date, result: res, streak: dy.streak, ...looks });
    };
    const quiet = { color: COLORS.panelLight, textColor: CSS.cream, size: 20 };
    const noteY = top + (compact ? 335 : 375) * S;
    // A tap anywhere that isn't a button skips the count-up.
    const skip = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    const fade: (Phaser.GameObjects.Text | Phaser.GameObjects.Container | Phaser.GameObjects.Graphics | Phaser.GameObjects.Image)[] = [];
    let fillBar: ((k: number) => void) | null = null;
    if (this.toBakery) {
      // The first run: one note, and the big button goes straight to the Bakery.
      const t = txt(this, W / 2, noteY - 8 * S, TIPS.bakery, 16, CSS.gold, { wrap: (pw - 40 * S) / S });
      const arrow = txt(this, W / 2, t.y + t.height / 2 + 16 * S, '▼', 18, CSS.gold);
      fade.push(t, arrow);
      const ay = arrow.y;
      idles.push(() => this.tweens.add({ targets: arrow, y: ay + 7 * S, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
      const b = button(this, W / 2, by, bw, 62 * S, 'BAKERY', () => this.go('menu', { open: 'bakery' }), { size: 28, icon: 'ic_bk_oven' });
      idles.push(() => this.tweens.add({ targets: b, scale: 1.04, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
      button(this, W / 2, by + 74 * S, bw, 50 * S, 'Again', again, quiet);
    } else {
      // The unlock you are closest to, with a bar. It takes the bottom of the panel; the notes sit above it.
      const bg = r.practice ? undefined : nearestGoals(save, 1)[0];
      let goal = bg && { tex: bg.bagel.tex, scale: 0.82, label: `Next unlock: ${bg.bagel.name} bagel`, status: bg.status };
      // Whisk Whirl's coin count takes the spot while it is the closer of the two.
      const ws = weaponGoalStatus(save, WEAPONS.whisk);
      if (!r.practice && !weaponOpen(save, 'whisk') && !ws.done && (!goal || ws.frac >= goal.status.frac)) {
        goal = { tex: WEAPONS.whisk.icon, scale: 1.15, label: `Next unlock: ${WEAPONS.whisk.name}`, status: { ...ws, progress: `${ws.progress} coins` } };
      }
      const areaTop = top + 284 * S;
      const areaBottom = top + ph - 14 * S;
      const goalH = 50 * S;
      const noteRoom = areaBottom - areaTop - (goal ? goalH + 6 * S : 0);
      const nt = txt(this, W / 2, areaTop + noteRoom / 2, notes.slice(0, goal ? (compact ? 1 : 2) : compact ? 2 : 3).join('\n\n'), 13, '#e8d8c0', { wrap: (pw - 40 * S) / S, bold: false });
      if (nt.height > noteRoom) nt.setScale(noteRoom / nt.height);
      fade.push(nt);
      if (goal) {
        const gy = areaBottom - goalH / 2;
        const gl = W / 2 - pw / 2 + 20 * S;
        const gw = pw - 40 * S;
        const gr = this.add.graphics();
        gr.fillStyle(0x1d140d, 0.55).fillRoundedRect(gl, gy - goalH / 2, gw, goalH, 10 * S);
        const ic = this.add.image(gl + 24 * S, gy, goal.tex).setScale(goal.scale).setTint(0x8a8a8a);
        const tx = gl + 48 * S;
        const room = gl + gw - 12 * S - tx;
        const name = fit(txt(this, tx, gy - 11 * S, goal.label, 13, CSS.cream, { stroke: false }).setOrigin(0, 0.5), room);
        const prog = txt(this, gl + gw - 12 * S, gy + 10 * S, goal.status.progress, 11, CSS.gold, { stroke: false }).setOrigin(1, 0.5);
        const barW = Math.max(40 * S, room - prog.width - 8 * S);
        const bar = this.add.graphics();
        const frac = goal.status.frac;
        fillBar = (k: number) => {
          bar.clear();
          bar.fillStyle(0x24160d, 1).fillRoundedRect(tx, gy + 5 * S, barW, 10 * S, 5 * S);
          const fw = barW * frac * k;
          if (fw > 6 * S) bar.fillStyle(COLORS.gold, 1).fillRoundedRect(tx + 1.5 * S, gy + 6.5 * S, fw - 3 * S, 7 * S, 3.5 * S);
        };
        fillBar(1);
        const fb = fillBar;
        finals.push(() => fb(1));
        fade.push(gr, ic, name, prog, bar);
      }
      if (dy) {
        // Share is the big button; a replay (for fun) and the menu sit under it.
        button(this, W / 2, by, bw, 62 * S, 'SHARE', share, { size: 28 });
        const hw = (bw - 10 * S) / 2;
        button(this, W / 2 - hw / 2 - 5 * S, by + 74 * S, hw, 50 * S, 'Again', again, { ...quiet, size: 18 });
        button(this, W / 2 + hw / 2 + 5 * S, by + 74 * S, hw, 50 * S, 'Menu', () => this.go('menu', {}), { ...quiet, size: 18 });
      } else {
        button(this, W / 2, by, bw, 62 * S, 'AGAIN', again, { size: 28 });
        button(this, W / 2, by + 74 * S, bw, 50 * S, 'Menu', () => this.go('menu', {}), quiet);
      }
    }
    for (const o of fade) finals.push(() => o.setAlpha(1));
    // A hint takes turns along the bottom, when there's room under the buttons.
    const under = by + 104 * S;
    const room = H - ins.bottom * S - under;
    if (this.hint && room > 34 * S) {
      const ht = txt(this, W / 2, under + room / 2, `TIP: ${this.hint}`, 12, '#cdbfa6', { bold: false, wrap: Math.min(W / S - 36, 340) });
      if (ht.height > room - 6 * S) ht.setScale((room - 6 * S) / ht.height);
    }

    const finish = () => {
      if (!this.playing) return;
      this.playing = false;
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.children.list.filter((o) => o.getData('fly')).forEach((o) => o.destroy());
      finals.forEach((f) => f());
      idles.forEach((f) => f());
    };
    skip.on('pointerup', finish);
    if (!play) {
      idles.forEach((f) => f());
      return;
    }

    // ---- The play-in ----
    this.playing = true;
    const T0 = 420;
    const STEP = 220;
    values.forEach((t, i) => {
      const [, v, show] = rows[i];
      t.setText(show(0));
      this.tweens.addCounter({ from: 0, to: 1, delay: T0 + i * STEP, duration: 380, ease: 'Cubic.Out', onUpdate: (tw) => {
        t.setText(show(v * (tw.getValue() ?? 0)));
        if (v > 0) sfx('tick');
      }, onComplete: () => {
        t.setText(show(v));
        t.setScale(1.25);
        this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out' });
      } });
    });
    const tRows = T0 + 3 * STEP + 380;
    if (purse && paid > 0) {
      // Coins fly from the "Dough earned" row up to the purse, which counts up as they land.
      const label = purse.getData('label') as Phaser.GameObjects.Text;
      const before = save.dough - paid;
      label.setText(`${before}`);
      const from = values[3];
      const n = Math.min(8, Math.max(3, Math.round(paid / 12)));
      for (let i = 0; i < n; i++) {
        const coin = this.add.image(from.x - from.width / 2, from.y, 'coin').setScale(1.3).setAlpha(0).setData('fly', true);
        const midX = coin.x + (Math.random() - 0.5) * 80 * S;
        this.tweens.add({ targets: coin, alpha: 1, x: midX, y: coin.y - 40 * S, delay: tRows + i * 55, duration: 160, ease: 'Quad.Out', onComplete: () => {
          this.tweens.add({ targets: coin, x: purse.x - purse.width / 2 + 16 * S, y: purse.y, scale: 0.8, duration: 300, ease: 'Cubic.In', onComplete: () => {
            coin.destroy();
            sfx('coin');
            purse.setScale(1.14);
            this.tweens.add({ targets: purse, scale: 1, duration: 120 });
          } });
        } });
      }
      this.tweens.addCounter({ from: before, to: save.dough, delay: tRows + 420, duration: 300 + n * 55, onUpdate: (tw) => label.setText(`${Math.round(tw.getValue() ?? save.dough)}`) });
    }
    if (stamp) {
      const nb = stamp;
      nb.setScale(3.2).setAlpha(0);
      this.tweens.add({ targets: nb, scale: 1, alpha: 1, delay: tRows + 60, duration: 170, ease: 'Quad.In', onComplete: () => {
        sfx('stamp');
        shake(this, 140, 0.005);
      } });
    }
    fade.forEach((o) => {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, delay: tRows + 100, duration: 260 });
    });
    if (fillBar) {
      const fb = fillBar;
      fb(0);
      this.tweens.addCounter({ from: 0, to: 1, delay: tRows + 240, duration: 520, ease: 'Cubic.Out', onUpdate: (tw) => fb(tw.getValue() ?? 1) });
    }
    this.time.delayedCall(tRows + 900, finish);
  }

  private go(scene: string, data: object): void {
    wipeTo(this, scene, data);
  }
}
