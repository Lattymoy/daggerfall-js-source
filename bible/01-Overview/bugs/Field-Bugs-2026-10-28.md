# FIELD BUGS 2026-10-28 - the Bay's towns the morning after #1184

Four #bug-reports threads, posted in the hours after #1184 (TESA) reached players at 11:29 UTC, handed over as seven
screenshots with no word beside them. Each was read to its root on main with the freeware's data
(`tools/fetch-data.sh`), in three lanes: the town ground, Riften's wall, and the Bay's walls. The owner decided two
things before the lanes ran: the Bay's walled cities keep their new walls, fixed, not reverted; and the yards keep the
places #1184 gave them.

#1371 shipped this and deployed on the owner's word. AUDIT FB1028 then read it cold (`../audits/Audit-FB1028.md`); its
corrections are made below, and its fixes are their own pull request.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Lee: Westhead Moor - "Weird crop hovering, giant craters and cliffs on the outskirts.." | TS2's town ground: the sea kept a sample from a town raised over it, an ease of twelve samples whatever the height, the pixel's edge band easing the town's own ground, and a crop field's record tile alone on the outline | FIXED (TOWN-GROUND) |
| 2 | Lee: "the shipyard moved from the North side of town to the West side" | TS7 placed the Bay's yards on the walk grid | KEPT, then MOVED NORTH (WESTHEAD-NORTH, the owner, 2026-10-29) |
| 3 | Pergo: "Can confirm." - a cobbled cliff dropping to the water at night | 1 | FIXED (TOWN-GROUND) |
| 4 | Urmanin: "They did NOT check how their new generated topology would work in the vanilla map" | 1, measured over every town of the Bay | FIXED (TOWN-GROUND) |
| 5 | Cruor: "Bigtime Terrain Bugs: Aldwall Rock" - "big holes and uhm.. cubic mistakes ... The ports are now off a cliff instead of smooth?" | 1 | FIXED (TOWN-GROUND) |
| 6 | Winter: "Wall Graphics Flicker" - "The city wall at the entrance of Riften has texture flicker" | A wall's lengths and gates end in the middle of a bend's tower, which is exactly the wall's width, so where the line runs straight their faces lay in the tower's own planes, and the depth buffer cannot order them | FIXED (WALL-FLICKER) |
| 7 | Giljabrar: "Daggerfall City Walls are Janky" - "Stuff is clipping into itself, roads lead to nowhere. Please revert the wall changes" | TS7's walls: the wall pieces' own doors opening into nothing, bends whose lengths ran through each other, and roads left running into the wall where GATE-ROADS slid their gates | FIXED (BAY-WALLS); the walls kept, per the owner |

## TOWN-GROUND: a Bay town's ground meets its sea, its slope and its edge (1, 3, 4, 5)

`src/world/terrain/terrainTiles.js` (blendShapedTerrain, townGroundMask), `src/world/townShape.js` (townFieldTiles).
The measure and the law are `03-World/Town-Shapes.md`, "TS2 at FB1028 TOWN-GROUND".

FOUND. TS2 stood a town at the mean of its own land and kept the sea one sample past its margin, so a port raised over
its water stood on a cliff: Westhead Moor 46 m over its sea, Aldwall Rock 34 m. The holes were the sea inside the
outline; the "cubes" a dock's tiles out in the water; the ports' jetties met the cliff's face. The ease ran twelve
samples whatever the drop, so a hillside town stood in a crater or on a wall. The edge band eased the town's own ground in
its last four samples. And a crop field put only its record's tile on the outline, so its plants stood over the slope
and the sea: 769 at Westhead Moor, 706 at Aldwall Rock, up to 47 m up.

FIXED. The ease runs as far as its grade needs (SHAPE_GRADE, 0.6 m a metre), the sea it needs lifted and the sea past it
kept; a margin keeps off the band it needs to meet the pixel's edge; a field's every tile is the town's. Over the Bay's
3,444 town pixels, towns with a step over 10 m fall from 57 to 3, and flats off their plane from 5,902 to none. Of the 86
that hold sea, TS2 stood 53 over 10 m and DFU's own blend stands 7. Westhead Moor's worst step is 7.3 m, Aldwall Rock's
7.7 m. Of 106 ports, the ground past a jetty's end rose over its deck by more than 6 m at 92 (the worst 102 m); now at 5,
none over 12 m.

NOT THE BAY ALONE. The blend is every shaped town's, so a town past the Bay moved too: `portships_real.test.js`'s pins
moved for Sunhold and Woodhearth, whose banks were TS2's cliffs.

