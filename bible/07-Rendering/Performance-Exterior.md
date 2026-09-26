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
census of the REAL game over a copy of ARENA2 in the session's scratch
(not in the repo). Where the two lenses found the same win in two forms,
the slice says which form it took and on what measurement. Every number
under "Measured" was re-run on the committed tree against the base
(`1d05f5374`, PERF-EXT10-13 in); the provers' game-side numbers are
quoted as theirs, and the five slices together were measured on the game
itself, before and after (THE SHADOWS, MEASURED WHOLE, below).

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
theirs, whether any is in the lantern's CUBE (`placementsInCube`) - the
signature outside a room drawn whole (the review, below). A quad
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
answer. DISC15's lo tier, which asks light by light - EVERY lamp not
fresh, every frame, for its rebuild budget is spent only on a change and
a still room never spends it (the review corrected this line, which said
it "stops at its rebuild budget") - asks the same walk for one
(`_staticSignature`), so the signature has one home. The cpu lens's
extension - per-caster candidate lists for the face replays - was
neither prototyped nor measured, and is not here.

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

## THE SHADOWS, MEASURED WHOLE - before and after, on the harnesses and the game

The five slices together against the cluster's base (`55e63ea6f`, the
flats and the frame's CPU in, PERF-EXT10-13 and their review), each
harness run on both trees.

**The shadow lens's harnesses** (`harness.mjs` town, `harness2.mjs` at
real density; 300 frames walking and turning; draws a frame, the
frame's worst in brackets, and GL calls a frame, both exact):

| | base | PERF-EXT1-5 |
|---|---|---|
| town day, draws (max) / GL calls | 270.6 (353) / 817 | 72.6 (120) / 351 |
| town dusk | 567.9 (1,287) / 2,669 | 80.6 (156) / 558 |
| town night | 297.3 (934) / 1,859 | 8.0 (36) / 214 |
| real density day | 373.3 (508) / 1,279 | 88.9 (157) / 421 |
| real density dusk | 982.8 (2,007) / 4,549 | 90.7 (168) / 519 |
| real density night | 615.5 (1,514) / 3,299 | 2.0 (23) / 107 |
| lantern faces redrawn a night frame, town / real | 18.6 / 13.2 | 9.5 / 5.3 |

VERIFY on the committed tree (six runs: day, dusk and night, walking,
and turning in a 30 m/s wind): 7,802 mesh replays drew the base's
triangle set exactly; 475,095 batch-replays skipped, their 67,759,760
quads each proven wholly beyond one clip plane, none unproven, no draw
the base did not make.

**The pass's JavaScript with a free GL** (the same harnesses, `PLAIN=1`:
a plain object of no-op GL methods, so node times the pass and not a
trap; three alternating runs, ms a frame): at real density by day
0.120-0.122 -> 0.126-0.131, at night 0.428-0.460 -> 0.284-0.298, at dusk
0.520-0.592 -> 0.435-0.470; the town by day 0.074-0.081 -> 0.079-0.108,
at night 0.277-0.302 -> 0.211-0.225, at dusk 0.361-0.389 -> 0.321-0.392.
By day the placement tests cost about what the dropped draws' JS saved;
at night the lanterns' redraws and the eight walks were the frame's.
On the cpu lens's whole-frame town (`townFrame.mjs`, a counting GL, 800
frames, `ab.sh` median of 9): `beginFrame`, where the pass runs, 0.358
-> 0.322 ms at night and 0.206 -> 0.245 by day - there the node side of
the cascades' placement tests (0.013 of it in the far cascade, measured
by skipping it) is not repaid, because a counting GL charges almost
nothing for the ~900 calls a frame they save. The game's own main
thread, below, is where those calls are paid.

**The game** (`gameab.mjs`, the draw lens's `abref.mjs` instrument on one
tree a run: the real game in headless Chromium on SwiftShader over a
copy of ARENA2 in the session's scratch - not in the repo - Daggerfall
city at 640 x 360, every WebGL2 call counted, `ShadowPass.render` timed
on the main thread; 48 frames after the boot settles; counts exact,
times relative):

