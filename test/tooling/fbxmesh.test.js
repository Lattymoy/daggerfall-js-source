// FIELD-GUN-MW1: THE FBX BAKE, PINNED.
//
// tools/fbxMesh.mjs turns Mac's Blender export into the shape
// flattenNif already emits, and its four jobs (triangulate, weld,
// bake the scale, land in the port's basis) are each a place a wrong
// answer looks plausible on screen: a fanned concave n-gon is a shard,
// a scale applied to a normal is a tilted highlight, a missed weld is
// a seam, a dropped axis map is a bolt flying sideways.
//
// THE FIXTURE IS WRITTEN HERE, not recorded. A committed .fbx would be
// a blob nobody can read in a diff, and - worse - a pin whose input
// nobody can change to ask a new question. `writeFbx`
// (tools/fbxWrite.mjs, this file's own writer until EG6c's reference
// hero fragment and the MW-FOLK1 audit's cut pins needed it too) is forty lines of the same container
// tools/fbxRead.mjs reads, so the pin drives the reader against bytes
// the writer wrote: if the two ever disagree about the format, one of
// them is wrong and the suite says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFbx, nodeAt, childNamed, objectName, property70 } from '../../tools/fbxRead.mjs';
import { bakeMesh, objectMaterials, polygonsOf, eulerXYZ, basisMap, axisVector, earClip, isConvexPolygon } from '../../tools/fbxMesh.mjs';
import { S, D, I, dArr, iArr, writeFbx } from '../../tools/fbxWrite.mjs';   // the writer, one home

// ── the fixture mesh ─────────────────────────────────────────────────
//
// Five positions in the modeller's local space: a quad and two
// triangles over them. Small enough that every expected number below
// is arithmetic a reader can redo.
//
//   v3(0,0,2) ---- v2(1,0,2)
//      |    quad    |  \  tri1
//   v0(0,0,0) ---- v1(1,0,0) ---- v4(2,0,0)     (tri2 = v3,v2,v4)
//
// THE WELD IS THE WHOLE POINT of the layer indices below, and it has
// to be asked so that EACH of the triple's three parts is load-bearing
// - a fixture where two of them never vary lets a key that drops one
// pass, which is exactly what a campaign caught here:
//
//   v1 (corners 1, 4)     same normal, same uv   -> WELDS
//   v3 (corners 3, 7)     same normal, same uv   -> WELDS
//   v4 (corners 5, 9)     same normal, same uv   -> WELDS
//   v2 (corners 2, 6, 8)  6 differs by NORMAL,
//                         8 differs by UV        -> stays THREE
//
// 10 corners -> 7 vertices. Drop the normal from the key and it is 6;
// drop the uv and it is 6; drop the position and it collapses further;
// weld nothing and it is 10. Only the right key gives 7.
const VERTS = [0, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 2, 2, 0, 0];
const PVI = [0, 1, 2, ~3, 1, 4, ~2, 3, 2, ~4];
//                        ^ quad      ^ tri1     ^ tri2
// NORMAL[0] is NOT axis-aligned, so the inverse transpose is visible.
const NORMAL = [0.6, 0.8, 0, 0, 0, 1];
const NORMIDX = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const UVS = [0, 0, 1, 0, 1, 1, 0, 1, 0.5, 0.5];
const UVIDX = [0, 1, 2, 3, 1, 0, 2, 3, 4, 0];
const SCALE = [2, 3, 5];

