# World-Wide - the systems on the whole of Tamriel (WW)

Opened 2026-10-24. The owner, with two sessions building the land past the Bay (TESA, PR #1184 - Arena's places, the
capitals, the roads past the Bay): *"My goal for you is expanding our systems, if not already, out into the entire
world. Living world, ships, world events, etc. Everything so its not centralized to just daggerfall. That means we can
expand world events to happen more than once at a time since the world will be massive. No band aids"*.

TAMRIEL2 streams the land past the Bay and TESA stands places on it, but every system that gives the world its life
was built on the Bay and stops at its edge. A survey of the tree on 2026-10-24 found the same root under all of them:

- **What they walk is MAPS.BSA.** The living world's towns, the gate's site scan, the raids' towns, the ports, the
  packet lanes, Starfall's covens and the Abyss dungeon's census are each a loop over `maps.regionCount` - nothing a
  provider stands past the Bay can ever be one of them.
- **What they file by is `y * 1000 + x`.** MapsFile's pixel id (DFU's GetMapPixelID) is unique on the Bay's
  1000 x 500 and nowhere else: past it, a pixel and the one a thousand east and a row north share it. The living world's
  two indices, its near book, the dry ground's kernels, the town economy, the gate's pixel lists and the ocean holes'
  abyss ids all keyed by it.
- **What they group by is the region, 0..61.** Past the Bay `getRegionIndexAt` clamps to 0, the Alik'r Desert
  (TAMRIEL2's reading, kept by TESA3), so every grouping by region - an outlaw band's towns, a patrol's beat, a
  resident's name bank, a walker's race - lumped the whole continent into the Alik'r's.
- **What runs one at a time is held there by a clock or a single record.** The gate (`gateAt`, `GATE_EVERY_DAYS`, the
  room `gate:<day>`), the Sea Serpent (`serpentAt`), the Abyss dungeon (the hub's one `sdev` record), Starfall's night
  (one coven) and the dev's `/event` slot (`event:live`) - none of it by the map's size, so a world six times the Bay's
  would still hold one of each.
- **What bounds them on the wire is 0..999 and 0..499.** The relay's validators for a gate's site, a raid's town, a
  star, an Abyss find, an Elite arch and a Watch tick, and the account service's for a town's economy and a seat.

## The decisions, taken 2026-10-24

1. **On main, not on TESA's branch.** PR #1184 is 2,918 commits behind main and has not merged it; the systems it would
   carry have moved under it since. The arc is built on main as seams TESA plugs into when it merges main: a provider
   registers its places (`worldPlaces.register`, `registerPixels`) and every system reads them. Nothing here imports
   TESA's modules or depends on its shapes beyond a place's row (`world/worldWide/worldPlaces.js` PlaceRow).
2. **One key a pixel of the world.** `worldPixelKey` (`world/worldWide/worldGrid.js`) - a whole number for every pixel
   the wire carries (WORLD_PIXEL_BOUND, pinned equal). MapsFile's `y * 1000 + x` stays what it is - a MapId's low 20
   bits, DFU's law for the Bay's own ids - and is never a system's key again.
3. **THEATRES: the Iliac Bay is one, each province beyond it another.** A theatre is where one instance of a world
   event lives. The Bay keeps its own (Daggerfall's map, the data's ground, exactly as it is now - one gate a day there,
   one serpent, one Hollow), and each of the nine provinces past the Bay's rectangle is a theatre of its own (TAMRIEL3's
   picture, the picker's numbering: 1 High Rock beyond the Bay, 2 Hammerfell beyond it, 3 Skyrim ... 9 the Imperial
   Province). So the count of events at once grows with the world that holds places for them: on main today, with only
   the Bay's places, every family runs as it does; with TESA's places registered, up to ten of each at once. The Bay is
   NOT split into High Rock's and Hammerfell's halves - its events are the ones its players know, and the owner's
   "more than once at a time" is asked of the massive world, not of the Bay.
4. **AREAS: what a region was to a system that grouped by it.** On the Bay the region itself, 0..61, the same number -
   so every Bay band, beat, name and key is what it was, a save's routs included. Past the Bay a province's DISTRICT,
   a square of DISTRICT_PX (96) pixels in the Bay's own coordinates (never moving with the picture's fit), about a Bay
   region's size: the Bay's 62 regions share its 500,000 pixels, some 8,000 each, and a district is 9,216. One area a
   province would have held all of Skyrim to one region's outlaws.
