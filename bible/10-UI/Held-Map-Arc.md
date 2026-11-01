# The held map

The enhanced skin's map is a pair of gauntleted hands holding a parchment (`public/art/held-map.png`), with the world
inked onto the paper at runtime: coast, borders, roads, places and names in a hand-lettered face. The player pans,
zooms, filters and picks a destination on it. On the Morrowind body the first-person arms hold the sheet. The same
window carries the town and dungeon sheets (`10-UI/Enhanced-Maps-Arc.md`). The classic skin keeps DFU's travel map.

## How it works

**The window** (`src/ui/heldMap.js`, opened on the enhanced skin by `src/ui/travel/travelMapDoor.js`). The sprite
(`SPRITE`) fills a stage at the sprite's own aspect, bottom-anchored, up to `HELD_MAP_HEIGHT` of the screen. The ink
canvas lies on `PAPER`, the measured sheet; the thumbs, which rest on the sheet, are keyed back over the ink from
`THUMB_ZONES`. Drag pans, the wheel zooms toward the cursor, arrows and +/- do the same, and `clampView` keeps the map
on the paper (`SCALE_MAX` 14). The sheet rises and lowers over 0.3 s. Travel is the host's own journey; there is no
flight.

**The ink** (`src/ui/ink/inkMap.js`). `buildInkModel` is pure: the coast from the land's boundary along pixel edges,
smoothed; borders between land pixels of different regions; roads and tracks from Hazelnut's arrays only (the port's
generated Bay network is never drawn here); high ground as carets; names placed greedily by rank, an overlap dropped.
Zoom bands: far (under 2.4 paper px per map px) inks coast, borders, roads, cities and region names, with tracks as a
hair; mid (under 5.5) adds towns, temples, dungeons and tracks; near adds everything discovery admits. Place marks are
their own layer (`syncMarksLayer`), so a pan does not repaint them. Nothing is a painted asset.

**The card and Travel Options.** A click on a mark picks it; the card beside the paper uses the same pure laws as
the classic window (ship restriction, the teleport fee asked with the pick). Travel Options' additions are ink: the
ports filter, the middle-click mark, the I key's building list, the coordinates click on a bare pixel, H help and the
resume prompt.

**The key.** DFU's four filters stand on the window's foot, each pressing the classic window's own flip
(`flipTravelMapFilter`) on the same live store, so the skins agree and the save carries it. Each kind is inked in its
classic dot's hue walked toward the pen (`MARK_INK_MIX`), read at runtime from FMAP_PAL.COL. A Players row (one switch
shared with the Overworld, `playersOnMaps`) hides other players. Kinds the current band does not ink are dimmed.

**On the sheet:** the party, travelers in their kin's color, raids and the gate with hover cards
(`src/ui/eventMapMarks.js`), carriage towns, a town's economy card on hover, and online an ore card on bare ground.

