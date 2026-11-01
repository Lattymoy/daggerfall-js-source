# Roleplay & Realism: Items

A port of Hazelnut and Ralzar's Roleplay & Realism: Items 1.3 for Daggerfall Unity (MIT): fourteen new weapons and
armour pieces, a rewritten loot table, enemy and starting kits by skill, nine new spells, bandages, item condition that
varies by source, and condition-aware prices. The player meets it in loot, shops and the paperdoll. Its eleven modules
are switches on the Mods pane; `Enabled` is the mod loaded at all. The release's fifteen scripts are restated in our
code, its MIT notice in `LICENSE`; the rows, words and pictures are ours, and the release's record is in
`01-Overview/Own-Work.md`.

## How it works

### The items

DFU registers a custom item as a template row past the classic 288 and a class whose virtuals the item dispatches to.
The port holds each class as a table of those virtuals (`RRI_CLASSES` in
`src/systems/roleplayRealismItems/rriItems.js`), and each law site asks `customItemClass(templateIndex)` first. A class
answers only while the mod and its own switch are on.

- **Hatchet (513)** and **Short Flail (514)**: weapons with their own inventory art. The Smithing anvil makes both
  at every metal (`src/net/recipeLaw.js` `WEAPON_PRODUCTS`): the Light Flail from 3 ingots, Copper and Cured Leather,
  the Archer's Axe from 2 ingots, Copper and an Oak Plank. A made one mints through `weaponOfMaterial`, as a foe's
  does. The anvil offers them only while `newWeapons` registers the class (`src/ui/professions/profPages.js`
  `anvilMakes`), which online it always does. A sworn revenant wields them (`06-Systems/Revenants.md`).
- **The chain set** (515-519): Coat, Leggings, Left and Right Sleeve, Footguards on the chainmail armour table; a plate
  material is named "Chain" before the name.
- **The light set** (520-526): Jacket, Trousers, Cap, Half-boots, Gloves, Left and Right Armguard on the leather table;
  a plate material is "Plated" and counts as leather for class restrictions; Chain becomes "Fur-lined" (`RRI_TEXT`).

`rriVariantWord` gives that word to other systems, so a rarity name reads "Sentinel's Plated Cap of the Bear".

**Our rows** (`src/systems/roleplayRealismItems/rriItems.js` `RRI_ROW_RULE`). Each piece answers to the classic piece
of its slot (`RRI_ROW_FROM`). Weapons take x0.5 weight, x0.5 hit points, x0.75 price, x0.9 enchantment and rarity 1;
the chain set x0.75, x0.6, x0.7, x0.85, rarity 3; the light set x0.5, x0.4, x0.55, x0.7, rarity 2. The index,
paper-doll order, world picture and body record are facts, kept. Our patches to classic rows give what a player
carries by the dozen the weight it would have: an arrow and paper 0.05 kg, a bandage 0.1, oil 0.2, a torch 0.4. The
release's weapon hit points stay as a save's fact (`src/systems/conditionRepair.js` `RRI_RELEASE_POOLS`). A piece
saved before keeps the name it was minted with.

The rows and patches are laid over the classic table at boot while
the mod is on (`registerTemplateOverrides`, `src/systems/item/itemTemplates.js`), so its Features row says it applies
when the game next loads. Random weapons and armour roll over the custom items too (`customItemsForGroup`,
read by `src/systems/loot/loot.js`).

### The art

All 280 pictures are ours (`src/systems/roleplayRealismItems/rriArt.js`), built at runtime at the names, sizes and
rects `src/systems/roleplayRealismItems/rriIndex.js` keeps. The armour is our variation of Daggerfall's matching
paper-doll record, read from the player's ARENA2 (`RRI_ART_BASE`): the jacket over the cuirass, the trousers over the
greaves, the cap over the helm, the record's shape and light kept and our leather, fur trim, riveted scales and ten
metals laid on. The Hatchet is the Battle Axe at 88% about the hand. The Short Flail is drawn whole by our painter, so
it needs no ARENA2. A helmet's mask is the classic helm's own hair area, so it hides the hair under it on the
paperdoll; a Dwarven helmet is our cap in our Dwarven metal. They are registered as lazy stand-in replacements, gated
on the mod's switch and chosen by dye.

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

- Ported 1:1; each function names the C# member it restates. The rows, words and pictures are ours (OWN-WORK, the
  owner); the spells are Static Touch, Spell Dart, Featherfall, Glimmer, Conjure Trinket, Mend Bruise, Second Wind,
  Lift and Unbar.
- The port reads each switch at its site every time; DFU reads them once at load.
- A new character's biography dagger is minted, then worn to 20% condition as the mod does
  (`src/systems/conditionRepair.js`).

## Daggerfall Unity

The mod uses `ItemHelper.RegisterCustomItem`, `ItemHelper.LoadItemTemplates`, `LootTables.DefaultLootTables`,
`FormulaHelper` overrides (`IsItemStackable`, `CalculateCost`), item use handlers and the `OnLootSpawned` events. The
port restates each as a table or a read-through at the matching site. Departures: our rows, words and pictures; the
anvil's two recipes are the game's own, since neither the mod nor DFU forges a weapon.

## Code and tests

- `src/systems/roleplayRealismItems/` - items, realism laws, kits, install, sprite index, our pictures
- `src/combat/rriEnemyEquipment.js` - enemy kits
- `test/systems/rri1_items.test.js` - the fourteen items and their virtuals
- `test/systems/rri2_realism.test.js` - the modules, our rows and words
- `test/systems/ownwork4_rriart.test.js`, `test/systems/rr_nobethesda2.test.js` - our pictures
- `test/net/smithrri.test.js` - the two weapons at the anvil
