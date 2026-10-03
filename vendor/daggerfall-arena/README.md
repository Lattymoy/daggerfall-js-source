# Daggerfall Arena - the colosseum (vendored, with permission)

**"Daggerfall Arena" 1.0 by Kamer** (Daggerfall Unity mod, GUID `0a802a1a-5e27-4266-84ee-8625ebf50d9d`, contact
"DFU Discord"; `daggerfall_arena.rar`, one bundle `daggerfall arena.dfmod`, 255,947 bytes, sha256
`6bb08b9b...76b13`, Unity 2019.4.40f1), carried as data for the port's Arena of Daggerfall
(`bible/11-Multiplayer/Arena.md`, slice ARENA1).

**Permission: granted by the author, relayed by Mac 2026-10-02.** As with his Windmills of Daggerfall
(`vendor/windmills-kamer/README.md`), the invitation is what makes his work admissible here.

## What the mod is

One prefab and two world-data files. The mod's own words: "Adds an Arena North of Daggerfall".

- **Model 864102, "Castle"** - one mesh, 9,034 vertices, **5,138 triangles in 23 submeshes**, a non-convex
  MeshCollider of the same mesh, and DFU's own `RuntimeMaterials` naming a classic texture (archive, record) for
  every submesh, `ApplyClimate` 0 on all 23 (no climate, no season). Footprint **3,396 x 3,712 Daggerfall units**
  (84.9 x 92.8 m), standing -0.6 m to 25.7 m where his block places it - inside one 4,096-unit block cell.
- **DFARENA.RMB** - a re-saved ZLNDFLAT with no buildings: 118 classic props (the ring's banners 42512-42514 - DFU's
  tapestry range 42500-42571, World of Daggerfall's "Flag" and "Flower Banner Long"; ARENA5 corrected "the seating
  tiers" - beams, barrels, braziers), the colosseum's placement, 29 light flats (TEXTURE.210: torches, braziers, lanterns, lamp
  posts), the dirt of the floor and the bowl on the automap (2,513 pixels of value 117), and one **43600** - the stair
  down into his dungeon.
- **locationnew-Daggerfall_ArenaofDaggerfall-17.json** - "Arena of Daggerfall", a DungeonKeep two map pixels north
  of the city (MapId 211207, LocationId 55398), over a **32-block dungeon of his own** (no classic dungeon is its copy;
  none is as large). Not strict JSON: a trailing comma closes its exterior's block list.

## What is here

Everything below is written by `tools/daggerfallArenaExtract.mjs` and listed in `daggerfall-arena.files.json`.

- `daggerfallarena.dfmod.json` - the manifest, the bundle's own TextAsset byte for byte.
- `Models/864102.json` + `Models/864102.bin` - the colosseum as data: **Kamer's own 4,773 triangles** (8,326
  vertices: positions f32 x3, normals f32 x3 - the bundle's half floats widened - uv0 f32 x2, 16-bit indices), the
  23 slots with their RuntimeMaterials (archive, record), the collider record, and **18 pieces** (below).
- `Arena/ARENADAG.RMB.json` - the port's own block, cut out of DFARENA.RMB: his 119 models and 29 lights, his ground
  and his automap. ZLNDFLAT's leftovers are not written - the name and index it was saved over, BlockPositions, its 31
  OtherNames (HDGWLL..., WRH642B7/B8, WHS331A4, DENTEST1, DHAUS024.HS2), BlockDataSizes and the header counts.
- `Arena/undercroft.json` - his dungeon: the 32 blocks (classic RDBs, all in BLOCKS.BSA), start N0000077, location
  id 55398. His exterior (DFARENA + WYRSAA44 north of the city) is not carried: the arena stands IN the city.

### The pieces: Daggerfall's own models are not carried

**365 of the 5,138 triangles (7.1%)** - the undercroft passages under the floor, submeshes 0 and 10-19 - are
copies of Daggerfall's own dungeon models (62209, 63000, 63004, 63007, 63024, 63028, 63035, 72006) laid on its
3.2 m grid. A copy of an ARCH3D record is never carried (the bed-alias law, `src/world/customModels.js`), so the tool
finds each in the player's ARCH3D and compares every triangle - the same three corners (5 mm), the same uv at each
(dfMeshToModel's, 0.02), the same winding, the same picture - and leaves the ones that match out of the mesh. They are
written as **18 placements** (the search meets 310 placements of 33 models whose corners all stand in the mesh - the
three texture sets of one shape, and shapes that overlap; each triangle is claimed once, the placement that copies the
most with its own pictures first, so 18 carry all 365): the model id, the turn (a mirror in x, then quarter turns about +Y -
`src/world/arenaModel.js` `pieceTransform`), where it stands, which of its triangles stand (Kamer trimmed some), and
where he gave a copied triangle another of Daggerfall's pictures (39 of them), which picture. The runtime rebuilds
each from the player's own ARCH3D. Rebuilt and merged, the model is the bundle's mesh again: every one of the 5,138
triangles, its corners, its uvs, its winding and its picture (verified 2026-10-02 against ARENA2; the test that
re-runs it is `test/arena1_extract.test.js`). Four triangles at a copy's corners whose uvs Kamer moved are his, and
stay in the mesh.

## What is NOT here, and why

- **The bundle's two textures** (`0-0`, `4-0`, 64 x 64 DXT1). Measured: `0-0` is TEXTURE.002 record 0 (terrain
  water; error 10.2 of 765, 98.5% of pixels within 16) and `4-0` is TEXTURE.002/003 record 4 (error 16.7) - Daggerfall's
  own art saved through lossy compression, game data. RuntimeMaterials replaces both at Awake, so DFU never shows them
  either. The tool refuses to write any picture.
- **The 23 materials** - `Standard` placeholders the editor needed; RuntimeMaterials is what DFU draws by.
- **His exterior and his location's place on the map** - the port stands the arena in Daggerfall's cell (4,3)
  (Mac, 2026-10-02: "a centerpoint that fits in the middle of Daggerfall city"); the dungeon is the undercroft below.

## Coordinates

The prefab root is an identity transform with no children (the tool asserts it), so the mesh is in the prefab's
space, which is **Unity's and so the port's**: metres, +Y up, **left-handed**, Unity's winding (front faces clockwise
seen from outside). `src/world/meshReader.js` mints every classic model in that frame (DFU's MeshReader: x, -y, z
times 0.025), so nothing is negated - the windmill's DAEs needed X negated only because COLLADA is right-handed and
Unity's importer converts on the way in (`scripts/bakeWindmill.mjs`). uv0 is as DFU's MeshReader mints it (V
negative, REPEAT). A mirrored piece's triangles are wound back the right way out when it is rebuilt.

## How to rebuild

    node tools/daggerfallArenaExtract.mjs "<path>/daggerfall arena.dfmod" --arena2 <ARENA2>          # vendor/daggerfall-arena
    node tools/daggerfallArenaExtract.mjs "<path>/daggerfall arena.dfmod" --arena2 <ARENA2> --scan   # search all of ARCH3D (~40 s)

The output is a function of the bundle and the player's ARCH3D.BSA and TEXTURE files alone; `--scan` says whether
the search finds a copied model its default list lacks. This README is the one file written by hand.
