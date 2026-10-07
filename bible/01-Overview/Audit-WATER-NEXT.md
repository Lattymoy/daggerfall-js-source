# AUDIT WATER-NEXT - the new water audited, its cost measured, 2026-10-07

Mac, of WATER-NEXT 2-4 and PUDDLE-DRY (`07-Rendering/Water-Arc.md`, PR #674): *"I want you to do a comprehensive audit
ensuring this is perfection and performance is unaffected"*. Three lenses read the branch, after main had been merged into
it (`18c80367a`). Each worked independently and verified its own findings with a node probe, the repository's GLSL
evaluator (`test/glsl.mjs`) or the code itself before reporting:

- **the GL** (G): state, units, the copy, the shader's composition;
- **the hosts** (F, H): the four hosts, the world's lifecycle, Deep Waters and Come Sail Away;
- **the record** (M, m): the page, the Ledger, the Testing rows, the pins, and the mutants.

A **performance lens** (P) measured the branch against main, on this thread and on the GPU. The GPU numbers come from
SwiftShader, so they are relative only.

Where two lenses found the same fault, the ids are joined (H1 = F1 = G4). Each fix carries an `AUDIT WATER-NEXT <id>`
comment and is pinned in `test/audit_waternext.test.js` (11), or in the moved pin it says. It is mutated in
`tools/mutants/audit_waternext.json`: **40 mutants, 40 dead**. The branch's own campaigns are also all dead after the
fixes: `waternext.json` (35, seven re-aimed at the code the fixes rewrote) and `puddledry.json` (12). So are the records
in other campaigns that the fixes moved: `landform.json` (36, two re-aimed), `lwdry.json` (24, one) and `perfextc.json`
(three re-aimed, re-run).

## What it costs

| | main (WATER1) | WATER-NEXT, before | after |
|---|---|---|---|
| A pixel's build or restride, this thread | - | the bed carved here: 0.3 ms with no water, 1-2 ms on a coast | **0** (carved on the terrain worker with the grid) |
| Any outdoor frame, walking, water or none | - | 0.12 ms (the asleep ripple field slid two arrays of zeros) | **0.0003 ms** |
| A harbour in view | - | the field never slept: 30 steps and 30 9 KB uploads a second for every moored boat | asleep unless a hull is under way |
| Per frame | - | a closure, an array a body, an object for the field, a copy of the uniforms and of the sea's colour | none |
| The water's fragment, the screen full of it (SwiftShader, 1280x720) | 200 ms | - | Simple **190 ms** (-5%), Full **222 ms** (+11%: 205 of shading, 19 of the frame's copy) |

So on this thread the new water costs nothing that main did not. On the GPU, Simple is cheaper than main's water. Full
pays for one copy of the frame's colour and depth on every frame with water in sight: the price of seeing into the water.
On a coast frame that draws both the terrain's water and Deep Waters' sea it pays for two copies, because the sea needs
its own (G2). Its shading is within 2-3% of main's. A real GPU was not measured here.

## Fixed

**The performance** (P)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | high | The bed was carved on the host's thread at every build and restride, re-doing work the terrain worker exists to take: 0.3 ms for a pixel with no water, 1-2 ms for a coast, and five at a crossing. | The kernel's one grid law carves it (`terrainGen.js restrideGrid`, `bed`): the build's, the promotion's and the restride's grid, on the worker, with the buffers transferred. The depth pass is 2-6x faster and bit-identical to the shipped one over 4,800 random maps (pinned against the shipped algorithm, written out in the test). |
| P2 | medium | Asleep, the ripple field still slid both of its arrays every time the eye crossed a cell, on every outdoor frame. | Asleep, a slide moves the origin alone. |
| P3 | medium | Every active boat stirred the field ten times a second, moored or not, so a harbour's field never slept. Each stir allocated a closure and an array, and read `performance.now()`. | A hull stirs only under way (`BOAT_WAKE_SPEED`, 0.25 a second). The hosts' one stir keeps one record a body and reads the frame's clock. |
| P4 | low | `setWaterRipples` wrapped the field in a new object every frame. The sea's draw spread a copy of the frame's uniforms and sliced its colour. | The field is held as itself; the sea's height and colour are passed as they are. |

