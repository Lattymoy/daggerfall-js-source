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
LANE'S SKY: while the mod's own `Enabled` switch is on (Mods pane; on
by default until VC1, 2026-09-07, when Mac asked for the pixelated sky
look to go - the mod's 512-pixel cloud sheets drawn nearest and its own
colour posterise ARE that look, and they are the mod's to keep, so the
port's own dome became the lane's sky and the mod the player's choice;
on by default AGAIN since MO1, 2026-09-12 - Mac: "All mods should be
enabled by default" - so the mod's skybox is the lane's sky until its
switch is turned off - the volumetric clouds over it since DS2 and the
Pixelated sky switch on it since PS2; the port's own dome draws while
it is), the lane draws the mod's skybox in place of the port's own
dome (ES1). The classic lane keeps Daggerfall's painted sky, untouched.

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
- `_CloudTopColorBoost` is a float3 fed by a float (a Range property):
  the vector stays zero and the top boost does nothing - the readme's
  "broken on the top layer for some reason". (AUDIT 61: the port had
  uploaded `(boost, 0, 0)`, a red tint the mod never shows.)
- The lightning listener is a C# multicast delegate and is KEPT AS ONE
  (AUDIT 61): `LightningFlashListener.StartListening` is `+=` on
  `AmbientEffectsPlayer.OnPlayEffect`, duplicates kept, and
  `StopListening` removes one. A Thunder round trip through a door
  (InteriorTransitionEvent drops one and nulls the coroutine;
  ExteriorTransitionEvent re-subscribes without it) and the next
  `OnWeatherChange` that takes its branch subscribe TWICE - two rolls
  per one-shot - and leaving Thunder removes one, so the other rolls on
  every outdoor one-shot for the rest of the session.
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

Both exterior hosts carry the same hunks, each marked `DS1:`: the fog
table, the fog colour, the ambience event, the flash light, the pixel
snow, and - since AUDIT 61 - the transition edge (`sky.setInside` on
the modal frame's first return and before the next sky frame:
PlayerEnterExit's interior/dungeon transitions, which tear the flash
down and re-arm the listener), the word the ambience is playing beside
the one-shot (under the port's front the presets follow the front, so
the flash follows the storm clips it can hear, which is what DFU shows
where the two words never differ), the one sunlight scale the ground
takes on the sky's frame (`wxNow.sun` - WX2's front blend of the
host's `weatherSun`, the raw row under `?front=off`: ONE
SetSunlightScale, so the ?season pin and the fast-travel latch reach
`_LightColor0` as they reach the ground), and the port's sun strobe
standing down under the mod (one lightning, the mod's).
Interiors and dungeons draw no sky (the mod switches its sky off
inside).

AUDIT 61 also settled three seams the port's own machinery had put
over the mod: the mod's fog rows are installed VERBATIM (EV4's
distance scale is the law over DFU's 0..2400 row, not over FogSunny's
2000..3600 - `BLBSkybox.SetFogDistance` writes the end distance as
authored); the far ring's fog ramp starts where the row starts (a row
that starts at 2000 fogged the ring from 0); and EV5's moonlight takes
the port's eased cover as the stand-in for the mod's cloud textures,
the dome's own `1 - cover * 0.35`.

## Doors and gates

- `sky.html?sky=dynamic` - the lab draws the mod's pass with the lab's
  clock and weather, no data needed; `&density=N` is the slider.
- `node tools/dynamicSkiesProbe.mjs` - eleven checks over ten frames
  (compiles and draws, textures landed, noon blue and bright, the disc
  looking up at noon, stars at midnight, the six weathers differ,
  thunder dark, dusk warm), shots in `/tmp/dsky-*.png`. 11/11 at
  landing, on SwiftShader.
