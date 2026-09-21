# PERF-RIG1 — the Morrowind rig's geometry pipeline ran on the CPU per body per frame, and minted while it did

*2026-09-21. Mac: "Next I wanna continue looking into fixing exterior
performance issues."*

## Where PERF-TOWN1 left off

`world` was the other spiky CPU zone (2.25 → 8.51 ms) and was untouched.
Reading what that zone actually covered came first, because the zone's
name says nothing: the renderer marks `'world'` inside `beginFrame` once
its passes are submitted, and the sky marks `'world'` again when it
hands the frame back, so the zone was THREE spans of the host's own
frame - the Morrowind bodies (the player's, every peer's, the wagon,
the camps), the far ring and the water, and everything after the grass
up to the HUD's first screen quad: the arrows, the magic, the weapon
rig's frame and draw, the HUD's preparation.

## What was in it

The Morrowind rig's whole geometry pipeline, on the CPU, once per body
per frame:

1. `poseAssembly` (formats/mwFirstPerson.js) poses the skeleton, then
   **skins every vertex** of every skinned piece (`mwSkin.skinBatch`) and
   places every rigid piece, then walks every vertex again for bounds.
2. `packFpArm` (combat/fpArm.js) **de-indexes every triangle** into the
   character vertex stream - fourteen floats a corner - with a cross
   product per face.
3. `updateCharacterMesh` uploads the stream and walks it a third time
   for bounds.

That runs for the first-person arm every frame, for the third-person
body when you are in it, and for **every peer's body in view**
(net/peerBodies.js draws each through the same `drawThird`). So the
zone scales with the number of players standing near you, which is
exactly the shape of a swing nobody could pin to one place.

## The count

Measured in node on the fixture rig inflated to 3,006 vertices (the
order of one body), one pose + pack cost ~0.35 ms and, per call:

| where | what it minted | size |
|---|---|---|
| `skinBatch` | `acc` (12 floats a vertex), `wsum`, `touched`, two 12-float scratches, one 9-float affine **per bone** | **~156 KB per piece per call** |
| `packFpArm` | `[a, b, c]` to pick a corner, an `[r, g, b]` from `diffuseAt`, another from `emissiveAt` - **three arrays per corner** | ~10,000 arrays per body per frame |
| `packFpArm` | a fresh `ranges` array with one object per piece | per frame, and thrown away - the mesh keeps the first frame's |

Two things about that first row. The heap meter never showed it:
typed-array backing stores are off-heap, so `heapUsed` moved by a few
KB while the collector was fed 150 KB a piece. And it is the same shape
PERF-TOWN1 found in the town loop, at a much larger scale - the same
value, written into a new seat every frame.

## What changed

Nothing about what is computed. Every float written is bit-for-bit the
one the old code wrote, and the pins say so against the old code
transcribed as the reference.

- **The skin loop's accumulators are the batch's** (`skinScratch`): made
  once per piece, sized to it, zeroed per call with `fill(0)`. The
  per-bone product is written into a scratch affine (`affineMulInto`,
  the same products in the same order into a `Float32Array`, so every
  rounding is the one it was).
- **The pack keeps each piece's static lanes.** Of the fourteen floats a
  corner, eight never change between frames - the diffuse, the UV and
  the emission are the authored vertex's - and only the position and
  the face normal follow the pose. The eight are resolved ONCE per piece
  through the same `diffuseAt`/`emissiveAt` (one home for the colour
  law) into a lane buffer on the piece, keyed on the arrays they were
  read from, so a wardrobe rebuild that hands the piece new colours
  rebuilds them. The frame copies them beside the six it computes and
  constructs nothing.
- **The ranges keep their identity.** When the pieces are the ones
  `out` was packed from, the same range objects come back untouched -
  they carry the textures the mesh hung on them.

