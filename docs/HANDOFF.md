# Handoff: Stage 1 and prototype (2026-11-02 to 2026-11-04)

This is the history and the decisions behind the current game. The working rules for Claude sessions are in `/CLAUDE.md`. Every date is 2026.

## Reference links

| What | Link |
| --- | --- |
| Live game | https://lg13002.github.io/Bagel-Survivor/ |
| Playable preview (single-file, republished every step) | https://claude.ai/artifact/DCNqaxNKwwiiFz9dYn7A4f |
| Game plan doc | https://claude.ai/artifact/3zMQXC7czm7Hi7xSGMgoZV |
| Art style board (the owner picked A, Chunky Cartoon) | https://claude.ai/artifact/Ty1nx3F2sR41NswPpbA4SK |
| Step 4 change list (UI) | https://claude.ai/artifact/TihnoSBgAaSqG2eSfnvnNt |
| Step 5 change list (audio) | https://claude.ai/artifact/GCeSxYpSwhJvmNpfSPyG7i |
| Step 6 change list (Quick Run) | https://claude.ai/artifact/RB5gLpu9s5Pzkd6yzgyvUk |
| Step 7 change list (balance) | https://claude.ai/artifact/FwmMBhw9qqkBBukQ8mYQdT |

## The owner's standing decisions

- **Platform:** phones, played as a home-screen web app. Runs must stay short and pause or resume cleanly.
- **Repo and hosting:** the repo is public with a noindex tag. GitHub Pages deploys from Actions.
- **Difficulty:** a solid 6/10 for Stage 1. Later stages bring the challenge.
- **Art:** Chunky Cartoon style. The Stage 1 floor is the giant countertop, and each stage gets its own floor (Stage 2 is the freezer). The world is zoomed 20% bigger.
- **Chests:** a bread basket (normal) and a gold toaster (rare: always from the Croissant, 25% from elites; gives 3 upgrades and +15 Dough).
- **Music:** made in code. No downloaded audio files.
- **Process:** change list, then approval, then a PR with a preview. The owner merges after each step.

## Changelog

### M1 to M3: first playable prototype (PR #1, merged 11-04)
- Core loop: one-thumb drag movement, auto weapons, seeds and levels, a choice of 3 cards (4 for Everything Ed), and rerolls.
- **6 weapons, 6 toppings, 6 evolutions** (see the README table). Chests, the Dough currency, and the Bakery's permanent upgrades.
- **6 bagels with unlock goals:**
  - Plain Jane: starter, +10% to all stats.
  - Everything Ed: clear Stage 1.
  - Poppy: survive 3:00.
  - Cinnamon Raisin: 1,000 total kills.
  - Pumpernickel: beat the boss without picking up a heal.
  - Onion Olly: discover 3 evolutions.
- Enemies:
  - Regular: crumb, mold (splits into moldlings), knife and ant lines.
  - Giant Mold elite.
  - Crusty Croissant mini-boss, which fires a ring of flakes.
  - Toaster Tyrant boss.
- Cookbook page, Practice mode (starts at 2:30 with 12 level-ups and pays no Dough), auto-pause on app switch, resume after iOS kills the app, and per-bagel per-stage bests.
- Two playtest passes tuned the difficulty and the feel of hits.

### Step 3: Chunky Cartoon art (PR #2)
- Everything redrawn in code: bagels, enemies, bosses, projectiles, pickups and icons, with contact shadows and an enemy waddle.
- The bread basket and gold toaster chests.
- **Giant countertop floor** with scattered props. World zoom set to 1.2, and the base pickup range raised to 62.

### Step 4: UI polish, 22 items (PR #3)
- Menu:
  - Hero bagel with swipe and chevron switching, and lock overlays with goal progress bars.
  - Stat pills and a Dough pill.
  - A compact layout for short screens.
- Level-up cards: color-coded by type, with corner tags and level pips.
- HUD:
  - Eased XP bar and a level badge.
  - Kills pill and a row showing the current build.
  - Boss bar.
- Pause screen with stats and the build. Quitting needs a second tap to confirm.
- **Bakery shop** rebuilt as icon cards, with a Dough count-down animation.
- GitHub Actions versions bumped, which cleared the Node 20 warning.

### Step 5: music and sound (PR #4)
- `src/music.ts` step sequencer with these songs:
  - menu: 100bpm swing.
  - run: 132bpm, with intensity layers that build over the run.
  - boss: 150bpm, A minor.
  - win and stale (defeat) jingles.
- Music is muffled while level-up, pause or chest screens are open. A heartbeat plays under 25% health.
- A full set of sound effects (per-enemy kill sounds, chests, evolve, coins, UI clicks), with a cap on overlapping voices.
- Separate Music and Sound toggles.

### Step 6: Quick Run (PR #5)
- Full/Quick switch on the menu. A Quick Run lasts about 3 minutes, with the Toaster Tyrant at 2:42.
- The schedule is compressed through `stageT` (pace 5/3). XP is +60% and Dough is 75%.
- Quick Runs keep separate bests (`stage1q`), and Quick clears count toward unlocks.

