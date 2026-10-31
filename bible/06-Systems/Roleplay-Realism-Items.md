# Roleplay & Realism: Items

A port of Hazelnut and Ralzar's Roleplay & Realism: Items 1.3 for Daggerfall Unity (Nexus 61, MIT): fourteen new
weapons and armour pieces with their own art, a rewritten loot table, enemy and starting kits by skill, nine new
spells, bandages, item condition that varies by source, and condition-aware prices. The player meets it in loot,
shops and the paperdoll. Its eleven modules are switches on the Mods pane; `Enabled` is the mod loaded at all. Its
record is `vendor/roleplay-realism-items/` (manifest, settings, templates, string table and scripts verbatim).

## How it works

### The items

DFU registers a custom item as a template row past the classic 288 and a class whose virtuals the item dispatches to.
The port holds each class as a table of those virtuals (`RRI_CLASSES` in
`src/systems/roleplayRealismItems/rriItems.js`), and each law site asks `customItemClass(templateIndex)` first. A class
answers only while the mod and its own switch are on.

- **Archer's Axe (513)** and **Light Flail (514)**: weapons with their own inventory art. The Smithing anvil makes both
  at every metal (`src/net/recipeLaw.js` `WEAPON_PRODUCTS`): the Light Flail from 3 ingots, Copper and Cured Leather,
  the Archer's Axe from 2 ingots, Copper and an Oak Plank. A made one mints through `weaponOfMaterial`, as a foe's
  does. The anvil offers them only while `newWeapons` registers the class (`src/ui/professions/profPages.js`
  `anvilMakes`), which online it always does. A sworn revenant wields them (`06-Systems/Revenants.md`).
- **The chain set** (515-519): hauberk, chausses, spaulders, sollerets on the chainmail armour table; a plate material
  is named "Mail".
- **The light set** (520-526): jerkin, cuisse, helmet, boots, gloves, vambraces on the leather table; a plate material
  is "Brigandine" and counts as leather for class restrictions; Chain becomes Fur.

`rriVariantWord` gives that word to other systems, so a rarity name reads "Sentinel's Brigandine Helmet of the Bear".
The mod's `ItemTemplates.json` (the fourteen rows and twenty patches to classic rows) is laid over the classic table at
boot while the mod is on (`registerTemplateOverrides`, `src/systems/item/itemTemplates.js`), so its Features row says
it applies when the game next loads. Random weapons and armour roll over the custom items too (`customItemsForGroup`,
read by `src/systems/loot/loot.js`).

### The art

280 textures, extracted by `tools/rriExtract.mjs` into `public/art/roleplay-realism-items/` with their rects in
`src/systems/roleplayRealismItems/rriIndex.js`. They are registered as lazy stand-in replacements, gated on the mod's
switch and chosen by dye; the helmet's masks hide the hair under it on the paperdoll.

### The modules

`installRoleplayRealismModules` (`rriInstall.js`) registers the modules DFU installs as delegates or overrides; the
rest are read at their port site each time, so a toggle takes effect at the next roll.

- `rriRealism.js`: the loot matrix and mob loot keys, bandage arithmetic, condition price and repair factors, store
  quality, potion counts, the damage tables, swing time.
- `src/combat/rriEnemyEquipment.js`: enemy starting equipment and Orcish conversion.
- `rriKits.js`: the starting kit and spellbook by skill (the nine spells), shop shelf hooks, the bandage's use, the
  swing-time adapter.

Condition is randomised on enemy and loot items, a shop's stock follows its quality, and a price reads the item's
condition when sold.

## Rules

- Ported 1:1; each function names the C# member it restates.
- The port reads each switch at its site every time; DFU reads them once at load.
- A new character's biography dagger is minted, then worn to 20% condition as the mod does
  (`src/systems/conditionRepair.js`).

## Daggerfall Unity

The mod uses `ItemHelper.RegisterCustomItem`, `ItemHelper.LoadItemTemplates`, `LootTables.DefaultLootTables`,
`FormulaHelper` overrides (`IsItemStackable`, `CalculateCost`), item use handlers and the `OnLootSpawned` events. The
port restates each as a table or a read-through at the matching site. Departure: the anvil's two recipes are the
game's own, since neither the mod nor DFU forges a weapon.

## Code and tests

- `src/systems/roleplayRealismItems/` - items, realism laws, kits, install, sprite index
- `src/combat/rriEnemyEquipment.js` - enemy kits
- `vendor/roleplay-realism-items/` - the mod's own files
- `test/systems/rri1_items.test.js` - the fourteen items and their virtuals
- `test/systems/rri2_realism.test.js` - the modules
- `test/net/smithrri.test.js` - the two weapons at the anvil
