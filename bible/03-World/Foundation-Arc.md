# Foundation - the proposal "A Foundation for Scale", taken on (FOUNDATION)

Opened 2026-10-30. DnfJeff's proposal "A Foundation for Scale: Proposal for DFO's Next Phase" (29 October 2026) argues
that the world's data should be entity-major - a place one bundle, the blocks a shared vocabulary checked when packed -
that regional rules should run on a residency clock, and that property, shorelines and landscaping should become data
changes, not code. Its practical path has four steps: a joint measurement pass, a pilot region, a narrow versioned
surface the client adopts piece by piece, and decision records. The owner, handing it over: *"Please take this on and
only return when this is finished in full."* After a first return that left slices open, the owner said again not to
return until it was finished.

This page is that work, in six slices: F0 the measurement, F1 the atlas, F2 the residency clock and its prosperity, F3
property as data, F4 the land as data, F5 the build's open files. The decision records come first.

## Decision records

Each is dated, says what was decided and why, and names what it costs.

- **FD-1 (2026-10-30) Measure first, by a written method.** `tools/foundationMeasure.mjs` re-takes the structural
  figures and `tools/atlasMeasure.mjs` the world's. Each counter is pinned on a fixture tree, so a method that drifts
  fails. Cost: the figures are the audit's record, not pins; they move with every change.
- **FD-2 (2026-10-30) The atlas is an index over what stands, not a second archive.** It reads places through the
  registry (`world/worldWide/worldPlaces.js`, WW1) and layouts through the readers and the world-data door, so it
  answers for every province and sees every edit the game serves. ARENA2 is not redistributable (Port-Doctrine), so the
  player's own files stay the archive and the world-data packs stay the layers. Cost: no 48 MB archive is built.
- **FD-3 (2026-10-30) The client stays.** The proposal plans a Godot client; its own step 3 has the JS client adopt the
  surface. The renderer is hand-rolled WebGL2 (Port-Doctrine). The atlas, the clock, the listings and the land layer
  are JS modules both ends read.
- **FD-4 (2026-10-30) One clock, for the state the day cannot derive.** ECON1's prices and TOWN-ECON's cycle are pure
  functions of the day, already step-invariant; they stay as they are. The clock runs the first regional state that is
  players' acts, kept by the account service (F2). Prosperity is its first rule.
- **FD-5 (2026-10-30) Data seams at the readers' choke points.** A land row is written into the game's files as they
  are served and asked by the ground's two reads past the Bay (F4); a listing is asked by the door and the claim (F3).
  No host grows: `bootWorld`, `createWorldModes` and the rest gain no statement.
- **FD-6 (2026-10-30) No image atlas.** The client fetches each PNG on demand, guided by per-mod indexes, so nothing
  is fetched that is not drawn. A packed sheet would change every sampler and UV path for no player-visible gain. The
  harm the PNG count did cause, the Windows build's EMFILE, is fixed at its source (F5).
- **FD-7 (2026-10-30) The skins are not forked again.** Measured: 26 doors already pick a face over one model, PORT2
  wears 10 classic windows in both skins, and about 25 screens have two faces (F0). The claim "every screen exists twice"
  does not hold; the forks that stand are faces, which is the abstraction the proposal asks for.

## F0 - the measurement pass (MEASURED, 2026-10-30)

`node tools/foundationMeasure.mjs`. A host is measured as the ceiling measures it (`tools/hostScope.mjs`). An assertion
is a call site in the text, not a run's count. A text pin is `assert.match`, `assert.doesNotMatch`, or an
`assert`/`assert.ok` of `.includes`, `.test` or `.indexOf`. A test "reads our source" when it reads a path under `src/`,
`server/src/` or `server-account/src/`. A file "reaches presentation" when it imports from `render/`, `ui/` or
`scenes/`, or touches `document`, `window` or WebGL.

