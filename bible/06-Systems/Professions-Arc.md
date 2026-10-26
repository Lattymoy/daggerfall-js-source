# THE PROFESSIONS ARC - life skills, materials, the Notice Board and Marks (PROF0, the design record)

**Status: DESIGN RECORD, every question decided. Built so far: MARKS1 (10.5) and NOTICE1 (10.7), both at `dev`; the
professions themselves are not.** Opened 2026-09-28 beside the town-control
design (`11-Multiplayer/Seats-Arc.md`, SEAT0), whose marks this page uses: **DECIDED (Mac)**, **DECIDED** (the
record's, at Mac's instruction), **FACT**, **MEASURED**.

## Mac's words

- "If theres also sub systems (like life skills + materials) that can play a part, we can do that also. The sky is
  the limit"
- "Make sure we're documenting everything before building ... I want this to have insane depth, replayabiity and
  everything else."
- **"New currency"**
- "Life skills will utilize things like tree chopping, picking up ingredients, fishing, etc. Active player
  involvement and actual UI integration for life skills."
- "The new notice board should be a physical object that houses quests, the player auction house, etc"
- **"I want you to make the decisions with the intent as being as detailed as possible."**

Every number below lives in a pure law module: the Marks' in `src/net/marksLaw.js` and the board's in
`src/net/boardLaw.js` (built - MARKS1, NOTICE1); the rest in three still to be written with their slices,
src/net/professionLaw.js (tracks, ranks, caps, acts, quality), src/net/recipeLaw.js (every recipe as data) and
src/net/nodeLaw.js (the nodes). Appendix B lists them in one place.

## 1. The laws this arc keeps

1. **ONLINE ONLY; DAGGERFALL'S MAKERS UNTOUCHED.** FACT: Daggerfall has no crafting skill; its three makers - the
   potion maker (`src/systems/potions.js`, 20 recipes), the spellmaker (`src/systems/spell/spellMaker.js`) and the item
   maker (`src/systems/enchanting.js`) - are ported 1:1 and use no skill. Offline they stay that. A profession is a
   Ledger A departure, online's alone, and offline play earns nothing toward one (DECIDED; Renown's law).
2. **DAGGERFALL'S ITEMS FIRST.** A material is one of DFU's own items wherever DFU has one (the 8 gems, 25 plants, 23
   creature parts and 11 metals, section 4); a product is one of DFU's own templates at one of DFU's own materials. A
   crafted Dwarven longsword IS Daggerfall's Dwarven longsword. New templates only for what Daggerfall lacks, in the
   **reserved range 600-699** (4.8), registered through `registerCustomTemplates` (`src/systems/item/itemTemplates.js`)
   as RRI (513-526), Climates & Calories (530-541), the Thunderlock (560-561) and the Sigil Stone (570) already are.
   **The tools are Foraging's own** (Wood-Axe 1600, Pick-Axe 1601, Sickle 1602, Fishing-Net 1603, Basket 1607 -
   Harbinger451's mod, ported 1:1, `06-Systems/Foraging.md`, FORAGE0); the range adds only the Skinning Knife (603).
3. **THE STORES ARE THE SERVER'S.** Gathered materials land in the **Stores**, a per-character inventory the account
   service keeps, not in the pack. Crafting consumes the Stores on the service and hands the product to the save. A
   material withdrawn to the pack becomes an ordinary save item and **never goes back**: nothing edited into a save can
   be laundered into the server's economy. **What may enter the Stores**, the whole list: a harvest the service
   rolled (section 6), a craft the service made (section 9), a market purchase or a buy order filled (10.2-10.3), a
   writ's return or refund (section 11), the Board's two counters - the Weavers' and the Apothecaries' (4.5) - a Siege
   Honour's Spoils of War (4.7), and Disenchanting's Essence from a provenance item (9.3). BAG1 restated it over the
   service's carried count (`Materials-Bag.md` 5); BAG-CRAFT (2026-10-09, Mac: "I just want players to also be able to
   craft from their inventory, not just the store") opened one door past it: **a station's shortfall**, put in from the
   bag and the pack counted or not, as **loose** (`Materials-Bag.md` 14) - so a station takes the client's word for what
   its pack holds. AUDIT BAG-CRAFT (A1, `Materials-Bag.md` 15) walled that door to the stations: a loose unit, and all a
   station makes of it, reaches no writ, guild Stores, Drakes sale or carried count, so the guarantee above stands for
   the economy - what a modified client gains through it is a craft's XP. **Every Stores unit carries its origin** (section 7): **own** (this character's harvest or
   craft) or **bought** (everything else); only own units raise a seat's influence at their value (section 11).
   **RESTATED BY BAG1** (2026-10-03, `Materials-Bag.md`; Mac: "instead of the current go straight into your storage"):
   a harvest goes into the Materials Bag or the pack now, and what the service handed to a save may come BACK into the
   Stores - exactly that, and nothing else. The service COUNTS what it handed out (`prof_carried`, by origin), cuts the
   count to what the client says it holds before every act that reads it, never raises it, and moves into the Stores
   only counted units. A pack item the service never handed out - a save-edited one, a looted one - is held and never
   counted: it still never enters the Stores. The guarantee stands; the door opens one way more, for the service's own.
   THE AUDIT (Mac: "Audit this"; `Materials-Bag.md` 5 and 10): the cut runs only against the count the client last
   heard (`seen`), so a lost answer never cuts units the pack is about to get; and the count is a ceiling, not a census -
   a client that says it holds more than it does keeps its count uncut, bounded by what the service handed out.
4. **THE NODES ARE THE CLOCK'S.** Which nodes exist today is a pure function of the UTC day and the map pixel, as the
   Oblivion Gate's site is (`src/net/gate/gateLaw.js`); **yields are rolled by the service**, never the client.
5. **THE HANDS DO THE WORK** - DECIDED (Mac: "Active player involvement"). Every harvest is an act the player plays
   (section 5), and an act played well gives more - within a bound a modified client cannot break (5.1).
6. **NO NEW COMMITTED ART IN THE FIRST SLICES** - DECIDED. Tools in the hand are DFU's own weapon sprites (and the
   Morrowind arms on that lane; the net and the basket are the item's own picture held as the held map is - 5.1), new items' icons are DFU's own icons recoloured at runtime from the player's data
   (4.8), nodes are DFU's own flats tinted. The one committed art is the heraldry's devices (SEAT0 8.1: 24; forty since GUILD2c), the port's
   own. If Mac later commissions art, it replaces a runtime composition icon by icon. Foraging's seven textures are the
   author's own art, vendored with Mac's word of permission - a mod's work carried, not art the port made (FORAGE0
   law 5).
7. **CRAFTING DOES NOT RETIRE LOOT.** FACT: Loot Rarity's tiers are Common, Magic, Rare, Legendary, Aetheric, Artifact
   (`src/systems/loot/lootRarity.js`); Sigil Sets are online set gear (`11-Multiplayer/Sigil-Sets.md`). DECIDED: a craft
   reaches **Rare** at most (a Masterwork); Legendary, Aetheric, Artifact and Sigil pieces are never craftable.
8. **MARKS, NOT GOLD** - DECIDED (Mac: "New currency"). Everything this arc prices between players is in Marks
   (10.5), which only the server holds and only server-witnessed acts mint - SILVER-FINDS (10.5, Mac: "Silver should be
   more accessible"): a harvest's find and a loot find aside, two faucets BOUNDED BY THE DAY instead, since neither act
   can be witnessed. GOLD-MARKET (10.8, Mac: "Gold listings,
   walled"): a realm character's gold is its record's on the service now (REALM P2), so a market listing may be priced
   in it - and gold still never becomes Marks: what gold bought is walled from every Marks-earning act.

## 2. What already stands (FACT)

| Foundation | Where | Use here |
|---|---|---|
| DFU's makers | `potions.js` (+ `potionMakerWindow.js`), `spellMaker.js`, `enchanting.js` (+ `itemMakerWindow.js`) | Alchemy and Enchanting are layers over them |
| DFU's items | `src/characters/itemTemplates.json`; `GROUP_TEMPLATE_INDICES` (`src/systems/item/itemTemplatesData.js`) | Every material and product named in section 4 |
| Home stations | `DECOR_STATIONS`, `DECOR_STATION_FEES` (`src/net/decorLaw.js`); the account service's decor | Alchemy/spells/enchant stations placed for a licence; new station kinds join the list (DECOR-USE: the cooking station, the room's fire) |
| Repair | `src/systems/repairService.js` | Repair kits (Smithing) |
| Climates & Calories | `src/systems/survival/` - camps, the Skillet, cooking at fires and hearths, foraging, corpse meat; templates 530-541 (Camping Equipment, Rations, Apple, Orange, Bread, Raw Fish, Cooked Fish, Meat, Raw Meat, Waterskin, Skillet, Campfire Kit) | Cooking's ground; Hunting's butchery |
| Deep Waters fish | templates 9001-9007 (Longnose Butterflyfish, Largemouth Bass, Canary Rockfish, Crucian Carp, Mackerel, White Zebra Angelfish, Juvenile Finulon), each with its waters (`PASSIVE_FISH_SPECIES`, `src/world/passiveFish.js`: Tropical, Temperate, Swamp, Desert, OpenOcean, Cold) | Fishing's haul (the species named; the Stores keep Raw Fish, 5.2) |
| World of Daggerfall | 209,436 rock-field prefabs among 227,938 (`03-World/World-Of-Daggerfall.md`); WOD7's shared camps (`src/world/worldOfDaggerfall/wodShared.js`) | Mining's anchors; bounties |
| Terrain nature | `src/world/terrain/terrainNature.js` | Logging's and Herbalism's anchors |
| Climates | `mapsFile.js`: Ocean, Desert, Desert2, Mountain, Rainforest, Swamp, Subtropical, MountainWoods, Woodlands, HauntedWoodlands | Every native table (section 4) |
| Dyes | `src/systems/item/itemDye.js` | Outfitting |
| Bulletin boards | `BULLETIN_BOARD_MODEL_ID` (`src/world/rmbLayout.js`), `src/systems/bulletinBoard.js` (ROAD A9) | The Notice Board (10.1) |
| Player trade | TRADE1 (`src/net/tradeSession.js`, `src/ui/enhanced/enhancedPlayerTrade.js`) | Stays how loot changes hands |
| Held objects | `src/combat/heldPose.js` (MAP3) - the Morrowind arms' held-sheet pose only; the classic lane's held map is a bottom-anchored sprite that hides the weapon from its place in the draw ladder (MAP-WEAPON, `10-UI/Held-Map-Arc.md`) | The net and the basket in the hand (5.1) |
| Sigil Stones | template 570 (`src/systems/gate/gateSpoils.js`) | Daedric smithing |
| Gold | the save's; the guild treasury is the only gold a server holds | Why Marks exist (10.5) |

**Standing since FORAGE1-FORAGE3 (2026-09-28)**: Foraging (`06-Systems/Foraging.md`, `src/systems/foraging/foragingLaw.js`,
`src/systems/foraging/foragingInstall.js`): the tools and their shelves, their checks (daylight, no foe near, not encumbered),
the Basket's foods, the attribute pairs, and the tools in loot (a shelf's and a house's hook, every pile at its index,
the corpses - FORAGE3), and online the quests' time as a wait (FORAGE4). Foraging stands whole in both lanes.

## 3. The professions

### 3.1 Thirteen professions

CRAFT3 (41.6, BUILT 2026-10-07): the eight crafts below are eight DISCIPLINES of five crafting tracks now - Smithing
(Smithing and Jewelcrafting), Building (Carpentry and Masonry), Outfitting, Provisioning (Alchemy and Cooking) and
Enchanting - ten professions a character holds, with the five that gather.

| Gathering (5) | Crafting (8) |
|---|---|
| **Mining** - DFU's metals and gems, the higher ores, stone | **Smithing** - DFU's weapons and metal armour, ingots, repair kits |
| **Logging** - logs by climate, charcoal, resin | **Outfitting** - leather armour, DFU's clothing, dyes, rugs and tapestries |
| **Herbalism** - DFU's own plant ingredients | **Carpentry** - bows, staves, arrows, DFU's furniture, the Ram |
| **Hunting** - hides, DFU's creature parts, meat | **Masonry** - cut stone, mortar, fortifications, stone decor |
| **Fishing** - Deep Waters' species, pearls | **Alchemy** - over DFU's potion maker |
| | **Enchanting** - over DFU's item maker; Disenchanting |
| | **Cooking** - C&C's foods, dishes, feasts |
| | **Jewelcrafting** - DFU's jewellery from gems and precious metals |

### 3.2 Ranks and XP

- A track from **0 to 100** per profession per character, kept by the service (Renown's shape). Ranks: **Novice**
  0, **Apprentice** 25, **Journeyman** 50, **Expert** 75, **Master** 100.
- XP to reach rank n: **10 x n^2** (Apprentice 6,250; Journeyman 25,000; Expert 56,250; Master 100,000).
- XP earned: a harvest **15 x tier** (+50% for a clean act); a craft **20 x tier x units**, **+500** the first time
  a recipe is made (CRAFT2, 41.5: the first time a PATTERN is made AT A TIER - the first Longsword of tier 6, whichever of
  its four metals); a writ **2 x its Mark value**. A node or recipe more than two tiers below your rank gives a
  quarter. DECIDED, Mac: "XP follows your rank" - **a haul (PROF8) and a herb (HERB-XP, 2026-10-01 part four) are worked
  at the highest tier the rank opens**: every haul is tier 1 and herbs stop at tier 3, so their own tiers would have
  held Fishing at a Novice's pace and quartered every herb past rank 70 (the Basket's food keeps its tier). DECIDED, AUDIT 32 S1 - Mac: "Whatever you think is best": **no +500 for a recipe made wholly of the goods
  a counter sells** (4.5's Linen and Wool) **out of the counter's units** - the counter's supply has no end, and 152
  recipes of it bought Outfitting 87 for 811 Marks. CLOTH-GEMS (section 50; the owner: "No band aids"): S1 judges the
  UNITS, never the material - the loom weaves Linen and spins Wool of the world's goods (4.5), so a piece of the
  character's own cloth pays its 500 and one of the Weavers' (bought) or of a pack's word (loose) never does. Said at
  every station and in the craft's word since CRAFT-FIRST-SHOWN (41.9).
- All XP is service-witnessed: the service performed the harvest, the craft, the delivery.
- **Tiers**, the ladder every material, node and recipe sits on - the rank each needs:

| Tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Rank needed | 0 | 10 | 25 | 40 | 55 | 70 | 90 |

- **The crafter's limit** - DECIDED: a character may raise at most **two crafts above Journeyman (50)**. Gathering is
  unlimited. CRAFT3 (41.6): two of the five crafts. No one character makes everything; trade equips an army.
  CRAFT-LIMIT-SAID (41.10, FIELD BUGS 2026-10-18f): a third craft stops at 26,009 XP, one short of rank 51, and every
  act of it then pays none - said at every station, on the Professions tab and in the craft's word since. No rank is
  ever lowered, so the two are the character's for good (OPEN, the owner's: a craft let go).
- **Online only** - DECIDED: nothing offline earns profession XP.

### 3.3 Specialisations

At 50 and again at 100 each profession offers two; the choice is made on the Professions tab. CRAFT3 (41.6): a merged
craft offers its two disciplines' - four a rank, one chosen - each acting on its own discipline's work. A change costs **1,000
Marks** and a week's wait. PERK-TRIAL (section 51, 2026-10-24, the owner's pick): a choice is free to change for a day
after it is made, and a paid change (1,000 Marks) takes effect at once - the week is the lock after it.

| Profession | At 50 | At 100 |
|---|---|---|
| Mining | **Prospector** - veins within ~~200~~ 500 m marked on the compass, and each vein its own mark on the Overworld, named by its ore; gem chance +10% / **Deep Delver** - dungeon veins yield ~~+50%~~ x2, and every vein of the dungeon on the compass | **Motherlode Sense** - the day's Motherlodes marked on both maps from the day's start; warnings 30 minutes ahead, not 10 / **Surveyor** (the **Stonebreaker** until MINE-PERKS, on its id) - their own word witnesses the ground for their own veins (never a signature); quarrying yields Cut Stone directly. MINE-PERKS, section 43 |
| Logging | **Lumberjack** - 2 chops fewer a tree (3 at least) / **Forester** - heartwood chance x2 | **Charcoal Burner** - a log burns to 2 Charcoal, not 1 / **Timberwright** - a log saws to 3 planks, not 2 |
| Herbalism | **Gardener** - common herbs yield +1 / **Botanist** - the steady window +50% | **Seasonal Eye** - off-season herbs at half rate / **Apothecary's Friend** - every herb you pick counts as unbruised |
| Hunting | **Tracker** - animals within 100 m marked / **Tanner** - hides cure 1:1, not 2:1 | **Trophy Hunter** - a trophy decor piece from a tier 5+ kill / **Butcher** - meat x2, and it spoils half as fast |
| Fishing | **Angler** - the tug window +40% / **Netter** - a school's haul +2 fish, not +1 | **Deep-Sea** - the sea's Pearl and Slaughterfish chances x2 / **Pearl Diver** - pearl chance x3 |
| Smithing | **Weaponsmith** or **Armoursmith** - that family +1 quality step | **Masterwright** - Masterwork chance +5% / **Quartermaster** - ingots and repair kits x2 |
| Outfitting | **Tailor** - clothing +1 step / **Leatherworker** - leather armour +1 step | **Couturier** - two-colour dyes / **Saddler** - a wagon upgrade (Horse Cart and Cargo) of +100 kg |
| Carpentry | **Bowyer** - bows and arrows +1 step / **Joiner** - furniture at half the planks | **Siegewright** - Rams +50% vitality; siege works a day sooner / **Master Joiner** - furniture carries the maker's mark |
| Masonry | **Quarryman** - Rough Stone cuts 1:1, not 2:1 / **Builder** - fortification projects need 10% less stone | **Fortifier** - once a Season a seat's Walls skip their drop on capture / **Sculptor** - stone decor pieces |
| Alchemy | **Brewer** - 3 potions a brew at Journeyman / **Distiller** - Potent chance +10% | **Master Alchemist** - Potent is +40%, not +25% / **Transmuter** - two of a DFU metal and a Mercury make one of the next up (Tin, Copper, Silver, Gold, Platinum) (AUDIT PROF12 E3, Mac's choice - section 37) |
| Enchanting | **Efficient** - a further -5% cost / **Disenchanter** - Arcane Essence x2 | **Soulbinder** - filled soul gems give +10% points / **Runecaster** - a Masterwork's property chosen from three |
| Cooking | **Cook** - +1 serving a dish / **Field Cook** - a night at their own Campfire spends no fuel (REST2; it was a campfire without a Campfire Kit's charge) | **Chef** - feasts last +50% / **Provisioner** - rations and dishes never spoil |
| Jewelcrafting | **Gemcutter** - a set gem adds +10% enchantment points / **Goldsmith** - Silver counts as Gold | **Master Jeweller** - jewellery Masterwork chance +5% / **Lapidary** - Siege-cracked Gems set as any gem |

BUILT (SEAT2b part two (a), 2026-10-01): the **Siegewright** is chosen (no longer `later`). DECIDED: "siege works a day
sooner" is a seat's work (Seats-Arc 7.5) - a project begun by a Siegewright stands a day sooner (1, 3 or 6 days); a Ram
Kit is made at once. Its Rams' +50% is the battle's: BUILT (SEAT2b part two (b)) - a Siegewright on the attacking roster
when the battle's door opens fields every Ram of the camp at 4,500 vitality, not 3,000.

## 4. Materials

### 4.1 Metals - DFU's ten materials on the seven tiers

| DFU material | Raw | Refined (new, 4.8) | Tier | Where |
|---|---|---|---|---|
| Iron | Iron (DFU 71) | Iron Ingot | 1 | every rock field and vein |
| Steel | Iron Ingot + Charcoal | Steel Ingot | 2 | smelted |
| Silver | Silver (DFU 73) | Silver Ingot | 3 | Mountain, MountainWoods |
| Elven | Moonstone Ore | Moonstone Ingot | 4 | Woodlands, HauntedWoodlands deep veins; everywhere in the Kingdom of Daggerfall (4.7) |
| Dwarven | Dwarven Scrap | Dwarven Ingot | 4 | dungeon veins only |
| Mithril | Mithril Ore | Mithril Ingot | 5 | Mountain; everywhere in the Kingdom of Wayrest (4.7) |
| Adamantium | Adamantium Ore | Adamantium Ingot | 6 | deep dungeon veins; gate-touched ground; the Isle of Balfiera |
| Ebony | Ebony Ore | Ebony Ingot | 6 | Desert and Desert2; everywhere in the Kingdom of Sentinel (4.7) |
| Orcish | Orichalcum Ore | Orichalcum Ingot | 6 | only in Orsinium Area and the Wrothgarian Mountains |
| Daedric | Ebony Ingot + Daedra's Heart (DFU 53) + a Sigil Stone (570) | Daedric Ingot | 7 | smelted only - the Oblivion Gate's gift (BUILT, DAEDRIC-SMELT, section 50: the stone the account's Deadlands Ember, spent from its purse; the heart loot's or the Gate's, loose alone, a catalyst) |

**Smelting**, at any forge (a home's, or a Weaponsmith's or Armorer's for the use fee, 9.3), with no act: **2** raw
metal (DFU's or an ore) make **1** ingot; Steel is 1 Iron Ingot and 1 Charcoal; Brass 1 Copper and 1 Tin; Daedric as
the table says. An ingot gives Smithing **10 x its tier** XP. An ingot's origin is its inputs' (section 7).

**What a vein holds**, by climate (DFU's metals by tier: Iron, Tin, Copper, Lead, Sulphur 1; Lodestone, Mercury 2;
Silver 3; Gold 4; Platinum 5):

| Climate | Vein metals |
|---|---|
| Woodlands | Iron, Copper, Tin, Lodestone; Moonstone in deep veins |
| MountainWoods | Iron, Copper, Silver, Lead |
| Mountain | Iron, Silver, Gold, Platinum; Mithril |
| HauntedWoodlands | Iron, Lead, Mercury; Moonstone in deep veins |
| Swamp | Iron, Mercury, Sulphur |
| Rainforest | Iron, Copper, Gold |
| Subtropical | Iron, Copper, Tin, Sulphur |
| Desert, Desert2 | Iron, Lead, Sulphur, Gold; Ebony |

**Brass** is smelted from 1 Copper and 1 Tin. DFU's other metals gain uses beside their potions: **Tin, Copper** (fittings, 1 a weapon), **Brass** (instruments,
lanterns as decor), **Lead, Sulphur** (Mortar), **Gold, Platinum** (Jewelcrafting), **Lodestone** (a compass decor
piece), **Mercury** (Alchemy's Transmuter).

### 4.2 Wood - DFU's own woods

Daggerfall's furniture is Oak, Cherry, Mahogany and Teak (FACT, templates 221-232); those are the woods, with Pine and
two rarities.

| Wood (log / plank, 4.8) | Tier | Climates |
|---|---|---|
| Pine | 1 | Mountain, MountainWoods; and 2 trees in 5 of every other forest, on any ground (PINE-SHARE) |
| Oak | 2 | Woodlands, MountainWoods, Swamp |
| Cherry | 3 | Woodlands, Subtropical |
| Teak | 4 | Subtropical, Rainforest |
| Mahogany | 5 | Rainforest |
| Ironwood | 6 | Rainforest - 1 tree in 20 |
| Ghostwood | 6 | HauntedWoodlands - 1 tree in 20 |

A log saws to **2 planks** (Timberwright 3) at a workbench; a log burns to **1 Charcoal** (Charcoal Burner 2); every
tree gives **1 Resin** in 4. Charcoal and Resin are tier 1 (**1** Mark each). A Clean Cut (5.2) may drop **Heartwood** (2%): a tier-up plank of the same wood, worth
one quality step in any recipe.

### 4.3 Herbs - DFU's own plants

| Climate | Common | Uncommon | Rare |
|---|---|---|---|
| Woodlands | Green Leaves, Clover, Red Flowers, Yellow Flowers | Red Berries, Yellow Berries, Red Rose, Yellow Rose, Red Poppy | Golden Poppy, White Poppy |
| MountainWoods | Pine Branch, Clover, Green Berries | Root Tendrils | White Rose |
| Mountain | Pine Branch, Twigs | Root Bulb | White Poppy |
| HauntedWoodlands | Twigs, Root Tendrils | Black Rose, Black Poppy | Ginkgo Leaves |
| Swamp | Root Tendrils, Root Bulb, Green Leaves | Bamboo | Black Poppy |
| Rainforest | Bamboo, Green Berries | Ginkgo Leaves, Fig, Red Flowers | White Rose |
| Subtropical | Palm, Aloe, Yellow Flowers | Fig, Bamboo | Golden Poppy |
| Desert, Desert2 | Cactus, Twigs | Aloe, Palm | Golden Poppy |

For ranks and XP a common herb is **tier 1**, an uncommon **tier 2**, a rare **tier 3**.

**The seasons** (DFU's calendar): in **winter** the flowers, roses, poppies and berries do not grow (Pine Branch,
Twigs, the Roots, Bamboo, Ginkgo Leaves, Palm, Aloe, Fig and Cactus do); in **autumn** berries yield +50%; in
**spring** flowers yield +50%. Seasons of the Iliac Bay, where it is on, changes nothing here - it is a look.

### 4.4 Hides and creature parts - from the foes DFU spawns

| DFU foe | Hide (4.8) | Tier | A chance of the DFU ingredient |
|---|---|---|---|
| Rat | Rat Pelt | 1 | - |
| Giant Bat | Bat Leather | 2 | - |
| Grizzly Bear | Bear Hide | 2 | Big Tooth (56) |
| Sabretooth Tiger | Tiger Pelt | 3 | Big Tooth (56) |
| Spider | Spider Silk | 3 | Spider's Venom (41) |
| Giant Scorpion | Scorpion Chitin | 4 | Giant Scorpion Stinger (47) |
| Slaughterfish | Slaughterfish Scales | 4 | - |
| Harpy | Harpy Feathers | 5 | - |
| Dreugh | Dreugh Shell | 5 | - |
| Dragonling | Dragonling Scale | 6 | Dragon's Scales (46) |

Hides cure to **Cured Leather** (tiers 1-3) or **Hardened Leather** (tiers 4-6) at a tanning rack, **2:1** (Tanner
1:1). Butchery gives C&C's Raw Meat either way. DFU's own corpse loot is untouched: skinning adds, never replaces.

DEX-HIDES (2026-10-21, `01-Overview/bugs/Field-Bugs-2026-10-20h.md`): Daggerfall Enemy Expansion's nine animals are
skinned too, each by its own id (`net/professionLaw.js` HIDES): the Bat the Bat Leather, the Blood Spider the Spider
Silk, the Mountain Lion the Tiger Pelt, the Land Dreugh the Dreugh Shell; and three hides of their own, **Wolf Pelt**
(681, tier 2 - the Wolf, the Snow Wolf, the Dog), **Boar Hide** (682, tier 2) and **Mudcrab Chitin** (683, tier 1). The
branch for `01-Overview/bugs/Field-Bugs-2026-10-21.md` had built the same slice, and at its merge took this one whole (the
same keys; these ids may already stand in a player's Stores). What its audit (AUDIT FB1021, `01-Overview/audits/
Audit-Field-Bugs-2026-10-21.md`) found here and carried: the Bear Hide's cure stands LAST of its tier (L2-1 - it is the
Ram Kit's too, and a chain for Cured Leather spent every one before a Wolf Pelt); the Stores count Mudcrab Chitin as a
mass, as the Scorpion's. The Land Dreugh shares the Dreugh's row whole, so no butchery: a departure from C&C, whose
corpse feeds its body (L2-2).

### 4.5 Cloth, stone and the Board's counters

- **Linen Bolt** and **Wool Bolt** are sold by the Notice Board's own supplier - the Weavers' counter on the Market
  tab - for **2** and **3 Marks** a bolt, straight into the Stores: a Marks sink, never a purse-gold purchase, because a
  Stores material bought with gold a client may not have had is exactly the leak law 3 closes. CLOTH-GEMS (section 50;
  the owner chose: craft them): the loom makes both of the world's goods too - **Linen** woven from **Root Tendrils**
  (DFU's plant 12, either land's - a common herb of the MountainWoods, the HauntedWoodlands and the Swamp, 4.3), two a
  bolt; **Wool** spun from a **fur** Hunting gives (the Rat, Wolf and Tiger Pelts, the Boar and Bear Hides, 4.4), two a
  bolt - no XP, and a bolt is own where its goods were. A Ledger A departure: Daggerfall keeps no sheep, grows no flax
  and weaves nothing. The counter's bolts stay **bought**, and AUDIT 32 S1 (3.2) withholds the first-make 500 from them
  alone. **Silk Bolt** is woven from Spider Silk (3:1).
- **The Apothecaries' counter**, the supplier's second, sells into the Stores the sixteen DFU ingredients that DFU's
  potion recipes need and no gathering route yields (FACT, `POTION_RECIPES`, `src/systems/potions.js`), at **a fifth of
  DFU's price in Marks**, rounded up: Werewolf's Blood 5, Fairy Dragon's Scales 18, Unicorn Horn 40, Ectoplasm 12,
  Troll's Blood 4, Snake Venom 2, Mummy Wrappings 8, Saint's Hair 40, Small Tooth 1, Pure Water 5, Rain Water 2, Orc's
  Blood 4, Elixir Vitae 6, Nectar 3, Ichor 4, Ivory 3. Without it the brewing act (9.3) could make none of the twenty
  potions. A Marks sink; its goods are **bought**, never own. (A fifth, not the Bank's eighth: the counter is never a
  better way to turn Marks into gold than the Bank's exchange.)
- **Rough Stone** is quarried from rock fields (Mining); **Cut Stone** is cut from it **2:1** (Quarryman 1:1);
  **Mortar** is made ten at a time from 1 Sulphur, 1 Lead and 5 Rough Stone. Tiers and Marks values: Rough Stone
  tier 1 (**1**), Cut Stone tier 2 (**2**), Mortar tier 2 (**2**).

### 4.6 Gems

DFU's eight gems come from veins, 3% a strike on a clean glint (5.2), by climate: **Amber** (Woodlands), **Jade**
(Rainforest), **Turquoise** (Desert, Desert2), **Malachite** (Swamp), **Ruby, Sapphire, Emerald** (Mountain), and
**Diamond** only from deep dungeon veins. **Pearl** (DFU 77) comes from Fishing at sea.
CLOTH-GEMS (section 50; the owner: accept every grade): the port's graded gems (`Gem-Sockets.md` 4 - Chipped, Flawed,
Flawless and Perfect, the socket loot) are set at the jeweller's bench too, each its grade's own share of a gem's points,
brought into the Stores by a station's loose door alone.

### 4.7 Regions - signatures, marches, free lands

DECIDED - the kingdoms' map is SEAT0 4.3's, and the materials follow it:

| Where | Signature |
|---|---|
| Kingdom of Daggerfall | Moonstone veins in every climate there, at twice the usual rate |
| Kingdom of Wayrest | Mithril veins in every climate there |
| Kingdom of Sentinel | Ebony veins in every climate there |
| Orsinium Area, Wrothgarian Mountains (Free Lands) | Orichalcum - the only place it is found |
| Isle of Balfiera (Free Land) | Adamantium surface veins - the only open-world place outside gate-touched ground |
| The Marches (Betony, Anticlere, Lainlyn) | every node +25% yield - contested wealth |
| **Gate-touched ground** | for 2 real hours (a game day) after an Oblivion Gate falls - day or night - its pixel holds 6 Adamantium veins and Daedra's Heart can be skinned from any foe there |
| **The Spoils of War** (SEAT0 6.8) | Warforged Steel Ingot (tier 6: counts as Ebony with +1 quality step), Standard-bearer's Silk (tier 5 cloth), Siege-cracked Gem (a gem of the roller's choice, Lapidary only) |

So the crowns sit on the richest veins, the free lands hold what no crown can, and the marches are worth fighting for.

### 4.8 The new templates (600-699)

Icons are DFU's own, recoloured at runtime (law 6): each row names the DFU icon it borrows. **601, 602 and 604 are
unused** (600 is the Materials Bag's since BAG1, `net/bagLaw.js` BAG_TEMPLATE - AUDIT FB1021 L4-10): the Pick, the Woodcutter's Axe, the Sickle and the Fishing Rod this table first held are Foraging's own
Pick-Axe (1601), Wood-Axe (1600), Sickle (1602) and Fishing-Net (1603), and the Basket (1607) joined them (FORAGE0 14).
The Basket's foods are Foraging's and C&C's own templates, not new ones (FORAGE0 14.6).

| Id | Name | Stores / pack | Icon from |
|---|---|---|---|
| 603 | Skinning Knife | pack (tool; 0.5 kg, 50 HP, 100 gold, online shelves only - FORAGE0 14.2) | DFU Dagger |
| 610-615 | Moonstone Ore, Dwarven Scrap, Mithril Ore, Adamantium Ore, Ebony Ore, Orichalcum Ore | Stores | DFU Lodestone, tinted per ore |
| 620-630 | Iron, Steel, Silver, Moonstone, Dwarven, Mithril, Adamantium, Ebony, Orichalcum, Daedric, Warforged Steel Ingot | Stores | DFU Iron, tinted per metal |
| 635-641 | Pine, Oak, Cherry, Teak, Mahogany, Ironwood, Ghostwood Log | Stores | DFU Twigs, tinted |
| 645-651 | the same seven Planks | Stores | DFU Small Oak Table's board, tinted |
| 652, 653, 654 | Charcoal, Resin, Heartwood | Stores | DFU Lodestone / Aloe / Twigs, tinted |
| 655-664 | the ten hides of 4.4 | Stores | DFU Small Skins, tinted |
| 665, 666 | Cured Leather, Hardened Leather | Stores | DFU Large Skins, tinted |
| 668-671 | Linen, Wool, Silk Bolt, Standard-bearer's Silk | Stores | DFU Small Tapestry, tinted |
| 673-675 | Rough Stone, Cut Stone, Mortar | Stores | DFU Lodestone, greyed |
| 678 | Siege-cracked Gem | Stores | DFU Diamond, cracked overlay |
| 680 | Arcane Essence | Stores | DFU Ectoplasm, tinted |
| 681-683 | Wolf Pelt, Boar Hide, Mudcrab Chitin (DEX-HIDES: Daggerfall Enemy Expansion's animals, 4.4) | Stores | Nymph Hair's lock; Fairy Dragon's Scales' |
| 685-688 | Hunter's Stew, Fisherman's Supper, Orchard Tart, Feast of the Hearth | pack (food) | C&C's Meat / Cooked Fish / Bread, tinted |
| 690 | Ram Kit | Stores (a siege work) | DFU Battle Axe, tinted |
| 692 | Repair Kit | pack | DFU Warhammer, tinted |
| 695 | Recipe Scroll (one template, the recipe in its variant) | pack | DFU parchment icon |

**Marks value** of a material (the writs' and the market's reference, 10.5, section 11): tier 1: **1**; 2: **2**; 3:
**4**; 4: **6**; 5: **9**; 6: **14**; 7: **40** Marks. A common herb **1**, uncommon **2**, rare **5**.

BUILT (SEAT2b part two (a), 2026-10-01; `06-Systems/Online-Arc.md` SEAT2b part two (a)): **the Ram Kit (690)** is made at
the workbench at Carpentry 60 (9.3) and goes to the Stores - own, or bought where any input held a bought unit - never to
the pack (`NO_PACK_FORM`): its road is a Siege Camp's writ (Seats-Arc 4.2), and a holder's stockpile and the guild Stores
ask none. DECIDED: its worth is its inputs' at their values (40 Oak Planks 80, 20 Iron Ingots 20, 4 Bear Hides 8 - **108**
Marks), not its tier's 9 - so a writ's pay and the influence a delivery raises keep the materials'. Its family is **Siege
Works**; it lists on the market as any Stores material.

## 5. The hands do the work - the acts

DECIDED (Mac: "tree chopping, picking up ingredients, fishing, etc. Active player involvement").

### 5.1 The common shape

- **The tool is carried, and drawn for the act.** The tools are Foraging's (law 2), group-9 items DFU cannot wield,
  so nothing is equipped: the act **draws the tool in the hand for its length** and puts back what the hand held
  (FORAGE0 14.1). The weapon rig draws it with DFU's own weapon sprites for the classic arm (the War Axe's for the
  Wood-Axe, the Warhammer's for the Pick-Axe, the Dagger's for the Skinning Knife, the Tanto's for the Sickle), Weapon
  Widget's swing, bob and inertia (`05-Combat/Weapon-Widget.md`), the Morrowind arms on that lane. The Fishing-Net and
  the Basket have no weapon sprite: on the classic lane the act draws **the item's own picture** (the author's net,
  Daggerfall's basket), bottom-anchored where the held map's sprite stands, and the weapon, shield and torch hand are
  hidden by the same place in the draw ladder the held map takes (MAP-WEAPON, `10-UI/Held-Map-Arc.md`); on the
  Morrowind lane the arms hold it in the held-sheet pose (`src/combat/heldPose.js`). No new art: the pictures are the
  items' own. A tool used from the inventory is Foraging's own use, 1:1, in both lanes - one item, two gestures.
- **Foraging's checks come first** (FORAGE0 14.3), each with Foraging's own refusal: not inside (except a dungeon
  vein and Hunting), not in a settlement, not at sea (but Fishing), no foe near (DFU's rest test), not fully
  encumbered; the tool, its wear, the foe and the load are the client's courtesy, which the service never sees.
  **ANY-HOUR** (2026-10-01, Mac: *"Remove the time limit for professions. Should be available at any time"*): no act
  keeps hours - the daylight 07:00-17:59 the acts borrowed (and the service enforced, `prof-night`) is gone from every
  profession, client and service (`01-Overview/bugs/Field-Bugs-2026-10-01.md` part four); Foraging's own Use keeps the mod's
  day.
- **Wear**: a completed act lowers the tool's condition by 1, as a Foraging use does; a tool lasts 50 harvests.
- **The attribute bands**: Foraging's attribute pair for the tool widens or narrows the act's skill window - x0.85,
  x1.00, x1.15, x1.30 for <=39, 40-59, 60-79, >=80 (FORAGE0 14.4). Attributes are the save's, so a band only moves a
  window; the honest bound below is untouched.
- **The node answers Interact** (E, KB1's registry - `10-UI/Controls.md`); the tool's action is **attack**; **Esc**
  cancels an act with nothing lost (the node stays).
- **Every act has a skill moment**, and a clean moment gives more. A missed one never fails the harvest - it gives
  less. The new player is never punished, only the good one rewarded.
- **The honest bound.** The act is played on the client, so it may be lied about. The act's report can move the
  service's roll by at most **one quality step and +50% yield**, never past the character's rank. The node's
  existence, ~~the daily caps~~ (RETIRED, CAP-OFF, 2026-10-07: no day's cap - the bounds that stand, section 6, are the service's too) and
  the dice stay the service's.
- **Others see it.** The pose ~~grows an activity field (tool and act: 4 bits)~~ carries the act (`ga`), its beats
  (`gb`) and the net's throw (`gm` - PEER-ACTS, section 45), a relay version with its LAW row (world200): a peer sees
  your tool swing on every lane, your kneel on the class sprite (a crouch on the Morrowind body), your throw on the class
  sprite and Eye Of The Beholder's walker, and hears each beat at your act - the haul is heard, drawn by none (AUDIT
  GATHER-FEEL R9). The node's state is each character's own (section 6), so a tree another felled still stands for you.
- **Gentle acts** (a setting, accessibility): every act completes at a plain result, with no clean bonus and no
  bruise. **Reduced motion** draws the rings and bands as static bars. Every cue is a shape and a sound as well as a
  colour.

### 5.2 Each profession's act

| Profession | The act | The skill moment | Clean gives |
|---|---|---|---|
| **Logging** | Swing at the trunk: tier 1-2 trees take **5** chops, 3-4 take **6**, 5-6 take **8** (Lumberjack -2, at least 3). The tree creaks at half, leans, and falls away from you (the flat tips over in 1.5 s and is gone - no fade, AUDIT 30 R10; the Morrowind model falls). Logs drop at its foot and are taken by walking over them. A stump stands for the rest of your day. | **The ring**: a circle shrinks onto the trunk's notch over **900 ms**; strike while it is inside the band - **±12%** of the notch's radius at Novice, **±20%** at Master - for a **Clean Cut** (worth 2 chops) | fewer swings; Heartwood 2% a Clean Cut |
| **Mining** | Strike the vein: tiers 1-2 take **4** strikes, 3-4 **5**, 5-6 **7**. It cracks ~~in stages (crack decals)~~ as it is worked - seams in the ore's own picture, opening from its heart with each blow - and sheds chunks (VEIN-CRACKS, section 45). | **The glint**: one of five points on the vein face glints for **1.2 s** (**2 s** at Master) and moves after every strike; a strike within the glint's radius counts **double** | a gem chance 3% a clean strike; a **clean finish** (every strike on the glint) raises the ore one quality step |
| **Quarrying** (Mining, on a rock field's boulders) | As Mining; yields Rough Stone | As Mining | Cut Stone directly on a clean finish (Stonebreaker always - the Surveyor since MINE-PERKS, section 43) |
| **Herbalism** | Kneel at the plant (E). A common herb comes up in **0.8 s**. | **The steady hand**, for uncommon and rare herbs with the sickle: hold E for **2.5 s** while a meter fills; turning the view more than **3 degrees** or moving **bruises** the herb | an unbruised herb (+5% Alchemy Potent chance each, 9.3); a bruised one yields 1 less (at least 1) |
| **Hunting** | Kneel at a body your own blow felled (E) with the knife. | **The trace**: a dotted line of 5-9 points over the carcass; draw the knife along it (mouse; the right stick moves a cursor; a finger on the touch layer). Accuracy is the mean deviation against a tolerance that widens with rank | a **clean pelt** (score 0.8+) is one quality step up; a **torn** one (under 0.4) yields 1 less |
| **Herbalism, the Basket** | Kneel at a patch (E) with the Basket (FORAGE0 14.6); the patch gives its food once a day besides its herbs | **The search**: three finds glint in turn among the leaves, **1.0 s** each (**1.4 s** at Master); tap each while it glints | all three: +50%; two: +25% |
| **Fishing** | Stand in water, swim, or stand at sea on a boat or pier (the net's water, FORAGE0 6.4). Hold attack to wind the throw (**0.3-1.5 s**), release; the net flies **3-12 m** and spreads, a ring of floats on the water (WATER1's surface, the Sea update's). Wait **5-30 s** - the first and last daylight hours halve it, a storm doubles it. | **The tug**: the floats dip, a splash sounds, the pad and phone buzz (TI2's haptics): haul within **600 ms** (Angler +40%). **The haul**: the net's weight runs along a bar; hold to raise the tension band (**20%** of the bar at Novice, **30%** at Master), release to let it fall; keep the weight inside to fill the haul meter within **20 s**; **2 s** outside, counted in total, and the net comes in with the plain haul | the haul; a trophy (x3 weight, a decor piece) 1 haul in 200 |

**What the net brings up** (Fishing): the species is Deep Waters' for the water (FACT, `PASSIVE_FISH_SPECIES`:
Tropical, Temperate, Swamp, Desert, OpenOcean, Cold), the pixel's climate choosing the waters by Deep Waters' own
`climateToBiome` (`src/world/underwater/underwaterDecorations.js`, imported, not re-typed); the sea adds a **Pearl** (DFU 77) in 1
haul of 50 (Pearl Diver x3) and a **Slaughterfish** in 1 of 100 - the heaviest haul - which yields Slaughterfish
Scales. **The haul lands in the Stores as Raw Fish** - one material, tier 1, 1 Mark - the species named in the toast
("+2 Largemouth Bass, as Raw Fish"). Withdrawn to the pack, Raw Fish becomes the template Foraging's own code would
make: C&C's Raw Fish (535) while C&C is on (FACT, C&C's food table keys its cooking on it, `src/systems/survival/food.js`),
else Foraging's Fish (1605). A **trophy** is the species' own Deep Waters template, straight into the pack as decor.

### 5.3 The world answers

- A felled tree, a spent vein, a picked patch and a skinned body are gone **for you for the rest of the UTC day** - a
  patch once both its harvests are taken (its herbs, and the Basket's food).
- The sounds are ~~DFU's own from the player's data (the wood and stone hits, the splash)~~ the port's own on the
  enhanced skin - the axe in the wood, the pick on the stone, the leaves, the knife, the net, the tree's groan and fall,
  each heard as its blow lands (GATHER-FEEL, section 44) - and DFU's own on the classic skin (`systems/professions/profSounds.js`),
  and Immersive Footsteps' and Better Ambience's where they are on.
- Weather and the hour matter: the net fills fastest in the first and last daylight hours (07:00-07:59 and 17:00-17:59 -
  a bonus; ANY-HOUR: the wilderness no longer closes at night); rain wets the herbs (the steady window -20%); a storm
  drives the fish deep (longer waits, bigger fish).

## 6. Nodes

- **The law** - nodeLaw.js: for a map pixel and a UTC day, `hash(NODE_SALT, pixelX, pixelY, day)` gives the day's
  node set from the pixel's climate. A node id is `(pixelX, pixelY, day, slot)`. The **client places** each node on
  the ground from its own terrain (the nearest suitable anchor: a rock-field prefab or terrain rock for a vein, a tree
  flat for a tree, a plant flat or an open patch for an herb). The **service** knows the id is real from the law; it
  knows the pixel's **climate and region** only from **the witnessed world** (SEAT0 3.2): the harvest request carries
  the pixel's climate and region as the client derived them, and the service keeps them as a witnessed row. A pixel
  **confirmed** by 3 accounts yields its whole table; an **unconfirmed** pixel yields tiers 1-2 only - its veins 1-3
  since UNWITNESSED-ORE, below - (so a lie about a pixel nobody else has walked buys little); a **disputed** pixel (two witnesses agreeing on another answer) keeps its confirmed table until a moderator settles it (SEAT0 3.2).
- **The ground** (ETHER-NODES, 2026-10-12, the owner: "We also need to implement gathering nodes within the area";
  `03-World/Eltheric-Ocean.md`): a map pixel is the Bay's 1000 x 500 or the Eltheric Ocean's box past the Veil
  (`pixelOk`) - its isles stand the day's nodes by their climates, its water the schools, and an id there is read four
  digits east and a sign north (`herb:8009:-5194:...`), in its one spelling. The law knew the Bay alone: an isle's
  harvest was refused `bad-node`, its witnesses `bad-pixels`. The service at acct124; `world/ethericSea.js` in the account
  deploy's path filter (the law imports it). The ground's one home is `ethericSea.js` `onBayOrEther` (ETHER-OW,
  2026-10-13: the Overworld's bands and raiders are born on it too; the law's answers unchanged). A Motherlode is not
  sited there (AUDIT ETHER-OW C2-1, `01-Overview/audits/Audit-Ether-OW.md`): a strike asks the relay's Watch receipt of the
  site's pixel, and the Watch's ground is the Bay's map (`net/watchReceipt.js` `watchPixelOk` - one home, the relay's mint,
  the service's receipt and `motherlodeSites` reading it); the isles' confirmed pixels are never a site. The service at
  acct125, the relay at world199 (its answers as they were).
- **How many** - per wilderness map pixel per day, never inside a location's rect:

| Climate | Trees | Herb patches | Veins | Boulders (quarry) |
|---|---|---|---|---|
| Woodlands | 12 | 8 | 4 | 3 |
| MountainWoods | 10 | 6 | 6 | 4 |
| Mountain | 4 | 4 | 12 | 5 |
| HauntedWoodlands | 8 | 8 | 4 | 3 |
| Swamp | 6 | 10 | 2 | 0 |
| Rainforest | 12 | 10 | 2 | 0 |
| Subtropical | 8 | 8 | 4 | 3 |
| Desert, Desert2 | 0 | 6 | 10 | 5 |
| Ocean | - | - | - | - (fishing only) |

BOULDERS (FIELD BUGS 2026-10-01, Mac: "Fix the rest"; the service's acct47): the boulders were 1 / 2 / 3 / 1 / 0 / 0 / 1 / 3 - a rock field stood one or two a day in the woods. The fields' pieces now hold a node on each side (ROCK-SHARE, section 23), so the counts are raised; the Swamp and the Rainforest keep none (their Court writs ask no stone).

MORE-NODES (2026-10-02, Mac: "increase all profession nodes", asked: "Double"; the service's acct48): the trees, the herb patches and the veins twice what they were, every climate (the table above). The day's sixty a profession (and the account's bound) are unchanged, so what doubles is how close the next node stands, not what a day yields (CAP-OFF, 2026-10-07: the sixty and the account's bound are gone - the nodes and the walk between them are the day's whole bound). A signature region's veins stand in the slots after the climate's (a Mountain's thirteenth, Daggerfall's fifth and sixth in the woods).

JUNGLE-WOODS (2026-10-19, the owner: "The forest region we recently implemented should be a large tree gathering spot. Moreso than other places within daggerfall"; the service's acct161, acct159 then acct160 on its branch, renumbered past QL12 and WB14 at the merges): a map pixel of the Jungle of Bantha - the owner's area, `world/jungle/banthaArea.js` (`03-World/Bantha-Jungle.md`) - stands **48 trees a day** (`net/nodeLaw.js` `JUNGLE_TREE_SLOTS`), four times the richest woods' anywhere else (the Woodlands' and the Rainforest's 12), so the next tree stands about half as far; whatever the pixel's climate (the area holds the Rainforest and, in the Dragontail foothills, the Mountain), none where no wood grows (`treeSlots`). And **every jungle slot stands a tree**: a slot whose wood waits on the witnesses - an unconfirmed Rainforest's Teak and Mahogany, past tier 2 - stands Pine there, where elsewhere it stands nothing (PINE-SHARE left 3 in 5 of an unconfirmed Rainforest's slots empty, so the jungle stood about 5 trees a pixel until three accounts vouched for it); on confirmed ground the jungle's own woods and the rare Ironwood stand as the Rainforest's do. The law is the area's, never the Features row's: the service recomputes every tree from it (the harvest's slot check reads `treeSlots` beside a vein's `veinSlots`), and a room has one jungle - offline with the jungle off, the area's count stands at DFU's palms. The jungle's ~5,400 tree flats a pixel carry them easily (`scenes/treeHost.js` `standTrees`, its rock check now asked once a flat, not once a flat a tree). `world/jungle/banthaArea.js` joins the account deploy's path filter (the law imports it). Pinned by `test/net/junglewoods.test.js` (5) and `tools/mutants/junglewoods.json` (12, all dead).

UNWITNESSED-ORE (FIELD BUGS 2026-10-09e, the Discord's "Mining veins": "I mined about 200-300 veins of iron, but there were not a single vein of silver, gold, platinum or mithril in the mountains ... maybe Mountain area and MountainWoods area are bugged"; the service's acct102): not a bug - the law. A vein on a pixel nobody else had vouched for was held to tier 2, and the Mountain's table holds Iron at 1 and nothing again until Silver at 3: every mountain pixel a lone miner worked stood Iron alone, the Mountain Woods never its Silver, and a lone miner's word confirms nothing (three accounts a week old, the witnessed world above), so the far mountains never came to the rest. A vein on such ground is held to `UNCONFIRMED_VEIN_TIER`, 3 (`net/nodeLaw.js`, the one cap the wilderness vein and the Court's vein metals read - and the deep vein, until DEEP-OPEN, section 50, drew its whole table on anyone's word) - so the Mountain stands Silver beside its Iron (73 : 27 by the weights) and the Mountain Woods its Silver beside its three; no other climate's table holds a tier 3, so no other ground moves. Gold, Platinum, Mithril and a region's signature still wait on the witnesses, and a lie about a pixel buys Silver at most. The herbs and the trees keep 2. The Mining page says so in the player's words (`ui/professions/profPages.js` MINING_GROUND_LINE). PIN MOVED: PROF2's "an unconfirmed Mountain pixel yields Iron alone" (`test/net/prof2_law.test.js`). Pinned by `test/net/fb1009e_unwitnessedore.test.js`; `tools/mutants/fb1009e_unwitnessedore.json` (4, all dead). ORE-MAP (`01-Overview/bugs/Field-Bugs-2026-10-11d.md`): the held map's bare ground says it for a place - its veins, its dungeons', its kingdom's own ore and whether its ground is witnessed (`ui/oreMapTip.js`).

GATHER-OW (2026-10-02, Mac: "allow them to appear in the overworld without being overwhelming, maybe a glyph marker showing where a group of them are"; asked: "Groups nearby"): on the Overworld each profession's group on a stood pixel - its nodes not yet worked today, as NODE-MARKS would mark them - is one diamond in its compass colour at their middle, its count beside it ("Mining ×6"), the nearest twelve within 3 km (the land streams three pixels out), read again twice a second; the view's filters have a Gathering switch. Not a click of its own: a click there walks to the ground under it. None with the professions shut, nor underground; Hunting's bodies are no group. `scenes/gatherHost.js` overworldGroups, `systems/travel/travelViewFilters.js`, `ui/travel/travelViewHud.js`, `scenes/travelViewMarks.js` travelViewMarks (out of world.js since HOST-SPLIT 1).

- **A node's tier** rolls on the climate's table, higher tiers rarer (tier 1: 40%, 2: 25%, 3: 15%, 4: 10%, 5: 6%,
  6: 4%); a region's signature (4.7) replaces one vein a pixel with its signature ore.
- **Dungeon veins**: each dungeon holds `hash(NODE_SALT, mapId, day)` **1-4** veins a day, placed by the client on its
  own RDB walls; tier 3-6; Dwarven Scrap and Adamantium are found only here (and 4.7's places); Diamonds only here.
  DEEP-OPEN (section 50): a dungeon nobody has vouched for draws the whole table on anyone's word - but its climate's
  Moonstone, the witnesses' still - four veins a day an account in such dungeons.
- **Fishing spots**: any water the net works in (FORAGE0 6.4). A **school** (a ripple on the surface, 2 a coastal pixel
  a day) gives a haul +1 fish (Netter +2). A haul names no node, so Fishing, like Hunting, is **bounded, not
  witnessed** (below).
- **Per character, never contested**: each character sees every node and takes each once a day. No stealing, no
  camping.
- **Motherlodes** - the contested ones: **3 a day** server-wide, at a pixel from `hash(MOTHERLODE_SALT, day, k)`,
  announced by the hub **10 minutes** before (Motherlode Sense: 30): a tier-6 vein that yields to the **first 20
  characters** to strike it, each finding **10 Marks** besides the ore. A strike counts only from a socket the relay
  holds in the Motherlode pixel's cell room (a client's position is its own claim, so this is a bound, not a proof),
  and an account takes at most **one Motherlode a day**. A Motherlode, like a dungeon vein, keeps no hours: it may
  be struck by night. PROF2b (BUILT 2026-10-03, section 38) DECIDED what this left open: the pixel is one the witnesses
  had confirmed before the day began (the service holds no map), the hub's warning is every client's own off the
  shared clock (the gate omen's way - no relay change), the relay's socket check is its Watch receipt (`k1`) for the
  Motherlode's own pixel, and a strike asks Mining 25, not tier 6's 90.
- **Hunting cannot be witnessed** - FACT, a foe's life and death are its spawner's client's alone ("A FOE IS ITS
  SPAWNER'S: the spawner steps it and streams it, everyone else in the cell puppets it", WORLD6b, `src/net/wire.js`;
  AUDIT 28 replaced a quotation that is nowhere in the tree). So Hunting is the one bounded profession: ~~at most **30 hides a day** an account, of which~~
  at most **3** of tiers 5-6 a day an account; the tier is the foe's the client claims, and ~~the cap is the whole defence~~ that
  bound is the defence of the rare (CAP-OFF, 2026-10-07: the thirty of any tier are gone, Mac's word - the three he kept). **Fishing**
  is the other: ~~**40 hauls a day an account** (not a character)~~ (RETIRED, CAP-OFF, 2026-10-07: the hour's writes bound it), the water the client's own claim, the pixel's
  climate and region from the witnessed world; an unconfirmed pixel's hauls bring no Pearl and no Slaughterfish.
- **Gate-touched ground** (4.7) is the day's gate pixel from the witnessed world (SEAT0 3.2), so its veins exist only
  once three fighters' receipts agree where the gate stood.
- **The harvest**: after the act (section 5), the client asks `{node, kind, character, act, at}` - `kind` is herbs or
  food at a patch (the Basket's second harvest), the node's one kind elsewhere; `at` is the act's end on the shared
  clock. The service checks the id against the law for today; ~~the cap (**60** harvests a gathering profession a day a
  character, the Basket's among Herbalism's; Fishing **40** hauls an account)~~ (RETIRED, CAP-OFF, 2026-10-07); that this character has not taken this
  `(node, kind)`; and **the hour** - `at` no more than 10 minutes past (the queue's bound, section 19) and, for a
  surface node, inside 07:00-17:59 on `sharedClassicMinutes` (`src/net/wire.js`), a pure function the service
  computes itself. It rolls the yield (CSPRNG), applies the act's bounded step, and adds to the Stores as **own**.
  Travel time is the natural limit; ~~the cap is the honest one~~ - and since CAP-OFF the only one: no day's cap stands
  (CAP-OFF, 2026-10-07, Mac: *"Remove the cap on life skills"*; section 40).
- **Yields** (before the act): a tree **2-4** logs; a vein **2-3** ore (+ the gem chance); an herb **1-3**; the Basket's food **1**, **1-2** or
  **1-3** by the patch's block (FORAGE0 14.6); a hide **1** (+ the ingredient chance); a haul **1-2** fish; a boulder
  **3-5** Rough Stone. **The order**: the base roll, then the act's step (at most x1.5), then a march's +25% (4.7), then
  a Tide's (SEAT0 9.3), then a school's +1; a fraction of a unit left at the end is that chance of one more, on the
  service's dice.

## 7. The Stores

- A per-character inventory on the service, at most **5,000** of any one material. The player reads "the Stores";
  the code says **`profStores`** (tables `prof_stores`, `guild_prof_stores`) - FACT, `src/systems/features.js`
  already exports a `STORES` (the three preference stores), and one word must not name two things.
- **The Stores tab** (section 8) is the only place a Stores material is seen. Moving to the pack is allowed (one-way, law 3);
  a pack item moves into the Stores only by BAG1's and BAG-CRAFT's doors (`Materials-Bag.md` 5, 14): a unit the service
  handed out and still counts as carried moves back (law 3, restated), and a station's shortfall moves what the pack
  holds, counted or not, as loose (a station's alone); the Stores are **kept in town** - put in and taken out in any town, read
  anywhere - and a harvest goes into the Materials Bag or the pack, never straight into them.
- **Origin.** Every unit is **own** or **bought** - or, GOLD-MARKET (10.8), **gold**: bought on the market with gold,
  which goes to the pack or back on the market for gold and to nothing else - or, AUDIT BAG-CRAFT (`Materials-Bag.md`
  15), **loose**: a station's put-in from the pack that the service never handed out, which goes to a station (spent
  first) or back to the pack uncounted and to nothing else; a smelt's products of it are loose, a craft's piece of it
  lists for gold alone. Own: this character's harvest (section 6), a craft whose every input
  was own (section 9), Disenchanting's Essence from an own provenance item (one this character made, never sold), a
  Siege Honour's Spoils. Bought: a market purchase, a filled buy order, a counter's goods (4.5), a craft with any
  bought input, Essence from any other provenance item. A craft spends bought units first, so a character's own stay
  for writs. A unit keeps its origin through a writ's refund, and through the guild Stores only for its depositor: a
  member's own deposit is own again when that member withdraws it, and bought to any other member who withdraws it -
  so an Officer cannot turn a guildmate's harvest into their own influence. A sale makes it bought for the buyer. Only own units raise influence at their
  value (section 11; SEAT0 4.2), so Marks cannot buy influence past Tribute's rate and cap.
- **Food keeps** in the Stores (a warehouse, not a pack); C&C's spoiling starts when it is withdrawn.
- **Guild Stores**: a guild warehouse at its hall and any seat it holds: any member deposits from their Stores;
  Officers and the Guildmaster withdraw; every movement on a ledger (the guild ledger's trigger pattern). BUILT
  (PROF6, section 28: on the Guild tab, since no hall stands; 50,000 of a material).
- **Seat stockpiles** (SEAT0 7.5): the holder's (fortifications), filled by the seat's writs (section 11) and the
  Levy - the Levy fills only the holder's - and each pledged challenger's **Siege Camp** (siege works), filled only by
  its guild's writs and **spent at the Turning**: a Ram Kit to the siege it won, the rest burnt.

## 8. The interface

DECIDED (Mac: "actual UI integration for life skills"). Everything is drawn in the Enhanced Plus UI - the one UI
since MENU-TOGGLE and PLUS-DEAD - in its brass and bone, scaled by the UI scale,
laid out for the phone's touch layer as for the desktop.

- **The prompt**: bottom centre above the hotbar - "[E] Chop Oak - Logging 34". **The hover** (World Tooltips):
  "Oak - tier 2 - 6 chops - taken today: no"; at a patch, "Red Rose - herbs: taken - food: no". At a node that cannot
  be worked the prompt says what it needs ("[E] Mine Silver - needs Mining 25"), E goes on to the door, the chest or
  the foe beside it (AUDIT 29 C1), and when nothing else takes the press the node says its need as a toast, the
  player's own rank beside a rank short - "Mine Silver: needs Mining 25 - your Mining is 0" (VEIN-NEED,
  `01-Overview/bugs/Field-Bugs-2026-09-29h.md`).
- **The act's meter**: centred on the crosshair, 160 px across at 1080p (30% larger on touch); the ring, the glint,
  the hold meter, the search, the trace and the haul bar each have a still form for Reduced motion.
- **The haul**: toasts on the right, 4 at most, 3 seconds each - "+3 Oak Logs to your Stores", "+45 Logging XP
  (Clean Cut x2)", "Logging 34 -> 35"; a rank-up banner at 25, 50, 75 and 100, and at 50 and 100 the specialisation
  choice opens. **HAUL-CARDS** (2026-10-03, below): on the Enhanced Plus skin the goods and the XP are one CARD under
  the crosshair instead, and silver is a card wherever it is struck; the rise, the banner and the refusals keep their
  toasts, and the classic skin keeps every line.
- **The day's ~~cap~~ count**: a chip under the compass - ~~"Logging 34 / 60 today"~~ "Logging 34 - 12 today" (CAP-OFF, 2026-10-07: the
  count alone, no cap after it).
- **The Professions tab** (character sheet): a left column in two groups (Gathering, Crafting) - each row the icon,
  name, rank, rank's name and a thin bar; the right pane for the chosen one - XP to the next rank, the specialisation
  cards (choose one), the unlocks by rank (tiers, recipes), today's harvests, and "Crafts above Journeyman: 1 of 2".
  **How it is done** (TOOL-SAID, FIELD BUGS 2026-09-30b; CRAFT-HOWTO, FIELD BUGS 2026-10-18d): under the XP line, a
  paragraph says how the chosen profession is practised. A gatherer says how it gathers (`ui/professions/profPages.js`
  `GATHER_HOW` for Herbalism, Mining and Logging, Hunting's own line, `FISHING_HOW`, and Mining's ground line under its
  own). A craft says where its stations stand, that they are worked from the Stores page (Holdings > Stores), what
  they make of the gathered goods and what earns its XP (`CRAFT_HOW`: Smithing, Building, Outfitting, and Provisioning's
  cooking after its brew, `ALCHEMY_HOW`; Enchanting's is `ENCHANTING_HOW`). Each paragraph is read in the player's
  language when the page is drawn. Until CRAFT-HOWTO, Smithing, Building and Outfitting showed their specialisation
  cards and nothing else, and Provisioning never named Cooking (MoonGeneral, the Discord's #bug-reports: "when it comes
  to the crafting skills you no explanation there"). THE WORDS ARE THE CODE'S: the shops a craft names are the ones the
  interior host's station questions answer (`scenes/worldModes.js` forgeHere, jewellerHere, workbenchHere, masonHere,
  loomHere, alchemyHere, enchantHere), with the home's own station, a joinery's bench (`scenes/world.js` workbenchHere,
  CARP-YARD) and any lit fire (`COOK_FIRE`). The works are `SMELT_RECIPES`, `SAW_RECIPES`, `CURE_RECIPES` and
  `MASON_RECIPES`; a saw and a cure pay no XP. The anvil's own refining of raw ore is CRAFT1's chain (41.3). The brew's
  words say the pack as well as the Stores, since the brew reads both (BAG-CRAFT, `Materials-Bag.md` 14). The
  Tutorials' Crafting page (`10-UI/Tutorials.md`) is the same map in short. Pinned by
  `test/ui/professions/fb1018d_crafthowto.test.js`; `tools/mutants/fb1018d_crafthowto.json` (23, all dead).
- **The Stores tab**: a grid of materials with counts, each count split own / bought on its card; filters (Ores and
  Metals, Wood, Herbs, Food, Hides and Cloth, Stone, Gems, Essences, Spoils of War), a search box, sort by tier, name or count; a material's actions - **Withdraw to
  pack** (a quantity), and at a Notice Board **List** and **Deliver to a writ**. BAG1 (`Materials-Bag.md` 4): what is
  carried beside each count; **Take out** (into the bag, then the pack), **Put in** and **Put everything in** - in town.
- **A station**: left, the recipe list (filters: Can make now, All known, by tier); centre, the recipe - its inputs
  (have / need, from the Stores), the product as an item card, a bar of its quality odds (9.2); buttons **Craft**
  (plays the act, 9.4), **Quick craft**, **Craft x N** (quick, up to 10); right, the act's panel while it plays.
- **The held map** marks the patches and veins a character has worked before, and a Prospector's veins.
- **Keys** from KB1's registry, under a Professions group in Controls: Interact (E), attack, Esc, and an **act
  choice** key, chosen from the free keys at PROF1 (KB1's rule: one key, one action; Mac's four calls stand): at a
  patch it switches E between the herbs and the Basket's food, and the prompt says which ("[E] Pick Red Rose" /
  "[E] Search with the Basket"). E starts the herbs first while they are untaken.
- **The pad**: A / Cross interacts, RT acts, the right stick traces and aims. **Touch**: tap the node; the act's
  buttons on screen.

### HAUL-CARDS - what a gather, a strike or a claim gave, as cards (2026-10-03)

(Mac: "Im wondering with popups for obtaining silver and harvest items. We need a better enhanced plus UI element for
when people gather these items"; a mockup of four screens answered; then "Dude this is sick".)

**What was found (FACT).** A harvest's answer was three to five lines on the right - the goods ("+3 Iron and an Amber
to your Stores"), the XP, a rank's rise, a Motherlode's silver - no picture, no tier, no Stores count, four at most
(GATHER-SAID had to keep the goods' line from being pushed out by its own XP). A raid's or a gate's silver, a guild
deed and a contract's pay were said in the chat alone. The enhanced skin already had a better face for a gain: the
loot's PICKUP-FEED (`ui/pickupFeed.js`, `01-Overview/bugs/Field-Bugs-2026-10-01d.md`) - cards under the crosshair, a picture,
a tier's colour, a bump that adds.

**DECIDED: the pickup feed carries them, one family, one band** (Mac's mockup: the centre, the loot's own place - a
gather ends at the crosshair, where the eye already is; the tiers in the loot's colours). `src/ui/haulCards.js` turns
each answer into cards (pure); the feed (`showHaul`) draws them beside the pickups:

- **A harvest** - one card: its material's picture (the pack's own item, as a withdrawal mints it - `mintMaterialItem`
  over `inventoryItemImage`, fitted to the card's 32 px), "+3" and the name in its tier's colour (1 and 2 plain, 3
  magic's blue, 4 rare's gold, 5 legendary's orange, 6 artifact's violet; none with the loot's tiers off), a STORES tag
  with the count after it (own, bought and gold's - the goods are never in the pack), the XP on the same card and its
  rank's progress a bar, a clean act's or the act's own words its head. A gem and a second find (PROF4's Resin, PROF7's
  butchery) each their own card; PROF8's catch named by its species (`haulName`), the Raw Fish its sub. The same goods
  again inside the card's hold BUMP it: the counts and the XP add, the Stores, the rank and the bar the newest's.
- **A Motherlode (PROF2b)** - ONE card, held five seconds: its ore, its 10 silver and its twenty ("4 / 20 miners"), its
  tier-6 glow; Mining's kind is told the card said the silver (`answered(d, toast, { hauled })`) and keeps the balance
  without a line.
- **Silver** - a coin card: "+30 silver", its source ("Town defended", "Breach closed"), the balance, and a combat
  strike's day as a bar ("Combat today 120 / 150"); a guild deed brass, into its treasury ("Guild deed - to The HND
  Guild"); each contract by its guild's tag and its tax; a strike the day's cap refused a muted card. The chat keeps
  every line - the record; the card is what the eye catches (`scenes/world.js`, the raid's and the gate's `onMarks`).
- **The law** the feed gained: a card its own hold (a gather's 3.2 s, a Motherlode's 5 s), a bump's `adds` and
  `latest`, and the band measured card by card (a haul card is taller than a pickup's). Every haul card is built once,
  its words rewritten at a bump (the rule the feed's header gives - no per-frame rebuild).
- **Not changed**: the rise's toast and banner, the Stores' way said once a session, a refusal and a kept or lapsed
  harvest - words about the act, not a gain, keep their toasts; the classic skin says every line exactly as before
  (`showHaul` answers false and the host says them - so does a face that cannot draw). A Court writ's pay is said in
  the Notice Board's own window, where it was asked, and stays there.
- **Seen**: `tools/pickupFeedProbe.mjs` gained four scenes (a bumped vein and its gem, a raid's three silver cards, the
  cap beside a pickup, a Motherlode) at 1280x800 and on a phone - 318 checks: no card over the plaque, the mid-screen
  line, the HUD's foot or above the crosshair.
- **FOUND on the way** (the full suite's run): AUDIT SILVER-WAYS B1's second race pin read the pair of claims by who
  asked first - under the suite's load the scheduler lets either held batch go first, and it failed one run in a few;
  it reads them by what each was paid now (its two mutants still dead). And the card's head and STORES tag were drawn
  at 10 px, under the face's 11 px floor (FONT3) - 11 now.
- **Pinned**: `test/systems/foraging/haulcards.test.js` (9); `tools/mutants/haulcards.json` (34, all dead). PIN MOVED: pickupfeed (the
  reduced-motion rule, the world host's import), prof8_client (the kind told `hauled`), silverways_client and marks1
  (the claims' `onMarks`), auditsilver_service (B1's pair by its pay); `10-UI/UI.md`'s module count (290). Mutant
  records re-aimed by content: pickupfeed (five), gathersaid (the goods unkept), prof2b (the silver unsaid);
  pickupfeed.json and gathersaid.json run whole again, 67 dead.

#### AUDIT HAUL-CARDS (2026-10-03, Mac: "Audit this")

Three independent passes read the PR cold - the feed's law and face (scripts over the real module and the real sheet in
Chromium), the cards' data against every kind's old lines (every material key run), and the look in a real browser
(74 runs: long names, mixed stacks, HUD scales 0.75-1.5, the Plus themes, reduced motion) - and the author's re-read.
FOUND, each fixed and pinned (`test/systems/foraging/haulcards.test.js`, `tools/mutants/audithaul.json`):

- **MEDIUM - A1: a card the band put out flickered every frame.** A hidden card measures nothing and was read as the
  first card's height - a tall harvest card under three pickups in a 129-155 px band "fitted" the next frame, stood
  (18 px into the HUD's foot), and went again, for its whole hold. FIXED: each card keeps its last height seen.
- **MEDIUM (HIGH on a phone) - A2/C1: the day's cap note ran out of its card** - 59 letters, `nowrap`, 96 px past a
  phone's card and off the screen. FIXED: it wraps.
- **MEDIUM - C2: at a HUD scale over 1 a card ran off a phone's edges** - its width was the screen's before the
  scale's transform. FIXED: `88vw` and `92vw` divided by the HUD's scale (the pickups' cards with them).
- **MEDIUM - C3: a long source cut "silver" itself** ("+1,250 silv..."), and a contract with no tag lost its tax. FIXED:
  the sub gives way first, silver's own word never; the tax before the guild, grouped (C7).
- **MEDIUM - C4: on the Stone theme the feed fell to 2:1** - its light panel (luminance 0.10) under the brass head, the
  muted note, the tag's border and the tiers' colours. FIXED: a theme whose panel is lighter than 0.06 veils the feed in
  its ink (Stone alone; the pickups' cards with it); the tag's border the lit stone; the note's words the light stone.
- **MEDIUM - B1: every `gem` was "a gem"** - a tree's Heartwood and a body's Big Tooth with it. FIXED: a gem's alone.
- **LOW - B2: a bump kept the first act's head** - a torn pelt then a clean one read "A TORN PELT" over both. FIXED: the
  newest act's words (none for a plain act).
- **LOW - B3: a find's card said "Stores" with no count** though the answer carries `gemStore`/`extraStore`. FIXED.
- **LOW - B4: a Motherlode's card dropped the purse** its suppressed line had said. FIXED: "you hold 1,380" beside its
  silver.
- **LOW - A3: a harvest answered with a window open had its card taken down unseen** (the plaque's hide clears the
  feed) and its lines unsaid. FIXED: the card only on a live world; else the lines as ever.
- **LOW - A5: the theme's tint overrode the note's veil; a Motherlode with no silver still showed a coin.** FIXED: the
  note wears the theme's veil; no silver, no coin.
- **Not changed, named (C6)**: at a HUD scale of 1.5 the band holds two haul cards, and a newer batch can keep an older
  card out until its hold runs out - the feed's own law for every card (the oldest wait unseen, PICKUP-FEED).

CHECKED, SOUND (the passes): pickup and haul keys never meet; a card's kind never changes, so paint's branch holds;
twins in one push and a bump in the same push raise one bump and rewrite the words; no card stands for ever; the
heights read in the order the cards stand; a silver or note card never asks for a picture; a fitted icon is cached by
its box; the watchdog and ticker armed as a pickup's; every note an act says parses to its head; a kept answer's card
right (a Motherlode's included); every gathered material's picture real and its tier sane; a refused claim shows no
card; the classic skin builds nothing.
- **Pinned**: `test/systems/foraging/haulcards.test.js` (14 - five the audit's); `tools/mutants/audithaul.json` (20, all dead). PIN MOVED:
  haulcards (the contract's words, the live world, the Motherlode's purse). Re-aimed by content: haulcards (three); the
  haul list run whole again, 34 dead; pickupfeed.json and gathersaid.json again, 67 dead; the probe 319/319.

## 9. Crafting

### 9.1 The act of crafting

- The player opens a station, chooses a recipe they know, and plays its act (9.4) or skips it.
- **The service crafts**: it checks the recipe, the rank and the Stores; takes the inputs; rolls the quality (9.2);
  and answers with a **signed product record**: the DFU template, the material, the quality, the maker's name, and a
  **provenance id** (16 hex digits from the service's CSPRNG, unique across the server). The client adds the item to
  the save as a shop purchase adds one.
- **Recipes known**: most unlock with rank (their tier's rank); some are **found** (a Recipe Scroll, 1 in 500 from
  loot, 1 in 20 from a Motherlode); a few come **only from writs** (a guild's or seat's posted recipe reward).

### 9.2 Quality

| Quality | Effect (within DFU's bounds for the template and material) |
|---|---|
| Crude | condition max -25% |
| Standard | DFU's own item |
| Fine | condition max +15%, weight -5% |
| Superior | condition max +30%, weight -10%; one Loot Rarity **Magic** roll |
| Masterwork | Superior, and one Loot Rarity **Rare** roll, and the maker's mark in its name ("Silverthorn's Mithril Longsword") |

The roll, by the **margin** (the crafter's rank minus the recipe's rank):

| Margin | Crude | Standard | Fine | Superior | Masterwork |
|---|---|---|---|---|---|
| 0-9 | 20 | 60 | 20 | - | - |
| 10-24 | - | 50 | 40 | 10 | - |
| 25-44 | - | 20 | 50 | 28 | 2 |
| 45+ | - | - | 40 | 52 | 8 |

Then **+1 step** each, at most: a seat's Forge / Workshop / Apothecary (SEAT0 7.5); a clean act (9.4); a
specialisation that says so; Heartwood or a Warforged ingot among the inputs. Masterwright adds 5 points to
Masterwork. Nothing passes Masterwork.

CRAFT-PROCS (FIELD BUGS 2026-10-13e; a player: "Added potency and cast speed, cast cost affixes are not rolling on
crafted jewelry"): the roll is the loot door's whole roll now. The mint took the tier's `applyRarity` and never the
door's last pass, and every line that does something is drawn in that pass alone (LOOT4), so no crafted piece carried
one. A Superior and a Masterwork take the pass after the roll, on the same stream off the
record's seed (`systems/smithItems.js` mintPiece, `systems/loot/lootRarity.js` lastPass): one such line, 20 times in 100 on a
Superior and 35 on a Masterwork, as a loot door's Magic and Rare take it. A jewel's is focus, castSpeed, potency or
wellspring, a weapon's one of five, armour's thorns, and the Loot Rarity switch is not asked (the piece is its record's
on every client; the line's reader asks it). THE RECORD SAYS WHICH LAW MINTS IT: the service stamps `v` 1 at the craft
(`net/productRecord.js` MINT_VERSION), a temper's re-sign keeps the craft's, and the market's piece carries it
(`server-account/src/market.js` pieceOf). A record made before has none, and mints as it always did wherever it is
minted again. The service at acct126; no migration.

### 9.3 The recipes

**Smithing** (a forge: a home station, or any Weaponsmith or Armorer for a 50-gold use fee to the shop):

| Product | Ingots | Also |
|---|---|---|
| Dagger, Tanto | 1 | 1 Tin |
| Shortsword, Wakizashi | 2 | 1 Tin |
| Broadsword, Saber, Longsword, Katana, Mace, Flail | 3 | 1 Copper, 1 Cured Leather |
| Warhammer, Battle Axe, War Axe | 4 | 1 Copper, 1 Oak Plank |
| Claymore, Dai-katana | 5 | 1 Copper, 1 Cured Leather |
| Cuirass | 6 | 2 Cured Leather |
| Greaves | 4 | 1 Cured Leather |
| Helm, Buckler | 2 / 3 | 1 Cured Leather |
| Left / Right Pauldron, Gauntlets, Boots | 2 | 1 Cured Leather |
| Round / Kite / Tower Shield | 3 / 4 / 5 | 1 Oak Plank |
| Chain pieces | as the plate piece, x 0.75 (rounded up), Steel only | - |
| Repair Kit (repairs 25% of an item's condition, once) | 1 of the item's metal | 1 Cured Leather |

The ingot is the material: Iron Ingots make Iron, and so on to Daedric. The recipe's rank is its material's tier
(4.1).

**The tools** (FORAGE0 14.7) - Foraging's own templates, their quality on their life (Crude 37 uses, Standard 50,
Fine 57, Superior 65, Masterwork 65 and the maker's mark; no Loot Rarity roll): Smithing makes the Wood-Axe and the
Pick-Axe (2 Iron Ingot, 1 Pine Plank), the Sickle and the Skinning Knife (1 Iron Ingot, 1 Pine Plank) at rank 0, and
the Spade (2 Iron Ingot, 1 Oak Plank) at rank 10; Outfitting the Fishing-Net (2 Linen Bolt); Carpentry the Basket (2
Pine Plank). A tool wears out every 50 harvests, so the crafts are never out of work.

**Outfitting** (a tanning rack or loom: a home station, or any Clothing store for 50 gold): leather armour - Cuirass
6, Greaves 4, Helm 2, Pauldrons 2 each, Gauntlets 2, Boots 2 Cured Leather (Hardened Leather for the tier 4-6
leathers' step); clothing - small garments (Straps, Armbands, Sash, Shoes, Sandals, Brassiere, Tights) 1 bolt, middle
(shirts, tunics, pants, breeches, skirts, vests, the Eodoric) 2, large (robes, gowns, cloaks, dresses, the Khajiit
Suit, the surcoats, the Kimono) 3, boots +1 Cured Leather; the cloth's tier sets the garment's step (Linen 1, Wool 2,
Silk 4, Standard-bearer's Silk 5). Rugs 3 Wool, tapestries 4 Wool + a dye, Large / Small Skins 2 / 1 of a hide (DFU's
furniture 237-245). Dyes: `itemDye.js`'s colours; Couturier two at once.

**Carpentry** (a workbench): Staff 3 planks; Short Bow 3 planks + 1 Resin; Long Bow 4 planks + 1 Resin; Arrows x 20:
1 plank + 1 Iron Ingot + 1 Harpy Feathers (or 4 Twigs, one step lower); DFU's furniture in its own wood - beds 8
planks + 2 Linen, large tables 6, small tables 3, chairs 2 (an Oak Table in Oak, a Teak Chair in Teak); the **Ram
Kit** (rank 60): 40 Oak Planks, 20 Iron Ingots, 4 Bear Hides; the bow's or staff's material step is its wood's tier.

**Masonry** (a mason's bench): Cut Stone and Mortar (4.5); stone decor (Sculptor): a column, a bench, a font, a
statue plinth (DECOR pieces); the fortification components are delivered as Cut Stone and the other materials SEAT0
7.5 lists, straight from the Stores.

**Jewelcrafting** (a jeweller's bench, or any Pawn Shop or Gem store for 50 gold): Ring - 1 Silver, Gold or Platinum
(+ a gem); Mark - 1 metal + 1 gem; Bracelet - 2 metal; Bracer - 2 metal + 1 Cured Leather; Amulet - 2 metal + 1 gem;
Torc - 3 metal; Cloth Amulet - 1 Linen + 1 gem; Wand - 2 Ironwood or Ghostwood Planks + 1 gem. The piece's
enchantment points: Silver +0%, Gold +10%, Platinum +20%, a set gem +10% (Gemcutter +10% more).

**Cooking** (any campfire, hearth or brazier; C&C's Skillet widens the fire's window). Every input comes from the
Stores - Hunting's Raw Meat and Fishing's Raw Fish land there, Herbalism's plants, and the Basket's foods (Apple,
Orange, Mushroom, Egg - Foraging's own, `06-Systems/Foraging.md`) - and every dish goes to the pack:
**Hunter's Stew** - 2 Raw Meat, 1 Mushroom, 1 Root Bulb: C&C's hunger filled, Endurance +5 for 2 game hours;
**Fisherman's Supper** - 2 Raw Fish, 1 Egg, 1 Green Leaves: Agility +5 for 2 hours; **Orchard Tart** - 2 Apple, 1 Egg,
1 Yellow Berries: stamina regained +20% for 4 hours; **Feast of the Hearth** (rank 70) - 4 Raw Meat, 4 Raw Fish, 2
Apple, 2 Orange, 2 Mushroom, 2 Egg: the whole party (the party's buff frame, PARTY-BUFFS) Strength, Endurance and
Willpower +5 for a game day. C&C's own cooking at a fire (its Raw Fish and Raw Meat from the pack, or the Materials
Bag - BAG-COOK, section 35) is C&C's, untouched, and earns no Cooking XP - the service did not see it.

**Alchemy** - two doors, one book. DFU's own potion maker (pack ingredients) stays 1:1 and earns nothing online,
because the service never sees it. The profession's door is the **brewing act** at an alchemy station: the
ingredients come from the Stores (the gathered ones, and the Apothecaries' counter's sixteen, 4.5), and the service runs DFU's own recipe law on them - `POTION_RECIPES`, imported,
the order-independent ingredient hash DFU keys it by - so the same twenty recipes, and no new ones, make the same
potions, into the pack. There the brew makes **2** potions at Journeyman and **3** at Master (Brewer 3 at Journeyman);
**Potent** (+25% magnitude, named so) at 10% at Expert and 20% at Master, +5% an unbruised herb; and Alchemy XP.

**Enchanting** (DFU's item maker, unchanged): cost **-10%** at Journeyman, **-20%** at Master (Efficient -5% more) -
a discount on the player's own item, which cheats no one. Enchanting **XP** comes only from what the service sees:
enchanting a **provenance** item at a station (the enchantment is written onto its product record) and
**Disenchanting** (new, at any enchanting station): a **provenance** item the player owns becomes **Arcane Essence**,
one per 100 enchantment points it carried (Disenchanter x2), into the Stores, and is gone. Loot cannot be
disenchanted - Essence from a save item would be a pack item entering the Stores. A Masterwork's Rare roll consumes
5 Essence (Runecaster: choose of three).

### 9.4 Hands at the station

The crafts' acts, under the same honest bound (5.1). Any act may be skipped (**Quick craft**): the roll takes no act
step, and nothing else is lost.

| Craft | The act |
|---|---|
| Smithing | **The heat**: the ingot's glow rises and falls; strike three times while it is in the band |
| Carpentry | **The plane**: a steady drag along the grain, deviation scored as the trace is |
| Outfitting | **The stitch**: presses on a beat, eight in a row |
| Masonry | **The chisel**: strikes on marked lines that the glint's rule moves |
| Jewelcrafting | **The facet**: a slow turn stopped where the gem catches the light (a 10-degree window) |
| Cooking | **The fire**: take the pan off in its window (the Skillet's is wider) |
| Alchemy, Enchanting | none - DFU's windows stay 1:1 (law 1) |

## 10. The Notice Board and the market

DECIDED (Mac): "The new notice board should be a physical object that houses quests, the player auction house,
etc".

### 10.1 The Notice Board - a thing that stands in the town

- **It is Daggerfall's own board.** FACT: Daggerfall's towns carry a bulletin board, a 3D model the town blocks place
  (`BULLETIN_BOARD_MODEL_ID`, `src/world/rmbLayout.js`), activated as DFU activates it (`src/systems/bulletinBoard.js`:
  the reach gate, the location's name, the rumour mill's line). **Offline a rumour board stays exactly that.**
- **BOUNTY1 took half of every town's boards** (FACT - shipped 2026-09-28 at Mac's word, `06-Systems/Bounty-Boards.md`):
  in a town with two boards or more, every other one by position is a **Bounty Board** in BOTH lanes, posting the
  town's four hunts. DECIDED: the Notice Board is the OTHER boards' - a bounty board stays the town's hunts, online as
  off, and the Notices tab pins one line under the rumour: "The town's bounties are posted on its Bounty Board." A
  board stood for a seat or hub (below) is a Notice Board. The Work tab's black Bounty seal is a WRIT (section 11),
  never a board's hunt; the two share a colour because both are a price on a beast's head.
- **Online, a rumour board opens the Notice Board** - every board of a town that is not a bounty board, a lone board
  included (ONE-BOARD REVERTED, 10.11). DFU's reach gate still applies (256 classic units).
- **Every seat and hub has one.** A seat or hub whose blocks place no board gets one: the same DFU model, drawn from
  the player's own ARENA2 at runtime, stood at an anchor derived from the town's layout - the market square (the open
  block nearest the town's centre), else beside the palace door. SEAT-COUNT counts them.
- **Its face**: a small count floats over it for the looker - "3 new" - drawn by the name layer (`src/ui/nameLayer.js`).
- **The window**: a corkboard of pinned parchment in the Enhanced Plus UI, six tabs along its top; each note a card
  with a pin, a wax seal whose colour says who posted it, opened large on a click.

| Tab | What it holds |
|---|---|
| **Notices** | DFU's rumour, pinned first; the server's word with a red seal (sieges, Turnings, Edicts, Festivals, revolts, Motherlodes, gates rising, Tides); players' notes (10.6) |
| **Work** | Writs (section 11) with seals by poster - Court purple, Seat in the holder's colours, Guild in its colours, Commission green, Bounty black - each with its need, pay, time left, **Take** and **Deliver** |
| **Market** | The auction house (10.2): Materials, Crafted, Auctions (PROF5b), My listings, Buy orders, History |
| **Seat** | At a seat's boards: SEAT0 7.9 |
| **Guilds** | Recruitment posters (each guild's heraldry and a line); a guild's own notes, members only |
| **Makers** | The Hall of Makers: this Season's most Masterworks and most writs filled, per profession |

- **Capacity**: 30 player notes a board (newest shown), the last 20 server notices, every live writ of the region.
- **The Guilds tab - BUILT (GUILD1e, 2026-09-30; `06-Systems/Online-Arc.md` GUILD1e):** the town's recruitment notes
  hung as their guilds' posters (each with its banner), and the reader's own guild's notes - its members' alone, 3 live
  a member and the newest 30 shown, taken down by their author or an Officer. The same notes open at the board placed
  in the guild's hall (`SEAT0` 8.2).

### 10.2 The market - the auction house

- **What sells**: Stores materials (escrowed by the service - safe by construction) and crafted goods with a
  provenance id (the listing takes the item out of the save; the service holds the record; only the id's **owner**
  may list it, and an id has one live listing at a time - so a duplicated copy can never be sold beside its original,
  section 18). A piece from the pack lists **for gold alone** (MARKET-ANY, FIELD BUGS 2026-10-01 #2 -
  `01-Overview/bugs/Field-Bugs-2026-10-01.md`): a realm character's record is the service's (REALM P1), so the listing takes
  the record's own piece out of the seller's record in its batch and a delivery puts it into the buyer's - the realm
  trade's move, no new trust; never for Drakes (Marks), since the service never inspects a checkpoint after the first save and a
  save-edited piece would buy them (law 3). Bound, worn, locked, quest and summoned pieces, gold and letters, boat deeds
  and parts, arrows and Stores materials stay off it, each said. AUDIT PROF-541 D4: since PROF12 that wall takes in the
  Apothecaries' sixteen reagents (`MINED_KEYS`; marketLaw.js `storesForm`) - every DFU template of theirs, a looted
  Unicorn Horn, Saint's Hair or Ectoplasm as much as one withdrawn from the Stores, since the pack cannot tell the two apart.
- **Priced in Marks.**
- **One market, regional prices** - DECIDED (GLOBAL-MARKET, 10.9): a listing stands on every board of the Bay. A buyer
  in the region it was listed in takes it at once; a buyer anywhere else pays the **courier fee** and the goods reach
  their Stores after the **courier's time**. So a signature material (4.7) is cheap at home and dear abroad, and
  hauling is a trade.
- **Buyout first, bids later** - DECIDED: PROF5 ships buyouts (a listed price, taken whole or, for materials, in part);
  **PROF5b** adds timed auctions for **Masterworks only** - 24 hours, a 5% minimum raise, and a bid in the last 2
  minutes adds 2 (BUILT, section 27).
- **Listings**: last **72 hours**; at most **30** an account; price **1 to 1,000,000 Marks**; a cancelled listing
  returns its goods (the fee kept). **History**: every material's 7-day median, drawn as a small line on its card.

### 10.3 Buy orders

A standing order ("buy 200 Mithril Ore at 8 each") on a board: the Marks are escrowed when it is posted; any gatherer
at any board fills it straight from their Stores, in whole or in part (from another region, the courier comes out of the
pay - GLOBAL-MARKET, 10.9); at most **20** an account; unfilled after 7
days, the rest is returned.

### 10.4 Fees, the Tithe and couriers

| Fee | Amount | Paid by | Where it goes |
|---|---|---|---|
| Listing | 1% of the price, at least 1 Mark | the seller, on listing | burnt |
| Sales tax | 5% of the price | the seller, from the proceeds | burnt |
| The Tithe (every board of a held seat's bailiwick, SEAT0 7.2) | the holder's rate, 0-10% (palace) or 0-15% (crown), of the price | the seller, from the proceeds | the holder's Marks treasury |
| Courier | ceil(units / 20) x (1 + map pixels between the two regions' seat or hub towns / 25) Marks, at least 2 - by the load, so moving 5,000 units across the Bay costs thousands, and regional prices hold | the buyer, on top | burnt; the receiving seat's Tithe share of it to its holder |
| Courier's time | 15 minutes + 1 minute per 10 map pixels (Bandit Summer doubles it, SEAT0 9.3) | - | - |

**The buyer always pays the listed price** (plus a courier, when the goods travel). The seller receives the price
less the sales tax and the board's Tithe. Every board in a seated region is in some seat's bailiwick (SEAT0 7.2), so
there is no untaxed board to walk to; where two seats share a region, sellers choose the lower Tithe, and a greedy
holder empties its own bailiwick.

### 10.5 Marks - the server's currency

DECIDED (Mac: "New currency"). FACT, why: online gold is the save's ("The GOLD is the client's, the economy being the
save's" - GUILD1), so anything paid in purse gold can be paid by a client that never had it.

- **The name**: **Marks** - an Imperial promissory note, struck by the Bank of the Empire's counting houses (the name
  EMPIRE-BANK gave the online bank). A Mark is worth about **10 gold** of play.
- **Held by the service**: one balance **per account** (all its characters share it), at most 10,000,000; a
  **Marks treasury** per guild beside its gold one (deposits from any member's balance; withdrawals by the
  Guildmaster alone - GUILD1's law); one ledger for every movement.
- **Where Marks come from** (the faucets) - acts a server witnessed, each capped; SILVER-FINDS' two (a gathering's
  find, a loot find) are bounded by the UTC day instead (below):

| Faucet | Amount | Cap |
|---|---|---|
| Court writs (section 11) | their pay | 3 an account a day |
| Oblivion Gate receipts | 50 a receipt (100 under a Daedric Incursion, SEAT0 9.3) | ~~**2 a UTC day** an account~~ SILVER-WAYS: the day's **combat cap**, 150 an account a UTC day with the raids' and (SERPENT-SET) the serpents' (below) - FACT, a gate rises every game day, twelve a real day, and `gate_kills` keys on the game day, so the gate's own law allows twelve |
| Towns defended (SILVER-WAYS) | 30 a raid's receipt (RAID3's `w1`, counted once a raid and account - RAID4) | the day's **combat cap** with the gates' and the serpents': 150 an account a UTC day, the day's last strike what it has left |
| Sea serpents slain (SERPENT-SET) | 40 a serpent's receipt (SERPENT1's `l1`, counted once a serpent day and account), a ship that stood 20 | the day's **combat cap** with the gates' and the raids' - the ceiling unmoved (`11-Multiplayer/Sea-Serpent.md` section 8) |
| Elite Breach Redoubts (EG-E1) | 20 a Redoubt's receipt (the relay's `e1` `w`), paid once an account a Redoubt an arena week (`11-Multiplayer/Elite-Gates.md` section 19) | the day's **combat cap** with the gates', the raids' and the serpents' - the ceiling unmoved |
| A gathering's find (SILVER-FINDS) | 2-5, the service's dice in one counted harvest of ten - any of the five acts | **30** an account a UTC day, the day's last find what is left - bounded, not witnessed |
| A loot find (SILVER-FINDS) | 1-4, the service's dice; the device rolls each container once - a foe's body 5%, a treasure pile 12%, a search's find 15% | **20** an account a UTC day, the day's last find what is left - bounded, not witnessed |
| Guild deeds (SILVER-WAYS) | 25 into the guild's treasury, never an account's | where 3 of a guild's accounts - each a character 7 days in it - claimed one raid, one gate or (EG-E1) one Redoubt of one breach; 4 a guild a UTC day |
| Siege Honours (SEAT0 6.8) | 50 / 25 | one a siege |
| Motherlodes (PROF2b - BUILT, section 38) | 10 a find | 1 an account a day (3 Motherlodes a day server-wide, 20 strikers each) |

- **Where Marks go** (the sinks): listing fees, sales taxes, the burnt part of couriers, seat claim fees and
  upkeep, Tribute (SEAT0 4.2: burnt), Festivals, heraldry, fortification projects, respecialisation, the Board's
  counters (4.5), the Bank's exchange.
- **What only moves them**: the market, buy orders, player-posted writs, the Tithe (and Conscription and a vassal's
  share of it), guild deposits and withdrawals, sellsword contracts, a Bounty's payouts and the Royal Tourney's prize
  (SEAT0 7.6, from the holder's treasury) - and SILVER-WAYS' **guild contracts** (a guild's pay to each defender of a
  raid in a region, escrowed from its treasury, less the 5% tax: `06-Systems/Online-Arc.md` SILVER-WAYS).
- **The one mint outside the faucets**: a developer's strike of a held seat refunds its burnt claim fee (SEAT0 16) -
  in the ledger, by the dev glyph alone.
- **Marks and gold**: Marks **sell for gold** at any Bank of the Empire counter, **1 Mark for 8 gold** (a spread that
  is itself a sink), at most **300 Marks a day**; **gold never buys Marks** - that door would mint a Mark from gold a
  client may not have had.
- **The weekly report** (for Mac, from the ledger): Marks minted by faucet, burnt by sink, in circulation; the median
  price of the twenty most-traded materials; the accounts at the faucets' caps.
- **As built (MARKS1, 2026-09-28)** - `06-Systems/Online-Arc.md` MARKS1 holds the whole record: the law both ends read
  (`src/net/marksLaw.js`); the balances, a guild's Marks treasury and ONE LEDGER whose own triggers move them
  (`server-account/migrations/0025_marks.sql`), every movement decided in one statement (`server-account/src/marks.js`);
  the gate's counted receipt as the first faucet; the Bank's sale paid into the account at that bank (a sale whose
  answer was lost is kept and settled - `src/net/marksBook.js`); the report a developer's (`/v1/marks/report`; the
  materials' median prices join it with the market, PROF5). Behind MARKS_OPEN, shipped at `dev`.
- **As built (SILVER-FINDS, 2026-10-05)** - Mac: "Silver should be more accessible in more forms of interactions like
  foraging and different activities, also needs to be sometimes lootable". DECIDED (the record's, at Mac's call): law
  8 bends for TWO faucets, each **bounded, not witnessed** - a gathering's find and a loot find - because neither act
  can be witnessed (a harvest is the client's word on its node, as a hide is - section 6; the service cannot see a
  body), so the UTC day is the bound, the line the law draws instead of the witness: the most a client that lies is
  paid is the cap (50 silver a day of both, 400 gold of play at the Bank's 8), and the amount is always the service's
  dice, never the client's word (`src/net/marksLaw.js` SILVER-FINDS).
  - **A gathering's find**: every counted harvest - an herb patch, a vein or a boulder, a tree, a body, a net - rolls
    the service's own dice AFTER every other draw, so each of them is what it was: one in ten finds **2-5 silver**,
    struck in the harvest's own batch and only by the row this claim stamped (`gather:<rid>`; a harvest the day refused
    finds nothing), at most **30 an account a UTC day**, the day's last find what is left; the answer says it as
    `marks` (`server-account/src/professions.js` harvestNode; `server-account/src/marks.js` gatherStrikeStatement). A
    Motherlode's strike is its own (section 38).
  - **A loot find**: the DEVICE rolls each container it opens, once a session - a foe's body one in twenty, a
    treasure pile 12 in a hundred, a search's find 15 (`marksLaw.js` findChanceOf; `src/systems/silverFinds.js`, a key
    or the container's own object, bounded) - and a find asks `/v1/marks/find` (`marks.js` findMarks): the service's
    dice strike **1-4**, at most **20 an account a UTC day**, one of the Marks acts an hour. Its own request id, so a
    lost answer asked again is the line it made - and a line made is answered WHATEVER THE SWITCH SAYS NOW (AUDIT 28
    M2's law; the first cut's `findLineAnswer` asked the switch before the line and answered "none" to a find made
    before it shut - the pin was written against it). The marks book (`src/net/marksBook.js` find) keeps a find the
    network never answered OWED, asked again with its id by the same account's next find, and once one goes
    unanswered the rest wait owed unasked (a dropped line costs a find one ask's tries, never twenty's); it asks no
    more for the day once the service says the day is met, and none at all where silver is not the account's.
  - **The doors (THE FOUR HOSTS)**: `scenes/dungeonContext.js` - takeLoot (a body or a treasure pile opened with
    something in it, by the window or the quick door alike; a pile the player or a reward dropped never) and
    activateSearchable (a search's find, each search its own roll, so a thing searched again after its hours rolls
    again); `scenes/world.js` - activateGrave (a headstone's find) and the finder itself, registered there online alone
    (the book's ask; each answered find its card where the feed stands - the world walked, nothing over it - else its
    line in the chat); the street's, the watch's and an interior's bodies through `scenes/corpseMarker.js`
    openCorpseLoot (`scenes/exteriorFoes.js` and `scenes/cityGuards.js` open through it), and a peer's body at
    `exteriorFoes.js`'s grant; `scenes/worldModes.js` (interiors) - its bodies are the corpse door's, its dungeons
    `dungeonContext.js`'s, and (AUDIT 625 S2: the first cut named it no door, and a tavern's or a guild hall's treasure
    never rolled) its TREASURE piles' door is its own, the `droppedLoot:` arm, for the scene's containers alone
    (`container: true`); a stranger's cupboard is NO find: theft is its own law (PT1); the streaming host's own scene
    containers (World of Daggerfall's piles and casket, Deep Waters' chests) at its pile door the same way (S2);
    `scenes/exterior.js` (the offline town page) opens its bodies through the same corpse door and registers no finder,
    so offline, and on the bench, nothing is found.
  - **What it says**: a harvest's find its own card beside the goods' (`src/ui/haulCards.js` findHaul, through
    `scenes/gatherHost.js`), else its line; a loot find's card the same coin - where it was found its source, its
    faucet's day its bar (the loot's 20, the gathering's 30). The Bank's card says the day's finds beside the combat's
    (whose row names the serpents now).
  - Pinned: `test/net/silverfinds_service.test.js`, `test/net/silverfinds_client.test.js` and a gathering-host pin in
    `test/systems/foraging/haulcards.test.js`; `tools/mutants/silverfinds.json` (86, all dead - the first run's one survivor, the book's
    kind check, lived under a pin whose scripted door answered nothing either way; the pin now asks whether the door
    was asked). ACCOUNT_VERSION acct84 (acct83 on the branch, renumbered past CRYSTAL-FIST's at the merge of main), with SERPENT-SET. Forcing every harvest to find (the chance at 1) left all 139
    harvest pins green - none reads a balance a find could move.
  - **AUDIT 625 (2026-10-05, `01-Overview/audits/Audit-625.md`)** - Mac's call on S1, "A week old, like witnesses": both
    faucets open to an account a WEEK registered (`nodeLaw.js` WITNESS.ageS, the witnesses' own age) - bounded, not
    witnessed, every account added was another day's cap; a younger one's loot find is `marks-young` (403) and its
    harvest finds none though the dice found one, asked after the line as the switch is (S1; the book then holds the
    account's day met, none owed). The marks book keeps an owed find through every answer that says nothing of it - the
    switch shut, a guest, no session, a session refused - and lets one go only on a refusal of the find itself (an id
    the service cannot read, a kind of none, its hour spent); the owed are KEPT in the store beside the Bank's kept
    sale (`marks1.owedFinds`), and each is asked under its own account's session or not at all - the door reads the
    session once and checks it (S3, S4). A container is named as its host names it for good: the dungeon's by its map
    and the room's key (a body with its death's stamp - the hour's respawn leaves a body anew; the hour's restock is
    the same pile), an interior's by its town, building and marker - leaving and coming back rolls nothing again (S5).
    A door rolls once it OPENED - a window that stood, or the quick door's take - never on a pack the host refused (D6);
    a peer's body of arrows alone rolls none, as one's own (S7). The weekly report counts the accounts at both finds'
    caps beside the combat's and the Bank's (S6). Pinned: `test/net/audit625_silver.test.js` and the AUDIT 625 pins of
    `test/net/silverfinds_service.test.js`; `tools/mutants/audit625.json`.

### 10.6 Player notes

A registered player may pin a note on a board under MAIL1's letter law (its bounds, its filter; the reports are the
board's own - MAIL1 has none, 10.7): at most
3 live notes an account, each for up to a week. A note may carry one button: a **party invitation**, a **guild's
recruitment**, a **duel challenge**, or a **commission** (section 11; BUILT, PROF6: section 28).

### 10.7 NOTICE1 - the board as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Go"**. What the design above left open, DECIDED here (the record's, at Mac's instruction), and what was found:

- **Which boards.** Online, every board of a town that is not a bounty board opens the Notice Board - once the account
  service has said the board is open to this account (`BOARD_OPEN`). Until it has, and offline, the board is DFU's
  rumour box byte for byte (ROAD A9's pins hold). The town underfoot is read on arrival, so the first press knows.
  (ONE-BOARD, 10.11, made it one board a town; ONE-BOARD REVERTED put every board back.)
- **A board is its town's.** A note is pinned to the TOWN - its MAPS.BSA map id, unsigned (regionHubs.js's key) - so
  every Notice Board in a town shows the same notes, and a board stood later for a hub is the same board.
- **The Notices tab, in its order**: the rumour (DFU's sign; its name row is the window's heading), the bounty board's
  line, the server's word under the red seal (the Oblivion Gate while it stands - the map's own mark, WB1 - and the
  developers' notices), then the players' notes, newest first.
- **One tab.** The Work tab arrives with PROF1's Court writs, the others with their slices: a tab that can hold
  nothing is a door painted on a wall. (The NOTICE1 row below said "the Notices and Work tabs"; the Work tab moved to
  PROF1, which brings the first writ.)
- **A note** is MAIL1's letter law, whole (`src/net/boardLaw.js` imports `letterWords`: a subject to 60, a body to 800
  and 40 lines, cleaned, refused past its bounds, never cut); 1, 3 or 7 days; at most 3 live an account on every
  board together, bounded inside the one INSERT; 10 pins an hour; registered accounts alone (a guest reads).
- **Its one button** answers the author through the doors that stand. FACT: SOC1 has no request to join a party
  (`party.invite` is the inviter's act), GUILD1 joins by invitation alone, and DUEL1 challenges within 10 m outdoors.
  So a party's or a guild's button is a LETTER to the author, addressed and begun (MAIL1, the social panel's draft -
  through JOURNAL1's pending door, opened the first frame the panel may stand: AUDIT 28 N1 found the letter opened
  directly under the closing board, which the slot still held, so it never opened); its subject "Re: " and the note's,
  or the note's own where "Re: " would not fit - never cut (N15); a duel's is DUEL1's own challenge when the author
  stands within reach, else the letter. A recruitment note names its guild and its author's character, and only a
  rank that may invite (Guildmaster, Officer) pins one; it recruits - its button and its seal - only while that
  character is still in that guild at such a rank (N4), and a guild that is gone leaves its notes standing without the
  button. Commissions come with PROF6 (BUILT: section 28 - the note's fourth button opens the Work tab's commission form).
- **The author is the handle** (the letter's `from` rule): no account id leaves the service on a note.
- **Reports** - new here (MAIL1 has none): a registered reader reports a note once and stops seeing
  it at once; the third reporter that COUNTS - an account neither muted nor a sprout (younger than fourteen days,
  titles.js SPROUT_S) - hides it from everyone but its author until a moderator removes it or restores it (a restored
  note is not hidden again). Its author still sees it, marked, and may take it down (AUDIT 28 N2, N3: three accounts
  made that minute hid any note, and the author lost the note and its place for a week). Moderators (`MODERATOR_HANDLES` and `DEVELOPER_HANDLES`) see a hidden note with its count and its
  id, and remove it from the window or with `/note remove <id>` anywhere. A mute stops a pin and takes the author's
  notes off every board while it stands.
- **The server's word**: a developer posts a notice to every board for 1 to 14 days. The gate's card is composed on
  the client from the law every client reads, so it needs no row.
- **The count over a board**: "3 new", in the name layer's face and law (`src/net/remotePlayers.js` nameFrame's
  `extra`), over a Notice Board within 40 metres, in front and in sight, whose town has notes or server notices this
  device has not read (both - a developer's new notice lights every board it hangs on; AUDIT 28 said so); reading the
  board sets it to nought (`src/net/noticeBook.js`, the newest 200 towns remembered).
- **Failures** (section 19): a minute's cache - of every answer, a refusal too, so a town stood in at `dev` is one read
  a minute, not one a second; a slow service shows the last good board, marked; a pin and a developer's notice carry
  their request id, kept with their words until the service answers - a lost answer asked again with it, across
  presses, is never two - and a take-down or a removal asked again after a lost answer that finds the note gone was
  the first try's; the tries wait between them, and every request gives up after fifteen seconds; a second press while
  one is in flight is the same press, and the window does one act at a time (AUDIT 28 N5-N9 - "every write carries its
  request id" was false: the notice and the take-down had none).
- **The switch**: `BOARD_OPEN` in `server-account/wrangler.toml` - shipped at `dev`; one line opens it. The service is
  `acct18`.
- **Boards stood for a hub - NOTICE1b.** 10.1 gives a hub whose blocks place no board one of its own, at the open block
  nearest the centre or beside the palace door. This lane holds no ARENA2, and a board stood blind through a building
  is worse than none. MEASURED next: `tools/boardCount.mjs` - Mac runs it over his own ARENA2 - lists every hub's
  boards, bounty and rumour; NOTICE1b builds only if it names a hub with none. A seat's boards come with SEAT1 (AUDIT-SEATS: no SEAT slice built a board of its own - a seat's Seat tab is at its
  town's rumour boards, and a seat town with none waits on NOTICE1b's own boards).
- **The four hosts** (17.1): the streaming world (`scenes/world.js`) wires the boards, the press, the count and the
  window in the overlay slot; the fixed city (`scenes/exterior.js`) keeps DFU's board (FLAGGED by name: it hands the
  shared mode machine no `openNoticeBoard`); the building interiors and the dungeons have no boards.

`test/net/notice1.test.js` (17) - the law, the schema, the switch, read and pin, take down and report, moderation and the
mute, the recruitment note, the server's word, expiry and the hour, the book (the cache, the stale board, what was
read, one request id through every retry), the refusals, the cards' order, the wiring and the one door, the count in
the names' pass, the measure. `tools/mutants/notice1.json`, 26 mutations, 26 dead. AUDIT 28 (`06-Systems/Online-Arc.md`
AUDIT 28): `test/net/audit28_notice.test.js` (14) - N1-N16 fixed, among them THE MODAL CONTRACT's pin this section owed (the
note's answer plan, one shape from every exit) and the window driven on the minimal DOM.

### 10.8 GOLD-MARKET - a listing's currency (DECIDED 2026-09-30, Mac: "Allow trading with gold or drakes on the marketplace"; "Gold listings, walled"; BUILT the same day)

Law 8 priced the market in Marks because online gold was the save's. REALM P2 put a realm character's gold on its
record on the service, moved only in an act's own batch (a guild deposit, a house) - so gold bought with it is gold the
buyer had.

- **Who**: a realm character alone lists or buys in gold (`market-gold-realm`); any other character's market is the
  Marks' as before.
- **What**: a Stores material or a crafted piece. Buy orders, auctions and commissions stay in Marks.
- **The price**: the seller's own, in gold. No fee at listing; each sale pays the tax (5% of the listing's running
  total, as in Marks) and 1% of itself (the listing fee's rate), both burnt. The courier is a Mark's worth of gold a Mark
  (10 gold). The buyer pays the exact cost off its record - purse, letters, then the account of the board's region.
- **The proceeds**: held on the service for the seller's character (at most 100,000,000 gold), collected by its own
  record into the bank account of the board it stands at. A character with gold held is not deleted.
- **The wall** (law 8 kept): goods bought with gold are the Stores' third origin, and a piece bought with gold is
  marked; they go to the pack or back on the market for gold, and to nothing else - no station, craft, Court or guild
  writ, guild Stores, buy-order fill or Marks listing. And goods bought with Marks never list for gold, or the market
  would be a way round the Bank's daily cap and spread (10.5). AUDIT PROF-541 R2-S3 (Mac: B7's wider wall kept, its
  word made plain): a crafted piece made with any goods a counter sold for Marks is a Marks piece (`products.bought_with`,
  B7) and sells only for Marks - from its maker's listing or, R2-S2, from another account's pack (`market.js` listGood,
  `market-drakes-goods`) alike; the refusal says "Goods bought with silver, and pieces made with them, sell only for silver".
- **As built**: `06-Systems/Online-Arc.md` GOLD-MARKET (acct40, `0041_gold_market.sql`).

### 10.9 GLOBAL-MARKET - every board is the Bay's market (DECIDED and BUILT 2026-10-04, Mac: "ensure the market is global")

FOUND: the listings were the Bay's already - the Materials, Crafted, Goods and Auctions views read every region's, each
row's courier quoted to the reader's board - but a buy order stood on the boards of its own region alone: the Orders view
read `region = ?1` and a fill from any other board was refused `market-elsewhere`; and the List form said a listing
"stands on the boards of" the lister's region, which it never did.

- **Buy orders, the Bay's**: the Orders view reads every board's open orders, dearest first (a family's chosen from the
  500 dearest, then the hundred shown), each with its road from the reader's board.
- **A fill from another region pays the courier** - by the load, the buy's formula (10.4), out of the filler's pay
  (the filler is the one not going): burnt from the order's escrow, its Tithe share to the seat of the filler's board
  (as a buy's courier share is the buyer's board's). The units reach the orderer's Stores **at once**, as a fill here -
  DECIDED: an order's units have no road table, and the poster has paid already; the fee is what keeps prices regional.
  A fill whose courier would take all it pays is refused before anything moves (`market-courier-dear`); the tab names
  the pay and does not offer such a fill, and a fill carries the pay its filler agreed (`least`) - a pay moved under it
  is `market-price-moved`. Both hubs are witnessed (SEAT0 3.2), as a buy's.
- **The words**: a listing, an auction and an order "stand on every board in the Bay", a buyer, bidder or gatherer
  outside the lister's region paying a courier.
- **Not changed**: a home's trader (HOME-VENDOR) stays a stall a buyer visits - its stock is bought at it alone.
- **As built**: `server-account/src/market.js` marketRead (orders) and marketFill; `src/ui/marketTab.js` orderRow;
  `test/net/globalmarket.test.js`; `tools/mutants/globalmarket.json`.

### 10.10 MARKET-AUDIT - the board audited (2026-10-04, Mac: "I think the ingame market board is broken. Please audit this")

Three lanes - the service, the client's book, the tab and its host - read the market end to end over the real Worker
and reproduced each finding before it was fixed (`test/net/marketaudit.test.js`, `tools/mutants/marketaudit.json`).

- **MARKET-BAG - the break a player sees.** Since BAG1 every harvest is carried (bag, then pack), and the List form and
  a fill read the Stores alone: a gatherer's List form offered no material and every order said "0 in your Stores",
  Fill shut, with no word why. What is carried now counts toward a silver listing and a fill, and its shortfall goes
  into the Stores first (`profBook.ensureInStores`, a station's own way); the form says how many go in. A gold listing
  stays its Stores' own and gold's units (the wall, 10.8).
- **The service.** S1: a one-Mark unit its running-total tax took whole (every twentieth unit of a one-Mark listing)
  wrote a seller's line of 0, which the ledger refuses - a 500, the buy kept and asked again for ever; such a sale now
  pays its seller nothing and writes no line. S2: a fill its tax left paying nothing was refused as "the buyer's Stores
  cannot hold that many" (market_fills.pay is at least a Mark) - now `market-taxed-out`, and an order's LAST units pay
  their filler a Mark, the tax short by it (`marketLaw.js` fillTaxOn), so no order is left unfillable. S3: a gold unit
  whose tax and fee passed its price broke `market_gold`'s CHECK and was said `stores-full` - the held share floors at
  nothing (goldSaleOf's own floor). S4: the Orders view's family read after its cutoff - in the query now.
- **The book.** B1: a refused gold buy gave its whole cost back as purse coins (`addGold`) whatever paid it - a letter of
  credit and the bank's gold turned into coin, checkpointed into the record; the wallet's pay answers the undo of exactly
  what it took (`court.js` deductGoldUndoable, and the bank's share). B2: a read that joined one under way answered null
  when an act overtook it - the tab threw and stood blank; it is read again. B4: Buy pressed again after a lost answer
  minted a fresh id and bought twice; it asks the kept buy again with its own.
- **The tab.** U2: crafted pieces of one name are told apart by quality and wear. U3: a piece past the 64 the read
  names (`MARKET_HELD_MAX`) is offered both ways, the service's refusal saying which is wrong - it was never offered. U4:
  a market that shuts while its tab is read keeps the tab and its shut word (AUDIT 30 U11's word was unreachable). U5: a
  failed read keeps the view's filters and the counters. U6: an act's word stays with its view. U7: another character's
  delivery says it waits for that one, and is not asked after.
- **The rest, fixed (2026-10-05, Mac: "Fix everything").** Every realm act that pays out of the purse reserves through
  one law, `net/realm/realmGoldLaw.js` walletReserve: the payment's own undo (`systems/court.js` payUndoable - the purse and
  its letters, then the account, each given back where it was, once) on a refusal or a `repeat`, and a wallet's whole-cost
  `credit` only where its `pay` answers none - the guild's founding and deposits, a room's rent, a home's claim, a decor
  piece and its change, as the market's gold buy; every online wallet's `pay` answers it (`world.js`, `worldModes.js`
  bankPurse `pay`). The account door: a 2xx whose body never came is `offline`, `unknown` - no word on the act, never an
  empty success (`accountClient.js` call). The book: the minute's cache keyed by the account and character; a cache hit
  says its board's listing cap; a collect the service refused is said, and an act still kept; a realm act's own words
  (`held`, `left`, `unknown`) worded. The tab: the opening settle reads "Reading the market..."; the family filters
  offer only what the market knows a material of (the Spoils of War's two are a metal and a cloth); a closed listing
  reads its whole; an answer's redraw waits while one of its lists is held open. The window: an act that throws leaves
  no button greyed (all four of its doors). The service: a home's trader's stock is its own count (`VENDOR_STOCK_MAX`,
  60 - "such a listing stands on no regional board", yet thirty at a stall shut the board; `vendor-full`); an auction
  posted settles first, as a listing does; the default Materials view keeps the board's own region's fifty cheapest
  beside the Bay's hundred. The host: the Market tab stands while the professions' read is unanswered (its own read says
  whether it is open). `MARKET-ANY-service-the-goods-family-unfiltered` is recorded equivalent - the Goods view's
  family is chosen in its query; the JS filter after it is belt-and-braces. `test/systems/marketaudit2.test.js`,
  `tools/mutants/marketaudit2.json`.

### 10.11 BOARD-UI - one Notice Board a town (reverted 2026-10-07), and the board laid out to be read (2026-10-06)

Mac: **"Some towns have double notice boards"**; **"We need to overhaul the notice boards to enhance readability,
Including each of the tabs"**; **"Enhance the speed at which the notice board and market loads"**; **"Enhance
organization of the market"**; **"Reduce overusage of bloated text. Less AI like text"**; **"Enhance the guild war tab
of the board for better organization, instruction and readability"**.

- **ONE-BOARD - the double boards** (REVERTED 2026-10-07, below; this is the record of what it did).
  FACT: BOUNTY1 takes every other board of a town by position (two give one, five give two), and NOTICE1 made every board left a Notice Board - so a town of three boards or more stood two or three,
  each with its "3 new", its mark on the town map and, at a seat, its pennant. Now one (`systems/bounty/bountyBoard.js`
  noticeBoardIndex): of the boards BOUNTY1 left, the one nearest the town's middle (`townCentreOf`, the mean of its
  buildings' places), the first by position on a tie. The rest stay Daggerfall's rumour boards, as every board is
  offline; BOUNTY1's split is untouched. Every seam reads the one law with the same inputs: the press, the count over
  the board, the town underfoot and the town map (`ui/town/townMapMarks.js` townBoardRows takes the index) through one memo a
  pixel (`scenes/world.js` noticeBoardOf); a seat's pennant at the build's own measure (`scenes/seatBanners.js`
  seatBannerAnchors' `notice`); and the siege field's Market banner (`systems/siegeField.js` - its own walk until AUDIT
  657 B7, which broke a tie by the boards' order). It names itself "Notice Board" on hover while the board is open
  to the account (`scenes/worldModes.js`), DFU's "Bulletin Board" otherwise. THE FOUR HOSTS: `world.js` WIRED (the
  streets' boards, through `noticeBoardOf`); `worldModes.js` WIRED (the hover's name - the exterior ray it runs for the
  streaming host); `exterior.js` keeps DFU's board, as NOTICE1 left it (no board book on the bench); `dungeonContext.js`
  stands no board.
- **ONE-BOARD REVERTED** (2026-10-07, Mac: "We recently made a change reducing the amount of notice boards in cities and
  id like to revert just that change"). Every board BOUNTY1 did not take is a Notice Board again, as NOTICE1 built it:
  the press, the count over each board, the town underfoot, a mark on the town map for each (`ui/town/townMapMarks.js`
  townBoardRows takes BOUNTY1's split again) and a seat's pennant over each (`scenes/seatBanners.js` seatBannerAnchors'
  `bounty` again); `scenes/world.js` noticeBoardOf is gone. Kept: the hover's "Notice Board" (now every Notice Board's,
  while the board is open) and `systems/bounty/bountyBoard.js` noticeBoardIndex, the siege field's Market alone (AUDIT 657 B7's
  tie law). The rest of BOARD-UI stands. Pins: `test/ui/board_ui.test.js`'s host test pins every board, and the pins
  ONE-BOARD moved in `notice1`, `seat1a_client` and `town_marks` moved back (each PIN MOVED); mutants: three
  `board_ui.json` records re-aimed at the restored seams, and `seat1a.json`, `town_marks.json` and
  `audit_seats3_world.json` aimed where they stood before ONE-BOARD - all dead.
- **Readable.** MEASURED in Chromium (`tools/noticeBoardProbe.mjs`, every tab at 1280x800 and 390x760): the tab strip
  ran off a phone's edge ("VENDO..."), Guilds and Seat beyond reach - it scrolls sideways now (its scrollbar hidden the
  Arena window's way, `scrollbar-width: none`, the one value CURSOR-EDGE allows) and never shrinks (once it scrolled, a
  tall tab squeezed it to a sliver; the chosen tab's line and the focus ring stand inside the tab, AUDIT 657 B1 - the
  strip clips what stands past it); the cards stand straight (a tilted pixel face blurs) and as tall as their own words
  (a row stretched every Court writ to the guild writ's height); the words a step larger; words that sit on the cork sit
  on a dark panel (`.notice-panel` - bone ink on the cork's grain read about 3:1). Each tab names its count: the
  Notices' new since this device last read the board, the Work tab's writs open.
- **The Notices tab** in two parts: "News" (the rumour, the bounty board's line, the gate, the server's notices), then
  "Players' notes" under their count; a read under way is said once, in the window's head. **The Work tab**: "Court
  writs today" over the cards, not under the last.
- **The Market** (Mac's "organization"): Your silver on a strip at the top (it stood under the last row); the views in
  their parts - BUY (Materials, Crafted, Auctions, Goods), SELL (Orders - the buy orders to fill - and My listings), then
  History (`ui/marketTab.js` MARKET_VIEW_GROUPS; the law's MARKET_VIEWS and the service's views untouched); the columns
  named over the rows; the Weavers' and the Apothecaries' counters folded under one line, "Suppliers - fixed prices,
  straight into your Stores" (the Apothecaries' sixteen stood under every Materials read), kept open across a redraw;
  My listings in named parts (the List form, Your listings, auctions, bids, buy orders); each form's fields under their
  names (a stall's "Put up a piece" form's too, AUDIT 657 B3); the Vendors tab's columns named as the Market's
  (`ui/vendor/vendorTab.js`). FOUND: the List press wore `market-list`, the lists' own class, whose rule took its padding - a
  36px sliver since PROF5. And in this slice's own labelled field a select took AUDIT 31 U14's 160px flex-basis as its
  height - the slice's own, found before it shipped.
- **Faster.** The window and its tabs are a lazy chunk fetched at the first press - on the deployed site a round trip
  before anything drew. It is one of the chunks the one home warms in idle time once the world boots
  (`ui/enhanced/enhancedChunk.js` WARM_CHUNKS, MENU1-WARM - the tenth of thirteen, one an idle callback), so a press after the
  warm finds it in the module map, and one in the boot's first moments may still wait for it; the door still mounts
  it through `mountEnhancedChunk` (MENU1: no door fetches a chunk on its own - the whole suite caught a fetch-ahead of
  the door's own on this branch). The Market's first view is read as the board opens (`prefetch`), so its tab answers
  from the book's minute's cache (a read that early one was refused is asked again on the press, AUDIT 657 B4); its
  opening settle no longer holds the read back (a settle that moves anything lets
  the cache go, and a read it overtook asks again - AUDIT 30 C6, `net/marketBook.js` read). The Seat tab asks its works
  beside the standings, never after their answer.
- **Fewer words.** Each tab's fixed words in one table (`BOARD_WORDS`, `MARKET_WORDS`, `SEAT_TAB_WORDS`, `VENDOR_TEXT`),
  every one at most 120 characters, none naming the counting-house - "The counting-house is not answering. The market
  cannot be read now." is "The market did not load."; a listing's paragraph of terms is one line, "Fee 1 silver, kept
  if you cancel. Up for 72 hours on every board. If it all sells you get 1 silver, after 5% tax and the 6% Tithe."; the
  forms' escrow lines and the writs', commissions' and contracts' refusals likewise. What a line must still say is kept:
  a gold listing's "Goods bought with silver, and pieces made with them, sell only for silver." (the service's own
  sentence, AUDIT PROF-541 R2-S3).
- **The Seat tab - the guild war** (Mac's "organization, instruction and readability"): each part on its own panel
  under its own name, in the order a reader asks them - the Charter (who holds it, since when, its Standing and trend,
  the Tithe and Edict); This week (the phase on a strip - Muster, Reckoning, Turning - its clock, the Season, the Tide);
  the week's battle; the standings, each challenger's bar toward what it needs (the claim at an unheld seat, past the
  holder's defence at a held one; none on the holder's row - its influence is its defence); your guild (its pledge,
  your part, the levers, Fealty and Pacts); the holder's orders (the Tithe and Edict, the battle window, the Charter
  given up); the Works; HOW THE SEAT WAR WORKS, five steps folded under one line - Pledge, Earn, Claim, Siege, Hold -
  its counts the law's own (`ui/seatTab.js` seatGuide: the claim's line and fee, the Tourney's margin, the account's
  cap, the pledge's regions, the members' wait - AUDIT 657 D6; the Reckoning's and the Turning's hours as the week line
  says them); and the Chronicle. Who sees each lever is unchanged. PLAIN-UI (2026-10-12, a player: "extremely vague ...
  doesnt explain anything") moved the guide up under the Charter, open for a reader not yet in the region's war, beside
  a What this is panel with the reader's next step and a folded Words on this board (`10-UI/Plain-Words.md`).

Code: the files above, `ui/workTab.js`, `ui/vendor/vendorTab.js`, `net/townSeatLaw.js` (the tab's own two lines) and
`ui/enhanced/enhancedPlusStyle.js` (NOTICE_CSS, PROF_CSS). Pins: `test/ui/board_ui.test.js` (10); the pins whose words were cut
moved with them, each marked PIN MOVED (AUDIT 657 D7 marked the twelve that were not). Mutants: `tools/mutants/board_ui.json`, 33, all dead; twenty-five records
re-aimed by content and judged again (24 dead, AUDIT31-tab-hint-add-late equivalent as recorded); and the 294 records
over the code the slice touched judged whole - 291 dead, one equivalent as recorded, two survivors that survive on main
the same (`shadowreach.json` world-peer-gate-still-skips and `perfon2.json` PERF-ON2-the-peers-are-submitted-uncut-again:
the billboard cull's shadow arm, no board's), left to their own arcs. Probe: `node tools/noticeBoardProbe.mjs`.

### 10.12 GATHER-SPEED and MARKET-SPEED - the database's round trips (2026-10-11)

Mac: **"Can you look at gathering minigame performance and how the server affects it/slows down, same with the
market"**, then **"Do everything. A comprehensive improvement"**.

FACT, read off the code before anything moved: neither waits on the relay. The gathering act is the client's alone
(the act machines and `ui/professions/profReticle.js` ask nothing of the wire); its end asks `/v1/prof/harvest`, and every market
look and act is a `/v1/market/*` POST - both the account service's, on D1. Every `first()` and `all()` there is a round
trip from the Worker to the database's one primary, and each was asked one after another:

| Ask | Before | Now |
|---|---|---|
| A harvest (its session and character checks aside, two) | 13-20 in a row: the request asked before, the hour's acts, the ground, the track, the Levy's seat, the decision, its row read back, then `harvestAnswer`'s 4-9 reads and the find's 1-3 | 4: the request asked before; the hour's acts, the ground with the track (one batch) and the Levy's seat, asked together; the decision with its row and every read of its answer in one batch |
| A harvest asked again | 7-15 | 2 |
| The professions' state | 8 | 1 |
| The pixels' and dungeons' witnesses | 2 | 1 |
| A market read | 18-22 | 3: the settle's reads with the auctions past their end; the view's rows with the account's own (counts, gold, balance, the road); their couriers' hubs with their medians and a moderator's reports |
| A buy | 10-15 in a row | the hour's acts with the listing, the hubs with both seats' Tithes, the answer's balance with its Stores, each asked together; the sale read back in the decision's batch |

And three reads read every seat's witness rows whole (about 9,900 rows; STORM-SHED's "costliest read"), uncached: a
harvest under a Levy (`server-account/src/seatHolding.js` levyAt), every market read at a board (`seatForts.js`
listingsCapAt, the board's Market Hall) and a buy, twice (titheAt). They read the isolate's kept minute now
(`townSeats.js` confirmedSeats `{ kept: true }`, STORM-SHED's): only which seat a place belongs to comes from it - the
holder, its Tithe and the Levy's law are read as they stand. A report or a strike written in the isolate lets the rows
go at once, as before.

- **One batch** (`server-account/src/service.js` readAll): D1's `batch` is one trip, its statements run in order in one
  transaction, so a statement reads what the ones before it wrote. A harvest's answer reads (`professions.js`
  answerReads, by name; answerOf the shape the answer always had) ride the decision's own batch, behind its writes; a
  find's line, the day's finds and the balance with them (`marks.js` findLineStatements / findLineFrom). A read sends
  nothing when it asks nothing.
- **The market's settle** (`market.js` settle): its six reads are the read's first batch (settleReads) beside the
  auctions due (auctionsDueRead); an expiry reads its rows again in its own batch; every row's work is one batch -
  each row's statements keyed on its own id and nonce, as they were. A read still closes the auctions past their end
  (PROF5b's "settled by whoever reads the market next"), but only where its first batch found one: the clock closes
  them each minute (cron.js), so a read nearly always finds none.
- **The client - the node goes with its act.** The harvest's answer was the node's going: a patch kept growing and a
  tree kept standing a whole round trip (or a kept harvest's minutes) after the act that took it. The book says a node
  `gone` while its harvest is taken or being counted (`net/profBook.js`; `net/professionLaw.js` goneIn for the kinds),
  so `scenes/gatherHost.js` fallNow fells and stands it again as the act ends; the answer stands it again only where it
  was refused, or let go unanswered (a lapse). The goods, the XP and a rank's rise are said when the answer comes, as
  ever - the yield is the service's dice. The plans keep the two words apart: a kept harvest's node still says "being
  counted" where it is asked.
- **The client - the frame's reads.** The kept table was parsed out of storage every frame, by the pump and by every
  plan's `counting`; the last parse answers until the storage's text changes (a writer still reads its own copy), and
  an idle pump asks nothing until its next harvest is due, a write, or PUMP_IDLE_MAX_MS. The Market tab draws a view the
  book's minute answers once, with its answer (`net/marketBook.js` fresh), and a read an act asks draws its wait with
  the act's own end - a Buy rebuilt the window four or five times.

THE FOUR HOSTS: the gathering host is one (`scenes/gatherHost.js`, built online and handed to every host that ladders a
press): `world.js` and `worldModes.js` WIRED through it; `exterior.js` and `dungeonContext.js` hold no gathering of their
own (a dungeon's veins are the same host's). Port-Ledger: nothing of DFU's - Daggerfall has no service.

Version: `acct119` (no migration; acct118 on its branch, renumbered past SEAT-LEASE at the merge). Code: the files above. Pins: `test/net/gatherspeed.test.js` (10; 14 with the audit's below) - the round trips
counted, a statement's own call one and a batch one; the answers held to their shape (a harvest's answer and its repeat
say the same); the seats' rows read once for six asks; the node down as its act ends, up again on a refusal and a
lapse; the parse and the pump's idle; the cache's minute and the tab's one draw. PIN MOVED: `seat1d_client` (the Levy
asked beside the ground), `craft3_five` (the track's read a statement), `audit29_host` C4 and `audit30_host` A5 (the
node and its fall the act's end's). Mutants: `tools/mutants/gatherspeed.json`, 24, all dead; 40 records
re-aimed by content and judged again - 38 dead, two equivalent as recorded (PROF5-svc-reports-to-all, as it was; and
AUDIT29-C4-the-node-stood-as-it-was, marked here: a kept harvest's node went with its act, so the pump's answer stands
again what already shows - the lapse's and the refusal's stand-again are this slice's own, killed); and the 343 records
within thirty lines of a changed line judged whole - 335 dead, seven equivalent as recorded, and one survivor,
AUDIT30-A5-the-act-s-node-fallen (the fall the act's end's, the A5 pin no longer told the node as its pixel stands from
the act's own): `audit30_host` A5 now stands the wood again under the act with every flat one place on, and the node's
own tree must fall - dead.

**AUDIT GATHER-SPEED** (2026-10-11, Mac: "audit this"). A review of the slice's diff against main, each finding read
against the code before anything moved:

| # | Finding | Disposition |
|---|---|---|
| G1 | `gone` stands behind every kind's `gone` and `mark`, and the host asks those of every node near the player every frame (the target's scan, the marks, the groups) - each a storage read of the kept table: hundreds a frame, on the path the slice meant to lighten | FIXED (`net/profBook.js` countingSet): the nodes being counted kept as a set, read again when the book writes the table, the slot changes, or PUMP_IDLE_MAX_MS on (another tab's harvest) |
| G2 | A tree falls as its act ends now; a refused harvest stood the tree again, but its falling picture finished its fall beside it and its logs lay at its foot for a harvest that never was | FIXED (`scenes/treeHost.js` refused): the fall and the logs taken back by the node's key - logs whose texture was still coming are never laid; a lapse hands the kinds its key too (`gatherHost.js` answered) |
| G3 | A market read's settle is one batch, one transaction: a statement that throws rolls every row back, where each row was its own batch | KEPT: a row that throws throws out of the read either way, and asks the same row first next time - the account's market stood blocked behind it before as after; every statement is guarded in its WHERE (the Stores' room, the Marks cap), none is known to throw |
| G4 | A harvest the hour refuses still reads its ground, its track and the Levy's edicts (asked together with the hour's count) | KEPT: three indexed point reads in two trips, against a round trip more for every honest harvest; the account's per-minute door (240) still bounds a flood before the route |
| G5 | A fresh harvest asked its find's line, the day's finds and the balance whether or not its dice found silver (nine times in ten, none) | FIXED (`server-account/src/professions.js` answerReads `{ marks }`): asked only where a line was struck; a repeat asks as before |
| G6 | The Levy's and the Tithe's seat come from the isolate's kept minute - a seat struck or witnessed on another isolate is seen up to a minute late | KEPT, as STORM-SHED decided for the Watch: a seat's place moves with a report and by the week, and this isolate's own writes let the rows go at once; the holder, its Tithe and the Levy's law are read as they stand |
| G7 | A read skipped its "Reading..." draw whenever any act ran - a view or a filter chosen while the window's settle ran looked unheard | FIXED (`ui/marketTab.js` load `{ underAct }`): only the read an act asks waits for the act's own draw |
| G8 | `goneIn` stood between STORES-ROOM's comment and `storesFullIn` | FIXED: above it |
| G9 | The kept table parsed by two copies of the same code | FIXED (`parseKept`, one) |

Pins: `test/net/gatherspeed.test.js` (+4: G1, G2, G5, G7). Mutants: eight more in `tools/mutants/gatherspeed.json` (32), and
the records the fixes moved re-aimed by content - 38 dead, AUDIT29-C4 equivalent as recorded.

### 10.13 BOARD-SIFT - the work sifted and the market paged (2026-10-21)

The owner's screenshot of a thread in the Discord's #feature-feedback ("Notice board market/work writs"), SaberGGaming:
**"Definitely need sorting/filtering functions for work writs considering there are thousands of them and you have to
scroll through them all to find what you want. The notice board market also doesnt show everything if there are too
many weapons/armor/etc listed it stops after a certain number."** TheBard: **"The notice board in general needs some
TLC. The writs especially."**

FACT, read off the code before anything moved:

- **The Market stopped at a hundred.** Each view answered its first MARKET_SHOWN (100) rows and nothing past them
  (`server-account/src/market.js` marketRead): Crafted, Goods and Auctions read 500 and kept a hundred, Orders a hundred,
  and nothing said more stood behind them. Materials differs: its first look is the Bay's cheapest hundred of every
  material (and this region's fifty), and its search, family and tier choose the materials in the query (AUDIT 30 U2) -
  any material, each to its own cheapest hundred, its front. It is not paged (AUDIT BOARD-SIFT names what that leaves).
- **The Work tab was one grid in the service's order**: the Court's and the chapters' writs (6 x max(1, ceil(active / 100)) a
  region a day, section 11, and each chapter's), then up to fifty guild writs, the contracts, up to fifty commissions -
  under a panel for each of the region's chapters. An account fills three a day; finding them meant reading all of them.

What changed:

- **The Market turns pages** - Crafted, Goods, Auctions and Orders (`net/marketLaw.js` MARKET_PAGED_VIEWS). The service
  reads `page` (marketPageOf: 0 to MARKET_PAGES_MAX - 1, 499 - AUDIT BOARD-SIFT: 49 stopped at 5,000 rows; anything
  else the first) and answers MARKET_SHOWN rows that
  many pages in, with the whole count (`page`, `total` - one COUNT in the view's own batch, so MARKET-SPEED's three round
  trips stand). Every filter is in the query so a page is a page: Crafted's crafted-family filter, which ran after the
  500-row cutoff, is the query's now (`pieceKeys`), and a Goods record goodOf would refuse is left out of the query too.
  Each order ends on the row's id, so no row stands on two pages. Under the rows (`ui/marketTab.js` pagerNode): Previous,
  "Page 2 of 7 · 643 in all", Next; a turn reads that page and brings its first row into view; one page draws none.
- **A search, a least quality, an order.** Crafted and Auctions take a search of the pieces' names, read by the client
  as the recipes it names - each word somewhere in the recipe's name or in the name its piece wears on the rows, or in
  either read without its spaces, hyphens and apostrophes (`recipesNamed` over `ui/marketTab.js` recipeShownName,
  `wordsIn` - AUDIT BOARD-SIFT: 52 recipes' pieces wear another name than their recipe's) - and sent as those recipes
  (`recipes`), which the service reads within the view's families (`marketRecipesOf`, `pieceKeys`): "mithril sword" names
  the Mithril Shortsword, Broadsword and Longsword, "iron staff" the Pine Staff its row calls an Iron Staff. Crafted takes the least quality
  (Standard or better to Masterwork). Crafted, Goods and Auctions take an order (MARKET_SORTS): Cheapest first, the
  default, still sorted by the landed price within its page (AUDIT 30 U16); Dearest first; Newest first; Best quality
  first (Crafted); Ending soonest (Auctions' default). Goods takes no search: a pack piece's name is the client's, from the
  player's own item templates, and the service holds no ARENA2 - its family and its order stand. A change reads the first
  page; a view opens on its own defaults; a read that asks the defaults asks nothing new, so the request is the one it
  always was. The market book's minute's cache is keyed by them too (`net/marketBook.js` keyOf).
- **The Work tab's bar** (`ui/workSift.js`, wired by `ui/noticeWindow.js` workBody; each card handed in as an entry -
  `writEntry`, `ui/workTab.js` entries): the kind (All work, Court writs, Chapter writs, Guild writs, Guild contracts,
  Commissions - each with what it would show, the count the search and Only what I can fill leave, a kind with none not
  offered); a search, each word among the card's words (its material one and many, its kind as its card writes it, its
  guild and tag, a seat writ's seat and camp or stockpile, a commission's piece, crafter and poster, a contract's region)
  or its kind's name on the bar; **Only what I can fill** - a Court or chapter writ whose Take
  would fill it (held whole, the day's three not spent - writNode's own law), a guild writ the reader may deliver to and
  holds a unit of within the guild Stores' room (`guildWritMost`, the card's Deliver's law), a commission naming the
  reader with a piece that answers it, a contract never (it is earned in a raid); and the order - Ending soonest (the
  default, for every kind - the contracts too, which SILVER-WAYS showed best-paying first: AUDIT BOARD-SIFT), Most silver (a guild writ's
  pay a unit by what it still asks, a contract's pay to one defender), A to Z. The open work stands before the done (a
  Court writ taken). Forty cards are drawn at once, "Show 40 more" under the last; where nothing matches, "No work
  matches." and Show all work. The bar's choice is the professions book's for the session (`net/profBook.js`
  state.workSift), so a board opened again opens on it.
- **The chapters after the work.** The Merit lines without a card, How chapters work and the chapters' panels stand after
  the grid and the forms, under "Chapters in Daggerfall" - a panel a chapter stood between the reader and the first writ.
  What they say and their order among themselves are GUILD3d's and PLAIN-UI's, unchanged. At the merge of CRAFT-WRITS
  (section 49, built beside this slice): the character's crafting writs stand over the bar under their own head, then
  "Court and guild writs" over the bar and its grid - never sifted by it: three of the character's own, on their own day.
- **Words**: 33 keys through the text core (`market.page.*`, `market.sift.*`, `notice.sift.*`, `notice.chapters.head`),
  the English catalog regenerated (`tools/l10nExtract.mjs`) and drafted in-session for the thirteen whole languages
  (`tools/l10nInSession.mjs`); the twelve still drafting owe them with the rest of the catalog.

DFU has no member here - the board and its market are the port's own (NOTICE1, PROF5) - and no ledger row moves. THE
FOUR HOSTS: none is touched; the board is a window its door mounts (`ui/noticeDoor.js`), and the world host's market
deps are unchanged - the pager and the controls are the tab's own.

Pins: `test/ui/boardsift.test.js` (10) and `test/net/boardsift_market.test.js` (4), as AUDIT BOARD-SIFT left them.
Three pins moved, each marked PIN MOVED, because the work now stands ending soonest whatever order the service sent it
in: `test/ui/audit31_tabs.test.js` (U2, U10) picks W2 by its guild and `test/net/prof6_client.test.js` takes the two
guild writs the other way about - their fixtures list a five-day writ before a two-day one, which the service (soonest
first) never sends; `test/net/silverways_client.test.js` takes the two contracts the other way about - its fixture is the
service's own order (best-paying first, `contracts.js` contractBoard), which ending soonest departs from (AUDIT
BOARD-SIFT, below). `test/net/market_recipe_family_limit.test.js` - the plan's index, the odd families' answers, Auctions'
unknown piece unfiltered - passes unchanged. Mutants: `tools/mutants/boardsift.json` - its 38 all dead as the slice
shipped (a 39th written survived and showed the service's paged answer checking its view where only paged views call it
- the check is gone), 89 since its audit; and 16 records over the code the slice moved, re-aimed by content and judged
again, all dead.

### AUDIT BOARD-SIFT (2026-10-22, the owner: "Audit this")

Two lanes: the author's own adversarial re-read, and three independent passes that read the commit cold - the service,
the shared law and the market book; the board as a player meets it (in Chromium, with an IME); the record with its pins
and mutants (its mutants judged on a copy of the tree) - none touching the tree while the others read. No HIGH. FOUND,
each fixed and pinned (`test/ui/boardsift.test.js`, `test/net/boardsift_market.test.js`, `tools/mutants/boardsift.json`):

- **MEDIUM - a search missed the names on the rows** (every lane). The search read recipe names; a row names its piece as
  its record mints it (`scenes/world.js` marketPieceName: itemLongName of mintPiece), and 52 of 818 recipes' pieces wear
  another: every Wakizashi DFU's "Wakazashi", the staves and bows in metal tiers (a Pine Staff is an "Iron Staff", and
  "iron staff" found the Ironwood staves, which read "Adamantium Staff"), the Warforged pieces "Ebony"; "shortbow" and
  "daikatana" found nothing ("Short Bow", "Dai-Katana"). FIXED: the client reads a search as the recipes whose name or
  whose piece's shown name holds its words - each minted once a recipe and a language, 20 ms for all 819
  (`ui/marketTab.js` recipeShownName) - each word read without spaces, hyphens and apostrophes too (`net/marketLaw.js`
  wordsIn), and sends those recipes; the service reads them within the view's families (`marketRecipesOf`, `pieceKeys`),
  AUDIT 30 U2's way for the materials. Every recipe is found by its own row's name (52 missed, now none); the shown name
  is the player's language's, so a search in that language finds the piece. The record's "a piece is named by its recipe
  on both ends" is struck where it stood.
- **MEDIUM - the currency's switch kept the page** (lanes A and B, the author): Silver page 5 of 7, then Gold - "Page 5 of
  5 · 30 in all" over no rows, and four presses of Previous to see one. FIXED: it reads from the first page, as every
  other change does.
- **MEDIUM - a page an act emptied said the market was empty** (lane B, the author): the one order on Orders page 2
  filled - "Page 2 of 2 · 100 in all" over "No buy orders right now." FIXED (`ui/marketTab.js` load): a read that finds
  its page past the last that stands reads that one.
- **MEDIUM - a word composed was taken mid-word** (lane B, Chromium's IME through its DevTools protocol): the Work tab's
  search redrew the whole window 150 ms after the keys rested, the field with it, and a phone keyboard's "mithril" with
  one pause landed "mitmithril" ("みすミスリル" in Japanese); a phone's keyboard plausibly dropped at each pause too.
  FIXED: the bar's own changes draw the results alone - the grid, "Show more", the bar's counts - never the bar, so the
  field typed in stays (`ui/noticeWindow.js` workBody's `refresh`); a search waits for a composed word to be whole
  (`ui/workSift.js` typedField - the market's two searches too); and the window's paint waits while a word is composed
  in any of its fields (`render`'s `composing`).
- **MEDIUM - a market list's choice stood behind the old rows** (lane B): MARKET-AUDIT holds a redraw while one of the
  tab's lists has the focus, and a browser keeps the focus on a list after the choice - an answer the minute's cache gave
  waited for a click elsewhere: "Cheapest first" over 897, 896, 895 silver. The Family list did the same since
  MARKET-AUDIT. FIXED: a list a choice was made in is let go (`data-chosen`).
- **MEDIUM - the default order moved the contracts, and the record said otherwise** (lane C): SILVER-WAYS' contracts came
  best-paying first (`server-account/src/contracts.js` contractBoard), and the record called their fixture's order one
  the service never sends. KEPT, and named: ending soonest is the bar's one default for every kind; "Most silver" now
  orders a contract by what one defender is paid - the old order - where it had taken the pool (pay by defenders left).
  The pin note is corrected above.
- **MEDIUM - pins that could not fail** (lane C: 36 of 38 candidate mutants survived). Newest was also cheapest and no
  auction carried a bid, so Newest, Auctions' Dearest and Newest and the standing bid's Cheapest were unpinned; three of
  the Work tab's five kinds were never built in their producers' shapes, so a chapter writ counted as the Court's, a
  commission as a guild's, a contract fillable, a commission's piece unasked, the day's allowance and the reader's own
  guild dropped from the fill law, and the guild's, seat's, crafter's, poster's and region's words could all go unseen;
  the order's, quality's and family's page reset; a default order sent; the Orders' count without its family; the
  pager's cap, floor and scroll; the search's bound; a family Crafted does not list; work with no end; the chapters' head
  over Merit lines alone. FIXED: a fixture whose every order puts a different row first, auctions with standing bids, two
  families of orders and an arrows listing Crafted never lists, each order judged against a plain model of it; every kind
  of work in its producer's shape (`writView`, `guildWritView` with a seat writ, `contractView`, `commissionView`), a
  commission naming the reader with no piece, the day's three spent, the reader's own guild. 39 records became 89 - 88
  dead, the id tie-break kept as recorded (equivalent: no row on two pages rests on SQLite answering equal keys alike in
  two reads, which it does for one plan but does not promise); the five records the audit's own moves touched re-aimed by
  content (`audit31.json` AUDIT31-tab-two-grids, `audit_chap2.json` T-BOARD-KIND-TEXT, `chap3a.json` CHAP3A-CARD-KIND,
  `guild3.json` GUILD3a-your-writ-again, `marketaudit2.json` MARKET-AUDIT2-redraw-under-list), all dead; and every record
  over the files the audit touched, 900, judged again - 886 dead, 13 equivalent as recorded, and one survivor that
  survives the same on main before BOARD-SIFT (`audit30.json` AUDIT30-S5-a-piece-listed-off-the-road), left to its own arc.
- **LOW** - a seat writ unfound by "seat", "stockpile" or "camp" (lane B): FIXED, its card's words. "ruby" missing the
  "Rubies": FIXED, a material one and many. A Court or chapter writ's kind searched in the player's language alone while
  its card writes it in English (lane B, in German): FIXED, the card's words too. The counts at odds - each kind counted
  what no filter had left ("Commissions (1)" into "No work matches."), in the browser's numbers: FIXED, what the search
  and the fill leave, in the player's language's (`currentLocale`); the tab's own count stays the work open to take, as
  BOARD-UI made it. The focus fell to the page after "Show more" and the pages' presses (lane B): FIXED - the window keeps
  a press that keys its focus, and Next and Previous take no press while a page is read (disabled, they had lost the
  focus). "No Court writs in Daggerfall today" under a filter that sifted them away: FIXED. Rows past 5,000 unreachable
  (every lane): MARKET_PAGES_MAX is 500 - 50,000 rows, past what the Bay holds at thirty listings an account. "Least
  quality" read as "lowest" in six of the drafts (bg, cs, da, nb, id, ru): redrafted as a minimum. A Merit line's -8px
  under the chapters' head: FIXED. Stale words - the pager's "none while a page is read", Goods' "cheapest first",
  section 11's max(1, ...), the commit's "17" records re-aimed (16): corrected.

NOT CHANGED, named:
- **Pages read by OFFSET, each its own minute's** (lane A): a page cached a minute beside a page read fresh can show a row
  twice or miss one as listings come and go; a page is whole within one read. A cursor's pages are named, not built.
- **"Cheapest first" is landed within a page** (lanes A and B): the service pages by the listed price, and the courier's
  share orders the page it answers (AUDIT 30 U16), so page 2 may begin cheaper landed than page 1 ends. As designed.
- **A COUNT beside every paged read** (lane A): about twice the rows read for Crafted, Goods and Orders, and Auctions'
  count walks every open auction where its first page stopped early on its index; every plan is indexed and none scans a
  table. The count is what says "643 in all".
- **Materials' first look** (lane C): the Bay's cheapest hundred of every material and this region's fifty - the brief's
  "stops after a certain number" stands there until a search, a family or a tier is chosen, each of which reaches every
  material. Its two reads (the Bay's and the region's, MARKET-AUDIT) would page together awkwardly; named.
- **Goods unsearched**: a pack piece's name comes from the player's own item templates, which the service never holds.
- **A market list's focus after an answer the cache did not give** (lane B): the window rebuilds the list and the focus
  falls to the page, as the Family list's did since MARKET-AUDIT; keying the lists would hold every later answer behind
  MARKET-AUDIT's rule while one keeps the focus.
- **The live counts rebuilt at each paint** (lane B, plausible): a screen reader may not announce "Showing 40 of 213" or
  the page's line - the window's whole-paint design (BOARD-UI).
- **The Work tab's forty at a time is the client's**: the service still sends a region's Court and chapter writs whole,
  and fifty guild writs and fifty commissions, soonest to end (PROF6's WRIT_SHOWN).

## 11. Writs - the Work tab

- **Court writs** (the faucet): every region with a seat or hub posts **6 x max(1, ceil(active / 100)) a UTC day** (a
  pure function of the day, the region and `active`, the count the crown's scale reads - SEAT0 7.1), so the supply
  grows with the server: 45 such regions post 270 a day at up to a hundred active accounts, 810 at three hundred. A
  writ asks for a material from the region's own **witnessed** tables - metals, wood, herbs (4.1-4.3) and stone (4.5),
  never hides or fish, which are bounded, not witnessed (section 6), since a writ's Marks are minted only for a
  witnessed act (law 8; SILVER-FINDS' two finds are bounded by the day instead, 10.5) - mostly tiers 1-4, one a day of tier 5-6; **10-50** units, fewer at higher tiers. **Pay**: units x the material's Marks value x
  1.2, and Renown XP 25 x tier x units / 10 (MERGE 2: at main's RENOWN-ACCOUNT rate, three quarters floored -
  `net/professionLaw.js` writRenown - and to the delivering character's own track since RENOWN-CHAR; MERGE 2 had paid
  the ACCOUNT's one Renown). Each writ is filled once, by the first to deliver; at most **3** an
  account a day (CHAP2a: hall writs and Court writs together, one allowance - Chapters-Arc CALL 8; CHAP3a: and a member's own writ for its chapter). (The economy model, Appendix C, set 3 and 1.2: at 5 and 1.5 the Marks minted ran at 2.3 times the
  Marks burnt.)
- **Guild and seat writs**: their pay is escrowed from the guild's Marks treasury, so posting one is a withdrawal:
  the **Guildmaster** posts them (GUILD1's law: only the Guildmaster withdraws), or an **Officer** within a weekly
  **writ budget** the Guildmaster sets on the Guild tab. A writ's pay may not exceed **1.5 x the materials' value**
  (4.8), so a writ cannot be a disguised transfer to an alt. Partial fills pay pro rata; unfilled after 7 days, the
  escrow returns. A seat's writs build its fortifications (SEAT0 7.5) and count as influence at **the materials'
  value, never the pay** (SEAT0 4.2), for the holder or a pledged guild - **and only** for a delivery by a character
  who has been in the posting guild 7 days, whose account is bound to that guild for the week (SEAT0 4.2's per-account
  war), and only for **own** units (section 7). Bought units count at Tribute's rate (1 per 10 Marks of value) inside
  Tribute's cap; a counter's goods never count; anyone else's delivery earns the pay alone. A Siege Camp's stock is
  **spent at the Turning** - a Ram Kit to the siege it won, the rest burnt - and never withdrawn; the holder's stockpile is spent by its projects, never withdrawn - so a
  unit raises influence once.
- **Commissions**: a player posts a writ naming a crafter and a product; only that crafter can fill it; the item
  passes through the board (its provenance kept).
- **Bounties**: the Bounty Edict's camps (SEAT0 7.6).
- **In person**: a writ is taken at any board and delivered at the board that posted it: the delivery comes out of
  the Stores, and the deliverer must stand at that board (the relay knows it). AUDIT 31 R6: as built by PROF6 (28), a
  guild writ is delivered at ANY board of its region, on the client's word - the relay's witness is SEAT1b's, where a
  delivery raises influence; until then a lie buys a fast travel's worth, as a listing's does (26).

- **Crafting writs** (CRAFT-WRITS, section 49): a character's own three a day - a potion, a dish and a kit - asked by the
  guild that wants them, filled by goods the service saw it make.

## 12. Why a player comes back

A daily round of nodes; three Motherlodes a day; weekly Tides; the seasons' herbs; gate-touched veins after every
gate; recipes still to find; specialisations to choose; a Masterwork with your name in someone else's hand; the Hall
of Makers; commissions; regional prices to haul between; and every seat on the map wanting what you gather.

## 13. The threats, and the answers

| Threat | Answer |
|---|---|
| A modified client fakes harvests | Node ids from the pure law; service-rolled yields; ~~daily caps~~ the hour's writes (section 6, 20 - CAP-OFF, 2026-10-07: no day's cap) |
| A modified client fakes a craft | The service crafts; the client only receives (9.1) |
| A modified client plays a perfect act | Capped at one quality step and +50% yield, never past the rank (5.1) |
| A save-edited item enters the economy | The Stores are one-way (law 3); only a provenance id's owner lists it, one listing at a time (10.2, 18) |
| A save-edited or looted material deposited from the Materials Bag | The Stores page, a writ and the market move only the service's carried count, cut to what the pack holds and never raised (law 3 restated; `Materials-Bag.md` 5). A station's shortfall moves the rest, as loose - a station's alone, walled from every writ, guild and Drakes door, its products walled with it (BAG-CRAFT, the owner's call; AUDIT BAG-CRAFT A1; `Materials-Bag.md` 14, 15) |
| Fake gold buys the market | The market is in Marks (10.5); a gold listing is a realm character's alone, bought off its record on the service in the sale's own batch, and what gold bought never becomes Marks (10.8) |
| Marks inflate | Faucets from witnessed acts, each capped - SILVER-FINDS' two bounded by the day (30 and 20 an account, 10.5); the weekly report; the Bank's spread and every fee burn |
| A modified client claims loot finds it never opened | SILVER-FINDS: bounded, not witnessed - the service's dice say what a find strikes, and 20 silver an account a UTC day is the most a lie is paid (10.5) |
| Bots farm nodes | Per-character nodes, ~~daily caps,~~ travel, the hour's writes (CAP-OFF, 2026-10-07: no day's cap - Mac's call) |
| A modified client claims a rich node on a pixel nobody walks | The witnessed world: an unconfirmed pixel yields tiers 1-2 only, its veins 1-3 (section 6, UNWITNESSED-ORE) |
| A modified client invents dungeon ids | Four veins a day an account in dungeons nobody has vouched for (AUDIT 29 A5) - each of the deep table's whole draw since DEEP-OPEN (section 50): the trade the owner accepted, four full-table deep veins a day and no more; a dungeon's climate's Moonstone waits on the witnesses still |
| A modified client claims kills it never made | Hunting is bounded, not witnessed: ~~30 hides a day,~~ 3 of tiers 5-6 a day (section 6; CAP-OFF, 2026-10-07: the thirty of any tier gone, the three kept, Mac's word); hides mint no writ's Marks (no Court writ asks for them, section 11) - a hunt finds silver only as every harvest may (SILVER-FINDS: the service's dice, 30 an account a UTC day, 10.5) |
| A modified client claims hauls from water it is not in | Fishing is bounded: ~~40 hauls a day an account~~ by the hour's writes (CAP-OFF, 2026-10-07); no Pearl or Slaughterfish on an unconfirmed pixel; fish mint no writ's Marks (section 6, 11) - a haul finds silver only as every harvest may (SILVER-FINDS, 10.5) |
| ~~A modified client gathers at night~~ | RETIRED (ANY-HOUR, 2026-10-01): every client gathers at night - no hour is refused |
| Marks buy influence (materials bought at their value, then delivered to a seat) | Only **own** units count at their value; bought units at Tribute's rate inside its cap; counter goods never (section 7, 11) |
| Marks buy XP (a counter's endless goods, each recipe made once for its first-craft bonus - AUDIT 32 S1) | A recipe made wholly of goods only a counter sells earns its craft's XP and no first-craft bonus (3.2) |
| An alt or an outsider fills a guild's seat writ for influence | Only a 7-day member bound to the guild for the week earns influence by delivery; the rest earn the pay (section 11) |
| An Officer drains the Marks treasury through writs to an alt | Writ posting is the Guildmaster's, or an Officer's within a budget; pay at most 1.5 x the materials' value (section 11); and no rank that takes the guild Stores out delivers to its guild's writs, so the same units are never sold to the guild twice (AUDIT 31 S6, section 28) |
| One character does everything | Two crafts above Journeyman (3.2) |
| Crafting obsoletes loot | Rare at most (law 7) |

## 14. The server's shape

- `prof_tracks` (player, char_id, profession, xp, spec50, spec100) - BUILT, `0027_professions.sql`, with the
  pending change of specialisation (respec_rank, respec_to, respec_at) - PERK-TRIAL (`0173_perk_trial.sql`): a change
  is written at once and `respec_at` is the lock's end, `respec_to` left empty; `spec50_at`/`spec100_at` when each
  rank's choice was made, its day of trial from it
- `prof_stores` (player, char_id, material, origin, qty) - BUILT, `0027_professions.sql` - `origin` own or bought
  (section 7); `guild_prof_stores` (guild_id, material, origin, qty) with its ledger - BUILT, `0034_writs.sql` (PROF6,
  section 28: a row a material and a depositor - a member's own deposit kept under the character, the guild's own under
  none - with `guild_store_ledger`, written by triggers, and `guild_store_moves`, a move's row; AUDIT 29: this line
  read as built before it was)
- `node_harvests` (day, node, kind, player, char_id - the node its one spelling, AUDIT 29) - BUILT,
  `0027_professions.sql` (with the harvest's profession, material, qty, XP credited, rid and nonce; AUDIT 29's
  `0029_audit29.sql` adds `deep_unconfirmed`, a dungeon vein nobody vouched for; pruned after two days by the state's own read, section 20; PROF2's `0028_mining.sql` rebuilt it for
  the kinds `ore` and `stone` and a found `gem`; PROF4's `0031_logging.sql` rebuilt it again for the kind `logs` and a
  second find, `extra` - a tree's Resin); `prof_withdrawals` (a withdrawal's rid) and `world_witness` (SEAT0
  3.2's witnessed pixel) BUILT with it - its second kind, the witnessed dungeon, PROF2's; `fish_hauls` (day, account,
  n) for the account cap
- `prof_smelts` (player, rid, char_id, recipe, count, own, bought, xp, at, n) - BUILT, `0028_mining.sql` (PROF2: a
  smelt's decision, the row its answer is read back from)
- `prof_choices` (player, rid, char_id, profession, rank, spec, at, n) - BUILT, `0029_audit29.sql` (AUDIT 29: a free
  first specialisation's row, found by its id before the switch; a paid change keeps its Marks line, which names its
  track)
- `recipes_known` (player, char_id, recipe) - not yet: every recipe unlocks by rank until the found ones come (PROF6b -
  AUDIT 31 R8: PROF6 gave them their own slice, 28)
- `products` (provenance PK, template, material, quality, maker, made_at, listed) - BUILT, `0030_smithing.sql` (PROF3:
  provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, listed), with
  `prof_crafts` (a craft's row) and `prof_stock` (a purchase from the smith's stock); `0031_logging.sql` (PROF4) adds
  `products.marked` (the maker's mark a Masterwork or a Master Joiner's furniture carries) and `prof_crafts.heartwood`.
  No condition and no enchantments (AUDIT 30 R2: this line promised both): a listed piece's wear rides its listing
  (`market_listings.wear`, in thousandths, PROF5) and the buyer's piece is minted again from its record at that wear -
  so only a piece still as minted lists (section 26)
- `marks` (account, balance); `guild_marks` (guild_id, balance); `marks_ledger` (seq, src_kind, src_id, dst_kind,
  dst_id, kind, amount, day, at, actor, who, rid) - BUILT, `0025_marks.sql` (AUDIT 28: this line gave the first sketch)
- `market_listings` (id, region, seller, material or provenance, qty, price, expires_at); `market_orders` - BUILT,
  `0032_market.sql`; no `couriers` table (AUDIT 30 R14: this line named one as built) - a courier rides its sale's row
  and a piece's delivery (PROF5, section 26: `market_listings` - a material's
  units own and bought apart, a piece's provenance and wear, its fee, state and return; `market_sales` - a purchase's
  row, its tax, courier, road and arrival, the couriers' loads; `market_deliveries` - a piece on its way to a pack, bought
  or come back; `market_orders` and `market_fills`; `market_prices`, the History's day table; `market_reports`), with the
  ledger's `escrow` end, the witness's `hub` kind and `products` kept past its owner's account; `market_auctions`,
  `market_bids` and `market_auction_reports` - BUILT, `0033_auctions.sql` (PROF5b, section 27)
- `writs` (id, kind, poster, region, key, material, qty, pay, escrow, expires_at, filled) - BUILT for the Court's
  writs alone, `0027_professions.sql` (id, kind `court`, day, region, slot, material, tier, qty, pay, renown, expires_at,
  filled_by, filled_char, filled_at, rid, n), with `writ_days` (a region's day written down, and its `active`); PROF6's
  guild writs their own table, `guild_writs` (0034_writs.sql: the guild, its poster and whether an Officer, the seat
  week, the region, the material, the units and those left, the pay each, the escrow left, its state and return), with
  `guild_writ_fills` and `guild_writ_budgets`; and `commissions` (the poster, the crafter, the region, the recipe and
  its least quality, the pay, its state, the piece that filled it)
- `board_notes` (id, map_id, author, author_name, subject, body, button, guild_id, char_id, at, expires_at, hidden,
  rid), `board_reports` (note_id, reporter, at) and `board_notices` (id, subject, body, author, author_name, at,
  expires_at, rid) - BUILT, `0026_board.sql` (AUDIT 28: this line gave the first sketch)
- Endpoints: `/v1/prof/*` (harvest, spec; `smelt` BUILT with PROF2; `craft` and `stock` BUILT with PROF3; PROF4's trees, burns, saws, Carpentry and
  the furnisher's Linen through the same five; PROF5's Weavers' counter too), `/v1/stores/*`, `/v1/marks/*` (balance,
  exchange, guild; the report's medians with PROF5), `/v1/board/*` (notes), `/v1/market/*` (BUILT with PROF5: read, list,
  buy, cancel, order, fill, unorder, collect, report, remove), `/v1/writs/*`.
- Law modules (pure, shared by client and service): marksLaw.js, boardLaw.js, professionLaw.js, nodeLaw.js and
  kingdomLaw.js (built - the last PROF2's, SEAT0 4.3's map); recipeLaw.js (built, PROF3; Carpentry's with PROF4) and
  productRecord.js (PROF3's signed record); marketLaw.js (built, PROF5 - the market's bounds, fees, tax, courier and
  road; AUDIT 30 R15: this line left it out).
- The relay: the activity field on the pose (a `RELAY_VERSION` and LAW row - BUILT, PEER-ACTS's world200, section 45);
  the in-person check for deliveries.

## 15. The slices, in order

| Slice | What | Done when |
|---|---|---|
| **PROF0** | This record | - |
| **MARKS1** - SHIPPED 2026-09-28 (at `dev`) | Marks: balances, the guild Marks treasury, the ledger, the Bank's exchange, the weekly report; the first faucet is the gate's receipts (Court writs come with PROF1's Stores - a writ filled from the pack would be a save item bought with Marks) | Every faucet capped and pinned; gold never becomes Marks, pinned |
| **NOTICE1** - SHIPPED 2026-09-28 (at `dev`) | The Notice Board (10.7): a town's rumour boards open it online - every board BOUNTY1 did not take (ONE-BOARD REVERTED, 10.11; BOUNTY1's bounty boards stay the hunts), the rumour pinned first and the bounty board's line under it; the server's word; the Notices tab; player notes, their button, reports and moderation; the count over the board. The Work tab moved to PROF1 | Offline a rumour board is byte-for-byte DFU's (the ROAD A9 pins hold) |
| **NOTICE1b** | Boards stood where a hub lacks one (10.1), if `tools/boardCount.mjs` names any; a seat's with SEAT1 | Mac's run of the measure |
| **PROF1** - SHIPPED 2026-09-28 (at `dev`, section 22) | The Stores; **Herbalism** with its act; the board's **Work tab**; the Professions and Stores tabs, the prompt, the meter, the toasts; the Sickle and the Basket's search; withdraw to pack; **Court writs** (section 11); FORAGE0 law 6's online exception - the six tools shelve online whatever the switch says. **Needs FORAGE1-2 (shipped)**, MARKS1 and NOTICE1 (FORAGE0 17) | An herb picked online reaches DFU's potion maker by the pack |
| **PROF2** - SHIPPED 2026-09-28 (at `dev`, section 23) | Mining and Quarrying with their acts; the dungeon veins and the witnessed dungeon; gems; smelting at a forge (a smith's, or a home's forge station); ores and ingots (610-630) and stone (673-674); the Prospector's compass; metal and stone writs. Motherlodes and gate-touched ground are PROF2b. Needs FORAGE1-2 (shipped: the Pick-Axe) | Veins placed on rock fields; signatures by kingdom |
| **PROF3** - SHIPPED 2026-09-28 (at `dev`, section 24) | Smithing with its act; quality; provenance; the anvil (the forge stands since PROF2); the smith's stock (the fittings the professions do not yet yield) | A crafted Mithril Longsword is DFU's, with its quality |
| **PROF4** - SHIPPED 2026-09-28 (at `dev`, section 25) | Logging with its act (the falling tree); Carpentry; furniture; the Ram Kit | DECOR places a crafted table. Needs FORAGE1-2 (shipped: the Wood-Axe) |
| **PROF5** - SHIPPED 2026-09-29 (at `dev`, section 26) | The Market tab: listings, regional markets, couriers, buy orders, history; the Weavers' counter | A crafted Mithril Longsword listed in one region is bought from another by courier and reaches its buyer's pack, its owner moved. Needs MARKS1, NOTICE1, PROF3 (all shipped) |
| **PROF5b** - SHIPPED 2026-09-29 (at `dev`, section 27) | Timed auctions for Masterworks: the Auctions view, bids escrowed, the last two minutes' two, settled on read | A Masterwork posted in Daggerfall is bid on from Wayrest and Daggerfall, the outbid escrow returned, and at its end the winner's piece is theirs, the seller paid less the tax. Needs PROF5 (shipped) |
| **PROF6** - SHIPPED 2026-09-29 (at `dev`, section 28) | Writs: guild writs and the guild Stores, commissions and the note's button (built); seat writs with SEAT2b (AUDIT-SEATS: it said SEAT1b), bounties with SEAT1d's Edicts | A Guildmaster's writ delivered by an outsider and a member into the guild Stores, an Officer's posted within the week's budget and refused past it (AUDIT 31 R12: this row said an Officer's writ was delivered); a commission through a crafter's note filled with a piece of their make and in the poster's pack. Seat writs need SEAT1b |
| **PROF2b** - BUILT 2026-10-03 (section 38) | The Motherlodes (section 6): three a UTC day on witnessed ground, twenty strikers each, 10 silver and 4-9 of a tier-6 ore, the relay's Watch on the pixel; the warning; the compass from anywhere; Motherlode Sense unlocked. Gate-touched ground (4.7) is still to come: a gate receipt carries no pixel | An Apprentice miner warned ten minutes ahead, walks to the Wrothgarian Mountains, strikes the Motherlode with the Watch's word and finds Orichalcum and 10 silver |
| **PROF6b** | Found and writ-only recipes (9.1): the Recipe Scroll (695), the found recipes named, a guild's posted recipe reward | Needs a witnessed roll for loot's 1 in 500, and the Motherlode's 1 in 20 (PROF2b built - its roll is PROF6b's) |
| **PROF7** - SHIPPED 2026-09-30 (live, section 29) | Hunting (the trace), the Skinning Knife (603: its template, its online shelves - law 6's exception, for 603); Outfitting | A bear felled by the player's own blow skinned online, its hides cured and sewn into a Leather Helm in the pack; a shirt in the dye its sewer chose. Needs FORAGE1-2 (shipped: the shelves' registry) |
| **PROF8** - BUILT 2026-09-30 (section 30) | Fishing with the net (the throw, the tug, the haul) | A haul of Raw Fish from a river, its species named; a Pearl at sea on confirmed ground; ~~forty hauls an account a day~~ (CAP-OFF, 2026-10-07: no day's hauls). Needs FORAGE1-2 (shipped: the net, and the three-valued water state in both exterior hosts) |
| **PROF9** - BUILT 2026-10-02 (section 35) | Cooking | A Hunter's Stew cooked with a clean pan at a fire from the Stores' Raw Meat, Mushroom and Root Bulb, into the pack, eaten for Endurance +5 two hours; a Chef's Feast of the Hearth shared with the party at the table; a Provisioner's dish that never spoils. Needs PROF7 (Raw Meat), PROF8 (Raw Fish), PROF1 (the herbs and the Basket's foods) and C&C's fires |
| **PROF10** - BUILT 2026-10-02 (section 36) | Jewelcrafting | A Gold Ruby Ring cut with a clean facet at a Gem Store's bench from the Stores' Gold and Ruby, into the pack as DFU's own Ring carrying Gold's and the gem's points (2,160) to the item maker; a Gemcutter's ring at +30%, listed and minted again from the market with its hand; a Lapidary's Siege-cracked Gem set as a Diamond. Needs PROF2 (the metals and gems), PROF8 (the Pearl), PROF7 (Cured Leather), PROF4 (the Wand's planks) and the Seats' Spoils of War |
| **PROF11** - BUILT 2026-10-01 (section 34) | Masonry | Cut Stone and Mortar at the mason's bench, the chisel clean; the Sculptor's four stone pieces in a home; the Builder's stone and the Fortifier's Walls at a seat's works (SEAT2b). Needs PROF2 (quarrying); SEAT2b and PLOT1 consume what it makes |
| **PROF12** - BUILT 2026-10-02 (section 37) | Alchemy and Enchanting layers; Disenchanting | A Healing brewed at an Alchemist's from the Stores' Red Berries and Mercury and the Apothecaries' Troll's Blood and Elixir Vitae, into the pack as DFU's own potion; a Master Alchemist's Potent one at +40%, named so; a crafted ring disenchanted into Arcane Essence; the item maker's gold a Master's 20% less; and the Apothecary opened - its step a tier for the holder's jewellers, cooks and alchemists in its town. Needs PROF1 (the herbs), PROF2 (the metals and gems), PROF7 (a body's parts), PROF8 (the Pearl), PROF9 and PROF10 (the Apothecary's other two) |

## 16. What remains to measure

1. **The Marks economy** - after four weeks of MARKS1, the weekly report: if more is minted than burnt by a quarter,
   the Bank's rate falls a Mark's worth; if less, Court writ pay rises 20%. Recorded here.
2. **The node density** - Mac's eye in the field after PROF1-2: the table in section 6 moves by whole nodes.
3. **The act windows** - after PROF1, the share of clean acts: aimed at a third for a Journeyman.

## 17. The four hosts and the process laws

### 17.1 The four hosts

Every PROF slice's record names all four (Home.md, THE FOUR HOSTS RULE, 17e), each wired or FLAGGED:

| Host | What the professions are there |
|---|---|
| `scenes/world.js` - the streaming world | The wilderness nodes (trees, herb patches, veins, boulders, fishing spots and schools), placed as each terrain tile streams in and freed as it streams out; Motherlodes; gate-touched ground; the Notice Boards; every gathering act; Hunting's skinning outdoors |
| `scenes/exterior.js` - the fixed city | DFU's own board of its one city - never the Notice Board, which is online's (10.7; AUDIT 28 corrected "the board"). **FLAGGED by name**: no nodes - a fixed city has no wilderness around it and no streamer to place them |
| `scenes/worldModes.js` - building interiors | The stations (a home's, a guild hall's, a shop's for its use fee); the crafting acts; the Stores chest at a home, a hall or a seat's palace; a station's window in the host's overlay slot; Hunting's skinning of a building's own foes (INDOOR-SKIN, 29) |
| `scenes/dungeonContext.js` - dungeons | Dungeon veins on the RDB walls (Dwarven Scrap, Adamantium, Diamonds); Hunting's skinning of a dungeon's foes; the act rig as outdoors |

### 17.2 The process laws, applied

| Law | What it means here |
|---|---|
| **ONE DFU MEMBER, ONE EXPORT** | Nothing DFU or a vendored mod owns is re-typed: DFU's recipes (`POTION_RECIPES`) are imported by the Alchemy layer, never copied; items through `templateByIndex`; C&C's `TEMPLATE` constants, Deep Waters' `PASSIVE_FISH_SPECIES`, `BULLETIN_BOARD_MODEL_ID`, `itemDye.js`'s colours and `WEAPON_MATERIALS` are imported. recipeLaw.js is the one home of every new recipe |
| **A PIN MUST FAIL** | Every recipe, node table and number in Appendix B is pinned by `deepEqual` against its law module, and each slice's mutants (`tools/mutants/prof*.json`) prove it |
| **TEST THE SHAPE THE PRODUCER MINTS** | A crafted item in a test is the service's own product record passed through the client's own add path (`setItemFields`), never an item literal - the exact failure 17e names (`{ enchanted: true }` written by no producer) is the one this law exists for |
| **THE MODAL CONTRACT** | The board's window, a station's window and the act overlay each return the same type from every exit, asserted in a test |
| **THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD** | A station or the board in the host's overlay slot: the slot is nulled before the window is disposed; its close dispatches once |
| **ASYNC NEVER DROPS** | A harvest, a craft, a delivery, a listing each carry a request id; a second press while one is in flight coalesces; a lost answer is re-asked with the same id and answered, never credited twice (Renown's `last_rid`) |
| **EVERY ALLOCATION HAS AN OWNER** | Node billboards are owned by their terrain tile's batch and freed at stream-out; a felled tree's falling flat by the node; the act meter by its overlay; the tool's sprite by the weapon rig |
| **THE ONE CONSTRUCTION SEAM** | One constructor builds a station's window and one the board's, for every host; a test sweeps the source for a stray `new` |
| **THE NATIVE-WINDOW RULE** | The offline bulletin board's parchment is native and keeps its ROAD A9 cites; DFU's potion and item makers stay native and untouched; every new window is the port's own Enhanced Plus window and cites `src/ui/enhanced/enhancedStyle.js` |
| **A SLICE CLOSES ITS LEDGER ROW** | MARKS1, NOTICE1 and PROF1 each add their Port-Ledger section A row (MARKS: THE SERVER'S CURRENCY; THE BOARD, ONLINE; PROFESSIONS); PROF2 added its own (MINING); later slices add theirs or narrow these |
| **THE RELAY VERSION** | The activity field on the pose and the in-person check are relay changes: a `RELAY_VERSION` and a LAW row each |

## 18. Lifecycles and edge cases

- **A character is deleted**: its Stores, tracks, specialisations and recipes go with it (the delete dialog lists
  them); its Marks stay, because Marks are the account's.
- **An account is deleted**: its Marks go; its live listings are cancelled and their goods burnt; its buy orders'
  escrow is burnt; a guild it led runs GUILD1's `succeed()`. **OPEN** (AUDIT 31 S1, S2, S7, R13): no route deletes an
  account today (FACT: nothing deletes a `players` row), and its rows cascade, so the route that does must first answer
  for what the cascade would strand - an auction it posted (its bids go with it, and every bidder's escrow with no
  line: void and return them first), a bid it leads (the auction closes unsold at its end - BUILT, AUDIT 31 S1), a
  commission it posted (its escrow returned or burnt by a line) or names (declined, its pay home - BUILT, PROF6), an
  order's escrow (burnt by a line, as said), and a guild left with no one (never reclaimed for its name while it keeps
  anything - BUILT, AUDIT 31 S7).
- **The Tithe** (10.4) - BUILT (SEAT1d, 2026-10-01; `06-Systems/Online-Arc.md` SEAT1d), closing AUDIT 31 L5's OPEN item:
  a sale and an auction's close take their seat's holder's rate and write the Tithe's own line (`tithe`, to the
  holder's treasury, or burnt where the guild is gone or its cap holds), and a courier's share goes the same way; a
  guild writ's delivery and a commission's fill take none (Seats-Arc 7.2: "a writ has no fee"), and the law's nought
  (`MARKET_TITHE_PCT`) stays the default where no seat holds the board (`test/net/audit31_law.test.js`).
- **A guild disbands** (or its last member leaves): refused while its gold treasury or its guild Stores hold anything
  (GUILD1's rule, grown a clause - BUILT with PROF6, and while one of its writs stands, or a closed one's pay waits for
  the treasury's room - AUDIT 31 A15: section 28), while it holds a Charter and while a Right of Siege or a Tourney is pending (SEAT0
  16). Its Marks refuse nothing: they go to its guildmaster in the same batch as the delete (AUDIT 28 M3/M5 - a switch
  the guildmaster could not pass would otherwise lock the guild for good), refused only past the guildmaster's cap.
- **The Stores are full** (5,000 of a material): the prompt says so before the act ("Stores full - Oak Logs"), so a
  harvest is never played for nothing. BAG1: for a carrying book the prompt is the bag's and the pack's ("No room in
  your bag or pack"), or the carried count's bound (`06-Systems/Materials-Bag.md` 3).
- **A crafted item changes hands.** The service keeps each provenance id's **owner**. TRADE1's confirm step, when a
  provenance item is in the trade, asks the service to hand the id over (both parties' tokens, the relay's verified
  trade); a market sale hands it over by itself. A listing is accepted only from the owner, and an id has **one live
  listing at a time** - so a crafted sword can be bought and resold forever, and a duplicated copy in a save can never
  be sold as well, because its id's owner has moved on.
- **A crafted item goes offline.** It is DFU's own item, and its extra fields ride the save - FACT, the save snapshots
  every item whole (`snap.items = (entity.items ?? []).map((it) => ({ ...it }))`, `src/systems/save/save.js`), as Loot Rarity's
  `rarity` already rides. Offline it is simply the item it is. A classic-save export (`src/systems/classicSave.js`)
  carries DFU's fields alone, so there it becomes the plain DFU item it always was.
- **A Masterwork's maker renames**: the mark keeps the name at the moment of making - it is history.
- **An item sold to a shop's shelf** (WORLD6a: another player may buy it off the shelf): its provenance owner does not
  move, so it cannot be listed by the new holder until a TRADE1 or a relisting by its owner moves it - the shop is not
  a way round the market's law.

## 19. Failures and outages

- **The service is unreachable during an act.** The act still plays; its harvest request waits in a queue with its
  request id and is retried for up to 10 minutes (ASYNC NEVER DROPS); a node id that has expired (the UTC day ended)
  lapses with a toast saying so. The node greys only when the service confirms.
- **Crafting needs the service.** A station says "The counting-houses are not answering" and offers nothing; no
  offline crafting, because the Stores and the dice are the service's.
- **The board** reads through a 60-second cache, so a slow service shows the last good board; its writes wait for the
  service.

## 20. Rollout, moderation, data

- **Switches**: `PROFESSIONS_OPEN`, `MARKS_OPEN` and `BOARD_OPEN` in the account service's config (off, dev, on); at
  `dev` only the dev glyph sees them. `MARKS_OPEN` and `BOARD_OPEN` stand (MARKS1, NOTICE1, `server-account/wrangler.toml`), each shipped at `dev`; `BOARD_OPEN` is `on` since BOARD-ON (2026-09-29, Mac: "Board now, rest after fixes" - `06-Systems/Online-Arc.md` BOARD-ON), `MARKS_OPEN` and `PROFESSIONS_OPEN` `on` too since SWITCH-ON (2026-09-29, Mac: "Fuck it lets switch everything on"), with the pack saved after a professions act (PROF-SAVE) and a deleted character's Stores no longer stranded (PROF-DELETE) - `06-Systems/Online-Arc.md`. Season 0 (SEAT0 18) is the professions' beta too: Marks, the Stores and tracks
  are kept through its wipe.
- **Moderation**: player notes pass MAIL1's letter law and its filter; moderators (MOD1) remove a note
  (`/note remove <id>`) and may mute its author; a listing may be reported and removed the same way (the goods
  returned). Market wash-trading between one's own accounts is allowed and visible in the ledger - it moves Marks,
  it cannot mint them.
- **Rate limits** per account per hour (GUILD1's `GUILD_OPS_MAX` shape): harvests are already capped by the day;
  crafts 600, listings 60, notes 10, writ posts 20.
- **Data kept**: `node_harvests` pruned after 2 days; the Marks ledger and `products` forever (they are the
  economy's audit); listings' history 90 days; notes deleted on expiry.

## 21. The screens

Enhanced Plus windows, in its brass and bone; layouts, not art. The board's Seat tab is SEAT0 19.

**The board's Work tab** - the seal's colour says who posted a writ:

```
+--------------------------------------------------------------------------------------------+
| NOTICE BOARD - Anticlere           [Notices] [WORK] [Market] [Seat] [Guilds] [Makers]      |
+--------------------------------------------------------------------------------------------+
| (purple) COURT WRIT            | (SH) SEAT WRIT                 | (green) COMMISSION        |
| The Court of Anticlere needs   | The Silver Hand's Walls need   | For Silverthorn only:     |
| 30 Red Poppies                 | 280 more Cut Stone             | a Mithril Longsword       |
| Pays 72 Marks, 150 Renown      | Pays 2 Marks each              | Pays 900 Marks            |
| 14 hours left                  | 520 / 800 delivered            | 5 days left               |
| [Take]   34 in your Stores     | [Deliver 40 from the Stores]   |                           |
+--------------------------------+--------------------------------+---------------------------+
| Court writs today: 1 of 3                                                                  |
+--------------------------------------------------------------------------------------------+
```

**The board's Market tab**:

```
+--------------------------------------------------------------------------------------------+
| MARKET - the boards of Anticlere     [MATERIALS] [Crafted] [My listings] [Orders] [History]|
| Search [mithril        ]   Family [Ores and Metals v]   Tier [any v]   Sort [price v]      |
+--------------------------------------------------------------------------------------------+
| Mithril Ore       x120    8 Marks each   here                    median 8.4   _/\_/        |
| Mithril Ore       x40     7 Marks each   Wayrest  +26 courier, 45 minutes                  |
| Mithril Ingot     x12    21 Marks each   here                    median 22    __/          |
+--------------------------------------------------------------------------------------------+
| Buy 40 Mithril Ore for 280 Marks + 26 courier?    [Buy]          Your Marks: 1,240         |
+--------------------------------------------------------------------------------------------+
```

**The Professions tab** (the character sheet):

```
+----------------------------------+---------------------------------------------------------+
| GATHERING                        | LOGGING                         Apprentice  34 -> 35    |
|  Mining       Apprentice  27 ==  | [=====================-------]  11,900 / 12,250 XP       |
|  Logging      Apprentice  34 === | Today: 34 of 60 trees                                   |
|  Herbalism    Journeyman  52 ====| At 50, choose:  [ Lumberjack ]  or  [ Forester ]        |
|  Hunting      Novice       8 =   | Unlocks: Cherry (25), Teak (40), Mahogany (55),         |
|  Fishing      Novice       0     |          Ironwood and Ghostwood (70)                    |
| CRAFTING                         |                                                         |
|  Smithing     Journeyman  61 ====| Crafts above Journeyman: 1 of 2                         |
|  Carpentry    Apprentice  30 ==  |                                                         |
|  ...                             |                                                         |
+----------------------------------+---------------------------------------------------------+
```

**The Stores tab**:

```
+--------------------------------------------------------------------------------------------+
| THE STORES      Search [      ]  [Ores and Metals] [Wood] [Herbs] [Hides and Cloth]       |
|                                  [Food] [Stone] [Gems] [Essences] [Spoils]  Sort [tier v]  |
+--------------------------------------------------------------------------------------------+
|  [Iron Ingot 212]  [Steel Ingot 40]  [Mithril Ore 18]  [Oak Log 96]  [Oak Plank 30]         |
|  [Red Poppy 34]    [Golden Poppy 4]  [Bear Hide 6]     [Cut Stone 140]                     |
+--------------------------------------------------------------------------------------------+
| Oak Plank x30 - tier 2 - 2 Marks each      [Withdraw to pack]  [List]  [Deliver to a writ] |
+--------------------------------------------------------------------------------------------+
```

**A station** (a forge):

```
+-----------------------------+------------------------------------+-------------------------+
| RECIPES   [Can make now]    | MITHRIL LONGSWORD       rank 55    | THE HEAT                |
|   [All known] [Tier v]      | Mithril Ingot  3 / 3  (18 stored)  |   ___/\___/\___         |
|  Mithril Longsword  *       | Copper         1 / 1               |      [ band ]           |
|  Mithril Cuirass            | Cured Leather  1 / 1               |   strikes: o o .        |
|  Steel Claymore             | your rank 61, margin 6:            |                         |
|  Repair Kit (Mithril)       | Crude 20 | Standard 60 | Fine 20   |                         |
|                             | [Craft]  [Quick craft]  [Craft x N]|                         |
+-----------------------------+------------------------------------+-------------------------+
```

**The act meters**, centred on the crosshair (each with a still form for Reduced motion):

```
  Logging - the ring            Mining - the glint           Herbalism - the steady hand
       .-""""-.                  +-----------------+          [##########--------]  1.6 s
      /  .--.  \                 |  .    *     .   |          hold still  (3 degrees)
      |  |()|  |  <- band        |     .      .    |
      \  '--'  /                 +-----------------+
       '-....-'                    strike the *

  Hunting - the trace           Fishing - the haul                             The Basket - the search
   o . . . o . . . o             |---[  band  ]--------|   haul [########------]    ( * )  .   .     1 of 3
    (draw along the dots)                  ^ the net's weight                        click the glint
```

## 22. PROF1 - the Stores, Herbalism and Court writs, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Begin!"** What the design above left open for PROF1, DECIDED here (the record's, at Mac's instruction), and
what was found (FACT):

- **Behind a switch, registered only.** `PROFESSIONS_OPEN` (off, dev, on) in `server-account/wrangler.toml`, shipped at
  `dev`. The Stores are a character's and a guest is a device (MARKS1's reading), so every professions route is a
  registered account's - the reads too: a guest has no Stores to read. A Court writ pays Marks, so a delivery needs
  `MARKS_OPEN` too. An act's request is found by its id BEFORE the switch is asked: a harvest or a delivery made is
  answered as made though the switch shut after it. The service is `acct19`; the tables are `0027_professions.sql`.
- **The laws.** `src/net/professionLaw.js` (the thirteen, ranks, XP, tiers, specialisations, ~~the day's cap~~ (CAP-OFF, 2026-10-07: none), the Stores'
  cap, the Herbalism acts' numbers, the materials PROF1 stores, the Court writs) and `src/net/nodeLaw.js` (section 6's
  node table, 4.3's herb tables, the seasons, a pixel's day of patches, the yields, the witnessed pixel). Both ends
  read them; recipeLaw.js comes with the first craft (PROF3).
- **An herb is DFU's own item, north or south.** FACT: DFU keeps two groups of plants - PlantIngredients1, named
  "(northern)" below template 18, and PlantIngredients2, "(southern)" (`src/systems/item/itemInfo.js` itemNameParts) - and
  nine plants are in both (Twigs, Green Leaves, Red and Yellow Flowers, Root Tendrils, Root Bulb, Green, Red and Yellow
  Berries). DECIDED: an herb's group is its pixel's region's by FALL.EXE's own table (`REGION_RACES`: a Breton region
  northern, a Redguard one southern); a plant only one group holds is that group's wherever it grows. So the Stores keep
  a two-group plant as two materials ("Twigs (northern)", "Twigs (southern)"), and a withdrawal is the very item DFU's
  own loot would have been.
- **A pixel's patches** (section 6, herbs): the climate's count a UTC day; a patch is `(x, y, day, slot)`; its place in
  the pixel is the law's; its tier rolls 40 / 25 / 15 renormalised over the herbs' three tiers (8 : 5 : 3) and is held
  to tier 2 on a pixel not confirmed; its herb is drawn evenly from that tier's herbs growing in the season - DFU's
  season (`seasonValue`), on the shared clock at the UTC day's first instant, so a day's patches never change under a
  player. The client stands a patch as a small cluster of the herb's own world picture (TEXTURE.254, the plant's item
  flat - no new art) and stands none where DFU's own nature would not (a location's rect, water, a slope - terrainNature's
  rules).
- **The seasons, read.** Winter bares the flowers, roses, poppies and berries (4.3); Green Leaves and Clover, which that
  line names on neither side, grow all year. Spring's +50% is every flowering herb the winter line bares less the
  berries (flowers, roses, poppies); autumn's is the berries. A patch whose herb is out of season yields to a Seasonal
  Eye at half (3.3): the law draws the herb from the patch's tier first, and a patch whose first draw is bare draws again
  among what grows at that tier, stepping down a tier until something does - the first draw stands for a Seasonal Eye.
- **The witnessed pixel** (SEAT0 3.2) is built here with its first kind: `world_witness` (kind, key, account, report,
  region, at). A harvest carries its pixel's climate and region; an account seven days registered reports a pixel once;
  three agreeing make it confirmed; two agreeing on another answer afterwards make it disputed, and the confirmed answer
  stands. `world_facts` and a moderator's settling come with SEAT1a. `/v1/prof/pixels` tells the client its streamed
  pixels' states, so a patch never shows a rare herb its pixel would not give. A march's +25% is a confirmed pixel's
  alone (an unconfirmed pixel is worth the least its kind allows).
- **The acts** (5.2): a common herb comes up by hand in 0.8 s, with no moment (plain XP); an uncommon or rare herb needs
  the Sickle and the rank (tier 2 at 10, tier 3 at 25) and holds E for 2.5 s, bruised by turning more than 3 degrees
  (times the band and Botanist's +50%) or by moving a quarter of a metre; letting go early or Esc ends it with nothing
  lost. The Basket: three glints in turn, attack while each shows. Foraging's checks first, with the Sickle's lines for
  herbs and the Basket's for food (FORAGE0 14.3). A completed act wears its tool by 1 (FORAGE0 14.1). Gentle acts (a
  setting): every act plain. Reduced motion is the system's own (FACT: the port has no setting of its own - every window
  reads `prefers-reduced-motion`); under it the meters are still bars.
- **The act choice key** (8): `ActChoice`, the Controls page's Professions group, default the up arrow (FACT: every
  letter and digit is bound, and `-`, `=` and `/` are the decorator's own keys - `scenes/decor/decorTool.js` DECOR_FREE_KEYS -
  so the sweep that holds every raw key to its action, `test/scenes/inputmap.test.js` I2, refused `=`; it shipped on `;` until
  the merge of main, whose Come Sail Away took `;` for its lantern first (CSA-D) - the up arrow is read by no action in
  play).
- **Court writs** (11): a region posts once its ground is witnessed - the service knows no hub (SEAT0 3.2), and a region
  with ground has one - `6 x max(1, ceil(active / 100))` a UTC day, `active` the registered accounts whose last beat
  (ACC4's `played_at`) fell in the seven days before the day began, counted when the region's day is first read, when
  its writs are written down for the day. A writ asks a material the region's witnessed ground yields in the day's
  season (a confirmed pixel's whole table, an unconfirmed one's tiers 1-2) - herbs, in PROF1, since the Stores hold
  nothing else yet; units 10 to 50 in tens (so the pay and the Renown are whole), fewer at higher tiers; the day's first
  writ the table's highest tier. **Take** fills it - a Court writ is filled whole by the first to deliver (11), so taking
  one is delivering it, at a board of its region, from the Stores, bought units first. The service does not see the
  board: its in-person check comes where a delivery raises influence - SEAT2b's seat writs (AUDIT-SEATS: it said SEAT1b's;
  PROF6, section 28: this line
  said PROF6, whose writs raise none); a Court writ's pay is bounded by its
  three a day wherever it is asked from.
- **Withdraw to pack**: bought units first; the items the law names, minted as DFU mints them; a withdrawal whose answer
  was lost is kept and asked again with its id (MARKS1's kept sale).
- **The shelves' exception** (FORAGE0 law 6): online, the six tools shelve whatever Foraging's switch says.
- **The four hosts** (17.1): **the streaming world** (`scenes/world.js`, through `scenes/herbHost.js` - since PROF2 a
  kind in the one gathering host, `scenes/gatherHost.js`, section 23) stands a built
  wilderness pixel's patches in the pixel's own list, so its frame walk draws them and `destroyPixel` frees them; the
  prompt, the act, the answers, the Work tab on its boards. **The fixed city** (`scenes/exterior.js`) - **FLAGGED by
  name**: no nodes, as 17.1 says. **Building interiors** (`scenes/worldModes.js`): nothing stands there in PROF1 (the
  stations are PROF3's); the book's answers still come in (the host's tick runs indoors), and the Professions and
  Stores pages are the Enhanced pause menu's in every host (AUDIT 29: the classic skin's pause has no Stats rail -
  **FLAGGED**). **Dungeons** (`scenes/dungeonContext.js`): no herbs - their
  veins are PROF2's.
- **The tool in the hand**: for the steady hand's length the classic lane's rig draws the Sickle as DFU's Tanto
  (template 114), its idle frame, and nothing else (`combat/weapon/weaponRig.js` `actTool`, above the sheathe gates, as the
  held map's classic lane takes the hands). **The Morrowind lane keeps its stance - FLAGGED**: its arm draws a modelled
  weapon, not a sprite, and no model of a sickle is attached.
- **The pages**: the Professions and Stores pages are two more sections on the Stats page's rail (`ui/enhanced/enhancedMenu.js`
  statsSections, `ui/professions/profPages.js`), shown online while the professions are the account's; a page gone (the switch,
  offline) is never drawn. The specialisation cards sit on the Professions page, a change armed and confirmed in place.
- **Gentle acts** is a setting on the Professions page (`uiPrefs` `gentleActs`, off): the player's own, never the
  online lane's (`systems/online/onlineLane.js` ONLINE_PLAYERS_OWN_PREFS).
- **The hover** (8's World Tooltips line) is **not built**: the prompt says what a patch holds and what it needs
  (the herbs or the Basket, taken, the rank, the Sickle, the Basket, the Stores' room, the day's count).
- **The pad and touch** (AUDIT 29, corrected: this line said they reach an act through Interact): the pad's A is the
  activate (Mouse0), not Interact, and a finger has no Interact, so a node's act is E's - the controls page's registry
  can bind Interact to a pad button - **FLAGGED**, with 8's tap on the node and the act's own on-screen buttons, not
  built.
- **Not here, named**: the held map's worked patches; an unbruised herb's Potent chance (PROF12 - the Stores keep no
  quality in PROF1).
- **Pinned**: `test/systems/foraging/prof1_law.test.js` (14), `test/net/prof1_service.test.js` (13), `test/systems/prof1_client.test.js` (15);
  `tools/mutants/prof1.json`, 58 mutants, every one dead. The done-when is `prof1_client`'s DONE WHEN: an herb
  harvested through the real Worker, withdrawn into the pack, minted as DFU's own plant and mixed by DFU's recipe law.

## 23. PROF2 - Mining and Quarrying, ores, ingots and the forge, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Go"** (PROF2 after PROF1). What the design above left open for PROF2, DECIDED here (the record's, at Mac's
instruction), and what was found (FACT):

- **What PROF2 is.** Mining's surface veins and Quarrying's boulders in the streaming world, the dungeon veins, the
  region signatures (4.7), the gems (4.6), smelting at a forge, the ores and ingots (610-630) and the stone (673-674)
  as items, the Prospector's compass, and the Court writs asking for metal and stone. **Not here, named**: the
  **Motherlodes** (section 6 - a relay room's socket check and the hub's warning; PROF2b) and **gate-touched ground**
  (4.7 - the gate's pixel is the client's to find, `src/net/gate/gateLaw.js`, and a receipt carries no pixel today, so
  three fighters cannot yet agree where it stood; PROF2b); Daedric smelting (BUILT since: DAEDRIC-SMELT, section 50 -
  the heart enters the Stores loose, the stone is the account's ember); the held map's marks; a vein's cracks.
- **The kingdoms are one home.** FACT: nothing in the tree maps a region to a kingdom but SEAT0 4.3's table.
  DECIDED: that table becomes `src/net/kingdomLaw.js` (the regions of Daggerfall, Wayrest and Sentinel, the Marches,
  the Free Lands), which nodeLaw reads for the signatures and the Marches and the seats' slices will read for theirs.
- **The veins' tables** are 4.1's, each metal DFU's own (MetalIngredients: Mercury 65, Tin 66, Brass 67, Lodestone
  68, Sulphur 69, Lead 70, Iron 71, Copper 72, Silver 73, Gold 74, Platinum 75 - FACT, `itemTemplatesData.js`) at 4.1's
  tier, the six new ores at theirs (Moonstone 4, Dwarven Scrap 4, Mithril 5, Adamantium 6, Ebony 6, Orichalcum 6). A
  vein's tier is drawn over the tiers its climate's table holds by section 6's weights renormalised (a Woodlands vein
  is Iron, Copper or Tin at 40 : 25 against Lodestone), held to tier 3 on a pixel not confirmed (UNWITNESSED-ORE,
  section 6 - it was 2, and the Mountain stood Iron alone), and its metal evenly
  among that tier's. "Deep veins" (4.1, 4.6) are the dungeon veins.
- **The signatures** (4.7): on a **confirmed** pixel of the kingdom, a signature stands BESIDE the climate's veins, in
  the slots after them (AUDIT 29: it took the first vein's place, so a Swamp's one vein was a crown's rare ore and a
  novice had no ore on witnessed ground there) - the
  Kingdom of Daggerfall's Moonstone **two** ("twice the usual rate"), Wayrest's Mithril, Sentinel's Ebony,
  the Orsinium Area's and the Wrothgarian Mountains' Orichalcum (found nowhere else), the Isle of Balfiera's
  Adamantium (the only open-world surface Adamantium). On a pixel not confirmed the slot is an ordinary vein - a
  signature is tier 4 to 6 and such a pixel's veins are worth tiers 1-3 (UNWITNESSED-ORE). The Marches keep their +25%.
- **Where a node stands** (section 6: "the nearest suitable anchor"). FACT: World of Daggerfall is forced on for the
  online lane (`src/systems/online/onlineLane.js`) and 209,436 of its 227,938 instances are `Rocks` layouts, 2,502
  `Mountains` (`03-World/World-Of-Daggerfall.md`), so every client of a room stands the same rock pieces. DECIDED: a
  **vein** stands at the foot of the rock-field piece nearest its law point (the piece's own box, on the side facing
  that point) where the pixel has one; else on the terrain's stone tile (tile 3, `terrainNature.js`) nearest its point
  within 24 tiles where nature could stand; else where nature stands at its point; else nowhere. A **boulder** is a
  rock-field piece itself - Quarrying works "a rock field's boulders" (5.2) - so a pixel with no rock field, or with
  no clear side left, stands fewer. ROCK-FOOT (FIELD BUGS 2026-10-01): a piece is carried as it stands out of the
  ground (`terrainNature.js` rockFootprint), never its whole mesh's box; a node takes the nearest piece with a foot clear
  of every piece, the side facing its point first, then its others; the boulders claim before the veins. ROCK-SHARE: a
  piece holds a node on each of its sides, every node at the field NODE_SPACING_M (6 m) from the next (it held one
  node, and a field's few open sides ran out at two or three). The node's picture is its material's own
  item flat (TEXTURE.254, the metal's own, a new ore Lodestone's; a boulder's loose stone Lodestone's), a small
  cluster at the piece's foot, as PROF1's patches are the herb's own flat (law 6). VEIN-WASH
  (`01-Overview/bugs/Field-Bugs-2026-10-11d.md`): an ore on a picture another ore shares wears its own wash
  (`scenes/mineHost.js` ORE_WASH - 4.8's "tinted per ore"); Lead keeps DFU's colours. VEIN-HUE
  (`01-Overview/bugs/Field-Bugs-2026-10-12b.md`): every wash is its hue at full spread, Lodestone wears one of its own (the
  boulder's loose stone is its lump, unwashed), and a washed vein's wash is its colour (`ORE_DYE`, `uBatchDye`: the
  lit flat's brightness in the wash's hue), not a multiply over the picture's own.
- **The dungeon veins** (section 6): `1 + hash % 4` a dungeon a UTC day, a dungeon named by DFU's own identity
  (`MapTableData.MapId & 0xfffff`, `mapsFile.js`), the id `dvein:<id>:<day>:<slot>`. Their table: Silver 3, Gold 4,
  Dwarven Scrap 4, Platinum 5, Adamantium 6, and Moonstone 4 in a Woodlands or HauntedWoodlands dungeon (4.1's deep
  veins); tiers 3-6 by the weights. They stand on the dungeon's own walls: from one of its foe markers (the layout's
  list, the same on every client) a ray at chest height along the slot's bearing through the dungeon's collider to the
  first near-vertical face within 12 m, the vein a third of a metre off it (at its foot on the floor, 0.75 m out, since MINE-PERKS, section 43) - the elite foes' clearance rays' precedent
  (`dungeonContext.js`). A dungeon a client's hash made (`spawned`) grows none. **The witnessed dungeon** (SEAT0 3.2's
  law, a second kind): a harvest carries the dungeon's climate and region, three accounts a week registered agreeing
  confirm it; a dungeon not confirmed draws its whole deep table, its Diamond too, and waits on the witnesses for its
  climate's Moonstone alone (DEEP-OPEN, section 50 - it was worth its least, tier 3 Silver and no gem) - and, its id the
  client's word, an account works four veins a day in such dungeons (AUDIT 29: `DEEP_UNCONFIRMED_PER_DAY`; invented
  ids had mined Silver at any hour). Dungeon veins keep no hours, and
  Foraging's inside, settlement, daylight and sea checks are not asked there (5.1); the foe and the load are.
- **The act** (5.2): the Pick-Axe drawn as DFU's Warhammer (template 126), its strike DFU's own StrikeDown frames.
  Strikes 4 (tiers 1-2), 5 (3-4), 7 (5-6); a boulder is tier 1 (Rough Stone's). Five points on the node's face in a
  box around it (their bearings from its centre); one glints for **1.2 s** (**2.0 s** at Master) x the Pick-Axe's
  band ((INT + AGI) / 2, FORAGE0 14.4), then moves - after a strike too. Attack strikes (one a 0.45 s swing); with the
  crosshair within **2.5 degrees** of the glinting point it counts **double**. A **clean finish** is every strike on
  the glint. FACT: the Stores keep no quality (section 22), so the finish's "one quality step" waits for PROF3's
  quality; here a clean finish is the clean act (+50% XP), and on a boulder, or always for a Stonebreaker (the Surveyor since MINE-PERKS, section 43), it yields
  **Cut Stone** at the mason's 2 : 1 (the cut done at the rock; Quarryman's 1 : 1 is the bench's). A **gem**: 3% a
  strike on the glint (Prospector x1.1), by the node's climate (4.6: Amber, Jade, Turquoise, Malachite, one of Ruby,
  Sapphire, Emerald in the Mountain; a Diamond from a dungeon vein), on a confirmed pixel, or in any dungeon (DEEP-OPEN,
  section 50: a dungeon's gem is no climate's claim) - the service rolls each, never past the strikes a finish needs. Gentle acts: every strike plain, no clean act, no gem.
- **The yields** (section 6's order): a vein 2-3, a boulder 3-5 Rough Stone; Deep Delver x1.5 (x2 since MINE-PERKS, section 43) on a dungeon vein; a
  march's +25% on a confirmed surface pixel; the Cut Stone cut; the fraction a chance. A gem is one, beside.
- **A gem's tier** (the Stores' and a writ's reference): DECIDED by its DFU price's band - to 10 gold tier 2 (Jade), to
  50 tier 3 (Malachite, Turquoise), to 100 tier 4 (Amber), to 250 tier 5 (Ruby), past it tier 6 (Sapphire, Emerald,
  Diamond).
- **The materials and their items.** A DFU metal withdraws as DFU's own MetalIngredients item, a gem as DFU's own gem;
  the new ores (610-615), ingots (620-630) and stone (673 Rough, 674 Cut) are registered custom templates (as the Sigil
  Stone 570 is, `gateSpoils.js`), their pictures DFU's own (an ore Lodestone's, 254/66; an ingot Iron's, 254/63; stone
  Lodestone's) recoloured by DFU's own law - FACT, GetItemImage's ChangeDye with the metal's DyeColor over the
  WeaponsAndArmor swatch (`systems/item/itemDye.js`, ItemHelper.cs:473-476) is how DFU colours an Ebony blade apart from an
  Iron one - an ingot its metal's dye, an ore its metal's; stone is Lodestone's lump as it is. Brass (DFU 67) is
  smelted, tier 2.
- **Smelting** (4.1): at a forge, no act - 2 of a raw metal make 1 ingot (Iron, Silver, and the six ores); Brass is 1
  Copper and 1 Tin; Steel is 1 Iron Ingot and 1 Charcoal (the recipe stands; Charcoal comes with Logging, PROF4).
  Smithing XP 10 x the product's tier a unit, under **the crafter's limit** (3.2 - a third craft past Journeyman stops
  at rank 50). An ingot is **own** only when every unit that made it was (bought units are spent first, section 7).
  Up to 100 a smelt. **The forge**: a Weaponsmith's or an Armorer's (50 gold a smelt, the use fee, paid from the purse)
  or a home's **forge** station - HOME-STATIONS grows a fourth craft (`DECOR_STATIONS`, its licence 50,000 gold as the
  alchemy station's - offered, sold and worked only where the Stores page is: online, the professions the account's,
  AUDIT 29; on either skin since CLASSIC-PAGES). The Forge is a section of the Stores page (`ui/professions/profPages.js`, the
  Enhanced pause menu; CLASSIC-PAGES, 2026-09-30: a door pressed for a professions page - the Professions key, the down arrow, or
  a station - opens that page on the classic skin too, `ui/pauseDoor.js` openPauseFlow), live while
  the player stands inside a Weaponsmith's or an Armorer's (`scenes/worldModes.js` forgeHere; the fee paid on the
  first answer the press hears, a `repeat` included - AUDIT 29 C3; AUDIT 30: "never on a repeat" stood here since) or
  their own home with a forge station, whose press opens the pause menu at
  the Stores page. FACT: the service cannot see the forge (as it cannot see the board, section 22): the inputs are the
  Stores' and their units are the bound.
- **The Court writs** ask metal and stone too: a witnessed pixel's vein metals (a confirmed pixel's all, an unconfirmed
  one's tiers 1-3 since UNWITNESSED-ORE - what its veins stand), its region's signature ore on a confirmed pixel of that kingdom, and Rough Stone where its climate
  has boulders. Never an ingot, Cut Stone or a gem (smelted, cut or found, not the ground's). A metal's or stone's writ
  XP is Mining's.
- **The Prospector** (3.3): the veins stood within 200 m (500 since MINE-PERKS, section 43; a dungeon's still 200) are marked on the compass, both skins, beside the party's
  marks (`ui/hud/hud.js`, `ui/enhanced/enhancedHud.js`). The held map's marks are not built (as PROF1's patches'). NODE-MARKS
  (section 31) since: every node is marked within 150 m, and the Prospector's veins from 200 m - the mine kind's own
  `mark` (`PROSPECTOR_MARKS`).
- **One gathering host.** FACT: the streaming world's Herbalism was one host (`scenes/herbHost.js`), and every
  gathering profession needs the same shell - a pixel's nodes stood, the nearest target, one prompt, one act, the book.
  DECIDED: the shell is `scenes/gatherHost.js`, each profession a kind in it (Herbalism's patches and Mining's veins and
  boulders now; Logging's trees, Hunting's bodies and - PROF8, section 30 - Fishing's water since), one prompt and one act at a time.

As built:

- **Behind PROF1's switch.** `PROFESSIONS_OPEN`, at `dev`. The service is `acct20`; the tables are `0028_mining.sql`
  (`node_harvests` rebuilt for the kinds `ore` and `stone` and its `gem`; `world_witness` rebuilt for the kind
  `dungeon`; `prof_smelts`); the route `/v1/prof/smelt`. A harvest's decision is still one INSERT - ~~the day's cap~~ (CAP-OFF, 2026-10-07: none), the
  node untaken, the Stores' room - and a gem rides in it, nulled there when the gem's own Stores are full (the ore is
  still given). A smelt's decision is one INSERT too - every input held, the product's room, its bought units read
  before a unit moves - and the spends, the products and the Smithing XP follow it in the same batch.
- **The four hosts** (17.1). **The streaming world** stands every kind through `scenes/gatherHost.js`: Herbalism is
  `herbKind` (`scenes/herbHost.js`), Mining `mineKind` (`scenes/mineHost.js`). A built pixel carries its rock pieces
  (`rocks`: the boxes of World of Daggerfall's placements named `Rocks` or `Mountains` that stood - after the road's
  clearance - `world/worldOfDaggerfall/worldOfDaggerfall.js` picks now carry their name). **The fixed city** - **FLAGGED by name**, as
  PROF1's. **Building interiors**: the forge (above). **Dungeons**: `scenes/dungeonContext.js` hands the host its
  identity (`MapId & 0xfffff`, none for a spawned dungeon), its wall ray (`veinWall`: from a foe marker at chest
  height, a near-vertical face within 12 m) and its own flats' doors; the mode machine tells the host a dungeon was
  entered (after the flip and its lock) and left (the veins dropped while the dungeon still stands, beside the quest
  foes' hand-over); E reaches a vein before the exit's press; the dungeon rig draws the act's tool and swings nothing
  while an act plays.
- **The tool in the hand**: the Pick-Axe as DFU's Warhammer (template 126), idle between strikes and StrikeDown's
  frames over each 0.45 s swing. **The Morrowind lane keeps its stance - FLAGGED**, as PROF1's Sickle.
- **Esc** ends an act in every mode now: PROF1's cancel sat under the exterior gate, so an act underground could not
  be let go; it sits above the mode gate (a fix found by PROF2's own dungeon).
- **A harvest asked twice** (FOUND, fixed): a harvest is kept before it is asked, and the book's pump - which asks kept
  harvests again - could ask one whose first ask was still on the wire; the service answered both as one (the id), but
  the answer was said twice. The book now keeps the asks on the wire (`net/profBook.js` `sending`) and the pump skips
  them.
- **A PROF1 pin that proved nothing half the time** (FOUND, fixed): the Stores-overflow pin's harvest rolled 1 to 3, and
  a roll of 1 fits one unit of room with or without the cut - its mutant survived at random. The pin steers the
  service's dice to their top.
- **Pinned**: `test/net/prof2_law.test.js` (11), `test/net/prof2_service.test.js` (9), `test/net/prof2_client.test.js` (14);
  `tools/mutants/prof2.json`, 40 mutants, every one dead. The done-when is `prof2_client`'s DONE WHEN: a confirmed
  Wayrest pixel's first vein stood at its rock piece is Mithril, mined through the real Worker, smelted at a forge into
  a Mithril Ingot and withdrawn as its registered template.
- **FIELD BUGS 2026-10-01 part four** ("minig is broken doesnt work"; Mac: "Also mining, the life skill, is broken";
  `01-Overview/bugs/Field-Bugs-2026-10-01.md`): an act's strike is either button (ACT-CLICK - mid-act a left click had been
  the act's and nothing else) and a finger's or a pad's Attack or a tap (ACT-TOUCH, `scenes/gatherHost.js` strike - the
  hooks had refused every such press mid-act, so no vein was ever mined on a phone or a pad); a node is found anywhere up
  its upright, base to aim point - a boulder by its stones - and of the nodes in the cone the first SEEN nearest the look
  is the target (NODE-AIM); a vein's stone tile is never inside a rock piece (VEIN-CLEAR). The meter names the press.
  And, asked (Mac: "Hold it at nodes"), a node under the look or an act playing holds the free climb's walk-in start
  (CLIMB-NODE, `player/motor.js` _freeStart) - walking into a vein's rock to reach it had climbed the rock.

## 24. PROF3 - Smithing: the anvil, quality and provenance, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Lets keep moving"** (PROF3 after the merge of main). What the design above left open for PROF3, DECIDED here
(the record's, at Mac's instruction - "make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF3 is.** 9.3's Smithing recipes - the weapons, the plate, the shields, the chain, Foraging's tools and the
  Repair Kit - made at **the anvil**, each with **the heat** (9.4) or a quick craft; 9.2's **quality**, rolled by the
  service; a **provenance id** and a **signed product record** for every piece (9.1); the recipe law
  (`src/net/recipeLaw.js`, section 14's name for it). Not here, named: found and writ-only recipes (the Recipe Scroll
  695 is PROF6b's - AUDIT 31 R8: PROF6 gave it its own slice, 28 - and the Motherlode's, PROF2b), a seat's Forge step (SEAT2b - AUDIT-SEATS: it said SEAT1b), listing and trading a provenance
  item (PROF5, and TRADE1's hand-over, section 18), Disenchanting and enchanting a provenance item (PROF12).
- **The anvil is the forge's other half.** FACT: "the forge stands since PROF2" (section 15) - a Weaponsmith's or an
  Armorer's, or a home's forge station, the Stores page's Forge section (`ui/professions/profPages.js`). DECIDED: the anvil stands
  wherever the forge does - smelting is the forge's, smithing the anvil's - as its own section of the Stores page (named,
  not pictured - as built, below). A smith's anvil asks the forge's use fee (50 gold a craft, the purse's); a home's
  asks none. The fee rides the kept craft (`net/profBook.js` craft's `fee`) and is paid by the tab that mints its
  pieces, on whichever answer lets the craft go - the press's or a later settle's, a repeat included (`scenes/world.js`
  profMintCraft; AUDIT 30 R9: this line said the service's answer and never a repeat).
- **The fittings the professions do not yet yield** (FOUND): 9.3 asks Cured Leather of every blade from a Broadsword up
  and of every piece of plate, Oak Plank of the axes, hammers, shields and the Spade, Pine Plank of the tools, and
  Charcoal of Steel - Hunting (PROF7) and Logging (PROF4) come after this slice, so only a dagger or a shortsword could
  be made, and the done-when's Mithril Longsword not at all. DECIDED: **the smith's stock** - the forge's own counter
  (4.5's precedent: a counter's goods, **bought**, never own, a Marks sink, never purse gold - law 3) sells the four into
  the Stores at a smith's forge: **Cured Leather 4 Marks, Oak Plank 4, Pine Plank 2, Charcoal 2** (twice each one's
  Marks value - Cured Leather tier 2, the cure of 4.4's tier 1-3 hides; Oak 2; Pine and Charcoal 1 - so a gatherer's own
  will always undersell it once the professions come), up to 100 a purchase. So Steel is smelted now, and chain made.
  Their pack forms wait for their professions: the Stores hold them and the anvil and the forge spend them; the Stores
  page does not withdraw them until PROF4 and PROF7 register their templates (FACT: none of 645, 646, 652, 665 is a
  template yet - PROF4 registered 645, 646 and 652, so the planks and Charcoal withdraw now and Cured Leather alone
  waits, AUDIT 30 R3; AUDIT 32 R5: PROF7 registered 665 and the cloth's 668-671 - the whole stock withdraws, the gate
  kept for a material to come). The service cannot see the forge (FACT, section 23): it sells wherever it is asked, and the
  client asks only at a smith's - a lie buys the same goods at the same price.
- **The recipes** (9.3), each a product at a metal: the weapons (Dagger, Tanto; Shortsword, Wakizashi; Broadsword,
  Saber, Longsword, Katana, Mace, Flail; Warhammer, Battle Axe, War Axe; Claymore, Dai-katana - DFU's templates 113-128
  but the Staff, a carpenter's), the plate (Cuirass, Greaves, Helm, Left and Right Pauldron, Gauntlets, Boots) and the
  shields (Buckler, Round, Kite, Tower - DFU 102-112), at the ingot's material: Iron, Steel, Silver, Elven (Moonstone),
  Dwarven, Mithril, Adamantium, Ebony, Orcish (Orichalcum) and Daedric; Warforged Steel counts as Ebony with a step
  (4.7). The chain pieces (the plate's seven, not the shields - DFU has no chain shield): the plate piece's ingots x
  0.75 rounded up, Steel only, nothing else. Foraging's tools at Iron (FORAGE0 14.7): the Wood-Axe and the Pick-Axe 2
  Iron Ingot and 1 Pine Plank, the Sickle 1 and 1, at rank 0; the Spade 2 Iron Ingot and 1 Oak Plank at rank 10 (the
  Skinning Knife is PROF7's, its template with it). The Repair Kit (692) at every metal but the Warforged
  (`recipeLaw.js` KIT_INGOTS; AUDIT 30 R11: this line said every metal): 1 of the metal's ingot and 1 Cured Leather. A
  recipe's rank is its material's tier's (3.2: 0, 10, 25, 40, 55, 70, 90); every recipe unlocks by rank in PROF3 - the
  found ones come with the writs.
- **The quality** (9.2), rolled by the service's CSPRNG on the margin (the smith's rank minus the recipe's), then a
  step each, at most, for: a clean act (the honest bound: one step, 5.1); the family's specialisation (Weaponsmith the
  weapons; Armoursmith the plate, the chain and the shields); a Warforged ingot among the inputs. Nothing passes
  Masterwork. Masterwright's 5 points of Masterwork come off the row's lowest quality. A tool's quality is its life (FORAGE0
  14.7: Crude 37 uses, Standard 50, Fine 57, Superior 65, Masterwork 65 and the maker's mark; no Loot Rarity roll). A
  Repair Kit has no quality (DECIDED: it is measured by its work, a quarter of an item's condition, once) - and a
  Quartermaster's kit is two (3.3).
- **The piece** (9.2): DFU's own item, minted by DFU's own law (`combat/enemyEquipment.js` weaponOfMaterial,
  armorOfMaterial - its material, its value, its condition) and then the quality on it: Crude condition x0.75; Fine
  x1.15 and weight x0.95; Superior x1.30, x0.90 and one Loot Rarity **Magic** roll; Masterwork Superior's and one
  **Rare** roll and the maker's mark in its name ("Silverthorn's Mithril Longsword" - the Rare's powers stand, listed in
  its info; the mark is its name). The rolls are the record's seed's (`seededRng`, as a gate's and a raid's spoils are),
  so the piece is the record's on every client. It carries `quality`, `provenance` and `maker` (declared item fields,
  riding the save as Loot Rarity's `rarity` does - section 18).
- **The product record** (9.1): `p1.<claims>.<signature>` - the provenance id (16 hex digits, the service's CSPRNG,
  unique across the server), the account, the character, the recipe, the quality, the maker and the seed, and `a: 1`
  where the piece bears its maker's mark (a Masterwork, or a Master Joiner's furniture - AUDIT 30, so the name is the
  service's word too) - signed with the account service's identity key (a raid receipt's shape, `net/raid/raidReceipt.js`:
  the version inside the signed bytes, claim fields disjoint from every other signed shape's). The maker's name is
  `recipeLaw.js` makerName's (controls and lone surrogates dropped, 32 characters, no pair split), and a record longer
  than its reader's 512 is never minted (AUDIT 30). The service keeps it in `products` (section 14: provenance,
  owner, template, material, quality, maker, made at) and the piece carries only its id - a signature is longer than the
  trade wire's string bound (FACT, `systems/loot/loot.js` validLootItem: 128).
- **The heat** (9.4): at the anvil, the ingot's glow rises and falls; strike three times while it is in the band. The
  band's width is Smithing's attribute pair, (STR + AGI) / 2, on Foraging's four bands (5.1). Space, Enter or a click
  strikes; Esc lets the act go with nothing spent. Three strikes in the band are a clean act (one step); fewer are a
  plain craft. **Quick craft** skips the act; **Gentle acts** crafts plain; under reduced motion the glow is a still bar
  with the heat's marker.
- **The XP** (3.2): 20 x the recipe's tier a craft, +500 the first time the character makes the recipe, a quarter for a
  recipe more than two tiers below the rank's top, under the crafter's limit; answered as credited (AUDIT 29).
- **Quartermaster's ingots** (FOUND): 3.3's Quartermaster doubles ingots and Repair Kits; PROF2 shipped the smelt with
  the choice offered and the doubling unbuilt. A Quartermaster's smelt of an ingot yields two a unit now (Brass is a
  metal, not an ingot); the XP stays the smelt's.

As built:

- **Behind PROF1's switch.** `PROFESSIONS_OPEN`, at `dev`; the smith's stock behind MARKS1's too (`MARKS_OPEN`). The
  service is `acct23`; the tables are `0030_smithing.sql` (`prof_crafts`, a craft's row - its quality, its pieces' ids,
  its seed, the XP it credited and whether it was the character's first of the recipe; `products`, every piece's
  provenance, owner, maker, template, material, quality, seed and signed record; `prof_stock`, a purchase); the routes
  `/v1/prof/craft` and `/v1/prof/stock`. A craft's decision is one INSERT - every input held, the XP under the crafter's
  limit with the first craft's 500 read in the same statement - and the spends, the pieces and the track follow it in
  the batch, keyed on its nonce; a purchase's is one INSERT too (the Marks held, the Stores' room), its `stock` line in
  the one ledger (a plain INSERT under `<rid>:stock`, AUDIT 30) and its bought units keyed the same way. The Stores
  refuse to withdraw what has no pack form (`prof-no-pack-form`) - of the stock, Cured Leather alone since PROF4
  registered the planks' and Charcoal's templates (AUDIT 30 R3: this line said all of it), and none since PROF7
  registered Cured Leather's (AUDIT 32 R5).
- **The law** is `src/net/recipeLaw.js` (the recipes, 307 of them - 308 since PROF7's Skinning Knife, AUDIT 32 R7; the quality's rows, steps and effects; the XP; the
  heat; the maker's name; a piece's lines) and `src/net/productRecord.js` (`p1`, minted by the service, read by the
  client, verified with the identity key); the smith's stock is `professionLaw.js`'s (SMITH_STOCK, withdrawable).
- **The piece** is `src/systems/smithItems.js`: DFU's mint, then the quality (the Loot Rarity roll off the record's seed,
  `wind.js` seededRng - the same generator the gate's and the raid's spoils roll with); `quality`, `provenance`, `maker`
  and a kit's `kitMetal` are declared item fields (`itemFields.js`). A Masterwork's long name is its mark before its
  material (`itemInfo.js` itemNameParts); a crafted piece's tooltip and card open with its quality and "Made by" line
  (`recipeLaw.js` pieceLines, `ui/item/itemScroller.js`, `ui/enhanced/enhancedInventory.js`).
- **The book** (`net/profBook.js`) KEEPS a craft before it asks it - its pieces are the save's once the service answers,
  so a lost answer is asked again (the same id; the service's row answers the same pieces) and the pieces are minted on
  the answer, once: the tab that lets the craft go mints it (AUDIT 29 C5's law), and the host mints a piece only when the
  pack holds no piece of its provenance (`scenes/world.js` profMintCraft). A kept craft is settled where a kept
  withdrawal is (the Stores page opened, the book's settle). One craft at a time.
- **The anvil** is a section of the Stores page under the Forge (`ui/professions/profPages.js` drawAnvil): the families (Weapons,
  Armour, Tools, Repair Kits) and the metals, each recipe with "can make now", "wants its inputs" or the rank it asks;
  the chosen recipe's inputs as the Stores hold them, and at a smith's forge a "Buy N from the smith" beside a short
  fitting; the odds at the smith's margin; **Craft** (the heat, unless Gentle acts) and **Quick craft**. The heat is a
  bar the glow's marker runs along with the band on it and the three strikes under it; Space, Enter or Strike strikes;
  "Let it cool" lets it go; the page shut under it lets it go too. While it is struck nothing else is picked - the
  families, the metals, the recipes and the Heartwood stand - and the heat makes the recipe it began on (AUDIT 30). A
  smith's fee the purse cannot meet is not offered: "The smith asks 50 gold a craft; you carry N." The piece's picture
  of DFU's anvil (INVE's) is not drawn - FACT: the Stores page is the Enhanced menu's DOM, and DFU's container images
  are classic-window art (`ui/targetIconPanel.js`), so the section is named, not pictured.
- **The Repair Kit** (692) is registered with the ores and ingots (`systems/professions/profTemplates.js`), DFU's Warhammer's world
  picture dyed by its metal. DECIDED: **used from the pack, it mends the most-worn weapon or armour of its metal** (the
  lowest share of its condition left, an equipped piece first on a tie) by a quarter of its condition, never past three
  quarters (KIT-CEILING, 2026-10-01 - whole until then; `06-Systems/Economy-Arc.md`), and is spent; with nothing of its
  metal to mend it is kept and says so ("Nothing of Mithril here wants mending"). A Steel kit mends the chain too. No
  picker was the decision here (DFU's use is one press); MEND-AIM put one over it - the worn pieces first, and "Mend
  which?" when there is a choice. Offline as online - a kit is the pack's (`scenes/shared.js` installs its use in every
  host).
- **Pinned**: `test/net/prof3_law.test.js` (6), `test/net/prof3_service.test.js` (5), `test/systems/prof3_client.test.js` (7);
  `tools/mutants/prof3.json`, 59 mutants, every one dead (AUDIT 32 R6: 57 dead and two recorded equivalent since PROF7 -
  the stock's "never withdrawn" gate, law and service, has nothing left to refuse). The done-when is `prof3_client`'s DONE WHEN: a Mithril
  Longsword's Cured Leather bought from the smith for Marks and the sword made at the anvil with a clean heat through the
  real Worker, its piece minted from the answer - DFU's template 120 at Mithril (5), its damage DFU's, its condition its
  quality's, its provenance the signed record's.

## 25. PROF4 - Logging, Carpentry and the furniture, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Continue"** (PROF4 after PROF3). What the design above left open for PROF4, DECIDED here (the record's, at
Mac's instruction - "make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF4 is.** Logging's trees in the streaming world with their act (the ring, the fall, the stump); the logs,
  planks, Charcoal, Resin and Heartwood (4.2) as materials and as items; sawing at a workbench and burning at a forge;
  Carpentry's recipes at **the workbench** (9.3) with its act (**the plane**, 9.4); the furniture into DECOR, where the
  owner sets it down (the done-when); the Ram Kit named; wood in the Court writs. Not here, named: the Harpy-feathered
  arrows (Hunting's feathers, PROF7), the Ram Kit's making and use (its Bear Hides are Hunting's, its siege SEAT2's),
  Siegewright (SEAT2), the held map's marks, "Craft x N" (9.3's third button - neither station has it yet).
- **FOUND - PROF3 left Smithing unpractised on the Professions page.** The page's list of practised professions
  (`ui/professions/profPages.js` PRACTISED) held Herbalism and Mining alone, so Smithing's four specialisation cards stood locked
  and its pane still said "the rest of the craft comes later" - the service took the choice (`chooseSpec` asks no such
  list); the page never offered it. Smithing, Logging and Carpentry are practised now, each with its unlocks by tier.
- **The woods** (4.2), each climate's: Woodlands Oak and Cherry; MountainWoods Pine and Oak; Mountain Pine; Swamp Oak;
  Subtropical Cherry and Teak; Rainforest Teak and Mahogany, and Ironwood one tree in 20; HauntedWoodlands Ghostwood one
  tree in 20 - FOUND: 4.2 names no other wood there. DECIDED: a haunted wood is a woodland under its curse - its other
  nineteen trees are Woodlands' Oak and Cherry. The Desert stands none (section 6's count). A tree's tier is drawn over
  the tiers its climate's woods hold by section 6's weights renormalised, the wood evenly among that tier's; the rare
  wood's one in twenty is its own roll first, on a confirmed pixel only. **A pixel not confirmed is held to tiers 1-2**
  (section 6) - so an unconfirmed Rainforest or Subtropical pixel stands no tree at all until three witnesses vouch for
  it (a claimed Rainforest anywhere would otherwise be Teak on anyone's word); its herbs and veins bring the witnesses.
  **PINE-SHARE** (2026-09-30, Mac: "2 in 5 trees Pine"; found tracing GATHER-SAID): Pine, the one tier-1 wood, stood only
  in the Mountain and Mountain Woods, so a Novice logger in the other five forests could never chop - every herb and
  vein table holds a tier 1, the woods alone did not. A forest whose woods hold no tier 1 now stands `PINE_SHARE` (2 in
  5, section 6's tier-1 weight) of its trees as Pine, on any ground, rolled after the rare wood (`nodeLaw.js` tree,
  `PINE_WOOD`); an unconfirmed Rainforest or Subtropical pixel stands its Pine and nothing past it - still no Teak on
  anyone's word. The Court's writ table names that Pine. The Mountain and Mountain Woods are untouched.
- **Where a tree stands** (section 6: "a tree flat for a tree"). FACT: the streaming world lays out Daggerfall's own
  nature flats per pixel from a seeded roll (`world/terrain/terrainNature.js` layoutNature - every client the same forest), one
  merged billboard batch per (archive, record) (`scenes/world.js`), and nothing kept which flat was a tree. FACT: World
  of Daggerfall names the nature records (`vendor/world-of-daggerfall/Scripts/LocationHelper.cs` billboards: 504's trees
  12-18, 25 and 30, its trunks 19-20, its logs 31; each climate archive's own), and a winter archive is its summer
  archive's records under snow (`world/climateSwaps.js`). DECIDED: a built pixel keeps its **tree flats** (the records
  that table names Tree, by the climate's summer archive), and a tree node stands AT the tree flat nearest its law point,
  one node a flat - **the player chops a tree of the forest**, not a tree added to it. A felled tree's own flat is sunk
  below the ground in its batch (the batch rewritten in place, `render/renderer.js` moveBillboardBatch) for the rest of
  the character's UTC day; on a pixel rebuilt, the node is gone and sunk again.
- **The act** (5.2): the Wood-Axe drawn as DFU's War Axe (template 128), its chop StrikeDownRight's frames (FORAGE0
  14.1). Chops 5 (tiers 1-2), 6 (3-4), 8 (5-6), Lumberjack two fewer, three at least (the prompt counts them so,
  AUDIT 30). **The ring**: a circle shrinks from three times the notch's radius onto it over **0.9 s** and on past it; a
  chop while it stands within the band - **12%** of the notch's radius at Novice to **20%** at Master, x the Wood-Axe's
  band ((INT + STR) / 2, Foraging's pair, FORAGE0 14.4) - is a **Clean Cut**, worth two chops. One chop a 0.45 s swing;
  the ring starts again after each. A **clean act** is every chop a Clean Cut. The tree creaks at half its chops. Gentle
  acts: every chop plain.
- **The fall**: on the service's answer the tree tips away from the player over **1.5 s** (the flat's own picture on a
  one-flat batch, leaned about its root by a per-batch tip the billboard shader gains - `uTip`, 0 for every other
  batch) and is gone once it lies flat - it never fades (AUDIT 30 R10: this line said it faded); its **stump** stands -
  the climate archive's Tree Trunk (record 19) where World of Daggerfall's table names one (504, 506, 508, 510), else
  nothing. **The logs at its foot** are DFU's own Logs flat (record 31) where the archive has one (504, 508), gone when
  the player walks over them - a sight, not a second door: the logs were the Stores' the moment the service answered
  (law 3). The answer is waited for, as every node greys only when the service confirms (section 19).
- **The yield** (section 6): a tree 2-4 logs, a march's +25%, the fraction a chance; **Resin** one tree in four (tier
  1, the service's dice, any ground); **Heartwood** 2% a Clean Cut (Forester x2), one at most, on confirmed ground only
  (a find, as a gem is). The act moves no logs - clean gives fewer chops, the Heartwood chance and the clean act's +50%
  XP. The service bounds the report: the Clean Cuts at most the finish's (every chop clean), a clean act only with every
  chop clean. The harvest row's second find is a new column (`node_harvests.extra` - the Resin); the Heartwood rides the
  gem's (a Clean Cut's find, as a glint's).
- **Heartwood** (4.2): FOUND - 4.8 gives it one template (654), so it is one material, not a tier-up plank of each wood.
  DECIDED: tier 4 (a rare find worth a Teak plank's price); in any recipe that asks a plank and takes a quality - a
  carpenter's or a smith's, never the arrows (`recipeLaw.js` takesHeartwood; AUDIT 30 R12) - one Heartwood may stand
  in for one plank, and it is 9.2's "Heartwood or a Warforged ingot" step: one step, never two with a Warforged ingot.
- **Sawing and burning** (4.2): no act, up to 100 logs a press, at no XP (DECIDED: a log's XP was its fall's; the forge's
  smelt pays Smithing because Smithing has no gathering of its own, and Logging does). A log saws to **2 planks** of its
  wood at a workbench (Timberwright 3); a log burns to **1 Charcoal** at a forge (Charcoal Burner 2) - the fire is the
  forge's, and Steel's Charcoal is wanted there. They ride the smelt's route and decision (`/v1/prof/smelt`, one table,
  `prof_smelts`), each recipe naming its station and the specialisation that multiplies it (a Quartermaster's ingots
  moved into the same rule).
- **The workbench** (9.3: "Carpentry (a workbench)"): FACT: DFU's towns hold Furniture Stores (building type 7) whose
  shelves sell DFU's furniture (`systems/shopStock.js`, DECOR2b's furnisher). DECIDED: a Furniture Store's workbench,
  open for trade, for **50 gold** a craft or a saw (the forge's fee - a craft's riding the kept craft and paid by the
  tab that mints it, as the anvil's is, section 24, AUDIT 30 R9; a saw's on its first answer, as a smelt's), or a
  home's **workbench** station - HOME-STATIONS'
  fifth, its licence 50,000 gold as the forge's, offered only where the Stores page is. The Workbench is a section of the
  Stores page, live where it stands; its press at home opens the page, as the forge's does.
- **Carpentry's recipes** (9.3), each at its wood (the recipe's tier and rank its wood's): the **Staff** (DFU 115) 3
  planks; the **Short Bow** (129) 3 planks and 1 Resin; the **Long Bow** (130) 4 planks and 1 Resin - a staff's or bow's
  material is its wood's tier's (9.3: "the bow's or staff's material step is its wood's tier"): Pine Iron, Oak Steel,
  Cherry Silver, Teak Elven, Mahogany Mithril, Ironwood Adamantium, Ghostwood Ebony (DECIDED - the two tier-6 woods
  split between the tier's metals, the hard wood the hard metal, the dark wood the dark one). **Arrows**, twenty: 1 Pine
  Plank, 1 Iron Ingot and 4 Twigs - DFU's Twigs is a plant of both lands (both plant groups, `professionLaw.js`), so the
  Stores keep it twice and the recipe is two, the northern Twigs' and the southern's, as the Stores name them. **The
  furniture**, DFU's own templates in their own wood: the Large Tables (221-224) 6 planks, the Small Tables (225-228) 3,
  the Chairs (229-232) 2, in Oak, Cherry, Mahogany and Teak; the beds 8 planks and 2 Linen - FOUND: DFU's four beds name
  no wood; DECIDED: each is the wood of its place in DFU's own rarity column (Plain Single 1 Pine, Plain Double 2 Oak,
  Fancy Single 3 Cherry, Fancy Double 4 Teak). **The Basket** (Foraging's 1607, FORAGE0 14.7) 2 Pine Planks. **The Ram
  Kit** (690, rank 60): 40 Oak Planks, 20 Iron Ingots, 4 Bear Hides - named on the workbench and never made in PROF4:
  its hides are Hunting's (PROF7) and its use the siege's (SEAT2); the service refuses it (`prof-later`).
- **Linen** (4.5) is never gathered, and a bed asks two. FOUND: the Weavers' counter is the Market tab's (PROF5).
  DECIDED: until it stands, **the furnisher's stock** - the Furniture Store's counter, the smith's stock's precedent
  (section 24): a counter's goods, bought, for Marks burnt - sells Linen Bolt at 4.5's **2 Marks**. Its pack form waits
  for Outfitting, as Cured Leather's for Hunting (AUDIT 32 R5: both came with PROF7 - Linen and Cured Leather withdraw).
- **The quality** (9.2) on Carpentry's pieces: the staff and the bows as the smith's weapons (condition, weight, a
  Superior's Magic and a Masterwork's Rare roll, the mark); **arrows take none** - FACT: DFU mints an arrow stack at
  condition 0 (`combat/enemyEquipment.js` createWeapon's arrow arm) and a quiver is one stack, so a quality has nothing
  to act on and a mark on one arrow would split the quiver; the arrows carry no provenance either (the service keeps its
  row), and Twigs' "one step lower" waits with the feathers (AUDIT 32 R7: settled by PROF7, 29 - arrows take no quality,
  so both fletchings make the same quiver). **Furniture**: its quality is its worth - the condition's
  multiplier on its value - and never a Loot Rarity roll (DFU enchants no furniture); a Masterwork carries the maker's
  mark, and every piece a **Master Joiner** makes does (3.3). The steps: the clean plane; **Bowyer** the bows (9.3's "bows
  and arrows", the arrows taking none); Heartwood. **Joiner**: furniture at half the planks, rounded up.
- **The plane** (9.4: "a steady drag along the grain, deviation scored as the trace is"): at the workbench the grain
  runs across a board, a gentle curve its own each act; the player presses at its head and drags to its foot. The score
  is the mean deviation from the grain against a tolerance - **18%** of the board's half-height, x Carpentry's band
  ((AGI + WIL) / 2 - DECIDED: a steady hand, Foraging's four bands) and widening to half again by Master (the trace's
  rule, 5.2); a pass whose mean deviation is within it, taking at least **1.2 s** and at most **4 s** (a plane is drawn,
  not flicked), is clean - one step. A pass's clock starts at its first forward move, and a jump between two pointer
  events is scored along its chord every 0.025 of the board (`PLANE_ACT.step`), so a flick is no clean pass (AUDIT 30).
  A pass let go early starts again - and moving with no button held lets it go. Quick craft skips it; Gentle acts
  planes plain.
- **The furniture goes to DECOR.** FACT: DECOR2b keeps a player's furniture in the save's `furnishings` (`scenes/
  worldModes.js` decorHome), its "Your things" rows, set down free as any model of its kind the owner chooses
  (`systems/decor/decorFurnish.js`); a piece of furniture in the pack is never offered. DECIDED: a crafted table, chair or bed
  is minted into the furnishings, as the furnisher's delivery is, and DECOR places it - the done-when. **Its mark goes
  with it**: a set-down piece's descriptor (`net/decorLaw.js` decorItemOf) carries its provenance id, and the account
  service writes the maker's mark into the placed row only from its own `products` row - the owner's, the template's -
  so a visitor reads "Silverthorn's Oak Table" and no client can write a mark a craft did not make.
- **The XP** (3.2): Logging a tree's 15 x its tier (+50% clean, a quarter more than two tiers below); Carpentry a craft's
  20 x its tier, +500 the first, under the crafter's limit.
- **The Court writs** ask logs too: the witnessed pixel's trees' woods (a confirmed pixel's all, an unconfirmed one's
  tiers 1-2), never a plank, Charcoal, Resin or Heartwood (sawn, burnt or found, not the ground's). A wood's writ XP is
  Logging's.

As built:

- **Behind PROF1's switch.** `PROFESSIONS_OPEN`, at `dev`; the furnisher's Linen behind MARKS1's too (`MARKS_OPEN`). The
  service is `acct24`; the table changes are `0031_logging.sql` - `node_harvests` rebuilt to learn the kind `logs` and a
  second find, `extra` (a tree's Resin; its Heartwood rides `gem`, the act's own find), every column carried and both
  indexes made again; `prof_crafts.heartwood` (a craft that spent one); `products.marked` (a piece that carries its
  maker's mark - a Masterwork, or furniture a Master Joiner made, `recipeLaw.js` carriesMark; AUDIT 30 N1: this line
  said any piece a Master Joiner made). No new route: a tree is `/v1/prof/harvest`'s (kind `logs`),
  a burn and a saw are `/v1/prof/smelt`'s (the recipe names its station, the XP none), Carpentry's craft is
  `/v1/prof/craft`'s (the recipe names its profession - its rank, cap and track Carpentry's), the Linen is
  `/v1/prof/stock`'s (the counter `furnisher`), and a crafted piece is set down through DECOR's place route. The Ram Kit
  is refused before anything is spent (`prof-later`, 409: "That is made when the sieges come.").
- **The law** is `src/net/professionLaw.js` (the woods and their items; the ring's numbers; the burns, the saws, the
  workbench's fee; the stocks by counter and what has no pack form), `src/net/nodeLaw.js` (the climates' trees, the
  yield and its finds, the writs' woods), `src/net/recipeLaw.js` (Carpentry's 41 recipes beside the smith's 307 - 42 and
  308 since PROF7's Harpy-feathered arrows and Skinning Knife, AUDIT 32 R7; what a
  craft spends - the Joiner's planks, the Heartwood's plank; the steps; the mark; the plane) and `src/net/decorLaw.js`
  (a set-down piece's provenance and mark). One statement decides each act, as PROF1-3's do.
- **The trees** are the forest's own (`src/scenes/treeHost.js`): the streamed pixel keeps its nature flats' tree
  records and their batches (`scenes/world.js`), each law tree stands at the nearest one not already taken, and a felled
  tree's flat is sunk in its batch (`moveBillboardBatch`) - the stump (record 19) stood in its place and the Logs pile
  (record 31) at its foot until the player walks over it, each only where its archive has one (STUMP_ARCHIVES 504, 506,
  508, 510; LOGS_ARCHIVES 504, 508 - AUDIT 30 R13). The fall is the billboard shader's (`render/renderer.js` `uTip`:
  the way it falls, away from the player, and the angle it has leaned, FALL_ANGLE over FALL_S's 1.5 s, the batch then
  destroyed - no fade, AUDIT 30 R10), its shadow dropped. The ring and its meter are
  `systems/chopAct.js` and `ui/professions/profHud.js` (a bar under reduced motion); the Wood-Axe in the hand is DFU's War Axe.
- **The workbench** is a section of the Stores page beside the Forge and the Anvil (`ui/professions/profPages.js` drawWorkbench):
  the saws of the logs held, the families (Staves, Bows, Arrows, Furniture, Tools, Siege) and the woods, each recipe's
  inputs as the Stores hold them, a bed's Linen bought from the furnisher, "Use a Heartwood" where a recipe takes one,
  **Craft** (the plane, unless Gentle acts) and **Quick craft**. It stands at a Furniture Store (50 gold a craft or a
  saw) or at a home's `workbench` station (DECOR, 50,000); away, the word says where; a fee the purse cannot meet is
  not offered, the saws' nor the craft's (AUDIT 30). The Forge burns the logs held; the Anvil lists the smith's recipes
  alone. The plane is `systems/planeAct.js`, drawn on the board's grain; while it is drawn nothing else is picked, and
  the pass makes the recipe and the Heartwood it began with (AUDIT 30).
- **The piece** (`systems/smithItems.js`): a staff and a bow DFU's at the wood's material with the quality laid on,
  arrows twenty in one stack with no provenance, furniture DFU's template worth its quality's condition multiplier and
  marked by its record; a marked piece's name is its maker's (`itemInfo.js`, `itemFields.js` `marked`). Furniture is
  minted into `playerEntity.furnishings`, never the pack (`scenes/world.js` profMintCraft), and DECOR's descriptor
  carries its provenance and mark (`systems/decor/decorItems.js`).
- **Pinned**: `test/net/prof4_law.test.js` (8), `test/net/prof4_service.test.js` (6), `test/systems/prof4_client.test.js` (8);
  `tools/mutants/prof4.json`, 87 mutants, 86 dead and one recorded equivalent (the chops' floor of three, which no
  tree's count reaches today). The done-when is `prof4_client`'s DONE WHEN: an Oak felled, its logs sawn at the
  workbench, a Small Oak Table made through the real Worker and minted among the home's things, listed by DECOR, set
  down in a home and read by a visitor with its maker's mark.

## 26. PROF5 - The Market: listings, regional markets, couriers, buy orders and history, as built (SHIPPED 2026-09-29, at `dev`)

Mac: **"Continue"** (PROF5 after PROF4). What sections 10.2-10.5 left open for PROF5, DECIDED here (the record's, at
Mac's instruction - "make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF5 is.** The board's **Market tab** (10.1) and its five views - Materials, Crafted, My listings, Orders,
  History: a Stores material or a crafted piece listed at a price in Marks and bought whole (a material in part), the
  **regional markets** and their **couriers** (10.2, 10.4), **buy orders** (10.3), the **History** (10.2's 7-day
  medians and their lines), the weekly report's median prices (10.5), and **the Weavers' counter** (4.5). Not here,
  named: timed auctions (PROF5b); **the Tithe** - FOUND: no seat is held (SEAT1 builds holders), so a sale pays none
  and the law carries the Tithe's term at nought until SEAT1 sets it; Bandit Summer's doubled courier (SEAT0 9.3's
  Tides are not built); **the Apothecaries' counter** (4.5) - DECIDED: its sixteen ingredients are the brewing act's
  (9.3), so it stands with PROF12's Alchemy, where they have a use; TRADE1's hand-over of a provenance id (section 18,
  TRADE1's own slice); the guild Stores' listings (AUDIT 31 R8: PROF6 built the guild Stores, 28, and lists nothing
  from them - a member takes out and lists as any seller); commissions (PROF6, built).
- **The Market tab** stands beside Notices and Work on every Notice Board, while the board, the professions and the
  Marks are all open to the account (`BOARD_OPEN`, `PROFESSIONS_OPEN`, `MARKS_OPEN` - DECIDED: no switch of its own,
  section 20 names three; the service's word when any is shut is `market-closed`). FOUND: the window learns its
  region only through the Work tab (`scenes/world.js` openNoticeBoard hands `region` inside `work`, null while the
  professions are shut) - the Market's region is handed to the window on its own.
- **A board's region is its town's** (`maps.getRegionIndexAt`, the board's pixel), and **a listing stands on every
  board of the region it was listed in** (10.2). FOUND: the service holds no ARENA2 and knows no town's region - the
  Court writs (PROF1) and the homes (HOME1) take the region from the client, bounded by `regionOk`. DECIDED: so does
  the market, and the threat is named (section 13): a client may say it stands at any board; what the lie buys is a
  fast travel's worth - the Stores are the character's in every town, so an honest player who travels buys "here" too
  - and the courier is the price of not going.
- **The courier's road is witnessed** (SEAT0 3.2, "every fact the servers need that only ARENA2 knows"). FOUND: the
  hubs are the client's alone (`systems/region/regionHubs.js`, HUB1) and the service holds no map pixel. DECIDED: a new kind
  in `world_witness`, **`hub`** - keyed by the region, its report the hub town's map pixel (`x,y`) - written from a
  week-old registered account, as a harvest writes its pixel: a listing, an order and a fill write the board's
  region's hub alone, a purchase both ends' (each client derives every region's hub from its own MAPS.BSA, so it can
  witness both - AUDIT 30 R8: this line said every act that crosses regions writes both). The road between two
  regions is the distance between their hubs' pixels, each read as the witnesses say it is: confirmed, else the answer
  most give, else the asking client's own - the unconfirmed answer is taken as given, because the lie it could carry
  (a short road) buys nothing the region's lie does not. `world_witness` is rebuilt to admit the kind (SQLite widens
  no CHECK in place). A region with no hub has no board, so no listing and no buyer stand there.
- **The courier** (10.4): **ceil(ceil(units / 20) x (1 + pixels / 25)) Marks, at least 2** - the pixels the hubs'
  straight-line distance, rounded; a piece is one unit - **burnt**, paid by the buyer on top of the price; **the
  courier's time 15 minutes + 1 minute for every 10 pixels begun**. A listing in the buyer's own region travels no
  road: no fee, no wait.
- **A listing of a material** (10.2): from the Stores of the character at the board, **1-5,000 units** it holds, at a
  **unit price of 1 to 1,000,000 Marks**, its whole worth (units x price) at most the Marks cap (`MARKET_WORTH_MAX`,
  else `bad-price` - AUDIT 30 N6), for **72 hours**. The units leave the Stores at once, **bought ones first**
  (a craft's rule, section 7 - so a character's own stay for writs), and the split is kept on the listing, so a cancel
  or an expiry returns each unit with the origin it left with. **The listing fee**: 1% of the listing's whole worth
  (units x price), rounded up, at least 1 Mark, burnt on listing and kept on a cancel.
- **A listing of a crafted piece** (10.2, section 18): a piece with a provenance id, in the pack or among the home's
  things (crafted furniture not set down), whose id **this account owns** and which stands in **no other live listing**
  (the product's `listed`, and a unique index on the open listings' ids); of a family the market lists - never arrows
  (`marketLaw.js` pieceListable, `market-not-listable`); not on its way to the pack (`market-uncollected`) nor standing
  in a home (`market-standing`); still as minted (below) - AUDIT 30; **a whole price of 1 to 1,000,000 Marks**; 72
  hours; the same fee. **The piece leaves the save when it is listed**: the book takes it out and keeps it before it
  asks (ASYNC NEVER DROPS), puts it back on a refusal, and lets it go on the answer. The form offers only what may go:
  a worn, locked or bound piece, or one enchanted since its craft, is left out of its choices (`scenes/world.js`
  marketPieces), and a take that fails answers `bad-provenance`'s words ("Only a crafted piece, with its maker's
  record, lists on the market." - loot does not list, 10.2) (AUDIT 30 N2: this line named "Unequip that first." and
  the lock's line, which the form never shows).
- **What the listing carries of the piece.** FOUND: `products` has no condition or enchantments (section 14's line
  deferred them to PROF5). DECIDED: the listing carries the piece's **wear** - its condition as a share of its most, in
  thousandths - and the buyer's piece is minted from its record with that share of its condition; a lie about wear (a
  modified client's - the game sends the piece's own, `net/marketLaw.js` wearOf) buys the lie for the listing fee (the
  piece listed "whole" and cancelled comes back whole): a Repair Kit's work when this was decided, and since KIT-CEILING
  (2026-10-01) a smith's repair past three quarters too - gold a client that can write its own purse never needs to buy
  (the realm's gold is the client's word after its first save, `06-Systems/Economy-Arc.md` "Where the economy stands"),
  so the wear stays the client's word until the Phase 1 ledger reads it; and the buyer reads the wear on the card
  before buying ("worn to N%", 99 at most - AUDIT 30). **No enchantments are
  carried**: the buyer's piece rolls its record's seed again (a Superior's Magic roll and a Masterwork's Rare, the same
  on every mint). FOUND (AUDIT 30, correcting this line's "nothing enchants a crafted piece but its seed"): DFU's item
  maker can enchant a crafted piece, and that work would be lost on the way - so **only a piece still as minted lists**,
  no enchantment but its quality's roll (`systems/smithItems.js` asMinted).
- **The limits**: **30 live listings an account** (materials and pieces together) and **20 live buy orders** (10.2,
  10.3); **60 postings an hour** (a listing or an order, section 20 - `MARKET_POSTS_MAX`, the counter
  `market-post:<player>`); **120 market acts an hour** besides (a buy, a fill, a cancel, a collect, an order withdrawn,
  a report - the market's own `MARKET_OPS_MAX` and counter `market:<player>`, not the Marks'; AUDIT 30 N5: this line
  named `MARKS_OPS_MAX`).
- **Buying** (10.4: "the buyer always pays the listed price"): a material in part (1 to the units left), a piece
  whole; the buyer's own listing is refused (`market-own` - a cancel is the way back; wash-trading between one's own
  accounts stays allowed and visible, section 20). **Here** - the listing in the board's region - a material goes
  straight into the buying character's Stores as **bought** (the Stores' room decided in the same statement), and a
  piece comes to the pack (furniture to the home's things) on the answer, kept before it is asked and minted once.
  **Elsewhere** the goods go by courier: the sale is written with the time they arrive; a material enters the Stores
  on the buyer's first read after it (a full Stores keeps it at the counting-house, "waiting for room", until there is);
  a piece is collected by the buyer's book once it has arrived, kept and minted once the same way - and only by the
  piece's owner (AUDIT 30).
- **The seller is paid at the sale**, wherever they are: the price less **the sales tax - 5% of the listing's running
  total, rounded down, less what its earlier sales paid** (`marketLaw.js` saleTaxOn - so a purchase split into parts
  pays the tax it would have bought whole, and another sale between the look and the buy is `market-price-moved`;
  AUDIT 30, where this line taxed each sale alone) (DECIDED: a one-Mark sale is not taxed to nothing; a tier-1
  material is worth one Mark) - and less the Tithe (nought, above); refused only if it would carry the seller past the
  Marks cap (`market-seller-full`).
- **The owner moves at the sale.** A sold piece's `products.owner` becomes the buyer's account in the sale's own batch
  (section 18: "a market sale hands it over by itself"); `char_id` stays its maker's character. FOUND: `products`'
  owner cascades on the account's deletion, against section 20's "`products` forever"; DECIDED: rebuilt without the
  cascade - a piece's row outlives its owner's account, and an owner that is gone never lists it again.
- **Buy orders** (10.3): a material, **1-5,000 units**, a unit price of 1 to 1,000,000 Marks, the whole (units x
  price) at most the Marks cap (`bad-price`), posted at a board for **7 days** - never a material nothing yields, the
  Daedric and Warforged ingots and the Bear Hide (`marketLaw.js` UNYIELDED, `market-unyielded`; the catalogue leaves
  them out) - AUDIT 30 N6; AUDIT 32 R8: since PROF7 the Daedric and Warforged ingots and Standard-bearer's Silk, the Bear
  Hide Hunting's now; DAEDRIC-SMELT (section 50): the Daedra's Heart alone since, the forge smelting the Daedric ingot; **the Marks are escrowed when it is posted**, no fee (10.4 names none). Any character at any
  board (GLOBAL-MARKET, 10.9) **fills it from its Stores**, in whole or in part, **bought units first**; the filler is
  paid the price less the tax from the escrow (on the order's running total, as a listing's - AUDIT 30) and, from another
  region, less the courier (10.9); the units reach
  the orderer's posting character's Stores **at once, as bought** (an order buys "here" - where it was posted), refused
  past that Stores' room (`market-order-full`). Its own poster may not fill it. A cancel or the seventh day returns the
  rest of the escrow.
- **The escrow is the ledger's.** FOUND: `marks_ledger`'s ends are `mint`, `account`, `guild` and `burn`, `account`,
  `guild` - there is nowhere for Marks held for an order. DECIDED: a third end, **`escrow`**, its id the order's: the
  ledger is rebuilt to admit it (every line carried, its four triggers made again); an escrow end moves no balance by
  trigger (as `mint` and `burn` do not), and the order row holds what is left of its escrow, moved in the same batch as
  each line. The market's kinds (`MARKS_KINDS`): **`market-fee`**, **`market-tax`** and **`courier`** burn;
  **`market-sale`** (buyer to seller), **`order-escrow`** (account to escrow), **`order-fill`** (escrow to filler) and
  **`order-return`** (escrow to account) move. Every act that moves Marks is decided in one statement keyed on its
  nonce, as PROF1-4's (an order's return on the order's own id), and every line it writes a plain INSERT under the
  request id and its own suffix - `:fee`, `:sale`, `:tax`, `:courier`, `:escrow`, `:fill`, a fill's tax `:filltax` (an
  order's return `order-close:<id>`); a decision refuses a request id whose line the ledger already holds (`prof-rid`),
  since the rows that answer a repeat are pruned and the ledger is not (AUDIT 30).
- **Cancel, expiry and removal.** A seller cancels a listing whenever it stands: a piece comes back to the pack on the
  answer, always; a material's units return to the listing character's Stores, and the cancel is refused
  (`stores-full`) while they would not fit - the listing stands until there is room (`market.js` marketCancel;
  AUDIT 30 R1: this line said the units wait). **An expired listing** (72 hours) leaves every board at once and its
  goods return on its seller's next read - a material's once the Stores have room, waiting as an arrival does; an
  expired piece is collected like an arrival. **An expired order** returns its escrow on its poster's next read. Each
  return is keyed on its row's own id, so it happens once.
- **Reports and removal** (section 20: "a listing may be reported and removed the same way"): a registered reader
  reports a listing once; a listing carries no words, so reports hide nothing - they are counted for the moderators
  (`MODERATOR_HANDLES`, `DEVELOPER_HANDLES`), who see the count on the card and remove it, its goods returned. A mute
  stops no trade: a listing says nothing.
- **History** (10.2): every sale of a material, and every fill of a buy order (AUDIT 30 N3), adds its units at its
  unit price to the day's price table (`market_prices`, day x material x price); **a material's median is the unit price
  its middle unit sold at over the last 7 UTC days, across the Bay** (DECIDED: not a region's - a region's price is its
  own listings, which the card shows beside it), and **its line is the seven days' medians**, a small polyline on its
  card. The History view lists the week's traded materials, most units first (30), and "Your trades", this account's
  last 20 - its sales and purchases and the orders it filled or had filled, each at the Marks it moved (AUDIT 30 N3).
  The weekly report (`/v1/marks/report`) gains the medians of the twenty most-traded materials (10.5). Sales and prices
  are kept **90 days** (section 20), pruned on read.
- **The Weavers' counter** (4.5): **Linen Bolt 2** and **Wool Bolt 3 Marks** a bolt, into the Stores as bought -
  4.5's own prices (the smith's twice-the-value rule would make Wool 4); on the Market tab's Materials view, through
  PROF3's stock route (counter `weavers`). **Wool Bolt** (669, tier 2) is registered as Linen was, with no pack form
  until Outfitting. The furnisher's stock keeps its Linen (PROF4, section 25) at the same price, so the two counters
  never disagree.
- **The window** (10.1, section 21's Market wireframe): the Materials view - search (the catalogue's materials its
  words name, which the service reads), family, tier - its rows cheapest landed first, the unit price and the
  courier's share of the pick (`ui/marketTab.js` landed; the service still orders by listed price - AUDIT 30 R5), each
  row its units, its unit price, "here" or its region with "+N courier, M minutes", its median and line; the picked
  row's "Buy N for P Marks + C courier?" and **Your Marks** (the market book's balance, which every market answer and
  the Weavers' purchase tell - `marketBook.js` told; AUDIT 30 R7: this line said the Marks book's. FOUND: the smith's
  stock answer never told the Marks book its balance; every market and stock answer does now). Crafted - each piece's
  name as its record mints it, its quality, maker and wear, cheapest landed first too. My listings - this account's,
  with Cancel, the fee kept, and **List** (a Stores material, or a piece chosen from the pack and the home's things),
  and its buy orders with Withdraw. Orders - every board's open orders (GLOBAL-MARKET, 10.9), each "here" or its region and
  what a fill pays, with **Fill N from the Stores** and each one's
  median (no line - AUDIT 30 N8), this account's own among them with **Withdraw** (AUDIT 30 R6: this line said
  Cancel), and **Post an order**. History. **On the road**, atop the tab while anything travels: "40 Mithril Ore from
  Wayrest - 32 minutes".
- **The book** (`net/marketBook.js`) is the board's shape (a minute's cache of every read, a stale read marked) and the
  profession book's (a listed piece, a bought piece and a collected piece KEPT before they are asked, minted or put back
  once on the answer; one act at a time, another meanwhile refused `market-busy`, the opening settle among them; every
  request gives up after fifteen seconds; a kept act waits out `rate`, `no-session` and `auth` - AUDIT 30). FOUND: a
  kept craft (PROF3) was settled only when a withdrawal was kept beside it - `pendingCrafts` had no reader - so a craft
  whose answer was lost waited for an unrelated withdrawal; the Stores page settles either now, and the Market tab
  settles its own.
- **FOUND: PROF4's plane was drawn undressed.** Its board's SVG (`ui/professions/profPages.js` planeBoard) carries the classes
  `prof-board`, `prof-grain`, `prof-trail`, `prof-boardhead` and `prof-plane`, and no rule in `src/` dressed them - an
  SVG polyline with no rule paints its fill black and its line not at all, so the grain was a black shape and the
  player's stroke invisible. Dressed here (`ui/enhanced/enhancedPlusStyle.js` PROF_CSS): the board its height and
  `touch-action: none`, the grain and the trail as lines, the head a pale band.
- **The service** is `acct25`; `0032_market.sql` holds the listings, the sales (a purchase's row, its courier and its
  arrival), the orders and their fills, the price table, the reports, the deliveries (a piece's arrival or return) and
  the three rebuilds (the ledger's ends, the witness's kind, the products' owner). Routes `/v1/market/*`: `read`,
  `list`, `buy`, `cancel`, `order`, `fill`, `unorder`, `collect`, `report`, `remove`. The law is `src/net/marketLaw.js`
  (pure, both ends): the bounds, the fees, the tax, the courier and its time, the road, the median, the kinds.
- **The four hosts** (17.1): the streaming world wires the tab (the board's region and the hubs, the pieces minted
  into the pack or the home's things); the fixed city keeps DFU's board (NOTICE1's flag); the interiors and dungeons
  have no boards.
- **Done when**: a crafted Mithril Longsword listed at a board in one region is bought at a board in another by a
  second account - the courier's fee burnt, the sword on the road, then collected into the buyer's pack, DFU's own piece
  with its quality and its wear, its owner moved - and Mithril Ore bought the same way reaches the buyer's Stores after
  its courier's time.

As built:

- **Behind three switches.** The market is open where `BOARD_OPEN`, `PROFESSIONS_OPEN` and `MARKS_OPEN` all are, at
  `dev` (server-account/src/market.js marketOpenFor); the service is `acct25`, its table changes `0032_market.sql` (section
  14's line, BUILT). Ten routes, `/v1/market/*`; a listing, a purchase, a cancel, an order and a fill each one
  statement keyed on its nonce, its row looked for before the switch; a collect one statement keyed on its request id,
  which the delivery takes; an order withdrawn answers its repeat off the order's own state; a report (once a reader)
  and a moderator's removal are keyed on nothing (AUDIT 30 N4: this line said every act); every read, and a listing or
  an order before it is posted, settles its own account's expired listings and orders and arrived loads first, one row a
  batch, twenty at a time.
- **The law** is `src/net/marketLaw.js` (pure, both ends: the bounds, the fees, the tax, the Tithe's nought, the
  courier and its time, the road witnessed, a piece's wear, the median and its line, the catalogue); the ledger's seven
  market kinds are `marksLaw.js`'s; the witness law is nodeLaw.js `witnessedFact`, which now reads another kind's report
  by a `parse` handed to it (a pixel's by default, a hub's pixel for the road). Wool Bolt and the Weavers' counter are
  `professionLaw.js`'s.
- **The window** is the board's (`ui/noticeWindow.js`): the Market tab beside Notices and Work while the market is the
  account's, drawn by `ui/marketTab.js` (the one constructor, the window's alone), its acts through a one-at-a-time
  door of its own (the market's busy, not the board's) and the window's status line; the tab is read on its first
  showing, the kept acts settled and the arrived pieces collected first - the settle an act like any other - and a
  piece that arrives while the tab stands is collected then; an answer to a view since left is dropped; List, Post and
  the Weavers' Buy are not offered where the fee, the board's limit (30 listings, 20 orders) or the balance would
  refuse them (AUDIT 30). The host (`scenes/world.js` openNoticeBoard) hands it the board's region, every region's hub
  as this client derived it, the Stores, the pieces that may be listed (in the pack, not worn, locked or bound -
  TRADE1's refusals - and the home's crafted furniture not set down; none enchanted since its craft, AUDIT 30), and the
  mint - a piece from its record at its wear, into the pack or the home's things, once by its provenance id.
- **The book** is `net/marketBook.js`; every answer's balance goes to the Marks book, so the Bank's counter and the
  account card read the same Marks, and the Stores counts it carries (`store`, `stores`) to the professions book
  (AUDIT 30).
- **Pinned**: `test/net/prof5_law.test.js` (7), `test/net/prof5_service.test.js` (8), `test/net/prof5_client.test.js` (6);
  `tools/mutants/prof5.json`, 109 mutants, 105 dead and four recorded equivalent (the listing fee's floor, which no
  listing's worth reaches; the catalogue's filter, which every key the unyielded leave passes today; a reader's report
  count, dropped twice; since AUDIT 30 S7, a load's room guard at its delivery, which the settle's read now keeps).
  The done-when is `prof5_client`'s DONE WHEN, through the real Worker.

## 27. PROF5b - Timed auctions for Masterworks, as built (SHIPPED 2026-09-29, at `dev`)

Mac: **"Go"** (PROF5b after AUDIT 30). What 10.2 left open for PROF5b ("timed auctions for **Masterworks only** - 24
hours, a 5% minimum raise, and a bid in the last 2 minutes adds 2"), DECIDED here (the record's, at Mac's instruction -
"make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF5b is.** An **auction** of one crafted **Masterwork** (its product row's quality, 4) on the Market tab's
  new **Auctions** view, beside Crafted: posted at an **opening bid**, it stands **24 hours**; each bid must raise the
  standing one by **5%** (rounded up, at least 1 Mark); a bid in its **last 2 minutes adds 2** to it; at its end the
  highest bid buys it. Not here, named: a buyout beside the bids (DECIDED none - a Masterwork is sold at a price by
  PROF5's listing, or to the room by this); a reserve below which it does not sell (the opening bid is it); auctions
  of anything but a Masterwork (10.2's "Masterworks only").
- **What may be auctioned** is what a crafted piece may be listed as (26, AUDIT 30): its owner's, one live sale at a
  time (`products.listed`, which a listing and an auction both set), no delivery of it waiting, not standing in a
  home, a crafted family's (`pieceListable`), as minted (the client's `asMinted`) - and a Masterwork
  (`auction-not-masterwork`). The piece leaves the save while it stands, kept before it is asked (the book's lists,
  put back on a refusal), as a listed piece does.
- **Where**: an auction stands on the boards of the region it was posted in, and shows on every board with its
  courier (26's law): a bid at another region's board carries the **courier** from its region to the auction's, for
  one piece, escrowed with the bid; the winner's piece reaches their character as a **delivery** - at once from its
  own region's board, else after the courier's time (26's deliveries, collected by the book).
- **The terms** (`src/net/marketLaw.js`): the opening bid 1 to 1,000,000 Marks (a listing's price bounds); a bid up to
  MARKS_MAX; the next bid is the opening while none stands, else the standing bid plus `max(1, ceil(5%))`
  (`auctionNext`); a bid made with **less than** 120 seconds left moves the end 120 seconds on (`auctionEnd` - "adds
  2", as said, so a run of late bids keeps adding; the 5% raise and the Marks cap bound it; AUDIT 31 L4: this line said
  "within 120 seconds" - a bid with exactly 120 left adds nothing, and the service's own SQL is pinned at the edge). The **fee** is a
  listing's, 1% of the opening bid (at least 1), burnt when it is posted and kept if it is cancelled; the **sales tax**
  5% of the winning bid, the Tithe's term at nought as 26's.
- **The Marks**: a bid is **escrowed** - its amount and its courier, one ledger line on 26's `escrow` end keyed by the
  bid's own id (`<rid>:bid`), so a bidder cannot spend them elsewhere while the bid stands. An outbid bid's escrow is
  returned on its bidder's next read of the market (under the Marks cap, else it waits, as an order's return does) -
  DECIDED: not in the new bid's own batch, because a return that broke the outbid bidder's cap would refuse the new
  bid. The standing bidder may not bid again (`auction-leading`); the seller never (`market-own`). A bid another bid
  overtook between its read and its decision, though it would still beat the new one, is refused in its own word,
  `auction-moved` (AUDIT 31 S4 - it read "no longer on the market" while the auction stood), and the view read again;
  a bid past the Marks cap is `bad-bid` (AUDIT 31 L6 - it was a price's word, "1 to 1,000,000"), and the tab says so
  where the next bid is past any balance. At its end the
  winner's escrow pays: the seller the bid less its tax, the tax burnt, the courier burnt - three lines keyed on the
  auction (`auction:<id>:sale`, `:tax`, `:courier`), so its close happens once.
- **Settled on read** (26's law): an auction past its end is closed by the **next read of the market by anyone** -
  its seller, its winner and its outbid bidders each need it, so the sweep is every reader's, at most twenty a read,
  one batch each, keyed on a nonce (MARKET-SPEED, 10.12: its candidates asked in the read's first batch, beside the
  settle's reads, and closed only where it found one - the clock closes them each minute, SCALE4b). Sold, its owner moves to the winner and the winner's delivery is written; the
  seller's room under the Marks cap is asked first (else the close waits, re-asked each read - the winner's escrow
  held; AUDIT 31 S3, DECIDED: **seven days at most** past its end, `AUCTION_GRACE_S` - then the winning bid is void,
  its escrow back on its bidder's read, and the piece back to its seller unsold: a winner's Marks are never held
  without end for a seller who does not spend). AUDIT 31 S1: an auction whose standing bid's row is gone (its bidder's
  account deleted - no route does it, 18) closes unsold at its end, never a sale to no one - a product's owner written
  NULL failed every market read after. Unsold (no bid), or removed by a moderator, the piece goes back to its seller as a returned delivery on the
  seller's next read, as an expired listing's does.
- **Cancel**: the seller's, while no bid stands (`auction-bid-standing`) - the piece answered back to the pack, the fee
  kept. **Report and remove** (section 20): an auction is reportable as a listing is (its own report table - the
  listings' is keyed to `market_listings` by a foreign key), and a moderator's removal voids the standing bid (its
  escrow back on its bidder's next read) and returns the piece.
- **Counts**: an open auction counts among the account's **thirty** listings (10.2's cap is the account's sales
  standing - AUDIT 31 L1: an auction past its end, a won one waiting on its seller's cap, stands no longer and counts
  no longer). A bid counts among the market's acts an hour (`market:<id>`, MARKET_OPS_MAX); a post among its posts.
- **Ids and repeats** (PROF1's law, AUDIT 30's lines): a post's row keyed `(seller, rid)`, a bid's `(bidder, rid)`,
  each looked up before the switch and answered `repeat`; every ledger line an auction writes under its own suffix
  (`:afee` - never a listing's `:fee`, which one id could otherwise hold twice - `:bid`, `bid-return:<id>`,
  `auction:<id>:...`), a plain INSERT, and each decision refuses an id whose line the ledger holds (`prof-rid`).
- **The tab**: **Auctions** - every open auction, ending soonest first: the piece as its record mints it, its quality,
  maker and wear, the standing bid (or the opening, "no bids yet"), the bids, the time left, where and its courier;
  the picked row's **Bid** with the next bid filled in, or "Your bid leads", or "Your auction" with Cancel while none
  stands. **List on the market** offers "An auction (Masterworks)": the Masterworks in the pack and the home, an
  opening bid, the fee and the terms said. **My listings** shows the account's auctions and its bids (leading,
  outbid, won, void - AUDIT 31 R10: this said "lost", a state no bid has - each with whether its Marks are back). "Your Marks" says what the bids hold. **Your trades** counts an auction won or sold.
- **The service** is `acct27`; `0033_auctions.sql` holds the auctions, the bids and the auction reports; the ledger's
  new kinds `bid-escrow`, `bid-return` and `auction-sale` move Marks, the fee and the tax are 26's burns.
- **Done when**: a Masterwork posted in Daggerfall is bid on from Wayrest and from Daggerfall, the Wayrest bid outbid
  and its escrow returned on its bidder's read, a bid in the last two minutes adding two, and at its end the Daggerfall
  bidder's piece is theirs, the seller paid the bid less its tax - through the real Worker.

As built:

- **Behind PROF5's three switches** - no switch of its own. The service is `acct27`, its tables `0033_auctions.sql`
  (section 14's line, BUILT); two routes, `/v1/market/auction` and `/v1/market/bid` - the cancel, the report and the
  removal are the listings' routes, which find an auction by its id. A post is one statement keyed on its nonce (the
  fee, the thirty, the piece its owner's, unlisted and a Masterwork, and no `:afee` line under its id - all in it); a
  bid is one UPDATE of the auction keyed on the standing bid it read (`high IS` that bid - two bids at once, one
  stands), its row and its escrow line keyed on the nonce the UPDATE wrote; a close is one batch keyed on the high bid
  it read and the seller's room under the cap.
- **Settled on read**: `closeAuctions` runs first on every market read, anyone's - at most twenty auctions past their
  end a read; then the reader's own `settle` returns their unsold and removed pieces (a returned delivery) and their
  outbid and voided bids' escrow (a `bid-return:<id>` line, under their cap). "Your Marks" counts what the reader's
  bids hold (`held`, the answer's).
- **The law** is `src/net/marketLaw.js` (`AUCTION_S`, `AUCTION_RAISE_PCT`, `AUCTION_LATE_S`, `AUCTION_ADD_S`,
  `AUCTION_BID_MAX`, `bidOk`, `auctionNext`, `auctionEnd`, `auctionable`); the ledger's `bid-escrow`, `bid-return` and
  `auction-sale` are `marksLaw.js`'s, each a move.
- **The window**: the Market tab's **Auctions** view (`ui/marketTab.js`, its row its own grid, so the piece's name is
  never cut at a phone's width), the List form's "An auction (Masterworks)", My listings' auctions and bids, Your
  trades' "won" and "auctioned". The book (`net/marketBook.js`) keeps a post as it keeps a listing (the piece out of
  the save until the answer, put back on a refusal, settled by its own route) and a bid pressed twice under one id.
- **FOUND and fixed in the build**: a refusal answers its word alone (`index.js`'s `no`), so `auction-low` carries no
  next bid - the tab and the book read the view again on it (the tab's own `MOVED` lacked it; pinned red first); the
  race test's two bids at once were served one after the other by the harness, so it proved nothing of the guard - it
  is now staged (Bob's decision waits while Cid's whole bid lands); `MARKS1-13` aimed at `0025_marks.sql`'s trigger,
  which `0032_market.sql` rebuilt, and survived since PROF5 - re-aimed at the live one, dead.
- **Pinned**: `test/net/prof5b_law.test.js` (3), `test/net/prof5b_service.test.js` (5), `test/net/prof5b_client.test.js` (4);
  `tools/mutants/prof5b.json`, 44 mutants (AUDIT PROF-541 R2-S4's four among them), 39 dead and five recorded equivalent (the raise's floor of a Mark, which the
  ceiling of 5% of a whole Mark already gives; the post's Masterwork guard, the cancel's standing-bid word, the bid's
  leader word and its low word - each an early refusal whose decision asks the same). AUDIT 31 R5: the last two were
  NOT equivalent - the early words come before the courier's road, so a leader's bid under the next, or a low bid from
  a board with no known road, said the road; pinned (`test/net/audit31_service.test.js`), they are dead now (37 dead, three
  equivalent).
- **AUDIT 31** (Online-Arc "AUDIT 31") corrected this section in place, each line marked. **The four hosts** (17.1 -
  AUDIT 31 H7: this section did not say): the streaming world wires the Auctions view as it wires the Market tab (26);
  the fixed city keeps DFU's board; the interiors and dungeons have no boards. The done-when is
  `prof5b_service`'s DONE WHEN, through the real Worker; `prof5b_client`'s the books'.

## 28. PROF6 - Guild writs, the guild Stores and commissions, as built (SHIPPED 2026-09-29, at `dev`)

Mac: **"continue"** (PROF6 after PROF5b). What sections 7 and 11 left open for PROF6, DECIDED here (the record's, at
Mac's instruction - "make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF6 is.** Of 15's row - "Writs: guild, seat, commissions, bounties" - the two whose posters exist today:
  **guild writs** (11), posted from a guild's Marks treasury and delivered from the Stores, and **commissions** (11),
  a player's writ naming a crafter and a piece; with them **the guild Stores** (7), where a guild writ's units go -
  FACT: `guild_prof_stores` is not built (14), and a guild writ with nowhere to put its units is a door painted on a
  wall; and the note's **commission button** (10.6: "Commissions come with PROF6"). Not here, named: **seat writs**
  (SEAT2b - AUDIT-SEATS: it said SEAT1b - influence, the stockpiles and the Siege Camps, and the board's in-person check, which only influence
  needs: FACT, section 22 - "its in-person check comes with PROF6, where a delivery raises influence"; no delivery
  raises influence until SEAT1b); **bounties** (SEAT0 7.6's Bounty Edict - SEAT1d's Edicts); **found and writ-only
  recipes and the Recipe Scroll** (9.1, 695) - DECIDED: their own slice, **PROF6b** (15), because no record yet names
  which recipes are found, and a scroll "1 in 500 from loot" needs a roll the service witnesses (FACT: the loot is the
  client's; law 8's witness is for the ground) - every recipe stays unlocked by rank until then; **a guild's colours**
  (FACT: no colour or device is stored - Seats-Arc 90, its heraldry SEAT1c's; AUDIT-SEATS: GUILD1d stored it) - a guild
  writ's seal is NOTICE1's guild blue with the guild's tag until the heraldry stands.
- **The switches**: PROF5's three. The guild Stores are the professions' (`PROFESSIONS_OPEN`); a guild writ and a
  commission move Marks, so they are open where the professions and the Marks both are; the note's button where the
  board also is. No switch of its own.
- **Guild writs - who posts.** The **Guildmaster**, or an **Officer** within the guild's **writ budget** for the week
  (11) - GUILD1's ranks, FACT integers (0 Guildmaster, 1 Officer, `src/net/guild/guildLaw.js`); a Member or Recruit never
  (`guild-rank`). The budget is the Guildmaster's to set on the Guild tab, 0 to 10,000,000 Marks (the Marks cap),
  **0 until set** (so an Officer posts nothing a Guildmaster did not allow); it is one budget for the guild's Officers
  together, spent by the escrow of what they post in the week (a withdrawn writ's escrow stays spent - the budget
  bounds posting, the thing 13's threat names). **The week** is the seat week (Seats-Arc 3: Sunday 18:00 UTC to
  Sunday 18:00, from `ONLINE_EPOCH_MS`), so one week governs a guild's writs and, with SEAT1, its seat.
- **Guild writs - the terms** (`src/net/writLaw.js`, new, pure, both ends): a Stores material the market takes (PROF5's
  catalogue - what something yields); **1 to 5,000 units** (a character's Stores' most of a material); **pay each a
  whole number of Marks, 1 to 1.5 x the material's value, rounded down** (11, 4.8 - "pay may not exceed 1.5 x the
  materials' value"; a tier-1 material pays 1); the whole pay **escrowed from the guild's Marks treasury** when it is
  posted (a `guild` to `escrow` line, `writ-escrow`, keyed `<rid>:wesc`); **7 days**; **20 open a guild** (AUDIT 31
  L1: the twenty that STAND - one past its seventh day and not yet swept is not among them); and (AUDIT 31 L9) posted
  only with **the guild Stores' room** for it - what they hold of the material and what its standing writs still want
  (`guild-stores-full` at the post, never at the last deliveries); posted at a Notice Board, for the boards of its region (the client's word, as a listing's - what a lie buys is a fast
  travel's worth). Posts - a guild writ's and a commission's together - are **20 an hour** an account (20's "writ
  posts 20").
- **Guild writs - a delivery.** Anyone with a character, in the guild or not (11: "anyone else's delivery earns the pay
  alone") - **but for the ranks that take the guild Stores out** (AUDIT 31 S6, DECIDED): an account one of whose
  characters is the writ's guild's Officer or Guildmaster delivers to none of its writs (`writ-own-guild`), for such a
  rank could deliver, take the same units back out and deliver again, the Officers' budget (or the treasury) its own
  Marks for no material spent - where GUILD1's law is that the Guildmaster alone withdraws Marks - at a board of the
  writ's region, delivers **any number of units up to what is left**, from the Stores,
  **bought first** (a Court writ's rule, 22); **partial fills pay pro rata** (11) - the units times the pay each, less
  the **sales tax** (5%, reckoned on the writ's running total, as a buy order's fill - DECIDED: a guild writ is its
  guild's buy order at a bound price, so it pays the order's tax; untaxed it would be the one sale in the Bay that
  paid none), out of the escrow (`writ-pay`, the tax the market's burn). No Renown and no profession XP - DECIDED:
  those are the Court's (the crown's faucet, 11); a guild's Marks buying XP would make the treasury a trainer. The
  units go into **the guild Stores** as the guild's own (below). One statement decides, keyed on its nonce: the writ
  open and unexpired, the units left, the Stores holding them, the guild Stores' room, the deliverer's room under the
  Marks cap, the id unspent.
- **Guild writs - withdrawn and expired.** The Guildmaster withdraws any of the guild's writs, an Officer those they
  posted; what is left of the escrow returns to the treasury (`writ-return`), under its cap. An expired writ's escrow
  returns on the **next read of the Work tab by anyone** (PROF5b's close: the treasury is no reader's own, so no one
  reader's settle reaches it), at most twenty a read, waiting while the treasury is full.
- **The guild Stores** (7): a guild warehouse on the service, **50,000 of a material** at most (ten characters'
  Stores, since a seat's works ask for hundreds). **Any member deposits** from their character's Stores, bought units
  first; **Officers and the Guildmaster withdraw** into theirs, under its 5,000 - and (AUDIT 31 R1) **any member takes
  back their own deposit**, no more than it (`guild-stores-mine`): the record promised every member their own back
  while only an Officer could take it out (as bought), and a member who left stranded it. A member who leaves the
  guild leaves their deposit in it - theirs again if they rejoin, an Officer's to take last meanwhile. **Origin** (7): a member's own units
  are kept under that member (the character) as their deposit - **own again when that member withdraws them, bought to
  any other**; bought units and a writ's units are the guild's, bought to whoever withdraws them. A withdrawal takes
  the withdrawer's own deposit first, then the guild's, then the other members' deposits (so a guildmate's harvest is
  taken last). **Every movement on a ledger** (7: the guild ledger's trigger pattern - FACT, `guild_ledger` is written
  by a trigger on the treasury's update, `0013_guilds.sql`): a trigger writes each change of a row. **Where**: the
  Guild tab, anywhere the tab opens - DECIDED: a move between two Stores on the service touches no save, and FACT no
  guild hall exists to stand at (7 says "at its hall and any seat it holds"; a seat is SEAT1's); the Stores tab shows
  the character's own, as before.
- **A guild disbands** (18): refused while its guild Stores hold anything (`guild-stores` - 18's grown clause) or a
  writ of its stands (`guild-writs`), beside GUILD1's gold treasury - or (AUDIT 31 A15) while a closed writ's pay is
  still on its way back to a full treasury (`guild-writ-escrow`: the escrow waits, no writ stands). AUDIT 31 S7: a
  guild nobody is left in (every member's account gone - no route does it, 18) is reclaimed for its name and tag only
  while it keeps nothing, as any going - never with its gold, its Marks, its guild Stores or a writ.
- **Commissions** (11): a registered player posts one at a board, naming **a crafter by handle** (the letter's `to`
  rule - the author is the handle; never oneself) and **a piece**: a recipe of a listable crafted family (PROF5's -
  weapons, armour, staves, bows, tools, kits, furniture - AUDIT 32 R8: and PROF7's leather armour, clothing and
  furnishings; never arrows or siege works - and, AUDIT 31 L2, one someone could make now: never a Daedric or Warforged
  piece, whose metal nothing yields, nor a garment in Standard-bearer's Silk, `commission-unyielded` - every one of them
  commissioned since, the sieges' Spoils and DAEDRIC-SMELT's forge yielding their goods, section 50) and, where the recipe has a
  quality (a kit has none), **the least quality** it will take (Crude to Masterwork). **Pay 1 to 1,000,000 Marks** (a
  listing's price bounds), escrowed from the poster's balance (`commission-escrow`, keyed `<rid>:cesc`); **7 days**;
  **5 open an account**, and **20 open naming one crafter** (so no one can bury a crafter's list - AUDIT 31 L1: the
  twenty that STAND; a crafter's own Work read closes those naming them that ran out, which their Yours then shows). No fee (a buy
  order has none); no words of its own (the recipe and the quality say it - so nothing to report).
- **A commission filled**: **only the named crafter**, at a board of its region, hands over **a piece of their own
  make** - its product row their account's, crafted by it (`prof_crafts`, either of a craft's two pieces - so a
  crafter cannot buy a piece on the market and pass it off), the recipe asked, its quality at least the least asked,
  on no other sale (listed, auctioned, a delivery waiting, standing in a home - PROF5's guards), as minted (the
  client's `asMinted`, as a listing's), and **unworn** (DECIDED: a commission is new work; the wear is the client's
  word, as a listing's, and a lie mints the poster the whole piece of what the crafter made). The piece leaves the
  crafter's save kept before it is asked (the market's kept piece), its **owner moves** to the poster, and it reaches
  the poster as a **delivery** (PROF5's) at once - collected at **the Market tab**, by the character that posted it
  (AUDIT 31 R3, H6: the record said "the Work tab's or the Market tab's" - the Work tab collects nothing; its Yours
  says "filled - collect it at the Market tab", and lets the market's minute of cache go when it shows one). A piece
  that cannot go says where it is (AUDIT 31 S5): listed (`market-listed`), on its way to the crafter still
  (`market-uncollected` - it read "stands in a home"), standing in a home (`market-standing`); a piece the service has
  no record of at all, `market-no-record` (never "another owner's"). The Work read names, for the crafter, **the pieces
  of their make that would fill each commission naming them** in the board's region (`eligible`, the least quality
  first - AUDIT 31 U7), and the Fill offers those alone, each with its quality.
  The crafter is paid the pay less the **sales tax** (a sale is a sale), under their cap (`commission-pay`).
- **Withdrawn, declined, expired**: the poster withdraws while it stands; **the crafter may decline it** (DECIDED: a
  crafter owes no one work); either way, and at its seventh day, the escrow returns to the poster
  (`commission-return`) - a withdrawal or a decline at once, an expiry on the poster's next read (under the cap, else
  it waits, as an order's). A commission whose crafter's account is gone is returned the same way.
- **The Work tab** (21's wireframe), on every board while the professions and the Marks are the account's: the
  **Court writs** (purple, as PROF1), then this region's **guild writs** (the guild blue, its tag: "The Silver Hand
  needs 280 more Cut Stone - pays 2 Marks each - 520 / 800 delivered"; **Deliver** a number from the Stores), then this
  region's **commissions** (green: "For Silverthorn only: a Mithril Longsword, Fine or better - pays 900 Marks - 5
  days left"; **Fill** for the named crafter, with a piece chosen from the pack); **Yours**: the account's
  commissions posted and naming it, every region, and the guild's open writs, every region (Withdraw where the rank
  may) - AUDIT 31 U4: the record said Yours had Withdraw, Decline and Fill; as built it had Withdraw alone. Yours
  withdraws one's own, and declines one naming you (Decline is pressed twice, U11) and says where it is filled - "Fill
  it on its card above" here, "Filled at the boards of Wayrest" elsewhere: a card is always this board's region's. **Post a guild writ** (a Guildmaster's or an
  Officer's - the escrow and the budget left said) and **Commission a piece** (the crafter, the recipe by family, the
  least quality, the pay). "Court writs today: 1 of 3" stays at its foot. AUDIT 31: the guild writs and commissions
  stand in the Court's own grid (U14); every field is named on the page, and a button the service would refuse says
  why - the budget none, one's own name, the Marks, five standing, twenty writs, the guild Stores' room, one's own
  guild's writ (U2, U10); none of it is offered while the service says it is not the account's (`writsOpen`, U5 - the
  note's button too); the forms' drafts are the writs' book's, and Escape closes an open form before the window (U12);
  the field being typed in, its caret and the list's scroll survive every redraw (U1 - the window emptied itself before
  the tab looked for the focus, so AUDIT 30 U8's keeping never worked in a browser).
- **The Guild tab** (social panel): **Guild Stores** - the materials and counts, "yours" beside a member's own deposit;
  **Deposit** from the character's Stores; **Withdraw** for Officers and the Guildmaster, and (AUDIT 31 R1) a member's
  own deposit; the last moves. AUDIT 31 H2: read again at each look at the tab and kept per guild AND character; a
  read refused says why, with Try again (it said "Reading the guild Stores..." for the session's life); U8: every
  number the service bounds - a move's 1 to 5,000, the Stores held, the guild Stores' room, one's own deposit - is
  bounded before the press. **Writ
  budget**: the Guildmaster sets it; everyone of a rank that posts reads what is left this week.
- **The note's button**: a note may carry **Commission a piece** (10.6) - a crafter's advertisement; pressed, the
  board's Work tab opens its commission form with the author named. FACT: `board_notes.button` is a CHECK of three
  kinds (`0026_board.sql`), so the table is rebuilt for the fourth.
- **Ids and repeats** (PROF1's law, AUDIT 30's lines): every post, delivery, fill and guild Stores move is a row keyed
  `(account, rid)`, looked up before the switch and answered `repeat` (AUDIT 31 R7: the record said every act - a
  writ's withdrawal and a commission's cancel or decline answer their repeat off the row's own state, and a budget is
  a set);
  every ledger line under its own suffix (`:wesc`, `:wpay`, `:wtax`, `:cesc`, `:cpay`, `:ctax`, and the service's own
  `writ-return:<id>`, `commission-return:<id>`), a plain INSERT; each decision refuses an id whose line the ledger
  holds (`prof-rid`).
- **The weekly report** counts the Marks in escrow from the ledger's own escrow end (what went in, less what came out)
  - so the orders', the bids', the guild writs' and the commissions' are one number.
- **The service** is `acct28` (`acct29` after AUDIT 31); `0034_writs.sql` holds the guild writs and their deliveries, the writ budgets, the guild
  Stores and their ledger and moves, the commissions, and the notes' rebuilt button; the ledger's six new kinds each
  move Marks (`writ-escrow`, `writ-pay`, `writ-return`, `commission-escrow`, `commission-pay`, `commission-return`).
- **Done when**: a Guildmaster posts a writ for 100 Oak Logs at 3 Marks each in Daggerfall; an Officer posts one within
  the budget and is refused past it; an outsider delivers 40 and a member 60 - each paid pro rata less the tax, the
  writ filled, the logs in the guild Stores; an Officer withdraws them bought, and the member's own deposit comes back
  own to the member (AUDIT 31 R1: this line said the member withdrew them - a Member could not); a
  crafter advertises with a note, a reader commissions a Mithril Longsword of Fine or better through its button, the
  crafter fills it with a piece of their own make and it reaches the poster's pack, its owner moved, the crafter paid
  less the tax - through the real Worker.

As built:

- **Behind the professions' and the Marks' switches** - no switch of its own; the guild Stores the professions' alone.
  The service is `acct28`, its tables `0034_writs.sql` (section 14's lines, BUILT); eleven routes (`/v1/writs/post`,
  `supply`, `withdraw`, `budget`, `commission`, `fulfil`, `cancel`, `decline`; `/v1/stores/guild`, `guild-deposit`,
  `guild-withdraw`, `server-account/src/writs.js`), and `/v1/writs/list` answers this region's guild writs and
  commissions, "yours" and the reader's guild with its budget beside the Court's. Every act one statement keyed on its
  nonce; a withdrawal, a cancel and a decline answer their repeat off the row's own state, a budget is a set.
- **A guild writ's decision** asks the poster's rank again in SQL (an Officer demoted while the post is asked is
  refused), the treasury, the twenty and the Officers' week; **a delivery's** the writ's running total the tax was
  taken on (two deliveries at once: the second is refused `writ-moved` and read again), the Stores, the guild Stores'
  room across every row, and the Marks cap. **A withdrawal from the guild Stores** takes, in one UPDATE over a window
  of the rows, the withdrawer's own deposit, then the guild's, then the others'.
- **The law** is `src/net/writLaw.js` (pure, both ends), the ranks' three powers with it (`WRIT_POWERS` - FOUND: the
  relay bundles `guildLaw.js`, so a power set there moved the relay's law for bytes it never reads); the note's fourth
  button `boardLaw.js`'s; the ledger's six new kinds `marksLaw.js`'s, each a move.
- **The window**: the Work tab's sections under the Court's cards (`ui/workTab.js`, through its own one-at-a-time door
  in the board's window), a card as narrow as its column at a phone's width; the Guild tab's Stores and writ budget
  (`ui/socialPanel.js`). The book is `net/writBook.js`: a commission's piece out of the save before it is asked, kept
  until answered, put back on a refusal, settled on the Work tab's first showing; its answers tell the Marks book and
  the professions' book. A filled commission's piece reaches its poster by PROF5's delivery, collected by the market's
  book.
- **FOUND and fixed in the build**: the Court writ's word said "Herbalism XP" for every writ since PROF2 (the answer's
  track names the profession); the weekly report's escrow was the buy orders' column, which never counted PROF5b's bids
  (now the ledger's escrow end); a commission's fill wrote its piece's delivery and its lines `FROM commissions WHERE
  EXISTS (...)` - every commission row while the guard held (caught by the refusals pin before it shipped); dropping
  `board_notes` for its rebuild would have cascaded its reports away (they ride a copy across).
- **Pinned**: `test/net/prof6_law.test.js` (4), `test/net/prof6_service.test.js` (7), `test/net/prof6_client.test.js` (7);
  `tools/mutants/prof6.json`, 77 mutants, 76 dead and one recorded equivalent (the budget's early rank word, whose
  decision asks the rank itself). The done-when is `prof6_service`'s DONE WHEN, through the real Worker; `prof6_client`'s
  the books'.
- **The four hosts** (17.1 - AUDIT 31 H7: this section did not say): the streaming world wires the Work tab's guild
  writs and commissions (the board's region, the writs' book, the pieces that answer a commission - pack, home's
  things, wagon, a repairer's hands), and the Guild tab's guild Stores wherever the social panel opens; the fixed city
  keeps DFU's board (NOTICE1's flag); the interiors and dungeons have no boards.
- **AUDIT 31** (Online-Arc "AUDIT 31") corrected this section in place, each line marked; its pins are
  `test/net/audit31_law.test.js`, `test/net/audit31_service.test.js`, `test/net/audit31_client.test.js` and
  `test/ui/audit31_tabs.test.js`, its mutants `tools/mutants/audit31.json`.

## 29. PROF7 - Hunting, the Skinning Knife and Outfitting, as built (SHIPPED 2026-09-30, live since SWITCH-ON)

Mac: **"Do it"** (2026-09-29, PROF7 after the VEIN-NEED fix: "What was next on the list for the arc"). What sections
3.3, 4.4, 4.5, 5.2, 6, 9.3 and 9.4 left open for PROF7, DECIDED here, and what was found (FACT):

- **What PROF7 is.** 15's row - "Hunting (the trace), the Skinning Knife (603: its template, its online shelves - law
  6's exception, for 603); Outfitting" - whole: a body skinned where it lies, its hide, part and butchery into the
  Stores; the knife made, shelved online and worn; the tanning rack's cures and the loom's weave; Outfitting's
  recipes (9.3) with the stitch (9.4) and a garment's dye; and the pieces they wait on elsewhere - the Bear Hide the
  Ram Kit names (25), the Harpy Feathers 9.3's arrows name, the Fishing-Net 9.3 names Outfitting's. Not here, named:
  **Trophy Hunter** ("a trophy decor piece from a tier 5+ kill"), **Couturier** ("two-colour dyes") and **Saddler**
  ("a wagon upgrade of +100 kg") are named and never chosen (`later`, as the Motherlode Sense is and the Siegewright was until SEAT2b part two) -
  FACT: DFU gives each nothing to stand as - no trophy piece exists among its templates; a DFU garment takes ONE dye (its
  `dye` field, `systems/item/itemDye.js`); DFU's wagon has one limit, the Horse Cart's. Each waits on Mac's word for what it
  should be.
- **The switches**: none of its own - the professions', live for everyone since SWITCH-ON (`PROFESSIONS_OPEN = "on"`).
- **"A body your own blow felled"** (5.2). FACT: no body records its killer - the loot handlers hear a death with no
  killer (`systems/playerKills.js`), and the one "my blow killed it" signal is `reportPlayerKill` (the street's, the
  dungeon's and the watch's damage doors, and a puppet's owner's `slain` word). DECIDED: a foe 4.4 skins is **stamped
  at that signal** (`scenes/huntHost.js` createBodyStamps) with the UTC day on the shared clock and twelve hex digits
  from the crypto source - its node key `body:<day>:<id>` (`net/nodeLaw.js` bodyKey, read in its one spelling). A body
  another's blow felled is DFU's corpse alone.
- **Bounded, not witnessed** (6): the id is the client's word and the tier the foe's the client names (`foe`, its
  MobileTypes value, or since DEX-HIDES the Enemy Expansion's id - AUDIT FB1021 L4-3); the account's day - ~~**30 hides,**~~ **3 of tiers 5-6** (CAP-OFF, 2026-10-07: the thirty gone, the three kept) - is
  the whole defence, **decided in the harvest's own INSERT** (the day's rows of `profession = 'hunting'` an account, its high ones by a new `tier` column -
  AUDIT 32 L2: their units, the hides, a clean pelt's second among them, the last skinning cut to the day's room; it
  counted the rows, the bodies, so a day ran to 60 hides and its rare three to six).
  A body names no ground, keeps no hours (FORAGE0 14.3: "not Hunting (the knife is not Foraging's, and foes die at
  night)") and writes no witness. ~~The character's 60 and the account's 120 bound it too, and never bite first.~~ (CAP-OFF, 2026-10-07:
  no day's cap bounds it.)
- **Where a body is a node**: the street's pool, a dungeon's and (INDOOR-SKIN, below) a building's, in the one
  gathering host. A body is a
  **LOOSE node** (`GatherKind.looseNodesOf`): it carries its own place - the corpse marker's ground on the street
  (`exteriorFoes.corpseAt`, the corpse lens's one home - DT1's law), the feet in a dungeon - which the floating origin
  moves under it; an act finds its body again by its key every frame and ends when its pool lets it go. AUDIT 32: a
  dungeon's body lies where its corpse landed (`dungeonContext` corpseAt - a flyer's node stood in the air it died in,
  H3); a dungeon with no identity (every spawned one) is one the host stands in, its bodies nodes and no veins (H2); and
  a body LAPSES at the UTC day's turn, as the service lets its key (`prof-day`) - it stood as a node after midnight, every
  trace wearing the knife for a refusal, and a body skinned before it stood ready again (B1).
- **A node only for the one who can skin it** (DECIDED): a body stands as a node while the pack holds a Skinning Knife -
  DFU's corpse first, so a player with no knife meets no prompt in the way of the loot. **E skins; the act choice key
  searches the body instead** (DECIDED: 4.4, "DFU's own corpse loot is untouched: skinning adds, never replaces") - the
  press handed on to the loot's own door, nothing said. AUDIT 32: the search opens the body's loot through its pool's
  door by its key (the ray's missed the corpse's box at the look's edge), and is never offered on a body with nothing to
  search (H8); a body in a settlement or at sea is no ready node - the knife's checks of the ground are the plan's, and E
  goes on to the loot (H4, AUDIT 29 C1's law); a body is reached as DFU reaches its corpse (3.75 m from the eye - it read
  2.5 against the eye's height, and a body a metre downhill or under a rider was none), and one the player stands over,
  whose line the look cannot reach, asks a step back (H7); a click mid-act is the act's, never the loot's (H5).
- **The trace** (5.2: "a dotted line of 5-9 points over the carcass; draw the knife along it (mouse; the right stick
  moves a cursor; a finger on the touch layer)"). DECIDED: **the crosshair**, as the Pick-Axe's glint reads it - the
  mouse, the right stick and a finger's swipe all turn the view, so one trace serves the three. **E held** draws it, as
  the Sickle's steady hand holds E - FOUND: attack held would be the weapon's: DFU's swing modes hold the look still
  under a held attack (`player/lookFilter.js` swingSuppressesLook), and the swing reads its raw button, never the
  binding (ROAD-Ar R10's pin). `4 + tier` points (5 at tier 1, 9 at 5 and past) across 14 degrees of the body's face,
  a zigzag of up to 3; begun within 2.5 degrees of the first point, each point passed in its turn; the tolerance **3
  degrees at Novice, half again at Master, x the knife's band** ((INT + AGI) / 2, FORAGE0 14.4), measured every quarter
  degree along the line the crosshair drew (AUDIT 30 A1's chord law: a jump between two frames is scored, never a free
  leap) - of the trace's PROGRESS (AUDIT 32 L1: the line runs left to right, so its yaw; a frame held still or a wiggle
  over drawn ground adds nothing, and the clock starts at the first move along the line - it sampled every frame from the
  press, so a press held still and one flick was a clean pelt, and a score hung on the frame rate). A trace scoring **0.8** or more in **0.6-6 s** is a clean pelt; under **0.4** it is torn; let go before the last
  point, a slip, and the trace starts again. Gentle acts: E held 1.2 s, plain. The hand: DFU's Dagger (FORAGE0 14.2).
- **What the act buys** (5.1's bound). FOUND: 5.2 says a clean pelt is "one quality step up" and a torn one "yields 1
  less" - a hide is a Stores material and carries no quality, and one less than a yield of one is nothing (5.1: "a
  missed moment gives less, never nothing"). DECIDED: the act's other bound, the yield's - **a clean pelt x1.5**, the
  half a unit the service's dice (FORAGE0 14.4's fraction law: 1 x 1.5 is one and a 50% chance of a second); **a torn
  pelt loses its DFU part**. The service reads `{ clean, torn }` and nothing else; a report claiming both is neither.
- **The part** (4.4's "a chance of the DFU ingredient"): DECIDED **one body in four**, the service's dice, carried as a
  gem is (the day's harvests' `gem`): Big Tooth (the Bear, the Tiger), Spider's Venom, Giant Scorpion Stinger, Dragon's
  Scales - DFU's own ingredients in their own groups, at their price's tier (the gems' bands, 23).
- **The butchery** (4.4: "Butchery gives C&C's Raw Meat either way"): DECIDED **one Raw Meat** into the Stores
  (`food:meat`, a food as the Basket's; **a Butcher's two**, 3.3) of C&C's own animals - FACT, `survival/loot.js`
  MEAT_BY_TYPE: the Rat, the Giant Bat, the Grizzly Bear, the Sabretooth Tiger, the Spider, the Giant Scorpion; its
  FISH_BY_TYPE's Slaughterfish gives **Raw Fish** (`food:fish`, withdrawn as 5.2's Fishing will be: C&C's Raw Fish
  while C&C is on, else Foraging's Fish); the Harpy, the Dreugh and the Dragonling none, as C&C gives their bodies none.
  Raw Meat withdraws as C&C's either way. The butchery rides the day's harvests' `extra` with its count (`extra_qty`).
- **A Butcher's meat "spoils half as fast"** (3.3). DECIDED: the Stores keep no unit's maker, so **meat a Butcher
  withdraws is a Butcher's** - marked `slowRot` (a declared item field, riding the save), which C&C's day of rot rolls
  every other day at half its days (`survival/food.js` rotFoodDay): the same spoiling at half the pace.
- **The Tracker** (3.3: "Animals within 100 m are marked"): the living foes 4.4 skins within 100 m of the player, on
  the street, on the compass beside a Prospector's veins - one mark, the veins' copper (the compass keeps one mark for
  the professions). NODE-MARKS (section 31) since: each profession its own colour, the animals in Hunting's coral.
- **The knife's checks** (FORAGE0 14.3): the settlement, the sea, a foe near, the load - Foraging's order - in its own
  lines in Foraging's voice ("You cannot skin in a settlement!", "... out here!", "... with enemies nearby!", "... when
  fully encumbered!"); never inside and never the daylight - AUDIT 32 H6: underground, the dungeon's own foes are the
  foe near (the host answered none there, for the knife and PROF2's dungeon Pick-Axe alike). Foraging's check law is one home (`foragingLaw.js`
  checksRefusal): the knife names its order and its lines (`professionLaw.js` KNIFE_CHECKS, KNIFE_REFUSALS).
- **The Skinning Knife** (603, 4.8; FORAGE0 14.2): registered with the professions' rows (`systems/professions/profTemplates.js`) -
  UselessItems2, rarity 10, one to a slot, **0.5 kg, 50 uses, 100 gold**, DFU's Dagger's picture (TEXTURE.207 record
  5); **shelved online only** by DFU's own custom-item loop - General Stores and Pawn Shops, as Foraging's six are
  (law 6's exception, for 603); **made at the anvil** (9.3: 1 Iron Ingot, 1 Pine Plank, rank 0), its quality its life;
  worn one an act, as Foraging's tools. FOUND: Foraging's break line named only its own twelve - a tool not Foraging's
  now breaks by its own name ("Your Skinning Knife broke.").
- **The hides, the leathers and the cloth as items** (4.8): 655-664, 665-666, 668-671 registered, stacking, never
  shelved; withdrawn as their templates. FOUND: 4.8's "DFU Small Skins", "Large Skins" and "Small Tapestry" have no
  picture (DFU's furniture carries world texture 0/0), so a pelt borrows Nymph Hair's lock (TEXTURE.254 record 55),
  silk Mummy Wrappings' (41), a scale, chitin or shell Fairy Dragon's Scales' (37), a feather Gryphon's (53), and a
  leather and a bolt a dropped garment's own flat (TEXTURE.204 record 0) - unverified without the player's data, the
  woods' open flag holding both (Home.md). A hide 1 kg (Spider Silk and Harpy Feathers a quarter), a bolt half; 8 x
  the tier's Marks value in gold, a leather's and a Silk Bolt's half again. **Every Stores material has a pack form
  now**: Cured Leather, the Bear Hide, Linen and Wool withdraw (NO_PACK_FORM empty; PROF3-PROF5's "stays at the bench"
  retired, its gate kept for a material to come). Standard-bearer's Silk (671) is registered and **unyielded** - a
  siege's Spoils (4.7) - so the market refuses an order for it and a commission of its garments; the Bear Hide leaves
  that list.
- **The loom and the tanning rack** (9.3: "a tanning rack or loom: a home station, or any Clothing store for 50 gold"):
  ONE station (DECIDED: 9.3 names them one place) - **a Clothing Store's, open for trade, 50 gold** a craft, a cure or a
  weave (the tailor's), or **a home's `loom` station** (50,000 gold, DECOR_STATIONS' sixth, as the workbench); the
  Stores page's **Loom** beside the Anvil and the Workbench. The Weavers' Linen and Wool (4.5) are bought at a
  Clothing Store's loom where the Stores are short, the Weavers' counter named.
- **The cures** (4.4): **two hides a leather** - tiers 1-3 Cured Leather, 4-6 Hardened; **a Tanner's two a unit**
  (1:1). FOUND: a work's raising choice was read at 100 alone (PROF4's `workPer` over the choices at 100) - the Tanner is
  a choice at 50; a work names the rank its choice is made at now (`more.rank`, `workSpecRank`). **Spider Silk is woven**
  (4.5: three to a Silk Bolt), never cured; **Harpy Feathers fletch** (9.3's arrows), never cured. No XP - a hide's was
  its skinning's, as a log's was its fall's (25).
- **Outfitting's recipes** (9.3), the anvil's law at the loom (`net/recipeLaw.js` OUTFITTING_RECIPES, 334):
  - **Leather armour**: DFU's seven body pieces at **Leather** (ArmorMaterialTypes 0 - FACT: DFU has every one in
    leather) - Cuirass 6, Greaves 4, Helm, Pauldrons, Gauntlets and Boots 2 - in **Cured Leather** (tier 2, rank 10) or
    **Hardened Leather** (tier 5, rank 55), whose step (9.3: "the tier 4-6 leathers' step") is a quality step, one with
    a Warforged ingot's or a Heartwood's, never two.
  - **Clothing**: **DFU's 76 garments** (the men's 141-181, the women's 182-216) **in each cloth** - Linen, Wool, Silk,
    Standard-bearer's Silk, the cloth's tier the recipe's; **a small garment a bolt, a middle two, a large three, boots a
    bolt and a Cured Leather** (DECIDED for the four 9.3 does not name: the Loincloth small, the Wrap and the Peasant
    Blouse middle, the Toga large); DFU's look-alike shirts told apart by their own enum names. The loom shows the
    player's own clothing first, as DFU's Clothing Store shelves it, and both.
  - **Rugs 3 Wool, tapestries 4 Wool** (DFU's 237-243) - FOUND: 9.3's "+ a dye" has nothing to colour, DFU's furniture
    takes no dye; **Large Skins 2 and Small Skins 1 of a pelt** (244-245; a fur's hide - the Rat's, the Bat's, the
    Bear's, the Tiger's, and DEX-HIDES' Wolf's and Boar's (FIELD BUGS 2026-10-20h); never silk, chitin, scales, feathers or
    shell). Among the home's things, as PROF4's furniture.
  - **The Fishing-Net** (FORAGE0 14.7): 2 Linen Bolt, rank 0 - Foraging's own 1603, its quality its life.
  - The steps (9.2): **a Tailor's clothing, a Leatherworker's leather armour**; Outfitting XP 20 x the tier, +500 the
    first, under the crafter's limit - AUDIT 32 S1 (Mac: "Whatever you think is best"): none for the 152 made wholly of
    Linen and Wool (3.2); a boot's Cured Leather, Silk and the skins keep it.
- **A garment's dye** (9.3: "Dyes: itemDye.js's colours"): **DFU's ten clothing dyes** (DyeColors 0-9), chosen at the
  loom, asked with the craft, **signed into the piece's record** (`u`, `net/productRecord.js`), kept on the craft and
  the piece (`dye`), answered, and carried by the market's pieces - a garment is the colour it was sewn in wherever it
  goes. Undyed, it reads DFU's Unchanged; ~~DFU's four unchangeable shirts (178, 179, 214, 215) take none~~ AUDIT 32 L3:
  every garment takes one - "unchangeable" is DFU's word for a garment whose variant Use never changes, and DFU's shelf and
  loot dye those four as any other; a dye asked of
  anything else is refused (`prof-dye`). DFU's shelf mints clothing its variant then its dye, and so does the loom: the
  variant the record's seed's.
- **The stitch** (9.4: "presses on a beat, eight in a row"): the needle's beat every **0.75 s**; a press within **0.2 of
  the beat, centred on it, x (AGI + SPD) / 2's band** (DECIDED: a quick, sure hand) is on the beat; **eight presses**,
  each 0.25 s at least after the last; all eight on the beat a clean act - a step. Space, Enter or the Stitch button;
  Quick craft and Gentle acts as the heat's. The stitch makes the recipe, and the dye, it began on (AUDIT 30 A3's law).
  AUDIT 32: a press is judged at its own moment, not the last frame's, and the Stitch button (the heat's Strike too) on
  the pointer's down - a tap on the beat was scored 90-150 ms late, on its release (P1); a held key's repeats are no
  presses (P4); one act a page - a home's anvil and loom both under one Space struck and stitched at once (P2); the
  loom's cures wait while it sews and a craft in flight keeps Craft held (P5); Escape sets the needle down before it
  closes the window (P12).
- **The Harpy-feathered arrows** (9.3's own fletching, waiting since 25): 1 Pine Plank, 1 Iron Ingot, 1 Harpy Feathers
  - twenty. FOUND: "4 Twigs, one step lower" has no step to be lower by - arrows take no quality (25) - so both
  fletchings make the same quiver.
- **The market**: the loom's three families list - **Leather Armour, Clothing, Furnishings** - and a commission may
  name them (its piece's dye any the crafter sews).
- **The service** is `acct33`; `0036_hunting.sql` rebuilds the day's harvests for the kind `hide`, the tier the harvest
  was decided at and its second find's count (every row before it carried, tier 0, one), and gives the crafts and the
  pieces their dye (`CHECK 0-9`). Refusals: `prof-foe` (400: no knife skins that body), ~~`prof-hunt-cap`,~~
  `prof-hunt-high` (409: the account's day), `prof-dye` (400). The state answers the account's day (`hunt`) and its
  bounds (~~`caps.hides`,~~ `caps.highHides`) - CAP-OFF, 2026-10-07: `prof-hunt-cap` and `caps.hides` are gone with the thirty.
- **Done when**: a bear felled by the player's own blow is skinned online with the knife - its line traced, DFU's Dagger
  in the hand - its hides cured at a Clothing Store's rack (a Tanner's 1:1) and sewn into a Leather Helm in the pack,
  and a shirt in the dye its sewer chose, of the Weavers' Linen; the butchery withdrawn as C&C's Raw Meat - through the
  real Worker.

As built:

- **Live**, the professions' switch - no switch of its own. The service is `acct33`, its table changes
  `0036_hunting.sql`; `/v1/prof/harvest` takes a body (its `foe`), `/v1/prof/smelt` the loom's cures and weave,
  `/v1/prof/craft` Outfitting's recipes and a garment's `dye` (`server-account/src/professions.js`); the market's pieces
  answer their dye (`market.js`). The harvest's one statement decides Hunting's day beside the character's and the
  account's caps; a body's hide, part and butchery go in by its nonce.
- **The law**: `net/professionLaw.js` (the hides, parts, leathers and cloth; Hunting's numbers; the trace's; the knife's
  checks; the loom's works), `net/nodeLaw.js` (a body's key, its yield and its finds), `net/recipeLaw.js` (Outfitting's
  recipes, the steps, a garment's dye, the stitch), `net/productRecord.js` (`u`). The acts are `systems/traceAct.js`
  and `systems/stitchAct.js`, pure.
- **The client**: `scenes/huntHost.js` (the stamps, a pool's bodies, the plan, the kind, a Tracker's marks) in
  `scenes/gatherHost.js` (loose nodes: a kind's own places, the act following its body, the harvest's `ask`, the chip's
  tally); the trace's meter on the HUD (`ui/professions/profHud.js`); the Loom on the Stores page and Hunting and Outfitting
  practised on the Professions page, Hunting's day the account's (`ui/professions/profPages.js`); the knife's row, shelves and mint
  (`systems/professions/profTemplates.js`, `systems/smithItems.js`); the hides, parts and butchery withdrawn (`systems/professions/profItems.js`);
  the wiring in `scenes/world.js` (the kill listener, the street's and the dungeon's bodies, the loom's provider, a
  craft's station by its profession, the Weavers' counter by name, a Butcher's meat, the Tracker's marks) and
  `scenes/worldModes.js` (`loomHere`).
- **FOUND and fixed in the build**: the Professions page's Smithing unlocks lost Silver, Elven and Dwarven, and Mithril
  to AUDIT 30 U19's note, a comment run over the rows (no pin read the list); the book never applied a harvest's
  `extraStore` (PROF4's Resin stood unseen in the Stores tab until the next read); a body's harvest bound its absent
  region into the witness statement - D1 binds no `undefined` (caught by the service pin before it shipped). A craft's
  station, its keeper, its words and its kept line are one table now (`world.js` craftStation), where the anvil's and
  the workbench's were two branches of every sentence.
- **Pinned**: `test/net/prof7_law.test.js` (11), `test/net/prof7_service.test.js` (7), `test/systems/prof7_client.test.js` (9);
  `tools/mutants/prof7.json`, 119 mutants, 118 dead and one recorded equivalent (the witness's `!isBody`, which the
  witness table's NOT NULL key also holds). The earlier lists re-aimed by content where PROF7 moved their code (twenty),
  and two of PROF3's recorded equivalent: its "the stock is never withdrawn" gate has nothing left to refuse. The
  done-when is `prof7_client`'s DONE WHEN, through the real Worker.
- **The four hosts** (17.1): the streaming world wires it all - the street's bodies, a dungeon's and (INDOOR-SKIN,
  below) a building's, the loom, the Tracker; the fixed city and the standalone dungeon stand no professions (22's
  law), and a body felled there is DFU's corpse.
- **For Mac**: what Trophy Hunter, Couturier and Saddler should stand as; whether the borrowed pictures read right
  (the woods' open flag).
- **INDOOR-SKIN** (FIELD BUGS 2026-10-07, "Cannot skin indoors": "When doing a Fighters Guild quest to kill giant
  rodents, their bodies are not able to be skinned"). The Fighters Guild's Hunt for Giant Rodents (`M0B00Y15`) places
  its house `local random` and stands its Giant Rats and Giant Bats in it - DFU's Rat and Giant Bat, Rat Pelt and Bat
  Leather. FACT: the building's foe pool (`worldModes.js` makeInteriorFoes, the street's own `createExteriorFoes`)
  told the player's kill, so the body was stamped; three seams then lost it. The world host listed Hunting's bodies
  from the dungeon's pool or else the STREET's, so indoors it searched the street's dead; the gathering host was live on
  the street (`active`) and underground (`activeDungeon`) alone; and the building's ladder (`tryExit`), plaque and rig
  offered nothing to a profession. Indoors a body was DFU's corpse and no more - section 29 had put the question to Mac
  above, and the field answered it. DECIDED: a building's bodies are nodes as the street's and a dungeon's are. ONE
  seam picks the pool by the mode - `huntHost.js:"export function bodiesHere("`, the street's, a dungeon's or a
  building's (`worldModes.js` hands `interiorFoes` and `openInteriorBody`, the building's body door, which its ladder's
  corpse arm now shares: `worldModes.js:"function openInteriorBodyLoot(lootKey, pileKeys = null) {"`). The gathering host
  takes `activeInterior` (`gatherHost.js:"const indoors = () => !inDungeon() && !!deps.activeInterior?.();"`): indoors
  it stands the building's loose nodes alone - never the street's pixels round the house - sees them through the
  building's own walls (`clear`'s fourth argument), and an act begun there ends under a window or at the door. The
  building's ladder takes tryExitDungeon's three arms and its VEIN-NEED foot, its plaque picks and names a node over the
  race's winner, its rig draws the knife and holds the swing off an act's press. The knife's checks stand as they were:
  in a house in town the settlement's check passes (it asks `mustBeOutside`), and a live rat in the room is "enemies
  nearby". THE FOUR HOSTS: `world.js` (the street) and `worldModes.js` (a building; a dungeon through
  `dungeonContext.js`, unchanged) skin; `exterior.js` - FLAGGED by name: the fixed city stands no professions. NOT DONE:
  a building's body is no NODE-MARK - neither on the compass nor in the glow (`world.js` nodeMarksAt keeps "null in a
  building"), and a Tracker marks the street's animals alone. Pinned: `test/systems/quest/fb1007_indoorskin.test.js` (4) - the
  quest's own Foe resources parsed from the vendored script, stood by the real pool's `spawnFoe` as
  tryPlaceInteriorQuestFoe stands them and felled through its damage door; `tools/mutants/fb1007_indoorskin.json`, 13
  mutants, 13 dead. Re-aimed by content: fifteen records of ten lists (the dungeon's three ladder arms and its VEIN-NEED
  foot now stand a twin above them in the building's ladder) and the pins of `prof7_client`, `audit32_client`,
  `worldhover`, `lootstack`, `audit29_host`, `fb0930b_toolsaid` and `fb1001_audit` that read the moved lines (the
  dungeon's ladder pins read from `tryExitDungeon` down now, where the building's twin stood first).

## 30. PROF8 - Fishing with the net, as built (BUILT 2026-09-30)

Mac: **"Continue the arc"** (2026-09-30, after GOLD-MARKET), and **"XP follows your rank"** (the one call this section
asked). What sections 5.2, 6 and 3.3 left open for PROF8, DECIDED here, and what was found (FACT):

- **What PROF8 is.** 15's row - "Fishing with the net (the throw, the tug, the haul)" - whole: a haul of Raw Fish from any
  water the net works in, its species named, the sea's Pearl and Slaughterfish, the day's schools, a trophy; the Fishing
  track and its four specialisations practised; the page's day and how.
- **XP FOLLOWS THE RANK** (Mac). FACT: every haul is Raw Fish, tier 1, and `harvestXp` quarters a tier more than two below
  the rank's own - worked at its catch's tier, a rank 55 haul earned 3 XP, and Fishing would never have climbed. DECIDED:
  a haul is worked at the highest tier the rank opens (`professionLaw.js` haulTier, `topTierOf`): 15 XP a Novice's, 75 a
  rank 55's, 105 a Master's; a full net x1.5.
- **Bounded, not witnessed** (6). A haul names no node: its key is the client's own, `haul:<x>:<y>:<day>:<id>` - the map
  pixel cast from, the UTC day, twelve hex digits drawn at the cast (`nodeLaw.js` haulKey, read in its one spelling). The
  service reads the pixel's ground (the witnesses' confirmation for the sea's finds), the day (~~the daylight, every haul,
  07:00-17:59 on the shared clock - `prof-night`~~ - RETIRED, ANY-HOUR: no hour is refused), and ~~**forty hauls an ACCOUNT a day**, decided in the harvest's own
  INSERT (`prof-fish-cap`)~~ (RETIRED, CAP-OFF, 2026-10-07: no day's hauls). A haul from an account a week old witnesses its pixel, as any harvest's does - so the sea's
  pixels come to be confirmed by those who fish them.
- **The catch** (5.2). Raw Fish (`food:fish`) into the Stores as own, 1-2 a haul; in 6's order: the roll, a full net's
  x1.5 (the act's bound), a march's +25%, a school's fish (a Netter's two), a Slaughterfish's weight; the fraction a
  chance (`haulYield`). The finds (`haulFinds`): **at sea** - the Ocean's climate, or the sea coast's region, as the
  net reads it (`haulAtSea`; Foraging's `SEA_REGION` now the law's one home) - **on confirmed ground**, a **Pearl** 1 in
  50 (a Pearl Diver x3, a Deep-Sea x2) and a **Slaughterfish** 1 in 100 (a Deep-Sea x2) - its Scales (PROF7's hide) and a
  fish more; a **trophy** 1 in 200 anywhere. FACT: DFU's Pearl is template 77 (MiscellaneousIngredients2, 150 gold) -
  a Stores material now (`PEARL`, tier 5 by its price's band), withdrawn as DFU's own and listed on the market.
- **The species** (5.2): Deep Waters' own for the pixel's water - `pickSpecies` over `PASSIVE_FISH_SPECIES`, the climate
  by `climateToBiome`, half-way down the water column - drawn from the haul's KEY on the client (`fishHost.js`
  speciesOfHaul), so every answer to a haul names the same fish ("+2 Largemouth Bass, as Raw Fish"). FACT: the species
  module imports the scenes' draw and the loot tables, which the Worker must not bundle - so the species is the client's
  word, as its toast and its trophy are; the Stores keep Raw Fish whatever it was.
- **A trophy**: the service says it (`trophy`, a column of `node_harvests`, said again to an answer asked twice); the
  client puts the species' own Deep Waters item in the pack (`deepWatersFishItems.js` createFishItem) - once a haul,
  however many answers say it. It is an item the game already lets a player take from the water.
- **The schools** (6): two a pixel a day, each at the first of 24 spots the clock draws (`schoolSpots`) that falls on a
  water tile - a pixel with no water stands none; stood as three of Foraging's Fish item's own world picture on the water
  (1605's template, DFU's TEXTURE.211 - as an herb patch stands its plant's; FOUND: not Deep Waters' fish, which the port
  draws from the mod's own pictures), and said in the prompt's words ("a school rises 14 m north"). Never a target: a cast that lands within 10 m of one is a school's haul - the act's report names it (0 or 1),
  the service reads nothing else of it (`netOf`), and the day's forty bound it.
- **The act** (5.2; `systems/fishAct.js`): E starts it and, held, winds the net (0.3-1.5 s, 3-12 m); let go, it flies;
  the wait (5-30 s, halved at 07:00 and 17:00 on the game clock, doubled in thunder); the tug - a new press of E, or
  attack, inside 600 ms (an Angler's 840), the phone buzzing where the touch layer's haptics are on; the haul - the net's
  weight wanders the bar, E held raises the tension band (20% of the bar at Novice to 30% at Master, the net's
  attribute pair - Intelligence and Agility, Foraging's own - widening it), let go it falls; the weight kept inside for 6 s
  (OPEN) fills a full net; 2 s outside in all, or 20 s unfilled, and it comes in plain. A missed tug is a plain net,
  never nothing. Gentle acts: a plain net after the wait. DECIDED: E, not attack, is the act's key throughout - the
  gathering host hands an act E's level and attack's edge alone, and every other act's hold is E's.
- **Where** (5.1): the cast stands just ahead of the look while the pack holds an unbroken Fishing-Net and the player
  stands in the net's water (Foraging's own `netHasWater`: in water, swimming, at sea); never underground, and never
  while the hands are the ship's (HELM-NET, FIELD BUGS 2026-10-02, Cruor: "Gets in the way especially when trying to aim
  bow guns" - the kind's host `busy`: a helm, laid guns, a boarding; a deck stood on still fishes). The cast's own point
  is over water the feet would swim in (SHORE-CAST, FIELD BUGS 2026-10-05) and at the water's level: no more than
  CAST_OVER_WATER_M (5.5 m) over the surface under it (HIGH-CAST, FIELD BUGS 2026-10-07, the Discord: "fishing popup
  shows up wayy too early" from a cliff over the sea, and "I couldn't get it off my screen when on my ship") - so a deck
  fishes looking down over the side (the carrack's, the highest, stands its lowest cast 5.01 m over the sea), a level
  look from a ship's high deck and any look from a cliff stand none, and the shore's level look still does. Its prompt
  says the ground's refusal first (in here, a settlement, the dark), the account's forty, the Stores' room; the start asks
  Foraging's full checks for the net, with its own lines ("You cannot fish with enemies nearby!").
- **The service**: **acct41**, migration `0042_fishing.sql` (`node_harvests` rebuilt: the kind `fish`, and `trophy`). The
  state and every haul's answer say the account's hauls today.
- **Found and FLAGGED, not built here**: the net is not drawn in the hand (5.1's "the item's own picture" on the classic
  lane - the act's `hand` is none, as the Basket's).
- **Pinned**: `test/net/prof8_law.test.js` (7), `test/net/prof8_service.test.js` (3, through the real Worker), `test/prof8_client
  .test.js` (12). Mutants: `tools/mutants/prof8.json` (34, all dead).

## 31. NODE-MARKS - every node on the compass, and its glow, as built (BUILT 2026-10-01)

Mac: **"Any profession node, like herbs, should appear on the compass. The node itself should also stand out with a
detailed slight glow or something."** FACT: the compass marked a Prospector's veins (PROF2) and a Tracker's animals
(PROF7) alone, in one copper; nodes are sparse (13 a wilderness pixel a day at most, 0.67 km² - section 6's counts), so
a player without the two specialisations walked past patches, veins and trees with nothing to say they stood there,
and nothing in the world set a node apart from the ground about it. DECIDED here:

- **Every node, one door.** The gathering host answers the nodes standing near the player (`scenes/gatherHost.js`
  `marks(feet)`): above ground the stood pixels' (those within 256 m), underground the dungeon's veins in its own
  space, and the loose nodes of a kind that marks them (`marksLoose`: Hunting's bodies) where they lie - never
  Fishing's cast, which is the look itself and whose water's check is Foraging's whole world, asked a frame - each `{ key, profession, at, w, h, d, reach }`, its
  BASE in the scene (never the look's lift), nearest first, `NODE_MARK_MAX` (16) at most; one list, refilled. The
  professions shut, none. A building: none (the host's `nodeMarksAt`); under the travel view the compass keeps them and
  the glow alone is off (AUDIT, below).
- **Each kind says its own** (`GatherKind.mark(node, { specs })` -> `{ w, h, reach? }` or null): its glow's footprint
  about the base and how far off the compass marks it (`NODE_MARK_M`, 150 m, without a reach). A patch while either of
  its harvests stands (`PATCH_MARK`); a vein, a boulder and a dungeon vein while unmined (`MINE_MARKS`) - **a
  Prospector's veins from 200 m** (`PROSPECT_M` - 500 since MINE-PERKS, section 43, a dungeon's `PROSPECT_DEEP_M` 200; PROF0 3.3: the specialisation keeps its edge, now the mine kind's
  word, and a dungeon's vein is a vein); a standing tree, never a felled one's stump (`TREE_MARK`, up its trunk);
  Fishing's day's schools - where the fish are - and never the cast, which is the look itself (`SCHOOL_MARK`, wide and
  low on the water); a body while its hide is untaken and the pack holds the knife (`BODY_MARK`). A kind that names no
  mark is marked in `NODE_MARK_SIZE` while it is not gone.
- **The colours** (`ui/nodeMarks.js`, a leaf both the HUD and the glow take): Herbalism a blossom's orchid `#e586ec`,
  Mining PROF2's copper `#d9894a`, Logging a new leaf's sap green `#d4e157`, Hunting the rose of a fresh hide
  `#ff6f91`, Fishing the shallows' blue `#5ec8ff` (AUDIT: Logging was pale heartwood and Hunting coral) - each at least
  75 apart from every other node's and from the party's green, the Detect markers' red, the gate's ember and the ships'
  red, bone and grey. Mining's copper stands near the quest's gold, the gate's ember and a hostile ship's red, and is
  told from them by shape alone (diamonds on the strip's middle; a ship's triangle points up, a node's down).
- **The compass, both skins.** The party's 5x3 triangle and the Detect markers' bearing law (clamped), each in its
  profession's colour, the nearer brighter (`nodeMarkAlpha`: whole at the feet, 45% dimmer at its reach), the nearest
  drawn last, over the rest - the classic box (`ui/hud/hud.js` drawNodeCompassMarks) and the enhanced strip
  (`ui/enhanced/enhancedHud.js`, a pooled `hud-node` a node) - and UNDER every other mark (AUDIT, below). A Tracker's animals ride the same list in Hunting's colour. The
  drawHud option is `nodes` (it was `veins`). The street's frame hands it (`world.js` professionMarks), and the
  dungeon's at its own feet (`dungeonContext.js`, through `worldModes.js` `nodeMarks` and the host's
  `professionMarks`).
- **The glow** (`render/nodeGlow.js`). One card a node, turned about the upright to face the eye and stood 0.6 m toward
  it (never past half its way) so the light lies over the node's own picture: a HALO, soft across and narrowing as it
  climbs (a teardrop, to nothing at the card's sides), rising out of nothing at the ground - where the ground cuts the
  card no edge shows - to its body low on the node and thinning to its crown, breathing; a SHIMMER, a soft band
  climbing it every five seconds; six MOTES drifting up out of it, each its own pace and place, twinkling, born and gone
  dark - and under reduced motion all of it held still (AUDIT, below). Slight by intent (its halo a third of white at
  most): kindled over 0.6 s as a node first stands near (a frame's
  step clamped to a quarter second, so a hitch never pops it), faded from 80 m to nothing at 120 m, 16 at most. The
  duel wall's law: added (ONE, ONE), tested against the world's depth and never writing it, fogged from the travel
  view's focus when one is set, every rate a whole number of cycles over its 60 s clock. Drawn after each mode's
  opaque world through the veiled bodies' hook, as the auras are (the street's pass, the dungeon's `lateWorldDraw`);
  never under the travel view; built at idle once a node is first marked; a glow that will not build costs the glow,
  never the game (`createNodeGlowPass`, the world host's one door to it). NODE-OUTLINE (section 46, 2026-10-19) ringed a node with a
  picture along its own picture instead, and NODE-GLINT (section 47, 2026-10-20) lights it ON that picture now - glints and a
  sheen, the ring retired; the glow lights a node with none (a body drawn as a 3D character).
- **Not built, named**: the held map's node marks (section 21's "the held map marks the patches and veins a character
  has worked before" - still as PROF1 and PROF2 left it); no setting turns the glow or the marks off (the professions'
  own switch does).
- **Pinned**: `test/scenes/nodemarks.test.js` (19); `tools/nodeGlowProbe.mjs` compiles, links and draws the glow in a real WebGL2
  context over a stand-in node and wall, and through the world host's own pass with the renderer's typed camera, and
  reads the frame back (14 checks). Mutants: `tools/mutants/nodemarks.json` (58, all dead).

### AUDIT NODE-MARKS (2026-10-01, Mac: "Audit this")

Two lanes: the author's own adversarial re-read, and an independent pass that read the commit cold. FOUND, each fixed and
pinned (`test/scenes/nodemarks.test.js`, `tools/mutants/nodemarks.json`):

- **HIGH - no node was ever marked in play, and a Prospector's veins went with them** (the independent pass). The host's
  `marks` refused any feet that were not a plain Array (`Array.isArray(pos)`), and the player's feet are the motor's
  `Float32Array` (`player/motor.js`: `this.pos = new Float32Array(3)`) - on the street and underground both. Every
  test had handed it a plain array, so the suite was green over a compass that marked nothing but a Tracker's animals;
  PROF2's Prospector's veins, which went through `stoodOf` with no such check, had been marked and now were not.
  FIXED: a place is any three numbers (`isVec3`); the tests hand the motor's own typed feet.
- **HIGH - the glow never lit, and was never built** (the independent pass). `nodeGlows` refused an eye that was not a
  plain Array, and the renderer's camera is a `Float32Array` (`render/renderer.js` `_camPos`). The pass picked
  nothing, so it never built its program. `tools/nodeGlowProbe.mjs` drew through `NodeGlowRenderer` directly, past the
  picking, so it was green too. FIXED as above; the fake renderer's camera is typed; and the probe lights a herb through
  the world host's own pass with a `Float32Array` camera (with the old check it reads `lit 0`).
- **MEDIUM - the compass lost every mark under the travel view.** One gate (`nodeMarksAt`) served the compass and the
  glow, and the compass is drawn under the view (only the reticle hides) - PROF2's Prospector's veins had shown there.
  FIXED: the compass keeps them; the glow alone is gated, at its hook.
- **MEDIUM - the glow moved under reduced motion.** The professions' own law (`ui/professions/profHud.js`: every act has a still
  form for the system's reduced motion) was not kept: the halo breathed, the shimmer climbed, the motes rose. FIXED: a
  still form (`uStill`) - the halo steady, no shimmer, every mote held at its own place - read once a second, as the
  professions' HUD reads it.
- **MEDIUM - sixteen node marks could bury a Detect marker or a mate.** The classic box drew the nodes after the Detect
  markers (a spell's whole output), the party and the ships; the enhanced strip stacked by whichever mark was made
  first. FIXED: the classic box draws them first; the enhanced strip keeps them in a layer of their own just over the
  tape (`hud-nodes`).
- **LOW - a colour was a ship's** (the independent pass). Logging's pale heartwood stood 26 from a ship's bone, and
  Hunting's coral 42 from a hostile ship's red, while this section said the colours were clear of the ships'. FIXED:
  sap green and rose, and the distances pinned (Mining's copper and its three shape-told neighbours named).
- **LOW - the first node's compile was on a frame.** The program was built inside the draw that first lit a node,
  seconds into any walk in the wilderness, against PERF-WARM's law (`render/warmPrograms.js`). FIXED: it is asked of the
  idle when a node is first marked, and nothing is lit until it stands (a node kindles from nothing, so the wait is
  never seen).
- **LOW - smaller.** A pass that ran but drew nothing did not mark the foreign pass its program change needs - FIXED, a
  pass that runs is one. The enhanced strip read its own style back to skip a write, and a style normalises what it is
  given ("1.00" reads "1") - FIXED, the writes kept on the node. `nodeGlows` made a record a lit node a frame - FIXED,
  refilled.

CHECKED, SOUND (the independent pass, read at the commit): the mode machine and the host agree on underground
(`setMode('dungeon')` before `profDungeonEntered`, every exit's `onDungeonLeave` before `setMode('exterior')`); the
floating origin (the translation read fresh each call, no place cached by the glow); the day's turn, a character switch
and a shut book; nothing in `marks` throws (every node carries `local`, a spawned dungeon stands none, the cast never
asked); no caller still passes `veins`; the shared lists are each read before the next fill; the pass's GL bracket
(the auras' and the duel wall's), with the level drawn before `lateWorldDraw` underground; a building's hook lights
nothing; the edits to the cited hosts line-neutral. The author's own: a solid quad's alpha blends (`screenQuadBlends`,
U10); a school's glow stands over the water's film (WATER1 a hand's breadth, the sea's mods 3-10 cm up); a dungeon
vein's base is its ore's own; the large HUD's compass is DFU's needle alone, which marks neither a Detect nor a mate.
NOT CHANGED, named: the large HUD marks no node, as it marks no mate.

## 32. AUDIT 2026-10-01 part four - the professions sound (Mac: "let's do a comprehensive audit on this and also ensure the other professions are sound")

Five lanes and a re-read; the record and every finding's reproduction are `01-Overview/bugs/Field-Bugs-2026-10-01.md` part
four (its last section). What the arc's laws now say, by section:

- **5 (the acts)**: **ANY-HOUR** - no act keeps hours (above). An act's strike is never a held stroke's repeat (the Plus
  pad's gesture swing - PAD-PULSE), never the stick's lock-only tap nor a tap off the world's view (STICK-TAP), and a
  quick second tap of the Attack button is a press (TOUCH-RETAP). The click that struck an act is the act's to its
  release - the stroke that finishes a vein lifts onto nothing (CLICK-LIFT). The steady hand's meter names its key.
- **6 (nodes)**: a node is found up its upright to the top of its glow where that stands above its aim point - a tree's
  3.4 m, a patch's 1.3 m (NODE-SPAN). A patch never stands inside a rock piece, and a tree claims the nearest flat
  outside every one (NODE-CLEAR, VEIN-CLEAR's law). **The ground the nodes stand on**: a harvest's answer, or a refusal,
  marks its pixel's or dungeon's witnessed state stale - read again on the next ask, the nodes stood again when it moved
  (GROUND-STALE); at the UTC day's turn yesterday's state is no state (GROUND-MIDNIGHT). Seasonal Eye chosen stands the
  pixels again. While a node is the target or an act plays the free climb's walk-in start is held; the professions shut,
  no node is the target (NODE-SHUT).
- **7 (the Stores)**: a material's room is every origin, gold-bought too, as the service counts it (STORES-ROOM). The
  service's refusals are kept: the character's day and the Stores read the state again, the account's day in a craft and
  its unvouched dungeon veins close until the UTC day turns, said on the prompt (REFUSALS-LEARNED); `prof-rate` keeps the
  harvest for its ten minutes (RATE-KEPT).
- **9 (crafting)**: the Forge sells the smith's Charcoal at a smith's forge (CHARCOAL-BUY); every counter keeps AUDIT
  32 P6's Marks gates (COUNTER-GATES); the pad presses the pages on every skin (PAD-CLASSIC).
- **At sea**: E is the sea's first - a struck ship's rail, a prize, the grapples - and the net's cast only when the sea
  has nothing (NAVAL-E).
- **Asked, and called** (the record's last section): **TOUCH-HOLD** - Mac: "Interact button + knife Use": the touch
  corner's third slot is Interact by default; on a pad B is Interact in the world (classic) and LT under Enhanced Plus
  (layout 2 - Recast the d-pad's right held); the professions' prompts name the pad's button while it is in hand; the
  Skinning Knife's Use from the hotbar or a quick slot is E at a body and holds the knife - the line drawn by the look
  alone (5's acts, as the Sickle's Use holds the steady hand). **HERB-XP** - Mac: "XP follows your rank": a herb is
  picked at the highest tier the rank opens, as a haul is worked (3.2). Both, with ANY-HOUR, are the service's acct46 (past main's PATREON-LINK, acct45).

## 33. PROF-MENU, PROF-RETICLE, PROF-STATIONS - the acts on the loot list and on the crosshair (BUILT 2026-10-01)

Mac: "They should use the same menu the loot menu uses and not an interaction button" (asked, "One loot-style list");
then, of the illustrated panels PROF-SCENES built, "move away from the overcomplicated minigame visuals and instead use
the mechanics on something that doesnt cover the screen" (asked, "Around the crosshair"; the stations, "keep them
simple"). The record is `01-Overview/bugs/Field-Bugs-2026-10-01d.md`; every act's rules, timings and report are 5's and 8's,
unmoved.

- **The list (PROF-MENU).** A node under the look is the world plaque's list, the loot pile's own: its name, its
  profession's word, its acts as verb rows - a refused act with its reason, the first pressable lit first
  (`scenes/gatherHost.js` `hoverHit`/`hoverName`, worldHover's 'actions' frame). A row is pressed as a loot row - the
  click, the activate key, a tap - and a hold-act so started is held by the press, as a tool's Use holds it. ActChoice
  walks the rows. Without the plaque (classic, touch) a list window asks. 21's prompt stays the fallback's line.
- **The act (PROF-RETICLE, replacing PROF-SCENES).** No box and no title: each act's mechanic on and about the reticle
  (`ui/professions/profReticle.js`, `ui/professions/profActStyle.js`) through the frame's own lens (`ui/worldPlaque.js` `reticleAnchor`) -
  the mine's points and the knife's line where they stand on the node, the glint's double reach and the trace's
  tolerance at their true size; the chop's ring, the hold's arc, the Basket's glint, the float and the haul's bar about
  the crosshair; the count's pips and one hint under it that fades after 2.5 s unchanged. Still forms under reduced
  motion; every cue a sound (`systems/professions/profSounds.js` - GATHER-FEEL, section 44: the gathering's ear says them now,
  `systems/gatherSounds.js`, the HUD none).
- **The stations (PROF-STATIONS).** The heat, the stitch's beat and the plane keep their bars and rules, dressed in the
  plaque's frame and the kit's tones (`ui/professions/profStationStyle.js`); no pictures.
- **The mouse (HERB-CURSOR, `01-Overview/bugs/Field-Bugs-2026-10-02.md` part four, and its audit).** The Basket's glints
  stand about the crosshair, where the look cannot put them under it: its act holds the cursor free while it plays (no
  hold with a pad in hand) and hands the look back at its end - an Escape's on its keyup (`scenes/gatherHost.js`
  `ACT_POINTER`/`actPointer`, `player/pointerLock.js` `holdCursor`); its hint is "click the glint". The mine's points,
  the knife's line and the net's throw are aimed by the look: a cursor the player freed is taken back for them, and
  stays taken. The ring, the hand and the steady hold need neither, and an act played gently nothing (but the net's
  throw). Any press while a glint shows still finds it (5's rule, unmoved).

`test/systems/profreticle.test.js` (10), `test/systems/fb0930b_toolsaid.test.js` (+5); `tools/mutants/profreticle.json` (57),
`profmenu.json`; `tools/profReticleProbe.mjs`. HERB-CURSOR: `test/systems/foraging/fb1002_herbcursor.test.js` (6),
`test/systems/fb1002_herbcursor_audit.test.js` (10); `tools/mutants/fb1002_herbcursor.json` (17),
`fb1002_herbcursor_audit.json` (14).

## 34. PROF11 - Masonry, as built (BUILT 2026-10-01)

Mac: **"We need to do a comprehensive audit on everything and finish the not done"** (2026-10-01, with the Seats arc's
audit - Masonry is 15's next slice and SEAT2b's need). What sections 3.2, 3.3, 4.5, 4.8, 9.3 and 9.4 left open for
PROF11, DECIDED here, and what was found (FACT):

- **What PROF11 is.** 15's row - Masonry - whole: the mason's bench and its two works (the cut, the mix), the chisel,
  Mortar, the Sculptor's stone decor; the Masonry track and its four specialisations practised (the Quarryman's cut, the
  Sculptor's decor at once; the Builder and the Fortifier with SEAT2b's works - `06-Systems/Online-Arc.md` SEAT2b).
- **Mortar** (4.5; 675): the stone family, tier 2, 2 Marks; FACT: Lodestone's grey lump is the picture Rough and Cut Stone
  already wear, undyed - Mortar wears it too. Registered, withdrawn as an item, listed on the market.
- **The mason's bench** (4.8): a General Store's - 50 gold a cut, a mix or a carving, as the forge's counter - or a home's
  `mason` station (50,000, the seventh). Its works ride the forge's route with a craft's law: the cut (Rough Stone to Cut
  Stone 2:1; a Quarryman's 1:1 at 50) at rank 0, the mix (1 Sulphur, 1 Lead and 5 Rough Stone to 10 Mortar) at rank 10.
- **XP FOLLOWS THE RANK** (PROF8's law, Mac's): a unit worked at the rank's own tier - 20 x the tier a unit, half again
  for a clean chisel, +500 the first time a character makes it - kept with the row (migration `0060_masonry.sql`:
  `prof_smelts.first`, `prof_smelts.clean`, `idx_prof_smelts_recipe`). FLAGGED to Mac: Masonry's XP follows the rank's
  tier, not the material's (the cut is tier 1 at every rank otherwise, and Masonry would never climb).
- **The chisel** (5.1; `systems/chiselAct.js`): five scored lines, one marked for 1.2 s (2.0 at Master) x (STR + END) / 2's
  band, moved by the glint's rule after every strike too; four strikes a work, seven a carving; every one true a clean
  act. The arrows, a digit, Space or a press on a line; Gentle acts, Escape and one act a page as the other acts.
- **The Sculptor's four** (3.3, 9.4; 696-699): a column, a bench, a font and a statue plinth of Cut Stone and Mortar -
  DFU's Furniture group, delivered among the home's things and set down as their one DFU model (62315, 62322, 41220,
  74091 - FLAGGED: the models want Mac's eye); Stonework lists on the market; refused to all but a Sculptor at 100
  (`prof-sculptor`, 403).
- **The Builder and the Fortifier** (3.3): named by PROF11 and chosen since SEAT2b - a Builder's fortification project asks
  nine tenths of the stone, rounded up (`fortificationStone`, the seat's works' one law); a Fortifier on a seat's
  defending roster keeps its Walls from a capture's drop, once a Season a seat (`server-account/src/seatForts.js`
  fortifierAt).
- **The pages**: the Stores page's Mason's Bench; Masonry practised on the Professions page; a work's XP said as its own
  profession's (FOUND: it said Smithing's).
- **Pinned**: `test/net/prof11_law.test.js` (11), `test/net/prof11_service.test.js` (7, through the real Worker),
  `test/systems/prof11_client.test.js` (7). Mutants: `tools/mutants/prof11.json` (138, all dead).

## 35. PROF9 - Cooking, as built (BUILT 2026-10-02)

Mac: **"2 and 4"** (2026-10-02: the Apothecary waits on Alchemy, Cooking and Jewelcrafting; Cooking is the first of the
three). What sections 3.2, 3.3, 4.8, 9.3 and 9.4 left open for PROF9, DECIDED here, and what was found (FACT):

- **What PROF9 is.** 15's row - Cooking - whole: the fire and its four dishes (9.3), the pan (9.4), the dishes as items and
  what eating them does, the feast at the party's table; the Cooking track and its four specialisations practised. C&C's
  own cooking at a fire - a Raw Fish from the pack turned to Cooked Fish (`scenes/camps.js` openCook) - is the mod's,
  untouched, and earns nothing (9.3: "the service did not see it"). BAG-COOK (FIELD BUGS 2026-10-20c, "raw fish cant be
  cooked over fires"): since BAG1 a haul's Raw Fish goes into the Materials Bag first, and the list read the pack alone;
  it reads the pack, then the bag, and the cooked food goes into the pack (`06-Systems/Materials-Bag.md` section 16).
- **The fire** (9.3: "any campfire, hearth or brazier"). DECIDED: any LIT fire within C&C's own reach of its flame
  (`survival/camp.js` BY_FIRE_REACH, 4 m) - anyone's campfire, a peer's included, and the world's braziers and fire bowls
  (`survival/hearth.js`, HEARTH1's records) - in the street and the wilderness (`scenes/world.js` cookFireHere), a building
  (`worldModes.js` cookFireHere, the interior's own fires - DECOR-USE, 2026-10-24: and the fires placed in a home, a ship's
  cabin or a caravan, and any piece made its cooking station, `06-Systems/Online-Arc.md` DECOR-USE) and a dungeon (`dungeonContext.js` cookFire), **in every tier
  of the arc** (`scenes/camps.js` fireNear - the world's fire, as a rest's place reads it: Cooking is a profession, never
  C&C's switch). **No fee** - a fire is nobody's (`professionLaw.js` COOK_FIRE). The Stores page's **The Fire**, live
  where one burns; away, it says where Cooking is done. The service cannot see the fire, as it cannot see the forge (23).
- **The four dishes** (9.3; 4.8's 685-688; `recipeLaw.js` DISHES, COOKING_RECIPES). Their inputs as 9.3 writes them,
  every one the Stores': **Hunter's Stew** 2 Raw Meat, 1 Mushroom, 1 Root Bulb; **Fisherman's Supper** 2 Raw Fish, 1 Egg,
  1 Green Leaves; **Orchard Tart** 2 Apple, 1 Egg, 1 Yellow Berries; **Feast of the Hearth** 4 Raw Meat, 4 Raw Fish, 2
  Apple, 2 Orange, 2 Mushroom, 2 Egg. DECIDED: **the Stew and the Supper at rank 0** (the hunter's and the fisher's -
  tier 1), **the Tart at 10** (tier 2: its Yellow Berries an uncommon herb, 4.3), **the Feast at 9.3's 70** (tier 6).
  FOUND: Root Bulb, Green Leaves and Yellow Berries grow in both of DFU's plant groups (22), so the Stores keep each twice
  and a dish of one is **two recipes**, the northern herb's and the southern's - the arrows' Twigs' law (25). Seven recipes;
  the dish is the same dish either way.
- **A dish is a piece** (9.1's route, `/v1/prof/craft`): into the pack, each serving its own provenance id and signed record
  - so a dish lists on the market's Crafted view, family **Dishes** (`marketLaw.js` CRAFTED_FAMILIES), and a commission
  may name one. DECIDED: **no quality** (`takesQuality`; the record's -1, as a kit's) - a dish's worth is its effect; a
  dish spoiled since it was cooked is **not as minted** (`smithItems.js` asMinted) and lists nowhere - the market mints a
  piece again from its record, and would hand back a fresh stew for a rotten one.
- **The servings** (3.3's Cook: "+1 serving a dish"): DECIDED **one dish a cook, a Cook's two** (`craftCount`) - a craft's
  two pieces are the most a craft's row holds (`prof_crafts.provenance2`, the Quartermaster's kit's).
- **XP FOLLOWS THE RANK** (PROF8's law, Mac's; Masonry's, 34): three of four dishes sit on tiers 1-2 and would be quartered
  from rank 40, so a dish is cooked at the rank's own tier - **20 x it a cook** (never a serving), **half again for a
  clean pan** (a dish takes no quality, so the clean act's step is its +50%, the bench's law), **+500 the first** of each
  recipe (`recipeLaw.js` cookXp; the 500 laid on in the craft's own decision, as every craft's), under the crafter's
  limit.
- **The pan** (9.4: "take the pan off in its window (the Skillet's is wider)"; `systems/panAct.js`). DECIDED: a dish is
  **three pans** in turn, a feast **five** (a table's worth); each goes on the fire cold and its heat climbs raw to burnt
  in **3 s x a pace the fire draws each pan** (0.85-1.2 - no two pans cook alike); it is **done** in its window - from
  0.6 of the bar, **0.12 wide x the band**, half again by Master, **half again with C&C's Skillet** in the pack
  (`survival/camp.js` hasSkillet, imported), never past 0.95. Space, Enter or **Take it off** takes the pan off; before
  the window it is raw; left to burn, the fire takes it and the next goes on. **Every pan done is a clean act.** Cooking's
  attribute pair: **(INT + PER) / 2**, the cook's judgement and a host's touch (no other act reads Personality), on
  Foraging's four bands. The bar runs dough to crust to char, its window an edged band (a shape as well as a colour);
  under reduced motion the bar is still. **Quick cook**, **Gentle acts**, **one act a page**, **Escape sets the pan aside**
  (nothing spent) and the page shut under it as every station's act (AUDIT 30-32's laws).
- **The dishes as items** (4.8: "pack (food) | C&C's Meat / Cooked Fish / Bread"; `systems/professions/profTemplates.js`). Each stands
  on a C&C food's own row, **imported, never typed again**: the Stew and the Feast the Meat's picture, the Supper the Cooked
  Fish's, the Tart the Bread's; the food's weight (a feast four times it) and three times its price (a feast twelve);
  one a piece, never stacked, never shelved. NOT LAID ON, for Mac: 4.8's "tinted" - DFU's dye swatch reaches no food's
  picture (Mortar's finding, 34), so the Feast wears the Meat's as the Stew does; their names tell them apart.
- **A dish is C&C's food.** DECIDED: Cooking's dishes are food **by C&C's own law** - C&C's table stays as the mod wrote
  it, and they come in through a door of its own (`survival/food.js` registerFoods), each on its C&C food's row (its
  satiety, its keeping, its stale word) under its own name. So with the arc on a dish is **eaten by C&C's eat**
  (`survival/items.js` eatFood - its food arm made an export of its own, imported by the dish's use): the hunger it must
  meet (a full stomach refuses it whole), its stage, its sickness, its words; it **spoils by C&C's day**; withdrawn
  raw food stays C&C's Raw Fish and Raw Meat (5.2, 29). With the arc off a dish is simply eaten.
- **What eating does** (9.3; `systems/cookItems.js`). DECIDED: the attributes are **DFU's own Fortify Attribute**, one
  bundle a dish - a buff of the player's own, on the HUD's row and the party card (PARTY-BUFFS) - for its minutes, a
  magic round a game minute: **the Stew Endurance +5 for 2 hours**, **the Supper Agility +5 for 2 hours**, **the Feast
  Strength, Endurance and Willpower +5 for a game day**. FOUND: 9.3's Tart - "stamina regained +20% for 4 hours" -
  names nothing Daggerfall does: stamina is regained only by rest and spells. DECIDED: the Tart's +20% is the bar's - its
  **every minute's drain divided by 1.2** while it lasts (a bar a fifth longer), the port's own `dishStamina` kind read
  by the one fatigue multiplier (`scenes/shared.js` fatigueLossMultiplierFor, over the career's Athleticism). The same
  dish eaten again while it lasts **renews** its effect, never stacks it.
- **The feast is the whole party's** (9.3: "the whole party (the party's buff frame, PARTY-BUFFS)"). DECIDED: eaten, the
  feast's spell record (`recipeLaw.js` dishSpell - three Fortify entries, each a byte's components at `DISH_LEVEL` 30, the
  cast frame's own most) goes **to every party mate in the room through ALLY-CAST's own frame** (`allyCast.js`
  allyCastFrame, `online.sendCast` - `scenes/world.js` setFeastShare), and each mate's client lays it on as a mate's
  gift (`online.onCast`, unchanged) - the same day, the same +5. **No relay change**: a feast is a beneficial cast the relay
  already carries. The eater hears "The feast is shared with Ann and Bob."; a mate hears the cast's own line ("Mac casts
  Feast of the Hearth on you.").
- **The specialisations** (3.3), all four chosen now: **Cook** - two servings a dish; **Field Cook** - DECIDED: a Campfire
  Kit lit **spends no charge** (`survival/camp.js` placeCampItem's `keep`, a campfire's alone - a tent wears as ever), in
  the street and underground (`scenes/camps.js` `fieldCook`, `world.js` fieldCookNow) [SUPERSEDED by the Rest arc,
  2026-10-03: REST2 spends no charge on any placing, and `keep` is gone - a Field Cook's NIGHT at their own Campfire
  spends no fuel instead, a Campfire's alone (`survival/camp.js` fieldCookKeeps, spendCampNight's `fieldCook`;
  `06-Systems/Rest-Arc.md` Record)]; **Chef** - a feast lasts **half
  again** (a day and a half); **Provisioner** - "rations and dishes never spoil": FOUND, C&C's Rations never spoil already;
  DECIDED, a Provisioner's **dishes** and the **foods they take from the Stores** never spoil (`noRot`, read by C&C's day
  beside the Butcher's `slowRot` - 29). **The cook's hand** (`recipeLaw.js` dishHand): what of the choice at 100 a dish
  carries wherever it goes - a Chef's feast (1), a Provisioner's dish (2) - DECIDED **the dish's, never its eater's**:
  signed into its record (`f`, `net/productRecord.js`), kept on its piece (`products.hand`) and answered with the market's
  pieces, so a Chef's feast bought at the market lasts as long in the buyer's hands.
- **The pages**: the Stores page's **The Fire** (the seven dishes, their inputs as the Stores hold them, the rank each asks,
  the effect, the servings, the pan's XP; a Skillet said); Cooking practised on the Professions page, its unlocks by rank.
- **The four hosts** (17.1): **the streaming world** - the fire on the street and in the wilderness, the craft, the feast's
  share, a Field Cook's Campfire (its nights, REST2); **building interiors** (`worldModes.js`) - a hearth's or a brazier's fire; **dungeons**
  (`dungeonContext.js`) - its fire bowls and a campfire on its floor, a Field Cook's Campfire; **the fixed city**
  (`scenes/exterior.js`) - **no Cooking**, as no profession (22's law): a dish carried there is eaten by every host
  (`scenes/shared.js` installCooking - a dish is the pack's, offline too).
- **The service** is **acct67** (acct66 another branch's at the same time - the two must not collide); migration
  **`0069_cooking.sql`**: `products.hand` (`CHECK` 1 or 2). No route added: a dish is `/v1/prof/craft`'s; the market's
  pieces answer their `hand`.
- **Not built, named**: the dishes' tint (above); the Tart's "regained" (above); the feast's share is the party in
  sight (AUDIT PROF-541 K5, below), not the table's metres.
- **Audited** (2026-10-03, AUDIT PROF9): **K1** - a Butcher who is also a Provisioner carries meat with both marks
  (`slowRot`, `noRot`), and C&C's day asked the Butcher's half pace first and never reached the Provisioner's "never
  spoils": DECIDED, **never spoiling outranks half the pace** - `survival/food.js` rotFoodDay asks `noRot` first. **K2** - a
  feast a party mate shares arrived as an ordinary ALLY-CAST gift, so it STACKED with the mate's own feast and its rounds
  added up: DECIDED, **a feast shared renews as one eaten does** - the receiver (`world.js` online.onCast, a mate's cast
  alone - a stranger's gift of the same name lands as any stranger's) takes its standing bundles of the feast's name off
  before the gift is laid on (`cookItems.js` isPartyDishSpell, the party dish's record by its name). And the Apothecary's
  words on the Seat tab (`fortLaw.js` FORT_EFFECT_WORDS, AUDIT PROF12 P1) now say a dish's step as it is - half again the
  XP a tier, never a quality step (Seats-Arc 7.5).
- **Audited again** (2026-10-03, AUDIT PROF-541): **K3** - K2's renewal asked a mate's cast alone, and a stranger's
  "Feast of the Hearth" (the stranger's list carries Fortify Attribute) landed beside the party's feast and added its rounds
  to it (`effects.js` like-kind stacking - 2,879 rounds): DECIDED, **a feast is a party mate's gift alone** - the receiver
  drops a stranger's (`cookItems.js` takeFeastGift, asked in `world.js` online.onCast before the gift is laid on). **K4** -
  a renewal took off a standing feast with more rounds left than the one arriving (a Chef's day and a half cut to a day):
  DECIDED, **a renewal never shortens** - a standing bundle with as many rounds left stands and the incoming is skipped,
  eaten or shared (`cookItems.js` renewDish, feedEffect's and takeFeastGift's). **K5** - the share went to every party peer
  in the room and its halo cells: it goes to the **party mates in sight** (`world.js` setFeastShare over peersNear - the
  stranger's gift's own law), naming only those whose send went. **K6** - the Tart's `dishStamina` is a kind the player may
  end (`mysticism.js` ENDABLE_KINDS). **K7** - the fire's XP line counts the town Apothecary's steps as the service does
  (`profPages.js`, the host's `cookSteps`; `recipeLaw.js` cookXp). **K8** - a Brew pressed while another craft holds the
  one-craft latch says "Your hands are busy with another craft.". ACCEPTED (F2): a mate whose party roster lags behind
  the eater's is not a party peer yet on their own client, so their copy of a shared feast is dropped as a stranger's
  (K3) while the eater is told it was shared - the next feast reaches them once the roster has caught up.
- **Audited a second round** (2026-10-03, AUDIT PROF-541 round 2): **R2-K9** (LOW) - a feast was known by its name alone,
  so a mate's own spell named "Feast of the Hearth" (Fortify Strength 1 for 1,860 rounds and more) replaced a real feast
  and then, never shortened (K4), shut out every feast eaten after it; a spell of the player's own spellbook so named did
  the same: DECIDED, **a feast is its record** - a gift of the name lands only where its effects are the real feast's
  (`cookItems.js` isFeastRecord over dishSpell's plain and Chef's records), any other is dropped, and a renewal counts and
  replaces the dish's own bundles alone (eaten entries, or a feast's gift with the record's settings - `renewDish`'s
  `dishEntry`): a look-alike neither stands for the dish nor is taken off by it. **R2-K10** (LOW) - a feast eaten while a
  longer one stands was eaten for nothing, unsaid: it says "The feast you already enjoy lasts longer." (another dish its
  own name; `cookItems.js` dishStandsLine) - the mates still receive it. **R2-H1** - the "my guild holds this seat" guard
  written three times in `world.js` is one law, by profession (`fortLaw.js` hallStepsFor - the craft's seat, the
  alchemy station's steps, the fire's `cookSteps`), and the feast's share is `cookItems.js` shareFeastWith, both driven by
  tests; the hall door's gate is `onlineHomes.js` hallEntryTurnable, the row's and the press's. Pinned (four tests), 17
  mutants added, all dead; seven re-aimed (prof9, guild_yard, guild1d).
- **Pinned**: `test/net/prof9_law.test.js` (9), `test/net/prof9_service.test.js` (5, through the real Worker),
  `test/systems/prof9_client.test.js` (21). Mutants: `tools/mutants/prof9.json` (162, all dead - AUDIT PROF-541 R2-S7's three among them).

## 36. PROF10 - Jewelcrafting, as built (BUILT 2026-10-02)

Mac: **"2 and 4"** (2026-10-02: the Apothecary waits on Alchemy, Cooking and Jewelcrafting; Cooking stood first, section
35). What sections 3.3, 4.1, 4.6, 9.2, 9.3 and 9.4 left open for PROF10, DECIDED here, and what was found (FACT):

- **What PROF10 is.** 15's row - Jewelcrafting - whole: the jeweller's bench and its eight pieces (9.3), the facet (9.4),
  the pieces as DFU's own jewellery carrying the points their metal and gem add to DFU's item maker, quality, Masterwork
  and provenance; the Jewelcrafting track and its four specialisations practised.
- **The bench** (9.3: "a jeweller's bench, or any Pawn Shop or Gem store for 50 gold"; `professionLaw.js` JEWEL_FEE). A
  Pawn Shop's or a Gem Store's, open for trade (its `insideOpenShop` latch, AUDIT 29 D4's law), **50 gold a piece**, paid
  as the piece is minted (AUDIT 30 C4's law) - or a home's **`jeweller` station** (HOME-STATIONS' eighth, `decorLaw.js`,
  its licence the workbench's 50,000), a hall member's as the others'. `scenes/worldModes.js` jewellerHere. The service
  cannot see the bench (as it cannot see the forge, 23). The Stores page's **The Jeweller's Bench**.
- **The eight pieces** (9.3; `recipeLaw.js` JEWEL_PIECES). DFU's own Jewellery templates, **imported, never re-typed**: each
  read by its place in DFU's Jewellery enum (`systems/item/itemTemplatesData.js` GROUP_TEMPLATE_INDICES - Amulet 133, Bracer 134,
  Ring 135, Bracelet 136, Mark 137, Torc 138, Cloth Amulet 139, Wand 140), its word 9.3's and DFU's template name, pinned
  equal (the service's bundle carries the enum and no item table - FOUND: the account deploy's path filter now lists
  `itemTemplatesData.js`, which the Worker bundles since). Inputs as 9.3 writes them: Ring 1 metal (and a gem, if wanted),
  Mark 1 metal + 1 gem, Bracelet 2, Bracer 2 + 1 Cured Leather, Amulet 2 + 1 gem, Torc 3, Cloth Amulet 1 Linen + 1 gem,
  Wand 2 Ironwood or Ghostwood Planks + 1 gem.
- **The metals.** DECIDED: Silver, Gold and Platinum are **DFU's own raw metals as the Stores keep them** (73-75) - never
  the smith's Silver Ingot: a jeweller works the precious metal itself.
- **The gems** (4.6). DECIDED: **a recipe a gem** - DFU's eight and the sea's Pearl (`JEWEL_GEMS`), the piece named for it
  ("Gold Ruby Ring"); 120 recipes in all (`JEWELCRAFTING_RECIPES`, after every other). A gem is **set, not worked**: it
  gates no rank. The Siege-cracked Gem is no recipe's own - a Lapidary's stands in for any (below).
- **THE JEWELLER'S LADDER** - DECIDED, FLAGGED to Mac: a piece's tier is its metal's place on the jeweller's own track,
  not the Mining tier its vein is struck at (4.1's 3, 4, 5) - at 4.1's tiers a Novice jeweller had nothing to make (the
  Cloth Amulet asks a gem, and the least is tier 2). **Silver at 0** (tier 1), **Gold at 25** (tier 3), **Platinum at 55**
  (tier 5, its own 4.1 tier); the **Cloth Amulet at 0** (Linen's tier 1); the **Wand at 70** (Ironwood's and Ghostwood's
  tier 6) - the jeweller's crown piece. XP is 3.2's own (20 x the tier, +500 the first - AUDIT PROF-541 J7 (Mac: "Once per piece and base"): a piece and base's
  first, whichever gem, `firstCraftKey` - a recipe two tiers below the
  rank's quartered): the ladder spans 0 to 70, so it needed no "XP follows the rank".
- **The points** (9.3: "Silver +0%, Gold +10%, Platinum +20%, a set gem +10% (Gemcutter +10% more)"; `jewelPointsPct`,
  `jewelPoints`). DECIDED: the piece carries **its own `enchantmentPoints`** (DFU's item field, `itemFields.js`) - its
  template's (the Ring's 1,800) and the share, floored - and **DFU's item maker reads it** for a crafted piece of jewellery
  (`systems/enchanting.js` itemEnchantmentPower, `craftedJewelPoints`: the Jewellery group, a provenance id); every other
  item reads its template's as ever - the maker's law untouched. A Wand and a Cloth Amulet add nothing for their wood or
  cloth (9.3 names the metals'). Shown on the bench and the card ("2,160 enchantment points").
- **The piece** (`systems/smithItems.js` jewelItem, setJewel). DFU's jewellery as DFU's loot mints one (the template in
  its group, no material), its **quality the armour's** (9.2: condition and weight; a Superior's Magic roll and a
  Masterwork's Rare one - Loot Rarity's words kept about its name, "Porter's Gold Pearl Amulet"; a Masterwork's mark before
  it, "Silverthorn's Platinum Torc"). DECIDED: its **worth** is its template's by its points' share **and its gem's own DFU
  price** - a Ruby set is a Ruby's worth carried, never lost to the setting. A **Wand takes a Heartwood** for a plank (4.2:
  "worth one quality step in any recipe"); no family step (no jeweller's choice is a quality step).
- **The specialisations** (3.3), all four chosen now. **Gemcutter** (50) - a set gem +20%, not +10%. **Goldsmith** (50) -
  DECIDED: "Silver counts as Gold" is the **piece's** - a Goldsmith's Silver piece holds Gold's +10% and so its worth; its
  rank stays Silver's, the metal it was made of. **THE JEWELLER'S HAND** (`jewelHand`): what of the choice at 50 a piece
  carries wherever it goes - 1 a Goldsmith's Silver piece, 2 a Gemcutter's gemmed piece - signed into its record (`f`,
  `net/productRecord.js`, `jewelHandOk`) and kept on it in **0069's `products.hand`** (the cook's column - its `CHECK (1,
  2)` holds both: **no migration**); so a Gemcutter's ring bought at the market holds its points in the buyer's hands.
  **Master Jeweller** (100) - Masterwork +5 points, the Masterwright's (`masterworkSpec`). **Lapidary** (100) - DECIDED: a
  Siege-cracked Gem (678, the Seats' Spoils of War) **stands in for the piece's gem** at the craft (`cracked`;
  `recipeInputs`), the piece the recipe's - its gem the one the Lapidary chose ("a gem of the roller's choice", 4.7); asked
  by any other, or of a piece that sets no gem, it is refused (`prof-lapidary`, 403) before anything is spent.
- **The facet** (9.4: "a slow turn stopped where the gem catches the light (a 10-degree window)"; `systems/facetAct.js`,
  `recipeLaw.js` FACET_ACT). DECIDED: a piece is cut in **three facets, a gemmed piece five** (the gem's crown); each a
  slow turn of the stone from 0 at **60 degrees a second** (six seconds round) toward the light, at a bearing the bench draws
  each facet (**60-300 degrees** - never where the turn begins); stopped within the **10-degree window** (x the band, half
  again by Master) about the light it is caught; let go round twice, lost, and the next begun. **Every facet caught is a
  clean act** - a quality step, 5.1's bound. Jewelcrafting's attribute pair: **(WIL + LUC) / 2** - the patience to let the
  stone turn and the fortune of where it breaks (no other act reads Luck). The dial a bar of the whole turn, the light's
  window an edged band on it, the stone turning beside it (still under reduced motion). Space, Enter or **Stop the turn**;
  **Quick craft**, **Gentle acts**, **one act a page**, **Escape sets the stone down** (nothing spent) and the page shut
  under it, as every station's act.
- **The market and the writs.** A piece lists in the Crafted view's **Jewellery** family (`marketLaw.js` CRAFTED_FAMILIES),
  its hand answered with it; a Masterwork goes to auction (27); a commission names one at a quality (28). Court writs ask
  witnessed materials, not pieces - unchanged.
- **The four hosts** (17.1): **building interiors** (`worldModes.js` jewellerHere) - the bench; **the streaming world**
  (`world.js`) - the craft through Jewelcrafting's station, its fee, the facet's band and a Lapidary's gem; **the fixed
  city** and **dungeons** - no bench, as no station stands there (22's law).
- **The service** is **acct68**. No migration; no route added (`/v1/prof/craft`'s `cracked`); `prof-lapidary` (403). No
  relay change.
- **Not built, named**: the Apothecary's quality steps waited on Alchemy (`fortLaw.js` APOTHECARY_OPEN - opened since,
  PROF12; AUDIT PROF-541 D2); 4.1's mining
  tiers of the precious metals stand as Mining's alone (the ladder above); 4.8 names no jeweller's template - the pieces
  are DFU's own, their pictures DFU's.
- **Audited** (2026-10-03, AUDIT PROF10): **J1** - the item maker trusted any piece of Jewellery's own `enchantmentPoints`
  where it carried a 16-hex provenance, so a piece forged over the wire or in a save brought two billion points to it:
  `craftedJewelPoints` now asks **a jeweller's record of the piece's very template** (`craftedJewelRecipe`: its `recipe` a
  `jewel`, its template the recipe's) and takes **never more than that recipe mints** - its template's and the most a
  jeweller's hand adds (a Goldsmith's Silver, a Gemcutter's gem; `jewelPoints`). **J2** - a Masterwork piece rolls a Rare
  enchantment, and DFU's item maker refuses any enchanted item (AddFilteredItem), so its points could never be spent.
  DECIDED (Mac: **"Item maker can add to it"**): the item maker **takes a crafted piece of jewellery with the enchantments
  it carries** (`enchanting.js` keptEnchantments, `itemMakerWindow.js` itemMakerFilter) - each kept row costed as the maker
  costs a row (the catalogue's, never a cost the item says of itself; a bound soul's forced row forced still), counted
  against the piece's points (`enchantDecision`, the "used/available" label) and in the ten-row guard and the picker's
  filters, shown at the head of its list in the forced colour, **never removed**, costing no gold; enchanted, the new rows
  land after them (`applyEnchantments` - the kept rows' created payloads not run again). Every other enchanted item is
  refused as DFU refuses it - but an identified Rare, found or a Masterwork of any other craft, which MAKER-RARE
  (`01-Overview/bugs/Field-Bugs-2026-10-26.md`, the owner: "You cant enchant masterwork/rare armor") takes the same
  way, its ladder's rows riding free (`enchanting.js` rareKeeps). The bench says so ("The item maker spends them, beside a Masterwork's own enchantment.").
- **Audited again** (2026-10-03, AUDIT PROF-541): **J3** - the Enhanced+ skin's item maker built its lists from the
  player's own rows, so a crafted piece's kept enchantments were invisible while their cost counted: it draws the lists
  as the classic window does (`enhancedPorts.js` itemMaker over `_lists()`), a kept row muted with no act, as a forced
  row (and the probe seam clicks the rows as drawn). **J4** - a Masterwork's Rare roll drew from all of Jewellery's
  flavours (150 to 1,590) whatever the piece's points (660 a Cloth Amulet's), and most small pieces rolled over budget:
  DECIDED, **the roll is one the piece's points hold** - a first draw that does not fit is drawn again among those that do
  (`lootRarity.js` applyRarity's `fits`, `smithItems.js` mintPiece; `enchanting.js` enchantmentRowCost), so every draw that
  fit stands as its seed made it. **J5** - a Wand rolls no Magic or Rare (no slot - `rarityEligible`), so its bench says
  only "The item maker spends them.". **J6** - J1's cap took the most over every hand, the minted hand not stored: the
  jeweller's hand is **written on the piece** (`hand`, 1 or 2, `itemFields.js`; a hand its recipe takes alone) and the
  cap is that hand's (`craftedJewelPoints`) - no hand, no hand's share.
- **Pinned**: `test/net/prof10_law.test.js` (10), `test/net/prof10_service.test.js` (7, through the real Worker),
  `test/systems/prof10_client.test.js` (16). Mutants: `tools/mutants/prof10.json` (173, all dead).

## 37. PROF12 - Alchemy and the Enchanting layer, as built (BUILT 2026-10-02)

Mac: **"2 and 4"** and **"lets just finish out everything before merge"** (2026-10-02: Alchemy, the last of the
Apothecary's three - Cooking stood first, section 35, Jewelcrafting second, section 36 - and then the Apothecary opened,
Seats-Arc 7.5). What sections 1, 2, 3.3, 4.1, 4.3, 4.5, 9.3 and 9.4 left open for PROF12, DECIDED here, and what was found
(FACT):

- **What PROF12 is.** 15's row - "Alchemy and Enchanting layers; Disenchanting" - in its smallest faithful form: law 1
  stands - **DFU's potion maker and item maker are untouched** (9.4: "Alchemy, Enchanting: none - DFU's windows stay
  1:1") and earn nothing online; the profession's doors are the ones 9.3 names: the **brewing act** at an alchemy station
  (Alchemy), **Disenchanting** at an enchanting station (Enchanting's XP), and **a discount on DFU's item maker's gold**
  (Enchanting's layer). The Alchemy and Enchanting tracks are practised on the Professions page, their eight cards chosen.
  **NARROWED by POTION-DOOR (2026-10-25, section 52)**: online at an alchemy station DFU's potion maker is the brew's
  door - a mix DFU's recipe law accepts is the station's brew, asked of the service and paid its XP; the maker earns
  nothing only away from a station (a temple's), past the brewer's rank, where the fee is unmet, or offline (the
  departure from DaggerfallPotionMakerWindow's MixCauldron, `01-Overview/Port-Ledger.md` section A).
- **ONE DFU MEMBER, ONE EXPORT** (law 1, 17.2: "DFU's recipes (`POTION_RECIPES`) are imported by the Alchemy layer, never
  copied"). FOUND: `potions.js` reaches the item table and the effect engine, which no Worker bundles. DECIDED: the twenty
  and their key (`potionRecipeKey`, `potionKeyFromCauldron`, the default bottle record) moved **verbatim** into a leaf,
  `systems/potionRecipes.js`, that imports nothing; `potions.js` imports and re-exports them (every reader's import stands,
  the same objects - pinned), and the service and the layer (`net/alchemyLaw.js`) import them from it. Heal-SpellPoints'
  key (the one DFU effect with no ClassicKey, potion-only) moved beside the one recipe that names it; `effects.js`
  re-exports it. The account Worker bundles `itemTemplates.json` too (DFU's enchantment budgets, one home - guestName's
  JSON precedent); the deploy's path filter names the three.
- **The alchemy station** (9.3: "the brewing act at an alchemy station"; `professionLaw.js` ALCHEMY_FEE). DECIDED: an
  **Alchemist's**, open for trade (DFU's own potion seller; its `insideOpenShop` latch), **50 gold a brew** or a
  transmutation as every station's fee (**25** since CRAFT-PAYS, 2026-10-21, section 48 - AUDIT CRAFT-WRITS T7), paid as
  the potions are bottled - or a home's **`alchemy` station** (HOME-STATIONS'
  first, its 50,000 licence; a hall member's) - and since POTION-DOOR (section 52) a **Mages Guild hall**, at the
  Alchemist's fee. `scenes/worldModes.js` alchemyHere. The station's own press opens DFU's
  potion maker, 1:1 - online it asks first, the maker or the brew on the Stores page (STATION-DOOR,
  `01-Overview/bugs/Field-Bugs-2026-10-11f.md`). The Stores page's **The Alchemy Station**.
- **The brew** (9.3: "the service runs DFU's own recipe law on them ... the same twenty recipes, and no new ones, make the
  same potions, into the pack"; `/v1/prof/brew`, `server-account/src/alchemy.js` brewAtStation). The request names the
  potion and the cauldron **as the Stores hold it** (`keys` - an herb its northern or southern, the brewer's: the page
  fills it from the group held more of, `brewKeys`); the service maps each key to its DFU template and asks **DFU's own
  hash** (`potionKeyFromCauldron`, sorted - any order) to answer that very potion (`brewSpends`; `bad-brew` else - DFU's
  "there is no ingredient comparison anywhere"). DECIDED: a cauldron no recipe answers is refused before anything is spent
  (DFU's maker spends a failed mix; the station names its recipe). The ingredients out, bought first; gold's units walled.
- **THE ALCHEMIST'S LADDER** (DECIDED; `alchemyLaw.js` POTION_PRICE_TIERS): 9.3 sets no ranks on DFU's twenty, so a
  potion's tier is its **DFU price's** - 50 gold or less tier 1 (Orc Strength, Stamina, Healing, Water Walking), 75 tier 2,
  100 tier 3, 125 tier 4, 200 tier 5, Invisibility's 250 tier 6, Purification's 500 tier 7 - every tier holding one, so
  3.2's XP needs no "follows the rank": **20 x the tier a brew** (never a potion: a Brewer's third earns nothing more, the
  Cook's law), quartered more than two tiers below, **+500 the first** - not for a cauldron wholly of the counter's goods
  (Water Breathing, Levitation: AUDIT 32 S1's law). FIRST-BUDGET (section 52): the first is Provisioning's first-make
  share now, 3,155 (`recipeLaw.js` `brewFirstXp`).
- **The potions a brew makes** (9.3: "2 potions at Journeyman and 3 at Master (Brewer 3 at Journeyman)"): DECIDED **one
  below Journeyman** - DFU's own maker's one a mix; **two** since CRAFT-PAYS (2026-10-21, section 48 - AUDIT CRAFT-WRITS
  T7). AUDIT PROF-541 R2-S1: **one at any rank** for a potion wholly of the
  Apothecaries' goods (Water Breathing, Levitation - `brewCount`'s `potion`, `!brewFirstPays`): the counter's silver (a
  fifth of DFU's price) brewed into three potions sold online at half the shop's was gold past the Bank's rate and cap
  (11 silver to 165 gold); the station says it.
- **POTENT** (9.3: "+25% magnitude, named so, at 10% at Expert and 20% at Master, +5% an unbruised herb"; `potentChance`).
  Rolled by the service, **once a brew** (DECIDED: one cauldron, its potions Potent together or not); the rank's own chance none below Expert (AUDIT PROF-541 D1: the rest add at any rank - an unbruised herb, a Distiller's from 50, the town's Apothecary).
  The **Distiller** +10 (3.3); the **Master Alchemist**'s share +40, not +25. DECIDED: an unbruised herb's +5 holds **at any
  rank** (the herb's gift, not the brewer's). The potion is DFU's own (`systems/alchemyItems.js` brewItems - loot.js
  createPotion: its key, price and bottle) carrying the port's **`potent`** field (itemFields: 25 or 40): **named so**
  ("Potent Potion of Healing", itemInfo itemNameParts), **stacked only with its own share** (inventory.js; a split keeps it),
  **drunk at its share** - every magnitude of DFU's bundle raised by it, rounded (`potentEffect`, `hostMagic.js`
  drinkPotion; the three hosts hand the share on) - and, DECIDED, **worth its share more**. DECIDED (AUDIT PROF12 A3 - Mac,
  2026-10-03: **"Potent lasts longer"**): fourteen of the twenty carry DFU's **default magnitude** (every magnitude field 1 -
  the Resists, Slow Falling, Water Breathing, Chameleon Form, Invisibility, Shadow Form, the Cures, Free Action, Levitation,
  Water Walking), and +25% of 1 rounds to 1 - their Potent did nothing. For those, Potent raises the **duration** by the
  same share instead (25%, a Master Alchemist's 40%), and the **chance** where the recipe names one of its own (the
  Resists', the Cures', Free Action's): the rounds (DFU's `rollDuration`) or the percent (`chanceValue`) at the drinker's
  level, the share of it added to the base, rounded - so the settings stay whole numbers, as DFU's are (`magnitudeDefault`,
  `potentLasts`; `hostMagic.js` hands the level on). A Resist Fire drunk at level 10 lasts 14 rounds, not 11 (15 a Master
  Alchemist's). The six with a magnitude (Purification, Orc Strength, Stamina, Healing, Heal True, Restore Power) keep the
  magnitude law; the worth's rise is unchanged. The brew's word and the station say which ("lasts 25% longer" or "+25%
  magnitude"; before a potion is picked, "+25% magnitude or duration").
- **A quick slot keeps Potent and plain apart** (AUDIT PROF12 A2): `quickslots.js` computeKey carries the `potent` share, so
  a slot holding Potent Resist Fire uses and counts the Potent ones, not the plain ones beside them.
- **THE UNBRUISED HERB** (4.3; 5.2: "an unbruised herb (+5% Alchemy Potent chance each)"). FOUND: the Stores keep a unit's
  origin and nothing else (7). DECIDED: an uncommon or rare herb picked with the steady hand clean (every one an
  Apothecary's Friend's) is **counted beside the Stores** at the harvest (`prof_unbruised`, migration 0070); a brew counts
  at most the **own units it spends** of that herb (bought ones are spent first - nobody's steady hand) and at most the
  count, and spends the count with it. A common herb has no moment and never counts. DECIDED (AUDIT PROF12 A1): **the count
  never outlives its herbs** - only a brew lowered it, so an unbruised herb withdrawn to the pack, listed on the market,
  delivered to a writ or deposited with a guild left its count standing, and a later bruised own herb was reckoned
  unbruised. Every spend of own units (`professions.js` spendStatements and spendOrigins - every route's one door) now
  clamps `prof_unbruised` to the own units of that material still held (`unbruisedClamp`, under the spend's own guard);
  the brew lowers its reckoning **before** its spends, so the clamp reads it already lowered.
- **The Apothecaries' counter** (4.5: "the supplier's second ... the sixteen ... at a fifth of DFU's price in Marks, rounded
  up"; `professionLaw.js` REAGENTS, APOTHECARY_STOCK). The sixteen - exactly the ingredients the twenty need and no
  gathering yields (pinned) - each DFU's own item in its own group, at 4.5's prices (pinned to `itemTemplates.json`), the
  smith's stock's route (`/v1/prof/stock`): **bought**, a Marks sink, never own, never gathered (COUNTER_ONLY). DECIDED:
  their Stores family is the **Essences'** (8's filter; no new one), their tier their price's. On the Market tab beside the
  Weavers' (`ui/marketTab.js`), and **at the station** where a cauldron is short of one (the forge's Charcoal's shape).
- **The Transmuter** (3.3: "two of a DFU metal and a Mercury make one of the next up (Tin, Copper, Silver, Gold,
  Platinum)"; 4.1: "Mercury (Alchemy's Transmuter)"; `professionLaw.js` TRANSMUTE_RECIPES). DECIDED: a **work at the alchemy
  station** on the smelt's route - **two of a metal and one Mercury** make one of the next up, own only where every unit
  that went in was; its door the choice at 100 (`prof-transmuter`, 403, before anything moves); **no XP** (a Transmuter's
  track is full). DECIDED (AUDIT PROF12 E3 - Mac, 2026-10-03: **"2 + Mercury -> 1"**): 3.3 said three of a metal, and the
  Mercury 4.1 names was laid on beside them; Mac chose two and the Mercury (`TRANSMUTE_IN` 2) - 3.3's table says so now.
- **ENCHANTING'S LAYER** (9.3: "cost -10% at Journeyman, -20% at Master (Efficient -5% more) - a discount on the player's
  own item, which cheats no one"; `enchantDiscountPct`, `enchantGold`). Online, the professions this account's, DFU's item
  maker asks its gold with the rank's share off (`enchanting.js` enchantDecision's `discountPct`, the window's
  `goldDiscountPct` hook, `profPages.js` enchantGoldPct) - DECIDED rounded up (the enchanter keeps the fraction); offline,
  and for anyone below Journeyman, DFU's own price.
- **DISENCHANTING** (9.3: "a provenance item the player owns becomes Arcane Essence, one per 100 enchantment points it
  carried (Disenchanter x2), into the Stores, and is gone. Loot cannot be disenchanted"; `/v1/prof/disenchant`,
  `alchemy.js` disenchantPiece). **The enchanting station** - DECIDED: a **Mages Guild hall** (the house of DFU's own item
  maker; 50 gold a piece) or a home's **`enchant` station** (HOME-STATIONS', 200,000; a hall member's; its press asks
  online, the item maker or Disenchanting - STATION-DOOR) - `worldModes.js` enchantHere; the Stores page's **The Enchanting Station**, the pack's crafted pieces each its Essence, **pressed twice**
  (the piece is gone). DECIDED - **the points it carried** are its budget as the service knows it from its own record: its
  **DFU template's** enchantment points (`itemTemplates.json`), a piece of jewellery **its own** (PROF10's metal and gem
  shares, by its hand) - never the client's word; the material multiplier DFU's item maker lays on a weapon's or armour's
  budget is not laid on (an Essence is the form's). A dish, a carving and a tool carry none (`prof-no-essence`). The piece's
  `products` row is **deleted** in the same batch (one disenchant a piece - `prof_disenchants.provenance` UNIQUE); refused
  when another's (`prof-not-yours`), listed, on the road or set down in a home (`prof-piece-busy`). **Arcane Essence**
  (680, 4.8): registered on Ectoplasm's picture, undyed (Mortar's finding); DECIDED tier 3, 4 Marks. Its origin: **own**
  where this character made the piece and nobody bought it (7), **gold** where gold bought it (10.8's wall), else **bought**.
  DECIDED (AUDIT PROF12 E1): **Arcane Essence never leaves the Stores** (`NO_PACK_FORM`, beside the Ram Kit) - withdrawn,
  it sold to any shop at its DFU worth (32 gold a unit): a Silver Ring came apart into 18 Essence and some 306 gold, a gold
  faucet and a silver-to-gold road around the Bank's rate and cap. Its uses read the Stores (the market; Runecaster's roll
  to come). The service refuses the withdrawal (`prof-no-pack-form`, 409 - its words now "That stays in the Stores - it
  never goes to the pack."), and the Stores page offers no Withdraw for it, its line saying it stays.
- **Enchanting's XP** (9.3: "comes only from what the service sees"). DECIDED (AUDIT PROF12 E2, replacing "XP follows the
  rank"): **5 x the PIECE's recipe tier an Essence** the piece yields before a Disenchanter's doubling, **quartered** more
  than two tiers below the rank's top (craftXp's rule), and **none for a piece made wholly of goods only a counter sells**
  (`firstCraftPays` - the Weavers' Linen and Wool), under the crafter's limit (`alchemyLaw.js` disenchantXp(recipe, rank,
  essence)). At the rank's own tier, never quartered, Enchanting was the cheapest track of all - 992 silver of counter Linen
  to Master. A Gold Ruby Ring's 21 Essence: 315 XP below rank 70, 78 from it; a Silver Ring's 18: 90, and 22 from rank 40;
  Linen Plain Robes' 7: none. The station says each piece's XP by its recipe (the streaming world hands the recipe on).
- **THE APOTHECARY OPENED** (Seats-Arc 7.5: "members in Alchemy, Cooking, Jewelcrafting here: +1 step"; `fortLaw.js`
  APOTHECARY_OPEN - AUDIT SEATS-2 L5's gate, opened now its three stations stand). A holder's member crafting in its town
  (`seat`, the Forge's and the Workshop's route - `professions.js` seatStepsFor) takes **a step a tier**, each profession its
  own: a **piece of jewellery a quality step** (the Forge's law, nothing past Masterwork); DECIDED **a dish's XP half again**
  - a dish takes no quality (-1), so a step is what the clean pan's step is (35: "the clean act's step is its +50%"):
  `cookXp`'s `steps`, a clean pan in a tier-2 Apothecary's town two and a half times the plain dish's; DECIDED **a brew's
  Potent chance +10** a step (Expert's rung). The brew carries the town (`/v1/prof/brew`'s `seat`) as the craft does.
- **The specialisations** (3.3), Alchemy's four chosen and practised: **Brewer** (three at Journeyman), **Distiller**
  (+10), **Master Alchemist** (+40%), **Transmuter** (the transmutations). Enchanting's at 50 practised: **Efficient** (-5%
  more off the item maker) and **Disenchanter** (Essence x2); its two at 100 chosen, their effects NOT YET (below).
- **The four hosts** (17.1): **building interiors** (`worldModes.js` alchemyHere, enchantHere) - the stations;
  **the streaming world** (`world.js`) - the brew through the book (its fee, its town), the transmutations by the smelt, a
  brew's potions minted (`profMintCraft`), a disenchant (the piece out of the pack on the answer - a realm character's
  through the realm act, its record's piece out in the same batch, AUDIT PROF-541 B2); **every host** drinks a
  Potent potion at its share (`world.js`, `exterior.js`, `dungeonContext.js` drinkPotion); **the fixed city** and
  **dungeons** - no station, as no station stands there (22's law).
- **The service** is **acct70** (acct69 at PROF12; AUDIT PROF-541 moved it); migration **`0070_alchemy.sql`** (`prof_unbruised`, `prof_brews`, `prof_disenchants`); two
  routes (`/v1/prof/brew`, `/v1/prof/disenchant` - a realm character's with `realm`); `prof-transmuter` 403, `bad-brew` 400, `bad-piece` 400, `prof-no-piece`
  404 (`why: 'disenchanted'` where this account's disenchant took it), `prof-not-yours` 403, `prof-piece-busy` 409, `prof-no-essence` 409,
  `prof-piece-gone` 409 (a realm record that does not hold the piece loose). No relay change.
- **Not built, named (NOT YET)**: **enchanting a provenance piece at a station** for XP, its enchantments written onto its
  product record (9.3) - the market mints a piece from its record, and an enchantment on it would want the record's shape
  and the mint's to change: a slice of its own; **Soulbinder** (filled soul gems +10% points) and **Runecaster** (a
  Masterwork's property chosen of three, 5 Essence a Rare roll) - chosen, their effects to come with that slice (the
  Masterwork's Essence spend is a Smithing change); **a potion on the market** (a potion stacks and carries no provenance -
  it trades by TRADE1 as any loot); the item maker's **material multiplier** in Disenchanting's points (above); the
  station's **unbruised word per herb** on the page (the count is the service's; the page says the +5 a herb). **AUDIT
  PROF12 E5** (LOW) - ACCEPTED: the same trust boundary as a market listing's; moot now Arcane Essence never reaches the
  pack (E1).
- **Audited** (2026-10-03, AUDIT PROF12 - the economy's and Alchemy's lanes; acct69, changed in place, no migration): **E1**
  (HIGH) Arcane Essence withdrawn sold to shops for 32 gold a unit - it stays in the Stores now, the service refusing the
  withdrawal and the page offering none; **E2** (MED) Enchanting's XP by the rank's tier, never quartered - by the piece's
  tier now, quartered, none for the counter's goods alone; **A1** (LOW) the unbruised count outlived its herbs - clamped at
  every own-unit spend; **A2** (LOW) a quick slot took Potent and plain for one kind - the share is in its key; **A3** Potent
  did nothing for fourteen potions - they last longer (Mac's choice); **E3** the Transmuter's three of a metal - two and a
  Mercury (Mac's choice); **E5** (LOW) accepted (NOT YET, above). Each pinned (eleven tests), 30 mutants added, all dead.
- **Audited again** (2026-10-03, AUDIT PROF-541 - acct70, no migration): **B1** (MED) DFU's int32 cauldron hash collides
  (a Purification with Jade for its Diamond; a Healing of 17 19 62 65) - `brewSpends` asks the recipe's own ingredients
  too, after DFU's hash; **B2** (MED) a disenchant never took the piece from the player - a realm character's now leaves
  its record in the disenchant's own batch (`takeTradeGoods`, as MARKET-ANY's listGood; `prof-piece-gone` where the
  record does not hold it loose - a piece sold to a shop or traded away is the maker's row's still), an offline save that
  kept one past a lost answer lets it go on `prof-no-piece` with `why: 'disenchanted'`, and a crafted piece's placement
  asks its products row inside the INSERT; **B3** (LOW) a Potent Cure Disease or Cure Poison did nothing (an instant, its
  chance bypassed as drunk) - never Potent now (`potentAble`: the roll still cast, the station says so, the mint none);
  **B4** (LOW) the station's Potent chance left out the town's Apothecary - said now; **B5** (LOW) a realm character's
  delete left its unbruised count; **B6** (LOW) a Levitation's brew was called the first, paying no 500; **B7** (MED) a
  piece crafted of the counter's goods was `own`, its Essence own and listed for gold over the wall - bought with Drakes
  now (`products.bought_with` 'marks', read before the spends), its Essence bought; **B8** (LOW) Disenchant pressable past
  the Stores' room - shut, the room said. Pinned (nine tests), 23 mutants added, all dead; nine re-aimed by content (prof12, prof3, prof9, guild_yard, gatekeys).
- **Audited a second round** (2026-10-03, AUDIT PROF-541 R2 - acct70, no migration): **S1** (HIGH) a cauldron wholly of
  the Apothecaries' goods brewed a rank's two or three potions - silver into gold past the Bank (above) - one now;
  **S2** (MED) a Marks piece listed for gold from another account's pack - refused (`market-drakes-goods`); **S3** the
  refusal's words: a piece made of counter goods is silver's (10.8); **S4** (LOW) a disenchanted piece's auctions and bids
  vanished from "My listings" (an inner join on its deleted row) - left joined, named by its disenchant's recipe; **S5**
  (LOW) a Ram Kit's origin was read before the craft's batch - read in its own INSERT now, as B7's; **S6** (LOW) arrows
  (no provenance in the pack, never listed) disenchanted - refused (`prof-no-essence`, `pieceListable`); **S7** (LOW) a
  dish's 500 paid twice, north and south - once a dish (`firstCraftKey`, J7's "once per piece and base"); **S8** the
  service's route list. Pinned in eight tests, 19 mutants added, all dead; four re-aimed by content (prof12, seat2b_peace).
- **DISENCHANT-SAID** (FIELD BUGS 2026-10-19f, a player's private report: crafted greaves and pauldrons could not be
  disenchanted; the owner, 2026-10-19: "List them greyed with the reason"). The law stands: a piece's points are its DFU
  template's, one Essence a hundred - the **Greaves 50** and **either Pauldron 40**, so none at any metal, of chain or of
  leather (and most of DFU's garments, 5 to 80), and the service refuses them (`prof-no-essence`). What was wrong was the
  silence: the station's list dropped every piece under one Essence and the page explained only a list with nothing on
  it, so the greaves vanished without a word. The station now **lists them greyed**, `{points} points: under one Arcane
  Essence (100 points make one)` beside each (l10n `prof.page.enchant.under`, the hundred the law's `ESSENCE_POINTS`), its
  Disenchant disabled and never asked; the line for nothing to take apart stands while no piece gives Essence. A form with
  no points at all (a dish, a tool, a Repair Kit, the mason's stone) is no enchanter's piece and stays off the list.
  HOST-SPLIT: the list is made by the page's module (`profPages.js` disenchantableOf - the pack's crafted pieces that may
  leave it, its points, its Essence, a Disenchanter's twice, its recipe); `world.js` wires it in one line, and bootWorld
  came down 8 logical lines (its ceiling 36,233 -> 36,225). Pinned: `test/systems/fb1019f_disenchantsaid.test.js` (3);
  PIN MOVED `prof12_client.test.js` (AUDIT PROF12 E2's host pin, onto the module and the wiring line);
  `tools/mutants/fb1019f_disenchantsaid.json` (13, all dead).
- **ESSENCE-LOOSE** (FIELD BUGS 2026-10-20h, the Discord's #bug-reports: a player's Arcane Essence "bought with gold";
  `01-Overview/bugs/Field-Bugs-2026-10-20h.md`). A piece made or tempered with a LOOSE unit (`Materials-Bag.md` 15, A1) is
  walled to gold on its row, and the disenchant read that as a gold purchase: its Essence went into the Stores as gold's,
  and the Reforge with Essence refused it. Its origin is now **loose** where the piece's goods walled it
  (`products.loose`, migration 0142, acct166) - a station's, as a smelt's products of loose goods are - and **gold** where
  gold bought it, as before; the Reforge spends as a station does, loose first. The Stores page says a no-pack-form
  material's loose units are "made from pack goods", and its gold line no longer offers the pack.
- **Pinned**: `test/systems/prof12_law.test.js` (15), `test/net/prof12_service.test.js` (13, through the real Worker),
  `test/systems/prof12_client.test.js` (16), `test/net/prof12_apothecary.test.js` (4, the Apothecary through the real Worker). Mutants:
  `tools/mutants/prof12.json` (206: 205 dead - AUDIT PROF-541 R2's six among them - and PROF12-spends-no-hash recorded equivalent - B1's ingredient comparison holds everything DFU's hash refused).

## 38. PROF2b - the Motherlodes, as built (BUILT 2026-10-03)

Mac: **"plus we need to build motherloads"** (beside SILVER-WAYS, `06-Systems/Online-Arc.md`). Section 6 named them -
three a day, the first twenty, 10 Marks, one an account a day, the relay's socket in the pixel's cell room, the hub's
warning - and left four things open. DECIDED here (the record's, at Mac's instruction), and what was found (FACT):

- **Where they rise - witnessed ground.** FACT: the service holds no map; it knows a pixel's climate and region only as
  three accounts confirmed them (SEAT0 3.2, nodeLaw `witnessedFact`). DECIDED: the day's first read picks the day's
  three from the pixels confirmed BEFORE the day began - a set the day cannot change - by `hash(MOTHERLODE_SALT, day, k)`
  over them in one order (y, then x), the Mountain, MountainWoods, Desert and Desert2 pixels first and every vein-bearing
  one where those are fewer than three; and keeps them (`motherlodes`, migration 0072 - 0070 on its branch). A realm nobody has walked has
  none; the next read asks again. Its ore is its region's signature where that is a tier-6 ore (Sentinel's Ebony, the
  Wrothgarian Mountains' and Orsinium's Orichalcum, Balfiera's Adamantium), else one of the three by the day's roll.
  `src/net/motherlodeLaw.js` `motherlodeSites`, `server-account/src/motherlodes.js` `motherlodesOf`.
- **When.** Each in its own third of the UTC day, rising within its third's first six hours on a whole minute, standing
  two hours or until its twenty have struck it - so every part of the world's day sees one.
- **The warning - every client's own.** FACT: the hub pushes nothing on a clock today; the gate's omen is each client's
  own off the shared clock (`systems/gate/gateOmen.js`). DECIDED: the same - `net/motherlodeBook.js` reads the day's three
  (`/v1/prof/motherlodes`: their pixels, ores, hours, strikers and this account's find) on arrival, every five minutes,
  at the UTC day's turn and for another character, says the warning in the chat ten minutes ahead (a Motherlode Sense's
  thirty) and the rising once, each once a session. No relay change, no relay deploy.
- **The relay's word - the Watch.** FACT: the relay already signs, every two minutes an account moves in a town's cell,
  a `k1` receipt naming the account and the map pixel its pose stands in (SEAT1b, `net/watchReceipt.js`), for any cell
  room - the client's seat book kept only a seat's. DECIDED: that is section 6's socket check, and tighter (the pixel,
  not the cell): the Motherlodes' book keeps the newest receipt of each pixel (this account's, signed, eight pixels), a
  strike begun carries the Motherlode pixel's (`ask.watch`, riding the harvest through `net/profBook.js`), and the
  service counts the strike only for a receipt of this account on the Motherlode's pixel issued within ten minutes before
  the act's end and no later than it, give the clocks' thirty seconds (`motherlodeWatchOk` - AUDIT SILVER-WAYS C1). None
  yet: no act ("The Watch has not seen you on the Motherlode's ground lately. Walk about on it a moment" - the relay marks
  a pose that moved in its last five minutes, every two minutes; AUDIT SILVER-WAYS D3). The receipt is asked again at the
  act's end, the newest standing then (D5), and only ever this account's (D6).
  A pose is the client's claim, so this is a bound, not a proof (section 6) - the twenty and the one a day are the rest.
- **The rank - an Apprentice's.** Section 6 says "a tier-6 vein"; tier 6 asks Mining 90 (TIER_RANKS), which nobody on a
  realm days old holds, and a Motherlode is the realm's event - its contest is the clock and the twenty. DECIDED: the act
  is tier 6's (seven points, its glints bound as a vein's), the XP tier 6's, and a strike asks Mining 25.
- **The strike.** Through `/v1/prof/harvest`, its node `mlode:<day>:<k>` (index.js hands it to `strikeMotherlode`), so
  the client's kept-harvest pipeline - the queue, the pump, the toasts, the rank's rise - is the vein's. One statement
  decides: the Motherlode standing at the act's end, its twenty, the account's one a UTC day (`motherlode_strikes`' key),
  the Stores' room; its 4-6 ore (half again clean) into the Stores as the character's own, the XP to Mining, and the
  `motherlode` faucet's 10 silver to the account (its line `motherlode:<day>` - once a day), each by the strike's own
  nonce. None of the day's sixty harvests is spent (CAP-OFF, 2026-10-07: there are none to spend). Refusals: `motherlode-closed`, `motherlode-watch`, `motherlode-found`,
  `motherlode-full`, `prof-rank`, `stores-full`.
- **Where it stands.** `scenes/mineHost.js` `standMotherlodes`: at the foot of the rock piece nearest its pixel's heart,
  clear of the pixel's veins and boulders by NODE_SPACING_M, else on the stone nearest its heart, else where nature
  stands there, else the nearest place outside its pixel's town that holds one (AUDIT SILVER-WAYS D4 - a town over the
  heart stood it nowhere); a heap of seven of its ore's flats at 3.3 (a vein's three at 2.2), glowing, on the compass from 400 m
  (`MOTHERLODE_MARK`) - and from anywhere on the street while it stands, a Mining mark at its pixel's heart
  (`scenes/world.js` `motherlodeMarks`). A rising, a going, a twentieth striker and this account's find each stand its
  pixel again (`gatherHost.restandAt`).
- **Motherlode Sense** (Mining 100) is chosen as any specialisation now (`later` struck; the Professions page's card
  no longer says "Comes with the Motherlodes").
- **Not here, named**: gate-touched ground (4.7 - a gate receipt still carries no pixel); the Motherlode's Recipe Scroll
  (1 in 20, PROF6b's roll); the four hosts: the Motherlodes stand in the streaming world alone (`scenes/world.js` - the
  one gathering host); `scenes/exterior.js` has no gathering host (prof2_client pins it), `scenes/worldModes.js` and
  `scenes/dungeonContext.js` stand no Motherlode - one is never underground or indoors (FLAGGED by name, as PROF2's veins).
- **Audited** (2026-10-03, AUDIT SILVER-WAYS - `06-Systems/Online-Arc.md` holds the record): **C1** the Watch had a floor
  and no ceiling - an act told as ended inside the two hours, sent after them, carried a receipt the relay issued after
  the Motherlode had gone; now no later than the act's end. **C2** a strike made while silver was shut, answered again
  once it opened, said the purse was full; now it says no silver. **C3** a day that picked fewer than three kept no mark,
  so every read and every strike read the whole witnessed ground again - the day's mark is kept (`motherlode_days`, none
  among the marks), and its picks are written only under the mark their own read made. **D1** the day's turn was asked
  every frame while its read failed - now once a retry, at each device's own moment in a ninety-second spread. **D2** a
  strike's refusal (`motherlode-full`, `-found`, `-closed`) taught the client nothing - now learned, the pixel stood
  again. **D3**-**D6** as above. **D7** the frame's costs: the account read once a second, the compass's list and marks
  its own.
- **Identity follow-up** (2026-10-03, Bugs update audit; local candidate, not deployed): a delayed Motherlode read
  is applied only to the account and character that requested it. A Watch receipt is checked against the current
  account at receipt arrival and at the strike, even within the frame's one-second account cache. This prevents a
  departed account's found marker or receipt from being used by its successor. The server's signed-receipt checks
  are unchanged. `test/net/motherlode_identity_regression.test.js` reproduces both identity races and pins the fixes;
  the frame cache remains in use. Native account switching and live multiplayer acceptance remain open.
- **As built**: `src/net/motherlodeLaw.js`, `src/net/motherlodeBook.js`, `server-account/src/motherlodes.js`,
  `server-account/migrations/0072_motherlodes.sql`, `src/scenes/mineHost.js`, `src/scenes/gatherHost.js` (`restandAt`),
  `src/net/profBook.js` (`watch`), `src/net/accountClient.js` (`motherlodes`, the refusals), `src/scenes/world.js`; acct71 (acct66 on its branch).
  Pinned: `test/net/prof2b_motherlode.test.js` (6), `test/net/prof2b_client.test.js` (7); `tools/mutants/prof2b.json` (32, all
  dead). AUDIT 29 A17's two pins moved (the Sense chosen as any). The audit's: `test/net/auditsilver_service.test.js` (C1-C3),
  `test/net/auditsilver_client.test.js` (D1-D7), `tools/mutants/auditsilver.json`.

## 39. BAG1 - the Materials Bag, as built (BUILT 2026-10-03)

Its own page: `Materials-Bag.md`. A bag bought at every General Store online (about 500 gold), carried as the wagon is
(300 kg, materials only); every harvest into it, then the pack, the rest into the pack past its weight (PACK-OVER,
FIELD BUGS 2026-10-04: it had been left where it was gathered, counted and never made); the Stores kept in
town, put in and taken out there; law 3 restated over the service's carried count (section 1); a station's shortfall
put in from what is carried before it spends.

## 40. CAP-OFF - no day's cap on the life skills (BUILT 2026-10-07)

Mac: **"Remove the cap on life skills"**. Asked which of the three - the day's harvests, the rank's ceiling of 100, the
crafter's limit of two crafts above Journeyman (3.2) - Mac picked the day's; asked whether the two bounds that stand
between a modified client and an unbounded claim go with it: **"Keep both"**.

- **What went.** A gathering profession's 60 harvests a character a UTC day (the Basket's among Herbalism's) and 120 an
  account in a craft (AUDIT 29 A3); Fishing's 40 hauls an account; Hunting's 30 hides an account. The service asked them
  in the harvest's own INSERT and said `prof-cap`, `prof-account-cap`, `prof-fish-cap` and `prof-hunt-cap`; it asks and
  says none now (`server-account/src/professions.js` harvestNode, the INSERT's parameters renumbered past the four it
  bound), and the state's `caps` carry no `harvests`, `hides` or `hauls`. The law exports none
  (`src/net/professionLaw.js`; REFUSALS-LEARNED's `NODE_PROFESSIONS`, read only to close the account's craft, went with
  them). On the client each node's plan offers its act whatever the day's count (`scenes/mineHost.js`, `treeHost.js`,
  `herbHost.js`, `fishHost.js`, `huntHost.js`), the book learns nothing from the four refusals (`net/profBook.js`), the
  gathering host closes no craft (`scenes/gatherHost.js`), the chip under the compass says the count alone - "Mining 34 -
  12 today" - and the Professions tab's day line too ("Today: 12 harvests"; Fishing's hauls, Hunting's hides beside the
  rare three - `ui/professions/profPages.js`). The daily reset's line names no gathering limit (`systems/eventTimers.js`).
- **What stands (Mac's word).** Four veins a day an account in dungeons nobody has vouched for (AUDIT 29 A5: a dungeon's
  id is the client's word) and three hides of tiers 5-6 an account a day (section 6: the tier is the client's claim) -
  each still decided in the INSERT and refused at its count, past every old day. And the rest of section 6 and 20: each
  node once a character a day, the travel between them, the hour's 600 writes (`PROF_OPS_MAX`), the Stores' 5,000 a
  material, SILVER-FINDS' 30 silver a day from gathering (10.5), the three Court writs a day (CHAP2a: the Court's and the halls' together).
- **DECIDED.** The four refusals' words stay in the client, without the numbers they no longer hold, for a client that
  meets a service not yet redeployed - ANY-HOUR's way with `prof-night` (the site's deploy waits for the service's
  version, so it is a short window). The chip stays: it still says the rank and the day's count while a node is under the
  look. FACT: what the day bound before is bound by the world now - the nodes and the walk between them - and by the
  hour's writes; a modified client that invents characters is bounded by the hour alone, as Mac chose. The economy model
  (Appendix C) moves nothing: its players' harvests are its own assumptions, never read off a cap.
- **The four hosts.** None changed: the gathering host is `scenes/world.js`'s (its dungeons' veins through
  `worldModes.js`); `exterior.js` and `dungeonContext.js` build none.
- **As built**: `src/net/professionLaw.js`, `server-account/src/professions.js`, `server-account/src/index.js` (the four
  statuses gone), `src/net/accountClient.js`, `src/net/profBook.js`, `src/scenes/gatherHost.js`, the five kinds,
  `src/ui/professions/profPages.js`, `src/systems/eventTimers.js`; acct91, no migration. Pinned: `test/net/cap_off.test.js` (5); the pins
  that held the caps turned to say they are gone, each a PIN MOVED (`prof1_law`, `prof1_service`, `prof2_service`,
  `prof7_law`, `prof7_service`, `prof8_law`, `prof8_service`, `audit29_service` A3, `audit32_service` L2,
  `audit32_client` B2, `silverfinds_service`, `fb1001_ground` and `fb1001_audit` REFUSALS-LEARNED, `fb0929h_veinneed`,
  `fb1001_herbxp`, and the plans' in `prof1_client`, `prof2_client`, `prof4_client`, `prof7_client`, `prof8_client`);
  the stand-in books' `caps` the shape the service mints. `tools/mutants/cap_off.json` (13, all dead); 25 records the
  change moved re-aimed by content - or, where their law is gone, turned to put the cap back, which the turned pins kill
  (`audit29`, `audit32`, `bag1`, `fb1001_ground`, `prof1`, `prof2`, `prof7`, `prof8`). FOUND, not this slice's:
  `AUDIT29-A17-motherlode-sense-chosen` survives on main as here (PROF2b moved A17's pins to the Sense chosen as any).

## 41. CRAFT0 - fewer moving parts, a crafter worth seeking (DECIDED 2026-10-07); CRAFT1 - the chain, as built (BUILT 2026-10-07); CRAFT2 - patterns, as built (BUILT 2026-10-07); CRAFT3 - five crafts, as built (BUILT 2026-10-07); CRAFT4 - tempering and reforging, as built (BUILT 2026-10-07); CRAFT5 - the consumables, as built (BUILT 2026-10-07)

Mac: **"How could we enhance the profession element of the game while reducing complexity and making crafting more
viable"**; given the five proposals below, **"This is amazing. Lets do it"**. Each is DECIDED (Mac) as a direction; the
numbers in each slice are DECIDED (the record's, at Mac's instruction - "I want you to make the decisions"), and each
slice is built and pinned on its own (Home's "one feature at a time").

### 41.1 What stood (MEASURED, 2026-10-07)

- **The surface.** 13 professions (3.1), 26 choices among 52 specialisations (3.3) and **815 recipes** (recipeLaw `RECIPES`: Outfitting
  334, Smithing 308, Jewelcrafting 120, Carpentry 42, Cooking 7, Masonry 4) - most of them a product times a material.
  A recipe's first make pays **+500** (3.2), so a track climbs by walking the matrix, not by making what is wanted;
  AUDIT 32 S1 already closed one road of it (Outfitting 87 for 811 Marks of a counter's goods).
- **The chain.** A Steel Longsword (recipeLaw `longsword:steel`) asks 3 Steel Ingots, 1 Copper and 1 Cured Leather: from
  what a gatherer holds, 6 Iron, 3 Pine Logs, 1 Copper and 2 Rat hides, through four works (smelt the Iron, burn the
  Pine, smelt the Steel, cure the hide) at two stations, before the anvil - for DFU's own Steel Longsword, which every
  Weaponsmith shelves and every dungeon drops.
- **The ceiling.** Law 7: a craft reaches Rare at most (a Masterwork, 8% at the best margin - 13 with a Masterwright's points, 9.2); loot reaches
  Legendary, Aetheric, Artifact and Sigil. A crafted piece is never the best a slot holds.
- **What already works**: what wears out or is eaten - the tools (a Standard tool's 50 harvests, `TOOL_LIFE`), Repair Kits, arrows, dishes and the
  party's Feast, Potent potions, Ram Kits and the fortifications' stone, decor. Loot does not flood them.

### 41.2 The five slices

| Slice | What | Its numbers (DECIDED) |
|---|---|---|
| **CRAFT1** | **The chain** - a station plans the refining a craft needs from what is held and runs it before the craft (41.3) | Every work of the forge, workbench, loom and mason's bench (`WORK_RECIPES`), never a transmutation; **never down a tier** (a work whose input is above its product's tier: no wood but Pine burnt to Charcoal, no Tiger cured to Cured Leather, no Dragonling to Hardened) - those stay a deliberate press; the table's first work first; at most 4 deep (a guard - no product's works are more than two deep); the works pay no station fee of their own (the craft's fee stands) |
| **CRAFT2** | **Patterns, not a matrix** - the station's window lists ~40 patterns (Longsword, Cuirass, Robe, Ring...) and the material is chosen from what is held; the service's recipes stay as they are (41.5) | The first-make **+500 moves to a pattern at a tier** (the first Longsword of tier 6, not the first Adamantium, Ebony, Orcish and Warforged Longsword - MEASURED at the build, 41.5: Steel is tier 2 and Silver 3, so the example this cell first gave named two tiers); AUDIT 32 S1's counter-goods rule kept |
| **CRAFT3** | **Five crafts, not eight** - Smithing (+ Jewelcrafting), **Building** (Carpentry + Masonry), Outfitting, **Provisioning** (Cooking + Alchemy), Enchanting; the five gathering professions stay | A merged track takes the **higher** of its two parents' XP; its choices at 50 and at 100 are its parents' four, one chosen; a character who chose under both keeps the higher track's and re-chooses free; the crafter's limit stays two above Journeyman - of five, a real choice |
| **CRAFT4** | **Tempering and Reforging** - the crafter improves what loot gives, never past law 7 | **Temper** (Smithing for weapons and metal armour, Outfitting for leather and cloth): **+1 quality step** on any piece of Rare or below, up to **Superior** (a Masterwork stays a maker's), for half the piece's recipe's ingots (or leather, or bolts) of its material, rounded up, at the material's tier's rank; craft XP. **Reforge** (Enchanting 50): one property of a Magic or Rare piece replaced by one of another kind (REFORGE-REPLACE, 2026-10-25, the owner: "Replace, price rises" - 41.7), for **2** (Magic) or **5** (Rare) Arcane Essence the first time, doubled for each reforge the piece has taken. Legendary, Aetheric, Artifact and Sigil pieces are neither (law 7). A provenance piece's record is re-signed with its new quality, so the market sees what it is; a save's own piece is the save's word, as its condition is - the Stores' spend is the bound |
| **CRAFT5** | **The consumables, leaned into** | A Superior or Masterwork Repair Kit mends up to **0.90** of a piece's condition (`KIT_CEILING` 0.75 for the rest); a dish's buff and a Potent potion stand together - TO MEASURE first whether either already overwrites the other; arrows a Building product (CRAFT3) |

Nothing here touches law 1 (offline stays DFU's makers), law 3 (the Stores) or law 8 (Marks).

### 41.3 CRAFT1 - the chain, as built

- **The law** - `src/net/chainLaw.js`, pure: `chainPlan(inputs, held, { track })` answers `{ ok, works, spent, short }` -
  the service's works in the order they are asked (dependencies first; a work asked twice in a row asked once; each
  request at most `SMELT_MAX`), every held unit the plan takes, and what nothing covers, named **at the bottom of the
  chain** ("short 2 Iron", not "short 3 Steel"). Held first; then each work that makes the product, the table's first
  first, each covering the most units the held can carry (a search over the count), the next work only for the rest;
  what a work made past its need is there for the next input (one Pine Log saws to the two planks two inputs ask). The
  rank and the choices are the service's own reading (`workOpen`; `chainYield` - `workPer` at `workSpecRank`: a Tanner's
  cure two leathers, a Timberwright's saw three planks, Mortar's rank 10). `CHAIN_WORKS` the 27 works a chain may plan.
  FACT, pinned rather than sorted: every product two works make stands in the table cheapest first (Rat, Bat, Bear;
  Scorpion, Slaughterfish, Dreugh).
- **The book** - `src/net/profBook.js` `craft`: where an input is not held as it stands (`chainNeeded`), the plan is
  made from the book's `held` (the Stores and what is carried) and `track`; a plan not ok asks no work, and the craft
  is asked as it always was - the book's view of the Stores is not the service's (a stale read, a stand-in), so the
  service still says what is short, and the page has said the bottom of the chain already; else each work is the
  book's own `smelt` with
  **`stay`** (its product kept in the Stores - BAG1's carry-out skipped, so the craft finds it there and nothing makes a
  round trip through the bag), in order, and then the craft as before (kept, minted once). A work refused stops it:
  nothing kept, the works before it done and said (`refined`), their products in the Stores. `chain: false` asks no
  work. **No new door**: every work is `/v1/prof/smelt`, its XP, its origin (own or bought, smeltOrigin) and its bounds
  the service's as ever, and the service is not changed.
- **The stations** - `src/ui/professions/profPages.js`: the anvil, the workbench, the loom, the mason's bench and the jeweller's
  bench say **"can make from raw"** on a recipe the chain covers, say under it what is refined first and from what
  ("Refined first, here: smelt Iron Ingot x3, burn Charcoal x3, smelt Steel Ingot x3, cure Cured Leather x1 - from Iron
  x6, Pine Log x3, Rat Pelt x2. Their XP is the works' own; what is left over stays in your Stores."), or what the raw goods are short of, and offer Craft and Quick craft on it. The fire's
  dishes take no refined good and are unchanged.
- **The answer** - `src/scenes/world.js`'s craft says what the chain refined, with each profession's XP, before what
  was made ("Refined first: ... (+90 Smithing XP). Steel Longsword ..."), and after a refusal too (chainLaw
  `refinedText`).
- **DECIDED**: a chain's works pay no fee of their own - the station's fee is the craft's (the service cannot see a
  station, 9.1; the fee was the press's, and the chain is one press).
- **The four hosts**: `scenes/world.js` wired (the stations' pages and the craft's answer are its alone); `worldModes.js`,
  `exterior.js` and `dungeonContext.js` build no station page - none to wire.
- **As built**: `src/net/chainLaw.js` (new), `src/net/profBook.js`, `src/ui/professions/profPages.js`, `src/scenes/world.js`.
  Pinned: `test/net/craft1_chain.test.js` (10 at the build; 16 since AUDIT CRAFT1, 41.4) - the done-when through the real Worker (a Steel Longsword from raw goods in
  one press: the four works asked in order as the service's own, every unit spent, Smithing the works' XP and the
  craft's), the law, the book over a stand-in door, the anvil page, the host. `tools/mutants/craft1.json` (15 at the build, all dead; 51 since 41.4 - 49 dead, 2 equivalent as recorded).
  FOUND, and taken out rather than pinned: a cheapest-first sort that no product's table order ever needed (its mutant
  survived) - the order is the table's, and the fact is pinned. FOUND by the suite: a first cut refused a craft the
  book's plan could not cover before asking the service - seven book tests over stand-in doors (no Stores read) went
  red, and a stale read would have refused a craft the service would make; the plan now only adds works, never refuses.
  PIN MOVED (the craft's refusal now says what the chain refined): `audit30_client` C4 + A4, `prof12_client` R2-C2,
  `prof3_client` wiring. Mutant records re-aimed by content, each still dead: `audit32` B4, `bag1` K5, `prof10`'s one
  act a page.

### 41.4 AUDIT CRAFT1 (2026-10-07, Mac: "I give you autonomy. Just ensure it's perfection")

Three cold reviews of a frozen snapshot of the head (the law against the service; the client's flow; the tests and the
record), none fixing while the others read. No blocker, no major. The law's review fuzzed 14,300 holdings over every one
of the 220 input shapes the 815 recipes ask against a model of the service and a brute-force search: no ok plan the
service refuses, no plan missed. What it found, and what was done:

| | Finding | Done |
|---|---|---|
| F1 law | A plan could be ok where the Stores had no room for a product - the service counts every origin, gold's too (`stores-full`) | `chainPlan`'s `room`: a work never makes more than the room leaves; a plan that would is `full`, and the bench says so. `storesRoom` the service's count from the book's view |
| F2 law | An earlier input's works could spend a raw good a later input asks as it is (order-dependent; no recipe today) | every input's held units taken before any work is planned |
| F3 law | `spent` booked a work's spare product as held (no recipe today) | the plan keeps what is held and what its works made apart; only the held is `spent` |
| F4 law | The answer said what was made from the yield the book reads now | the book keeps each work's made (the service's own and bought); `refinedText` says that |
| F1 client | A chain's work and a station's press of the same work and count shared one id - a forge press under the chain was answered the chain's kept products, and paid the smith for them | the chain's works asked under their own id key; and every station's work rows held while a craft RUNNING ITS CHAIN is in flight (the chain may run any station's works) - a craft of what is held keeps AUDIT 32 P5's word, its station's works live under it (a first cut held them under every craft, and P5's pin said no) |
| F2 client | A chain answer lost, the page went on offering a plan the service refused (`stores-short`) until the day turned | a work refused for what the Stores hold has the book read again (REFUSALS-LEARNED's `reread`) |
| F3 client | A kept craft's word hid what its chain refined | said with it |
| F4 client | A refused chain did not say where it stopped | "The chain stopped at the Charcoal, short of Pine Log." (`chainStopText`) |
| N1 client | Another bench's act could be played under a craft in flight, to end in `prof-busy` | the hands are at a bench while its craft is in flight, as while its act is |
| F5, F6 law | The depth's comment was wrong; a carrying book's `held` read the pack and bag ten times a row | the comment says what is true (no product's works are more than two deep); `held` read once a key a plan |

The third review (the tests' and the record's honesty) ran 47 mutants of its own on the head as the first two had read it:
34 lived through `craft1_chain`, 27 through every file that reads the three modules. Every one is answered now - pinned, or
recorded `equivalent` with its reason:

| | Finding | Done |
|---|---|---|
| R1 | The chain's `stay` held by a source pin alone - a craft with a bag round-tripped every work's products through it (8 calls more), and stayed green | the done-when's twin through the real Worker with a Materials Bag: the request paths deepEqual four smelts and the craft |
| R2 | The workbench's, the loom's, the mason's and the jeweller's rows unpinned (the word, the lock, `raw`); "the four other benches (source pins)" said more than it held | all four drawn - a staff from Pine Logs, a cuirass from Rat Pelts, the Sculptor's column from Rough Stone, a bracer - each row, note and Craft asked; a rank-locked row a chain could feed stays locked |
| R3 | The yields said (the note's, the answer's) unpinned past one a work | a Timberwright's three planks on the note and in the answer, a Quartermaster's two ingots, a split past SMELT_MAX summed |
| R4 | The book's hand-off of its tracks to the plan unpinned (the page offered what the book would not run) | a Tanner's two leathers of two hides, asked as one cure |
| R5 | A refused work's `material` and `elsewhere`, and `refined` after the craft's own put-in failed, unpinned | each pinned (the character switched under the first work; the Copper's put-in refused after four works) |
| R6 | The stand-in door minted XP for a burn and a cure, which the service never does | the stand-in mints the service's shapes - no XP for a work with none, its tracks as `trackView` mints them |
| R7 | Headroom no pin can see: the depth, the cycle path, the strict pass before the lenient | the cycle path and the strict top pass taken out (the depth bounds the recursion; the lenient pass covers strictly first); the depth's guard and the book's `chainNeeded` recorded `equivalent`, each with its reason; the lenient pass's spare pinned |
| R8 | The record's slips: "Rat Hide" (the label is "Rat Pelt"), "26 specialisations" (26 choices among 52), "+120" in a comment (+90), the depth's comment, the Masterwork's 8% (13 with a Masterwright), the tools' life (by quality) | each corrected |
| R9 | `prof3_client`'s moved pin allowed any lines between the craft and its refusal | it names the three |
| aside | The book ran a chain for a recipe its rank does not open, then the craft was refused `prof-rank` | no chain for a recipe the rank does not open - the craft is asked as ever |

Kept as they are: the counter's "Buy" beside an input the chain would make (a choice - buy rather than refine); a
`prof-chain` style (none needed, the note is the kit's). Pinned: `test/net/craft1_chain.test.js` (16 - +6 for the audit);
`tools/mutants/craft1.json` (51: 49 dead, 2 equivalent as recorded - +36). PIN MOVED again (the kept word says the chain): `audit30_client` C4 +
A4, `prof12_client` R2-C2, `prof3_client` wiring. Re-aimed by content, each still dead: `audit32` B4, `prof9`'s,
`prof10`'s and `prof11`'s hands-not-at-the-bench (the hands held under a craft too).

### 41.5 CRAFT2 - patterns, not a matrix, as built (BUILT 2026-10-07, Mac: "Its not finished")

- **The law** - `src/net/recipeLaw.js`: every recipe carries its `pattern` (the piece's word whatever it is made of -
  "Longsword", "Chain Cuirass", "Arrows", "Hunter's Stew") and its `madeOf` ("Mithril", "Harpy Feathers", "northern
  Root Bulb"; "" where a pattern is made one way). `recipePattern` is the recipe's `product` (`longsword`, `garment-163`,
  `stew`) - FACT, pinned: no product id is two professions'. `patternsOf(list)` groups a list into its patterns, each
  once in the list's order, its materials in theirs.
- **The first-make 500** (FIRST-BUDGET, section 52: since 2026-10-25 its track's first-make share - Smithing's 500 as it
  was) - `firstCraftKey` is the pattern AT ITS TIER (`longsword@6`), `firstCraftKin` every recipe of it
  (at most 18 - the Wand at tier 6, two woods and nine gems). It holds both the exceptions the old key carried: AUDIT
  PROF-541 J7's piece and base (a jewel's base is its tier: `ring@3` is `ring:gold`, whichever gem) and R2-S7's dish (its
  two herbs' ways one tier). Two firsts became one where a pattern shares a tier: the Wand's two woods, and the Arrows'
  three fletchings (one quiver, tier 1). AUDIT 32 S1 stands beside it unchanged - FACT, pinned: no pattern at a tier
  holds both a recipe that pays and one wholly of the counter's goods. MEASURED: 663 recipes pay a first; the firsts
  they paid were 561 (Smithing 308, Outfitting 182, Carpentry 42, Jewelcrafting 21, Masonry 4, Cooking 4) and are 446
  (201, 180, 37, 20, 4, 4). The metals that share a tier are tier 4's (Elven, Dwarven) and tier 6's (Adamantium, Ebony,
  Orcish, Warforged); every other tier is one metal, so the anvil's firsts fall by a third and the loom's barely (each
  cloth and each leather is its own tier).
- **The service** - `server-account/src/professions.js` `craftAtAnvil`: the decision's "made before" reads `recipe IN`
  the kin, one bind a recipe (it was the recipe's own id, or a jewel's and a dish's prefix). The decision binds at most
  40 (the Wand: 16, two an input, 18 kin) under D1's 100. No migration: `prof_crafts` keeps each craft's recipe as it
  always did, so a character's history counts as it stands - an Adamantium Longsword made last week is this week's
  Ebony Longsword's first.
- **The stations** - `src/ui/professions/profPages.js`: the anvil lists its family's patterns (the Weapons 15, the Armour 18, the
  Tools 5, the Repair Kit - 39, not 308 rows behind a metal row), the workbench its (13 - the Arrows one pattern, its
  fletching the material), the loom its (the leathers 7; a garment of the clothing shown - 41 men's, 35 women's - the
  cloth row gone, the clothing row kept; the furnishings 9; the Fishing-Net), the fire its four dishes (the herb's way
  the material). `patternRows`: each pattern once, its word the furthest its materials go (`patternLead` - made now,
  from raw, open, else the lowest rank it asks). `pickedOf`, what a picked pattern is made of: the last craft's
  material here where this pattern is made of it and it can be made, now or from raw; else the highest tier made now
  (the Daedric over the Warforged, which the table stands last), then the highest made from raw; else the open one
  holding the most of its inputs (`heldShare` - the Mithril Longsword for three Mithril Ingots, its leather still to
  buy); else the last's, else the first. `materialRow` in the box: a button a material, the chosen one marked, one that
  cannot be made dimmed, one past the rank naming it ("Daedric - rank 90"). Standard-bearer's Silk's word (AUDIT 32 P8)
  is said in the box when the garment is chosen in it. FACT, unchanged: the mason's bench's four carvings are made one
  way each, and the jeweller's bench already listed by piece, then base, then gem (PROF10).
- **The four hosts**: unchanged from CRAFT1 - `scenes/world.js` builds the station pages; `worldModes.js`, `exterior.js`
  and `dungeonContext.js` build none, so none to wire.
- **As built**: `src/net/recipeLaw.js`, `server-account/src/professions.js`, `src/ui/professions/profPages.js`. Pinned:
  `test/net/craft2_patterns.test.js` (7) - the done-when through the real Worker (an Adamantium Longsword its first, an
  Ebony one after it none, a Mithril one its own, an Ebony Broadsword its own, a Ghostwood Wand none after an Ironwood
  one), the law, `pickedOf`, the anvil, the workbench and the loom. `tools/mutants/craft2.json` (24, all dead). FOUND by
  the mutants: a family turned and turned back kept no pattern by nothing a pin read, and the Silk's word shown under
  every cloth survived - both pinned. PIN MOVED (the stations list patterns, the material chosen in the box):
  `prof3_client` and `craft1_chain` the anvil page, `prof4_client` the workbench's, `prof7_client` the loom's,
  `prof9_client` the fire's (its dish helper picks the dish, then the herb's way), `prof10_client` the fire's dish,
  `audit30_client` U13 + U20, A2 + A3 and A9, `audit32_pages` P1-P12's shirt and dagger and P8's Silk, `prof9_law` the
  first-make keys, and - merged in after AUDIT CRAFT1's third review - `craft1_chain`'s four benches (a case its row's
  name and its box's; the Hardened Leather the Cuirass's other material, in its box). Re-aimed by content, each still
  dead: `audit30` A3, `audit32` P8, `audit_seats_open` ASO-loom-note, `prof10` J7's two, `prof4`'s five, `prof7`'s
  three, `prof9`'s R2-S7 three, and `craft1`'s six R2 rows (one lock for the stations' rows now - patternRows'; the
  workbench's and the loom's standings their raw; a material made from raw unlocked in its box).
- **FOUND by CI on the merge's head** (two red in shard 2 of 4, fixed in its own commit): `audit24_onehome`'s one-home
  ratchet - the new `patternOf` shared its name with `src/tools/depthCopyCheck.js`'s depth pattern (another thing), so it is
  `recipePattern` now, under neither the homonyms nor a raised ratchet; and `fb1001_stations`' COUNTER-GATES walked the
  anvil's old metal row and the workbench's wood row - PIN MOVED to the patterns (the Longsword, then Iron; the Plain
  Single Bed), its four mutants re-judged, all dead.

### 41.6 CRAFT3 - five crafts, not eight, as built (BUILT 2026-10-07)

- **The law** - `src/net/professionLaw.js`: `PROFESSIONS` is the ten TRACKS a character holds - the five that gather,
  then Smithing, Building, Outfitting, Provisioning, Enchanting. `DISCIPLINES` the eight crafts as they were, each the
  craft whose track it reads and raises (Jewelcrafting Smithing's, Carpentry and Masonry Building's, Alchemy and Cooking
  Provisioning's); `trackOf` the one door (a discipline its craft's, every track its own), `disciplinesOf`,
  `disciplineName`. DECIDED: THE DISCIPLINES STAY - a recipe's `profession`, a work's `xp`, `more.profession` and
  `spec.profession` name what the work IS (a Ring is Jewelcrafting's, a cut Masonry's, the Transmuter Alchemy's choice),
  and a seat's hall still steps a discipline's craft (fortLaw STATION_PROFESSIONS - a Ring at an Apothecary, as before);
  only the track is the craft's. `professionName` names the track ("+60 Smithing XP" for a Ring). `SPECIALISATIONS` is
  keyed by track: a merged craft's four a rank are its disciplines' (`OWN_CHOICES`, the record's 3.3 as written), one
  chosen, each acting on its own discipline's work as it did - every choice's law was already scoped by the recipe's
  kind or family but one, `masterworkSpec`, which is now (recipeLaw: the Master Jeweller's points on a jewel, the
  Masterwright's on the smith's work - one track, so either could otherwise reach the other's). `specDiscipline` says
  whose a choice is. `craftXpCap` counts the five crafts' tracks: two of five past Journeyman.
- **The merge** - migration `0088_five_crafts.sql`, once: `free_respec` added; a change already in effect folded into
  its choice; each character's two parents read side by side, the higher one the more XP (equal, the first named:
  Smithing, Carpentry, Alchemy); the merged track the higher's XP, a rank's choice the higher's where it chose, else the
  lower's; the change on its way the higher's, else the lower's where its rank's choice is the one kept; a rank FREE
  (`free_respec` 1 at 50, 2 at 100) where both chose there (the lower's lost) or the lower's change there was dropped (its
  1,000 Marks were spent - the free change stands in for them); the parents' rows gone, the merged ones in. The crafter's
  limit holds after it: a merged track is past Journeyman only where a parent was.
- **The service** - `server-account/src/professions.js`: `trackRow` and `trackView` read the craft's track (`trackView`
  answers its id, and `free` where a free change stands); a craft, a smelt and its yield's choice, a transmutation's door,
  the crafter's limit and every XP credit are the craft's (`craft = trackOf(prof)`, `trackOf(r.xp)`); `alchemy.js` the
  brew's Provisioning; `seatForts.js` the Builder's, the Fortifier's and the Siegewright's Building. `chooseSpec` asks the
  craft's track of a discipline's name (an older client's 'jewelcrafting'), and the MERGE'S FREE CHANGE: no Marks, in
  effect at once, a change on its way at that rank replaced, the bit spent - its own `prof_choices` row decides, as the
  free first choice's does; answered `free`.
- **The client** - `src/net/profBook.js` `track` answers a discipline with its craft's track; `choose` asks the craft's.
  `src/ui/professions/profPages.js`: the Professions tab the ten; a merged craft's four cards a rank, each its discipline's name
  (`prof-of`), a free change said ("Change: free, once"; "Press again: free, in effect at once"); its Unlocks both
  disciplines' (`unlocksOf` - each named, by tier, a tier's first discipline first); the stations say the craft
  ("Building 10" at the workbench and the mason's bench, "Smithing 25" at the jeweller's, "Provisioning" at the fire and
  the alchemy station) and its XP. `src/scenes/world.js` the stations' XP words `professionName` of the discipline.
- **The four hosts**: `scenes/world.js` wired (the station pages and the crafts' answers are its alone); `worldModes.js`
  reads Enchanting's discount and the stations through the pages and the book (no track id of its own); `exterior.js`
  and `dungeonContext.js` read no profession track - none to wire.
- **As built**: `src/net/professionLaw.js`, `src/net/recipeLaw.js`, `src/net/profBook.js`, `src/ui/professions/profPages.js`,
  `src/ui/enhanced/enhancedPlusStyle.js` (`.prof-of`), `src/scenes/world.js`, `server-account/src/professions.js`,
  `server-account/src/alchemy.js`, `server-account/src/seatForts.js`, `server-account/migrations/0088_five_crafts.sql`.
  Pinned: `test/net/craft3_five.test.js` (10) - the done-when through the real Worker (a Silver Ring and an Iron Dagger raise
  one Smithing, the state ten tracks, one row), the merge as 0088 writes it over the eight tracks as they stood (the
  higher's XP and choices, the free ranks, the changes on their way kept and dropped, one in effect folded, the limit
  after it), the law, the free change through the Worker (no Marks, once, the next paid; an older client's discipline
  name its craft; the limit holding a dish at 50), the service's track reads (source pins), the Professions tab.
  `tools/mutants/craft3.json`. FOUND by the moved pins: the jeweller's bench still said "Jewelcrafting XP" - its
  craft's now. PIN MOVED (a discipline's track its craft's; ten professions; four cards a merged rank): the profession
  suites - `prof1`, `prof2`, `prof3`, `prof4`, `prof9`, `prof10`, `prof11`, `prof12`, `audit29`, `audit30`, `audit32`.
- **FOUND by CI on the merge's head** (one red in shard 3 of 4, fixed in its own commit): `seat2b_peace_law`'s
  Siegewright's day read `SPECIALISATIONS.carpentry[100]`, a track CRAFT3 folds into Building - PIN MOVED: Carpentry has
  no track of its own, the Siegewright is Building's choice at 100 and `specOk('building', 100, 'siegewright')` holds;
  `seat2b_peace`'s 63 mutants re-judged, all dead.

### 41.7 CRAFT4 - tempering and reforging, as built (BUILT 2026-10-07)

- **The law** - `src/net/temperLaw.js`, pure. THE TEMPER: `TEMPER_KINDS` the recipes' kinds a temper takes (the
  smith's weapons, plate, shields and chain; the tailor's leather and garments), `TEMPER_TOP` 3 (Superior). DECIDED,
  each: a made piece is tempered by its own recipe (`recipe`); a FOUND piece by the recipe that makes its template in its
  material (`temperRecipeOf`) - a weapon or plate in its metal (Ebony's, never the Warforged's: loot is never Warforged),
  chain the Steel's (the anvil's one chain), leather the Cured Leather's (Daggerfall has one leather), a garment the
  Linen's (its cloth names none); a staff, a bow, jewellery, a tool, a kit is none of it. A found piece is Standard
  (`pieceQuality` - Daggerfall's own item, 9.2). `temperCost` half the recipe's main input, rounded up (a Steel
  Longsword's 3 ingots, 2; a Leather Cuirass's 6 Cured Leather, 3; Plain Robes' 3 bolts, 2); `temperXp` the craft's at
  the recipe's tier, no first; the rank the recipe's own (the material's tier's). `temperRefusal`: no recipe, a Sigil's
  piece, Legendary, Aetheric or an artifact (law 7), a Masterwork (a maker's), a Superior (no step left). `temperStep`
  the next quality's condition and weight over its own. THE REFORGE: `REFORGE_RANK` 50, `REFORGE_ESSENCE` 2 (Magic) and
  5 (Rare); `reforgeEssence` none for any other tier. REFORGE-REPLACE (2026-10-25): `reforgeEssence(tier, count)` -
  the tier's Essence doubled for every reforge the piece has taken (`count`, `lootRarity.js` reforgeCount), none for a
  count no piece holds (past the ladder's `REFORGES_MAX`, 31 - the leaf imports the one bound).
- **The service** - `server-account/src/professions.js` `temperPiece` (`/v1/prof/temper`): `{ character, recipe,
  quality, provenance?, rid }`; the craft's track (`trackOf`) at the recipe's rank, the cost from the Stores (never gold's
  units), the XP under the crafter's limit, one `prof_tempers` row deciding and answering a request asked twice. The
  service cannot see the pack: a found piece's recipe and quality are the save's word, as its condition is - the Stores'
  spend is the bound (41.2). A MADE piece names its `provenance` - this account's, of that recipe, at that quality, on no
  listing, no road and in no home - and its `products` row moves to the new quality with its record RE-SIGNED there, in
  the temper's own batch ("so the market sees what it is"); refused `prof-no-piece`, `prof-not-yours`, `prof-temper`,
  `prof-temper-stale`, `prof-piece-busy`. `server-account/src/alchemy.js` `reforgeWithEssence` (`/v1/prof/reforge`):
  `{ character, tier, count?, rid }`, Enchanting 50, the Essence from the Stores (REFORGE-REPLACE: doubled for the
  piece's `count` - the save's word, as its tier is; absent, none, a page from before it; acct187, acct182 on its branch renumbered at the merge), answered the SEED
  the line is replaced with (the service's CSPRNG, a `prof_reforges` row). DECIDED: no XP - the Essence's XP was its disenchanting's. Migration
  `0089_temper_reforge.sql` (the two tables); `src/net/temperLaw.js` joins the Worker's deploy filter.
- **The piece** - `src/systems/smithItems.js` `temperItem`: a made piece still as its record mints (`asMinted`) is what
  the NEW record mints - the quality's condition, weight and roll (a Fine made piece tempered to Superior takes the
  Superior's Magic roll off its record's seed, as the market would mint it), its wear kept as a share; any other piece (a
  found one, a made one enchanted since) the step's condition and weight alone - its Loot Rarity and its lines are its
  own. `essenceReforgeRefusal` and `reforgeItem`: the Loot arc's own Reforge (`lootRarity.js reforgeAffix` - REFORGE-
  REPLACE: one line, any line, always by another kind, the piece's count raised; a line nothing else can replace,
  'line'), a known piece, never worn, replaced on the service's seed. `recipeLaw.js pieceLines`: a
  found piece a temper raised says its quality ("Fine", "Superior").
- **The client** - `src/net/profBook.js` `temper` (the input from the bag and the pack first, as a craft's) and
  `reforge` (REFORGE-REPLACE: with the piece's count, its key naming it - two pieces of a tier at two counts are two
  asks), each kept by its ask until an answer comes. `src/ui/professions/profPages.js`: Temper at the Anvil and Temper at the
  Loom beside each station - every piece the craft tempers, its step, its input and XP, Temper pressed or the rank said,
  the input short said; Reforge with Essence at the enchanting station - its rank below 50, each line a press from it,
  the Essence short said. The station's fee is a temper's and a reforge's, as a craft's and a disenchant's.
  TEMPER-CARRIED (FIELD BUGS 2026-10-20c): the two temper sections stood in the station list of a book that carries
  nothing, and every live book carries since BAG1, whose page (`profPages.js` drawCarryStores) listed neither - the
  temper was drawn nowhere in the game. The carrying page lists both beside the anvil and the loom
  (`profPages.js:"    ['temper-loom', (d) => drawTemper(d, rerender, kit, 'loom')],   // FB1020c TEMPER-CARRIED: the tailor's"`).
  Pinned by `test/ui/fb1020c_tempercarried.test.js`; `tools/mutants/fb1020c_tempercarried.json`.
- **The four hosts**: `scenes/world.js` wired (the pack's pieces - not worn, no market act kept on them - and the step and
  the line laid on the answer); `worldModes.js` holds the stations the pages read and no piece of its own; `exterior.js`
  and `dungeonContext.js` hold no station - none to wire.
- **As built**: `src/net/temperLaw.js`, `src/net/recipeLaw.js`, `src/net/profBook.js`, `src/net/accountClient.js`,
  `src/systems/smithItems.js`, `src/ui/professions/profPages.js`, `src/scenes/world.js`, `server-account/src/professions.js`,
  `server-account/src/alchemy.js`, `server-account/src/index.js`, `server-account/src/service.js`,
  `server-account/migrations/0089_temper_reforge.sql`, `.github/workflows/account-deploy.yml`. Pinned:
  `test/net/craft4_temper.test.js` (8) - the done-when through the real Worker (a found Steel Longsword Standard to Fine to
  Superior, 2 ingots each, the craft's XP, its card), a made piece's row and record re-signed and the piece what it
  mints, the temper's refusals, the law, the Reforge with Essence through the Worker and on the piece, the pages, the
  host. `tools/mutants/craft4.json` (71: 67 dead, 4 equivalent as recorded - two by the tables' order, one by the
  recipes a temper takes, one a race). PIN MOVED: `accountworker` (0089's two tables), `prof3_law` (a found piece a
  temper raised says its quality), `prof11_client` (the loom's Temper beside it).
- **REFORGE-REPLACE (2026-10-25, the owner: "Replace, price rises"; `Loot-Arc.md` section 11)**: the Reforge with Essence
  is the Mages Guild's Reforge on the same `reforgeAffix`, so it moved with it - a line replaced by another kind, never
  its own, any line however often (the one-line lock gone; an old piece's mark one reforge counted), a line nothing
  else can take the place of not offered - and its price rose with it: `reforgeEssence(tier, count)`, the station's page
  pricing each piece at its next reforge (`profPages.js` drawEssenceReforge), the host asking with the piece's count
  (`world.js:"const r = await profBook.reforge(offer.tier, reforgeCount(it));"`), the service spending it (acct187). Its
  words through t() (`prof.page.reforge.how`, `prof.page.reforge.rank`). AFFIX-LINES moved the craft's own roll the same
  day (`Loot-Rarity.md`): a record of mint version 2 draws its lines over the lines; one made before mints as it was.
  Pinned: `craft4_temper` (the count through the real Worker - 2, then 4; a count no piece holds refused with nothing
  spent; two at once, two prices - the pages and the host), `affixlines_reforge`; `tools/mutants/affixlines.json`.

### 41.8 CRAFT5 - the consumables, leaned into, as built (BUILT 2026-10-07)

- **A Repair Kit's quality, its reach** - DECIDED (41.2: "a Superior or Masterwork Repair Kit"): a kit's craft ROLLS a
  quality now, as a piece's does (`src/net/recipeLaw.js` `rollsQuality` - every piece that takes one, and the kit; the
  margin's odds, a clean heat's step, a seat's crafting halls'), and its quality is its REACH alone, never its condition
  or its weight: `kitReach` - a Superior or Masterwork kit mends a piece up to **0.90** of its condition
  (`KIT_CEILING_HIGH`, from `KIT_HIGH_QUALITY` 3), every other kit `KIT_CEILING`'s 0.75 (a field kit, a smith's below
  Superior, a kit made before kits took a quality). The work stays a quarter a use (`KIT_REPAIR`). The kit stays out of
  everything `takesQuality` rules: a commission names no least quality for a kit, and a Masterwork kit is no auction's.
  A Masterwork kit carries its maker's mark ("Mac's Steel Repair Kit").
- **The record**: `src/net/productRecord.js` - a kit's record carries its quality, 0 to 4, or -1 for one made before
  CRAFT5 (still valid - every kit already in the world mints as it did); arrows -1 as ever.
- **The service**: `server-account/src/professions.js` `craftAtAnvil` rolls a kit's quality (`rollsQuality`), its
  crafting halls' steps with it; the products row and the signed record at it. No migration (`products.quality` was -1
  to 4 from the first).
- **The piece**: `src/systems/smithItems.js` - a kit minted at its record's quality; `kitCeiling(it, kit)` and
  `kitGives(it, kit)` read the kit's own reach, so the targets, the mend, the pieces held back and the refusal
  (`kitCeilingText` - "Even a Superior kit mends nothing past nine tenths") are the kit's. `recipeLaw.js pieceLines`: a
  kit's card its quality and its reach ("Superior", "... up to 90%, once"); `craftedText` its quality word. The anvil's kit
  box its odds and the reach (`profPages.js` `KIT_REACH_LINE`).
- **A dish's buff and a Potent potion stand together - MEASURED, already** (41.2: "TO MEASURE first"): a dish lays its
  Fortify Attribute entries in its own bundle with no spell settings (`cookItems.js feedEffect`), and a potion's Fortify
  finds an incumbent only of its own stat AND settings (`effects.js` applySpell, `findInc`) - so a Potent Orc Strength
  over the Feast of the Hearth is its own entry, the sum of both read (`liveStat`), either order; a dish eaten again
  takes off its own bundle alone (`renewDish`). Nothing built: pinned.
- **Arrows a Building product** - MEASURED, already: every arrow recipe is Carpentry's work at the workbench, and
  Carpentry's track is Building's since CRAFT3 (41.6). Nothing built: pinned.
- **The four hosts**: none touched - the kit's use is the item handler's on every host (`smithItems.js
  installSmithing`), the anvil the pages'.
- **The account version**: `ACCOUNT_VERSION` acct93 (`server-account/src/service.js`, `wrangler.toml`) for CRAFT2 to
  CRAFT5's service, once.
- **As built**: `src/net/recipeLaw.js`, `src/net/productRecord.js`, `src/systems/smithItems.js`, `src/ui/professions/profPages.js`,
  `server-account/src/professions.js`, `server-account/src/service.js`, `server-account/wrangler.toml`. Pinned:
  `test/net/craft5_consumables.test.js` (5) - the done-when (a Superior kit mends a Steel Longsword at 70% to 90%, a Standard
  one to 75%; a Masterwork's 90%; a field kit and a kit made before 75%; a piece at 80% a Superior kit's; the card, the
  word, the refusal), the law and the record, a kit's craft through the real Worker answered and signed at a quality,
  the dish and the Potent potion measured, the anvil's box. `tools/mutants/craft5.json` (24, all dead). PIN MOVED:
  `prof3_law` (a kit's record its quality), `prof3_service` (a kit's craft answered a quality), `repair_rate` (the
  anvil's kit line), and the account version's pins (acct93).

### 41.9 CRAFT-FIRST-SHOWN - the first-make 500 said where it is earned (BUILT 2026-10-15, FIELD BUGS 2026-10-15f)

FIRST-BUDGET (2026-10-25, section 52): the lines below say each first's share, its track's, since -
Smithing's 500, Outfitting's 511, Building's 1,823, Provisioning's 3,155 - their thousands grouped.

The Discord, 2026-10-13: "Outfitting xp (first-time craft bonus): The first time craft bonus is not applying to the
outfitting. I got somehow it once from...Fishing net? Then never after."

- **FOUND - the law held, and nothing said it.** AUDIT 32 S1 (3.2; `06-Systems/Online-Arc.md` S1) withholds the 500 from
  a recipe made wholly of goods only a counter sells (`recipeLaw.js` `firstCraftPays` over `professionLaw.js`
  `COUNTER_ONLY`): 152 of the loom's patterns - 144 garments, the rugs and tapestries and the Fishing-Net, every one
  wholly the Weavers' Linen and Wool (MEASURED, pinned). The Fishing-Net never paid; a bolt-and-Cured-Leather boot
  does. The service decided it and answered `first` (`server-account/src/professions.js` `craftAtAnvil` - `first` is
  recorded for every first craft, the 500 laid on only where it pays). But no station said a craft's XP (the anvil,
  the workbench, the loom and the mason's bench said none; the jeweller's bench and the fire said theirs without the
  first), and the craft's word read `xp` and never `first`.
- **DECIDED (the owner): keep S1 - it stops 76,000 XP of first crafts being bought with the counter's cloth - and say
  the rule.** Client only: no service, relay or account version moved.
- **The words** - `src/ui/craftXpWords.js` (new), the module the host and the pages read:
  - `craftXpLine` - a station box's line for its picked recipe, at the craft's track's rank: "20 Outfitting XP, and 500
    more the first time you make this piece at this tier." (`craftXp`, the quarter past two tiers included, and the
    500 the first of its PATTERN AT ITS TIER - `firstCraftKey`, 41.5), or, where the recipe pays none, "20 Outfitting XP.
    Made only of cloth from the Weavers, it earns no first-time bonus."
  - `dishFirstLine` - the fire's: "The first time you cook this dish: 500 more Provisioning XP." beside the pans' XP
    (`cookXp`). `masonWorksFirstLine` - the mason's bench's works (`smeltAtForge` keys a work's first by the work):
    "Your first cut and your first mix each earn 500 more Building XP."
  - `craftXpText` - the craft's word, from the service's answer: "(+520 Smithing XP, with the first-time bonus)" for a
    first that paid, "(+20 Outfitting XP - your first, but cloth from the Weavers earns no first-time bonus)" for a
    first of the cloth, the XP alone otherwise.
- **FACT - the client cannot know which patterns were made.** The service's state answers the tracks, the Stores and
  the day (`profState`), never `prof_crafts`, so a box says what a first craft pays, never whether this pattern's is
  still owed; the craft's answer says whether it was one, and its word says so after.
- **The stations** - `src/ui/professions/profPages.js`: the anvil's, the workbench's, the loom's and a Sculptor's carving's boxes say
  `craftXpLine` under their odds where the recipe is open at the rank; the jeweller's odds give up their XP clause
  (`prof.page.jewel.odds`) to the same line; the mason's bench says its works' first under the works; the fire its
  dish's; and the alchemy station's potion wholly of the Apothecaries' goods (`brewFirstPays`, S1's law for a brew)
  says why its first pays nothing, where it said its XP alone. THE NATIVE-WINDOW RULE: these are the Stores page's own
  station boxes, the port's own design (17.2's row, section 21), not a window DFU has - no DFU source to cite.
- **The four hosts**: `scenes/world.js` says the word with one call (its `craft`'s return reads `craftXpText(rec,
  r.data, st.xp)`; HOST-SPLIT - no line added to bootWorld); `worldModes.js`, `exterior.js` and `dungeonContext.js` build
  no station page and no craft word - none to wire.
- **The words in the player's language**: eight new keys (`prof.craft.xp`, `.xpFirst`, `.xpFirstShop`;
  `prof.page.craft.xpFirst`, `.xpShop`; `prof.page.fire.first`; `prof.page.mason.worksFirst`;
  `prof.page.alchemy.xpShop`, which replaces `prof.page.alchemy.xp`) and `prof.page.jewel.odds` without its XP clause -
  drafted in-session in the thirteen whole languages (`tools/l10nInSession.mjs`; each glossary given "first-time bonus"
  and "cloth"), the twelve drafting languages owing them with the rest (`06-Systems/Localization-Arc.md` L10N6) - but
  the three of them that held the jeweller's row (Finnish, Japanese, Polish) had it cut the same, or it named arguments
  the English no longer has (`test/systems/l10n1b.test.js`); the craft's word around them is still the host's English, as it was.
- **As built**: `src/ui/craftXpWords.js` (new), `src/ui/professions/profPages.js`, `src/scenes/world.js`,
  `locales/*/Port_Strings.csv` and their records, the thirteen glossaries. Pinned: `test/net/fb1015f_firstcraft.test.js`
  (3) - the law the words say (the 152, all the Weavers' cloth; both works and every dish pay), the craft's word from
  the real Worker's answer through the book (a Linen Straps' first, a Linen Boots' first, a second of each; in French),
  the host's one call, and every station's box read off the real book. `tools/mutants/fb1015f_firstcraft.json` (20, all
  dead). PIN MOVED: `craft1_chain` (the host's craft word, its chain still first) and `prof10_client` (the jeweller's
  XP its own line).

### 41.10 CRAFT-LIMIT-SAID - the crafter's limit said where it acts, and a station's XP the service's own (BUILT 2026-10-18, FIELD BUGS 2026-10-18f)

The Discord, CC/Astro, "Smithing stuck at 50": "I am unsure if its meant to stop here or if I am missing something but
I have been stuck at level 50 smithing for about 3 days now. it is literally 1xp off of levelling up but everything I
craft gives me 0xp." The screenshot: the anvil's Silver Dagger at Smithing 50, "60 Smithing XP, and 500 more the first
time you make this piece at this tier.", and the word "You made a Fine Silver Dagger (+0 Smithing XP)."

- **FOUND - the limit held, and nothing said it.** 3.2's crafter's limit (DECIDED; Mac kept it at CAP-OFF, section 40):
  a character raises at most two crafts past Journeyman, and every other craft stops at `craftXpCap`'s
  `xpForRank(51) - 1` - 26,009 XP, rank 50, one XP short of 51: the report's "1xp off". The service credits
  `MAX(0, MIN(earned, cap - held))` in the act's own INSERT (`craftAtAnvil`; the smelt's, the temper's, the brew's and
  the disenchant's alike), so at that ceiling every act of the track pays none, its first's 500 too. Reproduced on the
  real Worker: Smithing at 26,009 behind Building 60 and Provisioning 55, the anvil's box read word for word as the
  screenshot, and the Worker answered `xp: 0, first: true`; with Provisioning at 50 the same craft paid its 60 and 500.
  The player's other two crafts are not in the screenshot, but nothing else pays a rank-50 craft none (the Firmament's
  XP channels floor at -30%, and `scaleXp` of 60 is 42 at worst), and the ceiling's exact XP is the limit's alone.
- **And the station's line read another law.** `craftXpLine` said `craftXp` alone; the service pays it with the
  Firmament's percent on it (FIRM1's `scaleXp`, never on the 500), the 500 laid on, under the room the track has left.
  The line read neither the limit (the report's 0) nor the stars (a Smithing XP star's percent, paid and never said),
  and a Master's stations promised figures a full track never takes (`PROF_XP_MAX - held` is none).
- **DECIDED: the limit stands (the owner's) and is said where it acts; a station says what the service credits.**
  The service decides by the same law; AUDIT FB1018f L5-1 made it one decision: each act's INSERT and its track's write
  count the other crafts past Journeyman in their own statement (`server-account/src/professions.js` craftCapSql, a
  D1 batch one transaction) - the ceiling had been `craftXpCap` of a track read before the batch, bound as a literal,
  so two acts at once could raise a third craft past 50 and freeze all three for good. No wire or account version
  moved. A craft already held past its ceiling is said at its own rank (L5-2); a third craft below 50 reads its next
  rank's figure (L5-3); a Master's craft word is the top's, `prof.craft.xpTop` (L5-4).
  - The law (`src/net/professionLaw.js`): `craftLimit(profession, ranks, xp)` - `{ cap, room, by }`: `craftXpCap`'s
    ceiling, what the track can still take, and the crafts past Journeyman that hold it, in the tab's order (a
    gathering track never held, 3.2's "Gathering is unlimited"); `craftLimitOf(tracks, profession)` the same off the
    service's track views, each rank the service's own (`rankOfXp` of its XP); `creditedXp(earned, room)`, the
    decision's `MAX(0, MIN(...))`. The book (`src/net/profBook.js`): `limit(profession)`.
  - The words (`src/ui/craftXpWords.js`): `paidXp` - an act's figure as the service pays it; `capLine` - "No Smithing
    XP: Building and Provisioning stand above Journeyman, and the crafter's limit holds Smithing at rank 50." ("At most
    9 Smithing XP: ..." where a little room is left; "No Smithing XP: Smithing is at Master." at the top), said in place
    of a line the track cannot take, by `craftXpLine` (now with the Firmament's percent on the craft's XP),
    `dishFirstLine` and `masonWorksFirstLine`; `craftXpText` - "(+0 Smithing XP - Building and Provisioning stand above
    Journeyman, and the crafter's limit holds Smithing at rank 50)" where the craft left the track no room (it said
    "(+0 Smithing XP, with the first-time bonus)" for a first the limit ate); `limitRuleLine`.
  - The stations (`src/ui/professions/profPages.js` `craftPayOf` - the limit off the book's tracks, the Firmament's
    percent in force, `systems/firmamentLive.js`): the anvil, the workbench, the loom, a Sculptor's carving and the
    jeweller's bench say `craftXpLine` with it; the mason's works; the fire (its pans' XP unsaid where none is paid -
    "3 pans." - and the limit's line for its first's); the alchemy station; the enchanting station and the temper (each
    row its credited figure, "+0", and the limit's line once).
  - The Professions tab: a held craft's XP line its ceiling - "26,009 / 26,009 XP - the crafter's limit holds it at rank
    50", where "26,009 / 26,010 XP" read as one XP from a rank it cannot reach - and under "Crafts above Journeyman: 2 of
    2" what the count does: "A character raises only 2 crafts past Journeyman: yours are Building and Provisioning, so
    your other crafts stop at rank 50. No craft's rank is ever lowered." Before the second: "...; once 2 of yours pass
    rank 50, the others stop there."
- **FACT - nothing unlocks it on that character.** Every write to `prof_tracks` raises a track's XP or holds it (the
  harvest's, the craft's, the smelt's, the temper's, the brew's, the disenchant's, a writ's, a Motherlode's; a
  specialisation's change moves no XP; 0088 kept the higher parent); only deleting the character removes its tracks
  (`server-account/src/realm.js`, PROF-DELETE). So a character's two crafts past 50 are its for good, and the tab now
  says so before the second is raised. DECIDED (Mac, 2026-10-19: "Stop with the decisions for me"): a craft is not let go back to 50 - 3.2's limit stands, said
  before the second craft passes it.
- **The four hosts**: `scenes/world.js`'s craft word hands the book's limit in, in its one call (`craftXpText(rec,
  r.data, st.xp, profBook.limit(rec?.profession))` - the line edited, none added to bootWorld, which stands at its
  ceiling); `worldModes.js`, `exterior.js` and `dungeonContext.js` build no station page and no craft word - none to
  wire. Left as they were: the brew's, the temper's and the disenchant's words in `world.js` ("(+0 Provisioning XP)") -
  their stations say it first, and those words never claim a first's bonus.
- **The words in the player's language**: six new keys (`prof.page.craft.xpLimit`, `prof.page.craft.xpTop`,
  `prof.craft.xpLimit`, `prof.page.xpHeld`, `prof.page.limit.rule`, `prof.page.fire.pansOnly`), drafted in-session in
  the thirteen whole languages (`tools/l10nInSession.mjs`; each glossary given "crafter's limit"), the twelve drafting
  languages owing them with the rest.
- **As built**: `src/net/professionLaw.js`, `src/net/profBook.js`, `src/ui/craftXpWords.js`,
  `src/ui/professions/profPages.js`, `src/scenes/world.js` (one line), `locales/*`. Pinned:
  `test/net/fb1018f_craftlimit.test.js` (6) - the report end to end on the real Worker, book and pages (and the limit
  shown the cause); the line against the Worker at seven rooms; the Firmament's percent on the anvil, the jeweller's
  and a temper, as the Worker pays it; every station at the limit; the tab before the choice, a gathering track,
  Master; the law and the host's one call. `tools/mutants/fb1018f_craftlimit.json` (46, all dead). PIN MOVED:
  `fb1015f_firstcraft` (the host's word; Building 100's boxes - a Master takes none - and the quarter and the 500 at
  Building 99), `craft1_chain` (the host's word), `prof9_client` (a Master's fire; AUDIT PROF-541 K7's steps at an
  Expert's 90), `prof12_client` (a Master's enchanting station; AUDIT PROF12 E2's quarter at 90). Re-aimed by
  content: 13 records of `fb1015f_firstcraft.json` and one of `prof9.json`, all dead.

## 42. PROF-FOUND - the station shops found as every shop is (BUILT 2026-10-12)

Mac: "Ensure all the professions new stores are flagged on the town map and you can ask NPCs where they are".

**What stood (MEASURED).** The stations' shops are the interior host's station questions (`scenes/worldModes.js`
forgeHere .. enchantHere): the forge a Weaponsmith's or an Armorer's, the workbench a Furniture Store's, the loom a
Clothing Store's, the mason's bench a General Store's, the jeweller's bench a Pawn Shop's or a Gem Store's, the alchemy
station an Alchemist's, the enchanting station a Mages Guild hall (Cooking asks a fire, not a shop). Eight of the nine
types were already on the Where-is page under DFU's own groups and drawn as shops (or, the guild hall, in the temple's
colour) on both town maps. The ninth was not: the **Furniture Store** - a shop classic never opened, opened by the port
as the furnisher's counter (DECOR2b) and Carpentry's workbench (PROF4, section 25). DFU keeps its type off the Where-is
page (TalkManager CheckBuildingTypeInSkipList, `systems/topicTree.js` and `systems/talk/talkTopics.js`, both verbatim) and
groups its automap byte (8, its type plus one) with the houses (ExteriorAutomap.cs:1482-1541), so a player hunting a
workbench saw a house and could ask nobody.

**As built.** One law, `world/buildingNames.js` OPENED_SHOP_TYPES (the Furniture Store) and OPENED_SHOP_GROUPS
("Furniture stores", worded as DFU's groups are):

- **The Where-is page**: `systems/topicTree.js` assembleTopicListLocation stands a group for each opened shop the town
  holds, after DFU's shops and before the yards and a port's places (YARDS-FOUND, SHIPYARDS-FOUND) - its Previous List
  head, each store asked as any building is (LocalBuilding, its key: the knowledge roll, "%di of here", "Let me just
  mark it on your map", which discovers it so the map names it). Its own variable, as the yards': C#'s shared one flows
  into the General section and the palace arm untouched. Without an engine, `scenes/townTalk.js` directoryByCategory
  lays the same group in the same place. DFU's skip list and TOPIC_CATEGORIES stay as they are.
- **The town maps**: `ui/town/townQuarters.js` moves the opened shops' bytes (OPENED_SHOP_BYTES, made by byteOfType - the
  `+ 1`'s one home now, quarterOfType reads it too) out of DFU's house group into its shop group, so the classic window
  paints a Furniture Store in the shop's colour and the enhanced sheet washes it and letters its name in a shop's ink.
  The discovery law is kept: a store is named once it is entered or an NPC marks it, as every shop is.

THE FOUR HOSTS (PROF-FOUND): `scenes/world.js` and `scenes/exterior.js` - WIRED, both build their talk and their town
map from the shared modules (createTownTalk, createTownMapWindow); `scenes/worldModes.js` - WIRED, its interiors' talk
asks the host's same tree; `scenes/dungeonContext.js` - no town.

Pinned: `test/systems/proffound1.test.js` (5) - every station's shop type, read off the interior host, asked after and drawn as
built ground; the group's place, head and rows; the answer's compass, roll and mark; the bytes, the classic window's
colour and the sheet's ink; the fallback's order. `tools/mutants/proffound1.json` (9, all dead). Re-aimed:
`tools/mutants/em34.json` EM7-2 (the plus-one's drift, now byteOfType's). Not seen in a real town (no ARENA2 here).
Ledger A (PROF-FOUND).

CARP-YARD (the same day, Mac: "Let's also redesign their buildings like we did with stables, etc"): Carpentry also has
an open-air place of its own, the JOINERY - a third yard beside each city's and town's Stable and Wagon Yard. Its
workbench is a station at the furnisher's fee (`03-World/Merchant-Yards.md` CARP-YARD). The Furniture Store and its
bench stand as they were.

## 43. MINE-PERKS - the four Mining choices made worth a choice (BUILT 2026-10-13)

The players' `#feature-feedback` thread "Mining perks need buff...", handed over as screenshots (SaberGGaming):

- *"Prospector - Since all gathering nodes are seen 150m away on the compass this perk is basically pointless as its
  only a 50m difference. Maybe change this to where on the overhead travel it shows all the individual veins in the
  area?"*
- *"Deep delver - Its very hard to find veins inside dungeons considering that they like to spawn halfway in the wall so
  its hard to see not to mention actually finding one in the labyrinths where not many spawn anyway so 50% more from
  the veins is kinda meh. Even 100% more would only make it slightly more useful. Not sure what to do with this one..."*
- *"Motherlode sense - Make it mark the motherlode spots with a waypoint on the travel map or something, an extra 20
  minutes of heads up doesn't do anything considering its damn near impossible to find these anyway."*
- *"Stonebreaker - I doubt I'll ever be quarrying boulders or whatever this is for once I get 100 mining. This probably
  should be something completely different, maybe being able to 'self witness' high end nodes so that they spawn with
  just you around?"*

**What stood (FACT).** NODE-MARKS (section 31) marks every node from 150 m (`NODE_MARK_M`) and a Prospector's veins
from 200 m (`PROSPECT_M`) - the thread's arithmetic is right. GATHER-OW (section 6) shows the Overworld one diamond a
profession a pixel, "Mining ×6", for everyone. A dungeon's 1-4 veins a day stood a third of a metre off the wall the
ray found and half a metre up (`scenes/dungeonContext.js` profVeinWall), and their flats - turned to the eye, spread
about that point - went into the wall at any look but a near square one. A Deep Delver's x1.5 was its whole effect.
LODE-MARK (`01-Overview/bugs/Field-Bugs-2026-10-12g.md`) puts a Motherlode on everyone's compass from its warning, so the
Sense's thirty minutes were twenty minutes more of one compass mark, and no map marked one. A clean finish on a boulder
already yields Cut Stone (section 23), so the Stonebreaker gave only the unclean finishes' cut.

**DECIDED (the record's, from the thread; Mac handed it over).** Each choice keeps its id - a track's `spec50`,
`spec100` and `respec_to` hold them, so no row moves and nobody who chose one loses it:

- **The Prospector** (Mining 50): surface veins on the compass from **500 m** (`PROSPECT_M`; a dungeon's keep PROF2's
  200, `PROSPECT_DEEP_M` - AUDIT, 43.1; the marks' walk and count widened for a Prospector alone, `PROSPECT_REACH`) and -
  the thread's own ask - **each vein its own mark on the Overworld**, named by its ore ("Silver Vein", `mineNodeName`),
  where everyone's are Mining's group. A kind may name a node the Overworld marks alone (`GatherKind.overworldOne`,
  `scenes/gatherHost.js`); the nearest `OW_ONE_MAX` (24) of them stand after the groups and outside their count, so a
  Prospector's veins never crowd another profession's group off, and every vein past them still counts in its pixel's
  group (43.1). A boulder and a Motherlode ride the group. The gem's x1.1 stands.
- **The Deep Delver** (Mining 50): a dungeon vein **x2** (`DEEP_DELVER_MULT` - "even 100% more" is taken, and is not the
  answer alone) and **every vein of the dungeon on the compass**, wherever the miner stands in it (`DEEP_DELVER_M`,
  2,000 m, past any dungeon's reach - "actually finding one in the labyrinths"). And for everyone - the thread's "halfway
  in the wall" is everyone's - **a dungeon vein stands at its wall's foot**: on the floor, 0.75 m out
  (`PROF_VEIN_OFF_M`, `PROF_VEIN_UP_M` 0). The ray, the wall and the slot are as they were, so every client stands it in
  one place still. Reasoned from the flats' sizes and the old offsets, NOT SEEN - no game data in this tree; Mac's eye is
  asked on a dungeon's vein from the side.
- **The Motherlode Sense** (Mining 100): **the day's Motherlodes on both maps from the day's start** - each the
  bounty's circle on its pixel (`ui/lodeMapMark.js`, the compass's aqua, `MOTHERLODE_MARK_CSS`), its ore and, while it
  is still to rise, the hour it rises on the reader's own clock; gone once spent or past its two hours, and none after
  the account's find today (`net/motherlodeBook.js` sensedAll). Read by the bounty's reader and painted by its painter,
  as RVN7c's lairs are; the held map's legend names it. A "waypoint" is the circle - the maps' own way of saying where;
  WAYPOINTS' shared marks are the players' own - and, since 43.1, a mark on the Overworld held at the edge with its
  distance, as a bounty is. The warning's thirty minutes stand. Everyone else's Motherlode is the compass's, from its
  warning, as LODE-MARK left it. It is a courtesy of the client's, not a secret kept: the service hands every client the
  day's three, pixels and hours, from the day's start (PROF2b, section 38), so a modified client draws them anyway.
- **The Surveyor** (Mining 100, `SURVEYOR` - the Stonebreaker's id): **their own word witnesses the ground, for their
  own veins**. On a pixel the witnesses have not confirmed, a Surveyor's surface vein is drawn over its climate's whole
  table - the confirmed draw, slot for slot (`net/nodeLaw.js` vein's `surveyed`) - and finds its gem as on witnessed
  ground; the service decides it (`server-account/src/professions.js`: `surveyed` = a vein, not confirmed, the
  character's `spec100`), and the client stands the same vein (`scenes/mineHost.js` standMineNodes, and the gathering
  host stands the pixels again when Mining's choice at 100 changes - SEASONAL-EYE's key, widened). The held map's ore
  card says so in its own words (`ui/oreMapTip.js`: "No vein here needs witnesses", or only the region's own ore),
  and the Mining page under its witnesses' line (43.1).
  WHAT IT IS NOT, by intent: never a **signature** (a region's own ore, which waits on the witnesses still - the region
  is the claim a lie is worth most on, and `veinSlots` counts no signature slot on the Surveyor's word); never the
  **March's** or a **Tide's** (named by the region, on confirmed ground alone); never a **dungeon's** vein (a dungeon's
  id is the client's word, AUDIT 29 A5's four a day); never a witness for anyone else - the ground stays unconfirmed, and
  a pixel the witnesses confirmed as something else is refused as it was. THE TRADE, said: the witness law bounds what a
  lie about a pixel buys (UNWITNESSED-ORE, section 6). A modified client at Mining 100 can now claim a climate's whole
  table - Gold, Platinum, Mithril, the Desert's Ebony - on any pixel, as it already could on every pixel three accounts
  confirmed; each node once a character a day and the hour's writes still bound it. Its Cut Stone at the rock stands.

THE SERVICE: `ACCOUNT_VERSION` acct126 (43.1 - the Surveyor's veins and gem and the Deep Delver's x2 are the service's
to roll, and the site's deploy waits on the version it names); no migration.

THE FOUR HOSTS (MINE-PERKS): `scenes/world.js` - WIRED (the maps' `lodes`, the Overworld's Motherlodes, the ore card's
`surveyed`, and the gathering host it builds carries the rest); `scenes/dungeonContext.js` - WIRED (the vein's wall foot; the Deep Delver's
marks ride the dungeon's own `nodeMarks`); `scenes/worldModes.js` - no node stands in a building, nothing to wire;
`scenes/exterior.js` - FLAGGED by name, as PROF2's: the fixed city has no gathering host.

Pinned: `test/ui/mineperks.test.js` (12; 18 since 43.1). `tools/mutants/mineperks.json` (28, all dead; 41 since 43.1). PINS MOVED: `prof2_law` (the
Deep Delver's x2), `prof2_service` (its six), `prof2_client` (`PROSPECT_M`), `fb1009e_unwitnessedore` (the vein's cap
read `confirmed || surveyed`), `fb1011_oremap` (the card's `surveyed`), `fb1004e_overworld` (the legend's `_lodes`).
Re-aimed by content: `tools/mutants/fb1001_boulders.json` GATHER-OW-the-cap-unasked, `fb1009e_unwitnessedore.json`
UNWITNESSED-ORE-the-vein-held-to-two, `prof2.json` PROF2-6-unconfirmed-any-tier. Ledger A (MINE-PERKS).

### 43.1 AUDIT MINE-PERKS (2026-10-13, Mac: "Audit and ensure this is as perfect as it can be")

Two cold passes read the merged commit (`41051130e`, main's ETHER-OW and FIELD BUGS 2026-10-13b in): the law, the
service and the Overworld, and the maps and the record. No HIGH. FOUND, each fixed and pinned (`test/ui/mineperks.test.js`,
`tools/mutants/mineperks.json`):

- **A Prospector's Overworld lost most veins** (MEDIUM). A vein its kind marks alone left its pixel's group, and only the
  nearest 24 were kept: over 5 x 5 Mountain pixels everyone read twelve groups of "Mining ×17" and a Prospector 24 veins
  within 0.63 km and twelve "Mining ×5" - the boulders alone, the far mountains seemingly bare. FIXED: every single past
  `OW_ONE_MAX` (or past `GROUP_M`) rides its pixel's group again.
- **No account version for a service that rolls differently** (MEDIUM). `deploy.yml` holds the site until the service
  answers the version the build names; unbumped, a new client could go live over the old service - a Surveyor shown Gold
  and given Silver, a Deep Delver's card saying x2 and paid x1.5. FIXED: acct126 (service.js, wrangler.toml, the
  nineteen suites' history line).
- **The Prospector took the Deep Delver's dungeon** (MEDIUM, a design overlap). `PROSPECT_M` 500 reached a dungeon's
  veins too, and a dungeon is blocks of 51.2 m: nearly every vein of nearly every dungeon, the other choice's whole perk.
  FIXED: a dungeon's vein keeps PROF2's 200 m (`PROSPECT_DEEP_M`); the card says so.
- **The marks' walk was raised for everyone** (LOW, the frame's cost). `MARK_WALK_M` 512 walked nine stood pixels a
  frame from a pixel's middle, for a reach nobody but a Prospector has. FIXED: 256 again, and a kind names a wider
  walk for its player (`GatherKind.markReach` - a Prospector's 500).
- **Sixteen marks under-counted 500 m** (LOW). The compass kept the nearest `NODE_MARK_MAX`; a Mountain's worst
  standpoint stood twenty veins within 500 m and marked fifteen. FIXED: a Prospector's count is 32 (`PROSPECT_REACH`);
  the glow keeps its own sixteen (`NODE_GLOW_MAX`).
- **A change of mind come due stood the old table** (LOW). The service stands a track under its paid change once the
  week is out (`specsAt`); the book kept the choice it last heard until its next read, so a respec to or from the
  Surveyor (or Herbalism's Seasonal Eye, the same gap before) stood one table and the service rolled the other. FIXED:
  `net/profBook.js` track applies a due change once, on the shared clock; the host's SEASONAL-EYE key stands the pixels
  again.
- **A vein could still stand against its wall** (LOW). A wall nearer the foe marker than 0.75 m stood the vein on the
  marker - as near the wall, a foe on it. FIXED: that bearing is passed over, its foot kept only where no bearing of the
  four markers stands one clear (no vein lost to the rule).
- **The hour said bare** (MEDIUM). The Sense marks the UTC day's three from its start, up to a day ahead, and "13:00"
  read as already past in Los Angeles for a Motherlode rising tomorrow; and it read the relay's clock where TIME1 shows
  this machine's. FIXED: the timers' own words (`systems/eventTimers.js` localWhenText - "Tue 13:00" where it is not
  today), on this machine's clock.
- **The label was unreadable** (MEDIUM-LOW, computed). The circle's words ride the parchment's halo in the ring's ink,
  and the compass's aqua stood 1.21 : 1 on it (the bounty's black 14.8, the lair's red 8.4), and near the serpent's
  sea-green ring. FIXED: the held map's ink a deep teal, `#0e6b5e`, 4.8 : 1 and its own hue; the classic page (no words)
  and the Overworld keep the aqua.
- **Not on the Overworld** (LOW) - the thread asked for a "waypoint on the travel map" and used the Overworld for the
  Prospector. FIXED: a Sense's Motherlodes there too, Mining's glyph in the aqua, held at the edge with its distance as a
  bounty is (`scenes/travelViewMarks.js` travelViewMarks, out of world.js since HOST-SPLIT 1), under the Gathering switch.
- **The Mining page told a Surveyor "Silver at most"** (LOW). FIXED: a line under it for a Surveyor alone
  (`ui/professions/profPages.js` MINING_SURVEYOR_LINE), the choice named by its card.
- **The words were English alone** (LOW). ROUTE-BRIEF routes one-word labels too. FIXED: `prof.lode.legend`,
  `prof.lode.name`, `prof.lode.rises` and `prof.page.how.miningSurveyor` through the text core, drafted in-session into
  the thirteen whole languages (glossary "Motherlode" added for de, id and nb).
- **The record and its comments** (LOW): the Testing.md row of `prof2_service` (half again, the Stonebreaker), section
  23's and 31's and Ledger A's PROF2 200 m, the comments in `scenes/world.js`, `ui/hud/hud.js` and `net/nodeLaw.js`, an import
  comment the change moved in `ui/travel/travelMapWindow.js` - each brought to what stands.

CHECKED, SOUND (the passes'): the Surveyor's self-witness is bounded as 43 says - surface veins on unconfirmed ground,
`specsAt`, slots bounded by `veinSlots(confirmed)` on both sides, no signature, March, Tide or dungeon; a surveyed vein is
the confirmed draw slot for slot; "disputed" is confirmed on both sides; the Overworld singles' keys, placement, filters
and cache; the Deep Delver's marks gone-first and the glow depth-tested; the vein on the floor at its flats' base; the
Sense's list at the day's turn, a find, an account or character change; the maps' parity with RVN7c in every place
lairs are read; the label within the reader's forty characters. NOT CHANGED, named: the Deep Delver's veins are not on
the dungeon's automap (DFU's own window, the NATIVE-WINDOW RULE - a departure of its own); the ore names are
`materialLabel`'s, "Ore" cut in English as the ore card already cuts it.

## 44. GATHER-FEEL - the gathering heard, and its last blow seen (BUILT 2026-10-13)

Mac: "I want to improve gathering, add gathering sounds and overall make the experience more palatable".

**What stood (MEASURED).**

- **The acts said DAGGER.SND's combat and window clips** (PROF-SCENES' table, `systems/professions/profSounds.js`): a chop and a
  plain strike a blow's Hit1-5, a Clean Cut and a strike on the glint the parry's ring (Parry6), a clean finish the
  lock's click (ActivateLockUnlock), the Basket's find and the knife's every point the window button's click, a bruise and
  a slip the high swing. The HUD said them as it drew the reticle (`ui/professions/profHud.js` setMeter, PROF-RETICLE's `actCues`),
  flat, on the frame the press counted.
- **Most of an act said nothing**: the kneel and the herb pulled; the tree's creak at half its chops (5.2 - `chopAct`
  raised `creaked` for "the host plays it once", and nothing did: the hint alone said "it creaks"); the tree's fall and
  its logs; a vein worked out; the net's 5-30 s wait and its whole haul of up to 20 s; the goods' card; a rank's banner.
- **Every blow was heard before it landed.** A chop or a strike counts on its press; the hand draws DFU's strike over the
  act's `swingS`, 0.45 s, five frames (`scenes/treeHost.js` axeHandFrame, `scenes/mineHost.js` pickHandFrame), and DFU's
  melee blow lands on the strike's frame 2 (FPSWeapon.GetHitFrame, `characters/weaponStates.js` HIT_FRAME_MELEE) - 0.18 s
  after the press, when the sound had already been.
- **The last blow was never seen.** The act ends on the press that finishes it: the tool left the hand that frame
  (`handTool` null), and GATHER-SPEED's fall (`fallNow`, at the act's end) took the vein down, and began the tree's fall,
  under a pick and an axe still raised.

**As built.**

- **The clips** - thirty-six of the port's own, synthesised from noise and sine and baked to DAGGER.SND's 11025 Hz 8-bit
  mono the climb's way: `tools/gatherSfx.mjs` on the shared kit, `tools/sfxSynth.mjs`, which takes the climb's pieces
  now (unit, knock, rough, bandSweep, rub, grit - moved out of `tools/climbSfx.mjs` unchanged, its eleven clips byte for
  byte). An axe in a trunk (three, and a Clean Cut's fuller one), the tool's swing (two), the tree's groan, its fall (its
  ground struck at `FALL_S` - the tool imports it from the tree host - as the tipping picture lies flat), its logs; a pick
  on stone (three), on the glint (the ore's ring), a vein's rubble; hands among leaves (two), a herb pulled, a herb
  bruised, the Basket's find, a glint's sparkle; the knife through hide (three), its slip, the pelt peeled; the net
  thrown, landing, a plip by the floats (two), the tug, the catch fighting (two), the net hauled in; a clean finish's two
  bell notes, the goods' satchel, a rank's four. Each its row in `public/sfx/SOURCES.md` and `test/tooling/doctrine.test.js`.
- **The ear** (`systems/gatherSounds.js` createGatherEar), built and fed every frame by the gathering host. It hears an
  act's beats off its machine's own state (`actBeats` - an act's first frame read against the machine's beginning, so a
  net thrown on the frame it was cast, by a tapped E, is heard), and says a blow as it LANDS (`landsIn`, below - AUDIT
  GATHER-FEEL F3: as its machine counts it landed, the one clock the kick, the chunks and the node's going read too), at
  the node in the world (`play3d`, a node in reach - DFU's activation distance - at its full volume), the net's sounds where
  it landed (the throw's metres along the look's bearing, at full volume to `NET_REF_M`), a hand's and a chime at the
  ear. A sound of several is never the one just heard, its pitch moved up to 5% (a chime never); the slice's pitch
  climbs along the knife's line. The water keeps its own time: a plip every 2.2-5.5 s while the net waits, the catch
  fighting every 0.5-1.1 s while it hauls - every 0.32 s, louder, while it slips outside the band. `say` - a beat the
  act's state cannot hear: a node going (a kind's `goneSound`: the tree's `fall`, a vein's or a boulder's `rubble`), the
  logs gathered up (the tree kind's frame, `say`), the clean finish as its last blow lands, the goods into the bag on the
  answer (`GATHER_SAY.haul.gap`: a burst of kept answers rings one), a rank's chime after it. `stop` - an act let go
  before its end (Escape, walked off, a window, the dungeon left, the switch shut - the one playing, or a finished
  one's last swing: AUDIT GATHER-FEEL F2, the host's one door `letGo`) takes its blows in the air with the hand; every
  other act's and a beat said land all the same. AUDIT GATHER-FEEL F7: a node's going is kept by its key while it
  sounds, and `hush` takes it back where its harvest is refused or lapses (the bus's `play3dVoice`, a stop that fades) -
  a tree stood again was heard falling on. AUDIT GATHER-FEEL: `rebase` - the floating origin's shift carries the places
  it holds (the net's, a blow's in the air) with the land, through the host's door in world.js's recentre block.
- **The mix** - each beat's volume levelled by its clip's measured loudness (the loudest 50 ms of each): a blow near
  -15 dB, the fall near -8, a chime -15, the swing -24, the water's plip -28. A first mix, set on numbers.
- **The switch** - the port's own sounds (ES1, `systems/enhancedSounds.js`; the Enhanced sounds row says the gathering
  now). Off, or on the classic skin, the ear says the DFU cue the HUD said before for each beat that had one, on the
  blow's time, and nothing for the rest (`GATHER_SAY`'s `classic`). The HUD draws and says nothing: its `cue` door and
  `actCues` are gone, the cues the ear's.
- **The last blow.** `characters/weaponStates.js` MELEE_HIT_SHARE - the hit frame's share of a strike's five, 0.4 - is
  where a tool's blow lands; `systems/chopAct.js` and `mineAct.js` answer `landsIn`, the seconds to it, and count their
  blows landed (`landed` - AUDIT GATHER-FEEL F3/R11: as the swing passes its hit frame, before a press can begin the
  next, so a frame long enough for both lands the first), and their swing runs out past the act's end (it counts
  nothing there). The host (`scenes/gatherHost.js`): an act that ends with a blow in the air keeps its tool in the hand
  until the swing runs out (`follow`, the rig's `handTool`), and its node goes as the blow LANDS (`a.landing`, on the
  frame stepAct finds it landed) - GATHER-SPEED's law kept, the node going with its act, the act's end now its last
  blow's landing. AUDIT GATHER-FEEL F1: every finished act's last swing is stepped until it runs out (`swings`) whoever
  holds the hand - a new act begun under it took the hand and dropped its machine, and its kick and its breaking burst
  never came - and a node whose last blow is in the air shows standing through any stand of its pixel (`landingOn`,
  `shownGone`, the tree kind's `stood`). An answer that comes first waits for the blow (no early fall, the rubble said
  once); a refusal before it takes nothing down; one another took (node-taken - GATHER-SPEED stands it as another's) is
  gone from under the blow, which lands on nothing (AUDIT GATHER-FEEL R12: no clack, no kick, no chunks). An act with
  nothing in the air - a herb, a search, a pelt, a net - goes at its end, as before.

THE FOUR HOSTS (GATHER-FEEL): `scenes/world.js` - WIRED: it hands its bus to the one gathering host (`audio`), which
plays the street's nodes, a dungeon's veins and a building's bodies; `scenes/worldModes.js` and `scenes/dungeonContext.js`
- WIRED through that host: no host of their own, and their rigs draw the last swing through the world host's handTool
(`profActTool`); `scenes/exterior.js` - FLAGGED by name, as every profession is there (17.1: no nodes).

NOT HEARD HERE: the clips were designed against their spectrograms and the four measures (`node tools/gatherSfx.mjs
--measure`: attack, crest, tail, brightness) - this container plays no sound - so their character and the mix are for
Mac's ear.

Pinned: `test/systems/gatherfeel.test.js` (19) - the clips shipped, whole and baked deterministically, every clip a beat's; the
fall's ground at FALL_S; the clips registered once; MELEE_HIT_SHARE and `landsIn`, the swing past the end; every act's
beats off the real machines; the ear's landing time, place, reach, variety, pitch and chimes; the net's place and the
water's clocks; a said beat, the gap, the rank's wait, `stop`; the classic skin; and the host over the real kinds - the
tool through its last swing, the node at the landing, the rubble, an answer first, a refusal first, Escape, a patch going
at its end, the tree's creak, fall and logs, the bus handed. `tools/mutants/gatherfeel.json` (52, all dead).
PIN MOVED: PROF-RETICLE's cue test (`test/systems/profreticle.test.js` - the HUD silent, the classic table standing) and its
host pin (the clean chime the ear's); the harnesses of GATHER-SPEED (`test/net/gatherspeed.test.js`), AUDIT 29 C4, AUDIT 30
A5 and A11 and PROF4's host tick past the last blow's landing. Records re-aimed: `gatherspeed.json`
GATHER-SPEED-act-end-stands-nothing (the landing's fall), `prof4.json` PROF4-logs-never-taken, `profreticle.json`
PROFRETICLE-host-clean-cue; retired with the HUD's voice, PROFRETICLE-cues-unsaid and PROFRETICLE-cue-door-dead (the
ear's act-unfed and switch-ignored stand in their place). Every existing record on a file whose logic the slice moved
(AUDIT GATHER-FEEL R14: `scenes/world.js`, which it only handed the bus, aside - its records still apply,
`test/tooling/mutantdrift.test.js`) was judged again - 398: 396 dead, the one recorded equivalent alive, and one SURVIVOR, which
survives on the base commit too:
VEIN-NEED-press-keeps-nothing (`fb0929h_veinneed.json`) - PROF-MENU's fallback in `press` answers the unlit press, and
the row the plaque has lit was unpinned. Pinned now (`test/scenes/fb0929h_veinneed.test.js` +1); dead. Ledger A (PROFESSIONS,
GATHER-FEEL).

## 45. GATHER-FEEL II - a blow felt, a vein cracked, a gatherer seen and heard (BUILT 2026-10-13)

Mac: "Do the not done" - section 44's three open items: a blow shook no camera; a vein showed no crack and shed nothing
(5.2's Mining row); a peer neither saw an act nor heard one (5.1's "Others see it").

**BLOW-SHAKE - the view answers a landed blow.**

- **The table** (`systems/gatherBlow.js` GATHER_BLOW_FEEL): an axe's blow dips the look 0.45 degrees and the eye 12 mm
  and drops the hands 0.022 of the screen, a Clean Cut 0.65 / 18 / 0.03; a pick's 0.5 / 14 / 0.025, one on the glint
  0.7 / 20 / 0.034 - the pick's head the heavier, as its swing is heard. Every dip is under the least any technique's hit
  dips its channel (the look cleave's 0.8 degrees, the eye execute's 6 cm, the hands whirlwind's 0.04 - AUDIT
  GATHER-FEEL F5/R1: three of the look's stood at 0.8 to 1.1, scaled now by the one share), with no shake, roll or lens
  of its own: an act repeats its blow every half second.
- **One door.** It goes in through the technique springs' (`combat/technique/techniqueFx.js` kickFx - techniqueCue's own kick
  moved behind it, its lines unchanged), which every host's view already folds (`player/climb/climbFeel.js`), and never
  through the look the act aims with: the glint's test reads the camera's yaw and pitch, which the springs leave alone.
- **The port's own motion**: the enhanced skin alone (DFU moves no camera for a blow - CameraRecoiler and HeadBobber
  answer a wound and a step), at the player's own "Technique camera motion" (uiPrefs `techniqueMotion` - its note names
  the tool's blow now, a dip on the Enhanced skin: AUDIT GATHER-FEEL F8), and none under the system's reduced motion -
  each gate read through the doors as they ship (AUDIT GATHER-FEEL R2).
- **On the blow's frame.** The gathering host steps every act machine through one door (`stepAct` - the act playing and
  a finished act's last swing alike) and feels a blow the frame it lands - the machine's count of blows landed risen
  (AUDIT GATHER-FEEL F3), the frame the ear clacks - never at the press. A blow Escape took with the hand lands nothing.
  `landedBlow` reads the clean one off the machine's `last` (a Clean Cut, a strike on the glint).

**VEIN-CRACKS - the vein answers it.**

- **The crack** (`systems/veinCrack.js`, DISSOLVE's shape - `systems/dissolve.js`): `batch.crack` is [the share
  worked, a seed], read by both billboard programs (`FLAT_CRACK_GLSL`, composed after the burn's in the classic BB_FS and
  the Enhanced Lighting lane's EL_BB_FS, the albedo taken down before the light). The ore's own picture splits along
  the seams of a field of cells 7 of its texels across. A seam is a texel wide and keeps 0.3 of the texel's colour, lit
  as the flat is, so the light, the wash and the fog fall on it as on the ore - on the lane taken on the display colour
  and decoded with it (AUDIT GATHER-FEEL V4: on the linear albedo a seam stood at half the classic's dark).
- **Its order.** The seams nearest the face's heart open first, spreading outward as the share grows - the most of it
  one network, a few short dashes apart (AUDIT GATHER-FEEL V5: the heart is weighed texel by texel, a seam's own turn
  seam by seam) (VEIN_CRACK_ORDER: a seam's turn is 0.35 its own seed and 0.75 its distance from the middle). A node's seed is its
  key's (`crackSeedOf`): a vein cracks the same way every blow, and two veins differently. The renderer sends it a batch
  at a time and resets it each frame block, as it does the burn.
- **The host** (`scenes/gatherHost.js`): a worked node of a cracking kind (`scenes/mineHost.js` `cracks` - a vein, a
  Motherlode, a dungeon's vein, and a boulder's loose stone: its rock is the terrain's - AUDIT GATHER-FEEL R10) stands in
  a batch of its own while it is worked or cracked (its group's key takes the node's; its twin of the same picture
  keeps the shared batch, whole), its pixel stood again in one step once the pictures came (AUDIT GATHER-FEEL V1: a
  stand tore its flats down first, and the frame between drew none). Each landed blow but the one that ends the act
  opens its cracks to the share the act has worked; that one takes it down (GATHER-FEEL's landing). An act let go with
  the node standing - Escape, walked off, a window, the switch shut, the dungeon left - closes them over through the one
  door that lets an act go (`letGo` - AUDIT GATHER-FEEL V7: a last swing let go and a node another took kept theirs held),
  and so does a refusal (`unwork`): the node stands whole, as for every other player (section 6). Every crack held goes
  with its node, its act, its batch, its dungeon and the host (`cracking()`, for the pins).
- **The chunks** (`VEIN_CHUNKS`): every landed blow sheds three, five on the glint, seven for the blow that breaks it -
  the node's own picture at 0.32 of its size, with its wash and colour (VEIN-WASH, VEIN-HUE). They leave the struck
  face 0.35 m toward the striker at 1.1-2.4 m/s, 1.4-3 up and up to 1.1 across, and fall at the world's 9.81 to the
  ground where their arc first meets it (`chunkLandingOf` - AUDIT GATHER-FEEL V3: a street node's ground is its pixel's
  heightmap, handed by the kind's `chunkOf`; the chunks lay on the node's foot's height, up to a metre over a downhill
  and as deep inside an uphill), a dungeon vein's on its one floor at its foot - MINE-PERKS (section 43) stands it on
  that floor at its wall's foot (the dungeon's `PROF_VEIN_UP_M` 0, pinned; `DVEIN_UP_M`, the half metre up its wall
  it stood before and its chunks' drop below its foot, retired at the merge) - lying there exactly at any frame rate.
  Each lies 1.2 s, then sinks away over 0.35 s.
- **Their batch.** A burst is one dynamic batch moved every frame (`moveBillboardBatch`) - the switch shut too (AUDIT
  GATHER-FEEL V2: a vein's own answer can shut it, and the chunks hung in the air) - culled by the box its longest flight
  can reach to its lowest landing, half a chunk's picture wider (`chunkBox`), casting no shadow. EVERY ALLOCATION HAS AN OWNER: a street burst's batch is its
  pixel's, on its list, freed by its teardown or when its chunks are gone; a dungeon's goes through the dungeon's own
  doors (`standProfFlats` takes `{ dynamic }` now) and is dropped when the burst ends or the dungeon is left; `dispose`
  lets every burst go. The vein's own world, on both skins, as a tree's fall is (PROF4), and the striker's alone, as the
  node is.

**PEER-ACTS - another player's gathering, seen and heard.** RELAY_VERSION **world200**, its LAW row (world199 on its branch, renumbered past main's AUDIT ETHER-OW world199 at the merge).

- **The wire** (`net/wire.js` validPose, `gatherOf`): `ga` the act - `net/peer/peerGather.js` GATHER_POSE_ACTS' index + 1:
  the axe at a trunk, the pick at a stone, a kneel by hand, with the sickle, with the Basket, with the knife, the net
  wound, flying, waiting, tugged, hauled - for as long as the hand is on it (the act playing, and a finished act's last
  swing - GATHER-FEEL's `follow`, the tool the gatherer's own hand holds); `gm` the net's throw in whole metres while
  it is out; `gb` the beats, a count round and round 1-255, times 16, with the last beat's kind under it
  (GATHER_POSE_BEATS: a blow, a clean one, a bruise, the herb pulled, a find, a miss, the knife going in, its stroke, its
  tear, the pelt off, the net in - and AUDIT GATHER-FEEL W2's `stop`, the blow counted just before it taken back).
- **The beats ride on their own**, as the landed blows' count `hk` does: a beat counted as its act ends - the herb
  pulled, the pelt off, the net in - rides the pose that ends it. Each field is OMITTED at none (a player who never
  gathered keeps the bytes it had); a code past the table is no act (never clamped into one); a count of none is no
  beat. poseChanged sends each change at once; lerpPose carries them whole. An older relay drops them: the others see
  and hear nothing of an act, as before.
- **The sender** (`createGatherPose`, the host's `poseAct`, spread into the online frame's arm): the act's beats are the
  ear's own law (`actBeats`, run on its own last state), each one the pose names counted once - the others hear what
  the gatherer hears, on the same beats - and a blow taken back (`letGo` counts the `stop`: AUDIT GATHER-FEEL W2, the
  others heard a blow land the gatherer had put away). The swing comes with its blow, the kneel and the throw with the
  act itself; the glint's sparkle and the tree's creak are the gatherer's alone (the node is theirs).
- **Every lane reads the same fields** and keeps its own record of what it last saw (`peerGatherSwing`: a first sight
  begins nothing - an act met mid-way is not replayed; the Morrowind body asleep follows it as it follows the swings,
  AUDIT GATHER-FEEL W3):
  - the Morrowind body (`net/peer/peerBodies.js` `_arm`) holds the act's tool - the classic arm's own stand-ins
    (GATHER_POSE_TOOLS: the War Axe for the Wood-Axe, the Warhammer for the Pick-Axe, the Tanto for the Sickle, the
    Dagger for the knife; pinned equal to the hosts' AXE_HAND, PICK_HAND, SICKLE_HAND, KNIFE_HAND), drawn through
    setWeapon as Morrowind's own iron of each - and swings it on each blow with the strike the gatherer's hand draws it
    with (GATHER_POSE_STRIKES: the axe's StrikeDownRight, the pick's StrikeDown). An act of the bare hand, the Basket or
    the net puts the weapon away. While an act kneels, its camera sneaks: Morrowind's crouched idle (it has no kneel);
  - the class sprite (`net/remotePlayers.js` `_syncMobilePeer`) strikes on each blow and on the throw, and kneels as a
    yielding foe kneels (REVENANT-FATE's held hurt frame), a one-shot or a walk played through;
  - Eye Of The Beholder's walker (`net/peer/peerRiders.js` `walkerHands`) stands ready while a tool is out and sheathed while
    the hands hold none - never a bow drawn or a spell readied at an act - and plays its melee clip's second stroke on
    each blow (a chop on an axe or a hammer, an overhead one on a sword), its first - a sweep of the arm - on the throw
    (WALK_GATHER_STROKES).
- **Every peer is heard** (`PeerGatherSounds`, the peers' sync's `_syncGatherSound`): the kneel among the leaves, the
  tool's swing at once and its blow on DFU's hit frame (PEER_BLOW_DELAY_S - the acts' own `landsIn` at the press), the
  herb pulled, a bruise, a find and a miss, the knife going in and each stroke, a tear, the pelt off, the net thrown,
  landing where it was thrown, the water's plip while it waits, the tug, the haul and the catch fighting, the net in.
  Each at the act's place (a metre before the body, at the hands' height; the net's where it landed - found whenever
  its act is out, its landing heard or not: AUDIT GATHER-FEEL W1), with the peers' own falloff: the port's clips on the
  enhanced skin, the DFU cue the gatherer's own ear says on the classic one.
- **Its switch** is the swings' (uiPrefs `peerAttackSounds`, "Attack sounds" - its note says "and their tools as they
  gather" now, redrafted in the twenty languages that held it), with the earshot. The law is told every change while
  silent, so nothing is replayed; one cue a peer every PEER_GATHER_CUE_MS (100 ms - one pose at the pose's top rate,
  POSE_HZ, pinned equal: AUDIT GATHER-FEEL R7; a blow taken back is heard under it); a peer gone is forgotten; the
  floating origin's shift carries a blow in the air and the net's place with the land (`rebaseSounds` - AUDIT
  GATHER-FEEL W1); a peer gathering nothing, or reloaded with its count not yet begun, is a few compares a frame (AUDIT
  GATHER-FEEL W4).

The node itself stays each character's own (section 6): a tree another fells still stands for you, and its fall, its
logs, a vein's cracks, chunks and rubble are theirs alone - never seen or heard here.

THE FOUR HOSTS (GATHER-FEEL II): `scenes/world.js` - WIRED: its online frame (every mode's - the street's, a dungeon's,
a building's) spreads the gathering host's `poseAct` into the pose and syncs the peers' lanes, which draw and hear it;
its dungeon stand door passes the chunks' `{ dynamic }` on (`stand`). `scenes/dungeonContext.js` - WIRED:
`standProfFlats` takes `{ dynamic }` (a dungeon vein's chunks, its own moving batch), and its veins crack on the batch
it stands them in. `scenes/worldModes.js` - WIRED through the one gathering host and the world host's view
(`host.climbFeel`, which folds the springs a blow kicks): no host of its own for either. `scenes/exterior.js` -
FLAGGED by name, as every profession is there (17.1: no nodes): its view folds the springs (CLIMB4), and no act plays
there to kick them.

OPEN, recorded rather than built:
- the Morrowind body holds no net and no Basket (5.1's held sheet is the first-person arm's pose; the third-person body
  has none), crouches where the act kneels, and draws no throw (AUDIT GATHER-FEEL R9 - the class sprite and the walker
  draw it; no lane draws the haul, which is heard);
- a beat struck before a listener arrived is heard on arriving through a halo's thinned copy or a woken room's lazy pose
  (AUDIT GATHER-FEEL W5) - main's swing counter `an` alike: HALO-THIN's and the relay's to end, for every count at once;
- the crack's `fract(sin)` hash on a GPU with a coarse highp `sin`, and an HD texture pack's smaller cells, are unmeasured
  (AUDIT GATHER-FEEL, lane V);
- Eye Of The Beholder's walker kneels for nothing (its tables carry no kneel) and draws its set's own weapon, not the
  tool;
- the paperdoll a peer stands as while their sprite loads draws no act (a still picture);
- the knife's strokes reach the others at one pitch: the climb along the line is the gatherer's (the line's length is
  not on the wire).

NOT SEEN IN PLAY HERE: the crack was judged on the shader's own code (`test/glsl.mjs`), both programs compiled in
Chromium's WebGL2 in every variant, and a sheet of a cracked vein rendered there and looked at; the chunks' flight and
the peers' acts are pinned through the real host and a real relay Room between two sessions. Their look in a running
game, two players at once, is for Mac's eye.

AUDIT GATHER-FEEL (2026-10-13, Mac: "audit everything"): `01-Overview/audits/Audit-Gather-Feel.md` - four cold lanes on a
frozen snapshot of sections 44 and 45; thirty-four findings, one HIGH (every mining act's start blanked its pixel's
flats for a frame), each fixed, pinned or recorded, and marked `AUDIT GATHER-FEEL <id>` above. A blow lands on one
clock now, its machine's; an act is let go through one door; a peer drops a blow the gatherer took back; a net's water
is heard at the net; the chunks lie on the ground they fall on; a refused tree's fall is heard no more. Pinned:
`test/systems/audit_gatherfeel.test.js` (22); `tools/mutants/auditgatherfeel.json` (81, all dead); forty-six records re-aimed
by content, each dead. Every existing record on the files whose logic the audit moved - `scenes/gatherHost.js`,
`systems/gatherSounds.js`, `systems/chopAct.js`, `systems/mineAct.js`, `systems/gatherBlow.js`, `systems/audio.js`,
`net/peer/peerGather.js`, `net/peer/peerBodies.js`, `net/remotePlayers.js`, `scenes/mineHost.js`, `scenes/treeHost.js`,
`render/enhancedLighting.js` - was put to a rejudge on the tree merged with MINE-PERKS, with the audit's own list
whole: 927, in the lists' name order. At the merge (Mac: "hurry up") 529 had been judged - 527 dead, the two recorded
equivalents alive, no survivor - the audit's own 81 among them; the other 398, from `gatherfeel2.json`'s last 53 to
`wwaudit.json`, were not judged here.

Pinned: `test/systems/gf2_blowshake.test.js` (8), `test/systems/gf2_veincracks.test.js` (8), `test/systems/gf2_peeracts.test.js` (12), over one
rig shared with GATHER-FEEL's pins (`test/gatherRig.mjs` - `test/systems/gatherfeel.test.js`'s own, lifted). Mutants:
`tools/mutants/gatherfeel2.json` (120: BLOW-SHAKE 17, VEIN-CRACKS 42, PEER-ACTS 61; all dead - VEIN-CRACKS' 43 less
the dungeon's floor, retired with `DVEIN_UP_M` at the merge of MINE-PERKS).

PIN MOVED: RELAY_VERSION world200 over thirty-nine relay pins (world199 on the branch, renumbered at the merge) and `test/systems/disc7.test.js`'s list (AUDIT GATHER-FEEL R14), the LAW row in
`test/net/relayversion.test.js`; the renderer's - the composition order (`test/scenes/dwf_audit.test.js`), the billboard pass's
lines and its NOT list (`test/render/la_cost.test.js`), the batch's minted fields, 60 (`test/systems/save/hard3_types.test.js`); the stood
flats' counts (`test/net/gatherspeed.test.js`, `test/scenes/audit29_host.test.js` - a burst's batch is no node's flats); VEIN-HUE's
group key (`test/render/fb1012b_veinhue.test.js`); the pose's arm, its line order (`test/net/mac7.test.js` - the gathering fields
between the torch and the climb); the peers' rebase (`test/net/peerstride.test.js`); the lane's flat albedo
(`test/combat/blood1_decals.test.js` - the crack after the decode) and the classic one's (`test/render/audit39_render.test.js` R17 - the
crack after the emission's cancel); the entry's static reach, 77 (`test/render/boot2.test.js` - `systems/veinCrack.js` on the
renderer's path, a leaf of no imports, pinned so). Records re-aimed by content: `gatherfeel.json`
GATHER-FEEL-follow-never-put-away (the stepAct line), `audit0928_render.json` AUDIT0928-N7, `audit29.json`
AUDIT29-C5, `auditdrops.json` AD-E4, `cards2b.json` SB-wire-no-news, `disc12.json` DISC12-body-never-follows,
`disc23b.json` D23B-no-stance, `fb1002_herbcursor.json` HERB-CURSOR-escape-unsynced, `fb1011_veinwash.json`
VEIN-WASH-e, `mwnpc4.json` MWNPC4-peer-dead-arms and -counts-not-followed, `perfextb.json` PERF-EXT10-2,
`werewolf1.json` WEREWOLF1-peer-wolf-holds-the-sword and `soc1.json` S38-version-not-bumped - each dead.
Every existing record on a file whose logic the slice moved - `scenes/gatherHost.js`, `scenes/mineHost.js`,
`net/remotePlayers.js`, `net/peer/peerBodies.js`, `net/peer/peerRiders.js`, `combat/technique/techniqueFx.js`, `render/renderer.js`,
`render/enhancedLighting.js` and the slice's own three - was judged again: 1,381 (AUDIT GATHER-FEEL R14: 1,276 of other
slices' lists and 105 of its own - its other two judged in its list's own run), of which 1,372 dead (67 of them after
the three pins above were moved - `test/net/mac7.test.js`, `test/net/peerstride.test.js`, `test/combat/blood1_decals.test.js` read the
lines the slice changed, and failed unmutated until then), 8 equivalent as recorded, and one SURVIVOR that survives on
the base commit too: `mwt.json` MWT2-the-attribute-is-never-enabled-so-the-channel-reads-the-constant - the by-source
pin in `test/formats/morrowind/mwnifmesh.test.js` matched MWNPC1's skinned mesh's twin line, so the rigid mesh's emission offset was
unguarded. Pinned now by driving createCharacterMesh on a recording GL (`test/formats/morrowind/mwnifmesh.test.js` +1); dead. The files
the slice wires a line into (`scenes/world.js`, `scenes/dungeonContext.js`, `net/wire.js`, `net/online.js`,
`ui/enhanced/enhancedMenu.js`, `systems/uiPrefs.js`) were not judged whole again: their records still apply
(`test/tooling/mutantdrift.test.js`), and those on the lines the slice moved were re-aimed and judged above.
Ledger A (PROFESSIONS, GATHER-FEEL II).

## 46. NODE-OUTLINE - a node ringed along its own picture (BUILT 2026-10-19; the ring RETIRED 2026-10-20 by NODE-GLINT, section 47)

NODE-GLINT (section 47) took the ring away and kept the rest - the pictures, the mask and the pass's seams - and its module, test,
probe and mutants live on under its names (`render/nodeGlint.js`, `test/scenes/nodeglint.test.js`, `tools/nodeGlintProbe.mjs`,
`tools/mutants/nodeglint.json`). The record below is the ring's, its files named as they stood then (RETIRED).

The owner: **"Overhaul gathering material visuals. Actually outline the sprite itself instead of a faint sparkle like it
is now."** FACT: NODE-MARKS' glow (section 31) is a card stood before the node - a halo, a shimmer and motes, slight by
intent - so the eye found a sparkle near a node, never the node's own shape; a tree's glow was a 2.6 x 3.4 m patch about
its root under a 20 m crown. DECIDED and BUILT (`render/nodeOutline.js`):

- **Its own picture.** The gathering host's marks carry each node's PICTURES (`scenes/gatherHost.js`, `pictures` on a
  mark): the flats it stood for the node - which batch, which of its flats (`first`, `count` - nodes share a batch by
  record) and their centres, recorded where the batch is made - a dungeon vein's own batches, and for a tree its kind's
  own (`GatherKind.picturesOf`; `scenes/treeHost.js`: the forest's flat, and its centre - the very array its pixel's 3D
  tree set holds, so the Low Poly Trees' or the jungle's 3D tree that stands for it near the eye is found by it). The
  renderer keeps the flats' basis and the 3D trees' frames it drew (`lptDrawnFrames`, spent in the flats' call,
  forgotten each beginFrame), so the outline is drawn on the very trees and far pictures the frame stood.
- **A silhouette, then its ring.** Each frame a node's pictures are drawn again, unmoved, by the billboard program's own
  vertex stage (`bbVertexShader` - they stand, sway and give way to their 3D tree as the world drew them) into its tile
  of a depth-only atlas (`OUTLINE_GRID` x `OUTLINE_GRID` tiles of `OUTLINE_TILE` texels, a node a tile - its rectangle
  on screen snapped to whole pixels and fitted in, a texel a pixel where it fits), cut where the picture is cut. Then
  over the node's rectangle a fragment outside the silhouette within the ring's width of it (16 taps: 8 directions at
  the width and half of it) is the ring, in the profession's colour (`ui/nodeMarks.js`, the compass's) at the depth of
  the silhouette it borders, stood `OUTLINE_RING_BACK` behind it - so a wall before the node hides it, the ground or a
  tree behind it shows it, and it never draws over the node itself. **Why not shifted copies** (WEAPON-GLOW1's law): the
  copies of a 3D tree's front cards drew over its own back cards - lines through the canopy (`tools/nodeOutlineProbe.mjs`, RETIRED,
  2026-10-19: 18% of the ring over the tree); pushing the copies behind the whole tree hid the ring wherever another tree
  stood close behind, which in the jungle is everywhere.
- **Its measure.** `OUTLINE_PX` 2.5 pixels at 1080 rows, with the image, never under 1.5 (a retro image's pixels are
  large); `OUTLINE_ALPHA` 0.95, breathing 12% at a quarter hertz (still under reduced motion); kindled and faded with
  distance by the glow's own law (`nodeGlows`: 0.6 s, 80 to 120 m), 16 at most (the atlas's tiles - the glow's budget);
  fogged and hazed by the frame's fog and the jungle's haze where its depth stands.
- **The glow stays where there is no picture.** A mark with none - Hunting's body drawn as a 3D character - is lit by the
  glow as before (`createNodeOutlinePass`'s `glow`, the world host's `createNodeGlowPass`); SENSE1's look round keeps
  the glow too (its finds have no picture). An outline that will not build hands every mark to the glow.
- **Where.** The world host's hook after each mode's opaque world, as the glow was (the street's, a dungeon's
  `lateWorldDraw`); never in a building nor under the travel view. One draw a picture into the atlas and one quad a node
  on screen; the frame's target, its viewport and the world's baseline handed back (blend off, depth LESS and written,
  faces culled, a scissor where one stood).
- **Pinned** (RETIRED with the ring): `test/scenes/nodeoutline.test.js` (9); `tools/nodeOutlineProbe.mjs` compiles and links both programs in a
  real WebGL2 context, draws a herb flat of a two-flat batch and a 3D tree of crossed cards through the pass, and reads
  the frame back (15 checks: the ring outside every picture and within its width, the neighbour flat unringed, the
  colours, one even ring at half kindling, a wall hiding it, the baseline back). Mutants (RETIRED): `tools/mutants/nodeoutline.json`
  (26, all dead). PIN MOVED: NODE-MARKS' and WB9g's hook pins (`nodemarks.test.js`, `invislook.test.js`,
  `wb9g_insignia.test.js`, `nodemarks.json`, `wb9g.json`) read `nodeOutlinePass`.

## 47. NODE-GLINT - a node catching the light on its own picture (BUILT 2026-10-20)

The owner, of NODE-OUTLINE's ring (section 46), after "a lot of players dont like how its not immersive": **"Lets just
bring the glint back but better."** FACT: the ring was a 2.5-pixel line in the profession's compass colour at 95%,
breathing, round every node within 120 m, sixteen at once - a mark painted on the world. NODE-MARKS' glow before it
(section 31) was a card stood before the node - a halo, a shimmer and six motes, slight by intent - so the eye found a
sparkle NEAR a node and never its shape; a tree's was a 2.6 x 3.4 m patch at its root under a 20 m crown. A herb's and a
vein's pictures are their own (the herb's item picture, the ore's washed flat), but a node tree is the forest's own flat
(`scenes/treeHost.js` treeKind's `flatsOf`: none of its own), so whatever marks a node is the only tell a tree has.
DECIDED and BUILT (`render/nodeGlint.js` - section 46's module, moved; its pictures, its mask and its seams unchanged):

- **The glow's parts, moved onto the picture.** The halo is gone (it was the patch at the root); the motes are GLINTS
  on the picture; the shimmer is a SHEEN across it. Drawn over the node's rectangle, one quad a node, ADDED (ONE, ONE) as
  the glow was - it only ever brightens - at the depth of the picture where it stands, `GLINT_PULL` (0.3 m) toward the
  eye and never past half its way: a wall before the node hides it, the node never does.
- **The glints.** `GLINT_COUNT` (6) a node, each living its own short life - `GLINT_RATE` 0.35 a second, each next one
  `GLINT_RATE_STEP` 0.05 faster (21 to 36 lives a minute, whole over the glow's 60 s clock) - its light sin(pi x life)
  cubed (`GLINT_FLASH`): born, brightest mid-life, gone dark - each life numbered on the clock's own wrap, so the life
  at the wrap is the life at zero (AUDIT NODE-GLINT). Each life stands at a spot of the picture chosen afresh, once for
  the node in the light's vertex stage (AUDIT NODE-GLINT: every fragment found it again): the first of `GLINT_TRIES` (6;
  3 before the audit) points of the node's own pictures (`GLINT_ANCHORS`, 8 at most: a flat at its base, width and
  height at its own scale; a 3D tree's crown about its root), taken in the plane the picture stands in - so a spot is a
  point of the picture and moves with it as the eye moves (AUDIT NODE-GLINT: it was a share of the screen's box, a
  different point each frame) - on the screen and before the eye: a flat's judged by its own picture at its own texel,
  at its own depth; a 3D crown's by the silhouette, `GLINT_HOLD_PX` (1.5) round on every side. None, and that life is
  dark. A white-hot core (`GLINT_CORE_WHITE`, 0.6 of the way to white) in a
  soft bloom, and four thin rays turned a little (each life its own turn, within 17 degrees), reaching `GLINT_SHARE`
  (0.35) of the picture's longer side on screen, between `GLINT_PX_MIN` (4) and `GLINT_PX` (14) pixels at 1080 rows, both
  with the image, never under 1.5 (`glintPx`) - so a far herb, a speck, still glints. (This said "and a tree filling the
  screen glints no larger than a near herb": a big 3D crown's glints grow since NODE-CROWN, below.)
- **The sheen.** A soft band of light rising a little aslant across the picture's own box and lit only where the
  silhouette is - the picture's own shape catching the light - once every 6.7 s (`GLINT_SHEEN_HZ` 0.15), crossing in the
  first half of the period (`GLINT_SHEEN_SHARE`) and dark the rest, at `GLINT_GAIN.sheen` (0.14) at most; none within
  `GLINT_SHEEN_NEAR_M` (6 m), whole from `GLINT_SHEEN_FULL_M` (18 m) (`glintSheen`). (This said "the tree under the
  axe and the herb under the sickle never flash" - the sheen's fade alone, while the glints flashed on at full: AUDIT
  NODE-GLINT, and the next bullet.)
- **The act's node is quiet** (AUDIT NODE-GLINT). The node an act works lights nothing of its own - no glint, no sheen,
  no glow over a body: the Basket's finds and the Pick-Axe's strike are glints the player watches for (`systems/herbAct.js`,
  `ui/professions/profActStyle.js` `.prof-glint`, a warm-white four-rayed star), and NODE-GLINT's stars on the very
  node looked the same. The host marks it `quiet` (`scenes/gatherHost.js` marks), and `nodeGlows` dims a quiet mark
  over the 0.6 s it kindles in and kindles it again when the act ends.
- **The light.** A warm daylight (`GLINT_LIGHT`: 1, 0.95, 0.84) carrying `GLINT_TINT` (35%) of the profession's compass
  colour (`glintTint`, `ui/nodeMarks.js`) - the professions still told apart, none painted in its colour whole.
- **Kept.** NODE-MARKS' law for who is lit and how much (`nodeGlows`: kindled over 0.6 s, faded from 80 to 120 m, 16 at
  most - the atlas's tiles); the frame's fog and the jungle's haze where its depth stands, and the sea's murk (AUDIT
  NODE-GLINT, `dwWaterFogAdd` - the duel wall's law for an added light); the glow for a node with no
  picture (a body drawn as a 3D character) and for SENSE1's look round; the build at idle, and a glint that will not
  build handing every mark to the glow. Under reduced motion every glint stands at its first life's place at
  `GLINT_STILL` (0.6) and no sheen crosses.
- **Where** (THE FOUR HOSTS RULE), as section 46 left it: `scenes/world.js` wires it (`nodeGlintPass`, in the hook after
  each mode's opaque world - the street's, and a dungeon's through its `lateWorldDraw`); `scenes/dungeonContext.js` holds
  no pass of its own (its glow is SENSE1's); `scenes/worldModes.js` lights none in a building (`nodeMarksAt` answers none
  there); `scenes/exterior.js`, the fixed-city bench, stands no gathering host and no node. Never under the travel view.
- **Not a setting.** The owner's word was the glint itself; section 31's "no setting turns the glow or the marks off"
  stands.
- **Pinned**: `test/scenes/nodeglint.test.js` (11 - section 46's three on the pictures carried); `tools/nodeGlintProbe.mjs`
  compiles and links both programs in a real WebGL2 context, draws a herb flat of a two-flat batch and a 3D tree of
  crossed cards through the pass and reads the frames back (21 checks: over 24 moments of the glints' lives the herb and
  the tree glint; light only added; every lit pixel within a glint's reach of the picture, and every glint's heart within
  3 px of it; the neighbour flat unlit; near, no sheen; half kindled, half the light; still under reduced motion and
  moving without it; a wall hiding it; through a long lens at 25 m the herb's sheen crossing it from its foot to its
  crown, dark between crossings; the baseline back). Mutants: `tools/mutants/nodeglint.json` (52, all dead - section
  46's 19 on the pictures, the mask and the pass carried and re-aimed, its 6 on the ring retired with it, its 2 on the
  screen's clamp and the host's wiring made again as NODE-GLINT's). AUDIT NODE-GLINT's counts are its own, below. PIN MOVED: the world host's hook pins (`nodemarks.test.js`,
  `invislook.test.js`, `wb9g_insignia.test.js`, `nodemarks.json`, `wb9g.json`) read `nodeGlintPass`;
  `tv4_weather_above.test.js` names `nodeGlint.js` among the fogged passes never drawn under the travel view;
  `l10n4_hardcoded.test.js` counts its three words under its new name (two since AUDIT NODE-GLINT).

### AUDIT NODE-GLINT (2026-10-20, the owner: "Audit this")

Two lanes: the author's own adversarial re-read, and three independent passes that read the commit cold - the GL and its
cost, the record with its pins and mutants, and the glint in the world as a player meets it - none touching the tree
while the others read. FOUND, each fixed and pinned (`test/scenes/nodeglint.test.js`, `tools/nodeGlintProbe.mjs`,
`tools/mutants/nodeglint.json`):

- **HIGH - the glints mimicked the act's own glint on the node being worked** (the world lane and the record lane). The
  Basket's finds and the Pick-Axe's strike are glints the player must react to (`systems/herbAct.js`: a press before a
  find shows spends it; `ui/professions/profReticle.js`: a strike within 2.5 degrees of the glint counts double), drawn
  as a warm-white four-rayed star (`ui/professions/profActStyle.js` `.prof-glint`, about 23 px) - and NODE-GLINT's stars,
  warm-white and four-rayed (about 28 px), kept flashing at full on the very node: about 2.8 a second over the herb in
  the Basket's gaps. Only the sheen faded near; the record said "never flash". FIXED: the node an act works is quiet
  (`scenes/gatherHost.js` marks' `quiet`; `nodeGlows` dims it over 0.6 s and kindles it again) - its glints, its sheen
  and a body's glow alike; the record's words corrected where they stand.
- **HIGH - every node behind the player was a full-screen pass** (the GL lane and the world lane; carried from
  NODE-OUTLINE's `screenRect`, its cost now four times the ring's a pixel). One corner of a node's box behind the eye
  made its rectangle the whole screen - a box wholly behind too, and one across the eye's plane off to the side. About 8
  of a frame's 16 nodes in any wood (the GL lane's sampling at 1920 x 1080: 16.8 M light fragments a frame for herbs,
  19-23 M for trees); in SwiftShader, 16 nodes behind the eye cost the glint 2,366 ms a frame and the ring 551. FIXED:
  a box wholly behind the eye is none, one across its plane bounded where its edges cross `GLINT_NEAR_W` (the GL lane's
  re-measure: 0.01 M fragments for herbs, 0.9 M for trees).
- **MEDIUM - every fragment searched for every glint's spot** (the GL lane): six glints, up to three hashed tries and a
  texel each, the same for the whole node, answered again at every pixel of its rectangle (the ring had discarded a
  silhouette pixel after one fetch). FIXED: the spots are found once, in the light's vertex stage (`texelFetch` there is
  WebGL2's own), and handed to the fragments flat; a fragment reads one texel and draws six stars.
- **MEDIUM - glints came and went as the eye moved a pixel or the picture swayed** (the GL lane: on a leafy picture, 9
  and 12 comings and goings over 20 one-pixel steps; the world lane, the author). A life's spot was a share of the
  node's box on the screen, chosen again every frame against the moving, pixel-snapped silhouette - a different point
  of the picture each frame - so a spot near a leaf's edge flipped between tries or went dark mid-flash, a frame at a
  time as the player walked; under reduced motion the held glints hopped too, and a node sliding off the screen dragged
  its spots (its box was held to the screen). A margin round the spot alone did not cure it (the probe: 10 over 12
  steps - any test on the mask's pixels flips as they move under it). FIXED at the root: a spot is a point of one of
  the node's pictures (`GLINT_ANCHORS` - a flat at its own base, width and height; a 3D tree's crown about its root), in
  the plane the picture stands in, so it moves with the picture; a flat's judged at its own texel of its own picture
  (`uFlatTex`), at its own depth - nothing about it changes as the eye moves; a 3D crown's (no one plane) by the
  silhouette, `GLINT_HOLD_PX` round; six tries a life; the picture's box kept whole past the screen's edge
  (`GLINT_OVERHANG`). The probe: none over 12 one-pixel steps on a leafy picture, where the same flat judged by the
  silhouette came and went 4 times (a glint is gone when no light of it stands within 2.5 px of its place - a peak only
  dimming under the detector's 300 as it slides across a pixel is the same glint).
- **MEDIUM - a small tree's glints mostly dark** (the world lane). A far tree's batch is sized for its tallest tree (each
  flat its own `_scales`), and its box at the batch's size stood round a small tree - about a quarter of its lives found
  it; under reduced motion one small tree in six showed none. FIXED: a flat boxed at its own scale, and none beside the
  3D tree it has given way to.
- **MEDIUM - the record's numbers and some of its laws had no pin that could fail** (the record lane, by mutants that
  survived): 14 constants held by a bound or not at all; every node on one seed, a spot never chosen afresh, the depth
  its own texel's, the jungle's haze never sent; the rays' room pinned at half; the tree's reach unscaled, the scissor
  kept, the depth written, the pass's end forgotten. FIXED: the constants pinned by value, each law by a pin or a probe
  check - the 52 records are 98, all dead (two the audit's own first pins missed, made to fail).
- **LOW-MEDIUM - every glint jumped once a minute** (every lane). The glints' brightness was whole over the 60 s clock,
  their life's number was not: at the wrap it fell to nought and every lit glint moved, on every node at once (the GL
  lane read 206 pixels change across the wrap, none on either side of it). FIXED: a life numbered on the clock's wrap.
- **LOW - a batch the walk had not placed drew pixel-local** (the world lane): a stood pixel's batch has no origin until
  the world's walk first reaches it, and its node, behind the player at night, was boxed some 800 m off - a ghost glint.
  FIXED: the mark carries its pictures' frame (`origin`, its pixel's translation), the batch's own first.
- **LOW** - `pow` of a sine a hair below nought (NaN on a real GPU; the GL lane, plausible): FIXED, held at nought. The
  sea's murk never taken (inherited from the glow and the ring): FIXED, `dwWaterFogAdd`. A tile a texel over its
  rectangle where the float carries the width over: FIXED, whole pixels. A 3D tree's front card hiding its own light (the
  GL lane, plausible): FIXED, the nearer picture's depth. The pass's own glow never freed (carried from HOST-SPLIT):
  FIXED. Text that said what is and was not (`render/nodeGlow.js`'s head, Rendering.md's glow line, Bantha-Jungle's
  trunk, the world host's hook): FIXED. Section 46's addresses rewritten onto files that now say other things (`(9)`,
  `(15 checks: the ring...)`): FIXED - section 46 is its own words again, RETIRED where it names the ring's files.

NOT CHANGED, named:
- **The light at night and underground** (the world lane - DESIGN, the owner's). The glint is a fixed warm daylight, so at
  midnight in a wood or in a black corridor each node near carries the brightest point in view, many times its picture's
  own light, and every 6.7 s the sheen lifts the whole far silhouette. The glow and the ring were the same. Scaling it by
  the frame's light with a floor (`renderer.flatLightAt`; TELL2's `glintLit` is the precedent) trades the night's
  findability for its immersion: put to the owner. ANSWERED - "Follow the light": GLINT-LIGHT, below.
- **The tint separates Mining and Logging by 0.12, on green alone** (the world lane - DESIGN, LOW): the picture itself
  tells the kind; the compass carries the colour whole.
- **A flat's spot stands on its unswayed plane**: in a gale the picture leans under it (a tall crown's top by a few
  tenths of a metre) and the glint drifts against its leaf - it never jumps. **A 3D crown is no one plane**: its spots
  stand on the plane through its root, judged by the silhouette, and the crown's leaves slide across them by their
  parallax as the eye moves round it - far slower than the screen's box did, but a spot there may still come and go;
  anchoring to the leaf cards themselves (the tree's mesh, the GPU's alone) is named, not built.
- **The 0.3 m pull lets the light show through a grass blade at a herb's foot**; **the sheen's distance is the camera's**,
  not the player's (a third-person camera); **the sheen on a tile fitted to fewer texels is blocky at its edge** (at most
  a pixel at fit 0.44 - the rectangles behind the eye were the worst, and are gone). Each minor.
- **The probe's tree picture is no `treeKind.picturesOf`'s** (it stands the 3D tree alone: the far flat's handover cut is
  the billboard program's, pinned by the Low Poly Trees' own tests), and **the probe is not in CI** - the repo's probes
  are run by hand, as this one was.

CHECKED, SOUND (the lanes, read at the commit): GLSL ES 3.00 on ANGLE, Metal and the mobile translators (the uint hash, the
loops, `texelFetch` on the depth atlas, `gl_FragDepth` on every path not discarded); the depth convention (standard,
LESS, the atlas's depth the frame's at the same pixel); the GL handed back; the fog, the haze and the focus; reduced
motion; a gone node, a stump, a neighbour flat in a shared batch; a school over the water; the four hosts; flashing well
under 3 Hz over small areas; the shapes the tests feed the pass the producers'.

Counts after the audit: `test/scenes/nodeglint.test.js` 15; `tools/nodeGlintProbe.mjs` 26 checks;
`tools/mutants/nodeglint.json` 98, all dead; NODE-MARKS' two records the audit moved (`nodemarks.json`) re-aimed, dead;
`test/world/bantha1_jungle.test.js`'s haze sweep reads the glint's own upload.

### GLINT-LIGHT - the glints follow the light (2026-10-20, the owner: "Follow the light")

The audit's design question, put to the owner: at night and underground, should the glints follow the scene's light? The
answer, the option as it was put: "Scale glints by the light where the node stands, with a floor so nodes stay findable
at night. The sheen goes away in the dark."

THE LIGHT is the one the node's own flat takes where it stands - `renderer.flatLightAt` (MAC-I: the billboard program's
composition - the ambient with the moons' lift, the sun's half, the Masser's half, every lamp at the flats' falloff, the
indirect light), asked once a node a frame at the node's place, into the pass's one array (`flatLightAt` takes an `out`
for it now). Its LEVEL is its luma by the 601 weights (`glintLightLevel`, written so a grey light's level is that grey
exactly), in the display space `flatLightAt` answers in - the frame's own on both lanes, since the Enhanced Lighting
lane encodes each fragment back to display space itself (`enhancedLighting.js` `elFinish`); the first-person hand's tint
reads the same answer the same way. A renderer that answers none (a probe, a test's stand-in) lights it as the day.
- **The glints are as bright as that level** (`uAlpha` is the kindling times it): a clear day's 1, the light whole.
- **THE FLOOR is the flats' own**, `FLAT_LIGHT_FLOOR` (0.25 - MAC-I's: dark enough to read as unlit, bright enough to
  keep a silhouette), asked of `flatLightAt` itself. It is also the clock's own night ambient (`EXTERIOR_NIGHT_AMBIENT`),
  so outdoors at night the glint simply takes the night's light, a quarter of the day's. The floor reaches only under
  that: a dungeon's 0.12, a room's 0.18, a mine with no lamp near. TELL2's floor (`glintLit`: 0.35 plus 0.8 of the
  albedo's luma) was weighed and not taken: it is a warning's, which must read before a blow lands, and a node's glint
  is a find. If night nodes read too faint in play, the floor is the one number to raise, and TELL2's 0.35 is the next
  precedent.
- **The sheen goes out in the dark** (`glintSheenLight`, a smoothstep from `GLINT_SHEEN_DARK` 0.4 to `GLINT_SHEEN_LIT`
  0.55, times the sheen's distance gain). The edges are set from the clock's own light at a node, measured through
  `flatLightAt` over the world's own terms (`exteriorAmbient`, `sunScale`, the weather's scale, EV5's moons):

  | Light at the node | Level | Sheen |
  |---|---|---|
  | a moonless night | 0.25 | none |
  | a night under both full moons | 0.39 | none |
  | a storm's noon ("a storming noon reads near-night", `worldClock.js`) | 0.35 | none |
  | a rainy noon | 0.48 | part |
  | a clear day's first hour (07:00) | 0.59 | whole |
  | an overcast noon | 0.66 | whole |
  | a clear noon | 1 | whole |

  So every night is dark to the sheen, as the owner's "the sheen goes away in the dark" reads at night and underground.
  A vein beside a lamp in a mine is lit, and its sheen crosses it: the light decides, not the clock.
- **Not a DFU member**, as the glint is not. The light it follows is DFU's billboard composition (MAC-I's own citations).

NOT CHANGED, named:
- **The glint's colour stays the warm daylight's** (`GLINT_LIGHT` with its profession's 35%). It is scaled by the
  light's level, not tinted by its colour: a moonlit or a torchlit glint is the daylight's colour, dimmer. The node's
  own picture takes the light's colour.
- **The glow does not follow the light** (a body's, SENSE1's finds - `render/nodeGlow.js`), as the audit named.
- **The sun's shadow is not in the level**: `flatLightAt` reads no texture, so neither the lane's shadow map nor the
  clouds' shadow reaches it (the clouds' is MAC-I's own recorded departure, in `flatLightAt`'s comment). A node in a wall's shadow at noon glints as one in the
  sun, while its picture is shaded.
- **The lane's eye adaptation is not in the level**: `flatLightAt` is the light before the lane's exposure, as the hand's
  tint reads it.

Counts after GLINT-LIGHT: `test/scenes/nodeglint.test.js` 18 (the level and the sheen's edges against the clock's own
hours; `flatLightAt`'s `out`; the draw asking each node's light at its place and the floor); `tools/nodeGlintProbe.mjs`
30 checks (a clear noon's light whole; at night a quarter, its brightest still clear on the picture; a black mine's held
at the night's by the floor; far, at night, no sheen at any moment it crossed by day - `renderer.flatLightAt` itself
over the probe's scene); `tools/mutants/nodeglint.json` 107, all dead.

### NODE-CROWN - a 3D tree lit to its top, its glints by its size (FIELD BUGS 2026-10-25i)

Discord #bug-reports, kvassdrit, "Big trees hide resource node particles": **"Needs to be size aware or have a completely
different visual like others have recommended."** FACT: a Logging node near the eye is its 3D tree (Low Poly Trees, on by
default, draws every wild tree within 140 m in 3D; a node glints within 120 m), and two things hid its glints.

- **Its crown stood at the wrong height.** The pass boxed it at the run's standing size times its row's scale times the
  prototype's own scale - but the standing size carries that scale already (`world/lowPolyTrees.js` readLowPolyTrees,
  `m.max[1] * sy`; the mesh is drawn at it, `bbVertexShader`'s mesh mode). The climates stand 95 Tree records
  (`TREE_RECORDS` with the woodland sets' winter archives, `world/climateSwaps.js` getNatureArchive), 93 with a prototype
  and 74 of those scaled (AUDIT FB1025i C2: this said 88 of 116, the pin loop's own count): the temperate and mountain
  woods' (504-511) mostly 0.5 to 0.8 glinted only up to half to four fifths of their height - 504_16's 16 m tree to 8 m,
  the upper crown that shows over a wood never - and the swamp's, the desert's and a winter wood's 15 (1.1 to 4.2) over a
  box up to four times their height, most of their glints' tries in the air above them. Not the depth: the light is drawn
  after the trees against the world's depth at the picture's own. FIXED: the crown as tall as the tree its run draws
  (`h = t.run.size[1] * row[4]`); its reach, the far flat's box and the jungle's trees (their prototypes unscaled) were
  right and are unchanged.
- **Its glints were a herb's** (AUDIT FB1025i C1, the report's "size aware"): six at most, no larger than a near herb's,
  this section's own law - so a crown filling the screen carried the herb's six. Measured on the real door's tree with the
  player's own atlases (the audit lane's probe, 1280 x 720): the light of a glint's cores a 10,000 pixels of its picture
  was a near herb's 158 (an 0.8 m patch at 5 m) against 504_16's 14 at 30 m and 3 at 12 m - 12 and 53 times sparser.
  BUILT: a 3D crown's glints grow with its size on screen (`glintCrownGrowth`): its side (`crownSidePx`, the square root
  of its standing width times its height at its root's depth) against the side a herb's glint stops growing at
  (`GLINT_PX` / `GLINT_SHARE`, 40 px at 1080 rows, with the image), to the two thirds - so their light, count times reach
  squared, keeps the share of its picture a herb's keeps - between 1 and `GLINT_CROWN_GROWTH` (2): up to twelve glints
  (`glintCrownCount`, a whole one), reaching up to twice as far (`glintCrownPx`, 28 px at 1080 rows), and the room round
  its rectangle its own reach's. A temperate tree (504_16, 17.7 m across, 13.3 m up) is at the bound out to about the
  glint's 120 m under a 65-degree view (1.95 there); a sapling far off grows part way.
  After: 504_16's 114 at 30 m and 23 at 12 m (1.4 and 7 times sparser than the herb), 504_13's 8.5 to 72 at 30 m, its
  hearts a frame 2.8 to 6.1 at 30 m and 2.4 to 4.7 at 12 m. A herb, a vein, a boulder, a school and a far tree's flat
  keep `GLINT_COUNT` at `glintPx`'s reach - the probe's herb pixel for pixel as it was. The slots are twelve in the light's
  stages, a node's own count (`uCount`) lit; a glint's life is one law both stages read (`glintLife`: the vertex stage its
  spot, the fragment stage its turn - no turn handed on, so twelve glints take the varyings six and their turns took).
- **NOT CHANGED, named:** a near tall crown that runs past the screen's top spends a share of its tries on its picture
  off the screen (the audit's C4, about a tenth); a small crown whose count steps as the eye nears it gains or loses a
  glint mid-life; the crown's box is `reach` deep (C5, as it was). Not a DFU member (the glint is ours); the scale is the
  mod's prefab scale under DFU's terrain tree scale, as the world draws it.
- **Pinned** by `test/scenes/fb1025i_nodecrown.test.js` (the report's 504_16 through the Low Poly Trees door, the billboard
  program's own vertex stage and the pass; every climate's Tree records at a row scale under 1 and over it; the growth's
  law by value; 504_16 at 30 and 12 m twelve at twice the reach, its far flat and a herb six, a small far crown part way),
  `tools/nodeGlintProbe.mjs` (33 checks: a half-scale prefab's top two fifths lit - none before; the big crown twelve at
  twice the reach, the herb six; its hearts a frame more than the herb's), `tools/mutants/fb1025i_nodecrown.json` (24, all
  dead); PIN MOVED: `test/scenes/nodeglint.test.js`'s boxes (a run's scale counted once), its programs (the life one law,
  twelve slots, no turn handed on) and its draw (the crown's count, reach and room); `tools/mutants/nodeglint.json`'s seed
  and room records re-aimed.

## 48. CRAFT-PAYS and POT-THIN - a crafter's bottle worth brewing, the flood of drops turned down, a cooked meal that weighs what it should (BUILT 2026-10-21)

The Discord's #feature-feedback, TheBard, "Crafting seems unrewarding" (2026-10-21): **"It requires a great deal of
gathering and then sinking money at the stations. The item I make I can loot with ease"**; Potions: **"I collect so many
potions from enemy drops that I never need to make potions. I only make them to level the provisioning skill. The profit
margin is also extremely low or even a loss ... who needs to buy pots when you find them everywhere?"**; Crafting Quests:
**"crafting writs instead of only gathering writs ... potions of restore power needed by the mages guild. The reward can
be crafting xp, silver, and rep"**; Food Weight: **"2 kilos per meat ... Or meat should reduce in weight once cooked"**;
and **"whats the end goal for crafting?"**. The owner, passing it on: **"I definitely want to decrease pot drops on top of
whatever you suggest relating to the posts"**.

### 48.1 What stood (MEASURED, 2026-10-21)

- **The drops.** A looting foe rolled DFU's random potion (3 in 100, `loot.js` addEnemyLootExtras), then POTION-COMMON's
  Potion of Healing and MAGICKA-COMMON's Restore Power (`systems/healingSupply.js`) - 10 and 6 in 100 at Renown 20, 12 and
  9 at Renown 40 (RENOWN-LOOT). **19 potions in 100 looting foes** at Renown 20, 24 at Renown 40; a J-O pile 18 + 10 + DFU's
  4. The two potions a player drinks most were the two the loot gave most.
- **The brew.** A Novice's brew (`alchemyLaw.js` brewCount) made **one** potion, for the alchemist's station fee of **50
  gold** (`professionLaw.js` ALCHEMY_FEE, every station's) and a cauldron of three or four ingredients. A Potion of Healing
  is DFU's 50 gold and half that at an online counter (ESSENTIALS-HALF): the brew lost money before its herbs were
  counted, on exactly the rungs a brewer climbs by brewing.
- **The food.** Climates & Calories' rows (`survival/items.js`, the mod's own `ItemTemplates.json`): a Raw Meat and a Raw
  Fish **2 kg** each, the cooked Meat **2 kg** and the Cooked Fish **1.5** - the fire took no weight. A cooked Meat feeds
  240 minutes and a Cooked Fish 200 (`survival/food.js` FOOD - AUDIT CRAFT-WRITS E8: "a cooked meal feeds 240" was the
  Meat's alone); a meal eaten never banks past the clock (`eatLaw`'s "never a meal in the
  future", AUDIT SURV-TIERS), so the hours a meal holds are the needs' own ladder - Peckish at 4 hours, Hungry at 12
  (`needs.js` NEED) - whatever the meal weighs.

### 48.2 What was done

| Slice | What | The numbers |
|---|---|---|
| **POT-THIN** | The two potion faucets of `healingSupply.js` cut; DFU's random potion and the counter's shelf untouched | A foe's healing potion 4 in 100 at Renown 20 (it was 10), its Restore Power 2 (6); a J-O pile's 8 (18) and 4 (10). RENOWN-LOOT's ladder on new ends: a foe's healing 3 / 3.5 / 4 / 4.5 / 5 by stage (8-12), its Restore Power 1 to 3 (3-9); a pile's 6 to 10 (15-21) and 2 to 6 (5-15) - `HEALING_ENEMY_CHANCE_BEFORE` 2 and `HEALING_PILE_CHANCE_BEFORE` 4 the step's start (an invented one, below the live game's 6 and 12 - the names kept). **9 potions in 100 looting foes** at Renown 20, 11 at Renown 40 - half what they were (an expected count; at least one on some 8.7 in 100). OFFLINE takes LOOT-EASE's buff whole, so it is cut too - 4 and 2 - its brewer DFU's own potion maker at an Alchemist's (AUDIT CRAFT-WRITS E5: unsaid until the audit). Not touched, and now named: SEARCH1's searchables (`searchables.js` - a shelf's loot roll half random potions, uniform twentieths, so some 0.025 Healing or Restore Power a shelf searched) |
| **CRAFT-PAYS: the brew** | A Novice's brew two potions; the alchemist's station 25 gold a brew | `brewCount` 2 below Journeyman (1); the rungs above stand - two at Journeyman, a Brewer's three, three at Master - because `prof_brews.count` is CHECKed 1 to 3 (migration 0070), and a fourth is a table's rebuild, not a number's change. The counter's goods still brew one (AUDIT PROF-541 R2-S1). `ALCHEMY_FEE` 25 (50): a brew is a bottle, not a blade - the forge's 50 on a Longsword is a sliver, on a 50-gold potion it was the margin. The same fee is the station's TRANSMUTATION's (`worldModes.js` - AUDIT CRAFT-WRITS T7: it halved too, unsaid until the audit). A home's station stays free |
| **CRAFT-PAYS: the food** | A cut weighs a kilo, and cooking takes its water | Raw Meat and Raw Fish 1 kg (2), Meat 0.5 (2), Cooked Fish 0.5 (1.5); the dishes stand on these rows (`profTemplates.js` DISH_TEMPLATE_ROWS) - the Stew and the Supper 0.5 (2 and 1.5), the Feast 2 (8); the Tart stays the Bread's 1.5. Weight is read at the template (`inventory.js` unitWeightInKg), so every food already in a pack lightens with it |

Arithmetic at a Novice's station, a Potion of Healing (Red Berries, Mercury, the Apothecaries' Troll's Blood and Elixir
Vitae - 10 silver at the counter): before, 50 gold and a cauldron for one potion; now 25 gold and the cauldron for two, the
fee a bottle 12.5 gold where it was 50, and a Brewer at Journeyman 8 a bottle. A brewer's own potions are now the steady
supply and the drop a windfall - which is what the record already said a crafter's work is for (41.1, "what already
works: what wears out or is eaten").

**The service.** `brewCount` is the service's law too (`server-account/src/alchemy.js` brewAtStation): a Novice's brew is
answered two. `ACCOUNT_VERSION` acct169 (acct168 and migration 0144 on its branch, renumbered past STAFF-PANEL1 at the merge). No migration.

### 48.3 What it is for (the record's answer to "whats the end goal for crafting?")

The record has one, and it was never said where a player reads it: **law 7** (section 1) - a craft reaches Rare at most, so
a crafted piece is never the best a slot holds; loot is the ceiling. Crafting's telos is everything the ceiling is not:
**what wears out or is eaten** (potions, dishes and the party's Feast, Repair Kits and the tempering that mends what loot
gives, arrows, a Standard tool's harvests); **the seats' works** (a fortification is stone and timber, SEAT0 7.5); **the
market** (a Masterwork with your name, commissions, regional prices); and the **Renown** a writ pays. POT-THIN is the first
change that took a consumable back from the loot so the crafter could supply it; the next ones are 48.4's.

### 48.4 Open, for the owner (DECIDED nothing here)

- **Crafting writs** - BUILT the next day, at the owner's word: section 49 (CRAFT-WRITS).
- **A meal that holds you longer.** The weight was the complaint's either-or; the other half ("it doesnt fill for very
  long") is the needs' ladder, not the meal's satiety (48.1) - a change there is the survival arc's, all foods at once.
- **The other stations' fee.** The forge, the workbench, the loom, the mason's bench and the jeweller's bench keep 50 gold
  a craft; on their products it is a sliver, so they were left.
- **The counter's half price** (ESSENTIALS-HALF) still sells a Potion of Healing for 25 gold online - the crafter's floor
  and ceiling at once. Raising it is the economy arc's call.

### 48.5 As built

- `src/systems/healingSupply.js` (the four chances, the two steps' start), `src/systems/renownLoot.js` (the stage table's
  two potion columns, a comment).
- `src/net/alchemyLaw.js` (`brewCount`), `src/net/professionLaw.js` (`ALCHEMY_FEE`), `server-account/src/alchemy.js` (its
  docblock), `server-account/src/service.js` and `wrangler.toml` (acct169), `src/ui/professions/profPages.js` (a docblock).
- `src/systems/survival/items.js` (four rows), `vendor/climates-calories/README.md` (nine columns the port changes, not five).
- **The four hosts**: none touched - the loot hooks are the shared rolls' on every host (`scenes/shared.js`
  installHealingSupply), the station the pages', the weights the template's.
- PIN MOVED: `test/systems/potion_common.test.js`, `test/systems/renownloot.test.js` (the potion numbers);
  `test/systems/prof12_law.test.js`, `test/net/prof12_service.test.js`, `test/systems/prof12_client.test.js` (a Novice's two,
  25 gold); `test/systems/survival/auditcc_items.test.js`, `test/systems/prof9_client.test.js` (the weights); the account
  version's pins (acct169). Mutants re-aimed by content: `tools/mutants/potioncommon.json`, `lootease.json`,
  `renownloot.json` (79, all dead), `prof12.json` (`PROF12-count-novice-one` - the mutant that WAS a Novice's two is now its
  one; `PROF12-alchemy-fee` back to 50). AUDIT CRAFT-WRITS T5: the list holds 212 - one recorded equivalent
  (`PROF12-spends-no-hash`) and one survivor (`PROF12-migration-unique`, which survives on main as well), so 210 to die;
  "209 dead" miscounted it, and the three records re-aimed are the ones this change ran, not the whole list.
- Ledger A: POTION-COMMON's row narrowed to POT-THIN's numbers; CRAFT-PAYS its own row.

## 49. CRAFT-WRITS - the guilds' asks of a crafter, as built (BUILT 2026-10-22)

The owner, of section 48: **"Why dont you actually build this instead of handing me a small fix?"** - the post's own
proposal (48.4): **"crafting writs instead of only gathering writs. Something like; potions of restore power needed by
the mages guild. The reward can be crafting xp, silver, and rep."** Every number below is DECIDED here, at that word.

### 49.1 The shape

- **Whose.** Every writ the board posted asked a gathered material from the Stores (section 11). A crafting writ asks what
  a crafter MAKES, and is the ACCOUNT's: it is asked **three a UTC day**, drawn the first time any of its living realm
  characters reads a board that day and written down (`craft_writs`, migration 0145 - `UNIQUE (day, player, slot)`, the
  id's stem that first reader's realm id) - so a writ never changes under a rank won mid-day, and two accounts never race
  for one. Filled whole at any board, by any of the account's characters with its OWN goods (`filled_char`), before the
  day ends. AUDIT CRAFT-WRITS E1: as built first each character was asked three of its own, and an account of six chose
  its best three of eighteen - the day's best by far and the easiest to fill; the draw is the account's now. **Three a
  day** is the account's allowance (`CRAFT_WRITS_PER_DAY`, `MARKS_FAUCETS.craftWrit`), beside the Court's three - the
  schema holds it (three slots a day, one row each), and the decision counts it again as the faucet's word.
- **What.** Slot 0 a **potion** and slot 1 a **dish**, of Provisioning's (CRAFT3: Alchemy and Cooking are its); slot 2 a
  **Repair Kit** of Smithing's where one of the account's characters has smithed at all, else a second potion (another
  than slot 0's where Provisioning opens another). Each within the account's BEST crafter's rank (the most Provisioning
  and Smithing any of its living realm characters holds, `ranksOf`) and **no more than two tiers below the highest it
  opens** (`craftWritChoices`) - a Master is asked a Master's work, as XP quarters below that; an alt reading the board
  sees its main's writs, and fills only what its own brews and pieces cover. Drawn from the account's own dice (its id,
  the day, the slot - `CRAFT_WRIT_SALT`), never a character's, so the order its characters read the board in chooses
  nothing.
- **Never** a Repair Kit of a metal nothing yields (`marketLaw.js` UNYIELDED; AUDIT CRAFT-WRITS E4: a Master smith was
  asked a kit no smith could make) - nor, DAEDRIC-SMELT (section 50), of a metal only the ember makes (`professionLaw.js`
  EMBER_MADE: the Daedric ingot, smelted now): a writ pays its inputs' worth, and the ember is the account's purse.
- **Never** a potion made wholly of the Apothecaries' goods (Water Breathing, Levitation - `brewFirstPays`): silver
  spent at the counter and brewed would come back as more silver with no hand's work between (AUDIT PROF-541 R2-S1's law).
- **Who asks** (`CRAFT_GUILDS`, the port's own choice - DFU's guilds post no writs): the **Mages Guild** most potions; the
  **Temple of Stendarr** (mercy) the five remedies - Healing, Heal True, Cure Disease, Cure Poison, Purification; the
  **Fighters Guild** Orc Strength, Stamina, the Hunter's Stew, the Fisherman's Supper and every Repair Kit; the **Temple
  of Mara** the Orchard Tart and the Feast of the Hearth.

### 49.2 What fills one - made, and handed over

A writ's silver is minted only for an act the service witnessed (law 8), and the goods leave the character's realm record
in the same batch (INT19's law for every crafted act):

- **A potion writ**: the character's own **brews** of the potion - every potion a station bottled for it
  (`prof_brews.count`), less what the crafting writs IT filled of that potion already took (`brewedLeftSql` - AUDIT
  CRAFT-WRITS S1: the decision named the writ's product as a column inside its own subquery, so SQLite read the
  subquery's row and every writ the character had filled, of any product, was taken from its brews; a stew writ filled
  first refused the potion writ the card offered) - cover the count; AND that many potion BOTTLES of the recipe leave the
  record's pack (`takeCraftGoods` - the plain before the Potent, a stack giving part of itself; never a worn, quest,
  summoned, bound or LOCKED one - AUDIT CRAFT-WRITS C3, itemLock.js; never the recipe's sheet, which names the potion's key
  too - E3). A potion is a potion: the brews are the witness and the record the goods,
  so a looted bottle can be handed over only where a brew of the character's own stands behind it.
- **WHATEVER THE GOODS** (ANY-GOODS, FIELD BUGS 2026-10-26, `01-Overview/bugs/Field-Bugs-2026-10-26.md`; the owner:
  **"Crafting writs should work with even store bought ingredients. I hate this"**): a brew or a piece made of the pack's
  goods - a looted herb, a reagent bought with gold at a shop (AUDIT BAG-CRAFT A1's LOOSE units, which a station spends
  first) - fills a writ as one of gathered or silver-bought goods does. The make is the service's act; what it was made
  of is not asked. As built first a brew counted only where it spent no loose unit (migration 0145's
  `prof_brews.witnessed`, still written as the brew's record and read by no writ) and a piece walled to gold by its goods
  filled none, so a brew that paid its XP showed "0 brewed by you". Every brew since the column counts, and those before
  it too. THE FAUCET'S BOUND is unchanged: three writs an account a day, 200 silver each at most - and a client's word on
  what its pack holds past the service's count (BAG-CRAFT's put-in) now reaches that faucet, within it.
- **A dish or kit writ**: the pieces themselves, by provenance (`pieces`, exactly the count) - each the account's (a sold
  one is its buyer's, `products.owner`) and this character's own make (`products.char_id` - a piece bought on the market
  keeps its maker's), never bought back with gold (`products.bought_with` 'gold' with `loose` 0, migration 0142 - a
  piece walled by its goods, `loose` 1, fills one: ANY-GOODS), on no listing, auction, road or home nor on its way back (`pieceOkSql`, PROF5's and INT19's guards), loose
  in the record's pack and not locked; their `products` rows go with them, as a disenchant's. AUDIT CRAFT-WRITS T2: as
  built first the guard was `bought_with IS NULL`, and `'marks'` is ALSO a piece made of goods bought for silver (AUDIT
  PROF-541 B7) - every Repair Kit takes the Cured Leather the smith's counter sells, so a kit writ refused the kits a
  smith made of it. The card's list is the newest pieces first (AUDIT CRAFT-WRITS S3: a piece's row outlives it - the
  oldest twenty were a cook's long-eaten dinners), sixty at most, by the very guard the decision reads (S2: the board's
  check named its outer piece as its own).

### 49.3 The pay

| What | The law (`craftWritLaw.js`) |
|---|---|
| **Silver** (Marks, a `craft-writ` mint) | A make's GATHERED inputs at their Marks values times **150%** (`CRAFT_PAY_PCT`, the Court's 1.2 for raw goods and a crafter's half again), and the goods ONLY A COUNTER SELLS (`COUNTER_ONLY` - the Apothecaries' reagents, sold at their value) at their cost alone (`bought` - AUDIT CRAFT-WRITS E2: half again on a reagent bought was silver in, more silver out, with only the brewing between), over the units one make gives a Novice (`NOVICE_YIELD`: a brew 2 - CRAFT-PAYS - a dish 1, a kit 1); never under **20 a tier** (`CRAFT_PAY_FLOOR` - a rank's skill is paid for, not only its herbs: THE FLOOR IS WHAT MOST WRITS PAY, and the knob that moves the faucet); never over **200** (`CRAFT_WRIT_PAY_MAX` - the count is lowered first) |
| **The count** | Potions 4 at tiers 1-2, 3 at 3-4, 2 past; dishes 3, the feast 1; kits 3 at tiers 1-3, 2 at 4-5, 1 past - then fitted under the cap, and never past 20 (`CRAFT_WRIT_QTY_MAX`, the table's CHECK - E6: a count past it was dropped by the post's INSERT OR IGNORE) |
| **XP** | Twice the pay (the Court writ's `writXp`), to the craft's track - Provisioning for potions and dishes, Smithing for kits - under the crafter's limit (`craftCapSql`, read in the decision) |
| **Renown** | Twice the pay at the rate (`renownRate`) - the port's own ratio for a crafting writ. AUDIT CRAFT-WRITS T6: "the Court writ's ratio" was wrong - a Court writ's Renown is its tier's and units' (`writRenown`), 0.67 to 1.56 of its pay by the material |
| **Standing** | `HALL_WRIT_REP` (2) with the asking guild on the character's Roll, where the Roll keeps the guild - a hall writ's own two statements (CHAP2a), while the Chapters are the account's |

So, among the eighteen potions: Restore Power (the post's own) four for **108**, Healing four for **32**, Resist Fire
four for **68**, Purification two for **140**; three Hunter's Stews **20**, a Feast of the Hearth **120**; three Iron
Repair Kits **20**, an Orichalcum one **120** (the whole table is pinned, `craftwrits_law.test.js`). Every product but
six (Restore Power, Resist Fire, Heal True, Healing, and Orc Strength and Water Walking by a silver or two) pays its
tier's floor. A Novice's Restore Power writ asks two brews - 96 silver of reagents and two mined Silver - for 108 (the reagents
back at cost, the Silver half again and twelve over), 216 Provisioning XP and 162 Renown; a Novice's Healing writ two
brews of 20 silver at the counter and the gathered rest, for 32. A kit writ is the smith's floor: three Iron Repair Kits
(their ingots and leather worth 9) for 20, an Orichalcum one (16) for 120 - less the Cured Leather's counter price (twice
its value, 4) where it was bought, which the kit's `cost` counts at its value: at a public forge three Iron kits of bought
leather come to some 7 silver under their pay (the forge's 50 gold a craft), a Quartermaster's 2 over, a home's 8 over
(AUDIT CRAFT-WRITS E7: the kits' margins, unrecorded; every kit pays its floor, so the leather's value moves none).

**The faucet** (AUDIT CRAFT-WRITS E1 and T6 - the first record's maxima were a character's, and wrong). At most three a
day an account, at most 200 each by the law; the dearest writ the table makes is Purification's 140. Drawn at the
account's best crafter's ranks, its three come to: **60 to 74** while that crafter is below rank 10 (tier 1); **60 to
216** from rank 10 (Restore Power, Resist Fire and the Tart open); 60 to 228 up to rank 49; **280 to 360** at ranks 74-75;
**300 to 380** for a Master (Purification 140, the Feast 120, Invisibility or a tier-6 kit 120). The Court's three a day
pay up to 336 each, and no tier-2 Court writ more than 96 - so at tier 2 Restore Power's 108 sits above the gatherer's
best (96 of it the reagents' cost), and at every other tier the crafter's faucet sits under the Court's. Appendix C's
model is not re-run here. RECORDED for the owner: if the Marks minted outrun the Marks burnt again, `CRAFT_PAY_FLOOR`
(what most writs pay) and the cap are the two knobs; `CRAFT_PAY_PCT` moves six products.

### 49.4 Where it is seen

- **The Work tab** (`ui/noticeWindow.js` craftNode): above the Court's writs, under **"Crafting writs - N of 3 today"**,
  one card a writ - the guild's ask ("The Mages Guild asks you for 4 Potions of Restore Power"), what fills it ("Of your
  own brewing - the bottles leave your pack."), its pay ("Pays 108 silver, 216 Provisioning experience, 162 Renown and
  standing with the Mages Guild"), its time left, what the reading character holds ("3 brewed by you, 5 in your pack"),
  and **Deliver** - waiting, with its reason on its title, in its name for a reader and on the card (a phone has no
  hover), where something is short or the day's three are filled (AUDIT CRAFT-WRITS C8: the day's three were said on the
  title alone). A brew short is asked "at an alchemy station" (FIELD BUGS 2026-10-26: a potion maker anywhere else is
  the client's mix, POTION-DOOR, section 52.3). A press says the guild's thanks and marks its card filled at once, before the list read again comes back
  (C1: a second press meanwhile asked the service again); the balance and the Renown are taken as a Court writ's
  (`onTaken`). The realm's silence and a character changed before the answer are said in their own words (C6), every
  other refusal the service's.
- **The host** (`scenes/craftWritHost.js`, wired in `scenes/world.js` by one statement and one entry - HOST-SPLIT): what
  the pack holds toward a writ, and its goods out of the pack inside the realm act that takes them out of the record
  (`realmGoldAct` - the save checkpointed first, the goods out as the service is first asked; the disenchant's own
  order). Back WHERE THEY STOOD (C9) on a refusal, on an `ok` that moved no record (C1: a request answered again,
  `repeat` with no `realm` - as built first, a second press kept the goods it took out while the record kept them too,
  and the next checkpoint lost them; the service refuses a filled writ under a new request now, `craft-writ-filled`,
  S4), and on a throw before the service was asked. The book's `craftDeliver` (`net/profBook.js`) asks it once - the
  realm act asks again itself; a fill moves the kept list's card and count and has a list read meanwhile read again (C1),
  a record moved under the ask has the book read again (C4), and a brew, a dish or a kit lets the Work list go (C7: the
  card's `brewed` stood a minute behind the station).
- **The four hosts**: the Notice Board is `scenes/world.js`'s; `worldModes.js` and `dungeonContext.js` stand inside its
  page and open no board of their own; `scenes/exterior.js` - FLAGGED in `craftWritHost.js`: the fixed-city bench never
  goes online, so it posts no crafting writ, as no Court writ.

**Audited** cold before its merge: `01-Overview/audits/Audit-Craft-Writs.md` (AUDIT CRAFT-WRITS) - what it found, and
what changed, is marked with its ids above.

### 49.5 As built

- **The law**: `src/net/craftWritLaw.js` (products, guilds, the draw, the pay, the goods, the words); `src/net/marksLaw.js`
  (`MARKS_FAUCETS.craftWrit`, `MARKS_KINDS['craft-writ']`).
- **The service**: `server-account/src/craftWrits.js` (`craftWritBoard`, `deliverCraftWrit`, `sweepCraftWrits`);
  `server-account/migrations/0145_craft_writs.sql` (acct168 and migration 0144 on its branch, renumbered past STAFF-PANEL1 at the merge); `alchemy.js` (a brew's `witnessed`); `index.js` (`/v1/writs/craft`,
  `crafts` on `/v1/writs/list`, the refusals' statuses); `service.js` (the route listed, acct169 - CRAFT-PAYS and
  CRAFT-WRITS one release); `progress.js` (INT16-INT17: a progression claim - its XP and Renown); `cron.js` (an unfilled
  writ swept the day after its own; a filled one stays - a potion writ's brews are counted by it); `professions.js`
  (`renownAnswer` exported). `realm.js` deletes nothing of them: they are the account's (E1), and a filled writ is the
  memory of the brews its filler gave.
- **The client**: `src/scenes/craftWritHost.js`, `src/net/profBook.js` (`craftDeliver`), `src/net/accountClient.js` (the
  door, five refusals in words), `src/ui/noticeWindow.js`, `src/scenes/world.js`.
- **The words**: 28 keys through the text core (`prof.craftWrit.*`, `notice.craftWrit.*`, five `account.refusal.craft*`) -
  `locales/en/Port_Strings.csv` regenerated (`tools/l10nExtract.mjs`), the thirteen languages drafted whole written in
  session (`tools/l10nInSession.mjs`, recorded as the machine's), each in the words its catalog already uses for a writ,
  the pack, silver and Renown; the drafting twelve owe them with the rest.
- **The deploy**: `.github/workflows/account-deploy.yml`'s path filter names `src/net/craftWritLaw.js` (the Worker bundles
  it - ACC4's walk); its new imports (`marketLaw.js`, `itemTemplatesData.js`, `itemLock.js`) were listed already.
- **Pinned**: `test/net/craftwrits_law.test.js` (7), `test/net/craftwrits_service.test.js` (13, through the real Worker),
  `test/net/craftwrits_client.test.js` (7 - the book's delivery against the real Worker among them);
  `tools/mutants/craftwrits.json` (88: 86 dead; `svc-room` equivalent - the marks table's CHECK refuses an overfill - and
  `svc-cap` equivalent - the schema holds the day's three, E1). PIN MOVED: `marks1`, `prof5_law` (a fourth mint),
  `auditscale` (the hour's clock 35), `scale4b` (the Work tab's first read of a day writes the day's three),
  `accountworker` (the table), `int16`'s ROUTES list, `hostceiling` (bootWorld's ceiling 12 up at the merge with main, 36,243 to 36,255 - the host's one statement and one entry, five getters among them, the room main spent meanwhile), and the account version's pins (acct169) (AUDIT CRAFT-WRITS T5:
  `int16_progress` was named here and never moved - it walks the routes itself). `fb1013e_writwall` waits on the real
  Worker's board read by the clock (`performance.now`), not 400 turns - the read does more since the crafting writs ride
  it, and the count ran out under a loaded suite.

## 50. CLOTH-GEMS - the loom's own Linen and Wool, AUDIT 32 S1 judged by the units, and every gem's grade at the jeweller's bench (BUILT 2026-10-25)

The player SaberGGaming's report, "Profession oversights"; the owner: "No band aids". Two of its oversights, verified, and
the owner's decision on each: Linen and Wool are CRAFTED (wool from furs, linen from a herb), not only bought at a counter;
and the jeweller ACCEPTS EVERY GRADE of gem.

### 50.1 What stood (MEASURED, 2026-10-25)

- 4.5 made Linen and Wool the Weavers' alone, "never gathered", and AUDIT 32 S1 (3.2) withheld the first-make 500 from
  every recipe made wholly of them (`recipeLaw.js` `firstCraftPays` over `professionLaw.js` `COUNTER_ONLY`): 152 of
  Outfitting's 332 first-craft keys could never pay, and at tiers 1-2 only 19 of 171.
- The jeweller set DFU's eight gems and the Pearl alone (`JEWEL_GEMS`). The port's graded gems (`Gem-Sockets.md` 4:
  Chipped, Flawed, Flawless, Perfect - templates 1900-1931) were socket loot of the pack with no material key
  (`materialsBag.js` `materialKeyOfItem` answered none for every one), and a set gem added a flat +10% whatever it was.

### 50.2 Linen and Wool, crafted

- **The law** - `professionLaw.js`: `WEAVE_RECIPES` weaves **Linen** from **Root Tendrils** (`LINEN_FIBRE`, DFU's
  template 12, of both plant groups - a recipe a land, `weave:linen-north` and `weave:linen-south`), two a bolt
  (`LINEN_IN`); `SPIN_RECIPES` spins **Wool** from a fur (`WOOL_FURS`: the Rat, Wolf and Tiger Pelts, the Boar and Bear
  Hides - `recipeLaw.js` `PELTS` less the Bat Leather, a wing's skin), two a bolt (`SPIN_IN`, a cure's two), the Bear Hide
  last of its tier (the Ram Kit's - AUDIT FB1021 L2-1's law for the cures) and the Tiger Pelt a press of the player's own
  (a chain never trades it down a tier - `chainLaw.js`). Both at the loom, no XP (a cure's and the Silk's law: the herb's
  and the hide's was their gathering's); a bolt is own where its goods were (`smeltOrigin`).
- DECIDED (the plant was ours to pick, "flax-like"): **Root Tendrils** - the one fibrous plant DFU has in both lands,
  common in the HauntedWoodlands and the Swamp and uncommon in the MountainWoods (`nodeLaw.js` `HERB_TABLES`), kept
  through the winter. Bamboo and the Palm are the south's alone.
- **DEPARTURE** (Ledger A, the row CLOTH-GEMS): Daggerfall keeps no sheep, grows no flax and weaves nothing - its own
  plant and the furs of its own foes stand in.
- **The counter stands**: the Weavers sell both (`WEAVERS_STOCK`, 2 and 3 Marks), into the Stores as bought.
- **The chain** (41.3): a cloth's works are planned from raw now (`chainLaw.js` `producersOf` - the cheapest fur first),
  so a Wool shirt is offered "from raw" to a loom holding four Bear Hides.

### 50.3 AUDIT 32 S1, judged by the units

- **The law** - `recipeLaw.js`: `counterMade` names the recipes S1 judges (made wholly of `COUNTER_ONLY`'s goods - the
  152, every one the loom's); `firstCraftPays(r, own)` pays every other recipe's first as before, and a judged one's only
  where `own` - its units the character's own, no bought and no loose one among them. Unasked, a judged recipe pays none
  (a station that cannot see the units says the rule). FACT, pinned: every Outfitting first-craft key at tiers 1-2 (171)
  is reachable with the character's own goods, and no key of the 332 can never pay.
- **The service** - `server-account/src/professions.js` `craftAtAnvil`: the decision's `p` - for a judged recipe, none of
  its inputs held as loose or bought (a station spends those first, so one held is one spent) - the very test AUDIT
  PROF-541 B7's `bought_with` reads in the same batch; `f * p * ?13` lays the 500 on. The answer says `firstPaid` (read off
  the piece as it stands - a repeat asked after a sale reads the sale's). A disenchant (`alchemy.js`) pays a piece wholly
  of cloth its Enchanting XP only where the piece is its maker's own and never sold (`alchemyLaw.js` `disenchantXp`'s
  `own`: `products.bought_with` none) - AUDIT PROF12 E2's wall, judged by the units too.
- DECIDED: S1 stays the cloth's. A recipe partly of cloth (a boot, a bed, the Cloth Amulet) was never judged and is not;
  the smith's stock stays outside it (every one of its goods is gathered too); and a brew keeps its own rule
  (`alchemyLaw.js` `brewFirstPays` - the Apothecaries' sixteen have no world source, so a brew of them is bought or loose,
  never own).
- **The words** - `ui/craftXpWords.js`: the loom's box says the made cloth's 500 (`prof.page.craft.xpFirstOwn`) where
  `profPages.js` `ownSpend` reads no bought or loose cloth in the Stores and none bought carried, and otherwise that such
  cloth goes first and earns none (`prof.page.craft.xpBought`); the craft's word reads the answer's `firstPaid`
  (`prof.craft.xpFirstBought`, an older service's answer read by the recipe); the Enchanting Station says an own piece's
  figure and, once, the rule (`prof.page.enchant.cloth`); the loom lists its spins (`Spin`) and says where Linen and Wool
  come from where it holds none of their goods (`prof.page.loom.noCloth`); the Outfitting how-to says it all
  (`prof.page.how.outfitting`).

### 50.4 Every gem's grade at the jeweller's bench (Gem-Sockets 7's next slice)

- **A material key a grade** - `professionLaw.js` `GRADED_GEMS`: `gem:<grade>-<kind>` (`gem:flawless-ruby`), DFU's Gems
  group on the port's own row, its tier its graded price's band (`gemTierOfPrice` over `gemGrades.js` `gradedGemPrice`),
  its name the row's. DFU's eight prices have one home (`GEM_DFU_PRICES`, pinned to the templates), and the leaf
  `src/systems/loot/gemGrades.js` holds a gem's kind, grade and price ladder for the loot and the law both
  (`lootRarity.js` and `gems.js` re-export it - no reader moved).
- **The loose door alone** - `LOOSE_ONLY_KEYS`, `looseOnly`: a graded gem is read as every material (`minedMaterial`,
  `materialOf`) and is in no `MINED_KEYS` - the market's catalogue - so no buy order, writ or guild names one, and one in
  the pack still lists from the pack (`marketLaw.js` `storesForm`). The service counts none carried (no harvest yields
  one), so the Stores page's Put in and a writ's put-in move none; a station's shortfall alone (`bagLaw.js` `looseOrder`)
  brings one in, as loose, and the piece made of it is walled to gold as every loose good's - so no commission asks a
  jewel of one (`writLaw.js` `commissionUnyielded`: its piece could fill none, AUDIT 31 L2's law). `market.js` refuses a
  buy order and a Stores listing of one (`bad-material`); withdrawn, it is the gem it came in as. `materialsBag.js`
  `materialKeys` maps every graded gem item to its key.
- **A grade in the recipe id** - `recipeLaw.js` `JEWEL_GEMS`: 41 gems (DFU's eight, the Pearl, the thirty-two), a recipe
  each - `ring:gold:flawless-ruby`, "Gold Flawless Ruby Ring" - 504 jewels where 120 stood. The first-craft key stays the
  piece and base at its tier (`ring@3`), no key new (20 keys), so its kin holds every grade (a Wand's at tier 6: 82).
- **Its points its grade's** - `gemPointsPct`: 9.3's +10% on the grade's own ladder (`GEM_GRADE_PRICE`): a Chipped 2.5, a
  Flawed 5, a plain 10, a Flawless 20, a Perfect 40 - below the plain gem and above it. A Gemcutter's +10% is the cutter's,
  whole beside it. A Gold Ring of a Chipped, a plain and a Perfect Jade: 2,025, 2,160 and 2,700 points.
- DECIDED: a Lapidary's Siege-cracked Gem stands in for a PLAIN gem alone (`takesCracked`) - 3.3's "any gem" was DFU's
  eight and the Pearl, and a cracked stone set as a Perfect one would carry a Perfect's 40%.
- **The bench** - `profPages.js` `drawJewellerBench`: a grade row under the bases where the piece sets a gem
  (`gemGradeWord`: Chipped, Flawed, Plain gems, Flawless, Perfect - the plain shown first), `jewelRecipes(piece, base,
  grade)`; a graded gem in the pack reads as workable, and the points line says its grade's share.
- NOT BUILT: **combining gems** (three of a grade into one of the next) stays `Gem-Sockets.md` 7's - it would make gold of
  loose stones (three Flawed, 1.5 of a stone's price, into a Flawless's 2), the owner's question.

### 50.5 The service

`ACCOUNT_VERSION` acct182 (`service.js`, `wrangler.toml` - `01-Overview/audits/Audit-Foe-Keeps.md` L3's rule): the
decision's `p`, the answer's `firstPaid`, the loom's seven works, the graded gems' keys and recipes, the disenchant's origin,
the kin's one bind (`json_each`, `craftWrits.js`'s way - the decision binds at most 29 of D1's 100) and the market's two
refusals. No migration: `prof_crafts` and `products` keep every column as they were. The Worker bundles the new leaf
(`src/systems/loot/gemGrades.js`, through the professions' law), so `.github/workflows/account-deploy.yml`'s path filter
names it (`test/server/accountdeploy.test.js` ACC4: a bundled file outside the filter would never deploy).

### 50.6 The four hosts and the process laws

- `scenes/world.js` builds the station pages and says the craft's word through `craftXpText`, unchanged (the answer's
  `firstPaid` is read inside it); `worldModes.js`, `exterior.js` and `dungeonContext.js` build no station page and no
  craft word - none to wire. HOST-SPLIT: no host function grew.
- THE NATIVE-WINDOW RULE: the loom's and the bench's rows are the Stores page's own station boxes (section 21), not a
  window DFU has.
- A SLICE CLOSES ITS LEDGER ROW: section C names no loom, weave or jeweller of DFU's (DFU crafts nothing); the departure
  is Ledger A's row.

### 50.7 Words

Twelve new keys and one whose English moved (`prof.page.how.outfitting`), drafted in-session in all 25 languages
(`tools/l10nInSession.mjs`); `prof.page.craft.xpShop` and `prof.craft.xpFirstShop` retired, their rows dropped. The
twelve drafting languages owe the rest of their backlog as before (`06-Systems/Localization-Arc.md` L10N6).

### 50.8 As built

`src/net/professionLaw.js`, `src/net/recipeLaw.js`, `src/net/alchemyLaw.js`, `src/net/writLaw.js`, `src/net/chainLaw.js` (a word),
`src/systems/loot/gemGrades.js` (new), `src/systems/loot/lootRarity.js`, `src/systems/gems.js`, `src/systems/materialsBag.js`,
`src/ui/craftXpWords.js`, `src/ui/professions/profPages.js`, `server-account/src/professions.js`, `alchemy.js`, `market.js`,
`service.js`, `wrangler.toml`, `locales/*/Port_Strings.csv` and their records. Pinned: `test/net/clothgems_law.test.js`
(4), `test/net/clothgems_service.test.js` (2), `test/systems/clothgems_client.test.js` (2), `test/net/clothgems_gems.test.js`
(4), `test/systems/clothgems_jewel.test.js` (2). `tools/mutants/clothgems.json` (50, all dead); re-aimed by content, each
still dead: `audit32` (5), `audit_uicalm_firm1`, `prof3` (2), `prof11`, `prof12` (4), `fb1015f_firstcraft` (7),
`fb1018d_crafthowto`, `fb1018f_craftlimit` (5), `craft2`, `prof10` (4), `gem1`, `loot20`, and the version's ten. PIN MOVED:
`prof7_law`, `prof4_law`, `craft1_chain` (the loom's works, the chain's), `fb1015f_firstcraft` (the words), `prof12_service`
and `prof7_service` (the counter's cloth bought, an own piece's XP), `prof7_client` (a Wool shirt from raw),
`fb1018d_crafthowto`, `prof12_client`, `audit_uicalm_firm1`, `audit32_service` (its title: the units decide),
`prof10_law`, `prof10_client` and `craft2_patterns` (every grade, the kin), `prof9_law` and `prof11_law` (the recipes'
order behind the jeweller's 504), `audit31_law` (the commissions no one could fill), and the version's pins. FOUND on the way:
`test/server/founder5.test.js` was time-bombed - its "later" guest stood at 2026-09-25 + 30 days, which the real clock
passed at 00:00Z on 2026-10-25; its row now stands a day past the real clock, as the pin means it.

## 51. PERK-TRIAL - a specialisation tried before it is kept, and a change that lands at once (BUILT 2026-10-24)

The Discord's feature-feedback, "The time limit of a profession's perks changing" - marbletoff: *"1k silver + week wait is
too punishing. I understand that it's to prevent players from changing it back and forth and getting the best of two
worlds. But the effects of some of the perks can be properly understood only after trying. It's frustrating that I'm stuck
with the useless "Deep Diver" for a week after paying 1k silver."* (Mining 50's Deep Delver.) Three asks: a free change for
24 hours after a pick, a couple of free changes for new players, and the week as a lock after a change rather than a wait
for it to take effect. DECIDED (the owner, 2026-10-24, picked from the three as put to the owner: "Trial + instant"): the first
and the third; the second is the first's work - a new player's first pick is tried for a day.

THE LAW (`src/net/professionLaw.js`; the service's `server-account/src/professions.js` chooseSpec):

- **A choice's day of trial** (SPEC_TRIAL_S, a real day): from when a rank's choice is made - its first, or a paid change -
  changing it is free and at once, as often as wanted. A change on trial neither restarts the day nor waits on the lock;
  it is a row in `prof_choices`, as a first choice is, so a request asked twice is answered once.
- **A paid change** (RESPEC.marks, 1,000 Marks burnt, its line `respec` as ever) takes effect AT ONCE, starts its own day of
  trial, and **locks the track's next paid change for RESPEC.days** (`respec_at` the lock's end; `respec_to` stays empty -
  nothing waits). Inside the lock a paid change is refused (`prof-respec-pending`, its words now the lock's) and nothing
  is burnt. A first choice at the other rank, the merge's free change (CRAFT3) and a choice on its day of trial are
  answered before the lock, as FIRST-PICK answered them before the old wait.
- **Asked as free, never charged**: the page asks a change on its day of trial as one (`trial: true`, `profBook.js`
  choose, off the card as it was armed - AUDIT PERK-TRIAL P1, below); the day out meanwhile, the service refuses it
  `prof-trial-over` (AUDIT PERK-TRIAL P4: it was `prof-spec-stale`, said as a stale page) and the book reads the track again - a card left open across the day's end never burns 1,000 Marks the player was shown as free.
- **The page**: on its day a choice's other cards say "Change: free until <time>"; past it "Change: 1,000 silver", "Press
  again: 1,000 silver, in effect at once. The next change waits 7 days" (AUDIT PERK-TRIAL P5: the lock said before it is paid for); inside the lock the chosen card says "Next change from <date>" and the others
  wait. The track as the service says it carries `trial` (`{ 50: until }`) and `lock`, each only where there is one.
- **The changes already waiting** (migration `0173_perk_trial.sql`): a change bought before PERK-TRIAL and still waiting
  its week lands at the migration, its trial from then (its buyer paid to try it) and its week kept as the lock; one
  already in effect is folded with neither. `specsAt` keeps its fold for a row the migration has not seen.

The fee and the week are the record's PROF0 numbers, kept. The account service's law moved: `acct186` (acct182 on its branch, renumbered past STAFF-EVENT, AUDIT HIDDEN-UNCOUNTED, STAFF-EVENT BOSS and CLOTH-GEMS at the merge; with DECOR-USE's
station; deploy before the site). The page's three new lines and the lock's refusal are the text core's, drafted
in-session for the thirteen whole languages (and the refusal for the drafting ones that held it; `locales/README.md`).

**Pins.** `test/net/perktrial.test.js` (the law's reads, the track as said, the migration over the rows it finds);
`test/net/prof1_service.test.js` (PIN MOVED: the walk - a first pick's day, a trial change and back, a paid change at once,
its own day, the lock's refusal, the week out); `test/net/fb1016b_firstpick.test.js` (PIN MOVED: the page over the real
Worker - a lock at 50 leaves 100's first pick open, its day free past the lock, then the lock; a change asked as free past
its day refused, never charged); `test/net/audit29_client.test.js` (the book asks the day as the day); AUDIT 29 A2's one
burn, one track (`test/net/audit29_service.test.js`, PIN MOVED: the track changed, not waiting). Mutants:
`tools/mutants/perktrial.json`, 25 dead; `audit29.json`, `craft3.json` and `fb1016b_firstpick.json` records re-aimed by
content, and the 44 older records on the choice (PROF1, AUDIT 29, AUDIT 30, CRAFT3, FIRST-PICK, MINE-PERKS) judged again,
all dead.

### AUDIT PERK-TRIAL (2026-10-25)

The owner: *"Audit"*. A cold lane on a frozen snapshot of the branch, given the ask and the files and never this
section, walked the page, the book, the account service and the migration over the real Worker and its node:sqlite D1.
Each finding below failed on the snapshot and passes now.

- **P1 - a card armed free was charged past its day.** The book read the clock at the second press: a card armed as
  free whose day ran out before it was pressed again was asked as a paid change and burnt 1,000 Marks the player had
  been shown as free. The page sends the card's word as it was armed (`trial`, `profBook.js` choose's `shown`), the
  book asks the change so, and a card armed free whose day runs out on the screen arms again at its price.
- **P2 - a free change was a free write.** A change on trial is a row kept for good, and nothing held how often one
  could be asked: the professions' own hour holds it (`overRate`, PROF_OPS_MAX in PROF_OPS_WINDOW_S).
- **P3 - an answer lost was answered as the old one.** The book kept a request's id for each choice it asked, and a
  flip whose answer was lost, asked again after the rank had moved on, was answered by the service as the first - with
  nothing changed. A choice answered forgets every other id kept for its rank.
- **P4 - a free change past its day was refused as a stale page.** It is `prof-trial-over` (409) now, said as itself:
  the free day ended, nothing was spent.
- **P5 - the lock was said only after it was paid for.** The armed card says the week it starts.
- **P6 - a moment was written in English.** The trial's end and the lock's are written as the player's language writes
  a day and a time, in UTC and said to be (`profPages.js`; here and not in `textManager.js`, which the relay bundles).
- **P7 - a choice made in the day before the deploy had no trial.** The migration takes each choice's time from its own
  `prof_choices` row, so one made an hour before has the rest of its day, as one made a minute after has.
- **P8 - a change bought across the deploy waited its week.** An older service writes a change as waiting until the
  new one is up; the law stands a change written as waiting at once whatever its time (`specsAt`), and the service
  folds it with its week as the lock (`trackView` says no `respec`, ever).
- **P9 - the waits' table said "sixty harvests a day"** (`Online-Waits.md`), false since CAP-OFF.

Pinned in `test/net/audit29_client.test.js` (P1, P3), `test/net/fb1016b_firstpick.test.js` (P1 on the page, P4),
`test/net/prof1_service.test.js` (P2), `test/net/perktrial.test.js` (P7, P8) and `test/systems/foraging/prof1_law.test.js`
(PIN MOVED, P8); `tools/mutants/perktrial.json` (31, all dead).

## 52. FIRST-BUDGET and POTION-DOOR - a track's first-makes at Smithing's pace, and the potion maker is the brew's door (BUILT 2026-10-25)

SaberGGaming's report (2026-10-25): Provisioning is slow, and potions made from recipes give no XP. The owner: "No
band aids"; and, asked how fast the tracks should climb: "Match Smithing's pace".

### 52.1 What stood (MEASURED, 2026-10-25)

- **Every track paid alike a craft** - a brew 20 x its potion's tier (`alchemyLaw.js` `brewXp`), a dish 20 x the rank's
  tier (`recipeLaw.js` `cookXp`), a piece 20 x its tier - and +500 once a first-make (`FIRST_CRAFT_XP`, as it stood; the
  first of a pattern at its tier, 41.5). The curve is 10 x n^2: 25,000 XP to Journeyman, 100,000 to Master.
- **What differed was the pool of first-makes**: Smithing 221 (110,500 XP), Outfitting 180 (90,000; 332 - 166,000 - since
  CLOTH-GEMS, section 50, let the loom's own cloth pay the 152 patterns made wholly of Linen and Wool), Building 43
  (21,500 - 41 recipes and the mason's two works; the report counted the 41), Provisioning 22 (11,000 - the four dishes'
  patterns and eighteen of DFU's twenty brews, Water Breathing and Levitation paying none, AUDIT 32 S1).
- **The pace** (`tools/craftPace.mjs`, new - each track walked from no XP, every act the best the rank opens, an unmade
  first-make where one is open, clean wherever the act has one, a cloth pattern's first paid as own): crafts to
  Journeyman and to Master - Smithing 45 and 172, Outfitting 116 and 246 (46 and 176 on CLOTH-GEMS' recipe set, its cloth
  patterns paying), Building 116 and 525, Provisioning 178 and 599.
- **The potion maker earned nothing.** DFU's maker (DaggerfallPotionMakerWindow.MixButton_OnMouseClick and MixCauldron;
  `systems/potions.js` `mixCauldron`) mints its potion on the client and asks no service - nothing by PROF12 law 1 (section
  37) - while the brew on the Stores page paid. The Mages Guild's Make Potions opened that maker, and a Mages Guild hall
  was no alchemy station (`scenes/worldModes.js` `alchemyHere`: an Alchemist's, a home's).

### 52.2 FIRST-BUDGET - a first-make's share a track, at Smithing's pace

- **DECIDED (the owner, asked: "Match Smithing's pace", 2026-10-25)**: each crafting track's first-make pays the share
  that brings the track to Master in the crafts Smithing takes - **Smithing 500** (the 500 it always paid, its pace the
  target: 45 crafts to Journeyman, 172 to Master), **Outfitting 511**, **Building 1,823**, **Provisioning 3,155**
  (`recipeLaw.js` `FIRST_MAKE_SHARE`). Each share is DERIVED, not set by hand: `tools/craftPace.mjs` `firstShares`
  bisects for each track the least share at which the walk reaches Master in Smithing's 172 or fewer, and
  `test/net/firstbudget_law.test.js` holds the law's figures equal to it and each the least (one XP less and the track
  takes a 173rd craft). A change to a track's recipes, its pool or its XP moves the derivation, and the test says by how
  much.
- **One share a track matches Master, not Journeyman as well**: a small pool's firsts come early in the climb, so
  Building reaches Journeyman in 14 crafts and Provisioning in 8, against Smithing's 45 (Outfitting in 45, as Smithing).
  Matching both would take a second figure a track (the firsts paid by the rank they open at, say); the owner's word was
  the pace, and Master is the pace's whole.
- **NO TRACK PAYS LESS THAN IT DID - the floor** (`FIRST_MAKE_FLOOR`, 500, the flat first every track paid before):
  `firstShares` never answers under it, and the law's every share stands at it or above.
- **Before it, on this branch** (superseded): every crafting track's first-makes together paid a fixed 110,500 -
  Smithing's whole pool at the 500 it paid - each the budget over its track's count, the remainder one XP each to the
  first (Building 2,569 or 2,570, Provisioning 5,022 or 5,023), and Outfitting's 332 the floor's 500 at the merge with
  CLOTH-GEMS. It made the small pools the fastest - Provisioning at Master in 20 crafts and Building in 39, against
  Smithing's 172 - and the owner, shown that, chose Smithing's pace.
- **The pace** (`tools/craftPace.mjs`, pinned; crafts to Journeyman / to Master; on CLOTH-GEMS' recipe set):

  | Track | Before (a flat 500) | The 110,500 budget | Now (Smithing's pace) | A first-make pays |
  |---|---|---|---|---|
  | Smithing | 45 / 172 | 45 / 172 | 45 / 172 | 500 |
  | Outfitting | 46 / 176 | 46 / 176 | 45 / 172 | 511 |
  | Building | 116 / 525 | 10 / 39 | 14 / 172 | 1,823 |
  | Provisioning | 178 / 599 | 5 / 20 | 8 / 172 | 3,155 |

- **THE SHARE SAYS HOW MUCH A FIRST PAYS, CLOTH-GEMS WHETHER**: every recipe's first can pay since the loom's own cloth
  does, so every recipe's pattern is in its track's pool (`firstCraftPays(r, true)`); the service binds the share asked as
  own (`firstCraftXp(r, true)`) and its decision's `p` says whether the units are (`craftAtAnvil`, the answer's
  `firstPaid`); the words ask `firstCraftXp(r, own)` with the page's `ownSpend`. The walk pays a cloth pattern's first
  as own - the player levelling weaves his cloth.
- **A first-make is what the service keys its "made before" by**: a recipe's pattern at its tier (`firstCraftKey`, its kin
  one first), a mason's work by its id (`smeltAtForge`), a brew by its potion (`brewAtStation`) - each only where its
  first pays (AUDIT 32 S1, `firstCraftPays` and `brewFirstPays`): Smithing 221, Outfitting 332, Building 43 (41 recipes and
  the mason's two works), Provisioning 22 (the four dishes' patterns and eighteen of DFU's twenty brews). Enchanting and
  the gathering tracks have no first-make, so no share.
- **One home** - `src/net/recipeLaw.js` (`FIRST_MAKE_SHARE`, `FIRST_MAKE_FLOOR`, `firstMakesOf`, `firstMakeXp`,
  `firstCraftXp`, `workFirstXp`, `brewFirstXp`), read by the service's binds (`server-account/src/professions.js`
  `craftAtAnvil` and `smeltAtForge`, `alchemy.js` `brewAtStation` - each binds the share where it bound 500, the
  decision's `first` as it was) and the stations' words (`ui/craftXpWords.js`, `ui/professions/profPages.js`). `craftXp`,
  `brewXp` and `masonXp` take no first; `FIRST_CRAFT_XP` is gone. `brewFirstPays` moved to recipeLaw.js beside
  `firstCraftPays`, and `ingredientKeys` and `keyTemplate` down to professionLaw.js (recipeLaw.js counts the brews, and
  alchemyLaw.js imports it); alchemyLaw.js re-exports the three, so every reader's import stands. ACCOUNT_VERSION acct188
  (acct182 on its branch, renumbered past STAFF-EVENT's acct182, AUDIT HIDDEN-UNCOUNTED's acct183, STAFF-EVENT BOSS's
  acct184, CLOTH-GEMS's acct185, DECOR-USE and PERK-TRIAL's acct186 and AFFIX-LINES and REFORGE-REPLACE's acct187 at the
  merges).
- **The words** say each first's share, its thousands grouped (`{more, number}`): "20 Building experience, and 1,823
  more the first time you make this piece at this grade."; "The first time you cook this dish: 3,155 more Provisioning
  experience."; "Your first cut and your first mix each earn 1,823 more Building experience."; the alchemy station's
  "5 Provisioning experience, and 3,155 the first time.". 41.9 and 41.10's lines stand; their figure is the share.

### 52.3 POTION-DOOR - one door to the brew

- **DECIDED**: online (the Professions pages standing) at an **alchemy station**, DFU's potion maker is the brew's door.
  Its grid holds the Stores' ingredients after the carried ones (each the Stores' row as DFU's own item -
  `profItems.js` `mintMaterialItem` - its key kept; `professionLaw.js` `INGREDIENT_KEYS`, every key that holds a DFU
  ingredient), and a Mix that DFU's recipe law accepts is the station's brew: the cauldron as the Stores hold it (each
  unit's own key - a carried herb its group's, `cauldronKey`), asked of `/v1/prof/brew` through the book
  (`ui/professions/profPages.js` `potionMakerDoor` - the Stores page's own `brew`: its fee, its potions minted on the
  answer, its words), BAG-CRAFT putting what is carried in first (the owner's law, `Materials-Bag.md` section 14). The XP
  is the service's and the window says its answer under DFU's own "Your potion has been mixed." - the world's word, "You
  brewed 2 Potions of Healing (+5042 Provisioning experience)."
- **A Mages Guild hall is an alchemy station** (`alchemyHere` - the hall `enchantHere` already asks), at the Alchemist's
  fee (`ALCHEMY_FEE`, 25 gold a brew); its Stores page's Alchemy Station stands there too.
- **The Stores are never the client's to spend**: a cauldron holding the Stores' goods that no recipe answers is refused
  before anything moves (the brew's own law, section 37), and one past the brewer's rank is refused with the rank said.
- **DFU's maker stays where the brew cannot be had**: a cauldron wholly carried whose potion is past the brewer's rank,
  or whose station's fee the purse cannot meet, is mixed as DFU mixes it and says it earned nothing, and why. Away from a
  station, online (a temple's or the Dark Brotherhood's Make Potions), the mix stays the client's - unwitnessed - and the
  maker says it earns no experience and where it would. Offline the maker is DFU's as it is: no door, no word.
- **A DEPARTURE FROM THE BRIEF, named**: it had "a mix made only from pack ingredients stays unwitnessed". At a station it
  does not, because BAG-CRAFT (the owner, 2026-10-09: "I just want players to also be able to craft from their
  inventory") already brews what is carried at every station and pays its XP - the Stores page's Brew does it with the
  same herbs - and two outcomes for one act at one station would be the band aid. So a pack-only mix stays unwitnessed
  where the brew cannot be had (away from a station, past the rank, the fee unmet, offline), and says so. A brew of
  loose units fills a crafting writ as any brew does (ANY-GOODS, section 49.2).
- **PROF12 law 1 NARROWED** (section 37): DFU's potion maker earns nothing online only away from an alchemy station. The
  DFU member it departs from - DaggerfallPotionMakerWindow's MixCauldron, the client's mint - is `Port-Ledger.md` section
  A's row (POTION-DOOR).
- **HOST-SPLIT**: the maker's hooks moved out of `createWorldModes` to `scenes/potionMakerHost.js` (`potionMakerHooks`:
  M2's pack, cart and bag, the carried recipes, the one minter, the walk's spend and MakePotionService's scan, beside the
  door) - 11,039 to 11,017 logical lines on its branch, 11,066 to 11,044 at the merges with main (on DECOR's 11,066), its
  ceiling lowered. The window (`ui/potionMakerWindow.js`) asks the door
  before it mixes (`hooks.brew`), lists `hooks.storeItems`, keeps each unit's source in the pot, holds one brew at a
  time - its pot untouched while it is asked - and empties its cauldron only when the service brewed.
- **THE FOUR HOSTS**: `scenes/worldModes.js` - wired (the window on the module's hooks; `alchemyHere`);
  `scenes/world.js` - the Stores page's provider (`brew`, `alchemy`) read as it stands, through profPages;
  `scenes/exterior.js` and `scenes/dungeonContext.js` - FLAGGED, none to wire: neither opens a guild's service or the
  maker.

### 52.4 As built

- **The law**: `src/net/recipeLaw.js`, `src/net/professionLaw.js` (`ingredientKeys`, `keyTemplate`, `INGREDIENT_KEYS`),
  `src/net/alchemyLaw.js` (the re-exports, `brewXp`), `src/net/temperLaw.js`.
- **The service**: `server-account/src/professions.js`, `server-account/src/alchemy.js`, `server-account/src/service.js`
  and `wrangler.toml` (acct188).
- **The client**: `src/scenes/potionMakerHost.js` (new), `src/ui/potionMakerWindow.js`, `src/ui/professions/profPages.js`
  (`potionMakerDoor`, the brew's line, `ALCHEMY_HOW`, the away line), `src/ui/craftXpWords.js`, `src/scenes/worldModes.js`,
  `src/systems/tutorialCatalogue.js` (the Crafting page's Alchemy: Alchemists, Mages Guilds), `tools/craftPace.mjs` (new).
- **The words**: twelve keys - the four first-lines' `{more, number}`, the how-to, the away line, the tutorial's two and
  the maker's four (`prof.maker.*`) - drafted in session in the thirteen whole languages; Finnish, Japanese and Polish
  (drafting) their seven, the alchemy rows they held and the maker's words; the nine other drafting languages owe them
  with the rest.
- **Pinned**: `test/net/firstbudget_law.test.js` (5 - the shares and the floor, the keys, the words, the pace and the
  derivation that sets the shares, and the done-when through the real Worker), `test/systems/potiondoor.test.js` (5 - the done-when through the real Worker, the
  door's law, away and offline, the Stores' keys, the Mages Guild hall). PIN MOVED where a first's figure, the rank it
  lifts or the moved hooks stood: `craft2_patterns`, `craft3_five`, `craft4_temper`, `prof3_law`, `prof3_service`,
  `prof4_service`, `prof7_law`, `prof7_service`, `prof9_law`, `prof9_service`, `prof9_client`, `prof10_law`,
  `prof10_service`, `prof11_law`, `prof11_service`, `prof11_client`, `prof12_law`, `prof12_service`, `prof12_client`,
  `prof12_apothecary`, `audit32_law`, `audit32_service`, `fb1015f_firstcraft` (CRAFT-FIRST-SHOWN), `fb1018f_craftlimit`,
  `audit_uicalm_firm1`, `fb1018d_crafthowto`, `fb1011f_stationdoor`, `brand` (A-2), `audit26_potionmaker`,
  `audit63_windows`, `potionmakerwindow`, `bag1_client`, `enhancedPorts` (PORT4: the window made inside its port's call),
  `disc22d_flail_icon` and `buildingLocks.js`'s cites, `hostceiling`, and the account version's pins (acct188); at the
  merge with CLOTH-GEMS, `clothgems_service` and `clothgems_gems` (a first's figure its share - the floor's 500).
- **Mutants**: `tools/mutants/firstbudget.json` (17: 16 dead; `counter-guard-dropped` equivalent - no pattern at a tier
  both pays and is wholly the counter's goods, FACT, pinned), `tools/mutants/potiondoor.json` (22, all dead); 41 records
  re-aimed by content - in `prof12`, `prof11`, `prof9`, `prof3`, `audit30`, `audit32`, `audit_uicalm_firm1`, `craft4`,
  `fb1015f_firstcraft` and `fb1018f_craftlimit` where the first's law moved, in `bag1`, `auditbr5` and `l10n3dwindows` where
  the maker's hooks and words moved - all dead; and ten version records moved, all dead.
- **At the merge with CLOTH-GEMS** (section 50; ACCOUNT_VERSION acct186): `firstbudget.json` 19 - `counter-goods-counted`
  re-aimed as `pool-asked-as-bought` (every recipe's first can pay, so the pool asks the law as own), `counter-guard-dropped`
  no longer equivalent (a recipe wholly of the counter's cloth is in the pool now, and the guard answers 0 for it asked
  as bought - the line a bought bolt makes, `clothgems_client`), and `floor-dropped` and `pace-cloth-bought` new; CLOTH-GEMS'
  `words-own-unread` re-aimed at `firstCraftXp(r, own)`; the ten version records moved to acct186. Judged with
  `potiondoor.json`, `clothgems.json`, `fb1015f_firstcraft.json`, `audit32.json` and `fb1018f`'s re-aimed record: 193, all
  dead. `founder5` is main's (its calendar fix, 4c548132f).
- **RETUNED** (the owner, asked: "Match Smithing's pace"; ACCOUNT_VERSION acct188 at the merges past DECOR-USE and
  PERK-TRIAL's acct186 and AFFIX-LINES and REFORGE-REPLACE's acct187): `firstbudget.json` 23 - the budget's three (moved,
  the remainder dropped, the remainder to the last) re-aimed at the shares (`share-off-by-one`, `smithing-share-moved`,
  `share-past-the-least`), `floor-dropped` at the derivation's search, the walk's two at `firstOf`, and new
  `smithing-pace-ignored`, `bisection-off-by-one`, `share-unread` and `floor-moved`; the ten version records moved to
  acct188. Judged with `potiondoor.json`, `clothgems.json`, `fb1015f_firstcraft.json`, `audit32.json` and `fb1018f`'s
  re-aimed record: 197, all dead. PIN MOVED for the shares: `audit32_service`, `clothgems_service`, `clothgems_client`,
  `fb1015f_firstcraft`, `fb1018f_craftlimit` (the rooms between an act's XP and its first's: 300 and 3,200),
  `prof4_service`, `prof7_law`, `prof9_law`, `prof9_service`, `prof9_client`, `prof11_law`, `prof11_service`,
  `prof11_client`, `prof12_law`, `prof12_service`, `prof12_client`, `prof12_apothecary`, `potiondoor`.

## 53. DAEDRIC-SMELT and DEEP-OPEN - the Daedric Ingot made, and a dungeon's deep veins on anyone's word (BUILT 2026-10-25)

The report (SaberGGaming, through the owner): no Daedric Ingot could be had, and no Dwarven Scrap anywhere. The owner:
**"No band aids"**. Both were verified first, and the owner chose for each.

### 53.1 What stood (MEASURED, 2026-10-25)

- **The transmutation stops at Platinum, as intended** (`professionLaw.js:"export const TRANSMUTE_LADDER = Object.freeze(['metal:tin', 'metal:copper', 'metal:silver', 'metal:gold', 'metal:platinum']);"` - section 37): it was never the Daedric
  ingot's road.
- **4.1's Daedric recipe was never built.** The forge's table ended at Orichalcum ("Daedric waits on its heart and its
  stone"), the ingot stood in `UNYIELDED` (no buy order, no commission, out of the catalogue), and 27 anvil works spent it
  - 26 weapons and armour pieces and the Daedric Repair Kit - none of them reachable.
- **A dungeon nobody had witnessed drew Silver and nothing else.** Probed over 32,249 dungeon-days: Silver 100%, Dwarven
  Scrap 0. Its deep veins were held to `UNCONFIRMED_VEIN_TIER` (3 - section 23's "worth its least"), and a dungeon is
  confirmed only once three accounts a week old have worked it (`nodeLaw.js:"export const WITNESS = Object.freeze({ ageS: 7 * 86_400, confirm: 3, dispute: 2 });"`), which almost never
  happens. Dwarven Scrap is found only in dungeons (4.1), so it was found nowhere.

### 53.2 The owner's decisions

- **The heart: "the heart may come FROM LOOT OR THE GATE".**
- **The veins: "FULL ORE TABLE"** - a dungeon nobody has witnessed draws over its whole table under the account's
  existing four a day (`professionLaw.js:"export const DEEP_UNCONFIRMED_PER_DAY = 4;"`), and the witnesses remain for the climate's
  claim alone.

### 53.3 DAEDRIC-SMELT, as built

- **The recipe** (4.1's, built): an Ebony Ingot, a Daedra's Heart and a Deadlands Ember a unit - the Sigil Stone's name
  since WB12a (`professionLaw.js:"  ingot('ingot:daedric', [['ingot:ebony', 1], [DAEDRA_HEART.key, 1, true]], { embers: DAEDRIC_EMBERS }),"`), the
  forge's last row, smelted only; Smithing's 10 XP a tier (70 a unit) and no first-make, as no smelt pays one (section
  52's `FIRST_MAKE_SHARE` is the crafts' and the mason's works'; `recipeLaw.js` workFirstXp), a Quartermaster's two
  ingots a unit for one ember a unit, as every ingot's (3.3). A recipe's input written `[key, n, true]` is a catalyst and `embers` what a unit spends
  (`professionLaw.js:"export const workEmbers = (r, count) =>"`); every other work carries neither.
- **The heart** is DFU's own Daedra's Heart (ItemTemplates 53, `CreatureIngredients1`, 500 gold), a Stores material at its
  price's tier as a body's part is, 6 (`professionLaw.js:"export const DAEDRA_HEART = dfu('part:daedra-heart', 'hides', gemTierOfPrice(500), 'CreatureIngredients1', 53);"`),
  registered with the loose door's materials beside section 50's graded gems. It comes **from loot** - a daedra's: DFU's ingredient themes give an Imp, a Daedra Seducer and a Daedra
  Lord theirs (`systems/loot/lootThemes.js` CREATURE_INGREDIENT_THEME) - **and from the Gate**: the faithful's chest beside
  Dagon's Breach (`systems/riteChest.js` RITE_HEART, a reagent drawn a heart one time in twelve and a half - WB12d, its
  row the Stores' own since). Both are the very item the pack holds as the forge's input.
- **Through the loose door, never the market.** No door of the service counts a heart, so it enters the Stores only by a
  station's put-in (`bagLaw.js:"export const looseOrder = (o) => o === 'work';"` - the forge's shortfall, or the Stores page's
  Put in, LOOT-LOOSE), as `loose`, a station's alone. It is the loose door's as section 50's graded gems are
  (`professionLaw.js:"export const LOOSE_ONLY_KEYS = Object.freeze([...GRADED_GEMS, DAEDRA_HEART].map((g) => g.key));"`): out of the catalogue, no buy order
  for one and no listing (`bad-material`), no guild writ asking one, and no commission of a work that spends one. On its
  branch the heart had taken the ingot's place in `UNYIELDED`; at the merge with section 50 it joined the loose door's
  list instead, one home for the materials no door of the service counts, and `UNYIELDED` stands empty
  (`marketLaw.js:"export const UNYIELDED = Object.freeze([]);"` - nothing waits on a yield; its guards kept for the next).
- **THE DEPARTURE, NAMED - the heart is a catalyst.** Section 7's law, `smeltOrigin` (PROF0 7, 23), makes an ingot's
  origin its inputs': a loose unit spent makes the product loose (AUDIT BAG-CRAFT A1). The heart's does not reach the
  ingot (`professionLaw.js:"  r.inputs.forEach((inp, i) => { if (!inp.catalyst) b = Math.max(b,"`; the service's decision skips it the same, `professions.js:"    if (inp.catalyst) return;"`) -
  an ingot is own, bought or loose as its Ebony Ingot was. Why: every heart is loot's word, so were its looseness the
  ingot's, no Daedric ingot could ever be listed, ordered or commissioned - the old `UNYIELDED` kept in all but name. The ingot's
  bound is the ember the service counts, one a unit, so the heart a modified client could claim buys nothing past it.
  DFU's Daedra's Heart is an alchemy ingredient (no potion of DFU's twenty asks it); spending it at a forge is the
  port's own - Daggerfall has no professions (Ledger A, the row below PROF2's).
- **The ember from the account's purse, on the service, the Broker's way** (`accounts.js:"export async function insigniaPurse({ db }, player) {"`):
  the smelt's own decision asks that the account's gates, serpents and Redoubts earned the embers its insignia, the
  Panoply and the forge have not yet taken (`professions.js:"  const embers = workEmbers(r, count);"` and the purse's clause beside the
  inputs' in the INSERT), and the same batch adds them to `insignia_spent` - so two smelts pressed at once never spend one ember twice. Short:
  refused `prof-embers` (409), nothing moved. A smelt made answers the embers it spent and the purse left.
- **And from the pack, on the client - the insignia's order** (`systems/sigil/sigilBroker.js` insigniaSale, AUDIT WB9
  F1): the book's hands on the pack's unlocked embers (`sigilBroker.js:"export function emberHands(entity, changed = () => {}) {"`); a pack short asks nothing and
  puts nothing in the Stores (`embers`); the embers are out of the pack BEFORE the service is asked and stay out on its
  smelt - a repeat's too - and come back on a refusal or an answer that never came (`profBook.js:"        if (!r?.ok) took?.back();"`). The world
  host hands the book its hands once the checkpoint stands (`world.js:"  carryHands.embers = emberHands(playerEntity, saveSoon.changed);"` - bootWorld's
  one line more, its reason beside its ceiling in `test/scenes/hostceiling.test.js`; at the merge with main it sits
  inside main's ceiling, which stood one over main's count).
- **Never planned, never asked.** No chain plans the smelt (`chainLaw.js:"export const chainWorkOk = "` - the press is the
  player's own), and no crafting writ asks the Daedric kit (`professionLaw.js:"export const EMBER_MADE = "`; `craftWritLaw.js` WRIT_KITS:
  a writ pays its inputs' worth, and the ember is the account's purse, no Stores good).
- **The Forge** lists the ember beside the row's inputs with the pack's count and bounds the smelt by it
  (`profPages.js:"export function smeltable(r, held, embers = null) {"`), and while it cannot be smelted says what it takes and where a heart
  and an ember are won (`profPages.js:"export const DAEDRIC_LINE = "`).
- **Reachable.** The 27 Daedric works are made at Smithing 90 from the smelted ingot, listed, commissioned (`writLaw.js`
  commissionable), and an order for the ingot is taken - proved end to end through the Worker
  (`test/net/daedricsmelt_service.test.js`).

### 53.4 DEEP-OPEN, as built

- **THE DEPARTURE, NAMED - section 23's "a dungeon not confirmed is worth its least", AUDIT 29 A5's Silver.** A dungeon
  nobody has witnessed draws over the deep veins' whole table at section 6's weights (`nodeLaw.js:"  const table = confirmed ? dungeonVeinTable(climate) : DUNGEON_VEINS;"`):
  Silver, Gold, Dwarven Scrap, Platinum, Adamantium at tiers 3-6, 15 : 10 : 6 : 4 - Dwarven Scrap one vein in seven, where
  it was none. The probe is a pin: 32,256 dungeon-days (`test/net/deepopen.test.js`).
- **What the witnesses still gate in a dungeon (verified).** The climate's claim alone - its own deep ore, a Woodlands or
  HauntedWoodlands dungeon's Moonstone (`nodeLaw.js:"export const deepClimateOres = (climate) =>"`); a confirmed dungeon still refuses another
  climate's claim (AUDIT 29 A4) and is no invented id, outside the four a day. The tier cap is lifted; the gem with it - a
  dungeon's gem is the Diamond whatever its climate, no claim to witness (`nodeLaw.js:"  if (!confirmed && kind !== 'dvein') return null;"`); Deep Delver's
  x2 and the yields never asked. A Surveyor's word changes nothing underground (MINE-PERKS): the draw is anyone's.
- **THE TRADE THE OWNER ACCEPTED.** A dungeon's id is the client's word, so a modified client that invents ids mines four
  full-table deep veins a day - Adamantium, Dwarven Scrap and the Diamond's chance among them - and no more
  (`DEEP_UNCONFIRMED_PER_DAY`, the harvest's own INSERT); an honest player in a real dungeon mines the same four.
- **The ore card** (`ui/oreMapTip.js`) names the table every dungeon draws on its Dungeons line, and says the climate's deep
  ore waiting on its dungeon's witnesses - its state line had read the surface table alone, so a HauntedWoodlands card
  said "No vein here needs witnesses" over dungeons whose Moonstone did. Its words through the text core now (eight
  hard-coded lines to none). **The Mining page** says it in the player's words (`profPages.js` MINING_GROUND_LINE): "Deep
  veins in dungeons can hold any of their ores, Dwarven Scrap and Adamantium among them, in any dungeon; only a woodland
  dungeon's Moonstone waits for three players to gather in it" - where it said "Deep veins in dungeons hold Silver
  anywhere".

### 53.5 The words, the service, the four hosts, the pins

- **Words**: 19 rows in the English catalog (the two refusals, the ember's count, the Daedric line, the ore card's
  thirteen, the Mining line), drafted in-session for all 25 languages - each language's own terms for the Broker's
  embers, the Breaches and the ores, its Mining line kept but the dungeon sentence.
- **The service**: `acct189` (acct182 on its branch, renumbered past STAFF-EVENT's acct182, AUDIT HIDDEN-UNCOUNTED's
  acct183, STAFF-EVENT BOSS's acct184, CLOTH-GEMS's acct185, DECOR-USE and PERK-TRIAL's acct186, AFFIX-LINES and
  REFORGE-REPLACE's acct187 and FIRST-BUDGET's acct188 at the merge). No migration: `insignia_spent` and
  `deep_unconfirmed` stand.
- **The four hosts** (17.1): the streaming world - the book's ember hands (`scenes/world.js`), and the forge's provider
  unchanged; building interiors - the forge (`scenes/worldModes.js` forgeHere), unchanged, its press the provider's;
  dungeons - the deep vein's draw is the law's, `scenes/dungeonContext.js` unchanged (the gathering host stands what
  `nodeLaw.js` draws); the fixed city - FLAGGED as before (no nodes, no forge of its own).
- **Pinned**: `test/net/daedricsmelt_law.test.js` (7), `test/net/daedricsmelt_service.test.js` (5),
  `test/net/deepopen.test.js` (5), and the pins the law moved (PIN MOVED, each): AUDIT 29 A5, AUDIT 30 L7 and S9, AUDIT 31
  L2 (the law's and the service's - the Daedric pieces commissioned, a graded gem's jewel still not: section 50's guard,
  so its two records stand live), CAP-OFF, CRAFT1, GROUND-MIDNIGHT and GROUND-STALE (woodland dungeons now: their Moonstone
  is the only difference a witness makes), UNWITNESSED-ORE, PROF2's law, service and forge, PROF6, PROF7, PROF11,
  VEIN-NEED, TOOL-USE, GATHER-FEEL F2/R4, R3 and V6/V7 and GF2-VEINCRACKS V8 (a dungeon whose first vein is Silver -
  `test/gatherRig.mjs` DEEP_DUNGEON), VEIN-WASH (each deep vein its own ore's wash), MINE-PERKS, ORE-MAP, the hard-coded
  ratchet, and the version's. `tools/mutants/prof2.json`: 30 records added; 9 re-aimed across six lists and the 11
  version records by content. Judged: every record whose source or killing pin this moved, 1,030 - 1,014 dead, 14
  equivalent as recorded, and 2 that survive on main's base as well (PROF12-migration-unique,
  AUDIT30-S5-a-piece-listed-off-the-road - not this slice's to close, named). **At the merges with main** (CLOTH-GEMS
  to FIRST-BUDGET): the heart's records re-aimed at the loose door's list (DAEDRIC-SMELT-heart-unregistered,
  -the-heart-yielded, -ingot-unyielded-again; ASO-unyielded; PROF12's two back to main's text), AUDIT 31's two
  commission records live again and killed (the service's L2 pin on a graded gem's jewel), and the three guards that read
  the empty `UNYIELDED` marked equivalent with the reason (AUDIT30-L7's order and catalogue, AUDIT31-svc-writ-unyielded-word).
  Re-judged on the merged tree, this slice's lists, the re-aimed records and the version's: 369 - 360 dead, 8
  equivalent as recorded, and AUDIT30-S5-a-piece-listed-off-the-road, main's survivor still.
- **NEXT, named.** The Warden's own heart a kill (`systems/gate/gateSpoils.js` rollSpoils, "the Oblivion Gate's gift"):
  cheap in code, but the spoils' order and pictures are pinned by WB5, WB9f, WB12d, WB14g, CARDS-6, GEM2, GILDED2 and
  SET6's floors, so it is a slice of its own; the Gate pays hearts today through the faithful's chest. 4.7's gate-touched
  ground, where a heart is skinned from any foe, is still PROF2b's.

## Appendix A - a day of a gatherer

Ilsa, a Journeyman herbalist and Apprentice miner in Anticlere (a march), sets out at seven (ANY-HOUR: the wilderness keeps no hours now - seven is her habit). The board's Work tab has a
Court writ for 30 Red Poppies (uncommon, tier 2: 30 x 2 x 1.2 = 72 Marks) and the Market's poppy median is 3. She walks
the woods east of town: Woodlands pixels, four herb patches each. Kneeling at a Red Rose she holds the sickle steady -
the meter fills, unbruised. By noon she has 34 Red Poppies (the march's +25%), 60 of ~~60 of~~ today's herbs (CAP-OFF: and the woods' next patches to pick, if she will), and some 4,000
Herbalism XP (HERB-XP: every herb at her rank's tier 4 - 60 a herb, 90 unbruised; it was some 1,800). She delivers 30 poppies at Anticlere's board (72 Marks and 112 Renown XP - MERGE 2: 150 at the full rate, before RENOWN-ACCOUNT's three quarters; a Court writ gives no
influence - only a seat's own writs do), lists 4 Golden Poppies at 12 Marks each, and spends the afternoon at the vein
on the hill: an Iron vein, the march's +25% on it - two strikes, both on the glint (a clean finish), and an Amber (Woodlands' gem).
At dusk the hub warns of a Motherlode in the Wrothgarian foothills in ten minutes; she is too far. Tomorrow.

## Appendix B - every number

| Name | Value |
|---|---|
| Template range | 600-699 (the Skinning Knife 603; the other tools are Foraging's 1600-1603, 1607) |
| Ranks | Novice 0, Apprentice 25, Journeyman 50, Expert 75, Master 100 |
| XP to rank n | 10 x n^2 |
| XP a harvest / a craft / a first craft / a writ | 15 x tier (+50% clean; a quarter for a node or recipe more than two tiers below the rank's top; a haul and a herb at the rank's own tier - PROF8, HERB-XP) / 20 x tier a craft (AUDIT 30 R4: this row said x units) / ~~+500~~ its track's share, the least that brings it to Master in Smithing's crafts, 500 at the least - Smithing 500, Outfitting 511, Building 1,823, Provisioning 3,155 (FIRST-BUDGET, section 52; AUDIT 32 S1: none for a recipe made wholly of goods only a counter sells - CLOTH-GEMS, section 50: unless its units are the maker's own) / 2 x Marks value; answered as credited (AUDIT 29) |
| Tier ranks | 0, 10, 25, 40, 55, 70, 90 |
| Crafts above Journeyman | 2 |
| Respecialisation | 1,000 Marks, in effect at once, the next paid change 7 days after (PERK-TRIAL); a choice free to change for its first day |
| Marks value by tier | 1, 2, 4, 6, 9, 14, 40; herbs 1 / 2 / 5 |
| Daily caps | ~~60 harvests a gathering profession a character (the Basket's among Herbalism's), and 120 an account (AUDIT 29 - a character is an id the client names);~~ 4 dungeon veins an account in dungeons nobody has vouched for (AUDIT 29); ~~Fishing 40 hauls an account; Hunting 30 hides an account,~~ Hunting 3 hides of tiers 5-6 an account - CAP-OFF, 2026-10-07 (Mac: "Remove the cap on life skills"; the two bounds a modified client's claim needs kept, Mac's word): no day's cap on harvests, hauls or hides (section 40) |
| Node tiers | 40 / 25 / 15 / 10 / 6 / 4 % |
| Dungeon veins | 1-4 a day |
| Motherlodes | 3 a day, 20 characters, 10 Marks, one an account a day, 10 (30) minutes' warning; no hours. PROF2b: each in its own third of the UTC day within its first six hours, standing 2 h; Mining 25; tier 6's act; 4-6 ore, half again clean; a Watch receipt of the pixel issued within 10 minutes of the act's end; the mountains' and the deserts' confirmed pixels first |
| Yields | tree 2-4, vein 2-3, herb 1-3, Basket 1 / 1-2 / 1-3, hide 1, haul 1-2, boulder 3-5; order: base, act (x1.5 at most), march +25%, Tide, school +1 (Netter +2); a fraction is a chance |
| Act bound | one quality step, +50% yield |
| Foraging's checks | inside, settlement, sea, foe near, encumbered (FORAGE0 14.3); ~~daylight 07:00-17:59~~ RETIRED (ANY-HOUR, 2026-10-01: no act keeps hours, the service refuses none) |
| Harvest hour | the act's end, at most 10 minutes past |
| Act bands | x0.85 / 1.00 / 1.15 / 1.30 by Foraging's attribute pair |
| Tool wear | 1 an act; 50 harvests a Standard tool |
| Tools crafted | Wood-Axe, Pick-Axe 2 Iron Ingot + 1 Pine Plank; Sickle, Skinning Knife 1 + 1; Spade 2 Iron Ingot + 1 Oak Plank (rank 10); Fishing-Net 2 Linen Bolt; Basket 2 Pine Plank; lives Crude 37, Standard 50, Fine 57, Superior 65, Masterwork 65 |
| Skinning Knife | 603: 0.5 kg, 50 HP, 100 gold, rarity 10; online shelves only |
| Smelting | 2 raw -> 1 ingot; Steel 1 Iron Ingot + 1 Charcoal; Brass 1 + 1; Smithing 10 x tier XP a unit smelted, however many ingots it yields (AUDIT 30 N7: this row said an ingot) - a quarter more than two tiers below the rank's top (AUDIT 29) - under the crafter's limit |
| Logging | chops 5 / 6 / 8, ring 900 ms, band 12-20%, Heartwood 2% |
| Mining | strikes 4 / 5 / 7, glint 1.2-2 s, gem 3% |
| Herbalism | common 0.8 s, steady 2.5 s, 3 degrees |
| Hunting | trace 5-9 points, clean 0.8, torn 0.4 (as built, PROF7 - E held: 4 + tier points across 14 degrees, a zigzag of 3; begun within 2.5 degrees; the tolerance 3 degrees, x1.5 at Master, x (INT + AGI) / 2's band, sampled every 0.25 degree of its progress - AUDIT 32 L1; clean 0.6-6 s from the first move; Gentle 1.2 s) |
| A body (PROF7) | `body:<day>:<12 hex>`, stamped at the player's own kill; a node while the pack holds a Skinning Knife; a hide 1, a clean pelt x1.5, a torn one its part lost; the part one body in four (Big Tooth, Spider's Venom, Giant Scorpion Stinger, Dragon's Scales); the butchery one Raw Meat (the Slaughterfish's Raw Fish), a Butcher's two, a Butcher's meat withdrawn spoiling at half the pace; ~~30 hides an account a day,~~ 3 of tiers 5-6 an account a day (AUDIT 32 L2: hides, not bodies; CAP-OFF, 2026-10-07: the thirty gone); lapsed at the UTC day's turn (B1); reached at DFU's corpse distance (H7); no ground, no hours, no witness; Hunting XP 15 x tier |
| The hides (PROF7) | Rat Pelt 1, Bat Leather 2, Bear Hide 2, Tiger Pelt 3, Spider Silk 3, Scorpion Chitin 4, Slaughterfish Scales 4, Harpy Feathers 5, Dreugh Shell 5, Dragonling Scale 6 (655-664); DEX-HIDES' Wolf Pelt 2, Boar Hide 2, Mudcrab Chitin 1 (681-683 - AUDIT FB1021 L2-4); Cured Leather tier 2, Hardened 5 (665-666); Linen 1, Wool 2, Silk 4, Standard-bearer's Silk 5 (668-671, the last unyielded); a hide 1 kg (Spider Silk and Harpy Feathers 0.25), a bolt 0.5; 8 x the tier's Marks value in gold, a leather and a Silk Bolt x1.5 |
| The loom (PROF7) | a Clothing Store's, 50 gold a craft, a cure or a weave; a home's `loom` station, 50,000 gold; two hides a leather (tiers 1-3 Cured, 4-6 Hardened), a Tanner's two a unit (a choice at 50); three Spider Silk a Silk Bolt; no XP |
| Outfitting's recipes (PROF7) | leather armour at Leather - Cuirass 6, Greaves 4, the rest 2 - Cured (rank 10) or Hardened (rank 55, a step); DFU's 76 garments in each cloth - a bolt, two, three, boots a bolt and a Cured Leather; rugs 3 Wool, tapestries 4 Wool, skins 2 and 1 of a pelt; the Fishing-Net 2 Linen; the steps a Tailor's clothing, a Leatherworker's leather armour; XP 20 x tier, and the first Outfitting's share, 511 (FIRST-BUDGET, section 52; AUDIT 32 S1: not the 152 made wholly of Linen and Wool - CLOTH-GEMS, section 50: unless of the loom's own cloth) |
| A garment's dye (PROF7) | DFU's ten clothing dyes (0-9), chosen at the loom, signed into the record (`u`); every garment (AUDIT 32 L3: the four unchangeable shirts too) |
| The stitch (PROF7) | eight presses, the beat every 0.75 s, the band 0.2 of it x (AGI + SPD) / 2's band, 0.25 s between presses; all eight on the beat a step |
| Fishing | throw 0.3-1.5 s / 3-12 m, wait 5-30 s (first and last daylight hour x0.5, storm x2), tug 600 ms (Angler 840), band 20-30%, fill 6 s inside, 20 s, slip 2 s; pearl 1/50 (Pearl Diver x3, Deep-Sea x2), slaughterfish 1/100 (Deep-Sea x2) - at sea on confirmed ground - trophy 1/200; 1-2 fish, a school +1 (Netter +2); schools 2 a pixel a day, 24 spots, 10 m; ~~40 hauls an account a day~~ (CAP-OFF, 2026-10-07: none); XP at the rank's own tier (PROF8); Raw Fish tier 1, 1 Mark; Pearl tier 5 |
| The Basket's food | tier 1, 1 Mark; 15 XP, 22 with all three found (the clean act) |
| The Basket | three glints of 1.0-1.4 s; clean +50%, two +25% |
| Stores cap | 5,000 a material |
| Board's counters | Linen 2, Wool 3 Marks a bolt (the Weavers', PROF5 - 100 a purchase, bought units; withdrawn since PROF7, and bought at a Clothing Store's loom too); the Apothecaries' sixteen at a fifth of DFU's price in Marks, rounded up (4.5; with PROF12) |
| Quality | the margin table (9.2); a step each, at most, for a clean heat, the family's specialisation and a Warforged ingot; Masterwright +5 Masterwork off the row's lowest (PROF3) |
| The heat (PROF3) | three strikes; the glow's breath 2.0 s; the band from 0.62, 0.2 wide x (STR + AGI) / 2's band; 0.35 s between strikes |
| The smith's stock (PROF3) | Cured Leather 4, Oak Plank 4, Pine Plank 2, Charcoal 2 Marks a unit (twice the Marks value), 100 a purchase, bought units; the planks and Charcoal withdraw since PROF4, Cured Leather since PROF7 (AUDIT 30 R3) |
| A piece's quality (PROF3) | condition x0.75 / 1 / 1.15 / 1.30 / 1.30; weight x1 / 1 / 0.95 / 0.90 / 0.90; Superior a Magic roll, Masterwork a Rare roll and the maker's mark; a tool's life 37 / 50 / 57 / 65 / 65 |
| The Repair Kit (PROF3) | 1 ingot + 1 Cured Leather; a quarter of the most-worn piece of its metal, once; a Quartermaster's two; 10 gold + 10 a tier |
| The woods (PROF4) | Pine 1, Oak 2, Cherry 3, Teak 4, Mahogany 5, Ironwood 6, Ghostwood 6; Ironwood and Ghostwood one tree in 20, confirmed ground only; an unconfirmed pixel's trees tiers 1-2; PINE-SHARE: Pine 2 trees in 5 in a forest whose woods hold no tier 1 (Woodlands, Haunted Woodlands, Swamp, Rainforest, Subtropical), any ground, after the rare wood's roll |
| A tree (PROF4) | 2-4 logs (+25% a march); Resin one tree in four; Heartwood 2% a Clean Cut on confirmed ground, a Forester's 4%, one at most; Logging XP 15 x the tier |
| The ring (PROF4) | chops 5 (tiers 1-2), 6 (3-4), 8 (5-6), a Lumberjack's two fewer, three at least; the circle from 3x the notch to it over 0.9 s and on to 0.5x; the band 12% (novice) to 20% (Master) of the notch x (INT + STR) / 2's band; a Clean Cut two chops; a swing 0.45 s; the creak at half; the fall 1.5 s, a tip and no fade (AUDIT 30 R10) |
| Burning and sawing (PROF4) | a log a Charcoal at a forge (a Charcoal Burner's two); a log two planks at a workbench (a Timberwright's three); no XP |
| The workbench (PROF4) | a Furniture Store's, 50 gold a craft or a saw; a home's `workbench` station, 50,000 gold |
| Carpentry's recipes (PROF4) | staves 3 planks; short bows 3 and a Resin; long bows 4 and a Resin (DFU material by the wood: Pine Iron, Oak Steel, Cherry Silver, Teak Elven, Mahogany Mithril, Ironwood Adamantium, Ghostwood Ebony); arrows 20 of a Pine Plank, an Iron Ingot and 4 Twigs, or 1 Harpy Feathers (PROF7, AUDIT 32 R7), no quality; tables 6 and 3 planks, chairs 2, beds 8 and 2 Linen; the Basket; the Ram Kit rank 60, later (SEAT2); XP 20 x the tier, +500 the first |
| Carpentry's choices (PROF4) | Joiner: furniture at half the planks, rounded up; Bowyer: a step on the bows; a Heartwood: one plank and a step (one step with a Warforged ingot, never two); Master Joiner: every piece of furniture marked |
| The plane (PROF4) | tolerance 18% of the board's half-height x (AGI + WIL) / 2's band, x1.5 at Master; a pass 1.2-4 s, from the head (x <= 0.08) to the foot (x >= 0.98) |
| Furniture's quality (PROF4) | its value x its condition multiplier; no Loot Rarity roll; a Masterwork or a Master Joiner's piece marked |
| The furnisher's stock (PROF4) | Linen 2 Marks a unit, 100 a purchase, bought units; Linen, Cured Leather and Bear Hide had no pack form until PROF7 registered their templates |
| Station use fee in town | 50 gold |
| Alchemy | 2 / 3 potions; Potent +25%, 10% / 20%, +5% an unbruised herb; brewed at an Alchemist's, a Mages Guild hall (POTION-DOOR, section 52) or a home's station, from the Stores page or the potion maker there |
| Enchanting | -10% / -20%; 1 Essence per 100 points |
| Listings | 72 h, 30 an account, 1-1,000,000 Marks (a material's a unit, a piece's whole), 1-5,000 units; a listing's or an order's worth at most 10,000,000 (the Marks cap, AUDIT 30); buy orders 20, 7 days; 60 postings and 120 market acts an hour, each its own counter (PROF5) |
| Fees | listing 1% of the listing's worth, rounded up (min 1); sales tax 5% of a listing's (an order's) running total, rounded down, less what its earlier sales paid (PROF5; AUDIT 30); the Tithe 0-10% / 0-15% from the seller, across the bailiwick (nought until SEAT1 holds a seat); courier ceil(ceil(units / 20) x (1 + px / 25)), min 2, px the hubs' straight line rounded; courier's time 15 min + 1 min per 10 px begun |
| The History (PROF5) | a material's median: the unit price its middle unit sold at over 7 UTC days, across the Bay (an even count's two middle units' mean); its line the seven daily medians; 30 materials shown, 20 trades; kept 90 days; the weekly report's 20 most traded |
| Writs and commissions (PROF6) | a guild writ 1-5,000 units, pay each 1 to floor(1.5 x value), 7 days, 20 open a guild, the Officers' budget 0-10,000,000 a seat week (Sunday 18:00 UTC); a commission 1-1,000,000 Marks, 7 days, 5 open an account, 20 naming a crafter; both taxed 5% of the running total, no fee; 20 posts and 120 other acts an hour; the guild Stores 50,000 of a material |
| Auctions (PROF5b) | Masterworks only; 24 h; opening bid 1-1,000,000 Marks, a bid up to 10,000,000 (the Marks cap); the next bid the opening, else the standing bid + max(1, ceil(5%)); a bid within 120 s of the end adds 120 s, as often as bids come; fee a listing's on the opening, tax a sale's on the winning bid; among the account's 30; twenty closed a read |
| A piece's wear (PROF5) | its condition over its most, in thousandths (1-1,000); the buyer's piece minted at that share, at least 1; read "worn to N%", 99 at most (AUDIT 30) |
| Marks | ~10 gold of play; balance cap 10,000,000; Bank: 1 Mark -> 8 gold, 300 a day |
| Faucets | Court writs 3 a day (from PROF1; CHAP2a: hall writs inside the same 3; CHAP3a: a member's own writ too); gate 50 a receipt, raid 30 a receipt, together at most 150 a UTC day an account (SILVER-WAYS - the gate was 2 a day); a guild deed 25 to the treasury, 3 accounts of 7 days on one raid or gate, 4 a guild a day; Honours 50 / 25; Motherlode 10, one a day |
| Guild contracts (SILVER-WAYS) | raids alone; 1-50 silver a defender, 1-500 defenders, 7 days, 5 open a guild, 3 paid a claim (the best first); the Officers' one writ budget; the 5% running tax; never the posting guild's Officers or Guildmaster |
| Court writs | 6 x max(1, ceil(active / 100)) a region a day, witnessed materials only, 10-50 units, pay x 1.2, Renown 25 x tier x units / 10 at three quarters (MERGE 2), the account's |
| Writ influence | own units at their value, from a 7-day member bound to the guild; bought at Tribute's rate in its cap; counter goods never; a Siege Camp spent at the Turning (a Ram Kit to the siege it won, the rest burnt) |
| Player notes | 3 an account, 7 days; 30 a board |

## Appendix C - the economy model

The numbers above were not guessed. A deterministic model (a seeded Monte Carlo of a week of play, 400 runs a row)
was run over three player profiles and the whole table, and the table was retuned until it balanced. SEAT1d ships
the model as a tool reading townSeatLaw.js and professionLaw.js directly - BUILT (2026-10-01): `node
tools/seatEconomy.mjs` (`--runs`, `--seed`, `--json`) - so every later balance pass is re-run, not re-guessed. Its
re-run is below the first table.

**The players** - a guild's members are 35% casual, 45% regular, 20% hardcore:

| Profile | Sessions a week | In the seat town a session | Harvests a session | Writs a session | Gates felled a week | Renown XP a week |
|---|---|---|---|---|---|---|
| Casual | 3 | 20 min | 20 | 1 | 0.3 | 3,000 |
| Regular | 5 | 30 min | 45 | 2 | 1.5 | 9,000 |
| Hardcore | 7 | 60 min | 90 | 4 | 4 | 25,000 |

Each member does 60% of their play in the pledged region, gathers 2.5 units a harvest at 2.5 Marks a unit on
average, and sends a quarter of it to the Siege Camp.

**The fold (FORAGE0, second review)** changed two assumptions, and the table below is the re-run (ANY-HOUR, 2026-10-01,
undoes the first: the wilderness keeps no hours, so the 0.73 below is 1 again - the day's caps, 60 a character and 120 an
account in a craft, bound the harvests as before; CAP-OFF, 2026-10-07 lifts those caps, and moves no table here: the players' harvests a
session are the model's own assumptions (20, 45 and 90 - `tools/seatEconomy.mjs` PROFILES, never read off a cap), and a
member's influence is bounded by the account's seat week (ACCOUNT_SEAT_WEEK_CAP) as before): **the wilderness
keeps Foraging's day** - a session's surface harvests happen in the 55 daylight minutes of each 120, and the night
gathers at half the day's rate (dungeon veins, Hunting), so harvests run at 55/120 + 65/120 x 0.5 = **0.73** of the
old count; and **Court writs are a fixed supply** (45 regions x 6 x max(1, ceil(active / 100)) a day), which the
first model had let grow with demand - fixed at 270 a day, three hundred accounts would have minted too few (0.57).

**What the first table did** (Court writs 5 a day at x1.5; palace upkeep 1,000; crown 10,000): Marks were minted at
**2.3 times** the rate they were burnt, and a palace's upkeep was 6% of a twelve-member guild's writ income - a
seat that cost nothing. **The retuned table** (writs 3 a day at x1.2, 10-50 units; claim 6,000 / 30,000 influence and
8,000 / 80,000 Marks; upkeep 2,500 / 15,000 with the crown's scale; the Bank's exchange 300 a day):

| Guild size | Influence a week (p10 / p50 / p90) | Writ Marks a week (p50) | Palace upkeep, of that | Crown upkeep, of that |
|---|---|---|---|---|
| 5 | 2,505 / 4,432 / 6,479 | 4,325 | 58% | 347% |
| 8 | 4,726 / 7,249 / 9,737 | 7,057 | 35% | 213% |
| 12 | 7,643 / 10,762 / 13,723 | 10,452 | 24% | 144% |
| 20 | 13,687 / 17,513 / 20,774 | 17,416 | 14% | 86% |
| 30 | 21,834 / 25,987 / 30,201 | 26,464 | 9% | 57% |
| 50 | 36,270 / 42,151 / 48,517 | 43,738 | 6% | 34% |

**The re-run** (SEAT1d, 2026-10-01: `tools/seatEconomy.mjs`, 400 runs a size, seed 1 - the players above, the law's own
sources and caps, the Court writ's own units and pay; the crown's upkeep at a hundred accounts):

| Guild size | Influence a week (p10 / p50 / p90) | Writ Marks a week (p50) | Palace upkeep, of that | Crown upkeep, of that |
|---|---|---|---|---|
| 5 | 1,942 / 3,580 / 5,255 | 3,900 | 64% | 385% |
| 8 | 4,130 / 6,036 / 8,111 | 6,570 | 38% | 228% |
| 12 | 6,268 / 8,858 / 11,484 | 9,660 | 26% | 155% |
| 20 | 12,001 / 14,834 / 17,724 | 15,930 | 16% | 94% |
| 30 | 18,481 / 22,415 / 26,244 | 24,210 | 10% | 62% |
| 50 | 31,834 / 37,180 / 42,357 | 40,320 | 6% | 37% |

The writ income agrees with the first table within a tenth; the influence runs about 15% under it - the first table's
week was not written down, and the tool's is (the Watch a two minutes in the seat town, gates and Renown and the Siege
Camp's quarter of the gathering at 60% in the pledged region, each source and the account at its cap). A palace is
still within an eight-member guild's median; a crown's 30,000 is a forty-member guild's median, beyond a thirty's p90.
Recorded OPEN for Mac in Seats-Arc Appendix C.

What the table means, and why each number is where it is:

- **A palace (6,000)** is within a regular eight-member guild's median week; a guild of five reaches it by sending
  more of its gathering to the Siege Camp. Holding one costs a twelve-member guild a quarter of its writ income - a
  real commitment, not a tax nobody notices.
- **A crown (30,000)** needs a thirty-member guild in a good week (its p90 is 30,201) or a forty-member guild at its
  median: the three
  crowns belong to the server's largest powers, as a capital should. Its upkeep is more than half of such a guild's
  writ income - so a crown is held by being loved (the Tithe, Conscription, vassals' tribute), not by grinding alone.
- **The whole server** (a hundred active accounts, twelve palaces and a crown held, 40% of gathering sold on the
  market, a third of players using the Bank's exchange): Marks minted / burnt = **1.00**. At fifty accounts **0.83**,
  at three hundred **0.81** - gently deflationary at the edges, which is safe, because the Bank's exchange is a
  voluntary valve: players stop selling Marks for gold when Marks grow scarce.
- **Scaling every seat's upkeep** with the server was tried and rejected: seats held already grow with the server, so
  it counted the growth twice (at three hundred accounts **0.73**, against 0.81; re-run with the fold). Only the crown's fixed cost is out of proportion on a small
  server, so only the crown scales (SEAT0 7.1).

**What the model leaves out**: on the faucet side the Motherlodes (10 Marks, one a day) and the Honours (50 / 25); on
the sink side the Tribute, the forts, Festivals, heraldry, respecs and the Board's counters. Each is small beside the
writs and the Bank's exchange, and all of them are in the weekly report the re-run below reads.

MEASURED: the model's players are assumptions. After four weeks of MARKS1 the weekly report (10.5) replaces them
with the server's own, and the model is re-run on those.
