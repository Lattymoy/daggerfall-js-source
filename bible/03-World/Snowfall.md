# Snowfall

A port of demifiend000's **Snowfall 1.0.5** for Daggerfall Unity (Nexus 1401). In winter, outside the desert, real
snow lies on the ground: it deepens while it snows and melts in clear weather, takes the tracks of the player, foes and
townsfolk and a body's hollow, keeps them in the save, and fills them back over the hours. The mod's winter ground
textures dress the winter tile archives. The player meets it outdoors in any snowy province on the enhanced sky.

## How it works

- **Winter ground.** The bundle's 168 winter ground records (TEXTURE.103, .303 and .403), snow albedo and surface masks
  ship under `public/art/snowfall/`, written and checked by `tools/environmentModsExtract.mjs`. They are a bundled mod
  in the texture door, registered beside Vanilla Enhanced (`src/systems/vanillaEnhanced/vanillaEnhancedPack.js`
  `ENVIRONMENT_PACK_MODS`), on by default with a switch on the Replacement packs card, loaded after Vanilla Enhanced's
  Base.
- **The model.** `src/systems/snowfall.js` is the mod's model whole, read off its assembly (`vendor/snowfall/il/`):
  settings, snowpack and depth rules, coverage masks, the persistent track field and its save, corpse impressions and
  the Basic Roads classifier, in the C#'s own single or double precision and dictionary order.
- **The runtime.** `src/systems/snowfallRuntime.js` is the controller's frame: the local window round the player, the
  middle ring, the per-tile blanket, the far track mask, the stamps, the refill, the snowpack's clock, the floating
  origin and the save. `src/render/snowfallGlsl.js` splices the snow into the ground's own fragment program;
  `src/render/snowfallSurface.js` uploads and draws the tiers.
- **The host.** `src/scenes/snowfallHost.js` `createSnowfallHost` builds the runtime over the ground both exterior hosts
  draw (`src/scenes/snowGround.js` in the world host). Interiors and dungeons stand no snow. Indoors it keeps the snowpack and refill and hides the surfaces.
  It is drawn with the opaque world before the ground under it.
- **On the ground as drawn.** Every height and normal is the drawn surface's, at the stride it is drawn. The carved sea
  floor stays bare. A pixel built again rebuilds its blanket and the nearer tiers.
- **Who walks it.** The player, street foes and the watch, and townsfolk. A body is its corpse marker's ground.
- **Roads.** On the Bay the classifier reads the Basic Roads mod's network. Past the Bay it reads the land's own roads
  by the road painter's record of the tiles it wrote (`snowfallNetworkBeyond`). Pixels are keyed by `worldPixelKey`
  and the context box and metres are clamped to the world's grid (`SNOW_WORLD_METRES`), so tracks, berms and hollows
  stand in every province.

## Rules

- The four archives the owner handed over are on by default and integrate seamlessly into the enhanced environments
  (the owner; permission recorded in `vendor/snowfall/`).
- Built under the enhanced sky only. The mod's `Enabled` switch (on by default) and `?snowfall=off` stand beside it.
  Off, the surfaces hide and the snowpack keeps its clock.
- Lit by the ground's own program: sun and shadow map, moon, cloud shadow, lanterns and fog. It casts nothing. It sits
  over the ground by the mod's 8 mm offset and a polygon offset in the sea's layer stack (`SNOW_LAYER`).
- The clocks: the snowpack and refill run on the event clock's game time; winter is the sky's season; build budgets
  are real seconds (`SNOW_FRAME_BUDGET_MS`, 2 ms a frame). Where the build worker is up, the window and ring build
  there.
- A teleport's re-anchor carries the tiers and their tracks, so the old place's tracks stay there.
- Snowless climates: a climate whose winter set Vanilla Enhanced's Snowless Swamps and Jungles decides gets no snow, and
  a desert tile is always bare (`winterGroundSnowless`).
- Online the mod is the player's own (`src/systems/online/onlineLane.js`).

## Daggerfall Unity

The mod is `DynamicSnow.dll`. Departures:

- The save's deflate writes one fixed-Huffman block (`src/formats/rawDeflate.js`); either reader reads either stream.
- Global metres are exact (the stream's own origin), not PlayerGPS's whole units.
- Location Loader is not in the port, so its authored cap never applies.
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
- `test/systems/snowfall1_model.test.js` - the model against traces of the mod's own C# compiled under .NET
- `test/render/snowfall1_runtime.test.js` - the runtime
- `test/render/bayleftground_snow.test.js` - the snow past the Bay
- `test/systems/audit_environs.test.js` - cost and integration
- `test/scenes/fb1009_travelperf.test.js` - the travel view's hold, the save and refill savings
- `tools/mutants/snowfall1.json` - the mutants

