# Settlements - plans, the generator and the towns that grow

A settlement is a plan in metres, not a grid of RMB blocks. Its ground is flat pads at their own heights joined by
grade steps, stairs, ramps and bridges, and its buildings stand on those pads. A plan may mix sources: DFU's own
buildings from their RMB records, buildings the generator makes, and authored ones. Every city, town and village grows
outskirts round its legacy core, and nine settlements of the generator's own stand past the Bay, one in each province.

The owner set the aim: settlements made procedurally, with heights, not block layouts, and free to hold new buildings.
The owner's rules: every town grows, and it grows along its roads, not in planned rings. Both are departures from DFU,
whose towns are flat RMB grids that end at their rect and have no stairs between levels.

The code is `src/world/settlement/`. Every module there is pure and `@ts-check`, and the layout's modules are
worker-safe (`world/` and `formats/` alone).

## Identity: a place and a building key

A building is still known by its place's map id and a building key. Sixteen account tables, the relay's interior rooms,
deeds, recall anchors and quest sites key on that pair, so a new building takes a key the old law already accepts.

| Band | Keys | Who mints |
|---|---|---|
| RMB | under `RMB_KEY_LIMIT` (`0x80000`), and `BUILDING_KEY_0` | `makeBuildingKey`, from a block and a record |
| Minted | `MINTED_KEY_MIN` (`0x800000`) to `MINTED_KEY_MAX` (`0xFFFFFF`) | the key ledger, for an anchor |
| Neither | the rest (the merchant yards' `YARD_KEY_BASE` among them) | refused as a building's key |

`keyBandOf` names a key's band. `rmbPartsOfKey` decodes an RMB key and answers null for a minted one, so no minted key
is ever read as a block cell. `RMB_KEY_LIMIT` is the same edge as `imperialHomes.js` `FABRIC_HOME_KEY_MIN`, and a pin
holds the two equal. The Imperial City fabric's plot keys are hashes that reach into the minted band, so the Imperial
City cannot mint until its homes take ledger keys.

### The key ledger

A new building's key is kept, never derived from its geometry: a generator change would otherwise give every building a
new key and orphan what players own. `settlementIds.js` `reconcileBuildingIds` gives a plan's new buildings their keys.
An anchor (the generator's stable name for a plot, such as `c1.4.p2`) keeps its key. A new anchor takes the ledger's
next key. An anchor that is gone retires its key, and the next key only goes up, so a retired key is never minted again.
Legacy buildings pass through untouched. `ledgerProblems` refuses a ledger that lies about what it minted.

The ledger's conflicts: `protected-removed` (a protected key would retire), `protected-moved` (a protected building's
pad, point, yaw, lift or footprint changed), `protected-retyped` (a protected home would become another kind of
building or lose its private access), `anchor-dup`, `keys-spent` and `ledger`.

A grown town ships no ledger. `anchorLedger` hashes each anchor with its place into the minted band, so every client
mints the same keys and a plot added or dropped moves no other key. Two anchors on one hash (about one town in 5,000)
probe forward in sorted order, so the later one's key depends on the earlier; `protectedGone` refuses a protected key
that changes hands.

## The plan

`settlementContract.js` holds the plan's shape and its check.

| Field | What it holds |
|---|---|
| `contract` | `SETTLEMENT_CONTRACT_VERSION` (1). A reader refuses another. |
| `place` | The registry's map id (`worldPlaces.js`): the settlement's identity in every province. |
| `source` | `legacy`, `procedural` or `authored`; each building carries its own as well. |
| `generator`, `revision` | The generator's id, version and seed (null for legacy and authored), and the published revision. |
| `origin` | A world pixel (bounded by `worldPixelOk`) and metres east and north of its south-west corner. |
| `footprint` | A ring of points in metres: any shape, not a grid. |
| `pads`, `links`, `gates` | The ground: flat pads at heights over the datum, the ways between them, and where the roads come in. |
| `streets`, `districts`, `plots` | Streets by rank (main, side, alley, path) on one pad each; districts by purpose; a building's ground or open land. |
| `features` | A closed set of kinds (`FEATURE_KINDS`: a well, a market, a tree, a garden, a wall, a dock and others), each on its pad or in the footprint. |
| `buildings` | Key, anchor, pad, point, yaw, lift, footprint, storeys, exterior and interior assets, doors, type, faction, quality, name seed, access. |

Heights are pads. A pad is flat and pads do not cross each other's rims, but one may stand wholly inside another (a
raised square, a keep's mound), and the smaller is the ground where it stands (`padAt`). A pad's `base` is `cut` (the
terrain is cut and filled to it) or `raised` (a deck on posts). A building stands on one pad with its whole footprint,
so it cannot float or sink. A sloped street is a ramp between pads, never a sloped pad. `groundAt` answers the pad and
height under a point; `floorOf` is a building's pad height plus its lift.

### What the check refuses

`validateSettlement` is pure, so the client, a tool and the account service run the same law. It answers every problem
at once, each with a code, what it names and a plain reason. A plan of another contract version is refused alone
(`contract`). The frame and rings: `source`, `place`, `origin`, `poly`. Ids: `id-dup`. The ground: `pad` (an unknown
base), `pad-missing` (a link, plot or building on a pad the plan lacks), `pad-overlap`, `outside` (past the footprint),
`link`, `link-end` and `link-steep` (a grade step rises at most `STEP_MAX`, 0.4 m; stairs 0.75 and ramps and bridges
0.25 of their run), `gate` (a gate off its pad). Streets: `street`, `street-off-pad`. Features: `feature`.

Buildings: `transform` (no point, yaw or lift of 0 or more), `key-band` (a legacy building keeps its RMB key, a new one
is minted), `anchor`, `asset`, `access`, `off-pad`, `off-plot`, `overlap` (touching is not overlap: row houses share a
wall), `no-entrance`, `entrance` (a door with no point or facing), `entrance-off-wall`, `entrance-blocked` (no ground
within a step of the floor 0.8 m outside the door) and `unreachable` (no way from a gate to the door's pad). Geometry
is tested to 2 cm: a point and a line each rounded to the centimetre stand up to 1.4 cm apart. A legacy building with
no footprint is its record's, and its walls and doors are not read. `settlementPrint` (FNV-1a of the plan's canonical
form) is what two clients compare.

### DFU's towns as plans

`legacySettlement.js` `legacySettlementOf` turns an RMB layout and its `buildingSummaries` into a plan: one flat pad
over the grid, every building with the key the walk minted, at its block's origin plus `RMBLayout.GetBuildingData`'s
position, its record as its exterior and, where the record has a room, its interior. A house is private. `directoryOf`
reads the plan back as the game's building lists read it. On the player's own files the city of Daggerfall is 647
buildings over 64 blocks, 632 with rooms, and its clone under a Hammerfell town's id keeps every key.

## The generator

`settlementStyles.js` is the data. A style for every theatre (`THEATRE_KEYS`: the Bay and the nine provinces) gives its
storeys and roof, its walls', roof's and terraces' pictures (`ground`: sandstone in Hammerfell and Elsweyr, Nord stone in
Skyrim, moss stone in the Bay, flags in Cyrodiil), a plot's frontage and depth, the gap between neighbours (0 a terraced
row), its street and lane, its deck (Valenwood's 4 m platforms, Black Marsh's 1.4 m stilts, 0 elsewhere), its terrace
step and its temple's divine. An archetype gives its layout, centre, size, bands and sectors, gates, walls, keep, docks,
wealth, services and the feature at its heart: an oasis village, a mining settlement, a fortified mountain town, a river
trade settlement, a wetland village on decks, a plain village, and the outskirts round a town.

