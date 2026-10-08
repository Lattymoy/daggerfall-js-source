# AUDIT LW-ROOMS

## AUDIT LW-ROOMS - LW-ROOMS audited, 2026-10-08

Mac: *"Audit this"*, of LW-ROOMS (`06-Systems/Living-World.md`, Mac: "With living world integration, NPCs still group up
in taverns") - the whole room walked, its tables filled apart and in sight, a room holding what its floor does, a place of
one's own, no afternoon sat out in the tavern. Four lenses on the head LW-ROOMS left (`751de3a5`, frozen in a detached
worktree so no fix moved under a verdict - Home.md, 17l): **the room's math** (A: the walk, the sight, the spread, the
hold), **the layer's dynamics and every reader** (B: the doors, the hosts, the talk, who sees what), **the day's plan**
(C: the two `dayPlan.js` edits on the game's own towns) and **the pins' and the record's honesty** (D) - four
independent adversarial reviewers, every one on the freeware ARENA2 in scratch (BLOCKS.BSA's 6,823 interiors laid out by
the port's own `interiorLayout` on its own `Collider`; the game's towns through `lwRealTown.mjs`), never in the
repository - and this session's own (E): each fix measured on the game's interiors before and after, its pin red on the
code as it stood, the lenses' own mutants judged again on the final code.

Every finding was reproduced before it was fixed. Every fix's pin fails on the code as it stood before it - proven by its
mutants (`tools/mutants/auditlwrooms.json`), each the old line put back; a coverage pin - a law that held but that nothing
could fail - is proven the same way. Each change carries an `AUDIT LW-ROOMS` comment. The numbers below are the game's
own rooms and towns unless the synthetic ones are named.

### Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | Major | **The walk stopped at every doorway off its lattice's lines.** LW-ROOMS walked the floor by the lattice's four ways and kept a step only where it reached its own lattice point; a doorway narrower than a step's slide off the line (the game's are 1.2 m, off any lattice) stopped it: 81 of the game's 290 taverns walked to under ten places, fifteen to one; shops 109 of 400 sampled, temples 8 of 17, guild halls 9 of 76, palaces 2 of 13, houses 622 of 1,494. | The eight ways (`ROOM_STEPS`, the four and their diagonals), each step kept wherever the collider slides it, in the cell it slid to - never a second place in a cell walked to already (`soundRoom`). Taverns under ten places 0 (p10 5 -> 47 places, median 51 -> 67), shops 1, temples 0, guild halls 2, palaces 0, houses 204. |
| A1 = B1 | Major | **The room's places hung on which of its doors were open.** An open door has no bucket in the collider (`actionSystem.js`: a door is solid only while shut), and the scene cache restores each door's swing before the layer's first frame (worldModes `restoreInteriorScene`; online, `applyInteriorShared`): a door left open laid the room out anew on the next visit, after a load and for a peer - every door open changed the places of 172 of the 290 taverns (the first cut's fan: 1; 283 of the 285 with doors on E1's walk), its every drinker elsewhere - LW8 and LW-FIX6's "every reader the same room" broken - and walked the common room into the ground-floor bedrooms, the player's rented one too. | The room measured as its build hung it (`deps.doorsShut`): `ActionSystem.withDoorsShut` stands every door shut at its base for the measure and each back as its swing has it; the host hands it the interior's own (`scenes/world.js`). The hall with an action door on the port's own ActionSystem: the same places, tables and people shut or left open. |
| A2 = D2 | Major | **One stirring was drawn back beside strangers, and two tables stood as one crowd.** The own-place tier took its bar from the farthest free place of all, walkable or not; round a corner it left them none of their own to walk to, and the dice picked of any (16% of 15,730 stirs, 2.04 m from the nearest other); and company took a lone drinker's table whatever stood beside it. Twelve inside the game's taverns, astir: the biggest crowd p90 5, max 8, 49 of 290 at five or more (80 on E1's walk); the synthetic hall of 13 by 11 stood ten of ten in one. The record's "a table's own at the most" held at its three hall sizes alone. | The farthest they can walk to sets how far is their own (`stirPlace`: the any tier gone - the clearest walkable is always one's own); company only at a table CROWD_M (2.5 m, the probe's crowd) from every other table's people. Taverns astir: the most median 3, p90 3, max 6, 3 of 290 at five or more; on the way in at most 3. The synthetic hall a table's own at every size from 12 by 10 to 30 by 20, on the way in and astir. |
| D1 | Major | **The tavern-day numbers were quarter-hour samples, not "the most inside at once", and the lunch still waited for noon.** Read every minute the town of sixteen blocks held 9 before noon where the record said 5; six labourers came in from the stint at eleven at 11:40-11:57 and waited in the tavern for the noon lunch (a stint of 25-60 minutes from eleven), the very waiting the record said was gone; test 2's threshold passed on the quarter-hour grid alone. | The probe reads every minute (`tavernDay`), and the lunch is laid from the stint at eleven's own end, its half hour from coming in (`dayPlan.js`). The town of sixteen blocks before noon 23 (the first cut) / 9 (LW-ROOMS) / 9 now, every one now at their lunch; noon 34 / 22 / 19. |
| C1 | Major | **Sending a long gap at one place home emptied the street too.** LW-ROOMS's same-place rule held out of doors as well: one between two stays at one stall, square or social spot walked home and back. On 34 of the game's towns (14 cities, 10 villages, 10 hamlets) those standing out of doors at 17:00 fell 1,075 -> 794 (-26%), at 18:00 1,766 -> 1,370 (-22%), villages' standing at 17:00 by 44%; the street's talk 17-36% fewer circles. It did nothing for the tavern, measured nowhere, and no pin held it (all 252 `lw*`/`watch*` tests passed on the indoor-only variant). | Indoors alone (`dayPlan.js schedule`: `!OUTDOOR.has(it.kind)`): out of doors one stands on between two at one place, as ever. The whole tavern fix kept (the synthetic towns' tavern day as LW-ROOMS's); the street's standing at 17:00 1,079, at 18:00 1,768 (the first cut's 1,075 and 1,766). Pinned: two stays at one stall stood out there between. The trade-off (the long stands at the square sent home too) is Mac's to call - see below. |
| A3 | Minor | **A body stood up on an edge, its place written on the floor beside it.** The walk read only the floor under the body's middle: a step that left the capsule on a bench's or a table's edge, 0.3-0.9 m up, was a place on the floor beside it - the resident stood in the furniture. 1,938 places in 1,235 of the 6,823 interiors (taverns 58 in 50). | A cell whose body's feet stand over INDOOR_LEVEL_M above the floor it is written on is walked through and never stood at (`lifted`) - the walk's reach kept (refusing the step outright lost the floor beyond it: 136 places of 232 behind a 0.5 m lip). On the game's interiors no place's body on an edge; 644 tavern cells walked through. |
| D5 = A6 | Minor | **LW-ROOMS-nostep was recorded equivalent, and was not.** The walk moved as a body that never steps up (`noStep`), its record saying "the same cells"; on the game's rooms the collider's own step ladder - its raised retries - slides a body round a door's jamb where the bare move sticks in it: 17 of 290 taverns and 47 of 76 guild halls differed on LW-ROOMS's walk; on E1's, 110 more of 1,494 houses walked to ten places and more with it. | Each step walked as the room's people walk theirs (LW8c's `walkable`: the collider's own step up). The cost, once a room on its first frame inside: tavern median 135 ms (p90 204, max 273; without the ladder 80, 117, 156), house 71 (max 297), shop 87 (max 355), palace 105 (max 316) - the first cut's fan 96-112 ms at the median, 203-333 at the worst. A ray-gated ladder (none where a ray 0.55 m up meets the step) was measured and not made: it lost every house the ladder gains. |
| B2 | Minor | **One reader's quest, or the hour, laid out every reader's room.** The places were kept clear of the quest's people and of the static people standing at the hour (`active`: the hour, a shop shut, the player's guild); the whole floor walked, a quest person in the hall's far corner (207 places -> 206) stood all twelve elsewhere. | The room measured clear of the building's own people every one, at their post or not, and of every bed's stand (below); the reader's own quest's people kept clear only when one is placed and in no stir's walk (`deps.questFeet`). |
| B1b | Minor | **A drinker stood on a lodger's stand.** Places within 0.7 m of a lodger's stand beside their bed: 40 in the taverns with every door shut (267 open). | Every bed's stand kept INDOOR_CLEAR_M clear of the floor's places, as the building's own people are: none. |
| A4 = B5 | Minor | **One alone faced a wall.** They faced the middle of the room's places - the whole floor walked, a point in another room: the line to it crossed a wall from half the taverns' places (the fan's: 117 of 2,960), a wall within a metre of the face for 807 of 12,389 (1,963 of 21,766 on this audit's walk). | Their table's middle where it has more places than theirs, else the room's most open way there (`faceOf`, OPEN_M 6 m): a wall within a metre of the face for 53 of 21,766 in the taverns, houses 5,505 -> 77 of 48,575, shops 1,538 -> 30 of 18,171. |
| A5 = B8 | Minor | **Past INDOOR_SEEN_M a coming or a going went in plain view.** "Indoors, little is" 14 m off - the fan's 6.6 m reach; the whole floor walked, 2,078 of the taverns' 12,404 places stood past it, 110 in plain view of the way in in 49 taverns. | Past INDOOR_SEEN_M, only while the room hides them from the eye (`inView`: the line to their middle clear of the collider); within it, in front of the player, as before. |
| B3 | Minor | **A word was said through a wall and a floor.** The greeting asked only the flat distance: a drinker 1.15 m off across a partition was greeted unheard (the host dropped the line behind the wall), and the rest kept them quiet when the player came round; places a word reached through a wall 31.0% -> 39.9%; beds upstairs over ground-floor places within reach 156 -> 287 of 428. | A word only to one the room shows the player (`inView`), on the player's floor (within 1.2 m of their height). |
| B4 | Minor | **The talk and steal ray reached a drinker behind a wall.** The building's press offers the room's residents nearer than the ladder's winner, and a bare wall is nothing to press: places the ray reached through a wall 71.6% -> 82.9%. | The room's own wall the nearer (`livingPersonsAct`: the interior collider's ray). |
| E3 | Minor | **A small room held fewer than a household.** One to every INDOOR_FLOOR_M2 of floor: a house of nine places held two of its family of three. | A household, INDOOR_HOLD_MIN (3), at the least. |
| C3 | Nit | Moving the lunch's draw after the stint at eleven re-rolled every labourer's and courier's later stints for nothing (4,646 plans against the draw kept in place). | Drawn where the first cut drew it, after the stint at nine (recorded equivalent: the draw's place, not a law). |
| C7 | Nit | The `schedule` docblock's "between two the resident stays where they were" - never so but out of doors and, before LW-ROOMS, at one place indoors; `lwerrands_town`'s "a homemaker's at eleven runs on" true again with C1. | The docblock says what the schedule does. |

