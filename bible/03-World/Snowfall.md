# Snowfall - snow that falls, lies and is walked through (SNOWFALL1, 2026-10-08)

**The owner's call (2026-10-08), handing over four archives: "We have
permission to use and implement everything into the codebase. These should
be on by default and integrate into our enhanced environments seamlessly."**
demifiend000's **Snowfall 1.0.5** for Daggerfall Unity (Nexus 1401). Ledger
row SNOWFALL1; the registry row and the permission line (Mac's word recorded,
the author's own still to come - `RECORD OPEN`) are `vendor/snowfall/`'s. Its
siblings from the same message: `07-Rendering/Heat-Haze.md`,
`07-Rendering/Windfall.md`, `07-Rendering/Sands-Of-The-Alikr.md`.

## The winter ground

The mod's bundle packages 168 winter ground records - TEXTURE.103, .303 and
.403, Daggerfall's winter tiles under the author's snow - with its snow albedo
and three surface masks (`snow_surface_masks_<archive>.bytes`, a byte a tile
corner saying where snow may lie). They ship under `public/art/snowfall/`
(mip 0 of each texture written losslessly), under Port-Doctrine's SECOND
EXCEPTION, written and checked by `tools/environmentModsExtract.mjs`. The
records are a SHIPPED MOD in the texture door, registered beside Vanilla
Enhanced's by `systems/vanillaEnhancedPack.js` (`ENVIRONMENT_PACK_MODS`), ON BY
DEFAULT and a switch of its own on the Replacement packs card. They carry each
archive's record 0, so they decide the winter archives' ground as a whole -
and the index names Vanilla Enhanced's Base as an optional dependency, so the
load order puts them after the Base and their winter ground stands over the
Base's (Ledger A: the mod's manifest names no dependency).

## The snow that lies (the mod's assembly)

The bundle's `DynamicSnow.dll` is the mod: in winter, outside the desert, real
snow lies on the ground, deepens while it snows and melts in clear weather,
takes the player's, the foes' and the townsfolk's tracks and a body's hollow,
keeps them in the save and fills them back over the hours. Read off the
assembly (ilspycmd's C# and `vendor/snowfall/il/DynamicSnow.il.txt`) and its
one shader's DXBC (`vendor/snowfall/shaders/DynamicSnow.glsl`):

| type | what it does |
|---|---|
| `DynamicSnowMod` | the mod: its settings (eleven sections, ReadSettings' clamps), the session (BeginSession / CompleteSession round a load), the save record (`DynamicSnowSaveData`), the console's `snow_status` |
| `DynamicSnowController` | the frame: the environment's eligibility (winter, not the desert, or the override), the snowpack's clock, the refill, the LOCAL WINDOW round the player (a 161 x 161 grid over 88 m - the snow radius and a 12 m guard band - with its 256 x 256 track mask and 161 x 161 static and context masks, recentred every 6 m by progressive budgets), the player's and the NPCs' stamps, the corpses' projection, and the handoff to the ring and the blanket |
| `SnowpackState`, `SnowDepthRules` | the two depths (Daggerfall's locations', the wild's) and the phase in double; a context's depth (its settlement weight between the two, a road's berm, the authored cap, a path's) |
| `SnowCoverageData`, `SnowContactRamp` | the three winter archives' surface masks (56 records of 64 x 64 bytes; the road records' distance fields); the static mask's soft contact edge |
| `PersistentTrackField` | the world's tracks: 0.5 m cells in global metres, 65,536 at most (the oldest written go first), 64 x 64 buckets, the refill; saved as 9 bytes a cell, deflated and base64 (2,097,152 characters at most) |
| `CorpseImpressions` | a body's hollow, kept at its global place until its loot is gone and it has filled back |
| `MidDetailSnowRing` | the MIDDLE RING: 257 x 257 over 320 m snapped to 10 m, rebuilt at 20 m, a 641 x 641 track history at 0.5 m; it stands for the window within 32 m of its centre and morphs onto the blanket over its outer band (104-128 m) |
| `StreamedSnowBlanketPrototype`, `BlanketSurfaceSamples` | the BLANKET: a 65 x 65 mesh and a 128 x 128 static mask a loaded terrain tile, its hole round the nearer tier |
| `FarTrackMask` | the tracks out to 320 m at 1 m (641 x 641, recentred at 48 m), shading the ring and the blanket |
| `BasicRoadsBridge`, `BasicRoadsClassifier`, `BasicRoadsTerrain`, `BasicRoadsContextCache` | Basic Roads' network read for a pixel; each painted road tile classified as the network's road or track (not the location's own paving); a track's soft edge, a road's berm |
| `LocationLoaderBridge` | Location Loader's authored footprints (its cap) |

## The port

| module | what it is |
|---|---|
| `systems/snowfall.js` | the model whole: the settings, SnowpackState, SnowDepthRules, SnowCoverageData, SnowContactRamp, PersistentTrackField and its save, the rasterizers, CorpseImpressions, the statics' encodings, the location rectangle and Basic Roads' classifier - single (and, where the mod keeps it, double) precision as the C# runs it; C#'s Dictionary order kept by a slot map, so the save's cells and the evictions fall as the mod's do |
| `formats/rawDeflate.js` | DeflateStream's raw stream both ways, in step (a save is written in step) |
| `systems/snowfallRuntime.js` | DynamicSnowController's frame over the port's world: the window, the ring, the blanket, the far mask, the stamps, the refill, the snowpack's clock, the floating origin, the session, the save |
| `render/snowfallGlsl.js` | the shader: the vertex law, and the fragment's snow spliced into the ground's own fragment program |
| `render/snowfallSurface.js` | the tiers on the GPU, uploaded as they change, drawn through the renderer's `drawSnow` |
| `scenes/snowfallHost.js` | the runtime both exterior hosts build over the ground they draw: its tiles, a rebuilt tile replacing the old, the bodies, the save record, `snow_status` |
| `world/terrainSurface.js` `surfaceNormalFromSamples`, `gridValueAt` | the drawn ground's normal off a pixel's samples at its stride; a grid's value (WATER-NEXT's bed) on the drawn triangle |

PINNED AGAINST THE ASSEMBLY ITSELF: the session's C# reference compiles the
mod's own sources (SnowpackState, SnowDepthRules, SnowCoverageData,
SnowContactRamp, PersistentTrackField, the rasterizers, CorpseImpressions'
rasterizer, the statics, BasicRoadsClassifier and BasicRoadsTerrain) under
.NET 8 and runs nine scenarios off one LCG; `test/snowfall1_model.test.js`
runs the same through the port, and every section's trace - float and double
bits, mask hashes, the save's cells in the dictionary's order - hashes to the
reference's (`5ce5e363...` the snowpack, `e1e83e50...` Resolve, `b4789563...`
the coverage, `2d1e2404...` the ramp, `5c9a238d...` the field, `f14bfe09...`
the rasterizers, `fa48dcc6...` the statics, `e4c9678b...` Basic Roads,
`65e9db6d...` the ceiling).

