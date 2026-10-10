# PERF-TOWN1 — the town loop was minting a frame's worth of garbage

*2026-09-20. Mac: "I noticed ingame the exterior is really heavy rn",
then "I'd rather not keep testing and go ahead and make performance
improvements".*

## What the readout said

`?perf=cpu`, outside, seven lines. The two extremes:

```
cpu 19.12ms | world 8.51 | people 7.36 | sim 2.06 | flats 0.51 | batches 0.28 | sky 0.14 | air 0.14 | grass 0.12
cpu  9.30ms | sim 2.54 | world 2.45 | people 1.90 | flats 1.10 | batches 0.68 | air 0.31 | grass 0.20 | sky 0.12
```

Three things fall out of that before a line of code is read.

**The exterior is CPU-bound.** Nine to nineteen milliseconds of
JavaScript against a ~19.7 ms frame. That answers the question actually
asked — *"so it's the AF that's causing real performance issues?"* — as
**no**: anisotropic filtering is paid in GPU fill rate, and there is no
GPU time to pay it with. (The `?perf=zones` run returned `gpu n/a` on
every line: the browser has no `EXT_disjoint_timer_query_webgl2`.)

**`sim` is steady at 2–3 ms.** `spendRestrides()` lives inside it, so
STREAM1's terrain queue is doing its job and the grid rebuild is not the
spike — which is worth recording, because the benchmark that broke the
deploy that same afternoon was about exactly that cost.

**`people` swings 1.14 → 7.36.** And:

> A zone that varies fourfold frame to frame is not doing four times the
> work. It is minting garbage and meeting the collector.

## The count

Per person, per frame, the town loop allocated:

| # | what | where |
|---|---|---|
| 1 | `` `${record}#${frame}` `` | the batch's record key |
| 2 | `` `${archive}_${rkey}` `` | the texture-cache probe |
| 3–4 | `getSize()`, `getScale()` records | inside `mobileBillboardSize` |
| 5 | `scaledBillboardSize` result | " |
| 6 | `{ w, h }` | `batch.size` |
| 7 | `[x, y, z]` | `batch.origin` |
| 8 | `{ person, pos }` | the activation row |
| 9 | the `personWantsToStop({…})` argument | the stop question |
| 10 | the `enemiesNearby` closure | " |
| 11 | `{ record, frame, flip }` | `MobilePerson.update`'s answer |
| 12 | `{ person, out }` | `TownPopulation.update`'s row |
| 13 | `const out = []` | " (per pixel) |

**Thirteen, none of which outlived the frame.** At sixty townspeople and
sixty frames that is ~40,000 allocations a second out of one loop.
`exterior.js` managed one more: `_livePersons = live.map(…)` rebuilt the
activation list *and* a row for each person, every frame.

## What changed

Nothing about what the code computes. Every value below is the same
value written into the same seat instead of a new one.

- **`mobileBillboardSize` caches per texture, per record**, in a
  `WeakMap` keyed on the texture object. A sprite does not change size
  while you watch it. Keyed on the *object* and not the archive number
  because a replacement that swaps the file in is then a different entry
  — there is nothing to invalidate and no table to grow. The **XML scale
  stays live**: it reads a per-vendor predicate, so a mod toggled in the
  settings menu is seen on the next frame.
- **`batch.size` and `batch.origin` are written through.** Both are read
  by value at the draw and by the bounds, and nothing holds either
  across a frame.
- **The activation rows and the pool's list are refilled**, not rebuilt.
- **`MobilePerson.update` answers into that person's own row** — one per
  person, not one shared by all of them, because the host collects every
  row first and reads them after.
- **The stop question's options and its closure are hoisted.** The four
  terms that do not vary by person were also being re-read for each of
  them; they are read once per pixel per frame now, and still *every*
  frame, so a sheathed weapon or a beast form that changes is seen at
  once.
- **`Math.hypot` → `Math.sqrt(dx*dx + dz*dz)`.** hypot is written to
  survive overflow at the extremes of the float range and charges for it
  on every call; these are two world coordinates a few hundred units
  apart.
- **The texture key is memoised** on the three numbers it is made of.

`rkey` itself stays a literal template at all five mobile producers:
MAC4 pins that shape across every one of them, and a memo in one of five
would make that pin lopsided for the smallest of these wins.

## What is pinned, and what deliberately is not

The pins are about **identity and re-reading**, not about speed. There
is no timing assertion here on purpose — a wall-clock ratio on a shared
runner is what took the deploy red the same afternoon (see STREAM1), and
"no new object" is both the claim that made the frame cheaper and the
one a machine cannot be moody about.

