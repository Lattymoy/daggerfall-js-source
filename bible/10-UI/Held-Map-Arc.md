# The Held Map - the enhanced map, replaced

Opened 2026-09-18 (MAP0). Mac: *"This is a huge departure. A complete
replacement of the current enhanced map. Using the sprite above, players
should be able to open the map showing on the sprite itself in a hand
drawn format, with roads and all. The player should be able to scale
around, zoom in and out, and select their destination. Note: Morrowind
will need its own handcrafted map with hand placement just like the
sprite. Our first custom rig change. This'll be the new way to
experience the map of daggerfall in enhanced format."*

## The four decisions, taken 2026-09-18

1. **The sprite is Mac's own.** `public/art/held-map.png` (1448x1086):
   two gauntleted hands holding a blank parchment. It carries no ARENA2
   pixel, so it ships in the repo under an OURS row in the doctrine
   allow-list. It is the ONLY picture this map ships.
2. **One page.** The whole Iliac Bay on one sheet, zoomed into, with
   the region borders drawn on it - not the classic picker-and-pages.
3. **Replacement.** This retires the enhanced lane's 3D relief map
   (`ui/overworldMap.js`, the flight, the chip row) whole. The classic
   window is untouched: it is DFU's, and Travel Options' classic
   additions stay on it.
4. **The Morrowind rig holds it.** A held pose for the first-person
   arms with a paper mesh whose texture is the same rendered map - its
   own slice, after the map exists, and the port's first custom rig
   change.

## What the map IS

**The paper is the sprite; the map is drawn onto it at runtime.** Nothing
of the Iliac Bay is a painted asset: the coastline comes off WOODS.WLD's
heights, the province borders off the politic bytes, the roads and
tracks off Hazelnut's vendored arrays (the port's own generated network
is never drawn here - `03-World/Roads.md`, and the `source` field TO1
put on the network object is what tells them apart), the locations off
MAPS.BSA with the discovery store deciding which are inked, and the names
in a hand-lettered face. It is rendered in an INK style - lines, hatching
for relief, stippled coast - into an offscreen canvas that is uploaded as
the paper's texture, re-rendered only when the discovery set, the mark,
the filters or the zoom band change. That keeps it correct whenever data
changes, and it keeps the doctrine: a render of the port's own reading of
the data is ours; a painting of the bay would be a redistribution question
every time it was touched.

**Pan and zoom** move a window over that sheet, clamped to the paper's
inner edge so the map never leaves the parchment. Zoom bands change what
is inked: far out, cities and the coast; closer, every discovered place
and the tracks; closest, the five-texel path picture TO1 already draws
for the classic region page, so a road reads as a line and a junction as
a star. The hands and the paper do not move; the map does.

**Selection** is a click on a mark. The card the enhanced map has today
(destination, the three toggles, the bill, Begin) stays as the one card,
drawn beside the paper in the enhanced skin's own face; its laws are the
pure functions TO1's audit extracted (`isPlayerControlledTravel`,
`enforceShipRestriction`, `shipTravelRefusal`), so a walked trip, the
ports restriction and the teleport fee behave as they do on the classic
window (the fee is asked with the pick rather than at open - AUDIT-MAP
D3, recorded below).

## What Travel Options gains on it

Everything the mod adds to the classic map lands here as ink: the ports
filter (a harbour glyph shown or hidden), the middle-click mark (a ring
in `MarkLocationColor`), the I key's building list (a box over the
paper), the coordinates click on a bare pixel (the mod's own journey to
a place with no name), the H help, and the resume prompt. The junction
mini-map stays what it is - a HUD disc - and reads the same ink.

## The slices

- **MAP1 - the held parchment window.** The sprite as the window, the
  ink renderer over MAPS/WOODS/politic/roads, pan, zoom bands, the
  discovery law, the name face, the click-to-select and the one card
  wired through the pure laws. `ui/overworldMap.js` retired with its
  flight and chip row; `ui/travelMapDoor.js` opens this on the enhanced
  skin. Pins: the ink renderer as a pure function over a table of
  fixtures (a coast, a border, a road, a junction, a discovered and an
  undiscovered town), the clamp, the zoom bands, the selection.
- **MAP2 - the mod's additions on it.** Ports filter, mark, I, H, the
  coordinates click, the resume prompt and the teleport fee - each
  through the same functions the classic window calls, so the two never
  drift. The junction disc reads the ink renderer's road picture.
- **MAP3 - the Morrowind held pose.** A held-item pose for the
  first-person arms (`combat/heldPose.js` over `combat/fpArm.js`), a
  paper piece on the rig, the ink sheet laid over the piece's projected
  corners (`ui/quadMap.js`) rather than baked into a texture, and the
  sprite lane kept for the classic body. The first custom rig change;
  SHIPPED 2026-09-18, below.

