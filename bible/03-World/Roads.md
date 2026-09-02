# Roads

Mac, 2026-09-01, on Hazelnut's Basic Roads for Daggerfall Unity:
"recreate it using it as a resource and avoiding the legal stuff
altogether... be as faithful as possible without crossing the line."

## The line

Basic Roads is two things. Its CODE is MIT (every source file carries
`Copyright (C) 2020 Hazelnut / MIT License`) and could be ported with
attribution. Its DATA - four 500,000-byte arrays saying which map pixels
carry a road, a track, a river, a stream, and which edges each leaves
through - is hand-authored work by Hazelnut and contributors, drawn
region by region, committed to the same repo with no license text that
reaches a binary file. That is the valuable part and the part with no
stated grant.

So: the DESIGN is learned from and credited here as prior art. The DATA
does not enter this port in any form - not vendored, not traced, not
converted. Every road byte the port has is derived at runtime from the
player's own MAPS.BSA and WOODS.WLD.

What the design gives, because it is what makes roads work and none of
it is protectable:

- one byte per map pixel on the 1000x500 world, an 8-direction compass
  mask (N=128, NE=64, E=32, SE=16, S=8, SW=4, W=2, NW=1) of the edges a
  path leaves through. Kept as the same layout on purpose: a rose is
  the natural encoding and any tool speaking it reads ours. The LAYOUT
  is not the data.
- two grades. Roads join the settlements that matter; tracks reach the
  rest. The painter draws them differently.
- the painter runs at DFU's own terrain seam - after the ground is
  classified, before the marching squares - so a road tile lands over
  a known ground and the squares blend around it. Hazelnut restructured
  his mod to run exactly there; the port's `terrainGen.js:58` is that
  seam, which is why this is a recreation and not a rewrite.
- a road is two tiles wide down the centre of the 128-grid, one tile
  wide on the diagonal, with an edge tile either side; it stops at a
  location's own tilemap rather than painting over its streets.

## ROADS 1 - the network (2026-09-01)

`world/roadNetwork.js`, PURE: it takes the settlement list and two
samplers and returns the two mask arrays, which is what lets it be
pinned on a synthetic map in a container with no game data.

THE GRAPH. Cities and hamlets are road-grade nodes. Each takes its
three nearest road-grade neighbours within 70 pixels, then a spanning
tree over ALL road nodes is added so nothing is stranded - the tree may
add long edges and that is its job; a town with no road is a bug, and
the pin says so. Villages, farms, taverns, temples and wealthy homes are
track-grade: each takes a track to its nearest road NODE within 40
pixels, aimed at a town rather than at the nearest road pixel so a
track reads as "the way to town", and it STOPS the moment it touches
the road network rather than walking alongside it into the gates.
Dungeons, graveyards, covens and cults get nothing, by choice: a road
to a labyrinth tells the player where it is.

THE ROUTES. A* over the pixel grid, 8-connected, shortest edges first
so later routes merge into earlier ones through a half-price step onto
an existing road. Water is refused outright. Climb is paid at 40% per
unit of small-heightmap rise per step, descent at 10%, and ground above
40 pays 8% per unit on top. The box grows on failure (12, 40, 120
pixels of margin) because a bay or a range taller than the margin walls
the search in - the pin puts a lake across the whole first box.

ALL THE DIALS ARE IN ONE PLACE, `ROAD_DIALS`, because "the roads climb
that mountain" is a cost-function complaint and its answer should be
one number away. The first draft's climb dial was 6% and the mutation
sweep proved it could not move a road around anything; 40 moves one
around a steep bump and rightly still crosses a gentle one, which is
what a road-builder does.

HONEST COST: a hand-drawn network is judged pixel by pixel by people
who cared where each road went. This one will be straighter and
worse-judged at first. That is iteration on our own thing.

## ROADS 2 - the painter (2026-09-01)

