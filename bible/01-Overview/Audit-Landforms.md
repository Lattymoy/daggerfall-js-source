# AUDIT LANDFORMS - the landforms, audited before the merge, 2026-10-07

Mac: *"Dont worry about it. Instead let's do just an audit and ensure this is perfect"*, of LANDFORM1-3 (#655,
`03-World/Landforms.md`): the heightmap raised, the roads cut in, the rivers in channels, online too. Five lenses:

- **the law and the math, on the real data** - this session's own reading of `world/landforms.js` and the kernel,
  every claim re-measured on the freeware WOODS.WLD (`tools/fetch-data.sh`) and the vendored Basic Roads network;
- **every reader of the ground** (lane A), **the saves and the re-stand** (lane B), **online, the switch and the
  pipeline** (lane C), **the tests' honesty and the record** (lane D) - four independent adversarial reviewers, each
  reading a snapshot of the pushed head (`5ff49b36`, a detached worktree) so the fixes never moved under a verdict
  (Home.md, 17l).

Every finding was reproduced before it was fixed, and every fix is pinned by a test that fails on the code as it
stood (`test/auditlandforms.test.js`); lane D's coverage pins (D1, D2, D4-D9, D12) hold what was already right and are
proven by their mutants instead - 9 of the 21 pass on the code as it stood, which this paragraph once left out (AUDIT
LANDFORMS II J8). The pins the fixes moved carry a `PIN MOVED` note. Mutation-proven:
`tools/mutants/auditlandforms.json`, and every older record the fixes moved re-aimed and killed again. Each fix carries
an `AUDIT LANDFORMS` comment.

## The law and the math, on the real data

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E2 | Major | **The painted water climbed out of its channel at every crossing.** A road's or a track's cut ran its whole reach - floor, bank and verge, up to 62 m from its centre line - and lerped after the rivers (paint order), so it refilled the channel it crossed or ran beside. The painter still paints the river's water up to the road's own tiles, so the water there lay on the road's fill: on the real WOODS.WLD 55,096 wet corners stood half a metre or more over their channel's floor, 23,692 of them 2 m or more, the worst 19 m, beside 629 river and stream pixels. | **A channel is the water's** (`landforms.js`, the shaper's lerp): where a sample lies in a river's or a stream's channel - 1 on its floor, falling to 0 up its bank - a road or a track stands there on its own bed alone, the causeway's top, and its bank and verge give way by as much. After: 11,191 corners over half a metre, the worst 7.9 m - said here to be every one a corner a water tile shares with the road's own bed. It was not so (AUDIT LANDFORMS II J1): most (7,674) lay on a TRACK's bed, where the painter paints the water across the track and the shaper stood a causeway; a track gives way to the channel now, and what is left is the road's own edge row (3,303 corners, the worst 3.99 m - the one row of water against a causeway, which a heightfield cannot hold level). Away from water the road's bank and verge are whole, as before. |
| E1 | Minor | **A road on a hillside stood on a level shelf 32 m wide.** The cross-section's top was `max(smoothLand, floor + drop)` for every layer - the river's levee rule. With a road's `drop` of 0 its low side was the floor itself the bank's whole width (2.5 samples), then a fill eased down over the verge: on the real data fills to 11-13 m beside a 13 m road. | **A road's or a track's bank runs to the smooth land on both sides** - cut up into the high side, filled down to the low side over the same width; a river's and a stream's low bank keep the levee. After: a fill's height median 0.3 m, worst 5.9 m (was 0.6 and 12.8 m); across the painted road it is still level to the float (tilt 0.00 m on 300 roads). |

Measured and holding (scratch scripts, nothing kept):
- **The knee** over 6,656,400 coastal samples and **the seams** over 38,700 shared edge samples: 0 violations, 0
  differ, with both fixes in.
- **The painted water of every river and stream pixel** (3,048): every wet corner over the coast fade lies on its
  channel's flat floor - bends, junctions, joins and mouths alike. A tile's corners differ only along a river's own
  course (the steepest, a river down a 47% slope, DFU's ground too). (AUDIT LANDFORMS II J1: the check judged a corner
  by its distance from the centre line, not by its height, and at a crossing that was not the same thing - re-measured
  by height, see the E2 row.)
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
| A2 | Open | OW-MOUNTAINS' open step (`travelRoute.js` openStepBlocked) judges steepness on raw bytes; with the row on, 251 of the 839,697 steps it admits outside the Mountain climate rise over 160 m on the lifted ground (the worst 390 m, about 25 degrees). No failure traced: the slope limit is 70 degrees. (AUDIT LANDFORMS II I5: the ground has no slope limit in the port - the collider stands a body on the floor at any grade - and lane I traced failures on the lifted ground, I1 and I3.) | NAMED (Landforms.md, RESIDUES) - whether it reads `reliefByteHeight` with the row on is Mac's call. |
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

Lane D ran 69 new mutants against the snapshot's pins: 30 died, 39 survived. 61 are in
`tools/mutants/auditlandforms.json`, re-aimed to the code as it stands - 54 dead and 7 recorded equivalent, one of which
was not (AUDIT LANDFORMS II J5) - and 8 went with the stamp (C1). (This said every one, killed: AUDIT LANDFORMS II J11.)

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

