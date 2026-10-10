# The Stables and the Wagon Yards (MERCHANT-YARDS)

THE PORT'S OWN (2026-10-10). Asked: *"I want to add 2 new merchants to each town without removing player's homes or
breaking anything. 1. The stable where you can purchase horses 2. Transport merchant where you can purchase
transports. These new places should get detailed locations, signs, sprites, etc that set them apart from other
places."* Of the wagons: *"Ensure the availability of the new transports are now super sparse"*, answered *"Transport
merchants hold all carts and wagons. The stable holds horses. No longer in general shop"*. Asked which form, which
towns and which signs: outdoor yards, cities and towns, the port's own drawn signs.

Daggerfall has neither: every General Store shelves the Horse and the Small Cart, and a town's blocks are fixed data in
which every building is already a home, a shop or a hall. So the two merchants are YARDS, not buildings - they take no
building record, no deed and no quest place, and the blocks' own automap bytes are untouched (the town map draws a yard
over a copy - YARDS-FOUND, below) - and the whole of it is a departure, Ledger A (MERCHANT-YARDS).

## Where they stand

**Which towns.** Every city and town - MAPS.BSA's `TownCity` and `TownHamlet` (`systems/merchantYards.js`
`isYardTown`; `systems/travelOptions.js` names them "city" and "town"). No village, farm, manor, temple or dungeon.

**The ground** (`world/merchantYardSites.js`). The town's own navgrid (`world/cityNavigation.js`, DFU's CityNavigation
carve: every automap byte a building, a tree or a lamp draws is closed, the water with it), always on the enhanced
lane's water table as LEFAY1's monument reads it, and over it what the town's blocks put in a yard's way
(`world/merchantYardSites.js` `yardMeasuresOf`, handed its measures by `scenes/world.js` `merchantYardSitesFor`):

- every **building**'s box (its ARCH3D size, `staticBuildingBox`, no mesh built; a registered model's own geometry -
  `placedModelBox`) kept `BUILDING_CLEAR_M` (6 m) away -
  HOME-YARD's lot margin (`scenes/homeYards.js` `YARD_MARGIN`), so no yard stands on a lot a home's or a guild hall's
  owner may decorate, nor before anyone's door;
- every **other model** (a wall, a well, a fence, a stall, a mod's carriage - and the town mods' boulders, stalls,
  hills, docks and city walls, which no ARCH3D record holds: measured by their own geometry, an alias by its classic
  model) `PROP_CLEAR_M` (1 m) away; a **crop field** (`world/flatFields.js`) by the ground its plants are sown over
  (`fieldRect`); every **flat** (a tree, a lamp, a sign, a person, and the editor's markers - a traveller's start
  marker, a quest's) `FLAT_CLEAR_M` (0.8 m) round its foot;
- a **palace's block** left whole (no yard in a castle's court - a palace read off the block's real buildings,
  `talkTopics.js` `blockBuildingCount`), the **colosseum's** block too (`world/arenaCity.js` `ARENA_BLOCK` - its model
  is built over the player's own, so it is never measured here), and LEFAY1's **monument** its own ground
  (`MONUMENT_KEEP_M`).