### Pinned

| ID | Sev | Finding | Pin |
|---|---|---|---|
| C4 | Nit | The lunch pin skipped every stay from 13:00: a second lunch (`i >= 2`) passed - 28 labourers' tavern stays begun 13-17h in the town of sixteen blocks against 6. | One daytime tavern stay a labourer's day at the most, its half hour from coming in. |
| D6 | Minor | Laws no pin could fail: the 1.2 m measured from the way in's own height (the ramp's way in stood on the floor; on the game's houses it took ALCHAS03 #5 and #6 from 20 places to 3); the tables spread by their openers (201 of 290 taverns' first twelve places moved); the stir's "else any"; the centimetre widened to 0.1 m; the inner INDOOR_CELLS break; the sight from floor 0. | The ramp's way in at the landing's height; three tables whose openers and middles part; a wall drawing a cell in to 1.22 m; the open floor's cells; two upstairs in sight, none from under the floor. The ray from the way in or half a metre over it, and the sight of a line of no length, recorded equivalent. |
| D7 | Minor | The synthetic hall's "none on a table's top or the stair" did not kill the level: its stair and tables stop a step short before the level is read (on the game's taverns, without it, 85 raised places in 55 rooms). | A dais 0.3 m up: none on it. |
| D11 | Nit | INDOOR_REACH_M and INDOOR_FLOOR_M2 pinned by their literals alone (the reach test read the constant; the small room held three at 6 or 8 m²). | The long hall to twenty metres; nine by eight metres, thirty places, holds seven. |
| A7 | Minor | Every pin and number on the synthetic hall or the mock box, which have no action door, no bench and a 3 m doorway. | The synthetic hall gains an action door on the port's own ActionSystem, a narrow doorway off the lattice, a lip and a dais (`test/lwRoom.mjs`); the game's interiors measured for every number above. |
| - | - | LW-ROOMS's own pins the eight ways moved: the spread and the sight held on one building's deal by chance (its first four tables apart, no table across the wall); LW-ROOMS-farthest only on ties now. | The spread over twelve buildings' deals, the sight over six; two places as far from everyone as the farthest, the dice's. |

