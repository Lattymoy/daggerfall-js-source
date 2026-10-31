# The Stables, the Wagon Yards and the Joinery

Three outdoor yards in every city and town: the Stable sells horses, the Wagon Yard sells carts and wagons, and the
Joinery is a working Carpentry station. Each has its own fence, shed, sign, stock on show and keeper, and is found on
the town map, in talk and on the Overworld. The player meets them in the street of any town in Tamriel.

## How it works

- **Which towns.** MAPS.BSA's `TownCity` and `TownHamlet` (`src/systems/merchantYards.js` `isYardTown`). No village,
  farm, manor, temple or dungeon.
- **The ground** (`src/world/merchantYards/merchantYardSites.js`). The town's own navgrid
  (`src/world/city/cityNavigation.js`) on the enhanced water table, with every building's box kept 6 m off (a home's lot
  margin), other models 1 m, crop fields and flats their own clearance, and a palace's and the colosseum's blocks left
  whole. A layout is read the same on every lane, so every client stands each yard on one spot.
- **The place** (`yardLawSteps`). A yard is a rectangle (`YARD_FOOT`: Stable 14 x 11.5 m, Wagon Yard 18 x 13.5 m,
  Joinery 14 x 12 m) turned to an axis, its ground open and off every road, path and planned street, with a ring of
  open cells round it. Its gate faces a way wherever the town has such a place. The Stable stands at the town's edge
  by its road out; the Wagon Yard and the Joinery on a street's or a square's side nearest the middle. A house's garden
  is used only when the town has no other room. A capital that names its own yards stands those
  (`src/world/imperialYards.js`).
- **Order.** The Stable and Wagon Yard are placed first, a port town's shipyard and lighthouse on what they leave, then
  the Joinery (`craftYardSitesOn`). A town with no room stands none and logs it once. The people's navgrid is closed
  over each yard (`carveYards`).
- **What stands** (`src/world/merchantYards/merchantYardModels.js`), in the port's own art made at boot
  (`src/world/merchantYards/merchantYardArt.js`, pseudo-archive 38221). The Stable: a paddock fence, a shingled
  lean-to with three stalls, a trough, a gate arch with its board, three horses standing and the stablemaster. The
  Wagon Yard: a low fence open at the front, a wainwright's shed, a signpost, a Small Cart, an Open Wagon and a Caravan,
  and the wagonwright. The Joinery: a fence round a shavings floor, an open workshop with the workbench, a tool board,
  timber racks, logs, sawhorses and finished furniture, and the carpenter.
- **Signboards** hang from a beam or arm, painted on both faces to read the right way round: horseshoe and STABLES,
  wheel and WAGONS, saw and JOINERY. A board is a ray's and no body's, so a rider rides in under it.
- **Keepers** are the town's own people (`src/characters/mobile/mobilePerson.js` `walkerRace`), named from the
  region's name bank on a seed of the town's map id and the yard's kind (`townKeeper`), and the yard is named for them:
  "Moorhart's Stables".
- **The trade.** The Stable sells the Horse (three horses a day, each its own - `06-Systems/Horse-Care.md`); the Wagon
  Yard sells the three carts and wagons and Wagon Repair Kits, and its keeper's Mend row repairs the wagon driven. Each
  buys back its own kind only (`yardBuysItem`). A yard never sells out. Prices use `YARD_QUALITY` (10) and
  `YARD_PRICE_INDEX` (DFU's neutral 1000) both ways. Steal takes nothing.
- **The Joinery's bench.** A press on the carpenter, the board or the bench opens the Stores page on The Workbench. Near
  any of the joinery's boxes the street's workbench question answers a shop's bench at the furnisher's fee
  (`workbenchNear`).
- **Found.** Each yard is a row of its town's talk directory (`yardDirectoryRows`; keys past `YARD_KEY_BASE`), with
  Where-is groups "Stables", "Wagon yards" and "Carpenters". The town map draws its ground in the General Store's byte
  and letters its name (`src/world/merchantYards/merchantYardMap.js`), on copies of the block's bytes. The Overworld
  marks each yard with its board's emblem under the Towns switch.
- **Hosts.** `src/scenes/world.js` places the yards in each town pixel's build (`townPlacesFor`) and runs the pool
  (`src/scenes/merchantYardsHost.js`). `src/scenes/worldModes.js` carries the street ray's `yard:` arm and the counter.
  The exterior bench and dungeons stand no yard.

## Rules

- Two new merchants in each town, without removing player homes or breaking anything, with their own locations, signs
  and sprites (the owner). Transport merchants hold all carts and wagons; the stable holds horses; the General Store no
  longer sells or buys them (the owner; `src/systems/shopStock.js`).
- A new Carpenter's Yard in each city and town, its workbench a working Carpentry station, the Furniture Store left as
  it is (Mac).
- Yards have logical placements world-wide: never on a way, in a wall, a building, water or a field; a stable at the
  edge by a road or gate (the owner).
- Yards take no building record, deed or quest place, and the blocks' own automap bytes are untouched.
- Nothing is saved or sent: where a yard stands is the town's layout, and its keeper is its map id's.

## Daggerfall Unity

Daggerfall has no yards: every General Store shelves the Horse and the Small Cart. The yards are the port's own
departure (MERCHANT-YARDS, CARP-YARD).

## Code and tests

- `src/systems/merchantYards.js` - kinds, towns, stock, keepers, directory rows
- `src/world/merchantYards/` - sites, models, art, town map
- `src/scenes/merchantYardsHost.js` - the pool, the press, the Overworld marks, the bench
- `test/world/merchantyards1.test.js` - towns, stock, buying back, the General Store, keepers, placement
- `test/systems/yardsfound1.test.js` - the directory, town map and Overworld
- `test/systems/carpyard1.test.js`, `test/scenes/fb1020c_benchdoors.test.js` - the Joinery and its bench reach
- `test/world/icprops_yards.test.js` - placement world-wide

## Open

- Not seen in a real town in the game by eye; placement is measured on the freeware's towns.
