# FIELD BUGS 2026-10-26 - three #bug-reports threads, and the owner's own report

Three threads from the Discord's #bug-reports, handed over by the owner as phone screenshots. Read on main's
`cf20b3714`, with the freeware's data (`tools/fetch-data.sh`), each by a reader of its own beside this one. The pins are
named under each fix, the mutants `tools/mutants/fb1026_*.json`.

The fourth report is the owner's own, in a session: MAKER-RARE, read on main's `e528ddda7`. It was this same file on
its branch and is folded in here at its merge; AUDIT MAKER-RARE, at the end, is its audit.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | SaberGGaming, "Crafting writs not accepting": "I brewed the 7 heal true potions myself and its showing like I haven't made any"; Punch Cat: "I think it's the provisioning ones. I've had the same issues with potions and cooking dishes" | The law as built: a potion writ counted only WITNESSED brews, and a dish or kit writ only pieces not walled to gold - a cauldron or a pan that spent LOOSE units (looted, or bought with gold) was no witness. The card said "0 brewed by you" over brews that had paid their XP. Before POTION-DOOR (2026-10-25) a Mages Guild's potion maker was no station at all: its mixes never reached the service. The owner: "Crafting writs should work with even store bought ingredients. I hate this" | ANY-GOODS (LOOSE-SAID shipped first, #1310, and was retired by it) |
| 2 | runa, "The Masoleum of Darkivaron bugged": "an area (up the elevator in the large central space) is missing but present in the UESP guide ... this one is in a Main Quest to slay a specific Mummy" | The lift works. The shared world builds Darkivaron SMALL (SD-ONLINE), and DFU's GenerateSmallerDungeon drops N0000057 - the hall the lift rises to - for a border block; the quest's mummy stands only in an instance (questMountsHere). The door warned, under "1 - Public" | QUEST-FIRST |
| 3 | Dracanis, "Spell point regeneration effects not functioning": Font of Magnus's 0.2% a round, Soul Siphon's 3% a kill, an item's magicka on a kill; watchoutt...: "On the morning of October 25th, they seemed to be working well. Now, they aren't", then "Found the issue:" (cut off in the screenshot) | NOT REPRODUCED. All three act, through the real modules and the real online ticker. Nothing merged on 2026-10-25 touches them. The two stars sleep where every combat star sleeps - the tree not read, the seat held elsewhere, a duel or a bout, mentoring - and FIRM-STATUS's line in the Firmament window (live that evening) says which | PINNED |
| 4 | The owner: "You cant enchant masterwork/rare armor" | A Rare carries one of DFU's catalogue enchantments as its flavour, so DFU's refusal of an enchanted item kept every Rare - a loot door's and a Masterwork's - off the item maker's list. PROF10 J2 had opened the door for a crafted piece of jewellery alone | MAKER-RARE |

## ANY-GOODS (1) - `server-account/src/craftWrits.js`, `src/scenes/craftWritHost.js`, `src/net/craftWritLaw.js`

WHAT DFU DOES. Nothing to follow: Daggerfall's guilds post no writs (`06-Systems/Professions-Arc.md` section 49).

WHAT THE PORT DID. The card is section 49.4's: "0 brewed by you, 7 in your pack" and "Brew 3 more yourself - Found or
bought bottles do not count". What it counted was section 49.2's: a potion writ the character's witnessed brews
(`prof_brews.witnessed` - 1 only where the cauldron spent no loose unit: `alchemy.js` brewAtStation's decision), a dish
or kit writ its pieces whose `bought_with` is not 'gold' (a pan or forge that spent a loose unit walls its pieces to
gold: `professions.js` craftAtAnvil). A loose unit is what a station's put-in brought that the service never handed out
(`bagLaw.js` LOOSE_ORIGIN) - a looted herb, a reagent bought with gold at a shop, a stack a friend traded. The brew still
paid its XP and said "You brewed 2 Potions of Heal True", and the card counted none of it. Seven potions is no station
brew's count (two a brew below Journeyman, a Brewer's three): it reads as seven of the classic maker's one a mix - the
Mages Guild's Make Potions before POTION-DOOR (section 52.3) made the potion on the client and asked no service.

LOOSE-SAID, THEN RETIRED. #1310 kept the law and had the card say why ("6 potions you brewed today were made with looted
or gold-bought ingredients, which never count"). The owner, the same day: **"Crafting writs should work with even store
bought ingredients. I hate this."** LOOSE-SAID's fields (`looseBrewed`, `loosePieces`), its host count and its two
keys are gone with the law they explained.

