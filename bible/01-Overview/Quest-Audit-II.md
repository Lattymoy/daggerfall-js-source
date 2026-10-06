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
  in 949 of them, R0C11Y26 and R0C11Y28 on houses in the 244 MANRAS02 manors - about 4.3% of noble asks there.

Each was the port's Place.cs law meeting the pack data; DFU with the mods behaves the same.

**The fix** (`systems/quest/place.js`). In a town a layout mod CHANGES (its stamp, layoutPins.js `layoutStampOfMapId`),
a local site that finds no free building of its kind is taken in the NEAREST town of the region that has one - the
travel reckoning's distance (questReach.js `mapPixelDistance`), the same search there and its house fallback, the MAPS
directory pre-check for a named kind as DFU's remote search reads it - and where the region has none, in the nearest
town of another region (`_nearTownSites`). The re-seat of a moved local site takes the same fallback before it unseats.
A remote town site a region the mods lay cannot give is taken in the nearest town of another region
(`_nearRegionTownSite`). The quest's words name the town its site stands in, and its clocks measure the trip there.
Daggerfall's own towns keep DFU's law exactly. A departure (Port-Ledger A, NEAR-SITE and NEAR-REGION).

**Verified** over the player's data with the audit's own harness: the 574 regressed pairs all start in every draw; the
Kynareth temples' 2,580 pairs (sixteen draws) fail 0 times where 226 failed; the manors' 2,386 noble and commoner pairs
fail 0 times where 1,437 failed; Pothago's four halls give L0B60Y10; and no control pair is worse than Daggerfall's
layout. `test/qa2_nearsite.test.js` (4); `tools/mutants/qa2_nearsite.json` (10, all dead).

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
Daggerfall's own summoner of its deity (Akatosh: the mod's faction 26 for Daggerfall's 92) at a floor spot measured over
the player's geometry - the interior laid out over ARCH3D, walked from its entrance, the walk's nearest floor to the
temple's priest with half a metre of the same floor round it, on a sound floor, 1.5 m off every person, quest marker and
entrance of the room - with Daggerfall's record position (which seeds the person's name). It is put in where the block
becomes the port's (`formats/worldDataReplacement.js` getDFBlockReplacementData), so the room, the guild's services and
the questor walk all read it. A temple that stands a summoner of its own keeps it. A curation of the mod's data
(Port-Ledger A, TEMPLE-SUMMONER). `test/qa2_summoners.test.js` (4, the measurement gated on ARENA2 with ARCH3D);
`tools/mutants/qa2_summoners.json` (8, all dead).

## 4. State across layouts: HOUSE-HALL, PIN-SLEEP, SHARED-SEAT, SITE-LINKS

Code read and every defect reproduced on the real modules before it was fixed (`test/qa2_layouts.test.js` (6);
`tools/mutants/qa2_layouts.json` (13, all dead)):

- **HOUSE-HALL** (`systems/quest/person.js`, `place.js`) - the impact of QUESTOR-MOVED's recorded gap. Every Thieves
  Guild and Dark Brotherhood hall is a House2 (674 and 663 halls in Daggerfall's layout, 683 and 670 under the mods), and
  the questor's re-seat asked named buildings alone; under the mods 4,961 of 6,400 of the halls' people (Thieves Guild)
  and 5,775 of 7,293 (Dark Brotherhood) no longer stand with the same identity. Where such a town stands in another
  layout (online, a classic home's town released; the window before the homes' layouts are heard), the contract could
  never be handed in, and the hall was left on its old key - a stranger's house, `pc at` firing there, the quest's end
  taking it off the map. A guild's questor (a guild-service faction: 804, 807, and every temple's and order's) is now
  seated by that service in any building, its look first; a hall whose questor stands nowhere is unseated, its record
  kept; a hall seated anew drops the old record.
- **PIN-SLEEP** (`systems/layoutPins.js` `recordHeldBack`, `scenes/world.js`, `place.js`, `person.js`). A session whose
  pin a pack could not honour (offline, Replace Game Artwork off or a pack missing; a fetch that failed) re-seated the
  quest's sites and stamped them with that session's layout: the town was pinned to it for good, against the quest's
  other records - a guild contract met in the mod's hall could never be handed in again. The records now sleep as a deed
  does: unseated, their stamps kept, seated back the session their layout stands again.
- **SHARED-SEAT** (`machine.js` updateSharedQuest, `place.js` `keepOwnSite`). Two members whose towns stood apart (a
  client whose pack would not load) handed each other a site that named no building in the other's town, and each chose
  again by its own roll: the site and the gem in it moved to another tavern at every resync. A copy keeps its own
  building where the partner's names none in its town, the partner's assignments carried onto it; a shared copy that
  must choose again draws one die per share and Place, so the same envelope lands in the same building everywhere.
- **SITE-LINKS** (`machine.js`). Every resync added another site link per Place (21 after twenty each way); each resync
  makes them again now.

**Clean**: every permanent place is a town or dungeon site, never re-seated; a town's dungeon carries no key; the world
host's load runs the pins before the re-seat and the marker mend. **Suspected, not reproduced**: the dungeon host calls
`layoutPinsLoaded` without awaiting it, so a quest tick could read the previous pins while a pack fetches.

## Recorded, not changed

- TEMPLE-HOME's 34 Arkay temples (`Field-Bugs-2026-10-04d.md`) still stand Daggerfall's own layout. Under NEAR-SITE their
  quests would start under the mod too; the curation is kept until it is asked about.
- The General Stores' spawn-only design, the uncarried and empty factions, and the minor people shifts above.

## What could not be measured

Nothing was seen in a browser. Parity with Daggerfall Unity rests on the port mirroring Place.cs and Person.cs over the
same data. Rank, reputation, sex and age eligibility were not applied (every quest of a group was asked), so the
per-click rates assume a uniform draw; with eight draws per pair, failures rarer than about one in eight can be missed
outside the sixteen-draw temple run. Witch covens and vampire questors were not measured.
