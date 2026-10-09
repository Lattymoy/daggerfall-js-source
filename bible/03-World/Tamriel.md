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
- **The continent flag.** Past CONTINENT_BELOW (0.85) of the Bay's own fit the world sheet hands the Bay's painter
  `continent: true` beside the band (`ui/inkMap.js`): the carets thin to CARET_STEP.continent (12, the highBands key
  of that name) and no region names are lettered - the Bay is a hand's width there and its sixty-two names would be a
  smudge; the continent's province names stand instead. The band stays the band's (far, at any real paper: the roads
  at the far width, no tracks, the cities alone). Not a ZOOM_BAND, which are pure on the scale: the Bay's fit depends
  on the paper, so the sheet decides it.
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
page says so. TAMRIEL3 added a fourth step: the trace and the fit the world host makes at boot, run here on the same
files - the fit's numbers printed beside the authored defaults, the seam measured again on the trace, and
`tamriel-shots/trace.ppm` (the traced land tinted by province, the sea blue, the fitted Bay's rectangle black).

## Recorded departures and readings

- Daggerfall's travel map shows the Bay and nothing past it; DFU's the same. The continent on the enhanced sheet is
  the port's own (Port-Ledger section A, TAMRIEL1).
- The Bay's edge classification (which runs of each edge are land) is committed by the rings and measured by the
  probe; where they disagree past STITCH_REACH the authored chain ends where the Bay's rectangle cut it and the Bay's
  own coast ends on its edge as it always did.
- The sheet's `band` chip still says `far` on the continent: the chip reads ZOOM_BANDS, the painter the band and
  the flag beside it.

## Pins

`test/tamriel.test.js` (18): the frame's scale against the wire's own units and its inverses; the topology whole
(every edge coast or border, the tables equal to the rings, a dropped vertex caught), every city in its province and
beyond the Bay, one capital a province; the clip's four cases, the fret's kept vertices and calm, the stitch's edge,
reach and once-each, the model's budget and cut ends ON the Bay's ends, one model a coast array; not one canvas call on
the Bay, the paint's order and faces off it, the hover's three answers; the raster's planes, the peak over the snowline,
determinism, the compose on and not beside the Bay; the clamp's origin, the continent flag's thinnings, the switch
and its kill door; the source sweeps (the paint after the Bay's ink and under the zone map's, the switch read once, the
layer reading no game data, BAY_ORIGIN named once). `test/heldmap.test.js` TAMRIEL1 window (+1): the limits carry the
frame, the rest is the Bay's fit, the pan out to the frame's edge, the continent inked only past the Bay, the hover
beyond it and nothing picked there, Off as it was. Mutants `tools/mutants/tamriel.json` (37: 34 dead, 3 equivalent as recorded), and map1's four clamp and
band records re-aimed by content.

Merged to main 2026-10-08 as #702 at Mac's word ("Skip ci and merge"), with the CI-skipping marker in its merge title; the deploy that skipped - and again under #703, whose merge message quoted the marker - ran from #704's merge.

## TAMRIEL2 - the land mass, streamed (2026-10-08)

Mac, after the question of populating it: *"Lets worry about this later and only implement the land mass."*

The streamed world goes on past the Bay's edge. Daggerfall grows every tile from two bytes a map pixel - WOODS.WLD's
height and CLIMATE.PAK's climate - through DFU's own kernel, and the kernel asks for them through three reads of the
WoodsFile (`getHeightMapValue`, `getHeightMapValuesRange1Dim`, `getLargeHeightMapValuesRange`) and one of the MapsFile
(`getClimateIndex`). `world/tamrielGround.js` answers those reads for any pixel of the frame: the Bay's own on the Bay,
the authored continent's past it - its height by the one law the raster reads (the sea 0, the shore rising to the
plain over PLAIN_REACH from the coast, a range lifted toward SNOW_BYTE by its gain, a lattice hash of ±2), its climate
the province's (the Ocean's at sea), its large-map detail a lattice hash of small bytes. Nothing stands on it: no
towns, roads, dungeons or regions - the later use.

