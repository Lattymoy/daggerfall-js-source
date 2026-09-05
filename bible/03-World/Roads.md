# Roads

Mac, 2026-09-01, on Hazelnut's Basic Roads for Daggerfall Unity:
"recreate it using it as a resource and avoiding the legal stuff
altogether... be as faithful as possible without crossing the line."

## The line - and then permission

The line below was the law from ROADS 1 to ROADS 21: the design learned
from, the data never shipped. On 2026-09-02 Hazelnut gave Mac
permission to integrate Basic Roads 1:1, and the line is gone: the four
arrays are vendored in `vendor/roads-hazelnut/` with attribution and
credited on the About screen beside the windmills. Everything below
about deriving our own network is still true and still runs - as the
FALLBACK for a map where his data cannot load - and the fourteen slices
that calibrated it against his data are how the fallback got good.
ROADS 22 is the integration.

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
opens with it. The classic 2D region map draws them too as of ROADS 13.

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

## ROADS 12 - the toggles (2026-09-02)

Mac: a toggle per type. A Roads chip and a Tracks chip beside DFU's
four on the overworld map, under the same law: the live
travelMapState store, the classic inversion (TRUE hides), saved in the
TravelMapSaveData envelope as filterRoads/filterTracks, absent in an
older save meaning shown - so the default is still always on. A road
chip does not dirty the markers; it re-runs the terrain step, which
was extracted from scene creation into _ensureTerrain and keys the
relief grid on the network AND the two flags, so a toggle rebuilds the
relief and a toggle back finds the cache stale again.

## Audit 46 (2026-09-02)

Everything so far: `01-Overview/Audit-46.md`. 21 mutants, 21 dead. A1
fixed (the map's stride), A10 cleared and pinned (message order keeps
every chunk built with the network), four low notes recorded.

## ROADS 13 - the classic map (2026-09-02)

The ROADS 7 gap, named in three audits, closed. The classic region
panel plots the network in the same pass as its location dots - the
same texel-to-pixel law (originX + x, originY + y), the same "this
region only" rule DFU's dots follow, written UNDER the dots so a town's
marker sits on top of the road that reaches it - in the relief's two
colours. The flags are the shared store's, flipped by the enhanced
map's chips and carried in the save; the classic panel has no native
art for two more buttons, so a classic-only player sees both on. A
network that lands after the panel was opened plots on its next region
select, which in practice is never - the worker finishes in the first
second of boot.

## ROADS 20 - the width is the mod's (2026-09-02)

Mac: "ensure road width matches what the mod has." Read from the mod's
painter: cardinal outer is `null` for roads and tracks - two tiles of
46 and nothing beside them, the 47/55 edges flanking the diagonal
only. Ours had painted an edge column each side of every cardinal arm
since ROADS 2: four tiles across to his two. Fixed, with the track's
diagonal inner (51/52) and inside corner (10/25) read from the same
table. Audit 50 has the detail and names the painter's ring road as the
one remaining departure from the mod.

## ROADS 21 - the tracks are a web (2026-09-02)

The larger of ROADS 16's two structural gaps. His villages sit ON
tracks (84%), his tracks average 14 px per dead-end and junction at
6.9%; ours were 3.6 px stubs at 29% dead-ends. His tracks pass THROUGH
the places they serve, chaining village to village to road. Three
rules: a track may cross a track-grade pixel where a road may not; each
track node links to its two nearest neighbours within 24 px, routed
shortest-first so the web grows outward from the roads, and a link
commits to B's side of the web (it may end on any path closer to B than
to A, never on A's own track at step one); and a village is entered
WIDE - ROADS 18's rule with the web's nodes as its towns. The first two
alone gave a web with sharp joins (right angles 14.8%, hairpins 5.3%);
the third took them to 1.9% and 0.0%.

| | pixels | bend | right-angle | hairpin | dead-end | junction |
|---|---|---|---|---|---|---|
| his tracks | 30,472 | 39% | 2.4% | 0.0% | 7.1% | 6.9% |
| ours before | 22,907 | 30% | 9.2% | 0.0% | 29.4% | 4.9% |
| ours now | 26,944 | 40% | 1.9% | 0.0% | 12.7% | 8.1% |

