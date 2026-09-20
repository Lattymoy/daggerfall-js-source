// FBX -> THE PORT'S OWN MESH, baked once so the game never parses one.
//
//     node tools/fbxMesh.mjs <in.fbx> <out.json> [--name=X]
//                            [--forward=-z] [--up=-x]
//                            [--keep-rotation] [--no-normalise]
//
// FIELD-GUN-MW1 (2026-09-20, Mac: "texturing and rigging this for the
// morrowind model"). The reader's header says why an FBX is a source
// asset and not a runtime format; this file is the bake.
//
// ═══ WHAT IT BAKES INTO ═══════════════════════════════════════════
//
// THE SHAPE flattenNif ALREADY EMITS (src/formats/mwNifMesh.js:385-387:
// positions / normals / uvs / colors / indices / material). Not a
// second mesh format - the SAME one, because the Morrowind lane's whole
// downstream (the arm's attach chain, the renderer's batch draw) is
// written against that contract, and a mesh that arrives in it needs no
// new consumer at all. A JSON of flat number arrays is what a bake can
// write and `src/formats/portMesh.js` is what turns it back into typed
// arrays at load.
//
// ═══ THE FOUR THINGS THE BAKE ACTUALLY DOES ═══════════════════════
//
// 1. TRIANGULATES. FBX stores n-gons, flagged by a NEGATIVE last index
//    (the ones' complement) per polygon; Pellet_Shot is 5 triangles,
//    106 quads and 13 octagons. A batch is a triangle list by contract,
//    so the polygons are fanned. Fanning is correct for the convex
//    polygons a modelling package emits and WRONG for a concave one -
//    which is why a concave n-gon is REFUSED by name below rather than
//    quietly folded inside out.
//
// 2. WELDS THE CORNERS. Normals and UVs are ByPolygonVertex here: the
//    mesh has 199 positions and 543 corners, and a corner is a
//    (position, normal, uv) triple that a vertex buffer cannot share
//    across a hard edge or a UV seam. The weld is on the triple, so a
//    smooth run collapses and a seam does not - which is the whole
//    reason the corner count is not the vertex count.
//
// 3. BAKES THE SCALE, AND DROPS THE PLACEMENT. Blender exported this
//    object with its transform unapplied: Lcl Scaling 43.75/35.45/84.59
//    - NON-UNIFORM, so it is geometry and not a number a caller can
//    carry (flattenNif's own transform chain is uniform-scale by
//    construction), and a bolt scaled 8:1 along one axis is only that
//    shape once the scale is in the vertices. Lcl Rotation and Lcl
//    Translation are where the object SAT IN MAC'S SCENE, which the
//    game has no use for, so they are dropped - see the frame below.
//    Non-uniform scale does not survive into normals: those take the
//    INVERSE TRANSPOSE (1/sx, 1/sy, 1/sz) and are re-normalised, or an
//    8:1 stretch would tilt every lighting normal on the barrel.
//
// 4. PUTS IT IN A FRAME THE PORT CAN NAME. Morrowind's basis is +Y
//    forward, +Z up - the one the arm's attach math is written in
//    (src/combat/fpArm.js weaponRestSide) - and an exported object's
//    local axes are whatever the modeller's were. So the map is not
//    assumed, it is STATED: --forward and --up name which two
//    Blender-local axes become the port's, and the third falls out of
//    the cross product, which is also what makes a mirrored pair of
//    choices impossible to write by accident.
//
//    THE DEFAULT IS MEASURED, NOT GUESSED. Pellet_Shot's local Z is
//    its LENGTH (17.5 units against 9.2 and 5.2, and x84.6 of scale on
//    top) and its local X its HEIGHT. The two SIGNS are the half that
//    an eye settles and arithmetic does not, so both were settled
//    against the model: sliced along its long axis, one half is a
//    uniform 0.12 x 0.14 tube for its whole length and the other
//    carries everything 0.21 and 0.26 deep - a barrel and a receiver,
//    so FORWARD is -Z, away from the bulk. Then -X up, because it is
//    the one of the two that renders as a firearm the right way up
//    (tools/meshSheets.mjs --preview): grip down and back, sight on
//    top. A model authored along different axes says so on the command
//    line rather than shipping upside down.
//
//    Then the mesh is CENTRED on its own bounds and scaled so its
//    longest axis is exactly 1, so the port sizes it with ONE number
//    and the day Mac re-exports at a different scale nothing
//    downstream moves.
//
// THE SOURCE IS NOT COMMITTED, exactly as tools/gunPaperdoll.mjs's
// PNGs are not: scratch/ is ignored, Mac keeps his .blend, and what
// ships is the bake. `--keep-rotation` exists for the day an asset IS
// authored in place and its scene rotation is the answer.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx, nodeAt, childNamed, childrenNamed, property70, objectName } from './fbxRead.mjs';

