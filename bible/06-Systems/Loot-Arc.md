# The Loot Arc - powers, the chase and the loop (LOOT)

> Design page, written before the code (2026-10-01). The slices at the foot ship in that order; each is shippable and
> verifiable without the next. Where this page and a shipped slice disagree, the slice's own record (section 15) is
> what runs.

## What Mac asked for

Mac, 2026-10-01: *"So weve been making so much progress and I want to talk about enhancing the rarity loot system.
Currently we have rarity tiers, armor set bonuses, boss loot, etc and im wondering how we could go further"*.

Ten directions and a quick win were offered in three groups: DEPTH (items that change how you play: Legendary powers,
affixes that do things, the roll seen and the Exalted, more Legendaries), CHASE (where it comes from: signature drops,
champion foes, bad-luck protection) and the LOOP (something to do with loot: salvage and a reroll, a Legendary codex,
a line of light over every Rare drop); the quick win was AUDIT-LR's second note - a warhammer that rolls +20 Impish.
Mac: *"Do you wanna turn this into and arc and do all of the above?"* - all of it, as an arc.

## 1. The laws this arc keeps

Every one of these is a standing call of Mac's, and no slice moves it:

1. **The source sets the odds, never the player** (`Loot-Rarity.md`, LR1). A signature drop steers WHICH Legendary a
   source's kind of foe yields, never whether; the drought multiplies the source's OWN Legendary chance, so a rat's
   stays a rat's; a champion is a source, stronger because it is.
2. **Shops and quest rewards do not roll** (LR1). The Reforge is a service on a piece the player already owns; no
   shelf is stocked, nothing is rolled for sale.
3. **A craft reaches Rare at most** (`Professions-Arc.md` law 7). Nothing here makes a Legendary: an imprinted Rare
   (LOOT10) carries a Legendary's power and stays Rare.
4. **Loot never enters the Stores** (`Professions-Arc.md` 9.3). The salvage's shard is a pack item, bound, and never
   the Stores'.