- `test/dynamicSkies.test.js` - 21 pins: the vendored tree is the
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
(ported and cited instead). And, named by the MODS AUDIT of 2026-09-08,
the mod's own DEAD members - unreachable in the shipped mod, so not
ported: `getSunColor` (:607-641), the `AtmosphereLerp`/`SunFogLerp`
coroutines (:479-508) with `AbortAtmosphereLerp` (:471-478) and
`calculateScaledLerpDuration` (:510-513) - all behind `HandleDawnDusk`'s
first-line `return`; `getVanillaFogSettings` (:1143-1159) and
`setFogSettings` (:1160-1178), no callers; `SetPalettizationMaterial`
(:1818), `vgaPalette` (:1826+) and `InitLut` (:2333) with
`BLBFastPalette.cs`, the call site commented at :158; `OnMidday`
(:380-382); and `onEnable`/`onDisable`/`OnLoadEvent` (:282-301), spelled
in lower case so Unity never calls them. Also not carried: `Awake`'s
`Mod.IsReady`, `LateUpdate`'s per-frame `clearFlags = Skybox` (the
reason the port's pass takes no host fog - see the MODS AUDIT section),
`LightningFlash.LateUpdate`'s colour re-force (no observable effect),
the settings file's two section names and descriptions (the pane is a
flat key list; the per-key descriptions are verbatim), and the
`$type` discriminators (re-expressed as the presence of `min`/`max`).

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

## AUDIT 62 F29 (2026-09-07): the transition event gets its caller

`DynamicSkies.setInside` had been ported and had no caller anywhere in
`src/` - `grep -rn 'setInside(' src` answered with the definition and
nothing else - so `playerInside` was never true and the mod's
`InteriorTransitionEvent` teardown never ran.

The load-bearing half is not the listener flags; it is the FLASH.
`BLBSkybox.cs:1236-1240` subscribes the same handler to
`OnTransitionInterior`, `OnTransitionDungeonInterior` (and the exterior
pair to the other), and `:1247-1284` - under `pendingWeatherType ==
WeatherType.Thunder` - calls `LightningFlashListener.Instance
.StopListening()`, stops the coroutine, and does
`lightningFlash.StopAllCoroutines(); lightningLight.enabled = false`.
In the port, `LightningFlash.tick` is advanced only by the exterior
frame's `sky.use(...)`, and both walkable hosts return out of the frame
above that when a mode consumed it. So a flash rolled by a thunder clap
a moment before the door neither finished nor stopped: it froze with
its routine intact and paid out the rest of its burst on the first
exterior frame after the visit, from the position the player stood at
before entering. The mod never shows that.

Landed - and landed TWICE. While this lane ran, main's own AUDIT 61
(the two mods, PR #61) closed the same hole: `createSkyController`
(`src/scenes/shared.js`) publishes `setInside(inside) { dynamic?.setInside
(inside); }` beside `onAmbientEffect` and `lightningLight`, and both
walkable hosts hold a `skyInside` latch read on two edges. At
integration the lane's own latch (`_skyEnterExit`, read inside the modal
block and again immediately after it) was dropped for main's, which is
the same law in a different place:

- **The entering edge** is `if (!skyInside) { skyInside = true;
  sky.setInside(true); }` at the top of the modal block - after
  `modes.frame` flipped the mode, since `worldModes` exposes no
  enter/exit callback.
- **The leaving edge** is `if (skyInside) { skyInside = false;
  sky.setInside(false); }` in the exterior frame, immediately above
  `sky.use(...)` - the first line that would tick the frozen routine and
  light it. That is the frame `modes.frame` answered false on, so the
  sky learns the exit before anything ticks or draws it, which is the
  property the lane's second read was there for.

Pinned in `test/audit62_hosts.test.js`: the mod's own `LightningFlash`
kept in flight across a visit with no ticks is still lit on the way out,
and `stopAll` - the transition event's teardown - is what makes it null;
plus the seam and the two edge POSITIONS in both hosts (inside the modal
block; above `sky.use`). `test/dynamicSkies.test.js` pins the two edge
lines' text.

## AUDIT 62 F30-F35 - six pins that restated the port (2026-09-07)

Six of DS1's pins read the port's own constants back to themselves, or
drove a law nowhere near the edge that decides it. No shipped
behaviour was wrong - every value below matches the mod as it ships -
but each of these mutations left the whole suite green, so the mod's
numbers were free to drift out of the port unobserved. All are in
`test/dynamicSkies.test.js`.

