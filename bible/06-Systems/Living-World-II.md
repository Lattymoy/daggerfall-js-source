# THE LIVING WORLD II (LW9-LW16, designed 2026-10-09)

Mac, 2026-10-09: "I want to talk about enhancing the living world integration. More Travellers between roads, actual
caravans utilizing horses and wagons that can be assaulted, protected or traded with, npc autonomy that can visit
player shops and purchase from them, smarter and more dungeon diving npcs, groups of npcs forming parties and
traveling, and overall improvements to the living world system. I really want to improve this." (The ask wrote
"cant be assaulted"; asked, Mac: "Yeah my typo".) Asked what a player's shop is: "Look at the codebase. Players can set
up decorations that can be used as shops" - HOME-VENDOR's hired trader. Asked whether a company's dive changes the
dungeon, and in what order to build: "Your decision" to both (section 1, decisions 2 and 3). "I want this to be as
detailed as possible."

**Status: LW9-LW16 BUILT 2026-10-09; AUDITED 2026-10-10** (Mac: "Lets do a deep audit and ensure this is perfection" -
`01-Overview/Audit-LivingWorld-II.md`: every finding, where it stands below marked AUDIT LW-II, and what was not
changed and why). Eight slices, LW9 to LW16, in the order of decision 2.
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
   | `carter` (a farmer to market) | a farm (type 3) 1; a hamlet (1) or village (2) 1 + blocks/4, to 3 | none | 7 days | the nearest town within 1-2 px (AUDIT LW-II E5: 1-4 before - a walk from first light in by noon reaches two at the calendar's pace, one at the online pace) keeping a market (a city or a village of MARKET_BLOCKS, 4), on its MARKET DAY (`trips.js marketDay`: one in seven, by its map id) - in by MARKET_IN_H (noon), at a stall till MARKET_OUT_H (13:30), home by nightfall | 0.003 |
   | `hunter` | a hamlet, village or farm: 1 | an Archer or a Ranger | 4 days | THE WILD (2.2) | 0.01 |
   | `patrol` | a city of CITY_COURT_BLOCKS (16): 2 + blocks/32, to 4 | Knight, level 6-14 | 6 days | a ROUND to a town of its own region within 3-12 px, and back | 0.008 |
   | `noble` | a city of 16 blocks: 1 | none | 20 days | another court (a city of 16 blocks) within 6-18 px | 0.004 |
   | `retainer` | a city of 16 blocks: 2 | a Knight, Warrior or Archer | the noble's | with their noble | 0.008 |
   | `minstrel` | a city of 9 blocks: 1 | Bard | 6 days (AUDIT LW-II: 4 before - no trip with its stay fit a four-day cycle, and no minstrel ever travelled) | a town of 4 blocks within 3-8 px - plays its tavern of an evening, lodged there | 0.006 |

   Their tables stand beside the first's (`trips.js` ROAD_PACE, ROAD_CYCLE_DAYS, ROAD_TRIP_CHANCE, ROAD_RANGE_PX,
   ROAD_STAY_DAYS; `lives.js` ROAD_HAZARD, `hazardOf`), so the first's tables, which are pinned whole, stay as they were.
2. **MORE OF THE ROAD'S OWN, `MORE_JOBS`** (`moreCounts`, after ROAD_JOBS): a pedlar more for every six blocks from two
   (to four), a pilgrim more from four blocks, a courier more from nine. Never a merchant: the sellswords are dealt to
   the merchants by their count (`formCaravans`' contract), so one more merchant would move every sellsword's contract.
   Nor a sellsword.

**THE ONE A TRAVELLER RIDES WITH** (`trips.js leaderOf`). A sellsword rides with its contract merchant, as before. A
patrol rides as one behind its first. A retainer is dealt to the nobles in slot order, as the sellswords are to the
merchants. Their places live by their leader's cycle (`placeCycle`), they set out when their leader does (`setsOut`),
and `formCaravans` makes the round and the procession whole: every place of it, held that cycle. A rider whose place is
fated that cycle sends the round out, as a company's member does (AUDIT LW-II F2: the fated knight stayed home).

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
  - The trip's `to` is no town (`mapId` -1, "the wild"), and `trip.wild` is the point. The talk and the news never name
    it as a place (`placeName`: AUDIT LW-II E7 - "the wild" was told as a town's name); they say "the next town".
  - Out at first light; then the hunt's camp at the point (`partyAt`: out, camped, there) until the next morning, and
    home within the cycle.
- **THE INN ON THE ROAD** (`trips.js innsAlong`, `nightStop`, `innAhead`, `innGuestsOf`).
  - A roadside tavern (location type INN_TYPE, 6) within INN_REACH_PX (1) of one of a route's pixels, other than its two
    ends, is an inn on that way (`way.inns`, read once as the way is made).
  - At nightfall a party walks on to an inn within INN_AHEAD_N (a map pixel) ahead of it, and lodges there (`partyAt`'s
    `inn`). Otherwise it camps on dry ground, as LW-DRY has it.
  - The inn's GUESTS on a living day are the parties of the towns within reach lodged there the night before (out of a
    morning) or that night: in from the minute they lodged, out at the minute they leave, one guest an id. AUDIT LW-II
    E2: sounded from dusk to the next first light, a quarter hour at a time and then to the minute (`firstMinute`) - a
    party lodging after dark was never listed (the audit's measure: 7 lodgings at the calendar's pace, 63 at the
    online pace; none now); and a lodged party stays in until its day's walk catches up (96 minutes past 07:00 on average, up to five
    hours online), where it was listed as gone at first light. E6: a party turned home lodging two nights was listed
    twice. The host hands them to the tavern's town as its visitors (world.js `livingTripsOf`), so LW-LODGE's rooms take
    them.
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
- **LAID OUT ONCE, AS DRAWN** (AUDIT LW-II E3): the layer lays each party near out once a frame, where its bodies are
  drawn, and the stands (the talk's, the fights') read those places - they laid each party out again on their own, and
  stood it away from where its bodies were drawn.

### 2.4 The patrol keeps the road

- **COVER** (`trips.js patrolCover`, `trouble.js`). A trip from or to a town a patrol's round went from or to, while
  the round walked or within PATROL_COVER_DAYS (2) before the trip set out, meets trouble PATROL_RISK (0.5) times as
  often. The cover is read off the patrols' own trips alone (`memoTrip`, never their trouble), so no trip's trouble ever
  asks its own. The host's trouble world reads it (`livingTroubleWorld.covered`).
  - AUDIT LW-II E10: the patrol cities about EITHER end of the trip - a round reaches the towns within its range of its
    city; they were sought about `from` alone.
  - AUDIT LW-II E1: a cover still waiting on a round's way answers undefined, and the trouble read meanwhile is kept
    nowhere (`townTrips` keeps no day with a fate undefined; world.js `fate`, `livingCovered`). It answered false, and
    the uncovered trouble was kept: two readers, their ways planned a few frames apart, saw different troubles.
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

| | before LW9 | with LW9 | after AUDIT LW-II (2026-10-10) |
|---|---|---|---|
| parties within 1 px | 0.49 | 0.71 (x1.45) | 0.43 before, 0.67 with (x1.53) |
| parties within 3 px | 1.73 | 2.65 (x1.53) | 1.54 before, 2.49 with (x1.62) |
| the roads' layer, any frame | 1.81 ms worst | 0.90-2.83 ms worst (budget 6) | 1.30 ms worst |

Re-measured after the audit, on the law as it stands now - LW13's companies walk as one, a party is home until its
first light (E5), the minstrels travel (F2) - both columns read the same day's law, the first roster's traffic alone
and with LW9's.

The synthetic map's towns stand five pixels apart, so its carters find no market within their two pixels and none are
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

