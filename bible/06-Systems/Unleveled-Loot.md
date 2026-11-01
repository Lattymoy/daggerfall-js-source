# Unleveled Loot

A port of Ralzar's Unleveled Loot v1.1.2 for Daggerfall Unity (MIT): weapon and armour materials in loot,
shops and foe loadouts follow the place and the player's Luck, not the player's level. Players meet it as Orcish gear
near Orsinium and Orc Strongholds, better metal in deadlier dungeons, and Daedric or Orcish drops from Daedra and Orcs.
It is on by default; its switches and `Enabled` are in the Mods pane. It is ported 1:1 apart from the departures below.

## How it works

`installUnleveledLoot` (`src/systems/worldTick.js`, after every mod it overrides) registers three things:

- **RandomMaterial and RandomArmorMaterial overrides.** `unleveledRandomMaterial` rolls `Range(0, 92)` plus Luck's
  tenth and picks a material by place: a shop's shelf by its quality (Orsinium may stock Orcish), a dungeon by its
  quality, the wild by a small random. Armour (`armMatSelector`) uses the same roll for plate, chain or leather. Every
  loot pile, shop shelf and enemy loadout reads them through `src/combat/enemyEquipment.js`.
- **The death handler** (`unlevelDroppedLoot`, `addDaedric`, `addOrcish`). A Daedra's or an Orc's corpse may take a
  Daedric or Orcish weapon or piece at 30-75% condition, and its gold is scaled by Luck. It is raised through
  `raiseEnemyDeath` at every kill.
- **`ModifyFoundLootItems`** (`unleveledGoldLootPiles`). Registered under DFU's name, which nothing reads, so it never
  runs, as in DFU.

The place the mod asks about (an open shop, its quality, the dungeon's type, the region) is published by
`src/scenes/worldModes.js` through `setUnleveledLootWorld`. The ten material switches are the mod's MultipleChoiceKeys
in the Mods pane.

## Rules

- All mods are on by default (Mac). The mod's arms do nothing without a player in a world: DFU's own roll stands.
- Kept bug for bug: the dungeon exit does not clear the remembered dungeon type; region and dungeon start at 0 until
  the first door; the Seducer always drops a weapon.
- **METAL-RAMP** (Mac: "Level ramp"): a Daedric or Orcish drop below level 20 is that metal only on a draw of
  `Range(0, 20)` under the killer's level, else the level's middle metal (`rampMetal`: Elven, Dwarven, Mithril,
  Adamantium, Ebony as the level rises). The level and Luck are the raiser's, so a room's clients roll alike.
- **Daedric is rare**: a granted Daedra drop that would be Daedric keeps it on a draw under `DAEDRIC_KEEP` (a tenth),
  at any level and after METAL-RAMP's draw, and is Ebony otherwise, through the Mods pane's Ebony switch
  (`daedricKept`). Whether a Daedra drops at all, and every Orcish drop, stay the mod's.
- A death drop records its rolled condition as `foundCondition`, so online a mended drop sells as it fell
  (`bible/06-Systems/Economy-Arc.md`).
- A dropped armour piece's condition is never above its own maximum.

## Daggerfall Unity

The mod overrides DFU's `FormulaHelper` RandomMaterial and RandomArmorMaterial and handles `EnemyDeath`. The 1.1.2
DLL is the law where it differs from the repository's 1.1.1 source. Departures: METAL-RAMP and `foundCondition` (both
because a new character could farm Orcish gear outside), the armour condition cap, and `DAEDRIC_KEEP`. Online the mod
is on, shops never stock Daedric and random pieces almost never roll it, so the mod's Daedra drop is the game's main
Daedric source. Without the keep, every granted drop from level 20 would be Daedric.

## Code and tests

- `src/systems/unleveledLoot.js` - the overrides, the selectors, the death handler, `rampMetal`
- `test/systems/unleveledLoot.test.js` - the tables, the transitions, the corpse drops, the dead hook, the seams; the
  shipped settings as literals (the release's record is in `01-Overview/Own-Work.md`)
- `test/systems/daedricrare.test.js` - the Daedric keep and its Ebony

## Open

- The Oblivion Gate Warden's spoils (`src/systems/gate/gateSpoils.js` `rollSpoils`: Ruhn's Regalia and the kill's
  ordinary pieces) and the Delve vault (`src/systems/delve/delveVault.js`) roll Daedric outside this mod, so
  `DAEDRIC_KEEP` does not reach them. They stand until the owner decides.
