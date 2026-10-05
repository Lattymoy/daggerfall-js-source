# AUDIT FB1005 - FIELD BUGS 2026-10-05 audited, 2026-10-05

The owner, of the batch (`01-Overview/Field-Bugs-2026-10-05.md`): *"Audit this"*. Six lenses read the batch at
`8bf6889f`, each on its own frozen worktree, read-only, verifying its findings before reporting them (a node run for
every claim it could run), with the freeware ARENA2, DFU's source and a clone of the RMB Resource Pack in scratch:

- **the crypt** - CRYPT-SALE and every reader of the home market, the account service, the arena's move;
- **the cellar** - SEALED-CELLAR's measure, its pairing and spots, the runtime curation, the design choice;
- **the hills** - HILL-SHAPES' mesh and orientation, every consumer of a hill, the doctrine;
- **the rest** - DEATH-HOLDS and DUNGEON-BEDS;
- **the shore** - SHORE-CAST's frame, its act's lifetime, every water it must still fish;
- **the tests and the record** - the pins (23 extra mutants of its own, every touched file's existing records re-run),
  every claim of the record and the ledger.

Nothing was fixed in the snapshot (Home.md, 17l); the fixes went to the branch while the lenses read their copy. The
full suite on the batch's head had already found two of the tests lens's majors (T1 = R1, T2 = W1) before it reported;
they landed at `7f391f72`. Each fix carries an `AUDIT FB1005 <ID>` comment and is pinned; the six mutant lists hold
**59 mutants, 58 dead and one recorded equivalent**, every survivor the lenses found among them.

## Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 = R1 | MAJOR | DUNGEON-BEDS moved REST6's source pin on the dungeon's rest point (`test/rest6_consumables.test.js`): CI red, and 30 mutant records of rest6/auditrest read "dead" whatever they did. | The pin re-aimed at the bed-first line; rest6.json and auditrest.json re-run (49 dead, 2 equivalent as recorded). |
| T2 = W1 | MAJOR | SHORE-CAST moved playerGroundSample's body into `groundSampleAt`, and MAC2's pin (`test/roadb_exterior_water.test.js`) still read the old body: CI red. | The pin reads `groundSampleAt`'s body and pins playerGroundSample's delegation. |
| W2 | MAJOR | A cast the gathering host DROPPED (a window, a door, the helm, a pixel's edge, a death) was never ended - `gatherHost.js`'s away/inactive arm nulled it without `cancel()`, unlike every other drop - so `live` stayed neither done nor cancelled and the exemption kept the sand a target until the next cast ended. | The arm ends what it drops (`act.act.cancel()` unless done). Driven through `createGatherHost` with the fish kind: cast, drop, walk up the beach - no target. |
| W3 | minor | The exemption began at `start()`, so a look turned onto the sand while E was held to WIND threw the net there. | The exemption begins at the throw (`phase !== 'wind'`). |
| W4 = T5 | minor | `groundSampleAt`'s body was unpinned: reading the feet instead of the point, or the tile across the wrong axis, survived. | Its body pinned at its point and its tile; two records. |
| W5 | nit | "beach dirt up to 141.9 m" - the 141.9 m sample is grass; dirt reaches 78.5 m. | The record and the test say both. |
| B1 | minor | A bed's night still spent a Bedroll or a Campfire laid within 4 m (`onNightSlept`). | A bed's night spends none; REST2's source pin on the hosts' `onNightSlept` (`test/rest2_campfire.test.js`, which the full suite on the audited tree caught) reads the dungeon's own line. |
| B3 | minor | Beds ignored the fire law's palace rule (AUDIT REST II F2): Castle Daggerfall's and Sentinel's beds were rest points. | `isPalaceLayout` (the fire law's own predicate) - a palace collects no bed. |
| B4 | minor | The 4 m reach passed through floors: five of the 108 beds were in reach from the storey above or below (storeys some 3.2 m apart); the test's "floor above" case was 4.5 m. | The feet within `BED_STOREY_M` (1.5 m) of the bed's foot; the test at 3.2 m, and the reach's sphere pinned (a survivor of the lens's own). |
| B5 = T13 | nit | The tavern import's comment had slid onto the new line. | Moved back. |
| D1 | nit | The dead-but-not-forced revival (a dead online save loaded, the respawn's re-heal) was pinned only by a regex. | A behaviour pin. |
| S1 | minor | TEMPASF0 #7's curated spot stood 0.95 m from its only enter marker: a quest foe at the player's elbow on entry. | A hatch's spot is 1.5 m off the room's entrance (`HATCH_DOOR_CLEAR_M`); re-measured - three spots moved (ALCHAM00 #4, BANKAM01 #1, TEMPASF0 #7), `--check` the measure; pinned with no game data over all 181 listed markers. |
| S2 | minor | Beautiful-Towns' quest-marker bullet still said six designs and 1,105 buildings. | The bullet names SEALED-CELLAR and the totals. |
| S3, S4 | nit | "two rugs on top" (one is turned over beneath); "Daggerfall's 11,452 interiors" was VOID-ENTRY's door count. | Re-worded. |
| S5 = T6 | nit/minor | The clear spot's new test, and every sealed spot, were pinned only with ARENA2. | A unit pin of `clearSpot(p, passes)` over a hand-built floor; every sealed spot within 2.5 m of its hatch, read off the vendored pack. |
| C2 | nit (latent) | The arena's move picked by `homeCandidate` over `buildingSummaries`, which carried no stamp: a displaced House5 home would land in a grave (40 of 40 seeds, simulated) if GEMSAL03 ever held one. | `buildingSummaries` stamps `hasInterior`; `arenaHomeFor` refuses an empty room. |
| C4 = T8 | nit | The stamp reached the door only through the hosts' `...d` spreads, unpinned, and the law fails open. | Both wrappers pinned. |
| C3, C5 | nit | "13,510 exterior doors" (Daggerfall's own: 11,458); HOME2's House5 widening now sells nothing. | The record says both. |
| H1 | minor | `--shapes` printed the table alone and imported the grid from the module a redirect would have emptied - the documented regeneration deleted the module. | The tool measures, then writes the module whole (its header kept), `--bearings`/`--rings` for another grid; regenerated byte for byte. |
| H2 | minor | "0.03-0.32 m" was the median alone, over raised ground: the 90th percentile reaches 1.05-1.34 m, the median fills the hollows (a sheep 0.64 m into the stand-in, two vertices a metre off), and "7.3 m" re-measures 7.55 m. | The record says all of it. |
| H4 | nit | A dozen flats authored on the plane under a hill - which the pack's hill buries - are seated on its slope. | Recorded as the seat's reach. |
| H5 | nit | No pin without game data held the measured data's x-mirror. | The unmirrored mutant names `fb1003b_trees` (25 trees hang). |
| H6 | nit | The hill's foot meets the plane at a grazing angle over 4-81 m2 a hill (z-fight far off). | Recorded; the pack's mesh meets it the same way in DFU. |
| T3 | MAJOR | HILL-SHAPES failed WD3's gated "no stand-in walls up a door" (29 flags). | 27 were the test's bounding box (a hill is a surface): it asks the drawn surface now. The other door is the pack's own - below. |
| T4 | minor | The record's whole-pack claim was pinned nowhere. | A gated sweep of both packs: no classic model the author stood up on a hill hangs a metre over it; a data mutant of Ipsham's hill dies; one table cell no pin reads is recorded equivalent. |
| T7, T9, T10, T11, T12 | minor | The cellar's first test is a fixture check; stale comments (`townStandIns.js`, `rmbrpHills.mjs`); the trees row; 03b's "Said, not fixed" (RETIRING A FLAG DELETES THE SENTENCE); Rest-Arc §0 and §2.1. | Said so in the row; re-worded; the row; the sentence retired; the arc's bed row and reach. |

## Stood, and why

- **H3 - the hills' doctrine (Mac's call, asked).** The stand-ins carry 4,117 numbers read off the pack's meshes (a 16 x
  10 heightfield per hill that keeps each sculpt's footprint), where the docks and domes carry a few dimensions; the
  meshes are `CPT_Mountain_*`, the pack names "Asset creators (maintained by carademono)", and the clone has no licence
  file. Kept until answered; the alternative is a coarser measure (a radial profile and an ellipse a hill, ~15
  numbers) that misses by up to 1.7 m at the median on the lumpiest.
- **T3 - one door the hills wall.** Beautiful Villages' TEMPASD1 stands its House2 #6 inside hills 52458 and 52713:
  10.1-10.4 m of the stand-ins over its door, 10.5-11.2 m of the pack's own meshes - DFU with the pack buries it too;
  the old mound did not reach it. Carried by name in the WD3 test; Mac's call with H3 (a dent at the door would be the
  port's own).
- **C1 - the service checks no room.** A tab opened before the deploy, or a desktop build not yet updated, can still
  claim a crypt until it reloads. A service-side refusal needs the 67 (mapId, buildingKey) pairs - the refund's list -
  and a service deploy; with the refund, Mac's call.
- **B2 - offline, a rest by a dungeon's bed is priced as a bed's** (in Hard: one ask, no stiffness). SURV4's "a bed is
  the sleep", kept and recorded. An elite dungeon halves its fires and keeps every bed.
- **A long throw.** Only the cast's 3 m point is asked; a throw lands 3-12 m out, so across a narrow inlet it may land
  on the far bank.
- **The hatch that opens.** The cellar lens found the author's intent in the data (the 13/14 pair like DFU's 21/22
  ladders, a static ladder by half the hatches, a rug pair dressing both faces) and nothing in DFU or the mod that acts
  on it; the curation stands, and if a hatch is ever built its fourteen entries retire with it.

## Not verified here

Nothing was rendered or played. The lenses' scripts and outputs are in the session's scratch, not the tree.
