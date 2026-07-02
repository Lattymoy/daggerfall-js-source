# Readers-Arc (ACTIVE)

Goal: JS readers for every Daggerfall binary format we need, each validated against real ARENA2 data before the next begins. Nothing else in the project starts until its formats read clean.

Reference source: Daggerfall Unity `DaggerfallConnect` namespace (C#), plus dfworkshop.net format docs. Translate, keep constants byte-exact.

## Order

| # | Reader | Source files | Status |
|---|--------|-------------|--------|
| 1 | BSA container | ARCH3D.BSA, BLOCKS.BSA, MAPS.BSA | not started |
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

## Blockers

- ARENA2 game data not yet sourced into the dev environment. First task of the arc.

## Decisions log

- (empty)
