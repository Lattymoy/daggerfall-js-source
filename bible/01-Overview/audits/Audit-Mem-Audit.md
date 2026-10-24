# AUDIT MEM-AUDIT (2026-10-23) - the memory pass and the Graphics preset, audited cold

The owner, of MEM-AUDIT (`07-Rendering/Performance-Priority.md` MEM-AUDIT, the answer to *"Can you do a comprehensive
performance audit, looking for memory leaks, any outstanding issues and improving overall performance without impacting
fidelity. Also dig into the performance settings ... ensuring they are perfect"*): **"Audit this"**. This page is the
findings, each with its verdict. What the audit changed is written into the record's section as it now stands, each change
under its finding's id (AUDIT M1 and on), and the code says the same at every site.

## How it was run

Six lanes, each a cold adversarial reader of the change at 9bf6d7c67 (MEM-AUDIT's five commits over 4728fb88a), told to
reproduce every finding - a probe and its saved output - before reporting it, to cite the code by its text, and to fix
nothing. They read A FROZEN SNAPSHOT (a detached worktree of 9bf6d7c67), never the working tree, so Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING held while the findings already in were fixed in the tree.

| Lane | Over | How |
|---|---|---|
| M - the memory law | the merge's spend, `setMode`'s latches, the snow's idle prune and drop, the fishing host's `dropped`, the classic sky's bound and `forgetBytes` | node probes driving the real modules against the base (`git archive`): the sky controller over a stub GL with no IndexedDB, the snowfall runtime over SNOW-HOLD's streaming world with an object-graph walk for destroyed tiles, the merge's bytes in six shapes |
| C - the cover index | `fileIn`, CELL_EXACT, `_mark` at birth, every proxy maker | a fuzz of 12,000 sequences against the base index (1.73M rays bit for bit, 650k body queries in order), V8's maps and IC logs, `--trace-gc-nvp` over a 121-pixel build shaped to the census, heap per cell, mutants |
| U - the windows and the net | the walkers' outfits, the menus' sky, the market's cache, the account card, the item menu, the icons, the billboard indices | A/B probes on base and head: the local body and a peer in one outfit over one renderer, thirty walkers after a hidden minute, 15,262 sky draws byte for byte, 2e7 hypot pairs |
| G - the Graphics preset | `PRESET_PARTS`, `presetNow`, `applyGraphicsPreset`, every Graphics row's words and reader | the settings screen in Chromium (its states and screenshots, German too), node semantics probes, the cost of Steady shadows off simulated over 3,000-frame walks, mutants |
| P - the pins and the record | `memaudit.test.js`, the moved pins, every recorded mutant, the bible's every number | 73 mutants of its own, the recorded and re-aimed records, the bible gates, the suite at head and base |
| R - the real game | the snapshot and the base in Chromium on the freeware ARENA2 | the live heap after collection at the same settle, walks and doors |

**WHAT THEY FOUND.** Lanes M, C, U, G and P: 37 findings, three of them one defect met by a second lens (written `= M1` and so on), so 34 defects; lane R four more. Every one is fixed, pinned and named below, or left and said.

## M - the memory law

- **M1 HIGH - the classic sky went to the gradient in a memory-only session.** `forgetBytes` deleted the only copy of a
  SKY file a no-IndexedDB session (the ingest's no-IDB arm: private mode, a quota's refusal) held, and its next read 404'd.
  FIXED: `forgetBytes` lets go only of bytes `getBytes` read from IndexedDB or the network (`readAgain`); the ingest's arm
  is `keepOnlyInMemory`, never forgotten. Pinned (`memaudit.test.js`, the classic sky), mutant MA-M1-the-only-copy-forgotten.
- **M2 LOW - a missing sky file asked again.** The lean diet's "missing" memo was evicted with the files, so each return
  refetched (a 404) and warned. FIXED: `skyMissing`, kept apart from the bound. Pinned, MA-M2-the-missing-let-go.
- **M3 MEDIUM - the mid ring held destroyed tiles through a journey** (up to four pixels' entries). FIXED: `_midLetGo` on
  the idle prune's schedule. Pinned (the snow pin's mid ring, a build under way too), MA-M3-the-mid-ring-kept and
  MA-M3-the-mid-build-kept.
- **M4 LOW - the idle prune asked for the ring every frame.** FIXED: the schedule read first. Pinned (twelve asks at most
  in 1,500 idle frames), MA-M4-the-ring-asked-a-frame.
- **M5 NOTE - a tile leaving the ring while idle and coming back is rebuilt.** Cannot happen in the shipped hosts (world.js
  lets a pixel go as it leaves `terrainDistance`, the ring's own radius; exterior.js stands one tile). Left, said.
- **M6 NOTE - the builder's contract changed** (a second `finish()` answers null). No caller notices; the merged bytes
  are identical in all six shapes. Said in `_spend`'s comment.

## C - the cover index

- **C1 MEDIUM - the pins did not hold the main saving.** A cell of one pushed from `[]` (17 slots), the bodies' grid or the
  wide grid pushed again, all survived. FIXED: the pin checks copy against push on all three grids, fills in a seeded
  order so each grows across slices, and measures a cell of one on the heap in the measuring child (ALLOC-RACE; ~118 B against ~246 pushed, the bar 180). Mutants
  MA-C1-a-cell-of-one-pushed-from-empty, MA-C1-the-bodies-grid-pushed, MA-C1-the-wide-grid-pushed.
- **C2 LOW - the pins checked `_mark` existed, not one shape.** `jungleBody` without it and `_mark` first both survived.
  FIXED: every maker's keys deep-equal in order. MA-C2-the-mark-born-first, MA-C2-a-jungle-body-born-without-its-mark.
- **C3 LOW - the cell loop went polymorphic** (packed `[it]` beside holey `new Array(n + 1)`); no cost measured. FIXED:
  `concat`, packed and exact - one array shape, as before.
- **C4 NOTE - the words.** Seventeen slots, not sixteen; the property store is a map transition and an out-of-line array,
  `fill` still zeroing the mark. FIXED in the comments and the record.
- **C5 NOTE - the fill's ~2x is mostly the collector's work that landed in it** (825 -> 595 MB allocated, 463 -> 233 MB
  promoted over a 121-pixel build; its own work ~15% less). Written in the record.
- **C6 NOTE - 20,000 sight rays 7-23% faster, the same checksum.** Holds.
- Outside the change, the same at the base (NOTE): `near()`'s stamp, bumped once a set with bodies, widens every `_mark`
  to a double after ~1.07e9 (hours of play); `hit(..., Infinity)` would loop, and no caller asks it. Left, said.

## U - the windows and the net

- **U1 HIGH - a peer's outfit let go took the local player's own sprite with it until a reload.** The peers and the local
  body draw the same layered pictures under the same keys on one renderer, and the store's eviction reached them; COATS1's
  horse looks had the same unguarded law, both ways. FIXED: what the store may let go it uploads and draws under records
  of its own (`PEER_OWN_REC`). Pinned (every upload and eviction the store's own), COATS1's pin moved;
  MA-U1-the-shared-record, MA-U1-the-outfits-shared.
  SUPERSEDED AT THE MERGE WITH MAIN: main's PEER-ART (AUDIT FB1022d) met the same leak from the field and re-uploads a
  texture another store let go, both ways; its law stands, this fix and its pins and records were dropped for it.
- **U2 MEDIUM - walkers in view vanished together after a hidden minute.** Idleness by the clock, checked inside each
  `ensure`: the first walker noted after a gap let the rest go one by one. FIXED: counted in the walkers' syncs
  (WALKER_OUTFIT_IDLE_SYNCS), settled once at a sync's start - which also ends the per-walker sort a crowd paid each frame
  (U2's LOW). Pinned (a crowd past the cap in view, kept; the sync settles first, once), MA-U2-the-outfits-by-the-clock,
  MA-U2-settled-at-no-sync, MA-P5-*.
  SUPERSEDED AT THE MERGE WITH MAIN: PEER-ART's sweep lets a look go only undrawn two frames and RIDER_LOOK_IDLE_MS,
  once a frame after every layer drew - a hidden tab ages nothing. This fix, its pins and records were dropped for it.
- **U3 LOW - the market dropped a view the player came back to after 70 pages, and its stale fallback.** FIXED: 256
  kept, the least recent first - a read, a `cached()` and a write each the newest. Pinned, MA-U3-*, MA-P6-*.
- NOTE: a decode rejected after an eviction may delete its successor's cache entry - an extra decode, nothing seen. Left.
- Sound: the menus' sky byte for byte (15,262 draws, the hypot bound in V8, JSC and fdlibm), `outfitOfLayeredKey` over every
  key the producer mints, the horse looks otherwise unchanged, the account card's listeners, the item menu's timer, the
  icons' WeakMap, the billboard indices.

## G - the Graphics preset

- **G1 MEDIUM - a part off its default read Custom on a tab that said nothing was changed.** FIXED: `itemChanged` walks a
  row's parts, as `featuresDefaults` does. Pinned (org2's G1-G6), MA-G1-a-part-unmarked.
- **G2 HIGH, before this change - High and Ultra could not be chosen off the enhanced outdoors or on the classic skin**
  (land view reads DFU's 1..4 there), and Low left the enhanced lane's store at 5. FIXED: a preset compares a row through
  its lane's `readOf` (`landViewAsRead`), and writes a lane's row whole. Pinned; RF4's and org2's apply-line pins moved;
  MA-G2-the-lane-unread, MA-G2-a-lane-row-skipped, MA-G2-the-cap-unread.
- **G3 LOW - the pins were partial**: the screen's own read and the cost order of five rows unpinned. FIXED: the bar as
  drawn (`graphicsPresetRow` on the test document) presses the preset; every row and the part in cost order.
  MA-G3-the-bar-s-read, MA-G3-medium-s-clouds-high.
- **G4 LOW - the row's search words were a fixed list.** FIXED: its note, its effect and the rows' titles. MA-G4-the-words-fixed.
- **G5 LOW - the row was English in every language.** FIXED: its name, note, effect, Custom and four labels through
  `t()`, drafted for the twenty languages that hold the catalog (`tools/l10nInSession.mjs`); L10N4's ratchet 60 -> 58.
  Left, said: the Real windows row and the Steady shadows part's label (RW1's, FLICKER-FIX's).
- **G6 LOW - the row never said when it takes effect.** FIXED: "Steady shadows and the windows change at once; the rest
  when the world next loads." MA-G6-no-effect-said.
- **G7 NOTE - the words** ("the one knob...": render scale's note says so too). FIXED in the comment, the spec and the
  record. The apply's online guard is dead today (`steadyShadows` is the player's online) and kept, the read's twin.
- **G8 NOTE - off on Low is a sound trade**: read live each frame, EL8's schedule back, a few more caster swaps (11 -> 13
  over a 3,000-frame walk); the pop FLICKER-FIX ended is Low's to accept.
- NOTE: `tools/enhancedMenuProbe.mjs` is stale against the front door (its doors moved before this change). Left, said.

## P - the pins and the record

- **P1 HIGH - MAC1 A failed at the head.** The mount's added release pushed MAC1's 1,800-character window. FIXED: the
  mount's release removed (the repaint, the close and the unmount let the card go; a detached card's listener already
  removes itself on the next focus).
- **P2 HIGH = M1.**
- **P3 HIGH - the blanket's GPU free unpinned** (the pin never ran a sync), the replaced tile's drop and an idle build's
  tile too. FIXED: the pin clears the dirty set as a sync would, promotes a tile over its own, and goes idle mid-build.
- **P4 HIGH = C1, C2.** The record MA-a-cover-cell-pushed-from-its-first was misnamed (it left the first filing exact):
  renamed MA-a-grown-cover-cell-pushed.
- **P5 HIGH - the walkers' idleness unpinned.** FIXED with U2's pin: a crowd drawn each sync, none let go.
- **P6 MEDIUM - the market's cap and order unpinned.** FIXED: exactly 256, the least recent first, a read's answer landing
  late written as the newest (a held door).
- **P7 MEDIUM - text pins where the behaviour could be driven.** FIXED: the account card driven (its listener made, then
  let go); the item menu's pin holds the timer as the menu's own; the close's release pinned.
- **P8 MEDIUM = G3.**
- **P9 MEDIUM - the menus' sky reused a wrong-size image on a one-side resize** (unpinned), and LOW: its cache kept the
  loading screen's still a session. FIXED: one side at a time in the pin; `keep: false` for a one-off draw.
- **P10 MEDIUM - an unnamed departure from the Snowfall mod** (its Tick prunes nothing while inactive). FIXED: named in the
  record and in SNOW-HOLD's Port-Ledger A row, narrowed.
- **P11 LOW - false or stale words.** FIXED: the commit's counts (corrected in fade318d7 and here), the per-frame arrays,
  seventeen slots, `outfitOfLayeredKey`'s record and frame, the profile's 812 MB, Features-Arc's five rows, and the black
  screens' claim struck.
- **P12 LOW - the host grew, unrecorded.** `createWorldModes` 10,974 -> 10,985 logical lines under its 10,998: recorded.
- **P13 LOW - a player who pressed Low before reads Custom** until they press it again: recorded, and in the patch notes.
- **P14 NOTE - equivalent survivors** (the spend before the shadow cells, the building guard, the fog's boundaries, a name
  already upper-case) and the base's own unpinned winding swap. Left, said.

## R - the real game

Both trees booted in Chromium (SwiftShader) at Knightstale, Wayrest, 15:00, no foes, on the freeware ARENA2; the heap
read after `HeapProfiler.collectGarbage`.

| Run | Tree | Settle (MB) | Settle + 60 frames | Walk peak | Back at the start |
|---|---|---|---|---|---|
| baseA | base | 1,175.7 | - | - | - |
| baseB | base | 1,164.0 | 1,164.5 | 1,219.7 | 1,193.8 |
| snapA | snapshot | 1,016.8 | - | - | - |
| snapB | snapshot | 1,017.4 | 1,017.5 | 1,071.2 | 1,047.1 |

The change holds about 147-159 MB less at the same settle with the same GL objects (textures 1,383 / 1,384, buffers
1,729 / 1,732), and the walk's peak 148 MB lower.

- **R1 NOTE - the walk out and back grows the same on both trees.** Ten pixels east and back: +29.8 MB on the base,
  +29.7 MB on the snapshot, textures 1,384 -> 1,573 and 1,383 -> 1,569. The change neither causes nor cures it; what it
  holds is not traced here. Left, said.
- **R2 NOTE - the doors.** Three GENRAS04 interiors entered and left three rounds each on the snapshot: 1,043.5 ->
  1,046.8 MB over nine round trips (about 0.4 MB each), buffers flat after the first round, textures 1,606 -> 1,614 over
  the last two. No error in the page (`errors 0 []`). Small enough to leave; said.
- **R3 UNRESOLVED - one page crash.** snapA crashed at +941 s while the sampling profiler ran; baseA finished the same
  profile at +905 s. snapB (2,170 s) and snapR (2,848 s) ran the same tree longer without a crash, and both trees crashed
  under a full heap snapshot earlier in the session. Not reproduced; not shown to be the change's. The lane was stopped
  before its last base run finished.
- **R4 NOTE - PIXEL MISMATCH.** The walk's driver reached a neighbouring pixel on both trees (baseB at back0, snapB,
  snapA twice). The probe's, not the game's. Left, said.

## The pins and the mutants

`test/systems/memaudit.test.js` 11 tests (13 before the merge with main dropped the walkers' two); `org2_options.test.js` the G1-G6 test and its moved pins; COATS1's, RF4's and
L10N4's moved (COATS1's back to main's at the merge). `tools/mutants/memaudit.json` 57 records, all dead (65 before the merge dropped the walkers' eight); `org2.json` re-aimed by
content, dead (`audit_flicker.json` main's again).
