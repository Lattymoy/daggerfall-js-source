# Deep Waters - Iliac Puddle No More (DW-A to DW-F, 2026-09-25 to 2026-09-26)

jet082's **Iliac Puddle No More 1.2.2** (Nexus 1304; its assembly calls
itself *Deep Waters*), ported 1:1 off the compiled assembly - Mac,
2026-09-25: "All mods attached are to be compatible and implemented 1:1."
Provenance is `vendor/iliac-puddle-no-more/README.md` (its permission line
is RECORD OPEN). It is the required dependency of jet082's *There's a Hole
in the Bottom of the Ocean*.

"The Iliac Puddle is now the Iliac Bay." Vanilla Daggerfall's sea is a
flat sheet of water a hand deep over a flat seabed; the mod carves it out.

## The slices

| slice | what | the port's modules |
|---|---|---|
| DW-A | THE COASTLINE: for every map pixel, how far each cell lies from the shore and which cells are sea (the mod's 356 MB `DistanceBake`) | `world/deepWatersBake.js`, `world/deepWatersBakeCache.js`, `world/deepWatersClient.js`, `world/deepWatersWorker.js` |
| DW-B | THE FLOOR: the per-pixel tile data (the biome, the local edge), the bathymetry (`DeepBathymetry.SampleDepthMeters` - the edge distance's shelf, the climate's base depth, the noise), the floor mesh and its walls, the cap that hides a pure-ocean pixel's ground and clips a coastal pixel's water tiles, the surfaces | `world/deepWatersPixel.js`, `world/deepWaterTileData.js`, `world/deepBathymetry.js`, `world/deepWaterClassification.js`, `world/deepWaterFloor.js`, `world/deepWaterCap.js`, `world/deepWaterSurface.js`, `scenes/deepWatersHost.js` |
| DW-C | THE LOOK: the seafloor's and the surfaces' own programs (read back to GLSL uniform for uniform), the scene tint, the underwater distance fog, the horizon under the water | `render/deepWatersRender.js`, `world/deepWaterLook.js`, `render/fogGlsl.js` (`uDwFog`) |
| DW-D | THE SWIMMER: the swim driver in its two phases around the motor, the swim movement (the multiplier, the stroke, the floor clamp), the load grace, the public player API, the ear under the water, the breath | `scenes/deepWatersPlayer.js`, `scenes/deepWatersSwimMove.js`, `world/deepWaterSwim.js`, `world/deepWaterRuntime.js`, `systems/deepWaterPlayer.js` |
| DW-E1 | THE RUNTIME'S OTHER HALF: the transient reset a load or a teleport sends every spawner, the post-transition refresh, the light and heavy work gates, the tracker a spawner keeps what it stood in | `world/deepWaterRuntime.js`, `world/deepWaterTransients.js` |
| DW-E2 | THE DECORATIONS: the weed, coral, rock and dead sea life of the seafloor - the catalog, the per-pixel placement, the work's pacing, the three ways a batch stands, the edge clean, the program | `world/underwaterDecorations.js`, `scenes/deepWatersDecor.js`, `render/deepWatersRender.js` (`DECOR_VS`/`DECOR_FS`, `COLUMN_GLSL`) |
| DW-E3 | THE FISH: the seven species and their items, the school, the fish's laws, the encounter pulse and the fish's spawner, the fish as loot, the icons, the draw | `world/passiveFish.js`, `scenes/deepWatersEncounters.js`, `scenes/deepWatersFish.js`, `systems/deepWatersFishItems.js`, `render/deepWatersRender.js` (`streamDecorations`), `tools/iliacPuddleAssets.mjs` |
| DW-E4 | THE DEEP'S FOES: the depth table, the rare and the boss rosters, the column and the place, the foes' lane on the pulse, the treasure guards, the one water level every foe's WaterMove reads | `world/underwaterEnemies.js`, `scenes/deepWatersEncounters.js` (`createEnemySpawner`, `trySpawnTreasureGuards`), `scenes/exteriorFoes.js` (`transformY`, `team`, `transient`, `managed`, `waterLevelY`) |
| DW-E5 | THE SUNKEN LOOT: the pulse and its gate, the stray piles and their rubble, the wrecks - their rubble, their piles, their guards - FillRandomItem's seven kinds, the tracker and the reset; the pile a RandomTreasure container in the decorations' underwater material | `world/underwaterLoot.js`, `scenes/deepWatersLoot.js`, `scenes/droppedLoot.js` (`drawn`, `owner`, `removePile`), `scenes/deepWatersDecor.js` (`filter`, `stand`), `systems/loot.js` (`createRandomReligiousItem`, `createRandomGem`, `createRandomJewellery`) |
| DW-F | THE CLOSE: the sea at a distance - the far ground's skirt out of the carved sea, the world's fog on the top and its column share, WATER1 off the clipped tiles - and the audit pass over the whole mod (the flats' column share, the pausing window, the execution order, the save-load reset, the dungeon splash, the latched fog colour, the load flag, the guards' terrain, the loot's camera, the texture cache, the arrow's draw) | `world/deepWaterCap.js` (`clippedTerrainIndices`), `render/deepWatersRender.js` (`TOP_FS`, `TOP_FAR_FS`, `_frameUniforms`), `render/columnGlsl.js`, `render/renderer.js` and `render/enhancedLighting.js` (the flats' share), `scenes/deepWatersPlayer.js` (`saveLoad`), `world/deepWaterRuntime.js` (the load flag), `scenes/world.js` |

## The coastline is rebuilt, not carried (DW-A)

The mod computes its bake from WOODS.WLD, MAPS.BSA and BLOCKS.BSA - a
derivative of Daggerfall's own data, which never enters this tree. The port
builds the same planes on the player's machine from the player's own files,
by the rules the file proves (the threshold, the fine any-of-3x3 mask with
rows from the north, the coarse strict majority, the flood from the map's
border, octile distances capped at 255), and caches them in IndexedDB. With
the mod's own `DistanceBakeVanilla` at hand, `test/dwa_bake.test.js`
compares the two cell for cell; they agree to within the Perlin departure
(Port-Ledger A: Ken Perlin's reference noise where Unity's Mathf.PerlinNoise
stood - the author's bake is a little wetter at the coast).

## The floor (DW-B)

A carved cell's ground is the seafloor: the world host's `heightAt` answers
the floor's own height there, so the capsule, the foes and every probe stand
on it with no second ground. The floor's walls stand along the pixel's edge,
where the carve stops at the boundary (AppendHoleEdgeWalls: the border
cells only, where the bake's hole does not run on across the boundary, and
never on a pixel read off the local fallback) - a carved cell beside the
shore inside a pixel has none - as collider meshes (`host.wallBuckets`,
which the swimmer's shore probes skip, as the mod's `IsShoreGround` refuses
its own floor). The collider reads a heightfield STEP as no slope
(restFloor and groundNormal take the gentler one-sided grade): a body at
the step rests on the ground beneath it, never metres over it.

**The tile reads.** DFU's own TerrainNature reads `tilemapSamples[x, y]`;
the mod indexes it `[z, x]` - the row from fracZ, as it indexes the
heights - so every tile it reads is the tile TRANSPOSED across the pixel's
diagonal. The port keeps the mod's reads exactly
(`world/deepWaterClassification.js`): where they land differently from the
heights, the only thing they add is a water-surface quad at sea level under
ground that stands above it, which nothing sees.

## The look (DW-C)

The floor and the surfaces draw with the mod's own programs. The distance
fog - the mod's post effect over the camera's depth texture - is applied
per fragment in every world program instead (`dwWaterFog`, the same
arithmetic on the same distance), with a pass of its own over the sky's
pixels; see the Port-Ledger row. It is on while the presentation is under
the water (`UnderwaterDistanceFog.TryGetUnderwaterPresentation`), which is
also what the surfaces' `_DeepWatersUnderwater` reads.

## The swimmer (DW-D)

OutdoorSwimDriver runs FIRST in DFU's frame (execution order -32000) and
OutdoorSwimDriverAfter LAST (32000); the port runs the two phases around its
motor (`beforeMove` / `afterMove`):

- **The decisions.** In the water: the capsule's swim-check point (its
  centre + 1.25 - 0.95) within 0.75 m of the sea (1.5 while diving) over a
  usable column, held 1.25 s after contact is lost, never on shore ground.
  Swimming: in the water and the check point under a line 0.1 m OVER the
  sea (0.75 once forged - the hysteresis), or diving, or rising. The head:
  the centre + 0.95, a quarter metre under. The presentation: the camera
  under a line 0.04 m over the sea or the head under, until the camera
  stands 0.08 m clear.
- **The forge.** The mod hands DFU a `blockWaterLevel` - the sea + 0.75 m,
  or just over a swimmer riding higher - through `WorldYToBlockWaterLevel`
  (a short, Mathf.Round's banker's tie), and the port's motor takes the
  height that short stands for; `LevitateMotor.IsSwimming` and
  `PlayerEnterExit.IsPlayerSwimming` ride the host's ONE motor flag write
  (`applyMotorEffectFlags`), because every change of the first cancels a
  step. The forged level and `isPlayerSubmerged` reach what DFU reads past
  the motor: the ambient's water sounds (WaterGentle at the line, the
  bubbles under it), Temple.AvoidDeath (a Stendarr priest drowning at sea
  is not saved), and the breath (PlayerEntity's own clause, on the forged
  submersion). The forged `OnExteriorWaterMethod` is what the footsteps
  read - never the motor's own: PlayerMotor.Update recomputes that from the
  ground right before the height changer reads it, and the carved sea's
  ground is none (no DaggerfallTerrain under the swimmer), so DFU's height
  changer swim-CROUCHES the swimmer, as in a dungeon, and never sinks one.
- **The post phase.** Out on shore ground ends the swim (Restore, the stand
  requested, a crouch cleared for 1.5 s after); else the decisions again
  from where the move left the player, the flags re-applied, the ascent
  clamped at the sea + 0.55 - 1.25 + 0.93 while rising, and
  `KeepSurfaceCameraUnsunk` (the forced swim crouch dropped with the head
  clear; a vanilla sink, where one holds, undone).
- **The shore exit.** A surface swimmer (not diving, outside the load
  grace) pushing forward at a shore: a landing 1 m ahead (then under the
  player) found by a ray from the sea + 13 m down 18 m, a walkable slope
  with no open water under it, and the capsule's centre moved to 1.5 m
  over it by a swept move.
- **The movement.** The Swim Speed Multiplier is a walk speed modifier
  (`AddWalkSpeedMod`) - it scales GetBaseSpeed's walk arm wherever DFU reads
  it; the stroke is Run's edge (either edge), `max(24, ceil(MaxFatigue x
  0.025))` fatigue, a burst of the swim speed x 2.65 x the tempo along the
  keys through the camera, eased out over 0.48 s / tempo, 0.9 s / tempo
  apart; the capsule's centre is kept 0.18 m over the swimmable floor.
  LevitateMotor's move is a bare CharacterController.Move - no ground snap.
- **The load grace** (`DeepWaterRuntime`): while a save loads and 1.5 s
  after, 1.5 s after a teleport, while a location loads (dropped as stuck
  after 12 s) - the shore exit, the stroke and the multiplier stand down.
- **The rest of the frame.** A boat (the `ImOnABoat` bundle) or any
  `ShouldSuppressOutdoorSwimming` subscriber turns the swim off
  (ClearBoatSwimPose); the listener takes a 1000 Hz low-pass while the
  presentation is under; a swimmer's splash every 2.5 m (clip 346 at 0.7);
  rain and snow stop for a swimmer; the vanilla encounter roll stands down
  in or over deep water; Argonians breathe forever where the setting says
  (IsWaterBreathing, wherever the player is - a dungeon's water too).
- **The public API** (`systems/deepWaterPlayer.js`, DeepWaterPlayer): the
  four published flags, OnStateChanged announced once a frame with each
  listener isolated, the suppression event, TryGetWaterColumn.

## The runtime's other half (DW-E1)

- **The transient reset** (OnTransientReset): a save starting to load and a
  teleport reset the transition state and tell every subscriber, in the
  order it subscribed - the mod's InstallSubsystems subscribes the floor
  builder's deferred list, the foes, the fish, the pulse, the decorations
  and the loot; the port's world the decorations, the pulse (the fish and
  the foes with it) and the loot, each clearing only its own, so the order
  shows nowhere. The floor builder's list is the port's whole-stream queue
  and outlives the reset (Port-Ledger (9)).
- **The post-transition refresh**: a load landing or a teleport (the new
  game's first stand is one - StartNewCharacter teleports the player)
  leaves one pending; the first frame terrain may be touched again (no
  grace, no terrain pass running) runs the decorations' RefreshPlayerArea.
- **The work gates**: light work while the game plays (no window over it)
  and no load is in progress; heavy work also waits out the grace's clock.
- **The tracker** (`world/deepWaterTransients.js`, TransientObjectTracker):
  the list a spawner keeps of what it stood - Clear (each destroyed now),
  Release (each handed to the encounter pulse's destroy queue), Prune (the
  dead dropped, the far destroyed, then the farthest until the cap).

## The seafloor's decorations (DW-E2)

- **The catalog.** Six pools of Daggerfall's own flats from archives 105,
  106, 206, 211, 213, 253, 305, 306, 380, 501 and 502 - weed, coral, rocks,
  dead sea life - one per water biome (the climate's, ClimateToBiome), each
  a list with a record repeated as often as its weight. Archive 106 records
  2-6 are animated, at 5 frames a second.
- **The placement**, per map pixel and seeded by it: a pass count off the
  Decoration Frequency (its fraction a roll; more in the open ocean, fewer
  in the desert's); each pass walks the heightmap three samples at a time
  with a jitter of up to two, keeps a sample under the sea and stands a
  picked record on the floor mesh's own triangle there - at least 8 m of
  water, at most 35 degrees of slope, a quarter metre clear of the floor
  (three quarters for the animated), half a metre under the surface at 1.2x
  the record's height, five metres from every other, until the per-pixel
  cap (Max Decorations Per Tile); past the cap the list is shuffled and cut.
- **The work**, as the mod paces it: the pixels within the Decoration
  Populate Radius of the player's, re-enqueued when the player crosses into
  a new pixel; one placed batch stood, or else one pixel placed, a frame
  (ProcessWorkQueue returns once a batch stands or warms); heavy
  work only, and not in a frame the floor's deferred builds already spent a
  millisecond in (DeepWaterPromoteTiming - the mod flushes the timing at
  the head of its Update, so a build made in the promote itself or in a
  settings callback never counts); the player's own pixel keeps what it
  has; a pixel is placed once its floor is built and again whenever the
  floor is rebuilt.
- **Three ways a batch stands** (UnderwaterDecorationBatchFactory.Spawn):
  with no replacement art, DFU's billboard batch - the record's own scaled
  size, its base on the point, a random start frame; with a replacement
  picture, a material batch - the replacement's billboard size x a random
  0.7 to 1.2, its base on the point; an animated record whose replacement
  has frames, a billboard each - the same random scale, from its first
  frame, turned as a DaggerfallBillboard turns (the camera's horizontal
  facing, not the batch's), and its CENTRE on the point (the billboard's
  pivot is its centre and the mod sets its position straight).
- **The edge clean** (GetEdgeCleanedTexture): a flood from each picture's
  four edges through its padding - alpha under 16, or every channel 12 or
  less - clears what it reaches, so a flat's black outline against its
  transparent surround goes and the sprite reads clean against the water.
  Not an animated replacement's frames: its material is cleaned once, and
  then the billboard's own animation (DaggerfallBillboard.AnimateBillboard)
  sets every frame on it straight from the imported textures.
- **The program** (DeepWaters/UnderwaterBillboardBatchUnlit): the quad
  stood about the up vector, its right the cross of the view's third column
  with the up (DFU's batches' own facing), the texel times 1.12, the cut-out
  at 0.5, the scene tint, no Unity fog - the distance fog closes it - and,
  seen from over the sea, the top's share of the water column over it, as
  the floor takes it (`COLUMN_GLSL`): the mod's batches write the depth
  texture the top reads.

## The fish (DW-E3)

- **The species** (PassiveFishSpeciesCatalog): seven, each one of the
  mod's items (templates 9001-9007, UselessItems2, the mod's own
  `ItemTemplates.json` verbatim) - the Longnose Butterflyfish, the
  Largemouth Bass, the Canary Rockfish, the Crucian Carp, the Mackerel, the
  White Zebra Angelfish and the Juvenile Finulon (30 kg). Each has a spawn
  weight, a billboard height (x a random factor from its own band) and
  aspect, a school size, the water biomes it lives in and the band of the
  sea's depth it keeps to; its weight falls off over 0.18 of the depth past
  either edge of the band.
- **The pulse** (UnderwaterEncounterPulse), every frame: a dozen of the
  queued destroys, five of the queued spawns, then - a tenth of a second
  apart - the tick. No heavy work: everything cleared. Otherwise the fish
  items put back in their group every two seconds
  (NormalizeFishItemCollection); the player outside the outdoor water
  context, or the Passive Fish Frequency at zero, and two seconds of that
  clear the lane; else the loaded pixels within 300 m of the player (the
  nearest edge) are kept, the rest release their fish to the destroy queue,
  and every water pixel within 200 m - ocean-connected, with a distance
  field - gets two attempts, the nearest first. Indoors the pulse still runs
  (its clearing and its destroys); the fish do not.
- **The spawner**, per pixel: 90 attempts x the frequency / 3, spent two a
  tick. An attempt draws a point on the pixel, a species for the pixel's
  climate and the column's depth over the sea's Water Depth (by weight), a
  place in the column - at least 8 m of water, 1.2 m off the floor and
  1.4 m under the surface (half the tallest fish the species draws, if
  more), a depth inside the species' band, leaning to the floor's 35 m past
  0.55 of the depth - and a school of Range(min, max + 1) held under Max
  Live Fish (0 to 1,080); the first fish at the point, its schoolmates on a
  ring 1.2 m to the school's radius round it, 2.2 m apart. A spawn is
  queued and counted; five stand a frame.
- **The school** (PassiveFishSchool): a centre that cruises at 0.95 m/s x
  the species' multiplier, on a heading held 2.2-4.4 s and flattened to
  0.15 of its climb; a threat turns it from the player at 1.45 m/s x the
  flee multiplier for three seconds. It keeps 1.2 m off the floor and 1.4 m
  under the surface and turns back from water under 2 m deep.
- **The fish** (PassiveFishBehaviour): cruises at 1.2 m/s x its
  multiplier, with its school (steering for its place in it) or alone (a
  new heading every 5-9 s); within 8 m of the player it flees at 3.5 m/s x
  its flee multiplier, darting 35-75 degrees off the line away and holding
  each dart for the species' own hold. It keeps 0.8 m off the floor and
  1.4 m under the surface, and a fish that meets water under 2 m deep goes
  back where it was and turns round. Past 160 m it moves every quarter
  second; within 60 m it probes ahead every fifth frame (Physics.Raycast,
  every layer, triggers ignored - the port's collider meshes, the ground,
  the player's capsule and every standing foe's) and turns off what it
  meets. It is drawn only within the visible distance - the vision x 1.1
  under the sea, the top surface's opaque fade from over it.
- **A fish is a loot container** (SpawnPassiveFish): a DaggerfallLoot with
  its species' item, a trigger box of its size (a quarter of its width
  deep, at least 0.35 m) turned with the billboard, taken through the loot
  container's reach (3.2 m); the loot window shows the fish's own icon
  (FishLootIcon) over whatever the window drew, and once its item is taken
  the fish is gone.
- **The icons** (PassiveFishResources): each fish's picture with its shape
  given back (RestoreIconAspect - Unity's import rounded every picture to
  powers of two; a point Blit to round(height x aspect) wide). The mod
  writes them into ItemHelper's cache under TEXTURE.216 records 41-47; the
  port gives each template an archive of its own (its index, record 0),
  which every item picture reads the same (the Ledger's row says why that
  is no departure).
- **The draw**: a billboard turned to the camera, pitch and all (FaceY),
  in the decorations' program - the tint, the fog, the column's share -
  at the fish's own cut-out (0.1), streamed each frame. The pictures are
  the author's (`vendor/iliac-puddle-no-more/Flats/`), edge-cleaned as the
  decorations' are; a species spawns once its picture is in.
- **The clock** is the game's: a pause holds every fish.

## The deep's foes (DW-E4)

- **The roster** (UnderwaterEnemySpawner): eleven types, each with a
  weight and the band of the sea's depth it keeps to - the Slaughterfish
  (60, the top 0.7), the Lamia (18) and the Nymph (10) in the shallows,
  the Dreugh (25) past 0.15, and under them the dead and the cold: the
  Zombie, the Skeletal Warrior, the Ghost, the Wraith, the Ice Atronach,
  the Vampire and, past 0.85, the Lich. A type's weight falls off over
  0.18 of the depth past either edge of its band, the fish's softness.
  Past 0.6 of the depth, one foe in a hundred is a boss instead - the
  Ancient Lich or the Vampire Ancient.
- **The lane**, beside the fish's on the pulse: 96 attempts a pixel x the
  Enemy Frequency / 0.5, spent four a tick; an attempt draws a point, a
  column at least 4 m deep between the floor's 2.5 m and the surface's 3,
  a foe for the column's depth, and its place - the walkers (the Nymph,
  the Zombie and the Skeletal Warrior, the Ice Atronach, the vampires and
  the liches; the Ghost and the Wraith are no walkers) on the floor, the
  swimmers anywhere in the column, and past 0.55 of the depth leaning into
  its lowest 0.35. One stands a frame, up to Max Live Enemies; a foe that
  dies keeps its count until its pixel's group leaves.
- **A foe is the exterior pool's own**, stood as CreateEnemy stands it and
  then set where the mod sets it: the transform straight on its point (a
  floor-bound one first dropped so its capsule sits on the floor -
  AlignFloorEnemyController), hostile to the player from the start,
  facing north, saved by nothing (the mod's foes have no LoadID). It
  stands a few frames after its spawn is pumped, when its career and
  picture have loaded; one that never does gives its count back. The
  pool's own 120 m relevance cull - the port's allocation guard for the
  encounter pool, which DFU does not have - passes it by: it stands until
  the mod's spawner releases it, as DFU's loose enemies do.
- **The water it swims in.** DFU's EnemyMotor.WaterMove moves an aquatic
  foe only under PlayerEnterExit.blockWaterLevel, and outdoors that level
  is no water - except while the mod's swim driver holds the sea's forged
  level. Every exterior foe reads that one level (`waterLevelY`), so the
  Slaughterfish, the Dreugh and the Lamia swim while the player is in the
  sea's water context and hang where they are once the driver lets go, as
  under the mod.
- **The treasure guards** (TrySpawnRareEnemiesNearTreasureCluster, which
  DW-E5's clusters call): the rare roster on the Undead's team, their
  count off the enemy frequency (five at 0.6 and up), a boss first two
  times in a hundred, on a ring 8 - 30 m round the cluster and outside the
  player's immediate view (DeepWaterWorld.IsOutsideImmediateView: not
  behind the heading, off screen or past the reveal distance), 8 tries a
  guard and 15 more, and one at the centre when none stood. No group and
  no count holds them.

## The sunken loot (DW-E5)

- **The pulse** (UnderwaterLootSpawner.Pump, the last of DeepWaters.Update):
  heavy work allowed, the Seafloor Loot Rate or the Treasure Cluster Rate
  above nothing (0.7 and 0.1 at the sliders' midpoints), the player playing
  in the outdoor water context, and a column 8 m deep under the player or
  within 72 m (HasNearbyWaterColumn: the player's own column first, then
  42, 57 and 72 m, twelve ways; asked every two seconds and its answer kept
  between). The first frame of that pulses at
  once; after it the player must have moved 90 m (flat) since the pulse was
  last asked, and a pulse waits 8 s after one that stood something, 3 s
  after one that stood nothing. Out of the context the anchor is let go, so
  coming back pulses at once.
- **A pulse**: the tracked piles and batches past 140 m destroyed, and the
  farthest while more than Max Live Loot Objects (192) remain; a wreck's
  centre forgotten past 140 m; at the cap, nothing, and the clock left as
  it was. Then a wreck by its chance - the rate x 2 (3 in a Treasure Cove) x
  the shore's share x the depth's, capped at 0.85, under Max Live Treasure
  Clusters (12) - and the stray piles by their count: RollCount(2 x the rate
  x 2 (3) x the shore x the depth), 12 at most (18 in a cove), none after a
  wreck but in a cove. The shore's share is an eighth unless the player is
  in or over water 8 m deep (IsPlayerInOrAboveDeepWater); the depth's is
  Lerp(1, 2) over the column under the player against the Water Depth.
- **A spot** (PickSpawnSpot), 18 tries: half of them a point ahead of the
  camera's flat heading, within 45 degrees of it, just past what the player
  can see (TryPickFogAheadPoint: the reveal distance + 2 and a random 25 m,
  no farther than 130 m); the rest on the 42 - 72 m ring, seven in ten
  within 110 degrees of the heading (PickSpawnAngle). Never a 48 m cell used
  in the last 128 (WorldCellKey, RememberSpawnCell); the seafloor 2 m deep
  under it with the rendered floor 2 m under the sea (ResolveSeafloorAt:
  the floor + 0.08); out of the player's immediate view (DW-E4's test, a
  0.12 margin).
- **A pile** (SpawnLootContainer): DFU's CreateLootContainer - a
  RandomTreasure container, the Ground picture, TEXTURE.216 at one of 25
  records, its base on the spot, parented to the terrain the column stands
  on, never restored by a load (DFU restores only a customDrop container) -
  with no shadow and the decorations' underwater material on it
  (BrightenUnderwaterBillboards: the texel x 1.12, the tint, the column's
  share, the distance fog, the billboard shader's own 0.5 cut-out), turned
  as a DaggerfallBillboard turns. It is `droppedLoot`'s own container - the
  ray's target, the loot window's, the plaque's, Detect Treasure's, the
  recentre's - drawn by the loot pass instead of a batch of its own. A
  stray pile holds one item (FillRandomItem: a religious item a quarter of
  the time, a potion a fifth, jewellery, a gem, clothing, a weapon, armour -
  ItemBuilder's own calls at the player's level, gender and race; the race
  moves only a garment's paper-doll archive, which the port's items do not
  carry) and, three times
  in four (19 in 20 in a cove), one or two flats of rubble 1.5 - 5 m round
  it, never the same flat twice.
- **A wreck** (TrySpawnTreasureCluster), on a spot at least half the Water
  Depth deep: 24 flats of rubble over 22 m (48 in a cove) - the 17 records
  of RubbleRecords, stood by the decorations' batch factory (FilterPlacements
  and all) under an anchor on their terrain that the tracker holds - three to
  five piles within 11 m of its centre, 3 m apart (six to ten in a cove), two
  to four items each (four to eight), and the treasure guards (DW-E4's
  TrySpawnRareEnemiesNearTreasureCluster). A wreck with neither rubble nor a
  pile is none.
- **The reset** (OnTransientReset, which the spawner's Install hooks): every
  tracked pile and batch destroyed, the cells, the wrecks, the anchor and the
  clocks forgotten. A pixel that leaves the stream takes its piles and its
  rubble with it - DFU pools the terrain with its children instead, a
  Port-Ledger departure; a pixel the port rebuilds (a season's re-skin, the
  roads, a World of Daggerfall sweep - rebuilds DFU never makes) keeps both
  where they lay.
- **The camera** the view tests read (IsOutsideImmediateView, the guards'
  and the spots'): the one the frame is about to draw, built at the pulse -
  its eye, its lens - and the player's velocity is the motor's (a
  recentre's or a door's move is none: CharacterController.velocity is set
  by Move alone).
- **The recentre**: the piles and the rubble move with the world, being the
  terrains' children; the pulse's anchor and the wrecks' centres are the
  spawner's statics in world space and stay where the world was, as they do
  under the mod - so a crossing into a new pixel runs a pulse, and that pulse
  forgets every wreck.

## The sea at a distance (DW-F)

Mac, 2026-09-26: "at a distance, the ocean seems to look like large square
panels". Two causes, both the port's own, both closed:

- **The far ground's skirt stood in the carved sea.** EV4's strided far
  ground hangs a 40 m skirt round every pixel (`TERRAIN_SKIRT_DEPTH`, the
  cure for the crack where a far pixel meets a near one). The clip - the
  clipped tiles' quads left out of the ground's index set (DW-C) - kept
  that skirt whole, so every far coastal pixel hung a pale curtain along
  its edges, its top a hand under the surface, and through the top the
  curtains ruled the sea into pixel squares. A skirt segment now goes when
  every edge tile it hangs under is clipped (`clippedTerrainIndices`), as
  the mod's discard would take its texels; a pure-ocean pixel's ground is
  hidden whole, as before.
- **The top took no world fog.** The port's world reaches past DFU's - the
  streamed grid, then the far ring out to the fog's end - and all of it is
  fogged. DW-C's read-back of TransparentWaterSurfaceTop has no fog term,
  so the carved sea stood out of that world unfogged: a dark slab to the
  horizon, its pixel edges showing against the fogged ground and the far
  ring's water. The top and its far-plane arm now take the world's fog at
  their own fragment, as the floor does. The column's share carries what
  the top covers toward the top's colour AT THE RAY'S ENTRY, fogged as the
  top is there, so the split sum is still the blend's; the decorations'
  own colour still takes none. This is Port-Ledger departure (8).
- **WATER1 lay over the carved sea.** The port's own water draws over the
  tiles whose art is water, and it read the pixel's original TileMap: a
  coastal pixel wore a second sheet a hand over the ground's height inside
  the carve, and water on the tiles the cap repaints from the ground beside
  them, where a pure-ocean pixel, hidden whole, wore none. WATER1 reads the
  cap's TileMap now (the clip's byte is no water to it), and the original
  again when the patch goes.
- **Past the streamed grid** the far ring (EV8) holds its haze at 85%
  through the middle distance, so its sea reads a shade darker than the
  fully fogged edge of the streamed world: the ring's own design, over land
  and sea alike, and not the mod's.

## The close (DW-F)

Four readers took the whole mod against the assembly after DW-E5 landed.
What they found and the port now does:

- **The deep's foes under the column.** DFU's `Daggerfall/Billboard`
  writes the depth texture the top reads, so a foe, a corpse or a dropped
  pile under the carved sea is covered as the floor is. Both lanes' flats
  take `COLUMN_GLSL` (one home now, `render/columnGlsl.js`) on a batch the
  host finds standing in a carved column (`dwFlagColumnFlats`), the surface
  texture on a unit of its own (`BB_SURFACE_UNIT`).
- **The pausing window.** DFU's breath runs in PlayerEntity.FixedUpdate,
  which a pausing window's time scale 0 stops, so no breath drains behind
  one. And every IsPlayingGame test the mod makes answers false behind any
  window (the playing test reads every stack now): the underwater
  presentation is none there (its fog, the underside, the light
  suppression, the low-pass), the stroke stands down and the multiplier
  lifts.
- **The mod's execution order.** The stroke runs beside the motor (order
  0) and before the driver's after phase (32000), and both read the camera
  this frame's move left.
- **The save-load reset** (OutdoorSwimDriver.OnSaveLoad, on both load
  events): the state cleared, the forge dropped without Restore, and a
  crouched save loads standing.
- **A dungeon swimmer splashes** every 2.5 m (UpdateSwimSfxAndWeather has
  no IsPlayerInside test).
- **The underside's fog colour is latched** at a settings change and at
  every surface built, as ApplySharedWaterProperties writes it.
- **The load flag.** Light work reads SaveLoadManager.LoadInProgress
  itself, so the load's own teleport no longer opens it mid-load.
- **The treasure guards live with their terrain** (keyed by pixel, taken
  by the unload).
- **The loot's camera and velocity**: the view test's camera is the one
  the frame is about to draw, built at the pulse, and the velocity is the
  motor's - rebased at a crossing, let go across a door, a teleport or a
  load.
- **The decorations' texture source** answers no replacement before an
  archive's file is in, and caches none - a pack's pictures and heights
  are no longer lost to an early question.
- **CreateRandomWeapon** draws RandomMaterial before the arrow test, as
  ItemBuilder does, for every caller.
- The loot's unordered compares are the C#'s own forms; the docs'
  thresholds, reset order, pacing, walkers and walls say what the IL does.

## What is not ported, and why

The Port-Ledger's section-A row for the mod carries twelve departures - the
coastline built rather than shipped, the fog per fragment, the water
column's two draws, the peripheral-location skip (below), the recentre that
carries the schools (below), the world's fog on the top (above, DW-F), the
whole stream carved, the unload that takes the mod's children, surfacing
that gives the sky its fog colour back and the swim's odometer on the
recentre (below, DW-F), and these two of the swimmer's:

- **The forge's `isPlayerInsideDungeon`.** The mod raises DFU's dungeon flag
  for the Update window of each forged frame to borrow the dungeon arm's
  swim; the port hands the swim, the submersion and the water audio state
  over directly and never raises it. The arm's own afloat line ("You are
  carrying too much to stay afloat.") IS ported - at sea while forged, and
  in the dungeons, which never had it (`player/motor.js`
  `afloatMessageStep`). What the flag would also reach in that window is not
  reproduced: the city watch held back, the ambient light's target held,
  EnablePlayerTorch's settings-off arm (not ported anywhere), and a window,
  a quest placement or a save that would take the sea for a dungeon for the
  frame.
- **The water terrain collider gate.** The mod turns the terrain's collider
  off over the sea so a swimmer can go under the vanilla ground; the port's
  carved `heightAt` already is the floor, on the floor mesh's own triangles.
`PlayerShipWaterlineFix` needs no port: the two ship pixels sample flat at
the ocean elevation, so the ship's location already stands at the sea. The
mod's install lowers Unity's `Time.maximumDeltaTime` to 0.1 s - the port's
hosts clamp every frame there already - and under that clamp its frame-spike
guard (a swimmer's frame past 0.1 s moves them nothing) fires only when a
raised time scale (Travel Options' accelerated journey) lifts the frame past
it; it is ported so (the motor's `levitateMotorEnabled`).

- **The peripheral-location skip** (SkipPeripheralLocationUpdates,
  PumpDeferredLocationRestore). While the player is in or over deep water,
  or any streamed terrain is ocean-connected, the mod has StreamingWorld
  skip building every location but the player's own pixel's (and an owned
  ship's), and builds them once the player is clear of the sea. It is a cost
  measure for DFU's streamed world; the port builds its locations in its own
  pipeline, so a coast's neighbouring towns stand as they do without the
  mod.
- **The recentre carries the schools.** DFU's FloatingOrigin moves the
  world a map pixel's width when the player crosses into a new pixel, and a
  fish, parented to its terrain, moves with it; the mod answers no such
  event, so a school's centre and a fish's last safe place stay in the old
  world's coordinates - the school's fish swim for a point 819.2 m off, and
  a fish that meets shallow water jumps back to where the old world had
  it. The port moves both with the world.
- **The whole stream is carved** (DW-F). The mod's PumpDeferredBuilds takes
  the nearest deferred pixel and hands it to the same nearness test
  HandlePromote runs, which defers a far one again and builds only its
  surface: the mod carves what the player has come within a pixel of and
  leaves the rest of its stream vanilla (and DFU's pooling carries a floor
  onto a recycled terrain). The port carves every streamed pixel, nearest
  first - a carved three by three in a vanilla sea is a square seam at the
  view's middle distance - and its deferred list outlives a transient reset.
- **The unload takes the mod's children** (DW-F). The piles, the rubble
  and the treasure guards are their terrain's children, which DFU
  deactivates as it leaves the stream and carries to the pixel it is
  recycled for; the port removes them with the unload, and keeps them
  through the rebuilds only the port makes.
- **Surfacing gives the sky its fog colour back** (DW-F). The mod saves the
  fog colour after DFU's UnderwaterFog has already written its water colour,
  and restores that on surfacing, so the fog above the sea stays DFU's
  underwater green until DaggerfallSky next changes its sky texture; the
  port's fog is the sky's again the frame the presentation clears.
- **The swim's odometer rides the recentre** (DW-F). UpdateSwimSfx sums the
  raw distance moved, so FloatingOrigin's shift mid-swim is a splash; the
  port moves the mark with the world, the footsteps' law.

## Online

The room owns thirteen of its switches (`systems/onlineLane.js`): the sea
and its depth (the seafloor is ground - two players who disagree would swim
over two floors), the deep's foes and sunken loot (the host's foes; a roll
that leaves the roller's hands), and the swim multiplier, the stroke and the
Argonians' breath (one ruleset per room). Its looks - the surfaces, the fog,
the fish and the weed - are each player's own.

## Tests

`test/dwa_bake.test.js` (the coastline), `test/dwb_world.test.js` (the
floor, the cap, the surfaces, the host), `test/dwc_fog.test.js` (the look:
the shaders transcribed u_xlat for u_xlat as oracles), `test/dwd_swim.test.js`
(the swimmer, through a real PlayerMotor over a real Collider: the forge,
the one edge, the surfacing, the dive, the shore exit and the post phase's
own, the grace, the suppression, the stroke, the API, the ear, the breath,
the afloat line, the frame-spike guard), `test/dwe_runtime.test.js` (the
transient reset, the post-transition refresh, the gates, the tracker),
`test/dwe_decorations.test.js` (the catalog, the seeded placement against
its C# line for line, the pacing through the real host, the three spawn
paths, the edge clean, the program and the column's share),
`test/dwe_fish.test.js` (the species and the depth weight, Unity's Slerp,
the school, the fish's flee, cruise, clamp, distant step and probe, the
placement, the icon's aspect, the spawner and the pulse in the mod's order,
the items and their icons, the host, the pictures, the capsule, the world's
wiring), `test/dwe_enemies.test.js` (the table and the rosters, the weights
and the boss, the column and the place, the attempts and the counts, the
view test, the spawner, the pulse's two lanes, the treasure guards, a foe
stood by the real exterior pool, the world's wiring), `test/dwe_loot.test.js`
(the constants and the two tables against the assembly, the pulse's rolls, the
spot, the seafloor, the wreck's depth, the cluster's spots, the rubble, the
item kinds, ItemBuilder's three group draws as one export, the undrawn
container, the spawner through fakes - the gate, the anchor and the clocks,
the cap, the cells, the shore, a stray pile, a wreck, the reset - and the
world's wiring), `test/dwf_farsea.test.js` (the far ground's skirt against
the edge tiles under it, the clip's ends, the top's and the far arm's fog
and the column's share run in the shaders' own GLSL, the decorations' own
colour unfogged, the fog handed to every program that reads it; WATER1 off
the clipped and repainted tiles), `test/dwf_audit.test.js` (the close: each
reader's finding against the port, behaviour where the port can run it and
the world's wiring where it cannot).
Mutation records: `tools/mutants/dwa.json`, `tools/mutants/dwd.json`,
`tools/mutants/dwe.json`, `tools/mutants/dwe5.json` (46, 46 dead),
`tools/mutants/dwf.json` (14, 14 dead), `tools/mutants/dwfa.json` (39, 39
dead).