Pins: `test/lw9_traffic.test.js` (17 - AUDIT LW-II: the road jobs' own tables against their reach, stay, pace and
cycle; the cover's two readers; the lodging after dark and the leaving; one fire to a shared camp and none on the march;
the friendly knight still halting a wanted player). PIN MOVED: `lw1_livingWorld` (the roster's ids, more of the road's own appended),
`lw3_roads` (the first's tables pinned alone), `lwperf_cost` (the day's trips' reference reads the new chances).
Mutants: `tools/mutants/lw9.json` (62); twelve records the slice's edits moved were re-aimed by content (`lw3`, `lw4`,
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
  the distance the axle has walked along its way, wrapped. Every reader's wheels stand at the same spoke. Home, the
  distance runs from the far end (AUDIT LW-II E8: it ran down, and the wheels turned backwards).
- **THE CARGO** (`cargoOf`, the tiers CARGO_DEFINITIONS shows): full (90) on the way out; home, sold (50) or bought
  (75) by the trip's seed; a quarter (25) once robbed (LW11's `robbed`, the character's own).

### 3.3 Drawn (`world/roadTeams.js`, `scenes/livingRoads.js`, `scenes/horseCartPool.js`)

- **ONE MEMBER, ONE EXPORT.** The pool's own wagon draw and horse pose are handed out through its `presentation`
  (`drawWagon`, `poseHorse`) beside its `wagonParts` and `horseArt`. The living world's teams draw with them, and the
  pool's switch governs only the player's own cart: the pieces are built whatever it says (decision 4).
- **WAGONS1 x LW10** (2026-10-10, main's WAGONS1-WAGONS2 merged in): the pool draws a wagon of a KIND now - Mac's
  models where his are drawn (the Small Cart, the Open Wagon, the Caravan), Daggerfall's 41214 where they are not - its
  parts (`partsOf`) and its hitch (`hitchOfKind`) the kind's, its draw taking its wheels' turn as an object, the kind
  and whether it is hitched, and every one of those unsaid is the PLAYER'S driven wagon's. The living world's wagon is
  the Small Cart (`roadTeams.js ROAD_WAGON_KIND`) whatever the player drives: drawn by its own parts, its wheels turned,
  hitched on the march and at rest at camp (`wagons.js` `hitched`), and the train laid at that wagon's own hitch
  (`trainOf`'s `hitchN`, the teams' `hitchN()`: 3.8 m where Mac's cart is drawn, the mod's 3.1 where it is not). As the
  merge first stood, every living caravan wore the player's own wagon, its wheels still.
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

Moved pins (AUDIT LW-II-2 P15 - unrecorded until then): `lw3_roads` (a caravan's Overworld mark is its wagon),
`lw4b_roadFights` (the roads' `clear()` clears the teams beside the fights).

Pins: `test/lw10_wagons.test.js` (9 - AUDIT LW-II: the roads' layer at a camp, its bodies and its parked teams;
WAGONS1 x LW10 through a real pool). Mutants: `tools/mutants/lw10.json` (34).

## 4. LW11 - the caravan's door: trade, theft, the hold-up, the escort (BUILT 2026-10-09)

Mac: "caravans ... that can be assaulted, protected or traded with". The law is `src/systems/livingWorld/caravanDoor.js`
(pure: the trip and the clock in); the host is `src/scenes/caravanHost.js` over the character's road records
(`relations.js` `wares`, `reports`, `escort`).

### 4.1 The door (`caravanHost.js offers`, the talk's `livingTalk.offers`)

- **WHO ASKS FIRST.** A party's LEADER who keeps a counter or offers the road asks what the player wants before the
  words, in a `talkWindow.js ChoiceWindow`. The door stands in `townTalk.js` after the LEGACY `kin` door, its precedent.
  An enemy still refuses first (`refuses`).
- **THE CHOICES**, each only where it applies:
  - `B - buy` and `S - sell`: the counter, while its keeper is on the road (4.2).
  - `T - take`: the counter of a party the character robbed (4.4), in place of buy and sell.
  - `H - hire on (<pay> gold)`: a merchant's road, offered while no contract stands (4.5).
  - `R - travel on with them`: the escort's own caravan, offline only (4.5).
  - `A - talk` (the conversation, behind the choice) and `Esc - goodbye`.
- **NOT BUILT: THE PLAQUE ROWS.** The design gave the enhanced World Tooltips plaque Trade/Talk/Steal rows, and the
  wagon a plaque of its own. The ChoiceWindow decides on every skin instead (section 11, call 8).

### 4.2 The counter

- **WHO KEEPS ONE** (`counterOf`, `keepsCounter`): a caravan's merchant and a carter a general store's, a pedlar a
  pawnbroker's (`COUNTERS`); nobody else. Only the trip's leader keeps it, standing, out or home, never in a fight -
  never at home, never in the town it went to.
- **ITS QUALITY** is CARAVAN_QUALITY: 6 and one each four blocks of its home town, 1 to 20. **ITS PURSE** for the
  trip is PURSE_PER_QUALITY (300) a quality (`purseOf`): what it pays out for what the player sells it, all trip. Past
  it: "I've no more coin this trip." - the sale refused, the goods back in the pack.
- **ITS STOCK** is the shops' own roll (`shopStock.js stockShopShelf`) at that kind and quality, its rolls seeded by
  the trip (`lwRng(trip id, 'ware')`): the same all trip. Each ware carries its place in the first roll (`WARE_KEY`).
- **WHAT LEFT THE SHELF STAYS GONE.** Bought, stolen unseen or taken, the character's WARES record keeps the places
  gone and the coin paid out, by trip (WARES_MAX, 40). The next session's shelf is the roll less those. A load or a
  new game (another character's records) forgets the session's shelves. AUDIT LW-II C7: A ROBBERY IS THE LAST
  FORGOTTEN - the session's shelf carries its coin and its robbery and writes them back as they are, and the book lets
  the oldest record NOT robbed go first, while the robbed are half of it or fewer: pushed out by forty trades, a robbed
  caravan's record came back unrobbed, its shelf and purse whole, to be robbed again. AUDIT LW-II-2 C3: A STACK PARTLY
  TAKEN IS KEPT BY WHAT IS LEFT - an add-only `[place, count]` among the gone (the whole places first; the old form still
  read), so a split stack no longer comes back whole after a load; and the save writes the session's shelves first
  (world.js `getSaveData`, the host's `flush()`), so a piece taken in the step's second is not on the shelf again.
  C12: a shelf made before the band's hold-up loses the band's half when it comes.
- **THE WINDOW** is the shops' own (`worldModes.js openTradeWindow`), through the interior host's API (`openRoadTrade`)
  and `mountServiceWindow`: outdoors on the talk's overlay, never `interiorOverlay`. Its building is the counter's
  (kind, quality, name - "Ada Lark's caravan" - and the region at the party's place). Prices are the counter's own,
  with the region's adjustment.
  - A friend's counter takes FRIEND_DISCOUNT (10%) off what the player buys (`shopAdjustment`'s `roadDiscount`).
  - The window's own steal, caught, is the road's crime (4.3), never the watch: no city guard is called.

### 4.3 The deeds, reported (Living World II decision 5)

- **EACH DEED IS A REPORT**, carried by the party's members still standing:
  - a hand caught in the counter's goods: Theft, and the `crime` regard of every member;
  - a hand caught in a traveller's purse (today's pickpocket on the road): Pickpocketing. The town's crime flag the
    pickpocket sets is put back as it stood before it, because the report is the road's charge (AUDIT LW-II-2 C15:
    `townTalk.js activate` keeps the flag before the pickpocket; the road's door cleared every crime that stood);
  - a traveller struck down (LW7's `livingStrikeRoad`, a stood armed one, a fight the player started): Murder, naming
    them;
  - a hold-up (4.4): Theft.
- **WHERE IT LANDS** (`reportAt`): the minute the party next reaches a town - the one it set out for on the way out,
  home on the way back or once it has turned; a hunter's, whose way out ends in the wild, home (AUDIT LW-II-2 R9). The
  region is the one the road runs through at the deed.
- **CHARGED, OR VOID.** Once a second the host reads the reports whose minute has come: charged (`lowerRepForCrime`
  in the region, and `tallyCrimeGuildRequirements` as every crime is) if a witness lives at that minute, dropped if
  none does. A load past the minute charges it at the first step. The REPORTS record is add-only (REPORTS_MAX, 40).
  AUDIT LW-II-2 C8: a full book lets a VOID report go first (one whose every witness is dead now), never a witnessed
  one, and each step drops the void pending; the one struck down is never a witness of their own murder.
  - A WITNESS IS WHOEVER HOLDS THE PLACE (AUDIT LW-II C1, `caravanHost.js travellerOf`): a newcomer (`~<gen>`) minted
    as the lives mint them. The roster holds the census's own alone, and at the game's epoch nearly every place is a
    newcomer's: looked up there, every witness was nobody and every report void. While the town's trips wait on their
    ways (`tripOfId` undefined) the report waits, asked again.
  - A report names its trip, and a witness the road took on the way (its trip's own fallen, which the hands' deaths
    never read) carries nothing to the town (C10). Its crime is one of the law's (`crimes.js` CRIMES, never None) and
    its region one of the map's (`reportOk`, on load and on writing - any integer was charged, legalRep[-7] = NaN).
- **NOT BUILT: STEALING FROM THE WAGON** (its cargo as a loot list, each piece on `shopliftAttempt`, NIGHT_STEAL at
  night) and the Assault report. The counter's own steal stands for the first (the shops' shoplift law). The road has
  no blow short of a striking down (LW7), so there is no assault to report. The wagon's steal is section 11, call 8.

### 4.4 The hold-up (`yields`)

- A party whose armed - those the road left it - are all down by the player's own hand (`slainAt`: the character's
  `slain` turns), its leader standing and the player within ESCORT_KEEP_M of it, YIELDS, once: "Take it! Take what you
  want - just let us be!" AUDIT LW-II C4: the trip's own fallen (the dice's) were read as beaten, and a sellsword who
  died fighting beside the player as the player's doing - a party whose guards fell to anyone yielded to whoever was
  within the roads' read, and the player became its robber. AUDIT LW-II-2 C1: "those the road left it" is the party
  less the ROAD's own fallen alone (`!f.hand`) - read through `membersAt`, which drops the hand's dead too, a trip as the
  host mints it (through `fate`) had no armed member left once the last guard fell, and yielded only when the host's
  step read the roads' old trip object first.
- The robbery is the character's: its minute in the WARES record, the cargo a quarter from then (LW10's
  `cargoOf`), a Theft reported, the Overworld's mark "Caravan to Wayrest (robbed)" (`partyLabel`).
- Its counter is then `T - take`: its goods and what is left of its purse lie open in a loot window (the chest's) -
  none of the purse where a band took it first (AUDIT LW-II C6: the whole purse lay open).

### 4.5 The escort (`escortOffer`, `escortPay`)

- **HIRE ON.** A merchant's caravan offers the road from ESCORT_OFFER_MIN (18 hours) before it sets out until it is
  in; never a caravan turned home, never by sea, never one the character robbed (AUDIT LW-II C5e). One contract at a
  time (the ESCORT record).
- **THE PAY**: each day of the walk out (WALK_FROM_H to WALK_TO_H, a part a whole) at ESCORT_GOLD_DAY (60) and
  ESCORT_GOLD_LEVEL (15) a level of the player's, and ESCORT_FIGHT (100) a foe of the trip's fight, if the player won
  it (the character's `won` turn) and it began after the hire (C5e). Paid at the town it was bound for, with `helped`
  regard from every member. Hired on the way, the share of the walk still ahead of the party at the hire (AUDIT LW-II
  C5a: hired a minute short of the town, it paid the whole walk).
- **THE TERMS.** Within ESCORT_KEEP_M (300 m) of the party is near; the contract keeps the last minute it was (`near`,
  saved with it). Further than that for more than ESCORT_LOST_MIN (60 minutes of the clock) at a stretch breaks it: no
  pay, an `insulted` regard from the merchant. The leader fallen - by a hand, or by the road (AUDIT LW-II C5d, its own
  fallen) - ends it ("did not live to pay you"); the caravan turned back ends it unpaid, from its trouble's minute
  (C5c: it paid through the halt). AUDIT LW-II-2 C2: the character robbing the caravan, or striking one of its people
  down, after the hire ends it unpaid, in the merchant's words (`CARAVAN_LINES.betrayed`). C9: a caravan the band robbed
  under the escort still pays (its people came through), in its own words - "We're in - robbed, but alive." (Mac's call
  9).
- **WITH IT THROUGHOUT** (AUDIT LW-II C5b, `escortNear`): judged to the town however the clock came past it. The step
  runs in the open world and in the modal frame alike (an escort waited out indoors was never asked where it stood, and
  paid at the town). The clock since the escort was last with the party is read back each ESCORT_SAMPLE_MIN (5) against
  where the player stands now: never a stretch of ESCORT_LOST_MIN without the party near. A party camped beside a
  sleeper keeps them; one that walked off from a sleeper, or came up to them after an hour of their sleep, does not;
  and a journey that set the player down beside it is a stretch away (on review: one that set them by its town as it
  came in was paid - the first cut read a moved player's last minute alone, and kept a 5 m "stood still" test the
  read-back made idle, which a mutant said). Indoors the player stands at the building (an interior stands at its
  building's world matrix), and a party lodged at an inn is near whoever is at that inn - its location the one on its
  pixel, the party on the road beside it. Below, nobody is near.
- **OFFLINE, TRAVEL ON WITH THEM** (`R`): the one clock moved as a journey moves it (`advanceOwnMinutes`), the player
  set down beside the party at its next stop - a minute before its trouble, the night's dusk, or a minute short of the
  town, where it last walked (AUDIT LW-II-2 C7: at the town it stood nowhere, and the player was left on the empty
  road) - and the contract's `near` with it (the road walked beside it). Online there is no such choice (decision 6):
  the world's clock is everyone's. AUDIT LW-II-2 C6/H1: OFFERED ONLY WHERE A JOURNEY MAY GO - outdoors, no enemy near,
  no duel, no hostile ship (the host's `travelFree`, the travel map's own refusals): a caravan lodged at an inn stands in
  the tavern, and its door offered R there, moving the open world under the building; `travelWith` refuses the same
  way, leaves a building first if it is ever reached there (`forceExitToExterior`) and catches its teleport.
- **NOT BUILT: THE NEWS** of a caravan robbed or escorted whole (`ROBBED_NEWS`, `ESCORT_NEWS`). It is LW16's, where
  the word travels.

### 4.6 The four hosts, the measure, the pins

- `scenes/world.js`: WIRED (the door, the counter's stock and window, the loot, the reports' charge, the road's slay
  and caught hand, the traveller by place and the trip pending (`travellerOf`, `tripOfId`), the player's own hand
  (`livingSlainAt`), the step once a second in the open world and the modal frame (`caravanStep`), the offline
  travel).
- `scenes/worldModes.js`: WIRED through its API (`openRoadTrade`; the counter's discount and refusal in its trade
  window).
- `scenes/dungeonContext.js`: none (no road). `scenes/exterior.js`: FLAGGED, as LW2 has it. Indoors (a party lodged at
  an inn, LW9) the door stands through the room's talk, and offers no R (AUDIT LW-II-2 C6/H1).

Measure: the step reads the roads' parties already read (a few a second), the character's reports (40 at most) and one
contract. Nothing per frame.

Moved pins: `lw3_roads` (the caught hand's door), `lw7_deeds` (the road's slay), `lw7b_beyond` and `lwfix4_turns`
(the stands' slay) - each now through the LW11 wrapper, which calls the old; `lw2_livingTown` and `legacyhome` (the
talk's doors: a caravan's after the kin's - AUDIT LW-II-2 P15, unrecorded until then).

Moved by the audit: `lwfix4_turns`' records (a hold-up's robbery carried at the leg's end, C9).

AUDIT LW-II-2: `test/auditlwii2_door.test.js` (13), `tools/mutants/auditlwii2_door.json` (44). Moved: `lw11_caravan`
(the host's `travelFree`; the road's caught hand no longer clears the crime; its hold-up fixtures minted through
`handsOn`), `lw2_livingTown` (the save flushes the counters first), `lw3_roads` (the talk's caught line puts the crime
back); re-aimed by content: `lw11.json`'s report, gone, witness and C4/C7/C10 records (`LW11-wire-caught` now aims at
`townTalk.js`), `lw2.json` LW2-regards-unsaved, `lw3.json` LW3-road-watch.

Pins: `test/lw11_caravan.test.js` (21 - AUDIT LW-II: the newcomer witness and the trip pending, the hold-up by the
player's own hand, the escort with the party throughout, the band's purse, the book's robbery last forgotten, the
report's law). Mutants: `tools/mutants/lw11.json` (98).

## 5. LW12 - the outlaws (BUILT 2026-10-09)

Overall improvement: the road's trouble has a face and a home. The law is `src/systems/livingWorld/outlaws.js` (pure:
a region's towns, its roads, a seed and the clock); the hideout is stood by `src/scenes/hideouts.js`.

### 5.1 The bands (`outlaws.js`)

- **HOW MANY** (`bandCount`): 1 + a region's towns / BAND_TOWNS_PER (40), to BANDS_MAX (4); none for a lone town.
- **THE HIDEOUT** (`hideoutsOf`): each band takes a LEG - two of the region's towns of BAND_TOWN_BLOCKS (4) or more,
  BAND_LEG_PX (3 to 14 px) apart - the seed's pick, never two bands on one leg. The hideout stands HIDEOUT_OFF_PX (1-2
  px) off the middle pixel of that leg's planned road, to the seed's side, on dry ground (`dryAt`) and on no town;
  failing that, the next candidate along the road. Until a leg's road is planned the region answers none, asked again
  (the host's book, `hideouts.js createHideoutBook`: kept for the network's generation, a waiting region asked no
  sooner than HIDEOUTS_ASK_MS, 100 ms). AUDIT LW-II C8: its bands found, the troubles read band-less meanwhile are made
  again - kept as none for the session, one reader's caravan was held up by a band where another's, its roads planned a
  few frames later, fought orcs.
- **THE NAME** (`outlawBandName`): "the <word> <band>" off two lists (BAND_WORDS, BAND_NOUNS), or one time in three the
  leader's "<first name>'s <band>".
- **ITS PEOPLE** (`bandPeople`): BAND_SIZE (4 to 8), ids `O<region>.<band>~<gen>.<i>` (a character's heir
  `~<gen>h<heir>`), classes OUTLAW_CLASSES (Thief, Rogue, Burglar, Nightblade, Barbarian, Archer; the leader a
  Nightblade, Barbarian or Rogue), levels 2 + the region's greatest town's blocks / 6 (2 to 14), the leader 3 above,
  the rest -1 to +2. Names off the region's own bank (`census.js residentName`).
- **ITS LIVES** (`genAt`, `outlawBandAt`): each BAND_ERA_DAYS (60) the dice may rout a band - ROUT_CHANCE 0.45 where its
  region keeps a court's city (COURT_BLOCKS 16: its patrols out), else 0.15 - at a seeded minute of the era; its
  hideout stands empty BAND_VACANT_DAYS (20), then the next generation forms. The eras are walked once from the
  world's first and kept per hideout. A rout by the character's hand (`routed`, 5.3) empties it for them as long, then
  its HEIR forms (new people, a new name).
  - Built differently from the design: the design had a patrol's own loop roll against the band. Tying a band's lives
    to every patrol trip back to the world's first cycle is too dear; the era's chance stands for it, the likelier
    where patrols ride.

### 5.2 The hold-up on the dice (`trouble.js`, `outlaws.js bandTrouble`)

- **WHO TROUBLES THE ROAD.** A trouble within OUTLAW_REACH_PX (2) of a hideout standing a band is the band's in
  BAND_SHARE (0.6) of such troubles - the trip's own draw, never the trouble's stream, so every other trouble falls as
  it did. Its foes are the band's people (to FOES_MAX), at their levels; the encounter carries the band's key and name
  (`band`, `bandName`). The host's `bandAt` reads the hideouts of the trip's two regions and the character's routs.
- **A NEW END: ROBBED.** A party whose strength (`strengthOf`) is under ROB_RATIO (0.6) of the band's yields - no
  blood, held HALT_MIN.robbed (30) minutes (FIGHT_MIN.robbed 10: the outlaws standing over it, a fight the player can
  stand), then walking on with `robbed` on its trip (`{ t, by }` - AUDIT LW-II C9: a halt run past its leg's end as
  well): LW10's cargo a quarter, LW11's counter without its
  purse ("The outlaws took every septim we had") and half its goods - the band's, never the character's gone.
  A stronger party fights as any does. A fight the player won for it is won: nothing taken.
- **THE BAND'S TAKE** (`takeOf`): the parties it robbed since it formed and within TAKE_DAYS (14) - each
  TAKE_PURSE_SHARE (a quarter) of a counter's purse (else ROB_GOLD, 40) and TAKE_GOODS (2) of its goods, to
  TAKE_GOODS_MAX (16). The take is `hideouts.js bandChest` (AUDIT LW-II-2 P5: it was world.js's, and no pin ran it),
  reading the troubled trips of its leg's two towns a town-day a step, worked a slice a frame from the frame after the
  stand (AUDIT LW-II-2 C5/H6: it read the fortnight's thirty town-days in the stand frame, 25-110 ms).
- **THE NEWS.** A town's road news of a hold-up names the band (`newsOf`'s `band`; `ROAD_NEWS.robbed`), and a beset
  party's Overworld mark says "beset by the Black Hand"; two parties passing warn of it by name.

### 5.3 The hideout stood (`scenes/hideouts.js`)

- **STOOD LIVE** on foot within BAND_LIVE_M (200 m), once a second: its camp - tents, fire, chest - by every reader,
  and its people by the one it falls to (the road fights' own election online; a reader who becomes it later takes
  them up. AUDIT LW-II C11b: online the camp stood for its owner alone):
  - its tents (TENT_MODEL 41606, the camps' own, through the host's meshes) on a ring of TENT_RING_M about its fire
    (FIRE_FLAT), one each three of its people, at least two;
  - its people as the pool's foes (loose, transient, managed - this host owns their lives), each its class, level and
    name, BAND_RING_M (3-9 m) about the
    fire: all of them by day, by night (before 6, from 20) half - the rest out on the road (`standingAt`);
  - its CHEST, a ground pile (`droppedLoot.seedPile`, unsaved) of its take, laid when the take is worked (CHEST_SLICE_MS,
    3 ms a frame): goods DRAWN on the band's own seed off a general store's back-shelf roll on that seed, none of its
    fixed pieces - no Transportation, no Materials Bag, no provisions or campfires (AUDIT LW-II-2 C4: every chest
    opened with the roll's first pieces, the same Horse, Small Cart and two wagons for every band - about 4,050 gold to
    sell), and the gold - none if the character took from it before (`looted`). A hand in it is `looted` the
    frame the pile differs from its minting - a piece taken, one put in, a stack split (AUDIT LW-II C2: kept at the
    let-go alone and by its count, a piece swapped in, or a save made while it stood, left it whole, and it refilled
    without end).
- **AN EMPTY HIDEOUT** (a vacancy) stands its tents alone: a cold camp, nobody, no chest.
- **ROUTED.** Every one of its people stood KILLED - dead with its body, or executed (`killed`, latched as each falls).
  AUDIT LW-II C3: the pool's relevance cull (120 m) took a band stood at 200 m as dead the frame after, and one gone
  from the pool counted as one down - walking up to a hideout routed it. Then: the character's `routed` tale (`<hideout>@<gen>.<heir>`, its name), `helped`
  regard from every member of the parties it robbed of late (its chest looted or not), and "You have routed the Black
  Hand." Its region's towns
  tell it (`livingTown.js deedNews`, ROUTED_NEWS).
- **LET GO** past BAND_KEEP_M (280 m), under the Overworld or with the living world off: its living taken out, its
  pile taken up - never while one of the band is engaged with the player (the pool cull's own test; AUDIT LW-II-2 C14:
  an outlaw two strides behind vanished at 281 m from the fire). A load or a new game lets it go and writes nothing of it into the new character (AUDIT LW-II C11c).
  Indoors the open world waits as it stood (its
  bodies the exterior pool's, as every foe left outside); the way back out finds the hideout stood, or lets it go.
- **KEPT FOR THE SESSION** (AUDIT LW-II-2 C14): the outlaws struck down before the player left, by the band's key - a
  hideout stood again stands only the rest, and one whose every person is down is routed. Stepping out past
  BAND_KEEP_M and back had stood 4-8 fresh outlaws with their loot again. Another character's records forget them. NOT
  CHANGED (AUDIT LW-II C11a): by night the half in camp, its leader among them, is all a rout asks - the half out on
  the road is not in the camp to beat.
- **IT FOLLOWS THE WORLD** (AUDIT LW-II-2 H2, H9): the streaming origin's recentre moves its tents and fire with the
  camps (`offsetAll`; they stood 819.2 m behind after every map-pixel crossing, round an empty clearing), and a
  teleport lets it go with the camps (it stood a second in the new frame, its chest lootable).
- **ONLINE** every reader's band is the same; a rout is the character's own, as every LW deed is. AUDIT LW-II-2 C13:
  the election is asked each second while the band stands, and a reader who loses it gives its people up; it counts
  the peers within BAND_KEEP_M of the camp (a reader standing it from 250 m and a newcomer at 100 m both stood it).
- ROB_RATIO's one home is `trouble.js` (outlaws.js re-exports it); the duplicate-declaration ratchet holds.

### 5.4 Heard of

- **A WARNING ON THE ROAD.** A traveller's greeting (never an enemy's) adds a warning - "Mind yourself - the Black
  Hand keep a camp off this road." (BAND_WARNINGS) - of a band whose hideout lies within HEARD_PX (3 px) the character
  has not heard of; the character has heard of it (`heard`, the band's key).
- **A HEARD MARK.** Each band heard of, standing, is marked on the Overworld as "Hideout of the Black Hand (rumoured)":
  a dashed ring (`wayfarer hideout`, `ui/travelViewHud.js` TV_HIDEOUT_R) about a point up to RUMOUR_OFF_N (half a
  pixel) from it, never the point (`rumourAt`).
- **NOT BUILT:** a talk's answer naming a band. **OPEN FOR MAC:** a band on the bounty board (section 11, call 3).

### 5.5 The four hosts, the measure, the pins

- `scenes/world.js`: WIRED (the trips' world's `townsIn`, the trouble world's `bandAt`, the hideouts kept, the host
  stood in the open world and waiting indoors as it stood (5.3; AUDIT LW-II-2 H10: this line said "freed indoors", and
  the pin's title with it - the open-world frame's let-go never runs indoors), its tents in the world mesh pass, its fire
  in the billboards, its marks,
  the greeting's warning, the news by the band's name).
- `scenes/worldModes.js`, `scenes/dungeonContext.js`: none (no road). `scenes/exterior.js`: FLAGGED.

Measure (`tools/livingPerfProbe.mjs`, THE OUTLAWS): the synthetic map's region of 81 towns places its 3 hideouts in
about 1.2 ms, once a network; a fortnight's 341 troubles, 7 a band's (5 robbed); the roads' layer at a hideout stays at
1.2-1.4 ms at its worst frame (the budget 6; 1.23 ms re-measured after the audit).

Moved pins: `lw4_trouble` (HALT_MIN, FIGHT_MIN, ROAD_NEWS's ends), `lw6b_remains` and `lw6d_word` (MARK_KINDS,
TALE_KINDS); `nudedecor` (the band's camp fire among the billboards that are no person - AUDIT LW-II-2 P15).

Pins: `test/lw12_outlaws.test.js` (16 - AUDIT LW-II: the chest kept by its minting, the rout by blows, the book asked
again and its two readers alike, the robbery at the leg's end, the camp every reader's). Mutants:
`tools/mutants/lw12.json` (93).

AUDIT LW-II-2: `test/auditlwii2_outlaws.test.js` (10), `tools/mutants/auditlwii2_outlaws.json` (47); world.js wires the
recentre and the teleport too, and the trouble world's `resolved` remakes LW16's kept word with the troubles (H3: the
news told, the visitors and the carried word kept what was read band-less, and a late reader told another story).
`tools/livingPerfProbe.mjs` stands every hideout, its stand frame counted. Moved: `lw12_outlaws` (the chest a generator,
worked a frame after each second; the wiring's `resolved`; the title that said "freed indoors", H10), `audit26_dungeonfoes`
F212 and `travelmap` U41 (their windows past `_teleportToPixel`); re-aimed by content: `lw12.json`'s host-keep,
looted-read, C3-thanks, C11b-takeup, C11b-once and C8-wire records, `blood1.json`'s two teleport records.

## 6. LW13 - the companies (BUILT 2026-10-09)

Mac: "groups of npcs forming parties and traveling". The law is `src/systems/livingWorld/companies.js` (pure, over the
census's roster) and `src/systems/livingWorld/trips.js` (`leaderOf`, `ownTrip`, `holyTrip`, `formCaravans`).

### 6.1 The company (`companies.js`)

- **THE DEAL** (`companiesOf`, once a roster). A town's adventurers in slot order: each company's size off its first
  place's seed, COMPANY_SIZE (2-4), to COMPANY_CITY_MAX (5) where the town keeps COMPANY_CITY_ADVENTURERS (5) of them
  (a city's). Each place after the first is the next in slot order of a run the company lacks - a mage's (128-133), a
  thief's (134-139), a warrior's (140-145) - where one is left, else the next. One left over goes alone, as before; a
  town of one adventurer keeps no company. No census id changes: a company is its places.
- **THE NAME** (`companyName`, `namedIn`): "The <word> Company", "<beasts> of <its town>" or "<first's> company" (the
  first place's census name), off the company's key `C<map>.<i>`.
- **THE HEAD** (`headOf`): the highest level of those walking. The trip is the company's FIRST place's - its cycle
  and its dice, as a patrol's is its first's (`leaderOf` answers the first for every other place; `placeCycle`
  follows) - and the head is its word: the greeting's regard and the talk's refusal are the head's.
  - Built differently from the design: the design made the highest-level holder the trip's leader. A trip's id and its
    dice are its leader's place's, so the first place keeps the trip and the head speaks for the company.
- **A COMPANY IS ITS PLACES.** Every place's holder that cycle walks with it (a place standing empty walks with nobody;
  the newcomer who holds it belongs to it - `lives.js` unchanged).
- **ONE CYCLE, ONE TRIP.** No place but the first has a trip of its own (`ownTrip` answers none); every member's away
  window is the company's (`awayOf` reads the party). A member whose place is fated that cycle sends the company out
  whatever its first's chance said.
- **WHAT IT DOES.** A DIVE in COMPANY_DIVE_CHANCE (0.75) of its cycles (a lone adventurer DIVE_CHANCE, 0.55), else a
  town's trip.
- **HIRED.** A company setting out the day a merchant's train with no sellsword hired does, for the same town, walks
  in it - its trip dropped, the train marked `hiredBy` (the joiners' law). Built differently: the design gave the hire
  to merchants of towns that keep no sellswords (under nine blocks); no such town keeps two adventurers, so the hire
  goes to any train setting out with none. One company to a train (AUDIT LW-II E4, `trainFor`): the first in the deal
  takes it, and a second walks its own trip - it was dropped into the same train's hire and vanished.
- **PILGRIM BANDS.** A town's pilgrims setting out the same day for the same town, in no merchant's train, go
  together, the first place leading.
- **THE HOLY DAY** (`holyDayOf`, `holyTrip`). A pilgrim's cycle with a temple town in range keeping its region's own
  holy day (`holidays.js getHolidayId`; never a day every region keeps) goes to it on the pilgrim's own draw
  (HOLY_CHANCE, 0.8 - AUDIT LW-II F7: on it alone; the cycle's own chance was asked first, and the cycle's draw is
  still taken in its order, so no other trip's dice move): out at one minute of the morning for its town (`holyDepartMin` - so its pilgrims go as a band),
  in by HOLY_IN_H (10) of the holy day, home the morning after - inside the cycle, or the trip it always was. A
  pilgrim come to a temple town keeps its temple (`dayPlan.js` `pilgrim-visit`: PILGRIM_TEMPLE_H, 8:30 for the morning
  and 15:30), so on the holy day the temple is full of every band of the region's towns (LW8 stands them inside).

### 6.2 Seen

- On the road a company walks in file by role (`byRole`): warriors before, thieves between, mages behind; it camps
  together. Its Overworld mark reads "The Lantern Company, to Mournoth" (the dungeon by name on a dive), "...beset by
  Orcs" in a fight.
- Its greeting names it (COMPANY_GREETINGS: "The Lantern Company - you've heard of us?"), by its head's regard. Each
  member keeps their own regard; the company's word to the player is its head's.
- The chronicle's People page (`people.js peoplePage`, `ui/enhancedChronicle.js`): each card a member's company, and a
  COMPANIES group - each company any of the known walk with, its town and the members the character knows.

### 6.3 The measure, the pins

Measure (`tools/livingPerfProbe.mjs`, THE TRAFFIC): within 3 px by day the adventurers' parties fell from 69 to 38 (a
company walks as one); the roads' layer's worst frame 0.9-1.5 ms (the budget 6).

Moved pins: `lw4_trouble` (a fated member's place sends its company's first), `lw6_deep` (a company's dive chance).

- **NOT CHANGED (AUDIT LW-II E9): THE PLACES RE-KEYED.** A company's later places live by its first's cycle, where
  they lived by their own: a hand's turn (`slain`, `died`) on such a place saved within one cycle before the release
  that carries LW13 is read a cycle off - its member can stand again for up to one cycle, or a vacancy come a cycle
  late. Once, at that release. A load-time re-key would need each turn's minute mapped to the first's cycle, which the
  record does not keep. AUDIT LW-II-2 R10: every turn keyed by place and cycle moves so (`livingTripTurnKey` - the
  road's `spared` and `fallen` too, so a member saved can fall after all in that cycle), and a `won`/`lost` on a later
  member's own trip, which LW13 no longer makes, is never read again.

Pins: `test/lw13_companies.test.js` (10 - AUDIT LW-II: one company to a train; the holy day on its own draw).
Mutants: `tools/mutants/lw13.json` (45).

## 7. LW14 - the deep's own (BUILT 2026-10-09)

Mac: "smarter and more dungeon diving npcs". The law is `src/systems/livingWorld/deepRoute.js` (pure over the
dungeon's own markers and the dive); the dungeon's build reads it in `src/scenes/dungeonContext.js`, and the company
below is `src/scenes/dungeonDivers.js`.

### 7.1 The dive's route (`deepRoute.js`)

- **THE STOPS** (`stopsOf`): the dungeon's random foe markers (editor record 15, STOP_FOE) and random treasure markers
  (19, STOP_TREASURE - each its one home's: `characters/dungeonEnemies.js RANDOM_RECORD`, `systems/loot.js
  RANDOM_TREASURE_MARKER_RECORD`; AUDIT LW-II-2 D11: they were two literals beside them), off the placed blocks'
  layouts - never a fixed foe (16), a quest's marker (11, 18) or fixed treasure (archive 216). Keyed `<block>:<marker position>`, a foe's by its marker's LoadID too. Read at the dungeon's
  build only; the trips need none of it.
- **THE ORDER**: from the start marker's block (none: the starting block's middle - AUDIT LW-II-2 D10, it was the
  layout's first block), the blocks breadth first by their grid (a block's neighbours east,
  west, south, north; a block the grid does not join, last), and within each block nearest first from where the
  company came in. No room graph: the block grid is the plan.
- **THE TIMELINE** (`routeOf`): from the dive's in (`trip.dive.t0`), each stop its minutes - a foe's DEEP_FOE_MIN
  (25-40) by its seed, a treasure's DEEP_TREASURE_MIN (10) - and the walk between DEEP_DETOUR (1.6) times the floor
  distance at DEEP_WALK_M (30 m a minute). The stops left by the dive's middle are its REACH; then THE WAY OUT, the same
  stops back to the start by the dive's end.
- **WHERE THEY ARE** (`stopAt`, `pointAt`): at a stop (fighting at a foe's), between two, resting at the last, on the
  way out, or not inside.
- **THE DICE'S END, WHERE IT FELL** (`stopOfMinute`): a dive's fated trouble falls at the stop its minute reaches (the
  nearer of two walked between; on the way out, the reach's stop nearest where they walk - AUDIT LW-II-2 D9: it was the
  deepest); LW6b's remains are laid THERE (`deepRemains.js placeOf`), a pace apart by their order (DEEP_APART_M, 1.5 m,
  the road's own spacing, each walked out from the stop's floor - AUDIT LW-II-2 D6: one dive's fallen lay on top of
  one another), the hashed resting place only where no route is known.
- **MORE TROUBLE IN THE DEEP** (`deepFightOf`): DEEP_RISK (0.5) of the dives with no trouble met inside (AUDIT LW-II-2
  D8: any trouble, the road's too, took it away - 0.42 measured) meet a fight of the deep's at a foe stop of the seed's
  - DEEP_FIGHT_MIN (20) more there, the rest of the reach after it (AUDIT LW-II-2 D13: a trim after it that could
  never fire is gone). Always won (only
  the fated die, by the lives' law); it is the route's own, so no trip changes for it.

### 7.2 What they leave behind (decision 3)

- **AT THE DUNGEON'S BUILD** (`dungeonContext.js`; the modes host's `deepCleared`, the outer host's
  `livingDeepCleared`): every dive into the dungeon whose hours touch the last DIVE_CLEAR_MIN (a day: `trips.js
  divesIn`) is routed over the dungeon's stops, and every stop one LEFT before the build's minute is CLEARED
  (`clearedOf`): its random foe BUILT DEAD - its corpse where it stood, its pack emptied (`setFoeDead`) - and its random
  treasure pile built EMPTY (its flat gone, as one the player emptied). A stop a company is at now is being fought,
  not cleared; after a day the dungeon is as Daggerfall builds it. AUDIT LW-II D1: the clear stands at the build's
  END, after every binding a corpse reads (it stood where the foes are stood, before the relay's clock and the batches
  were declared: every corpse's mint threw, and each cleared foe went dead with no body). D3: a foe is matched by its
  PLACED block and its LoadID (a LoadID is its RDB block's, so a block a dungeon lays twice shares every one).
- **ONLINE NONE** (AUDIT LW-II D5 - the design's "every reader builds the same set" was false): the set is a read at
  each reader's own build minute over its own book, cold with its ways still to ask, so readers differed, and the
  room's stream then stood up a joiner's dead with their packs emptied and handed the authority's dead to peers as
  kit-rolled corpses. A room's dungeon is the room's (its stream says which foe is dead and what a pile holds).
  Offline, a book still asking its ways reads fewer dives - fewer stops cleared, never a wrong one. AUDIT LW-II-2 D7:
  an Ocean Holes abyss is cleared by nobody's dive - it is built off a land dungeon's template, whose id it bears until
  the build is done, so that dungeon's dives cleared it (`livingDeepCleared` answers null while the abyss builds,
  `ohAbyss.shouldUpgradeLoot`, the predicate its loot reads there).

### 7.3 Found where they are, and live (`dungeonDivers.js`)

- **MET WHERE THE ROUTE HAS THEM**: a company is stood about its place (`pointAt` on its floor) once the player is
  within DEEP_NEAR_M (15 m) of it, or DEEP_SEE_M (35 m) with a clear line (the pool's `clearLine`), and HOLDS there
  (no follow) - on the player's floor alone (AUDIT LW-II D7: within DEEP_FLOOR_DY, 3 m; one a floor above or below is
  heard, never met). Where no route is known, met behind the player and following, as LW6 had it. D9: the floor's five
  rays only for a company within hearing.
- **THE SOUND**: not met yet, a company fighting within DEEP_HEAR_M (60 m) rings the game's own steel at its stop every
  DEEP_RING_S (2.5 s), with "You hear fighting ahead." said once.
- **THE DOOR** (`offers`; underground the activation's `openLiving`, `mobileEnemyActivate.js`): pressing one of them in
  any mode but Steal asks - JOIN US (they follow the player along the player's TRAIL, crewAshore.js's law: a crumb each
  DIVER_TRAIL_STEP_M, DIVER_TRAIL_MAX kept), LEAD ON (each walks to their next stop's floor by the motor's own walk,
  then on to the one after - AUDIT LW-II D4: arrived when each stands within its own follow stop and
  DIVER_ARRIVE_SLACK_M, 2 m; a fixed 3 m held a company of three at its first stop for good), PART WAYS (they keep to
  their own, asked no more), talk. Stood and not asked, they hold. D11: at the treasure's reach (the HUD's one refusal
  past it), and never in Info ("You see"). D6: on the way out there is no stop ahead (the first stop, passed hours
  before, was taken as theirs).
- **HURT**: a member under RETREAT_HP (0.3) of their health falls back RETREAT_BACK_M (4 m) (a new walk - join, lead on -
  a new chance to); the company under half the strength it STOOD with makes for the way out (its survivors' regard, the
  fated spared). AUDIT LW-II D2: the strength is counted as each body arrives, read once none is still coming - the
  armed counted before any arrived, the first body in made the company "had enough" with nobody hurt (and paid its
  regard and spared its fated for nothing). THE END IS WHAT HAPPENS.
- **LET GO** past DEEP_KEEP_M (70 m) from its nearest standing member, not joined - met again further on its way, AS
  IT WAS LEFT (AUDIT LW-II D8: parted or not, each member's share of health); one drawing on the player is never let go
  (outrun, it stood again whole). AUDIT LW-II-2 D1: it was measured from where a company LEADING ON was going, so a
  company asked to lead to a stop past 70 m vanished from beside the player the next frame (one leg in six).
- **A LOAD LETS THEM GO** (AUDIT LW-II-2 D2): world.js's load door clears the divers and the remains with the portals,
  and a body that is dead and no longer in the pool is forgotten with no turn written. A load in the same dungeon kept
  both layers over a pool the save had cut: the company stood after the save was the tail it cut, read the next frame
  as fallen beside the player - `died` written into the loaded game, a courtship ended - and a pile laid after the save
  was read as taken. Met again after the load, a company stands fresh from its route.
- **THE DOOR ABOVE** (AUDIT LW-II-2 D4): the open world lets the divers go with the remains, and the talk asks the
  divers' door only below; `offers` answers whether a window mounted. A company held below and met above on the road
  or in its town took every talk with its people and opened nothing.
- **RIVALS**: a company not joined whose head is no friend minds its finds: the player taking from the treasure pile at
  the stop it makes for (within 4 m of it) costs each member `poached` (EVENTS, -4, once a day as a tone, kept in the
  save), with the head's word "That was ours to find." - once a pile (AUDIT LW-II D12: it was said once an item).
  AUDIT LW-II-2 D5: only the player's own take - the pile's own pieces as first seen, read again when the room's word
  lands in it (`dungeonContext.js applyLoot` counts it); a peer's take arriving from the room, or a piece put in and
  taken back, was charged to whoever stood by.
- **REMAINS** (AUDIT LW-II D13): a dungeon with no resting place (treasure stops alone) still lays its fallen where the
  route has them; the places kept by the remains' key (D9).
- Not built: the navmesh walk's own pathing for LEAD ON (the motor's follow walks to the stop as it walks to the player)
  and DEEP_SEE_M's line from every member (the place's own).

### 7.4 The four hosts, the measure, the pins

- `scenes/dungeonContext.js`: WIRED (the stops, the cleared set at the build, the pool's `deepStops`, `deepEntry`,
  `stopPile`, `floorAt`, `clearLine`, `ringAt`).
- `scenes/worldModes.js`: WIRED (the build's `deepCleared`, the activation's `openLiving`).
- `scenes/world.js`: WIRED (`livingDeepRoute`, `livingDeepCleared`, the divers' deps, the remains' `placeOf`, the door).
- `scenes/exterior.js`: none.

Measure: the build's read of a dungeon's day of dives costs at most about 95 ms on a cold book (the towns within reach
read back a day), paid once, inside the dungeon's load; a route is kept by trip for the dungeon.

Moved pins: `lw1_livingWorld` (EVENTS' `poached`), `lw7b_beyond` (the divers' deps), `lw2_livingTown` and
`lw11_caravan` (the talk's door asks a company below too). AUDIT LW-II: re-aimed by content `lw6b.json` LW6b-places
(the remains' guard), and the door's reach line written apart from the companion's (`auditwatchkit_ui.json`'s
WK-P6 records name one site).

Pins: `test/lw14_deep.test.js` (12). Mutants: `tools/mutants/lw14.json` (64).

AUDIT LW-II-2: `test/auditlwii2_deep.test.js` (15), `tools/mutants/auditlwii2_deep.json` (34); the host's divers' and
remains' steps wrapped as their neighbours are (a throw there no longer ends the frame loop). Moved: `lw14_deep` (a fated
trouble is `inside`; the harness's `choose` answers it mounted), `lw6_deep`, `lw6b_remains` and `lwfix6_rooms` (the
wrapped steps), `lw11_caravan` and `lw2_livingTown` (the talk's door asks the divers below only), `portal1_stone` (the
load door); re-aimed by content: `lw14.json` LW14-fight-fated, LW14-keep, LW14-rival-near, `lw6.json`
LW6-host-divers-unmet, `lw6b.json` LW6b-host-step, `portal1.json` PORTAL1-a-load-keeps-portals.

## 8. LW15 - the patrons (BUILT 2026-10-09)

Mac: "npc autonomy that can visit player shops and purchase from them"; "Players can set up decorations that can be
used as shops". The law both ends read is `src/net/patronLaw.js`; the service's reckoning is
`server-account/src/market.js reckonPatrons`; the client's half is `src/systems/livingWorld/patrons.js` and the day's
errand in `dayPlan.js`.

### 8.1 Who decides a sale: the service, by a law both ends read (`net/patronLaw.js`)

- **THE HOUR IS THE WINDOW.** Each open trader listing (gold, a pack's piece, at a trader of a home whose `entry` is
  `public`, its owner the seller, no guild's hall) is offered to its town's patrons once for each whole real hour it
  stands (an online sky day is a real hour, TIME1).
- **THE PRICE DECIDES** (`patronCap`, `patronOdds`): the cap is PATRON_PAY_SHARE (0.6) of the piece's worth as the
  service judges it (`itemLaw.js itemWorth`'s FLOOR: the piece priced at nothing - what it is. AUDIT LW-II P2: never
  the record's own `value`, which is the client's to write and the judge reads up to a generous ceiling - a found
  Broadsword written at 1e9 was worth 11,840, a patron's 7,104); with r the price over the cap, the hour's odds are 0.25 at r <= 0.5,
  0.12 at r <= 0.75, 0.05 at r <= 1, and none above it (PATRON_ODDS). Nothing for nothing: a price under 1, or a
  piece with no cap, never sells. AUDIT LW-II-2 S1: THE WORTH IS THE LOWER OF THE FLOOR AND THE RECORD'S OWN PRICE
  (`value` x its stack - a client lowering it only cheats itself; no price, no worth): a book's floor is its template's
  2500 where its own price is its file's 300-800, a recipe's its sheet's where its own is its potion's - bought at a
  bookseller and listed at the cap, fourteen books held 2.02 times what they cost. S9 (found fixing it): the wire's
  value floor (`loot.js wireLootItem`, AUDIT WORLD6a B1's) lifted every book to its template's 2500 and every recipe
  to its sheet's - a counter's book set down in a room's shared container and taken up again sold back for more than
  it cost; the wire floors a book at its file's price and a recipe at its potion's now (`wireFloorOf`).
- **A CRAFTED PIECE NO DEARER** (`patronWorth`): its worth is no more than the piece it was made as - the crafted
  marks off (`provenance`, `quality`, `hand`, `kitMetal`, `fieldKit`, `potent`), its value nothing. Shops are the
  floor, crafting the ceiling: a patron never pays a crafter more than a found piece fetches.
- **NEVER** a quest's piece or a keepsake (`patronTakes`: `questItem`, `livingKeepsake`, the keepsake's template
  1800), nor a PIECE BOUGHT AT A COUNTER ONLINE (AUDIT LW-II-2 S1: `counterBought`, `PATRON_COUNTER_MARK`, stamped at
  both of worldModes.js's Buy doors - every shelf, the guilds', a street merchant's and the caravan's counter walk one -
  online only, kept by the save, the item law (`itemFields.js`), a listing, a stack merged (either part's) and split.
  REALM P0.4's law, whole: online a counter's sale never beats what it asks, and a patron paid more than a good
  haggler pays at a quality-1 counter - buying there and stocking a trader printed gold, a fifth up at the least, far
  more in a cheap region or a festival. The mark is the client's to write, as `value` is: a modified client can strip
  it, as it can raise a book's price to its floor); and the item law and the market's own law are read again at the sale, as a buy reads them (`lawfulItem`,
  `goodRefusal` - AUDIT LW-II P3: read only at the listing).
- **THE TOWN'S DEMAND IS SHARED** (`patronHour`): the hour's sales are the lowest draws under their odds
  (`patronCands`; `patronDraw`, the listing's, the hour's and the service's SECRET - AUDIT LW-II P10: on the listing
  and the hour alone the dice were public, and a seller could compute the hour each piece would sell in and list again
  until one sold at once. The secret is `market.js patronSalt`, of the service's identity key, before and after the
  listing in the hash - before alone, the whole secret is one 32-bit state a seller's own sales give away. The seed and
  the minute a client is told stay the listing's and the hour's), at most PATRON_TOWN_HOUR (4) for the town's traders together
  (the hour's sales already made counted), PATRON_SELLER_HOUR (2) a seller, PATRON_SELLER_DAY_GOLD (20,000) a seller's
  real day.
- **THE BUYER**: the service names a SEED and a MINUTE of the hour (`patronSeed`, `patronMinute`), never a person.
- **THE HOURS RECKONED** (`patronHours`): from the one after the listing's last (`market_listings.patron_hour`; none,
  its own first whole hour) to the last whole one, at most PATRON_RECKON_HOURS (48).

### 8.2 The service (`server-account/src/market.js reckonPatrons`, migration `0105_patrons.sql`)

- **THE SALE**, each its own batch: its row (`market_patron_sales`, keyed by the listing - reckoned twice, sold once;
  its house kept, `building_key` - AUDIT LW-II P9: told by a join on the piece's id, another's piece of the same id in
  the town told every sale twice), written only while the listing is open at the same price, the seller's held gold
  has room (MARKET_GOLD_HELD_MAX: a patron passes a trader whose purse is full by), the town's hour, the seller's hour
  and the seller's day have room, and the seller is neither held by the judge nor unjudged - each asked IN the write
  (AUDIT LW-II P1: asked before it, six towns read at once sold twelve of a seller's pieces an hour and 48,337 gold a
  day; P4: a held seller sold) - with `mustChange`. A write the guard refuses is a pass, the hour reckoned; any other
  failure stops the town at the last hour it finished (P11: every failure counted as a pass, past an unsold hour); the listing `sold`; the 5% tax and 1% fee burnt
  (`goldSaleOf`), the rest to the seller's held gold (`market_gold`); the gold written to the service's own faucet
  (`budget.js faucetStatement`, kind `patron`, table `realm_faucets` by the hour), for staff to read before a budget is
  enforced (AUDIT LW-II-2 S6: and read - `/v1/mod/realm-budget`'s measure names the window's faucet gold, and
  `tools/realmReview.mjs` prints it; nothing read the table). No delivery: the piece leaves the realm; the INT4
  duplicate ledger is told (AUDIT LW-II-2 S2: `ledger.js escrowSpentSteps` - a claimant charged as a player's buy
  charges it, the row gone; else the row deleted - a patron's sale left the piece's escrow row and its claim for good,
  so a duper sold one copy for minted gold and kept the other uncharged).
- **WHEN**: lazily on every read of a trader - `/v1/market/vendor` (its town), `/vendors` (its region), `/myvendors`
  (the owner's towns) - and in the hour's cron (HOUR_JOBS `patrons`: PATRON_CRON_TOWNS (40) towns a firing, the longest
  waiting first, inside the job's share of the firing's statements; only while the market is open to everyone,
  `marketOpenFor` - AUDIT LW-II P8: shut, every route answered 'market-closed' and the clock paid patrons anyway).
  AUDIT LW-II-2 S3: and only then - `reckonPatrons` asks the switch itself (a developer's read under `dev` reckoned
  every seller of the region), while it is shut the hour's job MARKS every open trader listing to the hour
  (`markPatronsShut`), so reopening pays none of the shut hours, and the migration marks every open trader listing to
  the hour before it runs, so no hour before the patrons existed is paid. A
  reckoning its budget stops marks the last whole hour it reached, so firing by firing a town nobody reads is reckoned
  through. The dice are pure: reckoned late, the same sales as reckoned every hour (`reckonPatrons(ctx, opts, env)`).
- **BOUNDED** (AUDIT LW-II P5: one region's read two days behind ran 5,826 statements, where D1 answers an invocation a
  thousand): the law's dice asked before the database (`patronCands` - an hour no listing draws under its odds asks
  nothing), one counts query an hour with a candidate (`PATRON_COUNTS_SQL`), PATRON_READ_STATEMENTS (200) a read and
  the rest the next's, the mark written only where it moves.
- **A DOOR OPENED** to the town opens its trader FROM NOW (AUDIT LW-II P7, `homes.js setHomeEntry`): its listings are
  marked reckoned to the hour it opens in (AUDIT LW-II-2 S4: to the hour before, so a door opened at :59 and read at
  :00 took a whole hour of patrons), and a door leaving public reckons its town first - twenty pieces stocked behind a
  private door all sold, at its opening, in the hours before it. A town whose traders all stand behind shut doors is
  marked as it is read.
- **KEPT** with the market's history: pruned by `pruneMarketHistory` at MARKET_KEEP_DAYS, indexed for the region's read
  (`region, at`) and the hour's counts (`day`) (AUDIT LW-II P6: the region's read walked the table whole, and nothing
  pruned it).
- **TOLD**: within PATRON_TOLD_S (a day), newest first, each `{ listing, map, vendor, buildingKey, hour, minute, seed,
  price, name }` - a trader's read its own house's (AUDIT LW-II-2 S7: two traders of one id in a town both told each
  other's), the region's read its region's (a trader sold out still tells its last day's); `/vendors` names every public
  trader house of the region, the board's 300 newest rows and one row more for each house they left out (AUDIT LW-II-2
  W6: a town's older trader dropped off the 300 and lost its browsers); `/myvendors` answers `patronSold`, each with `patron: { map, seed, hour, minute }`.
- Built differently from the design: the sale is its own table, not a `market_sales` row whose buyer is the patron's
  mark (`market_sales.buyer` is a player's key), keyed by the listing rather than `(buyer, rid)`.
- A HELD OR UNJUDGED SELLER IS NO CANDIDATE (AUDIT LW-II-2 S5: the first audit left its pieces in the hour's choice,
  refused only in the write - never added to the hour's gone, they were drawn again every hour and took the town's
  slots while their stock stood: an honest seller beside four held ones sold 6 where alone 22); the write keeps its
  guard. Each listing is judged in its own try (S8: one that threw stopped the cron for every town after it), and
  `lootRarity.js validAffix` reads `Object.hasOwn`. A reckoning handed no `env` (the tests' direct calls alone) reads
  the public dice.

### 8.3 Drawn, by the client

- **THE TOWN'S TRADERS** (`world.js livingPatronsStep`): online, while a living town stands outside, the region's
  traders (`/v1/market/vendors`) read once each PATRON_READ_S (600 s) of real time: each town's public traders' houses
  and the sales told, their minutes as sky minutes (`skyClassicMinutes` of the service's own instant - AUDIT LW-II B5:
  never this machine's offset to the relay, which moved a sale's day on a clock some minutes off). Each town's word is
  in one order for every reader (the traders by key, the sales by minute), its version moved only when its word did,
  and a town of the region read with nothing now forgets what it had (B6/B7: the rows' order moved browsers' errands,
  every read made every town's day again, and a shut trader kept its browsers). Each town's LivingTown asks its own
  (`patronsOf`) and plans its day again when the word changes. Offline, nothing: no service, no sale.
- **THE BUYER DEALT** (`patrons.js patronOf`): the seed goes to one of the town's households (the census's `h` roll,
  never the watch, a visitor or a guardsman), in the order of their ids - every reader deals the same one - over the
  people HOLDING the town's places that day (AUDIT LW-II B12: `peopleOf` - a newcomer where the census's own is gone;
  over the census, the dead were dealt and named).
- **THE ERRAND** (`patronVisits`, `dayPlan.js patronErrand`): to the trader's house's door, in for PATRON_STAY_MIN
  (25), and out again, PATRON_DELAY_DAYS (2) living days after the sale's own (AUDIT LW-II B1: online a living day is a
  real hour, the service reckons whole PAST hours and a reader asks each 600 s - the sale's own day was over before any
  reader knew of it, and no patron was ever seen walking in). An APPOINTMENT (B2): laid before every stay that begins at
  its minute or after, the stay it falls in (or ends within a walk of) cut for it and taken up again after (a keeper
  slips out to the trader's and back to the counter), and it may come PATRON_LATE_MIN (45) late and still go in. A
  sale's minute outside PATRON_OPEN_H (09:00-17:00 - an evening's errand ran into a farmer's bedtime) comes at its place
  in the open hours' fold. Measured on the synthetic town (thirty a resident a day, every household, four days): 0.3%
  of errands dropped at the calendar's pace, 3.5% at the online pace (a long day's walks) - a tenth and a quarter
  before. Built differently from the design: the buyer is any household, not one FREE at the minute; the errand makes
  the time.
- **BROWSERS** (`dayPlan.js` `browse`): PATRON_BROWSE_SHARE (0.1) of a household's errands go to one of the town's
  public traders' houses instead, on a draw of their own - they look and never buy. A town with no trader plans as it
  did (pinned by a digest of LW14's plans). Built differently: any errand, not by the trader's stock's kind.
- **THE OWNER IS TOLD** (`vendorPage.js`): its sales to patrons beside its sales to players, "Sold to Ada Lark of
  Wayrest - ..." - the host's `patronName` (`livingPatronName`: the town's LivingTown's `patronOfSale`, the one who
  walks in, where it stands, else "a townsperson of" it).
- Not built: INSIDE (8.2 of the design) - a patron or a browser goes in at the house's door and comes out; the town is
  still never inside a player's home. The town's talk of a good find at the player's house is LW16's.

### 8.4 The four hosts, the service, the pins

- `scenes/world.js`: WIRED (the region's traders read, each town's `patronsOf`, the Vendor page's `patronName`).
- `scenes/worldModes.js`, `scenes/dungeonContext.js`, `scenes/exterior.js`: none.
- The service: migration `0105_patrons.sql` (`market_listings.patron_hour`, `market_patron_sales` and its indexes,
  `realm_faucets`; the account's version `acct105`, and `accountworker`'s table list and every `ACCOUNT_VERSION` pin
  moved with it - AUDIT LW-II-2 P15), `market.js` (the reckoning, the reads, the prune), `homes.js` (a door opened marks its trader),
  `cron.js` (HOUR_JOBS `patrons`, behind the market's switches), `budget.js` (FAUCET_KINDS,
  `faucetStatement`), `.github/workflows/account-deploy.yml` (the law's file among the paths that deploy the Worker,
  `test/accountdeploy.test.js` ACC1-CI). The account service redeploys on merge.

Pins: `test/lw15_patrons.test.js` (12) - the law (the share, the odds, the over, the draws, the takes, a crafted piece
no dearer, the hour's odds measured); the hour (the town, the seller, the day, the order, the hours); the service
through the real Worker over node:sqlite (the sale, the gold, the faucet, twice the same, late and hourly each the
law's own fold, a private home none, a piece taken back mid-reckoning none, a full purse none, the region's read); the
cron firing by firing; the dealing, the errand cut and taken up, the night's fold, the browser, the Vendor page's
words; the host's seams; and AUDIT LW-II P1-P11 each through the real Worker (the ceilings held in the write under six
reads at once, the floor's worth, the laws read again, the held seller, the read bounded, the sales told once and
pruned, the door opened from now, the switch, the secret, the failure unmarked). Mutants: `tools/mutants/lw15.json`
(106).

AUDIT LW-II-2: `test/auditlwii2_service.test.js` (14), `tools/mutants/auditlwii2_service.json` (45). The counter's mark:
`worldModes.js` WIRED at both Buy doors (`commitTrade`'s Buy arm, `doBuy`); `world.js` through it (the caravan's counter
is `openRoadTrade`); `exterior.js` and `dungeonContext.js` none (no counter's Buy). Moved: `lw15_patrons` (P7's door marks
the hour it opens in, S4), `auditscale` D7 (the shut market's hours marked - twenty-two statements an hour, S3);
re-aimed by content: `lw15.json`'s takes-keepsake, P2-floor, told, cron-job, P3-law, P3-refusal and P8-switch (its
tests the service lane's file too - the reckoning asks the switch itself now).

## 9. LW16 - the word travels (BUILT 2026-10-09)

Overall improvement: what happens in one town is heard in the next. The law is `src/systems/livingWorld/carried.js`
(pure); the town's half is `livingTown.js` (`deedNews` of any town, `carriedAt`, `reputeAt`, `regardOf`, the greeting);
the host's is `scenes/world.js` (the visits, worked a slice a frame).

### 9.1 The word carried (`carriedNews`)

- **A VISIT TELLS WHAT ITS TOWN KNEW WHEN IT SET OUT**: a party come in from a town about (its trip's `from`) carries
  that town's news of the road (trips.js `newsOf` of its own parties, the fights the character turned among them) and
  the character's deeds known there (`deedNews(minute, town)`: one of it struck down, one died at the character's side,
  a keepsake carried home, a band of its region routed, a party of its region robbed) - each as it stood at the
  minute the party set out (`outT0`): a deed known after they left stays behind.
- **KNOWN HERE FROM ITS COMING IN** (the trip's `outT1`) for NEWS_DAYS (3), from the visits of the last NEWS_DAYS days.
  Never the town's own news as carried; an item two carried, from the first in. AUDIT LW-II B8: never its own region's
  tales (a band of it routed, a party of it robbed) carried in from a town of the region - they are its own word, and
  carried in again they outlived its own days.
- **A COURIER, ONE HOP FURTHER**: a party with a courier carries too what its own town had heard from ITS visitors by
  the time it set out - each item from the town it was first told in. Never two hops, and never the town's OWN word
  come back (B8: a courier's town had a visit from this one - told here as "word from" itself, its deeds' repute
  counted again).
- **TOLD** (`lines.js newsScript`): CARRIED_SHARE (0.3) of the news a meeting tells, on a draw of its own - a town with
  none tells its own as ever (the old law replayed, pinned); a town with ONLY the word carried tells it as often as
  another its own (B10: it told a third as often) - its script opened by one of CARRIED_OPENERS ("There's word from
  {from}."), the town it came from (`meetups.js circleLine`'s `{from}`; TOKEN_FALLBACK "the next town"). B14: a band is
  named whole in the talk ("Mac routed the Red Hand", never "routed the").

### 9.2 The character's repute (`reputeOf`)

- Each deed of the character known in a town, its own or carried in, has its REPUTE: a keepsake carried home
  (`saved`) +4, a fight turned on the road (`helped`) +2, a band routed +5, one of a town struck down where it was SEEN
  (`slain`) -8, a party robbed (`robbed`) -5. One struck down unseen, one who died at the character's side, another
  hand's killing and Project Legacy's house's news carry none. AUDIT LW-II B9: the road's news counts once the town
  knows it (the day's word is read at its noon - a fight turned, its party home at eleven, counted at five).
- **A STRANGER'S REGARD** (`regardOf`; the talk's rows, `world.js livingRegardOf`): one with no regard of their own
  takes the town's repute, the sum held between REPUTE_MIN and REPUTE_MAX (ENEMY_AT + 1, FRIEND_AT - 1): read, never
  stored - a name heard makes nobody a friend or an enemy. A known face keeps their own. AUDIT LW-II-2 W9: WHAT IT
  MOVES TODAY IS NOTHING A PLAYER SEES. Held inside the two lines, the regard reads `neutral` for every greeting (the
  greeting asks the resident's own standing), and its one reader, the talk's Legacy rows (`legacyTopicRows` ->
  `marriage.js topicsFor`), asks a friend's regard for its court topic, which the bound never reaches. What is seen is
  the deeds the repute carries, in the heard greeting below. Mac's call 7 asks what it should move.
- **A STRANGER WHO HAS HEARD** greets the character by it (`greetingFor`, `heardOf`): HEARD_SHARE (0.5) of a stranger's
  words, one of the deeds known (HEARD_GREETINGS: "You're the one who drove off {foe} on the road to {place}?", "I
  know who you are. I heard about {who}.").
- **A PARTY ROBBED, TOLD** (built here: the design named the repute, nothing kept the deed): a robbery the road
  reported (LW11 - a hand in a caravan's goods, its hold-up, a purse picked) is, once a witness carries it in and it
  is charged, a tale of its region's towns (relations.js TALE_KINDS `held`, `R<region>.<minute>~<crime>`, the name of
  the one robbed - the report now names them), in its own words (HELD_NEWS). A murder charged never one: it is the
  hand's. Void, none. (AUDIT LW-II: the road's reports were void in the host until LW11's audit, C1 - a place held by a
  newcomer could not be found, so no witness was ever living; see `01-Overview/Audit-LivingWorld-II.md`.)

### 9.3 The host, and the measure

- The town's own day read (`livingTripsOf`) is as before. The word carried is worked APART (`livingCarriedOf`,
  `livingVisitsGen`): a generator over the visits of the last NEWS_DAYS days - each town about's trips a slice, its
  visitors, each visit's town's news a day a slice, a courier's town's visits - worked LIVING_CARRIED_SLICE_MS (3 ms)
  a frame (`livingCarriedStep`); the LivingTown asks it by its day (`carriedOf`) and tells it once done. A word worked
  while a way was still being asked is worked again after LIVING_CARRIED_RETRY_MS (5 s) - AUDIT LW-II B4: including a
  visit whose town's news had a day still asked (it was kept partial for good). While the word is worked again the town
  tells the one it had (B11: the strangers' regard and words blinked out for the frames the working took); a working
  that throws ends partial, never wedging the slice (B13). The towns' visitors and told trips are kept while the roads'
  memo stands, made again with a new network or a turn of fate (`livingWordFresh`).
- Measure (`tools/livingPerfProbe.mjs` "THE WORD CARRIED", the 81-town synthetic map, each town cold): the whole word
  70-85 ms - in one frame that was a hitch, the base day read itself 45-50 ms cold - now in at most 1,352 slices, the
  worst 3-6 ms (a collection lifts one to 15 now and then); the word told, a minute's read, 0.05 ms - AUDIT LW-II B3:
  a visit's deeds read once and kept with the turns (each minute's read ran every visit's and relay's turns again:
  18-80 ms a frame once a sky minute for a character of many deeds; the 0.05 ms was measured with none). Re-measured
  after the audit: the worst town's word 78 ms in 1,367 slices, the worst slice 4.6 ms, a minute's read 0.03 ms.

### 9.4 The four hosts, the pins

- `scenes/world.js`: WIRED (the visits worked, `carriedOf`, a town's news at any minute `livingRoadNewsAt`, the talk's
  regard by the repute).
- `scenes/caravanHost.js`: the robbery's tale on its charge; the report names the one robbed.
- `scenes/worldModes.js`, `scenes/dungeonContext.js`, `scenes/exterior.js`: none.

Moved pins: `lw6d_word` and `lw12_outlaws` (TALE_KINDS' `held`; `deedNews` of any town), `lw7_deeds` (the town's
news at any minute), `lw8b_talk` (a stranger's word of a deed heard), `lw11_caravan` (the report names the one
robbed). Re-aimed by content: `lw6d.json` LW6d-early and its TALE_KINDS record, `lw8b.json` LW8b-greet-seen,
`lw7.json` LW7-host-helped.

Moved pins (AUDIT LW-II): `lwfix4_turns` (the readers of `livingMemoFresh`, five to six); re-aimed `lw4.json`
LW4-news-nameless (a band named whole beside it).

Pins: `test/lw16_word.test.js` (8) - the word carried (the window, the set-out, the own, the first in, the deeds, the
courier's one hop); the repute (each kind, the bounds, the order, the stranger, the share); told (the share on its own
draw, the old law replayed, the opener, a robbery's words); the living town (any town's deeds, a robbery told in its
region, the word in its talk, the repute, a stranger's regard and word, the host's word once worked); the host's
seams. `test/lw11_caravan.test.js` (the tale on the charge, void none, a murder none). Mutants:
`tools/mutants/lw16.json` (73).

## 10. Found on the way (not changed by this design)

1. A home's trader: the service checks that a buy names the stall and that the stall stands. It does not check that
   the buyer stands in the house; that gate is the client's alone (`worldModes.js openHomeVendor`). An item for the
   Integrity arc's later lanes.
2. A diving company's loose stands reach a peer as nameless puppets not flagged as allies: the own frame flags allies
   only for `companion`, and divers set `shipmate` and team PlayerAlly. LW14 should flag a living ally on the wire,
   with its name. That is a change to the relay's law and its version.
3. LW0's model says "hours inside room to room". LW14 built a dive's hours stop by stop, block by block - no room
   graph: the block grid is the plan (7.1).

## 11. Mac's calls (open)

1. The traffic targets (2.6).
2. The patrons' numbers (8.1): PATRON_PAY_SHARE, the town's hourly share and each seller's ceilings. And whether a
   private home's trader sells to the street (8.2).
3. A band on the bounty board (5.4): the board is shared, a rout the character's own. Still open after LW12.
4. The escort's pay: gold (the client's word, as a counter's gold is) is proposed. Marks (the service's) is the
   alternative.
5. Couriers on horseback (3.1), if the rider art serves.
6. LW9: an arrest on the road - a patrol that halts a wanted player taking them to the nearest town's court, rather
   than drawing on them (2.4).
7. The repute's numbers (9.2): REPUTE, HEARD_SHARE and CARRIED_SHARE, and whether a heard name should ever carry a
   stranger past a friend's or an enemy's regard (built: never). And what the repute's regard should move: today it
   moves nothing a player sees (AUDIT LW-II-2 W9) - only the heard greeting shows the deeds.
8. LW11: the plaque rows (Trade, Talk, Steal, Hire on on the World Tooltips plaque) and stealing from the wagon (its
   cargo a loot list on `shopliftAttempt`, NIGHT_STEAL by night) were designed and not built: the ChoiceWindow and
   the counter's own steal stand in (4.1, 4.3). Build them, or keep the door as it is?
9. LW11 (AUDIT LW-II-2 C9): a caravan the band robbed under the escort - pay it (built: paid, "robbed, but alive"),
   or end the contract unpaid? And the hold-up stands on the player's deeds alone: a caravan whose only guard the
   character struck down before hiring on yields as they walk beside it, and C2 then ends the contract unpaid.
