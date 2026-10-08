# Tamriel - the whole continent round the Bay (TAMRIEL1)

Opened 2026-10-08. Mac: *"I want to talk about building the entirety of tamriel that connects accurately to
Daggerfall. Not actually traversalable but used and connected as a gigantic map that cam be used for later use and be
seen by players ingame"*, then *"You make the decisions and ensure this is as detailed as possible. Dont come back
until you are finished. Performance should also not be affected."*

The Iliac Bay is a window: Daggerfall's 1000 x 500 map ends at its edges with land cut off north, south and east and
the Eltheric open to the west, and nothing in the game ever said what lay past them. TAMRIEL1 lays the rest of the
continent round it - on the Bay's own grid, at the Bay's own scale, joined to the Bay's own coast - as a map the
player can zoom the enhanced sheet out onto, and as a frame a later slice can stand a place on. Nothing beyond the Bay
is walked, travelled, streamed or picked.

## The decisions, taken 2026-10-08

1. **Daggerfall's Tamriel.** The 1996 continent, the one `CreateCharRaceSelect` shows: nine provinces, SUMURSET
   spelled the game's way, the Imperial Province for the heart of it (`ui/provinceMap.js` PROVINCE_NAMES and
   INERT_REGION, the names this page's data matches). Where later games moved a coast, the shape that joins the Bay's
   own data is the one kept.
2. **Authored, ours.** TMAP00I0.IMG is game data and a trace of it is a render of game data (Port-Doctrine): the
   outlines are drawn by hand from the lore map, on the picture's GRID (320 x 200) so a local probe can lay them over
   the player's own picture and the numbers can be corrected from it. The precedent is `ui/introMap.js`: authored
   geography, nothing of the game's rasters. The classic travel map is untouched - it is DFU's.
3. **One grid, one offset, no scale.** A Tamriel pixel is 819.2 m, the Bay's own (MapsFile's 32768 world units at 40 a
   metre). The continent is 6000 x 3750 of them (4,915 km by 3,072 km) and the Bay stands in it at BAY_ORIGIN; every
   coordinate the game keeps stays what it was, and a point of the Bay is a point of Tamriel by one addition.
4. **Seen on the held map, not travelled.** The enhanced world sheet (`ui/heldMap.js`) zooms out past the Bay's fit
   onto the continent and pans to the frame's edge; a hover names the province, a capital or the sea; a press picks
   nothing. On by default, the Features row `tamriel-map` (prefs `tamrielMap`), `?tamriel=off` the kill door, read
   at open.
5. **No cost on the Bay.** The continent is built once a data set and painted only onto the sheet's kept static layer,
   and only when the view reaches past the Bay's rectangle - one rectangle test while it does not. Measured in node:
   the build 13-15 ms once; a continent-wide static paint ~8 ms of canvas calls; on the Bay, zero calls.

## The frame (`world/tamrielFrame.js`)

| Constant | Value | Measured or authored |
|---|---|---|
| PIXEL_M | 819.2 m | MEASURED - MapsFile's, `net/wire.js` PIXEL_UNITS over 40 |
| PICTURE_W x PICTURE_H | 320 x 200 | MEASURED - TMAP00I0.IMG's own size (`ui/provinceMap.js` MAP_W/MAP_H) |
| PIXELS_PER_PICTURE_UNIT | 18.75 | AUTHORED - the Bay's 1000 pixels are a sixth of the picture's width |
| TAMRIEL_W x TAMRIEL_H | 6000 x 3750 | follows: 4,915 km x 3,072 km |
| BAY_ORIGIN | (862, 975) | AUTHORED - picture (45.97, 52.0): the west coast's notch under northern High Rock |

`bayToTamriel` / `tamrielToBay` are the one offset; `pictureToBay` / `bayToPicture` take the authoring grid to the
sheet's coordinates (the Bay at 0..1000, 0..500, the continent negative west and north of it); `tamrielFrameInBay` is
the box the sheet pans over; `inBay` is the data's ground. The two AUTHORED numbers are named in this file and nowhere
else (`test/tamriel.test.js` sweeps for a second copy), so the probe's correction is one edit.

