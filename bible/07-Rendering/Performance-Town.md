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

## Still open

`world` is the other spiky zone (2.25 → 8.51) and is untouched here.
And `shadow` reads **0.00 ms** on the CPU clock while the GPU run
reports ~1,700 shadow draws a frame (`sun 3c/~300d`, `lanterns
6k/18f/~1,400d`) with 14–22k cull tests. The `shadow` span does wrap the
submission, so 1,700 `drawElements` calls reading as zero JS does not
add up. Both are named here rather than guessed at.
