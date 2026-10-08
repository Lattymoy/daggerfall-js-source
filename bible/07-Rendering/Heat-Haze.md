# Heat Haze - the desert's shimmer by day (HAZE1, 2026-10-08)

**The owner's call (2026-10-08), handing over four archives: "We have
permission to use and implement everything into the codebase. These should
be on by default and integrate into our enhanced environments seamlessly."**
demifiend000's **Heat Haze 1.0.1** for Daggerfall Unity (Nexus 1397). Ledger
row HAZE1; the registry row and the permission line (Mac's word recorded, the
author's own still to come - `RECORD OPEN`) are `vendor/heat-haze/`'s. Its
siblings from the same message: `07-Rendering/Windfall.md`,
`03-World/Snowfall.md`, `07-Rendering/Sands-Of-The-Alikr.md`.

## What the mod is

One MonoBehaviour (`HeatHazeMod`), its rules (`HeatHazeEligibility`) and one
shader (`Daggerfall/Mods/HeatHaze`, DXBC only). Outdoors in the two desert
climates - Desert (224) and Desert2 (225), and Subtropical (229) behind
`AllowSubtropical` - by day, under a sunny or a cloudy sky, a vertical ring
400.4 m round the player (a 128-sided cylinder 1006 m tall, its middle 1.5 m
over the player's foot) is drawn after the opaque world with a GrabPass: what
lies BEYOND it - the far land and the sky - is bent up to 1.5 screen pixels by
two scrolls of a 64 x 64 value noise; the near world is not. Sunny is the full
strength, cloudy half; the day fades in over the thirty minutes after 06:00
and out over the thirty before 18:00; the strength eases toward its target
with a 0.8 s time constant and falls to nothing at once on an ineligible
frame.

## The port

| module | what it is |
|---|---|
| `systems/heatHaze.js` | HeatHazeEligibility whole (the climates, IsDay, the weather's strength, the daylight's smoothstep ramps), HeatHazeMod's state (its settings as LoadSettings clamps them, the ring's place and scale, the strength's ease) and CreateNoiseTexture byte for byte |
| `render/heatHaze.js` | the GrabPass and the ring - the world's viewport copied (`copyTexSubImage2D`), the ring drawn depth-tested with ZWrite and Cull off; the shader's every constant as its DXBC carries them |

THE NOISE IS THE MOD'S OWN: `System.Random(1212701233)`'s NextDouble in turn,
an 8 x 8 lattice smoothstepped to 64 x 64 in single precision and rounded
banker's-way as `Mathf.RoundToInt` - its SHA-256 is the mod's own C#'s,
compiled under .NET 8 (`test/haze1_heatHaze.test.js`).

THE SHADER, LINE FOR LINE (`vendor/heat-haze/shaders/HeatHaze.glsl`): the fade
by the ring's own height (`(|y| - 25) / 45`, smoothstepped, discarded at the
ends), the two noise reads over the world turned two ways ((0.9239, 0.3827)
and (-0.4226, 0.9063)), up y x 1.5, at NoiseScale x 0.0022 x 3.6 and x 7.2, run
by AnimationSpeed x time x (0.026, -0.30) and (-0.043, -0.48); the bend
`(n1.xy - 0.5) x 1.15 + (n2.yx - 0.5) x 0.85`, times (0.3, 1), times the
strength, over the target's size in pixels.

## Enhanced environments, seamlessly

- **THE ENHANCED OUTDOORS'.** The hosts build the renderer under the enhanced
  sky only (`sky.enhanced`), as the port's other outdoor looks are; its
  switch (`Enabled`, on by default - MO1) is read every frame, and `?haze=off`
  is the kill door.
- **THE PORT'S WEATHER.** The sky the haze reads is the port's weather word;
  the port's eighth weather, the sandstorm (WEATHER2d), is no sunny sky, so no
  haze stands in one.
- **ONE PASS, IN ITS PLACE.** It is drawn once the opaque world is whole - the
  ground, the models, the flats, the grass, the banners and Windfall's leaves
  - and before what falls and every translucent thing, as the mod's
  Transparent-100 GrabPass is; not under the travel view's raised eye (the
  ring stands round the player's feet).

## THE FOUR HOSTS

`scenes/world.js` and `scenes/exterior.js` build it on the enhanced lane, tick
it every outdoor frame, draw it as a foreign pass (`markForeignPass`), and
stand it down on their indoor branch (`suppress` - the strength 0 at once, as
the mod's Update sets it on every ineligible frame); the world host carries
the noise's phase across the floating origin and a teleport's re-anchor, the
layer held while airborne across a recentre's height, and reads the arrival's
layer afresh (AUDIT ENVIRONS I2, I7). The strength eases on the real clock
(the mod's `unscaledDeltaTime`); the shimmer runs on the game's seconds - the
shader's `_Time.y`, held by a pause and scaled with the world (W4) - and the
mod's keys are read when one is written (`hazeFrameSettings`, W7). `scenes/worldModes.js` and
`scenes/dungeonContext.js` are FLAGGED, not wired: no desert sky stands
indoors or underground, and their frames run inside the hosts' indoor branch.
Online the haze is the player's own (`systems/onlineLane.js`
`ONLINE_PLAYERS_OWN_MODS`), drawn over a weather and an hour the room shares.

## Departures (Port-Ledger A, HAZE1)

- **THE NOISE STANDS ON THE LAND.** The mod reads its noise off Unity's world
  space, which DFU's own recentre moves; the port adds the floating origin's
  displacement and the clock as one phase a sample, worked out in double
  precision (`hazePhase`), so the shimmer does not jump at a map pixel crossed
  and does not lose precision over an hours-long session.
- **THE GRAB** is `copyTexSubImage2D` of the world's viewport out of whatever
  the world draws into (the canvas, the air pass's image, the retro image) -
  Direct3D's grab texture runs top-down and the port's does not, so the bend's
  y is turned.

## Pins

`test/haze1_heatHaze.test.js` (9); `tools/mutants/haze1.json` (25, all dead).
