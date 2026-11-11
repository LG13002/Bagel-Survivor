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
- After the owner's first play: ice patches are bigger (radius 80 to 140px) with less grip (longer slides), thawing from fully frozen takes 3.5s of moving so the Warm Mug matters, the loose frozen-peas prop became a printed bag of peas (it read as XP seeds), and the Popsicle is about 5% bigger than the swarm crumbs.

### Phase 2, M6 part 2: the Freezer's elites, bosses and music
- Elites take turns: Ice Cream Scoop at 0:45 and 2:45 (drops pink melt puddles, outlined in white, that slow you to 60%), Frosted Croissant at 1:45 and 3:45 (a smaller 7-flake ring; the 3:45 one carries the second Sticky Bun in Full Runs). Tyrant Jr. turns up once at 4:00 with a 5-toast fan. Every elite drops a Warm Mug.
- Frozen Waffle mini-boss at 2:30: shakes and flashes for 0.8s, charges, three times, then rests 2.5s. Splits into 4 waffle squares; drops the gold toaster and the bun.
- The Freezer Burn at 4:30, 6000 health (Tyrant 5000). It arrives with a "Time to feel the burn!" card (the owner's idea). Phase 1: blue warning lines for 0.8s, then icicles fly along them; every third attack is a pizza-slice fan. Phase 2 at half health: 5 lines and faster attacks, frost circles that become ice patches after 1.2s (10 damage if you're inside), and rings of 16 Frosted Crumbs.
- Music: `frun` (116 bpm, bells and a soft pad, drums at 1:00, bass at 2:00) and `fboss` (150 bpm, D minor). Run themes are now any song with `layered: true`.
- Sounds: icicle whoosh, boss roar, melt drip, waffle charge.
- Balance: Freezer contact damage set to 0.94. Bot (level 3 weapons, from 2:00): Stage 1 averages 343 damage taken per minute, the Freezer 392 (+14%). From 3:15 the gap is smaller (+5%, one run).
- `wbench.cjs` takes a stage and start time: `node tools/bots/wbench.cjs 3 pin stage2 195`.

### Phase 2, M7: Blueberry, Asiago and the Bakery's Extras
- **Blueberry** (90 health, speed 145, starts with Lox Boomerang). Juicy Dash: a flick (a quick swipe and lift, under 250ms and over 30px) or SPACE dashes 95px in 0.18s. Safe from hits during the dash and 0.15s after. 5s cooldown shown as a purple ring around the bagel that fills, then pulses with a pop when ready. Holding the thumb to steer never dashes. Unlock: clear the Freezer.
- **Asiago** (100 health, speed 138, starts with Cream Cheese Puddle). Aged: +1% damage per 10s of the stage clock, up to +30%, shown as a gold badge at the top right of the HUD. Unlock: survive 3:00 in the Freezer.
- New goal kinds `stageclear` and `stagetime` (with `goal.stage`). Survival time per stage is saved in `save.stageTime`; older saves fall back to their bests (a Quick clear counts as 3:00). The menu checks unlocks on opening, so players who already met a goal get the bagel right away. Preview builds unlock both.
- **Bakery Extras tab** (Basics holds the original four): Lucky Seed (cards for items you own weigh more, gold toaster chance 25% + 5% per rank), Reroll Rack (+1 reroll per rank), Second Bake (one revive per run at 30% to 70% health, 2s of safety, enemies shoved back and enemy shots cleared), Hard Crust (-1 damage per rank, a hit always does at least half).
- Stage 1 with no new upgrades is unchanged: same scheduled events in the timeline bot, and the weapon bench is within noise of `main`.
- Bot hit sampling: Hard Crust at ranks 1/3/5 cuts damage taken to about 93%/79%/64% in Stage 1 and 92%/77%/62% in the Freezer. Maxing all four Extras costs 3,100 Dough, so it is a long-term goal.