| Daggerfall city | noon, base | noon, PERF-EXT1-5 | 22:00, base | 22:00, PERF-EXT1-5 |
|---|---|---|---|---|
| GL calls a frame | 6,598 | 4,091 | 13,011 | 3,627 |
| draws a frame | 1,338 | 794 | 2,298 | 634 |
| sun cascade draws | 495.4 | 212.8 | 0 | 0 |
| lantern face draws | 279.0 | 0 | 1,711.7 | 11.8 |
| lantern faces redrawn / depth blits | 10.8 / 10.8 | 0 / 0 | 24.5 / 24.5 | 16.9 / 16.9 |
| `ShadowPass.render`, main thread | 2.51 ms | 1.97 ms | 2.66 ms | 1.96 ms |

(casters 7.1 at noon and 8.2 at night on both; the wind 14.5-14.8 m/s
in every run.) The players' cards run the same calls through ANGLE's
D3D11 back end, where each removed flat draw also removes a vertex-stage
constant-buffer rewrite; the per-draw GPU-process and driver cost is not
measurable here, and the fps they will see is not claimed.

## THE REVIEW OF THE SHADOWS - the interior, the bound's two margins, the one homes

An adversarial reviewer re-read PERF-EXT1-5 against the players' own
words - "fps issues in the exterior but fine in the interior", "me too
my friend.. don't know why. I got a RX6600" - and measured the half
that was fine. Three findings, each reproduced on this tree before it
was changed.

**R1: PERF-EXT1 made a building's shadow pass dearer.** The reviewer's
bench (`interiorBench.mjs`, in the review's scratch, not the tree: the
real `Renderer` and `ShadowPass` of each tree on a free no-op GL,
`renderer.everyLightCasts()` called as `worldModes.js` calls it,
batches built as `interiorContext.js` builds them - one per (archive,
record), a few flats each - and `beginFrame` timed) put the loss on
DISC15's lo tier. `_renderLo` asks `_staticSignature` of every lamp
that is not fresh EVERY frame - its budget, `SHADOW_LO_REBUILDS`, is
spent only on a change, and a still room never changes - and PERF-EXT1's
cube query ran in that walk for every multi-flat batch whose sphere
touched the lamp, with a `Math.hypot` for the quad's half-diagonal at
each: 1,600 cube queries a frame in a 40-lamp room, for nothing. PERF-EXT3
above said the lo tier "stops at its rebuild budget"; it asks every lamp
every frame (corrected there).

**The change.** `_staticSignatures(cp, nC, out, quads)`: in a room its
host draws whole (`f.everyLight`) BOTH walks - the eight's and the lo
tier's - fold a batch by its sphere, as the base did; anywhere else by
its quads, as PERF-EXT1 does. Where nothing is culled by view and
nothing streams, a room's static set moves only when a thing in it does,
and the quads could only spare a rebuild on that frame. By the sphere a
signature folds a superset of what the quads fold, so no cache is left
stale - a change of what a face draws is a change of the superset - and
at worst a map is rebuilt for a flat that draws nothing into it, within
the budget, as before PERF-EXT1. The replays that DRAW the maps still
skip by the quads (`placementsInVolume`), so what a map holds is what
PERF-EXT1 drew. And everywhere, the quad's half-diagonal is taken ONCE a
size (`bounds.js` `placedHalfDiagonal`), remembered on the batch's grid
with the w and h it is of - a host may write a size through, as
`world.js` writes a walker's - where every ask took `Math.hypot` again:
125-452 asks a frame on the town harness and 229-802 at real density,
day to dusk.

**Measured.** The reviewer's bench, `beginFrame` ms a frame (median of
5-7 alternating runs, 1,500 frames after 300):

| room (lamps x batches of flats) | base `1d05f5374` | first cut `dfe366f2c` | now |
|---|---|---|---|
| 40 x 40 of 6 | 0.193 | 0.466 | 0.200 |
| 24 x 24 of 5 | 0.123 | 0.224 | 0.118 |
| 30 x 30 of 5, clustered | 0.143 | 0.179 | 0.144 |
| 16 x 20 of 4, clustered | 0.096 | 0.106 | 0.091 |
| dungeon-like (no lo tier, 120 batches over 3,000 units) | 0.153 | 0.154 | 0.146 |

