# PERF-NEXT — continuing the performance work, online included (2026-10-06)

*Mac: "I wanna look into how we can continue to improve performance, including for online".*

What this pass measured, what it fixed, and what is left - ranked, with the lever for each and whether it moves what a
player sees (those are Mac's). It follows PERF-UPD (`Performance-Updates.md`, 09-29), the last pass over the real game.

## How the pass was run

PERF-UPD's recipe, unchanged where it could be: the REAL game in headless Chromium (chromium-1194) on SwiftShader, over
the freeware ARENA2 (`tools/fetch-data.sh`'s zip, outside the tree), driven by `tools/frameProbe.mjs` and read by
`tools/frameAb.mjs` (committed at AUDIT 637 - the pass's first runs were scratch copies of them, and nothing in the tree
could make its figures again); the world host with the player standing (`?world&...&shot&play`), a fresh profile's
settings, 480x270. Script time is
measurable here and the frame rate is not (SwiftShader ~2.6 s a frame in town); the CPU profile is attributed BY SAMPLE
COUNT (V8's sampler, x the median interval), the census counts every WebGL call a frame exactly, the heap profile
samples every allocation (collected ones included). The two probe-only transforms PERF-UPD used, the tree untouched:
the stream's build slice served at 250 ms, the grass field filled at once. An A/B serves two worktrees - the base
(`main` at 73312bd5) and the change - one run after the other, never at once, and NOTHING ELSE RUNS while it does:
SwiftShader takes three of this container's four cores, so a test run beside a probe slows whichever arm it lands in.

Indoors the world host's modal frame returns before the line that sets `__shotReady`, so an indoor scene is ready when
`__mode()` is not the exterior and `__streamIdle()` says so (`npm run perf`'s dungeon row, `/play/?shot&class=0&fps`,
now opens the New Character window and never readies, and the frame probe's dungeon - the classic boot,
`?world&classic` - never readied inside 20 minutes either: noted below, not fixed here).

Online, the client and the relay were measured in node and Chromium over the real modules: the relay's `Room` over a
counting fake socket, the client's session over a fake socket, the hub's messages through the real parse.

## The baseline (main at 73312bd5)

Knightstale (Wayrest), the world host standing, 40 frames a window. Milliseconds of this container's CPU a frame, by
sample count - relative only (a gaming desktop's core is two to three times this one), and every figure carries the
probe's own census wrapper over the WebGL methods (~0.2 ms of GL call overhead and ~70 KB a frame of its argument
arrays, the same in every arm of an A/B).

| | 15:00 | 22:00 |
|---|---|---|
| the world host's frame (all of its JavaScript) | 16.1 | 18.8 |
| - the shadow pass (`beginFrame` -> `shadowPass.render`) | 7.2 | 9.8 |
| - - its replays | 5.0 | 7.6 |
| - billboards (the main pass) | 1.5 | 1.8 |
| garbage collection | 3.0 | 3.8 |
| WebGL calls / draws a frame | 6,199 / 1,087 | 7,122 / 1,122 |
| allocated a frame (collected objects included) | - | 2.1 MB, 1.1 MB of it in the shadow replays |

Outside the frame, on their own timers (a cost a second, not a frame - at ~0.4 fps here they read as a frame's): the
music synth (~2.2 ms a second here), and the movable HUD's sweep (`ui/hudLayout.js`, ~31 `querySelectorAll` a sweep,
on a 250 ms interval AND from the HUD's frame tick, so about eight sweeps a second where four were meant).

## PERF-ON3 — the chat roster, derived once and not once a frame

**Measured.** The chat panel asks `net/roster.js` for its rows on every frame the chat is open (`ui/chatPanel.js`
paintWho - "a peer can join without a line being said"), and the World tab's list is everyone the hub knows: up to
CHAT_ROSTER_MAX from the welcome and every join after it. Each ask rebuilt every row (sanitizeName's character walk,
the tag's hash, the badge's arrays), sorted them with `localeCompare(b, undefined, options)` - which ECMA-402 defines as
CONSTRUCTING an Intl.Collator, so every comparison of the sort built one - and then built a key string over every row
to learn that nothing had changed. The panel's roster work a frame, over the real module in node: 1.6 ms at 50 online,
8.8 at 200, 24.8 at 500, 48.6 at 1,000 (`rosterRows` alone, measured in a separate run: 9.3 at 200, 24 at 500, 49 at
1,000 - two runs, so the two series do not add up; AUDIT 637 D11). A frame rate that fell with the number of players
online while the chat was open, for a list that had not changed.

**The fix, and the answer is the old one exactly.**
- ONE COLLATOR (`NAME_ORDER`), built once with the options the call passed - the same comparison by the spec's own
  definition of localeCompare.
- A ROW IS KEPT WHILE WHAT IT IS MADE OF IS - by id, with every input it reads compared by value (the name, my own
  flag, the title, the glyphs and the seat claim element by element - an array changed in place is a change - and the
  guild's tag), so a row is reused only where a fresh one would equal it. By id and not by object, because four tabs
  compose a new source every frame over the same peers (the party's, the guild's, the nearby's and a placed region's;
  AUDIT 637 A10: the party's was left out of this list, and it is the one that builds new peer objects).
- AN UNCHANGED LIST IS NOT SORTED AGAIN: the same rows in the same order sort to the same list (the sort is stable, so
  a tie is settled the same way), answered as the same FROZEN array - and the panel short-circuits on that identity,
  with the count, the tab's word and the open menu, before it builds its repaint key.

After: 0.03 ms a frame at 500 online, 0.08 at 1,000 (a join every 30 frames: 0.04 and 0.12). Pins:
`test/perfon3.test.js` (3) - the old rosterRows is the oracle over six seeded 260-step stories through every tab's
source; the savings by identity and by count (no localeCompare); the panel repaints on every change it repainted on
before. Mutants: `tools/mutants/perfon3.json`, 14, all dead; ACC3c-11 and GUILD1c's row mutants re-aimed by content.

## PERF-SHADOW1 — a lantern's six faces share one walk

**Measured.** The shadow pass was 7.2 ms of the world host's 16.1 ms of JavaScript a frame at Knightstale by day and
9.8 of 18.8 by night, and nearly all of it was walking. Every replay - each sun cascade, each face of each lantern -
walked every record and every flat of the frame: the filter chain, `batchSphere`, the six planes, and for a pixel-wide
wood its placement grid; and `_dynamicNear` walked the whole frame again once a lantern. Under Steady shadows
(FLICKER-FIX, 10-02, on by default) every lantern with a mover or a swaying tree near it redraws its six dynamic faces
EVERY frame, and the caster table holds twelve - so a windy town walked its whole record list some eighty times a frame
to draw what stood within a few metres of each lantern. By night the replays also allocated 1.1 MB a frame, half of
everything the frame allocated.

**The fix.** ONE walk a frame (`_casterCandidates`) finds each ranked lantern's candidates BY THE SPHERE: the records,
and of a billboard list the flats, that CAN reach its cube. A face is a 90-degree perspective, so a sphere it takes
stands within far + r (1 + sqrt 2) of the light on every axis (CUBE_REACH, `cubeReach`; a float32 slack over it,
because the real planes take spheres past the exact bound - AUDIT 637 B1: the side planes' rounding, 1.3e-3 30 km out,
was all the first cut measured, at fars to 36; the far plane is row 3 less row 2 of the float32 matrix, and its
rounding grows with far x (far + the place): 2.75e-3 past the bound for a far-96 lantern at the origin, where the
slack was 2e-3, and the pre-pass dropped a draw a face made. The slack carries that term now, CUBE_F32_FAR, and the
worst corner at any far a light has, out to 120 km, is 0.114 of it). AUDIT 637 B3: the walk is made by the first lantern
that walks a frame - a face it draws, or its dynamic scan in a frame with a dynamic record - never up front, and with
no dynamic record no lantern's dynamic scan is asked: built every frame, a still town of twelve cached lanterns over
2,000 flats paid 0.31 -> 0.78 ms a frame for lists nobody read (the audit's own measure). A lantern ABOUT TO DRAW
a face then asks its placed batches of their quads, once a frame (`_candidateQuads`: none in that grown cube, and the
batch leaves its lists - and a record left with no flat leaves them too). Never in the walk: the PERF-EXT review's law
is that a still room drawn whole reads no placement a frame (`test/perfexta.test.js`), and the first cut of this slice,
which asked every lantern's quads in the walk, broke it - its own suite said so. The faces and `_dynamicNear` then walk
only the candidates, in the records' own order, and ask every question they asked before - so a face draws exactly
what it drew. A sphere with a NaN on any axis is always a candidate (the planes never cull one; `cubeKeeps` carries the
NaN through Math.max, where a test axis by axis culled a sphere NaN on one axis by another - the town's pin found it),
and a lantern placed by a NaN gets none (its faces walk everything, as before). AUDIT 637: a centre at infinity on two
axes or more is kept too (B5 - a plane meets it as a NaN), a negative radius reaches far + r (B6), and discard() empties
every lantern's lists, so none holds a batch past the frame (B4).

**Held.** `test/perfshadow1.test.js` (4): every draw of every frame - program, VAO, framebuffer, count, offset, order -
against the same pass with the pre-pass off, over random towns by night and day, steady and not; the saving by count (a
far moving wood is read by the main pass and the air pass alone; a wood whose sphere holds four lanterns' cubes and no
tree of it is dropped by one cube query a lantern, where every face walked its placements and bound its program); and
the cube against the real float32 planes at the edge of a face, near the origin and out to 120 km.
`tools/mutants/perfshadow1.json`: 19, all dead; and PERF-EXT's and WEEDS1's 98 records (`perfexta.json` 54,
`perfextb.json` 36, `weeds1.json` 8 - 45 of them aimed at the replay, the rest at the renderer, the bounds, the world
host and the flats' distance; AUDIT 637 D10: this line called them all the replay's) still die over it - 97 dead,
PERF-EXT11-9 equivalent as recorded, re-run over the audited code. AUDIT 637's pins are `test/audit637_shadow.test.js`
(10): every far a light has, the far-96 case end to end, a 40-scene differential fuzz, a corner tree kept with its lean,
the quads asked under the static cache, still and mixed frames by walk count, discard, and the degenerate edges -
`tools/mutants/audit637.json` B1a-B6, all dead.

**The A/B in the real game** was not completed before the merge (AUDIT 637 D3): the run made beside the audit's own
probes was not used, and the clean one on the audited code was stopped on its first scene when Mac asked to merge.
The saving is measured by the walk counts and placement reads pinned in node, and by the audit's synthetic night town
(twelve lanterns, 2,000 flats, 300 meshes) on the final code: windy, 1.40-1.55 ms a frame of `render()` with the
pre-pass against 11.6-11.9 without; still, the same either way. `tools/frameProbe.mjs` + `tools/frameAb.mjs` make the
real-game A/B on a quiet machine.

## PERF-URL2 — the forced-pref table asked before the page

`getPref` asks `onlineForcedPref` on every read - hundreds a frame - and it read `location.search` (a DOM getter, ahead
of PERF-URL's memo) before looking the key up in a table that forces a handful of keys (nine once the features load).
0.09 ms a frame of `isOnlinePage` under it, offline, by the profile. The table first now, as `onlineForcedSetting` has
asked it since AUDIT RETRO1 G2 (AUDIT 637 D8: not "always" - it read the page first at DISC22-A): two pure reads, the
same answer. `test/perfurl2.test.js` (2); 3 mutants, dead. (A forced key - the sea's own switch is one - still reads the
page on every read: the rest of that door is item 4 below.)

## V8'S CEILING — the functions too big to optimize

V8 never optimizes a function whose bytecode is over `--max-optimized-bytecode-size` (61,440 bytes in this Chromium):
it stays in the interpreter and the baseline compiler for the life of the page, and its arithmetic boxes and its
iterators allocate. Measured in this Chromium on a hot loop: 16 times slower past the line than under it.

**The census** (`--print-bytecode` over the real game booting Knightstale and 15 frames: 16,290 functions compiled):
three are over the line - the world host's `frame` (99,547 bytes, every frame), `bootWorld` (92,098, once) and a
module's top level (84,107, once). Next below: `buildPixelNow` 38,420 and another host's `frame` 26,742. The tiering
trace over the same window: the shadow pass's functions (`replay`, `_casterCandidates`, `_dynamicNear`, `batchSphere`,
the placement queries) reach TurboFan within the window; the world host's `frame` is never marked. On the relay,
`Room._message` is over the line too (69,858 bytes, node 22).

Whether the world host's frame is brought under the line is open (item 22): a prototype in this pass's scratch moved
its largest self-contained blocks into functions of their own (24 lines, the text between untouched), and its A/B under
a long session's tiering (V8's invocation thresholds lowered for both arms, since a once-a-frame function never reaches
them at SwiftShader's ~0.4 fps) was stopped unfinished with the rest (AUDIT 637 D4: this paragraph said "running now").

## Online, measured

**The client.**
- The chat roster - PERF-ON3 above: up to 48.6 ms a frame at 1,000 online with the chat open, 0.08 now.
- The host's per-peer passes (`world.js` onlineFrame): ~1.2 us a peer a frame in node, and getPref three times a peer
  a frame (~0.22 ms at 200 peers in Chromium). Small.
- An inbound message: 19-21 us of main thread in Chromium, most of it JSON.parse; poses bundled per listener per flush
  cost 6.5-8.3 us a pose.
- The realm checkpoint stringifies, parses and stringifies the whole save every 120 s (`realmSaves.js` idleKeyOf): a
  hitch that grows with the save.

**The relay** (a relay change is a deploy that drops every player once - batched into announced windows).
- `Room._message` is past V8's ceiling (69,858 bytes of bytecode; `--trace-opt` never marks it), and its pose arm
  spreads the socket index and re-derives each listener's map pixel once a socket. Measured on the real Room over a
  counting fake: 108.5 us a moving pose at 200 players in one map pixel, 39.3 with the pose arm split out, the index
  iterated and the range test hoisted - no behaviour change. That change is a prototype in this pass's scratch, measured
  there and NOT committed (AUDIT 637 D4: this line called it "ready"); it goes up as its own pull request, in an
  announced window.
- The foes lane is not fan-bounded, and a full frame goes every 2 s even with no foes: ~N/2 frames a second for each
  client in a crowd of N.
- Poses quantised and with defaults omitted: -35% bytes (SCALE5's slimmer poses).

## What is left, ranked

Each with what was measured, the lever, and whether it moves what a player sees (those are Mac's). Figures are this
container's CPU, or node/Chromium micro-benchmarks over the real modules where named.

**The client's CPU (measured here).**
1. ~~**The sun's three cascades walk the frame each** - 1.8 ms a frame by day at Knightstale, three walks of every
   record and flat. One shared walk (each flat's sphere once, tested against the three volumes) is the cascades' half
   of PERF-SHADOW1. Nothing a player sees.~~ SHIPPED 2026-10-09: PERF-SUN3 (`Performance-Online.md`).
2. **Input polls allocate** - `ui/input.js` actionDown walks the binding Maps with destructured entries for every
   action asked, every frame: ~80 KB of garbage a frame (night, Knightstale). An action -> codes index rebuilt on a
   rebind would end it, but codeDown carries DFU's modifier-assignment order (InputManager :1695-1711): its own slice,
   with the parity pins.
3. **The main billboard pass's `drawOne`** is a closure minted on every `drawBillboards` call (`render/renderer.js`);
   the tiering trace marks a new one for Maglev seven times in fifteen frames and never for TurboFan. A method with its
   lasts on the renderer would give it one identity. Unmeasured beyond the trace: measure first.
4. **The page doors** - `location.search` is read on every getPref of a forced key (the sea's switch: 0.11 ms a frame
   here) and on every `isEnhanced()` (the skin's door). The one in-page writer of the URL is publishBootParams, so a
   cache it invalidates would end the reads - but that overturns PERF-URL's "not a latch" rule, so it is Mac's call (For
   Mac; AUDIT 637 D15e: this line said the arc's).
5. ~~**The movable HUD sweeps twice as often as it means to** - a 250 ms interval AND the HUD's frame tick, each on its
   own clock: ~8 sweeps a second of ~31 `querySelectorAll`. Small (~0.1 ms a sweep on a desktop core); one clock.~~
   SHIPPED 2026-10-09: PERF-HUD1 (`Performance-Online.md`; 34 asks a sweep on that tree).
6. ~~**A per-frame closure as a call target** - `renderer._renderPasses` mints `bindVao` every frame and hands it to the
   shadow and air passes; V8 deoptimized the shadow replay once on it in node ("wrong call target"). A bound method
   kept on the renderer is the same call.~~ SHIPPED 2026-10-09: PERF-VAO1 (`Performance-Online.md`; no gain measured).

7. **The spell effects' first use, per engine** (IMPACTFX; `01-Overview/Field-Bugs-2026-10-06b.md`) - the light's pass
   is compiled inside the frame of the first landing an engine draws (6.8 ms on SwiftShader), not warmed at idle as the
   renderer's own on-demand programs are (PERF-WARM - AUDIT 637 D9: not every program is; the aura ring and the gate
   court's passes build in their first frame too), and each look's sound is baked on its first play (3-8 ms in node).
   Both belong to the cast ENGINE, and every dungeon entered makes one. The renderer owning the pass (one a page, in
   its warmSteps) and one sound bank an audio engine would pay each once a page, at idle. Nothing a player sees.

**The GPU (not measurable on SwiftShader - for a player's card).**
8. **The cloud march** - 21-29% of SwiftShader's outdoor frame in every weather, and the Render Scale does not touch it
   (PERF-UPD). Every lever changes the sky's look: Mac's.
9. **Steady shadows' draws** - every lantern with a mover or a sway by it redraws its six dynamic faces every frame (42
   face passes a frame at Knightstale by day). PERF-SHADOW1 took their CPU walk; the GPU's passes are FLICKER-FIX's
   trade for stability, and the cadence is Mac's.
10. **The flats' draw count** - ~1,090 draws a frame in a town, one a (archive, record) a map pixel. A texture array
   over an archive's records, or centres merged across pixels: a renderer project, nothing a player sees.
11. **An automatic quality governor** - the Render Scale chosen from the measured frame. It changes the picture as the
    machine struggles: Mac's.

**Online - the client.**
12. **The host's per-peer passes** - getPref three times a peer a frame: safe to tidy.
13. **Inbound messages** - JSON.parse is most of a message's 19-21 us; a new frame type for bundled poses needs a relay
    deploy (SCALE5's slimmer poses).
14. **The realm checkpoint** - the idle key from the object, not three passes over the whole save: no behaviour change.
    MEASURED 2026-10-09 (`Performance-Online.md`): a new character's save is 103 KB, about a millisecond of passes every
    two minutes - left, as not worth the composers' seam it would move; a long life's save is the case that would.

**Online - the relay (each a deploy that drops every player once - batched, announced).**
15. **`_message` under the ceiling and the pose arm tightened** - 108.5 -> 39.3 us a moving pose at 200 in one pixel,
    measured on a prototype in this pass's scratch, no behaviour change. Not committed: its own pull request, in an
    announced window.
16. **The foes lane** fan-bounded, and no full frame with no foes - tiering far listeners as poses are tiered changes
    what they see: a design call.
17. **Slimmer poses** - quantised, defaults omitted, -35% bytes measured; binary later. SCALE5.
18. **SCALE3's load harness** exists now (2026-10-08, `tools/loadHarness.mjs`, `npm run load`;
    `11-Multiplayer/Scale-Arc.md` SCALE3): both Workers in local workerd under a fleet of the client's own modules. At 100
    bots in one cell over three threads a pose's age is p50 19 ms, p99 78 ms, with 132 frames a bot-second heard; one
    thread is the harness's own queue. The staging pair is left; the benches this pass used (a Room over a counting
    fake, the client session over a fake socket) stay its microscope.
19. **`net/wire.js`'s POSE_FAR_SHARE doc** says the far interval is clamped at GAP_MAX_MS - true for an arrival
    interval, no longer for a timed one (AUDIT 637 C2). The file's bytes are the relay's version (SLAM8), so its
    correction rides the next relay deploy, with no behaviour of its own.

**Tooling.**
20. `npm run perf`'s dungeon row (`/play/?shot&class=0&fps`) now stands on the New Character window and never readies;
    the frame probe's dungeon (the classic boot) never readied inside 20 minutes.
21. Indoors the world host never sets `__shotReady` (its modal frame returns first); the probe reads `__mode()` and
    `__streamIdle()` there.

**V8.**
22. **The world host's `frame` over the ceiling** (99,547 bytes of bytecode in Chromium; by node 22's V8 compiled eagerly,
    `--no-lazy --print-bytecode`, 100,806 at this pass's merge and 105,613 on 2026-10-09 - `Performance-Online.md`;
    61,440 is the line) never leaves the interpreter. Moving its largest blocks into functions of their own brings it under; unmeasured in the real game, and
    it moves every cite into world.js below the first block - its own pull request, if its A/B shows a gain.

## For Mac

- **The relay's pose path** (15) is measured on a prototype - 108.5 -> 39.3 us a moving pose at 200 players in one map
  pixel, no behaviour change - and it is a relay deploy, which drops every player once. It is not committed: it goes up
  as its own pull request in the next window you announce, with item 19's doc correction beside it.
- **Steady shadows' GPU cost** (9): this pass took the CPU's walk out of the every-frame lantern redraws; the redraws
  themselves (42 face passes a frame at Knightstale by day) are FLICKER-FIX's trade for stability. A slower cadence for
  a lantern whose only reason is a swaying tree would trade some of that back.
- **The cloud march** (8) and **an automatic quality governor** (11) both change what a player sees.
- **The page doors** (4): ending the per-read `location.search` overturns PERF-URL's "not a latch" rule.
- **The foes lane** (16): bounding it by distance changes what a far player sees of a fight.