### Phase 2, M8 part 1: four new weapons
- Piercing Butter Knife / Cutlery Drawer (Honey), Jam Jar Lob / Jam Session (Jam), Toaster Pop / Toast Barrage (Everything Seasoning), Waffle Smash / Belgian Slam (Cream Cheese Frosting). The owner renamed two of the working names (Butter Knife Throw, Waffle Iron).
- They unlock through goals and stay off level-up cards until then. Preview builds open them all.
- Jam is grape purple so it never reads as the Freezer's pink melt puddles, which slow the player. Player toast is golden with a butter pat, unlike the Toaster Tyrant's dark toast.
- Sesame Shot +10% damage (12 to 13.2 per seed).
- Bot bench (level 3, then evolved; useful damage/sec): Butter Knife 158 / 314, Jam Jar 268 / 353, Toaster Pop 249 / 326, Waffle Smash 161 (after a buff from 135) / 360. Sesame Shot level 3: 104 (was 97).
- Style board for the flare pass (part 2): https://claude.ai/artifact/3SvXccvywF63eTFsDociyw

### Phase 2, M8 part 2: "Crisp" weapon flare
- The owner picked style A (Crisp) on the style board: a hit spark and a quiet hit sound unique to each weapon, nothing else (no pop words, no extra shake).
- Level 5 projectiles glow gold; evolved ones change color and leave a trail. The knife's trail is silver, because blue dots read as XP seeds.
- Sparks share the particle budget and skip when it is busy; damage-over-time weapons spark less often. Bot bench unchanged within noise (Seed Gatling 310, Everything Inferno 399).
- Honey also gives +4% damage per level (the owner asked for a benefit at every level).

### Phase 2, M9 part 1: the Toaster Oven
- Change list (approved with all suggestions): https://claude.ai/artifact/5mNdywPPdViv9o1R1P5dnQ
- Floor: a dark oven rack over dim coils, kept low-contrast so enemies and the bright hazard strips stand out. Props: crumb tray, foil, burnt crumbs, ash.
- Hazards: coil flare-ups, grease pops with slicks, and rack posts (solid; block enemy shots only). No Warm Mug in the oven.
- Regular enemies: Ember Crumb, Burnt Toast (charger that flips), Hot Sauce Drop (3-shot spread), Popcorn Kernel (splits into 3 bits), plus the demoted Toaster Tots, Waffle Bits (the lines every 20s) and Melting Scoop.
- Jalapeño Cheddar (unlock: clear the Toaster Oven). The owner asked that burning enemies show it, so they get an orange tint and a small flame.
- After the owner's first playtest, they picked redraws from an idea board (https://claude.ai/artifact/NNrMpQ4mYvVVHMKZmXxba3): posts became oven knobs and got more common (about 1 per chunk), popcorn became a fluffy popped piece, the ember spark became a little flame, Burnt Toast became a classic toast slice, and Hot Sauce Drop became a small hot sauce bottle, because the red drop read as blood.
- Until part 2 the oven borrows Stage 1's elite, mini-boss, boss and music. Bot: damage taken per minute is about level with the Freezer (2:00 start: oven 400 and 365, Freezer 390 and 373 over two runs); part 2's bosses and tuning bring it to about +10%.

