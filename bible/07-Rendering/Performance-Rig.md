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

After, on the same 3,006-vertex rig: the skin call mints 0.8 KB (the
`post` affines - a handful of 9-float arrays per PIECE per frame, which
follow the pose and cannot be cached), the pack mints nothing and runs
a third faster (123 → 84 µs), the pose+pack pair 355 → 303 µs.

## PERF-ZONE2 - the zone named

Five `markCpu` spans now tile what `'world'` swallowed: `bodies` (after
`beginFrame`), `ring` (after the sky hands back), `arrows`, `rig` (the
magic, the weapon rig's frame and draw - the arm's pose, pack and
upload live here), `hud`. The renderer's own `'world'` is what is left.
The next `?perf=cpu` line from the field says which of the three spans
it was.

## What is pinned, and what deliberately is not

`test/perfrig1.test.js` (6): the skin loop bit-identical to the old
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