## AUDIT LANDFORMS II - the audit audited, 2026-10-07

Mac: *"Do another deep audit on this"*. Six lenses on the head the first audit left (`c532321f`, frozen in a detached
worktree so no fix moved under a verdict - Home.md, 17l): **the first audit's fixes** (lane F), **the network's
timing** (G), **main's arrivals since** (H: #656, #657, #658, #660, #661), **the body on the ground** (I), **the tests'
and the record's honesty, round two** (J) - five independent adversarial reviewers - and this session's own (K): the
shaper re-read, every law re-measured on the real data with every fix in, and the save's frame driven end to end in
the running game.

Every finding was reproduced before it was fixed. Every fix's pin fails on the code as it stood before it - `c532321f`
for the lanes' findings (the new pins and the fixture copied into a worktree of it), the commit before the fix for
K1, I1 and H2's levelled site (I1's with the node fade exported and nothing told of it, so it fails on the ground, not
on the import); a coverage pin - a law that held but that nothing could fail - is proven by its mutants instead. Each
change carries an `AUDIT LANDFORMS II` comment.

### Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| K1 | Blocker | **This audit's own G1 fix killed the boot, and the gate built for that passed it.** The rides on a rebuilt pixel's ground were read from the publish, which the boot's first build runs before the pools and the player are declared - and the network lands inside that build on most boots, so a headless boot died with `ReferenceError: Cannot access 'droppedLoot' before initialization`. BOOT-TDZ2's static gate allow-lists the four pool names for destroyPixel's guarded reads, and an excuse covered every function. Caught by lens K's save probe before the push. | **The rides are one hook bound once the pools and the player stand** (`world.js` `rideGround`), and **every excuse is its own function's** (`test/bootorder.test.js`: an excused name read anywhere else on the first build's path fails - red on the code as it was). The scoping found one older read, `standWodPile`'s, which stands only the piles an unload carried; excused with that reason. |
| I1 | Major | **The lift steepened a sea cliff's plateau into a wall.** The lift steepens a slope by up to 2.8 times, most where the land already rises fastest - nowhere faster than out of the sea. Menevia's plateau (bytes of 75 a pixel from the sea, 785-804 x 178-216): its rim stood at 70 degrees; with I2 and I3 in, four of lane I's 24 journeys along the network still fell where DFU's ground does not - at x1 one of 95 m (450 HP) where the road itself drops down the face ((795, 192) -> (795, 191)); seven of its 28 locations took falls on a run in from their edge (124 approaches of 5,376, the worst 373 m at the Dunynak Excavation); and every 51 m grade over 63 degrees the lift made new on the real data lay within three map pixels of a sea byte. Mac: *"Is it too steep?"*, then *"Go ahead and do whatever you feel is most detailed"*. | **The lift fades beside the sea** (`landforms.js` `cliff`, `cliffFadeAt`): none at a byte node within a pixel of a sea byte, all of it three in, a smoothstep between - in 1024ths, read through the kernel's own bicubic window, so the rim stands as DFU stands it, the plateau behind rises to its whole lift, and a pixel's edge is one number from both pixels; the far ring and the travel view fade a node's lift the same. After, on the real data: the pixels steeper than 63, 68 and 72 degrees DFU's own count again (52, 29, 4; unfaded 116, 60, 29); all 24 journeys bill nothing at x1 or x100; none of the 28 rim locations takes a fall DFU's ground does not give; straight down the fall line from 54 rim pixels 250 damaging runs of 10,056 against DFU's 223 (1,267 before), the worst fall DFU's own 166 m (280 m before) - the rest a road's bench across DFU's own cliff (RESIDUES). The ceiling's glitch, a diagonal step from the sea, keeps a ninth of the lift: about 2.46 km. |
| I3 | Major | **A Travel Options journey down a lifted mountain road billed lethal falls.** A journey runs the motor at its time scale (x60, x100 on a road: `motor.js` steps `FIXED_DT * scale`), so a collider substep runs far further than a frame's at x1, and the floor arm caught the ground only within `STEP_OFFSET` (0.5 m) under the feet: down a grade steeper than that over a substep's run the body left the floor, flew level and landed 25-55 m down, step after step. The Dragontail road (941, 468) -> (940, 477) billed 2,377 HP at x60 on the lifted ground, and Menevia's 1,771 HP at x100 on DFU's own. | **The floor arm reaches as far down as the slope limit allows over the substep's own run** (`collider.js` `_moveStep`: `max(STEP_OFFSET, run * tan(SLOPE_LIMIT_DEG))`), so a body that follows a road at x1 follows it at x100. At x1 a substep's run is short and nothing changes. Lane I's twelve rim and Dragontail lines, both ways: the Dragontail's bill nothing at x1 or x100 now, DFU's ground nothing anywhere (the rim's remainder is I1's). |
| J1 | Major | **A track over water was painted a ford and cut a causeway.** The painter paints road, river, stream, track, the first to write a tile keeping it, so the water is painted across a track; the shaper lerped the track after the water, as it does a road. On the real data 7,674 wet corners on a track's bed stood half a metre or more over their channel's floor (the worst 7.87 m), and 169 water tiles lay wholly on a track's bed - most of what the first audit's E2 row called the road's. | **A track gives way to the channel on its own bed too** (`landforms.js`, the layer's `ford`): 0 of the 7,742 now. What stands over a floor is the road's own edge row (Landforms.md, RESIDUES). |
| J2 | Major | **No test met a stream.** The fixture's one stream joined nothing, so a stream taken for dry land and the river and the stream lerped the other way round survived every pin, and each would have shown on the real data - an unpainted ditch with the rivers off (to 3.57 m), a road refilling a stream (to 1.86 m), a join cut the wrong way round (to 3.16 m). | PINNED: the fixture gains a stream into the river and a road over that stream (`test/landformWorld.mjs`); with the rivers off no stream channel, at a join the river's, and E2 at a stream's crossing. |
| I2 | Minor | **A bench on a steep hillside stood its banks about twice the hillside's grade** - level across, the cut and the fill rise and fall a bank's width: at (627, 282) 72 degrees and 19 m tall on DFU's 53, and a run straight down across it launched into falls of 20-49 m where DFU's ground is safe (seven such pixels). | **A bank is never a launch ramp** (`landforms.js` `bankGrade`, `bankHold`): a road's or a track's floor and bank are held within what its bank climbs at half a grade over the smooth land - 4.3 m for a track, 5.3 m for a road - and a river's floor never (its water is level). At the seven pixels the damaging runs are 0 (the steepest bank 60-65 degrees); where a level bed would stand further off its hillside it leans with it (2 of 300 straight roads, the most 0.98 m across the painted tiles); 10 of 1,500 random path pixels move at all. |
| G1 | Minor | **What lay on the ground stayed where it stood when Basic Roads' network landed** (= lane F's F2). ROADS 25 rebuilds a built pixel when the arrays land after its first build - online through C3's retry, a slow boot, offline a failed fetch (the generated network, up to 4.4 s) - and the landing moves the ground by metres now: 14.2% of the samples of all 52,229 path pixels, the worst 30.1 m. Piles, torches, camps and corpses kept their stood height (only HCC's carts were stood again, DISC20-C), and the next save kept the offset: a pile 27.98 m in the air at (795, 191). | **What is grounded rides the difference** (`world.js` `_groundBefore`): a torn pixel's samples are kept until its rebuild publishes, and then every pile, torch, own camp, corpse, foe and guard on it moves by the new ground less the old at its spot (`groundMoved` on the five pools, beside DISC20-C's carts); a deck camp rides its deck. |
| G2 | Minor | **The player the season hold kept standing fell the cut**, put back at the old height when the hold let go: 28.71 m, 118 HP at (795, 191). | A grounded player on that pixel rides the same difference; a fall under way keeps its own (FALL-KEPT). |
| G3 | Minor | **Nothing timed out a Basic Roads fetch**: a fetch or a body that never answered left an online client roadless for the session, and the retry never asked again. | **A fetch is a failed ask after 30 s** (`roadsProducer.js` `MOD_ROADS_FETCH_TIMEOUT_MS`): each file's fetch and its body race it and are asked to stop, so the retry - or offline the port's own network - stands in. The retry's window is named (RESIDUES). |
| F1 | Major | **The spawn's probe was bound after the boot's load** - online the only load - so that load stood a spawned dungeon's records on the wild lift, and every later save wrote them on the spawn's: a camp by a spawn's door drifted 24 m a session at the Citadel of Copperton (over 1,500 spawn pixels up to 17 m at the rect's centre, 70 m anywhere), and a camp is never stood again. | `_liftLocationAt` and the probes it mirrors are declared beside `_locationToBuild`, before the boot's load. |
| F3 | Minor | The lift fields were cleared whole past eight, so a save whose records stood on nine pixels made every field again at every save - a town's is a kernel pass on the main thread: 146 ms for nine, 0.4-0.6 s for sixteen; online every two-minute checkpoint. | The last 32 asked are kept, the longest unasked let go first; the rects alike. |
| F4 | Nit | An anchor set in a dungeon asked the lift of its dungeon-local feet as a scene point. | A dungeon anchor keeps its own frame's height. |
| H2 | Minor | **Nature asked the beach line of the shaped blend in a town's pixel, where the tiles ask DFU's** (D3 fixed the tiles alone): 85 tiles in 43 of the 351 coastal location pixels crossed it (Kingford Palace, 40.005 -> 39.998), the gathering nodes' door flipped at 79, and DFU's scatter refuses between its chance roll and its next draw, so one flip reshuffled every later flat of the pixel. | **Nature asks the beach line of DFU's own blend** (`terrainGen.js` `beach`: the kernel's DFU blend, smoothed under the roads as the tiles are and levelled by a World of Daggerfall site as DFU's nature reads it - lane H's one suspicion, followed - kept on the pixel) - the scatter, the woods, the ecotone's border tiles and the gathering nodes' door (`herbHost.js`, `mineHost.js`). 0 of the 351 move. |

