# PERF-PRIORITY — placed objects, crowds and the render range (2026-10-10)

*The owner: "Real quick, performance must be highest priority now, it even runs shoppy on my nasa pc xD - prob caused
by placed objects by players, crowded places and render range".*

Five changes, each a cost that grew with one of the three things named and none of them a change to the picture:
PERF-V8 (the world host's frame, a function V8 never optimized), PERF-YARD (the yards' placed pieces culled - the homes'
and the merchants'), PERF-INST (the shadow pass's memory of a model's copies), PERF-COL2 (the collider's streamed
pixels) and PERF-FACE (a lantern's six faces copied for one mover). Then what is left, ranked - the levers that do move
the picture are the owner's.

AUDITED the same day (the owner: "Lets do an audit on this"): five cold lanes over a frozen snapshot, every finding
fixed, pinned and mutated or recorded - `01-Overview/Audit-Perf-Priority.md`. What the audit changed is written into
each section below as it now stands.

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
own, made in place where the statement stood: `const frameMotor = () => {   // PERF-V8`, the statement, `};` and the
call - each named `frame...`, so the census's `frame*` filter measures it with the frames (AUDIT). LINES INSERTED ONLY -
every existing line of the frame keeps its text and its indentation, so the source pins and the cite anchors that read
them stand (three adjacency regexes take the inserted line - `exteriorfoes`, `wildalert`, `weather3d_distantstorms` -
and one mutant record, NEAR-FIRST's, is re-aimed by content). Each closure holds ONE statement that declares nothing,
holds no `return` (the frame exits early by `return`: one moved into a closure would leave the closure alone and run
the rest of the frame) and no `var` (it would hoist into the closure, not the frame) - read over the parse every run.

Moving a statement out SAVES more than its own bytes: folding the distant storms back into the frame adds 8.6 KB, the
pools 2.1 KB, the two 10 KB, the dread storm's 453 bytes of its own 7 KB. Past r123 a register's operands are WIDE (a
prefix byte and doubled operands, per instruction - 4,627 of the frame's 9,391 are), so every register a statement's
temporaries push past that line widens the instructions that name it, and a frame near the cliff jumps. The 3/4
tripwire's room is one statement, not days.

**Measured.** The bytecode (node 22): `frame` 105,768 -> 38,661 on the branch (merge-base 6443a8ad); 107,564 -> 39,965
with main's #748 merged in (352 registers -> 130). The largest closure is the motor, 16,459; the next `frame`, another
host's, 29,769; nothing else per frame is near the line (`bootWorld` is 115,202 and runs once; `buildPixelNow`, once
a pixel, is 44,982 - under the 3/4 line by 1,098). The price: the frame's context holds 40 slots, not 13 (27 locals
the closures read live there now - `dt`, the batch lists), and 21 closures are made a frame - ~0.8 us and ~0.5 KB of
young allocation, under 0.01% of a frame. Not measured: the frame's time in the game - the change is that V8 is now
allowed to optimize it, and how much that buys is the real machine's A/B (For the owner).

Pins: `test/perfv8.test.js` (2) - every `frame` in the world host's graph and every closure moved out of one under the
ceiling and under three quarters of it (the tripwire: move the next statement out before the cliff, not after); over
the parse, the 21 closures by name in order, each made in the frame and called once - a plain call, the statement after
its close - holding one statement, no `return`, no `var`. Mutants: `tools/mutants/perfv8.json`, 8, all dead.

## PERF-YARD — a yard's pieces are culled as the town's own models are

**Found.** Every model piece of every yard within `YARD_DRAW_M` (300 m) was a `drawMesh` a frame - one draw per
sub-mesh - behind the eye or not, and a recorded caster every shadow walk asked (the cascades', the lanterns'
signatures, the dynamic scan). Up to `DECOR_YARD_CAP` (60) pieces a home; a town of furnished yards is thousands.
`homeYards.js draw` ran before the pixel walk makes the frame's planes, so nothing culled them.

**The fix.** The pixel walk's own law (EV3 and SHADOW-REACH): inside the view, drawn; outside it, recorded for the
shadow maps alone where a shadow reaches it (`renderer.recordShadowMesh`); else nothing. `decorRoom.js` keeps each
piece's box in the world (`wbox`, made again at a recentre's `restand`) and draws by its host's verdict
(`decorCullVerdict`, `DECOR_DRAW` / `DECOR_SHADOW` / `DECOR_SKIP`); the world host hands the yards `yardCull` - planes
made from the frame's own matrices (the tap ray's, kept before the draw) by the same `spherePlanes`, once a frame -
keyed on the view matrix itself, which every frame mints anew, never on the frame's timestamp, which two frames share
under a coarsened clock (AUDIT) - the reach the renderer's. A piece whose triangles are not in hand (the pipeline let
its model go between the mesh and its copy) has no box and is drawn as before. A room's host hands none: a building is
drawn whole, as before.