### Phase 2, M9 part 2: the oven's elites, bosses and music
- Molten Muffin elite (0:45, then every 60s): leaves a short trail of little flames and bursts into a ring of embers. The 3:45 one carries the second Sticky Bun in Full Runs.
- The Freezer Burn returns as a surprise elite at 4:00: smaller and scorched, and fires one warned icicle fan at a time.
- Flapjack Stack mini-boss (2:30): wobbles, then throws 3 spinning pancakes. Every fifth of its health it loses a pancake (a texture per stack height, `en_flap1`..`en_flap5`), flinging it as a ring of discs and getting shorter and faster.
- The Broiler boss (4:30, red-hot announcement card). Phase 1: sweeping flame lines (`beams`: a blinking orange warning, then a burst of fire along the line) and fireball fans. Phase 2 at half health: faster, 4-line sweeps, floor coil patterns centred on you every 7s (box, cross, stripes, via `coilPattern`), and rings of Toaster Tots every 10s.
- Music: `orun` (140 bpm, E minor, a new `sizzle` noise drum; layered like `run`) and `oboss` (164 bpm, the heaviest).
- Tuning, bot (`wbench.cjs`, level 3, four weapons, damage taken per minute, oven vs Freezer): from 2:00 404 vs 362 (+12%), from 3:20 497 vs 451 (+10%), from 4:25 482 vs 437 (+10%). Overall +11%, on the +10% target, so the Part 1 dials stayed. The Broiler has 7000 health against the Freezer Burn's 6000.
- After playing Part 2, the owner asked for the 4:00 surprise elite to keep the name Freezer Burn, and for a slightly harder oven: seeds there give 10% less XP (the stage's `xp` dial). Bot (one weapon, no upgrades taken): level at 2:00 went from 7 to 6; level at 4:30 stayed 8.

### Phase 2, M10: Endless and Extra Crispy
- Change list (approved with all suggestions): https://claude.ai/artifact/EEsQTPuvpDQm2qZ3TxVpaV. The owner renamed the hard toggle from "Burnt" to "Extra Crispy" and chose time-only Endless bests.
- Menu: the Full / Quick switch gained Endless, and a flame button beside the stage button toggles Extra Crispy. Both are locked per stage until it's cleared (tapping says why). With Extra Crispy on, the stage button and card turn charred, and a stage cleared on it gets a flame star. Practice is off in Endless.
- Endless: see CLAUDE.md for the rules. Resume saves its extra state (`endlessCleared`, `nextMini`, `nextBoss`, `bossRound`, `crispy`).
- Extra Crispy tuning: +40% health and +20% spawns alone only raised the bot's damage taken by about 6%, because the bot is already hit about as often as the 0.9s hit immunity allows. So, as a measured deviation from the list, Extra Crispy also multiplies damage you take by 1.25. Bot (`CRISPY=1 node tools/bots/wbench.cjs 3 sesame,coffee,pin,lox <stage> 150`, damage taken per minute, normal vs Extra Crispy): Stage 1 about 408 vs 534 (+31%), Freezer 457 vs 579 (+27%), Oven 472 vs 633 (+34%). Kills per minute drop 15 to 25%.

### Phase 2, M11 part 1: Goals page and Cookbook enemies
- Change list (approved with all suggestions): https://claude.ai/artifact/2epR6A5tmgMBGMFsuzTkCr. The owner raised two challenges (1,000 kills in one run, evolve 4 weapons in one run), kept the three-PR split, and kept the reward sizes (more challenges can come with later content).
- Menu: the bottom row is now three buttons, Bakery / Goals / Cookbook. A red dot on Goals means a challenge was just paid.
- Goals page: Unlocks, Challenges and Secrets tabs, 5 rows a page. See CLAUDE.md for how challenges are tracked and paid. "Beat a boss without being hit" counts stage bosses only (not mini-bosses or the oven's surprise Freezer Burn).
- Cookbook: a third tab, Enemies, with one page per stage (34 enemies in all). New icons: `ic_check` and `ic_secret`.
- No gameplay or balance changes in this part.

### Phase 2, M11 part 2: Rainbow bagel and Lox and Schmear
- Built from the approved M11 change list. Details are in CLAUDE.md under "Secrets".
- The Rainbow bagel has rainbow sprinkles on pink frosting (new `icing` and `sprinkles` options on `BagelLook`).
- Lox and Schmear: the first version used the hit numbers 26 to 32, but the bot showed those trip the 30-damage freeze-frame on almost every hit (the game lost about 15% of its time to freeze-frames). It now uses more frequent, smaller hits instead.
- After the owner played it: the merge used to wait until every other evolution was done, so it was only reachable in Endless. It now comes first on the next gold toaster. The freed slot used to be auto-filled by the chest, so, at the owner's request, **chests no longer add new weapons or toppings at all**: they only level up what you own, and empty slots are filled from level-up cards.
- `wbench.cjs` takes `combo` (merged) and `pair` (both evolutions side by side). At `speed=6` the bench loses game time to freeze-frames, so compare weapons that cross 30 damage at normal speed.

### Phase 2, M11 part 3: balance pass (on the same PR as part 2)
- The owner asked for fewer merges, so part 3 went onto the part 2 PR, and from now on a whole milestone is one PR (CLAUDE.md rule 2).
- `wbench.cjs` now turns off freeze-frames (they ate most of the sample at `speed=6`) and resolves a level-up that opens before it takes over. The table below is all 10 weapons on all 3 stages, level 3 and evolved.
- First pass: Hot Coffee Splash (-26%) and Waffle Smash (-20%) were the weak ones at level 3, Rolling Pin (+32%) the strong one, and Seed Gatling (-27%) the weak evolution. Raising Coffee's and Waffle Smash's damage did almost nothing (their hits already kill most enemies they reach), so they fire more often instead.
  - Hot Coffee Splash: every 1.15s (was 1.5s; level 5 x0.8, was x0.75), 15 damage (was 14).
  - Waffle Smash: every 2.3s (was 3s; level 5 1.9s, was 2.4s), 48 damage (was 46).
  - Rolling Pin: 23 damage (was 26). Baker's Dozen is unchanged.
  - Seed Gatling: 17 damage per seed (was 13), still under the 30-damage freeze-frame.
- New `tools/bots/bagelbench.cjs`: plays each bagel to 4:25 with one fixed card policy, counting hits instead of applying them, and reports damage dealt and "health bars lost" (damage taken minus healing, over max health). Freezer, two runs each: most bagels lose 4.5 to 8 bars. Pumpernickel (about 1.5, tanky by design), Cinnamon Raisin (about 5, heals) and Plain Jane (about 6) are the safest; Everything Ed (about 10) is fragile by design (75 health, 4 cards). Poppy was the outlier (about 10 bars, fewest levels), so Poppy now has 100 health (was 90) and a bigger seed-mine hit area (11 instead of 8). After: about 7 bars. The bot can't time Blueberry's dash, so its number (about 8) undersells it.
- Stage steps (level 3 weapons, average damage taken per minute): Bakery 368, Freezer 396 (+8%), Toaster Oven 433 (+9%), close to the 10% steps in the design doc, so the stage dials are unchanged.
- Extra Crispy (same bench, 4 weapons): +34% damage taken per minute in the Bakery (366 to 490) and +32% in the Toaster Oven (430 to 566), where M10 put it (about +30%). Endless uses the same dials and wasn't changed.

## Weapon benchmark (bot, M11 part 3)

`tools/bots/wbench.cjs`: one weapon alone on Plain Jane, from 2:00 for about 75s of game time, two runs each. Useful damage per second (overkill removed). "vs middle" is the average gap to the middle weapon on each stage.

| Weapon | Lv 3: Bakery / Freezer / Oven | vs middle | Evolved: Bakery / Freezer / Oven | vs middle |
| --- | --- | --- | --- | --- |
| Sesame Shot / Seed Gatling | 108 / 128 / 167 | -55% | 346 / 452 / 444 | -19% |
| Seed Storm / Everything Inferno | 234 / 262 / 288 | -11% | 380 / 626 / 566 | +1% |
| Cream Cheese Puddle / Schmear Flood | 302 / 282 / 346 | +6% | 400 / 598 / 546 | 0% |
| Lox Boomerang / Lox Cyclone | 260 / 378 / 328 | +10% | 392 / 561 / 534 | -4% |
| Hot Coffee Splash / Espresso Nova | 210 / 243 / 340 | -11% | 406 / 594 / 610 | +4% |
| Rolling Pin / Baker's Dozen | 298 / 372 / 380 | +19% | 444 / 711 / 632 | +15% |
| Piercing Butter Knife / Cutlery Drawer | 240 / 260 / 321 | -7% | 416 / 626 / 602 | +6% |
| Jam Jar Lob / Jam Session | 265 / 338 / 390 | +12% | 375 / 550 / 556 | -5% |
| Toaster Pop / Toast Barrage | 256 / 330 / 380 | +9% | 367 / 500 / 510 | -11% |
| Waffle Smash / Belgian Slam | 210 / 306 / 364 | -2% | 420 / 623 / 640 | +8% |
| Lox and Schmear (combo) | | | 442 / 617 / 622 | +9% |

Sesame Shot stays weak at level 3 on purpose (it's the starter). Evolved numbers are capped by how many enemies there are to hit, so they bunch together; the Rolling Pin's real edge is safety (it takes the least damage). Runs vary by about 10%.

## Gotchas learned

- **Headless screenshots:** later pages in one Playwright script render few frames, so fades look dim. That's not a bug.
- **Pickups dropped at a boss's position** get collected instantly, because the boss is usually touching the player. That's why the bun drops on the far side.
- **Level-up card positions** change with the layout, so bots should resolve overlays through `window.__game`, not by clicking.
- **Quick Run code** must use `stageT` for anything on the schedule or anything that scales with time.
- **Old version on the owner's phone after a deploy:** fully close and reopen the home-screen app.