// MW-BRIG1: `translation`, `modelProps` (extra Properties70 rows on the
// Model), `globals` (GlobalSettings rows, as [name, value]) and
// `connections` (C rows) exist for the scene placement's questions.
const P70 = (name, ...v) => ({ name: 'P', props: [S(name), S(name), S(''), S('A'), ...v.map((x) => (typeof x === 'number' ? D(x) : x))] });
function fixture({ positions = VERTS, pvi = PVI, scale = SCALE, rotation = [10, 20, 30],
  uvIndex = UVIDX, normalIndex = null, translation = [-179, -31, -31], modelProps = [], globals = null, connections = null,
  materials = null, objects = [] } = {}) {   // MW-HEADS1 (AUDIT): `materials` { map, ids } a LayerElementMaterial; `objects` more records
  const nIdx = normalIndex ?? (pvi === PVI ? NORMIDX : pvi.map(() => 0));
  return writeFbx([
    ...(globals ? [{ name: 'GlobalSettings', children: [{ name: 'Properties70', children: globals.map(([k, v]) => ({ name: 'P', props: [S(k), S('int'), S('Integer'), S(''), Number.isInteger(v) ? I(v) : D(v)] })) }] }] : []),
    { name: 'Objects',
      children: [
        { name: 'Geometry',
          props: [I(1), S('Fixture\u0000\u0001Geometry'), S('Mesh')],
          children: [
            { name: 'Vertices', props: [dArr(positions)] },
            { name: 'PolygonVertexIndex', props: [iArr(pvi)] },
            { name: 'LayerElementNormal',
              props: [I(0)],
              children: [
                { name: 'MappingInformationType', props: [S('ByPolygonVertex')] },
                { name: 'ReferenceInformationType', props: [S('IndexToDirect')] },
                { name: 'Normals', props: [dArr(NORMAL)] },
                { name: 'NormalsIndex', props: [iArr(nIdx)] },
              ] },
            { name: 'LayerElementUV',
              props: [I(0)],
              children: [
                { name: 'MappingInformationType', props: [S('ByPolygonVertex')] },
                { name: 'ReferenceInformationType', props: [S('IndexToDirect')] },
                { name: 'UV', props: [dArr(UVS)] },
                { name: 'UVIndex', props: [iArr(uvIndex)] },
              ] },
            ...(materials ? [{ name: 'LayerElementMaterial',
              props: [I(0)],
              children: [
                { name: 'MappingInformationType', props: [S(materials.map)] },
                { name: 'ReferenceInformationType', props: [S('IndexToDirect')] },
                { name: 'Materials', props: [iArr(materials.ids)] },
              ] }] : []),
          ] },
        { name: 'Model',
          props: [I(2), S('Fixture\u0000\u0001Model'), S('Mesh')],
          children: [
            { name: 'Properties70',
              children: [
                { name: 'P', props: [S('Lcl Translation'), S('Lcl Translation'), S(''), S('A'), D(translation[0]), D(translation[1]), D(translation[2])] },
                { name: 'P', props: [S('Lcl Rotation'), S('Lcl Rotation'), S(''), S('A'), D(rotation[0]), D(rotation[1]), D(rotation[2])] },
                { name: 'P', props: [S('Lcl Scaling'), S('Lcl Scaling'), S(''), S('A'), D(scale[0]), D(scale[1]), D(scale[2])] },
                ...modelProps,
              ] },
          ] },
        ...objects,
      ] },
    ...(connections ? [{ name: 'Connections', children: connections.map((c) => ({ name: 'C', props: [S(c[0]), I(c[1]), I(c[2]), ...(c[3] ? [S(c[3])] : [])] })) }] : []),
  ]);
}

const near = (got, want, eps, what) =>
  assert.ok(Math.abs(got - want) <= eps, `${what}: expected ${want}, got ${got}`);

test('FIELD-GUN-MW1: the reader reads back what the writer wrote, records and arrays alike', () => {
  const tree = readFbx(fixture());
  assert.equal(tree.version, 7400);
  const geo = nodeAt(tree.nodes, 'Objects', 'Geometry');
  assert.ok(geo, 'the Objects/Geometry path resolves');
  // The embedded NUL is REAL - an FBX object name is "Name\0\x01Class"
  // - and a reader that stopped at it would hand every consumer a
  // truncated string that still looks like a name.
  assert.equal(geo.props[1], 'Fixture\u0000\u0001Geometry');
  assert.equal(objectName(geo.props[1]), 'Fixture');
  assert.deepEqual(childNamed(geo, 'Vertices').props[0], VERTS);
  assert.deepEqual(childNamed(geo, 'PolygonVertexIndex').props[0], PVI);
  const model = nodeAt(tree.nodes, 'Objects', 'Model');
  assert.deepEqual(property70(model, 'Lcl Scaling'), SCALE);
  assert.equal(property70(model, 'Lcl Nothing'), null, 'a row that is not there is null, not a throw');
});

