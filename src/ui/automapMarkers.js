// ROAD-C c2/S7: THE AUTOMAP'S BEACONS AND MARKER MESHES - SetupBeacons
// (Automap.cs:1344-1460) as procedural meshReader-shaped models that
// ride the EXISTING draw path.
//
// NO NEW RENDERER ENTRY POINT, and that is the whole design. DFU builds
// its beacons out of Unity primitives with Standard materials; the port
// builds the same primitives as `{positions, normals, uvs, indices,
// subMeshes}` bundles whose sub-meshes name 1x1 SOLID textures in the
// `amap` archive, so `renderer.createMesh` / `drawMesh` / `destroyMesh`
// carry every one of them exactly as they carry a dungeon wall - the
// idiom the shipped window already used for its billboard markers
// (automapWindow.js's `_ensureMarkers`). The colour is the texture.
//
// BEACONS ARE OPAQUE. Three of the four materials carry an alpha
// (0.5 red, 0.5 blue, 0.75 green) and Unity's opaque Standard shader
// IGNORES IT - the `SetMaterialTransparency` helper that would have
// honoured it is commented out at every call site (:1287-1296, :1371,
// :1387, :1427). The alphas are transcribed below because they are what
// the C# says, and the draw uses the RGB alone because that is what the
// C# DOES.
//
// BEACONS ARE NEVER SLICED, DIMMED OR GRAYED. DFU injects the slicing
// shader into the duplicated GEOMETRY only (:1906); the beacons live
// under `gameobjectBeacons` with plain Standard materials, so slicing
// below your feet must not erase your own position marker. The window
// lifts `clipY` and drops `automapMode` to OFF before this group.
//
// THE NESTED SCALE IS REAL AND IS NOT A BUG. The two rotation arrows are
// CHILDREN of the pivot cylinder, whose localScale is (0.15, 50.2,
// 0.15) - so their own (0.15, 0.0005, 0.15) is MULTIPLIED by it and
// their world size is (0.0225, 0.02510, 0.0225), and their local offsets
// of +/-2 land at +/-0.3 world units from the axis. A port that composed
// the arrows in world space would put two enormous arrows four units
// out. Every transform here is composed parent-first for that reason.
//
// DEPARTURE, rowed in the Ledger: THE CURVED ARROW IS PROCEDURAL.
// DFU's rotation indicator is `Resources.Load("RotateArrow")`, a Unity
// prefab over `Assets/Resources/RotateArrows.obj` - a 576-vertex model
// authored for Daggerfall Unity that is NOT Daggerfall game data and
// cannot come through the port's data door. The port draws a flat
// curved arrow of its own at DFU's exact transform, colour and parent.
// It is the same read at the same size (a ~0.03-unit decal beside the
// pivot axis); what is lost is the authored silhouette.

import { MARKER_NAMES } from '../systems/automapPick.js';
import { trs, multiply } from '../world/mat4.js';

/** The `amap` texture records these models name. One 1x1 solid each -
 *  the beacon's material colour, as a texture. */
export const MARKER_TEX = Object.freeze({
  PLAYER: 'beaconPlayer',
  PIVOT: 'beaconPivot',
  ENTRANCE: 'beaconEntrance',
});

/**
 * The four material colours, VERBATIM including the alphas Unity's
 * opaque Standard material then throws away.
 */
export const BEACON_COLOURS = Object.freeze({
  player: Object.freeze([1.0, 0.0, 0.0, 0.5]),      // :1372
  pivot: Object.freeze([0.0, 0.0, 1.0, 0.5]),       // :1388
  entranceRay: Object.freeze([0.0, 1.0, 0.0, 0.75]),// :1428
  entranceCube: Object.freeze([0.0, 1.0, 0.0, 1.0]),// :1437 - `new Color(r,g,b)` is alpha 1
});

/** The three 1x1 textures, as packed ABGR (uploadTexture's colour32
 *  word order - the same packing buildMicroMap writes). The ray and the
 *  cube share one: (0,1,0) either way, once the alpha is dropped. */
