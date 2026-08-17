# World-Arc (ACTIVE)

Assemble Daggerfall's world from decoded data onto our WebGL2 stack.
Data math is ported 1:1 from DFU (MeshReader.cs geometry paths, RMBLayout.cs);
rendering is ours per Port-Doctrine.

## Milestone 9 - floating-origin streaming world (SHIPPED)

`src/world/streamingWorld.js` carries StreamingWorld + FloatingOrigin
semantics as pure state (the scene owns assets). Verbatim: TerrainDistance
3 (7x7 desired grid, IsInRange |delta| <= distance, beyond collected);
world coordinates via SceneMapRatio 40 and the truncating
WorldCoordToMapPixel / MapPixelToWorldCoords pair - DFU accumulates
worldX/worldZ incrementally with lastPlayerPos compensated per recenter,
our closed form (originPixelCorner + (scenePos - compensation) * 40) is
the same mapping without drift, documented in-file; FloatingOrigin
recenters on pixel change by (-dPixelX * 819.2, 0, +dPixelY * 819.2)
applied to world AND player, vertical recenter past +/-500 with
yChange = -y; compensation accumulates and placement is
(pixel - mapOrigin) * (819.2, -819.2) + compensation. Load lists are
nearest-first (player pixel, then rings); unloads re-report until the
scene releases them. Teleports spanning multiple pixels resolve in one
update (closed-form pixel derivation). Renderer grew per-batch world
origins (uOrigin), retained buffer handles, and destroyMesh /
destroyBatch for pixel recycling. ?world is now the streaming scene:
pixels build asynchronously nearest-first (player pixel synchronous,
InitPlayerTerrain-style), locations appear on their pixels via a
boot-time pixel -> location index (one location per pixel, pinned),
everything stored pixel-local and placed per frame under the current
compensation. tools/screenshot.mjs gained SHOT_TIMEOUT and SHOT_EVAL
(post-ready action + stream-idle wait) for flight shots. Floating-origin
invariant pinned: after any number of crossings the current pixel's
frame sits at the origin and native coordinates round-trip exactly.
Pins in test/streaming.test.js.
AUDIT NOTE (M9 audit): re-diffed against StreamingWorld.cs +
FloatingOrigin.cs - two corrections landed: init now PRESERVES the
vertical compensation across re-inits (verbatim ResetStreamingWorld
zeroes only x/z), and the closed-form trunc(w / 32768) is documented as
equal to DFU's cast-then-divide (both truncate toward zero). A
2000-step fuzz (wander / multi-pixel teleports / vertical spikes) holds
five invariants per step: post-recenter |y| <= 500, the current pixel
frame at the origin, the camera inside the pixel frame, exact native
round-trips, and the loaded set exactly the 7x7. A live Playwright
flight probe (test-harness/stream-flight-probe.mjs) round-trips a
4-crossing path: built count returns to exactly 49 (GPU destroy /
release cycle verified live), zero page errors. Perf note: under
SwiftShader the 49-pixel scene renders at seconds per frame (software
raster; the desktop-GPU target is unaffected) - live-frame probes must
frame-sync on the shot-mode __frame counter rather than sleep.

## Milestone 8 - nature flats on terrain (SHIPPED)

DEFECT FIX (post-ship, caught by Mac): every billboard rendered
vertically flipped since M2. The billboard shader mapped the quad top to
v = 0 (0.5 - aCorner.y) while getColor32 textures upload bottom-up
(v = 0 = image bottom); the mesh path was always correct via its
negated-V + REPEAT convention. Fix: vUV.y = aCorner.y + 0.5. Verified
with close-up before/after crops: nature trees root at the ground,
city skyline canopies point up, the street lamp head sits atop its
pole; dungeon tapestries were unaffected (archive 74 meshes, not
flats). LESSON: the M8 orientation "verification" compared
display-flipped art against a distant screenshot and passed a flipped
render - sprite-orientation checks must be close-up crops against the
raw record art.

