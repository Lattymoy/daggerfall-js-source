# AUDIT PERF-ON4 (2026-10-09) - the online frame pass, its four changes, its probes and its record

Mac, of PERF-ON4 (`07-Rendering/Performance-Online.md`) and the relay's pose path held for its own pull request: **"Yes
and audit everything"**. This page is the audit of PERF-ON4 - PERF-WAYS1 (the Living World's ways), PERF-SUN3 (the
sun's cascades on one walk; PERF-SUN1 when it shipped), PERF-HUD1, PERF-VAO1, the two probes and the record. The relay's
pose path (PERF-RELAY1, its own branch and relay version) was audited the same way on its own snapshot; that lane is
recorded with it, `11-Multiplayer/Scale-Arc.md` PERF-RELAY1.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at 6a9d8af8 - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), told to reproduce every finding (a script, a surviving mutant, a number) before reporting it:

| Lane | Over | How |
|---|---|---|
| Ways | PERF-WAYS1 (`systems/livingWorld/ways.js`, its pins, LW3's) | its own mutants in a scratch copy; the synthetic region and `test/lwRoads.mjs livingMap` settled both ways and compared pair by pair; Knightstale's real simulation on the default clock; the planner timed on the real map's ground over 60,000 town pairs, both networks |
| Sun | PERF-SUN3 (`render/shadowPass.js _sunCandidates`, the replays' lists) | the nesting fuzzed over 244,613 spheres (four sun kinds, three scales, eyes to 1e8, centres to 1e9 off); a 200-mesh town against the walk-off oracle; eleven mutants of its own over 70 shadow-touching test files; the walk and the replays timed apart on a no-op GL |
| Tooling | `tools/onlineFrameProbe.mjs`, `tools/frameProbe.mjs`'s refactor, `tools/loadHarness.mjs`'s exports, `test/perfon4_probes.test.js` | mutants of the edits' effects; `testChanged`'s selection driven; the import's side effects and handles; the signal paths read against loadHarness's |
| HUD, VAO, record | PERF-HUD1, PERF-VAO1, and every claim of the pass's pages, rows and comments | every figure traced to its source; the bytecode re-measured on three trees; the HUD's asks counted on the live tree; mutants of its own |

No lane found a HIGH defect in what ships to players: every way, trip, visitor and draw is the one it was. The HIGH
finding is a pin that let a draw-changing regression pass.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| S1 | HIGH | PERF-SUN3's list growth (`_sunCandidates`'s `add`: a list starts at 64 records and doubles) was never walked: the pins' towns held about seventeen records. Dropping the grown list's copy - its first 64 entries all record 0, replayed 64 times and their flats lost - passed every pin and all 70 shadow-touching test files; a 200-mesh town differs from the oracle under it. PERF-SHADOW1's lantern lists carry the same hole | FIXED: two towns of three crowded with 70 records about the eye, every cascade's list asserted grown; perfshadow1's crowded with 80 about the lantern nearest the eye; three mutants (the copy dropped, both; no growth) dead |
| S2 | MED | Only the far cascade's saving was pinned: a nearer list found by the far planes (each nearer list the far one), or a solid or a nearer flat put on a list untested, drew the same (each replay tests again) and passed | FIXED: a fourth pin - each cascade's list is exactly what its own sphere test takes of the whole frame, record by record and flat by flat, over crowded towns, four suns, both cadences and scales; four mutants dead |
| S3 | MED | Nothing pinned that the walk ships on: every pin set `sunPrepass` each frame, and its `finally` wrote undefined (which also counts as on), so `sunPrepass: false` as shipped passed five suites | FIXED: the pins read the tuning as shipped before setting it and put it back each frame; the saving's pin asserts the default and runs on it; the mutant dead |
| S4 / R4 | MED | The measured saving left out the walk: `INSTR=shadow` timed the replays, not `_sunCandidates`, so 2.48 -> 1.42 ms was what the replays kept, not the slice's saving; `tools/frameAb.mjs` had no row for it | FIXED: INSTR=shadow times `_sunCandidates` and `_casterCandidates`, frameAb prints the walk's row, and the probe takes TUNING= (the off arm in one tree); re-measured, below |
| S5 | LOW | The walk is a net loss where everything stands inside the far cascade: by the lane's count 2.48 -> 3.02 ms (+22%) with all within 40 units, +11% within 8, +12.6% cadenced; break-even in a 3x3-pixel streamed world, a gain from 5x5. Interiors and dungeons never walk (their shadows are a point kind) | MEASURED, LEFT: a town's exterior streams far more than 5x5 pixels; rejecting in the walk what every replay rejects would shrink the lists but couple the walk to the replays' rules - its own slice if a compact scene ever shows it |
| S6 | LOW | The name PERF-SUN1 was taken (the far cascade's one tap, 2026-09-19: `Rendering-Arc.md`, `perfsun_fragment.test.js`, six `PERF-SUN1-*` mutants) | FIXED: PERF-SUN3 - the code, `test/perfsun3.test.js`, `tools/mutants/perfsun3.json`, the pages |
| S7 | LOW | "36 units at the least" (each box shifted by its own texel snap: about 35.97) and "float32 rounds a plane by thousandths" (true at the game's coordinates, growing with distance; nesting first breaks with the eye about 7.4e9 units out) | FIXED: the comment and the page say what holds |
| W1 | MED | The ways past the floor were not pinned to the floor's direction, network or ground: planning them the other way (LW0 decision 2), on no network or with no ground survived both suites - test 1's towns shared a px, test 2 compared the book's size and its planner ignored its options | FIXED: every call the planner takes is logged with its direction, network and ground; test 1 asks half its pairs the higher id first and holds every call to the lower id's town, the network and the ground; test 2 compares the two arms' calls, not their count; three mutants dead |
| W2 | LOW-MED | The shipped clock was never run: every pin injected `now`, so `now = () => 0` (every frame asking the cap) survived; world.js builds its book with none | FIXED: a pin builds a book with no clock under a stubbed `performance.now` (put back after) - four a frame at 0.6 ms, the two at 5; the mutant dead |
| W3 | LOW | The cap was pinned by a range (16-64) | FIXED: the three constants exactly; a cap of 16 and of 64 dead |
| W4 | LOW | The time's edge was unpinned (`spent <= spendMs` survived) | FIXED: an exact 1 ms pair asks two; dead |
| W5 / R5 | LOW-MED | The planner's cost was quoted from `tools/livingPerfProbe.mjs`, which plans on the roads alone with no ground; on the real map's ground it is dearer, and a frame's asking can run past its time by one pair. The ways.js header kept LW3's "tens of milliseconds ... at most WAYS_PER_FRAME" above the new paragraph (RETIRING A FLAG DELETES THE SENTENCE), and the probe printed "two new pairs a frame at most" | FIXED: re-measured here on the real map's ground - 20,000 of the 231,819 town pairs within 18 pixels: mean 0.16 ms on Hazelnut's roads, 0.22 on the generated network, p99 0.8 and 1.1, one pair in a thousand and three over 2 ms (the dearest 18), a network's first unroutable pair about 180 (the land pieces folded once) - in the header, rewritten once, the pages, and the probe's line |
| W6 | LOW | perfways1 took about 9 s and was not in `tools/testTimes.json` (sharded at the median weight) | FIXED: in the table at its 8.4 s |
| T1 | MED | An interrupted online probe left its state directory - the throwaway signing pair's private half among it until the account service answered - because the signal handler exited past main's `finally` (AUDIT SCALE C11's fix in loadHarness, undone here); SIGTERM exited 130 | FIXED: the state directory is the module's, dropped by the signal handler and the failure path; SIGTERM exits 143 |
| T2 | MED | The peers' wait could give up silently - a missing hook, a page that threw or a closed session read as "ready", and a crowd short of its size was recorded under its name | FIXED: the hook says the session's status and its drawn peers; a crowd is ready when the session is open and draws exactly the crowd, and one that is not is measured, said with its count, and fails the run; the summary line prints the peers |
| T3 | MED | Crowd size was confounded with time since the boot: crowds ran in ascending order, fifty frames after the boot, the grass unsettled - the Living World's column fell 17.4 -> 12.9 -> 8.9 because its waiting was ending | FIXED: the page settles before the first crowd (the frame probe's grass settle, exported, then the way book standing still over 30 frames, WAYS_FRAMES at most); the crowds run in the order given, a smaller after a larger sending bots away, and the default is 0, 20, 60 and 0 again - the two zeros bound the run's drift; re-measured, below |
| T4 | LOW | `test/perfon4_probes.test.js` held the needles, not the edits: keeping `shot` refused, a base taking 127.0.0.2, the frame probe's transform skipping its edits, the online server built without its own, the hook losing a field and a path matched by containing all survived | FIXED: a second pin reads each edit's effect through the plugins each probe's server is built with (`probeTransforms`, the new `probePlugins`); six mutants dead |
| T5 | LOW | `npm run test:changed` did not pick the probes' pin for a change to world.js or buildBreather.js | FIXED: the pin names the five files it reads |
| T6 | LOW | Import-time side effects: `PEERS` parsed (and thrown on) at import, frameProbe's output directory made at import | FIXED: `crowdsOf` reads PEERS in main; the directory is made by the first window written |
| T7 | LOW | `editsPlugin` held a needle present, not present once - a base tree's doubled needle edited its first copy alone | FIXED: once exactly; a mutant dead |
| T8 | LOW | One errors array for every crowd: a boot's error failed every crowd as its own | FIXED: the boot's errors apart (said, and failing the run), each crowd's its own |
| T9 | LOW | A rejected browser or server close skipped the cleanup after it | FIXED: every step runs whatever the one before threw |
| T10 | LOW | TREE= swaps the page alone (the relay, the service and the bots' client are the current tree's) and the header did not say so | FIXED: said - an A/B of a client change, never of a relay or wire one |
| T11 | LOW | The page's port checked after minutes of standing services; `UNITS_M = 40` a new literal; a CDP session per crowd never let go; the frame probe's header said FRAMES=40 (60 is its default) and checked scene names after vite and Chromium stood | FIXED: the server first; PIXEL_UNITS / PIXEL_M; the session detached; the header and the check |
| R1 | MED | "Online is the enhanced lane, and the Living World with it": false - the Living World is on by default in both lanes, the switch the player's online too | FIXED: the pages say so, and what differed between the probes (the frames before measuring, F3) |
| R2 | MED | "The difference was the Living World's": 17.4 of the 23 ms was | FIXED |
| R3 | MED | The peers' sounds: "a millisecond a second at sixty" against the page's own 3.3 (6.6 in two seconds), from a per-sound figure never derived | FIXED: 1.2 a second at 20, 3.3 at 60 |
| R6 | LOW | PERF-NEXT's items 1, 5 and 6 kept their defect text with SHIPPED appended | FIXED: struck |
| R7 | LOW | The bytecode series mixed Chromium's 99,547 with node 22's 105,613 | FIXED: labelled; node 22 eager, re-measured here: 100,806 at PERF-NEXT's merge (b2621719), 105,613 now |
| R8 | LOW | PERF-HUD1's pin claimed sweep times it did not check, and the tests' reset of its clock was unpinned (its mutant survived five suites) | FIXED: the pins hold the sweeps' times (the tick's at 17, 267, 533 and 783 ms - not 517 and 767, which the message said), twice over; the mutant dead |
| R9 | LOW | Two comments still said "a throttled sweep" after PERF-HUD1 | FIXED |
| R10 | LOW | "~31" / "about thirty" querySelectorAll a sweep: 34 on this tree (counted again here) | FIXED |
| R11 | LOW | The online probe named Performance-Next.md as its record | FIXED: Performance-Online.md |
| R12 | LOW | A mutant named short in the perfsun row | FIXED: the full name |
| R13 | LOW | "14-17 ms of a 37 ms frame": 16.8 of 36.5 | FIXED, in the code, the pin and the rows |
| R14 | LOW | PERF-VAO1's evidence lost its qualifier | FIXED: in node, once (PERF-NEXT 6); no gain measured |

## Re-measured

Measured again here: the planner on the real map's ground (W5) and the world host's bytecode on three trees (R7), above;
and the two probes, one run after the other with nothing beside them (Knightstale by day, 480x270, 40 frames a window).

**PERF-SUN3 with its walk** (S4: one tree, `INSTR=shadow`, the off arm `TUNING='{"sunPrepass":false}'`; ms a frame):

| | walk off | walk on |
|---|---|---|
| the sun's three replays, by the pass's own timer | 2.28 | 1.02 |
| the walk (`_sunCandidates`) | - | 0.63 |
| the shadow pass's render, by its timer | 4.70 | 4.23 |
| the shadow pass's render, by sample count | 3.28 | 2.95 |
| the replays and the walk, by sample count | 2.43 | 1.35 + 0.42 |
| the sun's draws a frame | 201 | 201 |
| allocated a frame, the replays (and the walk) | 78 KB | 21 KB (+ 11 KB) |
| the world host's frame | 13.62 | 13.57 |

So the saving is about 0.6 ms a frame here, not the 1.06 the replays alone showed; the frame's total moves within the
probe's noise.

**The online frame, settled** (T3: the new code only - a re-run of the old was stopped as more than the record needs,
Mac: "I think thats overkill"; its figures stand as first measured, taken while its ways were still filling). The boot
was ready at frame 148 with 1,646 ways known (the old code, in the run the container's restart cut short, had 298 at
frame 157: two a frame); the way book stood at 1,666 by frame 247, and every crowd was measured with the session open and
exactly its bots drawn.

| crowd, in order | the world host's frame | the Living World | its trips planned again | onlineFrame | inbound messages | allocated a frame |
|---|---|---|---|---|---|---|
| 0 | 121.0 (19 without one compile, below) | 0.46 | 0 | 0.8 | - | 2.2 MB |
| 20 | 26.9 | 0.53 | 0 | 4.5 | 9.7 | 3.4 MB |
| 60 | 31.0 | 0.45 | 0 | 11.7 | 16.1 | 3.9 MB |
| 0 again | 15.7 | 0.45 | 0 | 0.6 | - | 2.0 MB |

(ms of this container's CPU a frame; at about two seconds a frame the messages' column is two seconds' worth.) Settled,
the Living World is under half a millisecond at every crowd and plans no trip again; the frame with nobody there is 15.7
against 13.6 offline. Seen beside it, and left in `07-Rendering/Performance-Online.md`'s list: the first crowd-0 window
held a one-off - the gate pass's program compiled inside the frame on its first use (`gatePool.js ensurePass` ->
`glProgram.js buildProgram`, about four seconds of SwiftShader's); the page kept 240 more DOM nodes after the crowd left
than before it came (697 against 457 - the name layer removes a tag the frame its peer goes; the rest is not attributed);
and the last window's extra GL calls (7,715 against 6,603) are a pass that was not running before - framebuffers and
viewports a face at a time, lanterns lit as the shared clock's sky moved on.

## Found beside it

`test/cards10_relay.test.js` (main's, CARDS10) tampers a ranked receipt with `rc.slice(0, -2) + 'AA'` and expects a
signature refusal - but an Ed25519 signature's last bytes are its scalar's highest, mostly zero, so the tamper is often
no change at all: 98 of 1,500 fresh keys here (6.5%) verified, so that pin fails about one CI run in fifteen. Not this
pass's code; said to Mac with the one-line fix (tamper a byte the signature always uses).