- **THE BAY IS NOT MOVED BY A BYTE.** The kernel's windows reach 2 pixels past a pixel, and at the Bay's edge WoodsFile
  CLAMPS them to the edge's own pixel. `groundWoods(woods)` - a prototype child of the reader, so the two range reads
  built on the two it overrides answer the continent too and nothing else about the reader changes - keeps the SEAM
  band (SEAM_PX, 2) at exactly the clamped read, and blends the authored ground in from the edge's byte over BLEND_PX
  (12) after it. `test/tamriel2.test.js` holds every Bay pixel's samples, edge and corner included, byte-identical
  with the ground composed and without.
- **The host** (`scenes/world.js`): `woods` is rebound to the composed reader at the mount, after the boot repairs
  (the coastal dilation, the location smoothing, the sync of the worker's bytes) and before the terrain client copies
  the bytes - so the fallback kernel, the promotions, the far ring and every other reader see one reader. The worker
  composes its own copy the same way (`terrainGenWorker.js`, told by the client off the reader's own
  `isTamrielGround`). `maps.getClimateIndex` is composed (`groundClimateIndex`: the Bay's own, dilation and all, on
  it). `StreamingWorldState.frame` is the continent's box and `streams` is what the load list and the range ask;
  `onMap` stays the map's law for World of Daggerfall's slots and every reader of the data. The far ring is handed
  `byteAt` for the pixels past the map. World of Daggerfall's picks and Deep Waters' promotions are held to the Bay.
- **The switch.** The Features row `tamriel-land` ("Land beyond the Bay", the world group, on by default, the player's
  own online), `scenes/shared.js` `tamrielLandOn` on the enhanced skin, `?tamrielland=off` the kill door, read once as
  the world mounts. Off - and on the classic skin - the edge of the world is DFU's: empty.
- **Readings, honest.** The region past the Bay reads as `getRegionIndexAt`'s clamp (0, the Alik'r Desert) - DFU's own
  clamp, kept; weather, quests and factions key on it and see the Alik'r. Online a player beyond the Bay is seen by
  whoever stands near, and the Overworld routes over the land there (TV-BEYOND, `01-Overview/Field-Bugs-2026-10-09.md`:
  the wire and the planner held the Bay's bounds, and the field found both). The sea past the Bay is the kernel's own water tiles (Deep Waters' bathymetry is the Bay's). The Wrothgarians
  and the Dragontails begin in WOODS' bytes and continue in the authored law past the edge; the seam band and the
  blend join them, and the probe's seam report says where the data and the authored shape disagree.
- **Performance.** A pixel's ground past the Bay costs a point-in-province test, a coast distance over ~100 edges and a
  range distance over 12 spines, once a pixel, cached (GROUND_CACHE_MAX, dropped whole); the kernel's cost is the
  kernel's. On the Bay the composition is one subtraction and a compare a read.
- **Pins.** `test/tamriel2.test.js` (10): the law (sea, shore, plain, Red Mountain over the snowline, the noise
  floored), the cache and the climate, the composition to the byte on nine Bay pixels, the seam and the blend, the
  range reads through the overrides, a whole pixel beyond the Bay through the kernel (Skyrim's trees; the Eltheric
  under it), the raster as the same law, the stream's frame and load list, the ring's bytes past the map, the worker's
  word and its purity, the switch and its row, the host's seams by source. Mutants `tools/mutants/tamriel2.json` (22: 21 dead, 1 equivalent as recorded - the cache's key, one key a pixel whichever it is).

## TAMRIEL2-WORKER - the freeze on going outside (2026-10-08)

