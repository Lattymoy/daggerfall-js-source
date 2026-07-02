# World-Arc (ACTIVE)

Assemble Daggerfall's world from decoded data onto our WebGL2 stack.
Data math is ported 1:1 from DFU (MeshReader.cs geometry paths, RMBLayout.cs);
rendering is ours per Port-Doctrine.

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

1. Flats/billboards: RMB flat records + ground scenery as camera-facing quads
   (SCALE_DIVISOR 256, blockFlatsOffsetY -6).
2. Building interiors (subrecord Interior sections + door metadata from
   MeshReader's ModelDoor extraction, archives 74/56/331/156/95 - required by
   the Player arc for entry).
3. RDB dungeon layout (RDBLayout.cs) with action records.
4. Terrain: WOODS.WLD heightmap reader + streaming world.

## Testing

Real-data pins live in `test/world.test.js`. Screenshot harness is manual
proof, not a suite gate (needs ARENA2 + chromium).