## Doctrine, said once

The sprite is Mac's, the map is computed, the names are the game's own
strings drawn in a face the port ships. No ARENA2 raster enters the
repo through this arc, and the pin that holds the allow-list holds it.

## MAP1 - the held parchment window (SHIPPED 2026-09-18)

`src/ui/heldMap.js` (the window) and `src/ui/inkMap.js` (the ink);
`src/ui/travelMapDoor.js` opens the window on the enhanced skin.
RETIRED: `src/ui/overworldMap.js` and `src/render/overworldRenderer.js`;
RETIRED with them: `tools/overworldProbe.mjs` and `test/overworldmap.test.js`.
`src/ui/overworldModel.js` stays, because its water, marker, trace and
chain laws are the ink's own.

**The window.** The sprite fills a 4:3 stage letterboxed into the
viewport (its own black is the letterbox); the ink canvas lies on
`PAPER` (x 12.3%-87.0%, y 13.8%-75.5% of the sprite, measured off the
painting); the thumbs, which rest ON the sheet, are keyed back over the
ink at load from two `THUMB_ZONES` by a luminance cut (`HAND_LUM` 144:
the sheet's pixels measure 144-192, the gauntlets almost wholly under).
Drag pans, the wheel zooms toward the cursor, arrows and +/- do the same
from the keyboard, and `clampView` keeps the map on the paper: contain at
rest with the bay centred, pan bounded by the map's edge meeting the
paper's, `SCALE_MAX` 14 (contain wins over the ceiling on a bay smaller
than the sheet). The sheet rises over 0.3 s and lowers over 0.3 s; a
commit fires its hook at the bottom of the lower, with the window alive,
then closes. No flight: the host's own travel - DFU's, or the mod's
walked trip - IS the journey. The card is the relief map's, class for
class (`hm*`), over the same laws; the chip row is gone (the store's
flags still decide what is inked, and the classic window's chips still
set them). The party is ink: a ring and the name, stacked on a shared
pixel by `PARTY_LABEL_STACK`, the hover line naming every member on it,
the legend in the foot row. The probe surface is `globalThis.__heldMap`.

