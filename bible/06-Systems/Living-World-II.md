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

## 2. LW9 - the road's traffic

Mac: "More Travellers between roads".

### 2.1 Who travels

The census's roster gains five jobs, appended (decision 9). Each needs its row in `travellerCounts`, `mintResident`'s
class arm, TRIP_PACE, CYCLE_DAYS, TRIP_CHANCE, TRIP_RANGE_PX, STAY_DAYS, `ownTrip`'s destination law, `lives.js
HAZARD`, `livingRoads.js partyLabel`, `dayPlan.js` (the day at home) and `lines.js` (their words).

| Job | Who (off the MAPS row) | Cycle | Where | With | Hazard |
|---|---|---|---|---|---|
| `carter` (a farmer to market) | Each farm (type 3): 1. Each village (2) and hamlet (1): 1 + blocks/4, to 3. | 7 days, on the market town's MARKET DAY (a day of the week drawn from its map id's seed) | The nearest town of 4 blocks or more within MARKET_REACH_PX (4) that keeps a General Store. In at dawn; keeps a stall at one of its market spots (LW-STIR's stall: its cries and its haggles) until 15:00; home by dusk. | A pack horse (LW10) | 0.003 |
| `hunter` | Each hamlet, village and farm: 1 | 4 days | THE WILD: a point on dry, open ground 1-3 px off the town (LW-DRY's test). Out at first light, one night's camp, home the next evening. | Alone | 0.01 |
| `patrol` | A town with a knightly order's hall (`guildVariants.js ORDERS`, the hall's factionId through `places.js` factions), or the region's seat (the palace): 2 + blocks/16 knights, to 4. Class Knight. | 6 days | A LOOP of three towns of the region within PATROL_PX (12), a night at each one's tavern as a visitor. | Each other, as one party | 0.008 |
| `noble` (a procession) | A palace town: 1, the court's first slot | 20 days | Another palace town within 18 px | 2-3 of the town's sellswords under contract (`formCaravans`' contract law) and a baggage wagon (LW10) | 0.004 |
| `minstrel` | Towns of 9 blocks or more: 1, class Bard | 4 days | A town with a tavern within 8 px. Plays its common room through the evening (LW8: a performer's place at the room's middle; a small voice, MINSTREL_SONGS), lodged there. | Alone | 0.006 |

The roster's own counts grow too, by the measure of 2.6 (proposed):
- Pedlars from every location of 1 block (today a farm's pedlar is its only traffic).
- Merchants from 2 blocks.
- Adventurers raised for the companies (LW13): `1 + blocks/6` from 4 blocks, to 9.

### 2.2 The wild, and the inn on the road

- **A HUNTER'S WAY IS NOT A ROAD.** `trips.js wayOf` lays a planned route's pixels. A wild trip's way is a straight
  line from the town's exit that faces the point to the point itself:
  - sampled every DRY_STEP_N and bent round water by the test LW-DRY reads (`nativeDry`);
  - its kinds `open` throughout, so its trouble is open country's (GROUND_RISK 1.4);
  - the one kind of traffic seen off the roads.
- **THE INN ON THE ROAD.** A party whose day's walk ends within INN_REACH_PX (1) of a roadside tavern lodges there
  instead of camping. A roadside tavern is location type 6, already a living town with its own staff.
  - It walks on or back to the tavern, whichever its walk reaches before WALK_TO_H, and is out again at WALK_FROM_H.
  - The tavern's `visitorsOf` reads the party as visitors (LW-LODGE: a room, supper and breakfast in the common
    room), so the road's taverns fill at night with the road's people, in the rooms LW8 already stands.
  - A trouble that would have fallen on that night's camp (CAMP_SHARE) cannot fall at an inn. It falls on the next
    leg instead.

### 2.3 Parties meet on the road

- **PASSING.** Two parties on the same way, in either direction, within PASS_M (25 m) of each other at the same minute
  exchange a word in passing and walk on. (`ways.js` lays each pair of towns once, so the two parties' positions
  along the way compare directly.)
  - The words are ROAD_PASS_SCRIPTS: the road ahead and the weather, and the trouble behind them when either party's
    trip carries news of one ("Orcs at the ford - keep your eyes open").
  - It is LW-STIR's incident shape, on the road. Pure: both timelines are read off the same memo, and a pair is dealt
    once, the lower trip id first.
- **CAMPS SHARED.** Two camps on the same night within CAMP_SHARE_M (60 m) of each other are drawn as one ring round
  one fire, at the earlier party's spot. It is a drawing law only: no timeline moves.
- **A FIRE AT EVERY CAMP.** A camp's fire uses the camps' own look (TEXTURE.210 record 1, as in `scenes/camps.js`),
  drawn while the camp stands, with the camps' own light inside the lights' budget.

### 2.4 The patrol keeps the road

- **COVER.** A patrol walks its loop. For PATROL_COVER_DAYS (2) after it walks a leg, trouble on that leg is cut to
  PATROL_RISK (0.5) of its RISK_PER_DAY. `trouble.js` reads this off the region's patrols. It stays pure: a region has
  few patrol towns, and their trips are memoised like any others.
- **A WANTED PLAYER MEETS THE LAW ON THE ROAD.** The player crosses a patrol's path within HALT_M (30 m) while known as
  a criminal in the patrol's region (`standing.js knownCriminal`: legal standing under KNOWN_CRIMINAL_BELOW).
  - The patrol calls "Halt!" as the watch does, at HALT-ONE's cadence.
  - The arrest is DFU's own (`scenes/arrestFlow.js`), before the region's court.
  - Refused, the patrol draws on the player (LW7b's stand, as the pool's foes).
- **A PLAYER IN GOOD STANDING** is greeted by their standing (WATCH-KNOWS' bands, `lines.js watchBand`).

### 2.5 What the player sees

- The roads' layer draws the new kinds as it draws any party (`travellerSprites.js`): a patrol and a minstrel in their
  class's sprite, a carter and a hunter in their own outfits.
- The Overworld marks gain their words (`partyLabel`): "Farmer to Ripmarket's market", "Hunter", "Patrol of the Order
  of the Rose", "Lady Ysolde's procession to Wayrest", "Minstrel".
- Talk: each answers as any road traveller does (the talk ray, regard and refusals). A patrol's knights greet in the
  watch's words. A minstrel's song in the room is a small voice.

### 2.6 The measure, taken before anything is tuned

`tools/livingPerfProbe.mjs` gains THE TRAFFIC. It reads:
- the parties within 1, 3 and 6 px of a road pixel at 08:00, 12:00 and 18:00, averaged over a region's road pixels;
- how often a walker on a main road between two cities meets a party, in real minutes.

It runs on the synthetic map always, and on the game's own (the Daggerfall, Wayrest and Sentinel regions) where
ARENA2_PATH names the data.

Targets (proposed, Mac's to set):
- a main road between two cities meets a party at least every 4 real minutes by day on foot;
- a village's road meets one at least every 10 real minutes;
- the roads' frame still costs 6 ms or less.

### 2.7 The four hosts, and the pins

- `scenes/world.js`: WIRED (the roads' layer, the trouble world's patrols, the arrest seam).
- `scenes/worldModes.js`: WIRED through the host. LW8's existing seam reads the minstrel's room and the inn's lodgers.
- `scenes/exterior.js`: FLAGGED, as LW2 has it.
- `scenes/dungeonContext.js`: no roads.

Pins:
- the old roster's ids unchanged;
- each new job's count, cycle and destination law;
- the wild way on dry ground;
- the inn's lodging, and a camp's trouble moved to the next leg;
- passing pairs dealt once, and alike for both parties;
- the patrol's cover on trouble;
- the halt, by standing;
- the traffic measure on the synthetic map;
- mutants over each law.

## 3. LW10 - the wagon train

Mac: "actual caravans utilizing horses and wagons".

### 3.1 Who has what (pure, the trip's)

- A merchant's caravan has one wagon, or two when the merchant's town is 36 blocks or more.
- A pedlar and a carter each lead a pack horse: the horse alone, in its still and walk views. ARENA2 has no pack
  model the tree knows of.
- A noble's procession has its baggage wagon.
- A courier rides, IF the riding peer's mounted sprites (`net/peerRiders.js`, Eye of the Beholder's art) can wear a
  resident's look. Otherwise couriers stay on foot. To be checked at the build (section 11, call 5).

### 3.2 Where it is (`systems/livingWorld/wagons.js`, pure)

- **`trainOf(trip, at)`** gives the train's places in file: the van (sellswords), the merchant AT THE HORSE'S HEAD
  leading it, the horse, the wagon on its shafts behind it, then the rear (the remaining sellswords and the joiners).
  - Each place is a distance back along the way from the party's `s`.
  - Walkers keep FILE_GAP_N between them.
  - The horse stands HITCHED_HORSE_LOCAL_Z (3.1 m, the mod's own) before the wagon's axle.
  - It replaces `partyPlaces`' file for a party with a wagon. Its ring at camp is `partyPlaces`' own.
- **`wagonPose(trip, at)`** gives:
  - **the horse's point and yaw** on the way;
  - **the axle**, HITCHED_HORSE_LOCAL_Z back ALONG THE WAY. The way is a road's centre line, so the trailer law
    reduces to the way's own curve, except where the way bends sharper than WAGON_BEND, where `hitchAxle` from the
    way's previous point lays it;
  - **the wheel angle**, `horseCartLaw.js wheelRotationDegrees(s, wheelRadius)` off the distance walked, so every
    reader's wheels stand at the same spoke;
  - **the cargo tier** (`cargoPiecesShown`): FULL (90) on the way out; on the way home 50 (it sold) or 75 (it bought)
    by the trip's seed; 25 if robbed (LW12).
- **AT CAMP** the wagon is parked at the ring's edge facing the fire, its horse unhitched beside it and still (the idle
  frames). **IN A FIGHT** the wagon stops where it was and the horse stands.
- Pure, and pinned as `partyPlaces` is.

### 3.3 Drawn (`scenes/livingRoads.js`, sharing the HCC pool's pieces)

- **THE MESHES ARE THE POOL'S.** `hcc.presentation.wagonParts()` gives the parts. The cargo comes through
  `getGpuMesh`, cached and pinned. The drawing moves out of `horseCartPool.js`'s private `drawWagon` to an exported
  home that both call (decision 4).
- **WHERE IT DRAWS.** In the world mesh pass beside `hcc.draw`, exterior only:
  - the WAGONS_DRAWN (6) nearest wagons within ROADS_PLAY_M;
  - each matrix `mat4FromQuatPos` off `tvSceneOf`, plus the ground's tilt from two probes along the axle;
  - under the Overworld, grown with `tvOwnGrow` within the bands' far edge and casting no shadow, as the cart's own
    trailing wagon is (WAGON-HITCH).
- **THE HORSES** are the pool's billboards: `createBillboardBatch('hcc', ...)`, the view from
  `horseViewFor(calculateHorseOrientation(...))`, the frames from `stepHorseWalk` at the party's speed, pushed into
  `livePersonBatches`. Each batch belongs to the layer and is destroyed when it leaves the list and at `clear()`
  (EVERY ALLOCATION HAS AN OWNER). The horse art is loaded once (`horseArt.ensureStationary` / `ensureWalk`) whatever
  HCC's switch says.
- **COLLISION.** A STANDING wagon (camped, halted, fighting) stands its box on the host's collider (`usableBounds`, the
  parked team's law), taken off when it moves or leaves the list. A moving wagon claims nothing, as a walker claims no
  tile.
- **AN ACTIVATION TARGET.** The plaque names it ("Ada Lark's wagon, bound for Wayrest"). Its rows are LW11's.
- **THE OVERWORLD.** The `wayfarer caravan` mark's square becomes the wagon's glyph (`travelViewHud.js`).

### 3.4 The four hosts, the measure, the pins

- `scenes/world.js`: WIRED.
- `scenes/worldModes.js` and `scenes/dungeonContext.js`: no roads, so no wagon.
- `scenes/exterior.js`: FLAGGED.

Measure: the draw calls and the frame of WAGONS_DRAWN wagons, on the probe's stub renderer and in a browser
(`tools/travelViewPerf.mjs`). The roads' layer still costs 6 ms or less.

Pins:
- the train's order and distances;
- the axle 3.1 m behind, on a straight and on a bend;
- the wheel's angle from `s`;
- the tier law;
- the park at camp;
- the collider only while standing;
- the batches freed on leave and at clear;
- drawn with HCC switched off;
- the shared draw's one home.

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
