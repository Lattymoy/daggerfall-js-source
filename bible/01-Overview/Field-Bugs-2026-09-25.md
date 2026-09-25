# FIELD BUGS 2026-09-25 — DISC25, seven from Discord and the dungeon map; PERF-SCALE, slow outdoors

Mac, with seven Discord screenshots: *"One of these screenshots mentions our
enhanced dungeon map and making comprehensive improvements to it"*.

1. *"hands on the enhanced map sprite go over the black bars in retro mode"*
   (kurkku: "1996 Fantasy ruined")
2. *"Guard the guild quest"* - "Can't be done online mobs never spawn for
   it" (Sir McMobdon); "They did for me, but I had to wait the entire
   duration of time that the quest mentions - fast forwarding by loitering
   isn't a possibility in online mode" (Malentor)
3. General chat, Sir McMobdon: "shows im in julianasos / But doesn't show on
   standings ... Assumed it was cause I wasn't apart of same guild I couldn't
   receive the quest / But I checked i am / In guild / Still cant get quest
   shared / And doesnt show in standings"
4. *"Cant send letters"* - "Game still takes input making u jump and move
   and close the letter if u hit f"
5. *"Stack Splitting"* (Satranath, crediting Starempire42) - "It doesn't
   appear possible to split stacks currently, either in inventory or in
   shops when making a purchase."
6. *"any chance for discord Game Activity/Rich Presence?"* (Starempire42)
7. Off-topic, on the dungeon map: tannim - "maybe a 2d map COULD work if you
   did the plane you are on + stairs going down and had the ability to press
   down to advance the plane displayed down a step (or up to go up) ... If no
   plane one step up, just show the ramp going up or down"; kurkku - "there's
   so many possible crossing paths in dungeons / clicking stairs to move up
   or down a level is good though"; tannim - "The cramped floors make it hard
   to see where anything is. I wonder if spreading the map out would help."

The pins are `test/disc25{a,b,d,e,f}*.test.js` (19), and the mutant set is
`tools/mutants/disc25.json` (64: 63 dead, 1 recorded equivalent). Twenty-one
older records the rewrite moved out from under (disc22g, disc23a, em2,
em34, retro1, auditretro1, survtiers3's cite) were re-aimed at the new text
for the same law and re-run: all dead but EM2-22, which was already
recorded equivalent.

---

## DISC25-A: the dungeon map, comprehensively (report 7)

**What a real dungeon showed.** The freeware data (tools/fetch-data.sh,
outside the tree) loaded through the real readers into the real sheet in
Chromium: Privateer's Hold derived THIRTEEN storeys. Daggerfall lays its
rooms on a 3.2 m grid and every step of it is a headroom apart
(`FLOOR_MIN_GAP` 3.0), so each "Floor" was a scatter of corridor ends - and
each corridor end was a WALL, because the stair that carried it on belonged
to the next storey and the plan's edge onto it was inked as rock. The strip
of thirteen ran down the paper's right edge and three rows sat under the
right gauntlet. The floor keys (PgUp/PgDn, the brackets) had been there since
EM3 and nothing on the paper said so. That is tannim's "cramped" and
kurkku's "crossing paths", on the map meant to answer them.

**A1 - a cell is on the storey its own surface is nearest.** `surfaceY`
reads a triangle's plane at the cell's centre (the corners' heights ride
`floorTriangles` now), and `floorOccupancy`'s `keep` sorts the cell by that
height. By centroid a long ramp - two great triangles - split along its
quad's diagonal and could skip a storey outright.

**A2 - the stairs are found.** `levelField` lays every walkable surface of
the level on the plan's grid once per level (packed by cell), and
`storeyLinks` records every meeting of two storeys' surfaces in the same or
the next cell within `STAIR_RISE` (two of the motor's `STEP_OFFSET` strides
and 0.2: a one-metre cell can step over a tread), from both sides, gathered
into one stair within `LINK_JOIN`. Privateer's Hold: 100 links, in 6 ms.

**A3 - storeys that never lie over one another share a sheet.** A FLOOR of
the map is a run of storeys, bottom first, none of which covers another past
`SHEET_OVERLAP` cells (`groupSheets`, greedy - the fewest sheets any
run-of-storeys cut makes, in the order a player climbs them). Two surfaces
in one cell within a stair's rise are the stair itself, not a stack. Real
counts: Privateer's Hold 13 -> 9, Castle Coppersley 14 -> 9, Wayrest 15 ->
11, the Crypts of Gharcen 8 -> 3, the Graves of Kingwing 7 -> 2, the Prison
of Tristynak 13 -> 6. Where the dungeon really stacks, it stays stacked.

**A4 - no wall across a stair.** splitEdges takes `pass`: an edge onto a
stair's far side on ANOTHER sheet is neither a wall nor an opening. Inside
one sheet both halves are floor and there is no edge at all.

**A5 - the stairs are drawn and taken.** Three treads across the way the
flight goes and a head pointing along it (`paintStairs`): onto another floor
in the wall's pen, named "up to Floor 3" / "down to Floor 1" (a name that
would land under a hand or on another name is left to the hover); inside a
floor in the soft pen, once, from its lower end, pointing up it. A press on
one onto another floor turns the page (kurkku), the view left where it is so
the stair's other end is under the pointer. North is up the paper.

