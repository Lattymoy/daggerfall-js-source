# PERF-EXT — slow outdoors on good cards: the exterior made cheaper in code

*2026-09-25. Two players via Mac: "fps issues in the exterior but fine
in the interior", and a second, "me too my friend.. don't know why. I got
a RX6600" (the first on an RTX 4060 Ti). PERF-SCALE answered the
per-pixel half the same morning (`01-Overview/Field-Bugs-2026-09-25.md`:
a render scale, and a counter that names the GPU). Mac, on the rest:
"Why are you so avoidant when it comes to addressing performance issues?
I am not getting another player to do the work that youre suppose to
do".*

## How the pass was run

No game data in the container, so nothing here was measured in the game.
Every win below was found by a hunter on a HARNESS - the real `Renderer`,
the real `ShadowPass` and the Enhanced Lighting lane over a counting
Proxy GL, driven by a transcription of `world.js`'s frame walk over a
synthetic streamed town of 121 pixels (nine of them town, 3,264 flat
batches, forty walkers, sixty lanterns a town pixel at night) - and then
measured AGAIN by a prover who was told to disprove it. What survived is
what this page records, with the prover's numbers and the ones re-run on
the committed tree. The harness numbers are node's, so they are relative:
V8 is the engine Chrome runs the page on, and a JS cost that halves in
node halves on the main thread, but the milliseconds are not the game's.
GL call counts are exact. The harnesses were the pass's scratch and are
not in the tree; the numbers are quoted as they ran.

## PERF-EXT10 - every flat batch is born with every field it will carry

**What the frame paid.** `Renderer.createBillboardBatch` minted eleven
fields, and each batch gained the rest later, in whatever order a path
first touched it: a host's `_box` and `sway` (a tree), `_box` alone (a
town flat), `conceal` (a guard, a foe), `noShadow` (a loot pile),
`selfCard` (the player's own card); the shadow record's ten `_sh*`
fields; `billboardKey`'s four `_bbKey*`; the static signature's `_shId`;
a mover's `_shMovedAt`; a gib's `_moveScratch`. V8 gives every distinct
ORDER of additions its own hidden class, so the world's flats ran on
several - 3 by day and 5 at night in the hunter's town, 12 by day with
the game's producer mix (townsfolk and WOD batches without sway, guards
writing `conceal = null`, loot with `noShadow`) - and every per-flat loop
(the draw, its sort, the shadow record, the replay, the static signature)
read its batches through polymorphic property lookups.

**The change.** The literal mints all 34, the 23 later ones as
`undefined`. Undefined and not typed defaults, because the readers take
undefined for "absent" (`_bbKey == null`, `_shSeen === true`,
`_shMovedAt != null`, `o._shId ??=`), and nothing in the tree tells a
missing field from an undefined one (no `in`, `hasOwn`, `Object.keys`,
spread or JSON on a batch). All but three: the shadow record's origin,
`_shOx`/`_shOy`/`_shOz`, is born `NaN` (the review, below) - a double
slot from birth, which `recordBillboards` writes in place every frame.
No value any code computes changes, so the picture cannot. `contract.js`
declares the 23 (HARD3 holds the mint and the typedef to one list).

**Measured** (`perfhunt/js/h/townFrame.mjs`, `ab.sh`, median of 9
alternating runs of 800 frames; the base is `e9dd612e7`):

| | base | PERF-EXT10 |
|---|---|---|
| hidden classes, day / night | 3 / 5 | 1 / 1 |
| hidden classes, producer mix (`townFrameReal.mjs`), day / night | 12 / 15 | 1 / 1 |
| render-side JS, day, ms/frame | 1.620 | 1.200 |
| ...of it the flats / the shadow beginFrame | 0.696 / 0.364 | 0.473 / 0.210 |
| render-side JS, night (8 lanterns), ms/frame | 2.279 | 1.406 |
| ...of it the flats / the shadow beginFrame | 0.818 / 0.854 | 0.498 / 0.357 |
| producer mix (`abReal.sh`, 7 runs), day, ms/frame | 1.749 | 1.212 |
| producer mix, night, ms/frame | 2.318 | 1.357 |

The prover's own run (the literal alone against the same tree with its
instrumentation, 9 runs): 1.702 -> 1.343 by day, 2.375 -> 1.470 at
night. Memory: 23 more slots on ~3,300 batches, about 300 KB. The young
garbage a frame is counted in scavenges with a 1 MB young space
(`--min-semi-space-size=1 --max-semi-space-size=1 --trace-gc`, 3,000
frames of the producer mix, two runs each): the base 1,298 / 1,296 by
day and 1,304 / 1,304 at night; with the reviewed mint 1,209 / 1,212 and
1,176 / 1,168. This line first quoted `ALLOC=1`'s heap delta (44-51 ->
34-36 KB a frame), which is not a measure: scavenges run inside its
window and take the garbage with them, and it missed what the review
found.

