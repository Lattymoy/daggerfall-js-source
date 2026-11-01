# World data

World data is Daggerfall Unity's way for a mod to replace or add a region's locations, a block or a building record,
as JSON. The port serves it through one door that MapsFile and BlocksFile ask before they read MAPS.BSA or
BLOCKS.BSA. The player meets it as the mods' ships, the Master Armorer's keep and shop, and as the port's own blocks
(the arena, the capitals past the Bay, the curated dungeon blocks).

## How it works

**The door.** `src/formats/worldData/worldDataDoor.js` is a leaf the readers import.
`src/formats/worldData/worldDataReplacement.js` installs itself there (`installWorldDataReplacement`) and answers
DFU's `WorldDataReplacement` asks: a new location in a region, a location replaced, a block served from JSON (a new
block gets an index past the BSA's count) and a building record replaced inside a classic RMB block. A JSON block may
be RMB, RDB or RDI. `src/systems/worldDataVariants.js` says which variant is in force. The JSON is converted into the
readers' own shapes (`locationFromJson`, `blockFromJson`, `rdbBlockFromJson`).

**How a mod's files arrive** (`src/scenes/modWorldData.js` `loadModWorldData`, once, before the first region loads):

1. `vendor/*/WorldDataPatches/*.json` - a patch: the author's edit of one classic block or building record (Warm Ashes -
   Ships). It is rebuilt at load from the player's own BLOCKS.BSA.
2. Our own files, built in code from the player's blocks and registered under the DFU names a mod's logic reads: the
   Master Armorer's keep and shop (`src/systems/roleplayRealism/rrWorld.js`, `06-Systems/Roleplay-Realism.md`).
3. A pack: thousands of files as edits over the player's MAPS.BSA and BLOCKS.BSA. The format and its builder stay; no
   pack ships, since the town packs are retired (`03-World/Beautiful-Towns.md`).

**A patch** (`src/formats/worldData/worldDataPatch.js` `rebuildWorldDataPatch`) names its base block or building and
the sha256 of the author's file. `src/formats/worldData/worldDataJson.js` `blockToDfuJson` writes the classic block in
FullSerializer's shape, member for member, and `patchJson` lays the ops on it. The ops are `s` (set), `d` (delete a
key), `i` (insert), `r` (remove) and the copy ops `ci` and `cs`, which insert or set a copy of a node of a classic
block. `diffJson` makes the ops, with Myers' shortest edit script for arrays. `canonicalJson` (sorted keys) is what the
sha256 is taken over.

**A pack** (`src/formats/worldData/worldDataPack.js` `openWorldDataPack`) holds `files: { name: [sha256, base, ops] }`
and shared `nodes`. A base is a classic block (checked by name at its index), a classic location (checked by name) or
another file of the pack. Ops are the patch's plus `sr`, a run of elements set at once. A value may hold references:
`$n` a pack node, `$c` a node of a classic block, `$o` ops laid on a copy, `$r` a run-length number array, and
`$m $f $d $3 $b $t $g` records carried as rows of numbers. A pack keeps at most `DECODED_NODES_MAX` decoded nodes.

**Load order.** The door keeps every mod's entry of a file name, highest priority first, and the first live one
answers (`ModManager.TryGetAsset` walks enabled mods in reverse load order). The served blocks are kept up to
`BLOCK_CACHE_MAX`.

**Layout pins** (`src/systems/layoutPins.js`): a save's town records which layout it was made under. No layout mod is
loaded, so a record stamped with a pack's layout sleeps (`ensureWorldDataPack` answers false).

**The port's own blocks** (`registerPortBlock`, `registerPortBlockOf`, `registerPortBlockFamily`,
`registerPortBuilding`, `registerLocationEdit`) are served behind no switch: the arena, the capitals and the towns past
the Bay, the curated dungeon blocks, the ship refit. A layer (`registerWorldDataLayer`) is laid on a served file.

## Rules

- **The port never carries game data** (Port-Doctrine). A mod file that is mostly a classic block ships as its edit,
  rebuilt from the player's own BSA files.