### Pinned

| ID | Sev | Finding | Pin |
|---|---|---|---|
| J3 | Major | B1's binding was pinned on diagonal keys: a probe, an index or a gone-set read (y, x) survived. | Off-diagonal keys and their mirrors. |
| H1 | Minor | C1's pin named twelve writers and could not fail on a thirteenth: a writer of a raw exterior height passed ESLint and all 1,144 tests in the 90 files that read world.js's save lines. | THE ONE CONSTRUCTION SEAM: every world.js line that sheds the frame's compensation goes through `groundFrameHeight` / `groundFrameNative` or is one of fourteen named transients, each with its why. The read side is not swept (RESIDUES). |
| H3 | Minor | Nothing held a town pixel's nature to the shaped ground with the row on: `layoutNature(classic ?? samples, ...)` survived 650 of 651 terrain-job tests, and would stand flats up to 918 m off their ground (the Nest of Rattgod). | A lifted town with a swamp to its east and a desert to its north: every flat - the scatter's, the woods', the border's - on the ground the pixel is built of. |
| J4 | Minor | `LANDFORM_FLOOR` was pinned by `>` alone: +5 moved 43,438 samples in 269 coastal path pixels (the worst 2.49 m). | Half a unit over the knee, exactly, and a river's mouth held there. |
| J5 | Minor | The recorded equivalent `D-liftfield-unclamped` is not: world.js's own recentred arithmetic hands a field a hair under 0 at a pixel's edge (4,681 of 200,000 points, to -3.6e-14), and unclamped a town's field reads before its first row - a NaN into the save. | A record on a town pixel's west and south edges; the record's `equivalent` struck. |
| J6 | Minor | B1's frame pin ran on a flat row, blind to the compensation's z sign, and the north edge was unpinned (37 locations in rows 0-1). | A sloped row; the north row lifted, the row past it none. |
| J7 | Minor | `retryModRoads`' defaults never ran: no fetch, a wait of nought and no tries at all survived. | The retry on its own defaults - the page's fetch stubbed, the timers mocked, the first wait a millisecond short - and the host's call, `{ onTry }` alone. |
| J9 | Minor | Test 8 and D7 pinned `landformLiftField`'s lift-alone branch, which the game never takes (`landformsHere()` is never null with the row on). | The branch is gone - the field always runs through the landforms (the relief's alone when no network is held) - and the pins aim at that. |
| J12 | Nit | The wild field's `Math.fround` was unpinned. | `Object.is` against the pipeline's float32 sample. |