**The hosts and the world** (H, F)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H1 = F1 = G4 | high | The bed was carved from the pixel's own TileMap, but Deep Waters' cap (on by default) patches it. Every tile the cap REPAINTED with ground was a pit up to four units deep with no water over it, such as a river's mouth on a coast. Every tile it clipped was carved under the mod's floor, which is fitted to the shore at the clip's edge, leaving an open gap between them. | The bed is carved from the TileMap the water draws from (`bedBytesOf`). A clipped tile votes dry, so the bed meets the floor at its edge, and a repainted tile is ground. `dwRecarve` carves again from the grid as it stood (`_bed.sheet`, `_bed.normals`) when the cap lands or lifts. A promotion whose cap moved while it was away is carved by the cap that stands. |
| F2 = G5 | high | A vertex on a seam was carved alone by each pixel: a tile past the edge had no vote and a bank past it was unseen. A near grid has no skirt, so the two depths, 4 and 1 or 0, were an open crack in the ground under clear water. | A near grid's bed reads `BED_HALO_TILES` (4) of each neighbour's tiles past its edge. They are classified and marched by the neighbour's own law (`terrainTiles.js tileDataAt`, `marchTile`, both lifted out of the job verbatim) from the kernel's ghost samples, so both pixels carve a seam vertex alike. Pinned on two synthetic pixels with lakes across the seam: 0 mismatch with the halo, 2.96 units without it. |
| H2 | medium | The sheet took the carve's depths, so in a pixel with a carved pond anywhere, a one-tile stream had depth 0: a clear film edged in foam where the same stream elsewhere is tinted water. Water on uncarved ground heaved by half the swell over a lift of 0.08, so its troughs went under the ground in any fair wind. | The sheet has its own depths (`sheetDepthsOf`): the carve's where it reaches, 0 at a bank, and `SHEET_NO_BED` (`-NO_BED_DEPTH`) over ground never carved, which the vertex shader reads as tint with no swell. A sheet with no bed at all takes the same constant. |
| F3 | low | The restride kept the whole bed, including the carved copies already on the GPU (about 400 KB a near pixel), where the build kept the grid and the depths. | One shape on both (`hostBed`): the grid as it stood, its normals for a re-carve, the depths, the sheet's depths, the halo. |
| F4 | low | The swimmer's stir read `player.swimming`, which outdoors is Deep Waters' forge's alone, so a swimmer in a moat stirred like a wader. | `player.isPlayerSwimming \|\| player.swimming`, in both hosts. |
| m12 = F9 | medium | THE FOUR HOSTS: the ripple field was wired in the streaming world alone. The fixed town's moats drew no ring round a wading player, and the stir was one host's closure. | The hosts' one stir (`waterRipples.js createRippleStir`) runs in the streaming world and the fixed town. The interiors (`worldModes.js`) and the dungeons (`dungeonContext.js`) draw no enhanced water: their pools are the classic plane (`drawWater`), which reads no field. |
| m8 | low | PUDDLE-DRY carried its own 56, the fifth copy of MeshReader.cs:487's marker limit. | `terrainTiles.js GROUND_RECORD_LIMIT`, imported by the stamp, `rmbLayout.js`, the fixed town and `puddleDry.js`. The tie to the first ground in the walk is pinned, and so is the absence of a puddle law in `world.js` and `ui/inkTown.js`. |

