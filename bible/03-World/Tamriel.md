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
  `byteAt` for the pixels past the map. World of Daggerfall's picks are held to the Bay; Deep Waters promotes past it on
  its own bake (TAMRIEL-DEEP, `03-World/Deep-Waters.md`).
- **The switch.** The Features row `tamriel-land` ("Land beyond the Bay", the world group, on by default, the player's
  own online), `scenes/shared.js` `tamrielLandOn` on the enhanced skin, `?tamrielland=off` the kill door, read once as
  the world mounts. Off - and on the classic skin - the edge of the world is DFU's: empty.
- **Readings, honest.** The region past the Bay is its province's (WW-R, `03-World/World-Wide.md`: regions 62..70 off
  `tamrielGround.js` groundPoliticIndex - DFU's clamp kept for the pixels the table has no region for); the weather keys
  on the climate, quests and the law on the province's region. Online a player beyond the Bay is seen by
  whoever stands near, and the Overworld routes over the land there (TV-BEYOND, `01-Overview/bugs/Field-Bugs-2026-10-09.md`:
  the wire and the planner held the Bay's bounds, and the field found both). The sea past the Bay is carved by a bake of its own, the Bay's law on the continent's frame (TAMRIEL-DEEP, 2026-10-26,
  `03-World/Deep-Waters.md`). The Wrothgarians
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

INTRO4 (2026-10-26, `10-UI/UI-Arc.md` INTRO4): THE FILM PULLS BACK TO THIS TAMRIEL. The intro's last frame is the authored
continent of `world/tamriel/tamrielGeography.js` - its rings, ranges, rivers, cities and names, nothing traced off the
player's picture - rasterised once by `ui/intro/introTamriel.js` (`buildTamrielField`), with INTRO2's authored bay drawn
in the Bay's hole. The film reads the geography and writes nothing back: the world's continent (TAMRIEL3's trace and
fit) is untouched.

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

  The coast is the trace's to the pixel (but by Cyrodiil's lakes: CYRODIIL-SHORES, below - and since SMOOTH-LAND, below,
  every coast the land's smooth law's, the pin moved with it). On the freeware data, every
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

## NIBEN-SEA - the Imperial City's water joined to the sea (2026-10-26)

The owner, with the lore map of Tamriel in hand: *"If you look at this image youll see the ocean that connects to the
imperial city is missing from our map"*, and *"The port that connects to the imperial city should allow for AI/player
ship voyages through this canal"*.

**What the trace read.** The race screen's painting draws Lake Rumare as a ring round the Imperial City and the Niben
from it down to the Topal Bay. TAMRIEL4 read four waters from that, and nothing joined them. Lake Rumare was two pieces
(49 and 11 pixels), because its lower arc and its outlet lie under the painting's own label, IMPERIAL PROVINCE. The
Niben's bay was 115 pixels. Below the bay, the river's painted line was one pixel of the coastline's blue, which the trace
read as the land it is painted on. Every one of them was a lake (`world/arenaPlaces.js` pictureLakes). So the open sea
never reached the city, no port stood on it, and no voyage or packet could sail it.