### The record

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| J8 | Minor | "Every pin red on the code as it stood": 9 of the first audit's 21 are lane D's coverage pins, green there by design. | FIXED (above, and the Testing.md row). |
| J10 | Minor | The PR's "Seen in a headless browser on the real data": its captures predate E1, E2, D3 and B2. | FIXED (the PR's description). |
| J11 | Nit | Lane D's 69: 61 in the list (54 dead, 7 equivalent) and 8 gone with the stamp - not "every one ... killed". | FIXED (above). |
| J13 | Nit | `restand-ratio-unguarded`'s why named world.js's callers alone, and THE FOUR HOSTS called worldModes NOT WIRED while its legacy interior cache is stood again through the world host's `restandSceneHeight`, the lift with it. | FIXED (the record's why; Landforms.md). |
| I4 | Nit | A CAUSEWAY'S WALL said "about 2.4 m over 6.4 m" - the median alone. With every fix in: median 2.1 m, 90th percentile 3.7 m, the worst 14.2 m at (173, 91) where DFU's own ground steps 6.2 m; over 3 m at 117 of the 487 crossing pixels (DFU's ground, 17). | FIXED (Landforms.md, RESIDUES). |
| I5 | Nit | A2's "No failure traced - the slope limit is 70 degrees": the ground has no slope limit in the port, and lane I traced failures. | FIXED (above; Landforms.md). |

### Open

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| I6 | Nit | 0.83% of land samples stand over the snow cloud deck's top (2,000 m): a summit in snow shows a clear sky. | NAMED (RESIDUES). |

### Lens K - this session's own

- **The real data, every fix in** (scratch, the freeware WOODS.WLD and the vendored network): THE KNEE over every
  coastal path pixel (9,712; 161,617,392 samples) - 0 violations, 0 tiles; THE SEAMS - 530,706 shared edge samples
  and 20,570 ghost-row samples, 0 differ; THE PAINTED WATER by height at all 487 river and stream pixels a road or a
  track crosses - 0 corners off the floor on a track's bed or anywhere else, the road's edge row 3,303 (the worst
  3.99 m); THE COAST'S NATURE - 0 of 351 pixels move; THE ROADS - the bed's tilt 0.00 m at the 95th percentile of 300
  straight roads (two beds leaning, I2), a fill 3.9 m at worst (5.9 m before I2).
- **The save's frame end to end** (K1): a headless boot of the running game (`?world&shot`, SwiftShader, the
  freeware data) on the tree - which is how K1 above was caught. Then the frame itself: a quicksave at Makilliweyn, on
  the Dragontail and on a road's cut with the row on, loaded on a page with it off, and the other way round - every
  load stands the body exactly on its ground (0.00 m), the Dragontail's two grounds 88 m apart; no page errors either
  way. (In shot mode a save records the camera and a load stands the camera 40 m over the loaded height, not the
  body - the probe stands the camera on the ground before a save and reads the camera after a load.)
