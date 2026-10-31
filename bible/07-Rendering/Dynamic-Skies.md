# Dynamic Skies

Dynamic Skies (BadLuckBurt and carademono, version 2.3.4, Nexus 376) is a Daggerfall Unity skybox mod we port 1:1 and
ship on by default as the enhanced outdoors' sky. It gives each weather its own sky: textured cloud layers, twinkling
stars, both moons on their orbits with phase lighting, its own fog colours, longer sunrises and sunsets, and lightning
in storms. The player meets it as the **Dynamic Skies** choice on the Enhanced environments tile; Port sky is the
alternative. The classic lane keeps Daggerfall's painted sky.

## How it works

The mod is one `MonoBehaviour` (`BLBSkybox.cs`) driving a procedural skybox shader (`BLBProceduralSkybox.shader`), seven
weather presets, five fog presets, a light curve and a lightning script. Where each part lives:

| The mod's | Does | Here |
|---|---|---|
| `Init` | material base values, presets, fog, light curve | `src/systems/dynamicSkies/dynamicSkiesRuntime.js`; `src/scenes/shared.js` `createSkyController` builds the pass in place of the dome |
| `ProcessSkyboxSetting`, `ApplySkyboxSettings` | preset JSON to material, speeds x 0.0833 | `src/systems/dynamicSkies/dynamicSkies.js` `parseSkyboxSetting`, `applySkyboxSettings` |
| `ProcessFogSetting` | replaces WeatherManager's five fog settings | `fogSettingsFromPresets`; the hosts read `fogForWeather(w, sky.fogSettings)`, with Unity's ExponentialSquared as a fog mode |
| `SetLightCurve` | replaces SunlightManager's light curve | `worldClock.setLightCurve`; the world's daylight follows it, as in DFU |
| `Update`, `OnWeatherChange` | day parts, lunar phases and orbits, fog colour, pending preset | `DynamicSkies.tick`, on the weather sim's word |
| `setFogColor` | fog colour toward black with the sun's height | `fogColorNow`; on the land the night fog is never darker than the lit air (`src/systems/weather/nightFog.js`) |
| `LightningFlash` | a point light over the player on an ambient one-shot under Thunder | `LightningFlash`; `src/systems/ambientEffects.js` `onPlayEffect`; `renderer.setFlashLight` |
| `InitSnow` | pixel snow material | `src/render/precipitation.js` PIXEL_SNOW program |
| the shader | procedural scattering, sun disc, two cloud layers, stars, two moons, colour posterise | `src/render/dynamicSkiesRenderer.js`, GLSL line for line |
| `modsettings.json` | fog density, pixel snow | `src/systems/modSettings.js` `dynamic-skies` keys, plus our `Enabled` |

### Beside the port's sky

- The enhanced lane composes it in `src/scenes/shared.js`: `dynamicOn` is the lane plus the mod's `Enabled`.
- Under the mod the weather ease and the wind still run for everything below the sky. `sunFactor()` is 1; the world's
  moonlight takes the mod's moons where its orbits put them.
- Presets switch on the weather sim's word, not on our eased front.
- Our volumetric clouds draw over the mod's sky. While they do, the mod's two cloud sheets are skipped
  (`DynamicSkiesRenderer.cloudsExternal`), and the clouds read the mod's sun, moons and fog colour through
  `src/render/dynamicSkiesBridge.js` `cloudsStateUnderMod`. The clouds cast their shadow on the ground; the mod casts
  none. `?clouds=off` gives the mod its sheets back.
- The mod's skybox takes no fog, as its shader computes and discards the fog factor.
- Interiors and dungeons draw no sky.

## Rules

- 1:1 with the shipped 2.3.4, with permission from the creators, and compatible with our own sky (Mac).
- All mods are enabled by default (Mac), so Dynamic Skies is the lane's sky until its switch is turned off
  (`src/world/outdoors.js` `OUTDOORS_DEFAULT` `dynamic`).
- Three translations: the shader runs per pixel above the horizon and interpolates between the mesh's vertex rows
  below it (a per-pixel run there paints a bright rim the mod never draws); DFU renders linear, so sRGB textures decode
  on the GPU, colours are linearised at upload and the pass encodes its own output; the material's keywords are baked.
- Quirks kept, because the mod ships them: the Masser tidal angle written to a property the shader lacks;
  `_CloudTopColorBoost` doing nothing; the lightning listener kept as one multicast delegate (a Thunder round trip
  through a door subscribes twice); the `*Night.json` presets not shipped, so index 1 is index 0; the first weather
  word the sky sees takes the load arm.
- Two departures, on Mac's word: the posterise's bands are dithered with a zero-mean ordered dither indexed to the sky's
  own cells, so the bands do not crawl (`?bands=raw` restores the mod's raw quantizer); and the three star fields
  (`VanillaStars`, `DefaultStars`, `NLStarsBlack`) are filtered bilinear, so the authored background stipple does not
  read as dark spots when magnified. Twinkle masks and noise stay point.

## Code and tests

- `src/systems/dynamicSkies/dynamicSkies.js` - presets, fog, material, day parts, moons (`TEXTURE_IMPORTS` holds each
  texture's filter)
- `src/systems/dynamicSkies/dynamicSkiesRuntime.js`, `dynamicSkiesAssets.js` - the runtime and the vendored files
- `src/render/dynamicSkiesRenderer.js` - `DynamicSkiesRenderer`, the shader
- `src/render/dynamicSkiesBridge.js` - the clouds' state and the mod's moons
- `vendor/dynamic-skies/` - the vendored mod and its permission
- `test/systems/dynamicSkies.test.js` - the port, the quirks, the band dither
- `test/render/ds2_cloudsUnderMod.test.js` - our clouds over the mod's sky
- `tools/dynamicSkiesProbe.mjs` - draws and checks the sky at noon, midnight and in each weather

## Open

- Two texture families name Daggerfall (`VanillaStars` and the `CdM*` cloud sheets). Whether they are re-creations in
  the vanilla style or derived from SKY??.DAT pixels is unsettled; they ship on the authors' permission, marked
  "provenance open" on the doctrine allow-list, awaiting Mac's ruling.
- Not carried: textures no shipped preset names, the unreachable materials, sun-shaft scripts and the mod's dead members.
