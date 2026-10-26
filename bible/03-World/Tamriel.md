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
   the player's own picture and the numbers can be corrected from it. The precedent is `ui/intro/introMap.js`: authored
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

## The frame (`world/tamriel/tamrielFrame.js`)

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
else (`test/ui/tamriel.test.js` sweeps for a second copy), so the probe's correction is one edit.

## The geography (`world/tamriel/tamrielGeography.js`)

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
  point a picture unit, displaced across the line by seeded value noise - `ui/intro/introMap.js`'s own, one home - calm
  within FRET_CALM of the Bay's rectangle, every authored vertex kept exactly), CLIPPED to the outside of the Bay's
  rectangle (`clipOutsideRect`: cut exactly on the edge, a closed ring that never touches it kept closed, a ring's
  wrapping run joined) and STITCHED to the Bay's own coast (`stitchToBay`: a cut end on an edge is moved onto the
  nearest free Bay coast end on the same edge within STITCH_REACH, 40 pixels, 33 km - 64, 52 km, since TAMRIEL4 - once each) - so the shoreline the
  player follows out of the Bay is the data's where there is data and ours past it. Then the borders, the rivers, the
  ranges as a lattice of carets across each band (thinned by zoom at paint, by lattice index, so a caret never lands
  under its neighbour), the provinces' and seas' names, the cities.
- **Painted in the Bay's hand** (`penOf`, exported for it - one pen, one cull): the shore's wash under its line, the
  borders dashed as the Bay's, the Bay's own edge a faint dotted frame so the player sees where the data's ground
  ends, the capitals at any zoom and every city once the sheet is in to the Bay's own scale, the province names in
  `spacedName`'s thin-spaced capitals (now the one spelling the Bay's region names use too), the seas in italic.
- **The continent flag.** Past CONTINENT_BELOW (0.85) of the Bay's own fit the world sheet hands the Bay's painter
  `continent: true` beside the band (`ui/ink/inkMap.js`): the carets thin to CARET_STEP.continent (12, the highBands key
  of that name) and no region names are lettered - the Bay is a hand's width there and its sixty-two names would be a
  smudge; the continent's province names stand instead. The band stays the band's (far, at any real paper: the roads
  at the far width, no tracks, the cities alone). Not a ZOOM_BAND, which are pure on the scale: the Bay's fit depends
  on the paper, so the sheet decides it.
- **The hover.** `tamrielPlaceAt`: a city within CITY_HIT_PX, else the province, else the sea - "Skyrim : Solitude
  (beyond the Bay)", "Skyrim (beyond the Bay)", "Sea of Ghosts" - and null on the Bay's own ground, where the window's
  reads stand. A press beyond the Bay picks nothing: `_pickAt` was not touched.

## The window (`ui/heldMap.js`, `ui/ink/inkMap.js`)

- The world sheet hands `frame` (the continent's box in the Bay's coordinates) and `_limits()` carries it as
  `mapW`/`mapH` with `mapX0`/`mapY0`; `clampView` takes the origin (absent, zero - every other sheet unchanged). The
  home view is the Bay's fit centred on the Bay (`homeView`), so the map's rest is the whole Bay (the player's own map
  then glides to them - FIND-FIRST, `01-Overview/bugs/Field-Bugs-2026-10-10.md`); `-` and the
  wheel go out from there to the frame's contain. The zone map (WILD2) holds its own limits and the continent is never
  painted under it.
- The switch is read ONCE at open (`this._tamriel`), the Features row's "takes effect the next time a map is opened".
  Off is the sheet as it was: contain on the Bay, the clamp at the Bay's edge, a hover beyond it silent.

## The raster (`world/tamriel/tamrielRaster.js`) - the later use

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

`test/ui/tamriel.test.js` (18): the frame's scale against the wire's own units and its inverses; the topology whole
(every edge coast or border, the tables equal to the rings, a dropped vertex caught), every city in its province and
beyond the Bay, one capital a province; the clip's four cases, the fret's kept vertices and calm, the stitch's edge,
reach and once-each, the model's budget and cut ends ON the Bay's ends, one model a coast array; not one canvas call on
the Bay, the paint's order and faces off it, the hover's three answers; the raster's planes, the peak over the snowline,
determinism, the compose on and not beside the Bay; the clamp's origin, the continent flag's thinnings, the switch
and its kill door; the source sweeps (the paint after the Bay's ink and under the zone map's, the switch read once, the
layer reading no game data, BAY_ORIGIN named once). `test/ui/heldmap.test.js` TAMRIEL1 window (+1): the limits carry the
frame, the rest is the Bay's fit, the pan out to the frame's edge, the continent inked only past the Bay, the hover
beyond it and nothing picked there, Off as it was. Mutants `tools/mutants/tamriel.json` (37: 34 dead, 3 equivalent as recorded), and map1's four clamp and
band records re-aimed by content.

Merged to main 2026-10-08 as #702 at Mac's word ("Skip ci and merge"), with the CI-skipping marker in its merge title; the deploy that skipped - and again under #703, whose merge message quoted the marker - ran from #704's merge.

## TAMRIEL2 - the land mass, streamed (2026-10-08)

Mac, after the question of populating it: *"Lets worry about this later and only implement the land mass."*

