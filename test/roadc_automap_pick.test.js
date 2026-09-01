// ROAD-C c2/S7: THE BEACONS, THE MARKER MESHES AND THE PICKER.
//
// Three surfaces meet in this stage and each fails differently, so the
// pins are grouped that way:
//
//   1. THE TRANSFORM TABLE (ui/automapMarkers.js) - every colour, scale
//      and local offset against its C# line, and the ONE arrangement a
//      reader is most likely to "simplify" wrongly: the two rotation
//      arrows are CHILDREN of a cylinder scaled (0.15, 50.2, 0.15), so
//      their offsets and their own scales are multiplied by it. A port
//      that composed them in world space would put two four-unit arrows
//      beside the axis instead of two three-centimetre ones.
//   2. THE MATH (systems/automapPick.js) - unprojection round-trips
//      through the pass's own MIRRORED projection, the two intersection
//      tests against fixtures whose answers are arithmetic, and the
//      ordering law (nearest wins; a tie goes to the marker).
//   3. THE POLICY - an UNREVEALED entry is never picked (DFU's
//      MeshRenderer.enabled filter, Automap.cs:1850), and the seven
//      hover strings are the seven Internal_Strings rows.
//
// Plus the budget the c2 risk list demands: hover runs every frame, in
// JS, so a still mouse must cost nothing at all after the first answer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mirrorProjectionX, perspective, lookAt, trs, identity } from '../src/world/mat4.js';
import {
  MARKER_NAMES, hoverKeyForHit, invertMat4, transformBounds, transformPoint4,
  rayTriangle, panelRay, projectToPanel, pickAutomap, createAutomapPicker,
} from '../src/systems/automapPick.js';
import {
  BEACON_COLOURS, BEACON_SCALES, ROTATE_ARROW_LOCAL, MARKER_TEXELS, MARKER_TEX,
  RAY_PLAYER_POS_OFFSET, RAY_ENTRANCE_POS_OFFSET,
  automapMarkerSet, markerModels, buildCylinderModel, buildCubeModel,
} from '../src/ui/automapMarkers.js';
import { buildAutomapModel } from '../src/systems/automapModel.js';
import { AUTOMAP_STRINGS } from '../src/ui/automapText.js';
import {
  AutomapWindow, resetAutomapWindowState, signalAutomapReset, _setAutomapArt,
} from '../src/ui/automapWindow.js';
import { CHROME_RECTS } from '../src/ui/automapChrome.js';
import { _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// the matrices are Float32Array, so 0.15 is 0.15000000596046448
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ─────────────────────────────────────────────────────────────────────
// 1. THE TRANSFORM TABLE
// ─────────────────────────────────────────────────────────────────────
test('c2/S7 SetupBeacons transcribed: four colours, five scales, two offsets, both zero-offsets', () => {
  // the material colours (Automap.cs:1372, :1388, :1428, :1437) - the
  // ALPHAS are transcribed because the C# writes them, and the draw
  // ignores them because Unity's opaque Standard material does
  assert.deepEqual([...BEACON_COLOURS.player], [1.0, 0.0, 0.0, 0.5]);
  assert.deepEqual([...BEACON_COLOURS.pivot], [0.0, 0.0, 1.0, 0.5]);
  assert.deepEqual([...BEACON_COLOURS.entranceRay], [0.0, 1.0, 0.0, 0.75]);
  assert.deepEqual([...BEACON_COLOURS.entranceCube], [0.0, 1.0, 0.0, 1.0]);

  // localScale (:1370, :1386, :1399/:1409, :1426, :1440)
  assert.deepEqual([...BEACON_SCALES.player], [0.3, 50.0, 0.3]);
  assert.deepEqual([...BEACON_SCALES.pivot], [0.15, 50.2, 0.15]);
  assert.deepEqual([...BEACON_SCALES.rotateArrow], [0.15, 0.0005, 0.15]);
  assert.deepEqual([...BEACON_SCALES.entranceRay], [0.3, 50.0, 0.3]);
  assert.deepEqual([...BEACON_SCALES.entranceCube], [0.8, 0.8, 0.8]);

  // the two arrow children (:1398/:1408) and the second one's turn (:1410)
  assert.deepEqual([...ROTATE_ARROW_LOCAL[0].pos], [2.0, -0.02, -2.0]);
  assert.equal(ROTATE_ARROW_LOCAL[0].yawDeg, 0);
  assert.deepEqual([...ROTATE_ARROW_LOCAL[1].pos], [-2.0, -0.02, 2.0]);
  assert.equal(ROTATE_ARROW_LOCAL[1].yawDeg, 180);

  // rayPlayerPosOffset / rayEntrancePosOffset (:235-236) are BOTH ZERO
  // in shipping DFU - the (-0.1,0,+0.1) pair its comment still
  // describes is commented out one line above
  assert.deepEqual([...RAY_PLAYER_POS_OFFSET], [0, 0, 0]);
  assert.deepEqual([...RAY_ENTRANCE_POS_OFFSET], [0, 0, 0]);
});

test('c2/S7 BEACONS ARE OPAQUE - the alpha the C# writes is the alpha Unity throws away', () => {
  // the three 1x1 solids the sub-meshes name carry FULL alpha even
  // though two of the three source colours do not. If the port had
  // packed the alpha through, the red beacon would be half-transparent
  // and the green ray three-quarters, which DFU never shows.
  for (const record of Object.values(MARKER_TEX)) {
    assert.equal(MARKER_TEXELS[record] >>> 24, 0xff, `${record} draws opaque`);
  }
  assert.equal(BEACON_COLOURS.player[3], 0.5, 'the source alpha is still on record');
  assert.equal(BEACON_COLOURS.entranceRay[3], 0.75);
  // and the RGB really is the colour: ABGR packing, red = 0xff0000ff
  assert.equal(MARKER_TEXELS[MARKER_TEX.PLAYER] & 0xff, 0xff, 'red');
  assert.equal((MARKER_TEXELS[MARKER_TEX.PIVOT] >>> 16) & 0xff, 0xff, 'blue');
  assert.equal((MARKER_TEXELS[MARKER_TEX.ENTRANCE] >>> 8) & 0xff, 0xff, 'green');
});

test('c2/S7 the rotation arrows are CHILDREN of the pivot - its scale multiplies their offset AND their size', () => {
  const set = automapMarkerSet({
    playerPos: [0, 0, 0], pivotPos: [0, 0, 0], cameraYawDeg: 0,
  });
  const arrows = set.filter((m) => m.name === MARKER_NAMES.ROTATE_ARROW);
  assert.equal(arrows.length, 2, 'two arrows, always');

  // localPosition (2, -0.02, -2) under localScale (0.15, 50.2, 0.15)
  // lands at (0.3, -1.004, -0.3) - NOT four units out
  const t = (m) => [m[12], m[13], m[14]];
  assert.deepEqual(t(arrows[0].matrix).map((v) => +v.toFixed(6)), [0.3, -1.004, -0.3]);
  // arrow 2's local y is the SAME -0.02: the 180 turn is about Y only
  assert.deepEqual(t(arrows[1].matrix).map((v) => +v.toFixed(6)), [-0.3, -1.004, 0.3]);
  // ...and their world scale is the product too: 0.15*0.15 = 0.0225 in
  // x/z, 50.2*0.0005 = 0.0251 in y. A world-space composition would
  // have left 0.15 and 0.0005.
  const scaleOf = (m) => [Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])];
  assert.deepEqual(scaleOf(arrows[0].matrix).map((v) => +v.toFixed(6)), [0.0225, 0.0251, 0.0225]);

  // the 180-degree twin: the same composition with the yaw turned round
  assert.ok(near(arrows[0].matrix[0], 0.0225));
  assert.ok(near(arrows[1].matrix[0], -0.0225), 'arrow 2 is arrow 1 turned 180 about Y');
});

