# QUEST-AUDIT II - how the town mods break quests, measured again, and fixed

The owner, 2026-10-05: *"I really just want to audit quests and how they become broken when beautiful cities was
integrated"*. The first audit (QUEST-AUDIT, `Field-Bugs-2026-10-04d.md`) fixed the unreachable markers, the house-less
Arkay temples and the re-seat's law, and a day later a field report found a class it had not measured (SEALED-CELLAR,
`Field-Bugs-2026-10-05.md`). This one hunts by failure class instead, four of them at once, each measured over the
player's data through the port's own readers, the world-data door and the quest machine:

| | Class | What it found | Done |
|---|---|---|---|
| 1 | LOCAL SITES - can every questor's quests still start in every town the mods lay? | 574 (town, quest) pairs that start in Daggerfall's layout fail under the mods; 226 more at the Kynareth temples; 1,437 at the manors' new nobles; Pothago's region without a weaponsmith | NEAR-SITE, NEAR-REGION |
| 2 | MARKERS BY QUEST LAW - can the mods' buildings give what the scripts ask of their markers? | nothing breaks; one DFU-legal fallback grows | recorded |
| 3 | PEOPLE - are the questors, the services and the named characters where quests look for them? | no main-quest blocker; Beautiful Villages' temples have no Daedra summoner (1,855 temples) | TEMPLE-SUMMONER |
| 4 | STATE ACROSS LAYOUTS - does a quest made in one layout of a town work in another? | four defects of the port's own re-seat, each reproduced | HOUSE-HALL, PIN-SLEEP, SHARED-SEAT, SITE-LINKS |

The owner chose the course for the data findings: the towns keep the mods' look and the quests are made to work
("Rework so quests can work"), and the temples stand their summoners ("Restore the summoner").

**The data.** Bethesda's freeware release (`DFInstall.zip`, the CD image) fetched into the session's scratchpad, never
the repository. Its `ARENA2` holds MAPS.BSA, BLOCKS.BSA and the rest, but not ARCH3D.BSA: the CD installer unpacks that
from `PACKED.DAT`, a PKWARE Data Compression Library archive (134 chunks of 256 KB after a 36-byte header each, its
directory at the end naming ARCH3D.BSA and DAGGER.SND) - decoded in the scratchpad with a port of Mark Adler's `blast`,
27,143,532 bytes, 10,251 models, and the CRATE-FREE real-data pins pass on it. One file of the packs' 8,547 does not
rebuild on this copy (`location-17-736.json`: the CD's MAPS.BSA names the town "Longtale" where the packs were built over
"Longtale Heights"), so the curated-marker sweep counts 13,083 of its 13,084 buildings; nothing else differs.

## 1. Local sites: NEAR-SITE and NEAR-REGION