Found on the way: `stopIf` had been designed for ROADS 17 and never
plumbed through the other instance's rewrite of routeInBox; a link that
could stop on ANY path stopped on its own at step one and the web was
stubs and hairpins. It carries the heading now, so a stop can be judged
wide.

## ROADS 22 - his network, 1:1 (2026-09-02)

With Hazelnut's permission: `vendor/roads-hazelnut/` carries the four
arrays byte-exact (a 500 KB file gzips to 28 KB; GitHub Pages serves
gzip), `roadsProducer.loadModRoads` reads them as Vite assets by
`new URL(import.meta.url)` and refuses a wrong length, the worker takes
the arrays ready-made with no build and no cache, the map draws them
through the door it already had, and the About screen credits him as
it credits Kamer. The generator is the fallback: a failed load logs
and builds ours. The painter's ring road - Audit 50's one departure -
is removed; the mod paints none, and an arm now stops at the rect as
his does. Rivers and streams are loaded and unpainted, off by default
as the mod ships them; their painter branch is the next slice.

## ROADS 23 - the painter is a port (2026-09-02)

With permission, the painter is BasicRoadsTexturing.cs's PaintPath
ported table-driven as he wrote it: six tile slots per path type
(cardinal inner and outer, diagonal inner, outer and gap, the inside
corner), his exact conditions, his paint order - roads, then rivers and
streams if water is on, then tracks, the first to paint a tile winning.
The earlier readings-from-a-description are gone with their
approximations, and every pin they had written still passes against
the port, which is the best check a rewrite can get.

Three things the readings never had. PIXEL CORNERS: a diagonal leaving
a neighbouring pixel brushes this pixel's corner tile, and the mod
paints a diagonal-outer there so the road does not gap at the seam;
the corner byte is the east neighbour's SW|NW bits and the west's
NE|SE, as he derives it. RIVERS: water in the centre - stored as 0xff
so the pipeline reads it as set, the location tiles' own trick - with
a BANK (a cardinal outer of 6/21/31, the one path type that has one),
a diagonal gap ring, and centre and corner joins where a stream meets
them. STREAMS: the bank tile as a narrow centre, no outer. Both behind
`water` on the network object, OFF by default as the mod ships them.
The smoother's tile set includes the water tiles, as his does.

## ROADS 25 - the map draws lines, the first iteration's design (2026-09-02)

Mac: "in my first ever iteration of roads we used a certain design for
the roads... I want to use it instead of the smeared dirt look." The
first road drawing on this map - R1 through RH1, removed whole in RX
before the ROADS arc began - drew the network as LINES lifted over the
relief: one chain per run between junctions, Ramer-Douglas-Peucker to
drop the grid stairs (a diagonal step sits at most 0.71 px off its
line; the tolerance is 0.9), Chaikin twice to round the corners, each
class at its own lift so nothing z-fights at a junction. ROADS 7's
vertex tint - a colour lerped into one vertex per 819 m and smeared
across the triangles - is gone; the relief no longer knows about roads
at all. Restored from 01121b9b for four classes and fed with Basic
Roads' own arrays through a tracer that walks the compass masks into
chains (his data: 1,508 road chains, 4,289 track). The chips choose
layers at draw time, so a toggle re-uploads nothing. Lift order, which
is draw order: stream < river < track < trunk < route.

**AUDIT 58 (f3/render): the layer has an owner.** One VAO and one
buffer per chain is ~5,800 of each on his arrays, minted fresh by every
travel-map window - and `OverworldRenderer.dispose()`, whose own
heading is "Every allocation has an owner (AUDIT 17e)", freed every
sibling set and not this one, so every close of the map orphaned the
whole network on the session's one shared GL context. `_freeRoads()`
is called from `dispose()` now, pinned in overworldmap.test.js against
a handle-holding Proxy-GL.

## Audit 51 (2026-09-02) - parity by oracle

`01-Overview/Audit-51.md`. The painter matches the mod's PaintPath byte
for byte over 651 cases; the smoother is SmoothRoadsJob but for a
corrected transpose; the arrays are his to the byte. ROADS 22's claim
that the mod paints no ring is corrected there: it paves the rect's
padding, roads only.

