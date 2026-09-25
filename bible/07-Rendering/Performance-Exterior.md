# PERF-EXT — the exterior's frame, made fast in code

*2026-09-25. Two players, relayed by Mac: "fps issues in the exterior but
fine in the interior" (an RTX 4060 Ti), and "me too my friend.. don't know
why. I got a RX6600". PERF-SCALE (`01-Overview/Field-Bugs-2026-09-25.md`)
gave them a render scale and a counter that names the GPU; Mac then:
"Why are you so avoidant when it comes to addressing performance issues? I
am not getting another player to do the work that youre suppose to do".*

This pass was found and proven before it was written: each change below
was measured on the real modules by one lane and re-measured against it by
another, and each landed only with the same harness re-run on the change.
The harnesses are node scripts over the real modules on a recording fake
GL (and, where the question is about the browser's frame, headless
Chromium); there is no game data in the container, so where a size depends
on ARCH3D it is a synthetic one and the ms scale with the real count. All
timings are one 4-core 2.1 GHz Xeon; a gamer's desktop is 1.5-2x faster,
and the RATIOS are the claim.

## Cluster C — the streaming hitches

PERF-EXT20 to PERF-EXT26. The seven commits that landed them name them
PERF-EXT-C1 to PERF-EXT-C7; the review renamed them into the pass's one
sequence (`The review of cluster C`, below, has the map).

The frames that freeze when you cross into a new map pixel or ride into a
town. Nothing in `?perf=cpu` showed them: the steady frame is what it
measures, and these are the frames around a crossing - every ~3 minutes
on foot, oftener riding - which is exactly the "fine indoors" the players
describe (an interior streams nothing).

### PERF-EXT20 — the grass field's slot count is swept once

`discSlotCount` (render/labGrass.js, PERF10) answers how many 30 m cells
the grass's disc can hold - 394 for the shipped span, a pure function of
(radius, cell, steps) - by a 240-step sweep that takes 11-33 ms. Every
`createGrassField` paid it: the boot, every teleport and quickload, and
every pixel crossing, on the crossing frame itself (`crossingFrame.mjs`:
createGrassField 7.6-11.0 ms of that frame, almost all of it the sweep).

The sweep runs once per question now and a module memo answers the rest;
the world warms it at mount (`if (labGrass) discSlotCount(LAB_GRASS.span)`,
beside the renderer), so no gameplay frame pays even the first. The memo
is labGrass.js's, one entry per distinct (radius, cell, steps) - the game
asks one. Same answer: grasspath.test.js still holds it against the brute
force.

| harness | before | after |
|---|---|---|
| `discSlot.mjs` - discSlotCount(315), three calls | 22.2 / 12.3 / 11.5 ms | 28.1 (the one sweep - the world pays it at mount) / 0.01 / 0.00 ms |
| `crossingFrame.mjs` - createGrassField on the crossing frame, six crossings | 10.6 / 11.0 / 8.2 / 7.8 / 7.6 / 7.7 ms | 0.1 ms each |

