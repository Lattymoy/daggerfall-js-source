# Rendering

The renderer draws the world in WebGL2: terrain, buildings, flats, characters, water, sky and effects, from
Daggerfall's own data. Presentation is ours (Port-Doctrine): DFU is the reference for what is drawn and with which
numbers, and the renderer is our own code. The player sees it as every frame of the game; the **Graphics** settings
(view distance, grass, ground sharpness, render scale, frame rate cap) and the enhanced rows tune it.

## How it works

### The renderer (`src/render/renderer.js`)

- One `Renderer` per page (`src/main.js`), built once and shared by every scene. The hosts issue every world draw
  themselves, in their own order, from their own culled lists; there is no scene graph.
- **Programs.** Lit solid meshes; Y-locked billboards expanded in the vertex shader (flats, sprites, trees); characters;
  and one tilemap pass, `drawTerrain`, for all ground, exterior blocks and terrain alike. A terrain program has a clip
  variant for pixels Deep Waters' cap patched.
- **Textures** are per (archive, record), uploaded bottom-up as `getColor32` emits them (GL's own texel order),
  REPEAT-wrapped because DFU's UVs run negative, NEAREST because indexed colour means hard pixels. Alpha-0 texels are
  cutouts and are discarded.
- **Classic lighting** happens in display space, on palette bytes: ambient plus the sun's `N.L` (defaults reproduce
  `0.45 + 0.55 * diffuse`), up to 16 point lights with a `(1 - d/range)^2` falloff, a moonlight term on the
  normal-bearing programs (zero by default, so interiors, dungeons and the classic sky are untouched), Better
  Ambience's trilight, emission added after the light, and fog in four modes (`src/render/fogGlsl.js` `FOG_GLSL`).
- **The lighting lane** replaces the world fragment shaders with linear-light ones (`Enhanced-Lighting-Arc.md`).
- **Handedness.** The scene is DFU's left-handed frame (x east, y up, z north). The projection is mirrored once
  (`src/world/mat4.js` `mirrorProjectionX`), and every other consumer, audio included, keeps scene coordinates.
- **State.** The renderer keeps a bind shadow (`_use`, `_bindVao`) and resets it at `beginFrame` and at
  `markForeignPass`, which every pass that changes programs behind its back calls. `renderer.stats` counts draws and
  binds per frame. `src/render/contract.js` types the renderer's contract.

### The frame

- **Smooth motion.** The motor steps at a fixed rate and the camera reads an interpolated eye (`src/player/motor.js`
  `eyeAt(alpha)`); a recentre shifts the previous position with the current one, so no frame lerps across the floating
  origin.
- **Culling.** Pure plane extraction and box tests (`src/render/frustum.js`); every pixel's terrain, placement and
  billboard batch is tested. `?cull=off` is the escape hatch.
- **Batching.** A streamed pixel's static RMB models are one mesh with one sub-mesh per texture
  (`src/render/staticBatch.js`); a dungeon level and an interior room batch the same way.
- **Order.** Opaque meshes first, then the ground (so hidden ground fails the depth test), then the sky passes and the
  far ring at the far plane, shading only the pixels nothing nearer claimed. Water, flats, grass and falling weather
  compose after them.
- **The stream** builds pixel terrain on a worker (`src/world/terrain/terrainGenClient.js`, `generatePixelTerrain`);
  the worker gets its own copy of WOODS.WLD's bytes. `?terrainthread=off` runs the same kernel on the main thread. GL uploads,
  layout, collider and the pixel's publish stay on the main thread and breathe between frames.
- **Compiles** start at boot and are queued so no pass waits on its program (`Performance-Priority.md`).

### Distance

