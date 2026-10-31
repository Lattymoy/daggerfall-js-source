# Biome Precipitation

On the enhanced lane, whether rain, sleet or snow falls, and whether snow lies on the ground, depends on the air's
temperature at that place, height and minute. Each biome gets its own precipitation: a white peak can stand over a green
valley in a thaw, a cold front brings snow down to the sea, the jungle's rain turns to sleet at its edge, and the Alik'r
desert never sees a flake. The ground keeps the snow that fell and has not melted. Every client sees the same snow.

## How it works

### The air (`src/systems/weather/airTemperature.js`)

`airTemperature(x, z, altitude, t, skyMinutes, fall)` sums five terms:

- **Season** (`seasonAir`): the climate's mean less its half-range on a cosine through the 360-day year, coldest on
  `COLDEST_DAY`.
- **Day** (`dayAir`): warmest at 15:00 (`WARMEST_HOUR`), damped by cloud cover overhead.
- **Spell** (`spellAt`): two octaves of value noise over space and time, drifting with the Bay's air, scaled by the
  climate's swing. These are the cold snaps and thaws; nothing is rolled.
- **Lapse**: 6.5 C a kilometre (`LAPSE_C_PER_M`) above the sea. With no height given, the drawn ground's mean is used.
- **Fall's chill** (`airFall`): a fall cools the air, and snow systems a little more.

Each pixel's air is its climate's row (`CLIMATE_AIR`), blended toward the Ocean's by a maritime share (`MARITIME`) and
read bilinearly between pixel centres, so the air warms across a climate border over a pixel either side, never at an
edge. Latitude moves a climate's far ends (`LATITUDE_C_PER_ROW`). The law's map (`src/systems/weather/airGround.js`
`lawAirGround`, handed with `setAirGround`) reads CLIMATE.PAK undilated plus the continent past the Bay and the Eltheric
Ocean, the same on every client. A biome overlay can lean the air (`setAirBiome`): the jungle registers the Rainforest's
air over a band kilometres wide, so its edge is a walk through sleet.

### What falls

- `snowShareOf`: all snow at 0 C and under (`SNOW_ALL_C`), all rain at 2.5 C and over (`RAIN_ALL_C`), sleet between.
- `precipLawOn` (`src/systems/weather/weatherSim.js`) turns the law on: the enhanced ground law, the weather map, a host
  that handed the air its map, and no `?biomeprecip=off` (ignored online).
- A wet word falls as snow from a half share up, else its own word; a snow front in warm air falls as rain. The word is
  pure in the share, so two clients at one place agree. A storm in freezing air stays a storm: a blizzard with its
  lightning and wind. A phase change alone is no weather change.
- The weather front (`src/systems/weather/weatherFront.js`) carries the share and the rain and flake levels; an ending
  fall drains at the share it fell at.
- `src/render/precipitation.js` `drawFall` draws drops and flakes together at their levels, the flakes' volume offset so
  a flake never falls in a drop's column. The sky's clouds and rain curtains walk from rain to snow tint by the share.

### The snowpack (`src/systems/weather/snowpack.js`)

Every three hours of the event clock (`SNOWPACK.stepMinutes`), at 45 altitude levels from -600 to 8,200 m, a place's
snow water (SWE, mm) steps (`stepPack`): the heaviest wet band's fall adds its snow share; melt is 4 mm a degree-day
over freezing plus the rain's own heat; no pack holds more than 2 m of water (`capMm`). The year starts at midsummer;
a place whose air can keep snow through summer starts from the year before's survival.

The pack only grows with height at a place, so a place's whole pack is its snowline (`snowlineOf`): the heights where
its cover (whole at 10 mm of water, `fullMm`) crosses 10, 50 and 90 %. `coverAtHeight` reads it back. `SnowpackLattice`
keeps points at map-pixel corners every second pixel, each integrated once from its year's origin, walking the weather
map's systems once a day of steps. A step that cannot lay snow anywhere due is skipped exactly. `packNow` blends the two
step packs about the minute, so the pack is continuous in time.

### The ground (`src/scenes/snowCoverHost.js`, `src/render/snowCoverGlsl.js`)

