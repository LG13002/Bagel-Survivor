// The Settings screen. The menu opens it with every tab; the pause screen opens just the Game tab.
import Phaser from 'phaser';
import { COLORS, CSS, S, VERSION } from './config';
import { askBackupCode, showBackupCode } from './backupDialog';
import { clearRun } from './runsave';
import { load, resetSave, type Settings } from './save';
import { setSetting, settings } from './settings';
import { setMusicVolume, setSoundVolume, sfx } from './sfx';
import { HEADER, button, popupFrame, txt } from './ui';
import { WHATS_NEW } from './whatsnew';
import { replayTutorial } from './tips';

const INK = 0x24160d;

/** A row of choices where one is picked (gold). Tapping another picks it. */
export function segmented(scene: Phaser.Scene, x: number, y: number, w: number, h: number, labels: string[], sel: number, onPick: (i: number) => void, size = 14): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  c.add(g);
  const seg = w / labels.length;
  const texts = labels.map((l, i) => txt(scene, -w / 2 + seg * (i + 0.5), 0, l, size, CSS.muted, { stroke: false }));
  c.add(texts);
  const draw = () => {
    g.clear();
    g.fillStyle(INK, 1).fillRoundedRect(-w / 2 - 2.5 * S, -h / 2 - 2.5 * S, w + 5 * S, h + 5 * S, h / 2 + 2.5 * S);
    g.fillStyle(0x1d140d, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const x0 = -w / 2 + sel * seg;
    g.fillStyle(COLORS.gold, 1).fillRoundedRect(x0 + 3 * S, -h / 2 + 3 * S, seg - 6 * S, h - 6 * S, h / 2 - 3 * S);
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(x0 + 10 * S, -h / 2 + 6 * S, seg - 20 * S, Math.min(8 * S, h * 0.2), 4 * S);
    texts.forEach((t, i) => t.setColor(i === sel ? CSS.dark : CSS.muted));
  };
  draw();
  labels.forEach((_, i) => {
    const z = scene.add.zone(-w / 2 + seg * (i + 0.5), 0, seg, h + 8 * S).setInteractive();
    z.on('pointerup', () => {
      if (i === sel) return;
      sel = i;
      sfx('click');
      draw();
      onPick(i);
    });
    c.add(z);
  });
  return c;
}

/** A 0 to 100 slider. onChange runs while dragging; onRelease once the thumb lets go. */
function slider(scene: Phaser.Scene, x: number, y: number, w: number, value: number, onChange: (v: number) => void, onRelease: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const label = txt(scene, w / 2 + 22 * S, 0, '', 13, CSS.cream, { stroke: false });
  c.add([g, label]);
  const h = 12 * S;
  const draw = () => {
    g.clear();
    g.fillStyle(INK, 1).fillRoundedRect(-w / 2 - 2 * S, -h / 2 - 2 * S, w + 4 * S, h + 4 * S, h / 2 + 2 * S);
    g.fillStyle(0x1d140d, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const fw = (w * value) / 100;
    if (fw > 2 * S) g.fillStyle(COLORS.gold, 1).fillRoundedRect(-w / 2, -h / 2, Math.max(h, fw), h, h / 2);
    const kx = -w / 2 + fw;
    g.fillStyle(INK, 1).fillCircle(kx, 0, 13 * S);
    g.fillStyle(COLORS.cream, 1).fillCircle(kx, 0, 10.5 * S);
    g.fillStyle(0xffffff, 0.6).fillEllipse(kx - 2 * S, -4 * S, 9 * S, 4 * S);
    label.setText(value === 0 ? 'Off' : `${value}`);
  };
  draw();
  const zone = scene.add.zone(0, 0, w + 30 * S, 40 * S).setInteractive();
  c.add(zone);
  let drag = false;
  const set = (p: Phaser.Input.Pointer) => {
    // Pointer x is in screen pixels, the same space this panel is laid out in.
    const v = Math.round((Phaser.Math.Clamp((p.x - (x - w / 2)) / w, 0, 1) * 100) / 5) * 5;
    if (v === value) return;
    value = v;
    draw();
    onChange(v);
  };
  zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
    drag = true;
    set(p);
  });
  const move = (p: Phaser.Input.Pointer) => drag && set(p);
  const up = () => {
    if (!drag) return;
    drag = false;
    onRelease();
  };
  scene.input.on('pointermove', move);
  scene.input.on('pointerup', up);
  c.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', up);
  });
  return c;
}

/** The Help tab: a picture and a line for each thing a player needs to know. */
const HOW_TO: [string, string][] = [
  ['bagel_plain', 'Drag anywhere to move. Your bagel fires on its own.'],
  ['gem1', 'Grab seeds to level up, then pick a card: orange is a weapon, blue is a topping.'],
  ['ic_star', 'You can hold 4 weapons and 4 toppings. Each goes up to level 5.'],
  ['goldchest', 'Evolve: max a weapon, own its matching topping, then open a chest. Elites drop chests.'],
  ['bun', 'The Sticky Bun pulls in every seed on the floor.'],
  ['ic_crown', 'Beat the boss at 4:30 to clear the stage and open the next one.'],
  ['coin', 'Spend Dough in the Bakery on upgrades that last forever.'],
];

