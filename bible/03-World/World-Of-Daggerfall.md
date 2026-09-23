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
  reference's path-dependence exactly. The event is heard on the
  crossing itself, as PlayerGPS raises it, and again before each build
  (WOD5). Before that fix a visit shorter than one build went unheard,
  and the list's order with it.
- **A region is appended once.** The C# appends a revisited region's
  folder again; a duplicate can never win a pixel its first copy did
  not, so the second copy changes nothing but the scan's length.
- **A region with no folder throws in DFU, every frame.** 18 of the 62
  regions have none; `Directory.GetFiles` throws out of the event handler,
  and `PlayerGPS` only advances `lastRegionIndex` after raising the
  event, so it throws again each frame the player stays - starving every
  later subscriber. The port loads nothing and throws nothing.
- **A marker's load handler outlives the marker.** `LocationEnemySpawner`
  subscribes to `SaveLoadManager.OnLoad` in Start and never unsubscribes.
  Once any marker's terrain has been recycled, every later load throws
  `MissingReferenceException` out of the dead marker's handler. The
  event is raised last in a load, so the throw stops its remaining
  subscribers: the surviving markers' 300 test, and any mod's handler
  that subscribed later. The port rebuilds the world on every load and
  throws nothing, the folderless region's reading again.
- **A flat whose record its archive lacks is skipped.** DFU's
  `SetMaterial` may instead throw out of AddLocation and stop the tile's
  remaining objects. The shipped layouts' flat records have not been
  checked against ARENA2 here.
- **The C# culture is the author's.** Every number in the files is
  read with .NET `TryParse` under the invariant/en-US shape (a
  comma-decimal Windows locale fails every float in them, a
  machine-dependent DFU hazard nobody would want reproduced).

## What stands, and how (WOD2)

`LocationHelper.LoadObject` decides every object by its type and, for a
flat, by its ARCHIVE STRING:

