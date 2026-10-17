# AUDIT PERF-ARENA (2026-10-11) - the exterior's frame in the real game, audited

The owner, of the pass recorded in `07-Rendering/Performance-Arena.md` (PERF-ARENA, PERF-ARENA2, PERF-ALLOC1,
PERF-ALLOC2 - merged as #758 and #769 - and PERF-VOL, PERF-ORDER, open as #770): **"Audit everything"**. This page is
the findings, each with its verdict. What the audit changed is written into the record's sections as they now stand.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree apiece at 19c57b0c02 - Home.md's DO NOT
FIX WHILE THE VERIFIER IS READING), told to reproduce every finding (a script, a surviving mutant, a number) before
reporting it, with the code before #758 (46cf666e59) beside them for differentials:

| Lane | Over | How |
|---|---|---|
| Arena | PERF-ARENA, PERF-ARENA2 (`renderer.js` arenas) | every consumer of a batch's indices in `src/`; the 27 element-buffer binds; a differential of random batch lives against the base through a GL that resolves every triangle (15,000 draws over the main pass, the air pass and the shadow replay); a streamed 2,000-step walk; mutants of its own |
| Alloc | PERF-ALLOC1, PERF-ALLOC2 (the twins, the walk's cube) | the twins against the base on 720,000 faces and 240,000 general views with edge inputs; the scratches' aliasing; allocation measured in V8; the relay's 65-file graph hashed; mutants |
| Vol | PERF-VOL (the kept answers) | every value the test reads against the key; every writer of a grid, a size, an origin; 160,000 frame pairs (41.7 million shadow draws) through the real ShadowPass with the memo on against off - day and night, Steady on and off, the cache on and off, the lo tier; mutants |
| Order | PERF-ORDER, and the rest of #770 cold | side effects of every reordered test; two A/B harnesses against the code before (298,092 batch visits; 857,392 GL calls); every moved pin and its mutants |
| Record | the pages, the rows, the counts, the pins, the mutant lists, the PR's description | the gates; every figure recomputed from the probe runs; mutants over the edited test files |

No lane found a wrong picture, a wrong shadow, a crash, a hang or memory without bound in what the five slices ship:
every draw of every differential and fuzz was the base's. The findings are pins that could be switched off, costs
the slices moved elsewhere (one of them the arenas' own index buffers), claims stronger than their evidence, and the
record.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | MED | The let-go's deletion of its records' homes was unpinned: without it a record's next batch went to the deleted arena - a deleted array, drawing another batch's quads | FIXED: the spill pin makes one more batch of that record after the let-go - a standing arena, its own corner; the mutant dead |
| A2 | MED | The batch's own size in the growth (`Math.max(..., quads)`) was unpinned: the "bigger than an arena" batch fit the doubling anyway; without it a batch past twice the last arena got q0 -1 (a wood gone, a free list corrupted) | FIXED: the batch is bigger than the arena the doubling would open; `_q0` and `_ibOff` 0 asserted; dead |
| A3 | LOW | A first fit's home was unpinned (PERF-ARENA2's bind law, not the picture) | FIXED: pinned; dead |
| A4 | LOW | Every arena uploaded its own index buffer of identical contents - 6.3 MB of GPU memory and ~6 ms of the frame filling it, an arena of the most; a streamed walk opened fourteen, ten of the most; and the record's "no more GPU memory than the woods it stands in" did not hold (99-102 MB of room for 54-72 MB of flats, bounded) | FIXED: one index buffer for every arena (`_bbArenaIndices`), grown to the largest and rebound into each; the sentence rewritten from the measure (R10) |
| A5 | LOW | `_bbArenaOfKey` grew without bound: a peer's doll mints `doll_N` for good | FIXED: the homes start over past BB_ARENA_HOMES_MAX (4,096) - a home is a placement hint |
| A6 | NOTE | `_bbArenaFree` spliced `indexOf(a)` unguarded: an arena not standing (-1) took the last standing one out of the list | FIXED: guarded; pinned with a batch whose arena is gone |
| A7 | NOTE | `destroyBatch` left a dynamic batch's deleted VAO on it | FIXED: let go, as `destroyBillboardBatch` does |
| L1 | MED | "Nothing allocated" was false: a lantern's faces still allocate ~860 B a call (2,389 before) - `Math.hypot`'s own, twelve a lantern; the pin counted typed arrays only | FIXED in the record (the pin holds no typed array, not no allocation); the code LEFT - `hypot`'s rounding is the engine's to choose, and the twins' law is mat4.js's arithmetic as written |
| L2 | LOW | PERFALLOC1-order's "equivalent" was wrong for the twin: on a translation that cancels, a reordered sum differs in more than float32 hides (true only of the faces, whose basis is axis-aligned) | FIXED: cancelling views at 1e3-1e7 in the pin; the record dead now, with five more of the twin's arithmetic (LA-*) |
| L3 | NOTE | The twin's signed zero was unpinned (`multiply` wipes it in the faces) | FIXED: an eye at the origin and each face's view before the product |
| L4 | LOW | The walk's own scratch was unpinned (an array a call survived) | FIXED: its line pinned; dead |
| L5 | NOTE | The wrapper's "other callers" run every frame: `_staticSignatures` and `_dynamicNear` still hand five doubles | RECORDED as the next lever - the first is SC1's own machinery |
| L6 | NOTE | A NaN's sign bit differs between the twin and mat4.js in a JIT-warmed process (not in a fresh one) | RECORDED: JIT noise, not observable by `Object.is` or GL |
| V1 | MED | The key's exact compare was unpinned at its boundaries: a radius or an origin within 1e-3, or `\|h\|` for `h`, survived and kept a stale answer | FIXED: the smallest move of the radius and the origin, and the height's sign, each flipping a kept answer; three dead |
| V2 | MED | By day the memo never helped and cost: the sun turns every frame and a cascade follows the eye, so no cascade's planes come again - each a miss, a table entry, a restart every ~170 frames dropping the lamps' names | FIXED: a lantern's replay alone is named; an unnamed replay asks the walk itself |
| V3 | LOW | FNV-1a over words collided on symmetric planes (lamps on the axes, opposite faces at the origin); the word compare kept answers right, but only a collision at words 0-1 was pinned | FIXED: each step folded down (`volumeHash`); collisions at the first words and the last pinned through one reused array |
| V4 | LOW | A view cached by its buffer survived | FIXED: two sets in one buffer pinned |
| V5 | LOW | The two bounds were unpinned (one raised to 1 << 30 ate memory instead of failing) | FIXED: both asserted |
| V6 | NOTE | The memo loses where sets come back exactly two or three times, or past 512 a cycle | RECORDED: neither reachable with twelve casters and a turning sun |
| V7 | NOTE | ~180 B a kept answer; a town by night ~1,800 | RECORDED |
| V8 | NOTE | perfvol's draw oracle covered a night town under Steady with the cache on only | FIXED: by day, cadenced and cache off beside it |
| O1 | MED | A shipped `volumeMemo: false` failed no test (every pin sets it per arm) | FIXED: the shipped value pinned; dead |
| O2 / R11 | LOW | The moved PERF-SHADOW1 pin's "now" arm ran with the memo on, so it caught a dead pre-pass on one frame only | FIXED: both arms keep nothing - that pin holds the pre-pass, perfvol the memo (AUDIT 637 B2 likewise) |
| O3 | LOW | The picture lookup's new place was unpinned | FIXED: the plain flats' pictures never looked up at the resolve; dead |
| O4 / R4 | MED | "A carried lantern's faces ... make no garbage" was false: each first sight kept a copy of its words (~0.4-0.7 KB); a restart also dropped the still lamps' names | FIXED in the code: a first sight keeps its hash alone, and the first sights start over without the names |
| O5 | NOTE | world.js's AUDIT REACH comment still said the rule runs "for the batches it can keep" | FIXED |
| O6 | NOTE | A batch with no box that the far rule drops no longer throws | RECORDED: every producer sets `_box` |
| O7 | NOTE | The pixel walk's half of PERF-ORDER is held by source pins alone | RECORDED: a cost-only reorder, the A/B harness its proof |
| O8 / R14 | NOTE | Two committed mutants already survived before #770: SHADOW-REACH's peer pin matched the riders', walkers', bands' and yards' identical lines; `composite-gain` changed a value every prepare overwrites | FIXED: the peer pin anchored at the peers' loop (dead); `composite-gain` recorded equivalent with its why |
| O9 | NOTE | `billboardKey` now runs for off-screen flats (keys interned earlier) | RECORDED: the cutout sort orders by string, the GL streams byte-identical |
| R1 | MED | The PERF-VOL/ORDER table led with frame totals inside the spread of two runs of one render tree (19.1 against 20.8) | FIXED: the callees a slice removed are the table; the frame "not claimed" |
| R2 | MED | PERF-ARENA's and ARENA2's frame totals carried the snow's budgeted blanket (3.4 against 1.8 ms) and run noise; the merged PRs' patch notes turned them into percentages | FIXED in the record; the merged PRs' notes LEFT for the owner - editing a merged description rewrites its release's notes (REL7) |
| R3 | MED | "The 508 binds left are the meshes' and the terrain's: a mesh arena would be the next lever" - contradicted by the page itself | FIXED: deleted, replaced by what the 508 were |
| R5 | MED | Testing.md's MAC1 row still said the rule is wired after the frustum test | FIXED |
| R6 | LOW | la_cost's pin misread (107 -> 30 is two calls, not a change) | FIXED: 108 -> 107 and 31 -> 30 |
| R7 | LOW | Units changed within the page (KiB/1000 beside decimal); "draws" meant two things | FIXED: decimal MB throughout; draw calls and `drawElements` named |
| R8 | LOW | The VOL table's prose named a billboards row it had not; its shadow row used another function than the others | FIXED |
| R9 | LOW | "The shadow pass is the frame's largest part (5.2-5.4 ms)" - the PERF-CROWD head's figure beside the page's 3.7 | FIXED: both, labelled |
| R10 | LOW | The GPU-memory sentence was unmeasured and weakened by ARENA2's growth | FIXED: from A4's measure |
| R12 | NOTE | The grid bench's figures were a synthetic wood's; two Node baselines for one set of asks | FIXED |
| R13 | NOTE | 220 binds beside 278 calls, unreconciled | FIXED: 220 bind a VAO, the rest unbind |
| R15 | NOTE | The patch note's "distant small plants" is narrower than the rule | FIXED in #770's description: "distant small flats" |

## What stands

- Mutants: `perfarena.json` 27, `perfalloc1.json` 14, `perfvol.json` 33 - all dead; the re-aimed and moved records
  dead (`perfexta` PERF-EXT1-5, `el3` emit-flat-without-map, `perfsun3` PERF-SUN3-the-walk-shipped-off, `shadowreach`
  world-peer-gate-still-skips), `el3` composite-gain equivalent as recorded.
- Left for the owner: the merged PRs' patch notes (R2); carrying the lanterns' candidate lists and signatures across
  frames (the static shadow cache's own machinery - Dudey's word on it stands); the wrapper's two per-frame callers
  (L5).