Pins: `test/grassshift.test.js` PERF-EXT20 (the sweep counter: two fields, at most
one sweep; four distinct questions, four sweeps; the world's warm).
Mutants: `tools/mutants/perfextc.json` PERF-EXT20 x4, all dead.

### PERF-EXT21 — the grass field survives the floating-origin shift

**Before.** Every map-pixel crossing is a floating-origin shift
(streamingWorld moves the scene 819.2 units), and the world host answered
it with `labGrassField = null` (AUDIT 49 F2 / GR5): the field was keyed on
SCENE coordinates, and 819.2 is 27 cells and 9.2 m, so no cell survived
the move. The next frame built a new field - three `bufferData`
re-specifying 38.6 MB - and refilled it two cells a frame. On the crossing
frame the grass drew 2 slots of 357; it then regrew nearest-first over
~176 frames, +5-7.5 ms of main thread a frame for three seconds, 34.6 MB
of `bufferSubData`, and came back reshuffled (0 of 352 slots where they
had stood). Every ~3 minutes walking, ~1.7 running, oftener riding: the
exterior's slowdown, and never indoors.

**After.** The field has an origin of its own: `(gx, gz)`, where its cell
(0, 0) stands in the scene, doubles, starting at 0. `shiftOrigin(offset)`
adds the offset to it and has the renderer move every standing slot's
decode frame and culling box in place (`LabGrassRenderer.shiftSlots`,
O(394), no upload - the packed lanes are cell-local). `update`,
`invalidate` and the nearest-point test ask the field's grid of a scene
position; `placeLabGrassCell` places a blade in the field's frame exactly
as before and adds the origin only for the scene position keep()/ground()
are asked about - so the GRASS6 tint is the field's patch and the same
bits a field that never moved would bake. `slotFrame` is a Float64Array,
so a moved frame rounds to float32 once, at the upload, where every frame
rounded before; written unshifted it uploads the same bits. world.js's
shift block calls `labGrassField?.shiftOrigin(r.offset)`.

**Every heal the crossing gave by accident is now said on purpose.** The
rebuild was quietly the cure for every stale cell: one placed at the boot
or after a teleport before its neighbour pixel existed (its blades over
the gap refused), one under a pixel rebuilt by the road network, a
season's re-skin or a late World of Daggerfall pack. So:
- the publish invalidates the grass over EVERY published pixel (it was a
  location's or a WoD site's only) - a far pixel's rect holds no live
  cell and costs a few hundred Map reads;
- `restrideTerrain` invalidates a pixel promoted to stride 1 (the grass's
  near pieces are the stride-1 ones);
- `_teleportToPixel` empties the field with the scene sweep before
  `state.init` re-anchors the frame. It never did: a fast travel or a
  quickload kept drawing the old place's cells within 315 m of the new
  eye, at the old heights, until the first crossing threw them away.

**What still moves at a crossing, as it always did.** In the pixel style
each tuft's sprite variant is `hash(root * 0.37)` of the scene root and
the gust's wave reads `dot(root, wdir)` - both are the lab's shader text
(GR1's byte-exact law) and both jump by the offset on the crossing frame.
The vanish, the three-second regrow and the reshuffle are gone; those two
are named, not claimed away.

**The four hosts.** The grass field lives in `scenes/world.js` alone -
wired. `scenes/exterior.js`, `scenes/worldModes.js` and
`scenes/dungeonContext.js` hold no grass field and stream no pixels:
nothing to wire, flagged here by name.

| harness | before (base) | after (this tree) |
|---|---|---|
| `shiftProof.mjs` - the crossing frame | createGrassField 11.68 ms + first update 12.47 ms; drew 2 slots of 357 | shiftOrigin 0.25-0.29 ms + first update 0.21-0.27 ms; drew 357 of 357 |
| `shiftProof.mjs` - after the crossing | 176 frames to settle, 1,057.7 ms of update(); 3 bufferData, 1,056 bufferSubData | 1 frame, 0.3 ms; 0 bufferData, 0 bufferSubData |
| `shiftProof.mjs` - the picture | 0 of 352 slots where they stood | 352 of 357 identical moved by the offset, the rest within 1.83e-5 m (float32 of the moved origin) |
| `grassCrossing.mjs` (all-grass ring) - the refill a crossing paid | 177 frames, 1,171.9 ms, median 6.46 ms a frame, 34.6 MB re-uploaded | not paid: the crossing builds no field (the harness scripts the old rebuild; `shiftProof.mjs` runs the new path) |
| `walkEquiv.mjs` - a crossed field walking a world path against one that never moved | - | 368/368 the same cell keys; 354/354 drawn slots have a twin within 1 mm (worst 1.71e-4 m) |

Pins: `test/grassshift.test.js` PERF-EXT21 x4 - the crossing (three offsets: east,
a vertical recentre, south) re-specifies nothing, uploads nothing and
draws every slot moved by the offset; a crossed field grows the same
world, cell for cell and tint for tint, as one that never moved;
invalidate after a shift drops exactly the cells whose squares meet the
scene rect; and the host's four sites. Three source pins changed on
purpose: `labGrass.test.js` AUDIT 49 F2 / GR2 / GR5 (the shift reaches the
field; the teleport empties it), `audit_wod_branch.test.js` m2 and
`wod2_loader.test.js` (every publish re-reads the grass, which covers a
lost site). Mutants: `perfextc.json` PERF-EXT21; `grass2.json`, `grass6.json`
and `grasspath.json` re-aimed by content (the tint's fx/fz, the grid's
origin in nearSq).

### PERF-EXT22 — a walk places its grass rim a slice a frame

**Before.** A walking eye brings grass cells in at the rim - their nearest
point just inside the 300 m range - and each was placed whole on the frame
it arrived: 6,122 candidate blades, ~1.5-2 ms of keep()/ground()/noise
plus ~0.9 ms of pack and upload, two cells a frame at most. On 5-17% of
frames while moving (walk to gallop) that was a 4-8 ms spike, 10 ms at
15 m/s.

**After.** The placer is resumable: `beginGrassCell` is everything before
its loop and `stepGrassCell` runs `budget` more candidates of it - the
loop body word for word, carrying the xorshift word, the candidate index
and the count of blades that stood - and `placeLabGrassCell` is the two
run end to end. However the loop is cut the lanes are the same bytes.
`createGrassField.update` places a rim cell - past `GRASS_WHOLE_AT` (0.55,
the lab shader's own fade start) of the range - `GRASS_SLICE` (1,500)
candidates a frame and writes it the frame it is done, one cell in
progress and one slice a frame. A cell inside the fade's start still comes
whole, and with more than `GRASS_CATCH_UP` (8) cells waiting - a boot, a
teleport, a pixel re-read under the eye - every cell comes whole, two a
frame, at the pace the field always filled at. A half-placed cell is
dropped by a shift (its positions are the old frame's), by an invalidate
over it, and by the eye walking out of reach; it is begun again from the
world as it stands. Total work is the same; it is spread.

**What the eye sees.** A rim cell lands ~4 frames later than it did - a
metre at a gallop, 300 m out, where the draw keeps 0-2% of a cell's
blades. At a boot the last eight rim cells come a slice at a time (211
frames to settle against 180). Nothing else moves.

**Not done: the worker.** The prover measured step 1 (this) and
recommended the worker only as a later step, because the worker needs the
near pixels' samples, tiles, paths, sites and grass records duplicated to
it - the very state every stale-grass bug this field has had lived in
(GRASS-STALE1, GRASS-PATH1, GRASS-WET1, the WoD sites, the stride-1
filter). It was not proven, so it is not built.

| harness (this tree) | before (base) | after |
|---|---|---|
| `grassWalkKeep.mjs` 4.4 m/s, 20 s | update() p99 4.37, max 5.21 ms; keep() max 6,122 a frame | p99 1.35, max 2.06 ms; keep() max 1,500 |
| `grassWalkKeep.mjs` 8.1 m/s | p99 4.55, max 5.43 ms; keep() max 6,122 | p99 1.78, max 3.15 ms; keep() max 1,500 |
| `grassWalkKeep.mjs` 15 m/s | p90 3.83, p99 6.61, max 9.95 ms; keep() max 12,244 | p90 1.12, p99 1.45, max 2.40 ms; keep() max 1,500 |
| the same walks' mean update() | 0.23 / 0.40 / 0.72 ms | 0.24 / 0.41 / 0.73 ms (the same work, spread) |
| the same walks' final field | - | the same cell set (hash-equal at every speed) |
| `slicedTree.mjs` - 200 cells | whole cell median 1.59 ms | slices of 1 / 1,500 / whole byte-identical 20/20, 200/200, 200/200; a 1,500 slice median 0.33, p90 0.49, p99 0.81 ms |
| `cellCost.mjs` - a whole cell (the boot's path) | 2.01-2.05 ms median | 2.02-2.03 ms |

Pins: `test/grassshift.test.js` PERF-EXT22 x3 - the slice/whole byte identity at
1, 777, 1,500 and the whole cell on a crossed field; a walk on a crossed
field asks keep() at most a slice a frame, writes every rim cell with the
bytes a whole placement makes, and ends holding a whole fill's cells plus
the hysteresis' trailing rim; the whole-cell radius is the shader's fade
start, a boot fills two whole cells a frame to its last eight, cells under
the eye come back whole on the frame they are missed, a shift, an
invalidate and a walk away each drop a half-placed cell that then lands,
and a cell no bigger than a slice is never left half placed. Re-stated on
purpose: `labGrass.test.js` GRASS6's order pin reads stepGrassCell (the
loop's home) and GR5's five-metre step is given the frames its rim takes.
Mutants: `perfextc.json` PERF-EXT22 x15, all dead.

### PERF-EXT23 — a pixel's publish tail breathes

**Before.** A streamed pixel's build breathes between its models (PERF7,
`systems/buildBreather.js`), and after the last model it ran its tail in
one piece: the flats loop (each `getTexture` a cached promise - a
microtask, which gives no frame back), `StaticBatchBuilder.finish`
(copying every model's chunk into the merged arrays) and
`renderer.createMesh`'s spheres (boundsOf over the whole mesh and again
over every texture group). Every town, city and WoD pixel, both skins. On
the hunter's synthetic city pixel (3,000 models of 200 vertices, 160
groups; no ARCH3D here, so the ms scale with the real counts) that was
39-66 ms of ONE frame; a town 8-22 ms.

**After.** The merge is a generator (`_merge`) that yields after each
model's copy, after each range of the whole sphere's two passes
(`bounds.js` `boundsSteps`, 8,192 vertices a range) and after each group's
index copy and sphere. `finish()` drains it straight through - the
interior and the dungeon, which merge once at their first frame, keep it;
`finishSliced(breathe)` awaits the breather between units and returns the
spheres too, and `createMesh(merged, { bounds })` takes them instead of
walking the vertices again. The world host awaits
`finishSliced(() => breather.breathe())`, hands the spheres to the upload,
and breathes once per flat group. The arrays and every sphere are the
bytes the unbroken tail made; the pixel publishes a few frames later, the
delay PERF7 already accepts.

**boundsSteps stands beside boundsOf, not inside it.** Cut into range
helpers that both would call, boundsOf ran a third slower on the one
call that is per FRAME - an animated rig's sphere (`renderer.js`, stride
9: 29 -> 40-50 us). So the sliced sphere is its own loop beside it: the
same two passes (a min and a max, then a max from the float32-rounded
centre), which no cut can change, held to boundsOf's bytes on meshes of
every shape by `test/publishtail.test.js` - neither can drift alone.

**Not done: the chunked upload.** The prover's step (d) - a 22.8 MB
`bufferData` split into ~2 MB `bufferSubData` a breath - was left for a
Chrome profile to justify; SwiftShader numbers are relative only.

| harness | before (base) | after (this tree) |
|---|---|---|
| `buildTail.mjs` - city, the unbroken tail | finish 17.3-18.7 + createMesh 22.0-32.6 ms, one frame | - |
| `tailSplit.mjs` - city's pieces | finish 18.7-21.9, whole boundsOf 10.7-18.3, groups' boundsOf 15.2-19.5 ms | - |
| `tailSliced.mjs` - city, 3,309 breaths | (in-run reference: 42.6-66.1 ms one unit) | largest unit 0.29 ms warm (0.89 cold); createMesh(bounds) 0.07-0.10 ms; byte-identical |
| `tailSliced.mjs` - town, 791 breaths | (in-run reference: 8.4-21.7 ms) | largest unit 0.23 ms warm (2.30 cold); byte-identical |
| `unitDist.mjs` - city, every unit | - | p99 0.16-0.21 ms; the odd 1-2 ms unit is a collection or the first, uncompiled range |
| `boundsBench.mjs` - boundsOf itself | rig 29-36 us, mesh 192-220 us | unchanged (boundsOf is byte for byte what it was) |

Pins: `test/publishtail.test.js` (4) - boundsSteps is boundsOf's bytes on
empty, single, large and extreme-at-either-end meshes at ranges of 1, 7,
256, BOUNDS_RANGE and whole, with a yield per range; finishSliced gives
finish()'s arrays and groups (mirrored placements among them) and
createMesh's spheres byte for byte, with a breath per model, range and
group; createMesh handed the spheres keeps them and reads no vertex, and
handed none measures as before; the host's three sites. Re-stated on
purpose: `perf4.test.js` ("uploaded once at the end") and
`wod4_privateershold.test.js` (the camp is batched before the merge).
Mutants: `perfextc.json` PERF-EXT23 x13, all dead; `el5.json`'s two createMesh
records re-aimed by content.

### PERF-EXT24 — the build slice is what the frame left, and the meter sees it

**Before.** The stream's breather (PERF7) lent a flat 6 ms slice a frame.
It resumes inside its own animation-frame callback, which the browser runs
in the SAME rendering opportunity as the frame's (60 of 60 resumptions
carried the frame's timestamp - the hunter's `sliceProbe.mjs`, headless
Chromium), so the slice sat on top of the frame: any frame over ~8.7 ms
of script missed vsync while a pixel built. And it ran after the frame's
`frameEnd` and after `?perf=cpu`'s `stopCpu`, so the FPS counter's script
ms, `frameCpu` and `?perf=cpu` had never once seen the stream -
PERF-TOWN1 read `sim` as steady and the stream as harmless for that
reason.

**After.** `createBreather` takes a `budget` asked once a slice, and the
world host sizes it with `frameFitBudget`: the frame clock's median frame
interval (`frameInterval`, off the rAF stamps - 16.7 at 60 Hz, 6.9 at
144, measured rather than assumed) less the last frame's own script
(`lastBusy`) less 2.5 ms, between 3 ms (the prover's floor, not the
hunter's 1) and 6. A build something waits on - the boot's first pixel,
a teleport's, each through `awaitedBuild` - lends the whole 6, and so
does a stream that has run two seconds. Every slice the breather can
vouch for is lent back - one its own resume began and no frame ran
inside (`framesBegun`, the frame clock's count): `lendFrame` folds it
into the next frame-clock sample (so the counter's script ms includes
it; `lastBusy` does not, or the slice would starve itself) and
`?perf=cpu` shows it as a `build` span (`PerfMeter.addCpu`). A pixel's
first slice, which a reset begins inside the pump's frame and the
terrain worker's round trip stretches across frames, is not lent: the
counter reads it low, never high by a wait a frame ran through (a fetch
that settles before the next frame begins still counts - said in
`systems/buildBreather.js`).

**THE TRADE-OFF, stated - Mac should weigh it.** Nothing about what is
built changes. But while the frame's script is over ~11 ms a streamed
pixel builds at up to half the pace, bounded by the two-second guard: a
crossing's new pixels arrive up to twice as late. The far ring punches
its hole for the whole streamed rect at the crossing (`farRing.js`
`punchHole`), so in clear weather the notch at the fog's edge over an
unbuilt pixel stays open that much longer. That is visible, and it is
not claimed away. `BUILD_SLICE_FLOOR_MS` and `BUILD_STREAM_AGE_MS`
(`systems/buildBreather.js`) are the two knobs.

| `sliceTree.mjs` (headless Chromium, relative only) | frame JS 9 ms | 12 ms | 14 ms | 18 ms |
|---|---|---|---|---|
| no build | 60 fps | 60 | 59.7 | 55.0 |
| before: the flat 6 ms slice | 60 (4.9 ms built a frame) | 54.9 (4.97) | 49.5 (4.96) | 41.4 (4.99) |
| after: what the frame left | 59.4 (4.3) | 60 (2.48) | 57.7 (2.48) | 47.0 (2.50) |

Pins: `test/buildslice.test.js` (7) - frameFitBudget's arithmetic, its
floor, its ceiling, 144 and 30 Hz, the age guard at 1,999/2,001 ms, the
awaited build and a NaN; the breather asks once a slice, yields at the
budget and not before, reports a slice its resume began, and without a
budget keeps PERF7's slice; the frame clock's median interval ignores a hitch,
lastBusy excludes a lent slice, a lent slice lands in ONE sample, a
negative one is not lent; the CPU meter's `build` bucket and the GPU
meter's silence; the host's budget, lend and pump; and the review's two
(below). Re-stated on purpose:
`perf7.test.js`'s host pin and `terrainscale1.test.js`'s slice marker
(the breather takes options). Mutants: `perfextc.json` PERF-EXT24 x18, all dead;
`terrainscale1.json`'s two BF1 records re-aimed by content.

### PERF-EXT25 — a collider cell's key is a number

**Before.** Every triangle a streamed pixel files into the collider
(`player/collider.js` `addMesh`, per model of every pixel, both skins)
minted a template string per covered cell - `${gx},${gz}` - to hash, look
up and drop, and a fourth array a triangle (`for (const v of [a, b, c])`)
to grow the bucket's bounds; every point query and ray minted a string per
cell it read. On the synthetic city pixel (3,000 models, 300,000
triangles) the insert was ~1.07 s of main thread across the build.

**After.** `cellKey(gx, gz) = (gx + 2^20) * 2^21 + (gz + 2^20)`, exact in a
double and one-to-one for |g| < 2^20 cells (two million units on the fine
grid, sixty-seven million on the coarse; a bucket's coordinates are
pixel-local, in the thousands), used by the two filings and the four
lookups; the corners are walked by index. The grid is a BROAD phase: two
cells that shared a key could only hand a query more triangles for the
narrow phase to refuse, never fewer - and none do. Every answer is the
same bits.

**Not done: V2, the Float64Array triangle store.** The prover measured it
only as the hunter's INSERT-ONLY prototype (`colliderProto.mjs` VAR=2,
which never ran a query), and stated that it rewrites every narrow phase
(`raycastHit` and its best triangle, `_resolveSphere`, `capsuleCast`,
`sphereOverlaps`, navBake's reader) and needs the full differential before
it could land. Collision is a 1:1 port surface; unproven, it is not
built.

| harness | before (base) | after (this tree) |
|---|---|---|
| `colliderInsert.mjs` - 300,000 triangles, two runs | insert 1,067-1,073 ms; per model median 0.191-0.194 ms | 743-783 ms; 0.089-0.100 ms |
| the same - GC during the insert | 60-61 collections, 395-432 ms | 51-52 collections, 419-428 ms (the pauses are noise) |
| `tools/guardCostProbe.mjs 5 1200 12` - five guards, three runs | mean 0.891-1.005 ms, median 0.662-0.702 | mean 0.823-0.929 ms, median 0.588-0.653 (the query side, ~7-10% - the prover read no change) |

Pins: `test/colliderkeys.test.js` (3) - every bucket of a scene with fine,
coarse-filed and short-listed triangles, at positive and negative cells,
holds cell for cell (decoded) the triangle lists of the OLD string-keyed
filing, kept verbatim in the test with collider.js's constants read from
it; every overlap on a lattice across coarse boundaries either side of
zero, and every ray, answers exactly as a twin whose every cell holds
every triangle (the soup walked whole - true by design on the base too:
a GUARD, not a pin, and the test's title and the file header say so -
it is there for the lookup mutants); the key's formula, its one-to-one-ness at the
corners of its range, and no template literal or corner array left.
Mutants: `perfextc.json` PERF-EXT25 x8, all dead.

### PERF-EXT26 — STREAM1's promotions are built on the terrain worker

**Before.** A crossing moves the near ring (LOD_NEAR 3), and five pixels
go from stride 4 to stride 1. STREAM1 took them off the crossing frame
onto a queue spent ONE A FRAME on the main thread (`spendRestrides`,
inside the frame): `buildTerrainGrid` over the pixel's samples with its
ghost rows, ~1.8 ms here (3.1 on STREAM1's machine), for five frames after
every crossing - every enhanced-skin player.

**After.** The terrain worker already builds exactly this grid for every
pixel it generates, so the grid is one law now - `terrainGen.js`
`restrideGrid` (the kernel's build, the worker's new `grid` job and the
host's restride all call it) - and with the worker up `spendRestrides`
sends every waiting promotion to it at once, on the crossing frame itself
(ahead of the new pixels' jobs). The job carries the pixel's samples as a
CLONE (the pixel keeps its own) and answers by id, beside the jobs' FIFO,
its two arrays transferred back; the swap - `restrideTerrain(p, 1, grid)`,
the same one - happens when the reply lands, and only if the pixel still
stands, is still the entry that asked, and still wants stride 1. Nothing
is made for a dropped reply, so nothing is left to free. A worker error
answers under the id and that grid is built on the main thread; a dead
worker's grids are built there too, and the host falls back to STREAM1's
one-a-frame queue (no Worker, `?terrainthread=off`, a dead one) as it
always was. Demotions stay inline (0.21 ms each, and a late one would
leave stride-1 geometry in the far ring).

What moves on the screen: a promoted pixel keeps its stride-4 surface for
one worker round trip instead of up to five frames in the queue - the
same heightfield, 819 m or more away.

| harness | before (base) | after (this tree) |
|---|---|---|
| `restride.mjs` - a stride-1 grid, the real ghost | median 1.81 ms, 9.0 ms per crossing over 5 frames | (the same work, on the worker) |
| `restrideMain.mjs` - a promotion's main-thread cost | grid + water 1.83-1.95 ms (four runs) | the post (samples cloned) 0.04 ms + the reply's water 0.11 ms = 0.15-0.16 ms |
| the same - per crossing | 9.2-9.7 ms over five frames | 0.74-0.78 ms |

The GPU upload of the new surface (`createTerrainSurface`, 390 KB) is on
the landing frame either way; node cannot time it.

Pins: `test/restrideworker.test.js` (4) - restrideGrid is buildTerrainGrid
with the woods' ghost rows at strides 1 and 4 and the kernel builds with
it; the REAL worker shell, initialised with a synthetic WOODS.WLD the real
reader loads, answers a grid job by id with the main thread's bytes and
both arrays transferred, says `gridError` under the id before init, and
answers a grid at once while the road network is still being fetched; the
client sends grids by id with the samples cloned, answers out of order
beside a pixel job in the FIFO, builds a failed grid and a dead worker's
grids on its own thread, and answers at once with no worker; the host's
spend, its landing checks, the one swap and the crossing frame's send.
Re-stated on purpose: `distantland.test.js` (the restride reads the ghost
rows through the kernel's law now - its comment said the restride "keeps
its own", which is no longer true) and `water.test.js`'s restride slice.
Mutants: `perfextc.json` PERF-EXT26 x16, all dead.

### The review of cluster C (2026-09-25)

An adversarial review read the cluster against its base, re-ran the
harnesses and set `src/` aside under the pins. Five findings, all five
real; four are fixed in code or tests and the fifth in the names.

**1. PERF-EXT24 lent waits as build time (major).** The breather's slice
clock is wall time, and `onSlice` heard every slice that ended in a yield.
A streamed pixel's first slice begins at `reset()` inside the pump's frame
and runs on across `await terrainGen.generate` - the worker's round trip,
frames going by in it - to its first breath (the first model, or since
PERF-EXT23 the first flat group, so nearly every pixel). That whole
interval was lent: the frame's own head counted twice, the other frames'
script and the wait counted as the build's. So the counter's script ms,
`tools/perfProbe.mjs`'s scriptMs and `?perf=cpu`'s `build` all read high
on every streamed pixel - the telemetry this pass rests on. Now a slice
is lent only if the breather's own resume began it AND the frame clock's
`framesBegun` did not move inside it; everything else still yields
exactly as before, and simply is not lent. The one wait it cannot see -
a fetch that settles before the next frame begins, a cold texture off
the disk cache - is said in the breather, not claimed away.

| harness | base | the cluster's tip | this tree |
|---|---|---|---|
| the reviewer's `lendRepro.mjs` (real frameClock + breather, wired as world.js: reset at 8 ms in frame 0, the worker answers at 45, 1 ms of work, a breath) | heard nothing; frames mean 10.0, worst 10.0 ms | heard 38 ms; mean 19.5, worst 48.0 | heard nothing; mean 10.0, worst 10.0 |
| `sliceAB.mjs` (headless Chromium, 240 frames, relative) - fps / ms built a frame / script ms, frame JS 9 ms | 60.1 / 4.97 / 10.0 | 60 / 3.94 / 14.7 | 60 / 3.91 / 14.4 |
| the same, 12 ms | 54.7 / 4.95 / 21.4 | 60 / 2.50 / 15.8 | 60 / 2.48 / 15.9 |
| the same, 14 ms | 49.6 / 4.93 / 22.8 | 58.1 / 2.50 / 26.1 | 58.1 / 2.49 / 25.6 |
| the same, 18 ms | 41.0 / 4.94 / 26.6 | 47.0 / 2.52 / 30.3 | 47.0 / 2.51 / 29.9 |

The steady stream is lent and paced as it was; only the straddling slices
stop reading as script.

**2. The awaited arm missed a teleport (minor).** `awaited` was inferred
as `_streamSince == null`, and `_streamSince` is the pump's. A teleport's
`await buildPixel(first)` is never alone: the frame loop keeps pumping,
the queue `state.init` has just filled starts the new ring, and every
slice of the arrival after its first was sized for the stream - 3-6 ms,
always 3 on a 144 Hz display - against the record's own "a teleport's
always does". The boot and the teleport build through `awaitedBuild` now,
which counts what is in flight, and the budget's `awaited` is that count.
While one is in flight every slice on the one breather has 6 ms, whichever
build breathes: PERF7's flat slice, for moments nobody is playing
through. And a teleport's sweep ends the old world's stream
(`_streamSince = null`, after the door generation's bump): a stream in flight
across a teleport kept its age, so the new world's ring skipped its two
frame-fitted seconds.

**3. `_wodSiteWas` was write-only (minor).** PERF-EXT21 made every publish
re-read the grass, and the set AUDIT BRANCH (WoD) m2 filled at a teardown
(to make a rebuild that lost its site re-read it) lost its only reader.
It is retired - the set, its add, its delete - and m2's sentence rides the
one invalidation it now shares with every publish. The four pins that
held the dead lines hold the invalidation (`grassshift`,
`audit_wod_branch`, `wod2_loader`) and the carry (`wod4_privateershold`);
`auditwod.json`'s m2 record is re-aimed by content at the invalidation.

**4. One of `colliderkeys`' three tests passes on the base (minor).** The
query test is the equivalence guard of an exact refactor: it cannot fail
before the change, by design. It is not folded into a test that fails,
which would only have hidden it; its title and the file header say it is
a guard and not a pin, and why it is kept (a lookup that spells the key
another way reads cells nobody filed, and only a query sees it).

**5. The names (minor).** The pass's slices are PERF-EXT<n> - cluster B
holds 10-13 and D 30-31 - and this cluster's were PERF-EXT-C1..C7. They
are PERF-EXT20..PERF-EXT26 now in every comment, test title, record and
mutant name. The seven commits keep their subjects - history is not
rewritten - so the map is here: C1 -> 20 (the slot count), C2 -> 21 (the
origin shift), C3 -> 22 (the rim), C4 -> 23 (the publish tail), C5 -> 24
(the slice), C6 -> 25 (the collider key), C7 -> 26 (the promotions).

Pins: `test/buildslice.test.js` +2 - the lend (the reviewer's repro on the
real modules; a resume's slice lent whole into the next sample; a slice a
frame ran inside, and a reset's with no worker, not lent) and the awaited
build (the host's own `awaitedBuild` and budget run at 144 Hz beside a
stream: the floor, 6 while a teleport's build is in flight, the floor
again once it stands or throws; its only callers; the sweep's end of the
stream); its breather and host pins re-stated; `grassshift` and
`audit_wod_branch` assert no `_wodSiteWas`. Each fails with `src/` at the
cluster's tip. Mutants: `perfextc.json` +14 (PERF-EXT24-review x13,
PERF-EXT21-review x1), three re-aimed by content, and `auditwod.json`'s m2
re-aimed; all dead.