| The proposal says (V439, 2026-10-26) | Measured here | Verdict |
|---|---|---|
| `bootWorld` is 34,301 lines | 32,965 source lines; 35,150 logical | Holds, a little smaller |
| The four hosts hold 64,635 lines | 63,241 | Holds |
| 282,382 assertions | 309,802 call sites in 4,597 test files | Holds in scale |
| About one in ten is a match against another source file | 16,955 text pins in files that read our source: 5.5% of all call sites. Text pins anywhere: 36,820 (11.9%) | Half of what it says, if "against source" is meant |
| A third of test files open source as text | 1,486 of 4,597 (32%) | Holds |
| Four text surfaces; two of four hosts wire the toasts into the ring | Two PopupText rings, the mid-screen label, the message box, the notice panel, chat, the event board and a family of DOM banners. All four hosts file the HUD's lines in the message ring | Does not hold |
| Every screen exists twice | 26 doors pick a face over one model; PORT2 wears 10 classic windows in both skins; about 25 screens have two faces; 238 skin call sites | Does not hold |
| 33,000+ loose PNGs, no atlasing | 33,677 (20,474 under `public/`, 13,134 under `vendor/`, 69 under `src/`), 212.6 MB | Holds (FD-6) |
| The build fails half the time on Windows with EMFILE | Found: Vite reads every vendor PNG the eager globs name with no cap | Holds; fixed (F5) |
| 27 of 827 systems files touch presentation | 44 of 899 | Holds in kind |
| 1 of 86 format files does | 1 of 87 | Holds |
| A 609-file bible, 650k lines of English | 681 pages, 358,000 lines, 6.48 million words | Pages hold; lines are fewer |

The world's figures, on the freeware ARENA2 (`ARENA2_PATH=... node tools/atlasMeasure.mjs`, `--served`, `--world`):