**A6 - the strip.** It stops above the right thumb, with a chevron row at the
end that has hidden floors (pressing it takes the next one); it marks the
floor you stand on (a caret after the word), the floor the way out is on (a
ring), and writes faint the floors nothing has been revealed on.

**A7 - the keys are said.** The sheet contract grows an optional `hint`
(beside `breathes`): the window's foot says "drag to pan · scroll to zoom ·
PgUp/PgDn floors · click a stair to take it · Esc to close" while the dungeon
is up, and the bay's line otherwise (`MAP_HINT`). The arrows still pan -
EM3's decision, kept.

**A8 - the hands are the thumbs.** `_handRects` reads the blob
`keyThumbPixels` kept (`thumbBox`) where the key has run, not the generous
zone it searched - the zone started well above the thumb and left the strip
three rows. Every sheet's words are kept out of the same, truer, rectangles.

**A9 - a note on a split level** is pinned at the storey whose revealed
surface is under the pointer, so it lands on the floor it was written on.

**Not done, and why.** tannim's "spreading the map out" is the 3D map's
cramp; the sheets are the 2D answer. A faint ghost of the floor below was
considered and left out: the stair marks say where the floors meet without
drawing two plans on one paper. What only Mac's eyes can settle is the
glyph's look on a real screen.

## DISC25-B: the held map inside the pillarbox (report 1)

DFU lays every window out in `DaggerfallUI.CustomScreenRect` while the retro
pillarbox is up - `new Rect(pillarWidth, 0, Screen.width - pillarWidth * 2,
Screen.height)` (ViewportChanger.cs:139-140). RETRO1 recorded that the port's
2D layer keeps the whole canvas, and the held map is a whole-window DOM root:
at 1920x1080 in 4:3 its painting ran from x 95 to 1825 over a pillarbox of
240 to 1680, and its top row and hint line sat on the bars. `retroScreenRect`
is CustomScreenRect, cut from the world rect's own pillar (`retroPillarWidth`,
one home for SetRetroAspectViewport's arithmetic); `_layout` insets the root
to it in the painted lane, so the painting, its ink, its thumbs, the top row
and the foot all fit the retro screen. The Morrowind arm's lane keeps the
canvas (AUDIT RETRO1 C2). Retro-Mode.md's departure and Ledger A's RETRO1 row
are NARROWED, not struck: the rest of the 2D layer still takes the canvas.

## DISC25-C: Guard the Guild online (report 2) - Mac's call

