# Chests

Every chest in the game is one 3D model the owner supplied, dressed in Daggerfall's own textures. The player meets it
in a house, a ship's berth, a Delve, the Crown Hall and as the Aurum Coffer. The chest stands where ARCH3D's chest stood
and keeps its record and its press.

## How it works

- `tools/bakeChest.mjs` reads the owner's Blender export (a base, a lid, a hinge and a latch, each on a bone) and bakes
  each part's triangles twice into `src/assets/chest/chest.json`: shut (the rest pose) and open (the lid's widest key).
  The frame is the game's: +y up, the latch to +z (Daggerfall's furniture faces +z), the origin on the floor under the
  base's middle. The source sits beside it in `src/assets/chest/source/`. The mimic's hop animation is not used.
- `src/world/chestModel.js` `chestModel` lays each face on its texture where it stands (`chestUv`), at 40 texels a metre
  (`CHEST_TEXELS_M`), the grain along the chest. Wood is TEXTURE.067, the hinge iron and the latch brass from
  TEXTURE.000 (`CHEST_IRON`, `CHEST_BRASS`).
- `registerChestModels` puts the models on the custom-model door (`src/world/customModels.js` `registerCustomModel`),
  which `src/scenes/dataPipeline.js` asks before ARCH3D:
  - ARCH3D's three chests, 41811-41813 (`CHEST_MODELS`; the "Chest" of `src/systems/worldTooltips.js` `HOUSE_CONTAINER_NAMES`), each fitted inside the box its classic chest filled
    (`CHEST_BOXES`), with its own lid wood (`CHEST_LOOKS`).
  - The Aurum Coffer, models 864320 and 864321, shut and open (`AURUM_COFFER_MODELS`), stood by
    `src/scenes/aurumCacheHost.js`. An emptied coffer stands open. A host with no mesh door stands its picture instead.
    The coffer has no collision body.
- DET's sea chest stand-in (`src/world/detStandIns.js`) builds the same chest in a darker wood (`SEA_CHEST_BOX`,
  `SEA_CHEST_LOOK`).

## Rules

- Any chest uses this model, in Daggerfall's textures (the owner). The models are climate-free: the same chest in every
  province.
- A chest fits inside its classic model's box, on its floor and centred, so placement, the container record
  (`src/scenes/chestRecords.js`) and interaction stay unchanged.
- Not chests: TEXTURE.216 records 46 and 47 (gold heaped in a chest) stay flat pictures, because they are loot piles drawn
  by the dungeon, drop, PvP-spoils and corpse systems. The gate rite's casket and the shipyard's sea chest are part of
  larger scenery models.

## Daggerfall Unity

DFU draws ARCH3D's chest models as they are. This model is the port's own departure (CHEST3D).

## Code and tests

- `src/world/chestModel.js` - the model, its textures and its registration
- `tools/bakeChest.mjs` - the bake from the owner's source
- `test/world/chest3d.test.js` - the bake to the byte, frame and winding, the fit, the textures, the model door, and the
  classic boxes against ARCH3D when the game data is present
- `test/scenes/aurum_cache_world.test.js` - the coffer's model stood, facing, opened and torn down
- `tools/mutants/chest3d.json` - the mutants
