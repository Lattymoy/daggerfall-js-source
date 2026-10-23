# FIELD BUGS 2026-10-22b - The Courier's recipient, nowhere to be asked about or found

One thread from the Discord's #bug-reports, handed over as a screenshot with no word beside it: "Delivery/Courier Quest
Cannot Be Completed" - Baffle (2026-10-19): "At this town, cannot ask about the recipient of the delivery, checked every
home, palace, and the inn for him with no luck", with the town's map at night and a crop of the journal; InZaNeXe
(2026-10-21): "Same issue here". Read on main's `66335daa8`, with the freeware's data (`tools/fetch-data.sh`) wherever
the map, the blocks or the running game decide. The quest is Daggerfall's own script, run as DFU runs it; the one change
here is to the port's own repair (Ledger A, QREPAIR), and the record says plainly what was and was not found.
Named 22b: main's `Field-Bugs-2026-10-22.md` (DAY-TURN, the sign-in at midnight UTC) took 22 first. The pins are
`fb1022b_*`, the mutants `tools/mutants/fb1022b_courier.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "cannot ask about the recipient of the delivery, checked every home, palace, and the inn" | Not reproduced. The Courier was driven end to end on the real producers and in the running game - a fresh quest, a load in session, a boot on the save, at night, and in the reported town itself - and the talk named the recipient in his town every time, and his house stood him wherever the probe went in. One thing a player could do about it could not help: the Settings' repair put back what a `place npc` placed, never what a `create npc` placed - and the courier's recipient is placed by `create npc` | CREATE-HOME; asked of the players |

## The quest, the town

THE QUEST. The journal's crop is A0C00Y15's log entry 1010 line for line ("... has charged / me with the task of
delivering / a package to _pickupregion_ / of ___pickupregion_. / I have to have it there within / =traveltime_ days"):
The Courier, a townsfolk quest (`QuestList-Classic.txt`, Commoners). Its recipient is `Person _pickupregion_ face 232
group Local_3.0 remote` - the region's Merchants (Local_3.0's p3 is 0: GetCareerFactionID's 510) homed in a random house
of another town of the questor's region (Person.cs AssignHomeTown: Local_3.0's p2 is -3, so `Place _pickupregion_home_
remote house`) - and the start-up task's `create npc _pickupregion_` puts him there (CreateNpc.cs -> Person.PlaceAtHome:
the home's site link, a marker, and his assigned Place). The Delivery Boy (A0C00Y14) is the same with `local`.

THE TOWN. The map's label is "Moorhart Hall". Two locations carry the name, both HomeWealthy manors: Tulune's (#35) and
Ilessan Hills' (#106). With the town packs on (the default) Tulune's is Beautiful Villages' 3x2 estate - MANRAS01 among
farms: twelve House2, a House1, the tavern (The Flying Dragon) and a Palace; Ilessan Hills' is MANRAS00 among farms:
seven House2, a House1, a tavern and a Palace. The fields in the screenshot and "every home, palace, and the inn" fit
either. A remote house is drawn in the questor's own region, and each region holds one Moorhart Hall.

## What was traced, and what it showed

THE MACHINE, OVER THE PLAYER'S MAP. `tools/createNpcSweep.mjs` (committed with this record) starts a quest through the
real parser and machine from questor towns of every region, the player's MAPS.BSA and BLOCKS.BSA with both town packs on
the door as the game loads them, ticks it once, and checks every person a `create npc` of it has placed: assigned his
home; the site names a building of the town as it is laid out now; a marker of the home holds him; the quest holds its own
site link to the house; the town is its region's first of its name (what the travel map's find and the name lookups
answer); the home is in the questor's region. The Courier and The Delivery Boy, six questor towns a region and three
starts each: 756 of 756 whole, each. All 38 corpus quests that `create npc` a person, three questor towns a region and
one start each - 4,902 starts: 4,863 made, and every one of the 4,339 people a start-up's `create npc` placed in them
whole on every check. The 39 not made are starts a region cannot hold (no library on the Isle of Balfiera for
A0C01Y03's school; DFU's QuestListsManager offers another quest there), said by the tool and not failed. (The faction
table is the player's FACTION.TXT: a stand-in table read Sanguine as no Daedra and made none of his quest.)

THE RUNNING GAME (the streaming host, offline, driven by a session-local Playwright probe over SwiftShader through a debug
hook that was never committed - the figures stand in this record, and the chain they walk is pinned below):

- A fresh quest taken in Oxwych (Tulune) homed Elyn Hawksley in The Gaerston Residence, Masterwing Manor (Beautiful
  Villages' FARMAA06, record 0, a House2), the site stamped in the packs' layout. Arrived there: Where is -> People named
  him, the town's building directory held his house's key, and entering the house stood him on its marker.
- A quicksave and a quickload inside that house: still standing, still named.
- A boot on the save (`?load`) of a quest taken in Oxwych (Moorsly Hall, The Woodsly Residence): his assignment, his
  home's site link and the talk's topics for him came back whole.
- At night (22:00; the screenshot's hour): his town The Feather and Helm Pub - named in Where is, and his house the one
  residence open (`isActiveQuestBuilding`; PlayerActivate.cs's quest rung), every other house shut for the night.
- Moorhart Hall (Tulune) itself: all fifteen of its buildings have a door; The Courier with its recipient homed there
  (`local` for `remote`, the only change) put him in MANRAS01's record 6, The Woodton Residence - named in Where is, his
  house alone open.
- Every residence a quest could pick in every town the packs lay out (239,845 with a quest marker) has a building door
  model; none is a house no one can enter.

RULED OUT on the way: the questlines' action templates (anchored, registered after DFU's - no line of A0C00Y15 is theirs);
the talk tree's restore (the quests are restored first, so nothing is swept as an orphan); a quest UID minted twice (the
allocator steps past every restored one); the layout pins (the stamp at the pick is the stamp at the arrival); the living
world (it keeps clear of a quest person's spot, `livingIndoors.js` questHeld); Ocean Holes' renamed GPS (its own sea
pixel alone); a quest set aside (QUEST-SHELF: the player's own act).

WHAT FITS EVERY WORD OF THE REPORT. The journal and the town's mark read the recipient's HOME Place; the talk's Where is
reads his ASSIGNED Place (TalkManager.AssembleTopicListPerson: in the player's town or not listed); the house's mount
reads his home's marker and the quest's site link to it (GameObjectHelper.AddQuestResourceObjects). A recipient whose
`create npc` placement is gone - no assignment, no marker holding him - and whose home stands is exactly the report:
named in the journal, in the right town, nobody in the town to ask about him, and his house (open to the player as the
quest's, since its site still names it) empty like every other. No path that leaves a recipient so was
found in the running game. The players' own remedy for a missing quest person is the Settings' "Repair active quests" -
and it could not mend this one.

## CREATE-HOME: the repair puts back a person `create npc` placed (1)

`src/systems/quest/questRepair.js` (`PLACEMENTS`, `homeOf`, `placementIntents`, `putBackPlacements`).

FOUND. QREPAIR's first step reads every completed `place npc|item|foe` action for where its resource belongs and assigns
again, where no marker of the quest's Places holds it any more, what a fault took (its own named fault: a party's
shared-quest resync replacing a Place's siteDetails with the partner's copy, after which the complete action never runs
again). `create npc` places its person too - at their generated home - and was not read. Thirty-eight corpus quests
`create npc` 48 people, and 44 of them - the courier's recipient among them - no `place npc` ever places; for any of them the repair said
"Nothing was missing from your active quest" over a person no marker held. A person put back by the repair was also left
with whatever assignment he had: a Place restored without one leaves the talk unable to name him.

FIXED, a widening of the port's own repair (Ledger A, QREPAIR). A completed `create npc` names its person's home as the
Place he belongs at - never a questor's or an individual's, whom Person.PlaceAtHome refuses - and joins the other
placements under their one law (a Person's last-assigned Place settles two; nothing done on purpose is undone; the site
link follows in the pass's second step). A person put back where no Place is assigned him is assigned that Place, as both
actions assign it. The talk names him again and the house stands him again. The pass's line already counts him ("put
back 1 person").

PINS. `test/systems/quest/fb1022b_courier.test.js` (5), over the real parser, machine, Place, talk tree and scene mount in a
region of the port's own blocks (`test/fb1004dTowns.mjs`):
- The Courier end to end, three starts: the recipient homed in the other town, assigned, held on a marker, linked, his
  house the quest's, named in Where is in his town and not in the questor's, and stood by his house's mount (not by the
  same key in another town);
- The Delivery Boy the same in the questor's own town;
- the repair: nothing missing, nothing put back; his marker taken, his house stands nobody - repaired, held, stood again;
- his assignment taken as well, the talk names nobody - repaired, assigned and named again;
- a questor or an individual is never stood at a home by it.

Mutants `tools/mutants/fb1022b_courier.json` (6, all dead): the repair reading the `place` actions alone; a questor homed;
an individual homed; the assignment left empty; `create npc` placing nobody; the talk naming him in any town.
`qrepair.test.js` (6) and `tools/mutants/qrepair.json` (25) unchanged and green.

## Asked of the players

Whether they play online or offline, and in a party (and whether the courier was shared); the questor's town and
region; whether the journal's town is the one they travelled to (the travel map's find searches the region shown); who
they asked (a street walker, or inside the tavern or the palace) and whether Where is -> People listed the recipient at
all or only answered that nobody knew; whether the quest was taken before the 2026-10-19 update; and - once this ships -
what Settings -> "Repair active quests" says with the quest in hand. A save would decide it.

## Found on the way, not fixed here

- SAME-NAMED PLACES IN ONE REGION. 225 locations share their name with an earlier one of their region (199 shrines and
  cults, 25 poor homes, a coven). Region.MapNameLookup keeps the first of a name, as DFU's does, and so do the travel
  map's find (its names deduped the same way) and the port's name lookups of a site's town (`place.js` siteTown, used by
  the re-seats and the marker mend; `questRepair.js` relayDungeonPlaces). A person homed in the second of two same-named
  poor homes is in a town the travel map cannot find by name. DFU behaves the same; not the town in this report.