- **The cliff's fade** (I1), measured before it was chosen, over all 319,785 land pixels: a fade from one to three map
  pixels brought the steep counts back to DFU's and moved the lift by over a metre at 570 pixels' centres; one to
  four, the same counts and 909 pixels; from half a pixel, 64 pixels over 63 degrees still. A wider fade changes none
  of the four rim pixels where a road's bench adds a run.
- **The bank's grade** (I2), measured before it was chosen: at the seven pixels `bankGrade` 0.75 left damaging runs at
  five (falls up to 30 m), 0.5 at none.

### Pins and mutants

`test/auditlandforms.test.js` 21 -> 36: F1, F3, F4, I3, J1, J2, I2, G1/G2, G3, H2, H3, H1, J4, J5, J7 (each named
above), and J3, J6, J12 inside B1's and D7's pins; `test/bootorder.test.js`'s scoped excuses (K1). PIN MOVED: the
anchor's writer, the lift host's slice and the probe's declaration (F1, F3, F4), the arm-weighting law and the dials
(J1, I2), the floor (J4, `test/landform.test.js`), test 3's message (J9), the collider's floor arm
(`test/mac3_downhill.test.js`, I3), and WATER1's beach reads (`test/terrain.test.js`, H2).

`tools/mutants/auditlandforms.json` - 159: 153 dead, 6 recorded equivalent (60 new, all dead; D-liftfield-unclamped
no longer equivalent). 24 records the fixes moved re-aimed by content and killed again, across this list,
`auditsilver.json`, `fb1001_mining.json`, `forest1.json`, `landform.json`, `lwdry.json`, `prof2.json` and
`verge1.json`. Judged on the final code with `landform.json`: 195, 189 dead, 6 equivalent, 0 survived.

## AUDIT LANDFORMS III - LANDFORM4-6 audited, 2026-10-07

Mac: *"Audit this. Must be perfection"*, of LANDFORM4-6 - a town standing in its land, the rolling hills, the land each
climate wears. Four lenses on the head LANDFORM6 left (`848caa51`, frozen in a detached worktree so no fix moved under
a verdict - Home.md, 17l): **the shaper's math and determinism** (A), **every reader, the wiring, the boot and online**
(B), **the tests' and the record's honesty** (C), **the real map's body and cost** (D) - four independent adversarial
reviewers, every one on the freeware ARENA2 and the vendored Basic Roads network in scratch, never in the repository -
and this session's own (E): each fix measured on the real data before and after, its pin red on the code as it stood,
the lenses' own mutants judged again on the final code.

Every finding was reproduced before it was fixed. Every fix's pin fails on the code as it stood before it - proven by
its mutants (`tools/mutants/auditlandforms3.json`), each the old line put back; a coverage pin - a law that held but that
nothing could fail - is proven the same way. Each change carries an `AUDIT LANDFORMS III` comment.

### Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Blocker | **The town pull stood walls at the beach round coastal towns** - the very cliffs LANDFORM4 was made to take away. At or under the knee a sample is DFU's; a sample just over it was pulled most of the way to its site's level, and nothing eased the pull as the land neared the knee (the hills, the cuts and the lift all fade there). On the final mesh (DFU's blend and SmoothRoads after) over the 7,434 pixels within one of a coastal site: a step past DFU's own over 10 m at 257 pixels, over 50 m at 85, 149 m beside Penwold ((140, 237): 41.1 -> 161.7 units where DFU steps 41.1 -> 42.3); Naresa 143 m, Tunmont 112, Penwall Derry 111; inside a site's pixel DFU's blend only shrank it. A road's profile took the same jump. | **A pull up is eased in by how far the land stands over the knee toward the level** (`landforms.js` `pullTo`: smoothstep of (land - knee) / (level - knee)): a coast's land rises to a town no more than 1.69 times as steeply as it rises on its own. Over the same 7,434 pixels: 0 steps over 5 m past DFU's, the worst 0.9 m (with D4); over lens D's 914 coastal sites the biggest step between neighbouring samples over 10/20/30/50/100 m 24/3/0/0/0, the worst 25.1 m - LANDFORM1-3's own 19/2/0/0/0 and 25.0 m (the snapshot's 284/170/105/55/14, 151.4 m); straight down the fall line at x1 at Kalunnunu, Privateer's Hold, Tuncart, Penwold and Naresa no damaging run (21-62 at each on the snapshot, the worst 162.5 m, 787 HP). Measured before it was chosen, each on the same probes: the ease kept whole near the rect (the rect exact at its level) left 227 pixels over 5 m and 45 over 50 m - a level rect and no wall at the knee cannot both hold beside it, and DFU's blend levels the rect after the kernel anyway; a cap instead of the ease (the move up at most three times the land's height over the knee, so a town's own land is pulled whole) left 124 steps over 5 m and stood the land round 26 towns' rects steeper than 45 degrees against this law's 10. So a rect's land under its level is raised by the ease - high over the knee all but whole (within a tenth of a unit on LANDFORM4's upland), and a hillside town low over the sea stands under its level (lens D's D4 row, below). |
| C1 | Major | **On the shipped ground the hills stood rivers on embankments, and the moved pins hid it.** `waterFade` took every hill away within half a pixel of a river's centre line, so wherever the land beside a river was a dale the water's corridor stood over it: 215 of 2,882 inland water pixels stood more than 10 m over every dry neighbour, 86 over 20 m, the worst at (259, 119) in mountain woods, the river at 611 m and its banks at 534-559. LANDFORM3's pin `off - cut > 0` had been relaxed to `abs > 0.5` and its channel re-pointed at the land without hills; G1/G2's pile rode the river's floor UP 2.62 m while its title said down the cut. | **A river cuts its valley** (`carve`): within `valley` of a painted river's centre line (120 samples; a stream's 96) the hills ease down to the deepest dale their land can stand (`hillsAt`'s `out`) by 1 - smoothstep of the distance - never above the hills, never under that dale; where two valleys meet the deeper wins. River centres more than 10 m over their lowest dry neighbour on the real map: 1,612 with the stilling (and A2's stale centres), 266 now - under DFU's own land's 957, the hills off (the worst, 204 m, a river DFU's own data runs over a ridge: 228 m there without the hills). LANDFORM3's strict `off - cut > 0.5 / UNIT` and G1/G2's strict fall restored. |
| A2 | Major | **The mountain woods sat 13-18 m low, mostly dales.** The foothills' shape centred its ridgelines with RIDGED_NORM, then was centred again at 0.165 - the ridgelines' own centre before RIDGED_NORM was set - against its raw mean of -0.006: every one of the 18,379 MountainWoods pixels a mean hill of -13.2 m on the real data, against "the land's mean height is untouched". It drove much of C1. A4: the haunted woods' centre -0.31 against -0.256, +3 m. | Every land's centre measured again over 200,000 points (`LAND_NORMS`, by land): the foothills 0, the haunted woods -0.256, the ridgelines 0.958, the subtropics 0.02. Every land's mean hill within 3 in 100 of its height (pinned). |
| B1 | Major | **The sites hung on whether each client's town packs loaded.** The site rows were `getLocation`'s, which serves a pack's row ahead of MAPS.BSA's, and Beautiful Villages resizes 3,240 grids (M'arg Manor 1x1 -> 3x3), Beautiful Cities 120. Online both are forced on, but a pack's fetch can fail with no retry and the client still plays: round 25 resized villages every wild neighbour pixel differed by over a metre, a median 15.2 m, 119.95 m at worst beside Gheghte Court - a split that before LANDFORM4 stayed inside the town's own pixel. | **Each site is its row as MAPS.BSA holds it**: a row the world-data door replaces is read again past it (`MapsFile.locationReplaced`, `readClassicLocation`; only those - reading every row again costs 339 ms at the mount). A village a pack enlarged stands a pull flat smaller than its town, and DFU's blend levels the pack's rect inside its pixel (Landforms.md, RESIDUES). |
| D4 | Minor | **The sea was counted twice under a coastal town.** A site's level was the mean of its whole pixel, the sea and the beach as they stand; the pull took the town's land down to that sea-dragged mean, and DFU's blend after the kernel averaged the sea in again: six real coastal towns stood under the beach line where DFU stood them over it (Gothcroft 45.0 m on DFU's 58.3, Aldwall Rock 46.6 on 60.4, Ipspath, Longham, Cudogudax, Upmore) - lens D, on the snapshot and again on the A1 fix. | **A level is its pixel's LAND's mean**, the samples over the knee (`siteLevel`; a pixel with no land on the grid keeps the whole mean, so a site in the sea still holds the land it pulls at the floor). None of the six under the beach line now; Kalunnunu's town 109 -> 125 m (DFU's 137); over every coastal site the steps and the walls the same or less (A1's numbers are this law's). |
| A8 | Minor | **LANDFORM6 brought engine-dependent maths into the ground** - Math.cos, Math.sin and Math.exp, which the language leaves each engine to approximate - the first ground to ask one; and LANDFORM2's arm weight squared with `**`. Clients on two engines could stand their hills ulps apart. | **The ground is one float in every engine**: the cosine, sine and exponential are series of correctly rounded steps (`cosPi`, `sinPi`, `expNeg`, within 4.5e-16 of V8's own), the square a multiply; no source of the ground asks an engine's own (pinned by its syntax tree). |
| R7 | Nit | The site levels' cache was let go whole at 4,096 (A5), where the record said "the last 4,096": a reload of every level, 0.4 ms each. | The longest kept is let go first. |
| A7 | Nit | `landShares` read its climate nodes off 128-sample pixels whatever the shaper's span; no caller passes another today. | The shaper's span, handed through `hillsAt`. |
| B4 | Minor | `landformLiftField`'s null default was described as "the relief alone"; since LANDFORM5 it stands the woodlands' hills too, and no sites - 15-91 m off the built ground, had a caller used it. Nothing swept the tables' many hand-threaded constructions (THE ONE CONSTRUCTION SEAM). | The docblock says what the default stands on; every createLandforms, generatePixelTerrain and restrideGrid call in `src` is swept for the sites and the climates (or a built landforms), the default the one exception. |

### Pinned

