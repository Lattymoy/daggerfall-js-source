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

- **The level** (`src/world/water/waterLevel.js`, `src/world/water/streamLevels.js`). The tiles only mark where water
  is: each grid vertex gets the share of the tiles meeting it that call that corner water (`waterVotes`, the draw's
  table; a tile Deep Waters' cap clipped is the open sea, water at every corner). A marked vertex takes its body's level: World 2.0's surface, Cyrodiil's river or lake level, the sea's 34
  where the ground stands at its clamp, else its uncarved ground (a town's pond, a Bay river). A dry vertex beside the
  water borrows its neighbours' mean, never above its own ground. The sheet is its own mesh at that level
  (`waterSheet`), four triangles about each quad's centre, so water one tile wide keeps a middle. It is built with the
  bed on the terrain worker. No water tile art is drawn.
- **The bed** (`src/world/water/waterBed.js`). A grid vertex is wet when every tile meeting it calls that corner water.
  Its distance to the bank (a 3-4 chamfer) sets its depth, a smoothstep to `BED_DEPTH` (4) over `BED_RAMP` (19.2). The
  ground is carved only past one cell from the bank (`SHELF_CHAMFER`), to min(ground, level - carve): never raised, and
  World 2.0's deeper floors are left alone. The bed is drawn only; `heightAt` and the feet read the uncarved samples.
- **The bed's face** (`src/render/waterBedGlsl.js`). Under the enhanced water a ground water texel takes the climate's
  dirt darkened to silt, on the sheet's own smoothed line (below): a dry tile the line calls wet is silted, a whole water
  tile's art is silt whole, and a shore transition's two kinds meet on the same line (`groundEdgeGlsl.js` `shoreGlsl`).
  A shore record's painted water outside the sheet goes under the silt too, and the fringe beyond is wet mud
  (`src/world/puddleMask.js` `shoreWaterColours`, `SHORE_DRY_RATIO`).
- **The swell.** Three wave trains about the wind, at deep water's speed, their height the wind's from `SWELL_CALM`
  (0.05) to `SWELL_GALE` (0.34), faded over the bank. `swellAt` is the same sum on the CPU. The open sea takes the swell
  as slope only.
- **The body.** Beer-Lambert absorption (`WATER_ABSORB` 0.55, 0.30, 0.22 a unit), replaced by the water's own colour
  (the climate's water texel's mean) lit by the ground's light. On the lighting lane the frame's colour and depth are
  copied once a frame before the first water draw (`AirPass.snapshotUnderWater`), so the water refracts what lies under
  it; on the classic lane the blend does the same sum. Schlick Fresnel over the sky (capped at 0.85), glints of sun,
  moon and lamps, the fog.
- **The shore is a curve, never a tile's edge.** Where the plane runs on over ground no higher than it, a cut field from
  the votes ends it, with the coast's wander. The field is smoothed (`shoreMap`): laid on a lattice of half tiles,
  blurred by `SHORE_SIGMA` (0.6 tile) and held within `SHORE_HOLD` (0.7) of itself, so a stream or a pool a tile wide
  keeps its heart. A near sheet carries its fields as an RGBA8 texture read bilinear (`WATER_SHORE_UNIT`): the cut, the
  bed's own water, the clip's share spread a tile (`OPEN_SIGMA`), and the bank's rise.
- **A bank is rounded.** Where a plane meets rising ground the depth test would cut the sheet on the ground's own
  triangles, kinked on their diagonal. The bank's rise - how far the drawn ground stands over the plane, smoothed by
  `RISE_SIGMA` (0.35 tile) - fades the water out over `RISE_FADE` (0.025 to 0.065), short of `WATER_LIFT`, so it ends
  on that curve a fraction of a tile inside the triangles' line. Finer drawn ground would part from the walked one
  (`heightAt`). The water also fades in over `SHORE_MEET` (0.06) of depth behind it. Foam over the shallow band (`FOAM_DEPTH` 0.22), its edge riding the swell up the bank (`FOAM_RUNUP`),
  cut into lace by drifting noise; steep crests whiten in a strong wind. Come Sail Away's sprite breakers stand down
  under the enhanced water.
- **The ripples** (`src/world/water/waterRipples.js`). A damped wave equation (`RIPPLE_DAMPING` 0.975) on a 96-cell grid
  48 units round the camera at 30 Hz, stirred by the player and every boat afloat. Uploaded only when it moved.
- **The open sea.** A coastal pixel's sea is its near sheet's, to the coast. Over Deep Waters' clip the sheet swells
  whole. With the frame's copy it reads the mod's floor through the water as the mod's own sheet does; without one it
  stands at the open sea's depth (`OPEN_PATH`), faded in by the clip's smoothed share. The water at the sea's level
  wears the mod's Top Color, as Iliac Puddle No More's own sheets and the far ring's sea do. Those sheets are drawn by
  the same program from above where no near sheet stands (a hidden pure-ocean pixel); from under the sea, the mod's
  underside, and the near sheet over the clip stands down.
- **The cap's coast is a curve** (`COAST_EDGE`). By the clip, at the sea's level, the sea ends where the clip's
  smoothed share stands at a half, not on the votes. The ground the cap cuts follows the same share, deeper
  (`COAST_CUT.share`), so the sea stands full over it and the drop to the mod's floor is a curve too. A tile the cap
  kept in a notch goes under the sea; a kept point with no kept tile beside it wears the nearest two out.
- **The horizon.** One haze law for every surface past the streamed grid's fog (`src/render/horizonHaze.js`
  `HORIZON_HAZE_GLSL`): the world fog's ramp capped at the far ring's hold. The streamed sea holds it too, and the far
  ring's sea shares the water's own look (`SEA_LOOK_GLSL`), so the sea runs on continuously to the horizon. Ring cells
  inside the streamed rect fill the sea past the world's far plane, only those the eye can see.
- **The coast** (`src/world/terrain/groundEdge.js`, `src/render/groundEdgeGlsl.js`). A transition tile draws its two
  kinds' base records at a share moved by a three-octave wander, so shores have no straight tile edges; Deep Waters' sea
  is cut on a wandering line instead of whole tiles, on the clip's smoothed share where the sheet stands.
  `?coastedges=off` restores the tile edges.
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
- A look is judged on shots of the real game (`tools/waterLookProbe.mjs`, `tools/waterLevelProbe.mjs`), not the lab.
- Switches: **Enhanced water** (`enhancedWater`, on by default, the player's own online; `?water=off`), takes effect
  when the world next loads; **Water quality** (`waterQuality`): Full, or Simple, which takes no frame copy and keeps no
  ripple field.

## Daggerfall Unity

DFU draws water as an opaque terrain tile, and classic palette-cycled it. Departures, enhanced skin only: the moving
sheet, bed, body and shore above; the coast's wandering blend (DFU's tiles have straight edges); and, on both skins,
dry town puddles. From Iliac Puddle No More, enhanced skin only: its top is not drawn over a coastal pixel seen from
above (the near sheet carries that sea, reading the mod's floor as its own sheet does), its Top Color tints the near
sheet's sea, and its coast is the clip's smoothed share, not the clip's tiles.

## Code and tests

- `src/render/waterSurface.js` - the water program, swell, body, foam, open sea
- `src/world/water/waterLevel.js`, `src/world/water/streamLevels.js` - the level and the sheet
- `src/world/water/waterBed.js`, `src/render/waterBedGlsl.js` - the bed and its face
- `src/world/water/waterRipples.js` - the ripple field
- `src/world/water/waterCorners.js` - the draw's corner table and `WATER_MASK_TABLE`
- `src/render/horizonHaze.js`, `src/render/farRing.js` - the horizon and the ring's sea
- `src/world/terrain/groundEdge.js`, `src/render/groundEdgeGlsl.js` - the coast
- `src/world/puddleDry.js`, `src/world/puddleMask.js` - dry puddles, shore water colours
- `test/render/waternext.test.js`, `test/world/terrain/waterbed.test.js`, `test/world/water/waterripples.test.js` - the
  surface, bed and ripples
- `test/world/water/waterlevel.test.js` - the level, the votes and the sheet
- `test/world/water/watershore.test.js` - the shore's smoothed fields, the bank's rise, the coast as the eye reads it
  (on the Bay and past it), the programs and the renderer
- `test/render/farsea1.test.js`, `test/world/shoresilt.test.js`, `test/world/water/bankflush.test.js`,
  `test/render/coastlook.test.js`, `test/world/puddledry.test.js`

## Open

- Past 0.85 of the fog's end the sea holds at the ring's haze while streamed land goes to solid fog, so far land can
  read as a pale flat shape against the sea. A sea that reads farther would want its own hold; that is Mac's call.
- A small pond is shallow by the bed's law and reads clear over its silt.
- World 2.0's water is drawn at its surface, but the feet and the swim still stand on its bed: moving them is a change to
  play.
- On the far ring (stride 4) a river or pond narrower than a cell gets no sheet and shows as silt.
- On a rising bank the water ends a fraction of a tile short of where the plane meets the ground, so a thin rim of wet
  ground shows; a stream a tile wide reads a little narrower than its tiles.
- A shore's smoothing holds each pixel's own edge, so a shore crossing a seam can step a fraction of a tile there.
- The far ring (stride 4) keeps its vertices' cut: its shores are a cell's polyline, seen only far off.
- With the mod's Spawn Surfaces off, the near sheet still covers the clip.
- By the cap's clip the drawn sea ends on the clip's smoothed share: a sliver of land the cap kept at the sea's height
  can lie under the water's edge, and a clipped tile poking into the land can show as sand. The swim keeps the mod's
  line.
- The lane's terrain program reads sixteen samplers with the shore's, the least every WebGL2 offers.
- The cost on a real GPU is not measured here.
