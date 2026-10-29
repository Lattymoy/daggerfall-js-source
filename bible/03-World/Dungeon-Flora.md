# Dungeon Flora (SEABED, 2026-10-29)

Mac, 2026-10-29: "we need to do comprehensive replacements". A vendored mod that stood underwater flats in three
flooded dungeon blocks was taken out that day. This is the port's own replacement, and it reaches further: every block a
dungeon floods grows a seabed, not three. The ships' replacement is `03-World/Ship-Refit.md`; both were audited the
same day (`01-Overview/audits/Audit-Ship-Refit.md`).

A departure from Daggerfall Unity (SCOPE1): Daggerfall ships a seabed's flats in `TEXTURE.105` and `TEXTURE.106` -
kelp, coral fans, starfish, shell and weed beds, a reef, an anchor - and DFU's `RDBLayout` stands none of them, since no
block places them.

## The law

`world/dungeon/dungeonFlora.js` is a pure law over the dungeon's layout, the fires' shape
(`world/dungeon/dungeonFires.js`). A block floods when its water level is set (`rdbLayout`'s `waterLevel`, from its
first start marker). Its seeds are its markers and its models' origins; round each, a plant may stand at the seed or on
two rings, 1.8 and 3.6 m out. A spot is taken when:

- it lies in the seed's own block, a metre or more under that block's water - the water the host draws and swims in
  there (`dungeonContext.js` `waterSurfaceYAt`);
- its floor is the dungeon's own and level: a normal of 0.99, and the floor within 5 cm half a metre and a metre round,
  and round a wider plant's own half width - no step, ramp, ledge, tabletop or plinth;
- it is 1.5 m from every door's middle (an action door's model box, never its hinge; an exit door's face), 1.5 m from
  every marker a pile, a quest's item, a foe or the way in stands on, and a metre from every flat the layout stands;
- a room holds the plant: nothing inside its half width and 0.1 m, at six heights from 6 cm over its floor to its top,
  on bearings close enough that no gap at its edge passes 15 cm; nothing over it; a ceiling within 10 m and four of eight rays meeting a wall within 30 m; no
  face met from behind (the inside of a solid, or the void between storeys).

The spot's hash picks the plant: kelp four times in eleven, a bed three, a fan two, a starfish and a reef or an anchor
one each. Where the pick is too wide, a narrow kelp takes the spot. `TEXTURE.106` record 6 is a column of bubbles and
stands nowhere. Then the spread: the spot with the least hash first, then the one farthest from those chosen, never
nearer than 2.4 m to another plant of the dungeon, up to 14 a block.

Every distance it compares is squared plain arithmetic, its bearings are turned by literal cosines, its sizes are the
classic records' (never a texture mod's), and its seed is the dungeon's location id, the fires' own. Its rays read every
bucket at its build pose, before a save moves a door or a mover. So every client of a dungeon stands the same seabed,
and nothing rides the wire.

## The host

`standDungeonFlora` is the dungeon host's one call (`dungeonContext.js:"await standDungeonFlora"`), after the fires'
block and before the flat batches are built; the host hands it its models (`cpuModels`) for the doors' middles. Each
plant goes into the flat batches by its centre, half its drawn height over its foot, with `noCover`: a seabed's weed is
the flora PROP-BODIES lets a body pass, so no body clamps the swimming player and no plant is cover. A dry dungeon reads
no texture. The other three hosts are not wired: only a dungeon has flooded RDB blocks (`exterior.js`, `world.js`,
`worldModes.js`).

## Tamriel

The blocks are the stuff of every dungeon in every province, and the law reads the layout and nothing else: no place,
region or pixel. A lair past the Bay (`world/tamrielDungeons.js`) built of flooded blocks grows the same seabed as the
same blocks in Daggerfall, and the check reads such lairs.

## Checked

`node tools/dungeonFloraCheck.mjs <arena2>` lays out every flooded block `BLOCKS.BSA` carries (32) at twenty seeds, the
dungeons the audit named and sixty lairs past the Bay, builds each collider as the host builds it, and asks every plant
again with rays of its own - sixty-four bearings at nine heights, the floor on sixteen at four radii: in its own block's
water a metre down; level under its footprint and on no island; no wall inside its half width, nothing over it, inside
no solid; clear of doors' middles, markers and flats; 2.4 m from every plant of the dungeon; the same plan twice.

On the game's data it finds no problem and no flooded block bare; `--all` reads every dungeon `MAPS.BSA` floods. The first
check, which laid each block alone at one seed and asked the law's own rays, passed plants a whole-dungeon read caught
standing in a dry block, on a loot pile, on a table and inside a solid.

`dungeonFlora.test.js` holds every rule over fake probes, so CI holds it without the game's data;
`tools/mutants/dungeonflora.json` holds thirty-two mutants, all dead without ARENA2.