**The review.** The first cut minted the origin triple `undefined` with
the rest, and V8 keeps a field in the representation of the first value
it holds. Undefined is not a number, so the three were TAGGED slots
(`--trace-generalization`: born `h{Any}`, where the base's, added with
their first double, were `d`), and every fractional origin the record
stored into them - every batch, every frame - was a fresh heap number:
118,867 bytes a frame for the record alone over 3,025 batches (39 a
batch; the base 67 in all), and 407-413 scavenges over 3,000 frames of
it with a 1 MB young space where the base made 18-24. On the producer
mix it gave back what the one shape saved in garbage - all of it by day
(1,301 / 1,294 scavenges at the first cut, the base's 1,298 / 1,296) and
half at night (1,239 / 1,248, the base's 1,304 / 1,304). Born `NaN` they
are doubles again (`d{Any}` from birth): the record 67 bytes a frame,
16-18 scavenges, and the numbers above. `NaN` is never read as a place -
every reader asks `_shSeen === true` first, and the static signature
folds only batches the record has written - and what the frame writes
into the other twenty is Smis, booleans, strings and objects, which need
no box (`sway`'s fraction is written once, by the host). Node's ms a
frame did not move past its noise (`abReal.sh`, first cut -> reviewed, 7
runs: 1.284 -> 1.242 by day, 1.497 -> 1.547 at night; `ab.sh` on the
hunter's town, 9 runs: 1.252 -> 1.287 and 1.465 -> 1.460); the point is
the garbage.

**Pinned** (`test/perfextb.test.js`, every one failing on the base):
a batch of every producer - a tree, a town flat, a walker, a loot pile,
the player's card, a gib, a cast-only batch and a freed one, dressed as
their hosts dress them - carries the birth key list through four night
frames of drawing, recording, lantern signatures, a moving walker, a
gib's move and a free, with the frame proven to have reached every
writer; V8 itself, in a child with `--allow-natives-syntax`, puts six
producers' batches on one map (`%HaveSameMap`); and a SOURCE SWEEP holds
every field `src/` writes on a batch - by name for the renderer's own
memory, by receiver (`batch.`, `x.batch.`, `xBatch.`) for every host -
to the literal, because the next producer to add a field after birth
splits the shape again without any test noticing. And the review's pin,
which fails on the first cut: in a child with a 64 MB young space the
shadow record, writing 1,210 batches' fractional origins for 100 frames,
allocates under 2 bytes a batch a frame (the first cut: 42), weighed
against a control of the same stores into fields born undefined that
must show at least 20 - or the measure is blind. Mutants
`tools/mutants/perfextb.json` 1-9 and 34-36 (the triple born undefined,
one of it undefined, one born null); 5 re-aimed at the reviewed line.

## PERF-EXT11 - a flat's size and origin go up when they change

**What the frame paid.** `drawBillboards` uploaded `uSize` and `uOrigin`
for every flat it drew, and the shadow replay did the same for every flat
it replayed into every sun cascade and every lantern face. Neither changes
between most pairs. The main pass is SORTED by texture key (PERF3), so one
record's batches - which share its size - stand together; a replay walks a
record in pixel order, and a pixel's batches share ONE origin array
(`world.js`: `b.origin = t`). The sway and the texture already skipped
their repeats (WIND3, PERF3, PERF-BASIS); these two did not.

**The change.** Five lasts beside the sway's, NaN at the top of each call
(the main pass) and of each record (the replay), and an upload only when
the value moved; a flip is the sign of `w`, compared by value. Exact,
because a uniform belongs to the PROGRAM and holds until the next upload
to it: `drawBillboards` binds its program once and nothing between two
flats binds another (the opaque phase, the blended phase and the
`uSpectral`/`uConceal` uploads between them all run on it), the replay
binds `P.bb` once a record, and only these loops write these uniforms.
The lasts belong to the call, never carried to the next - a lane swapped
between two calls is a new program that holds none of the old one's
values. This is also the replay half of the shadow lens's
`h-origin-upload-dedup` (the same skip, found twice).

**Measured** (the hunter's `townFrame.mjs`, 300 frames, GL calls a frame;
draws unchanged at 1,159):

| | PERF-EXT10 | PERF-EXT11 |
|---|---|---|
| all GL calls, day | 6,243 | 5,279 |
| all GL calls, night | 4,992 | 4,265 |
| the flats' `uniform2f` (size) | 783 | 65 |
| the sun replay's `uniform3f` (origin) / `uniform2f` (size) | 234 / 234 | 44 / 187 |

The main pass's origin stays at 785: sorted neighbours are different
pixels' batches. What a call is worth: the prover timed them in headless
Chromium with the command buffer drained first (`glcall.mjs`, 150 samples
x 3 launches) at 37-49 ns a `uniform2f`/`uniform3f` on the main thread,
and a frame-shaped 783-flat pass at 0.152-0.174 ms with a size a flat
against 0.126-0.134 ms with a size on change (`glcost3.mjs`). So about
0.03-0.05 ms a frame of main thread, plus ~960 fewer commands for the GPU
process to decode and validate - NOT the 0.5-1.2 ms the hunter first
claimed, which came from 20,000 back-to-back calls throttled by
SwiftShader's full command ring. Node's no-op GL shows no time change,
which is expected.

**Pinned** (`test/perfextb.test.js`, each failing on the base): twenty
batches of one record from five pixels upload ONE size and FIVE origins
(the base: twenty of each) with every flat still drawn; twenty flats of
one pixel, recorded and replayed into the sun's three cascades, upload one
origin and one size a record a cascade (the base: 60 of each); and a WALK
of the recorded calls as GL holds uniforms - per program - checks that
every flat draw, 1,168 of them across two calls in a frame, the blended
phase, a flipped walker, records that differ only in `h`, pixels that
differ only in `y` or `z`, a lane swapped between two calls, and the sun's
and eight lanterns' replays, sees its own size and origin, with the skip
really on. Mutants 10-18; one (the replay's reset hoisted to once a
replay) is recorded EQUIVALENT: only that loop writes `P.bb`'s two
uniforms, so the reset a record is belt and braces.

## PERF-EXT12 - the far-flat rule is asked without an object

**What the frame paid.** The streaming host's pixel walk asks MAC1's
far-flat rule of every flat batch of every pixel it can see or reach,
every frame - 1,131 times a frame on the harness town - and asked it as
`farFlatVisible({ ring, height, animated })`, an object literal a call.
AUDIT 65 had looked at exactly this and let it stand: "measured at 0.2 ns
per call over five million calls; V8 scalar-replaces a destructured
literal that never escapes". In a microbenchmark it does. In the frame it
does not: with a 1 MB young space (`--min-semi-space-size=1
--max-semi-space-size=1 --trace-gc`) over 3,065 harness frames the literal
cost about 225 scavenges more than the positional call - about 70 KB of
young garbage a frame, ~4 MB a second at 60 fps, for the scavenger
PERF-TOWN1 already named as the cause of the frame's swings. The rule
written out inline scavenges no less than the positional call (1,082
against 1,075), so the garbage was the object, not the call.

**The change.** `flatDistance.js` exports `farFlatVisibleAt(ring, height,
animated = false)` as the rule's ONE home; `farFlatVisible({...})` stays
as a call to it, because the MAC1 behaviour pins speak the object form.
`world.js` calls the positional one. The same boolean for the same
inputs.

**Measured** (the hunter's `townFrame.mjs` with its far-flat call taken
from the tree under test, `townFrameTree.mjs`):

| | PERF-EXT11 | PERF-EXT12 |
|---|---|---|
| scavenges, 1 MB young space, 3,065 frames (3 runs) | 1,296 / 1,299 / 1,301 | 1,073 / 1,074 / 1,078 |
| the `batches` zone, ms/frame (7 runs x 800, median) | 0.406 | 0.386 |

The prover's run on the same harness: 1,228 against 1,003-1,013
scavenges, the batches zone 0.392 -> 0.353 ms. About 0.02-0.04 ms of CPU
a frame; the point is the garbage.

**Pinned** (`test/perfextb.test.js`, both failing on the base): the pixel
walk's call is positional and nothing in `src/` builds an object to ask
the rule; and over rings 0-6, six heights and `animated` false, true and
left out, `farFlatVisibleAt` answers what `farFlatVisible({...})` answers
(86 of 126 draw), with the object form nothing but a call to it. MAC1's
wire pin (`test/mac1_playreport.test.js`) and SHADOW-REACH's gate pin
(`test/shadowreach.test.js`) read the positional call now. Mutants 19-24,
one of them run against the MAC1 pins alone: the tree line moved in the
one home is seen through the object form.

## PERF-EXT13 - every visible pixel's water in one call

**What the frame paid.** Enhanced Water is on by default, and the
streaming host drew each visible water pixel through its own
`drawWaterSurface`. Each call sent the whole frame block again - the
matrices, the clock and the wind, the sky, the fog, the shadow maps, the
sun, the moon, the lamps, the sampler units - and turned blend, depth
mask, cull, polygon offset and depth func on and off around its one draw:
about 71 GL calls a pixel. The prover's census of a city at noon and at
night: 34 water draws, 2,386 calls a frame, 12-14% of the frame's calls,
1,319-1,324 of them uniforms re-set to the value already held. None of it
can change between two pixels of one frame - the host hands every pixel
the same `wu`, and nothing runs between them. On Windows, where Chrome
draws through ANGLE's D3D11 backend and a uniform call dirties its
stage's whole block with no value compare, that was also one fragment
block rewrite a water pixel (the hunter's reading of
`ProgramExecutableD3D.cpp` / `StateManager11.cpp`).

AUDIT 65 had looked at this too and let it stand, reading the host
comment "one uniform set a frame" as a claim about the `waterUniforms()`
object and not about GL. The object was built once; the GL block was not.

**The change.** `Renderer.drawWaterSurfaces(rows, n, tileSize, u,
tileDim)`: the block ONCE and the state on ONCE; per row, in the order
given (the blend is order-dependent), only the pixel's own - its matrix,
its tilemap on unit 2, its VAO, and the tile array on unit 0 when it
differs from the row before (another climate's ground array; always for
the first row, even when it has none). The state is closed once, exactly
as the one-pixel draw closed it (unit 0 selected, no VAO, blend and offset
off, cull on, depth written and LESS). `drawWaterSurface` is the list
with one row, for the town host and the water lab. `world.js` collects
the visible water pixels into reused rows and makes one call; no water in
sight is no call at all, as before. `stats.texBinds` counts the binds
actually made.

**Measured.** The hunter's `waterlist.mjs` on the real renderer and the
lane: 34 water pixels, 2,421 calls one at a time (the base and the
one-row door agree) -> 308 through the list. The hunter's `equiv.mjs`,
rebuilt to load TWO trees (`equivX.mjs`: the base drawing each pixel
through its own call against this tree's list, the whole frame - ground,
statics, water, flats, the sun's cascades and the lanterns - snapshotted
at every draw: program, every uniform the program holds, the texture on
every sampler's unit, VAO, framebuffer, caps, depth, blend, offset, colour
mask, arguments), with two climates' arrays in runs: per-draw state
IDENTICAL over 9,205 draws at noon and 8,445 at night, 52 of them water,
GL calls -786 a frame for 13 water pixels; its negative control (one
water matrix nudged 1e-3) is caught at both. The hunter's game-side A/B
(not re-run: no game data here) had the water pass at 1.87-2.62 -> 0.23
ms a frame on SwiftShader, where the backed-up command ring charges the
main thread; on a real GPU the portable part is ~2,100 fewer commands a
frame for the GPU process in a coastal city, and about 5-250 fewer where
there is less water.

**Pinned** (`test/perfextb.test.js`, both failing on the base): ten water
pixels through the list upload uView, uProj, uTime, uLift, uSunScale and
uOpacity once each, set the offset once, a model matrix a pixel, the
ground array once a RUN (six for none / A A / B B B / A A / B / A) and a
tilemap a pixel, in at most 150 calls, classic and under the lane, and
nothing at all for no rows; the host makes one list call after its walk
and none inside it; and a STATE-HOLDING fake GL finds the list's ten draws
identical, draw for draw, to the same pixels drawn one by one, the state
it leaves identical and absolutely what the old draw left, and the
one-row door holding no surface after. The equivalence against the BASE
is `equivX.mjs` above - in the suite both paths run this tree's code.
`test/water.test.js` reads the block off the list's body now and the host's
collection and call. Mutants 25-33, all dead.

**PERF-EXT10-13 together, against the base.** The same two-tree
`equivX.mjs` with the base (`e9dd612e7`) on one side and all four slices
on the other: per-draw state IDENTICAL over every draw of four frames at
noon (9,205) and at night (8,445) - the flats' deduped uploads, the
replays', the water's one block - with 32,992 -> 27,402 GL calls at noon
and 30,600 -> 25,338 at night over the four frames. The picture does not
move; the frame does less to draw it.

# THE SHADOWS (PERF-EXT1-5)

The shadow lens and the draw-submission lens took the Enhanced Lighting
shadow pass apart - the sun's three cascades, the eight lanterns' cube
maps, SC1's static caches - on the same kind of harness (the real
`Renderer`, the real `ShadowPass` and the lane over a counting GL; the
shadow lens's `harness.mjs` town and its `harness2.mjs` at layoutNature's
real density, 31 records over 128 x 128 tiles), and the draw lens's
census of the REAL game over a real ARENA2 in the provers' scratch (not
in this container). Where the two lenses found the same win in two forms,
the slice says which form it took and on what measurement. Every number
under "Measured" was re-run on the committed tree against the base
(`1d05f5374`, PERF-EXT10-13 in); the provers' game-side numbers are
quoted as theirs.

## PERF-EXT1 - a flat batch reaches a shadow by its placements

**What the frame paid.** A streamed pixel's flats are ONE batch per
(archive, record) across the whole pixel - a climate's nature record is
120 to 260 trees over 819 units - so a batch's bounding sphere is some
four hundred units across. It passed every sun cascade and every lantern
face in its pixel, and SC1 found it "near" every lantern there. A tree
record sways in any breeze (floraSway is on by default, and above a
metre or two a second of wind a tree's lean passes SHADOW_SWAY_STILL), so
every lantern in a town at night blitted and redrew six faces on the
sway's beat, drawing a wood none of whose trees stood in its reach. The
draw lens's census of the real city at night: 1,676 of 2,301 draws a
frame were that replay - 73% of the frame - and 16.6 of them had a tree
in the face. At noon the near cascades drew 123 and 144 flat batches a
frame for 7 and 79 with a tree in them.

**The change.** A static batch of more than one flat keeps its
placements on a grid (`bounds.js` `placementGrid`, minted in the batch's
literal as `_place`), and the pass asks its QUADS: the replay, after the
sphere test, whether any quad is in this cascade or face
(`placementsInVolume`); `_dynamicNear` and `_staticSignature`, after
theirs, whether any is in the lantern's CUBE (`placementsInCube`). A quad
is bounded by the sphere at its placement lifted h/2 (batchSphere's
lift, the sign kept) of radius hypot(w, h)/2 plus WIND3's lean at the
crown, a hair wide for float32 - BB_VS's own corners, sway included - and
a sphere beyond a plane rasterises nothing behind it. The cube and not
the far sphere: the six faces' frusta tile the cube, and a face draws
into its corners. A batch built dynamic has no grid (its centres move),
and `moveBillboardBatch` and a free drop it.

**Two forms, one taken.** The draw lens split a batch 4 x 4 over its
footprint and tested every cell's sphere, then that cell's placements; the
shadow lens kept a finer grid (up to 16 x 16), visited only the cells
under the volume - a cascade's cut to the batch's own height span through
the volume's inverted corners - and asked the static signature too. Both
draw the same set. Built both ways on this tree and timed with a free
no-op GL (`PLAIN=1`, 3 alternating runs, 300 frames):

| real density, pass JS ms/frame | base | fine grid + slab cut | 4 x 4, every cell | 4 x 4, cube by its cells (taken) |
|---|---|---|---|---|
| day | 0.117 | 0.213 | 0.155 | 0.146 |
| night | 0.440 | 0.431 | 0.373 | 0.366 |
| dusk | 0.565 | 0.639 | 0.532 | 0.541 |

and the two queries alone on one real-density pixel (31 records of ~264,
`qbench.mjs`): the lanterns' cube 14-16 us a frame on the fine grid, 23-31
on 4 x 4 testing every cell, 18 on 4 x 4 visiting only the cells the
cube's box meets; the cascades' volume 43-47, 27-33 and 27-29. The slab
cut costs more per batch than sixteen sphere tests. So the taken form is
the draw lens's 4 x 4 cells with the shadow lens's cube query and its
three sites (the signature included), and from the draw lens's prover
two corrections the shadow lens's form lacked: the padded quad radius,
and a moved batch dropping its grid (the hunter's first cut kept its
birth placements; a gib's shadow went from a cascade and three faces).

**Measured** (the shadow lens's harnesses, 300 frames walking and
turning; means after SC1's hold, the frame's maximum in brackets):

| | base | PERF-EXT1 |
|---|---|---|
| town, draws a frame, day | 270.6 (353) | 182.6 (258) |
| town, dusk | 567.9 (1,287) | 192.8 (532) |
| town, night | 297.3 (934) | 10.3 (274) |
| town, GL calls day / dusk / night | 817 / 2,669 / 1,859 | 461 / 670 / 216 |
| town, lantern faces redrawn / depth blitted a night frame | 18.6 / 4.88 Mtexel | 9.5 / 2.52 Mtexel |
| real density, draws day | 373.3 (508) | 197.6 (296) |
| real density, dusk | 982.8 (2,007) | 200.6 (537) |
| real density, night | 615.5 (1,514) | 5.3 (257) |
| real density, GL calls day / dusk / night | 1,279 / 4,549 / 3,299 | 529 / 629 / 111 |
| pass JS with a free GL, day / night (two runs) | 0.117-0.127 / 0.440-0.535 | 0.146-0.175 / 0.366-0.373 |

The provers' game-side A/B on the real city (the draw lens's `abref.mjs`,
not re-run here): at night 2,298 -> 634 draws and 16,989 -> 6,055 GL calls
a frame, lantern point draws 1,743.5 -> 11.5, `ShadowPass.render` 5.36 ->
3.31 ms on SwiftShader; at noon the lanterns' 382.8 draws a frame to 0. On
the players' Windows path (Chrome over ANGLE's D3D11) every removed flat
draw also removes a vertex-stage constant-buffer rewrite, because uRight,
uOrigin and uSize go up per draw.

**The picture.** Where a replay runs, it draws what it drew: the harness's
VERIFY mode placed every quad of every batch a replay skipped as BB_VS
places it, sway at the gust's peak, and found each wholly beyond one clip
plane - 67.8 million quads over 475,095 skipped batch-replays (day, dusk
and night, walking, and turning in a 30 m/s wind), none unproven, no draw
the base did not make. The draw lens's prover read back all 51 sun and
lantern depth layers bit-identical on SwiftShader, a moved gib included.
WHAT MOVES, exactly: a lantern whose only reason to redraw was a distant
swaying wood no longer redraws. So a walker leaving its reach is erased
the next frame - as calm weather erases it today - not at the sway's next
beat; and a mover in the cube's corner past the far sphere (past the
lamp's range, where it lights nothing) is not painted, as calm weather
does not paint it today. The shadow lens's layer differential counted
both: 2 of 7,152 windy layer states among trees, 0 of 7,599 calm.

**Pinned** (`test/perfexta.test.js`, every one failing on the base): a
lantern beside a swaying wood whose 41 trees stand 150+ units off redraws
no face, blits nothing and binds none of it (the base: twelve faces), and
redraws for one tree moved to its foot and for a 1 x 3 quad in a face's
CORNER 22.3 from it (the far-sphere variant loses that one); the near
cascades bind a wood 150+ from the eye in neither (the base: every
cascade) and one with a tree at the eye in all; VERIFY in the suite -
random woods, winds, origins and heights replayed into the sun's cascades
and eight lanterns' caches and live layers, each skipped quad proven
beyond one plane at the gust's two extremes; the grid holds every
placement once as the float32 the GPU reads, and one flat, a dynamic
batch, a move and a free carry none, a static batch moved into reach and
a gib both casting where they are; a 10,000-tree wood answers twenty
lanterns and two cascades as a scan does, reading under a third of what
the scan reads, and a cascade off the wood reads no placement; a still
wood out of reach leaves a lantern's static set without a rebuild; the
lift (a crown alone in the cube) and the lean (0.07 of wind carrying a
wide quad in) each hold the slot; and WHAT MOVES - a lantern beside a
distant wood with a walker leaving is the same, frame for frame, in wind
and in calm. The provers' own pins pass on the tree and fail on the base
(`pins.test.mjs` 1-2); their guards pass on both (`pins2.test.mjs`'s
corner, `gibpin.test.mjs`). Mutants `tools/mutants/perfexta.json` 1-16,
all dead. `test/hard3_types.test.js`: the literal mints 35.

## PERF-EXT2 - a run of sub-meshes is one depth draw

**What the frame paid.** PERF4 merges a pixel's block models into one
static batch with one sub-mesh per texture, laid end to end from index 0
(`StaticBatchBuilder.finish`), each spanning the whole pixel - so nearly
all of them pass every cascade and every lantern face, and every replay
drew a 40-texture city pixel as 40 draws. One draw per texture is the
LIT pass's minimum (Rendering-Arc's PERF4 record says so, rightly, for
that pass). A depth replay binds nothing between two sub-meshes: DEPTH_FS
reads nothing, the model matrix and the VAO are the record's.

**The change.** In the replay's mesh arm, a visible sub-mesh that starts
where the run ends extends it; anything else draws the run and starts
another, and the last run is drawn after the loop. The same triangles,
and depth is a per-texel minimum no draw order can change. A culled
sub-mesh breaks the run by itself (the next visible one starts past the
run's end). The two lenses wrote the same thing two ways - the draw
lens's look-ahead tested a culled neighbour's sphere twice; the shadow
lens's run-and-flush, taken, tests each once.

**Measured** (the same harnesses, on top of PERF-EXT1):

| | PERF-EXT1 | PERF-EXT2 |
|---|---|---|
| town, draws a frame, day (mesh draws) | 182.6 (119.0) | 72.6 (9.0) |
| town, dusk / night, max a frame | 532 / 274 | 156 / 36 |
| real density, draws day (mesh) | 197.6 (118.2) | 88.9 (9.5) |
| real density, dusk / night, max a frame | 537 / 257 | 168 / 23 |
| GL calls a frame, town day / real day | 461 / 529 | 351 / 421 |

The maxima are SC1's cache rebuilds - six faces of every visible
sub-mesh - which is where the merge bites at night. A bare drawElements
is about 0.05 us of Chrome's main thread (the shadow prover's
`callcost.mjs`), so the saving is the GPU process's and the driver's
per-draw cost, some 110 draws a frame by day - not measurable here. The
draw lens's game-side census of the real city at noon: 358 sub-mesh
draws over three frames collapse to 54 runs.

**The picture.** The harness's VERIFY compared the triangle set every
mesh replay drew with the per-sub-mesh base's: identical in 7,802 replays
over six runs, no mismatch. The draw lens's prover read the three
cascade layers back bit-identical on SwiftShader.

**Pinned** (`test/perfexta.test.js`, both failing on the base): a pixel
of thirty texture groups built by the real `StaticBatchBuilder` and
`createMesh` is one draw a cascade over its whole range from 0, and with
its middle group's sphere out of the cascade, two draws at exactly
[0, 600) and [1200, 1800); and over random meshes - runs that meet, gaps,
empty groups, spheres in and out - replayed into the sun's cascades and
eight lanterns' caches, every replay's triangles are, as a multiset,
its visible sub-meshes', in 380 draws for 529 visible sub-meshes (the
base: 529). The count pins the merge moves by design are restated with
their reason: `test/sc1_shadowcache.test.js` (five tests - the room's two
sub-meshes meet, one run), `test/audit_lighting.test.js` (ONE MESH AT
TWO PLACES), `test/el2_shadows.test.js` (the renderer builds the pass:
3 x 3 sun draws, 6 x 2 face draws). Mutants `perfexta.json` 17-21, all
dead; `perfextb.json`'s PERF-EXT11-9 re-aimed by content again.