`world/roadPainter.js`, written from the design rather than ported.
Row 0 of a pixel's tilemap is SOUTH and row 127 NORTH (terrainSampler
:150-151, "y=0 of py equals y=128 of py+1"), so N paints up in y. Roads
are tile 46 over any ground, with 47 (dirt) or 55 (grass) as the edge;
tracks are worn dirt showing through grass only (11/26 centre, 12/27
edge) and leave dirt and stone alone because a dirt track on dirt is
invisible. WATER IS NEVER PAVED: a road bit over water is a routing bug
and the painter refuses to hide it. The centre of any arm wins over the
edge of another, so a junction reads as one surface. A location's rect
is left alone.

Hooked at the seam behind `roads = null`: with no network handed in the
solo pipeline is byte-for-byte what it was, pinned at the source.

## ROADS 3 - the producer (2026-09-01)

`world/roadsProducer.js` is the only thing that touches the archives:
every region's map table through mapsFile's own lon/lat law, the small
heightmap for the ground, and the sampler's beach line for water -
`WATER_BYTE = SCALED_BEACH_ELEVATION / BASE_HEIGHT_SCALE`, the
sampler's constant divided back into WOODS units so the road-builder
and the terrain cannot disagree about where the sea starts. Built once
in world.js when the terrain client is made, handed to BOTH kernels
(the worker gets a copy; this thread keeps its own for the fallback),
and a failure draws a world without roads and says so on the console.
On a synthetic map the build is ~30ms; the real one is logged. Caching
is deferred until the number says it is needed.

## ROADS 4 - the road is a surface (2026-09-01)

Enhanced Environments draws the INSIDE of Daggerfall's tiles as
procedural surfaces and keeps their shapes and colours (EE4). Its
residual path identifies a record's own material by colour - grey
cobbles read as stone, brown ruts as dirt - and a road is neither. So
`groundSurfaces.js` gains a seventh surface, `road`: packed earth,
darker and smoother than dirt, flat-worn stones larger and sparser than
dirt's pebbles, a faint camber. Orientation-free on purpose, because the
tilemap rotates and flips road tiles by bits 6/7 and a rut with a
direction would run the wrong way on half of them - the road's
direction is the archive's shape, the surface only fills it. Records
46/47/55 - the painter's three - take it BY INDEX (ROAD_RECORDS) and
stay colour-matched to the archive's mean, so a winter road is pale and
a desert road sandy while both are unmistakably road. Seam law holds
(the camber is symmetric about the tile centre). Pinned: the same grey
on record 45 and record 46 draws two different surfaces. Classic still
draws tile 46 from ARENA2, exactly as the original mod does.

## ROADS 5 - the ring, the cap, the names (2026-09-01)

The open items. A pixel that carries a location and a road paints a
two-tile RING just outside the rect with an edge tile beyond it, and
every arm that reaches the town joins the ring instead of ending in a
field - the original's roads circle a town because they never line up
with its gates, and ours for the same reason. A lone cardinal arm
takes a CAP one tile past the centre so a dead end rounds off rather
than ending on a knife; decided after every centre has had its say,
because at a junction one arm's cap position is another's centre. And
`stats.unroutedPairs` names both ends of every pair that found no
route, which world.js prints with the region's name.

Found on the way and fixed: the painter read the location rect as
{x, y, w, h} and the seam sends setLocationTiles' inclusive
{xMin, xMax, yMin, yMax}, so the guard compared to undefined and was
dead - the pre-seeded location tiles were all that kept roads out of
the streets, and nothing kept them out of the clearance band. The pin
that covered it sent the same wrong shape and passed.

## ROADS 5 - the turn cost (2026-09-01)

