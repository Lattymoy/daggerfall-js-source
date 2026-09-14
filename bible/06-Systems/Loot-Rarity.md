# Loot Rarity - the port's own item ladder (LR1-LR3, 2026-09-14)

Mac: "So next I want to talk about building on unleveled loot. My goal
is to transform things into a diablo style system with rarity ... I
really want this the best that it can be ... Make this the most
detailed and best that it can be."

ENHANCED - the port's departure from Daggerfall's rules, built in
house, one row on the Features home (`loot-rarity`, over the pref
`lootRarity`). OFF by default, as the enhanced AI is: it changes what
drops, and DFU's loot is the 1:1 law. The online lane forces it on
with every other enhancement (OL1). Off, not one field is written and
not one read moves.

One module: `src/systems/lootRarity.js`. One pin file:
`test/lr1_lootrarity.test.js` (15). One tuning table: `RARITY_WEIGHTS`
and `SOURCE_MULT`, per mille.

## The ladder

Five tiers, three of which Daggerfall already had:

| tier | what it is | how it comes to be |
| --- | --- | --- |
| Common | a plain item | DFU's own mint, untouched |
| Magic | one or two affixes; or one of DFU's own MAGIC.DEF items | a roll on an eligible item; or derived from any enchanted item |
| Rare | three or four affixes, a two-part name, ONE of DFU's own catalogue enchantments | a roll |
| Legendary | a fixed record: a name a player learns, a set affix signature, its own DFU enchantment, a line of lore | a roll, from `LEGENDARIES` (ten records over the three groups) |
| Artifact | DFU's artifacts, untouched | DFU's own; the ceiling |

