# AUDIT JUNGLE-ROADSIDE (2026-10-23) - the roadside pairs, read cold

The owner, of JUNGLE-ROADSIDE (`03-World/Bantha-Jungle.md`, The roadside pairs - the owner's three pairs astride the
Jungle of Bantha's roads, lianas strung across them, sunk so none floats): **"Audit this and ensure perfection"**. This
page is the findings, each with its verdict. What the audit changed is written into the record's section as it now
stands, each change under its finding's id (AUDIT JUNGLE-ROADSIDE GAME-1 and on), and the code says the same at every
site.

## How it was run

Six lanes, each a cold adversarial reader of the change at c53c0d6a0 (JUNGLE-ROADSIDE, 419eb8537 and abb6a5554, with
main merged in), told to reproduce every finding - a probe and its saved output - before reporting it, to cite the code
by its text, and to fix nothing. They read A FROZEN SNAPSHOT (a detached worktree of c53c0d6a0), never the working tree:
Home.md's DO NOT FIX WHILE THE VERIFIER IS READING held - no fix was made until the five code lanes had reported. Each
ran on the freeware's own data (`tools/fetch-data.sh`).

| Lane | Over | How |
|---|---|---|
| READ - the files | the owner's OBJs to the mesh and the door: the reader, the roots, the measures, the near-only prototype, the build's files | the refactor checked byte for byte against the base for the five trees; each pair's mesh rebuilt triangle by triangle from the file; the roots against an independent rigid fit (Horn's method); two probe mutants |
| LAW - where and how deep | `standPairs` on the real map: the stations, the bands, the trails, the sink, the burial, the headroom | the real kernel over all 5,397 road and track pixels of the area (44,105 pairs), every station's refusal counted, the drawn ground under every foot and the drawn points over every band; 12.35M lattice cases of the band against VERGE1's |
| GAME - the build and the draw | `scenes/roadsidePairs.js`, `pixelBuild.js`, the handover, Logging, the handles, the wind, the shadow, online | the shader's own handover law over each pair; the real jungle door over the real files; Logging's day over 30 days on two peers |
| PERF - the cost | the worker, the wire, the main thread, the door, the GPU's draws, outside the jungle | measured interleaved against the base in one process, medians of 15 to 61 rounds under an A/A control; the whole area's census |
| DOC - the record | every claim, the pins, the mutants, the gates | every gate run; the 60 recorded mutants run and some 30 of its own; the record's numbers re-derived on the freeware |
| LOOK - the game | the pairs in the running game, as a player meets them | the snapshot's build in the running game - its report had not come back when this page was written (below) |

**WHAT THEY FOUND.** 33 findings from the five code lanes, four of them one defect met by a second lens (written `= GAME-1` and so on): 29 in all, two HIGH. The handover was measured at two points 15 to 19 m apart, so a pair's tree seen from the side all but vanished in the band (GAME-1); on a client whose jungle door had not loaded, the pairs' trees were Logging's, and two players' day's trees parted (GAME-2); Basic Roads' GetPathsDataPoint was ported a second time (DOC-2). The rest: the headroom read on one line and set under a walker's eye (LAW-1, LAW-2), the sink read off the bilinear ground (DOC-5), six batches and 88% more wire a road pixel (PERF-1, PERF-2), one bad file failing the whole door (GAME-3), measures not converged (LAW-3), pins that could not fail (LAW-4, DOC-3, DOC-4, READ-3), and the record's numbers.

## What it found, and what was done

### READ

