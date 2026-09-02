# Audit 45 - Roads 1-3, the deep pass

Mac, 2026-09-01: "Lets do a deep comprehensive audit on this." The
three roads slices audited the hour they landed, by the method Audit 42
made law where a browser is involved and by reading and RUNNING where it
is not: every suspicion below was either executed against a fixture or
traced to the line that clears it. Nothing here was decided by
inspection alone, because inspection alone is how MW-D48's non-bug got
called a bug.

## Cleared - checked and found sound

**The marching squares do not erase the roads.** `assignTiles`
(terrainTiles.js:180) skips any non-zero tile, not just the 0xFF
location tiles - so tile 46 written before it survives it. This was the
audit's first suspect because DFU's job carries the same guard and a
port that had narrowed it to 0xFF would paint roads and then erase
them, with every pin green.

**The rotate and flip bits are honoured.** `convertTilemap`
(terrainSurface.js:7-15) folds bits 6 and 7 the DFU way. The painter's
64/128 addends land in the renderer.

**One seam reaches every pixel.** `generatePixelTerrain` has one
caller, `TerrainGenClient`, constructed once in world.js. The four-hosts
rule is satisfied by there being one host that streams terrain.

**North is row 127.** terrainSampler.js:150-151 states the continuity
law, the painter cites it, the pin drives N alone and reads row 127.

**The line is held.** No byte of Hazelnut's data is in the tree; the
tile indices (46/47/55, 11/12/26/27) are DFU's own tileset in the
player's ARENA2; the direction layout is a compass rose. Credited as
prior art in Roads.md.

## Findings

**F1 - HIGH. Farms and estates were track-grade.** `TRACK_TYPES`
carried HomeFarms and HomeWealthy. Farms are the most numerous location
type on the map, in the thousands; a dirt track to every one blankets
the countryside in ruts and costs a thousand A* runs at boot. Basic
Roads' whole track network is 30,000 pixels; ours would have dwarfed it
for the wrong reason. A farm sits in the fields it works and the track
stops at the village. FIXED: villages, taverns and temples are the
track-grade set; the two exclusions carry their reason in the code so
the set is not "completed" by the next reader. Pinned on the set and on
a farm beside a town getting nothing while a village does.

**F2 - MEDIUM. The build ran on the main thread at world boot.** The
producer called `buildRoadNetwork` synchronously in world.js before the
first frame - thousands of A* runs on the thread the frame owns, while
a terrain WORKER that already holds the small heightmap sat idle. FIXED:
the host enumerates settlements (that needs MAPS.BSA, which only this
thread has) and posts the LIST; the worker builds with its own woods and
posts the stats back; the main thread builds lazily and once, only on a
fallback path, and every one of the three same-thread paths calls that
fallback first. The pin counts the paths. Nothing crosses the wire but
a list of small objects and, back, a stats record.

**F3 - LOW. The A* heuristic was inadmissible.** The road discount makes
a step cost 0.5 and the Euclidean heuristic assumes 1, so h could
overestimate and A* can then pop the goal off a dearer path than the
merge it exists to find. FIXED: h is scaled by the discount. RECORDED
HONESTLY: on the fixture built to show it, both heuristics find the same
41 steps - an inadmissible h MAY miss the optimum, it does not always -
so the behaviour is a regression guard and the guarantee is pinned at
the source.

**F6 - LOW. Tracks could not merge with tracks.** The track pass handed
A* the ROAD mask as `existing` and `stopOn`, so two villages a mile
apart wore parallel ruts to the same town. FIXED: the pass keeps a union
of roads and tracks-so-far and routes against that; a track stops on
any path and gets the discount on any path. Pinned: two adjacent
villages share the last mile (40 cells against ~58 independent).

**F4 - LOW, RECORDED, NOT FIXED. No cap tile on a dead-end arm.** Basic
Roads paints a DiagOut tile at the centre where a cardinal arm ends
(a road that comes in from the north and stops). Ours ends square. A
visual refinement for ROADS 4 alongside the enhanced surface, where the
look is decided.

**F5 - LOW, CORRECTED (ROADS 11). `settlementsOf` does NOT hold 62 regions.** MapsFile.autoDiscard is on by default - DFU's own design - so each loadRegion drops the previous one and the sweep holds one region at a time. The finding as first written was a misreading of the reader. Its one real cost, dropping whichever region was loaded before the sweep, is repaired by putting that region back afterwards. Original text follows for the record:
`getRegion` calls `loadRegion`; the port has `discardRegion` for a
reason. Each region's table is small and they are needed once; if
memory says otherwise, the producer can discard as it goes.

**F7 - LOW, RECORDED. Unrouted edges are a count, not a list.** The
stats say how many; they do not say which town has no road. When Mac's
first real build reports a non-zero unrouted, the next step is naming
them, and the settlement rows carry the region index for it.

**F8 - LOW, FIXED (ROADS 11). `write`'s 0xff arm is unreachable - removed.** No tile in
any table is 0, so `v === 0` never fires. Kept as the guard it is;
noted so nobody wonders what it protects.

## What the audit found about its own fixes

The mutation sweep was run BEFORE the fixes were pinned and all three
survived deletion: F1, F3 and F6 were each fixed and none was pinned.
That is the vacuous shape this bible catches most often and it was
caught here in the audit that exists to catch it. The pins were written
second and the sweep re-run: F1 and F6 die, F3 dies at the source.

Two fixture lessons carried in from the slices themselves, recorded
because the audit re-hit one: a lake beside the route pins nothing; a
lake that is also a PIT is refused by the climb dial and the water rule
is never on trial; and a dungeon placed ON the line between two towns
gets a road through its pixel by geometry, which is fine, and fails a
pin that meant "no path TO it". The fixture moved; the pin's intent
stands.

## Method

Read against DFU's TerrainHelper for the seam, against Basic Roads'
BasicRoadsTexturing.cs for the design (MIT, read not copied), and RUN:
every finding has a fixture that fails without its fix except F3,
which is recorded as the guarantee it is. 15 pins in roads.test.js; 9
mutants across the three slices and this audit, 9 dead.

## Standing

Roads 1-3 are sound. The network has not yet been seen on real data -
no ARENA2 in the build container - and Mac's first boot log
(`[roads] N towns, N roads, N tracks, N unrouted, Nms`) is the next
measurement. If routes climb, ROAD_DIALS; if unrouted is non-zero, F7.