export interface SettingsOpts {
  /** Opened from the pause screen: only the options that matter mid-run. */
  inRun?: boolean;
  /** The back button was tapped. */
  onClose: () => void;
  /** The save was replaced or reset: the caller should rebuild everything from it. */
  onSaveReplaced?: () => void;
  /** "Watch the intro" was tapped (About tab). */
  onIntro?: () => void;
  /** "Ending" or "Credits" was tapped (About tab, once the ending has been seen). */
  onEnding?: () => void;
  onCredits?: () => void;
  tab?: number;
  /** "Replay tutorial" was just tapped (the button says so). Set by the panel itself. */
  replayed?: boolean;
}

/**
 * Builds the Settings panel into `c` (a full-screen container that already has its backdrop).
 * Calling it again with another tab clears and rebuilds everything it added.
 */
export function buildSettings(scene: Phaser.Scene, c: Phaser.GameObjects.Container, opts: SettingsOpts): void {
  const mine: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    mine.push(o);
    c.add(o);
    return o;
  };
  const W = scene.scale.width;
  const H = scene.scale.height;
  const tab = opts.inRun ? 0 : (opts.tab ?? 0);
  const pw = Math.min(W - 24 * S, 380 * S);
  const ph = Math.min(H - 20 * S, (opts.inRun ? 484 : 560) * S);
  const top = H / 2 - ph / 2;
  for (const o of popupFrame(scene, W / 2, H / 2, pw, ph, 'SETTINGS', opts.onClose)) add(o);
  const reopen = (t: number, replayed = false) => {
    for (const o of mine) o.destroy();
    buildSettings(scene, c, { ...opts, tab: t, replayed });
  };
  let y = top + (HEADER + 30) * S;
  if (!opts.inRun) {
    add(segmented(scene, W / 2, y, pw - 40 * S, 36 * S, ['Game', 'Save', 'Help', 'About'], tab, reopen, 15));
    y += 34 * S;
  } else y -= 16 * S;
  const s = settings();
  const left = W / 2 - pw / 2 + 22 * S;
  const cw = pw - 44 * S;
  if (tab === 0) {
    // Fit the rows to the panel on short screens.
    const rows = 7;
    const room = top + ph - 14 * S - y;
    const rh = Math.min(62 * S, room / rows);
    const row = (label: string, build: (cy: number) => Phaser.GameObjects.GameObject) => {
      add(txt(scene, left, y + rh * 0.2, label, 13, CSS.muted, { stroke: false }).setOrigin(0, 0.5));
      add(build(y + rh * 0.66));
      y += rh;
    };
    const sw = cw - 50 * S;
    row('MUSIC VOLUME', (cy) => slider(scene, left + sw / 2 + 4 * S, cy, sw, s.music, setMusicVolume, () => {}));
    row('SOUND VOLUME', (cy) => slider(scene, left + sw / 2 + 4 * S, cy, sw, s.sound, setSoundVolume, () => sfx('ding')));
    const pick = <K extends keyof Settings>(key: K, values: Settings[K][], labels: string[]) => (cy: number) =>
      segmented(scene, W / 2, cy, cw, Math.min(34 * S, rh * 0.5), labels, Math.max(0, values.indexOf(s[key])), (i) => setSetting(key, values[i]));
    row('SCREEN SHAKE', pick('shake', ['on', 'reduced', 'off'], ['On', 'Reduced', 'Off']));
    row('FLASHING EFFECTS', pick('flash', ['normal', 'reduced'], ['Normal', 'Reduced']));
    row('BATTERY SAVER (FEWER SPARKS)', pick('saver', [false, true], ['Off', 'On']));
    row('LEFT-HANDED BUTTONS', pick('lefty', [false, true], ['Off', 'On']));
    if (opts.inRun) row('TIPS', pick('tips', [true, false], ['On', 'Off']));
    else {
      // Tips: on or off, and a button that brings the whole tutorial back.
      const sh = Math.min(34 * S, rh * 0.5);
      const half = (cw - 10 * S) / 2;
      row('TIPS', (cy) => {
        const box = scene.add.container(0, 0);
        box.add(segmented(scene, left + half / 2, cy, half, sh, ['On', 'Off'], s.tips === false ? 1 : 0, (i) => setSetting('tips', i === 0)));
        const again = button(scene, left + cw - half / 2, cy - 2 * S, half, sh + 2 * S, opts.replayed ? 'Tips will replay' : 'Replay tutorial', () => {
          replayTutorial();
          reopen(0, true);
        }, { size: 13, color: COLORS.panelLight, textColor: opts.replayed ? CSS.gold : CSS.cream, radius: 12 });
        box.add(again);
        return box;
      });
    }
  } else if (tab === 1) {
    const why = add(txt(scene, W / 2, y, 'Your progress lives on this phone only. A backup code lets you move it to a new phone, or get it back if the browser data is ever cleared.', 13, '#e8d8c0', { bold: false, stroke: false, wrap: cw / S }).setOrigin(0.5, 0));
    y += why.height + 40 * S;
    const bw = Math.min(cw, 280 * S);
    add(button(scene, W / 2, y, bw, 50 * S, 'Copy backup code', () => {
      scene.input.enabled = false;
      showBackupCode(() => (scene.input.enabled = true));
    }, { size: 18 }));
    y += 66 * S;
    add(button(scene, W / 2, y, bw, 50 * S, 'Paste backup code', () => {
      scene.input.enabled = false;
      askBackupCode(
        () => (scene.input.enabled = true),
        () => {
          scene.input.enabled = true;
          clearRun();
          opts.onSaveReplaced?.();
        },
      );
    }, { size: 18, color: COLORS.panelLight, textColor: CSS.cream }));
    y += 76 * S;
    let confirm = false;
    const reset = add(button(scene, W / 2, y, bw, 44 * S, 'Reset save', () => {
      // Ask once, so a stray tap can't wipe months of progress.
      if (!confirm) {
        confirm = true;
        (reset.getData('label') as Phaser.GameObjects.Text).setText('Tap again to erase everything');
        return;
      }
      resetSave();
      clearRun();
      opts.onSaveReplaced?.();
    }, { size: 15, color: COLORS.red, textColor: CSS.cream }));
    add(txt(scene, W / 2, y + 44 * S, 'Starts over from nothing. The old save is kept as a spare.', 12, CSS.muted, { bold: false, stroke: false, wrap: cw / S }));
  } else if (tab === 2) {
    // How to play: the whole game in a few lines.
    y += 6 * S;
    const room = top + ph - 16 * S - y;
    const gap = Math.min(12 * S, (room - HOW_TO.length * 40 * S) / HOW_TO.length);
    for (const [icon, line] of HOW_TO) {
      const t = add(txt(scene, left + 44 * S, y, line, 13, '#e8d8c0', { bold: false, stroke: false, wrap: (cw - 46 * S) / S, align: 'left' }).setOrigin(0, 0));
      const hgt = Math.max(t.height, 32 * S);
      t.setY(y + (hgt - t.height) / 2);
      const im = add(scene.add.image(left + 18 * S, y + hgt / 2, icon));
      im.setScale((30 * S) / Math.max(im.width, im.height));
      y += hgt + gap;
    }
  } else {
    add(txt(scene, W / 2, y + 14 * S, 'EVERYTHING BAGEL', 20, CSS.cream));
    add(txt(scene, W / 2, y + 40 * S, `Version ${VERSION.replace(/\.0$/, '')}`, 14, CSS.gold, { stroke: false }));
    y += 76 * S;
    add(txt(scene, W / 2, y, "WHAT'S NEW", 13, CSS.muted, { stroke: false }));
    add(txt(scene, W / 2, y + 22 * S, WHATS_NEW.title, 17, CSS.gold));
    const lines = add(txt(scene, W / 2, y + 42 * S, WHATS_NEW.lines.map((l) => `• ${l}`).join('\n'), 13, '#e8d8c0', { bold: false, wrap: cw / S, align: 'left' }).setOrigin(0.5, 0));
    y += 42 * S + lines.height + 26 * S;
    add(txt(scene, W / 2, y, 'No data leaves your phone.', 15, CSS.cream));
    add(txt(scene, W / 2, y + 26 * S, 'No accounts, no ads, no tracking. Your save stays in this browser.', 12, CSS.muted, { bold: false, stroke: false, wrap: cw / S }));
    const by = Math.min(y + 84 * S, top + ph - 40 * S);
    const quiet = { size: 15, color: COLORS.panelLight, textColor: CSS.cream };
    if (opts.onIntro && opts.onEnding && opts.onCredits && load().ending) {
      // Once the story is finished, all three of its pieces can be watched again.
      const bw = (cw - 16 * S) / 3;
      add(button(scene, left + bw / 2, by, bw, 44 * S, 'Intro', opts.onIntro, quiet));
      add(button(scene, left + cw / 2, by, bw, 44 * S, 'Ending', opts.onEnding, quiet));
      add(button(scene, left + cw - bw / 2, by, bw, 44 * S, 'Credits', opts.onCredits, quiet));
    } else if (opts.onIntro) add(button(scene, W / 2, by, Math.min(cw, 220 * S), 44 * S, 'Watch the intro', opts.onIntro, { ...quiet, size: 16 }));
  }
}