THE MERCHANT YARDS (AUDIT): MERCHANT-YARDS (#748, merged the same day) drew every yard of every streamed town every
frame - its timber and its three wagons on show, each wagon several meshes - behind the eye and kilometres off. The
street's draw now hands them `yardCull` too (`merchantYardsHost.js draw(r, cull)`), asked once a yard of one box (its
timber's and its wagons', made again when it moves or a wagon comes in): in view, drawn; in a shadow's reach, cast
alone through a renderer that records (a part that casts nothing - a caravan's room - casts nothing there either);
else nothing. The view out of a window hands none: its eye is not the street's.

Pins: `test/perfyard.test.js` (6) - the verdict over real planes from a real projection; the pool by its verdict over
each piece's world box; a recentre carries the box with the piece; a piece with no box is drawn and never asked; the
host's wiring (the frame's own matrices kept before the draw, the yards handed the host's test); the merchant yards by
the same law. Mutants: `tools/mutants/perfyard.json`, 17, all dead.

## PERF-INST — a mesh's copies are remembered by place

**Found.** The shadow pass remembers every placement of a mesh (AUDIT SC1, AUDIT REACH) to tell a still copy from a
moved one. Each draw scanned every placement its mesh had - N copies of one model, N x N distances a frame - and past
`SHADOW_INSTANCE_MAX` (128) every further copy read as moved, for ever: a dynamic caster, replayed into every lantern's
dynamic faces near it every frame. The same chair in a street of yards, two hundred pieces in a room, a model too odd
to batch across a long view. (Recorded and left by AUDIT FLICKER: "a batch past 128 placements is treated as dynamic
(raising the cap costs a pairwise walk)" - `Enhanced-Lighting-Arc.md`, narrowed there.)

**The fix.** Past `SHADOW_INSTANCE_LINEAR` (64) placements a mesh's memory is filed by place, and the answer is the
scan's - the exact placement first (the earliest remembered), else the nearest within the reach not claimed this frame
(the earliest on a tie). At or under 64, the scan as it was (it never meets a full memory: 64 is under the cap). The
filing, as the audit left it:
- CUBES of `SHADOW_INSTANCE_REACH` (2), keyed by ten bits an axis - not XZ columns: a stack of copies one above another
  is spread over its own cubes (a column held them all, and every draw measured every one);
- in the ORIGIN'S FRAME (a place less the pass's cumulative shift), so a floating-origin shift moves no placement's
  cube - only one that float32's rounding of the moved place carries over a face is filed again (the first cut filed
  every placement again at every crossing: tens of ms with a few full meshes);
