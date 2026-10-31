# The Chest (CHEST3D)

THE PORT'S OWN. Not a DFU member: Daggerfall Unity draws ARCH3D's chest models; the port draws the owner's chest in their
place, in Daggerfall's own pictures. Ledger A (CHEST3D).

## 1. What was asked

The owner, 2026-10-31, sending `Low_Poly_Chest_Mimic.fbx`: *"I want to implement this and ensure any chests use this.
Texture it with daggerfall textures"*.

## 2. The model

A Blender export of four objects - a base, a lid, a hinge and a latch - each parented rigidly to a bone, with one
action: a mimic's hop, the lid 77 degrees open at its widest. No material and no picture. `tools/bakeChest.mjs` reads the
bone chain and bakes each part's triangles twice into `src/assets/chest/chest.json`: shut (the rest pose) and open (the
lid's widest key). Its frame is the game's: +y up, the latch to +z (Daggerfall's furniture faces +z: a dresser's drawers,
a cupboard's doors), the origin on the floor under the base's middle. The source is committed beside it
(`src/assets/chest/source/`); the hop itself is not used.

## 3. Daggerfall's pictures

`src/world/chestModel.js` lays each face on its picture from where it stands, at Daggerfall's own density (a texel a
classic unit, 40 a metre), the grain along the chest. Each classic chest's wood is its own (TEXTURE.067 - 41812's lid
its reddish record 1); the hinge is iron and the latch brass, TEXTURE.000's swatches, as the classic chests' trim is.

## 4. Where it stands

On the model door (`customModels.js` registerCustomModel, asked before ARCH3D), registered as the data pipeline is made:

- ARCH3D's three chests, 41811-41813 - every model the game calls a chest (`worldTooltips.js` HOUSE_CONTAINER_NAMES):
  a house's chests, the ships' berths, the Delve's chest, the Crown Hall's. Each fits inside the box its classic chest
  filled, on its floor and in its middle, so its placement, its record (`chestRecords.js`) and its press are unchanged.
- DET's sea chest (`detStandIns.js` 45190), in Daggerfall's darker wood.
- The Aurum Coffer (`scenes/aurumCacheHost.js`): models 864320 and 864321, shut and open, dark oak with a gold hinge
  and latch, in the box its picture stood in, its front away from the pile it stands beside. Emptied, the open one
  stands. Where a host hands no mesh door, its picture stands as before. Like its picture, it has no body to walk into.

## 5. Not done, and why

- Daggerfall's two treasure piles that picture a chest heaped with gold (TEXTURE.216 records 46 and 47) stay pictures:
  they are loot piles, drawn by four systems (a dungeon's piles, dropped loot, PvP spoils, corpses), not chests.
- The gate rite's casket and the shipyard's sea chest are boxes inside larger scenery of one archive.

## 6. Pins

`test/world/chest3d.test.js` (the bake to the byte, its frame and winding, the fit, the pictures, the model door; the
classic boxes against ARCH3D on the freeware) and `test/scenes/aurum_cache_world.test.js` (the coffer's model: stood,
facing, opened, torn down). The mutants are `tools/mutants/chest3d.json`.
