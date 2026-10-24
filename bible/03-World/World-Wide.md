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
5. **An area is not a region.** The 62 regions are the wall the online game stands on - chat rooms, banks, the law and
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
| WW2 | The gates in every theatre: one Oblivion Gate a game day in each theatre that holds ground for one, lane = theatre, the Bay's lane 0 its own today; the site scan over the registry; the omen, ring, plaque, chat, timers and event board per gate; the relay's rooms, the receipts and the herald per lane | BUILT (below) |
| WW3 | The sea, whole: the packet lanes over the registry's ports on the world's water; the raiders' and the director's sea world-wide; the port test's bounds | BUILT (below) |
| WW4 | The serpent in every sea: a serpent lane for each sea theatre | planned |
| WW5 | The Hollows and the stars: an Abyss dungeon slot and a Starfall coven night in each theatre | planned |
| WW6 | The raids past the Bay: the raids' towns off the registry by area, the wire's world pixels | planned |
| WW7 | The roads' people past the Bay: the ways' ground past the Bay, TESA's roads in the ways, the town economy's world key | planned |

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
  its district once a generation (`inArea`).
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
  go (`livingMemoFresh`), as it is when the roads move.
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
- **The dry ground** keeps a pixel's kernel by the world's key (`world/dryGround.js`).

### What stays the region's (recorded)

The law: a crime on the road is charged to `maps.getRegionIndexAt`'s region, 0 past the Bay (`caravanHost.js` report,
`relations.js reportOk`'s 0..61), so a robbery's tale past the Bay is told where the law charges it - the owner's call
on the provinces as regions (decision 5). A temple's holy day is DFU's per-region table (`holidays.js`), and a place
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
for one, each with its own omen, ring, room, receipts and herald, the Bay's the gate it always was.

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
  not assumed - so a player can ride from one to the next.
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
`findTheatreGateSite` answers `findGateSite`'s shape: `region` null past the Bay, `area`, `theatre`, its place
"Town, Province". The Bay's lane keeps its own scan (its shape is the clearing's, Starfall's and the Abyss dungeon's).

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
  (`gatePixelOk`: the site word, the rite's word in and out); `GATE_LANES_RELAY_MIN` 254.
- The account service: a gate past the Bay is its own gate_kills row (its number) and credits no seat
  (`server-account/src/accounts.js` - no region stored; `seatInfluence.js` creditGate `'beyond-the-bay'`).

DEPLOY ORDER: the relay first (world254), then the account service (acct180), then the site. A client on an older
relay stands the Bay's lane alone.

### What stays the Bay's (recorded)

- **The seats.** A seat is a Bay region's (decision 5); a gate past the Bay credits none.
- **The clearing** (`world/gate/gateClearance.js`) is World of Daggerfall's rock kept off the gate - the mod's rock
  stands on the Bay alone, so the clearing reads the Bay's lane alone.
- **Starfall's covens and the Abyss dungeon** read the Bay's scan until WW5.

### THE FOUR HOSTS (Home.md)

`scenes/world.js` wired (the lanes, the theatres' scans, each lane's site to the hub, a seat's gate the Bay's lane's).
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
- A port past the Bay has no Bay region (-1) and no crown (`crown: null`): the Bay's three crowns' writ is the Bay's
  (decision 5 - the provinces as regions are the next slice, WW-R).

### The world's lanes (`scenes/naval/worldLanes.js`)

- **The Bay's lanes are the Bay's**: its ports (Travel Options' list off the map's directory, `bayLanePorts`), its water
  (the host's `laneOpen`, the Bay's map alone), made once - every packet in the water she sailed, and the serpent's site
  rolled over the same list in the same order (WW4 lanes the serpent).
- **The lanes past the Bay** run between the world's ports over THE WORLD'S LANE WATER (`worldLaneWater`): the Bay's own
  on the Bay, and past it the Ocean climate on water where the land past the Bay stands (the composed continent's
  readers - TAMRIEL2), never the Eltheric Ocean's box (its isles keep their own ports), a native point by its pixel
  FLOORED. Made again when the world's ports move. A lane past the Bay may cross the Bay's water; a Bay lane never
  leaves it.
- **One book**: `all()` the Bay's lanes and then the world's, each lane's way kept once (`way`) - the feed of packets
  about the player, the living world's sailors and crews ashore, and the passage by sea read it. SEA-TRADE's port lanes
  and the serpent read the Bay's (`bay()`): the Watch ticks are the Bay's until WW7.
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
is named by her home port's waters (`area` on the feed), another ship by the waters she is met in. The naval wire is
unchanged (its `region` -1 past the Bay: "the reader's own", as an older build's word reads - each reader names her by
its waters, the same waters for every player in her cell).

### What stays the Bay's (recorded)

- **The crowns.** A ship past the Bay flies the nearest Bay crown's colours and a crime at sea is charged as on the Bay
  until the provinces are regions (WW-R).
- **SEA-TRADE's Watch ticks** read the Bay's lanes (`net/watchReceipt.js watchPixelOk` is the Bay's - WW7).
- **The serpent** sails the Bay's lanes (WW4).
- **Deep Waters** (the sea floor's bake) is the Bay's - WOODS.WLD's own bathymetry; past the Bay a ship's draft is the
  streamed water's.

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