| Id | Finding | Verdict |
|---|---|---|
| READ-1 MED | The handover out of step: the pair drawn near as one instance at the middle of its roots, faded by that middle's distance, and each tree's far picture by its own root's - seen along its axis, a tree all but vanished in the band (the fig's nearest at 0%) | = GAME-1 |
| READ-2 LOW | One of the six new files failing failed the whole jungle door, and spent one of its retries | = GAME-3 |
| READ-3 LOW | Two mutants of the near-only prototype passed every test: its cull size quartered, its atlases unkept | FIXED: each half's size held to its own mesh's reach and height; a held half drawn whole again after LPT_IDLE_S unseen (records `a-halfs-size-halved`, `its-atlases-unkept`, both dead) |
| READ-4 NIT | `over` measured in a slab of the band's width in the owner's metres, the road's in the world's: at the smallest scale a drop near the edge would have been missed | FIXED: the slab at the smallest scale a pair stands at; at 0.02 m it changes the table, and the record that drops it dies |

### LAW

| Id | Finding | Verdict |
|---|---|---|
| LAW-1 MED | The headroom broken by 47 pairs on the real map, down to 1.16 m: the road read on the pair's axis alone, the drop that hangs lowest a metre along the road from it, over a graded road | FIXED: what hangs under 8 m over the band kept as half-metre cells, each its lowest (`under`), the drawn ground's highest under each cell held to it, and the road's highest anywhere under the pair to 8 m (`highestDrawn`, exact - a cell's road first read at its middle came a centimetre nearer on the real map, and was made exact too). On the real map now over half the area's road pixels (2,700, 18,419 pairs): the lowest drawn point over its own road 2.757 m over the drawn road under it, nothing within 4 m of another road's band, the sink 0.3 m under every foot exactly and no trunk buried past 3 m |
| LAW-2 LOW | 1.5 m of headroom under a walker's eye (1.7 m) and a rider's (2.51 m): 3,899 pairs (8.8%) hung a drawn point under 2.51 m over a band | FIXED: 2.75 m (RIDE_EYE_HEIGHT and a quarter metre) |
| LAW-3 LOW | The measures at a 0.1 m step not converged: the grid stepped over a drop's tip and part of a root - `over` 9 cm high, the feet 5 cm short | FIXED: 0.02 m, the feet rounded up and what hangs over the road down; the test holds 0.05 m to agree |
| LAW-4 LOW | Station laws no test could fail - the tile law gutted, the trails unasked, the slide dropped, the first tree's tile alone; the `edge` guard never refused a station | FIXED: the tile law a function of its own (`pairTile`) held term by term on tiles that are not their transposes; the trails asked at each foot's reach; the stations, slide, kinds, turns and scales pinned on a fixture whose count is written down; `edge` gone - the test walks every station of every arm, slid either way, every pair, turn and the two extreme scales: no trunk nearer the pixel's edge than `EDGE_MIN`, 19 m |
| LAW-5 NIT | The record's "found to a millimetre or two" (5.5 cm on real ground), "~1.7 m apart", "12 m inside", "18 to 22 m apart" | FIXED: the lowest is exact now (DOC-5); 19 m; 16.7 to 23.4 m across the scales |

### GAME

