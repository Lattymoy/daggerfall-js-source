# World of Daggerfall

A port of Kamer's mod **World of Daggerfall** 2.0 (Nexus 181), with permission: bandit camps and forts, ruins,
shrines, caves, nature spots and rock fields across the Iliac Bay's wilderness, with bandits, bears and treasure, and a
camp outside Privateer's Hold. The mod is text only: eight C# sources (`vendor/world-of-daggerfall/Scripts/`), 65 prefab
layouts and 2,413 instance lists in 44 region folders. The player meets it wandering the Bay's wilderness.

## How it works

- **The loader** (`src/world/worldOfDaggerfall/worldOfDaggerfall.js` `WodWorld`). One per page, as the mod's
  `LocationLoader` lives for the game. `open` reads the prefabs and region 17's folder; each region the player enters
  appends its folder in event order. Online the list is every folder at once in one order (17, then ascending), so a
  room agrees on the ground the mod levels.
- **The pick** (`src/world/worldOfDaggerfall/wodLocationLoader.js`). When a terrain tile promotes, the whole instance
  list is walked in order, and an instance is refused when the tile already holds a location, the tile is sea, it
  names another pixel, its position is out of range, a road or track crosses the pixel, its prefab is missing or it
  overruns the tile. The first that passes is picked and its ground flattened.
- **Objects** (`src/world/worldOfDaggerfall/wodLocationObjects.js`). `LoadObject` as data: models, flats, lights and
  markers, aligned to the ground (`src/world/groundAlign.js`).
- **Spawners** (`src/world/worldOfDaggerfall/wodSpawner.js`). A marker the player is within 300 of on its first frame
  never springs; otherwise it springs once, the first frame the player comes within 100.
- **Privateer's Hold's camp** (`src/world/worldOfDaggerfall/wodPrivateersHold.js`). The mod's `DungeonExterior` and
  `PrivateersHold` as data: 33 models and the rest of the camp in the `CUSTAA30.RMB` block's frame.
- **Shared online** (`src/world/worldOfDaggerfall/wodShared.js`). The first player to spring a marker owns what it made;
  its foes carry their site key (pixel, objectID, index) and ride the cell stream to the room.
- **Off the roads** (`src/world/road/roadClearance.js`). A site's whole footprint is tested against the painted road
  network in every pixel it reaches. A camp, fort, shrine, ruin, cave or nature spot that reaches a road is refused
  whole at its pick; a rock field or mountain drops only the pieces whose mesh reaches a road.
- **Off the Oblivion Gate** (`src/world/gate/gateClearance.js`). A site whose objects reach the gate's 24 m clearing
  stands none of them (its pick and levelled ground stay); a rock piece whose mesh box reaches it is not stood. When the
  gate's clearing moves, the pixels it touched are built again.

## Rules

- Mods are ported 1:1 with permission (Mac).
- One switch, `Enabled`, on by default (`src/systems/modSettings.js` `world-of-daggerfall`), read once at the world's
  mount.
- The mod's Mountains layouts are off by default and online (the owner preferred them removed; the landforms' rounded
  peaks stand instead). They are the port's own `Mountains` switch (`src/systems/features.js`).
- Camps and mountains are never placed on roads (Mac).
- Online the mod is forced on with Mountains off (`src/systems/online/onlineLane.js`), since it levels the ground the
  room must agree on.
- Tamriel: the mod's data names only the Bay's 1000 x 500 map and its regions (BAY-OWN). Past the Bay no instance list
  exists, so nothing of it stands there.

## Daggerfall Unity

The mod's `LocationLoader`, `LocationEnemySpawner`, `DungeonExterior` and `PrivateersHold` are ported line by line.
Departures:

- The sea test asks the pixel's own region (`src/formats/mapsFile.js` `getRegionIndexAt`); in DFU the test is dead
  code.
- A region with no folder loads nothing and throws nothing, where DFU's handler throws every frame.
- The room's list is every folder in one order online.
- Off the roads and off the Gate are the port's own clearances.

## Code and tests

- `src/world/worldOfDaggerfall/` - data readers, packs, loader, objects, spawner, the Hold's camp, shared ownership
- `tools/worldOfDaggerfallAssets.mjs` - the archive to `vendor/`
- `test/world/worldOfDaggerfall/wod3_spawner.test.js` - the spawner machine
- `test/world/worldOfDaggerfall/wod4_privateershold.test.js` - the Hold's camp against the C#
- `test/world/worldOfDaggerfall/roadsclear.test.js` - off the roads
- `test/world/worldOfDaggerfall/audit_wod_branch.test.js` - the branch audit's pins
- `test/world/worldOfDaggerfall/fb1018f_wodsea.test.js` - the sea test
