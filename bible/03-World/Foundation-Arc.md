# Foundation

The data foundation taken on from DnfJeff's proposal "A Foundation for Scale": the world's places held entity-major
in an atlas, a residency clock that runs regional state from players' acts (prosperity first), property listings as
data, land edits as data, and the build's open-file cap. Players meet it indirectly: town prosperity, homes for sale,
and the land.

## How it works

- **The atlas** (`src/world/atlas/atlas.js`). A bundle is one place whole: its registry record (identity, region, area,
  theatre), exterior grid, dungeon plan, buildings' types, factions and qualities, and door records. Block names are
  interned once. Part kinds are a closed set of eight (`place`, `exterior`, `dungeon`, `building`, `door`, `rmb`, `rdb`,
  `region`), each one query (`parts`), with `place`, `inRegion` and `usersOf`. `ATLAS_VERSION` rises when a part's
  shape changes. Names resolve as the layout reads them (`src/world/atlas/atlasServed.js`), including blocks the
  world-data door serves (`src/formats/worldData/worldDataReplacement.js` `worldDataServesBlock`).
- **In the streaming world** (`src/scenes/atlasHost.js`). `createTamrielPlaces` makes the atlas host as `worldAtlas`.
  A bundle is made when first asked. Residency is derived from the registry's `near`, never stored. At idle (500 places,
  8 ms a slice) it checks every listed place, this client's world-data additions and every property row, and tells the
  console once of anything that serves nothing.
- **The residency clock** (`src/net/regionClockLaw.js`, kept by `server-account/src/regionClock.js`). A tick is a UTC
  day. Tick t adds the acts of day t - 3 (`REGION_ACTS_SETTLE_DAYS`), so late Watch claims and patron sales count. A
  region is resident when players acted at one of its towns that day; resident regions step and a rotation steps two
  more, so none of the 71 regions is more than 36 ticks behind. Prosperity is the first rule: integer state stepped a
  day at a time, halving toward nothing every fourth day. A town adds 0 to 5 for its region's
  (`townProsperity`, `regionTermOf`). The tick and its rows are one write.
- **Property as data** (`src/net/homeListings.json`, `src/net/homeListingLaw.js`). A row names a town by map id and a
  building (`key`) or a grid cell (`cell`); `sale: false` takes it off the market and `price` sets its price in the
  law's range. The door asks (`src/systems/online/onlineHomes.js` `homePurchasable`) and the service refuses an unlisted
  or mispriced claim. Key rows are read only in Daggerfall's own layout; a pack's town is curated by cell. The game ships
  no row.
- **The land as data** (`src/world/land/landEdits.json`, `src/world/land/landLayer.js`). A row names a rectangle of
  world pixels with a height and a climate. On the Bay rows are written into WOODS.WLD and CLIMATE.PAK as
  `src/scenes/shared.js` `fetchBytes` serves them, each pixel's detail by WOODS.WLD's own law for its byte. Past the
  Bay `tamrielHeightByte`, `tamrielClimateAt`, the air's climate and the snow line ask the rows first.
  `node tools/landEdit.mjs` writes a row through the same check. The game ships no row.
- **Open files** (`scripts/openFileLimit.mjs`). Vite's asset reads are capped at 256 open, and an EMFILE or ENFILE
  read is retried, so the Windows build does not run out of file handles.

## Rules

Decision records (FOUNDATION):

- Measure first, by a written method: `tools/foundationMeasure.mjs` and `tools/atlasMeasure.mjs`.
- The atlas is an index over what stands, not a second archive: ARENA2 is not redistributable, so the player's own
  files stay the archive and the world-data packs stay the layers.
- The JS client stays; the atlas, clock, listings and land layer are JS modules both ends read.
- One clock, for state the day cannot derive. Prices and the town cycle are already pure functions of the day.
- Data seams sit at the readers' choke points; no host grows.
- No image atlas: PNGs are fetched on demand by per-mod indexes.
- The skins are not forked again; the forks that stand are faces over one model.

Standing limits:

- A land row in the 14 pixels past the Bay's edge is refused (that ground is the Bay's, blended), as is one in the
  Eltheric Ocean's box. A water row is height 0; land is 6 and over with a land climate.
- The Bay's fit to the picture and the countryside's rates read the files as they came (`filedClimate`,
  `filedHeight`), so a row moves no place past the Bay.
- A listing's price keeps a home's ground only while it covers the law's price for that ground. A Knightly Order's
  house is a grant and ignores the rows. A home already owned is not touched by a later row.
- Tamriel: the atlas reads every province through the registry (`src/world/worldWide/worldPlaces.js`); each harbour
  slice carries its capital's province (`src/world/pastBayRows.js`).

## Code and tests

- `src/world/atlas/` - the atlas and the served resolve; `src/scenes/atlasHost.js` - in the world host
- `src/net/regionClockLaw.js`, `server-account/src/regionClock.js` - the clock and prosperity
- `src/net/homeListingLaw.js` - the listings
- `src/world/land/landLayer.js` - the land layer
- `test/world/atlas/` - the atlas on synthetic data and on ARENA2
- `test/scenes/atlashost.test.js` - the host
- `test/net/f2_regionclock.test.js` - the clock's bound, step-invariance and service
- `test/net/f3_homelistings.test.js` - the rows, door, claim and check
- `test/world/land/f4_landlayer.test.js` - the land rows on and past the Bay
- `test/tooling/f5_openfiles.test.js`, `test/tooling/foundationmeasure.test.js` - the file cap and the measurement
- `tools/mutants/foundation.json` - the mutants

## Open

- A town's card reads today's regional term for yesterday.
- A home resold by `homeTransfer` keeps no row's word; a home bought at a removed row's price keeps no later ground.
- The world host stamps every door's town for the listings; no other host buys homes.
