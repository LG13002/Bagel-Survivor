# Bot test scripts

Headless Playwright scripts used to check gameplay changes. They are not part of the build, and Playwright is not a dependency. Cloud sessions already have it installed, so `require('playwright')` works there.

Start a preview server first:

```bash
npm run build
(setsid npx vite preview --port 4191 > /dev/null 2>&1 &)
```

| Script | What it does | Run |
| --- | --- | --- |
| `wbench.cjs` | Gives Plain Jane one weapon at a set level (6 = evolved) in god mode, then reports useful damage/sec (overkill removed), kills/min and damage taken/min. | `node tools/bots/wbench.cjs 6 pin,sesame [stage] [startSecs]` (defaults `stage1 120`; `PORT=` env for another server; `CRISPY=1` turns on Extra Crispy). The weapon `combo` is Lox and Schmear; `pair` is Schmear Flood and Lox Cyclone side by side, for comparison |
| `bagelbench.cjs` | Plays each bagel to 4:25 of a Full Run with one fixed card policy. Hits are counted instead of applied, so every bagel covers the same stretch. Reports useful damage/sec, damage taken and healing per minute, and health bars lost (damage taken minus healing, over max health). | `node tools/bots/bagelbench.cjs [bagels] [stage] [endSecs]` (defaults: every bagel, `stage1`, `265`; `SPEED=`, `PORT=`, `CRISPY=1`). Two copies can run side by side; compare runs made the same way |
| `buntest.cjs` | Plays a Quick Run and a Full Run to the boss. Logs Sticky Bun drops and the seeds left on the floor when the boss arrives. Saves screenshots to the folder you pass. | `node tools/bots/buntest.cjs /tmp/out` |
| `qtest.cjs` | Plays a Quick Run to the boss, forces a win, then prints the resulting save data. | `node tools/bots/qtest.cjs /tmp/out` |

Notes:
- Use `waitUntil: 'domcontentloaded'` and resolve level-up and chest overlays through `window.__game` rather than by clicking, because card positions change.
- Headless Chromium runs slowly, and later pages in the same script render few frames. Fades can look dim and FPS is meaningless there. Use the numbers to compare runs, not as absolute values.
- Bot numbers vary run to run. Run anything you plan to act on twice.
