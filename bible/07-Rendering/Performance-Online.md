# PERF-ON4 — the online frame, measured in the real game (2026-10-09)

*Mac: "I want to continue working to increase performance across the board, especially for online".*

The pass after PERF-NEXT (`Performance-Next.md`, 10-06), which measured online in node, over the modules. This one
measured the frame a player online pays: the real game, online, over the real relay and the real account service, with
other players round it. What it measured, what it fixed, and what is left.

## How the pass was run

**Offline**, PERF-NEXT's recipe unchanged: the real game in headless Chromium (chromium-1194) on SwiftShader, over the
freeware ARENA2 (`tools/fetch-data.sh`'s zip, outside the tree), `tools/frameProbe.mjs` at Knightstale (Wayrest) by day
and by night, 480x270, 40 frames a window; milliseconds of this container's CPU a frame, by sample count, relative only.

**Online, new: `tools/onlineFrameProbe.mjs`.** Both Workers stood up in local workerd as SCALE3's load harness stands
them (`tools/loadHarness.mjs` standServices: a throwaway signing pair, every migration); the player a guest with a realm
character whose first save is the one an offline boot at Knightstale composes (the world host's own composer); the
online boot itself (`?world&online&realm=<id>&load&server=ws://127.0.0.1:<relay>`, the account's session in the page's
storage); then crowds of 0, 20 and 60 bots - each the client's own OnlineSession over the harness's socket, on the hub
and in the player's cell, standing 4-28 m round the pose the relay hears from the player, seven in ten walking a 2 m
ring - each crowd measured by the frame probe's own three windows (`measure`: the census, the CPU profile, the heap).
Three probe-only edits beside the frame probe's two, the tree untouched: the account base may be the local service
(`accountClient.js serviceBase` answers https alone); `?shot` survives the online boot (REALM P0.1 refuses it there,
`onlineLane.js ONLINE_REFUSED_FLAGS`, because it installs the probe seams - which are the instrument here); and the
composer's hook. Every edit is a table now (`FRAME_PROBE_EDITS`, `ONLINE_PROBE_EDITS`), each needle asserted where it is
made and held to the tree by `test/perfon4_probes.test.js`, so a needle a change moves fails the suite and not the next
probe run - and, since AUDIT PERF-ON4 (`01-Overview/Audit-Perf-On4.md`), each edit's effect with it. The online probe
now settles its page before the first crowd (the grass, then the Living World's way book standing still), measures a
crowd only when the session is open and draws exactly it (or fails the run, saying so), and runs its crowds in the
order given, 0, 20, 60 and 0 again by default; this page's first figures came before that (below).

What it is not. `?tod` is still refused online, so the sky is the shared clock's and two arms stand at different hours:
an online A/B is read by its own functions and its allocations, not the frame's total. The bots wear a bare look and no
Morrowind data is attached, so the crowd is drawn as the doll and the class sprite, not Eye Of The Beholder's walkers or
the Morrowind bodies. The census of the base's 20 and 60 crowds is missing (the frame probe takes its wrappers off after
its window, and the first cut of this probe put them on once; they go on again for each crowd now).

## The baseline (main at 24af4652)

Offline, Knightstale: the world host's frame 13.5 ms by day and 12.6 by night (16.1 and 18.8 at PERF-NEXT); the shadow
pass 3.2 and 2.2, its replays 2.4 and 0.9; the billboards 1.8 and 1.7; 6,158 and 7,128 WebGL calls a frame, 1,059 and
1,094 draws; 1.6 and 1.7 MB allocated a frame. Outside the frame, on their own timers, the movable HUD's sweeps (~1.4 ms
a second here) and the music's pump.

Online, the same town:

| crowd | the world host's frame | the Living World | onlineFrame | inbound messages | peers' sounds | allocated a frame |
|---|---|---|---|---|---|---|
| 0 | 36.5 | 17.4 | 0.8 | - | - | 7.3 MB |
| 20 | 39.0 | 12.9 | 4.0 | 8.7 | 2.4 | 6.5 MB |
| 60 | 39.5 | 8.9 | 8.0 | 9.1 | 6.6 | 6.1 MB |

(ms of this container's CPU a frame - at SwiftShader's half a frame a second, the messages' and the sounds' columns are
two seconds' worth; the Living World's falls between the rows because its waiting was ending, below.) Online with nobody
else there the frame was nearly three times the offline one, and most of the difference was the Living World's - 17.4
ms of the 23 (AUDIT PERF-ON4: this said all of it). The rest this record does not explain: the two stood at different
hours, and the online probe measured fifty frames after its boot where the offline one measured after its grass
settled - the crowds in their order, too, were each later than the one before (AUDIT PERF-ON4 F3; the re-run below).

## PERF-WAYS1 — the Living World's ways, asked while the asking is cheap

The Living World is on by default in both lanes (`livingSwitch.js livingWorldOn`: the enhanced skin and the player's
switch, which online is the player's too - `features.js`; AUDIT PERF-ON4: this said online forced it). While any way a
town's trips needed was unasked, every reader of the trips (`livingTown.js _roadsOf` through the host's
`livingTripsOf`, and the roads' layer, `livingRoads.js sweepOn`) planned every trip of every town within reach again,
each frame, and answered undefined: 16.8 ms of the 36.5 (of the Living World's 17.4), and 3.5 MB of the frame's
allocations. The ways came at LW3's two a frame (`systems/livingWorld/ways.js`), and a
region asks hundreds of pairs - at the probe's half a frame a second the town waited all fifteen minutes it was watched
(17.4 ms, 12.9 at six minutes, 8.9 at fourteen); at 60 fps the same pairs are seconds of such frames on every arrival.
The planner is not the dear part. On the real map's ground (AUDIT PERF-ON4: 20,000 of the 231,819 town pairs within
18 pixels, `planRoute` as the book calls it, the climate, the heights and the water) a pair is 0.16 ms on Hazelnut's
roads and 0.22 on the generated network on average, p99 0.8 and 1.1; one pair in a thousand on the roads and three on
the generated network take over 2 ms (the dearest 18), and a network's first unroutable pair about 180 (its land pieces
folded, once). (`tools/livingPerfProbe.mjs`'s 0.10 and 2.27, which this record quoted, plan on the roads alone, with no
ground.)

**The fix.** LW3's two a frame stay the floor; past them the book asks on while the frame's asking has taken under
WAYS_MS_PER_FRAME (2 ms of its own clock) and never past WAYS_MAX_PER_FRAME (32: a browser's clock is coarse). The same
pairs, planned by the same planner on the same network in the same direction - every way the one it was, and every
trip, visitor and party with it. Over a synthetic region of 81 towns a town's trips and visitors were known in 64 frames
where they took 656 (1,311 pairs, the same pairs; the frames' work 0.8 s against 7.4 s of this container's CPU).

**Measured online** (the same boot and save, the after arm; ms of this container's CPU a frame):

| crowd | the world host's frame | the Living World | its trips planned again | allocated a frame |
|---|---|---|---|---|
| 0 | 36.5 -> 19.4 | 17.4 -> 1.4 | 16.8 -> 0.8 | 7.3 -> 2.5 MB |
| 20 | 39.0 -> 22.2 | 12.9 -> 0.7 | 12.2 -> 0 | 6.5 -> 3.3 MB |
| 60 | 39.5 -> 28.3 | 8.9 -> 0.8 | 8.2 -> 0 | 6.1 -> 4.9 MB |

By the after arm's first window the ways were known and the town's trips with them; in the base they were not, all
fifteen minutes. What is left of the Living World's frame is its street (`livingTown.update`) and its roads' layer, as
offline.

Pins: `test/perfways1.test.js` (3), `tools/mutants/perfways1.json` (13, all dead; AUDIT PERF-ON4 added every call past
the floor held to the floor's direction, network and ground, and the shipped clock); LW3's budget pin moved onto a clock
(`test/lw3_roads.test.js`, `lw3.json` LW3-ways-budget-unspent re-aimed). The record is `06-Systems/Living-World.md`
PERF-WAYS1. Left: a frame that waits still plans every trip near again - shorter, not gone (below).

## PERF-SUN3 — the sun's cascades share one walk

(PERF-SUN1 when it shipped; AUDIT PERF-ON4: that name was the far cascade's one tap of 2026-09-19, `Rendering-Arc.md`.)
PERF-NEXT item 1. Every cascade's replay walked every record and every flat of the frame - three walks of a list that
reaches the draw distance, to draw what stood within 12, 48 and 240 units of the eye. The cascades are one view and one
depth (`sunCascadeMatrices`: the same eye, light and up, an orthographic box each, SHADOW_SUN_DEPTH either side of the
eye along the light), nested by radius: their depth planes are one plane, their sides each about 36 units inside the
next one's (144 at the travel view's scale; less each box's own texel snap), and float32 rounds a plane by far less at
the game's coordinates (a ten-thousandth by the floating origin, under a hundredth 120 km out). So ONE walk
(`shadowPass.js _sunCandidates`) tests every record and flat against the far cascade by the very test its replay asks,
and each nearer cascade's list is found from the next one out's by its own planes: each list holds exactly what its
cascade's sphere test takes. The replay walks its list in the records' own order and asks every question it asked (the
planes again, F5's radius, WEEDS1's height, the placements), so a cascade draws exactly what it drew; discard() empties
the lists with the lanterns'. SHADOW_TUNING.sunPrepass false is the oracle and the A/B's off arm.

**Measured** (Knightstale by day, `INSTR=shadow`, one arm after the other, `tools/frameAb.mjs`): the sun's three
replays 2.48 -> 1.42 ms a frame by the pass's own timer (2.20 -> 1.48 by sample count), the same 201 draws a frame, and
their allocations 79 -> 18 KB a frame. Those are the replays' own: the walk they now read their lists from was not
timed (AUDIT PERF-ON4 S4 - `01-Overview/Audit-Perf-On4.md`, which times it beside them), and the frame's total moved
within the probe's noise (13.7 -> 13.6).

Pins: `test/perfsun3.test.js` (4) - every draw of every frame against the walk off over random towns (two of three
crowded past the 64 a list starts with), four suns, steady and cadenced, the camera's scale and the travel view's; the
nesting at every side to 120 km; the saving by count, on the default that ships; each list exactly what its own
cascade's sphere test takes - `tools/mutants/perfsun3.json` (17: 16 dead, 1 equivalent as recorded); WEEDS1's and F5's
records on the moved line re-aimed by content. AUDIT PERF-ON4 added the crowds, the default and the lists' oracle.

## PERF-HUD1 — the movable HUD on one clock

PERF-NEXT item 5. `ui/hudLayout.js` swept (34 querySelectorAll over the page) on its 250 ms interval AND from the HUD's
frame tick, each on its own clock: about eight sweeps a second at 60 fps where four were meant. The interval is the
clock; the tick sweeps once at the start, and on its own clock only on a page the start set no interval for (a page
without events: a test's stub - every real page sets one). Five sweeps in a second, where there were nine. (At
SwiftShader's half a frame a second the tick's share was one sweep in nine, so the probe's figure barely moves; the
saving is a desktop's.) `test/perfhud1.test.js` (2: the sweeps' times, not only their count, since AUDIT PERF-ON4),
`tools/mutants/perfhud1.json` (4, all dead).

## PERF-VAO1 — one bindVao

PERF-NEXT item 6. `renderer._renderPasses` minted a `bindVao` closure every frame for the shadow and air passes, a new
call target at their `f.bindVao(vao)` each frame (in node, once, V8 deoptimized the shadow replay on it - PERF-NEXT 6).
It is made once, for the life of the renderer: the same call. No gain measured. `test/perfvao1.test.js` (1),
`tools/mutants/perfvao1.json` (2, all dead).

## Measured, and left

- **The realm checkpoint** (PERF-NEXT 14): a new character's save is 103 KB - about a millisecond of passes every two
  minutes. Left: not worth the composers' seam it would move; a long life's save is the case that would.
- **The peers' sounds**: every step, swing and hoof of a peer in earshot (`remotePlayers.js peerInEarshot`, 30 m) makes
  a panner and a source: 2.4 ms of two seconds at 20 (1.2 a second) and 6.6 at 60 (3.3 a second, 42 of them
  walking - AUDIT PERF-ON4: this said a millisecond a second at sixty, from a per-sound figure it never derived). Left.
- **Inbound messages**: 8.7-9.1 ms of two seconds at 20 and 60 (the client's pose rate falls with the crowd), most of it
  JSON.parse - PERF-NEXT 13: a relay deploy.
- **Native time with a crowd**: the profile's `(program)` - the browser's own work, layout and style among it - grows
  from 4.8 ms a frame alone to 18-20 with company. Not attributed by a CPU profile; a trace of the name layer's writes
  (`style.left`/`top` a name a frame) is the next measurement.
- **The world host's `frame`** is 105,613 bytes of bytecode now (node 22's V8, compiled eagerly - `--no-lazy
  --print-bytecode` over world.js; 99,547 at PERF-NEXT, Chromium's; V8 optimizes nothing past 61,440):
  0.98 ms of its own a frame here, interpreted, and its loops allocate (about 70 KB a frame). PERF-NEXT 22 stands.
- **A waiting frame of the Living World** still plans every trip near again: keeping a waiting traveller's work beside
  the pair it waits on would end it - its own slice.

## For Mac

- **The relay's pose path** (PERF-NEXT 15): still a relay deploy, which drops every player once - 108.5 -> 39.3 us a
  moving pose at 200 in one pixel on PERF-NEXT's prototype. Its own pull request, in a window you announce.