(The 40 x 40 room's frames that change the eight - the eye walks a
circle - draw 46 point draws where the base drew 240: the replays'
quads, kept.) A dungeon is not drawn whole, so it runs the first cut's
walk, and the three are within its noise. The same 40 x 40 hall NOT
drawn whole (a case no host makes - every building calls
`everyLightCasts`) is where the quads are still asked: 0.110 / 0.130 /
0.133, the price of the eight's walk and the replays that save those
194 draws. The pass's JS on the shadow lens's harnesses with a free GL
(`PLAIN=1`, 5 alternating runs, median ms a frame), first cut -> now:
real density by day 0.139 -> 0.114 (the base's 0.120-0.122), at night
0.308 -> 0.296, at dusk 0.459 -> 0.424; the town by day 0.075 -> 0.077,
at night 0.246 -> 0.215, at dusk 0.306 -> 0.306.

**The picture.** Outside a room nothing moves: the draws a frame are the
first cut's on both harnesses (town 72.6 / 80.6 / 8.0, real density
88.9 / 90.7 / 2.0, day / dusk / night), and VERIFY on this tree over the
reviewer's nine runs gives the first cut's totals exactly - 587,565
batch-replays skipped, their 68,564,532 quads each proven beyond one
clip plane, none unproven, no extra draw, 11,568 mesh replays with the
base's triangles. In a room what moves is WHEN a map is rebuilt, never
what it holds: a flat freed rebuilds every lo map its sphere reached,
the base's answer (in the pin's hall 9 maps, where a quad of it stood in
8).

