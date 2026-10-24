# FIELD BUGS 2026-10-03c - the city walls' corners shut

A Discord bug report of 2026-10-03, handed over as a screenshot: *"Missing Walls in Alik'ra"* (Mefwhesk: "Looks like
there's some missing holes in the out walls of Alik'ra", with the town map and a corner tower standing apart from its
wall), and under it Fay: "Saw the same thing in Chesterwark. I assume it's a general issue" (a dark stone wall open to
the town). Handed over with "Think these are issues with the beautiful cities/beautiful villages integration". It was -
Beautiful Cities, and the one piece of it the port had listed as needing nothing. The fix is pinned by tests that fail
on the record's own code (a0d3e9e0a), the new pins mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "missing holes in the out walls of Alik'ra" / "the same thing in Chesterwark" | Beautiful Cities closes the 128 units between each corner tower and its walls' first segment with the RMB Resource Pack's wall piece `53210`, which the port stood nothing in for - recorded as "every one against a classic wall that already stands"; every corner of 364 of the 410 cities stood open | CITY-WALL |

## CITY-WALL (1)

`world/townStandIns.js` (`CITY_WALL_PIECE`, `CITY_WALL_MODEL`, `CITY_WALL_FILL`, `sliceModelX`, `cityWallFillModel`, its
registration in `installTownStandIns`). Read off the vendored pack, no game data needed:

- **Where the piece stands.** All 224 placements of `53210` are in the corner blocks the author made, `WALLAA12` to
  `WALLAA15` - none of them a Daggerfall block - in the 112 composites built on them (`WALLAA12.FARMAA00` and the
  rest), two to each: one on each wall line, alone in a subrecord of its own (a `House5`, quality 10), on the
  subrecord's origin, sunk one unit (`YPos` 1), unturned in itself.
- **What it closes.** Each corner block stands its corner tower (`444` at (48, -50) in a subrecord 64 units in from
  where its two wall lines cross on both axes - exactly where Daggerfall's own corner blocks, `WALLAA00` to `03`, stand
  theirs: (3712, 3712) there, (512, 512) here). Daggerfall's walls begin at the block's edge, 448 units along each line
  from that crossing, so 448 is the tower's edge. The author's lines run a 445 every 1024 units from the tower's
  subrecord, so the first begins at 576. The 128 units between are the piece's: worked through RMBLayout's transforms
  (the port's own `trs`, Unity's rotation), each piece's local `(128 +- 64, 0, 128)` lands on its line at 448 and 576
  from the crossing. That holds in all four corners and both turns of the piece along a line (local `+x` toward the
  corner or away from it), which fixes the two numbers: the piece's wall stands 128 along its `+z`, its gap centred 128
  along its `+x`.
- **Who sees it.** 364 of Beautiful Cities' 410 cities stand 633 corner blocks between them - 1,266 openings, each 3.2
  metres of wall the full height of the wall, wide enough to walk through. Alik'ra stands three (`WALLAA13.FARMBA01`,
  `WALLAA14.FARMBA13` twice), Chesterwark three (`WALLAA12.FARMAA01`, `WALLAA13.FARMAA04`, `WALLAA15.FARMAA01`). The
  town map was not wrong: it draws each block's own automap bytes, the author's, which close the corner
  (`WALLAA12.FARMAA00` read).