It is not a spawn bug. N0B10Y03 is a Mages Guild quest whose thieves come
`daily from 00:00 to 03:00` while the player is in the guild hall. Online the
world clock is real time at twelve to one - a game day is two real hours - and
the in-game window is fifteen real minutes out of every two hours. The foes do
spawn in it (Malentor). What the report asks for is the fast-forward:
offline the player loiters to midnight; online a loiter paces the window's
own timer and moves no world time, which RESTX2 decided ("online, sleeping
is no longer a way to skip to tomorrow"). Letting an online loiter advance
the player's OWN quest time is possible (MAC-LVL1 already credits a rest's
minutes to the skill clock), but the quest's "midnight" would stop matching
the shared sky - so it waits on Mac. Eighteen quests use `daily from`.

What shipped: the Online pane said "the quest clocks stand still", false
since WORLD7 (quest clocks charge played time online). It says what the
shared clock does to an hour-gated quest instead.

## DISC25-D: a guild refusal names the guild (report 3)

The player is a Temple of Julianos member; "Guard the Guild" is the Mages
Guild's. QUEST1's gate refused them rightly and said only "not a member of
the guild this quest requires" - no use to someone who IS in a guild. The
gate carries the guild now (`guild: 'MagesGuild'`) and `shareRefusalText`
says "are not a member of the Mages Guild, which this quest requires."

**Not reproduced: "doesn't show on standings".** The Standing page's Guilds
block (GUILD-REP) lists every membership through `affiliations`, temples and
orders included - a Julianos member reads "Julianos, Novice". The Reputation
block above it lists the five social groups and never a guild. The one path
that hides a membership everywhere is the vampire book swap. A screenshot of
the page, or the save, would settle it. **Recorded, not fixed:** the share
gate never checks temple or knightly-order quests at all (a non-member
receives them), and checks no rank (`minReq`) for anyone - tightening it
changes who can receive what, which is a rule, not a bug fix.

## DISC25-E: a letter's keys are the letter's (report 4)

MAIL1's letter is written in the SOC3 social panel - real DOM fields in a
panel that is not a window in any host's slot. No overlay gate stood between
a letter and world.js's key ladder: every key joined the ring (W walked,
space jumped), and F is `SocialInteract`, which toggled the panel shut. The
panel stops its own fields' keys on its root now (the chat's rule; F5 and
F11 swallowed first, since the host that swallows them will not see them),
and world.js and exterior.js carry dungeon.js's KB1 typed-field gate, below
the browser swallow and above the ring. The four hosts: the interior host
routes through `routeKey`'s gate; the dungeon context has no keydown of its
own.

## DISC25-F: stacks split everywhere (report 5, credit Starempire42)

DFU splits in TransferItem (DaggerfallInventoryWindow.cs:1515-1539): a stack
short of its planned amount, or any stack under Control, pushes "Pick how
many items (max N)?" and only its answer moves (:1546-1559); the trade window
INHERITS it (DaggerfallTradeWindow.cs:31 - buying :842, selling :795, taking
back :803). The port had it on the classic pack alone (CM5). The law's one
home is `systems/itemTransfer.js` now (`HOW_MANY_ITEMS`, `SPLIT_INPUT_MAX`,
`parseSplitAmount` - int.TryParse's reading, so "3x" and "1e1" are no count -
and `splitRequired`). The classic counter pushes CM5's box, modal, for all
three arms. The enhanced pack's card and the enhanced counter's strip carry
the question as a field beside the button that moves the stack
(`ui/howManyField.js`, one constructor), seeded with the most that would
move, so pressing it unread is the popup's Return; a count the parse refuses
moves nothing and says the popup's question.

## DISC25-G: Discord Rich Presence (report 6) - not built

A browser page cannot reach the Discord client. The desktop app can, over
Discord's local IPC socket, but Rich Presence needs a Discord application
(its client id and its art keys) registered on Discord's developer portal -
Mac's to create. Nothing is shipped with a placeholder id.

---

