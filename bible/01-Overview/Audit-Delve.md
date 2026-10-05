# AUDIT DELVE - the Delve arc, 2026-10-05

The owner, of THE DELVE ARC (`03-World/Delve-Arc.md`, head `be2c41ef` and its merge `7c8596ca`): *"Audit this and take
care of the open items"*. Five lenses read it, each against the code and the tests as shipped: fidelity and doctrine
(A); the dungeon's runtime wiring (B); the modules, their tests and their mutants (C); the map, the HUD and the plaque
(D); online, the party, the saves and the quests (E). Every finding was reproduced before it was fixed (each lens's
probe - a real tick at the motor's speeds, a solid-map paint, a mutant run in a workspace - is named in its row). The
four open items are closed with it (below). Then the real data: MAPS.BSA and BLOCKS.BSA read whole, outside the
repository, which turned DSIZE1 round.

Severity: **Major** breaks what the slice promises for many players; **Minor** a wrong outcome for some; **Nit** a
word, a duplicate or a cost. A finding two lenses made is listed once, under the first, with the others' ids.

## A - fidelity and doctrine

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Minor | The pages said the classic skin is untouched. Two things reach it, both rightly: DETECT-FINDS is SEARCH1's (ungated), and a quest frozen at the medium size keeps its dungeon on either skin, as DFU's frozen Enabled outlives its setting. | The three sentences rewritten (`Delve-Arc.md`, `Active-Arcs.md`, the Ledger A row). |
| A2 | Nit | The echoes row promised the examine "in Info mode"; it rides the World Tooltips label. (D8.) | The note says so, and that the marks are the Enhanced map's. |
| A3 | Nit | The four-hosts table had no DETECT-FINDS column, and gave the wrong reason for flagging the look round indoors. | The column, and the reason: dungeons by scope. |
| A4 | Nit | Values written twice: the glow's budget (`SENSE_MAX`), IsPlaying's depth (`ECHO_CHAIN_MAX`), the eight compass words (the echo's and the angler's), the quest diamond's two strokes, the regenerate body. | `SENSE_MAX = NODE_GLOW_MAX`; `PLAY_DEPTH_MAX` exported by the action system and read by `_isPlaying` and the echo; `systems/compassWords.js sceneCompassWord` (the echo and `fishHost.bearingWord`; the bounty board's map pixels and the fleet's terrain keep their own frames); `paintQuestMark` draws through `paintQuestDiamond`; one `regenerateDungeon` for both sizes (DFU's plus in DFU's draw order). |
| A5 | Nit | `isSecretMover` re-spelled the trigger gate: a mover with the `Door` flag, which only an action door sends itself, was never a secret. | `playerTriggers(o)` reads `TRIGGER_GATE`; `Door` is the player's only on an action door. |
| A6 | Nit | `useSmallerDungeon`, named for DFU's member, no longer fell through to the setting for a state it does not name. | DFU's body restored verbatim beside `dungeonSizeFor`. |
| A7 | Nit | The echo called a secret wall "A door swings". | `echoVerb` by `isActionDoorObject` - the plaque's own law. |
| A8 | Nit | Stale words: Quest.Start's comment, the DT1 row's "three kinds", the medium note on a pre-stamp quest. | Rewritten; the note says a quest from a save older than 2026-08-30 follows the switch (DFU's NotSet). |

## B - the dungeon's runtime wiring

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | Major | **The way out broke at a run.** The trail is sampled at 5 Hz on a 1 m grid; at 5.2 m/s and up a sample skips a cell, the field broke into pieces and the compass fell back to the crow's line through the wall (`auditB/gap.mjs`: an L corridor at 4.43 m/s walked, at 5.2, 6 and 8.1 not). (C1, E3.) | `automapTrailTick` fills the step from the last sample, half a cell apart, up to `TRAIL_FILL_M` (3 m - past it the player was carried: a teleporter, a fall). Pinned through the real tick at `walkSpeed(50)`, `walkSpeed(100)`, `runSpeed(50, 50)` and `runSpeed(100, 100)`, and a stair run at 45 degrees. |
| B2 | Major | **The field rebuild stalled a frame a second while exploring** (18-24 ms at 8,000 cells, `auditB/bench2.mjs`): every key re-parsed, nine template-string lookups a cell. | The cells are parsed once and added to (`trailCells(trail, cells)`, insertion order); numeric column keys (`cellColumn`); the field is built again only when the player stands off it (`WAY_FIELD_S`), every `WAY_REFIELD_S` (10 s) while the trail grows under them, or at once when the trail shrinks, the way in moves or a teleporter is walked. |
| B3 | Minor | A quickload in the same dungeon kept the abandoned run's echo marks (a shut wall glowed "found"), a play heard on the frame the load landed, the look round's glow and the way out's field; the field's key missed a teleporter whose two ends were already walked. (E8.) | `forgetDelveRun` at the load (and the echo half at a joiner's memory); the field rebuilds on a new teleporter. |
| B4 | Minor | "A door swings" for a door a chain only unlocked (or opened when open, or played an effect on). | `onPlayed` keeps what the mover was before its play (`echoState`); the frame echoes only what moved (`echoMoved`). |
| B5 | Minor | The look round ran the namers - the extensions' door among them - with no guard. | A try round the round, one warning; the frame goes on. |
| B6 | Minor | A held mode key's repeats were thirty look rounds a second. | Both key callers ask on the press (`!e.repeat`), as DFU's ActionStarted. |
| B7 | Nit | The found-check emptied the echo book while echoes were off. | Gated on `echoesOn()`. |
| B8 | Nit | The flat rule never reached the context's own flats (loot piles, bodies, an acting flat). (C3.) | `senseFlat(target, object)`: the producer's word, an acting flat, or a billboard by its key - for the look round, the secrets, the echo and the found-check. |
| B9 | Nit | One object could glow twice (an echo found and a sense find), at double light; sixteen look-round marks pushed the echo out of the budget. (D5, C10.) | `senseMarks`: the echo's found marks first, a key once. |

## C - the modules, their tests and their mutants

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Major | B1, found by driving the tick at the motor's own speeds. | B1. |
| C2 | Major | **A mutant the commit called dead survived** (`SENSE1-the-top-not-tried`): the "low wall" blocked rays under 0.15, and the middle ray climbs 0.217. | The wall at 0.3: the middle ray hidden, the top's (0.398) clear. |
| C3 | Minor | B8. | B8. |
| C4 | Major | Seven wayOut mutants survived: the diagonal step, the same column, the step's height, the 3-D snap, the way in a storey up, the way in moved, the reset. | Tests for each: a diagonal walk, a metre against a metre and a half, two storeys within the snap, the feet over the way in a storey up, a moved way in, a reset, a teleporter walked late, the incremental read. |
| C5 | Major | dungeonSense survivors: the pardon's margin, the secrets' reach and cap, the host's merged sort and its flat plumbing. | The merge is a pure law (`senseRound`); tests at the pardon's edge (a wall 0.1 and 0.3 outside), a secret at 8 m and 8.01, the secrets' cap, a near secret against sixteen finds. |
| C6 | Minor | The examine's boxless mover and its `<=`; the compass's followed-first rule lived in the host under a regex. | Tests for both; the rule is `questGuidance.js questCompassPick`, tested there. |
| C7 | Minor | Tests built shapes no producer mints: a quest stand's `box`, literal teleporter ends, a special door with no `moveState`. | The stands as `standQuestFlatIn` mints them through `questStandBox` (TOTEM-CAGE's ride included); `teleporterConnection`'s own record; `ActionSystem.addSpecialDoor`. |
| C8 | Minor | One law, two homes: the echo's ways and the angler's; the pick's pardon; `trailCells` ignored `TRAIL_CELL`. | `compassWords.js`; `activate.js PICK_PARDON_M`, read by the pick's three sites and the look round; `trailCells` on `TRAIL_CELL`. The foot-of-the-box formula (the glow card's and the quest mark's) is two lines and stays. |
| C9 | Minor | The 8-neighbour field never asked the walls: two corridors a thin wall apart were joined, and the way out pointed through it. | The host answers `stepClear(p, q)` - a waist-high ray between the two cells' middles against the dungeon's own geometry (`PROF_VEIN_ONLY`: a door or a mover walked through is no wall), cut only by a wall BETWEEN them (`stepHitCuts`: a hit within `WAY_STEP_END_M`, 0.25 m, of either end is that cell's own wall - the collider meets faces from both sides, and a walked cell's middle can stand up to 0.15 m behind the wall the player kept to) - and each step is asked once and kept, `WAY_STEP_ASKS` (2,000) a build, a long trail loaded whole asked over the builds that follow. A wall at 45 degrees can stand a middle farther behind it than the margin: there a step off the walked line may be cut, and the walked line itself still joins (its steps run along the face). |
| C10 | Nit | B9. | B9. |

## D - the map, the HUD and the plaque

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Major | **The solid map drew every storey's marks with no word of their floor** - laid flat, a foe upstairs stood on the paper spot of the item downstairs (`auditD/solid.mjs`). | An echo or a quest off the floor in view says it: "Ulric · Floor 2" (the teleporter's `to Floor N` idiom). |
| D2 | Minor | You, the way out and a quest on one floor need 30 strip units after the word; the pad is 26 - the quest's diamond stood half off the paper on the commonest floor of all. | `floorStripLayout` stands the words in by the widest row's marks when the pad will not hold them. |
| D3 | Minor | The hover measured to the mark's spot; the diamond stands `QUEST_MARK_LIFT` above it. | The nearer of the two. |
| D4 | Minor | The dungeon sheet has no legend: nothing said what a filled diamond is. | The hover: "Totem of Wyrd - Followed quest", "Ulric - Quest". |
| D5 | Minor | B9. | B9. |
| D6 | Minor | The four sense kinds differed by colour alone: under protan and deutan vision `use` and `find` are one pale yellow. | Each kind its own FORM (`SENSE_FORM`, the glow's `uForm`): a thing to work the halo and its shimmer, a way through a steady halo, a find the motes, a secret the shimmer with no body of light. |
| D7 | Minor | Quest names were in the marks' pen (2.3:1 on the parchment), "Moved" in the beacon's (3:1). | The names' pen (`PLAN_PEN.note`, 10.5:1). |
| D8 | Minor | The notes promised what other rows decide. | A2. |
| D9 | Nit | The way-out arrow and the quest diamond shared a band and stacked at the strip's ends; the pale arrow was 1.26:1 against the letters. | The arrow stands under the strip pointing up into it, a dark body (`WAY_BODY_CSS`) rimmed in the parchment's light. |
| D10 | Nit | The examine measured from the lever and said "above you". | "above it" (`wayWord`'s `who`). |
| D11 | Nit | The flat plan repainted on the echo's beat for an echo on another storey. | `echoesBreathe`: the sheet in view's. |

## E - online, the party, the saves and the quests

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | Major | **A quest frozen small or medium crossed "Bring online" with that layout's markers**: online every dungeon is whole, and a marker is a block's address - the quest item in rock, for the sharer and the party. (Already so for DFU's Smaller; DSIZE1 widened it.) | `questRepair.js relayWholeDungeons`, at the bridge's load online: each dungeon Place of such a quest has its markers enumerated again on the whole dungeon (Place's own enumeration, through the quest's own world), QREPAIR's first step (`putBackPlacements`) puts back what its placements stood, and the stamp becomes Disabled. A Place whose markers come out the same is left as it is. |
| E2 | Major | **A load at another size warped the player but not the world**: the world record's foes and piles by index, acts by place, landed on the other layout. | Saved at another size, the record is left unapplied (`otherLayout`), beside the warp. |
| E3 | Major | B1. | B1. |
| E4 | Minor | Online, Quest.Start stamped the player's own Smaller setting while the room built the dungeon whole - a copy taken offline built it small under full-layout markers. | `smallerDungeonsStateNow` answers Disabled online. |
| E5 | Minor | A quest's markers are chosen through another quest's link (first link wins), but its stamp was the settings: a quest whose markers were whole could stamp medium. | The machine's Start takes the link's frozen size where the medium size is either side (`adoptLinkedDungeonSize`); DFU's own pair is DFU's. |
| E6 | Minor | GUIDE8 dropped a shared quest's foe a party mate's client owns (a puppet), and never marked a dungeon's own quest people. | `questFoeBehaviour` (the share's binding, as `adoptOwn` reads it) and the people list. Indoors, the interior pool's own quest foes are marked; its puppets are not (recorded). |
| E7 | Nit | With the card and the marks off, the tracker was not fed, so Exact's compass only ever took the nearest. | `followOn` counts the Town and Exact tiers. |
| E8 | Nit | B3. | B3. |

## The open items, closed

- **GUIDE8's Town tier.** `quest-guidance` is Journal / Town / Exact. In the town of the building a quest's latest entry
  NAMES (its `_p_` - `ui/questLens.js entryTarget`'s `building`), the held town map rings it found or not
  (`townQuestBuildings`, `ui/townSheet.js`) and the compass points at it (`scenes/world.js townQuestCompassMark`: the
  building's place in the town map's own frame, turned back by the translation and the origin the map opens with).
  Exact holds it.
- **The Exact tier inside buildings.** `scenes/worldModes.js interiorQuestMarksHere`: the interior's stands, its pool's
  quest foes and its people, on the held map's interior sheet and the compass.
- **The street's searched headstones.** Nothing to build: a grave's find is minted as a dropped pile
  (`activateGrave` -> `droppedLoot.dropPile`), and the street's Detect walk carries every pile. Pinned.
- **Seen with real data** - below.

## The real data (MAPS.BSA, BLOCKS.BSA; read whole, kept out of the repository)

- **DSIZE1 was the wrong design.** Of the 4,232 dungeons (14 main story), the sizes are 5 (775), 7 (1), 8 (1,162), 10
  (586), 11 (243), 12 (691), 13 (607), 14 (159), 16 (4), 18 (2), 21 (1) and 22 (1). The first cut's cross touched only
  the 159 over thirteen - and every one of them is four interior blocks in a ring of ten, so the cross drew FIVE
  interior blocks from a pool of four and made them bigger inside. Eight blocks - two interior side by side, six border
  round them - is the commonest shape a dungeon has (608 + 554 of the 1,162 eight-block dungeons), so it is the medium
  size: every dungeon of ten blocks or more but the main story's (2,282 of them; 12 of the 14 main-story keeps are as
  big and keep their size) comes down to it, from its own pools, without a throw.
  Pinned with ARENA2 (`dsize1`, skipped without it).
- **ECHO1's thresholds hold.** 187 RDBs: 434 Direct triggers, 165 MultiTrigger, 104 Collision01; 924 movers, 317 of them
  secrets (`isSecretMover`), 3 special doors among them; 390 chains reach a mover, 0 loop; a chain's length p50 1, p90 2,
  at most 9 (under `PLAY_DEPTH_MAX`). The first mover a press reaches stands p10 3.2 m, p50 14.5 m, p90 41.2 m from it:
  91% past `ECHO_NEAR_M` (3 m), 57% past 12 m. So the echo speaks for most presses that move anything, and "close by" is
  rare.
- **SENSE1 lights what the plaque names.** Of the action band's objects: 279 named by their model, 172 "<Interact>", 148
  silenced by the MultiTrigger rule - a quarter stay dark under the look round, as the mod keeps them.
- Not seen in the game: the glow's card on a wall-mounted lever, the echo's line on a long chain. The look is the
  game's to answer.

## Pins and mutants

`test/dsize1_mediumdungeons.test.js`, `test/sense1_dungeonsense.test.js`, `test/echo1_dungeonecho.test.js`,
`test/wayout1_wayout.test.js`, `test/guide8_questguidance.test.js` (and the pins this pass moved: `audit28`, `ft1`,
`guide1`, `guide5`, `audit39`, `rr3b`, `nodemarks`). Mutation-proven: `tools/mutants/dsize1.json` (26), `sense1.json`
(44), `echo1.json` (35), `wayout1.json` (34), `guide8.json` (34) - 173 records, every one dead (C2's survivor among them,
dead at last); and the 19 records of other lists whose code this pass moved, re-aimed by content and run again, every
one dead (`audit_guide`, `blood1`, `disc22g`, `disc23a`, `em34`, `fb0930b_questresidence`, `fb1004c_audit`,
`fb1004c_robes`, `guide5`, `qrepair`, `survtiers3`).
