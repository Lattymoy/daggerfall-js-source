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

## MAP-FIELD2 - the sheet is HELD (2026-09-18)

Mac, opening the map in a real game: *"the sprite I gave to hold the map
isnt positioned correctly and is full screen with a black background.
Its meant to act like any other sprite and be positioned at the bottom
of the screen. ... The status and magicka/health/fatigue UI element's
should go away when it is taken out."* Then, after the first fix:
*"There's still a gap at the bottom of the arms, any way you can author
the gap?"*

Three separate defects, each of which had survived every pin in this arc
for the same reason the two above it did: the pins drive a stub document
that renders nothing, so nothing in them can see a picture.

**The sprite was a picture of hands, not hands.** It was fitted to the
whole viewport and CENTRED, which is how a held thing becomes a poster.
It is anchored to the BOTTOM now, on the law every other held thing in
this port takes, and carried `HELD_MAP_BITE` further down so the arms
leave the frame rather than ending in mid-air above it. The one number
that decides the map's size is `HELD_MAP_HEIGHT`, the sprite's height as
a fraction of the viewport's; the width clamp is the single case where
the height gives way, on a viewport too narrow to hold the width that
height asks for, and without it the paper's sides are cut off.

**The black was PAINTED, not alpha.** `art/held-map.png` is fully
opaque and 47.3% of it is matte, so bottom-anchoring alone would have
walked a black rectangle down the screen. The key is measured off the
file rather than chosen (`tools/heldMapArtProbe.mjs`): in the gauntlet
columns the median pixel is 196 and 110 of 32,220 lie under the ramp, so
`MATTE_LUM = 8` / `MATTE_EDGE = 24` takes the background and leaves the
arms. It RAMPS across those sixteen levels because a hard key leaves a
black fringe against the sky. And the `<img>` is now only the LOADER -
the stage shows a canvas, because a keyed sprite cannot be an `<img>`.

**The vitals are a SECOND word, not the covering question.** `hud.js`
already had one - `windowCoversHud` - but DFU deliberately repaints its
LARGE hud under its own windows (`&& !largeHud?.art`), which is right
for a window and wrong for a sheet held in the player's hands: the
enhanced skin kept its bars on the knuckles. So `hidesHud` is its own
predicate on `windowStack`, the held map is the only window in the port
that claims it, and the hide sits OUTSIDE that carve-out. It also takes
no pause gate, unlike the cover: the held map does not stop the world.

**And the gap Mac saw the second time could not be cropped away.** This
is the part worth remembering. Measured by column, MOST of the forearm
reaches `SPRITE_ART_FOOT` and the bite carries those columns off the
bottom edge on its own - which is exactly why the first fix looked
right. But 69 of the 366 columns outside the paper stop short, the outer
edges of the cuffs worst of all: on a 900px screen they end up to 68px
above the bottom, leaving notches bitten out of the arms. No further
crop closes those, because pushing the sprite down far enough to bury
them takes the paper off the screen with it. So the pixels are
AUTHORED - `extendCuffs` carries each outside column's lowest opaque
pixel straight down to the foot of the sprite. It skips every column
inside the paper's own rectangle, because the parchment's torn bottom
edge is art and streaking it would be vandalism, and it runs AFTER the
key, because extending before it would carry the matte's black down
every column instead.

**The lesson, again.** `SPRITE_ART_FOOT` is where the painting's content
ends, and a fifth of the file is empty below it. Anchoring the FILE's
foot - the obvious reading - is the first gap, and it is invisible in
any harness that does not load the picture. Every constant in this slice
is a measurement, and the thing that measures them is a kept probe now
rather than a scratch script, so the next reader can re-run the numbers
instead of trusting this page.

Pins: `test/heldmap.test.js` (the geometry as a law over five viewports,
the `hidesHud` word, and the cuffs driven through the window itself over
a synthetic sprite). Mutants: `map1.json` `MAPFIELD2-*`, `map3.json`
`foot-no-scrim` re-aimed by content. Browser:
`tools/heldMapArtProbe.mjs`.