`settlementLayout.js` `layoutSettlement` lays out stages A to C from the ground (`env.heightAt`, `waterAt`). A, the
site: a fort on the highest point, an oasis round the lowest, a river town's quay on the shore. B, the cells: a ring
town wraps a square and a row town follows an arc round a hillside or along a shore, both cut in one polar frame, so one
set of cells, links and plots serves both; `auto` reads the ground (a hill a ring, a slope a row). C, the terraces: each
cell's pad starts at its natural height and neighbours are pulled together until every step is climbable by its link,
a step between cut terraces never past the style's terrace. A deck never sinks within `DECK_CLEAR` (0.6 m) of its
ground and moves four times as readily as cut ground.

`settlementGen.js` `dressSettlement` dresses a layout with stages D to G: streets and lanes; plots, a frontage at a time,
each numbered by its split so a plot dropped renames none; a building on each plot big enough, its door to its street,
its storeys its own plot's draw; the services on the plots that suit them (the temple its style's divine, the fort's
keep its mound); and the features. Each district draws from its own seed (`districtSeeds`) and each plot by its cell and
number. `generateSettlement` is both parts at once. A layout passed as plain records dresses to the same plan.

The generator reports its fit: the buildings it stood and its deepest cut. A site too wet or too steep for its archetype
answers `ok: false`. Swept over six archetypes, ten styles, six grounds and three seeds, every plan keeps the contract;
on a marsh only the styles that build on decks stand a town. `tools/settlementProbe.mjs` draws each archetype from
above, on synthetic ground or, with ARENA2, on a pixel of the Bay that suits it. Its pictures stay in `scratch/`.

