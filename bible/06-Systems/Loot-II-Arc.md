# The Loot Arc II - honest numbers, the wardrobe and the craft (LOOT12-LOOT21)

> Design page, written before the code (2026-10-07). The slices at the foot ship in that order; each is shippable and
> verifiable without the next. Where this page and a shipped slice disagree, the slice's own record (section 15) is
> what runs. The first arc is `06-Systems/Loot-Arc.md` (LOOT1-LOOT11); the ladder itself is `06-Systems/Loot-Rarity.md`.

## What Mac asked for

Mac, 2026-10-07: *"I notice that clothing doesn't have a lot of rarity options with.our loot system? Amy ideas?"* and
*"We also have a great solid loot foundation, but what could we do to make it even more amazing, while also balancing
everyrhing?"*. The answer read the code first and found clothing locked out of the ladder whole (section 3), and two
balance holes in the ladder that every slice after would have sat on. Offered: the two fixes, a wardrobe pool for
clothing with its own guardrails, Legendary garments, cursed finds, a hone, a line compare and a loot filter, scrying,
gem sockets and more unique finds. Mac: *"Lets go all in. Rake your time and be as detailed as possible"*.

## 1. The laws this arc keeps

The first arc's seven (`Loot-Arc.md` section 1) stand, every one:

1. **The source sets the odds, never the player** (LR1). LOOT13 restores it where luck had broken it; a scrying tells a
   player WHERE, never makes a find likelier.
2. **Shops and quest rewards do not roll.** The temple lifts a curse off a piece you own; the guild sets a gem in one;
   nothing is stocked, nothing rolled for sale.
3. **A craft reaches Rare at most** (`Professions-Arc.md` law 7). A Masterwork garment takes its Rare at last
   (LOOT14); nothing here makes a Legendary.
4. **Loot never enters the Stores.**
5. **A set works online only; a power never on a player.** The garments' powers answer the world (the weather, a fall,
   a door's people), never a duel.
6. **Off is DFU exactly.** Every slice hangs off the one `loot-rarity` row: off, no garment rolls, no curse, no socket,
   no hone, no scrying, no line is compared and no luck is leaned - the fold answers nothing.
7. **The Aetheric is never rolled; the ladder keeps its six rungs.** A Cursed piece is a variant, as the Exalted is.

And three of this arc's own, each the lesson of something this page found:

8. **No dead lines** (LR4's FeatherWeight, generalised). Every affix and every power has a live reader; a line whose
   reader the player has switched off (Climates & Calories' survival, Off) says so on its card rather than reading as
   if it worked.
9. **A seed's draws stay its seed's** (LOOT2's last-pass law, generalised). Every new roll is taken AFTER every draw a
   door already makes - the wardrobe's pass after the last pass, the curse and the socket after the wardrobe - so a
   seeded mint (the gate's spoils, a town's thanks, a crafted piece, every golden pin) mints what it did.
10. **Gear alone never makes a body immune** (LOOT12). Immunity is the body's - its race, its career, a spell - or a
    whole Aetheric set's tier, earned by its growth.

## 2. The shape, end to end

```
 BALANCE   a rolled resistance line ──► counted to 45 an element (LOOT12)
           luck ──► a multiplier on the source's odds, half to half again (LOOT13)
 WARDROBE  a garment ──► Magic, Rare, Legendary: standing, warmth, weatherproofing, the street's skills (LOOT14)
           six Legendary garments ──► powers felt on the road and at court (LOOT15)
 DECISIONS a Rare or Legendary, one in twelve ──► Cursed: a line more and a drawback, known at Identify (LOOT16)
           ──► the temple lifts it for gold, the line kept
           a line ──► honed: rolled again within its band, never lower, the price doubling (LOOT17)
 CLARITY   a card ──► every line against the piece it would replace (LOOT18)
           a junk mark ──► sold in one press; salvage every Magic in one; quick loot by tier
 CHASE     the codex's unfound record ──► scried: the nearest hidden haunt of its family on your map (LOOT19)
           a Rare or Legendary ──► a socket; DFU's eight gems set in it (LOOT20)
           two Ayleid stones ──► unique finds of the deepest sources (LOOT21)
```

## 3. What was measured before the arc

Every number here was taken through the real code - the fold, the saving throw, `rarityChances` - by probes the
answer's research ran, and each slice's pins drive the same paths.

- **Clothing never rolls.** `src/systems/lootRarity.js` `rarityEligible` takes a weapon, a piece of armour or of
  jewellery and nothing else, so a garment is Common, or Magic only when DFU's own MAGIC.DEF roll lands on one
  (`src/systems/loot.js` `createRegularMagicItem` - groups 6 and 12 are in both of its pick lists). It was not one
  line to open: no kind in `AFFIX_KINDS` named a clothing group, so a garment let through would have rolled a "Rare"
  with no lines and a jewel's enchantment. And a crafted garment took NEITHER roll its quality promises
  (`Professions-Arc.md` 9.2: Superior a Magic roll, Masterwork a Rare): `src/systems/smithItems.js` `mintPiece` gates
  the roll on `rarityEligible`, so off the same loom a Masterwork leather helm came out *Mule's Helm of Skill* (Rare,
  four lines) and a Masterwork Evening Gown or Formal Cloak came out plain - and no pin said so either way.
- **Two Rares made a body immune.** A resistance line's points go onto the saving throw's 50 (`src/systems/spellcast.js`
  `savingThrow` - the biography's slot), and 100 there returns 0 before Willpower is read. Over 20,000 seeded casts each:
  no resistance, 35% of fire spells turned whole and 56% of the damage on average; one Rare at +35, 67% and 23%; **two
  Rares at +25, 100% and nothing** - and the line read "+25% Fire resistance". The Visor of King Lysandus and the
  Amulet of the Nine (+40 Magic each) did the same for the Magic element. The Regalia met exactly this wall (AUDIT
  FINAL cut it to +10 a piece); the rolled ladder never had.
- **Luck outweighed the source.** `rarityChances` added 2 per mille a point of luck over 50 to every threshold, a nudge
  on Magic's hundred and more and the whole of Legendary's one to forty-five:

  | Legendary per mille | Luck 40 | 50 | 55 | 65 |
  |---|---|---|---|---|
  | a rat, level 1 | 0 | 2.2 | 12.2 | 32.2 |
  | a tier-8 corpse | 0 | 10.6 | 20.6 | 40.6 |
  | a plain level-1 humanoid | 0 | 0.22 | 3 (its cap) | 3 |

  +15 Luck - one "of the Gods" line, two "of Fortune" - made a rat out-drop a tier-8 corpse; a plain humanoid sat at its
  ceiling from Luck 55; at Luck 44 and under no corpse below level 16 could drop a Legendary at all, and the drought's
  x3 (LOOT8) multiplied nothing; and since a dungeon's piles and foes roll as it is built, at the live luck
  (`src/scenes/dungeonContext.js`, `src/scenes/hostCombat.js` `spawnEnemyLoot`), a Fortify Luck cast at the door leaned
  every roll of the dungeon.

## 4. LOOT12 - honest resistance

The ladder's ROLLED resistance lines - a Magic's, a Rare's, a Legendary's, an Exalted's extra line and (LOOT20) a
socket's gem - count together to **`RESIST_CAP`, 45 an element**. Forty-five is the most that never makes a body immune
alone (50 and 45 is 95; Willpower's tenth only reaches the throw's own 95 clamp), and it keeps every record's own line
whole on its own (Aegis of Dawn's fire and the Mark of the Hist's poison are 45). What is past it is carried and does
nothing; the card says how much of a worn element counts (LOOT18).

An Aetheric piece's lines and a set's tier are their own designs and stay whole: the Regalia's fire immunity is its
tier's, earned by its growth (`11-Multiplayer/Sigil-Sets.md`). The body's own resistances - its race, its career, a
spell's Elemental Resistance - are untouched: immunity is theirs.

After: two Rares at +25 turn about seven fire spells in ten whole and let a sixth of the damage through on average -
strong, and never nothing.

## 5. LOOT13 - luck, a nudge

Luck MULTIPLIES every threshold before its cap: 1% of it a point over 50 and 1% less a point under, from half at Luck
0 to half again at 100 (`luckMult`; a drained or fortified luck past either end reads the end). The table above,
after:

| Legendary per mille | Luck 40 | 50 | 55 | 65 |
|---|---|---|---|---|
| a rat, level 1 | 1.98 | 2.2 | 2.31 | 2.53 |
| a tier-8 corpse | 9.54 | 10.6 | 11.13 | 12.19 |
| a plain level-1 humanoid | 0.20 | 0.22 | 0.24 | 0.26 |

At Luck 50 nothing moves - every measured number of the first arc (LOOT8's drought, LOOT-EASE's bodies, RENOWN-LOOT's
stages) was taken there. The caps hold (a Daedra Lord's corpse at Luck 80 sits at them, as LR1 wrote it), and a
champion's own Legendary source leans by the same law. The unique find keeps its own term, a hundredth of the old
ladder's: it never handed a find over, and the Thunderlock's "about 1 in 700" stands.

## 6. LOOT14 - the wardrobe

A garment - DFU's men's and women's clothing, all 76 templates, every one of which a slot takes - rolls the ladder like
any piece. Its four slots (the chest, the legs, two cloaks; the feet are shared with boots) are worn UNDER armour, so a
garment that rolled the combat pool would add four lines to every character: the wardrobe has a pool of its own,
breadth and never power. The port already gave clothing two jobs - DRESS1's standing (`src/systems/clothingStanding.js`)
and Climates & Calories' warmth (`src/systems/survival/temperature.js`) - and the Economy Arc's intent is that
"roleplay is enforced by how the world reacts - dress, standing, factions" (`Economy-Arc.md`); the pool deepens both.

| kind | slot | Magic | Rare | Legendary | read by |
|---|---|---|---|---|---|
| `standing` (one of the five social groups) | suffix | 2-3 | 3-5 | 5-8 | DRESS1's own channel: the player's `reactionMods`, the gear's sum held to its own cap of 10 a group beside the dress's |
| `warmth` | prefix | 2-4 | 4-7 | 7-10 | Climates & Calories' clothing warmth, counted with the garments' own (so the heat halves it as it halves them) |
| `dry` (weatherproof, %) | prefix | 10-20 | 20-35 | 35-50 | the weather's soaking, all worn at most 75% off; a river still soaks you |
| `skill` | suffix | 5-10 | 10-20 | 20-30 | LOOT1's lean: footwear to the feet's five (Running, Jumping, Climbing, Swimming, Stealth), the rest to the street's seven (Etiquette, Streetwise, Mercantile, Stealth, Pickpocket, Lockpicking, Medical) |
| `stat` - Personality alone on a garment | suffix | 2-5 | 5-10 | 10-15 | `liveStat` |

Never on a garment: damage, armour, carrying capacity, resistance, Luck, or a line that does something - its four slots
carry no fight, no capacity (the Economy Arc's pressure home) and no find. A garment's own number, the one its first
line leans to half the time, is its standing; a standing line leans to the garment's DRESS1 class half the time (fine
wear to the Nobility or the Merchants, common wear to the Commoners, a priest's robes to the Scholars). The words:
`Lined` / `Quilted` / `Fur-lined`, `Waxed` / `Oiled` / `Stormproof`, and a group's suffix (`of the Court`, `of the
Market`, `of Letters`, `of the Commons`, `of the Shadows`, each banded) - *Quilted Formal Cloak of the Court*.

- **The Rare's enchantment** is DFU's catalogue's, so Identify still matters: Good Rep With a social group, Enhances
  Skill (Etiquette, Streetwise, Mercantile, Stealth), Improves Talents (Hearing, Athleticism). Never Cast When Held:
  DFU bills a held spell's casting cost in condition at the first equip (LR4's watch item 9), and cloth carries 70 to
  300 - Slowfalling's 240 would break a Formal Cloak (120) the moment it was worn.
- **Survival Off.** The warmth and weatherproof lines read nothing for a player whose survival tier is Off; their card
  says "(survival off)" (law 8).
- **Its worth is half.** A garment's lines are priced at half a weapon's and its Rare enchantment at 300: a garment
  weighs a quarter of a kilo to two and a half, and at the full price a Rare pair of Tights would have been the best
  gold a kilo in the game.
- **The cap's order.** A plain foe's body keeps three (FOE-CAP); a garment below Legendary ranks UNDER a supply and over
  a plain piece, so a Magic shirt never pushes a Potion of Healing off a body (LOOT-EASE's call).
- **The draw.** Every door rolls its garments in their own pass after every draw it made before (law 9): the host door
  after its last pass, the kit's roll after its own.
- **A craft at last.** A Superior garment takes its Magic roll and a Masterwork its Rare (Professions 9.2 as written),
  identified, the maker's mark on a Masterwork.
- **Never** a set piece or a sigil (SET4 and SIGIL1 are unchanged), and a garment counts for the drought as any piece
  that could have been a Legendary.

## 7. LOOT15 - six Legendary garments

The wardrobe's own records, beside the thirty (`WARDROBE_LEGENDARIES`): each lands on its garments of either cut, carries
three or more lines of the Legendary band from the wardrobe's pool, one DFU catalogue enchantment, a power, where it is
found and a line of lore. Their powers answer the road and the court through seams that already ran.

| record | lands on | its power |
|---|---|---|
| The Alik'r Wayfarer's Robes | Plain Robes | Desert-Born - the heat is felt twenty degrees less |
| The Wrothgar Pass Mantle | Formal Cloak | Mountain-Born - the cold is felt twenty degrees less |
| The Vestments of Stendarr | Priest Robes, Priestess Robes | Stendarr's Mercy - Restoration spells cost a quarter less |
| The Pilgrim's Sandals | Sandals, Shoes | The Long Road - you tire a quarter slower, and a fall hurts half |
| The Silks of Queen Barenziah | Evening Gown, Day Gown, Formal Eodoric, Formal Tunic, Toga, Kimono | Royal Bearing - +5 standing with every social group |
| The Shade's Cowl | Casual Cloak | Unseen - +25 Stealth while its hood is up |

A heat or a cold power reads nothing with survival Off and says so (law 8). Found among the beasts, the brutes, the
daedra, the undead, the casters and the rogues; the codex lists them, the imprint offers their powers to a Rare garment.

## 8. LOOT16 - cursed finds, and the temple's lifting

One Rare or Legendary in twelve minted at a body or a pile (never an Exalted, a crafted piece, the Broker's, the spoils
or a quest's) is CURSED: one more line - a number kind its group may carry and it does not, from the top half of its
tier's band - and ONE drawback from DFU's own catalogue that the port reads live: Bad Rep With a social group, Bad
Reactions From humanoids, animals or daedra, Item Deteriorates in holy places (a weapon's or armour's in sunlight too),
User Takes Damage in holy places, and on a weapon Low Damage Vs a kind and Health Leech unless used daily. Never Extra
Weight (a payload of the item maker's alone) or Weakens Armor (DFU's own inert row): no dead lines.

The drawback is an enchantment, so the piece is unknown until identified (DFU's IsIdentified) - worn unknowing, it
bites. Known, its tier line reads "Cursed Rare" or "Cursed Legendary" and the drawback is named on its card. A TEMPLE's
Cure Disease priest lifts it for gold - a quarter of the piece's price, at least 300 - the drawback gone and the line
KEPT: the find's reward, paid for. Salvage, the Reforge and the hone take a cursed piece as its tier.

## 9. LOOT17 - the hone

At the Reforge, beside each line's Reforge: HONE - the line rolled again within its own band, from its value to the
band's top (never lower), the kind and the parameter kept. The price doubles with every hone on the piece: a Magic's
first 1 shard and 50 gold, a Rare's 2 and 150, an Exalted's line 4 and 500. A line at its top is not honed. Perfect
Rare (LOOT2) becomes a chase with a price.

## 10. LOOT18 - seen: the line compare, the junk and the filter

- **The card compares lines.** Beside AC-COMPARE's armour numbers, every line of a picked piece reads against the piece
  it would replace: `+18% damage [10-25]  ▲6`, a line the worn piece lacks `new`, a line it would lose listed under it;
  and a resistance line says how much of the element the wearer's rolled gear carries and how much of it counts.
- **Junk.** A mark on a piece, beside the lock; a shop's Sell lays every junk piece on the counter in one press, at the
  counter's own price and confirm; a junk piece is never locked and never quick-looted.
- **Salvage every Magic.** One press on the Salvage page, asked first.
- **Quick loot by tier.** A part of the quick-loot row: take all gear, or Magic and up, or Rare and up - gold, supplies,
  a quest's items and everything that is not gear always taken.

## 11. LOOT19 - scrying

At the Reforge, a page: name a family - or press an unfound record in the codex - and for 3 Welkynd Shards and 500 gold
the guild reveals the NEAREST dungeon of that family's kinds in your region that is not yet on your map (DFU's own
discovery, the travel map's own dots), and says its name. Nothing hidden of that family, nothing paid. It changes no
odds (law 1); it is information, which the Economy Arc's intent 7 trades.

## 12. LOOT20 - sockets

A Rare (15 in a hundred) or a Legendary (30) minted at a body or a pile carries one empty SOCKET. At the Reforge, one of
DFU's eight gems is set in it for 100 gold (the gem spent); unsetting shatters the gem. A set gem gives one line by the
piece's kind - a weapon's blow, every other piece's wearer:

| gem | in a weapon | in anything else |
|---|---|---|
| Ruby | +3 Fire damage | +10% Fire resistance |
| Sapphire | +3 Frost damage | +10% Frost resistance |
| Emerald | 3% life leech | +10% Poison resistance |
| Diamond | +6% damage | +10% Magic resistance |
| Amber | +4 Speed | +3 Luck |
| Jade | +4 Willpower | +4 Willpower |
| Turquoise | +4 Agility | +4 Personality |
| Malachite | +4 Strength | +4 Endurance |

A socket's resistance counts toward LOOT12's cap; a gem's line never names the piece and is never reforged or honed.

## 13. LOOT21 - the Ayleid stones

Two unique finds (the Thunderlock's registry): a **Welkynd Stone** - used, your magicka is full and the stone is spent -
from a source of tier 6, and a **Varla Stone** - used, every enchanted piece you wear is restored to its full condition,
DFU's magic items' charges among them - from tier 10. Things DFU's roll cannot make, at the deepest sources.

## 14. The slices

| slice | what | shippable alone because |
|---|---|---|
| LOOT12 | honest resistance | the fold's sum and a number |
| LOOT13 | luck, a nudge | one formula |
| LOOT14 | the wardrobe | the pool, its readers and its pass |
| LOOT15 | six Legendary garments | records and the kit's powers |
| LOOT16 | cursed finds and the temple | a pass, a law and a row |
| LOOT17 | the hone | a law and a press |
| LOOT18 | seen | the card, a mark, two presses and a pref part |
| LOOT19 | scrying | a law, a host hook and a page |
| LOOT20 | sockets | a pass, a law and a page |
| LOOT21 | the Ayleid stones | two registered finds |
| AUDIT LOOT II | the arc, audited | - |

## 15. What shipped, slice by slice

### LOOT12 - honest resistance (2026-10-07)

`src/systems/lootRarity.js`: `RESIST_CAP` (45) and the fold (`affixFold`): a piece of a ROLLED tier (`ROLLED_TIERS` -
Magic, Rare, Legendary) sums its resistance lines apart, and each element's rolled sum lands on the wearer held to the
cap; a piece of any other tier (an Aetheric piece's fixed lines) lands whole beside it. `rolledResistOf(entity,
element)` answers `{ worn, counts }` for the card (LOOT18). One fold, so DFU's every read of the channel - the saving
throw's biography slot (`entityResistMod`) - sees the held sum, and nothing else moved: the fold's other channels, the
sets' own fold and DFU's Elemental Resistance (`elementalResistanceChance`, before the throw) are as they were.

Measured after, the answer's probe through the real fold and throw: no resistance 35% turned whole; +20 53%; +35 67%;
and +40, two Rares at +25, two at +35 or one line at 50 all at the throw's own 95 - about 72% turned whole and 17% of
the damage on average - where two Rares at +25 had been every cast, and nothing.

Pinned: `test/loot12_resistcap.test.js` (3) - the fold over real worn pieces (two Rares 45 not 50, a third adding
nothing, another element its own, a spell of both meeting both, an Aetheric piece whole beside the held sum and never
counted as rolled, off nothing), every record's own resistance line whole on its own and an Exalted line at 50 held,
and the saving throw over 4,000 seeded casts (never immune by rolled gear, three in four whole, a spell's Elemental
Resistance untouched, a bare body's third). `tools/mutants/loot12.json` (8, all dead).

### LOOT13 - luck, a nudge (2026-10-07)

`src/systems/lootRarity.js`: `luckMult` - `1 + (luck - 50) x LUCK_PCT_PER_POINT / 100`, held to `LUCK_MULT_MIN` (0.5)
and `LUCK_MULT_MAX` (1.5) - multiplies every threshold `rarityChances` computes, before its cap: the source's Magic,
Rare and Legendary, and a champion's own Legendary source (CHAMP-LOOT's `legendaryTier`/`legendaryQuality`).
`LUCK_PER_POINT` (2, added) is retired. Every door that reads `rarityChances` takes the law with it - the host door, the
kit's roll, the searchables, the plain ladder - and `uniqueFindChance` keeps its own small term.

**What moved, and why each pin moved with it.** At Luck 50 nothing: every measured number of the first arc stands.
Three pins read the retired law and now read the new one, each saying so: LR1's "luck 0 at tier 0 finds nothing"
(it finds half the floor: 50, 7.5 and 0.5 per mille); FOE-CAP's "luck to the ceilings" (Luck 70 leans each threshold a
fifth, and luck alone no longer reaches a plain foe's ceilings); and AUDIT 625 L6's kit roll at Luck 100, whose roll
between the two thresholds moves from 0.15 to 0.12 (90 per mille at 50, 135 at 100). `Loot-Rarity.md`'s luck bullet is
rewritten to the law.

Pinned: `test/loot13_luck.test.js` (3) - the multiplier (1 at 50, a point 1%, the ends, a drained or fortified luck
read at the end, every threshold leaned before its cap, the caps held, the champion's leaned), the source outranking
luck again (the rat at 65 under the tier-8 corpse at 50, the plain humanoid a tenth of its ceiling at 55, a Legendary
possible at Luck 40 at every level, the drought lifting it), and the host door (a seeded roll between the two leaned
thresholds landing as the luck says; the unique find's term unmoved). `tools/mutants/loot13.json` (8, all dead - the
first run's survivor was a clamp the outer clamp made redundant; the redundant one is gone and the record aims at the
clamp that holds).

### LOOT14 - the wardrobe (2026-10-07)

`src/systems/lootRarity.js`: `CLOTHING_GROUPS`, `isGarment`, `garmentOnFeet` (the slot table's own Feet, `SLOT_RULES`);
`rarityEligible` takes a garment; the three kinds `standing` (a param of `STANDING_GROUPS`, DRESS1's five), `warmth` and
`dry` (each marked `survival`), appended after every kind before them so `AFFIX_IDS` keeps every other kind's place and
no other piece's draw moves; `stat` and `skill` name the two clothing groups too, and `kindParams` holds a garment's
attribute to Personality (`GARMENT_STATS`) - for every other piece it answers the kind's own array, so their draws are
the same draws. `skillKin` gives a garment the street's seven or, on the feet, the feet's five (`STREET_KIN`,
`FEET_KIN`); `pickStanding` leans a standing line to the garment's DRESS1 class half the time, in ONE roll as `pick`
takes (LOOT1's law), and `rollAffixes` mints it beside LOOT1's own line, which stands verbatim; a garment's own number
is its standing. `GARMENT_FLAVOURS` (Good Rep With each group, Enhances Skill for Etiquette, Streetwise, Mercantile and
Stealth, Improves Talents for Hearing and Athleticism) are both cuts' `RARE_FLAVOURS`. `affixesWorth(affixes, item)`,
`rareEnchantWorth` and `exaltedWorth` price a garment at `GARMENT_WORTH_SHARE` (half); `exaltLegendary` and
`reforgeAffix` read `kindParams` and the garment's worth. `asleepNote` - the arc's law 8 - writes " (survival off)" after
a warmth or weatherproof line while the player's survival is Off (`survival/switch.js` `survivalOn`, a leaf).

**The draw** (law 9). `rollLootRarity` passes a garment by in its first loop and rolls its garments in `wardrobePass`
after its last pass - each marked for the drought (LOOT8's `untaken`), a garment already marked passed by, their own
last pass after them. `src/systems/foeLootCap.js` `rollCorpseKit` is the first arc's kit roll whole (`rollKitPieces`,
the garments passed by) and then `rollKitGarments` - the kit's own source (the plain ladder, never a boss's), a copy
laddered, AUDIT 625's laws whole.

**The readers**, every one a field read so the leaves stay leaves: `src/systems/entityMods.js` grows the channels
`standing[5]` and `WARDROBE_CHANNELS` (`warmth`, `dry`, and LOOT15's `coldDegrees`, `heatDegrees`, `fatigueLess`,
`fallLess`), summed fold by fold, empty in `EMPTY_MODS`; `affixFold` folds the three kinds. `src/systems/clothingStanding.js`
`dressStanding` lays the gear's standing beside the dress's, held to `GEAR_STANDING_CAP` (10) a group.
`src/systems/survival/temperature.js` `clothingWarmth` counts the lining with the cloth (`gear` - halved in the heat, eaten by the
wet as the cloth is); `feltTemperature` passes it and takes the weather's soaking down by the weatherproofing, at most
`GEAR_DRY_MOST` (75%) - a river, a wade and a dive soak you whatever you wear; `wardrobeCtx` lays the fold's numbers on
the felt temperature's context (the degrees on the host's own frost and fire resistance), and `survival/needs.js`
`survivalMinute` spreads it in. **The cap**: a garment below Legendary ranks `GARMENT_UNDER_SUPPLY`, under a supply and
over a plain piece (`capRank` - LOOT-EASE's line kept verbatim beneath).

**What moved.** Three LR pins read the old law and read the new: a garment is eligible; the six numbers are nine; a
Rare's flavours may be a garment's. The Test Room lays a Magic and a Rare of a Formal Cloak and an Evening Gown
(`src/systems/testRoom.js` `TEST_WARDROBE_BASES`), and LR1's room counts read them. Two records whose lines now pass the item through for its worth were re-aimed by
content (`loot2.json` LOOT2-the-worth-forgotten, `loot9.json` LOOT9-price-stays), the laws they pin unmoved. A crafted
garment takes its Superior's Magic and its Masterwork's Rare through `src/systems/smithItems.js` `mintPiece` unchanged -
`rarityEligible` was the only door shut.

Pinned: `test/loot14_wardrobe.test.js` (7) - every template eligible and the pool alone over 4,200 seeded mints (no
other group meets the wardrobe's kinds), the leans and three golden mints, every reader through the real fold (DRESS1's
standing and its own cap, the lining in the cold and the heat, the storm's soaking at 30% and at most 75%, a river
whatever you wear, one minute of the needs, off nothing), survival Off said on the card, the price at half and the
flavours, the cap with room for one, the host door's and the kit's draw order seed by seed, a kit garment on the plain
ladder never a boss's, the copy, a marked garment never rolled twice, a crafted garment's rolls and the wire.
`tools/mutants/loot14.json` (36, all dead - the first run's eight survivors were pins this suite lacked: the golden mints,
the felt reading's lining, the literal 75%, a cap with room for one, the kit's seeded order, the boss's threshold, a
marked garment).

### LOOT15 - six Legendary garments (2026-10-07)

`src/systems/lootRarity.js`: `WARDROBE_LEGENDARIES`, the six records, a table beside `LEGENDARIES` - so the thirty and
every reader of them (the Sigil Broker's `baseLegendaries`, the Test Room's thirty) stand as they were. Each names
`GARMENT_RECORD_GROUP` (`Clothing`) and its templates of both cuts; `recordFitsGroup` lets a record land on its own
group or, the wardrobe's, on a garment of either cut, and `legendariesFor`, `validImprint` and `src/systems/lootCodex.js`
`imprintChoices` read it. `allLegendaries` lists the six after the thirty and before a mod's. Each record carries its
power (`powerOf` reads a record's own, as a mod's), its family (`found`) and its lore. `powerFits` gives Unseen to a
hood-capable piece alone (`survival/temperature.js` `hoodCapable`, HOOD-SAID's one law); `powerLine` writes
" (survival off)" after a climate power's line (law 8).

**The powers, through the seams that ran.** `src/systems/lootPowers.js` `wardrobeFold` is an entity fold, registered
beside the kit's seams - mine alone, nothing with the switch off, a power once however many pieces carry it. Desert-Born
and Mountain-Born fold `heatDegrees` and `coldDegrees`, which `wardrobeCtx` lays on the host's own fire and frost
resistance: the felt temperature's own law, on the natural reading and the clothes' alike. The Long Road folds
`fatigueLess` and `fallLess`, which `src/scenes/shared.js` `fatigueLossMultiplierFor` (laid over PROF9's tart) and
`applyFallLanding` read, held to `WARDROBE_FATIGUE_MOST` (50%) and `WARDROBE_FALL_MOST` (75%) for a mod's power, a
negative nothing. Royal Bearing folds +5 into each `standing` channel, which DRESS1 reads under `GEAR_STANDING_CAP`.
Unseen folds +25 Stealth while `hoodUp` says the hood is up. Stendarr's Mercy is a cast price: `lootCastCost` takes a
quarter off a spell every effect of which is Restoration (`spellOfSchool` - a record's empty effect slot reads as none,
a heal-and-burn is no Restoration spell), and `src/systems/spellcost.js` hands the spell to every cost mod.

**What moved.** The Test Room lays each Legendary garment, and LR1's and LOOT3's room counts read the six beside the
thirty. Five records whose lines now read `recordFitsGroup` were re-aimed by content (`loot10.json`
LOOT10-wire-another-group, LOOT10-imprint-any-group and LOOT10-imprint-unfound; `auditloot.json`
AUDITLOOT-F1-wire-unfitted and AUDITLOOT-F8-imprint-of-the-thirty), the laws they pin unmoved.

Pinned: `test/loot15_garments.test.js` (4) - the records' law (six, of either cut, each landing on every template it
names, the wardrobe's lines at the Legendary band, a priced enchantment that is no held spell, six families, a brief
inside CARD-FIT's 32, no artifact's name; a door's roll on the robes, Casual Pants with no record a Rare, the thirty
never on a garment); every power through its own reader against a twin with the same lines and no power (the felt
reading in the desert at noon and on a mountain pass at night, laid on a spell's resistance, and one minute of the
needs; DRESS1's five a group and the nobility to its cap; the hood up and down; the drain a quarter less, a fall half,
the caps and a negative; once with an imprinted gown; a peer's copy, a foe, off nothing); Stendarr's Mercy on a
Restoration, a Destruction and a mixed spell, and the port's price unmodded; survival Off said on a climate power's
line, never on Royal Bearing's; the codex's rows and hints, the imprint offered to a shirt, a gown and a hooded cloak,
a sword none, and the wire. `tools/mutants/loot15.json` (46, all dead).

### LOOT16 - cursed finds, and the temple's lifting (2026-10-07)

`src/systems/lootRarity.js`: `CURSE_IN` (12) and `CURSE_DRAWBACKS`, six live rows of DFU's catalogue with the params a
curse takes - Bad Rep With a social group (never All), Bad Reactions From humanoids, animals or Daedra, Item
Deteriorates in holy places (a weapon's or armour's in the sun too), User Takes Damage in holy places, and on a weapon
Low Damage Vs a kind and Health Leech unless used daily. `curseParams` also refuses a drawback that would undo the
piece's own good - Good Rep With the group or every group, Potent Vs the kind: two dead lines. `cursePiece` adds the
line (a number kind of the group the piece lacks or, none left, a param its lines leave free; from the top half of its
tier's band, as an Exalted's), sets the drawback beside the piece's enchantment and names it (`cursed`, a declared item
field), and prices the line - a drawback is worth nothing, DFU's own law. `cursePass` takes one roll for each Rare and
Legendary a door laddered that is no Exalted, and draws for nothing else; `rollLootRarity` runs it after the wardrobe's
pass, and `src/systems/foeLootCap.js` `rollCorpseKit` after the kit's - every body and pile door, never a made piece,
the Broker's, the spoils or a quest's. `tierLabel` puts `CURSED_WORD` before a known curse's tier ("Cursed Rare",
"Cursed Perfect Rare"); `affixBand` gives a cursed Legendary's line its band; `curseLine` names the drawback;
`validCurse` is the wire's (`src/systems/loot.js` validLootItem). The payloads are DFU's, ungated by identification:
worn unknowing, a curse bites unsaid.

`src/systems/lootCurse.js` (new): `liftPrice` (a quarter of the piece's price, at least `LIFT_FLOOR`, 300),
`liftRefusal` ('off', 'not', 'unknown', 'worn', 'gold'), `cursedKnown` and `liftCurse` - paid, the drawback out of the
enchantments, the mark gone, the line and the price kept. The temple's row: `src/ui/guildServiceWindow.js` `LIFT_ROW`
and `LIFT_KEY` (L, after DFU's own keys) in the Reforge's place when the host hands `hooks.lift`, and
`src/ui/enhancedPorts.js` on the Plus face; `src/scenes/worldModes.js` hands it to a temple's Cure Disease priest
(HolyOrder), and `openLift` opens the Reforge's window on its one page - `src/ui/reforgeWindow.js` 'lift'
(`REFORGE_GUILD_PAGES` keeps the guild's four when a host names none).

Measured through the real door over 40,000 seeded boss corpses, a weapon and a cloak each: 1,681 of 20,886 Rares and
Legendaries cursed, 0.97 of one in twelve; the six rows drawn about evenly, and each row's params evenly (Bad Rep With
less often with the group a Good Rep With flavour names); a lifting at a median of 685 gold for a Rare and 1,071 for a
Legendary, 300 at the least.

**What moved.** The Test Room lays a cursed Rare and a cursed Legendary, known, and LR1's and LOOT3's room counts read
them beside the Exalted. LOOT14's door pin compares each piece's own draws - its tier, its name and the lines it was
minted with - since a curse is the pass after the garments' and WHICH piece it lands on is the stream's after them.
AUDIT 26's count of the guild popup's click sounds is six (the temple's row clicks as the Reforge's does). One record
was re-aimed by content (`loot2.json` LOOT2-perfect-before-it-is-read: the Perfect's line carries a curse's word now),
its law unmoved; LOOT14's two door records follow the door's new lines.

Pinned: `test/loot16_curses.test.js` (5) - the curse's law (the table's six live rows and their params by group, no
drawback that undoes the piece's own good; over 1,100 seeded mints of every group at Rare and Legendary the line a
number of the group the piece lacked or a free param, from the top half, the name kept, the line's worth on the price,
the flavour kept and the drawback beside it, never twice; never a Magic, an Exalted or a plain piece); the doors (one in
twelve over 30,000 seeded bodies and never a Magic; the same seed cursed and not, every piece's own draws the same; an
Exalted passed by; a body's kit; one draw a Rare and none for anything else; off nothing); every drawback through DFU's
own payload walk, unknown and worn (the group's -10, -5 to hit with the kind near, a point in a temple and never in the
sun, a point of condition, five off a blow on the kind, a day's leech); the card (unknown nothing said, "Cursed Rare",
the drawback named, a Legendary's curse line its band, "Cursed Perfect Rare"); the lifting (the price, each refusal
taking nothing, the drawback gone and the line, the price and the flavour kept, once) and the wire's six forgeries; the
temple's row (its click and its key, no hook no row, the Reforge's row its own, DFU's L first), the Plus face, the
host's hook and the page (the known cursed alone, the drawback and the price, a worn piece's refusal, a short purse's,
the press, nothing to lift said). `tools/mutants/loot16.json` (71, all dead - the first run's survivor was the pass's own
guard, which `cursePiece` repeats: what it adds is that a Magic costs a seeded stream no draw, now pinned).