> Superseded in part by MAP-FIELD3/4 below: the matte key described here
> is GONE, and `extendCuffs` no longer skips by `PAPER`'s x range. The
> column measurements on this page ("69 of the 366 columns", "up to 68px")
> are the FIRST painting's and do not describe the art now shipped.

## MAP-FIELD3/4 - the map ran off the sheet, and the third painting (2026-09-19)

Mac, with a replacement sprite: *"So heres the new map I want to replace
the current one I have implemented. Same positioning. Additionally, the
ingame map 9n the map appears going off the edge"*. Then, with a fourth
file: *"Try this instead"*.

**The overflow was ours and it predated both new paintings.** `PAPER` is
the rectangle the ink canvas is laid on, EXACTLY - so a rectangle larger
than the parchment prints the Iliac Bay over the torn edge and out onto
the sky. Measured against the ORIGINAL art, the shipped constant sat
about 10px left and 12px above the sheet's real edge. Nobody had
measured it; it had been read off the picture by eye.

It is measured now, and not as the sheet's outermost pixels. The sheet
is painted as a slightly turned quadrilateral with torn, rounded
corners, so an upright rectangle has to give a little at each corner to
sit inside it at all. `heldMapArtProbe.mjs` walks the per-row and
per-column first and last solid pixel and shrinks until nothing
overhangs, and pins that the overhang is ZERO - the check that would
have caught this on day one.

**THE KEY IS A COLOUR. This is the finding worth keeping.** The thumbs
rest on the sheet, so the sprite's own pixels are keyed back OVER the
ink where they lie. Three paintings were keyed on BRIGHTNESS and all
three were wrong, each in a way that looked fine until it was measured:

- Painting one: bronze gauntlets reaching luma 148 against parchment
  shaded down to 130. No line exists. Saturation is no better - the
  sheet sits at 0.45-0.50 and the glove at 0.50-0.68.
- Painting three: a cream middle that cuts cleanly at 154 - and a BURNT
  BORDER that does not. Keying there kept a ragged halo of the sheet's
  own edge around each thumb and laid it on top of the map.

What parts them is WARMTH. The sheet is parchment: warm all the way
through, cream middle and burnt border alike. The gauntlets are steel:
warmed at the highlights, neutral and at times cold in the body.
Measured over the two thumbs and 340,918 pixels of sheet, red-minus-blue
under 75 catches 36% of the thumb and FIVE pixels of the sheet - and
each of those five is a speck in a crack, which the flood drops as an
island. The same file, keyed on brightness, has the sheet's border at
luma 37 and the glove's ridges at 212: a total overlap.

Colour alone is only a seed. `keyThumbPixels` is seed, then FLOOD in
from the side the thumb enters on (so a stain in the middle of the sheet
is dropped however dark it is), then CLOSE - grow and shrink by the same
amount, which bridges the lit ridge down the thumb while it is interior
and puts the outline back where the paint had it - then FILL what is
enclosed, which takes the specular highlights. Growing without the
shrink was tried and is wrong: it bridges nothing that reaches the
silhouette and leaves a pale rim round the thumb.

**RECORDED DEPARTURE: the black matte key is gone.** MAP-FIELD2's
`keyMattePixels` / `MATTE_LUM` / `MATTE_EDGE` and the `keyHandPixels`
brightness key are removed, not merely unused. The new painting carries
a real alpha channel - 857,265 pixels exactly transparent, no matte at
all - so the picture states its own silhouette. Reviving the key on this
art would be a BUG, because these gauntlets are grey and reach luma 0: a
brightness key punches holes straight through them. `test/heldmap.test.js`
pins the absence by name, and `map1.json`
`MAPFIELD4-the-brightness-key-comes-back` is its killer. If a matted
painting is ever supplied again the key comes back from here, keyed to
that file, and not by feel.

