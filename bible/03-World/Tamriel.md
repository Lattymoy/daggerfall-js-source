# Tamriel

The whole continent round the Iliac Bay, on the Bay's own grid and scale, joined to its coast. It is drawn on the held
map, streamed as land the player walks, raised to the owner's heightmap, shaped with its own landforms, and carries the
Imperial City's lake and the Niben as sea. The player meets it zooming the held map out past the Bay and walking or
sailing past the Bay's edge. Its zones are `Tamriel-Biomes.md`; its places `World-Wide.md` and `Arena-Provinces.md`.

## How it works

- **The frame** (`src/world/tamriel/tamrielFrame.js`). A Tamriel pixel is 819.2 m, the Bay's own. The continent is
  `TAMRIEL_W` x `TAMRIEL_H` (6000 x 3750) pixels, the Bay standing at `BAY_ORIGIN` (862, 975). `bayToTamriel` and
  `tamrielToBay` are the one offset; `inBay` is the Bay's own data's ground. Coordinates the game keeps stay what they
  were.
- **The trace** (`src/ui/tamrielTrace.js` `traceTamrielPicture`). At boot the continent is traced from the player's
  own TMAP00I0.IMG (the race screen's painting) and TAMRIEL2.IMG (its picker): the picker's masks are the eight
  homelands, and the Imperial Province is what the masks and the painting's coast line enclose. The Bay's place on the
  picture is found, not authored. Nothing of either file ships. `?tamrieltrace=off` keeps the authored shape
  (`src/world/tamriel/tamrielGeography.js`), offline only; online the land is the room's.
- **The land law** (`src/world/tamriel/tamrielLand.js` `landLaw`). One smooth law answers land, sea and province for
  every point past the Bay: marching-squares outlines over the picture's pixel centres, cut by Chaikin's rule, signed
  distances read by Catmull-Rom, so coasts and borders are smooth lines, and every map line is its edge
  (`provinceKeyAt`). A coast run along the frame's edge is dropped (`src/ui/tamrielInk.js` `EDGE_RUN_PX`).
- **The ground** (`src/world/tamriel/tamrielGround.js`). It answers the terrain kernel's WOODS.WLD and CLIMATE.PAK
  reads for any pixel: the Bay's own on the Bay, the continent's past it. The stream builds past the Bay as on it.
- **The relief** (`src/world/tamriel/tamrielRelief.js`, data `src/world/tamriel/tamrielReliefData.js`). The owner's
  heightmap (`src/assets/tamriel/source/tamriel-heightmap.png`) is fitted onto the trace's land by
  `tools/bakeTamrielRelief.mjs` (an affine fit and a smooth warp) and sets how high the land stands; the coasts stay the
  trace's.
- **Landforms past the Bay** (`src/world/tamriel/tamrielLandforms.js`, `src/world/landforms.js` `continentLift`). The
  lift goes on past the Bay's 7-bit top under the world's ceiling. The large map stands at the Bay's own ratio, so the
  same byte stands as high either side. Oriented landform families add ridges, foothills, drumlins and gullies under
  the heightmap's grain, easing to a fixed frame where direction is weak. The ranges stand as mountains on a ridged
  field (`src/world/tamriel/tamrielRanges.js`), and Red Mountain is a cone (`Red-Mountain.md`). The far views stand the
  same ground.
- **Waters** (`src/world/tamriel/tamrielWaters.js`). Lake Rumare is joined through the Niben to the Topal Bay
  (`NIBEN_COURSE`, `openNiben` in the trace), so ships and voyages reach the Imperial City. The city's lake is the sea's
  own water, carved as deep, reached through a mouth in the far shore (`src/world/imperialCity.js` `IMPERIAL.mouth`).
  Cyrodiil's rivers are carved into the land, and a settlement reads them as water (`carvedWaterAt`, `RMB-Contracts.md`).
- **The held map** (`src/ui/heldMap.js`, `src/ui/tamrielInk.js`). The enhanced world sheet zooms out past the Bay onto
  the continent; a hover names the province, capital or sea. Painted only when the view reaches past the Bay.

## Rules

- Build the entirety of Tamriel connected accurately to Daggerfall; detailed; performance unaffected (Mac).
- The map must look like Daggerfall's own map, accurately traced (Mac, the owner).
- Use the owner's heightmap for heights; the land stays the trace's (the owner). Its derived data ships by the owner's
  permission; the PNG stays a source.
- The Imperial City's lake and the Niben are part of the sea, sailable by AI and player ships (the owner).
- Landscapes follow the heightmap and are diverse below its grain; mountains stand as mountains (KPbICA's spec,
  forwarded by the owner). Coasts and borders are smoothed to the most detail (the owner).
- Daggerfall's Tamriel: nine provinces, SUMURSET spelled the game's way, the Imperial Province at the heart.
- Game files are traced on the player's machine; no render of game data enters the repository.
- `tamriel-map` (Features) shows the continent on the held map, on by default; `?tamriel=off` the kill door.
- The Bay keeps its own data to the bit.

## Daggerfall Unity

DFU's map ends at the Bay's edges. The continent, its trace, heights, landforms and waters are the port's own departure
(TAMRIEL).

## Code and tests

- `src/world/tamriel/` - frame, geography, land law, ground, relief, landforms, ranges, waters
- `src/ui/tamrielTrace.js`, `src/ui/tamrielInk.js` - the trace and the map's ink
- `test/ui/tamriel.test.js`, `test/ui/tamriel4.test.js` - the frame, the ink, the trace's faults, the edge run
- `test/world/tamriel2.test.js`, `test/world/tamriel3.test.js` - the streamed land, the trace and fit
- `test/world/tamrielrelief.test.js` - the heightmap's fit
- `test/world/nibensea.test.js`, `test/world/rumarewater.test.js` - the Niben and the city's lake
- `test/world/breathtaker.test.js`, `test/world/smoothland.test.js`, `test/world/reliefpeaks.test.js` - landforms,
  the land law, the ranges
