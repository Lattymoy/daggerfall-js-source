# AUDIT FB1030 - FIELD BUGS 2026-10-30b read cold, 2026-10-30

The owner: *"Audit this"*, of FIELD BUGS 2026-10-30b (`../bugs/Field-Bugs-2026-10-30b.md`) at `6a38e6c1e` against its
base `b793e26e1`. Five cold lanes read the change in a frozen worktree, each given the files and the reports, never a
conclusion. Each finding was reproduced with a probe on the real code and the freeware's data, and checked again here
before it was fixed.

| Lane | Read | Found |
|---|---|---|
| ZONE | ZONE-BANK, SPAWN-PLATE, RECORDS-SAID: every bank window, every plate, every shelf | 3 |
| NET | INDOOR-FLOOR and CAPE-AURA (withdrawn at the merge for main's AURA-STAYS): every reader of a peer's height, the wire, a redeploy | 5 |
| DOOR | CASTLE-TALK and TALL-DOOR: every person flat in the RDBs and the copies, every way out | 3 |
| YARD | WALL-TOUCH and YARD-DECK: every home model's walls, decks and stairs | 8 |
| RECORD | the record against the code, the suite and the bible's rules | 13 |

Each fix in code carries an `AUDIT FB1030 <id>` comment and a pin that fails on the code as it stood. Mutants:
`tools/mutants/fb1030_fieldbugs.json`, all dead.

## ZONE

**Z1.** Past the Bay a found spawn inside the Overworld's grid spent one of the twelve found slots, and SPAWN-PLATE took
its place plate away: past the twelve nearest it had no plate at all (4 of 16 at the report's pixel). A spawn inside the
grid, found or not, spends no slot (`travelDungeons.js` inGrid). **Z2, Z3.** Two stale lines of the record: the Hall's
old words in `06-Systems/Online-Arc.md`, and a probe run said to be recorded that was not.

## NET

**N1.** A peer's corpse indoors, and the party's mark of where a body lies, dropped `fy`: the body lay sunk or
floating, and Resurrect could not pick it. Both keep it (`remotePlayers.js` addCorpse, `indoorFloor.js`
keepIndoorFloor). **N2.** The point a peer's blow lands was drawn off the floor; it rides the pose's `fy`
(`peerFx.js`). **N3.** `poseChanged` was blind to `fy`, so a standing peer kept the old height through a relay
redeploy; world293 was re-hashed in place, undeployed (world296 since the merges of main). **N4, open.** Foes indoors and the zone's remains are still their
owner's height; a peer and its foe can now disagree by the rooms' difference. Recorded in the field bugs' section 5.
**N5.** A comment moved off its line in `online.js` lerpPose.

## DOOR

**D1.** Alinor, Falinesti and Helstrom copy Castle Daggerfall's halls and dropped its foyer guard (his faction id is
his action's bytes), the one opener of the doors the court stands behind. A copy keeps a person whose action heads a
chain (`capitalCastles.js` chainHead). **D2.** DFU fires a person's own action and talks on one press; 28 of the
people's relays rang a sound that way (the faction id's high byte read as the action's index). The port now only talks;
said in Port-Ledger A. **D3.** The record's claim that ARCH3D's 19.2 m doors stand on the Bay was false (they stand
inside S0000003); the Bay's tallest way out is a crypt's 3.2 m door, 0.7 m up.

## YARD

**Y1 (blocking).** A lot with no measured walls - an Imperial City house with no court, its door's box - took pieces
again: the 0.25 m erosion swallowed a box thinner than 0.5 m. **Y2.** Every part of a house thinner than 0.5 m (a 0.4 m
post, a fence, a wall strip) could be stood through. **Y4.** The erosion cost up to 17 ms a frame beside a large house.
**Y8.** 22 lanterns on outside walls were still refused, and a chair could reach 0.4 m through a wall.

All four had one cause, and WALL-TOUCH now asks each model's ground floor's own wall lines: a point is the house only
past them by more than the wall's clip. Ground outside the walls (a step, a post with none, a joined lot's mate) is met
5 cm in, as before; a lot with no parts known is the house wherever met. A flat's ground is the circle of half its width.
Measured on the 307 home models: 2 of 6,515 hung lanterns refused, 0 chairs by the real placer on 237 diagonal walls,
0 of 340,120 chairs deep inside allowed; the worst check 0.5 ms, and none while the ghost stands still.

**Y3.** An open flat roof beside a storey whose outer wall is one face from the ground was cut as under the storey (606,
552, 343, 340's loggia). A storey is now any walls standing a metre over the deck, and a piece's point is judged by
those walls' lines.

**Y5.** A tall model's origin stood over a deck while its foot stood under it; the foot is read
(`foot.bottom`). **Y6.** An outside stair's treads and landing were decks (709 and kin); a deck under 4 m² is none.
**Y7.** A test title said a roof over a deck made it none; nothing did. A covered loggia is a deck, as "every flat roof"
reads. Measured: every chair wholly on the decks of 541, 529, 538, 614, 249, 607, 608, 606, 340, 552, 343 and 240
stands; 6 of 65,835 chairs inside a storey at deck height stand (one model, 227, whose walls do not close).

## RECORD

**R1 (blocking).** The suite was red on the branch: Y1's pin, and five world.js slices mounted by `holdshared`,
`wagons2_visit`, `auditmergeplus_plus` and `auditlandforms` that knew no `withIndoorFloor`, nor the pose line's new
text. They were given it, and the landforms seam names the line. Read again here: DECOR-FIGURE's turn pin, the L10N4
map, a type in `peerFx.js` and ten mutant records the change had moved were stale too; all are mended. **R2** is D2,
**R3** is Z3.

**R4.** A turn measured a flat by its diagonal, and a piece already refused turned freely. A flat's ground is a circle,
the same turned, so its turn is refused only for something new; a model's turn whenever its turned box is refused
(`decorTool.js` turnPlaced).

**R5-R13.** The 19.2 m doors (D3). The deck count, re-measured by a stated method. King Gothryd was one of five people
who still answered, and one of the castle's 21 shows text. YARD-CORNER's touch record dies again on a box lot. Two stale
comments. Three translations of `wild.bank.shut` (bg, de, fi) now say what `wild.safe.*` says. CI holds no ARENA2, so
the real-model cases skip there; every law is also pinned on synthetic houses. The ledger row's files. The probe's
header.
