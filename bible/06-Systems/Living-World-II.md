# THE LIVING WORLD II (LW9-LW16, designed 2026-10-09)

Mac, 2026-10-09: "I want to talk about enhancing the living world integration. More Travellers between roads, actual
caravans utilizing horses and wagons that can be assaulted, protected or traded with, npc autonomy that can visit
player shops and purchase from them, smarter and more dungeon diving npcs, groups of npcs forming parties and
traveling, and overall improvements to the living world system. I really want to improve this." (The ask wrote
"cant be assaulted"; asked, Mac: "Yeah my typo".) Asked what a player's shop is: "Look at the codebase. Players can set
up decorations that can be used as shops" - HOME-VENDOR's hired trader. Asked whether a company's dive changes the
dungeon, and in what order to build: "Your decision" to both (section 1, decisions 2 and 3). "I want this to be as
detailed as possible."

**Status: DESIGNED, nothing built.** Eight slices, LW9 to LW16, each its own pull request in the order of decision 2.
As each one ships, its record is written on this page under its name, the way `06-Systems/Living-World.md` records
LW1-LW8. That first page stays the record of LW0-LW8 and their fixes, and its LW0 decisions bind here except where
section 1 says otherwise. Every constant below marked "proposed" is a starting number for the slice to measure. None
is a law until its slice pins it.

## 0. What stands, read against the code (2026-10-09)

Four read-only passes over the tree (the roads and the wagon, the deep, the player's traders and the market, trade
and theft and the law) found:

| Mac's ask | What stands | What is missing |
|---|---|---|
| More travellers | Seven traveller jobs drawn off the MAPS row (`census.js travellerCounts`): merchants, sellswords (hired only), adventurers, sailors (ships only), pilgrims, couriers, pedlars. Each has a cycle of 5-20 days (`trips.js CYCLE_DAYS`), walks by day (07:00-19:00) and camps by night. A 4-block village sends out 1 merchant, 1 adventurer, 1 pilgrim and 1 pedlar. | Only trade, faith, mail and adventure travel: no farmer, hunter, patrol, noble or minstrel. Nobody stops at the roadside taverns, though the living world already peoples them (location type 6 is one of `shared.js POPULATED_LOCATION_TYPES`). Parties never meet each other. |
| Caravans with horses and wagons | `trips.js formCaravans`: a merchant, up to HIRE_MAX (3) contracted sellswords, and any pilgrim, courier or pedlar leaving the same day for the same town, all on foot. The horse and wagon art is already in the tree from HCC: classic model 41214 in five parts (`wagon41214.js buildWagonParts`), twelve cargo pieces by tier, the eight-way horse off the mod's 45 PNGs in `vendor/horse-cart-and-cargo/Textures`, and the shafts law (`horseFollow.js hitchAxle`). | No NPC owns a wagon or a horse. The pool's `drawWagon` and `poseHorseBatch` are private to `horseCartPool.js`. |
| ...that can be assaulted | A swing at a traveller (world.js `livingStrikeRoad`) is DFU's one-hit civilian kill and turns the party against the player (LW7). An armed hostile draws on the player (LW7b, `roadStands.js`). | Nothing on a caravan can be taken except a corpse's pack. Regard is the only consequence: no crime is charged and no region hears of it. A pickpocket caught on the road still sets `crimeCommitted` (`talk.js pickpocket` sets it whenever it is given no target) but calls no watch. |
| ...protected | LW4b: a beset party's fight is stood live within LIVE_M (150 m), with its armed members as the player's allies, and the regard of the spared and helped moves. | The player cannot hire on. A fight is only ever met by chance. |
| ...traded with | Nothing. `worldModes.js openTradeWindow` takes any `{ items }` shelf, but it is private to the interior host, and its overlay slot (`interiorOverlay`) is drawn only indoors. | No trade window on the road. |
| NPCs buy at player shops | HOME-VENDOR: a decor piece made the `vendor` station (a one-time 25,000 gold licence) in an online home. Its stock is gold market listings at the account service (VENDOR_LISTING_S, 30 days; VENDOR_STOCK_MAX, 60). A player standing in the house buys from it, player to player: the 5% tax and 1% fee are burnt and the rest is held in `market_gold`. | The living world knows nothing of homes or traders. An online home lets nobody of the town inside (LW-FIX6, AUDIT-E1). No NPC buys anything anywhere. Traders work online only (`vendorLaw.js VENDOR_COLD_LINE`). |
| Smarter, more diving | LW6: an adventurer dives a dungeon 1-8 px away (DIVE_RANGE_PX) in DIVE_CHANCE (0.55) of cycles, for 4-10 hours inside. A company that is met is stood as allies DIVER_STAND_M (5 m) behind the player and follows them. | **Every dive is one adventurer** (`trips.js diveTrip`: `party: [res]`). Nothing moves divers through the dungeon. LW0's model line "hours inside room to room" was never built: the company appears behind the player wherever the player stands. A dive with no fated death meets no trouble at all. Under the classic motor the follower gets no trail, so it walks straight at the player. Remains are laid at a hashed marker, not where the person fell. |
| Groups forming parties | Only a merchant gathers a party. | No companies and no pilgrim bands. |
| Overall | A town's news is its own (`trips.js newsOf`, `livingTown.js deedNews`). | Word never travels between towns. |

## 1. The decisions (LW-II0)

Taken at the design. Each is Mac's to overrule.

1. **PURE STAYS PURE, AND THE ONE EXCEPTION IS THE SERVICE'S.** LW9-LW14 and LW16 add no byte to the relay. Every
   traveller, wagon, outlaw band, company, dive route and cleared stop is a pure function of the world's own data
   (MAPS, BLOCKS, the roads), a seed and the clock, as in LW0's decision 2. What the player does to them is the
   character's own (`relations.js` turns and marks, saved as `LivingWorld`), as in LW0's decision 6.

   LW15 (the patrons) is the one slice where the living world touches something another player owns: a trader's
   stock and its gold. Its sales are decided by the account service, by a law both ends read (`net/patronLaw.js`, read
   the way `net/vendorLaw.js` is). The street only draws the buyer the service named.
2. **THE ORDER.**

   | # | Slice | Stands on | Why here |
   |---|---|---|---|
   | 1 | LW9 the road's traffic | LW3 | The cheapest and most visible. It also sets the counts that every later slice draws its people from. |
   | 2 | LW10 the wagon train | LW9 | A wagon to see, and the thing that LW11 trades at and robs. |
   | 3 | LW11 the caravan's door | LW10 | Trade, theft, the hold-up and the escort all open at the wagon. |
   | 4 | LW12 the outlaws | LW11 | A robbery for outlaws to commit, and a crime law for the player to answer to. |
   | 5 | LW13 the companies | LW9 | Adventurers in groups, which the deep needs. |
   | 6 | LW14 the deep's own | LW13 | Smarter divers move as a company. |
   | 7 | LW15 the patrons | LW2 only | The only slice that changes the account service and mints gold. It stands on nothing earlier, so it can be pulled forward whole. |
   | 8 | LW16 the word travels | all | News of every earlier slice, carried between towns. |
