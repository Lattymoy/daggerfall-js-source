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
| 8 | SND | DAGGER.SND, the sound effect container | **complete** (`src/formats/sndFile.js`); music left this row for the Audio arc and landed there at A5 - see #25 below |

Post-close additions, each with a gate of its own (the arc is COMPLETE for
the eight it was scoped to; a slice that needs a new format adds it here).

**THE # IS THIS TABLE'S REGISTRATION ORDER, AND IT IS THE ONLY READER
NUMBERING THE BIBLE HAS.** Rows 1-12 are cited by number elsewhere and do
not move. Rows 13 on are the readers that shipped inside OTHER arcs and
were never registered here at all - this table stopped being the registry
it claims to be, which is how the bible came to carry three numberings at
once: Home.md calls VID "the tenth format reader" while #10 here is GFX,
Testing.md calls FLIC the eleventh (which #11 agrees with), and the Ledger
and Testing.md both call BSS "the twelfth image reader", counting image
formats only. Their # is the order this table took them
(2026-08-26) and NOT ship order; the arc or slice that landed each is in
its Status cell, and that slice's own record is where its story lives.
Anything anywhere in the bible calling a reader "the Nth" means this
column.

| # | Reader | Source files | Status |
|---|---|---|---|
| 9 | SKY | painted skies | **complete** (`src/formats/skyFile.js`, R4) |
| 10 | GFX | the chargen scroll frames | **complete** (`src/formats/gfxFile.js`, U18) |
| 11 | FLIC | .CEL/.FLC animations - Daggerfall's flats are Autodesk FLICs, a different format from the .VID movies | **complete** (`src/formats/flcFile.js`, F1) |
| 12 | FLATS.CFG | per-billboard caption + TFAC00I0.RCI face index | **complete** (`src/formats/flatsFile.js`, NPC1) |
| 13 | WOODS.WLD | the 1000x500 world heightmap + the 5x5 per-pixel large map | **complete** (`src/formats/woodsFile.js`, World-Arc Milestone 6) |
| 14 | FACTION.TXT | the faction tree under talk, guilds, temples, courts and quests | **complete** (`src/formats/factionFile.js`, T3a) |
| 15 | SPELLS.STD | the 89-byte classic spell records | **complete** (`src/formats/spellsStd.js`, S4a) |
| 16 | MAGIC.DEF | magic item + artifact records (62 bytes each) | **complete** (`src/formats/magicDef.js`, S4c) |
| 17 | CLASS*.CFG | the 74-byte career record | **complete** (`src/formats/classFile.js`, E3a) |
| 18 | FNT | the classic bitmap fonts | **complete** (`src/formats/fntFile.js`, U2a) |
| 19 | TEXT.RSC | the game's text records + the byte-token stream every window reads | **complete** (`src/formats/textRsc.js`, the TEXT.RSC slice; live from U6) |
| 20 | BIOG*.TXT | the chargen biography questions and their effects | **complete** (`src/formats/biogFile.js`, S3e/U12) |
| 21 | BOK*.TXT | books (BOOKS/BOK%05d.TXT), pages through the TEXT.RSC token reader | **complete** (`src/formats/bookFile.js`, B1) |
| 22 | VID | ANIM*.VID, the interleaved audio+video stream | **complete** (`src/formats/vidFile.js`, U22) |
| 23 | RUMOR.DAT | the classic save's rumor records, which seed the mill on a new game | **complete** (`src/formats/rumorFile.js`, TK-i) - GAME DATA, so the reader is fixture-pinned and the mill idles headless without it |
| 24 | BSS | CMPA0*I0.BSS, the compass needle strips | **complete** (`src/formats/bssFile.js`, U45) |
| 25 | MIDI.BSA (HMI) | the song archive, 131 HMI Sound Operating System songs | **complete** (`src/formats/hmiFile.js`, A5) - NO DFU SOURCE EXISTS: DFU never reads this archive, so the reader was written against the shipped bytes and is a Port-Ledger A departure, not a translation |
| 26 | PAINT.DAT | the four 10-byte TEXT.RSC offset slots behind a painting's name | **complete** (`src/formats/paintFile.js`, AUDIT 26 F208) |

`src/formats/` is 33 files: these 26 rows over 31 of them (a row can own
more than one file - #3 carries `baseImageFile.js`, #5 `faceUVTool.js` and
`arch3dPatch.js`, #7 `pakFile.js`), plus `dfRandom.js` and `umRandom.js`,
which are RNG ports rather than format readers.

NOT BUILT: `CfaFile` (the horse/cart first-person sprites) is the one
DaggerfallConnect reader with no port at all - there is no `cfaFile.js` -
and it carries an ingest-diet arm in `src/scenes/dataSource.js` with it
when it lands. See 01-Overview/Port-Completion-Analysis.md.

## Validation gate (every reader)

- A node pin per reader, run against real ARENA2 data via a local uncommitted `data/` path (env var `ARENA2_PATH`). Most rows own a test file named for the reader (bsa, palette, texture, imgcif, arch3d, blocks, maps, snd, sky, flc, flats, fnt, textrsc, books, vid, bss, hmi, faction); the rest are pinned inside the slice that needed them, which is where their laws are exercised - GFX in classquestions.test.js, `woodsFile` in terrain.test.js, `spellsStd` in magicka.test.js, `magicDef` in magicitems.test.js, `classFile` in enemyentity.test.js, `biogFile` in biography.test.js, `rumorFile` in rumormill.test.js, `paintFile` in audit26_systems.test.js.
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
- TEXTURE: 1:1 TextureFile.cs + BaseImageFile.cs. Full-corpus gate: all 472 archives, 469 load (215/217/436 correctly rejected as DFU documents), 6713 records, 11211 frames, every frame decodes to width*height. Byte-sum checksums pinned per decode path (uncompressed stride-256, multi-frame transparent-run, RecordRle 0x1108, ImageRle 0x0108). Wild compression values 0x900/0x101/0x100 exist in real data and fall through to the uncompressed path exactly as DFU's switch default does. getColor32 keeps DFU's vertical flip; spectral/firewall emission helpers routed to the Rendering arc (Unity material code; approved, see Port-Ledger A).
- IMG/CIF/RCI: 1:1 ImgFile.cs + CifRciFile.cs. IMG corpus 263 files, 260 load (FMAP0I00/01/16 correctly rejected), 72 headerless via exact-length table, all 6 palettized files detected with embedded x4 palette (TITL00I0 pinned). CIF/RCI corpus 76 files, 1172 records, 1610 frames, zero failures. FACES.CIF routes through the RCI path; WEAPON09.CIF (bow) has no wield record; TFAC00I0.RCI reads exactly 503 records, the count DFU hardcodes its array for. ImgFile reads raw bytes regardless of header compression field, verbatim DFU. Structural-only simplification: dynamic record arrays instead of DFU's fixed 64/503 pre-sizing.
- ARCH3D: 1:1 Arch3dFile.cs + FaceUVTool.cs + mechanically-extracted Arch3dPatch table (905 byte fixes, model comments preserved). Full corpus: all 10251 records decompose, zero failures, ~0.9s. Pinned totals: 797433 verts, 388475 tris, 31922 submeshes. Model 456 pinned to the point level. Quirks kept: bounding min/max seeded at 0 so Size spans origin, UVunpack only for first 3 points of records with id < 905, v2.5 offset x3, fixed decomposition buffer sizes throw-on-overflow exactly where C# would. Patch applies to a working copy, never the caller's buffer. Numeric departure documented in faceUVTool.js: JS doubles replace the C# float/double mix, (Int32) casts preserved as Math.trunc; corpus pins guard the output.
- BLOCKS: 1:1 BlocksFile.cs + DFBlock structures. Full corpus: 920 RMB + 187 RDB + 187 RDI decompose, junk FOO record rejected as unknown type, zero failures, ~0.3s. Resource closure: 39468 RDB objects = 22962 models + 12238 flats + 4268 lights exactly; 423 linked action chains. All 8 FixRdbData dungeon repairs (994, 945/946, 958, 975, 1025, 1034, 1036) ported verbatim and pinned - W0000009's wall lands at model slot 0 because the raw file holds non-numeric "REF_CUBE" there, and `UInt32.TryParse` yields 0. (Exactness note: C#'s no-style overload is NumberStyles.Integer, so it would also accept surrounding whitespace and a leading sign; no classic record exercises that, measured over all 140,250 modelId fields, so the port's /^\d+$/ is corpus-equivalent rather than semantics-equivalent.). 179 RDBs carry the DAGR signature, 8 carry 0xff padding (which the fixed-length `FileProxy.ReadCString` UTF-8-decodes to four U+FFFD - that variant skips the terminator scan and only TrimEnd('\0')s, so embedded NULs survive in `fldHeader.name`/`otherNames`). DFU's WorldDataReplacement mod-injection hooks not ported (Unity AssetInjection, no equivalent runtime).
- MAPS: 1:1 MapsFile.cs + PakFile.cs (CLIMATE.PAK/POLITIC.PAK RLE expansion) + FALL.EXE tables (62 region names/races/temples, 45 block prefixes). Full corpus: 62 regions, exactly the 17 empty regions rejected (45 populated, matching classic), 15251 locations all decode, 4232 dungeons. Quirks verified live: both 32-byte-no-terminator names truncate where DFU documents them (Porcupine Hostel/Bhoriane, Feather and Barbarian/Kambria); letter2 (byte)(2*char)>>6 truncation pinned; map-table uint wraparound decode; Orsinium 50015 Z=-2 hack. Daggerfall city pinned (8x8, 316 buildings, politic 145, WALLAA02.RMB) and Privateer's Hold (5 blocks, S0000999.RDB start). Not ported: WorldDataReplacement hooks, smaller-dungeon generation and PatchRegionIndex (quest/save systems - Systems arcs). GetNameBankOfRegion SHIPPED with the Characters arc (C2) as `characters/nameHelper.js` getNameBankOfRegion over the REGION_RACES table exported here, and is live in `scenes/townTalk.js`.
- SND: 1:1 SndFile.cs. DAGGER.SND is a number-record BSA of raw unsigned 8-bit mono PCM at 11025 Hz with a synthesized 44-byte RIFF header, byte-exact against the reference. Corpus: 459 sounds, 7658090 PCM bytes, header consistency everywhere, record index 5 ships zero-length (real quirk, pinned). Music (MIDI.BSA) is NOT part of DFU's DaggerfallConnect readers - DFU plays music through Unity-side synthesis. It was routed to the Audio arc (approved, see Port-Ledger A) and shipped there at A5 as row #25 above; the bytes turned out to be HMI, not XMI.

## Arc close-out

All 8 readers complete, translated 1:1 from DaggerfallConnect with real-data corpus gates:
BSA containers, 8 palettes, 472 texture archives / 11211 frames, 260 IMG + 76 CIF/RCI files,
10251 meshes, 1295 blocks, 15251 locations across 45 regions, 459 sounds.
Suite: 52 tests, all green with and without ARENA2_PATH. Next per Port-Doctrine phase plan: World-Arc.

Post-close addition: SKY??.DAT reader (`src/formats/skyFile.js`) shipped
under Rendering-Arc R4 with its own corpus gate - see
07-Rendering/Rendering-Arc.md.

Post-close addition: GFX reader (`src/formats/gfxFile.js`, GfxFile.cs
verbatim) shipped under UI-Arc U18 with its own corpus gate. The only
GFX files in the game are SCRL00I0/SCRL01I0 - 8 parchment frames each,
320x80, TEXTURE-style RLE rows behind a per-row offset table - used
exclusively by the class-questions screen. See 10-UI/UI-Arc.md.
