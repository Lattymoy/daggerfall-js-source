# AUDIT RED-MOUNTAIN - the volcano and the Ghostfence read cold, 2026-10-27

The owner, of RED-MOUNTAIN and GHOSTFENCE (`03-World/Red-Mountain.md`), the day they were written: *"Audit this"*. Five
cold lanes read the change at `774fbff133` against its base `04da53ec54`, in a frozen worktree. Each lane was given the
owner's asks and its files, never a conclusion, and had to reproduce every finding with a node probe on the real code
(the freeware's own ground where it mattered) before reporting it. No headless game was run.

| Lane | Read | Found |
|---|---|---|
| L | the land: the law, the kernel, the snow on it, its numbers | L1, L3-L7 |
| F | the fire and the horizon: the far draw's hiding, the haze, the plume, the passes | F1-F10 |
| G | the fence's law: the places, the lairs, the spawns, the roads and the route planner | G1-G4 |
| N | the fence stood and drawn: the solid, the seats, the glow's feet, the pass order | N1-N7 |
| R | the pins and the record: the tests, the mutants, the bible | R1-R13 |

The audit found one thing no lane was asked about: **the pull request conflicted with its base in 7 files**, so no
workflow ran on it. The base carried RELIEF-PEAKS's own Red Mountain, a 3.3 km cone in `tamrielRanges.js`, beside this
change's volcano: two craters on Vvardenfell.

In the tables below, an ID under *Pinned by* names that finding's test in `test/world/audit_redmountain.test.js`.

## The owner's call

| The hole | The owner's choice | Done |
|---|---|---|
| **Two Red Mountains.** RELIEF-PEAKS's 3.3 km cone (the ranges' own, from the base) and RED-MOUNTAIN's 6.9 km volcano. | "This PR's 6.9 km (Recommended)" | The merge (`6d85e6ef46`) retired RELIEF-PEAKS's cone and kept its ranges, its canyon fix and its far views. On the base's large map the summit stands 7,333 m, the crater floor 6,508 m. |

## Fixed - the fire and the horizon (F)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| F1 | HIGH | **From a far eye the summit hid nothing.** The far draw's ray stopped at 97% of the way, so from 100 km the crater wall lay in the 3 km never asked; and the eye's own ground error was given back the whole ray, so from low land 60 km off the lake showed through the summit. | The ray asked to 300 m short of the point; the slack given back at the eye and none by the rim; the cone's crown carried (64 samples round: the profile alone missed the ground by 160 m at the rim, 30 m with it), at the steps and the crest. | `audit_redmountain.test.js` F1, F1 (the crown) |
| F2 | HIGH | **Past the streamed grid the near draw had no depth either**: lava behind the crater wall was drawn. | The cone asked wherever no depth stands - the far draw, and in the near draw past the built square about the hole (`builtCore`, `_depthBox`). | F2 |
| F3 | MED | **The plume blended unsorted**: its far face lay over its near on half the column. | Two draws a lens, its far side first (`uFace`). | F3 |
| F4 | MED | **A haze step and a double-drawn band at the world's far plane**: the near draw's fog against the ring's ramp, and 0.98 to 1 of the far plane drawn in both. | One haze law in both draws, the far ring's own (`hazeAt` = horizonHaze with the summit's hold); the far draw drops what is nearer than the far plane (`nearDrawn`). | F4/F6 |
| F5 | MED | **Four programs compiled mid-frame** on the first draw, anywhere. | The fire's and the glow's passes through `compiledPass` doors; their programs started at the boot's idle (`playPrograms.js`). | F5/F9 |
| F6 | MED | **A haze seam on the upper cone at the grid's edge**: the summit's thinner air began at it. | The thinner air eased in over 8 km past the grid's edge (`SUMMIT_HAZE.ease`, `uSummitFrom`). | F4/F6 |
| F7 | LOW | The plume hung half-drawn in an empty sky past the ring's rim. | Its alpha closed by the rim as the land is. | F7 |
| F8 | LOW | The rivers' flow jumped every 90 s (`uTime * 1.6` wrapped mid-phase). | Two whole turns a period. | F8/F10 |
| F9 = N3 | LOW | With `?redfire=off` the fence's glow was hidden by nothing. | The cone stands apart from the fire (`fireCone`, `_coneNow`); with no cone the glow has no far draw. | F5/F9 |
| F10 | LOW | The plume's foot was wider than its crater and draped the summit. | Its foot 850 m (inside the floor, lumps and all), its swell from the rim up. | F8/F10 |

Notes, no defect: no reach cull (fixed: nothing drawn when the plume lies wholly past the far lens); the profile
uploaded four times a frame (now once a program); the far field's 6.5 km plateau, the ash tint's reach and the plume lit
by raw ambient in the enhanced lane (as designed).

## Fixed - the fence stood and drawn (N)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| N1 | HIGH | **The curtain's solid was one flat quad a run** on its two feet: 20 runs open 1.8 m and more under it (worst 32.9 m), ridges burying its top; a body walked through at 22 runs and rode through at 19. The glow's curtain was the same shape. | The solid in pieces of 6.4 m at most, cut at every pixel's edge (`ghostfenceRunCuts`), each built by the pixel holding its middle from 4 m under its lowest ground to the collars over its highest, read exactly on the drawn triangles (`groundAlong`), one solid a run. The glow's curtain point by point, 8 a run, each point's ground noted by its pixel's build. Re-walked on the freeware's ground with the real collider: 3,900 crossings each way, none through on foot or riding. | N1; `ghostfence.test.js` the build |
| N2 | MED | **Flats and water painted over the glow**: it writes no depth and was drawn before them. | Drawn after the frame's flats through the renderer's one-shot slot (`afterFlats`), the world's state put back after it. | N2 |
| N4 | LOW | **Pylons buried uphill on steep ground**: 157 with ground over the plinth's top, worst 24.4 m. | Seated on the ground at the centre, a footing down to the lowest ground under the plinth (`pylonFooting`), solid too. | `ghostfence.test.js` the build |
| N5 | LOW | The glow's feet read bilinearly where the rings draw triangles (8 m and 19 m off); a pylon outside the far ring stood at y 0. | Read on each ring's own triangles (`cellHeight`); a point on no ring dropped (kind 2). | `ghostfence.test.js` the glow |
| N6 | LOW | Noted feet went stale after a frame change. | A note carries its frame and is read for that frame alone. | `ghostfence.test.js` the glow |

Notes: N7 the double-drawn band (= F4). Per-frame allocations, `uPx` from the drawing buffer, the shaft's box 0.5 m
proud - kept.

## Fixed - the fence's law, the places and the roads (G)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| G1 | MED | **42 spawned dungeons stood on the fence's line** on the freeware. | `createSpawnGround`, every spawn reader's ground, refuses the line. | G1/G2 |
| G2 | MED | **The Overworld's route planner walked straight across the fence.** | `routeGround`'s open step refused into the line but at Ghostgate (`ghostfenceShuts`). | G1/G2 |
| G3 | LOW | GROUND_ROLL_VERSION's fingerprint was blind to the fence's law. | The print mixes in its line and gate; 6 recorded anew (`1s1uba5`). | `audittesa2r_roads.test.js` R6 |
| G4 | LOW | The record's 21 places named only farms, inns and temples (3 villages and a hamlet among them), and its line in two zones (Red Mountain's alone). | The record and the pin read again: the line in Red Mountain's zone, checked. | `ghostfence.test.js` with ARENA2 |

