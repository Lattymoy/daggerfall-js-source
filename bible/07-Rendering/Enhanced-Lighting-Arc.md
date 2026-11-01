# Enhanced Lighting

Enhanced lighting is a second set of world shaders, the lighting lane, that lights the game in linear light with
shadows, ambient occlusion, bloom, light shafts, glowing fog around lanterns and eye adaptation. The player sees warmer,
more natural light: lanterns and torches that glow and fall off with distance, shadows from the sun and their torch,
darker corners, glowing windows and flames, rays of sunlight. Off, the classic lane lights in display space as DFU's
numbers do.

## How it works

### The lane (`src/render/enhancedLighting.js`)

When the lane is installed (`Renderer.setLightingLane`), its fragment shaders replace the renderer's mesh, billboard,
terrain, character and decal shaders under the same uniform names. The classic lane never compiles them. A fragment:

1. decodes the texel from sRGB to linear (`elDecode`); every scene colour the renderer uploads is decoded too, so one
   light lands where the classic lane put it and many lights add as physics does;
2. lights lanterns by a windowed inverse square (`elAttenuation`), hot near the flame and exactly zero at the range, up
   to 48 lights (`EL_MAX_LIGHTS`);
3. applies exposure (`EL_EXPOSURE` 1.4) and a luminance-preserving extended Reinhard tonemap (`elTonemapRGB`), identity
   in the dark end with a soft shoulder, so a torch's near field blooms instead of clipping;
4. adds fog in-scatter (`elScatter`): the light a lantern scatters along the view ray, scaled by the fog's density and
   capped at `EL_SCATTER_DENSITY_MAX` (1/40), so clear air shows nothing and foggy dungeons show each torch's halo;
5. encodes back to sRGB. A fully fogged fragment is exactly the fog colour.

Lantern glints (`EL_SPEC_GLOSS`, `EL_SPEC_STRENGTH`) light near surfaces. A surface turned from a light skips it before
its shadow taps. Dungeons are darker (`EL_DUNGEON_AMBIENT_SCALE` 0.35). Indoors a building's own lamps burn at half
intensity (`EL_INTERIOR_LIGHT_SCALE`), white lamps take the flame colour (`interiorLightColor`), and the eye aims at a
darker mean (`EL_INTERIOR_GRADE`). The player's own lights, Improved Interior Lighting's and ships' lanterns keep their
numbers.

### Lights (`src/render/lightClusters.js`, `src/render/lightId.js`)

- **Clustered lights.** The view frustum is cut into a grid of cells, exponential in depth. Once a frame, each light's
  bounds are written into the cells they touch; the lists go to the GPU as two integer textures, and a fragment walks
  only its cell's lights. The grid is conservative: nothing lights that did not, nothing that lit goes dark.
  `?clusters=off` falls back to the full loop.
- **Light identity.** A light enters a frame's list only through `packLight`, carrying its producer's identity
  (`lightIdOf`, `adoptLight`, `relight`), so the shadow pass can tell a moving light from a new one.
- **Reach.** On the lane a town lantern reaches 1.5 times DFU's 18 (`src/world/city/cityLights.js`
  `STREET_LIGHT_REACH`), its flicker scaled with it; the harbour's lamps take the same share. The classic set keeps DFU's
  18. Window light has its own tiers (`Real-Windows.md`).

### Shadows (`src/render/shadowPass.js`)

The renderer has no scene graph, so the shadow pass records what the world pass draws (meshes with their matrices,
terrain, billboard batches) and replays it depth-only from the light at the start of the next frame.

- **Sun:** cascades centred on the eye (`SHADOW_CASCADES` 12, 48 and 240 units; 2048 texels), hardware-compared and
  PCF-softened, snapped to the texel grid beside the eye so shadows hold still.
- **Lamps:** a 512-texel cube map for each of the nearest 12 lights (`SHADOW_POINT_CASTERS`); every other light in the
  room reads a lower-detail map of static casters, so no light ever lights through walls.
- **Static cache.** A lamp's still casters are drawn once into a cache and copied into its map each frame, with movers
  drawn on top, so a tavern where nothing moved pays almost nothing. `?shadowcache=off` turns the cache off.
- **Reach.** Casters the view cull rejects still cast (a tree behind the camera shadows the view).
- **Steady shadows** (a part of the row, on by default): no frame-skipping cadence and a stickier caster hold, at some
  frame-rate cost. Off is the cheaper schedule, where shadows can pop.

### The air (`src/render/airPass.js`)

At the resolve, fed by the frame's own depth: ambient occlusion at half resolution, multiplied into the decoded frame;
bloom at quarter resolution from what actually emits (emission maps, self-lit records, a glare sprite per lantern, each
tested against the frame's depth); light shafts outdoors with the cloud map's transmittance as their sky mask; the
lanterns' volumetric glow marched through their shadows; screen-space contact shadows; eye adaptation from the frame's
mean log luminance (**Calmer eye** slows it). Doors: `?air=off`, `?contact=off`, `?haze=off`, `?volumetrics=off`.

### The classic look with shadows (`src/render/classicShadowLane.js`)

Improved Interior Lighting's "with shadows" option gets the lane's shadow maps without its look: the lane's programs
with decode, tonemap, falloff, specular and adaptation put back to the classic shaders'. The renderer tells the hosts it
is not Enhanced lighting, so they keep classic colours, ambients and fog.

## Rules

- The lane is the player's own, online too (Mac): no wire field, relay law or shared roll reads it.
- A flicker is measured before it is fixed: `tools/lightFlickerProbe.mjs` reads every frame of a standing, walking and
  turning camera.
- New GL work goes through the renderer's bind shadow and `markForeignPass` (`Enhanced-Environments-Arc.md`).
- The switch is the **Enhanced lighting** row (`enhancedLighting`, on by default, takes effect when the world next loads),
  with the parts **Steady shadows**, **Calmer eye** and **Shadow debug log**. `?lighting=classic` is the kill door
  (`enhancedLightingOn`); `?exposure=` tunes exposure.

## Daggerfall Unity

DFU lights in Unity's linear pipeline with its own light components; the port's classic lane lights in display space,
with `(1 - d/range)^2` as its recorded equivalence to Unity's point light falloff. The lane is our own presentation. It
has no bounce light: real bounce needs a reflective shadow map.

## Code and tests

- `src/render/enhancedLighting.js` - the lane's shaders and terms, `syncLightingLane`, interior and dungeon helpers
- `src/render/shadowPass.js` - recording, replay, cascades, cubes, the static cache
- `src/render/lightClusters.js`, `src/render/lightId.js` - clusters and light identity
- `src/render/airPass.js` - AO, bloom, shafts, glow, contact shadows, adaptation, the frame image
- `src/render/classicShadowLane.js` - shadows with the classic look
- `test/render/el1_enhancedlighting.test.js`, `test/render/el2_shadows.test.js`, `test/render/el3_air.test.js`,
  `test/render/el4_frame.test.js` - the lane's four tiers
- `test/render/lightid.test.js` - no light enters a list any other way
- `test/render/la_audit.test.js`, `test/render/la_cost.test.js`, `test/render/cachecopy.test.js`,
  `test/render/interiordim.test.js`, `test/render/lightreach.test.js`

## Open

- The player's and peers' Morrowind bodies and the first-person arm cast no shadow of their own (an NPC's body does);
  the water surface receives none.