**`extendCuffs` asks a different question now, and two answers were
wrong first.** The cuffs are cut by the frame and their cut ends are not
level (0.866 to 0.893 of the file). Asking whether a column sits outside
`PAPER`'s x range smears the sheet's own torn edge, because `PAPER` is
inset inside the parchment. Asking whether it ends below the sheet
smears the whole parchment, because the sheet's ragged bottom hangs
lower than `PAPER`'s foot. The answer that holds is the CUFF BAND, and
it is safe only because the painting leaves a gap there: every column
under the sheet ends by 0.733, every cut cuff at 0.866 or below, and
NOTHING ends in between. What would lie between is the hand's own
silhouette - drawn to end where it ends, and ruined by a streak.

**And on this art the crop closes the gap by itself.** At MAP-FIELD2's
bite it cleared the highest cut cuff by half a pixel; at MAP-FIELD5's it
clears by 75. Either way no column is short, so the pin had to be
rewritten twice - the first version claimed a shortfall this painting
does not have, and the second pinned the MARGIN, which is a number Mac
moves whenever the sheet should sit higher or lower. It pins the LAW
now: no cut cuff ends above the screen's edge. `extendCuffs` is what
keeps that true at any bite, which is why it stays where the margin is
comfortable.

## MAP-FIELD5 - lower on the screen (2026-09-19)

Mac: *"Can you lower it on the screen more"*. `HELD_MAP_BITE` 0.03 ->
0.11, about 60px further down a 720p screen. `HELD_MAP_HEIGHT` sets how
big the sheet is and `HELD_MAP_BITE` how far down it sits; they are
independent, so this is the one number to turn and it disturbs nothing
else. The only consequence worth recording is the cuff margin above.

**The lesson.** Every number in this slice is a measurement, and twice
now a number that was "obviously right" by eye was wrong by tens of
pixels. Three of the claims in the first draft of this work were wrong
and were corrected by the probe rather than by looking: that the
gauntlets were neutral pewter (they are not - only their bodies are),
that no sheet pixel at all falls under the colour line (five do), and
that the right forearm crosses under the sheet (it does not - that came
from misreading an ASCII dump's column scale).

Pins: `test/heldmap.test.js` (the colour key over a zone with a crack
speck, the seeded side, clear ground, and the cut cuffs driven through
`_paintSheet` itself). Mutants: `map1.json`, `MAPFIELD4-*` x4 plus the
re-aimed `MAPFIELD2-*`. Browser: `tools/heldMapArtProbe.mjs`, 19 checks.

## MAP-FIELD6 - readable glyphs (2026-09-19)

Mac: *"Some of the glyphs are hard to read. I want to make everything
more readable, without clutter and keeping the same design"*.

**It was never contrast.** The pen sits at luma 43 on parchment at 172,
which is as strong a difference as print. Three things were actually
wrong, and only one of them is about the glyphs themselves.

**1. A label was free to land on another town's mark** - LATENT, and
this is the correction that matters most on this page. `placeNames`
tested a candidate box against the boxes of labels already placed and
against nothing else, so a city's name ran straight through the ring of
the city beside it. Every glyph the band inks now seeds the same greedy
test, before any name is placed.

But **this sheet inks no names at all**. MAP-FIELD2 took them off at
Mac's word and the window has passed `names: null` ever since;
`placeNames` has no caller in `src/`. The first draft of this section
called the buried glyph "the fault Mac could SEE", and it was not - it
could not have been, because there are no labels on the sheet to bury
it. The before-and-after pictures that went with it were rendered
through a fixture that passes `names`, which is not the game.

What Mac actually saw is #2 and #3 below. This first part is a fix to
`inkMap`'s law, kept because the law is kept (see the import in
`heldMap.js`, which says so), and reachable the day anything inks names
again - not a fix to anything on screen today.

That alone silenced the two names that most needed saying, because a
blocked label had exactly one place to go. So a name now has FOUR
candidates - right, left, above, below - and takes the first clear one.
Right stays first, because that is where the eye looks and where every
label sat before. Only a name with nowhere clear at all is dropped, and
that trade is deliberate: the mark is still there to hover, and one
unreadable label is worth less than the mark it was covering.