The streamed world goes on past the Bay's edge. Daggerfall grows every tile from two bytes a map pixel - WOODS.WLD's
height and CLIMATE.PAK's climate - through DFU's own kernel, and the kernel asks for them through three reads of the
WoodsFile (`getHeightMapValue`, `getHeightMapValuesRange1Dim`, `getLargeHeightMapValuesRange`) and one of the MapsFile
(`getClimateIndex`). `world/tamriel/tamrielGround.js` answers those reads for any pixel of the frame: the Bay's own on the Bay,
the authored continent's past it - its height by the one law the raster reads (the sea 0, the shore rising to the
plain over PLAIN_REACH from the coast, a range lifted toward SNOW_BYTE by its gain, a lattice hash of ±2), its climate
the province's (the Ocean's at sea), its large-map detail a lattice hash of small bytes. Nothing stands on it: no
towns, roads, dungeons or regions - the later use. (TESA1, 2026-10-12: the later use is The Elder Scrolls: Arena's own
places, from the player's ARENA folder - on the held map first, `03-World/Arena-Provinces.md`.)

- **THE BAY IS NOT MOVED BY A BYTE.** The kernel's windows reach 2 pixels past a pixel, and at the Bay's edge WoodsFile
  CLAMPS them to the edge's own pixel. `groundWoods(woods)` - a prototype child of the reader, so the two range reads
  built on the two it overrides answer the continent too and nothing else about the reader changes - keeps the SEAM
  band (SEAM_PX, 2) at exactly the clamped read, and blends the authored ground in from the edge's byte over BLEND_PX
  (12) after it. `test/world/tamriel2.test.js` holds every Bay pixel's samples, edge and corner included, byte-identical
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
  whoever stands near, and the Overworld routes over the land there (TV-BEYOND, `01-Overview/bugs/Field-Bugs-2026-10-09.md`:
  the wire and the planner held the Bay's bounds, and the field found both). The sea past the Bay is the kernel's own water tiles (Deep Waters' bathymetry is the Bay's). The Wrothgarians
  and the Dragontails begin in WOODS' bytes and continue in the authored law past the edge; the seam band and the
  blend join them, and the probe's seam report says where the data and the authored shape disagree.
- **Performance.** A pixel's ground past the Bay costs a point-in-province test, a coast distance over ~100 edges and a
  range distance over 12 spines, once a pixel, cached (GROUND_CACHE_MAX, dropped whole); the kernel's cost is the
  kernel's. On the Bay the composition is one subtraction and a compare a read.
- **Pins.** `test/world/tamriel2.test.js` (10): the law (sea, shore, plain, Red Mountain over the snowline, the noise
  floored), the cache and the climate, the composition to the byte on nine Bay pixels, the seam and the blend, the
  range reads through the overrides, a whole pixel beyond the Bay through the kernel (Skyrim's trees; the Eltheric
  under it), the raster as the same law, the stream's frame and load list, the ring's bytes past the map, the worker's
  word and its purity, the switch and its row, the host's seams by source. Mutants `tools/mutants/tamriel2.json` (22: 21 dead, 1 equivalent as recorded - the cache's key, one key a pixel whichever it is; 21 since AUDIT TESA II K15 deleted the province fallback's record with the dead fallback).

## TAMRIEL2-WORKER - the freeze on going outside (2026-10-08)

The field, within the hour of the deploy: *"game freezes when I go outside."* The ground beyond the Bay is read by the
terrain WORKER, whose import graph is pure by law (EV7); TAMRIEL2 had taken two helpers from their "one home" in
net/ - the gate's PIXEL_M (`net/gate/gateLaw.js`, which imports `net/wire.js`) and the strike's segmentDistance
(`net/gate/gateStrike.js`) - and through them the worker's bundle grew by twenty modules of the relay's law, and the world
froze on its first exterior build. The helpers live in pure homes now: `world/segment.js` (the one segment distance,
which the gate's strike imports too) and the frame's own kilometres a pixel, held to the wire's units by its pin. The
pin that would have caught it walks the worker's whole graph at any depth and holds every module to world/ and
formats/ (`test/world/tamriel2.test.js`); the frame, the geography and the ground are swept for any import of net/.

## TAMRIEL3 - the map from the player's own picture (2026-10-08)

Mac, with the deploy in hand: *"Can we fix the map? It doesnt look like the map thats in daggerfall."* It did not:
TAMRIEL1's geography was drawn from memory of the lore map, and the lore map is not the one in the box. Daggerfall
carries its own map of Tamriel - TMAP00I0.IMG, the race screen's picture, and TAMRIEL2.IMG, its picker, whose palette
index IS the province (CreateCharRaceSelect.cs:30-31,64) - and the port already traces the picker at runtime for the
chargen's province map (`ui/provinceMap.js`, OVH). So the continent is now TRACED from the player's own two files when
the world boots, and the Bay's place on that picture is FOUND rather than authored. Nothing of either file ships: the
trace is made on the player's machine from the player's files, as the chargen's map is, and `?tamrieltrace=off` keeps
the authored shape (no Features row: a door for a day the trace reads a picture wrong, not a choice) - offline alone
(AUDIT TESA II P9: online the land is the room's, and the door had moved one client's coasts and places).

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
- **The land module** (`world/tamriel/tamrielLand.js`): the trace installed (`setTamrielTrace`), a chamfer 3-4 distance field
  to the nearest sea made at install, a version that moves on every install (the ink's and the held map's static key
  read it), and the two reads everything else asks - `provinceKeyAt` (the trace's by id, the authored rings' else;
  null at sea and off the grid) and `coastDistanceAt` (the field, bilinear; the authored edges' else). PURE: typed
  arrays in, answers out, so the terrain worker holds the same module. `PROVINCE_OF_ID` is the picker's law: 1..8 the
  races in RACE_TEMPLATES order, 9 the Imperial Province.
- **The fit** (`fitBayToPicture`): the Bay's own land (WOODS.WLD and CLIMATE.PAK through the one water law,
  `overworldModel.js isWaterPixel`) is laid on the picture's grid at each candidate scale (16..21 Bay pixels a picture
  pixel, the authored 18.75 among them) and offset (24 picture pixels each way round the authored place), four samples
  a cell and the majority, and the pair with the greatest FRACTION of cells agreeing wins - a count would favour the
  smallest scale, which lays the most cells (the pin that found it: `test/world/tamriel3.test.js`). Deterministic; ~40M
  compares, once, after the travel art, off the boot's critical path. TAMRIEL4 scores the Bay's EDGE first and the
  inside beside it, at every quarter scale from 15 to 21 (below).
- **The live frame** (`world/tamriel/tamrielFrame.js`): BAY_ORIGIN and PIXELS_PER_PICTURE_UNIT are the DEFAULTS now; every
  conversion reads `tamrielFit()` - the fit the host installs (`setTamrielFit`, null or a bad pair the defaults
  again) - and `tamrielSize()` the picture at the live scale. The raster, the ground, the ink and the held map's frame
  all move with it.
- **The ink on the trace** (`ui/tamrielInk.js tracedChains`): the coast is the land mask's pixel edges linked (the
  Bay's own shore law, `inkMap.js boundarySegments`), the staircase of a 15 km pixel simplified and its corners cut (TAMRIEL4: the land's contour, smoothed - below)
  at the picture's own scale; a border runs where two land pixels change province; a province's name hangs at its
  clearest point (`provinceMap.js labelPoint`), and a province the picture has no land for is not named. The authored
  cities keep their places where the trace agrees, move up to CITY_SNAP_PX (10) onto their own province's land, and
  are left off past it (a town the picture puts in the sea is not drawn in the sea); a range's carets stand only on
  the picture's land; a sea's name on the picture's land is dropped; the rivers stay authored (TAMRIEL4: not on the
  trace - the picture's own water is its rivers). The model reports
  `traced` and `version`, and `tamrielInkFor` rebuilds when the version moves.
- **The ground and the raster** read the land module (`world/tamriel/tamrielGround.js authoredHeightByte`,
  `tamrielClimateAt`; `world/tamriel/tamrielRaster.js` at the live scale) - so with the trace in, the streamed land past the
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
Bay's own coast and the traced one disagrees along 516 edge pixels (the authored shape, tuned to the Bay's edges, 265;
TAMRIEL4's fit, which scores the seam first, 231 - below):
the stitch joins what it can within STITCH_REACH and the rest meets at the Bay's rectangle, as TAMRIEL1 said it would.
A reading for the chargen (OVH): `provinceMap.js`'s `seaIndices` and `inlandRemainder` read the same blue sea the
picture has not; its inert ninth is held by INERT_REGION's fallback, not by the remainder. What the sheet shows
before the trace lands (a few hundred milliseconds after the world mounts) is the authored continent; the static key
repaints it the moment the trace is in.

### Pins

`test/world/tamriel3.test.js` (14): the pieces' connectivity and edge, the race ids; the trace over a synthetic picture
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
`tools/mutants/tamriel3.json` (45: 45 dead; 44 since AUDIT TESA II K15 deleted the province fallback's record with the dead fallback).


## TAMRIEL4 - the continent, traced properly (2026-10-09)

The owner, with the map in hand: *"Also increase the accuracy and fidelity of the tamerial ingame map. Its not properly
traced"*. Rendered on the freeware CD's files (in the session's scratch, never the tree), TAMRIEL3's continent showed
four faults, each a reading of the picture rather than the picture:

1. **Every border was a strait.** The picker draws each border between two homelands as a one-pixel line no race claims
   (the black between its masks); the trace read it as sea. Skyrim met Hammerfell, Skyrim Morrowind, Valenwood Elsweyr
   and Morrowind Black Marsh across a 15 km channel - inked as a double coast on the sheet, and streamed as water in the
   land beyond the Bay (TAMRIEL2 reads the same trace). `closeBorderLines` (`ui/tamrielTrace.js`): a pixel of no land
   with land of two DIFFERENT provinces on opposite sides of it (west and east, or north and south) is the line - land,
   of the province most of its neighbours hold, pass after pass until none is left (a line's corner on the pass after
   its arms). A channel inside one province (the Inner Sea's narrows) has the same province on both sides and stays
   sea; a diagonal is never asked, so a coast's inner corner where two provinces meet stays sea. Its one reading of a
   strait one pixel wide between two provinces is their border; the picture has none past the Bay. 209 pixels on the
   freeware data, and no strait left (`test/ui/tamriel4.test.js` sweeps every pair).
2. **The painting's dabs were lakes.** Its blue in the land - a river's dot, a road, a letter's fill - left 90-odd holes
   of one to five pixels, each inked as a tiny lake. `fillSpecks`: a hole under HOLE_PX (6) is land, of its rim's
   province; the painting's smallest lake is ten pixels. Six waters stand: Lake Rumare's two pieces (11, 49),
   Hammerfell's two lakes (15, 20), the Niben (115), the Inner Sea (281). The land: 26,636 pixels (26,423 before).
3. **The fit agreed inside the Bay, where the picture is never drawn.** TAMRIEL3 laid the Bay's land on the picture and
   took the greatest fraction of cells agreeing INSIDE it - 77% at (45, 56) x18.5 - and the painting's Iliac Bay is a
   cruder inlet than WOODS.WLD's: that fit left High Rock's and Hammerfell's painted west coasts 100-200 Bay pixels past
   the data's, and the shore the player follows out of the Bay ran off its edge into nothing (516 edge pixels of 3,000
   disagreeing). Inside the Bay the data is drawn, so what the fit owes the map is the JOIN. `fitBayToPicture`
   (`world/tamriel/tamrielLand.js`) scores THE SEAM FIRST: the Bay's edge cells (its own cells, four samples a cell and the
   majority, as before) against the picture's pixels just beyond them, the fraction agreeing, and the inside's fraction
   beside it at FIT_AREA_WEIGHT (0.25); the scales every quarter from 15 to 21 (FIT_PPUS - the seam's best lay outside
   TAMRIEL3's 16-21); a candidate keeps a pixel of picture round it. On the freeware data: (38, 57) x15.5, 190 of its
   192 edge cells agreeing, 75% inside; the probe's edge-pixel seam 231 (516 before), and the Bay's coast ends on the
   north and south edges meet the continent's. The answer carries `seam` and `edge` beside `score` and `cells`; the
   console says both. ~0.4 s, once, off the boot's path as before. Tried and refused: a scale a side (an x and a y)
   gained 4% inside at a 47% stretch of the whole continent.
4. **The coast was the pixels' staircase, and the lore map's rivers ran out to sea.** `tracedChains` (`ui/tamrielInk.js`)
   now takes the land's 0.5 contour over its pixel centres (`contourSegments`, marching squares, a saddle's two lands
   kept apart, the sea round the picture), straightens its steps (COAST_SIMPLIFY_PX, 0.4) and rounds them with
   Chaikin's cut (`chaikinCapped`, SMOOTH_PASSES 3, each cut at most COAST_CUT_PX, 0.75, so a long run never loses a corner by
   a quarter of itself): a shore within about half a picture pixel (one pixel is 15 km) of the traced land, drawn rather
   than surveyed. The borders take the same, their ends moved onto the coast's own line within BORDER_SNAP_PX
   (`snapEnds`, the nearest point of any coast segment), so a dashed border meets the shore it divides. A run of the
   traced coast that lies ALONG the Bay's frame (the picture's land just outside it, its sea just inside) is the
   frame's, not a shore (`dropEdgeRuns`). STITCH_REACH is 64 Bay pixels, four of the picture's at the fit's scale - the
   picture cannot place a coast nearer than its pixels, and Hammerfell's met the Bay's 49 along the south edge. On the
   trace the lore map's six rivers are not drawn: drawn from memory as straight runs, half of them ran across the sea;
   the picture's own water (the Niben, Lake Rumare) is its rivers. The authored shape keeps its rivers.