`createSnowCoverHost` keeps an 11 x 11 lattice window about the player, integrated within `SNOW_COVER.budgetMs` (3 ms) a
frame, `arriveMs` (40 ms) while the world stands up. Each frame's snowlines ease toward the pack and go up as one small
texture (`renderer.setSnowFrame`). Each climate's ground binds one 112-layer twin array (summer then winter records).
Each terrain fragment reads its cover from its own height, breaks a thin cover into patches over three octaves, and
wears its own climate's winter record in that share; across a climate border each neighbour's winter blends by the
ecotone's weights. A steep face keeps the snow its height lays. A desert has no winter set, so cover leaves it as is.
The water's bed mixes summer and winter masks by the cover.

### Buildings, flats and the feet

- A pixel's buildings, town swaps, windmills and homes wear Winter where the snow at its middle covers a half
  (`SNOW_COVER.winter`). Each tree, plant and rock flat wears the season of the snow at its own foot against its own
  hash (`flatDraw`), so woods whiten tree by tree across a snowline. Both read the pack's last grid step, so every client
  builds one world.
- At each new step, the sweep marks standing pixels whose decisions changed, nearest first, a slice a frame. The nearest
  is re-skinned in place (`src/scenes/pixelBuild.js` `reskinPixelNow`, DFU's `ApplyClimateSettings`): climate table,
  merge, homes, mills and flat groups are rebuilt aside and traded in one step. Terrain, collider, doors, people and
  grass are never touched. A lane turn rebuilds the pixel instead.
- Grass is not placed where the cover buries a blade. Footsteps ask `winterAt`; the Snowfall mod's `winter` is whether
  snow lies anywhere in the window (`winterNear`), and its surfaces are laid by the ground's cover.

## Rules

- Each biome has its own precipitation, truly dynamic, with seamless transitions in the ground and everything else
  (the owner).
- Snow lies where it fell and has not melted.
- Pure in place and event minute: the air, the weather map and the pack are the same on every client, offline and
  online. Nothing is sent.
- `src/scenes/world.js` wires the air's map, the snow host, the ground draws, the re-skin, the grass, the feet and
  Snowfall. `src/scenes/exterior.js` hands the air no map, so its fall and ground are DFU's season. Interiors and
  dungeons have no weather.
- Doors: `?biomeprecip=off` (offline only) and `?snowground=off`. The classic lane is DFU's, 1:1.

## Daggerfall Unity

DFU has no temperature. It rolls Snow by its climate table in Winter only and dresses the whole world's ground, nature
and buildings in winter archives for the whole of Winter (`TerrainMaterialProvider.GetClimateInfo`,
`src/world/climateSwaps.js` `getTerrainGroundArchive`). Departure: on the enhanced lane the phase of what falls comes
from a modelled air temperature, a snowpack is kept from the weather map's history, and each fragment, tree and building
is dressed by the snow there, re-skinned in place at the snow's turn rather than the calendar's.

## Code and tests

- `src/systems/weather/airTemperature.js` - the air, `snowShareOf`, `CLIMATE_AIR`
- `src/systems/weather/airGround.js` - the law's map
- `src/systems/weather/snowpack.js` - `SNOWPACK`, `stepPack`, `snowlineOf`, `SnowpackLattice`
- `src/scenes/snowCoverHost.js`, `src/render/snowCoverGlsl.js` - the ground's cover
- `src/scenes/pixelBuild.js` - `reskinPixelNow`
- `test/systems/weather/precip1_air.test.js` - the air, map, blend, phase law, front, hosts, ARENA2 calibration
- `test/systems/weather/precip3_snowpack.test.js` - step, melt, cover, snowline, year, lattice
- `test/render/precip4_snowground.test.js` - the shader chunk against the law, the twin, the host
- `test/render/fb1021_snowface.test.js` - no slope rule; lane turns rebuilt
- `test/render/audit_precip_sky.test.js`, `test/scenes/audit_precip_host7.test.js` - the sky and the re-skin

## Open

- The far ring beyond the streamed grid wears its overworld tint and has no snow.
- The Snowfall mod's own depth is still its own state; driving it from the pack is the next step.
- A town's buildings turn together by the snow at its middle; its ground and trees do not.
- The snowline is three crossings, so where a pack's profile flattens between two the cover can read up to 0.32 off.
- A texture pack's snowless winter set is drawn as the pack dresses it under any cover.
- The frame's time on a player's GPU is not measured.
