# AUDIT PERF-PRIORITY (2026-10-10) - the placed pieces, the crowds and the render range, audited

The owner, of PERF-PRIORITY (`07-Rendering/Performance-Priority.md`): **"Lets do an audit on this. Also keep diving for
more performance improvements. I want to go deep"**. This page is the audit of the pass's four changes - PERF-V8,
PERF-YARD, PERF-INST, PERF-COL2 - and its record. What the audit changed is written into the record's sections as they
now stand; this page is the findings, each with its verdict.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at c984a011 - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), told to reproduce every finding (a script, a surviving mutant, a number) before reporting it:

| Lane | Over | How |
|---|---|---|
| V8 | PERF-V8 (the world host's `frame`, its 21 closures, `test/perfv8.test.js`) | the frame against main's line for line; eslint-scope over both trees (4,956 references); V8's census of every function; each closure folded back and measured; mutants of its own |
| Yard | PERF-YARD (`decorRoom.js`, `homeYards.js`, `yardCull`) | the frame's matrices traced through every camera variant (acorn over world.js); 400 mirrored cameras x 200 boxes sampled inside every culled box; the shadow reach's space; mutants over fifteen yard test files |
| Inst | PERF-INST (`shadowPass.js` `_movedFiled`, the grid) | a differential fuzz against the shipped scan as the oracle (~12 million draws, caps 66 to 4,096, boundary, wrapped, huge and non-finite layouts); benches by layout; the memory and the hitches at the cap; mutants |
| Col2 | PERF-COL2 (`collider.js`, the marks) | a differential fuzz of main's collider against this one (~175,000 queries, all fifteen kinds, crossings, re-anchors, removals, growth); the rounding of the frames; the rebuild's cost; mutants |
| Record | the pages, the rows, the counts, the pins and the mutant lists | the gates; every figure traced; mutants of its own over the seven edited test files |

No lane found a wrong frame, a wrong shadow or a wrong collision in what the four changes ship: every verdict of the
shadow memory and every collider answer was the old code's under the fuzzes. The HIGH finding is a hang a frame could
reach on an absurd translation; the rest were costs the changes moved somewhere else, pins that let the change be
switched off, and the record.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| I1 | HIGH | `_movedFiled`'s cells were walked by coordinate (`for (let gx = cx - 1; gx <= cx + 1; gx++)`): past 2^53 cells (a translation of ~1.8e16) `gx++` no longer moves `gx` and the frame never returns - a hang where the old scan made a new placement (ONCRASH1's kind). The `Number.isFinite` guard was unpinned | FIXED: the cells are found by offset from the draw's own; a twin with Infinity, NaN, 1e17 and float32's largest, under a 20 s timeout |
| I2 | MED | Two `auditreach.json` mutants survived: the scan's eviction arm could no longer run (64 placements or fewer, under the cap), and B2 drove the filed path's eviction | FIXED: the arm deleted (the scan never meets a full memory - pinned: 64 under the cap), both mutants re-aimed at the eviction that stands; `auditlight.json`'s one-placement mutant re-aimed at the scan's new placement |
| I3 | MED | Three verdict-changing mutants survived `perfinst`: a tie to the first cell walked, the last exact walked, the first exact walked - the pinned tie held both placements in one cell, so walk order was remembered order; two grid-cleanup mutants (a placement never unfiled, an empty cell kept) changed no verdict and leaked | FIXED: ties across a face in both orders, exact matches on both sides of a face, a refiled placement in remembered order, the grid's invariant (each placement once, in its own cube, no empty cube); 23 mutants dead |
| I4 | MED | The grid helped spread layouts only: XZ columns put a stack of copies in one or two cells and every draw measured every one with no early exit - a stack of 600, 4.1 ms a frame against the shipped scan's 0.58; a 3-unit pile, 3.1 against 0.87 | FIXED: cubes; cells in remembered order and the draw's own cube asked first for the exact one; the 3x3x3 measuring only unclaimed placements. A stack of 600, 0.07-0.08 ms; the pile, 0.21-0.26 (the record's table, by layout) |
| I5 | MED | The memory at the 4,096 cap: ~0.6 KB a placement with its filing, 2.5 MB a full mesh kept for the session; a full memory walked every placement at every miss (2,000 new copies after a hold away: a 29 ms frame); every origin shift filed every placement again (20 full meshes: 27-51 ms) | FIXED: the cap 1,024; the stalest from a queue made once a frame; the cubes in the origin's frame, so a shift refiles only what float32's rounding carried over a face. 2.7-3.2 ms for 2,000 new copies; 1-11 ms for the shift with twenty full meshes, most of it the move of every placement itself |
| I6 | NOTE | The all-live memo was keyed to one pass's clock on a shared mesh | GONE with the memo; the queue is keyed by frame as `seen` already is - one pass per renderer |
| I7 | NOTE | PERF-EXT10's sweep excludes `_sh(?!Inst)` by prefix: a future `_shInst*` field on a batch would slip past it | RECORDED: the memory's fields are a mesh's and a tile's alone (`_moved`'s callers) |
| C1 | MED | Rebuilding the collider's filing cost 20-30 times what it had (a pixel bucket on 16-25 coarse cells, where it had been one push to `always`), and streaming paid it about once a frame - every `addMesh` dropped it: ~0.2 ms a frame at the default view while a pixel built, the move's saving and more | FIXED: a mesh is filed into the standing filing - a new bucket at the walk's end, a grown one under the cells it gained, `always` kept in the walk's order and stamped; a frame moved under the filing drops it. A mesh and a move a frame at the default view: main 88 us, the first cut 344, now 21 |
| C2 / R3 | MED | Two pixel buckets were left unmarked - Deep Waters' walls (every carved shore pixel; the mod is on by default) and a bounty farm's - and the record said "every streamed pixel's bucket" | FIXED: the host hands both its frame and each marks with it; the pin reads both; three mutants dead |
| C3 | LOW | The sentinel compared y, so a vertical recentre refiled everything though only X and Z file a bucket | FIXED: X and Z |
| C4 | LOW | `onFloatingFrame` imported on a line of its own beside `Collider`'s | LEFT: a cite anchor reads `Collider`'s line as it stands |
| R7 | MED | `perfcol2` never moved the frame in z alone: the sentinel blind to a move north survived | FIXED: a crossing north; the mutant dead |
| R8 | MED | The coarse query's extent was unpinned: one cell wide in x, or in z, survived | FIXED: `_near` against a brute force over random boxes after moves and grown buckets - every bucket whose box meets the query's, in order, once; both dead |
| Y1 | MED | The yards' cull could be switched off with every test green: `const cull = null` in `homeYards.js` survived all fifteen yard test files | FIXED: the pin reads the host's test handed on; the mutant dead |
| Y2 | LOW | A piece with no box (its model let go between the mesh and its copy) was guarded by an unpinned `e.box` - without it, `transformedAabb(null)` threw in the frame | FIXED: a pin draws a boxless piece under a skip-everything test, never asking it |
| Y3 | LOW | The planes were kept by the frame's timestamp, which two frames share under a coarsened clock (resistFingerprinting): a turn on the second frame culled with the first's planes - a one-frame pop at the edge | FIXED: keyed on the view matrix, which every frame mints anew |
| R6 | MED | `perfyard`'s ordering pin was vacuous: `'    _lastProj = proj; _lastView = view;'` first matched the modes' `reportFrame` line, six spaces in, thousands of lines above the frame's - the frame's own moved below the draw survived | FIXED: anchored on the frame's own line, the one yards draw after it; the mutant dead |
| R15 | MED | MERCHANT-YARDS (merged the same day) drew every yard of every streamed town every frame - timber and three wagons on show - with no cull at all | FIXED: the street's draw hands them `yardCull`, a yard asked as one box; cast alone through a recording renderer in a shadow's reach; the window's view untested (its eye is another); a pin, six mutants dead |
| Y4 | NOTE | A cutout texture's holes cast no shadow until its mesh has been drawn on screen once (the replay's cutout state is filled by the lit draw) - the pixel walk's own behaviour; no yard piece is cutout today | RECORDED |
| V1 | MED | The record's "Two moves were tried out and put back in" contradicted the code (both stand moved) and its mechanism (operands wide "past 256 constants or registers") was not V8's | FIXED: rewritten from measurement - folding the storms back adds 8.6 KB, the pools 2.1, the two 10; operands go wide past r123, per instruction (4,627 of the frame's 9,391) |
| V3 / R9 | MED | The closures' rule (no `return`, nothing declared the frame reads after) was checked once by hand: a `return` moved into one survived (in the game, the frame would run on and ask a second animation frame); `>= 20` closures let one be folded back; a second call as `frameHud?.()` passed | FIXED: over the parse every run - the 21 by name in order, one statement each, no `return`, no `var`, a plain call on the next statement and nowhere else; five mutants dead |
| V4 | LOW | `perfv8`'s census measured functions named `frame` alone: the motor's closure (16,459 bytes) was never measured | FIXED: the closures are named `frame...` and the filter is `frame*` |
| R1 / V2 | LOW | The bytecode figures were the pre-merge tree's (105,768 -> 38,661); the motor's 15,552 matched no tree | FIXED: both series, 107,564 -> 39,965 with #748 merged; the motor 16,459 |
| R4 | LOW | PERF-NEXT item 22 still read "open" in `Performance-Next.md` (twice) and `Performance-Online.md` | FIXED: BUILT as PERF-V8, its A/B owed |
| R5 | LOW | `Enhanced-Lighting-Arc.md`'s "a batch past 128 placements is treated as dynamic" kept its retired sentence with a parenthesis (RETIRING A FLAG DELETES THE SENTENCE) | FIXED: the sentence says the limit that stands (past 1,024 live placements) |
| R10 | LOW | A tie-break inside a cell to its list order survived; so did a draw exactly the reach away taken | FIXED: both pinned (the refile order; the reach's strictness); both dead |
| R11 | LOW | "The linear fog ends at 4,000" holds under the Port sky alone; Dynamic Skies (the default Outdoors) installs its own rows - 3,600, and exponential-squared in overcast and rain | FIXED: What is left says both, and that a cull must read the live row |
| R12 | LOW | "~0.03 ms with one pixel streamed" against the table's 16-25 us; the short ray a little slower at view 2, unsaid | FIXED |
| R13 | NOTE | `Performance-Town.md`'s FB0930-FRAME passage ("Movers ... asked by every query", "addMesh drops it") and the ledger's AUDIT REACH row ("evicting a stale one at 128") were superseded | NARROWED: each says what stands since |
| V5 | NOTE | The 3/4 tripwire's room is one statement, not days: one folded back adds up to 7 KB | RECORDED in the record |
| V6 | NOTE | The closures' price: the frame's context holds 40 slots, not 13; 21 closures made a frame (~0.8 us, ~0.5 KB young); a promise made inside a closure holds the frame's per-frame arrays until it settles | RECORDED in the record |

## After the audit

The fixes were written after the lanes reported, on the working tree, and checked by the same instruments the lanes
used, re-run against the fixed code: the shadow memory's oracle fuzz (~33 million draws at caps 70, 100 and 300, a
face-aligned layout added - none diverged; a neighbour left unasked diverges at once), the collider's differential fuzz
(~172,000 queries with two events added for the standing filing - none differed), and every list's mutants (PERF-INST
23, PERF-COL2 19, PERF-YARD 17, PERF-V8 8, PERF-FACE 6, and the re-aimed AUDIT REACH, auditlight, FB0930-FRAME and
GROUND-LAST lists - all dead or equivalent as recorded).

PERF-FACE (a lantern's live face that holds its cache is not copied again) was written in the same session, after the
snapshot; no cold lane read it. Its record and pins are the record's.