| ID | Sev | Finding | Pin |
|---|---|---|---|
| C2 | Major | Nothing held a site's level to its own climate's land: `hillsAt(..., null)` in `siteLevel` survived - on the woodlands' hills a Mountain site's level moves a median 18.6 m, 110 m at most (3,282 sites), the wall LANDFORM4 took away. | A town's level on the mountains' land, the woodlands', and the land without hills, asked in turn of one world, so a level kept across tables fails too. |
| C3 | Major | Nothing held the climate map's row direction or its smoothstep: an off-by-one row, a north-south flip and a linear share all survived (every table varied in x alone). | Twelve lone desert pixels, a swamp row north and a rainforest row south: the desert whole at the centre, smoothstep(0.25) of the woodlands a quarter pixel east and of the swamp's row a quarter north. |
| C4 | Major | The seam pins "with the network" had no path near a site: a road's profile unpulled, and the ground noise unlevelled under a road through a town, survived. | A road through a town at its level, its banks and verges with it; every seam along the road beside an 8x8 town. The 5x5 of sites a pixel gathers proved a margin: a sample reads a neighbour's arm only at its last two profile points, where a site two pixels off stands its reach away - so its 3x3 mutant is recorded equivalent, and the docblock says why. |
| C5 | Minor | How two sites share a sample, and the reach by the rect's longer side, were unpinned (`w4 = w`, `keep = min`, the shorter side all survived); 23 real sites have a neighbour site, 1,851 are not square. | THE PULL WRITTEN OUT round two towns side by side and a hamlet longer than wide, at every sample. |
| C6 | Minor | The high ground's `upland`, the hills eased on the noisy height, and the client posting its own tables (a transfer would empty the main thread's) all survived. | Each land's tallest hill `upland` times its lowland's; the hills against `hillsAt` of the kernel's macro on a strand; the client's post through structuredClone with its transfer, its own tables whole after. |

