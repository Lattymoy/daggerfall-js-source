# Unleveled Loot - the mod, 1:1 (UL1, 2026-09-12)

Mac: "Heres the next mod unleveled loot. Again 1:1" - handing over
`Unleveled_Loot-135-1-1-2-1747562418.zip`.

**Unleveled Loot v1.1.2** for Daggerfall Unity 1.1.1, by Ralzar (MIT,
per the source header; Nexus mod 135 - the manifest's ContactInfo;
source at github.com/Ralzar81/Unleveled-Loot, master = 1.1.1). "Makes
loot and shop stock materials not scale to your level." Its data is
vendored under `vendor/unleveledLoot/` (the manifest, the shipped
modsettings, a README), it is credited on the About screen, and it is
ported as `src/systems/unleveledLoot.js`. Its ten switches and
`Enabled` live in the Mods pane; off by default, as DFU without the mod
listed, until MO1 (2026-09-12, Mac: "All mods should be enabled by
default") turned it on - and with it the mod's arms decline without a
player to read (no world yet: DFU's own roll stands).

## The source the port reads

The shipped `unleveled loot.dfmod` is a UnityFS bundle: a compiled
`Unleveled Loot.dll` (11,264 bytes), the manifest and modsettings.
Unpacked (UnityPy) and the DLL decompiled (ILSpy 8.2), read beside the
repository's `UnleveledLoot.cs` (1.1.1). The 1.1.2 DLL is the law where
the two differ: the armour drop is built as a NEW item over
CreateRandomArmor's template with ApplyArmorSettings(daedric or
orcish, variant 0), and its condition is 30-75% of the RANDOM piece's
maxCondition (`val2.maxCondition`), not the new piece's; 1.1.1 applied
the material to the random piece itself. Both add at AddPosition.Back.
The shipped modsettings is byte for byte the repository's.

## What the mod is, and where each part landed

| the mod's | does | lives here as |
| --- | --- | --- |
| `Init` | reads the ten MaterialSwitching MultipleChoiceKeys into `matSwitchList` (index -> WeaponMaterialTypes); `orcishDrops` = Orcish still 8, `daedricDrops` = Daedric still 9 | `matSwitchList`, `orcishDrops`, `daedricDrops`, read live off the Mods pane |
| `Awake` | RegisterOverride("ModifyFoundLootItems"), OnEnemyDeath, OnPreTransition, OnTransitionExterior, RegisterOverride("RandomMaterial"), RegisterOverride("RandomArmorMaterial") | `installUnleveledLoot` (systems/worldTick.js): the two rolls on formulas' registry, consulted by `combat/enemyEquipment.js`'s `randomMaterial` / `randomArmorMaterial` (every loot pile, shop shelf and enemy loadout); `raiseEnemyDeath` (scenes/corpseMarker.js) raised at the three kills; the two transition arms called from scenes/worldModes.js |
| the RandomMaterial override | `luckMod = LiveLuck / 10; matRoll = Range(0, 92) + luckMod; WpnMatSelector()` (the level ignored) | `unleveledRandomMaterial` |
| the RandomArmorMaterial override | the same roll, `ArmMatSelector()` | `unleveledRandomArmorMaterial` |
| `WpnMatSelector` / `RandomMat` / `ShopMat` / `RandomHighTier` / `ShopLevel` / `dungeonQuality` / `MaterialSwitch` | a shop's shelf (-35 + level x 8; Orsinium over 70 may stock Orcish; 99/97/94/88/80/70, under 10 Iron) or the world (a dungeon's quality less 15, else -Range(10, 20); luck's double lifts by luck x 4 or, in Orsinium or an Orc Stronghold on luck, Orcish; 90 -> Dwarven or, on luck x 3, the high tier; 83/75/35); then the switch | the same names, over the shared `matRoll` and `luckMod` statics |
| `ArmMatSelector` | Range(1, 91) + luck, the shop's quality x 6 or the dungeon's quality; over 80 plate of WpnMatSelector's material (the SAME matRoll), over 50 chain, else leather | `armMatSelector` |
| `SetDungeon_OnPreTransition` / `ClearData_OnTransitionExterior` | `region = CurrentRegionIndex; dungeon = CurrentLocation.MapTableData.DungeonType` at every transition; `dungeon = -1` on a BUILDING exit | `unleveledLootPreTransition` at DFU's five OnPreTransition doors (tryEnter, tryExit, tryEnterDungeon, exitDungeonNow, the teleport's forceExitToExterior), `unleveledLootExteriorTransition` at tryExit alone |
| `UnlevelDroppedLoot_OnEnemyDeath` / `AddDaedric` / `AddOrcish` | a Daedra's (MobileAffinity.Daedra) or an Orc's (MobileTeams.Orcs) corpse may take a daedric or orcish weapon (Range(Dagger, Long_Bow + 1), 30-75%) or piece; every gold stack / level (never under 1) x Range(1, luck's tenth + 1) | `unlevelDroppedLoot`, `addDaedric`, `addOrcish`, over the corpse's items (the entity's) |
| `UnleveledGoldLootPiles` | books worn to 20-75%, currency / level - the ModifyFoundLootItems override | `unleveledGoldLootPiles`, registered under the same name, READ BY NOTHING - see below |

The world the mod asks of PlayerEnterExit, PlayerGPS and the player -
IsPlayerInsideOpenShop, Interior.BuildingData.Quality,
IsPlayerInsideDungeon, CurrentRegionIndex, CurrentLocation's
DungeonType, the level, LiveLuck - is published live by
scenes/worldModes.js (`setUnleveledLootWorld`); the two hosts hand it
`currentRegionIndex` and `currentLocation`.

## What is kept bug for bug

- **`ModifyFoundLootItems` is dead.** The mod registers it on
  FormulaHelper; DFU 1.1.1's FormulaHelper, LootTables and
  DaggerfallLoot read no such name (nor master's). So the "unleveled
  gold in loot piles, worn books" arm never runs in DFU - loot piles
  keep their levelled gold. The port registers the same name, which
  nothing consults; the function is exported and pinned so the day DFU
  grows the hook the port can grow the read.
- **The dungeon exit does not clear `dungeon`.** The mod subscribes
  OnTransitionExterior (a building's exit) and not
  OnTransitionDungeonExterior, so after leaving an Orc Stronghold the
  `dungeon == OrcStronghold` arm keeps lifting Orcish outdoors until the
  player leaves a building; the dungeon exit's OnPreTransition re-reads
  the dungeon's own type first.
- **`region` and `dungeon` start at 0** - Alik'r and a Crypt - and
  change only at a transition, so a game loaded inside a dungeon reads
  quality 12 whatever the dungeon is, until its next door.
- **The armour drop's condition** is 30-75% of the RANDOM piece's max
  (leather more often than not), written onto the daedric piece.
- **The Seducer always drops a weapon**; a Daedroth needs over 80 where
  the Fire and Frost Daedra do too and the Lord over 70, the Seducer
  over 75.
- **The manifest requires roleplayrealism and roleplayrealism-items**;
  nothing in the code reads either - the dependency orders the mod
  after Roleplay Realism so its two overrides register last. The port
  has no Roleplay Realism yet; when it lands, its RandomMaterial must
  register before this one (worldTick installs this mod last).

## Port-side decisions, recorded

- **`Enabled` off by default** (the precedent). ~~Off~~ ON since MO1
  (2026-09-12), and `installUnleveledLoot`'s `on` requires the world's
  player as well as the switch - a shelf minted before any world, a foe
  spawned in a host without the reader, read Luck off null otherwise.
- **The ten switches are MultipleChoiceKeys** - the Mods pane grew the
  type (`isChoiceKey`: `options`, the value its index, clamped) and
  steps through the names.
- **OnEnemyDeath is a registry** (`registerEnemyDeathHandler` /
  `raiseEnemyDeath` in corpseMarker.js, the one home of
  EnemyDeath.CompleteDeath), raised at the kill in exteriorFoes,
  cityGuards and dungeonContext - not at a load's rewind of a dead foe,
  which DFU does not raise either. The corpse's collection is the
  entity's items, as DFU's TransferAll leaves it.
- **The rolls are the caller's `rolls`**, so a test drives every
  Range and Dice100.

## Pinned (`test/unleveledLoot.test.js`, 8)

Unity's Range forms; the tables (dungeonQuality, ShopLevel,
RandomHighTier's thresholds, MaterialSwitch through the ten keys and
their defaults); the transitions (both statics 0 until a door, region
and type at a pre-transition, the building exit clearing, the dungeon
exit not, the five and the one call sites); RandomMat through the
wilderness, Orsinium, a remembered Orc Stronghold, the low end and a
Coven; ShopMat's ladder, Orsinium's shelf, ArmMatSelector's three
answers over the shared roll; the corpse (a Lord's dagger at 30% of
its own max, the 1.1.2 armour drop with the leather max's condition,
the Seducer's weapon, a Daedroth at exactly 80, the Warlord's orcish, a
rat's gold, daedricDrops off); the dead ModifyFoundLootItems (worn
books and divided gold in the function, no reader in the port); and
the seams - the registry declining and answering, the level ignored,
OnEnemyDeath through the seam and at the three kills, the pane's
choice keys against the shipped modsettings and their clamp, the
credit, the vendor, the boot order, the world reader and the hosts'
hand-off. Not run here: a game.
