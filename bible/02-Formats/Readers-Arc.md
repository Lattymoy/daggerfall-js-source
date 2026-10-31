# Format readers

The readers turn the files in the player's own ARENA2 folder into JavaScript structures: archives, palettes, images,
meshes, blocks, maps, sounds, music, text and classic saves. Each one translates a Daggerfall Unity reader class. The
player never sees a reader. Every town, sprite, sound and imported save starts from one.

## How it works

A reader takes the file's bytes (a `Uint8Array`), never a path. The runtime reads immutable buffers, so DFU's disk
plumbing (`FileProxy` streams, `RewriteRecord` write-back, extension checks) is not ported. Each file's header comment
names its DFU source and lists every departure from it.

| Reader | Files | DFU source |
|---|---|---|
| `src/formats/bsaFile.js` `BsaFile` | ARCH3D.BSA, BLOCKS.BSA, MAPS.BSA, DAGGER.SND, MIDI.BSA | `BsaFile.cs` |
| `src/formats/dfPalette.js` `DFPalette` | .PAL and .COL palettes | `DFPalette.cs` |
| `src/formats/textureFile.js`, `src/formats/baseImageFile.js` | TEXTURE.??? | `TextureFile.cs`, `BaseImageFile.cs` |
| `src/formats/imgFile.js`, `src/formats/cifRciFile.js` | IMG, CIF, RCI | `ImgFile.cs`, `CifRciFile.cs` |
| `src/formats/cfaFile.js`, `src/formats/gfxFile.js`, `src/formats/bssFile.js` | CFA (mount sprites), GFX (chargen scrolls), BSS | `CfaFile.cs`, `GfxFile.cs`, `BssFile.cs` |
| `src/formats/flcFile.js`, `src/formats/vidFile.js` | FLIC (.CEL), VID movies | `FlcFile.cs`, `VidFile.cs` |
| `src/formats/skyFile.js` | SKY??.DAT | `SkyFile.cs` |
| `src/formats/arch3dFile.js`, `src/formats/faceUVTool.js`, `src/formats/arch3dPatch.js` | ARCH3D.BSA meshes | `Arch3dFile.cs`, `FaceUVTool.cs`, `Arch3dPatch.cs` |
| `src/formats/blocksFile.js` `BlocksFile` | RMB, RDB, RDI blocks | `BlocksFile.cs`, `DFBlock.cs` |
| `src/formats/mapsFile.js` `MapsFile`, `src/formats/pakFile.js`, `src/formats/mapsTables.js` | MAPS.BSA, CLIMATE.PAK, POLITIC.PAK, FALL.EXE tables | `MapsFile.cs`, `PakFile.cs` |
| `src/formats/woodsFile.js` | WOODS.WLD heightmap | `WoodsFile.cs` |
| `src/formats/sndFile.js` | DAGGER.SND | `SndFile.cs` |
| `src/formats/hmiFile.js` | MIDI.BSA songs | none (see below) |
| `src/formats/flatsFile.js` | FLATS.CFG | `FlatsFile.cs` |
| `src/formats/textRsc.js`, `src/formats/fntFile.js`, `src/formats/bookFile.js` | TEXT.RSC, FNT fonts, BOK books | `TextFile.cs`, `FntFile.cs`, `BookFile.cs` |
| `src/formats/factionFile.js`, `src/formats/classFile.js`, `src/formats/biogFile.js` | FACTION.TXT, CLASS*.CFG, BIOG*.TXT | `FactionFile.cs`, `ClassFile.cs`, `BiogFile.cs` |
| `src/formats/spellsStd.js`, `src/formats/magicDef.js`, `src/formats/paintFile.js` | SPELLS.STD, MAGIC.DEF, PAINT.DAT | `DaggerfallSpellReader.cs`, `MagicItemsFile.cs`, `PaintFile.cs` |
| `src/formats/save/saveTreeFile.js`, `src/formats/save/saveVarsFile.js`, `src/formats/save/saveImageFile.js`, `src/formats/save/saveGames.js`, `src/formats/characterRecord.js`, `src/formats/bioFile.js`, `src/formats/rumorFile.js` | a classic SAVE0-SAVE5 set | DFU `API/Save` |

`src/formats/fileProxy.js` holds the one `ReadCString` rule the classic records share. The spell record of a save
parses through `src/formats/spellsStd.js` `readSpellRecord`. The conversion of a classic save into a character is not
a reader: it is `src/systems/classicSave.js`.

MapsFile and BlocksFile ask the world-data door (`src/formats/worldData/worldDataDoor.js` `worldDataDoor`) before
they read a region, location or block, so a mod's world data can replace them (`02-Formats/World-Data-Patches.md`).
`BlocksFile.readClassicBlock` and `MapsFile.readClassicLocation` read past the door.

## Rules

- **Readers stay exact** (Port-Doctrine): logic and constants are DFU's. A departure is measured, kept small and
  written in the reader's header.