The sharpest of them is the texture key: the whole win is a cache *hit*,
so a key differing from the uploaded one by a single separator would
miss every frame and re-upload every frame — slower than what it
replaced, and invisible. It is pinned byte-for-byte against the string
the uploader writes, and the numeric index is pinned injective **over
its fields** (1024 frames to a record, 4096 records to an archive) —
which is the honest claim, since a record of 4096 really would land on
the next archive's slot. A classic archive has tens of records and a
handful of frames, three orders clear.

Campaign `tools/mutants/perftown1.json`: 15 mutants, 15 dead. One
survived the first run — dropping the frame from the key index, which
freezes a walking sprite on whatever was uploaded first — because the
pin tested a local copy of the index rather than the host's own line.

## Two things this change got wrong first

**A temporal dead zone, and a real one.** The scratch is built near the
top of each scene; the foe pools it asks are `const`s declared hundreds
of lines below. Handing the pool function over directly reads it in its
dead zone and throws *"Cannot access 'enchantFoes' before
initialization"* the moment the scene runs — the exterior would not
have booted at all. Lint passed. The vite build passed. The whole suite
passed. `test/tdz.test.js` is the one thing that caught it, which is
exactly what it was written for. Both hosts wrap their pool in a thunk
now, and a mutant holds the shape.

**The first cut put the scratch inline in both hosts** — about fifty
lines in `world.js` and thirty in `exterior.js`, in the middle of the
two most heavily *cited* files in the port. Every line number below the
insertion moved, `citeShift` could content-resolve most of them but not
the generic ones (`say: (l) => townTalk.say(l)` appears six times in one
file), and the tail took dozens of comments re-pointed by hand.

Extracting the scratch to `scenes/townScratch.js` cut the shift from
+82/+110 lines to +28/+30 — and it was the better factoring anyway,
since the two hosts had the same scratch twice. **The module header says
this out loud**, so the next person to add a block to a host knows what
it costs.

## PERF-COL1 - THE SPHERE RESOLVE WALKED EVERY BUCKET (2026-09-21)

SquidKam, on Discord: *"Guards kill the framerate too / I think thats a
sound issue right? cause the guards have some null sounds / its an issue
in current DF / So the fix is easy. Guards are trying to use their 2nd
and 3rd sounds which are null."*

**The sound hypothesis was read first and does not hold here.** The
watch's row is DFU's own - move 243, bark 456, attack 245 - and the port
plays them through `characters/enemySounds.js` (EnemySounds.cs whole:
the 3-9 s attract cadence, the city watch the one class enemy the human
mute spares). A clip whose DAGGER.SND record is missing or empty costs
one lookup: `audio.js`'s `_buffer` caches the null and every later ask
is a Map hit. Whatever classic does with a null sound, this port's
guards do not stall on one.

**So the frame was measured instead.** `tools/guardCostProbe.mjs` stands
five watchmen (MAX_ACTIVE_GUARD_SPAWNS) on the real `EnemyAI` over the
real `Collider` holding a synthetic town - a grid of building boxes on a
flat ground, one bucket a building - with the target machine and the
sound source's clock, chasing a player who walks a circle, and counts
what the collider is asked:

```
144 buckets: frame ms median 5.457  p90 20.282  p99 23.424  max 64.764
 49 buckets: frame ms median 3.110  p90  6.922  p99  9.602  max 38.381
collider calls per frame: move 1.9  _resolveCapsule 10.2  _resolveSphere 91.8
                          raycastHit 119.5  raycast 5.1  capsuleCast 4.1
```

`--cpu-prof`: **71.5% self time in `_resolveSphere`, 13.3% in
`_resolveCapsule`**, 6.8% in `raycastHit`, nothing else above 2%.

**What it was doing.** `_resolveSphere` walked EVERY bucket for EVERY
sample - `for (const [bkey, bucket] of this._buckets)` with no test at
all - and for each bucket built nine string keys, did nine Map lookups
and minted a fresh `Set`, whether or not the bucket was anywhere near
the sphere. A capsule resolve is ~9 samples (the bead chain, COL1) and a
step is up to ~5 resolves (the step-up ladder), so five bodies asked it
~90 times a frame, and each ask was priced by the whole world's bucket
count: the streaming world's bucket per streamed pixel plus the gates
and the mills, the standalone town's bucket per block. `sphereOverlaps`
had the same walk. The RAY had been given a broad phase in AUDIT NAME1
F2 - the bucket's own bounds, kept per vertex by `addMesh` - and the
sphere had not.