## The geography (`world/tamrielGeography.js`)

- **A vertex table and rings over it.** Every province is a ring (or rings - Vvardenfell, Sumurset and Auridon are
  rings of their own) of NAMED vertices; a border is the run two rings share, spelled in each. `classifyEdges` holds
  the whole table: an edge in one ring is coast, in two a border between two provinces, anything else an authoring
  error - and the BORDERS table must be exactly the shared edges, the COAST loop exactly the unshared. A dropped
  vertex, a misspelt name or a ring left open goes red.
- **What is in it.** Nine provinces with their race, their CLIMATE.PAK climate (the raster's) and where their name
  sits; the mainland's outer coast of 77 vertices and three islands; thirteen borders; twelve ranges (a spine, a
  half-width, a gain toward the snowline - the Wrothgarians and the Dragontails begin inside the Bay's rectangle, where
  WOODS.WLD already stands them, and only their reach past its edge is drawn); six rivers (the Bjoulsae is the Bay's
  own); six seas; sixty-seven cities beyond the Bay, each province's capital marked (High Rock's, Daggerfall, is the
  Bay's), every one pinned to stand in the province it is listed under and outside the Bay's rectangle.
- **The Bay is a hole.** The vertices inside its rectangle (c70..c77, the inlet's rough shape) exist so the rings close
  and a point-in-province answer is right for the raster; they are never inked. The rings commit to an edge
  classification the probe measures the data against: the north edge High Rock, the south Hammerfell, the east land,
  the west open to the Eltheric in the middle.

## The ink (`ui/tamrielInk.js`)

- **Built once a data set** (`tamrielInkFor`, a WeakMap on the Bay model's own coast array): the coast FRETTED (one
  point a picture unit, displaced across the line by seeded value noise - `ui/introMap.js`'s own, one home - calm
  within FRET_CALM of the Bay's rectangle, every authored vertex kept exactly), CLIPPED to the outside of the Bay's
  rectangle (`clipOutsideRect`: cut exactly on the edge, a closed ring that never touches it kept closed, a ring's
  wrapping run joined) and STITCHED to the Bay's own coast (`stitchToBay`: a cut end on an edge is moved onto the
  nearest free Bay coast end on the same edge within STITCH_REACH, 40 pixels, 33 km, once each) - so the shoreline the
  player follows out of the Bay is the data's where there is data and ours past it. Then the borders, the rivers, the
  ranges as a lattice of carets across each band (thinned by zoom at paint, by lattice index, so a caret never lands
  under its neighbour), the provinces' and seas' names, the cities.
- **Painted in the Bay's hand** (`penOf`, exported for it - one pen, one cull): the shore's wash under its line, the
  borders dashed as the Bay's, the Bay's own edge a faint dotted frame so the player sees where the data's ground
  ends, the capitals at any zoom and every city once the sheet is in to the Bay's own scale, the province names in
  `spacedName`'s thin-spaced capitals (now the one spelling the Bay's region names use too), the seas in italic.
- **The continent band.** Past CONTINENT_BELOW (0.85) of the Bay's own fit the world sheet hands the Bay's painter
  CONTINENT_BAND (`ui/inkMap.js`): the cities alone as far, the carets at CARET_STEP.continent (12), the roads at the
  far width and no tracks, no region names - the Bay is a hand's width there and its sixty-two names would be a
  smudge; the continent's province names stand instead. Not in ZOOM_BANDS, which are pure on the scale: the Bay's fit
  depends on the paper, so the sheet names the band itself.
- **The hover.** `tamrielPlaceAt`: a city within CITY_HIT_PX, else the province, else the sea - "Skyrim : Solitude
  (beyond the Bay)", "Skyrim (beyond the Bay)", "Sea of Ghosts" - and null on the Bay's own ground, where the window's
  reads stand. A press beyond the Bay picks nothing: `_pickAt` was not touched.

## The window (`ui/heldMap.js`, `ui/inkMap.js`)

