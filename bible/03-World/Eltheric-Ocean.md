# The Eltheric Ocean - past the Veil (ETHER-SEA, ETHER-PLACES, ETHER-PORTS, ETHER-SHIPS, ETHER-LEGENDS, ETHER-CROSSING, ETHER-CHART, ETHER-LIGHT, 2026-10-11; ETHER-CHART2, ELTHERIC, ETHER-DEEP, ETHER-NODES, 2026-10-12; ETHER-OW, 2026-10-13)

The owner, 2026-10-11: *"A brand new open sea map that allows you to traverse to the etheric sea. Sail far enough and
you are prompted to travel into the open sea. The etheric sea is a infinite procedural oceanscape with procedural
islands with towns, dungeons, exotic resources, deadly legendary ships, and whatever more you can add to give meaning
to the etheric sea. This is all yours."* The Iliac Bay's own sea - its crews, its captain's standing, its spyglass, its
contracts, its exchange - is `03-World/Captains-Sea.md`; this page is the sea past the Veil.

The owner, 2026-10-12: *"Apparently the ocean is suppose to be eltheric not etheric. Additionally, the area below water
is very shallow and has no depth. We also need to implement gathering nodes within the area"* - three slices: its name
(ELTHERIC - it was "the Etheric Sea"), its depth (ETHER-DEEP) and the professions' nodes on its isles and in its water
(ETHER-NODES). The owner's words above keep their own spelling.

The owner, 2026-10-13: *"Also allow the player to zoom out into the overworld like in the Iliac Bay for easy travel.
Enemies should show on the world map just like in the bay"* - ETHER-OW: the Overworld (`06-Systems/Travel-View.md`)
risen past the Veil, its places the isles' and its enemies the Bay's own, seeded on the sea.

The pre-merge audit (AUDIT CAPTAIN'S SEA, the owner: "Lets do a comprehensive audit, enaure this is insanely detailed
and perfection. No exceptions") is `01-Overview/audits/Audit-Captains-Sea.md`: its fixes stand in the sections below, each
under its finding's id.

**THE PORT'S OWN.** Nothing in Daggerfall or DFU lies past the Bay's western water, and nothing here is transcribed.
Where the game has a law it is used: the ground is grown by DFU's own terrain kernel from the two bytes a pixel it
always reads (WOODS.WLD's height, CLIMATE.PAK's climate - answered here instead of read), the isles' towns and ruins
are the game's own places cloned (MAPS.BSA's rows, as the spawned dungeons clone theirs), a hold is still the DFU loot
tables' roll, gold is gold. The departure is Port-Ledger section A's ELTHERIC OCEAN row.

**THE SHAPE.** Sail far out on the open Abecean and the game asks whether to sail on into the open sea. Three days on,
the ship comes out off Veilhaven, the first port past the Veil - and from there the sea runs west for more than a
thousand leagues:

- **AN ENDLESS SEA, AND ITS DEPTHS** (ETHER-SEA): a box of the Bay's own pixel grid, 8,064 by 4,992 pixels (6,606 km
  by 4,089 km), far north of the continent; the deeper west of the Veil, the deadlier and the richer - the Shallows,
  the Reaches, the Deep Aether, the Abyss. Under its water, the Ocean's plain (ETHER-DEEP): a seabed two hundred metres
  down off every coast, carved and swum as the Bay's is.
- **ISLES** (ETHER-SEA, ETHER-PLACES, ETHER-PORTS): a lattice of isles grown off one hash, each a PORT (a town and a
  freeport's quay), a RUIN (a dungeon), a WILD isle (an Eltheric good on its strand) or a bare ROCK, named, in its own
  climate, on every client the same - and the day's trees, herb patches, veins and boulders on its land and the schools
  in its water, gathered as the Bay's are (ETHER-NODES).
- **ITS SHIPS AND ITS LEGENDS** (ETHER-SHIPS, ETHER-LEGENDS): corsairs and the isles' traders under the sea's own names,
  no crown's navy and no crown's law - and six legendary ships, each with her own haunt, her own terror and her own
  purse, who come back from the deep a month after they are sunk.
- **A REASON TO CROSS** (CAPT-TRADE's Eltheric goods, the strands, the legends' purses, the charts): ether-amber,
  starglass and voidsilk made on the isles and wanted in every port of the Bay; the Bay's goods wanted on the isles - and,
  ISLE-TRADE (2026-10-17, `03-World/Naval-Refit.md`), one good of the Bay made on each isle and sold there, so a captain
  can live and trade past the Veil from isle to isle.
- **A CHART OF ITS OWN** (ETHER-CHART): the travel map's door past the Veil opens the captain's chart of the isles
  charted, the depths, the Veil and the legends' haunts heard of.
- **THE OVERWORLD** (ETHER-OW): the chart's door up into the Overworld, as the held map's is in the Bay - the isles'
  ports and ruins plated and travelled to, the bands roaming the isles and the raiders sailing the open sea, marked as
  the Bay's are.

## The slices

| slice | what | modules |
|---|---|---|
| ETHER-SEA | THE SEA'S LAW: its box, the Veil, the depths and their bands; the isles' lattice, kinds, sizes, climates and names; the ground the kernel grows there, composed over the world's reader (the host's and the worker's), streamed, on the far ring | `world/ethericSea.js`, `world/streamingWorld.js` (`frames`), `world/terrain/terrainGenWorker.js`, `world/terrain/terrainGenClient.js`, `render/farRing.js` (`climatePast`, `pastOwn`), `world/landforms.js` (the climate past the table), `scenes/shared.js` (`etherSeaOn`, `etherCrossOutOn`), `scenes/world.js` (the composition, the region's name, the Overworld's water) |
| ETHER-PLACES | THE ISLES' PLACES: a port's town and a ruin's dungeon cloned off the game's own rows onto the isle's centre pixel under their own id, name and index; a ruin of the deep elite | `world/etherPlaces.js`, `scenes/world.js` (`_locationToBuild`, `etherPlaceAt`, the templates, the online wake) |
| ETHER-PORTS | A FREEPORT: a port isle is a port to the deeds, the harbour book (its quays), the naval host's waters, the exchange (the Eltheric goods made there, and ISLE-TRADE's one good of the Bay of its own) and its own harbourmaster's tab - the legends' rumours and a chart of its waters | `scenes/world.js` (`etherPortAt`, `etherPortNear`, `etherPortOf`, the port seams), `scenes/etherHost.js` (`office`, `chartOffer`, `buyChart`), `ui/naval/navalYardWindow.js` (`etherOfficeText`) |
| ETHER-SHIPS | ITS TRAFFIC AND ITS LAW: corsairs and traders by the band, under the sea's names and the Isles' colours; no navy, no relief, no crown's law; corsairs' papers; the strands' casks | `systems/naval/etherShips.js`, `systems/naval/navalDirector.js` (`ctx.ether`), `scenes/naval/navalHost.js` (`launch`, `chargeEther`, `etherCtx`, `pickStrand`), `scenes/etherHost.js` (`sites`, `gather`, `papers`), `systems/naval/shipKnowledge.js` (`coloursWords`) |
| ETHER-LEGENDS | SIX LEGENDARY SHIPS: their classes, haunts, terrors, purses; launched in their haunts, risen again a month after their end; the rumours | `systems/naval/etherShips.js`, `systems/naval/navalShips.js` (the six classes, `LEGEND_LEVEL`), `systems/naval/navalDirector.js` (`legendSpawn`), `scenes/naval/navalHost.js` (`legendMend`, `reachOf`), `scenes/etherHost.js` (`legendHere`, `legendEnded`, `rumours`) |
| ETHER-CROSSING | THE CROSSING: asked at a helm on the open Abecean and in the Veil, once each time the ship comes into those waters; the voyage carries the captain, the ship, her crew and her hold | `systems/naval/etherCrossing.js`, `scenes/world.js` (`etherCrossStep`, `etherCross`, `crossLandPx`) |
| ETHER-CHART | THE CHART OF THE ELTHERIC OCEAN: the travel map's door past the Veil | `ui/etherChartWindow.js`, `ui/naval/navalPlunderDoor.js` (its slot), `scenes/etherHost.js` (`chart`), `scenes/world.js` (`openEtherChart`) |
| ETHER-CHART2 | THE CHART READ AT A GLANCE: its words in the enhanced face and drawn last; a shape for each kind's mark; the depths as waters, a grid and a scale; the haunts washed and named in view; the ship ringed and pointed to; the isle named ringed, its bearing and its card; a key | `ui/etherChartWindow.js` (`chartModel`, `paintChart`, `scaleBar`, `labelBoxes`, `edgePointer`) |
| ETHER-LIGHT | THE LIGHT PAST THE VEIL: cold and violet on land, sea and hulls | `world/ethericSea.js` (`etherLight`), `scenes/world.js` (the frame's lights) |
| ELTHERIC | THE SEA'S NAME: the Eltheric Ocean, one word's home for every word a player reads of it | `world/ethericSea.js` (`ETHER_WORD`, `ETHER_SEA_NAME`, `ETHER_SEA_TITLE`), `world/etherPlaces.js` (`ETHER_REGION_NAME`), `ui/etherChartWindow.js`, `ui/naval/navalYardWindow.js`, `scenes/etherHost.js`, `scenes/world.js`, `systems/naval/captainLedger.js`, `systems/naval/etherCrossing.js` |
| ETHER-DEEP | ITS DEPTH: Iliac Puddle No More's bake over the sea's own frame - its floor carved, swum and walked as the Bay's; the pits held to the Bay | `world/etherWatersBake.js`, `world/deepWater/deepWatersBake.js` (the frame, the flood, the raw reader's own bytes), `world/deepWater/deepWaterTileData.js` (the frame's clamps), `world/deepWater/deepWatersClient.js`, `world/deepWater/deepWatersWorker.js`, `scenes/deepWater/deepWatersHost.js` (the one gate, the frame's climates), `scenes/oceanHolesHost.js` (the hold), `scenes/world.js` (the places' rects, the near promote) |
| ETHER-NODES | ITS NODES: the nodes' law knows the sea's ground - an isle's node, a haul and a pixel's witnesses taken by the service as the Bay's | `net/nodeLaw.js` (`pixelOk`, the ids' spelling) - both ends |
| ETHER-OW | THE OVERWORLD PAST THE VEIL: the chart's Overworld door; an isle's place the view's own (plated, at the edge, TV6's); the governor's ground the stream's; the bands and the raiders seeded on the sea, their chases heard; a raider stood there the sea's own corsair | `ui/etherChartWindow.js` (the door), `scenes/travelView.js` (`TRAVEL_VIEW_BUTTON`), `world/ethericSea.js` (`onBayOrEther`), `world/etherPlaces.js` (`etherPlaceIsle`, `etherPlaceRows`), `scenes/world.js` (`openEtherChart`, `etherPlaceClone`, `tvEtherPlace`, `tvPlaceSummary`, `travelViewFarPlaces`, `tvDungeonRowsAt`, the governor, `bandOk`, `tvRaidOpen`, `tvRaidSea`), `systems/travel/travelBands.js` (`chaserPlaceOk`), `scenes/naval/navalHost.js` (`raiders`) |
| (the ledger) | WHAT A CAPTAIN KEEPS OF IT: the isles charted, the legends ended and heard of, the strands gathered, the way out, the crossings - in the Captain save | `systems/naval/captainLedger.js` (`ether`, `chartIsle`, `endLegend`, `gathered`, `setCrossedFrom`, `crossed`, `hearLegend`), `scenes/etherHost.js` |