- **View distance.** Land view distance (`landViewDistance`, default 5; DFU's 3 on All off) sets the streamed grid. The
  fog's end scales with the live terrain distance over DFU's 2400 rows (Dynamic Skies' own fog rows install as they
  stand). Outer-ring chunks build at a coarser stride; ghost rows give true central-difference normals at chunk edges.
- **Past the grid:** the middle ring (`src/render/midRing.js`), the far province ring of real heights with its own
  projection (`src/render/farRing.js`), the far field to the horizon (`src/render/farField.js`), trees carried a ring
  past the grid (`src/render/farTrees.js`, `src/render/farFlora.js`), landmark silhouettes
  (`src/render/farLandmarks.js`), and one haze law for every surface past the grid's fog (`src/render/horizonHaze.js`).
  A just-built pixel's tint eases in (`src/render/pixelFade.js`).

### The ground

Both terrain programs (classic and lane) are built from shared GLSL chunks, each the twin of a CPU module:

- **Ecotone** (`src/render/ecotoneGlsl.js`, `src/world/ecotone.js`): where two climates meet, a wandering, patchy border
  replaces the map pixel's straight edge; the neighbour's ground comes in as islands that grow toward the seam.
- **Roads** blend into their ground (`src/render/roadEdgeGlsl.js`); **coasts** blend their kinds and cut the sea on a
  wandering line (`src/render/groundEdgeGlsl.js`, `Water-Arc.md`).
- **Snow** lies by the snowpack's cover (`src/render/snowCoverGlsl.js`, `Biome-Precipitation.md`); a steep face over the
  snow cap's line is bare rock (`src/render/snowCapGlsl.js`).
- **The water bed** under enhanced water (`src/render/waterBedGlsl.js`).
- **Filtering.** The ground's tile array is mipped on both lanes, as DFU mips terrain. **Ground sharpness**
  (`groundSharpness`): Off (point over the chain), Default (4x anisotropy), Maximum.

### Wind, grass and the sky

- **Wind** (`src/systems/wind/wind.js`, `windDrive.js`) is its own model in game minutes: a calm a day, a front at each
  weather change that rises over a three-hour lead, holds and rolls away, and gusts shaped by strength. One drift
  integral drives the clouds, shadows, grass, rain and windmills. Enhanced only.
- **Wisps** show the wind as faint streaks (`src/render/windWisps.js`); flats sway with it, or by Windfall's law while
  that mod is on (`Windfall.md`).
- **Grass** (`grassDensity`: Full, Half, Quarter, Off; style `grassStyle`, the meadow by default): the prototype's
  instanced field (`src/render/labGrass.js`), with the pixel-tuft style (`src/render/grassPixelArt.js`) and the owner's
  meadow sprites (`src/render/grassMeadow.js`). Grass dims at night.
- **Skies:** the classic painted panorama (`src/render/skyRenderer.js`); the port's dome (`src/render/enhancedSky.js`);
  Dynamic Skies, our own; volumetric clouds; the aurora (`Dynamic-Skies.md`, `Volumetric-Clouds-Arc.md`,
  `Skyrim-Aurora.md`).

### Picture size and pace

- **Render scale** (`renderScale`: 100, 85, 75, 67 or 50%) draws the world into an image and presents it linear; it
  shares the retro image, and Retro Mode wins when both are on (`Retro-Mode.md`). The classic skin stays at 100%.
- **Frame rate cap** is DFU's `Video/TargetFrameRate`, applied when 30 or more and VSync is off, as DFU does
  (`src/systems/frameCap.js`).

## Rules

- A shader change is gated by `tools/bootProbe.mjs` and `tools/worldRenderGate.mjs`, not by lint or the node suite
  (`Enhanced-Environments-Arc.md`).
- An upload creates, fills and parameterises; it never draws or leaves a binding behind. Every foreign pass calls
  `markForeignPass`.
- A GLSL block shared by several programs lives in one leaf module and is interpolated, never copied.
- The classic lane keeps DFU's numbers; enhanced looks sit behind their switches.

## Daggerfall Unity

DFU draws through Unity: materials, a billboard batch, terrain tile arrays, Unity's lights and its own linear pipeline,
and interpolated transforms over a fixed simulation step. Departures: our own WebGL2 renderer with display-space classic
lighting (its falloff a recorded equivalence to Unity's point light); the fixed step's camera interpolated by hand; the
far rings, horizon haze and ecotone, which DFU does not draw.

## Code and tests

Core: `src/render/renderer.js`, `src/render/contract.js`, `src/render/glProgram.js`, `src/render/renderTarget.js`,
`src/render/frustum.js`, `src/render/bounds.js`, `src/render/staticBatch.js`, `src/render/billboardKey.js`,
`src/render/flatAnimation.js` (DFU's animated flats), `src/render/windowEmission.js`, `src/render/fogGlsl.js`,
`src/render/orderedDither.js`, `src/render/perfMeter.js`, `src/render/glRelease.js`, `src/render/gpuTrail.js` (the
desktop app's crash trail).

Compile scheduling: `src/render/bootPrograms.js`, `src/render/warmPrograms.js`, `src/render/playPrograms.js`,
`src/render/mountPrograms.js`, `src/render/idleTurn.js`.

Lighting and post: `src/render/enhancedLighting.js`, `src/render/shadowPass.js`, `src/render/classicShadowLane.js`,
`src/render/airPass.js`, `src/render/lightClusters.js`, `src/render/lightId.js`, `src/render/cloudShadow.js`,
`src/render/retroPass.js`.

Ground, water and distance: the GLSL chunks above, `src/render/waterSurface.js`, `src/render/underwaterFog.js`,
`src/render/deepWatersRender.js`, `src/render/oceanHolesRender.js`, `src/render/columnGlsl.js`, the far modules above.

Sky and weather: `src/render/skyRenderer.js`, `src/render/enhancedSky.js`, `src/render/dynamicSkiesRenderer.js`,
`src/render/volumetricClouds.js`, `src/render/cloudNoise.js`, `src/render/cloudsArrival.js`, `src/render/auroraPass.js`,
`src/render/precipitation.js`, `src/render/rainCurtains.js`, `src/render/dryFall.js`, `src/render/lightningBolts.js`,
`src/render/windWisps.js`, `src/render/heatHaze.js`, `src/render/sunbabySkyRenderer.js`.

Characters: `src/render/characterMesh.js`, `src/render/characterSprite.js`, `src/render/skinPalette.js`,
`src/render/portraitRenderer.js`, `src/render/characterStage.js`.

Effects and events: `src/render/spellImpactFx.js`, `src/render/vfxGpu.js`, `src/render/killFx.js`,
`src/render/foeTelegraph.js`, `src/render/telegraphStyle.js`, `src/render/weaponGlowGlsl.js`, `src/render/auraRing.js`,
`src/render/auraPixel.js`, `src/render/armoryPass.js`; the gate (`src/render/gate/`), the Elite Gates (`src/render/eliteGates/`), the Super
dungeon (`src/render/superDungeon/`), the Starfall (`src/render/starfall/`), the dragon (`src/render/dragon/`), the
Sky-Ketch (`src/render/ketch/`), and the event passes (`src/render/rocketPass.js`, `src/render/newEraPass.js`,
`src/render/riteSmoke.js`, `src/render/serpentRender.js`, `src/render/deadlands.js`, `src/render/courtCrystals.js`,
`src/render/spoilsGlow.js`).

World pieces: `src/render/labGrass.js`, `src/render/grassPixelArt.js`, `src/render/grassMeadow.js`,
`src/render/lowPolyTreesRender.js`, `src/render/realWindows.js`, `src/render/windowLight.js`, `src/render/bannerPass.js`,
`src/render/shipFlagPass.js`, `src/render/navalRender.js`, `src/render/comeSailAwayRender.js`,
`src/render/ambientLifePass.js`, `src/render/nodeGlow.js`, `src/render/nodeGlint.js`, `src/render/npcMarkPass.js`,
`src/render/partyPingDraw.js`, `src/render/poiGizmoPass.js`, `src/render/meshAlpha.js`, the card tables
(`src/render/cardTableDraw.js`, `src/render/iliacTableDraw.js`, `src/render/gambitTableDraw.js`).

**The auras in Daggerfall's pixels** (`src/render/auraPixel.js`). Every aura look is answered at the middle of its
texel, a Daggerfall flat's pixel at most (`GLOBAL_SCALE`, 2.5 cm) and half of it at least, a power of two to a unit of
its surface. The ground and the strips measure it off the screen's derivatives. A card is at least 32 texels a side, the
cloth 256 each way, a wing's strand 64 along it and none across. A texel no bigger than the screen's pixel is answered
per pixel. A look's own line widths are at least a texel (`auraPx`), so a fine line is never lost between texels.

The light is cut to ten levels, the squares of tenths, its hue kept, by the ordered dither weighed in light so its mean
holds. A look that covers keeps its colour and has its cover cut to tenths. The Crystal Resonance's squares are its own
pixels and are never resampled. Aura Armory pieces take the levels alone. The passes set `uPixel` to 1; a probe's
`pixel = false` reads the designs per pixel and `'levels'` the levels without the snap (`PIXEL=1 node
tools/auraProbe.mjs` reads every design with the law on). No aura floats its third draw's cards over a rider: a horse,
a cart, a wagon's bench, a dragon, an Admin's /dragon (`src/scenes/auraHost.js` peerMounted). Pinned by
`test/render/aurapixel.test.js` and `test/render/auditaurapixel.test.js`.

Tests: `test/render/glstate.test.js` (every uniform declared where used), `test/render/boot2.test.js` (the entry's
static reach), `test/render/shadermount.test.js`, `test/render/perfface.test.js`, `test/render/retro1.test.js`.

## Open

- Character meshes draw with back-face culling off, because the rig's faces have inconsistent winding
  (`drawCharacter`); a stronger key light shows their back faces.
