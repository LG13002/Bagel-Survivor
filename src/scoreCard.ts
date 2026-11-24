// The Daily Run's score card: a picture of the day's result to send to friends. It is drawn on its own canvas and
// handed to the phone's share sheet. It carries no name and nothing about the player but the run itself.
import Phaser from 'phaser';
import { FONT, fmtTime } from './config';
import { BAGELS, stageById } from './data';
import { TWISTS, dailyFor, niceDate, type DailyResult } from './daily';
import { eye } from './art';
import { LOOK_BOX, lookTex } from './looks';
import { bigBagel } from './textures';

const W = 720;
const H = 900;

export interface ScoreInfo {
  date: string;
  result: DailyResult;
  streak: number;
  /** The looks worn: the hat shows on the card. */
  hat?: string;
  sprinkle?: string;
}

function source(scene: Phaser.Scene, key: string): CanvasImageSource {
  return scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
}

/** Draws the card. Everything on it comes from the date and the result. */
export function drawScoreCard(scene: Phaser.Scene, info: ScoreInfo): HTMLCanvasElement {
  const daily = dailyFor(info.date);
  const bagel = BAGELS.find((b) => b.id === daily.bagel) ?? BAGELS[0];
  const stage = stageById(daily.stage);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  c.lineJoin = 'round';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  // Bakery wall: staggered tiles.
  c.fillStyle = '#3a2a1e';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#4a382a';
  for (let y = -10, row = 0; y < H; y += 80, row++) {
    for (let x = row % 2 ? -40 : 0; x < W; x += 80) {
      c.beginPath();
      c.roundRect(x + 4, y + 4, 72, 72, 9);
      c.fill();
    }
  }
  // Warm light behind the bagel.
  const glow = c.createRadialGradient(W / 2, 430, 20, W / 2, 430, 380);
  glow.addColorStop(0, 'rgba(255,220,140,0.6)');
  glow.addColorStop(0.6, 'rgba(255,205,120,0.16)');
  glow.addColorStop(1, 'rgba(255,205,120,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = '#24160d';
  c.lineWidth = 16;
  c.strokeRect(8, 8, W - 16, H - 16);
  c.strokeStyle = '#f2b84b';
  c.lineWidth = 5;
  c.strokeRect(20, 20, W - 40, H - 40);

  const text = (s: string, x: number, y: number, size: number, color: string, room = W - 80) => {
    c.font = `${size}px ${FONT}`;
    const w = c.measureText(s).width;
    if (w > room) c.font = `${Math.floor((size * room) / w)}px ${FONT}`;
    c.lineWidth = Math.max(4, size * 0.22);
    c.strokeStyle = '#1d140d';
    c.strokeText(s, x, y);
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  text('EVERYTHING BAGEL', W / 2, 84, 56, '#f2b84b');
  text(`DAILY RUN · ${niceDate(info.date).toUpperCase()}`, W / 2, 146, 34, '#fff3dc');

  // The stage's picture, on the shelf to one side.
  const thumb = source(scene, stage.thumb);
  c.save();
  c.translate(128, 262);
  c.rotate(-0.07);
  c.fillStyle = '#24160d';
  c.fillRect(-98, -64, 196, 128);
  c.drawImage(thumb, -92, -58, 184, 116);
  c.restore();

  // The bagel, with whatever it wears.
  const cx = W / 2;
  const cy = 452;
  const r = 116; // bagel radius on the card
  c.fillStyle = 'rgba(18,12,8,0.45)';
  c.beginPath();
  c.ellipse(cx, cy + r * 1.02, r * 0.9, r * 0.14, 0, 0, Math.PI * 2);
  c.fill();
  const box = (r / 62) * 160;
  c.drawImage(source(scene, bigBagel(scene, bagel.tex, false)), cx - box / 2, cy - box / 2, box, box);
  const lbox = (r / 62) * LOOK_BOX * 4;
  if (info.sprinkle) c.drawImage(source(scene, lookTex(scene, info.sprinkle, 62)), cx - lbox / 2, cy - lbox / 2, lbox, lbox);
  const er = r * 0.24;
  const won = info.result.c;
  for (const d of [-1, 1]) eye(c, cx + d * r * 0.31, cy - r * 0.6, er, Math.max(1.6, r * 0.15) * 0.75, won ? [0, -0.3] : [0, 0.35]);
  if (info.hat) c.drawImage(source(scene, lookTex(scene, info.hat, 62)), cx - lbox / 2, cy - lbox / 2, lbox, lbox);

  text(`${bagel.name} in ${stage.name}`, W / 2, 626, 36, '#fff3dc');
  text(`Twist: ${TWISTS[daily.twist].name}`, W / 2, 674, 30, '#f2b84b');
  text(won ? `CLEARED IN ${fmtTime(info.result.t)}` : `LASTED ${fmtTime(info.result.t)}`, W / 2, 752, 68, won ? '#f2b84b' : '#fff3dc');
  const streak = info.streak > 1 ? `   ·   ${info.streak} days in a row` : '';
  text(`${info.result.k.toLocaleString()} defeated${streak}`, W / 2, 826, 32, '#fff3dc');
  return cv;
}

/** Shows the picture over the game with a note, for phones (and previews) that have no share sheet. */
function showCard(url: string): void {
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;inset:0;z-index:20;background:rgba(18,12,8,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;font-family:${FONT};color:#fff3dc;touch-action:auto`;
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Daily Run score card';
  img.style.cssText = 'max-width:min(360px,100%);max-height:70vh;border-radius:12px;-webkit-touch-callout:default;user-select:auto';
  const note = document.createElement('div');
  note.textContent = 'Press and hold the picture to save or share it.';
  note.style.cssText = 'font-size:15px;text-align:center;color:#e8d8c0';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.style.cssText = `font-family:${FONT};font-size:18px;padding:11px 34px;border:3px solid #24160d;border-radius:12px;box-shadow:0 4px 0 #24160d;background:#f2b84b;color:#2b2118`;
  close.addEventListener('click', () => root.remove());
  root.append(img, note, close);
  document.body.append(root);
}

/** Opens the phone's share sheet with the card, or shows the picture to save by hand where there is none. */
export function shareScore(scene: Phaser.Scene, info: ScoreInfo): void {
  const cv = drawScoreCard(scene, info);
  const fallback = () => showCard(cv.toDataURL('image/png'));
  try {
    cv.toBlob((blob) => {
      if (!blob) return fallback();
      const file = new File([blob], `everything-bagel-daily-${info.date}.png`, { type: 'image/png' });
      const data = { files: [file], title: 'Everything Bagel: Daily Run' };
      if (navigator.canShare?.(data) && navigator.share) {
        // Closing the share sheet without sending is not an error worth showing.
        navigator.share(data).catch((e: unknown) => {
          if ((e as { name?: string })?.name !== 'AbortError') fallback();
        });
      } else fallback();
    }, 'image/png');
  } catch {
    fallback();
  }
}