**Measured.** Every building of all 15,251 locations in both layouts (9,099 differ under the mods); every quest a
questor of each group offers (the Quests-* lists) joined to the local Places it needs (its `local` Places, the house
fallback, its non-individual Persons' homes); every (changed town, quest) pair where a needed type falls to four
candidates or fewer - 8,734 pairs - asked of the real QuestMachine (parseQuestForLists, the questor clicked in a building
of its group) eight times in each layout; and 1,449 random pairs outside the filter as a control (no regression among
them). 574 pairs in 434 towns failed under the mods that started in Daggerfall's layout, and 345 started better:

- **121 villages keep one tavern** (Beautiful Villages lays TVRNAS06 and TVRNAS00 as houses): A0C00Y12 and A0C01Y13
  (commoners) need two taverns and always failed there.
- **117 Kynareth temples** (TEMPASH3/4, six houses to three) **and 101 manors** (MANRAS02, seven to four): A0C00Y16 needs
  five local houses and always failed; C0B00Y01 failed at the temples 5.5% of its draws (0% in Daggerfall's).
- **Beautiful Cities' shops**: N0C00Y10 (a local weaponsmith) always failed in 17 cities, N0B00Y16 (a pawnshop) about
  45% in 71, A0C0XY04 (a second apothecary) always in 13.
- **Glaghton Court** (Santaki): its B-style manor's tavern carries no quest marker and its houses fall from six to two.
- **Pothago's region has no weaponsmith left**: L0B60Y10 (`remote weaponstore`) failed at all four of its Dark
  Brotherhood halls.
- **The mods' new questors**: the 1,193 manors that hold a palace now seat nobles, and R0C11Y28 (`local temple`) failed
  in 949 of them, R0C11Y26 and R0C11Y28 on houses in the 244 MANRAS02 manors - about 4.3% of noble asks there. (AUDIT
  QA2: the temple is DFU's own law again - no layout of a manor ever held one; the houses the mods took stay fixed.)

Each was the port's Place.cs law meeting the pack data; DFU with the mods behaves the same.

**The fix** (`systems/quest/place.js`). Where the mods TOOK a kind away from a town - its layout holds fewer buildings
a local site of that kind could take than Daggerfall's own layout of it held (`_modsTookKind`: the stamp says a layout
mod changes the town, layoutPins.js `layoutStampOfMapId`, and the town's MAPS.BSA record over BLOCKS.BSA's blocks offers
more such sites than the town as it stands - the search's own law and quest markers, a house kind counted as any house,
its fallback) - a local site that finds no free building of its kind is taken in the NEAREST town that has one, in any
region, by the travel reckoning's distance (questReach.js `mapPixelDistance`), the same search there and its house
fallback, the MAPS directory pre-check for a named kind as DFU's remote search reads it (`_nearTownSites`). The re-seat
of a moved local site takes the same fallback under the same gate before it unseats; a remote one unseats. A remote town
site whose region the mods took the kind from (`_modsTookKindFromRegion`: fewer of its towns give one than in
Daggerfall's records, a town giving one where a dart would - the pre-check, then the walk) is taken in the region's own
towns nearest first, then in the nearest town of another region (`_nearRegionTownSite`). A person's home keeps
Person.cs's chain: its group's building in the town, else a house of the town, only then the nearest town's house.
Everywhere else - Daggerfall's own towns, and a town or region the mods took nothing from - DFU's law: the questor
answers TEXT.RSC 600. A quest's words that name its site's town (`___x_`) name the town it stands in; a word naming the
building alone names no town (the journal's quest lens shows it), and a travel-armed clock measures the trip where a
fixed one does not. A departure (Port-Ledger A, NEAR-SITE and NEAR-REGION).

**Verified** over the player's data with the audit's own harness, after AUDIT QA2: the 574 regressed pairs all start in
every draw (0 failures in 4,592 asks); the Kynareth temples' 2,580 pairs (sixteen draws) are no worse than Daggerfall's layout in any pair, where 226 failed - the 129 that fail every draw are C0B00Y02's `local tavern` at temples whose own layout holds none either, failing as DFU fails them (4,128 of 4,128 in Daggerfall's layout); the manors' 2,386
noble and commoner pairs start wherever the mods took a house - every failure left is R0C11Y28's `local temple` at the 1,193 manors that seat nobles, which no layout of a manor holds (DFU's law); Pothago's four halls give L0B60Y10 (0 failures in 32); and no control pair of the 1,419 is worse than Daggerfall's layout (67 start where it fails - the mods' own buildings).
`test/qa2_nearsite.test.js` (8); `tools/mutants/qa2_nearsite.json` (10) and `tools/mutants/qa2_audit.json`, all dead.

## 2. Markers by quest law: recorded

Two sweeps through the port's own site collection and marker enumeration (curated spots included): 174,181 candidate
buildings in Daggerfall's layout, 275,047 under the mods; every subrecord interior of both (9,005 and 7,150); every one
of the 265 quest scripts parsed for its Places and its `marker N`, `questmarker N`, `anymarker`, `create npc at` and
`transfer pc inside`.

- **The one shift for the worse, DFU-legal**: 1,832 village General Stores hold a quest spawn marker and no item marker
  (Beautiful Villages lays Daggerfall's own `GENRAS00` #12 design in more towns), so K0C00Y00's and O0B2XY09's item stands
  at the spawn marker - Place.cs's own fallback. Everything else improves: the first person at a House2 lands on an item
  marker 2.8% of the time under the mods against 67.7% in Daggerfall's layout.
- **Clean**: the 17 explicit indices (10 quests) all target permanent dungeons and castles, every one in range; all 34
  permanent places resolve alike; the 708 pack interiors that share a Daggerfall design carry its markers exactly; no
  marker stands outside its interior's models beyond Daggerfall's own spread; no two markers share a spot.
- **DFU's own law, not the mods'**: the 54 Places that hold several resources stack the unindexed ones on one marker.

## 3. People: TEMPLE-SUMMONER

**Measured.** Every building of every location in both layouts with its people, their factions read from ARENA2's own
FACTION.TXT, their services from `guildServices.js` NPC_SERVICE.

- **No main-quest blocker.** The 29 named characters the main quest finds at home stand in nine castles' dungeons; the
  packs carry no RDB block, and the castles keep their cells. Every guild hall, temple, knightly order, Thieves Guild
  house and Dark Brotherhood house keeps its questor with the right faction, every bank its banker, every palace its
  court (322 palaces to 1,515).
- **Beautiful Villages' temples have no Daedra summoner.** All 24 designs (TEMPAS*, TEMPBS*) keep every temple service
  but the deity's summoner (DaedraSummoning) - 1,855 temples, some 60% of the world's, against every one of Daggerfall's.
- **Recorded, DFU-identical**: four House2 (GENRBM00 #8) carry faction 1000 (the Archaeologists Guild, a mod this game
  does not carry) and stay locked but as a quest's site; 25 taverns carry a faction that does not exist (57842) and
  416 manors' palaces faction 84 (a temple order) - both without effect; Shadow Spies in plain houses fall from 2,891 to
  121; 21 more alchemists have a child's sprite and stay out of the work pool.

**The fix** (`world/curatedPeople.js`, `tools/templeSummoners.mjs`). The mods' temples are new buildings (Kynareth's 277
models over two storeys against Daggerfall's 9), so Daggerfall's spot means nothing in them. Each design stands
Daggerfall's own summoner of its deity (Akatosh: the mod's faction 26 for Daggerfall's 92; read from TEMPAAA0-TEMPAAH0,
the eight temples Daggerfall lays) at a floor spot measured over the player's geometry - the interior laid out over
ARCH3D, walked from its entrance, the walk's nearest floor to the temple's priest on the priest's own floor, with half a
metre of the same floor round it, on a sound floor, 1.5 m off every person, quest marker and entrance of the room, and
taking NO CLICK MEANT FOR ANOTHER: from every floor cell the walk reaches, the eye at the player's, aimed at each person
of the room in reach and in sight, the summoner's pick box is never the first the ray meets (AUDIT QA2) - with
Daggerfall's record position (which seeds the person's name), the next free one where a person of the room holds it. It
is put in where the block becomes the port's (`formats/worldDataReplacement.js` getDFBlockReplacementData, both its
paths), keyed by the name the town lays the block under (AUDIT QA2: TEMPASA2's JSON names itself TEMPAS2.RMB), so the
room, the guild's services and the questor walk all read it. A temple that stands a summoner of its own keeps it. A
curation of the mod's data (Port-Ledger A, TEMPLE-SUMMONER). THE FOUR HOSTS: `scenes/world.js`, `scenes/worldModes.js`,
`scenes/dungeonContext.js` and `scenes/exterior.js` all read blocks through `BlocksFile.getBlock` and the door, none
with a seam of its own. `test/qa2_summoners.test.js` (6, the measurement and the door over the vendored pack gated on
ARENA2 with ARCH3D); `tools/mutants/qa2_summoners.json` (8) and `tools/mutants/qa2_audit.json`, all dead.

## 4. State across layouts: HOUSE-HALL, PIN-SLEEP, SHARED-SEAT, SITE-LINKS

Code read and every defect reproduced on the real modules before it was fixed (`test/qa2_layouts.test.js` (12);
`tools/mutants/qa2_layouts.json` (13) and `tools/mutants/qa2_audit.json`, all dead). THE FOUR HOSTS: the re-seat runs in
`scenes/world.js`'s applyLayoutPins - on its own load, and on `scenes/dungeonContext.js`'s same-dungeon load
(`opts.layoutPinsLoaded`, handed down by `scenes/worldModes.js`) - and as a shared quest arrives (the machine);
`scenes/exterior.js` configures no pins of its own:

- **HOUSE-HALL** (`systems/quest/person.js`, `place.js`) - the impact of QUESTOR-MOVED's recorded gap. Every Thieves
  Guild and Dark Brotherhood hall is a House2 (674 and 663 halls in Daggerfall's layout, 683 and 670 under the mods), and
  the questor's re-seat asked named buildings alone; under the mods 4,961 of 6,400 of the halls' people (Thieves Guild)
  and 5,775 of 7,293 (Dark Brotherhood) no longer stand with the same identity. Where such a town stands in another
  layout (online, a classic home's town released; the window before the homes' layouts are heard), the contract could
  never be handed in, and the hall was left on its old key - a stranger's house, `pc at` firing there, the quest's end
  taking it off the map. A guild's questor (a guild-service faction: 804, 807, and every temple's and order's) is now
  seated by that service in any building of the quest's own guild (AUDIT QA2: the hall's faction the quest's, or its
  FACTION.TXT parent or child - a temple's quest-giver stands in every god's temple), its look first; a hall whose
  questor stands nowhere is unseated, its record kept; a hall seated anew drops the old record. AUDIT QA2: and FIRST, a
  questor whose own person stands on their own key (IsNPCDataEqual's four fields) is seated there, the record and the
  hall restamped - a building the mods kept as Daggerfall laid it.
- **PIN-SLEEP** (`systems/layoutPins.js` `recordHeldBack`, `scenes/world.js`, `place.js`, `person.js`). A session whose
  pin a pack could not honour (offline, Replace Game Artwork off or a pack missing; a fetch that failed) re-seated the
  quest's sites and stamped them with that session's layout: the town was pinned to it for good, against the quest's
  other records - a guild contract met in the mod's hall could never be handed in again. The records now sleep as a deed
  does: unseated, their stamps kept, seated back the session their layout stands again. AUDIT QA2: a record whose own
  stamp names a pack that did not load this session sleeps in any town (online the room's pins name only its homes'
  towns); a share is mended on arrival only once the pins and their held-back towns stand (`townLayoutsKnown`); the host's
  pin loop is `layoutPins.js` `admitPinnedPacks`, run in a test.
- **SHARED-SEAT** (`machine.js` updateSharedQuest, `place.js` `keepOwnSite`). Two members whose towns stood apart (a
  client whose pack would not load) handed each other a site that named no building in the other's town, and each chose
  again by its own roll: the site and the gem in it moved to another tavern at every resync. A copy keeps its own
  building where the partner's names none in its town, the partner's assignments carried onto it (AUDIT QA2: onto one of
  its building's own markers where it had selected none - DFU's "none" has no spot); a copy kept in step that must choose
  again draws one die per share and Place (AUDIT QA2: a copy no longer in a party draws its own), so the same envelope
  over the same candidates lands in the same building everywhere.
- **SITE-LINKS** (`machine.js`). Every resync added another site link per Place (21 after twenty each way); each resync
  makes them again now. AUDIT QA2: a link's site is derived once (`linkSiteOf`), for the link made and the link a re-seat
  moves - its town with it.

**Clean**: every permanent place is a town or dungeon site, never re-seated; a town's dungeon carries no key; the world
host's load runs the pins before the re-seat and the marker mend. **Suspected, not reproduced**: the dungeon host calls
`layoutPinsLoaded` without awaiting it, so a quest tick could read the previous pins while a pack fetches.

## Recorded, not changed

- TEMPLE-HOME's 34 Arkay temples (`Field-Bugs-2026-10-04d.md`) stand Daggerfall's own layout with Beautiful Villages
  alone, and Beautiful Cities' own TEMPAAA0 with both packs on (18 House2 against Daggerfall's 5 - more houses, so the
  gate stays shut there). Under NEAR-SITE their quests would start under Beautiful Villages' temple too (the moved
  TEMPLE-HOME pin); the curation is kept until it is asked about.
- The General Stores' spawn-only design, the uncarried and empty factions, and the minor people shifts above.
- A summoner's price is reckoned against its temple's faction: 26 at the mods' Akatosh temples where Daggerfall's carry
  92 - the mod's data (Beautiful Cities' temples do the same), as DFU with the mod.
