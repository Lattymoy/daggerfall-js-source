# The Stables and the Wagon Yards (MERCHANT-YARDS)

THE PORT'S OWN (2026-10-10). Asked: *"I want to add 2 new merchants to each town without removing player's homes or
breaking anything. 1. The stable where you can purchase horses 2. Transport merchant where you can purchase
transports. These new places should get detailed locations, signs, sprites, etc that set them apart from other
places."* Of the wagons: *"Ensure the availability of the new transports are now super sparse"*, answered *"Transport
merchants hold all carts and wagons. The stable holds horses. No longer in general shop"*. Asked which form, which
towns and which signs: outdoor yards, cities and towns, the port's own drawn signs.

Daggerfall has neither: every General Store shelves the Horse and the Small Cart, and a town's blocks are fixed data in
which every building is already a home, a shop or a hall. So the two merchants are YARDS, not buildings - they take no
building record, no automap byte, no deed and no quest place - and the whole of it is a departure, Ledger A
(MERCHANT-YARDS).

## Where they stand

**Which towns.** Every city and town - MAPS.BSA's `TownCity` and `TownHamlet` (`systems/merchantYards.js`
`isYardTown`; `systems/travelOptions.js` names them "city" and "town"). No village, farm, manor, temple or dungeon.

**The ground** (`world/merchantYardSites.js`). The town's own navgrid (`world/cityNavigation.js`, DFU's CityNavigation
carve: every automap byte a building, a tree or a lamp draws is closed, the water with it), always on the enhanced
lane's water table as LEFAY1's monument reads it, and over it what the streaming host measures of the town's blocks
(`scenes/world.js` `merchantYardSitesFor`):

- every **building**'s box (its ARCH3D size, `staticBuildingBox`, no mesh built) kept `BUILDING_CLEAR_M` (6 m) away -
  HOME-YARD's lot margin (`scenes/homeYards.js` `YARD_MARGIN`), so no yard stands on a lot a home's or a guild hall's
  owner may decorate, nor before anyone's door;
- every **other model** (a wall, a well, a fence, a stall, a mod's carriage) `PROP_CLEAR_M` (1 m) away, and every
  **flat** (a tree, a lamp, a sign, a person) `FLAT_CLEAR_M` (0.8 m) round its foot;
- a **palace's block** left whole (no yard in a castle's court), and LEFAY1's **monument** its own ground
  (`MONUMENT_KEEP_M`).

The measures are read off a layout laid out the same on every lane (the enhanced skin's, the mills stood), so a classic
client and an enhanced one stand each yard on one spot.

**The place.** A yard is a rectangle (`YARD_FOOT`: the Stable 14 m by 11.5, the Wagon Yard 18 m by 13.5; its front, the
gate's side, along its +z), turned to one of the four axes (`YARD_TURNS`). Its own ground must be open and off every
road and path (the street stays clear); a ring of `YARD_PAD_M` (one cell, 1.6 m) round it open too, a road allowed
there - a yard stands beside a street. Of every place that fits, the one nearest the middle of the town's block grid
wins, a place whose front faces no road within `FRONT_ROAD_CELLS` costing `NO_ROAD_COST` (12 cells) more; ties to the
lower row, then the lower column, then the lower turn (`yardSite`, over summed-area tables: a whole city in tens of
milliseconds). The Stable is placed first, the Wagon Yard on what is left, `YARD_GAP_M` (3 m) clear of it
(`yardSitesOn`). The wandering people's navgrid is closed over each yard's ground (`carveYards`).

A town with no room for one stands none of it - said once in the console (`[yards] <town>: no room for ...`) - never a
yard over a house, a road or a lot.

## What stands

Both are the port's own geometry (`world/merchantYardModels.js`, every face wound outward, the collider the same
triangles) in the port's own art, made at boot under the pseudo-archive 38221 (`world/merchantYardArt.js`): weathered
fence timber, shed boards, split cedar shingles, straw, trodden earth, packed gravel, trough water, iron. Nothing of
Daggerfall's is read for either.

**The Stable.** A post-and-two-rail paddock fence round trodden earth; across its back a shingled lean-to of upright
boards with three stalls - bales stacked in one, a manger in the next, a pile of hay in the last; a water trough along
the paddock's side; a **gate arch** at its front, two tall posts and a beam over the way in, the signboard hung from the
beam on iron rods (its foot 2.4 m up - a walker passes under it); a hitching rail on the apron outside. Three horses
stand in the paddock - Horse Cart and Cargo's own standing horse, eight views, turned to the eye as a standing horse
turns - and the stablemaster inside the gate.

**The Wagon Yard.** A low post-and-rail fence on three sides round packed gravel, its front open wide; across its back a
wainwright's shed - a workbench, two wheels leant on the wall, a stack of planks, a barrel; on the apron a **signpost**,
its arm out over the street and the signboard hung from it. A Small Cart, an Open Wagon and a Caravan stand drawn up on
the gravel - Mac's own wagons (`06-Systems/Wagons.md`), drawn as a parked wagon is (`scenes/horseCartPool.js`
`drawShowWagon`), each its own box's middle on its place, its front to the street, its wheels on the ground - and the
wagonwright at the opening.

