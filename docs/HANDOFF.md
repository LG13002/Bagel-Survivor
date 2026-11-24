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
| Phase 3 design doc | https://claude.ai/artifact/XTFovTRnht4Ro4soMW44jt |
| Phase 3 style board | https://claude.ai/artifact/CUVqPHqxixzqyR5LPk1p2D |
| M12 change list (Foundations) | https://claude.ai/artifact/VUGKSKxsbQ3LFNHHNDwChA |
| M13 change list (Onboarding and story) | https://claude.ai/artifact/37yxZCzAQyad9XnGEEwz44 |
| M14 change list (Animation and feel) | https://claude.ai/artifact/8pTuU4yF2wZXVk12NhvaUL |
| M15 change list (the Pantry) | https://claude.ai/artifact/Ue8289z2E3gN9o1oY9ppJs |
| Dodging and crowd tuning (after the Pantry playtest) | https://claude.ai/artifact/R2g7G4kYhdQsr8QpJZp6xo |

## The owner's standing decisions

- **Platform:** phones, played as a home-screen web app. Runs must stay short and pause or resume cleanly.
- **Repo and hosting:** the repo is public with a noindex tag. GitHub Pages deploys from Actions.
- **Difficulty:** a solid 6/10 for Stage 1. Later stages bring the challenge.
- **Art:** Chunky Cartoon style. The Stage 1 floor is the giant countertop, and each stage gets its own floor (Stage 2 is the freezer). The world is zoomed 20% bigger.
- **Chests:** a bread basket (normal) and a gold toaster (rare: always from the Croissant, 25% from elites; gives 3 upgrades and +15 Dough).
- **Music:** made in code. No downloaded audio files.
- **Process:** change list, then approval, then a PR with a preview. The owner merges after each step.
- **Phase 3 (set 11-22):** see the M12 entry in the changelog for the owner's Phase 3 decisions.

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
- Piercing Butter Knife / Cutlery Drawer (Honey), Jam Jar Lob / Jam Session (Jam), Toaster Pop / Toast Barrage (Everything Seasoning), Waffle Stomp / Belgian Slam (Cream Cheese Frosting). The owner renamed two of the working names (Butter Knife Throw, Waffle Iron).
- They unlock through goals and stay off level-up cards until then. Preview builds open them all.
- Jam is grape purple so it never reads as the Freezer's pink melt puddles, which slow the player. Player toast is golden with a butter pat, unlike the Toaster Tyrant's dark toast.
- Sesame Shot +10% damage (12 to 13.2 per seed).
- Bot bench (level 3, then evolved; useful damage/sec): Butter Knife 158 / 314, Jam Jar 268 / 353, Toaster Pop 249 / 326, Waffle Stomp 161 (after a buff from 135) / 360. Sesame Shot level 3: 104 (was 97).
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
- The owner renamed Waffle Smash to **Waffle Stomp** after playing this PR (display name only; the id is still `iron`).
- The owner asked for fewer merges, so part 3 went onto the part 2 PR, and from now on a whole milestone is one PR (CLAUDE.md rule 2).
- `wbench.cjs` now turns off freeze-frames (they ate most of the sample at `speed=6`) and resolves a level-up that opens before it takes over. The table below is all 10 weapons on all 3 stages, level 3 and evolved.
- First pass: Hot Coffee Splash (-26%) and Waffle Stomp (-20%) were the weak ones at level 3, Rolling Pin (+32%) the strong one, and Seed Gatling (-27%) the weak evolution. Raising Coffee's and Waffle Stomp's damage did almost nothing (their hits already kill most enemies they reach), so they fire more often instead.
  - Hot Coffee Splash: every 1.15s (was 1.5s; level 5 x0.8, was x0.75), 15 damage (was 14).
  - Waffle Stomp: every 2.3s (was 3s; level 5 1.9s, was 2.4s), 48 damage (was 46).
  - Rolling Pin: 23 damage (was 26). Baker's Dozen is unchanged.
  - Seed Gatling: 17 damage per seed (was 13), still under the 30-damage freeze-frame.