RANK still decides, but what it buys has changed. It used to decide who
got a label at all; now it decides who gets the BETTER SIDE, since the
loser has three more to try. The pin had to move with it - the old
fixture could no longer tell a ranked run from an unranked one, and the
mutant that proves the law went quiet until it was re-aimed.

**2. The ink had nothing to hold it apart from the paper.** The
parchment is not a flat ground: it is painted with brown cracks and
stains of very nearly the pen's own hue. A 1.2px line over that tangles
with the texture. Every glyph and every name is now drawn TWICE - once
in `PEN.halo`, a wide soft parchment-light pass, then in ink. This is a
cartographer's halo, and it takes clutter AWAY rather than adding it:
the page keeps exactly the marks it had and they stop competing with the
sheet's own marks. Nothing about the design moves.

The halo is laid as a PASS, not per mark. Per mark, a neighbour's halo
falls on ink already drawn and bites a hole in it - which on a crowded
coast is worse than the tangle it set out to fix.

**3. The relief hatch was reading as ink.** The high ground's carets
were drawn in `PEN.soft`, the same tone as borders and tracks, and at
the near band they are dense. They have their own `PEN.relief` now, at
about two thirds the weight. They are meant to be felt, not read, and
quieting them is most of what "without clutter" asked for.

The pen went 1.2 -> 1.5 with all this, which thickens every STROKED
glyph and the halo that carries it.

(The first draft of that sentence said the weight was what made "a
village's dot and a track's dashes hold together at the far band". It
was wrong three times over: the dot is `fill()` alone, so the pen never
touches it - what changed the dot is its radius, 2 -> 2.2, which no
record mentioned; a track's dashes are stroked at a width of 1 written
into the paint; and the far band draws neither, inking cities only and
skipping the tracks.)

Pins: `test/heldmap.test.js` - the halo pass ahead of every ink stroke
(which takes two marks to state at all), a name kept off every glyph
with the four candidates driving it, rank read at the SIDE it now
decides, and a town ringed on all four sides losing its label and
keeping its mark. Mutants: `map1.json` `MAPFIELD6-*` x6, with
`overlap-drawn` and `rank-ignored` re-aimed by content.

## MAP-FIELD7 - the sheet travels (2026-09-19)

Mac: *"when you open or close your map, I want the sprite to come in and
go out at the bottom of the screen instead of fading in"*.

The two clocks had SAID this since MAP-FIELD2 - `OPEN_S` was commented
"the sheet rises into view" and `CLOSE_S` "...and lowers" - and the code
under them was a fade on the root. It really moves now.

**The stage is carried on its own height.** `translateY(100%)` needs no
viewport number and is right at every size: the stage's top sits at
`vh - (SPRITE_ART_FOOT - HELD_MAP_BITE) * h`, so moving it down by a
full `h` always puts its top past the bottom edge and the whole painting
with it. It is eased on `smoothstep` - the port's own, from
`systems/mathf.js` - because a held thing has weight: it leaves and
arrives slowly and crosses quickly.

**The chrome does not travel.** The top bar and the card are anchored to
the viewport's own edges, and sliding them up from the floor reads as a
mistake. They keep the fade the sheet used to have - but the fade had to
move OFF the root, because the root carries the stage and fading it
would fade the sprite, which is the thing Mac asked to stop. `_setRaise`
walks the root's children and skips the stage by identity.

A CSS rule (`.hmroot > :not(.hmstage)`) driven by a custom property was
tried first and is a departure worth recording, because it failed for a
reason worth knowing: the suite has SIXTEEN separate fake documents,
each with `style` as a bare object, and a custom property can only be
set through `setProperty`. Upgrading one stub fixed one file and broke
eleven pins in another. The rule was not wrong, but a law that only
holds where the harness happens to be rich enough is a law with a hole
in it - so it moved into JS, where every stub can already see it.

**And in the hands lane nothing slides at all.** There the arm brings
the sheet in itself and the ink is laid on the rig's projected corners
by a matrix3d of its own; a translate on the stage would drag the whole
sheet off the paper the arm is holding - a worse bug than the fade it
replaced. `_setRaise` returns early on that lane, and the pin drives a
real holder to prove it.