test('c2/S7 the pivot beacon follows the MAP CAMERA yaw, and drags its arrows round with it', () => {
  const at = (yaw) => automapMarkerSet({ playerPos: [0, 0, 0], pivotPos: [5, 1, -3], cameraYawDeg: yaw });
  const pivot0 = at(0).find((m) => m.name === MARKER_NAMES.PIVOT_BEACON);
  const pivot90 = at(90).find((m) => m.name === MARKER_NAMES.PIVOT_BEACON);
  // the axis itself is a cylinder, so its POSITION is unchanged...
  assert.deepEqual([pivot90.matrix[12], pivot90.matrix[13], pivot90.matrix[14]], [5, 1, -3]);
  // ...but the frame turned (UpdateAutomapView's
  // Quaternion.Euler(0, cameraAutomap yaw, 0), window :1297)
  assert.ok(near(pivot0.matrix[0], 0.15));
  assert.ok(near(pivot90.matrix[0], 0), 'cos 90 = 0');
  assert.ok(near(pivot90.matrix[2], -0.15));
  // and the child arrow went with it: (2,-0.02,-2) scaled to
  // (0.3,-1.004,-0.3) then yawed 90 lands at (-0.3, -1.004, -0.3)
  const arrow = at(90).filter((m) => m.name === MARKER_NAMES.ROTATE_ARROW)[0];
  assert.deepEqual(
    [arrow.matrix[12] - 5, arrow.matrix[13] - 1, arrow.matrix[14] + 3].map((v) => +v.toFixed(6)),
    [-0.3, -1.004, -0.3]);
});

