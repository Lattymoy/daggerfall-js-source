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