- A site in another region is named by its town alone, and the travel map's Find searches the selected region.
- A copy's candidates are its own machine's: two members whose other quests hold different buildings can land one shared
  envelope in different buildings (the die is one, the lists are not).
- With Replace Game Artwork kept off offline, every record stamped by the mods sleeps (`ensureWorldDataPack` behind a
  closed door) - PIN-SLEEP's design, said to the player (`PINS_DROPPED_LINE`).
- A build from before this one reading a save from it never seats back a hall it unseated (Scopes.None returned early
  there); this build seats it back at its next load.
- The dungeon host still calls `layoutPinsLoaded` without awaiting it (suspected above): the re-seat runs inside
  applyLayoutPins only once the pins are set, and nothing a dungeon mounts reads a town's layout meanwhile.
- A quest whose FIXED clock assumed its site in town keeps that clock where NEAR-SITE takes the site elsewhere (a
  travel-armed clock measures the trip). Measured after AUDIT QA2 over N0B00Y16 (its merchant's pawnshop, two days):
  178 of 2,848 asks take the shop in another town (1,737 under the first gate), 8 pixels the median and 30 the most; the
  round trip outruns the clock at a gallop in 3 of them and on foot, cautious, in 42 (42 and 666 before). R0C11Y28 takes
  none elsewhere - its temple is DFU's law again. A0C00Y10's duel starts at 1 of the 3,059 tavern-less towns the mods
  lay (all 3,059 under the first gate): Glaghton Court, whose own layout held a tavern (the mods' carries no quest
  marker); its inn is Moriribia's, an hour's gallop, inside both its clocks - and its journal still says "at _inn_ in
  ___giver_", the questor's town.

## AUDIT QA2 (2026-10-06, the owner: "Audit this")

Five adversarial passes read the pull request at once - the nearest-town search, the summoners, the four re-seat
holes, the tests and the record, and the seams between them - each finding reproduced on the real modules, most over
the player's data, before anything changed. Each was reproduced again here and fixed at its cause; every fix has a pin
that fails on the code before it, `tools/mutants/qa2_audit.json` (47, all dead).

| | Found | Cause | Now |
|---|---|---|---|
| B1 | Beautiful Villages' TEMPASA2 never stood its summoner (12 towns lay it, up to 46 under a pin) | its JSON names itself `TEMPAS2.RMB`, and the curation looked rows up by that name | the door hands each block the name it served it under (`servedName`); both of the port's curations - the summoners and the quest markers (nine pack files misname themselves) - key on it |
| B2 | A NEAR-SITE re-seat moved a site to another town and left its link in the old one: the quest's person or thing stood in a stranger's building of the same key there, never in the site's, and Repair, finding a link, left it | the re-seat's `follow` copied the building key alone | a link's site fields derived once (machine.js `linkSiteOf`), for the link made and the link moved |
| B3 | A member who kept their own building took the partner's later placement on DFU's "none selected", which has no spot: the interior mount threw | keepOwnSite kept its own selected marker whole | keepOwnSite carries through `_carryAssignments`: its own selected marker only where it stands at a spot, else one of its building's markers |
| S1 | NEAR-SITE answered every town a layout mod lays, NEAR-REGION every region holding one: 3,058 of the 3,059 tavern-less towns the mods lay had no tavern in Daggerfall's layout either, and their commoners offered A0C00Y10's duel "at _inn_ in ___giver_" with the inn elsewhere and its 6- and 12-hour clocks; the main quest's courier left Isle of Balfiera | the gate asked whether a mod lays the town, not whether the mods took the kind | the supply gates above, a region's counted as a dart admits a town (Beautiful Cities' Pothago and Menakat still LIST the weaponsmiths they do not lay) |
| S2 | A person's home went to another town's library or palace before Person.cs's own fallback, a house of the town | the fallbacks answered the home's first ask | the first ask takes no other town; the re-seat of a home takes the house of its town first |
| S3 | NEAR-REGION left a region that still held the kind wherever the darts missed it | the gate asked the region, not where the kind still stood | the region's own towns nearest first |
| S4 | NEAR-SITE's region-first order sent an apothecary 126 pixels off past one 6 pixels over the border | the home region searched whole before any other | the nearest town in any region |
| S5 | The summoner took 5-24% of the clicks aimed at the priest, the temple's questor (the healer's too) | the spot rule stood it at the 1.5 m bound beside the priest | the tool's rule takes no click meant for another (the port's pick box over every floor view); the 24 rows measured again: 1.95-10.45 m moved, 2.18-9.56 m from the priest, 0 of the priests' views taken, as in Daggerfall's own temples |
| S6 | The questor re-seat moved a questor who still stood where they were met: a residence's commoner lost its hall (624 of 807 sampled), a contact in a town of two halls of its guild went to the other, rung 2 took 181 of 807 into a named building | no rung asked whether the record's own person still stands | rung 0 |
| S7 | An Akatosh priest was seated in another god's temple | the guild rung asked the quest-giver's faction (240, every temple's), never the hall's | the hall of the quest's own guild (FACTION.TXT parent or child: 92 under 26) |
| S8 | Online, a client whose pack failed re-seated every other town's quest sites in Daggerfall's layout; a share landing while the pins loaded was chosen again unpinned | the held-back towns were the pins' alone; the arrival gate opened on the service's word | a stamp naming a missing pack holds its record back; the gate opens once the pins stand |
| S9 | Two ARENA2-gated pins contradicted NEAR-SITE (CI skips them): RESEAT-GAPS' unseated cities, TEMPLE-HOME's failing temples | the law moved, the pins did not | PIN MOVED: 18 of 265 cities take the nearest town's weaponsmith and none unseats; the temples' home and quests take the nearest town's houses and always start |
| S10 | 17 of the docs pass's 19 mutants survived; SHARED-SEAT's own test passed on the code before it; the pin loop lived in a closure no test runs | thin pins | each now pinned (a second quest's links, a held-back record that stands, numbered markers, the house pre-check, the guild rung's order, the die per Place...); the loop lifted to `admitPinnedPacks` |
| S11 | `SUMMONER_FACTIONS` was a second literal of NPC_SERVICE's | ONE DFU MEMBER ONE EXPORT | NPC_SERVICE is a leaf (`systems/guildNpcServices.js`) and the factions are read from it |

Notes taken too: the tool read TEMPAA00 (laid by no town) for Stendarr's name seed - TEMPAAA0-TEMPAAH0 now; a test title
promised what its body did not check; a share's die drawn for good once a quest was shared - only a copy kept in step
now; a received copy was a shared copy only after its arrival's re-seat; two members seated in one house named it each by their own DFRandom - a shared re-seat draws a residence's name from the share and the building now, DFRandom put back; a `remote shop`, which no dart ever admits, walked every town of its region - the region gate admits a town as a dart does; and the record's own claims -
TEMPLE-HOME "classic" with Beautiful Cities on, "the words name the town", "its clocks measure the trip", the four hosts
named nowhere - corrected above. The text pins on lines this audit moved re-aimed, PIN MOVED: `wd3_layoutPins` and
`qa2_layouts` (the host's pin loop, now `admitPinnedPacks`), `fb1003b_questor` (`townLayoutsKnown`), `auditrr2` (the
door's `blockFromJson` call, the served name with it). With the player's ARENA2 four gated pins fail here and on
origin/main alike - this CD copy's data (FACTION.TXT's ruler 12, the Longtale location, two patch rebuilds' sha256).

## What could not be measured

Nothing was seen in a browser. Parity with Daggerfall Unity rests on the port mirroring Place.cs and Person.cs over the
same data. Rank, reputation, sex and age eligibility were not applied (every quest of a group was asked), so the
per-click rates assume a uniform draw; with eight draws per pair, failures rarer than about one in eight can be missed
outside the sixteen-draw temple run. Witch covens and vampire questors were not measured.