AT THE MERGE. Two copies of the outline left the crops out, and each is fixed and pinned: the Eltheric isles' Deep Waters
bake, which packed a template's basis without them (`etherWatersBake.js` etherPlaceRects), and main's FIRST-VISIT record
of the boot walks' blocks, which kept each model's place and not its id (`groundTilesKept.js`) - from the second launch
on, the bake eased the sea under another outline than the stream's. THE GROUND MOVED, so GROUND_LAW moves 2 to 3 and the
relay to world278 (`03-World/Landforms.md` GROUND-GATE).

Tests `test/world/terrain/fb1028_townground.test.js` (7) and `fb1028_townground_real.test.js` (ARENA2), with
`fv_groundtiles.test.js`'s kept id. Mutants `tools/mutants/fb1028_townground.json` (24, all dead).

## The shipyard (2)

Lee and other players bought homes on Westhead Moor's north side for its shipyard, which TS7 moved to the west. The owner
chose to keep every yard where #1184 put it and to fix only a yard that is broken. Westhead Moor's is not broken; it
stays on the west side. No home moved: in the Bay no building moved (`03-World/Town-Shapes.md` TS2).

WESTHEAD-NORTH (2026-10-29). A guild's player posted again in #feature-feedback, and the owner chose to move Westhead
Moor's shipyard back to the north side, no other port. TS7 had moved it to the west side in both of the town's layouts,
and its old places are off TS7's ground in both.

In Daggerfall's layout it stood at the north-west corner (cells 1, 437, turned 2). It now stands on the north strip
between the wall and the sea, at the westmost place a shipyard fits (149, 401, turned 2), its lighthouse by the old
corner (57, 394). The wall stands between it and the town with no gate there: the walk to it stays long, as at TS7's
west place.

In Beautiful Cities' layout (on by default, and online) it stood on the north edge (corner cell 181, 424). The audit
found the first fix reached Daggerfall's layout alone, and the owner chose "North in both layouts". It now stands on the
north farmland nearest its old place (265, 413, turned 1), its lighthouse at (25, 114).

`world/portSites.js` PORT_PLACES_NEAR holds a row a layout, and the host hands a town the row of the layout it stands in
(`portPlacesNear`, the layout pins). portSite stands the place as near its cell as fits, by the sea's face and not the
sea's distance. Daggerfall's cell is an aim on the strip, not the old corner, which would pull the yard back west;
Beautiful Cities' is its old place's middle. The kept record keys on the row's value.

THE FOUR HOSTS: `scenes/world.js` places a town's ports (`townPlacesFor`), so it alone hands the row.
`scenes/worldModes.js` presses the yards wherever they stand, `scenes/dungeonContext.js` stands no street, and
`scenes/exterior.js` stands no port (FLAGGED, `scenes/portHost.js`).