- The world sheet hands `frame` (the continent's box in the Bay's coordinates) and `_limits()` carries it as
  `mapW`/`mapH` with `mapX0`/`mapY0`; `clampView` takes the origin (absent, zero - every other sheet unchanged). The
  home view is the Bay's fit centred on the Bay (`homeView`), so the map still opens on the whole Bay; `-` and the
  wheel go out from there to the frame's contain. The zone map (WILD2) holds its own limits and the continent is never
  painted under it.
- The switch is read ONCE at open (`this._tamriel`), the Features row's "takes effect the next time a map is opened".
  Off is the sheet as it was: contain on the Bay, the clamp at the Bay's edge, a hover beyond it silent.

## The raster (`world/tamrielRaster.js`) - the later use

Nothing in the game loop calls it. `rasterizeTamriel({ cell })` lays the continent out in the Bay's own three planes -
WOODS' height byte (the sea 0, the shore SHORE_BYTE rising inland, a range lifted toward SNOW_BYTE by its gain, a
lattice hash so a plain is not a contour), CLIMATE.PAK's climate (the province's), a province byte (PROVINCE_NONE at
sea) - over the whole frame at a cell size the caller picks, scanline-filled; `composeBay` lays the Bay's own height
and climate over its rectangle (each cell on the Bay takes WOODS' and CLIMATE.PAK's byte at its centre; a -1 climate,
the edge of the data, is left). A later consumer reads one array and finds the data where there is data and the
authored ground past it. Deterministic; at cell 25 it is 240 x 150 in ~45 ms.

## The probe (`tools/tamrielFitProbe.mjs`) - local only

`ARENA2_PATH=... node tools/tamrielFitProbe.mjs` reads the player's own TMAP00I0.IMG, TAMRIEL2.IMG, WOODS.WLD and
CLIMATE.PAK and writes `tamriel-shots/overlay.ppm` (gitignored - a render of game data never ships): the picture as
grey with the authored coast in white, the borders grey, the Bay's rectangle black, every city a dot. Then two lists:
which race TAMRIEL2's byte names at each province's label and each city (CreateCharRaceSelect's own law), and the SEAM
- along each edge of the Bay, the runs of land and water the data says beside the runs the rings say, every
disagreement in pixels and kilometres, and how many of the Bay's coast ends the stitch joined. The three authored
things it corrects: BAY_ORIGIN and PIXELS_PER_PICTURE_UNIT in the frame, the vertices in the geography. It has not yet
been run on a real ARENA2 (none in the tree, by doctrine): the numbers are the lore map's reading until it is, and this
page says so.

## Recorded departures and readings

- Daggerfall's travel map shows the Bay and nothing past it; DFU's the same. The continent on the enhanced sheet is
  the port's own (Port-Ledger section A, TAMRIEL1).
- The Bay's edge classification (which runs of each edge are land) is committed by the rings and measured by the
  probe; where they disagree past STITCH_REACH the authored chain ends where the Bay's rectangle cut it and the Bay's
  own coast ends on its edge as it always did.
- The sheet's `band` chip still says `far` on the continent: the chip reads ZOOM_BANDS, the painter the band the
  sheet names.

## Pins

`test/tamriel.test.js` (18): the frame's scale against the wire's own units and its inverses; the topology whole
(every edge coast or border, the tables equal to the rings, a dropped vertex caught), every city in its province and
beyond the Bay, one capital a province; the clip's four cases, the fret's kept vertices and calm, the stitch's edge,
reach and once-each, the model's budget and cut ends ON the Bay's ends, one model a coast array; not one canvas call on
the Bay, the paint's order and faces off it, the hover's three answers; the raster's planes, the peak over the snowline,
determinism, the compose on and not beside the Bay; the clamp's origin, the continent band's four thinnings, the switch
and its kill door; the source sweeps (the paint after the Bay's ink and under the zone map's, the switch read once, the
layer reading no game data, BAY_ORIGIN named once). `test/heldmap.test.js` TAMRIEL1 window (+1): the limits carry the
frame, the rest is the Bay's fit, the pan out to the frame's edge, the continent inked only past the Bay, the hover
beyond it and nothing picked there, Off as it was. Mutants `tools/mutants/tamriel.json` (37: 34 dead, 3 equivalent as recorded), and map1's four clamp and
band records re-aimed by content.