## PERF-EXT3 - every lantern's static signature in one walk

**What the frame paid.** SC1 decides whether a lantern's static cache is
still good by folding every still caster in its reach into a signature,
and the rank loop asked for it once a CASTER - each ask a whole walk of
the frame's records and batches (the filter chain, the no-cast Set,
batchSphere, the touch, the fold), made even when every cache was valid
and nothing was drawn. Eight lanterns in a town at night were eight
walks a frame: the cpu lens measured them at 0.74 ms a frame on the
harness town before PERF-EXT10's one shape, 0.2 ms after it.

**The change.** `_staticSignatures(cp, nC, out)`: before the rank loop,
every ranked caster's (x, y, z, far) - the pos and the shadow's far the
loop itself takes - and ONE walk that filters each item and takes its
sphere once, then tests it against each caster (PERF-EXT1's cube
included) and folds it into that caster's (hash, count) on a touch; the
loop reads them by rank. The same items into the same folds:
`foldSignature` is a sum, blind to order, and nothing the walk reads can
change in the replays between two ranks. What differs is when an item
is NAMED - `shId` mints on an item's first touch of any caster, item by
item, where the walks minted caster by caster - and an id is a name held
for the item's life that a cache compares only against its own last
answer. DISC15's lo tier, which asks light by light and stops at its
rebuild budget, asks the same walk for one (`_staticSignature`), so the
signature has one home. The cpu lens's extension - per-caster candidate
lists for the face replays - was neither prototyped nor measured, and is
not here.

