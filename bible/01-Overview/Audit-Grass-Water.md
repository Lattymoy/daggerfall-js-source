# AUDIT GRASS-WATER (2026-09-19) — the four-bug slice, before merge

Mac: *"audit before merging"*, over GRASS-PATH1 / GRASS-WET1 / PERF10 /
PERF11 / WATER-DRAW1 — the branch answering his four-bug report.

Method: the diff read adversarially, then each claim put on trial by
something that can fail it — a brute force where the code computes a
bound, a fuzz where the code states an invariant, an end-to-end run
where the code claims a user-visible fix, and a 21-mutant campaign over
the pins. Six findings; four fixed, two recorded.

**The campaign found more than the reading did.** Five of twenty-one
mutants survived the first run — five pins that could not fail the bug
they were written for. That is the finding behind the finding: the pins
were written alongside the code and inherited its blind spots.

---

## F1 — the slot bound was two cells short, and nothing recovered from it. FIXED.

`discSlotCount` swept 8x8 offsets inside a cell and answered **392** for
the shipped span. A brute force at 240x240 answers **394**, and the peak
sits at offset **(0, 6)** — x exactly ON a cell boundary, where two
columns have a nearest-edge distance of zero and the row count jumps. A
coarse sweep steps straight over it.

This was a regression, not an inherited flaw: the square window PERF10
replaced was exactly tight (22 x 22 = 484 = its own slot count). And
`update` had no recovery — an empty `free` list simply `break`s, so the
cell stays unplaced for as long as the eye stands there: a 30 m hole in
the grass with nothing to fill it.

**Not observed.** Orbits at eight radii, a lawnmower over the whole
offset square and a 4,000-step random walk all topped out at 379 live
against 392 slots. Latent, not reachable by any walk tried.

Fixed at both ends, because the second is the one that matters:

- the sweep is 240 and the inner loop is O(columns + rows) per offset
  instead of O(columns x rows), so the finer sweep costs *less* than the
  coarse one did (24 ms, once per world);
- `update` **evicts** rather than breaking: `want` is sorted
  nearest-first, so the nearest waiting cell takes the farthest standing
  one's slot, and the walk stops only when every slot already holds
  something nearer. The invariant is no longer "the bound is right" but
  **the field holds the nearest `slots` cells**, which no bound can
  break.

The pin brute-forces the true maximum inside the test rather than
hardcoding a number — a hardcoded expectation would have been written to
match the wrong answer. A test seam (`slots`) lets the pin starve the
field for real, because a guarantee no pin can starve is a sentence
rather than a law.

## F2 — the path mask is eight times bigger than it needs to be. RECORDED, NOT TAKEN.

One byte a tile is 16 KB a pixel. At the enhanced lane's maximum land
view (radius 6, 169 pixels) that is **2.6 MB** resident and 16 KB per
pixel across the worker wire — added, awkwardly, by a fix in the same
report that complains about memory far out in the wilderness. A bitset
is 2 KB (330 KB at maximum land view).

Measured before deciding, in GRASS4's manner: a pixel already carries
66 KB of samples, 16 KB of tilemap bytes and its grid, so the mask is
about **4%** of what a pixel holds. A bitset trades 2.3 MB at maximum
settings for an off-by-one risk in a per-blade read that runs 6,122
times a cell. Recorded here so the next reader sees it was weighed, not
missed; revisit if a land-view rise makes pixels the cap.

## F3 — a town's own streets carry no mask. RECORDED; PRE-EXISTING, NOT THIS SLICE'S.

`paintRoads` skips any tile a location already wrote, so a town's paved
streets are never marked and grass still grows on one whose RMB ground
record reads as grass to `grassRecordsOf`. Unchanged by this work and
not what the report was about. Recorded so nobody reads the mask as
covering towns. The fuzz pins the boundary explicitly: **zero** marks
ever land on a pre-seeded location tile.

## F4 — PERF11 also closes a latent inconsistency. RECORDED AS STRENGTHENING.

