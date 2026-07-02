# Readers-Arc (COMPLETE)

Goal: JS readers for every Daggerfall binary format we need, each validated against real ARENA2 data before the next begins. Nothing else in the project starts until its formats read clean.

Reference source: Daggerfall Unity `DaggerfallConnect` namespace (C#), plus dfworkshop.net format docs. Translate, keep constants byte-exact.

## Order

| # | Reader | Source files | Status |
|---|--------|-------------|--------|
| 1 | BSA container | ARCH3D.BSA, BLOCKS.BSA, MAPS.BSA | **complete** (`src/formats/bsaFile.js`) |
| 2 | Palettes | PAL files, colormaps | **complete** (`src/formats/dfPalette.js`) |
| 3 | TEXTURE.??? | texture archives | **complete** (`src/formats/textureFile.js` + `baseImageFile.js`) |
| 4 | IMG / CIF | UI art, paperdoll art (reference for voxel outfits) | **complete** (`src/formats/imgFile.js`, `cifRciFile.js`) |
| 5 | ARCH3D | 3D model records | **complete** (`src/formats/arch3dFile.js`, `faceUVTool.js`, `arch3dPatch.js`) |
| 6 | BLOCKS | RMB (exterior) + RDB (dungeon) blocks | **complete** (`src/formats/blocksFile.js`) |
| 7 | MAPS | regions, locations | **complete** (`src/formats/mapsFile.js`, `pakFile.js`) |
| 8 | SND / music | audio containers | **complete** for SFX (`src/formats/sndFile.js`); music (HMI/XMI) deferred to Audio arc, see decisions |

## Validation gate (every reader)

- Node test file per reader in `test/`, run against real ARENA2 data via a local uncommitted `data/` path (env var `ARENA2_PATH`).
- Assert record counts, known-record byte signatures, and round-trip of at least one full record against documented values.
- Tests skip cleanly (not fail) when `ARENA2_PATH` is absent, so CI stays green without game data.
- Synthetic in-memory fixtures exercise parsing logic even without game data.

## Blockers

- (none)

## Decisions log

- ARENA2 data sourced from the official DFU DaggerfallGameFiles.zip (Interkarma's Google Drive link from the DFU install wiki). `tools/fetch-data.sh` re-fetches per session to `/home/claude/dfdata/arena2`. Run real-data tests with `ARENA2_PATH=/home/claude/dfdata/arena2 npm test`.
- BSA structural closure invariant adopted as the core parser proof: records must fill `[4, directoryStart)` exactly and `directoryStart + entrySize * count == fileLength`. Holds on all three shipped BSAs.
- Observed + pinned: ARCH3D.BSA 10251 number records (first id 44005), BLOCKS.BSA 1295 name records, MAPS.BSA 248 name records (62 regions x 4 types).
- Original BLOCKS.BSA ships a junk record at index 669 literally named "FOO". Tests document it explicitly.
- DFU's `RewriteRecord` write-back and path-extension checks were not ported (read-only byte-buffer runtime). Noted in bsaFile.js header.
- Palettes: 1:1 DFPalette.cs translation. All 8 shipped palettes load (PAL.PAL + 3 raw .PALs + 4 .COLs). MAP.PAL x4 six-bit expansion verified cross-file: OLDMAP.PAL raw (63,0,63) lands as MAP.PAL (252,0,252). PAL.PAL index 1 is the magenta transparency sentinel. `readEmbedded` ported for TextureFile's in-stream palettes (next reader).
- TEXTURE: 1:1 TextureFile.cs + BaseImageFile.cs. Full-corpus gate: all 472 archives, 469 load (215/217/436 correctly rejected as DFU documents), 6713 records, 11211 frames, every frame decodes to width*height. Byte-sum checksums pinned per decode path (uncompressed stride-256, multi-frame transparent-run, RecordRle 0x1108, ImageRle 0x0108). Wild compression values 0x900/0x101/0x100 exist in real data and fall through to the uncompressed path exactly as DFU's switch default does. getColor32 keeps DFU's vertical flip; spectral/firewall emission helpers deferred to Rendering arc (Unity material code, approved as presentation).
- IMG/CIF/RCI: 1:1 ImgFile.cs + CifRciFile.cs. IMG corpus 263 files, 260 load (FMAP0I00/01/16 correctly rejected), 72 headerless via exact-length table, all 6 palettized files detected with embedded x4 palette (TITL00I0 pinned). CIF/RCI corpus 76 files, 1172 records, 1610 frames, zero failures. FACES.CIF routes through the RCI path; WEAPON09.CIF (bow) has no wield record; TFAC00I0.RCI reads exactly 503 records, the count DFU hardcodes its array for. ImgFile reads raw bytes regardless of header compression field, verbatim DFU. Structural-only simplification: dynamic record arrays instead of DFU's fixed 64/503 pre-sizing.
- ARCH3D: 1:1 Arch3dFile.cs + FaceUVTool.cs + mechanically-extracted Arch3dPatch table (905 byte fixes, model comments preserved). Full corpus: all 10251 records decompose, zero failures, ~0.9s. Pinned totals: 797433 verts, 388475 tris, 31922 submeshes. Model 456 pinned to the point level. Quirks kept: bounding min/max seeded at 0 so Size spans origin, UVunpack only for first 3 points of records with id < 905, v2.5 offset x3, fixed decomposition buffer sizes throw-on-overflow exactly where C# would. Patch applies to a working copy, never the caller's buffer. Numeric departure documented in faceUVTool.js: JS doubles replace the C# float/double mix, (Int32) casts preserved as Math.trunc; corpus pins guard the output.
- BLOCKS: 1:1 BlocksFile.cs + DFBlock structures. Full corpus: 920 RMB + 187 RDB + 187 RDI decompose, junk FOO record rejected as unknown type, zero failures, ~0.3s. Resource closure: 39468 RDB objects = 22962 models + 12238 flats + 4268 lights exactly; 423 linked action chains. All 8 FixRdbData dungeon repairs (994, 945/946, 958, 975, 1025, 1034, 1036) ported verbatim and pinned - W0000009's wall lands at model slot 0 because the raw file holds non-numeric "REF_CUBE" there, matching C# TryParse=0 semantics (modelIdNum hardened to /^\d+$/). 179 RDBs carry the DAGR signature, 8 carry 0xff padding. DFU's WorldDataReplacement mod-injection hooks not ported (Unity AssetInjection, no equivalent runtime).
- MAPS: 1:1 MapsFile.cs + PakFile.cs (CLIMATE.PAK/POLITIC.PAK RLE expansion) + FALL.EXE tables (62 region names/races/temples, 45 block prefixes). Full corpus: 62 regions, exactly the 17 empty regions rejected (45 populated, matching classic), 15251 locations all decode, 4232 dungeons. Quirks verified live: both 32-byte-no-terminator names truncate where DFU documents them (Porcupine Hostel/Bhoriane, Feather and Barbarian/Kambria); letter2 (byte)(2*char)>>6 truncation pinned; map-table uint wraparound decode; Orsinium 50015 Z=-2 hack. Daggerfall city pinned (8x8, 316 buildings, politic 145, WALLAA02.RMB) and Privateer's Hold (5 blocks, S0000999.RDB start). Not ported: WorldDataReplacement hooks, smaller-dungeon generation and PatchRegionIndex (quest/save systems - Systems arcs), GetNameBankOfRegion (townsfolk names arc; REGION_RACES table is here).
- SND: 1:1 SndFile.cs. DAGGER.SND is a number-record BSA of raw unsigned 8-bit mono PCM at 11025 Hz with a synthesized 44-byte RIFF header, byte-exact against the reference. Corpus: 459 sounds, 7658090 PCM bytes, header consistency everywhere, record index 5 ships zero-length (real quirk, pinned). Music (MIDI.BSA HMI/XMI) is NOT part of DFU's DaggerfallConnect readers - DFU plays music through Unity-side synthesis. It moves to the Audio arc (08-Audio) where the playback strategy gets decided, matching the arc-table note.

## Arc close-out

All 8 readers complete, translated 1:1 from DaggerfallConnect with real-data corpus gates:
BSA containers, 8 palettes, 472 texture archives / 11211 frames, 260 IMG + 76 CIF/RCI files,
10251 meshes, 1295 blocks, 15251 locations across 45 regions, 459 sounds.
Suite: 52 tests, all green with and without ARENA2_PATH. Next per Port-Doctrine phase plan: World-Arc.
