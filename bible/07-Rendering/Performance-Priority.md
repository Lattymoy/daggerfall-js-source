# PERF-PRIORITY — placed objects, crowds and the render range (2026-10-10)

*The owner: "Real quick, performance must be highest priority now, it even runs shoppy on my nasa pc xD - prob caused
by placed objects by players, crowded places and render range".*

Four changes, each a cost that grew with one of the three things named and none of them a change to the picture:
PERF-V8 (the world host's frame, a function V8 never optimized), PERF-YARD (the yards' placed pieces culled), PERF-INST
(the shadow pass's memory of a model's copies) and PERF-COL2 (the collider's streamed pixels). Then what is left,
ranked - the levers that do move the picture are the owner's.

## How the pass was run

NOT IN THE REAL GAME. The frame probe (`tools/frameProbe.mjs`, PERF-NEXT's recipe) needs the freeware ARENA2, and its
zip's host (`tools/fetch-data.sh`: drive.usercontent.google.com) is refused by this container's network policy - so no
figure here is a frame of the game, and the A/B a real machine owes this branch is under For the owner, below.

What was measured is the real modules in node 22 (V8 12.4) on this container's CPU: the world host's bytecode by V8's
own census (`node --no-lazy --print-bytecode` over `scenes/world.js` - every function of the graph compiled at link,
before any module runs), and benches over the real `ShadowPass` memory and the real `Collider` (in this record's
session scratch; the pins below are the parts that must hold). Three explore lanes mapped the per-frame paths for the
three things named first: the placed pieces (the yards, the rooms' decor, camps, dropped torches and loot), the crowds
(the peers' bodies and sprites, the townspeople, the name tags) and the render range (the view setting, the pixel
walk, the shadow walks, the collider).

## PERF-V8 — the world host's frame, a function V8 optimizes

**Found.** V8 never optimizes a function whose bytecode is over `--max-optimized-bytecode-size` (61,440 bytes): it runs
in the interpreter and the baseline compiler for the page's whole life (PERF-NEXT's V8'S CEILING: a hot loop 16 times
slower past the line). The world host's `frame` was 105,768 bytes - the one per-frame function in the world host's
graph over the line (PERF-NEXT item 22; 99,547 there, in Chromium's count, and growing about 2 KB a day) - and every
loop it held inline ran there every frame on every machine: the pixel walk over every streamed pixel's models and flat
batches (the render range's loop), the townspeople of every built pixel and the peers' batches (the crowd's), each
`for...of` minting an iterator result a step.

**The fix.** Twenty-one of its self-contained statements - the motor, the recentre, the crossing, the storms, the
lanterns, the pixel walk, the ring, the water, the location rect, the townspeople, the pools, the grass, the banners,
the haze, the curtains, the spells, the HUD, the pace dials and the Deep Waters terrain pass - run as closures of their
own, made in place where the statement stood: `const motorStep = () => {   // PERF-V8`, the statement, `};` and the
call. LINES INSERTED ONLY - every existing line of the frame keeps its text and its indentation, so the source pins
and the cite anchors that read them stand (three adjacency regexes take the inserted line - `exteriorfoes`,
`wildalert`, `weather3d_distantstorms` - and one mutant record, NEAR-FIRST's, is re-aimed by content). A statement is
moved only when it declares nothing the frame reads after it and nothing in it returns, breaks or continues out of it
(each checked over the parse). The frame is 38,661 bytes now; the largest closure, the motor, 15,552.

Two moves were tried out and put back in: taken out, the distant storms and the pools added 9.8 KB to the frame where
their own lines are 2.8 KB - past 256 constants or registers V8 widens the operands of every bytecode in the function,
so a frame near the line jumps, and the room under it is worth more than its bytes.

**Measured.** The bytecode (node 22): `frame` 105,768 -> 38,661; nothing else in the graph per frame is near the line
(the next `frame`, another host's, 29,769). Not measured: the frame's time in the game - the change is that V8 is now
allowed to optimize it, and how much that buys is the real machine's A/B (For the owner).

Pins: `test/perfv8.test.js` (2) - every `frame` in the world host's graph under the ceiling and under three quarters of
it (the tripwire: move the next statement out before the cliff, not after); each closure made in the frame, called once
on the line after its close, in order. Mutants: `tools/mutants/perfv8.json`, 3, all dead.

## PERF-YARD — a yard's pieces are culled as the town's own models are

**Found.** Every model piece of every yard within `YARD_DRAW_M` (300 m) was a `drawMesh` a frame - one draw per
sub-mesh - behind the eye or not, and a recorded caster every shadow walk asked (the cascades', the lanterns'
signatures, the dynamic scan). Up to `DECOR_YARD_CAP` (60) pieces a home; a town of furnished yards is thousands.
`homeYards.js draw` ran before the pixel walk makes the frame's planes, so nothing culled them.

**The fix.** The pixel walk's own law (EV3 and SHADOW-REACH): inside the view, drawn; outside it, recorded for the
shadow maps alone where a shadow reaches it (`renderer.recordShadowMesh`); else nothing. `decorRoom.js` keeps each
piece's box in the world (`wbox`, made again at a recentre's `restand`) and draws by its host's verdict
(`decorCullVerdict`, `DECOR_DRAW` / `DECOR_SHADOW` / `DECOR_SKIP`); the world host hands the yards `yardCull` - planes
made once a frame from the frame's own matrices (the tap ray's, kept before the draw) by the same `spherePlanes`, the
reach the renderer's. A room's host hands none: a building is drawn whole, as before.

Pins: `test/perfyard.test.js` (4) - the verdict over real planes from a real projection; the pool by its verdict over
each piece's world box; a recentre carries the box with the piece; the host's wiring. Mutants:
`tools/mutants/perfyard.json`, 8, all dead.

## PERF-INST — a mesh's copies are remembered by place

**Found.** The shadow pass remembers every placement of a mesh (AUDIT SC1, AUDIT REACH) to tell a still copy from a
moved one. Each draw scanned every placement its mesh had - N copies of one model, N x N distances a frame - and past
`SHADOW_INSTANCE_MAX` (128) every further copy read as moved, for ever: a dynamic caster, replayed into every lantern's
dynamic faces near it every frame. The same chair in a street of yards, two hundred pieces in a room, a model too odd
to batch across a long view. (Recorded and left by AUDIT FLICKER: "a batch past 128 placements is treated as dynamic
(raising the cap costs a pairwise walk)" - `Enhanced-Lighting-Arc.md`, narrowed there.)

**The fix.** Past `SHADOW_INSTANCE_LINEAR` (64) placements a mesh's memory is filed on an XZ grid of
`SHADOW_INSTANCE_REACH` cells, and a draw asks the 3x3 cells round it: every placement within the reach stands in them,
and the answer is the scan's - the exact placement first (the earliest remembered), else the nearest within the reach
not claimed this frame (the earliest on a tie). A placement whose translation changes is filed again; an origin shift
files them all again; a full memory evicts the stalest, or - once a frame finds every placement live - answers dynamic
for the rest of that frame without walking it again. At or under 64, the scan as it was. The cap is 4096.

**Measured** (node 22, this container; N still copies of one mesh, every copy drawn every frame):

| N | dynamic, before | dynamic, after | the memory's CPU a frame, before | after |
|---|---|---|---|---|
| 200 | 72 | 0 | 0.12 ms | 0.08-0.15 ms |
| 600 | 472 | 0 | 0.43-0.49 ms | 0.13 ms |
| 1,500 | 1,372 | 0 | 1.14-1.17 ms | 0.46-0.47 ms |

The dynamic column is the one the GPU pays: each was a caster replayed into the dynamic faces of every lantern in
reach, every frame (Steady shadows on, the default).

Pins: `test/perfinst.test.js` (5) - the scan as it shipped is the ORACLE, run beside the pass over seeded stories
(still, stacked and near copies, swings, steps, jumps, new and undrawn copies, origin shifts) and over schedules aimed
at each law (an equal-distance tie, a walker crossing cells, a full memory's evictions after an all-live frame), every
verdict and the memory after each frame compared; a draw never reads a placement filed across town; a thousand still
copies are all still. `audit_lighting` and `audit_reach` pin the cap's new value. Mutants:
`tools/mutants/perfinst.json`, 10, all dead (four survivors on the first cut, each closed by a schedule aimed at it);
`auditlight.json`'s one-placement mutant re-aimed by content (the cap's line stands twice now).

## PERF-COL2 — a streamed pixel's collider buckets are filed by place

**Found.** Every streamed pixel's collider bucket - its town's models, mills and boards, its gates, World of
Daggerfall's pieces, Privateer's Hold, the ocean holes - carries a translation provider (the pixel under the floating
origin), so FB0930-FRAME's broad phase counted it a MOVER and asked it on every ray and every sphere; and a pixel's
bucket spans its pixel, too wide for the fine cells besides. The collider's bill grew with the render range: a capsule's
move (the player's, every foe's, every fixed step) and a short ray (a foe's probe, a peer's name ray) over a synthetic
streamed town (60 houses a pixel, 200 in the middle one):

| pixels streamed | a capsule's move, before | after | a short ray, before | after |
|---|---|---|---|---|
| 1 | 16-25 us | 16-25 us | 1.4 us | 1.4-1.6 us |
| 25 (view 2) | 38-51 us | 19 us | 1.9-2.0 us | 2.4 us |
| 121 (view 5, the default) | 139-152 us | 19 us | 4.3-7.8 us | 0.67 us |
| 169 (view 6, Ultra) | 197-210 us | 14 us | 6.2-6.8 us | 0.98 us |

Thirty foes stepping at the default view were ~4 ms of collider a frame; now under one.

**The fix.** `onFloatingFrame(frame, translation)` (`player/collider.js`) marks a provider as riding a floating frame:
every provider of one frame moves only when the frame does, and then by the same offset. A bucket so marked, and not
turned, is filed where it stands when filed; each query asks ONE bucket of the frame where it stands (the frame's
sentinel), and the filing is made again the query after it moved - a crossing, a teleport's re-anchor, a vertical
recentre. A bucket too wide for the fine cells, standing or riding, is filed on coarse cells (`BROAD_COARSE_CELL`, 256)
before it is left for every query. The world host marks the six pixel-translation providers its buckets take and the
ocean holes'; a boat's, a wagon's, a gate's own mover ride nothing and are asked as before. Every answer is the old
walk's: the broad phase only ever leaves out a bucket whose own box test would have said no.

Pins: `test/perfcol2.test.js` (3) - every ray, cast, sphere, contact and move over a streamed world of riders,
standing wide buckets, a turned rider and a plain mover is the old walk's, before and after the frame moves under it;
a short probe asks the buckets round it and the sentinel; the world host marks every pixel's bucket and no other.
Mutants: `tools/mutants/perfcol2.json`, 6, all dead; `fb0930_frame.json`'s filing mutant re-aimed by content (the cell
math is `fileBox`'s now, fine and coarse).

## What is left, ranked

Each with what was found and whether it moves the picture (those are the owner's).

**The render range.**
1. **Past the fog's end** - at the default view the linear fog ends at 4,000 units while the far plane is 6,000 and the
   grid's corners stand ~6,400 away: the corner pixels are drawn wholly fogged - their ground, their statics, their
   tall flats and their shadow records. A cull at the fog's end removes them; the far ring's hole is punched at the
   view's radius, so the ring's own hole would have to follow it or the sky shows at the corners. Moves the horizon.
2. **The far flats** - every tree record of every ring to the view's edge is a draw (~1,090 a frame in a town;
   PERF-NEXT item 10). A texture array or centres merged across pixels: a renderer project, nothing a player sees.
3. **The shadow walks** grow with what is recorded, not with the shadows' reach (the sun's cascades reach 240 units,
   the lanterns 120): records far outside every reach could be left out at the record. Nothing a player sees; PERF-SUN3
   and PERF-SHADOW1 took the walks' repeats, not their length.

**The crowds.**
4. **The Morrowind bodies** - each visible body (up to 8) renders into the shared sprite target: two framebuffer
   switches, and the frame's uniform block - 48 lights among it - sent again after it. A body that did not re-skin and
   whose view moved little could keep its sprite. Moves the body's look on the frames it is kept.
5. **The sprite peers** have no distance tier and no cap inside the relay's three map pixels: every drawable peer's
   footsteps, mobile and riding clocks run every frame, seen or not; `online.tick` lerps (and allocates) a pose for
   every peer of every room held open. A far tier changes what a far player sees.
6. **The Living World's dodge** walks the whole pool for each walker each frame, with an array and a sort a walker
   (`livingTown.js _dodge`). Nothing a player sees.

**The placed pieces.**
7. **A furnished room's lights** - every lit piece joins the room's lights and indoors every light casts
   (`everyLightCasts`, up to 48 small cubes); each asks a signature walk of every record each frame, and a light new to
   a slot draws all six faces at once (a room of lamps entered: up to 288 faces in its first frame). A budget for the
   fresh slots shows a light's shadow a frame or two late.
8. **The yards' sync** stringifies every home's pieces every half second and puts a whole yard again on any change.
   Nothing a player sees.

**The GPU** (unchanged from PERF-NEXT): the cloud march, Steady shadows' every-frame lantern faces, an automatic quality
governor - each the owner's.

## For the owner

- **The A/B this branch owes**: on a machine with the data, `ARENA2_PATH=... node tools/frameProbe.mjs knight night`
  with `TREE=` the base, then this branch (`node tools/frameAb.mjs` reads the two) - the frame's own script time
  is what PERF-V8 moves, and a crowded town with yards is where PERF-YARD, PERF-INST and PERF-COL2 show.
- **The picture's levers** above (1, 4, 5, 7) are yours: each trades a little of what is seen for frame time.