/** Euler degrees -> a 3x3, in FBX's default eOrderXYZ, which composes
 *  R = Rz * Ry * Rx (the X rotation is applied to the vector first). */
export function eulerXYZ([rx, ry, rz]) {
  const d = Math.PI / 180;
  const [sx, cx] = [Math.sin(rx * d), Math.cos(rx * d)];
  const [sy, cy] = [Math.sin(ry * d), Math.cos(ry * d)];
  const [sz, cz] = [Math.sin(rz * d), Math.cos(rz * d)];
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
}
const apply3 = (m, [x, y, z]) => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];

/** An axis token (+z, -x, y, ...) as a unit vector. */
export function axisVector(token) {
  const m = /^([+-]?)([xyz])$/.exec(String(token).trim().toLowerCase());
  if (!m) throw new Error(`"${token}" is not an axis: expected one of +x -x +y -y +z -z`);
  const v = [0, 0, 0];
  v['xyz'.indexOf(m[2])] = m[1] === '-' ? -1 : 1;
  return v;
}

/**
 * THE BASIS, built from the two axes the caller names.
 *
 * `forward` is the Blender-local axis that is to become Morrowind's +Y
 * and `up` the one that is to become its +Z; the third column is their
 * CROSS PRODUCT rather than a third argument, which is what keeps the
 * result a rotation. Two axes that are not perpendicular - or the same
 * axis twice - is a frame that does not exist, and it is refused here
 * rather than producing a sheared mesh.
 *
 * Returns the map itself: local (x, y, z) -> the port's basis.
 */
export function basisMap(forward = '-z', up = '-x') {
  const f = axisVector(forward);
  const u = axisVector(up);
  const dot = f[0] * u[0] + f[1] * u[1] + f[2] * u[2];
  if (Math.abs(dot) > 1e-9) throw new Error(`--forward=${forward} and --up=${up} are not perpendicular`);
  // right = forward x up, so (right, forward, up) is right-handed and
  // the mesh cannot come out mirrored.
  const r = [
    f[1] * u[2] - f[2] * u[1],
    f[2] * u[0] - f[0] * u[2],
    f[0] * u[1] - f[1] * u[0],
  ];
  // A vector's component along each named axis IS its coordinate in
  // the new basis: x from right, y from forward, z from up.
  return ([x, y, z]) => [
    r[0] * x + r[1] * y + r[2] * z,
    f[0] * x + f[1] * y + f[2] * z,
    u[0] * x + u[1] * y + u[2] * z,
  ];
}

/** The default: Pellet_Shot's own axes, measured (see the header). */
export const toMwBasis = basisMap('-z', '-x');

/**
 * THE POLYGONS, from FBX's ones'-complement run encoding. The last
 * index of every polygon is stored as ~i, so a polygon's end is found
 * rather than counted - and a file whose final index is NOT negative is
 * truncated, which is an error and not a polygon.
 */
