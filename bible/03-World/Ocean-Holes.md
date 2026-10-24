# Ocean Holes - There's a Hole in the Bottom of the Ocean (OH-A to OH-F, 2026-09-26)

jet082's **There's a Hole in the Bottom of the Ocean 1.1.0** (Nexus 1313),
ported 1:1 off the compiled assembly - Mac, 2026-09-25: "All mods attached
are to be compatible and implemented 1:1." Provenance is
`vendor/ocean-holes/README.md` (its permission line is RECORD OPEN). It
REQUIRES Iliac Puddle No More 1.2.2 (`03-World/Deep-Waters.md`): the pits
are cut into that mod's carved seafloor, through that mod's own API.

"There's a hole in the bottom of the sea": on one open-ocean map pixel in
48 (at the slider's midpoint) a black hole opens in the seafloor under a
plume of purple miasma, and swimming down into it leads to a drowned
dungeon - a real Daggerfall dungeon, borrowed from a region, flooded to
its ceiling, stripped of its lights and filled with the deep's own foes.

## The slices

| slice | what | the port's modules | state |
|---|---|---|---|
| OH-A | THE REGISTRATION: the vendored assembly, manifest and settings; the seven sliders; Features, credits, the registry; the online lane | `vendor/ocean-holes/`, `systems/modSettings.js`, `systems/features.js`, `systems/online/onlineLane.js`, `ui/credits.js`, `ui/enhanced/enhancedMenu.js` | landed |
| OH-B | THE PIT'S PLACE AND THE CUT: the hash, the pixels it picks, the placement, the tile queue and its gates, the bake's verification, the depth, the seafloor's cut through Iliac Puddle No More's API | `world/oceanHoles.js`, `scenes/oceanHolesHost.js`, `scenes/deepWater/deepWatersHost.js` (the API), `scenes/world.js` | landed |
| OH-C | THE PIT'S LOOK AND ITS DOOR: the three discs, the miasma, the entrance a swimmer touches | `render/oceanHolesRender.js`, `world/oceanHolesMiasma.js`, `render/deepWatersRender.js` (`updateFloor`), `scenes/world.js` | landed |
| OH-D | THE ABYSS: the template, the clone, the entry, the flood, the exit to the pit, the recall, the save | `scenes/oceanHolesAbyss.js`, `scenes/worldModes.js` (`enterAbyss`, the four DFU events, the layout's dungeon, the build's own location, the dungeon save's mod records), `scenes/world.js` | landed |
| OH-E | THE ABYSS'S CONTENTS: the flame foes gone, the replacements, the aquatic quota, the lights, the quest resources, the loot, the fog and the light | `scenes/dungeonContext.js` (`abyss`), `world/oceanHoles.js` (the loot pair), `systems/loot/loot.js` (`lootMatrix`, `tableLootSpawned`), `characters/enemy/enemyEntity.js` (`enemyLootSpawned`), `combat/enemyEquipment.js` (`weaponOfMaterial`) | landed |
| OH-F | THE CLOSE: the audit (three lanes against the assembly), its eleven fixes, the docs, the patch notes | `scenes/oceanHolesHost.js` (`checkSettings`, indoors), `world/oceanHolesMiasma.js` (`miasmaReach`), `scenes/oceanHolesAbyss.js` (`loadRebuilds`, `entering`, `returnPoint`), `scenes/dungeonContext.js` (the destroy saved, the settled restore, the spawn's marks at the build), `characters/dungeonEnemies.js` (`enemyHierarchyOrder`), `scenes/hostCombat.js` / `systems/loot/loot.js` (the rolling host), `scenes/world.js` | landed |

## The settings (OH-A)

Seven sliders, each 0..1 and 0.5 by default, read as the C#'s
ApplySettings reads them (`scenes/oceanHolesHost.js` `oceanHolesSettings`):

| slider | what the midpoint means | law |
|---|---|---|
| PitSpawnRate | one open-ocean pixel in 48 | clamped; 0 is none, 1 is one in 24 |
| SurfaceHoleSize | the surface's opening, 20 m in radius (40 m across; AUDIT PRE-MERGE 0928 H1 - CreateDisc scales a unit circle by it) | GetScaledSliderValue about 20 |
| SeafloorHoleSize | the seafloor's pit at scale 1 (32 m, the black 9 m) | GetScaledSliderValue about 1 |
| MiasmaParticleCount | 72 puffs | GetScaledSliderValue about 72, rounded half-even |
| MiasmaHeight | a 300 m plume | GetScaledSliderValue about 300 |
| DungeonVisualIntensity | the abyss's fog at density 0.25 | clamped (OH-E) |
| DungeonVisualDarkness | the abyss's fog 85% of the way to its colour | clamped (OH-E) |

GetScaledSliderValue is Iliac Puddle No More's own member, the same
formula; the port has one home for it (`world/deepWater/deepWaterLook.js`
`scaledSliderValue`, re-exported). A change to any of the first five
re-cuts every loaded floor (RefreshLoadedPits, forced); the two abyss dials
do not. Online, `Enabled`, `PitSpawnRate` and `SeafloorHoleSize` are the
room's (they decide where the ground is cut, so every player in a room
cuts the same holes); the rest are the player's own look.

## Where a pit is (OH-B)

- **StableHash(x, y, salt)** is Int32 arithmetic with LOGICAL shifts (the
  IL's `shr.un`, read off the assembly): `StableHash(17, 42, 1213156421)`
  is 1607323056, and the test restates it in BigInt so the pin is not the
  port's own arithmetic read back.
- **IsPitPixel(x, y, rate)** reshuffles the hash into 48 buckets of
  89,478,486 and takes the first `rate x 2` of them: none at 0, one pixel
  in 48 at 0.5, one in 24 at 1, and the pixels picked at a lower rate are
  always among those picked at a higher.
- **PlacementFraction(x, y, salt)** is `0.28 + (h & 0xffff) / 65535 x
  0.44` of the salted hash (`0x484F4C45 ^ salt`, 88 for x and 90 for z):
  the pit is never nearer a pixel's edge than 28%.

A pixel is queued when its terrain is promoted and one is processed a
frame (ProcessOneTerrain), in the C#'s order of gates, each rejection its
own diagnostic (`stateOf(entry).diagnostic`, the mod's
OceanHolesDiagnosticsRunner reads the same strings): the hash; a location
(never cut); Iliac Puddle No More's floor built and current (a missing or
stale floor waits, asking the sea to build it on a new wait and every
thirtieth try, for up to 600 frames); the bake's verification (loaded,
water in the pixel, no land in it, the point carved water and at least
256 m from the coast - the port's bake is always there, so the C#'s
unverified geometry fallback runs only if a bake query throws); and the
floor at least 70 m under the sea at the spot (RaycastFloor: a ray from
5 m over the sea, 1000 m down, onto the floor mesh itself - the mod's
MeshCollider is that mesh).

## The cut (OH-B)

DeformSeafloor walks EVERY vertex of the floor mesh, the walls' with the
grid's, as the C# walks `mesh.vertices`. Where the bake verified the spot
and the floor strays more than 5 m from the pit's mean height within
twice the pit's radius, the ring out to the pit's radius plus the larger
of that radius and twice the stray - but no farther from the pit's centre
than the pixel's nearest edge or 256 m, and never short of the radius
itself (AUDIT PRE-MERGE 0928 H2: DeformSeafloor IL_2212-IL_2282; the page
had read the reach as the radius plus the stray) - is smoothstepped toward that mean
first (`built:flattened`). Every vertex within the outer radius (32 m x
the seafloor scale) then falls by GetFloorPitDepth: 14 m inside the black
radius (9 m x scale), smoothstepped to nothing at the outer. A floor is
cut once per build version: a pit lost on the same floor is stood again
without a second cut.

The cut is committed through Iliac Puddle No More's own API, which the
port's Deep Waters host now carries (`scenes/deepWater/deepWatersHost.js`):
`isSeafloorCurrent`, `seafloorBuildVersion`, `tryGetSeafloor`,
`commitSeafloorChanges` (CommitExternalMeshChanges: the vertices taken,
the 65 x 65 height grid read back off the first 4,225 of them, the walls'
colliders stood again, the drawn floor's positions uploaded again - no
normals recalculated, as the C# recalculates only the bounds),
`refreshLoadedTile` (off while the terrain may not be mutated; a current
floor left standing unless forced) and `onSeafloorBuilt` (raised right
after a floor is built, before `onFloorRefreshed`, so a pixel is cut the
moment its floor lands). The decorations ask ShouldSuppressDecoration of
every placement: nothing grows within 32 m x scale of the pit.

## The pit (OH-C)

BuildPit finds the opening (FindPitOpeningY: the highest of the floor
under the centre and sixteen rays round a 12 m x scale ring) and stands:

| part | where | size | look |
|---|---|---|---|
| Blue Hole Core | the sea + 0.07 m | the surface radius | Unlit/Color (2, 15, 46) / 255, queue 3001 |
| Blue Hole Underside | the sea - 0.01 m | the surface radius | the same colour, queue 2001 |
| Abyss Miasma | the sea + 0.12 m | a disc of the surface radius - 1 | Standard (Fade) with emission, queue 3002 |
| Pit Black | the opening + 0.08 m | 12 m x scale | Unlit/Color black, queue 2000 |
| Ocean Hole Entrance | the opening + 0.22 m | a box 18 m x scale by 0.35 m | a solid box collider, met by the swimmer's touch (AUDIT PRE-MERGE 0928 H3: BuildPit IL_25cf-IL_2625 sets no isTrigger) |

The discs are the one 48-segment mesh CreateDiscMesh builds (each wedge
wound both ways), drawn with the world's fog, then the water column's
share and the sea's distance fog as every pass over the carved sea takes
them. The miasma is a simulated ParticleSystem (`world/oceanHolesMiasma.js`):
2 x count / 72 puffs a second up to the count, a 5 s prewarm, 30 s lives,
3-6 m puffs rising at 0.85..1 of the plume's height over a life, the size
over the life a four-key curve of flat-ended spans; billboards no larger
than 0.08 of the view's height.

The entrance fires once a second at most, and only for a swimmer outside
(OceanPitCollision.OnCharacterCollided): the capsule touching the box
(`scenes/world.js` `ohFrame`) hands the pit's pixel to TryEnterPit (OH-D).

## The way down (OH-D)

TryEnterPit (the entrance's touch) asks, in the C#'s order: nothing in
hand (not transitioning, entering or already in the abyss); the player
outside and swimming; a template. TryFindTemplate walks every location
from a region and a location picked by the template hash, borrowing the
first suitable dungeon (loaded, two blocks at least, not a main-story
one, of types 0, 4, 5, 6, 8, 9 or 11) with no quest site linked to it -
a type 6 at once, any other only if no type 6 turns up. None: "The
darkness below refuses to open." for 3 s, and nothing moves.

Found, the mod writes OceanHoleSaveData - the pit's pixel, the GPS's
world coordinates to come back to (ints, as `PlayerGPS.WorldX` is), the
pit's depth under the sea when its entrance stands and it is more than
0.5 m, the template's region, location and pixel, the dungeon's name
("The Deadwater Chasm of the Last Tide": the name hash's adjective, noun
and ending) and the Recall binding it had - then moves the GPS to the
template's save position (the first of its pixel's four inner corners
4,096 units clear of the location's rect), names the GPS's location
"<name> [x,y]" under the abyss's own map id (`0x60000000 | pixel id &
0xfffff`) and takes the door: TransitionDungeonInterior with the template
cloned and renamed (CloneDungeon: its blocks array Clone()d) and no door.

While it builds (OnSetDungeon, `buildingAbyss`) the dungeon is FLOODED -
WaterizeDungeon: the level the higher of 2.5 m over the start marker and
a metre over the tallest mesh (never under 3 m over the start), in water
units, on every block, its water plane moved or added, the player's block
too - RENAMED (RenameDungeon: the summary's name and id, the location's
name and map table), and its enemies made the deep's (ProcessAbyssEnemies,
replacement allowed). On arrival (OnTransitionDungeonInterior) it is
Active and prepared again - PrepareAbyssDungeon: the flood, the name, the
GPS's name, the borrowed quest resources and the light fixtures gone, the
enemies processed with no replacement (the quota still kept) - and "You
descend into <name>." shows for 4 s. Every frame after (Update) the stale
context is released if the GPS left the template's pixel, a Recall is
reactivated, the binding refreshed, and once a second the names applied.

## The way up

OnTransitionDungeonExterior (a respawn clears the abyss instead): the
binding captured, the abyss no longer Active, "You rise from <name>." for
3 s, and the teleport back to the recorded world coordinates.
RestoreOceanPosition waits up to 600 frames for the world to stand there
and then two more, and stands the swimmer on the pit's entrance - the
capsule's bottom 0.25 m over the box - or, the entrance not up after 30
frames, at PlacementFraction's spot by the recorded depth; with neither,
0.1 m under the sea. A door that never opened (OnFailedTransition) goes
back the same way to the surface, and so does the port's own refusal
that raises no such event (the Port-Ledger row). A teleport or a door that
THROWS is a refusal too: the descent, the failed door's way back and the way
up each catch it, say it once and leave no descent or transition standing
(AUDIT PRE-MERGE 0928 H/S - the host drops those promises, and a throw had
left `entering` up for the session, which every load, fast travel and Recall
waits on).

## The Recall and the save

A Recall anchor set in the bound abyss - inside, at the GPS's world
coordinates - is bound to it (OceanHoleRecallBinding: the anchor and the
abyss's data). The binding stays while the anchor still matches
(MatchesRecallAnchor: `sqrMagnitude < 0.01f`, in floats - 4.1f is under
4.1) and is dropped once it does not and the abyss is not Active. A
Recall into the template's dungeon brings the abyss back
(ReactivateRecalledAbyss: the binding's data applied, PrepareAbyssDungeon
with replacement), and while the Recall lays that dungeon out, the loot it
rolls is the abyss's (IsPendingAbyssRecall): the port's `modes.dungeon()`
answers the location being laid out, as DFU's PlayerEnterExit.Dungeon
already does inside SetDungeon (PlayerEnterExit.cs:918-919).

IHasModSaveData: the record rides the save (GetSaveData refreshes the
binding first); a load inside the template's dungeon keeps the abyss and
prepares it twice - at once and a frame on (RefreshRestoredDungeon) - and
a load anywhere else, a respawn anywhere but the bound abyss, a new game
all clear it. The port's dungeon save carries the record now:
`scenes/worldModes.js` had never handed the host's two per-mod seams to
the dungeon's build (WA1's), so no registered mod's record rode a save
made underground.

MapsFile.GetLocation reads each caller its own DFLocation; the port's is
the maps cache's one object, so a dungeon build takes its own copy
(`ownDungeonLocation`: the name, the map table, the block records) - the
Recall's rename and flood on the template never reach the cache (before
it, the travel map would have named the template after the abyss).

## The abyss's contents (OH-E)

**The enemies.** A flame enemy (Fire Daedra, Fire Atronach, both
Dragonlings) is destroyed. Otherwise, with replacement allowed, an enemy
with a LoadID (a layout enemy's is its block's position plus its own), no
quest behind it, SetupDemoEnemy's, not one of the deep's roster, not the
Seducer, General (a class may be Guard), with a shadow and no glow is
replaced by the enemy hash (the pit's pixel XORed with the LoadID's two
words): a class (128-146) always, from the roster's undead, and marked
WasHumanoid; a monster one hash in three, by the third of it. (AUDIT DEX
C4: the class is the mod's own range, `EntityType == EnemyClass` AND an ID
of 128-146 - DEX1 had widened it to DFU's 128 bit, and the abyss took every
one of Daggerfall Enemy Expansion's classes, always; its classes, 384-398,
are monsters to this mod, as its IL reads.)
EnsureAquaticEnemyQuota wants `CeilToInt(living x 0.3f)` aquatic - in
floats: ten living want three, fifty want sixteen (50 x 0.3f is
15.000000953674316 as a float) - taken first from the enemies never humanoid, then from those
that were, each one of the roster's aquatic kinds off its whole hash. A
new enemy (GameManager.OnEnemySpawn) in the building or bound abyss is
processed the same, and the quota kept outside the build - never during a
load. Online, the abyss processes only the enemies this player runs: another
player's foe stood here (a copy of a shared rest encounter, a party member's or
a summoner's foe) is no spawn of this player's, and a room's foe while another
holds the seat is whoever runs it (AUDIT PRE-MERGE 0928 M1).

**The lights and the quest resources.** Every light is gone (the blocks'
light resources); every light-fixture flat (a torch, or the lights
archive's 7-13 and 22-27) is hidden and its sound stopped. The borrowed
dungeon's quest flats and quest foes are removed.

**The loot.** ShouldUpgradeLoot: the abyss building, bound, or a Recall
landing in it. LootTables.OnLootSpawned (a pile, after its trio - for
every key, as GenerateLoot raises it: the port had returned before it
outside J..O, which cost RRI's own pile wear those five dungeon types too)
and
EnemyEntity.OnLootSpawned (a foe, after its table, its kit and its trio)
are answered with AddBonusMagicLoot - while Dice100 succeeds at
`(int)chance`, one more random magic item at the back, the chance the
key's MI column halved in floats - then UpgradeLoot over the whole of
Items (the kit the port keeps off the droppable list included): a weapon
SetItem'd and ApplyWeaponMaterial'd one material up (Daedric stays), an
armour piece through NextArmorMaterial with its variant kept; SetItem is a
whole re-mint (one of a stack, flags 0), and an enchanted item takes back
its name, value, condition and flags. Quest items, artifacts and a custom
class's items are left.

**The presentation** (LateUpdate and SuppressAbyssLights, while the
player is in the bound abyss; everything restored otherwise): the water
fog's colour toward (0.012, 0.022, 0.026) - 85% of the way at the
darkness slider's midpoint, on to black at its top - and its density's
ceiling GetScaledSliderValue(intensity, 0.25); the dungeon's ambient
toward (0.05, 0.075, 0.11) the same way, the render ambient that times
DungeonAmbientLightScale; the sun's indirect light off, the Light spell's
candle at half its intensity and range, the player's torch put out.

## The audit (OH-F)

Three read-only lanes read the port against the assembly and DFU - the
tiles and the pit, the abyss's flow, its contents - and every finding was
checked on both sides before it was fixed. Eleven were real, and are
fixed:

- **The settings were read on outdoor frames alone** (lane A). LoadSettings
  is a callback DFU raises when the settings window closes, in any mode,
  so the abyss's two dials (the fog's intensity and darkness, which only
  matter inside it) never changed anything live. The host asks every
  frame now, above the modal gate (`checkSettings`).
- **The plume was culled by its pixel's ground box** (lane A). Unity culls
  the miasma by its particles' own bounds, up to 600 m over the sea; the
  pixel's box stopped at the sea, so a camera looking up at the plume lost
  it. The pit grows its pixel's box to the plume's reach (`miasmaReach`:
  the rise, a life's drift, the largest puff).
- **Indoors every terrain is inactive** (lane A). PlayerEnterExit's
  DisableAllParents turns the ExteriorParent off, so a queued pixel waits
  toward its 600-attempt timeout behind a door, and a settings change
  made inside finds no terrain to refresh (FindObjectsOfType finds active
  objects only) - and is not replayed on the way out. The queue runs
  indoors now, with every terrain inactive.
- **A reload of an abyss save stood the destroyed flame foes back up as
  lootable corpses, and ran the aquatic quota on the template's species**
  (lanes B and C). DFU's load stands the saved enemy set alone
  (SerializableStateManager.RestoreEnemyData) before the mod's
  RestoreSaveData reads it. The destroy rides the save now and is
  restored through removeFoe (no body, no loot); the restore's rebuilds
  are awaited before the mod loop runs.
- **A same-dungeon quickload kept the abyss's changes** (lane B). The abyss
  shares its template's dungeon key, and the port patches a same-dungeon
  load in place where DFU rebuilds on every load - the flooding, the
  rename, the destroyed lights stayed, and the way out landed nowhere. A
  load the abyss stands in (the live dungeon its own, or the save's
  record Active) is the world host's rebuild now.
- **The build window upgraded the street's loot** (lane B). DFU's build is
  one synchronous call and the exterior is off inside, so ShouldUpgradeLoot
  never meets another host's roll; the port's build awaits, and an
  encounter or a guard at the template's pixel could roll meanwhile. The
  loot events carry the host that rolled them, and only the dungeon's
  take the upgrade.
- **A world move during the descent raced the failure's teleport** (lane
  B). A load, a Recall or a quest teleport landing inside the build
  aborted the door, and the failure then teleported the swimmer back to
  the pit a frame later, over the other move. The descent is one world
  move now: the others wait for it, and a save refuses ("You cannot save
  now."). A respawn that takes the door keeps its own move.
- **Online, the abyss leaked into its template** (lanes B and C). A Recall
  into the bound abyss joined the dry template's room for one frame (the
  relay room is keyed by the renamed map id, which the Update renames -
  it runs before the online frame now); the hour's respawn stood a
  destroyed flame foe back up (it refuses one now); and a death or an
  online load woke the swimmer at the template's door, perhaps across the
  map - the pit is the drowned dungeon's door now.
- **A quest's foes were replaced** (lane C). DFU marks QuestSpawn before
  OnEnemySpawn is raised; the port bound the quest after the spawn, so a
  class foe was always rebuilt as an undead and its quest stalled on the
  retired body. The mark rides the build now.
- **A replaced summon came back hostile** (lane C). ApplyEnemySettings
  keeps AlliedToPlayer; the port's rebuild stood from a record without it.
  The alliance is set at the build now, before OnEnemySpawn, and a
  rebuild keeps it.
- **The quota walked the wrong order** (lane C). GetComponentsInChildren
  walks each block's Fixed Enemies node before its Random Enemies node
  (30 of the 187 RDB blocks put a random marker first); the quota stops
  once met, so the order decides who turns aquatic. The quota walks the
  hierarchy's order now (`enemyHierarchyOrder`); the pool keeps its own,
  which saves and rooms are keyed by.
- **A Wabbajack's creature was replaceable** (lane C). GameObjectHelper
  .CreateEnemy sets no LoadID, so the mod never replaces it; the port
  numbered every spawn. It stands with LoadID 0.
- **The upgraded armour drew the wrong picture** (lane C). UpgradeLoot
  carries `item.CurrentVariant` - SetVariant's clamp for the old material
  (a chain cuirass holds 4) - into the new material's clamp (iron: 3);
  the port carried the raw pick. It carries CurrentVariant now.

## What is kept bug for bug

- **Every weapon is upgraded, the arrow too.** UpgradeLoot's weapon arm
  is `item.GroupIndex != 131` - meant for the arrow, but 131 is the
  arrow's TEMPLATE index, and a group index counts within its group (the
  arrow's is 18, ItemHelper.GetGroupIndex): no weapon is turned away. A
  stack of arrows in the abyss's loot becomes ONE arrow of the next
  material, and ApplyWeaponMaterial's value lands on it (a stored field -
  `weaponOfMaterial` is the one mint that runs the material pass over an
  arrow; CreateWeapon's arrow arm never does).

## The port's own (Port-Ledger, the Ocean Holes row)

1. **The marker rides the recentre.** The C#'s OceanPitMarker holds the
   world X and Z it was built at, and DFU's FloatingOrigin moves the world
   under it, so after a recentre the decorations' exclusion and the pit's
   lookups point where the world was. The port keeps the marker
   pixel-local and reads it through the pixel's live translation.
2. **RefreshLoadedTile builds in its turn, at the front.** The mod's call
   builds the floor synchronously; the port's floors are the worker's, so
   the pixel goes to the front of the deferred queue and its
   OnSeafloorBuilt comes when the build lands.
3. **The miasma's light.** Standard's physically based lighting of a
   camera-facing quad is taken as the port's billboards take the day's
   light - ambient plus the sun's Lambert term toward the camera; with an
   albedo this dark (0.04, 0.005, 0.08) the emission (0.25, 0.02, 0.38) is
   nearly all of it. Unity's particle RNG is its own and unseeded; the
   puffs are Math.random's.
4. **The GPS move is a teleport.** DFU's PlayerGPS takes the template's
   coordinates without the world moving - the streamer is off while the
   player is underground - and the port's GPS is its streamer's pixel, so
   the world is stood at the template's save position before the door
   (and at the pit's coordinates after it, as the C# does). Inside, the
   GPS's coordinates are the pixel's corner - the frame the port's own
   Recall anchor takes there - not the save position.
5. **The exit's teleport waits a frame.** The port's exit is still
   unwinding when OnTransitionDungeonExterior is heard, and its teleport
   aborts a transition in hand; OnFailedTransition's waits a frame too.
6. **The replacements stand in their own time.** ApplyEnemySettings is
   immediate in DFU; the port rebuilds a replaced body (its sprites, its
   career), so the new type is recorded at once and every replaced body
   stood before the dungeon goes live (the build awaits it).
7. **A runtime spawn's LoadID is the context's own count.** DFU gives a
   spawned enemy DaggerfallUnity.NextUID; the port numbers them per
   dungeon, so a spawn's replacement pick is not DFU's.
8. **The failure path covers the port's own refusals.** The port's door
   can refuse where DFU's cannot (a mode already changed, the world moved
   under the build) without raising OnFailedTransition; TryEnterPit
   answers those as though it had been raised.
9. **The dungeon's Lights are its light resources.** DFU destroys every
   Light component under the dungeon; the port's dungeon lights are the
   blocks' RDB light resources, and those are what go.
10. **The torch and the candle are the frame's.** The mod writes the
    torch's GameObject and the candle's Light each frame; the port's
    dungeon frame leaves the torch out of its lights and scales the
    candle's range and colour. (DFU's EnablePlayerTorch sets the torch
    active every Update too - which of the two runs last is Unity's
    script order; the mod's intent, the torch out, is what is ported.)
    Online, the others' torches are left out too and their Light spells'
    candles scaled the same, as on their own screens (AUDIT PRE-MERGE 0928
    M4).
11. **The indirect light is already off.** The port's dungeons carry no
    sun bounce, so SuppressAbyssLights' zeroed IndirectLight is the
    port's state already.
12. **The descent is one world move.** DFU's TryEnterPit - the GPS move
    and TransitionDungeonInterior - is a single frame, so nothing can land
    inside it; the port's awaits, so the other world moves (a load, a
    Recall, a quest's teleport, a jail move) wait for it and a save
    refuses ("You cannot save now.", DFU's own cannotSaveNow). A respawn
    that takes the door from under it keeps its own move.
13. **A load the abyss stands in is a rebuild.** DFU rebuilds the dungeon
    on every load; the port patches a same-dungeon load in place, and
    refuses that patch where the abyss is involved (the live dungeon its
    own, or the save's record Active).
14. **The loot carries its host.** The port's build awaits and the street
    runs meanwhile, so ShouldUpgradeLoot answers only the dungeon's own
    rolls.
15. **The destroy rides the save, not the room.** The relay's door
    (`net/wire.js` validSharedFoe) has no field for it, and a field there
    is a relay deploy that drops every connected player; every client
    destroys the same flame foes on its own build, and the hour's respawn
    refuses a destroyed foe on each.
16. **Online, the pit is the abyss's door.** The port's online respawn
    wakes a dungeon death at the dungeon's door, and its online load
    wakes a dungeon save near it; for the abyss that door is the pit (the
    swimmer stood on its entrance, as the way up stands them), not the
    borrowed template's.
17. **The stream builds nothing indoors.** DFU's StreamingWorld goes on
    promoting terrains behind a door, where the mod's queue gives them up
    after 600 attempts; the port's stream builds them on the way out, so a
    pit DFU would give up behind a door (a load inside a building) is cut.
18. **The Wabbajack's original leaves the pool.** DFU deactivates it, and
    GetComponentsInChildren(true) still counts it living in the quota; the
    port's removeFoe drops it, so a quota after a Wabbajack can ask one
    fewer.
19. **The plume survives a building visit - recorded OPEN.** Unity's
    ParticleSystem with playOnAwake off may stop when a building visit
    deactivates the ExteriorParent and not resume until the pit is
    rebuilt; the port's plumes carry on. Engine behaviour these sources
    cannot show.
20. **A replaced body keeps its place in the room.** ApplyEnemySettings
    changes the enemy in place; the port rebuilds the body, and the room's
    word on it - a shared encounter's number, a summon's loose-stand mark
    and its lane's number - goes with the place, so every copy stands it
    anew as its new species (AUDIT PRE-MERGE 0928 M1). Still OPEN beside
    (15): a player who joins under another's seat without having destroyed
    a flame foe at its own build (a Recall into the abyss, a load's
    prepare) sees the runner's destroyed flame foe as a body - the stream
    can say only "dead", and a "destroyed, no body" word is a wire field and
    a relay deploy.

## Tests

`test/scenes/oh_abyss.test.js` (the abyss over a fake world: TryEnterPit's gates
and the data it writes, the build's flood / rename / enemies, the arrival,
the failed door and the port's refusal, the way up by the entrance, the
depth and the surface, the Recall binding and IsPendingAbyssRecall while
the dungeon is laid out, the respawner, the save and the load, Update's
names and releases, ProcessAbyssEnemy's gates and picks, the quota in
floats, OnEnemySpawn, the presentation; the loot pair against the mod's
own diagnostics case, the arrow, `weaponOfMaterial`, `lootMatrix`, and the
two loot events and their wiring), `test/world/oh_placement.test.js` (the pure law against the assembly: the hash,
the buckets, the placement, the fall, the cut's vertex pass, the grid, the
rays, the names and ids, the roster, the fixtures, the armour ladder, the
template, the flood, the disc, the puff, the miasma's particle system, the
midpoint colour) and `test/scenes/oh_host.test.js` (the tile host: the gates in
order, the waits, the bake's rejections, the depth, the state machine, the
suppression, the settings' re-cut, the entrance's once-a-second, the
dependency's half of the API, RefreshLoadedTile through the sea's own
host, the pit's programs taking their inputs where the buffers put them).
OH-F's: the indoor host, the settings above the gate, the plume's box
(`oh_host`); the save's destroy and settled restore, the rebuild on load,
the rolling host, the descent held, the pit as the online door, the
spawn's marks at the build, the hierarchy's order, the Wabbajack's LoadID,
CurrentVariant (`oh_abyss`). Mutants: `tools/mutants/oh.json`, 116, all
dead.

Seen in the world (a probe at Sentinel, three pixels north of Pallaton,
pixel 392,338): the pit built and flattened, the blue-black core on the
sea with the miasma rising over it, the same disc from under the surface,
and the black at the opening 186 m down. The first pass at the probe
drew nothing - its vertex inputs had no `layout(location)` and the
linker is free to order them; they are bound now, as the sea's own
programs bind theirs. (The probe's own lesson, for the next one: in `?shot`
fly mode the third-person lane's camera follows the unspawned player, not
`cam.pos`, so a fly-mode probe switches Eye of the Beholder off.)
