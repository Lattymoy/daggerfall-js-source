# Audit 50 - Roads 19-20 and the whole, before the track webs

Mac, 2026-09-02: "Comprehensive audit and additionally ensure road
width matches what the mod has." The width first, because it was a
finding before the audit started.

## A1 - HIGH, FIXED. Our roads were four tiles across; the mod's are two.

Read from the mod's own painter, not recalled: its cardinal-outer table
entry is `null` for roads and for tracks. A cardinal road is two tiles
of 46 and nothing beside them; the edge tiles 47/55 are used on the
DIAGONAL's flanks only. Our painter laid an edge column each side of
every cardinal arm since ROADS 2 - the design read from a description
rather than the table - so every straight road on Mac's map was twice
the mod's width. That is what he saw.

Two more table mismatches came out with it: a track's diagonal inner is
51/52 in the mod (ours used the cardinal's 11/26 there), and a track's
inside 90-degree corner takes 10/25 at the inner elbow - the mod's
ICorner, decided before the arm because with no cardinal outer the
elbow tile IS the arm's centre and the mod overwrites it. Roads have no
corner tile. All three pinned; three mutants dead (edge back, 11/26
back, corner off). The calibration table is unchanged by a painter fix,
as it should be.

## A2 - MEDIUM, RECORDED. The painter draws a ring road the mod does not.

`paintRing` (ROADS 5, the other instance's) lays a road annulus around
every location rect with an edge band outside it. The mod has no such
routine: its towns are ringed by the DATA - a through-road detouring
through the town's neighbouring pixels, ROADS 6's finding - and inside
a pixel a road simply stops at the location rect. Under "as close as
we can to the mod", the painter ring is a departure. It is pinned and
working, so it is not removed in an audit; it is named here as the one
piece of the painter that is ours rather than his, for Mac to keep or
drop by eye. Its edge band now uses the diagonal-edge table, the only
edge tiles the mod has.

## The sweep

ROADS 19 (the cache): a key that ignores the towns' pixels and the
dials - DEAD. ROADS 20: three mutants above - DEAD. ROADS 14-18 were
swept in Audit 52 (originally 49) and their pins are unchanged.

## Cleared

- The cache's ordering law: a job arriving during the IndexedDB lookup
  queues behind it and re-enters the same handler; no chunk is ever
  roadless. Pinned at the source, and the worker's handler is now a
  named function so a deferred job can re-enter it.
- The real-map table reproduces to the pixel after ROADS 19 and 20:
  14,012 road pixels, right angles 0.9%, hairpins 0, junctions 6.5%.
- EV7's import list carries the cache with its reason.

## Standing

Against the mod, per tile: cardinal width, diagonal width, the diagonal
flanks, the cap, the track corner, the track tables - all his. Against
the mod, per pixel: right angles under his, hairpins none, junctions
6.5% to his 4.4%, bends 25% to his 30%, road pixels 14.0k to his 21.5k.
The two structural gaps from ROADS 16 stand: the track webs (dead-ends
29% vs 7%) and road length. The webs are next. Rivers parked.
