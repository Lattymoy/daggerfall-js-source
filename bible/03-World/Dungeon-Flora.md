# Dungeon Flora (SEABED, 2026-10-29)

Mac, 2026-10-29: "we need to do comprehensive replacements and also remove any mention or credit of him" - the
author of a vendored mod that stood underwater flats in three flooded dungeon blocks asked for it to be taken out. This
is the port's own replacement, and it reaches further: every block a dungeon floods grows a seabed, not three. The
ships' replacement is `03-World/Ship-Refit.md`.

A departure from Daggerfall Unity (SCOPE1): Daggerfall ships a seabed's flats in `TEXTURE.105` and `TEXTURE.106` -
kelp, coral fans, starfish, shell and weed beds, a reef, a wreck - and neither it nor DFU stands them anywhere.

## The law

`world/dungeon/dungeonFlora.js` is a pure law over the dungeon's layout, the fires' shape
(`world/dungeon/dungeonFires.js`). A block floods when its water level is set (`rdbLayout`'s `waterLevel`, from its
first start marker). Its seeds are its markers and its models' origins; round each, a plant may stand at the seed or on
two rings, 1.8 and 3.6 m out. A spot is taken when:

- its floor is level (a normal of 0.9 or more) and a metre or more under the block's water;
- it is 1.5 m from every door (the fires' door list, `fireLayoutInputs`);
- a room encloses it - a ceiling within 10 m, and four of eight rays meet a wall within 30 m;
- the plant fits - nothing within its half width and 0.1 m at a quarter, half and three quarters of its height, and
  nothing overhead.

The spot's hash picks the plant, kelp four times in eleven, a bed three, a fan two, a starfish and a reef one each. Where
the pick is too wide, a narrow kelp takes the spot. Then the spread: the spot with the least hash first, then the one
farthest from those chosen, never nearer than 2.4 m to another, up to 14 a block.

Every distance it compares is squared plain arithmetic, its sizes are the classic records' (never a texture mod's),
and its seed is the dungeon's location id, the fires' own. So every client of a dungeon stands the same seabed, and
nothing rides the wire.

## The host

`standDungeonFlora` is the dungeon host's one call
(`dungeonContext.js:"await standDungeonFlora"`), after the fires and before the flat batches are built. The rays are the dungeon's own mesh, its `dungeon` bucket alone (a door's
bucket is there only while it is shut). Each plant goes into the host's flat batches by its centre, half its drawn
height over its foot, as the fires' do. A dry dungeon reads no texture. The other three hosts are not wired: only a
dungeon has flooded RDB blocks (`exterior.js`, `world.js`, `worldModes.js`).

## Tamriel

The blocks are the stuff of every dungeon in every province, so the law reads the layout and nothing else: no place,
region or pixel. A flooded block in a dungeon past the Bay grows the same seabed as the same block in Daggerfall.

## Checked

`node tools/dungeonFloraCheck.mjs <arena2>` lays out every flooded block `BLOCKS.BSA` carries (32), builds its collider
as the host builds it (`tools/dungeonFireProbe.mjs`), and asks every plant again with rays of its own: a level floor
under it a metre under the water, no wall inside its half width at three heights, nothing overhead, no door within
1.5 m, no plant within 2.4 m, no block past 14, the same plan twice. On the game's data: 32 blocks, 435 plants, every
block with 8 or more. Its first run found four wide plants whose foot a sloped wall leaned into, at a height the law
did not then cast; the law casts three heights now.

`dungeonFlora.test.js` holds the law over a fake probe and the host's call over a fake room, and runs the check with
ARENA2. `tools/mutants/dungeonflora.json` holds fourteen mutants, all dead.
