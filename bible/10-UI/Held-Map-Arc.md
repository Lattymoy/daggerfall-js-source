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

## Pins

None yet. MAP1 opens them.