- **a model** (type 0) is `CreateDaggerfallMeshGameObject`: the classic
  mesh WITH its mesh collider, at `T * R(q) * S` in the tile's frame. It
  takes NO climate swap (only a `DaggerfallLocation` re-skins its
  children, and these hang off the terrain) and registers NO door (a
  static door is `RMBLayout`'s alone), so a WoD house is a shell you walk
  around. 952 of the rocks are scaled unevenly and Unity lights them
  through the inverse transpose; the static batch takes a normal matrix
  for them (`render/staticBatch.js`, `R * S^-1`). One wall is MIRRORED
  (`WOD_BanditCamp_09`'s 58055, `scaleX -1.573463`, in 565 camps).
  Unity reverses the culling of a transform with a negative
  determinant, so the batch reverses that model's winding (WOD5).
  Before that fix the port drew the wall inside out.
- **a flat** is a billboard, base-anchored where `AlignToBase` and the
  scale fix (`LocationLoader.cs:243-248`) leave it; the four records the
  layouts scale are batches at their own size.
- **the markers are invisible.** Every `Add*Spawn` sets the flat's
  material colour to alpha 0.1, and DFU's billboard shader multiplies the
  texel by `_Color` and alpha-tests at 0.5 - so a bandit marker, the
  kidnap marker and the treasure container under `AddLootSpawn` draw
  nothing. They are spawn points (WOD3). An editor flat (archive 199) is
  hidden by its own billboard, as in a town.
- **210 is a light**: the interior light prefab under the flat, lifted
  and coloured by the MOD'S OWN copy of `DaggerfallInterior.AddLight`,
  which differs from DFU's in two arms (record 0, the bowl of fire, is
  orange at 1.2 where DFU's is pale yellow at 1.1; and a default arm
  catches any record past 29) and one lift (record 29, the street
  lantern, by half its height). A Unity `Light` burns at every hour, so
  these are lit by day as well as by night; each carries its own colour
  and range, and a frame with one in range takes the renderer's
  per-light colour channel (the lanterns and the player's own lights keep
  the shared colour). Not animated - the prefab's flicker is off.
- **201 calls**: `AddAnimalAudioSource` is RMBLayout's table verbatim,
  so the town animals' list carries the camps' horses.

## The spawn points (WOD3)

`LocationEnemySpawner` is a state machine over one number, the
player's distance, and is ported as one (`world/wodSpawner.js`):
`tick(dist)` is one Unity frame for one marker.

- **Start spends, Update springs.** A marker the player is within 300
  of on its first frame deactivates for good: a camp that streams in
  around you never springs. Otherwise it springs once, the first frame
  the player comes within 100. The distance runs from PlayerMotor's
  transform (the capsule's centre) to the marker's centre, where
  `AlignToBase` and the scale fix leave it. `OnLoad` repeats Start's
  test after a load; the port rebuilds the world on every load, so
  every marker meets that test in its own Start.
- **The rolls are Unity's.** `Random.Range` on ints EXCLUDES its
  maximum, and the rolls run in the C#'s order. The exclusion is
  load-bearing three times: `Range(1, 3)` never answers 3, so the
  thieves' Barbarian arm is dead; `Range(1, 6)` never answers 6, so the
  warriors' Healer arm is dead; `Range(1, 100)` is 1..99, so "SpawnTrue
  >= 50" is 50 chances in 99 (the bears' 40 is 60 in 99).
  `CreateFoeGameObjects` rolls the gender (under 0.55 is male) before
  the caller's `Rotate` rolls the facing.
- **The arms.** Bandits stand a Thief or a Rogue; bears a Grizzly;
  warriors a Warrior, Sorcerer, Ranger, Mage or Knight. The good
  bandits are a Thief or a Rogue, `MobileReactions.Passive` and allied
  to the player. The good bear and warrior arms are commented out, so
  those markers do nothing and stay LIVE for as long as the player
  stands near. The loot marker drops a pile half the time (1..50 of
  1..99), at a random treasure record 0..46. `LootTables.GenerateLoot(loot, 3)`
  fills it with dungeon type 3's key, "N", plus the pile's map, potion
  and recipe tail. LR1 then rolls its ladder over the pile at that
  source, as it does over every list a host mints. The kidnap marker
  (quest 0) rolls `Range(1, 40)` and stands:
  - the captive (357.6) at 1..10;
  - a merchant (182.0) at 20..29;
  - a prisoner (184.31) at 30..39;
  - nobody at 11..19.

  The flat is centred where the marker stood (no `AlignToBase`) and is
  a plain flat of the pixel from then on. Billboard Person (type 1) is
  an empty arm. `spawnFinished` never guards anything: it turns true
  only in the call that deactivates the marker.
- **The ground aligns are GameObjectHelper's**, ported once
  (`world/groundAlign.js`). Each moves the CENTRE to the hit plus 0.52
  of a height:
  - A pile takes the `size` its caller passes, (0, 1), not its
    sprite's, so a tall treasure sinks and a short one floats.
  - A foe takes its own capsule. SetupDemoEnemy sizes it from the
    sprite with a 1.6 floor, bottom-justified, so a short creature
    stands proud and then falls.

  The ray is cast on the frame the foe is made. The drop lands in
  `spawnFoe` once the sprite has sized the capsule.
- **The foes are the exterior pool's, PLACED.** `CreateFoeGameObjects`
  caps nothing, so these foes neither count against the encounter cap
  nor are refused by it. They are never distance-culled either. DFU's
  loose enemies stand until a load or a teleport sweeps them
  (`CleanupUntrackedObjects`, `ClearStreamingWorld`; the port's
  `clearLive`), and `SerializableEnemy` saves every one, so the save
  carries these foes with their flag. They outlive their marker's
  pixel, as a StreamingTarget child outlives its terrain. The pile is
  the terrain's child and dies with its pixel. It is also a LoadID-0
  container: the C# comments its LoadID out, and
  `SerializableLootContainer.Start` registers only a non-zero one. So no
  save and no scene cache carries it (WOD5).
- **Only while outside.** Inside, DFU's streamed world is inactive and
  no marker updates; the port ticks the markers on exterior frames
  only.

## The camp at Privateer's Hold (WOD4)

`MainQuestLocationOverhaul.Init` makes one GameObject carrying
`DungeonExterior`. Every frame its Update runs
`GameObject.Find("DaggerfallBlock [CUSTAA30.RMB]")`: the first ACTIVE
block of that name, and CUSTAA30 is the Hold's own 1x1 exterior block.
It gives that block a `PrivateersHold` component, once. (The same check
on `OnTransitionExterior` changes nothing. The rest of Update is
commented-out HUD text. The fast-travel cleanup is never subscribed, and
the crashed ship and the labyrinth blocks are commented out.) The
component's Start is the whole camp, built in the block's frame under
an "Extra_Detail" child at its origin, and ported as data
(`world/wodPrivateersHold.js`, pinned line for line against the
vendored C#):

- **33 models**, each `CreateDaggerfallMeshGameObject` (the mesh and its
  collider) at a local position, turned by `Rotate(0, deg, 0)`. One
  Rotate is commented out and that ruin stands unturned.
- **17 flats**, `CreateDaggerfallBillboardGameObject`, CENTRED on their
  local position: nothing calls `AlignToBase`. The horses are silent,
  because `AddAnimalAudioSource` is RMBLayout's and nothing here calls
  it.
- **Five FireLights**, one child of each 210 flat, one unit above the
  fire's centre: a point light with range 20, intensity 1 and colour
  (0.95, 0.91, 0.63). They burn at every hour, on the per-light
  channel with the mod's other lights.
- **Seven foes** (Thief, Assassin, Thief, Thief, Rogue, Thief, Rogue),
  each on its own `Range(0, 30) > 20`, which is 9 chances in 30.
  `CreateFoeGameObjects` makes each foe at the block's origin (its gender
  roll first), and the caller's `Rotate(0, Range(0, 180), 0)` turns it.
  The re-parent to Extra_Detail at (x, 1, z) overwrites the ground align
  made at the origin, so the transform (the sprite's centre) stands one
  unit over the block's floor, and the foe settles from there.
- The loot containers are commented out; `KamerCreateLootContainer` has
  no caller.

The readings:

- **The foes are the block's.** They are placed foes, outside the
  encounter cap and never distance-culled, but they are the block's
  children. The location is a loose object, and `CollectLooseObjects`
  destroys it with all it holds when its pixel leaves range, so the
  port removes them with the pixel. A foe whose spawn lands after its
  block went goes too. `SerializableEnemy` saves them; a load restores
  them as loose foes and the rebuilt block rolls seven more. That is
  DFU's arithmetic, and the port's.
- **Once per block.** A trip into the dungeon and out again finds the
  camp as it was: DFU disables the exterior, it does not destroy it, and
  the port's dungeon exit keeps the built world.
- **The climate.** `CreateDaggerfallMeshGameObject` gives a mesh its
  default textures, and the DaggerfallLocation re-skins every mesh
  under it only when its season or city-lights flag changes
  (`ApplyTimeAndSpace`). Whether the camp stands before the location's
  first check is a matter of Unity's Start and Update order. After the
  next dusk, dawn or season change the camp wears the location's
  climate either way. The port stands it re-skinned from the start.
  The Hold is temperate, so the two can differ only in winter, and then
  only until the next dusk or dawn.

## A rebuild the reference never makes (WOD3, WOD4)

Three port teardowns rebuild a pixel where DFU unloads nothing: the
season re-skin, the roads sweep and the roads retry (`destroyPixel`'s
`collectLoose: false`). DFU's components live through all three, so
the port carries them across. Each marker keeps its state, matched by
where it stands, and a spent kidnap marker keeps the captive it stood,
which the rebuilt pixel stands again (WOD5). The camp keeps its roll
and its foes. A real unload (a pixel leaving range) drops the carry, and
so does a sweep (a teleport, a travel, a load), which is an unload of
everything.

## The audit (WOD5)

A second, independent pass read the port against the eight sources.
It found four behaviours the port did not yet share, and all four are
fixed and pinned (`test/wod5_audit.test.js`):

- the mirrored wall drawn inside out;
- a region visited between two builds going unheard;
- a captive vanishing on a port-only rebuild;
- the marker's pile riding a save DFU never writes.

It also found one C# throw that the port does not reproduce, recorded
above with the other readings. Everything else it checked matched:
- the pick loop and every guard in it;
- the flatten (its inclusive bounds, the float lerp, the distance);
- the object positions, AlignToBase and the scale fix;
- AddLight's thirty arms and its default;
- the archive-string arms and each Add*Spawn's fields;
- every spawner arm and roll;
- both ground aligns;
- the Hold, value by value;
- the TryParse and ValidateValue ports.

## THE FOUR HOSTS

- `scenes/world.js` - WIRED. It is the one host that streams terrain.
  The DECISION runs before the kernel (it reads only the map data): the
  region under the player is announced (the list is only ever read at a
  build, so a build is where `OnRegionIndexChanged` is polled), every
  announced folder lands, the pick is taken. The smoothing arms run IN
  the kernel (`world/terrainGen.js`), after the tiles are assigned and
  before the grid and the nature - the order `OnPromoteTerrainData`
  holds in DFU - and the averages ride back. The objects stand after the
  location block, pixel-local, so `destroyPixel` takes them with the
  pixel as the C# destroys the terrain's children at every promote. The
  markers ride the built pixel too, and are ticked every exterior frame
  (WOD3).
  The camp at Privateer's Hold stands on the block's origin, and its
  rolls come on the first exterior frame the block stands in (WOD4).
- `scenes/exterior.js` - the loader is FLAGGED: one fixed location on a
  flat ground quad, no streamer, no heightmap, so there is no wilderness
  pixel to stand a site on. The camp at Privateer's Hold is WIRED
  (WOD4): this probe host lays out RMB blocks, so a `?loc=` at the Hold
  stands the camp in its fixed frame, lights the fires at every hour
  beside the lanterns, and rolls the foes on its first frame. It never
  unloads, so the camp lasts as long as the scene.
- `scenes/worldModes.js`, `scenes/dungeonContext.js` - FLAGGED:
  interiors and dungeons, no terrain and no exterior block.

The grass (the enhanced lane's own) keeps off a site's rect as DFU's
nature keeps off the loader's `locationRect`, and is re-read over a
pixel whose ground a site moved (GRASS-STALE1's rule, which a location
already had).

## Online: the room's list

DFU has no room, and the list one player builds depends on where that
player has travelled. Two players standing on one pixel can pick
different instances on the 177 pixels named from two folders, and on
the border pixels of a region only one of them has entered - and this
mod levels the ground, which is what a room must agree on. So the mod's
one switch is ROOM-OWNED (`systems/onlineLane.js`, beside the roads),
and an online page loads every folder at once in one order: 17 first,
then ascending. Offline the list is the reference's, path and all.

The spawn points need nothing of the room's. Each client runs its own
markers against its own player, on its own stream. A foe a marker
stands is its maker's pool's and reaches the others as every exterior
foe does, a puppet on their screens. A pile is its maker's alone. Two
players who walk into one camp therefore spring its markers twice, and
the room sees both sets.
The camp at Privateer's Hold is the same: each client rolls its own
seven.

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
- `src/world/wodLocationObjects.js` - `LoadObject` and its helpers as
  data: the archive-string arms, the mod's `AddLight`, the transform.
- `src/world/worldOfDaggerfall.js` - the page's one loader: Awake, the
  region events in order, the room's list, the placements.
- `src/world/wodSpawner.js` - `LocationEnemySpawner.cs`: Start, Update
  and the five arms as one machine.
- `src/world/groundAlign.js` - GameObjectHelper's two ground aligns.
- `src/world/wodPrivateersHold.js` - `DungeonExterior.cs` and
  `PrivateersHold.cs`: the block's name, Start's camp as data, its rolls.
- `src/world/roadsProducer.js` `basicRoadsPathsPoint` - the question the
  loader asks Basic Roads.
- `tools/worldOfDaggerfallAssets.mjs` - the archive to `vendor/`.