Notes: a node on the band would open it (latent: none does); the roads' cache bump is wider than the change (the
pattern); older builds disagree with newer (the deploy's); no live places inside (TESA undeployed).

## Fixed - the land (L)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L1 | MED | **Snow lay on the volcano**: the heat cancelled only the cone's own height, the plateau under it froze, and on the coldest day the crater, the rim and the flank lay 100%, 98% and 99.9% white. | Each snow lattice point's lines lifted to bare ground by the share of Red Mountain's zone about it (`ashShareAt`, `bareLine`, `snowCoverHost.js`): 0% white. | L1 |
| L2 = R3 | MED | "No place on the summit cone" was false: 8 lairs stand within 12.6 km - Dagoth Ur's strongholds, lore-true. | The record and the pin's title say so (no town, farm or Arena place). | `redmountain.test.js` with ARENA2 |
| L3 | LOW | The slopes' figures did not reproduce. | Re-measured: 29 degrees under the rim, 12 at 7 km past it, 3 at the fence. | the record |
| L5 | LOW | Carved water within the reach would cut the cone away (none today). | Pinned: none within the reach on the freeware. | L5 |
| L6 | LOW | `namedSummit` (the volcano's centre) read `Math.hypot` - a ground source under A8. | Squared distances. | L1/L6 |

Notes: L4 the levels' count moves other mountains' snowlines (an old off-by-one, unmoved); L7 a foyada bank open on one
side at 5 of 600 samples (the trough's fade, kept).

## Fixed - the pins and the record (R)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | HIGH | The plume's billows, puffs, body, light, fire and day, and the glow's strands, night and fade unpinned; the billows' one check moved a foot the function never read. | Their GLSL factored into named functions (`puffOf`, `bodyOf`, `litOf`, `emberOf`, `curtainOf`), each pinned; the billows about the foot pinned on the column itself. R1. |
| R2 | MED | `redmountain.json`'s rim's crest marked equivalent: it is not (an eye 20 km out on the flank). | Unmarked: the crest's own test decides 198 of 2,640 rays round the mountain; killed by R2's pin. |
| R4 | MED/LOW | Three checks asked nothing: the mean ground against itself, the kernel against a landforms of the same law, the glow's margin with a point built from it. | Replaced by the law past the reach to the bit and a land fall of 160 m with its control; the first removed. |
| R5 | LOW | The gullies unpinned. | R5: none at the rim's lip, within their depth, varied round, none past their reach. |
| R6-R9, R11 | LOW | "Drawn last of the far ring's pass" stale; "97 m" did not reproduce; titles claiming zones their bodies did not check; PIN MOVED lists incomplete; the orb's height and the towers'. | The record (`Red-Mountain.md`, `Rendering.md`) and the titles corrected; the far views' crater re-pinned (the merge had moved its pin off it). |
| R10 | NOTE | Levitation passes the fence. | Lore-true; the record says so. |
| R12, R13 | NOTE | Kills by a regex alone; version pins. | Kept: the wiring's own law. |

## The record

Every fix is pinned by a test that fails on the code as it stood (`test/world/audit_redmountain.test.js`, 16, one gated
on ARENA2; `ghostfence.test.js` and `redmountain.test.js` where their pins moved), with a mutant in
`tools/mutants/audit_redmountain.json` (51 records). Records in other lists whose text the fixes moved were re-aimed
by content: `audit_farsea1.json`, `audit_perfpass.json`, `aurastall.json`, `eldistance.json`, `ghostfence.json`,
`ow4j.json`, `owwod.json`, `peaks1.json`, `redmountain.json`, `spawnshore.json`, `tamrielrelief.json` and
`wilddry.json`.