test('FIELD-GUN-MW1: an ASCII FBX is refused BY NAME, not mis-read as binary', () => {
  // The failure this exists to stop: an ASCII export read as binary
  // does not crash, it produces an empty mesh - and an empty mesh is a
  // weapon that silently does not draw.
  const ascii = Buffer.from('; FBX 7.4.0 project file\n; ------------------\n', 'latin1');
  assert.throws(() => readFbx(ascii), /ASCII FBX.*re-export/s);
  assert.throws(() => readFbx(Buffer.alloc(64)), /not an FBX/);
});

test("FIELD-GUN-MW1: the ones'-complement run encoding is where a polygon ENDS", () => {
  assert.deepEqual(polygonsOf([0, 1, 2, ~3, 1, 4, ~2]), [[0, 1, 2, 3], [1, 4, 2]]);
  assert.deepEqual(polygonsOf([0, 1, ~2]), [[0, 1, 2]]);
  // ~0 is -1, which is the trap: a polygon ending on vertex 0 is a
  // NEGATIVE index whose complement is a perfectly valid vertex, so a
  // reader that tested `i === -1` for "end" and `i < 0` for "invalid"
  // would lose it. It is the terminator like any other.
  assert.deepEqual(polygonsOf([2, 1, -1]), [[2, 1, 0]]);
  // A run that never closes is a TRUNCATED FILE, not a polygon.
  assert.throws(() => polygonsOf([0, 1, 2]), /truncated/);
});

test('FIELD-GUN-MW1: n-gons are fanned, and the corners weld on the (position, normal, uv) TRIPLE', () => {
  const mesh = bakeMesh(readFbx(fixture()));
  assert.equal(mesh.bake.sourceCorners, 10);
  assert.equal(mesh.positions.length / 3, 7,
    'v1/v3/v4 collapse; v2 splits once on a hard edge and once on a UV seam');
  // A quad fans to 2 triangles and each triangle stays 1.
  assert.equal(mesh.bake.polygons, 3);
  assert.equal(mesh.indices.length / 3, 4);
  assert.equal(Math.max(...mesh.indices), 6, 'every index is inside the welded vertex buffer');
  assert.equal(mesh.uvs.length / 2, 7, 'one uv per welded vertex');
  assert.equal(mesh.normals.length / 3, 7, 'and one normal');
});

test('FIELD-GUN-MW1: the non-uniform scale is GEOMETRY, and its normals take the inverse transpose', () => {
  // Asked in the fixture's OWN axes rather than the Thunderlock's, so
  // the arithmetic below stays the one a reader can redo: local x is
  // right, local z is forward, local y is up.
  // Asked with local +Z forward and local +X up, so right = f x u is
  // local +Y and the map is (x, y, z) -> (y, z, x): all three
  // components move, and a map that lost one shows here.
  const mesh = bakeMesh(readFbx(fixture()), { forward: '+z', up: '+x' });
  // Positions: (x,y,z) * (2,3,5), then -> (y, z, x), then centred and
  // divided by the longest axis (10).
  //   v0 (0,0,0) -> (0,0,0)  -> (0,0,0)   -> (0, -0.5, -0.2)
  //   v4 (2,0,0) -> (4,0,0)  -> (0,0,4)   -> (0, -0.5,  0.2)
  //   v3 (0,0,2) -> (0,0,10) -> (0,10,0)  -> (0,  0.5, -0.2)
  assert.deepEqual(mesh.bounds.min, [0, -0.5, -0.2]);
  assert.deepEqual(mesh.bounds.max, [0, 0.5, 0.2]);
  near(mesh.bake.unitDivisor, 10, 1e-9, 'the longest axis was 10 before the unit divide');
  assert.deepEqual(mesh.bake.sizeBeforeNormalise, [0, 10, 4]);

  // THE NORMAL IS THE PIN. (0.6, 0.8, 0) under scale (2,3,5):
  //   inverse transpose -> (0.6/2, 0.8/3, 0) = (0.3, 0.26667, 0)
  //   normalise         -> (0.747409, 0.664364, 0)
  //   -> this basis     -> (0.664364, 0, 0.747409)
  // The WRONG answer - multiplying by the scale itself - is
  // (0.894427, 0, 0.447214), which is nowhere near, so this fails
  // under exactly the one-character slip it is aimed at.
  near(mesh.normals[0], 0.664364, 1e-5, 'normal x');
  near(mesh.normals[1], 0, 1e-9, 'normal y');
  near(mesh.normals[2], 0.747409, 1e-5, 'normal z');
  for (let i = 0; i < mesh.normals.length; i += 3) {
    near(Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]), 1, 1e-5, 'every normal is unit');
  }
});

