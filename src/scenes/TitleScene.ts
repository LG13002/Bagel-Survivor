import Phaser from 'phaser';
import { Face } from '../face';
import { CHALLENGES } from '../goals';
import { Wear, makeLookTextures, worn } from '../looks';
import { CSS, S, VERSION, safeInsets } from '../config';
import { BAGELS } from '../data';
import { playMusic } from '../music';
import { load } from '../save';
import { unlockAudio } from '../sfx';
import { ctex } from '../art';
import { giantBagel, makeTextures, staleCrumb } from '../textures';
import { txt } from '../ui';
import { wipeOpen, wipeTo } from '../wipe';

/** The first screen of every launch: the logo over your current bagel, huge, with the Stale closing in. Tap to go on. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    makeTextures(this);
    makeLookTextures(this);
    playMusic('menu');
    this.build();
    const onResize = () => {
      this.tweens.killAll();
      this.children.removeAll(true);
      this.build();
    };
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
      // The giant bagel is only used here: free its picture.
      for (const k of this.textures.getTextureKeys()) if (k.endsWith('_giant') || k === 'title_rays' || k === 'title_bg' || (k.startsWith('look_') && Number(k.split('_')[2]) > 700)) this.textures.remove(k);
    });
    if (!wipeOpen()) this.cameras.main.fadeIn(300, 43, 33, 24);
  }

  private build(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const ins = safeInsets();
    const top = ins.top * S;
    const bottom = H - ins.bottom * S;
    const save = load();
    const bagel = BAGELS.find((b) => b.id === save.selected) ?? BAGELS[0];

    // Warm glow behind the bagel, fading to the bakery's dark brown at the edges.
    const cy = top + (bottom - top) * 0.6;
    // One small picture stretched over the screen: far cheaper for a phone than layers of big circles.
    // Once the Stale King has fallen, dawn becomes a bright morning: a clear sky around the glow.
    const morning = !!save.ending;
    ctex(this, 'title_bg', 128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, morning ? '#fff3c4' : '#f2b84b');
      g.addColorStop(0.45, morning ? '#f7c463' : '#b9652a');
      g.addColorStop(morning ? 0.8 : 1, morning ? '#6cb6e6' : '#2b2118');
      if (morning) g.addColorStop(1, '#3f8fd0');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    const far = Math.hypot(W, H) * 0.75;
    this.add.image(W / 2, cy, 'title_bg').setScale((2 * (40 * S + far)) / (128 * S));
    // Slow sun rays.
    const R0 = 512;
    ctex(this, 'title_rays', R0, R0, (c) => {
      c.translate(R0 / 2, R0 / 2);
      const g = c.createRadialGradient(0, 0, 20, 0, 0, R0 / 2);
      g.addColorStop(0, morning ? 'rgba(255,255,240,0.3)' : 'rgba(255,243,220,0.16)');
      g.addColorStop(1, 'rgba(255,243,220,0)');
      c.fillStyle = g;
      for (let i = 0; i < 12; i++) {
        c.rotate((Math.PI * 2) / 12);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(-R0 * 0.07, -R0 / 2);
        c.lineTo(R0 * 0.07, -R0 / 2);
        c.fill();
      }
    });
    const rays = this.add.image(W / 2, cy, 'title_rays').setScale((far * 2.2) / (R0 * S));
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });

    // The bagel: as big as the screen allows.
    const logoH = 150 * S;
    const looks = worn(save);
    // A hat needs the room above the bagel, so a bagel wearing one is smaller and stands on the same spot.
    const R1 = Math.min(W * 0.42, (bottom - top - logoH - 120 * S) * 0.5);
    const R = looks.hat ? R1 * 0.68 : R1;
    const size = Math.round((R * 2.3) / S);
    const by = Math.min(cy, bottom - 110 * S - R1) + (R1 - R);
    const shadow = this.add.ellipse(W / 2, by + R * 1.0, R * 1.7, R * 0.3, 0x120c08, 0.4);
    const hero = this.add.image(W / 2, by, giantBagel(this, bagel.tex, size, false));
    const br = (size * 15.5) / 40;
    new Wear(this, hero, br, looks.sprinkle, () => undefined);
    const face = new Face(this, hero, br, () => undefined);
    face.idle = true;
    new Wear(this, hero, br, looks.hat, () => undefined);
    const hs = (R * 2) / (hero.width * (31 / 40)); // the bagel fills 31/40 of its picture
    hero.setScale(hs);
    this.tweens.add({ targets: hero, y: by - 8 * S, scaleX: hs * 1.02, scaleY: hs * 0.98, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: shadow, scaleX: 0.9, alpha: 0.28, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Logo: drops in with a bounce.
    const k = Math.min(1, W / (390 * S));
    const ly = top + Math.max(70 * S, (by - (2 * R1 - R) - top) * 0.42);
    const l1 = txt(this, W / 2, ly, 'EVERYTHING', 46 * k, CSS.gold);
    const l2 = txt(this, W / 2, ly + 56 * k * S, 'BAGEL', 76 * k, CSS.cream);
    [l1, l2].forEach((t, i) => {
      const y0 = t.y;
      t.y = y0 - 220 * S;
      this.tweens.add({ targets: t, y: y0, duration: 650, delay: 80 + i * 110, ease: 'Bounce.Out' });
    });

    // The Stale closing in along the bottom. After the ending, friends from the shelf are there instead.
    const crumb = morning ? '' : staleCrumb(this);
    const friends = BAGELS.filter((b) => b.id !== bagel.id && save.unlocked.includes(b.id) && !b.secret);
    const spots: [number, number, number][] = [[0.09, 26, 2.0], [0.24, 12, 1.4], [0.5, 16, 1.2], [0.76, 12, 1.4], [0.9, 30, 2.2]];
    for (const [i, [fx, up, sc]] of spots.entries()) {
      const cx = W * fx;
      const y = bottom - up * S;
      if (morning && !friends.length) break;
      this.add.ellipse(cx, y + 10 * sc * S, 20 * sc * S, 5 * sc * S, 0x120c08, 0.35);
      const im = morning ? this.add.image(cx, y - 4 * sc * S, friends[i % friends.length].tex).setScale(sc * 0.62) : this.add.image(cx, y, crumb).setScale(sc);
      this.tweens.add({ targets: im, y: y - 5 * S, angle: fx < 0.5 ? 6 : -6, duration: 380 + fx * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    const tap = txt(this, W / 2, Math.min(bottom - 62 * S, by + R + 58 * S), 'Tap to play', 26, CSS.cream);
    this.tweens.add({ targets: tap, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const ver = txt(this, W - 14 * S, top + 18 * S, `v${VERSION.replace(/\.0$/, '')}`, 12, morning ? 'rgba(36,22,13,0.7)' : 'rgba(255,243,220,0.6)', { stroke: false }).setOrigin(1, 0.5);
    // A small crown beside the version: the game has been finished.
    if (morning) this.add.image(ver.x - ver.width - 12 * S, ver.y, 'ic_crown').setScale(0.42);
    // And a little golden bagel: every challenge is done.
    if (CHALLENGES.every((ch) => (save.goalsPaid ?? []).includes(ch.id))) this.add.image(ver.x - ver.width - (morning ? 30 : 12) * S, ver.y, 'ic_goldbagel').setScale(0.46);

    const zone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    zone.once('pointerup', () => {
      unlockAudio();
      // The very first launch tells the story first.
      wipeTo(this, load().intro ? 'menu' : 'intro');
    });
  }
}