export function polygonsOf(polygonVertexIndex) {
  const polys = [];
  let cur = [];
  for (const raw of polygonVertexIndex) {
    if (raw < 0) { cur.push(~raw); polys.push(cur); cur = []; } else cur.push(raw);
  }
  if (cur.length) throw new Error('PolygonVertexIndex does not end on a closed polygon - the file is truncated');
  return polys;
}

/** A layer element's value for corner `c`, honouring the two mapping
 *  modes Blender writes. ByPolygonVertex indexes by corner;
 *  ByVertice/ByVertex indexes by the corner's POSITION, which is a
 *  different number and the one this would silently read wrong. */
function layerReader(layer, stride, valueKey, indexKey) {
  if (!layer) return null;
  const values = childNamed(layer, valueKey)?.props[0];
  if (!values) return null;
  const map = childNamed(layer, 'MappingInformationType')?.props[0];
  const ref = childNamed(layer, 'ReferenceInformationType')?.props[0];
  const idx = childNamed(layer, indexKey)?.props[0] ?? null;
  if (map !== 'ByPolygonVertex' && map !== 'ByVertice' && map !== 'ByVertex') {
    throw new Error(`${valueKey}: MappingInformationType ${map} is not supported (need ByPolygonVertex or ByVertice)`);
  }
  if (ref !== 'Direct' && ref !== 'IndexToDirect') {
    throw new Error(`${valueKey}: ReferenceInformationType ${ref} is not Direct or IndexToDirect`);
  }
  if (ref === 'IndexToDirect' && !idx) throw new Error(`${valueKey}: IndexToDirect with no ${indexKey}`);
  const byVertex = map !== 'ByPolygonVertex';
  return (corner, position) => {
    const key = byVertex ? position : corner;
    const at = (ref === 'IndexToDirect' ? idx[key] : key) * stride;
    const out = new Array(stride);
    for (let k = 0; k < stride; k++) out[k] = values[at + k];
    return out;
  };
}

/**
 * Bake one Geometry/Model pair out of a parsed FBX tree.
 * Pure: bytes in, numbers out, nothing touched on disk.
 */