3. **A COMPANY'S DIVE CHANGES THE DUNGEON, FOR A WHILE, AND ONLY WHAT THEY REACHED.**
   - The random foes at the stops a company has passed are dead when the player comes in, their bodies on the floor
     with their packs emptied.
   - The random treasure piles at the stops they passed are picked over.
   - A quest's foes and items (markers 11 and 18), the fixed foes (record 16) and the fixed treasure (archive 216) are
     never touched.
   - It lasts DIVE_CLEAR_MIN (proposed: a day of the clock) after the company passed. After that the dungeon is as
     Daggerfall builds it. Online the room's own respawn law (`dungeonRespawn.js` DUNGEON_RESPAWN_MS, twenty minutes)
     then applies, as it does to any death.

   Why: it is what makes a company real. LW's own ask was "You can find them dungeon diving ... explore a dynamic
   world", and a corridor of dead skeletons and an emptied pile are how a player knows someone was here first. It is
   bounded so that no dungeon is ever cleared for good by people the player never saw.
4. **THE WAGON IS THE CLASSIC CART, THE HORSE IS THE MOD'S, AND NEITHER NEEDS THE MOD SWITCHED ON.**
   - A caravan's wagon is model 41214 with its cargo, read at runtime from the player's own ARCH3D as the HCC wagon
     is. It never enters the repository.
   - Its horse is the eight-way billboard off the HCC PNGs that already ship under `vendor/`.
   - Horse Cart and Cargo's switch governs the player's own cart and nobody else's. A caravan draws its wagon whatever
     the switch says.
   - ONE DFU MEMBER, ONE EXPORT: the pool's private `drawWagon` and `poseHorseBatch` move to one exported home that
     both read.
5. **A DEED ON THE ROAD IS A CRIME AGAINST THE REGION WHERE THE ROAD RUNS, IF SOMEONE CARRIES IT HOME.**
   - The charge is DFU's own: `court.js lowerRepForCrime`, against the region at the deed's map pixel
     (`maps.getRegionIndexAt`). The sea's piracy law is the precedent (`naval/navalLaw.js lawOf`: "no watch stands at
     sea").
   - It is charged only when a witness reaches a town alive: the minute the party's walk next reaches a town (its
     destination or home). Until then the report is pending. If the character kills every witness first, the report
     is void and the news names nobody, as with LW7's unseen murder.
6. **AN ESCORT WALKS ONLINE AND MAY RIDE THE CLOCK OFFLINE.** Online the world's clock belongs to everyone and nobody
   may move it (WORLD5, LIVED1), so a caravan the player escorts walks at its own pace and the player keeps up, on foot
   or on their horse. Offline the one clock is the player's: "Travel with the caravan" moves it as a journey does,
   moving the caravan with it, and stops at the trouble the trip carries.
7. **THE PATRONS ARE A CAPPED FAUCET, AND IT IS MEASURED.** An NPC buying from a player mints gold, and the market
   today mints none: a trader's sale is player to player. The Economy arc's own law holds: "Shops are the floor,
   crafting the ceiling ... What an NPC pays for a crafted piece is capped, or smithing prints gold."
   - A patron never pays more than PATRON_PAY_SHARE of the piece's worth as the service judges it
     (`itemLaw.js itemWorth`).
   - Each town's traders share an hourly demand, and each seller has an hourly and a daily ceiling.
   - Every patron's gold is written where the wealth measure counts it. The Integrity arc's budget passes the
     service's own credits unseen today (`prepareRealmRecord`: "the wealth the change moves is WITNESSED").

   The numbers are in section 8 and are Mac's to set.
8. **THE COST STAYS INSIDE LW-PERF'S BUDGETS.**
   - The roads' layer stays at 6 ms or less in any frame (`tools/livingPerfProbe.mjs`'s own bar), and the town's
     frames stay where LW-PERF measured them.
   - Wagons drawn are capped (WAGONS_DRAWN, proposed 6 nearest). Each wagon is five meshes and up to twelve cargo
     pieces.
   - Every new reader is spread over frames as the roads are (ROADS_TOWNS_PER_FRAME).
   - Every slice measures before and after on the probe, and on the game's own map wherever ARENA2_PATH names the data
     (LW-ERRANDS' measure on Daggerfall, Ripmarket and Tuntale is the precedent).
9. **EVERY NEW TRAVELLER JOB IS APPENDED.** A traveller's id is `L<mapId>.t<slot>`, dealt in TRAVELLER_JOBS' order
   (`census.js travellerRoster`). A job inserted anywhere but the end would re-key every saved regard and turn of every
   traveller after it. New jobs go after `pedlar`. A pin holds every id of today's roster on a town unchanged.
10. **THE RELATIONS RECORD STAYS `v: 1`, ADD-ONLY.** `createRelations` loads `v: 1` alone (pinned in
    `lw1_livingWorld.test.js`), so every new turn, mark or record below is an add-only key, written only once it is
    non-empty: the MARK, TALE and HAND style, never a new TURN_KINDS entry, whose always-written set is pinned. A new
    name is unique across the arrays (`turn()` tries tales, then hands, then turns and marks).

## 2. LW9 - the road's traffic (BUILT 2026-10-09)

Mac: "More Travellers between roads".

### 2.1 Who travels (`census.js`)

The census's roster grows in two appended ranks, after TRAVELLER_JOBS' own (decision 9). Every id of today's roster on a
town stands unchanged, and `lw9_traffic.test.js` pins it against the same town read with no kind.

1. **THE NEW TRAFFIC, `ROAD_JOBS`** (`roadCounts`, off the MAPS row's kind and size):

   | Job | Who | Class | Cycle | Where | Hazard |
   |---|---|---|---|---|---|
   | `carter` (a farmer to market) | a farm (type 3) 1; a hamlet (1) or village (2) 1 + blocks/4, to 3 | none | 7 days | the nearest town within 1-4 px keeping a market (a city or a village of MARKET_BLOCKS, 4), on its MARKET DAY (`trips.js marketDay`: one in seven, by its map id) - in by MARKET_IN_H (noon), at a stall till MARKET_OUT_H (13:30), home by nightfall | 0.003 |
   | `hunter` | a hamlet, village or farm: 1 | an Archer or a Ranger | 4 days | THE WILD (2.2) | 0.01 |
   | `patrol` | a city of CITY_COURT_BLOCKS (16): 2 + blocks/32, to 4 | Knight, level 6-14 | 6 days | a ROUND to a town of its own region within 3-12 px, and back | 0.008 |
   | `noble` | a city of 16 blocks: 1 | none | 20 days | another court (a city of 16 blocks) within 6-18 px | 0.004 |
   | `retainer` | a city of 16 blocks: 2 | a Knight, Warrior or Archer | the noble's | with their noble | 0.008 |
   | `minstrel` | a city of 9 blocks: 1 | Bard | 4 days | a town of 4 blocks within 3-8 px - plays its tavern of an evening, lodged there | 0.006 |

   Their tables stand beside the first's (`trips.js` ROAD_PACE, ROAD_CYCLE_DAYS, ROAD_TRIP_CHANCE, ROAD_RANGE_PX,
   ROAD_STAY_DAYS; `lives.js` ROAD_HAZARD, `hazardOf`), so the first's tables, which are pinned whole, stay as they were.
2. **MORE OF THE ROAD'S OWN, `MORE_JOBS`** (`moreCounts`, after ROAD_JOBS): a pedlar more for every six blocks from two
   (to four), a pilgrim more from four blocks, a courier more from nine. Never a merchant: the sellswords are dealt to
   the merchants by their count (`formCaravans`' contract), so one more merchant would move every sellsword's contract.
   Nor a sellsword.

**THE ONE A TRAVELLER RIDES WITH** (`trips.js leaderOf`). A sellsword rides with its contract merchant, as before. A
patrol rides as one behind its first. A retainer is dealt to the nobles in slot order, as the sellswords are to the
merchants. Their places live by their leader's cycle (`placeCycle`), they set out when their leader does (`setsOut`),
and `formCaravans` makes the round and the procession whole: every place of it, held that cycle.

**AT HOME AND AWAY** (`dayPlan.js`).
- At home: a carter and a hunter work the fields as a farmer does; a patrol's knight and a retainer keep a sellsword's
  day; a noble keeps a courtier's; a minstrel plays their own town's tavern of an evening.
- Away: a carter come to market goes straight to a stall as they come in, until they go (MARKET_STALL_H, 8 to 13:30,
  their window cutting it). A minstrel come to play takes the tavern they lodge at from MINSTREL_PLAY_H (18:30 to 23:00).
- In the room: a minstrel standing at no table's talk sings over it (`lines.js minstrelLine`: a song every
  MINSTREL_EVERY_MIN of the clock, up MINSTREL_UP_MIN of it, by their seed).

### 2.2 The wild, and the inn on the road

- **THE WILD** (`trips.js wildTrip`).
  - A hunter's point is the first of WILD_TRIES seeded tries 1-3 px off their town that stands on dry ground, off every
    town's pixel, with the line to it dry where it is sounded (four points).
  - Their way is that straight line, `open` throughout, so its trouble is open country's.
  - The trip's `to` is no town (`mapId` -1, "the wild"), and `trip.wild` is the point.
  - Out at first light; then the hunt's camp at the point (`partyAt`: out, camped, there) until the next morning, and
    home within the cycle.
- **THE INN ON THE ROAD** (`trips.js innsAlong`, `nightStop`, `innAhead`, `innGuestsOf`).
  - A roadside tavern (location type INN_TYPE, 6) within INN_REACH_PX (1) of one of a route's pixels, other than its two
    ends, is an inn on that way (`way.inns`, read once as the way is made).
  - At nightfall a party walks on to an inn within INN_AHEAD_N (a map pixel) ahead of it, and lodges there (`partyAt`'s
    `inn`). Otherwise it camps on dry ground, as LW-DRY has it.
  - The inn's GUESTS on a living day are the parties of the towns within reach lodged there the night before (out of a
    morning) or that night: in from the minute they lodged (sounded on from nightfall a quarter hour at a time), out at
    first light. The host hands them to the tavern's town as its visitors (world.js `livingTripsOf`), so LW-LODGE's
    rooms take them.
  - A night lodged at an inn meets no trouble at a camp (`trouble.js`): CAMP_SHARE's camp trouble falls on that day's
    walk instead.

