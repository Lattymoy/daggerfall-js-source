# World-Arc (ACTIVE)

Assemble Daggerfall's world from decoded data onto our WebGL2 stack.
Data math is ported 1:1 from DFU (MeshReader.cs geometry paths, RMBLayout.cs);
rendering is ours per Port-Doctrine.

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
clamp to exactly 0.017674 everywhere (pinned). Scene: ?terrain=<x>,<y>
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

1. Streaming world: floating-origin terrain streaming around the player,
   plus TerrainNature nature flats on wilderness pixels.

## Testing

Real-data pins live in `test/world.test.js`. Screenshot harness is manual
proof, not a suite gate (needs ARENA2 + chromium).
