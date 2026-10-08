# Windfall - the wind that changes by the day (WINDFALL1, 2026-10-08)

**The owner's call (2026-10-08), handing over four archives: "We have
permission to use and implement everything into the codebase. These should
be on by default and integrate into our enhanced environments seamlessly."**
demifiend000's **Windfall 1.0.0** for Daggerfall Unity (Nexus 1396). Ledger
row WINDFALL1; the registry row and the permission line (Mac's word recorded,
the author's own still to come - `RECORD OPEN`) are `vendor/windfall/`'s.
Its three siblings arrived in the same message: Heat Haze
(`07-Rendering/Heat-Haze.md`), Snowfall (`03-World/Snowfall.md`) and Sands of
the Alik'r (`07-Rendering/Sands-Of-The-Alikr.md`).

## What the mod is

One `.dfmod` bundle: an assembly (`Windfall.dll`, 54,272 bytes - eight types),
three shaders, three textures and twenty-seven AudioClips. Read off the
assembly (ilspycmd's C# and `vendor/windfall/il/Windfall.il.txt`) and the
shaders' DXBC (`vendor/windfall/shaders/`, read back to GLSL by
`tools/dxbcGlsl.py`):

| type | what it does |
|---|---|
| `WindMod` | the runtime: its settings (56 keys), the day's context and plan, the presentation state, the gusts, the profile the flora sway by - set as shader globals every frame - and the patch that swaps DFU's two billboard-batch shaders for its own on every nature batch (500-511), with a wind MASK per atlas; its save record and its console command |
| `WindNaturalPlanner` | the day's natural event: a daily roll and an escalation roll off a stable hash of the day's context, a windy period (3-6 h) or, one day in 12.5, a windstorm (1-3 h), and its window in the day; the chance, the cooldown, the gust's scaling |
| `WindRecordWeights` | each nature record's response - none, low (89), medium (166) or full (255) - for the twelve stock archives and Seasons of the Iliac Bay's eleven seasonal atlases |
| `WindEnvironmentEffects` | the presentation: three AudioSources (a gust's one-shots, a windy day's intermittent passages, the canopy's ruffle) and three particle systems (the gust's leaves, the ambient leaves, the snow off winter boughs) |
| `WindBatchOwnership`, `NaturalEventSource`, `WindNaturalPlan`, `WindfallSaveData_v1` | the patch's bookkeeping, the plan's types, the save record |

The shaders: `Windfall/BillboardBatch` and its no-shadow twin (DFU's
billboard batch with one vertex offset added - below) and
`Windfall/Particles` (an alpha-tested Lambert surface shader, both faces).

## The port

| module | what it is |
|---|---|
| `systems/windfall.js` | WindNaturalPlanner and WindRecordWeights whole, and WindMod's state machine - single precision as the C# runs it |
| `systems/windfallEffects.js` | WindEnvironmentEffects - the sounds' scheduling and the particle flows - and the clips' one load |
| `systems/audio.js` `source()` | Unity's AudioSource, kept: a live volume and pitch, one-shots on it, `isPlaying`, `Stop` |
| `render/windfallSway.js` | the vertex wind as BB_VS's chunk, its eight numbers a frame, a batch's share, the shadow's bound, the anchor |
| `render/windfallParticles.js` | the three particle systems on the CPU, one instanced cutout draw each |
| `scenes/windfallHost.js` | the runtime both exterior hosts build: the model, the presentation on the port's bus, the particles, the save record, the console |

### THE MODEL (`systems/windfall.js`)

Every frame, outdoors and in (WindMod.Update runs wherever the player is):

- **THE DAY'S CONTEXT** is `StableHash(year, month, day, map x / 8, map y / 8,
  climate)` - FNV-1a's offset and prime with a 13-bit xorshift. A new key
  rebuilds the day: `System.Random(key & 0x7FFFFFFF)` for its gusts
  (`formats/netRuntime.js` NetRandom), the natural plan, the heading.
- **THE NATURAL EVENT**: the plan's daily roll under the effective chance -
  the season's authored chance (Fall 0.16, Spring 0.11, Summer 0.07, Winter
  0.18) times the geography's (Ocean 1.5 ... Mountain 1.7, Rainforest 0.6),
  capped 0.35, times the overall, season, region and weather frequencies and
  the COOLDOWN (none the day after an event, nor the same day under another
  context; half the day after that) - and the minute inside its window. Met
  outdoors under any weather but Thunder, it is stamped for the cooldown (the
  save record's two numbers).
- **THE PRESENTATION**: Thunder is a storm; else the natural event's (a
  windstorm a storm, a windy period windy); else normal. A change cancels the
  gust and schedules the next.
- **THE GUSTS**: scheduled by the state (the first 2 s into a storm, 5 s into
  a windy day, 20-45 s into a normal one; then 6-16, 14-35, 45-105 s apart,
  over GustFrequency), each a smoothstep rise over its first quarter, a hold
  to 0.45 and a smoothstep fall; its length (3-6 s normal, 4-9 windy, 5-10 a
  storm), peak (0.12-0.27, 0.55-1, 0.72-1) and heading's swing (5, 10, 20
  degrees) by the state; a windy or stormy gust pairs with another 2-6 s
  later 15% of the time. Indoors the gust eases out at 0.5 a second.
- **THE PROFILE** the flora sway by - strength, sway amplitude and frequency,
  shiver amplitude and frequency - is Normal's, Windy Day's or Storm's (rain
  1.15x the strength, snow 1.1x, off a storm), lerped toward Gust's by the
  gust and eased `1 - e^(-3 dt)` a frame; the sway's and the shiver's phases
  run on its frequencies.

PINNED AGAINST THE ASSEMBLY ITSELF: the session's C# reference compiles the
mod's own `WindNaturalPlanner.cs`, `WindRecordWeights.cs` and the state
machine's method bodies copied from the decompiled `WindMod` (the engine's
reads replaced by the frame's inputs) under .NET 8, and runs a 30,000-frame
scenario - the weather, the door, the map, a debug storm - twice (the
built-in settings and gusty ones). `test/windfall1_model.test.js` runs the
same scenario through the port: the trace of every float the C# holds, as
bits, hashes to the reference's (`19e6ad4f...`, `671c6551...`), and the
planner's and the tables' to `de42ad23...`.

### THE PRESENTATION (`systems/windfallEffects.js`)

- **THE SOUND**: a windy or stormy day plays an intermittent passage (nine
  "ultrasoft" clips, 14-18 s) whenever the last has run out and its gap is
  spent (0.75-2.5 s; 0-0.75 a storm) at 0.2 of the mod's volume (0.28 a
  storm); a gust plays one of twelve gust clips at 0.18 up to 0.40 by its
  peak (0.44 a storm), or on a normal day a soft passage at 0.14; the canopy
  ruffles (six clips) on a gust's onset (0.16-0.26 by the gust) and on its own
  clock (35-75 s, 16-35 windy, 10-24 a storm; 0.09-0.15), times the canopy -
  only where there are leaves (LeafAvailability x LeafSeasonMultiplier), not in
  snow and not under a winter nature set. A clip is never the one before it,
  and each is pitched a little. Indoors every source fades at 0.8 a second
  and stops at nothing. The clips are the bundle's FSB5 Vorbis, remuxed to Ogg
  losslessly by `tools/environmentModsExtract.mjs`
  (`vendor/vorbis-fsb-setups`' headers), fetched on the first frame the mod's
  sound is wanted.
- **THE LEAVES AND THE SNOW** (`render/windfallParticles.js`): the gust's
  leaves blow from 13 m upwind and 7 up at the gust's particle response (a
  smoothstep of the gust past 0.3) times the canopy (32 a second, 48 a storm,
  times LeafAmount); the ambient leaves fall from 4 m upwind and 8 up (0.25 a
  second, 1.3 windy, 2.6 a storm); the snow comes off the boughs in winter
  under a winter set (a quarter a second steady and up to 160, 220 a storm, by
  the gust). Each system is the mod's: a box emitter 30 x 10 x 20, no start
  speed, a lifetime, size and spin picked per particle, the leaves a random
  tile of an 8 x 8 sheet (spring and summer green, fall and winter the fall
  sheet - a change of sheet clears them), velocity over lifetime the wind's,
  the noise module at 0.35 and 0.25. 800, 300 and 1800 at most.

### THE VERTEX WIND (`render/windfallSway.js`, BB_VS)

`Windfall/BillboardBatch`'s vertex shader adds one offset to a quad's two
TOP corners:

    offset = (d x 0.15 + r x (d . r) x 0.85) x (swayAmp x sin(sway) + shiverAmp x saturate(S) x sin(shiver))
             x min(S, 2) x mask x (0.8 + 0.4 x h2) x height

`d` the heading, `r` the quad's right - so the lean is mostly ACROSS the view,
where a card can show it - `S` the profile's strength, `mask` the record's
response, `sway` the 12 m cell's phase with a fifth of the flat's own plus the
global sway phase, `shiver` a second hash plus the global shiver phase, `h2`
that hash again (each flat 0.8 to 1.2 of it). The port's BB_VS carries it as
`windfallLean`; the frame's two products of the profile go up as
`uWindfallSway`, the heading and the anchor as `uWindfallAxis`. The mod's
GustStrength global is never set off zero by its assembly, so the gust reaches
the flora only through the profile's lerp, as here.

THE MASK IS THE RECORD'S. TryPatchBatch builds a 512 x 512 Alpha8 mask per
atlas, every frame of a record filled with its response, and the shader reads
it at the corner's uv (0.75 of a texel inside); a batch here is one record, so
its mask is one number (`b.windfall`, `windfallResponse(archive, record,
seasonPrefix)` at the build), exactly. Under Seasons of the Iliac Bay's own
picture the mod's tables for its atlases ("SeasonHelper I TEXTURE.504" ...)
are read by the season's prefix; a Low Poly Trees far picture is the stock
record's tree and takes the stock row.

## Enhanced environments, seamlessly

- **THE ENHANCED OUTDOORS'.** The hosts build the runtime under the enhanced
  sky only (`sky.enhanced`), as WIND1's wind and every consumer of it are:
  under Daggerfall's painted sky the flora stand still and no wind sounds, as
  before. The mod's own switch (`Enabled`, on by default - MO1) and
  `?windfall=off` stand beside it.
- **ONE LAW, NEVER TWO.** While the mod is on, its law IS the flora's sway:
  BB_VS takes Windfall's offset or WIND3's lean (`render/renderer.js` BB_VS,
  `windfallLaw()`), never both. The Wind row's Sway part still switches all
  sway off; with the mod off WIND3's lean stands as it was. The shadow pass
  and the air pass replay a record by the law it was drawn with
  (`render/shadowPass.js` `crownLean`, the bound and the dynamic cadence by
  the mod's most lean), and a Low Poly Trees 3D tree leans by the same law up
  its height, linearly, as its far picture's quad - the two crossfade in the
  eye's band and must agree.
- **ONE WIND, ONE WAY.** The heading the trees lean and the leaves blow is the
  outdoors' own wind's (`systems/windDrive.js` `dir` - the wisps', the rain's,
  the clouds'), Windfall's slow wander (+-10 degrees) and its gusts' swing turned
  about it. The mod's daily heading (HashUnit x 360 + WindDirectionDegrees)
  stands only where no wind is handed; the setting says so (INERT here).
- **THE SOUND BESIDE THE BED.** The port's steady wind bed (WIND3 /
  FIELD-WIND1, Enhanced sounds) and the mod's intermittent clips are two
  layers, as a constant air and its events are; the mod's sound has its own
  switches (AudioEnabled and the four volumes).
- **THE SANDSTORM** - the port's eighth weather (WEATHER2d), a gale's wind - is
  a storm here as Thunder is. DFU has no such word.

## THE FOUR HOSTS

`scenes/world.js` and `scenes/exterior.js` build the runtime
(`createWindfallHost`), tick it outdoors (with the one wind's heading) and on
their indoor branch (`outside: false` - the gust eases out, the sources fade,
the particles stop), hand its law to the flats' call beside WIND3's
(`renderer.setFlatWind(wind, law)`), draw its particles with the opaque world
before the haze grabs it, and tag every nature batch and far picture with its
mask; the world host carries its anchor and its leaves across the floating
origin and a teleport's re-anchor alike (AUDIT ENVIRONS I2: `state.init`'s
`initOffset`, beside the boats').
`scenes/worldModes.js` (the interiors) and `scenes/dungeonContext.js` (the
dungeons) are FLAGGED, not wired: their frames run inside the exterior hosts'
indoor branch, which ticks the mod indoors, and no flora stands there.

The day the mod plans by is the SKY's (`skyMinutes()`, TIME1's census - the
date and hour the player sees); its frame runs on the game's seconds -
WindMod.Update's `Time.deltaTime`, held by a pause and scaled with the world
(AUDIT ENVIRONS W1: `worldTimeScale`, the town's `hccTimeScale`) - and online the mod is the player's own
(`systems/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`): nothing it does stands,
rolls or is written for anyone else.

## Departures (Port-Ledger A, WINDFALL1)

- **THE HEADING** is the outdoors' wind's, the mod's wander and swing about it
  - one wind for the trees, the leaves, the wisps and the rain.
- **THE FLAT'S OWN TWO HASHES ARE SMOOTH IN ITS PLACE.** The mod hashes a
  flat's world position `fract(sin(p . k) x 43758.5)`, which turns over at the
  last bit of its input; the port reads one flat's place two ways (the 3D tree
  and its far picture) and across every floating-origin crossing, so the
  flat's own two hashes are sums of two sines of its place on the LAND (the
  host's anchor carries the shift), each a whole number of turns over the
  anchor's 49,152 m wrap; the cell's hash is the mod's, its 12 m cells counted
  round 4096 of them. The same structure - a wood's cell sways together, a
  fifth of each flat's own, 0.8-1.2 of it a flat - and no phase jump at a
  crossing (DFU's own recentre re-hashes every tree).
- **UNITY'S NOISE MODULE** is the engine's own; the particles' turbulence is
  three smooth channels of sines at the module's frequency and scroll, added
  to the velocity at its strength.
- **THE PARTICLES' LIGHT** is the flats' at the player
  (`renderer.flatLightAt`), unfogged as the wisps are. The mod's pass takes the
  sun's directional light alone (`Particles.glsl`: `_LightColor0` x the probe's
  occlusion x `max(N.L, 0)` through a camera-facing normal, no ambient term), so
  in DFU its leaves and snow are black when the player looks toward the sun and
  near black at night (AUDIT ENVIRONS W6: the record corrected).
- **THE SNOW'S PICTURE** is the mod's own flake (its fallback material): the
  stock snow material it prefers is DFU's particle prefab's, which the port's
  precipitation does not have.
- **UnityEngine.Random** draws the clips, the pitches, the gaps and the
  particles - the engine's generator, which no port can share; `Math.random`
  here. (System.Random, which draws the gusts, is the mod's exactly.)
- **THE LOW POLY TREES' 3D TREES** lean by the mod's law; in DFU the mod
  patches billboard batches alone and a mesh tree stands still.

## Pins

`test/windfall1_model.test.js` (8) and `test/windfall1_presentation.test.js`
(12); `tools/mutants/windfall1.json` (61, all dead). The vertex wind and
BB_VS run through the GLSL evaluator (`test/glsl.mjs`); the shaders compile in
Chromium's WebGL2.