# PERF-SCALE — slow outdoors on a good GPU, and a counter that could not say why (2026-09-25)

**Report** (two players, relayed by Mac): "One user is reporting fps issues
in the exterior but fine in the interior ... GPU is NVIDIA GeForce RTX 4060
Ti", and a second, "me too my friend.. don't know why. I got a RX6600".
Mac: "It has nothing to do with our updates" - it is not new: FPS1
(2026-09-11) had already heard "the outside still has optimization
issues".

**Cause.** Not the cards. The world rendered at the window's full CSS size
(`Renderer.beginFrame` - `clientWidth` x `clientHeight`) with no cap and no
render-scale setting, so a player on a 1440p, 4K or ultrawide window, with
DSR/VSR, or with the browser zoomed below 100% paid two to four times a
1080p player's per-pixel exterior work (the sky's march, the air's
passes, the lit ground under the whole screen). And the browser may run
WebGL on the wrong adapter (an integrated GPU, a software rasterizer):
nothing in the game showed which GPU it drew on, and the FPS counter
showed neither the GPU nor the render size.

**Fix.** A RENDER SCALE - the Features home's Sight row "Render scale",
100% (the default: nothing changes, the frame is today's call for call),
85%, 75%, 67%, 50%, the player's own online, live on the next frame. Below
100% the world (every 3D pass, on either lane) draws into an image of the
world rect x the scale and is presented LINEAR to the full rect; the HUD,
the menus and the first-person overlay stay at the canvas's resolution.
It is RETRO1's image path generalised - one home for a world drawn
smaller and shown - and Retro Picture Mode wins over it. And the FPS
counter names the GPU the browser actually uses (read once, when the
renderer is made) and the frame's size (world image, canvas,
`devicePixelRatio`, scale), on screen while it is on and on
`window.__fpsStats` for a probe. `07-Rendering/Rendering.md` PERF-SCALE has
the law; Ledger A row PERF-SCALE.

**What to tell the players.** Turn on the FPS counter (Enhanced pane) and
send a screenshot: the `gpu` line says whether the browser is on the
card, and the size line says how many pixels the world costs. If the
world is large, Features > Sight > Render scale at 75% is roughly half the
per-pixel work; 50% a quarter.