**Measured.** The cpu lens's town (`townFrame.mjs --night`, 800 frames,
`ab.sh` median of 9 alternating runs; the base is PERF-EXT2):
`beginFrame`, where the pass runs, 0.477 -> 0.352 ms a frame. By day
the harness lights no lantern and the walk does not run (0.271 -> 0.255,
noise). The walks alone over one frame's records (the prover's
`sigBench` rebuilt on this tree: eight lanterns, the real renderer's
records, a third of the batches pixel-wide woods with their placements;
3 runs, median of 5 each): 1,000 batches and 100 meshes 245-266 -> 82-90
us a frame, 2,000 and 150 528-538 -> 186-194. Towns at night and
anywhere else lanterns cast into the cache.

**The picture.** Unchanged: the same caches are drawn on the same
frames. The cpu lens's prover compared 1,528 signatures of 400 random
frames against the per-caster walk, 0 differing; the suite does the same
(below) and replays a scripted night through a twin that walks per
lantern.

**Pinned** (`test/perfexta.test.js`, every one failing on the base): on
a still night with every cache valid, the pass reads each still flat's
bounds as often under eight lanterns as under one (the base: once a
lantern); over 200 random frames of records - still, moving, swaying,
dead, noShadow, concealed, no-cast and light flats, unbounded batches,
woods with their placements, still, moving and unbounded meshes, terrain
- and one to eight random lanterns, each lantern's (hash, count) from one
call equals the base's walk of that lantern alone, transcribed, over the
same items (887 signatures, 4,217 folds); and a scripted night of 120
frames (a walker crossing and stopping, a lantern lit nearest of all -
rank 0 in the last slot, a wood hidden and shown, a crate shoved, a batch
freed) asks once a frame for every lit lantern, each at its own light
and the shadow's far, and draws the same caches on the same frames, slot
for slot, as a twin whose signatures are the base's walk lantern by
lantern - the lantern lit drawing its own cache alone. Mutants
`perfexta.json` 22-31, all dead; `perfexta.json`'s PERF-EXT1-7 and
`el8.json`'s cadence-no-change-check re-aimed by content.

