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
| TOWN-BOARDS | the boards on the ground in the smaller towns: the pavement a ring round the carriageway, the fabric on the town's ground alone (section 9) | FIXED |
| PROP-GROUND | the street laid under Daggerfall's props: no square of the old ground round a sign, a well or a lamp (section 10; AUDIT PROP-GROUND, section 11: a lamp's own cell, the street's laws, the flats on it) | FIXED |

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
  and lakes - is off the town (`isPortCell`), and so is a cell past the town's ground (TOWN-BOARDS, section 9: the
  outline TS2 flattens, `world/townShape.js` onTownTile - the walkers' own law). A cell the terrain painted a road over
  (TS10's paths) is a road of the town's, never a yard's grass (TOWN-BOARDS 2).
- **The main streets**: the ways from the town's ends to its middle (`world/urban/townFabricStand.js` fabricEnds, below),
  each the cheapest walk over the open cells (Dijkstra, four ways) - a cell 1 on Daggerfall's road and FABRIC.offRoad (2)
  more off it, FABRIC.mainCost (4) more for each cell its clearance falls short of FABRIC.mainWant (2.5): the town's own
  lanes, kept off its walls. Its carriageway is every open cell within FABRIC.carriage (2.5 - 8 m between its kerbs) of
  the walk that the walk reaches over such cells (TOWN-BOARDS 2: never past a wall or a house's corner into a pocket
  beyond it); its pavements the open cells round the carriageway FABRIC.kerb (1) deep by the eight ways - beside it or
  across its corner, so they run on unbroken round every step of the walk (TOWN-BOARDS, section 9) - and its carriageway
  wherever a house stands within FABRIC.pave (1): a street as wide as the houses let it be, its pavements along their
  fronts. A pavement is a walk (`paveWalks`, TOWN-BOARDS 2): two that meet at a corner alone across the street's ground
  are joined there, and one shorter than FABRIC.paveLeast (4 cells, 6.4 m) along its longer side is not laid - its cells
  the street's own surface; a piece of the carriageway no walk runs down and as short is the pavement's round it.
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
  5,000,000, and on) is never reused in a session. TOWN-BOARDS: a plan is its town's and its ground's (`fabricGroundKey`) -
  asked on another ground (the land landing under a standing town) it is planned again and its old model let go.