### The record

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| D3 = E2 | Minor | "The sounding passed over the tables onto their tops": true of the houses (2,705 places in 1,765 of 5,797) and the shops (50 in 41 of 628), of one tavern of 290 (3 places); the synthetic hall the record measured, 0 of 26. | FIXED (Living-World.md, the code's header, the test's). |
| D4 | Minor | "INDOOR_MAX stood twelve in a closet of a shop's as in a great hall": the first cut stood as many as its fan found places (a 3 by 3 closet none, 6 by 5 ten; the game's shops a median of 8). | FIXED. |
| D8 | Minor | The probe's crowd is of the places stood at (a walker counted where they make for), read every ten seconds; of the bodies drawn, frame by frame, the 12 by 10 hall's most astir was 4. | FIXED (said "places"). |
| D9 | Nit | The re-judge's counts: 299 records matched "the files touched and naming the moved pins" (270 said), 86 the two files (84). | FIXED. This audit's re-judge: 270 records on the files it touched or naming its pins, 266 dead, one equivalent as recorded, three it left unkilled - pinned above, then dead. |
| D10 | Nit | "The great town's stays left are its one tavern's ... the gap waited out": 4 of its 17 are adventurers' own evening of three to five hours, no gap in them. | FIXED. |

### Recorded, not changed

- **B6 - the room's talk.** LW-ROOMS's room talked less: lines said in five minutes on 58 of the game's taverns, 73.6 (the
  first cut) -> 56.6, 7.6 -> 5.7 of the stood in company - its floor's hold and the place of one's own. With this audit's
  walk (more of the floor, so more held) and company kept apart: 79.5, 8.3 in company of 11.7 stood. Measured, nothing
  to change.