**F30 - the timescale factor.** The three material assertions
multiplied the parsed preset value by the IMPORTED `TIMESCALE_FACTOR`,
so `0.0833 -> 0.08` survived. `BLBSkybox.cs:1380` ("Because game runs
at timescale 12"), and identically :1383, :1430, :1447, is the law.
The constant is now asserted outright and the three expectations are
written with the literal. The outright assert is the load-bearing
half: `near`'s 1e-6 against Sunny's `BottomClouds.Speed` of 0.00125
catches 0.08 by 4.1e-6 but would sleep through 0.0832. `_CloudBlendSpeed`
(:1383) is deliberately left alone - no shipped preset carries a
`BlendSpeed` key, so it parses to 0 and any factor gives 0.

**F31 - LightningFlash's two rolls, at their boundary.** Every drive
rolled 0.1 / 0.9 / 0.7 (and the runtime's constant 0.25), all far from
both edges, so `0.5 -> 0.6` and `0.33 -> 0.5` both survived. The
reference is `LightningFlash.cs:52` `Random.value < (0.5f /
Time.timeScale)` and :55 `< (0.33f / Time.timeScale)` - STRICTLY less
than, and `timeScale` is 1 on the only construction path. Now driven at
the edge: 0.5 does not flash and 0.49 does; 0.33 takes the SINGLE
0.2 s routine (still lit at 0.19 s, where a double has been dark since
0.1 s) and 0.32 takes the double, two 0.1 halves around a 0.1 gap.
The single/double discrimination has to be made on CHARGED time - the
frame that enters a routine is lit whatever its dt.

**F32 - GetLunarPhaseLength, all eight arms.** Three were asserted, and
the one date fixture is OneWax for both moons, so the wane arms, HalfWax
and the default were free: `HalfWane 5 -> 4` was invisible. The whole
ladder is deepEqualled against `BLBSkybox.cs:901-913` - Full 1, New 1,
ThreeWane 5, HalfWane 5, OneWane 5, OneWax 6, HalfWax 6, ThreeWax 3 -
plus `default: return 1` through `LUNAR_PHASES.None`. And the length is
pinned through the LIVE path as well as the pure function: sixteen days
on from the existing fixture Masser is HalfWane at moonRatio 8, day
offset 2, and `lunarPhaseState`'s progress divides by the FIVE-day
length - the divisor `dynamicSkiesRuntime`'s per-tick `applyLunarPhases`
actually consumes.

**F33 - GetPhaseDayOffset, its whole domain.** Five sample points stood
here and left both sides of most band edges free, along with three
bands (HalfWane 6-10, OneWane 11-15, HalfWax 23-28) that nothing
drove: `<= 28 -> <= 27`, `<= 10 -> <= 9`, `<= 15 -> <= 14` and the
subtraction constants -6, -11, -23 all survived. The 0..31 domain is
now deepEqualled against the ladder transcribed from
`BLBSkybox.cs:915-931`, which pins every edge, every constant and the
`== 0 || == 16` single-day guard in one line.

**F34 - ApplyOrbitCalculations' mirror arms.** The synthetic fixture
only ever gave Masser the OneWane arm and Secunda the New one, so
Secunda's own constants - `secundaOrbitOffset += 20f * progress`
(:972-973) and `secundaZAngle += 20f * progress` (:997-998), 20 where
Masser's is 15 - and Masser's `-= 5f` New arm (:969-970) had no pin at
all. A second call with the roles swapped drives all four; the distinct
multipliers (15 vs 20, `-20 sin` vs `-30 sin`) make each separately
visible. The no-arm baseline `_SecundaOrbitOffset === X + 180` is
asserted on the real date too.

**F35 - the fog cadence.** "The fog colour holds for a second" compared
two NOON frames. At noon `sunY` is ~1, so `setFogColor`'s rescaled
smoothstep underflows to 0 in the squaring and the recomputed colour
equals the held one to the last bit - `FOG_COLOR_INTERVAL_SECONDS`
1.0 -> 0.3 was invisible, and nothing asserted the constant. Measured
over the real presets, the colour only MOVES between about 15:00 and
16:25; from 16:30 on it is saturated black, so a dusk drive would have
gone red against correct code. The hold has its own frame now, driven
at 15:30 -> 15:50 inside ONE day part (hour 15 is Midday, so no
day-part arm re-applies) and on one weather word (so
`ApplyPendingWeatherSettings`' unconditional `setFogColor` cannot forge
the result): 20 game-minutes pass with the colour held, and 0.15 s
later - a second on - it follows the sun down.
`FOG_COLOR_INTERVAL_SECONDS === 1.0` is asserted beside it,
`BLBSkybox.cs:193` "Update fog color every 1.0 seconds".

Eleven mutations were driven on a scratch copy of
`src/systems/dynamicSkies.js` for these six; eleven dead. No production
line changed - the port already matched the mod on all six laws.

## ROAD-H H7b - LIGHTNINGFLASH'S UNDRIVEN TIME SCALE (2026-09-07)

AUDIT 62's ui-pins lane left a note: the port's `LightningFlash` carries
a `timeScale` option, and nothing in the suite ever built one at
anything but 1. F31 (above) drove both rolls at their boundary and said
so in passing - "`timeScale` is 1 on the only construction path" - which
is exactly the hole: at 1, `0.5 / t`, `0.5 * t` and a bare `0.5` are the
same expression, and so are `flashDuration * t` and `flashDuration`.
Five of the mod's own arithmetic sites were therefore pinned only in the
case where the scale disappears.

The option is real and it is the mod's. `LightningFlash.cs` reads
`Time.timeScale` at five places:

| mod line | the arithmetic |
|---|---|
| `:52` | `if (Random.value < (0.5f / Time.timeScale))` - the 50% gate |
| `:55` | `if (Random.value < (0.33f / Time.timeScale))` - the double-flash gate |
| `:61` | `StartCoroutine(FlashRoutine(flashDuration * Time.timeScale))` |
| `:77` | `float halfDuration = flashDuration * Time.timeScale / 2f;` |
| `:79` | `yield return new WaitForSeconds(0.1f * Time.timeScale);` |

Two DIVIDES and three MULTIPLIES, and the port carries all five. It is
Unity's own frame scale, not Daggerfall's x12 game clock (that one is
`BLBSkybox.cs`'s `x0.0833`, pinned by F30): it is 1 while the game runs
and `GameManager.PauseGame` takes it to 0, so the mod's own reading is
"an ambient effect fires half the time at normal speed, and a flash
lasts a fifth of a second of REAL time however the frame clock is
scaled".

`test/roadh_residue.test.js` drives the class at `timeScale: 2`, where
the mod's numbers come apart: the first gate sits at 0.25 (0.25 does not
fire, 0.24 does, and the SAME 0.25 fires at timeScale 1 - which is the
whole content of the divide), the second at 0.165, the single routine
runs `0.2 * 2 = 0.4` s and the double two 0.2 s halves around a 0.2 s
gap. Five mutants on a scratch copy - either literal with its divide
dropped, and each of the three multiplies - five dead. No production
line changed; the port already matched the mod at every one.

### Review round (2026-09-07)

The 0.2 s flash duration is set at `BLBSkybox.cs:183`
(`lightningFlash.flashDuration = 0.2f;` inside the lightning-effect
setup), not `:184` - `:184` is the blank line before the setup's
`Debug.Log`. The lane's new pin cited `:184` twice while the production
comment beside it (`src/systems/dynamicSkies.js:745`) already read
`:183`; the two test cites and the Testing.md row are corrected to `:183`
and now agree with the port. No behaviour and no other cite moved: the
five `LightningFlash.cs` lines (`:52`, `:55`, `:61`, `:77`, `:79`)
re-derived clean.

## MODS AUDIT (2026-09-08) - the 1:1 re-audit against 04506e2

Mac: "go ahead and audit the other mods while youre at it to ensure they
are 1:1." An Opus explorer fetched `BLBSkybox.cs` (2,378 lines), the
nine `Scripts/*.cs`, the shader and both includes from
`drcarademono/dynamic-skies` at `04506e2` and walked the port against
them: every lifecycle member, all 88 `Set*` calls of `ApplySkyboxSettings`
in order, the fog, the day parts, the moons, the light curve, the
lightning, the snow; every uniform the shader reads (96, all declared
at the same width), the keywords, the colour space, the posterise, the
cloud blend order, the horizon and the stars; the settings file key by
key; the presets' nineteen textures against the vendored nineteen; and
the seam. The vendored files were md5'd against upstream - all
eighteen comparable ones identical, now sha256-pinned
(`test/vendorIntegrity.test.js`). The `*Night.json` question was
settled from upstream too: all seven exist in the repo's `Resources/`
and the shipped manifest lists NONE, so `GetAsset` returns null and
index 1 is index 0 - the port's `[s, s]` is exactly right. Every earlier
cite re-derived clean.

Four departures found, all fixed:

**The double flash's second half was drawn where the player WAS.**
`FlashOnce` (LightningFlash.cs:83-111) reads `playerTransform.position`
at :95, and `DoubleFlashRoutine` calls it twice ~0.3 s apart, so the
second half follows the player. The port copied the position at the
roll and used it for both halves; the comment beside it described the
mod. `LightningFlash.tick(dt, playerPos)` takes the frame's position
now and each entry prefers it (the roll's copy stands for a caller
without one); the controller hands `extra.pos` through - the same
camera position VC4 already carried for the clouds.

**A flash rolled under a non-Thunder word froze at the door.** AUDIT 62
F29 tore the routine down on entering under Thunder; the mod's teardown
is `if (pendingWeatherType == Thunder)` (:1264), and under any other
word the leaked subscription (AUDIT 61) can roll a flash whose
coroutine then RUNS ON indoors on Unity's clock, finishing unseen. The
port advanced routines from the exterior frame alone, so the burst
froze mid-step and lit on the first frame back out - F29's failure, in
the case F29's guard does not cover. `setInside(true)` stamps the real
clock; the first exterior tick charges the seconds spent inside to the
routine (a routine rolled and never entered lights at its roll first,
as `StartCoroutine` runs to the first yield) before its own frame.

**The mod's skybox pass takes no fog, and the port fogged it.** The
hosts wrote `fogMix = 1 - fogFactor` on the pass when a fog row's
`excludeSky` was false (the mod's own heavy-fog preset is the one), and
the fragment mixed the world's fog colour over the encoded dome. The
mod's shader computes `UNITY_CALC_FOG_FACTOR_RAW(_FogDistance)` at :872
and every consumer of the factor is commented out (:874-879); and
`BLBSkybox.LateUpdate` (:320-335) forces the camera's clearFlags back to
Skybox every outdoor frame - which exists precisely so that DFU's
heavy-fog handling cannot put a fog colour where the sky is. Under
heavy fog a mod player sees the mod's Fog preset; the port double-fogged
it. The mix, its two uniforms and their uploads are gone from the
dynamic pass; the hosts still write `fogMix` on whichever pass they
hold (the enhanced sky reads it), and this pass has nothing to apply
it to.

**`Time.deltaTime` is clamped to `Time.maximumDeltaTime`.** The port
clamped the mod's real frame at 1 s; Unity's default maximum is 1/3 s,
and the only consumer is the lightning routine with 0.2 s and 0.1 s
steps, so a hitch between the two retired a step Unity would have
carried over. `MAX_DELTA_SECONDS = 1 / 3` (`systems/dynamicSkies.js`),
read by the controller. The one unverified link: DFU's project
`maximumDeltaTime` was not read (no DFU tree here); the default is
assumed.

Two structural corrections with no behavioural effect: `SunSizeConvergence`
is `public int` on `BLBSkyboxSetting`, so `JsonUtility` truncates at the
parse - `parseSkyboxSetting` truncates there now, not only at `SetInt`
(every shipped preset carries 10.0); and `Init` runs `setLunarPhases`
then `ChangeLunarPhases` (:138-139) BEFORE `OnWeatherChange` - the
runtime's constructor takes an optional clock and applies the orbits
when it has one; the controller has none at construction, so the first
`use()` stays Init's `WorldTime.Now`, and its tick applies them first.

Recorded, not changed: `SetFogDistance` also writes
`RenderSettings.fogEndDistance` from the PENDING weather's row (:1084);
the hosts take the same row through `fogSettingsFor()` off the host's
word, which under the port's front can be a blend of two rows - the
front is the port's own, separately recorded. `_MoonPhaseOption`,
`_MoonSpinOption` and `_SecundaSpinOption` are written into `mat` and
never uploaded, correctly: the shader consumes them as keywords, which
are baked. `half` is `float` on desktop Unity, so the port's `highp`
is a no-op there.

## DS2: THE PORT'S CLOUDS OVER THE MOD'S SKY (2026-09-08)

Mac: "The procedural sky mod doesn't apply our enhanced clouds." It
did not by design - VC3's first decision stood the volumetric clouds
on the port's dome only ("the new clouds do not draw under it"), and
the controller built them off `enhancedSky &&`. Under the mod the
player got its two textured cloud sheets and none of the port's field.

The clouds ride the LANE now: built under either sky (`enhancedLane &&
cloudsDoor !== 'off'`), and under the mod its two sheets stand down the
way the dome's decks do - `DynamicSkiesRenderer.cloudsExternal` uploads
`_CloudTopOpacity` and `_CloudOpacity` as 0 while the material keeps
the preset's numbers (the dome's `uCloudCover` law, one pass over).
`?clouds=off` gives the mod its sheets back. The clouds read six
fields of a state (`cloudLight`: sunDir, sun, masser, secunda; the
march: cloudLit, cloudShade, horizon), and `cloudsStateUnderMod`
(`render/dynamicSkiesBridge.js`) answers them: the port's own
`skyState` for the colours - the eased row's lit and shade, the
palette's sun at the hour - and the mod for the geometry and the
horizon: ITS sun direction, ITS moons where its orbits put them (the
same `dynamicMoonState` the world's moonlight has taken since DS1,
moved into the bridge with it so the sky lab can import both without
the whole controller), and ITS fog colour as the horizon the clouds
fade into. The ground's deck under the mod takes the clouds' shadow
map (`Object.assign(dynamicDeck, clouds.shadow)`) - "the mod casts
none" in the seam section above is no longer the whole story: the mod
casts none, and the port's clouds over it cast theirs. The composite
lands after the mod's REDUCE_COLOR posterise and its sRGB encode, over
display values either way, as it lands over the dome.

The lab draws the same: `?sky=dynamic` shows the clouds over the mod's
pass, with the synthesised state. The Dynamic Skies probe still passes
(11/11); the VC and enhanced-sky probes unchanged. Pinned in
ds2_cloudsUnderMod.test.js; the VC3 seam pins re-aimed at the lane.

## PS3 - THE PROGRESSING CIRCLES (2026-09-12, Mac's report)

Mac: "with the dynamic skies mod there's these progressing circles in
the sky when I want it to be a smooth sky transition."

**They are the mod's REDUCE_COLOR.** The keyword is baked on (the
material ships it), and the block quantizes each channel with a bare
`ceil()` and no dither, in linear light, at a step the sun's height
drives: `_stepSize - lerpScale^5 * _stepSize + 0.001`. Two consequences
the mod has always had and the port carried 1:1. The sky's
iso-luminance contours around the sun are concentric RINGS, so a hard
quantizer draws them as hard-edged bands. And the step changes as the
sun climbs - `lerpScale` is a smoothstep on the sun's elevation - so the
bands MIGRATE, which is the "progressing".

**Measured**, on the shipped Sunny preset (`stepSize` 0.015) with the
sun high, over a synthetic halo in the linear light the shader works in,
encoded to sRGB the way the pass encodes its output: FIFTY flat plateaus
through the halo, the worst of them a 0.033 sRGB edge - some eight
levels of 255, several times the threshold at which a smooth gradient
shows a contour. The shipped presets run `stepSize` 0.001 to 0.015, so
every one of them bands; the finest (Thunder) least.

**The fix is the device ES1e already applies to the port's own dome**:
an ORDERED dither, the same Bayer cell, half a step either way, so the
quantizer's threshold moves per cell and the contours dissolve into a
stipple. The palette is untouched, the mod's step formula is untouched
to the character, and the mod's upward `ceil()` bias survives because
the offset is ZERO-MEAN: `bayer4 - 0.46875`, not `- 0.5`, since bayer4
averages 7.5/16 and the naive form would have raised the bias by 1/32 of
a band. Over the same sweep a four-row average resolves 577 distinct
values instead of 50.

THE INDEX IS WORLD-FIXED, which the adversarial pass earned. It is the
sky's own cell while the sky is pixelated, so the stipple lands on the
sky's own pixels and reads as period dithering rather than noise; and
when the sky is SMOOTH it is a cell a third that size, not the fragment.
Indexed by `gl_FragCoord` the pattern is locked to the display while the
sky slides beneath it, so it crawls as the camera turns - and half of
the mod's band is 7/255 in the darks, nothing like the half-LSB the
dome's own smooth pass dithers with and calls "never itself visible".

**Recorded as a departure from 1:1**, because it is one: the mod's raw
threshold is one door away, `?bands=raw` (the uniform `uBandDither` at
0), and the shader is otherwise the mod's. It is NOT a compatibility
switch between mods (MM1) - it is this mod's own posterise, and it
applies whether or not any other mod is loaded. The DOOR and the UPLOAD
are pinned, not just the shader: delete the upload and `uBandDither`
sits at its default 0, the mod's raw ceil, and the slice silently does
nothing - which is exactly the `_CloudTopColorBoost` failure the
renderer's own header cites, a property read by the shader and fetched
by nobody. Ledger row PS3. Pinned: `test/dynamicSkies.test.js` - the
step formula, the dither's form and its zero mean, the uniform fetched
and uploaded, the default, the door reachable in both hosts, no
`gl_FragCoord` in the block, and the plateau count raw against
dithered.
