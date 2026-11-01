# Beautiful Towns: the town dress

Every town built from Daggerfall's blocks, in every province, stands as Daggerfall lays it and is dressed by our own
law: lamps along its streets, trade goods at its shops, taverns and temples, the zone's plants round its wells, and a
market of our own stalls near its middle. It takes the place of carademono's two town mods, Beautiful Villages of
Daggerfall 1.4.2 and Beautiful Cities of Daggerfall 0.5.0 (OWN-WORK, the owner; their record is in
`01-Overview/Own-Work.md`). No building moves, so every building key is Daggerfall's.

## How it works

- **The law** (`src/world/townDress.js`, pure). `DRESSED_TYPES` names the location types it dresses and how;
  `DRESS_PIECES` the pictures it stands, at the widths Daggerfall draws them; `TRADE_GOODS` a building's goods by its
  type; `WELL_FLORA` the plants round a well by its climate; `STALL_WARES` what a stall sells. Every piece keeps off a
  road, a door's step and the four metres before it (`DOOR_CLEAR_M`), every wall, model and flat, a home's lot, and
  what the town already stands. The answer is the same on every client.
- **The wiring** (`src/scenes/townDressHost.js`, in a town pixel's build). It hands the law the town's walk grid - its
  blocks' cells, ground, wall and painted paths, its yards, its port and its monument carved out - and the models of
  its blocks, then dresses the town before its blocks are drawn. It stands after the yards and the port, so none of
  theirs moves.
- **Our stall** is a model of our own shapes in the capitals' timber and cloth (`buildTownStall`, `TOWN_STALL_MODEL`),
  on the model door behind no switch (`installTownDress`).
- **The stand-ins** (`src/world/townStandIns.js`, `src/world/detStandIns.js`) stand at every boot for the decor
  catalogue: our own pieces for five peer mods the game does not carry, never a copy of a peer's file.
- **Homes made in a pack's layout** (`src/systems/layoutPins.js`). A save's building-keyed records (a bought house and
  its decor, a rented room, a quest site, a Recall anchor, an indoor save) carry the layout they were made in
  (`layoutStampOf`). A record stamped with a pack's layout cannot stand, so it sleeps (`recordStands`,
  `src/systems/banking.js` `deedStands`): no door, cupboard, bed or sale by it. The player is told once
  (`PINS_DROPPED_LINE`). A town's discovered buildings are forgotten when its layout moved
  (`src/systems/discovery.js` `pruneDiscoveryLayouts`).
- **Housing customisation.** A built-in piece can always be taken out (`src/net/decorLaw.js` `DECOR_BASE_KEY_RE`),
  including scenery furniture. A town's coloured bed rests the player as a classic bed does (`classicModelIdOf`).

## Rules

- Our own dress for every town (OWN-WORK, the owner). Missing peers are built as our own (Mac: "Build your own").
- Online the account service keeps the layout each home's town was bought in (`homes.layout`). A claim from a client
  whose town stands in another layout is refused (`src/net/homeLaw.js` `homeLayoutsMatch`), so a town holding a pack
  layout's home takes no new claim until that home is moved (`01-Overview/Own-Work.md`, Open).
- An interior landing takes only a spot with a floor (`src/player/enterExit.js` `interiorLanding`), and a room with
  nowhere to stand says "This house has nothing of value."
- Tamriel: the dress is the same in every province. The towns past the Bay are our own (`Urban-Fabric.md`,
  `Town-Shapes.md`).

## Daggerfall Unity

DFU stands a town's blocks as they are, with no dress of its own. Departures: our dress, and the sleeping record for
a home made in a layout no pack stands.

## Code and tests

- `src/world/townDress.js` - the law; `src/scenes/townDressHost.js` - the wiring
- `test/world/townDress.test.js` - the dress: what stands, where, and what it keeps off
- `src/systems/layoutPins.js` - stamps and the sleeping record
- `src/world/townStandIns.js`, `src/world/detStandIns.js` - the stand-ins
- `test/systems/wd3_layoutPins.test.js` - stamps, pins, cached scenes and discoveries
- `test/net/wd3_online.test.js` - the service's layouts
- `test/world/wd3_standins.test.js` - every stand-in
