# THE LIVING WORLD (LW, opened 2026-10-04)

Mac, 2026-10-04: "The new living world enhancement. NPCs are no longer just random walking entities. They dynamicly
all have tasks, travel between towns, can encounter enemies in the overworld, dyanamivally have a sleep schedule,
perform activities, form caravans, link with the ship AI at ports, have conversations with each other, etc, much like
the crew on board ships. NPCs adventuring beyond towns will dress out in armor/gear before leaving. You can find them
dungeon diving, make friends or enemies, and explore a dynamic world. This is one of the biggest changes our game will
be recieving and I want this to be absolutely perfect. A masterpiece".

The port's own. Daggerfall's townsfolk are DFU's PopulationManager: a pool of identity-less shells around the player,
each re-rolled into a stranger at every spawn, wandering the navgrid by tile weights and gone at dusk
(`systems/townPopulation.js`, verbatim). Nothing in Daggerfall travels, sleeps, works or remembers.

## LW0 - the decisions

Taken at the design, in the request's own order; each is Mac's to overrule.

1. **THE ENHANCED LANE, A FEATURES ROW.** `living-world`, on by default, the player's own online (no wire field reads
   it: a player with it off sees DFU's walkers and shares nothing less with anyone). The classic skin, and the row off,
   keep `townPopulation.js` 1:1.
2. **ONE CLOCK, NOTHING SENT.** The living world runs on the sky (`worldTick.js skyMinutes`): the minute the sun, the
   lamps and the shop hours are read off - offline the one calendar, online the sky's own (TIME1, a day each real
   hour). Every resident, every plan, trip, caravan, camp, encounter and dive is a PURE FUNCTION of the world's own data
   (MAPS, BLOCKS, the roads), a seed and that clock - so every player on a page sees the same baker walk to the same
   oven at the same minute, and not a byte crosses the relay. A rest, a wait, a fast travel or a prison sentence moves
   the clock and the world with it: the people are where their day has taken them.
3. **PEOPLE WALK AT THEIR OWN PACE.** On the street a resident walks DFU's 1.3 m/s (`PERSON_MOVE_SPEED`); the clock's
   rate turns it into the clock's minutes (`CLASSIC_MINUTES_PER_SECOND`, twelve a real minute; the sky's
   `skyMinutesPerMsAt`, twenty-four), so a resident beside the player keeps pace with them and every day is lived at
   walking speed. A journey's time scale speeds the calendar and the people with it.
4. **A RESIDENT IS A DFU TOWNSPERSON WHO KEEPS THEIR IDENTITY FOR LIFE.** The billboard race is the climate's people,
   the outfit one of `PERSON_TEXTURES`' four, the talk portrait `PERSON_FACE_RECORDS`' own law, the name `fullName` on
   the region's bank with DFRandom's state saved and put back (`shipCrew.js handName`'s pattern) - every part DFU's, but
   drawn once from the resident's seed instead of at every spawn.
5. **ARMOUR IS THE CLASS SPRITE.** Daggerfall draws no worn gear on any NPC; the armed look it has is the eighteen
   human classes' sprites (`enemyBasics.js` 128-145, eight archive pairs). A resident who goes beyond the walls to fight
   - an adventurer, a caravan's guard, the watch on the road - walks out in their class's sprite and walks home in it;
   in town, at home, they are a townsperson again.
6. **RELATIONS ARE THE CHARACTER'S.** Who is a friend and who an enemy is per character and per resident, saved with
   the character (`modSaveData` vendor `LivingWorld`); online it rides the character's snapshot as every other modData
   record does. The world is shared; how it feels about you is yours.

## LW0 - the model

- **THE CENSUS** (`systems/livingWorld/census.js`). A town's residents are minted from its own buildings: each house a
  household, each shop its keeper, each tavern its staff, each temple its priests, each guild hall its members, the
  palace its court, and the town's size its watch, its merchants, its adventurers, and at a port its sailors. Slot `i`
  of a town is the same person for every reader: `L<mapId>.<i>`.
- **THE PLACES** (`systems/livingWorld/places.js`). Every building's door as a walkable navgrid cell before it; the
  social spots (before taverns, temples, guild halls and the palace, and the town's square); the market spots (before
  the shops); the exits (the border cells the town's own streets reach - a walled town's gates by construction).
- **THE DAY** (`systems/livingWorld/dayPlan.js`). A resident's day from 04:00 to 04:00, drawn from their seed and the
  day: wake by their temper (a lark, the day's own, a night owl), work at their trade, errands to the shops, a meal, the
  evening's tavern, temple or square, home, sleep; the watch on day or night shift walking its beat. Between two places
  a walk, on the navgrid's own A* (`townPaths.js`), its minutes by the walking pace. Outdoors is what is seen; indoors
  is a door shut behind them.
- **CONVERSATIONS** (`systems/livingWorld/meetups.js`, `lines.js`). The town's meetings for the day - two or three
  residents at a social spot with time free in all their days - and what they say: the crew's two-and-three-line
  scripts' shape (`crewLife.js CREW_TALKS`), their topics the residents' own (the trade, the weather, the temple, the
  roads - and what happened on them, read off the trips of the town's own people).
- **THE ROADS** (LW3). A traveller's trips are drawn per cycle of days from their seed: where (a neighbour town, a
  temple town for a pilgrim, a dungeon for an adventurer, a port across the water), when, how long they stay. The route
  is the Travel Options planner's on Hazelnut's roads (`travelRoute.js planRoute`); they walk it by day and camp by
  night. Merchants hire the town's guards and the week's travellers to the same place go with them - a caravan. An
  adventurer gears up at home before the walk out.
- **TROUBLE** (LW4). Each leg's danger, the region's and the ground's, rolls an encounter at a minute of it and its
  outcome against the party's strength - driven off, won, fled home, slain. A player near at that minute sees it
  fought, and can turn it.
- **THE PORTS** (LW5). A sea leg rides the SEA-LANES packets (`naval/seaLanes.js`): wait on the quay for the next one,
  board her, sail, step off at the far port.
- **THE DEEP** (LW6). A dive: in at the dungeon's door, hours inside room to room, out - or not, and what is left of
  them lies where they fell.
- **FRIENDS AND ENEMIES** (LW7). Words, help in a fight, a blow, a crime seen: each moves a resident's regard; a
  friend greets you by name, an enemy will not talk, and an armed one draws on you beyond the walls.

## The slices

- LW1 - the census, the places, the day, the meetings, the lines, the relations store (pure).
- LW2 - the town: residents walk the streets in the streaming host.
- LW3 - the roads: trips, caravans, camps, the gear; the wilderness and the Overworld.
- LW4 - trouble on the road; LW4b - the fight stood live, the player's to turn.
- LW5 - the ports; LW5b - the passage by sea.
- LW6 - the deep; LW6b - the fallen in the deep; LW6c - carried home; LW6d - the town's word of it.
- LW7 - the deeds; LW7b - friends and enemies beyond the walls; LW7c - the people who know you.
- LW8 - the doors open; LW8b - the room's talk; LW8c - the room astir.

## LW1 - the census, the places, the day, the meetings, the lines, the regards (2026-10-04)

`systems/livingWorld/`, pure. Every roll is the living world's own (`seed.js`: the port's `hash32` under `LW_SALT`,
`wind.js seededRng` over it) - none on Math.random, none on DFRandom's stream (a name draw saves and restores it).

- **`census.js`.** `travellerRoster(town)` off the MAPS row alone: merchants from two blocks (1 + blocks/8, to 5),
  sellswords from nine (blocks/8, to 6), adventurers from four (1 + blocks/10, to 6), sailors at a port (2 +
  blocks/10, to 6), pilgrims from two (two from sixteen), couriers from sixteen (two from thirty-six). `watchRoster`:
  none in a one-block hamlet, one at two blocks, then 1 + blocks/4 between two and twelve. `householdCensus(town,
  buildings)`: each House1-House6 a family of one (a quarter), two (half) or three; each shop its keeper (a smith at
  the Armorer and the WeaponSmith, a clerk at the Bank, a scholar at the Library and the Bookseller) and a hand at one
  of quality twelve or more, half the time; the tavern its innkeeper and one server (two at quality twelve) living
  there; the temple two priests living there; the guild hall two members; the palace two courtiers living there. The
  trades are dealt to the houses' people in a seeded order, a trade left over lives where it works, the people left
  over take the town's common work by its size (labourers, farmers - the villages' own -, a port's fishers, crafters,
  homemakers, a city's beggars); `CENSUS_MAX` 260, the common hands trimmed first. `townCensus` gives the watch the
  palace and every traveller a house (an adventurer the tavern a quarter of the time). Identity is `mintResident`'s:
  the climate's people (`raceOfPeople`), half female, an outfit of `PERSON_TEXTURES`, a face of
  `PERSON_FACE_RECORDS` + 0..23, a name on the region's bank (`residentName`), the watch GUARD_TEXTURE male outfit 0
  (RandomiseNPC's arms, every part); a temper (lark, day, owl) weighted by the job, three leanings (company, piety,
  drink), a class for the armed (an adventurer any of the eighteen, a sellsword the fighting seven, a courier the
  light three) and a level.
- **`places.js`.** The street net is the grid's largest four-neighbour walkable component (`streetNet`). A door's
  cell: out along its normal 0.9-4 m until the net takes a foot, then the other way (a model's normal can face in),
  then the nearest net cell within four. Social spots `SOCIAL_OUT` cells before the tavern, temple, guild hall and
  palace, market spots `MARKET_OUT` before the shops, a dock before a Ship; the square the net cell by the middle with
  the most net in its 7x7, sampled every third cell; an exit per side, the net cell nearest that edge.
- **`townPaths.js`.** A* over the grid's static weights, four neighbours, a step `1 + (15 - weight) / 10` (a road 1,
  grass 1.3, the average 1.8, stone 2.1), ties on opening order, one scratch set per grid; `pathLine` keeps the turns
  and `pointOnLine` walks them (so named at the merge with main: SERPENT1's `serpentSite.js pointAlong` is another
  function - a share of a sea lane - and one name for two pushed audit24's one-home ratchet past 30); `createPathBook`
  keeps 768 walks and spends a frame's search budget - LW-PERF: a frame's CELLS (`cells`), the walks
  asked queued and searched in slices (`townPathSearch`, the same answer whole or sliced).
- **`dayPlan.js`.** The living day 04:00-04:00 (`DAY_START_MIN`), every minute covered once. Wake and bed by temper
  (a lark 05-06 and 20-21, the day 06-07:30 and 21:30-23, an owl 08-10 and 00:30-02); the watch by shift
  (`(slot + day) mod 3`: 06-16, 14-24, a day off). The jobs' days as the code says them, the favourites (`favourites`:
  two social spots, a tavern, a temple, a guild and a market, near home, the seed's alone) set where; a stroll (two
  short stops) for the sociable; a lark's turn about town at first light. `schedule` lays them: each begins when the
  walk allows and not before its hour, nor more than its slack after; a stay ends by its `until`, by the walk home
  before bed, and before an away window's going; a gap longer than the walk home and back by `HOME_GAP` is spent at
  home, a shorter one going on at once and waiting at the next place (nobody lingers where a stay ended - a shop shut
  at six is left at six; the LW1 pins found the helper who stayed on); an away window (trips.js, LW3) is geared for at home `GEAR_MIN` where the traveller goes armed, walked out to
  arrive as it opens and home as it closes, each walk ARMED. A walk's minutes: the cells' Manhattan distance x
  `WALK_DETOUR` + `WALK_EXTRA_M`, over the pace.
- **`meetups.js`.** Rounds of `ROUND_S` (40 real seconds) laid on the clock; whoever stands at a spot for a WHOLE round
  pairs off on an order drawn from the spot, the round and their ids (the odd three together); `TALK_SHARE` of circles
  talk; a line each `CREW_LINE_S` of the clock, the first member first; `circleStands` round the spot on the golden
  angle, `CIRCLE_APART` apart, facing in.
- **`lines.js`.** Original words in the crew's two-and-three-line shape: the town's talk, the trades', the weather's,
  the evening's and the night's; tokens with fallbacks; LIVING_GREETINGS by regard.
- **`relations.js`.** A regard per resident (-100..100), a stranger 0: a word +3 once a day, a polite word +1, a gift
  +8, help +20, a life saved +35, a blow -45, a crime -15, one of theirs slain -60, a blunt word -6; friend at 40, enemy
  at -40, hostile at -70; eased toward zero half a point a day unseen and never across; 600 kept; the save's record
  `{ v: 1, people }`, a bad one nobody known.

## LW2 - the town (2026-10-04)

`systems/livingWorld/livingTown.js` `LivingTown`, in TownPopulation's shape (`pool` rows, `update()` the live seats,
`retire`, `nav`, `maxPopulation`), so every street seam takes a resident as it took a walker: the talk ray, the
pickpocket, the watch's conversion (`_guardPool().disable()`'s inline free reads as the resident TAKEN for the day),
the trample (`retire`), the probes.