**Witnessed ground.** Online, while the professions are open, the world sheet washes each confirmed pixel in view in
copper, over the ink and under every ring (`src/ui/witnessMapMark.js`, the host's `witnessed`). It asks every 64-pixel
tile the view touches by its key, nearest the middle first, so a province and the sea past the Bay read as the Bay does
(the service's side: `bible/11-Multiplayer/Scale-Arc.md`). The wash is a kept bitmap on the kept layer: a pulse frame
paints none of it, and a pan frame blits it. The legend names it, and the key's Ground row hides it (`filterWitnessed`,
kept in the save). The far band draws none and dims the switch. Ground confirmed today shows the next UTC day, but a
pixel this page hears confirmed shows at once. The classic travel map draws none: its marks overwrite its place dots,
so a wash would hide them.

**Tamriel.** The world sheet zooms out past the Bay onto the whole continent (`src/ui/tamrielInk.js`, Features
`tamriel-map`, `tamrielMapOn`). Every mark reader reads one box (`_marksBox`: the continent's frame when shown, else
the Bay's). Waypoints stand anywhere on the world grid. Ports past the Bay carry their anchor, and the Ports filter
works there too.

**Find past the Bay.** While the continent shows, the Find box lists every listed place past the Bay
(`tamrielFindRows`), found or not, and a pick there is a journey as on the Bay. The countryside's places and the lairs
are rolled, not listed, so the box finds one once the player has found it, as the Bay's box finds a discovered place
(`src/systems/discovery.js` `foundMadePlaces`, `tamrielFoundRows`). A place found with the sheet open is in the box at
once. One name can stand for many places past the Bay: they come nearest first, each with its way from the player
("8.2 km E", `src/systems/eventBoard.js` `eventWay`).

**Scale.** `src/ui/map/mapScale.js` `mapUiScale`: Auto is the screen's height over 1080, held to 1 to 2; the player
may set 0.75 to 2 ("Map text and icons", pref `mapScale`).

**The arms.** On the Morrowind body the first-person arm takes a held pose (`src/combat/heldPose.js`) with a paper
piece; the ink is laid over the piece's projected corners (`src/ui/quadMap.js`). Opening the map from third person
moves the view into first person first (`mwViewFirstPerson`). On the classic body the weapon rig stops drawing the
shield, torch, widget and weapon sprite while a map holds the screen (`sheetWindowUp`, read per frame from each host's
own slot; `holdsScreen` is constant on the window, while `isTravelMap` says only whether travel is offered).

**Pointer capture** goes through `src/ui/pointerCapture.js`, so a refused capture (a pad's synthetic pointer on
Firefox) never throws.

## Rules

- A complete replacement of the enhanced map: the map drawn by hand on Mac's sprite of held hands, with roads, zoom
  and destination picking; Morrowind gets its own held pose (Mac).
- The sprite is Mac's and carries no ARENA2 pixel; it is the only picture this map ships. The map is computed.
- One sheet for the whole map, not pages.
- The enhanced map is a Features switch (`enhanced-map`, pref `heldMap`, on): off brings back DFU's three windows on
  the enhanced skin (Mac). `src/ui/map/mapSkin.js` holds the gate: `enhancedMapOn`, `heldMapChosen`, `heldMapWorn`.
- Opening the map from third person moves to first person first, on both bodies (Mac).
- No weather on the map (Mac).
- Hover tooltips for world events (Mac).
- A filter for players on the world map (Dudey).

## Daggerfall Unity

DFU's travel map (`DaggerfallTravelMapWindow`) is a region picker with pages and four filter buttons. We replace it on
the enhanced skin with one inked sheet, keep its filter store and flip, its discovery law and its dot colors, and keep
Travel Options' additions. The classic skin keeps DFU's window and Travel Options' classic additions.

## Code and tests

- `src/ui/heldMap.js` - the window, key, marks and Find me
- `src/ui/ink/inkMap.js` - the world ink and bands
- `src/ui/tamrielInk.js` - the continent
- `src/ui/witnessMapMark.js`, `src/net/witnessTileLaw.js` - the witnessed ground's wash and its tiles
- `src/ui/map/mapSkin.js`, `src/ui/map/mapScale.js` - the switch and the scale
- `src/combat/heldPose.js`, `src/ui/quadMap.js` - the Morrowind arms
- `test/ui/heldmap.test.js` - the window
- `test/ui/map/maptoggle.test.js` - the switch and the sprite's measurements
- `test/ui/fb0929d_mapkey.test.js` - the key and mark colors
- `test/ui/eventtip.test.js` - event hover cards
- `test/ui/mappan.test.js` - the marks layer
- `test/ui/bayleft_marks.test.js`, `test/ui/bayleft_find.test.js` - marks, waypoints and Find past the Bay
- `test/ui/findfound.test.js` - found places past the Bay in the Find box, and their order
- `test/ui/witness_map.test.js`, `test/ui/fb1031_witness.test.js` - the witnessed ground, its tiles and its wash
- `test/combat/map3_heldpose.test.js` - the held pose and weapon gate
- `test/ui/rpt1026_client_capture.test.js` - pointer capture
- `tools/heldMapProbe.mjs`, `tools/heldMapArtProbe.mjs` - Chromium probe and the sprite's measurements

## Open

- `tools/heldMapProbe.mjs` fails some of its own checks (the stage, the sprite and thumb keys, the open sea, the hover
  cursor) and still looks for a box that moved to the notice panel.