### 2.3 Parties meet on the road (`livingRoads.js`)

- **PASSING** (`passingPairs`). Two parties walking within PASS_N (25 m) of each other at the same minute pass with a
  word each: the first's line, then the second's, a line a beat. The words are ROAD_PASS_SCRIPTS, or ROAD_PASS_WARNINGS
  where either party has met trouble behind it, with its foe named. A pair is dealt once, the lower trip id first.
- **CAMPS SHARED** (`campGroups`). The night's camps within CAMP_SHARE_N (60 m) of one another are one camp: the
  earliest party's place, every one of them a place in its ring in order, the ring grown CAMP_RING_STEP_N for each of
  its people past four. It is a drawing's law only: no timeline moves.
- **A FIRE AT EVERY CAMP**: the camps' own flame (`survival/camp.js FIRE_FLAT`, TEXTURE.210 record 1) at a camp's
  middle, one to a shared camp, none on the march and none at a halt. It has no light of its own: the roads' bodies are
  billboards and carry none.
- **LODGED IS INDOORS**: a party at an inn draws no body on the road and wears no Overworld mark.

### 2.4 The patrol keeps the road

- **COVER** (`trips.js patrolCover`, `trouble.js`). A trip from or to a town a patrol's round went from or to, while
  the round walked or within PATROL_COVER_DAYS (2) before the trip set out, meets trouble PATROL_RISK (0.5) times as
  often. The cover is read off the patrols' own trips alone (`memoTrip`, never their trouble), so no trip's trouble ever
  asks its own. The host's trouble world reads it (`livingTroubleWorld.covered`).
- **THE LAW BEYOND THE WALLS** (`roadStands.js` `wanted`). A patrol's knight within DRAW_M (45 m) of a player the round's
  region knows for a criminal (`standing.js knownCriminal`) draws on them, whatever their regard, with the law's word
  (`lines.js PATROL_HALT_LINES`). Built as the draw, not as DFU's arrest: the arrest flow (`scenes/arrestFlow.js`) is
  begun by the town watch's guards and ends by placing the prisoner at a location's entrance, and on the road no
  location stands. An arrest on the road is left for a later slice (section 11).

### 2.5 What the player sees

- The roads' layer draws the new kinds as it draws any party: a patrol, a retainer and a minstrel in their class's
  sprite; a carter and a noble in their own outfit; a hunter in their class's.
- The Overworld marks gain their words (`partyLabel`): "Farmer to Ripmarket's market", "Hunter in the wild",
  "Patrol to Wayrest", "Procession to Sentinel", "Minstrel to Anticlere".

### 2.6 The measure

`tools/livingPerfProbe.mjs` THE TRAFFIC: on the synthetic map, mixed as the game's is (some of its places farms,
villages, hamlets and roadside taverns), the parties about four points at 08:00, 12:00 and 18:00 over fourteen days.

| | before LW9 | with LW9 |
|---|---|---|
| parties within 1 px | 0.49 | 0.71 (x1.45) |
| parties within 3 px | 1.73 | 2.65 (x1.53) |
| the roads' layer, any frame | 1.81 ms worst | 0.90-2.83 ms worst (budget 6) |

The synthetic map's towns stand five pixels apart, so its carters find no market within their four pixels and none are
counted. The game's farms stand by their towns, so carters will add more. The real-map targets (2.6 of the design: a
main road meeting a party every four real minutes by day) are measured where ARENA2_PATH names the data; the container
has none.

### 2.7 The four hosts, and the pins