**The GL and the shader** (G)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| G1 | high | With the frame's copy (Full, the default), what was seen through the water was fogged twice: the copy was fogged when it was drawn, and the water fogged it again with its own light. Every pond and its shallows read paler and foggier than the bank, worse with distance (Deep Waters' sea fog the same). | The composition is premultiplied. The copy is taken at its share, unfogged. The water's own light, its foam and its glints take the air's fog and the sea's at their share (an affine fog, `x*m + c` at a share `s` is `x*m + c*s`). Measured on the evaluator: Full now matches the bank's own pixel to 0.01. |
| G2 | high | The sea reused the copy the terrain's water took before the flats and the people were drawn. Anything the sea stood in front of was painted over by a copy that held none of it: a wading foe's legs, a corpse in the shallows, a flat in the water. These came and went as a pond entered the view. | The sea takes its own copy (one more blit, on a coast frame that draws both). |
| G3 | high | Without a copy (Simple, the classic lighting lane, `?air=off`), the sheet's alpha was cut before the foam read it, and the glints were added to a colour the blend then scaled down. A sun glint over shallow water was a twentieth of Full's, and the shore's foam was nearly gone, against the row's own word that the foam stands in Simple. | The same premultiplied composition: the glint is 1.56 in both, and the foam whitens the shore alike (0.379 against 0.373). |
| G7 | low | A swimmer at the surface under a heaving open sea saw the wave's underside. The mod's own top discards it. | The water program discards it too, on the open sea (`uOpen`). |
| G8 | low | The shortest train (25.6 units) is one vertex a wave on a far ring's strided grid, so the distant sheet heaved in an aliased lattice. | The heave fades over `SWELL_REACH` (300 to 600 units from the eye); the slope stays the fragment's. |
| G10 | nit | Implicit-level samples (the ripple field, the copy) after the discards, which is undefined in non-uniform flow. | `textureLod(..., 0.0)`: one level each. |
| G11 | low | The air pass's first copy binds its new texture on the active unit behind the renderer's shadows, so a later bind of the texture the shadow still named was skipped and drew black for a frame. GRASS-LIT's AO copy had the same fault. | Both snapshots forget the units' shadows. |
| G12 | nit | The ripple field outlived the boot that made it. A later Simple boot drew the old field's frozen rings. | `beginFrame` clears it; the hosts hand theirs over every frame. |
| G13 = F5 | low | A slide moved the field's origin at once, but its bytes changed only at the next 30 Hz step, so rings jumped half a unit on step-less frames. | The texture is placed where its bytes were packed (`packed`). |
| G14 | nit | A mid-frame resolve left the frame's copy cached for the canvas's draws. | The resolve drops it. |
| G15 | nit | `_waterFrameBlock`'s doc said it binds the program (it does not), and the lab never set `renderer.waterBed`, so its carved bed wore the water tile. | The doc is corrected and the lab sets it. |

**The record** (M, m)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| M1 | high | The ripple field never slept again once the eye moved while rings were live. A slide carried heights onto the edge rows, which a step never writes. They stood there, its energy never fell, and the texture went up 30 times a second for the rest of the session. The record said "asleep when still" and "the edge stays still". | A slide writes the inside only, so the edge stays still water and the field sleeps (pinned: asleep within the steps a damped ring takes, all bytes 128). |
| M2, M3 | medium | Of 37 one-line mutants aimed at laws the record claims, 35 survived the branch's pins: the host's stir loop, the shader's ripple slope, the sheet's depth upload, the sea's tilemap-unit emptying and more. | `test/audit_waternext.test.js` pins the laws by behaviour where node can run them (the bed, the halo, the stir, the composition on the GLSL evaluator) and by text where only a browser can. Its 40 mutants are all dead. |
| M4 | medium | Port-Ledger's WATER1 row and Water-Arc's "The departure" and "What it does not do" still described WATER1 as the water drawn now. | Narrowed in place: superseded by WATER-NEXT 2-4. |
| m1, m4, m11 | low | The record counted `waternext.test.js` as 7 tests (it is 8), listed `perf2` as moved (WATER-NEXT never touched it) and left out `terrainworker` and `dwe_decorations`. It said "four more texels" where the shader reads seven. | Corrected. |
| m3 | low | "The classic lane draws DFU's flat tile": the switch is the SKIN. The Enhanced skin on the classic lighting lane draws the new water. | "The classic skin". |
| m5 | low | Testing rows still described WATER1's pins (the opacity 0.94, `uOpacity`), and World-Arc's histogram was main's. | Updated. |
| m6 | low | `WATER_OPACITY` was forwarded by the uniforms and pinned as the surface's floor, while nothing drew it. The same went for the sheet's `scroll`. | Both retired. `WATER_SCROLL_TILES_PER_SEC` stays the dungeon water's rate. |
| m7 | low | The record's constants were unpinned, or pinned by inequalities and re-derivations: the swell's trains, the absorption, the foam, the ripple field's rates, the stir. | `deepEqual` against the recorded literals. |
| m9 | low | perfextb's fixture built WATER1's surfaces, a shape no host mints any more. | It mints `createWaterSheet`'s two shapes. |
| m10 | nit | Comments claimed a boat bobs on `swellAt` (no caller), that "a creature's splash" stirs the field (only the player and the boats do), and that "every boat afloat that moves" stirred it (every active boat did). | Corrected. The first two are recorded under "Recorded" below; the third is now true (P3). |
| m13 | nit | The Deep Waters and Come Sail Away Ledger rows still described the top's column share and the breakers as drawn. | Each points at WATER-NEXT. |
| m2, m14 | low | The PR's notes said PUDDLE-DRY dries "700 tiles" (it is 700 patches), and that Simple "drops the see-through look" (it keeps the blended look-through and drops the copy and the ripples). | The PR's description. |
| - | low | At the merge of main, `test/features.test.js` said the Enhanced water note grew by 7 when it grew by 22 (the branch had raised the ceiling 164 and spent 15 from the old slack). | The ceiling is main's 18051 plus the branch's real 179. |

