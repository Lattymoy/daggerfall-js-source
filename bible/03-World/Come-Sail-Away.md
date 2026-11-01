# Come Sail Away

A port of RedRoryOTheGlen's **Come Sail Away 2.1** (Nexus 1131), read off its compiled assembly
(`vendor/come-sail-away/`): boats the player buys, puts in the water near a port and sails under oars or under sails the
wind fills, with waves, wake, cargo weight, sounds and a position reading. The port adds sailing together online, an
Enhanced Plus helm panel, a responsive helm, sailing into the wind, cabins on owned ships, three new hull models and the
Overworld's crossings. The player meets it at the shipyard, the helm and the Fleet page.

## How it works

- **Registration** (`src/systems/comeSailAway/comeSailAway.js`). The vendored manifest, settings (fifty keys), item
  templates and assembly; Features, credits, the mod registry and the online lane. The bundle's meshes, prefabs,
  animations, textures and audio are extracted by the port's tool; pictures of Daggerfall's own records are never
  carried.
- **The boats built** (`src/systems/comeSailAway/comeSailAwayModels.js`, `comeSailAwayHulls.js`). Five hulls: Rowboat
  (0), Large Boat (1), Small Ship (2), Large Galley (3), Carrack (4). The prefab is instanced and walked by name
  (variants, sails, lanterns, crew, trigger boxes), every face in the player's own textures, the sails baked and checked.
  The Small Ship is Mac's galleon model; the Carrack and Large Boat are Mac's New Ship 2 and Tiny Ship
  (`src/world/ships/`), with doors, a wheel, rigging and gunports.
- **Placed, kept, saved.** The placement ray's five arms (sea, a deed's reposition, a dungeon's water, the terrain's
  water tile, the water plane); kept by nodes, visibility and the floating origin; saved in the mod's save data. A
  boat left in a dungeon is kept.
- **Sailing.** The helm taken and left, rowing and turning, collision and beaching, cargo weight, riders, the boat
  walkable in the world's collider. Unity's Animator (`src/world/unityAnimator.js`) plays sails, rudder, oars and doors;
  Unity's particle system (`src/world/unityParticles.js`) plays wake, splashes and the flag. The wind rolls and turns by
  hour and weather; the sails' power, trim and the wind widget. Coastal breakers and the current
  (`src/systems/comeSailAway/comeSailAwayWaves.js`).
- **Items and cargo** (`src/systems/comeSailAway/comeSailAwayItems.js`). Parts (item 1320) and deed (1321); packing;
  the cargo box as loot target. Ships are sold at the shipyard (`Shipyards.md`), and deeds live in the Fleet's book
  (`Holdings.md`). Every hull can be packed.
- **The position reading** (`src/systems/comeSailAway/comeSailAwayMap.js`). The mod's map over the travel map at midday
  and midnight in clear weather, with markers; past the Bay the cross stands at the player's pixel on the continent.
- **Cabins.** The Small Ship takes the small bank ship's interior, the Large Galley and the Carrack the large one's,
  through the interior builder (`src/scenes/sailingCabin.js`); the open hulls have none.
- **Sailing together** (`src/scenes/comeSailAway/comeSailAwayPeers.js`, `comeSailAwayAboard.js`). Online another
  player's boat is seen, boarded, stood on and carried while it moves, and left.
- **The helm on screen** (`src/ui/enhanced/enhancedHelm.js`). An Enhanced Plus helm panel and a pad's d-pad at the helm;
  the classic skin keeps the mod's keys. The arrow keys and W and S share one ladder.
- **The responsive helm** (`src/systems/helmWay.js`). Under the Responsive handling a ship gathers way, turns and
  stops faster, and sails free: every sail at its best, a share by point of sail from 0.9 running to 0.55 in the
  wind's eye, never astern, with no tacking. The Classic handling is the mod to the letter.
- **The Overworld's crossing.** A journey across water launches the player's boat and lands them where the land is hit
  (`06-Systems/Travel-View.md`).

## Rules

- Mods attached are made compatible and implemented 1:1 (Mac).
- The player's own online (`src/systems/online/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`): a boat is a possession in
  the player's save; its wind is each machine's own roll.
- Online the helm's time dial is gone; time at sea runs at normal speed (Mac).
- Better mobility and manoeuvrability; sailing into the wind made possible, no tacking, Black Flag style, nothing that
  breaks immersion (Mac).
- Sail together, walking on board as it moves (a player's ask). Enhanced Plus UI over keybinds (a player's ask).
- Larger ships can be picked up like smaller ones (the review before merge).
- Every owned large sailing ship has its own cabin without buying a bank ship.
- A jump leaves the helm. A foe in the water reaches no one aboard. A camp on deck rides the ship.

## Daggerfall Unity

The mod's assembly is the reference. Departures: packing every hull, the responsive helm and free sailing, sailing
together, the helm panel, the new hull models, cabins, the Overworld's crossing, no time dial online, water foes kept
off the deck, a jump leaving the helm, and the position reading past the Bay.

## Code and tests

- `src/systems/comeSailAway/` - runtime, hulls, models, items, map, waves, wire
- `src/scenes/comeSailAway/` - pool, peers, aboard, deck fittings, livery, plaque, figurehead
- `src/world/ships/` - the galleon, carrack and large boat models and art
- `test/systems/comeSailAway/csa_boats.test.js`, `csa_placing.test.js`, `csa_sailing.test.js`, `csa_wind.test.js`,
  `csa_animator.test.js`, `csa_waves.test.js`, `csa_effects.test.js`, `csa_time_audio.test.js`, `csa_map.test.js`,
  `csa_close.test.js`, `csa_online.test.js`, `csa_pool.test.js` - the mod, slice by slice
- `test/systems/comeSailAway/sailingcabins.test.js`, `shippack.test.js`, `boatmenu.test.js` - cabins, packing, the
  boat's menu
- `test/systems/auditships_sail.test.js` - the galleon's handling under free sailing
