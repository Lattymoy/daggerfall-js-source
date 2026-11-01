# Ocean Holes

A port of jet082's **There's a Hole in the Bottom of the Ocean 1.1.0** (Nexus 1313), read off its compiled assembly
(`vendor/ocean-holes/`). On about one open-ocean map pixel in 48, a black hole opens in the seafloor under a plume of
purple miasma. Swimming down into it leads to a drowned dungeon: a real Daggerfall dungeon borrowed from a region,
flooded to its ceiling, stripped of its lights and filled with the deep's own foes. It requires Iliac Puddle No More
(`Deep-Waters.md`): the pits are cut into that mod's carved seafloor through its own API.

## How it works

- **Settings** (`src/scenes/oceanHolesHost.js` `oceanHolesSettings`). Seven sliders, 0 to 1 and 0.5 by default, read as
  the mod's ApplySettings reads them: spawn rate (one pixel in 48 at 0.5, one in 24 at 1, none at 0), surface hole size,
  seafloor hole size, miasma puffs and height, the abyss's fog, and more. Registered in Features, credits and the
  online lane.
- **Where a pit is** (`src/world/oceanHoles.js`). `StableHash` is Int32 arithmetic with logical shifts;
  `IsPitPixel` takes the first `rate x 2` of 48 buckets, so lower rates pick a subset of higher; `PlacementFraction`
  keeps the pit at least 28% in from the pixel's edge. A pixel is queued when its terrain is promoted, one a frame,
  through the mod's gates in order, each rejection its own diagnostic: the hash, no location, the sea floor built and
  current, the bake (water, no land, at least 256 m from the coast), and the floor at least 70 m under the sea.
- **The pit** (`src/render/oceanHolesRender.js`, `src/world/oceanHolesMiasma.js`). Three discs (surface opening,
  seafloor pit, black core), the miasma plume, and the entrance a swimmer touches.
- **The way down** (`src/scenes/oceanHolesAbyss.js`). Entering asks: nothing in hand, the player outside and swimming,
  and a template: the first suitable dungeon from a hashed region and location (two blocks or more, not main-story, of
  types 0, 4, 5, 6, 8, 9 or 11, no quest site linked), a type 6 preferred. None: "The darkness below refuses to open."
  Found, the mod's save record is written and the template is cloned, renamed (an adjective, noun and ending from the
  name hash: "The Deadwater Chasm of the Last Tide") and entered. The build floods every block at least 3 m over the
  start marker and a metre over the tallest mesh, and processes its foes. "You descend into <name>."
- **Contents.** Flame foes (Fire Daedra, Fire Atronach, Dragonlings) are destroyed. Eligible class foes are replaced
  from the deep's undead; eligible monsters one in three. An aquatic quota of `ceil(living x 0.3)` is kept in floats.
  Light fixtures and borrowed quest resources go. Loot is upgraded a material, and the fog and light darkened.
- **The way up.** Leaving by the entrance: "You rise from <name>.", back to the recorded world point. A respawn clears
  the abyss instead. The Recall binding and the save carry the abyss.
- **Past the Bay.** The pit's hold is the world's grid (`pitPixelOk`), so pits stand in the Topal Bay, the Sea of
  Ghosts and the Eltheric Ocean. A Bay pit's abyss keeps the mod's own id; one past the Bay is named in the world's
  abyss lane (`src/world/worldWide/worldLanes.js` `ABYSS_WORLD_LANE`). Readers know an abyss by `isAbyssMapId` only.
  The template is still a Bay dungeon.

## Rules

- Mods attached are made compatible and implemented 1:1 (Mac).
- Kept bug for bug: the mod's weapon upgrade's arrow check compares the wrong index, so every weapon is upgraded and a
  stack of arrows becomes one arrow of the next material.
- Online, the open PvP zone stands no pit (`src/scenes/oceanHolesHost.js`, `rejected:open-zone`): a pit is a dungeon's
  door, and the zone stands only its tier's halls (the owner's call on site-bound things in the open zone). Offline a
  pit is cut anywhere.
- Online the abyss processes only the foes this player runs, and its room is a world room.
- Every place a pit stands answers for the whole world (TAMRIEL-WIDE): no 0..999 bound.

## Daggerfall Unity

The mod's assembly is the reference. The port's departures, among them:

- The pit's marker is kept pixel-local and read through the live translation, so it survives a floating-origin
  recentre.
- The floor is the worker's, so a refresh queues the pixel at the front and waits for the build.
- The miasma is lit as the port's billboards are (ambient plus the sun toward the camera); its puffs use
  `Math.random`.
- The GPS move into the template is a teleport, and the descent is one world move.
- A load inside an abyss rebuilds it; the destroyed foes ride the save.
- A pit past the Bay, an abyss id of its own there, and no pit in the open zone online.

## Code and tests

- `src/world/oceanHoles.js` - hash, placement, names, roster, loot law
- `src/scenes/oceanHolesHost.js` - settings, the tile queue, the cut
- `src/scenes/oceanHolesAbyss.js` - template, clone, flood, way down and up, save
- `src/render/oceanHolesRender.js`, `src/world/oceanHolesMiasma.js` - the look
- `test/world/oh_placement.test.js` - the pure law against the assembly
- `test/scenes/oh_host.test.js` - the tile host and its gates
- `test/scenes/oh_abyss.test.js` - the abyss over a fake world, contents and loot
- `test/world/pitsworld.test.js` - pits past the Bay, none in the open zone online

## Open

- The port's plume carries on through a building visit. Whether the mod's stops there is Unity engine behaviour the
  sources cannot show.
