# Readers-Arc (ACTIVE)

Goal: JS readers for every Daggerfall binary format we need, each validated against real ARENA2 data before the next begins. Nothing else in the project starts until its formats read clean.

Reference source: Daggerfall Unity `DaggerfallConnect` namespace (C#), plus dfworkshop.net format docs. Translate, keep constants byte-exact.

## Order

| # | Reader | Source files | Status |
|---|--------|-------------|--------|
| 1 | BSA container | ARCH3D.BSA, BLOCKS.BSA, MAPS.BSA | **complete** (`src/formats/bsaFile.js`) |
| 2 | Palettes | PAL files, colormaps | not started |
| 3 | TEXTURE.??? | texture archives | not started |
| 4 | IMG / CIF | UI art, paperdoll art (reference for voxel outfits) | not started |
| 5 | ARCH3D | 3D model records | not started |
| 6 | BLOCKS | RMB (exterior) + RDB (dungeon) blocks | not started |
| 7 | MAPS | regions, locations | not started |
| 8 | SND / music | audio containers | not started |

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
