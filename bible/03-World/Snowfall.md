# Snowfall

A port of demifiend000's **Snowfall 1.0.5** for Daggerfall Unity. In winter, outside the desert, real snow lies on the
ground: it deepens while it snows and melts in clear weather, takes the tracks of the player, foes and townsfolk and a
body's hollow, keeps them in the save, and fills them back over the hours. The winter ground, the masks, the albedo and
the shader are our own; the model and the runtime are the port of the assembly (`01-Overview/Own-Work.md`). The player
meets it outdoors in any snowy province on the enhanced sky.

## How it works

- **Winter ground.** Our snow rule over the player's own TEXTURE.103, .303 and .403, or over the summer record where
  the data has none (`src/systems/ownTextures/ownTextureRules.js` `snow`): snow laid by slope and exposure, crept
  downwind, shaded cold. It keeps half the record's own grain (a quarter over a summer record), so a field is not a
  flat white, and sifts into a paving's joints only near the drift's edge. It is a pack in the texture door, beside
  Vanilla Enhanced (`src/systems/vanillaEnhanced/vanillaEnhancedPack.js` `ENVIRONMENT_PACK_MODS`), on by default with a
  switch on the Replacement packs card, loaded after Vanilla Enhanced's Base.
- **The masks and the albedo** are that law's coverage (`snowMask`) and our own noise (`snowAlbedo`). The albedo is
  read twice, the second read turned and at 1 / phi^2 of the scale, so a field never shows the 4 m tile.
- **The model.** `src/systems/snowfall.js` is the mod's model whole, read off its 1.0.5 assembly:
  settings, snowpack and depth rules, coverage masks, the persistent track field and its save, corpse impressions and
  the Basic Roads classifier, in the C#'s own single or double precision and dictionary order.
- **The runtime.** `src/systems/snowfallRuntime.js` is the controller's frame: the local window round the player, the
  middle ring, the per-tile blanket, the far track mask, the stamps, the refill, the snowpack's clock, the floating
  origin and the save. `src/render/snowfallGlsl.js` is our own GLSL, written from what the snow must do, spliced into
  the ground's own fragment program; `src/render/snowfallSurface.js` uploads and draws the tiers.
- **The surface's law** (`src/render/snowfallGlsl.js`). A path trodden is 5% grey, a track packed darker and colder
  with its depth. A track narrower than the grid keeps the deepest press across the vertex's cell. A sharper track
  (ImpressionStrength) is deeper at its centre and higher at its shoulders; under a body the setting's depth stays.
  Every tier edge eases by a quintic.
- **The host.** `src/scenes/snowfallHost.js` `createSnowfallHost` builds the runtime over the ground both exterior hosts
  draw (`src/scenes/snowGround.js` in the world host). Interiors and dungeons stand no snow. Indoors it keeps the snowpack and refill and hides the surfaces.
  It is drawn with the opaque world before the ground under it.
- **On the ground as drawn.** Every height and normal is the drawn surface's, at the stride it is drawn. The carved sea
  floor stays bare. A pixel built again rebuilds its blanket and the nearer tiers.
- **Who walks it.** The player, street foes and the watch, and townsfolk. A body is its corpse marker's ground.
- **Authored footprints.** The Location Loader keys read World of Daggerfall's levelled sites
  (`src/world/worldOfDaggerfall/wodLocationLoader.js`): each built pixel's site is a footprint in global metres
  (`src/scenes/snowfallHost.js` `siteFootprintsIn`, handed by `src/scenes/snowGround.js`). The snow on a site lies no
  deeper than `LocationLoaderMaximumDepth` and deepens over `LocationLoaderBoundaryFeather` past its edge;
  `LocationLoaderIntegration` off asks none. Past the Bay World of Daggerfall stands no site, so none is found there.
- **Roads.** On the Bay the classifier reads the Bay's road network (`Roads.md`). Past the Bay it reads the land's own
  roads by the road painter's record of the tiles it wrote (`snowfallNetworkBeyond`). Pixels are keyed by
  `worldPixelKey` and the context box and metres are clamped to the world's grid (`SNOW_WORLD_METRES`), so tracks, berms
  and hollows stand in every province.

## Rules

- On by default, integrated into the enhanced environments (the owner); the winter ground and the shader our own
  (OWN-WORK, the owner).
- Built under the enhanced sky only. The mod's `Enabled` switch (on by default) and `?snowfall=off` stand beside it.
  Off, the surfaces hide and the snowpack keeps its clock.
- Lit by the ground's own program: sun and shadow map, moon, cloud shadow, lanterns and fog. It casts nothing. It sits
  over the ground by our 1 cm offset (`SNOW_SURFACE_OFFSET`) and a polygon offset of -0.5, -1 in the sea's layer
  stack (`SNOW_LAYER`).
- The clocks: the snowpack and refill run on the event clock's game time; winter is the sky's season; build budgets
  are real seconds (`SNOW_FRAME_BUDGET_MS`, 2 ms a frame). Where the build worker is up, the window and ring build
  there.
- A teleport's re-anchor carries the tiers and their tracks, so the old place's tracks stay there.
- Snowless climates: a climate whose winter set Vanilla Enhanced's Snowless Swamps and Jungles decides gets no snow, and
  a desert tile is always bare (`winterGroundSnowless`).
- Online the mod is the player's own (`src/systems/online/onlineLane.js`).

## Daggerfall Unity

The mod is `DynamicSnow.dll`. Departures:

- The winter ground, masks, albedo and shader are ours; the surface stands 1 cm up, not 8 mm.

- The save's deflate writes one fixed-Huffman block (`src/formats/rawDeflate.js`); either reader reads either stream.
- Global metres are exact (the stream's own origin), not PlayerGPS's whole units.
- The Location Loader is World of Daggerfall's, so its levelled sites are the authored footprints.
- Far pixels' tiers read the surface at its drawn stride.
- The travel view draws no snow and hands the controller no player while it is up.
- A save repacks the track field only when it changed; a clean tier is not swept by the refill.
- The progressive builds stop for the frame at the port's budget.
- A body is registered the frame its marker first lies.
- Past the Bay the snow's roads are the land's own, classified by the painter's record.

## Code and tests

- `src/systems/snowfall.js`, `src/systems/snowfallRuntime.js` - the model and the runtime
- `src/render/snowfallGlsl.js`, `src/render/snowfallSurface.js` - the shader and the GPU tiers
- `src/scenes/snowfallHost.js`, `src/scenes/snowGround.js` - the host and the world host's snow ground
- `src/systems/ownTextures/ownTextureRules.js` - the winter ground, the masks and the albedo
- `test/systems/snowfall1_model.test.js` - the model against traces of the mod's own C# compiled under .NET; the
  coverage hash is over our masks (`test/snowMasks.mjs`)
- `test/systems/ownwork4_textures.test.js` - the winter ground; `test/systems/ownaudit_keys.test.js` - the authored
  footprints
- `test/render/snowfall1_runtime.test.js` - the runtime
- `test/render/bayleftground_snow.test.js` - the snow past the Bay
- `test/systems/audit_environs.test.js` - cost and integration
- `test/scenes/fb1009_travelperf.test.js` - the travel view's hold, the save and refill savings
- `tools/mutants/snowfall1.json` - the mutants

