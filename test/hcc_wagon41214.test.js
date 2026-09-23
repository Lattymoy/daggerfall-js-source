// HCC (2026-09-23): THE WAGON'S SPLIT, PINNED BY EXECUTION - systems/wagon41214.js is Wagon41214VisualBuilder off
// the IL: classic model 41214 welded into its five pieces (a body of 14 triangles, two planar wheels of 10, two
// shafts of 7) with the wheels' pivots and radius, and WagonCargoVisual's twelve pieces by tier. The model here is
// test/hccModel.mjs's synthetic twin of the verified topology; every refusal the builder throws is driven too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readTriangles, buildComponents, identifyVerifiedParts, buildComponentModel, buildWagonParts, usableBounds,
  CARGO_DEFINITIONS, cargoPieceName, cargoPiecesShown, EXPECTED_VERTEX_COUNT, EXPECTED_TRIANGLE_COUNT, EXPECTED_SUBMESH_COUNT, EXPECTED_COMPONENT_COUNT,
  BODY_TRIANGLES, WHEEL_TRIANGLES, SHAFT_TRIANGLES, POSITION_WELD_TOLERANCE_SQUARED, WHEEL_PLANARITY_TOLERANCE,
} from '../src/systems/wagon41214.js';
import { wheelRadiusOf } from '../src/systems/horseCartLaw.js';
import { syntheticWagon41214, WHEEL_X, WHEEL_Y, WHEEL_Z } from './hccModel.mjs';

test('HCC wagon: the verified topology\'s numbers', () => {
  assert.deepEqual([EXPECTED_VERTEX_COUNT, EXPECTED_TRIANGLE_COUNT, EXPECTED_SUBMESH_COUNT, EXPECTED_COMPONENT_COUNT], [102, 48, 4, 5]);
  assert.deepEqual([BODY_TRIANGLES, WHEEL_TRIANGLES, SHAFT_TRIANGLES], [14, 10, 7]);
  assert.equal(POSITION_WELD_TOLERANCE_SQUARED, 1e-8); assert.equal(WHEEL_PLANARITY_TOLERANCE, 0.001);
});

test('HCC wagon: ReadTriangles walks every sub-mesh and refuses an index off the end', () => {
  const m = syntheticWagon41214();
  const tris = readTriangles(m);
  assert.equal(tris.length, 48);
  assert.equal(tris.filter((t) => t.subMesh === 0).length, 14);
  assert.equal(tris.filter((t) => t.subMesh === 1).length, 20);
  const bad = syntheticWagon41214(); bad.indices[0] = 500;
  assert.throws(() => readTriangles(bad), /invalid vertex 500/);
});

test('HCC wagon: BuildComponents welds by position, joins through shared vertices, sorts by triangles then volume then centre x', () => {
  const m = syntheticWagon41214();
  const comps = buildComponents(m, readTriangles(m));
  assert.equal(comps.length, 5);
  assert.deepEqual(comps.map((c) => c.triangleIndices.length), [14, 10, 10, 7, 7]);
  assert.ok(comps[1].bounds.center[0] <= comps[2].bounds.center[0], 'equal wheels: the smaller centre x first');
  const p = identifyVerifiedParts(comps);
  assert.equal(p.body.triangleIndices.length, 14);
  assert.ok(p.wheelLeft.bounds.center[0] < 0 && p.wheelRight.bounds.center[0] > 0);
  assert.ok(p.wheelLeft.bounds.size[0] <= WHEEL_PLANARITY_TOLERANCE, 'the wheel is planar in X');
  // a welded seam: two vertices a nanometre apart are one
  const m2 = syntheticWagon41214();
  m2.positions[0] += 1e-6;
  assert.equal(buildComponents(m2, readTriangles(m2)).length, 5, 'a micro-gap still welds');
  const split = syntheticWagon41214({ splitBody: true });
  assert.equal(buildComponents(split, readTriangles(split)).length, 5, 'duplicate vertices a few microns apart weld into one component');
  assert.equal(buildComponents(split, readTriangles(split))[0].triangleIndices.length, 14, 'and the body keeps its fourteen');
  const nan = syntheticWagon41214(); nan.positions[1] = NaN;
  assert.throws(() => buildComponents(nan, readTriangles(nan)), /not finite/);
});

test('HCC wagon: IdentifyVerifiedParts refuses the wrong count, the wrong sizes and a wheel that is not planar', () => {
  const m = syntheticWagon41214();
  const comps = buildComponents(m, readTriangles(m));
  assert.throws(() => identifyVerifiedParts(comps.slice(0, 4)), /4 components instead of 5/);
  const wrong = comps.map((c) => ({ ...c, triangleIndices: c.triangleIndices.slice(0, 6) }));
  assert.throws(() => identifyVerifiedParts(wrong), /no longer match the verified topology/);
  const tilted = comps.map((c) => (c.triangleIndices.length === 10 ? { ...c, bounds: { ...c.bounds, size: [0.01, 1, 1] } } : c));
  assert.throws(() => identifyVerifiedParts(tilted), /no longer planar/);
});