After, on the same 3,006-vertex rig: one POSE call - both skinned pieces
and the skeleton - mints 0.8 KB in 24 small arrays (the `post` affines,
a handful of 9-float arrays per piece per frame, which follow the pose
and cannot be cached, and the skeleton's own per-node affines), the
pack mints nothing and runs a third faster (123 → 84 µs), the pose+pack
pair 355 → 303 µs. The scratch is RETAINED: a body keeps ~52 bytes a
vertex of accumulator for the life of its rig - a few hundred KB for
a clothed body - which is the trade.

## PERF-ZONE2 - the zone named

Five `markCpu` spans now tile what `'world'` swallowed: `bodies` (after
`beginFrame`), `ring` (after the sky hands back), `arrows`, `rig` (the
magic, the weapon rig's frame and draw - the arm's pose, pack and
upload live here), `hud`. The renderer's own `'world'` is what is left,
which is next to nothing: its two marks are each followed by one of
these within a line, so a `world` that still reads high is the meter
lying, not the frame.
The next `?perf=cpu` line from the field says which of the three spans
it was.

## What is pinned, and what deliberately is not

`test/perfrig1.test.js` (7): the skin loop bit-identical to the old
loop at several poses and across repeated calls; the accumulators the
batch's, zeroed, and the second call constructing nothing sized to the
mesh (a typed-array constructor count, which is how the 156 KB was
found); the pack bit-identical to the old pack on the posed fixture
arm with its mirrored piece, and again after a re-pose; the warm pack
constructing no typed array, the lanes following a piece's colours,
the ranges keeping identity across frames and following a swapped
piece; a derived minting law by content (the skin loop allocates only
through its scratch, the pack loop constructs nothing and the colour
laws are called in exactly one place in the file); and the world
frame's CPU zones in order with each new mark on its subject. No
timing assertion - the PERF-TOWN1/STREAM1 law. Campaign
`tools/mutants/perfrig1.json`: 17 mutants, 17 killed.

## Still open, and worth saying plainly

- **The pipeline is still on the CPU.** ~0.3 ms per body per frame in
  node at 3,000 vertices is the arithmetic, not the garbage; a retail
  body with clothing may be more, and it is paid per body. The real
  answer is GPU skinning (bone matrices as uniforms, the blend in the
  vertex shader, the static stream uploaded once) - a slice of its own,
  and one whose fixtures and bit-identity pins now exist.
- **The skeleton pose mints per node**: `poseSkeleton` builds a Map with
  an object per node and `skeletonSpaceMatrices` an affine per node,
  per body per frame. Seven nodes on the fixture; a retail skeleton has
  tens. Secondary to the above, and a scratch of the same shape.
- **`meshBounds` and `boundsOf` walk the vertices twice more** per
  frame; the pack loop reads every position anyway and could answer
  bounds for free.
- The `shadow` CPU zone reading 0.00 with ~1,700 GPU draws in the same
  frame (PERF-TOWN1's second open item) is still unexplained and needs a
  field readout with both clocks.
- NOT SEEN ON A GPU. The numbers above are node's on the fixture rig; the
  swing they explain is Mac's `?perf=cpu` line.

## AUDIT PERF-RIG1 (same day, Mac: "Lets audit this")

Four lenses over the slice - does it reach a player, what did it break,
do the pins derive, does the record say true things.

- **Reaches the player.** `poseAssembly` calls `fns.skinBatch`, and
  `fns.skinBatch` is the mwSkin export itself (mwFirstPerson.js's
  module table), so the scratch path is the frame path. A piece keeps
  its `batch` for the life of the assembly (MW-D7), so the scratch
  persists; the peers' rigs are separate `createFpArm`s with their own
  batches, and even a shared batch would be safe - the scratch is
  zeroed at the top of every call and no call is re-entered.
- **F1 (record).** "0.8 KB per skin call" was per POSE call (both
  pieces and the skeleton); and the renderer's residual `world` zone
  is next to nothing now, not "what is left". Both corrected above,
  and the scratch's retained memory is written down as the trade.
- **F2 (fixed).** The range-identity law had a second half nobody had
  written: `releaseGpu` deleted the textures hung on the ranges and
  LEFT THE HANDLES on the objects. Every release site today drops its
  pack beside the mesh (3157/3160, 3218-3220, 3444-3448, 3623, 3713-14),
  so no stale handle was ever handed back - but a future release that
  kept its pack would have put a deleted `WebGLTexture` into the next
  mesh through the very reuse this slice introduced. The release
  clears the handle with the texture, pinned by content with a sweep
  that every `releaseMesh()` call drops its pack. One more mutant.
- **Lane inputs are never mutated in place.** Every write to `colors`,
  `emissive`, `diffuse`, `vertexColorMode` and `uvs` in `src/` is at
  parse or resolve time (mwNifFile.js, mwNifMesh.js) - nothing recolours
  a built piece under the cache, so identity is the right key. No
  batch is frozen (`Object.freeze` in the four MW format modules is on
  constant tables only), so the scratch assignment cannot throw.
- **The pins.** The bit-identity references are the old code, and the
  `Float64Array` mutant proves they see a rounding, not just a value.
  One tautology tightened (a range's piece test that could not fail).
  The zone-order pin enumerates, on purpose: the zones TILE, and their
  order is the law.
- **F3 (the campaign itself).** The first campaign reported 17/17 dead
  while `perfrig1.test.js` was RED for an unrelated reason (the `hud`
  span pin, since fixed) - a failing file kills every mutant that lists
  it, which is the vacuous-pin shape in a mutation run. Re-run green,
  THREE survived: the transposed bone product agreed with the old loop
  on the fixture (its inverse binds carry no rotation, and a product
  with an identity commutes); the double-width scratch agreed too (the
  fixture's values are exactly representable, so no rounding to see);
  and the `bodies` mark moved two lines down still sat within the pin's
  window. The pins now hold a batch FOUND BY SEARCH against the
  double-width mutant - general 3x3s, four vertices, two overlapping
  bones, which a hand-picked near-orthonormal case did not catch - and
  the `bodies` mark is pinned as the line after `beginFrame`. A
  campaign is only evidence when the file it runs is green first.
- Campaign after the audit: 18 mutants, 18 killed, on a green file.


## PERF-READ1 - the `hud` span was the vsync wait (2026-09-21)

Mac pasted a `?perf=cpu` readout from the road: `cpu 17.15ms | hud 7.09 |
people 4.11 | sim 2.08 | ...`, `cpu 18.55ms | hud 10.78 | ...`, `cpu
13.53 | hud 7.76`, `cpu 11.85 | hud 5.26`, `cpu 12.56 | hud 6.23`. The
HUD at 40 to 58 percent of the frame. It was not the HUD.

**A CPU span closes at the next mark, and the next mark after the
frame's last one was the NEXT frame's first.** `markCpu('hud')` is the
world host's last mark; the enhanced skin draws its HUD in the DOM and
no screen quad, so nothing in the frame resolved the image or marked
`air`; the span ran through the travel panel, the talk layer,
`frameEnd`, `requestAnimationFrame`'s wait - vsync, the compositor, the
GPU if it was behind - and the next frame's head up to `markCpu
('online')`. Which is why the totals summed, line after line, to a
number near 60 Hz's 16.7 ms: the total was the frame PERIOD, and `hud`
was the idle. The same deferral explained the readout's `draws 0`: the
owed resolve ran in the next frame's `_beginLane` AFTER that line had
reset `stats.draws` and begun a new GPU clock, so the line the resolve
printed - the previous frame's - read zero on every enhanced-skin
frame, and 1372 on the one frame that happened to draw a quad.

Three lines. `PerfMeter.stopCpu()` closes the open span and opens
nothing; the world host calls it where its script frame ends, so the
wait belongs to no span and `cpu` is the script's again (the FPS
counter carries frame time beside it; the difference is the headroom).
The owed resolve runs before the new frame's reset, so its line carries
its own draws. And a `ui` span opens after the HUD's draw, so `hud` is
the HUD's preparation and draw and `ui` is the travel panel and the
rest. Pinned on the meter with a fake clock: a frame of `sim 2, hud 1`,
a stop, nine milliseconds of wait, the next frame's mark - `hud` is 1,
not 10 - and the old law shown giving 10. 4 mutants, 4 dead.

**What Mac's readout actually said, re-read.** Script work on the road
was 5 to 8 ms a frame: `people` 0.3 to 4.1 (the one span that moved
between lines - the town's pools), `sim` 1.4 to 2.3, `flats` 1 to 1.7,
`batches` 0.8, `rig` 0.6, `ring` 0.5, `grass` 0.1 to 0.4, `world` under
0.1. The frame was at or near 60 Hz with 8 to 11 ms of headroom in each
line, and the GPU still cannot be timed in that browser (`gpu n/a`). The
next paste will say whether `hud` is a fraction of a millisecond, which
is what the code says it should be, and `ui` beside it.

**The lesson: a span that ends at "the next mark" ends wherever the next
mark happens to be, and the last span of a frame has no next mark of
its own. Close it by hand or it measures the wait.**

## GROUND-LAST - the ground is drawn after the meshes (2026-09-21)

Mac: *"I want proper fucking fixes."* This is one. Every lens of GRAIN
AUDIT 1 pointed at it and it was left on the record for his word.

**The ground was the first draw of every pixel.** So every ground
fragment under every building, tree, wall and mill was shaded in full -
the tile fetch and its filter, the cloud shadow, the sun, the lane's
lights and terms - and then painted over by the mesh that stood on it.
The ground covers more of an outdoor screen than any other pass, and in
a town a large share of it is under something. There is no depth
prepass in this renderer and none is added: drawing the opaque meshes
FIRST puts them in the depth buffer, and a ground fragment behind one
then fails the depth test before its shader runs - early-Z, which every
GPU made this century does for free.

**The streaming world** queues each visible pixel's ground during the
pixel walk, draws the pixel's static batch and models where the ground
used to be drawn, and drains the queue once the walk is done - so a
pixel's ground also lies under the NEXT pixel's buildings, and the
terrain program binds once a frame instead of twice a pixel. The sky,
the ring, the water and the flats keep their places after it: the water
reads the ground's depth and the flats are cut-outs blended over it.
**The town host** draws its ground after the buildings, the mills, the
rig and the arrows, just before the sky. Nothing else moved.

Not measured on a GPU - none here can be - and stated as such: the
saving is the shaded fraction of the ground that is under a mesh, times
what a ground fragment costs, on a machine where the GPU is the wait.
In a town that fraction is large; on an open road it is small. On a
CPU-bound frame it is nothing, and it costs nothing there either. 3
mutants, 3 dead; the perf2 order pin holds both hosts' new order.

**NEAR-FIRST (same day): and the pixels are walked nearest first.** The
streaming world's pixel map is in the order the pixels streamed in,
which has nothing to do with where the eye is, so a far town's walls
went down before the near street's that hid them. The walk sorts a
scratch array by grid distance from the player's own pixel - a
hundred-odd integers, no allocation - and the meshes, and then the
queued ground, go down near to far. Same law as above, finished: the
nearest thing enters the depth buffer first and everything behind it
is rejected before its shader runs. 2 mutants, 2 dead.
