# Dungeon Flora

Every dungeon block that floods grows a seabed: kelp, weed and shell beds, coral fans, starfish, a reef or an anchor,
from Daggerfall's own flats. The player meets it swimming in a flooded dungeon in any province.

## How it works

`src/world/dungeon/dungeonFlora.js` `dungeonFloraPlan` is a pure law over the dungeon's layout, built the same way as the
fires (`src/world/dungeon/dungeonFires.js`). A block floods when its layout sets a water level (`waterLevel`). Its seeds
are its markers and its models' origins. Round each seed a plant may stand at the seed or on two rings, 1.8 m and 3.6 m
out. A spot is taken when (`SEABED`):

- it lies in the seed's own block, at least 1 m under that block's water;
- its floor is level: a normal of 0.99 or more, and the floor within 5 cm at 0.5 m and 1 m round, so no step, ramp,
  ledge, tabletop or plinth;
- it is 1.5 m from every door's middle (`floraDoors`), 1.5 m from every marker that a pile, a quest item, a foe or the
  entrance stands on, and 1 m from every flat the layout stands;
- a room holds the plant: nothing inside its half width plus 0.1 m from 6 cm over the floor to its top, nothing over
  it, a ceiling within 10 m, four of eight rays meeting a wall within 30 m, and no face met from behind.

The spot's hash picks the plant (`floraPick`, `FLORA_KINDS`): kelp 4 in 11, a bed 3, a fan 2, a starfish 1, a reef or
an anchor 1. A narrow kelp takes a spot too narrow for the pick. The spread takes the least hash first, then the spot
farthest from those chosen, never nearer than 2.4 m to another plant, up to 14 a block.

`standDungeonFlora` is the dungeon host's one call (`src/scenes/dungeonContext.js`), after the fires and before the flat
batches are built. Each plant joins the flat batches with `noCover`, so a body swims through it and no plant is cover. A
dry dungeon loads no texture.

## Rules

- Comprehensive replacements, not a vendored mod's flats in three blocks (Mac): every flooded block grows a seabed.
- Deterministic: squared distances, literal cosines for bearings, the classic records' sizes (never a texture mod's),
  the dungeon's location id as seed, rays read at the build pose. Every client stands the same seabed and nothing rides
  the wire.
- TEXTURE.106 record 6 (a column of bubbles) stands nowhere.
- Only the dungeon host is wired: only dungeons have flooded RDB blocks.
- Tamriel: the law reads the layout only, never a place, region or pixel. A lair past the Bay
  (`src/world/tamrielDungeons.js`) built of flooded blocks grows the same seabed.

## Daggerfall Unity

Daggerfall ships the seabed flats in TEXTURE.105 and TEXTURE.106, and DFU's `RDBLayout` stands none of them because no
block places them. Standing them is the port's departure (SCOPE1).

## Code and tests

- `src/world/dungeon/dungeonFlora.js` - the law (`dungeonFloraPlan`, `SEABED`, `FLORA_KINDS`) and `standDungeonFlora`
- `src/scenes/dungeonContext.js` - the host call
- `test/world/dungeonFlora.test.js` - every rule over fake probes, without the game's data
- `tools/dungeonFloraCheck.mjs` - with ARENA2, lays out every flooded block at twenty seeds plus lairs past the Bay,
  builds each collider as the host does, and re-asks every plant with its own rays; `--all` reads every flooded dungeon
- `tools/mutants/dungeonflora.json` - the mutants
