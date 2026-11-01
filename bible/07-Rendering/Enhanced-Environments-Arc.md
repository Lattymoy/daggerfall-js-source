# Enhanced Environments

Enhanced environments is the one switch for the enhanced outdoors: a living sky with sun, moons and stars, volumetric
clouds that build with the weather and cast shadows, falling rain and snow that ease in and out, and grass that bends in
the wind. The player meets it as the **Enhanced environments** tile, a three-way choice: Off (Daggerfall's painted sky
and weather), Port sky, or Dynamic Skies.

## How it works

- The tile writes two stores through `src/world/outdoors.js` `outdoorsWrite`: the pref `enhancedEnvironments` and, while
  on, Dynamic Skies' `Enabled` mod setting. `OUTDOORS_DEFAULT` is `dynamic`. Turning the outdoors off leaves the mod's
  switch as it was, so turning them back on restores the same sky.
- `src/scenes/shared.js` composes the lane at mount: `enhancedLane` needs the enhanced skin, the pref on and no
  `?sky=classic`. Under it, `dynamicOn` picks Dynamic Skies or the port's own dome (`src/render/enhancedSky.js`). The
  sky pass is built once per scene, so a change takes effect when the world next loads.
- Parts that hang from the lane, each on its own page: the dome and Dynamic Skies (`Dynamic-Skies.md`), volumetric
  clouds and their shadows (`Volumetric-Clouds-Arc.md`, `src/render/cloudShadow.js`), the weather front and
  precipitation (`Weather-Arc.md`, `src/systems/weather/weatherFront.js`, `src/render/precipitation.js`), the ground's
  snow (`Biome-Precipitation.md`), and the grass (`src/render/labGrass.js`, `src/render/grassMeadow.js`).
- URL doors: `?sky=classic|enhanced|dynamic`, `?clouds=off`, `?grass=off`.
- Online the lane is forced on (`src/systems/features.js` row `enhanced-environments`).

## Rules

Laws for any change to this lane's shaders or GL:

1. A shader change is not gated by eslint, the node suite or a build, because none of them compiles GLSL. Every change
   that touches a shader runs `tools/bootProbe.mjs` and the world render gate.
2. `tools/worldRenderGate.mjs` boots the real exterior against ARENA2 and reads real pixels. It fails on a page error, a
   frame that never advances, a black or flat lower half, an unlit terrain band, or a black sky.
3. The upload law: an upload may create, fill and parameterise an object. It may not draw, bind a framebuffer, clear,
   change the pipeline, or leave a binding behind. New GL calls go through the renderer's bind shadow
   (`src/render/renderer.js` `_use`, `_bindVao`, `markForeignPass`) and its draw counter.
4. A report that cannot be reproduced here gets a URL kill switch, and is not fixed until Mac sees it fixed (Mac).
5. Every surface noise frequency is a whole number of cycles per tile, per axis, so a periodic noise does not seam.
6. The snowpack (`Biome-Precipitation.md`) lays snow where it fell and has not melted. It is drawn by blending each
   fragment toward its climate's winter tile in the cover's share. Tracks in snow are the Snowfall mod's surface
   (`src/systems/snowfall.js`), laid by the ground's cover.
7. The grass shaders are the prototype's (`grass-proto.html`) verbatim, sliced out and compared at test time; the game
   adds only where a blade may stand (grass tiles, not roads or water, not in winter) (Mac).

## Code and tests

- `src/world/outdoors.js` - the three-way tile: `OUTDOORS_TIERS`, `outdoorsRead`, `outdoorsWrite`
- `src/scenes/shared.js` - `enhancedLane`, `dynamicOn`, the sky and cloud passes
- `src/systems/uiPrefs.js` - the `enhancedEnvironments` pref, migrated from the older `proceduralSky`
- `tools/worldRenderGate.mjs` - the world render gate; `tools/bootProbe.mjs` - the shader boot probe
- `test/tooling/doctrine.test.js` - holds the gate's checks and this page's naming of them
