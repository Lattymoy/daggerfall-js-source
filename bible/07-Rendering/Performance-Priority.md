# PERF-PRIORITY — placed objects, crowds and the render range (2026-10-10)

*The owner: "Real quick, performance must be highest priority now, it even runs shoppy on my nasa pc xD - prob caused
by placed objects by players, crowded places and render range".*

Six changes, each a cost that grew with one of the three things named and none of them a change to the picture:
PERF-V8 (the world host's frame, a function V8 never optimized), PERF-YARD (the yards' placed pieces culled - the homes'
and the merchants'), PERF-INST (the shadow pass's memory of a model's copies), PERF-COL2 (the collider's streamed
pixels), PERF-FACE (a lantern's six faces copied for one mover) and PERF-NAMES (the crowd's names laid out at every
move). Then what is left, ranked - the levers that do move
the picture are the owner's. Later the same day: PERF-TEAMS (another player's team, cut by its distance and the view)
and PERF-WAGON (the rest of the carts, wagons and tents, and the fixed city's host).

AUDITED the same day (the owner: "Lets do an audit on this"): five cold lanes over a frozen snapshot, every finding
fixed, pinned and mutated or recorded - `01-Overview/Audit-Perf-Priority.md`. What the audit changed is written into
each section below as it now stands.

PEER-RANGE (the same day; the owner: "So for online performance, I believe the rendering of players far out is
contributing to poor performance") pulled the crowds' lever 5 below, and it DOES move the picture: past a distance the
player chooses (300 m by default) another player is not drawn. Its section is after PERF-NAMES.

PEER-HULL-RANGE (2026-10-11, a player's report from a profile of the live game) does the same for the sea: another
player's ship far off stands no hull on my client. It does not move the picture - every ship it holds back is past the
fog on every lane (AUDIT PEER-HULL-RANGE moved its edges there and gave a hull built again her record's dress). Its
section is after PERF-WAGON.

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

TESA14 (2026-10-24, `03-World/Arena-Provinces.md` TESA14): the frame stood at 46,119 bytes against the 3/4 tripwire's
46,080 (the roads past the Bay's one line, `_tamrielRoads.frame(state.current)`, the host reading what stands itself);
the weather's drain - the `!weatherOverride` block - is the twenty-third closure (`frameWeatherDrain`), lines inserted
only, and the frame is 45,242.

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

## YARD-RANGE — other players' yards drawn as far as the player says, and nothing too small to see

**Found.** A player (2026-10-11, bug-reports: "browser version for me is unplayable nowadays I get like 20-40 fps in
cities. tbh even the AppImage is struggling"): 19 fps, 52.7 ms a frame, script 61.0 ms (in frame 44.8, before 15.1,
stream 1.1), 1,523 draws and 1,223 binds, on an RX 9070 XT under ANGLE's GL backend at 2560x1327. Knightstale with no
yards measures about 950 to 1,124 draws (`Performance-Arena.md`). The owner: "look into limiting and improving
performance with player's exterior decor items". Read from the code, not measured on that machine:

- a yard's FLATS had no distance cut at all - `homeYards.js batches` answered every standing yard's every flat, the
  whole streamed grid's, each its own billboard batch (one draw, two binds where its record differs from the last) and a
  shadow record, where its models stopped at `YARD_DRAW_M` (300 m);
- a model piece was drawn at any size to 300 m - a cup a draw and a cascade replay at 250 m;
- `sync`, every `YARD_SYNC_S` (half a second), stringified every home's pieces of every built town (up to
  DECOR_YARDS_TOWN_MAX, two thousand) to learn whether its answer had changed;
- no setting reached a yard at all.

**The fix.**

- **A distance of the player's own.** The Other players card has a Yard decorations row beside Draw distance
  (`ui/enhancedMenu.js`, `yardRange` on the prefs shelf; the law `net/yardRange.js`): Off, 75 m, 150 m or 300 m - the
  default, the distance every yard was drawn at before. The distance is from the eye to a yard's house on the ground,
  read every frame (it lands at once). Off stands no stranger's yard at all - taken down where it stood, nothing drawn,
  solid or lit - and stands it again the moment another choice is made. One's own yard (a home's, a hall's its keeper
  keeps - homeOutsideKept) is drawn to YARD_DRAW_M whatever the choice, and the yard the owner stands in always.
- **The flats as the models.** `batches` asks each yard's reach as `draw` does, and refills one list in place every
  frame (`decorRoom.js batchesSeen`) - it made three arrays a yard a frame.
- **Nothing too small to see.** A piece is drawn while half its size over its distance is at least `YARD_MIN_ANGLE`
  (1/300 - `decorRoom.js decorPieceSeen`, `decorBoxSeen` over a model's world box): a metre across to 150 m, a chair's
  half-metre to 75 m, a cup to 15 m, about five pixels tall on a 1080-line screen. A skipped piece records no shadow.
  The yard being placed in is never cut.
- **The sync asks a new answer only.** A town's lists are replaced, never written into (ensure, keep), so a yard keeps
  the list it last wrote out and its signature: an unchanged town is no longer stringified at all.
- **The four hosts.** Yards stand in `scenes/world.js` alone (it hands `range: () => getPref('yardRange')`);
  `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` stand none.

**Left.** A yard's lamps keep AUDIT YARD-LIGHT L2's law (no distance cuts a lamp) at 75 and 150 m; Off takes them with
the yard. A yard's flats are still one batch a piece - merged batches by record, as a pixel's own flats are, would cut
the draws again and are the next lever. Whether this player's town is yard-bound is not known: the 15.1 ms before the
frame is not the game's code (`Performance-Exterior.md` SCRIPT-SPLIT), and `?perf=cpu` against an offline visit to the
same town (yards stand online only) would say.

Pins: `test/yardrange.test.js` (5) - the law and the shelf's default, the row's wiring and the host's; the size bound;
over the real yard and pool, the default, 75 m and Off - models and flats alike, my own yard always, Off taking a
stranger's yard down and standing it again; my own yard 200 m off; six syncs of an unchanged town stringifying nothing.
Mutants: `tools/mutants/yardrange.json`, 10, all dead.

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

## PERF-NAMES — a name moves by its transform

SUPERSEDED the same day by PERF-NAMES1 (`Performance-Crowd.md`, a friend's pass ported onto main), which holds this
whole - the same transform - and adds `contain: layout style`, each value compared with what the layer last wrote, the
words worked out when their stamp changes, and the crowd's tags let go with it (PERF-LEAK1). Below is this slice's own
measure, as made.

**Found** (`tools/nameLayerBrowserProbe.mjs`, PERF-ON2's probe, given the main thread's whole task beside its layout;
headless Chromium, 72 names walking with the eye, 600 frames, three runs): the name layer is ~1.9 ms of the page's
main thread a frame - the layout PERF-ON2 read (0.12-0.18 ms) is a tenth of it; the style, the paint and the commit
are the rest. Each name's `left` and `top` lay the tag out again at every move, and a turn of the camera moves every
name on the screen.

**The fix.** `ui/nameLayer.js` places a tag by one `transform` - the point, then the sheet's own `translate(-50%,
-100%)` - in place of `left` and `top`. The same pixels: the two ways' screenshots in Chromium compared byte for byte at
three frames of sixty names, on its default GL and on SwiftShader. Names standing while the eye turns: 1.52 -> 1.15 ms
of main thread a frame (three runs each, their layout 0.11 -> 0). Names walking nearer and farther: within the noise
(1.99 against 1.81) - their font size moves every frame and lays them out by itself, as PERF-ON2 found.

Pins: `test/name1_bubbles.test.js` reads the place from the transform (and never `left`/`top`). Mutants:
`tools/mutants/name1.json`'s gap and stack mutants re-aimed at the transform (the sheet's own translate is now the
place's until the first write); 67 dead, 3 equivalent as recorded.

## PEER-RANGE — the others drawn as far as they can be seen

**Asked** (the owner, 2026-10-10): *"So for online performance, I believe the rendering of players far out is
contributing to poor performance."*

**Found.** A world cell hands the screen every player within the relay's range - `RANGE_PIXELS`, three map pixels
either way: 2.5 km pixel to pixel, up to 3.3 km along an axis (`net/wire.js` `inRange`, the session's `drawable`) - and
the online frame handed that whole list to every layer. The rider and the walker were stepped and placed, the walker's
lantern hung and swung, an aura's cape posed, a cast's missile flown from a figure two kilometres off, a blow's spark
struck (`peerFxFrame`), and each class sprite's `MobileUnit` stepped, faced and its frame uploaded
(`RemotePlayers._syncMobilePeer`). The renderer culls what is off the screen - the peers' billboards in the host's pass
(PERF-ON2) and every `drawBillboards` call, the lanterns' among them (PERF-CROWD2) - but nothing culled a far one in
front of the eye: that is a draw, two binds and its uniforms, and a shadow record when a cascade reaches it. The Morrowind
rigs already slept past `BODY_RANGE` (120), the names past `NAME_RANGE` (60), the lights past `PEER_LIGHT_RANGE` (64)
and the steps past `PEER_SOUND_PROFILE`'s 30 m; the sprites, the walkers, the riders, the lanterns, the auras, the casts
and the sparks had no distance at all.

**Measured** (`tools/peerRangeProbe.mjs`: the real cut in front of the real `RemotePlayers` on its class-sprite path and
the real `Renderer.drawBillboards` over a counting GL; node 22, this container's CPU, the milliseconds relative only).
A walking crowd in front of the eye, a few within 120 m and the rest spread from 320 m to the relay's edge:

| crowd (near) | drawn at Everyone | GL calls / draws a frame | drawn at 300 m | GL calls / draws a frame | `sync` ms, Everyone -> 300 m |
|---|---|---|---|---|---|
| 20 (5) | 20 | 94.5 / 20 | 5 | 38.4 / 5 | 0.044 -> 0.010 |
| 60 (10) | 60 | 229.7 / 60 | 10 | 59.0 / 10 | 0.055 -> 0.009 |
| 120 (15) | 120 | 432.2 / 120 | 15 | 76.7 / 15 | 0.109 -> 0.010 |

That is the class sprite's pass alone; the walkers, the riders, their lanterns, the auras, the casts and the sparks are
cut by the same list and are not in it. The session's own play-out (`online.tick`, every peer of every room held) was
measured beside it with PERF-ON's probe - 0.028 ms a frame at 100 peers - and LEFT: the map's marks, the foes' owners and
the range itself read the pose it plays.

**The fix** (`net/peerRange.js`). GATE-CROWD's cut, by distance in place of a count, run on the online frame's drawn
list just before the court's own (`scenes/world.js` `ranged`): past the distance on the Other players card a player
stands nowhere on this screen - no body, sprite, name, light, cast, spark or step - and their map marks, taken off the
whole list above it, stay.
- THE CHOICES: 150, 300 or 600 m on the ground, or Everyone (`PEER_RANGE_TIERS`; `systems/uiPrefs.js` `peerRange`, a
  literal pinned equal to the law's for GATE-CROWD's boot-path reason; the card's Draw distance row,
  `ui/enhancedMenu.js` `peerSpritesCard`).
- THE DEFAULT, 300 m, IS PAST A SHOT'S REACH: another player's arrow or spell flies `MISSILE_SPEED` for
  `MISSILE_LIFESPAN_S` - 200 m (the one faster shot is a foe archer's aimed one, x1.3 `BLOW.aimed.speed`, 260 m - short of
  the default too). Nobody who can reach me with a shot is cut at the default; the near tier can hide an archer, and its
  row says so. At 300 m a figure 1.8 m tall is five or six pixels on a 1080-line screen.
- ALWAYS DRAWN: a party mate, and the player I duel from its count on (`duelMgr.opponent`), whatever the distance. The
  distance is asked first, the party only of a player past it (its answer allocates).
- NEVER CUT UNDER THE TRAVEL VIEW: OW-PEERS grows every player to be seen from up to 450 m overhead, across more ground
  than any tier.
- HELD AT THE EDGE: a player drawn last frame is kept to `PEER_RANGE_HOLD` (1.1) times the range, so one walking along
  it is not torn down and built again at every step. A cut player's sprite batch and walker figure go with them; the
  class sprite's bundle stays while they are in the room, so one walking back in is drawn as their sprite that frame.
- THE ROOM'S WHOLE LIST: `RemotePlayers.sync` takes it beside the cut list (`room`) - a resurrection is seen in it, and a
  cut player keeps their sprite's bundle by it.
- THE DOORS: `shows(id)` is false only for a player the cut left out - the crosshair's pick and the plaque and a gift's
  aim (`crowdDrawnHere`) and a blow's spark and a cry (`peerFxFrame`) ask it, as they ask GATE-CROWD's.

THE FOUR HOSTS: `scenes/world.js` WIRED - its online frame is the one that draws other players. The interior and the
dungeon are drawn by `scenes/worldModes.js`, which takes the list it cuts through the host's `extraBillboards` and
`drawPeerBodies`; `scenes/dungeonContext.js` draws no other player; `scenes/exterior.js` (the fixed city) runs no online
session, so there is nobody to cut.

Pins: `test/peerrange.test.js` (10) - the choices and the shelf, the default against a player's shot, the law on both
axes with me off the origin and its hold, the party asked last, the host's range (the held set forgotten on every way it
stands down, the default range), the real `RemotePlayers` letting a sprite go past the hold and taking it back as its
sprite in one frame with no compose, a resurrection seen in the room, the online frame's cut (evaluated as the frame asks
it, the duel manager's own shape) and its doors, the card reading the law. Mutants: `tools/mutants/peerrange.json`, 42
dead. Moved with the line: GATE-CROWD's online-frame pin, INVIS-NET's (twice: the cut, and the dolls' sync handed the
room), MWBODY1's (the same two), OW-PEERS' and INVIS-LOOK's sync pins, and the boat marker's slice; `tools/mutants/gatecrowd.json`'s spark and drawn-here
mutants re-aimed, 45 dead.

AUDITED the same day (`01-Overview/Audit-Peer-Range-Halo-Thin.md`): what it changed is written into this section as it
now stands.

NOT SEEN ON A GPU OR IN THE REAL GAME: no ARENA2 and no GL here. The owner's eye is the next gate - a crowded city
online at the default and at Everyone.

## PERF-TEAMS — another player's team is culled

**Found** (the owner: online, 40 fps by a populated town, 165 once forty map pixels out). Not the peers - their poses
reach only RANGE_PIXELS (3) - but what a CELL room holds whatever its players' distance: HCC-PARK keeps up to
`PARK_CELL_MAX` (32) parked teams a sixteen-pixel cell for `PARK_TTL_MS` (72 h), owner online or not, and the client
holds every one of its cell's and its halo's. `horseCartPool.js` stepped each one every frame (the stride, the shafts'
raycast, the wheels, the billboards, the harness) and drew each one whole - wagon, bogie, wheels, cargo, a caravan's
room, every part a shadow caster - with no distance and no view test: a team twelve kilometres off, past the 6 km far
plane, cost what one in the street did. A town's parking lot is a few hundred draws a frame and their casts; leaving the
cell (forty pixels out, here) dropped them all at once.

**The fix.** Past `PEER_TEAM_DRAW_M` (400 m, horizontal, `PEER_TEAM_DRAW_SLACK_M` 25 m of hysteresis) a peer's team
keeps its word and its ease alone (`p.far`): no stride, no shafts, no wheels, no billboards, no harness, no draw - the
ease goes on, so a team walked back into the reach stands where it is. The ground probe (DISC20-C) stays: it is once a
word, never a frame's cost. My own parked wagon past the reach is not drawn either. Within the reach each wagon is asked
the yards' verdict (`yardCull`, PERF-YARD's law) over a box round it (`peerTeamBox`): in view drawn, in a shadow's reach
cast alone (a caravan's no-shadow room casting nothing), else nothing. The travel view is never cut by the eye's
distance (its eye stands hundreds of metres back over a grown world) and a grown rig is drawn whole; the window's view
out takes no far team.

Pins: `test/perf_teams.test.js` (5), over the real wagon parts. Mutants: `tools/mutants/perf_teams.json`, 12, all dead;
`wagons2.json`'s RW1xWAGONS2-the-peers-left-out re-aimed at the guarded line.

## PERF-WAGON — the rest of the carts, wagons and tents are culled

*Mac: "For carts, wagons, etc, we need culling".*

**Found.** PERF-TEAMS culled another player's team, and the pool's own wagons, in the world host. The same pass still
drew the rest whole every frame, behind the eye or not: the living world's road teams (LW10: up to `WAGONS_DRAWN` (6)
wagons, each its body, its wheels and a load of up to twelve pieces, every part a shadow caster), a team's harness (a
tube mesh an owner), Eye of the Beholder's cart (model 41239), every camp's tent (SURV3, the other players' among them)
and a stood hideout's tents (LW12). And the fixed city's host (`exterior.js`) handed a test to none of them - PERF-TEAMS
wired the world host alone (THE FOUR HOSTS RULE).

**The fix.** PERF-YARD's law, each by a box it already had:
- the road's teams by PERF-TEAMS' own verdict over PERF-TEAMS' own box (`horseCartPool.js drawWagonSeen` over
  `teamVerdict` and `peerTeamBox`, handed out on the pool's `presentation`; `roadTeams.js draw(r, texRemap, cull)`;
  `livingRoads.js drawTeams(r, cull)`) - a grown team under the Overworld drawn whole, as PERF-TEAMS draws a grown rig;
- the harness by its ropes' own sphere (`renderer.createMesh`'s `bounds`, which `updateMeshVertices` keeps with them;
  `frustum.js sphereAabb`), drawn in view alone - a strap casts nothing, so off screen there is nothing to record;
- the cart by its mesh's own box (the one its target already used), a camp's tent by its model's box (its target's), a
  hideout's tent by its mesh's sphere - one mesh each, through `decorRoom.js drawSeen`;
- the maps-alone renderer is one (`decorRoom.js castOnly`, one a renderer): the merchant yards' copy and PERF-TEAMS'
  are retired into it.

The world host hands each the street's test (`yardCull`). The fixed city makes its own over its frame's planes
(`exterior.js streetCull`, the planes made before the pass, `?cull=off` honoured) and hands it to the cart, the tents
and the pool's wagons. `worldModes.js` and `dungeonContext.js` draw none of them, and the view out of a window takes no
test (its eye is not the street's). A thing whose box is not in hand - a mesh with no sphere, the cart before its
triangles - is drawn as before and never asked.

Not changed: the Sigil Broker's cage, the Oblivion Gate's stone, the rite's circle, a bounty farm, the quays and the
LeFay monument draw whole in the same pass - one landmark each, not a crowd (What is left, 9).

Pins: `test/perfwagon.test.js` (6), by execution over the real producers - the measures, the road's teams over a real
pool and its baked Small Cart, a real driven harness, the real cart, a real camp's tent and a real hideout's over the
synthetic map's bands - and the four hosts' wiring. Mutants: `tools/mutants/perfwagon.json`, 25, all dead.
`perfyard.json`'s PERF-YARD-n and `perf_teams.json`'s PERF-TEAMS-the-room-cast are re-aimed at the one `castOnly`, and
`lw12.json`'s LW12-wire-draw at the hideouts' line that now hands the test. Pins moved (PIN MOVED): `hcc_hosts` (both
hosts' tents-and-wagons lines), `lw10_wagons` (the host's teams line, the pool's presentation), `lw12_outlaws` (the
hideouts' line). Every existing record within three lines of a changed line was run again: 25, all dead.

## PEER-HULL-RANGE — another's ship far off stands no hull here

*A player's report (2026-10-11): under 50 FPS on a Radeon RX 6700 XT and an i5-13600K at 1080p; a profile of the live
game, the main thread busy every frame and the GPU idle.*

**Found.** Every peer in the room says their sea in their word (`navalHost.js applyWord`), and the host stood a hull in
Come Sail Away's pool for every ship it was told of (`buildOne`), wherever she sailed. The pool walks and bakes each
drawn boat every frame (`comeSailAwayPool.js frame`: her active objects' walk and her sails' `FixDeformations`), so a
busy room's 30-40 ships - most of them 80-700 km off, round the other players - were a third of the main thread. Held
back past 1.5-2 km on the live client: 38-45 FPS became 103-150.

**The fix.** Her record is kept as ever (her stander's word, her course between words, her fires, the claims and the
handover); only her hull waits. Another's ship is built within `PEER_HULL_NEAR_M` (3,000 m) of the eye, and past
`PEER_HULL_FAR_M` (3,500 m) her hull goes back to the pool (`shedFarHulls`) - never one being boarded or with bodies on
her deck - and is built again as she comes within reach. Both edges stand past where a peer's own sea reaches me
(`NAVAL_SHARE_RADIUS` + `LINER_DROP_M`) and past the fog. My own ships are untouched.

Pins: `test/peerhullrange.test.js` (1), over the real pool through a peer's word. Mutants:
`tools/mutants/peerhullrange.json`, 3, all dead.

**AUDIT PEER-HULL-RANGE (2026-10-11, Mac: "Audit it. Ensure it doesnt kill fidelity").** Two ways the first cut moved
the picture, both fixed:

- *Its edges stood inside the fog.* "Past the fog" held for DFU's own 0..2400 row, but the enhanced lane scales the
  linear fog's end by Land View (`world/weather.js` scaleFogForDistance: 2400 x LV / 3) - 4,000 m at its default 5,
  4,800 m at 6 - so a ship came into being at 3,000 m 63-75% fogged and went out at 3,500 m. The edges are 5,000 /
  5,500 m now: past the widest linear fog the port draws and past every DFU and Dynamic Skies row (Sunny's 2000..3600;
  the exp2 rows at their lightest density show under 1% at 5 km). The far ships this is for were 80-700 km off, so the
  frame's saving is the same; nothing in play reaches past 1.2 km (engage 750, tags 700, compass 900, news 1,200).
- *A hull built again wore her last hull's past.* poseShip remembers on her RECORD what it set on her hull - her canvas
  by height (`sailsByHeight`, the hull's own sail nodes), her colours and her wake - none of which had ever outlived a
  hull before. Built again, she came back under full canvas whatever her sail share (the old hull's sails were the ones
  furled), a struck ship flying her colours, a ship under way with no wake; whole in one frame where every ship fades
  in (SHIP-FADE); and her fire flats hung over the sea where her hull was given back. `shedFarHulls` forgets the three,
  hides her fires and stills their loops; `buildOne` fades a hull built again in from nothing.

Pins: `test/peerhullrange.test.js` (+2): every lane's fog closed at the near edge; a struck ship and a torn, burning
ship under way given back and built again, each in her record's dress. Mutants (+6): the first cut's edge, each of the
three remembered things kept, her fires left hung, whole in a frame.

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
5. **The sprite peers** - a distance tier since PEER-RANGE (above): past the card's distance nobody is stepped or drawn.
   Left: within it there is still no cap - a crowd inside 300 m is every one of its sprites; and `online.tick` plays a
   pose for every peer of every room held open (measured small, 0.028 ms a frame at 100).
6. **The Living World's dodge** walks the whole pool for each walker each frame, with an array and a sort a walker
   (`livingTown.js _dodge`). Nothing a player sees - and measured small: a street's frame is 0.2 ms mean in the great
   city (`tools/livingPerfProbe.mjs`, the pool 96 at most), the dodge a part of it.
6b. **The name layer's size and its layers** (PERF-NAMES' probe): a name's font size moves with its distance every frame
   it walks, and lays it out and repaints its text by itself - the rest of the layer's ~1.9 ms at 72 names. Two levers,
   both the owner's because both change pixels: each tag on a layer of its own (`will-change: transform` - 60 names
   turning 1.48 -> 0.88 ms, but 2.4% of the screen's pixels differ, glyph edges softened by up to 95 of 255 on a channel)
   and the size in coarser steps (a name's size would step as it nears).

**The placed pieces.**
7. **A furnished room's lights** - every lit piece joins the room's lights and indoors every light casts
   (`everyLightCasts`, up to 48 small cubes); each asks a signature walk of every record each frame, and a light new to
   a slot draws all six faces at once (a room of lamps entered: up to 288 faces in its first frame). A budget for the
   fresh slots shows a light's shadow a frame or two late.
8. **The yards' sync** stringifies every home's pieces every half second and puts a whole yard again on any change.
   Nothing a player sees.
9. **The cart's pass's landmarks** (PERF-WAGON) - the Sigil Broker's cage, the Oblivion Gate's stone, the rite's
   circle, a bounty farm, the quays and the LeFay monument are each drawn whole wherever they stand streamed. One each:
   a box apiece and the street's test would save a few draws a frame. Nothing a player sees.

**The GPU** (unchanged from PERF-NEXT): the cloud march, Steady shadows' every-frame lantern faces, an automatic quality
governor - each the owner's.

## For the owner

- **The A/B this branch owes**: on a machine with the data, `ARENA2_PATH=... node tools/frameProbe.mjs knight night`
  with `TREE=` the base, then this branch (`node tools/frameAb.mjs` reads the two) - the frame's own script time
  is what PERF-V8 moves, and a crowded town with yards is where PERF-YARD, PERF-INST and PERF-COL2 show.
- **The picture's levers** above (1, 4, 6b, 7) are yours - and 5's distance is the Other players card's now (PEER-RANGE): each trades a little of what is seen for frame time.