FIXED - THE OWNER'S DECISION. A crafting writ is filled by what the character MADE, whatever it was made of
(`craftWrits.js` brewedLeftSql, pieceOkSql): every brew a station made for it counts - `witnessed` is still written as
the brew's record and asked by no writ, and brews from before the column count too - and a dish or kit walled to gold BY
ITS GOODS (`products.loose` 1, migration 0142) fills one as any other of its make. A piece BOUGHT back with gold on the
market (`bought_with` 'gold', `loose` 0) still fills none: it was sold. A brew short is asked "at an alchemy station" -
a potion maker anywhere else (a temple's, the Dark Brotherhood's) is the client's mix, which the service never sees.

THE FAUCET. The writ's bound is unchanged: three an account a day (`CRAFT_WRITS_PER_DAY`), 200 silver each at most
(`CRAFT_WRIT_PAY_MAX`). What changes is what reaches it: a station's put-in moves what the client says its pack holds
past the service's count (BAG-CRAFT's `work` order), so a brew of such goods is now silver within that bound - the wall
GOLD-MARKET kept (gold's goods never fetch silver) is lifted for the crafting writ alone. The Court's writs, the guild
Stores and the market's Drakes side still take `own` and `bought` units only (`bagLaw.js` WRIT_ORIGINS).

No migration. No ACCOUNT_VERSION: the board's answer loses LOOSE-SAID's two fields, which an older client reads as none,
and the decision accepts more - a client older than this deploy shows the count the service reads.

THE FOUR HOSTS. The Notice Board is `scenes/world.js`'s, its crafting writs `craftWritHost.js` (unchanged wiring);
`worldModes.js` and `dungeonContext.js` open no board of their own; `exterior.js` posts no crafting writ (FLAGGED in
`craftWritHost.js`).

THE WORDS. `prof.craftWrit.shortBrew` moved ("at an alchemy station"), drafted in the thirteen whole languages; LOOSE-SAID's
`shortBrewLoose` and `shortMakeLoose` dropped from every table that held them.

PINS: `test/net/fb1026_anygoods.test.js` (3: a potion writ filled wholly by brews of loose goods, a dish writ by stews
cooked of them with a gold purchase refused, the station's words). Mutants `tools/mutants/fb1026_anygoods.json` (4, all
dead). PIN MOVED: `craftwrits_service`'s loose cauldron (it filled nothing; it counts now), `craftwrits_client` (the
host's `held` back to `{ pack, made, ready }`). `tools/mutants/craftwrits.json`: CRAFT-WRITS-svc-loose-brews-count
retired (the clause it dropped is gone - ANY-GOODS-witness-asked-again is its inverse), S2-alias-shared, T2-bought-refused,
T2-gold-let-in and svc-listed-ok re-aimed by content; judged again, 88 dead, 2 equivalent as recorded. LOOSE-SAID's
`fb1026_loosesaid.test.js` and its mutants removed with it.

## QUEST-FIRST (2) - `src/systems/instancePlaces.js`, `src/scenes/instanceDoor.js`

WHAT DFU DOES. The Masoleum of Darkivaron (Isle of Balfiera, map id 9601832) is eight blocks: N0000091 (the start),
N0000057 north of it, and six border blocks. N0000091's central hall holds a lift - object 27601, model 72019, a 3 m
platform rising 24.65 m (7.33 to 31.98) in 15 s, its levers 51804 below and 51910 above - and from its top a door
(act 4, 16297) at the block's north edge opens into N0000057. DFU's own Smaller Dungeons option
(DaggerfallDungeon.GenerateSmallerDungeon) lays one interior block, the start's, in borders: N0000057 is gone, and the
lift rises into a border block. S0000018, Dust of Restful Death, draws its crypt from Balfiera's seven (`Place _crypt_
remote dungeon0`) and places its mummy there.

WHAT THE PORT DID. Measured on the freeware's data, with the port's own collider, motor and actions: the ride is exact
(a PlayerMotor at the platform's centre, corners and edges rides to 31.98 every time), and in the whole build the walk
from the lift's top goes on into N0000057 (about 2,450 standing spots; with rides and jumps the entrance reaches all
eight blocks). But online the world draws each dungeon's public size from its map id (SD-ONLINE, `smallerDungeons.js`
onlineDungeonSize), and Darkivaron's is SMALL: the walk from the lift's top ends after 44 spots, in a border block. That
is the report's "missing area" - DFU's own smaller build, which the shared world chooses for about a fifth of the
dungeons (847 of 4,232; 845 of them lose an interior block). And a quest's things stand online only in a dungeon whole
(INSTANCES, `11-Multiplayer/Instances.md` section 4: questMountsHere), so the shared room never holds S0000018's mummy.
The door says so (QUEST-ELSEWHERE, FIELD BUGS 2026-10-16c: "Your quest's business here is only in your instance. The
shared dungeon is smaller and has none of it.") - under "1 - Public", the first row and the habit's key. Two of
Balfiera's seven crypts are built small: Darkivaron and Ruins of Old Barbara's Place, the 2026-10-12 report - the
reporter's "second dungeon of this type".

FIXED. Where a quest of mine names the place and the shared world builds it smaller (`dungeonSite`'s `relaid`), Public
is the LAST row (`instancePlaces.js:"  const publicLast = questHere && relaid;"`): the party's rooms, then mine, then
Public - so "1" is a room the quest can be done in, the crypt whole with its upper hall and its mummy. Everywhere else
the order stands (a quest's dungeon laid whole in public, a re-laid one with no quest of mine, the Hold). The line still
says why. HEIR-WHOLE's remains in a re-laid dungeon are a quest's place by the same law (`instanceDoor.js` questHere),
so their door lists the heir's instance first too. For the reporter now: leave, come back, and take "Your instance".

THE FOUR HOSTS. The door is `scenes/instanceDoor.js`'s: `world.js` builds it and hands it on (`instanceDoor`, read
from its page - the change is the law's, so nothing there moves); `worldModes.js` asks it at a dungeon's and a building's
door (enterDungeonDoor, enterBuildingDoor - wired, unchanged); `dungeonContext.js` and `exterior.js` open no instance
door (`11-Multiplayer/Instances.md` section 7).

NOT DONE - THE OWNER'S CALL. The shared world still builds Darkivaron small, so a player exploring it in Public still
finds the lift ending in a border block. Building every dungeon of no more than eight blocks at medium (its medium
build is itself, so its public room would be whole) would give the lift its hall back for everyone, and reverse part of
SD-ONLINE's "World mixes sizes" (2026-10-05). Nothing pins a real lift on the freeware's data.

PINS: `test/systems/quest/instances3_door.test.js` QUEST-FIRST (the law's orders; the report's crypt by its own eight
blocks, built small, its popup's rows and both entries; a whole one as it was). Mutants
`tools/mutants/fb1026_questfirst.json` (6, all dead). Moved: `fb1019f_heirwhole` (the heir's instance now the first row
at a re-laid ruin - its three presses), and re-aimed by content `instances.json`'s INSTANCES-HOLD-PUBLIC; `instances.json`
judged again 51 dead, `fb1019f_heirwhole.json` 16 dead.

## The spell points (3) - pinned, not reproduced

WHAT DFU DOES. Nothing to follow: the Firmament and the Loot arc's lines are the port's own.

WHAT THE PORT DOES. Font of Magnus and Clarity are `{ mpRegen: 2, mp: 8 }`, Soul Siphon `{ killMana: 3 }`
(`firmamentTree.js`); the round's regeneration and the kill's magicka are `firmamentPowers.js`'s firmamentRound and
firmamentKill, registered as a magic-round hook and a kill listener; the wellspring line (magicka on a kill, jewellery)
is `lootPowers.js` lootKill. All three give through one door, `playerHeal.js` manaMine. A real character with the
Renown layer, both stars bought and the real online ticker on the shared clock: about 0.2% of the maximum a round, 3% a
reported kill. Every merge of 2026-10-25 was read for these files: FIRM-RETRY and FIRM-STATUS (`98930c243`, how the tree
is read and a status line), the regeneration hold (`47dbfd594`, health alone), EVENT-RULES (health alone), the loot level
gate (drops alone) - none moves them. What makes them look dead in play, by design:
- **The stars asleep** (`firmamentAwake`): the tree not read from the service, or no sign accepted; another tab or
  device holding the online seat; a duel or an Arena bout (`sigilDueling`); mentoring a lower party (`_mentor`). The
  wellspring sleeps on none of these. FIRM-STATUS's line in the Firmament window says which: it reached main at 22:12
  UTC on 2026-10-25 in THE FOLD (#1280, `34584a5c0`) - the evening the second report says the stars stopped, and likely
  its "Found the issue". THE FOLD's whole `src/` diff (87 files) was read for the magicka path as well: no line of it
  touches a round's hook, a kill's report, manaMine or a star's gate.
- **The kill not the player's**: bodies the relay runs (a gate's boss, the Spire's lords, stand-ins) report no kill to
  `playerKills.js`, so Soul Siphon and the wellspring never fire on them.
- **The amounts**: a round is a game minute, five real seconds online; at 150 Spell Points 0.2% is a point every 17
  seconds, Soul Siphon 4 a kill.

FIXED. Nothing to fix was found. The magicka half was unpinned beside the health half's (AUDIT UICALM-FIRM1 L5 H5 pinned
killHeal and hpRegen alone): it is now, on the reported stars by name.

ASKED OF THE OWNER. What watchoutt... found (the screenshot ends at "Found the issue:"), and where the kills were.

PINS: `test/systems/audit_uicalm_firm1.test.js` FIELD BUGS 2026-10-26 (Soul Siphon's 3% a kill, none for a felled
player; Font of Magnus's 0.2% a round of the maximum the layer lays; nothing past full; asleep in a duel and mentoring;
Clarity's round). Mutants `tools/mutants/fb1026_magicka.json` (4: 3 dead, 1 equivalent as recorded - manaMine's own
clamp holds the full pool).

## MAKER-RARE (4) - `src/systems/enchanting.js`

WHAT DFU DOES. The item maker lists an item only if it is not enchanted: AddFilteredItem skips `item.IsEnchanted`
(DaggerfallItemMakerWindow.cs:419-422, the line the tree cites), which is `HasLegacyEnchantments ||
HasCustomEnchantments`. DFU has no tier above its magic items and artifacts, so in DFU the refusal only ever kept
MAGIC.DEF's items and the artifacts out, and an item the maker made from coming back. SetEnchantments ends with
IdentifyItem (DaggerfallUnityItem.cs:1341): whatever the maker touches comes out identified.

WHAT THE PORT DID. The Loot Rarity ladder gives every Rare one of DFU's catalogue enchantments as its flavour
(`lootRarity.js` applyRarity, RARE_FLAVOURS), and a cursed Rare its drawback beside it (cursePiece). A smith's Masterwork
rolls a Rare (`smithItems.js` mintPiece). So DFU's refusal read every Rare as a magic item: off every tab of the item
maker, on both skins. AUDIT PROF10 J2 (`06-Systems/Professions-Arc.md` 36, Mac: "Item maker can add to it") opened the
door for a crafted piece of jewellery and nothing else (`keptEnchantments`), and AETHERIC-MAKER's record
(`Field-Bugs-2026-10-03b.md`) wrote that every other enchanted item stays out "because they carry enchantments" - a
consequence of DFU's filter meeting the ladder, never decided. The report's piece, a Masterwork Daedric Cuirass,
carries Water Walking when held and 1,200 enchantment points; it was not listed.

FIXED. The item maker takes an IDENTIFIED RARE with the rows its ladder rolled on it - its flavour, one of its group's
RARE_FLAVOURS, and a curse's drawback, the curse's own - and any the maker laid since; a Rare carrying any other row is
DFU's still (`enchanting.js` rareKeeps, keptEnchantments; `itemMakerWindow.js` itemMakerFilter reads it, so both skins
list it). Those rows stand at the head of the two lists in the forced colour, are never taken off, count in the
ten-row guard and the picker's filters (so the picker never offers a curse's own setting again), and stay ahead of the
new rows (applyEnchantments, J2's own path). A bound soul's forced set is added whole, past those filters, and may hold
a row of the drawback's very kind (a Wraith's Item Deteriorates in holy places): the temple's lift takes the last row of
the curse's kind that no maker laid (`lootCurse.js` liftCurse, AUDIT MAKER-RARE A1).

THE LADDER'S ROWS COST THE MAKER NOTHING - this change's choice, put to the owner (below). A crafted jewel's roll is
drawn among the flavours its points hold (AUDIT PROF-541 J4), so J2 costs it against them, and a crafted jewel keeps
J2's costing. Any other Rare's flavour is drawn whatever its points - Regens Health costs 3,000 of the maker's points; a
Steel Cuirass holds 400, a Daedric one 1,200 - so counted, 622 of the 1,144 Rare armour piece, metal and flavour pairs
would start over their budget and only 475 could take even the cheapest power (Feather Weight, 100). The report's own
cuirass is not one of them: its Water Walking costs 170, and counted it would hold 1,030. A curse's drawback - a side
effect, whose negative cost buys points when a player chooses it - buys none (the temple may lift it later). The rows
the maker lays on a Rare cost as they always do, the side effects among them buying their points. This is the item
law's budget already (`itemLaw.js` makerFindings costs a crafted jewel's kept rows and no other piece's), so the law
does not move: ITEM_LAW_VERSION stays 14 and no account service is owed.

WHAT STAYS OUT. An UNIDENTIFIED Rare: the maker would show its hidden rows and, through SetEnchantments' IdentifyItem,
identify it for nothing - the Mages Guild's Identify (or the spell) first, as the Reforge, the Imbue and the temple's
lift each ask ('unknown'). A Masterwork is minted identified, so it is listed at once. A LEGENDARY keeps DFU's refusal by
its tier - a fixed record, named and made like an artifact (`06-Systems/Loot-Rarity.md`, Names) - even where its
record's row is a Rare's own flavour (Lysandus's Visor). With the LADDER SWITCHED OFF the item maker is DFU's for a Rare,
found or a Masterwork (AUDIT MAKER-RARE A2); online the lane forces the ladder on. DFU's MAGIC.DEF items and the
artifacts stay out by DFU's own filter; AETHERIC-MAKER's Aetheric and Gilded refusal is untouched.

Port-Ledger A: THE ITEM MAKER TAKES A RARE. `06-Systems/Professions-Arc.md` 36's J2 sentence narrowed beside it.

PINS: `test/systems/fb1026_makerrare.test.js` (3: the report's cuirass through the window - listed, its roll free,
enchanted, paid, lawful, listed again with the maker's row costed; a found Rare out unidentified and in identified, a
Rare of every group and both cuts of clothing on its tab, a maker's side effect still buying its points, DFU's own
magic and artifact off DFU's table, two Legendaries, four forgeries of a Rare's rows and the ladder switched off
refused; a cursed Rare's drawback free and its setting never offered again, two forgeries of a cursed Rare's rows
refused, and a Wraith's soul bound through the window from a soul trap bought and filled, then the curse lifted - the
curse's own row gone, the soul's kept, the piece lawful). The honest sweep's item-maker section gains two runs
(`test/honestItems.mjs`): a spread of 400 identified Rares, loot and crafted, and every cursed Rare the doors minted,
through the maker - 453 enchanted pieces at four seeds, 62 of them cursed - then each cursed one lifted at the temple (62,
22 beside a bound soul's forced rows); every one lawful, in the save and on the wire. INT1 holds both runs to that
makeup (every group found and crafted, the cursed and their lifts) and its producer count moved to 91 (PIN MOVED). PIN
MOVED in `prof10_client.test.js`: J2's "no provenance" and "another recipe" pieces are no crafted jewels, and as
identified Rares they are taken now, their roll free. Mutants `tools/mutants/fb1026_makerrare.json` (22, all dead);
prof10's AUDIT-PROF10-J2-kept-any-enchanted re-aimed by content at the new guard (dead).

## AUDIT MAKER-RARE (the owner: "Audit this")

Three lanes read the slice cold, each in its own worktree of the pushed head (`24123e927`), and no line was touched until
all three had reported: A, the item maker's own law and its exploits; B, every other system that reads an enchanted Rare;
C, the record - its tests, pins, mutants and docs. Every finding was reproduced on the tree before it was fixed.

| | Finding | Lane | Done |
|---|---|---|---|
| A1 | BLOCKER. A cursed Rare enchanted with a bound soul whose forced set holds the curse's drawback kind (26 soul, drawback and group pairs: Item Deteriorates with a Ghost, a Wraith, a Lich, a Daedroth, a Frost Daedra or a Daedra Seducer; User Takes Damage with a Daedra Lord or a Daedra Seducer; Bad Reactions From with a Daedra Seducer, a Fire Daedra or a Daedroth; Low Damage Vs on a weapon with a Ghost, a Lich, a Wraith or a Daedroth), then lifted at the temple: the lift took "the last of its kind" - the soul's row - and left the curse biting, so the item law found two rows on an uncursed Rare and the soul's set broken: the owner's trade held, the piece off the maker's list and no temple to lift it again. MAKER-RARE's "the temple's lift after it takes the curse's row, never the maker's" was false for a soul | A, B, C | FIXED: the lift takes the last of the kind that no maker laid (`lootCurse.js` liftCurse; `enchanting.js` makerLaid, exported as the one test of a maker's row beside the law's isMakerRow). Shipped before any such piece could exist |
| A2 | With the ladder switched off the maker took a Rare, while Loot-Rarity.md's switch says "Off ... DFU's loot, exactly" and a garment and a Masterwork are DFU's off (AUDIT LOOT II A9) | A | FIXED: rareKeeps asks the switch; a crafted jewel keeps J2's door, which never asked it |
| B2 | Pre-existing, made wider: a Masterwork of your own make enchanted since is no crafted piece the market lists (smithItems.js asMinted) nor an auction's, and the pack's list greyed it out saying "made by you. List it as a crafted piece" - a list it was not on. A Fine or Superior piece enchanted under DFU's own maker, and J2's jewels, met it before | B | FIXED: "changed since you made it. Trade it, or sell it at a counter" (`marketTab.js` CHANGED_PIECE_WHY), as a spoiled dish is said (R2-C7) |
| C2 | The branch conflicted with main: main's #1310 had written this record's path (LOOSE-SAID, QUEST-FIRST), and a conflicting pull request runs no workflow | C | FIXED: main merged in, MAKER-RARE folded into this record as its fourth report |
| C3 | The sweep's Rare run was a 400-piece spread, three of them cursed - why A1 slipped through - and INT1 held only that the producer existed, so it could shrink to one jewel and stay green; the record called it "every identified Rare" | C | FIXED: every cursed Rare beside the spread, each lifted after in a run of its own, and INT1 holds both runs' makeup |
| C4 | A cursed Rare carrying a row more than its ladder rolled was taken (the mutant `1 + (cursed ? 2 : 0)` lived) | C | FIXED with C5, pinned |
| C5 | rareKeeps counted the ladder's rows and never asked what they were: a Rare whose one row its ladder never rolls (a blade's Vampiric Touch on a helm, 1,380 points) was taken with that row free, against "and no other" | C | FIXED: the flavour one of its group's RARE_FLAVOURS, a second row only the curse's own - the item law's reading (tierFindings) |
| C6 | The reason for free rows was overstated ("nearly no Rare armour could ever take a row, and the report would stand"), and the Port-Ledger row's decision column credited it to the owner, who asked that Rares be enchantable | C | FIXED: the reason measured (above) and the choice named as this change's, put to the owner |
| C7 | Test 2's "DFU's own magic and the artifacts" were a Rare with a forged `magic` or `artifact` mark | C | FIXED: a MAGIC.DEF item and Ebony Mail off DFU's table, the forged marks kept and named as forgeries; a Legendary carrying a Rare's own flavour added (its tier clause had no killer once C5 landed) |
| C8 | "Every group a Rare rolls on" covered no men's clothing | C | FIXED: a men's Kimono |
| C9 | keptEnchantments' docblock kept J2's "every row costed" and "null for any other enchanted item" with MAKER-RARE appended beneath; two comments said "a crafted piece's" alone; Professions-Arc 36 said a Masterwork "of any craft" rides free (a jewel's is costed); section 36's pins counted 13 tests and 166 mutants | C | FIXED: rewritten whole, "of any other craft", 16 and 173 |

SAID, NOT CHANGED.
- A bound soul's forced set may repeat a Rare's flavour (a Wraith's Regens Health in darkness beside a cuirass's): the
  card lists it twice and both rows run. DFU's forced sets do the same beside any row a player chose.
- `lootRarity.js` damnPiece finds the curse's row the same way the lift did, and was left: it runs at a door's mint, on
  a Legendary weapon, which no maker has touched or takes.
- The owner's word is asked on the free rows: a Rare's own rows cost none of its points (this change's choice, and the
  item law's budget), or they count as J2 counts a crafted jewel's, which would refuse 622 of 1,144 armour pieces any row.

PINS: as MAKER-RARE's above - `fb1026_makerrare` (A1, A2, C4, C5, C7, C8), INT1 (C3), `goldmarket_client.test.js`'s
R2-C7 test (B2, PIN MOVED: the enchanted Masterwork beside the spoiled dish). Mutants: the twelve AUDIT-MAKER-RARE records
in `tools/mutants/fb1026_makerrare.json`, all dead.