**Pins.** `test/perfscale.test.js` (8), every one failing on the base;
`test/features.test.js` (the row list and the notes' budget),
`test/ft8_combatvisuals.test.js` (the Enhanced count),
`test/mwarms_fps.test.js` (main.js's mount). Mutants
`tools/mutants/perfscale.json` (29 dead); `retro1.json` and
`auditretro1.json` re-aimed.

## AUDIT PERF-SCALE (the review)

Seven findings from the adversarial read; each was reproduced in node on
the real Renderer and the fake GL before it was changed.

- **R1: 100% after 75% kept the memory.** The world frame that went back
  to no image freed only retro's LUT; the image, its depth and the lane's
  image-sized frame stayed for the session (on a 4K canvas at 75%, 36 MiB
  classic, 89 MiB under the lane). That frame frees them now, after the
  owed present (`Renderer._dropWorldImage`), and retro off does the same.
  The lane's canvas-sized frame is kept: menus, maps and videos draw into
  it.
- **R2: a stored "0.750" ran at 75% under a tile showing 100%.**
  `renderScaleOf` matched a tier by its number; the Features tile matches
  by its string. It matches by the string now, so the two can't disagree.
- **R3, recorded and not changed: below 100% the glow spreads wider.** The
  bloom's blur and the bolts' minimum width are sized in the image's
  pixels, so 50% of a canvas looks like a half-size window stretched. That
  is how the renderer already treats window size: a 1080p window's glow is
  twice as wide on screen as a 4K one's. Sizing the kernels in canvas
  pixels would leave gaps between a quarter-size bloom's taps and put a
  bolt under one image pixel. `07-Rendering/Rendering.md` PERF-SCALE says
  so.
- **R4, R5: the counter's details were unpinned.** No pin covered
  frameInfo's host-rect arm (the docked strip at 100%), the probe's `retro`,
  "gpu unknown" or the dpr's rounding. All four are pinned now.
- **R6: two readings of "the scale is on."** The warm built the present
  for a source answering 0, which the frame refused. Both ask
  `Renderer._scaleOn` now. The comments name one home for the law,
  `_retroBegin`.
- **R7: a paraphrase in quotation marks.** The comment and the bible quote
  the report as written.

Pins: `test/perfscale.test.js` 10 (S5's string rule and both S7 pins fail
with `src/` at the slice's commit; the counter and frameInfo pins guard
code that commit already had). Mutants: `perfscale.json` 43 dead;
`auditretro1.json`'s D5 re-aimed.

# PERF-EXT — the same report, answered in code (2026-09-25)

**Report** (the same two players): "fps issues in the exterior but fine
in the interior", "me too my friend.. don't know why. I got a RX6600".
Mac, after PERF-SCALE: "Why are you so avoidant when it comes to
addressing performance issues? I am not getting another player to do the
work that youre suppose to do".

**What changed.** The exterior's own cost, found by hunters on a harness
(the real renderer and shadow pass over a counting GL, driven by
`world.js`'s frame walk on a synthetic town) and re-measured by provers
told to disprove each win. The flats and the frame's CPU:

- **PERF-EXT10** - every flat batch is born with every field it will
  carry, so the world's flats share ONE hidden class instead of 3-15; the
  per-flat loops stop paying polymorphic lookups. Render-side JS on the
  harness 1.62 -> 1.20 ms a frame by day, 2.28 -> 1.41 at night (node,
  relative; the picture cannot change - no computed value does).
- **PERF-EXT11** - a flat's size and origin are uploaded when they
  change, in the flats pass and in every shadow replay: 6,243 -> 5,279
  GL calls a frame by day and 4,992 -> 4,265 at night on the harness,
  every draw seeing the same values.
- **PERF-EXT12** - the far-flat rule is asked with three numbers, not
  an object for every flat batch of every pixel every frame: about
  70 KB less young garbage a frame (1,299 -> 1,074 scavenges over
  3,065 harness frames with a 1 MB young space).
- **PERF-EXT13** - every visible pixel's water in one call: the frame's
  water block goes up once, not once a water pixel - 34 pixels 2,421 ->
  308 GL calls on the real renderer, every draw's state identical to
  the base's (a coastal or lakeside view is where it pays).

`07-Rendering/Performance-Exterior.md` has the measurements, the pins
and the mutants. Not seen on a GPU - there is no game data in the
container.

## AUDIT PERF-EXT10-13 (the review)

One finding from the adversarial read of the flats and the frame's CPU,
reproduced in node on the real Renderer and ShadowPass before it was
changed.

- **R1: the one shape made the shadow record allocate.** PERF-EXT10
  minted the shadow record's origin, `_shOx`/`_shOy`/`_shOz`, as
  undefined with the other twenty. V8 keeps a field in the
  representation of the first value it holds, and undefined is not a
  number, so the three were tagged slots, and every fractional origin
  `recordBillboards` stored - every batch, every frame - was a new heap
  number: about 120 KB of young garbage a frame over 3,000 flats, which
  the base (its fields born with their first double) never made. On the
  producer-mix harness it gave back most of what the one shape had saved
  in scavenges. The triple is born NaN now, a double slot written in
  place; nothing reads it before `_shSeen`, so no value changes and the
  picture cannot. Producer mix, scavenges with a 1 MB young space over
  3,000 frames (two runs' mean), the first cut -> now: 1,298 -> 1,210 by
  day, 1,244 -> 1,172 at night (the base's 1,297 and 1,304).

Pins: `test/perfextb.test.js` 11 (the new one weighs the record against
a control and fails with `src/` at `1d05f5374`). Mutants:
`perfextb.json` 36 - 35 dead, 1 recorded equivalent; its 5 re-aimed.

## PERF-EXT1-5 - the shadows

The Enhanced Lighting shadow pass, the sun's cascades and the lanterns'
cube maps (`07-Rendering/Performance-Exterior.md`, THE SHADOWS):

- **PERF-EXT1** - a pixel-wide flat batch (a wood, a climate's flora
  record) reaches a shadow by its PLACEMENTS, not its 400-unit sphere: a
  lantern is no longer held on the sway's beat by trees none of which
  stand in its reach, and the near cascades skip a wood with no tree in
  them. Shadow draws a frame on the harness town 297 -> 10 at night,
  568 -> 193 at dusk, 271 -> 183 by day (at real density 616 -> 5,
  983 -> 201, 373 -> 198), every quad of every skipped batch proven
  beyond a clip plane (67.8 million of them). What moves: a walker
  leaving a lantern's reach loses its shadow the next frame, as it does
  in calm weather, not at the sway's next beat.
- **PERF-EXT2** - a static batch's sub-meshes whose index ranges meet
  are one depth draw: a pixel's merged block models were one draw per
  texture in every cascade and every lantern face (40 in the harness's
  city pixel). With PERF-EXT1, shadow draws a frame on the harness town
  297 -> 8 at night, 568 -> 81 at dusk, 271 -> 73 by day (the night's
  worst frame, a cache rebuild, 934 -> 36). The same triangles.
- **PERF-EXT3** - every lantern's static signature (SC1's "is this
  cache still good") in ONE walk of the frame's records, not one walk a
  lantern: eight lanterns at night were eight walks a frame whether or
  not anything changed. The pass's part of the harness town's night
  frame 0.48 -> 0.35 ms; the walks alone over 1,000 flat batches 0.25
  -> 0.09 ms. The same caches, drawn on the same frames.
- **PERF-EXT4** - a recorded mesh's matrix scale is taken once, not
  once for its sphere and again for every sub-mesh's: about 1,200-1,450
  fewer `Math.hypot` a frame on the harness town, 0.04-0.05 ms. The same
  spheres, bit for bit.
- **PERF-EXT5** - the sun shadow's soft kernel (every tree by day, and
  the near ground) is four hardware taps instead of nine: the same
  texels with the same weights, five fetches a pixel fewer. What moves:
  the card's own rounding of each tap's position, under one 255th of the
  sun's light in a penumbra - 2 pixels of 518,400 by one step on the
  software rasteriser.

The five together, on the real game (headless Chromium, SwiftShader,
Daggerfall city, a copy of ARENA2 in the session's scratch): at noon
6,598 -> 4,091 GL calls and 1,338 -> 794 draws a frame, the lanterns'
279 face draws to none; at 22:00 13,011 -> 3,627 calls and 2,298 -> 634
draws, the lanterns' 1,712 face draws to 12; the shadow pass's main
thread 2.51 -> 1.97 ms at noon and 2.66 -> 1.96 at night (relative).
Not seen on the players' cards.

## AUDIT PERF-EXT1-5 (the review)

Three findings from the adversarial read of the shadows, each
reproduced in node on the real Renderer and ShadowPass before it was
changed (`07-Rendering/Performance-Exterior.md`, THE REVIEW OF THE
SHADOWS).

- **R1: PERF-EXT1 made the shadow pass dearer in buildings** - the half
  of "fps issues in the exterior but fine in the interior" that was
  fine. DISC15's lo tier asks every lamp's static signature every frame
  (a still room never spends its rebuild budget), and each ask ran
  PERF-EXT1's cube query for every multi-flat batch its sphere touched:
  `beginFrame` in a 40-lamp room 0.193 -> 0.466 ms a frame. A room its
  host draws whole now folds batches by their spheres in both walks, as
  before - never a stale map, at worst a rebuild within the budget - and
  the streets keep their quads: 0.200 ms. The quad's half-diagonal is
  taken once a size, not at every ask (the harnesses' pass JS at real
  density by day 0.139 -> 0.114 ms, the base's 0.12). The same draws
  and the same VERIFY totals outdoors.
- **R2: two margins of the quad's bound had no pin** - the float pad
  and the lean by |h| (an upside-down flame's sign). Both pinned.
- **R3: the flat's lift and half-diagonal had grown copies** - one home
  each now (`batchLift`, `quadHalfDiagonal`), the same bits.

Pins: `test/perfexta.test.js` 20 (four new; the room's, the
half-diagonal's and the one home's fail on the first cut `dfe366f2c`,
all four on the base `1d05f5374`). Mutants: `perfexta.json` 54 - 13 new,
all dead; 13 records re-aimed across perfexta, ghost1, blood1 and el5.

---

# PERF-EXT, cluster C — the frames that freeze around a crossing (2026-09-25)

**Report** (the same two players): "fps issues in the exterior but fine in
the interior", "me too my friend.. don't know why. I got a RX6600". And
Mac, after PERF-SCALE: "Why are you so avoidant when it comes to
addressing performance issues? I am not getting another player to do the
work that youre suppose to do".

**Cause, this cluster's share.** The streaming world's work is paid on the
frames around a map-pixel crossing and on the road into a town, and none
of it shows in `?perf=cpu`, which measures the steady frame. An interior
streams nothing, which is the "fine in the interior" half.

**Fixes** (each proven by a find-and-prove pass before it was written,
and re-measured on the change; `07-Rendering/Performance-Exterior.md`
cluster C has the numbers and the laws):

- **PERF-EXT20** - the grass field's slot count (an 11-33 ms sweep, paid
  by every field built - every crossing, teleport and load) is swept once
  and warmed at mount.
- **PERF-EXT21** - the grass field survives the floating-origin shift.
  Every map-pixel crossing threw it away and regrew it: the grass
  vanished (2 slots of 357 drawn on the crossing frame), regrew
  nearest-first over ~3 s at +5-7.5 ms a frame and came back reshuffled.
  The field has an origin of its own now and follows the scene's in
  place (0.2-0.3 ms, no upload); every stale-cell heal the rebuild gave
  by accident is said on purpose (every publish, every promotion), and a
  teleport or a load - which never emptied the field - does.
- **PERF-EXT22** - a walk places its grass rim a slice a frame. A cell
  arriving at the 300 m rim was placed whole on the frame it arrived, a
  4-8 ms spike on 5-17% of frames while moving; it is placed 1,500
  candidates a frame now, byte for byte the same cell (walking p99 4.4-6.6
  ms -> 1.4-1.8 ms). A boot or a teleport still fills whole cells at the
  old pace.
- **PERF-EXT23** - a pixel's publish tail breathes. After its last
  model, a town or city pixel merged its static batch and measured its
  spheres in one piece - 39-66 ms of one frame on a synthetic city, 8-22
  ms on a town. The merge yields between models, sphere ranges and
  texture groups now (no unit over ~0.3 ms warm) and hands createMesh the
  spheres, byte for byte the same.
- **PERF-EXT24** - the stream's build slice is what the frame left. A
  flat 6 ms slice sat on top of the frame in the same rendering
  opportunity, so every streaming frame over ~8.7 ms of script missed
  vsync (12 ms of script ran at 55 fps while a pixel built, 18 ms at 41);
  it lends the frame interval less the frame's script less 2.5 ms now,
  3-6 ms (60 and 47 fps), and the counter and `?perf=cpu` see the stream
  for the first time. The trade-off, for Mac: a heavy frame builds at up
  to half pace for at most two seconds, so the far ring's notch over a
  pixel still building stays open longer in clear weather.
- **PERF-EXT25** - a collider cell's key is a number. The collider
  minted a string per cell a streamed triangle covered and per cell a
  query read; the key is one exact multiply-add now, and the insert of a
  synthetic city pixel's 300,000 triangles fell from ~1.07 s to ~0.76 s
  of main thread (-27-30%), every answer the same bits.
- **PERF-EXT26** - the five terrain promotions every crossing makes are
  built on the terrain worker. They were ~1.8 ms of grid a frame for five
  frames on the main thread; now the post and the reply's water are ~0.15
  ms each, the grid the same bytes, and the one-a-frame queue is the
  fallback when no worker runs.

**Records.** `07-Rendering/Performance-Exterior.md` cluster C. Pins:
`test/grassshift.test.js`, `test/publishtail.test.js`,
`test/buildslice.test.js`, `test/colliderkeys.test.js`,
`test/restrideworker.test.js`, every new pin failing on the tree before
its slice (one test in `colliderkeys` is a guard that holds on both by
design, and says so). Mutants: `tools/mutants/perfextc.json`, 103, all
dead.

## The review of cluster C (2026-09-25)

An adversarial review of the cluster found five things, all real. The
one that mattered: **PERF-EXT24 lent waits to the counter as if they
were the build's work.** A streamed pixel's first slice began inside
the pump's frame and ran on across the terrain worker's round trip, and
that whole interval was lent - so on every streamed pixel the FPS
counter's script ms, the probe's scriptMs and `?perf=cpu`'s `build` read
high (the reviewer's repro: a 1 ms breath lent as 38 ms, worst frame 48
for frames of 10). The breather lends only a slice its own resume began
and no frame ran inside now; the stream's pace and its steady lend are
unchanged (headless Chromium, 9-18 ms frames: the same fps and ms built
as the cluster's tip). Also: a teleport's build now always gets the
whole slice (it had been sized for the stream beside it), a set the grass
change had left write-only is retired, a guard test is labelled as one,
and the slices are renumbered PERF-EXT20-26 into the pass's one sequence
(the commits say PERF-EXT-C1-C7). `07-Rendering/Performance-Exterior.md`,
"The review of cluster C", has the numbers and the pins.

---

# PERF-EXT, cluster D — the shaders stop computing what they multiply by nothing (2026-09-25)

**Report** (the same two players): "fps issues in the exterior but fine in
the interior", "me too my friend.. don't know why. I got a RX6600". And
Mac, after PERF-SCALE: "Why are you so avoidant when it comes to
addressing performance issues? I am not getting another player to do the
work that youre suppose to do".

**Cause, this cluster's share.** Per-pixel work the exterior's shaders
computed and then weighed at 0. An interior draws no sky, which is part
of the "fine in the interior" half. These are fill-rate savings - tens of
microseconds a frame on those cards at 1080p, two to four times that at
1440p or 4K - and not the CPU-bound frame PERF-TOWN1 measured; each is
exact, measured on the real modules with 0 bytes different.

**Fixes** (each proven by a find-and-prove pass before it was written,
and re-measured on the change; `07-Rendering/Performance-Exterior.md`
cluster D has the numbers and the laws):

- **PERF-EXT30** - the sky stops drawing the clouds it has been told to
  hide. Under the volumetric clouds (the default) Dynamic Skies, the
  default sky, blended its two cloud sheets at opacity 0 and the port's
  dome ran its two noise decks at cover 0 - eight taps and the normals'
  arithmetic, or forty hashes, per sky pixel, for nothing. Each is
  skipped when its weight is 0: the default sky's pass 6-9% faster on
  SwiftShader, the dome's 11-16%, no pixel changed.
- **PERF-EXT31** - the air pass's resolve stops reading images that were
  not drawn. The lanterns' glow is black on every day outside and the
  sun's shafts on every night, and the resolve read and decoded them on
  every pixel to add 0. The resolve and the bright pass are built with
  each read and without it, and the frame takes the pair for what it
  drew: the resolve 16-24% faster on SwiftShader by day, 8% at night with
  lanterns, the bright pass 40%, no pixel changed, no GL call added.