export function bakeMesh(tree, { name = null, keepRotation = false, normalise = true, forward = '-z', up = '-x' } = {}) {
  const toBasis = basisMap(forward, up);
  const objects = nodeAt(tree.nodes, 'Objects');
  if (!objects) throw new Error('no Objects section in this FBX');
  const geos = childrenNamed(objects, 'Geometry').filter((g) => g.props[2] === 'Mesh');
  if (geos.length !== 1) {
    // One mesh, on purpose. A multi-mesh FBX is a SCENE, and picking
    // one of them here would be this tool guessing which asset Mac
    // meant - the export is narrowed instead.
    throw new Error(`expected exactly one Mesh Geometry, found ${geos.length}: ${geos.map((g) => objectName(g.props[1])).join(', ')}`);
  }
  const geo = geos[0];
  const models = childrenNamed(objects, 'Model').filter((m) => m.props[2] === 'Mesh');
  const model = models[0] ?? null;

  const positions = childNamed(geo, 'Vertices')?.props[0];
  const pvi = childNamed(geo, 'PolygonVertexIndex')?.props[0];
  if (!positions || !pvi) throw new Error('the Geometry carries no Vertices/PolygonVertexIndex');

  const normalLayer = childNamed(geo, 'LayerElementNormal');
  const uvLayer = childNamed(geo, 'LayerElementUV');
  const readNormal = layerReader(normalLayer, 3, 'Normals', 'NormalsIndex');
  const readUv = layerReader(uvLayer, 2, 'UV', 'UVIndex');

  // ── the object transform ──────────────────────────────────────────
  const scale = (model && property70(model, 'Lcl Scaling')) ?? [1, 1, 1];
  const rotation = (model && property70(model, 'Lcl Rotation')) ?? [0, 0, 0];
  const R = keepRotation ? eulerXYZ(rotation) : null;
  // The inverse transpose of a pure scale is its reciprocal - which is
  // why this is not just "apply the same matrix to the normal".
  const nScale = scale.map((s) => (s === 0 ? 0 : 1 / s));

  const placePosition = (p) => {
    let v = [p[0] * scale[0], p[1] * scale[1], p[2] * scale[2]];
    if (R) v = apply3(R, v);
    return toBasis(v);
  };
  const placeNormal = (n) => {
    let v = [n[0] * nScale[0], n[1] * nScale[1], n[2] * nScale[2]];
    if (R) v = apply3(R, v);
    v = toBasis(v);
    const len = Math.hypot(v[0], v[1], v[2]);
    return len > 1e-12 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
  };

  // ── triangulate and weld ──────────────────────────────────────────
  const polys = polygonsOf(pvi);
  const outPos = []; const outNrm = []; const outUv = []; const indices = [];
  const seen = new Map();
  let corner = 0;
  let ngons = 0;
  const cornerOf = (c, positionIndex) => {
    const n = readNormal ? readNormal(c, positionIndex) : null;
    const uv = readUv ? readUv(c, positionIndex) : null;
    // The weld key is the AUTHORED triple, before placement: two
    // corners that were one vertex in Blender are one here, and a hard
    // edge or a UV seam keeps its split. Rounded, because a float that
    // differs in its last bit is the same corner and an exact key would
    // leave a seam nobody authored.
    const key = `${positionIndex}|${n ? n.map((v) => v.toFixed(5)).join(',') : ''}|${uv ? uv.map((v) => v.toFixed(6)).join(',') : ''}`;
    const hit = seen.get(key);
    if (hit !== undefined) return hit;
    const at = outPos.length / 3;
    outPos.push(...placePosition(positions.slice(positionIndex * 3, positionIndex * 3 + 3)));
    if (n) outNrm.push(...placeNormal(n));
    if (uv) outUv.push(uv[0], uv[1]);
    seen.set(key, at);
    return at;
  };

  for (const poly of polys) {
    const base = corner;
    corner += poly.length;
    if (poly.length < 3) throw new Error(`a polygon with ${poly.length} corners is not a face`);
    if (poly.length > 4) ngons++;
    // FAN from corner 0. Correct for convex; refused below if not.
    const ring = poly.map((p, i) => cornerOf(base + i, p));
    for (let i = 1; i + 1 < ring.length; i++) indices.push(ring[0], ring[i], ring[i + 1]);
    if (poly.length > 3) assertConvex(poly, base, positions, placePosition);
  }

  if (outPos.length / 3 > 65535) throw new Error(`${outPos.length / 3} vertices will not fit a Uint16 index buffer`);

  // ── the frame: centre on bounds, longest axis to 1 ────────────────
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < outPos.length; i += 3) {
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], outPos[i + k]); max[k] = Math.max(max[k], outPos[i + k]); }
  }
  const centre = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  const size = [0, 1, 2].map((k) => max[k] - min[k]);
  const longest = Math.max(...size);
  const unit = normalise && longest > 0 ? 1 / longest : 1;
  for (let i = 0; i < outPos.length; i += 3) {
    for (let k = 0; k < 3; k++) outPos[i + k] = (outPos[i + k] - centre[k]) * unit;
  }

  const round = (a, n) => a.map((v) => +v.toFixed(n));
  return {
    name: name ?? objectName(geo.props[1]) ?? 'mesh',
    // The record of what was baked, so a re-bake that differs is
    // VISIBLE in the diff rather than merely a wall of new floats.
    bake: {
      tool: 'tools/fbxMesh.mjs',
      fbxVersion: tree.version,
      creator: nodeAt(tree.nodes, 'Creator')?.props[0] ?? childNamed(tree.nodes, 'Creator')?.props[0] ?? null,
      sourceVertices: positions.length / 3,
      sourceCorners: pvi.length,
      polygons: polys.length,
      ngons,
      appliedScale: round(scale, 6),
      droppedRotation: keepRotation ? null : round(rotation, 6),
      basis: `Morrowind (+Y forward, +Z up), from local forward=${forward} up=${up}`,
      // In the mesh's OWN units after the scale bake, before the unit
      // divide: what one unit of the shipped mesh is worth.
      sizeBeforeNormalise: round(size, 4),
      unitDivisor: +(1 / unit).toFixed(6),
    },
    // Bounds AFTER the frame, which is what a consumer places against.
    bounds: { min: round([0, 1, 2].map((k) => (min[k] - centre[k]) * unit), 6), max: round([0, 1, 2].map((k) => (max[k] - centre[k]) * unit), 6) },
    positions: round(outPos, 6),
    normals: outNrm.length ? round(outNrm, 6) : null,
    uvs: outUv.length ? round(outUv, 6) : null,
    indices,
  };
}

