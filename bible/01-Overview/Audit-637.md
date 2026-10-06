# AUDIT 637 - PR #637 audited, 2026-10-06

Mac, of PR #637 (PERF-NEXT's PERF-ON3, PERF-SHADOW1 and PERF-URL2, and FIELD BUGS 2026-10-06b's RUN-IN-PLACE on one
branch): *"Audit this"*. Four lenses read the branch at its head then (`a313cfcba`), and each checked its own findings
with a probe before reporting them:

- **the roster** - PERF-ON3: `net/roster.js`'s memo, its sort and its frozen answer, and the chat panel's short-circuit;
- **the shadows** - PERF-SHADOW1: `render/shadowPass.js`'s candidate walk, the cube's reach and slack, the quads' ask;
- **the play-out and the pref door** - RUN-IN-PLACE (`net/online.js` `tick`) and PERF-URL2 (`systems/onlineLane.js`);
- **the docs, the pins and the merges** - every page, row and cite the branch wrote, every pin and mutant record it
  moved, and its merge of main.

Forty-nine findings. Two are the same finding seen twice (D1 = C1, D15h = B8), so 47 are distinct. Every one was read
again here before any line changed, and the ones that claimed a behaviour were reproduced first (C1 and C2 through the
real session, B1 against the real float32 planes, B3 by its walk count). Each fix carries an `AUDIT 637 <ID>` comment.
They are pinned in `test/audit637_roster.test.js` (7), `test/audit637_shadow.test.js` (10) and
`test/audit637_runinplace.test.js` (9), and mutated in `tools/mutants/audit637.json`: **40 mutants, 40 dead.** A pin a
fix moved says `PIN MOVED` where it stands.

## For Mac

Nothing here waits on a call to ship; these are yours to make whenever:

- **RUN-IN-PLACE rides in a performance pull request** (D14: Home.md's "one feature at a time"). It went in here because
  the desync report came mid-pass, and this session's branch rule keeps every change on the one branch. Say the word
  and it can be split into its own pull request.
- **Another player's spell kicks your camera** (`Field-Bugs-2026-10-06b.md`, SPELL-COST): every missile landing within
  about 13.3 m - a peer's and the sun baby's included - shakes the screen. Whether it should is about the feel.
- **The relay window**: the pose path's prototype (`Performance-Next.md` item 15) and the POSE_FAR_SHARE doc's
  correction (item 19, C2 below) both wait for a window you announce - a relay deploy drops every player once.

## Fixed

**The roster** (`src/net/roster.js`, `src/ui/socialPanel.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | low | The panel's short-circuit had no pin: deleting it, or never recording the list it saw, passed all three of PERF-ON3's. | A pin counts the repaint key's walks of the roster's own frozen list over thirty idle frames: none, and one key and one draw for a join. |
| A2 | low | The memo's non-array input arm had no pin. A seat claim can go null to `[key, season]` under an unchanged title (`_refresh`), and a mutant that never saw it kept the stale row. | Story steps take a claim off and put it back under the same title, and glyphs to null and undefined and back, against the old law. |
| A3 | low | The collator's options were half-pinned: no name in any story had a space or punctuation inside, so `ignorePunctuation: true` survived, and so did a fixed locale. | Spaced and punctuated names (`Sir Bob`, `a-b`, `O'Neil`, `J.R.`, `Bob_2`) against the old law, with tags that run against them; the options read back off `NAME_ORDER.resolvedOptions()`. |
| A4 | low | ROW_MEMO_MAX had no pin. | With A5's law: a listing past the bound asked twice is the same list, and a row unlisted since is made afresh. |
| A5 | low (cost) | Past the bound the memo cleared whole, so the next ask rebuilt and re-sorted every live row (22.5 ms at 2,000 online) and answered a new array for an unchanged list. | It lets go of the rows the last ask did not list, and only those - the answer's identity survives the bound. |
| A6 | nit | The listing was committed before its answer was made: an answer that threw would have left the next identical listing answering the list before it. | The answer first, then the state that names it; a fault-injection pin. |
| A7 | nit | Inputs were compared with `!==`, so a seat claim of -0 kept the row of 0 (the old law answers each as it is). | SameValue (`Object.is`). |
| A8 | nit | The comment said the default locale is "fixed for the page"; ECMA-402's is the host's current one. | The comment says what the code does: the locale the module loaded with (below, decided). |
| A9 | nit | A kept row is shared by every ask and every caller and was mutable: one caller's write would have changed every later answer. | Each row is frozen whole, its glyphs and its claim with it, when it is made. |
| A10 | nit | "Three tabs compose a new source" - four do (the party's was left out, and it is the one that builds new peer objects); "the very array it answered last time" was claimed unconditionally. | Both sentences corrected, in `roster.js` and `Performance-Next.md`. |
| A11 | low (cost) | Outside the slice: `ui/socialPanel.js` friendOrder sorted with localeCompare and options - a collator built for every comparison of every repaint, PERF-ON3's own defect one panel over. | It sorts by the roster's `NAME_ORDER`, exported as the one home of the name order; the old friendOrder is the pin's oracle. |

**The shadows** (`src/render/shadowPass.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | medium | The cube's float32 slack grew with far alone. A face's far plane is row 3 less row 2 of its float32 view-projection, two entries near 1 whose difference is its normal (2 near / (far - near)); normalised, their rounding grows with far x (far + the place). For a far-96 lantern at the origin a face took spheres 2.75e-3 past the exact bound where the slack was 2e-3, and the pre-pass dropped a draw the face made (one witness of 48, end to end through the real renderer). Nothing visible - the corner zone of a far plane - but the draws were not the draws. | `CUBE_F32_FAR` (4 x 2^-24 / near) times far x the place's size joins the slack. Over fars 4 to 120 (SHADOW_CASTER_MAX_RANGE), places to 120 km and radii 0.05 to 3.7: no violation, the worst corner 0.114 of the slack. |
| B2 | medium | The pins could not fail several of the new lines: a list reused without emptying it (duplicated flats, 200 of 200 fuzz scenes - the town hid it by accident), the quads asked short of the cube's reach, the wind's lean left out, the class's own slack, and either cache-on ask of the quads. | `test/audit637_shadow.test.js`: the 40-scene differential fuzz, a corner tree kept with its lean, the quads under the static cache, a list emptied whenever the walk opens it (B4's `discard()` now empties them every frame as well, so the walk's own emptying is the second guard - pinned on frames that never discard), the far-96 witness. |
| B3 | low (cost, this PR's) | The walk ran every frame there was a caster, so a still town with every map cached paid for lists nobody read: 0.31 -> 0.78 ms a frame (twelve lanterns, 2,000 flats - the audit's measure). | The walk is made by the first lantern that walks (`_candFor`); with no dynamic record in the frame no lantern's dynamic scan is asked - exact, as every arm of `_dynamicNear` reads a record's `dynamic` first. Pinned by walk count, a moving mesh included. Re-measured on the final code with the audit's own town (pre-pass on against off, interleaved): still 0.29 / 0.285 and 0.277 / 0.262 ms a frame - the same; windy 1.55 / 11.93 and 1.40 / 11.61. |
| B4 | low | Candidate lists held batch references past the frame - a destroyed batch's placement grid with them. | `discard()` empties every list as far as any was filled (`hw`). |
| B5 | low | A centre at infinity on two axes or more: a face's plane meets it as a NaN and culls nothing, but the cube dropped it. | Kept, as a NaN is. |
| B6 | nit | A negative radius reaches far + r along a face's axis, past r (1 + sqrt 2). Unreachable today. | `cubeReach(r)`, the one home of the reach - the walk and `_candidateQuads` both take it (D15i: the reach was written twice). |
| B7 | nit | `stats.culled`, shown on the perf meter, stopped counting what a lantern face never asked. | Its meaning written where it is declared (below, decided). |
| B8 = D15h | nit | `SHADOW_TUNING.facePrepass` was read but never declared, so the console's `__DF_SHADOW_TUNING` did not show it. | Declared, `true`. |

**The play-out and the pref door** (`src/net/online.js`, `src/systems/onlineLane.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 = D1 | medium (D: high) | The hold compared the drawn pose with `p.shown`, which an introduction (`_peer`: a welcome's roster, a join, a stranger's first pose) and a snap write themselves. A peer drawn first at its introduction's pose and never heard again was never clocked - `now - (p.drawnAt ?? now)` stayed 0 - and ran in place for the whole PEER_TIMEOUT_MS (500 frames of 500 in a 5 s probe): the field report again, for anyone who arrives after a player's tab went to the background mid-stride. | The law keeps its own record of the place it last drew (`p.drawn`): the clock starts at the first frame it draws a peer, whoever wrote `shown` first. |
| C2 | low (a regression this PR exposed) | The far tier's interval is POSE_FAR_SHARE of the sender's, and the sender's gate rounds each up to a whole frame: 1,333 ms from a 12 fps sender, 1,200 from 10. The timed play-out counted it as GAP_MAX_MS, walked a second, stood the rest and steered a second behind - a stand of 350-570 ms at every pose, which RUN-IN-PLACE drew as a walk cycle started over 43-48 times a minute (before it, as running in place). | A timed interval is the sender's own spacing and counts as itself up to PAUSE_MS, and a moving peer's own interval is walked whole (`_arriveTimed`). 12 fps: 661 frames in place -> 1; 10 fps: 470 -> 0; every near, hitch and stop row unchanged (`tools/playoutProbe.mjs`). |
| C3 | low | Mutants of the new lines survived: the clock's `?? now`, the z and y clauses, a runner (`mv` 2), the null first frame, the hold at half or at 0.4 at its use, and `>` against `>=`. | Pins for each, and the edge made the sender's own (`>=` - world.js reads moving while now < moved + the hold). |
| C4 | nit | A snap wrote `shown`, so a teleport after a stand read standing until its next drawn step. | Covered by C1's record: a snap is a step. |
| C5 | nit | The forced-pref comment called the table "the mods' switches". | "The Features registry's own switches" (RF4). |

**The docs, the pins and the merges**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D2 | high (process) | #630 had landed on main, and both sides had changed the Suite line: the pull request conflicted with its base, and a conflicted pull request runs no workflow. | Main merged in (`a9b162fba`), the count recounted by `test/manifest`; CI green on it. |
| D3 | medium | Two paragraphs said an A/B was "running as this is written" and "lands here before the pull request leaves draft"; no table ever landed, and the run they named had been made beside the pass's own test runs. | The A/B re-run on the audited code with nothing else running - below and in `Performance-Next.md`. The run cut short and the one made beside the audit's probes are not used. |
| D4 | medium | "Ready for the next announced window", of a relay change that is in no commit; the V8 section's "moved frame" likewise; and no ranked item for the world host's frame over the ceiling. | Each said as it is: prototyped in scratch, measured there, not committed. The world host's frame over V8's ceiling is ranked item 22 now. |
| D5 | medium | `perfexta`'s VERIFY wrapper took eight arguments and dropped the replay's ninth, so every lantern face its "rasterises nothing" proof checked walked every record - the candidate path was never proved. | It forwards the rest (PIN MOVED). |
| D6 | medium-low | The four records this branch re-aimed (ACC3c-11, GUILD1c's row mutant, PERF-EXT11-9, WEEDS1's lantern replay) said nothing of it. | Each carries its re-aim note now, as the 561 before them do. |
| D7 | medium-low | Two literals of one law: `SHOWN_MOVE_HOLD_MS` and world.js's `ONLINE_MOVE_HOLD_MS`, held equal by a regex. | World.js takes the watcher's constant (PIN MOVED: world1's import line, runinplace's one home). |
| D8 | low | "As onlineForcedSetting has always asked it" - it read the page first at DISC22-A; AUDIT RETRO1 G2 turned it. | "Since AUDIT RETRO1 G2", in the code, the test, the page and the row. |
| D9 | low | "Not warmed at idle, as every other on-demand program is" - the aura ring and the gate court's passes build in their first frame too. | "As the renderer's own on-demand programs are." |
| D10 | low | "The 98 records of the replay's own laws" - 45 of them aim at the replay. | Said as it is, and re-run here. |
| D11 | low | The panel's whole roster work and `rosterRows` alone came from two runs, so the part exceeded the whole. | Said as two runs. |
| D12 | low | "In the real game in headless Chromium", of a micro-benchmark on a bare WebGL2 context. | Said as it is. |
| D13 | low (process) | Nothing the pages measured could be made again from the tree: every figure came from a probe in the session's scratch. | `tools/frameProbe.mjs` and `tools/frameAb.mjs` (the real game's frame: the census, the CPU by sample count, the heap - frame-synced on `__frame`) and `tools/playoutProbe.mjs` (the play-out's tables, before and after); the pages cite them. |
| D15a | nit | The stand reaches riders too (`remotePlayers.js` reads `shown.mv`), before DISC7 B3's 1 s test; the page said on foot. | Said. |
| D15b | nit | "Within 14 m": the kick fires while `(1 - d/14) shake > 0.15`, about 13.3 m for a bolt and 13.5 for a blast, the falloff in `landFx`. | Said. |
| D15c | nit | First-use costs called "hitches of this kind" beside their own milliseconds. | They stand nobody by themselves; said. |
| D15d | nit | "The longest 2.9-4.0 s (the whole silence)" of a 3 s silence. | The committed probe's table, and why the timed run is a second longer. |
| D15e | nit | "The roadmap" named no section, and item 4 was "the arc's call" where For Mac lists it as Mac's. | Item 4, Mac's. |
| D15f | nit | The perf probe's dungeon URL quoted two ways, neither the probe's. | `/play/?shot&class=0&fps`. |
| D15g | nit | The perfshadow1 row credited "a NaN on any axis keeps it" to the cube-edge pin; the NaN cases are the town's. | The row says so. |
| D15i | nit | The 1 + sqrt 2 reach was written twice. | `cubeReach` (B6). |

## Decided, not changed

- **A8 - the order's locale is the one the page loaded with.** The collator built per comparison followed a host that
  changes its default locale mid-page (V8's LocaleConfigurationChangeNotification, SpiderMonkey's JS_ResetDefaultLocale)
  - and re-sorted the list under its reader as it did, which is the very thing CHAT-R1's tag clause exists to prevent.
  A reload takes the new locale. The comment says so.
- **B7 - `culled` is not recounted.** Counting what a lantern face never asks would put back the walk PERF-SHADOW1 took
  out; the meter's number is the replays' own culls, and its declaration says so.
- **C2's untimed arm keeps its clamp.** An arrival interval carries the line's jitter, which is what the clamp is for,
  and slam3 pins it. No live relay takes that path: the relay passes the send time from world162 on (SCALE2b).
- **D14 is Mac's** (above).
- **D15j - the index.** Field-bugs and audit pages are indexed in `Active-Arcs.md`, as every earlier one is; this page
  has its line there.
- **D15k** - commit `a313cfcba`'s message says it recorded the first-use costs, which `aa6d02132` already had. History
  stays as it is; this is the correction.

## Found while verifying

- **SLAM8 hashes every byte of the relay's bundle.** C2's first fix also corrected `net/wire.js`'s POSE_FAR_SHARE doc,
  and `test/relayversion.test.js` failed on it: a comment there is a relay version, and a relay deploy drops every
  player. The edit was taken back; the correction is item 19 of `Performance-Next.md`, for the next window.
- **B3 moved a law out from under a mutant.** With no walk in a still frame, the review's still room no longer sees
  PERF-SHADOW1-o (every lantern's quads asked with the walk) - it survived the sweep. The law it breaks still holds a
  frame some lanterns walk and others do not: a pin of that mixed frame kills it now (PIN MOVED).
- **The first audit-time A/B was not a measurement.** It ran beside the lenses' probes and this audit's suites, and its
  PR arm predated the shadow fixes; it was stopped and is not used (D3).
- **The frame probe's dungeon never readies** (the classic boot timed out at 20 minutes): `Performance-Next.md` item 20.

## The A/B on the audited code

Not completed before the merge. The run made beside the audit's own probes and suites was not used (D3), and Mac
asked to merge while the clean run on the audited code was still on its first scene, so it was stopped. What measures
this pull request's savings is what is recorded above and on the page: the walk counts and placement reads pinned in
node (`perfshadow1`, `audit637_shadow`), the baseline profile they were found in (the shadow pass 7.2 ms of the world
host's 16.1 at Knightstale by day), and the audit's synthetic night town on the final code - windy 1.40-1.55 ms a frame
of `render()` with the pre-pass against 11.6-11.9 without it, still the same either way (B3).
`tools/frameProbe.mjs` and `tools/frameAb.mjs` make the real-game A/B whenever a quiet machine is free.

## The mutation sweep

Every list with a record on a line a fix changed, or naming a test a fix moved, judged with `tools/mutate.mjs`:

- **`audit637.json`: 40 of 40 dead** - A1a-A11b (14), B1a-B6 (15), C1a-C3f (11). D7 is pinned by text (runinplace's one home, world1's import line).
- `runinplace.json` 5 of 5 (a and c re-aimed by content at C1's and C3's lines); `perfon3.json` 14 of 14 (a re-aimed at
  A6's); `scale2b.json` 40 of 40 (the standing-walked record re-aimed at C2's line); `perfshadow1.json` 19 of 19 (b, c,
  c2, d, j and o re-aimed by content, o's pin moved).
- PERF-EXT's and WEEDS1's 98 (`perfexta` 54, `perfextb` 36, `weeds1` 8): 97 dead, PERF-EXT11-9 equivalent as recorded.
- ACC3c-11 and GUILD1c's row mutant carry their notes now (D6); their lines are unchanged by A's fixes.

## Not verified here

There is no GPU in this container: the shadow pass's GPU work is unchanged by construction (the same draws), and a
player's frame rate is not measured. Nothing online was seen in a live room - the play-out over two real sessions on
fake sockets, the roster over the real module. The untimed play-out runs against no deployed relay.