The generator reads no `Math.sin`, `cos`, `atan2` or `hypot`, which may differ in their last bit between browsers.
`exactMath.js` builds them from `+`, `-`, `*`, `/` and `Math.sqrt`, which IEEE 754 rounds exactly, in a fixed order.
Golden prints in `rmbc3_exact.test.js` hold three plans bit for bit; a change that moves one is a new
`SETTLEMENT_GENERATOR_VERSION` (4).

## Every town grows

`townGrowth.js` `townGrowthJob` takes a city, town or village (MAPS types 0 to 2), on the Bay and past it, never a
capital over several pixels. `pixelBuild.js` hands it to the terrain worker as `growth`, with its theatre's style and
region (`townGrowthJob.js` `growthJobAt`). The town's core keeps every block, building and key at its own height: it is
the layout's plaza, `legacy`, fixed at the town's ground, and the terrace solve never moves it.

The outskirts take the land the pixel leaves. A cell is dropped on barred ground (`growthBlocked`: the town's ground
mask, a water tile, a World of Daggerfall camp) or within `GROWTH_MARGIN` (40 m) of the pixel's edge, so the carve meets
no neighbour. A cell whose cut would pass `CUT_STEPS_MAX` terraces is dropped. A link the solve leaves too steep (a deck
held over its ground beside a core that never moves) loses its outer end. What then no longer reaches the core goes.
A city takes four bands, a town or village three, at 0.7 density with 40% of plots left open.

### Along its roads

A town grows along its roads, never in even rings. `coreEdge` starts each sector at the square's own edge along its
span, a street out and a setback of up to 6 m, and a core takes 16 to 22 narrower sectors (at most 24) so the inner
line follows the square. `roadsOut` reads the bearings the town's roads leave by: each run of path tiles on a circle a
street past the square's corners is one road, at its middle. `roadReach` gives each sector a depth by how squarely it
faces one: a road's sector its whole depth, never less than a band; one a sixth of a turn off any road about none.

A road is a soft bar. It keeps the cells it crosses (`roadAcross` records where in each it runs, its bearings within a
turn), and the dressing's `onRoad` leaves unbuilt the plots it would cross, widened by 3 m, so houses line it either
side. An end is left ragged: past the first band each band may stop a sector, more often the further out. A town with
no road grows a thin, broken belt; a steep town grows little; a city that fills its pixel grows nothing.

## The ground

The terrain's vertices are 6.4 m apart, coarser than a street, so a pad is drawn and walked as its own paving or deck,
and the terrain sits under it. `settlementGround.js` `carveSettlementGround` holds the terrain under every cut pad
within `PAD_REACH` (one cell's diagonal), so no triangle rises through, and eases back to the land over `GROUND_EASE`
(28 m). A raised pad and a legacy pad ask nothing of the ground. A grown town's carve keeps its core and its town's own
ground (`keep`): a sample is kept when any of the four tiles round it is the town's.

The terrain worker lays the settlement out and the main thread dresses it. On a pixel no location holds and a published
settlement does, `settlementStand.js` `standSettlementGround` lays it out on the pixel's land with no road cut into it
(`bare`), so no network setting moves its plan, and carves it into the ground as it is. On a town's pixel
`standTownGrowth` does the same with the town's rect, its roads' tiles, camps and water. Each hands back its layout, its
trees' clearing and `moved`, what the carve moved each sample. `pixelBuild.js` puts it on the built entry.

### A record written before the carve

The carve moved the ground under saved records, so the record frame's law is 6 (`terrainSampler.js` `GROUND_FRAME_LAW`
and `PADS_FRAME_LAW`). A record written under an older law re-stands by the carve's move under it (`groundFrameHost.js`
`padsMovedAt`), and that move is always its pixel's build's own `moved` (`settlementMovedAt`): no other thread can lay a
town's outskirts as the kernel lays them, with its roads, camps and tiles.

