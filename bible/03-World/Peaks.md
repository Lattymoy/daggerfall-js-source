# Peaks

The mountains of Tamriel: snow-capped summits, ledges that hold snow, steep faces of bare rock, and ranges that read
white on the horizon. The snow caps are live. The ranges' own shape (the massif) is built and not wired. The heights
themselves come from the relief (`Tamriel.md`, RELIEF-PEAKS) and Red Mountain's cone (`Red-Mountain.md`).

## How it works

`src/world/peaks/snowcap.js` is the snow-cap law (`SNOWCAP`).

- **A perennial snowline by place.** Past the Bay's seam each biome zone has its own line (`SNOWCAP.zones`, keyed by
  `src/world/tamriel/tamrielBiomes.js`). On the Bay and its seam the line comes from the climate (`SNOWCAP.climates`), and the
  Bay's line rises 500 m from north to south (`SNOWCAP.bay`), so the Wrothgarians are snowier than the Dragontails. A
  zone with no snow stands its line at `CAP_NONE` (9 km), which no ground reaches.
- **Seamless.** A map-pixel corner's line is the mean of the four pixels round it (`capLineAt`); a place reads the
  bilinear of its corners, so a border is a slope, never a step.
- **A floor under the weather's snow.** Near the player each point of the snow lattice takes the lower of the weather
  pack's snowline and the cap's (`mergeCapLine`, in `src/scenes/snowCoverHost.js`). Every reader of the snowline (ground,
  trees, buildings, grass, footsteps) wears the summits' snow.
- **Ledges white, faces rock.** In both terrain programs (`src/render/snowCapGlsl.js`), a face steeper than
  `CAP_FACE.held` (normal y 0.8) near or over the line sheds its cover toward bare rock, fully by `CAP_FACE.bare` (0.62).
  The rock is the tile's own ground set's stone record.
- **Seasonal.** Near the player the season is the weather pack's own. The far views have no pack, so their line comes
  down by `SNOWCAP.winter` (450 m) toward the coldest day (`seasonalLine`).
- **On the horizon.** The far ring, the middle ring and the far field whiten each vertex toward `SNOWCAP.rgb` by
  `capShare` (`src/render/farRing.js` `ringSnowAt`), so a range is white from far off.

The massif (`src/world/peaks/massif.js`) is a range as the land rising: spurs and valleys stretched down the fall line
on a flank (read in `src/world/tamriel/tamrielLandforms.js` `orient` frames), and slow crests with summits and saddles on
the high ground, blended by grade. Its amplitude grows with height over a knee, nothing on low ground. Nothing reads it
yet.

## Rules

- The mountains are redesigned from the ground up: integrated into the terrain, snow-capped and placed throughout
  Tamriel (the owner).
- The caps ride the Landforms row and the enhanced snow lane only. The classic skin, and the ground and horizon without
  Landforms, stay DFU's.
- The cap is a floor under the weather's snow, never over it.
- Red Mountain has no perennial line: its ash is warm (`ashShareAt`).
- Tamriel: every zone past the Bay has a line in `SNOWCAP.zones`, or `CAP_NONE`. The Bay reads its climates.

## Daggerfall Unity

DFU dresses the ground in its winter archive on the calendar alone (`TerrainMaterialProvider`), with no snowline.
Departure: a perennial line by climate and zone, steep faces as stone near and above it, and the horizon whitened by
the same line.

## Code and tests

- `src/world/peaks/snowcap.js` - the snowline law
- `src/render/snowCapGlsl.js` - the face's dials and the shader chunk
- `src/scenes/snowCoverHost.js` - the merge with the weather's pack
- `src/world/peaks/massif.js` - the range shape (not wired)
- `test/world/peaks1_snowcap.test.js` - the law, the chunk against the law, the host merge, the far builders, and the
  caps on the real ranges with ARENA2
- `test/world/peaks2_massif.test.js` - the massif's shape, steepness and cost
- `tools/mutants/peaks1.json`, `tools/mutants/peaks2.json` - the mutants

## Open

- Wiring the massif into `src/world/landforms.js` `hillsAt`, in place of `peakField` and the Mountain land's ridged
  shape on the Bay, and over the relief's ranges past the Bay. Every terrain pin in mountain land moves with it, and
  every cache keyed on the ground moves its version.
- The authored range spines in `src/world/tamriel/tamrielGeography.js` `MOUNTAIN_RANGES` are off in places. The biome
  zones read `namedSummit`; the held map's carets (`src/ui/tamrielInk.js`) and the authored ground
  (`src/world/tamriel/tamrielGround.js`, through `tamrielGeography.js` `rangeLift`) do not.