The field, within the hour of the deploy: *"game freezes when I go outside."* The ground beyond the Bay is read by the
terrain WORKER, whose import graph is pure by law (EV7); TAMRIEL2 had taken two helpers from their "one home" in
net/ - the gate's PIXEL_M (`net/gateLaw.js`, which imports `net/wire.js`) and the strike's segmentDistance
(`net/gateStrike.js`) - and through them the worker's bundle grew by twenty modules of the relay's law, and the world
froze on its first exterior build. The helpers live in pure homes now: `world/segment.js` (the one segment distance,
which the gate's strike imports too) and the frame's own kilometres a pixel, held to the wire's units by its pin. The
pin that would have caught it walks the worker's whole graph at any depth and holds every module to world/ and
formats/ (`test/tamriel2.test.js`); the frame, the geography and the ground are swept for any import of net/.

## TAMRIEL3 - the map from the player's own picture (2026-10-08)

Mac, with the deploy in hand: *"Can we fix the map? It doesnt look like the map thats in daggerfall."* It did not:
TAMRIEL1's geography was drawn from memory of the lore map, and the lore map is not the one in the box. Daggerfall
carries its own map of Tamriel - TMAP00I0.IMG, the race screen's picture, and TAMRIEL2.IMG, its picker, whose palette
index IS the province (CreateCharRaceSelect.cs:30-31,64) - and the port already traces the picker at runtime for the
chargen's province map (`ui/provinceMap.js`, OVH). So the continent is now TRACED from the player's own two files when
the world boots, and the Bay's place on that picture is FOUND rather than authored. Nothing of either file ships: the
trace is made on the player's machine from the player's files, as the chargen's map is, and `?tamrieltrace=off` keeps
the authored shape (no Features row: a door for a day the trace reads a picture wrong, not a choice).

- **The trace** (`ui/tamrielTrace.js`, `traceTamrielPicture`). The picker's eight masks are the eight homelands'
  own shapes to the pixel (the Iliac Bay is the gap between the Breton and the Redguard mask, the Inner Sea the hole in
  the Dark Elf one), so a pixel is LAND of a province where the picker names the province - each mask's pieces off
  the picture's edge (unless every piece touches it: a map painted to its frame), each at least SPECK_PX (12) pixels
  (a painted word over the sea is not an island). The painting, read on ITS palette (MAP.PAL, ImgFile's paletteName
  for it, the way the sky's is read), is a parchment whose sea is the parchment itself and whose whole coast - the
  Imperial Province's included - is one thin BLUE line (`provinceMap.js seaIndices` finds its indices). The Imperial
  Province, which no race claims, is what the masks and that line ENCLOSE (`enclosedRemainder`): the masks and the
  line, grown a pixel (a hand-drawn line has one-pixel gaps), bar a flood from the picture's edge, and the largest
  unclaimed region the flood never reached that touches a mask is the ninth province - the line's own pixels never
  part of it, so a pocket inside a mask (the Inner Sea) and a ring in the sea (the helmet) stay sea. The two files
  must share a grid, or the trace is null and the authored shape stands.
- **The land module** (`world/tamrielLand.js`): the trace installed (`setTamrielTrace`), a chamfer 3-4 distance field
  to the nearest sea made at install, a version that moves on every install (the ink's and the held map's static key
  read it), and the two reads everything else asks - `provinceKeyAt` (the trace's by id, the authored rings' else;
  null at sea and off the grid) and `coastDistanceAt` (the field, bilinear; the authored edges' else). PURE: typed
  arrays in, answers out, so the terrain worker holds the same module. `PROVINCE_OF_ID` is the picker's law: 1..8 the
  races in RACE_TEMPLATES order, 9 the Imperial Province.
- **The fit** (`fitBayToPicture`): the Bay's own land (WOODS.WLD and CLIMATE.PAK through the one water law,
  `overworldModel.js isWaterPixel`) is laid on the picture's grid at each candidate scale (16..21 Bay pixels a picture
  pixel, the authored 18.75 among them) and offset (24 picture pixels each way round the authored place), four samples
  a cell and the majority, and the pair with the greatest FRACTION of cells agreeing wins - a count would favour the
  smallest scale, which lays the most cells (the pin that found it: `test/tamriel3.test.js`). Deterministic; ~40M
  compares, once, after the travel art, off the boot's critical path.
- **The live frame** (`world/tamrielFrame.js`): BAY_ORIGIN and PIXELS_PER_PICTURE_UNIT are the DEFAULTS now; every
  conversion reads `tamrielFit()` - the fit the host installs (`setTamrielFit`, null or a bad pair the defaults
  again) - and `tamrielSize()` the picture at the live scale. The raster, the ground, the ink and the held map's frame
  all move with it.
- **The ink on the trace** (`ui/tamrielInk.js tracedChains`): the coast is the land mask's pixel edges linked (the
  Bay's own shore law, `inkMap.js boundarySegments`), the staircase of a 15 km pixel simplified and its corners cut
  at the picture's own scale; a border runs where two land pixels change province; a province's name hangs at its
  clearest point (`provinceMap.js labelPoint`), and a province the picture has no land for is not named. The authored
  cities keep their places where the trace agrees, move up to CITY_SNAP_PX (10) onto their own province's land, and
  are left off past it (a town the picture puts in the sea is not drawn in the sea); a range's carets stand only on
  the picture's land; a sea's name on the picture's land is dropped; the rivers stay authored. The model reports
  `traced` and `version`, and `tamrielInkFor` rebuilds when the version moves.
- **The ground and the raster** read the land module (`world/tamrielGround.js authoredHeightByte`,
  `tamrielClimateAt`; `world/tamrielRaster.js` at the live scale) - so with the trace in, the streamed land past the
  Bay is the picture's land, textured by the picker's province, and the sea where the picture paints sea.
- **The worker** is handed the trace and the fit once, after the boot (`terrainGenClient.js setTamriel`: copies of
  the two arrays transferred, the fit beside them; the fallback kernel's own modules set the same way, the ground's
  cache dropped on both sides). `terrainGenWorker.js` sets its own copies on the `tamriel` message and drops its
  cache. The worker's graph stays under world/ and formats/ (TAMRIEL2-WORKER's pin walks it).