**R2: two margins of the quad's bound that no pin held.** Two of the
reviewer's extra mutants survived the suite: the float pad dropped from
`placementRadius`, and the lean taken by the SIGNED height. Both are
pinned now. The pad: at 1,600 units float32 cannot tell a quad from one
6e-5 nearer (the card holds `uOrigin + aCenter` no finer), so a quad
whose unpadded bound misses a lantern's cube by 6e-5 is in, and one
2e-3 out is not. The lean by |h|: an upside-down wide quad (h -1, the
sign `droppedTorches.js` gives a flame) that the wind leans 0.07 toward
a lamp holds it as the upright one does, and 0.15 further does not -
BB_VS's own law (`* uSize.y`), held for the first producer that sways a
negative height; today only flora sways. (`recordBillboards` takes the
SIGNED lean for "is it swaying", so such a batch would be still to SC1
and its lean the cache's; noted, not changed - nothing makes one.)

**R3: one home for the lift and the half-diagonal.** PERF-EXT1 wrote
batchSphere's lift out twice more, inline in the two placement queries
- GHOST1's ghost campfire was two copies of that line disagreeing - and
a third half-diagonal beside the birth's and a move's. `bounds.js`
`batchLift` and `quadHalfDiagonal` are the one homes: batchSphere, both
queries, `createBillboardBatch`'s sphere, `moveBillboardBatch`'s and
`placementRadius` take them. The same arithmetic on the same values, so
every sphere and radius keeps its bits (the suite, and VERIFY above).

**Pinned** (`test/perfexta.test.js`, 16 -> 20): a still hall of twenty
lamps and twenty batches of six flats under `everyLightCasts` reads no
batch's placement grid in three frames while every lamp keeps its lo
map (the first cut: 10,806 reads), the same hall not drawn whole still
asks the quads, and a flat freed in the hall rebuilds, within the budget
a frame, at least every lo map a quad of it stood in and at most every
one its sphere reached; a swaying wood beside a lantern takes
`Math.hypot` of its size once in ten frames (the first cut: 9), and a
size written through in place - a crown grown taller, a quad grown wider
- is asked again and carries the wood into a cube it did not reach; the
pad and the lean by |h|, as above; and ONE HOME EACH, by source over
`src/render/`: the lift written once and the half-diagonal once, at
their homes, and every caller calling them. All four fail on the base;
the room's, the half-diagonal's and the one home's on the first cut too,
and the margins' pass there - they hold what it had.
`test/blood1_decals.test.js`'s and `test/perfon2_peercull.test.js`'s
by-source pins read the lift and the half-diagonal at their homes.
Mutants: `perfexta.json` 42-54 (PERF-EXT-R1 to R13: the eight or the lo
tier asking the quads in a room, the flag ignored, a street asked by the
sphere, the memo asking every time or keyed on one of w and h, the pad,
the signed lean, each home halved, the lift and the half-diagonal
written out again), all dead; re-aimed by content:
`perfexta.json` PERF-EXT1-7, 9-12 and PERF-EXT3-10, `ghost1.json`'s three
lift records (now at its home), `blood1.json`'s three moved-sphere
records and `el5.json`'s bb-bounds-no-flat. 68 run, 68 dead.

# THE STREAMING HITCHES (PERF-EXT20-26)

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

# THE SHADERS (PERF-EXT30-31)

## Cluster D — the shaders

Two slices, one idea: a shader that multiplies its answer by nothing
should not compute the answer. Both are picture-neutral by construction -
the skipped work is added at weight 0 or reads an image that is black -
and both were diffed pixel for pixel against the base on the real
modules: **0 bytes differ**, in every sky, day and night, lanterns lit
and not.

**The honest scale, first.** Counted against the cards' published texel
rates (RTX 4060 Ti 344.6 GTexel/s, RX 6600 223 GTexel/s) these are tens of
microseconds a frame at 1080p - two to four times that at 1440p and 4K,
and more on an integrated GPU. PERF-TOWN1 measured the exterior
CPU-bound (nine to nineteen milliseconds of JavaScript), and these do not
change that: they are the fill-rate share, which is what a player at a
high resolution, or on the wrong adapter, pays.

### PERF-EXT30 — the sky stops drawing clouds it has been told to hide

**What the frame paid.** Under the volumetric clouds - the default since
VC3, over either sky since DS2 - each sky is told to stand its own clouds
down, and each did it by weight, not by skipping:

- **Dynamic Skies, the default sky** (`OUTDOORS_DEFAULT = 'dynamic'`,
  `world/outdoors.js`; the mod's `Enabled` on by default). `draw()`
  uploads `_CloudTopOpacity` and `_CloudOpacity` as 0, and each of the
  mod's two sheets still ran whole on every sky pixel - two diffuse taps
  and two normal-map taps, two `UnpackNormal`, a `BlendNormals`, the
  remaps, `hsmoothstep` and the sun's rim - to end in
  `mix(col.rgb, sheet, x * 0)`: the colour it was handed. Eight taps and
  about 120 ALU a pixel, multiplied by nothing.
- **The port's own dome** (the "dome" tier). VC3 hands it `uCloudCover`
  0, and every pixel above the horizon still ran both fbm decks - forty
  hashes, ten noise blends, the rim's three pows. With cover 0 each deck
  is `smoothstep(1, 1 + soft, fbm)`, and fbm cannot reach 1: five octaves
  of a hash in [0, 1) weighted 1/2 down to 1/32 sum under 0.96875. So the
  cover was 0, exactly, every time.

**The change.** Each is gated on its weight: the mod's sheets on
`_CloudTopOpacity > 0.0` and `_CloudOpacity > 0.0` (the three locals
both sheets write are declared above the pair, where the second can see
them), the dome's decks on `dir.y > 0.0 && uCloudCover > 0.0`. The mod's
lines inside the gates are its own to the character, left at their
indentation so they still read against the vendored shader. The gates
are uniforms, so the taps' implicit derivatives stay defined.

**Why the picture cannot move.** `mix(c, s, 0)` is `c` for any finite
`s`, and every shipped preset's sheet is finite: `AlphaMax` is above
`AlphaTreshold` on both sheets of all seven (so `hsmoothstep` never
divides by 0), the top sheet's boost divides by 1 (the float3 quirk,
uploaded as 0), and the Cloudy low sheet's boost of 1.0 divides by 0 into
a `saturate`. The dome's deck at cover 0 is 0 for any `soft` above 0, and
the smallest weather row's is 0.18. `?clouds=off` gives a sheet its
preset's opacity (0.25 to 1.0) and a deck its row's cover, and both run
as they always did.

**Measured** (SwiftShader, 960x540 full-screen sky, A/B alternating, real
syncs; A is `e9dd612e7`'s module, B the tree's, each built by its own
constructor; the default sky with all its vendored textures loaded):

| sky, case | median A -> B | min A -> B | bytes differ |
|---|---|---|---|
| Dynamic Skies, noon, cloudy, looking up | 211.2 -> 198.2 ms (-6.2%) | 201.0 -> 184.2 (-8.4%) | 0 of 2,073,600 |
| Dynamic Skies, noon, sunny, level | 219.3 -> 202.9 (-7.5%) | 202.3 -> 178.4 (-11.8%) | 0 |
| Dynamic Skies, 01:00, clear, looking up | 218.9 -> 199.8 (-8.7%) | 201.7 -> 174.9 (-13.3%) | 0 |
| Dynamic Skies, `?clouds=off` (control) | 208.4 -> 210.5 (+1.0%) | 155.9 -> 153.1 | 0 |
| port dome, noon, cloudy, looking up | 78.7 -> 65.9 (-16.3%) | 74.0 -> 59.9 (-19.1%) | 0 |
| port dome, noon, clear, level | 72.7 -> 65.0 (-10.6%) | 64.8 -> 55.7 (-14.0%) | 0 |
| port dome, 01:00, clear, looking up | 86.0 -> 72.6 (-15.6%) | 76.9 -> 67.4 (-12.4%) | 0 |
| port dome, real cover (control) | 77.8 -> 77.2 (-0.8%) | 69.9 -> 68.0 | 0 |

In the whole synthetic exterior frame (the real `Renderer`, the air pass,
the clouds, 3x3 streamed terrain pixels, 2,400 flats) the dome's pass fell
69.1 -> 62.8 ms by day and 52.6 -> 45.0 at night, 0 of 518,400 pixels
different. The provers' own runs, on the base with the change
substituted: Dynamic Skies -7% to -10%, the dome -12% to -17%, 0 bytes.
On the cards: about 25-30 us a frame on a 4060 Ti and 40-45 us on an RX
6600 for the default sky at 1080p with 40% of the screen sky; the dome
tier about 55 and 140 us.

**Pinned** (`test/perfextd.test.js`, the shaders RUN in float32 by
`test/glsl.mjs`): the mod's sheets - their own text between `// Clouds`
and `// REDUCE_COLOR` - on the uniforms the real runtime and the real
renderer upload for four weathers and hours, against the same text with
the gates taken out: at opacity 0 nothing is read and the colour out is
the ungated one to the bit; at the preset's opacity both run, eight reads,
the same bit; one sheet on, its own two textures alone. The dome's FS on
the real renderer's uploads, its fbm counted: at cover 0 no noise is
called and every pixel is the ungated dome's to the bit; at a real cover
both decks run and agree. And the premises: every preset's sheets finite
and drawn under `?clouds=off`, fbm's weights and octaves, no deck bias,
no zero softness. Both tests fail with `src/` at `e9dd612e7`.
`tools/mutants/perfextd.json`, 11 of 11 dead: each gate dropped, opened at
0, crossed onto the other sheet or closed before its mix; the locals put
back inside the first sheet; the opacity not zeroed under the clouds; an
fbm weight raised; a deck given a bias.

### PERF-EXT31 — the resolve stops reading images that were not drawn

**What the frame paid.** The air pass's last draws read two images the
frame may never have drawn. The lanterns' glow (VOL1) is cleared black on
every frame it is not marched - no lantern lit, which is every day
outside without a torch, the door shut, or a frame the pass was not
prepared for - and the shafts' image on every frame with neither the
beams nor the haze, which is every night. The resolve still read both on
every world pixel (a tap and an sRGB decode, three `pow`s, for the glow; a
tap for the shafts), and the bright pass read the glow on every
quarter-resolution pixel - to add exactly 0: `airDecode(0)` is 0 and
`0 * uGrade.y` is 0.

**The change.** The two passes are built for what the frame drew:
`bright[glow]` and `resolve[glow][shafts]`, each the full pass less
exactly the reads of the images it is not given; `bright[1]` and
`resolve[1][1]` are `e9dd612e7`'s texts character for character.
`composite()` picks them after `_images()` or `_blank()` has run, from the
flags that decided the draws - `stats.vol` (the glow marched) and
`stats.shafts || stats.haze` (the beams or the haze drew into the shafts'
image) - so a lantern's glow is never gated off. The luminance image
reads the glow either way (sixteen taps a texel of a 32x32 image, 16,384
a frame: nothing to save). No uniform is added, so the frame's GL calls
are the base's to the call (199 by day, 352 at night with thirty
lanterns). Six programs where there were two, built once with the rest of
the pass, which the renderer keeps for its life.