- stood off the round numbers by `SHADOW_INSTANCE_PHASE` (the golden section's share of a cube) - a floor at y = 0 or a
  mesh laid on a whole grid stood on the faces, where a draw asks a neighbour too;
- a cube keeps its placements in the order remembered, so a draw more than two epsilons inside its own cube takes the
  first within the epsilon there - the scan's exact one, the common answer for every still copy, from one cube; else
  the 3x3x3 round it, measuring only placements not claimed this frame (no exact one stands there, so a pile of claimed
  copies costs a look each, not a distance);
- a cube is found by OFFSET from the draw's own: a coordinate past 2^53 cells adds nothing to a cell number, and the
  first cut's `gx <= cx + 1` never ended there - the frame hung on one finite, absurd translation;
- a full memory gives up the stalest from a queue made once a frame (by when last seen, then remembered), passing over
  one drawn since it was queued - where the first cut walked every placement at every miss;
- the cap is 1024, not the first cut's 4096: ~0.6 KB a placement with its filing, and a mesh's memory is kept for the
  session - 2.5 MB a full mesh at 4096, and a frame with 2,000 new copies after a hold away paid 29 ms of evictions.

**Measured** (node 22, this container; N still copies of one mesh, every copy drawn every frame; "the scan" is the
shipped code, cap 128):

| layout | N | dynamic, the scan | dynamic, filed | the memory's CPU a frame, the scan | filed |
|---|---|---|---|---|---|
| a town, spread | 600 | 472 | 0 | 0.34-0.53 ms | 0.07 ms |
| a town, spread | 2,000 | 1,872 | 976 (past the cap) | 1.2 ms | 1.4 ms |
| a yard, 40 units | 600 | 472 | 0 | 0.34 ms | 0.07-0.08 ms |
| a tower, stacked | 600 | 472 | 0 | 0.35-0.55 ms | 0.07-0.08 ms |
| a pile, 3 units | 600 | 472 | 0 | 0.85 ms | 0.21-0.26 ms |
| a pile, 3 units | 2,000 | 1,872 | 976 (past the cap) | 3.1-4.0 ms | 3.9 ms |

The dynamic column is the one the GPU pays: each was a caster replayed into the dynamic faces of every lantern in
reach, every frame (Steady shadows on, the default). Past the cap a copy is dynamic, as every copy past 128 was; the
2,000-copy rows are the memory's limit, not a layout a town makes. A recentre with twenty full meshes refiles in
1-11 ms - most of it the move of every placement itself, the rounding's few refiled - where the first cut's every-placement refile was 27-51 ms.

Pins: `test/perfinst.test.js` (14) - the scan as it shipped is the ORACLE, run beside the pass over seeded stories
(still, stacked and near copies, swings, steps, jumps, new and undrawn copies, origin shifts) and over schedules aimed
at each law - ties within a cube and across a face, whichever cube is asked first; a draw exactly the reach away; exact matches on both sides of a
face; a placement filed again into a cube holding a later one; a full memory's evictions (the least seen, one drawn
since passed over, after an all-live frame); translations past any cube a number steps, and not finite - every verdict
and the memory after each frame compared; the grid holds each placement once, in the cube it stands in in the
origin's frame, after shifts whose rounding carries placements over a face; a draw never reads a placement filed
across town; a stack's still copy reads its own cube; a full memory's misses read each age a few times in all. Off the
pins, the audit's fuzz: ~33 million draws against the oracle at caps 70, 100 and 300 over spread, clustered,
face-aligned, wrapped (keys shared 2,048 units apart), huge (to 1e15) and NaN/Infinity layouts - none diverged.
`audit_lighting` and `audit_reach` pin the cap's value. Mutants: `tools/mutants/perfinst.json`, 23, all dead;
`auditreach.json`'s two eviction mutants and `auditlight.json`'s one-placement mutant re-aimed by content at the code
that now holds those laws.

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

Thirty foes stepping at the default view were ~4 ms of collider a frame; now under one. (At view 2 a short ray is a
little slower - 2.4 us against 2.0: the sentinel's ask outweighs the few pixels it saves.)

**The fix.** `onFloatingFrame(frame, translation)` (`player/collider.js`) marks a provider as riding a floating frame:
every provider of one frame moves only when the frame does, and then by the same offset. A bucket so marked, and not
turned, is filed where it stands when filed; each query asks ONE bucket of the frame where it stands (the frame's
sentinel), and the filing is made again the query after it moved - a crossing, a teleport's re-anchor, a vertical
recentre. A bucket too wide for the fine cells, standing or riding, is filed on coarse cells (`BROAD_COARSE_CELL`, 256)
before it is left for every query. The world host marks the six pixel-translation providers its buckets take and the
ocean holes', and hands its frame to the two hosts that lay a pixel's bucket of their own - Deep Waters' walls (one a
carved shore pixel; the mod is on by default) and a bounty farm's - which mark theirs with it (AUDIT: the first cut
left both asked by every query). A boat's, a wagon's, a gate's own mover ride nothing and are asked as before. Every
answer is the old walk's: the broad phase only ever leaves out a bucket whose own box test would have said no.

A MESH STREAMED IN IS FILED INTO THE STANDING FILING (AUDIT): a pixel builds a mesh a breather's slice, and each
`addMesh` dropped the whole filing - made again at the next query, a pixel bucket now on 16-25 coarse cells where it
had been one push to `always`: 0.2 ms of a frame at the default view while a pixel built, the move's saving and more.
Now a new bucket joins the walk's end and a grown one is filed under the cells its grown box gained (its last cells kept
on the bucket; a box only grows, so its level - fine, coarse, every query's - only rises, and `always` keeps the walk's
order and is stamped against a bucket a grown box carried there from finer cells). A frame that moved under the filing
drops it, as a query would. The sentinel reads X and Z alone: only those file a bucket, so a vertical recentre moves
none. Streaming a mesh a frame with a capsule's move a frame, at the default view: main 88 us a frame, the first cut
344, now 21 (25 pixels: 57 / 122 / 31; 169: 127 / 527 / 21). A removal still drops the filing (a pixel unloads at a
crossing, a few frames a crossing).