- **A tool will not write a patch or pack that does not rebuild.** `tools/worldDataPatch.mjs` and
  `tools/worldDataPackBuild.mjs` rebuild every file through the runtime's own reader and refuse when one file's
  canonical sha256 differs from the author's. A pack build is decided by the bundle and ARENA2 alone.
- **A rebuild that differs is served and said.** If the player's BSA is not the one the mod was made against, the
  rebuild is the author's edit on the player's data, which is what the mod does to any block. A patch whose ops do not
  land is said and not served. A pack checks one block in 8 and one location in 64 in the background, the first time
  each is served, and says once how many differ.
- **The door's gate** (`latchWorldDataDoor`): offline it is the Replace Game Artwork setting (DFU's `AssetInjection`),
  read once for the game. Online it is open whatever the setting says, because the room's mods stand buildings every
  player walks (`ONLINE_ROOM_MOD_KEYS` in `src/systems/online/onlineLane.js`). Each mod's own switch still decides its
  files.
- **What DFU's editor writes is kept**, because DFU loads it: the automap with its ground-flat bytes (0xFB) zeroed
  (`GetBlockAutoMap` mutates its block), regrouped RDB root lists, rotations after a round trip through Euler angles,
  and header record counts that do not match the arrays. Layout reads the arrays, as DFU does.
- **TAMRIEL-WIDE:** a location file names a MAPS.BSA region and index, so it changes a Bay town only. A block file
  replaces that block wherever it is read, so it also reaches a town past the Bay that lays the block (those towns are
  laid from the game's own town templates, `src/world/townOutline.js`).

## Daggerfall Unity

`WorldDataReplacement.cs` reads loose files under StreamingAssets and mod assets through ModManager. The port has
the mod half only: a vendored mod registers its files by name. Building replacements apply to RMB blocks only, as in
DFU. Two `DFBlock` fields only world data sets are carried:

- `RmbBlock3dObjectRecord` X, Y and Z scales, read as float32 and applied at every RMB layout site through
  `src/world/rmbLayout.js` `modelScaleVector` (`RMBLayout.GetModelScaleVector`, a zero read as 1). An unevenly scaled
  model lights through its inverse transpose (`src/render/staticBatch.js` `unevenScaleNormalMatrix`), as Unity
  lights it.
- `RdbFlatResource.IsCustomData`: such a marker takes all 16 bits of `FactionOrMobileId` as its mobile type and skips
  the 99 test (`src/characters/dungeonEnemies.js`).

Departures:

- Packs and patches are the port's own: DFU's mods ship whole files. The port ships the edit and rebuilds the file.
- Online, the door is open whatever Replace Game Artwork says (above).
- DFU keeps every served block for the session. The port keeps the most recent `BLOCK_CACHE_MAX` and rebuilds the rest
  when asked.

## Code and tests

- `src/formats/worldData/worldDataDoor.js` - the readers' seam.
- `src/formats/worldData/worldDataReplacement.js` - the door: assets, load order, pins, port blocks, JSON converters.
- `src/formats/worldData/worldDataJson.js` - classic block and location to DFU JSON, diff, patch, canonical form.
- `src/formats/worldData/worldDataPatch.js` - a patch rebuilt.
- `src/formats/worldData/worldDataPack.js` - the pack format and reader.
- `src/scenes/modWorldData.js` - the loader and the background checks.
- `tools/worldDataPatch.mjs`, `tools/worldDataPackBuild.mjs` - the builders.
- `test/formats/worldData/wd1_worlddata.test.js` - patches and the serialiser.
- `test/formats/worldData/wd3_pack.test.js` - the pack format.
- `test/formats/worldData/it1_worlddata.test.js` - Immersive Travel's carriage stand at every gate.
- `test/formats/worldData/wdowned.test.js` - a location's base patched in place (`patchJson` `owned`).
- `test/formats/worldData/fb1005_hills.test.js`, `fb1005_sealedcellar.test.js` - the stand-in hills' shapes under a
  house, and a quest marker reached by its stair.
