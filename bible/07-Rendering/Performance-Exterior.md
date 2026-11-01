# Performance: The Exterior Frame

The outdoors cost far more than interiors: a streamed town is thousands of flat batches, sixty lanterns a pixel at
night, shadow cascades, grass, clouds and water. This page holds the mechanisms that keep the exterior's render frame
cheap without changing the picture. The general laws and instruments are `Performance-Priority.md`.

## How it works

### Flats

- **Arenas.** A still billboard batch takes a range of quads in a shared arena: one VAO and one vertex buffer for
  thousands of batches, one index buffer for every arena (`src/render/renderer.js` `BB_ARENA_QUADS`, growing to
  `BB_ARENA_MAX_QUADS`). A draw names its range by index offset. A dynamic batch (gibs, blood) keeps its own buffers.
  A record's batches sit together in their arena.
- Every batch is born with every field it will carry, so its shape never changes.
- A flat's size and origin go up only when they change, in the draw and in the shadow replay.
- The far-flat rule is asked without minting an object (`src/world/flatDistance.js`).
- The renderer binds a VAO only when it differs from the one bound (`_bindVao`).

### Shadows (`src/render/shadowPass.js`)

- A flat batch reaches a shadow by its placements' bounds (`src/render/bounds.js`); a run of a static batch's
  sub-meshes is one depth draw.
- Every lantern's static signature is folded in one walk; a lantern's six faces share one walk; the sun's cascades share
  one walk.
- A recorded mesh's matrix scale is computed once; the lanterns' face matrices and cube walk are made in place.
- The placed batches' volume answers are kept, and the cheapest skip runs first.
- A live face that holds the cache is left alone: only the faces a mover touches are copied.
- The sun's 3x3 shadow kernel is read in four taps.

### The draw order and the shaders

- **Ground last.** The visible pixels' ground is drawn after every opaque mesh, so ground fragments under buildings and trees fail
  the depth test instead of being shaded in full.
- Every visible pixel's water is one call.
- A sky told to hide its clouds skips computing them (the dome's deck at cover 0, Dynamic Skies' sheets under the
  volumetric clouds); the resolve skips images that were not drawn (`src/render/airPass.js`).

### The stream

- The stream build's slices run in their own animation frame, and the build slice is what the frame left
  (`src/systems/frameClock.js`); the FPS counter sees it. A pixel's publish tail breathes.
- Grid promotions are built on the terrain worker (`src/world/terrain/terrainGenClient.js`, `generatePixelTerrain`).
- The grass field's slot count is swept once; the field survives the floating-origin shift; its rim is placed a slice a
  frame, each cell by a deadline set from the eye's own step, so cells are placed before the eye reaches them
  (`src/render/labGrass.js` `createGrassField`).
- A collider cell's key is a number (`src/player/collider.js`).

### The town

- The town loop mints no frame's worth of garbage: people, plaques and flats update in place.
- The collider's buckets that stand still (doors, levers, static models) are filed on a coarse grid, so a ray or a
  sphere asks only the buckets under its own box; moving and oversized buckets are asked by every query. One visited set
  is cleared per bucket, and the marks' stamp starts a new epoch on wrap (`src/player/collider.js`).

## Rules

- Picture-neutral: every mechanism here draws the same pixels.
- A shader that multiplies its answer by nothing does not compute the answer.
- The render scale (`Rendering.md`) is the per-pixel lever for a weak GPU; this page is the CPU and draw-count side.

## Code and tests

- `src/render/renderer.js` - arenas, flats, `_bindVao`
- `src/render/shadowPass.js`, `src/render/bounds.js` - the shadow walks
- `src/render/labGrass.js` - the grass field
- `src/player/collider.js` - broad phase and rays
- `test/render/perfexta.test.js`, `test/render/perfextb.test.js`, `test/render/perfextd.test.js` - the shadow, flat and
  shader slices
- `test/render/perfarena.test.js`, `test/render/perfvol.test.js`, `test/render/perfalloc1.test.js` - arenas and walks
- `test/render/fb1021b_grass.test.js` - the grass rim's deadlines
- `test/player/fb0930_frame.test.js` - the ray marks' epoch
- `tools/grassMoveProbe.mjs` - the grass field under a moving eye