test('HCC wagon: BuildComponentMesh renumbers in first-use order, re-bases on the pivot, and keeps one sub-mesh per source sub-mesh touched', () => {
  const m = syntheticWagon41214();
  const tris = readTriangles(m);
  const p = identifyVerifiedParts(buildComponents(m, tris));
  const wheel = buildComponentModel(m, tris, p.wheelLeft, p.wheelLeft.bounds.center, 'WheelLeft');
  assert.equal(wheel.name, 'TrailingWagon41214_WheelLeft');
  assert.equal(wheel.positions.length / 3, 11, 'the fan\'s eleven vertices, none duplicated');
  assert.equal(wheel.indices.length, 30);
  assert.equal(wheel.subMeshes.length, 1); assert.equal(wheel.subMeshes[0].textureArchive, 101);
  let maxR = 0; for (let i = 0; i < wheel.positions.length; i += 3) maxR = Math.max(maxR, Math.abs(wheel.positions[i]));
  assert.ok(maxR < 1e-6, 're-based on the pivot: every x is the pivot\'s');
  assert.equal(wheel.indices[0], 0, 'first-use order starts at 0');
  const body = buildComponentModel(m, tris, p.body, [0, 0, 0], 'Body');
  assert.equal(body.indices.length, 42); assert.equal(body.positions.length / 3, 10);
});

test('HCC wagon: TryBuild hands back the five pieces, the pivots at the wheels\' centres, the radius off their extents, the whole model\'s bounds', () => {
  const m = syntheticWagon41214();
  const parts = buildWagonParts(m);
  assert.deepEqual(Object.keys(parts).sort(), ['body', 'bounds', 'shaftLeft', 'shaftRight', 'wheelLeft', 'wheelLeftPivot', 'wheelRadius', 'wheelRight', 'wheelRightPivot'].sort());
  assert.ok(Math.abs(parts.wheelLeftPivot[0] + WHEEL_X) < 1e-6 && Math.abs(parts.wheelRightPivot[0] - WHEEL_X) < 1e-6);
  assert.ok(Math.abs(parts.wheelLeftPivot[1] - WHEEL_Y) < 1e-6 && Math.abs(parts.wheelLeftPivot[2] - WHEEL_Z) < 1e-6);
  const comps = buildComponents(m, readTriangles(m));
  const p = identifyVerifiedParts(comps);
  assert.ok(Math.abs(parts.wheelRadius - wheelRadiusOf(p.wheelLeft.bounds.size, p.wheelRight.bounds.size)) < 1e-9, 'CalculateWheelRadius');
  assert.ok(parts.wheelRadius > 0.4 && parts.wheelRadius < 0.5);
  assert.ok(parts.bounds.min[0] <= -WHEEL_X + 1e-6 && parts.bounds.max[0] >= WHEEL_X - 1e-6, 'the source mesh\'s bounds, wheels included');
  assert.throws(() => buildWagonParts(null), /did not provide its source mesh/);
  assert.throws(() => buildWagonParts(syntheticWagon41214({ vertexCount: 101 })), /topology changed \(vertices=101/);
  const noNormals = syntheticWagon41214(); noNormals.normals = new Float32Array(3);
  assert.throws(() => buildWagonParts(noNormals), /complete normals and UVs/);
  const fewer = syntheticWagon41214(); fewer.subMeshes[3].primitiveCount -= 1;
  assert.throws(() => buildWagonParts(fewer), /triangles=47/);
  const flat = syntheticWagon41214(); for (let i = 0; i < flat.positions.length; i += 3) if (Math.abs(flat.positions[i] - WHEEL_X) < 1e-6) flat.positions[i] += (i % 6) * 0.01;
  assert.throws(() => buildWagonParts(flat), /planar/);
});

test('HCC wagon: EnsureUsableBoundsSize widens any axis under 0.1 about its centre', () => {
  const b = usableBounds({ min: [-1, 0.5, -2], max: [1, 0.52, 2] });
  assert.deepEqual(b.min, [-1, 0.46, -2]); assert.deepEqual(b.max, [1, 0.56, 2]);
  const same = usableBounds({ min: [0, 0, 0], max: [1, 1, 1] });
  assert.deepEqual(same, { min: [0, 0, 0], max: [1, 1, 1] });
});

test('HCC wagon: the twelve cargo pieces by tier, their names, and the cumulative show', () => {
  assert.equal(CARGO_DEFINITIONS.length, 12);
  assert.deepEqual(CARGO_DEFINITIONS.map((d) => d.threshold), [25, 25, 50, 50, 50, 75, 75, 75, 90, 90, 90, 90]);
  assert.deepEqual(CARGO_DEFINITIONS.map((d) => d.modelId), [41815, 41815, 41817, 41821, 41822, 41824, 41825, 41826, 41827, 41828, 41829, 41830]);
  assert.equal(cargoPieceName(CARGO_DEFINITIONS[0], 0), 'Cargo_25_00_Model_41815');
  assert.equal(cargoPieceName(CARGO_DEFINITIONS[11], 3), 'Cargo_90_03_Model_41830');
  assert.equal(cargoPiecesShown(0).length, 0); assert.equal(cargoPiecesShown(25).length, 2); assert.equal(cargoPiecesShown(50).length, 5);
  assert.equal(cargoPiecesShown(75).length, 8); assert.equal(cargoPiecesShown(90).length, 12);
  assert.ok(Math.abs(CARGO_DEFINITIONS[10].scale[0] - 0.5192) < 1e-3, 'the one scaled piece');
  assert.ok(Object.isFrozen(CARGO_DEFINITIONS) && Object.isFrozen(CARGO_DEFINITIONS[0]));
});