test('FIELD-GUN-MW1: the basis is BUILT from the two named axes, and a frame that is not one is refused', () => {
  assert.deepEqual(axisVector('+z'), [0, 0, 1]);
  assert.deepEqual(axisVector('-x'), [-1, 0, 0]);
  assert.deepEqual(axisVector('y'), [0, 1, 0], 'a bare axis is positive');
  assert.throws(() => axisVector('w'), /not an axis/);

  // forward -> the port's +Y, up -> its +Z, and right is their CROSS
  // PRODUCT rather than a third argument. The Thunderlock's own map:
  // local -Z forward, local -X up, so right = (-Z) x (-X) = +Y... in
  // the port's x. Checked as a whole rather than as a formula.
  const tl = basisMap('-z', '-x');
  assert.deepEqual(tl([0, 0, -1]), [0, 1, 0], 'the muzzle end lands on +Y');
  assert.deepEqual(tl([-1, 0, 0]), [0, 0, 1], 'the top of the gun lands on +Z');
  // RIGHT-HANDED, always: a mirrored weapon is a bug that looks like
  // art until somebody reads the engraving backwards.
  //
  // ASKED OF THE THIRD AXIS DIRECTLY, because the obvious version of
  // this assertion is VACUOUS and a campaign proved it: crossing the
  // map's own images of forward and up recomputes f x u from f and u,
  // which the mirror mutant never touched, so it passed with the sign
  // flipped. The right column is the only thing that moved, so the
  // right column is what gets asked.
  //   right = forward x up = (0,0,-1) x (-1,0,0) = (0, 1, 0),
  // so it is LOCAL +Y that lands on the port's +X - and a flipped
  // cross product sends it to -X instead.
  assert.deepEqual(tl([0, 1, 0]), [1, 0, 0], 'local +Y is the gun\u2019s right, and lands on +X');
  assert.deepEqual(tl([0, -1, 0]), [-1, 0, 0]);

  // Two axes that do not make a frame are refused, not silently
  // sheared into one.
  assert.throws(() => basisMap('+z', '+z'), /not perpendicular/);
  assert.throws(() => basisMap('+z', '-z'), /not perpendicular/);
  // ...and the default IS the Thunderlock's, so a bake with no flags
  // is the same bake the tool's header describes.
  assert.deepEqual(basisMap()([0, 0, -1]), tl([0, 0, -1]));
});