The clocks grew a little with the change (0.3 -> 0.42 opening, 0.36
closing). A fade of a third of a second reads as instant; a travelling
thing at the same length reads as hurried, and leaving should be a touch
quicker than arriving.

Pins: `test/heldmap.test.js` - mounted DOWN before the first tick, a
monotonic rise that ends with NO transform left on the stage, the root
never carrying an opacity, the fade rule excluding the stage by name, a
close mid-rise lowering from where it was, and the hands lane never
sliding. Mutants: `map1.json` `MAPFIELD7-*` x6.

## AUDIT MAP-FIELD (2026-09-19) - the audit before the merge

Mac: *"Audit first"*. Four reviewers over the whole held-map arc. What
they found is folded into the sections above; what follows is what the
audit itself is worth remembering for.

**Two real bugs, both in the window's lifecycle.** `_tryHands()` was
phase-guarded on one of its two arms only, so the retry could take the
sheet into the arm MID-CLOSE - hiding the painting on the spot and, via
`_setRaise`'s hands-lane early return, snapping the lowering sheet back
to its held place. And the travel/teleport/coords hook only ever fired
from `tick()`'s closing arm, so a host that disposed the window while
the sheet was lowering DROPPED the journey the player had committed to,
silently; MAP-FIELD7's longer `CLOSE_S` had widened that window by a
fifth. Both are fixed and both have behavioural pins.

**Three claims of ours that measurement disproved.** The "nothing ends
in between" premise for `CUFF_BAND` (64 columns do). The pen's
justification (wrong on all three of its counts). And the whole first
half of MAP-FIELD6, which fixed a fault the shipping sheet cannot have.
Every one of them was written with the confidence of a measurement and
none of them had been measured.

**And the lesson about PINS, which is the one to keep.** Four probe
checks could not fail on any art: they classified their populations BY
the constant under test, so `extendCuffs` was asked whether it had
painted exactly the columns it is defined to paint. Shift the art eight
pixels and six hand-silhouette columns really are streaked off the
bottom of the screen - and the probe still said 19/19. The populations
are measured off the PICTURE now (the sheet by where the sheet is, the
cuts by the art's own foot), and dropping `CUFF_BAND` to 0.80 fails
three checks where it used to fail none.

The same shape had eaten a real law elsewhere: `border-through-unnamed`
had been anchored on a line that occurs TWICE in `inkMap.js`, so the
record could not apply and the law it is the only killer of was checked
by nothing. A departure guarded by SPELLING went the same way - the
matte key's `doesNotMatch(src, /MATTE_LUM|.../)` let a real brightness
key written under any other name through all 84 pins. The cuff fixture
carries a near-black pixel in the arm now, so any such key breaks it.

Laws that were argued at length in a commit and pinned by nothing:
MAP-FIELD5 end to end, `PEN.relief`, `GLYPH_PEN`, `PEN.halo`'s colour,
the halo's stroke on filled kinds, and the easing. All six have pins and
mutants now. A law worth a paragraph is worth a pin.

## MAP-WEAPON - the sprite lane had no answer for this window (2026-09-19)

Mac: *"when opening up the enhanced map, your unsheathed weapon can
still be seen"*.

MAP-FIELD gave the MORROWIND arm its held-sheet pose, and
`fpArm.holdPaper` hides the weapon, the arrow and the torch while it
holds - so the arm's own branch of the draw ladder was already right.
THE CLASSIC BODY HAS NO POSE TO TAKE, so it just kept drawing.

Under DFU's own travel map that is invisible: TRAV0I00 is a
full-screen window and the weapon is behind it. The enhanced map is
the port's own SPRITE - two hands holding a parchment, with real alpha
around them, bottom-anchored by MAP-FIELD5 - so a drawn weapon shows
through and around it. Hands holding a map are not also holding a
sword.

**THE LAW IS A POSITION IN THE LADDER.** `if (sheetWindowUp()) return;`
stands BELOW the arm's branch (which returns, so the Morrowind lane is
untouched) and ABOVE the shield, the torch hand, the widget's clone and
the sprite - exactly the four the classic body would have painted, and
nothing else. On a sheathed frame none of those drew anyway, so on that
path the line changes nothing.