- **The census read** four times a second: each resident's entry at the sky's minute; those out of doors within
  `LIVING_RANGE` (DFU's 150) wanted, nearest first, to `maxPopulationFor`. The circles are read over the WHOLE town's
  presence, so every reader's circles agree.
- **Where exactly** (`where`): a walk on its A* line at the day's pace, never slower, to `WALK_FAST` (1.6) times it on
  a long path and late past that (the stay after it waits for the arrival); arrived early, through the door or out of
  the gate, else at the spot. A stay in its circle's place, or its own. A body further than `SNAP_M` (30 m) from its day
  is stood there; nearer it walks there (a circle reshuffled, a stand left for a walk).
- **Coming and going**: ON ARRIVAL - the town's first frame, the clock jumped past `ARRIVAL_JUMP_MIN` (15: a rest, a
  wait, a load) or the player past `ARRIVAL_STEP_M` (40 m in a frame: a Recall, a teleport) - the street is as the day
  has it, everyone out of doors there at once (the searches raised to `ARRIVAL_PATHS_PER_FRAME` till it is stood;
  LW-PERF: for `ARRIVAL_SHOW_S`, on `ARRIVAL_PATH_CELLS` a frame - the street fills over a few frames).
  After it, the street's own churn keeps DFU's hiding - one more stood under the cap comes on beyond
  `POP_VISIBLE_RANGE` or behind the player's half of the view - or out of a door (a walk begun from one within
  `DOOR_POP_MIN`), which needs none; into a door at once; out of range when unseen. `suppressSpawns` (V4's transformed
  lycanthrope) holds new ones in. THE LW2 MUTANTS FOUND THE ARRIVAL: with DFU's rule alone, a street the player
  arrived facing stayed empty but for its doors - DFU's walkers spawn hidden, a resident is where their day is.
- **The politeness gate** stands a body as it stands DFU's walker; the minutes it stood are owed and walked off
  `CATCH_UP` (0.35) faster.
- **Lines**: a talking circle's line at this minute over its speaker; a word to the player passing within
  `GREET_RANGE` (once in `GREET_REST_MIN` of the clock): a friend's by name, an enemy's cold, a known face's plain, a
  stranger's now and then. `refuses(person)` an enemy's `LIVING_REFUSAL`; `talked(person)` notes the word.
- **The body** is `characters/residentWalker.js` `ResidentWalker`: a MobilePerson that wears the walker's billboard on
  a yaw of its own (MoveAnims through `mobileOrientation`, idle 5, the watch's 15, AUDIT 26 F021's reset) and claims no
  tile. `mobilePerson.js` exports its `MOVE_RECORDS` and `MOVE_FLIPS` for it, unchanged.
- **The streaming host** (`scenes/world.js`): the population block stands a LivingTown where `livingWorldOn()`
  (`livingSwitch.js`: the enhanced skin and the row), on the same navgrid, collider, ground (`personGroundY`, JAN1's
  closure now one for both pools), batches and racial override, the town's MAPS row, its buildings' summaries and its
  doors (each door now carries its block's grid cell - `makeBuildingKey(blockX, blockY, recordIndex)` - and is laid
  into the location frame); `livingBaseRate`/`livingRate` the sky's rate online, the calendar's (and a journey's scale)
  offline; the regards one `createRelations` per character, saved as `LivingWorld`; the residents' lines merged into
  the crew's one speech layer (`livingLinePoints`, before `drawCrewLines`; under the name of one the player has met);
  `townTalk`'s new `livingTalk` door asks the body's town for a refusal before the conversation and notes the word
  once it is one.

## LW3 - the roads (2026-10-04)

`systems/livingWorld/trips.js`, pure; `scenes/livingRoads.js` and `world/travellerSprites.js`, the host's.

- **The travellers.** The census's roster off the MAPS row gains the PEDLAR (every town one, one more each six blocks,
  to six): the small places' own traffic. Merchants, adventurers, pilgrims, couriers and pedlars travel; sellswords
  ride with merchants; sailors wait for the ports (LW5).
- **A traveller's cycles** (`cycleOf`): the job's days (`CYCLE_DAYS` - a merchant's 7, an adventurer's 7, a pilgrim's
  20, a courier's 5, a pedlar's 6: the pins found a four-day cycle held no pedlar's walk past the next town) times `paceScale` (the sky walks half as far a clock minute as the calendar: its
  cycles are twice as long, so as many are on the road at once), offset by the traveller's seed. In each the traveller
  goes at `TRIP_CHANCE` (`ownTrip`): to a town in `TRIP_RANGE_PX` - a merchant's the bigger the likelier, a pilgrim's a
  temple's town (a temple location, or a town of nine blocks or more), a courier's anywhere, a pedlar's near - setting
  out between six (an adventurer) or seven and nine of a morning, walking BY DAY (`WALK_FROM_H` 7 to `WALK_TO_H` 19) at
  the job's `TRIP_PACE` of the street's 1.3 m/s, camping where night finds them, staying `STAY_DAYS` (none: a two-hour
  rest if in by noon, else the next morning), home again inside the cycle - else the nearer towns than the pick,
  farthest first, else none. THE LW3 PINS FOUND THE PICK DRAWN PER TOWN: the weighted pick sat inside the search for
  its town, drawing again for each and as often finding none - a third of the trips never made; it is drawn once.
- **The way** is the Travel Options planner's (`travelRoute.js planRoute`) on the roads the world draws (Hazelnut's
  when Basic Roads is on, the port's own generated network when it is off), asked by the living world's own book
  (`systems/livingWorld/ways.js createWayBook`) - not by the host, whose one construction seam is the player's journey
  (TO-ROADS) - on the game's own ground alone (the climate and the heightmap: never a player's attached World of
  Daggerfall massifs, which only that player has). Once a pair in ONE direction - the lower map id first, the other its
  reverse - so every client walks the same way, `WAYS_PER_FRAME` (2) new pairs a frame; a new network clears the book
  and the host's trips with it (`generation`). Two players on different road networks see their travellers on their
  own roads. `wayOf` lays it through its pixels' centres, which is the road itself; each end is trimmed by the town's
  half-width and a block (`townTrim`), so a party walks out of the town's edge.
