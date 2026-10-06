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
  palace and every traveller a house (an adventurer the tavern a quarter of the time) - LW-WALLS: of the buildings whose
  doors open onto the town's street, where the town knows them. Identity is `mintResident`'s:
  the climate's people (`raceOfPeople`), half female, an outfit of `PERSON_TEXTURES`, a face of
  `PERSON_FACE_RECORDS` + 0..23, a name on the region's bank (`residentName`), the watch GUARD_TEXTURE male outfit 0
  (RandomiseNPC's arms, every part); a temper (lark, day, owl) weighted by the job, three leanings (company, piety,
  drink), a class for the armed (an adventurer any of the eighteen, a sellsword the fighting seven, a courier the
  light three) and a level.
- **`places.js`.** The street net is the four-neighbour walkable component (`streetNet`'s labels) the most of the
  town's buildings open onto (`doorsNet`, LW-WALLS - not the grid's largest: a walled city's fields are). A door's
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
- **`dayPlan.js`.** The living day 04:00-04:00 (`DAY_START_MIN`), every minute covered once (WATCH-DAY: a day's
  watchman's walk out across the turn, `morningWalk`, the one entry both days carry). Wake and bed by temper
  (a lark 05-06 and 20-21, the day 06-07:30 and 21:30-23, an owl 08-10 and 00:30-02); the watch by shift
  (WATCH-DAY: `(slot + day) mod 4` - 06-14, 14-22, 22-06 over the day's turn, a day off; the first cut's `mod 3` kept
  06-16, 14-24 and nobody the night). The jobs' days as the code says them, the favourites (`favourites`:
  two social spots, a tavern, a temple, a guild and a market, near home, the seed's alone) set where; a stroll (two
  short stops) for the sociable; a lark's turn about town at first light. `schedule` lays them: each begins when the
  walk allows and not before its hour, nor more than its slack after; a stay ends by its `until`, by the walk home
  before bed, and before an away window's going; a gap longer than the walk home and back by `HOME_GAP` is spent at
  home, a shorter one going on at once and waiting at the next place (nobody lingers where a stay ended - a shop shut
  at six is left at six; the LW1 pins found the helper who stayed on); an away window (trips.js, LW3) is geared for at home `GEAR_MIN` where the traveller goes armed, walked out to
  arrive as it opens and home as it closes, each walk ARMED. A walk's minutes: the cells' Manhattan distance x
  `WALK_DETOUR` + `WALK_EXTRA_M`, over the pace.
- **`meetups.js`.** Rounds of `ROUND_S` (LW-TALK: 120 real seconds, each spot's on a phase of its own - the first cut's
  40 on one minute everywhere) laid on the clock; whoever stands at a spot for a WHOLE round pairs off on an order drawn
  from the spot, the round and their ids (the odd three together - `dealCircles`); LW-TALK: a circle's talk waits for its
  people to gather (`from`) and runs in exchanges (`circleSlots`, `exchangeAt`), `TALK_SHARE` of them spoken, a line each
  `CREW_LINE_S` of the clock, a dialogue between the exchange's opener and the rest; `circleStands` round the spot on the
  golden angle, `CIRCLE_APART` apart, facing in.
- **`lines.js`.** Original words in the crew's two-and-three-line shape: the town's talk, the trades', the weather's,
  the morning's, the day's (LW-TALK, the street's), the evening's and the night's; tokens with fallbacks; LIVING_GREETINGS
  by regard.
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
- **The circles.** LW-TALK: a table's company - those standing at it - meets from the minute it sat down as it is, a
  round of the street's at a time (`ROUND_S`, on the town's clock: `talkBeat`) while it stays the same, dealt as the
  street's circles are (`dealCircles` on `in:<building>:<table>:<the minute>`) and talking in the street's exchanges.
  One who comes while an exchange is on waits for its last line (the company there carries it); one who goes ends the
  talk at once. (The first cut dealt the tables on the street's own round by their stays: one come in mid-round met
  nobody till the next.)
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
  never a conversation re-dealt mid-script. (LW-TALK: the law kept by the company - one who sits down mid-exchange
  waits for its last line, and the new company meets after it.)
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

## LW-STAND - the street's own (2026-10-05)

Mac, from play: "I also noticed sometimes NPC's will get stuck over bodies of water, or be stuck running into walls".
Three causes in the town, each fixed and pinned (`test/lwstand_street.test.js`, `tools/mutants/lwstand.json`, 15
dead); the audit the same day (the last item) re-cut how a stand is found.

- **The street** (`places.js` `streetGeometry`, STAND_REACH_M). The street net's cells - a building's footprint and the
  water are none (`world/cityNavigation.js`), nor is the grid's outside - and a body the square of STAND_REACH_M
  (0.4 m) about its middle. A body stands where the square overlaps no cell off the net (`holds`); a straight way holds
  it where the square swept along it overlaps none (`clear`, and `reach`: how far along the way it does) - the off-net
  cells grown by the reach, against the way. Exact, so any part of a way the street holds it holds too. Pure in the
  grid: every reader's alike.
- **A stand is on the street** (`meetups.js` `aloneStand`, `circleStands`, `circleMiddle`, `openBearing`). The places
  about a spot - one alone 1 to 3.5 m out on a bearing of their own (ALONE_NEED_M, ALONE_FAR_M), each circle's middle
  further out as the circles number, a circle's places CIRCLE_APART/2 (0.625 m) about its middle - were drawn by
  geometry alone, and a spot stands a few cells before a door, or (LW5) at a port's dock on the water's edge: a stand
  fell in the building's wall or over the harbour, and the walker walked straight into it and stood there all its stay
  (a fisher's 450 minutes at the dock). Drawn so, at the law test's spot on the street's edge (a dock's, 6 m before a
  door; 120 alone and the circles 0 to 5 of two and of three, 150 stands) 67 to 72 of the 150 fell off the street; at
  the close-built town's own spots, 734 of 1650. Now a spot's open ground is sounded once: how far the street holds a
  body along each of STAND_BEARINGS (64) bearings, out to STAND_SOUND_M (16 m). A stand drawn on bearing `a` stands on
  the bearings that hold it - one alone their own distance (to the half-metre over), a circle its middle and a place
  beyond it - its share of the whole circle kept, so the people about a spot by a wall spread over its open half as they
  would over the whole circle; as far out as its own place and that bearing hold (STAND_MARGIN_M short of where it
  stops), facing the spot. A circle's middle stands so, and the circle is turned about it a twelfth of a half-turn at a
  time till every place in it is held and seen from the spot over open street, its people a pace apart facing the
  middle; with nowhere about it to turn, they stand along the way out to it, facing in. A spot open all round keeps every
  stand as drawn. Kept per spot: the street never changes under a town.
- **The way to a stand is over the street** (`livingTown.js`, the frame's approach). A body walks its last metres to
  its stand straight - from its walk's end, or from last round's place when the circles change partners. Where the
  street does not hold the straight way (`clear`: a new place round a building's corner, across a fountain) it walks
  toward the spot, and on from wherever the way opens.
- **A walk not yet searched is a pause** (`livingTown.js` `row.paused`). LW-PERF searches walks in slices: a resident
  in view whose next walk was not searched yet kept the stride it had and walked on the spot, into whatever it faced,
  till the path came - a second or more in a great city, longer while the queue is full. They stand, idle (the watch's
  own idle), and the pause's minutes are owed as the politeness gate's are, walked off at CATCH_UP: searched, the walk
  is walked from where they stood, never cut straight across, through whatever stood between, to where its clock had
  got to.
- **Measured and left.** The pinned close-built town's day (`lwstand_street`'s last test: its residents at 08:00,
  13:00 and 18:00, twelve seconds of frames each, the player where two streets cross): before, 34.4% of the
  body-frames in view stood off the street and 11.2% inside a building (20.5% and none at 08:00, 49.1% and 25.4% at
  13:00, 33.7% and 8.4% at 18:00); now none, at every hour. A walker catching up with its walk's point (the frame's
  straight approach) trails it by under 2.5 m. The street is the navgrid's, as DFU's walkers read it: what stands on a
  walkable cell without being on the grid is still walked through. Not the town's: the classic lane's pool (DFU's own
  walkers, kept 1:1).
- **AUDIT (2026-10-05).** The first cut sounded each stand out from its anchor along its own line, a quarter-metre
  (STAND_STEP_M) at a time, with four probes on a body's axes. A body stood over a building's corner the probes
  missed; samples a quarter-metre apart found shut a way they had passed as open, and a walker stepped on the spot
  between the two answers; and every stand whose line met a wall was pulled in toward the spot, so the many whose lines
  met the same wall stood on one another at its foot, and a circle's places on one another on its middle, facing north.
  With 30 alone and the circles 0 to 5 at a spot, the close-built town's spots stood 79 to 89 pairs of stands within
  half a metre of each other (26 to 29 within 0.1 m) and the edge spot 104 to 123; now 16 to 22 and 14, none within
  0.1 m (drawn over the whole circle, 8). At the close-built town's square (400 alone and the circles 0 to 15 of two
  and of three, 480 stands), 12 stands were never reached from the spot and 37 of 2995 ways from stand to stand never
  arrived, walked as the frame walks them; now every one, every step on the street. The exact street and the open
  bearings are the audit's. Mutants: 15 dead, the audit's 8 among them; the first cut's step-unread, end-only,
  middle-unkept, middle-unread and member-unseen retired with the soundings they aimed at; `tools/mutants/lw1.json`
  LW1-stand-apart re-aimed.

