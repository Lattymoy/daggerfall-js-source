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

## WD3 - a world-data pack (2026-10-01)

Beautiful Villages and Beautiful Cities (carademono; `03-World/Beautiful-Towns.md`)
ship 7,727 `location-<r>-<i>.json` files and 820 RMB blocks between them -
439 MB of DFU JSON, most of it the classic game, and the rest the same few
thousand redecorated buildings again and again. (The sum of the vendor
READMEs' 154 MB and 285 MB; this line said 339 until AUDIT PRE-MERGE 1003 D14
found it was not their sum. No tool in the tree prints the figures and none
was measured again here: the files are rebuilt only from the player's own
BSA files, and this tree has no ARENA2.) A WD1 patch a file would
have been 8,547 globbed files rebuilt at every boot. WD3 is WD1's law at
that scale: one PACK a mod, the edit of every file over the player's own
`MAPS.BSA` and `BLOCKS.BSA`, every piece the author repeats stored once,
each file rebuilt only when the door first asks for it.

| file | what it is |
|---|---|
| `src/formats/worldDataPack.js` | the format and the reader. `{ format: 'dfe-worlddata-pack/1', vendor, mod, bases, classicNames, files: { name: [sha256, base, ops] }, nodes }` (`classicNames`: the name of every classic block a `$c` reads, by index - checked as a `b` base's is, AUDIT WD3 P5; `tools/worldDataPackNames.mjs` laid them into packs built before). A base is a classic block (`['b', name, index]`, checked by name), a classic location (`['l', region, index, name]`, read through the asking MapsFile, checked by name) or another file of the pack (`['f', name]`, rebuilt first and kept - never more than two deep). Ops are WD1's, plus `sr` (a run of consecutive elements set at once - an automap's 1,400 cells one op). A value may hold `{ $n: k }` (the pack's node k), `{ $c: [index, path] }` (a node of a classic block - a whole building out of the player's own data), either with `$o` (WD1 ops laid on a copy), `{ $r: runs }` (a number array run-length) and `{ $m | $f | $d | $3 | $b | $t | $g: rows }` (models, flats and people, doors, section 3, building data, ground tiles, scenery - a record nine numbers, not nine keys, read back key for key in DFU's order; a record that does not fit is carried whole). `openWorldDataPack(pack, { blocks, onRebuilt })` answers `names`, `has`, `sha256Of`, `baseOf`, `rebuild(name, maps)` and `release`; every refusal names the file and what did not read. `readPackText` (the vendored gzip, or the bytes a server already inflated), `packFileSha256` (WD1's canonical hash). |
| `src/formats/worldDataJson.js` | `locationToDfuJson` - a classic DFLocation in the World Data Editor's shape, member for member (`DFLocation.cs`, `DFRegion.cs`; every `internal` left out, enums by name) - the base of every location file. |
| `src/formats/mapsFile.js` | `readClassicLocation(region, index)` - the location as MAPS.BSA holds it, past the door; `getRmbBlockName` notes the town whose blocks are read next (the layout pins' reading town). |
| `tools/worldDataPackBuild.mjs` | the builder: parses each world-data TextAsset of the bundle as FullSerializer does (`\0` and `\a` are its escapes), takes its base (its own classic location or block, or for a new block the classic block or pack file nearest it), writes the edit subtree by subtree as the smaller of an op script and a whole value, and REFUSES to write a pack in which one file - rebuilt through the runtime's own reader from the pack as shipped - is not the author's sha256. Deterministic: the bundle and the ARENA2 alone decide the bytes. |
| `scenes/modWorldData.js` | globs `vendor/*/WorldDataPack/*.pack.json.gz` as URLs (never a chunk); a pack is fetched only when its mod is loaded for the game (the switch read once and latched) or when a save's pins let it into a town; registered on the door at its load priority (`WORLD_DATA_PRIORITY`); one block in 8 and one location in 64, each the first time it is served, checked against the author's sha256 in the background (AUDIT WD3 B4: every block was - each hash a hitch on a phone), one line said for the pack however many differ. |
| `formats/worldDataReplacement.js` | the door keeps every mod's entry of a name, highest load priority first (ModManager.TryGetAsset's reverse load order), and asks the layout pins which mods a town is served with; a pack file is rebuilt the first time it is asked for, and one that will not rebuild on the player's data is said once and not served. |

The two packs: Beautiful Villages 7,526 files in 2,712 nodes, 2.58 MB
gzipped; Beautiful Cities 1,021 files in 4,339 nodes, 2.17 MB. With
`ARENA2_PATH` set, `test/wd3_pack.test.js` rebuilds all 8,547 of them
from the player's own BSA files, sha256 for sha256 (about eight seconds).