`src/world/terrainNature.js` ports DefaultTerrainNature.LayoutNature:
location rects (when present) expand by natureClearance 4 and exclude
scatter (Rect.Contains min-inclusive / max-exclusive); elevationScale =
clamp(rawWoodsByte / 128, 0.4, 1.0), Desert climates quarter every
chance; per tile - skip above 50 degrees steepness, roll against
dirt 0.2 / grass 0.9 / stone 0.05 (scaled), other records never scatter,
skip below the beach line (corner height x maxTerrainHeight, unscaled);
placed flats sit at (x * 6.4, height - steepness / 70, y * 6.4) with
record in [1, 32) - batch billboards anchor centre-bottom, matching our
base-anchored renderer batches. makeTerrainKey is the verbatim signed
((short)y << 16) + (short)x. umRandom gains the verbatim NextInt
((state * range) >> 32 + min). DEPARTURE (extends the Ledger A
engine-internal-randomness row): DFU seeds UnityEngine.Random - closed
engine code - so we seed our byte-exact Unity.Mathematics port with the
same terrain key; deterministic per pixel, same statistics, different
concrete positions. Presentation substitutions documented in-file:
steepness from central-difference gradients of the scaled heightfield;
SampleHeight reduces to the exact corner sample (DFU's sample point
lands on integer sample coordinates by construction). ?world scatters
nature per pixel on post-blend heights + final tilemap, batched
world-framed per (natureArchive, record). Integration pins: city pixel
(207,213) 1237 flats (rect-suppressed), wilderness (206,213) 5331 -
44013 across the 3x3. Pins in test/terrain.test.js.

## Milestone 7 - locations on terrain (SHIPPED)

`src/formats/umRandom.js` is a 1:1 translation of Unity.Mathematics
Random (MIT, open source - NOT a departure): CreateFromIndex(i) seeds
with WangHash(i + 62), the constructor burns one NextState, xorshift
13/17/5 returns the PRE-update state, NextFloat is the
asfloat(0x3f800000 | state >> 9) - 1 bit trick. Pinned.
`src/world/terrainTiles.js` ports DefaultTerrainTexturing +
TerrainHelper's location paths: generateTileData classifies the 129x129
corner grid (water at/below ocean; beach dirt at/below beach +/- a
byte-exact umRandom jitter in [-1.5, 1.5); else a lat/long perlin weight,
seed 417028, 3 octaves 0.05/0.9/0.4 clamped [-1, 1] - < 0.5 dirt,
> 0.95 stone, else grass; lat = mx*128 + x, long = 64000 - my*128 + y).
assignTiles runs marching squares (shape from 4 corner LSBs | ring << 4
into the 64-entry lookup; MakeLookup = record 0-55 + 64 rotate + 128
flip, exactly the RMB tile bitfield layout; non-zero cells skipped).
setLocationTiles stamps every RMB ground tile at the centred origin
(getLocationTerrainTileOrigin - 8x8 -> (0,0), CUST 1x1 -> (72,55));
GroundTiles read [x][15 - y] as everywhere; records >= 56 skipped; zero
bitfields stored as the 0xFF sentinel; bounds + clearance (3 TownCity,
else 2) become the locationRect. calcAvgMaxHeight + blendLocationTerrain
flatten the rect to the pixel average and lerp the blend space by
edge-scaled strengths (bilinear corners). `src/render/terrainMesh.js`
drapes 128x128 tile quads over the heightfield (byte decode
record = b & 63 / rotate 64 / flip 128, 0xFF -> record 0), the
renderer-side equivalent of DFU's tilemap shader.
Scene: ?world (&region=&loc=, default Daggerfall/Daggerfall) - job order
verbatim (samples -> stamp + blend on the location pixel -> tile
classification POST-blend -> march), 3x3 pixels, per-pixel climate via
getClimateIndex + getWorldClimateSettings, location origin at
(tilePos * 6.4, avg * worldHeight + 2.0 * GlobalScale, tilePos * 6.4).
QUIRK (Ledger B): StreamingWorld creates city blocks with
addGroundPlane = FALSE - the stamped terrain tilemap IS the ground;
marker cells (>= 56) stay unstamped and take generated tiles.
Integration pins for pixel (207,213): avg 0.166147 / max 0.171953, rect
{11,116,11,116}, 9989 stamped, post-blend s(64,64) = avg with corners
untouched, post-assign histogram 2:8173 / 1:3142 / 46:1706 / 11:899,
climate 231 -> ground 302. Pins in test/terrain.test.js.
AUDIT NOTE (M7 audit): the 64-entry marching-squares lookup was
machine-verified against a source-parsed reconstruction - identical
64/64. All 15251 exterior locations in the game stamp + blend clean
(0 failures, 0 NaN heights); corpus invariants pinned: every clearance
rect stays interior to the pixel ([11, 116] game-wide, so the blend's
edge divisors are always finite) and no map pixel carries more than one
location. Stamped tile total 9565908. Two documented equivalences:
calcAvgMaxHeight seeds max with 0 instead of float.MinValue (samples are
clamp01 >= 0), and the location Y uses the average height directly where
DFU samples the terrain at 0.55 * hDim inside the flattened rect (equal
by construction).

