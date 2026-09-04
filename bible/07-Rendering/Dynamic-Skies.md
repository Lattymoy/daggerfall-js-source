# Dynamic Skies - the mod, 1:1 (DS1, 2026-09-04)

Mac: "I want to implement this mod 1:1. We received permission from the
creator. I also want it to be compatible with our current
implementation."

**Dynamic Skies 2.3.4** for Daggerfall Unity, by BadLuckBurt and
carademono (Nexus 376; source github.com/drcarademono/dynamic-skies,
commit `04506e2`, which is the 2.3.4 the shipped `.dfmod` was built
from - the manifests are identical and every preset byte-identical).
Vendored under `vendor/dynamic-skies/` with the permission recorded in
its README, credited on the About screen, and ported as the ENHANCED
LANE'S SKY: while the mod's own `Enabled` switch is on (Mods pane, on
by default - a DFU mod is on by being installed), the lane draws the
mod's skybox in place of the port's own dome (ES1). The classic lane
keeps Daggerfall's painted sky, untouched.

## What the mod is, and where each part landed

The mod is a `MonoBehaviour` (`BLBSkybox.cs`, 2,378 lines) driving one
Unity material on a procedural skybox shader
(`BLBProceduralSkybox.shader`, 914 lines, over Feral Pug's extension of
Unity's own procedural sky), with seven JSON presets (one per
WeatherType), five fog presets, a light curve, and a lightning script.

| the mod's | does | lives here as |
| --- | --- | --- |
| `Init` | material base values, vanilla sky off, presets and fog loaded, `SetLightCurve` | `systems/dynamicSkiesRuntime.js` constructor; `scenes/shared.js` createSkyController builds the pass instead of the dome and calls `worldClock.setLightCurve` |
| `loadAllSkyboxSettings` / `ProcessSkyboxSetting` | JsonUtility over the preset and its five flat sub-structs | `systems/dynamicSkies.js` parseSkyboxSetting (absent fields default, as JsonUtility's structs do) |
| `ApplySkyboxSettings` | every material property from a preset, x0.0833 on the speeds ("because game runs at timescale 12") | `applySkyboxSettings`, quirks kept (below) |
| `ProcessFogSetting` / `loadFogSettings` | REPLACES WeatherManager's five fog settings, density / (11 - densitySetting) | `fogSettingsFromPresets`; the hosts read `fogForWeather(w, sky.fogSettings)` - `world/weather.js` grew the table argument and the `exp2` mode (Unity's ExponentialSquared, which three of the five presets use), `render/renderer.js` grew `uFogMode == 3` in every world pass |
| `SetLightCurve` | replaces SunlightManager.LightCurve with LightCurve.json (flat-tangent keys) | `worldClock.setLightCurve` - the WORLD's daylight curve changes with it, exactly as in DFU (ambient, key light, indirect all read `daylightScale`) |
| `Update` | the day-part machine, `ChangeLunarPhases` -> `ApplyOrbitCalculations`, `UpdateWorldTime`, `setFogColor` every real second, `ApplyPendingWeatherSettings` | `DynamicSkies.tick`, called from the controller's `use()` on the sim's word |
| `OnWeatherChange` (event) | the new preset, applied next frame; the lightning listener for Thunder | `onWeatherChange` / `applyPendingWeatherSettings`; the sim's word changing is the event |
| `SaveLoadManager_OnLoad` | force the saved weather through | `weatherJump`; the FIRST word the sky sees is a load (below) |
| `setFogColor` | RenderSettings.fogColor = FogDayColor toward black on the sun's height | `fogColorNow`; the hosts take `sky.fogColorFor(fogNow)`, which answers the mod's colour under the mod and SetSkyFogColor's law under any other sky |
| `LightningFlash` + `LightningFlashListener` | a point light over the player on `AmbientEffectsPlayer.OnPlayEffect` under Thunder: 50% roll, 33% double, colour 0.8..1, intensity 0.5..1.5, range 500..1000, 0.2 s | `LightningFlash`; `systems/ambientEffects.js` grew `onPlayEffect` (raised where DFU raises it); the hosts hand the light to `renderer.setFlashLight`, which composes it FIRST on the point-light channel under the cap of sixteen |
| `InitSnow` | PixelSnow material, no rotation, min/maxParticleSize (viewport fractions) | `render/precipitation.js` PIXEL_SNOW program over the lab's own flakes (the lab's shaders are pinned byte for byte and stay so) |
| the shader | Unity's procedural scattering, sun disc (HQ), two textured cloud layers with normals, textured stars with a twinkle mask, two moons on elliptical orbits with phase lighting, REDUCE_COLOR posterise | `render/dynamicSkiesRenderer.js` - GLSL ES 3.00, line for line, the property names as uniform names |
| `modsettings.json` | FogDensity/densitySetting 1..10; the pixel snow's toggle and three sliders | `systems/modSettings.js` (integer keys learnt: min/max, clamped) and the Mods pane's steppers; plus `Enabled`, which is the port's |