What it moves: the sheet (the coast, the borders, the joins, the rivers), the hover (a border's pixel names its
province, not the sea), and the streamed land past the Bay (TAMRIEL2 reads the trace and the fit: no water down the
borders, the coast at the Bay's edges continuing the Bay's). The Bay's own ground and ink are untouched. What it cannot:
the picture is 320 x 200, so the continent's coast is the picture's to 15 km however it is drawn; the painted Bay still
disagrees with WOODS.WLD's along part of the west edge (139 edge pixels where the painting's Hammerfell reaches past the
frame), which the frame's dotted line carries alone now.

### Pins

`test/ui/tamriel4.test.js` (9): the border lines (a line between two provinces land, a tie to the lower id, a channel in
one province and a strait of two pixels sea, a strait of one the rule's reading, a T closed on the second pass, a
diagonal step); the dabs (under HOLE_PX filled with the rim's province, HOLE_PX a lake, the edge's sea never); the trace
running both after the remainder; THE SEAM FIRST (a Bay whose inside is a sea the picture has not is found where its
edge agrees, where the inside alone would go elsewhere; the weight and the scales); the contour (a lone pixel's four
middles, a saddle two closed coasts, the picture's edge closed); Chaikin (the ends kept, the cut capped, a ring
closed); the ink on the trace (every coast point within half a pixel of the land, a corner a curve, a border's end on
the coast's line - a stepped shore's too - the frame's runs dropped, no lore river on the trace and the authored
shape's kept, the reach); by source; and on the player's own files where ARENA2_PATH names them (26,636 land pixels,
the six waters, no strait anywhere, the fit to the cell). `test/world/tamriel3.test.js`: PIN MOVED, the fit's defaults
(FIT_PPUS); `test/ui/tamriel.test.js`: PIN MOVED, STITCH_REACH 64. Mutants `tools/mutants/tamriel4.json` (14, all dead);
`tools/mutants/tamriel3.json`'s fit-on-count, off-the-picture and coast records re-aimed by content (the coast's now
the smoothing's, with this file's pins beside it).