test('FIELD-GUN-MW1: the scene PLACEMENT is dropped, and the basis is the one the port uses', () => {
  const plain = bakeMesh(readFbx(fixture()));
  // The rotation is recorded as dropped rather than silently ignored.
  assert.deepEqual(plain.bake.droppedRotation, [10, 20, 30]);
  assert.match(plain.bake.basis, /\+Y forward/);
  // ...and changing it changes NOTHING about the geometry, which is
  // what "dropped" has to mean. A bake that quietly applied it would
  // move every vertex here.
  const spun = bakeMesh(readFbx(fixture({ rotation: [90, 45, -17] })));
  assert.deepEqual(spun.positions, plain.positions);
  assert.deepEqual(spun.normals, plain.normals);
  // --keep-rotation is the other door, and it must actually differ -
  // an option that changes nothing is not an option.
  const kept = bakeMesh(readFbx(fixture({ rotation: [90, 0, 0] })), { keepRotation: true });
  assert.notDeepEqual(kept.positions, plain.positions);
  assert.equal(kept.bake.droppedRotation, null);
  // eulerXYZ is FBX's eOrderXYZ: R = Rz*Ry*Rx, so a 90-degree X
  // rotation takes +Y to +Z and not to -Z.
  const X90 = eulerXYZ([90, 0, 0]);
  near(X90[4], 0, 1e-9, 'y of Rx(90)*(0,1,0)');
  near(X90[7], 1, 1e-9, 'z of Rx(90)*(0,1,0)');
  // ONE AXIS CANNOT TELL THE TWO ORDERS APART - a campaign survivor
  // flipped R = Rz*Ry*Rx to Rx*Ry*Rz and passed, because with ry = rz
  // = 0 both compositions ARE Rx. Two axes at once is the question:
  //   XYZ (R = Rz*Ry*Rx):  Rx(90) takes +Y to +Z, then Ry(90) takes
  //                        +Z to +X  ->  (1, 0, 0)
  //   ZYX (R = Rx*Ry*Rz):  Ry(90) leaves +Y alone, then Rx(90) takes
  //                        it to +Z  ->  (0, 0, 1)
  const XY = eulerXYZ([90, 90, 0]);
  near(XY[1], 1, 1e-9, 'x of Rxy*(0,1,0) - eOrderXYZ, not ZYX');
  near(XY[4], 0, 1e-9, 'y of Rxy*(0,1,0)');
  near(XY[7], 0, 1e-9, 'z of Rxy*(0,1,0)');
});

test('MW-BRIG1: a CONCAVE n-gon is EAR-CLIPPED, because a fan would tear it', () => {
  // A dart: A(0,0) B(3,0) C(1,1) D(0,3), whose C corner is reflex.
  // Wound from B - B, C, D, A - a fan from B emits B-C-D, which lies
  // OUTSIDE the face across the dart's notch: the shard of stray
  // geometry that is invisible in a diff and obvious on screen.
  // (Wound from A the fan happens to be right, because A sees every
  // corner - so the fixture starts where it is wrong.)
  const dart = fixture({
    positions: [0, 0, 0, 3, 0, 0, 1, 1, 0, 0, 3, 0],
    pvi: [1, 2, 3, ~0],
    scale: [1, 1, 1],
    uvIndex: [0, 1, 2, 3],
  });
  const m = bakeMesh(readFbx(dart), { forward: '+y', up: '+z', normalise: false });
  assert.equal(m.bake.clipped, 1, 'the dart is clipped, not fanned');
  assert.equal(m.indices.length / 3, 2);
  // THE TRIANGULATION COVERS THE FACE EXACTLY: its triangles' areas sum
  // to the dart's (3 - the notch = 3 square units by the shoelace), a
  // fan's would be 4.5 with the outside shard counted in, and every
  // triangle keeps the polygon's winding (+Z here), so no face flips.
  const P = (i) => m.positions.slice(i * 3, i * 3 + 3);
  let area = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [P(m.indices[t]), P(m.indices[t + 1]), P(m.indices[t + 2])];
    const z = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    assert.ok(z > 0, `triangle ${t / 3} keeps the polygon's winding`);
    area += z / 2;
  }
  near(area, 3, 1e-9, 'the triangles cover the dart and nothing else');
  // ...and the reflex corner C is in both triangles: the only
  // diagonal inside a dart runs from its reflex corner.
  // (The object bake re-centres on the bounds, so C is found against
  // the anchor it recorded.)
  const [ax, ay] = m.bake.anchor;
  const cAt = m.positions.findIndex((_, i) => i % 3 === 0 && Math.abs(m.positions[i] + ax - 1) < 1e-9 && Math.abs(m.positions[i + 1] + ay - 1) < 1e-9) / 3;
  assert.ok(cAt >= 0, 'C is a vertex of the bake');
  assert.equal(m.indices.filter((i) => i === cAt).length, 2);

  // A CONVEX polygon still FANS, corner for corner - which is what
  // keeps every mesh that baked before on the bytes it had.
  const good = fixture({
    positions: [0, 0, 0, 3, 0, 0, 3, 3, 0, 0, 3, 0],
    pvi: [0, 1, 2, ~3],
    scale: [1, 1, 1],
    uvIndex: [0, 1, 2, 3],
  });
  const g = bakeMesh(readFbx(good));
  assert.equal(g.bake.clipped, 0);
  assert.deepEqual(g.indices, [0, 1, 2, 0, 2, 3]);

  // A polygon that CROSSES ITSELF - a bow tie - has no triangulation
  // to find, and is refused by name rather than folded.
  const tie = fixture({
    positions: [0, 0, 0, 2, 2, 0, 2, 0, 0, 0, 2, 0, 1, 3, 0],
    pvi: [0, 1, 2, 3, ~4],
    scale: [1, 1, 1],
    uvIndex: [0, 1, 2, 3, 4],
  });
  assert.throws(() => bakeMesh(readFbx(tie)), /crosses itself \(edges \d and \d\).*corner 0/);
});