**What changed.** `sphereTouchesBox` (collider.js, beside
`segmentHitsBox`): the sphere's box in bucket-local space against the
bucket's bounds, BOX_SKIN wide, asked once per bucket before the cells
in both sphere walks. It is exact by the same argument as the ray's: the
bounds enclose every triangle, so a triangle can only come within the
contact radius of a centre whose own box overlaps the bucket's, and the
narrow phase's own distance test would have dropped everything the skip
drops. It is asked with the centre AS IT STANDS at that bucket's turn -
the local point is LIVE per triangle below it, because pushes compound,
and that stays - which is still exact: a bucket's first contact can only
be made by the un-pushed centre, so a bucket the un-pushed centre cannot
reach never pushes it. The visited set is one module scratch cleared per
bucket. Nothing in the narrow phase moved.

```
144 buckets: frame ms median 0.712  p90 1.802  p99 8.403  max 18.414   (was 5.457 / 20.282)
 49 buckets: frame ms median 0.347  p90 0.915  p99 4.002  max 10.368   (was 3.110 /  6.922)
```

Seven to eight times less, and the same cut reaches everything the
collider moves - the player's own capsule, every exterior foe, every
peer body online, the dungeon's foes over their one big bucket less so.

**Pinned** in `test/perfcol1.test.js` (6) as a DIFFERENTIAL AGAINST THE
OLD WALK ITSELF: a twin collider with the same triangles in the same
buckets in the same order and every bucket's bounds widened to infinity
- its broad phase passes everything, which IS the old walk - must answer
every move of a 1,440-move sweep over the town bit for bit the same,
with world-space and translated buckets alike, and every `sphereOverlaps`
too; the WORK, counted per bucket: the old walk touches all 37 buckets
for a body on the street, the new one at most 4 and never the sky
platform forty units up (the box is three-dimensional); the scratch set
cleared per bucket (a wall bucket whose triangles carry the same indices
as the floor bucket's still stops the capsule); `sphereTouchesBox`'s
edge, skin and empty-bucket cases; and the source laws (the live local
point per triangle, the test before the cells, no `new Set()` in either
sphere walk). Mutants: `tools/mutants/perfcol1.json`, 9, 9 dead - the
walk put back, the test inverted, the skin dropped, the y and z terms
dropped, the set never cleared, the empty bucket walked. The campaign
was run on a GREEN file (the first run was not - a wall check in the
sweep had started inside the wall's skin - and was re-run).

**Not measured here, said plainly:** the real town's bucket count and
its triangle density, on Mac's machine, under `?perf=cpu`'s `people`
zone. The probe's town is synthetic and the numbers above are node's.
The read that this is the `people` spike's collider half - the guards
are the first bodies a crime puts on the collider in numbers - is a
reading of the profile, not of a live frame.

## FB0930-FRAME - EVERY RAY ASKED EVERY DOOR (2026-09-30)

A player's Chrome performance trace (a save loaded into a dungeon, the
desktop app, 4.06 s sampled): frames of ~151 ms, 841 "requestAnimationFrame
handler took" violations. By function, over the trace: foe `update` 2,126 ms,
of it `_obstacleCheck` 1,891 and `_findDetour` 1,660 - DFU's detour sweep, up
to eight directions a step at one or two 27-ray capsule casts each - and under
the casts `raycastHit` 1,698 ms total. The self times say where a ray's time
went: `raycastHit` 837, `segmentHitsBox` 488, the default translation closure
`() => ZERO3` 127, and `rayTriangle` - the test the rays exist for - 196. The
per-BUCKET cost outweighed the triangles. Every action door, lever and platform
is a collider bucket of its own (actionSystem.addDoor/addAction), and every ray
and sphere asked every bucket its box.

The trace's chunks (`world-B12a4DIS.js`, `viewSettings-BhvIvYj7.js`,
`main-hdY2IwOH.js`) match a local build of `af8709446` byte for byte in name:
the build BEFORE FB0930-FOE-RAYS. Both release-desktop runs after that merge
failed - run 179's publish step on `unexpected end of JSON input` from the
GitHub API with every installer built and staged (draft `app-v0.1.4974` left
over), run 180 with no runner acquired - so the newest published app was
`app-v0.1.4970` and the ray fix never reached the player.