It is NOT a leg of `shown()`. AUDIT-FIELD F1's warning one door along
applies here too: `shown()`'s four legs are the WEAPON's own state - a
readied spell, a cast animation, an equip countdown, the sheathe - and
an open window is not one of them. Folding it in would relax every
reader of that predicate.

The host reads it PER FRAME off the live overlay slot
(`townTalk.overlay?.isTravelMap === true`), never a flag raised at the
open: the window can be closed by Escape, by a travel, by a quest popup
taking the slot, or by a teardown, and a flag would have to be lowered
at every one of them. `isTravelMap` is the window's own duck tag, this
file's established idiom (`isRestWindow`, `isVirtueLevelUp`) - the
combat rig imports no UI class to ask a UI question. The dep defaults
to `() => false`, so a host that never heard of it draws what it always
drew.

Pins: `map3_heldpose.test.js` (the gate's position against all five
neighbours, the default, and that `shown()` does not carry it; plus the
host's read and the window's tag). Mutants: `tools/mutants/map3.json`
grew three - the gate dropped, the gate hoisted above the arm branch,
and the host raising a flag instead of asking the slot - 77 in total,
75 dead and 2 equivalent as recorded.

## MAP-POV - the map is read in the head (2026-09-20)

Mac: *"on the morrowind model the new enhanced map feature isnt working.
It shows the enhanced classic map sprite"*, then, once the state was
named: *"If you're in 3rd person and decide to use the map, it should
transition you to first person and then open the map. Both for the
morrowind/non morrowind"*.

**What was found, and how.** The shipped held-map probe drives `fpArm`
directly with a synthetic holder, so it proves the lane and not the seam.
A reproduction through the CALLER'S CONDITION - the real
`createWeaponRig`, the world host's holder verbatim
(`armsAvailable` / `holdPaper` / `armsDrawn() ? paperCorners() : null`),
and the world's frame order (rig.frame, rig.draw, then the window's
tick) - took the hands lane on the second tick and held it for the whole
open in every first-person condition: sheathed, drawn, the default pose,
and with Weapon Widget, Shield Widget and Handheld Torches on. The one
state that gave the sprite was third person. `fpArm.active()` is
first-person only, and AUDIT-MAP2 decided the third-person body holds
nothing, so from third person `armsAvailable()` answered no thirty times
and the window stayed on the painting - which is what Mac saw. (The
first run of the reproduction hit it by accident: Eye of the Beholder
defaults to enabled and to `StartInThirdPerson`, and on a page with no
Morrowind third-person body `eotbHidesWeapon()` hid the arm outright.)
No record before this one says the hands lane was seen live; MAP3 left
the pose to be tuned in the game and the bone tuning never landed.

