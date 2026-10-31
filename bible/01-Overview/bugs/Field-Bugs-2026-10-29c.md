# FIELD BUGS 2026-10-29c - the ground meets a town, the paving stands dry

Two threads of `Field-Bugs-2026-10-29b.md` moved the ground, so they share one branch and one bump: GROUND_LAW 5, one
RELAY_VERSION (world286), one bake version and one recorded print. Each was read on the freeware's data
(`tools/fetch-data.sh`) with both town packs on, as online stands them.

| | Report | The owner's decision | Done |
|---|---|---|---|
| 3 | AustinHale: "List of Ports with broke[n terrain]" - Kalunnunu | "Ground meets the town" | FIXED (ACROSS-EDGE) |
| 3 | the same list - Torval, and Alinor beside it | "Give them a relief" | NOT BUILT: a design the owner decides first (RELIEF, below) |
| 4 | YeetMa...: "Large portion of road in jabivia is also a body of water" | "Lift the paving" | FIXED (ROAD-DRY) |

## ROAD-DRY: the Bay's paving over the sea stands dry (4)

`src/world/road/roadDry.js` (dryRoadHeights, roadCrossings), `src/world/terrain/terrainGen.js` (after the two
smoothRoadHeights calls).

FOUND. Basic Roads' painter lays its paving wherever its road bytes run, the sea's causeways too. The sampler holds the
sea's ground at the ocean's clamp, and smoothRoadHeights eases a road along its own heights, so a causeway's paving stood
at the sea's own height. Deep Waters reads a height at the sea as water: it drew its surface over the road and carved its
floor under it. Come Sail Away's hull sailed across. Of the Bay's 4,348 pixels with paving, 5 had paving at or under the
sea's line: 333 tiles, Grayidge's causeway (72, 131) and (72, 132), Sentinel's coast road (421, 374), (859, 196) and
(357, 194).

FIXED. On the Bay, every corner of a painted paving tile (46, 47 or 55, its turn and flip bits off) stands at
CAPITAL_LAND at the least: a metre over the sea, RUMARE-WATER's freeboard. Both the stream's samples and DFU's own (the
classic pass) take it. A location's rect and a town's road ring are left to their blend, as smoothRoadHeights leaves
them. A pixel's edge sample is its neighbour's too, so it rises only where a road's cardinal arm crosses into the
neighbour and both pixels' bytes say so. Then both pixels lift the same three samples (ARM_EDGE), and no seam opens.