| Id | Finding | Verdict |
|---|---|---|
| GAME-1 HIGH | The near/far handover measured at two points 16 to 19 m apart - holes and double draws wherever the eye was off the road's line, at every junction; a far pair's tree cut by a neighbour's span of its kind; the record's "a few metres" | FIXED: each pair cut in two HALVES, a tree and the lianas on its side, each instanced at its own tree's root with the pair's turn and scale - near and far faded at the same point, the cut the one every tree has |
| GAME-2 MED | The jungle's door not loaded, a pair's trees stood singly, sunk, as Logging's: two players' day's trees parted at 24 of 1,440 | FIXED: the pairs leave the worker beside the flats (PERF-2), so no loop can take them for flats; kept whole by the gate's clearing and the rocks whatever the door; the door not loaded, each tree a Tree record at its own ground, never in `pixelTrees` |
| GAME-3 LOW | One pair's file failing failed the whole door; the record's "a span that cannot stand" could not happen | FIXED: the pairs fetched settled and read each in its own try; a pair that will not read stands no halves and its trees stand as the canopy's - the door loads (pinned with `pine2.mtl` failing) |
| GAME-4 LOW | The span lit, swayed and leant at the pair's middle, not at each tree | FIXED by GAME-1: each half at its tree's root |
| GAME-5 LOW | The lianas cast no shadow; the leaning kapok's shadow and cover an upright kapok's | KNOWN, written in the record: a near tree is in no sun pass anywhere in the port - its far picture casts |
| GAME-6 NIT | The Tree-record fallback still filed pair groups as fellable | GONE with GAME-1/PERF-1: a pair's tree joins its species' group and never Logging's list |
| GAME-7 NIT | "Stands its trees as the canopy's own" (they are not Logging's); "where its span draws" | FIXED: the section rewritten |
| GAME-8 NIT | The roadside section named none of the four hosts | FIXED: a line in the section |

### PERF

| Id | Finding | Verdict |
|---|---|---|
| PERF-1 MED | Up to six more batches a road pixel, of 2 to 10 pictures each (a group a pair's kind and side) - 18 more in a 3x3 view, 142 in the clear air from outside | FIXED: a pair's tree joins its species' batch, which gives way to several handles (`lptProto` an array - `render/renderer.js` `_lptFrameOf`, `world/lowPolyTrees.js` `lptCuts`, `render/nodeGlint.js`). Measured on every 40th road pixel of the area (135) against the base without the pairs: 9 jungle-tree batches a road pixel, as without |
| PERF-2 MED | The wire 88% larger on 92% of road pixels: seven float64 columns over every flat for a median of 17 values | FIXED: the pairs leave the worker beside the flats (the kernel's `roadside`). The flats' wire as it was (581 KB a road pixel, the base's 582); the pairs beside it 1.5 KB (5.6 at most) |
| PERF-3 LOW | The door's first synchronous stretch doubled (17.6 to 31.5 ms): the pairs parsed with the five | FIXED: read after the five, a breath each. Its longest stretch at its first load 10.8 ms (median of seven fresh processes, under load) against the base's 9.8 and the snapshot's 27.7 - and a breath before the pack, which the last pair's read and the pack shared |
| PERF-4 LOW | The jungle's near draws 5 to 13 a frame | STAYS: a draw a picture a prototype is the door's law; the halves take it to at most 16 (the six halves wear 11 runs of pictures) - a fixed cost a frame, not a pixel's |
| PERF-5 LOW | The layout's cost on road pixels +0.4 ms (6%), and `nearPair` asked 9,000 times on every jungle pixel | STAYS, measured and written down: the law itself, every station asked, 0.5 ms a road pixel on the worker (1.0 at the 90th hundredth; the snapshot's 0.08 - the exact ground under the feet and the lianas is its price), the kernel's 34 ms inside its noise; `nearPair`'s comment made true (a spot off every pair's tiles is answered at once); a per-tile trunk list would save less than its code |
| PERF-6 LOW | "16 more of the jungle's trees a road pixel": the pairs' count, not the net | FIXED: the net, measured against the base: +2.4 jungle trees a road pixel (the pairs' 14 standing in for 12 of the canopy's and the young); over half the area's road pixels 6.8 pairs a road pixel, one every 150 m of road, 91% of the pixels with any |

### DOC

| Id | Finding | Verdict |
|---|---|---|
| DOC-1 HIGH | = GAME-2 | FIXED there |
| DOC-2 HIGH | ONE DFU MEMBER, ONE EXPORT: Basic Roads' GetPathsDataPoint ported a second time (`netBits`), and the path's half width given a second literal | FIXED: the member and its numbers moved whole to `world/road/pathData.js`, which the terrain worker reaches; `systems/travel/travelPaths.js` re-exports them (the same function objects - pinned); `PATH_HALF_M` derived from `PATH_HALF_WIDTH` again; VERGE1's records back on their own text, TO1's six moved with the code |
| DOC-3 MED | The sunk test read its expectations from the table: the sink flipped to floating, the burial and the headroom moved - all green | FIXED: written as numbers (0.3, 3, 2.75 m); a cliff at 2.5 and 3.5 m, a road raised in steps, a single rise of the road under a fig |
| DOC-4 MED | About 30 probe mutants alive: the stations, the tile law, the trails, the scale, the kinds | FIXED: `tools/mutants/jungleroadside.json` 81 records, all dead |
| DOC-5 MED | The sink read off the bilinear ground, which stands up to half a metre over the drawn | FIXED: `lowestDrawn` - the drawn ground's own planes, exactly (every grid point inside, every rim crossing of a grid line or a diagonal, every plane's fall); held against a fine walk on rough ground, a saddle and a valley down a diagonal |
| DOC-6 LOW | The leaning pair's `over` credited to its kapok's crown - it is the drops' | FIXED in the record and the code |
| DOC-7 LOW | = PERF-6 | FIXED there |
| DOC-8 LOW | VERGE1's ledger row still named `roadVerge.js` the band's home | FIXED |
| DOC-9 NIT | Test names listing mutants no record killed; a comment with no assertion behind it | FIXED: the file rewritten - each name's mutants are records |
| DOC-10 NIT | The gap's width at the owner's size alone; `clear: 9` a second home for the canopy's spacing; the four hosts | The gap FIXED (LAW-5); the hosts = GAME-8; `clear` STAYS: it is the pairs' own clearance, chosen at the canopy's nearest spacing - tying it to the canopy's lattice would move the pairs whenever the canopy's inset moved |

### LOOK

The LOOK lane read the snapshot's build in the running game, and its report had not come back when this page was
written. Its subject - one span a pair, drawn at the pair's middle - is the build GAME-1 replaced. The fixed build was
photographed instead (`03-World/Bantha-Jungle.md`, Verification): 14 pairs on the road south out of Ceradbu, each as
its two halves, the lianas meeting across the cut. OPEN: the lane's findings, when it reports, are written here.

### The author's

| Id | Finding | Verdict |
|---|---|---|
| A-1 | The fix's own `roadside` line split GRASS-PATH1's pinned return (`paths` must follow `nature`) and ROADS 25's pinned destructuring - caught by the run of the 276 test files the change can move | FIXED: the field after both |
| A-2 | The door's new warning counted as hard-coded English by L10N4's ratchet | FIXED: a console line, as the scan means a developer's warning to be |

## After

Tests: `test/world/jungleroadside.test.js` 11 (9 before), rewritten - every name's mutants are records; two pins of
`bantha1_jungle.test.js` moved (the kernel hands the pairs back beside the flats). Mutants:
`tools/mutants/jungleroadside.json` 85 records (37 before), all dead; VERGE1's records back on their own text in
`roadBand.js`, TO1's six moved with the code to `pathData.js`, BANTHA1's three reach records and LANDFORMS II's H3 re-aimed
by content. Code: `world/road/pathData.js` new (Basic Roads' GetPathsDataPoint, moved whole); `roadBand.js`,
`roadVerge.js`, `roadClearance.js`, `travelPaths.js` (re-exports); `jungleRoadside.js` (the halves, the converged
measures and the cells, `lowestDrawn`, `highestDrawn`, the stations' law without `edge`); `jungleModels.js`
(`readJungleSpecies`, `packJungleTrees`); `jungleNature.js` (`jungleLayout`, `pairTile`); `terrainGen.js` (`roadside`);
`jungleTreesAssets.js` (the pairs loaded on their own, a breath each); `naturePicture.js` (`pairPicture` a half);
`roadsidePairs.js` (`keptPairs`, `standRoadside` rewritten); `pixelBuild.js` (the pairs whole whatever the door, the
species' groups and batches); `renderer.js`, `nodeGlint.js`, `lowPolyTrees.js` (`lptCuts`), `contract.js` (a batch
giving way to several handles). The lanes' scripts and outputs are in the session's scratchpad, not the tree. Run: lint,
types, the bible's gates, the 276 test files the change can move (three pins my own fix moved, mended: A-1, A-2), the
real map over half the area's road pixels on the freeware's data. The fixed build seen in the running game (the record's Verification).