## TAMRIEL-RELIEF - the continent's own heights (2026-10-24)

The owner, with a heightmap of the whole continent: *"Heres the entire tamriel height map btw"*, then *"This is the
heightmap. Use it"*. Asked whether it should only set heights on the land as traced or reshape the land, the owner did
not choose; the land stays the trace's - its coasts, and with them every place, road and port TESA stood on it - and
the heightmap says how high that land stands.

- **The source** (`src/assets/tamriel/source/tamriel-heightmap.png`, `test/tooling/doctrine.test.js` row): the owner's
  picture as sent, a phone's screenshot, its map cropped to 930 x 705. Its own source was not stated. It is drawn on
  the lore's map, not Daggerfall's: its coasts are near the trace's, and its Morrowind has an Inner Sea round
  Vvardenfell where the picker's is land. **Its licence is the owner's permission (AUDIT TESA II G9; the owner,
  2026-10-25, asked whether data made from the heightmap may ship: "We have permission").** The PNG ships nowhere,
  but its derivative does, by that permission: the relief module is a chunk of every build.
- **The bake** (`tools/bakeTamrielRelief.mjs`, ARENA2_PATH set; `src/world/tamriel/tamrielReliefData.js` its output):
  the heightmap's land (LAND_LEVEL 12 and brighter, pieces under SPECK_PX 30 dropped) is laid on the trace's in two
  steps:
  - the best scale and offset a side (`fitAffine` - 3.41 and 4.05, because the picture's units are 4:3) gets 83% of the
    land either holds agreeing;
  - a smooth warp on top (`warpDemons`, Thirion's demons on the two lands' signed distances; WARP smooths by 3 units
    over 80 steps and moves nothing past 8) gets 90% agreeing. Land moves 0-5 units; the 8 is out at sea.

  The Bay's fit is the one the world host makes (`bakeFit`: fitBayToPicture over the one water law), never a copy of
  its numbers, and the grid is the runtime's RELIEF_SCALE (AUDIT TESA II G8). The heightmap is blurred (BLUR 1), then
  sampled at two cells a picture unit over **every** cell, the sea's included. AUDIT TESA II G1: the module had held 0
  at every cell of the trace's sea, so it carried the trace's land mask - a raster of TAMRIEL2.IMG and TMAP00I0.IMG -
  losslessly in every build, against Port-Doctrine's A RENDER OF GAME DATA IS GAME DATA and this page's own "nothing of
  either file ships". The trace's mask is now laid on the player's machine (`tamrielRelief.js` loadRelief, maskRelief),
  and the cells it leaves are the module's old ones to the byte.

  Brightness becomes WOODS' bytes by the Bay's own (`calibrate`). The heightmap and WOODS.WLD both draw the Bay, so a
  Bay land pixel's brightness and its byte are paired (300,218 of them), and a brightness takes the byte at its rank up
  to TOP_RANK (0.99, byte 85); past it, a line to CEILING_BYTE (180) at full brightness. The two agree on the Bay's
  ranks, not its hills (the pairs correlate at 0.25): the heightmap is the lore's. Re-run, the bake is the module to
  the byte, and it never reads its own output (`preloadTamrielTrace`'s `relief: false`).
  - **The warp is the owner's call (AUDIT TESA II G1).** The shipped heights' own coast (the heightmap's LAND_LEVEL) is
    the heightmap's, moved toward the trace's: 2,633 of the picture's 64,000 pixels differ from the trace's land, and
    the warp field is smooth (σ 3 units, 38 km). If the owner wants none of the trace's shape in the shipped heights,
    the unwarped heightmap with the fit's four numbers ships instead, and the warp is made on the player's machine.
  - **The branch's history stands, by the owner's word (AUDIT TESA II G1; the owner, 2026-10-25: "Its fine").** The
    old module, the one that held 0 at every cell of the trace's sea, stands in the TESA branch's commits from
    TAMRIEL-RELIEF on, which are published with the pull request. Purging it would be a history rewrite (Home.md, THE
    HISTORY WAS REWRITTEN ON 2026-08-27; Port-Doctrine's AUDIT 21 note). Asked, the owner left the history as it is.
    The fix is the module's: from AUDIT TESA II on, no build carries the mask.
- **The cells ride on the trace** (`world/tamriel/tamrielRelief.js`). The data is nothing's static import: `loadRelief`
  imports it when the trace is made (`ui/tamrielTrace.js` preloadTamrielTrace hangs the cells, masked by the trace's own
  land, on the trace as `relief`). So it is a chunk of its own (~119 KB, runs of one byte coded), never the boot chunk's
  or a worker's. Every copy of the trace carries the cells: its install (`tamrielLand.js` setTamrielTrace), the terrain
  worker's message (`terrainGenClient.js` setTamriel, transferred), and the roads worker's (the installed trace whole).
  `reliefStands` while the installed trace carries cells of its own size; with no trace, or a pin's trace without
  them, every law is the authored one, to the byte. AUDIT TESA II G2: a relief that does not load (its chunk not
  fetched, its module not read) is the relief's loss alone - the trace stands with the authored heights. It had
  rejected the whole trace, and every place, road and capital past the Bay with it.
- **The height** (`tamrielGround.js` authoredHeightByte), on the trace's land:
  - SHORE_BYTE at the waterline, eased up to the relief over RELIEF_COAST_REACH (1 picture unit) from it. The
    heightmap's coast is near the trace's, not on it, so its height is eased in rather than standing as a cliff at the
    water. AUDIT TESA II G4: the ease had been read off the trace's sea field, which reads a pixel's centre - half at
    the water and whole half a unit in - so a high shore stood a third of its height over the water (68 bytes by a
    lake in Craglorn's heights). Now no shore past the Bay stands over byte 40 beside the water (33 at most), against
    the Bay's own 85.
  - The lattice hash on it.
  - Never under SHORE_BYTE, and inland never under RELIEF_FLOOR (8, eased up as the height is - AUDIT TESA II G12: the
    heightmap's dark land, its Inner Sea where the trace has land, stood at the shore's bytes, and the kernel's samples
    dipped under the ocean's floor in sea-level ponds - 105 inland pixels, none now).
  - The sea 0.

  **SHORE_BYTE is WATER_BYTE + 1 (6)** - one over the beach line the roads, the places' dry ground and the gates' land
  test call water at or under (`roadsProducer.js` WATER_BYTE). AUDIT TESA II R1: at 5 it WAS that line, and 78,355
  land pixels on the relief read as water, a pond each: places unserved, pairs unrouted, three capitals' gates
  dropped. Both the relief's law and the authored law floor there, and in the blend band past the Bay's seam the
  trace's land does too.

  The coast is the trace's to the pixel (but by Cyrodiil's lakes: CYRODIIL-SHORES, below). On the freeware data, every
  one of the 14,833,216 pixels past the Bay's blend has its land or sea as the trace has it (WOODS' sea at 3 and under),
  and no land pixel stands at or under the beach line. The only land at or under it past the Bay is 56 pixels of the
  seam band, which is the Bay's own clamped read (THE BAY IS NOT MOVED BY A BYTE). Skyrim's spine stands at 176, the
  Jerall at 120-140, Vvardenfell's cone at 123, the Valus at 128, Summerset's heart at 103; the plains 12-40.
- **The peaks follow it** (`tamrielBiomes.js` biomeAtPicture, `tamrielRelief.js` peaksLine and namedSummit;
  `03-World/Tamriel-Biomes.md` Recorded choice 14). Where the relief stands:
  - a province's peaks zone is its highest PEAKS_SHARE (8%) of land **past the Bay** by the relief (AUDIT TESA II G11:
    the Bay's own cells, WOODS' ground where no zone stands, had been counted, and High Rock's and Hammerfell's share was
    of land mostly the Bay's), never under PEAKS_FLOOR (40), and **within PEAKS_SEEK (12 units) of a range its law calls
    peaks** that no zone of its province names (AUDIT TESA II G5: the share alone set "the Velothi Mountains"' snow on
    Deshaan's own heart, and Eton Nir's on Summerset's southern isle). So the snow is on the heightmap's mountains;
  - a range a zone names (Red Mountain) stands at the highest cell of its province within NAMED_SEEK (30 units) of its
    authored spine (AUDIT TESA II G13: "the summit nearest" was the page's word, not the law's), and its zone is the
    peaks within NAMED_REACH (10) of that cell.

  The authored spines were drawn from memory: on the trace Red Mountain's lies in the sea (its zone held 12 cells of
  coastal lowland), and the Throat of the World's lies on Skyrim's north shore. The freeware's lines: Skyrim 128,
  Cyrodiil 123, Hammerfell 112, Morrowind 75, High Rock 72, Summerset 49. BIOMES_VERSION 5 (AUDIT TESA II).
- **What moves with it:** the roads past the Bay are laid again (their cache print mixes the cells - `tamrielRoads.js`
  inputsPrint - and the zones' version), and the countryside's places with them where they read the ground; the climate
  of the land the peaks took or gave back. Vvardenfell's lowland hearts stand about Red Mountain's own summit (AUDIT
  TESA II G6, `03-World/Tamriel-Biomes.md`).
- **What it cannot:** the heightmap's own resolution (a pixel is a third of a picture unit, about 4 km) and a phone's
  jpeg: the relief is the lore's land shape, not a survey.

### Pins

- **`test/world/tamrielrelief.test.js` (5):**
  - the module: the grid, every cell a height with no 0 (G1), the curve never falling, the run code round-tripping and
    refusing a 0, the trace's mask laid by maskRelief, the calibration's ranks and line;
  - the height: the relief read, the waterline's ease (G4), the noise, the shore and the inland floor over the beach line
    (G12, R1), the sea, the authored law without cells;
  - the peaks: the share past the Bay (G11), the floor, near their ranges (G5: a lone height none), Red Mountain at its
    province's summit and never another province's higher cell (G7), within its reach, the ridge the Velothi, the plain
    neither;
  - the wiring by source: no static import of the data, the mask in loadRelief, a relief that does not load its own
    loss, the bake on the runtime's grid and no copy of the fit, every copy carrying the cells, the roads' print;
  - on the player's own files: the bake re-run on the host's fit is the module byte for byte; the module's land is not
    the trace's; the trace's cells are the module's masked; the warp better than the fit; every pixel past the blend
    land or sea as the trace has it and its land over the beach line, and the blend band's land over it too (R1); no
    shore over 40 beside the water; Skyrim's
    summit in the High Peaks, Vvardenfell's Red Mountain, Deshaan's heart no range's snow; the freeware's lines.
- **AUDIT TESA II** adds `test/world/audittesa2g_zones.test.js`, `test/world/audittesa2g_landforms.test.js`,
  `test/systems/weather/audittesa2g_air.test.js`, `test/systems/audittesa2g_bands.test.js` and
  `test/net/audittesa2g_jungle.test.js`. Mutants: `tools/mutants/audittesa2g.json` (78, all dead).
- **PIN MOVED:** `test/world/tesabiome_biomes.test.js` (BIOMES_VERSION 3, then 5; AUDIT TESA II J4: the wander's bend
  counted where the wandered point stays on its own province). AUDIT TESA II:
  `test/world/tamriel2.test.js` (SHORE_BYTE 6, R1); `test/systems/l10n4_hardcoded.test.js` (the zones' English, 80 -
  the Grazelands' two strings); `test/scenes/fb1001_nodes.test.js` and `test/world/worldWide/wwc1_ground.test.js` (the
  jungle's word in the trees' and the service's calls, J5); `test/systems/travel/ether_ow.test.js` and
  `test/systems/travel/tv7_bands.test.js` (the bands' ground past the Bay, F6).
- **Mutants:** `tools/mutants/tamrielrelief.json` (14, all dead, re-aimed by AUDIT TESA II). `tools/mutants/tamriel2.json`
  and `tamriel3.json` were re-aimed by content (the floor's return, the worker's message). Two of their records, on
  tamrielClimateAt's province fallback, had been recorded as equivalent, because a land pixel past the Bay has been a
  zone's since TESA-BIOME. AUDIT TESA II K15 deleted that dead fallback and the two records; the sea's record
  (`TAMRIEL2-the-sea-wears-a-climate`) is re-aimed at the line that stands. AUDIT TESA II also re-aimed, by content,
  records of `audit29.json`, `audit_etherow.json`, `auditcaptsea.json` (its law arm now on etherLandAt's, pinned by
  `test/world/audittesa2g_landforms.test.js` too), `ether_ow.json`, `junglewoods.json`, `prof1.json`, `tesabiome.json`
  and `wwc1.json`. Every other list's record within a few lines of the change was judged again: all dead, but
  PROF7-svc-body-witnesses, equivalent as recorded.

Section A, TAMRIEL-RELIEF (OURS: DFU stops at the Bay's edge; the land past it is the port's own).

## BREATHTAKER - the land below the heightmap's grain, and Cyrodiil's waters (2026-10-26)

KPbICA's spec, forwarded by the owner (BREATHTAKER 2 and 3): *"Make sure that we create landscapes based on the
Tamriel's heightmap"*, *"Make small landscapes that can't be seen on a Tamriel's heightmap more diverse. Now it's just a
very monotonous noise"*. And for Cyrodiil: *"For Cyrodill I would suggest to use this detailed map"*.

- **It is the same heightmap.** KPbICA's screenshot is a shaded-relief render (dark is high, the water blue) of the map
  `src/assets/tamriel/source/tamriel-heightmap.png` holds as brightness (TAMRIEL-RELIEF). The coasts, the isles, the
  Inner Sea round Vvardenfell, the Niben and Lake Rumare, and the bright ranges are the same. The repository's copy
  stays the source, and nothing new ships of it.
- **Measured before** (the freeware's trace; the probes are local):
  - **The macro is the heightmap's.** Pearson 0.997 and RMSE 45 m on a grid of four points a picture unit, the
    terrain's composed byte against the heightmap's own brightness through the bake's curve. Within
    RELIEF_COAST_REACH of the coast the land stands a mean 42 m under it. That is TAMRIEL-RELIEF's ease off the
    water, and it is kept (a residue, below).
  - **The tops were squashed.** The relief's bytes run to 180, but the lift is level past WOODS' 7-bit top (127). So a
    byte past it rose 10 m, against 20 m under it. That was 8.3% of Skyrim's land and 6.1% of Cyrodiil's: the High
    Peaks and the Jerall stood as plateaus.
  - **Under the heightmap's grain was noise.** Below about 10 km the ground's shape correlated with nothing (0.12). It
    was the large map's lattice hash (a bump of up to 45 m every 273 m, the same everywhere) under the Bay's climate
    hills, so every country wore the same mottle.
- **BREATHTAKER2 - THE LIFT GOES ON PAST THE 7-BIT TOP, PAST THE BAY** (`world/landforms.js` continentLift,
  CONTINENT_LIFT, CONTINENT_CEILING, byteBeyond; reliefByteHeight's `beyond`):
  - Past the Bay's seam the lift goes on at 0.56 from byte 127 to 180, and is level after. A byte past 127 now rises
    15.6 m, where it rose 10. Skyrim's spine (176) stands at 3,131 m, where it stood at 2,856; byte 180 at 3,193 m.
  - CONTINENT_CEILING (2,913.5 units) is under LANDFORM_CEILING (2,915.25) by construction, so the ceiling the
    snowpack, the far ring and the saves count is still the world's.
  - It comes in over the landforms' ramp past the seam. The Bay's bytes are the old law, to the bit.
  - `byteBeyond(x, y)` is the share at a pixel's byte node: what a byte read off the map takes, so it stands where the
    streamed ground does.
- **BREATHTAKER3 - THE CONTINENT'S OWN LANDFORMS** (`world/tamriel/tamrielLandforms.js`; `world/landforms.js` landAt
  past the seam). Past the Bay's seam they take the climate hills' place, coming in over TAMRIEL_LANDFORM_DIALS.ramp
  (8 pixels). The Eltheric Ocean's box is not the continent (`continentPixel`): its isles keep their own climates' hills
  (AUDIT CAPTAIN'S SEA G3), and none of this reaches them. The kernel's two terms stay the macro, so the shape at the heightmap's grain is the heightmap's. Under it:
  - **Families, mixed by zone.** Each zone of `tamrielBiomes.js` (ZONE_LANDS, or its climate's - CLIMATE_LANDS)
    weights nine families: rolling hills, ridges and valleys along the slope, foothills, mesas and buttes, dunes,
    drumlins (the north's ice), karst cones and sinkholes, marsh hummocks, and broken ground.
  - **The land's own say.** A steep, high flank is ridges and valleys, a flank lower down foothills, the north's
    lowland drumlins. A slow variety field trades a zone's shapes in patches, and a region field sets how hard the land
    rolls.
  - **The accents.** Terraces and escarpments where a steady slope or a plateau's rim steps (more where the zone
    steps), gullies down a flank (badlands where it is dry), and outcrops on the uplands and the ridges.
  - **Every shape centred on its own mean** (LANDFORM_CENTRES, measured), so the mix keeps the macro. Clipped softly
    to TAMRIEL_TOP (260 units), and eased over the land's height above the knee as the hills are, so no landform is
    taller than the land under it.
  - **Pure in its world position.** The slow fields are read on a lattice of NODE samples (Catmull-Rom, C1, so the
    hill-shade shows no cells), through a fine table four samples apart. A ghost row off the table reads the same four
    entries, made there, so every seam is one number from both pixels.
  - **No engine approximation** (AUDIT LANDFORMS III A8's sweep holds the file). The frames' directions are six fixed
    angles with exact cosines.
  - **The large map past the Bay is a swell.** `tamrielGround.js` tamrielLargeMap: LARGE_SWELL, a slow Perlin field
    about the old mean, never a byte between neighbours, where the lattice hash stepped up to nine.
  - **After.** The ground's mean against the heightmap per pixel (400 pixels past the Bay, each tree against its own
    byte law): Pearson 0.9989 against HEAD's 0.9990, RMSE 37.8 m against 37.4 m, bias 23.1 m against 23.5 m. Relief
    inside a pixel: median 15.7 m both, 90th percentile 30.5 m against 27.7 m. The macro is kept, and the shapes
    under it are each country's own: Elsweyr's mesas and buttes, the Reach's and the Heartlands' karst, the Jerall's
    ridges with rocky flanks and foothills, Colovia's stepped plateau, Skyrim's drumlins. Valenwood rolls gently, and
    Black Marsh is a flat of hummocks and hollows.
  - **The cost.** CPU on a loaded machine, 99 pixels past the Bay: the kernel 19.6 to 22.7 ms a pixel (median, 1.16x),
    the whole job 28.3 to 36.6 ms (1.29x).
- **CYRODIIL-WATERS - THE RIVERS AND LAKES PAST THE BAY** (`world/tamriel/tamrielWaters.js`):
  - **The source.** WATERS_SOURCE: KPbICA's reference map of Cyrodiil ("Province of Cyrodiil, 3E 433, Natalia
    Dravarol, Cartographer" - another game's published art). Each river's source, mouth and the towns it passes were
    read off it by eye and laid on our frame by the province's cities. Each course was then followed down OUR relief's
    drainage (a priority flood from the trace's water, the D8 receivers) and simplified to picture units. The image is
    in no commit, and nothing is traced or rendered from it.
  - **The waters.** Ten rivers - the Corbolo (out of Lake Arrius into Niben Bay), the Reed and Lake Poppad's outflow
    into it, the Silverfish (out of Lake Canulus), the Panther into the Lower Niben, the Lower Niben (Niben Bay to
    Topal Bay), the White Rose (across the West Weald into Lake Rumare), the Larsius, the Strid and the Brena - and
    three lakes: Arrius, Poppad and Canulus. The Upper Niben, Niben Bay, Lake Rumare and Topal Bay are the trace's own
    water, named by NAMED_WATERS.
  - **Departure from the reference: our relief wins.** Laid on our trace, the reference's western courses climbed
    ridges 400-600 m high. The West Weald and Colovia drain east to Lake Rumare in our relief (the White Rose), so the
    Strid and the Brena are the valleys that do run west.
  - **The law.** A river is a dense line, meandering a few widths either side, its width growing to its mouth. Its
    surface is the macro ground along it less an incision, never rising downstream: a lake's outflow starts at the
    lake's level, a tributary comes down to its river's surface over its last 1.5 km and meets it there, and nothing
    is under the knee's floor. A
    lake is a wandering ellipse, level at its lowest shore. The carve, inside the shaper, lays the channel level at
    the surface with valley walls rising to the land (the landforms faded into them), and only ever lowers. The paint
    (`terrainGen.js`) makes the channel's and the lake's corners water to the tile classifier, never inside a
    location's rect, so the marching squares lay the shore and the water's sheet draws (WATER-NEXT).
  - **No water reaches a capital** - none of the Imperial City's 49 slices in Lake Rumare, nor a pixel round any
    capital - **nor a place past the Bay's pixel** (pinned, on the freeware's trace).
  - **The interface.** Bay pixel coordinates, fractional, y south; lengths and levels in metres, in the terrain's own
    frame. Deterministic and pure, and the terrain worker holds the same module:
    - `tamrielWaters()` - the compiled law (`rivers[]`: key, name, into, from, `pts` (x, y pairs), `width`, `level`,
      `n`; `lakes[]`: key, name, `at`, `ring`, `level`, `shore`, `box`), compiled once a trace and a fit (about 0.4 s),
      or null with no trace;
    - `waterAt(x, y)` - `{ kind: 'river' | 'lake' | 'sea', key, name, level }` or null;
    - `riverAt(x, y)` - the nearest river within its valley: `{ key, name, distance, half, valley, level }`;
    - `riverCrossings(ax, ay, bx, by)` - every channel a straight run crosses, in order: `{ key, name, at, t, width,
      level }`, the roads' question;
    - `watersIn(x0, y0, x1, y1)` - the rivers' and lakes' keys whose carve reaches a box;
    - **for a router stepping a pixel at a time** (a channel is narrower than a pixel, so the bytes never show one):
      `riverPixel(px, py)` - the river whose channel crosses a Bay pixel, `{ key, name, dir, width, level }`, `dir` the
      way its water runs as the roads' compass (`world/road/roadNetwork.js` DIR, N 128 ... NW 1), `width` the widest of
      it there in metres - and `riverRaster(x0, y0, w, h)`, a box's `dir` (0 none) and `width`, row-major, in one pass;
    - `RIVERS`, `LAKES`, `NAMED_WATERS`, `WATER_DIALS`, `WATERS_SOURCE`.
  - **A river reaches its water.** Where its last point stands on the land (the smooth shores below move a shore a few
    pixels), its line runs on along its last leg into the water (WATER_DIALS.mouthReach, 8 pixels at most).
- **CYRODIIL-SHORES - THE LAKES' SHORES, SMOOTH** (`world/tamriel/tamrielGround.js` lakeShores, lakeShoreAt,
  LAKE_SHORE; the stream for the roads asked it: "the lakes (Lake Rumare's ring, the Niben) are blocky picture-pixel
  rasters"):
  - **Why.** The trace's water is the picture's, and a pixel of it is 15.5 of the map's. Lake Rumare's ring and the
    Niben stood as staircases of 12.7 km blocks on the map, on the ground, in the far view and to the roads.
  - **Which water.** The trace's lakes (water no way of water joins to the picture's edge - `arenaPlaces.js`
    pictureLakes' reading) that touch Cyrodiil's land.
  - **The shore.** The 0 contour of the lake's signed distance: the chamfer field each way, read bilinear between the
    picture's pixel centres, so every picture pixel's centre keeps its own side. It is wandered by two Perlin octaves
    (0.3 and 0.09 of a picture unit), never enough to pinch a channel a pixel wide.
  - **What a pixel becomes.** A land pixel the contour gives the lake is water (byte 0). A lake's pixel it gives the
    land is the beach (SHORE_BYTE) and wears the climate of the land beside it.
  - **What it leaves.** The sea's coasts and every other province's lakes are the trace's to the pixel.
  - **On the freeware.** Inside Cyrodiil's box 1,135 pixels went from land to lake and 1,428 from lake to land. No
    place's pixel and no capital's slice (nor a pixel round one) changed its side (pinned): the Imperial City's 7 x 7
    and its own lake (IMPERIAL.lake past City Isle, `world/imperialCity.js`) stand as they stood.
  - **The roads are laid again.** Every reader of the bytes takes the shore: the roads, the far view and the held map.
    `world/tamrielRoads.js` GROUND_ROLL_VERSION moves to 3, so every client's cached roads are laid again on it. Its
    fixture has no Cyrodiil lake, so the laws' fingerprint stands under 3 as under 2.
- **Residues, named:**
  - The coast's ease (RELIEF_COAST_REACH, a picture unit) is TAMRIEL-RELIEF's and unchanged. Moving it moves every
    place's, road's and port's ground past the Bay.
  - The trace's own inland lakes are holes at sea level, with the land round them standing high. They are the
    picture's water and the kernel's.
  - The far ring (`render/farRing.js` ringHeight) still reads reliefByteHeight with no `beyond`. Past byte 127 the
    horizon stands the old squashed tops until it passes `byteBeyond(x, y)` (the far view's lane).
  - The held map draws the trace's water and not yet these rivers (`tamrielWaters()` is there for it).

### Pins

- **`test/world/breathtaker.test.js` (13, the waters' four on the freeware's trace, gated on ARENA2):**
  - the lift: its law, the ceiling, and the Bay's bytes to the bit;
  - the continent's share: the seam band, the ramp, every side, byteBeyond, and the Eltheric Ocean's box none of it;
  - the soft clip;
  - each shape's centre;
  - the landforms: bound by TAMRIEL_TOP and by the land, one function of world position across lattices and ghost
    rows, every zone's palette;
  - the large map's swell;
  - the waters: every river down to its water, no capital and no place reached, the queries, the rivers' pixels and
    raster, and the carve and the paint. The ground's seams hold across a river's pixels, across the Bay's own edge and
    the ramp, and in five countries;
  - the shores: on a fixture, Cyrodiil's lake kept and Skyrim's and the sea's not, every centre its own side, both
    ways, the beach's byte, a narrow arm never pinched. On the freeware, no place's or capital's pixel moved, and the
    new shore wears the land's climate.
- **PIN MOVED (CYRODIIL-SHORES):** `test/world/tamrielrelief.test.js` (the coast the trace's to the pixel, but by
  Cyrodiil's lakes their smooth shore), `test/world/tamriel3.test.js` (the ground's import of the lakes' field),
  `test/world/audittesa2r_roads.test.js` (GROUND_ROLL_VERSION 3's fingerprint).
- **The A8 sweep** (`test/world/terrain/auditlandforms3.test.js` GROUND) reads `tamrielLandforms.js`,
  `tamrielWaters.js` and `tamrielGround.js` too.
- **Mutants:** `tools/mutants/breathtaker.json` (35, all dead). Re-aimed by content, each judged again and dead:
  `tools/mutants/auditlandforms.json`'s AUDIT-LANDFORMS-D-lift-of-whole-height (the line that now holds the lift),
  `tamriel2.json`'s TAMRIEL2-the-sea-wears-a-climate and `tesabiome.json`'s TESA-BIOME-21-ground-province
  (tamrielClimateAt's two arms, the lakes' new shore read between them).

Section A, BREATHTAKER and CYRODIIL-WATERS (OURS: DFU stops at the Bay's edge; the land past it is the port's own).