## Enhanced environments, seamlessly

- **THE ENHANCED OUTDOORS'.** The hosts build the runtime under the enhanced
  sky only (`sky.enhanced`); the mod's own switch (`Enabled` - the Features
  row, on by default) and `?snowfall=off` stand beside it, read every frame.
  Off, the surfaces are hidden and the snowpack keeps its clock.
- **LIT AS THE GROUND IS.** The mod's surface shader takes Unity's forward
  light and the terrain's ambient (ApplyTerrainAmbientLighting) and receives
  shadows; here the snow is the GROUND'S OWN fragment program with its tile
  decode swapped for the mod's snow (`snowTerrainFs`), on whichever lane is
  installed - so it takes the sun and its shadow map, the moon, the clouds'
  shadow, the lanterns, the indirect light and the fog exactly as the ground
  under it does, and casts nothing (the mod's ShadowCastingMode.Off).
- **ON THE GROUND AS IT IS DRAWN.** Every height and normal the tiers read is
  the drawn surface's: a pixel's samples on surfaceHeightAt's triangles at the
  stride it is drawn at (the far rings' coarser grid too), the grass's own
  normals where it keeps them, the bed WATER-NEXT carves under a shore, the
  floor Iliac Puddle No More carves (its sea BARE - no snow on the seabed);
  the TileMap is the cap's where Deep Waters patched one. A pixel published or
  built again is DaggerfallTerrain.OnPromoteTerrainData's: its blanket is made
  again and the nearer tiers over it rebuild.
- **BASIC ROADS' OWN ROADS.** BasicRoadsBridge reads the Basic Roads MOD, so
  the classification reads Hazelnut's network or none (the rule World of
  Daggerfall's loader keeps): the port's generated fallback is not his mod. A
  tier's context reads the roads of the map pixels its own box touches
  (SnowContextData.Prepare's scan; AUDIT ENVIRONS S1 - not the player's).
  The authored ground is the location's blocks' (BlocksFile.CheckName's
  names, as the ground stamped under it).
- **WHO WALKS IT.** The player (the fly camera stands the tiers round the eye
  and stamps nothing), the street's foes and its watch (an EnemyMotor's
  CharacterController - `BODY_CAPSULE_RADIUS` its radius) and the town's
  people (MobilePersonNPC: citizens); a body is its corpse marker's ground.
- **THE CLOCKS.** The snowpack and the refill are a meter of the world's time:
  the EVENT clock's game seconds (`worldMinutes()`, TIME1's census); winter is
  the sky's season (`season`, the ground's own); the tiers' budgets and
  retries are real seconds. A load restores the record at the clock's nought
  and completes its session on the next frame - the LOADED game's clock (AUDIT
  ENVIRONS S2: the hosts restore the mods' records before the save's clock).
  Online the mod is the player's own (`systems/onlineLane.js`).
- **A TELEPORT'S NEW FRAME.** `state.init`'s re-anchor (a load, a fast travel,
  a respawn) carries the tiers, their tracks and the last stamp by its move
  (`initOffset`) as a recentre does, so the old place's tracks stay on the old
  place and the arrival's first stamp is no trench (AUDIT ENVIRONS I2).
