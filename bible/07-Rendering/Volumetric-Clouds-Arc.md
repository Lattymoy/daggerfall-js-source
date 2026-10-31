# Volumetric Clouds

The enhanced outdoors draw true volumetric clouds: a raymarched cloud layer that drifts with the wind, builds with the
weather, changes shape as it passes, and casts real shadows on the ground. Storms stand as thunderheads with rain shafts
hanging under them, broken cloud throws light shafts, and a thin cirrus layer keeps the sunset's colour longest. The
player sees them under either enhanced sky, the port's dome or Dynamic Skies.

## How it works

- **A sky-space map, not a per-pixel march** (`src/render/volumetricClouds.js`). The march writes an equirectangular
  hemisphere map from the camera's world position. A stripe is re-marched each frame with a fixed per-texel jitter, so
  dithering never flickers; the composite draws the whole sky with one bilinear sample per pixel, blending the map over
  the sky by its transmittance. Stars and the sun's disc show through the gaps by construction.
- **One field for sky, sun disc and ground.** The shadow map is the same density field seen from the ground: a square
  of `SHADOW_EXTENT` metres snapped to the 819.2 m pixel grid round the camera, each texel the transmittance along the
  sun's ray through the slab. The terrain, models, characters and flats read it through one shared GLSL block
  (`src/render/cloudShadow.js` `CLOUD_SHADOW_GLSL`). The sun's disc dims through the sky map's own transmittance.
- **Floating origin.** Both marches sample at the absolute position, so clouds stay over the land through a recentre and
  the shadow map is kept, not re-marched. In the fixed city a pixel crossing shifts the map by whole texels and marches
  only the uncovered strip.
- **The ease is the clock.** The clouds read the eased weather row (cover, softness, greyness, cloud colours) and a
  per-weather profile (`VC_PROFILE`) on the same clock, and drift on the one wind integral, so cover builds over a
  front's lead as the rain and wind do.
- **Cells.** The field takes weather cells (a place, a radius, a profile and a tint) from the weather map, so a
  thunderhead stands over the hills under a sunny sky and its shadow falls where it stands (`Weather-Arc.md`).
  `?cloudcell=` stands a test cell.
- **Living clouds.** The shape volume is read through its own height as game time passes, so towers rise and edges
  billow; coverage drifts slower than the wind, so banks build and dissolve in place. Both run on game minutes, so every
  player online sees the same clouds.
- **Detail.** Decks and storm lids carry structure in the density field itself, not just in the lighting.
- **Light shafts.** The lighting lane's screen-space shafts take their sky mask from the cloud map's transmittance, so
  broken cloud in front of the sun throws beams and a solid deck throws none. Shadow shafts in the haze:
  `src/render/airPass.js` walks each shaft pixel's view ray 12 jittered steps out to 3000 m, each step's sun read from the cloud
  shadow map and weighted by a forward-scatter phase, so lanes of shadow slant under a broken deck from any direction.
  It runs only with a deck, the sun up and a fog with extinction; `?haze=off` shuts it (and Heat Haze, which reads the
  same door).
- **Rain shafts** (`src/render/rainCurtains.js`). A raining, storming or snowing cell hangs a curtain from its base to
  the ground, streaked and moving with the cell, fading as the player comes under it and the falling rain takes over.
- **Cirrus.** A thin ice-cloud layer at 8 to 10 km, one sample a ray, streaked along the wind; fair and cloudy skies
  carry it.
- **Aerial perspective.** Every sample fades toward the horizon's colour by its own distance (`aerial`), never by where
  a march span begins, so span bookkeeping can draw no line in the sky.
- **Cost-paced sweep.** `sweepFramesFor(cover, cells)` spreads the re-march over as many frames as the sky costs: 8 for a
  fair sky, 16 for a covered one, up to 32 (`SWEEP_FRAMES_MAX`) for a covered sky under storm cells. A sweep holds its
  pace to its end, and powers of two keep every tier's map divisible.
- **Arrival.** `src/render/cloudsArrival.js` compiles the cloud programs and marches the first map while the world loads.

## Rules

- True volumetric clouds that move, build in weather and cast real shadows on the ground, keeping the existing cloud
  behaviour (Mac).
- Under Dynamic Skies our clouds draw over the mod's sky and the mod's two cloud sheets stand down (Mac); `?clouds=off`
  gives the mod its sheets back (`Dynamic-Skies.md`).
- No toggle of its own: it rides Enhanced environments. `?clouds=off` is the kill switch; `?clouds=lo|hi` the quality
  doors.
- **Cloud quality** (`cloudQuality`): Default, Low, High (`QUALITY`), the player's own online. The Skyrim aurora uses the
  same tiers.

## Code and tests

- `src/render/volumetricClouds.js` - the march, the sky and shadow maps, `QUALITY`, `VC_PROFILE`, `sweepFramesFor`
- `src/render/cloudNoise.js` - the two noise volumes
- `src/render/cloudShadow.js` - the shared shadow block
- `src/render/rainCurtains.js` - rain shafts
- `src/render/cloudsArrival.js` - boot compile and first march
- `src/scenes/shared.js` - builds the clouds on the enhanced lane, under either sky
- `test/render/volumetricClouds.test.js` - the march, the composite and the dome's ray text kept equal
- `test/render/vc7a_living.test.js`, `test/systems/weather/vc7c_curtains.test.js`, `test/render/skyarc_aerial.test.js`,
  `test/render/cloudsarrival.test.js`
