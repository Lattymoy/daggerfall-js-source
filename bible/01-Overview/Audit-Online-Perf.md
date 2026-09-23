# AUDIT ONLINE-PERF (2026-09-19) — the performance branch, before merge

Mac: *"Lets audit this before merging"*, over PERF-ON2, PERF-CPU,
PERF-FLICKER, PERF-LIGHTS, PERF-CROWD, PERF-BASIS and PERF-CROWD2 — the
branch answering *"the more people that are online, the worse fps
becomes"*.

Method: the diff read adversarially with one question in front —
**what did moving this break that nothing will notice?** — then the
claims put on trial by something that can fail them. Four findings; two
fixed, two recorded.

**The headline: the largest change in the branch introduced a silent
correctness bug, and no pin in the tree could see it.**

---

## F1 — PERF-CROWD2 stopped refreshing the texture key of everything it culled. FIXED.

The cull went in at the top of the opaque partition:

```js
for (const b of batches) if (!spectral && !conceal) {
  if (bbCull && !this._bbVisible(b)) { culled++; continue; }
  keyOf(b); opaque.push(b);          // ← now skipped for culled batches
}
```

`keyOf` is not this pass's private bookkeeping. **Two other passes read
`b._bbKey`** — the shadow replay (`shadowPass.js:1064`) and the air pass's
emitters (`airPass.js:1129`) — and both take it as it stands:

```js
const key = b._bbKey ?? (b.frame == null ? `${archive}_${record}` : `${archive}_${record}#${frame}`);
```

`??` fires only when the key is **absent**, never when it is **stale**.
So a batch culled from the camera kept the key it had when it was last on
screen, for as long as it stayed off camera. And a mobile animates by
writing its RECORD (MAC4) — so an off-screen foe would cast the
silhouette of whatever frame it was on when it left the view, or none at
all once that texture was gone.

The shadow cascades reach 240 units. **Off screen is exactly where those
casters live** — the whole reason the cull records before it culls.

`keyOf` now runs before the test. It is a few comparisons and mints a
string only when something actually changed, which is what PERF3 built it
to be.

**Nothing in 9,000 tests could have caught this**, because the key is
only ever observed through a texture lookup two passes away. It was found
by asking what else reads the thing the cull skips.

## F2 — a per-light range array shorter than the light list is a silent NaN. FIXED (pre-existing).

`nearestLights` takes the animated ranges as a parallel array:

```js
out[i * 4 + 3] = perLight ? perLight[_selIdx[i]] : range;
```

Past the end of `perLight` that is `undefined`, which lands in a
`Float32Array` as **NaN** — and a NaN far plane goes on to
`pointFaceMatrices` and to the shader's depth reconstruction, where it
fails silently and totally. The world host sizes its `CityLightAnimator`
at 4096 lanterns and **nothing checks the light list against it**: a
cliff with no edge marked.

Not caused by this branch — PERF-LIGHTS passes the same array the same
way — but the branch is what put a count beside it and made the question
visible. Guarded with the module's own default range, which is what an
unanimated lantern is anyway. The pin holds both sides: past the end it
is the default, inside it the array's own values are untouched, and a
legitimate **zero** range is not overwritten (the obvious `w ||` spelling
would have, and that mutant dies).

## F3 — the lantern pool never shrinks. RECORDED.

`_sceneLights` grows to the largest lantern count the session has seen
and keeps those objects for the life of the world. A dense city then a
long ride leaves a few thousand `{x,y,z}` retained — on the order of a
hundred kilobytes, against the megabytes a single terrain pixel holds.
Recorded rather than fixed: shrinking it costs a re-mint the next time
the player walks back into town, which is the allocation PERF-LIGHTS
exists to remove.

## F4 — the shadow replay still culls by the UNLIFTED sphere. RECORDED, then **CLOSED by GHOST1 (2026-09-19)**.

PERF-CROWD established that the stored sphere is centred on the
placement point while the sprite stands its full height above it, so it
does not contain anything taller than it is wide. The main pass lifts the
centre; `batchVisible`, which the shadow replay and the air pass use,
does not. Left alone on the record: a shadow clipped at a cascade edge is
not a head disappearing, and changing it moves EL5's pinned culling
counts. Stated here so the inconsistency is a decision and not an
oversight.

**CLOSED, same day, by the field rather than by this argument.** GHOST1
found that the inconsistency this row decided to keep was not a
cosmetic one: the main pass and the emission replay answering different
questions about the same sprite is what produced Clerical Error's
"ghost campfires" - the main pass dropped a flat the emitters kept, and
what was left on screen was the bloom of a sprite that never drew. The
lift lives in `batchVisible` now and the two hand-written copies
delegate to it, so all four readers agree. EL5's counts moved and were
re-pinned with it.

The reasoning above was sound about shadows and wrong about the
consequence, because it weighed only the cost it could name. Kept as
written, with this note, because "a decision that turned out to be a
bug" is worth more on the record than a tidy one.

---

## What was put on trial, and what it answered

| Claim | How it was tried | Answer |
|---|---|---|
| the pass-level cull tests the right SPACE | traced `b.origin` for world flats: `b.origin = t`, the pixel translation, with `bounds` pixel-local | consistent — and `batchVisible` has used the same `bounds + origin` for months, which proves it |
| culling cannot break shadow casting | `recordBillboards` runs before the planes are taken; a mutant that moves the cull ahead of it dies in three suites | holds |
| the panel bracket cannot poison the planes | planes recomputed per CALL, not cached on the frame stamp | holds by construction |
| `?cull=off` still turns everything off | read once at construction, mutant dies | holds |
| the flicker quantum swallows the whole wobble | the real `CityLightAnimator`, 600 frames, one far plane | holds |
| the pooled lantern selection is identical | 60 random towns, both ways | identical |
| nothing else reads what the cull skips | grep for `_bbKey` outside the renderer | **two passes did — F1** |

**Pinned** in `test/perfon2_peercull.test.js` (12). Mutants
`tools/mutants/perfon2.json`: 31 — 31 dead, 0 survived.

## The lesson

Every fix in this branch was a *removal*: stop submitting, stop
rebuilding, stop allocating, stop uploading. F1 is what removal costs —
the culled batch was still carrying something two other passes needed,
and the only way to find that was to ask who else reads what I stopped
touching. **A cull is not free just because the thing it skips is
invisible.**
