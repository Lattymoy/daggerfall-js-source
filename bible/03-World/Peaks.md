# Peaks - the mountains, redesigned (PEAKS, 2026-10-26)

The owner, 2026-10-26: *"The world of daggerfall mountains need to be completely redesigned from the ground up with more
integration into the terrian, snow capped, and properly place throughout tamriel."*

The arc has three asks: the mountains part of the land, snow on their tops, and the real ranges in their real places.
It ships in two steps. PEAKS1, the snow caps, is the shading, so it has little blast radius and shipped first. PEAKS2 is
the ranges' own shape. It reshapes the kernel's ground, so every terrain pin in mountain land moves, and it waits for its
own release.

## What the mountains were (measured 2026-10-26, the freeware's trace, landforms on)

- **The heights are already placed.** TAMRIEL-RELIEF (`Tamriel.md`) stands the continent's ranges where the owner's
  heightmap has them, and BREATHTAKER's continuation lets them rise past the Bay's 7-bit top. The kernel's ground at the
  relief's summits: Skyrim's summit 3,191 m (Bay pixel 2076,106), the Jerall 2,844 m (2202,332), the shoulder between
  the Reach and the Dragontails 2,739 m (1490,198), Red Mountain 2,343 m (3051,-51) and Eton Nir 1,968 m (377,1375). On
  the Bay, the Dragontails' tops are about 2,540 m (byte 109, Bay pixels 876-964,442) and the Wrothgarians' about
  1,740 m (951,3).
- **The shape is noise standing on the land.** On the Bay, the Mountain climate wears ridged hills, and LANDFORM8's
  `peakField` stands cones on them (one to a 2.3 km cell, up to 400 m tall, MOUNTAINS-SHARP). They read as separate
  bumps, not as massifs, and a third of a high Mountain pixel stands steeper than 52 degrees (FIELD BUGS 2026-10-21
  SNOW-FACE's own count). Past the Bay, BREATHTAKER3's `ridge` family runs down the macro slope. It is better, but it is
  still a texture on the heightmap's plateau.
- **No summit was white** unless the weather had laid snow there (`systems/weather/snowpack.js`). The far ring, the
  middle ring and the far field were tinted by climate alone, so no range read white on the horizon.
- **The authored spines are wrong in places.** `world/tamriel/tamrielGeography.js` MOUNTAIN_RANGES were drawn from
  memory on the lore map. The Velothi's spine runs over 0-336 m ground, Red Mountain's lies in the sea, and the
  Throat's lies on Skyrim's north shore. `tamrielRelief.js` `namedSummit` corrects the zones' hearts
  (`tamrielBiomes.js`). The other two readers do not use it: the held map's carets (`ui/tamrielInk.js`) and the
  authored law without a relief (`tamrielGround.js` `rangeLift`). That fix belongs to PEAKS2.
- **World of Daggerfall's Mountains layouts** (`world/worldOfDaggerfall/worldOfDaggerfall.js` WOD-PEAKS) were already
  off by default: faceted ARCH3D spires stood as prefabs (FB1001-WODROCK).

## PEAKS1 - the snow caps (shipped 2026-10-26)

`world/peaks/snowcap.js` is the law. `render/snowCapGlsl.js`, `scenes/snowCoverHost.js` and the three far builders wear it.

- **A perennial snowline by place.** Past the Bay's seam each zone has its own line (`SNOWCAP.zones`, keyed by
  `tamrielBiomes.js` BIOMES). On the Bay and its seam the line comes from the climate (`SNOWCAP.climates`). The Bay's
  Mountain and woods lines rise 500 m from its north to its south (`SNOWCAP.bay`), so the Wrothgarians are snowier than
  the Dragontails. A zone with no snow stands its line at `CAP_NONE`, 9 km, which no ground reaches.
- **Seamless.** A map-pixel corner's line is the mean of the four pixels about it (`capLineAt`), and a place reads the
  bilinear of the corners. A border is a slope of the line over a pixel, never a step, and both pixels on an edge read
  one number.
- **A floor under the weather's snow, never over it.** Near the player, each of the snow lattice's points takes the
  lower of the pack's snowline and the cap's (`mergeCapLine`), crossing by crossing. So every reader of the lines wears
  the summits' snow: the ground's fragments, the trees and buildings by their season, the grass and the feet. The cap
  rides on the landforms' ground only: the host reads it off the air's ground, which the world host already hands its map
  with the Landforms row (`airGround.js:"landforms: !!landforms,"`), so bootWorld does not grow (HOST-SPLIT). The snow
  lane is the enhanced lane's (`weatherSim.js` precipLawOn), so the classic skin is untouched.
- **Ledges white, faces rock.** The frame's snowline texels carry the cap's line in their alpha. In both terrain
  programs, a face steeper than `face.held` (normal y 0.8, about 37 degrees) and near or over the line sheds the cover to
  bare rock, fully by `face.bare` (0.62, about 52 degrees). The rock is the tile's own ground set's stone record (DFU's
  base record 3). Under the line SNOW-FACE stands: a face keeps the weather's snow and never sheds to its summer grass.
- **Seasonal.** Near the player the season is the pack's own: the weather's history, integrated (PRECIP3). The far
  views have no pack, so the cap's line comes down by `SNOWCAP.winter` (450 m) toward the coldest day (`seasonalLine`).
  The horizon builds with the perennial line.
