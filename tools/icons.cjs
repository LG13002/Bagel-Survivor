// Draws the home-screen icons (public/icon-180.png, -192, -512) from the game's own title-screen art:
// the Everything bagel on the sunburst. Run it against the preview server after a build:
//   npm run build && npx vite preview --port 4191 &   then   node tools/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 3 })).newPage();
  await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({ dough: 0, upgrades: {}, unlocked: ['plain', 'everything'], selected: 'everything', cookbook: [], bestTime: 0, totalKills: 0, clears: 0 })));
  await p.goto(process.argv[2] || 'http://localhost:4191/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  for (const size of [512, 192, 180]) {
    const url = await p.evaluate((n) => {
      const tex = (k) => window.__game.textures.get(k).getSourceImage();
      const cv = document.createElement('canvas');
      cv.width = cv.height = n;
      const c = cv.getContext('2d');
      c.imageSmoothingQuality = 'high';
      // Sunburst, centred a little low like the title screen.
      c.drawImage(tex('title_bg'), -n * 0.9, -n * 0.85, n * 2.8, n * 2.8);
      c.drawImage(tex('title_rays'), -n * 0.5, -n * 0.45, n * 2, n * 2);
      // Soft floor shadow, then the bagel (it fills 31/40 of its picture). Kept inside the middle 80% for round masks.
      c.fillStyle = 'rgba(18,12,8,0.35)';
      c.beginPath();
      c.ellipse(n / 2, n * 0.83, n * 0.27, n * 0.045, 0, 0, Math.PI * 2);
      c.fill();
      const d = (n * 0.66 * 40) / 31;
      c.drawImage(tex('bagel_everything_giant'), n / 2 - d / 2, n * 0.5 - d / 2, d, d);
      return cv.toDataURL('image/png');
    }, size);
    fs.writeFileSync(path.join(__dirname, '..', 'public', `icon-${size}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close();
  console.log('icons written');
})();