- **B7 - one in view holds every arrival.** Since LW8 every one coming in waits on the deal's first free place while it
  is in view, so a player at the way in looking in sees nobody come (B's 29 taverns: none of twelve in fifteen minutes,
  either version). Taking the first free place out of sight breaks LW8b's "the room fills table by table" (a newcomer
  joins the lone drinker's table once it is out of view): kept, recorded.
- **C2 - waiting at the next place.** The schedule's "a short gap going on at once and waiting at the next" still sits a
  traveller in a tavern up to two hours before their stay where home is too far (four real cities, seven days: 12,184
  minutes waited inside taverns, 26,768 before LW-ROOMS; 50 waits of an hour or more, 34 of them sellswords); a smith's or
  a guildsman's noon lunch after a morning ending at eleven waits for it. Its law ("never lingering where the last stay
  ended") is LW1's; Mac's to change.
- **C5 - a smith home in the gap.** A smith who does not lunch out walks home between the morning (7:00-11:00) and the
  afternoon (12:30) where home is within 29 minutes: lunch at home, the same-place rule's own law.
- **C6 - an afternoon's work dropped after a tavern lunch near home.** 210 of 1,158 days of keepers, smiths, clerks,
  scholars, helpers and guild members whose work is not their home keep no work after 13:00, 127 of them after the
  tavern lunch (`fav.tavern` is near home, not work): before LW-ROOMS the afternoon was the tavern's, now home's. LW1's.