test('MW-BRIG1: earClip on its own - a notched pentagon, every triangle inside', () => {
  // An arrow: its notch at (2,1) is the one reflex corner. n-2 triangles,
  // area 6 - 1 = 5 by the shoelace, all counter-clockwise.
  const pts = [[0, 0, 0], [4, 0, 0], [4, 2, 0], [2, 1, 0], [0, 2, 0]];
  const tris = earClip(pts);
  assert.equal(tris.length, 3);
  let area = 0;
  for (const [a, b, c] of tris) {
    const z = (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
    assert.ok(z > 0);
    area += z / 2;
  }
  near(area, 6, 1e-9, 'area');
  assert.equal(isConvexPolygon(pts), false);
  assert.equal(isConvexPolygon([[0, 0, 0], [4, 0, 0], [4, 2, 0], [0, 2, 0]]), true);
  // The same polygon wound the other way, and seen from below (-Z),
  // still clips - the projection follows the polygon's own normal.
  const flipped = pts.slice().reverse();
  assert.equal(earClip(flipped).length, 3);
});

test('MW-BRIG1: a SCENE placement keeps where the modeller put it, in the scene\'s own axes and units', () => {
  // Blender's own export, in miniature: Y-up FBX world, a centimetre
  // unit, and every object carrying Lcl Rotation -90 about X (the
  // Z-up-to-Y-up turn) and Lcl Scaling 100 (metres to centimetres).
  // The object sat 64 units up in the scene: translation (0, 6400, 0).
  const BLENDER = [['UpAxis', 1], ['UpAxisSign', 1], ['FrontAxis', 2], ['FrontAxisSign', 1],
    ['CoordAxis', 0], ['CoordAxisSign', 1], ['UnitScaleFactor', 1.0]];
  const src = fixture({ scale: [100, 100, 100], rotation: [-90, 0, 0], translation: [0, 6400, 0],
    globals: BLENDER, connections: [['OO', 2, 0], ['OO', 1, 2]] });
  const m = bakeMesh(readFbx(src), { placement: 'scene', forward: '+y', up: '+z' });
  // Every vertex comes back as it was in the SCENE: local + (0, 0, 64),
  // no normalise, no re-centre - v2 (1, 0, 2) is at (1, 0, 66).
  const P = (i) => m.positions.slice(i * 3, i * 3 + 3);
  const all = Array.from({ length: m.positions.length / 3 }, (_, i) => P(i));
  const v2 = all.find((p) => Math.abs(p[0] - 1) < 1e-6 && Math.abs(p[2] - 66) < 1e-6);
  assert.ok(v2, `v2 lands at (1, 0, 66): ${JSON.stringify(all)}`);
  near(m.bounds.min[2], 64, 1e-6, 'the lowest vertex, at the object origin');
  near(m.bounds.max[0], 2, 1e-6, 'v4 keeps its x: no normalise');
  assert.deepEqual(m.bake.sceneTranslation, [0, 0, 64]);
  assert.equal(m.bake.placement, 'scene');
  assert.equal(m.bake.origin, 'scene');
  // The normals come back in the scene too: NORMAL[1] is local +Z, which
  // the scene reads as +Z - not the FBX world's +Y it was exported as.
  const up = Array.from({ length: m.normals.length / 3 }, (_, i) => m.normals.slice(i * 3, i * 3 + 3))
    .filter((n) => Math.abs(n[2] - 1) < 1e-6);
  assert.ok(up.length > 0, 'a local +Z normal is a scene +Z normal');

  // THE BASIS STILL APPLIES ON TOP: facing the other way (forward -Y)
  // is a half turn about Z - x and y negate, height does not move.
  const turned = bakeMesh(readFbx(src), { placement: 'scene', forward: '-y', up: '+z' });
  for (let i = 0; i < m.positions.length; i += 3) {
    near(turned.positions[i], -m.positions[i], 1e-9, 'x');
    near(turned.positions[i + 1], -m.positions[i + 1], 1e-9, 'y');
    near(turned.positions[i + 2], m.positions[i + 2], 1e-9, 'z');
  }

  // THE UNIT IS READ, NOT ASSUMED: a file in metres (UnitScaleFactor
  // 100) whose object carries no 100 comes back the same size.
  const metres = fixture({ scale: [1, 1, 1], rotation: [-90, 0, 0], translation: [0, 64, 0],
    globals: BLENDER.map(([k, v]) => [k, k === 'UnitScaleFactor' ? 100.0 : v]) });
  const mm = bakeMesh(readFbx(metres), { placement: 'scene', forward: '+y', up: '+z' });
  for (let i = 0; i < m.positions.length; i++) near(mm.positions[i], m.positions[i], 1e-9, `metres ${i}`);

  // THE AXES ARE READ, NOT ASSUMED: a Z-up file (UpAxis 2) is already
  // the scene's frame, so the same geometry needs no -90 to land there.
  const zUp = fixture({ scale: [100, 100, 100], rotation: [0, 0, 0], translation: [0, 0, 6400],
    globals: [['UpAxis', 2], ['UpAxisSign', 1], ['CoordAxis', 0], ['CoordAxisSign', 1], ['UnitScaleFactor', 1.0]] });
  const mz = bakeMesh(readFbx(zUp), { placement: 'scene', forward: '+y', up: '+z' });
  for (let i = 0; i < m.positions.length; i++) near(mz.positions[i], m.positions[i], 1e-9, `z-up ${i}`);

  // The object placement is untouched by all this: it still drops the
  // placement and re-centres, exactly as FIELD-GUN-MW1 pinned.
  assert.equal(bakeMesh(readFbx(src)).bake.placement, 'object');
});

test('MW-BRIG1: a scene placement refuses a transform it cannot read whole', () => {
  // Parented: its Lcl transform is not its world transform.
  const child = fixture({ connections: [['OO', 2, 7]] });
  assert.throws(() => bakeMesh(readFbx(child), { placement: 'scene' }), /parented under object 7/);
  // A pivot: T*R*S is not the whole transform.
  const pivot = fixture({ modelProps: [P70('RotationPivot', 1, 0, 0)] });
  assert.throws(() => bakeMesh(readFbx(pivot), { placement: 'scene' }), /RotationPivot/);
  // An identity pivot is no pivot at all.
  assert.doesNotThrow(() => bakeMesh(readFbx(fixture({ modelProps: [P70('RotationPivot', 0, 0, 0)] })), { placement: 'scene' }));
  // A rotation order eulerXYZ does not compute.
  const zyx = fixture({ modelProps: [{ name: 'P', props: [S('RotationOrder'), S('enum'), S(''), S(''), I(5)] }] });
  assert.throws(() => bakeMesh(readFbx(zyx), { placement: 'scene' }), /RotationOrder 5/);
  assert.throws(() => bakeMesh(readFbx(fixture()), { placement: 'world' }), /not object or scene/);
});

test('FIELD-GUN-MW1: the bake refuses a SCENE, and refuses a mapping it cannot honour', () => {
  // Two meshes in one file is an export nobody narrowed, and picking
  // one would be this tool guessing which asset was meant.
  const two = writeFbx([{ name: 'Objects',
    children: [
      { name: 'Geometry', props: [I(1), S('A\u0000\u0001Geometry'), S('Mesh')], children: [
        { name: 'Vertices', props: [dArr(VERTS)] }, { name: 'PolygonVertexIndex', props: [iArr(PVI)] }] },
      { name: 'Geometry', props: [I(2), S('B\u0000\u0001Geometry'), S('Mesh')], children: [
        { name: 'Vertices', props: [dArr(VERTS)] }, { name: 'PolygonVertexIndex', props: [iArr(PVI)] }] },
    ] }]);
  assert.throws(() => bakeMesh(readFbx(two)), /exactly one Mesh Geometry, found 2: A, B/);

  // ByPolygon (per-face) is a mapping this bake does not implement, and
  // reading it as ByPolygonVertex would index the wrong array entirely
  // - a plausible-looking mesh with scrambled UVs.
  const odd = writeFbx([{ name: 'Objects', children: [
    { name: 'Geometry', props: [I(1), S('A\u0000\u0001Geometry'), S('Mesh')], children: [
      { name: 'Vertices', props: [dArr(VERTS)] },
      { name: 'PolygonVertexIndex', props: [iArr(PVI)] },
      { name: 'LayerElementUV', props: [I(0)], children: [
        { name: 'MappingInformationType', props: [S('ByPolygon')] },
        { name: 'ReferenceInformationType', props: [S('Direct')] },
        { name: 'UV', props: [dArr(UVS)] }] },
    ] }] }]);
  assert.throws(() => bakeMesh(readFbx(odd)), /ByPolygon is not supported/);
});

test('MW-HEADS1 (AUDIT): a bake of ONE material takes its polygons alone - per polygon or the whole object; a Geometry with no materials, another mapping and a list that is not one index a polygon are refused; a material\'s picture is its base colour\'s', () => {
  const mat = (map, ids) => readFbx(fixture({ materials: { map, ids } }));
  const take = (t, material) => { const m = bakeMesh(t, { material }); return [m.bake.polygons, m.positions.length / 3, m.indices.length]; };
  // the quad wears 1, the two triangles 0: the quad's four corners welded to four; the triangles' six to five (v2 split twice)
  assert.deepEqual(take(mat('ByPolygon', [1, 0, 0]), 1), [1, 4, 6]);
  assert.deepEqual(take(mat('ByPolygon', [1, 0, 0]), 0), [2, 5, 6]);
  assert.deepEqual(take(mat('AllSame', [0]), 0), [3, 7, 12], 'one material for the whole object: every polygon');
  assert.throws(() => bakeMesh(mat('AllSame', [0]), { material: 1 }), /no polygon of this object wears material 1/);
  assert.throws(() => bakeMesh(readFbx(fixture()), { material: 0 }), /carries no LayerElementMaterial - there is no material to bake alone/);
  assert.throws(() => bakeMesh(mat('ByVertice', [0, 0, 0, 0, 0]), { material: 0 }), /MappingInformationType ByVertice is not ByPolygon or AllSame/);
  assert.throws(() => bakeMesh(mat('ByPolygon', []), { material: 0 }), /carries no Materials/);
  // AUDIT MW-FOLK1 L1-F9: a short list read its missing polygons as no material's, dropped from every bake without a word
  assert.throws(() => bakeMesh(mat('ByPolygon', [1, 0]), { material: 0 }), /2 material indices for 3 polygons/);
  // the picture a material wears: its DiffuseColor texture, whatever else is connected first; its only one; none
  const tex = (id, file) => ({ name: 'Texture', props: [I(id), S(`T${id}\u0000\u0001Texture`), S('')], children: [{ name: 'RelativeFilename', props: [S(file)] }] });
  const material = (id) => ({ name: 'Material', props: [I(id), S(`M${id}\u0000\u0001Material`), S('')] });
  const scene = readFbx(fixture({
    objects: [material(10), material(11), material(12), tex(20, 'paint\\bump.png'), tex(21, 'paint\\colour.png'), tex(22, 'only.png')],
    connections: [['OO', 1, 2], ['OO', 10, 2], ['OO', 11, 2], ['OO', 12, 2], ['OP', 20, 10, 'NormalMap'], ['OP', 21, 10, 'DiffuseColor'], ['OP', 22, 11, 'SpecularColor']],
  }));
  assert.deepEqual(objectMaterials(scene, 'Fixture'), ['paint/colour.png', 'only.png', null]);
});