THE FOUR HOSTS (Home.md; AUDIT CAPTAIN'S SEA H12 - the slices named none): the sea, its ships, the crossing, the chart
and the light are `scenes/world.js`'s - the streaming exterior's, where the sea is. `scenes/exterior.js` (the bench)
stands no sea: FLAGGED, nothing wired. `scenes/worldModes.js` (an isle town's buildings) is wired where an isle's place
reaches it - its houses never for sale nor owned by a Betony deed (`houseOwnedAt`, `currentHousesForSale` - P9) - and
otherwise FLAGGED. `scenes/dungeonContext.js` (an isle ruin's halls) builds the cloned dungeon as any spawn's, its elite
foes its own (`elite`): wired; the light is the exterior's alone there - FLAGGED.

## ETHER-SEA - where it lies, and what grows there

**THE BOX** (`ETHER_BOX`): pixels x 64 up to 8,128, y -7,680 up to -2,688, on the Bay's own grid (819.2 m a pixel - one
offset from the Bay, no scale, as Tamriel's frame). Three readings fixed it:

1. **The wire's world.** A pose's x and z travel as world units within `POSE_BOUND` (net/wire.js, 8,192 pixels' worth);
   a pose's z is (499 - y) pixels, so y must stay over -7,693 for a player there to be seen online. The box's
   southernmost row is -2,689 and its northernmost -7,680.
2. **Positive world units.** `worldCoordToMapPixel` truncates (world/streamingWorld.js); x and z are positive across
   the whole box (x from 64 pixels; z, 499 - y, from 3,188).
3. **Clear of the continent.** Tamriel's frame ends at y = -(picture row 76 at x21) = -1,596 at the farthest north any
   fit the probe allows reaches (TAMRIEL3's: row 52 and 24 either way, scales 15 to 21) - a thousand pixels and more
   south of the box. Nothing of the Bay or the continent is in sight of the sea, and nothing of the sea of them.

The law answers its open sea ETHER_MARGIN (64) pixels round the box too: the far ring's whole reach from a ship in the
box - RING_RADIUS (48), its rebuild's drift (RING_REBUILD_DRIFT, 12), a normal's neighbour (1) and its cliffs' fade
(landforms.js CLIFF_REACH, 3) - so neither the kernel's windows at its edge nor the ring ever read the world's other
ground (AUDIT CAPTAIN'S SEA G1/G10: at 4 the ring at the Veil drew the Bay's clamped row-0 mountains). Past the box
nothing streams: the world's edge, a thousand leagues out.

**THE VEIL AND THE DEPTHS.** The box's eastmost VEIL_PX (16) pixels are THE VEIL (`inVeil`) - the way home. DEPTH is
leagues west of it (`etherDepthAt`; a league LEAGUE_M, 4,828 m, the log's own - captainLedger.js re-exports it from here,
one home), and its BANDS are the sea's law:

| band | from | a cell's isle | ports / wild / ruins / rocks | peaks lifted | the ships' levels up | holds' tiers up | corsairs' weight |
|---|---|---|---|---|---|---|---|
| the Shallows | 0 leagues | 0.50 | 30 / 30 / 14 / 26 | 0 | +1 | +1 | x1 |
| the Reaches | 12 | 0.48 | 18 / 32 / 25 / 25 | +20% | +3 | +2 | x1.6 |
| the Deep Aether | 45 | 0.42 | 11 / 32 / 33 / 24 | +45% | +6 | +3 | x2.4 |
| the Abyss | 140 | 0.36 | 6 / 32 / 40 / 22 | +70% | +9 | +4 | x3.4 |

At the helm's fastest dial (Come Sail Away's x30, a galleon making 6 m/s) the Reaches are two minutes from
Veilhaven, the Deep a quarter of an hour, the Abyss an hour; online, where time at sea keeps the world's pace, the
Reaches are an hour's sail.

**THE ISLES** (`isleOfCell`): the box is a lattice of ISLE_CELL_PX (10) cells, 806 by 499. A cell holds an isle on its
band's chance of its own hash (`etherHash` - FNV-1a, finished, under ETHER_SALT; `etherRng` the mulberry32 step), its
kind drawn by the band's weights, its radius and peak in its kind's ranges (`ISLE_KINDS`):

| kind | radius (pixels) | peak (bytes, 8 m) | fall | climates |
|---|---|---|---|---|
| port | 0.9 - 1.1 | 10 - 15 (never lifted: a town a short climb from the water) | 1 | Subtropical, Woodlands, Rainforest |
| ruin | 1.4 - 2.4 | 15 - 34 | 1.5 | Mountain, Haunted Woodlands, Swamp, Desert |
| wild | 1.0 - 2.8 | 10 - 40 | 1.5 | Rainforest, Subtropical, Swamp, Desert2, Mountain Woods |
| rock | 0.6 - 1.1 | 8 - 18 | 1.5 | Mountain, Desert |

Its centre is jittered where its land and the kernel's pixel past it stay inside its cell (`margin` the radius's
ceiling and one), so ONE CELL ANSWERS ANY PIXEL: the ground's read never searches. A PORT ISLE is small and stands on its
town's pixel (`landCentre` - its land centred on the pixel a town's blocks stand in, `lx`, `ly`; the kernel takes a
pixel's byte as its south-east corner): the town whole on dry ground and its shore within ETHER_PORT_SHORE_M (900 m), so
the harbour book sounds a harbour there within ETHER_HARBOUR_REACH (900 m - `shipLife.js findHarbour`'s `reach`; AUDIT
CAPTAIN'S SEA H1/P2: an isle of two kilometres had its shore past the 420 m every Bay harbour is sounded within, and no
port past the Veil had a quay - a sample of 160 ports has every one its harbour now). A wild isle bears one of the
Eltheric goods (`ETHER_GOODS`, the exchange's three - pinned equal). No isle stands in the box's edge cells, nor in any
cell east of Veilhaven's: the Veil's still water, the landfall's way clear. **VEILHAVEN** (`veilhaven`, VEILHAVEN_CELL
(800, 249), four cells west of the Veil on the box's middle row, its centre pixel VEILHAVEN_AT (4, 5) in it - (8068,
-5185), where the crossing has always made its landfall beside it) is always a port: radius 1, peak 12, Subtropical. The
isles are cached a cell (ISLE_CACHE_MAX 65,536, dropped whole).

**THE NAMES** (`isleName`): a head (40), a middle on half of them (12), a tail (30) - some sixteen thousand roots - and
the kind's forms: a port Port X / X-haven / X Landing / X's Anchorage / X-mouth; a wild isle X / X Isle / the Isle of X /
the Adjective Isle; a ruin always its root (the automap keys on a place's name): the Isle of X / X's Grave / Old X / the
Tomb of X; a rock the Adjective Stack / X Teeth. Ours; no table of the game's.

**THE GROUND.** `etherHeightByte`: 0 at sea; an isle's peak at its centre falling to its rim as (1 - t^2) to its kind's
`fall`, a lattice hash of +-HEIGHT_NOISE (2) on its land. `etherLargeMap`: the large map's 5 x 5 - 0..9 on land, 0..1 at
sea (the kernel lifts an open sea's larger bytes out of the water: a byte of 0 under large-map detail of 6 put 2% of a
tile over the sea level, measured through the kernel; 0..1 none). `etherClimateAt`: the isle's out to CLIMATE_REACH_PX
(1.5) past its rim, from its land's own centre (`lx`, `ly`) - the kernel's window carries an isle's land a pixel east and
south of its bytes, and that pixel must wear the isle's textures - the Ocean's else. The Landforms' lands read the same
climates past the Bay's table (`landforms.js` - G3: every isle's hills were shaped by the Bay's clamped corner pixel,
999, 0). Through the kernel (measured, `test/world/ethersea.test.js`): every port and ruin
stands on a dry plateau (a place can stand there), Veilhaven's own pixel is all land, its landfall's pixel
(LANDFALL_OFF_PX 4 east) all water, an empty cell's middle all water.

**THE COMPOSITION** (`etherWoods`, `etherClimateIndex`, `etherPoliticIndex`): a prototype child of the reader it is
handed - TAMRIEL2's `groundWoods` over the Bay's, or the Bay's alone - overriding the two reads WoodsFile builds its range
reads on, so the kernel's every read answers the sea inside the law's box and the reader's own to the byte outside it.
The world host composes it between the boot's repairs and the terrain client (after TAMRIEL2's), and the climate and
the politic beside it; the client tells the worker (`ether` on its init, off the reader's `isEtherGround`) and the
worker composes its own copy - its graph still world/ and formats/ alone (`ethericSea.js` imports formats/ only). The
stream's `frames` (`StreamingWorldState.frames`) carry the box apart from the continent's `frame`, which the picture's
fit resets as it lands; the far ring is handed the composed bytes past the map (with the continent off too) and, new,
`climatePast` - the clamp read the Bay's edge's climate there, and an isle stood in it: the continent's wherever it
stands, the sea's inside its law, the Bay edge's clamp else (G4/G9: with the continent off the Bay's edge's ring turned
green), its cliffs faded at their own pixels (`pastOwn` - G6). The Overworld's travel view reads an isle's land as land
and the open sea's as water (`tvWater`, `tvSceneOf` - G5: every isle read water with the continent off).

**THE REGION.** Past the map POLITIC.PAK answers -1, which MapsFile clamps to the Alik'r Desert. The sea answers
Betony's politic (ETHER_REGION 19 and 128): its people's names, its prices, its law and the far places its quests send
a captain to are Betony's - the Bay's westernmost isle with places of its own (the Bay's "Islands in the Western Iliac
Bay", region 12, hold none: a quest's far place there would be nowhere). The loading screen and the Overworld's line
say "the Eltheric Ocean". The world's events that walk a province (Raiding Parties) find none past the Veil (G7: Betony's
raids were announced to a captain at sea), and World of Daggerfall's pick never scans the sea's pixels (G8).

**THE SWITCH** (`etherSeaOn`, `etherCrossOutOn` - AUDIT CAPTAIN'S SEA G2/P7, THE SWITCH SPLIT): the SEA stands in every
game - its ground, its places, its ships and the way home through the Veil - so a save past the Veil loads under any
skin (it threw on load under the classic skin) and sails home; the CROSSING OUT is the enhanced skin's and online's.
`?ether=off` the kill door: the sea gone, a save made past the Veil lands at the way home - the waters of the last
crossing out, else the open Abecean - and a pixel past the map at the Bay's nearest, each said once it stands
(`_streamedLanding`, `_unstreamedLanding`; the load threw on it before).
No Features row: the crossing is the player's own choice each time it is asked.

## ETHER-PLACES - the isles' towns and ruins

A port isle's and a ruin isle's centre pixel stands a PLACE (`synthesizeEtherLocation`): a NON-MUTATING clone of one of
the game's own places (the spawned dungeons' law, `world/spawnedDungeons.js`), with

- **its id**: ETHER_PLACE_SALT (0xE7) in the high 12 bits - apart from the spawns' 1, the zone halls' 7, the Ocean
  Holes' 0x600 and the Abyss Dungeons' 2049 and up - and ETHER_PLACE_BASE (500,000) plus the cell's own number in the
  low 20: past getMapPixelID's ceiling, so no place of the sea shares an id (a discovery, a dungeon's room, a save's
  key) with one of the Bay. The map row's, the exterior's and the dungeon header's ids are all it.
- **its location index**: its own negative (-(1000 + the cell's number)) - the questors' pool keys on it (two places
  sharing a spawn's -1 kept the first one's pool) and the layout pins' location key stays apart from every real one.
- **its name**: the isle's; its region ETHER_REGION's index, politic and name - its region's own, Betony's (AUDIT
  CAPTAIN'S SEA P8: "the Eltheric Isles" named no region, and a guild's local job threw on its first tick; the quests
  find an isle's place in the index it stands in); its climate the isle's (`getWorldClimateSettings`); its longitude and
  latitude its pixel's (MapsFile's own law round-trips any integer pixel); its exterior's map id and its record's header
  id its own (P12).
- a port's exterior answers a harbour by its kind (`portTownAndUnknown`: a port's 1, a ruin's 0 - P10: a ruin kept its
  template's port byte); a ruin in the Deep Aether or the Abyss is ELITE (ELITE_BANDS - dungeonContext.js's three foes
  a marker, each twice as hard).
- never `spawned`: no clock, no expiry, no nearby announcement - an isle's place stands for ever - and never a spawn's
  template (`!l.ether` - P3: a session that stood ruins past the Veil first cloned other templates than its party).
- its houses no deed's: never for sale, never owned by a house of the same key in Betony (`houseOwnedAt` - P9).

**THE TEMPLATES** (`etherTemplates`, kept at boot off the classic rows - HUB1's law, the game's own rows as MAPS.BSA
holds them, so a client's town pack never moves what an isle stands; read before the rows are let go): towns -
hamlets and villages of TOWN_BLOCKS.port (2 - 6) blocks; havens (Veilhaven's) - hamlets and villages of
TOWN_BLOCKS.haven (6 - 12: AUDIT CAPTAIN'S SEA P1 - MAPS.BSA's villages are 2 or 4 blocks and its cities 30 and more,
and the "villages and cities of 6 - 16" the list read was always empty, Veilhaven a 2 x 2 village); neither a
main-story place nor one with a dungeon under it, never a spawn nor an isle's own; ruins - dungeons with blocks and an
exterior, one block where any is. Each list in map-id order; an isle's pick off its own hash (`etherTemplateOf`).

**THE BUILD** (`scenes/world.js`): `_locationToBuild` answers an Eltheric pixel from `etherPlaceAt` alone - the place
the isle's centre stands, stood in the location index once (a building's door, a quest's local site and a save's
records read it there), or nothing. The Overworld's far reads never clone a spawn past the Veil (`tvLocationAt` -
spawnedMapId's law is the Bay's and throws there). Saved inside a ruin, offline the load rebuilds the pixel and the
same place stands (its door matched by its header's id); online - where a load never puts a character back inside a
dungeon - the sleeper wakes at the ruin's own door (the region's search would read the Alik'r's past the map). A death
past the Veil rises at the nearest port isle's town (`etherRisePort`, ETHER_RISE_PX - P4: Betony's temple a crossing
away), and no cemetery of the Bay's takes a vampire there. No teleport crosses the Veil - Recall, a portal stone, the
Mages Guild's, a party's travel to its leader are refused across it (`veilRefused` - P6) - nor does the Fleet: no
Summon to the far side, no Send away from it, a ship laid up keeping her side (`veilApart` - P5).

## ETHER-PORTS - the freeports

A port isle answers as a port everywhere the Bay's ports are asked (`etherPortAt`: the isle's centre pixel;
`etherPortNear`: within a pixel): Come Sail Away's deeds and placing (`csaIsPortTown`), the naval host's waters
(`navalNearPort`, `navalPortHere` - `{ key, name, px, py, region, crown: null, ether: true }`), and the HARBOUR BOOK
(`navalHarbourNear` - its town's rectangle, the harbour sounded off the terrain as any port's, its quays laid by
QUAYS' law). No crown's: the harbour office's crown's tab stands none there, and THE FREEPORT'S HARBOURMASTER
(`etherHost.office`, `ui/naval/navalYardWindow.js etherOfficeText`) is the tab instead - the port's waters, every legend's
rumour as the quay's talk (each legend then on the captain's chart - `hearLegend`), and a chart of its waters for sale:
every isle within CHART_BUY_PX (40) charted, at CHART_BUY_PRICE 150 gold and 75 a band deeper. THE EXCHANGE is
CAPT-TRADE's own: an Eltheric port makes the three Eltheric goods (cheap, a day's stock of 30) and, ISLE-TRADE
(2026-10-17, `03-World/Naval-Refit.md`), one good of the Bay of its own off its key (`tradeGoods.js isleGood`), sold as
made, and wants every other good of the Bay at EXOTIC_K - and every port of the Bay wants the Eltheric goods at EXOTIC_K. A crown's favours (the yard's
discount, the hands') are none past the Veil (`waters` answers no crown there). A freeport's quay moors the isles'
traders - never a Bay crown's navy (D4).