## Milestone 6 - terrain: WOODS.WLD + height sampling (SHIPPED)

`src/formats/woodsFile.js` ports WoodsFile.cs 1:1: header gate
(Width * Height must be 500000), 500000 per-pixel data offsets, the raw
1000x500 small heightmap, the verbatim `>= dim - 1` clamps, 5x5 large map
data at offset + 22, and GetLargeHeightMapValuesRange's interior-3x3 strip
with inverted sample Y AND descending source map Y. Corpus pins: header
closure (offsets fill 144..2000144 exactly, heightmap at 2001168), buffer
sum 11699810 / max 255 / 20237 zeros, Daggerfall environs raw height 20.
`src/world/terrainSampler.js` ports DefaultTerrainSampler +
TerrainHelper.CubicInterpolator/GetNoise: 129x129 samples per map pixel,
bicubic base (4x4 small window at mx-2,my-2, rows Y-inverted, x8) +
bicubic feature noise (9x9 large window at mx-1,my, x4) + Perlin ground
detail (x10), ocean floor 27.2, clamp01(h / 1539); sample(x,y) at
data[x*dim+y] matching DFU's job indexing. World scale verbatim: 819.2
units per pixel, height x1539x1.5, pixel (X,Y) at (xdif, 0, -ydif) * size.
DEPARTURE pending Mac review (Port-Ledger A): DFU's noise source is
Unity's engine-internal Mathf.PerlinNoise; `src/world/perlin.js` stands in
with Ken Perlin's reference improved noise remapped to [0,1] - same role,
different concrete samples, all pins pin OUR pipeline. Open-ocean pixels
clamp to exactly 0.017674 everywhere (pinned). Scene: ?terrain=<x>,<y> (RETIRED in Rendering-Arc R9 - the streaming world owns terrain)
(default 207,213) renders a 5x5 pixel neighborhood on an elevation ramp;
ground TEXTURING (tilemap), locations-on-terrain, and streaming remain
queued. Pins in test/terrain.test.js.

## Milestone 5 - RDB dungeons + action records (SHIPPED)