- **The host** (`scenes/world.js`): after the travel map's art, `preloadTamrielTrace` reads the two files through
  ImgFile with the boot's own `fetchBytes` and palette, the fit is made over the composed reads
  (`maps.getClimateIndex`, `woods.getHeightMapValue` - the Bay's own bytes, after the boot repairs), both go through
  the client, the stream's frame is reset at the new fit, and the console says what was traced and where the Bay
  fitted. A missing file or a trace of nothing leaves the authored shape standing and says so.

**The first sight of a real ARENA2** (the same night, Mac: "Can you show me a png"): the probe's fourth step was run
on the ARENA2 of the freeware Daggerfall CD (archive.org's image, read into the session and never into the tree - the
doctrine holds). The law this slice SHIPPED with (#706) read the sea as blue and the Imperial Province as the chargen's
`inlandRemainder`: on the real picture the sea is parchment, only the coastline is blue, and the first trace was the
eight masks as islands with 280 pixels of Imperial Province - the deploy showed that for the hour it stood. The law
above is what the picture says: 26,423 land pixels of 64,000, the Imperial Province 5,549 of them, every province's
shape the picker's. The fit lands the Bay at picture (45, 56) at 18.5 Bay pixels a picture pixel (the authored
guess was (46, 52) at 18.75), with 77% of its cells agreeing - the painting's Iliac Bay is a cruder, more diagonal
inlet than WOODS.WLD's, and the score surface round the best is flat within 4% over ±3 pixels. The seam between the
Bay's own coast and the traced one disagrees along 516 edge pixels (the authored shape, tuned to the Bay's edges, 265):
the stitch joins what it can within STITCH_REACH and the rest meets at the Bay's rectangle, as TAMRIEL1 said it would.
A reading for the chargen (OVH): `provinceMap.js`'s `seaIndices` and `inlandRemainder` read the same blue sea the
picture has not; its inert ninth is held by INERT_REGION's fallback, not by the remainder. What the sheet shows
before the trace lands (a few hundred milliseconds after the world mounts) is the authored continent; the static key
repaints it the moment the trace is in.

### Pins

`test/tamriel3.test.js` (14): the pieces' connectivity and edge, the race ids; the trace over a synthetic picture
and picker drawn by the picture's own law (parchment sea, a blue line round the land, exact masks): the enclosed
remainder touching two masks, a one-pixel gap in the line closed, the line sea, a pocket in a mask sea, a ring in the
sea that encloses more than the Imperial Province sea, a mask over the edge cut, a speck dropped and SPECK_PX kept,
ink over the sea, the lakes, the shapes refused, a province painted to the frame kept; the preload's file names, the
painting's own palette by source, the chargen's remainder not called, and the palette reader; the distance field's chamfer (the diagonal 4/3 both ways) and install, the version; `provinceKeyAt` and
`coastDistanceAt` on the trace (the land mask deciding, off the grid not the next row, bilinear) and off it; the fit
exact over a Bay cut from the fixture (the fraction over the count, the majority under a speckle, candidates off the
picture skipped), the defaults named; the live frame's every conversion and its defaults; the ground and the raster on
the trace (the Desert's Hammerfell, the first and last land cell at the live scale); the traced chains (five coast
rings, one border coast to coast, the labels, the points simplified), `placeCity`'s reach to the pixel and nothing
snapped on the authored shape; the built model on the trace and its rebuild; the client's post (copies, transferred,
the cache dropped), the worker's arm, the land module pure; the door; the host's seams by source. Mutants
`tools/mutants/tamriel3.json` (45: 45 dead).

