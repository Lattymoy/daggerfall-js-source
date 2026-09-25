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
