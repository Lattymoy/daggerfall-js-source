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

## Open

- ROADS 3: the boot-time producer - read the map table and the small
  heightmap from the player's own archives, build once, cache in
  IndexedDB keyed on a version and the archive's size, hand the arrays
  to the terrain client. Until then nothing is drawn.
- ROADS 4: the enhanced skin's own road SURFACE from the ground proto's
  pixel-art ramp, beside grass and stone. Classic draws tile 46 from
  the player's ARENA2, which is exactly what the original draws.
- ROADS 5: the travel-map overlay.
- Rivers and streams: the same painter with water tiles, off by default
  as the original ships them. Their data would also be ours to derive.
- Ringing a location (the original's roads circle a town because they
  never line up with its gates): a refinement once the network draws.
- The heightmap smoothing pass under road tiles, behind a setting.
