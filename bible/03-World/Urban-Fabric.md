# Urban Fabric

The towns past the Bay in their own province's stone, with main streets and pavements, side streets, alleys, dead ends,
and fenced yards behind the houses. It covers every procedural town past the Bay: Arena's places, the countryside's
towns, the Imperial City's outskirts and the capitals other than the Imperial City. The Bay's towns stand as Daggerfall
lays them.

## How it works

- **A province's stone** (`src/world/urban/townLook.js`). Past the Bay a town's buildings wear its province's climate
  set, while its ground, trees, people and sky stay its zone's. Only the location's `climateType` moves
  (`withTownLook`, the zone's kept as `zoneClimateType`), so the buildings and their interiors swap together. Skyrim
  wears the Mountain set; High Rock and Cyrodiil the Temperate; Hammerfell, Summerset, Elsweyr and Morrowind the Desert;
  Valenwood and Black Marsh the Swamp. Some zones take another (`TOWN_LOOK_ZONES`): Wrothgar, the Ashlands, Red
  Mountain, the Velothi Mountains and the Jerall the Mountain set; Blackwood the Swamp's.
- **The towns' own pictures** (`src/world/urban/urbanArt.js`, `src/world/urban/urbanRecords.js`). Each province's
  paving, cobbles and walls, and cut stone, brick and half-timbering on the capitals' landmarks.
- **The plan** (`src/world/urban/townFabric.js`). The town's open ground is read at the walkers' 1.6 m cell
  (`src/world/city/cityNavigation.js`), so the plan and the people agree (`fabricGrid`). Buildings, water and every
  prop's cell and the eight round it are built; cells off the town's ground are off. Main streets run from the town's
  ends to its middle as the cheapest walk over open cells, kept off walls, with a carriageway up to 8 m between kerbs
  and pavements round it, joined at corners and dropped when too short (`paveWalks`). Side streets are Daggerfall's
  road; alleys are the narrow open ground between houses. Yards are Daggerfall's grass gardens touching a house,
  fenced on every edge onto a way or open ground, with a gate onto the street.
- **Under a prop** (`propGround`). A prop's clearance cells take the surface of the nearest ground outside them, so a
  sign, well or lamp stands on the street, not on a square of old ground.
- **The model** (`src/world/urban/townFabricModel.js`) lays the setts, flags, cobbles, kerbs, fences, gates and
  woodpiles.
- **Stood** (`src/world/urban/townFabricStand.js`). `fabricTown` picks the towns. `fabricEnds` gives the main streets'
  ends: a walled city's gates, a capital's gate sides, a city's four sides, a hamlet's long axis; villages get none.
  The world host plans the fabric in the pixel build (`src/scenes/pixelBuild.js`), before the yards and walkers are
  placed, so both keep off its fences, and merges its model into the pixel's static batch, solid. Plans are kept for
  the 24 most recent towns (`TOWN_FABRIC_KEEP`) and keyed by their ground (`fabricGroundKey`).

## Rules

- Buildings use more cut stone, brick and half-timbering; towns have inner yards and backyards; wide main streets with
  pavements, alleys, side streets and dead ends (KPbICA's spec, forwarded by Mac).
- Past the Bay only. The Bay's towns are Daggerfall's.
- Interiors follow the location's `climateType` (`src/scenes/worldModes.js`); the dungeon host and the exterior bench
  stand no town of this page.
- Tamriel: every province has a set and pictures of its own.

## Daggerfall Unity

DFU's `ClimateUse.UseLocation` reads the location's climate whole, and `DaggerfallLocation.LayoutLocation` lays the
blocks' ground as it is. Departures (URBANIZER): past the Bay a town's buildings wear its province's set, and the port
lays its own paving, kerbs, fences and walls over the blocks' ground.

## Code and tests

- `src/world/urban/` - look, art, plan, model and stand
- `test/world/urban/urban1_look.test.js` - the provinces' sets
- `test/world/urban/urban2_art.test.js` - the pictures
- `test/world/urban/urban3_fabric.test.js`, `urban3_model.test.js`, `urban3_stand.test.js` - plan, model and stand
- `test/world/urban/townboards.test.js` - the pavement ring and the town's own ground
- `test/world/urban/propground.test.js` - the street under a prop
- `tools/mutants/urban.json` - the mutants