**The change.** `player/mwView.js` gains `mwViewFirstPerson()`: INTO THE
HEAD NOW, for whichever body answers. The EOTB lane takes the mod's own
`ToggleOffset(false)`. The Morrowind lane takes the camera's restore
door, not the wheel's crossing - the wheel queues the first-person
boundary behind the upper body (camera.cpp:225-232) and the map is
opening this frame - and moves the rig with it (`fpArm.setViewMode
('first')`), so the arm is first-person before the window's first tick
asks. The remembered zoom distance is kept: a wheel out afterwards lands
where the player left the camera. `scenes/world.js`'s
`buildTravelMapWindow` calls it first, then builds the window the skin
wears - the held map or the classic sheet. It stands in the BUILDER and
not at the doors: every door into the map (the key, the journal's goto,
the guild's teleport) reaches the builder, and only after its own
refusals (enemies near, the sun, a pending offer), so the camera moves
for a map that opens and never for a press that was refused. The view
is not put back when the map closes - Mac asked for a transition, and
the wheel is where it was.

**Pins** (`test/mappov.test.js`, 4): the Morrowind lane goes first at
once with nothing queued, keeps its distance and moves the rig, and a
view already first is left alone; the EOTB lane through its own toggle
with the other camera untouched; by source, the builder is the one mint
of the window and the only home of the move, both doors build through
it, the key's door holds no copy and its refusals stand above the build;
the seam's door takes the restore and never the wheel.

**Mutants** (`tools/mutants/mappov.json`): 7 mutations, 7 dead - the
EOTB toggle reversed; the EOTB lane never moving; the Morrowind test
inverted; the wheel in place of the restore; the rig left behind the
camera; the builder forgetting the move; a copy of the move at the door
above the refusals.

---

## MW-MAP1 - the Morrowind hands on every sheet, not only the V key's (2026-09-22, a player through Mac)

> Got word ... the morrowind map isnt showing

There is no separate Morrowind map. "The Morrowind map" is this window's
HANDS LANE (MAP3): when the Morrowind arm is the thing on screen, the
sheet is handed to the rig and the ink is laid over the paper's projected
corners; otherwise Mac's painted gauntlets stand. The lane opens on one
thing - the `holder` the host hands the window, the arm's four doors -
and MAP3 wrote that holder INLINE in world.js's TRAVEL map builder, the
only door there was at the time. Then EM3 and EM4 gave the same window
its M-key doors (the town plan through ui/townMapDoor.js, the dungeon
and building automaps through ui/automapDoor.js), and none of those
passed a holder. So a player with Morrowind arms saw the Morrowind hands
on V outdoors and the painted gauntlets everywhere else - in a town, in
a dungeon, in a building - which is most of the times a map is opened.
MAP3's own record said it: "a host with no holder at all (every scene
but the world) is the sprite lane", written before the other doors
existed and never revisited when they were.

