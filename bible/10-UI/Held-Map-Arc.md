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
ports restriction and the teleport fee behave exactly as they do on the
classic window.

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

## Pins

`test/heldmap.test.js` (40): U61's carried laws (the walk, the height
and water laws, the buckets, the door both ways, the one construction
seam, the window's panel laws through a stub document, the source
sweeps) and MAP1's own - the coast fixture (a 2x2 island: eight edges,
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
