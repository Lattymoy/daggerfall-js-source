# AUDIT EG-FALL (2026-10-21) - A LORD'S FALL, read cold

The owner asked, of the branch for `11-Multiplayer/Elite-Gates.md` EG-FALL (ccr-028407ad-h3fumj, at b60e34bfb): **"Audit
this"**. This page is the audit of EG-FALL: its law, its pins, its mutants, its records. Each finding has its verdict
here. What the audit changed is written into the pages it touched, marked `AUDIT EG-FALL` with the finding's id, and into
the code beside each fix.

## How it was run

Three lanes. Each was a cold adversarial reader of a FROZEN head, b60e34bfb, in a detached worktree of its own
(`Home.md`'s DO NOT FIX WHILE THE VERIFIER IS READING; a mutant edits files in place, so no two lanes shared a tree), told
the change and the owner's report but not the author's view of it, and told to reproduce a finding before reporting it
and to end on what it checked and found sound. Daggerfall's freeware data was fetched first (`tools/fetch-data.sh`) so
the lanes could read the real pictures. Nothing was fixed until all three had reported.

| Lane | Over | How |
|---|---|---|
| L1 | The behaviour: the relay's real fall and its words, every lord's shape, clocks, lifetimes, per-frame cost, GL state, sound, the gate's parity, Daggerfall's own pictures | 8 findings. The real fold (`foldEg`), the relay's rows, `createEgFight` over recording renderer, audio and GL, the heap profiler, ARENA2's TEXTURE files |
| L2 | The pins and the mutants: each pin on the pre-change code, a real fall from the director's own code, the committed list and 54 extra one-site mutants, isolation | 11 findings. Pre-change: 8 of 10 pins fail on origin/main's `egFight.js`. Extra mutants: 35 of 54 survived - 21 gaps, 14 equivalent (each proven) |
| L3 | The records, the words and the gates: every claim of the record, the index, the ledger, the comments and the commits; DFU's own code; every gate | 13 findings. lint, types, cites (3,035), the six bible gates, `test:changed` (2,520 of 2,521 - one timing test, below), the mutant list (37 of 37 dead) |

Every finding was checked against the code before anything was fixed:

- a bug, by a pin that fails on b60e34bfb and passes at the fix (`eg_lordfall_relay.test.js` tests 1 and 2 - the second
  on its first assertion, the relay's walk);
- a gap, by its surviving mutant, now killed (`tools/mutants/eg_fall.json`, its `AUDIT-EG-FALL-*` records - and the fixes'
  own records too: their first run left five alive, each then pinned);
- a doc finding, by the line it misstates.

## What it found, and what was done

32 findings, 30 distinct (L2-1 is L1-1, L2-2 is L1-2), 2 of them bugs.

| Id | Finding | Verdict |
|---|---|---|
| L1-1 (= L2-1) | **A lord that is not its fight's last to fall played its fall twice.** Its fall comes by `efl` alone, which the link stamps at its arrival (`fellOf`); the next whole fight (`efs`, every 2 s) brings the relay's own instant in the row's `sa`, and `see()` read the moved instant as a new fall: a second cry, shake, Dagon burst and flash, or a second thud and column (L2: five of eight timings at 120 ms; none at zero latency). The Twins' first fall, the Old Masters', Clan Feud's | FIXED: an instant moved by less than `EG_FALL_SAME_MS` (a fall's span) re-anchors the fall, its beats kept played and its flash moved with it; a real re-fall (moved further, or after a raise the sweep saw) is a new fall as before. `eg_lordfall_relay.test.js` test 1 (the director's Twin Court, every word folded at its arrival, eight phases of the whole fight against the fall) fails on b60e34bfb; two mutants dead |
| L1-2 (= L2-2) | **The relay carried a felled lord along its walk.** `egLordHit` never stopped it, so each later `efs` re-said the walk: the falling body jumped away from its own burst and corpse, and a screen that came later laid the corpse metres away (L1: x 12 against 6; L2: 4.3 m) | FIXED, both halves: the relay stops the walk at the fall (`egStop`, relay world248 - world240 on its branch, renumbered at the merge - `src/net/wire.js`), and the screen holds the place it first saw fallen (`placeOf`), taking the room's place once a whole fight says it standing still (a row still walking - an older relay - never moves it). Relay test 2 fails on b60e34bfb; four mutants dead |
| L1-3 | The fall's lights claim `carried`, but the Spire's light seam (`egHall.js` `egLightsWith`) dropped every extra light's mask: the 40 m flash and 18 m glow took shadow casters' slots | FIXED: the seam honours `carried` as the gate's (`withCourtLights`) does - the fall's are the only Spire lights that set it. Pinned (the list the renderer reads), mutant dead |
| L1-4 | A flyer felled aloft cried, burst and glowed from floor height, its body 10-28 m above | FIXED: the beats stand over its hover, the glow dropping with it (`egFallAloft`). Pinned (the Mother of Dusk), two mutants dead |
| L1-5 (= L2-8) | Daggerfall's hurt records hold ONE frame (TEXTURE.270, 280-291, records 10-14); the pins stubbed five and the record said "its hurt frames to the floor". The Mother of Dusk aloft drew frames 0-4 of a wing beat and held mid-flap | FIXED: the harness takes the real shape (one frame), the pins assert the hurt TABLE's record (the idle table's mutant dead), the record says one held picture as the gate's; a winged body loops its table at the flyers' ten a second (the gate's host's winged fall). An ARENA2 pin reads every lord's real records and Grath's real corpse (9.0 by 4.2 m) |
| L1-6 | The spark pass was built at the kill (a first kill could link two programs on its frame), never warmed and never freed - `GateFxRenderer` had no `destroy` | FIXED: warmed while a lord stands (`warm`), freed with the breach (`dispose`, `GateFxRenderer.destroy` - new; a destroyed pass draws nothing). Pinned over a recording WebGL; five mutants dead |
| L1-7 | Sparks sized by the canvas, not the world image (double size under a render scale) | FIXED: the world image's height, as the Hour's. Pinned (720 px, not 1,440). The gate's own spark draw has the same fault: LEFT, the gate's, named here for its next slice |
| L1-8 (= L3-5) | Two departures from the gate the record did not name: a Colossal lord's sink and corpse grow with its size; the corpse casts no shadow | FIXED in the record (four departures) |
| L2-3 | No pin drew a telegraph floor and the fall in one world pass: the sparks dropped whenever a floor drew survived; the floors' own answer dropped survived (on origin/main too) | FIXED: burning ground on hall 5's court beside a fallen lord, and alone. Both mutants dead |
| L2-4 | Every fixture stood at y 0, and only fire or frost lords fell through the fight | FIXED: a fall on hall 5's court 19 m up, and the Night-Stalker in the Shade's rime. Four mutants dead |
| L2-5 | A fall first seen 1-1,499 ms late was unpinned (the burst's and the flash's start, the place read now) | FIXED: a walking lord first seen 300 ms in. Three mutants dead |
| L2-6 | The lights' and sounds' places and colours were half pinned (two channels of three, no x or z, no fade, no `carried`) | FIXED: each record whole. Seven mutants dead |
| L2-7 | Nothing held "no corpse before FALL_MS"; leave keeping the bursts survived | FIXED: both pinned |
| L2-9 (= L3-9) | The module re-declared numbers the gate wrote in line (0.5, 3, 4, 40, 1000, 2.2, 0.55); the tests built their clocks from the copies | FIXED: named once in the gate (`gateCourt.js` `FALL_BURST_UP`, `FALL_FLASH_Y`, `FALL_FLASH_K`, `FALL_FLASH_RANGE`, `FALL_NEWS_MS`; `gateBoss.js` `GLOW_UP_SHARE`, `FALL_GLOW_K`), the gate's code reading them unchanged in value, the breach importing them; their values pinned as literals. `wb13e.json`'s and `wb8c.json`'s records re-aimed |
| L2-10 | The corpse's frame upload was unpinned | FIXED: pinned. One mutant dead |
| L2-11 | The shake pin put the prefs back to none, not as it found them | FIXED |
| L2 extras | 14 extra mutants survive and cannot change behaviour (each proven by L2: the smallest lord's drawn size, the only callers' clocks, a 1 ms boundary the gate uses too) | NOTED, equivalent; no code added for them |
| L3-1 | "each [number] grown by the lord's drawn size" (record, module, index, test, commit): three are | FIXED in the record, the module's header, the index and the test's header. The commit message (67d2a0eb2) is history: LEFT |
| L3-2 | "Two lights for 2.4 s a fall" (the flash stands 0.4 s) | FIXED |
| L3-3 | The DFU sentence cited DaggerfallEnemy and named none of the beats DFU's death does have | FIXED: `EnemyDeath.CompleteDeath` cited, read at DFU's master - `SetActive(false)`, `CreateLootableCorpseMarker` in the corpse picture, `SoundClips.BodyFall` where it lies - and the departures named. No Ledger A row (the lords are no DFU foes; WB13's precedent) |
| L3-4 | "Not seen ... the lords are the player's ARENA2 sprites, which no lab ships" - against CLAUDE.md's freeware rule: the data was fetchable, and the lanes read it | FIXED: the real-data pin; the record says what was not seen and why (a breach needs a relay and a company) |
| L3-6 | "(10, through egFight's own draw path)" - seven were | FIXED: 20 now, fourteen through it |
| L3-7 | `egFallTallM` called "how tall it stands" - it is the Warden's `BOSS_H` grown | FIXED |
| L3-8 | "`WHITE` is now exported" exported `WRATH_RED` too, unused | FIXED: `WRATH_RED` unexported |
| L3-10 | Test titles' mutant lists name 27 of 37 records | LEFT: a title summarises; the list is the record |
| L3-11 | THE FOUR HOSTS said in a parenthesis, not the page's form | FIXED: `**The four hosts.** None touched (HOST-SPLIT).` |
| L3-12 | EG-ZJ's "A lord's flags fallen lay it down at once" reads as the picture | FIXED: EG-FALL says what it meant (EG-ZJ's record is history) |
| L3-13 | Patch notes belong in the pull request's description; none is open | NOTED: written when the pull request opens |
| L3 gate | `egz_return.test.js` "EG-ZD THE SPANS' CLOCK" failed once in `test:changed` (passes alone 3/3; its clock reads the real `performance.now()` within 50 ms on a saturated machine) | LEFT: not this change - no clock code moved |

## The whole suite, after the fixes

`npm test` on the fixed tree (00ae7136a): 32,699 tests, 32,327 passed, 3 failed. Two were audit24's ONE HOME
(`test/systems/talk/audit24_onehome.test.js`): the gate's chest share was first named `GLOW_SHARE`, which
`systems/lightning.js` declares for its own - renamed `GLOW_UP_SHARE`, both pass. The third, `sd25_arena.test.js`'s S7 (the
Hour's arena makes nothing a frame, a heap measure in a child), passes alone on an idle machine: a measure under the whole
suite's load, not this change (the spark pass's draw allocates nothing new).

## What it checked and found sound

- **Clocks.** The fight's clock is the link's (the corrected shared clock). For a fight's last lord, `efl` and `efell` fold in
  one batch, so no frame sees the screen's stamp. A screen joining, reloading or coming back from a hidden tab after the
  fall replays nothing (the row's `sa` is the relay's instant - its lords' step skips a lord with no health, so a fallen
  lord's `sa` is never rewritten). A fall ahead of the screen's clock waits for its moment.
- **The shapes.** The Twins' raise and second fall, also unseen between two frames; Seyth's mirrors leave by `edie` and never
  fall; a hidden lord cannot be struck or tick, so cannot fall hidden; feet off the hall's 0 height; several falls at once
  (16 burst slots hold two).
- **Lifetimes.** The corpse is freed on a raise, on leaving the fight's bodies, at a new hall and on leave; the standing body's
  batch is kept undrawn while gone, as the gate's is; per-frame allocation lower than before (heap profiler: lying 2,635 +
  275 B against 3,270).
- **GL state.** The spark pass puts back cull, depth writes, blend and its arrays; every later pass sets its own.
- **The gate's parity.** Timings, the news rules, the shake, the column, the glow and the flash match `fallEvent`,
  `bodySounds`, `bossGlow` and `lights`.
- **The records.** "FACT at 8089d374f" (the old branch, its 1.2 s, its fourth frame); the 16.2 row; the Look page's
  sentence; the ledger row's placement; no other page describes a frozen lord.

## What it could not check

The fall on a running screen: a breach needs a relay and a company. A corpse at a real court's edge (corpses run to 11.4 m
wide, the Wyrm's, centred on the feet, as at the gate). The real renderer drawing a corpse whose frame was never uploaded
(the upload is now pinned).
