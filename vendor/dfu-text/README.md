# DFU's TEXT.RSC string table (vendored)

One file from **Daggerfall Unity** (MIT License, Interkarma and
contributors), vendored verbatim:

- `Internal_RSC.csv` - the English master of DFU's `Internal_RSC`
  string table: every TEXT.RSC record by id, in the importer's markup
  (`[/record]` between a record's variants, `[/end]` at its end,
  `[/left]` / `[/center]` / `[/newline]` for the break bytes,
  `[/pos:x=,y=]` and `[/font=]` for the two prefixed bytes -
  `DaggerfallStringTableImporter.cs:42-59`).

Provenance: https://github.com/Interkarma/daggerfall-unity
`Assets/StreamingAssets/Text/Master Localization CSV Files/Internal_RSC.csv`
on `master`, fetched 2026-09-18 (UTF-8 with BOM, LF, 10,361 lines).

## Why this is committed

Same route the settings defaults and the books table took (Port-Ledger
route (a)): this is DFU's own DATA, not ARENA2 and not the C# we
translate.

- It is DFU's, not classic's. The table was extracted from TEXT.RSC and
  then EDITED by the DFU project, and a DFU build reads the table FIRST
  and falls back to TEXT.RSC only for a key the table lacks
  (`TextProvider.cs:167-188`, `GetRSCTokens`; the English table ships
  in the build as `Assets/Localization/StringTables/Internal_RSC_en`).
  So where the two differ, the table is what a DFU player reads.
- The port reads the player's own TEXT.RSC. `src/formats/rscTable.js`
  carries the rows where the table diverges from classic AND the
  divergence is one the port has verified (MAC-U: record 7333, the
  direction hints - classic's "%loc is %di of here" doubled the
  building name in every answer frame that already names it). The
  whole file is here so that each such row is pinned to its source
  (`test/macu_directions.test.js`) and so `tools/rscTableDiff.mjs` can
  list the remaining divergences against a real ARENA2 without a
  download.
