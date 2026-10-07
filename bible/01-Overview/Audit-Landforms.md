# AUDIT LANDFORMS - the landforms, audited before the merge, 2026-10-07

Mac: *"Dont worry about it. Instead let's do just an audit and ensure this is perfect"*, of LANDFORM1-3 (#655,
`03-World/Landforms.md`): the heightmap raised, the roads cut in, the rivers in channels, online too. Five lenses:

- **the law and the math, on the real data** - this session's own reading of `world/landforms.js` and the kernel,
  every claim re-measured on the freeware WOODS.WLD (`tools/fetch-data.sh`) and the vendored Basic Roads network;
- **every reader of the ground** (lane A), **the saves and the re-stand** (lane B), **online, the switch and the
  pipeline** (lane C), **the tests' honesty and the record** (lane D) - four independent adversarial reviewers, each
  reading a snapshot of the pushed head (`5ff49b36`, a detached worktree) so the fixes never moved under a verdict
  (Home.md, 17l).

Every finding was reproduced before it was fixed and is pinned by a test that fails on the code as it stood
(`test/auditlandforms.test.js`); the pins the fixes moved carry a `PIN MOVED` note. Mutation-proven:
`tools/mutants/auditlandforms.json`, and every older record the fixes moved re-aimed and killed again. Each fix carries
an `AUDIT LANDFORMS` comment.

## The law and the math, on the real data

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E2 | Major | **The painted water climbed out of its channel at every crossing.** A road's or a track's cut ran its whole reach - floor, bank and verge, up to 62 m from its centre line - and lerped after the rivers (paint order), so it refilled the channel it crossed or ran beside. The painter still paints the river's water up to the road's own tiles, so the water there lay on the road's fill: on the real WOODS.WLD 55,096 wet corners stood half a metre or more over their channel's floor, 23,692 of them 2 m or more, the worst 19 m, beside 629 river and stream pixels. | **A channel is the water's** (`landforms.js`, the shaper's lerp): where a sample lies in a river's or a stream's channel - 1 on its floor, falling to 0 up its bank - a road or a track stands there on its own bed alone, the causeway's top, and its bank and verge give way by as much. After: 11,191 corners over half a metre, the worst 7.9 m, every one a corner a water tile shares with the road's own bed (the one row of water against a causeway, which a heightfield cannot hold level); away from water the road's bank and verge are whole, as before. |
| E1 | Minor | **A road on a hillside stood on a level shelf 32 m wide.** The cross-section's top was `max(smoothLand, floor + drop)` for every layer - the river's levee rule. With a road's `drop` of 0 its low side was the floor itself the bank's whole width (2.5 samples), then a fill eased down over the verge: on the real data fills to 11-13 m beside a 13 m road. | **A road's or a track's bank runs to the smooth land on both sides** - cut up into the high side, filled down to the low side over the same width; a river's and a stream's low bank keep the levee. After: a fill's height median 0.3 m, worst 5.9 m (was 0.6 and 12.8 m); across the painted road it is still level to the float (tilt 0.00 m on 300 roads). |

Measured and holding (scratch scripts, nothing kept):
- **The knee** over 6,656,400 coastal samples and **the seams** over 38,700 shared edge samples: 0 violations, 0
  differ, with both fixes in.
