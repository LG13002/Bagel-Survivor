// Offline play and updates, against two builds of the game:
//   1. the first visit saves the game for offline play, and it then opens with no connection;
//   2. after a new build is put up, closing and reopening the game shows the new version straight away;
//   3. the new build also opens with no connection, and the old build's game file has been dropped.
// Usage: node tools/bots/offlinetest.cjs <folder of the old build> <folder of the new build>
//   Each folder is a `dist` made by `npm run build` (not `vite preview`, so the script serves them itself on port 4195).
//   Exits with code 1 if a check fails.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const [OLD, NEW] = process.argv.slice(2);
if (!OLD || !NEW) { console.log('usage: node tools/bots/offlinetest.cjs <old dist> <new dist>'); process.exit(2); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
let root = OLD;
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});
const gameFile = (dir) => fs.readdirSync(path.join(dir, 'assets')).find((f) => f.endsWith('.js'));

(async () => {
  await new Promise((r) => server.listen(4195, r));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 } });
  let bad = 0;
  const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) bad++; };
  const open = async () => {
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://localhost:4195/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await p.waitForTimeout(3500);
    const st = await p.evaluate(() => ({ game: !!window.__game && window.__game.scene.isActive('title'), file: [...document.scripts].map((s) => s.src.split('/').pop()).find((s) => s.startsWith('index-')) || '', splash: !!document.getElementById('splash') })).catch(() => ({ game: false, file: '' }));
    return { p, st, errors };
  };

  // 1. First visit, then offline.
  let v = await open();
  check(v.st.game && v.st.file === gameFile(OLD), `first visit opens the old build (${v.st.file})`);
  check(!v.st.splash, 'the launch screen is gone once the title is up');
  await v.p.waitForTimeout(2500); // the service worker saves the files it just loaded
  await v.p.close();
  await ctx.setOffline(true);
  v = await open();
  check(v.st.game && !v.errors.length, 'opens with no connection after one visit');
  const icon = await v.p.evaluate(() => fetch('icon-192.png').then((r) => r.ok, () => false));
  check(icon, 'the icon (used by the launch screen) is saved for offline too');
  await v.p.close();
  await ctx.setOffline(false);

  // 2. A new build goes up: the next open shows it.
  root = NEW;
  v = await open();
  check(v.st.game && v.st.file === gameFile(NEW), `after an update, reopening shows the new build at once (${v.st.file})`);
  await v.p.waitForTimeout(2500);
  const kept = await v.p.evaluate(async () => (await (await caches.open('everything-bagel-v1')).keys()).map((k) => k.url.split('/').pop()).filter((n) => n.startsWith('index-')));
  check(kept.length === 1 && kept[0] === gameFile(NEW), `only the new game file is kept for offline (${kept.join(', ')})`);
  await v.p.close();

  // 3. The new build, offline.
  await ctx.setOffline(true);
  v = await open();
  check(v.st.game && v.st.file === gameFile(NEW) && !v.errors.length, 'the new build opens with no connection');
  await v.p.close();

  await b.close();
  server.close();
  console.log(bad ? `${bad} check(s) failed` : 'all checks passed');
  process.exit(bad ? 1 : 0);
})();