/**
 * A FAN IS ONLY A TRIANGULATION OF A CONVEX POLYGON. For a concave one
 * it emits triangles outside the face and leaves a hole - visible as a
 * shard of geometry sticking out of the model, which is exactly the
 * bug somebody would spend an afternoon on. So the fan states its
 * precondition: every corner turns the same way about the polygon's
 * own plane normal.
 */
function assertConvex(poly, base, positions, place) {
  const pts = poly.map((p) => place(positions.slice(p * 3, p * 3 + 3)));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Newell's normal: right for a polygon that is not perfectly planar,
  // where any single corner's cross product may be noise.
  const nrm = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    nrm[0] += (a[1] - b[1]) * (a[2] + b[2]);
    nrm[1] += (a[2] - b[2]) * (a[0] + b[0]);
    nrm[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const scaleN = Math.hypot(...nrm);
  if (scaleN < 1e-9) return;   // degenerate; the fan cannot make it worse
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length]; const c = pts[(i + 2) % pts.length];
    const turn = dot(cross(sub(b, a), sub(c, b)), nrm) / scaleN;
    // Tolerance scaled to the polygon, so a big face's rounding noise
    // is not a reflex corner and a small face's real notch still is.
    if (turn < -1e-6 * scaleN) {
      throw new Error(`a ${poly.length}-gon at corner ${base} is CONCAVE - a fan would tear it. Triangulate it in Blender before exporting.`);
    }
  }
}

// ── the CLI ───────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const flag = (k) => args.includes(`--${k}`);
  const opt = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length !== 2) {
    console.error('usage: node tools/fbxMesh.mjs <in.fbx> <out.json> [--name=X] [--forward=-z] [--up=-x] [--keep-rotation] [--no-normalise]');
    process.exit(2);
  }
  const [inPath, outPath] = files;
  const mesh = bakeMesh(readFbx(readFileSync(inPath)), {
    name: opt('name'), keepRotation: flag('keep-rotation'), normalise: !flag('no-normalise'),
    forward: opt('forward', '-z'), up: opt('up', '-x'),
  });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(mesh)}\n`);
  const b = mesh.bake;
  console.log(`${inPath} -> ${outPath}`);
  console.log(`  ${mesh.name}: ${b.polygons} polygons (${b.ngons} n-gons) -> ${mesh.indices.length / 3} triangles`);
  console.log(`  ${b.sourceCorners} corners welded to ${mesh.positions.length / 3} vertices`);
  console.log(`  scale ${b.appliedScale.join(' x ')} baked; size ${b.sizeBeforeNormalise.join(' x ')} / ${b.unitDivisor} -> longest axis 1`);
  console.log(`  ${b.basis}`);
  console.log(`  bounds ${JSON.stringify(mesh.bounds.min)} .. ${JSON.stringify(mesh.bounds.max)}`);
}