Mac, on the first real-data look: "the roads are extremely jagged."
Plain A* on an 8-connected grid draws a 1-in-10 slope as nine E steps
and one NE, over and over, and the painter turns every change into a
135-degree kink at a pixel centre - a staircase. Hand-drawn data never
looked like that because a human lays straight stretches. So the search
carries the HEADING in its state (cell x 8) and every step pays
`turnCost` per 45 degrees of change; the route prefers "E for a while,
then NE for a while", the same length and a fraction of the corners.
Pinned: 7 turns to 2 on the fixture slope. The dial is in ROAD_DIALS
with the rest; a bigger number lays longer stretches at the cost of
hugging the terrain less closely.

## ROADS 6 - the ring (2026-09-01)

Measured on the hand-drawn network rather than assumed: full
eight-pixel loops around a location essentially never occur (none of
eight, four of seven), five-neighbour ARCS are everywhere (890). A ring
is a through-road detouring around a town on one side. Two rules
produce it: a settlement's pixel - of any type, a village or a dungeon
as much as a city - is never an intermediate step, only a start or an
end; and NO CORNER CUTTING, a diagonal step may not pass between two
pixels either of which is a town or water. The second is what turns a
one-diagonal kiss of the town's corner into the arc through its corner
pixel, and it keeps a road off a coast's diagonal seams too. A town on
the line between two others gets the arc plus its own two spurs, which
is the ring; a village in the way is walked around, not painted through.
The hand's fifth neighbour is its habit of returning to the line after
the bypass; A* has no reason to when the destination sits on the new
line, and the pin holds the principle rather than the habit.

## ROADS 7 - the map draws the network (2026-09-01)

Mac: always on. The enhanced travel map is the overworld relief, one
vertex per map pixel, so a road is a tinted vertex - hard toward a
packed-earth brown - and a track a fainter dirt; the triangles between
neighbours draw them as threads. Never on water. The arrays live in
the terrain worker after Audit 45 F2 and come back once for the map;
the window keys its grid cache on the network it was drawn with, so a
grid built before the network landed is rebuilt the first time the map
opens with it. The classic 2D region map (travelMapWindow.js) does not
yet draw them - its own slice.

## ROADS 8 - the stranded are named (2026-09-01)

Audit 45's F7, finished: the settlement row carries the town's name off
the region's own map-names table, an unrouted pair carries both names,
and the boot log prints each one as a place to go and look.

## ROADS 9 - the cap (2026-09-01)

Audit 45's F4. A cardinal arm that ends left a square stub; the design
closes it with the two edge tiles on the row the arm starts from,
turned to meet in a point, and the same two tiles are the outer corner
when the road turns instead of ending. The orientation is the design's
own expression - rotate when x == y, mirror when x == midHi, for all
four arms - kept exactly because it was tuned against the real tile art
in the field and no fixture here can see that art; a symmetric flip, the
first draft, would have turned one of every cap's two tiles wrong.

## ROADS 10 - the ground under the road (2026-09-01)

The design's SmoothRoads, by its author's own description rudimentary:
look for road tiles and blur the heights under them. Ours is that -
every corner sample a path tile touches takes the mean of its 3x3
neighbourhood, read from the original heights so it is one pass and
order-independent, and nothing off a path tile moves, which is what
keeps the terrain around a road the terrain. It runs after the paint
and before the grid is built from the samples. The switch rides the
network object (`smooth`, default on) because the kernel runs in the
worker with no settings access; surfacing it in Settings is a UI slice.

## ROADS 11 - two audit notes closed (2026-09-01)

F5 corrected rather than fixed: autoDiscard is DFU's own default, the
sweep holds one region, and the region it found loaded is put back.
F8 removed: the painter's tables never hold tile 0.

## Audit 45 (2026-09-01)

The deep pass over Roads 1-3: `01-Overview/Audit-45.md`. F1 the track
set (farms out), F2 the build moved into the terrain worker, F3 the
heuristic made admissible, F6 tracks merge with tracks. Three suspects
cleared by the line that clears them. Four low findings recorded there.

## Open

- Rivers and streams: the same painter with water tiles, off by default
  as the original ships them. Their data would also be ours to derive.