| The proposal says | Measured here | Verdict |
|---|---|---|
| 15,251 locations | 15,251 | Exact |
| 328,499 buildings | 328,499 | Exact |
| 548,618 doors | 548,618 (MAPS.BSA's location door records) | Exact |
| 4,232 locations with dungeons | 4,232 | Exact |
| 45,427 exterior slots over 657 blocks, mean reuse 69 | 45,427 over 658, mean reuse 69.0 | One block more |
| About 28% of shipped content unreachable, by three mechanisms | 262 of BLOCKS.BSA's 920 RMB (28.5%) are named by no place; all 187 RDB are named | The one mechanism measured matches |
| One base archive of 48 MB | Not built (FD-2) | - |

Three claims the tree contradicts:

- **"The data model has no stable notion of place."** WW1's registry files every place by `worldPixelKey` and its map
  id, with its region, area and theatre explicit, past the Bay as on it (`03-World/World-Wide.md`).
- **"No step-invariant rules."** ECON1's world price walk is a pure function of the world's day: catching up equals
  having stayed, each step is integer arithmetic, and a rebuild walks at most 512 days (`systems/worldTick.js`
  `worldRegionPricesOn`, pinned by `econ1_world_prices.test.js`).
- **The restoring-force economy "most people assumed did not exist".** It is DFU's `FormulaHelper.UpdateRegionalPrices`,
  ported in S41 (`systems/shopStock.js` `priceWalkStep`) and the world's own since ECON1.

## F1 - the atlas (BUILT, 2026-10-30)

`src/world/atlas/atlas.js` holds the world's places entity-major. A bundle is one place whole: the registry's record
(identity, region, area, theatre), its exterior grid, its dungeon plan with its starting block, its buildings' types,
factions and qualities, and its door records. Blocks are a vocabulary: each name is interned once and a bundle holds
its ids, so a block used by 410 cities is one word used 1,433 times. The part kinds are a closed set of eight:
`place`, `exterior`, `dungeon`, `building`, `door`, `rmb`, `rdb` and `region`. Each is one query (`parts(kind)`), as
are a place (`place(mapId)`), a region (`inRegion(r)`) and a block's users (`usersOf(name)`). `ATLAS_VERSION` is 1,
raised when a part's shape changes.

Every name is resolved when a place goes in, as the layout would read it (`world/atlas/atlasServed.js`): BLOCKS.BSA's
alternate match, then a record of BLOCKS.BSA, and past it only a block the world-data door serves. The door gives an
index to any block a location names (`assignBlockIndices`), so a name could pass `checkName` with nothing behind it;
`worldDataServesBlock` in `formats/worldData/worldDataReplacement.js` answers that without building anything.

### In the streaming world (`scenes/atlasHost.js`)

`createTamrielPlaces` makes the atlas host over its registry and returns it as `worldAtlas`. A bundle is made when
first asked, from the location the host holds. The places near a pixel are the registry's `near`, asked each time:
residency is derived, never stored. A provider that registers starts a new atlas. Where the world-data door serves
edits or property rows stand, the host checks at idle, at most 500 places and 8 ms a slice: every listed place (one
past the Bay the host has not stood read through its clone, never stood), this client's own world-data additions
(HUB1 keeps them off the registry), and every property row (F3). A mod's block is asked as at a town no save pinned.
What serves nothing, or a row that names no town or cell, is told to the console once.

### What it measured

| World | Places | Exterior slots over blocks | Unresolved |
|---|---|---|---|
| Classic (the files as shipped) | 15,251 | 45,427 over 658 | 0 |
| Served (the game's installs, the capitals' slices and Arena's places) | 16,160 | 89,561 over 21,407 | 0 |
| Served with Beautiful Villages and Beautiful Cities | 16,160 | 100,192 over 21,436 | 0 |
| The whole world: every countryside place and lair rolled past the Bay | 321,869 | 689,789 over 21,407 | 0 |

The served world is installed as `scenes/modWorldData.js` installs it: the arena, the capitals, the town outline, the
urban art, the ships and the curated blocks. Past the Bay each province's region holds its own: 62 High Rock 29, 63
Hammerfell 31, 64 Skyrim 33, 65 Morrowind 31, 66 Sumurset 33, 67 Valenwood 31, 68 Elsweyr 32, 69 Black Marsh 32, 70
Cyrodiil 657 (the Imperial City's slices). The whole world's walk took seven minutes and found 305,709 rolled places.

The atlas found one fault in the world: Alinor Harbour and Torval Docks, two capitals' harbour slices, stood on the
picture's sea and carried region -1. Each slice now carries its capital's province (`world/pastBayRows.js`).

A town a pack replaces carries no location door records: `locationFromJson` writes none, so the door count falls with
the packs on. Nothing in the port reads those records - a door is its block's.

### The pilot: a place is data

Roleplay Realism makes a place by data: two DFU world-data files add Northrock Fort to the Wrothgarian Mountains
(`vendor/roleplay-realism/WorldData/`). With both files served, the fort is a bundle in region 16. With its location
served and its block not, the fill finds `RRFORT01.RMB` unresolved before any player walks to it
(`f1_atlas_layer.test.js`). F3 and F4 make property and the land the same kind of edit.

## F2 - the residency clock and prosperity (BUILT, 2026-10-30)

`src/net/regionClockLaw.js` is the clock and its first rule; `server-account/src/regionClock.js` keeps it
(`region_clock`, `region_clock_meta`, migration 0200 - 0198 on its branch, renumbered past main's 0198 and 0199 at
the merge). A tick is a UTC day, TOWN-ECON's. Tick t adds the acts of day t - 3 (`REGION_ACTS_SETTLE_DAYS`): a Watch receipt
is claimed up to two days late and a patron's sale reckoned up to 48 hours late, each on its own day.

A region is resident on tick t when players acted at one of its towns on day t - 3
(`town_econ_days` by `town_econ_towns.region`): derived each tick, never stored. This departs from the proposal's
radius round the player: the service knows players by their acts at towns. A resident region steps; the rotation steps
two more, so none of the 71 regions is more than 36 ticks behind (the proposal's bound is 45). The cron's `town-shares`
job ticks it after keeping the shares; the rows and the tick are one write, so a failed write loses no day and a
second runner writes nothing.

The rule steps a region's integer state a day at a time, so a catch-up of n days is n steps. The day's acts, weighed
as TOWN-ECON weighs them, are added; on every fourth day the state halves toward nothing with a shift that falls the
same either side. A region read off its own tick reads its closed form. The service answers each region's prosperity
with the towns' shares (`/v1/towns/econ`, `regions`), and a town adds 0 to 5 for its region's
(`townEconLaw.js` `townProsperity`, `regionTermOf`). A region nobody walks falls back to its towns' own economy.

## F3 - property as data (BUILT, 2026-10-30)

`src/net/homeListings.json` holds the online market's rows; `src/net/homeListingLaw.js` reads them for both ends. A row
names a town by its map id and one building (`key`) or one cell of its grid (`cell`). `sale: false` takes it off the
market; `price` sets what it costs, in the law's range. The door asks (`systems/online/onlineHomes.js`
`homePurchasable`, the door's price); the service refuses a claim or a hall's buy of a row's building
(`home-unlisted`) or at another price (`home-update`). The game ships no row: the market is the law's until one is
written.

The atlas checks every row names a real town and a cell of its grid: in the tests over the served world, in the game
over the registry's towns. A key row names a building of Daggerfall's own layout and is read only there; a town a pack
lays out anew is curated by cell, which every layout reads. A row's price keeps a home's ground only while it covers
the law's price for that ground. A Knightly Order's house is a grant and ignores the rows, though its buy-back reads a
row's price. A home already owned is not touched by a later row. Open land for homesteads is PLOT1's.

## F4 - the land as data (BUILT, 2026-10-30)

`src/world/land/landEdits.json` holds the land's rows; `src/world/land/landLayer.js` reads them. A row names a
rectangle of world pixels and its ground: a height (water 0, land 6 and over with a land climate) and a climate (the
Ocean on water alone), so every reader of the water agrees. A row in the 14 pixels past the Bay's edge is refused: the
ground there is the Bay's, then blended.

On the Bay the rows are written into WOODS.WLD and CLIMATE.PAK as
`scenes/shared.js` `fetchBytes` serves them, each pixel's 5 x 5 detail by WOODS.WLD's own law for its byte
(`largeOfByte`); every host, worker and reader reads those bytes, and DFU's two boot repairs (the coast's climate
dilated, a steep town's neighbours smoothed) run over a row as over the file's own. The Bay's fit to the picture and
the countryside's rates read the files as they came (`filedClimate`, `filedHeight`): a row moves no place past the Bay.
A town's own climate reads the PAK column west of its ground's (DFU's quirk, kept), so a row for a town's climate
covers that pixel too.

Past the Bay `tamrielHeightByte`, `tamrielClimateAt`, the air's climate and the snow line ask the rows first. A row in
the Eltheric Ocean's box is refused: its isles answer their own ground. The roads' kept caches carry the rows' stamp.
`node tools/landEdit.mjs` writes a row through the same check. The game ships no row.

## F5 - the build's open files (BUILT, 2026-10-30)

`scripts/openFileLimit.mjs` wraps the shared `node:fs/promises` readFile Vite reads its assets with: 256 reads open at
most, and a read refused with EMFILE or ENFILE asked again. `vite.config.js` installs it before the build reads
anything. Windows' C runtime caps a process near 8,192 open files; the eager globs name 13,134 vendor PNGs at once.

## AUDIT FOUNDATION (2026-10-30)

The owner: *"Audit this."* Four reviews read the branch's code, one slice each, apart from the writer. What they found,
and what was done:

- **C1 (bug)** A day's acts were read the morning after, before late Watch claims and patron sales landed on it; those
  were never counted. Tick t now reads day t - 3.
- **C2 (risk)** The tick was taken before the rows were written; a failed write lost the day. Now one batch, the rows
  written only while the clock stands where they were read.
- **C3, C4 (risk)** The shares now keep first, so a failing clock leaves them kept; a tick is five statements.
- **P1 (bug)** Block 0,0's record 0 (key `1 << 24`) read as cell 256,0, so a cell row missed it. `homeKeyCell`.
- **P2 (bug)** A row's price dropped the home's ground, and its decor's room with it. `homeGroundPrice`.
- **P3 (risk)** An arena-displaced home could move into a house off the market; the pick and the service refuse it.
  **P4** the door's row and the claim key one town: the world host stamps every door's town (`townMapId`), and no other
  host buys homes - recorded, not changed (`createWorldModes` is at its ceiling).
- **L1, L2, L3 (bug)** Past the Bay a water row of 1 to 3 stood as land; a row in the seam band was diluted; a land row
  over the sea kept the Ocean's climate and read as water. The row law refuses all three.
- **L5 (bug)** The landforms, the far ring, the gates and the halls read the climate law directly; `tamrielClimateAt`
  now asks the rows. **L6** an empty layer no longer moves the roads' print.
- **A1 (risk)** A harbour slice's location read region 0 while its row read its province; the slice now stands in its
  capital's province. **A2, A3** the atlas starts anew when the host stands a location again, and `near` stands
  nothing. **A4** a refused read waits longer each time and fails after 40. **A5** a check that throws ends.

Recorded, not changed: the card's yesterday reads today's regional term; the measurement's patterns are approximate
(a host's ring is read off its file, not its function); the tool's served world is the game's installs without its
loose mod files.

## AUDIT FOUNDATION II (2026-10-30)

The owner: *"Audit this"*, again, of the branch with the first audit's fixes. Four fresh reviews, one slice each, given
the code and not the first audit's findings. What they found, and what was done:

- **L1 (bug)** The Bay's fit to the picture and the countryside's rates read the served Bay: one island row moved the
  continent 5% and changed a tenth of the swamp places past the Bay. They read the files as they came.
- **L2 (bug)** A land row on the Bay kept the file's 5 x 5 detail: a mountain let down to byte 10 still stood 500 units
  up. The detail is WOODS.WLD's law for the row's byte. **L3** a row in the Eltheric Ocean's box read land to the roads
  and sea to the world; refused. **L4** past the Bay the air's climate, the felt climate and the snow line read a row.
- **C2, C4 (risk)** A second runner's refusal is pinned; a runner refused across midnight is no longer marked ticked.
  **C3** the client's half of the regional term is pinned.
- **P5 (bug)** A row's price made the ground check pass for any ground: a 5,000 hut could keep the largest room. A
  ground is kept only while the price paid covers the law's price for it.
- **P6 (bug)** A key row applied in a town a pack lays out anew, where its key is another building. Key rows are read
  in Daggerfall's own layout alone, at the door, the claim, the hall, the arena move and the ground.
- **A1 (gap)** The game's check never read a place past the Bay the host had not stood: 909 places. It reads them
  through their clones, 8 ms a slice. **A2** a bundle stood past the Bay is kept. **A3** a mod's block was asked
  under the pin of the town read last. **A4** the mod additions' loop is pinned.

The migration renumbered 0200 at the merge of main (C1 of the clock's review). Recorded, not changed: a home resold by
`homeTransfer` keeps no row's word; a home bought at a removed row's price keeps no later ground. All
mutants of the second audit dead.

## THE FOUR HOSTS (Home.md)

- `scenes/world.js` - wired, through `scenes/tamrielPlacesHost.js` (`worldAtlas`), `scenes/townEconHost.js` (the
  region's term) and `scenes/shared.js` (the land's bytes); `bootWorld` gains no line.
- `scenes/exterior.js` - the land's bytes through `fetchBytes`; no registry, so no atlas.
- `scenes/worldModes.js` - the door reads the listings (`homeListedPrice`); no statement added.
- `scenes/dungeonContext.js` - the land's bytes through `fetchBytes`; no registry, so no atlas.

## Pins and mutants

- `test/world/atlas/` - the atlas on synthetic data and on ARENA2: classic, served (with a rolled sample by Solitude),
  the town packs, the pilot.
- `test/scenes/atlashost.test.js` - the host: made when asked, residency, a moved registry, the check, a mod's additions.
- `test/net/f2_regionclock.test.js` - the clock's bound, the rule's step-invariance, the term, the service.
- `test/net/f3_homelistings.test.js` - the rows, the door, the claim, the atlas's check.
- `test/world/land/f4_landlayer.test.js` - the rows, past the Bay, the kept keys, the served files on ARENA2.
- `test/tooling/f5_openfiles.test.js`, `test/tooling/foundationmeasure.test.js`.
- `tools/mutants/foundation.json` - 103 mutants, the two audits' among them.

## Port-Ledger

Section A, FOUNDATION: the atlas, the served resolve, the region clock, the listings, the land layer and the build's
limit are ours. DFU has MapsFile and BlocksFile and joins them by position at layout, prices by region alone, and edits
no land.