- **THE FOUR HOSTS.** `scenes/world.js` - WIRED, through its pixel build (`scenes/pixelBuild.js`): the fabric planned as the
  town is laid out (`townFabricFor`, a breath between its steps, on the terrain job's `townGround` - TOWN-BOARDS) - before
  its yards (MERCHANT-YARDS, SHIPYARDS) and its walkers are placed, so both keep off its fences (`fabricWalkShut`: the town's own walk shut, then the fabric's) - and
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

## 9. TOWN-BOARDS - the boards on the ground in the smaller towns (FIXED, 2026-10-27)

The owner's field report, 2026-10-27, item 3: *"Random wooden board placement in smaller towns on the ground"*.

**What the player saw.** Wood lying at the ground's level where no board belongs, in the towns past the Bay - two
things of this page's fabric, nothing of Daggerfall's:

- **A boardwalk of single boards.** Valenwood's and Black Marsh's main streets (the planks' style lays no carriageway:
  a street is its forest floor between two boardwalks) came apart into boards a cell (1.6 m) or two long, each on its
  own, stepped one behind the next down the street. The stone styles showed the same as single flags apart.
- **Fences sunk into the land.** At a village's or a hamlet's edge a yard's fence ran on down the land past the town -
  buried to its top rail, the rail and its posts' tops lying along the slope, or hung where the land fell away; a
  woodpile with it, a hamlet's pavement under the land.

**Why (1) - the pavement a band in straight lines.** A main street's pavement was its open cells between
FABRIC.carriage (2.5) and 3.5 of its walk, measured in straight lines: a band one cell wide. The walk is four ways (a
staircase wherever the street turns or runs aslant), and a band one cell wide round a staircase meets its next cell at
a corner alone at every step - each of its cells a piece of its own, laid as its own board with a kerb on every side.

**Why (2) - the fabric past the town's ground.** `fabricGrid` took every cell of a town's blocks as the town's. TS2
(`03-World/Town-Shapes.md`) flattens only the town's outline - its buildings', walls' and props' tiles and a wandering
margin, its sea given back (`world/terrain/terrainTiles.js` townGroundMask, the terrain job's `townGround`) - and eases
the rest of its blocks' ground back to the land over 77 m. The fabric is one model stood at the flattened level
(`scenes/pixelBuild.js` locLocal), so a yard of Daggerfall's grass reaching past the outline (a village's blocks are
mostly grass round a few houses) was fenced down the land's slope. A city past the Bay stands on its wall's round (TS4),
which holds nearly all of it.

**The fix.** (1) The pavement is the carriageway's ring by the eight ways, FABRIC.kerb (now 1) deep - every open cell
beside the carriageway or across its corner (`maxNear` of the carriageway, `world/urban/townFabric.js` planSteps) - and
the carriageway's cells within FABRIC.pave of a house, as before: it runs on unbroken round every step of the walk. (2)
The plan is made on the town's ground: `fabricGrid` takes `onGround`, the stand hands it the terrain job's townGround
(`townFabricFor`'s `ground`, `scenes/pixelBuild.js`), and a cell past it is off the town as a left-out cell is - its
yard fenced where the ground ends, on the flattened edge. The law is the walkers' own: `world/townShape.js`
onTownTile, which shutOffGround now reads too (TS6). A plan is its town's and its ground's (`fabricGroundKey`): asked
on another ground it is planned again and its old model let go (a build that planned it meanwhile is kept for both:
its model is never pulled from under a build that has it in hand). Nothing is filtered after the fact: every board and
fence the fabric lays has a cell of the street or a yard of the town's own ground under it.

**Measured on the freeware** (`tools/townBoardsSweep.mjs --every 1 --land 10`, before on the branch's base and after:
every template past the Bay cloned under a map id of its own, outlined, its wall stood and its fabric planned through
the stand; every tenth laid on its template's own pixel as the terrain kernel flattens it, each fence edge, woodpile and
pavement cell read against the ground under it - buried past 0.4 m, hung past 0.4 m, a pavement under the land past
its own 0.13 m):

| | before | after |
|---|---|---|
| 1,200 hamlets: pavement pieces, under four cells, steps | 79,428, 40,052, 31,419 | 37,886, 8,732, 4 |
| 407 cities: the same | 74,938, 36,045, 27,845 | 37,299, 8,369, 0 |
| 1,834 villages off their ground: fence edges, gates, woodpiles | 15,640 (25 km), 84, 154 - in 588 villages | 0 |
| 1,200 hamlets off their ground: fence edges, gates, woodpiles, pavement, carriageway | 11,605, 165, 107, 6,222, 19,681 - in 465 | 0 |
| 407 cities off their ground: fence edges, gates, woodpiles | 620, 4, 2 - in 18 | 0 |
| on the land, 184 villages: fence edges buried, hung; woodpiles | 101, 142; 1 - in 16 villages | 0 |
| on the land, 120 hamlets: fence edges buried, hung; woodpiles; pavement cells under it | 85, 154; 3; 242 - in 19 hamlets | 0 |
| on the land, 41 cities | 0 | 0 |

The worst: Holmarket's yard fence buried 13.1 m in its hillside, Hortower Derry's and Aldingmoth Wood's hung 2.0 and
2.1 m, Blackcester's buried 1.9 m. The short pavements left (under four cells) each lie along a house's front or round
its corner (6,432 in the hamlets) or between the carriageway's edge and one of Daggerfall's props (2,293 - a fence, a
well, a lamp, each standing in its cell and the eight round it); 4 steps remain in three hamlets (Deershire, Khajinria,
Longwell), each where a main street squeezes between two houses' corners and the pavement before both fronts all but
fills the neck. ON THE BAY: every village and hamlet (3,034, their 298 blocks as the door serves them, both town packs
on) stands no fabric, and nothing of Daggerfall's timber (TEXTURE.067) lies on the ground in any of their blocks - the
pieces that do lie flat are grave slabs (43035-43038, 43051, 43053: TEXTURE.041/073/141/341) and rugs (74804, 74806:
TEXTURE.049).

**Seen** - the scratch rasterizer of section 7 (never committed), the game's own layout and the fabric's model over
the player's ARCH3D and BLOCKS, with the terrain kernel's ground under it: before, Westtale's planks main street a
scatter of boards one and two cells long and a village's yard fence buried to its top rail along its south edge; after,
two boardwalks unbroken down the street and the fence standing on the town's flattened edge. The running game was not
photographed: this session's shared machine killed the probe's browser before the stream went idle (a Bay village, 16
minutes, 60 frames).

**Pins**: `test/world/urban/townboards.test.js` (6 - the ring round a turning street, the fabric on its ground, the one
ground law, the stand's ground and its keeping, the host's wiring, and with ARENA2 the world's small towns, on the Bay
and past it). Mutants `tools/mutants/townboards.json` (12, all dead). PINS MOVED (TOWN-BOARDS):
`test/world/urban/urban3_fabric.test.js` (FABRIC.kerb 1; a pavement round the carriageway, not within 3.5 of the
walk), `test/world/urban/urban3_stand.test.js` (the host's line, its `ground`). Mutant records re-aimed by content:
`tools/mutants/urban.json` U3-the-pavement-band-swapped (the ring's line), `tools/mutants/townfollow.json`
TF-the-origin-unread and TF-the-rows-turned (shutOffGround through onTownGround).

## 10. PROP-GROUND - the street under a prop (FIXED, 2026-10-30)

The owner's field report, 2026-10-30, a picture from Alinor: *"Ever since we changed town lauouts and stuff props
still sit on old textures"*.

**What the player saw.** A shop's hanging sign on its post stood in a square of Daggerfall's old ground, dark flagstones
4.8 m a side, with the new setts on one side and the pavement's flags on the other. Every misc model and flat of
Daggerfall's in a street past the Bay stood the same way: a sign, a well, a lamp, a tree in a square.

**Why.** `fabricGrid` builds a prop's cell and the eight round it (section 4), so no walk, pavement or yard runs
through it. The model laid its setts, flags and cobbles by `kind` alone, and a built cell got none: the terrain's own
ground tile showed through, 5 cm under the street.

**The fix.** The cells stay built in the plan: the walkers, the yards (MERCHANT-YARDS reads `kind`) and the pavement's
joins (`paveWalks`) see the prop as before. Beside `kind` the plan carries `under` (`world/urban/townFabric.js`
propGround): each clearance cell takes the surface of the nearest ground outside it, by a walk four ways through the
clearance - the most common face one step nearer, a tie the setts' and the cobbles' (the ground's level) before the
flags', a street's before none. A house, the water or a special's town-map byte is no source, so a sign between a shop
and the street stands on the street. A cell nearest a yard, an alley or open ground keeps Daggerfall's ground, as round
it. The audit (section 11) found this short of the street's own laws and rebuilt it there.

**Heights.** The setts and the cobbles are at a misc model's own foot (FABRIC_ROAD_Y 0); a model in the pavement stands
in its flags 8 to 10.5 cm deep (FABRIC_PAVE_Y), under the walker's 0.1 m step. AUDIT PROP-GROUND corrected this
paragraph: it said Daggerfall's flats stand 15 cm into the ground. 11,293 of the 11,335 drawn misc flats stand on the
land itself (yPos -4: 5 cm under the setts, 13 cm under the flags); section 11 stands them on the street.

**Measured on the freeware** (the slice's scratch measure, every template past the Bay cloned and outlined as section
4's table, and the capitals but the Imperial City; a "hole" is a clearance every ground beside which is a laid street):

| | holes, their cells | bare after | clearances half in a street | their cells left bare (nearest other ground) |
|---|---|---|---|---|
| 407 cities | 23,902, 91,475 | 0 | 45,292 | 108,315 |
| 1,200 hamlets | 1,903, 5,651 | 0 | 9,904 | 20,912 |
| 459 villages (every fourth) | 0 - no main streets, Daggerfall's lanes | - | 0 | - |
| Alinor | 85, 308 | 0 | 151, 966 cells | 343 |
| Solitude, Mournhold, Falinesti, Torval, Helstrom | 57 to 131 each | 0 | 137 to 236 each | 322 to 534 each |

Every hole had been bare: the old model laid by `kind`, which this did not change. Looked at on Alinor's grid, cell by
cell: a sign's clearance at a cobbled side street's edge laid in cobbles on the street's side and Daggerfall's dirt on
the open ground's. The running game was not photographed. AUDIT PROP-GROUND: the table counts `prop` cells alone, so the
lamps' own cells (bytes 250 and 251) never entered it; Falinesti and Helstrom are of the planks' style, where `main`
and `side` are labels the model draws nothing for.

**THE FOUR HOSTS.** `scenes/world.js` - WIRED through its pixel build, which stands the fabric's model (no host line
moved). `scenes/worldModes.js` (interiors) - no street. `scenes/dungeonContext.js` - no street. `scenes/exterior.js` -
streams no land past the Bay. The Bay's towns stand no fabric (`fabricTown`): their props stand on the ground their
blocks lay, as Daggerfall's do.

**Pins**: `test/world/urban/propground.test.js`, rewritten by the audit (section 11). Mutant record re-aimed by content:
`tools/mutants/urban.json` U3M-a-kerb-against-a-house (the kerb's test reads the laid surface).

## 11. AUDIT PROP-GROUND - the street under a prop, read cold (FIXED, 2026-10-31)

The owner: *"Audit"*, of PROP-GROUND (section 10, `3582fe992`). Three cold lanes on that frozen head, each given the code
and not its writer's reading, each finding proven on the freeware: A the plan, B what is drawn, C the pins and the
record. Every finding below is fixed; every number in section 10's table reproduced.

**Paid.**
- **A lamp still stood on old ground** (A1, C1). The town map marks a misc model's own cell 250 and a ground flat's 251
  (`ui/town/townQuarters.js` SHOWALL_SET - furniture, not buildings), and `fabricGrid` kept them off `prop`: in the
  cities 4,197 of the 9,755 records the street closed round stood on a bare cell; 112 of 915 street lamps in a 3.2 m square.
- **Lone flags** (A2): the last step laid single flags the TOWN-BOARDS law forbids - 745 pieces in 102 cities.
- **Notches and setts on the dirt** (A3): a cell laid in cobbles in the setts' ring broke the pavement; setts met other
  ground with no pavement between.
- **Flats under the street** (B1, C4): a misc flat stands on the land, 5 cm under the setts and 13 cm under the flags -
  31,632 flats in 1,607 towns newly on laid cells, a town horse's hooves among them.
- **A foot plate flickering** (B3): ARCH3D 41712's foot plate lay in the setts' own plane in 9 towns and under the flags
  in 2. Measuring every RMB block's misc models found 43603's too, 4 mm under the setts.
- **Kerb feet hung** (B5): a kerb ran from the setts' height whatever lay past it, 5 cm over the land - an older edge the
  slice added 22,952 of (619,907 to 642,859 over 1,607 towns).
- **Pins that did not pin** (C2, C3, C5): six mutants lived (a prop's cobbles unlaid, a kerb onto them, the tie order,
  the walk's layers); the ARENA2 pin restated its own rule; two fixtures were shapes no producer mints.
- **The record** (B2, B6, C4, C6, C7): the 15 cm claim, the planks' capitals' labels, the model's header, a test name's
  mutant that did not exist, `01-Overview/Active-Arcs.md`'s line. A4: a breath before the props' street.

**The street under a prop, as built.** The grid (`world/urban/townFabric.js` fabricGrid): `prop` is a record's cell and
the eight round it, and the town map's furniture bytes on land. A model with a face at a street face's height
(FOOT_FACED, measured) is read from its record's id: at the setts' height its foot plate's cells are bare (footPlate,
`townFabricStand.js` - the plate where RMBLayout stands the model, `world/rmbLayout.js` miscModelMatrix, now one
export); at the flags' height its ground is `flagless`. Then `propGround` lays each prop cell:

1. the nearest ground's face (the slice's walk, kept);
2. THE STREET'S LINES (propLines): where a row or a column through the prop's ground meets one face at both ends, that
   face - the shorter line where they disagree;
3. THE STREET'S LAWS (propLaws), on the props' cells alone: a flagless cell never flags; setts beside other ground by
   the eight ways, or before a house, the pavement's; a cell beside the setts the pavement's (the ring); `paveWalks`
   over the street as laid, its new `may` the props' cells - no lone slab, no island, with the main streets' walks. A slab
   it drops that meets no setts takes the cobbles round it where they hold as many sides as the bare ground.

Why the lines: a walk detours round a prop. At the well of section 10's own pins the nearest ground put dirt in the
pavement's line and pushed flags into the setts; the main streets' law read again with the props' ground open was
tried and left: from the detoured walk it read the well's pavement line as past the street and laid cobbles in it.

**What is drawn.** `fabricFaces` (`townFabricModel.js`) is the one law the model lays by and a flat is stood on: setts
where the style lays a carriageway, cobbles on a city's side streets, flags. A kerb runs from the flags down to the face
laid past it, or to the land (FABRIC_LAND_Y, -0.05 m - `scenes/pixelBuild.js` locLocal's 2 x 0.025). THE HOST: the
pixel build stands every block flat but the nature's on the street its fabric lays (`townFabricStand.js` fabricLift):
its misc flats, its town horses and people (STAND-FLAT), its StaticNPCs, its animals' and springs' places. DEPARTURE
(named; Port-Ledger section A, URBANIZER): from `RMBLayout.AddMiscBlockFlats`, which stands a flat at its record's
height on the land.

**Measured on the freeware** (every fourth city, every twelfth hamlet, the capitals but the Imperial City, as section
10's table clones them; before at `3582fe992`, after on this branch):

| | 102 cities | 100 hamlets | 6 capitals |
|---|---|---|---|
| a prop's cells inside the laid street (water's furniture aside) | 27,876 | 516 | 2,431 |
| of them bare, before -> after | 11,965 -> 0 | 332 -> 0 | 1,085 -> 0 |
| lone flags with a prop's cell, before -> after | 745 -> 0 | 348 -> 0 | 37 -> 0 |
| a prop's cobbles beside the setts | 1,176 -> 67 | 392 -> 17 | 73 -> 0 |
| a prop's bare cell beside the setts | 13,299 -> 211 | 4,974 -> 74 | 595 -> 3 |
| a prop's setts beside other ground | 5,669 -> 536 | 1,995 -> 186 | 326 -> 9 |

In the same 202 towns, each laid in a stone style, 9,720 of 46,324 misc flats stand on the street now - 7,968 on setts
or cobbles (5 cm up), 1,752 on flags (13 cm up), 5,827 of them lamps. The island law moves a prop's cell in 4 towns of 1,007 (6 cells).

**Known edges.** What is left beside the setts is `paveWalks`' own law: a slab it drops back to setts may meet other
ground, as on the street's own cells. A misc model is not lifted: in the pavement it stands in its flags 8 to 10.5 cm.
FOOT_FACED is measured on ARENA2's blocks; the world-data packs' blocks and models are not. A flags edge onto a prop's
bare cell still has no kerb. The running game was not photographed.

**THE FOUR HOSTS.** `scenes/world.js` - WIRED, through its pixel build (the flats' lift, `scenes/pixelBuild.js`).
`scenes/worldModes.js` (interiors) - no street. `scenes/dungeonContext.js` - no street. `scenes/exterior.js` - streams no
land past the Bay. The Bay's towns stand no fabric (`fabricTown`).

**Pins**: `test/world/urban/propground.test.js` (8 - the grid, the laws and their corners, the plan over its walks, the
model, the faces and the lift, the host's flats, a foot plate turned, and with ARENA2 FOOT_FACED and the plates measured
again, the towns' laws, Stoking's island and a Bay town). Mutants `tools/mutants/propground.json` (41, all dead), lane
C's six survivors among them. PINS MOVED: `urban3_fabric.test.js` and `urban3_stand.test.js` (a fifth breath, a
record's id and plate), `urban3_model.test.js` (`under` as the producer mints it, the kerbs' feet),
`test/world/solitude_relief.test.js` (its people's and flats' lines, a kerb's foot on a tier's land),
`test/world/terrain/natureground.test.js` and `test/world/fb1003b_trees.test.js` (a flat's line). Mutant records re-aimed by content: `natureground.json` (2),
`townboards.json` (4, `paveWalks`' `may`), `urban.json` U3M-cobbles-in-a-hamlet (fabricFaces).
