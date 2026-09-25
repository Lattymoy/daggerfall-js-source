# World-data patches (WD1, 2026-09-25)

Three of the sea mods Mac handed over on 2026-09-25 (Aquatic Sprites,
Detailed Ships, Warm Ashes - Ships) are pure Daggerfall Unity *world
data*: whole blocks and whole building records as DFU's World Data Editor
writes them - the classic block, read out of the player's `BLOCKS.BSA`,
with the author's edits in it. Most of every such file is the classic
block. The port never carries game data (Port-Doctrine; the
windmills-kamer README refused whole RMB blocks on exactly this ground),
so WD1 is how those mods ship: **the edit is vendored, the block is
rebuilt from the player's own data.**

## The pieces

| file | what it is |
|---|---|
| `src/formats/worldDataJson.js` | `blockToDfuJson` / `buildingToDfuJson` - a classic `DFBlock` in FullSerializer's shape, member for member (public fields only, enums by name, the RMB ground arrays flattened y-outer x-inner as `RmbGroundDataConverter` writes them, the RDB reference list cut at the first `"���"` as `RdbBlockDescProcessor` cuts it, an RDB object's resources pruned to its type as `RdbObjectProcessor` prunes them, zero model scales dropped as `RmbBlock3dObjectRecordProcessor` drops them). `diffJson` / `patchJson` - the edit as ops over the JSON tree. `canonicalJson` - sorted keys, what a patch's sha256 is taken over. |
| `src/formats/worldDataPatch.js` | `rebuildWorldDataPatch(patch, blocksFile)` - the mod's file again, from the player's block and the patch. `canonicalSha256`. |
| `tools/worldDataPatch.mjs` | makes a patch from a shipped file and `BLOCKS.BSA`, and refuses to write one that does not rebuild the author's file sha256 for sha256 (it checks through the runtime's own rebuild, not a copy of it). |
| `BlocksFile.readClassicBlock` | the block as the BSA holds it - past the world-data door (no building replacement laid on) and outside the block cache. |
| `scenes/modWorldData.js` | globs `vendor/*/WorldDataPatches/*.json` beside `vendor/*/WorldData/*.json`; each patch is rebuilt from the bound `BLOCKS.BSA` at load, its sha256 checked, and registered under the DFU file name it rebuilds - gated on the mod's Enabled like any world-data file. |

## The ops

Applied in order, each path read against the document the ops before it
left: `s` (set a key / replace an element / the root), `d` (delete a
key), `i` (insert into an array), `r` (remove an element), and two copy
ops, `ci` / `cs`, which insert or set a copy of a node of a CLASSIC
block's JSON (`{ block, path }`) - how a mod that duplicated a classic
record is carried without the record: Warm Ashes' raiders are the ship's
own subrecord, moved, and the patch says "the ship's subrecord 0 of
block 390, at 2527/2228 turned -1023" instead of repeating it. Arrays are
diffed by Myers' shortest edit script over canonical element identity,
with element-for-element ops preferred for equal lengths when smaller (an
automap with two bytes changed is two sets, not a shift).

## What the serialiser found the editor does

These are in the authors' files, so they are in what DFU loads and the
port serves them:

- **`GetBlockAutoMap(removeGroundFlats)` mutates the block it is handed**
  (`BlocksFile.cs`), so an editor round trip writes the automap with its
  `0xFB` ground-flat bytes zeroed. Both Warm Ashes `_base` variants are
  the classic ship block and those two bytes and nothing else.
- **The RDB root list is re-grouped** (Aquatic Sprites: sixteen roots
  written as ten; the six dropped were empty).
- **Rotations make a round trip through Unity's Euler angles**: 512
  comes back as -1536 (the same angle) and a handful of room models move
  by one to three units of 2048.
- **Record counts in the headers are not kept in step with the arrays**
  (Detailed Ships' building files say one exterior model and carry 92).
  DFU lays out by the arrays; so does the port.

## What WD1 also ported

- **RDB and RDI blocks out of JSON.** AUDIT-RR2 G14 had refused them
  ("the port's converter reads the RMB half only") - `rdbBlockFromJson`
  reads the half now, every resource a JSON object leaves out at DFU's
  default struct (all zero), and `getDFBlockReplacementData` serves the
  whole block, taking building replacements for RMB blocks only
  (`WorldDataReplacement.cs:382-384`).
- **`RmbBlock3dObjectRecord.XScale/YScale/ZScale`** (`DFBlock.cs:407-420`):
  carried by `modelFromJson` as float32 and applied at every RMB layout
  site through `modelScaleVector` (`RMBLayout.GetModelScaleVector`, a zero
  read as 1) - exterior subrecord models and misc models
  (`world/rmbLayout.js`) and interiors (`world/interiorLayout.js`,
  `DaggerfallInterior.cs:444`). A model scaled unevenly lights through its
  inverse transpose, as Unity lights it: `StaticBatchBuilder.add` computes
  one for any matrix whose columns are not one length
  (`unevenScaleNormalMatrix`), the World of Daggerfall rocks' own fix made
  general.
- **`RdbFlatResource.IsCustomData`** (`DFBlock.cs:1064`, read by
  `RDBLayout.AddFixedRDBEnemy`): a JSON marker that sets it takes all
  sixteen bits of `FactionOrMobileId` as its MobileType and skips the 99
  test. No classic block can set it; the rdbLayout marker carries it and
  `characters/dungeonEnemies.js` reads it.

## If the player's BLOCKS.BSA is not the one the mod was made against

The rebuild is then the author's edit on the player's own block - what
the mod does to any block it meets - and the loader says so (the sha256
differs) and serves it. A patch whose ops do not land (a block that is
not the named one at the named index) is said and not served.