The fix (player/collider.js), every answer bit for bit the old walk's:
- **The buckets filed by broad cell.** A bucket that stands still (no
  translation provider, no turn) is filed on an 8-unit XZ grid by its box
  (`buildBroad`); a query asks the ones filed under the cells its own world
  box covers (`_near`). Movers, and buckets over 64 cells (the dungeon's own, a
  massif) or not finite, are asked by every query. Candidates are sorted back
  into the Map's order, so ties and the order the sphere's pushes land in are
  the old walk's. The filing is a cache: `removeBucket` drops it. A query box
  over 256 cells walks everything, as before. (PERF-COL2, 2026-10-10,
  `Performance-Priority.md`: a mover riding a floating frame - a streamed
  pixel's bucket - is filed while its frame stands, a bucket too wide for these
  cells is filed on 256-unit ones, and `addMesh` files its bucket into a
  standing filing; a mover that turns or rides nothing, and a bucket too wide
  for both, are asked by every query.)
- **The sphere resolve's centre moves while it walks** - a push lands and the
  next bucket's box test reads the centre as it stands. Its candidates are
  gathered with the box grown by `BROAD_PAD` (1 unit) and gathered again,
  after the last bucket walked, when the pushes carry the centre past it -
  asked before the list's end, which the comb pin found (the last candidate's
  pushes can carry it to a bucket the list never held).
- **The sphere walks take the ray's stamp and a Y reject** (`_resolveSphere`,
  `sphereOverlaps`, `capsuleContact`): a triangle wholly more than the contact's
  reach above or below the live centre is rejected before its closest point.
  Marked seen first, as the Set was added to.
- **The marks' epoch.** FB0930-FOE-RAYS' stamp zeroed only the bucket being
  walked when the count wrapped (2^31 walks); every other bucket kept marks a
  later stamp would meet again. A wrap now starts an epoch and each bucket is
  zeroed the first time it is walked in it.
- **capsuleCast with no axis casts one sample.** The clear-path probe
  (`_clearPathToPosition`) casts from the centre to the centre with the default
  three samples: 27 rays, 18 of them the first nine again.

Measured (node, a synthetic dungeon bench in scratch: three stacked levels in
4 m tiles, ramps, walls with doorways, 150 door buckets baked into the world as
actionSystem registers them, 30 pursuing EnemyAI, 600 frames at 60 Hz):
`af8709446` (the trace's build) 17.4 ms a frame, p95 31.0; main with
FB0930-FOE-RAYS 13.9, p95 23.7; with this 2.35, p95 3.9. Every foe's final
feet and yaw and 400 mixed probes (capsule cast, overlap, contact, move)
identical across all three builds. With no door buckets the same bench is 6.2
ms on main and 2.4 with this - the sphere walks' stamp and Y reject; the
filing takes the other 7.7 ms the doors cost.

Pinned: test/fb0930_frame.test.js - 1,200 probes of every query against the
same collider with every box widened past the grid (the old walk), the work
(27 x 63 bucket asks for one probe before, at most 27 x 12 after), the tie
order for a filed and an unfiled bucket both ways and after a re-registration,
the filing following a new, a grown and a removed bucket, the comb of walls
that carries a sphere over a broad cell's edge, the skin shell against the Y
reject, the wrap, and the nine rays. Mutants: `tools/mutants/fb0930_frame.json`,
10, 10 dead; `perfcol1.json`'s never-cleared set re-aimed by content to the
stamp never bumped, 9, 9 dead.

**Not measured here, said plainly:** a real dungeon's door count, on the
player's machine. The trace is the build before both fixes; the next trace
from a build carrying them is the measurement.

## Still open

PERF-COL1 above took the collider half of `people`; the rest of that
zone's per-guard frame (the senses' 24 `raycastHit` a frame per body - EnemySenses' per-FixedUpdate CanSeeTarget, parity) is unmeasured on a real town.

`world` is the other spiky zone (2.25 → 8.51) and is untouched here.
**PERF-RIG1 (2026-09-21, `Performance-Rig.md`) opened it**: three spans
of the host's frame, and in them the Morrowind rig's CPU geometry
pipeline per body per frame, minting ~156 KB a skinned piece per call.
And `shadow` reads **0.00 ms** on the CPU clock while the GPU run
reports ~1,700 shadow draws a frame (`sun 3c/~300d`, `lanterns
6k/18f/~1,400d`) with 14–22k cull tests. The `shadow` span does wrap the
submission, so 1,700 `drawElements` calls reading as zero JS does not
add up. Both are named here rather than guessed at.