- `scenes/world.js`: WIRED (the trouble world's cover, the inn's guests among a roadside tavern's visitors, the stands'
  halt by the region's law).
- `scenes/worldModes.js`: WIRED through the host (the minstrel's room and the inn's lodgers stand by LW8's own seam;
  `livingIndoors.js` sings the song).
- `scenes/exterior.js`: FLAGGED, as LW2 has it.
- `scenes/dungeonContext.js`: no roads.

Pins: `test/lw9_traffic.test.js` (12). PIN MOVED: `lw1_livingWorld` (the roster's ids, more of the road's own appended),
`lw3_roads` (the first's tables pinned alone), `lwperf_cost` (the day's trips' reference reads the new chances).
Mutants: `tools/mutants/lw9.json` (37); twelve records the slice's edits moved were re-aimed by content (`lw3`, `lw4`,
`lw6b`, `lw7b`, `lwdry`).

## 3. LW10 - the wagon train (BUILT 2026-10-09)

Mac: "actual caravans utilizing horses and wagons".

### 3.1 Who has what (`systems/livingWorld/wagons.js teamOf`, pure, the trip's)

- A merchant's caravan draws one wagon, or two when its town is a great house's (GREAT_HOUSE_BLOCKS, 36).
- A noble's procession (LW9) draws its baggage wagon.
- A pedlar's or a carter's own trip leads a pack horse: the horse alone, in its still and walk views. ARENA2 has no pack
  model the tree knows of.
- Nobody else has a team. Couriers stay on foot: the riding peer's mounted sprites (`net/peerRiders.js`) are a player's
  Eye of the Beholder look, not a resident's (section 11, call 5).

### 3.2 Where it is (`wagons.js`, pure)

- **THE TRAIN IN FILE** (`trainOf`), every place a distance along the way from the party's own `s` (the way is the
  road's centre line, so a trailer's law reduces to the way's own curve):
  - the VAN, the first half of the armed, before the leader, a walker's gap (WALK_GAP_N) apart;
  - the leader at the party's own place, at the head of the first horse, LEAD_N (1 m) before it;
  - each wagon's axle HITCH_N behind its horse: HITCHED_HORSE_LOCAL_Z, 3.1 m, the mod's own parked-team distance;
  - a second team WAGON_TAIL_N (2.75 m) behind the first wagon's axle; a pack horse a walker's gap on;
  - the rest behind, in order.

  All walk by day. At a halt (a fight, its wounds bound) the train stands where it was. The way out and the way home
  read the way in opposite directions, so the train faces home on the way back.
- **AT CAMP** (`campTeam`): each wagon CAMP_PARK_N (3 m) beyond the camp's ring, facing its fire, its horse unhitched
  CAMP_HORSE_SIDE_N to its side; a pack horse by itself. The ring is the shared camp's (LW9) where there is one.
- **THE WHEELS** (`wheelAngleAt`): Horse Cart and Cargo's turn by travel (`horseCartLaw.js wheelRotationDegrees`) off
  the distance the axle has walked along its way, wrapped. Every reader's wheels stand at the same spoke.
- **THE CARGO** (`cargoOf`, the tiers CARGO_DEFINITIONS shows): full (90) on the way out; home, sold (50) or bought
  (75) by the trip's seed; a quarter (25) once robbed (LW11's `robbed`, the character's own).

### 3.3 Drawn (`world/roadTeams.js`, `scenes/livingRoads.js`, `scenes/horseCartPool.js`)

- **ONE MEMBER, ONE EXPORT.** The pool's own wagon draw and horse pose are handed out through its `presentation`
  (`drawWagon`, `poseHorse`) beside its `wagonParts` and `horseArt`. The living world's teams draw with them, and the
  pool's switch governs only the player's own cart: the pieces are built whatever it says (decision 4).
- **THE ROADS' LAYER** lays each team with its train: a party with a team walks in the train's places, not in plain
  file; its horses and wagons are handed to the teams with their scene feet and, for a wagon, the ground WAGON_FRONT_N
  (1.5 m) before its axle, for its tilt. A lodged party (LW9) shows none.
- **THE TEAMS** (`createRoadTeams`):
  - Each horse is its own billboard batch, posed by the pool and stepped by `stepHorseWalk` at its party's pace;
    destroyed as it leaves the list.
  - The nearest WAGONS_DRAWN (6) wagons are drawn in the world mesh pass beside the cart's own (`hcc.draw`), a
    NORMAL_GROUND_OFFSET above the ground and tilted to it; grown under the Overworld with the bands.
  - A STANDING wagon (camped, halted) stands its box on the host's collider (`usableBounds` of the model's bounds, the
    pool's `boxTriangles`) in a bucket of its own (`wagonBucket`), taken down when it moves or leaves; a moving wagon
    claims nothing.
  - `clear()` destroys every batch and takes down every box, with the roads' own clear.
- **THE OVERWORLD**: a caravan's mark is its wagon - the bed and two wheels under it (`ui/travelViewHud.js`).

### 3.4 The four hosts, the measure, the pins

- `scenes/world.js`: WIRED (the teams made with the roads' layer off the pool's presentation and the host's collider;
  drawn in the world mesh pass).
- `scenes/worldModes.js` and `scenes/dungeonContext.js`: no roads, so no wagon.
- `scenes/exterior.js`: FLAGGED, as LW2 has it.

Measure: the roads' layer with the teams laid stays inside its 6 ms on the probe (THE TRAFFIC). The draw itself is the
pool's: at most WAGONS_DRAWN wagons of five meshes and their cargo a frame. A real-GPU frame is measured in a browser
(`tools/travelViewPerf.mjs`); the container has none.

Pins: `test/lw10_wagons.test.js` (7). Mutants: `tools/mutants/lw10.json` (21).

## 4. LW11 - the caravan's door: trade, theft, the hold-up, the escort

Mac: "caravans ... that can be assaulted, protected or traded with".

### 4.1 The door

- **TALKING TO A CARAVAN'S MERCHANT** (or a pedlar, or a carter at their stall) opens a choice before the
  conversation: Trade, Hire on (only before the caravan sets out, and only for a merchant), Talk, Goodbye.
  - It is a new `livingTalk` door, `offers(person, talk)`, at the place of the LEGACY `kin` door, which is the
    precedent: `legacyMeetKin` shows its own acts before `converse`.
  - Drawn with `talkWindow.js ChoiceWindow` (in the enhanced Plus style).
  - An enemy refuses first, as today (`refuses`).
- **THE PLAQUE.** On the enhanced World Tooltips plaque, a living person's namer gains rows (Trade, Talk, Steal, plus
  Hire on where it applies).
  - Today the `mobileNpc:<i>` namer returns only a title, and its press (`townTalk.tryActivate`) ignores the plaque.
  - The press passes `plaqueActionFor` into `tryActivate`, as HCC's verbs do. Where no plaque stands (the classic
    skin, touch), the ChoiceWindow decides.
- **THE WAGON'S PLAQUE.** Trade (opens the merchant's door), Steal (4.3), Info.

### 4.2 Trade