## PERF-EXT4 - a recorded mesh's matrix scale, once

**What the frame paid.** Every mesh the frame draws is recorded for the
shadows (Enhanced Lighting's default), and the record puts the mesh's
sphere and every sub-mesh's through the same matrix - each call to
`transformSphere` taking the matrix's three column lengths again: three
`Math.hypot` a sphere, 3 x (1 + sub-meshes) a record, over nine numbers
that had not changed. A 3-argument `Math.hypot` is some 40 ns in V8
where the sum of squares under a square root is 3 (the cpu lens's
`hypot.mjs`).

**The change.** `bounds.js` `matrixScale(m)`, the largest column length,
and `transformSphereScaled(m, s, sc, out, o)`, the transform with the
scale in hand; `transformSphere` is the one taking its own, so the
transform has one home. `recordMesh` asks the scale once and hands it to
the mesh's sphere and every sub-mesh's. Still `Math.hypot`: the same
operations on the same values, every radius the same bits.

**Measured** (the cpu lens's town, 800 frames, `ab.sh` median of 9
alternating runs; the base is PERF-EXT3): `Math.hypot` calls a frame
2,545 -> 1,100 by day and 1,989 -> 792 at night (counted over 300
frames, the scene's build included, so the difference is the saving:
1,445 and 1,197 a frame); the frame's `batches` zone, where the meshes
are drawn and recorded, 0.441 -> 0.390 ms by day and 0.413 -> 0.377 at
night. Small and free, and it grows with the sub-meshes in view and in
shadow reach.

**The picture.** Unchanged, bit for bit: the same spheres, so the same
culls.

**Pinned** (`test/perfexta.test.js`, failing on the base): a mesh of
forty bounded sub-meshes and one without, recorded under a rotated,
non-uniformly scaled (the y column the longest), translated matrix,
takes exactly three `Math.hypot` (the base: 123), and its sphere and
every sub-mesh's equal, `Object.is` float for float, the base's
transform transcribed. Mutants `perfexta.json` 32-36, all dead;
`el5.json`'s transform-scale-min and record-never-bounded re-aimed by
content.

## PERF-EXT5 - the sun's 3x3 kernel in four taps

**What the frame paid.** Every flat fragment by day, at any distance
(TREES1's soft read), and every lit fragment of the terrain, meshes,
rigs, decals and water within the two near cascades (43 m of the eye -
nearly all the ground on screen) ran `sunShadowTap`'s kernel: nine
hardware 2x2 comparison taps one texel apart, 36 depth compares. Each
tap is already a bilinear PCF over four texels (the sun map is
COMPARE_REF_TO_TEXTURE with LINEAR filtering).

**The change.** Per axis the nine taps weigh the four texels under them
[1-f, 1, 1, f], f the sample's fraction past a texel centre. Two
bilinear taps give exactly that: one over the first pair at weight 2-f,
set 1/(2-f) of the way into it, and one over the last pair at weight
1+f, set f/(1+f) in. The kernel is separable, so four taps - (2-f)(2-f),
(1+f)(2-f), (2-f)(1+f), (1+f)(1+f), over 9 - are the nine: the same
texels, the same weights, clamped at the edges the same way. The far
cascade's one tap for a per-fragment surface (PERF-SUN1) is untouched,
and so are the lanterns. The locals are t*/w*, never u* (a name that
reads as a uniform). Both lenses' provers derived this form; it is the
fill lens's and the shadow lens's `p4`, the same arithmetic.

**What differs, exactly.** In exact arithmetic nothing (the node twins:
3.3e-15 at worst, float rounding). On a GPU each tap's sub-texel
fraction is quantised - 8 bits on the D3D11-class cards the players
have - and the four taps quantise different fractions than the nine
did, so a penumbra can move by less than one 255th of the sun's light:
the provers' worst over random maps 0.93 of a 255th (truncated
fractions) and 0.66 (rounded), the suite's twin 0.85 and 0.52. The
nine taps' own quantisation error against the exact filter is of the
same size (2.4e-3). Rendered on SwiftShader through the real renderer,
960 x 540, the tree against the base's nine put back into every
shader that carries the block (seven sources): 2 of 518,400 pixels
differ, by one step.

**Measured.** Five of nine fetches per affected fragment; the GPU's
share, which the CPU-bound harness cannot see. The fill lens's harness
(the real Renderer, EL lane, air pass, clouds and dome, 2,400 tree
flats, SwiftShader, A/B contexts interleaved, every draw timed between
readPixels syncs, 6 frames; relative only) on this tree: world:flats
min 120.8 -> 111.0 ms (-8%), median 172.5 -> 163.5; world:terrain min
167.3 -> 164.8 (within its noise on a loaded host; the prover's quiet
run, -6.0%). At the players' 1080p-1440p, some millions of fetches a
frame; the provers' estimates for a 4060 Ti or an RX 6600: 15-23 us at
1080p (the fill lens), about 0.05 ms and up to 0.2 ms at 1440p (the
shadow lens).
Compiled and linked in headless Chromium (the shadow prover's probe of
the repo's `perfSunShaderProbe`): the five lane FS and the five lane
programs, and the water FS with and without the block, all ok, no GL
error.

**Pinned** (`test/perfexta.test.js`, failing on the base):
`sunShadowTap` fetches the map five times (the far cascade's one, the
kernel's four; the base: a loop of nine), has no loop, takes the four at
the positions and weights the twin proves, and names no local like a
uniform; and the twin - its lines tied to the shader's - on random
depth maps (straight edges and noise, clamped, LEQUAL): the four equal
the nine to 1e-12 with exact weights, within a 255th with 8-bit ones.
`test/el2_shadows.test.js` ('a 3x3 PCF') and
`test/perfsun_fragment.test.js` (PERF-SUN1, the kernel after the cheap
tap) restated on the four-tap text. Mutants `perfexta.json` 37-41, all
dead; `perfsun.json`'s PERF-SUN1 cheap-tap mutant re-aimed by content.