`src/world/rdbLayout.js` ports RDBLayout.cs 1:1: model matrix is
T * Rz * Rx * Ry (NOT the RMB TRS order - ledgered); exit doors (70300)
only in the starting block; action doors are DOR/DDR/NEW/CAV refs (red
brick 72100 exempt) placed closed with the 16-entry starting-lock table;
static doors accumulate per model; flats at (X, -Y, Z) * scale with editor
199 as data-only markers (record 10 start - carrying water level
-8 * soundIndex else 10000 and castleBlock = magnitude != 0 - record 8
enter) and fixed-treasure 216 hidden; lights as point data (radius * scale).
AUDIT NOTE (M6 audit): the RDB flat position is the billboard CENTER -
DFU's AddFlat performs no AlignToBase, unlike the RMB and interior paths.
Scene batches shift down half the scaled height for our base-anchored
billboards. All 4232 dungeons in the game lay out clean (40263 block
instances); RemoveOverlappingDoors fires on real seams (4968 doors
disabled across 2072 dungeons); every dungeon resolves a start marker;
2163 unique texture tables; lock decode never exceeds the 16-entry table
(raw sweep max 240 -> nibble 15 -> 0xff). Action records port AddAction verbatim: enum-defined
flag/trigger guards, translation vectors negating x/z, rotation vectors /
RotationDivisor, PositiveX..NegativeZ flag cases (duration 50, magnitude
axisRaw * 8), LID/WHE rotation overrides, the TRP raw-axis-13 hack, and
the flat-action axis = magnitude quirk; links key on obj.position and
resolve next/prev. `src/world/dungeonTextures.js` +
`src/formats/dfRandom.js` port the classic texture table (LCG pinned
against K&R rand; Privateer's Hold seed 50050 + Woodlands ->
[23,22,19,22,20,368]); UVs keep original-archive sizes while pixels come
from the remapped archive, verbatim SetDungeonTextures order.
`src/world/dungeonLayout.js` ports DaggerfallDungeon: blocks at
(X, 0, Z) * RDBSide (51.2), start/enter markers from the starting block,
RemoveOverlappingDoors (exit-centre seed in dungeon-root space without the
block origin - benign, start block sits at 0,0 - then 1.4-tolerance
disable in block order). Corpus: all 187 RDBs lay out clean; placements
20487 + action doors 2475 = 22962 models and flats 7720 + markers 4518 =
12238 close EXACTLY against the Readers-Arc resource pins; 4268 lights,
195 static doors, 5843 links, 32 wet blocks, 5 castle blocks. Scene:
?dungeon=<name> (&region=), camera at the start marker. Routed onward:
enemies (Characters), treasure/loot (Systems), water plane + point lights
(Rendering), torch/animal audio (Audio), door/action behavior (Player).
Pins in test/dungeon.test.js.

## Milestone 4 - building interiors + doors (SHIPPED)

ModelDoor extraction runs inside meshReader's vertex pass, verbatim DFU
LoadVertices: door archives 74 (building), 56 (dungeon enter), 331 (ruin
enter, record 0 is plain stone and skipped), 95 (dungeon exit); archives
> 100 reduce to base (archive - trunc(archive/100)*100) for the check except
331/156 (156 only exempts the reduction, never a door itself); each plane of
a door submesh is one door, Index resets per submesh; Normal =
normalize(cross(v0-v2, v0-v1)). Corpus pins: 1999 doors on 1398 of the 10251
models (1712 building / 285 dungeon-enter / 2 exit).
`src/world/staticDoors.js` ports GameObjectHelper.GetStaticDoors 1:1
(size from the v0/v2 diagonal, thickness = max(width, depth), centre/normal
kept in model space with the placement matrix riding along).

`src/world/interiorLayout.js` ports DaggerfallInterior's geometry paths:
AddModels (prop type 3 keeps +Y unnegated then anchors to the model's lowest
vertex Y; IsBadInteriorModel's 27-block repair table filters misplaced model
31000), AddFlats (editor archive 199 kept as markers, hidden from render
exactly as DFU spawns-then-hides; INTERIOR_MARKER enum Rest 4 / Enter 8 /
Treasure 19 / LadderBottom 21 / LadderTop 22), AddActionDoors (model
9000 + DoorModelIndex % 5, placed closed, openRotation carried for the
Player arc). Static door triggers accumulate from every placed model.
Corpus: all 6832 building interiors across 920 RMBs lay out clean - 226208
placements, 11449 static doors, 39940 rendered flats, exactly 60 model-31000
instances filtered (one per flagged block/record combo). Scene:
`?interior=<BLOCK>:<record>` (e.g. MAGEAA00.RMB:0), camera at the Enter
marker facing the interior bounding center; `SHOT_QUERY` drives the shot
tool at any scene. Routed onward: people flats (Characters), furniture
actions / loot / spawn points (Systems), point lights (Rendering), ladder +
door behavior (Player). Pins in test/interior.test.js.

## Milestone 3 - flats and billboards (SHIPPED)

