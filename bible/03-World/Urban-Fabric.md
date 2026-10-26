# Urban Fabric - the towns past the Bay in their own stone, with streets in their order and yards behind their houses (URBANIZER, 2026-10-26)

KPbICA's spec (DFO Online Core Discord, 2026-10-25), forwarded by the owner, Mac, 2026-10-26 - its URBANIZER:
*"1) Buildings assets should utilize more cut stones, bricks, half-timbering 2) Inner yards and backyards 3) Wide main
streets with pathways, alleys, side streets, dead ends"* (its 4 to 7 are the Imperial City's - another stream's work,
TESA11's own districts). This page is items 1 to 3 for every procedural town past the Bay: Arena's places (TESA2,
TESA12), the countryside's towns (TESA7), the Imperial City's outskirts (TS5) and the capitals but the Imperial City
(TESA10 to TESA-LORE). The Bay's towns are Daggerfall's and stand as Daggerfall lays them.

| Slice | What | State |
|---|---|---|
| U1 | a town's buildings in its province's own set of Daggerfall's stone, brick and half-timber (`world/urban/townLook.js`) | BUILT |
| U2 | the towns' own pictures - each province's paving, cobbles and walls; cut stone, brick and half-timbering on the capitals' landmarks (`world/urban/urbanArt.js`, `world/urban/urbanRecords.js`) | BUILT |
| U3 | a town's fabric - main streets with pavements, side streets, alleys, dead ends, fenced yards with gates and woodpiles (`world/urban/townFabric.js`, `townFabricModel.js`, `townFabricStand.js`) | BUILT |

## 1. What stood (DFU's reference, measured on the freeware)

