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
| `savetest.cjs` | Loads a save from each era of the game (prototype, mid Phase 2, end of Phase 2, M12) and checks nothing is lost and the new fields are filled in. Also checks the spare copy, backup codes and reset. Exits with code 1 if a check fails. Run it after any change to `src/save.ts`. | `node tools/bots/savetest.cjs` (`PORT=`) |
| `tutortest.cjs` | A brand-new save's first minutes: the intro comic, the locked menu, the first run's tips (each once, in order), the results screen's Bakery button, NEW tags, a second run with no tips, Tips off, and Replay tutorial. Saves screenshots of each step. Exits with code 1 if a check fails. Run it after touching tips, the menu's bottom bar or the intro. | `node tools/bots/tutortest.cjs <screenshot folder> [height]` (height defaults to 760; run 640 too) |

Notes:
- The game opens on the title screen. Scripts start a run straight from it (`getScene('title').scene.start('game', …)`) or tap through it; an older save also gets the What's new card on the menu, which `closePopup(false)` closes.
- Use `waitUntil: 'domcontentloaded'` and resolve level-up and chest overlays through `window.__game` rather than by clicking, because card positions change.
- Headless Chromium runs slowly, and later pages in the same script render few frames. Fades can look dim and FPS is meaningless there. Use the numbers to compare runs, not as absolute values.
- Bot numbers vary run to run. Run anything you plan to act on twice.
