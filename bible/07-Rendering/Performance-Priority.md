# PERF-PRIORITY — placed objects, crowds and the render range (2026-10-10)

*The owner: "Real quick, performance must be highest priority now, it even runs shoppy on my nasa pc xD - prob caused
by placed objects by players, crowded places and render range".*

Six changes, each a cost that grew with one of the three things named and none of them a change to the picture:
PERF-V8 (the world host's frame, a function V8 never optimized), PERF-YARD (the yards' placed pieces culled - the homes'
and the merchants'), PERF-INST (the shadow pass's memory of a model's copies), PERF-COL2 (the collider's streamed
pixels), PERF-FACE (a lantern's six faces copied for one mover) and PERF-NAMES (the crowd's names laid out at every
move). Then what is left, ranked - the levers that do move
the picture are the owner's. Later the same day: PERF-TEAMS (another player's team, cut by its distance and the view)
and PERF-WAGON (the rest of the carts, wagons and tents, and the fixed city's host); the next day HARNESS-REST (a
standing team's harness neither stepped nor sent), its section after PERF-WAGON's.

AUDITED the same day (the owner: "Lets do an audit on this"): five cold lanes over a frozen snapshot, every finding
fixed, pinned and mutated or recorded - `01-Overview/audits/Audit-Perf-Priority.md`. What the audit changed is written into
each section below as it now stands.

PEER-RANGE (the same day; the owner: "So for online performance, I believe the rendering of players far out is
contributing to poor performance") pulled the crowds' lever 5 below, and it DOES move the picture: past a distance the
player chooses (300 m by default) another player is not drawn. Its section is after PERF-NAMES.

PEER-HULL-RANGE (2026-10-11, a player's report from a profile of the live game) does the same for the sea: another
player's ship far off stands no hull on my client. It does not move the picture - every ship it holds back is past the
fog on every lane (AUDIT PEER-HULL-RANGE moved its edges there and gave a hull built again her record's dress). Its
section is after PERF-WAGON.

STORE-CACHE (2026-10-11, a player: "faz uma verificacao no meu jogo aberto ... o que mais esta custando o FPS") is the
next profile of the live desktop client: a storage read was a file read, and the game reads storage every frame. It
does not move the picture. Its section is after PEER-HULL-RANGE.

The same player's next profiles (2026-10-11 and 12) brought six more, merged together: PERF-DYE (a horse's look dyed a
few pictures a frame), OWN-HULL-RANGE (my own sea's ship far off stands no hull either), OVERWORLD-WALK (walking the
overworld, the same answers for less), NAV-FAR-AI (a far captain keeps her watch every few frames) and WILD-DRY (the
dry-ground answer, read only until it is certain), their sections in that order after STORE-CACHE's; and HOLY-DAYS (the
pilgrims' holy day, the same answer for less), its section after What is left. PERF-DYE wears a new look a few frames
later (the bay's until then, as before); the rest do not move the picture - OWN-HULL-RANGE's and NAV-FAR-AI's ships are
past the fog. WILD-FREE, the same load's other half, is written in
`11-Multiplayer/Wild-Zone.md` section 12, THE COST.

YARD-MERGE (2026-10-12, a capture of the draws in Daggerfall) merges a settled yard's models into one mesh and its
flats of one picture into one batch: the draws cut by 17-18% where furnished yards stand in view. Its section is after
YARD-RANGE.

PERF-HIDE (2026-10-12, a capture of a player's client standing still for four minutes after entering the world: the
frame rate climbs for some twenty seconds) dyes a horse look's pictures in under half the CPU, byte for byte the same
pictures. Its section is after PERF-DYE.

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

**MWNPC19 (2026-10-12, `04-Characters/Morrowind-NPCs.md` section 28).** The frame had grown to 45,893 bytes, 187 under
the 3/4 line, and the standing horses' and the crews' calls took it over. Their work is the host's own functions
(`standingHorsesFrame`, `offerCrews`), and the look's step before the motor - `if (!gamePaused()) {`, the look filter,
the keyboard look, the lock-on - runs as a closure of its own, `frameLook`: 44,976 bytes.

Pins: `test/scenes/perfv8.test.js` (2) - every `frame` in the world host's graph and every closure moved out of one under the
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

Pins: `test/scenes/perfyard.test.js` (6) - the verdict over real planes from a real projection; the pool by its verdict over
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
  (`ui/enhanced/enhancedMenu.js`, `yardRange` on the prefs shelf; the law `net/yardRange.js`): Off, 75 m, 150 m or 300 m - the
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
the draws again and are the next lever (YARD-MERGE, below, pulled it, and merged a yard's models too). Whether this player's town is yard-bound is not known: the 15.1 ms before the
frame is not the game's code (`Performance-Exterior.md` SCRIPT-SPLIT), and `?perf=cpu` against an offline visit to the
same town (yards stand online only) would say.

Pins: `test/scenes/yardrange.test.js` (5) - the law and the shelf's default, the row's wiring and the host's; the size bound;
over the real yard and pool, the default, 75 m and Off - models and flats alike, my own yard always, Off taking a
stranger's yard down and standing it again; my own yard 200 m off; six syncs of an unchanged town stringifying nothing.
Mutants: `tools/mutants/yardrange.json`, 10, all dead.

## YARD-MERGE — a yard's models one mesh, its flats of one picture one batch

**Found.** A capture standing in Daggerfall (2026-10-12, the perf build: main and the open performance pull requests,
every WebGL call counted a frame and a draw's stack sampled one in 32): 1,878 draws a frame, 7,854 WebGL calls, 569
textures bound. About 360 of the draws were the yards' model pieces - `decorRoom.js draw`, a `drawMesh` a piece, one
draw a texture of its model - and at a second spot the yards handed 185 flats to the billboard pass, 86 pictures among
them, each its own batch and its own draw. The town's own statics had been one mesh a pixel since PERF4; a yard's
pieces never were. YARD-RANGE's "Left" named the lever.

**The fix.** A pool its host lets merge (`createDecorRoom`'s `merge` - the town's yards; a room's host gives none) merges
once it has stood unchanged `DECOR_MERGE_SETTLE_MS` (500 ms: a town's yards stand piece by piece as their models land -
one merge, not one a landing) and its host's budget allows (`homeYards.js` `YARD_MERGES_A_FRAME`, one a frame: a town
streaming in stands every yard at once).

- **The models.** PERF4's `StaticBatchBuilder` over every model piece standing (`decorMergeable`: its triangles,
  normals and texture coordinates in hand, no door, standing from the pool's origin) - each piece's own matrix less the
  origin (`mergeDecorModels`), drawn back at it (`decorMergeMatrix`), grouped by each sub-mesh's OWN texture key,
  unresolved: the merge draws through the host's remap as each piece did (a yard's town's climate is written into its
  pixel's table as its pieces land, so a key resolved at the merge could be one landed late). One `drawMesh` - one draw
  a texture - by the host's verdict over the merge's whole box (PERF-YARD's law), its count the pieces'.
- **The flats.** Flats of one picture, one drawn size (a mirrored one apart) and one lean (the sway and Windfall's share
  its batch was given) are one billboard batch of many quads, each where it stood (`decorFlatMergeKey`), as a town's
  flats of one record are. Drawn alone, as before: a figure (the people lane's), a mount (the decal pass's), an animated
  flat (its animator's, frame by frame - a lamp's flame), a tree Low Poly Trees stands (scaled a flat at a time), any
  batch with a look of its own, and a picture standing once. A group is handed while any of its flats is big enough to
  see (YARD-RANGE's size law).
- **Change.** A piece standing after the merge draws on its own until the next; a merged piece taken out, moved or
  replaced lets the merges go at once - every piece draws on its own that frame - and the pool merges again once it
  settles (the decorator's edits included). A recentre moves the merges as one (`restand`); nothing is merged again.

**What it changes on screen.** Nothing for a piece in view. A piece off screen whose yard's box is in view is drawn
(the GPU clips it) where it was culled alone, and a model too small to see far off (YARD-RANGE's cup past 15 m) is
drawn with its yard's merge - the flats keep the size law a group at a time.

**Measured** (the perf build, RX 6700 XT, the `__ymOff` switch flipped live, ABBA, standing still; draws counted a
frame by a light wrapper on the draw calls):

| spot | draws a frame, off -> on | FPS, off -> on |
|---|---|---|
| Daggerfall's street, facing furnished yards (models only) | 2,343 -> 1,940 (-17%) | 152.1 -> 158.8 (vsync on: 240 Hz steps) |
| above the same streets, 10-20 m over the roofs | 2,594 -> 2,129 (-18%) | 163.1 -> 164.2 (vsync off: within the noise) |
| the same, a CPU profile and a toplevel trace over it | - | 159.8 -> 166.6 |

The same spot's time a frame (the CPU A/B, 4 phases a side): the GPU process's main thread - where ANGLE turns each draw
into Direct3D - 4.45 -> 3.95 ms (-11%, every phase on below every phase off); the renderer's main thread 6.15 -> 5.90 ms
(-4%). On this machine the frame is not the draws': the FPS moves within the noise without a profiler. The cut is the
draws and their cost on both threads, which is the frame on a machine where a draw is dear (the browser's WebGL, a
weaker CPU, a slower driver - YARD-RANGE's player at 20-40 fps).

Pins: `test/scenes/yardmerge.test.js` (12) - the merge where each piece's matrix stood it, keyed unresolved; what joins one;
the settle, the budget, one draw through the same remap; the verdict over the merge's box and a recentre; a removal
letting it go and asking a merge again, a late piece on its own; no merge for a room, one model, or one without
normals; the yards' budget wired; the flats' key and every way out of it; a group of one picture, handed once; a
removal and a recentre over a group; the size law a group at a time; a group's lean, a host's flat asking. Mutants:
`tools/mutants/yardmerge.json`, 53, all dead.

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

Pins: `test/render/perfinst.test.js` (14) - the scan as it shipped is the ORACLE, run beside the pass over seeded stories
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

Pins: `test/scenes/perfcol2.test.js` (5) - every ray, cast, sphere, contact and move over a streamed world of riders,
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

Pins: `test/render/perfface.test.js` (2) - every live face ends every frame as its cache plus that frame's movers (a model of
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

Pins: `test/net/name1_bubbles.test.js` reads the place from the transform (and never `left`/`top`). Mutants:
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

**The fix** (`net/peer/peerRange.js`). GATE-CROWD's cut, by distance in place of a count, run on the online frame's drawn
list just before the court's own (`scenes/world.js` `ranged`): past the distance on the Other players card a player
stands nowhere on this screen - no body, sprite, name, light, cast, spark or step - and their map marks, taken off the
whole list above it, stay.
- THE CHOICES: 150, 300 or 600 m on the ground, or Everyone (`PEER_RANGE_TIERS`; `systems/uiPrefs.js` `peerRange`, a
  literal pinned equal to the law's for GATE-CROWD's boot-path reason; the card's Draw distance row,
  `ui/enhanced/enhancedMenu.js` `peerSpritesCard`).
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

Pins: `test/systems/peerrange.test.js` (10) - the choices and the shelf, the default against a player's shot, the law on both
axes with me off the origin and its hold, the party asked last, the host's range (the held set forgotten on every way it
stands down, the default range), the real `RemotePlayers` letting a sprite go past the hold and taking it back as its
sprite in one frame with no compose, a resurrection seen in the room, the online frame's cut (evaluated as the frame asks
it, the duel manager's own shape) and its doors, the card reading the law. Mutants: `tools/mutants/peerrange.json`, 42
dead. Moved with the line: GATE-CROWD's online-frame pin, INVIS-NET's (twice: the cut, and the dolls' sync handed the
room), MWBODY1's (the same two), OW-PEERS' and INVIS-LOOK's sync pins, and the boat marker's slice; `tools/mutants/gatecrowd.json`'s spark and drawn-here
mutants re-aimed, 45 dead.

AUDITED the same day (`01-Overview/audits/Audit-Peer-Range-Halo-Thin.md`): what it changed is written into this section as it
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

Pins: `test/scenes/perf_teams.test.js` (5), over the real wagon parts. Mutants: `tools/mutants/perf_teams.json`, 12, all dead;
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

Pins: `test/systems/livingWorld/perfwagon.test.js` (6), by execution over the real producers - the measures, the road's teams over a real
pool and its baked Small Cart, a real driven harness, the real cart, a real camp's tent and a real hideout's over the
synthetic map's bands - and the four hosts' wiring. Mutants: `tools/mutants/perfwagon.json`, 25, all dead.
`perfyard.json`'s PERF-YARD-n and `perf_teams.json`'s PERF-TEAMS-the-room-cast are re-aimed at the one `castOnly`, and
`lw12.json`'s LW12-wire-draw at the hideouts' line that now hands the test. Pins moved (PIN MOVED): `hcc_hosts` (both
hosts' tents-and-wagons lines), `lw10_wagons` (the host's teams line, the pool's presentation), `lw12_outlaws` (the
hideouts' line). Every existing record within three lines of a changed line was run again: 25, all dead.

## HARNESS-REST — a standing team's harness comes to rest

*A player (2026-10-11): "agora ataca os arreios das carroças" - the next cost in a profile of their live client (a
town at night, 1080p, RX 6700 XT).*

**Found.** 4.0% of the main thread (598 ms of 15,014; again 512 of 14,152 the same evening, 0.42 ms a frame at 76
FPS): `horseCartPool.js:"function stepHarness(dt) {"` steps every harness within PERF-TEAMS' reach every frame - its
ropes' Verlet step, the tube laid again, the vertices sent (`renderer.updateMeshVertices`, which measures the mesh's
sphere, each sub-mesh's over the index list - both windings, eight times the vertices - and compares the bake). PERF-WAGON
culls the draw, not this. The live client held 11 to 14 harnesses, every one a parked team's (two or four traces), and
read over CDP across 60 frames not one end had moved; the ropes drifted ~6 mm, the step's own jitter as the frame's
length changes (the sag's balance moves with dt), nothing a 22 mm strap shows.

**The fix.** A harness whose ends have stood within `HARNESS_STILL_M` (0.1 mm) of where they stood for `HARNESS_REST_S`
(3 s) is neither stepped, laid nor sent - it hangs as last drawn - until an end moves, and that frame it steps again
(`harnessStill`, over each end and its scale). Measured from where the ends stood when they came to rest, never from last
frame, so an ease creeping a hair a frame adds up and wakes it. Three seconds is past any swing: ROPE damps a step by
0.97 at 60 steps a second at least, so under 0.5% of a swing is left. A floating-origin shift, a horse led off, a wagon
driven: each moves an end and wakes it. Nothing a player sees but the jitter gone.

**Measured.** In the player's running client, a LOWER BOUND by A/B: the bundle is not open to a live edit (Electron's
V8 refuses `Debugger.setScriptSource`, and its `dagger://` chunks pass no CDP `Fetch`), but the pool's harness map is
public (`harness`), so each harness's `ropes.forEach` (the tube laid again) and the renderer's `updateMeshVertices` (the
send) were wrapped as own properties: on B a harness under this law (0.1 mm, 3 s) was neither laid nor sent, on A as
shipped; the Verlet step ran on both (~0.09 ms a frame in the profile, out of reach). Six rounds of each, 10 s,
interleaved ABBA, standing by the town's parked teams: 10 harnesses, all 10 at rest on B; the laying and sending 0.26 ms
a frame on A and none on B; 86.6 -> 89.8 FPS mean (medians 88.0 -> 89.8), 11.6 -> 11.1 ms a frame - inside the
rounds' noise (B ahead in four pairs of six). With the step the branch also stops, ~0.35 ms of an ~11.5 ms frame: ~3%
where the teams stand, nothing where every team is on the move.

Pins: `test/systems/horse/harnessrest.test.js` (3), over a real pool's real driven harness. Mutants: `tools/mutants/harnessrest.json`,
7, all dead.

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

Pins: `test/systems/naval/peerhullrange.test.js` (1), over the real pool through a peer's word. Mutants:
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

Pins: `test/systems/naval/peerhullrange.test.js` (+2): every lane's fog closed at the near edge; a struck ship and a torn, burning
ship under way given back and built again, each in her record's dress. Mutants (+6): the first cut's edge, each of the
three remembered things kept, her fires left hung, whole in a frame.

## STORE-CACHE — the desktop store answers a read from memory

*A player's own client (2026-10-11): the installed app at 1920x1080 on a Radeon RX 6700 XT, online in a town at night
with five players about. A 15 s CPU profile through the shell's debugging port (`--remote-debugging-port`, CDP
`Profiler`), 86 FPS over it, script 13.7 ms a frame on the HUD.*

**Found.** 18.5% of the main thread (2,772 ms of 15,014) was `localStorage.getItem` - in the desktop app the DA2 store
(`app/lib/fileStorage.cjs`), which answered every read with a `readFileSync` (and an `encodeURIComponent` and a
`path.join` for the file's name): 68 us a read on this machine, where the browser's localStorage answers from memory.
The game's readers are written for the browser's:

- 2,405 ms: the professions' book keys its counting set by `profBook.js:"const slot = () =>"`, the account half of it
  the signed-in session (`accountClient.js` `storedSession`, `dagger.account.session`), so every `counting` - every
  harvest node near the player, every frame, from the marks, the target's scan and the pump - read the session's file.
  GATHER-SPEED cached the set and not its key.
- 166 ms the remains waypoint (`dfjs.wild.remainsWp`, every frame), 86 ms the claims' watch, 80 ms the weapon rig's
  glyphs and aura, ~40 ms the rest.

**The fix.** The store keeps a pref's or a slot file's text as last read or written (`read`, by key) and reads its file
again after `readTtlMs` (1,000 ms) - a key asked every frame is one file read a second. A write keeps what it wrote; a
write that throws and a remove forget the key, so the next read is the disk's. The enumeration sweep's `rescan` empties
it, so a save copied into the open Saves folder reads as itself the moment the sweep lists it, as before. The
screenshot is never kept. The game's readers are untouched: one change at the seam answers every reader there is and
every one to come, and the browser build has no file to read.

**Measured.** The store over the player's own Prefs, the session read 20,000 times: 67.9 us a read on main, 0.095 us on
the branch (`node` 22; the shell's asar-patched `fs` is slower still). And in the player's running client, A/B: the
bridge object is frozen, so the page's own wrapper (`appStorage.js`'s, which every reader holds and which looks its
`getItem` up at each call) was found through CDP `Runtime.queryObjects` and answered, on B, from a cache under this
law (1 s, forgotten on its own writes) with one bridge crossing kept a read (`key(0)`), so B costs what the branch
does; on A, as shipped. Six rounds of A and B, 10 s each, interleaved ABBA, standing still in a town at night:
58-64 reads a frame on both arms, 1.83 ms a frame in them on A and 0.04 on B; 85.7 -> 109.9 FPS mean (the medians
92.5 -> 114.2), 12.0 -> 9.2 ms a frame, and B ahead in every pair. The p99 does not move (both ~19-21 ms: the frame's
hitches are elsewhere).

Pins: `test/tooling/storecache.test.js` (3) - a frame's 300 reads of a key are one disk read, of a key the store wrote none, of
an absent key one, of the screenshot each; a file changed by hand seen past `readTtlMs` and at once after a rescan; a
write, a remove and a thrown write each leave the next read the disk's truth. Mutants: `tools/mutants/storecache.json`,
6, all dead.

## PERF-DYE — a horse's look is dyed a few pictures a frame

*A player's live client (2026-10-12), two minutes' travel across the overworld: 58 FPS on average, 122 frames over
50 ms.*

**Found.** 29 of those 122 frames were one thing: a horse look met on the road (a passing team, a parked one come into
view) having its walk set dyed. COATS1 dyes a look off the bay's kept pictures, a CPU pass a picture
(`horseCoats.js recolorHorse`), under a budget of one SET a frame (`horseCartPool.js ensureHorseLook`). The views are
five pictures; the walk set is forty (`HORSE_VIEWS` x `HORSE_WALK_FRAMES`), some 45 ms on a desktop, in a single frame.
The budget kept six looks from landing in one frame, and still let each one stop a frame on its own.

**The fix.** The budget counts PICTURES: `HORSE_DYE_PICTURES` (5) a frame, among every look (`_dyeBudget`, refilled
by the pool's `frame`). A look's pictures are dyed in order - its views, then its walk frames - and it counts how many
of each are up (`up.views`, `up.walks`); a look is worn once every picture it draws is up, the bay's until then, as
before. Five a frame is the views in one frame and the walk set over eight. A look let go (`dropLook`, past
`HORSE_LOOKS_KEPT`) gives back exactly the pictures dyed so far, a set's first ones too.

**Measured.** On the live client (0.1.8127, a town with eight horse looks in view, the window in front), a conditional
breakpoint inside the walk set's branch alternating the shipped dye with this one, 20 s each, three times, every look
let go every 2 s so both dye the same horses over and over (336 and 329 walk sets):

| | a set a frame | `HORSE_DYE_PICTURES` a frame |
|---|---|---|
| frames over 50 ms | 89 | 0 |
| frames over 33 ms | 132 | 3 |
| 99th percentile | 54.1 ms | 20.9 ms |
| worst frame | 288 ms | 50 ms |
| median | 8.3 ms | 8.4 ms |
| average | 97.2 FPS | 95.3 FPS |

The same work, spread: the average holds under a load no road makes (every horse dyed again every two seconds), and
the hitch is gone. Then four minutes' plain travel across the overworld, nothing forced, the two alternating every
30 s: of the frames a walk set began in, 25 of 74 ran over 50 ms the old way (worst 104 ms) and 5 of 88 this way
(worst 92 ms, other work in the same frame). The travel's other hitches are not the dye's (the professions' store
reads, the ports' ships, the collector), and its average moved with the road, not the mode - the dye is some 3% of
the frame time either way. A first cut of the probe, a breakpoint on every `ensureLook` call, cost 118 -> 51 FPS by itself and
was thrown away.

Pins: `test/systems/horse/perfdye.test.js` (4), over a real pool: never more than `HORSE_DYE_PICTURES` a frame, among two looks too;
the views before the walk frames, each once, worn in the frame of the last; before the walk art, worn once the views
are; a look let go halfway gives back exactly what was dyed. `coats1_horsecoats.test.js`' two pool pins count frames
by `HORSE_DYE_PICTURES` (PIN MOVED). Mutants: `tools/mutants/perfdye.json`, 7, all dead.

## PERF-HIDE — a picture's hide is found once, and the dye allocates nothing a pixel

*A player's live client (2026-10-12), launched and left standing for four minutes after entering the world.*

**Found.** The frame rate climbed for some twenty seconds after the world came up: 37-60 FPS for the first five,
95-100 for the next fifteen, then 115-120. The first five were the world's own catch-up - the grass laid around the
player, the living towns' trips and walks, and 0.9 s of the main thread dyeing the wagon pool's horse looks
(`horseCoats.js recolorHorse`, PERF-DYE's `HORSE_DYE_PICTURES` a frame). A look is 45 pictures, and each was dyed from
nothing: the warm pixels found, gathered into regions, the horse's kept and the shadow specks beside them, the hide's
frame measured - all of it the PICTURE's (its pixels and `tack`), none of it the look's - and only then the coat and
the pattern laid. The pattern's own pass made a fresh array for every answer (`hsv`, `warp`, `nearest2`'s and
`markingAt`'s, `nearest2` swapping through one nine times a pixel), and asked a lattice cell's nine points again at
every pixel in it.

**The fix.** The hide is found once a picture and kept with it (`hideOf`, a WeakMap on the picture's pixels' array,
one hide a `tack`): the pixels the dye moves, in order, and their frame. Every look after is the dye's own pass over
those pixels. The kept art is read and never written (the pool's views and walk frames, the riders' decoded sheets; a
riding frame is a new array each decode), so the kept hide cannot go stale. The helpers answer into scratch
(`Float64Array`s, so every value is the double the array held) and `nearest2` keeps the nine points of the last cell
it was asked (`_cells`, keyed by the cell, the seed and the stretch). The arithmetic is the same, step for step: every
sprite and every 3D horse is byte for byte the picture it was.

**Measured.** Node 22, the 45 real pictures of Horse Cart and Cargo (121x95), 70 looks across every coat, pattern and
legs, each picture once per look (3150 dyes), three runs each, the outputs hashed:

| | before | after |
|---|---|---|
| a picture, every look | 0.83 ms | 0.375 ms (-55%) |
| solid | 0.18 ms + finding the hide | 0.115 ms |
| pinto | 0.43 ms + | 0.26 ms |
| appaloosa | 0.96 ms + | 0.57 ms |
| dapples | 2.0 ms + | 0.62 ms |
| roan | 0.77 ms + | 0.19 ms |
| outputs | | identical (sha256 of all 3150) |

(the per-pattern "before" is with the hide already kept: the first cut alone took the average to 0.61 ms.) The 3D
horse's dye (`recolorHorseTexels`, 90 looks on a 256x256 body) is identical too, and 18% faster (5.2 s -> 4.3 s).

Then the live client (the local build of main with #854 and #855, vsync on, one launch each way, the same character
standing in the same place for four minutes after the world came up, CPU profile at 1 ms): the dye 866 -> 384 ms of
the main thread. Over the first 7.5 s in the world, the frames over 20 ms 161 -> 116, 41 -> 55 FPS from 2.5 to 5 s
and 76 -> 102 from 5 to 7.5 s; the rate steady from some 17.5 s instead of 20. One run each way, so the frame counts
are a direction, not a measure; the dye's own time is. What is left of the climb is the grass laid around the player
(about 1 s), the towns' trips (0.65 s) and the streaming ring's pixels (2.3 s, spread on purpose over twenty seconds).

Pins: `test/systems/horse/perfhide.test.js` (5): the digest of 60 sprites (four pictures, every pattern, the pool's, the riders' and
the riding sprite's ways) and of 15 3D dyes, each the one before PERF-HIDE; a picture's hide kept - one a `tack`, a
copy of its pixels found again and the same, another picture's never; a dye cold or warm the same whatever came
between; the kept lattice cells found again for another seed or stretch (`latticeNearest`, `nearest2`'s door).
Mutants: `tools/mutants/perfhide.json`, 8, all dead.

## OWN-HULL-RANGE — my own sea's ship far off stands no hull either

*A player's live client (2026-10-12), main with every open performance fix built in, travelling the overworld along
the Iliac Bay's coast.*

**Found.** Halfway through the run fourteen hulls stood at once, 9 to 727 km off, in four regions - and the frame went
from 90 FPS to 37: their sails baked (`comeSailAwayPool.js frame`, +4.5 ms a frame), their wakes and flags gathered and
drawn (+3.4 ms), their rigging stepped (`navalHost.js poseShip`, +2.9 ms), their animators (+1.3 ms), the collector
(+1.5 ms). None had an owner. PEER-HULL-RANGE gave a far PEER's hull back to the pool, and built every ship with no
owner wherever she lay (`peerHullNear`: `!e.owner ||`). But a ship with no owner is not only this tab's own traffic: it
is also every peer ship this tab ADOPTS as its owner leaves the room or goes quiet (`releaseOwner` -> `adopt`, wherever
she lies) - so the 80-700 km fleets PEER-HULL-RANGE was written for came back as mine, hulls and all.

**The fix.** PEER-HULL-RANGE's edges for every ship (`peerHullNear`, `shedFarHulls`): built within
`PEER_HULL_NEAR_M`, given back past `PEER_HULL_FAR_M`. Her record sails, fights, burns and sinks as ever - the captains,
the director and the damage read the record, never the hull. But for what reads one of my own sea's ships BY her
hull wherever she is (`hullKept`): bodies on her deck, the boarding I am in, a prize not yet settled (`claimPrize`
moves her deck by her hull), and a fight - hers (engage or board, afloat) or one that targets her (`foughtIds`): a
shot lands only on a hull (`targets`) and a galley rams only one (`checkShipRams`), so a fight between hull-less ships
would never end. A peer's ship is unchanged.

**Measured.** On the live client with the fix built in and a switch for the old law, fourteen galleons launched
30-650 km off with the host's own `spawnShip`, the two laws alternating every 20 s, three times each, standing in the
overworld:

| | every ship of mine with a hull | OWN-HULL-RANGE |
|---|---|---|
| average | 75.1 FPS | 149.8 FPS |
| median | 12.5 ms | 8.3 ms |
| 99th percentile | 25.0 ms | 12.5 ms |
| frames over 33 ms | 5 | 0 |

Pins: `test/systems/naval/ownhullrange.test.js` (4), over the real pool: a ship of mine near and 90 km off, the eye coming and going;
a far peer's ship adopted as they leave stays hull-less; `hullKept`'s every case; a far ship it keeps built and never
given back, a peer's never kept by it. Mutants: `tools/mutants/ownhullrange.json`, 11, all dead;
`peerhullrange.json`'s PHR-no-range re-aimed at the build's new line, its nine all dead.

## OVERWORLD-WALK — walking the overworld, the same answers for less

*A player (2026-10-12): "when I stand on the coast my FPS is 130, when I start walking it drops to 40 practically."
Measured on the live client with every open performance fix built in: standing 115 FPS, walking the same coast 55 -
the frame's main thread 8.5 ms standing, 18.2 walking, and the page allocating some 430 MB a second.*

**Found.** No one thing: walking turns on a dozen systems that standing leaves idle, each 0.5-2 ms a frame. Three of
them did work that gave the same answer for less, and made most of the garbage the collector then stopped the frame for:

- **NAV-COST - the sea's captains** (`systems/naval/navalAI.js stepCaptain`, `scenes/naval/navalHost.js separateHulls`). A
  captain asked `hostile` - for a wary pirate a sizing-up, `shipPower` and `fightingPower` - of every ship in the sea,
  every frame, and only then whether it was in sight; and the pass that keeps hulls apart measured every pair of the
  sea's ships, two new flats a pair, nearly all of them hundreds of km apart. Now her sight is asked first (both halves
  read nothing they change), and a pair farther apart than twice their reaches is never measured (`hullOverlap`
  answers null for it: a hull's half extent along any axis is under its half length and half width together, and one
  of A's own axes holds at least 1/sqrt 2 of the distance between the centres); a flat is made once a pass, again once
  its hull is shoved.
- **PIXEL-KEYS - the sea's soundings** (`world/pixelKeys.js pixelKeyText`, `scenes/world.js csaPixelAt`). A captain
  sounds the water ahead (`navalIsWater`, three points a step of every probe), and each sounding made its pixel's key
  text anew, `${x},${y}`, to ask the built pixels. The text is made once a pixel now, kept by its numbers - the same
  string every time - within PIXEL_KEY_SPAN of nought, PIXEL_KEYS_KEPT of them.
- **PERF-ROPE - the moving teams' harness** (`systems/wagon/wagonRopes.js stepRope`). Every sub-step made two new end
  arrays, every step two more, and every link of every iteration a `Math.hypot` of three, whose every answer was boxed
  (7% of what the page allocated, walking). A rope steps in place now: its ends in its own arrays, the sub-step's in
  one pair for every rope, a length as a root of its squares - the rope it was to within a float's rounding.

**Measured.** On the live client with the three (and NAV-FAR-AI, its own pull request) behind one switch, walking the
same coast, the old and the new alternating 15 s at a time three times over, standing between:

| walking the coast | the old | OVERWORLD-WALK |
|---|---|---|
| average | 78.6 FPS | 92.8 FPS |
| median frame | 12.4 ms | 8.4 ms |
| 90th percentile | 20.8 ms | 16.7 ms |
| 99th percentile | 33.4 ms | 29.2 ms |
| allocated | 430 MB/s | 360 MB/s |
| main thread a frame | 12.7 ms | 10.8 ms |

By the profile, the harness's step -0.36 ms a frame (the old rope gone from it), the captains' `hostile` -0.21 ms; the
rest of the main thread's -1.9 ms is the walk's own (the terrain built, what the eye fell on). Standing, the same build
drew 203 FPS: walking still costs, and the rest is elsewhere (What is left).

Pins: `test/systems/naval/navcost.test.js` (4) - a captain never sizes up a ship past her sight, one in sight is and is fought; past
twice their reaches no two hulls overlap (20,000 random pairs); two in each other pushed apart, and a heap of three where
the old pass put them. `test/world/pixelkeys.test.js` (3) - every key the text it was (50,000 random pixels, negative ones,
-0, past the span, fractions), the same string each time, the keeping bounded, and the soundings asking by it.
`test/systems/wagon/perfrope.test.js` (2) - 200 teams' 120 steps against the old law restated, every knot within a micrometre; the
ends kept in the rope's own arrays. Mutants: `tools/mutants/navcost.json` (5 dead, 1 equivalent as recorded: the cull
is the cost alone), `pixelkeys.json` (4), `perfrope.json` (4), all dead.

## NAV-FAR-AI — a far captain keeps her watch every FAR_LIFE_EVERY frames

*A player's live client (2026-10-12), main with every open performance fix built in: the captains of the sea's ships
were 12% of the main thread and some 29% of what the page allocated while walking the coast, the ships this tab holds
with no owner numbering 2 to 31 through the day (its own traffic, and every peer's fleet it adopts as they leave the
room - `releaseOwner`), most of them tens to hundreds of km off.*

**Found.** `stepSea` stepped every captain of mine every frame wherever she was: her lookout over every contact, her
land probes ahead, her wandering course. AUDIT NAV1 already let a far ship's RIGGING step every FAR_LIFE_EVERY frames
past NEAR_LIFE_M on the time it missed; her captain had no such law.

**The fix** (`scenes/naval/navalHost.js keepWatch`, `watchesFar`). Past FAR_WATCH_M (5,500 m - where she stands no hull
to be seen, PEER_HULL_FAR_M) of the eye, a captain afloat, in no fight of her own (engage or board), lashed to no prize
and no fight's target keeps her watch every FAR_LIFE_EVERY frames, each ship on her own frame of the stride, on the
time she missed - never more than FRAME_STEP_S at once (the sea's own step: what she owes is stepped first when a frame
would carry it past), and come near, what she owes is stepped with her first frame there. Her damage, fires and sinking
keep every frame's clock; a frame between watches fires and runs out nothing. Unlike NAV-COST this is not the same
answer: a far captain's course is integrated in coarser steps (at most FRAME_STEP_S, the step the sea already takes
on a slow frame), seen by nobody here - her hull stands nowhere past PEER_HULL_FAR_M - and by a peer near her only
through this tab's word, which comes far more seldom than the stride.

**Measured.** On the live client, standing on the coast, NAV-COST alone against NAV-COST with this, alternating every
15 s four times: the captains' share of the main thread 0.06 -> 0.02 ms a frame (-67%), allocation 306 -> 295 MB/s -
but the sea emptied while it ran (17 ships of mine to 2: the peers came back for theirs), so the absolute numbers are
that hour's. With the 14-31 far ships of the day's worst hours the captains were 1-2.4 ms a frame
(OVERWORLD-WALK's profile), most of them past FAR_WATCH_M - two thirds of that is what this takes off.

Pins: `test/systems/naval/navfarai.test.js` (4), over the real sea: a captain past FAR_WATCH_M one frame in FAR_LIFE_EVERY on her
own stride, every second of her clock kept, a near one every frame; never more than FRAME_STEP_S at once at a slow
frame; `watchesFar`'s every case (near, the eye on the flat, no eye, engage, board, lashed, struck, sinking, a fight's
target, the fights asked last); a far captain come near steps what she owes, then every frame. Mutants:
`tools/mutants/navfarai.json`, 11, all dead.

## WILD-DRY — the dry-ground answer, read only until it is certain

*A player (2026-10-12): "as soon as you enter the game and open the map with V, the game freezes for 4 to 5
seconds."*

**Found.** One frame of 6.7 s on the live client, 94% of it in one question. The map's overlay draws the Wrothgarian
zone's giants (`wildGiants`), and their walking ground (`systems/wild/wildGiants.js cellsOf`, built once a zone mask)
asks every pixel of the zone the wild halls' `free` test - whose dear half is SPAWN-SHORE's
`createSpawnGround`: is the plateau a ruin would stand on dry? Each answer read the pixel's whole noiseless kernel,
129 x 129 = 16,641 samples, and averaged them (`spawnPlateauFloor`), for 12,564 pixels. Kept per pixel after, so
only the first open froze - and the zone's halls ask the same question as the world loads in it.

**The fix** (`world/spawnedDungeons.js spawnGroundDry`). The same answer, read only until it is certain: every
sample is in [0, 1] (sampleKernel's clamp01), so the running sum never falls - nor does a float sum of non-negatives,
nor the division and the product by positive constants - so once a column's running average is over the line, the
whole one is. A pixel that never gets there is answered by the very sum `spawnPlateauFloor` makes, in its order.
`createSpawnGround` asks it; `spawnPlateauFloor` stands as it was for its other readers.

**Measured.** Over the real zone (the player's ARENA2): the 12,564 pixels 17.9 s -> 1.0 s (17x), every answer the same.
On the live client, the map's first open in a fresh session, the old and the new in two sessions:

| the map's first open (V) | before | WILD-DRY |
|---|---|---|
| the frozen frame | 6,714 ms | **692 ms** |
| of which the giants' ground | ~6,300 ms | 393 ms |

And the zone's halls as the world loads (the same question; WILD-FREE's bench, the real zone): their first day
19.2 s -> 1.06 s on main's picks, 4.0 s -> 0.24 s with WILD-FREE's.

Pins: `test/world/wilddry.test.js` (3) - every pixel of thirteen grounds (the sea, a beach, coasts four ways, slopes, a
ridge, a ground whose first columns stand over the line and the rest under it, one the ground noise would lift over
it) answers as `spawnPlateauFloor(...) > SPAWN_DRY_ELEVATION` did, with four large-map levels; a dry pixel stops
reading early (inland under half the kernel, the mountains under a tenth) and the open sea reads it all; the spawns'
ground asks it. Mutants: `tools/mutants/wilddry.json`, 5, all dead; `spawnshore.json`'s SHORE-law-byte-only
re-aimed at the gate's new line, still dead.

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

**From a player's profile** (STORE-CACHE's, above; the boats' 7% there is PEER-HULL-RANGE's, merged after that build).
10. **The harness** - 4.0% of the main thread - is HARNESS-REST's (above): a team past PERF-TEAMS' reach is dropped
    from `_teams` and lays no harness, and every harness the profile held was a parked team's inside it, which now comes
    to rest. Left: a team on the move steps, lays and sends its harness every frame
    (`horseCartPool.js:"function stepHarness(dt) {"`), its rope stepped in place since OVERWORLD-WALK's PERF-ROPE. It
    moves, so nothing more is spared without changing what a player sees.
11. **The hover pick** - 3.3%: the exterior's tooltip ray is cast every frame over every target list (corpses, piles,
    torches, wagons, carts, camps). Asked only when the eye moved, or every other frame, it would halve. Moves the
    tooltip's answer by a frame.
12. **The professions' scan** - 2.6% once STORE-CACHE took its reads: the marks, the target's scan and the pump each
    walk the harvest nodes near the player every frame. Nothing a player sees.

**The GPU** (unchanged from PERF-NEXT): the cloud march, Steady shadows' every-frame lantern faces, an automatic quality
governor - each the owner's.

## HOLY-DAYS — the pilgrims' holy day, the same answer for less

*A player (2026-10-11): "eu sei que quando o jogo carrega normalmente da uma travada, tem alguma forma de voce medir
isso?" - the installed client's load captured from its first second through the debugging port (CDP Tracing, the
page's CPU profile, every frame's length and the long animation frames).*

**Found.** Entering the world froze it for ~20 s in two frames - 14.5 s, then 5.1 s - every millisecond the main
thread's script, none the GPU's: 8.1 s the wild zone's halls (`wildDungeons.js wildHallPicks`, asked by the nearest
dungeon's list - WILD-FREE, its own change), 5.7 s and 4.9 s the Living World planning its roads' day the first time a
town asked (`livingTown.js _roadsOf` -> the host's `tripsOf`). Of the roads' time, ~3.6 s and ~3.0 s were the pilgrims:
`trips.js holyTrip` built its town's temples again for every pilgrim (the towns near filtered by their ring and
`templeTown`, then sorted by distance), and `companies.js holyDayOf` asked `getHolidayId` of every day of the cycle at
every temple - a day of the year summed from the minutes and the 53 rows walked each time. The capture's own tracing
and sampling slowed the client; the shares are the profile's.

**The fix.** The same answers, asked less. `holidays.js holidayOn` reads the two tables once into the holiday row on
each day of the year (one row a day: no two rows share one), and `holidayKeptIn` is GetHolidayId's own test of a row
(every region's, or the region's ID - its index plus one); `holyDayOf` sums the day once a day, passes a day that is no
holiday or every region's (LW13's law, on a line of its own) without asking a temple, and takes the first temple in its
order that keeps the row - `getHolidayId`'s answer, as before. `trips.js templesNear`
keeps each town's temples by its trip world (the world's towns and their temples are the map's; `townsNear` was kept
already). The Living World's trips are every client's alike, so nothing may move: every answer is the old one.

**Measured.** In node 22 over the suite's synthetic map (`test/lwRoads.mjs` synthMap, 144 towns their regions spread
over 62, `townsNear` kept as the host keeps it), every town's trips for 90 days, cold, five runs: the same 88,279 trips
and 1,836 holy-day pilgrimages to the byte on both (a digest of every trip's id, kind, goal, times and holy day);
`holyTrip` 766 ms -> 29 ms of the run, the whole 877 -> 733 ms best. In the client the pilgrims' share of the two frozen
frames, ~6.6 s, goes; the rest of the roads' day (the other travellers' plans, the weighted picks) stands. Not measured:
the installed client on this branch.

Pins: `test/systems/livingWorld/holydays.test.js` (3) - `holidayOn` and `holidayKeptIn` against `getHolidayId` on every day of the year in
every region; `holyDayOf` against the old law restated, over 4,000 drawn cycles and temple lists; `templesNear` the old
filter and sort, asked of the world once a town. Mutants: `tools/mutants/holydays.json`, 6, all dead; `lw13.json`'s
LW13-holy-region re-aimed at the line that passes every region's day.

## ROADS-MISS — a roads' day not ready yet is asked once a tick

*ghandhikus (#889, 2026-10-14), from a player's Firefox profile walking out of a house in a city: ~4.6 s of ~8 s of the
main thread in `LivingTown._tick` -> `planOf` -> `_roadsOf` -> the host's `tripsOf`, in 100-300 ms tasks.*

**Found.** While a way the day's trips need is not asked yet, `tripsOf` answers undefined, and `_roadsOf` kept nothing
of the miss - so every resident's `planOf` in one `_tick` asked again, each a whole plan of every trip of every town near
(HOLY-DAYS above is the same call's cost when it answers). Measured on the suite's synthetic town: 139 asks in one tick.

**The fix.** `_tick` runs its body (`_tickNow`) with the miss kept: `_roadsOf` remembers the day that answered undefined
for the rest of that tick, and `_tick` clears it at both ends, so the next tick asks again and a day that answers is kept
as before. Nothing outside a tick changes.

Pins: `test/systems/livingWorld/roadmiss.test.js` (2) - an unready day asked at most once a tick over five ticks, asked again on later ticks,
and once ready kept by the day; a read outside a tick (`peopleOf`) asks again. Mutants: `tools/mutants/roadmiss.json`, 2, both dead.
## BOOT-OVERLAP — the boot's network, asked beside its work

*A player (2026-10-12): "vamos checar se da para melhorar o loading, eu vou abrir o jogo e voce mede o tempo que
demorou e por que" - the installed client (0.1.8217, an online character) captured from the process's launch into the
world through the debugging port: browser Tracing on one connection, the page's CPU profile, network and console on
another, the window's title (the boot's steps) read off the page.*

**Found.** From the character's click to the boot's last step took 12.2 s, and the main thread stood idle, waiting on
the account service, 7.5 s of it - every call one after the other, each answered in ~1 s or more:
1. the join (1.5 s) and the realm save (2.0 s) - the save needs the join's lease, and nothing of the world needs either;
2. then the realm's lines (0.8 s), then the account's roster (0.6 s) - neither needs the other, and their one reader,
   Project Legacy's host, is made long after (LEGACY7: before any save is restored);
3. then the data's read, and only after it WD3's ask for the homes' layouts - waited on 0.7 s at the first build;
4. then each town the boot builds waiting on its homes (HOME-LOOK, up to `HOME_LOOK_BUILD_WAIT_MS`): the start's
   (1.4 s idle) and, at the load's arrival, the realm save's own place (0.7 s idle).

**The fix.** The calls asked beside the work, nothing asked that was not asked before:
- the lines and the roster are asked at once at the join (`legacyRealmRead`) and read behind the boot; the boot waits
  for them where Project Legacy's host is made - still above the load door, so a death another device wrote stands
  before any save is restored;
- the homes' door (`homesApi`) and WD3's layouts ask (`bootHomeLayoutsAsk`) stand above the data's read, once
  `online` is settled (the realm's refusal and the Test Room's drop) - the first build's wait reads that ask;
- the towns the boot builds - its start and a realm save's own place (`locationKey` 'world') - are asked at once as
  soon as the start is known, as the save's character (`characterId`, the realm's id): `onlineHomes.ensure` takes a
  `character` for it, so the tenancies that ride the town's answer are the ones the arrival would have asked for (the
  start's was asked before as a character id minted on the unrestored entity, which rents nothing).

**Measured.** A live A/B: two local builds of the same main (f5a7f183d), one with this change, each launched fresh
and booted into the world with the same online character on the same machine, the same capture; times from the realm
save's GET (the join's answer - its own 2.03 s on both runs):

| | main | BOOT-OVERLAP |
|---|---|---|
| the lines, then the roster | 2.04 -> 3.48 s, awaited | asked at 2.04 beside the data's read, read behind it |
| the data's read begins | 3.54 s | 2.06 s |
| the first build begins | 5.97 s | 3.77 s |
| the main thread idle at the start's town | ~1.4 s | ~0.5 s (its map id is only known once the data is read) |
| the save's town at the load | ~0.7 s idle | none (heard by then) |
| **save GET -> the boot's last step** | **10.71 s** | **7.31 s** (−3.4 s) |

One run each; the account service's answers vary run to run (0.6 to 2 s a call), so the saving is read off the
timeline - the waits that went - as much as off the total. Left: the join and the save, 3.5 s of the service's own
(the server's ~1 s a call against a ~340 ms round trip - Server-Timing would say where), and the start's town.

Pins: `test/systems/online/bootoverlap.test.js` (3) - `ensure` asks as the character named, or the one playing; a town asked early is
the build's (one ask); the boot's wiring by source. Mutants: `tools/mutants/bootoverlap.json`, 7, all dead;
`housing.json`'s HOME-RENT-the-character-unsent re-aimed (killed by the new pins too); `home1`, `legacy7_online` and
`wd3_online`'s source pins moved with the code.

## For the owner

- **The A/B this branch owes**: on a machine with the data, `ARENA2_PATH=... node tools/frameProbe.mjs knight night`
  with `TREE=` the base, then this branch (`node tools/frameAb.mjs` reads the two) - the frame's own script time
  is what PERF-V8 moves, and a crowded town with yards is where PERF-YARD, PERF-INST and PERF-COL2 show.
- **The picture's levers** above (1, 4, 6b, 7) are yours - and 5's distance is the Other players card's now (PEER-RANGE): each trades a little of what is seen for frame time.