DFU without the RMB Resource Pack draws nothing there either - the piece is a peer's, as the port's other stand-ins'
pieces are - so the stand-in is the port's, as theirs are: **the middle 128 units of Daggerfall's own wall segment
`445`, out of the player's ARCH3D**, cut (`sliceModelX`: every triangle clipped to the slab, positions, normals and uvs
interpolated on the cut, the winding kept) and moved onto the piece's line - 128 along `x` and `z` - and lifted the
unit the piece is sunk, so it is the wall's own stone, profile, height and climate, and solid (the pipeline keeps a
custom model's triangles for the collider as it does the 445's). It is a custom model with a need
(`registerCustomModel(..., { needs: [445] })`, the colosseum's door): the pipeline loads the 445's pictures, then hands
the build the 445 through `ctx.classicModel`; a build asked without it (the dungeon pre-pass, which never meets the
piece) answers null and keeps nothing. Behind the towns' switch, as every stand-in. The bank's market still sells none
of the 224 `House5` records: it prices a house by its ARCH3D record's radius (`houseMeshRadius`), which a stand-in does
not give; no door is drawn on it, so no tooltip names it.

The four hosts: `scenes/world.js` and `scenes/exterior.js` build every exterior model through the pipeline's
`getGpuMesh`, which hands the 445 over - both stand the piece and collide with it, no host changed; `scenes/worldModes.js`
(interiors) never meets it - it is an exterior subrecord's model; `scenes/dungeonContext.js`'s pre-pass asks the registry
without a context and would read GetModelData's false, but no dungeon block places it.

The tests: `test/world/fb1003c_citywall.test.js` (5) - the law off the pack (224 placements in 112 corner composites, two
each, alone and sunk a unit; in all 224 the two pieces' own lines cross 64 units from the corner tower's subrecord on
both axes, and each piece fills 448-576 off that crossing; the 210 on lines of the author's own 445s with every 445
beginning at 576 + 1024k, 147 of them abutting one at 576); the stand-in from a stand-in 445 (its bounds, its picture,
its winding, the cut faces' uvs where the wall's own were, nothing without a 445) and at its cuts (below); the install
(behind the switch, its need the 445, a build without the 445 never kept); and the real pipeline building it out of a
fake ARCH3D's 445 for the renderer and the collider. `test/world/wd3_standins.test.js` reads the new shape: `53210` off the
not-stood-in list, 225 stand-ins in the ARENA2 coverage, and its ARENA2 door sweep handing the build the player's 445.
`tools/mutants/citywall.json` (10, all dead).

**Not verified here.** This tree has no ARENA2, so the ARENA2 half of `test/world/wd3_standins.test.js` - the coverage count
and the sweep that no stand-in walls up an exterior door - did not run with the piece in it; nor was it seen rendered.
Two things only the player's data can show: the 14 placements whose line is all Daggerfall's own segments (read by
reference, `$c`, from `WALLAA04`) meet a segment at 576 only if that block's wall is the same 445 (their span and their
tower are read from the pack); and the tower's edge at 448 is read from where Daggerfall's corners meet their walls,
not from `444`'s own mesh. **Said, not fixed:** a
quarter of the placements - the `WALLAA12` and `WALLAA13` pieces on their north line, 56 - turn the piece the other way
across the wall, as the author placed them, so there the 445's inner face is the one that looks out.

## AUDIT CITY-WALL (2026-10-04)

Mac: "Audit and ensure any other areas arent broken also" - four lenses over this page's change and the three that
rode with it (DEATH-TENTH, TRAVEL-ONLINE, RATIONS-HUNGRY; their findings are on their own pages). For the wall:

- **S1 (fixed): a face lying ON a cut was dropped.** A model's positions are float32, so a vertex meant to stand at
  x = 1.6 m (64 units) stands at 1.6000000238 - outside the slab by 2.4e-8 - and every face on either cut went,
  whichever way it looked. A merlon the cut ends in lost its end face and stood open to the eye. `sliceModelX` now reads
  a vertex within `SLICE_ON_PLANE_M` (1e-5 m) of a cut as on it, and keeps a face wholly on a cut only when it looks
  out of the slab (the slab's own end) - the outside's face that looks in would stand over the gap beside the cut, so
  it goes. Pinned: the fifth test (four merlons with their sides on the cuts).
- **The law now reads all 224 from the pack.** The two pieces of a corner block run on two lines, and their crossing is
  64 units from the corner tower's subrecord on both axes in all 112 blocks - so every piece's 448-576 is checked
  without ARENA2; 210 stand on lines of the author's own 445s. The count of the unread placements above was wrong (28;
  it is 14) and is corrected.
- **Notes, not changed.** Each piece's `House5` subrecord now stands a building and a home frame, as every stand-in's
  does: `dfMeshSize` reads ARCH3D, so its hit box is of no size and never hit, and the market still sells none. The cut
  ends are open by design, meeting the tower at 448 and a 445 at 576 where Daggerfall's own segments meet. Every
  consumer of the registry and the pipeline was walked - the build is never kept without the 445, never twice.