- **WHAT IT COSTS** (AUDIT ENVIRONS P1-P8, `01-Overview/Audit-Environs.md`).
  The ring's rebuild copies the last build's samples where its points fall on
  the same place of the same tile over the same roads and settlements, each
  copy spending the sample budget a sample does (P3); the window's uploads wait
  for a frame that draws it (P2); the tiers draw in one pass that sets the
  state they share once (P1); the samplers, the track field's walks, a blanket
  tile's context and the contact ramp make no garbage and read nothing twice
  (P4-P7). Every byte the GPU is handed and every draw's state is the one the
  plain way made - pinned against a twin that never copies, and measured over
  whole rides.

## THE FOUR HOSTS

`scenes/world.js` and `scenes/exterior.js` build the runtime
(`createSnowfallHost`) over the ground they draw, tick it on their indoor
branch (`inside: true` - the surfaces hidden, the snowpack and the refill
kept) and outdoors (the player, the walkers, the bodies - its uploads before
the world frame opens, behind the renderer's seam), and draw it with the
opaque world BEFORE the ground under it (AUDIT ENVIRONS G7: GROUND-LAST's own
law a layer up - a ground fragment under the snow fails the depth test before
it shades, the picture the same); the next host a boot builds lets the last
one's surfaces go (a claimed loop never draws again). The world host tells it
each pixel published, carries it across the floating origin and a teleport's
re-anchor, and culls its blanket's tiles to the frame's frustum by their
bounds (G6: each tile's renderer in the mod is culled by its own). The town host stands its one city in its map pixel's 128 x 128 where
the streamed world lays it (GetLocationTerrainTileOrigin), bare past the
town's tiles (it draws no ground there). `scenes/worldModes.js` (the
interiors) and `scenes/dungeonContext.js` (the dungeons) are FLAGGED, not
wired: their frames run inside the exterior hosts' indoor branch, which ticks
the mod indoors, and no snow lies there.

## Departures (Port-Ledger A, SNOWFALL1)

- **THE SAVE'S BYTES.** The port's deflate writes one fixed-Huffman block;
  .NET's writer picks its own, so a record packs to different bytes. Either
  reader reads either stream, and the cells are the mod's, in its order.
- **GLOBAL METRES ARE THE PORT'S OWN.** The mod reckons a global point off
  PlayerGPS's whole-unit WorldX/WorldZ and the transforms' difference; the
  port's are exact (the stream's own origin and compensation).
- **LOCATION LOADER IS NOT THE PORT'S.** No authored footprint stands, so the
  loader's cap never applies (World of Daggerfall's sites keep their own
  ground).
- **LIT BY THE GROUND'S PROGRAM** (above). It stands over the ground by the
  mod's own 8 mm surface offset and its pass's own `Offset -0.25, -0.25`
  (`SNOW_LAYER`, a layer of the sea's stack - over the ground, under the film;
  AUDIT ENVIRONS G2 withdrew SNOWFALL1's departure, which left the snow at the
  ground's own height fighting it), its back faces culled as the pass culls
  them (G5).
- **THE RIDE OF THE STRIDE.** The far pixels' tiers read the surface drawn at
  their stride (Unity's Terrain.SampleHeight reads its full heightmap).
- **THE TRAVEL VIEW** draws no snow - its eye is the traveller's, raised over
  the land, the tiers the walker's.
- **THE PORT'S PACE.** The progressive builds - the window's recentre, the
  ring's, a blanket tile's - stop for the frame once the frame's snow has
  spent `SNOW_FRAME_BUDGET_MS` (2), under the mod's own sample counts: those
  cost a C# frame a millisecond or two and a JavaScript one up to ten. A
  build a frame late is a frame the tier before it still stands. A whole
  window the player outran goes again at the mod's own pace, its sample
  counts alone (AUDIT ENVIRONS P8): a machine that makes fewer samples in the
  two milliseconds than a ride asks would otherwise never stand it, nor the
  ring and the blanket, which wait on it.
- **A BODY ON FIRST SIGHT.** HandleEnemyDeath and the scan are one law here:
  a body is registered the frame its marker first lies, whatever the player's
  side of a door.

## Pins

`test/environs_texturePacks.test.js` (4); `tools/mutants/alikr1.json` (7, all
dead); `test/doctrine.test.js` holds `public/art/snowfall/` to Port-Doctrine's
second exception. The dynamic snow: `test/snowfall1_model.test.js` (12) and
`test/snowfall1_runtime.test.js` (15); `tools/mutants/snowfall1.json` (42, all
dead). The shader's variants compile and draw in Chromium's WebGL2 on both
lanes (a synthetic hill through the real renderer, the mod's masks and
albedo: the snow on the ground, the track in it, no GL error). AUDIT ENVIRONS
(`01-Overview/Audit-Environs.md`): `test/audit_environs.test.js` (21),
`tools/mutants/audit_environs.json`.
