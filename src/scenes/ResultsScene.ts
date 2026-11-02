import Phaser from 'phaser';
import { COLORS, CSS, S, fmtTime, safeInsets } from '../config';
import { load } from '../save';
import { button, panel, txt } from '../ui';
import type { RunResult } from './GameScene';

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
    const ph = 430 * S;
    const cy = Math.min(H / 2 - 40 * S, ins.top * S + 40 * S + ph / 2);
    panel(this, W / 2, cy, pw, ph);
    const top = cy - ph / 2;
    txt(this, W / 2, top + 44 * S, r.victory ? 'STAGE CLEARED!' : 'YOU WENT STALE', 30, r.victory ? CSS.gold : CSS.red);
    this.add.image(W / 2, top + 104 * S, r.bagel === 'everything' ? 'bagel_everything' : 'bagel_plain').setScale(2).setAngle(r.victory ? 0 : 160);

    const rows: [string, string][] = [
      ['Time', fmtTime(r.time)],
      ['Level', `${r.level}`],
      ['Crumbs defeated', `${r.kills}`],
      ['Dough earned', `+${r.dough}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = top + 160 * S + i * 34 * S;
      txt(this, W / 2 - pw / 2 + 28 * S, y, k, 17, CSS.muted, { bold: false }).setOrigin(0, 0.5);
      txt(this, W / 2 + pw / 2 - 28 * S, y, v, 19, i === 3 ? CSS.gold : CSS.cream).setOrigin(1, 0.5);
    });

    // What to chase next
    const notes: string[] = [];
    if (r.newUnlock) notes.push(`NEW BAGEL UNLOCKED: ${r.newUnlock}!`);
    if (r.evolutions.length) notes.push(`Evolved: ${r.evolutions.join(', ')}`);
    if (!save.unlocked.includes('everything')) notes.push('Next goal: beat the Toaster Tyrant at 4:30 to unlock Everything Ed');
    if (save.cookbook.length < 6) notes.push(`Cookbook ${save.cookbook.length}/6: max a weapon, own its topping, open a chest`);
    txt(this, W / 2, top + 345 * S, notes.slice(0, 2).join('\n\n'), 13, '#e8d8c0', { wrap: (pw - 40 * S) / S, bold: false });

    const by = Math.min(H - ins.bottom * S - 110 * S, cy + ph / 2 + 60 * S);
    button(this, W / 2, by, Math.min(W - 60 * S, 260 * S), 62 * S, 'AGAIN', () => this.go('game', { bagel: r.bagel }), { size: 28 });
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