- **The painted water of every river and stream pixel** (3,048): every wet corner over the coast fade lies on its
  channel's flat floor - bends, junctions, joins and mouths alike. A tile's corners differ only along a river's own
  course (the steepest, a river down a 47% slope, DFU's ground too).
- **The cost**, on the real network: a path-heavy pixel (20-32 arms in its 3 x 3) 12.7 -> 14.3 ms on the worker
  (+13%); a pixel with one arm near it 11.4 -> 12.0 ms (+5%). (Lane D's own 40 path-heavy pixels: 12.9 -> 13.2 ms.)
- **The far ring** stands a pixel's byte at its centre with no large-heightmap term (EV8's own law): the streamed ground
  at a pixel's centre stands a median 213 m over the ring's vertex there with the row off, 212 m with it on. The lift
  scales that gap, it does not open one (the extremes widen with the relief, 726 -> 1,174 m). Not this slice's; named
  in Landforms.md's residues.

## The review lanes

### Lane A - every reader of the ground

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| A1 | Minor | `landformLiftAt` took a town's lift through its blend only when the town's pixel was built; a load stands its records before their pixels stream in, so a neighbour town's piles, guards and camps took the raw lift at the point (117 m in the air at Old Elyssa's Farm, 90 m under at the Eternal Ascencion of Dibella). The cut residual it named beside ("a cut's few metres") was larger than the page said. | FIXED with lane B's B1 and B2, below. |
| A2 | Open | OW-MOUNTAINS' open step (`travelRoute.js` openStepBlocked) judges steepness on raw bytes; with the row on, 251 of the 839,697 steps it admits outside the Mountain climate rise over 160 m on the lifted ground (the worst 390 m, about 25 degrees). No failure traced: the slope limit is 70 degrees. | NAMED (Landforms.md, RESIDUES) - whether it reads `reliefByteHeight` with the row on is Mac's call. |
| N1 | Nit | Come Sail Away's `Terrain.SampleHeight` still caps the ground at DFU's 1,923.75 m (`unityHeightmapStep`); 0.85% of land samples stand over it, where no boat goes. | NAMED. |
| N2 | Nit | The knee law holds for the kernel's samples, not after a location's blend: the page's "every tile class ... where they stood" was true before the blend only. | FIXED in code with lane D's D3: the tiles are DFU's own blend's now, so the sentence is true after it too. |