A record that loads before its pixel is built stands without the move, and its pixel is owed
(`settlementOwed.js`: a published settlement's pixel, or a town's that grows). The save carries the debt (`padsOwed`, an
additive field), and a load hands its envelope to every re-stand, so a record the save owed re-stands by the carve
again, even under law 6. The pixel's first build pays it: `pixelBuild.js` rides every record on the pixel (the piles,
torches, camps, street foes and the watch, through `rideGround`) by the build's own move. With the Landforms row off,
a save of an older frame or one that owes a carve is still stood again.

## Standing in the world

`settlementModels.js` makes a dressed settlement into models. `groundModel` paves each cut pad at its height in its
style's ground, with a retaining wall down its rim, decks each raised pad on posts, and lays each link as a stair, ramp
or bridge. `buildingPiece` stands a building with the Imperial City fabric's mesher (`buildPlot`) in its style's walls,
roof and pitch, its door the fabric's door model turned to its street. `buildingInterior` is its rooms
(`fabricBuildingInterior`, filed under its place and key with a `cacheKey` of its own). `buildingRecord` is what its
door hands the game. Model ids run from `SETTLEMENT_MODEL_BASE` (7,600,000), 4,096 a run: a published row's run is its
ordinal, a grown town takes runs 16 to 511 in turn (`nextGrowthSlot`).

`settlementFeatures.js` `featuresModel` stands every feature but a tree as one model in its style's stone and timber,
each on the ground under it: a well (a kerb round water, two posts and a little roof), a fountain, a bronze statue on
its plinth facing the way in, a market's five stalls round its heart, a fort's walls along its rim (sunk 3 m and
crenellated) with round towers at their ends, a river town's docks out from its quay, a garden's fence round its plot
with planted beds, a field's rows and a fence's rails. The host draws it with the ground and files it in the same
collider bucket. Its id is the run's last (`featuresModelId`).

A settlement's yard trees are the pixel's own nature. `settlementTreeFlats` hands the kernel a tree record that every
climate's archive holds (`YARD_TREE_RECORDS`, 13 or 30) at each of the dressing's points (`yardTrees`), on its pad's
top. So the seasons, the wind, the low-poly trees and the axe treat it as they treat the woods around it.

`scenes/settlementHost.js` is the streaming world's pool, on the yards' shape. It dresses each built pixel's layout,
asks the pipeline for the meshes through a place hold, draws them at the pixel's translation, files the ground and the
buildings in one collider bucket (held back while feet stand inside a wall), and hands each door to the modes with its
record and its rooms (a `dfBlock` of its own, never a BLOCKS.BSA record). A pixel built again in place swaps its entry
with no frame between: the same plan files its yards on the new entry, and another plan is taken down and stood again.
Taking a settlement down lets go of its models, the model family's kept copies too (`forgetFamilyModel`), so a run's
ids come back built from the new plan.

A generated house is a home as a block's is: `homeCandidate` and `homePurchasable` take its record, `homeOnlinePrice`
prices it by its own ground and its town's size (`townBlocks`), and its door asks its town's homes when hovered. The
host files each house's yard frame on its pixel's `homeFrames` (`fileHomeFrames`). `pixelBuild.js` names a settlement
pixel's homes by its place and its province's region (`settlementHomeTown`, `settlementHomeRegion`). A listing's cell, a
yard's cell and the arena's all take a minted key without decoding a block from it. No quest stands in a generated
house.

The spawn law (`spawnGroundPlace.js` `spawnAt`) keeps a published settlement's pixel from the online dungeon roll, so
the Overworld and the ground never shape it for a dungeon that does not stand. `buildingDataForDoor` answers a
door with no location pixel by a copy of the record it carries. `tools/settlementWorldProbe.mjs` and
`tools/townGrowthProbe.mjs` jump to a settlement in the running game, shoot it and walk through a door.

## The published settlements

