# Beautiful Villages and Beautiful Cities

Ports of carademono's two town mods: **Beautiful Villages of Daggerfall 1.4.2** (7,317 villages, hamlets, farms,
wealthy homes and temples, and the roadside taverns through their blocks) and **Beautiful Cities of Daggerfall 0.5.0**
(the 410 cities). They rebuild the Iliac Bay's towns with new layouts and blocks. Both ship as one pack each of the
authors' edits over the player's own MAPS.BSA and BLOCKS.BSA (`02-Formats/World-Data-Patches.md`; provenance in
`vendor/beautiful-villages/README.md` and `vendor/beautiful-cities/README.md`).

## How it works

- **The switches.** Each is one switch in the Mods pane, on by default. Each is read once when the world-data loader
  runs at game start, and latched (`src/scenes/modWorldData.js`), so a town never moves under the player. Offline the
  towns also need Replace Game Artwork, also read once.
- **Priority.** Both mods ship `FIGHBM00.RMB`; as in DFU the later-loaded mod (Beautiful Cities) answers. The door keeps
  every mod's entry for a name, highest priority first, and the first whose switch is on answers
  (`src/formats/worldData/worldDataReplacement.js`).
- **The housing promise** (`src/systems/layoutPins.js`). A building is known by where it stands, so a layout change
  would wake a save's records in another building. Every such record (a bought house and its decor, chests, yard and
  look; a rented room; a quest building and its markers; a questor met indoors; an item at a smith; a Recall anchor; an
  indoor save; automap names) is stamped with its town's layout when made (`layoutStampOf`; nothing for Daggerfall's
  own town). A load pins each town its records hold to that layout (`pinsFrom`), and the world-data door serves a pinned
  town exactly that layout. A pinned town is rebuilt when a load changes its answer. A deed whose town cannot stand in
  its layout sleeps (`src/systems/banking.js` `deedStands`): no door, cupboard, bed or sale by it. A town is released
  once nothing holds it.
- **Cached interiors and discoveries.** An interior's cached scene is restored only into its layout; a house's scene
  for another layout is kept unrestored. A town's discovered buildings are forgotten when its layout moved
  (`src/systems/discovery.js` `pruneDiscoveryLayouts`).
- **Stand-ins.** Both mods place pieces from five peer mods the port does not carry (RMB Resource Pack, DET, Rosy's
  Resources, New Paintings, DET Harvestable Crops) and beds whose prefabs point at nothing. Each is the port's own
  stand-in, made for the places the author put it (`src/world/townStandIns.js`, `src/world/detStandIns.js`), never a
  copy of a peer's file.
- **Housing customisation.** A built-in piece can always be taken out (`src/net/decorLaw.js` `DECOR_BASE_KEY_RE`, five
  digits for an archive), including scenery furniture. The decor preview builds stand-ins and alias beds from the
  player's own ARCH3D. The catalogue offers the stand-ins while their mod stands. A town's coloured bed rests the
  player as a classic bed does (`classicModelIdOf`).

## Rules

- Implement both with permission, without conflicting with or regressing anything, housing customisation above all;
  curate anything missing, like textures (Mac). Missing peers are built as the port's own (Mac: "Build your own").
- Online the two switches are the room's, forced on (`src/systems/online/onlineLane.js` `ONLINE_ROOM_MOD_KEYS`). The
  account service keeps the layout each home's town was bought in (`homes.layout`); a claim from a client whose town
  stands in another layout is refused (`src/net/homeLaw.js` `homeLayoutsMatch`). Every client reads the towns'
  layouts and builds them as the room's.
- Curation against Daggerfall's own laws: an interior landing takes only a spot with a floor
  (`src/player/enterExit.js` `interiorLanding`), and a room with nowhere to stand says "This house has nothing of
  value."; 34 of Arkay's standalone temples, whose mod layout has no house for a quest to seat anyone in, stay
  Daggerfall's own (`CURATED_CLASSIC`); the roadside taverns whose mod blocks hold no tavern keep Daggerfall's.
- Untouched: dungeons, graveyards, poor homes, covens, cults and the two ship pixels.
- Tamriel: the mods rebuild the Bay's towns only. The towns past the Bay are the port's own (`Urban-Fabric.md`,
  `Town-Shapes.md`).

## Daggerfall Unity

DFU serves the mods' world-data files through `WorldDataReplacement` and lets a save's records wake in the wrong
building when a layout changes. Departures (WD3): the layout pins, the sleeping deed, the stand-ins for missing peers,
the floor-checked interior landing and the curated classic towns.

## Code and tests

- `src/systems/layoutPins.js` - stamps, pins and curated towns
- `src/scenes/modWorldData.js` - the latched loader
- `src/formats/worldData/worldDataReplacement.js` - the door and its priority
- `src/world/townStandIns.js`, `src/world/detStandIns.js` - the stand-ins
- `test/formats/worldData/wd3_pack.test.js` - the packs; with ARENA2 every file rebuilt exactly
- `test/systems/wd3_door.test.js` - priority, the door, pinned towns, the loader
- `test/systems/wd3_layoutPins.test.js` - stamps, pins, cached scenes and discoveries
- `test/net/wd3_online.test.js` - the service's layouts and the room's switches
- `test/world/wd3_standins.test.js` - every stand-in; with ARENA2 both packs' coverage
- `test/world/fb1003c_citywall.test.js` - the city walls' corners
