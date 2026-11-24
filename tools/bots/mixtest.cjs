// Measures how loud each song is on the music bus, so the songs can be levelled against each other.
// Usage: node tools/bots/mixtest.cjs [seconds per song]   (needs `npx vite preview --port 4191` running)
const { chromium } = require('playwright');
const SECS = Number(process.argv[2] ?? 8);
const SONGS = [['menu', 0], ['run', 0], ['run', 1], ['run', 2], ['boss', 0], ['frun', 0], ['frun', 2], ['fboss', 0], ['orun', 0], ['orun', 2], ['oboss', 0], ['prun', 0], ['prun', 2], ['pboss', 0], ['brun', 0], ['brun', 2], ['king', 0], ['king', 1], ['king', 2], ['win', 0], ['stale', 0], ['ending', 0]];
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 760 } })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({ dough: 0, upgrades: {}, unlocked: ['plain'], selected: 'plain', cookbook: [], bestTime: 100, totalKills: 0, clears: 0, best: {}, intro: true })));
  await p.goto(`http://localhost:${process.env.PORT ?? 4191}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  await p.mouse.click(195, 300);
  await p.waitForTimeout(1500);
  const db = (v) => (20 * Math.log10(Math.max(v, 1e-6))).toFixed(1);
  for (const [id, level] of SONGS) {
    const jingle = id === 'win' || id === 'stale';
    await p.evaluate(([id, level]) => window.__musicTest(id, level), [id, level]);
    await p.waitForTimeout(jingle ? 100 : 1500);
    const secs = jingle ? 2.5 : SECS;
    const r = await p.evaluate(async (secs) => {
      let sum = 0, n = 0, peak = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < secs * 1000) {
        const v = window.__musicLevel();
        sum += v * v; n++; peak = Math.max(peak, v);
        await new Promise((r) => setTimeout(r, 40));
      }
      return { rms: Math.sqrt(sum / n), peak };
    }, secs);
    console.log(`${id}${level ? ' L' + level : ''}`.padEnd(10), 'avg', db(r.rms).padStart(6), 'dB   loudest', db(r.peak).padStart(6), 'dB');
  }
  await b.close();
})();
