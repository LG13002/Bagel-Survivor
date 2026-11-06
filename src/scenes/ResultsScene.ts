import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { load } from '../save';
import { button, panel, txt } from '../ui';
import type { RunResult } from './GameScene';
import { BAGELS, WEAPONS, stageById } from '../data';
import { nearestGoals } from '../progress';

export class ResultsScene extends Phaser.Scene {
  private result!: RunResult;
  constructor() {
    super('results');
  }

  init(data: RunResult): void {
    this.result = data;
  }

  create(): void {
    this.build();
    const onResize = () => {
      this.children.removeAll(true);
      this.build();
    };
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    this.cameras.main.fadeIn(300, 18, 12, 8);
  }

  private build(): void {
    const r = this.result;
    const W = this.scale.width;
    const H = this.scale.height;
    const ins = safeInsets();
    const save = load();
    this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0).setAlpha(0.3);

    const pw = Math.min(W - 28 * S, 380 * S);
    const compact = (H - (ins.top + ins.bottom) * S) / S < 720; // short screens: smaller panel, fewer notes
    const ph = (compact ? 410 : 480) * S;
    const cy = compact ? ins.top * S + 14 * S + ph / 2 : Math.min(H / 2 - 40 * S, ins.top * S + 40 * S + ph / 2);
    panel(this, W / 2, cy, pw, ph);
    const top = cy - ph / 2;
    // Endless always ends in going stale, so its title is the score: time survived.
    const title = r.endless ? `SURVIVED ${fmtTime(r.time)}` : r.practice ? (r.victory ? 'PRACTICE CLEARED!' : 'PRACTICE OVER') : r.victory ? 'STAGE CLEARED!' : 'YOU WENT STALE';
    txt(this, W / 2, top + 44 * S, title, r.practice ? 24 : 30, r.victory || r.endless ? CSS.gold : CSS.red);
    const st = stageById(r.stage);
    const tags = [r.quick ? 'Quick' : '', r.endless ? 'Endless' : '', r.crispy ? 'Extra Crispy' : ''].filter(Boolean).join(', ');
    txt(this, W / 2, top + 72 * S, `Stage ${st.num}: ${st.name}${tags ? ` (${tags})` : ''}`, 13, r.crispy ? '#ff9a5c' : CSS.muted, { stroke: false });
    this.add.image(W / 2, top + 112 * S, (BAGELS.find((b) => b.id === r.bagel)?.tex ?? 'bagel_plain') + '_big').setScale(0.5).setAngle(r.victory ? 0 : 160);

    if (r.newBest) {
      const nbText = r.endless ? 'NEW ENDLESS BEST!' : r.quick ? 'NEW QUICK BEST!' : 'NEW BEST!';
      const nb = txt(this, W / 2 + Math.min(pw / 2 - 64 * S, 110 * S), top + 96 * S, nbText, r.quick || r.endless ? 14 : 17, CSS.gold).setAngle(-12);
      this.tweens.add({ targets: nb, scale: 1.12, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    const rows: [string, string][] = [
      [r.endless ? 'Time survived' : 'Time', fmtTime(r.time)],
      ['Level', `${r.level}`],
      ['Crumbs defeated', `${r.kills}`],
      ['Dough earned', r.practice ? 'none (practice)' : `+${r.dough}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = top + 160 * S + i * 34 * S;
      txt(this, W / 2 - pw / 2 + 28 * S, y, k, 17, CSS.muted, { bold: false }).setOrigin(0, 0.5);
      txt(this, W / 2 + pw / 2 - 28 * S, y, v, 19, i === 3 ? CSS.gold : CSS.cream).setOrigin(1, 0.5);
    });

    // What to chase next
    const notes: string[] = [];
    // Finished challenges: first, as one line, or a total when several land at once.
    if (r.goals.length === 1) notes.push(`GOAL DONE: ${r.goals[0].name}, +${r.goals[0].reward} Dough`);
    else if (r.goals.length > 1) notes.push(`${r.goals.length} GOALS DONE! +${r.goals.reduce((a, g) => a + g.reward, 0)} Dough. See the Goals page.`);
    if (r.endless && r.cleared) notes.push('The boss fell, so this run counts as a stage clear.');
    if (r.practice) notes.push('Practice runs start at 2:30 with 12 level-ups and pay no Dough.');
    if (r.newStage) notes.push(`NEW STAGE: ${r.newStage}!`);
    if (r.combo) notes.push('SECRET RECIPE FOUND: Lox and Schmear!');
    if (r.newUnlock) notes.push(`NEW BAGEL UNLOCKED: ${r.newUnlock}!`);
    if (r.newWeapon) notes.push(`NEW WEAPON: ${r.newWeapon}!`);
    if (r.evolutions.length) notes.push(`Evolved: ${r.evolutions.join(', ')}`);
    for (const g of nearestGoals(save, 2)) notes.push(`Unlock ${g.bagel.name}: ${g.bagel.goal!.text} (${g.status.progress})`);
    if (save.cookbook.length < 6) notes.push(`Cookbook ${save.cookbook.length}/${Object.keys(WEAPONS).length}: max a weapon, own its topping, open a chest`);
    txt(this, W / 2, top + (compact ? 335 : 375) * S, notes.slice(0, compact ? 2 : 3).join('\n\n'), 13, '#e8d8c0', { wrap: (pw - 40 * S) / S, bold: false });

    const by = Math.min(H - ins.bottom * S - 110 * S, cy + ph / 2 + 60 * S);
    button(this, W / 2, by, Math.min(W - 60 * S, 260 * S), 62 * S, 'AGAIN', () => this.go('game', { bagel: r.bagel, stage: r.stage, practice: r.practice, quick: r.quick, endless: r.endless, crispy: r.crispy }), { size: 28 });
    button(this, W / 2, by + 74 * S, Math.min(W - 60 * S, 260 * S), 50 * S, 'Menu', () => this.go('menu', {}), {
      color: COLORS.panelLight,
      textColor: CSS.cream,
      size: 20,
    });
  }

  private go(scene: string, data: object): void {
    this.cameras.main.fadeOut(200, 18, 12, 8);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, data));
  }
}