### Step 7: balance (PR #6, merged 11-04)
From the owner's playtest notes:
1. Getting every seed at once when the boss arrived was jarring.
2. Make Stage 1 slightly harder.
3. The Rolling Pin feels strongest.

- **Sticky Bun** replaces both automatic seed pulls. Quick Runs get 1, from the Croissant. Full Runs get 2: one from the Croissant and one from the 3:45 Giant Mold.
- Regular enemies get +10% health (`RUN.hpBonus`).
- Rolling Pin:
  - Damage 26 (was 28), knockback 250 (was 380).
  - The evolved Baker's Dozen fires every 3.8s (was 3.2s) and hits for 34 (was 40).
- Seed Gatling seed damage 13 (was 9).
- Quick Run Moldlings now get their health from the Quick Run clock.

### Phase 2, M5: stage framework and stage picker
- Planning: the [Phase 2 question template](https://claude.ai/artifact/Q5REiFfRxiK92pAS17Krdq), the [Phase 2 design doc](https://claude.ai/artifact/TBqYzaqW3kXDxSGh1ieQfa) and the [M5 change list](https://claude.ai/artifact/NJvqyK5S5t5Tgcm8UwMokt).
- Every stage is a `StageDef` recipe in `STAGES`. The run reads its floor, props, enemy mix, ring waves, lines, elite, mini-boss, boss, music, Dough pay and difficulty dials from it. Stage 1's numbers moved in unchanged.
- A stage button on the menu opens the stage picker (cards with a picture, story line, flame difficulty pips, the bagel's bests, locks and a "Coming soon" ribbon). PLAY starts the picked stage.
- Save data gains `stage` and `stageClears`. Old saves count their clears as Stage 1 clears. Run snapshots gain `stage`.
- Results show the stage name and a "NEW STAGE" note when a run opens one.

### Phase 2, M6 part 1: the Freezer floor, hazards and regular enemies
- Planning: the [M6 change list](https://claude.ai/artifact/Q8BSei2oMAEGsZLY63smet). The owner approved the extra ideas (enemies ignore ice, the mug's 5s frost immunity, Snowflake Sprinkles as the lines, Tyrant Jr.) and asked for a "Time to feel the burn" card when the Freezer Burn arrives (part 2).
- Floor: pale-blue freezer tiles with ice trays, frozen peas, popsicle sticks, freezer bags and frost piles. Seeded ice patches (0 to 2 per chunk, never at the start point) make the bagel slide.
- Frost: stand still 2s and a ring fills over 2s, then the bagel freezes (slowed, "Frozen! Keep moving to thaw."). Moving melts it.
- Warm Mug: drops from elites and rarely from regulars, at most one on the floor. Heals 10, clears frost, 5s immunity.
- Regulars: Frost Crumb, Ice Cube (charges after a shaking windup), Pea Pod (keeps distance, lobs peas), Popsicle (splits into halves), Freezer Mold (splits), Snowflake Sprinkles (lines).
- Enemy behavior is now data: `ai`, `dash`, `split`, `burst` on `EnemyDef`. Stage 1 behaves the same (timeline bot and weapon benchmark match main).
- Bot benchmark, level 3 weapons from 2:00: the Freezer deals about 20% more damage per minute than Stage 1 (422 vs 352). Part 2 tunes this to the 10 to 15% target once its elites and bosses are in.
- `VITE_PREVIEW=1` builds open every built stage, for the preview link.

## Weapon benchmark (bot, after step 7)

`tools/bots/wbench.cjs`: one weapon alone on Plain Jane, run from 2:00 for about 75s of game time.

| Weapon | Useful damage/sec, level 3 | Evolved | Damage taken/min, evolved |
| --- | --- | --- | --- |
| Sesame Shot / Seed Gatling | 97 | 332 | 316 |
| Seed Storm / Everything Inferno | 236 | 374 | 271 |
| Cream Cheese Puddle / Schmear Flood | 279 | 410 | 291 |
| Lox Boomerang / Lox Cyclone | 160 | 358 | 280 |
| Hot Coffee Splash / Espresso Nova | 143 | 302 | 248 |
| Rolling Pin / Baker's Dozen | 229 | ~305 | ~187 |

Some of these were measured before step 7 (Storm, Lox and Coffee) and the rest after. They vary by about 10% from run to run. The Rolling Pin's real edge is safety (knockback and kills all around you), not raw damage.

## Gotchas learned

- **Headless screenshots:** later pages in one Playwright script render few frames, so fades look dim. That's not a bug.
- **Pickups dropped at a boss's position** get collected instantly, because the boss is usually touching the player. That's why the bun drops on the far side.
- **Level-up card positions** change with the layout, so bots should resolve overlays through `window.__game`, not by clicking.
- **Quick Run code** must use `stageT` for anything on the schedule or anything that scales with time.
- **Old version on the owner's phone after a deploy:** fully close and reopen the home-screen app.
