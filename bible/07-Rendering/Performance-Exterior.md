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
spread or JSON on a batch). No value any code computes changes, so the
picture cannot. `contract.js` declares the 23 (HARD3 holds the mint and
the typedef to one list).

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
night. Memory: 23 more slots on ~3,300 batches, about 300 KB; the heap
delta a frame did not grow (44-51 -> 34-36 KB with `ALLOC=1`).

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
splits the shape again without any test noticing. Mutants
`tools/mutants/perfextb.json` 1-9.

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