## Recorded

| ID | Finding | Why it stands |
|---|---|---|
| F8 | The dry half of a shore tile is drawn up to half a unit low: its quad slopes into the first wet vertex's 1.04. A flat, a townsman or a foe standing there (seated on DFU's ground, `heightAt`) can stand that much above the drawn ground at the waterline. | The fix that keeps the shore flat holds the first ring of wet vertices at 0. That makes small ponds and moats shallow, and it undoes the shelf the branch tuned on the moat's shots ("a unit deep a tile out"). It is a look to judge on the real game, which needs ARENA2. Mac's call. |
| G9 | The air pass's AO is read off the frame's depth, which under the water is now the carved bowl. Its occlusion reaches the water's surface over it. | The water writes no depth (the flats drawn after it must stand over it). Taking the surface into the AO is a draw-order change. |
| G6 | The retro look caps the tile arrays at one level, so the water's body colour is the water tile's centre texel, not its average. | A per-archive average uniform. Small, and only under retro. |
| F2's rest | A neighbour's stamped or painted tiles (a town's blocks, a road, a river) are not in its kernel, so a seam beside them may still part. | Seen only where such tiles reach within four tiles of a seam beside water. A strided ring's skirt closes its own seams. |
| m15 | PUDDLE-DRY dries any patch made only of shallow-water art, records 8, 9, 23 and 33-36. 33-36 are what the code calls "the town docks, moats", and the census pins one moat whole but not the docks. | Whether any dock's water is dried needs a census by record with ARENA2. That is not in this container. |
| - | The swell's height is the wind's for every water alike, so a castle's moat heaves as the sea does in a gale. The decision record says "the waves modest and the weather's (calm lakes and rivers, a sea's swell that grows in a storm)". | Whether that means calm in calm weather or calmer than the sea is Mac's to read. |
| - | Full's copy of the frame is its cost (above): one blit on a frame with water, two on a coast frame with Deep Waters' sea. | It is what the look through the water is. Simple is the setting for a weak GPU. |
| m10 | `swellAt` (the swell for the CPU) has no caller: no hull bobs on the swell, so a moored boat's waterline rides up and down its side. | A hull's bob is Come Sail Away's transform's. |
| F11 | Come Sail Away's Waves rows still describe the breakers (the mod's own words), and its wave mesh is still built. | The mod's settings are verbatim. The mesh drives its current, which still runs. |
| F13 | With the water on, the fixed town's ground is a grid of its tiles (32K triangles for an 8x8 town, and a shadow caster) where DFU lays one quad. | It is what carves its moats. The bench host's cost is negligible. |
| G15's rest | The absorption multiplies the lane's encoded colour, which darkens more than a linear multiply would. | Tuning, judged on the real game's shots. |