**Not a uniform `if`.** The provers' form was `if (uVolOn > 0.5)` around
each read, and it was built and measured first: SwiftShader flattens a
branch that small and pays the read anyway - the resolve 4-6% faster by
day and nothing at night, against 16% with the read compiled out - and a
GPU's compiler is as free to predicate a four-instruction block. So the
reads are compiled out instead.

**What could differ.** The arithmetic is exact: a black read adds +0 and
the shorter pass computes the same sum without it, and SwiftShader gave
0 of 2,073,600 bytes different in every case. A driver that fuses the
shorter sum differently from the longer one (an FMA where there was a
multiply and an add) could move a float by an ulp - below a byte of the
encoded output except where it sits on a rounding edge. It was never
seen.

**Measured** (SwiftShader, 960x540; A is the full pass - the base's -
and B the one the frame takes, 40 rotating full-screen draws with real
textures at the pass's sizes; then the whole synthetic exterior frame,
A drawing through the full passes every frame as the base did):

| case | resolve, median A -> B | min A -> B | bytes differ |
|---|---|---|---|
| day: glow black, shafts drawn | 27.9 -> 23.4 ms (-16.1%) | 25.7 -> 22.2 (-13.6%) | 0 of 2,073,600 |
| night, lanterns: glow drawn, shafts black | 27.8 -> 25.5 (-8.3%) | 26.1 -> 23.8 (-8.8%) | 0 |
| neither drawn | 27.9 -> 21.2 (-24.0%) | 26.4 -> 20.2 (-23.5%) | 0 |
| both drawn (control: the same program) | 27.9 -> 27.7 (-0.7%) | 25.3 -> 24.0 | 0 |