5. **A set works online only, never in a duel** (`11-Multiplayer/Sigil-Sets.md`). Untouched. The new affixes and the
   Legendary powers work offline and online - as a Legendary's numbers always have - and never on a player: they
   answer my blows at a FOE and a foe's blows at me, and a duel's blows reach neither (SET2's damage door passes a
   duel's blow without asking the port, and every blow modifier here refuses a target that is a player).
6. **Off is DFU exactly** (LR1). Every slice hangs off the one `loot-rarity` row: off, no field is written, no read
   moves, no champion stands, no line of light is drawn, no shard is minted.
7. **The Aetheric is never rolled** (SET6). The Exalted is a Legendary's variant, not a rung: the ladder keeps its six.

## 2. The shape, end to end

```
 DEPTH   a roll ──► affixes that lean to the item (LOOT1) ──► their bands on the card, a Perfect (LOOT2)
         a Legendary ──► one in ten Exalted (LOOT2) ──► thirty records (LOOT3) ──► each with a POWER (LOOT5)
         five affix kinds that DO things - a sear, a leech, thorns, focus, a slayer's edge (LOOT4)
 CHASE   the source's family ──► its signature Legendaries weigh five to one (LOOT6)
         a champion: a trait, a name, twice the health ──► a Rare or better, always (LOOT7)
         the drought: pieces taken without a Legendary ──► the source's own chance, up to three times (LOOT8)
 LOOP    a Magic+ piece ──► salvaged for Welkynd Shards (LOOT9) ──► the Reforge: one line rolled again
         a Legendary found ──► the codex (LOOT10) ──► its power imprinted on a Rare
         a body or a pile holding a Rare+ ──► a thin line of its tier's light (LOOT11)
```

## 3. LOOT1 - a skill affix leans to the item's own skills

AUDIT-LR's second note, the tuning slice it named: "a warhammer can roll +20 Impish ... a weighting toward the group's
own combat skills would be a tuning slice, not a fix". A skill affix's skill is drawn:

| the item | half the time | then, to 85 in a hundred | the rest |
|---|---|---|---|
| a weapon | its own weapon skill (the skill that swings it: a bow's Archery, a staff's Blunt Weapon) | the strike's kin: Critical Strike, Backstabbing, Dodging | any skill |
| armour | - | the body's twelve: the seven ways of fighting (the six weapon skills, Critical Strike) and Dodging, Running, Jumping, Climbing, Swimming | any skill |
| jewellery | - | the mind's thirteen: the six schools, Etiquette, Streetwise, Mercantile, Lockpicking, Pickpocket, Stealth, Medical | any skill |

A WEIGHTING, NEVER A FENCE: a language was a skill affix 9 times in 35; now about 1 in 30. A step with no free skill
(a kind with a param never repeats one on a piece) gives way to the next, so the draw never comes back empty. The
Legendaries' skills are their records', untouched.

## 4. LOOT2 - the roll seen, and the Exalted

**The band on the line.** Every affix the ladder ROLLED reads with its band: `+18% damage [10-25]`. A Legendary's
record lines carry none - they are its signature, fixed - and an Exalted's extra line carries the Legendary band.

**Perfect.** A Rare whose every rolled affix stands at its band's top reads `Perfect Rare` on its tier line - one
Rare in a few thousand, worth a word - once its numbers are read. Never a Magic piece: one line at its top is one
Magic in eight, no word's worth.

**The Exalted.** A Legendary minted at a source - a body, a pile, the gate's spoils, a town's thanks - is EXALTED one
time in ten: `item.exalted = true`, and one more affix: a kind its record does not carry, allowed on its group, its
value in the TOP HALF of the Legendary band. Its tier line reads `Exalted Legendary`; its tile wears a fourth pip
(the Legendary's three diamonds and a star); it is worth 1,000 more and its line's points. Its name is its record's -
the record is what a player learns; "Exalted" is the find. The roll is taken AFTER everything a door already rolls, so
a seed's earlier draws stay what they were (the gate's spoils' own law, SET6), and the Sigil Broker's Legendaries are
never Exalted: its stock is the day's fixed tables, and a roll there would move every day's.

## 5. LOOT3 - thirty Legendaries

The pool grows from ten to thirty: every weapon family, every armour place and every kind of jewellery has a record of
its own, and each record keeps LR2's law - three or more affixes in the Legendary band, kinds its group may carry, ONE
DFU catalogue enchantment priced by DFU's own table, a line of lore, a base it can land on. The new twenty are named
in the lore of the Bay (the Ansei of Hammerfell, the Tsaesci, Orsinium and its king, the Direnni, the King of Worms,
the Warp in the West, King Lysandus, Wayrest's couriers and its Knights of the Rose, Camlorn's Order of the Raven,
the Dark Brotherhood, the walls of Daggerfall, the Nine, the Glenmoril witches, the Hist, the Reach) and never take
an artifact's name. The full table, with each record's power and signature, is LOOT3's section once it ships.

## 6. LOOT4 - five affix kinds that do things

The six kinds LR1 shipped are numbers a wearer carries. Five more DO something, through the seams the Sigil Sets
opened (SET2), in one module (`systems/lootPowers.js`):

| kind | on | slot | Magic | Rare | Legendary | does |
|---|---|---|---|---|---|---|
| `elemental` (fire, frost, shock) | weapons | prefix | 1-3 | 3-6 | 6-10 | that much of its element on every weapon blow at a foe - none on a foe immune to it, half on one that resists |
| `leech` | weapons | suffix | 2-4 | 4-7 | 7-10 | that share (%) of every weapon blow that lands heals you |
| `thorns` | armour | prefix | 1-3 | 3-6 | 6-10 | a foe whose blow lands on you takes that much back (all you wear, at most 25 a blow) |
| `focus` | jewellery | prefix | 2-4 | 4-7 | 7-10 | that share (%) off your spells' magicka (all you wear, at most 30%) |
| `slayer` (undead, daedra, humanoid, animal) | weapons | suffix | 5-10 | 10-20 | 20-30 | that much more (%) weapon damage to that kind of foe - DFU's own grouping (`enemyEntityGroup`: a vampire undead, a dragonling an animal, an orc humanoid) |

A weapon's three are the weapon IN HAND's alone; a wearer's armour and jewellery sum, under the caps. Each answers MY
entity alone, offline and online, and never a player (law 5). Names: `Burning Longsword of the Leech`, `Barbed
Cuirass of the Bear`, `Adept's Ring of the Owl`, `Shortsword of the Gravewatch`.

## 7. LOOT5 - every Legendary a power

Each of the thirty records names one POWER: a sentence, a brief (the card's row, CARD-FIT's 32 characters) and its
numbers, fixed (a Legendary does not grow - its sigil, if it carries one, does). The powers are DATA read by the one
kit LOOT4 builds - a blow's share under a condition (a kind of foe, an unaware foe, a foe under or at full health, me
under a line, the night, a first blow, bare hands), stacks a strike or a kill raises, a blow that arcs or quakes or
echoes, a leech, a kill's heal or magicka or gold or spell on me, a charge that turns a blow aside, a hex on the foe
that struck me, a death cheated, a cost cut, a spell absorbed, a round's regeneration, a better find. A power counts
ONCE however many pieces carry it (a Legendary and a Rare imprinted with it). The powers work offline and online and
never on a player (law 5); the HUD's set chips show a power's stacks and recovery as a set's do.

## 8. LOOT6 - signature drops

Each record names the FAMILY it is found among - the port's grouping of the foe table: the **undead** (the skeletal
warrior to the Ancient Lich, the vampires among them), the **daedra** (the five Daedra, the four atronachs, the imp
and the gargoyle), **dragons** (the two dragonlings), **beasts** (the animals, the werecreatures, the creatures of
the water and the wild), **brutes** (the orcs and the giant), **casters**, **rogues** and **warriors** (the class
foes by their own teams and magic). When a source of a family rolls a Legendary, its signature records weigh FIVE
against one in the pick. A corpse's family is its foe's; a treasure pile's is its dungeon kind's (a Crypt's the
undead, a Dragon's Den's dragons, a Coven's casters). Whether a Legendary drops is still the source's tier alone
(law 1). The codex (LOOT10) tells a player where a record is found.

## 9. LOOT7 - champion foes

**Who.** About one foe in fourteen (CHAMP-RATE, 2026-10-03; one in twenty until then) of level 3 or more (never a quest's, the watch, an ally, the gate's Warden) stands
as a CHAMPION, with one TRAIT:

| trait | does |
|---|---|
| Mighty | its blows land half again as hard |
| Stalwart | half again its health, on top of a champion's double |
| Swift | thirty more Speed (at most 100): it closes and attacks sooner |
| Vampiric | half of what its blows take from you heals it |
| Thorned | your blows that land on it hurt you back, a seventh of them |

Every champion has twice its health and its blows a quarter harder (damageScale, multiplied - never overwriting an
elite's). Its name is the trait's and its own - `Mighty Orc Warlord` - on the HUD's target bar, its corpse and its
death line (LOOT7-CHECK, section 17: on the plaque while it fights you too, and - on either skin - said at the first
blow either way, with what its trait does).

**Its loot.** A champion is a stronger source: its tier +4 and its quality x1.5. And it ALWAYS carries a Rare or
better: if its own roll found none, its best eligible piece is made Rare - or, carrying none, a weapon or a piece of
armour at its level is minted and made Rare. The chime rings at its fall.

**Online.** A dungeon's foes are its layout's, built on every client from the location (the elite's way): the
champion and its trait are a HASH of the location and the marker, so every client stands the same champion with no
wire word. A foe in the street or a building is its owner's: the owner's hash says it, and the foe record carries its trait
(`cp`, sent only when set) to every puppet, which wears the same scaling, so a puppet's blow resolved on my side is a
champion's. Said so: when a dying owner hands a street foe over, its carried loot does not travel (the hand-over's
own law), so a champion adopted mid-fight carries none.

## 10. LOOT8 - the drought

Bad-luck protection. Every eligible piece (a weapon, armour, jewellery - LR1's eligibility) the player TAKES from a
body or a pile below Legendary adds one to the character's drought; a Legendary or better taken empties it. At every
source door, the Legendary threshold is multiplied by `1 + 0.2 x floor(drought / 25)`, at most x3 - after 25 pieces
x1.2, after 250 x3 - and never above the Rare threshold (the ladder never inverts). Counted at the TAKE because a
body's loot is rolled when its foe is spawned (`hostCombat.spawnEnemyLoot`): counting the rolls would fill the
drought by walking into a dungeon. A piece is counted once (a mark the source door puts on it, cleared at its first
take - dropped and taken again, it is not counted twice). The drought rides the character's save (a mod record, the Sigil Broker's way); offline and online alike.
Foxglove's power (LOOT5) is the other door to a better find, and it too multiplies the source's own chance.

## 11. LOOT9 - salvage, and the Reforge

**The Welkynd Shard.** A sliver of Ayleid magicka-crystal: a stacking pack item, BOUND (never sold, traded, dropped
or listed - the Sigil Stone's law, SS1/SS3), the Reforge's only coin. Template 571, beside the Sigil Stone.

**Salvage.** A Magic piece yields 1 shard, a Rare 3, a Legendary 8, an Exalted 15. Never an Aetheric piece (the
Broker's dismantle is its), an artifact, a quest's item, a worn, locked or bound piece. From the pack (the enhanced
card's button, as the Broker's Dismantle) and at the Mages Guild (both skins).

**The Reforge** - the Mages Guild's, a fourth row beside Identify. Pick a Magic or Rare piece (known, not worn) and
one of its lines; that line is rolled again from its tier's pool, never a kind or a param another line carries, a
Rare keeping its prefix and its suffix (so its name keeps both parts). The name and the price follow. Once a piece has
been reforged, only THAT line may be reforged again (`reforged`, the line's index). An Exalted Legendary's extra line
may be reforged too; a record's own lines never. The price: a Magic 2 shards and 100 gold, a Rare 4 and 400, an
Exalted 10 and 2,000.

## 12. LOOT10 - the codex, and the imprint

**The codex.** Every Legendary record - and every Aetheric piece - a character has TAKEN is in its codex, with the day
it was first found. The first find is said and heard (the HUD's line, the level-up's fanfare): *"Wyrmbane - a
Legendary! It joins your codex."* The Codex window lists all thirty and the Aetheric sets: a found record's name,
lore, lines, power and where it is found; an unfound one's place and its hint (*"Said to be carried by the
undead"*). It rides the character's save (a mod record).

**The imprint** - the Reforge's second row. A Rare (known, not worn, not already imprinted) takes the POWER of a
Legendary of its group from the codex: `imprint: '<record id>'`, its card says *"Imprint: Silent Death (of
Nightwhisper)"*, and the power works as the Legendary's does (once, law of LOOT5). It stays Rare (law 3). The price:
20 shards and 5,000 gold.

## 13. LOOT11 - a line of light over every find

A body or a pile holding a Rare or better stands a thin line of its best tier's colour - WBX3's form (a line out of
the find's top, never a beam beside it) through the gate spoils' own renderer (`render/spoilsGlow.js`: additive,
fogged, no light, no new program), a Legendary's and better pulsing. The nearest eight within 40 m, in the dungeon,
the street and a building; gone the moment its best is taken below Rare. A peer's body in the street shows none: its
list lives on its owner's side (the street's own law). Off, nothing draws.

## 14. The slices

| slice | what | shippable alone because |
|---|---|---|
| LOOT1 | a skill affix leans to the item's own skills | the roll alone |
| LOOT2 | the band on the line, Perfect, the Exalted | a display, and one roll after a Legendary |
| LOOT3 | twenty more Legendaries | records; the Test Room shows them |
| LOOT4 | five affix kinds that do things, and the kit | the kinds roll and work |
| LOOT5 | every Legendary a power | the kit reads the records |
| LOOT6 | signature drops | a weight on the record's pick |
| LOOT7 | champion foes | a source, and its guarantee |
| LOOT8 | the drought | a counter and a multiplier |
| LOOT9 | the Welkynd Shard, salvage, the Reforge | the shard and the guild's row |
| LOOT10 | the codex and the imprint | a record and a window |
| LOOT11 | a line of light over every find | a render pass |
| AUDIT LOOT | the whole arc, audited | - |
| LOOT7-CHECK | the champions checked: four fixed | - |

## 15. What shipped, slice by slice

### LOOT1 - a skill affix leans to the item's own skills (2026-10-01)

`systems/lootRarity.js`: `skillKin(item)` answers `{ own, kin }` - a weapon's own skill by `weaponSkillUsed` (the
skill that swings it, so a mod's weapon class and the Thunderlock answer their own) and the strike's three; the
body's twelve; the mind's thirteen. `pickSkill` is the one draw `rollAffixes` makes for a skill affix's param, and it
takes ONE roll, as the `pick(free, rolls)` it replaced did: the roll's place in [0, 1) chooses the step - under
`SKILL_OWN_SHARE` (0.5) the own skill when it is free, under `SKILL_KIN_SHARE` (0.85) a kin skill, else any free skill -
and the skill within it, each step's interval spread evenly over its list, a step with nothing free giving its interval
to the next. The rest of the ladder is the roll it was: the other kinds' params, the counts, the bands, the
prefix-and-suffix guarantee of a Rare.

**One roll, found the hard way.** The first cut drew the step and the skill with two rolls. Every seeded mint then drew
one roll more after a skill affix, and everything it minted after moved: the gate's spoils for a receipt (REALM P1.3's
two receipts no longer gave the same number of pieces - the Regalia's roll had moved), the Sigil Broker's day (SS5's
ware was no longer a pauldron), and a Masterwork's roll off its product's seed. The suite caught it; the one-roll draw
keeps every seeded mint's count of rolls, so only the skill a skill affix names has moved. A skill affix's WORD is its
band's alone ("of Practice", "of Skill", "of Mastery"), so no name moved either.

Measured over 1,500 seeded warhammer Rares (1,833 skill affixes): the own skill 0.519 of each piece's first skill affix
(a second skill affix on one piece can never be the first's skill), the hand's 0.875, a language 0.032 (it was 9 in
35, 0.257). Over 1,200 Rares each: greaves 0.891 to the body, an amulet 0.900 to the mind, a language 0.035 on either -
above the 0.85 because the open draw lands on a kin skill too, now and then.

Pinned: `test/loot1_kin.test.js` (6); `tools/mutants/loot1.json` (11, all dead).

### LOOT2 - the roll seen, and the Exalted (2026-10-01)

`systems/lootRarity.js`: `affixBand(item, i)` - the band line `i` was rolled in (a Magic's or a Rare's by its tier; an
Exalted Legendary's extra line - past its record's count - by the Legendary band; else null) - and `affixLine`, the
line as the card and the tooltip read it, `+18% damage [10-25]`; `rarityLines` prints every line through it.
`isPerfect` (a Rare, every line at its top) and `tierLabel` - the first line's words: "Exalted Legendary" (said while
the piece is still unknown - its pips say it anyway), "Perfect Rare" (only once it is read), else the tier.

`exaltLegendary(item, rolls)` exalts IN PLACE: a kind the piece's lines do not carry and its group may (Foxglove's
weight or skill), else - a record already carrying every kind its group may, as Wyrmbane does until LOOT4's kinds - a
kind with a param its lines leave free; the value from `ceil((lo + hi) / 2)` to the band's top; `exalted: true`; the
price `+ EXALTED_WORTH` (1,000) and the line's points. `rollExalted` is the one-in-ten (`EXALTED_PER_MILLE`, 100),
switch-gated, and it is taken in a door's LAST PASS (`lastPass(pieces, rolls)`), after everything the door already
draws: the host door (`rollLootRarity`, over every piece it laddered, the unique finds among them), the gate's spoils
(`gateSpoils.rollSpoils`, after the Regalia's roll), a town's thanks (`raidSpoils.rollRaidSpoils`, after the set
piece's). The first cut rolled it beside each piece, and a list's later pieces drew differently when an earlier one
was a Legendary; the last pass keeps every piece of a list its stream's. The Sigil Broker's `applyRarity` calls, the
item maker's Masterwork roll and the bounty board's Magic never reach it.

`exalted` is a declared item field (`itemFields.js`, a flag), so a forged `'yes'` is refused at the wire like a string
`enchantments`. The pack's frames wear `data-exalted` beside `data-rarity` (`enhancedInventory.js markItemFrame`) and
the Plus sheet's `rarityVarsCss` lays the Exalted's pips - three diamonds and a star, `EXALTED_PIPS` - after the five
tiers' rules. The Test Room's loot door adds one Exalted Legendary, known (LR's own pin counts it).

SET6's pin that the gate's earlier spoils are their seed's compares a piece's RECORD lines now (an Exalted's extra
line is appended after every draw) - the law it pins, every earlier draw the seed's, unmoved; LOOT2's own pin holds it
against the same seeds with the chance at zero, for the gate and a town alike.

Pinned: `test/loot2_exalted.test.js` (6); `tools/mutants/loot2.json` (20, all dead).

### LOOT3 - thirty Legendaries (2026-10-01)

`systems/lootRarity.js` `LEGENDARIES`: the first ten stand as LR2 shipped them, and twenty more follow them - twelve
weapons, ten pieces of armour, eight of jewellery in all. Every weapon template but the arrow, every armour place and
every kind of jewellery but the wand is NAMED by a record (a wand, as before, takes the three that name none:
Foxglove, King's Mark, the Archmage's Loop); every weapon family - by the skill that swings it - has two or more.

| record | lands on | its lines | its enchantment |
|---|---|---|---|
| Ansei's Edge | Broadsword, Saber, Longsword, Katana, Claymore, Dai-katana | +30% damage, +12 Agility, +25 Long Blade | Potent Vs: Humanoid |
| Tsaesci Fang | Tanto, Wakizashi, Katana, Dai-katana | +28% damage, +12 Speed, +25 Critical Strike | Cast When Strikes: Hand of Decay |
| Orsinium's Anvil | Mace, Flail, Warhammer | +32% damage, +12 Strength, +25 Blunt Weapon | Potent Vs: Daedra |
| The Glenmoril Bow | Short Bow, Long Bow | +28% damage, +10 Agility, +22 Archery | Potent Vs: Animals |
| The Direnni Staff | Staff | +20% damage, +15 Intelligence, +25 Destruction, +10 Willpower | Cast When Strikes: Magicka Leech |
| Gortwog's Cleaver | Battle Axe, War Axe | +36% damage, +10 Strength, +25 Axe | Vampiric Effect: when strikes |
| Worm's Tooth | Dagger, Tanto | +24% damage, +12 Intelligence, +22 Mysticism, +20 Backstabbing | Cast When Strikes: Energy Leech |
| Warp-Edge | Broadsword, Claymore, Dai-katana | +38% damage, +12 Luck, +22 Critical Strike | Cast When Strikes: Sphere of Negation |
| The Visor of King Lysandus | Helm | +16 armor, +12 Willpower, +40% Magic resistance, +10 Personality | Regens Health: in darkness |
| The Wayrest Courier's Treads | Boots | +12 armor, +15 Speed, +25 Running | Improves Talents: Athleticism |
| Gauntlets of the Rose | Gauntlets | +14 armor, +12 Strength, +25 Hand-to-Hand | Strengthens Armor |
| The Mountain's Root | Greaves | +16 armor, +12 Endurance, +40% carrying capacity | Increased Weight Allowance: 50% additional |
| The Raven's Wings | Left Pauldron, Right Pauldron | +14 armor, +12 Agility, +25 Dodging | Cast When Held: Slowfalling |
| The Night Mother's Embrace | Cuirass | +14 armor, +10 Agility, +25 Backstabbing, +20 Stealth | Cast When Held: Shadow Form |
| The Wall of Daggerfall | Kite Shield, Tower Shield | +18 armor, +12 Endurance, +40% Shock resistance | Repairs Objects |
| The Amulet of the Nine | Amulet, Cloth Amulet | +12 Willpower, +25 Restoration, +40% Magic resistance | Regens Health: in sunlight |
| The Witch-Sisters' Ring | Ring | +12 Intelligence, +25 Illusion, +40% Frost resistance | Extra Spell Pts: During New Moon |
| The Duelist's Vambrace | Bracer, Bracelet | +12 Agility, +10 Speed, +25 Critical Strike | Improves Talents: Adrenaline Rush |
| The Mark of the Hist | Mark | +12 Endurance, +45% Poison resistance, +25 Swimming | Cast When Held: Water Breathing |
| The Reachman's Torc | Torc | +12 Strength, +10 Willpower, +40% Shock resistance | Extra Spell Pts: Near Humanoids |

Their lore names the Bay's own: the Ansei sword-singers of drowned Yokuda, the Tsaesci, Orsinium's anvil and King
Gortwog, the Glenmoril witches and Hircine's hunt, the Direnni of the Adamantine Tower, the King of Worms, the Warp in
the West, King Lysandus and Cryngaine Field, Wayrest's couriers and its Knights of the Rose, the Dwemer's deep halls,
Camlorn's Order of the Raven, the Night Mother, the gate Daggerfall was named for, the Nine, a Glenmoril coven, Sentinel's
duels, the Hist, the Reach. No name takes one of DFU's 23 artifacts' (`loot.js` ARTIFACT_SUB_TYPE_NAMES).

Every record keeps LR2's law (`test/lr1_lootrarity.test.js` reads them all - its bases are every jewellery template
now, not the amulet and the ring it was written with, so a bracer's, a mark's and a torc's record are each shown to
land). A held spell is a cheap one - Slowfalling (240), Shadow Form (150), Water Breathing (170) - since DFU bills a
CastWhenHeld's casting cost in condition at the first equip (LR4's watch item 9); the first ten's Aegis of Dawn keeps
its Spell Resistance as LR2 shipped it.

What moved with the pool: the Sigil Broker's Legendaries are drawn from the thirty (`baseLegendaries` - the port's
own records, the same on every machine, so the stock is still the day's alone), and the gate's spoils and a town's
thanks pick from the thirty - one roll a pick, as before, so no seed draws more. The Thunderlock's own pin read a
dagger's pool as Wyrmbane and Nightwhisper alone; it reads Worm's Tooth beside them now (and a longsword's Ansei's
Edge), the gun's exclusive claim unmoved.

Pinned: `test/loot3_legendaries.test.js` (4); `tools/mutants/loot3.json` (10, all dead).

### LOOT4 - five affix kinds that do things (2026-10-01)

`systems/lootRarity.js`: five kinds join the six, marked `proc` - `elemental` (fire, frost, shock) and `slayer` (the
undead, daedra, humanoids, animals) and `leech` on a weapon, `thorns` on armour, `focus` on jewellery - each banded
Magic / Rare / Legendary as section 6 says, each a word (`Burning`, `of the Leech`, `Barbed`, `Adept's`, `of the
Gravewatch` ...) and a label (`+5 Fire damage`, `5% life leech`, `4 thorns`, `-6% spell cost`, `+15% damage vs the
undead`), each worth its points. They are NEVER in the ladder's own draw (`rollAffixes` draws the six numbers alone, so
every seeded mint draws as it did) and they NEVER name a piece (`nameAround` passes them by): a Magic keeps its one
word and a Rare its two, as LR1 made them.

**The roll.** A door's last pass (`lastPass`, LOOT2's) now gives every Magic one chance in five and every Rare 35 in a
hundred at ONE such line (`rollProcLine`, `PROC_PER_MILLE`; `addProcLine` mints it): a kind its group may carry and it
does not, its tier's band, appended after its numbers, the price with it. Every proc in the pass is drawn before any
Exalted, so neither moves the other's roll whatever a list's order. The gate's spoils and a town's thanks take them in
the same pass, after every earlier draw.

**What they do** - `systems/lootPowers.js` (new, the kit), registered at import under one name (`lootPowers`) and
imported by the game beside the sets' own (`scenes/world.js`, folded onto the sets' import line - line-neutral):

- the BLOW modifier: the slayer's per cents of the whole blow at its kind of foe (`foeGroup` - DFU's own four groups,
  `enemyEntityGroup`, a class foe a humanoid by its Human affinity), the fraction carried on the weapon (the sets'
  own law), and the elemental's flat sear - none on a foe IMMUNE to the element, half (floored) on one that RESISTS
  (`elementShare`, the career's own `careerTolerance`); the weapon IN HAND's lines alone.
- a STRIKE listener (the blow that landed, its final damage): the leech's share heals me, the fraction carried
  (`healMine`), never past my maximum and never a body.
- a LANDED-BLOW listener: the thorns I wear back to the foe whose blow took my health, summed under `THORNS_CAP` (25),
  through the foe's own pool's door. **One law of a blow**: `sigilSetPowers.js` now tells named listeners
  (`registerPlayerBlowLanded`) from inside its own hurt, at the moment Spite answers - the struck tail's mark, taken by
  the door as it opens (AUDIT FINAL F10), so a fall, a poison's round or a blow the door swallowed answers no thorn -
  and exports `pendingPlayerBlow`, the blow a hurt carries, for LOOT5's damage modifiers.
- a CAST COST modifier: the focus I wear off my spells, under `FOCUS_CAP` (30%).

Never at a player (a duel's blow refused by the blow modifier, a duel's blow at me never asking the port), never a
peer's blow resolved here, never the Warden's ward; off, nothing (`linesOf` reads none).

Pinned: `test/loot4_procs.test.js` (8); `tools/mutants/loot4.json` (26, all dead). LR2's six-kinds pin reads the six
numbers and the five after them; SET6's earlier-spoils pin passes the appended lines by.

### LOOT5 - every Legendary a power (2026-10-01)

`systems/lootRarity.js` `LEGENDARY_POWERS`: one power a record, keyed by its id (the records keep LR2's own shape; a
mod's record may carry its own `power`, and `powerOf` reads both) - a name, a brief inside CARD-FIT's 32 characters, a
sentence, a `kind` and its numbers. The card and the tooltip say it after the enchantment (`powerLine`, "Dragonsbane:
+50% vs dragons and giants"), the lore still last.

| record | power | what it does |
|---|---|---|
| Wyrmbane | Dragonsbane | Its blows deal +50% damage to dragonlings and giants |
| Nightwhisper | Silent Death | Its blows deal double damage to a foe that has not noticed you |
| Graveward | Sanctified | Its blows deal +40% damage to the undead, and each undead foe you kill while you wield it heals you 10% of your health |
| Stormcaller's Bow | Chain Lightning | Each of its arrows that lands arcs to the nearest other foe within 6 m, for half its damage as shock |
| The Warden | Last Stand | Under a quarter of your health, the damage you take is lessened by a quarter |
| Titanheart | Unyielding | No single hurt takes more than a quarter of your health |
| Aegis of Dawn | Dawnward | Each foe's blow that lands on you charges it; at five charges, the next foe's blow is turned aside whole |
| Foxglove | Fortune's Favour | While you wear it, every Legendary you find is half again as likely - its source's own chance, times one and a half |
| King's Mark | Tribute | Each foe you kill pays you 5 gold for each of its levels |
| Archmage's Loop | Spell Mastery | Your spells cost 15% less magicka, and 30% less while your magicka is under half |
| Ansei's Edge | Way of the Sword | Each of its blows that lands grants Flow for 6 s, up to five: +6% weapon damage a stack |
| Tsaesci Fang | Serpent's Kiss | Its blows carry 8 poison, twice that to a foe under half its health - none to a foe immune, half to one that resists |
| Orsinium's Anvil | Earthshaker | Each of its blows that lands shakes the ground: every other foe within 3 m takes a quarter of it |
| The Glenmoril Bow | Hunter's Moon | At night its blows deal +35% damage, and +35% more to animals |
| The Direnni Staff | Arcane Conduit | While you wield it your spells cost 20% less magicka, and each of its blows that lands restores 3 magicka |
| Gortwog's Cleaver | Orc Rage | While you wield it each foe you kill heals you 10% of your health, and under a third of your health its blows deal +30% damage |
| Worm's Tooth | Soul Siphon | While you wield it each foe you kill restores 15% of your magicka |
| Warp-Edge | Many Endings | Each of its blows that lands strikes again, one time in ten, for the same damage |
| The Visor of King Lysandus | The Ghost-King's Vigil | When a hurt leaves you under a third of your health, you are healed 20% of it. Recovers in 60 s |
| The Wayrest Courier's Treads | Courier's Haste | A kill fortifies your Speed by 20 for two magic rounds. Recovers in 10 s |
| Gauntlets of the Rose | Open Hand | Each of your bare-handed blows that lands strikes again for the same damage |
| The Mountain's Root | Bedrock | Each foe's blow that lands on you lessens the blows after it by 4% for 6 s, up to five times |
| The Raven's Wings | Raven's Evasion | A foe's blow is turned aside whole 15 times in a hundred |
| The Night Mother's Embrace | Sweet Mother's Kiss | Your weapon blows deal +50% damage to a foe under a quarter of its health |
| The Wall of Daggerfall | Bulwark | Each foe's blow on you is lessened by 5 points, never under 1 |
| The Amulet of the Nine | Divine Grace | Damage that would kill you leaves you standing, healed a quarter of your health. Recovers in 180 s |
| The Witch-Sisters' Ring | Hex | A foe whose blow lands on you is hexed for 8 s: its blows on you are lessened by a quarter |
| The Duelist's Vambrace | First Blood | Your first weapon blow on each foe deals +60% damage |
| The Mark of the Hist | Hist-Sap | Each magic round you regenerate 2% of your health, 4% while you are under half |
| The Reachman's Torc | Hagraven's Pact | A Destruction spell that strikes you is absorbed 15 times in a hundred, as Spell Absorption is |

**Who.** `systems/lootPowers.js` `wornPowers(entity)`: MY entity's worn pieces - a Legendary's record (a piece that is
a Legendary; an id on anything else wakes nothing) and, from LOOT10, a Rare's imprint - ONE entry a power, however many
pieces carry it. A WEAPON's power rides that weapon's own blows (`blowPowers`: the one that struck); the rest of it
while it is wielded; armour's and jewellery's ride every blow of mine, my fists' too. Asleep in a duel (the sets' own
word, `setsDueling`), nothing with the switch off, and offline as online.

**Through which seam.** The blow (bane, unaware - the host's own word that the foe had not noticed me -, sanctified,
flow's stacks, venom's poison under the element's law, the moon by the world clock's night, rage, the execution, first
blood); the landed strike (chain - a bow's, the nearest other foe within 6 m, shock under its law -, quake - a melee
blow's, every other foe within 3 m -, echo, the open hand, the conduit's magicka, flow's stack); the landed foe's blow
(Dawnward's charge, Bedrock's stack, the Hex on the foe that struck); MY damage door's modifier (a foe's blow - the
sets' `pendingPlayerBlow` - turned aside whole by Dawnward's five charges or the Raven's 15 in a hundred, lessened by
its Hex, Bedrock and Bulwark; any hurt by the Last Stand under its line and Unyielding's share at most), its death
save (Divine Grace, its heal told after the door leaves me at 1) and its hurt listener (the Ghost-King's Vigil); my
kill (Sanctified's and Orc Rage's heal, Soul Siphon, Tribute, Courier's Haste - the city watch and an ally never
count, the sets' own law); the cast price (the Direnni Staff, the Archmage's Loop, beside LOOT4's focus - all of it
at most `SPELL_CUT_MOST`, 50%); the absorption roll (Hagraven's Pact); the magic round (Hist-Sap, and "ready again");
the host door's FINDER (`lootRarity.js registerLegendaryFind` - Fortune's Favour times the source's own Legendary
threshold, past its cap but never past the Rare threshold; `rarityChances` takes `find`, the host door reads
`legendaryFindMult` once a list). The reach powers spare an ally or a foe at peace, a foe a storey away and one behind
a wall, as Cleave and the Nova do.

**Seen.** `lootHudChips` - Flow's and Bedrock's stacks, Dawnward's charges, a recovery running - beside the sets' chips
(`scenes/world.js` hands the HUD both, line-neutral), in the Legendary's orange (`ui/enhancedHud.js`).

**What it moved.** SET5's pin on the HUD's wiring reads both lists; five mutant records whose anchors the arc's edits
moved were re-aimed by content (DISC29-B's unguarded name, SET3's import and its fall, SET5's chips, LOOT4's focus
cap) and still die (`test/mutantdrift.test.js`).

Pinned: `test/loot5_powers.test.js` (7); `tools/mutants/loot5.json` (38, all dead).

### LOOT6 - signature drops (2026-10-01)

`systems/lootRarity.js`: `FOE_FAMILIES` groups the foe table in eight - the **undead** (15, 17, 18, 19, 23, the two
vampires 28 and 30, the two liches), the **daedra** (the five Daedra, the four atronachs, the imp and the gargoyle),
**dragons** (the two dragonlings), **beasts** (the animals, the werecreatures, the spriggan, centaur, nymph and harpy,
the slaughterfish, dreugh and lamia), **brutes** (the four orcs and the giant), and the class foes by their own teams
and magic - **casters** (Mage, Spellsword, Battlemage, Sorcerer, Healer, Nightblade), **rogues** (Bard, Burglar,
Rogue, Acrobat, Thief, Assassin) and **warriors** (Monk, Archer, Ranger, Barbarian, Warrior, Knight, the watch). Every
foe of the table is in one, the horse in none (`foeFamily`). `DUNGEON_FAMILY` gives each of DFRegion's nineteen
dungeon kinds its family or none (a Mine is no one's). `LEGENDARY_FOUND` names where each of the thirty is found -
the undead four, the daedra three, dragons two, beasts four, brutes three, casters four, rogues four, warriors six -
and `foundAmong` reads a mod's record's own `found` too.

**The pick.** `pickLegendary(pool, family, rolls)` takes ONE roll, as LR1's `pick` did: with no family it is exactly
`pick`'s index for the same roll; a source's family weighs its own records `SIGNATURE_WEIGHT` (5) to one.
`applyRarity` takes `{ family }`; the host door hands its source's family on; `corpseSource` reads a foe's mobile
type (`rollCorpseLoot` hands `entity.mobileType` - LR4's one corpse door); a dungeon's treasure pile names its
kind's family (`scenes/dungeonContext.js`, line-neutral). The gate's spoils, a town's thanks, the Broker and a
Masterwork name none, so they pick as they did - SET6's earlier-spoils pin unmoved. WHETHER a Legendary drops is
the tier's alone: `rarityChances` reads no family.

Measured: a vampire's two pieces (a dagger, whose pool holds no undead record, and a battle axe, whose pool holds
Graveward beside Wyrmbane and Gortwog's Cleaver) gave the undead's own over a quarter of their Legendaries in 3,000
seeded kills - a third of the axe's would be the even pick; five sevenths is the weighed one.

Pinned: `test/loot6_signatures.test.js` (4); `tools/mutants/loot6.json` (11, all dead). LR1's corpse-source pin
reads the family (null without a type), and its four-hosts pin the pile's.

### LOOT7 - champion foes (2026-10-01)

`systems/champions.js` (new): the five traits (`CHAMPION_TRAITS`, in the wire's order - each name its id
title-cased, so the two leaves that cannot import it spell it the same), `applyChampion` (on the entity, before its
loot: twice its health - the Stalwart half again more - its blows a quarter harder MULTIPLIED onto whatever
`damageScale` it has, so an elite's double stands under it - the Mighty half again more - and the Swift's thirty
Speed, capped at 100; never under level 3, the watch, an ally, or off), `championName`, and the two traits that
answer a blow on SET2's seams: the Vampiric (the struck tail: half of a blow that reached me heals it, never past its
maximum) and the Thorned (the strike tail: a seventh of my blow that landed on it, through `hurtPlayer` - my one
damage door, so a shield, a ward and a death save see it as any hurt; never a peer's blow, never an ally's).

**Who.** A dungeon's: `markDungeonChampions` marks the layout's records by an FNV hash of the location id and the
marker's index - one in fourteen (`CHAMPION_PER_MILLE` 70; CHAMP-RATE, was 50), its trait from the hash's high bits - so every client
stands the same champions with no wire word, and a mark rides its record through a rebuild. Every build arm of
`applyEliteScaling` stands it, an elite dungeon's onto the elite's scaling. A quest's foe is never in the layout. The
street's: an ordinary encounter's foe (`capped` - never a quest's, a summons, a placed camp's or a replacement) is
`rollStreetChampion`'s - the same mixer over where it stands, its type and the pool's count of them, NEVER a draw:
the pool's stream (its loot, its kit) draws as it did, and a seeded test's street stands the same foes every run
(the row is on by default, so a draw would have made every street pin a one-in-twenty flake). The foe
record carries the trait (`cp`, `net/wire.js` `validFoeRecord`, at most `CHAMPION_TRAIT_MAX`; RELAY_VERSION
**world139** since the merge with main - world138 on the branch, main's HERALD took world138 first - NOT YET DEPLOYED;
a relay before it strips the field and a peer's puppet of a champion stands as an ordinary foe, the owner's health
word still ruling it); a puppet and an heir's adoption stand the same champion; a
save keeps it (`champion` on the pool's record) and a load stands it again, never rolled. The gate's Warden is the
relay's and never a pool foe.

**Its name** is the trait's and its own - `Mighty Orc` - on the hover over it alive (`worldTooltips.js`
`liveEntityName`, every pool's one namer), the HUD's target bar (`ui/hudFoeTarget.js`), its body (both pools) and
its death line (`corpseMarker.js` `sayEnemyDied`). LOOT7-CHECK (section 17) found two of the four untrue as
shipped - the hover never named a HOSTILE champion (the plaque's own law) and no dungeon death was ever said - and
fixed both.

**Its loot.** `rollCorpseLoot` reads the mark: a champion's corpse door is the plain door with `CHAMPION_SOURCE`
(four tiers, quality x1.5). Then `scenes/hostCombat.js` `ensureChampionLoot`: when its own roll found no Rare or
better, its most valuable piece that could be (a plain one, or one the ladder made Magic) is made Rare; carrying
none, a weapon (never ammunition) or a piece of armour at the player's level is minted onto it and made Rare - all
off the spawn's own stream, after every draw before it. Never its worn kit (LR4's law). LR3's drop chime already
rings over a body carrying a Rare, so it rings at every champion's fall.

**What moved from the design.** "It moves a third again as fast" read DFU's motor wrong: an enemy's speed is
(Speed + 150) x the scale (`enemyMotor.js` `enemyMoveSpeed`), so the Swift's thirty Speed is about a seventh faster
on foot - and its attack roll (`attackRollPasses`) passes likelier. The table says what it does. The Thorned answers
any blow of mine that lands (a bare hand's too), not a weapon's alone - the strike tail's own law.

**Along the way.** LOOT6's `pickRecord` shared its name with `world/underwaterDecorations.js`'s, past audit24's
one-home ratchet: renamed `pickLegendary`. WORLD8's pile pin read LOOT6's family. The relay's version pins re-chained
("LOOT7 moved it on last (world138 ...); KEPT-KILL moved it on (world137 ..."), soc1.json's S38 and BOUNTY1 B4.

Pinned: `test/loot7_champions.test.js` (7) - the traits, the dungeon's marks (about one in twenty, golden marks for
two locations so a client on another build cannot stand others), the street's hash (never a draw; golden for one street) and the record, the scaling and
its refusals, the name in all four places, the two traits on their tails, the guarantee over 600 seeded kills of an
orc, a rat and a Fire Daedra, its most valuable piece, the mint's mix, and the corpse door against the boosted source
seed by seed; `tools/mutants/loot7.json` (50, all dead).

### LOOT8 - the drought (2026-10-01)

`systems/lootDrought.js` (new): the character's DROUGHT - one more for every piece taken below Legendary, none again
when a Legendary or better is taken. `droughtMult` - `1 + 0.2 x floor(drought / 25)`, at most x3 - is a FINDER
(LOOT5's `registerLegendaryFind`), so at every door that ladders a list (`rollLootRarity`: a body, a dungeon's pile, a
house's, a camp's) it multiplies the Legendary threshold beside Foxglove's, and `rarityChances` keeps the product under
the Rare threshold. Off, it answers 1.

**Counted at the take, once.** A source door marks every piece it ladders `untaken` - whatever tier it rolls, a unique
find too (never its ammunition, never gold or an arrow) and a champion's minted piece - a declared item field
(`itemFields.js`), so the mark rides a save, a body's record and a peer's grant. `inventory.js` gains the one TAKE seam
(`registerTakeListener`/`tellTaken`), told by both ways a piece reaches the pack from a container: the loot window's
and quick loot's (`itemTransfer.js` `applyTransfer` into the pack) and a body's bulk take and a peer's grant
(`takeOneInto`). The drought's listener counts a marked piece and clears its mark - so a piece dropped and taken again
counts nothing, and neither does a shop's, a quest's, a crafted piece or anything else no door rolled. Online, the
first player to take a piece counts it, whichever client rolled it.

**The record**: a mod record (`LootDrought`, `systems/modSaveData.js` - the Broker's way): a whole count, at most
`DROUGHT_MAX` (100,000); a forged one is none, a new game none. `world.js` imports the module beside the sets' powers,
so the finder and the listener stand in the game.

**What moved from the design.** "A piece is counted once a session" became once EVER: a list of this session's pieces
cannot follow a piece across the wire (a room re-sends a container as new records, so a piece dropped into a shared
chest and taken again would have counted every time) - the mark on the piece itself can.

Measured: 4,000 seeded tier-8 corpse rolls gave 42 Legendaries with no drought, 51 at 25, 78 at 100 and 127 at 250
(the threshold 10.6 per mille to 31.8, still under the Rare's 63).

Pinned: `test/loot8_drought.test.js` (7) - the multiplier and its cap, the finder (off 1), the mark on every eligible
piece of 60 seeded piles (never gold or arrows; none off; it rides the wire, a forged one refused), the take (once; a
Rare one more, a Legendary none, the ceiling; unmarked, gold and off nothing), every take seam (into the pack, never
out; a throwing listener never stops a take; the body's bulk take), the record (save, load, forged, a new game), the
doors in play (sixty bodies taken, sixty counted; three times the Legendaries at 250), and a unique find's mark;
`tools/mutants/loot8.json` (31, all dead).

### LOOT9 - salvage, and the Reforge (2026-10-01)

**The Welkynd Shard** (`systems/gateSpoils.js`, template 571 beside the Sigil Stone's 570): `WELKYND_SHARD_TEMPLATES`,
a gem's row that stacks with its own kind alone and is BOUND - so itemBound.js's whole law holds it (never sold, traded,
dropped or listed) and the realm's service refuses it too (`net/realmTradeLaw.js` `BOUND_TEMPLATES` now `[570, 571]`,
AUDIT REALM F1's pin reading the new row). The Sapphire's art (TEXTURE.254 record 2). `welkyndShards(n)` mints a stack.

**`systems/reforge.js`** (new) holds every law the faces call:
- SALVAGE: `salvageShards` - a Magic piece 1, a Rare 3, a Legendary 8, an Exalted 15 - by the piece's own `rarity`
  field, so only what the ladder GRADED breaks (a Common, DFU's own magic items and a made piece are worth none: shards
  come from what was found, never bought). `salvageRefusal` - 'off', 'aetheric' (the Broker's dismantle is its),
  'artifact', 'quest', 'not', 'bound', 'worn', 'locked'. `salvagePiece` - the piece out, its shards onto the pack's
  unlocked stack (addItem: never a locked one), all of it or none of it.
- THE PURSE: `shardsHeld` counts the unlocked stacks (a lock is the player's word to keep them); `spendShards` takes from
  them, an emptied stack out, nothing when short.
- THE REFORGE: `REFORGE_PRICE` - a Magic 2 shards and 100 gold, a Rare 4 and 400, an Exalted 10 and 2,000;
  `reforgeRefusal` ('off', 'not', 'unknown' - the guild identifies it first, 'worn', 'line', 'shards', 'gold');
  `reforgePiece` - the line rolled, then paid: the shards, then the gold through `court.deductGold` (DFU's
  purse-then-letters law, so a letter of credit pays); nothing taken when refused.

**The roll** (`lootRarity.js`): `reforgeableLines` - a Magic's or Rare's every line, an Exalted Legendary's own extra line
(its last, as exaltLegendary appends it), never a record's; once reforged (`reforged`, a declared item field - the
line's index, 0-15), that line alone. `reforgeAffix` rolls it again from its tier's pool - never a kind (nor a param of a
kind with params) another line carries; a line that DOES something (LOOT4) stays one and a number stays a number; a
Rare's line keeps its slot, so its name keeps its prefix and its suffix; an Exalted line from the top half of the
Legendary band, as its exalting rolled it. The same kind may come back with its value rolled again. The name (a Magic's
or a Rare's - a Legendary keeps its record's) and the price follow (the price by the two lines' worth, so a sigil's or a
set's share stays).

**The faces.**
- THE WINDOW (`ui/reforgeWindow.js`, a lazy chunk; `ui/reforgeDoor.js` its door, the Broker's shape): two pages over the
  player's own pack - REFORGE (every piece the Reforge takes, a row in its tier's frame; the piece whole beside the list,
  each line it may roll carrying its own press with the price on it, or why not in a word - "Need 3 more shards", "Not
  identified"; an unidentified piece's lines never shown) and SALVAGE (every graded piece that will break, its yield,
  and a press that asks first - "Break it" / "Keep"). The purse and the last word stand in the header. Its rows wear the
  Broker's own classes, so both skins dress it as they dress his.
- THE MAGES GUILD (`scenes/worldModes.js` `openGuildService`): the Identify NPC's popup carries a `reforge` hook (the
  Mages Guild's group, the Identify service, the row on) - a dispatch, as a service's is. On the Enhanced Plus face
  (`ui/enhancedPorts.js`) it is a row beside the service; on the classic popup (`ui/guildServiceWindow.js`) a port-drawn
  row UNDER DFU's 130x51 panel (`REFORGE_RECT`, its key F, its click the ButtonClick its four sisters play).
- THE PACK CARD (`ui/enhancedInventory.js`): Salvage beside the Broker's Dismantle, for a graded piece that will break
  and is not worn, asked first in the dismantle's own question slot (Keep, N, Enter, Escape or a press outside keep it).

**What moved from the design.** "At the Mages Guild (both skins)": the salvage's guild face is the Reforge's window, which
both skins reach through the Identify NPC's fourth row; the pack card's button is the enhanced pack's (the classic pack
has no card). "A fourth row beside Identify": the classic popup's art has three rows and Exit, so the fourth is the
port's own strip under it.

**Along the way.** Five mutant records whose `old` the new code doubled (AUDIT SS's question, SS1's Stone row) kept
their one site - the Salvage's question wears its own lines, the shard's row its own order; AUDIT REALM F1's record
re-aimed to the two-row list; F141's click roster counts the fifth; UI.md counts 270 modules, Systems.md 339.

Pinned: `test/loot9_reforge.test.js` (9) - the shard (its row, bound, stacking, at least one), salvage (the yields, every
refusal, all or nothing, a locked stack never joined, off), the purse, the lines (and the mark on the wire, a forged one
refused), the roll over 600 seeded pieces (never a carried kind, a proc a proc, a Rare's slot and name, the name and the
price, the same kind back and another), the price and the press (refused with nothing taken, paid shards then gold, a
letter of credit paying, once reforged only that line), the window (both pages, an unknown piece's card, a press, the
ask), the guild's fourth row (classic click and key, no hook no row, the Plus face, the host's hook), and the pack
card's Salvage; `tools/mutants/loot9.json` (52, all dead).

### LOOT10 - the codex, and the imprint (2026-10-01)

**`systems/lootCodex.js`** (new): the character's CODEX - every Legendary record and every Aetheric piece taken, with
the world's day it was first found (`worldTick.js` `worldMinutes`, a shared realm's clock online). `codexKey` names
what a piece is to it (a Legendary's record, an Aetheric piece's - never a Rare, never an id the tables do not hold).
`noteFind` puts a piece in it once: the first find is said on the HUD's line - *"Wyrmbane - a Legendary! It joins your
codex."* - and heard (the level-up's fanfare, `SOUND.LevelUp`).

**How a find is seen.** A piece taken from a body or a pile is told at the take (LOOT8's seam in `inventory.js`);
everything else that reaches the pack - a gate's spoils, a town's thanks, the Broker's wares, a trade - is swept up at
the next magic round (`worldTick.js` `registerMagicRoundHook`: the player's own pack and what it wears). A save that
carries no codex is handed NewSaveData (modSaveData.js - SaveLoadManager's law), which the codex marks `fill`, so the
first sweep takes in what the character already carries WITHOUT a word; a new game has its own door and is empty.

**The record**: a mod record (`LootCodex`) - each kind a map of ids the tables hold to whole days; an unknown id, a
negative day or a fraction is dropped, and junk is none.

**The page.** The Reforge's window gains its third and fourth pages (`ui/reforgeWindow.js`): IMPRINT (below) and CODEX -
the thirty in the table's order, a found record whole (its lines, its power, its lore, the day), an unfound one by its
group and where it is said to be (`FAMILY_HINT`, by LOOT6's family - *"Said to be carried by the undead"*), then the
Aetheric sets piece by piece. The pack opens the Codex alone (`ui/enhancedInventory.js`: a Codex button in its header
while the row is on - the same window, its one page, no tabs).

**The imprint.** At the Reforge, a Rare (known, not worn, not imprinted already) takes the POWER of a found Legendary of
its own group (`imprintChoices`) for 20 Welkynd Shards and 5,000 gold (`IMPRINT_PRICE`; `imprintRefusal` - 'off',
'not', 'unknown', 'worn', 'imprinted', 'unfound', 'shards', 'gold'; `imprintPiece` paid then made, nothing taken when
refused). It stays Rare (law 3). `imprint`, a declared item field, is the record's id; LOOT5's `wornPowers` already
read it, so the power works as the Legendary's does (one of each power, whatever carries it). Its card says so
(`lootRarity.js` `imprintLine`, in `rarityLines`): *"Imprint: Silent Death (of Nightwhisper) - +100% to a foe
unaware"*. The wire refuses a forged one (`validImprint`, in `loot.js` validLootItem): an imprint only on a Rare, of a
record of its own group, with a power.

**What moved from the design.** "The Codex window" is the Reforge's window's Codex page - one window, opened from the
pack anywhere and from the Mages Guild beside the Reforge.

**Along the way.** PACK-PHONE's header pin reads the Codex before Body (Body still beside Close); nine struck-row cites
moved by hand, the rest by tools/citeShift.mjs.

Pinned: `test/loot10_codex.test.js` (7) - a find (its key, said and heard once, the day, off nothing), how a find is
seen (the take, the round's sweep of the pack and the table, an old save filled silently and the next find said, the
game's import), the record (saved, restored, cleaned, junk, a new game), the page (the thirty, a found one whole and an
unfound one's hint, the sets, the count), the imprint (choices of its group, every refusal with nothing taken, paid,
once, its card, its power worn), the wire (a forged imprint refused), and both pages in the window with the pack's
button and the guild's hook; `tools/mutants/loot10.json` (40, all dead).

### LOOT11 - a line of light over every find (2026-10-01)

**`scenes/lootLines.js`** (new): `pickLootLines` - a find (`{ root, items }`) stands a line when its BEST piece is Rare
or better (lootRarity.js `bestRarity`), in that tier's colour; the nearest `LOOT_LINES_MAX` (8) within
`LOOT_LINES_REACH` (40 m) of the eye, nearest first; the list read live every frame, so a find goes dark the moment its
best is taken below Rare; off, none. `createLootLines(gl)` is the pass - WBX3's line through the spoils' own renderer
(`render/spoilsGlow.js` SpoilsGlowRenderer: additive, fogged, depth-tested, no light, no new program), a Legendary's and
better pulsing - and asks for its finds only while the row is on, so an off frame gathers nothing. `lootCrown` roots each
line at its sprite's crown: a billboard is bottom-anchored (render/bounds.js), so its feet and its height
(`LOOT_LINE_CROWN`, 0.6, for one whose art has not landed).

**The finds** - each pool says its own (`lootFinds`):
- THE STREET (`scenes/exteriorFoes.js`): my own searchable bodies - never a peer's (its list lives on its owner's side,
  the street's own law) - and the piles put down (`scenes/droppedLoot.js`).
- A BUILDING: its treasure piles (`seedInteriorTreasure` seeds them into the interior's dropped-loot pool) and the bodies
  of its foe pool (the street pool's kind).
- THE DUNGEON (`scenes/dungeonContext.js`): a searchable body (`lootableBody` - the room's, whose list the room's record
  keeps on every client; never a party member's own), its treasure piles (rolled at the build) and what was put down.

**The passes.** `world.js` builds the one pass (`createLootLines(renderer.gl)`), draws the street's after the gate's
fire with the same eye and fog, and hands the modes `drawLootLines` (scenes/worldModes.js: the dungeon arm's after its
billboards, the interior arm's after its characters - each in the air the renderer set for it).

**Along the way.** The world host's foreign-pass counts read the two new seams (AUDIT 39r, EV6, EV8, PERF2: 17 and 22);
INVIS-LOOK's building order keeps the veiled bodies right after the last opaque draw (the lines follow them); `lootCrown`
for a name the naval ships already used; 194 cites shifted and 26 struck ones by hand.

Pinned: `test/loot11_lines.test.js` (4) - the pick (the best tier, the nearest eight within 40 m, gone below Rare, the
malformed skipped, off none), the pass (the crown, the renderer's own calls - its roots and its pulse - the finds never
gathered off, no context no pass), the finds (a pile put down, the street's bodies never a peer's, the dungeon's bodies,
piles and drops), and every host's pass; `tools/mutants/loot11.json` (15, all dead).

## 16. AUDIT LOOT - the whole arc, audited (2026-10-01)

Mac: *"let's do a deep comprehensive audit on this and ensure it's perfection"*. Seven lanes read the arc end to end -
the depth (LOOT1-3: the lean, the bands, the Exalted, the thirty), the powers (LOOT4-5 and the champions' traits, every
seam), the chase (LOOT6-8), the loop (LOOT9-11), online (the item's four fields, the relay's `cp`, the mod records, the
seeded doors' draws), the bible against the code, and the screens and keys. Nine findings are fixed; one is stated.

- **F1 - an imprint offered a power its piece could not use.** Chain Lightning arcs off an arrow and Earthshaker shakes
  off a melee blow (LOOT5's own seams), and the imprint offered both to every Rare weapon: a sword took the arc for 20
  shards and 5,000 gold and it never fired. `lootRarity.js` `powerFits` - the arc on a weapon of the Archery skill (a
  bow, the Thunderlock), the quake on any other weapon, every other power on any piece of its group; `imprintChoices`
  offers no other and the wire (`validImprint`) takes no other.
- **F2 - a made piece broke for shards.** A Superior's and a Masterwork's quality roll is the ladder's own `rarity`
  (Professions' law 7), so a Masterwork Rare salvaged for 3 shards - a bench turning ore into the Reforge's coin, against
  LOOT9's own word (shards come from what was found). `reforge.js` `salvageShards` is 0 for a piece with a
  `provenance`, so the pack card offers no Salvage on one and the Salvage page lists none.
- **F3 - a reforged or imprinted made piece could be listed.** The market mints a crafted piece again from its record at
  the other end (AUDIT 30 C2's `smithItems.js` `asMinted`), and the record mints neither a reforged line nor an imprint:
  the buyer had a piece without them, and the seller had paid for them. `asMinted` says no to either, as it does to an
  enchanted piece.
- **F4 - a weapon's power rode one hand.** A Legendary in one hand and a Rare imprinted with its power in the other are
  one entry (a power counts once), its piece the first the equip table lists; `blowPowers` let the other hand's blows
  ride it only when that hand held a Legendary of the record, so the imprinted Rare's blows rode nothing. The ids a
  piece carries are one helper (`lootPowers.js` `powerIds` - a Legendary's record, a Rare's imprint, nothing on anything
  else), read by `wornPowers` and `blowPowers` alike.
- **F6 - the Reforge's window was laid as the Broker's alone.** Its own classes had no rule: the Codex's rows of words
  fell into the Broker's 48px picture column (every name an ellipsis), the salvage's Keep into the next row's (on a
  phone it sat exactly on Break it - the Broker's phone rule spans every press over two rows), a hint was cut on a
  phone, the tabs said no page, and a card's line pushed its press a full width under it. `enhancedPlusStyle.js`
  `REFORGE_CSS`: the Plus sheet carries it, and on the classic skin the window lays it beside the Broker's sheet under
  its own id (`reforge-skin-style` - the Broker's window may have laid his first); the chosen tab is the kit's brass
  `.on`. The imprint's card is its own: the tier's line first (its first choice wore the header's dress, uppercase and
  small), its presses say Imprint (they said Reforge - `reforgeLabel`'s verb) and are said (`aria-label`), as the
  Reforge's are. Measured on Chromium at a desktop and a phone, both skins: a Codex name 922px of its 944px row, a
  phone's Keep its own row under Break it.
- **F7 - Back with the Codex over the pack closed the pack.** The pack's capture listener was laid first and heard every
  key: Back put both away, and the pack's Inventory key left the Codex standing over the world. The pack yields while
  the Codex stands (`ui/enhancedInventory.js` `onKey`, `reforgeDoor.js` `reforgeDoorOpen`): Back puts the Codex away and
  keeps the pack, as the Info box's does, and no other key reaches the pack under it.
- **F8 - the thirty-first Legendary had no power, and the codex took it and never listed it.** The Thunderlock's own
  record, *The Last Lock* (registered by `systems/thunderlock.js`, `exclusive` to the gun), is found as a Legendary and
  was said ("It joins your codex") and counted - "3 of 30" with two rows found - but never shown, and it was powerless
  against section 7's own title. It carries **Dwemer Defiance** - +50% vs daedra and atronachs, its shots at the daedra
  family (LOOT5's bane; the Dwemer knelt to none of them) - and its own codex hint ("Said to turn up anywhere, once in a
  great while": a unique find of no family). The codex lists every record the tables hold (`allLegendaries`), a record
  of no family saying its own `hint`, its count the rows'; the imprint offers any found record.
- **F9 - a champion's Rare never took the last pass.** `scenes/hostCombat.js` `ensureChampionLoot` makes its Rare after
  the corpse door's last pass, so the one Rare most champions carry never had LOOT4's chance at a line that does
  something. It takes the pass now (`lastPass`) - the spawn's last draws, after every draw before them.
- **Stated - the Vampiric drinks on its owner's side.** A peer's champion's blow on me resolves on my side (WORLD6b-ii)
  and its drink lands on my copy of the foe, which its owner's next health word overwrites: against a champion another
  player holds, the Vampiric's heal is lost. Carrying it would take a heal on the relay's hit word, a relay of its own
  for one trait's half-blow.

**Read and sound.** The families against DFU's MobileTypes and DungeonTypes, and the bane's career index (a class foe's
is its class's, so the Human guard); the seeded doors - the gate's spoils and a town's thanks take the last pass after
the Regalia and the set piece, the Broker's `applyRarity` and a Masterwork's roll never reach it, `pickLegendary` and the
lean are one roll each; the Exalted's pool holds the proc kinds (section 6's Legendary band is the Exalted line's); the
drought counted once at the take and none in a new game; the codex's silent backfill; `cp` bounded by
`CHAMPION_TRAIT_MAX` (world139); the four item fields declared and the Broker's wares bound (no salvage); the guild
popup's F free of DFU's four letters; the lines' finds never a peer's street body.

Pinned: `test/auditloot.test.js` (8), driven where it can be - F1 the fits, the choices and the wire; F2 a Masterwork's
and a Superior's piece refused with nothing taken; F3 a reforge and an imprint off the market; F4 both hands, either
order; F6 the sheet's rules (a phone's Keep), both skins' sheets (the classic's beside the Broker's), the brass tab, the
imprint's card (its tier's line, its word, said);
F7 the pack and the Codex over it, keyed; F8 every record's power, the Last Lock's shots, its row and the count; F9 a
minted and a promoted champion's Rare. `tools/mutants/auditloot.json` (30, all dead). LOOT10's page pins read every
record; seven records in `loot5.json` and `loot10.json` re-aimed by content (`powerIds`, `powerFits`, `allLegendaries`).

**THE MERGE with main (PATREON-LINK + HERALD, #505).** Main's HERALD took world138 first, so the merged relay is
**world139** - LOOT7's `cp` beside HERALD's word (the law's row, its hash over the merged bundle; every version pin
re-chained "LOOT7 moved it on last (world139 ...); before it HERALD moved it on (world138 ...)", HERALD's own pin,
disc7's list, soc1.json's S38 and BOUNTY1 B4). HERALD's account service (acct45) needs a relay that knows its word -
world138 or world139. REL6 (#503, Mac: "Remove patch notes from the codebase"): the arc's player notes ride its pull
request, never a file in the tree; GROWTH1's caps (#503): the Loot rows say what each file pins now, in at most 1,000
characters, and the arc's Active-Arcs entry stands in 700, so the branch lands the same either side of it.

## 17. LOOT7-CHECK - the champions checked (2026-10-01)

Mac: *"I want to check and see if the special enemy types from our recent loot commit is working properly"*; then, the
check read back, *"Yes and fix the smaller things. Just want this to be as detailed as possible"*.

**What was driven.** The arc's own suites (loot7, auditloot, LR1, RF2, LOOT4, LOOT6, LOOT8, LOOT11 - 62 tests) were
green, and half of LOOT7's pins read the source; so every trait was driven through the REAL combat formula
(`calculateAttackDamage`, its struck and strike tails) on a real orc (`makeEnemyEntity`, ENEMY_BASICS row 7): the
Mighty's blows 2.05 times a plain orc's over 3,000 seeded blows (1.875 by the table - the rest is small blows rounded
up, `Math.max(1, Math.round(d x 1.875))`); the Stalwart three times the health; the Swift's Speed 50 -> 80 and its walk
5.0 -> 5.75 (`enemyMoveSpeed`, about a seventh, as section 15 says), read live by both motors and both attack clocks
(`liveStat(entity, 'speed')`); the Vampiric healing 0.55 of what it dealt and the Thorned returning 0.177 of mine (a
half and a seventh, each at least 1 a blow - the floor is what lifts both on small blows). Who stands, the wire's
`cp`, the save and the load, the guarantee and the corpse door's stronger source read sound, and the relay that carries
`cp` is live (the relay deploy on main's head, #510, passed). Four things were not:

- **CORPSE-FIND - no body ever kept its unique find.** `lootRarity.js` `rollCorpseLoot` (LR4) rolls a COPY of the
  body's list - the carried pieces, the worn kit cut out - and `rollLootRarity` pushes the door's unique find onto the
  list it is handed: the Dwarven Thunderlock and its pellets landed on the copy and went with it. 0 of 20,000 level-12
  champions' bodies kept one where the list door, on the same seeds, kept 111 - against `05-Combat/Dwarven-Thunderlock.md`'s
  own table ("tier-4 corpse, about 1 in 700"); a champion's body, its source four tiers up and so always past the
  find's tier 4, was where it was likeliest. What the roll added past the carried pieces goes onto the body now (a
  body with no list is given one). The piles were never touched: each hands the door its own list. RF2's boss pin had
  passed only because of it - with every roll at its floor the body keeps the Thunderlock and its pellets now, and a
  pellet is ammunition, which the ladder never promotes: the pin's claim is the eligible pieces' (`isAmmunition`), as
  its arrow exemption already said.
- **CHAMP-HOVER - a fighting champion was never on the plaque.** (RETIRED 2026-10-03 by HOVER-PLAIN, Mac: "remove the
  crosshair tooltip. They should only have names/modifiers under their healthbar" - no hostile foe is named on the
  plaque again - while it fights its title is the target frame's alone; at peace, a kneeling revenant included, it is named as ever.) World Tooltips names a living entity only when its
  motor is not hostile (.cs:304-312; `worldTooltips.js` `mobileEntityName`), so LOOT7's "its name on the hover over it
  alive" held only for a champion at peace. A champion is that law's one recorded exception now
  (`mobileEntityName(name, { hostile, champion })`) - its name is its trait, Mac's "single named foes with visible
  traits" - and every live arm tells the door (the street's, a building's, the dungeon's, and the watch's, which never
  stands one). Any other hostile foe still says nothing, and with the row off no champion stands: the mod's silence
  is whole (`10-UI/UI-Arc.md`, WORLD-HOVER's departures).
- **CHAMP-SAID - on the classic skin a champion was invisible until it died, and no screen said what a trait does.**
  The plaque is the enhanced skin's (`ui/worldPlaque.js` `worldPlaqueOn`: `isEnhanced() && !isTouchDevice()`; the
  classic face resolves quick loot's piles alone), so is the target frame (`ui/hudFoeTarget.js`, PX30), and
  `CHAMPION_TRAITS`' `text` was read by nothing. `champions.js` `sayChampion`: the first blow that lands EITHER WAY -
  its on me, mine on it, through formulas.js's struck and strike tails under their own name (`CHAMPIONS_SAID`), the
  seams every pool already shares (the dungeon's, the street's, a building's, a puppet's), so no host stands it - says
  two rows on the line every skin draws (`notify.js` `popupMessage`, DaggerfallUI.PopupMessage, the line "%s just
  died." is said on; the first producer to walk that door): `Mighty Orc stands as a champion.` and `Its blows land
  half again as hard.` Once per champion (a rebuild or a load is a new one); never a plain foe, a blow on a peer's copy
  (another player's screen is theirs) or a peer's blow. The longest row, the Thorned's at 60 characters, measures about
  225 px in FONT0003's own advances (the `grimoire-ui` SDF cut of it, 4 px to an `a`) - inside the classic line's 320,
  which centres a row and never wraps it. On the enhanced skin each row is a toast (ENH-NOTICE3).
- **DUNGEON-DIED - no dungeon death was ever said.** EnemyDeath.cs:79-83 says "%s just died." at every death, and
  AUDIT 24 wave 38 gave it to the two street pools; `dungeonContext.js` `damageFoe`'s death arm had none, so a dungeon
  champion's name was never said at its fall (nor any other foe's). It says it now, the street's law (AUDIT WORLD6b
  B2): mine alone - a peer's killing blow applied at the host speaks no notice of mine - through
  `DisableEnemyDeathAlert`. And online the dungeon can do what the street cannot: the host's record names whose blow
  it was (`v`, AUDIT SET P-M3), so `applyFoeRecord` says it at the striker it names, once.

**Said, not fixed.** The street's peer kill is said nowhere: a puppet's death says nothing (`puppetDie` - its owner's
world's), and the owner says none for a peer's blow; the street's foe record carries no killer to say it with, and
one is a field on the wire and a relay version, not a small thing. A dungeon's rest encounter is never a champion:
the dungeon's champions are its layout's (the hash every client agrees on), and an encounter stood later is not in
it. AUDIT LOOT's stated Vampiric stands as it was.

Pinned: `test/loot7check.test.js` (4), each red on the code before - CORPSE-FIND the corpse door against the list door
seed for seed over 6,000 champions' bodies (the Thunderlock loaded), a kitted body and a bare one, the spawn seam's
champion, off; CHAMP-HOVER the law, a real champion through the hosts' composition onto `resolveHover`'s frame, off,
the four arms, the plaque's skin; CHAMP-SAID the five traits' rows golden, the real blows both ways through a
registered presenter, once, the plain foe, the peer's copy and the peer's blow, off; DUNGEON-DIED `damageFoe` and
`applyFoeRecord` lifted from src/ and run. `tools/mutants/loot7check.json` (25, all dead). Moved with it:
worldhover's four-hosts pin reads the new call, and `worldhover.json`'s two records on the changed lines were re-aimed
by content (both dead); RF2's boss pin exempts ammunition by the registry; audit68's two harnesses carry
`sayEnemyDied`; 29 cites moved by `tools/citeShift.mjs` and one by hand (chargenSession.js's wrapped `overlayHover`
cite, which the shifter cannot reach). Judged again, every campaign the change can
move - the loot, set, sigil, card, quick-loot and hover lists whole, and every record the three edited pins kill
elsewhere: 831 records, 829 dead and 2 equivalent as recorded, none stale.

## 18. PLAIN-LOOT - half from a foe that is no elite (2026-10-02)

Mac: "reduce the loot dropped by non elite enemies by 50%". `scenes/hostCombat.js spawnEnemyLoot`, after the trio: a
foe that is not an ELITE FOE (`eliteFoe`), an Elite Dungeon foe (`elite`) or a LOOT7 champion keeps each piece the
chain put on its body - the table's, the worn kit's droppable cut, the map, potion and recipe, the port's extras (the
field kit, the healing potion) - on its own coin, one in two, on the host's stream; its gold is all kept, as the
humanoid quarter keeps it. The rarity roll and the drought run after it, over what is kept, so a plain foe's Magic,
Rare and Legendary finds halve with its pieces. Its worn kit is still worn and fought with.

**AUDIT PLAIN-LOOT.** As first built it was a factor on the table's `itemChanceScale`. DFU's ladder halves a category's
chance at every step and rolls it truncated to whole percent (`dice100(Math.trunc(c))`), so the factor compounded down
the ladder and a 1-3% chance fell to nothing: measured exactly over the live tables at levels 1, 10 and 25, it kept
33-50% of the table, and none of a level-1 humanoid's on table A. A coin per piece keeps half of whatever the ladder
made, at any chance. `test/rf2_spawnloot.test.js` PLAIN-LOOT; `tools/mutants/plainloot.json` (5, all dead).