5. **An area is not a region.** (WW-R, the owner's call taken: the provinces are regions now - one a province, after the
   Bay's 62; an area is still a province's district, the systems' own grouping.) The 62 regions are the wall the online game stands on - chat rooms, banks, the law and
   the guards, prices, the seats, the chapters - and TESA3 left "the provinces as regions of their own" to the owner
   (the save's shape, the relay's whitelist and the account service's validators move together). An area is the
   systems' own grouping and never goes on the wire as a region. What stays the region's is listed under each slice.
6. **No band aids.** A slice moves the system's own law - its key, its walk, its single slot - never a clamp beside it;
   a slice that touches the wire bumps the relay and names its deploy order; the Bay's answer to every moved law is
   pinned to the byte against the old one.

## The slices

| Slice | What | Status |
|---|---|---|
| WW1 | The world's grid (the key, the theatres, the areas) and its places (the registry, the Bay's provider); the living world's towns and dungeons off it, grouped by area | BUILT (below) |
| WW2 | The gates in every theatre: one Oblivion Gate a game day in each theatre that holds ground for one, lane = theatre, the Bay's lane 0 its own today; the site scan over the registry; the omen, ring, plaque, chat, timers and event board per gate; the relay's rooms, the receipts and the herald per lane | BUILT (below); a province's on its turn since FRONTS |
| WW-GATES-EVERYWHERE | The gates of the eight provinces standing (the lanes WW2 built, opened); a province's kill its own province's seats'; the provinces' scans in the page's idle moments - and a Sky-Ketch station in every province at its crown capital (KETCH-EVERYWHERE, `11-Multiplayer/Sky-Ketch.md` section 22) | BUILT (below, after WW2) |
| WW3 | The sea, whole: the packet lanes over the registry's ports on the world's water; the raiders' and the director's sea world-wide; the port test's bounds | BUILT (below) |
| WW-R | The provinces as regions: each province past the Bay a region of its own after the Bay's 62 (the owner, 2026-10-24: "Separate regions make sense"); the politic map past the Bay; the people, the law, the banks and the regional channels a province's | BUILT (below) |
| PROVINCE-COURTS | Each province's own court and people: a Province, its named ruler, its Court and its People for each of regions 62..70 (the owner's call taken, 2026-10-26: "Every single thing here needs to be addressed. No exceptions."), read by every reader of a region's court and people; the capitals' castles their courts; a bloodline a province; a clan never a province's | BUILT (below) |
| PROVINCE-FOLK | Each province's own people (the owner, 2026-10-28: "The world of tamriel needs to have their accurate races present within their respective regions"): its own race most of all and the others the lore puts there - the street's walkers, the living world's residents, the yards' and ports' keepers, the foes, the watch and the rosters past the Bay, and Cyrodiil's standing people as Imperials | BUILT (below) |
| HOVER-NAMES | The plaque's names past the Bay (the owner, 2026-10-28: "NPCs past the bay dont show name on tooltip hover"): read through and probed in the real game on the Bay and in three places past it, every walker named; not reproduced here, the probe kept for the Morrowind lane and online | PROBED (below) |
| WW-C | Cyrodiil (the owner, 2026-10-24: "Each region becomes home to their own abundant harvesting resources with other resources sprinkled in. Cyrodil becomes the new open PvP area with the wrothgarian mountain area being retired in favor of this. Cryodil will be home to all abundent resources and everything else from the wrothgarian zone"): WW-C1 each province's ground rich in its own kinds and ore, Cyrodiil in all; WW-C2 the open zone moved from the Wrothgarian Mountains to Cyrodiil | BUILT (below) |
| WW4 | The serpent in every sea: a serpent lane for each sea theatre | IN PART (WW7-12, below: the one serpent's site rolled over every lane of the world, the hub telling every game the site the accounts agree on; a serpent a sea theatre still planned) |
| WW5 | The Hollows and the stars: an Abyss dungeon slot and a Starfall coven night in each theatre | BUILT (below, 2026-10-27: a coven night and a Hollow on the Bay's lane and each province's, Cyrodiil's open zone none); a province's on its turn since FRONTS |
| STOREFRONT W14 | The season's Brass Fissures in every theatre WW5's stars stand in: a province's an area at a time over its theatre's scan, off its own roads and gate, its Colossus and Maul as the Bay's | BUILT (below, after WW5, 2026-10-29) |
| WW6 | The raids past the Bay: the raids' towns off the registry by area, the wire's world pixels; a staff town event past the Bay | BUILT (below) |
| WW7 | The roads' PEOPLE past the Bay - not the roads: the network past the Bay is TESA's (PR #1184, TESA14 and TESA15 - laid by the Bay's own law, drawn on the map). WW7 puts the living world's travellers, patrols, bands and the Watch on it (WW7-7: the ways' planner walks the roads past the Bay) and keys the town economy by the world's key; it lands on #1184 once that merges | IN PROGRESS on #1184 (2026-10-25; section WW7 below) |
| WORLD-LANES | The world's lanes of map ids (AUDIT BAY-LEFT items 1, 25 and 35): the spawned dungeons and their Elite tier past the Bay in the spawn lane, the Ocean Holes' pits past the Bay and past the Veil in the abyss lane; neither in the open zone | BUILT (section WORLD-LANES below) |
| FRONTS | Two provinces a game day: the Bay's events every day, and past it only the day's two provinces start a gate, raids, stars or a Hollow, on a cycle every machine knows ahead (the owner, 2026-10-29: "events are way overdone with their spawning") | BUILT (section FRONTS below) |

## WW1 - the world's grid and its places (BUILT, 2026-10-24)

### The grid (`world/worldWide/worldGrid.js`)

Pure, world/ and formats/ alone (the terrain worker's law, TAMRIEL2-WORKER - the dry ground reads it).

- `worldPixelKey(px, py)` / `worldPixelOfKey` - `(py + 8192) * 16384 + (px + 8192)`, every key under
  WORLD_PIXEL_KEYS (2^28), so a reach or a layer kept beside a key is its multiple (`livingNearKey`).
- `theatreAt(px, py)` - the Bay's (0) on `inBay`, else the province the picture (or the authored rings, untraced) puts
  the pixel's centre in, by `provinceKeyAt` over `bayToPicture`; -1 at sea past the Bay. `THEATRE_KEYS` is the picker's
  PROVINCE_OF_ID behind 'IliacBay'.
- `areaAt(px, py, regionAt)` - the region on the Bay (MapsFile.getRegionIndexAt, the caller's), else
  `areaOfDistrict(theatre, ...districtOf(px, py))`: BAY_AREA_COUNT + (theatre - 1) + 16 x the district's index, so a
  district a border cuts is two areas. `theatreOfArea`, `districtOfArea`, `areaName` (the region's, else the
  province's), `isBayArea`.
- `areaRace(a)` - the people an area's names and walkers are of: FALL.EXE's REGION_RACES on the Bay (the table
  MapsFile.GetNameBankOfRegion reads), the province's race past it (`PROVINCES`), the Imperial Province's Imperial.

### The registry (`world/worldWide/worldPlaces.js`)

- **Two kinds of provider.** A LIST registers its rows (`register(source, rows)` - the Bay's fifteen thousand, a
  province's cities and capitals); a PIXEL provider registers a function that answers the place it stands on a pixel
  (`registerPixels(source, at)` - TESA7's countryside is rolled pixel by pixel, a hundred thousand places nobody lists
  up front). A list's places are listed (`all`, `inArea`, `inTheatre`); a pixel provider's are found by place (`at`,
  `near`), kept a pixel at a time to PIXEL_PLACES_KEPT, by map id once found, and for an area past the Bay by walking
  its district once a generation (`inArea`). AUDIT TESA II P7: and a LIVE list (`registerLive(source, { stamp, rows })`) -
  a list whose rows move with the world under them (TESA's places, made again when the trace, the fit or the land
  moves): every read asks its stamp, and the read after it moved makes its rows again and moves the generation.
- **One place a pixel**, the location index's own law: the first list's, a list's first row, else the first pixel
  provider's that answers on that very pixel and on no list's map id. A list's row on a held pixel or a held map id
  stands nowhere (`shadowed`).
- **A generation** moves on every register and drop; every reader that keeps an answer off the registry keeps it by it.
- **A place** (`placeOfRow`): `{ key, mapId, name, px, py, type, region, area, theatre, w, h, blocks, port,
  dungeonType, hasDungeon, source }`, frozen. `region` is MapsFile's - the Bay's row's, -1 past the Bay; `area` the
  row's own where a provider knows better, else the pixel's.
- **The Bay's provider** (`world/worldWide/bayPlaces.js`): the game's own MAPS.BSA rows (HUB1's: never a world-data
  mod's addition, which stands on one client and not another), each at its own longitude and latitude, its region, its
  grid, its port Travel Options' list (`hasPort`), its dungeon's type. The world host registers it at the boot
  (`scenes/world.js`: `worldPlaces.register(BAY_SOURCE, bayPlaceRows(_hubRows, { hasPort }))`) and lets the rows go
  there - AUDIT LEGACY III W1's emptied index cannot come back, since nothing reads the rows past that line.

### The living world off the registry (`scenes/livingWorld/livingIndex.js`)

Out of `scenes/world.js` (HOST-SPLIT: the host wires it; LW3's and LW6's two indices, their near books and the
by-region, by-id and by-port tables left it - 97 lines out, 30 in, the host 67 lines shorter). `createLivingIndex({ places,
populated, peopleAt })`:

- A TOWN is a place of a populated type (DFU's PopulatesWanderingNpcs), its record LW3's own -
  `{ mapId, name, px, py, type, region, area, people, blocks, w, h, port }` - with its AREA beside its region; one record
  a place a generation. A DUNGEON is LW6's kinds (`LIVING_DIVE_TYPES`). On the Bay every record is the one the old index
  made, and AREA is its region.
- `townsNear` / `dungeonsNear` - a square about a pixel through the registry's `near`, sorted by map id, kept by
  OW-HITCH's `livingNearKey` (now the world's key plus the reach's multiple of WORLD_PIXEL_KEYS - the first key held half
  a map past the Bay and folded two pixels of the land past it into one). `townAt`, `townOfId`, `townsIn(area)`,
  `townOfPort`, `dungeonOfId`, and `generation` - the host's trip memo is made again when a provider's places come or
  go (`livingMemoFresh`), as it is when the roads move. WW7-7 and WW7-9 (below): each answers its own side of the Bay's
  edge (`livingSide`) - the Bay's places for a pixel of the Bay, and past it, once the land under the square is laid,
  its listed places and the places the roads rolled - and across the edge the other side's, where the land past the Bay
  stands and is laid there.
- The pixel builder's town is the index's (`livingTownAt`), so a town a provider stands past the Bay is a LivingTown's
  record the moment it is built.

### What groups by area now

Each is its region on the Bay, so each Bay answer is unchanged and a save's keys stand:

- **A patrol keeps its area** (`trips.js roadBound`) - a district past the Bay, never all of Tamriel beyond it.
- **An outlaw band is an area's** (`outlaws.js hideoutsOf(area)`, `Hideout.area`, keys `O<area>.<i>`): its towns the
  area's, its name bank the area's people's, and its hideout in its own theatre - a Bay band's on the Bay's map exactly
  as the old 0..999 x 0..499 test kept it, a band beyond the Bay never on the Bay. The trouble world's bands are the
  trip's two areas' (`scenes/world.js` bandAt); the hideouts about the player the areas of the towns within eight
  pixels; a town tells of a rout in its area (`livingTown.js deedNews`).
- **A resident's name and body** (`census.js mintResident`): `nameBankOfArea` (`characters/nameHelper.js` - the
  region's GetNameBankOfRegion on the Bay; past it the province's people's bank, the Imperial Province's the Imperial
  bank and Black Marsh's too, by DFU's own quirk, NameHelper.cs:50), and `walkerRace` by the area
  (`characters/mobile/mobilePerson.js redguardRegion` reads `areaRace`: Hammerfell beyond the Bay as Redguard as its
  regions on it).
- AMENDED BY PROVINCE-FOLK (below; AUDIT PROVINCE-FOLK C15): past the Bay a resident is one of the place's people,
  named from their own people's bank; `walkerRace` answers their picture where Daggerfall has none of their race.
- **The dry ground** keeps a pixel's kernel by the world's key (`world/dryGround.js`).

### What stays the region's (recorded)

The law: a crime on the road is charged to `maps.getRegionIndexAt`'s region (`caravanHost.js` report, `relations.js
reportOk`'s 0..70) - past the Bay its province's since WW-R (`tamrielGround.js` groundPoliticIndex), so a robbery's tale
past the Bay is told where the law charges it, the owner's call on the provinces as regions (decision 5). A temple's holy day is DFU's per-region table (`holidays.js`), and a place
past the Bay keeps none. The townsfolk of a place TESA builds name themselves off its synthesized location's region
(TESA3's own work, on its branch).

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired (the registry, the living index, the pixel builder through `pixelBuild.js`).
`scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` run no living world of their own: the
interiors' residents and the dungeon's divers are read through the world host's seams (`livingDungeonHere`,
`livingDeepCleared`, the rooms' residents), each of which now reads the index - none holds an index to move.

### Pins and mutants

`test/world/worldWide/ww1_world.test.js` (12): the key over the whole grid, its inverse and the wire's bound; the
theatres - the Bay's, every authored city past the Bay in its own province's; the areas - every region its own number,
districts their own inverse, named for the province; an area's people and name bank (every region's, every province's,
the Imperial bank, Black Marsh's quirk) and a Hammerfell walker beyond the Bay; the registry (one place a pixel, the held
id, the generation, a region past the Bay none, the producer's record); a pixel provider (its own pixel, the list
first, a list's id refused, kept, by id once found, an area's district walked once and its own area's alone); the Bay's
provider; the living index (the populated, the dive kinds, one record, near, an area's towns, a provider past the Bay in
every answer and every book made again on a drop); the area groupings (a patrol's district, forty areas' bands on each
side of the Bay's edge); a resident past the Bay a Nord by the Nord bank; the dry ground's two pixels; the host's
seams and no `y * 1000 + x` left in the living world's code. Mutants `tools/mutants/ww1.json` (26, all dead).

PINS MOVED, each re-aimed by content with its mutants (all dead): OW-HITCH's near key and its books
(`owhitch.test.js` - the whole grid, one maker of both books); AUDIT LEGACY III W1 (`auditlegacy3.test.js` - the
boot's registry lines lifted and run: the rows let go once the registry has them, both indices built in either order);
LW3, LW5, LW6, LW12, LW-FIX4, LW-WALLS, WALL-WAY, REGIONAL-FOLK, TOWN-ECON TE3 and AUDIT LW-II-2 (P5, D7, P10) - their
host seams in their new homes; mutant records re-aimed in `owhitch.json`, `auditlwii2_outlaws.json`, `lw9.json`,
`lw3.json`, `lw16.json`, `fieldbugs1012b.json`, `lw6.json`, `fb1010.json`, `auditlegacy3.json`, `lw12.json`.

### Port-Ledger

Section A, WW1 (OURS: DFU's world is the Bay; the registry, the theatres and the areas are the port's own, the Bay's
answers DFU's).

Follow-up, 2026-10-24 (with WW2): `nameBankOfArea` moved out of `characters/nameHelper.js` into
`characters/areaNameBank.js` - the account Worker bundles `nameHelper.js`, and an import of the world's grid there pulled
the continent's geography into it (`test/server/accountdeploy.test.js` ACC1-CI caught it); the Code Map gained
`src/world/worldWide/`. `theatreName` answers '' for the Bay (its names are its regions') - a hard-coded English name
there was a sentence no player's language had (L10N4).

## WW2 - the gates of every theatre (BUILT, 2026-10-24)

The owner's "more than once at a time", for the Oblivion Gate: a gate a game day in EVERY theatre that holds ground
for one, each with its own omen, ring, room, receipts and herald, the Bay's the gate it always was. Since FRONTS, a
province's gate opens on its turn alone (FRONTS, below).

### The lanes (`net/gate/gateLaw.js`)

- **A LANE A THEATRE.** `GATE_LANES` is `THEATRE_COUNT` (10, pinned; not imported - the law is the relay's and its
  graph stays flat). Lane 0 is the Bay's.
- **A GATE'S NUMBER.** Everything that names a gate - its room `gate:<n>`, its receipt's `d`, the account service's
  gate_kills row, the marks' rid, a chapter's ref, the spoils' keys - names it by one number: `gateNumber(day, lane)` =
  day + lane x `GATE_LANE_SPAN` (100,000,000). On the Bay's lane the number IS the day, so every record already written
  is the Bay gate's and keeps its shape; the room law's nine digits hold every lane's for 99,999,999 days.
  `gateDayOf`, `gateLaneOf`; `isGateDay` takes a number (no lane past the last theatre).
- **THE STAGGER.** Lane t's day runs `GATE_LANE_STAGGER` (144 classic minutes, twelve real) behind lane t - 1's:
  `gameDayAt(nowMs, lane)`, `gateBaseMinute`, `gateTimes(n)` and `gateAt(nowMs, lane)` are each lane's own. A game
  day's ten gates open across 108 of its 120 real minutes, two or three standing (omen to wrath) at once - measured,
  not assumed - so a player can ride from one to the next. Since FRONTS a game day opens three - the Bay's and its two
  provinces' - one to three standing at once.
- **THE ORDER.** Across lanes a number is not an order (lane 1's day 900 opens before the Bay's day 901, a hundred
  million past it): `gateOrder(a, b)` weighs by opening. The hub's rite ledger and a cell's ledger keep "the latest
  gate" by it.
- **THE MARKS.** `gateIndex` steps each lane `GATE_LANE_INDEX_STEP` (14) places on, so no two gates of one game day, or
  of two that touch, stand at one place of the marks' cycle; the Bay's index is its own. A lane's draw of its districts
  (`pickGateRegion`) reads the same index - its own bag.
- **THE BAY'S LANE IS THE LAW BEFORE WW2**, pinned to the millisecond over three days and every edge: its instants,
  `gateAt`, `gameDayAt` and the herald's omen owed (`heraldOmenDue`), against the old law written out in the test.

### The site past the Bay (`systems/gate/theatreGateSite.js`)

THE SAME LAW, TOWN BY TOWN. The Bay's scan (`systems/gate/gateSite.js`) walks every pixel of its map; a theatre is six
times the Bay's, and every suitable pixel lies in a town's ring, so `scanTheatreGate` walks the rings - each listed
town's 72 pixels - and asks the registry for the places about each: land (the one water law), no place on the pixel or
its eight neighbours, a fast-travel town two to four pixels off naming it (the nearest, the first listed on a tie), no
spawned dungeon, grouped by AREA (a province's district). Over the Bay's own places it finds the Bay scan's every list
pixel for pixel - pinned on a synthetic map and on ARENA2 (43 regions, 53,381 pixels, a hundred sites, no difference).
`findTheatreGateSite` answers `findGateSite`'s shape: `region` (a Bay region's on the Bay, its province's past it -
WW-GATES-EVERYWHERE, below), `area`, `theatre`, its place "Town, Province". The Bay's lane keeps its own scan (its
shape is the clearing's, Starfall's and the Abyss dungeon's).

The ground past the Bay is the composed continent's (`tamrielClimateAt`, `groundWoods`) whatever the land switch says,
so every client finds the same site; the towns are the registry's listed places of a town's type (TESA's providers).
A theatre's scan is made once a registry generation and once a picture (`tamrielLandVersion`).

### The host's gates (`scenes/gate/gateLanes.js`, wired by `scenes/world.js`)

- `createTheatreGateScans` - a scan a theatre, and `theatres()`, the theatres past the Bay with ground for a gate.
- `createGateLanes` - ONE OMEN A LANE (`systems/gate/gateOmen.js` takes its `lane`), each saying its own lines: a lane
  past the Bay's on its own event card (`gate:<n>`), the Bay's as they always were. `frame`, `current` and `mapMark`
  answer the Bay's lane, so every reader of them is unchanged; `standing`, `sky`, `cageSite` and `nearCurrent` the
  NEAREST gate's to the player (one stone, one sky, one Broker, one rite circle at a time); `mapMarks` and `currents`
  every lane's; `siteOf(n)` and `markOf(n)` a gate's by its number.
- A lane past the Bay stands only while the registry holds its theatre's towns with ground AND the relay keeps the
  lanes on both links (`online.js` `gateLanesOk`, world254): an older relay closes the socket on a site word past the
  Bay's map.
- The map's rings (`ui/heldMap.js`, `ui/ink/inkMap.js`, `ui/gate/gateMapMark.js` `readGateMarks` over the continent's
  frame), the timers' rows (`systems/eventTimers.js` - a lane's row from its omen, named where it stands; nine coming
  with no place would bury the Bay's), the event board (`systems/eventBoard.js` - a lane's row by its number), the staff
  teleport's gate note (`net/staffTeleport.js`, `gatePixelOk`).
- The client says each lane's site past the Bay once a socket and GATE (`online.js` `sendGateSite`), from its omen on.

### The relay (world254) and the account service (acct180)

- The hub keeps a fall, a site's agreement, a herald's state and a rite A LANE (`net/wire.js` `gateLaneKey` - the
  Bay's under its own key, as always), and an account's receipt a lane (`gateReceiptKey(sub, lane)` - a hello reads
  every lane's in one ask). The herald beats every lane against its own state, and posts a lane past the Bay's omen
  only once accounts agree where it stands. The wire carries a lane past the Bay's pixel as a world pixel
  (`gatePixelOk`: the site word, the rite's word in and out); `GATE_LANES_RELAY_MIN` 254 then, the world-wide relay's one
  number since AUDIT TESA II Z2 (`WORLD_WIDE_RELAY_MIN`, 269).
- The account service: a gate past the Bay is its own gate_kills row (its number). Its kill counts at its own
  province's seats (WW7-3: `net/townSeatLaw.js` gateRegionOk; the client names that province since WW-GATES-EVERYWHERE,
  below).

DEPLOY ORDER: the relay first (world254), then the account service (acct180), then the site. A client on an older
relay stands the Bay's lane alone.

### The lanes that stand (AUDIT WW F2, 2026-10-24; WW-GATES-EVERYWHERE, 2026-10-26)

The relay holds no picture of the world: it cannot tell a lane whose theatre has ground for a gate from one that has
none. A lane the clock alone opened was a court no honest client could find - its receipts any two accounts' for the
asking. So the lanes that stand are named in the law both ends read, `net/wire.js` `GATE_LANES_OPEN` (re-exported by
`gateLaw.js`): **the Bay's and the eight provinces' past it, 0 to 8** (WW-GATES-EVERYWHERE, below - TESA's places stand
in every province, and the freeware's scan finds a gate's ground in all eight). The hub admits a gate (`gateHolds`,
`gateAdmits`), keeps a site, a rite's word (`gatePixelOk`) and a spent receipt (`gateNumberOk`) on those lanes alone, and
walks only them (the receipts a hello reads, the falls, the rite, the herald); the client stands only them
(`gateLanes.js` `open`). **Cyrodiil's lane (9) never opens** - the open zone stands no gate
(`systems/gate/theatreGateSite.js`), and `auditww`'s pin holds it out.

### What stays the Bay's (recorded)

- **The clearing** (`world/gate/gateClearance.js`) is World of Daggerfall's rock kept off the gate - the mod's rock
  stands on the Bay alone (its sites are the Bay's 62 regions' packs; a pixel past the Bay names none of them), so the
  clearing reads the Bay's lane alone and a gate past the Bay is owed none.
- **Starfall's covens and the Abyss dungeon** read the Bay's scan on the Bay's lane; past it each province's lane reads
  its theatre's own scan (WW5, below).

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired (the lanes, the theatres' scans, each lane's site to the hub; a gate's kill's region its lane's
since WW-GATES-EVERYWHERE).
`scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` hold no gate omen of their own - the gate's
stone, pool and breach read the world host's `standing`, unchanged in shape.

### Pins and mutants

`test/world/worldWide/ww2_gates.test.js` (12): the lanes' law and both ends' copies; the Bay's lane against the old law
to the millisecond; the stagger, each lane's today, gate and omen owed, two or three at once; the order across lanes and
the marks' cycle; the hub's keys; the wire's pixels and the lanes' relay; the theatre scan equal to the Bay scan
(synthetic, and ARENA2); a theatre past the Bay (Skyrim's authored cities, a town at its border); the theatres' scans
(generation, picture); the host's gates (the lanes, the nearest, the relay's gate); the wiring. Mutants
`tools/mutants/ww2.json` (32: 31 dead, the ring's inner bound equivalent as recorded - every town is a place, so the
neighbours' test refuses its ring's first pixels).

PINS MOVED: the relay and account versions (world254, acct180) in their pin files; `test/net/relayversion.test.js` the
world254 law (no file joins the bundle); `test/fixtures/time1_census.json` the lane day's clock;
`audit0929_gate.test.js` (the marks' card once a gate), `discordgates.test.js` (each lane's site said),
`wb12d_rite_world.test.js` (the rite's circle at the nearest gate), `auditwb_world.test.js`, `wb1_gate_omen.test.js`,
`events1_board_ui.test.js` (a lane's lines on its own card), `eventtip.test.js`, `fb1004e_overworld.test.js` (the
rings past the Bay), `gateclear.test.js` (the Bay's lane's site), `tamriel3.test.js` (the picture's version);
`auditwbx2.test.js` M3 reads the mark after the hello that reads it (SCALE2b's "none held" had made its hello between
read nothing, so the mark's mutant lived). Mutant records re-aimed by content in `audit0929_gate.json`,
`auditwb_relay.json`, `auditwbx2.json`, `discordgates.json`, `events1.json`, `gatecollapse.json`, `seat1b.json`,
`wb1.json`, `wb12d.json`, `wb14b.json` and `wb3.json`; the version records in `bal9.json`, `br5.json`,
`crafthold.json`, `fb1004d_knight_house.json`, `gatekeys.json`, `hackedgold.json`, `nameas.json`, `soc1.json`,
`tech1.json` and `wb14g.json`; `ww1.json`'s name bank record to `areaNameBank.js` - all dead.

Section A, WW2 (OURS: DFU has no Oblivion Gate - the gate, its lanes and its scan past the Bay are the port's own).

## WW-GATES-EVERYWHERE - an Oblivion Gate in every province (BUILT, 2026-10-26)

The owner, after the audit "no system left behind in the Bay" (`Audit-Left-In-The-Bay`, item 24 - A2, A2b, A2c - and
item 34 - A4): *"Every single thing here needs to be addressed. No exceptions."* (2026-10-26). **The owner's calls, taken:**
- The gate lanes 1 to 8 open; Cyrodiil's lane (9) never, for it is the open PvP zone.
- Site-bound world events (gates, covens, Hollows, the Sky-Ketch, raids) stand nowhere in the open zone. For this
  package: no gate on lane 9, and no Sky-Ketch station there.
- One Sky-Ketch station per province, at its crown capital (`11-Multiplayer/Sky-Ketch.md` section 22, KETCH-EVERYWHERE).

**What stood.** WW2 built the gates of every theatre - a lane a theatre, the omen, ring, plaque, timers and board rows,
the hub's records and the receipts a lane - and AUDIT WW F2 held the lanes past the Bay shut in the law both ends read
(`GATE_LANES_OPEN` the Bay's alone) until a province's places registered. WW7-1 registered TESA's places in every
province, and nothing opened them: only the Bay's gate ever stood. The records said two things (WW2's "opening a lane",
the fold's P7 "the gates stay the Bay's lane alone"). Beside it, a province's gate's kill named no region (the world
host's `gateSeatWord` named one for the Bay's lane alone), so WW7-3's law that a province's gate is its own seats'
(`net/townSeatLaw.js` gateRegionOk) was never asked; and the eight provinces' scans ran at once on the page's thread,
the first `lanes()` of each registry generation.

**What it is now.**

- **THE LANES THAT STAND** (above): 0 to 8, Cyrodiil's never. The relay's every lane loop and law reads the constant, so
  it runs the eight as WW2 built them. Folded into world270, undeployed: main's relay is world268, and world269 and
  world270 are this release's alone, so `GATE_LANES_RELAY_MIN` (`WORLD_WIDE_RELAY_MIN`, 269) needs no split - a client
  stands a province's lane only on a relay of 269 or later, and the first of those that deploys is world270, which keeps
  them. A client on an older relay stands the Bay's lane alone (`gateLanesOk`), as before.
- **THE SITE'S REGION** (`systems/gate/theatreGateSite.js` findTheatreGateSite): a site past the Bay - and its town -
  names its province's region (WW-R's 62 to 69, `regionOfTheatre`), where it named none; the world host lays the court
  in it (`world.js:"gateArenaSite: (g) => {"`, the site's own region - the made court took no region before).
- **A2b, THE SEAT** (`scenes/gate/gateSeat.js`): a kill's region is the Bay's lane's by its scan, as before, and a lane
  past the Bay's its province's off its number alone (`gateSeatRegion`) - no scan asked, and the kept claim waits on no
  Bay scan (`gateClaimWaits`). The host's two lines call it in place (`world.js:"const gateSeatWord = (r) => {"`,
  `world.js:"const gateClaimReady = (r) => {"`). The account service already took it (WW7-3); its refusal of a region
  not the gate's lane's is named for what it is, `'not-its-region'` (`seatInfluence.js` creditGate - `'beyond-the-bay'`
  said a gate past the Bay was no seat's, as it was before WW7-3), folded into acct196.
- **A2c, THE SCANS IN THE PAGE'S IDLE MOMENTS** (`systems/gate/theatreGateSite.js` theatreGateScanner,
  `scenes/gate/gateLanes.js` createTheatreGateScans): a theatre's scan walks its towns' rings once, then THEATRE_SCAN_STEP
  (4) ring pixels between asks of `more` - the scan made at once, list for list; each pixel's place asked of the registry
  once a scan (the walk asked 149,247 times of 28,201 pixels, each through the countryside's and the lairs' rolls). The
  host's scans warm in the page's idle moments the Bay scan's own way (`pageIdle`: the idle callback, a timer's 4 ms
  slice on a page without one, none in a probe), a lane at a time; `theatres()` answers the lanes whose scans are whole,
  so a province's lane stands once its scan is done, and a site is drawn off no scan not yet whole. **Measured** on the
  freeware with the host's registry (the Bay's rows, TESA's places, the countryside's and the lairs' rolls), the lanes
  forced open on the tree before (e77eadc58f) to measure what opening them alone would have cost. The first session's
  numbers, on a quiet machine: before, **1,741 ms** in one task (2,167 to 3,399 ms cold); after, 217 slices of 8 ms
  idle moments, **the longest 42 ms**. Measured again at the finish, on a machine loaded about eight times over (load 30
  on four cores, so every number inflated): before, **5,429 ms in one task** cold and 364 ms warm (the new scan made at
  once, with no idle moments: 5,215 and 373); after, 292 to 316 idle moments, the longest **217 to 410 ms** cold (about ten over 50 ms) and **33 to 37 ms** warm (none over 50
  ms). The long slices are single cold asks of the countryside's roll (a provider's first ask of a district, up to 94 ms
  in one `places.at` on the trace). No slicing of the scan can cut one ask: the ask is the countryside's own cost, and
  the old single task paid every one of them at once.
- **What stays the Bay's** (recorded above): the clearing - World of Daggerfall's rock stands on the Bay's regions alone,
  so no gate past the Bay is owed one; Starfall's covens and the Abyss dungeon read the Bay's scan (WW5).

**Proved on the freeware** (`test/world/worldWide/ww_gates_everywhere.test.js`, ARENA2): over the host's registry the
host's scans find ground in all eight provinces and none in the open zone; each lane's gate stands at a site in its own
theatre at its province's region, three days each, its omen said on its own card, its ring on the map, standing for the
player beside it; the warm in idle moments finds the same sites. Through the real relay: Skyrim's court minted at its
opening and never the open zone's; its fighter admitted, the Warden down, the receipt naming the gate's number; the
night's fall kept on Skyrim's lane and handed at a hello; two accounts agreeing where it stands and its omen posted with
its place. Through the real account service: three agreeing claims of a Skyrim gate, its region Skyrim's, 300 influence
for the guild pledged at Solitude; the same gate named in a Bay region or another province's refused, its row keeping no
region.

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired, in place (`gateSeatWord`, `gateClaimReady` and the claim's call - a line each, no line added;
`bootWorld`'s ceiling unchanged). `scenes/exterior.js` FLAGGED - the Bay's fixed scene stands no gate past the Bay.
`scenes/worldModes.js` FLAGGED - its `enterGateArena` lays the court from the host's `gateArenaSite`, unchanged in
shape (its region now the province's). `scenes/dungeonContext.js` FLAGGED - the court's dungeon is the location the
mode machine hands it.

### Pins and mutants

`test/world/worldWide/ww_gates_everywhere.test.js` (7: the lanes; A2b the client's region and the service's count; the
relay; the court; A2c the slices; ARENA2 a gate in every province). Mutants `tools/mutants/ww_gates_everywhere.json`
(16, all dead).

PINS MOVED: `test/scenes/audittesa2p_hosts.test.js` P7 (the lane that stays shut is Cyrodiil's, its theatre the one
never scanned); `test/world/worldWide/ww2_gates.test.js` (a site past the Bay its province's region; the host's region
its lane's; the refusal's word; the wire's lane that does not stand is Cyrodiil's now - with lane 1 open,
AUDITWW-F2-the-words-unbounded had lived; and every relay before the world-wide one keeps no lane - WW2-the-lanes-relay
had lived on world259 since the fold); the claim's call `gateClaimReady(r)` in `wb5b_gate_claim.test.js`,
`auditonline2.test.js`, `chap2b_receipts.test.js`, `audit_chap3.test.js`; `silverways_client.test.js` (the region its
own word); `seat1b_client.test.js` THE HOSTS BY SOURCE (the gate claim's region off `gateSeatRegion`'s answer). Mutant records re-aimed by content: `ww2.json` (the neighbours' test, the spawned dungeon, the water, the
region past the Bay, the seats' lane), `audittesa2p.json` P7, `auditww.json` F2 (the lanes open now the open zone's too),
`silverways.json` (the character unsent). Run at the finish: `ww_gates_everywhere.json` (16), `ww2.json` whole (32: 31
dead, the rings' inner bound equivalent as recorded), `auditww.json` whole (21), P7 and the silverways record - all dead
once the two pins above were added.

Ledger A, WW-GATES-EVERYWHERE (OURS - DFU has no Oblivion Gate).

## WW3 - the sea, whole (BUILT, 2026-10-24)

The Bay's ships sailed the Bay alone: its packets ran between Travel Options' harbours over the Bay's water, its raiders
were born on the Bay's map (or the Eltheric Ocean's box), its port test read MapsFile's pixel ids, and a ship past the
Bay was named by the Bay's people. WW3 puts the sea's systems on the world's ports and water; every Bay lane, packet,
port, board and name is the one it was.

### The map directory names the Bay's map alone (`systems/map/mapDirectory.js`)

`locationSummaryAt` and `hasLocation` (ContentReader.HasLocation) answer null off the Bay's 1000 x 500. Off it,
MapsFile's `y * 1000 + x` is ANOTHER pixel's id - (1003, 10) is (3, 11)'s, (-2, 10) is (998, 9)'s - so a ship past the
Bay's edge was told it lay by a Bay port (the deed's "a port is near", the harbour sounded, the moored ships rolled), and
the travel map named a Bay town on a pixel past the edge. DFU asks its directory of its own map alone; the port asks it
of the world's, so the bound is the law's (Port-Ledger).

### The world's ports (`world/worldWide/worldPorts.js`)

- **A port past the Bay** is a place its PROVIDER calls a port (a registry row's `port` - TESA's places), of a port
  town's kind (`systems/portPlaces.js isPortTownType`), that the OPEN SEA bears on (`net/fortLaw.js seaBears`, the
  shipyard's and the harbour board's law, over the host's `openSea`). The Bay's ports stay the game's data (Travel
  Options' list, the PortTownAndUnknown byte): a Bay place is never one of the registry's.
- **One number a port** (`portIdOf`): the Bay's masked map id on the Bay (what the lanes, the harbour book and the living
  world's sailors always filed a port by), and past it `PORT_ID_WORLD` (2^20, past every masked id) plus the world's
  key - so a lane's key and seed are its two ports' wherever they stand, and no two ever meet (the grid's north-west keys
  are small).
- **Kept by the registry's generation and the land's picture**; `at` (a port town by its provider's word),
  `nearestPx`, `nearestNamed` (the deed's nearest harbour and the way to it), `withBay` (the board's list: the Bay's, then
  the world's - the one array while neither moves) and `seaAreaAt` (THE WATERS' AREA: the Bay's region on the Bay, a
  province's district past it, at sea the nearest port's).
- A port past the Bay keeps the nearest Bay crown's office (`crown`, the host's `crownAt` - `systems/naval/navalShips.js`
  crownOf over the three capitals, the crown whose colours its navy flies there; BAY-LEFT-SEA, the end of this page). Its
  region is its province's (WW-R; AUDIT TESA II P7 - it was -1 here, written before the owner's call on the provinces as
  regions).

### The world's lanes (`scenes/naval/worldLanes.js`)

- **The Bay's lanes are the Bay's**: its ports (Travel Options' list off the map's directory, `bayLanePorts`), its water
  (the host's `laneOpen`, the Bay's map alone), made once - every packet in the water she sailed. The serpent's site is
  rolled over every lane of the world, the Bay's first (WW7-12).
- **The lanes past the Bay** run between the world's ports over THE WORLD'S LANE WATER (`worldLaneWater`): the Bay's own
  on the Bay, and past it the Ocean climate on water where the land past the Bay stands (the composed continent's
  readers - TAMRIEL2), never the Eltheric Ocean's box (its isles keep their own ports), a native point by its pixel
  FLOORED. Made again when the world's ports move. A Bay lane never leaves the Bay's water. AUDIT TESA II P7: the lanes
  past the Bay run to their own reach (BEYOND_LANE_MAX_PX, 400 pixels; the Bay's LANE_MAX_PX of 30 gave one lane among
  the 28 ports) and their way is walked at the PICTURE'S scale (`beyondLaneWay`: an A* over the trace's open sea, its
  lakes and the Bay's rectangle left out, no corner cut, each straightened leg asked again of the world's lane water at
  the Bay's scale) - an A* over the Bay's pixels cost 15 s for the freeware's coasts; with no picture (the authored
  shape) the walk is the Bay's scale's, within LANE_PATH_PX, and may cross the Bay's water. A player is near a lane past
  the Bay within the ellipse its two roadsteads bound for a way of BEYOND_LANE_PATH_PX (`near`). SMOOTH-LAND
  (`03-World/Tamriel.md`): a cell's open sea is the land's smooth law's at its centre (the picture's own side), and a
  roadstead on the law's sea whose cell's centre is land - a corner the law rounded, 13 of the 22 the freeware's lanes join -
  leaves from the nearest open-sea cell within MOOR_REACH (2) it reaches straight on the lane water (`moorCell`), that
  cell's centre kept in its chain; 19 of the 21 lanes find a way, as before.
- **SEA-SQUARE** (`01-Overview/bugs/Field-Bugs-2026-10-28b.md`): past the Bay a pixel is the lanes' water where its square's
  four corner bytes are (a byte is its square's south-east corner in DFU's kernel), and a roadstead is the roomiest pixel of
  its ring. Seven roadsteads had stood on land, and packets circled off them.
- **One book**: `all()` the Bay's lanes and then the world's, each lane's way kept once (`way`) - the feed of packets
  about the player, the living world's sailors and crews ashore, and the passage by sea read it. The serpent reads it
  whole (WW7-12: `whole()`, then `all()`); SEA-TRADE's port lanes the world's (WW7-10: a Bay port's the Bay's alone).
- **The lane search on the world's grid** (`systems/naval/seaLanes.js lanePixels`): keyed by the world's key and bounded
  by the grid, so a lane past the map's edge is walked as the Bay's are - pinned step for step against the Bay's search
  as it was.

### The raiders' sea and the director's

- **THE SEA'S GROUND** (`onWorldSea`): the Bay's map and the Eltheric Ocean's box (ETHER-OW's), and the world's grid past
  them where the land past the Bay stands - the Warm Ashes raiders born there (the ocean's climate, every pixel about
  them water) and sailing it (`tvRaidOpen`, `tvRaidSea`). AUDIT OW5b S5's raider born a pixel past the map's edge was
  born on ground nothing streamed; past the Bay with its land standing, the ground streams, its climate and water the
  composed continent's. The relay's overworld ledger keeps a raider by its cell, whatever the cell's sign (`OW_RAIDER_ID_RE`).
- **The director** (`systems/naval/navalDirector.js`) already stood its ships in a ring about the player on any water; its
  inputs are now the world's: the port near (`csaIsPortTown` past the Bay asks the world's ports), the port lain at and
  the board (`navalPortList` with the world's ports), the waters' depth (`navalPortPx` with the world's nearest), and
  the waters' area (`where().area`).
- **The harbour past the Bay** (`navalHarbourNear`): the registry's port, its town the location the host's location index
  holds on the pixel (the town its provider stood), its key the port's one number.

### The waters' people (`systems/naval/navalShips.js shipNameBank`, `shipCrew.js`)

A ship's captain and her hands are named by the waters' people: past the Bay the waters' area's province's
(`characters/areaNameBank.js nameBankOfArea` - a Nord's in Skyrim's waters), on the Bay her region's as always. A packet
is named by her home port's waters (`area` on the feed), another ship by the waters she is met in. WW7-8 (below): the
naval wire says the province and the area she was named in (`navalWire.js` `r`), so every reader names her as her
stander did.

### What stays the Bay's (recorded)

- **The crowns.** A ship past the Bay flies the nearest Bay crown's colours and a crime at sea is charged as on the Bay.
  The provinces became regions (WW-R) and the crowns stayed the Bay's three: seven provinces' navies are the owner's
  call, recorded at WW7-8 (below). A port past the Bay keeps the nearest crown's harbour office (BAY-LEFT-SEA, the end of
  this page).

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired (the world's ports and lanes, the port test past the Bay, the board, the nearest port, the
waters' area, the raiders' ground, the harbour past the Bay); `scenes/naval/navalHost.js` names by the waters' area.
`scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` hold no sea of their own.
bootWorld 36,233 -> 36,209 (24 logical lines out to the two modules; its ceiling down with them).

### Pins and mutants

`test/world/worldWide/ww3_sea.test.js` (9): the directory's bound; the lane search on the world's grid against the Bay's
as it was; the world's ports (the port word, the kind, the sea's bearing, the Bay's own kept out, the one number past
every masked id); the ports kept (generation, picture, the Bay's pixel never asked, the nearest, the way, the waters'
area - a province's district, at sea the nearest port's); the lane water (the land's switch, the climate, the box, the
floor) and the sea's ground; the world's lanes (the Bay's water for the Bay's alone, the world's for the world's, one
book, a way kept once, made again when the ports move); the waters' people; the living world's ports by the one number;
the wiring. Mutants `tools/mutants/ww3.json` (33, all dead).

PINS MOVED: `fb0929h_deedport.test.js` (the port test and the nearest port past the Bay - its cases added),
`field_csa2.test.js`, `lw5_ports.test.js` (the port's one number), `sealanes.test.js` and `auditbay_lanes.test.js` (the
feed over the world's book; a way sounded counted by the water it read), `ethership.test.js` (the names' area),
`fb1013c_porttowns.test.js`, `fb1014_inlandports.test.js` (the board's list with the world's), `townecon_sea.test.js`,
`townecon.test.js` (SEA-TRADE the Bay's lanes), `ows3_raiders.test.js` (the sea's ground; its case past the Bay added),
`ether_ow.test.js`. Mutant records re-aimed by content in `auditbay.json`, `ether_ow.json`, `ethership.json`,
`fb0929h_deedport.json`, `ow5s.json`, `sealanes.json`, `shipcrew.json`, `hostsplit.json` - all dead.

Section A, WW3 (OURS: DFU's sea is the Bay's; the world's ports, lanes and waters are the port's own, the Bay's answers
SEA-LANES' and DFU's).

Follow-up, with WW-R: the waters' people's bank moved out of `systems/naval/navalShips.js` into
`systems/naval/shipNameBank.js` - the naming laws are the account Worker's too (its item law reaches them through the
harbour board), and an area's people are read off the continent's geography, which is never its
(`test/server/accountdeploy.test.js` ACC1-CI caught it on WW3's commit). `shipNames` and `handName` take the bank.

### AUDIT SEA PATHS (2026-10-31) - the lanes' reach past the Bay

A port past the Bay with no port within BEYOND_LANE_MAX_PX now runs to its nearest within its way's cap,
BEYOND_LANE_PATH_PX (`systems/naval/seaLanes.js` laneNetwork's `farPx`), and one with no lane that has a way looks out to
BEYOND_LONE_PX (`scenes/naval/worldLanes.js` loneLanes): every port past the Bay a lane holds is served, Necrom among them,
and Vivec to Ebonheart by their channel. A lane with no way under its cap is sought over the picture's whole sea and runs
at its own length (C1): Necrom to Vivec and to Ebonheart, Winterhold and Windhelm to the Imperial City, Senchal to
Torval. The Bay's own lane water is CLIMATE.PAK's
undilated climate under the four-corner law, and every way holds on the kernel's own ground. Record:
`01-Overview/audits/Audit-Sea-Paths.md`.

## WW-R - the provinces as regions (BUILT, 2026-10-24)

The owner, asked whether the provinces should be regions of their own: *"Separate regions make sense"*. Each province
past the Bay is a region after the Bay's 62. **Daggerfall stays High Rock's** - the Bay spans the two provinces
(FALL.EXE's own table: Daggerfall, Wayrest and the north shore Breton, Sentinel and the Alik'r Redguard), and its 62
regions are what they were; the provinces' land past the Bay's rectangle is what is new.

### The table (`formats/mapsTables.js`)

- `BAY_REGION_COUNT` 62; `PROVINCE_REGION_NAMES` the provinces as the map names them (tamrielGeography.js PROVINCES -
  pinned), the Imperial Province by the owner's word, **Cyrodiil**: 62 High Rock, 63 Hammerfell, 64 Skyrim, 65 Morrowind,
  66 Sumurset Isle, 67 Valenwood, 68 Elsweyr, 69 Black Marsh, 70 Cyrodiil (`CYRODIIL_REGION`) - region 61 + theatre
  (`regionOfTheatre`, `theatreOfRegion`, `isProvinceRegion`). `REGION_NAMES` the 71.
- **The people**: `REGION_RACES` (DFU's Races less one) the provinces' own - Breton, Redguard, Nord, Dark Elf, High Elf,
  Wood Elf, Khajiit, Argonian, and Cyrodiil's Imperials as Bretons (Daggerfall has no Imperial body); `REGION_NAME_BANKS`
  each region's name bank (the Bay's its race's, MapsFile.GetNameBankOfRegion's; an Argonian's the Imperial bank as
  NameHelper.GetNameBank says, Cyrodiil's the Imperial); `REGION_PEOPLE` each region's people by race key (town talk's
  oaths). `characters/nameHelper.js getNameBankOfRegion` reads the banks.
- AMENDED BY PROVINCE-FOLK (below; AUDIT PROVINCE-FOLK C15): Cyrodiil's Imperials are Bretons in REGION_RACES alone - the
  numbers DFU's Races hold; their bodies stand as Imperials, Morrowind's body having one.
- MapsFile names a province's region (`getRegionName`, `getRegionIndex`) and holds no MAPS.BSA record for it
  (`getRegion` null, as an empty Bay region's); `REGION_TEMPLES` none for a province (FALL.EXE names none).

### The politic map past the Bay (`world/tamriel/tamrielGround.js groundPoliticIndex`, `groundMaps`)

A province's land answers its region's politic (128 + its region) and the sea about it the PAK's own off-map answer;
the Bay to the byte. MapsFile.getRegionIndexAt clamps past the table's 71 - so `_questRegionIndex()` (PlayerGPS.
CurrentRegionIndex) names Skyrim in Skyrim: the region's name bank, its people, its law, its bank and its channel.
Composed with the climate where the land past the Bay stands (the world host's `groundMaps(maps)`, TAMRIEL2's switch).
The registry's places past the Bay carry their province's region (`world/worldWide/worldPlaces.js` - never a provider's
word for a Bay region). An AREA is unchanged: the Bay's are its 62 regions (`BAY_AREA_COUNT`), a province's its districts.

### The stores a region keeps

The law's (`systems/region/regionConditions.js REGION_COUNT`), the banks' and the houses' (`systems/banking.js
BANK_REGION_COUNT`) are the 71; a save's 62 is padded on its restore (`padRegionTable` - its rows kept, the provinces'
opened blank). A crime in Skyrim is Skyrim's (`systems/livingWorld/relations.js reportOk`). The regional price walk draws
the provinces' rolls after the Bay's (the Bay's prices the ones they were); a province's own Province faction
(PROVINCE-COURTS, below) tilts its walk as a Bay region's does.

### The relay (world255) and the account service (acct181)

- **The regional channels**: `CHAT_REGION_COUNT` 71 (`net/hubShards.js REGION_CHANNELS` - a province's channel, one
  object and unsplit: PROVINCE-SLEEP, `11-Multiplayer/Scale-Arc.md`); `PROVINCE_REGIONS_RELAY_MIN` 255: an older relay refuses the key, so a client on one keeps its region tab
  off past the Bay (`chatRegionRoom(index, provincesOk)`, `online.js provinceRegionsOk`).
- **The Abyss census** counts every region's channel (`SD_REGION_COUNT` `CHAT_REGION_COUNT`, WW5): each theatre's
  Hollow rises in its own regions - the Bay's in a Bay town's region, a province's in its province (`sdLaneRegions`).
- **The naval wire** says the Bay's regions alone (an older build refuses a whole ship word with a province's region;
  past the Bay a ship's names are her waters', WW3).
- **The account service**: a node's region is any of the world's (`net/nodeLaw.js regionOk` - a province's ground
  gathered, WW-C); the books a TOWN keeps are the Bay's 62 by name (`bayRegionOk` - the market, the writs and their boards,
  the contracts, the chapters and their halls, the cards, the sea bounty: their D1 tables' CHECKs say `region < 62`; the
  world's towns past the Bay are WW7's).

DEPLOY ORDER: the relay first (world255), then the account service (acct181), then the site.

### What stays the Bay's (recorded)

- The Bay's three crowns (`kingdomLaw.js`): no province is a crown's, a march or a free land.
- The classic save formats (SAVEVARS, MAPSAVE) are the Bay's 62, as Daggerfall wrote them.

### Pins and mutants

`test/world/worldWide/wwr_regions.test.js` (7): the table, its theatres and Cyrodiil; the people and their banks; the
politic map past the Bay and MapsFile's names; a place's province region; the stores and their padding, a crime in
Skyrim; the account service's two region laws in every book; the relay's channels, its gate, the census, the naval wire,
the host's wiring. Mutants `tools/mutants/wwr.json` (33, all dead).

PINS MOVED: the relay and account versions (world255, acct181) in their pin files and `test/net/relayversion.test.js`'s
world255 law (no file joins the bundle); `audit24_formats.test.js` (the clamp past 71), `maps.test.js` (the tables 71,
the Bay's rows FALL.EXE's), `chat1.test.js`, `chatchan.test.js`, `scale5c.test.js` (the channels 71, the gate),
`sd3_relay.test.js`, `sd1_sdlaw.test.js` (the census the Bay's), `regionlive.test.js` (town talk's people),
`audit26_systems.test.js`, `banking.test.js`, `bankwindow.test.js`, `daychange.test.js`, `jan1_fixes.test.js` (the
stores 71, a save padded), `lw11_caravan.test.js` (a crime in a province), `tamriel2.test.js` (`groundMaps`),
`ww1_world.test.js` (an area the Bay's, a place's province region), `auditscale2_acct.test.js` (the history),
`l10n4_hardcoded.test.js` (+3, the provinces' names - the canonical English the locale's regionNames list translates).
Mutant records re-aimed by content (35, all dead): the version records, the town books' `bayRegionOk`, the gate scan's
politic, the chat key's bound, the save's padding, the naval wire's region, the registry's region.

Section A, WW-R (OURS: DFU's regions are MAPS.BSA's 62; the provinces' regions past the Bay are the port's own, the Bay's
answers DFU's to the byte).

## PROVINCE-COURTS - each province its court and its people (BUILT, 2026-10-27)

The audit "no system left behind in the Bay" (item 33) found FACTION.TXT's per-region factions the Bay's alone: a
Province faction (type 7) for each of the Bay's regions, its Court (14) and its People (15) its children, and a crown's
ruler its first child (Gothryd, Akorithi, Eadwyre) - and none for the provinces past the Bay (regions 62..70, WW-R). The
owner's calls taken (*"Every single thing here needs to be addressed. No exceptions."*, 2026-10-26): the provinces get
courts and people of their own - content, built though FACTION.TXT has none past the Bay - and a vampire bloodline is
mapped per province (the nine below, one a province).

### What stood (measured on the freeware, at e77eadc58f)

- Regions 62..70: no People, no Court, no Province faction. `findFactionByTypeAndRegion(Province, r)` answered Random
  Ruler (852, region -1 - the last region-less match, DFU's own fallback): `%rt` "Lord", `%rn` a stranger drawn afresh
  at every read; the price walk tilted by Random Ruler's power (65, a tilt of -5 everywhere past the Bay).
- The 56 palaces past the Bay carry Random Ruler, as 319 of the Bay's 322 do (the three crowns' carry their Province),
  and `courtOfCurrentRegion` found no court: their nobles' work was the commoners'. A crime moved no People's
  standing. No war, famine or plague walked a province. A vampire turned there was a Lyrezi (GetVampireClan's
  default). The capitals' castles stood the Bay's court down (WW7-4) and had no court of their own.
- A defect beside it, on the Bay too: the questor pool resolves a candidate with its building's own type, DFU's number
  (`talkTopics.js` questorCandidateBuildings - GetBuildingList :2814-2816), and `npcSession.js`
  getStaticNPCFactionData compared the palace with the click's name, `'Palace'` - so a factionless palace NPC's work
  was the People's, commoner work, on the Bay and past it. The click mapped the type and was right.

### The factions (`systems/faction/provinceFactions.js`)

- **Four a province, keyed by the region**: its Province (6000 + region), its ruler (6100 +), its Court (6200 +) and
  its People (6300 +) - past every id FACTION.TXT uses (0..977, the duplicates' resolver from 980) and the port's
  registered mods' (Roleplay & Realism's 1020-1022, Immersive Travel's 8642-8643). Shaped as FACTION.TXT's crowns are
  (Daggerfall 201, its Court 595, its People 518): the Province a root of the Nobility and the Region guild group, its
  children the ruler, the Court and the People in that order (the ruler first, as Gothryd is Daggerfall's - `%rn`,
  `%nrn` and the throne room read the first child); the Court the crowns' Courts' (power 25, flags 128); the People the
  crowns' People's (Commoners, GeneralPopulace, power 5 - Wayrest's). Every field of FactionFile's record.
- **The door**: `factionRep.js` addCustomFactions, DFU's AddCustomFactions - the one door a faction not in FACTION.TXT
  comes in by - adds them first, then the registry's. Both dictionaries the game reads are filled through it: the
  player's store at its Reset (`createFactionRep`) and the talk host's reader (`scenes/townTalk.js`). Their children
  are their own, so no relink is asked and no Bay record moves.
- **Their names**: the Province its region's name; the Court and the People `Court of {province}` and `People of
  {province}` - the canonical English the key (a faction's name is one: factionNameToIDDict), each shown in the
  player's language through `textManager.js` registerFactionNameText, the port's own door GetLocalizedFactionName asks
  after a translation pack's Factions table (no pack holds an id the port minted). The Standing page's rows are shown
  through GetLocalizedFactionName now (`factionStanding.js`), as GetFactionData shows a name - FACTION.TXT's through a
  pack's table where one is installed, as before. Six keys, drafted in every language.

### The nine (the decisions)

| Region | Province | Ruler | Seat | Power | Bloodline | Why the bloodline |
|---|---|---|---|---|---|---|
| 62 | High Rock | Duke Alabynak Masterton | - (no crown, WW7-3) | 60 | Garlythi | Northmoor's and Phrygias' clan - the Bay's Breton north, whose land runs on past the Bay's edge into High Rock past it (both meet it on the politic map); the Wrothgarians on that edge are the Orcs', and Lyrezi is every clanless region's default already |
| 63 | Hammerfell | Duchess Rlirptha | - (no crown) | 60 | Anthotis | the Alik'r Desert's and Dak'fron's clan - the desert runs on past the Bay to Skaven, Hegathe and Elinhir (527 of the edge's pixels against Hammerfell past it are theirs, more than any other clan's) |
| 64 | Skyrim | High King Haran Jurgarnesen | Solitude | 80 | Haarvenu | the frost-casters (their Ice Storm) - the nearest of Daggerfall's nine to the north's own ice |
| 65 | Morrowind | King Helil Sailathil | Mournhold | 80 | Montalion | Wayrest's clan, and Wayrest's court is Morrowind's royal line (Queen Barenziah, Prince Helseth); their Recall is Morrowind's own art |
| 66 | Sumurset Isle | Queen Cymbana Larethwatch | Alinor | 80 | Thrafey | the healers (Heal) - the Altmer's Restoration |
| 67 | Valenwood | King Legoman Ivywood | Falinesti | 70 | Khulari | the hunters (Paralysis) - the Green Pact's and the Wild Hunt's land |
| 68 | Elsweyr | Queen Najjan Raihan | Torval | 70 | Lyrezi | the stealthy (Silence, Invisibility) - the Khajiit's own way |
| 69 | Black Marsh | King Caligius Calissius | Helstrom | 65 | Selenu | the hardy (Resist Cold, Fire and Shock) - the Argonians' famed resilience |
| 70 | Cyrodiil | Emperor Uriel Septim VII | the Imperial City | 90 | Vraseth | FACTION.TXT's own: The Septim Empire (350) carries vam 150, the Vraseth |

- **Each clan once** (the owner's call taken, a bloodline mapped per province): the nine bloodlines, one a province - no province takes another's, and the default Lyrezi is
  Elsweyr's by choice, not by a miss. FACTION.TXT's own clans carry regions 62..70 (below) and are no mapping: their
  numbers are sequential ids, not provinces.
- **The titles** are the lore's: DFU's own King, Queen, Duke and Duchess (MacroHelper.GetRulerTitle's 1-4), and the
  port's after DFU's twelve (`buildingNames.js` RULER_TITLES): High King 13, High Queen 14, Emperor 15, Empress 16 - the
  same law, a man's odd, a woman's even. High Rock's and Hammerfell's land past the Bay is held by a duke and a duchess:
  their crowns are the Bay's three (WW7-3), and a land held under a crown is a duke's on the Bay's own map (Northmoor's
  Province carries ruler 3, a Duke). Elsweyr's is a queen: Torval was Pelletine's seat, a queen's. Sumurset's a queen,
  as asked.
- **The names** are drawn from the province's own name bank (WW-R's REGION_NAME_BANKS - an Argonian's the Imperial
  bank, as NameHelper says) on the game's own banks (`withGameNameBanks` - a translation's NameGen.txt never moves a
  key), seeded by the ruler's id, the DFRandom stream put back after (a dictionary is made mid-game). One departure,
  recorded: Cyrodiil's ruler is Daggerfall's own Emperor, Uriel Septim VII (TEXT.RSC: "the true Emperor of Tamriel,
  Uriel Septim VII"), never a stranger - the game's own story names him, and a bank's draw would contradict it.
- **The powers**: the Bay's crowns stand at 75-80, its other regions about 50-70. Cyrodiil, the Empire's seat, 90;
  Skyrim, Morrowind and Sumurset 80; Valenwood and Elsweyr 70; Black Marsh 65; the dukes' lands 60.
- **Their flags**: a crowned province the crowns' 60 (RulerImmune with the crowns' other bits), a duke's land
  RulerImmune alone - the named ruler stands, so `%rn` and the throne never change hands under them.

### What reads them now

- **The palaces' nobles** (`npcSession.js` getStaticNPCFactionData - Random Ruler's redirect, and a factionless palace
  noble through the pool's own number now): the province's Court, the Nobility - noble work (the Nobility's list,
  R0C10...). Every palace of Skyrim's eight cities (pinned).
- **The capitals' castles** (`world/capitalCastles.js` CASTLE_SEATS): the Bay court's people re-seated in the copy
  rather than stood down - through DFU's own generic factions, which talk and work read as the region's court
  (Random_Ruler, Random_Noble, Random_Knight -> courtOfCurrentRegion): the crown's ruler on the throne under Random
  Ruler, its nobles and its court under Random Noble, its knights under Random Knight, each in its generic faction's own
  look (FACTION.TXT 852's and 242's 183.6 / 183.8, 853's 183.3 / 183.14) by its own gender - no Bay royal's likeness;
  its commoners factionless (the region's People), in their own look. The clans' spies, the scholars and guild members
  a Bay story names (Popudax, Karethys, Lady Northbridge, Charvek-si, Cyndassa) and the mobiles' records go, as WW7-4
  stood them down. So the Blue Palace's nobles are the Court of Skyrim's, and a castle noble's work is noble work.
- **The throne room** (`crownHall.js` crownRulerHere): a province's ruler sits a castle under Random Ruler (one copy
  serves two capitals - Sentinel's Solitude and Torval), so the person on that seat is the throne room's ruler; a Bay
  crown's is found by its own id alone. WW7-4's "a throne room's ruler past the Bay" is closed.
- **`%rn`, `%rt`, `%t`, `%nrn`** (`questMacros.js`): the Province's first child and its title - "High King Haran
  Jurgarnesen" in Skyrim, "Emperor Uriel Septim VII" in Cyrodiil; a shop's "The %rt's" (townTalk's regentRuler).
- **A crime** (`court.js` lowerRepForCrime): the People's half of the legal loss, propagating through the province's
  tree as a Bay crime walks Daggerfall's; the sentence's and the payment's refunds the same People.
- **The price walk** (`shopStock.js` updateRegionalPrices, and the online world's - worldPriceTiltOf): Skyrim's own
  power against The Merchants' - trunc((40 - 80) / 5) = -8, Random Ruler's -5 before; Cyrodiil's -10.
- **The regional conditions** (`region/regionPower.js`): nine more Provinces walk - their power, their alliances and
  rivalries with the world's factions (the Bay's among them, and the rumour mill tells them), famine, plague, crime
  waves; no new ruler (RulerImmune), no persecuted temple (a province's REGION_TEMPLES is none) and no witch burnings
  (no coven of a province's own).
- **Wars** (`faction/factionRelations.js` PROVINCE_BORDERS): DFU's border table is the Bay's 62 rows. The pairs whose
  land meets on the politic map past the Bay (measured on the freeware) - twelve between provinces (Sumurset Isle meets
  none) and eleven across the Bay's edge (High Rock past it with the Wrothgarian Mountains, Northmoor, Phrygias and
  Ykalon; Hammerfell past it with the Alik'r Desert, the Dragontail Mountains, Dak'fron, the Wrothgarian Mountains,
  Abibon-Gora, Mournoth and Gavaudon). A pair with a province in it is read there alone, and for two Provinces alone;
  every Bay pair answers DFU's table as before - whose rows name a 62 three times (Bantha's and the two High Rock
  coasts', regions no faction holds), never the port's High Rock.
- **A vampire turned** (`scenes/shared.js` clanOf -> `infection.js` vampireClanForFaction): the province's bloodline -
  Skyrim's Haarvenu.
- **The Standing page's Kingdoms** (`factionStanding.js`): the nine provinces among FACTION.TXT's 45, by name, in the
  player's language.

### The clans' regions (the latent hazard)

FACTION.TXT's nine vampire clans (150-158) carry regions 62..70 - the provinces' very numbers, since WW-R numbered the
provinces after the Bay's 62. A lookup of a faction by its region alone would take The Thrafey for Skyrim's. Every one
is typed - the court's (Courts, the Region guild group), the people's (People, Commoners, GeneralPopulace), a region's
Province (type 7: `%rn`/`%rt`, the hosts' region faction, the throne room's walk, the price walk), the coven's - and the
test sweeps the source for it (every `findFactions` names a type; every `findFactionByTypeAndRegion` a FACTION_TYPES,
the Province's 7, or its caller's type passed through; crownHall's walk the Province type). The war's border test past
the Bay asks two Provinces: a clan's region reads as no province.

### Saves and online

- **The save**: `save.js` snapshotFactionRep carries every faction of the store, a province's with them; an old save
  loads with the provinces at their default - restoreFactionRep skips what the snapshot lacks, and the store made them
  fresh. A classic import (`classicFactionRep`) copies FACTION.TXT's ids alone, the provinces at their default.
- **Online**: no book of the account service is a region's court or people - its standing book, the Roll (CHAP1), is
  the twenty-two guild factions. A province's standing rides the realm's save, whose faction store takes any id; the
  staff repair (`net/repairLaw.js` - an id to 0xffff) and Project Legacy's standing (`systems/legacy/influence.js` -
  keys of six digits) take the new ids (pinned). No relay law reads a court or a people. The account Worker's bundle
  carries `buildingNames.js` (the titles) and both workers' carry `textManager.js` (the name door): acct196 and
  world270 are re-hashed in place for it at the integration (neither deployed), no behaviour of either service moving.

### What stays (recorded)

- FACTION.TXT's records are the Bay's to the byte (pinned: every record, its children, every Bay region's court,
  people and Province); the reader is exact.
- No knightly order, temple, coven or guild of a province's own: FACTION.TXT's groups stay the Bay's.
- A castle's copy serves two capitals, so its seated ruler speaks as the region's court under a generated name; the
  named ruler is `%rn`'s.

### THE FOUR HOSTS (Home.md)

No host line moved. `scenes/world.js` and `scenes/worldModes.js` (interiors, castles) wire their sessions' court,
people and region faction off the store and the reader the door fills; `scenes/dungeonContext.js` stands the castle's
people from the copy (rdbLayout's flats); `scenes/exterior.js`, the Bay's fixed city - FLAGGED: no province stands
there, its region is the Bay's.

### Pins and mutants

`test/world/worldWide/provincecourts.test.js` (21): the records, the rulers and their titles, the bloodlines, the door,
the shown names, the borders and the clans, the pool's palace, the castle's seats and the throne, the typed lookups
swept; on the freeware the Bay's records to the byte, every reader's answer for every province (and none before), `%rn`
and `%rt`, a crime in Skyrim, Skyrim's prices, a vampire turned there, the conditions and a war, the save and an old
one, the online laws, the Blue Palace's noble's work, Skyrim's eight palaces' nobles' work, every court person seated by
FACTION.TXT's own law. Mutants `tools/mutants/provincecourts.json` (36, all dead).

PINS MOVED: `fb1009e_everystanding.test.js` (the kingdoms by name and their counts: the nine provinces with FACTION.TXT's
45), `court.test.js` (every faction travels: FACTION.TXT's and the provinces'), `rr3_questline.test.js` (the door's
count), `ww7_castles.test.js` (the court re-seated, not stood down), `l10n4_hardcoded.test.js` (+1 for the new module:
Uriel Septim VII, a proper name). The test world (`test/systems/quest/r25World.mjs`) stands its reader through the
door, as the talk host does.

Section A, PROVINCE-COURTS (OURS: DFU's factions are FACTION.TXT's, and it has none past the Bay; the provinces' are the
port's own, the Bay's to the byte).

## PROVINCE-FOLK - each province its own people (BUILT, 2026-10-28)

The owner: *"The world of tamriel needs to have their accurate races present within their respective regions"*. WW-R put
each province's people in the tables (their names, their talk), but the bodies past the Bay were still the Bay's. A
walker wore the climate's Breton, Nord or Redguard (DFU's three townsfolk races), a resident the same, a foe the Bay's
mix, and Cyrodiil's standing people stood as Bretons. Mournhold's streets were Bretons (its climate's people) and
Ebonheart's Nords. AMENDED BY AUDIT PROVINCE-FOLK (`../01-Overview/audits/Audit-Province-Folk.md`), below.

### The people (`characters/provinceFolk.js` PROVINCE_FOLK)

| Province | Its own | The others |
|---|---|---|
| High Rock | Breton 82 | Redguard 5, Nord 4, Imperial 4, High Elf 3, Wood Elf 2 |
| Hammerfell | Redguard 82 | Breton 6, Imperial 5, Khajiit 3, Nord 2, Dark Elf 2 |
| Skyrim | Nord 84 | Imperial 5, Breton 4, Dark Elf 4, Khajiit 2, Redguard 1 |
| Morrowind | Dark Elf 82 | Imperial 6, Argonian 4, Nord 3, Breton 3, Khajiit 2 |
| Sumurset Isle | High Elf 92 | Wood Elf 4, Imperial 3, Breton 1 |
| Valenwood | Wood Elf 82 | High Elf 6, Khajiit 5, Imperial 5, Breton 2 |
| Elsweyr | Khajiit 84 | Wood Elf 6, Imperial 5, Argonian 3, Redguard 2 |
| Black Marsh | Argonian 84 | Imperial 7, Dark Elf 5, Khajiit 2, Breton 2 |
| Cyrodiil | Imperial 64 | Breton 6, Nord 6, Redguard 6, Dark Elf 4, Wood Elf 4, Khajiit 4, High Elf 3, Argonian 3 |

Each province's own race (`tamrielGeography.js` PROVINCES; the Imperial for the Imperial Province) holds most of its
people. The others are the neighbours, traders and garrisons the lore puts there: the Reach's Bretons and eastern
Skyrim's Dark Elves, the Legion and the East Empire Company in Morrowind, Gideon's Imperials in Black Marsh, the Alik'r
caravans' Khajiit. Sumurset Isle keeps to its own. Cyrodiil, the Empire's heart, holds every people. No Orcs: DFU's
banks give no Orc a full name (Monster1 names their lairs), and Wrothgar's Orcs stand as its foes (AUDIT B7).

THE ZONES (AUDIT PROVINCE-FOLK B6, `ZONE_FOLK`): where the game's zone text or the lore names a people of a zone's own
(`world/tamriel/tamrielBiomes.js`), the zone stands them, read off the pixel - the Reach's Reachmen (Breton 60, Nord 28;
UESP Lore:Reachmen), Reaper's March (Wood Elf 55, Khajiit 35), Black Marsh's Blackwood about Gideon (Argonian 60,
Imperial 30) and Cyrodiil's Blackwood about Leyawiin (Imperial 60, Argonian 16, Khajiit 12).

### Who reads it

- **The street's walkers** (`systems/town/townPopulation.js`): past the Bay each spawn draws the walker's race first
  (`person.folk`), on the pool's own rolls, so on the Bay RandomiseNPC draws exactly as before. The name comes from
  their own people's bank (`folkNameBank`: an Imperial's and an Argonian's the Imperial bank, NameHelper's law). Their
  Morrowind body is that race (`folkBodies.js folkActor`). The pool takes the town's people (`pixelBuild.js`,
  `folkOfLocation`: its region's, its zone's off its pixel).
- **The picture far off** (`mobilePerson.js spriteRaceOf`): Daggerfall draws townsfolk in three races. A Breton, a Nord
  or a Redguard wears their own race's picture and talk face; every other race wears the town's (walkerRace, DFU's
  climate law). The Morrowind body is where a Dark Elf, an Imperial or a Khajiit is drawn as one.
- **The living world's residents** (`census.js mintResident`): the same, on a stream of their own (`lwSeed(seed,
  'folk')`), so the rest of a resident is drawn as it was. A resident's `race` is their own race now; their picture is
  their `archive`.
- **The keepers** (`merchantYards.js townKeeper`): a yard's or a port's keeper past the Bay carries their `race` and
  whose people they are (`home`), named from their bank; a port's hands draw theirs off the place's key from their
  keeper's people, once a place (`portHost.js raceOf`). A Bay keeper's record is as it was.
- **The foes and the watch** (`foeBodies.js`): past the Bay a foe of the place is one of the people where it stands
  (AUDIT A5: `folkWhere`, the pixel under its feet outdoors, the player's own indoors and underground - the world host's
  doors, `setFolkPlace(pixelOf, regionAt)`), drawn once a seed. A person of their own (ALLY-RACE: a crew hand ashore, a
  sworn revenant) keeps their draw anywhere - a revenant the race it was born in (AUDIT A1).
- **The rosters**: a roster told its race (a resident on the road) keeps it; a ship's crew are her waters' people (AUDIT
  A3, `home`), a crew with no waters the Bay's; a siege's fighters and a road's band the place where the player stands.
- **The standing people** (`peopleBodies.js standingRace`, AMENDED BY AUDIT A2, A6, A10): past the Bay one whose
  record's race is the region's, or a region's faction's (a Bay town's People in a reused block, a province's court), is
  the place's own people (`nativeHere`) - Cyrodiil's Imperials, whom the game's records keep Breton (WW-R), the Reach's
  Reachmen; a named one (an Individual faction) and a faction's own people keep theirs. A room's people are read with
  the faction table and the region's race now (A2, on the Bay too); a quest's person follows the rule, its quest's
  record keeping the region's race. A placed figure is the place's own as well.
- **The tavern's card regulars** (`world/card/cardRegulars.js regularLook`): a regular named from the Imperial bank is
  the province's own people where the player stands - an Imperial in Cyrodiil, an Argonian in Black Marsh (NameHelper
  names Argonians from that bank). They stood as Bretons; on the Bay they still do. A table asks the place once a frame
  (AUDIT A9).

THE FOUR HOSTS: world.js names the place, and its streets' pools (`pixelBuild.js`) carry the province's people;
worldModes.js's buildings and dungeonContext.js's dungeons stand in the world host's page and read the place it names;
exterior.js FLAGGED: the fixed city's bench stands the Bay alone and names no place.

### What stays (recorded)

- The Bay: every walker, resident, keeper and foe on the Bay is drawn as before. `folkOfRegion` answers null there, and
  each reader keeps its old path. Two fixes on the Bay are recorded in the audit: a room's people read their race (A2),
  and a beast-race member of the line wears their picture's outfit variant (A8).
- A peer's copy of someone's companion past the Bay: the wire carries the seed alone (`ls`), so the copy is drawn where
  it stands while its owner keeps the companion's own draw (AUDIT B3 - a field beside `ls` and a relay version fix it).
- Two machines that first see one foe on either side of a border - it crossed between - draw it each by its first sight.
- The names are their own people's for the walkers, the residents and the keepers; a ship's hands keep her waters'
  bank, a standing person the region's (AUDIT C14).
- The talk window's oath (`%oth`) reads the region's people (`townTalk.js npcRaceNow`), not the person's (AUDIT B8).
- Legacy's line is the eight playable races: an Imperial resident who marries in becomes a Breton (`marriage.js`'s own
  fallback), in the line and in the world (AUDIT A4).
- At sea past the Bay the region is 0, the Bay's: a foe at sea there is the Bay's draw (AUDIT A11).
- The update renamed and re-raced the residents and keepers past the Bay a save knows; a courtship keeps the name and
  race it began with (AUDIT A12).

### Pins and mutants

`test/characters/provincefolk.test.js` (10): the table and its shares; the lookups; the draw and the banks; the picture;
the street, with the Bay's draws counted; the census; the yards and the ports; the foes, the rosters and a companion;
Cyrodiil's standing people and the tavern's regulars; the hosts' wiring - tightened by AUDIT C4-C13. Mutants
`tools/mutants/provincefolk.json` (29, all dead). The audit's: `test/scenes/audit_provincefolk.test.js` (6),
`tools/mutants/audit_provincefolk.json` (43, 42 dead and one equivalent).

PINS MOVED: `fb1010_regionalfolk.test.js` (the census asks walkerRace for the town's picture, `climate`),
`ww1_world.test.js` (a resident past the Bay named from their own people's bank). Mutant records re-aimed by content (4,
all dead): RFOLK-census-climate, WW1-census-bank, AUDIT-MERCHANT-YARDS-R1-every-keeper-a-breton,
MWNPC7-female-variant-unread.

Section A, PROVINCE-FOLK (OURS: DFU's townsfolk are one race a climate and its people stop at the Bay).

## WW-C1 - the provinces' ground (BUILT, 2026-10-24)

The owner: "Each region becomes home to their own abundant harvesting resources with other resources sprinkled in. ...
Cryodil will be home to all abundent resources". And the node law knew the Bay's map and the Eltheric's box alone: a
harvest past the Bay was refused (`bad-node`), and an ask after a province pixel's witnesses refused whole
(`bad-pixels`) - the provinces stood their climate's nodes on the client and none of them could be gathered.

### The ground is the world's grid (`net/nodeLaw.js pixelOk`, `regionOnPixel`)

- `pixelOk` is the world's whole grid (`net/wire.js worldPixelOk` - the Bay's map and the Eltheric's box lie inside it):
  a province's pixel stands its nodes, is gathered and witnessed as the Bay's is, its id spelt as an Eltheric one is.
- `regionOnPixel`: a province's region is never claimed on the Bay's own map - the cheapest lie a province's richness
  would pay (the Bay's ground claimed Cyrodiil's). The service refuses it (`prof-pixel`); past the map the witnesses
  settle which province a pixel is, as they settle a Bay pixel's region.

### The provinces' richness (`net/provinceNodes.js`)

| Province | Its climate | Rich in (times its climate's count) | Its own ore |
|---|---|---|---|
| High Rock | Woodlands | trees x3, herbs x2 | Mithril |
| Hammerfell | Desert | veins x3, boulders x2 | Dwarven Scrap |
| Skyrim | Mountain | veins x3, boulders x2 | Orichalcum |
| Morrowind | Mountain Woods | veins x2, herbs x2 | Ebony |
| Sumurset Isle | Subtropical | herbs x3, trees x2 | Moonstone |
| Valenwood | Rainforest | trees x4 (the jungle's forty-eight) | - |
| Elsweyr | Desert2 | herbs x3, veins x2 | Gold |
| Black Marsh | Swamp | herbs x4, trees x2 | - |
| Cyrodiil | Woodlands | every kind, the richest province's: trees x4, herbs x4, veins x3, boulders x2 | every province's, one vein each |

DECIDED (ours, the owner's to retune - one table): the kinds and ores by each province's land and lore; a province's
ore stands on `PROVINCE_ORE_SLOTS` (2) veins beside its climate's, as Daggerfall's Moonstone does. The kinds a province
is not rich in stand its climate's count - the resources sprinkled in. CYRODIIL draws over every rich province's tables
together (`nodeLaw.js richTable`: Cyrodiil's veins the Mountain's and the deserts' metals beside the Woodlands', its
trees Valenwood's Teak and Mahogany and Ironwood, its herbs the swamp's and the south's), and stands each province's ore.

ON WITNESSED GROUND ALONE, as a crown's signature is (AUDIT 29 A6, UNWITNESSED-ORE): the service holds no map, and a
province's border is the player's own traced picture (`world/tamriel/tamrielLand.js`), so the province is the claim a
lie is worth most on. Ground no three witnesses have confirmed stands its climate's nodes at their unwitnessed tiers.

### One slot law (`nodeLaw.js nodeSlots`)

How many nodes of a kind a pixel's day holds is one function both ends read: the client's stands (`scenes/treeHost.js`,
`herbHost.js`, `mineHost.js` hand the pixel's region in - `gatherHost.js pixelInfo`'s) and the service's bound
(`server-account/src/professions.js`, every kind - its ternary of three laws gone). `veinSlots` and `treeSlots` read it.
The held map's ore card says a province's richness and Cyrodiil's every ore (`ui/oreMapTip.js`, `nodeLaw.js veinTable`).

### The account service (acct181, folded in before its deploy)

The node law's wider ground and the provinces' richness ship in acct181 (WW-R's, not yet deployed): one deploy.
`src/net/provinceNodes.js` joins the account Worker's bundle and its deploy's path filter.

### Pins and mutants

`test/world/worldWide/wwc1_ground.test.js` (6): the table against the map's climates, Cyrodiil the richest and every
ore; the one slot law on confirmed and unwitnessed ground, the Bay and the jungle as they were; Cyrodiil's merged
tables; the world's grid and a province on the Bay; the service's bound and its Bay check; both ends' wiring. Mutants
`tools/mutants/wwc1.json` (21, all dead).

PINS MOVED: `ether_nodes.test.js`, `prof1_service.test.js`, `prof8_law.test.js`, `prof1_law.test.js` (the ground the
world's grid - past it out); `prof2_law.test.js` (a signature names each slot's ore); `fb1001_nodes.test.js` (the tree
stand hands the region); `fb1011_oremap.test.js` (a province's line); `l10n4_hardcoded.test.js` (the ore card +2, its
English as its other lines are). Mutant records re-aimed by content (12, all dead): the signature's slots, the service's
slots, the body's slots, the Bay-alone ground, the card's own ore, the jungle's four, the Surveyor's card, Daggerfall's
Moonstone.

Section A, WW-C1 (OURS: DFU has no professions' nodes; the provinces' ground is the port's own, every Bay pixel's nodes
as they were to the slot).

## STONE-HEAPS - a boulder past the Bay (AUDIT TAMRIEL-NODES, BUILT, 2026-10-28)

The request: *"audit the main tamriel PR and just ensure the new gathering points show in the overworld across tamriel
properly"*.

The Overworld's path reads no ground of the Bay's: the groups (`scenes/gatherHost.js` overworldGroups), their marks
(`scenes/travelViewMarks.js`), the view's copy and the Gathering filter take a node past the Bay as any other. Each of
the 44 zones' nodes was stood on the terrain kernel's own ground (its lands and woods on, as `scenes/pixelBuild.js` asks):
herbs, veins and trees stood their law (an unconfirmed Rainforest or Subtropical pixel stands its Pine alone, as on the
Bay - PINE-SHARE). No boulder stood in any zone.

A boulder is a World of Daggerfall rock field's piece (ROCK-FOOT), and the fields stand on the Bay alone (`pixelBuild.js`
TAMRIEL2). So WW-C1's boulders - Hammerfell's and Skyrim's twice their climate's, Cyrodiil's - never stood, and every
Mining group past the Bay counted veins alone. The Eltheric isles' boulders (ETHER-NODES) were the same.

The fix (`scenes/mineHost.js` standMineNodes, `fields`): Mining's kind asks whether the fields stand there (`inBay`).
Where none does, a boulder is a heap on the stone tile nearest its law point, else where nature stands at it, as a vein
with no piece stands. The heaps and the veins keep NODE_SPACING_M apart where the stone allows; a vein the stone cannot
space stands where it stood before. The Bay is as it was, and no law moved: the service bounds a slot, never its place.

Measured on the kernel's ground, a stone zone of every province whose law stands boulders (Black Marsh's stands none):
33 of 34 boulders stood unconfirmed and 46 of 47 on confirmed ground, every mining node 6 m from the next, the veins'
count unchanged. Pins `test/scenes/stoneheaps.test.js` (4): the zones' heaps, the spacing on a stone patch, the real
gathering host's Mining group past the Bay, the Bay as it was. Mutants `tools/mutants/stoneheaps.json` (9, all dead).

## WW-C2 - Cyrodiil the open zone (BUILT, 2026-10-24)

The owner: "Cyrodil becomes the new open PvP area with the wrothgarian mountain area being retired in favor of this.
Cryodil will be home to all abundent resources and everything else from the wrothgarian zone." The zone's whole law
moved: `11-Multiplayer/Wild-Zone.md` section 25 is its record (the mask on a grid of cells laid on the world, the halls
out of bootWorld onto the continent's own ground, the halls' lane of map ids, the giants asked lazily, the maps over the
continent, the pixel floored past the Bay, no gate in the zone, the Wroth coven back in the Starfall's bag).

### The zone (`systems/wild/cyrodiilZone.js`, `systems/wild/wildZone.js`)

- Cyrodiil whole: every map pixel the world's grid puts in the Imperial Province (theatre 9), and the water it encloses,
  off the player's own traced picture - every client with the same files cuts the same zone. ZONE-LINE
  (`11-Multiplayer/Wild-Zone.md` section 27): the province's own law to the pixel, kept on cells of four on one lattice
  over the world (a cell had stood whole where its middle pixel stood - a 3.3 km staircase about the province, 9,012
  pixels of the two apart), and the maps draw one line for the zone and the province. Kept while the trace and the fit
  stand. `WILD_REGION` is Cyrodiil's region (70, WW-R).
- The Wrothgarian Mountains' zone RETIRED: the region test, the owner's cut (ZONE-CUT, ZONE-CUT2), Wrothgaria kept out
  (WILD-KEEPOUT), the classic map's zone page (CLASSIC-CUT) - their code and their pins gone, their record kept in
  `Wild-Zone.md` sections 1 and 6.

### The halls, the giants and the wire

- `scenes/zoneHallsHost.js` (out of bootWorld - 41 logical lines, its ceiling 36,209 -> 36,168): the halls' ground the
  continent's own whatever the land switch, a place's pixel the registry's; the day's picks thinned by the day to a few
  hundred asks a tier; a hall stood in the index on the halls' lane, its region Cyrodiil's. AUDIT TESA II: a place's
  pixel is the registry's and the countryside's and the lairs' rolls' (Z7 - `standsToo`, handed by the places host: their
  pick and the beach line, no plateau summed), the day's picks made again when either moves; a hall never stands over an
  index entry it did not make; the build past the Bay asks the day's hall first (P1, `standIn`); and the dry plateau is
  `plateauDry`'s (Z9 - the spawns' answer to the bit, read until it is certain either way, kept a pixel a session).
- The wire (world255, re-hashed in place before its deploy): a hall's key a world pixel's (`wdunHall`), its room the
  halls' lane over the world's pixel key (`spawnedHallMapId`, `WDUN_WORLD_LANE`; `wdunHallOfRoom` reads it back),
  `WDUN_WORLD_RELAY_MIN` 255 (`online.js` says a hall's word only to such a hub); a pose's pixel floored past the Bay.

### What changes on the Bay (recorded)

- The Wrothgarian Mountains are an ordinary region again: the Bay's gate bag holds region 16 (`gateSite.js`
  gateRegions' zone filter reads Cyrodiil's region now), so the day's gate draws over one region more and every Bay
  gate's region from the deploy on is the new bag's; the Starfall's covens are thirteen, the Daughters of Wroth among
  them. Both are the clients' own laws (no service draws them): a client from before the site deploy names the old
  day's gate and coven until it reloads.

### What stays (recorded)

- Cyrodiil had no places on main (TESA's): a death in the zone rose at the nearest Bay town outside it, the zone's
  carriages had no towns to run between. A player reaches Cyrodiil only with the land beyond the Bay on. Folded into
  TESA (#1184) Cyrodiil stands its cities, towns and villages - and the rise still read MAPS.BSA's rows alone
  (`deathRespawn.js` nearestSafeLocationAnywhere), every one a Bay town 876 pixels and more off, a foe's death (AUDIT
  FOE-KEEPS E1, in its ring) with them. AUDIT TESA II P3: the rise reads the one law of the nearest town of the world
  (`deathRespawn.js` nearestSafePlace over the registry, TESA's places on it - `scenes/tamrielPlacesHost.js`
  nearestTownOf), so a foe's death rises in its ring at a town of Cyrodiil and a kill's at the nearest town outside the
  zone (`auditfoekeeps.test.js` E1 ON THE REAL MAP, re-aimed). The zone's carriages still have no road between them.
- The Bay's region 16 keeps its ore (Orichalcum, the Free Lands' - `nodeLaw.js` regionSignature) - the ore was the
  region's, never the zone's.

### Pins and mutants

`test/world/worldWide/wwc2_zone.test.js` (7): the zone the province whole, never the Bay, built again when the picture
moves; the halls and the giants on it, their keys and rooms; the halls' ground the continent's for a Bay-only client,
a hall stood; the pixel floored in every copy; the maps on the world; no gate in the zone and the wire's gate; the
host's wiring. Mutants `tools/mutants/wwc2.json` (33, all dead).

PINS MOVED: `wild1_zone.test.js` (the zone Cyrodiil, the grid's law; ZONE-CUT and CLASSIC-CUT retired),
`wild2_rings.test.js`, `wildfree.test.js` (the law with its thinning off is WILD-FREE's; a province's pool),
`pvpdungeons_game.test.js` (the blob whole; WILD-KEEPOUT retired), `pvpdungeons_hub.test.js` (a hall a world pixel),
`fb1015_cartaway.test.js`, `auditsea.test.js`, `etherwild.test.js` (the sea's name with its article),
`fb1019f_companiondrop.test.js`, `fb1018b_burntsaid.test.js`, `int9_wild_ref.test.js`, `fb1018_pvpblood.test.js`
(the corner floored), `tv6_dungeons.test.js`, `spawneddungeons.test.js` (the harnesses' zone names),
`star2_covens.test.js` (thirteen covens), `tamriel.test.js` (the zone map on the continent), `relayversion.test.js`
(world255), `l10n4_hardcoded.test.js` (two counts fell), `hostceiling.test.js`. Mutant records re-aimed by content (12,
all dead). Locales: six strings redrafted in the thirteen machine-made languages (`tools/l10nInSession.mjs`).

Section A, WW-C2 (OURS: the open zone is the port's own; DFU has none).

## WW5 - the Hollows and the stars in every theatre (BUILT, 2026-10-27)

The owner's calls, taken (AUDIT NO SYSTEM LEFT BEHIND, item 26 - "Every single thing here needs to be addressed. No
exceptions.", 2026-10-26): **a site-bound world event stands nowhere in the open PvP zone** (Cyrodiil's lane stands no
night and no Hollow), and **a province's covens are authored as content** (the thirteen covens are all the Bay's
FACTION.TXT witches, so a province's night needs its own - the eight below). Starfall's coven night and the Abyss Dungeon stood on the Bay alone - a coven's stars over the Bay
scan's pixels (`px = id % 1000`), a star word the Bay's 0..999, one Hollow in the world with its census the Bay's 62.
Now each theatre that holds ground for a site-bound world event keeps its own: a coven night and a Hollow on every LANE
(a lane a theatre, WW2's word), the Bay's the night and the Hollow they always were. DFU has neither (Section A).

### The lanes that stand (`net/wire.js` `SITE_EVENT_LANES`)

The Bay's lane (0) and the eight provinces' (1..8) - every province holds ground for a site since TESA's places are the
registry's (WW7-1; the gates' theatre scans found sites in all eight). **Cyrodiil's lane (9) never stands**: the open
zone runs no site-bound world event (`systems/gate/theatreGateSite.js`, `systems/wild/wildZone.js`). The law both ends
read - the relay holds no picture (`siteEventLaneOpen`, `siteEventPixelOk`: the Bay's own map on the Bay's lane as it
always was, a world pixel off the Bay's map past it, `gateLanePixelOk`'s law). Not `GATE_LANES_OPEN`: the gate's lanes
open by their own record (WW2).

### Starfall (`11-Multiplayer/Starfall.md` section 16)

- **ONE SKY.** Every theatre's night is the same hour and its three stars fall at the Bay's instants (the gates' stagger
  would put a star in daylight). A star's NUMBER names its lane: lane t's three are `3t + 0..2`
  (`net/starfall/starfallLaw.js` `starOfLane`, `starLaneOf`, `starIndexOf`; `STAR_LANES` = `THEATRE_COUNT`, the wire's
  `STAR_LANES_WIRE` pinned equal), so the Bay's are the 0, 1 and 2 they always were and every ledger, receipt, row and
  key keeps its shape. Its instant, master and Heart-Star read its place in the night; its rolls, spot and ledger its
  number.
- **THE PROVINCES' COVENS** (`systems/starfall/starfallCovens.js` `STAR_PROVINCE_COVENS`): the port's own, one a province,
  named in its province's lore and worshipping as the rite does - the Sisters of the Moor (High Rock), the Sand Witches
  (Hammerfell), the Witches of the Rime (Skyrim), the Ash Witches (Morrowind), the Sisters of Dusk (Sumurset), the
  Briar Witches (Valenwood), the Daughters of Mafala (Elsweyr), the Fen Witches (Black Marsh). FACTION.TXT's covens are
  the Bay's, so a province's carries no faction (`factionId` null: no number of FACTION.TXT's, nor one it could grow to)
  and no MAPS.BSA place; its witches, its member and its LEADER are its own words through `t()`
  (`starfall.coven.<id>`, `starfall.member.<id>`, `starfall.leader.<id>`, drafted in every complete locale), and its
  leader comes for the star where a Bay coven's Coven Mother does (`systems/starfall/starCoven.js` `starMasterOf`). A
  theatre's night is its own covens' (`covensOfLane`): the Bay's bag of thirteen night for night as before, a
  province's one coven every night.
- **A PROVINCE'S STARS** (`systems/starfall/starfallSites.js` `findTheatreStarSites`): findStarSites' own law over its
  theatre's ground - the gate's suitable pixels of the theatre (`scanTheatreGate` over the registry's places), each star
  `STAR_APART_PX` from the others and from its theatre's gate of that game day, by a town of its own where the province
  has them, its pixel the world's key read back (`worldPixelOfKey`, never `y * 1000 + x`).
- **THE PAGE** (`scenes/starfall/starfallHost.js`): every theatre's stars stand, each its own key, on a relay that keeps
  them (`online.js` `ww5Ok`); the map's cards every theatre's; the Timers the theatre I stand in (the Bay's on the Bay,
  at sea and in Cyrodiil - nine theatres' falls would bury the window); a province's hold said in its own theatre, the
  Bay's to everyone as it always was.

### The Hollows (`11-Multiplayer/Super-Dungeons.md` WW5)

- **A SLOT A LANE.** Lane t's slots are `t x SD_LANE_SPAN + 1, + 2 ...` (`net/wire.js` `SD_LANE_SPAN` 10,000,000,
  `sdLaneWire`; `net/superDungeon/sdLaw.js` `sdLaneOf`, `SD_LANES`): the Bay's the 1, 2, 3 they always were - every
  realm, receipt, spoils key and sd_kills row keeps its number - and a slot is still one Hollow's whole identity, its
  room `sd:<s>` nine digits at most. A lane's first beat its own zero (`sdFirst(now, lane)`), a rise its lane's next
  slot (`sdRise`), never past its span.
- **THE CENSUS COUNTS EVERY REGION** (`SD_REGION_COUNT` = `CHAT_REGION_COUNT`, 71): each lane's census asks its own
  regions (`sdLaneRegions` - the Bay's 62, a province's one) and a lane's Hollow rises in its own (`sdLaneRegionOk`: a
  Bay region on the Bay's lane, its province's region past it, or -1 - its great cities). A crowd in Skyrim draws
  Skyrim's Hollow, never the Bay's.
- **ITS SITE** (`systems/superDungeon/sdSite.js`): its cities the registry's places of its theatre, ranked by the hubs'
  own claim (`sdTheatreCities` - TESA's places), its great cities its first cities by the slot's roll; its pixel a
  suitable one of its theatre's scan whose nearest town is that city, on dry ground (`findSdTheatreSite`); its location
  the Bay's own labyrinths and keeps cloned under the Hollows' world lane of map ids (`sdWorldMapId`, `SD_WORLD_LANE`
  0x35d - no Bay pixel's, no TESA place's), built where it stands past the Bay (`scenes/world.js` `_locationToBuild`).
- **ITS WORDS** in its province: "in Skyrim" where a Bay Hollow's say its region (`sdWhere`'s `province`; the
  herald's rise "somewhere in Skyrim", its find, its end's field - `net/superDungeon/sdHerald.js` `sdProvinceName`).
- **THE PAGE** (`scenes/superDungeon/sdLanes.js` `createSdLanes`): the Bay's lane is the host it always was
  (`scenes/superDungeon/sdHost.js`); a province's lane a host of its own over its ground, its record the hub's `ln`.
  A risen Hollow a province away is never asked of its ground (its scan is some hundreds of milliseconds of idle time);
  one found, collapsing or in the theatre I stand in is. Each reader of ONE Hollow reads the one in focus (the lane I
  stand in, else the nearest standing Hollow, else the Bay's); the held map's rings, the Timers' rows and the event board
  every lane's - a province's found or collapsing Hollow news to every screen, its next rise its own players' row.

### The theatres' ground (`scenes/eventTheatres.js`)

Both read the gate's own theatre scans (`scenes/gate/gateLanes.js` `keptTheatreScans` - kept as the world host makes
them, so a theatre's rings are walked once a registry generation and a picture for every event on them, with no wiring
of their own in the host), warmed A THEATRE AT A TIME in the browser's idle moments (`createEventTheatres`): a frame
never pays for more than one theatre's scan. A scan with no town yet (TESA's places not landed) is none, and a province's
Hollow is found again when its ground is made anew (`sdHost.js` `rescan`) - standing while it is.

### The relay (world270) and the account service (acct196)

- **Stars**: the word in and out on its lane's pixel (`starWireOk`, `validStarIn`, `starWhere`), `STAR_HELD_MAX` 60 (a
  night's and the night before's three in every lane, and room); the hub says the Bay's holds first (`starHeldOrder`), so
  an older client - which reads the list's first twelve and drops a province's as junk - reads every Bay star it could.
  A stored ledger stands on its own lane's pixel (`starLedgerSane`).
- **Hollows**: the hub keeps a lane's record, mark, owed find and herald under `<key>:<lane>` (`sdLaneKey` - the Bay's
  under the keys it always had), an account's receipt a lane (`sdReceiptKey(sub, lane)`); its beat runs every lane's
  director a lane at a time (`_sdLaneBeat`), its census a lane's own regions, its fan and its hello a province's record
  as `ln` (`SD_LANE_KIND` - an older client drops a kind it does not know; the Bay's stays `ev`); a find's word and a
  cell's tell on the lane's pixel; the live door answers the asker's slot's lane (`_sdLiveInternal`, `sdLiveAsk`'s `s`);
  the herald posts each lane's.
- **`WW5_RELAY_MIN` 270** (`relaySupportsWw5`): world270 re-hashed in place while it is undeployed (world269 never
  ran). A client stands no province's star and says no province's find to an older relay (`online.js` `ww5Ok`) - and,
  since WW5's finish, each socket's own relay says for itself (AUDIT RAID R8b's law, AUDIT WB12d C6): a halo's welcome
  sets its own `ww5Ok`, a province's star word or find goes down a halo only when that halo's relay keeps them, and the
  word goes with its socket across a crossing. A halo on an older object while a deploy is under way refused the word as
  a bad frame.
- **The account service** moves no module and no migration: it bundles the star law (`server-account/src/stars.js`
  `starDayOf` - a province's star's day its own fall's, the Bay's instants) and reads a province's slot and star as
  numbers - folded into acct196, undeployed. `test/net/relayversion.test.js`'s world270 row is re-hashed at the
  integration (the relay's bytes moved under a version that never ran).

DEPLOY ORDER: the relay first (world270), then the account service (acct196), then the site.

### What stays the Bay's (recorded)

- **The Bay's lane** - its coven bag, nights, sites and stars (pinned against the law before WW5 written out, star for
  star over the festival's every night on the freeware), its Hollow's record, census, site, map id, lines and herald.
- **The Hour** (the realm past a Hollow's Rift) is every lane's alike: its room, its fight, its receipts and its spoils
  are the slot's, whatever its lane.
- **The questline and the claim** read a star by its number: a province's held star is The Thirteenth of Frostfall's
  `star-held` as a Bay star's is (its Heart-Star the `heart-star-held`), inside the service's nine a day.

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired: the Hollows' lanes in place of the one host (`createSdLanes`, the same arguments and `here`),
the Timers' source and the held map's rings the lanes' own, a slot's record and Hollow its own lane's (the Rift, the
Hour's rec, the realm's way back), a province's Hollow built where it stands past the Bay - in place, `bootWorld`
35,799 -> 35,798 logical lines (`test/scenes/hostceiling.test.js`). Starfall's lanes read the gate's kept scans and the
registry's kept generation (`keptTheatreScans`, `net/staffPlaces.js` `keptPlaces`) - no wiring. `scenes/exterior.js`
(the bench: no relay), `scenes/worldModes.js` (a building's inside) and `scenes/dungeonContext.js` (underground, the
Hollow's own build) hold no star or Hollow site of their own, by design.

### Pins and mutants

`test/world/worldWide/ww5_stars.test.js` (8): the law (lanes, one sky, the Heart-Star, the master, the held order, the
ledger's pixel); the wire and the relay (the word's pixel, the held bound, `WW5_RELAY_MIN`, the send's gate, the
receipt); the provinces' covens (their words in English and German, the Bay's bag against the old law, the leader);
a province's night over the producer's scan; the theatres warmed one an idle moment; the host (every theatre's stars,
an older relay's, the Timers, the hold's line, the masters); a halo says for itself (its own relay's `ww5Ok`, a star
word and a find); ON THE FREEWARE the Bay's nights star for star against the
law before WW5 and every province's every festival night three stars in its own theatre by its own town, off its gate.
`test/world/worldWide/ww5_hollows.test.js` (9): the law (the span, the lane's zero, the regions, the pick); the wire
(the kinds, the pixels, the keys); the words and the herald; the relay (every lane's beat, census, fan, hello, find,
live door, receipts, herald); a province's site (the claim, the nearest town, dry ground, the map id); the page (the
routing, the ground asked, the focus, the end judged where I stand, the Timers and the map); a province's ground made
again (it stands and moves; a townless ground's line waits and says its province); the Timers, the board and the map;
ON THE FREEWARE every province's Hollow standing - 48 slots, each in its own theatre by its own city on dry ground - and
the Bay's by its own rows. Mutants `tools/mutants/ww5_stars.json` (42: WW5's finish added the halo's five) and `tools/mutants/ww5_hollows.json`
(65), all dead.

**WW5 x WW-GATES-EVERYWHERE, at their merge (AUDIT BAY-LEFT, 2026-10-27).** A2c made a province's gate scan a few ring
pixels an idle moment; WW5's theatres (`scenes/eventTheatres.js`) asked the same scans' `scanOf`, which makes a scan whole
where it is asked - merged, each province's walk was one idle task of the events' again (A2c's probe: 200 to 700 ms a
province cold). The gate's scans answer `wholeScan` (`scenes/gate/gateLanes.js`): the scan when whole, else none with
their own warm begun - made where it is asked with no idle moments, or for a theatre no gate lane stands on - and an idle
moment of the events' asks it and waits, the theatre owed until it is whole. `test/world/worldWide/bayleft_scanseam.test.js`
(2: no place asked in any idle moment of the events', the theatre warm once the gate's slices are done with no ask again,
the scan the same as one made at once). Mutants `tools/mutants/bayleft_scanseam.json` (5, all dead); `ketch_everywhere.json`'s
KTE-the-held-maps-list-read-as-one and `ww5_hollows.json`'s WW5-SD-the-held-maps-one-ring, one line in two getters of
`ui/heldMap.js`, re-aimed by content at their own (dead).

PINS MOVED: `star1_law.test.js` (the 3 that was "no fourth star" is High Rock's first), `star3_relay.test.js` (the held
bound), `sd1_sdlaw.test.js`, `sd3_relay.test.js`, `sd8b_fight.test.js`, `sd11b_relay.test.js`, `sd20b_relay.test.js`,
`fb1020b_sdsea.test.js` (the census every region's, the Bay's lane its 62, `ln` among the kinds, the hub's word a lane),
`sdherald.test.js`, `auditsoc.test.js`, `discordgates.test.js`, `heraldcards.test.js`, `serpent2_herald.test.js` (the
province lanes' Hollows resting beside the Bay's), `sd2b_world.test.js`, `sd11c_page.test.js`, `sd20f_hosts.test.js`,
`sd26_dungeon.test.js`, `sd4b_rift.test.js`, `sd19_presence.test.js`, `sd20e_text.test.js`, `sd2c_omen.test.js`,
`events1_board_ui.test.js` (the lanes' host and its seams), `tesa2_arena.test.js`, `tesa13_mapink.test.js` (a Hollow
built past the Bay), `hostceiling.test.js` (`bootWorld`'s ceiling at its measure), `wwr_regions.test.js` (WW-R's census the Bay's 62: every
region's now), `tesa7_country.test.js`, `tesa8_lairs.test.js`, `tesa10_capitals.test.js` and `spawneddungeons.test.js`
(the build's arm past the Bay, a province's Hollow first), `l10n3e_names.test.js` (the Timers' province name counted),
`egseam_law.test.js` (EG3's golden Abyss realm: the hub's lanes draw the seeded die before the fight - with the die
seeded afresh at the fight's first hello the realm says the same 148 frames on the trees before WW5 and after it) - the
seven found at WW5's finish.

THE OLDER RECORDS (WW5's finish, 2026-10-27): WW5 moved the lines 43 older mutant records name - 38 no longer applied
(`test/tooling/mutantdrift.test.js` QS6 F7) and 5 named two sites once the province lanes copied their lines (MUT-AIM).
Each is re-aimed BY CONTENT at the line its law lives on now, with a note: `sd2.json` (3, at the Bay's own `findSdSite`
by a line only it has), `sd3.json` (6), `sd8b.json` (2), `sd9a.json` (4), `sd11b.json` (5), `sd11c.json`, `sd20b.json`,
`sd20e.json` (3), `sd26_dungeon.json`, `sd26_text.json`, `sd2d.json`, `sdherald.json` (3), `star2.json`, `star3.json`
(3), `star5.json`, `events1.json` (the Timers' site, now `scenes/superDungeon/sdLanes.js` `timers` - `ww5_hollows`
pins the Bay's site there too), `audittesa2p.json` (2), `tesa2.json`, `tesa8.json` (the build's arm past the Bay, a
province's Hollow first), `hostsplit.json` (the ceiling at 35,798) and `wwr.json` (`WWR-the-census-the-bays`: the moved
law held from the other side) - every one run, all dead; and with the halo's word, `sd3.json`'s and `wb12d.json`'s
step-down records (the stepped-down socket keeps `ww5Ok` beside `sdOk`).

Section A, WW5 (OURS: DFU has no Starfall and no Abyss Dungeon - their lanes past the Bay are the port's own).

## STOREFRONT W14 - the season's fissures in every theatre (BUILT, 2026-10-29)

AUDIT-STOREFRONT's W14: the Battle Pass's season in the world (`06-Systems/Battle-Pass.md` section 6) stood on the Bay
alone - its law walked the Bay's gate scan (`px = id % 1000`) and named a region from MAPS.BSA's table, and its host
asked the Bay's scan and the Bay's gate. STOREFRONT began after TAMRIEL-WIDE, so it stands where WW5's stars stand: the
Bay's lane and the eight provinces' (`net/wire.js` SITE_EVENT_LANES), Cyrodiil's open zone none, as the coven nights.

- **The law** (`systems/pass/seasonWorld.js`): a fissure is drawn an AREA at a time, a Bay region or a province's
  district (`areaFissures`, `theatreFissures`), a pixel read by the world's key. Its key, rolls and model are the area's,
  its region the province's (62..69), its name its town's or the province's. The Bay's are the law before W14, to the byte.
- **Its ground**: each theatre's own gate scan, warmed one theatre an idle moment (`scenes/eventTheatres.js`, the
  Starfall's), and one theatre's fissures drawn a frame (`SEASON_LANE_DRAW_MS`).
- **Its roads**: past the Bay an area is drawn once the roads past the Bay have landed over it (`world/arenaRoads.js`
  keptArenaRoadsHost, `scenes/tamrielRoadsHost.js` landedIn), and keeps off them as the terrain draws them
  (`world/road/roadBand.js` nearRoad); none stands while no host lays them.
- **Its gate**: its own theatre's of the day (`systems/gate/theatreGateSite.js`). **Its map**: the held map over the
  continent. **Its rock**: every theatre's clearings in one set, the sweep reading a key once a turn.
- **No relay change**: the camp's sites carry the world's pixel (`px,py:brass.<stage>.<k>`), which the camp law reads
  already; the relay reads none.

THE FOUR HOSTS: `scenes/world.js` unchanged - the season's host reads the kept scans, places and roads itself.
`scenes/exterior.js` (the bench), `scenes/worldModes.js` and `scenes/dungeonContext.js` stand no fissure, as before.
Pins: `season_tamriel.test.js` (10, one on the freeware: every province's every stage). Mutants:
`tools/mutants/storefront_seasontamriel.json` (18, all dead); three older records re-aimed by content.

## WW6 - the raids past the Bay, and a staff town event there (BUILT, 2026-10-27)

The owner's call taken (2026-10-26, after the audit `01-Overview/audits/Audit-Left-In-The-Bay.md` item 27, "WW6 as
planned"): *"Every single thing here needs to be addressed. No exceptions."* Kamer's raids (`03-World/Raiding-Parties.md`)
struck the Iliac Bay alone. The roll walked MAPS.BSA's regions (`systems/raidingParties.js raidRegions` - the travel map
picker's regions and the game's own rows), the key `region:location:day` held a MAPS.BSA location, the tuple and the
wire's word (`net/wire.js validRaidIn`) held the town's pixel to 0..999 x 0..499, and a staff TOWN event, which runs as
the town's raid, was refused past the Bay by name (AUDIT RELEASE R2-7's `town-past-bay`). Measured before, on the
freeware: the day's table 43 regions and 3,444 towns, none past the Bay; `RAID_KEY_RE` refused Torbarke's key
`64:-1000124:600`, `RAID_SIG_RE` its pixel (2425, 270), and the staff law Solitude's event (`place`). Now a town past the
Bay is raided as the Bay's are, from the day's roll to the town's thanks, and staff may bring an event to it.

### The lanes (`net/raid/raidLaw.js`)

- **A LANE A THEATRE.** The Bay's raids are lane 0, the roll they always were; each province past the Bay is a lane of its
  own, its theatre (`RAID_LANES` 10, pinned equal to `THEATRE_COUNT`; not imported - the law is the relay's too and
  imports nothing). A raid's lane is its region's (`raidLaneOfRegion`: a Bay region 0..61 lane 0, a province's region
  62..70 its theatre, WW-R's `regionOfTheatre`), and `raidLaneOfKey` reads it off the key. **Cyrodiil's lane (9) stands
  no raid** (`RAID_ZONE_LANE`, `raidLaneOpen`): the owner's call, taken 2026-10-26 ("Every single thing here needs
  to be addressed. No exceptions."): site-bound world events - gates, covens, Hollows, the ketch, raids - stand nowhere
  in the open PvP zone (PVPDUNGEONS' law, WW2's gates).
- **THE KEY** (`RAID_KEY_RE`) names every region of the world: a Bay region with its town's MAPS.BSA location (0..9999,
  as it always was), a province's region (62..70) with its town's OWN location index - negative, up to eight digits
  (`world/arenaLocations.js arenaLocationIndex`, `world/tamrielCapitals.js capitalLocationIndex`: no MAPS.BSA row holds a
  place past the Bay; the town economy's `region:location` reads it so, `net/townEconLaw.js townReportOf`). A Bay region
  with a negative location, or a province's with a MAPS.BSA one, is no key. Canonical still (AUDIT RAID R5).
- **THE TUPLE** (`raidSig`, `RAID_SIG_RE`): the town's pixel the world's (four digits, either side of the Bay's corner).
- **THE SIDE** (`raidSideOk`, read by `raidWordSane`): a Bay key's town stands on the Bay's own map, a province key's on
  the world's grid off it, in a lane that stands raids. The day's roll never crosses the edge, so a word that does is no
  honest machine's - junk, struck, as AUDIT RAID R6 strikes a start outside its day.
- **THE DAY** (`raidDayRandom(day, lane)`): a lane's generator is the day's stirred by `RAID_LANE_SALT` times its lane -
  the Bay's lane stirs nothing, so its generator is `systems/worldTick.js dayRng`'s to the bit (pinned). The relay's
  slots are a lane's (`raidDaySlots(day, lane)` - its own generator and its own parties; the open zone's lane none), and
  a lane's pace is the mod's (`raidLaneCount`: half a raid an area a game day - an area every four real hours, Mac's
  "4" - never past the slots the relay reads, `RAID_SLOTS_MAX`).
- **THE PARTIES ARE THE PROVINCE'S OWN FAUNA** (`RAID_LANE_PARTIES`, `raidLaneParties`). The mod's three - knights (the
  Knight), bandits (the Rogue, the Thief, the Burglar), orcs - on the Bay, drawn as they always were; past it, those whose
  kinds some roster of the province names, by day, by night or in its towns (TESA-BIOME, `systems/tamrielFauna.js` ROSTERS
  and TOWN_ROSTERS - `03-World/Tamriel-Biomes.md`, pinned equal). One draw among the lane's parties, as the Bay's is one
  among three, so the draws after it stand where they stood:

  | Lane | Parties | Why |
  |---|---|---|
  | 0 the Bay | knights, bandits, orcs | the mod's own (RAID1) |
  | 1 High Rock | knights, bandits, orcs | the Wrothgarian Mountains' Orsinium |
  | 2 Hammerfell, 3 Skyrim, 7 Elsweyr | bandits | no Knight on their rosters, no orc |
  | 4 Morrowind, 5 Summerset | knights, bandits | no orc |
  | 6 Valenwood | bandits, orcs | Malabal Tor's Wood Orcs |
  | 8 Black Marsh | bandits | no orc war band raids it (Tamriel-Biomes' Recorded choice 4) |
  | 9 Cyrodiil | none | the open zone |

- **THE BAY'S LANE IS THE LAW BEFORE WW6**, pinned to the byte against the old law written out in the test: its
  generator draw for draw, its roll and its slots over three hundred days, and its raids' records the shape they were
  (no `area` on one) - and on the freeware's own table (43 regions, 3,444 towns, 22 raids a day).

### The towns past the Bay (`systems/raidingParties.js raidLaneGroups`)

SelectRaids' lists for a lane: the world's registry's LISTED places of its theatre (`world/worldWide/worldPlaces.js
inTheatre` - TESA's capitals and Arena's cities, towns and villages, WW7-1, the same rows on every client that stands the
land) of the types SelectRaids takes (`RAID_TOWN_TYPES`), a capital one town - its centre (WW7-11's
`scenes/livingWorld/livingIndex.js capitalStreet`: its streets are no town of their own) - each keyed by its own location
index (the registry's `location`), grouped by AREA, the province's districts (decision 4: what a region is to the Bay's
draw), the areas ascending and each its towns by map id, each beside its province's region. None for the Bay's lane
(`raidRegions` is its own) or the open zone's. Made again when the registry's generation moves (TESA's land, trace or fit).

Measured on the freeware's registry with TESA's places (the game's own templates), a game day:

| Lane | Towns | Areas | Raids |
|---|---|---|---|
| High Rock | 29 | 28 | 14 |
| Hammerfell | 31 | 31 | 16 |
| Skyrim | 33 | 33 | 17 |
| Morrowind | 31 | 31 | 16 |
| Summerset | 32 | 30 | 15 |
| Valenwood | 31 | 31 | 16 |
| Elsweyr | 31 | 29 | 15 |
| Black Marsh | 32 | 31 | 16 |
| Cyrodiil | 0 | 0 | 0 |

125 raids a game day past the Bay beside the Bay's 22, each province's towns at the Bay's own pace (since FRONTS, the
day's two provinces' alone online: 29 to 33). Day 601's first
Skyrim raid is on Falkreath (1829, 139), bandits, its key `64:-1000102:601`, its cell `world:114,8` (FRONTS: day 600 is
Morrowind's and Summerset's turn; Torbarke on day 600 was the pin before).

### The client (`systems/raidingParties.js`, wired by `scenes/raidHost.js`)

- **THE LANES' DAY** (`syncLanes`): every lane past the Bay is rolled for the day the Bay's list was (fix 1's day), off its
  towns as the registry holds them, and again when the day turns or the registry's places move. A raid already held (its
  key and its tuple) keeps everything it has - its count, its words, its cleanse, its announcement; one the roll no longer
  names (a town the registry dropped) stands down, its raiders routed and its words forgotten; one that has run out is
  never rolled back in. The Bay's raids are never touched. A raid past the Bay is saved with its `area` and restored, and
  the lanes are rolled again over it (kept by key and tuple). The next day's look-ahead (`raidTimerList`, AUDIT EVENTS1
  A4) holds the lanes' too, made again when the registry moves.
- **TOLD IN ITS AREA** (`raidHome`, `homeNow`): the announcement, the withdrawal and the cleanse's line go to a player in
  the raid's area - on the Bay its region, as the mod has it; past the Bay the province's district the player stands in
  (`world/worldWide/worldGrid.js areaAt`; a province is some thirty of a Bay region's size, and its every raid said to all
  of it was a line every few minutes) - each line naming the province ("Torbarke in Skyrim is under attack by bandits!").
  At sea, and past the Veil, none (fix 8). The event board's and the timers' rows read the same (`home` on a raid past
  the Bay's row - `systems/eventBoard.js`, `systems/eventTimers.js`); a Bay raid's row is the one it was.
- **STOOD IN ITS TOWN** (`world/raidShared.js raidTownIs`): the town the host's GPS names, a Bay town by its region and
  MAPS.BSA location as RAID1 asked, a town past the Bay by its own index alone (one index a place of the world; its stood
  record's region is its pixel's as the land read it). The host's `townHere` is the location the player stands outdoors in
  (`_questLoc`, TESA's providers' records past the Bay - `scenes/tamrielPlacesHost.js`), so the raiders, the town watch's
  defenders (`raidDefendingHere`), the town's sites (RAID5's kinds, `scenes/raidSitesHost.js` off the town's own pixel),
  the words to the relay, the thanks (RAID4b) and the reputation run there as on the Bay. A capital's raid stands at its
  centre - its square and its name; its streets are the capital's, not the raid's town.
- **THE REPUTATION** (`grantRaidReputation`, by the raid's region): the legal reputation in the province's region (WW-R's
  71), and the People's and the knightly order's where the faction dictionary holds the province's own (each read by its
  region, never another's).
- **THE WORD** goes to the town's cell on the world's grid (`net/wire.js worldRoom`), and the held map stands the raided
  town on the continent's sheet (`ui/eventMapMarks.js readRaidMarksIn`, `ui/heldMap.js` - LAIR-WORLD's bounties' law), the
  Bay's sheet the Bay's.

### The relay (world270) and the account service (acct196)

- The relay keeps a raid past the Bay in its town's cell as it keeps the Bay's (RAID3): its word's pixel the world's
  (`validRaidIn` - `worldPixelOk`), its key and tuple the law's above, its ledger made, counted and cleansed once with a
  receipt naming the province's key. `server/src/index.js _raidWord` reads the word's lane: its slots are its lane's
  (`_raidSlotsOf(day, lane)` - the Bay's kept by its day as before, a lane's by day and lane), and the operator's pinned
  towns table (`RAID_TOWNS_SHA256`, the hub's whole roll - MAPS.BSA's rows) is the Bay's lane's alone.
- **THE SESSION** (`net/online.js sendRaid`): a raid past the Bay goes only to a relay that hears one
  (`RAID_WORLD_RELAY_MIN` 270, `relaySupportsRaidWorld` - an older relay refuses the word as a bad frame), the primary and
  each halo saying for itself (AUDIT RAID R8b's law); a Bay raid to any raid relay, as before.
- **The account service** reads the same law, so a raid past the Bay's receipt is credited as the Bay's
  (`server-account/src/townEcon.js` - RAID_KEY_RE: its `raid_cleanses` row under the province's key, the town economy's act
  at the town past the Bay's map id), and a staff town event past the Bay is staged by `staffEventFault` (below). No
  migration: the rows' keys are text.

DEPLOY ORDER: the relay first (world270), then the account service (acct196), then the site - both are undeployed, and
WW6 is folded into them (re-hashed in place). A client on an older relay raids the Bay alone online.

### A staff town event past the Bay (`net/staffEvent/staffEventLaw.js`, `net/staffPlaces.js`)

R2-7's remainder, done. `staffTownPixelOk(px, py, loc, rg)`: a Bay town's event (its MAPS.BSA location, 0..9999) on the
Bay's own map, as it always was; a town past the Bay's (its place's own index, negative - `STAFF_TOWN_INDEX_MIN`) on the
world's grid off the Bay, in a province's region (`STAFF_PROVINCE_REGIONS` 62..70, pinned equal). A town's location and
its pixel on two sides of the edge is refused by name (`town` - the panel's `event-bad-town`; it was `town-past-bay`). An
area is `loc` -1 alone (`STAFF_EVENT_AREA`, `isAreaEvent` - a town past the Bay's location is negative too). The picker
offers a province's town as itself (its registry `location`), a place with no index of its own as an area at its pixel;
the account service stages it, the hub's book holds it, and the game stands it in its town by its index
(`systems/staffEvents.js staffRaidHere`, `raidTownIs`), naming it off its lane's towns (`staffTownOf`). On the freeware the
picker offers Solitude as a town (`capitalLocationIndex(1, 0)`) and the law takes its event.

### Decisions (recorded)

- **Areas, not provinces, are told.** A province holds some thirty districts; its raids told to all of it would be a line
  every few minutes. The line names the province; the board's row is the player's own by district.
- **The parties by the province's fauna, not its climate.** The mod's parties are people and orcs; a province raids with
  those its own rosters stand, so no orc war band raids Black Marsh.
- **The pinned towns table is the Bay's.** The hub's whole-roll check reads MAPS.BSA's rows (the operator's
  `tools/raidTowns.mjs`); a lane past the Bay is read against its slots alone - the relay holds no picture of the land, as
  for the gates (WW2), and the slots are what the relay read before the pin was set.
- **The listed places alone.** A lane's towns are the registry's listed rows; the countryside's places past the Bay (TESA7,
  a pixel provider - found by place, never listed, WW1) are no raid's town, so every client rolls the same list.
- **A capital one town**, its centre (WW7-11).
- **A staff town event may stand in any province, Cyrodiil's included** - staff's call, as an area's event already may;
  the open zone's rule is the day's roll's. The owner's call of 2026-10-26 names the site-bound world events the world
  stands on its own (the gates, the covens, the Hollows, the ketch, the raids' day); a staff event is staged by hand, by
  staff, wherever staff bring it - recorded here so the owner can say otherwise.
- **Staff events are told by their region** (a province's), as on the Bay: an event is staff's, said to its region.

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired: its raids' host seams moved verbatim out of `bootWorld` to `scenes/raidHost.js` (HOST-SPLIT,
`tools/hostMove.mjs`; bootWorld's ceiling 35,799 to 35,751), which hands the raids the registry (`net/staffPlaces.js
keptPlaces` - the world's places as the boot keeps them) and the capital's street law. `scenes/exterior.js` FLAGGED - the
fixed-city bench runs no raid; `scenes/worldModes.js` and `scenes/dungeonContext.js` FLAGGED - a raid is the street's.

### Pins and mutants

`test/world/worldWide/ww6_raids.test.js` (12): the law (every region's key, the tuple, the lanes, the zone shut, the side);
the Bay's lane the law before it to the byte; the parties the province's fauna (the rosters read); a lane's day; a lane's
towns off the registry; the client's day (kept, dropped, run out, saved); the client's raid past the Bay (told by area,
stood by index, the board's and timers' rows, the defender, the word to the cell); the relay (the ledger, the cleanse,
the receipt, the junk, the hub's table the Bay's); the session's gate; a staff town event; the held map and the host;
and with ARENA2 every lane over the freeware's registry, the Bay's roll on the real table, Torbarke's raid through the
relay's parse, law and cell, and Solitude's event. `test/server/townecon_service.test.js` (a raid past the Bay's receipt
at the account service: its cleanse row and its town's act; a Bay region with a town past the Bay's index and a province's
with a MAPS.BSA row refused at the receipt). Mutants `tools/mutants/ww6.json` (59, all dead).

THE TWO SURVIVORS AND WW6'S FINISH (2026-10-27). `WW6-staff-index-unbounded` lived (its pin read the bound through
the constant it mutates): the eight digits are pinned by value. `WW6-client-runout-rolled-in` lived because the check
it mutated was redundant: the lanes' roll (`syncLanes`) has one caller, the frame, and the expiry pass follows it there
unconditionally, before any reader - a run-out raid the roll names again goes there, never announced, so unsaid. The
check went and the record with it. The finish pins the half the record had claimed and nothing held: standing in the
raid's own district while the registry's places move, the run-out raids rolled again are neither kept nor said
(`ww6_raids.test.js` the client's day; `WW6-client-runout-said`, RAID1-fix2's mutation through WW6's own test).

PINS MOVED: `test/scenes/hostceiling.test.js` (bootWorld 35,751); `field_raid_ft.test.js`, `raid1_raidingParties.test.js`,
`raid2_raidsOnline.test.js`, `raid4_rewards.test.js`, `raid4b_sets.test.js`, `raid5_kinds.test.js`,
`staffevent_raid.test.js` and `raid3_raidLedger.test.js` (the host's seams in `scenes/raidHost.js`, its live names
`host.<name>`); `raid3_raidLedger.test.js` (the wire's pixel the world's); `raidroll.test.js` and `auditraid.test.js`
(the relay reads the word's lane); `staffevent_relay.test.js` and `auditrelease_r2_gaps.test.js` (a town's event refused
as `town`, a town past the Bay taken). Mutant records re-aimed by content in `auditcaptsea.json`, `auditraid.json`,
`auditrelease_r2_gaps.json`, `auditwe_cover.json`, `events1.json`, `eventtip.json`, `field_raid_ft.json`,
`hostsplit.json`, `raid1.json`, `raid2.json`, `raid3.json`, `raid4.json` and `raidroll.json` (28) - all dead.

Section A, WW6 (OURS: Kamer's mod raids the Iliac Bay alone - DFU's world ends there; the lanes past it, their parties by
the province's fauna and a town past the Bay's event are the port's own).

## The audit (AUDIT WW, 2026-10-24)

The owner: "Do a comprehensive audit on this" - WW1 to WW-C2 read whole, thirteen findings, each verified before it
was fixed. Folded into world255 and the site before their deploy (the relay's law re-hashed in place).

| # | Finding | Verdict | Fix |
|---|---|---|---|
| F1 | A zone hall's map id (`spawnedHallMapId`, the halls' lane over a world pixel key) masked to 20 bits named a Bay place's pixel id - 13 of a day's 840 halls: a hall entered filed a Bay town found, and Immersive Travel read a hall as a dock, a large dock or a capital, the Overworld as a carriage town | CONFIRMED (MAPS.BSA read: every row's high 12 bits under 0x729, so the lane itself is unique) | `net/wire.js` `isHallMapId`; `systems/discovery.js` never files nor finds a hall (a hall is always known - its door in every map's ink); `immersiveTravel.js` `pixelIdOf`; `world.js` `carriageTown` |
| F2 | The relay admitted a gate on lanes 1..9 by the clock alone - no theatre past the Bay has places, Cyrodiil's never will: receipts for gates nobody can find | CONFIRMED | The lanes that stand (WW2 above): `GATE_LANES_OPEN`, the Bay's alone |
| F3 | A `spent` word on any number made a receipt key nothing reads (`gaterc:<sub>.<lane>`, unbounded lanes) | CONFIRMED | `validGateIn` `spent` takes `gateNumberOk` alone |
| F4 | The giants' low ground read the host's woods - the land switch's - so a Bay-only client stood Cyrodiil's giants elsewhere than one walking the continent | CONFIRMED | `scenes/zoneHallsHost.js` `heightAt`, the halls' own continent ground |
| F5 | The Bay's gate lines came with no id: a "one at a time" kind, they joined a lane's card, and a lane's announcement took the Bay's | CONFIRMED (latent while one lane stands) | Every gate line with its gate's id (`systems/eventTimers.js` `gateEventId` - the omen's, the fall's, the rite's) |
| F6 | A lane past the Bay took a Bay pixel: its rite word landed in a Bay cell and, its number past every Bay day's, wiped that cell's circles | CONFIRMED | `gateLanePixelOk`: a lane past the Bay never on the Bay's map |
| F7 | The living world's lane books (a lane's packets, a town's lanes, a port's berths) and the hideouts' book kept by keys alone - never made again when a province's ports or places registered | CONFIRMED | `scenes/livingWorld/livingLanes.js` (out of bootWorld, 36,168 -> 36,146), made again when the lanes' list or the places' generation moves; the hideouts' book keyed by both generations |
| F8 | `bandAt` read a trip's area with no region fallback | NOT REPRODUCED - every registry place carries an integer area (`placeOfRow`) | None |
| F9 | A band past the Bay was kept off the Bay's map alone: by a border its hideout stood in the next province, or Cyrodiil's open zone | CONFIRMED (a High Rock road at Skyrim's border, x 1349 \| 1350) | `outlaws.js` `hideoutOff` keeps a band in its own theatre |
| F10 | The nearest port rebuilt the Bay's port list each ask | CONFIRMED | `worldLanes.bayPorts()` |
| F11 | A site word past the Bay re-read every lane's herald | CONFIRMED | `_heraldLaneArm`: its own lane |
| F12 | A crew and a ship's names read the waters (a search of the ports) three times | CONFIRMED | `navalHost.js` `watersFolk`, one read |
| F13 | Copies: the compass's words in the host beside `worldPorts.js`'s; the halls' ring law beside the zone's | CONFIRMED | One copy each (`COMPASS_WAYS`, `ringOfDepth`) |

### Pins and mutants

`test/world/worldWide/auditww.test.js` (5): F1, F4, F5, F7 and the wiring of F10-F13; F2, F3 and F6 in
`ww2_gates.test.js` (the lanes' law: the open lanes, Cyrodiil's never, a spent word, admission and holding a lane at a
time, a lane's pixel off the Bay); F9 in `ww1_world.test.js` (a band in its own province; by the border, on its side).
Mutants `tools/mutants/auditww.json` (21, all dead; a guard on the near dock's neighbours was dropped as code with no
effect - a hall's id masks to no pixel whose neighbours hold a dock). PINS MOVED: `ww2_gates.test.js` (the host's gates
take `open`; the relay's lane loops), `wwc2_zone.test.js` (the halls' ground), `ww1_world.test.js` (a band past the
Bay in a real province - the old fixture's road ran at sea), `lw5b_sea.test.js` (a town's lanes run on the living
lanes' book), `ww3_sea.test.js`, `fb0929h_deedport.test.js` (the nearest port: the lanes' book, the shared compass),
`events1_board_ui.test.js`, `wb1_gate_omen.test.js` (the gate's lines with their ids), `fb1004e_overworld.test.js`
(the carriage guard), `lw12_outlaws.test.js` (the hideouts' generation), `relayversion.test.js` (world255),
`hostceiling.test.js` (36,146). Mutant records re-aimed by content (14 in `events1.json`, `fb1004e.json`,
`hostsplit.json`, `it1.json`, `lw5b.json`, `wb1.json`, `wb12d.json`, `ww1.json`, `ww2.json` and `wwc2.json`; all
dead).

Section A, AUDIT WW (OURS: the arc is the port's own).

## Folded into TESA (PR #1184, 2026-10-24)

The owner: "Can we fold in CCR-542". The arc merged into TESA's branch whole, each side's laws kept where both wrote:

- **Ports past the Bay.** AUDIT TESA II P7: TESA's places are the registry's, so its ports are WW3's - the port test past
  the Bay is the provider's word (`worldPorts.at`), the nearest port and the waters' distance WW3's over the Bay's
  ports and the world's (P5: TESA6 named Arena's alone past the Bay, a port 500 pixels off with a Bay port in sight just
  off the Bay's edge), and the port here past the Bay the board's list's within SEA_RING as the Bay's (TESA6 asked a
  pixel's ring alone). The harbour's book keys an Arena town by `portIdOfLocation` (AUDIT-TESA A4-F3 and WW3's key at
  once), and its loop asks the registry's port past the Bay - the Bay's rows by the Bay's ids alone is WW3's directory
  bound now (`mapDirectory.js` locationSummaryAt), so AUDIT-TESA A2-3 holds there.
- **The living towns** are WW1's world-keyed index (`livingIndex.js` townAt): no Bay row aliased past the Bay.
- **Registered (AUDIT TESA II P7, 2026-10-25).** The fold left TESA's places off the registry, and past the Bay every
  system the seam was built for saw no place: the living world kept no town record there (the soundscape's town a
  one-block hamlet's at a quarter of a city's murmur, a port's sailors none, its residents named off its region read as
  an area), WW3 saw no port (the harbour board listed none, and at sea off every port past the Bay a ship's crew was
  named by the Redguard bank), the zone's halls stood beside towns. Now `scenes/tamrielPlacesHost.js` registers the
  capitals' slices and the places that stand a location (`world/pastBayRows.js`) as a LIVE list
  (`worldPlaces.registerLive`: its stamp the places' pixels, the fit and the land, asked at every read, its rows made again
  the read after one moved). With it, each held to what it can stand: the living world's trips, dives and bands kept to
  the Bay's theatre (`livingIndex.js` livingRoams, the ways' planner reading the Bay's ground and roads - lifted by WW7-7); the
  lanes past the Bay have their own reach (`worldLanes.js` BEYOND_LANE_MAX_PX 400, BEYOND_LANE_PATH_PX 800 - the Bay's
  LANE_MAX_PX of 30 gave one lane among the 28 ports) and walk the picture's open sea (`beyondLaneWay`: 19 ways of 21 lanes
  in 87 ms on the freeware's data, where an A* over the Bay's pixels cost 15 s); a theatre whose gate lane is shut is
  never scanned (`scenes/gate/gateLanes.js` createTheatreGateScans `open` - Cyrodiil's since WW-GATES-EVERYWHERE opened
  the eight provinces' lanes, their scans made in the page's idle moments: they had cost 453 ms of the page's thread in
  one task a generation). NOT REGISTERED: the countryside's and the lairs' pixel providers - the registry's
  `inArea` and `near` walk a district's 9,216 pixels through a provider, and the roll's dry plateau made one district
  276 ms on the page's thread; the zone's halls ask the rolls themselves (`zoneHallsHost.js` standsToo). The four hosts:
  `scenes/world.js` wires every seam of AUDIT TESA II's lane P (the live list and the rolls through the places host,
  the zone's hall in the build, the world's nearest town for the rise and `/unstuck`, the journey's door past the Bay,
  the lanes' near and way); `scenes/exterior.js` FLAGGED - the Bay's `?exterior` scene stands no place past the Bay, and
  the Bay row's id its discovery hands keeps DFU's key (`discovery.js` discoveryKeyOf); `scenes/worldModes.js` FLAGGED -
  its `unstuck` is the way out of an interior or a dungeon, never a town's; `scenes/dungeonContext.js` FLAGGED - it
  rises nobody (the death's rise is world.js's).
- The relay renumbered to world256 (both sides' world255 composed; `PROVINCE_REGIONS_RELAY_MIN`,
  `WDUN_WORLD_RELAY_MIN` and `GATE_LANES_RELAY_MIN` with it), the account service to acct182, `bootWorld`'s ceiling
  36,129. Mutant records re-aimed by content (13, all dead) and the pins of both sides moved to the composed code.
- **One world-wide relay** (AUDIT TESA II Z2, Z6; 2026-10-25). At the merge with main the relay renumbered again, past
  main's STAFF-EVENT world256 to ASK-LONGER world259, to world260, and the account service past main's acct182-acct188 to
  acct189 - and the three gates' literals stood at 256 in their pins, passing main's world256-world259, none of which
  reads a pixel past the Bay; a spawn grant's world pixel (AUDIT TESA-BIOME F2) had no gate at all, so a client on an
  older relay took a grant past the Bay that relay mints on any pose's pixel and junks in every renewal, carry and
  handover. The four are ONE number now, the relay's that shipped them: `net/wire.js` `WORLD_WIDE_RELAY_MIN` and
  `relaySupportsWorldWide` (the lanes, the provinces' channels, Cyrodiil's halls, and `net/grantLaw.js`
  GRANT_WORLD_RELAY_MIN), held to the LAW row of `test/net/relayversion.test.js` that names WORLD-WIDE, and the row
  before it refused at every gate (`test/net/audittesa2z_worldwide.test.js`) - a merge that renumbers the row moves the
  gate or fails. On an older relay a client takes no grant off the Bay's map (`grantPixelReadBack`; `scenes/grantHost.js`
  its mint, renewal, carry and handover), and its stand stands ungranted there, as before F2.

## WW7 - all of Tamriel lives as the Bay does (IN PROGRESS, 2026-10-25, on #1184)

The owner: *"we need the same city nodes populating the entire map of tamriel"*, *"This needs to apply everywhere"*,
*"We also need to fully integrate our living world into the entirety of tamriel"*. Two maps of the code (the seats', the
living world's) found one root: nothing past the Bay was ever in the world's registry, so every system that reads the
world's places - the living world's index, its trips and lanes, the gates' scans, the zone's halls - saw none there,
and the seats are derived off MAPS.BSA's rows alone, behind laws bounded to the Bay's 62 regions and 1000 x 500.

| Slice | What | State |
|---|---|---|
| WW7-1 | TESA's places in the registry | BUILT (below) |
| WW7-2 | the living world's ways over the land past the Bay | BUILT (below; its walk of the open ground retired by WW7-7's planner on the roads past the Bay) |
| WW7-3 | the seats everywhere: a crown seat a province capital, a palace seat every Arena city-state, the laws to regions 62-70 | BUILT (below) |
| WW7-4 | every capital's castle its halls and its door (DOMAIN4); a province's a guild's, the Imperial City's never | BUILT (below) |
| WW7-5 | the town books past the Bay - homes, the town economy, the market, writs, chapters, the Watch (`bayRegionOk`, `watchPixelOk`, the CHECKs) | BUILT (below) |
| WW7-6 | the seats on the map past the Bay | BUILT (below) |
| WW7-7 | the living world's people everywhere: every trip past the Bay, on the roads and the lanes past it | BUILT (below) |
| WW7-8 | the ships named past the Bay: every reader names a ship as her stander did | BUILT (below) |
| WW7-9 | the living world across the Bay's edge, the land past the Bay waking a region at a time | BUILT (below) |
| WW7-10 | the lanes across the Bay's edge, and the sea's trade past the Bay | BUILT (below) |
| WW7-11 | the long passages: a far lane's passage the cycles it needs; a capital one town to the living world | BUILT (below) |
| WW7-12 | the serpent on the world's lanes, the hub telling every game where the accounts agree it lies | BUILT (below) |

### WW7-1 - TESA's places in the registry (BUILT)

- **The providers** (`scenes/tamrielPlacesHost.js` registerTamrielPlaces): after the Bay's, in the build's own order
  (`_locationToBuild`: a capital, an Arena place, the countryside, a lair) - `tesa-capitals` (a row a slice's pixel:
  `capitalPlaceId(k, so)`, its slice's name, a TownCity, its plan's grid, a port where its Arena place is one) and
  `tesa-arena` (each Arena place standing on the trace with a template: `arenaPlaceId`, its kind's type, its template's
  grid, its port) as lists, so a capital's pixel is the capital's; `tesa-country` and `tesa-lairs` as pixel providers on
  the same rolls the build reads (`countryRollAt`, `lairRollAt`; a lair `hasDungeon` and its dungeon type).
- **When**: on the trace's landing (TESA1's `arenaWarm`, moved into the module - `bootWorld` holds no new line) and again
  whenever the land, Arena's standing or the capitals' move (a version compare where the capitals and Arena places
  build). Only where the land past the Bay stands, as every place past the Bay is - a client with it off sees the Bay's
  alone, as before (WW-C2: a player reaches Tamriel only with the land on).
- **What it moves**: a town past the Bay stands its LivingTown on the registry's record (its district its area, its
  grid, its port) where it stood on a bare one; the People page and a newcomer after a death find it; a lair past the
  Bay is a record of the registry's (`livingDungeonHere` asks the location's own map id - a lair there has no MAPS row).
  Travellers, caravans, outlaws, divers, carried word and hideouts find it once the roads past the Bay are laid whole
  (WW7-7, below - AUDIT TESA III E1-3 had found this line ahead of the code); a town by its map id (`world/worldWide/townTable.js`: the Bay's table, else the
  registry's) names a vendor's, a resident's and a waypoint's town past the Bay; the travellers' rosters kept by the
  town's record, so one made before the places landed is made again.
- **Recorded**: a pixel provider is asked a pixel at a time (`near`, `inArea` walks a district's 96 x 96 once a
  generation) - the cost WW1 built them for, to measure in the running game; the countryside's places are found by place,
  not listed (a vendor of a farm past the Bay is named once its pixel has been asked).

### WW7-2 - the ways (BUILT)

The living world's planner (`livingWorld/ways.js`, the host's `ground`) walked only the Bay's table - everything off it
read as water, so no trip past the Bay had a way. WW7-2 taught it the land past the Bay as the player's planner walks it
(TV-BEYOND's `beyond`: the ground's own dry pixels, no road). WW7-7 (below) retired that walk: a pair past the Bay is the
window planner's on the roads past the Bay (`systems/livingWorld/beyondWays.js`), and a Bay pair's planner never leaves
the Bay's table (its bounds are the table and its two ends), so the Bay's ground is the table's alone again.

### WW7-3 - the seats everywhere (BUILT)

The owner, asked three calls: High Rock's and Hammerfell's crowns past the Bay - *"Whatever makes sense"*; every castle
an interior - WW7-4; each province's crown a kingdom of its own, its own icon and banner - *"Yes"*.

- **The kingdoms** (`net/kingdomLaw.js` KINGDOMS): seven past the Bay - Skyrim (region 64, seated at Solitude),
  Morrowind (65, Mournhold), Summerset (66, Alinor), Valenwood (67, Falinesti), Elsweyr (68, Torval), Black Marsh (69,
  Helstrom), Cyrodiil (70, the Imperial City) - each its province's WW-R region, its crown seat its capital's name
  (`kingdomSeatName`). High Rock's and Hammerfell's land past the Bay (regions 62, 63) is no crown's: their crowns are the
  Bay's three, so their places past the Bay are palace seats. The Bay's three alone are the Marches', the Tides'
  (`tideLaw.js` tideLandOf: a province's crown is no Tide's land) and the card suits' kingdoms (`BAY_KINGDOMS`).
- **Their marks**: a metal and banner each (argent, sanguine, celeste, teal, tenne, umber, purpure -
  `townSeatLaw.js` KINGDOM_METALS), a crown glyph each appended after every glyph a token carries (`identityToken.js`
  GLYPHS: crownSK, crownMW, crownSU, crownVW, crownEW, crownBM, crownCY - the badge's letters K, M, U, L, E, B, C, S and V
  being taken), its line in the wardrobe and the account page, every language's. The provinces' crown sieges on
  Friday, an hour each from 17:00 to 23:00 (`CROWN_SIEGE_SLOT`) - Saturday stays the Bay's crowns' night, no two crowns'
  sieges at once.
- **The seats** (`systems/town/townSeats.js` tamrielSeatsOf, `replaceSeats`): a crown at each capital's centre (its key
  `capitalPlaceId(k, 0)`), a palace at every Arena city-state on the trace that no capital's pixel holds - laid into the
  seats' book by source (`'tesa'`) whenever the places past the Bay register (`tamrielPlacesHost.js` seatPlaces), never
  overriding a power the Bay's own derivation gave. The book is sealed, not frozen, so its `version` moves and its
  `list` and pixel test are made again.
- **The laws**: a seat's region any of the 71 (`seatRegionOk`), its pixel the world's grid's (`SEAT_PIXEL_SPAN`, the
  services' bundle reading no map), a crown's name its capital's; a gate's kill counts at its own lane's province alone
  (`townSeatLaw.js:"export const gateRegionOk = (day, region) => {"` - the account service's ledger and influence read
  it, so a province's gate is its own seats' and no other's). The domain tables' CHECKs (migrations 0178-0180, 0177-0179 until main's WOVEN-PAYS took 0177, - 0167-0169 before main's own took those numbers - not yet
  deployed) take regions to 70; the renown tracker with them.
- Relay world256 and account acct182 changed in place (neither deployed). Mutant records re-aimed by content (7).

### WW7-4 - every castle its halls (BUILT)

The owner: *"The tower in the middle needs an interior, ensure all castles have interiors"*. DFU's reference: a crown
city's castle is that location's own dungeon (MAPS.BSA: Daggerfall's S0000160, Sentinel's S0000040-41, Wayrest's
S0000080-81 - the five RDBs whose start marker carries a magnitude, RDBLayout's castle block: its guards keep the
peace, its own light and music, no rest), entered by a dungeon door (archive 56) in the city's palace model. Past the Bay
no capital had either: its palace's door was a dark face, and its location `hasDungeon: false`.

- **The halls** (`world/capitalCastles.js`). DEPARTURE (named): Daggerfall keeps no castle past the Bay, so each
  capital's halls are a Bay palace's blocks, laid where the Bay lays them, under names of the port's own (`SC000160.RDB`
  and the rest - an S kept, so a quest block as the Bay's; `CASTLE_BLOCK_INDEX` past the capitals' own port blocks), each
  open side closed by that castle's own border blocks. The White-Gold Tower and Mournhold take Wayrest's palace (two
  halls), Solitude and Torval Sentinel's (two), Alinor, Falinesti and Helstrom Daggerfall's throne hall. The Bay's court
  is stood down in the copy (`castleKeeps`): every person's flat but the castle's bards, prostitutes and children
  (FACTION.TXT 511, 512, 514) and a flat no faction claims goes - no King Gothryd in the Blue Palace - with the quest
  markers (199.11, 199.18); the guards (the 199 markers), the start, the models, lights and things stay, and so does any
  object an action chain names. PROVINCE-COURTS (below) re-seats the court instead, as the capital's own (`CASTLE_SEATS`:
  through DFU's generic factions, in their looks - still no King Gothryd). The copy is made when first read, of the player's own BLOCKS.BSA
  (`worldDataReplacement.js` registerPortBlockOf), never shipped.
- **The castle** is the capital's centre's dungeon (`tamrielCapitals.js` synthesizeCapitalLocation: the slice of ordinal
  0 alone) - its map id the crown seat's key (WW7-3), its dungeon id that map id as a lair's is, its type a crown
  castle's (HumanStronghold). It never shrinks (`smallerDungeons.js` dungeonSizeFor: the Bay's castles are main story's,
  whole), so the public room and a guild's instance lay the same halls.
- **The doors** (`capitalShapes.js` entranceDoor): one dungeon entrance on each palace's dark door, as a classic model's
  door is (a plane's first three corners, its normal out - where the way out lands), turned north with the model
  (`capitalModels.js` northward): the White-Gold Tower's east door, the Blue Palace's wing, Mournhold's palace's door to
  the plaza, Alinor's on its top, the Mane's, the Xanmeer's shrine's south doorway - and Falinesti's Graht-Oak, which had
  no door, a timber porch into its trunk's foot on the north (between two roots, under the walkway's first turn). A
  door on a misc model needs no building record (`worldModes.js` tries the dungeon arm first); the door resolves to the
  location on its pixel, the centre's.
- **The keys**: each province's castle the relay admits a guild to (`instanceRoom.js` PROVINCE_CASTLE_MAP_IDS, after
  the Bay's three) and its Charter's holder may buy (`castleLaw.js` castleKeyOk) - never the Imperial City's (the owner,
  DOMAIN2: "cyrodil excluded"): the White-Gold Tower's halls stand open to all, the open zone's seal passing them
  (`world.js` wildDungeonGate: a capital's castle is no ruin). AUDIT TESA III E2-2 (`01-Overview/audits/Audit-Tesa-III-E2.md`):
  the Guild window names a castle by its capital (`castleLaw.js` castleCityOf - "Castle Solitude", where it had said
  "Castle Skyrim"), and its line and the service's `castle-none` name a province's capital beside the Bay's three crowns.
- Relay world256 changed in place again (not deployed: the guild arm's rooms). WW7's mutant records `tools/mutants/ww7.json`
  (WW7-1 to WW7-4, 28, all dead; WW7-5's ten and WW7-6's five with them).

### WW7-6 - the seats on the map past the Bay (BUILT)

The Bay rings its seats on its own marks (`inkMap.js` paintSeatRing, Seats-Arc 3.3); past the Bay the continent's layer
inks the cities (`tamrielInk.js` paintTamrielInk) and knew no seat. Each city it inks now carries its seat's key - a
province capital its centre's (`capitalPlaceId(k, 0)`), any other place its own (`arenaPlaceId`), the Bay's three
capitals out on the continent their map ids - and the map hands the seats in (`heldMap.js` tamOpts `seatAt`, the Bay's
own `deps.seatAt`): a seat's ring under its glyph in the Bay's law (`seatMapMark` - unheld ash, a holder's colours, a
siege's edge), and under the pointer its card (SEAT-TIP's `seatTipOf`). The ring moves with the marks' version, as the
Bay's do. Every glyph's halo is now painted before every glyph there, as the Bay's marks are (MAP-FIELD6).

### WW7-5 - the town books past the Bay (BUILT)

WW-R kept the books a town keeps the Bay's 62 by name (above, "What stays the Bay's") until the world's towns past the
Bay stood; WW7-1 and WW7-3 stood them. Measured before the change: the deployed service already refused regions 62 and
up (its `regionOk` read the Bay's 62 then), and only seven tables carry a region CHECK - most books were held by their
code gates alone.

- **Every region's** (`net/nodeLaw.js` regionOk for `bayRegionOk`): the market (its listings, orders, auctions, bids,
  traders and hubs - `market.js` hubsOf every region's), the writ boards (`professions.js` listWrits) and the guild
  writs and commissions (`writs.js`), the contracts, the cards, the sea bounty (its region a bank's, every region's the
  Empire's), the chapters, their halls and their receipts (`npcChapters.js`, `npcHalls.js`, `npcReceipts.js`,
  `npcChapterLaw.js`) - so a seat past the Bay's Hall of Records and a province gate's receipt are read, where WW7-3
  had left them refused. A home any region's (`homeLaw.js` HOME_REGION_MAX 70 - its table keeps no CHECK); the staff's
  economy filter with them. `bayRegionOk` stays, read by no town book.
- **The CHECKs** (migration 0181, `server-account/migrations/0186_world_books.sql` - 0180 until main's WOVEN-PAYS took 0177, - 0170 before main's own took it): the market's listings, orders,
  auctions and bids (`region < 62`), the guild writs, the commissions and the contracts (`region <= 61`) rebuilt as 0044
  rebuilt the market's - every row and column carried, every index and trigger made again as the migrations before left
  them (0137's vendor-board triggers on the listings with them: the board's guard asks a rebuild to make them again in
  it, `vendor_board.test.js`), the rows a CASCADE would take (a listing's reports, an auction's bids and reports) kept
  aside and put back; the region `0..70`. Generated off the live schema, tested on seeded rows (`ww7_books.test.js`).
- **The Watch** (`watchReceipt.js` watchPixelOk): the world's grid but the Veil's box (`WATCH_VEIL_BOX`, the Eltheric
  Ocean's `ETHER_BOX`, pinned equal - north of all Tamriel's frame) - so the relay mints a receipt past the Bay, and a
  town's witness, its Watch acts, a seat's Watch influence and a node's Motherlode stand there; the isles past the Veil
  are still never a site (AUDIT ETHER-OW C2-1).
- **The town economy** (`townEconLaw.js` townReportOf): a town past the Bay reports itself - on the world's grid, its map
  id a place of the port's own (its low 20 bits `TOWN_PLACE_ID_MIN` and up, past every Bay pixel id), its location its
  own negative index; the Bay's towns as before (their map id names their pixel). The registry carries a place's
  location (`worldPlaces.js` placeOfRow `location`; the capitals', Arena's and the countryside's rows), and the town
  table hands it to the economy's host. A town's key stays `py x 1000 + px` - it phases the market's waves alone. A
  market's board is a pixel of the world's grid (`marketLaw.js` hubPixelOk).
- Relay world256 changed in place again (the Watch's ground), the account service acct182 in place (its migration 0170, 0177 since TESA x MAIN II: relay world260, account acct189):
  neither deployed. 22 mutant records re-aimed by content (the two WW-R records turned: a book the Bay's is now the
  mutant).
- The L10N ratchet records WW7-3's two province names of two words (`kingdomLaw.js`: Black Marsh, the Imperial City) -
  proper names, as the capitals' are.

### WW7-7 - the living world's people everywhere (BUILT, 2026-10-26)

The owner, answering AUDIT TESA III E1-3 (whether the living world's people should go past the Bay): *"Yes travellers to
need to travel everywhere. Same for ships."* P7's guard (`livingRoams`, the Bay's theatre alone) is gone: every trip - a
traveller's, a caravan's, a patrol's round, a noble's procession, a minstrel's, a carter's market day, a hunter's wild, an
adventurer's dive and a band's legs - sets out from and ends at a town wherever one stands, by land on the roads past the
Bay and by sea on the lanes past it.

- **The sides of the Bay's edge** (`scenes/livingWorld/livingIndex.js` livingSide: the Bay's, the land past it, none in the
  Eltheric Ocean's box). The Bay is every client's; the land past it only the clients that stand it - TAMRIEL2's switch is
  a player's own, online too - and LW0's law is that every client walks the same people with nothing sent. WW7-7 kept each
  trip to its own side; WW7-9 (below) takes it across where the land past the Bay stands and is laid, the Bay's living
  world the one it was, to the byte, where it does not.
- **The towns near past the Bay, by the roads' places.** Measured on the freeware's data, the registry's `near` past the Bay
  walks a square's pixels through the countryside's and the lairs' rolls: 77 ms for a square of eighteen (the Bay's: about
  one), most of it the places' own plateaus (a 129 x 129 kernel, ~1 ms a place). The roads past the Bay rolled every place
  of the land with that plateau to lay their roads to it (TESA15, `world/pastBayPlaces.js`), so a square past the Bay is its
  listed places (binned, BEYOND_BIN_PX) and the roads' places in it, each found on the registry at its own pixel (`at`) -
  the walk's answer, place for place (pinned with ARENA2) - and a province district's towns (a band's) the same way, its own
  area's alone, never its 9,216 pixels. The places host's roll reads a pixel the roads rolled a place on as dry (`tamrielPlacesHost.js:"ground: (x, y) => pastBayPlacesIn(x, y, x + 1, y + 1).length > 0 || _countryGround(x, y) };"`):
  the same answer, its plateau summed once, on the roads' worker. With both, 26 ms cold for a square of eighteen, kept after
  (the registry keeps a pixel's answer, the index a square's).
- **The ways past the Bay** (`systems/livingWorld/beyondWays.js` createBeyondWays, the way book's `beyond`): the one planner
  (`travelRoute.js` planRoute, unchanged and uncopied) on a WINDOW of the world's grid about a pair's two ends, its roads and
  tracks the roads past the Bay's bytes (TESA14's layer, read through `arenaRoads.js` layerByte), its water every pixel
  that is no dry ground past the Bay and the Bay's own pixels with them - a way past the Bay never walks onto the Bay.
  Bounded: a window of BEYOND_NEAR_PX (21) about the ends asked with the planner's first two rungs, and only where the
  planner's own proof leaves room for a cheaper way outside it, the window of BEYOND_FAR_PX (61) with its third - the answer a
  single wide ask's, rung for rung; never the whole map's rung (the continent is no table). The ground is read a 64-pixel
  tile at a time, one tile a frame (BEYOND_TILES_PER_FRAME - a tile ~12 ms cold, the composed continent's heights), and a
  pair whose tiles wait waits, as a pair unasked does; PERF-WAYS1's floor and time are shared with the Bay's pairs. Measured
  (ARENA2, a region of Skyrim's west laid as the roads' workers lay it): 24 of 24 pairs routed, 61% of their steps on the
  roads past the Bay, each equal to a single wide ask; a way 29 ms with its tiles read cold, ~1 ms warm.
- **Every trip past the Bay waits on the roads past the Bay** (the trips' world's `waiting`, which `trips.js` ownTrip
  answers undefined for, as for a way not yet asked): the regions land nearest their player first, so a town half-way
  through the build knows the towns near one client and not the next. WW7-9 (below) wakes it a region at a time, on the
  roads' host's own word. The books past the Bay are the roads' build's: laid again (the places past the Bay moved), every
  square and every way past the Bay is asked again, the index's generation moves, and with it the trips' memo, the
  hideouts' book and the trips' kept choices (`trips.js` roadChoices, templesNear - kept by the world's generation now).
- **By sea**: a port town past the Bay sails its travellers on its lanes (LW5b's passage over the lanes past the Bay - WW3's,
  P7's BEYOND_LANE_MAX_PX of 400), and its sailors crew its packets (LW5's berths read the world's lanes). SEA_PACE_X stays
  three: a lane past the Bay is some ten of the Bay's long (a port's two nearest a median 325 pixels off), so its passage
  takes the cycles it needs (WW7-11, below - the owner: "Make them longer").
- **Online**: nothing crosses the wire (LW0 decision 2) - every trip past the Bay is a pure function of the registry's places,
  the roads past the Bay, the ground, a seed and the clock, as the Bay's are. TESA-ONLINE's divergence holds and no wider: a
  player without Arena's places stands other roads and places past the Bay, and so other people there.
- **HOST-SPLIT**: the trips' world, the index, the ways and the trips' memo out of `bootWorld` to
  `scenes/livingWorld/livingTrips.js` createLivingTrips (36,116 -> 36,085 with the one line that hands the town probes the road's parties - `townProbes.js` __livingRoads; the ceiling with it); the host hands the registry,
  its ground, the drawn network, the market band and the roads past the Bay's host (`tamrielRoadsHost.js`, read, not
  written). THE FOUR HOSTS: `scenes/world.js` wired; `scenes/exterior.js`, `scenes/worldModes.js` and
  `scenes/dungeonContext.js` run no living world of their own (WW1's record: their residents and divers are the world
  host's).
- **Recorded**: the countryside past the Bay is as dense as the Bay's (a square of eighteen about 25 towns past the Bay held 2 to 107, most 20 to 70, where a Bay one holds 19 to 99), so the
  trips' ranges are the Bay's.

### WW7-8 - the ships named past the Bay (BUILT, 2026-10-26)

"Same for ships": every kind of ship the Bay sails already sailed the sea past it - the packets (WW3's lanes past the Bay,
P7's reach), the director's traffic and its encounters on any water about a player, the Warm Ashes raiders (`onWorldSea`),
the harbours' ships at a port past the Bay, the bounty board's quarry and the player's own boat (TV-BEYOND, START2's
voyages). What kept them the Bay's was their names on the wire: `systems/naval/navalWire.js` said a ship's region on the
Bay's 62 alone (-1 past the Bay - an older build's door refuses a whole word with any other) and no area, and a reader took
-1 as "the reader's own waters". Her stander had named her by her WATERS' AREA (WW3's `seaAreaAt`: a province's district, at
sea the nearest port's) - so a packet named by her home port's people (Solitude's) met in Morrowind's waters, a crown's ship
of the Bay's region named by the province's people she was met in, and every ship by the line where the nearest port changes
was called otherwise on another player's screen, her captain and her hands with her.

- **`r`** (`navalWire.js` pastBayNaming, validNaming): each ship of `s` named past the Bay, `[n, region, area]` - her region
  where it is a province's (62 to 70), her names' area where it is a province's district, each -1 otherwise, never both;
  through the door whole or not at all (a Bay region or area on it, past Cyrodiil's region, either length, more than a
  word's ships). The reader takes her region where `s` said -1, and her area. A key of its own, as `k`, `m` and `l` are: an
  older build reads none of it and names her as before; a newer one reads an older word as naming none.
- **The host** (`scenes/naval/navalHost.js`): the area her names are drawn in is the module's `namesArea` (her spec's - a
  packet's home port's, a peer's word's - none for a ship of a named region, else the waters here), kept on her entry, said
  in her word and handed to a peer's copy. A province's region names her by its people as any of its districts does
  (`shipNameBank`, pinned for all nine), so `r`'s region alone names her right too. Three entries in createNavalHost (6,222
  -> 6,225, under its ceiling of 6,434): the area threaded through the statements that carry her region.
- **No relay change**: the foes frame is opaque to the relay (navalWire.js stands outside its bundle), and neither Worker
  bundles any module this slice moved.
- **Recorded**: the crowns stay the Bay's three - a navy ship past the Bay sails for the nearest Bay crown and a crime at sea
  there is charged as on the Bay (`navalShips.js` CROWNS, the wire's `n` by their rows): seven more crowns' navies are the
  wire's, the law's and the save's shape, the owner's to call. The serpent's lanes are the world's since WW7-12, and
  SEA-TRADE's port lanes since WW7-10 (below).

### Pins and mutants (WW7-7, WW7-8)

`test/world/worldWide/ww7_people.test.js` (11, one with ARENA2): the sides; the index past the Bay (unsaid none, the walk's
answer by the roads' places with the provider asked there alone, never the Bay's, a Bay square the Bay's alone, laid again
asked again) and a district's bands; the way book past the Bay (the wait, the edge, the flip, the epoch, the unkept wait, the
frame, the shared floor); the window planner (a road walked, round the Bay's corner off the Bay, the narrow and the wide
windows and the proof between them, the tiles' budget, the clear); the trips' wait and their choices by the generation; the
land past the Bay's word and the trips' world; the vouched roll; the wire's `r` and its door; every reader's names and the
host's area; with ARENA2 a region laid - the squares the walk's, the vouched roll the plateau's, every way on dry land off
the Bay, mostly on the roads, a single wide ask's. Mutants `tools/mutants/ww7_people.json` (47, all dead).

PINS MOVED (WW7-7): `audittesa2p_hosts.test.js` P7 (the sides; a town past the Bay's lanes its own), `ww1_world.test.js`
(no square past the Bay while its roads are unsaid; the host's index the module's), `auditww.test.js` F7 (the new list's
lane the Bay's; one over the edge none), `lw3_roads.test.js`, `lw6_deep.test.js`, `lw12_outlaws.test.js`,
`lwdry_ground.test.js`, `lwfix4_turns.test.js`, `townecon_living.test.js`, `ww7_places.test.js` and `perfon4_probes.test.js`
(the trips' world, its ways, memo and rosters in `livingTrips.js`); (WW7-8) `ww3_sea.test.js`, `ethership.test.js` (the
names' area the module's `namesArea`). Mutant records re-aimed by content: `audittesa2p.json` (P7's four, now the sides'
filters, the district's area and the lanes' side), `ww1.json` (two), `lw3.json`, `lwdry.json`, `ww7.json` (WW7-2's walk, now
the window planner's wiring), `perfways1.json` (two), `captwaters.json`, `ethership.json`, `audittesa2k.json` - all dead.

### WW7-9 - across the Bay's edge, a region at a time (BUILT, 2026-10-26)

The owner's *"travellers need to travel everywhere"* again, on the follow-up to WW7-7: the trips across the Bay's edge,
and the land past the Bay waking a region at a time where it waited for every region of the build.

- **The roads past the Bay's word, a region at a time** (`scenes/tamrielRoadsHost.js`, TESA14's host - its stream
  finished, the word added here): `build()` the build's number (moving as a build starts: the layer and the places reset),
  `onRegion(fn)` each region landed, told with its GRID - its core and REGION_APRON about it, the builder's own 1000 x 500,
  the pixels its layer may reach (a region's roads run on into its neighbours' aprons, and the layers are OR'd) - and
  `landedIn(x0, y0, x1, y1)`: a box's land past the Bay is the build's whole once every region with land whose grid meets a
  pixel of it past the Bay has landed. A box of the Bay's own always is (no region lays a road on the Bay); one past it
  never before a build; every one once the cache has been asked of every region and none is pending (a region that failed
  is let go, as the whole build's word let it go). A build's start answers before its cache is asked, so "none pending" is
  no word until it has been.
- **A place waits on the land about it** (`scenes/livingWorld/livingTrips.js` `waiting`): a place of either side waits while
  the land past the Bay within LIVING_WAKE_PX of it (80 - TRIP_REACH_PX, a way's BEYOND_FAR_PX window, INN_REACH_PX: every
  square its trips read, every way's window and its inns lie inside it) is still being laid. A Bay town deep in the Bay
  never waits; one by its edge waits until the land past the edge is laid; a town past the Bay as before, but a region at
  a time; past the Veil none. An area's bands wait too (`waitingArea`: a province's district and LIVING_AREA_WAKE_PX about
  it - its legs' ways and a hideout off one; `systems/livingWorld/outlaws.js` hideoutsOf asks again), and so do the readers
  of a waiting place (`systems/livingWorld/trips.js` visitorsOf and innGuestsOf answer undefined; diversAt, divesIn and
  fallenIn pending): a reader's answer for a place whose towns near were half known was kept short (the visitors' book,
  the told news) and never asked again. WW7-7's whole build's word (`pastTheBayEpoch`, every one of the 48 regions on the
  freeware's continent) is retired: the land about a place stands on two to six regions' grids, so the living world about
  the player wakes once the nearest few have landed - a minute or two on the first boot, at once from the cache after -
  where it waited for all 48 (853 s on two workers in the running game, 2026-10-26, the regions 6 to 72 s each).
- **Nothing known moves as the regions land.** A place that woke never waits again until the roads are laid again: every
  square, way and tile it read was its build's whole when read. The index's squares are asked again as each region lands
  (`landed()`, a count - a square half laid was asked short) without moving the index's generation (no trip is made
  again); the window planner lets go the tiles a region's grid reaches (`drop`); the way book keeps its ways by the build
  (a new build: every way past and across the Bay asked again, the generation moving).
- **Across the edge** (`livingIndex.js` acrossIn): where the land past the Bay stands, a square that holds both sides holds
  both sides' places once the land past the Bay in it is laid - a Bay town by the edge has the towns past it near, a town
  past the edge the Bay's listed places - so a traveller of either sets out across it by its trips' own laws (the ranges,
  the temples, the markets, the dives, the bands' areas their own). The way (`systems/livingWorld/ways.js` farWayOf's
  `cross`, `systems/livingWorld/beyondWays.js` plan's `cross`) is the window planner's with the window's Bay pixels the
  Bay's own ground: the drawn network's roads with the crossings' joins over them (TESA5: a run's Bay pixels are the layer's
  `join`, read as the Travel Options planner reads them - VOYAGER2.1), its tracks, and the Bay's table's water; past the
  edge the roads past the Bay as before. So it walks the Bay's road out by a crossing's gate and on along the roads past the
  Bay (pinned: a road all the way over the edge with the join, the open ground at the edge without it). A tile holding a Bay
  pixel is read apart for a pair across, and read again when another network is drawn; the ways across are kept apart and
  asked again with it (the generation moving). With no land past the Bay a pair across has no way, as before.
- **By sea** across the edge (`livingLanes.js` from): a port town's passage may ride a crossing lane (WW7-10) to a port of
  the other side.
- **Online.** Where the land past the Bay does not stand (no roads past the Bay's host: no `beyond`, no square or way across,
  no crossing lane, no wait) the Bay's living world is the one it was, to the byte. Where it stands, a Bay town by the edge
  waits while the land past it is laid, so two clients that both stand it walk it alike once both have laid it. TESA-ONLINE's
  divergence holds and now reaches the Bay's edge: a player without the land past the Bay walks other people in a Bay town
  beside it. Nothing crosses the wire (LW0 decision 2); no relay or account law moved.
- **HOST-SPLIT**: no host grew. `scenes/world.js` hands the roads past the Bay's host to the trips' world as WW7-7 did (its
  town economy's lanes line names the world's lanes - WW7-10); `tamrielRoadsHost.js` is the module the host wires. THE
  FOUR HOSTS: the world host wired; `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` run no
  living world of their own.
- DEPARTURE (named, OURS - Ledger A): DFU's living world is the Bay's; here it runs over the continent and across the Bay's
  edge.

### WW7-10 - the lanes across the edge, and the sea's trade past the Bay (BUILT, 2026-10-26)

"Same for ships": WW7-8 found every kind of ship already sailing past the Bay. What stayed the Bay's: no lane joined a Bay
port to a port past it - the Bay's lanes keep to its water, the ones past it to the picture's sea (beyondLaneWay leaves the
Bay's rectangle out) - so no packet sailed between them and no traveller took passage; and SEA-TRADE's harbour term counted
the Bay's lanes alone.

- **The Bay's mouths** (`scenes/naval/worldLanes.js` bayMouths): each edge pixel of the Bay's lane water whose run straight
  out is the world's lane water to the first picture cell clear of the Bay's rectangle, that cell the picture's open sea
  (`pictureSeaMask` - beyondLaneWay's own, now its own export; AUDIT TESA III: `pictureSea` was arenaPlaces.js's one-pixel question's name too), within MOUTH_RUN_PX (16: at the freeware's fit the south
  edge's run clears the rectangle at 12). On the freeware's data 854: the north edge's 218 (its western 217 pixels), the
  south's 138, the west's 498, the east's none.
- **Its seaward water** (baySeaward): every Bay lane pixel a boat sails to from a mouth (SEA-LANES' step: eight neighbours,
  no corner cut past land) - 179,924 pixels on the freeware's map. A lake's harbour (FIELD BUGS 2026-10-14 INLAND-PORTS: 331
  of the map's lake pixels carry the Ocean climate) and a cove the map's water never joins to the sea are not.
- **The crossing lanes** (crossLanes): each port past the Bay runs packets to its LANE_NEIGHBOURS nearest of the Bay's ports
  whose roadstead is seaward, within BEYOND_LANE_MAX_PX - SEA-LANES' own law read from the side past the Bay alone, so no Bay
  port's own nearest move and no Bay lane changes. On the freeware's data six: Northpoint to Knightshope and the Rat and
  Priest Hostel, Hegathe to the Mole and Giant Tavern and Tsetudax, Gilane to the Ruins of Mhoghton Orchard and the Nest of
  Helloth (Travel Options' own port list - its taverns and ruins are ports, as on the Bay). Their nearest Bay ports by the
  crow's flight (Greenhouse Manor, Castle Wickhart, Kaluhbia, Bergama) stand on water the Bay's never joins to the sea:
  the seaward test's reason.
- **A crossing lane's way** (crossLaneWay): two legs - an A* over the Bay's lane water from the Bay port's roadstead to the
  first mouth it reaches, leaning to the far roadstead (so the mouth that leaves the least sea past it), no longer than
  CROSS_BAY_PATH_PX (400), straightened over the world's lane water; then beyondLaneWay's, at the picture's scale, from the
  mouth's pixel out to the far roadstead. On the freeware's data every leg is on the lane water and off the lakes, the six
  175 to 378 km, 133 ms the six, each kept once; the mouths and the seaward water are worked once a session (about half a
  second on the freeware's coasts) on the first ask of the world's lanes with a picture standing.
- **One book** (`createWorldLanes`): `cross()` the crossing lanes; `all()` the Bay's, then the ones past it, then the
  crossing - so the feed of packets about the player, the living world's berths and sailors and the passages read them. A
  player is near one within the ellipse of its longest way (CROSS_LANE_PATH_PX = CROSS_BAY_PATH_PX + MOUTH_RUN_PX +
  BEYOND_LANE_PATH_PX). Made again as the world's ports or the picture move; none without a picture (no mouth is known). A
  crossing lane's packets are named by her home port's region, as any packet's (`lane.a`, the Bay port).
- **The sea's trade past the Bay** (`scenes/townEconHost.js` lanesAt, over `worldLanes.all()`): a port's lanes are counted
  off the world's lanes and counted again when they move (once a session before - and the lanes past the Bay are made again
  as the ports move). A Bay port counts the Bay's alone - a lane across the edge is no Bay port's, so the Bay's economies,
  their Prosperity, counters and exchange prices, stay every client's whatever land it stands - and a port past the Bay
  counts every lane it runs, past the Bay and across. The Watch's ticks that vouch a dealing already stood past the Bay
  (WW7-5's `watchPixelOk`).
- **What the crowns, the serpent and SEA_PACE_X mean for "ships everywhere"** (recorded):
  - **The crowns** keep no ship to the Bay. A navy ship past the Bay sails there (the director's ring, the packets' LANE_NAVY
    share), flying the nearest Bay crown's colours, and a crime at sea there is charged as on the Bay: the crowns'
    allegiance and law (`systems/naval/navalShips.js` CROWNS, the wire's `n`, the save's crowns) - a different system;
    seven provinces' navies are the owner's call (WW-R).
  - **The serpent** (WW4) is a monster, no ship; the owner's call on its lanes is taken - *"Fucking do it"*: its site is
    rolled over the world's lanes (WW7-12, below).
  - **SEA_PACE_X** (3) is a passenger's pace (LW5b: three times a walker's, by night as by day), no ship's - a packet sails at
    her class's cruise on the shared clock - so it keeps no ship to the Bay. What kept passages past the Bay rare was their
    length against the travellers' cycles (CYCLE_DAYS: a merchant's seven days, a pilgrim's twenty) - measured on the
    freeware's lanes at the calendar's pace, of the ways past the Bay (37 to 633 km) 2 fit a merchant's cycle or an
    adventurer's, 11 a pilgrim's, 1 a courier's or a pedlar's, and of the six crossing lanes (175 to 378 km) the two to
    Hegathe a pilgrim's. The owner's call is taken - *"Make them longer"*: a far lane's passage takes the cycles it needs
    (WW7-11, below).
- **No relay change**: nothing of the lanes, the passages or the counts crosses the wire; neither Worker bundles a module
  this slice moved.

### Pins and mutants (WW7-9, WW7-10)

`test/world/worldWide/ww7_cross.test.js` (13, one with ARENA2): the roads past the Bay's word (the build, the Bay's box,
before a build, the grids and their aprons, told, a build begun again, the cache asked and nothing pending) and a box
across the edge waiting on its land past the Bay alone; the index across the edge (no land past the Bay, to the byte;
unlaid none; laid, both sides; a landing asks the squares again and moves no generation); the way book across (the lower
id first, the network's wait, its own book, the build); the window planner across (the Bay's road and its join, its track,
its water, a pair past the Bay off the Bay, the land's word, the tiles let go, another network); the trips' world (the box,
the sides, the district, a region's word, a pair across, the land off); the readers that wait; the mouths and the seaward
water; the crossing lanes and their ways; the book; a passage across; the sea's trade; with ARENA2 the freeware's six and
their passages' fit. Mutants `tools/mutants/ww7_cross.json` (78, all dead).

PINS MOVED (WW7-9): `ww7_people.test.js` (a square of the Bay holds the towns past the edge once laid, a square past it
the Bay's; a pair over the edge across; the word the roads' host's own), `lw3_roads.test.js` and `ww7_places.test.js` (the
table made once - `groundOf`); (WW7-10) `ww3_sea.test.js`, `townecon.test.js`, `townecon_sea.test.js` (the world's lanes,
counted once while they stand). Mutant records re-aimed by content: `audittesa2p.json` (P7-places-unfiltered - each side's
bins; P7-lanes-from-past-the-bay - a lane to its own side or a crossing's), `ww1.json` (WW1-index-stale), `ww3.json`
(WW3-the-book-without-the-beyond), `ww7_people.json` (nine) - all dead. Retired with the code they mutated:
`ww7_people.json` WW7-7-epoch-the-pending-unread and WW7-7-epoch-the-layer-unread (the whole build's word is gone; the
roads' host's `landedIn` holds its law - `ww7_cross.json`'s WW7-9-host records), and `townecon4.json`
TOWNECON4-host-lanes-cached-empty (its guard is gone: the counts follow the lanes' own identity, so an answer before they
stand counts none and they are counted again once they do - WW7-10-trade's records hold it).

### WW7-11 - the long passages, and a capital one town (BUILT, 2026-10-26)

The owner, on passages past the Bay being rare (*"Faster ships or longer trips would fix it"*): *"Make them longer"*. A
trip's cycle grows with its voyage: a FAR lane's passage takes as many of its traveller's cycles as it needs, and the
Bay's own lanes keep a cycle a passage.

- **Far** (`scenes/livingWorld/livingLanes.js` from): a lane past the Bay or across its edge says it is far (`far`); a Bay
  lane's entry is the shape it always was.
- **The block** (`systems/livingWorld/trips.js` voyageBlock): where the land past the Bay stands (the trips' world's
  `longPassages` - `scenes/livingWorld/livingTrips.js`, its roads' host present), a port's sea-going traveller's cycles are
  dealt into blocks of as many cycles as the longest passage needs: SEA_VOYAGE_DAYS (74 - the longest way a lane of the
  world is let have, a crossing lane's CROSS_LANE_PATH_PX of 996 km, out and back at SEA_PACE_X with the longest stay and
  the turn-round) over its cycle at the clock's pace - a merchant's or an adventurer's 11 cycles, a pilgrim's 4, a
  courier's 15, a pedlar's 13. Each place's blocks begin at a cycle its own seed picks. Anywhere else, and with the land
  off, every cycle is its own block. A lane run past its cap (AUDIT SEA PATHS C1) is longer than any block: `seaTrip`
  passes it for a shorter, and only its packets sail it.
- **The passage** (seaTrip): a far lane's takes the whole cycles its span needs (`sea.cycles`), set out inside its own cycle
  (its offset over the cycles' room less its span, under a cycle's) and home inside its last; one that does not fit its
  ROOM is passed over for the next shorter lane, as a lane too long for a cycle always was. A far lane that fits a cycle
  sails the passage it always did, to the byte.
- **The room** (voyageRoom): one cycle, but at a block's first the block's - short of any cycle the lives take the traveller,
  or one who walks with them (its company's places, a merchant's contract sellswords), on: that death is met on that
  cycle's own trip (LW4: a fated death is on the road), never at sea on another's. A holder the lives take at the block's
  first sails no longer passage than ever.
- **The cycles at sea** (voyageOver): a cycle its block's long passage spends at sea makes no trip of its own - the passage
  read through the trips' book (memoTrip), so the passage and the cycles it spans are one reading; a cycle whose block's
  passage is still being asked waits, as a way does; a block whose first rolled no sea (its sea dice - seaRolled) asks
  nothing of it.
- **Every day it is under way** (townTrips, cyclesAbout): a day's trips are its cycle's, the one before's and the first
  cycle's of the block either lies in where its sea dice came up - so the passage is the town's on every day of it, once,
  and its party the far port's visitors through the stay.
- **A long passage is its own** (formCaravans' trainOf): none joins it, it joins none - a joiner walks its train's
  timeline, and on a passage of more cycles its own would set out again from aboard.
- **The fit** (ARENA2, the freeware's 25 far lanes - 21 past the Bay, 6 across, 37 to 633 km): every one fits a passage of
  every sailing kind at a block's first cycle, the longest stay and the latest tide - merchant, adventurer, pilgrim,
  courier and pedlar 25 of 25 each. A cycle alone fits a merchant 1, an adventurer 2, a pilgrim 13, a courier 1, a pedlar 1.
- **The Bay as it was**: with the land off the trips' world has no `longPassages` - every block a cycle, every passage a
  cycle's - and a port with no far lane sails the trips it always did with the land on, to the byte (pinned over sixty
  days of the synthetic sea).
- **A capital is one town** (the coordinator at IC-GRAND's merge: the Imperial City's 625 slices are places - *"keep your near
  lists and wake bounded over them"*): `livingIndex.js` capitalStreet - a capital's slice but its centre (`capitalPlaceId`'s
  ordinal 0: the capital's own name, map id and port) is one of its streets. No square past the Bay, no area's towns and no
  roads' place names a street, so a town near the Imperial City has one town more near it, never 625, and a traveller bound
  for the city walks to its centre; a street sends no traveller (`livingTrips.js` rosterOf). A street's own record stands for
  a reader on it (`townAt`). The wake asks a place's box (LIVING_WAKE_PX), whatever it holds: unmoved.
- **Online**: nothing crosses the wire; every client standing the land past the Bay deals the same blocks and rooms off the
  same seeds, lanes and lives. Departure from Daggerfall Unity: DFU has no living world's traffic at all (LW0).

### WW7-12 - the serpent on the world's lanes (BUILT, 2026-10-26)

The owner, on the sea serpent kept to the Bay's lanes because moving it moves the relay's law: *"Fucking do it"*. Its site
is rolled over every lane of the world - the Bay's, the ones past it and the crossing lanes - as it was over the Bay's.

- **The roll** (`systems/serpent/serpentSite.js` worldSerpentSite): a game standing the world's lanes whole
  (`scenes/naval/worldLanes.js` whole - the Bay's directory, the land past the Bay and its picture: every lane past the Bay
  and across its edge is the picture's, the same list in the same order on every such game) rolls the day's site over
  `all()` by findSerpentSite's own law, its open sea the world's lane water (`open`). On the freeware's world (ARENA2) 436
  lanes, 409 the Bay's: over sixty serpent days its waters lay 48 times on the Bay's lanes, 8 past the Bay and 4 across its
  edge, 183 ms the sixty.
- **The relay and every game agreeing.** The relay holds no map (AUDIT SERPENT S1): the site is the games' word, as it
  always was - each online game says the site it found (`serpent` `site`, once a socket and day) and the hub folds the
  words (`foldGateSite`, one an account a day, agreed at GATE_SITE_AGREE). A game without the land past the Bay rolled the
  Bay's site itself before, the one every game rolled; the site is the world's lanes' now, which it cannot roll. So THE HUB
  TELLS every game online the site the accounts agree on - `serpent` `at` (`net/serpent/serpentHerald.js` serpentAtWord;
  `server/src/index.js` _serpentAtTell as an account's word moves the agreement, _serpentAtTo at each hello while its day
  holds; `net/wire.js` the kind: the day, the site's native point to the whole unit, the port's name by the `site` word's
  law), the session hands it on from the hub alone (`net/online.js`), the link keeps it by its day
  (`net/serpent/serpentLink.js` toldAt) - and a game without the world's lanes whole rises its serpent there (siteOfWord:
  its pixel, its ring, the port it lies off; no province, no lane), never at one of its own; with no agreement yet, none
  (its omen asks again, SITE_RETRY_MS). A site the hub told is never said back as this game's (`told`). The fight is the
  cell's, one a site (the `in`'s site, bounded by the world's grid - POSE_BOUND).
- **Recorded**: a game standing the land past the Bay whose picture is still coming waits for it or the hub's word, whichever
  first - never the Bay's lanes alone, which would name another site. The Bay's serpent moved for every game: its lane is
  rolled over 436 lanes where it was over 409. A serpent a sea theatre (WW4's whole) stays planned.
- **The relay's law moved** (no RELAY_VERSION bump: world260 is undeployed) - its row re-hashed in place
  (`test/net/relayversion.test.js`). The account service bundles none of it (`test/server/accountdeploy.test.js`).
- **HOST-SPLIT**: the host hands the serpent's site the lanes' book whole (`bootWorld` 36,064 -> 36,061 logical lines, the
  ceiling at it - `bible/01-Overview/Host-Split.md`); the hub's word is two Room methods of their own.

### Pins and mutants (WW7-11, WW7-12)

`test/world/worldWide/ww7_longer.test.js` (12, one with ARENA2): the block (its days the longest way's, its cycles a job's at
the clock's pace, a place's own first, every cycle its own with the land off, at no port, for a job that never sails; the
cycles a day reads, the block before's at a block's first); a far lane's passage (the cycles, inside its own and its last,
its room, the Bay's never grown, a cycle's to the byte, the shorter); the room (the block's first, its fate, a cycle the
lives take, a sellsword's, a rider's); the cycles at sea (no trip, home again, the wait, the empty place, no sea no ask);
every day under way (once, the visitors, one trip at a time); a long passage its own; the Bay's passages as they were and
the far word; a capital one town; the hub's word (`at`'s law, serpentAtWord); the hub telling (two agreeing, a forged word,
a hello, the agreement moved, a day gone); the client keeping it; the site over the world's lanes (every kind of lane, its
own roll, the told site, none, the lanes whole); with ARENA2 the fit and the serpent's sixty days. Mutants
`tools/mutants/ww7_longer.json` (67, all dead).

PINS MOVED (WW7-11): `ww7_places.test.js` (a capital's streets send none); (WW7-12) `serpent1_relay.test.js` (the out kinds, and `at`), `serpent2_herald.test.js` (a told site never said
back), `serpent1_auditclient.test.js` (the hub's `at` through the session), `ww3_sea.test.js` (the world's lanes to the
serpent), `hostceiling.test.js` (bootWorld's ceiling lowered), `relayversion.test.js` (world260 re-hashed in place). Mutant
records re-aimed by content: `audittesa2p.json` (P7-places-unfiltered, P7-lanes-from-past-the-bay), `lw3.json`
(LW3-train-of-the-window), `lw5b.json` (LW5b-fit), `serpent1_audit.json` (AUDIT-SERPENT-S5-online-rcpt), `serpent2.json`
(SERPENT2-scene-says-nothing), `ww7_people.json` (WW7-7-roads-places-unfiltered), `hostsplit.json`
(HOST-SPLIT-a-ceiling-under-its-host) - all dead.

## TESA x AUDIT TESA II (2026-10-25, the merge)

The owner: *"claude/tamriel-branch-audit-mdcq08 Also this branch"* - AUDIT TESA II (lanes C, P, M, Z, K) and its merge of
main through ASK-LONGER, into #1184 after START1-3 (#1216). What each side kept:
- **The registry, two halves.** The capitals and Arena's places are the audit's live list (P7, `world/pastBayRows.js`
  through `registerLive`), each row carrying WW7-5's `location`. The countryside and the lairs stay WW7's pixel providers
  (`registerPixels`): the living world, the seats and the town books past the Bay read them, where the audit left them
  unregistered for a district's walk through the roll (276 ms on this thread). The cost of that walk is the providers' to
  measure; the trade is recorded here.
- **The map.** REGION-LINES 2 stands: the zones' borders stay withdrawn (the owner: *"Those are just random lines"*), and
  with them M2's half that waited on their landing and M13 (their ends on the coast) - the provinces' ends snap as they
  did. M7's buckets carry REGION-LINES' one glyph a kind (`ARENA_KIND_TYPES`: a city-state the city, a town the hamlet, a
  village the village), the zone map's names the same kinds. M14's hover answers past the seam with WW7-6's seat card off
  the city the press would take, M8's ore card where no seat stands.
- **The Imperial City at seven pixels**: `03-World/Town-Shapes.md` TS5's merge note - the lake 2720 m, the bridge to its
  landing on the city's own block, each slice's markers worked alone, a slice's rect by its sides.
- **A strait at a corner** (`world/tamriel/tamrielGround.js` straitAt, STRAIT_PX 1.5): the trace draws a channel on the
  diagonal as sea pixels meeting at their corners. While the shore stood at the beach line those corners' land read as
  water; R1 lifted it over, and a boat never sails through a corner of the land, so every such channel closed - Ebonheart's
  water round Vvardenfell was cut off from the sea, and START's voyage home from it with it (`start2_provinces.test.js`,
  `auditstarts.test.js` V4/V7 with ARENA2). The land within 1.5 Bay pixels of such a corner is the sea's; every other land
  pixel stays over the beach line (`tamrielrelief.test.js` with ARENA2).
- **Versions**: relay world260 (re-hashed in place, `1d0531dd...`: DOMAIN2's guild arm and WW7-3 to WW7-5 composed with the
  audit's), `GUILD_INSTANCE_RELAY_MIN` 260; account acct189; DOMAINS' and WW7-5's migrations 0174-0177 (0167-0170 on this
  branch, past main's 0167-0173). Neither deployed. `bootWorld`'s ceiling 36,116 (TESA's 45 and the audit's 40 lines out).

## BAY-LEFT-SEA - the sea, the ports, the market and the seats past the Bay (BUILT, 2026-10-27)

AUDIT BAY-LEFT (2026-10-26, "no system left behind in the Bay"; the owner after it: *"Every single thing here needs to be
addressed. No exceptions."*) found six systems of the sea, the ports, the market and the seats that worked on the Bay and
stood missing or wrong past it. Each is fixed where its system lives, and its record is there; the Bay's answer to every
one is pinned unchanged.

| Audit item | What stood past the Bay | What it is now | Record |
|---|---|---|---|
| 30, C5 | No Harbormaster tab at any of the 29 ports (`crown: null`): no board, contract, letter of marque or Admiralty carrack | A port keeps the nearest Bay crown's office (the owner's call taken) - Wayrest's at 18, Sentinel's at 10, Daggerfall's at Northpoint | `03-World/Captains-Sea.md` BAY-LEFT-SEA |
| 31, C6 | Solitude, Alinor, Torval and the Imperial City's Waterfront stood no shipyard, crew hall or lighthouse and sold no ship (their byte 0) | Each harbour slice is a port to its own byte where the registry calls it one; a capital's landmarks measured by their footprint - all four stand all four places | `03-World/Arena-Provinces.md` BAY-LEFT-SEA |
| 7, B2 = E1 | No buy, fill or bid between a province's board and any other region (`market-no-road`, both ways) | A province's hub its crown seat's pixel, else its largest listed city's, made again as the seats and the places move | `06-Systems/Professions-Arc.md` 56 |
| 20, B8 = E3 | A seat could proclaim the Bounty, and it never paid (World of Daggerfall's camps are the Bay's) | It pays on its bailiwick's dens - an outlaws' hideout routed, a lair whose foe falls (the owner's call taken) | `11-Multiplayer/Seats-Arc.md` BAY-LEFT-SEA |
| 23, E4 | Staff `/town audit` listed a province's 400 farthest countryside hamlets, never a capital | A province's capitals first, then its places, then its countryside, 400 a page | `06-Systems/Town-Economy-Arc.md` 10 |
| 22, D4 | Weather born at sea read the nearest Bay edge's climate (the Sea of Ghosts: 142 of a winter's 400 words snow) | The sea's own (62 snow, 93 fog) | `07-Rendering/Weather-Arc.md` BAY-LEFT-SEA |

**The owner's calls, taken** (*"Every single thing here needs to be addressed. No exceptions."*, 2026-10-26): a harbourmaster
past the Bay keeps the nearest Bay crown's board; the Bounty edict past the Bay pays on hideouts and lairs (it is offered,
never withheld).

**The four hosts** (Home.md). `scenes/world.js` WIRED: the market's pieces and hubs out of `bootWorld` to
`scenes/marketPiecesHost.js` (HOST-SPLIT, `01-Overview/Host-Split.md` BAY-LEFT-SEA) and handed the seats and the places;
the crowns' capitals read above the world's ports and handed them as `crownAt`; a hideout's rout and a lair's fallen foe
handed the seats' edicts; a capital's landmark measured by its footprint at the town's places; the ship sale's port test
the place's own byte. `scenes/worldModes.js` FLAGGED, unchanged: the bank's ship sale already reads the location's byte
(DaggerfallBankingWindow.cs:460's one read). `scenes/exterior.js` FLAGGED: the Bay's fixed city, no port or seat past the
Bay. `scenes/dungeonContext.js` FLAGGED, unchanged: a lair's foe reaches the Bounty through the renown kill handler the world
host sets (`net/renownTracker.js`). `bootWorld` 35,799 -> 35,700 (`test/scenes/hostceiling.test.js`).

**The wire and the service.** No relay change. The account service: `server-account/src/townEcon.js` (E4) and
`server-account/src/seatHolding.js` (B8 = E3), folded into the undeployed acct196 (re-hashed at integration); the Worker
now bundles `src/world/capitalLane.js` (`.github/workflows/account-deploy.yml`'s path filter). No migration.

**Pins and mutants.** `test/world/worldWide/bayleftsea_market.test.js`, `bayleftsea_harbour.test.js`,
`bayleftsea_capitals.test.js`, `test/net/bayleftsea_bounty.test.js`, `test/server/bayleftsea_townaudit.test.js`,
`test/systems/weather/bayleftsea_seaweather.test.js` - their freeware halves with `ARENA2_PATH`. `tools/mutants/bayleftsea.json`,
81 records, all dead; the older records the slice moved re-aimed by content (each record's own `note`) and all dead.

## WORLD-LANES - the world's lanes of map ids: the spawned dungeons and the Ocean Holes' pits past the Bay (BUILT, 2026-10-27)

The audit NO SYSTEM LEFT BEHIND IN THE BAY (2026-10-26) found two of the port's own places held to the Bay by their ids
alone: a spawned dungeon's (item 25, A3 - and item 1, A1: the id threw for a pixel past the Bay and the pixel build that
asked it failed for good, a hole in the ground) and an Ocean Hole's drowned dungeon's (item 35). Each was DFU's MapId law -
the low 20 bits the map pixel's `y * 1000 + x`, unique on the Bay's 1000 x 500 and nowhere else (decision 2 above). The
owner's call taken ("Every single thing here needs to be addressed. No exceptions.", 2026-10-26): the spawns past the Bay
stand in a world id lane, and the pits' abyss likewise.

### The lanes (`world/worldWide/worldLanes.js`)

A place the port makes on a pixel of its own past the Bay is named in a LANE of the world's: a run of DFU's 12-bit lanes
over the world pixel's key (`worldPixelKey`, under 2^28) - its low 19 bits under the flag 0x80000 in the id's low 20, its
high 9 the lane's step in the high 12 (`worldLaneMapId`, `worldLaneOf`, `worldLanePixel`). Two runs of 512:
- **the spawns', `SPAWN_WORLD_LANE` 0x380 to 0x57f** - under 0x60000000, so no reader that knows the abyss by its range
  meets a spawn;
- **the abyss's, `ABYSS_WORLD_LANE` 0x600 to 0x7ff** - the Bay's abyss's own range (GetAbyssMapId's 0x600 over a Bay pixel
  id; only the flag tells the two apart), the Abyss Dungeons' first salt (2049, 0x801) past it.

Every such id is never a Bay pixel id's (its low 20 bits 500,000 and up - TESA II P6's law: the discovered places file it by
its whole id, Immersive Travel's docks and capitals meet none of their pixel ids in it), none of another lane's (MAPS.BSA's,
the Bay's spawns', the Abyss Dungeons', Arena's, the isles', the countryside's, the lairs', the capitals', the zone halls'),
unique per world pixel, and an unsigned 32-bit room the relay's room law already admits (`net/wire.js` WORLD_ROOM).

### SPAWN-WORLD - the spawned dungeons and their Elite tier past the Bay

`06-Systems/Systems-Arc.md` SPAWN-WORLD is the record. Online, the land past the Bay stands the world roll's spawns as the
Bay does - the same roll, density, Elite tier, gates and clocks - under the spawn lane (`world/spawnedDungeons.js`
spawnedMapId), never on a place (a capital, an Arena place, the countryside's or a lair stands first), never on TESA's
roads (`pathFreePixel` past the Bay reads `world/arenaRoads.js`), their clocks their cell's (the `dg` row past the Bay,
world270 - `OW_WORLD_RELAY_MIN`). The probe over the freeware: 3,000 dry empty pixels past the Bay stood 0 spawns before
(894 of the asks threw) and 894 now (29.8%, 23.3% of them Elite), the Bay's 869 (29.0%, 25.1%) unchanged.

### PITS-WORLD - the Ocean Holes' pits past the Bay

`03-World/Ocean-Holes.md` PITS-WORLD is the record. `world/oceanHoles.js` getAbyssMapId names a pit past the Bay's abyss in
the abyss lane (the Bay's the mod's own, to the bit), `isAbyssMapId` knows both, and the hold (`pitPixelOk`) is the world's
grid: the continent's sea (TAMRIEL-DEEP) and the Eltheric Ocean's (ETHER-DEEP) open pits as the Bay's. Online the open zone
(Cyrodiil's mask, its enclosed water among it) stands none. Probe: of 152 pit pixels the hash picks in the Topal Bay and the
Sea of Ghosts, 0 stood before and 152 now, 152 abyss ids.

### The open zone (the owner's call taken)

"Site-bound world events stand nowhere in the open PvP zone (Cyrodiil)" (2026-10-26). Neither a spawn nor a pit is a world
event, but each is a dungeon's door, and the zone stands its tier's halls and no other dungeon (PVPDUNGEONS): the spawns
already kept out of it (`spawnedDungeonAt`'s first gate, and now the far reads' too - `spawnGroundPlace.js` spawnAt), the
pits now kept out of it (`scenes/oceanHolesHost.js` openZoneAtNow).

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wires them (the spawn's stand and ground through `scenes/spawnStandHost.js` and
`scenes/spawnGroundHost.js`, the boards' ground); `scenes/dungeonContext.js` reads the abyss by `isAbyssMapId` (a lair's
home, the tutorial's page - an in-place edit of two lines); `scenes/worldModes.js` - nothing (a spawned dungeon past the
Bay is entered and left as the Bay's, by its id); `scenes/exterior.js` - FLAGGED: the Bay's fixed scene, no spawn and no pit
(the recorded exclusion).

### The relay (folded into world270, not yet deployed) - and no account change

`net/wire.js` owWireRow reads a world pixel's row (`worldPixelOk`), so the cell keeps a spawn past the Bay's clocks; a client
says such a row only to a relay that reads it (`relaySupportsOwWorld`, `OW_WORLD_RELAY_MIN` 270 - an older one refuses the
whole word and closes the socket). Deploy the relay before clients. Nothing else of the relay moves: a spawn's or an abyss's
room is a world room as before. The relay's law hash (`test/net/relayversion.test.js`, SLAM8) is re-hashed where world270
is folded together, not in this package: until then that test fails on the moved row law, as it should.

**The account Worker's graph (AUDIT BAY-LEFT, its packages merged, 2026-10-27).** The living world's seed
(`systems/livingWorld/seed.js`, which the account Worker bundles through `lostSpoils.js`, `itemLaw.js` and `keepsake.js`)
took `hash32` from `world/spawnedDungeons.js`, so SPAWN-WORLD's imports there - `arenaRoads.js`, `worldLanes.js`,
`worldGrid.js`, `tamrielFrame.js`, and the traced map behind them (`tamrielLand.js`, `tamrielGeography.js`, `segment.js`) -
rode into the Worker's bundle outside `.github/workflows/account-deploy.yml`'s path filter (`test/server/accountdeploy.test.js`
ACC1-CI, `test/server/discord_setup.test.js` DISCORD-CODE). The seed takes the mix from its own leaf (`world/blockHash.js`,
which `spawnedDungeons.js` re-exports - the same function), so none of them is bundled and the filter is unchanged. Mutant
`tools/mutants/bayleft_merge.json` BAYLEFT-MERGE-the-seed-through-the-spawns (dead).

## HOVER-NAMES - the plaque's names past the Bay, probed (2026-10-28)

The owner: "NPCs past the bay dont show name on tooltip hover". Read through first. A walker past the Bay is named on
their own people's bank (`census.js` `residentName`, `townPopulation.js` RandomiseNPC, a street StaticNPC on the
province's bank - `worldModes.js` `currentNameBank`). The plaque's person pick is the talk ray's (`townTalk.js`
`nearestPerson`) over the seats the street draws, and its band names the one it picked (`mobilePersonName`).

- **Probed** (`tools/hoverNamesProbe.mjs`, the freeware's world, headless). Each walker looked at from two metres, the
  plaque read: 8 of 8 named at Arkbridge on the Bay, 8 of 8 at Nimean (Cyrodiil), 8 of 8 at Blacklight (an Arena city of
  Morrowind, 100 walking near) and 8 of 8 in Solitude; no plaque empty, no page error. Its standing people too, read
  once by hand: Blacklight's 13 and Solitude's 16, every one named. Not reproduced.
- **What this machine cannot reach.** The Morrowind lane's bodies (the player's own data: `npcBodies.js` `npcBodiesOn`)
  and online play, where the professions' nodes stand (`gatherHost.js` `hoverHit` puts a node with an act ready over the
  look's winner). The probe runs as it is where either is attached.
- **Found on the way, not changed.** `getNameBankOfRegion` knows the 71 regions alone: an area past the Bay (the world's
  grid, 71 and up) mints an empty name. No caller hands it one today (`nameBankOfArea` is the area's door). And
  Solitude stood four street people named alike: DFU's seed is the record's place in its block against the location,
  so a block repeated repeats its people.

## SKYRIM-AURORA - an aurora in Skyrim's sky alone (recorded, 2026-10-29)

The aurora (`07-Rendering/Skyrim-Aurora.md`) is drawn where the player stands under Skyrim's sky: Skyrim's theatre,
or at sea past the Bay the nearest land's within ten picture units (the Sea of Ghosts). Nowhere else, the Bay included.
The owner asked for Skyrim's sky ("let's develop an aurora for the skyrim sky then"), and Skyrim is the province the
lore gives one. Its latitude is read on the land in use, the trace once it lands. Its pins hold Skyrim and its sea
beside the Bay, Morrowind, High Rock, Cyrodiil, High Rock's north sea and the far ocean.

## FRONTS - two provinces a game day (BUILT, 2026-10-29; AUDIT FRONTS the same day)

The owner, 2026-10-29: *"Currently with the expansion of tamriel, events are way overdone with their spawning. I like
players planning routes to farm world events, but we need to reduce or design around this"*. Asked, the owner chose
rotating fronts: the Bay always runs, and each game day two provinces are stirred on a cycle known ahead. Read cold the
same day: `01-Overview/audits/Audit-Fronts.md`.

**What stood.** WW2, WW5 and WW6 gave every province its own lane at the Bay's own pace. Online, a game day (two real
hours) opened 9 gates and rolled about 147 raids (the Bay's 22, the provinces' 125). A festival night dropped 27 stars,
9 at once, and 9 Hollows stood, since a Hollow lasts two real days. There was an event in every direction, so a route
was no choice.

### The law (`net/frontLaw.js`)

`frontLanes(day)` is the two provinces (lanes 1 to 8) stirred on a game day of the shared clock. A cycle is four days,
and each province stirs once in it, in an order the cycle's number shuffles (`FRONT_SALT`). A province that closed one
cycle is swapped out of the next one's first day, so none stirs two days running. A province waits two to seven days
(four to fourteen real hours) between turns, and its turn moves round the real clock. `frontStands(day, lane)` is true
for every lane outside the fronts (the Bay's, the open zone's) and for a province on its turn. It imports nothing.

### What reads it

- **Gates** (`gateLaw.js isGateDay`): a province's gate stands when the day it opens in (`gateFrontDay`) is its turn.
  Every reader of a gate follows: the clock's gate (`gateAt` walks to the next that stands), the relay's door
  (`gateAdmits`, `gateHolds`), the rite, the herald's omen and the site word. Hammerfell's gate opens at 00:48, so its
  omen (21:48) and rise come on the game day before its turn.
- **Stars** (`starfallLaw.js starInWindow`): a province's star lands on its turn. `starOk` stays the shape alone, so a
  receipt minted before reads as it did. Every other night's last star lands on a day's edge, so a turn can hold one or
  two of a night's three.
- **Raids** (`raidLaw.js raidLaneStands`): the relay's slots (`raidDaySlots`) and the client's roll (`raidsForLane`)
  for a province on its turn alone, the old law's on it. Online alone: offline a save's days are its own, and its
  province raids keep the mod's pace (`fronted`, AUDIT FRONTS B6).
- **Hollows** (`sdLaw.js sdDue`, `sdRise`): a province's rise waits for its turn and, while `SD_FRONT_HOLLOWS` (2) stand
  past the Bay, for one to end. The hub counts them (`_sdHeldPast`), beats the provinces that waited longest first
  (`sdBeatOrder`) and arms a turn that ended while it asked the census. A Hollow keeps its two real days, so one risen
  before the update stands to its end.

The Bay's lane is the law before in each, pinned. A game day now holds 3 gates, about 53 raids (22, and 29 to 33), 9
stars a festival night and at most 3 Hollows. A turn does not promise a Hollow: the cap is the usual state.

### Planning a route

The Timers window's World group shows today's fronts to the day's end and the next two days'
(`systems/frontWords.js frontTimerRows`, read where the relay keeps the lanes past the Bay - `gateLanes.js lanesOk`). They
are a schedule (`sched`), never counted as under way. A province's "An Abyss Dungeon rises" row says not before its turn
and a free place (`sdRiseNotBefore`), as the Hollow's Discord cards do. A place past the Bay says on the travel map's
card when gates, raids, stars and Abyss Dungeons start there (`frontCardLine`). Both are the enhanced skin's. The event
board is unchanged: a front is a schedule, not a place to go.

### What stays (recorded)

The Sky-Ketch's stations (a voyage a week each), the serpent (one in the world), staff events (staff's call) and every
event on the Bay. Cyrodiil's open zone stands no site-bound event, as before. A raid's or a star's lane is read off its
key, never its pixel (the relay holds no picture of the provinces), so a modified client can say a stirred province's
raid from another province's pixel - a hole before FRONTS, put to the owner (AUDIT FRONTS A3).

### The relay (world287 - world286 on its branch, renumbered past FB1029 GROUND at the merge of main) and the deploy

`net/frontLaw.js` joins the relay's bundle and the account service's (`account-deploy.yml`'s filter); the account
service reads no front. The site may deploy first, and on a merge it does: it sends nothing world287 alone reads, and
until the relay follows, the old hub raises Hollows in every province. Once world287 is up, a page older than the
update - a tab left open, a desktop copy not yet restarted - stands off-turn gates, stars and raids whose words the
relay drops; a gate, a star or a raid under way at the deploy off its province's turn is dropped the same way.

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired: the Timers' `fronts` and the held map's `fronts` (bootWorld's ceiling 35,315 to 35,318).
`scenes/exterior.js` FLAGGED - the fixed-city bench stands no event past the Bay. `scenes/worldModes.js` and
`scenes/dungeonContext.js` FLAGGED - they stand no world event; their pause face reads the host's Timers source.

### Pins and mutants

`test/net/fronts1_law.test.js` (11): the schedule for eight days and its laws over 40,000; who stands; the gates; the
stars over ten festival days; the raids against the old slots, and offline; the Hollows' turn, cap, bound and fair
order; the Timers' rows by name; the wiring. `test/ui/fronts1_card.test.js`: the card drawn. `tools/mutants/fronts.json`:
35, all dead. The WW2, WW5, WW6 and WW-GATES-EVERYWHERE pins moved to the provinces' turns (PIN MOVED: FRONTS). EG3's
Hollow realm re-recorded (146 to 144 frames): fewer province Hollows rise before it opens, so the seeded die stands
elsewhere; seeded afresh at the fight's first hello, main and FRONTS say the same 142 frames. FRONTS merged before CI
read it, so two pins moved after (PIN MOVED: FRONTS): EVENT-TIP's host pin takes the fronts' clock beside the gates,
and L10N3e's census counts `frontWords.js`'s name lookup.