- **A town is a grid of RMB blocks** (DFU's `DaggerfallLocation.LayoutLocation`, `world/locationLayout.js`). Each block is
  its houses and the ground round them: 16 x 16 ground tiles (`GroundTiles[x][y]`, y from the north) and a 64 x 64 town
  map (`AutoMapData`, 1.6 m a cell - a building's type plus one, 24 the wall's, 117 and 250-251 its props). Over every
  town block of BLOCKS.BSA the ground holds 85,306 grass tiles (record 2), 63,300 dirt (1), 36,476 road (46, 47, 55 -
  `CityNavigation.GetTileWeight`'s "Roads are great!") and the edges between them; the road is a lane a tile wide (6.4 m)
  winding through each block and out at its sides' middles. Nothing says which way is a main street: every way between
  the houses is the same dirt and the same lane, and a town reads as one uniform grid.
- **A town's buildings wear its location's climate** (`ClimateSwaps.ApplyClimate`, `world/climateSwaps.js`, through
  `scenes/pixelBuild.js` townClimateBase): every exterior set rebased onto Desert 0, Mountain 100, Temperate 300 or Swamp
  400. Looked at side by side (the player's TEXTURE.0xx-4xx, nothing of them kept): MOUNTAIN is cut stone and rubble -
  grey ashlar, coursed rubble, cobble walls under timber in its villages; TEMPERATE is half-timbering - braced frames over
  plaster (CityB), over brick (the merchants' homes, the manors, the farms), plaster in CityA, boards in its villages;
  DESERT is sandstone and stucco under arched windows, sandstone brick in its castles; SWAMP is timber over cobble and
  brick, overgrown.
- **Past the Bay a town stood on its zone's climate** (TESA-BIOME), and `getWorldClimateSettings` maps MountainWoods to
  TEMPERATE: half of Skyrim (the Tundra Plains, the Pinewoods) stood Breton half-timber over plaster, Mournhold's Deshaan
  and the Telvanni Peninsula with it, Cyrodiil's jungles the Swamp's vines, Summerset's Auridon the Breton frames.
- **The capitals' own landmarks** (TESA10-TESA-LORE) are the port's own shapes in CAPITAL_ARCHIVE's pictures: marble,
  rubble masonry, sandstone, ochre, mossy stone, timber planks - no brick, no dressed stone, no framing over plaster.

## 2. U1 - a province's towns in their own stone (`world/urban/townLook.js`)

DEPARTURE (named; Port-Ledger section A, URBANIZER): from DFU's `ClimateUse.UseLocation` reading the location's climate
whole - past the Bay a town's buildings wear its PROVINCE's set, its ground, its trees, its people and its sky still its
zone's. Only the location's `climateType` moves (`withTownLook`, the zone's kept as `zoneClimateType`): the set its
buildings' and (through the same field, `scenes/worldModes.js`) its interiors' pictures swap to.

| Province | Set | Why |
|---|---|---|
| Skyrim | Mountain | the Nord's stone and timber - ashlar and rubble walls, framing over stone |
| High Rock | Temperate | the Breton's half-timbering over plaster and brick |
| Hammerfell | Desert | the Redguard's sandstone and adobe |
| Summerset | Desert | the Altmer's pale stone and stucco under arched windows - never the Breton frames |
| Valenwood | Swamp | the Bosmer's timber under the forest's vines |
| Elsweyr | Desert | the Khajiit's sandstone and adobe |
| Black Marsh | Swamp | the Argonian's timber over the marsh's stone, overgrown |
| Morrowind | Desert | the Velothi's stucco and sandstone |
| Cyrodiil | Temperate | the Empire's half-timbering, brick and cut stone |

The zones of another stone (`TOWN_LOOK_ZONES`): Wrothgar, the Ashlands, Red Mountain and the Velothi Mountains, and the
Jerall (Bruma's Nord stone) the Mountain's; Blackwood the Swamp's. Measured over every zone (`test/world/urban/
urban1_look.test.js`): seventeen zones' towns move off their zone's set - Skyrim's Tundra and Pinewoods to stone,
Morrowind's Grazelands, Ascadian Isles, Bitter Coast, Deshaan, Telvanni Peninsula, Stonefalls and Velothi Foothills to
stucco, Summerset's Auridon and Eton Nir, Hammerfell's Dragontail, Elsweyr's Tenmar, Valenwood's Reaper's March, and
Cyrodiil's Nibenay and Colovian jungles to half-timbering and the Jerall to stone. Mournhold's blocks stand in stucco
under its ochre walls now; Solitude, Alinor, Torval, Helstrom and Falinesti already stood in their province's set.

**The host** (`scenes/tamrielPlacesHost.js`): Arena's places, the countryside's towns and the capitals but the Imperial
City are stood in `townClimateAt` - their pixel's climate settings with the set their province's (the province under the
pixel and the zone, `world/tamriel/tamrielBiomes.js` tamrielBiomeAt). A lair keeps its zone's; the Imperial City is
stood as before.

## 3. U2 - the towns' own pictures (`world/urban/urbanArt.js`, `world/urban/urbanRecords.js`)

The port's own, painted at boot from fixed seeds under URBAN_ARCHIVE (38500, past the capitals' 38400) by the capitals'
own laws (`world/capitalModels.js` CAPITAL_PAINT, lent - TESA-LORE: a tone law dithered onto its material's ramp, masonry
laid stone by stone, lit on its top and left edges), each 64 x 64 within the freeware's band (16 to 84 colours, a texel
5.4 to 18.4 from the next, a spread of 11.3 to 41.6) and tiling. No game data.

- **The shared pictures**: brick (red courses), half-timbering (oak framing over plaster - a post and a rail every 32
  texels, a brace across every other panel), ashlar (dressed grey stone), ochre ashlar, white ashlar, sandstone brick, log
  ends (a woodpile's face).
- **A style a province** (URBAN_STYLES, PROVINCE_STYLE), its setts, flags, cobbles and wall: Skyrim's granite (its walls
  rubble), High Rock's brown stone (its walls brick), Hammerfell's sandstone and Elsweyr's red sandstone (adobe),
  Summerset's limestone (ashlar), Morrowind's ochre (stucco), Cyrodiil's grey setts (brick), Valenwood's and Black
  Marsh's planks (a boardwalk; stakes for walls).
- **The capitals' own buildings** (their modules - never the Imperial City's): Castle Dour's keep and the Emperor's Tower
  in dressed stone, the East Empire warehouse timber-framed over plaster on a stone storey (WAREHOUSE_PLINTH, 3 m);
  Mournhold's Royal Palace in dressed ochre; Alinor's palace terraces, keep and wings in dressed white stone (its spires
  marble); the Mane's estate walled in sandstone brick. Falinesti's living wood and Helstrom's mossy stone are kept: the
  Bosmer and the Argonians build in neither brick nor framing (each province keeps its character).
- **Installed** beside the capitals (`scenes/modWorldData.js` installUrbanArt), behind no switch, each painted when first
  asked.

## 4. U3 - a town's fabric, planned (`world/urban/townFabric.js`)

DEPARTURE (named; Port-Ledger section A, URBANIZER): from DFU's `LayoutLocation` laying the blocks' ground as it is - the
port's own paving, kerbs, fences and walls over it, past the Bay alone.

A town's open ground read cell by cell at the town map's 1.6 m - the walkers' own grid (`world/city/cityNavigation.js`
NAV_CELL), so the plan and the people agree - and ordered:

- **The grid** (`fabricGrid`): a block's town-map bytes built (a building's - bytes 1 to 23 - a house), the water's
  records built, Daggerfall's grass (2) and road (46, 47, 55) kept apart, every misc model's and flat's cell and the eight
  round it built. A cell no block lays - a left-out cell (TS3), a wall's carrier (TS4), a capital's own blocks, gardens
  and lakes - is off the town (`isPortCell`).
- **The main streets**: the ways from the town's ends to its middle (`world/urban/townFabricStand.js` fabricEnds, below),
  each the cheapest walk over the open cells (Dijkstra, four ways) - a cell 1 on Daggerfall's road and FABRIC.offRoad (2)
  more off it, FABRIC.mainCost (4) more for each cell its clearance falls short of FABRIC.mainWant (2.5): the town's own
  lanes, kept off its walls. The street is every open cell within FABRIC.kerb (3.5 cells) of the walk: its carriageway
  within FABRIC.carriage (2.5 - 8 m between its kerbs), its pavements past it, and wherever a house stands within
  FABRIC.pave (1) - a street as wide as the houses let it be, its pavements along their fronts.
- **The side streets** are Daggerfall's road; **the alleys** the open ground between houses whose corridor is narrower
  than FABRIC.side (2) at its middle (`maxNear` - the most clearance within FABRIC.reach: a street's margin by a house is
  the street's).
- **The yards**: each piece of Daggerfall's grass (FABRIC.yard: 12 to 1,400 cells) touching a house along FABRIC.yardTouch
  (6) cell edges - the gardens Daggerfall paints behind and between its houses, and the inner yards its blocks close
  round. Fenced on every edge onto a way, open ground or the land past the town (never against a house, a prop or the
  water); its gate FABRIC.gate (2 cells) wide in its run with the most edges onto a street (else onto ground a walker
  crosses - never onto the land past the town).
- **The dead ends**: an alley of FABRIC.deadLeast (4) cells or more - one with one mouth on the streets ends where it ends;
  one running out of the town at its end no wider than FABRIC.deadMouth (4) is walled there (`outWalls` - never a
  capital's, whose cells past its blocks are its own plazas and grounds); one through-alley in FABRIC.deadEvery (2), off
  the town's dice, walled at its mouth farther from the middle. Each dead end's last FABRIC.deadDress cells kept.
- **The walkers** (`shut`): a fence's yard side but its gates, a wall's alley side. **No cell a walker reached is cut off**:
  every piece of the open ground the shut splits is joined back to its streets - a gate where the first shut cell between
  them is a fence's, the wall down where it is a wall's; and where two shut cells stand side by side, every one beside a
  stray opens - until none is cut off (`reachOf`, `cutOff`). So every door Daggerfall's town opens onto its ground is still
  reached.
- **The woodpiles**: one in a yard of FABRIC.pileYard (40) cells or more, against its fence on a cell already shut,
  FABRIC.pileClear (2) from every house (never before a door) and FABRIC.pileGate (3) from its gates, its neighbours round
  it open (`props`).
- **Its steps** (`planSteps`): a generator yielding between its fields, its main streets, its yards, its dead ends and its
  walkers - the host breathes there.

**Measured** over every city-state template past the Bay (407, each as TS3 outlines it), every fourth hamlet (300) and
every eighth village (230), on this session's loaded machine (`fabricStats`, the slice's scratch measure):

| | yards | fence | gates | dead ends | woodpiles | main streets | setts | pavement | side streets | alleys | cut off | plan |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a city | 34.6 | 2,298 m | 49 | 10.9 | 23.8 | 4 | 7,928 m2 | 3,218 m2 | 31,457 m2 | 1,151 m2 | 0 | 295 ms mean, 604 the 90th |
| a hamlet | 22.8 | 1,282 m | 32 | 4.4 | 15.6 | 1.9 | 3,199 m2 | 1,291 m2 | 12,154 m2 | 530 m2 | 0 | 86 ms |
| a village | 6.8 | 476 m | 9.4 | 0.6 | 4.3 | 0 | - | - | 4,217 m2 | 88 m2 | 0 | 10 ms |

## 5. U3 - a town's fabric, made (`world/urban/townFabricModel.js`)

One model of the town's own in the location's metres (x east, z north, its ground y 0 - the blocks' own origin, 5 cm over
the flattened ground TS2 lays):

- **The main streets** in the style's setts at FABRIC_ROAD_Y between kerbs, the **pavements** in its flags FABRIC_PAVE_Y
  (0.08 m - under the 0.1 m a town's walker looks ahead at for a step, `characters/mobile/mobilePerson.js` `_clear`, so
  its people cross every kerb) over them, a kerb's face along every pavement edge but a house's (`cellRects` - a mask
  laid in greedy rectangles; `runSegment`, a run of edges as a line). The planks' styles lay no carriageway: their
  boardwalks either side of the forest floor.
- **A city's side streets** (Daggerfall's road) in the style's cobbles; a hamlet's and a village's keep Daggerfall's own
  lane.
- **The yards**: the fenced styles' (Skyrim's, High Rock's, Valenwood's, Black Marsh's) in Daggerfall's own fence (ARCH3D
  41206 - its rails between their posts, a piece every 3.2 m or so stretched along each run, `pieceAlong`, as TS4's walls
  are along their line) in the town's climate; the walled styles' in a low wall FABRIC_WALL (1.5 m) of the style's wall
  under a coping of its flags, a pillar either side of every gate.
- **The dead ends' walls** FABRIC_DEAD_WALL (2.6 m) in the style's wall.
- **The woodpiles**: log ends to the yard and toward the fence, bark over the top, Daggerfall's crate (ARCH3D 41818)
  beside each.
- The port's own faces at vanilla's texel density (`world/capitalModels.js` vanillaTexels - a picture every 1.6 m);
  Daggerfall's pieces keep their own pictures; one submesh a picture (`world/arena/arenaModel.js` composeArenaModel).
  Measured: a city's fabric 21,188 triangles on the mean (37,151 at the most), a hamlet's 10,439, a village's 3,352, in
  nine submeshes at the most.
- **Made a step at a time** (`townFabricSteps`; the model door's `buildSliced`, `townFabricModelSliced`): a breath after
  its streets, after every FABRIC_RUNS_A_BREATH (64) runs of fence, after its yards, its dead ends and woodpiles, and
  after its own faces are mapped - a city's fabric is a few hundred milliseconds of work on a slow machine, never one
  frame's, as its plan is never one frame's.

## 6. U3 - a town's fabric, stood (`world/urban/townFabricStand.js`)

- **Which** (`fabricTown`): Arena's places, the countryside's towns (never a lair) and the capitals but the Imperial
  City.
- **Its main streets' ends** (`fabricEnds`): a city walled on its outline (TS4) from each of its gates, GATE_IN_M (12 m)
  in (`world/townWalls.js` townWallGatesOf - the wall as it was registered); a capital from the middle of each side its
  gates face (CAPITALS `gates`) to its anchor; a city from the middle of each of its four sides, a hamlet of more than a
  block from the two ends of its longer axis, to its middle; a village and the countryside's lesser places none.
- **Kept** (EVERY ALLOCATION HAS AN OWNER): the plan and its model, by the town's map id, the TOWN_FABRIC_KEEP (24) most
  recently built; a town past them has its model taken off the model door (its GPU mesh is its pixel's hold's - freed with
  the pixel, PLACE-LRU) and is planned again, the same plan, when built again. A model's id (TOWN_FABRIC_MODEL_BASE,
  5,000,000, and on) is never reused in a session.
- **THE FOUR HOSTS.** `scenes/world.js` - WIRED, through its pixel build (`scenes/pixelBuild.js`): the fabric planned as the
  town is laid out (`townFabricFor`, a breath between its steps) - before its yards (MERCHANT-YARDS, SHIPYARDS) and its
  walkers are placed, so both keep off its fences (`fabricWalkShut`: the town's own walk shut, then the fabric's) - and
  its model stood at the location's origin, its Daggerfall pieces in the town's climate, merged into the pixel's static
  batch and solid as its blocks' models are. `scenes/worldModes.js` (interiors) - WIRED for U1 alone: an interior's
  pictures follow the location's `climateType`; a building's inside stands no street. `scenes/dungeonContext.js` - no
  street; nothing here reaches it. `scenes/exterior.js` (the single-town bench) - streams no land past the Bay: no town of
  this page stands there.

## 7. Seen and measured

- **Pictures**: before and after, from above, down a main street, at a yard's gate, over a woodpile and down an alley -
  the game's own code (`world/rmbLayout.js` layoutRmbBlock, `world/meshReader.js` dfMeshToModel, `world/climateSwaps.js`
  applyClimate, the plan and its model) over the player's own ARCH3D, BLOCKS and TEXTURE files, drawn by the slice's
  scratch rasterizer (never committed - a render of game data is game data); Solitude's, Mournhold's, Alinor's and
  Torval's landmarks the same way. `tools/urbanProbe.mjs` takes them in the running game, the same poses before and
  after; this session's shared machine killed its browser at every boot (below). Looked at, and changed for: a kerb at
  the walkers' step height (lowered under it, section 5); the setts' and the flags' courses read at a street's width;
  the low walls' coping and gate pillars; Daggerfall's fence along a yard's run, its gate open onto the street. Seen per
  province: Skyrim's Nord stone over grey granite setts, its yards fenced; High Rock's half-timbering over brown setts
  and brick; Hammerfell's and Morrowind's sandstone and ochre setts, their yards walled in adobe and stucco under a
  coping; Summerset's white limestone and ashlar walls; Valenwood's boardwalks along the house fronts.
- **The draw**, measured on the pixel's own static batch (`render/staticBatch.js` StaticBatchBuilder - one draw a texture
  group - fed every block model of the town as `scenes/pixelBuild.js` feeds it, Daggerfall's own models and pictures,
  before and with the fabric; 15 of Arena's city-states and 17 of its towns, every 29th and 71st): a city's pixel 88.7
  draws to 95.0 (+6.3 on the mean, +7 at the most), a town's 61.2 to 67.8 (+6.5, +8 at the most) - the fabric is ONE
  model merged into the batch, no draw of its own; its triangles 22.6k over the city's blocks' 27.7k and 12.1k over the
  town's 11.4k, most of them Daggerfall's fence (21 triangles a piece, a piece every 3.2 m of a yard's run) - a few
  thousand triangles a block beside the terrain's and the trees'. Its plan 767 ms and its model 339 ms on the mean on
  this session's loaded machine (four cores shared by nine sessions), each a breath at a time. The shot-mode counter in a
  browser (`tools/urbanProbe.mjs`) was not read: every boot of a probe's browser past the Bay was killed by the shared
  machine's memory before it reached the street.
- **Known edges**: the town's own pictures do not swap with the season (archives past 500 the climate law leaves as they
  are): in winter its paved ways read as swept; a re-skin of a standing pixel (PRECIP HOST-7) keeps its fabric. A home's
  yard (HOME-YARD) past the Bay may meet a fence where its lot meets the street. The Bay's towns stand no fabric.

## 8. Pins

`test/world/urban/urban1_look.test.js` (U1), `urban2_art.test.js` (U2), `urban3_fabric.test.js`, `urban3_model.test.js`,
`urban3_stand.test.js` (U3). Mutants `tools/mutants/urban.json` (53). PINS MOVED (URBANIZER U2): the capitals' models'
pictures (`test/tesa10_capitals.test.js`, `test/tesa10c_capitals.test.js`, `test/tesalore_capitals.test.js` - `sane`: a
landmark's pictures the capitals' own or the towns'). PINS MOVED (URBANIZER U1): the places' host's climate
(`test/tesa2_arena.test.js`, its arena location's line; `test/tesa7_country.test.js`, `townClimateAt` stubbed as the zone's
own). PINS MOVED (URBANIZER U3): the walkers' shut (`test/world/townfollow.test.js`, the town's own shut then the
fabric's), the town meshes in the town's climate (`test/systems/wd3_door.test.js`, five), the pixel's buckets riding
its state (`test/combat/blood1_decals.test.js`, nine; `test/scenes/perfcol2.test.js`, eight providers). Mutant records
re-aimed by content: `tools/mutants/tesa10.json` TESA10-host-politic (the capital's climate line),
`tools/mutants/tesalore.json` TESA-LORE-estate-gate-shut (the estate's wall now sandstone brick).