- **Caravans** (`formCaravans`), each a law of the trips alone: a merchant takes the town's sellswords UNDER CONTRACT
  to them - the town's sellswords dealt to its merchants in slot order, the first to the first, round again - their
  trip's own roll of up to `HIRE_MAX` (3) of them; a merchant's trips never overlap, so neither do their sellswords'.
  A pilgrim, courier or pedlar setting out the day a merchant does, for the same town, joins the first such merchant's
  train (slot order): one party, one pace, one timeline. THE GATES FOUND THE TRAIN READ OFF THE WINDOW: hires were
  dealt among the merchants a minute's window held, so a train read on its way home - its neighbour's trip over and out
  of the window - hired other sellswords than the train that set out, and they changed places mid-road; a train is now
  the same whichever minute of it is read.
- **The towns see the roads.** A home's `awayOf` window for each of a party, armed where they carry a class (LW1's
  away windows: geared at home, out armed to the exit facing the road - `exitToward` of the way's first leg - home
  armed); a town's `visitorsOf` - the parties of towns within `TRIP_REACH_PX` (18) staying in it, in by the exit
  facing the road they came, lodged at one of its taverns, out by it when they leave. The LivingTown reads both off
  the host's book (`tripsOf`) and plans a day again once its ways are known.
- **The armed walk.** `ResidentWalker.arm(look)` wears the class's eight-way MobileUnit on its archive by the
  resident's sex (`travellerSprites.js classLookOf`), its art loaded into the people's own texture table; out of it at
  home. NPCS ADVENTURING BEYOND TOWNS DRESS OUT IN ARMOR BEFORE LEAVING: the gear stay, then the class sprite walking
  out of the gate.
- **On the road** (`livingRoads.js`): every second the parties within `ROADS_VIEW_PX` (6) of the player's pixel
  (`partiesNear`, the book's memo of every trip made); each frame each party placed (`partyPlaces`) - BY DAY in file,
  `FILE_GAP_N` (1.8 m) apart along the way, `FILE_SIDE_N` to either side, facing the way; BY NIGHT in a ring
  `CAMP_RING_N` (2.25 m) about the camp, facing in. In play the members within `ROADS_PLAY_M` (360 m) stand, whole;
  under the Overworld within the bands' far edge, faded and grown, and each party wears a `wayfarer` mark (a caravan's
  `wayfarer caravan`) with its kind and where it is bound - the travellers' filter group, a square in the road's dust.
- **Their bodies** (`travellerSprites.js`): the armed in their class's sprite, the rest in their own outfit (the
  walker's billboard); each a talk target in the street's shape, freed as it leaves the list and all at `clear()` -
  indoors (the mode frame) and outside the open world.
- **Talk and regard on the road.** The talk ray and the hover take the road's people beside the town's
  (`_talkPersons`); the watch's conversion and the trample keep to the town's. A word is noted, an enemy refuses, and a
  hand caught in a traveller's purse costs their regard - and calls no watch (`livingTalk.caught`; on the road there is
  no town). A party talks among itself in rounds (the road's words walking, the fire's at night - lines.js
  `ROAD_TALKS`, `CAMP_TALKS`) and has a word for the player passing within `ROAD_GREET_M` (4 m) by regard
  (`ROAD_GREETINGS`).

## LW4 - trouble on the road (2026-10-04)

`systems/livingWorld/lives.js` and `trouble.js`, pure; `trips.js` carries them; the host composes them
(`scenes/world.js`), the roads' layer shows them (`scenes/livingRoads.js`), the town tells them.

- **The lives** (`lives.js`). Each traveller's PLACE rolls its fate once a cycle - its own cycle, a sellsword's its
  contract merchant's (`trips.js placeCycle`) - against its job's `HAZARD` (a merchant 0.006, a sellsword 0.01, an
  adventurer 0.012, a pilgrim 0.006, a courier and a pedlar 0.004: a town of a dozen travellers loses one a season or
  so; a sailor's is the sea's, LW5). A roll under it is a death that cycle, COUNTED unless another fell in the
  `VACANT_CYCLES` (3) before - the rule reads the rolls alone, so a place's history is never a chain. A counted death
  empties the place for the three cycles after; then a NEWCOMER holds it - the census's own mint with the death's
  cycle in the seed (`census.js mintResident` `gen`: a new name, face and trade's record, `L<map>.t<slot>~<cycle>`),
  the same newcomer for every reader. `placeAt` reads a place back to the world's first cycle, never through a window,
  so a death long ago never falls out of the reading. A fated holder SETS OUT whatever the cycle's chance said
  (`ownTrip`), a fated contract sellsword goes with its merchant whatever the hire (`formCaravans`): the road keeps its
  appointment. One with no road that cycle (`setsOut`) dies abroad, unseen - gone from its town the whole cycle.
- **The trouble** (`trouble.js troubleOf`). At most one encounter a trip: its chance the walk's - `RISK_PER_DAY`
  (0.09) a day of walking, out and home, weighed by the ground the way crosses (`GROUND_RISK`: a road 0.6, a track 0.9,
  open country 1.4), to `RISK_MAX` (0.55); a party carrying a fated death always meets it. It falls on the way out or
  home at a seeded stretch of the walk, or - a leg its first day does not finish - now and then (`CAMP_SHARE`, 0.3) on
  that night's camp at eleven. THE FOES are the land's own: the climate's encounter table at the place it falls, day or
  night, the campers' themed group (`campEncounters.js rollGroupComposition`, the TV7 bands' own roll), at the party's
  level (its armed's best, two at least), sized to the party (the fated: the party and two more), to `FOES_MAX` (6).
  THE END: a fated encounter's is the lives' - the leader among the fated, the party FELL (the rest turn home); else
  WON at that cost. Any other is the party's strength (`strengthOf`: the armed 4 and 1.5 a level, a merchant 1.5, the
  rest 1) against the foes' (`foeStrength`: 1 and 0.6 a level): DRIVEN off with ease, WON hard, or FLED.
