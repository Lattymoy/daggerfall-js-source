# Low Poly Trees

Low Poly Trees (SquidKamer's LowpolyTrees 5 for Daggerfall Unity) replaces the wilderness's flat tree sprites with
low-poly 3D trees. We ship it on by default. Near the player each nature flat stands as the mod's 3D tree; farther out
it stands as a picture of the same tree, so the woods look the same to the horizon and the draw distance is unchanged.

## How it works

- **The mod.** 253 prefabs named `ARCHIVE_RECORD`, one for each nature record of archives 500 to 511 (winter sets
  included), with 116 meshes, 32 materials (leaf cards cut at their alpha and drawn two-sided, trunks opaque) and 30
  point-filtered textures. No script, no settings.
- **Textures are painted, never carried.** The mod's textures are mostly Daggerfall's own sprites copied texel for
  texel, so they are game data. `vendor/low-poly-trees/` carries the geometry and a spec of each texture: blits (a
  record, an orientation, where it lands) and fills (regions no record covers, painted from a record by `synthTop`,
  a mirrored crop, or `fitRecord`). The game paints each atlas from the player's own TEXTURE files the first time a tree
  needs it (`src/world/lowPolyTrees.js` `paintAtlas`), between stream breaths, with an alpha-weighted mip chain. A record
  the player's data lacks leaves the classic flat.
- **Near.** A pixel's tree set is built when it enters the eye's 3x3 (`buildTreeSet`) and dropped past the 5x5. Trees
  within `LPT_NEAR_M` (140 m) plus the band `LPT_BAND_M` (20 m) are gathered again when the eye moves
  `LPT_REGATHER_M` (3 m), culled to the view (`cullNear`) and drawn as one instanced draw per submesh
  (`src/render/lowPolyTreesRender.js`) by the billboard program's mesh mode: lit, fogged, cloud-shadowed and swayed as
  the flats are.
- **Far.** Each prototype is drawn once from the side into its own picture (`impostorSteps`), trimmed and uploaded as a
  flat of its archive. It stands where the classic flat stood, in the pixel's billboard batch, out to the land view's
  reach. The far rings read the flat's own height, so they stand the same trees as before.
- **Handover.** Across the band the picture and the tree are complementary screen-door shares over one `bayer4`
  (`src/render/lowPolyTreesGlsl.js`): every pixel shows one of the two.
- **Seen through from the travel view** (`src/render/lowPolyTreesGlsl.js` `TREE_SEE`). Under the travel view a 3D tree
  between the eye and the traveller keeps a quarter of its fragments by the same screen-door, so the traveller is seen
  under the canopy. The cut is a narrow cone about the sight line, whole again 2 m short of the traveller and below
  its head, and opens as the eye climbs from 12 to 30 m off. It holds for every 3D tree the mesh mode draws: the mod's,
  the jungle's and the graht-oaks'.
- **Light.** A face is lit by the sky's light from straight above (`LPT_IMPOSTOR_LIGHT` `[0, 1, 0]`), crossfaded to the
  sun's by its share of the day. The far picture is drawn under the same light, so at night the tree and its picture
  match from every side, and the eye's position never enters a face's light. Faces are matte, as DFU's nature batch is.
- **Ownership.** `src/systems/lowPolyTreesAssets.js` `createLowPolyTrees` is the door. A pixel holds the handles its far
  pictures stand on and releases them when it goes. A handle unheld for `LPT_IDLE_S` (30 s) frees its far picture; an
  atlas's CPU picture is dropped `LPT_PIC_IDLE_S` (10 s) after its last draw and repainted on demand.
- **Seasons of the Iliac Bay.** While SIB re-skins a tree's own archive, that tree's atlases are painted from the
  seasonal records, so the 3D tree and its far picture turn when its flat does. Without SIB, the climate's winter swap
  brings the mod's own snow-capped winter prototypes.
- **Yards.** An online home's placed trees stand as the world's do, held by the yard while the piece stands
  (`src/scenes/yardNature.js`, `src/scenes/homeYards.js`). Yards stand in `src/scenes/world.js` only.

## Rules

- A true visual overhaul with no performance loss, compatible with seasons, with the draw distance unchanged (the
  owner).
- Seasonal 3D trees follow the flats they stand for (the owner); in DFU the mod's materials never take a season.
- What the flat is for gameplay stays the flat's: its cover, its sway share, its Logging node, its forest and the far
  rings' rule read the classic or seasonal size, never the tree's. Gameplay is the same with the mod off. A felled tree's
  3D tree goes with its batch.
- The far pictures cast the shadows at every distance; the 3D trees cast none of their own.
- Every allocation has an owner: handles, atlases and pictures are released by the sweep above.
- Which picture a nature flat stands as (the mod's far picture, the season's, the record) is one choice every host asks:
  `src/world/naturePicture.js`.
- Where a tree stands never depends on the switch: `src/world/lptCrowns.js` (baked by `tools/bakeLptCrowns.mjs`) reads
  the crowns and trunks on every client to keep trees off roads and out of a town's solid things, by scaling a tree
  down, never moving it.
- The switch: mod `low-poly-trees` `Enabled`, on by default, read once when the world loads; `?trees=off` is the kill
  door. Online it is the player's own (`src/systems/online/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`).
- Cost by construction: one instanced draw per submesh near; one quad a tree far, in batches that already existed;
  painting in steps of about a millisecond (`LPT_MIP_TEXELS`, `LPT_IMPOSTOR_TEXELS`, `LPT_IMPOSTOR_TRIS`). A 1024
  atlas is about 5.6 MB of GPU memory with its chain; a climate reads 2 to 12.

## Daggerfall Unity

DFU's `TerrainNature.LayoutNature` calls `MeshReplacement.ImportNatureGameObject` on terrains within one map pixel of
the player, turning each prefab at random and scaling it 0.6 to 1.4; past that it draws the classic flat. A location's
nature flat goes through `ImportCustomFlatGameobject`, turned by `Random.InitState((int)position.x)` and never scaled.
Departures:

- We stand the mod's own far picture past the near radius instead of the classic flat, so the wood is one look to the
  horizon. The picture faces the eye as a flat does.
- The crossfade band is ours; DFU's models simply appear at the terrain's edge.
- The see-through under the travel view is ours: DFU has no travel view.
- The atlases keep a mip chain where 23 of the mod's 30 textures have none, so a distant Point texture does not shimmer.
- A town tree is turned by where it stands; DFU seeds every tree in a block's column alike.
- Fills are near the author's texels, not his: the one place our tree is not the author's to the texel.

## Code and tests

- `src/world/lowPolyTrees.js` - painting, far pictures, variety (`lptVariety`), near gather and cull
- `src/systems/lowPolyTreesAssets.js` - the door, handles and the sweep
- `src/render/lowPolyTreesRender.js`, `src/render/lowPolyTreesGlsl.js` - the instanced draw and the handover
- `src/scenes/treesHost.js` - `createTreesHost`, the near sets and handle owners, wired by `src/scenes/world.js`;
  `src/scenes/exterior.js` builds the door directly for the fixed city
- `tools/lowPolyTreesExtract.mjs` - writes the spec from the `.dfmod` and an ARENA2, checking every copied texel
- `test/systems/lpt1_lowpolytrees.test.js` - the module, the vendored data, the far picture, the shader's mesh mode,
  light, sway and handover, the door's ownership and seasons, the hosts' wiring
- `test/render/canopysee.test.js` - the travel view's see-through

## Open

- `vendor/low-poly-trees/README.md` waits for Mac to record SquidKamer's permission.
- `src/scenes/worldModes.js` and `src/scenes/dungeonContext.js` stand no terrain nature; a dungeon block's rare nature
  flat stays a flat (DFU stands the mod there too).