export const MARKER_TEXELS = Object.freeze({
  [MARKER_TEX.PLAYER]: 0xff0000ff,
  [MARKER_TEX.PIVOT]: 0xffff0000,
  [MARKER_TEX.ENTRANCE]: 0xff00ff00,
});

/** localScale, transcribed. */
export const BEACON_SCALES = Object.freeze({
  player: Object.freeze([0.3, 50.0, 0.3]),        // :1370
  pivot: Object.freeze([0.15, 50.2, 0.15]),       // :1386
  rotateArrow: Object.freeze([0.15, 0.0005, 0.15]),// :1399, :1409
  entranceRay: Object.freeze([0.3, 50.0, 0.3]),   // :1426
  entranceCube: Object.freeze([0.8, 0.8, 0.8]),   // :1440
});

/** The two rotation arrows' LOCAL offsets under the pivot axis
 *  (:1398, :1408) and the second one's 180-degree turn (:1410). */
export const ROTATE_ARROW_LOCAL = Object.freeze([
  Object.freeze({ pos: Object.freeze([2.0, -0.02, -2.0]), yawDeg: 0 }),
  Object.freeze({ pos: Object.freeze([-2.0, -0.02, 2.0]), yawDeg: 180 }),
]);

/**
 * `rayPlayerPosOffset` / `rayEntrancePosOffset` (:235-236). BOTH ARE
 * ZERO in shipping DFU: the two lines above them (:233-234) are the
 * commented-out (-0.1, 0, +0.1) / (0.1, 0, +0.1) that the comment
 * ("small offset to prevent the ray ... being exactly in the same
 * position as the rotation pivot axis") still describes. The comment
 * outlived the values; the values are what run.
 */
export const RAY_PLAYER_POS_OFFSET = Object.freeze([0, 0, 0]);
export const RAY_ENTRANCE_POS_OFFSET = Object.freeze([0, 0, 0]);

// ── the primitive models ─────────────────────────────────────────────
//
// WINDING is the port's one convention: right-handed counter-clockwise
// seen from OUTSIDE. `mirrorProjectionX` flips screen handedness and the
// renderer answers with `frontFace(CW)`, so a CCW-outward model is
// front-facing - which is also what `meshReader`'s reversed fan
// (`[shared, vc+1, vc]`, :166-172) produces out of Daggerfall's
// left-handed plane data.

/** Unity's Cylinder primitive: radius 0.5, height 2, centred on the
 *  origin. `sides` is the port's own tessellation and is the only free
 *  number here - Unity's mesh uses 20, so this does. */
export function buildCylinderModel(textureRecord, sides = 20) {
  const positions = [], normals = [], uvs = [], indices = [];
  const push = (x, y, z, nx, ny, nz) => {
    positions.push(x, y, z); normals.push(nx, ny, nz); uvs.push(0.5, 0.5);
    return positions.length / 3 - 1;
  };
  const bot = [], top = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
    bot.push(push(cx, -1, cz, Math.cos(a), 0, Math.sin(a)));
    top.push(push(cx, 1, cz, Math.cos(a), 0, Math.sin(a)));
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(bot[i], top[j], bot[j], bot[i], top[i], top[j]);
  }
  const capTop = [], capBot = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
    capTop.push(push(cx, 1, cz, 0, 1, 0));
    capBot.push(push(cx, -1, cz, 0, -1, 0));
  }
  for (let i = 1; i + 1 < sides; i++) {
    indices.push(capTop[0], capTop[i + 1], capTop[i]);
    indices.push(capBot[0], capBot[i], capBot[i + 1]);
  }
  return finish(positions, normals, uvs, indices, textureRecord);
}