Tests `test/world/westheadnorth.test.js` (5, one on ARENA2) and `test/world/westheadnorth_bc.test.js` (DELETED) (1, on ARENA2;
`test/bayPortGround.mjs` builds either layout's ground). Mutants `tools/mutants/westheadnorth.json` (16, all dead, with ARENA2 and without it). The
audit's record: `01-Overview/audits/Audit-Westhead-Hand-Wraps.md`.

## WALL-FLICKER: a wall's length clear of its tower (6)

`src/world/townWalls.js` (clearOfTowers, townWallModelSliced), `src/world/urban/townFabricStand.js`. The measure and the
law are `03-World/Town-Shapes.md` section 15.

FOUND. A bend's tower is the corner tower's body, a square exactly as wide as the wall (9.6 m), and every length and
gate ends in its middle. Where the line runs straight through it, a length's two faces lie in the tower's two side
planes, over half of each; at a turn of a degree they cross in a thin band, and at a sharp bend two walks lie on each
other. Riften has one gate, facing east, beside a tower that turns 0.0004 degrees: 154 m2 of faces in that tower's
planes, 77 m2 on the side a player meets on arrival. Every walled city had it: 603,355 m2 over the Bay's 410, 302,885 m2
over the 407 templates past it. Past the Bay the town's paving also lay at a gate's floor, in 88 towns.

FIXED. Each length and gate leaves out what lies in a tower's body, cuts a face along a side 5 cm past it, and mitres
its walk at the tower's middle; the paving lays nothing where the wall stands. Two faces within 4 cm: none on any wall of
either set, and none of the paving's. Rays from both sides see the same open ends as before, so nothing opens. Riften's
probe at the game's depth: 13,556 tower pixels changed when the eye moved 1 cm, now 112, their edges. With BAY-WALLS'
mitres and grown towers, the model of every fifth Bay city holds 10.6 per cent more triangles (886,446 to 980,640) and
takes about seven times as long to make (37 against 5 ms a city, on a loaded machine), so it is made 16 pieces a breath.

Tests `test/world/fb1028_wallflicker.test.js` (7, three on ARENA2). Mutants `tools/mutants/fb1028_wallflicker.json` (23:
19 dead, 4 recorded equivalent with why, two of them the mitre's branch, which cuts on mitreEnds' own plane).

## BAY-WALLS: Daggerfall's walls, kept and fixed (7)

`src/world/townWalls.js` (wallDoorless, mitrePlanes, streetGates), `src/world/road/gateRoads.js` (takeUpArms, joinArms,
yardRoads), `src/world/merchantYards/merchantYardSites.js` (keptSitesSteps). The measure and the law are
`03-World/Town-Shapes.md` section 16. Giljabrar asked for a revert; the owner kept the new walls and had them fixed.

FOUND. Daggerfall stands walled on its outline online because a home bought before WD3 holds it in its own layout.
- **Doors in walls:** the doors are the wall pieces' own (a length has one, a gate two), and they open into nothing.
  Of the 32,779 on #1184's walls, 7,169 stood inside a tower's body and 11,191 inside it or on its side's plane
  (Daggerfall 21 and 34 of 106).
- **Clipping:** a bend's tower was only the wall's width, so its two lengths ran through each other: 24,619 of 31,266.
- **Roads to nowhere:** GATE-ROADS slid each gate onto a street and left the road's arm running into the wall, at 369
  of the 410 walls. In 34 cities a street of the town's own ran into the wall where Daggerfall's ring had its gate.
- **Stutter:** the wall is built once, and a walk round Daggerfall's on the game's collider takes under 0.5 ms a move.
  The stutter was the faces drawn in one plane (6) and the crossing faces at the bends.

FIXED. Each door is laid in its own face's stone. A bend's lengths are cut on its tower's middle line, and the tower is
grown to hold them. A road's arm is taken up and joined to its gate. A street that meets the wall two lengths from every
gate gets its own gate. Now no wall has a door or a piece in another. 8 pieces of 5 walls stand on a road away from a gate
(1,645 before), none of them Daggerfall's, which keeps its 5 gates.

THE YARDS. The owner's rule: a yard keeps its #1184 place unless the place is broken. The new roads moved 310, so a yard
now reads the roads and the wall as #1184 laid them, and one whose place no longer fits is placed again. At the merge
1,183 of the 1,258 stood where they stood. Of the 75 moved, 50 lay on a gate's new road, 2 in the new wall and 19 against
a grown tower. 4 stables moved without being broken, by the gate furniture: Knightsgate, Issaqumbaa, Syra-Kom and
Puweyn. Since the audit's B5 and B2 (`0be4199e9`), the 19 and
Puweyn's stable stand on their #1184 cells: 1,203 stand, and 55 moved. Town-Shapes section 16 lists them all. Westhead
Moor's shipyard is not among them.

FIXED AFTER (FB1028 YARDS Y1-Y3).
- The three stables: the yards now measure the gate furniture as #1184 laid it, and the game keeps today's. Knightsgate's
  stable stands on its #1184 cells again. Issaqumbaa's and Syra-Kom's #1184 places lie on a gate's new road, so they are
  broken and move. 1,203 of 1,258 yards stand where #1184 stood them, 1,199 before. Naresa's Wagon Yard moved since the
  merge, and not by the yards' law.
- The yards also read the town ground and the ring as #1184 drew them. On the Bay this puts back three port places at
  Wayrest and Penwall Derry. Past the Bay, 1 of 306 sampled yards moves, not 11.
- The three street gates have a road out. Each opens onto the town's paving, and GATE-ROADS lays on to the ring. The
  audit's probe read only the painter's tiles near the gate.

OPEN.
- Past the Bay, the same slide leaves road arms at walls. One sampled yard (template 297's stable) still moves, and
  neither the ground nor the ring moves it.
- Two ground findings wait, because a fix moves the ground again: a seam drop in the edge band at Sentinel with the
  Landforms row off, and an ease that is not monotone beside tall relief.

AT THE MERGE. WALL-FLICKER cut a length clear of a tower's body as the wall's width, and the grown towers left a turned
length's face 1 to 3 cm under the tower's (Berbaaqnia, 72 m2). The cut reads the grown body now, and none is left.

Tests `test/world/fb1028_walls.test.js` (21, six on ARENA2) and `test/world/fb1028_yards_past.test.js` (1). Mutants `tools/mutants/fb1028_walls.json` (51; the first 37, every one
dead without ARENA2: the yard law and the host's wiring run on synthetic towns).
