# AUDIT FB1021 (2026-10-21) - SNOW-FACE, LANE-TURN, DEX-HIDES and OFFLINE-ROAD, read cold

The owner asked, of the branch for `01-Overview/bugs/Field-Bugs-2026-10-21.md` (`ccr-0e0969df-704ea8` at 1173a02cc, no
pull request yet): **"Audit this"**. This page is the audit of its four slices: their laws, their pins, their mutants,
their records and the gates. Each finding has its verdict here. What the audit changed is written into the pages it
touched, marked `AUDIT FB1021` with the finding's id, and into the code beside each fix.

## How it was run

Four lanes. Each was a cold adversarial reader of a FROZEN head, 1173a02cc (main's 4bba28c6c and the branch's three
commits), in a detached worktree of its own (`Home.md`'s DO NOT FIX WHILE THE VERIFIER IS READING; a mutant edits files
in place, so no two lanes shared a tree). Each was told to reproduce a finding before reporting it, to run what it
claimed against main's code beside the branch's, and to end on what it checked and found sound. Nothing was fixed until
the lane that found it had reported.

| Lane | Over | How |
|---|---|---|
| L1 | SNOW-FACE and LANE-TURN: the chunk, its CPU twin, the snow host, the lane's turn, the faces on the freeware's map | 8 findings. All 48 programs the renderer builds compiled in headless WebGL2; every one of the 107,146 Mountain pixels scanned under the landforms; a 121-pixel grid turned onto the lane; a cold window's settle timed; 15 extra one-site mutants over the 15 snow test files |
| L2 | DEX-HIDES: the table, the producer, the service, the chain, the economy, the words | 10 findings. The real street pool driven with the Enemy Expansion installed (`createExteriorFoes`, the kill listener, `createGatherHost`); C&C's own corpse loot read beside the butchery; `chainPlan` over held hides; 15 extra mutants |
| L3 | OFFLINE-ROAD: the clock, the save, the wake, the words, the economy | 7 findings. The machine clock moved mid-session and a Loiter left open across the welcome, each on main's code beside the branch's; a fractional world minute through a save; 15 extra mutants |
| L4 | The records, the docs and the gates across all four: every claim of the field-bug page and the arc pages, the cites, the ledgers, the translations, the whole suite | 13 findings. Every test file in the tree on the frozen head (32,476 tests: 5 failures, one of them this branch's - the others fail alike on main); 1,406 mutants over 33 lists, 1,392 dead and 14 equivalent as recorded; every gate; the locales round-tripped through the catalog's own writer; the record's numbers re-measured |

Every finding was checked against the code before anything was fixed:

- a bug, by a pin that fails on 1173a02cc and passes at the fix (L3-1: in the main tree, ten +8 hour moves of the
  machine clock with no real time returned 15 errands at the head and none at main; L3-2: a 96-hour Loiter open as the
  welcome came paid 5,879 gold at the head (L3's own probe, 5,043) and none at main; L2-1: `chainPlan` for 4 Cured Leather from 8 Bear Hides, 8
  Wolf Pelts and 8 Boar Hides spent all 8 Bear Hides);
- a gap, by its surviving mutant, re-run;
- a doc finding, by the line it misstates.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| L3-1 | BLOCKER. The client's world clock is the machine's clock plus the relay's offset, read once a welcome. A player who set their machine's clock forward mid-session moved the world with it, and an errand on the world's time came back at once - 14 returns and 50,701 gold for ten +8 hour moves with no real time, at no cost (an errand sent while skewed is clamped when the clock is corrected). Main's lived step held each wake to 30 minutes, so this was new. The record said the client keeping the clock moved an errand "as it did", which was false | FIXED: each primary welcome marks the world's minute with `performance.now()` (`worldTick.js hearSharedClock`, `sharedClockHeardMark`), and a wake reads no more of the world than that minute plus the monotonic time since at the wire's rate, plus a minute (`revenantErrands.js errandWorldMinute`, `revenantCompanions.js errandWorldNow`). A load hears the relay again, so time away still counts. Pinned: +4 days of wall clock and no monotonic time, still abroad; a load a day later, back. Four mutants, dead. The record's paragraph rewritten (THE CLOCK'S GUARD) |
| L3-2 | MAJOR. An errand with no `due` (sent before the relay's clock was heard, or saved before OFFLINE-ROAD) took its minutes left at the first trusted wake from the own clock BEFORE the lived step's push, so a rest, Loiter or journey open as the welcome came was paid on it - repeatable by holding the relay's socket while sending | FIXED: its minutes left are taken from the minute the wake's lived step charged (`errandUntil(e, now - push) + push`). Pinned on the sequence: sent unheard, Loiter 96 hours, heard, woken - still abroad, its day left. One mutant, dead |
| L3-3 | Three one-site mutants of the changed lines survived: the Undying Vigil's longer road read as the place's on the world path (AUDIT RVN-STARS S2 back), the world's minute left fractional (`sanitizeErrand` then dropped the errand at the next save - every test fed whole minutes, the producer mints fractional ones), and a `due` written offline | FIXED: pinned on the producer's shapes - a fractional world minute through a save, a Vigil's 1.1 days, a send offline with no `due`. Three mutants, dead. Five more judged equivalent in production, as L3 did |
| L3-4 | The record's "no hour pays more than the measured rates" held per character only: every realm character's errands now keep the world's time while another is played, so an account of six may have twelve abroad | FIXED in the record and `06-Systems/Revenants.md` section 42: per character, at most six times the hour for an account, 3% and 12% of the band. Left as the slice's call: still a few per cent of the band |
| L3-5 | Online the page said "back in about 24 hours" of the event clock - two real hours, while the HUD's sky clock passes 48 in them - beside a foot line promising real time; and that line typed "two real hours", a number typed, not read (AUDIT RVN D13) | FIXED: online an errand's time left is real minutes and hours at the wire's rate (`errandLeftWords(.., real)`, `rvn.errand.left.realMinutes`, `realHours`); the foot line reads its hours from `ERRAND_REAL_HOURS_A_DAY`. Three mutants, dead |
| L3-6 | `Active-Arcs.md` and `Port-Ledger.md` still said an errand runs "online on its lived step alone"; section 42's Pinned line did not name the slice's pins | FIXED in all three |
| L3-7 | Sentences in `revenantErrands.js` and `revenantCompanions.js` contradicted by an OFFLINE-ROAD paragraph appended beneath them | FIXED: rewritten, not appended to (the header's ITS CLOCK, `ERRAND`'s doc, `chargeErrands`'s doc). The key `rvn.roster.abroadLived` kept, so the translations survive |
| L2-1 | MINOR. Wolf Pelt and Boar Hide stood after the Bear Hide in tier 2, so a chain for Cured Leather spent every Bear Hide - the Ram Kit's input - before a pelt with no other use | FIXED: tier 2's spare pelts first; the Rat Pelt stays first of all (a lenient chain names `works[0]`). The pins moved (`prof7_law`, `prof7_client`, `craft1_chain`); a chain pinned on held hides. Two mutants, dead |
| L2-2 | MINOR. The Mudcrab's butchery was Raw Fish, against PROF7's own law ("C&C's own animals") - C&C's corpse gives every Animal body Raw Meat and the Slaughterfish alone Raw Fish; the Land Dreugh gets none from Hunting though C&C feeds its body | FIXED: the Mudcrab's Raw Meat, pinned for all nine against C&C's own corpse. The Land Dreugh's none named as a departure (it shares the Dreugh's row whole) in the record and Professions-Arc 4.4. One mutant, dead |
| L2-3 | MINOR. Wolf Pelt and Boar Hide are furs, and the furniture's skins are "a fur's hide" - the record's reason to leave them out was that no recipe would be added | FIXED: `PELTS` takes both, four recipes (Large and Small Skins of each); `craft2_patterns`' measure moved (667 recipes paying a first, 565 firsts). One mutant, dead |
| L2-4 | The Ledger's PROF7 row, the arc's numbers table, `prof7_law`'s title and header, and code comments still listed the ten hides | FIXED in each |
| L2-5 | `producersOf` cited in `recipeLaw.js`; it is `chainLaw.js`'s | FIXED in the code comment and the record |
| L2-6 | The new hides' icons were claimed and unpinned (two mutants swapping them survived) | FIXED: pinned (`worldTextureArchive`, `worldTextureRecord` of 667, 672, 676). Two mutants, dead |
| L2-7 | The Mudcrab's chitin in de, cs, ja and ko differed from each language's own word for the Scorpion's | FIXED: de "Schlammkrabbenchitin", cs "Chitin bahenního kraba", ja "マッドクラブのキチン質", ko "진흙게 껍질" |
| L2-8 | The record's FOUR HOSTS line for DEX-HIDES named no host | FIXED: `world.js` (the street's pool), `worldModes.js`'s buildings and `dungeonContext.js`'s dungeons named; `exterior.js` FLAGGED by name, as PROF7's |
| L2-9 | A blank line inside `PLURAL_SAME`; a double blank line before Enemy-Expansion section 14; the 4.8 table's new row above 665-666 | FIXED |
| L2-10 | `fb1021_dexhides` alone did not hold the order within a tier (the moved pins did) | FIXED: the order mutants name the moved pins' files |
| L1-1 | MINOR. A turn ONTO the lane (the "Weather as places" or "Enhanced environments" preference turned in play) marked every standing pixel; `tickSeason` tore the whole grid down, and the player's own pixel's rebuild then settled a cold snow window in frame slices: 2.6 s of work, three to seven seconds of empty world. The record never weighed it and named the wrong triggers | FIXED: a turn onto the lane is marked once the window stands (the tick integrates it); a turn off it at once. Pinned (LANE-TURN, precip4 THE HOST). One mutant, dead. The triggers and the cost named in the record and `07-Rendering/Biome-Precipitation.md` |
| L1-2 (= L4-6) | MINOR. The record's Mountain-wide shares did not reproduce: about 0.08% over the 107,146 Mountain pixels and 0.38% over the 6,662 with a height byte of 80 or more, not 0.01% and 1.3%. L4, by the pin's own method, also put the pixel beside The Howling Ogre Lodge at 40% (939,475), not 41%, and Boorche's Guard's at 37%; the record's "the world host's own" landforms leave out the roads and sites the host hands them | FIXED in the record: the pin's method named, its numbers (re-measured: 917,472 39.6%, 924,473 43.9%, 939,475 39.9%, 951,464 37.0%; steepest 60.7 to 65.0; DFU's kernel none past 52, steepest 39.0 to 44.5) |
| L1-3 | MINOR. `Rendering.md`, `Active-Arcs.md`, `Page-Index.md` and `Performance-Priority.md` still described the slope law; `Biome-Precipitation.md` gave the pixel beside The Bat and Cat Pub 39% (it is 924,473's 44%; 39% is 917,472's - L4-5), and its Verification list missed the slice's pin | FIXED in each. SNOW-BUDGET's "what it still pays" item 2 struck, paid off by SNOW-FACE; `snowbudget.json`'s count corrected to 3 |
| L1-4 | MINOR (design residue, as decided). The report's "no floral" half stands in every season: the faces past 50 degrees stay bare of trees by DFU's rule, white in winter now and green in summer. The faces are the landforms', and under DFU's own kernel the same pixels hold none past 45 | DECIDED, kept: a tree on a 60-degree face stands out from a cliff, and reading DFU's slope under our ground for the woods is a new law, not this fix; the winter of the screenshot reads as a snowfield. Said plainly in the record's DECIDED |
| L1-5 | Weak pins: LANE-TURN's "never left to the skin" could not fail; the CPU shed-back mutant's only killer was data-gated (CI fetches no ARENA2); the GPU chunk test read four places, and a cover held to 0.98 survived every snow test | FIXED: LANE-TURN counts the skin's calls; the CPU record names `precip4_snowground.test.js` (dead without ARENA2); the chunk reads every second world tile of the pixel (a cover held to 0.98 now fails at 289 of 4,096). One mutant added, dead. The shed-back records stand for what they kill, a whole cover kept whole; a slope brought back is held by the chunk's source pin (no normal read in any of the five callers) |
| L1-6 | Three survivors on lines this change rewrote, all from before it: the blade's floating-origin shift's sign, the feet's height unshifted (every rig stood at no shift), the laid snow's footprint one axis twice (every caller passed none) | FIXED: a rig shifted 1,000 m up, and a footprint one way only into `snowLaid`. Three mutants in `precip1.json`, dead |
| L1-7 | The record said a pixel turned off the lane wore its summer green; off the lane `arrayOf` is the plain set or none, and the lane loaded the twin alone, so most likely it drew black | FIXED in the record and the precipitation page |
| L1-8 | `buries` kept the scene x and z the slope alone read, and `snowbudget.test.js` still handed the host a `heightAt` it no longer reads | FIXED: `buries(p, lx, lz, y)`; the rig takes no `heightAt` |
| L4-1 | BLOCKER. `time1_census.test.js` failed on the head and passed on main: OFFLINE-ROAD's two new readers of the shared clock (the send's and the wake's `trustedWorldMinutes()`) were not in the census, so CI's whole-suite `verify` would have gone red. The slices' own test files and a `test:changed` run of them missed it | FIXED: the census names the readers as they stand after L3-1 (`errandWorldNow`, clock `event`; `hearSharedClock`'s mark, `law`), and `06-Systems/Online-Time-Arc.md` 5.2 lists the errand on the event clock |
| L4-2 | MAJOR. Two Ledger section A rows the change made false: RVN-ERRAND's "online on its lived step alone", and PROF7's list of what is skinned | FIXED (with L3-6 and L2-4): both rows now say what is so |
| L4-3 | Other live sentences the change made false: `Active-Arcs.md`'s PRECIP and Revenants entries, `Rendering.md`'s index, `Performance-Priority.md`'s "`drawnCover` reads the slope", Appendix B's hides, Professions-Arc's "`foe`, its MobileTypes value", `Page-Index.md`'s "the slope" | FIXED in each (several with L1-3 and L2-4) |
| L4-4 | Code comments the change made false, the old sentence kept and the new appended: the wake's comment, `chargeErrands`' doc, the errand header, `ERRAND`'s doc, `errandStep`'s doc; `profTemplates.js`'s ranges | FIXED (with L3-7): each sentence rewritten; the ranges name 672 and 676 |
| L4-5 | `Biome-Precipitation.md`'s 39% was 917,472's, not the pixel beside the pub's | FIXED (= L1-3) |
| L4-6 | The record's averages and two named shares did not reproduce by the pin's method | FIXED (= L1-2) |
| L4-7 | The record's "Not changed, said plainly" overstated the clock's weakness: a clock set forward before playing is corrected at the welcome; only a mid-session move between welcomes moved it | FIXED: the paragraph is THE CLOCK'S GUARD now, and the guard closes the mid-session move too (L3-1) |
| L4-8 | The commit message's "eight re-aimed by content" is seven | LEFT: a pushed commit's message is history; the record's list of seven is right, and this page says so |
| L4-9 | The new LANE-TURN paragraph in `Biome-Precipitation.md` swallowed GROUND-5's sentences on the water's bed, the desert and the sea | FIXED: put back after the CPU's cover |
| L4-10 | The 4.8 table's new row out of id order; "the reserved range's first free ids" - lower ids are free (601, 602, 604-609 and more); 4.8 called 600 unused, and it is the Materials Bag's | FIXED: the row moved (= L2-9); "the first free ids past the hides' block"; 600 named as BAG1's |
| L4-11 | A stray blank line in `PLURAL_SAME` | FIXED (= L2-9) |
| L4-12 | Enemy-Expansion section 3's slices table had no DEX-HIDES row, and a double blank line before section 14; Revenants section 42's Pinned line | FIXED (with L2-9, L3-6) |
| L4-13 | The chitin words in de, cs and ko (= L2-7); the Wolf Pelt's reason "one team, Werecreatures" - the mod's Werecreatures team holds the Boar too | FIXED: the words; the reason is the canines' one coat, in the record, the arc's table and `professionLaw.js` |

## At the merge with main

Main had merged its own DEX-HIDES first (`01-Overview/bugs/Field-Bugs-2026-10-20h.md`: the same nine animals and keys, its
hides at 681-683). It was taken whole and this branch's dropped, since its ids may already stand in a player's Stores.
The L2 findings were run again on main's build: L2-2 (the Mudcrab's Raw Meat), L2-3 (the furs cut to skins) and L2-7 (the
chitin words) held there already; L2-1 did not - main stood the Bear Hide before the Wolf Pelt, and a chain spent all 8
Bear Hides - so its fix is carried as the Bear Hide's cure last of its tier, pinned in `fb1020h_dexhides.test.js` with
the Mudcrab Chitin's mass noun (two mutants in `fb1020h_dexhides.json`, dead; main's `DEX-HIDES-the-cures-unsorted`
re-aimed, dead). The rows above for L2-4, L2-6, L2-8 and L2-10 were about this branch's own build and went with it.