Pins: `test/perfcol2.test.js` (5) - every ray, cast, sphere, contact and move over a streamed world of riders,
standing wide buckets, a turned rider and a plain mover is the old walk's, before and after the frame moves under it
(east, north, a re-anchor and a vertical recentre); a short probe asks the buckets round it and the sentinel; the world
host marks every pixel's bucket and no other, and hands its frame to the walls and the farms, which mark with it; a
query's candidates against a brute force over random boxes (every bucket whose filed box meets its own, in the walk's
order, once), after moves and buckets grown through every level; a streamed mesh filed into the standing filing (each
bucket under a cell once), its answers the old walk's, long rays over every bucket included, and a pixel unloaded and
streamed again while the frame crossed and came back. Off the pins, the audit's differential fuzz of main's collider
against this one: ~172,000 queries of all fifteen kinds over crossings, re-anchors, removals, re-adds, grown keys, a
mesh between a crossing and its return and buckets grown through every level - none differed. Mutants:
`tools/mutants/perfcol2.json`, 19, all dead; `fb0930_frame.json`'s two filing mutants re-aimed by content (the cell
math is `fileBox`'s, fine and coarse; addMesh's stale filing is the standing filing's arm now).

## PERF-FACE — a live face that holds the cache is left

**Found** (the GL census over the real `Renderer`, a counting fake GL): SC1 keeps a lantern's statics in a cache and
draws its movers over a copy of it - and the copy was of ALL SIX faces whenever anything moved in the lantern's reach (a
walker by a lamp, a peer, a townsman, a swaying tree under Steady shadows): every frame, six 512^2 depth copies
(CACHE-COPY's draw) for a mover that stands in front of one or two of them.

**The fix.** Each live face knows whether it holds the cache and nothing else (`_faceDyn` 0: a dynamic replay drew
nothing into it, or a copy made it so); such a face is not copied before the movers are drawn over it - what the copy
would write is what it holds. A face a dynamic drew into, or one not known (a fresh slot, the uncached path), is copied
as before; a fresh cache copies all six. Every live face ends the frame as the cache plus this frame's movers in it -
the picture the six copies made. One walker by one lamp: one face copied a frame, not six.

Pins: `test/perfface.test.js` (2) - every live face ends every frame as its cache plus that frame's movers (a model of
each face's depth layers, checked after every frame, over a mover walked across a lamp's faces, stood still into the
cache, moved again, taken away and brought back, a still caster added, the lamps moved); a mover in front of a lamp
copies the faces it was drawn into, not six, and a mover gone copies those back once. `cachecopy`, `sc1_shadowcache` and `disc24c_self_shadow` count copies
by face now. Mutants: `tools/mutants/perfface.json`, 6 - 5 dead, 1 equivalent as recorded (an emptied slot's faces
marked unknown: its cache flag is cleared beside them, so its next use copies all six whatever they say).

## What is left, ranked

Each with what was found and whether it moves the picture (those are the owner's).

**The render range.**
1. **Past the fog's end** - the far plane is 6,000 and the grid's corners stand ~6,400 away at the default view, while
   the fog ends well inside: 4,000 under the Port sky's linear rows (`scaleFogForDistance`), and under Dynamic Skies -
   the default Outdoors - the mod's own rows installed verbatim (a sunny EndDistance of 3,600; overcast and rain
   exponential-squared). The corner pixels are drawn wholly fogged - their ground, their statics, their tall flats and
   their shadow records. A cull at the fog's end removes them, and must read the live fog row, not a number; the far
   ring's hole is punched at the view's radius, so it would have to follow or the sky shows at the corners. Moves the
   horizon.
2. **The far flats** - every tree record of every ring to the view's edge is a draw (~1,090 a frame in a town;
   PERF-NEXT item 10). A texture array or centres merged across pixels: a renderer project, nothing a player sees.
3. **The shadow walks** grow with what is recorded, not with the shadows' reach (the sun's cascades reach 240 units,
   the lanterns 120). NOT at the record: the records are replayed a frame late (EL2) against the next frame's lights,
   so a record left out by this frame's reach is missing from a lamp newly picked the next - its first map short, its
   cache built twice (SHADOW-REACH already pays that for off-screen casters alone). At the replay, with that frame's
   own lights, the walks could share one pass that keeps the records in any reach and run over those - every walk
   rejects the rest by its own test today, so no answer moves. Needs the real game's census first: how much of the
   pass is the walks, now that PERF-SUN3, PERF-SHADOW1 and the EXT passes took their repeats.

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
