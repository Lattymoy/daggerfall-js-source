# Heat Haze

Heat Haze (demifiend000, version 1.0.1) is a Daggerfall Unity mod we port and ship on by default. By day in the desert,
the far land and the sky shimmer: the player sees the view beyond a ring round them bend a little, as if over hot
sand. The near world does not move. Our code is the record (the release's is in `01-Overview/Own-Work.md`).

## How it works

- It runs outdoors in the Desert (224) and Desert2 (225) climates, and in Subtropical (229) when `AllowSubtropical` is
  on, by day, under a sunny or a cloudy sky. Sunny is full strength, cloudy half. The day ramps in over the thirty
  minutes after 06:00 and out over the thirty before 18:00.
- The drawn strength eases toward its target with a 0.8 s time constant on the real clock, and drops to zero at once on
  a frame that does not qualify (indoors, wrong climate, night, other weather).
- The ring is a 128-sided cylinder round the player's feet (400.4 m away, 1006 m tall by default). After the opaque
  world is whole, the renderer copies the world's viewport and draws the ring over it, bending what lies behind by up to
  1.5 screen pixels with two scrolls of a 64 x 64 value noise.
- It draws after the ground, models, flats, grass, banners and Windfall's leaves, and before precipitation and every
  translucent thing. It is not drawn under the travel view's raised eye.
- The shimmer runs on game seconds (held by a pause, scaled with world time). The noise's phase is computed in double
  precision with the floating origin's offset added, so the shimmer stands on the land and does not jump when the origin
  moves or after a long session.
- The climate is read through `src/world/tamriel/tamrielGround.js` `groundMaps`, so a desert past the Bay shimmers as
  the Alik'r does.

## Rules

- On by default, part of the enhanced environments, shipped on Mac's word of permission (Mac). The switch is the mod
  setting `Enabled`, read every frame; `?haze=off` is the kill door (`src/systems/heatHaze.js` `heatHazeOn`).
- Enhanced sky only: the hosts build the renderer only under `sky.enhanced`.
- The sandstorm is not a sunny sky, so it has no haze.
- Online it is the player's own look (`src/systems/online/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`), drawn over the
  weather and hour the room shares.
- The noise is the mod's own: `System.Random(1212701233)` on an 8 x 8 lattice smoothstepped to 64 x 64, rounded as
  `Mathf.RoundToInt` (`src/systems/heatHaze.js` `hazeNoise`). The test holds its SHA-256 to the mod's C#.
- The shader (`src/render/heatHaze.js`) is the translation of the mod's own, every constant as its DXBC carries it;
  `test/systems/haze1_heatHaze.test.js` holds the constants and the shipped settings as literals.

## Daggerfall Unity

The mod is one MonoBehaviour (`HeatHazeMod`), its rules (`HeatHazeEligibility`) and a GrabPass shader
(`Daggerfall/Mods/HeatHaze`) drawn at Transparent-100. Departures:

- The mod reads its noise in Unity world space, which DFU's recentre moves. We add the floating origin's offset to the
  phase so the shimmer does not jump at a map pixel crossing.
- The grab is `copyTexSubImage2D` of whatever the world draws into (canvas, air pass image, retro image). Direct3D's
  grab texture runs top-down, so the bend's y is turned.

## Code and tests

- `src/systems/heatHaze.js` - eligibility, settings, the strength's ease, the noise (`createHeatHaze`,
  `hazeFrameSettings`, `HAZE_CLIMATES`)
- `src/render/heatHaze.js` - `HeatHazeRenderer`, the grab and the ring
- `src/scenes/world.js`, `src/scenes/exterior.js` - build it on the enhanced lane, tick it each outdoor frame, `suppress`
  it indoors; the world host moves its layer with the floating origin (`offsetOrigin`)
- `test/systems/haze1_heatHaze.test.js` - the rules, the noise hash and the hosts' wiring

## Open

- The permission record for the ported code is open (`01-Overview/Own-Work.md`), beside Mac's word.
- `src/scenes/worldModes.js` and `src/scenes/dungeonContext.js` do not wire it: there is no desert sky indoors or
  underground.
