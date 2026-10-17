# PERF-ARENA + PERF-ARENA2 + PERF-ALLOC1/2 + PERF-VOL + PERF-ORDER — the exterior's frame in the real game (2026-10-10)

*The owner: "Exterior performance is really bad" - "Interior is fine. It's exterior that's the issue" - "If you need
to, pull the freeware online and do it yourself".*

The audit (AUDIT PERF-ARENA, "Audit everything") is `01-Overview/audits/Audit-Perf-Arena.md`; what it changed is written into the
sections below as they now stand.

Every slice below leaves the picture as it was: the same triangles in the same order from the same floats, or the same
matrix to the bit. None touches the Enhanced Lighting lane's look, the static shadow cache's law or the air pass's.

## How it was measured

The real game at Knightstale (Wayrest), on the freeware ARENA2 (DFU's `DaggerfallGameFiles.zip`, `tools/fetch-data.sh`),
through `tools/frameProbe.mjs` (`knight` 15:00 and `night` 22:00, 40 frames a window, `INSTR=shadow`) on the merged head
of PERF-CROWD. Milliseconds of this container's CPU a frame, by sample count - relative only. SwiftShader stands the
streaming town at about 0.3 frames a second, so anything on a timer (the music's pump, the HUD's sweep), anything with
a time budget (the snow's blanket build, the stream's slices) and anything with a stall watchdog (the notice panel's
3 s DRAW_STALL_MS rebuilt it every frame) reads as a frame's cost here and is not one at a player's rate - they were
read and set aside.

| | 15:00 | 22:00 |
|---|---|---|
| the world host's frame (its JavaScript) | 22.5 | 25.7 |
| - the shadow pass (`beginFrame` -> `shadowPass.render`) | 5.4 | 5.2 |
| - the billboards (`drawBillboards`) | 2.9 | 2.8 |
| - the pixel walk (`framePixelWalk`) | 1.8 | 1.5 |
| - the air pass's resolve | 1.1 | 1.1 |
| WebGL calls / draw calls a frame (every kind; `drawElements` 992 / 952) | 5,997 / 1,083 | 6,986 / 1,124 |
| `bindVertexArray` a frame | 942 | 905 |
| WebGL calls' own time a frame (the top sixty) | 3.3 | - |
| allocated a frame (collected objects included) | 1.09 MB | 1.42 MB |

The costliest WebGL call the frame made was `bindVertexArray`: 1.48 us each on the main thread, 1.4 ms a frame by day -
more than the 992 `drawElements` it served (0.36 ms). Nearly one a draw, because every billboard batch was born with a
vertex array of its own.

## Measured after (the real game, the same probe)

Knightstale by night (`frameProbe.mjs night`, 40 frames a window, `INSTR=shadow`), the base the PERF-CROWD head above and
the after this branch's head with PERF-ARENA, its hardening, PERF-ALLOC1 and PERF-ALLOC2 (and main's #749 and #746
merged in between - their own code is in the after's totals). Milliseconds of this container's CPU a frame, by sample
count.

| | before | after |
|---|---|---|
| `bindVertexArray` a frame | 905 | 508 (-44%) |
| WebGL calls a frame (draws: 952 both) | 6,986 | 6,587 |
| `bindVertexArray`'s own time | 1.13 | 0.46 |
| the world host's frame (its JavaScript) | 25.7 | 22.1 |
| - the shadow pass (`shadowPass.render`) | 5.2 | 4.0 |
| - the billboards (`drawBillboards`; `drawOne` 1.69 -> 1.14) | 2.8 | 2.4 |
| allocated a frame | 1.42 MB | 1.17 MB |
| - `lookAt` (the lanterns' faces) | 47 KB | 0 |
| - `_candidateQuads` | 153 KB | 45 KB |

The boot was the same (443 s and 439 s to ready). The base's window also held a major collection (62 ms a frame of
garbage collection against the after's 2.7) - the major collections come with the old space's growth, which the
allocation feeds but does not decide alone, so that gap is not claimed for this branch. The 508 binds left were mostly
the main pass hopping between arenas (PERF-ARENA2, below). AUDIT PERF-ARENA R2: the frame totals in this table and in
PERF-ARENA2's are NOT the slices' measure - the snow's time-budgeted blanket read 3.4 ms in the base's window against 1.8 after
(1.6 of the 3.7 between them), and the same render code as PERF-ARENA2's read 20.8 in main's run (below, PERF-VOL). The
binds, the calls, `drawOne` and the allocation are the measure.

## PERF-ARENA — the still flats share their buffers

`render/renderer.js` createBillboardBatch: a batch built STILL (every town flat, every wood, every lamp; not a gib or a
blood drop, which move every frame and keep buffers of their own) takes a range of an ARENA's quads - one VAO and one
vertex buffer for up to BB_ARENA_QUADS (16,384) quads - and its corners are written where its range starts
(`bufferSubData`). The indices are written once: every quad's six, the very six createBillboardBatch writes for its own
(b, b+2, b+1, b, b+3, b+2 from the quad's first corner) - in ONE index buffer every arena binds (AUDIT PERF-ARENA A4:
each arena first uploaded its own copy, though quad q's six are the same in every arena; `_bbArenaIndices` keeps one, as
large as the largest arena, grows it when a larger arena is born - filled once, bound into every standing arena's
array, the old let go - and an arena's deletion leaves it). A batch's draw names its
range by the index offset (`_ibOff`) - the main pass (`drawOne`), the shadow replay and the air pass's emitters, the
three sites that draw a batch. So the same triangles, in the same order, from the same vertices; and the main pass's
flats bind one VAO where each bound its own.

- `arenaTake` / `arenaGive` keep an arena's free ranges, ascending and never touching (first fit; a range given back
  joins its neighbours). A batch bigger than an arena gets an arena its size; a full arena spills into a new one.
- A batch freed (`destroyBatch`, `destroyBillboardBatch`) gives its range back ONCE and lets its VAO (the arena's) go: a
  second free gives nothing, and every replay already skips a batch with no VAO (EL2's `_dead` law), so no shadow record
  from the last frame reaches a range a later batch takes.
- `moveBillboardBatch` on a still batch (a felled tree, PROF4) rewrites its range in place.
- An arena emptied whole is deleted, all but the first, with its records' homes (AUDIT PERF-ARENA A1 pins that: a home
  left on a deleted arena put the record's next batch in a deleted array, drawing another batch's quads). AUDIT PERF-ARENA R10/A4:
  in a 2,000-step streamed walk at Knightstale's density the arenas held 99-102 MB of room for 54-72 MB of flats, bounded
  (five to seven arenas) - and fragmented arenas rarely empty whole. AUDIT PERF-ARENA R10: an arena is let go with its last batch,
  so one live batch holds an arena of up to 27 MB (BB_ARENA_MAX_QUADS, PERF-ARENA2) - a long road through dense woods
  can keep more GPU memory than the woods it stands in; not measured on a long road.
- The batch is born with its three new fields (`_arena`, `_q0`, `_ibOff`), in `contract.js` - one shape (PERF-EXT10).
- AUDIT PERF-ARENA A5-A7: the record homes start over past BB_ARENA_HOMES_MAX (4,096 - a home is a hint, and a peer's
  doll mints a key for good); the free of a batch whose arena is not standing splices nothing (it took the last
  standing arena out of the list, its buffers never deleted - unreachable in the shipped code, guarded); `destroyBatch`
  lets a dynamic batch's array go as `destroyBillboardBatch` always did.
- STRAY ARRAY STATE (the arena's own audit): one array for many batches makes two old hazards wide. A flat whose VAO
  the shadow says is bound skips the bind - with a VAO a batch, a stale shadow could only fool the same batch drawn
  twice; with an arena, any flat after a foreign pass that bound its own array behind the shadow's back would draw from
  it. So `drawBillboards` forgets the shadow on entry (one bind a call; the air pass's emitters already did, and the
  shadow pass runs after beginFrame's own reset). And an element buffer bound is the BOUND array's state: the snow's
  shared blanket (`render/snowfallSurface.js` _sharedBlanket) bound its index buffer, and then none, onto whatever array
  the last pass left bound - with an arena that is every still flat's indices cut away. It binds no array first now,
  through the renderer. Every other element-buffer bind in src/ binds an array of its own first (audited, 27 sites).

Pins: `test/render/perfarena.test.js` (5 of its 8) - the allocator over 6,000 random takes and gives; THE PICTURE: a GL that keeps what is
written into its buffers resolves every triangle a draw rasterises (each corner's five floats, at the draw's uOrigin and
uSize), and a town of forty batches (woods, single flats, three records and a lamp, scaled flats, five pixels) drawn
through the main pass, the air pass's emitters and the shadow replay resolves to the base's triangles draw for draw,
with ONE VAO bound for the main pass's forty draws (the base: forty); a batch's life (freed once, the range reused, a
move, a gib's own buffers, a batch bigger than an arena); the spill and the let-go; the stray array state, both halves.
Mutants: `tools/mutants/perfarena.json` (15 of its 27, all dead; the audit's nine AUDIT-ARENA-* beside them). Pins moved: `test/systems/save/hard3_types.test.js` (58 fields), `test/render/la_cost.test.js`
(a billboard call 108 -> 107 GL calls, the frame's second 31 -> 30: one VAO bind fewer), `test/combat/blood1_decals.test.js` (the move's write), and three
harnesses that named a draw by its VAO alone and now name it by VAO and offset (`test/render/perfexta.test.js`,
`test/render/perfextb.test.js`, `test/systems/lpt1_lowpolytrees.test.js`).

## PERF-ARENA2 — the arenas grown, and a record's batches together (2026-10-11)

After PERF-ARENA the main pass still bound a VAO on most of its flats. Read back from the real game through
`window.__renderer` (Knightstale by night, once ready): the stream stood **619,833 quads in 38 arenas** of
BB_ARENA_QUADS (16,384) each, every one full. The pass draws its flats sorted by texture key (`billboardKey.js`
sortByKey - one key's batches in a run, in the order they came, LA-COST2's exact order), and one key's batches lay
scattered over the 38: the pass hopped between arenas on nearly every draw.

- EACH ARENA TWICE THE LAST, to BB_ARENA_MAX_QUADS (262,144 quads: 21 MB of corners, 6 MB of indices) - a town that
  size stands in six arenas, an interior's few hundred flats in the first.
- A RECORD'S BATCHES TOGETHER: `_bbArenaFor` takes the batch's key (`${archive}_${record}`, the run the main pass
  sorts it into) and tries the arena that key's last batch went to first, then the first fit anywhere, then a new
  arena - so a run stays in one arena and the pass binds where the key changes anyway. A deleted arena takes its keys'
  homes with it.

Measured (the same probe, Knightstale by night, the base the PERF-CROWD head, then PERF-ARENA, then this):

| | base | PERF-ARENA | PERF-ARENA2 |
|---|---|---|---|
| `bindVertexArray` a frame | 905 | 508 | 278 |
| WebGL calls a frame (draws 952 in all three) | 6,986 | 6,587 | 6,360 |
| the world host's frame (ms of this container's CPU) | 25.7 | 22.1 | 19.1 |
| - the billboards (`drawBillboards`) | 2.8 | 2.4 | 1.4 |
| - - `drawOne` | 1.69 | 1.14 | 0.60 |
| - the shadow pass | 5.2 | 4.0 | 3.7 |
| allocated a frame | 1.42 MB | 1.17 MB | 1.09 MB |

The draws are the same draws in the same order; only where a batch's corners live moved. Pins: `test/render/perfarena.test.js`
(the spill test's growth and the record's home, and - AUDIT PERF-ARENA A1-A3 - the let-go's homes, a batch bigger than
the arena the doubling would open and the first fit's home; the growth's bound, its sixth; the one index buffer and
the homes' bound, its seventh and eighth); mutants PERFARENA2-no-growth, PERFARENA2-unbounded, PERFARENA2-no-home
(dead), PERFARENA-no-spill re-aimed by content.

## PERF-ALLOC1 — the lanterns' face matrices made in place

`render/shadowPass.js` pointFaceMatrices runs for every lantern every frame, and made a projection, six lookAt views and
their twenty-four arrays each time: lookAt alone was 47 KB of the 1.4 MB the night frame allocated. It writes into two
scratches now through `lookAtInto` and `perspectiveInto` - twins of `world/mat4.js` lookAt and perspective that write
into a given array, with mat4.js's arithmetic in its order, so its floats. They live in shadowPass.js and NOT in
mat4.js: mat4.js is in the relay's bundle (`test/net/relayversion.test.js` RELAY_GRAPH), and a byte of it changed is a
relay deploy that drops every player - the first cut put the twins there and SLAM8 caught it; mat4.js is main's, byte
for byte.

AUDIT PERF-ARENA L1: "lookAt 47 KB -> 0" is the profile's label, not the call's bytes - what is left is `Math.hypot`'s
own (twelve a lantern, each boxing its arguments and its result in V8): a lantern's faces allocated 2,389 B a call
before and 862 after (Node 22, optimised). The pin holds NO TYPED ARRAY, not no allocation. Calling `hypot` only where
two of its three arguments are not zero would take it to ~290 B with the same floats in V8, but the spec leaves
`hypot`'s rounding to the engine, and the twins' law is mat4.js's arithmetic as written - left.

Pins: `test/render/perfalloc1.test.js` (3 of its 4) - every face of 4,000 random lights against the base's formulas, element
for element (`Object.is`), and lookAt and perspective likewise; (AUDIT PERF-ARENA L2/L3) the twin on translations that
CANCEL (an eye nearly perpendicular to the view's axis, at 1e3-1e7), an eye at the origin and each face's view before
the product; twelve lanterns' faces make no typed array. Mutants: `tools/mutants/perfalloc1.json` (12 of its 14, all
dead). The translation's three-term sum reordered was recorded equivalent ("float32 rounding cannot tell") - true of
the FACES (their basis is axis-aligned, one term each) and false of the twin, which a cancelling view tells to the
float: it is a dead record now, beside five more of the twin's arithmetic (LA-*) the cancelling views kill.

## PERF-ALLOC2 — the lantern walk's cube through a typed array

`_candidateQuads` (shadowPass.js) asks `placementsInCube` once a placed batch a lantern a frame, and handed it five
doubles each time - 153 KB of the 1.4 MB the night frame allocated, because a double handed to a call V8 does not
inline is a heap number. It writes the cube into its own Float64Array now and asks `placementsInCubeOf` (bounds.js),
which reads the same doubles back exactly; `placementsInCube` is that with a scratch, for its other callers. Pins:
`test/render/perfalloc1.test.js` (its third) - the cube test against a brute-force oracle over random woods and cubes, through
both doors, and the walk's call by its source and its own scratch (AUDIT PERF-ARENA L4: an array a call survived).
Mutants: `tools/mutants/perfalloc1.json` (PERFALLOC2-*, WALK-scratch-module: dead); three older records re-aimed by
content onto the moved expression (AUDIT637-B2b, PERF-SHADOW1-d, PERF-SHADOW1-f). AUDIT PERF-ARENA L5: the wrapper's
"other callers" run every frame too - `_staticSignatures` (SC1's own, while the cache is on) and `_dynamicNear` hand it
five doubles a placed batch a lantern (176 -> 112 B a call un-inlined, the rest `cellRange`'s and the lift's); left, the
first being the static cache's machinery.

## PERF-VOL — the placed batches' volume answers, kept (2026-10-11)

*The owner: "Lets do the biggest remaining lever".* Under Steady shadows (FLICKER-FIX: every map redrawn every frame)
each lantern's six dynamic faces replay every swaying placed batch of its reach, and each asks
`placementsInVolume` (bounds.js) whether any of the batch's quads stands in the face - a walk of the grid's cells and
their placements. Its inputs were captured in the real game (Knightstale by night, a hook on bounds.js over three
frames): 542 asks a frame, eleven batches against the twelve lanterns' 72 faces, and **every ask the frame before's to
the bit** (542 distinct inputs of 1,626). The answer is a pure function of the planes, the grid, the batch's origin and
height and the quad's radius, so it is kept:

- `volumeName(planes)` names a replay's six planes by their BITS (the Float32Array's words; `volumeHash` - FNV-1a over
  the words, each step folded down - files them, and a hit compares the words: two sets with one hash get two names).
  A set seen for the FIRST time gets 0 - ask afresh - and leaves only its hash; its second sight is named and its words
  kept. So a carried lantern's faces, which never come again, cost a hash in a set, not a kept answer. Names are never
  reused: past `VOLUME_TABLE_MAX` (512) names the named table starts over and the count goes on; the first sights start
  over on their own past as many hashes, and forget no name.
- `placementsInVolumeOf(b, rad, planes, name)` keeps the answer on the batch's own grid (`_place.vol`, born null - a
  move mints a new grid, a free drops it) under the name, against every other number the test reads: the radius, the
  origin's three (compared, not the array - a pixel's translation is written in place) and the height the lift is half
  of. Any one different, or NaN, and it asks afresh and keeps that. A grid keeps `VOLUME_MEMO_MAX` (128) answers and
  starts over past them. A signed zero is the same number to the test (no term can tell -0 from +0 once added to
  anything, and the compare cannot), so `===` is exact.
- The replay (shadowPass.js) asks the name at its first placed batch, lazily, and only for a LANTERN's replay (the sun
  turns every frame and a cascade follows the eye, so no cascade's planes come again: they ask the walk itself), through
  `SHADOW_TUNING.volumeMemo` (false: every ask afresh - the pins' oracle and an A/B's off arm,
  `window.__DF_SHADOW_TUNING.volumeMemo`; it ships on, and a pin says so).

It decides nothing the pass did not: no cache, signature or cadence of SC1/FLICKER-FIX is read or written, and every
draw of every face is the same - the replay's cull asks the same question and gets the same answer, kept instead of
walked. On the captured inputs, replayed in Node: 0.41 -> 0.08 ms a frame; in the game (a hook on bounds.js, eight
frames) 4,336 asks of 4,336 were kept answers, under 72 names a frame. A kept answer holds ~180 B on its grid (a town
by night ~1,800 of them, ~0.3 MB). Where the memo LOSES: sets that come back exactly two or three times, or more than
512 a cycle (nothing is ever named) - neither reachable with twelve casters and a turning sun.

## PERF-ORDER — the cheapest skip first (2026-10-11)

Counted in the real game (the same scene, a hook on the two loops over three frames): the pixel walk (world.js) asked
every batch of a visible pixel its box (`aabbOutside`) and, off screen, the shadows' reach before MAC1's far-flat rule -
which then dropped 655 of the 1,361 a frame; the air pass's emitter replay (airPass.js `_replayEmission`) asked every
flat its sphere before its emission map - 636 a frame, 3 with a map. Each loop's tests only skip, and none has a side
effect a later one reads (`shadowReach` memoises its sun planes once a frame; `billboardKey` caches a key on the batch
and interns it, and the cutout sort orders keys by their strings, not their ids), so the cheapest goes first: the far
rule's three compares, the emission map's one lookup. The batches kept and the flats drawn are the same.

### Measured (both slices, the real game)

Knightstale by night (`frameProbe.mjs night`, 40 frames, `INSTR=shadow`), main's head (#760) and this branch's (before
the audit's changes to the naming, which touch only the cascades and the first sights), run back to back with nothing
else on the machine (a first after-run made beside a mutation campaign is not used). Milliseconds of this container's
CPU a frame, by sample count. AUDIT PERF-ARENA R1: two runs of ONE render tree differ by up to 1.7 ms in the frame and
0.5 ms in the pixel walk (PERF-ARENA2's run against main's: 19.1 against 20.8, 1.53 against 2.05 - code identical but
for UI files) - so the frame and its parent lines are not these slices' measure. The callees a slice removed are:

| | main | this branch |
|---|---|---|
| the pixel walk's boxes (`aabbOutside`; 0.37-0.52 over the base's two runs) - PERF-ORDER | 0.52 | 0.25 |
| the emitters' spheres (`batchSphere` + `sphereInPlanes` under `_replayEmission`; 0.16-0.25) - PERF-ORDER | 0.25 | 0.01 |
| the volume asks (`placementsInVolume`; 0.41-0.61 over the base's two runs) -> kept 0.20 + `volumeName` 0.11 - PERF-VOL | 0.41 | 0.31 |
| not claimed: the world host's frame / the pixel walk / the billboards (in neither slice) | 20.8 / 2.05 / 1.85 | 19.4 / 1.67 / 1.65 |
| the shadow pass (`P.render`) | 3.84 | 3.80 |
| allocated a frame | 1.08 MB | 1.07 MB |

The kept answers cost more here than in Node (a kept answer about 0.4 us on this starved main thread, a name 1.5 us),
so PERF-VOL is the smaller of the two in the game: a tenth of a millisecond at twelve lamps, growing with the lamps and
the swaying woods by them. PERF-ORDER is 0.3-0.5 ms.

Pins (both slices): `test/render/perfvol.test.js` (6) - the kept answer against `placementsInVolume` and a walk of every
placement over random woods, lantern faces and cascades, frame after frame through one reused Float32Array with the
radius, each origin axis, the height, a lantern and the grid each moved alone (each flipped answers), the smallest
move of the radius and the origin and the height's sign each flipping an answer kept a moment before, and a still
frame reading no placement; `volumeName`'s rules (first sight, the same bits in another view and another set in the
same buffer, one word changed, two sets of one hash at the first words and the last, the first sights and the names
each starting over, never reused) and its two bounds; the grid's bound; the replay's every draw of every frame against
`volumeMemo` false - a night town through frames that each move one thing, by day, cadenced and with the static cache
off - and its walks by count (none on a still frame); the replay's call by source, a lantern's alone, and the memo
shipped on; the air pass's emitters against the oracle with the sphere and the picture asked of the lit flats alone.
Mutants `tools/mutants/perfvol.json` (33, all dead). Moved: AUDIT 637 B2's and PERF-SHADOW1's arms both ask every face
afresh (`volumeMemo` false: they hold the pre-pass, perfvol the memo), SHADOW-REACH's and MAC1 D's source pins take the
far rule first; PERF-EXT1-5, EL3's emit-flat-without-map and PERF-SUN3-the-walk-shipped-off re-aimed by content.

## Measured, and left

- **The shadow pass** is the frame's largest part (5.2-5.4 ms on the PERF-CROWD head; 3.7 after PERF-ARENA2): by day the sun's three cascades replay ~200 draws a
  frame; by night twelve lanterns redraw their dynamic faces (~72 face replays, ~208 draws). PERF-FACE already redraws
  only the faces a mover is in; the rest is FLICKER-FIX's trade (Performance-Next.md "For Mac").
- **The snow** (winter, which is where the game starts): the near pixels sorted every frame for the blanket's ring,
  with a stamp string a pixel; small, and its own slice.
- **The meshes' vertex arrays - measured, and NOT the lever** (2026-10-11, after PERF-ARENA2): `bindVertexArray`
  wrapped in the real game (Knightstale by night, ten frames, by its caller) reads 220 binds of a vertex array a frame (of the census's 278 calls; the rest unbind, `null`) - the billboards'
  main pass 125 (one about each texture key whose batches sit in another arena than the key before), the terrain 41
  (a map pixel's own), the shadow pass's cache blits and replays 24, the meshes 11, the rest one each (the skies, the
  clouds, the grass, the rain, the water, the air pass). A mesh arena would take the 11; a bind costs under a
  microsecond of the main thread now (0.25 ms for all 278 in the probe's profile). Not built.
- **What the frame is now** (the same run, ms of this container's CPU): the shadow pass 3.7 (its replays 1.7; its
  walks - `placementsInVolume` 0.61, `_candidateQuads` 0.46, `_staticSignatures` 0.37, `_casterCandidates` 0.36 - each
  made again every frame over records that are mostly the last frame's), the pixel walk 1.5, the billboards 1.4, the
  air pass's resolve 0.9, and some twenty pieces of 0.25-0.6. PERF-VOL keeps the first of those walks' answers - a pure
  function's, so nothing the pass decides moves. Carrying the OTHERS from frame to frame (the candidate lists, the
  signatures) needs a test of what changed, and that is the static shadow cache's own machinery (SC1, FLICKER-FIX) -
  Dudey's word on the pass (`Performance-Crowd.md`): "make sure to not touch enhanced lighting we finally fixed the
  flickering based on shadowcache". Left for the owner. A finer placement grid (PLACEMENT_GRID 8) was measured on a
  synthetic 1,500-tree wood (`gridbench.mjs`): the lanterns' faces 0.34 -> 0.19 ms, the sun's cascades 0.11 -> 0.15 -
  about a tenth of a millisecond in all; not taken; nor (on the captured asks, Node, the walk's own 0.35-0.41 ms) a
  plane-coherent test (the last plane that culled asked first: 0.42) or each cell's box before its placements (0.34).
- **The online crowd** (`tools/onlineFrameProbe.mjs`, PEERS=0,20,60, the same head): online with no one there the
  world host's frame was 24.3 ms (the HUD 1.7, the motor 1.3, `onlineFrame` 1.0 of it); at 20 peers the allocation rose
  1.79 -> 4.40 MB a frame and the frame 24.3 -> 34.0. READ AT THE PROBE'S RATE (0.27 frames a second, 3.7 s a frame)
  nearly all of the growth is work on the real clock, not the frame's: the poses arriving (`_receive`/`_arrive`/
  `_arriveTimed`, `validPose`, `cadenceOf`'s sort, `poseAlong` - ~0.5 MB and ~13 ms a second at 20), the footsteps'
  Web Audio nodes (`peerSound`), the HUD's 250 ms layout sweep (`readLayout` -> `getPref` -> the online lane's page
  door), and the play-out walking 3.7 s of path a frame (`_play`). What scales with frames x peers was the peers'
  billboards (keys, the main pass, the shadow record): ~1.5 ms at 20 on this container. The 60-peer window drew 13 of
  its 60 bots (the relay's fan on this machine) and is not a measure. `wire.js` (`validPose`, `isCellRoom`) is in the
  relay's bundle - any slice there is a relay deploy.
- **The page doors**: `isEnhanced`/`uiSkin`/`skinOverride` read `location.search` on every call - ~0.5 ms a frame of
  this container's (0.2 on a desktop). PERF-URL already parses once a search; ending the read itself overturns its "not
  a latch" rule (Performance-Next.md item 4, for Mac) and is left.