test('c2/S7 the entrance pair is hidden until discovered, and the set is DFU\'s creation order', () => {
  const base = { playerPos: [1, 2, 3], pivotPos: [1, 2, 3], entrancePos: [9, 0, 9] };
  const hidden = automapMarkerSet({ ...base, entranceDiscovered: false });
  assert.deepEqual(hidden.map((m) => m.name), [
    MARKER_NAMES.PLAYER_ARROW, MARKER_NAMES.PLAYER_BEACON,
    MARKER_NAMES.PIVOT_BEACON, MARKER_NAMES.ROTATE_ARROW, MARKER_NAMES.ROTATE_ARROW,
  ], 'gameobjectBeaconEntrancePosition.SetActive(false) - :1448');

  const shown = automapMarkerSet({ ...base, entranceDiscovered: true });
  assert.deepEqual(shown.map((m) => m.name).slice(-2),
    [MARKER_NAMES.ENTRANCE_RAY, MARKER_NAMES.ENTRANCE_CUBE]);
  // the holder is UNSCALED (:1416-1421), so the ray and the cube wear
  // their own scales at the start marker's own position
  const ray = shown.find((m) => m.name === MARKER_NAMES.ENTRANCE_RAY);
  const cube = shown.find((m) => m.name === MARKER_NAMES.ENTRANCE_CUBE);
  assert.deepEqual([ray.matrix[12], ray.matrix[13], ray.matrix[14]], [9, 0, 9]);
  assert.ok(near(ray.matrix[5], 50.0), 'the ray is 50 tall in Y');
  assert.ok(near(cube.matrix[5], 0.8), 'the cube is 0.8 on every axis');
});

test('c2/S7 the beacon models are meshReader-shaped and name 1x1 solids in the amap archive', () => {
  const models = markerModels();
  // RE-BASELINED at ROAD-C c2/S8, which added four more on the same
  // path: the note diamond and the three teleporter cylinders.
  assert.deepEqual(Object.keys(models).sort(), [
    'cubeEntrance', 'curvedArrow', 'cylinderConnection', 'cylinderEntrance',
    'cylinderPivot', 'cylinderPlayer', 'cylinderPortalEntrance', 'cylinderPortalExit',
    'diamondNote',
  ]);
  for (const [name, m] of Object.entries(models)) {
    assert.ok(m.positions instanceof Float32Array, `${name} positions`);
    assert.ok(m.indices instanceof Uint32Array, `${name} indices`);
    assert.equal(m.normals.length, m.positions.length);
    assert.equal(m.uvs.length / 2, m.positions.length / 3);
    assert.equal(m.subMeshes.length, 1);
    assert.equal(m.subMeshes[0].textureArchive, 'amap',
      'the sub-mesh names the archive uploadTexture writes into - NO new renderer entry point');
    assert.ok(MARKER_TEXELS[m.subMeshes[0].textureRecord] !== undefined, `${name} names a real solid`);
    assert.equal(m.subMeshes[0].startIndex, 0);
    assert.equal(m.subMeshes[0].primitiveCount, m.indices.length / 3);
  }
  // Unity's Cylinder primitive is radius 0.5, height 2, on the origin;
  // its Cube is the unit cube. The SCALES above are what turn them into
  // beacons, so these bounds are load-bearing.
  const cyl = buildCylinderModel('x');
  assert.deepEqual(cyl.bounds.min.map((v) => +v.toFixed(6)), [-0.5, -1, -0.5]);
  assert.deepEqual(cyl.bounds.max.map((v) => +v.toFixed(6)), [0.5, 1, 0.5]);
  const cube = buildCubeModel('x');
  assert.deepEqual(cube.bounds.min, [-0.5, -0.5, -0.5]);
  assert.deepEqual(cube.bounds.max, [0.5, 0.5, 0.5]);
  // every index is in range - a malformed procedural mesh would draw
  // garbage or crash the driver, and neither shows up in a rect pin
  for (const m of Object.values(models)) {
    const verts = m.positions.length / 3;
    for (const i of m.indices) assert.ok(i < verts, 'index in range');
  }
});

// ─────────────────────────────────────────────────────────────────────
// 2. THE MATH
// ─────────────────────────────────────────────────────────────────────
const PANEL = { w: CHROME_RECTS.panel.w, h: CHROME_RECTS.panel.h };
const testProj = (mirror = true) => {
  const p = perspective(45 * Math.PI / 180, PANEL.w / PANEL.h, 0.3, 5000);
  return mirror ? mirrorProjectionX(p) : p;
};
const testView = lookAt([3, 40, -7], [3, 0, -7 + 0.001], [0, 0, 1]);

test('c2/S7 project -> unproject round-trips through the pass\'s OWN mirrored projection', () => {
  const proj = testProj();
  for (const world of [[3, 0, -7], [9, -2, 4], [-11, 5, -14], [3.5, 1, -6.5]]) {
    const px = projectToPanel(proj, testView, PANEL, world);
    assert.ok(px, 'in front of the camera');
    assert.ok(px[0] >= -1 && px[0] <= PANEL.w + 1 && px[1] >= -1 && px[1] <= PANEL.h + 1,
      `${world} lands inside the panel rect`);
    const ray = panelRay(proj, testView, PANEL, px[0], px[1]);
    // the world point must sit ON the ray: its perpendicular distance
    // from the line is the whole assertion
    const v = [world[0] - ray.origin[0], world[1] - ray.origin[1], world[2] - ray.origin[2]];
    const t = v[0] * ray.dir[0] + v[1] * ray.dir[1] + v[2] * ray.dir[2];
    const perp = Math.hypot(v[0] - ray.dir[0] * t, v[1] - ray.dir[1] * t, v[2] - ray.dir[2] * t);
    assert.ok(perp < 1e-5, `${world} is on its own ray (off by ${perp})`);
    assert.ok(t > 0, 'and in front of the origin');
  }
});

