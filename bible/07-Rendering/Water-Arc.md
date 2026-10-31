# Enhanced Water

Enhanced water replaces Daggerfall's flat, painted water tile with translucent water on the enhanced skin: a moving sheet
with weather-driven swell, a carved bed under it, depth that swallows light, Fresnel reflection of the sky, foam on the
shore, ripples from swimmers and boats, and a sea that reaches the horizon. The player sees it in rivers, ponds, moats
and the sea. The classic skin keeps DFU's flat tile. Where the water is for gameplay (feet, swimming, fishing, paths,
boats) does not change.

## How it works

### What Daggerfall draws

Water is record 0 of the terrain tileset, written by every producer of the 128x128 tilemap: the ocean by height
(`src/world/terrain/terrainTiles.js` `generateTileData`), shores by marching squares, rivers by the road painter, and a
town's ponds and moats by the RMB's ground tiles. The terrain pass draws it opaque and unmoving.

### The enhanced water (`src/render/waterSurface.js`)

- **The bed** (`src/world/water/waterBed.js`). A grid vertex is wet when every tile meeting it calls that corner water.
  Its distance to the bank (a 3-4 chamfer) sets its depth, a smoothstep to `BED_DEPTH` (4) over `BED_RAMP` (19.2). The
  ground is carved only past one cell from the bank (`SHELF_CHAMFER`), so the sheet's edge always lies on uncarved
  ground. The bed is drawn only; `heightAt` and the feet read the uncarved samples.
- **The bed's face** (`src/render/waterBedGlsl.js`). Under the enhanced water a ground water texel takes the climate's
  dirt darkened to silt. A shore record's painted water outside the sheet goes under the silt too, and the fringe beyond
  is wet mud (`src/world/puddleMask.js` `shoreWaterColours`, `SHORE_DRY_RATIO`).
- **The swell.** Three wave trains about the wind, at deep water's speed, their height the wind's from `SWELL_CALM`
  (0.05) to `SWELL_GALE` (0.34), faded over the bank. `swellAt` is the same sum on the CPU. The open sea takes the swell
  as slope only.
- **The body.** Beer-Lambert absorption (`WATER_ABSORB` 0.55, 0.30, 0.22 a unit), replaced by the water's own colour
  (the climate's water texel's mean) lit by the ground's light. On the lighting lane the frame's colour and depth are
  copied once a frame before the first water draw (`AirPass.snapshotUnderWater`), so the water refracts what lies under
  it; on the classic lane the blend does the same sum. Schlick Fresnel over the sky (capped at 0.85), glints of sun,
  moon and lamps, the fog.
- **The shore.** Foam over the shallow band (`FOAM_DEPTH` 0.22), its edge riding the swell up the bank (`FOAM_RUNUP`),
  cut into lace by drifting noise; steep crests whiten in a strong wind. Come Sail Away's sprite breakers stand down
  under the enhanced water.
- **The ripples** (`src/world/water/waterRipples.js`). A damped wave equation (`RIPPLE_DAMPING` 0.975) on a 96-cell grid
  48 units round the camera at 30 Hz, stirred by the player and every boat afloat. Uploaded only when it moved.
- **The open sea.** Iliac Puddle No More's surface sheets (Deep Waters) are drawn by the same program from above; its own
  underside from below.
- **The horizon.** One haze law for every surface past the streamed grid's fog (`src/render/horizonHaze.js`
  `HORIZON_HAZE_GLSL`): the world fog's ramp capped at the far ring's hold. The streamed sea holds it too, and the far
  ring's sea shares the water's own look (`SEA_LOOK_GLSL`), so the sea runs on continuously to the horizon. Ring cells
  inside the streamed rect fill the sea past the world's far plane, only those the eye can see.
- **The coast** (`src/world/terrain/groundEdge.js`, `src/render/groundEdgeGlsl.js`). A transition tile draws its two
  kinds' base records at a share moved by a three-octave wander, so shores have no straight tile edges; Deep Waters' sea
  is cut on a wandering line instead of whole tiles. `?coastedges=off` restores the tile edges.
- **Town puddles are dry** (`src/world/puddleDry.js`). A one-tile patch of water, or one made only of shallow-water art,
  takes the ground its dry neighbours stand on. It runs where a block is served (`src/formats/blocksFile.js`
  `getBlock`), so every reader of the ground sees one ground, on both skins. Moats, ponds and docks stay.

## Rules

- Real translucent water with proper waves and shoreline interaction, replacing the old water (Mac). The waves are
  modest and the weather's: calm lakes and rivers, a sea swell that grows in a storm.
- The new water is the enhanced skin's; the classic skin draws DFU's tile.
- Drawn only: every reader of water as play keeps DFU's line (`WATER_MASK_TABLE`): the feet, swimming, fishing,
  climbing, the townsfolk's paths, Deep Waters' swim, the boats' `WaterLevel`.
- Puddles are removed from town layouts, puddles only, on both skins (Mac).
- Shores blend on both edges, the water's and the beach's (the owner).
- A look is judged on shots of the real game (`tools/waterLookProbe.mjs`), not the lab.
- Switches: **Enhanced water** (`enhancedWater`, on by default, the player's own online; `?water=off`), takes effect
  when the world next loads; **Water quality** (`waterQuality`): Full, or Simple, which takes no frame copy and keeps no
  ripple field.

## Daggerfall Unity

DFU draws water as an opaque terrain tile, and classic palette-cycled it. Departures, enhanced skin only: the moving
sheet, bed, body and shore above; the coast's wandering blend (DFU's tiles have straight edges); and, on both skins,
dry town puddles.

## Code and tests

- `src/render/waterSurface.js` - the water program, swell, body, foam, open sea
- `src/world/water/waterBed.js`, `src/render/waterBedGlsl.js` - the bed and its face
- `src/world/water/waterRipples.js` - the ripple field
- `src/world/water/waterCorners.js` - the draw's corner table and `WATER_MASK_TABLE`
- `src/render/horizonHaze.js`, `src/render/farRing.js` - the horizon and the ring's sea
- `src/world/terrain/groundEdge.js`, `src/render/groundEdgeGlsl.js` - the coast
- `src/world/puddleDry.js`, `src/world/puddleMask.js` - dry puddles, shore water colours
- `test/render/waternext.test.js`, `test/world/terrain/waterbed.test.js`, `test/world/water/waterripples.test.js` - the
  surface, bed and ripples
- `test/render/farsea1.test.js`, `test/world/shoresilt.test.js`, `test/world/water/bankflush.test.js`,
  `test/render/coastlook.test.js`, `test/world/puddledry.test.js`

## Open

- Past 0.85 of the fog's end the sea holds at the ring's haze while streamed land goes to solid fog, so far land can
  read as a pale flat shape against the sea. A sea that reads farther would want its own hold; that is Mac's call.
- A small pond is shallow by the bed's law and reads clear over its silt.
- The cost on a real GPU is not measured here.
