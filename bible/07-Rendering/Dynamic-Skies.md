# Dynamic Skies

Dynamic Skies is the enhanced outdoors' sky, our own, on by default. It gives each hour and weather its own sky: a
gradient from zenith to horizon, the sun's disc and glow, both moons lit by their phase, a turning star field, two
cloud layers, the weather's own fog, longer sunrises and sunsets, and lightning in storms. It takes the place of
BadLuckBurt's and carademono's Dynamic Skies 2.3.4 (OWN-WORK, the owner; the release's record is in
`01-Overview/Own-Work.md`), keeping its switch, its five settings and every place the sky is wired. The player meets
it as the **Dynamic Skies** choice on the Enhanced environments tile; Port sky is the alternative. The classic lane
keeps Daggerfall's painted sky.

## How it works

- **The law** (`src/systems/dynamicSkies/dynamicSkies.js`, pure). The hour, the weather and the season in; the frame's
  colours, sun, moons, stars and cloud layers out (`skyFrame`). Every number is the rule below, chosen for this game.
- **The instance** (`src/systems/dynamicSkies/dynamicSkiesRuntime.js` `DynamicSkies`), built in place of the dome by
  `src/scenes/shared.js` `createSkyController`. A new weather is walked to over `SKY_EASE_MINUTES` (3 game minutes);
  a jump past `SKY_JUMP_MINUTES`, a load or a clock gone back takes the new row whole.
- **The pictures** (`src/systems/dynamicSkies/dynamicSkiesAssets.js`): the sky's noise (`paintSkyNoise`) and the pixel
  snow's flake (`paintSnowflake`), painted at runtime.
- **The pass** (`src/render/dynamicSkiesRenderer.js` `DynamicSkiesRenderer`). Our own GLSL, written from the effect:
  the gradient down to the ground, the sun, the moons, the stars, the two cloud layers, the host's fog, then
  `SKY_LEVELS` (48) levels a channel through the world-fixed ordered dither (`?bands=raw` shows the raw levels). Its
  contract is the port sky's: `draw` after `beginFrame`, fog written by the host.
- **The light** follows `DYNAMIC_LIGHT_CURVE` through the world clock, so the world's daylight follows the sky.
- **The fog.** `fogSettingsFromPresets` gives each weather its fog (`FOG_PRESET_FOR_WEATHER`); the hosts read
  `fogForWeather(w, sky.fogSettings)`. On the land the night fog is never darker than the lit air
  (`src/systems/weather/nightFog.js`).
- **The storm's flash** (`StormFlash`, `FLASH_LOOK`), on an ambient one-shot under Thunder.

| part | our rule |
|---|---|
| hour | five anchors on the sun's height (-0.3, -0.12, 0, 0.16, 0.42; `SKY_HOURS`): navy night, indigo blue hour, an orange horizon at rise and set, the golden hour, a day blue lifted toward white at the horizon |
| weather | one cover c and one grey a weather (`WEATHER_LOOK`): the colours mix to the grey by c^1.5 and darken by 0.35 c^2; the sun, moons and stars show (1 - c^2)^2 (`weatherShow`) |
| clouds | two layers cut from equalized noise: the low covers c, the high 0.3 (1 - c), faded out from 0.16 to 0.07; they drift on the game clock (`CLOUD_LOOK`) |
| season | the calendar's, the same in every province: summer deeper, autumn golden, winter paler, by the hour's light (`SEASON_LEAN`) |
| moons | where the port's dome puts them; Masser rose, Secunda silver; lit from the sun's side by the clock's phase (`moonPhaseLight`) |
| stars | two layers hashed from cube-face cells and a faint band, turning once a day about the dome's pole (`STAR_LOOK`) |
| fog | the clear row linear to 4,800; every other row exp2, half the light at d50 (overcast 1,100, rain 700, snow 450, fog 120, sandstorm 90, ash 400), so each hides the ground by the far views' nearest edge; the slider thickens by 1 + (x - 1) / 3 (`FOG_LOOK`) |
| light | 0.92 sin(pi t)^0.6 over the day: longer sunrises and sunsets than the rig's (`LIGHT_RULE`) |
| pixel snow | our six-armed flake; `MaxParticles` (thousands) caps the flakes drawn (`pixelSnowSettings`) |
| storm flash | a clap is seen at 0.65; one to four strokes, each a 12 ms rise and a 70 ms fall, 50 to 120 ms apart, each fainter; a cold light 40 to 160 m off and 60 to 120 m up; the dome takes 0.35 of it and the clouds more |
| noise | each octave's lattice turned by a whole-number matrix and shifted, so no crease lines up (`OCTAVE_TURNS`) |

### Beside the port's sky

- The enhanced lane composes it in `src/scenes/shared.js`: `dynamicOn` is the lane plus the switch's `Enabled`.
- The weather ease and the wind still run for everything below the sky. The world's moonlight takes the sky's moons.
- Our volumetric clouds draw over the sky. While they do, its two cloud layers stand down
  (`DynamicSkiesRenderer.cloudsExternal`), and the clouds read its sun, moons and fog colour through
  `src/render/dynamicSkiesBridge.js` `cloudsStateUnderMod`. Under a lid the volumetric cirrus keeps only a trace
  (`src/render/volumetricClouds.js` `CIRRUS_COVER`: overcast 0.1, rain and snow 0.08, thunder 0.06), so no bright
  streak shows through. `?clouds=off` gives the sky its layers back.
- Interiors and dungeons draw no sky.

## Rules

- Our own sky (OWN-WORK, the owner), compatible with the port sky (Mac).
- All mods are enabled by default (Mac), so Dynamic Skies is the lane's sky until its switch is turned off
  (`src/world/outdoors.js` `OUTDOORS_DEFAULT` `dynamic`).
- The levels are dithered with a zero-mean ordered dither indexed to the sky's own cells, so the bands do not crawl
  (Mac).

## Daggerfall Unity

The release was a DFU skybox mod (`BLBSkybox.cs`, `BLBProceduralSkybox.shader`). Departures: every look is our rule,
the shader is our own, the pictures are painted at runtime, and `MaxParticles` caps the pixel snow, which the mod
logged and never applied.

## Code and tests

- `src/systems/dynamicSkies/dynamicSkies.js` - the rule: hours, weather, seasons, moons, stars, clouds, fog, light,
  the storm's flash
- `src/systems/dynamicSkies/dynamicSkiesRuntime.js`, `dynamicSkiesAssets.js` - the instance and the painted pictures
- `src/render/dynamicSkiesRenderer.js` - `DynamicSkiesRenderer`, the pass
- `src/render/dynamicSkiesBridge.js` - the clouds' state and the sky's moons
- `test/systems/dynamicSkies.test.js` - the rule's tables as literals, the pass's uniforms, the band dither
- `test/render/ds2_cloudsUnderMod.test.js` - our clouds over the sky
- `tools/dynamicSkiesProbe.mjs` - draws and checks the sky at noon, midnight and in each weather