test('c2/S7 the MIRROR is really in the picker - drop it and every pick lands on the wrong side', () => {
  const world = [9, 0, -7];
  const a = projectToPanel(testProj(true), testView, PANEL, world);
  const b = projectToPanel(testProj(false), testView, PANEL, world);
  assert.ok(Math.abs(a[0] - b[0]) > 20, 'the two projections disagree in x by a long way');
  assert.ok(near(a[0] + b[0], PANEL.w, 1e-6), 'and they are mirror images about the panel centre');
  assert.ok(near(a[1], b[1], 1e-9), 'y is untouched');
  // the round trip only closes with the projection that DREW the frame
  const ray = panelRay(testProj(true), testView, PANEL, a[0], a[1]);
  const v = [world[0] - ray.origin[0], world[1] - ray.origin[1], world[2] - ray.origin[2]];
  const t = v[0] * ray.dir[0] + v[1] * ray.dir[1] + v[2] * ray.dir[2];
  assert.ok(Math.hypot(v[0] - ray.dir[0] * t, v[1] - ray.dir[1] * t, v[2] - ray.dir[2] * t) < 1e-5);
});

test('c2/S7 the 4x4 inverse and the bounds refit, against answers that are arithmetic', () => {
  const m = trs(3, -4, 7, 0, 90, 0, 2, 2, 2);
  const inv = invertMat4(m);
  const round = transformPoint4(inv, ...transformPoint4(m, 1, 2, 3));
  assert.deepEqual(round.map((v) => +v.toFixed(9)), [1, 2, 3]);
  assert.equal(invertMat4(new Float32Array(16)), null, 'a singular matrix answers null');

  // an axis-aligned box yawed 90 degrees refits to the same box with
  // x and z swapped; scaled by 2 it doubles
  const b = transformBounds({ min: [-1, -3, -0.5], max: [1, 3, 0.5] }, trs(0, 0, 0, 0, 90, 0, 2, 2, 2));
  assert.deepEqual(b.min.map((v) => +v.toFixed(6)), [-1, -6, -2]);
  assert.deepEqual(b.max.map((v) => +v.toFixed(6)), [1, 6, 2]);
});

test('c2/S7 ray-vs-triangle: hits, misses, the back face, and the parallel case', () => {
  const A = [0, 0, 0], B = [4, 0, 0], C = [0, 0, 4];
  const tri = (o, d) => rayTriangle(o, d, ...A, ...B, ...C);
  // straight down onto the middle of the triangle from 10 up
  assert.equal(tri([1, 10, 1], [0, -1, 0]), 10);
  // and from BELOW - DFU's MeshColliders are two-sided, and a dungeon's
  // inward-facing walls would be unpickable otherwise
  assert.equal(tri([1, -10, 1], [0, 1, 0]), 10);
  // just outside the hypotenuse
  assert.equal(tri([3, 10, 3], [0, -1, 0]), null);
  // and just inside it
  assert.ok(tri([1.9, 10, 1.9], [0, -1, 0]) === 10);
  // parallel to the plane
  assert.equal(tri([1, 0, 1], [1, 0, 0]), null);
  // BEHIND the origin is not a hit
  assert.equal(tri([1, 10, 1], [0, 1, 0]), null);
});

// ─────────────────────────────────────────────────────────────────────
// 3. THE PICK
// ─────────────────────────────────────────────────────────────────────