Every RMB flat path from RMBLayout, verbatim: misc block flats (lights
billboards included; point-light components later), exterior subrecord flats
with the UNROTATED (subX, 0, -subZ) offset DFU uses, editor archive 199
skipped, nature-range archives (500-511) swapped to the climate nature
archive - including DFU's `billboardPosition.z = natureFlatsOffsetY` raw -2
assignment, a suspected upstream y/z typo kept verbatim for parity (no
visible artifact in Daggerfall city; revisit against DFU side-by-side).
Ground scenery reads [x][15-y], records < 1 skipped. Billboard size =
(size + trunc(size * scale / 256)) * GlobalScale, bottom-anchored
(AlignToBase = +h/2). Renderer: cylindrical (Y-locked) billboards expanded
in the vertex shader along camera right, batched per (archive, record).
Daggerfall city: 897 flats in 80 batches - street lanterns, shop signs,
trees, shrubs. `src/world/rmbFlats.js`, `src/render/renderer.js` billboard
path. NPC faction metadata and animal sounds queued with their systems.

## Milestone 2 - full location render (SHIPPED)

Complete exteriors assembled from MAPS location data: block grid resolved via
checkName(getRmbBlockName(x, y)), block (x, y) placed at (x * RMBSide, 0,
y * RMBSide) with RMBSide 102.4, no row inversion - verbatim
DaggerfallLocation.LayoutLocation. Ground archive driven by the location
climate (Daggerfall city -> Woodlands 302). Scene selectable with
?region=&loc=. Daggerfall city: 64 blocks, 1109 placements, 202 unique
meshes, 181 textures, meshes and textures shared across blocks, per-block
ground meshes, origin folded into each placement matrix.
`src/world/locationLayout.js`, pins in test/world.test.js.

## Milestone 1 - single RMB block render (SHIPPED)

MAGEAA00.RMB assembled and rendered from original data: BLOCKS placement ->
ARCH3D geometry -> TEXTURE archives via ART_PAL. 20 placements, 7 unique
meshes, 35 textures. Proven by headless screenshot (`npm run shot`).

Modules:
- `src/world/mat4.js` - column-major mat4; TRS matches Unity
  Matrix4x4.TRS/Quaternion.Euler (R = Ry * Rx * Rz, degrees), parent * child.
- `src/world/meshReader.js` - DFMesh -> GPU buffers. Verbatim: GlobalScale
  0.025, position (X, -Y, Z) * scale, normal normalize(NX, -NY, NZ),
  uv (U/texW, -(V/texH)) relying on REPEAT wrap, fan indices
  [shared, vc+1, vc].
- `src/world/rmbLayout.js` - verbatim placement: subrecord
  T(XPos, 0, 4096 - ZPos) * R(0, -YRot/5.6889, 0); building model =
  subrecordMatrix * TRS((X, -Y, Z), euler(-rot)/div); misc models with
  propsOffsetY -4 and Z + 4096; ground tiles GroundTiles[x][15 - y] with
  records >= 56 reset to grass 8. Classic data never sets model scale (fields
  are mod-injection only) so scale is identity.
- `src/render/renderer.js` - WebGL2: REPEAT + NEAREST textures uploaded
  bottom-up as getColor32 emits them, alpha < 0.5 discard, directional light.
- `src/render/groundMesh.js` - 16x16 tile quads at GroundOffset (-1), batched
  per record, rotate/flip as UV transforms. DFU uses a tilemap-shader atlas;
  per-tile quads are our renderer-side equivalent.