**The course** (`ui/tamrielTrace.js` `NIBEN_COURSE`, `nibenCells`, `openNiben`, run after `fillSpecks`; `niben` false
skips it - the relief's bake, `tools/bakeTamrielRelief.mjs`, fits the owner's heightmap to the painting's own coasts). Each run is a
row or a column of picture pixels from one corner to the next:
- the city's own arm of the lake, from a pixel below the isle's south shore down to the ring's bottom piece (the isle's
  last pixel stays land, under IC-GRAND's twenty-five - `03-World/Arena-Provinces.md`; the canal cuts the rest);
- the ring's lower arc, east under the label;
- the ring's east side, down to the Upper Niben and the bay's head;
- the Lower Niben, the painted line from the bay's tail to the Topal Bay.

The ring's west stays land. That is the isle's way to the mainland: Talos Bridge, the city's one gate. The course opens
only on a 320 x 200 picture whose every join (`NIBEN_JOINS`: the ring's two pieces, the bay's head and tail, the sea off
the river's mouth) is water. Any other picture is left as it traced. On the freeware this opens 37 pixels, leaving
26,599 land pixels (the boot's kept trace is traced again: `world/tamriel/tamrielBootCache.js` BOOT_CACHE_VERSION 2, and
the painting's own coasts, `niben` false, are never kept). The enclosed waters left are Hammerfell's two lakes and the Inner Sea (4-connected), or Hammerfell's
two alone (`pictureLakes`, 8-connected). The Lower Niben runs on Elsweyr's border with the Imperial Province, a river
one pixel wide between two provinces' land. It is the one such strait the trace keeps; TAMRIEL4's closeBorderLines reads
every other one as a border. Everything that reads the trace follows: the held map's coast, the streamed ground (the
course is the sea's - its height 0, the Ocean's climate), the relief's mask, the places' shores, and the open sea that
the ports, the board and the lanes ask (AUDIT TESA II P12's lakes are now Hammerfell's alone). SMOOTH-LAND's one law
reads the opened trace as it reads the rest: the course is a picture pixel of sea, its shores the law's smooth contour.
CYRODIIL-WATERS' Lower Niben (`world/tamriel/tamrielWaters.js`, a carved river 320-460 m wide) runs down the same reach;
the reach is the sea's now, a picture pixel wide, and the river's carve only ever lowers, so it reaches its water as
before (`test/world/breathtaker.test.js`), and NAMED_WATERS still names the reach the Lower Niben.

**The Waterfront canal** (`world/tamriel/tamrielGeography.js` `WATERFRONT_CANAL`, `world/tamriel/tamrielLand.js`
`waterfrontCanal`, `canalAt`). The city's arm of the lake starts two picture pixels south of the city's own, and
IC-GRAND's twenty-five pixels (`span`, pinned to `world/imperialCity.js` IMPERIAL_SPAN) end inside the one between. So
the arm's water starts short of the city's south edge, and the canal cuts the rest at the Bay's scale. It runs from the
row past the span to the last row before the water, along the city's middle column and one column either side: Bay
pixels 2068-2070 by 671-683 on the freeware's fit (the arm's end rounded by the smooth law). It reads the land's own law
(`landLabelAt`, never `provinceKeyAt`), so it ends where every reader's water begins. `provinceKeyAt` answers null inside
it, so the ground, the climate and every reader of the land see it as sea.

There is no canal when:
- the city's span is not all its province's land at its point (the capitals' own law would stand it elsewhere);
- the water meets the city's edge (nothing to cut);
- no water lies within `reach` (24).

The canal is kept for a trace and a fit, the same on every thread.

**The harbour.** The Imperial City's port is the middle slice of its span's bottom row, below the Waterfront district
(`world/tamrielCapitals.js` `harbour`, `capitalHarbourSlice`, `capitalCanalOpen`; `world/pastBayRows.js`): Bay pixel
(2069, 670) on the freeware. That slice is a port where the canal meets it. RUMARE-WATER (below) moved it onto the
Waterfront's own slice, (2069, 668), when the lake became the sea's. Every other capital's harbour is its centre,
as before. A capital's harbour is named for its capital: it is the "Imperial City" on the boards
(`world/worldWide/worldPorts.js`).

**The packets.** The city lies some 850 pixels of river from the Topal Bay and a thousand from the nearest port of the
sea, past the lanes' own reach (BEYOND_LANE_MAX_PX, 400). A harbour up a canal therefore runs its packets
`CANAL_PORT_REACH_PX` (1200, the port's `reach`; `systems/naval/seaLanes.js` laneNetwork). Its way runs up to twice that
(`scenes/naval/worldLanes.js` `beyondPathPx`), and the lane's `near` test uses the same bound. The city's roadstead lies
on the canal, which is a picture pixel of land, so its way puts out from the picture's sea beside it - SMOOTH-LAND's
`moorCell`, which took the law this arc had written as `seaFrom` (a cell within two whose leg the world's lane water
holds). On the freeware this gives the city two packet lanes: to Senchal, 995 km down the Niben and across the Topal Bay,
and to Torval, 1,555 km.

**The voyage.** The voyage planner (`systems/travel/travelRoute.js` planSeaLanes) floods the water at the Bay's scale.
The canal and the course are both water to it. A voyage from the Topal Bay lands at the harbour's slice: 848 pixels
on the freeware.

**The zone** (`systems/wild/cyrodiilZone.js` `provinceWaterAt`). AUDIT TESA II Z4 made the zone take what it encloses,
so Lake Rumare and the Niben were the zone's. Joined to the sea, they would no longer be enclosed. The sea would reach up
the river to the city's isle, and the city would fall into The Borderlands. The rule now: a pixel the land's law calls water
(`provinceKeyAt`'s null) whose nearest land on the picture on both sides of a row or a column (within
PROVINCE_WATER_REACH, 12) is the Imperial Province's is the zone's. The Waterfront canal counts too: its picture pixel is
the province's land between its own. The river's last reach, between Elsweyr's banks, does not. The city stands in The
Heart, as Z4 pins it.

ZONE-LINE's outline (`zoneLineSteps`) is the law's own lines wherever the zone changes - the coast, a border. Where the
zone's water meets the sea's, the law has no line: one label's water on both sides. So that square is the zone's own
marching case, a DAM: each edge it crosses at the law's crossing where the labels differ and at its middle where they do
not, its pieces `kind` 'water'. The dam is the red line's, the fog's cut and the zone map's ring alone. It is never the
held map's coast or border, and never a piece the ink leaves off for the zone (`keys`). On the freeware the outline
crosses the Niben where its banks turn Elsweyr's.

**Not done, and why.** A boat sails the Niben and the canal to the city's edge. The city's own lake (IC-GRAND's, inside
its twenty-five pixels, out to 10 km) is the location's ground, flattened to the city's height, so a boat does not cross
from the canal onto it, nor reach the Waterfront's piers. Voyages and packets land at the harbour's slice. DONE by RUMARE-WATER (below): the lake is the sea's,
at its height and carved deep, joined to the canal through a mouth in the far shore, and the harbour is the Waterfront's.

### Pins

- `test/world/nibensea.test.js` (10): the course (its runs, its joins, the opening and its guard); the canal (its box,
  the land's key and the ground on it, the four nulls); the harbour (the slice, the canal's word, the other capitals' as
  before); the port's name and reach; the lanes' reach and the way's cap; the way off the canal; the zone's water; the
  zone's line across its water (every chain closed, the centre rule, the dam the red line's alone); and on the player's
  own files the joined Niben, the painting's trace never kept, the port, the lane to Senchal and the voyage.
- PIN MOVED: `test/ui/tamriel4.test.js` (26,599 land pixels, three holes, the course exempt from the strait sweep);
  `test/systems/wild/zoneline.test.js` (the zone the province's law and its own water); `test/world/bootcache.test.js`
  (the laws' prints under BOOT_CACHE_VERSION 2);
  `test/systems/revenant/lairworld.test.js` (350 graveyards within 200 px of the city, 12 doorless: 13 stood on the
  course, and one on Lake Rumare's east shore goes with the sea's large-map detail, TAMRIEL-DEEP);
  `test/world/audittesa2p_world.test.js` (P12: two lakes, Lake Rumare the sea's; P7: 29 ports, the city's its
  Waterfront); `test/world/tamrielrelief.test.js` (the relief's bake reads the painting's own coasts -
  `preloadTamrielTrace`'s `niben` false: the owner's heightmap is laid on the painting, and the player's trace masks the
  river on it at load, so the module is the same to the byte).
- Mutants: `tools/mutants/nibensea.json` (24, all dead). At the merge of SMOOTH-LAND, IC-GRAND and ZONE-LINE:
  CANAL-province-unread and ZONE-water-unasked re-aimed by content; WAY-roadstead-held-to-picture and WAY-leg-unasked
  retired with `seaFrom` (`smoothland.json`'s SMOOTH-LAND-LANES-the-mooring-refused and -the-moorings-leg-unasked hold
  `moorCell`, and name this file's test too); ZONE-dam-unbuilt, ZONE-dam-the-laws, ZONE-water-by-the-picture and
  BOOT-the-bake-kept added. Re-aimed by content, all dead: `audittesa2g.json`'s
  AUDITTESA2G-G2-the-bake-reads-its-own-output; `audittesa2p.json`'s
  P7-capital-port-unsaid, P7-near-the-bays, P7-near-no-margin and P7-port-region-unsaid; `sealanes.json`'s
  NET-three-neighbours and NET-reach-short; `tamriel3.json`'s TAMRIEL3-the-sea-has-a-province; `tesa6.json`'s
  TESA6-a-crown-past-the-bay; `wwc2.json`'s WWC2-a-cell-by-its-corner.

Section A, NIBEN-SEA (OURS: DFU stops at the Bay's edge; the land past it, its water and its ports are the port's own).

## RUMARE-WATER - the Imperial City's lake is the sea's (2026-10-26)

The owner: *"City lake needs to be apart of the overall water structure. Not just a flattened land. Make this work and be
detailed about it"*.

**What stood.** NIBEN-SEA joined Lake Rumare to the Topal Bay and cut the Waterfront canal to the city's south edge. The
city's own lake - IC-GRAND's ring between City Isle's shore (7.9 km) and the far shore (10 km), inside its twenty-five
pixels - was not part of it:
- the city was a location like any other, so its ground was flattened (TESA11's `flattenAt`) to its centre pixel's
  average, about 100 units over the sea. The lake was a sheet of water tiles laid on that ground, a hundred metres up;
- the plan's far shore ran all the way round, so a wall of land stood between the lake and the canal's head;
- the canal ended at the span's edge, where the land's bytes about it lifted the kernel's water into a bar;
- the Deep Waters bake never asked for the lake, and nothing carved it. A boat could not sail it, and no packet or
  voyage could reach the Waterfront's piers. The harbour was the span's south edge, on the far shore.

**What it is now.** Where the canal stands, the city's lake is the sea's own water. It stands at the sea's height, is
carved as deep as the sea, and is reached through a mouth in the far shore. The city's land stands just over it.

**The mouth** (`world/imperialCity.js` `IMPERIAL.mouth`, `imperialLand`). The plan's land law now opens the far shore
south of the isle: `mouth` metres either side of the middle line (1,228.8 m - the canal's three pixels, WATERFRONT_CANAL's
`half` and a half, pinned equal), from the lake to the span's edge. The mouth is no land, and its tiles are the lake's.
The Waterfront's quay and piers stand inside the ring, so they are untouched. The far shore either side of the mouth, and
the whole shore north, east and west, are land as before. Talos Bridge still lands on the west shore.

**The city's water law** (`world/rumareWaters.js`, pure, read by the terrain worker, the Deep Waters worker and this
thread off the same trace and fit):
- `rumareCity()`: the city's centre pixel where the canal stands (`waterfrontCanal`, which now carries its `cx`, `cy`),
  else null. With no canal, nothing below applies, and the city keeps its own ground as before;
- `rumareSeaAt(bx, by)`: a Bay point of the span that the plan calls no land - the lake round the isle and the mouth;
- `rumareSeaPixel(px, py)`: the same law at a pixel's middle. This is the map-scale reading for the lanes, the voyages
  and the ports' shore;
- `rumareLandHeight`: the city's land. Inside the far shore it is the freeboard's height (below). Past the far shore it
  rises to the land's own height at the span's edge, smoothstepped over the way from the water (the far shore or the
  mouth's side) to the edge. It is exactly the land's own on the edge, which is the neighbour pixel's sample, and never
  under the freeboard;
- `rumareMouthPixel`: the span's south-edge pixels the mouth crosses (2068-2070 on the freeware);
- `rumareBasin`: the share by which the land round the span is let down to the shore - 1 on the span, easing to 0 over
  `RUMARE_BASIN.ramp` (10) pixels past it, measured from the span's square on a superellipse (power 4) so its sides are
  straight and its corners round;
- `rumareSliceRect`: a slice's rect as `setLocationTiles` gives a capital's - the rim on the span's outer sides, a town's
  clearance on its inner ones.

**A capital at the sea's ground** (`world/terrain/capitalSea.js`; `world/terrain/terrainGen.js` runs it after the blend).
AUDIT TESA II C2 flattened a shore capital's every slice to the sea's floor so its harbour stood at the sea's height. Its
streets stood there too, and every reader that asks heights of water read them as water: the Deep Waters carve
(`isLocalPointWater` counts a height at the ocean as water whatever its tile), which TAMRIEL-DEEP's continent bake now
reaches, would cut a shore capital's streets to the seabed, and Come Sail Away's hull (under 34 m is water) would sail
them. So a capital at the sea is now laid in two heights:
- its LAND at `CAPITAL_LAND`, `CAPITAL_FREEBOARD` (0.8 kernel units, 1 m) over the sea. That is past the carve's 0.25
  headroom (`DW_CARVE_THRESHOLD`) and the hull's 34 m line. The flatten (`CAPITAL_SEA_FLAT`) is the land's height, so the
  location's models stand on it;
- its WATER at `CAPITAL_SEA`, the sea's own height (the sampler's ocean clamp). A vertex is water where:
  - a stamped tile of the location's own ground has water at that corner (`WATER_DRAW_MASK_TABLE`, so the sheet laid on
    it is level);
  - the Imperial City's law says so (`rumareSeaAt`). On a seam between two of its slices the law alone decides - both
    slices ask the same law, so the seam is one height from both sides;
  - past the rect, in the rim, the land's own ground there is the sea (the sea reaching in);
  - it lies on a seam with the capital's sea slice (`seaEdges`, `world/tamrielCapitals.js` seaEdgesOf). Both sides of that
    seam are water;
- every other vertex is land - `CAPITAL_LAND` inside the rect, the rim's blend never under it, and the Imperial City's
  far shore rising to the land's own (`rumareLandHeight`);
- a vertex on the span's outer edge (a side with a rim) is the land's own height, water or land, as the pixel past it
  stands, so no seam opens.
- Moved by SOLITUDE-RELIEF (2026-10-27, `03-World/Arena-Provinces.md`): Solitude no longer stands here - its ground is a
  relief of its own (`world/terrain/capitalRelief.js`), its streets 46 m over the sea and its docks at 2.4 m. Alinor,
  Torval and the Imperial City keep the two heights above.

The Imperial City is flattened to the sea (`flattenAt.sea`) only where its canal stands (`capitalCanalOpen`). Alinor,
Torval and Solitude take the same law as shore capitals: their water is unchanged, and their streets are a metre over it.

**The ground about it** (`world/tamriel/tamrielGround.js` tamrielHeightByte, tamrielLargeMap; GROUND_ROLL_VERSION 5):
- the mouth's pixels are the sea's (byte 0), so the kernel lays the canal's water on into the city. They had stood the
  land's height, a bar across the mouth that the kernel's interpolation lifted to about 90 m;
- the land round the span is let down toward the shore (SHORE_BYTE) by the basin, whole on the span and eased back
  over ten pixels. Without it the far shore's rise met land at 86 m on the span's edge, a cliff over the lake. It meets it
  at 62 m now. The sea and any land already that low never move;
- the large map's detail (BREATHTAKER3's swell) is faded by the same share, so the basin's floor is a shore's.

**The bake** (`world/tamrielWatersBake.js`). The continent's Deep Waters bake reads the city as the streamed build lays
it. `rumareWaterSampler` gives a span pixel's samples flattened to `CAPITAL_LAND`, its water let down by
`capitalSeaGround` with the law alone (no tile is laid in the bake), and every other pixel the plain sampler's. Its
classes call every span pixel mixed (`PIXEL_MIXED`), so the span is always asked whole. Its fine and coarse water are that
sampler's, and its flood is seeded from the city's sea pixels as well as the trace's open sea, so the lake is reached
through the mouth from the canal. The carve then takes the lake into the deep with its shelf, as the sea's.

**The harbour** (`world/tamrielCapitals.js` `harbour`, `capitalHarbourSlice`, `capitalCanalOpen`). The Imperial City's
port is now the Waterfront's own slice on the middle line: slice row 22, which holds the quay (8.1 km) and the piers' ends
(8.45 km). That is Bay pixel (2069, 668) on the freeware; it was the span's edge (2069, 670), on the far shore. The canal
is asked at the row past the span's south edge in the harbour's column, wherever the harbour's own row is.

**The ways at the map's scale:**
- the lanes' water (`scenes/naval/worldLanes.js` worldLaneWater) is the Ocean's water past the Bay or the city's sea
  (`rumareSeaPixel`);
- the ports' open sea (`scenes/world.js` openSea, past the map's edge) takes the city's sea, so the Waterfront's port
  bears on it;
- a voyage's sea (`systems/travel/travelRoute.js` routeGround's `seaAlso` and `seaWater`; planSeaLanes reads `seaWater`)
  takes it as well. The land's own water (`isWater`) does not, so the isle's way by Talos Bridge is still walked as the
  city's streets. `seaWater` is one function per water, so the kept lane tiles are kept by it;
- a harbour up a canal asks its lanes of `CANAL_PORT_NEIGHBOURS` (4) nearest ports (`world/worldWide/worldPorts.js`,
  `systems/naval/seaLanes.js` laneNetwork's `p.neighbours`), not the lanes' own two. From the Waterfront the nearest as
  the crow flies are Senchal, then Winterhold and Windhelm across Skyrim (no way to either), then Torval. With two it lost
  its Torval lane.

**On the freeware** (`ARENA2_PATH`; the city at (2069, 658)):
- the city slice at the centre is all land at 35.00 m. The Waterfront's slice has 10,307 samples of sea at 34 m and 6,334
  of land at 35 m. The mouth's south edge is 34 m all the way, the canal's own water;
- Come Sail Away's hull reads the lake as water (under 34 m) and the streets as land (over it);
- the bake floods the canal, the mouth and the lake's south, east and west pixels whole, and the north's where the
  isle's shore crosses it in part. The city's are none. The carve takes the lake's south down to 76.1 m, its north to 48.9 m, and the Waterfront's own slice to 31.6 m;
- the port stands at (2069, 668), its roadstead at (2068, 668). It has two lanes: Senchal, 997 km, and Torval, 1,558 km.
  A voyage from the Topal Bay is 852 pixels and lands at (2069, 668).

**AUDIT BAY-LEFT F1 - the bake's city off its law** (2026-10-27, `01-Overview/audits/Audit-Left-In-The-Bay.md`). The
bake classed all 625 of the span's slices mixed, so every cell flood ran each of them through the kernel (11-13 ms a
slice: the samples, the flatten, `capitalSeaGround`), and kept nothing past an eviction: a promote at the Waterfront
waited 17.5 s on a fresh bake, 8.3 s at (2058, 664) and 23 s at the span's north edge (2069, 646). Now:
- `world/tamrielWatersBake.js` rumareWaterSampler reads the plan's law at every vertex (`world/rumareWaters.js`
  rumareSeaGrid - capitalSeaGround's own arithmetic, the city found once a slice) but the span's outer edge, where the
  plain sampler answers as the kernel does there. On the freeware: the kernel's answer at every vertex of all 625
  slices, and the same coarse and fine bits (0 differences).
- rumareClass: a slice wholly inside City Isle's shore or wholly past the far shore clear of the mouth is LAND with no
  vertex asked (rumareSliceAllLand, a metre's margin either side); else its grid's all-land, all-sea or MIXED. The bake
  keeps each slice's class and bits for its life (the constructor's cityBits memo), a mixed slice's grid packed until
  both its bit sets are made.
- `world/imperialCity.js` imperialLand: the Prison's and the University's centres made once a plan (landCompounds).
- After: 1.0 s the first promote at the Waterfront (the lake's cell, once a bake), 36-137 ms the others; a cell flooded
  again after an eviction 54 ms (6.4 s before).

**Not done, and why.** No ship berths at a particular pier: a packet lands at the harbour slice's roadstead, as every
harbour's does. The lake's ships are the lanes' (to Senchal and Torval), and they cross it to the Waterfront; it has no
traffic of its own.

### Pins

- `test/world/rumarewater.test.js` (13): AUDIT BAY-LEFT F1's two (the sampler the kernel's on 11 slices, the classes,
  the all-land slices, a mixed slice's fine water the
  kernel's, the memo kept past an eviction; imperialLand's compounds at the University's corner); the plan's mouth; the city's law; the ground about it (the mouth's bytes, the
  basin and its ramp, the large map, GROUND_ROLL_VERSION); the city's land and its slices' rects; a capital at the sea's
  ground (the pond, a shore tile's one corner, the rim's sea and its floor, the outer edge, the sea's seam); the Imperial
  City's slices (its seams one height, a tile at a seam never read, the mouth's edge, the far shore's rise); the harbour;
  the bake; the ways (the lanes, the voyage's sea, the neighbours, the port's shore); the host's wiring; and on the
  player's own files the lake and the city's heights, the hull, the carve, the port, its lanes and a voyage.
- PIN MOVED: `test/world/audittesa2c_capitals.test.js` (C2: a shore capital's land a freeboard over the sea, its water
  the sea's; Alinor's and Torval's sea edges); `test/systems/naval/fb1014_inlandports.test.js` and
  `test/systems/naval/auditcaptsea.test.js` (the host's open sea takes the city's sea);
  `test/systems/travel/fb0929d_toroads.test.js`, `test/systems/travel/fb1009_beyond.test.js`,
  `test/systems/travel/tv2_click_to_move.test.js` and `test/world/worldOfDaggerfall/ow_wod.test.js` (the planner's ground
  handed the city's sea); `test/world/nibensea.test.js` and `test/world/audittesa2p_world.test.js` (the harbour the
  Waterfront's slice, (2069, 668)); `test/world/breathtaker.test.js` and `test/world/tamrielrelief.test.js` (the mouth's
  three pixels the sea's, the land's law calling them the city's); `test/world/audittesa2r_roads.test.js` (R6:
  GROUND_ROLL_VERSION 5 recorded - the fixture has no canal, so its print is 4's) and
  `test/world/road/river_fords.test.js` (the version 5); `test/world/tamriel2.test.js` (TAMRIEL2-WORKER: the terrain
  worker's graph 62 modules, every one under world/ and formats/ - the plan's mix and block side moved to a leaf of
  their own, `world/blockHash.js`, which `world/spawnedDungeons.js` re-exports, since its own imports reach the clock and
  the road network); `.github/workflows/account-deploy.yml`'s path filter carries the leaf, which the account Worker and
  the deploy's Discord step bundle through `spawnedDungeons.js` (`test/server/accountdeploy.test.js`,
  `test/server/discord_setup.test.js`).
- Mutants: `tools/mutants/rumarewater.json` (49: 47 dead, and AUDIT BAY-LEFT F1's RW-F1-the-all-land-test-unread and
  RW-F1-the-outer-edge-the-law's equivalent - the first a fast path the grid answers the same, the second the outer edge's
  law and kernel agreeing on the freeware's span - recorded `equivalent`); F1 re-aimed RW-BAKE-the-span's-class-the-bound's,
  -the-fine-water-the-plain-sampler's and -the-coarse-water-the-plain-sampler's by content onto the cityBits reads (dead). Re-aimed by content, all dead: `auditcaptsea.json`'s
  ACS-B10-sea-at; `audittesa2c.json`'s AUDIT-TESA-II-C2-shore-on-its-land and -no-sea-flag; `audittesa2p.json`'s
  P12-open-sea-a-lake; `breathtaker.json`'s BREATHTAKER3-the-large-map-hashed-again; `fb1009_beyond.json`'s
  TV-BEYOND-planner-handed-no-beyond; `fb1014_inlandports.json`'s INLAND-PORTS-the-bounds-unasked; `nibensea.json`'s
  HARBOUR-canal-unasked and PORT-reach-unset; `sealanes.json`'s NET-three-neighbours; `tamrieldeep.json`'s
  TDEEP-detail-at-sea; `voyager.json`'s VOYAGER2.1-no-reader-by-default; `ww3.json`'s WW3-the-lane-water-unswitched,
  -in-the-box and -any-climate.

Section A, RUMARE-WATER (OURS: DFU's BlendLocationTerrain flattens a location to one height; a capital at the sea stands
its water at the sea's and its land a metre over it, and the Imperial City's lake is the sea's - the land past the Bay is
the port's own).

## PEAKS - the ranges snow-capped (2026-10-26)

The owner: *"The world of daggerfall mountains need to be completely redesigned from the ground up with more integration
into the terrian, snow capped, and properly place throughout tamriel."* The ranges' measure, their snow caps by zone
(PEAKS1) and their own shape (PEAKS2) are `Peaks.md`.

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
    about the old mean, never a byte between neighbours, where the lattice hash stepped up to nine. (SUPERSEDED by
    RELIEF-PEAKS, below: the large map is WOODS.WLD's own law of the small byte, a third of the land's height - the swell
    stood the continent 50 to 540 m under the Bay at the same byte.)
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
    - `CARVED_RIVERS` (AUDIT TESA III: `RIVERS` was tamrielGeography.js's name too), `LAKES`, `NAMED_WATERS`, `WATER_DIALS`, `WATERS_SOURCE`.
  - **A river reaches its water.** Where its last point stands on the land (the smooth shores below move a shore a few
    pixels), its line runs on along its last leg into the water (WATER_DIALS.mouthReach, 8 pixels at most).
- **CYRODIIL-SHORES - THE LAKES' SHORES, SMOOTH** (SUPERSEDED the same day by SMOOTH-LAND, below: every coast and
  border past the Bay one smooth law, the lakes' among them; kept here as the record) (`world/tamriel/tamrielGround.js`
  lakeShores, lakeShoreAt, LAKE_SHORE - gone now; the stream for the roads asked it: "the lakes (Lake Rumare's ring, the
  Niben) are blocky picture-pixel rasters"):
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
    horizon stands the old squashed tops until it passes `byteBeyond(x, y)` (the far view's lane). (Closed: BREATHTAKER2
    ON THE HORIZON passed it; RELIEF-PEAKS, below, stands the far views on the kernel's own ground.)
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
  - the shores (PIN MOVED, SMOOTH-LAND: the fixture's test is `test/world/smoothland.test.js`'s now): on the freeware, a
    place's and a capital's pixel the law's side, and the shore the law gave the land wears the land's climate.
- **PIN MOVED (CYRODIIL-SHORES):** `test/world/tamrielrelief.test.js` (the coast the trace's to the pixel, but by
  Cyrodiil's lakes their smooth shore), `test/world/tamriel3.test.js` (the ground's import of the lakes' field),
  `test/world/audittesa2r_roads.test.js` (GROUND_ROLL_VERSION 3's fingerprint).
- **The A8 sweep** (`test/world/terrain/auditlandforms3.test.js` GROUND) reads `tamrielLandforms.js`,
  `tamrielWaters.js` and `tamrielGround.js` too.
- **Mutants:** `tools/mutants/breathtaker.json` (35, all dead). Re-aimed by content, each judged again and dead:
  `tools/mutants/auditlandforms.json`'s AUDIT-LANDFORMS-D-lift-of-whole-height (the line that now holds the lift),
  `tamriel2.json`'s TAMRIEL2-the-sea-wears-a-climate and `tesabiome.json`'s TESA-BIOME-21-ground-province
  (tamrielClimateAt's two arms, the lakes' new shore read between them). SMOOTH-LAND (below) retired the five
  CYRODIIL-SHORES records with their code (30 left) and put the two climate records back on tamrielClimateAt's one arm.

Section A, BREATHTAKER and CYRODIIL-WATERS (OURS: DFU stops at the Bay's edge; the land past it is the port's own).

## SMOOTH-LAND - every coast and border past the Bay one smooth law, to the map's pixel (2026-10-26)

The owner, asked whether to smooth the sea coasts and the province borders: "Whatever is most detailed". The land past
the Bay was the trace's picture read a pixel at a time - a picture pixel 15.5 of the map's - so every coast and border
was a staircase of 12.7 km steps: on the ground, in a pixel's province (theatreAt, provinceKeyAt), under the places and
the ports, in the zone and on every map. The held map drew a smoothed coast beside that staircase (TAMRIEL4's corner
cut) - a line no law followed - and CYRODIIL-SHORES smoothed Cyrodiil's lakes alone, their own way. Now one law answers
all of it, and every line the maps draw is its edge.

- **THE LAW** (`tamrielLand.js:"export function landLaw(trace)"`, `landLabelAt`; dials `SMOOTH_LAND` reach 2, clamp 1,
  passes 3). The land, and each province, is a mask of the picture's pixel centres. Its outline is the marching squares'
  contour over the centres - an edge between a centre of the mask and one off it crossed at its middle, a saddle's two
  of the mask kept apart (a strait on the diagonal stays open) - linked into rings and cut at its corners by Chaikin's
  rule three times. Each centre within two pixels of a mixed square stands at its signed distance from that outline
  (held to one pixel; past the reach, the clamp's), and the field is read between the centres by Catmull-Rom's cubic:
  through every centre's own value, a straight run's distance kept exactly, and its slope continuous across the
  squares' edges, so a line passes from one square to the next with no corner. Where a mask holds two opposite centres
  of a square alone (a saddle), its two others stand at the clamp, so the cubic's reach never joins the two across it.
  A point is land where the land's distance stands over 0 (the waterline itself the sea's); its province is the one of
  its square's four centres whose own distance stands highest there (a tie the lower id; one province alone about it,
  that one). Bound by construction: every picture centre keeps its own label, and a square of four centres one label is
  that label whole (answered at once - most of the frame). A land pixel naming no province is land of none
  (`NO_PROVINCE`): the coast's, never a province's. The sea has a distance of its own (the land's, turned) for the
  points where a coast meets a border.
- **THE LINES** (`tamrielLines.js:"export function lawLines"`, LINE_BISECT 10). A line is where the law's label
  changes between two map pixels' centres. Each crossing is found on its edge by halving it ten times against the law
  itself - a coast's by the land's own side, a border's by the two provinces' own distances - so a point is the law's
  boundary to a thousandth of a pixel. A square of two labels joins its two crossings (a saddle by the law at its
  middle). Where three labels meet, every crossing runs to one point (`junction`): a border meeting a coast ends on the
  coast's own chord where the two provinces' distances are equal, so the coast runs on through it straight; three
  provinces meet at their crossings' middle. Three labels whose twice-held one lies on a diagonal are two lines past each
  other where the law's middle holds it, else the other two meet between its corners at two points with a line between
  them. Each piece knows the two pixels it divides (`side`). The continent's walk visits only the map squares in the
  picture's squares of mixed centres, and passes a square of one label without making it; `square(bx, by)` makes one
  the first time it is asked.
- **ITS READERS, WITHOUT A COPY.** provinceKeyAt and so provinceKeyBeyondBay, theatreAt and the regions, the climates and
  the biomes; the ground's bytes (`tamrielGround.js:"export function authoredHeightByte"` - its relief eased from the
  smooth waterline by the law's own distance, `coastDepthAt`); the places (`arenaPlaces.js` pictureSea, and a place
  stands on a pixel whose centre the law gives its own province); the lanes (`worldLanes.js` pictureSeaMask: a cell's
  water the law's at its centre, which keeps the picture's own side - and `moorCell`: a roadstead on the law's sea
  whose cell's centre is land leaves from the nearest open-sea cell within MOOR_REACH (2) it reaches straight on the lane
  water); the held map (`tamrielInk.js` tracedChains: the law's coast and border pieces, thinned by INK_THIN, a quarter
  of a map pixel, with Cyrodiil's left to the zone); and the zone (`cyrodiilZone.js` zoneLineOf: the law's own pieces
  the zone changes across, each a coast or a border by what lies past the zone) - so a map pixel is the zone's exactly
  when its middle lies inside the red line, and the red line, the fog's cut, the zone map's edge and the province's
  own line are one. The roads' cache key moves (`world/tamrielRoads.js` GROUND_ROLL_VERSION 4), so every client's cached
  roads are laid again on the new ground.
- **THE BAY IS NOT MOVED BY A BYTE.** The law answers past the Bay only (the Bay's own pixels answer the Bay); the seam
  band is the Bay's own clamped read and the blend beyond it eases into the law's ground as before.
- **CYRODIIL-SHORES IS FOLDED INTO IT** (BREATHTAKER, above): its lakes' own shore (`lakeShores`, `lakeShoreAt`) and the
  held map's own lake ink (`lakeShoreChains`, `LAKE_INK_SS`) are gone - a lake's shore is the law's like any coast.

**Measured on the freeware's picture** (its fit 589, 883.5 at 15.5; the frame's 4,960 x 3,100 map pixels, each at its
centre, against the picture's own law before):

- **Staircases left: 0.** A staircase's corner - a corner of the labels on a picture pixel's corner with straight legs
  of eight map pixels each way - stood 1,820 times; none stands. The law's own coast lines turn at most 14.6 degrees
  from one map pixel's piece to the next (39,184 points), its borders at most 48 where three provinces meet; on the whole
  continent 51,568 squares hold two labels and 14 three, none a saddle or a diagonal's three.
- **Pixels that changed:** 25,210 from the sea to the land, 27,787 from the land to the sea, 15,857 from one province to
  another - each within a pixel of the picture's own edge.
- **Places:** all 283 stand, every one on its own province's land by the law and every port beside its sea. 34 stand on
  another pixel than before, none lost and none across a border: 23 ports onto the smooth shore, 3 capitals (Solitude,
  Alinor, Torval), and 8 inland places whose own pixel the law gave the sea or a neighbour (each a few pixels to its
  own land; the farthest of the 34, 14). Of the 21 lanes past the Bay 19 find a way, as before.
- **The zone:** a map pixel the zone's exactly when its middle lies inside the red line - 0 of Cyrodiil's box's
  3,486,060 apart; no zone pixel on another province's land.
- **The cost** (this shared machine, CPU): the law's build 65 ms a trace (about 300 ms the first time a thread runs it);
  a map pixel's province 127 ns over the frame, the picture's own law 88; the continent's lines 500 ms, the zone's mask
  280 ms and its line 200 ms; the held map's first traced ink about 1.5 s where it was 0.5, once a trace - made in idle
  time since AUDIT RELEASE R4-7, below.
- **AUDIT RELEASE R4-7 - THE HELD MAP'S LINES MADE IN IDLE TIME** (`01-Overview/audits/Audit-Release-R4.md` R4-7: the
  map's first open held the page 2.1-3.3 s on a loaded machine, some 1 s unloaded - the continent's walk, Cyrodiil's
  line, the linking). The three are steps now, one code path walked whole or a budget at a time: the walk a picture
  square of mixed centres a step (`tamrielLines.js` lawLines `steps`), Cyrodiil's line a row of the mask's cells and
  ZONE_LINE_STEP (4,096) candidate squares a step (`cyrodiilZone.js` zoneLineSteps), the linking LINK_STEP (2,048) pieces
  a step (`linkSteps`), a chain's thinning and a province's label a step each (`tamrielInk.js:"export function* tracedSteps(trace) {"`).
  When a trace lands on the page (`tamrielLand.js` onTamrielTrace), `startTracedJob` walks them TRACED_SLICE_STEPS (24)
  steps a slice of `requestIdleCallback`, into the one keep `tracedChains` reads (a trace, its fit, its land's version and
  the zone's mask) - so the map's first open takes them made, the same object; opened before the job ends, it walks the
  rest whole, as before. A trace that moves on stops its job. No idle callbacks (node, the workers), no job. The chains
  are byte for byte the whole walk's (pinned).
- **AUDIT RELEASE R4-7 - THE LAW MADE AS IT IS READ** (its third proposal: the law's own first build, 0.15-0.29 s warm
  and about a second cold, landed in the task that first asks a province - the trace's landing - on the page and in each
  worker). `landLaw` now builds the labels, the squares' labels, the near centres and each field's held saddle centres -
  every field's centres at the clamp on their own side - and makes a field's true distances a tile of LAW_TILE (16) x 16
  centres at a time, the first time a read needs one (`at`: the tiles under the cubic's sixteen centres, at most four a
  field); a field's outline is made with its first tile. A read in a square of one label makes none. The values are the
  eager build's, whatever tile or order made them (pinned bit for bit, made whole and in reverse). On the freeware's
  picture: the build 28-83 ms (it was 0.15-1.6 s), 2,000 scattered reads 35-257 ms, the worst one read 6-104 ms (the
  first, making the land's outline cold), the rest made whole 33-69 ms - 3,003 tiles in all. The R4-7 idle job's walk
  makes the coast's tiles as it goes.

Recorded:

- **Departure from TAMRIEL3/TAMRIEL4 (the coast the trace's to the pixel).** The picture's pixel centres keep their
  side; between them the land is the law's smooth outline. The trace and its fit are unchanged.
- **A small feature is the law's at its curvature.** A lone picture pixel is an islet 0.46 of a pixel across its
  middle, round to two hundredths; a convex corner is cut a quarter of a pixel along its diagonal, a concave one filled
  as much. The ink thins a straight run to its ends and keeps a curve's points within a quarter of a map pixel.
- **Places moved, not held.** "No place moved" and "no place in the sea or across a border" part on 34 places whose
  own pixel the smooth law gives the sea or a neighbour; they stand lawfully on the nearest pixel of their own land (the
  places' own snap, `standArenaPixels`), never in the sea.
- **The roads' and the far view's.** The roads take the new ground through their cache key; the far field and the rings
  read the ground (`06-Systems/Travel-View.md`), no copy of the law.

### Pins

- **`test/world/smoothland.test.js` (8, one gated on ARENA2):** the law (every centre its own, a square of one label
  whole, a straight run on the pixels' edge, a staircase's diagonal one straight line, a convex corner cut and a concave
  one filled to their measure, a lone pixel round, a strait open, the waterline the sea's, a tie the lower id's, far off
  the picture the sea); its distance (the waterline 0, the clamp, the sea's off the picture, none without a trace, one
  law from a copy of its arrays bit for bit); the lines (every crossing on the law's own edge, the centre rule for the
  coast and each province over every map pixel, three borders meeting at one point and each border's ends on a coast's,
  no corner sharper than 30 degrees); a saddle and the diagonal's two cases at one map pixel a picture pixel; its readers
  (provinceKeyBeyondBay, theatreAt, the places' sea, the ground's bytes, the lanes' cells, the zone and its line's centre
  rule, the held map's ink the law's points within a quarter of a pixel); a lane's mooring; and on the freeware's
  picture no staircase left, the law's lines' sharpest turns, every place on its own land and every port by its sea.
- **PIN MOVED (SMOOTH-LAND):** `test/world/tamrielrelief.test.js` (the coast the law's; the ease from the smooth
  waterline; the strait's channel the law's own, wider than its reach), `test/world/tamriel3.test.js` (the ground's
  import; the ink's points), `test/ui/tamriel4.test.js` (a border's end on the line of the border that goes on through a
  meeting of three), `test/ui/mapwaters.test.js` (a lake's shore the law's), `test/systems/wild/zoneline.test.js` (the
  province's ink the zone's line on a small picture laid east of the Bay), `test/tesa10_capitals.test.js` (Solitude on a
  rounded corner, five map pixels east), `test/tesa2_arena.test.js` (8 inland places a few pixels off their point, on
  their own land), `test/world/breathtaker.test.js` (CYRODIIL-SHORES folded in), `test/world/audittesa2r_roads.test.js`
  (GROUND_ROLL_VERSION 4's fingerprint).
- **Mutants:** `tools/mutants/smoothland.json` (50: 45 dead - R4-7's seven among them, the job unheard, a slice the whole,
  the keep dropped, the walk's and the linking's steps lost, a moved trace walked on, the landing unheard - and 5
  equivalent as recorded - the saddle's pairing under the
  hold, the near mask's and the walk's margins, the moored cell's centre past a straightened leg). Re-aimed by content, all
  judged again and dead: `audittesa2g.json`'s G4 ease,
  `tamrielrelief.json`'s the-coast-not-eased, `audittesa2p.json`'s P7-lakes-sailed (equivalent, as recorded),
  `tamriel3.json`'s three on the law and the lines, `zoneline.json`'s eight on the ink's filter, the lines' meetings and
  the zone's own, `tamriel2.json`'s and `tesabiome.json`'s tamrielClimateAt records (back on its one arm). Retired with
  the code they held: `breathtaker.json`'s five CYRODIIL-SHORES, `mapwaters.json`'s four on the lake ink, `tamriel3.json`'s
  two and `tamriel4.json`'s one on TAMRIEL4's corner cut and its border staircase, `zoneline.json`'s two on `cutCoast`'s
  half-sides and the old line's own fill (the mask's fill is `audittesa2z.json`'s).

Section A, SMOOTH-LAND (OURS: DFU stops at the Bay's edge; the land past it is the port's own).

## RED-MOUNTAIN - the volcano on Vvardenfell (2026-10-27)

The owner: *"An absolute massive volcano true to lore that towers in the distance."* The cone, its crater, its foyada,
its fire and its horizon are `Red-Mountain.md`: a law of world position the kernel stands on the land past the Bay at
Red Mountain's summit on the relief, about 7.3 km over the sea.

## RELIEF-PEAKS - the ranges past the Bay stand as mountains, Red Mountain a cone (2026-10-27)

KPbICA on the game's Discord, 2026-10-27, forwarded by the owner: *"2) No mountains (screenshot 1). Instead we're
getting strange looking canyons"*, *"2.1) No 'Red Mountain' in Morrowind"*, *"5) Strange projections above the horizon
line. Probably because of the part of the renderer that draws details further than loading distance"*. The owner: *"No
band aids or half assed work"*.

- **What the player saw.** Past the Bay the ranges were low domes, and no mountain stood out of the land. Walls and
  narrow slots cut through the high ground: the "canyons". Vvardenfell had no volcano. On the horizon, land and trees
  showed where the ground near them has none.
- **Measured before** (the freeware's trace and WOODS.WLD, landforms on; the probes are local):
  - **The ranges spanned a third of the Bay's.** Over 10 km about each summit: Skyrim's summit country 442 m, the
    Jerall 274 m, Red Mountain 376 m. The Bay's Dragontails span 1,449 m and its Wrothgarians 1,032 m.
  - **Cause 1: the large map past the Bay was a swell.** DFU's kernel stands the ground on two terms, the small
    heightmap times 8 and the large map times 4 (src/world/terrain/terrainSampler.js:"export function kernelTerms"). On
    WOODS.WLD a land pixel's large map is about 1.18 times its small byte up to byte 85, and the byte itself by byte 109
    (12.2 at byte 12, 47.6 at 40, 82.3 at 70, 100.6 at 85; each byte's quartiles within one of its median). BREATHTAKER3
    read it as small detail and stood a swell about 4.5 past the Bay. So the same byte stood 50 to 540 m lower past the
    Bay than on it.
  - **Cause 2: nothing under the relief's grain.** TAMRIEL-RELIEF's heightmap has a cell every 6.3 km. A byte past the
    Bay stood within 1.3 of its 15-pixel mean, where WOODS.WLD's mountains stand 4.5 to 10 bytes off theirs.
  - **Cause 3: the canyons were BREATHTAKER3's frames.** Each lattice node took one unit direction. Where the direction
    turns fast (a summit, a saddle, the slow field's own turn), the oriented families (ridges, foothills, drumlins,
    gullies) handed one field to another inside one sample: walls of 80 to 116 m at 85 degrees. About Bruma 4.8% of the
    ground stood over 37 degrees and 2.0% over 50.
  - **Cause 4: a wall at the Bay's north edge.** The large map handed over from WOODS.WLD's to the swell at the seam,
    and the Wrothgarians fell some 600 m in half a pixel.
  - **Cause 5: Red Mountain was the relief's dome**, 40 bytes over 35 km: its top 2,379 m, 530 m over the land 29 km
    out.
  - **Cause 6: the far views stood another ground.** The far ring stood a pixel's own byte at the pixel's centre with no
    large map: 410 to 500 m off the kernel's mean ground in the continent's ranges, and the Bay's Dragontails some 470 m
    under it. The far field stood a cell at its highest sample's byte by that law: past the Bay up to 105 m over the
    ground at its place (29 m on the mean), on the Bay 266 m under it on the mean and up to 253 m over it.
  - **Cause 7 (named here, fixed by HORIZON-TREES): the band's trees.** FAR-TREES (`06-Systems/Travel-View.md`) draws the band, the
    trees of the ring just past the streamed grid, last in the far pass at the far plane, with no depth among the far
    layers. A band tree behind a hill of the middle ring is drawn over the hill. From Bay pixel 2046,325, 300 m up, Land
    View 5: of 3,072 band tree points, 967 stand behind the streamed grid (its depth hides them) and 442 behind the far
    pass's own ground, drawn anyway (14.4%; 21.0% of those the grid leaves). Those are tree sprites over a hill's
    skyline - the likeliest "projections above the horizon". The fix: the band's vertex shader marches the sight line
    from the eye over the middle ring's heights and drops a tree the ground hides. `render/farTrees.js` is
    FLORA-GROUND's file today (its vertex program and instances are being changed there), so it is left to that slice.
- **The fixes**, each at its cause. The bytes are not moved, so every reader of them (the roads, the places, the ports,
  the dry ground, the coasts) stands where it stood:
  - **The large map's law** (src/world/tamriel/tamrielGround.js:"export const LARGE_LAW", `largeOfByte`,
    src/world/tamriel/tamrielGround.js:"export function tamrielLargeMap"): WOODS.WLD's own law of the small byte, each
    cell read where the kernel reads it (the bytes' cubic about the pixel's node, a third of a pixel apart). Past byte
    109 the kernel's height runs on to DFU's ceiling less the ground noise and a cell at byte 180, so no byte past the
    Bay's top stands on the clamp as a plateau. None at sea, and none on the Rumare basin's span (RUMARE-WATER). It
    blends in from the edge's own large map over BLEND_PX, as the bytes do.
  - **The frames ease** (src/world/tamriel/tamrielLandforms.js:"function structureAt", STRUCTURE_REACH 2, ORIENT_FULL
    0.5): a node's direction is the land's structure about it (its gradients' doubled angles over two pixels), at its
    own strength. Under ORIENT_FULL the oriented families ease into the fixed frame, so no family hands one field to
    another inside a sample.
  - **The ranges** (`world/tamriel/tamrielRanges.js`, new): laid in the kernel's shaper past the Bay, under the
    landforms, never in the bytes. DFU's cubic takes twice Catmull-Rom's tangent, and relief laid in the bytes stood as
    a plaid of pixel-wide bands. A ridged field of four octaves, 11.5 to 1.1 km. Its swing grows from nothing at 1,000 m
    to 1,250 m from 2,300 m. It is centred on the land where the land has room; toward the ceiling its crests are the
    land's own height and a rise is held softly under it. There is no relief within two pixels of a carved river or a
    lake, and the whole of it past seven.
  - **Red Mountain** - retired at the merge for RED-MOUNTAIN's volcano (`Red-Mountain.md`, the owner's call): this
    cone, its rim 3,250 m and its crater 240 m deep, stood under that one.
  - **The far views stand on the kernel's own ground**
    (src/world/landforms.js:"export function nodeGround(byte, fade = 1, beyond = 0, lift = true)", `centreGround`,
    `nodeGroundAt`). The far ring's vertex is the kernel's mean ground at its pixel's centre
    (src/render/farRing.js:"export const ringGroundAt"). The far field's is the ground at the node its cell's centre is
    (src/world/terrain/midRingGrid.js:"export function farFieldCell", worked out on the terrain worker and transferred).
    The large map and the ranges stand in both. The travel view past the grid reads the ring's ground. `nodeGround`
    takes the place of reliefByteHeight, which is gone.
  - **A site's level past the Bay counts the ranges** (`siteLevel`), so a town's pull meets the ground the shaper lays.
  - **The records** (GROUND_FRAME_LAW 3, src/scenes/groundFrameHost.js:"const groundMovedAt"). DFU's own ground moved
    past the Bay. A record written there before it (a save, a scene cache, a ship's deck, an anchor, a remains' place)
    rides that ground's own move: src/world/landforms.js:"export function groundMovedField" over today's reader against
    the one with the swell (`groundBefore`), over a town's rect as DFU's blend moves it. The old lift it takes off has
    no ranges in it. BAY-LEFT-GROUND D5's own law is LIFT_FRAME_LAW (2). A body that still lands under its ground is
    lifted by the collider's floor.
- **After** (the same probes):
  - Spans over 10 km: the Throat 1,117 m, the Jerall 1,060 m, the Reach's shoulder 1,008 m, the Velothi 1,007 m, the
    Wrothgarians past the Bay 794 m (the Bay's Dragontails 1,449 m).
  - About Bruma: 0.28% over 37 degrees (was 4.8%), 0.01% over 50 (was 2.0%). Median slopes 13 to 16 degrees.
  - Red Mountain (retired): its top 3,332 m; the land 29 km out 2,365 m on the mean and 2,709 m at its highest; 10 km
    about it spans 833 m.
  - The Bay's north edge: no step over 120 m between samples 102 m apart.
  - The far ring's vertex within 2 m of the kernel's mean ground past the Bay (it was 410 to 500 m off) and within 35 m
    on the Bay; the far field within 2 m past the Bay and 45 m on it.
  - The capitals' ground: the Imperial City (27 m) and Solitude (at the sea) as they stood; Mournhold 212 to 313 m,
    Falinesti 662 to 961 m, Helstrom 184 to 272 m, Alinor 81 to 93 m, Torval 43 to 47 m. Every town past the Bay is a
    site and stands flat at its level.
  - The kernel's cost on mountain pixels past the Bay: about 1.3 times the CPU (30 to 38-44 ms a pixel on a loaded
    machine), on the worker.
- **Residues, named:**
  - The far ring's vertices are 819 m apart, so it cannot draw the ranges' ridges (1.1 to 11.5 km). Its skyline stands a
    few pixels under the ground's on the mean. From 2290,430, 300 m up, at 5 of 180 bearings it stands up to 3.9 pixels
    over it (1080p, 65 degrees), where before it was under one. The middle ring (102 m) draws the ridges to 11.5 km.
  - On the Bay the far views read the large map's law, not WOODS.WLD's own cells: 10 to 35 m off.
  - The ranges' floor (`rangeOn`) is a guard these dials never reach; its mutant is recorded equivalent.
  - The ground past the Bay moved under GROUND_LAW 2 (`net/wire.js`), which is not yet on main, and its print is
    recorded again (`test/fixtures/groundPrint.json`). If GROUND_LAW 2 ships before this does, GROUND_LAW must move to 3
    with it, a relay version: the coordinator's call.
  - PEAKS2's massif (`world/peaks/massif.js`, built, not wired) was to shape the ranges past the Bay too. RELIEF-PEAKS'
    ranges stand there now. When PEAKS2 is wired, past the Bay it stands on them or in their place - one of the two
    (`Peaks.md`).
  - The band's trees (cause 7) are FLORA-GROUND's.

### Pins

- **`test/world/reliefpeaks.test.js` (14, three gated on ARENA2):** the large map's law, the continent's large map cell
  by cell (none at sea, nor by a coast), its blend from the edge; the frames (no step over 10 m past the macro's over a
  cone's summit, where the frames stood 93 m; no pit at the summit); the ranges' parts (the field's mean, the swing, the
  centre, the ceiling, the bound, the cone's profile); the ranges on the land (none low, centred, held under the ceiling
  by the soft clip's law, quiet by the rivers, the cone at its summit with its crater and no moat); the far views on the
  kernel's mean ground and their wiring; the records' frame law, DFU's ground's move (by a town's rect too) and their
  wiring; with ARENA2, WOODS.WLD's large map against the law, the ranges' spans, Bruma's faces, the Bay's edge, and the
  far ring on the freeware's ground. The cone's pins went with it at the merge.
- **PIN MOVED (RELIEF-PEAKS):** `test/render/farlandmark.test.js`, `test/render/farsea1.test.js`,
  `test/render/midring.test.js`, `test/ui/farring.test.js`, `test/systems/landform.test.js`,
  `test/world/terrain/auditlandforms.test.js`, `test/scenes/tv3_travellers.test.js`,
  `test/systems/naval/auditcaptsea.test.js` (the far views' law and wiring), `test/world/breathtaker.test.js`,
  `test/world/tamriel2.test.js`, `test/world/rumarewater.test.js` (the large map), `test/world/peaks1_snowcap.test.js`
  (the Reach's top on either side of its border), `test/world/terrain/bayleftground_frame.test.js` (the frame's law 3),
  `test/net/fb1017f_groundgate.test.js` (the print past the Bay, recorded again under GROUND_LAW 2).
- **Mutants:** `tools/mutants/reliefpeaks.json` (47). Re-aimed by content, each judged again: ACS-G6-ring-grid;
  AUDIT-LANDFORMS-B2-wild-memo-blind-to-the-sample (named by its shaped sample: groundMovedField keeps a memo of the same
  shape); AUDIT-LANDFORMS-II-I1-ring-unfaded and -view-unfaded; BAY-LEFT-GROUND-D1-level-the-Bays-key and
  -world-this-threads-landforms-without; BAY-LEFT-GROUND-D5's five old-laws-step records (the old lift's law LIFT_FRAME_LAW
  now); BREATHTAKER2's six and BREATHTAKER3's two; LANDFORM-restand-scale-only; FAR-FIELD's five; RW-GROUND-the-large-map's-
  detail-whole and TDEEP-detail-at-sea (today's large map named by its note: largeMapBefore keeps the same line);
  TAMRIEL2's two large-map records; TS1-far-ring-on-the-prefab.
- **Cause 7, closed by its own slice:** HORIZON-TREES (`06-Systems/Travel-View.md`): the band's trees cut at the middle
  ring's skyline in their vertex program.

Section A, RELIEF-PEAKS (OURS: DFU stops at the Bay's edge; the large map's law is read off DFU's own WOODS.WLD, and
the ranges and Red Mountain are the port's own).

## EDGE-RUN - the frame's line dropped off the traced coast again (2026-10-29)

The owner saw a hard black line down the lower half of the Bay's west edge, in open sea. It was the traced coast's run
along the Bay's frame, at x -0.109 from y 367 to 454. `dropEdgeRuns` (TAMRIEL4) dropped a run only when both ends lay
exactly on the edge. SMOOTH-LAND's lines cross between two pixel centres, so the frame's own line lies up to half a pixel
off the edge and was kept. A run with both ends within EDGE_RUN_PX (0.5 map pixels) of one edge is now the frame's.

- **Pins:** `test/ui/tamriel4.test.js` (the west edge's -0.109 run dropped, each of the four edges, half a pixel
  either side kept as frame, 0.51 kept as shore).
- **Mutants:** `tools/mutants/edgerun.json` (7, all dead).