REPLACE, DON'T LAYER (decided, 2026-09-14). With the switch on there is
one ladder: `rarityOf(item)` answers a rolled item's own field, an
artifact as the ceiling, any enchanted item (a MAGIC.DEF drop, a made
item, a soul-bound one) as Magic, and the rest as Common. DFU's own
magic-item roll (the loot matrices' MI column) still runs, and its
products ARE Magic-tier items; the port never re-rolls them. A DFU
magic item is not eligible to roll a second tier.

Eligible: a weapon that is not an arrow, a piece of armour, a piece of
jewellery. Never a quest item, an artifact, an item already enchanted,
or an item WORN (a foe's kit sits in its own list after `equipEnemy`,
and stays DFU's).

## The source sets the odds, never the player

Unleveled Loot's whole point is that the world does not scale to you,
and the ladder keeps that law. `rollRarity(source)` draws once in
[0, 1000) against three thresholds - Legendary first, then Rare, then
Magic - computed by `rarityChances` from:

- **the source's tier** - a corpse: the dead thing's own level
  (ENEMY_BASICS; a class enemy has none there and its entity level
  stands in); a treasure pile: the DUNGEON's kind, graded 0..21 by
  `DUNGEON_RARITY_TIER` (the port's own grading of DFRegion's nineteen
  DungeonTypes by how deadly their monster tables run - Volcanic Caves
  and Dragon's Den at 18, a Cemetery at 3); a tavern's or a guild's
  pile: `INTERIOR_RARITY_TIER` (4);
- **the source's kind** - a pile pays 1.3x a corpse; a BOSS (any
  Daedra, or a monster of level 18 or over) pays 2.5x;
- **luck** - the player's live luck, `LUCK_PER_POINT` (2) per mille
  per point over 50, and the same under.

Each threshold is `base + perTier * tier`, times the kind, plus luck,
never over its cap:

| tier | base | per tier | cap |
| --- | --- | --- | --- |
| Magic | 100 | 15 | 600 |
| Rare | 15 | 6 | 260 |
| Legendary | 1 | 1.2 | 45 |

So a rat at level 1 (corpse, tier 1) gives 11.5% Magic, 2.1% Rare,
0.2% Legendary; a Daedra Lord (boss, tier 21) at luck 80 sits at the
caps: 60% / 26% / 4.5%. A Daedra Lord's corpse in a Volcanic Cave can
drop a Legendary at character level 3; a rat never does much.

## Affixes are numbers the player can read

DFU's enchantment catalogue is spell-shaped (Cast When Strikes, Regens
Health) - fine flavour, weak as a comparison loop. The port's affixes
are the numbers a Diablo player compares two swords by. Six kinds
(`AFFIX_KINDS`), each with the groups it may land on, the slot its
word takes in the name, and a banded range per tier (`AFFIX_RANGES`):

| kind | on | slot | Magic | Rare | Legendary | read at |
| --- | --- | --- | --- | --- | --- | --- |
| damage (%) | weapons | prefix | 5-12 | 10-25 | 20-40 | the weapon's own roll in `calculateAttackDamage`, before the swing's mods |
| armor | armour | prefix | 3-6 | 6-12 | 12-20 | points OFF a blow's chance to land - the hit formula's armour term (FormulaHelper.cs:1158's slot), PCAAO's own read too, and the paperdoll's numbers |
| weight (%) | armour, jewellery | prefix | 10-20 | 20-35 | 35-50 | `entityMaxEncumbrance`, the same multiplier IncreasedWeightAllowance rides |
| stat | all | suffix | 2-5 | 5-10 | 10-15 | `liveStat` - an attribute, by name |
| resist (%) | armour, jewellery | suffix | 10-20 | 20-35 | 35-50 | `savingThrow`, per element the spell carries, in the biography's slot |
| skill | all | suffix | 5-10 | 10-20 | 20-30 | `skillValue` - a skill, by id |

Magic rolls one or two, Rare three or four (guaranteed a prefix AND a
suffix, so its name has both parts), a Legendary its record's. No kind
repeats on an item; a kind with a parameter never repeats a parameter.
The first pick leans to the group's own number half the time (a
weapon's damage, a piece of armour's armour).

THE FOLD. Affixes ride an `affixes` list on the item and are folded onto
the wearer by `computeAffixMods` into `entity._affixMods` - at every
equip change (equip.js's new listener list, `addEquipChangeListener`,
beside the enchantment hook; and the save's `rebuildEquipState`, which
runs the listeners so a load reads right before any magic round) and
at every magic round (worldTick, after the enchant fold), which is
where a switch press is felt on a worn set. The readers are field
reads at DFU's own read sites, so `statMods.js` stays import-free;
with the switch off the fold is empty and every reader answers 0. A
weapon's damage affix is not folded - it is the weapon's own and read
off the item in hand.

NOT ENTRIES IN `item.enchantments` (decided). That list is FallExe's
closed enum; a foreign type in it would make every DFU reader of the
list (the value sum, the item maker, the payload dispatcher's
unknown-key abort) affix-aware. Two lists, one wearer.

## Names

- Magic: one word - `Soldier's Shortsword`, `Buckler of the Hare`.
- Rare: both - `Sentinel's Cuirass of the Bear`. The words are the
  affix's (`AFFIX_KINDS[kind].word`), banded by tier: strength's
  suffix runs `of the Ox` / `of the Bear` / `of the Titan`. The
  prefixes are possessives so the long name reads after DFU's material
  prefix: `Ebony Sentinel's Cuirass of the Bear`.
- Legendary: the record's own - `Wyrmbane`, `Nightwhisper`,
  `Graveward`, `Stormcaller's Bow`, `The Warden`, `Titanheart`, `Aegis
  of Dawn`, `Foxglove`, `King's Mark`, `Archmage's Loop`. A Legendary
  is named like an artifact: `itemLongName` returns it without the
  material prefix (one gated arm on ResolveItemLongName's early return).

## Identify is Daggerfall's own

A Rare or Legendary carries a real DFU enchantment (a Rare's one
flavour from `RARE_FLAVOURS` by group - a weapon strikes or drinks, a
piece of armour or jewellery holds; a Legendary its record's), so DFU's
own IsIdentified law (`tradeModes.itemIsIdentified`: an enchanted item
is unidentified until identified) makes it drop UNIDENTIFIED with no
new mechanism: it reads as its bare template with no material and no
affix lines (`ResolveItemName`'s early return), the tooltip says the
tier and "Unidentified", and the Identify spell or the Mages Guild's
service reveals it. A Magic-tier item with only numeric affixes has no
enchantment and reads at once. The affixes WORK while unidentified -
DFU's enchantments do too.

The enhanced pack names through `resolveItemName` now (it showed
`item.name` raw before, which named a magic item before the Identify
spell had - a departure from ItemHelper.cs:265-292 that the classic
skin never made); so does the pile plaque.

## Where it shows

- The native scroller tints the cell by tier (`itemBackgroundColour`,
  after DFU's own three: a quest item keeps its green) and the tooltip
  lists the tier, every affix, and the enchantment's catalogue name -
  a Legendary's lore last - one row each.
- The enhanced pack's rows and the picked card's heading wear
  `data-rarity`; the sheet colours the name (Magic `#6f9ee8`, Rare
  `#e4c34f`, Legendary `#e07a2e`, Artifact `#b57bee` - the four hexes
  are pinned against `RARITIES`); the card lists the lines.
- The pile plaque's rows wear the same attribute.
- The paperdoll's armour numbers carry an armour affix (beside
  Strengthens Armor's channel).
- THE DROP CHIME (LR3): a body carrying a Rare or better rings the
  enchanter's chime (SoundClips.MakeItem) at the corpse beside the body
  fall, on all three corpse hosts. Silent off, for Common or Magic.

## Value

A rolled item is worth its base (ItemBuilder's own arithmetic) plus
`AFFIX_WORTH` per point of each affix, plus a flat
`RARE_ENCHANT_WORTH` (600) for a Rare's or Legendary's enchantment -
not DFU's per-effect cost table, which prices a made item's whole
budget; a drop is not made.

## The hosts (four-hosts law)

Every list a host mints rolls at its source, right after DFU's own
extras: the dungeon's two spawn arms and its treasure piles
(`dungeonContext.js` - a pile at `dungeonRarityTier(dungeonType)`),
the exterior foes (`exteriorFoes.js`, off the same injectable roll
stream), the watch (`cityGuards.js`), a tavern's or a guild's treasure
markers (`interiorContext.js`, the host handing its luck in). Shops
and quest rewards do NOT roll (decided): a shelf is DFU's economy and
a quest's item is the quest's.

## The save and the wire

`rarity`, `affixes`, `legendary` ride the item record whole (the
snapshot copies items as they are); `affixes` joins
`LOOT_ARRAY_FIELDS`, so a peer's string there is refused as a string
`enchantments` is (AUDIT WORLD4 B1). An older save carries neither
field and reads Common.

## The Test Room door

"The loot ladder" (`test=loot`): the Nord Warrior with a Magic and a
Rare of ten bases and every Legendary in the pack, the switch turned on
for the session - the colours, the lines, the unidentified names and
the folds on the paperdoll, without a dungeon.

## Recorded, not built

- Shops and quest rewards stay DFU's (above).
- The loot pile billboard is not tinted: the billboard batch carries
  no per-instance colour; the plaque and the chime are the cues.
- No "smart loot" for the character's class, by design: the source
  decides, not the player.
- Enemies wear DFU's own kit, not rolled gear: a worn item is not
  eligible, and `equipEnemy` has dressed the foe before its list rolls.
