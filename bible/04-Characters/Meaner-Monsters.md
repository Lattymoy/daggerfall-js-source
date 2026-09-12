# Meaner Monsters - the mod, 1:1 (MM1, 2026-09-12)

Mac: "Next is this mod to integrate 1-1. Additionally for mod options,
everything should be compatible across the board and there shouldn't be
compatibility switches between mods" - handing over
`Meaner_Monsters-69-1-5-2-1708764880.zip`.

**Meaner Monsters v1.5.2** for Daggerfall Unity, by Ralzar ("Author:
Hazelnut & Ralzar"; MIT, per the source header; forums.dfworkshop.com;
source at github.com/Ralzar81/Meaner-Monsters). "Buffs many monsters.
Debuffs rats, bats and zombies." Its data is vendored under
`vendor/meanerMonsters/` (the manifest, the forty-six sprite-scale xml
files, a README with the provenance and the licence), it is credited on
the About screen, and it is ported as `src/characters/meanerMonsters.js`
(the table, its fold, the xml table, the switch) and
`src/world/billboardXml.js` (DFU's xml billboard scale, a registry). It
is the player's choice in the Mods pane - `Enabled`, off by default, as
DFU without the mod listed.

## The source the port reads

The shipped `meaner monsters.dfmod` is a UnityFS bundle: a compiled
`Meaner Monsters.dll` (10,752 bytes), forty-six xml TextAssets and the
manifest. Unpacked (UnityPy) and the DLL decompiled (ILSpy 8.2), read
beside the repository's `MeanerMonsters.cs` (master = 1.5.2): the two
agree row for row, and the shipped manifest is byte for byte the
repository's.

## What the mod is, and where each part landed

| the mod's | does | lives here as |
| --- | --- | --- |
| `Init` | makes the MonoBehaviour; with **Unleveled Mobs** loaded rewrites `RandomEncounters.EncounterTables[21]` and `[36]` (the Alternate Dragonling joins two wilderness tables); with **DEX** loaded arms two warning boxes | the arm and the boxes are NOT carried - neither mod is in the port; the arm's condition becomes Unleveled Mobs' own switch the day it is integrated |
| `Awake` / `InitMod` | walks `mobEnemyDataArray` (or `pcoEnemyDataArray` behind `pco`, which nothing ever sets) and writes every field that is not -1 over `EnemyBasics.Enemies[id]` | `MEANER_MONSTERS_ROWS` (24 rows, the DLL's order), `foldMeanerMonsters` (the loop, folded), `MEANER_MONSTERS_EDIT` (21 monsters), `applyMeanerMonsters` at `enemyEntity.makeEnemyEntity` - DFU rewrites the global table once, the port overlays the row at mint |
| the forty-six `xml` files | `<info><scaleX>..</scaleX><scaleY>..</scaleY></info>` - TextureReplacement.SetBillboardScale multiplies a mobile unit's record size (DaggerfallMobileUnit.cs:679) and a static billboard's (DaggerfallBillboard.cs:258) | `MEANER_MONSTERS_BILLBOARD_XML` registered on `world/billboardXml.js` by `installMeanerMonsters` (worldTick); `rmbFlats.billboardSize(t, record)` is the one door every billboard now sizes through |
| `pcoEnemyDataArray` | dead - `private static bool pco = false;` | `MEANER_MONSTERS_PCO_ROWS`, data, unreachable, pinned so |

The numbers: the Rat (1-4, 15-25, level 1, armour 8), Giant Bat, Grizzly
Bear (its three pairs 1-2 / 8-12 / 10-20, 50-100), Sabertooth Tiger,
Spider, Werewolf (three pairs, level 8, armour 1), Wereboar, Giant
(10-30, 150-200), Zombie (1-5, 60-100, level 5, armour 7 - the debuff),
Mummy, Giant Scorpion, Vampire Ancient, Daedra Lord (40-100, 100-240,
armour -10), Lich, Ancient Lich (100-130), Orc, Orc Sergeant, Orc
Shaman, Orc Warlord, the atronach row, the Dragonling (50-150, 140-250,
level 21, armour -12). The scales: Werewolf (264) and Wereboar (269)
records 0-14 x1.2; the Dragonling (295) records 0-14 x2.5 and its
corpse (96/0) x2 - the "Large Dragonling" the row names.

## What is kept bug for bug

- **Four rows carry id 35.** The source comments them "Fire Atronach",
  "Iron Atronach", "Flesh Atronach", "Ice Atronach" - the author meant
  35, 36, 37, 38 - and InitMod applies them in order, so the LAST (the
  Ice row: level 21, 25-130, armour 6, 5-15) is what the Fire Atronach
  ends with, and 36, 37 and 38 are never touched. Against the base row
  that is one change: the Fire Atronach's level, 16 to 21.
- The "Flesh Atronach" row's `minDmg: 55, maxDmg: 15` (min over max) is
  written to 35 and overwritten by the next row before it matters.
- `name: "Large Dragonling"` is never applied: the write is commented
  out in InitMod. The Dragonling keeps its name.
- The Grizzly Bear and Sabertooth Tiger rows carry `level: -1`, so
  their levels stay the base table's.

## No compatibility switches between mods (Mac's rule)

DFU's mods detect each other through `ModManager.GetMod` and read each
other's ModSettings; the port reads a vendored mod's OWN switch through
`modSettingIfDeclared(vendor, key)` (undefined for a mod the port has
not vendored - DFU's "not loaded"). So:

- The overhaul's "Meaner Monsters is loaded" arm (its own edit of these
  numbers) is on when **this mod's** `Enabled` is on and the overhaul's
  is - the `pcaao.meanerMonsters` switch is gone.
- The overhaul's Roleplay Realism archery arm reads
  `roleplayRealism/advancedArchery` - undefined until that mod is
  vendored - and the `pcaao.rolePlayRealismArchery` switch is gone.
- **Order.** PCAAO's manifest lists Meaner Monsters as a dependency, so
  DFU Awakes Meaner Monsters first and the overhaul's InitMod writes
  over it: with both on, the overhaul's values win wherever both write
  (every one of Ralzar's ids is among the overhaul's forty-two). The
  mint applies Ralzar's row, then the overhaul's edit over it;
  worldTick installs in the same order.

## Port-side decisions, recorded

- **`Enabled` off by default** (the Dynamic Skies precedent).
- **The edit takes effect on monsters spawned after the switch** - DFU
  rewrites the table at Awake; the port overlays the row at mint.
- **The xml scale is a registry, not a file read.** DFU reads loose xml
  beside the textures; the port has none, so a vendored mod registers
  its table with a live predicate, and a later registrant wins for a
  record as a later-loaded mod's file does. `TextureFile.load` now
  stamps the archive number on the parsed file so `billboardSize` can
  ask.
- **Every billboard goes through the door**, not only the mod's four
  archives: mobile units, corpses, people, loot, flats, spell art -
  which is DFU's reach (every DaggerfallMobileUnit and
  DaggerfallBillboard). Nothing changes for an archive no mod names.

## Pinned (`test/meanerMonsters.test.js`, 4)

The table row for row and its fold (the id-35 quartet, the name never
applied, the dead pco array); the row at mint under the switch, the
overhaul's edit over it with no switch between, and the overhaul alone
leaving the base row; the forty-six vendored xml files equal to the
table, the registry under the switch, the scale applied to the
truncated record size, a later registrant winning; and the seams - the
archive stamp, no billboard sized past the door, the boot order, the
Mods pane entry, the credit, the README, the overhaul's two switches
gone. Not run here: a game.
