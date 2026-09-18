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
  first-person arms (`formats/mwFirstPerson.js`, `combat/fpArm.js`), a
  paper mesh, the rendered map as its texture, and the sprite lane kept
  for the classic body. The first custom rig change; its own record.

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
