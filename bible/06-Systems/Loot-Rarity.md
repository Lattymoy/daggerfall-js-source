# Loot Rarity

The rarity ladder grades found weapons, armour, jewellery and garments into tiers with affixes a player can compare. The
player meets it as coloured names and rows, affix lines on the item card, a chime when a body holds a Rare or better,
and Unidentified pieces that the Identify spell or the Mages Guild reveals. It is the `loot-rarity` feature row (pref
`lootRarity`), on by default and forced on online. Off, no field is written and loot is Daggerfall Unity's.

## How it works

### The ladder

`RARITIES` in `src/systems/loot/lootRarity.js` holds the tiers: Common, Magic, Rare, Legendary, Aetheric, Artifact and
Gilded. Rolls reach Common to Legendary. Aetheric and Gilded come from their own systems
(`bible/11-Multiplayer/Sigil-Sets.md`, `bible/06-Systems/Gilded.md`); Artifacts are DFU's own.

- **Magic**: one or two affixes, or any enchanted item (a DFU magic item, a made or bound one).
- **Rare**: three or four affixes, a name its lines give, and one DFU catalogue enchantment (`RARE_FLAVOURS`).
- **Legendary**: a fixed record from `LEGENDARIES` with its name, affixes, enchantment and lore
  (`bible/06-Systems/Loot-Arc.md`).

There is one ladder: `rarityOf` reads a rolled item's own field, an artifact as an artifact, any enchanted item as
Magic, the rest as Common. DFU's own magic-item roll still runs; its items are Magic and never roll again.

**Eligible**: a weapon that is not an arrow, armour, jewellery or a garment, that can be worn (`src/systems/equip.js`
`wearableItem`). Never a quest item, an artifact, an enchanted item, an item that already rolled, or a foe's worn kit:
`rollCorpseLoot` rolls what a foe carries, not what it swings.

### The odds

`rollRarity` draws once in a thousand against three thresholds from `rarityChances`. Each threshold is
`base + perTier x tier` (`RARITY_WEIGHTS`), times the source's kind (`SOURCE_MULT`: a pile 1.3, a boss 2.5) and the
player's Luck (`luckMult`, from half at Luck 0 to half again at 100), never over its cap.

- A corpse's tier is the dead thing's level. A boss is any Daedra, or a monster of `BOSS_LEVEL` or more.
- A dungeon pile's tier is the dungeon kind's (`DUNGEON_RARITY_TIER`); a tavern's or guild's pile is
  `INTERIOR_RARITY_TIER`.
- The level gate scales the Rare and Legendary thresholds for a young character (`src/systems/loot/lootLevelGate.js`).

### Affixes

`AFFIX_KINDS` lists the kinds, each with the groups it lands on, its name word and a band per tier (`AFFIX_RANGES`).
The core six are damage, armour, carrying weight, attribute, resistance and skill; the Loot arcs add more. No kind
repeats on an item. The first pick leans to the group's own number; later picks are drawn over the lines still open.
Armour leans by family (`ARMOR_LEAN`): leather, chain and plate weigh different lines, at the same bands.

Affixes are folded onto the wearer by `affixFold`, one of the entity's modifier folds (`src/systems/entityMods.js`),
at every equip change and load.

### Names, identify and worth

A Magic name takes one word or two, a Rare's follows its lines (`Sentinel's Cuirass of the Bear`), a Legendary has its
record's name without the material prefix; the metal stays on the card's sub-line. A Rare or Legendary carries a DFU
enchantment, so DFU's own identify law makes it drop Unidentified; its affixes work all the same. A rolled item is worth
its base plus `AFFIX_WORTH` per affix point, plus `RARE_ENCHANT_WORTH` for an enchantment.

### Where it shows

The classic scroller tints a cell by tier; the enhanced pack, card and pile plaque colour the name by `RARITIES`. The
tooltip lists the tier, each affix and the enchantment. A body with a Rare or better rings the enchanter's chime.
`rarity`, `affixes` and `legendary` ride the item record in the save and on the wire.

## Rules

- On by default; the ladder is the game's own (Mac).
- Replace, don't layer: one ladder over DFU's magic items, never a second roll on them.
- LOOT-GATE (Dudey): Rare and Legendary are held back by the roller's level; its numbers are never published.
- Shops and quest rewards do not roll (Mac).
- One roll per item, ever.
- No new rung, no band above the Legendary, no line past the Legendary band's top without the owner's word
  (`bible/05-Combat/Power-Ceiling.md`).

## Daggerfall Unity

DFU has no rarity. Its magic items (`ItemBuilder`, `MAGIC.DEF`) become the Magic tier untouched; Rares and Legendaries
use its enchantment catalogue, so `IsIdentified` and `ResolveItemName` work unchanged. Affixes are read where DFU reads
the same quantity: the weapon roll in `calculateAttackDamage`, armour in the hit formula, resistances in `savingThrow`.

## Code and tests

- `src/systems/loot/lootRarity.js` - the ladder, the odds, affixes, names, worth, the fold
- `src/systems/loot/lootLevelGate.js` - the level gate
- `src/scenes/hostCombat.js` `spawnEnemyLoot` - the one enemy-loot seam that rolls a body
- `test/systems/lr1_lootrarity.test.js` - the ladder's laws
- `test/combat/powerceiling_walk.test.js` - every record and minted item within the ceiling
- `test/systems/fb1001_wand.test.js` - no slot, no tier