- **On the horizon.** The far ring (`buildFarRingGrid` `snowAt`), the middle ring (`midRingVertexSteps` `snowAt`, the
  pixel centres' lines bilinear like their tints) and the far field (`farFieldVertexSteps` `snowAt`, a cell's line at its
  centre) whiten each vertex toward `SNOWCAP.rgb` by `capShare`: its height's cover less its face's rock. They do this
  with the Landforms row only (`farRing.js` `ringSnowAt`), so a range is white 300 km off.

### The ranges (the caps on the freeware's ground)

The kernel's highest ground near each summit (`test/world/peaks1_snowcap.test.js`, the probes), the zone there, and
the perennial line. The macro heights' share of each zone white is from the same day's probe, at midsummer and on the
coldest day.

| Range | Where (Bay pixel) | Zone | Peak | Perennial line | White (summer / winter) |
|---|---|---|---|---|---|
| The Throat of the World, Skyrim's High Peaks | 2076,106 | skyrimPeaks | 3,191 m | 1,250 m | 100% / 100% |
| The Jerall Mountains (and the Valus' west, the Colovian corner) | 2202,332 | cyrodiilJerall | 2,844 m | 1,500 m | 99% / 100% |
| The Reach and the Dragontails' shoulder | 1490,198 | skyrimPeaks / hammerfellDragontail | 2,739 m | 1,250 / 2,250 m | Dragontail zone 34% / 100% |
| The Velothi Mountains | 2743,485 | morrowindVelothi | 2,364 m (macro) | 1,500 m | 35% / 93% |
| Skyrim's pine country | 2115,33 | skyrimPinewood | 2,566 m (macro) | 1,700 m | 42% / 69% |
| The Reach | 1475,145 | skyrimReach | 2,364 m (macro) | 1,650 m | 6% / 20% |
| The Colovian Highlands | 1575,405 | cyrodiilColovia | 2,294 m (macro) | 1,900 m | 6% / 20% |
| The Wrothgarians past the Bay | 1130,-92 | highRockWrothgar | 1,472 m | 1,300 m | 1% / 39% |
| The Wrothgarian Mountains (the Bay's north) | 951,3 | the Bay's Mountain | 1,739 m | 1,350 m | (the Bay's Mountain) 2% / 13% |
| The Dragontail Mountains (the Bay's south) | 964,442 | the Bay's Mountain | 2,542 m | 1,850 m | |
| Red Mountain | 3051,-51 | morrowindRedMountain | 2,343 m | none - its ash is warm | 0% |
| Eton Nir | 377,1375 | summersetVineCoast | 1,968 m | none (summersetEtonNir 1,850 m) | 0% / 3% |
| The Alik'r, Elsweyr, Valenwood, Black Marsh | | | | none | 0% |

### Departures (recorded, `Port-Ledger.md` section A, PEAKS1)

DFU dresses the ground in its winter archive on the calendar alone (TerrainMaterialProvider's +1), and its tile
classifier's tiles are the ground's to the bit. On the snow lane the port's snow is already the weather's own
(PRECIP3/4). PEAKS1 adds three things: a perennial line under it by climate and zone; a steep face near and over that
line drawn as its set's stone record; and the horizon's vertices whitened by the same line. The classic skin, and the
ground and horizon without the Landforms row, are DFU's as before.

### Pins

- `test/world/peaks1_snowcap.test.js`: the law (lines, season, band, face, merge), the chunk against the law term for
  term (`test/glsl.mjs`), the host's merge and the frame's alpha, the three far builders, and, with ARENA2, the caps on
  the freeware's ranges. Its mutants are `tools/mutants/peaks1.json`.
- PIN MOVED (PEAKS1): `test/render/precip4_snowground.test.js` "PRECIP4 BOTH TERRAIN PROGRAMS". The face's line now
  stands between the cover and the ground's snow. The cover is still read once, after the border and before the bed.

## PEAKS2 - the ranges' own shape (designed; the next release)

The massif module, `world/peaks/massif.js`, is to be built self-contained, with its own tests, and left unwired: it goes
into the kernel (`world/landforms.js`) once stream G2's coast work has landed there, and the mountain-land pins move with it,
each re-derived and said why.

- **A range is the land rising.** The shaper takes the place of LANDFORM8's cones with a ridge network. It is a ridged
  field oriented along the range's trend (BREATHTAKER3's oriented frames), with spurs falling across it, valleys between
  them and saddles where two ridges' crests meet low (the passes). Its amplitude grows with the macro ground's height
  over a foothill level, so the foothills grade into the land and nothing stands as a separate object.
- **Placed by the relief.** The named ranges' spines are re-derived from the relief's own ridgelines, `namedSummit`'s
  reach, for every reader (the carets, the authored law).
- **The laws it keeps.** The knee law; one function of world position; the roads, towns, rivers, sites and caches as
  the kernel's every reader takes them; the classic skin to the bit. Every cache keyed on the ground moves its version
  (GROUND_ROLL_VERSION, TAMRIEL_ROADS_VERSION, BAKE_GENERATOR_VERSION).
- **World of Daggerfall's Mountains layouts** are retired as the mountain look. Their Rocks layouts and the routes'
  `mountainPixels` stay.