## LW-DRY - a party stops on dry ground (2026-10-05)

The same report's other half, on the roads ("stuck over bodies of water"). Pinned by `test/lwdry_ground.test.js` and
`tools/mutants/lwdry.json` (24 dead); PIN MOVED: `terrain` (WATER1's compare, its one home). The audit the same day
(the last item) re-cut the night and the trouble.

- **The cause.** A way is the planner's straight legs between its pixels' centres (`trips.js wayOf`), and the
  planner's water is a whole pixel's (`travelRoute.js` - a pixel whose WOODS byte is the sea's; the ends never asked).
  A pixel's ground is the kernel's interpolation with its own byte at its south-east corner, so by a coast a leg runs
  over the sea's edge - and nothing asked the ground where a party stopped: night camped it there for twelve hours,
  trouble fought it there (LW4b's foes stood in the water) and its fallen lay there a day. The feet are the scene's
  ground (`tvSceneOf`): on the seabed Deep Waters carves, or on the sea's clamp.
- **The ground** (`world/dryGround.js createDryGround`). The terrain cell under a point is dry when its four corners
  are - each the pixel's own sample (the sampler's kernel, `terrainSampler.js sampleKernel`, the samples the pixel is
  built from) above the tile job's water (`terrainTiles.js sampleHeight`, `isWaterHeight` - WATER1's float32 compare,
  one home now, the nature scatter's beach reads among its readers): no water shows on its tile. Pure in the height
  map, every client's alike. Read in the ways' own frame (`trips.js nativeDry`): x east, z north from the map's
  southern edge, a pixel's row 499 less.
- **A stop on dry ground** (`trips.js dryStop`, STOP_RING_N, DRY_STEP_N). A stop's middle and a ring of 5 m about it -
  past the widest ring the roads stand (a beset party's foes, `livingRoads.js FOE_RING_N`) - must stand dry; a stop
  that does not is sounded on along its way 2 m at a time to the first place that does. None before its leg's end: the
  leg's end, the town's own ground it was walking to.
- **The night** (`trips.js partyAt`). A leg is walked by day, 07:00 to 19:00. Where the day's walk stands at nightfall
  is sounded for the night's camp; a party on a wet stretch walks on at its pace to that dry ground and camps there, and
  the next nightfall is sounded from where the party then stands - at the camp, or still on its way to it - so a night's
  walk on is never undone. At first light it waits at the camp till the day's walk comes up to it, and walks on with
  it; a leg begun before first light (an adventurer sets out from 06:00) is a night's walk until then. One place a
  minute a leg: never a jump.
- **The trouble** (`trouble.js troubleOf`) is met on dry ground too: a stretch of the walk at the first dry place on
  from where it falls, met when the party walks up to it (`partyAt`'s own minute); none before the leg's end, at the
  end as the party comes to its town. A camp's is met at the camp night made - and its fallen lie there. A halted party
  stands idle in its ring (`livingRoads.js partyPlaces`, as a camp does), and the halt's minutes are owed from its start,
  walked off at HALT_CATCH_UP.
- **Measured.** At LW-DRY, the synthetic map with a wet band across its ways: 1440 camped minutes and 75 halted
  minutes in the water over twelve days with the ground unread, none read. Since the audit (below), on seven wet
  grounds offline and online, no jump and no stop in the water while dry ground lies ahead on its leg.
- **Left.** A location's flattening is not read (the ground beside a town is the kernel's), nor the Rivers and Streams
  mod's water, which a player switches on for themselves and would put the parties of two players in two places. A
  party walking a wet stretch still walks it - a ford, by day - and one whose leg runs wet to its end camps at the end,
  its town's own ground.
- **The four hosts.** `scenes/world.js` - WIRED: the trips' world's `dryAt` (`nativeDry(createDryGround(woods))`).
  `scenes/exterior.js` - FLAGGED: no roads (one location). `scenes/worldModes.js` and `scenes/dungeonContext.js` - no
  roads are stood there; the remains and companies they show are the same trips', read through the host.
- **AUDIT (2026-10-05).** The first cut sounded the night's camp afresh each nightfall from where the day's walk would
  be, and waited the morning out there. A wet stretch longer than a night's walk at online's pace (half the calendar's)
  put the party at the far camp at first light and back on its day's walk at dusk (422 m and 419 m); a camp's trouble
  at 23:00 stood the party at the camp before it had walked there (288 m, and 33 m back as it ended); a leg begun before
  07:00 on wet ground leapt to its camp at first light (246 m); a halt's minutes owed from its end jumped the party at a
  halt that ended near dusk; and the sounding's 8 m stepped over dry ground too narrow to find. On the audit's harness -
  the synthetic map under seven wet grounds (a band; one wider than four hours' walk; one wider than a day's; wet about
  every town; the destination's half; a narrow dry islet in a wide band; a band along a way's own row), twelve days
  offline and online, every minute of every trip that touches one - the first cut jumped up to 189 times a run, the
  longest 1237 paces, and camped 2880 minutes in the water with dry ground ahead on its leg (1440 at the islet); now,
  in all fourteen runs, no jump and none. The nature scatter's three beach reads (`terrainNature.js`) wrote WATER1's
  product out themselves, so its "one home" was two; they read `sampleHeight` now (`terrain` pins it). Mutants: 24
  dead, the audit's 8 among them; the first cut's morning-jump and morning-camp-behind retired with the morning they
  aimed at; `tools/mutants/forest1.json` FOREST1-beach-line re-aimed.

## HALT-ONE - the watch calls as one (2026-10-05)

Mac: "with the living world we take it further and improve the guards and also reduce the HALT noise" - and asked how
often the watch should call, "Once, then rarely". A recorded departure from DFU (Port-Ledger), the living watch's lane
alone (`livingWorldOn`: the enhanced skin with the Features row on); the classic lane keeps DFU's cadence, pinned
call for call.

- **The cause** (DFU-faithful, `characters/enemySounds.js`, EnemySounds.cs:78-100, 196-226). Every watchman within
  16 m of the player sounds his attract clock every 3 to 9 seconds, the bark 80% of the time - and the city watch's
  bark is "Halt!" (clip 456). Eight a minute a watchman, hostile or not; a crime's five, forty a minute; a squad
  arriving after its walk, four at once on one frame. The port added more mouths: the town's defenders (DISC19-F) and a
  raid's, who stand with the player; another player's watch riding the stream (WATCH1); the watch kept moving under
  the surrender box (WINFOE1); TELL1's stagger and TELL2's wind-up, both the bark pitched down; the siege's Town Guard,
  the bark at every wound.
- **The one voice** (`enemySounds.js WatchVoice`, HALT_GAP_S 15; `scenes/cityGuards.js` `oneVoice`, `windowUp`). A
  watchman standing after the player (`watchStands` - HowManyEnemiesOfType's own two terms: not a defender, not
  pacified or charmed, not running) inside the attract radius is a caller; his own clock is left still. The first of
  them calls at once; then the nearest calling, no sooner than 15 s after the last call - five watchmen, eight calls in
  two minutes where their clocks gave some eighty. Nobody calls under a window; the incident over (no watchman
  standing after the player) the next is met by its first call at once. The call is DFU's own play: at the caller's
  feet a metre up, a quarter through a wall (SetVolumeScale), linear to the attract radius.
- **The rest of the noise.** A defender, a pacified, running or walking-away watchman: silent. A watchman's stagger
  and wind-up are a person's (`hostCombat.js windupFeedback`, `tellCues`: the low swing, as every class enemy's) - never
  the Halt. Another player's watchman calls on his owner's client, where he hunts; here he is silent
  (`exteriorFoes.js`, `quietVoice`). The siege's Town Guard (`siegeNpcs.js`, the port's own) cries his move voice
  when hurt.
- **The four hosts.** `scenes/world.js` - WIRED (the street's watch: the lane and the window; the street's foe pool:
  the lane, for a peer's watchman). `scenes/worldModes.js` - WIRED (a building's watch, called in by a crime indoors).
  `scenes/exterior.js` - FLAGGED: the fixed-city page has no living town, and keeps DFU's watch. `scenes/dungeonContext.js`
  - no watch stands there.
- **Pinned** by `test/haltone_watch.test.js` (the voice; the real pool driven frame by frame against DFU's cadence; who
  calls; the incident and the wall; the tells; beyond the pool; the hosts) and `tools/mutants/haltone.json`.


## WATCH-FIX - the watch's own bugs (2026-10-05)

Mac: "improve the guards" - and every bug the investigation found in the watch fixed before the merge. Four, each at
its root; the classic lane's DFU watch is untouched but for the race (DFU's own order restored in both lanes).

- **A false slain** (`scenes/livingWatch.js`). The turned watch read ANY `dead` guard as a kill - and the crime
  watch walking off when the crime clears is `dead` with no body (`cityGuards.js`, DFU's despawn), as is a watchman
  run off by a beast or taken by a spell. So striking a watchman and paying the fine slew him by the player's hand:
  the palace household turned against the player and every witness counted a crime (`walkAwaySlain`, the
  investigation's: watchman `L12345.w0` slain, the courtiers and two of the watch at -75). The pin modelled the
  gone guard as `dead: false`, so the suite passed. Now the guard's END decides: a body the player's own blow made
  (`killedBy`, minted where a guard dies - DFU's `source == Player`, DaggerfallEntityBehaviour.cs:203) is the town's
  deed, `slain`; a body any other hand made (a beast, a fall, a reflected blow, another player) is one of the watch
  KILLED - dead for good, nobody's regard of the player moved (`livingTown.js killed`, the host's hand death
  `killed` - `relations.js HAND_KINDS`, read by `lives.js handDeath`, told by `lines.js KILLED_NEWS`, the watch's
  words or the town's); no body at all is BACK to his day.
- **The identity lost** (`cityGuards.js turnNpc`). Only the swing and the trample marked the guard they stood with
  its resident; the crime response's arms, the minute's sweep (MakeNPCGuardsIntoEnemiesIfGuardsSpawned) and the town
  watch's summons stood an anonymous Knight_CityWatch and the street took the resident for the day - cut down, he
  walked his beat the next morning. Every conversion is ONE LAW now - SpawnCityGuard then SetActive(false), the guard
  marked with the resident's identity as it was turned (`livingFrom`; AUDIT-C6's identity record) - and the host
  follows every marked guard, whichever arm stood it (`livingWatchStep`): the resident is LENT to it
  (`livingTown.js lend`: off the street, never taken for the day - the census's own take of the disabled row undone,
  whichever comes first), and comes back (`back`) when it walks away, the census standing him where his day has him
  out of the player's sight. One the witness arm took who is not of the watch (DFU's quirk: every walker after a
  guard has seen) stepped aside - his guard's end is never his death. A load keeps the mark by id (the snapshot's
  `living`, found again by `residentOf`; never found in WATCH_WAIT beats, let be).
- **The cap race** (`cityGuards.js inTurn`, `claimed`, the pool's `live()`). DFU's crime response is one synchronous
  member: the cap read (HowManyEnemiesOfType <= maxActiveGuardSpawns), then every guard stood. Here every stand awaits
  (CLASS18.CFG, a cold archive), so two calls interleaved: the second read the cap before the first's guards landed,
  and walked the same street turning the same walkers again - six watchmen out of three. The crime response, the
  sweep and the summons take turns now (a call whose world was swept while it waited stands nobody), a walker is
  claimed across the await (the swing's conversion and an arm's never turn him twice), and one the street already
  gave up (`live()`: the row inactive, or - the living town's - dressed since as another resident) is never turned.
- **Online, two of him** (`exteriorFoes.js`, `net/wire.js` LIVING_ID_RE, RELAY_VERSION world172). Another player's
  watchman rode the stream (WATCH1) while the resident he was walked the reader's street. The watch's record names him
  now (`lr`, the census's id); the reader's puppet carries it (`livingId`) and the host hands every town the set
  (`livingPeerWatchStep`, `livingTown.js peerLend`): off its street while the record stands, his row freed at once
  (the peer's guard stands where he stood), back when it goes. A relay before world172 drops the field, and the
  reader sees him twice, as before. Who the peer's guard fought, and whether he fell, is its owner's (LW0 decision 6).
- **The four hosts.** `scenes/world.js` - WIRED (the street's pool's `live()` and identity read; the follower every
  frame in the lane, its `resolve` and `localOf`; the town's `killed`; the peer's watch). `scenes/exterior.js` -
  WIRED for the race alone (its pool's `live()`; the fixed-city page has no living town). `scenes/worldModes.js` - no
  conversion: a building's watch comes through its door, its pool empty (PlayerEntity.cs:653-654).
  `scenes/dungeonContext.js` - no watch stands there.
- **Pinned** by `test/watchfix_watch.test.js` (the race on the real pool; the one law and whose hand; a load; the
  walk-away; the ends; a load's resident; the town's side; online; the hosts) and `tools/mutants/watchfix.json`.
  PIN MOVED: `lwfix2_watch`, `lwfix5_deep`, `lw7_deeds` (the first cut's model, `dead` read as a kill, and its
  wiring), and every relay pin to world172.

## WATCH-DAY - the watch keeps the town round the clock (2026-10-05)

Mac: "improve the guards" - asked which, the night watch, gate posts and pairs ("gate post per exit for shift, rest
patrol in pairs, uniform only on duty"). The first cut kept two shifts (06-16, 14-24) and a day off on a two-to-twelve
watch: from midnight to six nobody was on watch (the investigation's: none outdoors 01-03h); every watchman walked his
own beat of four to six spots drawn from the whole town alone - no posts, and two shared a stop in under 3% of the
samples; and off duty he walked the evening still in uniform and still a guard to the crime response and the watch's
stop, so at five in the evening more "guards" walked the street than mid-shift.

- **The watch** (`census.js` WATCH_COMPANIES, `watchShiftSize`, `townWatchCount`). Four companies, one to each day of the
  rotation, each of the town's strength a shift: none in a hamlet, one in a village, a pair from nine blocks and a
  gate's post for each nine more, to six (a pair and four gates) - four to twenty-four in all. Each watchman has his own
  clothes (`civvies`, one of his people's outfits, drawn on a stream of its own so the rest of him is as he was).
- **The duty** (`dayPlan.js` WATCH_SHIFTS, WATCH_ROTATION, `watchDuty`). A watchman's shift is a shift later each day:
  the day's 06-14, the evening's 14-22, the night's 22-06, then a day off - never a shift begun inside eight hours of
  the last one's end. The slots that share a residue are a company and stand every watch together. Its first two PATROL
  as a pair, one alone where the company is one; the rest are POSTED at the town's gates, one to an exit, the gate each
  keeps turning by the day; more than the gates patrol as a second pair.
- **The patrol** (`patrolBeat`, `patrolStops`). A patrol walks a district: four to six spots (exits, social spots,
  markets) nearest an anchor it draws, as a ring about their middle - the first cut's stops lay across the whole town,
  and in a great city a leg ran past an hour of the clock, so the beat ran out of reachable stops hours before its
  shift's end. Its stops are laid on the clock from the shift's start, so the two of a pair are at the same stop at the
  same minute wherever they live, and the last is held to the shift's end (two stops are never further apart than the
  walk home and back and `HOME_GAP`, so the long gap's rule never sends a patrol home mid-beat). On the street the second of a pair walks at the first's shoulder (`livingTown.js _atShoulder`, PAIR_SIDE_M to his
  right where the street holds it, to his left, else PAIR_BEHIND_M behind); at a stop the two stand together as any two
  met there do (meetups.js).
- **The post** (`'post'`, OUTDOOR). A gate's watchman stands it all shift, facing out of town (the exit's own yaw) when
  he stands alone.
- **The night over the day's turn** (`nightTail`, `schedule`'s `start`). The night runs past 04:00: the night's plan
  holds its post or its patrol's last stop to the turn, and the next day's begins THERE - read off the night's own plan
  (the first cut replayed the night's stops apart from it, and a man its clock had put elsewhere began the morning at a
  post he had left) - keeps the watch to six, walks home and sleeps the morning; up in the afternoon, the evening his,
  abed early for the morning's shift. A night watchman wakes late and keeps his afternoon before it. A town with no
  spots for a beat has nobody on watch at the turn: the morning begins at home.
- **The watch's clock** (`schedule`, `morningWalk`). Every watchman is on his post or his patrol's first stop by his
  shift's hour and keeps it to its end. Whatever his bedtime: a duty stay is never cut by the walk home before bed (the
  first cut's was, and on the synthetic town of eight blocks by eight - a walk across it near three hours - ten days
  cut 66 shifts short, and 34 times the night's man walked home before the turn while the next day began him at his
  post: a jump across the town). An evening off ends in time to change at home and walk out to the watch on its hour
  (a supper had the night's man late). And in a great city the day's watchman whose walk out is longer than the two
  hours from the turn to six leaves before the turn: his day off ends on the walk and his day begins on it, the one
  entry both days carry, so the town draws it unbroken across 04:00 (the first cut began him at his door at the turn,
  and half the day's watch came on up to 53 minutes late, the gate empty since the night's man went home at six).
- **The uniform on duty** (`duty`, the plan's marks; `livingTown.js` update; `travellerSprites.js`). The walk out, the
  watch or the post and the walk home carry `duty`; nothing else does, and a change of duty goes by home - into the
  uniform and out of it indoors (a stay at the same spot read as the watch had kept one man in uniform to the evening).
  The street dresses one of the watch by it - GUARD_TEXTURE and the guard's flag on duty, his own clothes off it - and
  never in the player's sight (a body not yet stood, or out of view); so off duty he is nobody the crime response turns
  or the watch's stop asks after. A room draws him in his own clothes.
- **The four hosts.** WATCH-DAY is the living world's core (`census.js`, `dayPlan.js`, `livingTown.js`) and the rooms'
  drawing (`world/travellerSprites.js`): `scenes/world.js` stands the street that dresses him; `scenes/worldModes.js`
  the rooms (LW8, through the sprites); `scenes/exterior.js` - the fixed-city page has no living town;
  `scenes/dungeonContext.js` - no watch stands there.
- **Pinned** by `test/watchday_watch.test.js` (the strength; the duty; round the clock; the night over the turn; the pair;
  the uniform; the post; a great city) and `tools/mutants/watchday.json`. PIN MOVED: `lw1_livingWorld` (the census's watch, the
  shifts), `lwfix3_town` (the beat to the shift's end), `watchfix_watch` (the census full, a returning resident comes on
  as the player turns; his patrol's mate a witness).
## LW-TALK - the town's people face one another and talk together (2026-10-06)

Mac: "I want to ensure everything is working with NPCs actually interacting with each other, talking, etc" - and asked
how two who talk should stand, "Turn them". The investigation measured the first cut on the synthetic towns, the
street and the rooms, and ranked what the player saw.

- **The facing** (`characters/residentWalker.js`, STAND_FRAME). DFU's idle record is one front view: every talker in a
  circle faced the camera, never the one they talked to (88,358 of 88,358 standing frames on the street, every frame
  indoors), and the watch at his post faced the street. A resident standing keeps the way they face - the walk wheel's
  record for their yaw against the camera, held on its STAND_FRAME (the walk sprite's still frame), flipped as the wheel
  is; the idle record is the politeness gate's alone, DFU's own use of it (one who stops for the player turns to face
  them). The living world's lane only (the classic walkers are DFU's own); Mac to confirm the frame in the game.
- **A round is a meeting** (`meetups.js` ROUND_S, `spotRound`, `dealCircles`). Two minutes, each spot's on a phase of
  its own: the first cut's 40 s re-dealt a busy square three times a minute (76-92% of its people had a new partner
  every round, walking up to 30 m to reach them) and every spot on the same minute (ten lines in one frame, then half a
  minute of silence - 73-82% of the day's seconds silent at the square).
- **The gathering** (`livingTown.js` `_tick`, `from`). A circle's talk waits for its people: from where the last round
  stood them (their place in its circle, else their own about the spot) to their place in this one, the farthest of
  them at the walking pace, and GATHER_BEAT_S after. The deal and the walk are the plans' alone, so every reader
  gathers alike. (22-84% of the first cut's lines, by hour and town, were said while their circle was still walking
  together.)
- **The exchanges** (`circleSlots`, `exchangeAt`, `slotSpoken`, `exchangeScript`). A meeting talks in exchanges: a script
  a slot of SLOT_LINES lines' time, the first OPEN_S into the talk, each next PAUSE_S after the last - each circle's own
  draws - none begun that the round's end would cut (CLOSE_S); TALK_SHARE of the slots spoken, the rest quiet spells
  (the first cut stood whole circles quiet a whole round). A script is a DIALOGUE: the slot's opener, turning slot by
  slot, says its even lines and the others answer in turn - a third line is the opener's (in a trio, the third answers
  the fourth). It is drawn as its exchange begins - the hour it began, the opener's trade first - and kept to its end
  (the reader's `memo`: a change of weather mid-script swapped it 916 times in 2000), and never the script the circle
  said last.
- **Said aloud together** (`livingTown.js speech`, the street's keep, `keepUnits`). A circle's line is said aloud only
  while every one of it stands at their place on this street, and the street keeps a circle whole - its people come on
  together, nearest first, or wait together (at a busy square 58 of 77 lines went to a partner the street had not
  stood, 44 of them for the cap). A circle counts TALK_PULL_M nearer than its nearest one - the ring the ones alone at a
  spot stand in (meetups.js ALONE_FAR_M), beyond which its circles stand: nearest alone, the busiest square at six in the
  evening kept the ones alone about it and fell silent (10.5 lines a minute, 63% of its seconds). Nothing else orders
  it: put first, those already on the street held every row from the nearer (a walk passing beside the player never
  came on, nor a watchman back from his guard - LW-FIX3's, LW-PERF's, LW2's and WATCH-FIX's pins), and those in the
  player's sight let one go who stood just behind him (WATCH-DAY's). The census deals the circles before it reads where
  anyone stands - read before them, an arrival stood the street by the last scene's circles and let half of it go a beat
  later (12 of the 24 at the synthetic square at six) - and the taken and the dead leave the street at once, in the
  player's sight or not (marked to go, one struck down stood where the player looked till he looked away). DFU's hiding
  has one home (`_hidden`). Where the cap and the hiding law (nobody comes on in plain sight) leave one of a circle off
  the street, the circle stands silent; on the synthetic towns 70-100% of the lines due near the player are heard - the
  least at the close-built town at six in the evening, its cap of 24 under the square's crowd.
- **Every reader deals alike.** The deal is the plans': one taken off this street alone (the trample) or struck down
  here is dealt and left out after - their partner to their own counsel, the spot's other circles as every reader has
  them (the first cut dealt the street's own, and one gone re-paired the whole spot on that reader, round after round).
- **The rooms** (`scenes/livingIndoors.js`). A table's company meets from the minute it sat down as it is (see LW8b);
  one who comes while an exchange is on waits for its last line; its people stay put while an exchange is on and
  through their first round together (one in a quiet circle got up mid-talk; a temple's two parted the moment their
  talk ended, one three-line talk in three quarters of an hour).
- **The word to the player** (`livingTown.js _greet`, the rooms'). One who kept quiet as the player came by speaks when
  the player stops before them: the quiet pass took the rest, so the stop that rule waits for never came (0 of 298
  strangers held before the player spoke). A word said rests GREET_REST_MIN. In a room a stop is the player standing still
  within the street's idle distance (the first cut never asked).
- **The words** (`lines.js`). {place} is a town of the town's road - its trips' towns, the host's word (`places`), the
  exchange's draw (eight scripts always said "the next town"). The morning's greeting and the day's talk keep their
  hours, on the street ("Morning" was heard at six in the evening, and by the night watch); a trade's pool is the
  trade's once however many share it, and the commonest trades have six scripts (two homemakers drew their one script
  half the time: "The baker's bread is getting smaller." opened a fifth of the town's talk, "Hauled stone since dawn."
  a sixth); the morning's, the day's, the evening's and the night's pools wide enough that no opener is three in a
  hundred of a day's. A third line that undid its question is the asker's comeback now.
- **The road's parties** (`scenes/livingRoads.js`) talk in exchanges from their round's start (nobody gathers: a party
  walks together).
- **The four hosts.** `scenes/world.js` - WIRED (the street's town; the towns of the road for {place}).
  `scenes/worldModes.js` - WIRED (the rooms, through `livingIndoors.js`). `scenes/exterior.js` - FLAGGED as LW2 has it:
  the fixed-city page keeps DFU's walkers. `scenes/dungeonContext.js` - no town.
- **Pinned** by `test/lwtalk_town.test.js` (the facing; the meeting; the exchanges; the street; every reader alike; the
  word to the player; the words; the hosts) and `tools/mutants/lwtalk.json`. PIN MOVED: `lw1_livingWorld` (the meeting's
  phase and exchanges), `lw2_livingTown` (the gate's idle record; the churn under a cap waits on a round's turn),
  `lw3_roads` (an armed traveller standing: the class sprite's idle, the outfit's own on the wheel),
  `lw4_trouble` (the news told in an exchange; the talk's context; the host's word), `lw7_deeds` (the deed told in an
  exchange), `lw8b_talk` (a table's company; the street's words reference), `lw8c_astir` (a room of no talk has no
  beat; a company stays put), `lwfix1_review` (never re-dealt mid-script, by the company), `lwfix6_rooms` (an empty
  table's two meet at once), `lwstand_street` (a body paused on its walk stands on the wheel's still frame).

## WATCH-KNOWS - the watch knows you (2026-10-06)

Mac: "improve the guards" - asked, "The watch knows you": guards greet or warn the player by their legal standing, and a
first minor offence draws a "Hold!" warning before an arrest. The investigation found no greeting that read a legal
standing (the REP1 stop was the only time the watch spoke by it, and only to a known criminal): a watchman on duty
greeted the player with the street's stranger lines, and the watch came for a pocket picked as for a murder - the
arrest box at its first blow. The living world's lane only (`livingWorldOn`); a recorded departure (Port-Ledger
WATCH-KNOWS) - classic play keeps DFU's watch.

- **The watch's word** (`lines.js` WATCH_GREETINGS, `watchBand`; `livingTown.js greetingFor`). One of the watch on duty
  speaks for the law: the player's standing with the town's region (the host's `legalStanding(region)` - its number,
  and whether its watch knows them, standing.js knownCriminal), not his own regard. Above 40 honoured, by name; above
  10 respected; 0 to 10 a common citizen - moved along, now and then, as a stranger speaks; below 0 watched; a known
  criminal (under -10, or banished) told the watch knows their face, whatever the number says (the REP1 stop still asks
  them every two hours). One with a grudge of his own stays cold; off duty, or indoors, a townsman.
- **The first minor offence** (`standing.js` WARNABLE_CRIMES, `warningDue`, `noteWarning`; `arrestFlow.js onGuardHit`). A
  door tried, a trespass, a night in the street, a pocket picked - the court's least (BASE_PENALTY 100-300, none marked or
  banishable). The watch comes as ever; its first blow, for a minor crime the character was never warned for in this
  region and no known criminal, is withheld, and the box is a word: "Hold! {crime} is against the law of {region}. This
  once, you have a warning. The next time, it is the court." The crime is charged as the box would have (`chargeOnce` -
  the law's notice says what it cost), the warning noted in the standing book (`warned`, saved with it), and the crime
  let go - the watch walks off with it (cityGuards.js's crime-clear law). The next minor offence in the region, a worse
  crime, a known criminal, a beast (WERE-FRIGHT's own box) and a chase the box already asked in are the box's.
- **The four hosts.** `scenes/world.js` - WIRED (the living town's `legalStanding`; the arrest flow's `warnsFirst` -
  `livingWorldOn` - the region's name and the world's calendar a banishment runs on). `scenes/worldModes.js` - WIRED (a
  building's watch strikes through the host's arrest flow). `scenes/exterior.js` - FLAGGED as LW2 has it: the
  fixed-city page keeps DFU's watch (its arrest flow hands no `warnsFirst`). `scenes/dungeonContext.js` - no town.
- **Pinned** by `test/watchknows_watch.test.js` (the word by the law; the first offence warned; the hosts) and
  `tools/mutants/watchknows.json`.

## WATCH-PROTECTS - the watch protects the town's people (2026-10-06)

Mac: "improve the guards" - asked, "The watch protects people": a monster attacking townspeople draws the watch to
defend them. The investigation found no townsperson a monster could attack: DFU's enemy senses weigh other enemies and
the player alone ("Civilian Mobile NPCs are not handled here", EnemySenses.cs:739-741), and the port's target machine
with them (`enemyTargets.js getTargets`) - a wolf in the square walked through the crowd to the player, and the town's
people stood on beside its fight; the watch's defenders came to a monster hunting the player or one of themselves
(DISC19-F, `townWatch.js isTownThreat`). The living world's lane only (`livingWorldOn`), on the street; a recorded
departure (Port-Ledger WATCH-PROTECTS) - classic play keeps DFU's street.

- **The quarry** (`quarry.js` makeQuarry; `world.js livingQuarry`). Each of the living town's people on the street, none
  of the watch, stands for the target machine as a body of their own at their feet - a `civilian`, QUARRY_HEIGHT tall,
  one health - in the shared candidate list beside the foes and the watchmen; the dead let go.
- **Who hunts them** (`enemyTargets.js huntsCivilians`). A hostile monster that fights hand to hand - never the watch,
  an ally, a companion or a quest's foe; never a class (a man with a blade is no monster); never an archer or a caster,
  whose arrow or spell meets foes and players alone (nothing on the street would stop one). The machine weighs a
  townsperson for it alone, as near as the player and no likelier: no team's chain, and no "has no target" weight (a
  townsperson never has one) - whatever the infighting setting.
- **One blow** (`QUARRY_BLOW`; `exteriorFoes.js`'s non-player arm). The first blow a monster lands strikes a townsperson
  down, whatever it would deal - as the player's first does in DFU (WeaponManager.cs:500-509, `cityGuards.js
  resolveCivilianHit`); its sound and blood as any blow's. The town is told by `killed` - another hand: nobody's regard
  of the player moves (LW7) - and the body leaves the street at once.
- **The watch comes** (`townWatch.js isTownThreat`). A monster hunting a townsperson alive is the town's threat as one
  hunting the player is: the watch's defenders come to it after the arrival's countdown (DISC19-F); one struck down is no
  fight to come to.
- **The street runs** (`livingTown.js _fright`, `_run`; the host's `dangers` - its foes alive and hostile, no ally or
  companion, in the town's frame). One on the street a hostile monster comes within PANIC_M (10 m) of runs straight from
  it at FLEE_SPEED - twice their walk, their legs at the run's cadence (`residentWalker.js pace`) - along a wall where the
  street will not hold the straight way, never through it; no farther than FLEE_FAR_M (20 m) from where they took fright
  (inside SNAP_M, so their day takes them up again on foot, never with a jump), and there they cower. Their day is held
  while they run - its minutes owed, as the politeness gate's - and taken up from where they ran to; they keep clear,
  standing, while the monster stands within FLEE_WARY_M (20 m - never their day back to it), and FLEE_HOLD_S (4 s) after
  it is gone. Frightened, they stop for nobody (the politeness gate is a walk's), greet nobody (a word said unseen would
  rest them past it) and say nothing - a word up before the fright goes with it, and a circle with any of it frightened
  is silent; a frame the clock stands still (a talk window open) keeps the fright as it was.
- **The four hosts.** `scenes/world.js` - WIRED (the street's people in the shared candidate list, `livingQuarry`; the
  street's `dangers`, `livingDangers`). `scenes/exterior.js` - FLAGGED as LW2 has it: the fixed-city page keeps DFU's
  street (no quarry, no dangers). `scenes/worldModes.js` - none: indoors the street's people are nobody's quarry
  (`livingQuarry` is the exterior's alone). `scenes/dungeonContext.js` - no town.
- **Pinned** by `test/watchprotects_watch.test.js` (who hunts; the one blow; the watch comes; the street runs, cornered,
  chased; the frightened silent; the run's body; struck down; the hosts) and `tools/mutants/watchprotects.json`.

## LW-WALLS - the city behind its walls (2026-10-06)

The field (MD-Geist on the Discord: "In Ripmarket (Daggerfall Province) the last few days there have been 0 NPC's
walking around in the city...Tested on clear days and rainy no change"), and the ask that brought it: "Seems like with
living world, a lot of towns are unpopulated". Measured on the game's own data: the streaming host's build of each town
replayed in Node (`layoutLocation`, the navgrid off each block's automap and ground, every model's static doors in the
location frame, the buildings' summaries - the population block's own text, pinned) and its living town run on it.

- **The cause** (`places.js townPlaces`). The town's street net was the grid's LARGEST walkable component (LW1). A
  walled city's wall is covered navgrid cells, and so is each of its gates: the gate model's automap footprint closes
  the passage (DFU's own walkers, spawned about the player, never need to cross it). So the streets inside the walls and
  the fields about them are two components, and the fields are the larger in 407 of the game's 410 cities - Ripmarket
  (6x7 blocks): 77,611 cells of field to its streets' 57,539. The town was laid on the fields: 4 of Ripmarket's 369
  buildings with a door had their spot on the net, every one of its 305 people was homed off it, and a home off the net
  is home all day (`dayPlan`'s "a home off the net: always in") - a street with nobody on it at every hour, in every
  city of the game but its three greatest (Daggerfall, Wayrest and Sentinel, 8x8, whose streets are the larger). The
  hamlets and villages have no walls (one hamlet parts in two - below).
- **The street the doors open onto** (`places.js doorsNet`). The town's street net is the walkable component the most of
  its buildings open onto - each building once, by any of its doors, each door found by its own law on any walkable cell
  (`doorCell`: out along its normal, the other way where the normal faces in, else the nearest within DOOR_RING); the
  larger on a tie, then the first labelled; a town whose doors reach no street keeps the largest. Ripmarket's street is
  its streets: every one of its 369 buildings with a door has its spot, its square stands at its middle, and its four
  exits stand in its four gates' passages on the inside of each gate (the gate's footprint ends the street there; each
  exit within four cells of its gate model) - where travellers go out and the watch keeps its posts. At midday its
  street is full to DFU's cap (48). Over the game's 410 cities, at least 99% of each one's buildings with a door have
  their spot, and at least 80% of its people are homed on its street (97% of them all). Measured against the street
  that would give the most buildings their spot (each door counted for every component its law reaches), the vote
  gives as many in every one of the game's 9,373 populated places, and never fewer than the largest did.
- **The watch lives on the street** (`census.js townCensus` `opens`; `livingTown.js`). The watch lived at the palace,
  and in 14 of the game's 322 cities with a palace (Sentinel among them) the palace stands in grounds of its own,
  walled, its gate closed: its door opens onto its grounds alone, and the whole watch - sixteen to twenty-four - stayed
  home with it (WATCH-DAY's shifts, posts and patrols walked by nobody); elsewhere a watchman whose house had no door on
  the street stayed home (756 of the 22,716 in every populated place). The living town numbers its people knowing its
  street: the watch's and every traveller's home is a building whose door opens onto it - the palace where it does, else
  a house (the slot's own pick among those), an adventurer's tavern among those too. None of the 22,716 is homed off it
  now. A household keeps the house it is minted from: its slot is its identity, the key its regard is saved under.
- **Left.** A building whose doors open off the street keeps its people in (LW1's rule, kept): a palace's court in its
  walled grounds, and the households the census mints in the doorless houses of a graveyard's or a palace's block (a
  House5 with no door - 45 of Cerettunia's 298); to bring them out the census would mint other slots and re-key every
  character's regard, which is Mac's call. A farmstead's house stands deep in its own automap lot (Old Bazsa's Farm: a
  25x18-cell footprint, its doors six cells and more inside it, past DOOR_REACH_M and DOOR_RING): in 189 of the game's
  1,841 farmsteads no door reaches the street, and the family keeps in where DFU's walkers would wander - the same rule,
  not changed here. A hamlet its own ground parts in two (Cathing, 2x3: 7,533 cells and 7,342) walks the half the more
  of its buildings open onto (37 of 70: 76 of its 135 people homed on its street, 56 before); the other half keeps in.
- **The four hosts.** `scenes/world.js` - WIRED: the living town it stands (LW2) lays its street on the doors' component
  and numbers its people knowing it - no host change. `scenes/exterior.js` - FLAGGED as LW2 has it: the fixed-city page
  keeps DFU's pool. `scenes/worldModes.js` - through the town (LW8): a room's people are the same census's.
  `scenes/dungeonContext.js` - no town.
- **Pinned** by `test/lwwalls_city.test.js` (the doors' street - smaller or not, a building once, the ties, no doors;
  the synthetic walled city, `test/lwTown.mjs walledTown`, its streets and fields, doors, gates and square, its street
  by day and the farmhouse in its fields; the watch at doors onto the street; the host's build replayed word for word;
  and, where ARENA2_PATH names the data, Ripmarket and every one of the game's 410 cities) and
  `tools/mutants/lwwalls.json` (13, all dead without the game's data). PIN MOVED: `tools/mutants/lw1.json`
  LW1-normal-never-reversed and LW1-net-unread re-aimed by content (`doorCell`).

## LW-SPACE - nobody inside another (2026-10-06)

Mac: "I notice NPCs and walk stuck inside each other". Measured on the game's own towns (the streaming host's build
replayed in Node, as LW-WALLS reads it, and each living town run on it with the player at the square - the table
below): at midday and in the evening 12-54% of the bodies in view stood within half a metre of another, and pairs
walked inside each other for seconds on end. DFU's walkers keep off one another by the tiles they
claim (`mobilePerson.js _setTarget`, CityNavigation's Occupied flag, MobilePersonMotor.cs SetTargetPosition); a
resident claims none (LW2: its day lays its walk), and nothing else kept them apart. Three causes, each fixed at its
root (`test/lwspace_street.test.js`, `tools/mutants/lwspace.json`).

- **Those alone at a spot** (`meetups.js aloneStands`, SPACE_M, SPACE_STEP_M, SPACE_FAR_M; `livingTown.js _spaceAlone`).
  One alone stood at a place drawn off their id - a bearing and a distance, 1 to 3.5 m out (LW-STAND) - so at a busy
  spot many stood on one another (the birthday problem: forty alone at the synthetic square, 25 pairs within SPACE_M),
  and on the circles about it. Now each one alone stands at their own place where it keeps SPACE_M (0.9 m: a body's
  breadth and a hand) from every place already taken - the round's circles', and those alone there before them - else
  at the nearest free place about the spot (their own distance and then a step nearer and farther, their own bearing
  and then a step of arc either way), on the street and seen from the spot. By the plans alone, every reader alike: one
  whose stay holds them there and no circle does, and one on their way to a stay there (their place kept for them as
  they come - an early arrival on a reader that had searched its path stood unplaced a beat); the first bound for it
  first (since they set out for it, through every stay there since - a stall, then the talk), so no newcomer takes the
  place of one already there or on their way.
- **The round's circles laid together** (`meetups.js circlesStands`). Each circle was drawn by itself onto the spot's
  open bearings (LW-STAND), and in a lane, whose few open bearings every circle is turned onto, two circles stood inside
  each other (the close-built town's crossing at six: a pair of places within half a metre a frame). A round's circles
  at a spot are laid together, in the deal's order: each at its own places where every one keeps SPACE_M from the
  circles before it, else about the nearest middle whose places do, turned to fit - on the street, seen from the spot,
  a pace apart facing their middle. A member's place is the laying's (`_inCircle`'s `place`), the gathering's walk
  (LW-TALK `from`) read off it.
- **A company leaving together walks in file** (`livingTown.js _fileOf`, `_walksFrom`, FILE_MIN, FILE_M). A shop's two at
  noon, a table's drinkers on the hour, a household out at its evening: walks from one place begun within FILE_MIN
  (a quarter of the clock's minute) of each other walked one A* line at one pace, inside each other the whole way (the
  game's towns at one: up to 7.9 pairs a frame of the walking). They walk it in file, each FILE_M (1.2 m) behind the
  one before - the earlier first, on a tie the lower id - read off the day's whole census and its visitors (every
  reader's company is the same). A patrol's pair walks its own way (WATCH-DAY: at the shoulder) and is in no company.
- **A walker steps aside** (`livingTown.js _dodge`, DODGE_AHEAD_M, DODGE_SIDES, DODGE_SPEED, DODGE_SETTLE_M; the row's
  `side` and `halt`). For whoever is in its way - one standing (a circle, one alone, one the politeness gate holds), one
  coming the other way or across within DODGE_AHEAD_M ahead (or between its body and its day's place, which a walker
  catching up trails), or one going its way that it is inside of (the lower id keeps its line, the other steps round) -
  it steps to the nearest of DODGE_SIDES (up to 1.35 m either side) that keeps SPACE_M from all of them and that the
  street holds, the right before the left (two coming at each other both keep right), at DODGE_SPEED, and back to its
  line once the way is clear. One walking up to its stand steps aside till DODGE_SETTLE_M off it; one held stands.
  Drawn only: the day is the plans' (every reader's alike), the step aside - a few hands' breadth - this reader's street.
- **Measured** (`tools/livingCrowdProbe.mjs` - each town as the streaming host builds it, `test/lwRealTown.mjs`, run
  twenty seconds a frame at a time with the player at its square; the share of the body-frames in view within half a
  metre of another, before / after):

  | | 08:00 | 13:00 | 18:00 |
  |---|---|---|---|
  | Ripmarket (6x7) | 7.1% / 0.1% | 29.9% / 0.0% | 30.8% / 3.0% |
  | Wayrest (8x8) | 0.2% / 0.0% | 27.4% / 0.1% | 16.1% / 0.4% |
  | Daggerfall (8x8) | 6.4% / 0.0% | 19.5% / 0.4% | 12.0% / 0.2% |
  | Tuntale (6x7) | 1.9% / 0.4% | 14.8% / 0.0% | 25.6% / 0.8% |
  | Bubyrydata (4x3) | 0.2% / 0.0% | 54.2% / 0.0% | 29.2% / 0.0% |

  Two inside each other a second and more: 1-11 pairs a run before, none after. The rest is walkers through a crowd
  with no way round it - Ripmarket's square at six, forty-three of the town about one point (LW-SPREAD's). The
  synthetic towns' day at eight, one and six: 34.7% of the open town's body-frames and 51.5% of the close-built town's
  before, none and 0.2% after (the close-built town's walkers 0.6%, 3.1% without the step aside).
- **The four hosts.** LW-SPACE is the living town's core (`meetups.js`, `livingTown.js`): `scenes/world.js` stands the
  street it runs (no host change); `scenes/worldModes.js` - the rooms keep their own places (LW8, `livingIndoors.js`
  INDOOR_APART_M, never on one another); `scenes/exterior.js` - FLAGGED as LW2 has it: the fixed-city page keeps DFU's
  walkers, who claim their tiles; `scenes/dungeonContext.js` - no town.
- **Pinned** by `test/lwspace_street.test.js` (the alone places' law; the town's day - apart, alike on two readers, kept
  as others come; the circles laid together, and those alone about them, in the close-built town's lanes; in file and
  its chain; the step aside - round one standing, two coming at each other, two going one way, the trail, the stand and
  the hold; the street through the day; and, where ARENA2_PATH names the data, Ripmarket, Wayrest and Daggerfall at one
  and six) and `tools/mutants/lwspace.json` (21, all dead). `test/lwRealTown.mjs` is LW-WALLS's replay of the
  streaming host's build, moved out of its test for the probe and the pins that read the game's towns. PIN MOVED: `lwstand_street`
  (a circle member's place the laying's), `lwtalk_town` (the gathering's walk off the laying); `tools/mutants/lw2.json`
  LW2-facing-dropped, `lwstand.json` LW-STAND-host-unkept-circle and LW-STAND-way-straight, `lwtalk.json`
  LW-TALK-deal-from-street and `watchday.json` WATCH-DAY-no-shoulder re-aimed by content (5, all dead).

## LW-SPREAD - the town gathers in many places (2026-10-06)

Mac: "in towns some NPCs can group up too much when talking to each other. Almost like they are all situated in one
place". Measured on the game's own towns (LW-SPACE's probe, `tools/livingCrowdProbe.mjs`): at six in the evening 99-161
of a town stood out of doors at 8-28 spots, 30-64 of them about one point - the square's (Bubyrydata: 64 of its 161, at
eight spots); through the day, the most of a town at one spot was 41 on average over a sample of thirty-four towns, and
70 at the most - Kirkcester's every homemaker at its one shop's front at twenty past nine. Three causes, each fixed at
its root (`test/lwspread_town.test.js`, `tools/mutants/lwspread.json`).

- **The square was one point.** Six in ten of a town kept it for their first social spot (84-85% for one of their two),
  and every stall stood there, a mercenary's morning, an adventurer's afternoon, a visitor's and a courtier's talk. The
  square is ground now: its POINTS (`places.js` `squares`, SQUARE_REACH, SQUARE_GAP, SQUARE_OPEN, SQUARE_POINTS) are its
  own spot and the most open street cells about it - within fourteen cells of it, six apart, three quarters as open,
  seen from it over the street (`netLine`), to five - and each resident keeps to their OWN point of it (`dayPlan.js
  squareOf`, their seed's alone, the same every day). Whatever takes one to the square takes them there (dayPlan's
  intents): a stall, the talk, the market, a stroll's stop, a labourer's job, a beggar's pitch - the watch's beat aside,
  its stops a patrol's pair's.
- **A town's people kept to a few spots.** A resident's two social spots were of the two nearest home of the spots before
  the taverns, temples, guild halls and the palace - five in a town of nine blocks - and the square. A town has its
  CORNERS now (`places.js` `corners`, CORNER_MARGIN, CORNER_OPEN, CORNER_GAP): each block's most open street cell inside
  its margin, as open as six tenths of the square, sixteen cells from every social spot, every point of the square and
  every corner before it - where a neighbourhood gathers. The favourites (`dayPlan.js favouritesNow`, SQUARE_LIKE,
  SOCIAL_NEAR): two social spots of the SOCIAL_NEAR (three) nearest home, the corners among them and the square where it
  is near, and the square from anywhere for SQUARE_LIKE (a fifth) of the town; the market of the three nearest of the
  shops' fronts and the square's points (the more points, the more of the market the square's); every spot's key breaks
  a tie of nearness (`doorKinds` rank, the corners and points among them). A stroll's stops are the corners' too, and a
  stall-keeper's stall (a crafter's, a fisher's) at the square or at their market.
- **The town went out on the hour.** Everyone's evening at six (a homemaker's and a sailor's at half past), and the
  morning's market within one hour (08:30-09:30). Each goes out for the evening at their own minute now, over
  EVENING_SPREAD_MIN (75) after its hour, and to the morning's market at their own hour within MARKET_HOURS
  (07:30-10:30) - drawn of the day's seed, as every hour of a plan is.
- **LW-SPACE's hold, audited.** Held by the politeness gate, a body stood still only where it stood on its walk's point:
  one trailing it (catching it up, or round one in its way) walked up to it while held, and one held aside drifted back
  to its line. The gate's hold is whole now: held, it stands where it is (`livingTown.js` update - DFU's walker idles on
  the spot), aside or not (`_dodge`: held, its side kept).
- **Measured** (before / after; `tools/livingCrowdProbe.mjs`):

  | evening (six before, seven after) | out of doors | at spots | the most at one | inside another |
  |---|---|---|---|---|
  | Ripmarket (6x7) | 135 / 121 | 21 / 40 | 43 the square / 9 a corner | 3.0% / 0.1% |
  | Wayrest (8x8) | 107 / 92 | 25 / 48 | 34 the square / 6 the square | 0.4% / 0.1% |
  | Daggerfall (8x8) | 99 / 103 | 28 / 49 | 30 the square / 6 a point of it | 0.2% / 0.1% |
  | Tuntale (6x7) | 126 / 123 | 21 / 41 | 38 the square / 8 a corner | 0.8% / 0.0% |
  | Bubyrydata (4x3) | 161 / 138 | 8 / 22 | 64 the square / 17 a corner | 0.0% / 0.0% |

  Read at seven after: the town goes out for the evening from six to a quarter past seven now. Over the day
  (07:00-22:00, every ten minutes, by the plans; `--crowds`), the sample of fourteen cities, ten villages and ten
  hamlets: the most of a town at one spot 41.1 on average and 70 at the most before, 11.6 and 24 after (Kirkcester's
  morning market at its square's three points); the square's people at their most 40.4 on average before (at its one
  point), 27.4 after (over its points). The synthetic towns: the most at one spot 30, 63 and 90 before (all at the
  square), 11, 16 and 26 after; the square a favourite of 84-85% of a town before, 26-38% after.
- **The four hosts.** LW-SPREAD is the living town's core (`places.js`, `dayPlan.js`, `livingTown.js`): `scenes/world.js`
  runs the town it lays (no host change); `scenes/worldModes.js` - the rooms keep their own places (LW8, untouched);
  `scenes/exterior.js` - FLAGGED as LW2 has it: the fixed-city page keeps DFU's walkers; `scenes/dungeonContext.js` - no
  town.
- **Pinned** by `test/lwspread_town.test.js` (the square's points - and a plaza behind a wall within its reach none of
  them; the corners - and a plaza across two blocks' border one of them, a lane none; one's own point; the favourites -
  the same whatever order the town's spots stand in; the day - whatever takes one to the square their own point, the
  watch's beat its own, the evening and the market at their own minute; the synthetic towns' crowds; and, where
  ARENA2_PATH names the data, the sample of thirty-four towns) and `test/lwspace_street.test.js` (the hold: held aside,
  still aside; a held body trailing its walk's point stands), `tools/mutants/lwspread.json` (26, all dead). PIN MOVED:
  `lw1_livingWorld` (a social favourite a corner or one's own point of the square), `lwperf_cost` (the favourites
  written the slow way, to LW-SPREAD's law; the arrival's window at eight), `lw2_livingTown` (the one waiting to be
  unseen counted through the churn; the gate's walker held with the player beside it), `lwtalk_town` (the keeping's
  step and the deal at half past seven, every walk searched before the way in; the readers' trample at ten),
  `watchprotects_watch` (the cornered in the close-built town; the frightened at seven), `lwspace_street` (the game's
  cities in the evening at seven). And the records of the lists LW-SPREAD's files touch, re-judged (343 of 348 dead, one
  equivalent as recorded): three it left unkilled, their pins' scenes moved - `lwperf.json` LW-PERF-arrival-cells and
  LW-PERF-waiting-wanted (`lwperf_cost`: the town's frames at two in the afternoon, the street's reach read every
  frame), `watchday.json` WATCH-DAY-late-from-supper (`watchday_watch`: the supper before the night's watch laid by
  hand - the great city's suppers near home now, none ran into the walk out) - and one LW-SPACE had (`lwstand.json`
  LW-STAND-host-unkept-alone: those alone stand where the census's beat placed them, and `lwstand_street` read no other
  stand; a town whose census never ran is read too).

## LW-ERRANDS - the town goes into its guild halls and its shops (2026-10-06)

Mac: "NPCs should also utilize going into guilds, shops, etc". Measured on the game's own towns (each one's day by its
plans, the visits a day into a building not one's home nor one's work): a guild hall saw its own two members and a
sellsword's or an adventurer's hour - one of the two halls nearest their home, whatever its guild (a sorcerer at the
Fighters Guild, Daggerfall's knightly halls eight a day of them) - and nobody else, 10-12 a day in a city of three
hundred; an errand went into one of the four shops nearest home, or stood at a market, half and half, whatever the
trade - a city's banks saw 1-6 a day, its library 0-4. Two causes, each fixed at its root (`test/lwerrands_town.test.js`,
`tools/mutants/lwerrands.json`).

- **Nobody belonged to a guild.** A resident keeps a guild now by their trade or their class (`dayPlan.js guildHallOf`,
  GUILD_OF_TRADE, `isMageClass`, `isWarriorClass`; `places.js` `factions` - each building's summary's factionId). A hall's
  own members their hall; a courtier and a knight a knightly order (any of the ten, `guildVariants.js` ORDERS - a knight
  where none stands the Fighters Guild); the people of a bookseller's, a library and an alchemist's, and Daggerfall's
  mage classes, the Mages Guild; the people of an armourer's and a weaponsmith's, and the warrior classes, the Fighters
  Guild (the eighteen classes stand in three runs of six, MOBILE_TYPES 128-133, 134-139, 140-145 - the thief's guilds
  keep no hall on the street). Their hall is the nearest to home of the town's halls of their guild; none where the town
  has none. A member keeps two days of the week at it - their own, three apart (`guildDay`, the seed's) - after the
  day's work (six) or, a courtier, the afternoon (half past four), an hour or two; a sellsword and an adventurer go to
  their own guild's hall each day as before, where it stands.
- **An errand had no business.** What each trade's errands are for (`ERRAND_NEEDS`): a household's stores (the general
  store, the clothier, the alchemist's remedies), a keeper's and a smith's bank (the takings) and stock, a scholar's
  library and bookseller, a courtier's jeweller and clothier, a merchant's bank and pawnbroker, a visitor's wares. An
  errand goes into a shop two times in three (ERRAND_SHOP_SHARE; the market the rest), and its shop is of a kind the
  trade needs ERRAND_NEED_SHARE (0.6) of the time - by its weight among the kinds the town keeps, the nearer of its two
  nearest home - else one of the four shops nearest home (`errandShop`; the first cut's every errand). A merchant's two
  afternoon shops and a visitor's are theirs too.
- **Measured** (before / after; each town's day by its plans, as `test/lwerrands_town.test.js` reads it):

  | | into the guild halls | of them a knightly hall's | into the banks | into the shops |
  |---|---|---|---|---|
  | Daggerfall (8x8) | 12 / 18 | 8 / 2 | 2 / 7 | 45 / 56 |
  | Ripmarket (6x7) | 10 / 11 | 5 / 2 | 6 / 9 | 80 / 88 |
  | Tuntale (6x7) | 10 / 14 | 0 / 0 | 1 / 5 | 63 / 83 |

  Every guild hall's visitors are now its own guild's people - the Mages Guild's 2, 1 and 6 a day before, 9, 3 and 10
  after; the knightly halls lost the sellswords and adventurers who were only passing nearest. The library is a scholar's
  errand and stays a quiet place (0-4 a day).
- **The four hosts.** LW-ERRANDS is the living town's plan (`dayPlan.js`, `places.js`): `scenes/world.js` runs the plans
  it lays (no host change); `scenes/worldModes.js` - the rooms show whoever their plans put inside (LW8, untouched: the
  guild halls, the banks and the shops now see their visitors); `scenes/exterior.js` - FLAGGED as LW2 has it;
  `scenes/dungeonContext.js` - no town.
- **Pinned** by `test/lwerrands_town.test.js` (the factions; a resident's guild - by trade, by class, by hand, the nearest
  hall, none without one; the guild's days; the evenings - kept at their hour, never a hall's own members, the
  travellers' own guild; an errand's shop - by need at its weights and its share, the nearer two, the browse; the day's
  errands - into a shop two in three, every shop one `errandShop` can give; and, where ARENA2_PATH names the data,
  Daggerfall, Ripmarket and Tuntale) and `tools/mutants/lwerrands.json` (23, all dead); the 158 records of the lists
  whose files or pins LW-ERRANDS touched re-judged, all dead. PIN MOVED: `lwfix3_town` (the
  walks coming near at two in the afternoon - at half past eight two walkers were near), `lwtalk_town` (out of sight, two
  rows and more to the nearer - more of the evening indoors), `lwperf_cost` (the favourites written the slow way: the
  guild their own, no draw), `lwspread_town` (the homemaker's market read where they walk to it from home on its hour - a
  lark's stroll goes on to the market and waits there).

## LW-LODGE - a lodger has a room (2026-10-06)

Mac: NPCs should "use tavern rooms" - and, asked how, "Lodgers in their rooms": a visiting traveller, a ship's crew
ashore, or an adventurer who lives at the tavern has a room by one of its beds; they are seen there in the evening before
bed and in the morning before going out, and hidden while asleep; the common room gets them at supper and breakfast; a
room the player rents is never given to a lodger. Before, one up at home in a tavern stood in its common room with its
drinkers (LW8: every one inside on the ground floor's sounded spots), their evening's tavern was the nearer of the two
nearest their home (their own or the next), and they had no breakfast.

- **The lodger's day** (`dayPlan.js isLodger`, LODGE_BREAKFAST_MIN, LODGE_UP_MIN). A lodger is one whose home is a
  tavern's door and who is not its staff. They breakfast in its common room 15-45 minutes after waking (twenty minutes to
  forty), before anything of the day (up in their room before it, and after it till they go out - the schedule's own
  stay at home); they sup at their own tavern in the evening (a visitor's and an adventurer's evening there), till 20-60
  minutes before bed at the latest, and go up to their room till bed; asleep there. The staff - the innkeeper and the
  servers, who live where they work - are no lodgers.
- **The rooms** (`livingTown.js lodgersAt`; `scenes/livingIndoors.js bedsOf`, `bedStand`, BED_STEP_M, BED_FAN,
  BED_LEVEL_M, BED_DROP_M). A tavern's lodgers today are its visitors and a packet's hands lodged there (`_lodging`) and
  those of the town whose home is its door, its staff aside, in the order of their ids - no other building has any (a
  house's household is its own). Its beds (its Rest markers - RentRoom's own list) are dealt to them: each, in that order,
  the bed their id and the tavern draw, or the next free after it; where they outnumber the beds the first are housed.
  The deal is every reader's alike, but the bed of the room the player rents there (`findRentedRoom`'s
  `allocatedBedIndex`) is no lodger's - the one it fell to takes the first bed after it nobody has, else the common
  room; the rest keep theirs. A lodger whose day has them up at home there stands by their bed - a step out from it the
  nearest way the room's collider lets them walk, down off a solid bed onto the floor (never down a stair, never
  higher), facing it - at no table, never stirring; at breakfast and supper (their day's tavern) they are in the common
  room with the rest, and one gone up or come down changes place where the player is not looking (LW8's law).
- **The game's taverns.** Its 290 tavern interiors carry 890 beds: 3.1 a tavern - two in 138 of them, five to seven in
  81, one in 26, none in 6; 462 of them at the height of the way in, 322 a floor up, 106 two floors up.
- **The four hosts.** `scenes/worldModes.js` - WIRED: the building host answers the room's beds (`interiorBeds`, its
  Rest markers) and the bed of the room the player rents there (`rentedBedHere`); `scenes/world.js` - WIRED: it hands
  them to the room's residents (`beds`, `rented`); `scenes/exterior.js` - FLAGGED as LW2 has it (no living town);
  `scenes/dungeonContext.js` - no town.
- **Pinned** by `test/lwlodge_tavern.test.js` (the lodger's day - breakfast, supper at their own, up before bed, a
  visitor and an adventurer homed there, never the staff; who lodges where; the rooms dealt and the rented one; by their
  bed in a mock room with a bed in it - off it, a corner's, a closet's, a bed on the floor, a stair; in the tavern - by
  the bed, no table, no stirring, the rented bed, the going up; the hosts) and `tools/mutants/lwlodge.json` (29, all
  dead). PIN MOVED: `tools/mutants/lw8.json` LW8-unarmed and LW8-walls (the latter now one site: `bedStand` walks the
  room as `soundRoom` does), `lw8b.json` LW8b-fill-deal and `lwfix1.json` LW-FIX1-walker-place re-aimed by content. The
  356 records of the lists on the files LW-LODGE touched (`dayPlan.js`, `livingTown.js`, `livingIndoors.js`) re-judged:
  354 dead, one equivalent as recorded, and `lwspace.json` LW-SPACE-host-since-the-stay alive - since LW-SPREAD (judged
  at each commit: dead at LW-SPACE's, alive from LW-SPREAD's), whose spread days run no two stays at one spot together in
  the hours its pin read; LW-SPREAD's re-judge had left LW-SPACE's own list out. Its law is pinned by hand now
  (`lwspace_street` bound since: a stall then the talk at one spot, one come between), and the branch's four lists -
  `lwspace`, `lwspread`, `lwerrands`, `lwlodge` - judged whole on its tree: 99 of 99 dead.

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