`peersNear()` reads `performance.now()` itself, so the foes' prune and
the camps' sweep could get two different liveness answers inside one
frame. One memo gives one answer — which is what AUDIT WORLD6b-ii C2
("ONE liveness for the owner") asked for. Not a bug fixed by accident;
worth stating, because the change reads as a pure micro-optimisation and
is slightly more than that.

## F5 — `update`'s return value was mis-described. FIXED (the comment).

It returns the cells that were MISSING when the update began, not the
cells "still pending" after the fill. GR5's comment said the latter and
the number never meant it. The one caller ignores it; the comment now
says what it is.

## F6 — the WATER-DRAW1 comment claimed something the tree cannot check. FIXED.

The first draft said record 9 "is water art". This container has no
ARENA2 — nothing here has looked at a single texel of record 9. What the
tree CAN say is where it sits: the water-dirt group runs 5-8, 10 begins
the dirt-grass ring, and 9 is the one record between them that neither
the shore families nor DFU's motor list covers, which makes it the only
candidate nameable from here. The comment now says that, and says what
being wrong looks like from the other side: a shimmer over a dry tile
instead of a flat wet one, one entry to revert.

---

## What was put on trial, and what it answered

| Claim | How it was tried | Answer |
|---|---|---|
| the mask is exactly the painter's writes | 400 random road/track/river/stream/corner/rect/ground fixtures | 819,066 marks, 819,066 writes, 0 disagreements |
| the mask changes nothing | the same 400, painted with and without it | 0 differing tilemap bytes |
| the mask never marks a town's own tile | 300 fixtures over a pre-seeded 48x48 location | 0 |
| the fix actually clears a dirt track | a track through grass, against the GR1 archive fixture | 256 track tiles, all record 11; 256 grew grass before, 0 after |
| the water test bans only wet records | every record 0-55, both tables | bans exactly the water-touching set; the draw/law difference is exactly {9} |
| the disc never starves | orbits, lawnmower, 4,000-step random walk | max 379 live of 392 — but see F1 |
| the grass fill radius matches the draw's | the host's `draw` call takes no range argument | both default to `LAB_GRASS.range`; they agree |
| the pins hold | 21 mutants | 5 survived; pins fixed; 20 dead, 1 recorded equivalent |

## The five surviving mutants, and what each one taught

1. **the kernel returns `paths: null`** — the pin matched `paths,   //
   GRASS-PATH1`, which also appears on the line handing the mask *to*
   the painter. The mask could be built, filled and dropped at the door
   with the pin green. Re-anchored to the return statement.
2. **the pass takes the feet's table back** — the pin matched
   `table = WATER_DRAW_MASK_TABLE`, still true of the neighbouring
   function, and the negative pin looked for the string
   `WATER_MASK_TABLE`, which `buildWaterMaskTable()` is not. Replaced
   with a behavioural pin: a pixel of grass with one record-9 tile
   builds water quads under the draw's table and none under the law's.
3. **the free sweep measures to the cell's centre** — no pin cared, and
   the defect is a ragged hole all round the horizon, because the draw
   culls by nearest point. Replaced with a behavioural pin over a
   fixture that *has* rim cells the two measures disagree about, and
   asserts it has them.
4. **the owner memo recomputes** — the pin said a function exists, not
   that it remembers. PERF11 is entirely "it remembers".
5. **the river's bare-water join is not marked** — **genuinely
   equivalent**, and recorded as such rather than papered over with a
   fixture. `paintPath` runs first inside `paintPathWithSubPathJoins`
   and its corner and elbow arms already wrote and marked every tile
   `water()` then overwrites; the mutant was applied and fuzzed over
   4,000 combinations with **zero** disagreements. The mark stays as
   belt-and-braces — it costs nothing and does not depend on paintPath's
   arms staying as they are.

## The lesson

Three of the five survivors were pins that matched a *string that also
appears somewhere else in the same file*. Each was written in the same
sitting as the code it guards, by someone who knew which line was meant
— which is exactly the reader a pin is not written for. The behavioural
replacements are longer and duller and would have caught all three.

**Pinned** in `test/grasspath.test.js` (13). Mutants
`tools/mutants/grasspath.json`: 21 — 20 dead, 1 recorded equivalent, 0
survived.
