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
`test/lr1_lootrarity.test.js` (16). One tuning table: `RARITY_WEIGHTS`
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
an item that already rolled (one roll per item, ever - LR4), or a worn
one. A FOE's list carries its worn kit too (`hostCombat.equipEnemy`
pushes every equipped piece into `entity.items` and onto the equip
table, writing no `equipSlot`), so the hosts go through
`rollCorpseLoot`, which rolls the items NOT on the foe's table: the
loot it carries, never the sword it swings (LR4 - the audit found the
first cut rolling the kit, and a Daedra Lord would have struck with a
Legendary).

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
| armor | armour | prefix | 3-6 | 6-12 | 12-20 | points OFF a blow's chance to land ON THE PARTS THE PIECE COVERS (`equip.armorBodyParts`: a shield its SHIELD_PARTS, a piece its slot's part - as the material's armour value lands) - the hit formula's armour term (FormulaHelper.cs:1158's slot), PCAAO's own read too, and the paperdoll's per-part numbers. LR4: the first cut was entity-wide, and seven Rare pieces made the player unhittable |
| weight (%) | armour, jewellery | prefix | 10-20 | 20-35 | 35-50 | `entityMaxEncumbrance`, the same multiplier IncreasedWeightAllowance rides |
| stat | all | suffix | 2-5 | 5-10 | 10-15 | `liveStat` - an attribute, by name |
| resist (%) | armour, jewellery | suffix | 10-20 | 20-35 | 35-50 | `savingThrow`, per element the spell carries, in the biography's slot |
| skill | all | suffix | 5-10 | 10-20 | 20-30 | `skillValue` - a skill, by id |

Magic rolls one or two, Rare three or four (guaranteed a prefix AND a
suffix, so its name has both parts), a Legendary its record's. No kind
repeats on an item; a kind with a parameter never repeats a parameter.
The first pick leans to the group's own number half the time (a
weapon's damage, a piece of armour's armour).

THE FOLD (RF1). Affixes ride an `affixes` list on the item and are
folded onto the wearer by `affixFold`, ONE of the entity's modifier
folds (`systems/entityMods.js`, registered under `LOOT_RARITY_FOLD`):
`computeEntityMods` runs every fold and sums the channels onto
`entity._mods` at every equip change (equip.js's listener list,
`addEquipChangeListener`, beside the enchantment hook; and the save's
`rebuildEquipState`, which runs the listeners so a load reads right
before any magic round) and at every magic round (worldTick, after
the enchant fold), which is where a switch press is felt on a worn
set. DFU's formulas read one accessor per channel there
(`entityArmorMod` on the struck part, `entityWeightMult`,
`entityResistMod`, `weaponDamageMods`), and the leaves `statMods.js`
and `skills.js` read the field, import-free; with the switch off the
fold answers empty and every channel reads the enchantment's alone. A
weapon's damage affix is not folded - it is the weapon's own,
registered as a weapon-damage modifier and read off the item in hand. A malformed record (LR4: `validAffix` - a known
kind, the kind's param or none, an integer value from 1 to the kind's
Legendary ceiling) folds nothing and prints nothing; the wire's
validator refuses a list carrying one, as it refuses a string
`enchantments`.

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

## LR4 - THE AUDIT (2026-09-14, Mac: "Lets do an audit on this system")

An adversarial read of the module and every seam, by a second agent,
with node probes. Findings and what changed:

1. **BUG - foes fought with rolled gear.** The eligibility guard read
   `equipSlot`, which `equipEnemy` never writes; every corpse roll ran
   over the foe's worn kit, so a boss could swing a Legendary at the
   player (its damage affix on its blow, its Strikes enchantment on
   every hit) and wear a Rare's armour. Fixed: `rollCorpseLoot` rolls
   the items not on the foe's equip table; the four host sites go
   through it; the pin exercises the real mechanism (a table with no
   `equipSlot`).
2. **GAP - a forged affix crashed a tooltip or the magic round.** The
   wire typed `affixes` as an array and no more; a `{id:'stat'}` with
   no attribute threw in `affixLabel`, a `null` threw in the fold, a
   `+1e9` armour made the wearer unhittable. Fixed: `validAffix`, the
   validator refusing, every reader skipping.
3. **GAP - armour was entity-wide** (finding 14 of the report): a flat
   subtraction on every part, so seven pieces stacked to the 3% floor.
   Fixed: per part, on the parts the piece covers, on the doll too.
4. **GAP - a Magic could roll again** (no `rarity` in the guard); latent
   since every door is one-shot. Fixed.
5. **GAP - FeatherWeight was a dead line on a drop** (its payload fires
   at the item maker alone). Off the armour pool; the pin refuses any
   Enchanted-only payload in every pool and record.
6. **NIT - the enhanced row named an unidentified item's material.**
   Hidden until identified now, as `%mat` is.
7. **NIT - `rarityOf` read a MAGIC.DEF row with every effect filtered
   out as Common** while eligibility refused it. It is Magic.
8. **NIT - the test LCG could answer exactly 1.** `/0x800000`.
9. Watch item, not changed: a Rare's CastWhenHeld flavour bills its
   classic casting cost in condition on first equip (DFU's own law,
   `assignHeldSpell`); the held spells in the jewellery pool cost
   ~120-160 classic points against an amulet's 800 or a ring's 1200
   hit points, and the armour pool's are cheaper still, so no drop
   breaks on the spot - but the port mints pairings MAGIC.DEF never
   did, so the bill is worth a look in play.
10. Verified sound: every flavour and record param against the
    registry rows; the identify flow; stacking (never for these
    groups); the save and the wire; the fold's every writer; the
    sign of PCAAO's read; the names on bows and shields.

## Recorded, not built

- Shops and quest rewards stay DFU's (above).
- The loot pile billboard is not tinted: the billboard batch carries
  no per-instance colour; the plaque and the chime are the cues.
- No "smart loot" for the character's class, by design: the source
  decides, not the player.
- Enemies wear DFU's own kit, not rolled gear: `rollCorpseLoot` skips
  everything on the foe's equip table.
- On a dungeon reload the saved list overwrites `f.entity.items` while
  the equip slots keep the load-time re-roll (a pre-existing split the
  audit noticed; the roll never touches the slots, so it is inert here).