Main's OW-HITCH had given the snow host the drawn ground's normal for the slope (`normalOf`); with no slope it is gone,
`owhitch.test.js`'s snow pin moved to "the stream asked nothing", and `owhitch.json`'s two snow records retired.

## What it checked and found sound

- **SNOW-FACE's law.** No slope consumer is left: `SNOW_GROUND.slope`, `normalY` and `heightAt` are gone from the host,
  the chunk, the tests and the tools. `aNormal` and `vNormal` still feed what they fed (the Snowfall surface's morph, the
  terrain's light), so no attribute was optimised out. The Snowfall mod's own slope law (`MaxSnowSlope` 55) is
  untouched. DFU's tree rule is `MAX_STEEPNESS` 50 in both scatters. The old shed band was right: 36.9 to 51.7 degrees.
- **LANE-TURN.** The re-skin door refused both turns (`reskinPixelNow`). The lane cannot flip at boot (`setAirGround`
  runs before the host), online forces the prefs, `turned` is per pixel object (no thrash), and a build in flight across
  a turn is re-marked once.
- **DEX-HIDES end to end.** On the real street pool with the mod installed, a Wolf, Bat, Mudcrab, Land Dreugh and Snow
  Wolf are stamped at the kill and offered as "Skin the ..."; the Tracker marks them alive. A corpse is flagged at the
  death on the street and in a dungeon whatever its texture. No port foe spawns in 256-290; 667, 672 and 676 are written
  by `profTemplates` alone; nothing reads `HIDES` by index; the service skins by `hideOfFoe` alone; an old service
  refuses with `prof-foe` and an old client names the key. The record's levels, teams, careers and affinities match the
  mod's MonsterBase table.
- **OFFLINE-ROAD.** Reloads open no new duplication (every haul destination is in the save; loyalty and XP are held by
  `paid`). `due` and `w` are event minutes, `until` and `own` own minutes; the clamp is written back; `onWorld` is
  decided once a wake, so nothing is counted twice. A Copy to offline carries a `due` offline ignores, and customs
  refuses a copy never online. Every language's errand row is faithful.
- **The gates** on the frozen head: lint, types, the bible gates and `hostceiling` clean; every mutant record the
  slices named dead.

## After the fixes

- `fb1021_snowface.test.js` 3 tests, `fb1021_dexhides.test.js` 7, `fb1021_offlineroad.test.js` 8.
- `tools/mutants/fb1021_snowface.json` 6, `fb1021_dexhides.json` 12, `fb1021_offlineroad.json` 19, and three in
  `precip1.json`: all dead. `snowface` without ARENA2, as CI runs it.
- Every mutant record whose text sits on a line the audit changed: 36, all dead. Of the 625 records on the files it
  touched, 339 were run before the sweep was cut short for time (the slices' own lists and L4's 1,406 on the frozen head
  already covered the rest's lines, unchanged since): all dead, none survived, the recorded equivalents as recorded.
- The whole suite with ARENA2 after the fixes: 32,483 tests, 32,431 pass, 49 skipped, 3 fail - IT1's and WD1's patch
  checksums and CRATE-FREE's BLOCKS.BSA list, which follow the fetched data's version and fail alike on main (L4).
- Lint, types, `cites --check` (2,816 anchors), the bible gates, the clock census and `hostceiling`: clean.