- **What the trip becomes** (`troubledTrip`, `partyAt`). The party is HELD where it fell its `HALT_MIN` (driven 25,
  won 60, fled 15, fell 45 minutes of the clock) - the fight its first `FIGHT_MIN` (10, 25, 8, 20) - then walks on at
  `HALT_CATCH_UP` (half again) its pace until it has made the halt up: never a sprint, and no jump (the pins walk 300
  troubled trips five minutes at a time). The FALLEN leave the party at the fight's middle (`membersAt`); they never
  walk home (`awayOf`: their window open). A party that fled or fell on the way out is TURNED: home from where it stood
  once the halt is done (`backT0` the halt's end, `backT1` the walk home), never at the town it set out for
  (`visitorsOf` sees no turned party, and none of the fallen).
- **What the towns see.** Each traveller's place as its HOLDER that day (`tripsOf`'s `holders`: the census's own
  resident while it holds the place, the newcomer lodged at the place's home, nobody while it stands empty), each
  holder's away windows by their own id; and the NEWS (`trips.js newsOf`): its own parties' troubles, each known from
  when the party came home (none coming home: when it was due), for `NEWS_DAYS` (3), the fallen first named - told at
  the town's meetings `NEWS_SHARE` (0.4) of the time, the news's own scripts by its end (`lines.js ROAD_NEWS`:
  `{who}`, `{foe}` - `foeWord`, "Orcs", "Harpies", "a Giant" - and `{place}`). Never on the road.
- **What the road shows** (`livingRoads.js`). A beset party FIGHTS where it stands - its people in a ring
  `FIGHT_RING_N` (1.6 m) facing out, the unarmed within, the armed striking; its foes about it at `FOE_RING_N` (4.75 m)
  facing in, each its own kind's sprite, no talk target, striking - each fighter on its own `STRIKE_S` (1.3 s) beat
  (the sprites hand the unit its attack's edge, `travellerSprites.js`); then the party holds there, binding its
  wounds. No word to the player from a fighter. The FALLEN lie where they fell a day (`trips.js remainsNear`,
  `REMAINS_MIN`) on the human corpse's picture (`corpseLook`: TEXTURE.380's first record, the eighteen classes' one).
  Under the Overworld a beset party's mark is `wayfarer fight`, in the bands' red, "Caravan beset by Orcs".
- **The character's turns of fate** (`relations.js turn`, `turns`): a member the road would have taken who lived
  because the player fought beside them (`spared`), one cut down beside them (`fallen`) - keyed by the PLACE and the
  cycle (`lives.js turnKey`) - and a fight won or lost for a party (`won`, `lost`, the encounter's id: a won fight is
  won, a lost one fled). Read over the dice (`fateHits`, `troubleOf`'s `turnOf`), kept `TURNS_MAX` (200) a kind, saved
  beside the regards (a record with none reads as before). The host's books (the places, the fates, the trips) are
  made again at each turn and each load (`livingTurnsFresh`). The live fight that makes them is LW4b's.

## LW4b - the fight, stood (2026-10-05)

`scenes/roadFights.js`, the host's; the roads' layer carries it (`fights`).

- **Stood.** A player ON THE GROUND within `LIVE_M` (150 m) of a party at its fight, and the one to stand it (online
  the camps' own election, `campEncounters.js amGroupRollOwner` by the players' own feet at twice the reach - one
  player stands each fight; offline always), stands it LIVE: its FOES as the encounter pool's own (`exteriorFoes.js
  spawnFoe`, loose and transient - never a save's), each its kind at the encounter's level, `FOE_STAND_M` (7 to 13 m)
  about the party's place facing it, shared online as any encounter's; its ARMED as the player's ALLIES (team
  PlayerAlly - every foe may fight them; a `shipmate`, no blow of the player's reaches them), each in their class at
  their own level, by their own name, where they stood in the ring. The unarmed stay in the ring as the roads draw them.
  Never from the sky (the Overworld up), never while nothing can stand (`ready`: on foot in the open world, nothing
  loading, nothing in passage, not afloat). The roads then draw none of the bodies the pool holds; a fight a PEER
  stands (`peerStands`) shows no foes of the roads' own - the peer's come through the stream.
- **The end is what happens** (`judge`). An ally cut down FELL (the turn `fallen` at the member's place and cycle: the
  lives read it - the place stands empty, a newcomer comes). Every foe dead: WON (the turn `won` - the trouble reads it
  and the party walks on, never turned), each member the road would have taken who still stands SPARED (the turn
  `spared`), and each survivor's regard moved - `saved` (35) the spared, `helped` (20) the rest, nothing for the fallen.
  Every armed ally down with foes standing: LOST (the turn `lost`: the party flees home) - and the foes are the
  player's own trouble, left to the pool's own law.
- **Let go.** A fight left unfinished - the player past `LIVE_KEEP_M` (260 m), `LIVE_GRACE_MIN` (90) past its halt,
  or nothing able to stand - is let go: its bodies taken out, the pure end standing (a member cut down in it fell all
  the same). A fight won lets its allies go when its halt is done and the party walks on, its own again. EVERY
  ALLOCATION HAS AN OWNER: each body stood is the layer's until its fight ends, and `clear()` (the roads' own, at every
  sweep: indoors, a mode's change, the teardown) takes out every one.

## LW5 - the ports (2026-10-05)

`systems/livingWorld/portCrews.js`, pure; `places.js harbourDock`; the LivingTown reads the ships; the host composes
them with the Bay's own packets (`scenes/world.js`, `naval/seaLanes.js`).

- **The crews are the town's sailors.** A port town's sailors (the census's two to six) are the crews of the Bay's
  packets that call there: a port's PACKETS are every packet of every lane with the port at either end, lane by lane
  (their keys in order), packet by packet (`portPackets`), and its sailors, in slot order, are dealt over them, round
  again (`berthOf`) - so a packet's crew is the hands of both its ports, and a port's sailors are scattered over every
  lane it keeps.
- **Where a sailor is is where their packet is, on HER clock** (`sailorAt`) - the shared one the naval host stands and
  steers her by (`seaLanes.js packetAt`, `raidNowMs`): under way, AT SEA (aboard: in no street); lying at their own
  port, at HOME (ashore, their own day: the dock's work by day, the tavern after); lying at the far port, ABROAD -
  ashore there till her dwell is done, a visitor in that town. So the hands on a port's quay are the crews of the
  ships lying at it, and a ship seen leaving takes her hands with her. MAC: NPCs "LINK WITH THE SHIP AI AT PORTS".
- **The crews ashore** (`crewsAshore`): every packet calling at a port that lies there now, and of her crew the far
  port's hands - each in off the town's dock when she made fast, lodged at one of its taverns, back aboard by her
  sailing (the host turns her dwell, on the ships' clock, into the sky's minutes at its rate now; the town plans the
  stay again only when that moves past `CREW_REPLAN_MIN`, 5 minutes - the two clocks drift by a hair at each census).
  The host asks the ships' clock of a town's OWN sailors alone (`res.town`): a visiting crew is the crews' own.
- **The dock.** A Ship building's door where the town has one; else - most ports: Daggerfall stands no piers - the
  street cell nearest its harbour's first berth (`harbourDock`, within `HARBOUR_RING`, 120 cells, facing the water;
  HARBOUR-BOOK's harbour, sounded off the terrain the same for every player), found once the harbour is sounded, its
  sailors planned again to work it.
- **Only while the Bay's ships sail** (the naval host on: `naval.enabled`). Off, a port's sailors keep their own days
  ashore, as LW1 made them.
- **The clocks.** The packets run on the shared clock's real seconds, the living world on the sky's minutes; a sailor's
  place is read off the ships' clock as it stands NOW, so where the ships are and where their hands are always agree.
  A traveller's own passage over the water, a trip by sea on a timetable of the sky's minutes, is LW5b's.

## LW5b - the passage by sea (2026-10-05)

`trips.js` (`seaTrip`, `SEA_CHANCE`, `SEA_PACE_X`, `SEA_TIDE_H`; `ownTrip`, `partyAt`, `awayOf`, `visitorsOf`, `newsOf`,
`remainsNear`), `trouble.js seaTrouble`, `lines.js SEA_NEWS`, the LivingTown's dock exits (`livingTown.js`), the host's
lanes (`scenes/world.js` `lanesFrom`: the Bay's own network, `naval/seaLanes.js`). Mac: NPCs "travel between towns ...
link with the ship AI at ports" - LW3's trips kept to the land; a port's traveller now takes ship.

- **Who sails.** A port town's traveller sails on about `SEA_CHANCE` of their cycles - a merchant 0.4, a courier 0.35,
  a pilgrim 0.3, a pedlar 0.2, an adventurer 0.15 (one not diving that cycle); a sailor crews (LW5), a sellsword rides
  with their merchant. The cycle's own dice ('sea'), apart from the road's, so a cycle that does not sail is the trip it
  always was.
- **Where.** A port a lane of the Bay runs to from theirs (`world.lanesFrom`: the far port, the lane's length in
  metres): the bigger and the nearer the likelier (a pilgrim's a temple town's). Lanes are the Bay's own - the ones its
  packets sail (LW5) - so a passage can reach a port beyond any road's `TRIP_REACH_PX`.
- **When.** Out from the dock on a morning tide (`SEA_TIDE_H`, 6 to 9 o'clock); the crossing at `SEA_PACE_X` (3) a
  walker's pace, by night as by day; the stay (the job's `STAY_DAYS`); home on a later morning's tide, the same hour
  (a ship turns round overnight at the least). The whole passage inside the cycle: a lane too long for it gives way to
  the longest shorter lane that fits; none that fits (or no lane at all), the road's trip it always was.
- **At sea, never on the road.** A passage is `sea` while it sails, out and home, and `stay` between - never `out` or
  `back`, so no road, Overworld mark or roadside fight shows it (it has no way under it). Its party is a caravan's
  like any trip's: a merchant's sellswords and the joiners of the day (LW3) take the same ship.
- **The dock.** A traveller sailing walks to the town's dock (LW5's: the Ship door, else the street cell by the first
  berth) and is gone from it; a passenger off a ship comes in at the far port's dock, lodges at a tavern there, and
  leaves by it. A port's visitors are read from every port its lanes run to, however far.
- **Lost at sea** (`seaTrouble`). A crossing meets none of the land's foes. A passenger the lives take this cycle (LW4's
  fate - the same dice) is LOST AT SEA at a seeded hour of a crossing (the way out the likelier, 0.6), gone from the
  party there and nowhere to lie; the ship sails on with the rest. None fated, none. The town tells it in the sea's own
  words (`SEA_NEWS`).
- **The map read first.** The lanes are read off the map's own ports and water (the host's `lanesFrom`, cached per
  port); until the map is read a port's sea trips are `undefined` - asked again, like an unread road - so every reader
  answers alike. Not gated on the ships sailing (`naval.enabled`): a passage is a timetable of the sky's minutes, not a
  hull.
- **Not yet:** a passenger seen aboard a packet (the ships' crews are LW5's sailors; a passage keeps its own timetable).

## LW6 - the deep (2026-10-05)

`trips.js` (`diveTrip`, `diversAt`), `trouble.js diveTrouble`, pure; `scenes/dungeonDivers.js` and the host's dungeon
index (`scenes/world.js`).

- **The dives** (`diveTrip`). An adventurer's cycle is a DIVE now and then (`DIVE_CHANCE`, 0.55 - its own dice, so a
  cycle that is none is the trip it always was): a dungeon of the game's own rows (a labyrinth, a keep, a ruin, a
  graveyard, each with its dungeon's type - the host's `dungeonsNear`) within `DIVE_RANGE_PX` (1 to 8), the nearer the
  likelier, walked out to by day as any trip's town, its hours inside (`DIVE_MIN`, 4 to 10) in place of a stay - out
  of the dungeon by night, the walk home waits for the light - and home inside the cycle. None but an adventurer dives.
- **The deep's trouble** (`diveTrouble`). A dive carrying a fated death (lives.js) meets it INSIDE, at a seeded hour of
  its time there (a fifth to four fifths in), among the dungeon's own (its type's table: `encounters.js
  chooseRandomEnemy` on the dungeon type, the party and two more): the leader among the fated, the party FELL and its
  people come out at once and walk home; else it WON at that cost. No halt on the road - it was under the ground. The
  fallen of a dive lie inside (`fallen.inside`), never at the door (`remainsNear` passes them by).
- **What the town says** of a dive is the deep's own (`lines.js DIVE_NEWS`: "{who} went down into {place} and never
  came up").
- **Who is inside** (`diversAt`): the parties of the towns within reach diving a dungeon now, less the fallen - none
  before their hours or after, and only in their own dungeon.
- **The companies met** (`dungeonDivers.js`). A player in a dungeon during a company's dive - the one to stand it (the
  camps' election online; offline always) - MEETS it ("You meet Ada Lark's company, come down into Mournoth."): its
  members stood as the player's allies through the dungeon's own loose stand (allied, a `shipmate`), `DIVER_STAND_M`
  (5 m) behind the player, by class, level and name, and keeping with the player through the halls (the motor's own
  follow, `DIVER_HEEL_M` and a pace further each). One cut down FELL (the character's turn). Their hours done the
  company makes for the surface: the fated still standing SPARED, every survivor's regard moved (`saved`, `helped`),
  the bodies taken out; a company the dive lists no longer goes. The host asks the dives once a second and reads the
  company each frame, a layer for each dungeon's pool (`livingDiversStep`, in the modal frame).
- **Not yet:** the fallen of a dive lie in the dungeon as a thing to find - LW6b's.

## LW6b - the fallen in the deep (2026-10-05)

`trips.js` (`fallenIn`, `DEEP_REMAINS_MIN`), `relations.js` (`MARK_KINDS`: `laid`), `scenes/deepRemains.js`
(`createDeepRemains`, `restAt`, `DEEP_NOTICE_M`, `DEEP_LAY_M`), `dungeonDivers.js stood`, the dungeon's resting places and
pile (`dungeonContext.js` `restingSpots`, `layRemains`, `pileNear`) and the host's step (`scenes/world.js
livingRemainsStep`). Mac: "You can find them dungeon diving ... explore a dynamic world" - a company that never came up
leaves its dead below, and the town says so (DIVE_NEWS); now a player can go down and find them.

- **The deep's word** (`fallenIn`): the dead of the dives into a dungeon by the towns within reach, each from the minute
  the deep took them for `DEEP_REMAINS_MIN` (three days); none of the road, never a hand's (LW7: their bodies are the
  pool's own corpses); each once by its own key (`deep:<resident>:<trip>`), the oldest first. Pure: every reader's
  dungeon holds the same dead. The host passes by, as well, one who fell at the player's side (the `fallen` turn: the
  pool's corpse), one the player saw spared, and any of a company stood in the dungeon now (`dungeonDivers.js stood`:
  its end is what happens there, LW6).
- **Where they lie**: at one of the places the dungeon's own foes stand - its random enemy markers, each on the floor
  under it (`restingSpots`, the layout's order) - the one their key deals (`restAt`): every reader the same.
- **What lies there**: their body, their class's own corpse picture, as a pile of the dungeon's own (`layRemains`) with
  what they carried - their class's loot table at their level, a weapon, a piece of armour and their purse. Laid ONCE in
  the character's world (the relations' `laid` mark, written into the save only once there is one); the dungeon's pile
  from then - the scene's cache keeps it, the player loots it. On the way in they are simply there (the dungeon as it
  is); one the deep takes while the player is below lies where the player is not (beyond `DEEP_LAY_M`, 15 m).
- **Found**: the player coming within `DEEP_NOTICE_M` (4 m) of remains still lying there hears whose they are ("The
  remains of Ada Lark, of Wayrest.") - once a visit.
- **Not yet:** their kin told of it - LW6c's.

## LW6c - carried home (2026-10-05)

`systems/livingWorld/keepsake.js` (`mintKeepsake`, `isKeepsake`, `keepsakeFor`, `KEEPSAKE_TEMPLATE`, `KEEPSAKE_KINDS`),
`lines.js LIVING_KEEPSAKE`, `livingTown.js moment`, the talk's door (`scenes/townTalk.js`: `livingTalk.moment`) and the
host's (`scenes/world.js`: the door, the town's `keepsakes`/`takeKeepsake`, the remains' keepsake). Mac: "make friends or
enemies, and explore a dynamic world" - what the deep kept can be carried home.

- **The keepsake.** Each of the fallen of a dive carries one, laid with their remains (LW6b): a locket, a ring, a brooch
  or a charm - their own, by their id (`KEEPSAKE_KINDS`) - an item of the port's own (DECLARED: template 1800, a custom
  row registered at import as the port's others are; worth nothing to a merchant, on no shelf, no stack), named for
  them ("Ada Lark's locket") and marking whose it was (`livingKeepsake`: their id, name, town and home).
- **Carried home** (`moment`). The player speaking with one of the household the fallen lived with (their town, their
  home - never one holding the fallen's own place, a newcomer among them) while carrying it: before any words (and a
  refusal first - an enemy takes nothing from the player) it is handed over (`takeKeepsake`), the one spoken with
  remembers it (`saved`) and the rest of the household too (`helped`), and their words stand on the parchment
  (`LIVING_KEEPSAKE`, the fallen's first name and the player's; an ActionTextBox, the talk's own) - the conversation
  another time.

## LW6d - the town's word of it (2026-10-05)

`relations.js` (`TALE_KINDS`: `home`), `livingTown.js` (`moment` records it; `deedNews` tells it), `lines.js HOME_NEWS`.
Mac: "make friends or enemies" - a kindness is talked of, as a deed is.

- **The tale**: a keepsake carried home (LW6c) is the character's `home` tale (`<the one it was>@home`), kept with its
  minute - the clock's own at the hand-over, a room's as the street's - and the name it tells of, once; beside the
  hand deaths, never one of them (the places and the lives read only `slain` and `died`); written into the save only
  once there is one, as [key, t, who].
- **The town's word** (`deedNews`): its own tales, known `DEED_KNOWN_MIN` after, for `NEWS_DAYS`, by the name of the one
  it was - told in its meetings, the street's and the rooms', beside the road's news and the deeds, in its own words
  (`HOME_NEWS`, the player named).

## LW7 - the deeds (2026-10-05)

`relations.js` (the hand deaths, a word's tone), `lives.js` (`handDeath`, `roadHits`), `trips.js handsOn`, `lines.js`
(`SLAIN_NEWS`, `DIED_NEWS`, `HELPED_NEWS`), pure; `livingTown.js` and `scenes/livingRoads.js` (the deeds), the host's
seams (`scenes/world.js`, `scenes/townTalk.js`). Mac: "make friends or enemies".

- **A hand's death** (`relations.js HAND_KINDS`). A resident the player STRUCK DOWN (`slain`) and one who died fighting
  at the player's side (`died`) are turns of the character's with their MINUTE, whether the slaying was seen, and the
  name they bore (`HAND_NAME_MAX`), kept as the turns are (`TURNS_MAX`) and saved as `[key, t, seen, who]` - a record of
  the LW4 kinds alone is written as LW4 wrote it. One of their own slain is `EVENTS.slain` (-75): a stranger made
  HOSTILE by it. Each tone of word - `polite`, `insulted` - counts once a day (`polite`, `blunt` days, saved once set).
- **The lives take a hand's dead from its minute** (`lives.js`). `handDeath` reads either kind; a hand's death is a
  death (`fateHits` - the place stands empty VACANT_CYCLES, then a newcomer) but never the ROAD's (`roadHits` - the
  dice and the fights): `dies` stays the road's own, so the trip the cycle made and its trouble stand as they were (the
  host's trouble never takes one a hand took first). A turn the character made - one cut down beside them, a hand's -
  ALWAYS counts: it was made on a holder they met (an uncounted roll before it, on an empty place, no longer swallows
  it). A townsperson's place lives by a cycle too (`trips.js cycleOf` - the host's `livingCycleOf`; a traveller's is
  `placeCycle`), so the lives read the household, the watch and the travellers alike; the newcomer is the census's own
  mint with the place's home.
- **A trip's hand deaths** (`handsOn`): each member a hand took before the trip was done is gone from the party from
  that minute (`fallen`, `hand`) - no remains of the road's (the body is the pool's, or there is none), not the road's
  news, never home; a death after the trip is the town's. A party nobody is left of shows no mark.
- **The town's deeds** (`LivingTown`). A resident STRUCK DOWN (`slain` - the swing's one-hit civilian, the trample) is
  dead from that minute (`o.slay`, seen when anyone saw it), off the street, and the street reads them gone (`o.deadAt`)
  and their place by the lives (`o.holderOf`); their OWN (`kinOf` - the household they live in, the party a visitor came
  with, the crew a sailor came ashore with) count it `slain`; every resident who SAW it (`witnesses` - on the street
  within `WITNESS_M`, 24 m, with a clear line from their eyes, `o.sees`: the host's collider) counts it a `crime`. One
  of the watch STRUCK (the assault that turns them) remembers the blow (`struck`); a caught hand is seen by all near
  (`caught`). A question's tone moves a regard (`toned`).
- **The street's seams** (the host). The swing's civilian pool (`livingStruckPool`) and the trample hand the resident a
  swing takes to the deed first - one of the watch struck, anyone else struck down; the guard the conversion stands
  carries the watchman (`livingWatchStep`): cut down, they are slain for good. A swing that meets nobody in the street
  is offered to the ROAD'S travellers (`livingStrikeRoad`: within reach, no wall before them - DFU's one-hit civilian,
  WeaponManager.cs:504-521, less the watch: there is none on the road), the blood, the Brotherhood's five and the racial
  override's hit; the roads' deed (`livingRoads.slain`) turns their party's living against the player and reads the
  parties again at once. The talk window's questions carry their tone to the resident spoken to (`livingTone`).
- **What the town says** (`deedNews`): each of its own the player struck down, known `DEED_KNOWN_MIN` (60) after, for
  NEWS_DAYS - `SLAIN_NEWS`, the player NAMED when it was seen, a murder nobody can name when not - and each who died at
  their side (`DIED_NEWS`); a fight on the road the player turned (the character's `won`) is told with them in it
  (`HELPED_NEWS`, else the road's own words). The circles fill the character's name (`{player}`).

## LW7b - friends and enemies beyond the walls (2026-10-05)

`scenes/roadStands.js` (`createRoadStands`), the roads' layer (`stands`), `scenes/dungeonDivers.js` and
`scenes/roadFights.js` (a regard read at the meeting), the host's wiring (`scenes/world.js`). LW0: "a friend greets you
by name, an enemy will not talk, and an armed one draws on you beyond the walls".

- **An armed enemy draws.** A traveller on the road (not at their party's fight - that is the fights') who carries a
  class and counts the player HOSTILE (regard at `HOSTILE_AT` or below - one of their own slain does it) within
  `DRAW_M` (45 m) of a player on foot in the open world is stood LIVE as a foe of the encounter pool's own (loose,
  transient: never a save's), in their class, at their level, by their name, where they walked ("Bo draws on you!") -
  their party walks on without them, and the pool's own law (its senses, the wilderness's notice) has them come. Cut
  down they are SLAIN - the character's hand, seen (their party stood by) - and their party's living turn against the
  player (`slain`): a feud runs through a party one death at a time.
- **An armed friend comes.** A traveller who counts the player a FRIEND (`FRIEND_AT` and above) within `HELP_M` (70 m)
  while the player is FIGHTING (the host's: a foe on the player within `FIGHT_NEAR_M`, 30 m, by the threat law) is
  stood at their side - allied (team PlayerAlly, a `shipmate` no blow of the player's reaches), by name ("Cy comes to
  your side.") - and goes back to their party once the fight has been done `CALM_S` (8 s). Cut down they DIED at the
  player's side (the turn `died`: their place empty for it, their town talks of it - `DIED_NEWS`).
- **The end is the pool's.** The dead are the pool's own (a corpse to search, a body never taken out - not even by the
  clear); a stand is let go - the body taken out, the member back with their party - when the player is past `KEEP_M`
  (200 m) from where it was stood, or nothing can stand (indoors, the Overworld up, a sweep). A body the pool would not
  stand is tried once (the roads draw the member again). Online each character's enemies and friends are their own:
  this client stands them, the stream shows them as any encounter's.
- **A roadside fight's enemies keep the ring** (`roadFights.js`): a member of a beset party who counts the player an
  enemy, or hostile, is not stood beside them - the rest are; a fight won still earns every survivor's regard (the way
  back from enmity is a life saved).
- **A company's regard in the deep** (`dungeonDivers.js`). A diving company with one who counts the player HOSTILE draws
  on them - stood before the player through the dungeon's own loose stand, not allied, by name ("Ada Lark's company -
  and Bo draws on you!") - and the rest keep to their dive; cut down, SLAIN and the company's living turned; their hours
  done the dead stay the pool's and the living go. With none hostile, its ENEMIES keep away and the rest stand with the
  player as LW6's company; a company all enemies passes the player by.

## LW7c - the people who know you (2026-10-05)

`systems/livingWorld/people.js` (`residentOfId`, `peoplePage`, `personWords`), pure; `ui/enhancedChronicle.js` (the
People section), `ui/chronicleDoor.js` (the `people` door), the host's (`scenes/world.js`).

- **Nothing new is saved.** A resident's id names their town, roll, slot and generation, and the census's mint is a
  pure function of those - a name reads the seed, the region's bank and the sex, and the sex no trade but the watch's -
  so the page mints each resident again from their id (`residentOfId`: every one of a town's census, household, watch
  or traveller, bears the census's own name; a newcomer's generation rides in the id).
- **The page** (`peoplePage`): FRIENDS the warmest first, ENEMIES (the hostile and the enemies) the bitterest first, the
  KNOWN the latest seen first, each to `PEOPLE_MAX` (60) - each by name and town, their standing, their regard on the
  living day, the days since they were last seen, and their FATE: slain by the player's hand, or fallen at their side
  (the character's hand deaths, told by their place and the name they bore - a newcomer to the place is not them). The
  page says it in words (`personWords`): "A friend. Seen today.", "An enemy - they will not speak to you.", "Slain by
  your hand.".
- **In the chronicle** (the L key's window): a People section of its own where the host hands the page over - the
  four sections as they were otherwise - its count the people known, a group for each standing with its cards (the
  name, the town, the words), and "No one in the Bay knows you yet." before anyone does. The streaming host hands it
  over where the living world is on.

## LW8 - the doors open (2026-10-05)

`livingTown.js insideAt`; `scenes/livingIndoors.js` (`createLivingIndoors`, `soundRoom`); the building mode's two hooks
(`scenes/worldModes.js`: the press, the billboard pass) and the host's layer (`scenes/world.js`). Mac: NPCs "dynamically
all have tasks ... perform activities" - LW2 shut the door behind a resident; this stands what is behind it.

- **Who is inside** (`insideAt`): each resident whose day has them in at the building's door at the clock's minute -
  the evening's drinkers at the tavern, the errand's customers at a shop, the faithful at the temple, members at the
  guild hall, a household at home awake - never one asleep, never the building's own STAFF at their work where it is no
  house (DFU's static people stand for them, as they always have), never the taken, the gone (at sea, abroad), the dead
  or one still in the street (a walk running late); in the order of their ids.
- **Where** (`soundRoom`). A room has no grid to walk: it is SOUNDED once from its way in (LW-FIX6: the landing of
  the building's first door, whichever door was taken - every reader and every way in the same room) - a fan of
  `INDOOR_FAN` (12) directions walked out to `INDOOR_SPREAD_M` (2.4 to 6.6 m) through the room's own collider (never
  through a wall), each landing on this room's floor (no floor, or another - a stair's foot - no spot), kept
  `INDOOR_APART_M` (1.3 m) from every other, `INDOOR_CLEAR_M` (1.1 m) from the building's static people and
  `INDOOR_DOOR_M` (1.8 m) from every way in (LW-FIX6: each door's landing). Each resident takes a spot in the order of their ids over an order the
  building's key deals, facing into the room, in their own clothes (indoors no one is armed), to `INDOOR_MAX` (12).
- **Coming and going**: who is inside is read every `INDOOR_TICK_S` (1 s); on the way in the room is as the day has it,
  all at once (LW2's arrival law); after it one who comes or goes waits for the player to look away (or be
  `INDOOR_SEEN_M`, 14 m, off).
- **Talk** (the building mode's press, `host.livingPersonsAct`): a resident in the room is offered the press before the
  ladder's own winner - the street's own talk ray (`townTalk.tryActivate`) on the room's talk seats - and their regard
  hears it through the room's door (a refusal from an enemy, a word, a tone). A hand caught in a purse here is seen by
  those in the room within `WITNESS_M`. Drawn on the building's own billboard pass (`host.livingBillboards`).
- **The host** stands the layer in a building of a living town (the room's collider and floor, its static people, the
  sky's clock), steps it in the modal frame and frees it in the street. EVERY ALLOCATION HAS AN OWNER: each body is the
  sprites' (`travellerSprites.js`), synced each frame from the layer's list; `clear()` frees them all.
- **Not yet:** a resident walking in the room (it has no grid) - LW8c's. Their talk to each other indoors is LW8b's.

## LW8b - the room's talk (2026-10-05)

`scenes/livingIndoors.js` (`tablesOf`, `TABLE_M`, `TABLE_MAX`; the layer's tables, circles, words and `speech`),
`lines.js` (`ROOM_TALKS`, `roomKindOf`, `pickScript`'s `room`), `meetups.js circleLine`'s `room`, the LivingTown's doors for
a room (`livingTown.js` `lineCtx`, `talkBeat`, `typeOf`, `greetingFor`), the building mode's HUD pass
(`scenes/worldModes.js` `host.livingSpeech`) and the host's layer (`scenes/world.js livingRoomLines`). Mac: NPCs "have
conversations with each other ... much like the crew on board ships" - LW8 stood a room's residents; this has them talk.

- **The tables** (`tablesOf`). The room's sounded spots are grouped where people stand together: in the building's
  deal, each spot not yet at a table opens one and takes the nearest of the rest within `TABLE_M` (2.2 m) of every one
  already at it, to `TABLE_MAX` (3). The room fills TABLE BY TABLE (the tables in the deal, each its spots in turn), so
  those inside stand in twos and threes; those at a table face its middle, one alone faces the room.
- **The circles.** Each round of the street's (`ROUND_S`, laid on the town's clock: `talkBeat`) those at a table its
  whole round (their stays at the building's door) meet as the street's circles do - `spotCircles` on the table's own
  key (`in:<building>:<table>`), the street's `TALK_SHARE` of them talking, a line each `CREW_LINE_S` of the clock, the
  first speaker first. One come in mid-round meets none till the next.
- **The words.** The street's own (`circleLine`: the town's talk, the trades', the weather's, the evening's and the
  night's, the town's news of the road and of the deeds - `lineCtx`, at the room's minute), and the ROOM'S OWN beside
  them (`ROOM_TALKS` by the building's kind, `roomKindOf`: the tavern's, the temple's, a shop's - any shop, the bank, the
  library -, the guild hall's, the palace's, a home's), two shares of three of the town's (`pickScript`'s `room`; the
  road's talk keeps its own, and without a room every script the street drew before).
- **The word to the player**: one in no circle within `GREET_RANGE` has the street's word (`greetingFor`: a friend's by
  name, an enemy's cold, a known face's plain, a stranger's now and then), once in `GREET_REST_MIN` of the clock, for
  `GREET_S`; the word said notes them seen. The street's `_greet` speaks through the same door.
- **Heard** (`speech`, within `LINE_RANGE`): each line over its speaker's head on the crew's one layer
  (`livingRoomLines`: the interior's own matrices, the crew's range and sight, a known one by first name), covered
  under a window, out of a building or paused - only once the living world has stood a room.
- **Every reader alike**: a table's circle and its words are the table's key, the round and its members' (pure over
  who stands at it); those in the room on the way in stand alike for every reader (LW8).

## LW8c - the room astir (2026-10-05)

`scenes/livingIndoors.js` (`stirPlace`, `INDOOR_STIR_S`, `INDOOR_WALK_M`, `INDOOR_WALK_SPEED`; the layer's stirring and walks).
Mac: NPCs "perform activities" - the room's residents no longer stand where they came in all evening.

- **Who stirs**: one in no TALKING circle (a quiet one may get up), once their own wait is up - `INDOOR_STIR_S`, 30 to 90
  real seconds, their id's own between - and again after each walk.
- **Where to** (`stirPlace`, pure): a free place of the room within `INDOOR_WALK_M` (7 m) - a table where one stands alone
  first (never one of two, one walking or their own; its nearest free place: company), else one their own dice pick - along a line the room's own collider lets them walk (sounded as the
  room was: never through a wall, a counter or a table). None: they stay, and try again after another wait.
- **The walk**: at `INDOOR_WALK_SPEED` (1.2 m a second), facing the way they go, moving; the place they make for is
  theirs from the moment they set out (no newcomer takes it). Between tables they are at none - no circle, no table to
  face, and the word to the player from where they are.
- **Not yet:** a resident's errand in the room (the bar, a shelf, a hearth).

## LW-FIX1 - the review's six (2026-10-05)

An independent read of LW6 to LW8c (a reviewing agent, its findings verified against the code before any fix) found six
defects; each is fixed and pinned (`test/lwfix1_review.test.js`, `tools/mutants/lwfix1.json`, and LW6's own host pin).

- **The dungeon the player is in** (`world.js livingDungeonHere`) was read off `dungeonCtx.location()`, a seam the
  dungeon's context does not carry - its summary is the abyss seam's (`dungeonCtx.abyss.location()`, DungeonSummary.
  LocationData). So no company of LW6 was ever met, and no remains of LW6b (nor LW6c's keepsakes) ever laid, in the
  game itself: the pins read the host's source alone. LW6's pin now checks the seam on both sides.
- **A keepsake by the resident's own town** (`livingTown.js moment`): the talk's town was asked, so a visitor whose house
  in their own town bore the fallen's house's number here took it (and their own household's never reached them away
  from home); and the household noted is the resident's own town's alone.
- **A walker's going** (`livingIndoors.js`): judged where they are on the walk, not where they made for - never gone
  in plain view.
- **A table's talk is the round's as it began**: each table's circles are dealt once a round (`roundCircles`) - one who
  sits down mid-round joins the next round's talk, and a circle one of whom goes falls silent till the next round;
  never a conversation re-dealt mid-script.
- **The player's own dead**: the deep passes by a `slain` or `died` diver (the pool's corpse) as it does the fallen
  beside the player; and the books are made again below when a turn is made there (`livingTurnsFresh`, for the
  remains and the divers alike) - before, a diver slain below was laid again as the deep's once their company left.
- **An empty room let go**: the layer is cleared on the way out whenever it holds a room, people or none (a house
  asleep) - before, the same building entered again kept its old sounding and its residents waited for the player to
  look away.

## LW-FIX2 - the seams' three (2026-10-05)

A second read (an agent auditing every member the living world's host reads off another module, each finding verified
before the fix) found three more; each is fixed and pinned (`test/lwfix2_watch.test.js`, `tools/mutants/lwfix2.json`).

- **The turned watch** (`scenes/livingWatch.js watchStep`). A struck watchman's guard, cut down, was ended through
  `town.slay(...)`, a method no LivingTown has (`slay` is the host's option): a TypeError the moment he fell, in the
  frame with no catch - the world's loop stopped. Now the town's whole deed, `slain` (the hand's turn at that minute,
  his household turned, the witnesses' crime at the place he was struck).
- **His guard found by its own mark.** On a swing the conversion stands his guard before it takes his body, so a
  watch read "after" already held it and it was never found (and the trample read any guard stood next). The guard
  now carries whom it stands for (`livingFrom`, set where it is stood: `cityGuards.js resolveCivilianHit`, the
  trample's `rrRidingHost.js`), and is found by that alone.
- **A room's doors on the clock's own minute** (`livingTown.js _liveMinute`): a word, a tone and a refusal asked
  indoors read the street's stopped `_now` - the minute the player went in, or nought after a load made indoors (a word
  noted on day -1 counted for nothing, the regard eased at once). They read the clock's own minute now (the street's
  is the same minute while it stands).

## LW-FIX3 - the town's five (2026-10-05)

The deep audit of everything the branch made (seven agents, each finding verified against the code before the fix)
found five in the town core; each is fixed and pinned (`test/lwfix3_town.test.js`, `tools/mutants/lwfix3.json`).

- **The walks coming near** (`livingTown.js _tick`, CENSUS_PATHS, WALK_STRAY_M, `walkGap`). The census read a walk
  whose path was not searched yet at its start, and only a row on the street searches its own path - so a walk begun
  beyond the street's reach was never searched, and its walker never came on, though they passed beside the player
  (measured on a 6x6-block town: 51 of 110 residents walking within 80 m by their day had no body; one who arrived
  early stood missing at their spot till the walk's planned minutes ran out). The census now searches the walks that
  may pass near - the box the walk's two ends make within LIVING_RANGE and WALK_STRAY_M (a path strays about a block at
  most outside it) - the nearest first, CENSUS_PATHS a beat (the arrival's own budget on an arrival); measured again, none
  missing but under DFU's cap.
- **The watch's beat** (`dayPlan.js`, the guard's stops). Each stop was drawn at three to eight minutes, and `schedule`
  drops a stay under MIN_STAY (8): five stops in six were dropped, the 64 drawn ran out, and the watch went home hours
  before the shift's end. Each stop is MIN_STAY to MIN_STAY + 7 minutes now, and enough of them to fill the shift.
- **The regard's bound** (`relations.js` trim). Past RELATIONS_MAX the faintest regard goes first - it read the regard as
  last noted, so a crowd's crime (every witness -15), long eased to nothing, outweighed every new acquaintance: once
  the bound was reached a word to a stranger was forgotten as it was said, and no new friend could be made. It reads
  the regard as it stands today, and never the one just noted.
- **The chronicle's keys** (`ui/enhancedChronicle.js` onKey). The arrow keys walked the four old sections: LW7c's People
  was never reached from the History, and an arrow from it jumped. They walk the sections the window shows.
- **A walk home cut at 04:00** (`dayPlan.js schedule`, an away window). A walk home after an away window that closed in
  the last minutes before the day's end ran past it, and the next day's plan - which drops that window - had the
  walker home asleep: a crewman or a visitor left the street mid-step, in plain view. A walk home that would run past
  the day's end is never begun; away to the end, the next day has them home.

## LW-FIX4 - the turns' eleven (2026-10-05)

The deep audit's road and deep findings; each is fixed and pinned (`test/lwfix4_turns.test.js`,
`tools/mutants/lwfix4.json`).

- **A turn never re-rolls the pure world** (`lives.js placeAt` `diced`; `trouble.js` the shape and the end; the host's
  `fated` and the trouble world's `diced`). The character's turns - a spare, one cut down beside the player - were read
  by the very dice that shape a trip and its trouble: a fated traveller's trip existed because the road would take them,
  so the spare that saved them took the trip off the road mid-walk; the trouble's leg, hour, place, foes and halt were
  drawn after the dead were counted, so a fight the player had just won moved, or vanished, under them. `diced` is the
  dice's own death of a cycle (the turns of that cycle aside): it decides whether a trip sets out, a caravan's hire, and
  the trouble's whole shape (`shape`: the halt's and the fight's length, a dive's end); the turns decide only who falls
  and how it went (`kind`, `dead`: a fated leader spared, the party stood).
- **A fight ended is never stood twice** (`roadFights.js` ENDED_MAX). A won or lost fight let go is not stood again for
  the rest of its window (a won fight's re-read halt ran past the one it was stood on).
- **Standing at the win.** The spared are those standing when the foes fall - every ally stood still on their feet, not
  only the members the road has alive at that minute: a fated ally stood before the road's minute for their fall was
  never spared (they died in the pure world though they lived beside the player), and their body was drawn beside them
  while they fought (`livingRoads.js` draws no remains of an ally stood in a fight).
- **The dead beside the player die at that minute** (`died`, the host's hand turn - LW7b's, for a friend). An ally cut
  down in a road fight or a dive was `fallen`, read at the trouble's own hour: a company met again below stood them up
  alive until then. And their body is the pool's own (a corpse to search, as a foe's) - the company's or the party's
  going took it out, and the deep's remains pass them by as the pool's.
- **One struck down on the road is never stood again** (`roadStands.js` `deadAt`): the roads' parties are read once a
  second, so a hostile cut down drew on the player again the next frame, and their party was turned twice.
- **The fight's own election** (the host's `owner(feet)`): the lowest id of those within LIVE_M of the fight - it was
  centred on each player, so a chain of three left the one beside it deferring to one too far to stand it.
- **A peer's fight** (`livingRoads.js`): its armed are the peer's allies, come through the stream - they were drawn here
  too, doubled. The unarmed are drawn as ever.
- **A halt past its leg's end holds the arrival** (`troubledTrip`): halted on the road and lodged in town at once, or a
  way home's halt cut by the party being home.
- **The memo's bound** (`livingMemoFresh`): only the towns' reader kept the trips' memo to its bound; a long stay below
  grew it without end.
- **The deep's end the dice's** (`troubledTrip`, a dive): a company whose fated leader the player spared comes out at the
  fight's end all the same (it dove on for its full hours and was met again); a company that made for the surface is
  not met again this visit (`dungeonDivers.js`).

## LW-FIX5 - the deep's four (2026-10-05)

The deep audit's deep and deed findings; each is fixed and pinned (`test/lwfix5_deep.test.js`,
`tools/mutants/lwfix5.json`).

- **A keepsake carried home** (`keepsake.js keepsakeFor`'s `homeOf`; `livingTown.js _homeOfPlace`). The deep's dead are
  travellers, minted off the town's row alone with no house: their keepsake named no home, and no household ever took
  it - LW6c's homecoming never happened for the one place keepsakes come from. A keepsake that names no home is matched
  by the home the town's census gives the place its id names (a newcomer's generation aside); one that names its house
  keeps it.
- **The remains lie till they are taken from** (`deepRemains.js` `here`; the host's `count` and seeded goods). A dungeon
  keeps nothing past its leaving (no scene cache), and the remains were marked laid as they were laid: they lay one
  visit, most often unfound, and never again. They are laid each visit until the player takes from them (fewer goods,
  or the pile emptied away) - then spent; their goods are rolled off their key, the same every time they are laid.
- **The turned watch followed by identity** (`livingWatch.js`, the two conversions' marks). The guard was marked with
  the struck body, which is the town's pool's and dressed again: a dead guard still wearing an old body's mark was
  found for the next watchman struck in that body, and he was counted slain the moment he was struck, his own guard
  alive. The mark is the body's `living` record as it was struck (minted afresh each time the pool dresses a body).
- **Their weapon and armour minted** (the host's lay). The remains' weapon and armour were raw templates - no name,
  value or condition set, as every other piece the port hands out has (`setItemFields`, `mintCondition`) - and the
  weapon could be a bundle of arrows. They are minted, and never ammunition.

## LW-FIX6 - the rooms' seven (2026-10-05)

The deep audit's indoor and host findings; each is fixed and pinned (`test/lwfix6_rooms.test.js`,
`tools/mutants/lwfix6.json`).

- **A player's own room stands nobody** (`worldModes.js` `ctx.ownedRoom`; the host's `building()`). DFU's AddPeople
  stands nobody in a house the player owns (the people gate's `isHouseOwned`, HOME1's homes anyone's) - the living world
  stood the census's household there all the same, among the player's things, talking and greeting every visitor. The
  room keeps the people gate's own answer (the player's house, an online home, a private room, a cabin), and the living
  world stands nobody in it.
- **The ways asked indoors** (the host's modal frame). The planner's budget was renewed only in the street's frame,
  below the modal return: a load made in a tavern or a dungeon asked two ways and then nothing all visit - every trip
  waited, travellers away stood in the room, lodgers never came, a dungeon's companies and remains stalled. The modal
  frame renews it too.
- **The room held under the talk** (`livingIndoorsStep(townTalk.overlayActive ? 0 : dt)`). The street holds its people
  under the talk window ("nobody walks away mid-talk"); indoors the raw frame ran, and one being talked to got up and
  walked off when their wait ran out.
- **The room laid out from the first door's landing** (`ctx.landing`, the host's `origin()`). The room was sounded from
  the player's feet: a load made upstairs measured that floor only (the drinkers about the rented bed), and another
  door, a load or a peer laid out other places and dealt everyone anew - against "alike for every reader". It is
  sounded from the landing of the building's first door (its block's own order), whichever door was taken; a first door
  with no floor at it, the door taken. Every door's landing is kept clear of the room's places (`waysIn`), as the way in
  always was.
- **A table empty as the round begins deals nothing that round** (`livingIndoors.js`). LW-FIX1 cached a table's deal
  only where someone stood as the round began: two stood together mid-round at a table that was empty (a coming held
  till the player looked away, the inside read on its beat) were dealt at once and began mid-script. They talk from the
  next round, as anyone who comes mid-round does.
- **A greeting's rest kept by the clock as it runs** (the room's, the street's `_greet`, the road's `greet`). The rests
  outlive a load: after loading an earlier save the clock stood before the last word, and those greeted kept silent until
  it passed the old minute plus the rest. A clock gone back forgets the rest.
- **The quest's people kept clear** (`worldModes.js interiorQuestFeet`, the host's `staticFeet`). The room's places
  kept clear of the building's own people but not of a quest's stood there, so a resident could stand on a quest's
  person and take their click.

## LW-PERF - the living world's cost (2026-10-05)

Mac: "how is performance after we integrate this?" - then "Do it". The living world's own script time a frame,
measured on V8 with the synthetic towns and map and Hazelnut's road bytes (`tools/livingPerfProbe.mjs`; no GPU, no
ARENA2 - its numbers are the CPU's, comparable before and after). Pinned by `test/lwperf_cost.test.js` and
`tools/mutants/lwperf.json`.

| | before | after |
|---|---|---|
| a great city's street (8x8 blocks, 299 people), any frame after the way in | 36-120 ms worst, 2-14 ms p99 | 2-5.5 ms worst, 2-3 ms p99 |
| the way into it (or a rest, a wait, a load there) | 275-420 ms at once | 10-15 ms, then frames of 7-9 ms for 1.5 s |
| every resident near the player on its morning street | 0.5-1 s | 1-3.5 s |
| a village's street (3x3), any frame | 2-6 ms worst | 1-3 ms worst |
| the roads, the read of the parties near | 5-10 ms once a second | 3-5 ms on the way in, then 0.3 ms p99 a frame, 2-3 ms worst |
| the deep's readers, once a second below | 1 + 3.5 ms | 0.03 + 0.6 ms |
| a whole town's day plans (the way in, the day's turn) | ~25 ms | ~4 ms |
| DFU's own pool on the same streets, for scale | 0.01-0.03 ms a frame, 1 ms worst | - |

- **The town's searches in slices** (`townPaths.js townPathSearch`, `createPathBook` `cells`/`run`; `livingTown.js`
  PATH_CELLS, ARRIVAL_PATH_CELLS). A walk across a great city's grid opens up to a hundred thousand cells (~25 ms), and
  the street's budget counted searches, not their size: a city's morning stood frames of 40-120 ms. A frame's
  searching now has its CELLS - PATH_CELLS (8000, ~2 ms on a desktop), ARRIVAL_PATH_CELLS (24000) while the street is
  stood on the way in - and the walks asked are queued and searched one at a time in slices, a resident on the street
  waiting on their next walk before the census's walks coming near, each frame spending what the asking left (`run`).
  Sliced or whole the answer is the same, cell for cell, as the search before LW-PERF (its reference in the test); the
  search itself is half again as fast (the grid's own bytes, a step's cost by table, no closures). One whose walk is
  still waiting is wanted on the street only once it is searched (wanted off its walk's start, its row stood out of the
  street's reach).
- **The arrival spread** (`ARRIVAL_SHOW_S`, 1.5 s). The way in stood the whole street in its first frame - every walk
  searched at once (0.3-0.4 s). It is stood over the frames of ARRIVAL_SHOW_S: a resident the census finds then comes on
  where the player sees, as the street was before the player came; after it, one whose walk came late comes on only
  unseen or out of a door, DFU's own hiding.
- **What is worked out once, kept** (`dayPlan.js favourites`, `trips.js townTrips`). A resident's favourite places are
  their seed's - kept by the town's places, and worked out off its doors by kind with the keys' order read once (the
  sorting of a great city's four hundred doors, a key compared as text in every comparison, was three quarters of every
  plan). A town's trips of a day are kept in the trips' book (`town:<mapId>:<day>`, never another world's or pace's):
  a minute's are those within a day of it, and its parties - the caravans, their trouble - are kept while the same
  trips are. The roads, the deep and the towns' visitors read every town near once a second; each read the whole
  roster, its caravans and its fates again. The book is made again with the trips (a turn, a load: `livingTurnsFresh`).
- **The roads read over a few frames** (`livingRoads.js` ROADS_TOWNS_PER_FRAME, ROADS_JUMP_PX; `trips.js
  partiesOfTown`, `remainsOfTown`). The parties and the fallen near are read again each ROADS_TICK_S a few towns a
  frame (12), the last read standing till the new one is done - whole only on the way in, after a jump past
  ROADS_JUMP_PX (a fast travel, a teleport), and after a deed on the road (the party walks on without the one struck).
- **The town's places** (`places.js streetNet`, the square, the exits). Paid once as a town streams in: the street net
  read off the grid's own bytes, the square's windows off the net's running sums, the four exits in one pass - the
  same places as before.
- **Two pins it blinded** (found at the merge with main, 2026-10-05: the branch's 918 mutants judged again on the
  merged tree - 911 dead, 5 equivalent as recorded, 2 survived, both LW-PERF's and neither the merge's: each survives
  on LW-PERF's own commit and dies on LW-FIX6's). LW1's favourites pin read the favourites twice off the same places,
  and the second reading was the kept one: a re-drawn seed (`LW1-favourites-daily`) passed it - it reads them off a
  second reader's own places now. LW-FIX4's remains pin ran two frames past the fall, inside the roads' read under way,
  where the old read stands: the skip it pins (`LW-FIX4-remains-drawn`) was never met - it waits for the read that
  lays them, and asks the road first that they lie there. Both dead now (and the 79 records naming either file). PIN
  MOVED: `lw1_livingWorld`, `lwfix4_turns`.

## The four hosts

- `scenes/world.js` - WIRED (LW2 the towns, LW3 the roads and the Overworld).
- `scenes/exterior.js` - FLAGGED: the fixed-city page keeps DFU's pool (its own doors and summaries are read at other
  seams; its town is not yet a LivingTown) and has no roads (one location, no map around it).
- `scenes/worldModes.js` - WIRED through the host (LW8): the building mode's press offers the room's residents to the
  street's own talk ray (`host.livingPersonsAct`) and its billboard pass draws them (`host.livingBillboards`); its HUD
  pass hands the room's talk its matrices (`host.livingSpeech`, LW8b); the
  street pool still answers nobody indoors (AUDIT 62 F14) and a building's static NPCs stay DFU's own.
- `scenes/dungeonContext.js` - WIRED through the host (LW6): its own loose stand (`spawnLooseFoe` allied, `removeLooseFoe`)
  and its abyss seam's `location()` (LW-FIX1) carry the companies met in it; (LW6b) its resting places (`restingSpots`) and its pile
  (`layRemains`, `pileNear`) the fallen of a dive; it keeps no town population.