**The ink.** `buildInkModel` is pure: the coast as the land set's
boundary along pixel edges (`boundarySegments` + `linkSegments`, then
simplify and one Chaikin pass); the borders as edges between two LAND
pixels of different regions (a shore is the coast's, a nameless byte
bounds nothing); the roads and tracks through `traceChains` ONLY when the
network says `source: 'basic-roads'`; the high ground as carets thinned
by band; the province names at each region's land centroid; the marks
through `buildMarkerModel` (discovery and buckets are the classic
window's, never re-read here) with the game's own name on each.
`paintInk` takes the context and draws in paper pixels: the shore as a
wash under the pen, borders dashed, tracks dotted and never at the far
band, glyphs by kind, names placed by `placeNames` (greedy in
`NAME_RANK`, an overlap dropped rather than drawn over, the display face
`'Cormorant', Georgia, serif`), the player's mark, the selection's gold
ring, the party in the party green. The zoom bands: far (< 2.4 paper px
per map px) inks the coast, borders, roads and cities with the region
names; mid (< 5.5) adds towns, temples, dungeons and the tracks; near
adds everything the discovery store admits, named. Chains are cached on
the height bytes and the network reference; the marks alone rebuild when
a filter or a discovery moves; the paint runs from tick, only when
something changed, and only where a real 2D context exists.

**Departures recorded.** The flight, the cloud veil and the chip row
(above); the province pages and the region picker have no meaning on one
sheet; the enhanced map is DOM and a 2D canvas, so the renderer's
foreign-pass count fell by one (four passes now).

## MAP2 - Travel Options on the sheet (SHIPPED 2026-09-18)

Every addition the mod makes to the classic map lands on the held map
through the SAME function the classic window calls
(`src/ui/travelMapOptions.js`, `src/systems/travelPorts.js`), so the two
skins cannot drift:

- **The ports filter.** `portsFilterAllows` over `hasPort`, asked
  BEFORE DFU's own discovery test by the marks, the find box and the
  journal's click-through alike; a harbour glyph (an anchor) beside
  every port's mark at the mid and near bands while the mod restricts
  ship travel to ports; a Ports button in the foot row shown under the
  same condition, and P as its key (the sheet's own spelling). Per-open,
  as the classic one is (departure 6).
- **The mark.** The middle click marks the place under the cursor and a
  second clears it, through `travelMapMarkedMapId` in the shared store
  (AUDIT-TO1 G4), inked as a ring in `MarkLocationColor` at EVERY band -
  the mark is the thing the player put there to steer by, so it shows
  even where the band hides the place.
- **I and H.** `locationInfoRows` in a box over the sheet - the title,
  the guild halls named, the shops counted by type in two columns, or the
  mod's "no knowledge" sentence - and the host's help rows in the same
  box. Any key or any click closes it and does nothing else that press.
- **The coordinates click.** A bare pixel is a destination when the mod
  allows it, the host can honour it (never online) and the visit is not a
  teleport (a DEPARTURE: the C# and the classic window open the walking
  popup from the guild's teleport map too - AUDIT-MAP U1); a cross where
  no mark is; the decision opens itself with the
  popup's own walked estimate and no fare; Begin skips the gold gate and
  hands `onTravelToCoords` the coordinates popup's own `{pixel, name}`
  with `playerControlled: true`.
- **The walked estimate.** When the mod's fork says the player drives the
  trip to a place (`isPlayerControlledTravel`), the card bills what the
  popup's UpdateLabels bills - hours and minutes from the classic
  estimate with the taken-over settings inverted, divided by twice the
  speed multiplier, and the mod's words in the cost row - and the gold
  gate is skipped for it.
- **The resume prompt.** On the first tick with a destination pending,
  the mod's own sentence with Yes/No: Yes resumes and lowers the sheet,
  No pops the box alone and leaves the player on the map (AUDIT-TO1 G3);
  opened during a journey, the sheet centres on the player instead.

**Departure from the MAP0 page, recorded.** MAP0 said the junction disc
would read the ink renderer's road picture. It does not: the disc is
Travel Options' own five-texel DrawMapSection (`src/ui/travelJunctionMap.js`),
carried 1:1 in both lanes, and a second drawing of the same roads through
the ink would be a departure from the mod for no gain. The disc reads the
same MARK the sheet inks (the shared store), which is the tie that
matters.

## Pins

`test/heldmap.test.js` (47; the seven MAP2 pins drive a fake mod's
settings through the window: the ports law over a REAL port id from the
mod's list, the harbour glyph by band and condition, the mark through the
store and its ring at far, the I box and its two closers, the H rows and
the host fallback, the coordinates click's three refusals and its
hand-off, the walked estimate verbatim against the popup's arithmetic,
the resume prompt's Yes and No and the active-journey aim). Mutants:
`tools/mutants/map2.json`, 29 dead, 1 equivalent as recorded.

MAP1's pins: U61's carried laws (the walk, the height
and water laws, the buckets, the door both ways, the one construction
seam, the window's panel laws through a stub document, the source
sweeps) and the slice's own - the coast fixture (a 2x2 island: eight edges,
one closed loop, integer corners; ocean climate is sea at any byte; a
corner pixel closes), the border fixture (2|3 on both rows, 5|6 on one;
none on the shore, none against a nameless byte; the centroids over land
alone), the road fixture (a T junction into three chains, endpoints on
pixel centres; the generated network never inked), the discovered and
undiscovered town, the fourteen glyph kinds, the band thresholds and
tables with the painter honouring them, the clamp (contain, centre,
edge, ceiling, contain over ceiling), zoom about a point, the name
placement in rank order, the paint's order and flags, the selection
(16 px, bare paper clears, a hidden band cannot be picked, the hover
line), pan/wheel/keys under the clamp, the search's glide, the layout
on PAPER of a 4:3 stage, the sprite's doctrine row and the hand key.
`test/soc6_partymap.test.js` (18): the party laws re-driven over the
ink through a recording context. Mutants: `tools/mutants/map1.json`,
42 dead, 0 survived. The relief map's records re-aimed: to1 C1/C3 to
`heldMap.js`, AUDIT SOC D2 to `inkMap.js`, AUDIT-EL F5 retired with
its pass.

## AUDIT-MAP (2026-09-18) - the audit of the held map, and what it found

Mac: *"Let's audit everything so far, wanna make sure this is perfect."*
Three adversarial reviewers with one lens each (the ink's geometry and
its cost on the real bay; the window against the host and a real
browser; the mod's laws against the classic window and the C#), a
browser probe written for the sheet (`tools/heldMapProbe.mjs` - a
synthetic bay on the menu page through real pointer events, 37 checks,
two screenshots a person can look at), and a read of the screenshots.
Twenty-two findings fixed, five departures recorded, every fix pinned
two-way (`test/heldmap.test.js` +20, 67 in all) and mutated
(`tools/mutants/auditmap.json`: 26 dead, 0 survived).

**The screenshot's own two (A1).** The coast tracer emitted the DATA's
outer edge as a shoreline, so the whole bay sat inside a drawn box; and
Chaikin's corner cut takes a quarter of each leg, so a long straight run
(the map edge, a province line) lost its corners to diagonals. The edge
of the data is not a shore now (no segment along the map's boundary; a
coast running off the sheet is an open chain), and the cut is
`roundCorners` - Chaikin's quarter, bounded to a pixel and a half, so a
staircase rounds and a straight run stays straight, closed loops cut at
their shared corner too.

**The ink (A2-A9, the reviewer's).** A2 the breathing rings repainted
the whole bay's ink every frame while a selection or a party stood -
~2 ms of JS and a full raster of ~28k vertices at 60 fps; the static
ink is a KEPT layer now, painted when its key moves (view, band, sheet,
marks, the mod's state), the rings an overlay per pulse at 10 Hz. A3
zooming at the ceiling anchored at an over-the-ceiling scale and clamped
after, sliding the map ~90 px a notch at SCALE_MAX; the scale is clamped
first. A4 the simplifier was recursive with a slice per split and a 20k
zigzag blew the stack; iterative now, same answer. A5 chains were culled
per POINT, so a run whose ends were both off the sheet was never drawn
and a chain leaving the view lifted the pen a segment short; per
segment now. A6 the harbour glyph's flukes were joined to its stock by a
stray diagonal; a fresh subpath. A7 three provinces meeting left a gap
in the dashed border, because the junction was a corner of whichever
chain got there first and the cut moved it off the third arm's end;
chains END at junctions now. A8 the glide between a rest view and a
zoomed goal ran through views with blank parchment above the map;
re-clamped every step. A9 a summary with no region index threw out of
every paint; it names nothing. Perf, on a synthetic 1000x500 bay with
the shipped road masks: the tracer is typed (roads 44 -> 8 ms, tracks
56 -> 5 ms, the same chains), the carets thinned once per band at build
(a hundred thousand pixels a frame at far, gone), the name measures
cached; the model builds in ~100 ms once per open and a pulse frame is a
drawImage and a few arcs.

**The window (B1-B4, H1-H8).** B1 the Close button and the resume
prompt's Yes dropped an open panel's toggles; every way out remembers.
B2 the sprite's onload was set after its source; before it now. B3 touch
users could not zoom at all; a second finger pinches about the fingers'
midpoint, a pinch never picks, and iOS's page-pinch is held by a
cancelled touchmove. B4 the middle click's autoscroll is shut where the
browser reads it (mousedown, auxclick). H1 ONLINE was ignored: the card
billed inn nights and showed days the popup waives (`sleepModeInn &&
!noWorldTime()`); no inn is paid, the journey reads "now", the popup's
own line is on the card. H6 a box held only the stage - a search pick
under the resume prompt could begin a second journey; the chrome is
pointer-dead under any box. H7 a close during the opening fade snapped
to full before lowering, and the boxes stayed painted through it; the
fade starts where the sheet is and the boxes come down with it. H8 a
line-mode wheel zoomed a fraction of a percent a notch; the delta is
normalised. The display face is ASKED for (`document.fonts.load`; a
canvas font never triggers a load) and the sheet repainted when it
lands. Confirmed sound by the host reviewer: every arm the host calls,
in every mount (outdoors, the guild's teleport map, the journal, the
mod's journey UI, online); no listener outlives the window; the chain
cache keyed on a stable network reference; the state machine under
every sequence tried; the only lost commit is a dispose during the
0.3 s lowering, the old window's own semantics.

**The mod's laws (D1-D4, the law reviewer's).** D1 a walked place-trip
handed DFU's minutes to the host's ETA, not the walked estimate (2.8x
too long on the probe's input); it hands the walked one, the popup's
own `{ ...trip, minutes: travelTimeTotalMins }`. D2 the fare was billed
and CHARGED unscaled: the popup runs the mod's `_scaleTripCost`
(FastTravelCostScaleFactor over the inn nights, ShipTravelCostScaleFactor
over the passage, each through the shop-price formula), the enhanced
skin never had since the relief map, and the bible called it faithful;
the law is one pure export now (`scaleTripCost`, `ui/travelPopUp.js`)
that both skins call. D3 No on the FEE prompt and an empty purse left
the map up, where the C#'s ChargeForTeleport and the classic window's
two arms close it; they close it (DFU's fee-less teleport popup still
leaves the map armed). D4 the info box closed on the pointer down but
the CLICK still reached the button under it - Close closed the map,
Begin began the trip; the whole press is eaten. And the junction disc
read the mark off the last M window rather than the store, so a mark
set on the guild's teleport window was invisible to it.

**Departures recorded (U1-U5).** U1 the coordinates click refuses a
teleport visit (the C# and the classic open the walking popup from the
guild's teleport map; a bare pixel is no place to appear). U2 H works
under the travel panel (the classic routes every key to the popup, so H
is dead there; I matches). U3 the ship laws on a bare pixel see no
destination and refuse the ship (the C# and the classic consult the
STALE last-hovered summary). U4 the resume prompt answers Enter and E
too. U5 the walked card shows the purse (the C# does), and the fee is
asked with the pick and deducted only with the teleport (the C# asks
once at open and deducts on Yes whether or not the player then goes).

**Not this slice's.** F5 typed in the search box reloads the page - the
host's own order skips its browser-key guard for any text target, the
chargen name field included (pre-existing, host-side).

## MAP3 - the Morrowind held pose (SHIPPED 2026-09-18)

Mac: "Morrowind will need its own handcrafted map with hand placement
just like the sprite. Our first custom rig change." `src/combat/heldPose.js`
(the pose and the paper), `src/ui/quadMap.js` (the sheet over the
paper's corners), and the seams in `src/combat/fpArm.js`,
`src/combat/weaponRig.js`, `src/scenes/world.js` and `src/ui/heldMap.js`.
The record of the rig change itself is in
`bible/02-Formats/Morrowind-Rules.md` (MAP3); this is the window's side.

**The two lanes.** The window opens in the SPRITE lane (MAP1) and asks
the host's `holder` on its first tick whether the Morrowind arm was the
thing drawn on the last frame (`weaponRig.armsDrawn()`, the draw seam's
own record - set on the line before `if (fpArm.active()) { fpArm.draw(c);
return; }`, reset at the top of every draw, so a hidden or unloaded or
third-person arm answers no). On yes it hands the rig a sheet of the
paper's own aspect (`holdPaper(null, { aspect })`) and takes the HANDS
lane: the painting and its keyed thumbs go, the root goes clear (the
world and the arm show through - `.hmroot.hmlanehands { background:
transparent }`), and the ink canvas is laid over the four corners the
rig projects. Asked per open, never snapshot: the arm can be built,
unloaded or hidden between two presses of the key. A rig that has been
built but not yet posed refuses the first hold (the eye is read off the
last pose); the window asks again each tick, thirty times, then stays
on the sprite. A host with no holder at all (every scene but the world)
is the sprite lane.

**The sheet over the paper.** The ink stays a DOM canvas at full
resolution - the picture, the pointer surface, the whole of MAP1 and
MAP2 unchanged - and is placed by a CSS `matrix3d`: a flat quad under a
projective camera is exactly a homography, so `quadPlacement(w, h,
corners)` (Heckbert's adjugate, unit square to the four corners, then
the sheet's scale) is the forward map for the CSS and its inverse is the
pointer's. Every pointer event goes through `_paperPoint`, which in the
hands lane maps the client point through the inverse - a pick lands on
the city under the angled sheet, a drag pans in SHEET pixels (the
delta of two inverse-mapped points, not the screen delta; in the sprite
lane the two are the same offset), the pinch's anchor likewise. The
corners are re-read every tick and the matrix rewritten only when they
move (keyed to a tenth of a pixel); no corners (the arm has not drawn,
or a corner is behind the lens) hides the ink rather than leaving it
stale. A resize keeps the 4:3 fit's paper size (PAPER of the stage, so
the aspect is the same at any size) and re-holds so the rig re-places
the paper. Dispose releases the arm in either lane.

**The rig's side, briefly** (the record proper is Morrowind-Rules MAP3).
The pose is a set of DELTAS in degrees about each bone's own axes,
applied after the idle through the torch's track-map/sampler idiom
(`{__delta, __base, __rest}` wrappers, `heldSampler` answering base
TIMES delta) - the arm keeps breathing, the hands come up; the paper is
a rigid parchment-coloured quad on the rig root, `forward` ahead and
`drop` below the eye, `width` across, leaning back by `tilt`, its
corners projected through the model, view and projection the last draw
composed with; the weapon, the arrow and the torch are hidden while it
is up; an equip-follow rebuild puts the sheet back on the next frame.

**The tuning door, and the honest note.** `HELD_POSE_DEFAULT`'s bone
deltas are ALL ZERO: the port was written against the fixture arm and
the session had no retail `xbase_anim.1st.nif` to pose, so no number
here claims to be right on retail bones. The pose is tuned LIVE:
`window.__heldPose()` reads the pose in force while the map is up;
`window.__heldPose({ bones: { 'left forearm': [rx, ry, rz], 'left hand':
[...], ... }, paper: { width, forward, drop, tilt, colour } })` re-places
the sheet on the arm as you watch, a PARTIAL spec changing only what it
names (the pose in force is the base, so one bone or the paper alone can
be walked in). Bones: the two arms, clavicle to hand, in the first-person
skeleton's own names. Metres for the paper, degrees for the rest. The
numbers Mac lands on go into `HELD_POSE_DEFAULT` as the shipped pose.

**Not done, by decision.** The paper carries no texture (the ink is the
DOM sheet over it; the piece is the parchment under the ink); the thumbs
over the sheet are the arm's own hands, posed, not a keyed overlay;
there is no separate handcrafted picture for Morrowind - the sheet is
the same ink.

**Pins.** `test/map3_heldpose.test.js` (16): the quaternion laws
(Hamilton, the intrinsic X-Y-Z order, the 3x3 conversion through all four
trace branches), `deltaTracks` (wrapped, zero skipped, missing bone
skipped, lowercased, base untouched), `heldSampler` (base times delta,
the base's translation, rest without a base, unwrapped passthrough),
`paperCornersRig` (the eye, forward +Y, drop -Z, the aspect, the tilt's
lean and foreshortening, the order), `paperPiece` (the root, both
windings, the UVs, the colour copied), `projectPaperCorners` (the axis
at the centre, +X right, +Y up on the lens is up the page, behind the
lens null, the model applied), `normaliseHeldPose` (the merge over a
base, the padding, the unknown bone, the NaN, the colour triple, the
zero default); the quad map (the unit square, the projective row, all
four corners, the diagonals, the inverse, the singular cases, the
column-major CSS, the placement's box and mappers); the REAL fixture
rig headless (mwtorch's harness): hold refused with nothing built, one
paper piece on the root at the eye with the mesh released for the
repack, a second hold replacing, release removing, corners null before
the first draw and through the draw's own camera after it (a trapezium
wider at the bottom, on the canvas for a smaller sheet, a rectangle at
zero tilt), a forearm delta moving the hand and not the other arm, the
door keeping the bones in force through a paper-only spec, the rebuild
re-adding the sheet, unload dropping it; the hide lines, the draw seam's
`_armDrewLast`, the holder on the one dep bag and the door.
`test/heldmap.test.js` (+4, 71): the hands lane through a faked holder
(sprite and thumbs gone, the matrix of the corners, the inverse pointer,
a pick and a pan under the angle, moving corners, no corners, release
once), the sprite lane when the arm is not drawn (never polled, still
released at teardown, no holder at all), the thirty asks, the resize
re-hold. Mutants: `tools/mutants/map3.json`, 39 dead, 0 survived.
Browser: a MAP3 layer in `tools/mwArmProbe.mjs` (the fixture arm takes
the sheet, a shown paper range, the pose read back, four corners on the
canvas, the sheet's texels at the corners' centre, release) - the five
geometric checks pass in this session's headless Chromium; the three
texel readbacks could not be verified here, where the probe's OWN
earlier texel layers (the clip's motion, the look) also fail on this
container's GL, eight before MAP3 touched it.

## AUDIT-MAP2 (2026-09-18) - the last audit before merge, MAP1-MAP3

Mac: "Before we merge, let's do one last audit on the new maps." Three
reviewer lenses again (the rig's side of MAP3; the window's side of
MAP3; a fresh pair of eyes on MAP1/MAP2's laws, ink, performance and
input, told not to repeat AUDIT-MAP), plus a HANDS-LANE layer in
`tools/heldMapProbe.mjs`: the real fixture rig booted in the page,
holding the window's sheet through the same four closures the world
host hands over. Thirty-two findings; twenty-five fixed, four recorded
as departures or left, three not this slice's. The probe found the
first two before any reviewer reported.

**The two the browser found.** (1) The root's lane class was
`hmhands` - the THUMBS canvas's class, whose rule is `pointer-events:
none` - so the whole window ignored every click in the hands lane; the
first hands-lane pick in a real browser went to the arm's canvas
underneath. Now `hmlanehands`. (2) The sheet sat past the pass's FAR
PLANE (the arm's reach times four, rule 54) and was clipped while its
corners, which do not clip, still projected: ink over the sky with no
parchment under it. The reach now grows to the sheet's farthest corner
and a quarter more while a sheet is held (the perspective line's
literal stands; the reach is what the sheet is part of), restored on
release. The probe reads the parchment texel back off the arm's own
target at the corners' centre.

**The rig's side, fixed.** The quaternions were packed `[x,y,z,w]`
while everything the rig reads is `[w,x,y,z]` (mwAnim's sampler,
mwSkin's `quatToMat33`): a forty-degree bend about X reached the rig as
a hundred-and-forty-degree turn about Z - and the pins, testing the
module against itself, could not see it. Repacked; the decisive pin now
poses a delta through mwSkin's OWN `poseSkeleton` and reads the
matrix. The six default bones were named in the part-attach family
(`left forearm`) that retail's `.kf` never keys - retail keys `Bip01 L
Forearm` and hangs the hand off it - so a delta would have turned an
attach node and left the hand behind; a held bone now resolves to
whichever of its two spellings the CLIP keys, then to whichever the
skeleton has (`HELD_BONE_ALIASES`). The paper's second winding was a
coplanar twin whose normal faced away, fighting the first for the depth
buffer under a culling-off pass: one winding, facing the eye, pinned
through `packFpArm`'s normal. The sheet was anchored to the eye ONCE at
hold time while the camera node moves with the neck: its source is now
refreshed in place whenever the node's translation moved. `paperCorners`
answered from a stale frame after the arm stopped drawing (paralysis,
EOTB, third person - `lastFrame` cleared only at unload): `drewLast()`
records whether the last draw composed, `armsDrawn()` folds it in, and
the host's `corners` closure answers null unless the arm drew. A rig
with no camera node on a rebuild lets the sheet go rather than
projecting a piece that is not in the mesh. `holdPaper` is refused in
third person.

**The window's side, fixed.** The hands lane was a one-way latch: corners
gone for good (the arm unloaded, hidden, third person) left an invisible
map with no way back. After HANDS_LOST_TICKS without corners the sheet
is given back to the painting - sprite and thumbs restored, root opaque,
layout redone, the rig released once and not asked again that open; a
brief gap only hides the ink. `_layout` reused `''` as its
force-re-place sentinel, colliding with `_placeOnHands`'s "no corners"
key: a resize while a corner was behind the lens kept the old matrix on
the new size (`null` now forces). The resize re-held the sheet at an
aspect that is provably invariant (PAPER of a 4:3 stage) and repacked
the whole arm mesh each time: it no longer asks. The stage is the whole
viewport in the hands lane and nothing clamped the pointer to the
sheet: a press on the world panned the map, a tap on the sky could
select an undrawn city, and beyond the paper's vanishing line the
inverse answered a mirrored point. Now `_paperPoint` answers OFF_SHEET
for anything not on the sheet (and `toSheet` null past the horizon,
where the divisor goes negative), a press off the sheet starts nothing,
a drag that leaves it holds the pan, and in EITHER lane nothing off the
paper is hovered, picked or marked. The pinch measured the fingers'
distance in screen pixels - two fingers slid up a leaning sheet read as
a pinch: measured on the sheet now. The foot (hint, band, legend) had
the root's black behind it and none over the world: its own scrim in
the hands lane. The sheet was released at teardown, a blank parchment
held through the fade: released at the start of the close, with the ink.
`quadPlacement` refuses a sheet turned all but edge-on (area under a
fiftieth of the longest edge squared), where absolute guards passed a
homography that smeared the canvas.

**MAP1/MAP2, fixed.** (T1) A rank-0 mage with an empty purse teleported
anywhere, free, by pressing Y on the "not enough gold" box: the key arm
never consulted `canPay`. There is no yes there now - the map closes, as
the classic's `teleportpoor` box closes on any key. (T2) Escape on the
FEE prompt left the map up: the generic panel-close arm sat above the
teleport arm. Escape is the box's No now - the fee closes the map, DFU's
own fee-less box leaves it armed. (T3) The guild's teleport map offered
a full fast-travel panel (close the teleport box, "Travel here", Begin)
that committed into an `onTravel` the teleport host never hands over:
the visit was spent and the player went nowhere. The armed map's only
offer is the teleport; a travel panel asked for on it IS the teleport
box. (T4) "Bare pixel" was the BAND's word, not the data's: at the far
band a click dead on a discovered hamlet the band hides became a
nameless walk to its pixel through `onTravelToCoords`. Bare now means no
discovered place on the pixel (the classic's `locationSelected`); the
band still hides it from the pick, MAP1's law. Performance: the kept
static layer was reset (freed and re-zeroed) on every pan frame -
assigning a canvas's width resets its bitmap even to the same value;
`placeNames` sorted every named mark in the bay per pan frame before
culling to the sheet; the Ports toggle threw away the bay-wide search
index it did not gate (the law is applied per query); the find box
kept a thousand fuzzy matches per keystroke through the full DP (two
hundred now, for a box that shows twelve); the trip carried a second
full path walk (`path`, `byRoad`) that nothing read since the relief
map's route line went. The ink's region read is the maps file's own
`getRegionIndexAt` where the host hands a real one - it carries the two
fixups (politic 64 is the High Rock sea coast; the bad byte 105 is the
Wrothgarian Mountains) a bare -128 turned into "nameless", and a
nameless pixel erased the border on its neighbour's side. The wheel
zoomed under the modal boxes. The player's own pixel was snapshot at
construction while the party was polled: polled with it now.

**Departures and leaves.** The hover and the coordinates name keep the
classic window's own bare politic read (they match the classic; only
the ink's borders and centroids take the fixups). The chrome (card,
foot, box) is placed against the viewport, not around the held sheet;
where the tuned pose puts the sheet decides whether they overlap, and
the pose is not tuned yet - left for the tuning. The ink canvas is
rasterised at the 4:3 fit's size and minified under its matrix rather
than right-sized to the quad's box - left; the box is in
`quadPlacement` for when it is wanted. `_markerAt` still walks every
discovered mark per pointer move (no spatial index) - left, with the
cull. `HELD_POSE_DEFAULT` deltas stay zero and the tuning note stands.

**Not this slice's.** The arm probe's own texel layers (the clip's
motion, the look) fail on this container's headless GL, eight before
MAP3 touched it, and so do the MAP3 layer's three texel readbacks
there; the held map probe's parchment readback passes in the same
Chromium. The two disagree on the page they boot; not chased.

**Pins.** `test/map3_heldpose.test.js` 17 (+1: the alias resolution;
the packing through mwSkin's poseSkeleton, the normal through packFpArm,
the reach's growth and restoration, drewLast per call, the eye-synced
source, the mirrored sheet, the sliver, the horizon), `test/heldmap.test.js`
78 (+7: the way back, the pointer off the sheet, the close, T1/T2, T3,
T4, the perf-and-polish sweep; the resize pin re-aimed). Mutants:
`tools/mutants/map3.json` rewritten, 70 records, 68 dead, 2 equivalent
as recorded; `to1.json` c3-fee-never-deducted re-aimed. Browser:
`tools/heldMapProbe.mjs` 50 checks (the hands lane on the real fixture
rig: the matrix laid on the corners to the pixel, the parchment texel
under the ink, hover and pick through the inverse, release on close).

## MAP-FIELD (2026-09-18) - what a player actually saw, and why no probe did

Mac, playing the deployed build: *"The sprite I gave to be used is nowhere
to be seen at all and the morrowind doesn't even hold the map. It's a full
screen map which WASNT SUPPOSED TO BE A THING."* Two defects, and the
second is this arc's own premise failing outright.

**The sprite asked the wrong page.** `HELD_MAP_URL` was the bare
`'art/held-map.png'`. A bare relative URL resolves against the DOCUMENT,
and the game's document is `/play/index.html` - so the browser asked for
`/play/art/held-map.png`, the host answered with the page itself, the
decode failed, `onload` never fired and `_keyHands` never ran. What is
left is the ink canvas on the black root: no parchment, no gauntlets,
a big rectangle of map. The build's `base` is `'./'` (one build serves
from a project sub-path), so there is no absolute path to hardcode
either. `appRootFrom(import.meta.url)` reads the root off THIS MODULE
instead - a build serves it from `<root>/assets/`, the dev server from
`<root>/src/` - and the sprite hangs off that, correct under any base
and from any page depth.

Every probe ran on `menu.html`, which sits AT the root, where the broken
string happens to resolve. The pin asserted the string itself, and
`map1.json` carried a mutant that made the URL absolute and DIED on that
pin - so the wrong answer was locked in twice, by the two mechanisms this
port uses to stop exactly that. The pin is a law now (the root is read
off the module; the bare form is named as the bug) and the probe's last
three checks run from `/play/index.html` on purpose.

**The arms never took the sheet, and could not.** MAP3's holder asked
`armsDrawn()` - did the Morrowind arm draw on the last frame. But
`weaponRig`'s draw gate is `if (paralyzed || (!shown() && !torchOnly))
return;`, and `shown()` is the WEAPON's predicate: its `sheathed` leg
turns it off. A player opening the travel map is walking about sheathed
by definition, so the arm was not drawing, `armsDrawn()` was false, and
the hands lane was unreachable in the game - it only ever ran in the
probe, where a weapon is drawn.

TORCH-VIS had already written the sentence this needed, one slice
earlier and ten lines up the same function: *"a SHEATHED STANCE IS NOT A
STOWED LIGHT... `shown()` is the WEAPON's visibility"*. A held map is the
second thing that is not the weapon. So the gate takes a second
exception beside the torch's - `sheetOnly`, the arm active and holding a
sheet - and the holder asks a different question: `armsAvailable()`,
whether the arm WOULD draw, since until it takes the sheet it does not
draw at all. The weapon, the arrow and the torch are already hidden
while the sheet is up, so the hands hold the map and nothing else.

**The lesson for the next reader.** Every pin and every probe in this arc
tested the window against a harness. Nothing tested it against the page
the game is served from, or against a player who is not holding a sword -
the two things every real open has. Both defects were invisible to 78
pins, 50 browser checks and two audits, and obvious in ten seconds of
play.

Pins: `test/heldmap.test.js` (the URL law and `appRootFrom`'s four
shapes), `test/map3_heldpose.test.js` (the sheathed draw, the
availability question, `holdingPaper`), `test/ht1_handheldtorches.test.js`
re-aimed to the two-leg gate. Mutants: `map1.json`
`sprite-url-document-relative`, `map3.json` `sheathed-arm-does-not-draw`
and `holder-asks-did-it-draw`, `torchvis.json` re-aimed. Browser:
`tools/heldMapProbe.mjs` 50 checks, the last three from the game's page.