Measured after. Paving at or under the line: 333 tiles in 5 pixels, now 0. Deep Waters at the five pixels (holes carved
under the road / water drawn over it): 138/141, 88/96, 61/79, 0/26 and 0/30, now 0/0 at each. Edge samples a crossing
lifts: 6, none on one side alone. Each later step of the build (the gates' roads, a site's levelling, the water's bed,
the grid) leaves the paving over the line. The census reads the finished samples. The hull grounds on the causeway (35 m,
the hull's line 34 m).

DEPARTURE (named; Port-Ledger section A, ROAD-DRY): Basic Roads and DFU leave the sea's ground at the sea's height under
the paving.

Tests `test/world/fb1029_ground.test.js` (2 on synthetic ground: the producer, both passes and the edges; the law) and
`test/systems/travel/rpt1026_world_causeway.test.js` (its third test on ARENA2: Grayidge's and Sentinel's causeways built,
the Deep Waters bake and the pixel's carve, no hole under the road). Mutants `tools/mutants/fb1029_ground.json`
(ROAD-DRY's 11, all dead).

NOT CHANGED. smoothRoadHeights, to the byte. Arena's roads past the Bay: the law reads the Bay's bytes alone. The
records' lift reads no road (it never did), and a causeway rose a metre over the sea, where a record stood afloat. The
living world's dry ground (`world/dryGround.js`) reads the kernel, so a causeway is wet to it, as before.

## ACROSS-EDGE: the ground meets a town across its pixel's edge (3)

`src/world/terrain/townMeet.js` (townMeetOf, applyTownMeets, meetLiftAt, townMeetsAbout), `src/scenes/townMeetsHost.js`
(the towns of a pixel's 3 x 3), wired by `scenes/pixelBuild.js` and `scenes/groundFrameHost.js`. The law is
this section; `03-World/Town-Shapes.md` "Across the edge" points here.

FOUND. #1371 (FB1028 TOWN-GROUND) fixed five of the list's six. DFU's BlendLocationTerrain keeps a pixel's edge the
land's own, and TS2's ease ends there. Kalunnunu stands 100 m over its harbour, and its pixel's north edge stands over
open sea: its quays met a 14.4 m step and a cliff, and its six jetties ran into the face (the ground 8 m past a jetty's
end 19.3 m over its deck). Tunmont's worst step was 18.6 m and Naresa's 13.8 m, for the same reason.

FIXED. A Bay town (a city, a hamlet or a village of MAPS.BSA, never a spawn or a capital) whose edge stands under the
height its ground can reach at SHAPE_GRADE raises that edge, and each pixel of its 3 x 3 rises to meet it at the grade.
The meet is read off the town's own pixel before any meet, so every pixel that asks gets the same. It only raises. A
side no cone of MEET_REACH (120 samples) can meet whole moves nothing: Chesterbrugh stands 946 m over its sea. A
location stands where it stood: its level, outline and reach are read before the meets.

Every producer agrees: the stream (the worker and this thread), its classic pass, the ghost rows of a promotion, the
records' lift, the records' frame (GROUND_FRAME_LAW 5, the meets' move), the Deep Waters bake (its rows name the towns,
and a sea pixel a meet reaches is sampled) and the print.

Measured after (the stream's build, packs on, the Landforms row, roads):

| | before | after |
|---|---|---|
| Kalunnunu's worst step | 14.4 m | 8.2 m |
| Kalunnunu's jetties at a face / ground 8 m past a jetty's end | 6 / 19.3 m | 0 / 1.0 m |
| Tunmont's / Naresa's worst step | 18.6 / 13.8 m | 7.2 / 10.4 m |
| Westhead Moor's / Aldwall Rock's worst step | 7.3 / 7.7 m | 6.6 / 7.7 m |
| sea samples raised in Kalunnunu's 3 x 3 (the most) | - | 2,212 (73.7 m) |
| seams in the met towns' 3 x 3s | 0 | 0 |
| a location's level moved (65 met towns, 71 locations) | - | 0 |
| the Bay's 106 ports: a step over 10 m / a jetty at a face / ground 8 m past a jetty's end over 6 m | 7 / 2 / 5 | 3 / 0 / 1 |

The one port still over 6 m is Chesterbrugh (16.2 m, unmet). The ground 8 m past a jetty's end grew at seven ports, the
most at Ageliret (1.1 to 3.3 m), all under 3.5 m: their berths moved onto the raised shore.

DEPARTURE (named; Port-Ledger section A, ACROSS-EDGE): DFU keeps a pixel's edge the land's own.

Tests `test/world/fb1029_ground.test.js` (6 on synthetic ground: the law; the producers agree; the levels; the records'
frame; the towns; the wiring) and `test/world/fb1029_ground_real.test.js` (DELETED) (ARENA2: Kalunnunu's 3 x 3, its harbour, the
bake's sea, Tunmont, Naresa, Chesterbrugh and Sentinel). Mutants `tools/mutants/fb1029_ground.json` (ACROSS-EDGE's 38:
37 dead, MEET-reach-3x3 recorded equivalent).

NOT CHANGED. The ground past the Bay: no met town's 3 x 3 reaches past the Bay's frame. The far rings and the far trees
(`world/terrain/midRingGrid.js`, `floraCover.js`) read the kernel and no location, as before. The harbour book's
`dryPixel` stays a lower bound: a meet only raises. The living world's dry ground reads the kernel, as for a town's own
blend. Sentinel's south (47 m under its land) is not met: a meet only raises, and its neighbour's land stands over it.

## RELIEF: Torval and Alinor (3) - not built

The owner: "Give them a relief", each its own as Solitude has: "Land rows stand at the land's height; only the quay row
and the sea stand at the sea". Measured (the freeware, the port-ships world, the Landforms row off):

| the city's pixel | the land's own under rows 0-5 | under the quay row (6) | where the sea begins |
|---|---|---|---|
| Torval (1922, 1705) | 58 to 76 m, rising south | 70 to 75 m | the docks' pixel, row 4 (about 600 m south) |
| Alinor (8, 1533) | 60 to 92 m, rising south (the river's row 5: 88 to 92 m) | 86 to 92 m | the harbour's pixel, row 4 |

Today both cities stand at 1 m and their rim rises to the land's own over 11 tiles (Torval's: 70 m over 70 m of rim).
A relief stands the city at 60 to 90 m and its quay row at the sea, so a cliff of 70 to 90 m runs across the city
between rows 5 and 6.

Why not built in this branch. It is Solitude's size (Solitude's own slice: its relief, tiers, a docks way, its walls on
the cliffs, its blocks lifted, the walk grid shut, 19 test groups, 52 mutants), twice. Two choices are the owner's:

- Torval: the way down 70 m from the city to its quays, inside its walls. No plan has one. Without it the docks cannot
  be walked to.
- Alinor: its bridges join the city (row 4) to the quay row (6) across the river (row 5). With the quay row at the sea
  and the city at 88 m, the bridges cannot stand level, and BRIDGE-ENDS' pins (the ramp's foot at the street on both
  banks) cannot hold. Either the river and its south bank rise with the city (the quays then stand at 88 m, not at the
  sea), or the bridges become a stair down a gorge.

PROPOSAL. Torval: rows 0-5 at their median, 66 m, one tier; the quay row and the docks at the sea; a Docks Way down the
cliff from the south gate's lane (Solitude's law: a ledge, a landing, a causeway at a road's grade); the walls stepped at
the cliff; the Daggerfall blocks of rows 1-5 lifted (capitalBlockLift). Alinor: the city and the river on one tier at
88 m, the river a channel in it; the quay row and the harbour at the sea below a cliff south of the river, reached by
its own way down. Then BRIDGE-ENDS' abutments stand as they are. Each would move GROUND_LAW again (6).

## THE GROUND MOVED

GROUND_LAW 4 to 5 (`net/wire.js`) and RELAY_VERSION world286 (NOT YET DEPLOYED). BAKE_GENERATOR_VERSION 4 to 5: the bake
reads the meets. GROUND_FRAME_LAW 4 to 5: a record stamped before 5 rides the meets' move (`world/landforms.js`
townMeetMovedField), and a record before 4 still rides its town's blend's move first (TOWN_FRAME_LAW 4). The print
(`tools/groundPrint.mjs`, `test/fixtures/groundPrint.json`) reads three new cells: a town on a cliff over its sea and the
sea north of it (`Meet@150,400`, `Meet@150,399`), and a road across open sea (`Road@96,200`). Its old cells did not move.