**The signboards.** A dark-stained board with a cream border, an emblem and the yard's word in painted capitals: the
Stable's iron horseshoe, its opening up for luck, and STABLES; the Wagon Yard's wheel - iron tyre, wooden felloe, eight
spokes - and WAGONS. Both faces carry the picture, each reading the right way round (the world is left-handed: from the
street, looking along -z, +x is on the viewer's left - the front's picture starts at +x, the back's at -x).

**The keepers.** A person of the town's own people (its climate's race, the walkers' law - `characters/mobilePerson.js`
`peopleRaceOf`, the one export both exterior hosts' populations and the yards now read) in the idle record its walkers stand in, one of the race's four outfits; named on the region's
name bank on a seed of the town's map id and the yard's kind (`yardKeeper`, DFU's stream put back as it stood), so every
client meets the same keeper - and the yard is named for them: "Moorhart's Stables", "Jalib's Wagon Yard".

## The trade

- **The Stable sells the Horse; the Wagon Yard sells the Small Cart, the Open Wagon and the Caravan** (`yardStock`),
  each row minted as a shelf mints one. A yard never sells out: each Buy is its whole stock, minted afresh.
- **Each buys back its own and nothing else** (`yardBuysItem`): the Stable a horse, the Wagon Yard a cart or a wagon of
  any kind - a loaded wagon refused at the counter as everywhere (`systems/tradeModes.js` `sellGuardOf`). Online a sale
  is capped at half the least ask, as at every counter, so buying back never pays.
- **One counter's law.** The trade window a shop's counter opens, priced at `YARD_QUALITY` (10, the same in every
  town, so no yard is a cheaper one to buy at and a dearer one to sell to); the yard's counter tells it what it buys
  (`yardCounter`'s `accepts` - `scenes/worldModes.js` `openTradeWindow` asks it before DFU's table).
- **The General Store no longer shelves or buys a horse, a cart or a wagon** (`systems/shopStock.js`: DFU's two
  `AddItem`s and WAGONS1's two wagons gone from its stock, `Transportation` gone from what it buys). The Stable page's
  empty line says where to go instead (`ui/holdingsPages.js`).

## The press

On the keeper or the signboard: the plaque names the yard, its keeper and its trade, with two rows - **Buy** (or a
press with no row lit) opens the yard's stock in the trade window, **Sell** opens it to sell to the yard; Info names the
keeper ("the stablemaster", "the wagonwright"); Steal takes nothing ("The keeper never takes an eye off the stock").
A horse or a wagon on show is named on the plaque (a wagon with what it carries) and its press opens the Buy. Too far
speaks the street's refusal; the reach is a static NPC's (6.4 m). A press before the counter's art and font are loaded
(a yard is in the street, where no shop's entry may have loaded them) waits for them, once (`openYardTrade`).

## The four hosts

- `scenes/world.js` - WIRED: each town pixel's build places its yards and carves the people's navgrid round them; the
  pool (`scenes/merchantYardsHost.js`) is made beside the monument, framed, drawn, its keepers and horses on the flats'
  axis, taken down at a re-anchor and a load; the hover names it; the press is handed to it.
- `scenes/worldModes.js` - WIRED: the street's one ray reaches the yards (`yardTargets`), the `yard:` arm (the
  too-far refusal, the plaque's lit row) and the counter (`openYardTrade`). Its interiors stand no yard.
- `scenes/exterior.js` - FLAGGED: the single-town bench stands no yard.
- `scenes/dungeonContext.js` - stands no street: nothing here reaches it.

Nothing is saved or sent: where a yard stands is the town's layout, who keeps it its map id.

## Not seen

This container holds no ARENA2, so no real town was laid out here: the yards' places are proven on synthetic grids
(`test/merchantyards1.test.js`) and the yards themselves in a software render of their own geometry, never in a
Daggerfall town. Where a town's open ground falls is for the owner's eyes - a town that finds no room logs it. The town
map and the "Where is" directory do not name the yards yet.

## Tests

`test/merchantyards1.test.js` - the towns, the stock, what each buys, the General Store's shelf and list, the keeper,
the place (its ground, its ring, its front, the turns), the measures, both yards apart and a laid-out town read as the
people's navgrid, the carve, the timber, the sign read from both sides, the art, the pool (standing, the wagons'
boxes coming in, a yard gone, no ground), the hold-back, the press and the plaque, the yard's frame, and the four hosts.
Its mutants: `tools/mutants/merchantyards1.json`.