AUDIT 58 (f2/hosts, 2026-09-03) corrected WHICH index that transpose is
on. The tilemap is `x + y*tDim` and the heightmap is `y + x*hDim`
(TerrainSampler.cs:123 against TerrainHelper.cs:170) - the mod's
transpose is on the SAMPLE base, and the "correction" recorded here was
made on the tile read, where `y*tDim + x` is literally his
`Idx(x, y, tDim)`. So the divergence was written down as closed while
the defect it named ran in both lanes: no road bed was smoothed and an
east-west strip of open ground was blurred in its place.

## Audit 45 (2026-09-01)

The deep pass over Roads 1-3: `01-Overview/Audit-45.md`. F1 the track
set (farms out), F2 the build moved into the terrain worker, F3 the
heuristic made admissible, F6 tracks merge with tracks. Three suspects
cleared by the line that clears them. Four low findings recorded there.

## Open

- Rivers and streams: the same painter with water tiles, off by default
  as the original ships them. Their data would also be ours to derive.

## ROADS 14 - calibrated against the answer key (2026-09-02)

Mac: "Use his data as a resource to perfect our design." The hand-drawn
network is what "as close as we can" means, and its bytes cannot ship;
its JUDGEMENT can be measured and turned into the dials. So
`tools/roadsCalibrate.mjs` reads the mod's arrays (from the author's
public repo, read not shipped) and prints, for roads and tracks: the
share of through-pixels that bend, what angle those bends are, the
diagonal share of steps, dead ends, junctions - and, with ARENA2
present, the same numbers for OUR network on the same map, side by
side, with the dials on the command line.

THE ANSWER KEY'S NUMBERS, recorded as the targets:

| | pixels | bend | right-angle | hairpin | diagonal | dead-end | junction |
|---|---|---|---|---|---|---|---|
| his roads | 21,554 | 30% | 1.7% | 0.0% | 34% | 0.3% | 4.4% |
| his tracks | 30,472 | 39% | 2.4% | 0.0% | 36% | 7.1% | 6.9% |

WHAT THAT SAID, AND WHAT CHANGED: a road turns ONE COMPASS POINT AT A
TIME. Of 6,076 road bends, 5,975 are 45-degree heading changes and
101 are right angles; none double back. A linear turn cost priced a
right angle at exactly two 45s, so A* was indifferent. The cost is now
squared in compass points - a right angle four 45s, a hairpin nine -
and the search lays two single-point bends where it laid a corner.
Pinned at the source; on open ground the fixtures cannot distinguish
the two (a chamfer is always shorter than a corner), and the real-map
run is where the share is read.