/** Unity's Cube primitive: 1x1x1 on the origin. */
export function buildCubeModel(textureRecord) {
  const positions = [], normals = [], uvs = [], indices = [];
  const faces = [
    [[1, 0, 0], [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]]],
    [[-1, 0, 0], [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]]],
    [[0, 1, 0], [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]]],
    [[0, -1, 0], [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]]],
    [[0, 0, 1], [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]],
    [[0, 0, -1], [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]],
  ];
  for (const [n, quad] of faces) {
    const base = positions.length / 3;
    for (const v of quad) { positions.push(v[0], v[1], v[2]); normals.push(n[0], n[1], n[2]); uvs.push(0.5, 0.5); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return finish(positions, normals, uvs, indices, textureRecord);
}

/**
 * The procedural stand-in for `RotateArrows.obj` (see the DEPARTURE in
 * the header): a flat curved arrow in the y = 0 plane, drawn on BOTH
 * faces because the pivot's nested scale flattens it to ~0.025 world
 * units and the map camera looks at it from either side.
 */
export function buildCurvedArrowModel(textureRecord, segments = 12) {
  const positions = [], normals = [], uvs = [], indices = [];
  const R_OUT = 0.45, R_IN = 0.30;
  const A0 = 25 * Math.PI / 180, A1 = 145 * Math.PI / 180;
  const at = (r, a) => [Math.cos(a) * r, 0, Math.sin(a) * r];
  const ring = [];
  for (let i = 0; i <= segments; i++) {
    const a = A0 + (A1 - A0) * (i / segments);
    ring.push([at(R_IN, a), at(R_OUT, a)]);
  }
  // the head: a triangle past the arc's far end
  const aHead = A1 + 22 * Math.PI / 180;
  const head = [at(R_IN - 0.09, A1), at(R_OUT + 0.09, A1), at((R_IN + R_OUT) / 2, aHead)];
  const tris = [];
  for (let i = 0; i < segments; i++) {
    const [i0, o0] = ring[i], [i1, o1] = ring[i + 1];
    tris.push([i0, o0, o1], [i0, o1, i1]);
  }
  tris.push(head);
  for (const [a, b, c] of tris) {
    // one triangle in each winding, so whichever of the two is the
    // front face under `frontFace(CW)` survives the cull from either
    // side. The pass is UNLIT, so the normals are documentation.
    const base = positions.length / 3;
    for (const v of [a, b, c]) { positions.push(v[0], v[1], v[2]); normals.push(0, 1, 0); uvs.push(0.5, 0.5); }
    for (const v of [a, c, b]) { positions.push(v[0], v[1], v[2]); normals.push(0, -1, 0); uvs.push(0.5, 0.5); }
    indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
  }
  return finish(positions, normals, uvs, indices, textureRecord);
}

function finish(positions, normals, uvs, indices, textureRecord) {
  const p = new Float32Array(positions);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
    if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
    if (p[i + 2] < z0) z0 = p[i + 2]; if (p[i + 2] > z1) z1 = p[i + 2];
  }
  return {
    positions: p,
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    subMeshes: [{ textureArchive: 'amap', textureRecord, startIndex: 0, primitiveCount: indices.length / 3 }],
    bounds: { min: [x0, y0, z0], max: [x1, y1, z1] },
  };
}

/** The three models, built once per process - they are constants, and
 *  a window that opens fifty times must not rebuild them fifty times. */
