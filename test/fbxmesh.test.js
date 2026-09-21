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
// nobody can change to ask a new question. `writeFbx` below is forty
// lines of the same container tools/fbxRead.mjs reads, so the pin
// drives the reader against bytes this file's own reader wrote: if the
// two ever disagree about the format, one of them is wrong and the
// suite says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFbx, nodeAt, childNamed, objectName, property70, FBX_MAGIC } from '../tools/fbxRead.mjs';
import { bakeMesh, polygonsOf, eulerXYZ, basisMap, axisVector } from '../tools/fbxMesh.mjs';

// ── a minimal binary-FBX writer, for fixtures only ───────────────────
const S = (v) => ({ t: 'S', v });
const D = (v) => ({ t: 'D', v });
const I = (v) => ({ t: 'I', v });
const dArr = (v) => ({ t: 'd', v });
const iArr = (v) => ({ t: 'i', v });

function encodeProp(p) {
  const head = Buffer.from(p.t, 'latin1');
  if (p.t === 'S') {
    const s = Buffer.from(p.v, 'latin1');
    const n = Buffer.alloc(4); n.writeUInt32LE(s.length);
    return Buffer.concat([head, n, s]);
  }
  if (p.t === 'D') { const b = Buffer.alloc(8); b.writeDoubleLE(p.v); return Buffer.concat([head, b]); }
  if (p.t === 'I') { const b = Buffer.alloc(4); b.writeInt32LE(p.v); return Buffer.concat([head, b]); }
  const wide = p.t === 'd';
  const body = Buffer.alloc(p.v.length * (wide ? 8 : 4));
  p.v.forEach((x, i) => (wide ? body.writeDoubleLE(x, i * 8) : body.writeInt32LE(x, i * 4)));
  const meta = Buffer.alloc(12);
  meta.writeUInt32LE(p.v.length, 0); meta.writeUInt32LE(0, 4); meta.writeUInt32LE(body.length, 8);   // encoding 0 = raw
  return Buffer.concat([head, meta, body]);
}

/** One node at a known absolute start offset; endOffset is absolute,
 *  which is why this cannot be built bottom-up without one. */
function encodeNode(node, start) {
  const name = Buffer.from(node.name, 'latin1');
  const props = (node.props ?? []).map(encodeProp);
  const propBytes = Buffer.concat(props);
  const headLen = 13 + name.length;
  let at = start + headLen + propBytes.length;
  const kids = [];
  for (const c of node.children ?? []) { const b = encodeNode(c, at); kids.push(b); at += b.length; }
  if (kids.length) at += 13;   // the null record that closes a child list
  const head = Buffer.alloc(headLen);
  head.writeUInt32LE(at, 0);
  head.writeUInt32LE(props.length, 4);
  head.writeUInt32LE(propBytes.length, 8);
  head.writeUInt8(name.length, 12);
  name.copy(head, 13);
  return Buffer.concat([head, propBytes, ...kids, ...(kids.length ? [Buffer.alloc(13)] : [])]);
}

function writeFbx(roots, version = 7400) {
  const header = Buffer.alloc(27);
  header.write(FBX_MAGIC, 0, 'latin1');
  header.writeUInt8(0x1a, 20); header.writeUInt8(0x00, 21);
  header.writeUInt32LE(version, 23);
  const out = [header];
  let at = header.length;
  for (const r of roots) { const b = encodeNode(r, at); out.push(b); at += b.length; }
  out.push(Buffer.alloc(13));
  return Buffer.concat(out);
}

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

function fixture({ positions = VERTS, pvi = PVI, scale = SCALE, rotation = [10, 20, 30],
  uvIndex = UVIDX, normalIndex = null } = {}) {
  const nIdx = normalIndex ?? (pvi === PVI ? NORMIDX : pvi.map(() => 0));
  return writeFbx([
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
          ] },
        { name: 'Model',
          props: [I(2), S('Fixture\u0000\u0001Model'), S('Mesh')],
          children: [
            { name: 'Properties70',
              children: [
                { name: 'P', props: [S('Lcl Translation'), S('Lcl Translation'), S(''), S('A'), D(-179), D(-31), D(-31)] },
                { name: 'P', props: [S('Lcl Rotation'), S('Lcl Rotation'), S(''), S('A'), D(rotation[0]), D(rotation[1]), D(rotation[2])] },
                { name: 'P', props: [S('Lcl Scaling'), S('Lcl Scaling'), S(''), S('A'), D(scale[0]), D(scale[1]), D(scale[2])] },
              ] },
          ] },
      ] },
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

test('FIELD-GUN-MW1: a CONCAVE n-gon is refused, because a fan would tear it', () => {
  // A dart: A(0,0) B(3,0) C(1,1) D(0,3), whose C corner is reflex. A
  // fan from A emits triangle A-C-D, which lies OUTSIDE the face - the
  // shard of stray geometry that is invisible in a diff and obvious
  // on screen.
  const bad = fixture({
    positions: [0, 0, 0, 3, 0, 0, 1, 1, 0, 0, 3, 0],
    pvi: [0, 1, 2, ~3],
    scale: [1, 1, 1],
    uvIndex: [0, 1, 2, 3],
  });
  assert.throws(() => bakeMesh(readFbx(bad)), /CONCAVE/);
  // ...and the same four corners wound convexly are fine, so the pin
  // is about the SHAPE and not about n-gons in general.
  const good = fixture({
    positions: [0, 0, 0, 3, 0, 0, 3, 3, 0, 0, 3, 0],
    pvi: [0, 1, 2, ~3],
    scale: [1, 1, 1],
    uvIndex: [0, 1, 2, 3],
  });
  assert.equal(bakeMesh(readFbx(good)).indices.length / 3, 2);
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