- New `tools/bots/bagelbench.cjs`: plays each bagel to 4:25 with one fixed card policy, counting hits instead of applying them, and reports damage dealt and "health bars lost" (damage taken minus healing, over max health). Freezer, two runs each: most bagels lose 4.5 to 8 bars. Pumpernickel (about 1.5, tanky by design), Cinnamon Raisin (about 5, heals) and Plain Jane (about 6) are the safest; Everything Ed (about 10) is fragile by design (75 health, 4 cards). Poppy was the outlier (about 10 bars, fewest levels), so Poppy now has 100 health (was 90) and a bigger seed-mine hit area (11 instead of 8). After: about 7 bars. The bot can't time Blueberry's dash, so its number (about 8) undersells it.
- Stage steps (level 3 weapons, average damage taken per minute): Bakery 368, Freezer 396 (+8%), Toaster Oven 433 (+9%), close to the 10% steps in the design doc, so the stage dials are unchanged.
- Extra Crispy (same bench, 4 weapons): +34% damage taken per minute in the Bakery (366 to 490) and +32% in the Toaster Oven (430 to 566), where M10 put it (about +30%). Endless uses the same dials and wasn't changed.

### Code review pass: bug fixes and optimizations

A full read of the code after Phase 2 ([findings](https://claude.ai/artifact/6HTNUYVxC6hHcH62aC1CCc)). The owner approved the bug fixes and the safe optimizations; the bigger reorganizing (merging repeated code, splitting `GameScene.ts`) was left for later. No weapon, enemy or difficulty numbers changed.

Bugs fixed:

- **Two chests at once** left a panel stuck on screen with the joystick dead. Chests now wait while a panel is open.
- **Invisible oven knobs** in the next Bakery or Freezer run after an oven run (`posts` and `postChunks` weren't reset in `init`).
- **Resume:** the surprise elite at 4:00 came back a second time after a resume (the snapshot now saves `extras`), and elites that were alive were lost, along with the second Sticky Bun if one carried it (the snapshot now saves `elites` with their health).
- **Endless:** lines and ring waves that came due during a boss fight were saved up and all arrived when the boss fell. They are now skipped. Bot, a 65s fight: 48 Sugar Ants within 2s of the first boss falling before, none after; 58 wave enemies plus 36 ants after a returning boss before, none after. The next line or wave comes on its normal timer.
- **Practice kills** no longer count toward the 1,000-kill unlock.
- **Looping animations** on removed sprites (ice twinkles, bobbing chests, the menu's bagel) are now stopped. Bot: 630 left running after a long Freezer walk before, about 35 after.
- **Service worker:** only good responses are cached, older builds' game files are deleted, and the first visit saves its files so offline play works straight away.
- The **level badge** updates the moment the level changes.

Optimizations:

- **Art on demand** (see the art notes in `CLAUDE.md`). Bot, 3x screen: pictures drawn before the menu shows went from 200 to 100, about half the time, and picture memory at the menu from about 38 MB to about 8 MB (about 19 MB after a Bakery run, 27 MB after playing all three stages). The rest is drawn during the fade into the first run.
- **Effect sprites are reused** (`fx` / `fxDone`, now `effects.fx` / `effects.done`) instead of created and destroyed.
- **Drums** in the music play slices of the shared noise sample instead of making fresh noise per hit.
- The safe-area lookup is kept for a second at a time instead of read every frame.
- Removed: two unused sounds, a duplicate floor texture, and a few unused fields and parameters.

### Code review pass, group C: reorganizing

The rest of the review, approved by the owner. Nothing about play, art or sound changed.

- **`GameScene.ts` split into parts** (from about 3,500 lines to under 1,000): `src/run/` holds `state` (the run's numbers), `effects`, `floor`, `hazards`, `enemies`, `behaviors`, `director`, `pickups`, `hud`, `panels`, `resume` and `modes`. See the code map in `CLAUDE.md`.
- **Each part resets itself.** The run's numbers live in `RunState`, made fresh for every run, and each part is made fresh when the run starts. This replaces about 70 hand-written resets.
- **Shared boss shots:** `hz.ring()` and `hz.fan()` replace the ring and fan loops each boss had.
- **One menu pop-up frame** (`openPopup`, `closePopup`, `doneButton` in `MenuScene.ts`) for the stage picker, Goals, Cookbook, Enemies and the Bakery.
- **One puddle helper** (`PoolWeapon` in `weapons.ts`) for Cream Cheese Puddle and Jam Jar.
- **One best-score line** (`bestText`) for the menu and the stage picker.
- **Starter bagels** are marked with `starter: true` on their `BAGELS` entry instead of by position.
- Bot scripts in `tools/bots/` use the new paths.

How it was checked: 16 recorded runs (every stage, Quick, Endless, Extra Crispy, practice, resume) replayed frame by frame with a fixed random seed matched the old code exactly, and 30 menu screens matched pixel for pixel.

Bug found and fixed while checking: if an enemy shot or a Broiler flame line knocked you out while Second Bake was ready, the revive cleared the shots in the middle of the loop that was moving them, and that frame crashed (`Cannot read properties of undefined`). The shot and flame loops now stop when the revive has cleared them.

### Phase 3, M12: Foundations (version 0.12)

Phase 3 takes the game to a 1.0 that doesn't look like a prototype. The plan is the [Phase 3 design doc](https://claude.ai/artifact/XTFovTRnht4Ro4soMW44jt) (milestones M12 to M19); the owner picked the look on the [Phase 3 style board](https://claude.ai/artifact/CUVqPHqxixzqyR5LPk1p2D). Built from the approved [M12 change list](https://claude.ai/artifact/VUGKSKxsbQ3LFNHHNDwChA). No gameplay numbers changed.

- **The owner's Phase 3 decisions:** web only, free with no ads or purchases, shared by link rather than listed publicly (noindex stays), two more stages (the Pantry, the Bread Bin) with a light story, one bundled font file allowed, cosmetics yes, a local-only Daily Run, playtesters are people the owner invites who are new to the game, no fixed date. Style: Chunky Cartoon kept with upgraded lighting (not a redraw), "big hero" title, bakery shelf menu, Titan One.
- **One font:** Titan One everywhere, bundled with the code (works offline and in the single-file preview).
- **Title screen** on every launch, with the version number.
- **Bakery shelf menu:** bagels on a shelf, a name plate, the "Today's order" ticket (stage, Extra Crispy, mode, PLAY), and a bottom bar with Bakery, Goals, Cookbook and Settings. Practice moved to a switch on the stage picker; Music and Sound moved to Settings.
- **One pop-up look:** header bar, back button and the same tab switch on the stage picker, Bakery, Goals, Cookbook and Settings. The Done buttons are gone.
- **Bagel-ring wipe** between screens.
- **Settings:** music and sound volume, screen shake (On, Reduced, Off), flashing effects (Normal, Reduced), battery saver, left-handed buttons. Also reachable from the pause screen.
- **Saves:** a version number with upgrade steps, a spare copy that loads if the main save is unreadable, backup codes (copy and paste), reset (two taps), and a backup reminder after the first stage clear and every 30 days.
- **About and What's new:** version, a "What's new" card once after each update, and "No data leaves your phone."
- **New home-screen icon** drawn from the title art (`tools/icons.cjs`).
- **Upgraded lighting** (`relight`) on the title, menu and results bagels only for now; the in-run art gets it in M14.

How it was checked: `savetest.cjs` (39 checks: saves from the prototype, mid Phase 2 and the end of Phase 2 all load with their progress; broken saves fall back to the spare; backup codes round-trip; reset keeps settings). Quick Run clear and Sticky Bun bots pass. Weapon bench against `main`, side by side: Sesame Shot level 3 at 91 damage a second (main 93), Rolling Pin at 197 (main 190), inside the usual 10% run-to-run spread. Every screen was checked at 390×760 and 390×640.

Bugs found and fixed while checking: the first lighting pass greyed the ink outlines (it now leaves dark colors alone); the title screen's background was 27 full-screen circles a frame (now one small stretched picture); long card and upgrade descriptions overflowed in the wider font (they shrink to fit).

### Phase 3, M13: Onboarding and story (version 0.13)

Built from the approved [M13 change list](https://claude.ai/artifact/37yxZCzAQyad9XnGEEwz44). It sits on the same branch and PR as M12: the owner asked for fewer merges, so M12 to M14 merge together. No gameplay numbers changed.

- **First-run tips:** "Drag anywhere to move" (with a ghost thumb, until you move), "Your bagel fires on its own" (first crumb down), "Grab seeds to level up" (an arrow over the nearest seed), a line over the first level-up's cards, a line over the first chest, and the first results screen points at the Bakery with a button straight there. Tips are small boxes under the bagel that never pause the run, one at a time, each once per save.
- **Later tips,** the first time each thing comes up: a maxed weapon (how to evolve), the Sticky Bun, the Freezer (ice and frost, then the first Warm Mug), the Toaster Oven (coils, then grease and knobs), Blueberry's dash, and a line on the menu the first time Quick, Endless, Extra Crispy or Practice is picked.
- **Evolution recipes are always on show:** every weapon card names the topping it evolves with, every topping card the weapon it evolves, and the pause screen puts the needed topping on each weapon's corner (gold-ringed once owned).
- **Settings:** a Tips row (On, Off, "Replay tutorial"), a Help tab ("how to play" in seven lines) and "Watch the intro" on the About tab. With Tips off nothing in this list shows except the recipes.
- **Rotating hints** (22 of them) along the bottom of the pause and results screens.
- **A menu that opens as you go:** a new save's bottom bar has only Settings open. The Bakery and Goals open when the first run ends, the Cookbook at the first evolution. A closed button is dim with a lock and says how it opens; one that just opened wears a NEW tag until tapped. Saves with any progress keep everything open.
- **Intro comic:** four panels after the title screen, once (the bakery at dawn, the Stale creeping over the counter, the Stale King's crown in the bread bin, the bagels rolling out), with a little motion in each. Tap to turn the page, Skip to leave.
- **Boss lines:** every boss arrives with the announcement card (the Toaster Tyrant: "You're toast!"), and each mini-boss's banner has a line under it.
- **Story beats:** the first clear of each stage adds one line to the results screen.
- **Save version 3:** tips seen, opened menu buttons, NEW tags, the comic flag, and the Tips setting.

Decisions made while building: the comic plays once for existing saves too (it is new to them, and Skip is one tap). Existing saves skip the tips for anything they have clearly done already (the tutorial, the bun, evolutions if the Cookbook has an entry, mode notes once Stage 1 is cleared, a stage's hazards once that stage has been played). The first results screen swaps its buttons to BAKERY and Again, and only when there are at least 20 Dough to spend (the cheapest useful upgrade); otherwise it waits for a later run.

How it was checked: `tutortest.cjs` (a brand-new save from the title screen through the comic, the locked menu, a first run with each tip once and in order, the Bakery button, NEW tags, a second run with no tips, Tips off, Replay tutorial) at 390x760 and 390x640. `savetest.cjs` grew to 72 checks with an M12-era save: old saves get no tutorial and every button open. Quick Run clear and Sticky Bun bots pass. Weapon bench against the M12 build, run side by side: Rolling Pin level 3 at 251 to 279 damage a second on M13 and 251 to 304 on M12 (the same spread run to run), Sesame Shot level 3 at 95 (M12: 91).

### Phase 3, M14: Animation and feel (version 0.14)

Built from the approved [M14 change list](https://claude.ai/artifact/8pTuU4yF2wZXVk12NhvaUL) (27 items plus the three suggestions), on the same branch and PR as M12 and M13. No gameplay numbers changed.

- **Bagels:** living eyes (`src/face.ts`: blink, look where you move, squint when hit), a flattening wince on a hit, a smear of after-images behind Blueberry's dash, a hop and spin on a win, a droop on defeat. The title and menu bagels blink and glance about, and the menu bagel hops when tapped.
- **Enemies:** a squash on every hit, three ways to go (pop, crumble, splat, picked by the enemy's kill sound), seeds that hop out, chests, buns and mugs that land with a bounce.
- **Bosses:** mini-bosses and bosses drop in with a ring of dust, rear up before a timed attack, roar at half health (Freezer Burn, Broiler), and go out with a bigger burst and half a second of slow motion.
- **HUD and pop-ups:** build slots pop when they change, the boss bar has a name plate and a half-health notch, the screen's edges glow red under 25% health, level-up cards flip over, the golden toaster rattles and pops and its rewards come out one at a time, evolutions show both halves of the recipe sliding together. A tap skips any of these.
- **Results:** numbers count up, the run's Dough flies to a purse on the panel, a new best stamps down, and the nearest bagel unlock has a progress bar. A tap skips.
- **Stages:** the upgraded lighting on the in-run bagel, enemies, bosses and pickups; a tinted edge per stage (warm Bakery, cold Freezer, red-hot oven); specks in the air (flour dust, frost, sparks and heat haze); three new floor props per stage (whisk, eggshells, recipe card; frozen berries, freezer pop, frost crystal; oven mitt, fork, thermometer dial).
- **Sound:** songs crossfade. The mix was measured (`tools/bots/mixtest.cjs`): the boss themes were 4 to 6 dB quieter than the run theme they cut in on (Bakery boss -20.7 dB against -14.3 dB), and the bass layer made the run themes jump by up to 10 dB at 2:00. Now every run theme at full strength and every boss theme sits between -15.6 and -13.5 dB. Repeated sounds vary slightly in pitch. New sounds: a thud, a card flip, a tip's two notes, a counting tick.

Deviations from the list, told to the owner:
- **Bosses and mini-bosses appear closer.** To be seen dropping in, they land just inside the screen edge instead of walking in from about 40 units outside it: roughly 80 to 90 units closer than before. For the 0.7 seconds of the drop they stand still and can't hurt by touch. `bosstime.cjs` on both builds: every boss arrives at 4:30 and first attacks about 1.45s later, same as M13.
- **The win holds for 0.6 seconds** before the fade (so the hop is seen), after the half second of slow motion.
- **Battery saver also turns off the edge tint,** not only the specks (see the frame-rate note).
- **Item 26's fallback was built in from the start:** regular enemies only ever get the cheap squash (a scale change when the hit flash turns on or off). Only big enemies are posed every frame.

How it was checked:
- Frame rate (`fpsbench.cjs`, 12 seconds from about 4:10, M14 and M13 served side by side): Bakery 15.8 against 18.4 frames a second, Freezer 16.1 against 19.0, oven 14.7 against 16.7; a second Bakery pair read 17.6 against 18.5. So 5 to 15% lower in the bot. The bot draws without a graphics chip, where filling the screen is the slow part, and the stage's edge tint is one more screen-sized layer: with the tint hidden the Bakery read 18.3, level with M13. A phone's graphics chip handles one such layer easily, but if the owner's phone feels slower, the tint is the first thing to cut (Battery saver already does).
- Weapon bench against M13, alternating: Rolling Pin level 3 at 217 and 272 damage a second (M13: 300 and 264), Sesame Shot level 3 at 99 and 104 (M13: 109 and 103). The usual run-to-run spread.
- `savetest.cjs` (72 checks), `tutortest.cjs` at 390x760 and 390x640, `qtest.cjs` and `buntest.cjs` pass. Screens and slowed-down frames of each animation were looked at by hand.

### Phase 3, M15: the Pantry (version 0.15)

Built from the approved [M15 change list](https://claude.ai/artifact/Ue8289z2E3gN9o1oY9ppJs) (30 items plus the four suggestions). Stages 1 to 3 play as before. M15 and M16 share one branch and PR; the owner merges after M16.

- **Stage 4, the Pantry:** unlocked by beating the Broiler. Wooden shelves stand on the floor and line up into aisles. They block you, enemies and enemy shots, never your shots. The borders between shelf cells are always open corridors, so nothing can box the bagel in.
- **Path-finding (new system):** enemies walk around shelves by following a flow field toward the bagel, rebuilt five times a second (`Floor.steer`). Bosses, mini-bosses and the Waffle Bit lines ignore shelves.
- **Hazards:** rolling cans (a rattle, a red strip with arrows for 1.2s, then the can rolls down the nearest corridor: 8 damage to you, 45 to every enemy it flattens; 12 or more is a "Strike!") and flour puffs (a sack wobbles, then a 3 second cloud that makes small enemies inside it faint; the bagel, shots and pickups are never hidden).
- **Cast:** Dust Bunny, Sugar Cube (splits into 3 crystals), Rolling Pea Can (charges and bounces off shelves), Pepper Shaker (a short cone of 5 pepper shots), Molten Muffin as a regular from 2:00, Mold Spores, Waffle Bit lines. Elite: Moldy Loaf (breathes spores). Surprise at 4:00: Broiler Jr. Mini-boss: Spaghetti Tangle (noodle lines, and a knot that blocks part of an aisle for a few seconds). Boss: Mother Dough (bubbles that pop in warned circles, dough blob fans; at half health she rises, grows and pushes dough walls into the aisles).
- **Short-lived walls** (`floor.addTemp`): a warning outline, then solid, then they melt. Used by the knot and the dough walls.
- **Music:** `prun` (woodblocks and a plucked bass) and `pboss`. New sounds: rattle, roll, poof, whip.
- **Garlic bagel** (clear the Pantry): "Warding", everything it does deals 25% more to elites, mini-bosses and bosses. Starts with the Rolling Pin. The design doc's first idea was a short-range aura; the owner found that too close to Onion Olly and picked Warding from three options.
- **Menus:** the stage picker shows five stages and five difficulty flames; Stage 5 (the Bread Bin) is "Coming soon". Cookbook Enemies has a Pantry page. Three new challenges (clear the Pantry 60 Dough, clear it on Extra Crispy 100, a Strike 50). Two new tips (shelves, cans) and two hints.
- **Older goals keep their meaning:** "clear every stage" style challenges and the Rainbow goal are pinned to the first three stages.

Deviations from the list, told to the owner:
- **Suggestion 3 (warnings near shelves)** was done by drawing warning rings and outlines above the shelves instead of dimming the shelves.
- **The flour cloud sits on the floor** and fades the small enemies inside it, instead of being drawn over them. It reads the same and can never cover a shot or a pickup.
- **Waffle Bit lines hop over shelves** (they would bunch up at a shelf otherwise).
- **Contact damage dial is 0.94,** below the oven's. Shelves funnel enemies into the bagel, so the first dial (1.12) measured 27% more damage a minute than the oven. See the numbers below.

How it was checked:
- Difficulty (`wbench.cjs 6 sesame,storm`, damage taken a minute, oven against Pantry, alternating, two runs of each): from 2:00, oven 350 and Pantry 421 (20% more); from 3:30, oven 488 and Pantry 492 (level); together 419 against 457, about 9% more. The target was about 10% (9.0 against the oven's 8.2). The Pantry's extra bite is in the middle of the run, when the Spaghetti Tangle and the Muffins arrive; by the end the two stages hurt the same. Earlier dial settings, same method: 1.12 gave 27% more, 1.0 gave 16%, 0.97 gave 13%.
- Frame rate (`fpsbench.cjs`, alternating): oven 20.0 and 19.6 frames a second, Pantry 19.8 and 20.4. The first build read about 15% lower than the oven; the cause was the shelves' shadows, drawn as rounded shapes every frame. They are plain rectangles now and only the ones on screen are drawn.
- Boss timing (`bosstime.cjs`): Mother Dough arrives at 4:30 and first attacks 1.48s later, like every other boss.
- Music (`mixtest.cjs`): `prun` at full strength -14.6 dB and `pboss` -13.8 dB, inside the band the other stages sit in.
- Garlic (`bagelbench.cjs`, Stage 1 to 4:25): 428 damage a second, against Plain Jane 469 and Onion Olly 452 with the same card policy. Warding only touches elites and bosses, so it does not speed up ordinary waves.
- Stages 1 to 3 against the live game, alternating: Rolling Pin level 3 at 279, 415 and 452 damage a second on Stages 1, 2 and 3 (live game: 280, 342, 414), Sesame Shot level 3 at 104, 128 and 185 (live: 109, 129, 175): the usual run-to-run spread. `bosstime.cjs`: every boss arrives at 4:30 and first attacks 1.45 to 1.51s later on both builds.
- A Pantry win was played by bot in Full, Quick, Endless, Extra Crispy and Practice; the clear, the Garlic unlock, the bests and the challenge pay all landed, and a run resumed in the Pantry with its shelves and boss. `savetest.cjs`, `tutortest.cjs` at 390x760 and 390x640, `qtest.cjs` and `buntest.cjs` pass. Every new screen was looked at by hand at both sizes.

### Dodging and crowd tuning, every stage (after the owner's Pantry playtest, still version 0.15)

The owner played the Pantry, could not get past the Spaghetti Tangle, and said damage arrives from too many angles at once to survive by skill: enemies should be more manageable in every stage (kept in line with each other), and good movement should be rewarded. Built from the approved [tuning list](https://claude.ai/artifact/R2g7G4kYhdQsr8QpJZp6xo).

What the new bot (`dodgebench.cjs`) found: charging enemies were the largest source of damage in every stage unless their wind-up was read, and the wind-up was only a colour flash on a small enemy in a crowd. The game also spawned 70% of enemies in the direction of travel and sent waves as a closed ring, so there was rarely a gap. In the Pantry the Pea Can's bounce could not be read at all.

- **Charge lanes:** a red strip shows where each charger will dash, from the start of its wind-up. A Pea Can's lane bends where it will bounce.
- **At most three chargers** wind up or dash at once.
- **Spawns:** 40% in the direction of travel (was 70%). Ring waves leave an opening of about 110 degrees in a random place.
- **Regular enemies: 15% less health in every stage.** Elites and bosses unchanged.
- **Safe time after a hit:** 1.1s (was 0.9s).
- **Pantry:** Spaghetti Tangle health 2,000 to 1,700 and 3.3s between noodle volleys (was 2.7s); Molten Muffins join at 2:45 (was 2:00, the same moment as the Tangle); Pea Can damage 14 to 11 and about a quarter fewer.
- **One addition not on the list:** a one-time tip the first time a lane shows ("A red strip shows where an enemy will dash. Step out of it!").

Measured (`dodgebench.cjs`, 2:00 to about 3:15, damage taken a minute, old and new builds alternating, two runs each, hits counted 1.1s apart on both builds so the longer safe time is not part of the comparison):

| Stage | Careless: before | Careless: after | Careful: before | Careful: after |
| --- | --- | --- | --- | --- |
| 1 | 236 | 259 | 92 | 38 |
| 2 | 273 | 255 | 160 | 130 |
| 3 | 272 | 254 | 161 | 117 |
| 4 | 265 | 245 | 162 | 138 |

Careful play takes 26% less damage; careless play about the same (3% less). So the gap between the two grew from 1.8 times to 2.4 times: dodging pays more, which was the aim. The careful bot reads lanes perfectly on both builds, so the lanes' benefit to a person is not in these numbers. If the owner still finds crowds too thick, `CROWD_HP` is the dial (he was offered 20%).

`savetest.cjs`, `tutortest.cjs` (both sizes) and `qtest.cjs` pass.

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
| Waffle Stomp / Belgian Slam | 210 / 306 / 364 | -2% | 420 / 623 / 640 | +8% |
| Lox and Schmear (combo) | | | 442 / 617 / 622 | +9% |

Sesame Shot stays weak at level 3 on purpose (it's the starter). Evolved numbers are capped by how many enemies there are to hit, so they bunch together; the Rolling Pin's real edge is safety (it takes the least damage). Runs vary by about 10%.

## Gotchas learned

- **Headless screenshots:** later pages in one Playwright script render few frames, so fades look dim. That's not a bug.
- **Pickups dropped at a boss's position** get collected instantly, because the boss is usually touching the player. That's why the bun drops on the far side.
- **Level-up card positions** change with the layout, so bots should resolve overlays through `window.__game`, not by clicking.
- **Quick Run code** must use `stageT` for anything on the schedule or anything that scales with time.
- **Phaser keeps animating destroyed sprites.** A `repeat: -1` tween must be stopped by hand when its target goes.
- **Slow title screen in headless runs** was real, not a headless quirk: big overlapping shapes cost phones too. Stretch one small picture instead.
- **Overlay colors on finished art** (`source-atop`) wash out the ink outlines. `relight` uses the "overlay" blend through a spare canvas so dark stays dark.
- **A missing texture doesn't throw:** it draws a placeholder box. After adding art, check with a bot that no sprite's texture key is `__MISSING`.
- **The weapon bench drifts with the machine's frame rate:** the same build can read 250 or 300 on the same weapon. To compare two builds, build the old commit into a second folder, serve it on another port (`PORT=`) and alternate runs.
- **A scene's clock runs slow in headless runs** (few frames, and each frame's time is capped), so a 600 ms delay can take seconds. Bots should wait for a state (`scene.isActive('results')`, `results.playing`) instead of a fixed time.
- **To photograph an animation,** slow it down: `scene.tweens.timeScale = 0.08`, then take screenshots a second apart.
- **Full-screen layers are what the bot's frame rate feels.** It draws without a graphics chip, so one screen-sized see-through picture costs it about 5%. Phones barely notice, but keep such layers few.
- **Old version on the owner's phone after a deploy:** fully close and reopen the home-screen app.