- **THE STOCK** is the merchant's counter: `shopStock.js stockShopShelf({ buildingType, quality }, playerEntity, {
  rolls })`.
  - `buildingType` is a General Store for a merchant and a carter, and a Pawn Shop for a pedlar.
  - `quality` is CARAVAN_QUALITY: the home town's size, 6 + blocks/4, from 1 to 20 (proposed).
  - `rolls` are seeded by the trip (`lwRng(trip id, 'ware')`), so the stock is the same all trip.
  - It reads the player's level and sex as every counter does, so each character sees their own fair stock.
    Buying is the character's own.
- **WHAT WAS BOUGHT STAYS GONE**, the guild shelves' `dayShelf` law kept per trip. The character's WARES record holds
  the trip's id, the taken indices and the coin the merchant spent. It is a new add-only record in `LivingWorld`
  (decision 10), keeping the WARES_MAX (40) newest trips.
- **SELLING TO THE CARAVAN.** The merchant buys what its counter type buys (`shopBuysItem`), up to its PURSE for the
  trip: CARAVAN_PURSE, 300 x quality (proposed), the only bound on a merchant's coin. Past it: "I've no more coin
  this trip."
- **PRICES** are the counter's own: `calculateCost`, `calculateTradePrice` and the region's adjustment at the party's
  pixel (`regionPriceAdjustment` with the pixel's region; online `worldRegionPrice`).
  - A merchant who counts the player a friend takes FRIEND_DISCOUNT (10%) off, by `shopAdjustment`'s seat-discount
    shape.
  - Online the sale is capped by MERC-RISE's ONLINE_SALE_SHARE, as at any counter.
- **THE WINDOW.** `worldModes.js openTradeWindow` is exported through the interior host's API (it is private today).
  The road's call mounts it through `mountServiceWindow`, so that outdoors it lands on `townTalk.showOverlay` and
  never on `interiorOverlay` (drawn indoors only).
  - The building record is the caravan's: `{ buildingType, quality, regionIndex: the pixel's, name: "Ada Lark's
    caravan" }`.
  - The steal hooks are the road's own (4.3), never `crimeTheft` and the city watch.
  - The classic skin waits on `tradeDoorReady` as every counter does.
- **ONLINE**: the counter is the character's own, as every shop's is. Pieces bought are minted the way a shop mints
  them, so the item law (INT) judges them as any counter's.

### 4.3 Theft

The three ways to rob a caravan, each the character's deed:

| Deed | How | If seen | The crime (decision 5) |
|---|---|---|---|
| **Pickpocket** a member | Today's arm (`talk.js pickpocket` with the person as target) | The party turns on the player (`crime` regard for each member). Its armed draw if the regard falls to hostile (LW7b). | Pickpocketing (12), reported when a witness reaches a town |
| **Steal from the wagon** | The wagon's Steal row opens its CARGO as a loot list (`makeInventoryWindow({ loot })`), minted from the trip's seed (`loot.js generateItems` on the merchant's tables, by tier) and kept per character with the WARES record. Each piece taken rolls `theft.js shopliftAttempt` on `calculateShopliftingChance(pickpocket, quality, load)`. At night only the sellsword on watch is awake (one of them, by the night's seed), so the chance gains NIGHT_STEAL (20). | As a caught pickpocket | Theft (13) |
| **The hold-up** | Every armed member struck down (`livingStrikeRoad`, or LW7b's stood foes, or a fight the player starts) | The merchant and the unarmed YIELD ("Take it! Take what you want!"): they drop their purse and the cargo opens freely. The wagon is a container for REMAINS_MIN, then the party walks home ROBBED (LW12's end, without a band). | Murder (5) for each slain, Assault (4) for a blow, Theft (13) for the cargo - each reported when a survivor reaches a town |

- **THE REPORT** is a pending record in `LivingWorld`, an add-only REPORTS list: `[crime, region, minute it lands,
  who it names]`.
  - At its minute the host charges it: `lowerRepForCrime(playerEntity, region, crime)`.
  - A load past the minute charges it on the load.
  - The character killing the last witness first voids it.
  - Each is also tallied for the guilds (`crimeGuilds.js tallyCrimeGuildRequirements`), as every theft is.
- **THE ROAD PICKPOCKET'S FLAG.** A caught roadside pickpocket no longer leaves `crimeCommitted` set: the road's door
  clears it, because the report is the road's charge.
- **THE NEWS.** The caravan's home town and destination tell it: "Ada Lark's caravan was robbed on the Wayrest road",
  naming the player when it was seen (`ROBBED_NEWS`). The robbed caravan's Overworld mark reads "Caravan (robbed)".

### 4.4 The escort (protect)

- **HIRE ON.** Before a merchant's trip sets out, the merchant offers the player the road. It is offered on the
  evening before at their home's tavern or market spot, or on the morning at the gate.
  - The pay (proposed): ESCORT_GOLD_DAY, 60 + 15 x the player's level, for each day of the walk; and ESCORT_FIGHT,
    100 a foe, for each fight won. Both are paid at the destination.
  - The contract is a record in `LivingWorld`, one at a time: the trip's id, the minute taken, the pay owed, the
    fights won.
- **THE TERMS.** The player keeps within ESCORT_KEEP_M (300 m) of the party. Left behind for more than ESCORT_LOST_MIN
  (60 minutes of the clock), the contract is broken: no pay, and a blunt regard (`insulted`) from the merchant.
- **THE ROAD.** The trip's trouble is stood live as LW4b stands it. The player is near by contract, so every fight the
  trip carries is the player's to turn, and the end is what happens. A fight won counts toward ESCORT_FIGHT.
- **OFFLINE**: "Travel with the caravan" (the escort's choice at each morning's setting out) moves the clock as a
  journey does, the caravan with it, the player stood beside the merchant. It stops:
  - at the night's camp or inn (where a rest prompts);
  - at the trouble's halt, a minute before the fight;
  - at the destination.

  Online there is no such choice (decision 6).
- **PAID.** At the destination, gold to the purse (the client's word, as a counter's gold is - inside the item law and
  the budget), and `helped` regard from every member. A caravan escorted whole is its town's news (`ESCORT_NEWS`).

### 4.5 The four hosts, and the pins

- `scenes/world.js`: WIRED (the doors, the plaque rows, the trade's mount, the reports' charge, the escort's travel).
- `scenes/worldModes.js`: WIRED through its API (the trade window exported).
- `scenes/exterior.js`: FLAGGED.
- `scenes/dungeonContext.js`: none.

Pins:
- the stock seeded per trip;
- bought stays gone;
- the purse;
- the friend's discount;
- the window outdoors on the talk overlay, never `interiorOverlay`;
- each theft's chance and seen;
- the night watch;
- the yield;
- the report charged at its minute, voided by the last witness's death, charged on a load past it;
- the flag cleared;
- the escort's pay, broken by distance, and its offline travel stopping at the trouble.

## 5. LW12 - the outlaws

Overall improvement: the road's trouble has a face and a home. The climate tables can already roll human "bandit"
groups (`mobileFactions.js FACTIONS.BANDIT`), but nothing remembers them.

### 5.1 The bands (`systems/livingWorld/outlaws.js`, pure)

- **HOW MANY.** A region keeps BANDS_OF(region) = 1 + its towns / 40 bands, to 4 (proposed).
- **THE HIDEOUT.** A dry, open-ground point 1-2 px off a road leg between two of the region's towns, off any town's
  rectangle. The leg is the seed's pick among the region's way pairs.
- **THE NAME** is drawn off two lists ("the Black Hand", "the Reach Wolves"), or off the leader's own name ("Ysolde's
  Knives").
- **ITS PEOPLE** are minted as the census mints, with a band's own kind:
  - 4-8 of them, ids `O<region>.<band>~<gen>.<i>`;
  - classes from the thieves' run and the rough end of the fighters' (Thief, Rogue, Burglar, Nightblade, Barbarian,
    Archer);
  - levels by the size of the region's towns.
- **ITS LIVES.** A band holds its hideout for a generation. Routed, by the character (5.3) or by a patrol on the dice
  (5.2), the hideout stands empty BAND_VACANT_DAYS (20). Then a new band forms there: gen + 1, a new name. The routs on
  the dice are read as `lives.js placeAt` reads a place, back to the world's first cycle.

### 5.2 The hold-up on the dice (`trouble.js`)

- **WHO TROUBLES THE ROAD.** A trip's leg passing within OUTLAW_REACH_PX (2) of a hideout takes its trouble's foes
  from the band in BAND_SHARE (0.6) of such troubles, instead of from the climate's table: named, human, the band's
  people at their own levels.
- **A NEW END: ROBBED.** A party whose strength (`strengthOf`) is under ROB_RATIO (0.6) of the band's yields:
  - no blood is spilled;
  - the merchant's purse and half the cargo are taken (the tier falls);
  - HALT_MIN.robbed (30) minutes;
  - then the party walks on.

  Otherwise it fights as any trouble does (driven, won, fled, fell).
- **A PATROL MEETS A BAND.** A patrol (LW9) whose loop takes a leg within OUTLAW_REACH_PX rolls against the band. A
  win on the dice ROUTS it.
- **THE BAND'S TAKE** is the robbed goods and gold of its generation: a pure count of its hold-ups since it formed,
  each adding the merchant's purse and the cargo's worth by the tier lost. It is what the band's chest holds.

### 5.3 The hideout stood

- **STOOD LIVE.** A player on the ground within BAND_LIVE_M (200 m) of a hideout stands it (the camps' election
  online):
  - the tents (model 41606, `camps.js`' own) and a fire;
  - the band's people about it as the pool's foes (loose and transient, never a save's): all of them by day, and by
    night half, the rest out on the road;
  - its CHEST, a `droppedLoot` pile minted from the take's count: goods off the merchants' tables, and gold.
- **ROUTED.** When every member is dead, the band is routed.
  - The character gets a `routed` mark, keyed by the band's region, index and generation. The hideout stands empty
    for this character from then.
  - The towns near tell it (LW16's word, ROUTED_NEWS).
  - Every member of the caravans that band robbed this generation regards the player as having `helped`.
- **ONLINE** every reader's band is the same. A rout is the character's own, as every LW deed is.

### 5.4 Heard of

- **THE NEWS.** A robbery's news names the band and the leg ("The Black Hand took Ada Lark's goods on the road to
  Wayrest"), in the town's meetings and in the road's passing words.
- **A HEARD MARK.** Once the character has heard of a band, its hideout's area is marked on the Overworld as "Hideout
  of the Black Hand (rumoured)": a ring, not a point. Heard means a line naming it said within GREET_RANGE of the
  player, or a talk's answer. It is kept as a `heard` mark per band generation.
- **OPEN FOR MAC: A BAND ON THE BOUNTY BOARD.** The board (`bountyBoard.js`) posts beasts today, and every player reads
  it alike. A band's head is a natural hunt, but the board is shared while a rout is the character's own. Proposed:
  the board's law reads the bands (pure) and posts one; a hunt cleared pays as the board's hunts pay. Recorded as call
  3 in section 11.

### 5.5 The four hosts, and the pins

The four hosts are as LW9's.

Pins:
- the bands' count, places and names;
- generations after a rout;
- the band's share of a leg's trouble;
- robbed below the ratio;
- the take's count;
- the hideout stood, its chest and the rout's mark;
- the heard mark's ring.

## 6. LW13 - the companies

Mac: "groups of npcs forming parties and traveling".

### 6.1 The company (`systems/livingWorld/companies.js`, pure)

- **THE DEAL.** A town's adventurers (LW9's count) are dealt into companies in slot order.
  - A company's size is drawn from its first slot's seed: 2-4, or up to 5 in a city.
  - Each company takes a mix of the three runs where the town has them: a mage's (MOBILE_TYPES 128-133), a thief's
    (134-139) and a warrior's (140-145), the eighteen classes' three runs of six.
  - An adventurer left over goes alone, as today.
- **THE LEADER AND THE NAME.** The leader is the highest-level member. The name is drawn off two lists, or the
  leader's ("The Lantern Company", "Ravens of Wayrest", "Ada Lark's company").
- **A COMPANY IS ITS PLACES**, as a caravan's contract is its sellswords' places.
  - A member who dies leaves the place empty for VACANT_CYCLES. Then the newcomer holds it and belongs to the company
    (`lives.js` unchanged).
  - The leader is always the highest level among the current holders.
- **ONE CYCLE, ONE TRIP.**
  - The company's trip follows its leader's place's cycle and dice (`ownTrip`).
  - A member whose place is fated that cycle forces the company out, as `formCaravans`' fated contract does.
  - Every member's own trip that cycle is the company's. Their away windows are the company's, since `awayOf` already
    reads the party.
- **WHAT IT DOES.**
  - A DIVE, in COMPANY_DIVE_CHANCE (0.75) of its cycles.
  - A town's trip.
  - HIRED: a merchant whose town keeps no sellswords (under nine blocks) takes a company that is home that cycle and
    sets out the same day for the same town. It is the joiners' law, with a company joining a train.
- **PILGRIM BANDS.** Pilgrims set out to arrive at a temple town for its region's holy day (`holidays.js
  getHolidayId`). Those of one town go together as a band. On the holy day the temple town's visitors are many, and
  LW8's temple room is full.

### 6.2 Seen

- On the road a company walks in file by role, warriors before, thieves between and mages behind, and camps together. The Overworld
  mark reads "The Lantern Company, to Mournoth", the dungeon by name.
- Their greetings name the company ("Ravens of Wayrest - you've heard of us?"). The chronicle's People page (LW7c)
  groups them.
- Each member keeps their own regard. The company's word to the player is its leader's.

### 6.3 Pins

- the deal: sizes, the mix and the one left over;
- the solitary adventurer's id unchanged;
- one trip a cycle;
- the fated forcing the company out;
- the hire;
- the pilgrims' holy-day law.

## 7. LW14 - the deep's own

Mac: "smarter and more dungeon diving npcs".

### 7.1 The dive's route (`systems/livingWorld/deepRoute.js`, pure over the dungeon's own data)

- **THE STOPS** are the dungeon's random foe markers (record 15) and its random treasure markers (record 19).
  - They are read off its blocks as `rdbLayout.js layoutRdbBlock` reads them, from MAPS' `dungeon.blocks` and
    BLOCKS.BSA: what the dungeon's own build reads, so only while the player is in it. The trips need none of it.
  - The fixed foes (record 16), the quest markers (11, 18) and the fixed treasure (archive 216) are never stops.
- **THE ORDER.**
  - It starts from the start marker (record 10, in the starting block).
  - The blocks are walked breadth first by their grid adjacency: a dungeon's blocks join their neighbours, and the
    border blocks close it.
  - Within each block the stops go nearest first from where the company came in.
  - So a company works outward from the entrance, block by block.
  - There is no room graph in the tree (none is needed): the block grid is the plan, as `world/dungeonEnd.js`'s
    farthest marker and `world/dungeonFires.js`' plan already read it.
- **THE TIMELINE.**
  - The dive's hours inside (`trip.dive.t0` to `t1`) are spent at the stops: a foe's stop 25-40 minutes by its seed,
    a treasure's 10.
  - Between stops the company walks at its pace over the stops' floor distance times DEEP_DETOUR (1.6).
  - The stops reached by the dive's middle are its reach. Then comes THE WAY OUT: the same stops back to the start.
  - `stopAt(trip, route, t)` gives the stop they are at, or the two they are between.
- **THE DICE'S END, WHERE IT FELL.** A dive's fated trouble (`diveTrouble`) falls at the stop its minute reaches. The
  fallen lie THERE: LW6b's remains move from a hashed marker to the true stop.
- **MORE TROUBLE IN THE DEEP.** A dive with no fated death now meets the deep too: DEEP_RISK (0.5) of dives have a
  fight at a stop chosen by the seed. It is always won (only the fated die, by the lives' law), and its halt is that
  stop's extra time.

### 7.2 What they leave behind (decision 3)

- **AT THE DUNGEON'S BUILD**, offline, every dive of the last DIVE_CLEAR_MIN is read. Every stop a dive passed before
  the build's minute is cleared:
  - the random foes there are BUILT DEAD, their corpse where they stood and its items emptied;
  - the random treasure piles there are built EMPTY.
- **ONLINE** the same set holds for every reader. The room's host applies it as `died` stamps at the minute each stop
  was passed, and the room's respawn law follows from there.
- **A COMPANY STILL INSIDE**: the stops behind them are cleared, the stop they are at is being fought (7.3), and the
  stops ahead are as Daggerfall built them.

### 7.3 Found where they are, and live

- **THE SOUND.** A company fighting at a stop within DEEP_HEAR_M (60 m) of the player rings steel: the game's own
  weapon-hit sounds at the stop, now and then, with "You hear fighting ahead." said once.
- **STOOD LIVE** where the route has them, not behind the player. They are stood within DEEP_SEE_M (35 m) of their
  stop with a clear line, or within 15 m.
  - Each member is the dungeon's loose ally, as today: team PlayerAlly, a `shipmate`.
  - The stop's foe is alive and theirs to fight.
- **THEIR OWN WAY.** Once stood, they go on.
  - With the enhanced motor's navmesh (`ai/navmesh.js findPath`, baked per dungeon; always on online), each member
    walks to the next stop's floor, fights what is there with the motor's own senses, stands at a treasure stop for
    its minutes, and walks on.
  - Without a navmesh (offline, under the classic motor, which has no pathing) they hold their stop, fighting and
    resting there. They never walk a straight line through a wall.
- **HURT.**
  - A member under RETREAT_HP (0.3) falls back behind the others.
  - When the company's standing strength falls under half of what it came in with, it makes for the way out (the
    route back), whatever the timeline says.
  - THE END IS WHAT HAPPENS (LW4b's law), for this character.
- **TALK AND CHOICE.** Each member is a talk target by name, through the living door. Their leader offers (LW11's
  ChoiceWindow):
  - **JOIN US**: today's stand, where they follow the player. The follow motor now gets a TRAIL, as `crewAshore.js`
    passes one, so a classic follower comes round corners.
  - **LEAD ON**: the player follows; they keep their route with the player along.
  - **PART WAYS**: they go on.

  Stood and not asked, they go on.
- **RIVALS.** A company that does not count the player a friend and has not been joined minds its finds. The player
  looting a pile at the stop they are making for costs `poached` regard (proposed -4), with a word: "That was ours to
  find." It is a new EVENTS key, counted once a day as `insulted` is.
- **MORE OF THEM.** COMPANY_DIVE_CHANCE (6.1) and LW9's adventurers mean more companies below. A dungeon within reach
  of a city often holds one.

### 7.4 The four hosts, and the pins

- `scenes/dungeonContext.js`: WIRED. The cleared set at the build, the stood company at its stop, the navmesh walk.
- `scenes/world.js`: WIRED. `livingDiversStep`, the room host's stamps.
- `scenes/worldModes.js` and `scenes/exterior.js`: none.

Pins:
- a dungeon's stops in order, on a synthetic RDB grid and on the game's own under ARENA2_PATH, never a quest marker;
- the stop at a minute;
- the remains at the true stop;
- the cleared set alike for two readers;
- the dead built emptied, and the piles empty;
- the clearing gone after DIVE_CLEAR_MIN;
- online, the host's stamps;
- met where the route has them;
- the navmesh walk to the next stop, and the hold without a navmesh;
- the retreat;
- the three choices;
- the trail;
- the rival's word.

## 8. LW15 - the patrons

Mac: "npc autonomy that can visit player shops and purchase from them"; "Players can set up decorations that can be
used as shops".

### 8.1 Who decides a sale: the service, by a law both ends read (`net/patronLaw.js`)

The service holds the trader's stock and the seller's gold. It bundles no ARENA2, so it cannot know a town's people or
its size. It runs a cron every minute and every hour (`server-account/src/cron.js`). So:

- **THE HOUR IS THE WINDOW.** An online sky day is a real hour (TIME1). Each open listing at a trader is offered to the
  town's patrons once for each real hour it stands.
- **THE PRICE DECIDES.**
  - The cap is PATRON_PAY_SHARE of the piece's worth as the service judges it (`itemLaw.js itemWorth`, already the
    market's judge). Proposed: 0.6. An online counter's sale pays at most half its least ask (ONLINE_SALE_SHARE), so a
    patron pays about a fifth more than a counter would.
  - Above the cap, a patron never buys.
  - At or under it, the hour's chance depends on how far under. With r the price over the cap, `patronOdds(r)` is
    0.25 at r <= 0.5, 0.12 at r <= 0.75 and 0.05 at r <= 1 (proposed).
- **THE TOWN'S DEMAND IS SHARED.** A town's traders together sell at most PATRON_TOWN_HOUR (proposed 4) pieces an hour
  to patrons. The hour's winners are the lowest draws (`hash(listing id, hour)`), so ten traders in one town share the
  custom one alone would have had.
- **THE CEILINGS.**
  - A seller sells at most PATRON_SELLER_HOUR (2) pieces to patrons an hour, and at most PATRON_SELLER_DAY_GOLD
    (proposed 20,000) gold a real day.
  - A patron never takes a piece `lawfulItem` refuses (as any listing), a quest item or a keepsake.
  - A crafted piece's cap is no higher than a bought one's. This is where the Economy arc's crafted-piece cap is
    built.
- **THE BUYER.** The service names a SEED (`hash(listing, hour)`) and a MINUTE within the hour, never a person. The
  client deals the seed to one of the town's residents (8.3).
- **PAID AS A SALE IS PAID.**
  - The 5% tax and 1% fee are burnt; the rest goes to `market_gold`, bounded by MARKET_GOLD_HELD_MAX.
  - A `market_sales` row is written whose buyer is the patron's mark (`patron:<map>:<seed>`).
  - No delivery: the piece leaves the realm, a sink of goods.
  - Every patron's gold is written to the wealth measure as the service's own faucet (`server-account/src/budget.js`,
    a kind `patron`), so staff can read it before the budget is enforced (Integrity arc, call 2).
- **WHEN IT RUNS.**
  - Lazily, on every read of a trader (`/v1/market/vendor`, `/vendors`, `/myvendors`), and in the hour's cron (a new
    HOUR_JOBS entry, `patrons`).
  - Each run covers the hours since the listing's last reckoning, kept in a new column `patron_hour`. The dice are
    pure, so sales reckoned late are the same sales.
  - At most PATRON_RECKON_HOURS (48) are reckoned: a listing nobody read for thirty days is reckoned for two.
- **IDEMPOTENT**, as the market is: the sale row's key is `(buyer = the patron mark, rid = the hour)`, with
  `mustChange`, and the listing must be open and unsold in the same statement.

### 8.2 Which traders the town walks into

- A trader in a home the town may enter: the home's `entry` is `public` (`homeLaw.js HOME_ENTRIES`). A private home's
  trader sells to the players its owner lets in, never to the street (proposed, Mac's call).
- The home's building is one of the living town's doors on its street (LW-WALLS' street). Its map id and building key
  are the ones the homes registry keys by (`talkTopics.js makeBuildingKey`), the same as the LivingTown's doors.

### 8.3 Drawn, by the client

- **WHICH HOUSES KEEP A TRADER.** The town's homes registry (`onlineHomes.js`, read per town already) and the region's
  traders (`/v1/market/vendors`, whose rows carry `map` and `buildingKey`) tell the LivingTown which of its houses
  keep one. A trader's answer gains its recent PATRON SALES: `{ listing, hour, minute, seed, item's name }`.
- **THE BUYER DEALT.** The seed goes to one of the town's residents who is FREE at that minute: their plan's entry is a
  stay at a social spot, the market or home, between 08:00 and 20:00. Plans are pure, so every reader deals the same
  resident. Their day gains an errand: to the home's door, in, to the trader's place, and out again. It is dayPlan's
  shop errand shape, with `at` the home's door.
- **BROWSERS.** The town's errands now count a public trader's house among the shops of its kind (`dayPlan.js
  ERRAND_NEEDS`: a trader whose stock is mostly weapons belongs with the smiths' shops, and so on), PATRON_BROWSE_SHARE
  (0.1) of the time. Browsers go in, look and come out. They never buy: only the service sells.
- **INSIDE.** A public home with a trader stands its patrons and browsers at the trader (the decor piece's place, read
  off the home's decor). LW-FIX6's "never a player's own room" still keeps the town out of every other home and every
  other room of the owner's. The trader's room of a public home is the one exception.
- **THE OWNER IS TOLD.** `vendorPage.js`'s sales read "Sold to Ada Lark of Wayrest - Steel Longsword, 1,240 gold", the
  seed's resident named by the client. The town now and then talks of a good find at the player's house (LW16).

### 8.4 The four hosts, the service, the pins

- `scenes/world.js`: WIRED (the town's traders, the buyer's errand).
- `scenes/worldModes.js`: WIRED (inside the home: the patrons at the trader).
- `scenes/dungeonContext.js` and `scenes/exterior.js`: none.
- The service:
  - a new migration in `server-account/migrations` (`patron_hour`, the patron's buyer mark);
  - `server-account/src/market.js` (the reckoning);
  - `server-account/src/cron.js` (HOUR_JOBS);
  - `server-account/src/budget.js` (the faucet's kind).

  The account service redeploys on merge.

Pins:
- the law's odds, ceilings and town share, both ends (the client's reader and the service's) against one table;
- reckoning twice gives the same sales;
- reckoning late equals reckoning on time;
- the cap at worth;
- a crafted piece no dearer;
- a private home's trader sells to no patron;
- the seed dealt alike by two readers;
- a browser never buys;
- offline, nothing.

## 9. LW16 - the word travels

Overall improvement: what happens in one town is heard in the next.

- **NEWS CARRIED.**
  - A town's meetings now tell, beside its own news, the news of the towns its visitors came from (`visitorsOf`).
  - Each item is known from the visitor's arrival minute, for NEWS_DAYS, in CARRIED_SHARE (0.3) of the news lines.
  - So a deed in Wayrest is known in Ripmarket when Wayrest's first traveller comes in after it.
  - Couriers carry the news of every town they pass through, one hop further.
- **THE PLAYER'S REPUTE.**
  - A deed known in a town, carried or its own, moves the regard of the town's STRANGERS (those with no regard of
    their own) by its repute. REPUTE (proposed): saved +4, helped +2, routed +5, slain -8, robbed -5.
  - It is read, never stored, and never moves a regard past FRIEND_AT or ENEMY_AT.
  - So a stranger greets a hero by what they heard: "You're the one who drove off the Orcs at the ford?"
- **Pins**: the arrival minute, the courier's hop, and repute read at the time, bounded, never stored.

## 10. Found on the way (not changed by this design)

1. `Living-World.md` LW6b says "the scene's cache keeps it". This has been stale since LW-FIX5: a dungeon keeps no
   scene cache (`systems/sceneCache.js` is keyed by buildings and world pixels only).
2. `01-Overview/Port-Ledger.md`'s LW6 row still says "Not yet: the fallen of a dive lying in the dungeon to be found".
   LW6b built it.
3. A home's trader: the service checks that a buy names the stall and that the stall stands. It does not check that
   the buyer stands in the house; that gate is the client's alone (`worldModes.js openHomeVendor`). An item for the
   Integrity arc's later lanes.
4. A diving company's loose stands reach a peer as nameless puppets not flagged as allies: the own frame flags allies
   only for `companion`, and divers set `shipmate` and team PlayerAlly. LW14 should flag a living ally on the wire,
   with its name. That is a change to the relay's law and its version.
5. LW0's model says "hours inside room to room". It was never built until LW14.
6. A roadside pickpocket caught still sets `crimeCommitted` (`talk.js pickpocket` sets it when given no target). LW11
   clears it at the road's door.

## 11. Mac's calls (open)

1. The traffic targets (2.6).
2. The patrons' numbers (8.1): PATRON_PAY_SHARE, the town's hourly share and each seller's ceilings. And whether a
   private home's trader sells to the street (8.2).
3. A band on the bounty board (5.4).
4. The escort's pay: gold (the client's word, as a counter's gold is) is proposed. Marks (the service's) is the
   alternative.
5. Couriers on horseback (3.1), if the rider art serves.
6. LW9: an arrest on the road - a patrol that halts a wanted player taking them to the nearest town's court, rather
   than drawing on them (2.4).