**One holder, off the rig, on every door.** `sheetHolderOf(rig)` in
combat/weaponRig.js is the holder - the four doors (would the arm draw,
take the sheet, let it go, where are the corners), with AUDIT-MAP2's law
kept (corners only from a frame the arm DREW) - handed the rig as a
FUNCTION so a host whose rig can be swapped answers live and never a
snapshot. The two doors pass `deps.holder` through to the window, and
every host with a rig hands it to every door it opens: world.js's V and
M, exterior.js's M, the dungeon's M off the dungeon rig, a building's M
off the INTERIOR arm (worldModes' `interiorWeapon`). The one host with
no rig - the `?interior` probe - hands none and keeps the sprite lane,
honestly. And each of those doors goes INTO THE HEAD first
(`mwViewFirstPerson`, MAP-POV's law: the map is read in the head, and
the arm must be first-person before the window's first tick asks it),
which MAP-POV had done for the V key alone.

The fix is small because the pieces were all there; what was missing was
one seam written once. test/mwmap1.test.js (3): the holder's four doors
against a live, swapped, absent and doorless rig; the two doors carrying
the holder into a real HeldMapWindow and null without one; every host by
source. tools/mutants/mwmap1.json: 7, 7 dead; MAP3's two holder mutants
re-aimed at the shared holder, still dead.

## MAP-TOGGLE + MAP-FIELD8 - the sheet is a switch, and the fourth painting (2026-09-22, Mac)

Mac asked whether the enhanced map was a toggle; it was not - the three map doors (`ui/travelMapDoor.js`,
`ui/automapDoor.js`, `ui/townMapDoor.js`) forked on `isEnhanced()` alone, so DFU's own maps came back only with
the whole classic skin. "Yes needs to be a toggle. Along with this change, replace the current paperdoll
integration with this replacement" - and a fourth painting.

**MAP-TOGGLE.** One gate, `ui/mapSkin.js`: `enhancedMapOn()` is the Features row `enhanced-map` (Sight,
enhanced-only, prefs `heldMap`, on by default - the sheet is what the enhanced skin has drawn since MAP1);
`heldMapChosen()` is the skin AND the switch; `heldMapWorn()` is chosen AND a document to mount in. The three
doors read the gate and ask no skin of their own: the travel door's readiness is `heldMapChosen() ||
travelMapArtLoaded()` (the sheet reads no ARENA2 art, so it is ready wherever it is chosen), the automap's and
the town map's `heldMapWorn() || <their art>`. Off under the enhanced skin is DFU's three windows exactly - the
classic art is preloaded on every host whatever the skin (ROAD-C c2's shape), so the classic arm is ready the
moment the switch flips. Read on every open, never cached. The classic skin never wears the sheet: the row's
kinds say `enhanced`.

**MAP-FIELD8.** The painting in the hands is the fourth (`public/art/held-map.png`, 1648x1086 - wider than the
third's 1448, the same height; a real alpha channel, 58.7% clear). Every constant that is a measurement of the
picture was re-measured by `tools/heldMapArtProbe.mjs` (20 checks, all passing): `SPRITE` 1648x1086; `PAPER`
x 0.226-0.775, y 0.196-0.704 (the sheet measures x 364-1285, y 206-772, and the ink overhangs it by 0 px);
`THUMB_ZONES` 0.19-0.30 and 0.70-0.81 across, 0.40-0.725 down (the thumbs rest a little higher and reach less far
in than the third's); `SPRITE_ART_FOOT` 0.872 (the lowest opaque row is 946); `CUFF_BAND` 0.827, in the 24-row gap
between the hand's silhouette (ends by 0.8158) and the cut cuffs (begin at 0.8379), eleven rows either side -
the first draft put it at 0.867 off a cruder measurement and the probe refused it; `HAND_CHROMA` stays 75 (87.9%
of the thumb under the line, 66 of 396,440 sheet pixels). The stage is the sprite's own aspect (3:2 now, not
4:3); on a 16:9 screen the sheet still fits at `HELD_MAP_HEIGHT`, and on a narrower one the height gives way as
before. The Morrowind hands lane (MAP3/MW-MAP1) is untouched: it is the arm's own lane, entered only when a
holder says the arm is drawn.

Pins: `test/maptoggle.test.js` (4, driven: the gate on/off/classic, the doors handing out the held sheet or the
classic null against a live switch, the row, the fourth painting's numbers against the file's own header);
`test/heldmap.test.js` U61 re-aimed to the gate. `tools/mutants/maptoggle.json`: 9 records, 9 dead. Not
verified in a browser beyond the probe.

## MAP-LAG - what lies under the ink is kept too (2026-09-23, Mac) - REMOVED by DISC17-C

A sheet may have something under its ink that must not be inked with it.
The world's weather regions were 85 ms and more a frame, because they
rode the kept static layer, whose key is the view. The sheet contract
(`mapStrip.js` SHEET_MEMBERS) gains `paintUnder(ctx, env)`. The window
calls it every frame, before it lays the kept ink, and marks the static
paint with `env.underlay` so the sheet leaves that part out of the ink.
The town and the automap draw nothing there. The world sheet lays the
weather's own raster (`_drawWeatherUnder`): moved by a pan, stretched by
a zoom, inked again crisp when the view has held still, and inked as a
job a slice a frame. With no kept layer the sheet inks the regions as it
always did. `01-Overview/Field-Bugs-2026-09-23.md`, MAP-LAG.

## DISC17-C - the weather off the map (2026-09-24, Mac)

"Remove the enhanced map weather enhancements entirely." The world sheet
draws the bay alone again: WEATHER3e's regions, glyphs and legend, the
hover's weather and forecast, and MAP-LAG's raster, job and resting
forecast are gone, with `ui/weatherLayer.js`. The sheet contract loses
`paintUnder` (the town's and the automap's were empty), and the hover is
written inline in the pointer's move as EM1/EM3 had it. `heldMap.js` is
its pre-weather self plus MAP-FIELD8 and MAP-FIT1. Pinned by
`test/disc17.test.js`. `01-Overview/Field-Bugs-2026-09-23.md`, DISC17.