### The record

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| A3 | Minor | "Across the border the blend's steepest step is within the steeper land's own": on 1,000 real border strips the blend was steeper than both lands in 104, by 5.4 degrees at worst ((592, 31), woodlands into mountains). | FIXED (Landforms.md: the share's slope times the lands' difference, measured). |
| R1 | Nit | "The stilling reaches a third of a pixel": it took every hill within half a pixel and faded out by 120 samples. | FIXED (the valley's own reach, C1). |
| R2 | Nit | The ledger's ceiling "3,020 m" - the lift's alone; with the tallest hill 3,180 m. | FIXED. |
| R3 = B3 | Nit | `TerrainGenClient.setSites` and the worker's `sites` message, in Landforms.md and the ledger: `setLandformTables` and `landform-tables` since LANDFORM6. | FIXED. |
| R4 | Nit | The ocean land "the coastal pixels the boot's dilation gives a land climate": 44 land pixels are Ocean before the dilation, 0 after - no land sample wears it. | FIXED (the table's row). |
| R5 | Nit | G1/G2's title and Testing.md row said the pile rides "down the cut" while, on LANDFORM5's stilling, the landing raised the river's floor 2.62 m. | FIXED by C1: the valley carves it down again, and the pin is strict once more. |
| R6 | Nit | "Six times the flat-topped high ground": 5.25. | FIXED. |
| R8 | Nit | Lane D's written-out law runs on `hills: false` since LANDFORM5, unsaid. | FIXED (the Testing.md row). |
| R9 | Nit | LANDFORM4-6 "NOT MEASURED ON THE REAL DATA": this audit measured them; the tables of LANDFORM6 are still the synthetic field's. | FIXED (Landforms.md, RESIDUES; the ledger). |
| B5 | Nit | THE FOUR HOSTS not refreshed for LANDFORM4-6. | FIXED (in the audit's first commit). |
| R10 | Nit | The ledger's 36 tests in `auditlandforms.test.js` (37). | FIXED. |

### Open

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| C7 | Minor | 4 of 60 real towns of 3x3 blocks or more stand land more than a degree steeper than their bare land's steepest 51 m grade (walled / pulled / bare: Wadijirius 64 / 39 / 30, Akhera-Korom 38 / 16 / 12, Crossley 31 / 34 / 31, Singwick 22 / 24 / 22): a level town on a steep mountainside gives its rise back within its reach (124 samples, 794 m). A wider reach needs the 7x7 of pixels round a sample and levels more of the land. | NAMED (Landforms.md, RESIDUES); for Mac. |
| B2 | Minor | Main's WATER-NEXT, not the landforms': its bed halo classifies a location neighbour's tiles from the raw ghost kernel, but DFU's blend moves those samples across the band - 27 of 55 coastal-town/wild seams with water part, up to 2.96 units, the same with the landforms off. | NAMED for its owner (Audit-WATER-NEXT.md, F2's rest). |

### Lens D - the body on the real ground

Lens D read the body of the real map on the snapshot - every coastal site, every town's band, falls down the fall line
with the game's own motor and collider, the cost - through a pipeline that matched `generatePixelTerrain` at all
99,846 samples of six pixels. Its D1 is A1 (above), its D4 the D4 row; the rest, with its probes run again on the
final code:

- **D2, the towns' band** - the steepest 51 m grade in each of the 3,444 towns' pixels outside its rect: DFU p99 36.0
  degrees, over 35/45/55/63 degrees 42/13/3/1; LANDFORM1-3 43.4, 66/27/6/2; the snapshot 48.2, 65/40/27/14 (60 towns a
  step over 20 m inside their own pixel, every one a knee wall); now 34.9, 33/10/3/0, none - gentler than DFU's own.
  A town stands under its level where its pixel's land falls toward the sea (its own land under the level is raised
  by the ease, the high pulled down whole): 79 towns over 10 m under it, Naresa 49 m (its band 48 degrees on DFU's 66)
  - the grade round them is the measure, and it is DFU's or gentler.
- **The shot's town** is almost certainly Kalunnunu (754, 279), a 6x7 walled city in Lainlyn's rainforest - and its
  wall was DFU's own south ramp (48 degrees, 120 m over 19 samples), the lift nothing there: Landforms.md's diagnosis
  is corrected. Pulled, that ramp falls to about 18 degrees.
- **D3, the lands on real slopes** (on the snapshot): the steepest 51 m grade over a town's 3x3 a median 11.9 degrees
  (DFU 8.8, LANDFORM1-3 9.1), 69 towns over 45 (18, 37) - the hills ride DFU's slopes and the lift; the page's "no land
  past 45 degrees" was the field's alone. No fall: the collider follows a 57-degree grade. RECORDED (Landforms.md, ON
  THE REAL GROUND); for Mac.
- **D5, the coast's tiles** - AUDIT LANDFORMS D3's "a tile parts from the shaped ground by at most 2.2 m": over 300
  coastal location pixels, where DFU's blend is at or under the beach line, LANDFORM1-3 at most 0.41 m, the snapshot
  9.5 m, now a median 0.48 m, 1.94 m at the 90th percentile, 3.9 m at most (Damasta-Korom). No water tile's ground stands over its DFU height.
- **D6, the roads ride the lands** (on the snapshot): the grade along straight roads at the 95th percentile, the deserts
  6.6 -> 16.5%, the mountains 21.0 -> 34.0%. RECORDED (Landforms.md).
- **D7, two sites at once**: 13 pairs of sites in adjacent pixels (Privateer's Hold and Gothway Garden 279 m apart in
  level); on the snapshot their grades over the beach rose 3-6 degrees - the knee walls (A1), now LANDFORM1-3's steps.
  Pinned (C5).
- **D8, the cost**: a whole job a median 19-26 ms by climate against DFU's 10.5-11.9 (about twice), the kernel alone
  13-21 ms (the page's synthetic 9.6-14.8), a site's level 0.29 ms; a city's lift field on the main thread a median
  21 ms (61-100 ms cold), nine town pixels about 190 ms (F3's 146). RECORDED (Landforms.md).
- **Held**: 10,578 shared edge samples on 41 town pixels at climate borders, 0 differ; no sample crosses the knee; the
  lattice's lines no crease (second differences 1.04-1.14 times off them); an inland town at its level (the median 0 m).
- **Unmeasured**: the full-map scan (the share of land over 35-63 degrees by climate, the pixels over 63/68/72 degrees
  against I1's 52/29/4) was stopped for this session's mutation run and its output lost.


### Pins and mutants

`test/auditlandforms3.test.js` (13): A1, A2, D4, B1, C1, C2, C3, C4, C5, C6, A7, A8, B4. PIN MOVED: LANDFORM4's rect law
(`test/landform45.test.js` - at its level where its land stands over it, the ease written out under it), LANDFORM5's
river (its valley's floor under the land without hills), LANDFORM3's cut and G1/G2's fall back to strict (C1), the
dials (D8, the valley's), the host's classic rows (B1), the shore's FLOOR hold (a site in the sea now, D4).

`tools/mutants/auditlandforms3.json` - 35: 34 dead, 1 recorded equivalent (C4's 3x3, above). Lens C's 21 mutants of
its own, 15 of which survived the pins as they stood, judged again on the final code: all dead but that one. Six
records the fixes moved re-aimed by content and killed again (`LANDFORM5-no-stilling` now `LANDFORM5-no-valley`,
which only the new file's pin kills; the arm weight's three, A8's multiply; the lift's whole height; the ease on the
woodlands' top). Judged on the final code with every `landforms.js` record of `landform.json` and `auditlandforms.json`
and the whole of `landform45.json` and `landform6.json`: 160, 155 dead, 5 recorded equivalent, 0 survived.

## For Mac

- I1 (AUDIT LANDFORMS II): asked, *"Is it too steep?"* - answered and, on *"Go ahead"*, fixed: the lift fades beside the
  sea (above). What is left on Menevia's rim is DFU's own cliff, and a road's bench across it.
- C2: whether two builds in one room should be kept apart - a relay change (a ground law in the world hello, or a tag
  in `worldRoom`); no ground slice has done it before.
- A2: whether OW-MOUNTAINS' steepness should read the lifted ground with the row on.
- C7 (AUDIT LANDFORMS III): whether a big town on a steep mountainside should level more of its land - a reach past
  the pixels beside its own, gathered from the 7x7 - or keep the land's own grade a few degrees steeper round it.
- WATER2's lesson: none of this has been seen on a real GPU by a player - Mac's eye before the merge.