- **Game data never enters the repo.** `tools/fetch-data.sh` puts the freeware ARENA2 at `/home/claude/dfdata/arena2`
  (the owner). Set `ARENA2_PATH` to it before work that reads the game's files.
- **Every reader has a test.** Real-data tests run when `ARENA2_PATH` points at ARENA2 and skip, not fail, when it does
  not. Synthetic in-memory fixtures exercise the parse without game data.
- **Corpus pins** (held by the reader tests with ARENA2): ARCH3D.BSA 10251 records from id 44005, 797433 vertices,
  388475 triangles, 31922 submeshes. BLOCKS.BSA 1295 records: 920 RMB, 187 RDB, 187 RDI, and the junk record `FOO`
  rejected. RDB objects 39468 = 22962 models + 12238 flats + 4268 lights. MAPS.BSA 62 regions, 45 populated, 15251
  locations, 4232 dungeons. TEXTURE 472 archives, 469 load, 6713 records, 11211 frames. IMG 263 files, 260 load. CIF/RCI
  76 files, 1172 records, 1610 frames. DAGGER.SND 459 sounds.
- **BSA structural closure** is the parser's proof: records fill `[4, directoryStart)` exactly and `directoryStart +
  entrySize * count` is the file length.
- **The CIF weapon bound** (`src/formats/cifRciFile.js` `MAX_WEAPON_RECORDS` = 64): DFU's fixed 64-slot array is the
  weapon loop's only bound. A record with a total size of 0 never moves the read head, so without the bound the loop
  never ends. A 65th record fails the load, as it does in DFU.
- **ARCH3D patches** apply to each record's private copy, never to the caller's buffer.
- **TAMRIEL-WIDE:** MAPS.BSA, WOODS.WLD and the PAK files hold the Iliac Bay only. MapsFile's 1000 x 500 pixel grid and
  its regions 0..61 are the Bay's own data, marked `BAY-OWN:` in the code. Regions 62..70 are the provinces past the
  Bay (`src/formats/mapsTables.js` `PROVINCE_REGION_NAMES`): `getRegionName` and `getRegionIndex` answer them, and
  they hold no MAPS.BSA location. A place past the Bay is found through `src/world/worldWide/worldPlaces.js` and keyed
  by `src/world/worldWide/worldGrid.js` `worldPixelKey`.

## Daggerfall Unity

The departures, each recorded in its file:

- `BsaFile`: the directory name scan stops at the 14-byte name field, where DFU's is unbounded.
- `TextureFile`: DFU loads ART_PAL.COL from the same folder. The browser has no folder, so the caller gives the
  palette.
- `CifRciFile` and others grow plain arrays where DFU sizes fixed ones, except the weapon bound above.
- `FaceUVTool`: JavaScript doubles replace the C# float and double mix. `(Int32)` casts stay as `Math.trunc`, and the
  ARCH3D corpus pins guard the output.
- `MapsFile`: `getRegion`, `getLocation` and their by-name forms answer `null` where C# answers a default struct.
  `loadRegion` memoizes. The terminator scan of `_readCStringSkip` stops at the record end. `readLocationIdFast`
  drops an early return that cannot fire here. Members with no port consumer (`WorldCoordToLongitudeLatitude`, the PAK
  writes, `LoadRegion(string)` and others) are listed in the header and not ported.
- `hmiFile.js` has no DFU source: DFU never reads MIDI.BSA and plays pre-converted `.mid` files. The port reads the
  game's own songs.
- `CfaFile` keeps DFU's run length, measured in compressed widths while rows are read uncompressed-wide. Where the
  two widths differ, the tail of the image stays zero, as in DFU.

## Code and tests

- `src/formats/` - the readers in the table above.
- `test/formats/bsa.test.js`, `palette.test.js`, `texture.test.js`, `imgcif.test.js`, `arch3d.test.js`,
  `blocks.test.js`, `maps.test.js` - the core readers and their corpus pins.
- `test/ui/snd.test.js`, `test/ui/flc.test.js`, `test/ui/vid.test.js`, `test/ui/fnt.test.js`,
  `test/ui/classquestions.test.js`, `test/render/sky.test.js`, `test/formats/bss.test.js`,
  `test/formats/flats.test.js`, `test/systems/tr2_riding.test.js` - the other readers.
- `test/formats/morrowind/audit39_formats.test.js` - the CIF weapon bound.
- `test/ui/travel/road_maps_record.test.js` - MapsFile's departures and unported members.
- `test/systems/classicsave.test.js` - the classic save readers and the import conversion.

## Open

- The classic save readers are pinned on synthetic byte-exact fixtures only. No real SAVE0-SAVE5 set is at hand, so
  the corpus test in `test/systems/classicsave.test.js` skips until a machine with real saves runs it.
- CFA has no corpus test. Decode MRED00I0.CFA and MRED01I0.CFA on real data and confirm the two widths match.
