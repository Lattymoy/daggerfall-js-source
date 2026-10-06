# PERF-NEXT — continuing the performance work, online included (2026-10-06)

*Mac: "I wanna look into how we can continue to improve performance, including for online".*

What this pass measured, what it fixed, and what is left - ranked, with the lever for each and whether it moves what a
player sees (those are Mac's). It follows PERF-UPD (`Performance-Updates.md`, 09-29), the last pass over the real game.

## How the pass was run

PERF-UPD's recipe, unchanged where it could be: the REAL game in headless Chromium (chromium-1194) on SwiftShader, over
the freeware ARENA2 (`tools/fetch-data.sh`'s zip, outside the tree), driven by probes in the session's scratch; the
world host with the player standing (`?world&...&shot&play`), a fresh profile's settings, 480x270. Script time is
measurable here and the frame rate is not (SwiftShader ~2.6 s a frame in town); the CPU profile is attributed BY SAMPLE
COUNT (V8's sampler, x the median interval), the census counts every WebGL call a frame exactly, the heap profile
samples every allocation (collected ones included). The two probe-only transforms PERF-UPD used, the tree untouched:
the stream's build slice served at 250 ms, the grass field filled at once. An A/B serves two worktrees - the base
(`main` at 73312bd5) and the change - one run after the other, never at once, and NOTHING ELSE RUNS while it does:
SwiftShader takes three of this container's four cores, so a test run beside a probe slows whichever arm it lands in.

Indoors the world host's modal frame returns before the line that sets `__shotReady`, so an indoor scene is ready when
`__mode()` is not the exterior and `__streamIdle()` says so (`npm run perf`'s dungeon row, `?shot&class=0`, now opens
the New Character window and never readies - noted below, not fixed here).

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
8.8 at 200, 24.8 at 500, 48.6 at 1,000 (`rosterRows` alone: 9.3 at 200, 24 at 500, 49 at 1,000). A frame rate that
fell with the number of players online while the chat was open, for a list that had not changed.

**The fix, and the answer is the old one exactly.**
- ONE COLLATOR (`NAME_ORDER`), built once with the options the call passed - the same comparison by the spec's own
  definition of localeCompare.
- A ROW IS KEPT WHILE WHAT IT IS MADE OF IS - by id, with every input it reads compared by value (the name, my own
  flag, the title, the glyphs and the seat claim element by element - an array changed in place is a change - and the
  guild's tag), so a row is reused only where a fresh one would equal it. By id and not by object, because three tabs
  compose a new source every frame over the same peers.
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

**The fix.** ONE walk a frame (`_casterCandidates`, before the rank loop) finds each ranked lantern's candidates BY THE
SPHERE: the records, and of a billboard list the flats, that CAN reach its cube. A face is a 90-degree perspective, so
a sphere it takes stands within far + r (1 + sqrt 2) of the light on every axis (CUBE_REACH; a float32 slack over it,
because the real planes take spheres up to 1.3e-3 past the exact bound 30 km from the origin). A lantern ABOUT TO DRAW
a face then asks its placed batches of their quads, once a frame (`_candidateQuads`: none in that grown cube, and the
batch leaves its lists - and a record left with no flat leaves them too). Never in the walk: the PERF-EXT review's law
is that a still room drawn whole reads no placement a frame (`test/perfexta.test.js`), and the first cut of this slice,
which asked every lantern's quads in the walk, broke it - its own suite said so. The faces and `_dynamicNear` then walk
only the candidates, in the records' own order, and ask every question they asked before - so a face draws exactly
what it drew. A sphere with a NaN on any axis is always a candidate (the planes never cull one; `cubeKeeps` carries the
NaN through Math.max, where a test axis by axis culled a sphere NaN on one axis by another - the town's pin found it),
and a lantern placed by a NaN gets none (its faces walk everything, as before).

**Held.** `test/perfshadow1.test.js` (4): every draw of every frame - program, VAO, framebuffer, count, offset, order -
against the same pass with the pre-pass off, over random towns by night and day, steady and not; the saving by count (a
far moving wood is read by the main pass and the air pass alone; a wood whose sphere holds four lanterns' cubes and no
tree of it is dropped by one cube query a lantern, where every face walked its placements and bound its program); and
the cube against the real float32 planes at the edge of a face, near the origin and out to 120 km.
`tools/mutants/perfshadow1.json`: 19, all dead; and the 98 records of the replay's own laws (`perfexta.json` 54,
`perfextb.json` 36, `weeds1.json` 8) still die over it - 97 dead, PERF-EXT11-9 equivalent as recorded.

**The A/B in the real game** (the final code; the base and the change one run after the other on a quiet machine; ms
a frame by sample count) is running as this is written - Knightstale by day and by night, and a dungeon - and its table
lands here before the pull request leaves draft.

## PERF-URL2 — the forced-pref table asked before the page

`getPref` asks `onlineForcedPref` on every read - hundreds a frame - and it read `location.search` (a DOM getter, ahead
of PERF-URL's memo) before looking the key up in a table that forces a handful of keys (nine once the features load).
0.09 ms a frame of `isOnlinePage` under it, offline, by the profile. The table first now, as `onlineForcedSetting` has
always asked it: two pure reads, the same answer. `test/perfurl2.test.js` (2); 3 mutants, dead. (A forced key - the
sea's own switch is one - still reads the page on every read: the rest of that door is in the roadmap.)

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

Whether the world host's frame is brought under the line - its largest self-contained blocks moved into functions of
their own, the text between untouched - waits on its own A/B, running now: the base and the moved frame under a long
session's tiering (V8's invocation thresholds lowered for both arms, since a once-a-frame function never reaches them
at SwiftShader's ~0.4 fps).

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
  iterated and the range test hoisted - no behaviour change, and ready for the next announced window.
- The foes lane is not fan-bounded, and a full frame goes every 2 s even with no foes: ~N/2 frames a second for each
  client in a crowd of N.
- Poses quantised and with defaults omitted: -35% bytes (SCALE5's slimmer poses).

## What is left, ranked

Each with what was measured, the lever, and whether it moves what a player sees (those are Mac's). Figures are this
container's CPU, or node/Chromium micro-benchmarks over the real modules where named.

**The client's CPU (measured here).**
1. **The sun's three cascades walk the frame each** - 1.8 ms a frame by day at Knightstale, three walks of every
   record and flat. One shared walk (each flat's sphere once, tested against the three volumes) is the cascades' half
   of PERF-SHADOW1. Nothing a player sees.
2. **Input polls allocate** - `ui/input.js` actionDown walks the binding Maps with destructured entries for every
   action asked, every frame: ~80 KB of garbage a frame (night, Knightstale). An action -> codes index rebuilt on a
   rebind would end it, but codeDown carries DFU's modifier-assignment order (InputManager :1695-1711): its own slice,
   with the parity pins.
3. **The main billboard pass's `drawOne`** is a closure minted on every `drawBillboards` call (`render/renderer.js`);
   the tiering trace marks a new one for Maglev seven times in fifteen frames and never for TurboFan. A method with its
   lasts on the renderer would give it one identity. Unmeasured beyond the trace: measure first.
4. **The page doors** - `location.search` is read on every getPref of a forced key (the sea's switch: 0.11 ms a frame
   here) and on every `isEnhanced()` (the skin's door). The one in-page writer of the URL is publishBootParams, so a
   cache it invalidates would end the reads - but that overturns PERF-URL's "not a latch" rule, so it is the arc's call.
5. **The movable HUD sweeps twice as often as it means to** - a 250 ms interval AND the HUD's frame tick, each on its
   own clock: ~8 sweeps a second of ~31 `querySelectorAll`. Small (~0.1 ms a sweep on a desktop core); one clock.
6. **A per-frame closure as a call target** - `renderer._renderPasses` mints `bindVao` every frame and hands it to the
   shadow and air passes; V8 deoptimized the shadow replay once on it in node ("wrong call target"). A bound method
   kept on the renderer is the same call.

**The GPU (not measurable on SwiftShader - for a player's card).**
7. **The cloud march** - 21-29% of SwiftShader's outdoor frame in every weather, and the Render Scale does not touch it
   (PERF-UPD). Every lever changes the sky's look: Mac's.
8. **Steady shadows' draws** - every lantern with a mover or a sway by it redraws its six dynamic faces every frame (42
   face passes a frame at Knightstale by day). PERF-SHADOW1 took their CPU walk; the GPU's passes are FLICKER-FIX's
   trade for stability, and the cadence is Mac's.
9. **The flats' draw count** - ~1,090 draws a frame in a town, one a (archive, record) a map pixel. A texture array
   over an archive's records, or centres merged across pixels: a renderer project, nothing a player sees.
10. **An automatic quality governor** - the Render Scale chosen from the measured frame. It changes the picture as the
    machine struggles: Mac's.

**Online - the client.**
11. **The host's per-peer passes** - getPref three times a peer a frame: safe to tidy.
12. **Inbound messages** - JSON.parse is most of a message's 19-21 us; a new frame type for bundled poses needs a relay
    deploy (SCALE5's slimmer poses).
13. **The realm checkpoint** - the idle key from the object, not three passes over the whole save: no behaviour change.

**Online - the relay (each a deploy that drops every player once - batched, announced).**
14. **`_message` under the ceiling and the pose arm tightened** - 108.5 -> 39.3 us a moving pose at 200 in one pixel,
    measured, no behaviour change. Ready for the next announced window.
15. **The foes lane** fan-bounded, and no full frame with no foes - tiering far listeners as poses are tiered changes
    what they see: a design call.
16. **Slimmer poses** - quantised, defaults omitted, -35% bytes measured; binary later. SCALE5.
17. **SCALE3's load harness** still does not exist; the benches this pass used (a Room over a counting fake, the client
    session over a fake socket) are its measuring half.

**Tooling.**
18. `npm run perf`'s dungeon row (`/play/?shot&class=0`) now stands on the New Character window and never readies.
19. Indoors the world host never sets `__shotReady` (its modal frame returns first); the probe reads `__mode()` and
    `__streamIdle()` there.

## For Mac

- **The relay's pose path** (14) is measured and ready - 108.5 -> 39.3 us a moving pose at 200 players in one map
  pixel, no behaviour change - and it is a relay deploy, which drops every player once. It waits for the next window
  you announce; it goes up as its own pull request.
- **Steady shadows' GPU cost** (8): this pass took the CPU's walk out of the every-frame lantern redraws; the redraws
  themselves (42 face passes a frame at Knightstale by day) are FLICKER-FIX's trade for stability. A slower cadence for
  a lantern whose only reason is a swaying tree would trade some of that back.
- **The cloud march** (7) and **an automatic quality governor** (10) both change what a player sees.
- **The page doors** (4): ending the per-read `location.search` overturns PERF-URL's "not a latch" rule.
- **The foes lane** (15): bounding it by distance changes what a far player sees of a fight.
