# FIELD BUGS 2026-10-26 - three #bug-reports threads

Three threads from the Discord's #bug-reports, handed over by the owner as phone screenshots. Read on main's
`cf20b3714`, with the freeware's data (`tools/fetch-data.sh`), each by a reader of its own beside this one. The pins are
named under each fix, the mutants `tools/mutants/fb1026_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | SaberGGaming, "Crafting writs not accepting": "I brewed the 7 heal true potions myself and its showing like I haven't made any"; Punch Cat: "I think it's the provisioning ones. I've had the same issues with potions and cooking dishes" | The law held: a potion writ counts only WITNESSED brews, and a dish or kit writ only pieces not walled to gold - a cauldron or a pan that spent LOOSE units (looted, or bought with gold) is no witness. The card said "0 brewed by you" over brews that had paid their XP, and never why. Before POTION-DOOR (2026-10-25) a Mages Guild's potion maker was no station at all: its mixes never reached the service | LOOSE-SAID |
| 2 | runa, "The Masoleum of Darkivaron bugged": "an area (up the elevator in the large central space) is missing but present in the UESP guide ... this one is in a Main Quest to slay a specific Mummy" | The lift works. The shared world builds Darkivaron SMALL (SD-ONLINE), and DFU's GenerateSmallerDungeon drops N0000057 - the hall the lift rises to - for a border block; the quest's mummy stands only in an instance (questMountsHere). The door warned, under "1 - Public" | QUEST-FIRST |
| 3 | Dracanis, "Spell point regeneration effects not functioning": Font of Magnus's 0.2% a round, Soul Siphon's 3% a kill, an item's magicka on a kill; watchoutt...: "On the morning of October 25th, they seemed to be working well. Now, they aren't", then "Found the issue:" (cut off in the screenshot) | NOT REPRODUCED. All three act, through the real modules and the real online ticker. Nothing merged on 2026-10-25 touches them. The two stars sleep where every combat star sleeps - the tree not read, the seat held elsewhere, a duel or a bout, mentoring - and FIRM-STATUS's line in the Firmament window (live that evening) says which | PINNED |

## LOOSE-SAID (1) - `server-account/src/craftWrits.js`, `src/scenes/craftWritHost.js`, `src/net/craftWritLaw.js`

WHAT DFU DOES. Nothing to follow: Daggerfall's guilds post no writs (`06-Systems/Professions-Arc.md` section 49).

WHAT THE PORT DID. The card is section 49.4's: "0 brewed by you, 7 in your pack" and "Brew 3 more yourself - Found or
bought bottles do not count". What it counts is section 49.2's: a potion writ the character's witnessed brews
(`prof_brews.witnessed` - 1 only where the cauldron spent no loose unit: `alchemy.js` brewAtStation's decision), a dish
or kit writ its pieces whose `bought_with` is not 'gold' (a pan or forge that spent a loose unit walls its pieces to
gold: `professions.js` craftAtAnvil). A loose unit is what a station's put-in brought that the service never handed out
(`bagLaw.js` LOOSE_ORIGIN) - a looted herb, a reagent bought with gold at a classic shop, a stack a friend traded - and
a writ pays silver, which no client's word may mint (GOLD-MARKET), so the wall stands. But the brew still paid its XP
and said "You brewed 2 Potions of Heal True", and the card never said why it counted none. Seven potions is no station
brew's count (two a brew below Journeyman, a Brewer's three): it reads as seven of the classic maker's one a mix - the
Mages Guild's Make Potions before POTION-DOOR (section 52.3) made the potion on the client and asked no service, so
nothing at all stood behind them.

FIXED. The board reads, beside what fills a writ, what the character made that never can
(`craftWrits.js:"async function craftWritView(db, player, row, character) {"`): a potion writ's `looseBrewed` - its
potions brewed since the writ's day began that were no witness (today's alone: a brew from before the witness column
reads 0 too, and a writ is the day's) - and a piece writ's `loosePieces`, the pieces of its make walled to gold, newest
first and none on the market. The host counts them (`craftWritHost.js` held: `loose`, a piece writ's only where the
pack holds the piece), and the card's reason says them: "6 potions you brewed today were made with looted or gold-bought
ingredients, which never count - brew 3 more from ingredients you gathered or bought from the Apothecaries", "2 pieces in
your pack were made with looted or gold-bought goods, which never count - make 3 more from goods you gathered or bought
with silver" (`craftWritLaw.js` craftShortText). With none, the brew is asked "at an alchemy station" - a potion maker
anywhere else (a temple's, the Dark Brotherhood's) is the client's mix and fills nothing. No migration and no
ACCOUNT_VERSION: the answer grows two fields an older client never reads, and an older service's board reads as none
(pinned).

THE FOUR HOSTS. The Notice Board is `scenes/world.js`'s, its crafting writs `craftWritHost.js` (unchanged wiring);
`worldModes.js` and `dungeonContext.js` open no board of their own; `exterior.js` posts no crafting writ (FLAGGED in
`craftWritHost.js`).

NOT DONE. The brew's own answer does not say that it fills no writ (the card does, on the next board read). A brew from
before 2026-10-26 is not named on the card.

THE WORDS. Three keys - `prof.craftWrit.shortBrew` (moved: "at an alchemy station"), `shortBrewLoose`, `shortMakeLoose` -
drafted in session in the thirteen whole languages; the drafting twelve owe them with the rest.

PINS: `test/net/fb1026_loosesaid.test.js` (3, two through the real Worker). Mutants `tools/mutants/fb1026_loosesaid.json`
(11, all dead). Moved: `craftwrits_client` (the host's `held` says `loose`), `craftwrits_law` (shortBrew's words).
`tools/mutants/craftwrits.json` judged again: 89 dead, 2 equivalent as recorded.

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
