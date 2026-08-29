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
edge-scaled strengths (bilinear corners). `src/render/terrainMesh.js` (DELETED at R9)
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
  records >= 56 reset to grass - DFU's tilemap index 8, i.e. texture
  record 2 (index = record * 4 + variant). Classic data never sets model scale (fields
  are mod-injection only) so scale is identity.
- `src/render/renderer.js` - WebGL2: REPEAT + NEAREST textures uploaded
  bottom-up as getColor32 emits them, alpha < 0.5 discard, directional light.
- `src/render/groundMesh.js` (DELETED at R10) - 16x16 tile quads at GroundOffset (-1), batched
  per record, rotate/flip as UV transforms. DFU uses a tilemap-shader atlas;
  per-tile quads are our renderer-side equivalent. Retired at R10: all ground - exterior blocks and terrain - now runs the verbatim tilemap shader inside renderer.js drawTerrain, and the Ledger A departure row went with the module.
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
(the mobile input arc). [RESOLVED same-day: the T3-touch addendum
below.]

### T3-touch addendum (2026-08-17): the phone interaction path

The touch layer already carried the E button (synthetic KeyE), so
talk worked on phones from T3b's merge in the default grab mode. The
addendum closes the two gaps: a MODE-CYCLE button on the bottom row
(hooks.cycleMode - the touch layer's hook precedent; the label shows
the LIVE mode) driving NextInteractionMode, verbatim: Steal > Grab >
Info > Talk > wrap; and E now says GOODBYE while the talk window is
open (townTalk.keydown routes KeyE as confirm - desktop-consistent,
one button opens and closes). Probe (tools/touchProbe.mjs, a
hasTouch context): the button row renders, taps cycle grab -> info
-> dialogue with the __talk hook confirming, and E opened + closed
the window live. The politeness idle needs the weapon SHEATHED -
the Z button (sheathe toggle) already ships on the touch row.

## G1 (2026-08-17): THE CITY WATCH - guards answer crime SHIPPED

The crime circuit closes: a caught pickpocket now brings the watch.
Guards are the FIRST exterior foes - Knight_CityWatch (146, texture
399, CLASS18.CFG) built with the C17 class recipe and driven by the
C11 stack (EnemyAI + EnemyAttack + MobileUnit) in BOTH exterior
hosts (scenes/cityGuards.js, one shared module):

- THE SPAWN LAW (PlayerEntity.SpawnCityGuards, verbatim): never in
  dungeons; at most 5 active; IMMEDIATE crime -> convert pool NPCs
  within 77.5 (wandering GUARDS first - classic disables the source
  NPC; then civilians BEHIND the player, angle >= 105.469, at 1/4
  each); nobody converted -> the foe-spawner ring (Random.Range(2,6)
  guards at 12.8..51.2). NON-IMMEDIATE: a witness within 77.5 facing
  the player (<= 95 deg) with LOS sees the crime - a seeing guard
  NPC converts on the spot; civilians-only start the 5-10s
  guardsArriveCountdown (re-fired as immediate).
- THE HOSTILITY LAW (EnemyMotor, verbatim - a GENERAL parity gain):
  GiveUpTimer joins EnemyAI - detection refills 200 classic ticks
  (~12.5s) and an undetected foe KEEPS pursuing until it drains;
  MakeEnemyHostileToAttacker pre-loads it (guards x3 = 600) so the
  watch marches on the crime scene before ever seeing the player.
  Probed: a ring guard walked 30+ units to the player, flipped
  detected, and entered StrikeRight. Dungeon foes inherit the same
  law (they used to stop the instant detection dropped). FLAGGED:
  blind pursuit aims at the LIVE position until target prediction
  (PredictedTargetPos) ships.
- COMBAT BOTH WAYS: the guard's -1 hit frame resolves
  CalculateAttackDamage vs the player (the C16 gate: 0.25/
  MeleeDistance + 35.156 deg) through the host's onPlayerHurt (the
  same entity the fall-damage path bills); the player's melee swings
  resolve via playerWeapon.resolveHit (reach + LOS + swing mods)
  with the C15 knockback on landed damage and the weapon-skill
  tally. Death drops the classic corpse (380/1). HALT: the barkSound
  (456) fires 3D at the detection rising edge.
- THE CRIME TRIGGER: townTalk's failed pickpocket calls the host's
  onCrime -> SpawnCityGuards(true) with the live person pool
  (facing yaws ride MobilePerson.facingYaw; conversion recycles the
  pool item). __crime/__guards probe hooks in both hosts.