- **A9 - the floor past the common room.** `spreadTables` sends the tables into corridors and back rooms where the floor
  goes on (12,822 of the layer's 22,530 first places out of sight of the way in; TVRNAM04 #0: 3 of the first twelve in
  the common room). The doors now shut take the bedrooms out; the rest is the room's floor.
- **A10 - the first door upstairs.** 95 of 6,823 interiors (78 House2) have their first door's landing a storey or more
  over another way in, so the room is laid out upstairs (ORS #0: 20 places from it, 71 from the lower) - LW-FIX6's
  determinism, its law.
- **A8 - a placement's float rounding.** The walk is chaotic below a millimetre: the door's matrix minted ±819.2 m off
  (a door used from across a map pixel's edge) changed 57-70 of 290 taverns' places. Not shown to happen in the game.

### Open, for Mac

- **C1's trade-off.** The same-place rule out of doors sent home those who stood for hours at a stall or the square
  (Issaqumbaa's pedlar at a social spot 05:42-19:44). LW-ROOMS's ask was the tavern's; the street is as it was. Whether
  the long stands at the square should go home too is Mac's.

### The four hosts

`scenes/livingIndoors.js` and `dayPlan.js` the law; `world/actionSystem.js` the doors' measure (`withDoorsShut`, new,
nothing else changed). `scenes/world.js` - WIRED: hands the layer `doorsShut` (the interior's own actions), every one of
the building's people as `staticFeet`, the quest's as `questFeet`, and stops the talk ray at the room's walls. The hook
read `modes.interiorCtx` past a guard above `modes`'s declaration, which AUDIT 24 wave 37's sweep forbids (every reference
there guarded on the object: `audit24_wave37`, red on this audit's head; LW-STIR's run of the whole suite on its merge
caught it) - it reads `modes?.interiorCtx?.actions` once now, the lift and AUDIT-LWR-doors-host re-aimed, dead.
`scenes/worldModes.js` - no change: its scene restore still swings the doors, which the measure no longer reads.
`scenes/exterior.js` - FLAGGED as LW2 has it (stands nobody of the living world in a room). `scenes/dungeonContext.js` -
no town.

### Pins and mutants

`test/auditlwrooms.test.js` (8): the doors (A1/B1), the reader's quest and the beds (B2), the step and the edge (A3/D5),
the stir and company (A2/D2), the face (A4), the far view (A5), the word and the ray (B3/B4), the walk's laws (D6, D7,
D11). `test/lwrooms_tavern.test.js` (9) carries C1, C4, D1's minute and lunch and E1's walk. PIN MOVED: `lw8_indoors`
(the host's lines), `lw8c_astir` (the way in's row; the partition's side by the mock's own law), `lwfix1_review` (a walk
over 4 m to go; the way in's row), `lwfix6_rooms` (the way in's row; the quest kept clear when one is placed),
`lwlodge_tavern` (down to the common room where the player is not looking), `lwrooms_tavern` (the eight ways, the
doorway, the drawn-in place, a closet's hold). `tools/mutants/auditlwrooms.json` (40: 37 dead, 3 equivalent as
recorded); `lwrooms.json` LW-ROOMS-arrive and -nostep retired (the arrive law gone; the step's is AUDIT-LWR-step-up),
-eight, -walked, -hold-min and -hold-min-n added, the rest re-aimed by content, as are `lw8.json`, `lw8b.json`,
`lw8c.json` and `lwfix6.json`'s records on the lines this audit moved.