Held, among the rest: every reader of the built ground (the collider, `heightAt`, grass, nature and forests, World of
Daggerfall's flatten and objects, towns, camps, quays, Deep Waters, arrivals), the shaped kernel away from the grid
(the gate's beacon, the ring), every water-or-coast reader under the knee, and the room forcing every input of the
ground online.

### Lane B - the saves and the re-stand

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| B1 | Major | **The re-stand took the wild lift on a pixel not built yet.** A location's ground is levelled to its pixel's mean, so a record stood there before its pixel streamed in - a load's camps anywhere in the world (a camp is never stood again), a dungeon save's camps after the online underground wake, a neighbour's piles and guards - was off by the town's blend: 1,036 of 15,251 locations over a metre at the rect's centre, the worst 203 m (Tamarilyn Coven), the Dunynak Excavation's clearing 77 m. | FIXED (`world.js` landformLiftAt): a pixel not built yet takes the rect its build will stamp - the location's own (`setLocationTiles`, kept per pixel while the same place stands there), asked of what the build will stand (`_liftLocationAt`: the index, or online the spawn its roll stands, never one past its time - `_locationToBuild`'s answer asked side-effect free, bound where the Overworld's probe stands). |
| B2 | Minor | The lift field is the relief's alone; across a change of the row a record by a path took the cut's difference with it - the page said "a cut's few metres", and "a body that ends under its ground the collider lifts", but most land ABOVE: re-measured with E1 in, median 0.5 m over, 99th percentile 3.1 m, the worst 29.8 m over a hillside road's cut (a fall billing over 120 HP) and 28.6 m under. | FIXED (`landforms.js` landformLiftField): with the world's landforms the field is the kernel's own shaped samples less DFU's - asked a sample at a time in the wild, in one pass through a town's blend (the kernel's `classic` output, D3) - made again once the network lands. After: worst 1.6 m over, 2.0 m under in the wild (the mod's SmoothRoads), 99th percentile 0.07 m; within 0.9 m at every sample of 997 path-crossed towns. |
| B3 | Nit | `then` was taken at today's scale for a landforms record of another scale. | MOOT: C1 left no `then` - every record is DFU's frame. |
| B4 | Minor | = C1. | FIXED with C1. |

### Lane C - online, the switch and the pipeline

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| C1 | Major | **A save from this build, loaded by a build without the row, dropped the character from the sky.** The stamp (`landforms: true`) was additive, as the terrain scale's was - but TERRAIN-SCALE1's older ground stood a body under its feet, which the collider lifts, and the landforms' stands it in the air: a lift over 25 m (a fall billing over 100 HP) at 30.1% of the land's pixel centres, over 100 m at 19.7%, 184 m at the 90th percentile of the location pixels. Who reaches it: a realm character saved on the site and loaded on a macOS or portable desktop copy (they never update themselves), an old tab, any revert. | FIXED (Option A): every exterior height a record carries is written in DFU's frame - the lift at its own spot taken off as it is written (`groundFrameHeight`, `groundFrameNative`, `campToRecord`: the save's player, piles, torches, camps, foes, guards and inside pools, the scene cache, the deck, the anchor, a dungeon save's outer camps) and put back on as it is read - and the stamp is gone before it shipped (`save.js`, `sceneCache.js`, `teleportAnchor.js`, `worldModes.js`, `dungeonContext.js` back to main's). SAVE_VERSION stays 1: any build reads any save as it always read one. |
| C2 | Minor | Two builds in one room stand on two grounds and nothing keeps them apart: `worldRoom` carries no ground tag, the relay reads no client build, a deploy reloads no tab. Peers are drawn at the sender's height, so in a town they part by the town's lift (90th percentile 184 m at location pixels). The page's residue said the room's heights "change ground together, at the deploy" - not so. | NAMED, the sentence corrected (Landforms.md, RESIDUES). No earlier ground slice kept builds apart either; real separation is a relay change - a ground law in the world hello or a tag in `worldRoom` - and Mac's call. |
| C3 | Minor | Online one failed fetch of Basic Roads' arrays stood that client on the port's generated network - other roads, no rivers: with the row a river pixel's ground a median 4.8 m off its peers'. | FIXED (`roadsProducer.js` retryModRoads, `world.js`): online the arrays are asked again, WOD6's backoff (5 s, doubling to a minute, twelve more tries), the pixels roadless meanwhile and rebuilt when they land (ROADS 25); the port's own network only once every try has failed. Offline, as before. |
| C4 | Nit | The ground's online note (`enhancedMenu.js` ONLINE_GROUND_NOTE) locks the rivers' row but never names rivers; `landformsHere`'s doc named a reader that did not read it. | FIXED: the note names the rivers; the doc names its two readers (the gate's beacon, and since B2 a record's frame). |

### Lane D - the tests' honesty and the record

Lane D ran 69 new mutants against the snapshot's pins: 30 died, 39 survived. Every one is in
`tools/mutants/auditlandforms.json` now, re-aimed to the code as it stands (the stamp's are gone with C1) and killed.

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| D1 | Major | `landformLiftAt` had no pin at all - both harnesses stubbed it; six mutants (the pixel's sign, the frame, the axes, the units, the rect, the memo key) survived, each re-standing every record by up to the whole lift. | PINNED: sliced and run over a real `StreamingWorldState`, recentred, against `landformLift` - unbuilt and built, a town and the wild, a spawn, the network landing. |
| D2 | Major | The stamp's writes and reads and the re-stand's fast paths were pinned by regexes on the call text alone. | The stamp is gone (C1); the fast paths (the quickload's `today`, the camps left outside, the deck) are run with the row on and off. |
| D3 | Minor | **The knee did not hold through a location's blend**: the blend pulls a pixel toward its mean and the landforms move the mean, so 359 tiles in 97 of the 314 coastal location pixels turned between sand and land (lane D measured 309 in 92 before E1 and E2). | FIXED (`terrainSampler.js`, `terrainGen.js`): a location's tiles are classified on DFU's own samples through DFU's own blend, written in the same kernel pass (`classic`); 0 differ, and a tile parts from the shaped ground by at most 2.2 m. |
| D4 | Minor | The verge was unpinned: the kernel's `ground` argument and `smoothLand` survived mutation. | PINNED (the noise eased back over the verge; the written-out law, D8). |
| D5 | Minor | Test 5 claimed "the pixel edge too" over rows 4..124. | PINNED: rows 0..128 (PIN MOVED). |
| D6 | Minor | The fixture's mountain is a plateau; the ring's normals' lift survived; test 2's "1.9 x" was asserted as "> 1.5 x". | PINNED: the ring's normals on a flank; 1.9 x exactly. |
| D7 | Minor | `landformLift` was checked at whole samples only, to a tolerance fifty times the agreement. | PINNED: between samples and on the far edges, 0.01. |
| D8 | Minor | The fixture had no bend, junction or road end: the arm-weighting law, the verge's ease and the bank's survived. | PINNED: a bend, a junction, their ends and a diagonal-into-straight track on the mountain's flank (`test/landformWorld.mjs`), and THE LAW WRITTEN OUT - a second statement of the shaper from the network's bytes and the kernel's two terms - equal to it within 1e-9 at every sample of 24 pixels; the dials pinned as the page's table. |
| D9 | Minor | The gate kernel's network key, the worker's wait and the diagonal's linear grade were unpinned. | PINNED: each run. |
| D10 | Minor | The page said it was never measured on the real WOODS.WLD beside a section that was. | FIXED (Landforms.md, RESIDUES). |
| D11 | Minor | Online-Arc.md's mutant count was stale. | FIXED. |
| D12 | Nit | The recorded equivalent `LANDFORM-knee-is-the-ocean` is equivalent only over the kernel's inputs; the law is said for every input. | PINNED to the shaper itself; no longer equivalent. |
| D13 | Nits | "its bytes stop at 110" (109, at (963, 442)); "every record that carries a terrainScale now carries landforms"; the Testing.md modsonline row's "the only two switches". | FIXED. |

## Pins

`test/auditlandforms.test.js` - E1, E2; C1 (every writer named, the scene cache written and read with the row on and
off, the quickload's and the outer camps' reads); B1 (landformLiftAt run, unbuilt and built, the binding); B2 (the field
is the pipeline's own ground less DFU's, in the wild and through a town's blend; the network landing); D3 (a sea cliff's
town, every tile DFU's; the classic output bit for bit); C3 (the backoff, and the host's landing run online and off);
C4; D4-D9, D12 and the written-out law over the new bend and junction. PIN MOVED: `test/landform.test.js`'s road bank
(E1), the re-stand and stamp tests (C1: a record is DFU's frame both ways, no stamp anywhere), the host's wiring (C1,
D3), test 5's rows (D5), test 8's tolerance (D7), test 2's 1.9 x (D6); `test/terrainscale1.test.js`,
`test/a10_world_misc.test.js`, `test/enterexit.test.js`, `test/audit68_worldjs.test.js` and `test/auditrest3.test.js`
back to the re-stand's own lines.

`tools/mutants/auditlandforms.json` - 99 mutants, 92 dead, 7 equivalent as recorded (each with its why).
`tools/mutants/landform.json` - 36, all dead: four stamp records retired with the stamp (C1), the knee no longer
equivalent (D12). Re-aimed and killed again: `terrainscale1.json` (six records back to main's lines or the new ones),
`auditrest2_camps.json`, `auditrest3.json`, `wod2.json`.

## For Mac

- C2: whether two builds in one room should be kept apart - a relay change (a ground law in the world hello, or a tag
  in `worldRoom`); no ground slice has done it before.
- A2: whether OW-MOUNTAINS' steepness should read the lifted ground with the row on.
- WATER2's lesson: none of this has been seen in the running game - Mac's eye before the merge.