In the frame, by day: the resolve 31.1 -> 23.8 ms (-23.5%; min -22.1%),
the bright pass 1.2 -> 0.7 (-42%), 0 of 518,400 pixels different, 199
GL calls both. At night with thirty lanterns: the resolve's min 17.8 ->
16.5 (-7.3%), the glow drawn and 0 pixels different, 352 calls both. The
provers' run on the base with the reads removed: the resolve -17.4%, the
bright pass -27%, 0 pixels. On the cards: about 2 million taps and 12
million transcendental ops a frame at 1080p by day, some 15 us on a 4060
Ti and 25 us on an RX 6600, and a tap a pixel more at night.

**Pinned** (`test/perfextd.test.js`, two more): the six fragment sources
as the renderer links them - each variant is the full pass less exactly
its reads, the full pass carries both - RUN in float32 over every frame
the pass can make (each image drawn or black): a variant reads the glow
and the shafts only where they were drawn, and its pixel is the full
pass's to the bit; and on the fake GL, the passes each frame draws
through - a lantern in fog the glow's, a day with no light the bare
ones, the beams or the haze the shafts' resolve, a night the glow's
without the shafts, a menu's frame the bare ones. Both fail with `src/`
at `e9dd612e7`. `tools/mutants/perfextd.json` 13 more, all dead: a read
always in or never in, the shafts' term re-spelled, the choice stuck,
made before the images, blind to the haze, or always the full pass. Re-
aimed by content: `vol1_glow.test.js`'s bright-pass and resolve-bind
pins, `el3_air.test.js`'s program count (seventeen),
`auditretro1.test.js` and `auditretro2.test.js`'s rect reads (the bare
passes those frames take), and the records in `vol1.json`, `el3.json`,
`el4.json`, `el6.json`, `auditretro2.json` and `audit68_render_a.json`
that name the renamed lines (175 dead across the six).