## ETHER-SHIPS - the sea's traffic, and no crown's law

**WHO SAILS** (`navalDirector.js`, `ctx.ether`): corsairs (the pirates' classes) and the isles' traders (the
merchantmen's) by the band's weights (`etherFactionWeights`: 30 times the band's `pirate`, 45; a port's waters
ETHER_PORT_WEIGHTS - traders 30 more, corsairs halved); every class the band's `level` levels over the captain's own; a
pair already at it only a corsair on a trader; no relief, no hunters - no crown's navy sails past the Veil. Every spec
carries `ether` (its band), and a ship launched there - or another's met there - wears the sea's names
(`etherShipNames`: ETHER_PIRATE_NAMES and ETHER_MERCHANT_NAMES, two words of each trade's own - 256 a trade, AUDIT
CAPTAIN'S SEA D20: sixteen moored two ships of one harbour under one name - on their own stream, her captain the Bay's
own law's) and colours (`etherFlagOf`: a trader the Isles' - "the Isles' merchant colours" through the glass - a corsair
the black flag; a corsair under false colours the Isles' too, D5), and a corsair the band's boldness (30%, 45%, 60%,
80%). Every hold there is the band's `tier` tiers richer
(`etherTier`) and every cask the deep's (CAPT-WATERS' DEEP_TIER).

**NO CROWN'S LAW** (`chargeEther`): a ship of the sea ended - fired on, sunk, taken - is no crime, no notoriety, no
crown's regard; the log keeps her by her trade ('ether'), and a contract's end event says no crown. A prize taken
there answers to no crown: burning her papers washes no notoriety of the Bay's ("No one hunts you in these waters" - D3:
the nearest Bay capital's waters were read for her). A corsair's papers
hold a chart of her waters on PAPERS_CHANCE (a quarter) of her seed's own stream: every isle within PAPERS_PX (30)
charted (`etherHost.papers`).

**THE STRANDS** (`etherHost.sites`, `gather`; the naval host's sites): a wild isle within HARVEST_REACH_PX (1) of the
ship is a site of kind `strand` - "Your boat pulls in to the strand and back out with its haul" - and HARVEST_CASKS (3)
casks float out alongside her: STRAND_ALONGSIDE_M (40 m) off the boat that pulled in, on open water, each cask on open
water (`alongsidePos` - AUDIT CAPTAIN'S SEA D2: they went 700 m off on no bearing of the isle's, some on its beach),
never again while they float (D1: each return to its reach floated three more), each STRAND_YIELD of the isle's good by
its band (2, 3, 4, 6); hauled (`pickStrand`), into the hold of the boat that sailed through it - a swimmer breaks his
open in the water, into his pack. A strand is bare HARVEST_DAYS (7) from the first cask hauled (a later cask never
pushes it on - D1).

## ETHER-LEGENDS - six legendary ships

| legend | captain | class (hull) | band | terror (`trait`) | purse |
|---|---|---|---|---|---|
| Sorrow's Wake | Ysolde the Unmourned | Legendary Brigantine (Small Ship): hull x1.8, 9.4 m/s - the swiftest hull afloat | the Reaches | swift | 2,500 |
| The Drowned Queen | Maraveth, Thrice Drowned | Legendary Carrack: hull x2.4 | the Reaches | mends - LEGEND_MEND_PER_S (0.4%) of her hull a second while no ball has struck her for LEGEND_MEND_QUIET_S (8 s), her fires out first | 3,000 |
| Ninefold Hunger | Ghorvak Ninefold | Legendary War Galley: 120 hands, 45 boarders | the Deep Aether | boarders - her first wave thrown back, half her hands come over the rail again (`winBoarding` - AUDIT CAPTAIN'S SEA D10: clamped like any flagship's, the terror did nothing) | 5,000 |
| The Lantern-Eater | the Hooded Pilot | Legendary Brigantine: hull x2, skill 0.9 | the Deep Aether | night - abroad between dusk and dawn alone: day come, she sails out of the world once no fight holds her (D17) | 5,500 |
| The Pale Regent | Lord Aumbrel the Pale | Legendary Carrack: hull x3.2, skill 0.95 | the Abyss | gunnery - her guns load in LEGEND_RELOAD_K (0.7) of a carrack's time (`createSeaShip`'s `reloadScale` - D11: the constant had no reader) | 9,000 |
| The Starless | no one living | Legendary Carrack: hull x3.6 | the Abyss | veiled - made out at LEGEND_VEIL_K (0.35) of every reach: the eye's, the lookout's and his hail's (D13), the glass's | 12,000 |

**THEIR CLASSES** are navalShips.js's own, after the nine (`legend: true`, a pirate's faction, never a flagship, no
weight, `minLevel` LEGEND_LEVEL 999): no draw by level ever finds one - `classFor`, the encounters, the board's
bounties, the raiders - and no hull's fighting range (`rangeOfHull`) moves. The wire carries them as any class.

**THEIR HAUNTS** (`hauntOf`, off each legend's own hash): a reach of HAUNT_PX (36) pixels about a centre in her band's
depths (HAUNT_PX inside its bounds; the Abyss's ABYSS_HAUNT_LEAGUES 120 deep), within HAUNT_SPREAD of Veilhaven's row
(60, 160, 320 pixels by band). Sailing her haunt (`legendAt`), while she sails (`legendSails`: never ended, or ended
LEGEND_RISE_DAYS - 30 - ago: the aether raises her) and is abroad (`legendAbroad`), a roll of the sea's traffic launches
her on LEGEND_CHANCE (0.3) of her own LEGEND_SALT stream - before anything else the roll would launch, on the spawn ring
with her bow on the captain - bold, said: "The sea goes still. A sail on the horizon: ...", to every captain whose sea
she comes into, a party's other captain too, once while she is in it (D12). ONE LEGEND AT SEA: never while any legend
sails in the sea - at any range, any stander's (`ctx.legends` - AUDIT CAPTAIN'S SEA D7/D14: two captains apart in her
haunt each launched her, and the Wake's and the Queen's haunts overlap) - and never by a freeport's quay (SEA-EASE's
`nearPort`); two standers' copies of her met, the stander law's claim holds her (`claimBeats`): the lower id's stands,
the other sails out of the world. Where two haunts reach a pixel, the nearer's (`legendAt` - H7). Her glass card's lore
is her own.

**HER END** (sunk or taken): every crown hears of it (the ledger's LEGEND_STANDING, 10 with each, the first time she is
ended), her name in the log, her purse paid (`legendEnded` - only while she sails by this captain's own ledger: D6,
another's copy of her paid it again and pushed her rise back), her day kept (she rises again a month on), and her hold
the richest at sea: her class's cargo 4, the band's tiers, and her last LEGEND_STRONGBOXES (2) lots her captain's
strongboxes (`navalPlunder.js strongboxesOf` - D15: a flagship's one beat her plunder).

**THE RUMOURS** (`rumourOf`, a freeport's harbourmaster; the way one of sixteen points, `compassPoint` - the chart's own): "The Drowned Queen has been seen some 40 leagues
west-south-west of here." (one league "a league", under half of one "hereabouts" - G12/D21; the Lantern-Eater "By
night."); ended: "...went down 3 days ago; they say the aether will raise her again."

## ETHER-CROSSING - the way out and the way home

**ASKED** (`etherCrossStep`, every CROSS_CHECK_S - half a second) at a helm in the exterior with no window up, never
while the world is being moved or a party's arrival waits (X3): OUT in the crossing waters - the enhanced skin's and
online's alone (`etherOut`) - (`crossingWaters`: west of CROSS_X - 230, west of the Bay's mouth (X4) - and
CROSS_LAND_PX - 20 - pixels and more from any land, measured by the map's one water law, `crossLandPx`, asked once a
pixel; never in the sea's box; past the Bay's west edge the Eltheric counts), HOME in the Veil (`crossingWayAt`) under
any skin. A way is asked ONCE each time the ship comes into its waters (`createCrossingGate`) - marked asked when the box
shows (X1: a refusal marked it, and it never came): refused, it is not asked again until she has left them. An enemy
near or another player aboard is said instead, once while she stays in those waters ("Not with an enemy at your
heels." / "Passengers can't cross the Veil..."), and the question asked as soon as the deck is clear. YES IS THE
QUESTION AS IT STANDS NOW (`crossYes` - X2): a load, another helm, the waters left, an enemy or a passenger since - said,
no voyage, asked afresh (CROSS_STALE); the box is taken back at a load or a jump (`withdrawCrossing`), and a way out
kept is never one in the sea (`captainLedger.js wayOutOf`).

**SAILED** (`etherCross`): the way out remembered (the ledger's `setCrossedFrom` - the Bay's pixel she sets sail from);
the screen black; the helm let go - she lies where she is; the jump - a travel (`modEvent: 'travel'`: the seasons'
post-travel step, the Overworld's) of CROSS_DAYS (3) to the landfall (`crossingTarget`: out, open water
LANDFALL_OFF_PX east of Veilhaven, her bow west on it; home, the waters she set sail from, else HOME_WATERS - the open
Abecean off the Bay's mouth, pixel 180, 300) whose arrival brings her round onto the landfall pixel's middle where she
floats (`RepositionBoat` - her crew, her hold and every rank of her hands aboard her) and stands the captain on her
deck; the days on the clock; her helm taken again; the crossing counted; out, Veilhaven charted; home, the gate left
asked (she comes out in crossing waters, and is not asked out again at once). Come Sail Away is held paused while she
is carried across (`_etherCrossing`, as a party's arrival holds it). A voyage that cannot be made brings ship and
captain back where they set out, at her helm, the way out as it was (CROSS_FAILED - X9: her helm was let go).

## ETHER-CHART - the chart of the Eltheric Ocean

Past the Veil the travel map's door (`toggleTravelMap`) opens the captain's chart (`ui/etherChartWindow.js`, the naval
windows' door's third slot) - the Bay's travel map has no sea there to show, and nothing on the chart is travelled to:
its Overworld door is the way to travel (ETHER-OW).
On a canvas: the sea, each depth its own water (ETHER-CHART2); the BANDS' bounds, and each band's water named in its
own water on the depth ruler over the chart, the Shallows by the Veil (X12; AUDIT ETHER-CHART2 U2); THE VEIL down the
east edge, "to the Iliac Bay" on the ruler; the HAUNTS of the legends heard of (the square a haunt is - X13 - red while
she sails, hatched grey while she lies sunk); the ISLES CHARTED (a port gold, a ruin red, a wild isle green, a rock grey
- a port named at any zoom, the rest from x8, never a name lettered over another, ports first: LABEL_H, each name as
wide as its face draws it - LABEL_CHAR_PX where no canvas measures - X14); the SHIP and her heading at her helm (the
boat's, never where the captain looks - X16). Zooms x1 - x16 (CHART_ZOOMS): the wheel about the pointer, a step each CHART_WHEEL_STEP of its travel (X18);
+ and - (the keys and the chart's own buttons) about the centre (`chartZoomAt` keeps the point under it - H17); a
pinch of CHART_PINCH_STEP.
A drag or the arrows to pan (`clampChartView` keeps the view over the sea), the drag ended however its press ends (X7);
C or the Ship button back to the ship; the key that opened it (Travel Map's or Automap's binding) or the back key to
close (X8); a pointer on an isle, or a tap of under CHART_TAP_PX, says it: "Port Pelleveth - a port - 12 leagues
west-north-west", a name opening the line raised (X17) - X6: a finger and a pad had no zoom and no note. A load or a
jump shuts it (X15). The header: isles charted, the deepest a captain has gone, the crossings, the legends ended.

**CHARTING** (`etherHost.sight`, the world's office tick, every 2 s in the sea's exterior): every isle within SIGHT_PX
(3) of the ship's pixel is charted the first time ("Land ho! Port Pelleveth - a port. It is on your charts."; Veilhaven,
the landfall, is charted at the crossing itself - H19) and counted in the log's `islands`; the deepest a captain has
gone is the log's `deepest`. A freeport's chart and a corsair's papers chart more - a freeport's never past the charts'
room, ETHER_CHARTED_MAX (X5: the gold was taken for nothing); a harbourmaster's rumours are heard (their haunts charted)
where his tab is shown (X11). The helm's plate says "The Veil" in the Veil itself (D19).

## ETHER-CHART2 - the chart read at a glance

The owner, 2026-10-12: *"I want to improve the [Eltheric] sea map, its icons, the highlight areas, etc and improve
readability."* Read in Chromium before the change (`ui/etherChartWindow.js` mounted alone, a captain's word of a hundred
isles charted and three legends heard of, at every zoom and a phone's width - the window needs no game data), the chart
had six faults, and each is fixed where it starts. Its audit (`01-Overview/audits/Audit-Ether-Chart2.md`, the owner: "Audit and
ensure absolute perfection and detail") changed what follows where it is marked with its finding's id.

- **ITS WORDS WERE IN A FACE NO ONE LOADS.** The canvas named "Cormorant Garamond"; the skin's one request carries
  Cormorant (`FONT_DISPLAY`), so every name on the chart was the browser's Georgia - and FONT1's law is that every
  enhanced surface speaks the enhanced face (the chart is chrome in the naval sheet, which wears the pixel trio, not
  lettering on an inked sheet as the held map's ink is). The chart letters in the pixel stack at FONT3's reading pair
  (`CHART_FONT`, weight 500, `CHART_TRACKING` half a pixel), and paints itself again when the face lands (heldMap.js's
  law for its ink) and whenever a face lands while it is open (U10: a window opened before the fonts' stylesheet came
  had nothing to load and nothing pending, so `load` and `ready` answered at once and it kept the fallback face). A
  name's width is the canvas's own measure, in the face and the tracking it is painted in (T3); where no canvas
  measures (node) a letter is LABEL_CHAR_PX, 6.7 - the mean letter, name by name, of the 755 isles within 200 pixels
  west of Veilhaven, measured in Chromium (6.689; letter by letter 6.642 - D11). `tools/etherChartProbe.mjs` measures
  both, and fails if the constant is not the first rounded.
- **A MARK CROSSED OUT A NAME.** Each isle drew its disc and then its name, so a later disc painted over the names
  before it (at x8 a rock's disc, Halanth Teeth's, stood in the middle of "Old Nymuond" - D5). The words are painted
  after every mark now (`paintChart`, back to front: the void past the world's edge, the depths and the grid, the Veil
  and the bounds, the world's edge, the haunts, the lands, the bearing, the marks, the ship - then the haunts' plates
  and lone names, the isles' names, the ship's pointer and its words, the card), each isle's name under a hard halo,
  never a blur, the rest on plates (D4). A name tries its isle's east side, then its west (`labelBoxes`); of the sides
  clear of every name already laid it takes the first on the chart and clear of the ship's ring and every other isle's
  mark, else the first on the chart (C7: Aelishaven's was cut to its "A" with its other side free), else the first. The
  names are laid IN LAYERS: the ports' (X14's law kept whole - a port weighs only the ports' marks, so a lesser isle
  never moves a port's name, and a port goes unlettered only where both its sides stand under ports' names); the
  haunts'; the ship's pointer's words; the lesser isles', which never stand over any of them (C4). With two sides, every
  port within 40 pixels of Veilhaven - X14's old crowded view - is lettered at x2, so that view is x1's now (D2).
- **A RUIN AND A WILD ISLE WERE TOLD APART BY RED AND GREEN ALONE** - the pair a red-green eye cannot tell (measured:
  under deuteranopia the two colours fall to 1.36:1). Each kind's MARK is a shape too (`paintMark`): a port round with
  its harbour's dot, a ruin a diamond, a wild isle a peak, a rock a cross - in its kind's colour (`KIND_COLOURS`, lifted
  to read on the depths' water: every mark 3:1 or more on every band's), outlined in ink, its half side by the zoom
  (`ICON_PX`, a port's one more). Once an isle's own land outgrows its mark it is drawn too, at the chart's scale, under
  the mark. Veilhaven, the landfall, is ringed in gold.
- **THE DEPTHS WERE A LINE AND A WORD.** Each band is its own water now (`depths`, `DEPTH_TONES` - the Shallows' the
  lightest by the Veil, the Abyss the darkest); past the sea's box the world's edge is hatched, and drawn where the box
  meets it (`EDGE_LINE` - U3: the Abyss's water and the void were one black). THE DEPTH RULER over the chart (U2;
  `ruler`, `paintRuler`, RULER_H) names the water in view west to east - the world's edge, each band's, the Veil's to
  the chart's east edge - each name centred in its own water, the longest of its words that fits (`RULER_WORDS`: "THE
  SHALLOWS" else "SHALLOWS"; "THE VEIL - TO THE ILIAC BAY", "THE VEIL", "VEIL"; "THE WORLD'S EDGE", "EDGE"), or none;
  a bound between each two, the grid's ticks at its foot, the ship's caret where she is. On the map the band names and
  the Veil's fought the isles' for room: in a crowded chart every band's name gave way to a port's, a band whose bound
  lay off the chart was named nowhere, and the Veil's name ran down its strip across the ship when she lay in the Veil
  (C3). The ninety fixed stars - drawn on the screen, not the sea, so they never moved with a drag and read as rocks -
  are gone for a GRID whose squares are the SCALE BAR's length (`scaleBar`: the longest of SCALE_LEAGUES no longer than
  SCALE_MAX_PX - 20, 10, 5, 2 and 1 leagues from x1 to x16). The bar stands in the key (U4: on the map its plate hid
  isles, and port names ran across it), drawn again whenever its words change (U5: every zoom's bar is near
  SCALE_MAX_PX long, and a key drawn again on its length alone said "5 leagues" at x1).
- **A HAUNT WAS A HAIRLINE, ITS NAME OFF THE CANVAS.** A haunt's square is washed red while she sails and hatched and
  dashed grey while she lies sunk; her name and her state - "Her haunt" ("- by night" for the Lantern-Eater), "Sunk - she
  will rise again" - stand on a plate in a corner of the square's part in view that no name takes, of those the one over
  the fewest isles' marks (U6: the Pale Regent's plate hid a ruin). Where that part is smaller than the plate (a far
  zoom), or no corner of it is clear (T1/C1: the plate went to its first corner, over a port's name), her name alone
  stands over the square - over her own square, never below nor beside it (C8) - or gives way to a name there. The name
  stood above the square's top edge, off the canvas whenever the square ran past it.
- **THE SHIP WAS A SIXTEEN-PIXEL ARROW IN A GOLD BESIDE THE PORTS'** (D7). She is a bone arrowhead on her heading in a
  brass ring; off the canvas, a pointer at its edge (`edgePointer`, EDGE_INSET in) says "Your ship - 29 leagues
  east-south-east" from the chart's middle - its words inward of it, else above, below or further in, the first clear
  of the names laid before it, else the one over the fewest (U7).

And three the reading turned up: the ISLE NAMED by a pointer or a tap is ringed, a bearing drawn to it from the ship and
its card beside it (its name, its first letter raised - X17 - and "A port - 3 leagues east-north-east"), the card above
it to the east, then the west, then below, never over the isle it names and clear of the names where a spot is (U9).
The header's line says it too for a screen reader (`aria-live`), said again when the chart is repainted (C11), and
that line is one line, its height held, cut short with an ellipsis: a name said grew the head and slid the chart under
the pointer, and on a phone a long one wrapped to two lines and did it still (U8/C5); a mouse gone off the chart names
nothing. A KEY under the chart draws each mark by the chart's own painters beside its word (`CHART_KEY`, `paintKey`),
the scale bar at its end. THE WINDOW is as tall as the screen allows and the chart takes the room it leaves (U1: a fixed
64vh put the key, the zoom and Ship under the fold on a phone held sideways), painted again whenever that room changes
(U11: the key's words reflowed after the chart was measured, and it was drawn stretched), the hint set down where the
height is short. The zoom buttons are disabled at the ends, named for a screen reader and a finger's 44px; on a phone
the sheet's narrow rule no longer stretches the Close button over half the header and the zoom buttons across their row
(D6), so the title keeps its room. No host is touched: the chart is `scenes/world.js`'s, its door as ETHER-CHART left
it (THE FOUR HOSTS above).

**Its words** are the text core's since the merge of main's localization arc (L10N4; `sea.chart.*`, read when they are
drawn, drafted in the thirteen whole languages - `01-Overview/audits/Audit-Ether-OW.md`); the sea's name and its bands',
kinds' and compass words are `world/ethericSea.js`'s, passed in English until that module's routing.

## ETHER-LIGHT - the light past the Veil

Both of the frame's lights lean, past the Veil, to a cold violet (`etherLight`: the ambient to ETHER_LIGHT_TINT 0.88,
0.9, 1.14; the sun to ETHER_KEY_TINT 0.95, 0.93, 1.07), outermost of the chain (after the dread's, the sun baby's and
the brass's). The sky's dome is the world's own: a fog or a dome graded apart met the sky a step apart at the skyline
(AUDIT SD III V8's finding), and the lights touch neither. Nothing is made while nothing leans (the light handed in
handed back, sdBrassLight's law).

## ELTHERIC - the sea's name

The sea past the Veil is **the Eltheric Ocean** (2026-10-12, the owner: "Apparently the ocean is suppose to be eltheric
not etheric"). It is the lore's ocean west of Tamriel and the name the world had already given the waters west of the
Bay (`world/tamriel/tamrielGeography.js` SEAS, the intro map's; `test/ui/tamriel.test.js` "the Bay opens west to the Eltheric") -
one ocean, one name, the noun the owner's own. It was "the Etheric Sea", spelt in fourteen literals across eight modules;
the word has one home now, `ethericSea.js:"export const ETHER_WORD = 'Eltheric';"`, and every word a player reads of the
sea is made of it: the chart's title and its two labels, the harbourmaster's lede, the legend's end, the crossing's
question and its landfall, the log's lines and trades, the isles' region's words and the unstreamed landing.
`test/world/eltheric.test.js` holds the word, the names, the map's ocean the same, each reader made of it, and a scan of the
source - no code spells the old name, and the new one is spelt in its home and the map's table alone. The chart's title,
three letters longer, was cut on a phone held upright (`tools/etherChartProbe.mjs`): on a narrow screen it wraps now
(`ETHER_CHART_CSS`), and the probe's five sizes pass.

NOT RENAMED, by intent: the code's own names - the ETHER-* slices (their records are history), `world/ethericSea.js`
and every `ether*` identifier, the ledger's `ether` trade key and the Captain save's `ether` record (a rename there is a
migration with nothing to gain), the band "the Deep Aether", and quoted words (the owner's and the players' reports
keep their own spelling - AUDIT ETHER-OW D-7). This page was
`03-World/Etheric-Sea.md`; every link to it moved with it.

## ETHER-DEEP - the sea's depth

THE CAUSE. Under the water past the Veil the ground was the kernel's clamp at OceanElevation - the sea a stride deep,
its floor the drawn ground (the owner: "the area below water is very shallow and has no depth"). Iliac Puddle No More,
which carves the Bay's seabed (`03-World/Deep-Waters.md`), knows one map - IsValidMapPixel's 1000 x 500 - and every
query it asks clamps to it: an Eltheric pixel's tile data (`_global`, `_climateAtPixel`) and every bake query read the
Bay's corner pixel. ETHER-HOLD (below, and `01-Overview/bugs/Field-Bugs-2026-10-12.md`) had found that clamp the hard way -
a floor carved against the corner and a swim that read no water over it - and held the carve off the box altogether.

THE LAW. A bake answers a FRAME of pixels (`deepWatersBake.js:"export const BAY_FRAME = Object.freeze({ x0: 0, y0: 0, w: MAP_W, h: MAP_H });"`):
its planes indexed and its cells counted from the frame's corner, its tile data clamped to it - the Bay's frame is the
mod's map to the float (a pixel less 0 is the pixel; every DW pin and mutant stands). The Eltheric Ocean's box is a
bake's own frame (`etherWatersBake.js:"export class EtherWatersBake extends DeepWatersBake {"`), built by the same rules
from the same composed ground the world streams: the bound's classes, the coarse candidates and fine masks off the
pixel's own samples, the 8-connected flood that keeps a pond out (`floodSteps`, the map's flood over any frame), the
octile distance planes. Only how much of it is built differs: forty million pixels are asked as they are read and kept
(PLANE_KEEP_MAX a plane, the far ones let go past PLANE_KEEP_RADIUS - AUDIT ETHER-OW C1-2: the base bake's law, so the
Bay's planes this thread adopts are bounded too), and the flood runs an isle's CELL at a time -
every cell's ring of pixels is open sea by the bound (an isle's land bytes lie a pixel and more inside its cell, and
the kernel carries none of them out to the ring), so the rings are one sea that reaches the box's edge and a cell's own
flood is the box's (pinned over three whole rows of the box, and against the flood of the nine cells round four cells
where a pond is kept out). An isle's place blends its pixel's ground as a classic location's - 132 of 1,499 places'
pixels sampled hold water - so the bake samples its pixel with its template's rect: the host reads every template's
rect once (`etherPlaceRects`, read as a clone reads its blocks) and the place's own pick (`etherTemplateOf`) names it.

THE WORLD'S BAKES are the Bay's and the Eltheric's side by side (`DeepWatersBakes`: a query answered by the bake whose
frame holds its pixel; a worker's exported rows carry the Eltheric's sea bits and classes, so this thread floods nothing
the worker did). The worker composes the sea over its own reader as the terrain worker does; the host's one `promote`
is the gate for every arm (`deepWatersHost.js:"function promote(pixel) {"`: a pixel in a frame, the Bay's or the
Eltheric's) - the world's near promote asks it rather than holding the box itself - and the climates it hands a build
are clamped to the pixel's own frame. The raw WOODS.WLD's fast read is the raw file's alone: a composed reader inherited
its bytes, and read through them an Eltheric pixel was the Bay's clamped edge (`readLargeWindow`).

WHAT IT GIVES: the open sea is the Ocean's plain under the player's Water Depth (`deepBathymetry.js`: the Ocean's 210 m
off its coasts, the relief over it; measured through the pixel builder at the open Veil, a floor more than 150 m down,
the drawn floor the bathymetry's within the mesh's step), shallowing to every isle's shore; the cap hides a pure ocean
pixel's ground; the surface stands; the swim's column reads carved water. Every Deep Waters system that works off a
floor - the decorations, the fish, the foes, the loot, the remains - works past the Veil with it.

HELD: THE PITS. There's a Hole in the Bottom of the Ocean cuts its pits into Iliac Puddle No More's floors, and a pit's
drowned dungeon is named by its pixel's id's low twenty bits (`oceanHoles.js` GetAbyssMapId) - the Bay's 1000 x 500
alone keeps those apart. A pixel off the Bay's map is refused before the hash is asked
(`oceanHolesHost.js:"if (!isValidMapPixel(st.mapX, st.mapY)) { markTerrainProcessed(st, v, 'rejected:off-the-map'); return; }"`):
no pit past the Veil until it has an abyss of its own.

## ETHER-NODES - the professions' nodes

THE CAUSE. The isles stood the day's nodes already - the gathering host stands every built pixel's by its climate and
region, and the sea answers both (an isle's climate is the professions' own; its region Betony's) - and the open water
the schools. But the nodes' law, both ends' (`net/nodeLaw.js`), knew the Bay's 1000 x 500 alone: an isle's node id
(`herb:8009:-5194:...` - four digits east, a sign north) and a haul's were refused by the service (`bad-node`: "There is
nothing here to gather."), and every ask after an isle pixel's witnesses was refused whole (`bad-pixels`), five seconds
apart for as long as the captain stood there.

THE LAW. The nodes' ground is the Bay's map and the Eltheric's box
(`nodeLaw.js:"export const pixelOk = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y)"`; the ground's one
home is `world/ethericSea.js` `onBayOrEther` since ETHER-OW, where the Overworld's bands and raiders are born too), and a node's and a haul's ids are read in their one spelling with four digits and a sign. Nothing
else moves: the day's counts by climate, the tiers, the witnessed world (an isle pixel is unconfirmed until three
week-old accounts agree, worth its kind's least till then), the regions' materials (an isle's herbs are Betony's), a
Levy in Betony's seat. Betony's Court writs read the isles' witnessed ground with the region's own (DECIDED, AUDIT
ETHER-OW C2-4: the isles' region is Betony's). The service reads the same law: it takes an isle's harvest and answers its pixels' witnesses -
no migration (its keys are text). Its law moved, so `ACCOUNT_VERSION` was acct124 (acct125 since AUDIT ETHER-OW C2-1,
below; service.js's discipline: a deploy
that did not happen looks exactly like one that did), and `world/ethericSea.js` - the box's one home - joins the account
Worker's bundle, so the deploy's path filter carries it (`.github/workflows/account-deploy.yml`, held to the import
graph by `test/server/accountdeploy.test.js`, which caught it in CI). `test/net/ether_nodes.test.js` holds the ground, the spelling, and the service end to end
over the real database.

## ETHER-OW - the Overworld past the Veil

The Overworld - the real world from a raised eye, a click a journey, its enemies marked (`06-Systems/Travel-View.md`) -
already stood over the sea's ground (G5: `tvWater`, `tvSceneOf` read an isle's land as land), and its journeys already
cross water in a boat (OWS2). Five of its reads still held the Bay:

1. **THE DOOR.** The way up is the held map's Overworld door (TV1: the foot's button, its key O), and past the Veil the
   map's answer is this chart, which had none - a captain there rose only by a key nobody binds (the `TravelView`
   action ships unbound). The chart wears the held map's door now (`ui/etherChartWindow.js`, in its tools row, a
   finger's 44 px, and on its key O): its words one home (`scenes/travelView.js` TRAVEL_VIEW_BUTTON - the held map's,
   moved there so a lazy chunk need not load the held map for them), shown where the view can rise (the host's
   `travelViewAllowed`: the open air, the enhanced lane, a body alive), asked at every paint. It shuts the chart with its
   own reason, 'overworld', and the host lifts the view once the chart's slot is empty (`openEtherChart` - the slot is
   emptied before the occupant is told).
2. **THE PLACES.** The view's places were the Bay's dictionary's rows (`tvPlaceSummary` read
   `travelLocationSummaryAt(mapDict)`), and an isle's port or ruin is none: no plate, no far place, a click on its town a
   walk to bare ground. Past the Veil an isle's place is its own summary (HALL-JOURNEY's way): the index's once its
   pixel has built, else its clone, marked and never stood (`etherPlaceClone`, the build's own half of `etherPlaceAt` -
   `tvSpawnAt`'s law: a far place is marked, never built). It is KNOWN as the sea knows a place: its isle on the
   captain's charts (`sight` within three pixels, a harbourmaster's chart, a corsair's papers - the chart's own isles),
   or the place found (its door entered, or met on approach) - and the lists are keyed on the charts as on DFU's finds
   (`tvKnownGen`, AUDIT ETHER-OW C2-2: an isle charted where the captain stands is a plate at once, not a pixel later).
   A known port or ruin within the grid wears TV2's plate; a
   known port within the edge's range (TV_FAR_RANGE, 24 pixels) is TV5's far plate, a journey there; a ruin within it is
   TV6's - a lair where it lies until known, a far plate once - and among the nearest, OW-DUNGEONS' model, as any
   dungeon's (`world/etherPlaces.js` `etherPlaceRows`, world.js `tvDungeonRowsAt`, `tvDungeonAt`). The map's settlements, gathered once, never keep an isle's place the
   index held at the first ask.
3. **THE LOAD.** A journey under the view is held while the land the view can see is unraised (TV2's cap), and the
   governor counted every pixel off the map as built - the law before the world streamed past it. Past the Veil (and on
   the land past the Bay, TAMRIEL2) a fast crossing outran the stream unheld. It asks the stream's own law now
   (`StreamingWorldState.streams`): where the world streams nothing, nothing is owed.
4. **THE ENEMIES.** The Overworld's own enemies - the roaming bands (TV7, OW6) and Warm Ashes' raiders (OWS3) - are
   seeded of the land and the shared clock, and were seeded on the Bay's map alone (`bandOk`, `tvRaidOpen`, `tvRaidSea`
   - AUDIT OW4 B2's and AUDIT OW5b S5's bounds). Their ground is the Bay's map or the Eltheric's box now - one home,
   `world/ethericSea.js` `onBayOrEther`, the nodes' own - over the sea's composed ground: a band roams an isle's land,
   never its town's or its ruin's pixel (`etherPlaceIsle`) nor the sea; a raider is born on the open sea (the ocean's
   climate, every pixel about it water) and sails it, never past the box (S5's edges kept, by the point's own pixel
   floored - the Bay's bounds exactly as they were), and only where the sea fight stands her as a ship (AUDIT ETHER-OW
   C2-3: with it off, the mod's raid boarded the Bay's "Your Ship" - a teleport over the Veil and home again; "Your
   Ship" is boarded from the Bay alone now, `boardOrDisembark` asking `veilRefused`, and leaving it goes back where it
   was boarded). They are marked, chased, slowed for and met as the Bay's are, by the same code; the camps already were
   (they are the foes standing). A raider stood as a ship past the Veil (NAV-R) is the sea's own corsair - `launch`
   dresses every ship launched there (its names, its colours, no crown's law) - and her class is drawn the band's levels
   over the captain's, as every class the director draws there is (`navalHost.js` `raiders`; it read the captain's
   level alone).
5. **THE WORD.** A chase is shared on the chaser's frame (TV7b, OW6), and the word's place was the Bay's extent: every
   chase said past the Veil was dropped by the peers who heard it. A chaser's place is a pixel of the world now
   (`systems/travel/travelBands.js` `chaserPlaceOk` - `net/wire.js` `worldPixelOk`, TV-BEYOND's law). The relay's ids and cells
   took a sign already (TV-BEYOND): no relay version.

**Measured, kept.** The route planner (OWS2's sea, TV-BEYOND's ground past the map) plans past the Veil as it does past
the Bay: a crossing of 12 pixels between two isles by Veilhaven in 12 ms, and "no way by land" on foot in 14 ms - its
widest box held about the two ends, about twice the Bay's whole map (1,001 by 1,012 pixels - AUDIT ETHER-OW D-4).
**Held.** The sea lanes (`laneOpen`: the Bay's packets between its ports) and the serpent's site stay the Bay's. The sea
fight's own traffic - the director's corsairs and the legends - is drawn under the view as hulls and is not marked, as
the Bay's own pirates are not; a raider is marked where she stands as a ship (NAV-R). The chart is still never pressed
to travel: the Overworld is. The node law reads the one home with every answer unchanged (`test/net/ether_nodes.test.js`
as it stood), so the account Worker's law did not move with ETHER-OW (AUDIT ETHER-OW C2-1 moved it, to acct125: a
Motherlode is sited where a Watch receipt can name its pixel).
**THE FOUR HOSTS.** The Overworld is the streaming host's alone (`06-Systems/Travel-View.md`): `scenes/world.js` wired;
`scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` raise no view - FLAGGED, as TV's.

## The ledger's record

The Captain save (CAPTAIN_SAVE_VENDOR, still v1 - a record without it reads as none) keeps `ether`: the isles charted
(their cell keys, ETHER_CHARTED_MAX 4,096, the first kept), the legends ended (their days), the strands gathered (their
days, the newest ETHER_HARVEST_KEEP 128), the way out (never one in the sea - X2), the crossings, the legends heard of.
Restored field by field, a junk entry dropped and the rest kept. Its days are the world's online and the character's
clock offline: Copy to offline and Bring online move them by the days between the clocks (`offlineCopy.js` - AUDIT
CAPTAIN'S SEA L4: a copy taken offline found a legend sunk for months). The log says "Eltheric isles charted", "Deepest Eltheric waters - N leagues past
the Veil", "Legends ended"; its trades count 'ether' and 'legend' ships.

## Recorded departures and readings

- **Infinite, read honestly.** The sea is a pure function of its pixel - its law answers its box and ETHER_MARGIN round
  it (AUDIT CAPTAIN'S SEA G13/H18: "unbounded in law" it is not) - and the stream's box is 6,600 by 4,100 km of it: more
  than a thousand leagues west of the Veil, some ten hours of real time at the helm's top speed.
  Past it nothing streams (the world's edge). The wire's pose bound, not taste, set its north.
- **The region is Betony's** for every system that asks one (quests, law, prices, names); only the place words say
  "the Eltheric Ocean". A quest given on an isle may send a captain back across the Veil.
- **A place's name may repeat** across the sea (sixteen thousand roots): two places of one name share an automap and a
  building's discovery. At fifty places charted, about one captain in twenty meets it (G11/P11 - measured; "one in
  fifty" was not).
- **The light, not the sky.** The dome, the clouds and the fog are the world's own past the Veil; a grade of the sky's
  four passes (as the brass's) is a later slice's.
- **Deep Waters by its own bake; the pits the Bay's.** ETHER-HOLD (from play, 2026-10-11: a player over the side
  stood on a floor carved against the Bay's clamped corner, and could neither swim nor float back) held the carve off
  the box; ETHER-DEEP (above) carves it by its own frame, and a host told nothing of the sea still holds it
  (test/world/ethersea_dwhold.test.js). Ocean Holes' pits stay the Bay's.
- **Online**, the crossing is each player's own; a party is not carried across together, and a player aboard another's
  ship holds the crossing back.
- **The Overworld's enemies, seeded on the sea** (ETHER-OW): the bands roam the isles and Warm Ashes' raiders sail the
  open sea past the Veil as on the Bay's map - the Bay's own law on a ground the mods never knew.

## Pins

`test/world/ethersea.test.js` (15): the box (the wire's bounds, positive units, clear of Tamriel's frame at every fit), the
Veil and the bands, the hash, the isles (the chance, the kinds' weights and ranges, every isle's land inside its cell,
the cache), the open edge and strip and Veilhaven, the names, the ground (the fall, the noise, the detail, the climate's
reach, the map's water law), the composition (every arm), through the kernel (dry places, the landfall's water), the
crossing's waters, the goods, the stream's frames, the far ring's `climatePast`, by source (the host's composition and
order, the worker's word, the module's purity), the light. `test/world/etherplaces.test.js` (7): the id's lane and base, the
index, the templates' filters and order, the pick by kind, the clone field by field, the host's seams, the ports'
seams. `test/systems/naval/ethership.test.js` (10): the six legends kept out of every draw, the names and colours, the weights, the
haunts, the rumours, the director past the Veil (no navy, no relief, the pairs, a legend's chance and her one), at sea
(names, colours, no crime, the log's trade, the purse, the papers, the plate), the mend and the veil, the strands, by
source. `test/systems/naval/ethercross.test.js` (10): the ways and the gate, the voyage's targets and words, the crossing by source
(each step in its order), the ledger's record and its log lines, the host's waters and charting, the strands, the
legends' host (rise, night, purse, the chart's sale, the papers' chance), the chart's sums and model, the doors.
PIN MOVED: `test/systems/naval/nav_c_ships.test.js` (fifteen classes, nine drawn), `test/systems/naval/tougherships.test.js` (the legends'
salvage), `test/world/terrain/terrainworker.test.js` (the worker's imports), `test/world/tamriel2.test.js` (the ring's bytes past the map),
`test/world/terrain/auditlandforms.test.js` and `test/systems/travel/tv8_party_walk.test.js` (the far read's guard), `test/systems/comeSailAway/csa_close.test.js` (the
crossing's pause), `test/systems/seasonsIliacBay.test.js` (the crossing a travel), `test/systems/superDungeon/sd19_presence.test.js`, `test/render/event1_live_event.test.js`,
`test/net/sunbaby1_event.test.js`, `test/world/sunbaby2_phases.test.js` and `test/systems/gate/wbx8_gate_sky.test.js` (the lights leaned once
more), `test/systems/comeSailAway/fb0929h_deedport.test.js` (the port test past the Veil - an isle's port is a port for the deed),
`test/world/fb0929h_spawnplate.test.js` and `test/world/spawneddungeons.test.js` (the build past the Veil),
`test/systems/superDungeon/sd2d_castout.test.js` (an isle's ruin wakes at its own door). `test/fixtures/time1_census.json` names the new
clock readers: the Eltheric host's day on the event clock, the crossing's arrival on the sky
(`bible/06-Systems/Online-Time-Arc.md` 5.2). Mutants `tools/mutants/ethersea.json`,
`tools/mutants/etherplaces.json`, `tools/mutants/ethership.json`, `tools/mutants/ethercross.json`.

AUDIT CAPTAIN'S SEA: `test/systems/naval/auditcaptsea.test.js` (68) holds the audit's findings, the sea's among them - the ground
(G1-G14: the margin, the switch split and the unstreamed landing, the isles' own lands, the ring's climate, water,
plates and fade, raids, the World of Daggerfall pick, Masser's key, the compass's words), the places (H1, P1-P12: a
harbour at every port, the game's hamlets for the haven - against the player's own data, ARENA2_PATH - the spawns,
the rise, the Veil's refusal, quests, deeds, the port gate, the Fleet's side of the Veil, the exterior's ids), the
crossing and the chart (X1-X18), the traffic and the legends (D1-D21) - in `tools/mutants/auditcaptsea.json`. Its
fixes moved pins in `test/world/ethersea.test.js` (the margin 64, the port isle's land, the mouth, the climates),
`test/world/etherplaces.test.js` (the havens, the ruin's port byte, the spawn filter, the quest region), `test/systems/naval/ethership.test.js`
(H7's tautology), `test/systems/naval/ethercross.test.js` (the refusal, the move, the way back, the hearing, the bands, the heading),
`test/render/moonlight.test.js` (Masser's key), `test/systems/raid1_raidingParties.test.js` (no province past the Veil),
`test/world/worldOfDaggerfall/audit_wod_branch.test.js` and `test/world/gate/gateclear.test.js` (the pick the Bay's), `test/systems/portal1_stone.test.js` (the
Veil's refusal), `test/formats/travelmap.test.js` (the landing before the build), and P9's deed in eleven house suites; the
page names each.

ETHER-CHART2: `test/ui/etherchart2.test.js` (9) holds the chart read at a glance - the face, a mark's shape by kind (a
stub context watching the painter), the marks before the names, the names in layers, the depths and the depth ruler,
the grid and the scale, the haunts named in view, the ship's pointer, the isle named and the window's line - in
`tools/mutants/etherchart2.json` (24). PIN MOVED: `test/systems/naval/auditcaptsea.test.js` X12/X14 read the model's own boxes (a
name on either side of its isle; X14's crowded view x1's, since x2 letters every port within 40 pixels of Veilhaven now,
and its ports-first check a second, crowded view where a lesser name met first still takes a port's only place - with
two sides the old view could not fail `ACS-X14-ports-first`) and X12 the depth ruler (each band's water its own, bound
to bound - AUDIT ETHER-CHART2 U2); three of its records are re-aimed at the new sites (`ACS-X14-overlap`,
`ACS-X14-ports-first`, `ACS-X12-band-side`). AUDIT ETHER-CHART2: `test/ui/audit_etherchart2.test.js` (16) holds the
audit's findings - the window's room, the ruler drawn, the world's edge, the scale in the key, the card, the face that
lands late and the room watched; a haunt's plate never over a name; the painter watched draw for draw (each colour, the
ship on her heading, the pointer, the rings, the bearing, the washes, every name at its own box, the key); the measure
held to the paint; every box beside its isle at every zoom; the haunts' floors and filter; the layers' order and each
name's side; the card's capital and the window's presses; the pointer's words before the lesser names, the chart's side
of a cut name, a lone haunt name over her own square, the ports' marks alone and the note repainted - in
`tools/mutants/audit_etherchart2.json` (56). The 108 records aimed at `ui/etherChartWindow.js` across the four
lists all die. `tools/etherChartProbe.mjs` measures in Chromium what node cannot: the mean letter, the window fitting at
five sizes, the late face, a full captain's repaint.

ELTHERIC, ETHER-DEEP, ETHER-NODES: `test/world/eltheric.test.js` (4) - the word and its readers, the source scanned, the
chart's title wrapped; `test/world/deepWater/ether_deep.test.js` (10) - the raw reader's bytes its own, the cells' rings over three rows,
the cell's flood the nine cells', the frame and the routing, the planes bounded, the places' rects, the open sea carved
through the pixel builder to the Ocean's plain, the client and the worker, the host's every arm; `test/net/ether_nodes.test.js`
(3) - the ground, the spelling, the service. `test/scenes/oh_host.test.js` holds the pits' hold. Mutants
`tools/mutants/eltheric.json` (7), `tools/mutants/ether_deep.json` (23), `tools/mutants/ether_nodes.json` (6) - all
die (three ETHER-DEEP records survived the first pins - a carved query and a misrouted row probed where the box's
clamped edge answers the same, the host's word to its client never reached - and the pins were made to see them). PIN MOVED: every pin
of the sea's words (`test/world/ethersea.test.js`, `test/systems/naval/ethercross.test.js`, `test/ui/audit_etherchart2.test.js`,
`test/systems/naval/auditcaptsea.test.js`), `test/world/tamriel2.test.js` (the near promote's gate the host's),
`test/world/ethersea_dwhold.test.js` (a host told nothing of the sea), and `tools/mutants/dwa.json`'s two border seeds (the
flood's names the frame's), auditcaptsea's ACS-V1 and captlog's CL-ether-crowned (the words - AUDIT ETHER-OW D-17).

ETHER-OW: `test/systems/travel/ether_ow.test.js` (9) - the chart's door mounted (hidden, shown at a paint, pressed, its key) and the
host's (handed where the view can rise, the view lifted once the slot is empty), the governor's line over the real
stream law, the places (the summary, known by chart or find, never stood, the index's first), the far ports and the
ruins as TV6's (lifted and run), the bands' land and the raiders' sea over the sea's composed ground (bands and raiders
seeded there, life by life), the chase word; `test/systems/naval/nav_r_raiders.test.js` (+1) - a raider stood past the Veil the sea's
corsair, drawn the band's levels over the captain's. Mutants `tools/mutants/ether_ow.json` (24). PIN MOVED (each to its
new law): `test/systems/ows3_raiders.test.js` (the raiders' open sea, the host's ground, the word's place past the world's edge),
`test/systems/travel/tv7_bands.test.js` (the bands' land, the word's place), `test/ui/travel/tv5_far_places.test.js` (the settlements),
`test/systems/travel/tv6_dungeons.test.js`, `test/player/eyeOfTheBeholder/ow5_audit.test.js` and `test/world/owdungeons.test.js` (the lists' rows lifted beside them), `test/systems/travel/tv2_click_to_move.test.js`
and `test/systems/travel/tv_wasd.test.js` (the governor's ground), `test/ui/audit_etherchart2.test.js` (the door a press of the row);
re-aimed by content: `tools/mutants/ether_nodes.json` (EN-bay-alone, EN-law-margin), `ow3d.json` (OW3D3-rows-off-the-index),
`ow4t.json` (OW4-B2-live-index), `ow5s.json` (the two S5 records), `tv7.json` (TV7b-off-the-map).

AUDIT ETHER-OW (`01-Overview/audits/Audit-Ether-OW.md`): `test/systems/audit_etherow.test.js` (4) - the Motherlodes' ground (the
Watch's, one home; the service end to end), a chart a plate at once, no boarding across the Veil; the lanes' other
pins in their slices' files - `test/world/deepWater/ether_deep.test.js` (the Bay's pixels off the bytes, every delegate routed, the
keep exact and the near kept, a tile's climates and east edge, the dry check's held bits), `test/systems/travel/ether_ow.test.js`
(the find and the models past the Veil, the chase word's place, the bands off the continent's land, no raiders with the
sea fight off), `test/systems/naval/nav_r_raiders.test.js` (the band's levels, not its tier), `test/scenes/oh_host.test.js` (the continent's
pits). `tools/mutants/audit_etherow.json` (47) all die. PIN MOVED: the account version (acct125) in nineteen suites and the relay's (world199),
`test/net/seat1b_client.test.js` (the relay's mint), `test/world/audit68_worldjs.test.js` (the board asks the Veil), `test/systems/ows3_raiders.test.js` (the raiders' host), and the lists' key in
`test/systems/travel/tv6_dungeons.test.js`, `test/player/eyeOfTheBeholder/ow5_audit.test.js` and `test/world/owdungeons.test.js`; re-aimed by content: four records
of `tools/mutants/ether_deep.json`, `seat1b.json`'s relay record and `soc1.json`'s relay version.

**Not verified here:** the look and feel in a real browser (the isles on the horizon, the light - the chart was read in
Chromium at ETHER-CHART2, mounted alone), a crossing end to end in a running world (its jump, the ship brought round,
the stream past the Veil), a town's buildings and a ruin's halls entered on an isle, and online play past the Veil;
ETHER-DEEP's seabed seen and swum in a running world (its pins build real Eltheric pixels through the mod's own
builder; the renderer and the swim's motor are the Bay's, unchanged), the places' rects read off the player's MAPS.BSA
and BLOCKS.BSA (no archive here: their pick is pinned, their reading is `setLocationTiles`'s), and ETHER-NODES' harvest
from a live client against the deployed service (pinned over the service's own code and migrations); ETHER-OW's
Overworld risen past the Veil in a running world - the view over the sea, a crossing sailed from a click, the isles'
plates, the bands and raiders marked (the host's own code is run over the sea's real ground here; the view, its marks'
painter and its journeys are the Bay's, unchanged).
