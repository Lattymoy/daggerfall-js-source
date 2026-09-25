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

The frames that freeze when you cross into a new map pixel or ride into a
town. Nothing in `?perf=cpu` showed them: the steady frame is what it
measures, and these are the frames around a crossing - every ~3 minutes
on foot, oftener riding - which is exactly the "fine indoors" the players
describe (an interior streams nothing).

### PERF-EXT-C1 — the grass field's slot count is swept once

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

Pins: `test/grassshift.test.js` C1 (the sweep counter: two fields, at most
one sweep; four distinct questions, four sweeps; the world's warm).
Mutants: `tools/mutants/perfextc.json` C1 x4, all dead.

### PERF-EXT-C2 — the grass field survives the floating-origin shift

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

Pins: `test/grassshift.test.js` C2 x4 - the crossing (three offsets: east,
a vertical recentre, south) re-specifies nothing, uploads nothing and
draws every slot moved by the offset; a crossed field grows the same
world, cell for cell and tint for tint, as one that never moved;
invalidate after a shift drops exactly the cells whose squares meet the
scene rect; and the host's four sites. Three source pins changed on
purpose: `labGrass.test.js` AUDIT 49 F2 / GR2 / GR5 (the shift reaches the
field; the teleport empties it), `audit_wod_branch.test.js` m2 and
`wod2_loader.test.js` (every publish re-reads the grass, which covers a
lost site). Mutants: `perfextc.json` C2; `grass2.json`, `grass6.json`
and `grasspath.json` re-aimed by content (the tint's fx/fz, the grid's
origin in nearSq).

### PERF-EXT-C3 — a walk places its grass rim a slice a frame

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

Pins: `test/grassshift.test.js` C3 x3 - the slice/whole byte identity at
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
Mutants: `perfextc.json` C3 x15, all dead.