WHAT IT CANNOT SAY WITHOUT THE HEIGHTMAP: the 30% bend rate is the
terrain speaking - valleys, coasts, passes - and any generator draws
straight on flat ground. Bend rate, climb, and track reach are tuned on
Mac's machine: `ARENA2_PATH=... node tools/roadsCalibrate.mjs --bytes
<dir> --turnCost 0.7 --climbCost 40` prints ours beside his; turn a
dial, run again. That loop is the design being perfected against the
resource, and every number it lands on goes into ROAD_DIALS with the
run that chose it.

## ROADS 15 - tracks join the road where it passes (2026-09-02)

Calibrated from his arrays alone, no heightmap needed. Of his 2,166
track dead-ends, the median distance to a road pixel is 0, the 95th
percentile 9, the max 56: HIS SPURS ARE SHORT, because they meet the
road wherever it runs. Ours aimed every track at the nearest road NODE
- "the way to town" - and reached 40 pixels to do it, which was the way
to a town thirty pixels off when the road ran eight pixels away. The
target is the nearest path pixel now, the reach is 14 (generous against
his 95th), and the route stops the moment it touches any path.

WHAT THE SAME NUMBER SAYS THAT NEEDS THE MAP TO ACT ON: a median of
zero means most of his villages sit ON a road. His roads route past
villages; ours join towns and leave villages to spurs. Making villages
waypoints the roads pass through is the next calibration, and it can
double the network's size, so it waits on MAPS.BSA and WOODS.WLD to be
measured against his 21,554 road pixels before it is turned.

## ROADS 16 - the real map, his beside ours (2026-09-02)

Mac uploaded the four map files, so the loop ran here. What the answer
key's design is, read straight off MAPS.BSA against his arrays - the
share of each class within one pixel of his network:

| class | n | on a road | on a track |
|---|---|---|---|
| TownCity | 410 | 100% | 57% |
| TownHamlet | 1200 | 90% | 67% |
| TownVillage | 1834 | 39% | 84% |
| Tavern | 1646 | 33% | 76% |
| HomeWealthy | 1399 | 29% | 74% |
| ReligionTemple | 1043 | 24% | 67% |
| ReligionCult | 475 | 26% | 63% |
| HomeFarms | 1841 | 23% | 47% |
| Dungeon* | ~3500 | ~22% | 24-29% |

A random location's chance of sitting within a pixel of his track web
is about 47%, from density alone. Villages, taverns, wealthy homes,
temples and cults sit far above it - TRACKED. Farms sit AT it -
incidental, F1 stands. Dungeons sit BELOW it - avoided. Road-grade is
cities and hamlets, and ours already was: 1,610 nodes both ways.
HomeWealthy, ReligionCult and Coven join the track set; F1's exclusion
of estates was a guess the data overruled.

THE DIALS, swept and set: neighbours 3 -> 2 (junctions 14% -> 9%, his
4.4%), turnCost 0.7 -> 0.4 and climbCost 40 -> 80 (bends 18% -> 23%,
his 30%), trackReach 14 -> 20 (track pixels 16k -> 23k, his 30k).

THE TABLE, at the calibrated dials:

| | pixels | bend | right-angle | hairpin | diagonal | dead-end | junction |
|---|---|---|---|---|---|---|---|
| his roads | 21,554 | 30% | 1.7% | 0.0% | 34% | 0.3% | 4.4% |
| our roads | 15,259 | 23% | 8.1% | 3.2% | 37% | 1.5% | 9.2% |
| his tracks | 30,472 | 39% | 2.4% | 0.0% | 36% | 7.1% | 6.9% |
| our tracks | 22,907 | 30% | 9.2% | 0.0% | 36% | 29.4% | 4.9% |

WHAT THE DIALS COULD NOT MOVE, and why - three structural gaps, each
the next slice:

1. RIGHT ANGLES (8% vs 1.7%) and HAIRPINS (3% vs 0%). Every hairpin
   sampled is a TOWN pixel where two of our spurs arrive from adjacent
   directions; his towns are entered once and passed through. Ours
   converge as separate edges. Fix: a second arrival merges into the
   first spur before the town. The right angles are the same shape
   plus L-turns around blocked pixels.
2. TRACK DEAD-ENDS (29% vs 7%). Ours are spurs, one dead end each,
   3.6 px on average; his are 14 px on average and web together
   (junction 6.9%). His tracks connect locations to each other along
   the way, not just to the nearest road. Fix: tracks may route to
   the nearest OTHER track node as well as the road, so villages chain.
3. ROAD LENGTH (15k px vs 21.5k at the same node count). His edges
   are fewer and LONGER - the 30% bend is terrain being followed. Ours
   are straighter and shorter at any climb dial. Fix is in 1: fewer,
   through-routed edges naturally lengthen.

Everything above is measured, not felt, and the tool re-reads it in
one command. 44 unrouted pairs on the real map at these dials - names
in the boot log (ROADS 8) - most of them islands and the far north.

## ROADS 17/18 - a town is entered once, and a join is wide (2026-09-02)

The first structural gap ROADS 16 named, closed and measured. Every
hairpin in our roads was a town pixel with two spurs arriving from
adjacent directions, and our right angles were the same convergence a
step out. Two rules: a road reaching an existing road within
`mergeNear` (3 px) of its destination town JOINS it there rather than
laying a second spur - the through-road rule, a town is entered once;
and a new bit may only join an existing mask if every bit already there
is at least `joinAngle` compass points away, so a junction is wide the
way his are (his towns: 55% two bits, 29% three). Measured on the real
map: right angles 8.1% -> 0.9% (his 1.7%), hairpins 3.2% -> 0.0% (his
0.0%), junctions 9.2% -> 6.5% (his 4.4%). Road pixels 15.3k -> 14.0k:
the second spurs were a thousand pixels of duplicate road. The remaining
gaps are the track webs (dead-ends 29% vs 7%) and road length.

## ROADS 19 - built once per map (2026-09-02)

Item 8, un-parked by Audit 52's number: 4.4 seconds of routing before
the first terrain chunk, every boot, for a result that is the same
whenever its inputs are. The worker builds through `roadsCache.js`:
IndexedDB, keyed on everything that shapes the network - a generator
version bumped by hand when the logic changes shape, the dials
serialised (so a turned dial invalidates without a bump), the
settlement list's fingerprint (its length and a sum over pixels and
types - MAPS.BSA's content as far as roads are concerned), and the
heightmap's length. A hit skips the build; a miss pays it once and
stores it; a store that cannot open is a miss, never an error. The
store is injectable, which is what lets the law be pinned in node. A
job that arrives during the lookup queues behind it, as it queued
behind the synchronous build, so no chunk is ever roadless. The boot
log's stats carry `cached: true` on a hit.

## ROADS 25 - the first pixels were painted before the network landed (2026-09-03)

Mac: "some roads are missing even though they show on the map." The
network loads asynchronously (`loadModRoads().then(...)`) while the
world starts building terrain at once, so the first pixels - the ones
around the spawn - were painted with `roads = null` and then KEPT. The
map rebuilt itself when the network landed (ROADS 7's grid-cache key);
the terrain never did. The generator now says whether a network was
present (`withRoads`), the host keeps it on the pixel, and when the
network lands every pixel painted without one is torn down and
rebuilt - on both arrival paths, since the mod-data path returns
early. A pixel already in flight when the network landed arrives
roadless after the sweep and goes straight back, the worker having the
network by then because message order is kept. Pinned; three mutants
dead, one of them the early return that would have skipped the sweep
on the common path.

## ROADS 26 - the sweep is the frame's, and it puts the pixels back (2026-09-05)

Mac: "when using the test section, you can sometimes spawn outside of
the dungeon in the world, in the ground." ROADS 25's sweep ran the
moment `loadModRoads()` resolved - anywhere `bootWorld` yields - and it
never put a pixel BACK: `destroyPixel` neither releases the key from the
streamer nor re-queues it, and `StreamingWorldState._loadList` skips
every key it still holds as loaded, so a swept pixel was a HOLE until
the ring walked away and came back. ROADS 25's "the stream rebuilds it"
was never true. Two endings, sorted by the adversarial review below:

1. A NETWORK LANDING UNDER A STANDING PLAYER took the collider bucket
   and the terrain floor out from under them (`heightAt` answers
   -Infinity for a key that left `built`) and nothing rebuilt it: the
   fall through the world, "in the ground". Any exterior stand - the
   ride, a walk, the world after a dungeon exit.
2. A NETWORK LANDING INSIDE THE BOOT WALK, between the start pixel's
   first build and the classic start's arm (`bootWorld` yields there at
   `await loadQuestPack()` and the NPC stand loop, and inside
   `buildPixel` itself after the pixel published), took the start
   pixel's doors with it, so `startInDungeon` found no DUNGEON_ENTRANCE
   and the boot "started outside" - onto a spawn gate
   (`src/scenes/world.js:6505`) that waits for a start pixel nobody
   would rebuild. A dead boot: the camera frozen thirty units up over
   a hole, every input dead.

The fix is the season re-skin's own shape (ROAD-Ar R0). The arrival
only raises a flag (`rebuildRoadless`, `src/scenes/world.js:411`); the
sweep is `tickRoadsSweep` (`src/scenes/world.js:1381-1399`), called
ONCE, on the exterior frame between two builds, before `pump()` takes
the next (`src/scenes/world.js:6820`): it waits out the same publish
hazard `tickSeason` does, arms the R0 hold BEFORE the ground goes,
tears down only the roadless pixels, and puts them back at the FRONT
of the queue, nearest-first. In a dungeon or a building the exterior
frame does not run, so the sweep waits for the exit, which lands on
the pixel that still stands and is then held and rebuilt like any
other. The classic arm is untouched by the sweep: nothing tears the
start pixel down before it asks for the door.

### ROADS 26b - what the adversarial review found (2026-09-05)

Seventy-one agents over five lenses (refute the diagnosis, alternative
causes, break the fix, regressions, does the mechanism fit the words),
every finding cross-checked by two independent skeptics. Sixteen
survived; the code fix stood, the first record's story did not, and
six defects were fixed on the same day:

- THE FIRST RECORD'S STORY WAS WRONG TWICE. It had ending 2 finishing
  with the player stood "at the pixel centre, inside the entrance
  model". The gate never fires in that ordering (above), and the boot
  camera for a location pixel is not the pixel centre at all: it
  stands 120 units past the location's footprint
  (`src/scenes/world.js:4219`), on bare terrain. Corrected here, in
  the source comment and in the pin's header.
- THE DUNGEON STAND NEVER SPENT THE BOOT GATE. Every landing in this
  host sets `playerSpawned` except the classic dungeon start:
  `worldModes.tryEnterDungeon` stands the player with a bare
  `player.spawn` and has no handle on the flag, so the boot gate stayed
  armed through the whole dungeon visit and fired on the first
  exterior frame after the exit, re-flooring the player at the
  camera's x/z over PositionPlayerToDungeonExit's own landing. Now
  `if (entered) playerSpawned = true;` (`src/scenes/world.js:6205`) -
  a boot gate, spent by the boot that stood the player underground.
- THE SECOND ROADS MISS CRASHED THE BUILD. `buildPixelNow`'s retry arm
  tore the pixel down and then read `_stride` off the entry it had just
  deleted - the ROADS 25a crash back by another door, reachable
  whenever `hasRoads` is true with no network behind it (a failed bake
  leaves every pixel roadless for the session). The second miss now
  keeps the pixel as painted (`src/scenes/world.js:1087`); a world
  without roads is ROADS 3's promise, no world is not.
- THE HOLD COVERED ONE PIXEL WHILE THE RING WAS STILL HOLES. The sweep
  tore down every roadless pixel but held the motor only until the
  player's own came back - first, by nearest-first - and freed it one
  step from a neighbour still torn down. R0's season re-skin had the
  same shape. Both now take ONE plan, `src/world/pixelRebuild.js`
  (`planPixelRebuild`: the rebuild order, the hold key, the ring), and
  the release (`src/scenes/world.js:6484-6502`) waits for the
  player's pixel AND every swept pixel within one of it (`_holdRing`,
  `src/scenes/world.js:1341`).
- THE HOLD WAS KEYED ON THE EYE, THE RE-FLOOR READ THE FEET. `state
  .current` is derived from the interpolated eye plus the head-bob;
  `heightAt(player.pos)` resolves the feet's pixel; at a seam they
  differ, so the arm could name a pixel the release never reads. Both
  tearers now key the hold on `feetPixelKey()`
  (`src/scenes/world.js:1345`), the inverse map `heightAt` uses.
- THE RE-FLOOR COULD LIFT ONTO A ROOF. `floorLanding` answers the
  HIGHEST mesh a five-ray footprint finds, so a release under any
  overhang stood the player on it - the wedge R0 was written against.
  The lift is now the terrain sample alone: feet under the surface go
  to the surface, feet on or above it re-anchor exactly where they
  were.
- THE PINS DID NOT BIND THE CALL SITE. A second `tickRoadsSweep()` in
  the boot walk (Mac's bug verbatim) and a never-true gate on the frame
  call both passed. The pin now requires exactly one call, inside
  `frame()`, after the streamer's step, unconditional; the plan is
  tested behaviourally (order, hold, ring, the no-player and
  neighbour-only cases); eight mutants dead - the boot-walk call, the
  gate, the eye-keyed hold, the ring-less release, the destroying retry,
  the eye at the release, the unspent boot gate, the mesh lift.

Recorded, not changed: for the one build after a dungeon exit the
swept start pixel's doors are out of `buildingDoors`, so the entrance
the player just left does not answer an activation until it republishes
- the motor is held for exactly that span. Rejected by the review:
the pixel-centre stand as the "in the ground" hazard (the boot camera
is outside the footprint), StartInDungeon-off as a route to it (same),
a missing ARCH3D model taking the entrance with it, `dungeonLocationFor`
throwing (main-story dungeons never shrink), the ride's IIFE race, a
stale `?classicload`, and the shot probes draining mid-sweep.
