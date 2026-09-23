# World of Daggerfall - Kamer's wilderness, 1:1 with permission

Kamer's second mod in this tree (the first is `Windmills.md`). Mac
handed the archive over on 2026-09-23 ("This will be our next mod to
implement 1:1"); permission is the author's, the grant that covers his
windmills, confirmed by Mac the same day. The Ledger row is
`01-Overview/Port-Ledger.md`, section A, "WORLD OF DAGGERFALL". The
registry row and the vendored files' account are
`01-Overview/Mod-Registry.md` and `vendor/world-of-daggerfall/README.md`.

## What the mod is

"World of Daggerfall" 2.0 (Nexus mod 181, GUID
`98f05888-989f-4ff1-b455-f4cafedaeb88`, built against DFU 0.11.0 with
Unity 2019.4.10f1): "Adds details to the wilderness, New Locations, and
Dungeon Exterior detail." The archive is two trees:

- `Mods/world_of_daggerfall.dfmod` - a bundle whose ONLY content is
  text: eight C# sources and the manifest. No models, no textures, no
  settings. The whole implementation is the source, which is why this
  port cites it line by line (`vendor/world-of-daggerfall/Scripts/`).
- `Locations/` - StreamingAssets data: 65 prefab LAYOUTS
  (`LocationPrefab/*.txt`) and 2,413 instance LISTS in 44 region
  folders, 227,938 instances in all, every one a prefab name, a map
  pixel and a position inside it.

Two independent mechanisms share the bundle:

1. **The location loader** (`LocationModLoader`, `LocationLoader`,
   `LocationHelper`, `LocationData`, `LocationEnemySpawner`), a fork of
   the community "Location Loader" (its editor-side save methods and
   `WA_`/`DF_` prefab tables are still in it). It stands the prefabs in
   the wilderness as terrain tiles promote.
2. **The main-quest exterior** (`MainQuestLocationOverhaul`,
   `DungeonExterior`, `PrivateersHold`): a hand-placed camp around the
   Privateer's Hold block (`CUSTAA30.RMB`), found by name every frame.

## How the loader decides a pixel, and why the order is the law

`LocationLoader.AddLocation` runs on `DaggerfallTerrain.OnPromoteTerrainData`
- after the tile's heights are generated, blended for a real location,
textured (Basic Roads' beds smoothed in) and pushed to the live terrain,
and BEFORE the streamer lays the tile's nature out. It walks the WHOLE
instance list, in list order, and for each instance:

1. the tile already holds a location (`MapData.hasLocation`) - a type-0
   instance anywhere in the list ends the call, a type-2 skips;
2. the tile is sea (region 31, 3, 29, 28 or 30 AND a WOODS height of 2
   or less) - the same two arms;
3. the instance names another map pixel - skip;
4. `terrainX`/`terrainY` outside 1..128 - skip;
5. Basic Roads says a road or a track crosses the pixel
   (`getPathsPoint`, the road mask OR the track mask) - skip;
6. the prefab file is missing - skip;
7. the prefab overruns the tile (checked with terrainX + HEIGHT and
   terrainY + WIDTH - the transpose of the rect it then builds - once
   against 128 and once against 127) - skip;
8. otherwise PLACE it: types 0 and 2 set `hasLocation`, name the tile
   and set `locationRect`, then flatten (below); the prefab's objects
   stand at `(terrainX * 6.4 + x, averageHeight * 2308.5 + y,
   terrainY * 6.4 + z)`.

Step 8's `hasLocation` is what makes the FIRST valid instance naming a
pixel win it: every later type-2 instance skips at step 1. That is
load-bearing in the shipped data - **51,356 pixels are named by more
than one instance** (a bandit camp and three rock fields on one pixel,
say), and which one stands is decided by the list's order. The order
is:

- region 17's folder first - `Awake` loads it unconditionally (the
  title screen stands in the Daggerfall region, and `PlayerGPS.Start`
  seeds `lastRegionIndex` with it, so no event would ever name 17);
- then each region's folder the moment the player first enters it
  (`PlayerGPS.OnRegionIndexChanged`; region 31 refused);
- within a folder, `Directory.GetFiles`'s order on the platform the mod
  shipped for - NTFS, which returns names in upcase-ordinal order
  (`AlikrDesert_Bandits_1.txt` before `AlikrDesert_Rocks_13.txt` before
  `AlikrDesert_Rocks_2.txt`), so a bandit camp beats the rocks on its
  pixel;
- within a file, document order.

Every instance in the shipped data is type 2; the type-0 and "other"
arms are ported anyway, and pinned against a verbatim reference loop.

## The flatten

The mean of the prefab's rect is taken over samples `terrainX ..
terrainX + width` by `terrainY .. terrainY + height`, BOTH BOUNDS
INCLUSIVE, so a 2 x 2 camp averages nine samples. Then every sample
with both coordinates in 1..127 is lerped toward that mean by
`1 / (distance-from-rect + 1)`: fully inside the rect, half one sample
out, a third two out. The tile's border rows (0 and 128) are never
touched, which is what keeps the seam against the neighbouring tile
closed. The C# is `float` throughout and the port runs every step
through `Math.fround`, so the samples it writes are the ones DFU's
`SetHeights` received.

Because the flatten runs after texturing and before nature, three
things follow and all three are the reference's: the ground's TILES are
the unflattened terrain's (a levelled site keeps the grass and rock
pattern of the slope it was); the NATURE flats honour the site, because
the loader set `locationRect` and the nature layout keeps
`natureClearance` (4) tiles off any rect; and the trees that remain
stand on the flattened ground.

## Readings taken

- **The region load comes before the build it feeds.** Unity does not
  fix the order of `StreamingWorld.Update` and `PlayerGPS.Update`, so
  on a boot or a teleport into a region the list has never held, DFU
  may promote the tiles round the player before the region's folder is
  read, and those tiles then stand bare until they stream out and back
  in. The port loads the folder first. Everywhere else - the border
  pixels of a region the player has not yet entered, the 177 pixels
  named from two different regions' folders - the port keeps the
  reference's path-dependence exactly.
- **A region is appended once.** The C# appends a revisited region's
  folder again; a duplicate can never win a pixel its first copy did
  not, so the second copy changes nothing but the scan's length.
- **The C# culture is the author's.** Every number in the files is
  read with .NET `TryParse` under the invariant/en-US shape (a
  comma-decimal Windows locale fails every float in them, a
  machine-dependent DFU hazard nobody would want reproduced).

## What the data says, measured

- 227,938 instances: 209,436 `Rocks`, 7,000 `Bandits`, 5,000 `Shrine`,
  4,000 `Ruins`, 2,502 `Mountains`; all type 2; 60 of the 65 prefabs
  used (the two docks, the cave and two of the large rock fields never
  are).
- 3,000 instances (regions 5 and 35) carry empty coordinates; they read
  as 0 and step 4 retires them. 155,398 `locationID`s read as 0 because
  `TryParse` refuses them: 152,347 overflow an Int32, 3,000 are empty
  and 51 are not integers ("625450-103"). The ID only ever keys a
  treasure container's `LoadID`.
- 1,739 prefab objects: 1,325 models (118 distinct) and 414 flats, none
  of them rejected by `ValidateValue`. 586 models are tilted (rock
  outcrops), 1,015 are scaled and 952 of those non-uniformly; 20 flats
  are scaled too.

## Where it lives in the port

- `src/world/wodLocationData.js` - `LocationData.cs` and the reading
  half of `LocationHelper.cs`: the shapes, the two XML loaders, .NET's
  `TryParse`, `ValidateValue`, NTFS name order.
- `src/world/wodLocationPack.js` - one region folder as one pack.
- `src/world/wodLocationLoader.js` - `LocationLoader.cs`: the session
  list, the pick, the flatten, the object positions.
- `tools/worldOfDaggerfallAssets.mjs` - the archive to `vendor/`.
