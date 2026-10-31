# Settlement 2.0 - the RMB contracts (RMB-CONTRACTS)

Opened 2026-10-31. The owner, handing over the settlement half of the WORLD 2.0 specification ("World Generation 2.0,
Settlement System 2.0 & World Editor", section 6): *"we are going to develop a modern replacement for the current system
that will allow us to procedurally generate settlements with different heights, not block based layouts, and with
freedom of new buildings, among many other things."* The specification's terrain, climate and editor halves are another
arc. This page is the settlements', and it starts with the contracts every later slice builds on.

RMBC0 is the audit and the decision records. RMBC1 is the contract: the plan, the key bands, the ground pads, the key
ledger and the legacy adapter. RMBC2 is the generator: six archetypes in every theatre's style, laid out on their ground.
Both are pure and unwired: no host, save, wire or service reads them yet, so no player sees a change.

## Decision records

Each is dated, says what was decided and why, and names what it costs.

- **RD-1 (2026-10-31) A settlement is a plan; RMB is one source of its buildings.** A plan is metres: a footprint, flat
  pads at their own heights, links between them, streets, districts and buildings. A legacy town is a plan whose
  buildings point at their RMB records. A procedural or authored one points at models, prefabs or generated walls. One
  settlement may mix all three (the specification's 6.1). Cost: until the hosts read plans, the RMB layout stays the one
  that stands.
- **RD-2 (2026-10-31) Identity stays a place and a building key.** Sixteen account tables, the relay's interior rooms,
  deeds, recall anchors and quest sites key on `(map_id, building_key)`. A new id type would migrate every one. A new
  building takes a key from a minted band, `0x800000` to `0xFFFFFF`: past every RMB key, under `BUILDING_KEY_0`, so
  `homeBuildingKeyOk` and `isWorldRoom` take it unchanged. A minted key is never decoded into a block cell. Cost: about
  8.4 million minted keys a place. The Imperial City fabric's plot keys are hashes that reach into the band, so a slice
  of the Imperial City cannot mint until its homes take ledger keys.
- **RD-3 (2026-10-31) A new building's key is kept, not derived.** The fabric derives a key from a hash of its plot, so a
  generator change gives every building a new key and orphans what players own there. The ledger mints a key once for a
  plot's anchor (the generator's or author's stable name for it) and keeps it through every regeneration. An anchor that
  goes retires its key, which is never minted again. Cost: the ledger is data that ships with the plan.
- **RD-4 (2026-10-31) Heights are pads.** The ground is a set of flat pads that do not overlap, each at a height over the
  settlement's datum, joined by links (grade, stairs, ramp, bridge) with pitch limits. A building stands on one pad with
  its whole footprint on it, so it cannot float or sink. Flat pads keep floors level and the terrain carve simple. Cost:
  a sloped street is a ramp link between pads, not a sloped pad. A pad on a plane is a later contract version if a town
  needs one.
- **RD-5 (2026-10-31) The datum is the terrain's; wiring it is a new ground frame.** Plan heights are over the datum the
  terrain gives a town today (the mean of the land under its outline). Pads change the ground under saved records, so the
  slice that wires them raises `GROUND_FRAME_LAW` and adds a moved field, as TOWN-SHAPES did. Cost: none until then.
- **RD-6 (2026-10-31) Protected property blocks a plan.** The ledger refuses to retire or move a key the account service
  protects (a home, a hall, a rental, a recall). Rejection is the default, as the specification's 8.3 asks. Cost: a
  publisher asks the service for the protected keys first.
- **RD-7 (2026-10-31) One check, both ends.** `validateSettlement` is pure, so the client, a tool and the account service
  run the same law. Each problem has a code, what it names and a plain reason. A plan carries its contract version, and
  `settlementPrint` (FNV-1a of its canonical form) is what two clients on one revision compare.
- **RD-8 (2026-10-31) One place a pixel stays.** The registry's law is the game's location index, and every pixel lookup
  reads it. A place inside a settlement (a farm, a shrine, a quarter) is one of its plan's sites, named by the place and
  its own id, so travel, quests and the editor can address it without a registry change. A farm out in the country takes
  its own pixel's place, as the countryside's places do today. The owner gave this call to the arc ("You have
  autonomy"). Cost: two settlements cannot share a pixel.
- **RD-9 (2026-10-31) An occupied town is never replaced; it grows.** A town that holds homes keeps every legacy building
  and its key. Generated buildings take its open ground (TS3's dropped cells, the land past its walls) in a mixed plan,
  as the specification's 6.1 allows. Generated settlements go first where no home stands (its Phase 6). The ledger's
  protected keys hold it. Cost: the clone towns past the Bay keep their borrowed layouts until a mixed plan grows them.
- **RD-10 (2026-10-31, revised at RMBC3) Inputs are published; every client lays out.** RMBC2 decided a plan would be
  made once and served as data. RMBC3 found the ground past the Bay is traced from the player's own map picture
  (TMAP00I0.IMG, `03-World/Tamriel.md`), so a plan's heights are derived from game data and cannot ship. A settlement is
  published as its inputs alone (RD-16), and each client lays it out on its own ground with arithmetic every engine
  rounds alike (RD-13). Cost: the layout runs on every client, in its terrain worker.
- **RD-11 (2026-10-31) Two layouts, one geometry; the land decides.** A ring town wraps a square; a row town follows an
  arc round a hillside or along a shore. Both are cut in one polar frame, so one set of cells, links and plots serves
  both, and a straight row is an arc of a large circle. An archetype names its layout, or `auto` reads the ground: a hill
  is a ring on its top, a slope a row along it, flat ground a ring. A third layout (a branching street tree, a planned
  grid) adds cells, not contract. Cost: the first towns are rings and arcs.
- **RD-12 (2026-10-31) A site that does not suit says so.** The generator reports its fit: the buildings it stood and its
  deepest cut. A site too wet or too steep for the archetype answers `ok: false`, so the slice that places settlements
  picks another site instead of shipping a poor town. Cost: none.
- **RD-13 (2026-10-31) The same answer on every engine.** `Math.sin`, `cos`, `atan2` and `hypot` may differ in their last
  bit between browsers. `exactMath.js` builds them from `+`, `-`, `*`, `/` and `Math.sqrt`, which IEEE 754 rounds
  exactly, in a fixed order, to about 1e-15. The generator reads no other. Golden prints pin three plans bit for bit; a
  change that moves one is a new `SETTLEMENT_GENERATOR_VERSION`. Cost: a few slower trigonometric calls a layout.
- **RD-14 (2026-10-31) Pads are geometry; the terrain sits under them.** The terrain's vertices are 6.4 m apart, coarser
  than a street, so terraces drawn by the terrain alone would slope across every rim. A pad is drawn and walked as its
  own paving or deck. The terrain is carved to stand under every cut pad within one cell's diagonal, so no triangle rises
  through, and eases back to the land over 28 m. Cost: a retaining wall's face is a model, not terrain.
- **RD-15 (2026-10-31) The worker lays it out; the host dresses it.** The layout (sites, cells, terraces) is split from
  the dressing (streets, plots, buildings, keys). The terrain worker runs the layout on the pixel's natural ground,
  carves, and hands the layout back with the pixel; the main thread dresses that same layout. Ground and buildings come
  from one computation. Cost: the layout's modules must stay worker-safe (`world/` and `formats/` alone).
- **RD-16 (2026-10-31) One settlement a province, on land no place holds.** `settlements.json` publishes nine, one in
  each province past the Bay, each searched by `tools/settlementSites.mjs` on the player's own files: the province's
  land, no Arena town, capital, countryside place or lair on its pixel or beside it, and a fit that is `ok`. A row fixes
  the structure its ground chose (layout, centre, shore) and its key ledger, so every client lays the same cells. Its map
  ids are their own lane, `0x342`. A location on the pixel always wins (RD-9). Cost: Cyrodiil's rivers are not yet water,
  so its settlement is a village until the WORLD 2.0 hydrology stands them.
- **RD-17 (2026-10-31) Buildings past RMB, from the fabric's kit.** A building is the Imperial City fabric's mesher over
  its footprint (`buildPlot`), in its style's walls and roof; its door is the fabric's door model on its front wall; its
  rooms are the fabric's generated interior, filed under its place and key. Nothing is written as an RMB block. Its door
  hands the game a record carrying its minted key. Cost: the fabric's kit shapes every settlement until its own exists.

## RMBC0 - what stands (AUDITED, 2026-10-31)

Read cold in three lanes: the legacy pipeline, the settlements built without RMB, and where the ground, the atlas and
the homes meet a town.

### A building's identity is its place in the grid

`systems/talk/talkTopics.js` `makeBuildingKey` (DFU's `BuildingDirectory.MakeBuildingKey`) packs a building's block
column, block row and record index into one key, 8 bits each, and writes key 0 as `BUILDING_KEY_0` (1 << 24). Every
RMB key is under `0x80000`. The key is minted on demand in several walks (`buildingSummaries`, the talk's lists,
`scenes/pixelBuild.js`, quest places, the fabric) and never stored with the layout.

What only needs a unique key under 1 << 24, scoped by the town's map id: the account service's `homes` and the fifteen
other tables with a `building_key` (decor, rooms, votes, offers, the festival's, the hall's decor, patron sales),
interior scene names, the relay's interior rooms, recall anchors, discovery, rentals and repairs. What decodes the key back into a block and a record, and so
breaks for a building with no record: quest cast markers, the curated-marker mend, the interior layout and its people,
`yardCellLaw.js` `yardCellOf` (and the yard tables, keyed by that cell), `homeListingLaw.js` `homeKeyCell`, the arena check, the town's name draw (order-dependent
over blocks) and the door and building hit-tests in `pixelBuild.js`. Those decoders are the migration surface: RMBC3
moves them onto the plan.

### The ground is one height

A town's ground is flattened to one height: `terrain/terrainTiles.js` `blendLocationTerrain` over the location's
rectangle, or `blendShapedTerrain` over TOWN-SHAPES' outline, each to the mean of the land under it. Buildings stand at
the block's origin height. The only relief is Solitude's, by hand: `solitudeRelief.js` and `tamrielCapitals.js`
`capitalBlockLift`, which lift a whole block onto a tier. Saved heights carry `terrainSampler.js` `GROUND_FRAME_LAW`
(5), and a change to town ground re-stands old records through a moved field.

### The grid's limits

A location is one map pixel and at most eight by eight blocks of 102.4 m. A block holds at most 32 building records
and turns a building about one axis. One place stands on a pixel (`worldPlaces.js`, the game's own law). Towns past the
Bay are Bay layouts cloned under a new id (`arenaLocations.js` `synthesizeArenaLocation`); TS3's outline may drop a
cell but never moves a building, because homes are keyed by position.

### The one building without a block

The Imperial City's fabric (`imperialFabric.js`, `imperialFabricBuildings.js`) is the only generator that makes
buildings without a Daggerfall block: plots as quads, storeys that step, generated rooms. It still writes each cell as
an RMB block (`withFabricBuildings`), so a building has two identities (its RMB key and its plot hash), 255 buildings a
cell at most, and flat ground. It is the precedent RMBC4 reads first.

## RMBC1 - the contract (BUILT, 2026-10-31)

Four modules in `src/world/settlement/`, each pure and `@ts-check`.

### The plan (`settlementContract.js`)

| Field | What it holds |
|---|---|
| `contract` | `SETTLEMENT_CONTRACT_VERSION` (1). A reader refuses another. |
| `place` | The registry's map id (`worldPlaces.js`): the settlement's identity in every province. |
| `source` | `legacy`, `procedural` or `authored`; each building carries its own as well. |
| `generator`, `revision` | The generator's id, version and seed (null for legacy and authored), and the published revision. |
| `origin` | A world pixel (bounded by `worldPixelOk`) and metres east and north of its south-west corner. |
| `footprint` | A ring of points in metres: any shape, not a grid. |
| `pads`, `links`, `gates` | The ground: flat pads at heights over the datum, the ways between them, and where the roads come in. |
| `streets`, `districts` | Streets by rank (main, side, alley, path) on one pad each; districts by purpose. |
| `buildings` | Key, anchor, pad, point, yaw, lift, footprint, storeys, exterior and interior assets, doors, type, faction, quality, name seed, access. |

`groundAt` answers the pad and height under a point. `floorOf` is a building's pad height plus its lift.

### The key bands

| Band | Keys | Who mints |
|---|---|---|
| RMB | under `RMB_KEY_LIMIT` (`0x80000`), and `BUILDING_KEY_0` | `makeBuildingKey`, from a block and a record |
| Minted | `MINTED_KEY_MIN` (`0x800000`) to `MINTED_KEY_MAX` (`0xFFFFFF`) | the key ledger, for an anchor |
| Neither | the rest (the merchant yards' `YARD_KEY_BASE` among them) | refused as a building's key |

`keyBandOf` names the band. `rmbPartsOfKey` decodes an RMB key and answers null for a minted one. `RMB_KEY_LIMIT` is
the same edge as `imperialHomes.js` `FABRIC_HOME_KEY_MIN`, and a pin holds the two equal.

### What the check refuses

`validateSettlement` answers every problem at once. A plan of another contract version is refused alone. The codes:
`source`, `place`, `origin` and `poly` for the frame and the rings; `id-dup` for any id twice; `outside` for a pad or a
building past the footprint; `pad-overlap` (ground has one height); `link`, `link-end` and `link-steep` (a grade link
rises at most `STEP_MAX`, 0.4 m; stairs 0.75 and ramps and bridges 0.25 of their run); `street` and `street-off-pad`;
`key-band` (a legacy building keeps its RMB key, a new one is minted); `anchor`, `asset` and `access`; `off-pad` (a
footprint over its pad's rim would float or sink); `overlap` (touching is not overlap: row houses share a wall);
`no-entrance`; `entrance-off-wall`; `entrance-blocked` (no ground within a step of the floor 0.8 m outside the door);
and `unreachable` (no way from a gate to the door's pad).

A legacy building with no footprint is its record's: its walls and doors are not read. These limits are ours. DFU's
towns are flat and have no stairs between levels.

### The key ledger (`settlementIds.js`)

`reconcileBuildingIds(ledger, proposed, { protectedKeys, published })` gives a plan's new buildings their keys. An
anchor in the ledger keeps its key. A new anchor takes the ledger's next key. An anchor that is gone retires its key,
and the next key only goes up, so a retired key is never minted again, even for its own name. A protected key is never
retired (`protected-removed`), and a protected building whose pad, point, yaw, lift or footprint changed is a
`protected-moved` conflict. Two buildings on one anchor and a spent band are refused. Legacy buildings pass through
untouched. `ledgerProblems` refuses a ledger that lies about what it minted.

### The legacy adapter (`legacySettlement.js`)

`legacySettlementOf` turns an RMB layout and its `buildingSummaries` into a plan: one flat pad over the grid, every
building with the key the walk minted, at its block's origin plus `RMBLayout.GetBuildingData`'s position, with its
record as its exterior and, where the record has a room, its interior. A house is private. `directoryOf` reads the plan
back as the game's building lists read it, with each building's floor on its pad; a minted key's row carries no block
cell. On the player's own files the city of Daggerfall is 647 buildings over 64 blocks, 632 with rooms, and its clone
under a Hammerfell town's id keeps every key.

## RMBC2 - the generator (BUILT, 2026-10-31)

`src/world/settlement/settlementStyles.js` is the data. A style for every theatre (`THEATRE_KEYS`: the Bay and the nine
provinces) gives its buildings' storeys and roof, a plot's frontage and depth, the gap between neighbours (0 a terraced
row), its street and lane, its deck (Valenwood's 4 m platforms and Black Marsh's 1.4 m stilts, 0 elsewhere), its terrace
step and its temple's divine. An archetype gives its layout, centre, size, bands and sectors, gates, walls, keep, docks,
wealth, services and the feature at its heart. The six are the specification's Phase 3 five (an oasis village, a mining
settlement, a fortified mountain town, a river trade settlement, a wetland village on decks) and a plain village.

`src/world/settlement/settlementGen.js` `generateSettlement` reads the ground through `env.heightAt` (and `waterAt`) and
lays out a plan in the specification's stages. A, the site: the layout and its centre (a fort on the highest point, an
oasis round the lowest, a river town's quay on the shore, found by the weighted middle of the water near it). B, the
cells: sectors round or along the frame, bands of street, plots and yard. C, the terraces: each cell's pad starts at its
natural height and neighbours are pulled together until every step is climbable by its link, a step between cut
terraces never past the style's terrace. A deck never sinks within `DECK_CLEAR` of its ground and moves four times as
readily as cut ground.

D, the streets and lanes; E, the plots, a frontage at a time; F, a building on each plot big enough, its front wall and
back corners clear of the chords that bend round the arc, its door to its street; the services take the plots that suit
them, the temple its style's divine and the fort's keep its mound, a pad standing in the square. G, the features: the
heart's well or market, yard trees, open plots as gardens, a fort's walls and towers broken at its gate, a river town's
docks. Keys come from the ledger. Regenerated with its ledger, a plan keeps every key; with new parameters it keeps the
anchors that still stand. The editor's controls are `params`: size, density, bands, sectors and the share left open.

### What RMBC2 added to the contract

A pad may stand wholly inside another (a raised square, a keep's mound), and the smaller is the ground where it stands
(`padAt`); pads that cross each other's rims are refused. A pad's `base` is `cut` (the terrain is cut and filled to it)
or `raised` (it stands on posts). `plots` are a building's ground or open land, and a building keeps to its own
(`off-plot`). `features` are a closed set of kinds standing on their pad or inside the footprint. Nothing has been
published, so these are part of contract version 1; RMBC6 freezes it. The geometry's tolerance rose from 1 cm to 2 cm:
a point and a line each rounded to the centimetre stand up to 1.4 cm apart, and a shared wall read as a crossing.

### Seen and measured

Swept over six archetypes, ten styles, six grounds (a hill, a steep and a gentle slope, flat land, a shore, a marsh) and
three seeds, 1,080 plans: every one keeps the contract. The fit tells the land apart. The wetland stands on all six; the
mine needs a slope and the fort a hill; on the marsh only the styles that build on decks stand a town. The largest plan
(a fort of about 120 buildings) takes 0.3 s. `tools/settlementProbe.mjs` draws each archetype from above. With ARENA2 it
stands each one on a pixel of the Bay's own ground that suits it, the river town on a coast found in WOODS.WLD, and all
six keep the contract and fit. The pictures stay in `scratch/` (a render of the player's ground is game data).

## RMBC3 - the ground (BUILT, 2026-10-31)

`exactMath.js` makes the generator exact on every engine (RD-13). The generator is split (RD-15): `settlementLayout.js`
lays out stages A to C, worker-safe, and `settlementGen.js` dresses a layout with stages D to G; a layout passed as plain
records dresses to the same plan, pinned. `settlementGround.js` carves (RD-14). `settlementStand.js` is the worker's
step: on a pixel no location holds and a settlement does (`settlementOnPixel`), `terrainGen.js` `generatePixelTerrain`
lays the settlement out on its natural samples after the roads and the sites, carves its pads in, keeps its trees off
its ground (the nature's clearing rect) and returns `settlement` with the pixel. `pixelBuild.js` puts it on the built
entry. The worker's graph is still `world/` and `formats/` alone, 86 modules (`tamriel2.test.js`).

The ground moved, so the frame's law did too: `GROUND_FRAME_LAW` 6 and `PADS_FRAME_LAW` 6 (`terrainSampler.js`). A record
written before stands where the carve put the ground: `landforms.js` `settlementMovedField` and `groundFrameHost.js`
`padsMovedAt`, none on a pixel a location holds. Six pins of the old law moved with it. The wire's `GROUND_LAW` is 6 and
the relay `world303`, so a ground room refuses the old ground. The ground's print reads Sahr Waters' pixel
(`tools/groundPrint.mjs`): a lost carve moves it 2.6 m and fails `fb1017f_groundgate.test.js`.

## RMBC4 - the buildings stood (BUILT, 2026-10-31)

`settlementModels.js` makes a dressed settlement models (RD-17): `groundModel` paves each cut pad at its height with a
retaining wall down its rim, decks each raised pad on posts, and lays each link as a stair, ramp or bridge between its
pads' heights; `buildingPiece` stands a building with `buildPlot` in its style's walls, roof and pitch (now a style's
data), its front its street's, its door the fabric's door model turned to face its street; `buildingInterior` is its
rooms (`fabricBuildingInterior`, which now takes a `cacheKey`, so a settlement's building never files under an
Imperial plot's hash); `buildingRecord` is what its door hands the game. Their model ids run from 7,600,000, 4,096 a
settlement, past the Imperial City's.

`scenes/settlementHost.js` is the streaming world's pool on the yards' shape. It installs the model family once, dresses
each built pixel's layout, asks the pipeline for the meshes, draws them at the pixel's translation, files the ground and
the buildings in one collider bucket (held back while feet stand inside a wall), and hands each door to the modes with
its record (`settlement`) and its rooms (a `dfBlock` of its own, never a BLOCKS.BSA record). `world.js` wires it in
fifteen logical lines, each a getter on the host's own state, and bootWorld's ceiling rose by those 15
(`hostceiling.test.js`). The host's `frame` warns its own throw, so the world calls it bare. `buildingDataForDoor`
answers a door with no location pixel by a copy of the record it carries.

Seen in the game (`tools/settlementWorldProbe.mjs`, ARENA2, the dev server): the player jumped to Sahr Waters' pixel,
which stood 37 buildings, every mesh ready. At a shop's door the eye found it, the shopkeeper's greeting opened, and when
it closed the player stood inside The Adventurer's Market with its keeper behind the counter. The first runs found one
fault, a frozen record the transition wrote on, and `buildingDataForDoor` now hands over a copy. Pictures stay in
`scratch/`: a render of the game's data is the game's data.

## RMBC5 - the sites (BUILT, 2026-10-31)

`settlementPlaces.js` reads `settlements.json` (RD-16): each row's pixel is its picture point under the fit now, so a
settlement keeps to its land whatever the fit; none stands on the Bay. `tamrielPlacesHost.js` registers them after the
places past the Bay, so a town of theirs keeps its pixel; they carry no location index, so no raid picks one. The nine:
Corvel Keep (High Rock, a fort), Sahr Waters (Hammerfell, an oasis), Kolvar's Cut (Skyrim, a mine), Velas Rest
(Morrowind), Aleth Quay (Sumurset, a river town on its shore), Thorn Canopy (Valenwood, on decks), Tasha's Bend
(Elsweyr), Hatchwater (Black Marsh, on stilts) and Corrol Ford (Cyrodiil). A seed the search tried laid a pad 3 cm
past its footprint: the outline now keeps the farther of two near points, and a sweep of 2,400 plans keeps the contract.

## Next slices

- **RMBC6 publication and the online check.** A plan's print said in the room's hello, so two clients that disagree are
  told; the protected keys asked of the account service before a revision changes a published row.
- **RMBC7 homes in a settlement.** A settlement's houses for sale once the decoders listed in RMBC0 ask
  `rmbPartsOfKey` and read a minted key's building from its plan (yards, listings, quest markers).
- **RMBC8 the editor's seam.** The WORLD 2.0 editor reads and writes a row's `params` and `fix`, and regenerates a
  district by its anchors.

## THE FOUR HOSTS (Home.md)

`scenes/world.js` WIRED: the host built, framed, drawn and dropped, its doors in `doorTargets`, its records answered by
`buildingDataForDoor`. `scenes/worldModes.js` WIRED through those two seams, with no line of its own: a settlement's
door opens its rooms as a block's door does. `scenes/exterior.js` FLAGGED: the fixed-city bench streams no pixel, so it
stands no settlement. `scenes/dungeonContext.js` FLAGGED: a dungeon stands no street.

## The whole of Tamriel

A plan is keyed by its place's map id from the registry and its origin is bounded by `worldPixelOk`. Nothing reads
MAPS.BSA's rows. Every pin holds a Hammerfell case beside the Bay's: a terraced village in the contract's tests, a
Hammerfell town's lane in the ledger's, and the Daggerfall city's layout cloned under a Hammerfell id in the corpus.
The generator has a style for every theatre and is pinned in each, past the Bay and on it. The published settlements
stand one in each of the nine provinces; the Bay's ground is left to DFU's places (RD-9).

## Pins and mutants

`test/world/settlement/`: `rmbc1_contract.test.js` (12), `rmbc1_ids.test.js` (7), `rmbc1_legacy.test.js` (3),
`rmbc1_legacy_corpus.test.js` (1, on ARENA2), `rmbc2_contract.test.js` (5) and `rmbc2_gen.test.js` (12).
`tools/mutants/rmbc1.json`: 51 mutants, 51 dead. The first run left two alive, a self-crossing ring with an area and an
edge across a notch, and the geometry pin was added for both. `tools/mutants/rmbc2.json`: 34 mutants, 34 dead. Its
first run left the deck's floor alive (no pin pulled a deck toward its ground), and a town whose gate stands on the low
side now does; the split's run left the dressing's seed alive, and a pin now dresses one layout with two seeds.
`rmbc3_exact.test.js` (4), `rmbc3_ground.test.js` (6) and `rmbc4_stand.test.js` (7) pin RMBC3 to RMBC5;
`tools/mutants/rmbc3.json` and `rmbc4.json` hold their mutants; `RMBC3-print-blind` is killed by the ground gate.

## Port-Ledger

Section A, RMB-CONTRACTS: the port's own. DFU's settlements are RMB grids.