The measures are read off a layout laid out the same on every lane (the enhanced skin's, the mills stood - the pixel
build's own where it is that one), so a classic client and an enhanced one stand each yard on one spot; the sites are
kept per town while its measures stand (a rebuild of the pixel places nothing again).

**The place.** A yard is a rectangle (`YARD_FOOT`: the Stable 14 m by 11.5, the Wagon Yard 18 m by 13.5; its front, the
gate's side, along its +z), turned to one of the four axes (`YARD_TURNS`). Its own ground must be open and off every
road and path (the street stays clear); a ring of `YARD_PAD_M` (one cell, 1.6 m) round it open too, a road allowed
there - a yard stands beside a street. Of every place that fits, the one nearest the middle of the town's block grid
wins, a place whose front faces no road within `FRONT_ROAD_CELLS` costing `NO_ROAD_COST` (12 cells) more; ties to the
lower row, then the lower column, then the lower turn (`yardSite`, over summed-area tables: a whole city in tens of
milliseconds; every distance `Math.sqrt` of an exact sum, never `Math.hypot`, which each engine may approximate). The Stable is placed first, the Wagon Yard on what is left, `YARD_GAP_M` (3 m) clear of it
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

**The keepers.** A person of the town's own people (the race its walkers wear - `characters/mobilePerson.js`
`walkerRace`, REGIONAL-FOLK's law: the climate's People, a Redguard region's Redguard; both exterior hosts' populations
and the yards read it) in the idle record its walkers stand in, one of the race's four outfits; named on the region's
name bank on a seed of the town's map id and the yard's kind (`yardKeeper`, DFU's stream put back as it stood), so every
client meets the same keeper - and the yard is named for them: "Moorhart's Stables", "Jalib's Wagon Yard".

## The trade

- **The Stable sells the Horse; the Wagon Yard sells the Small Cart, the Open Wagon and the Caravan** (`yardStock`),
  each row minted as a shelf mints one. A yard never sells out: each Buy is its whole stock, minted afresh.
- **Each buys back its own and nothing else** (`yardBuysItem`): the Stable a horse, the Wagon Yard a cart or a wagon of
  any kind - a loaded wagon refused at the counter as everywhere (`systems/tradeModes.js` `sellGuardOf`). Online a sale
  is capped at half the least ask, as at every counter, so buying back never pays.
- **One counter's law.** The trade window a shop's counter opens, priced at `YARD_QUALITY` (10) and at
  `YARD_PRICE_INDEX` (DFU's neutral 1000, both ways, never the region's walk), so no yard is a cheaper one to buy at and
  a dearer one to sell to; the yard's counter tells it what it buys (`yardCounter`'s `accepts` - `scenes/worldModes.js`
  `openTradeWindow` asks it before DFU's table) and carries its name over the window (`yardName`). A regional
  holiday still halves a buy (DFU's holiday law); online the sale's cap, half the least ask, holds that to even.
- **The General Store no longer shelves or buys a horse, a cart or a wagon** (`systems/shopStock.js`: DFU's two
  `AddItem`s and WAGONS1's two wagons gone from its stock, `Transportation` gone from what it buys). The Stable page's
  empty line says where to go instead (`ui/holdingsPages.js`).

## The press

On the keeper or the signboard: the plaque names the yard, its keeper and its trade, with two rows - **Buy** (or a
press with no row lit) opens the yard's stock in the trade window, **Sell** opens it to sell to the yard; Info names the
keeper ("the stablemaster", "the wagonwright"); Steal takes nothing ("The keeper never takes an eye off the stock") - at
the press and in the trade window alike (`yardCounter`'s `noSteal`: the classic window's Steal says it and moves
nothing, the enhanced window stands no Steal).
A horse or a wagon on show is named on the plaque (a wagon with what it carries) and its press opens the Buy. Too far
speaks the street's refusal; the reach is a static NPC's (6.4 m). A press before the counter's art and font are loaded
(a yard is in the street, where no shop's entry may have loaded them) waits for them - one press waiting, the latest -
and opens only where it was pressed: the street, its slot still free (`openYardTrade`).

## The four hosts

- `scenes/world.js` - WIRED: each town pixel's build places its yards and carves the people's navgrid round them; the
  pool (`scenes/merchantYardsHost.js`) is made beside the monument, framed, drawn - in the street and in the view out of
  a window (`renderer.outsideViewDraws`) - its keepers and horses on the flats' axis, taken down at a re-anchor and a
  load; the hover names it; the press is handed to it. YARDS-FOUND: the town map, the talk directory and the
  Overworld's marks are handed its yards.
- `scenes/worldModes.js` - WIRED: the street's one ray reaches the yards (`yardTargets`), the `yard:` arm (the
  too-far refusal, the plaque's lit row) and the counter (`openYardTrade`). Its interiors stand no yard.
- `scenes/exterior.js` - FLAGGED: the single-town bench stands no yard.
- `scenes/dungeonContext.js` - stands no street: nothing here reaches it.

Nothing is saved or sent: where a yard stands is the town's layout, who keeps it its map id.

## Beside WAGONS3 and REGIONAL-FOLK (the merge, 2026-10-10)

MERCHANT-YARDS and WAGONS3 (`06-Systems/Wagons.md`) were built on two branches and landed together, after main had
taken REGIONAL-FOLK (`01-Overview/Field-Bugs-2026-10-10.md`). Three seams were settled on the merged tree:

- **One race law.** This branch had moved the climate's People map to `characters/mobilePerson.js` as
  `peopleRaceOf`; REGIONAL-FOLK had put the same map there as `raceOfPeople`, with `walkerRace` over it (a Redguard
  region's walkers are Redguards). Two homes for one table is the ONE EXPORT rule's fault, so `peopleRaceOf` is gone
  and the keepers wear `walkerRace(people, region)`, as the walkers do - Sentinel's stablemaster is a Redguard, as
  Sentinel's street is.
- **The second horse.** WAGONS3's Open Wagon and Caravan take a pair, and its refusal sent the player to a General
  Store for the other horse; the General Store sells none now, so it says "Buy another at a town's Stable."
- **The price and the team.** `systems/wagonKinds.js` carries WAGON-PRICE's `value` and `floor` and WAGONS3's
  `horses` on each kind.

## Not seen

This container holds no ARENA2, so no real town was laid out here: the yards' places are proven on synthetic grids
(`test/merchantyards1.test.js`) and the yards themselves in a software render of their own geometry, never in a
Daggerfall town. Where a town's open ground falls is for the owner's eyes - a town that finds no room logs it.

## Tests

`test/merchantyards1.test.js` - the towns, the stock, what each buys, the General Store's shelf and list, the keeper,
the place (its ground, its ring, its front, the turns), the measures, both yards apart and a laid-out town read as the
people's navgrid, the carve, the timber, the sign read from both sides, the art, the pool (standing, the wagons'
boxes coming in, a yard gone, no ground), the hold-back, the press and the plaque, the yard's frame, and the four hosts;
the audit's: the blocks' measures (`yardMeasuresOf`, `placedModelBox`, `fieldRect`), the tie-break, the yard's own
window (no Steal), the counter's index, name and word, the keepers' race, bank and outfits. Its mutants:
`tools/mutants/merchantyards1.json`, `tools/mutants/merchantyards1_audit.json`.

## AUDIT MERCHANT-YARDS (2026-10-10, five lenses over PR #748)

Five read-only lenses over the merged branch (the bench, the team and the harness, the yards' ground and pool, the trade
and the law, the merge and the records), then every finding traced from a real caller and fixed with its pin and its
mutant. The yards' findings:

- **Y1 (major) - the window's Steal.** Only the press refused a steal; the Buy window a yard opens is the shop counter's,
  and its Steal ran - a Caravan (25000) stolen at 11% risk for a master pickpocket, the press again minting another,
  each sold back at any Wagon Yard: gold without end, online too. `yardCounter`'s `noSteal`, through
  `openTradeWindow`'s `stealRefusal` to both windows (`ui/nativeTrade.js` `_doSteal`, `ui/enhancedTrade.js`).
- **Y2 (major) - the regions' prices.** A yard was priced at its region's walk, both ways; with endless, weightless
  stock, a Caravan bought where the index stood low sold where it stood high paid without end (ENDLESS-STOCK's loop).
  `YARD_PRICE_INDEX`, read by `shopAdjustment` off the counter.
- **G1 (major) - the town mods' ground.** Placement measured models by their ARCH3D record alone, so the town mods'
  boulders, stalls, walls and crop fields (no record, and fields sown only with a nature archive) were nothing to it, and
  a Stable could stand over a boulder or a field. `placedModelBox`, `fieldRect`; the colosseum's block left whole.
- **G2 - the engines and the cost.** `Math.hypot` decided ties (engines may approximate it - two browsers could stand a
  yard in two places) and the documented tie-break was not the one run (an early skip at an equal distance took the
  first turn found); the sites were placed again on every rebuild of the pixel. `Math.sqrt` of exact sums, the skip at a
  greater distance only, the sites kept per town while its measures stand.
- **G3** - the palace read past the block's real buildings into garbage slots (`blockBuildingCount`). **G4** - the
  editor's markers dropped, so a start marker could fall in a paddock. **G5** - the view out of a window drew no yard.
  **G6** - the host's header claimed a take-down at a change of place it does not make.
- **Y3** - the press waiting for the counter's art opened a window per press, wherever the player then was (over an
  interior's slot, over a talk). One wait, the latest press, the street's slot free or nothing. **Y5** - the counter had
  no name (" - Buy" over the window). **Y6** - the Holdings page promised a yard in every town.
- **Records and pins** - the keepers' race at the pool (R1: a Breton outfit for every keeper survived), the measures the
  host made itself (R2, now `yardMeasuresOf`), the keepers' bank and outfits (R4), the General Store's old claims in the
  ledger, Active-Arcs and three source comments (R5).

The online side was checked sound: no route in `server/` or `server-account/` sees a counter trade, so a `yard:*` type
and key 0 are refused or mis-logged nowhere; the item law's verdicts are unchanged by the price rise (`floor`).

## YARDS-FOUND (2026-10-10, from play)

The owner: "The new stable and transport merchant shops dont show on town maps/overworld", and "Ensure these
locations appear when talking to NPCs". The town maps draw a town off its blocks' automap bytes and letter the
buildings of its list, the Overworld marks places and parties, and the talk window's Where-is page lists the
directory's buildings. A yard is none of those, so a Stable stood in the street and no map, mark or person knew it.

**The talk directory** (`systems/merchantYards.js` yardDirectoryRows). Each yard is a row of its town's directory, in
the shape `systems/talkTopics.js` buildBuildingDirectory mints: its name ("Moorhart's Stables"), its counter's type
(`yard:stable`), YARD_QUALITY, its middle in the location's frame. Its key is YARD_KEY_BASE (1 << 25) and its kind's
place in YARD_KIND_ORDER - past every building's key (under 1 << 19 in the largest city) and past BUILDING_KEY_0
(1 << 24). `scenes/townTalk.js` rebuildDirectory joins the rows to the buildings', off the host's `yards`
(`scenes/world.js` syncTopics hands `cur.merchantYards`). The directory is the one list that answers for a building:

- the Where-is page: `systems/topicTree.js` assembleTopicListLocation stands a group each, "Stables" and "Wagon yards"
  (YARD_TALK_GROUPS), after the shops' groups and before General and Regional. Each row is asked as a building is
  (LocalBuilding, its key). The groups take their own variable, so C#'s shared one flows into the General section and
  the palace arm untouched. Without an engine, townTalk's own fallback (directoryByCategory) groups them the same way;
- the answer: the knowledge roll takes the yard's key as a building's, "%di of here" reads its middle off the
  directory (`systems/talk.js` buildingCompassDirection), and "Let me just mark %loc here on your map" discovers it by
  its key (`systems/answerPipeline.js` markKeySubjectLocationOnMap).

**The town map** (`world/merchantYardMap.js` yardTownBlocks, laid once at `ui/townMapDoor.js` createTownMapWindow for
whichever map the skin wears). The Arena's own law (ARENA-MAP), taken for the yards:

- every cell of a yard's ground is drawn in YARD_MAP_BYTE - the General Store's byte, the counter that sold the horse
  and the cart before the yards took them - so both maps wash it in the shop quarter's colour. The data rows run
  against +z as the navgrid's do, so the cells drawn are the ones the people's navgrid closes;
- its name is a `places` entry of the block its middle stands in, beside the block's `landmark`. Both the classic
  window (`ui/exteriorAutomapWindow.js` buildPlates) and the held map's sheet (`ui/townSheet.js` named) letter it
  always, in a shop's ink, and no record renames it;
- the rows are copies: a block a yard touches has its bytes copied, never written in place. The block's own bytes are
  the navgrid's and the next build's.

**The Overworld** (`scenes/merchantYardsHost.js` overworldMarks, pushed in `scenes/world.js` travelViewMarks). Each yard
standing is a mark: its name over its ground (YARD_MARK_LIFT, 4 m), and its kind is the look's (`yard stable`,
`yard transport`). The HUD draws its signboard's emblem (`ui/travelViewHud.js` yardGlyph): the Wagon Yard's wheel and
the Stable's horseshoe, opening up. The marks go with the Towns switch and are never counted as a town
(`systems/travelViewFilters.js` markGroup, countGroups). Only the yards of the towns built about the player stand;
a town beyond that build shows its plate, not its yards.

THE FOUR HOSTS (YARDS-FOUND): `scenes/world.js` - WIRED (the town map, the directory, the Overworld).
`scenes/exterior.js` - stands no yard (FLAGGED above), so it has none to hand. `scenes/worldModes.js` - its interiors'
talk window reads the same directory, so a yard is asked after indoors too (the compass's indoor arm measures from the
building). `scenes/dungeonContext.js` - no town.

Pins: `test/yardsfound1.test.js`. Mutants: `tools/mutants/yardsfound1.json`. Not seen in a real town (no ARENA2 here).
