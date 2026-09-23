# Roleplay & Realism: Items - the mod, 1:1, in slices (RRI1, 2026-09-23)

Mac: *"lets also get this integrated alongside this, along with a
proper audit of your previous work"* - handing over
`RoleplayRealism-Items-1.3-61-1-3-1707669833.zip` (and Roleplay &
Realism 1.8, which has its own page when its slices land).

**Roleplay & Realism: Items 1.3** for Daggerfall Unity, by **Hazelnut &
Ralzar** (Nexus 61; MIT by every script's header). "Modular roleplay
and realism: item, loot and gameplay modifications." Eleven modules,
fourteen custom items, 280 sprites, a loot-table rewrite, enemy and
starting kits, nine new spells. Its record is `vendor/roleplay-realism-
items/` (the manifest, settings, templates and string table verbatim,
the fifteen scripts verbatim from the authors' repository), it is
credited on the About screen, on the Mods pane and the Features home,
and it is ported in slices - this page grows with them.

## The source the port reads

The shipped bundle carries a compiled DLL (36,352 bytes) and no source.
The authors' repository (`ajrb/dfunity-mods`, `RoleplayRealismItems/`,
@ `0af2ec9`, 2024-07-21) carries the source; the bundle's manifest,
settings, `ItemTemplates.json` and string table were diffed against the
repository's and are identical, so the repository's source at that
commit is the shipped 1.3. Every function in `rriItems.js` names the
C# member it restates.

## RRI1 - the items

### What a custom item is in DFU, and what it is here

`ItemHelper.RegisterCustomItem(index, group, type)` (ItemHelper.cs
:130-170) puts a template row past the classic 288 and a CLASS whose
virtuals `DaggerfallUnityItem` dispatches to: `InventoryTextureArchive`
and `InventoryTextureRecord`, `NativeMaterialValue`, `GroupIndex`,
`GetEquipSlot`, `GetMaterialArmorValue`, `GetEnchantmentPower`,
`GetEquipSound`, `GetSwingSound`, `GetWeaponType`, `GetItemHands`,
`GetWeaponSkillUsed`, `GetBaseDamageMin/Max`, and a `CurrentVariant`
setter that fixes the name at the mint. The port's items are plain rows
and its laws are pure functions, so `src/systems/rriItems.js` holds
each class as a TABLE of those virtuals (`RRI_CLASSES`, fourteen rows,
each named for the `.cs` it restates), and each of the port's law sites
asks `customItemClass(templateIndex)` first - DFU's dispatch, one line
at a time, the law staying where it lives:

| DFU virtual | the port's site |
|---|---|
| `InventoryTextureArchive` / `Record` | `systems/itemTemplates.js inventoryItemImage`, `ui/paperDoll.js paperdollItemImage` (with GetItemImage's right-hand +1, :412-414) |
| `GetEquipSlot` | `characters/equipTable.js getEquipSlot`; `systems/equip.js armorSlotRule` (the body part the value lands on) |
| `GetItemHands` | `characters/equipTable.js getItemHands` |
| `GetMaterialArmorValue` | `systems/armorMaterials.js itemArmorValue` (a leaf: the installer registers the answer) |
| `GetEnchantmentPower` | `systems/enchanting.js itemEnchantmentPower` |
| `GetEquipSound`, `GetWeaponSkillUsed`, `GetBaseDamageMin/Max` | `characters/weapons.js` |
| `GetSwingSound` | `systems/soundClips.js` (a leaf: registered) |
| `GetWeaponType` | `combat/fpsWeapon.js weaponTypeForItem` |
| `CurrentVariant` setter | `systems/itemTemplates.js setItemFields`, once per item (marked `rriVariant`) |

Names cross to the sites, not constants ('ChestArmor', 'Either',
'Axe', 'EquipAxe', 'Battleaxe'), and each site maps them onto its own
enum, so the law module imports none of the systems it feeds - no
cycle, no TDZ (DW3's lesson). `systems/rriInstall.js` is the boot: the
rows, the patches, the two leaf registrations, the art.

### The fourteen

- **Archer's Axe (513)** and **Light Flail (514)**: damage 2-10 and
  3-10, Axes and BluntWeapons, Either hand, the battleaxe and flail
  sheets (magic when enchanted), EquipAxe / EquipFlail, SwingMediumPitch;
  their own inventory archive (513/514) at record 0, record 1 for the
  right hand on the doll. Under Diverse Weapons their first-person art
  is the mod's `WEAPON08.CIF` / `WEAPON06.CIF` replacements
  (`GetModdedWeaponFilename` answers "" for a custom template, and
  FPSWeapon falls back to the classic file name - DW1's `atlasFileName`).
- **The chain set** - Hauberk (515), Chausses (516), Left/Right
  Spaulder (517/518), Sollerets (519): the BODY's archive (245+ / 249+)
  at a record by material (leather one, the rest another; Chausses'
  middle arm for chain-family materials; Sollerets always 0), the
  chainmail table (`GetChainmailMaterialArmorValue`), a plate material
  named "Mail ".
- **The light set** - Jerkin (520), Cuisse (521), Helmet (522), Boots
  (523), Gloves (524), Left/Right Vambrace (525/526): their OWN archive
  at a record by body and material (`PlayerTextureArchive - 245`: her
  0-3, him 4-7 -> the row 2 or 6; brigandine +8; leather 16/17; fur its
  own; the helmet's four rows), the leather table
  (`GetLeatherMaterialArmorValue`, fur 5), EquipLeather (417), a plate
  material named "Brigandine ", and **Chain is FUR**: the setter folds
  the material to Leather, marks `message` 1, prefixes "Fur ", and takes
  2 kg off the jerkin.
- `NativeMaterialValue` (the plate material folded by 0x0100 / 0x0200)
  is carried and recorded as inert: the only DFU readers of the
  property are FormulaHelper's enchantment multiplier, which every
  class overrides to read the raw field, and the two weapon-material
  checks, which these armor classes never reach.

### The templates

The fourteen rows and the twenty patches to classic rows are the mod's
`ItemTemplates.json`, verbatim. DFU merges the file by index the moment
the mod is loaded (`ItemHelper.LoadItemTemplates` :1488-1494), whatever
its modules say - a Katana at 3.5 kg, a Tanto with 40 hit points, the
torch at 0.35 drawing world record 16, arrows and gems at 0.1. The port
does the same at boot while the mod is on: `registerTemplateOverrides`
lays the patch over the classic row and `templateByIndex` answers it
first; the frozen DFU table stays what it is. Read at boot and not per
frame, because a patch changes what a minted item weighs and costs -
so the Features row says *when the game next loads*. The custom rows
stay registered with the mod off, so a saved Archer's Axe still
resolves.

### The switches

Eleven modules, the mod's own words, on the Mods pane; `Enabled` is
the mod being loaded at all. A class answers only while the mod and
its own switch are on (`RegisterCustomItem` runs under `newWeapons` /
`newArmor` in InitMod), and `customItemsForGroup` answers the
registered indices in InitMod's order - the two weapons; the chain
five then the leather seven - which is what `CreateRandomWeapon` and
`CreateRandomArmor` roll over (`Range(0, enumArray.Length +
customItemTemplates.Length)`, ItemBuilder.cs:382-390, :451-459): the
port's `loot.js` makers take the same roll.

### The art

280 textures, extracted by `tools/rriExtract.mjs` into
`public/art/roleplay-realism-items/` by the name DFU asks for (99 as
indexed PNG, the rest RGBA, each read back against its texel) with the
`<rect>` beside 232 of them written into `systems/rriIndex.js`. They
are registered on the texture-replacement door as **stand-in** entries
(archives 513-526 have no TEXTURE file; SURV-TENT's kind), **lazy**
(AUDIT-DW F1: fetched when an item wearing one is drawn), **gated** on
the mod's switch, **by dye** (DW3: `520_10-0_Iron` for an iron cuisse,
the bare `520_10-0` for a leather one - GetName's law), the helmet's
masks under `TextureMap.Mask` (ItemHelper.cs:452-453: "alpha 0 is
unmasked areas of image and alpha 1 are masked areas" - the hair under
it comes back to the background before the helmet draws;
`ui/paperDoll.js blitRgba`). The `<rect>` is
`TextureReplacement.OverridePaperdollItemRect`'s placement, in the
doll's own space (it replaces the screen rect whole), so the stand-in's
offset says `paperdoll: true` and the doll's `dollXY` skips the
paperDollOrigin subtraction a classic record's offset needs. The
stand-in answers a record's size, offset and RGBA across dyes (one
record, one entry per dye, the same size and rect for all).

### Not in this slice

The mod's other nine modules were RRI2, below.

## RRI2 - the nine modules past the items

`RoleplayRealismItemsMod.cs` past `RegisterCustomItem`: what InitMod
(:74-165) registers, hooks or replaces under each switch. DFU reads
the switches once at Awake; the port reads each at its site every
time, so a pane toggle takes effect at the next roll - the Features
row says so. Three modules and their seams:

- `systems/rriRealism.js` - the laws that touch no entity: the loot
  matrix and the mob keys, the bandage's arithmetic, the condition
  price and repair factors, the store-quality table, the potion count,
  the two damage tables, the swing time. A leaf (`rriItems`,
  `weapons`, `mobileTypes`), so the loot table and the trade window
  import it.
- `combat/rriEnemyEquipment.js` - the mod's
  `AssignEnemyStartingEquipment` and `ConvertOrcish`.
- `systems/rriKits.js` - what mints and equips: the starting kit by
  skill, the spellbook by skill (the nine spells), the three shelf
  hooks, the bandage's use handler, the swing-time adapter.

`rriInstall.installRoleplayRealismModules` (run by the RRI1 install
at the scene boot) registers the six that DFU installs as delegates or
formula overrides; the rest are read-through arms at the port's site
for the C# member.

| mod law (RoleplayRealismItemsMod.cs) | DFU seam | the port's site |
|---|---|---|
| `LootTables.DefaultLootTables = LootRealismTables` (:87) | the matrix | `loot.js generateItems`: `rriLootMatrix(key) ?? LOOT_MATRICES[key]` |
| `Enemies[id].LootTableKey = MobLootKeys[id]` (:79-84) | the basics row | `loot.js enemyLootTableKey`, read by `hostCombat.spawnEnemyLoot` |
| `IsItemStackable` override (:168-171) | FormulaHelper.cs:2100-2102, an added yes | `inventory.js isStackable`, one arm |
| `RegisterItemUseHandler(Bandage, UseBandage)` (:93) | ItemHelper's handler dictionary, asked by UseItem (:1703-1709) | `itemTemplates.registerItemUseHandler` / `useItem.js`, the delegate arm ahead of the ladder |
| `StackableBandages_OnLootSpawned`, `StoreQualityItemCondition`, `AddPotions_OnLootSpawned` | PlayerActivate.OnLootSpawned (:885) | `rriKits.onShopShelfStocked`, at both of worldModes' shelf doors |
| `RandomConditionEnemyItems` / `RandomConditionLootItems` | EnemyEntity.OnLootSpawned (:399), LootTables.OnLootSpawned (:163) | `hostCombat.spawnEnemyLoot` after the trio (the worn set walked too - DFU's Items holds it, the port's droppable cut does not); `loot.addPileLootExtras` after the J..O tail |
| `CalculateCost` override (:247-260) | FormulaHelper.cs:1884 - `conditionPercentage`, the third parameter DFU's arm never reads | `shopStock.calculateCost`'s fourth argument; `tradeModes` Sell passes `conditionPercentage(item)` as DaggerfallTradeWindow.cs:462 does |
| `CalculateItemRepairCost` override (:262-278) | FormulaHelper.cs:1901 | `repairService.calculateItemRepairCost`, 0.6 / 0.9 under InstantRepairs |
| `EnemyEntity.AssignEnemyEquipment = ...` (:113) | EnemyEntity.cs:133, the delegate | `enemyEquipment.setEnemyEquipmentAssigner`; `assignEnemyStartingEquipment` dispatches; the roll and the armor-value pass are two exports now (`rollEnemyEquipment`, `enemyArmorValues`), the pass reading a custom piece's own `GetMaterialArmorValue` and its class's slot |
| `AssignStartingEquipment = AssignSkillEquipment` (:118) | StartGameBehaviour.cs:84/:115 | `startingGear.setStartingEquipmentAssigner`; `assignStartingEquipment` dispatches at both chargen seeds |
| `AssignStartingSpells = AssignSkillSpellbook` (:122) | StartGameBehaviour.cs:87/:116 | `chargen.setStartingSpellsAssigner`; `assignStartingSpells(careerIndex, spellsByIndex, career)` |
| `CalculateWeaponMin/MaxDamage` overrides (:130-131) | FormulaHelper's TryGetOverride | `weapons.registerWeaponDamageOverride`, an arm after the custom class and before the verbatim table; `enemyEquipment.createWeapon` mints through the same two functions now |
| `GetMeleeWeaponAnimTime` override (:129) | FormulaHelper.cs:830 | `weaponStates.registerMeleeWeaponAnimTime`; the widget passes `{ entity, weaponType, usingRightHand }` so the override reads the strength and the held weapon's `baseWeight` |

Read against the C#:

- **The enemy kit.** A class enemy's whole loadout by class (:523-681);
  `AddOrEquipWornItem` wears every armor, weapon and garment to
  `Range(0.3f, 0.75f)`; the sidearms are carried, not worn; the mage's
  robes are `CreateMensClothing(Plain_robes, race)` with the factory's
  defaults (a random variant, Blue). The kit answers `items` (what
  AddItem put in Items, the corpse's loot) and `worn` (what EquipItem
  put on); `hostCombat.equipEnemy` slots only `worn`. The poison roll
  (:660-680) is the same numbers as ItemHelper's and stays at the
  port's one home for it (`poisons.rollEnemyWeaponPoison`). A monster
  runs ItemHelper's arm and then ConvertOrcish (:683-705): the Orcs
  team, 80%, Ebony and up (a Warlord's Mithril and up), the material
  re-applied over the template's weight, value and condition - which
  the port's mint derives from the material alone.
- **The starting kit** (:759-810) sets AssignStartingGear aside whole:
  no class weapon, no 100 gold; `Range(5, Luck)` gold, the iron dagger,
  the ebony dagger a biography answer gave at 20%, six torches and
  four candles under PlayerTorchFromItems. `AssignSkillItems` never
  passes `equip`, so every skill's item is carried; the shirt and pants
  go on. The upgrade is `Dice100(Luck / (Luck < 56 ? 2 : 1))` against
  DFCareer's forbidden flags (`(flags & f) == f`; armor
  `(WeaponArmorShieldsBitfield >> 6) & 7`). The port's survival
  provisions ride after either kit (`startingGear.addSurvivalProvisions`).
- **The nine spells** are `EffectBundleSettings` in the mod; the port's
  spellbook and caster read SPELLS.STD-shaped records, and
  `EntityEffectBroker.ClassicEffectRecordToEffectSettings` (:950-977)
  is the map between the two - `RRI_SPELLS` carries each as the
  classic record it converts from (type/subType from each effect's
  `MakeClassicKey`, the target and element indices from :985-1027,
  the icon). A field the mod's initialiser leaves unset is the C#
  struct's 0 and is 0 here (Knock's DurationBase/Plus, which Open -
  chance only - never reads). Their indices are the port's own (990+),
  past every SPELLS.STD record; the cost is `classicCastingCost` over
  the record, as the caster prices it.
- **The swing time**: `weaponType == Melee || weapon == null` reads
  the live speed; a weapon's `baseWeight` scaled by `150 - Strength`
  per cent, times 3.4, comes off a speed capped at 98 as
  `speed * reduction / 90` (an int cast), then DFU's `3 * (115 -
  speed)` over the classic frame update.
- **ConditionPercentage** has one home now (`itemTemplates`), the
  C# integer division; itemInfo re-exports it.

The suites that pin DFU's own numbers for the repair price and the
Sell arm (`repairservice`, `trademodes`) import `modsOff` first; the
mod's numbers are pinned in `rri2_realism`.

## Record

`vendor/roleplay-realism-items/`. Suites `test/rri1_items.test.js` (9),
`test/rri2_realism.test.js` (11). Campaigns `tools/mutants/rri1.json`
(11), `tools/mutants/rri2.json` (18). The shipped set:
`public/art/roleplay-realism-items/` (280 PNGs), `src/systems/rriIndex.js`
(generated), `tools/rriExtract.mjs`.