- `src/main.js` - loads /arena2/* (dev-only vite middleware in
  vite.config.js; data never bundled), assembles the block, fly camera
  (click to lock, WASD + mouse, Shift speed), ?shot fixed vantage.
- `tools/screenshot.mjs` - in-process vite + Playwright chromium
  (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers, playwright@1.56.0 pinned to the
  provisioned chromium-1194). Waits for window.__shotReady.

Numeric anchors (test/world.test.js): model 456 p0 (-9.6, 0, 12.8),
uv0 (0, -2), fan [0,2,1,0,3,2]; MAGEAA00 model 0 world origin (48.2, 0, 25.4)
via T(48, 0, 25.6) * Ry(-270deg).

## Queue (in order, one at a time)

EMPTY - the World-Arc build queue is complete. Remaining world-adjacent
work lives with its owning arcs (Rendering: terrain materials, climate
swaps, sky; Player: movement, collision, activation; Audio: ambient).

## Testing

Real-data pins live in `test/world.test.js`. Screenshot harness is manual
proof, not a suite gate (needs ARENA2 + chromium).

## T1 (2026-08-17): TOWNS - the wandering population SHIPPED

The towns arc opens (Mac's lead handoff; the World arc hosts it -
the exterior scene owns the system). DFU's PopulationManager /
CityNavigation / MobilePersonMotor / MobilePersonBillboard, verbatim:

- THE NAVGRID (world/cityNavigation.js): per RMB block the 64x64
  AutoMapData carves walkable cells (nonzero = covered - a tree flat
  blocks its cell, verbatim raw bytes), weights from the ground
  tilemap (water 0 / stone 4 / dirt 6 / grass 12 / road 15 /
  default 7, each tile spanning 4x4 cells), stored weight<<4 with
  the low nibble as the Occupied flag. A cell is 64 classic units =
  1.6 world units. THE COORDINATE PROOF: the RMB row axis inverts vs
  world z exactly as the rendered tilemap's srcTiles[tx][15-ty] read
  - the navgrid applies the same per-block flip, and Daggerfall city
  grids out at 198k walkable cells / 35k road cells with townsfolk
  probed WALKING ON STREETS.
- THE MOTOR (characters/mobilePerson.js): SeekingTile with the
  verbatim weights walk (2.5% random shuffle, forced change on
  0-weight/blocked targets, the 80% downgrade-leave that makes
  mobiles FOLLOW ROADS), 1.3 u/s marches to cell centers, occupancy
  handoff, seekCount for the pool's recycle rule; THE POLITENESS
  IDLE, verbatim: a person stops (record 5; guards 15) only when the
  player stands still within 2.5 with the weapon SHEATHED, visible,
  and no enemies near - PROBED LIVE (the closeup subject flipped to
  idle facing the camera). The billboard rides the monster wheel
  (records 0-4 mirrored, 4 fps move / 1 fps idle).
- THE POOL (systems/townPopulation.js): max = clamp(blocks/16,1,4) *
  24 (Daggerfall city: 96); one spawn per 10Hz tick on the navgrid
  within 96 cells; recycle past 150 units, after 4 failed seeks, or
  at NIGHT; pop-in/out allowed only beyond 120 units or outside the
  180-degree view; a spawn stays HIDDEN until its first completed
  tile move (anti-skate). Race/gender/variant from the verbatim
  texture tables (Redguard/Nord/Breton x male/female x 4 + guard
  399); the region race is Breton (FLAGGED: the climate People
  table pends - correct for the test city).
- RENDER: C11-style live batches per person (record#frame uploads,
  the flats' billboard axis - the doctrine). DOCTRINE PROOF: the
  probed townsman (386) crops IDENTICAL to raw 386/5 (teal tunic,
  pear pouch, green boots). tools/townProbe.mjs is the standing
  probe (frame-synced; a stale-pose lesson joined the process:
  walk-mode hosts must move the PLAYER, not the camera, in __pose).
- PROBE FINDINGS fixed en route: getBlockAutoMap returns {data} not
  the array (the all-covered navgrid); RDB_SIDE vs RMB_SIDE (the
  half-scale grid clustered spawns in-view and nothing could pop
  in).

Residuals (LOUD): talk/activation pends dialog; guards pend the
crime system (the table ships); the streaming world (?world) mounts
in T2; interior population unchanged (C1).

## T2 (2026-08-17): TOWNS - the streaming-world mount SHIPPED

The T1 systems ride the floating-origin host (the standing host
rule: every scene-side seam ships in every motor host). world.js:

- PER-LOCATION POOLS: every built location pixel carries its own
  CityNavigation + TownPopulation (DFU attaches both to each
  streamed DaggerfallLocation). THE LOCATION-TYPE GATE, verbatim
  from StreamingWorld: populations only for TownCity 0 / TownHamlet
  1 / TownVillage 2 / HomeFarms 3 / ReligionTemple 5 / Tavern 6 /
  HomeWealthy 8 (mapTableData.locationType) - graveyards, shrines,
  dungeons and covens stay empty.
- THE FRAME CONTRACT: persons live in the LOCATION frame -
  horizontal from the location origin (locLocal = terrain tile
  origin), vertical pixel-local; groundY is the flattened location
  terrain (blendLocationTerrain planes the rect to avg - the same
  base the RMB flats sit on). The frame loop converts the player
  INTO each pixel's location frame (cam - pixelTranslation -
  locOrigin) for the pool, and converts live persons OUT through
  the same translation for the draw - recenters are free. The
  _clear raycast wraps the world collider with the same shift.
- LIFECYCLE: person batches are per-pixel and destroyed with the
  pixel (destroyPixel); far location pixels keep their pools but
  spawns fail off-grid (pool parks at 1 free item) and distance
  recycling drains them - PROBED: Daggerfall 96/96 pool with
  act/vis climbing while Copperfield Manor/Ripwych/Burgcester sat
  parked at 1.
- PROBE PROOF (tools/worldTownProbe.mjs): walkers spawn around the
  posed player at Daggerfall city center (spawnTest green at nav
  256,256), complete tile moves, and the POLITENESS IDLE fired on
  the fly-cam close-up - archive 456 crops IDENTICAL to raw 456/5
  (the doctrine: blonde Breton townswoman, white blouse, checkered
  apron, blue skirt, red shoes) grounded on the street.
- THE PROBE-HOOK ORDER LESSON (joins the process): the mode
  machine's installShotProbes() defines an interior __people hook -
  a host's town probe surface must install AFTER the mode machine
  or the interior hook wins and reads null in exterior mode (the
  town __people read null/[] for 300s while __townDebug thrived;
  exterior.js had the same ordering silently right). __pose in walk
  mode moves the PLAYER here too (the T1 lesson, host parity).

Residuals (LOUD): unchanged from T1 (talk/dialog, guards/crime,
climate People race table); night-time streets empty by law
(daytime-only townsfolk); the pool ticks for every built location
pixel (up to ~4 with populations in range) - idle cost is one
failed spawn probe per tick per far pixel, negligible.

## T3a (2026-08-17): TALK - the faction foundation SHIPPED

The talk arc opens under the townsfolk. The data + rules layer,
Node-pure (the window UI and the scene activation wiring are T3b):

- FACTION.TXT (formats/factionFile.js): FactionFile.cs verbatim -
  '#'-headed blocks, tag:value with the original file's one
  malformed space-split tag, parent/child by preceding-TAB depth
  stack, duplicate-id resolver from 980 (never fires on vanilla
  data - the real file is exactly 366 unique factions), region
  1-based -> 0-based, flats archive<<7|record (one flat fills both
  gender slots, the second is female), ruler name seed + power
  bonus drawn in classic DFRandom call order (stream-position
  dependent in DFU too), relinkChildren building the tree. Enums:
  FactionTypes/SocialGroups (11)/GuildGroups.
- THE REACTION LAYER (systems/talk.js): findFactions with the -1
  wildcards (PersistentFactionData verbatim; region compares the
  parser's 0-based value - DFU's misleadingly named
  oneBasedRegionIndex parameter receives 0-based too);
  getPeopleOfCurrentRegion = the region's single People/Commoners/
  GeneralPopulace faction (every mobile townsperson talks as it -
  People of Daggerfall for region 17, proven child of the
  Daggerfall province); getReactionToPlayer = rep + biography mod
  + live-effect reactionMods[sgroup] + sGroupReputations[sgroup]
  (all zero at chargen; ensureReactionState folds the fields onto
  the entity).
- PICKPOCKET (talk.js + formulas.js): the verbatim chance (live
  Pickpocket skill, +5*(playerLevel-targetLevel) vs enemies only,
  clamp 5..95), tally on every attempt, success splitting
  Dice100(33): 67% pinch Random.Range(0,6)+1 gold onto the
  Currency stack, 33% "found nothing valuable" (TEXT.RSC 8999 -
  the caller supplies the text source); failure lands
  crimeCommitted='Pickpocketing' verbatim. Constants: mobile/static
  NPC activation 256 units = 6.4, pickpocket 128 = 3.2.

FLAGGED (LOUD): guard spawning on the failed pickpocket pends the
crime slice (the crime STATE lands now); TallyCrimeGuildRequirements
pends the guilds arc; enemy pickpocketing pends the same wiring;
biographyReactionMod is 0 until chargen's biography quiz ships; rep
deltas (quests/crimes) pend the save-side faction clone - the live
FactionFile dict IS the state until then.

T3b next: the talk window (TALK01I0.IMG shell, greetings by
reaction, Where-is building directions) + the scene activation modes
(Steal/Grab/Info/Talk) raycasting mobile persons in all three
exterior-capable hosts.

## T3b (2026-08-17): TALK - the talk window + activation SHIPPED

Townsfolk can be talked to and pickpocketed, live in BOTH exterior
motor hosts (the standing host rule; one shared seam module):

- THE SESSION (systems/talkSession.js): mobile townsfolk all talk
  as the region's People faction whose parent is a PROVINCE - so
  DFU's guild-greeting branch never runs for them and the greeting
  is purely the reaction ladder, verbatim: < -20 refuses via
  TEXT.RSC 7205 (the -20 EDGE still talks); >= 30 -> 7209, >= 10 ->
  7208, >= 0 -> 7207, else 7206. One random variant expands the
  greeting-set macros: %pcf (first name token) and %oth (an oath,
  TEXT.RSC 201 + FactionRace - DFU's deliberate fix of the classic
  region-race oath bug; the oath variant is drawn only when the
  greeting carries %oth). Unknown macros pass through LOUD (the
  full MacroHelper pends).
- THE SEAM (scenes/townTalk.js, shared): interaction modes on the
  classic F1-F4 (Steal/Grab/Info/Talk, default GRAB, "Interaction
  is now in %s mode.", no-op on the same mode); the activation ray
  vs the person's controller cylinder (radius 0.45, height 1.8) at
  the verbatim distances (mobile NPC 6.4; pickpocket 3.2 with "You
  are too far away" beyond); Info/Grab/Talk all talk a mobile NPC
  (DFU routing); Steal pickpockets ONCE per person
  (PickpocketByPlayerAttempted). Lazily loads FACTION.TXT +
  TEXT.RSC + FONT0003 through the host's fetchBytes. The refusal is
  a HUD line; a font-less boot never traps the motor.
- THE HOSTS: exterior.js + world.js each mount the seam: keydown
  eats mode keys and overlay Esc/Enter BEFORE the movement set; the
  E-use edge gives a person under the ray priority over building
  doors (the PlayerActivate nearest order); the talk overlay holds
  the motor (the U3 seam); townTalk.frame draws HUD lines + the
  panel last. THIS IS THE HOSTS' FIRST HUD-TEXT LAYER - the weapon
  rig's say() lines (C9's console flag) now land on screen.
  surfacePlayer() at boot (the probe surface).
- UI (ui/talkWindow.js): the U-arc text panel (the rest window's
  shape - TALK01I0.IMG art pends the shared background note) with
  greedy word-wrap; Esc/Enter = goodbye.
- PROBE PROOF (tools/talkProbe.mjs): live in the test city - E on a
  politeness-idled townsman opened the panel reading "Yes?" (a real
  7207 variant through the real TEXT.RSC); Esc + F1 flipped to
  steal mode ("Interaction is now in steal mode."); E pickpocketed:
  the HUD read "You pinched 1 gold piece." (the SINGULAR form -
  the 67% gold path with Random 1). The probe lesson: Playwright
  press() falls between rAFs - hold keys across frame-synced waits
  (keyboard.down + N frames + up).

FLAGGED (LOUD): topics (Where-is/Tell-me-about), tones, the
portrait, and TALK01I0.IMG all pend T3c; guards on the failed
pickpocket pend crime; the streaming host's People faction rides
the START region until travel wiring; touch has no mode keys yet
(the mobile input arc).

Suite 420/92. ARENA2 green, probes green.