DOCTRINE PROOF: the close-up crops the classic plate-armored watch
knight (399) mid-swing, battle axe in hand. Gates: 431/95, the
verbatim law pinned over real CLASS18.CFG (cityguards.test.js).

FLAGGED (LOUD): arrest/court pends (guards fight to the death);
guard archers forced melee (exterior foe arrows pend); assault
crimes pend (pickpocket is the only trigger); corpse loot pickup
pends the exterior activation seam; LowerRepForCrime + the crime
rep deltas pend the save-side faction clone; enemy-vs-enemy pends
(C15 residual); the player death screen in exteriors pends (health
hits 0 with no fanfare).

## G2 (2026-08-17): ARREST + COURT - the crime loop completes SHIPPED

Surrendering to a HALT now works end to end (systems/court.js
Node-pure + scenes/arrestFlow.js driving townTalk's overlay slot in
both hosts):

- THE INTERCEPTION (EnemyAttack verbatim): a guard's landed hit on
  an active crime WITHHOLDS the damage the first time -
  LowerRepForCrime charges the region's LegalRep and the surrender
  box (TEXT.RSC 15) opens; No lands the blow; later hits damage
  normally except a would-be-fatal hit forces
  SurrenderToCityGuards(false), which can refuse (rep < -20, or the
  DFRandom coin at neutral rep) and let the blow kill.
- SURRENDER (verbatim): SetHealth(1) BEFORE any refusal; voluntary
  always reaches court when not hard-refused.
- THE COURT (DaggerfallCourtWindow verbatim): punishmentType from
  two FailedRolls vs -rep (cap 75) and -rep/2; penalty = base +-
  perRep*rep clamped [min,max] /40; each unit flips a DFRandom coin
  (40 gold fine / 3 days); unpayable fines convert to days at
  40/day. Guilty halves both and PAYS; Not Guilty debates
  (Etiquette) or lies (Streetwise) at rep + (skill+PER)/2 clamp
  5..95 - free to go (8062) or guilty with the fine roll (x2 under
  25, halved over 75). THE NEVER-CHARGED VERDICT QUIRK preserved:
  DeductGoldAmount lives only in the guilty PLEA - a failed defense
  never pays its fine. Sentences raise rep by half the loss - 1
  (the classic double-raise kept, DFU-noted).
- THE STAND-DOWN (EnemyEntity verbatim): the watch DESPAWNS the
  frame the crime returns to None - court release, either verdict.
- PROBE PROOF (tools/arrestProbe.mjs): crime -> guard hit -> the
  box opened with hp UNTOUCHED (the withheld blow) -> Y set hp 1 and
  the court opened -> G pleaded guilty -> crime 0, LegalRep {17:-2},
  the guard despawned. SwiftShader lesson: the clamped dt runs the
  sim at ~1/3 speed - probes POSE into reach rather than wait out
  pursuit.

FLAGGED (LOUD): guild rescues pend the guilds arc; execution is
classic-unreachable; the prison day-skip is a no-op until the shared
calendar; banishment's SeverePunishmentFlags consequences pend;
FillVitalSigns is a floor-at-1 until vitals wiring; the People
faction rep half-delta pends the save-side clone.

## T3c (2026-08-17): WHERE IS - building names + directions SHIPPED

The talk window answers "Where is...?" in the test-city host:

- BUILDING NAMES (world/buildingNames.js): GenerateBuildingName
  verbatim - DFRandom.srand(seed), the B-then-A part draws in source
  order over the classic FALL.EXE name lists (committed as data,
  FULL extractions - a truncated first pull nearly shipped invented
  tavern tails, caught in-slice); %cn/%ef (one burned rand + the
  region-race male first name, DFU's always-Breton fix)/%rt (the
  province ruler's title); banks "The Bank of <region>", guild
  halls = the faction name, temples = the faction's first child,
  palaces TEXT.RSC 475/476/477, houses empty.
- THE NAMED-BUILDING POOL (systems/talkTopics.js, verbatim
  GetCompleteBuildingData): the location's exterior building list is
  a pool; scanning blocks y->x, each named-type block building draws
  the first unused pool entry OF ITS TYPE (nameSeed/factionId/
  quality); pool exhaustion keeps block placeholders (DFU logs the
  same). OUR WRINKLE: repeated block names share one parsed dfBlock
  (DFU's C# structs copy) - doors resolve to their block INSTANCE by
  position. Building positions ride their exterior doors.
- THE ANSWER: the 30-record answersToDirections table (15 doesn't-
  know + 15 knows x 5 social groups x 3 reaction tiers); the tier is
  GetReactionToPlayer_0_1_2 at the NEUTRAL tone (Personality/5 + 5
  vs an NPC-seed-stable 0..20 roll; the +20 band is DFU's lowering
  of classic's +30, doctrine-kept); the %hnt hint chain = a 7333
  variant with %loc = the building and %di = the verbatim 8-way
  compass bands over (east, north). Tier 0 commoners REFUSE rudely
  without the hint - verbatim attitude.
- UI: the greeting window gains "W - where is..." -> paged category
  list (8/page, N-more) -> buildings -> the answer window with "ask
  another". PROBED LIVE: 62 named buildings in Daggerfall city,
  "Doctor Rodynak's Herbs" under Alchemists, and a genuine tier-0
  answer ("Its none of yer damn business.").

FLAGGED (LOUD): the NPC knowledge roll pends (every NPC knows - the
doesn't-know half of the table is wired but unreached); the tone
buttons (Polite/Blunt) pend; the 35% map-reveal path SHIPPED at T4
(the discovery store pends only the map that will draw it); %hnr/%ra
SHIPPED at T4 off the entity; the STREAMING host's
per-pixel directory pends (a host-rule debt, the immediate
follow-up); the person-seed stands in for DFU's NPC hashcode
(Ledger A); identically-seeded repeats in pool-exhausted cities
mirror DFU's own fallback.

## T3d (2026-08-17): WHERE IS - the streaming-host mount SHIPPED

The recorded host-rule debt from T3c clears: the ?world host's talk
window carries the SAME Where-is directory as the fixed exterior
host. DFU's TalkManager builds its building list for
PlayerGPS.CurrentLocation - here a frame-loop tracker resolves the
player's LOCATION PIXEL (the built-pixel whose local frame contains
the camera) and swaps townTalk's topics on pixel crossing:
townTalk.setTopics() rebuilds the directory from the new pixel's
exterior buildings, layout blocks, and doors, or clears it over the
open wilderness (the talk window falls back to the plain greeting).

The frame law: doors and the player both resolve in the pixel's
LOCATION frame - door positions strip the pixel-local location
origin (now stored for EVERY location pixel, not just populated
ones), and playerPos() subtracts the live floating-origin
translation plus that origin. The floating origin is a pure
translation, so the compass answers survive recenters - pinned
(whereIsAnswer invariant under a uniform shift of both frames).
Directory names ride the pixel's OWN region (bank names, the name
bank, the province ruler via topics.regionIndex); the People
faction/greetings stay on the boot region until travel lands (the
recorded cross-region flag).

FOUND ON THE WAY: buildingDoors leaked on destroyPixel - doors
accumulated across every pixel rebuild (duplicate E-targets,
unbounded growth on long streams; the directory's per-building
dedup had been masking it). They splice out with their pixel now.

Probed live on ?world&play at Daggerfall city: 62 named buildings
in the streaming directory - the SAME 62 the fixed exterior host
reports, identical alchemist names ("Vintage Elixirs" / "The
Emperor's Potions" / "Mordard's Spices") proving the location-frame
conversion lines up; E -> W -> Alchemists -> a tier-0 refusal
answer record on screen.

Suite 440/97; the T3c "streaming host directory pends" flag clears.

## G3 (2026-08-17): CORPSE LOOT - killed guards drop their gear SHIPPED

The exterior hosts' first loot seam, on the dungeon's S2 pickup
shape: cityGuards gains lootTargets() (killed guards with items ->
E-ray AABB targets, feet to +0.6) and takeLoot() (transfer via
addItem into the player entity, 'You take N items.', the corpse
billboard stays as dungeon corpses do). Both hosts slot it into the
verbatim PlayerActivate nearest-hit order: townsperson -> guard
corpse -> building door. Only a KILLED guard (the new corpse flag,
set in the real death path) is lootable - stand-down walk-aways
vanish with their items; a corpse survives the crime clear, as DFU
loot containers do.

THE PARITY FIND: guard corpses came up EMPTY because
Knight_CityWatch has NO LootTableKey in DFU (verified against
EnemyBasics.cs - the table roll is legitimately empty). The
droppable loot is the EQUIPMENT: DFU's AssignEnemyStartingEquipment
adds every equipped piece to enemyEntity.Items after each EquipItem.
Ported as equipmentItems() (the shield rides its armorPieces armor
item, never the leftHand marker; a leftHand weapon is its own item)
- and the SAME gap was live in the dungeon: class-foe corpses had
dropped only table loot, never their equipment, since E4b. Both
spawn sites feed entity.items now.

Probed live: kill a guard through the real death path, E on the
corpse - "Longsword + 5 armor pieces" into the player entity, a
second E takes nothing.

Suite 442/97 (the walk-away/kill/take-once pin + the Items.AddItem
mirror pin). FLAGGED: loot pickup as an inventory WINDOW (take-all
is the interim, as the dungeon's), murder/assault crimes for
killing the watch pend the crime-table wiring.

## T3e (2026-08-17): THE KNOWLEDGE ROLL - NPCs can not know SHIPPED

The last recorded Where-is interim clears: GetNPCKnowledgeAboutItem
verbatim. The roll is seeded by NPC hash + buildingKey (the
per-person talk seed stands in for the hash, Ledger A), so the SAME
NPC always gives the same answer about the SAME building;
rollToBeat = knowledgeModifiers[questionIndex*5 + socialGroup] + 10
(the 40-entry FALL.EXE table as data; local building questionIndex
0, Commoners -> 15of20 = 75% know), random_range_inclusive(1,20) <=
rollToBeat KNOWS. A doesn't-know NPC draws the FIRST 15
answersToDirections records, a knowing one the LAST 15 - the
doesn't-know half of the table, wired since T3c, is REACHABLE now.
buildingKey is BuildingDirectory.MakeBuildingKey verbatim
((x<<16)+(y<<8)+record, key 0 -> the 1<<24 sentinel), stamped on
every directory entry by the pool merge. The DFU-only
short-circuits (same-building statics, spymaster, the
NPCsKnowEverything debug toggle) don't apply to street mobiles and
are documented, not ported.

Pinned: rollToBeat 15, MakeBuildingKey incl. the sentinel,
hand-reproduced seeded rolls, seed-stability, both halves reachable
over 200 seeds, whereIsAnswer drawing the matching half. The
whereIs probe re-ran green (a knowing commoner: "Vintage Elixirs is
south of here").

Suite 443/97. Remaining Where-is residuals: tone buttons
(Polite/Blunt), the 35% map-reveal, %hnr/%ra interim literals.

## T3f (2026-08-17): TONE BUTTONS - Polite/Normal/Blunt SHIPPED

GetReactionToPlayer_0_1_2 lands in FULL (the neutral-tone T3c shape
becomes a thin wrapper): reaction = Personality/5 +
questionTypeReactionMods[qIndex] + the tone modifier, banded against
the NPC-seeded 0..20 roll (+20 tier width, DFU's lowering of
classic's +30). The tone modifier is the verbatim pair of tables -
etiquetteReactionMods [-10,5,10,15,-15] / streetwiseReactionMods
[10,5,-10,-15,15] by social group (sgroup >= 5 folds to Merchants) -
plus the Dice100 skill roll: a FAILED Etiquette/Streetwise check
lands -10, a passed one +5. Session laws verbatim: each tone's
reaction value (skill roll included) computes ONCE per talk session
(toneReactionForTalkSession) and a revisit re-uses the cache; the
skill tallies on the FIRST use of its tone per session; the tier
recomputes only when the tone CHANGED since the last question
(GetAnswerText's lastToneIndex gate). The tone selection persists
across sessions, as DFU's window selection does.

UI: our keyed-window idiom folds DFU's three tone buttons into one
T key cycling Polite > Normal > Blunt with a live label on the
greeting and answer windows (the window re-shows through
showOverlay so the chain law holds).

Probed live: T cycles Normal -> Blunt on screen, the Blunt re-ask
answers with reaction 30 cached in the session slot ("Beggin' yer
pardon Sir, ... Vintage Elixirs is southwest of where we're
standing").

Suite 444/97. Residuals recorded: the 35% map-reveal, %hnr/%ra
interim literals, murder/assault crimes (the board's next).

## G4 (2026-08-17): MURDER + ASSAULT - the crime table's teeth SHIPPED

The crime loop's last open edge closes (WeaponManager's mobile-NPC
branch + DaggerfallEntityBehaviour.HandleAttackFromSource, verbatim):

- A weapon strike on a wandering CIVILIAN kills in ONE hit (the
  motor disables - no health roll, no damage formula), levies
  Crimes.Murder and fires SpawnCityGuards(true) through the host's
  crime response. TallyCrimeGuildRequirements(false, 5) FLAGGED to
  the thieves-guild arc; DFU's blood splash pends a blood system.
- A strike on a wandering GUARD NPC levies Crimes.Assault and
  converts the NPC to a live Knight_CityWatch foe ON THE SPOT
  (SpawnCityGuard at its position/facing, source disabled) - and
  the SWING CARRIES onto the fresh foe exactly as DFU re-points the
  hit, rolling to-hit/damage against the new entity.
- Killing a spawned guard foe (any path through damageGuard) levies
  Crimes.Murder (HandleAttackFromSource's Knight_CityWatch branch;
  TallyCrimeGuildRequirements(false, 1) FLAGGED).
- The strike resolution: nearest pool person under the look ray
  (the townTalk person cylinder) within WEAPON_REACH (2.25 + 0.25),
  occlusion by the world collider; the hosts try guards first, then
  townsfolk, in both exterior hosts (the host rule).

Probed live (tools/murderProbe.mjs via the new __attack hook over
ClickToAttack): unsheathe, four re-posed swings - the fourth
connects, the civilian vanishes, crime = 5, and TWO watch guards
spawn and march in.

Suite 445/97 (the G4 pin: one-hit murder + response, out-of-reach
and walled no-crimes, the assault conversion with the carried
swing, murder on the real death path).

## AUDIT 2026-08-17b: the towns/talk parity pass

The T1 modules were re-read line by line against MobilePersonMotor /
PopulationManager / CityNavigation (they had been built from working
digests). Six real findings, fixed with pins - the full record lives
in Home.md's Audits section: the self-target place() + nav rederive
(a pre-seek idle resume marched to the origin), the N/S/E-only best
scan (DFU's Range(0,3) quirk, now preserved), the tick-reset law (at
most one pool tick per frame), the rect+62.5 spawn range gate (far
pixels park at pool 0), RandomiseNPC re-rolling at EVERY spawn with
the 1/32 GUARD branch (guards spawn now; hosts re-point batch.archive
and resolve frameCount by the live archive), and the UI pause (the
population freezes under the talk overlay). T2's "far pools park at
1" note is superseded: they park at 0 under the range gate. Suite
428/94; townProbe + worldTownProbe + talkProbe re-run green (the
caught-pickpocket path witnessed live).

Suite 420/92. ARENA2 green, probes green.

## AUDIT 2026-08-17c: the guards/court/where-is parity pass

The G1/G2/T3c stretch (plus the touch seam) re-read line by line
against PlayerEntity.SpawnCityGuards / EnemyAttack /
DaggerfallCourtWindow / TalkManager.GetBuildingList. Five real
findings, fixed with pins - the full record lives in Home.md's
Audits section: the pool merge bounded by SubRecords.Length (garbage
header entries stole pool draws - three identical alchemists became
three distinct names live), the overlay callback cleared BEFORE
firing + all chains routed through showOverlay (a court verdict
callback could re-fire on a later window), the Dodging tally on
every resolved enemy attack (missing since C8, both hosts), the
seen-by-guard MASS conversion (DFU converts every REMAINING pool
NPC once any guard sees - the `if (seenByGuard)` sits outside the
range/LOS gate), and the court %pcn/%cri/%pen macro expansion (the
records rendered raw on screen; %pcn's appositive collapses while
the player is nameless pre-chargen - chargen wiring FLAGGED).
Verbatim re-confirmed clean: the court math line by line (plea
rolls, thresholds, the never-charged verdict quirk, execution
unreachable), the fatal-blow interception, the spawn constants and
order, %ef/%rt semantics, the palace dot-trim, the GiveUpTimer
cadence. Suite 439/97; whereIsProbe + arrestProbe re-run green
(distinct names; the full surrender -> court -> prison -> release
circuit with expanded text).

## T4 (2026-08-19): THE 35% MAP-REVEAL + the %hnr/%ra literals SHIPPED

The Where-is residuals the T3f close recorded - the last two live
clauses on T3c's flag list - both off the queue. Suite green with
ARENA2 set and unset; the fork boundary, the inside gate and the
discovery no-dupe all mutation-checked (three planted mutants caught).

- **The %hnt fork** (talkTopics.buildingHint):
  GetKeySubjectBuildingHint (TalkManager.cs:1707-1723) verbatim - the
  answer record's %hnt resolves to the 7333 directional hint OR the
  7332 map reveal; DFU tests `randomFloat > ChanceToRevealLocationOnMap`
  for the DIRECTION arm, so a roll landing exactly ON 0.35 still
  reveals (pinned - a >= mutant fails), and IsPlayerInside forces
  directions whatever the roll. ChanceToRevealLocationOnMap = 0.35f
  (TalkManager.cs:123 - DFU's own comment: "Chances unknown"). The
  draw is UnityEngine.Random.Range(0f, 1f): per THE ENGINE-PRNG RULE
  (Ledger A) it rides the seam's injectable rolls, pinned for
  distribution, never sequence.
- **The mark** (systems/discovery.js): %loc's handler
  (MacroHelper.cs:1085-1090) is where DFU performs the reveal -
  PlayerGPS.DiscoverBuilding (:917-975), ported as ONE module-level
  store (the worldTick one-clock precedent): locationId ->
  buildingKey -> the DiscoveredBuilding columns this port has sources
  for ({ buildingKey, displayName, factionId, quality, buildingType }
  of PlayerGPS.cs:92-103; the quest name-override arms,
  UndiscoverBuilding and lastLockpickAttempt pend quests/automap).
  Already-discovered is a no-op (:926-928). DFU namespaces locations
  by MapPixelID (:936); the talk seam carries no pixel yet, so the id
  is `region:location` - the automap arc swaps it when there is a map
  to draw. The store rides the save envelope (snapshotPlayer/
  restorePlayer - DFU serialises discoveredLocations in SaveData_v1);
  a pre-T4 save restores empty, and the snapshot is a copy, not an
  alias (both pinned).
- **The townTalk seam** (answerText): the fork runs ONLY when the
  answer record carries %hnt - lazily, the %oth idiom - because the
  roll lives inside the macro in DFU: a tier-0 refusal never rolls
  and never marks the map. The reveal arm expands a 7332 variant
  (%loc = the building; the ARENA2 gate pins all 7 variants naming
  %loc on the map and none carrying %di) and calls discoverBuilding;
  the direction arm is the T3c 7333 chain unchanged. The mobile-talk
  hosts are the two exteriors, so isInside is false at this seam;
  interiors join with static-NPC talk (in flight in a parallel lane).
- **%hnr/%ra** (talkSession.honorificOf / raceDisplayName): %hnr is
  TalkManager.GetHonoric (:1826-1832) - Sir / Ma'am by player gender
  (Internal_Strings 414/415, read from the DFU repo's own string
  table); %ra is MacroHelper.PlayerRace (:942-945), the BIRTH race
  template's display Name - the table pinned whole against the
  Internal_Strings literals, the elves in TWO words (Dark Elf, High
  Elf, Wood Elf). expandAnswerRecord's defaults re-derive through the
  same laws (the pre-chargen entity's values); the live path passes
  the entity's gender/race. The T3c "interim literals" flag is
  retired, its sentence deleted, its Home list row removed.

PROBED LIVE (tools/mapRevealProbe.mjs - the whereIsProbe flow asking
repeatedly, ?class=16 booting past the chargen wizard): ask 0 drew
the compass arm ("Vintage Elixirs is a ways south of here"), ask 1
the REVEAL - "its right there (points to Vintage Elixirs your map)",
7332 variant 6 with classic's own missing "on" - and the prior
15-ask diagnostic run drew 7 reveals / 8 directions, sitting on the
0.35. Three container truths the runs surfaced, fixed in the probe:
the tree is heavy enough under SwiftShader that the lone pooled
townsperson parks on the politeness idle beside a static camera
(moves = 0 forever - a standing interlocutor answers Where-is the
same, so the probe stopped demanding a walker); ?play without
?class=N now lands in the U-wave chargen wizard, which owns the
overlay; and __talk's answer window reports { text, kind }, not a
string.

Pins: test/mapReveal.test.js x6 (the boundary/inside fork, the store's
whole-record/no-dupe/per-location laws, the envelope round trip incl.
pre-T4 empty, the macro tables, the townTalk source sweep - the hosts'
zero-execution-coverage idiom - and the ARENA2 record-id gate).

## P2 (2026-08-20): DROPPED-PILE MAP TAIL - piles die with their pixel, ride the save SHIPPED

AUDIT 23 items-2, closed with its premise CORRECTED by the source.
The row said exterior piles should SURVIVE pixel unloads; the
reference says the opposite. StreamingWorld.CollectLooseObjects
(:1040-1052) DESTROYS a loose container whose pixel leaves the
streamed range - GameObject and LooseObjectDesc both - and nothing
mid-session brings it back: only the SAVE's serialized loot
containers re-mint it. The port had the inverse bug twice over:
world piles were IMMORTAL (droppedLoot knew nothing of pixels, so a
pile stood forever at local coordinates that went stale) and the
F9/F11 world envelope never carried them (a quicksave dropped every
pile on the floor of the load).

- **The pixel stamp** (droppedLoot.dropPile pixelKey):
  TrackLooseObject (:465-476) stores worldCompensation + the map
  pixel pair AT TRACK TIME; the port's equivalent is the third
  dropPile argument - both world-host drop sites stamp
  `${playerTravelPixel().x},${playerTravelPixel().y}`. Hosts
  without pixels (the dungeon) pass nothing and stay outside the
  sweep.
- **The collection sweep** (droppedLoot.collectPixel): the world
  host's pixel teardown calls collectPixel(key) beside its other
  per-pixel frees - every pile stamped with that pixel dies, batch
  destroyed, entry spliced (EVERY ALLOCATION HAS AN OWNER). A pile
  dies WITH its pixel, exactly the reference's mid-session law.
- **The save halves** (snapshotWorld/restoreWorld): the F9 world
  envelope grew `piles` - NATIVE coordinates through
  state.worldCoords (the recenter-proof law the player half rides),
  y compensated, empties skipped, record + pixelKey + item copies
  carried (LootContainerData_v1's trio). F11 re-mints after the
  player lands through state.localFromWorld + the compensation
  offset, with the SAVED record - a restore must not reroll the
  icon. restorePiles (the dungeon's applyWorld half from
  save-load-4) stands untouched beside them.

Mutations: 4 run, 4 killed. m2 (restoreWorld rerolls the record)
SURVIVED the first round - the round-trip pin's fixed `pick: () => 3`
made a reroll reproduce the same record - so the pin was
strengthened (a mutable pick poisoned to a different index before
the restore call), proven green on clean code, and m2 re-run to a
kill. A PIN MUST FAIL, enforced the hard way.

Pins: test/droppedloot.test.js +3 (the pixel sweep incl. the
pixel-less exemption and the freed batches; the native round trip
under a moved origin + y shift with empties skipped and the record
unrerolled under a poisoned roll seam; the world-host wiring sweep -
collect at teardown, stamps at both drop sites, both envelope
halves).

## TV (2026-08-20): TRAVEL-MAP DUNGEON VISIBILITY - hidden means hidden SHIPPED

The row G8 opened, closed the same night. DFU's travel map draws
and finds a location only when checkLocationDiscovered passes
(DaggerfallTravelMapWindow.cs:1121-1131): the BAKED MapTable
Discovered flag OR the runtime discoveredLocations store - ONE
uniform test, no type distinction, because the DATA carries it
(MAPS.BSA ships towns discovered and hidden dungeons not).
CanFindPlace (:1135-1147) runs the same test for the find box,
which is exactly what the port's typeahead is - so the filter
landed there: an undiscovered dungeon's name simply does not match
until something reveals it (a guild promotion, an entry on foot).

The write half: entering a location's pixel discovers it
(PlayerGPS.DiscoverCurrentLocation on the location-rect entry) -
wired at the world host's pixel-crossing tracker, so foot entries
and fast-travel arrivals ride ONE writer. The index rows grew
mapId + the baked flag, read off the map TABLE.

RESIDUE: quest reveals ride the quest machine; the standalone
?exterior dev host has no streaming tracker and skips the writer.

Mutations: 3 run, 3 killed (the filter dropped; the entry writer
dropped; every row claiming baked-discovered).

Pins: test/travelvisibility.test.js x2 (the hidden barrow absent
from matches until discoverLocation learns it, the baked town
findable from the first key; the law-inputs/writer source sweep).

## DE1 - ENTERING A DUNGEON PUT THE PLAYER ACROSS IT (2026-08-29)

Mac: *"when entering a dungeon, it places you at the end of the dungeon
instead of the entrance."*

**There are two DFU members here and they do not agree.**

`TransitionDungeonInterior` (`PlayerEnterExit.cs:895-963`) is **walking
in through the entrance** - `PlayerActivate.cs:645`, which is how a
player actually gets into a dungeon. It uses `dungeon.StartMarker`
**unconditionally**, never consults the enter marker, and where the
start marker is missing it **aborts the transition** (`:923-929`)
rather than placing the player at an invented point. It then faces the
player along the normal of the nearest dungeon exit door.

`StartDungeonInterior` (`:968-1016`) is **starting inside** a dungeon
with no exterior - a new game, a load, a respawn, a quest teleport. The
**enter marker** wins, `StartMarker` is the fallback, and the facing is
plain north (`SetFacing(Vector3.forward)`).

The port had ONE `enterMarker ?? startMarker` serving both. So the
walk-in took the enter marker: a different point, in a large starting
block a long way from the door the player had just opened.

**And the sentence standing over it was true.** It explained the
enter-marker preference as a fix for a wedging bug in Privateer's Hold,
and it was one - *for the standalone host*, which is the
`StartDungeonInterior` case and is right to prefer it. Applying that
host's answer to the other member is what put the player across the
dungeon. This is not a stale claim like FS1's four; it is a correct
claim that was **generalised past its member**.

Both halves are now the two members they always were, and the caller
says which it is:

- `startSpawn({ preferEnterMarker })` - `true` prefers the enter marker
  with the start marker as fallback; `false` is the start marker **or
  nothing**. `false` is not "prefer the other one": the transition has
  no fallback, so a missing start marker returns null and
  `tryEnterDungeon` answers false. The player stays outside, standing
  at the door, which is what DFU's destroyed dungeon and
  `OnFailedTransition` amount to.
- `entryFacingYaw(feet, { preferEnterMarker })` - north for the start,
  the nearest exit door's normal for the transition. `closestDoorTo` is
  `DaggerfallStaticDoors.FindClosestDoorToPlayer` (`:249-277`) verbatim,
  in `player/enterExit.js` with the rest of the door geometry.

The default is `preferEnterMarker: true`, matching
`StartDungeonInterior`'s own signature default - but
**`tryEnterDungeon`'s default is `false`**, because the overwhelmingly
common way into a dungeon is through its door. `startInDungeon` (a new
game) passes `true`; the standalone `?dungeon` host keeps the default,
because it is `StartDungeonInterior` by definition.

Pins: 7 in `test/dungeonentry.test.js`. Campaign: 19 mutants, 19
killed, including the bug itself restored as one mutant - and after one
survivor that was the fixture's fault, not the code's: the pin for
`closestDoorTo` measuring in **three** dimensions used doors that a
ground-plane measure ranks the same way. It takes a door on the
player's own level against a nearer one far below now, which is the
case a dungeon actually produces.

A third pin went red on the way through - `classicstart.test.js`'s U31,
which anchored on the literal `tryEnterDungeon(hit, entries)`. Its law
(start-inside must REUSE the door path so `dungeonReturn` is recorded)
was untouched; re-anchored on the call, plus a new assertion that the
call is the start-inside member.

### DE2: the same two members level the PITCH, and DE1 shipped only the yaw (2026-08-29)

Pulling the thread on DE1 - the first thing asked for after it - found
the half of its own fix that was missing.

`SetFacing(Vector3 forward)` is `LookRotation(forward).eulerAngles` fed
to `SetFacing(yaw, pitch)` (`PlayerMouseLook.cs:286-291`). Every vector
the dungeon members pass is **horizontal** - `Vector3.forward` for the
start, a door normal for the transition - so the pitch it computes is
0, and both members level the view. The exit says it in its own name:
`PositionPlayerToDungeonExit` ends on
`SetHorizontalFacing(foundDoorNormal)`, which is `SetFacing(yaw, 0f)`
(`:294-299`).

DE1 set `cam.yaw` and left `cam.pitch` alone. So walking into a dungeon
while looking up at the sky kept you craning at the ceiling, and coming
back out while looking at your feet put you outside still looking at
them.

Three things bound the fix, each a mutant:

- **The entry levels only when it faces.** `TransitionDungeonInterior`
  calls `SetFacing` inside its found-a-door branch, so a dungeon with
  no exit door to read leaves the player's bearing *and* pitch alone.
  The pitch sits inside the same guard as the yaw.
- **Buildings still do not face at all.** Neither `TransitionInterior`
  nor `BuildingTransitionExteriorLogic` touches `PlayerMouseLook` - a
  shop door leaves your view exactly as it was - and the port matches.
  Checked rather than assumed, and pinned so it stays that way.
- **The standalone host was already right.** `scenes/dungeon.js` builds
  its camera as `{ yaw: 0, pitch: 0 }`, which *is*
  `SetFacing(Vector3.forward)`. It needs no arm, and the pin stops
  someone adding one.

Campaign: 7 mutants, 7 killed. The harness gained an **anchor-uniqueness
check** (`src.count(old) != 1` fails the mutant outright) - LM1 had just
lost a mutant to an ambiguous anchor silently mutating another function,
and the check costs one line.

One pin went red on the way: DE1's own, an hour old, anchored on the
`if (_yaw !== null) cam.yaw = _yaw;` one-liner that became a block. Its
law - the host asks for the facing of the member it *is*, and applies
it - was untouched. Re-anchored, per F041.
