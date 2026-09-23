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

The mod's other nine modules - lootRebalance (the loot matrix and the
mob loot keys), bandaging, conditionBasedPrices, storeQualityItemCondition,
realisticEnemyEquipment, skillBasedStartingEquipment,
skillBasedStartingSpells (nine new spells), weaponBalance,
alchemistPotions - are RRI2. Their switches are on the pane already
(the mod's own defaults, all on) and read by nothing yet.

## Record

`vendor/roleplay-realism-items/`. Suite `test/rri1_items.test.js` (9).
Campaign `tools/mutants/rri1.json` (11). The shipped set:
`public/art/roleplay-realism-items/` (280 PNGs), `src/systems/rriIndex.js`
(generated), `tools/rriExtract.mjs`.
