# MUDEX 1.0.1 - Ralzar (Meaner Monsters beside Daggerfall Enemy Expansion)

**MUDEX** - "Meaner Unleveled Daggerfall Enemy Expansion", version 1.0.1, by
**Ralzar** (GUID `7241df16-730c-47c9-9afc-3e65d694706f`) - is the author's own
form of Meaner Monsters for a game with Daggerfall Enemy Expansion loaded.
Meaner Monsters 1.5.2 (`vendor/meanerMonsters/`, the same author) looks for
DEX by its GUID and, finding it, tells the player: "Please switch to MUDEX -
Meaner Unleveled Daggerfall Enemy Expansion" and "Meaner Monsters and
Unleveled Mobs is incompatible with DEX." (MeanerMonsters.cs:24, :94,
:159-164). MUDEX is what it asks for.

**Source:** `github.com/Ralzar81/MUDEX` @
`6b6665569ca97bba15990a3510ad43f116ac1041` ("Add files via upload",
2025-01-28) - the repository holds the manifest and the two tables the
manifest's `Files` names, and nothing else; the `.dfmod` is built from those
two files. The files beside this note are the repository's, byte for byte
(CRLF as committed).

**Permission:** Mac, 2026-10-20 - "We need to make everything compatible. No
if ands or vutts", then "Approve MUDEX". The repository carries no licence
file; Ralzar's Meaner Monsters is MIT. [Mac: record Ralzar's permission, or
the link to it, here.]

## What is here

- `MUDEX.dfmod.json` - the manifest, verbatim: one required dependency,
  `daggerfall enemy expansion` 1.3.4, and two files.
- `MUDEX_Monsters.mdb.csv` - a monster database in DEX's own format
  (`ID,Name,Level,MinDamage,MaxDamage,MinHealth,MaxHealth,ArmorValue`), 35
  rows: 23 of Daggerfall's monsters and 12 of DEX's. DEX reads every enabled
  mod's `.mdb.csv` (BestiaryMod.GetDBAssets, ParseCustomEnemies) after its
  own - MUDEX depends on DEX, so it loads after it - and a row edits the
  enemy as it finds it, keeping every field it does not name.
- `MUDEX_Tables.tdb.csv` - an encounter table database in DEX's format, 89
  rows: 51 themed, unleveled dungeon tables of its own (`MUDEX_Crypt_Lich`,
  `MUDEX_OrcStrongh_Orc`...) beside the type's other tables, and DEX's 38
  `Default*` tables restated under their own names (ParseEncounterTables'
  replacement arm: a table of a name already read takes the new line's
  enemies).

## Where it is read

`src/systems/enemyExpansion/mudexTableText.js` (written by
`node tools/mudexText.mjs`, held to these bytes by
`test/systems/enemyExpansion/mudex1.test.js`) carries the two tables as text;
DEX's install reads them after its own when MUDEX is loaded for the game -
`bible/04-Characters/Enemy-Expansion.md`, MUDEX.
