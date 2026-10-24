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
| WW2 | The gates in every theatre: one Oblivion Gate a game day in each theatre that holds ground for one, lane = theatre, the Bay's lane 0 its own today; the site scan over the registry; the omen, ring, plaque, chat, timers and event board per gate; the relay's rooms, the receipts and the herald per lane | planned |
| WW3 | The sea, whole: the packet lanes over the registry's ports on the world's water; the raiders' and the director's sea world-wide; the port test's bounds | planned |
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