## Three translations, said out loud

1. **Per pixel above the horizon, the mesh's rows below it.** Unity
   runs the skybox's `vert` on a tessellated mesh and interpolates
   skyColor/sunColor/fogColor; here `vert` runs per pixel on the same
   eye ray above the horizon - the limit of the tessellation. Below it
   that limit is wrong: the ground arm's `far` is at its maximum for a
   ray a hair under the line, where no vertex sits, and a per-pixel
   `vert` painted a bright rim along the whole horizon the mod never
   draws (the DS1 review measured a white row under the horizon at
   dawn). So below the horizon the pass evaluates `vert` at the two
   vertex rows the ray falls between (MESH_ROW = 1/16, the first row at
   y = 0, which takes the sky arm) and interpolates, as a triangle
   would. Unity's own skybox mesh is not in the tree; the sixteen-row
   hemisphere is the recorded equivalence.
2. **Linear colour space.** DFU renders LINEAR
   (`ProjectSettings.asset` m_ActiveColorSpace 1). So: sRGB textures are
   `SRGB8_ALPHA8` (the GPU decodes before filtering, as Unity's does),
   `Material.SetColor` values are linearised at upload
   (`srgbToLinear`), `SetVector`/`SetFloat` are raw, the shader works in
   linear and the pass ENCODES its own output because the port's
   framebuffer is not sRGB. `UNITY_COLORSPACE_GAMMA` is off: no sqrt on
   the colours.
3. **Keywords baked.** The material's: `REDUCE_COLOR`,
   `_SUNDISK_HIGH_QUALITY`, both spin options `TIDAL_LOCK`,
   `PHASE_LIGHT` off. They are not switchable in the mod either.

## DFU facts the port rests on (verified in the DFU tree)

- `SunlightManager.Update`: `time = (MinuteOfDay - dawn) / dayRange`
  UNCLAMPED over the INT minute, `Euler(180 * time, -90, 0)` - the sun
  keeps turning under the horizon all night. The port's
  `worldClock.sunDirection` clamps this for the WORLD light (which DFU
  switches off at night anyway); the sky reads
  `dynamicSkies.sunLightDirection`, the whole turn. `_LightColor0` is
  the rig's colour (linearised) x 0.6 x the mod's curve x
  WeatherManager's ScaleFactor.
- `WeatherType.None == WeatherType.Sunny` (Weather.cs:21).
- `DaggerfallDateTime.Second` is a float; `_WorldTime` is the seconds of
  the day and wraps at midnight (the clouds jump with it - the mod's).
- `AmbientEffectsPlayer.RaiseOnPlayEffectEvent` fires from `PlayEffects`
  after every one-shot (both arms); the cemetery layer never raises it.
- The snow renderer the mod edits is PlayerAdvanced.prefab's
  Snow_Particles INSTANCE, whose override is minParticleSize 0 /
  maxParticleSize 0.075 (the standalone Snow_Particles.prefab says
  0.2); the mod's defaults (100 and 300, /100000) replace both and
  hold a flake between one and three pixels of a 1080p frame.

## Quirks kept ("1:1" is the mod as it ships)

- `ApplySkyboxSettings` writes the Masser tidal angle to
  `_MasserTidalAngle`, a property the shader does not have; the shader's
  `_MoonTidalAngle` keeps the material's (0, 300, 0).
- `_CloudSunScale` takes the TOP layer's SunColorScale.
- `_TwinkleTex`'s offset is the stars' offset.
- `_CloudTopColorBoost` is a float3 fed by a float - only red is boosted
  (the readme: "broken on the top layer for some reason").
- `_CloudDirection` is the preset's Direction (absent -> 0): the random
  wind rolled at Init is overwritten on the first apply; the clouds
  travel +X.
- `firstInit` is set true inside the branch it guards; textures refresh
  on every apply.
- `MaxParticles` is read, logged and never applied.
- `HandleDawnDusk` returns on its first line; `_AtmosphereLerp` is the
  preset's.
- The `*Night.json` presets exist in the repository and are NOT in the
  shipped manifest; index 1 is index 0.
- `OnWeatherChange` returns while an apply is pending, so the event
  that lands in Init's own window is swallowed - in DFU
  `SaveLoadManager_OnLoad` fires after Init with the save's weather and
  drops the flag first. The port has no save event on the sky's frame,
  so the FIRST word the sky sees (and the first after a jump) takes
  that arm. Found by the probe: every weather rendered as Sunny until it
  did.

## The seam, and what "compatible" means here

`createSkyController` (scenes/shared.js) stands the mod BESIDE the
dome on the one lane: `enhancedLane` is the skin, the URL hatch and
the player's switch as before; `dynamicOn` is that lane and the mod's
own switch (`?sky=dynamic` forces it, `?sky=enhanced` / `?sky=smooth`
force the port's dome so every probe riding them keeps its meaning,
`?sky=classic` the panorama). Under the mod:

- the ease and the wind still run (`wind()`, the front, the grass, the
  mills, the enhanced rain all read them), and `cloudShadow` answers a
  deck with the eased row's wind and NO shadow amount - the mod casts
  none and its clouds are textures the ground cannot sample;
- `sunFactor()` is 1 (DFU has no cloud-occluded key light);
- `moonlight()` feeds the port's EV5 term from the MOD's moons - where
  its orbit puts them (the CPU twin of MoonFunctions.cginc), lit by
  DFU's phase - so the world's night agrees with the sky over it;
- the presets switch on the sim's WORD, not the port's front (a DFU mod
  sees WeatherManager's event); the ground's terms still cross on the
  front;
- the port's retro snap is not applied over it (REDUCE_COLOR is the
  mod's own posterise).

Both exterior hosts carry the same six hunks, each marked `DS1:`:
the fog table, the fog colour, the ambience event, the flash light,
the pixel snow, and nothing else. Interiors and dungeons are untouched
(the mod switches its sky off inside).

## Doors and gates

- `sky.html?sky=dynamic` - the lab draws the mod's pass with the lab's
  clock and weather, no data needed; `&density=N` is the slider.
- `node tools/dynamicSkiesProbe.mjs` - eleven checks over ten frames
  (compiles and draws, textures landed, noon blue and bright, the disc
  looking up at noon, stars at midnight, the six weathers differ,
  thunder dark, dusk warm), shots in `/tmp/dsky-*.png`. 11/11 at
  landing, on SwiftShader.
- `test/dynamicSkies.test.js` - 20 pins: the vendored tree is the
  mod's; the structs, the fog law, the light curve; the apply with its
  quirks; the day parts; the moons' ladder, lengths, offsets,
  interpolation and orbits; the CPU orbit maths; the sun and
  `_WorldTime`; the fog colour; the flash's rolls; the instance's
  frame; the shader's uniforms and baked keywords; the seam in both
  hosts; the renderer's exp2 and the flash composition; the ambience
  event; the settings.
- `npm run check` (eslint, the node suite, the build) green; the boot
  probe and the world render gate need ARENA2, which this container
  does not have - they are the next machine's to run.

## Not carried, and one question

Not carried: the eight bundle textures no shipped preset names and the
ten more the manifest never ships (eighteen in all), the `*Night.json`
presets, the NoSun/Simple materials (unreachable), the
sun-shafts scripts (not wired by the mod), the preset-mod door
(FindPresetMod - no other mod to find), the compiled `.dll`, the C#
(ported and cited instead).

The question, for Mac: two texture families name Daggerfall -
`VanillaStars` and the `CdM*` cloud sheets ("created with Daggerfall's
vanilla skies and palettes", per Nexus). Whether they are re-creations
in the vanilla STYLE or derivations of the SKY??.DAT / NITE??I0.IMG
pixels cannot be settled here (no ARENA2 in this container). The
doctrine's rule is that a render of game data is game data and that
Bethesda's art is Bethesda's to waive; they are carried on the authors'
permission as the mod ships them, and swapping a family out is a
preset edit, not a code change. Recorded in the vendor README too,
with the measured evidence (2048x2048 star fields, 512x512 grayscale
cloud cutouts with hundreds of colours, against 320x200 / 512x220
paletted classic frames - suggestive of re-creation, not proof). All
nineteen textures carry rows on `test/doctrine.test.js`'s allow-list,
the first rows there that are not OURS: ten "the mod's own art", nine
"PROVENANCE OPEN, Mac's ruling pending". The windmills precedent left
textures out when they were provably classic exports; these are not
provably that, and are not replaceable without changing the sky.