`settlements.json` publishes nine settlements, one in each province past the Bay: Corvel Keep (High Rock, a fort), Sahr
Waters (Hammerfell, an oasis), Kolvar's Cut (Skyrim, a mine), Velas Rest (Morrowind), Aleth Quay (Sumurset, a river town),
Thorn Canopy (Valenwood, on decks), Tasha's Bend (Elsweyr), Hatchwater (Black Marsh, on stilts) and Corrol Ford
(Cyrodiil, a village until Cyrodiil's rivers are water). `tools/settlementSites.mjs` searched each on the player's own
files: the province's land, no Arena town, capital, countryside place or lair on its pixel or beside it, and a fit that
is `ok`.

A row publishes its inputs alone, never its heights: the ground past the Bay is traced from the player's own map
picture, so each client lays the settlement out on its own ground. A row fixes the structure its ground chose (layout,
centre, the way its shore lies) and its key ledger, so every client lays the same cells. A published shore keeps its way
and reads its distance from the ground. `settlementPlaces.js` sets each row's pixel from its picture point under the fit
now; none stands on the Bay, and a location on the pixel always wins. Their map ids are their own lane,
`SETTLEMENT_LANE` (`0x342`). `tamrielPlacesHost.js` registers them after the places past the Bay.

## Publication and protected property

A door's room is keyed by its place and building key, so the plans ride the ground's law: `tools/groundPrint.mjs` reads
Sahr Waters' dressed plan and a grown village's (`Plans`), on a pixel the synthetic network's road crosses, and a change
that moves a door's key fails `fb1017f_groundgate.test.js` until `GROUND_LAW` moves. `GROUND_LAW` is 6 and the relay
`world304`: the relay refuses a ground room's hello from the old ground while `groundGate` is on, so the site deploys
before the relay.

Protected property blocks a plan. `settlementPublish.js` `protectedOfTown` reads a town's protected keys from the
account service's `/v1/homes/town` answer (every home's and hall's key). `revisionConflicts` checks a published row's
revision through its ledger. `protectedGone` names a grown town's protected minted key that its new plan no longer
holds, or holds for another anchor, kind, access or stand. `tools/settlementRevise.mjs` lays every published row and
every grown town a protected key names on the player's ground and exits 1 on a refusal or a row that no longer fits;
`--dump` and `--published` carry the plans across a generator change, and `--write` records the published ledgers.

## The editor's seam

`settlementEditor.js` is what the world editor asks. `editSettlementRow` changes a row's controls within `PARAM_BOUNDS`
(size, density, bands, sectors and the share left open) and fixes its structure (`ring` or `row`, a centre, a shore), or
refuses the patch whole. `regenerateDistrict` dresses one district from a seed of its own, and every other district keeps
its buildings, keys, kinds, access and heights. A service keeps the plot it was published on while that plot stands;
one whose plot is gone takes a plot drawn afresh (a new anchor, or one in a district drawn again) before another
district's house. `planDiff` names what was added, removed, moved and retyped.

## THE FOUR HOSTS

`scenes/world.js` WIRED: the host built, framed, drawn and dropped, its doors in `doorTargets`, its records answered by
`buildingDataForDoor`. `scenes/worldModes.js` WIRED through those two seams, with no line of its own: a settlement's
door opens its rooms as a block's door does. `scenes/exterior.js` FLAGGED: the fixed-city bench streams no pixel, so it
stands no settlement. `scenes/dungeonContext.js` FLAGGED: a dungeon stands no street.

## The whole of Tamriel

A plan is keyed by its place's map id from the registry, and its origin is bounded by `worldPixelOk`. Nothing reads
MAPS.BSA's rows. The generator has a style for every theatre. Every city, town and village grows, the Bay's and every
province's alike. The published settlements stand one in each province; the Bay's ground is left to DFU's places.
The pins hold cases past the Bay: Hammerfell's in the contract, the stand, the ledger, the publication and the editor;
High Rock, Skyrim, Valenwood and Hammerfell towns beside the Bay's in the growth; Daggerfall's city cloned under a
Hammerfell id in the corpus.

## Pins

`test/world/settlement/`: `rmbc1_contract.test.js`, `rmbc1_ids.test.js`, `rmbc1_legacy.test.js`,
`rmbc1_legacy_corpus.test.js` (on ARENA2), `rmbc2_contract.test.js`, `rmbc2_gen.test.js`, `rmbc3_exact.test.js`,
`rmbc3_ground.test.js`, `rmbc4_stand.test.js`, `rmbc6_growth.test.js`, `rmbc6_organic.test.js`, `rmbc7_publish.test.js`,
`rmbc8_homes.test.js` and `rmbc9_editor.test.js`; the spawn guard in `spawnworld.test.js`. Their mutants are
`tools/mutants/rmbc1.json` to `rmbc9.json`; `node tools/mutate.mjs tools/mutants/rmbc*.json` runs them.

## Not yet

- A third layout, a branching street tree, for a settlement of its own.
- Cyrodiil's rivers as water, so Corrol Ford can stand as a river town.
