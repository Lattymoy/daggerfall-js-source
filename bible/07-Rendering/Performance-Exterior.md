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