let _models = null;
export function markerModels() {
  if (_models) return _models;
  _models = {
    cylinderPlayer: buildCylinderModel(MARKER_TEX.PLAYER),
    cylinderPivot: buildCylinderModel(MARKER_TEX.PIVOT),
    cylinderEntrance: buildCylinderModel(MARKER_TEX.ENTRANCE),
    cubeEntrance: buildCubeModel(MARKER_TEX.ENTRANCE),
    curvedArrow: buildCurvedArrowModel(MARKER_TEX.PIVOT),
  };
  return _models;
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * SetupBeacons' object list for one frame, in DFU's own creation order
 * under `gameobjectBeacons` - which is also the order it hands them to
 * the renderer and (ties aside) the order the picker walks.
 *
 *   playerPos       gameObjectPlayerAdvanced.transform.position
 *   playerYawDeg    ...transform.rotation, as a Y euler
 *   pivotPos        rotationPivotAxisPosition (:1414)
 *   cameraYawDeg    UpdateAutomapView's `Quaternion.Euler(0, cameraAutomap
 *                   .transform.rotation.eulerAngles.y, 0)` (window :1297)
 *   entrancePos     dungeon.StartMarker.transform.position (:1447)
 *   entranceDiscovered  the beacon's activeSelf (:1448 sets it FALSE for a
 *                   dungeon; the LOS tick is what lights it)
 *   arrowBounds     mesh 99900's local bounds, or null when the model is
 *                   absent and the window falls back to a billboard
 *
 * Each row is `{ name, model, matrix, bounds }` - `model` naming a
 * `markerModels()` key or `'playerArrow'` for mesh 99900.
 */
export function automapMarkerSet({
  playerPos = null, playerYawDeg = 0, pivotPos = null, cameraYawDeg = 0,
  entrancePos = null, entranceDiscovered = false, arrowBounds = null,
} = {}) {
  const M = markerModels();
  const out = [];
  if (playerPos) {
    // the arrow takes the player's transform outright (:1362-1363)
    out.push({
      name: MARKER_NAMES.PLAYER_ARROW,
      model: 'playerArrow',
      matrix: trs(playerPos[0], playerPos[1], playerPos[2], 0, playerYawDeg, 0),
      bounds: arrowBounds,
    });
    const p = add(playerPos, RAY_PLAYER_POS_OFFSET);
    out.push({
      name: MARKER_NAMES.PLAYER_BEACON,
      model: 'cylinderPlayer',
      matrix: trs(p[0], p[1], p[2], 0, 0, 0, ...BEACON_SCALES.player),
      bounds: M.cylinderPlayer.bounds,
    });
  }
  if (pivotPos) {
    // the pivot object carries the MAP CAMERA's yaw, which is how its
    // two child arrows keep pointing the way a rotation would turn
    const pivot = trs(pivotPos[0], pivotPos[1], pivotPos[2], 0, cameraYawDeg, 0, ...BEACON_SCALES.pivot);
    out.push({ name: MARKER_NAMES.PIVOT_BEACON, model: 'cylinderPivot', matrix: pivot, bounds: M.cylinderPivot.bounds });
    for (const a of ROTATE_ARROW_LOCAL) {
      // parent-first: the pivot's (0.15, 50.2, 0.15) multiplies both
      // the arrow's offset and its own scale (see the header)
      const local = trs(a.pos[0], a.pos[1], a.pos[2], 0, a.yawDeg, 0, ...BEACON_SCALES.rotateArrow);
      out.push({
        name: MARKER_NAMES.ROTATE_ARROW,
        model: 'curvedArrow',
        matrix: multiply(pivot, local),
        bounds: M.curvedArrow.bounds,
      });
    }
  }
  if (entrancePos && entranceDiscovered) {
    // the ray and the cube are children of a bare, UNSCALED holder at
    // the entrance position (:1416-1441), so their own scales are their
    // world scales
    const e = add(entrancePos, RAY_ENTRANCE_POS_OFFSET);
    out.push({
      name: MARKER_NAMES.ENTRANCE_RAY,
      model: 'cylinderEntrance',
      matrix: trs(e[0], e[1], e[2], 0, 0, 0, ...BEACON_SCALES.entranceRay),
      bounds: M.cylinderEntrance.bounds,
    });
    out.push({
      name: MARKER_NAMES.ENTRANCE_CUBE,
      model: 'cubeEntrance',
      matrix: trs(e[0], e[1], e[2], 0, 0, 0, ...BEACON_SCALES.entranceCube),
      bounds: M.cubeEntrance.bounds,
    });
  }
  return out;
}
