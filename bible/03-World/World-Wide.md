# World-Wide

The systems that give the world its life, running on the whole of Tamriel and not only the Iliac Bay: the living world,
Oblivion Gates, the sea, raids, stars and Hollows, gathering, courts and people. One grid keys every pixel; ten
theatres each run their own world events; areas group what regions grouped on the Bay; the provinces are regions of
their own. Online, world events past the Bay rotate two provinces a game day. The player meets it anywhere past the
Bay's edge, as the same life the Bay has.

## How it works

- **The grid** (`src/world/worldWide/worldGrid.js`). `worldPixelKey` is a whole number for every pixel the wire carries
  (`inWorldGrid`, `WORLD_PIXEL_SPAN`); MapsFile's `y * 1000 + x` stays only as a Bay MapId's low bits.
- **Theatres** (`theatreAt`, `THEATRE_COUNT` 10). The Iliac Bay is theatre 0; each of the nine provinces past the Bay
  is a theatre. A theatre is where one instance of a world event lives.
- **Areas** (`areaAt`). On the Bay an area is the region itself (0..61), so every Bay key is unchanged. Past the Bay it
  is a province's district, a square of `DISTRICT_PX` (96) pixels, about a Bay region's size.
- **Regions** (`src/formats/mapsTables.js`). Each province past the Bay is a region after the Bay's 62 (62..70), with
  its politic map, people, law, banks and regional channel. Each has its own court, ruler and people
  (`src/systems/faction/provinceFactions.js`) and its own races in the street, the living world, the keepers, the foes
  and the watch (`src/characters/provinceFolk.js`).
- **Places** (`src/world/worldWide/worldPlaces.js`). A registry of every place by world pixel key and map id, with its
  region, area and theatre; providers register their places (the Bay's own, Arena's, the countryside's, the capitals').
  The living world's towns and dungeons read it (`src/scenes/livingWorld/livingIndex.js`), as do the gates' site scan,
  the raids, the ports and the events.
- **Map id lanes** (`src/world/worldWide/worldLanes.js`). Spawned dungeons and their Elite tier, and Ocean Holes' abysses
  past the Bay, take ids in lanes of their own, never a Bay id.
- **Gates** (`src/net/gate/gateLaw.js`, `src/systems/gate/theatreGateSite.js`, `src/scenes/gate/gateLanes.js`). One
  Oblivion Gate a game day in each theatre that holds ground for one, lane = theatre; each gate's omen, ring, plaque,
  chat, timers and board are its own.
- **The sea** (`src/world/worldWide/worldPorts.js`, `src/scenes/naval/worldLanes.js`). Packet lanes over the registry's
  ports on the world's water; the raiders' and the director's sea world-wide; a harbourmaster at every port. On the Bay
  a lane's water is sea at a pixel's four corners by CLIMATE.PAK's own climate; past it, the picture's open sea. Every
  leg and every raider keeps to the kernel's own ground (`src/world/water/kernelSea.js`). A port with none in reach
  runs to its nearest that a way joins; a lane with no way under its cap is sought over the whole sea and runs at its
  own length. A lane sails at most 400 packets.
- **Gathering** (`src/net/nodeLaw.js`, `src/net/provinceNodes.js`). Each province's ground has its own abundant
  resources with others sprinkled in.
- **Cyrodiil the open zone** (`src/systems/wild/cyrodiilZone.js`). Cyrodiil is the open PvP area with every abundant
  resource, in place of the Wrothgarian Mountains' open zone.
- **Hollows, stars, fissures and raids.** An Abyss dungeon slot, a Starfall coven night and the season's fissures in
  each theatre (`src/scenes/eventTheatres.js`); raids by area past the Bay (`Raiding-Parties.md`).
- **Fronts** (`src/net/frontLaw.js`). Online, the Bay's events run every day; past it only the day's two provinces
  (`frontLanes`, `FRONT_PER_DAY`) start a gate, raids, stars or a Hollow, on a four-day cycle every machine knows ahead.
  `frontStands` is true for the Bay, the open zone and a province on its turn.

## Rules

- Expand every system out into the entire world, not centralised on Daggerfall; world events may happen more than once
  at a time; no band aids (the owner).
- TAMRIEL-WIDE (CLAUDE.md, `01-Overview/Port-Doctrine.md`): key a pixel by `worldPixelKey`, bound it by `worldPixelOk`,
  find a place in `worldPlaces`, read regions 0..70 and areas; never MapsFile's `y * 1000 + x`, a loop over MAPS.BSA's
  regions or a 0..999 bound, except as the Bay's own data behind `inBay` with a `BAY-OWN:` comment.
  `test/tooling/tamrielwide.test.js` holds the tree to `tools/tamrielWideBaseline.json`, which only goes down.
- The Bay is one theatre and is not split; its events are the ones its players know.
- The provinces are separate regions (the owner). Each province has its court and its people; every gap past the Bay
  is addressed, no exceptions (the owner). Each province has its accurate races (the owner).
- Past the Bay, two provinces a game day, rotating, so world events are not overdone and players can plan routes (the
  owner).
- No site-bound world event stands in Cyrodiil's open zone (the owner).
- A slice that touches the wire bumps the relay and names its deploy order; the Bay's answer to every moved law is
  pinned to the byte.

## Daggerfall Unity

DFU's world is the Bay's 1000 x 500 map and its 62 regions. Everything past the Bay is the port's own departure
(WORLD-WIDE).

## Code and tests

- `src/world/worldWide/` - grid, places, lanes, ports
- `src/net/frontLaw.js` - the fronts
- `test/world/worldWide/ww1_world.test.js` - grid, registry, areas
- `test/world/worldWide/ww2_gates.test.js`, `test/world/worldWide/ww_gates_everywhere.test.js` - gates
- `test/world/worldWide/ww3_sea.test.js`, `test/world/worldWide/wwr_regions.test.js`,
  `test/world/worldWide/provincecourts.test.js`
- `test/world/worldWide/wwc1_ground.test.js`, `test/world/worldWide/wwc2_zone.test.js` - ground and the open zone
- `test/world/worldWide/ww5_hollows.test.js`, `test/world/worldWide/ww5_stars.test.js`,
  `test/world/worldWide/ww6_raids.test.js`, `test/world/worldWide/ww7_people.test.js` - events and people
- `test/net/fronts1_law.test.js` - the fronts
- `test/tooling/tamrielwide.test.js` - the TAMRIEL-WIDE baseline

## Open

- A Sea Serpent for each sea theatre is planned; today one serpent's site is rolled over every lane of the world.