# SCRIPT-SPLIT — "script" on a Direct3D11 screen, and what it was not (2026-09-26)

*Two players' counters via Mac ("Getting some pretty consistent poor
performance reports from some users on exterior play, but not
everyone"), both outdoors, both ANGLE Direct3D11: a GTX 1650 at 1920x1080,
dpr 1, 10 fps, frame 104.3 ms, script 107.5, draws 483; an RTX 4090
Laptop at 2560x1344, dpr 1.5, 5 fps, frame 201.6 ms, script 203.6, draws
609. The first in the rain on a horse in the wilderness, online.*

**The shape.** The script line is the whole frame on both - PERF1's
header reads that as "ours", the main thread's - and it is EVEN (a worst
within 7 and 4 ms of the mean): a cost every frame pays, not hitches.
Per canvas pixel it is ~50 ns on the 1650 and ~59 ns on the 4090 Laptop,
a card several times the 1650's - a per-pixel cost the stronger GPU does
not pay faster. Script minus frame is 3 and 2 ms: the stream's floor
slice (PERF-EXT24), so both were streaming.

**What the headless game said** (the real game in headless Chromium on
SwiftShader over the freeware ARENA2 - tools/fetch-data.sh, outside the
tree - probes in the session's scratch, numbers relative): the frame's
own JavaScript is 10-30 ms on this container's CPU while SwiftShader
takes 0.7-3 s a frame - main thread 97-98% idle - and it does NOT move
with the canvas: Wayrest/Knightstale at 320x180 and at 1280x720 (16x the
pixels) both read 11-31 ms. Online over a local relay (wrangler dev on
`server/`, a test key minting the game's and the bots' tokens), 0, 8 and
18 bots walking around the player read script 28.0, 27.6 and 34.2 ms.
Per frame the game issues ~4,400 GL calls (853 drawElements), uploads
~32 KB, allocates nothing canvas-sized, and makes no synchronous read in
the exterior frame (`readPixels` is the item-icon path's alone;
`getError` retro's LUT build; the one per-frame `isEnabled(CULL_FACE)`
is client-cached). So nothing in the game's own code measured here
reaches 100 ms, and none of it scales with pixels.

**The reading, and it is a hypothesis.** A per-pixel cost that is the
whole script line on Direct3D11 and that no JavaScript here pays is time
the main thread spends WAITING - on GPU work surfaced through Chrome's
command buffer, or on the browser's own per-frame work - and the script
line cannot tell that from the game's code: it is measured from the
rAF's stamp, and Chrome stamps a frame at the display's beat, so
anything the main thread did first is in it before the game's frame
runs a line. SwiftShader's pipeline does not block the renderer that
way (its frames are GPU-bound with a small script line), so this cannot
be reproduced here.

**SCRIPT-SPLIT** gives the counter the one split that settles it: under
the script line, `in frame` (the game's own callback, a stall inside a
GL call included), `before` (the stamp to the callback: whatever ran
first) and `stream` (the lent build slices), which sum to it
(`systems/frameClock.js` samples them, `ui/fpsCounter.js
scriptSplitLine` prints them, `__fpsStats` carries them). Reading a
report: a large `before` is the browser's or the driver's, outside the
game's frame; a large `in frame` with `?perf=cpu`'s zones (PERF-CPU)
names the pass whose GL calls block, and `?perf=zones` (VC6d) that
pass's GPU time where the browser has the timer. Three things to ask an
affected player, each a minute: Render scale 50% (PERF-SCALE - if the
fps roughly doubles or more, the cost is the world's pixels), the
`Compositing` and `WebGL` lines of `chrome://gpu` (a software
compositor reads every WebGL frame back on this thread), and a counter
screenshot with this line. Pins `test/scriptsplit.test.js` (3); mutants
`tools/mutants/scriptsplit.json` (7 dead).