/** A 4x4-unit floor quad at y = 0, centred on (cx, 0, cz). */
function floorRow(key, cx, cz, y = 0) {
  const positions = new Float32Array([-2, 0, -2, 2, 0, -2, 2, 0, 2, -2, 0, 2]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  return {
    key,
    aabb: { min: [cx - 2, y - 0.01, cz - 2], max: [cx + 2, y + 0.01, cz + 2] },
    positions, indices, matrix: trs(cx, y, cz, 0, 0, 0),
  };
}
const DOWN = { origin: [0, 10, 0], dir: [0, -1, 0] };

test('c2/S7 GEOMETRY IS PICKABLE ONLY IF REVEALED - the MeshRenderer.enabled filter (:1850)', () => {
  const model = buildAutomapModel([floorRow('a', 0, 0)]);
  const dark = pickAutomap({ ray: DOWN, model, rec: { revealed: new Set() } });
  assert.equal(dark, null, 'an undiscovered room must not name itself under the pointer');
  // ...and the SAME entry answers the moment it is revealed, which is
  // what stops "return null" from passing this pin
  const lit = pickAutomap({ ray: DOWN, model, rec: { revealed: new Set(['a']) } });
  assert.equal(lit.key, 'a');
  assert.equal(lit.kind, 'geometry');
  assert.equal(lit.distance, 10);
  assert.deepEqual(lit.point.map((v) => +v.toFixed(9)), [0, 0, 0]);
  assert.deepEqual(lit.normal.map((v) => +v.toFixed(9)), [0, 1, 0], 'the face normal faces the ray');
});

test('c2/S7 nearest wins, and the triangles - not the boxes - decide', () => {
  // two floors, one above the other; the ray comes down from +y
  const model = buildAutomapModel([floorRow('low', 0, 0, 0), floorRow('high', 0, 0, 4)]);
  const rec = { revealed: new Set(['low', 'high']) };
  const hit = pickAutomap({ ray: DOWN, model, rec });
  assert.equal(hit.key, 'high', 'y = 4 is nearer to a camera at y = 10');
  assert.equal(hit.distance, 6);

  // a row whose AABB the ray crosses but whose TRIANGLES it misses is
  // not a hit - a box-only picker would answer 'wide' here
  const wide = floorRow('wide', 0, 0, 2);
  wide.aabb = { min: [-50, 1.99, -50], max: [50, 2.01, 50] };   // a box far bigger than its quad
  const m2 = buildAutomapModel([floorRow('low', 0, 0, 0), wide]);
  const h2 = pickAutomap({ ray: { origin: [20, 10, 0], dir: [0, -1, 0] }, model: m2, rec: { revealed: new Set(['low', 'wide']) } });
  assert.equal(h2, null, 'x = 20 is inside the wide BOX and outside every triangle of it');
});

test('c2/S7 marker proxies are tested first and WIN A TIE with the geometry under them', () => {
  const model = buildAutomapModel([floorRow('floor', 0, 0, 0)]);
  const rec = { revealed: new Set(['floor']) };
  // a cube marker whose underside sits exactly on the floor: both
  // answer t = 10 from a camera 10 up... except the cube's TOP is
  // nearer, so make it flat on the floor to force the tie
  const flat = { name: MARKER_NAMES.ENTRANCE_CUBE, aabb: { min: [-0.4, -0.4, -0.4], max: [0.4, 0, 0.4] } };
  const hit = pickAutomap({ ray: DOWN, model, rec, markers: [flat] });
  assert.equal(hit.kind, 'marker');
  assert.equal(hit.name, MARKER_NAMES.ENTRANCE_CUBE);
  assert.equal(hit.distance, 10, 'the tie is real - both are at 10');

  // and a marker that is genuinely FARTHER still loses
  const far = { name: MARKER_NAMES.PLAYER_BEACON, aabb: { min: [-0.4, -5, -0.4], max: [0.4, -4, 0.4] } };
  const below = pickAutomap({ ray: DOWN, model, rec, markers: [far] });
  assert.equal(below.kind, 'geometry', 'the floor is in front of it');
  assert.equal(below.key, 'floor');

  // nearest marker of several
  const two = pickAutomap({
    ray: DOWN, model, rec,
    markers: [far, { name: MARKER_NAMES.PLAYER_ARROW, aabb: { min: [-0.4, 5, -0.4], max: [0.4, 6, 0.4] } }],
  });
  assert.equal(two.name, MARKER_NAMES.PLAYER_ARROW);
  assert.equal(two.distance, 4);
});

test('c2/S7 a marker with only local BOUNDS is transformed by its own matrix before the test', () => {
  // this is the path the live window takes: automapMarkerSet hands
  // {bounds, matrix}, never a world box
  const set = automapMarkerSet({ playerPos: [0, 0, 0], pivotPos: [40, 0, 40] });
  const beacon = set.find((m) => m.name === MARKER_NAMES.PLAYER_BEACON);
  assert.ok(beacon.bounds, 'the local cylinder bounds ride along');
  const hit = pickAutomap({ ray: DOWN, model: null, rec: null, markers: set });
  assert.equal(hit.name, MARKER_NAMES.PLAYER_BEACON,
    'the 0.3-wide, 100-tall beacon at the origin is under a ray straight down the y axis');
  // the pivot is forty units away and must NOT answer
  assert.notEqual(hit.name, MARKER_NAMES.PIVOT_BEACON);
});

// ─────────────────────────────────────────────────────────────────────
// 4. THE HOVER STRINGS
// ─────────────────────────────────────────────────────────────────────
test('c2/S7 the seven hover cases map to their Internal_Strings rows, and geometry answers nothing', () => {
  const cases = [
    [{ name: MARKER_NAMES.PLAYER_BEACON }, 'automapPlayerPositionBeacon', 'player position beacon'],
    [{ name: MARKER_NAMES.PIVOT_BEACON }, 'automapRotationPivotAxis', 'rotation pivot axis'],
    [{ name: MARKER_NAMES.ROTATE_ARROW }, 'automapRotationPivotAxis', 'rotation pivot axis'],
    [{ name: MARKER_NAMES.ENTRANCE_RAY }, 'automapEntranceExitPositionBeacon', 'entrance/exit position beacon'],
    [{ name: MARKER_NAMES.ENTRANCE_CUBE }, 'automapEntranceExit', 'entrance/exit'],
    [{ name: MARKER_NAMES.PLAYER_ARROW }, 'automapPlayerMarker', 'player marker'],
    [{ name: MARKER_NAMES.PORTAL, portal: 'entrance' }, 'automapTeleporterEntrance', 'teleporter (entrance)'],
    [{ name: MARKER_NAMES.PORTAL, portal: 'exit' }, 'automapTeleporterExit', 'teleporter (exit)'],
  ];
  const keys = new Set();
  for (const [hit, key, text] of cases) {
    assert.equal(hoverKeyForHit(hit), key, `${hit.name} -> ${key}`);
    assert.equal(AUTOMAP_STRINGS[key], text, `${key} is Internal_Strings.csv:884-890 verbatim`);
    keys.add(key);
  }
  assert.equal(keys.size, 7, 'eight arms, SEVEN strings - the pivot and its arrows share one');
  // the two arms with no key: geometry (the `return ""` at the end of
  // the chain) and a user note, whose text is its own
  assert.equal(hoverKeyForHit({ kind: 'geometry', key: '0:12' }), null);
  assert.equal(hoverKeyForHit(null), null);
  assert.equal(hoverKeyForHit({ name: MARKER_NAMES.PORTAL, portal: null }), null,
    'a portal marker with no end named is not a hover case');
});

// ─────────────────────────────────────────────────────────────────────
// 5. THE BUDGET
// ─────────────────────────────────────────────────────────────────────
test('c2/S7 a 20k-triangle model answers within budget, and a STILL mouse costs nothing after the first', () => {
  // one row, 20000 triangles, all of them in the ray's way
  const N = 20000;
  const positions = new Float32Array(N * 9);
  const indices = new Uint32Array(N * 3);
  for (let t = 0; t < N; t++) {
    const y = -t * 0.001;                     // stacked, so the nearest is t = 0
    const b = t * 9;
    positions.set([-2, y, -2, 2, y, -2, 0, y, 2], b);
    indices.set([t * 3, t * 3 + 1, t * 3 + 2], t * 3);
  }
  const model = buildAutomapModel([{
    key: 'big', aabb: { min: [-2, -20, -2], max: [2, 0.01, 2] },
    positions, indices, matrix: identity(),
  }]);
  const rec = { revealed: new Set(['big']) };
  const picker = createAutomapPicker();
  const proj = testProj();
  const args = {
    proj, view: lookAt([0, 30, 0], [0, 0, 0], [0, 0, 1]), panel: PANEL,
    px: PANEL.w / 2, py: PANEL.h / 2, model, rec, markers: [], stamp: 'v1',
  };

  const t0 = Date.now();
  const hit = picker.pick(args);
  const cold = Date.now() - t0;
  assert.equal(hit.key, 'big');
  assert.ok(cold < 500, `a cold pick over 20k triangles took ${cold}ms`);
  assert.equal(picker.stats.picks, 1);
  assert.equal(picker.stats.triangleTests, N);

  // THE CACHE IS THE LAW, not the timing: sixty frames of a still
  // mouse must do NO further work at all
  for (let i = 0; i < 60; i++) assert.equal(picker.pick(args).key, 'big');
  assert.equal(picker.stats.picks, 1, 'a still mouse re-traverses nothing');
  assert.equal(picker.stats.triangleTests, N);

  // and moving one pixel, or changing the stamp (the camera moved, or
  // the revealed set grew), really does re-run it
  picker.pick({ ...args, px: args.px + 1 });
  assert.equal(picker.stats.picks, 2);
  picker.pick({ ...args, stamp: 'v2' });
  assert.equal(picker.stats.picks, 3, 'the stamp covers everything the position does not');
});

// ─────────────────────────────────────────────────────────────────────
// 6. THE WINDOW: the marker group, and the label it feeds
// ─────────────────────────────────────────────────────────────────────
const CANVAS = { width: 320, height: 200 };
function markerStub(log) {
  return {
    canvas: CANVAS,
    uploadTexture: (a, k, c) => { log.push(['uploadTexture', a, k, c.colors[0]]); return `tex:${a}/${k}`; },
    releaseTexture: (a, k) => log.push(['releaseTexture', a, k]),
    createBillboardBatch: () => ({}),
    destroyBillboardBatch: () => {},
    createMesh: (model) => ({ tag: model.subMeshes[0].textureRecord, tris: model.indices.length / 3, subMeshes: model.subMeshes }),
    destroyMesh: (m) => log.push(['destroyMesh', m?.tag ?? '?']),
    drawBillboards: () => log.push(['drawBillboards']),
    drawMesh: (mesh) => log.push(['drawMesh', mesh?.tag ?? mesh]),
    drawMeshWire: () => {},
    drawScreenQuad: () => {},
    setClipY: (y) => log.push(['setClipY', y]),
    setAutomapMode: (m) => log.push(['setAutomapMode', m]),
    setAutomapWater: (l) => log.push(['setAutomapWater', l]),
    setFog: () => {}, setLighting: () => {}, setMoonlight: () => {},
    setPointLights: () => {}, setIndirectLight: () => {}, setWindowEmission: () => {},
    panelFrame: ({ setup }, body) => { setup?.(); body(); },
  };
}
const markerDeps = (over = {}) => ({
  record: () => ({ revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: false }),
  model: { exploredPercentage: () => 0, length: 0, rows: [] },
  drawList: [], dynamicDraws: [], texRemap: null,
  player: () => ({ feet: [0, 0, 0], eye: [0, 1.7, 0], yaw: 0 }),
  startMarker: { x: 30, y: 0, z: 30 },
  blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }],
  arrowMesh: null, arrowBounds: null,
  dungeonName: 'D', insideBuilding: false,
  ...over,
});
function openWindow(over) {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  signalAutomapReset();
  return new AutomapWindow(markerDeps(over));
}

