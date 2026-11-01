# The Classic World Look

This page holds how the renderer reproduces Daggerfall Unity's world look on the classic lane: climate and season
texture swaps, glowing windows, lanterns, painted skies, the day and night light, dungeon and interior lights, water,
the terrain tilemap, weather fog and skies, and precipitation. Each is a port of DFU's own law and numbers. The enhanced
lane builds its looks on top of these (`Rendering.md` for the renderer itself).

## How it works

### Textures by climate and season (`src/world/climateSwaps.js`)

A 1:1 port of DFU's `ClimateSwaps`: an archive under 500 rebases to its climate's base plus `archive % 100`, plus the
weather variant (Winter 1, Rain 2) where the set supports it, with DFU's exceptions kept in C# precedence (door-frame
tapestries, swamp marble floors, deserts never in winter, the castle winter kill, the archives that never rebase).
`getTerrainGroundArchive` gives the ground's archive, the winter set for the whole of Winter in every climate but a
desert base. Seasons of the Iliac Bay and Biome Precipitation change this on the enhanced lane.

### Windows and lanterns

- **Window emission** (`src/render/windowEmission.js` `WINDOW_STYLES`): day `(89, 154, 178)` at 0.5, night
  `(255, 182, 56)` at 0.8, fog grey at 0.5; emission is colour times intensity on the glass texels (palette index 0xff)
  of the archive and record pairs `isExteriorWindow` names, evaluated after the climate swap. The night style follows
  `IsCityLightsOn`.
- **City lanterns** (`src/world/city/cityLights.js`): one point light per archive-210 flat, placed by DFU's `AddLight`
  in both RMB paths, at the [City] prefab's range of 18. They burn from 17:00 to 08:00 and flicker by DFU's
  `DaggerfallLight` animation.

### Skies (`src/formats/skyFile.js`, `src/render/skyRenderer.js`)

`SkyFile` is ported verbatim: 32 palettes and 64 painted 512 x 220 frames a file, record 0 east and record 1 west.
`DaggerfallSky`'s logic picks frames across the day (the afternoon mirrored) and the night sky. Weather picks the sky
set. The enhanced lane replaces this with the port's dome or Dynamic Skies; the classic panorama is untouched.

### Day and night (`src/world/worldClock.js`)

DFU's clock: dawn 6, dusk 18, lights on 17, lights off 8. The sun follows `SunlightManager` (`t = (minute - 360) / 720`,
dawn from map east), hard off at night, scaled by the `SunlightRig` light curve's Hermite keys and the weather's
sunlight scale. Ambient is `PlayerAmbientLight`'s. The exterior indirect light is the rig's point light (intensity 1,
range 150, grey 0.706) at the player.

### Dungeons and interiors

- **Dungeon lights** (`src/world/dungeon/dungeonLights.js`): one per RDB light object, range `Radius * GlobalScale * 3`,
  the [Dungeon] prefab's intensity 0.8, white, flickering.
- **Interior lights** (`src/world/interior/interiorLights.js`): DFU's `DaggerfallInterior.AddLight`, one per
  archive-210 flat at the billboard's centre plus DFU's per-record vertical offsets, with the [Interior] prefab's
  properties.
- **Dungeon water**: one plane per block whose water level is not the 10000 sentinel, at DFU's level, sampling the
  classic water picture of the location's climate, scrolling slowly.

### Terrain (`src/world/terrain/terrainSurface.js`)

DFU ships ground as a 129 x 129 height grid and a 128 x 128 tilemap byte texture a map pixel, decoded per fragment by
`Daggerfall/TilemapTextureArray`: `tileIndex = data >> 2`, `transform = data & 3`, four rotations and flips.
`convertTilemap` is DFU's `UpdateTileMapDataJob` 1:1, with water's 0xFF sentinel. A town's RMB ground tiles are
gathered into one location-wide tilemap, random markers 56 and up reset to grass.

### Weather (`src/world/weather.js`)

`WeatherManager` verbatim: the seven words; the fog table (sunny and overcast linear 0 to 2400, rain exp 0.003, snow
exp 0.005, heavy exp 0.05 with the sky included, interior exp 0.001 and dungeon exp 0.005 with black fog); DFU's
`SetWeather` mapping (cloudy keeps sunny fog; fog weather takes the rain sky and heavy fog); the window style by weather.

### Precipitation (`src/render/precipitation.js`)

Rain streaks and drifting snow as a shader-animated particle volume that wraps round the camera, with no per-frame CPU
work. Drawn last, blended, depth-tested without writes, unfogged. DFU's particle prefabs keep their values in animation
curves, so only the cap is DFU's: 1000 (`PRECIP_MAX_PARTICLES`). Storm lightning is `AmbientEffectsPlayer.PlayLightningEffects`
verbatim (`src/world/weather.js`): strikes every 4 to 35 s, each a run of frames that may double the sun, so at night,
with the sun off, the flashes are invisible as in DFU. The enhanced lane draws the prototype's own fall and bolts
instead (`Weather-Arc.md`).

## Rules

- **The handedness law.** DFU's world data is left-handed (x east, y up, z north). The renderer mirrors the projection
  once (`src/world/mat4.js` `mirrorProjectionX`) and every consumer keeps scene coordinates; nothing else flips. Text
  in the world is the check: a sign that reads backwards means a second flip.
- Where DFU keeps a value in a prefab, the serialized prefab is the authority, not a comment or a guess.
- The classic lane keeps these numbers; an enhanced look never edits them in place.

## Daggerfall Unity

Every section above names its DFU source: `ClimateSwaps`, `MaterialReader`'s window styles, `RMBLayout.AddLight`,
`SkyFile` and `DaggerfallSky`, `DaggerfallDateTime`, `SunlightManager` and the `SunlightRig` prefab,
`PlayerAmbientLight`, `RDBLayout.AddLight` and `AddWater`, `DaggerfallInterior.AddLight`, `TerrainHelper`, and
`WeatherManager`. Departures: the presentation of precipitation (only its cap is DFU's); our own WebGL renderer behind
all of it.

## Code and tests

- `src/world/climateSwaps.js`, `src/render/windowEmission.js`, `src/world/city/cityLights.js`
- `src/formats/skyFile.js`, `src/render/skyRenderer.js`, `src/world/worldClock.js`
- `src/world/dungeon/dungeonLights.js`, `src/world/interior/interiorLights.js`
- `src/world/terrain/terrainSurface.js`, `src/world/weather.js`, `src/render/precipitation.js`
- `src/world/mat4.js` - `mirrorProjectionX`
- `test/world/weather.test.js` - the fog table, the lightning's strobe and its clip classes
