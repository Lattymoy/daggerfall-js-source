# AUDIT WORLD-2 PHASE 0 - the dependency and compatibility audit (2026-10-31)

The specification's mandatory first deliverable (`03-World/World-2-Arc.md`, Phase 0): what World 2.0 builds on, who owns
what, where the sources of truth conflict, the risks to persistent data, and the baselines. Four read-only reads, one a
domain: the terrain pipeline, the Tamriel geography, the places and buildings, and the repository's gates.

## The terrain pipeline

A pixel is 819.2 m and 129 x 129 samples (`terrainSampler.js`). The kernel sums the small byte's bicubic times 8, the
large map's times 4 and a ground noise; with landforms on, `landforms.js` `pixelShaper` shapes each sample past the Bay
(lift, ranges, landforms, roads' ease, waters' carve, Red Mountain, sites' pulls). The kernel reads a reader's two
primitives, `getHeightMapValue` and `getLargeMapData`; `groundWoods` composes the continent over the Bay's file.

Each worker rebuilds its own composition from flags (`terrainGenWorker.js`, `deepWatersWorker.js`, the roads worker),
and some readers build `groundWoods` over an empty Bay. So an outer reader is bypassed; every path ends in
`tamrielHeightByte` and `tamrielLargeMap`. That is the seam (WG-1). Collision is the built samples; the relay computes no
ground and gates on `GROUND_LAW`. Saved heights carry `GROUND_FRAME_LAW`.

## The geography

The continent is the Bay's grid extended; picture units are fitted to the player's own map at boot (freeware: picture
(38, 57) at 15.5 a unit, which the manifest records). The trace is built from the player's files and never ships. The
owner's relief (640 x 400) ships. Twelve authored ranges, ten carved Cyrodiil rivers and three lakes exist; no
precipitation, geology, soil or drainage did. Biomes were zones chosen by province and seed. `Math.hypot` is used in
zone selection, so a gameplay field built on it can differ in its last bit between engines.

## Places and buildings

`worldPlaces` holds one place a pixel; past the Bay towns are rolled and laid from Bay templates, still RMB. A building
is a key `(bx << 16) + (by << 8) + rec`, unique only within its town and its layout: a pack's layout gives a key to
another building, which `layoutPins.js` guards with a layout stamp. Doors and interiors need a block and a record.
Persisted keys: the account service's homes, decor, rooms, yards, votes and offers by `(map_id, building_key)`; the
relay's interior rooms; the save's deeds, rentals, quest sites, recall anchors and discovery.

## Source-of-truth conflicts and their resolutions

| Conflict | Resolution |
|---|---|
| The live coast is the player's trace; a shipped bake may not read it | Bakes read the authored canon and stay inland (WG-3, WG-7) |
| The fit moves with the player's picture | The manifest records the freeware's fit; a bake on another fit is refused |
| A building key names another building under a pack's layout | Legacy ids carry the layout stamp (WG-9) |
| Generated ground could move saved heights | Publishing raises `GROUND_LAW` with a moved field (WG-5) |
| Rivers are narrower than any feasible cell | Rivers are vectors, carved by the client (WG-6) |

## Baselines (`node tools/wg2Measure.mjs`, this container)

| Region | Cells | Bake, gzipped | Decode | Byte read, none / one | Shaper's read | Sampler height |
|---|---|---|---|---|---|---|
| hammerfell-test (192 x 192 px) | 147,456 | 1,151 KB | 66 ms | 7.96 / 8.28 us | 1.95 us | 1.56 us |
| blackmarsh-test (96 x 96 px) | 36,864 | 257 KB | 35 ms | 7.47 / 8.13 us | 1.29 us | 1.13 us |

A byte read here is uncached (the ground's cache is dropped each call). A pixel's 16,641 shaped samples in a region add
about 30 ms to its build on a worker; outside a region the shaper's read costs 36 to 63 ns. The bakes take 13 s and 3 s
offline. The frame-time budgets of the specification's section 5.3 need a browser probe on representative hardware;
none ran in this container, and none is claimed.

## In a browser (`node tools/wg2Bench.mjs`, this container, 2026-10-31)

Chromium on SwiftShader (software GL, four cores), the 3 x 3 pixels about (1100, 430), 360 frames an arm:

| Arm | Script a frame, mean / p95 | Gap between frames, mean / p95 | Heap | Pixel build, mean / max | Errors |
|---|---|---|---|---|---|
| Without a region | 9.6 / 39.2 ms | 791 / 2,712 ms | 813 MB | 278 / 681 ms | 0 |
| With `hammerfell-test` | 13.5 / 58.0 ms | 688 / 2,285 ms | 832 MB | 569 / 1,960 ms | 0 |

The gaps are the software renderer's, so only the arms' difference is read here. The region adds about 4 ms of script a
frame and 20 MB of heap, and doubles a pixel's build. The sampler's own reads for a pixel's nodes take about 16 ms of
height and 12 ms of climate in node, so most of the build's rise is elsewhere - the region's rougher, wooded ground or
the seam's reads in the build - and is not yet profiled. Hardware budgets are still not claimed.