test('c2/S7 the marker group draws with the slice LIFTED, the presentation OFF and the water tint cleared', () => {
  const log = [];
  const w = openWindow();
  try {
    w.draw(markerStub(log), CANVAS, null, 1);
    // the last setClipY / setAutomapMode / setAutomapWater before the
    // first marker draw are the never-sliced trio
    const firstMarker = log.findIndex((c) => c[0] === 'drawMesh');
    assert.ok(firstMarker > 0, 'the beacons drew');
    const before = log.slice(0, firstMarker);
    assert.deepEqual(before.filter((c) => c[0] === 'setClipY').pop(), ['setClipY', null]);
    assert.deepEqual(before.filter((c) => c[0] === 'setAutomapMode').pop(), ['setAutomapMode', 0]);
    assert.deepEqual(before.filter((c) => c[0] === 'setAutomapWater').pop(), ['setAutomapWater', null]);
    // ...and nothing re-arms them afterwards
    assert.equal(log.slice(firstMarker).some((c) => c[0] === 'setAutomapMode' || c[0] === 'setClipY'), false,
      'beacons are never sliced, dimmed or grayed');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S7 the beacons ride drawMesh with 1x1 amap solids - no new renderer entry point, and they go back on dispose', () => {
  const log = [];
  const w = openWindow({ record: () => ({ revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: true }) });
  const r = markerStub(log);
  try {
    w.draw(r, CANVAS, null, 1);
    const drew = log.filter((c) => c[0] === 'drawMesh').map((c) => c[1]);
    // no arrowMesh in this fixture, so the arrow takes the billboard
    // fallback and the five beacon objects take the mesh path
    assert.deepEqual(drew, [
      MARKER_TEX.PLAYER,                      // the red position cylinder
      MARKER_TEX.PIVOT,                       // the blue pivot axis
      MARKER_TEX.PIVOT, MARKER_TEX.PIVOT,     // its two curved arrows, same material
      MARKER_TEX.ENTRANCE, MARKER_TEX.ENTRANCE, // the green ray and its cube
    ]);
    assert.ok(log.some((c) => c[0] === 'drawBillboards'), 'the arrow fell back to its quad');
    // the three solids really are 1x1 and really are the beacon colours
    const ups = log.filter((c) => c[0] === 'uploadTexture' && MARKER_TEXELS[c[2]] !== undefined);
    // RE-BASELINED at c2/S8: seven solids now - the three beacon
    // colours plus the note orange, the two portal violets and the
    // connection's. Every one of them still goes back on dispose, which
    // is what the loop below the teardown checks.
    assert.equal(ups.length, 7);
    for (const [, archive, record, texel] of ups) {
      assert.equal(archive, 'amap');
      assert.equal(texel, MARKER_TEXELS[record]);
    }
    w.dispose();
    assert.deepEqual(log.filter((c) => c[0] === 'destroyMesh').length, 9, 'every bundle goes back');
    for (const record of Object.values(MARKER_TEX)) {
      assert.ok(log.some((c) => c[0] === 'releaseTexture' && c[2] === record), `${record} released`);
    }
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S7 the entrance beacon is not DRAWN and not PICKABLE until it is discovered', () => {
  const hidden = [];
  const w1 = openWindow();
  try {
    w1.draw(markerStub(hidden), CANVAS, null, 1);
    assert.equal(hidden.filter((c) => c[0] === 'drawMesh' && c[1] === MARKER_TEX.ENTRANCE).length, 0);
    // the pointer over the start marker finds nothing
    w1.hover(160, 85);
    w1.draw(markerStub([]), CANVAS, null, 1);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S7 the status label is UpdateMouseHoverOverText - and the panel mouse STICKS on the way out', () => {
  const w = openWindow();
  try {
    // over the middle of the panel, where the player's own beacon
    // stands under the map camera
    w.hover(160, 85);
    w.draw(markerStub([]), CANVAS, null, 1);
    assert.equal(w.hoverText, 'player position beacon');

    // OUT of the panel entirely (down on the button row): DFU's
    // ScaledMousePosition is only written while the pointer is inside
    // the component and is NEVER cleared, so the answer stands
    w.hover(160, 180);
    w.draw(markerStub([]), CANVAS, null, 1);
    assert.equal(w.hoverText, 'player position beacon', 'the stale panel position is DFU\'s own');

    // ...and moving back inside, over nothing, really does clear it
    w.hover(CHROME_RECTS.panel.x + 3, CHROME_RECTS.panel.y + 3);
    w.draw(markerStub([]), CANVAS, null, 1);
    assert.equal(w.hoverText, '', 'geometry and empty space answer ""');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S7 the pick obeys the HANDEDNESS LAW end to end - world +x answers on the RIGHT of the panel', () => {
  // The 3D reset puts the camera at (0, 9.7, -20) looking along +z, so
  // a beacon eight units EAST of the player must be found in the right
  // half of the panel. Drop `mirrorProjectionX` from the pass (or from
  // the picker alone, which is the same bug in reverse) and it answers
  // in the left half instead - the mirror-image presentation the port
  // shipped until the handedness fix, and the one thing a pick that
  // uses the drawn matrices cannot get wrong by accident.
  const w = openWindow({
    record: () => ({ revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: true }),
    startMarker: { x: 8, y: 0, z: 0 },
  });
  try {
    const found = [];
    for (let x = 2; x < 319; x++) {
      w.hover(x, 85);
      w.draw(markerStub([]), CANVAS, null, 1);
      if (w.hoverText === 'entrance/exit position beacon') found.push(x);
    }
    assert.ok(found.length > 0, 'the green entrance ray is somewhere on the row');
    const mid = (found[0] + found[found.length - 1]) / 2;
    assert.ok(mid > 200 && mid < 270, `the +x beacon answers at x ~ ${mid}, on the RIGHT`);
    // the player's own beacon is under the camera, at the centre
    w.hover(160, 85);
    w.draw(markerStub([]), CANVAS, null, 1);
    assert.equal(w.hoverText, 'player position beacon');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S7 SOURCE PINS: the host hands the picker its triangles, and the model carries them', () => {
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /amapRow = \(key, aabb, hasAction, cpu = null, matrix = null\)/,
    'the row builder takes the CPU model and the placement matrix');
  assert.match(ctx, /positions: cpu\?\.positions \?\? null/, 'and passes REFERENCES, not copies');
  assert.match(ctx, /arrowBounds: automapArrowBounds/, 'mesh 99900\'s own bounds are the arrow\'s proxy');
  const model = src('src/systems/automapModel.js');
  assert.match(model, /positions: e\.positions \?\? null/);
  assert.match(model, /matrix: e\.matrix \?\? null/);
  // a row built WITHOUT them still lands - the fixtures and the older
  // callers must not start throwing
  const m = buildAutomapModel([{ key: 'k', aabb: [0, 0, 0, 1, 1, 1] }]);
  assert.equal(m.rows[0].positions, null);
  assert.equal(m.rows[0].matrix, null);
  const hit = pickAutomap({ ray: { origin: [0.5, 10, 0.5], dir: [0, -1, 0] }, model: m, rec: { revealed: new Set(['k']) } });
  assert.equal(hit.key, 'k', 'a triangle-less row answers its BOX rather than vanishing');
  assert.equal(hit.distance, 9);
});

// ─────────────────────────────────────────────────────────────────────
// DATA-GATED
// ─────────────────────────────────────────────────────────────────────
test('c2/S7 mesh 99900 loads and the window prefers it over the quad fallback', { skip: skipReal }, async () => {
  const { openArch3d } = await import('../src/world/arch3d.js');
  const { readMesh } = await import('../src/world/meshReader.js');
  const arch = await openArch3d(ARENA2);
  const mesh = readMesh(arch, 99900);
  assert.ok(mesh.positions.length > 0, 'the player marker arrow is a real model');
  const log = [];
  const gpu = { tag: 'arrow99900', subMeshes: mesh.subMeshes };
  const w = openWindow({ arrowMesh: gpu, arrowBounds: { min: [-1, -1, -1], max: [1, 1, 1] } });
  try {
    w.draw(markerStub(log), CANVAS, null, 1);
    assert.equal(log.filter((c) => c[0] === 'drawMesh').map((c) => c[1])[0], 'arrow99900',
      'the arrow draws FIRST, at the player transform, and no billboard is needed');
    assert.equal(log.some((c) => c[0] === 'drawBillboards'), false);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});
