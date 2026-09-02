# Audit 46 - Roads 1-12, everything so far

Mac, 2026-09-02: "Comprehensive audit on everything so far." Roads 1
through 12 and Audit 45's own fixes, read and run. Method as Audit 45's:
nothing below was decided by inspection alone.

## The sweep first

Twenty-one mutants across every road module - the network, the
painter, the producer, the surface, the client - each deleting one
load-bearing line: spanning tree, water refusal, climb, box growth, turn
cost, towns-as-intermediates, corner cutting, track merging, heuristic
admissibility, the track-grade set, the partner bit; north row, cap
orientation, smoother mark, location rect, water in the painter's table;
the producer's water rule, region restore, names; the road surface by
record; a same-thread path's roads. **21 of 21 dead.** Every one of
those lines has a pin that fails without it. That is the baseline this
audit stands on.

## Findings

**A1 - MEDIUM, FIXED. The map indexed the mask at the window's stride.**
`pathAt` used `this._size.width` to index the road arrays, and the
arrays are the world's 1000 wide. `_size` is overridable through
`deps.mapSize` and the overworld's own tests pass 10x10, so a window at
any other size would have sheared the network across the relief. Fixed
to `MAP_WIDTH` with an out-of-world guard; pinned at the source.

**A10 - CLEARED BY ORDERING, PINNED. No chunk is ever built without the
network.** The suspicion: terrain streamed before the worker finished
the build would be roadless around the start position, and nothing
regenerates it. The worker handles messages in order - init, roads (a
synchronous build), then jobs - and world.js posts setRoads in the same
synchronous block as the client's construction, before any frame can
post a job. So the first job waits for the network. Pinned: setRoads
follows construction, precedes the first generate, no await between.
The same-thread fallback builds before every generate.

**A3 - LOW, RECORDED. The smoother and the location plateau share
corners.** `blendLocationTerrain` flattens a location's rect; the road
stops at that rect, but the last road tile's corners lie ON the
plateau's boundary line and the smoother blurs them with the terrain
outside. A step of a sample or two at a town's edge where a road
arrives. DFU's own blend is a gradient there anyway; watch for it in
play before treating it.

**A9 - LOW, RECORDED. A* allocates per route.** The heading-carrying
state is cell x 8 across three typed arrays, allocated fresh for every
route; ~300KB for a 40-pixel edge, a few megabytes at the 120-pixel
retry, times every edge. One-time and off the frame, but it is
gigabytes of churn on a dense map. If Mac's boot log's `ms` is large,
a reusable arena sized to the largest box is the fix, not a smaller
box.

**A4 - LOW, RECORDED. The track tiles are the design's numbers, unseen.**
11/12 on grass and 26/27 on stone are the tileset indices the design
uses for a worn track; they are Daggerfall's own tiles, but no fixture
here draws them and their look is Mac's to confirm.

**A11 - CLOSED (ROADS 13). The classic window now draws by those two
flags.** Original text: filterRoads/filterTracks ride the shared store and the save
envelope for both skins; the classic 2D map has no road chips and
draws no roads (the ROADS 7 gap). Harmless, and the gap is the thing.

## Cleared

- A2: the worker posts a fresh copy of the arrays back and keeps its
  own; the originals are never transferred away.
- A5: a track's tiles are ordinary blend records in the enhanced skin
  and draw as dirt through grass, which is what a track is.
- A6: init is posted at construction, before setRoads.
- A7: a new game constructs a new client and a new worker; no stale
  network survives a world.
- A8: blocking ~15,000 location pixels as intermediates costs one byte
  each and nothing in the search.
- Toggle re-upload: a chip rebuilds and re-uploads the 500k-vertex
  relief; tens of milliseconds, once per click.

## Standing

Roads 1-12 sound at the source and under the sweep. Three things only
the real map can answer, in the order they matter: the boot log's
`unrouted` and `ms`; whether roads climb where they should not
(ROAD_DIALS); whether the track tiles and the road surface read right
beside real ground. The classic 2D map drawing roads is the one open
piece of the feature as asked.
