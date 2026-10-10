// FBX -> THE PORT'S OWN MESH, baked once so the game never parses one.
//
//     node tools/fbxMesh.mjs <in.fbx> <out.json> [--name=X]
//                            [--forward=-z] [--up=-x]
//                            [--units=52.5] [--origin=centre|grip]
//                            [--keep-rotation] [--no-normalise]
//                            [--placement=object|scene]
//
// FIELD-GUN-MW1 (2026-09-20, Mac: "texturing and rigging this for the
// morrowind model"). The reader's header says why an FBX is a source
// asset and not a runtime format; this file is the bake.
//
// ═══ WHAT IT BAKES INTO ═══════════════════════════════════════════
//
// THE SHAPE flattenNif ALREADY EMITS (src/formats/mwNifMesh.js:"skinned:boolean,":
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
//    which is why a concave n-gon is never fanned.
//
//    MW-BRIG1 (2026-09-29, Mac's steel brigandine): IT IS EAR-CLIPPED
//    INSTEAD. The first cut REFUSED a concave n-gon ("triangulate it in
//    Blender"), and the brigandine carries six - three mirrored pairs
//    round its front clasps, a quad and a pentagon each, real notches
//    and not rounding noise. Blender draws those faces by ear-clipping
//    them, so an ear clip is the triangulation the modeller SAW, and
//    asking him to re-export is asking him to do by hand what the file
//    already says. A convex polygon still FANS, corner for corner as it
//    always did - so every mesh that baked before bakes to the same
//    bytes (test/fieldgunmw.test.js holds the Thunderlock to that) -
//    and only a polygon no ear clip can resolve, one that crosses
//    itself, is refused.
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
//    Then the mesh is scaled so its longest axis is exactly `--units`
//    long - so the day Mac re-exports at a different Blender scale
//    nothing downstream moves - and moved so `--origin` sits at zero.
//
//    BOTH OF THOSE ARE RIGGING, not bookkeeping, and the first bake got
//    both wrong. Morrowind is 69.99 units to the metre
//    (MW_UNITS_PER_METER), so a mesh normalised to a longest axis of 1
//    is a gun ONE AND A HALF CENTIMETRES long - invisible in the hand.
//    And `centre` puts the MIDDLE of the weapon on the bone, so the
//    hand closes around the receiver rather than the grip. `grip` is
//    derived, not typed: the centroid of the rearmost band of the long
//    axis, which is the part a hand actually holds.
//
// ═══ OBJECT OR SCENE ═══════════════════════════════════════════════
//
// `--placement=object` is everything above: the object's own shape,
// its scene placement dropped, framed and normalised by the bake. It
// is right for a thing that is HELD - a gun is placed by the hand that
// grips it, not by where it sat in Blender.
//
// `--placement=scene` (MW-BRIG1) is the other kind of asset: a thing
// that is WORN, fitted onto the Morrowind body in Mac's scene, where
// WHERE IT SITS IS THE AUTHORING. The whole object transform is kept
// (translation, rotation, scale - FBX's T*R*S), the file's own axis
// system is read out of GlobalSettings rather than assumed, and the
// scene's units are kept: 1 Blender unit is what the scene measured
// in, which for a scene built on an imported Morrowind body is one
// Morrowind unit. Nothing is normalised and nothing is re-centred - a
// cuirass that moved to its bounds centre would sit at the feet.
//
// THE SOURCE IS NOT COMMITTED, exactly as tools/gunPaperdoll.mjs's
// PNGs are not: scratch/ is ignored, Mac keeps his .blend, and what
// ships is the bake. `--keep-rotation` exists for the day an asset IS
// authored in place and its scene rotation is the answer.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx, nodeAt, childNamed, childrenNamed, property70, objectName } from './fbxRead.mjs';
import { isMain } from './lib/isMain.mjs';

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

/** Newell's normal of a polygon: right for one that is not perfectly
 *  planar, where any single corner's cross product may be noise. Its
 *  length is twice the polygon's area. */
function newellNormal(pts) {
  const nrm = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    nrm[0] += (a[1] - b[1]) * (a[2] + b[2]);
    nrm[1] += (a[2] - b[2]) * (a[0] + b[0]);
    nrm[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nrm;
}

/**
 * A FAN IS ONLY A TRIANGULATION OF A CONVEX POLYGON: every corner must
 * turn the same way about the polygon's own plane normal. A degenerate
 * polygon (no area to have a normal) counts as convex - a fan cannot
 * make it worse, and there is nothing an ear clip could orient by.
 */
export function isConvexPolygon(pts) {
  const nrm = newellNormal(pts);
  const scaleN = Math.hypot(...nrm);
  if (scaleN < 1e-9) return true;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length]; const c = pts[(i + 2) % pts.length];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const turn = ((u[1] * w[2] - u[2] * w[1]) * nrm[0] + (u[2] * w[0] - u[0] * w[2]) * nrm[1]
      + (u[0] * w[1] - u[1] * w[0]) * nrm[2]) / scaleN;
    // Tolerance scaled to the polygon, so a big face's rounding noise
    // is not a reflex corner and a small face's real notch still is.
    if (turn < -1e-6 * scaleN) return false;
  }
  return true;
}

/**
 * MW-EBONY1 (2026-10-09): A FACE THAT NAMES ONE CORNER TWICE. Mac's ebony breastplate carries eight 16-gons each with
 * two corners standing on the very spot as the corner before them - two vertices, one place, a zero-length edge - and
 * earClip finds no ear in them (a corner of no turn is neither an ear nor a reflex). Dropping each corner that repeats
 * the one before it leaves the face's own outline, which clips; the dropped corner's triangles would have had no area.
 * Taken only where earClip refused, so every face that clipped before clips as it did and every bake keeps its bytes.
 * Answers triangles as index triples into `pts` (the kept corners' own indices), or null when the face still has no
 * triangulation once its repeats are gone.
 */
export function earClipRepeated(pts, epsilon = 1e-6) {
  const keep = pts.map((_, i) => i).filter((i) => {
    const p = pts[i]; const q = pts[(i + pts.length - 1) % pts.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > epsilon;
  });
  if (keep.length === pts.length || keep.length < 3) return null;
  try { return earClip(keep.map((i) => pts[i])).map((t) => t.map((j) => keep[j])); } catch { return null; }
}

/**
 * MW-BRIG1: EAR CLIPPING, for the polygon a fan would tear.
 *
 * The polygon is projected onto the plane its Newell normal names -
 * dropping the dominant axis, and flipping the other two when that
 * axis points away, so the projection keeps the polygon's own winding
 * - and an EAR is a convex corner whose triangle holds no other corner
 * of what remains. Cutting ears until three corners are left is a
 * triangulation of any simple polygon (Meisters' two-ears theorem), and
 * every triangle keeps the polygon's winding, so a face's front stays
 * its front. Ears are taken lowest index first, so the result is a
 * function of the file and nothing else. (AUDIT GN-B1: not Blender's
 * own ear order - blenderTessellate below is that. For a planar face
 * any triangulation draws the same surface; for one that is not planar
 * it does not, and the galleon's bake cuts as Blender cuts.)
 *
 * Returns triangles as index triples into `pts`. A polygon that crosses
 * itself has no triangulation to find, and is refused by name - as is
 * one that folds so that no ear is left to cut.
 */
export function earClip(pts) {
  const nrm = newellNormal(pts);
  const k = [0, 1, 2].reduce((best, i) => (Math.abs(nrm[i]) > Math.abs(nrm[best]) ? i : best), 0);
  const [ia, ib] = k === 0 ? [1, 2] : k === 1 ? [2, 0] : [0, 1];
  const flip = nrm[k] < 0 ? -1 : 1;
  const p2 = pts.map((p) => [p[ia], p[ib] * flip]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  // SIMPLE FIRST. Ear clipping is only a triangulation of a polygon that
  // does not cross itself - handed a bow tie it still finds "ears" and
  // emits triangles, covering an area the face never had. Two edges that
  // share no corner and properly cross are that polygon.
  const n = p2.length;
  const crosses = (a, b, c, d) => {
    const d1 = cross(a, b, c); const d2 = cross(a, b, d); const d3 = cross(c, d, a); const d4 = cross(c, d, b);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;   // adjacent across the wrap
      if (crosses(p2[i], p2[(i + 1) % n], p2[j], p2[(j + 1) % n])) {
        throw new Error(`a ${n}-gon crosses itself (edges ${i} and ${j}) - no triangulation covers it. Fix the face in Blender before exporting.`);
      }
    }
  }
  const ring = pts.map((_, i) => i);
  const tris = [];
  while (ring.length > 3) {
    let cut = -1;
    for (let r = 0; r < ring.length && cut < 0; r++) {
      const i0 = ring[(r + ring.length - 1) % ring.length]; const i1 = ring[r]; const i2 = ring[(r + 1) % ring.length];
      const [a, b, c] = [p2[i0], p2[i1], p2[i2]];
      if (cross(a, b, c) <= 0) continue;   // reflex (or flat) - not an ear
      let clear = true;
      for (const j of ring) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (inside(p2[j], a, b, c)) { clear = false; break; }
      }
      if (clear) cut = r;
    }
    if (cut < 0) throw new Error(`a ${pts.length}-gon has no ear left to cut - it folds back over itself. Fix the face in Blender before exporting.`);
    const r = cut;
    tris.push([ring[(r + ring.length - 1) % ring.length], ring[r], ring[(r + 1) % ring.length]]);
    ring.splice(r, 1);
  }
  tris.push([ring[0], ring[1], ring[2]]);
  return tris;
}

// ═══ AUDIT GN-B1: BLENDER'S OWN TESSELLATION - AUDIT GN2-BK1: BLENDER 5.1'S ════════════════════════════════════════
//
// earClip above is AN ear clip, not Blender's: it drops an axis and takes the lowest-index ear, and for a planar face
// any triangulation draws the same surface - but a face that is NOT planar is drawn by its triangles, and two
// triangulations of it are two different surfaces. Mac's galleon has such faces (her hull's sides lean 0.55 m out of
// their own planes since he drew two corners in at the bow), and he sees them as Blender cuts them. So this is that cut,
// ported from Blender's source line for line (blenkernel mesh_tessellate.cc for the face, blenlib polyfill_2d.cc for the
// n-gon fill) and computed as Blender computes it, in single precision. AUDIT GN2-BK1: AS BLENDER 5.1 HOLDS IT - the
// Blender Mac exports from (his FBX's SceneInfo: 5.1.1). 5.1.0 rewrote polyfill_2d.cc's point test and kd-tree (5.1.0
// and 5.1.1 hold it byte for byte), and the first port, 5.0's, cut her hull's lower 24-gons #2 and #34 otherwise; so
// the fill is one Blender's (BLENDER_FILL) and tools/bakeGalleon.mjs refuses an export by any other:
//
// - A TRIANGLE is kept. A QUAD is cut on its 0-2 diagonal, (0,1,2) (0,2,3), unless is_quad_flip_v3_first_third_fast
//   finds that diagonal outside it - then on 1-3, (0,1,3) (1,2,3).
// - AN N-GON (five corners or more) is projected into the plane of its Newell normal (add_newell_cross_v3_v3v3 from the
//   last corner round, normalize_v3; a face of no area takes +Z) through axis_dominant_v3_to_m3_NEGATE - the negated
//   normal, so the face winds the way BLI_polyfill_calc is told it does (coords_sign 1, which polyfill_prepare would
//   take itself where cross_poly_v2 <= 0 - AUDIT GN2-BK2) - and
//   filled by BLI_polyfill_calc: an ear clip that CLIPS EVEN (after each cut the search starts two corners on) and
//   SWEEPS (it turns back the other way when the corner it would start at is not convex), searching each time in two
//   passes (Blender #103913) - a CONVEX ear first, and only when none is free a TANGENTIAL one (its three corners in a
//   line: a triangle of no area) - and in DESPERATE MODE, when neither pass finds one, cutting the first corner that is
//   not concave from where the search began (or that corner itself when every corner is concave). A corner blocks an
//   ear when it lies inside its triangle OR ON IT - on an edge, or on a corner at another index - and only corners that
//   are not convex are ever asked, each until it is cut or turns convex; a convex corner's sign is never asked again,
//   even when cutting its neighbour bends it in.
// - AUDIT GN2-BK1: THE POINT TEST (USE_PRECOMPUTED_ISECT, `triIsect`): each edge of the ear's triangle (tip, next, prev)
//   a vector e and a constant c = e.x v.y - v.x e.y, computed once, and a corner on or in it when e.y x - e.x y + c >= 0
//   on all three - span_tri_v2_sign's sign in exact arithmetic, not in float.
// - AUDIT GN2-BK1: THE KD-TREE IS PART OF THE ANSWER (`kdTree2d`): the corners not convex are asked through
//   polyfill_2d.cc's own 2D kd-tree, balanced by quickselect and walked from its root asking each node's OWN point first,
//   with no bounds - so a corner the walk reaches blocks wherever it stands, one on a tangential ear's line past its ends
//   too (5.0 asked the triangle's bounding box first) - then its children, the side of the triangle's centre first, each
//   only while the node's split stands within the triangle's bounds. A corner leaving the tree COLLAPSES it (a removed
//   node with one child hands it to its parent, its split pruning no more), and each corner keeps an INDEX CACHE: the
//   corner that last blocked its ear, asked first while the tree holds it (asked again once its triangle has changed).
//   Which corners the walk reaches is the fill, so the tree is ported node for node. Her #2 and #34 are cut otherwise
//   by the two together: on each a convex ear is blocked by a corner past its bounding box, which this point test
//   rounds onto the line of one of its edges and the walk reaches (span_tri_v2_sign rounded it off; 5.0 asked the box).
// - FLOAT32 THROUGHOUT (Math.fround after every operation, in Blender's order): its corner signs compare against 0.0f,
//   so a corner that is tangential in float may be convex in double, and that choice is the fill. No fused multiply-add,
//   as Blender builds itself (AUDIT GN2-BK3): -ffp-contract=off on Apple, Unix and Windows' clang (v5.1.1's
//   build_files/cmake/platform: platform_apple.cmake:161, platform_unix.cmake:870 and :942, platform_win32.cmake:188-189),
//   and MSVC's x64 SSE2 (no /arch in its cmake) has none to emit - no a*b - c*d contracted, there or here.
//
// The corners go in as Blender holds them: the mesh's own coordinates (an FBX's Vertices are Blender's floats, exactly)
// in the face's own corner order. The triangles come out as corner-index triples, each wound as the face is.

/** Single precision, as Blender computes. */
const f32 = Math.fround;
/** FLT_EPSILON (ortho_basis_v3v3_v3's degenerate test). */
const FLT_EPSILON = 2 ** -23;
/** polyfill_2d.cc's corner signs (eSign). */
const CONCAVE = -1, TANGENTIAL = 0, CONVEX = 1;
const toF32 = (pts) => pts.map((p) => [f32(p[0]), f32(p[1]), f32(p[2])]);
const sub3f = (a, b) => [f32(a[0] - b[0]), f32(a[1] - b[1]), f32(a[2] - b[2])];
const cross3f = (a, b) => [f32(f32(a[1] * b[2]) - f32(a[2] * b[1])), f32(f32(a[2] * b[0]) - f32(a[0] * b[2])), f32(f32(a[0] * b[1]) - f32(a[1] * b[0]))];
const dot3f = (a, b) => f32(f32(f32(a[0] * b[0]) + f32(a[1] * b[1])) + f32(a[2] * b[2]));
/** (b - a) x (c - a) in double - a triangle's area vector, twice over (tilingFault's, not Blender's). */
const cross3d = (a, b, c) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};

/** AUDIT GN-B1: a face's normal as mesh_tessellate's n-gon branch takes it - Newell's sum from the LAST corner round
 *  (add_newell_cross_v3_v3v3), then normalize_v3 (unit length by a reciprocal; nought under 1e-35 squared, and then +Z). */
export function blenderNormal(pts) {
  const P = toF32(pts);
  const n = [0, 0, 0];
  let prev = P[P.length - 1];
  for (const cur of P) {
    n[0] = f32(n[0] + f32(f32(prev[1] - cur[1]) * f32(prev[2] + cur[2])));
    n[1] = f32(n[1] + f32(f32(prev[2] - cur[2]) * f32(prev[0] + cur[0])));
    n[2] = f32(n[2] + f32(f32(prev[0] - cur[0]) * f32(prev[1] + cur[1])));
    prev = cur;
  }
  const d = dot3f(n, n);
  if (!(d > f32(1e-35))) return [0, 0, 1];
  const inv = f32(1 / f32(Math.sqrt(d)));
  return [f32(n[0] * inv), f32(n[1] * inv), f32(n[2] * inv)];
}

/** AUDIT GN-B1: a face's corners in its plane as mesh_tessellate projects them for the fill: axis_dominant_v3_to_m3_negate
 *  (row 0 and 1 ortho_basis_v3v3_v3 of the NEGATED normal) applied by mul_v2_m3v3. The face winds positively there. */
export function blenderProject(pts) {
  const P = toF32(pts);
  const nrm = blenderNormal(P);
  const z = [-nrm[0], -nrm[1], -nrm[2]];   // negate_v3_v3: exact
  // ortho_basis_v3v3_v3(r_n1, r_n2, z)
  const lenSq = f32(f32(z[0] * z[0]) + f32(z[1] * z[1]));
  let n1, n2;
  if (lenSq > FLT_EPSILON) {
    const d = f32(1 / f32(Math.sqrt(lenSq)));
    n1 = [f32(z[1] * d), f32(-z[0] * d), 0];
    n2 = [f32(-z[2] * n1[1]), f32(z[2] * n1[0]), f32(f32(z[0] * n1[1]) - f32(z[1] * n1[0]))];
  } else {
    n1 = [z[2] < 0 ? -1 : 1, 0, 0];
    n2 = [0, 1, 0];
  }
  return P.map((p) => [dot3f(n1, p), dot3f(n2, p)]);
}

/** AUDIT GN2-BK1: the Blender whose fill this is - polyfill_2d.cc as 5.1.0 and 5.1.1 hold it (5.0's cuts otherwise).
 *  tools/bakeGalleon.mjs refuses an export written by any other. */
export const BLENDER_FILL = '5.1';
/** polyfill_2d.cc's KDNODE_UNSET and KDTREE_INDEX_CACHE_UNSET. */
const UNSET = -1;
/** 1.0f / 3.0f (kdtree2d_isect_tri's centre). */
const THIRD = f32(1 / 3);

/** AUDIT GN2-BK1: tri_isect_precomputed_init and _test (USE_PRECOMPUTED_ISECT) - a test of whether a point lies in
 *  triangle `vs` (tip, next, prev) or on it: each edge's vector e = v[i+1] - v[i] and constant c = e.x v.y - v.x e.y, and
 *  e.y x - e.x y + c >= 0 on edges 1, 2 and 0. */
function triIsect(vs) {
  const e = [0, 1, 2].map((i) => [f32(vs[(i + 1) % 3][0] - vs[i][0]), f32(vs[(i + 1) % 3][1] - vs[i][1])]);
  const c = [0, 1, 2].map((i) => f32(f32(e[i][0] * vs[i][1]) - f32(vs[i][0] * e[i][1])));
  const side = (i, co) => f32(f32(f32(e[i][1] * co[0]) - f32(e[i][0] * co[1])) + c[i]) >= 0;
  return (co) => side(1, co) && side(2, co) && side(0, co);
}

/**
 * AUDIT GN2-BK1: polyfill_2d.cc's KDTree2D over the corners of `C` not convex by `sign` - kdtree2d_init (a node a
 * corner, in corner order), kdtree2d_balance (quickselect about each median, x first, the axes alternating) and
 * kdtree2d_init_mapping. `has(k)`: the tree holds corner k (nodes_map). `remove(k)` (kdtree2d_node_remove): its node
 * flagged, then collapsed - a removed node with one child hands it to its parent, one with none leaves it, on up while
 * the parent is removed too. `isect(ind)` (kdtree2d_isect_tri): the first corner the walk from the root finds in
 * triangle `ind` or on it, not one of its own, else UNSET - each node's own point asked first (unless removed), with no
 * bounds; then its children, the side of the triangle's centre first, each while the node's split stands within the
 * triangle's bounds.
 */
function kdTree2d(C, sign) {
  const index = [], neg = [], pos = [], axis = [], removed = [], parent = [];
  for (let i = 0; i < C.length; i++) {
    if (sign[i] !== CONVEX) { index.push(i); neg.push(UNSET); pos.push(UNSET); axis.push(0); removed.push(false); parent.push(UNSET); }
  }
  // kdtree2d_balance_recursive: nodes [ofs, ofs + num) about their median on `ax` (a node's children are unset until its
  // own median is placed, so a swap moves its corner alone)
  const balance = (ofs, num, ax) => {
    if (num <= 0) return UNSET;
    if (num === 1) return ofs;
    const at = (k) => C[index[ofs + k]][ax];
    const swap = (a, b) => { const t = index[ofs + a]; index[ofs + a] = index[ofs + b]; index[ofs + b] = t; };
    const median = num >> 1;
    let lo = 0, hi = num - 1;
    while (hi > lo) {
      const co = at(hi);
      let i = lo - 1, j = hi;
      for (;;) {
        while (at(++i) < co) { /* pass */ }
        while (at(--j) > co && j > lo) { /* pass */ }
        if (i >= j) break;
        swap(i, j);
      }
      swap(i, hi);
      if (i >= median) hi = i - 1;
      if (i <= median) lo = i + 1;
    }
    axis[ofs + median] = ax;
    neg[ofs + median] = balance(ofs, median, 1 - ax);
    pos[ofs + median] = balance(ofs + median + 1, num - (median + 1), 1 - ax);
    return ofs + median;
  };
  const root = balance(0, index.length, 0);
  const map = new Array(C.length).fill(UNSET);   // nodes_map: corner -> node
  for (let i = 0; i < index.length; i++) {
    if (neg[i] !== UNSET) parent[neg[i]] = i;
    if (pos[i] !== UNSET) parent[pos[i]] = i;
    map[index[i]] = i;
  }
  parent[root] = UNSET;
  return {
    has: (k) => map[k] !== UNSET,
    remove(k) {
      let node = map[k];
      if (node === UNSET) return;
      map[k] = UNSET;
      removed[node] = true;
      while (parent[node] !== UNSET) {
        let child;
        if (neg[node] === UNSET) child = pos[node];
        else if (pos[node] === UNSET) child = neg[node];
        else break;   // both children set, nothing to collapse
        const up = parent[node];
        if (neg[up] === node) neg[up] = child; else pos[up] = child;
        if (child !== UNSET) parent[child] = up;
        if (!removed[up]) break;
        node = up;
      }
    },
    isect(ind) {
      const vs = ind.map((i) => C[i]);
      const bounds = [0, 1].map((a) => [Math.min(vs[0][a], vs[1][a], vs[2][a]), Math.max(vs[0][a], vs[1][a], vs[2][a])]);
      const centre = [0, 1].map((a) => f32(f32(f32(vs[0][a] + vs[1][a]) + vs[2][a]) * THIRD));
      const inside = triIsect(vs);
      const walk = (node) => {
        const k = index[node], co = C[k], ax = axis[node];
        if (!removed[node] && inside(co) && !ind.includes(k)) return k;
        const toNeg = () => (neg[node] !== UNSET && co[ax] >= bounds[ax][0] ? walk(neg[node]) : UNSET);
        const toPos = () => (pos[node] !== UNSET && co[ax] <= bounds[ax][1] ? walk(pos[node]) : UNSET);
        const [first, then] = centre[ax] > co[ax] ? [toPos, toNeg] : [toNeg, toPos];
        const hit = first();
        return hit !== UNSET ? hit : then();
      };
      return walk(root);
    },
  };
}

/**
 * AUDIT GN-B1: BLI_polyfill_calc(coords, n, coords_sign = 1) - the n-gon fill, on a face already in its plane and wound
 * positively there (blenderProject's). Returns n - 2 triangles as index triples [prev, ear, next] in the order they are
 * cut, the last three corners last. See the section above for the rules; the names below are polyfill_2d.cc's - AUDIT
 * GN2-BK1: its 5.1 text (BLENDER_FILL), the point test triIsect's and the corners asked kdTree2d's.
 */
export function blenderPolyfill(coords) {
  const n = coords.length;
  if (n < 3) throw new Error(`a polygon with ${n} corners is not a face`);
  const C = coords.map((p) => [f32(p[0]), f32(p[1])]);
  // area_tri_signed_v2_alt_2x, and span_tri_v2_sign(v1, v2, v3) = signum_enum(area(v3, v2, v1))
  const area2x = (v1, v2, v3) => {
    const d2x = f32(v2[0] - v1[0]), d2y = f32(v2[1] - v1[1]), d3x = f32(v3[0] - v1[0]), d3y = f32(v3[1] - v1[1]);
    return f32(f32(d2x * d3y) - f32(d3x * d2y));
  };
  const span = (v1, v2, v3) => { const a = area2x(v3, v2, v1); return a === 0 ? TANGENTIAL : a > 0 ? CONVEX : CONCAVE; };
  // polyfill_prepare: the ring, each corner's sign, the count of corners not convex (USE_CONVEX_SKIP) and each corner's
  // index cache (USE_KDTREE_INDEX_CACHE: the corner that last blocked its ear, and whether its triangle changed since)
  const next = C.map((_, i) => (i + 1) % n), prev = C.map((_, i) => (i + n - 1) % n);
  const sign = new Array(n), lastHit = new Array(n).fill(UNSET), dirty = new Array(n).fill(false);
  const signCalc = (i) => { sign[i] = span(C[prev[i]], C[i], C[next[i]]); };
  let concave = 0;
  for (let i = 0; i < n; i++) { signCalc(i); if (sign[i] !== CONVEX) concave++; }
  // polyfill_calc: the kd-tree over the corners not convex - none when every corner is
  const tree = concave ? kdTree2d(C, sign) : null;
  // pf_ear_tip_check: no corner the tree holds in the ear's triangle or on it - the cached one asked first
  const earTipCheck = (tip, accept) => {
    if (concave === 0) return true;   // "fast-path for circles"
    if (sign[tip] !== accept) return false;
    const ind = [tip, next[tip], prev[tip]];
    const cached = lastHit[tip];
    if (cached !== UNSET) {
      if (!dirty[tip]) {
        if (tree.has(cached)) return false;   // its triangle unchanged: it blocks while the tree holds it
      } else if (tree.has(cached) && !ind.includes(cached) && triIsect(ind.map((i) => C[i]))(C[cached])) {
        dirty[tip] = false;   // changed, and it blocks still (kdtree2d_isect_tri_single)
        return false;
      }
    }
    const hit = tree.isect(ind);
    if (hit !== UNSET) { lastHit[tip] = hit; dirty[tip] = false; return false; }
    return true;
  };
  // pf_ear_tip_find: two passes from pi_ear_init the way the sweep runs, then desperate mode (forward from it)
  let count = n;
  const earTipFind = (init, reverse) => {
    for (const accept of [CONVEX, TANGENTIAL]) {
      let e = init;
      for (let i = 0; i < count; i++) {
        if (earTipCheck(e, accept)) return e;
        e = reverse ? prev[e] : next[e];
      }
    }
    let e = init;
    for (let i = 0; i < count; i++) {
      if (sign[e] !== CONCAVE) return e;
      e = next[e];
    }
    return e;   // every corner concave: the loop has come round to where it began
  };
  // pf_triangulate
  const tris = [];
  let head = 0, init = 0, reverse = false;
  while (count > 3) {
    const ear = earTipFind(init, reverse);
    if (sign[ear] !== CONVEX) concave--;
    const p = prev[ear], q = next[ear];
    tris.push([p, ear, q]);
    tree?.remove(ear);   // pf_coord_remove
    next[p] = q; prev[q] = p;
    if (head === ear) head = q;
    count--;
    dirty[p] = true; dirty[q] = true;   // their triangles changed: a cached corner is asked again
    if (sign[p] !== CONVEX) { signCalc(p); if (sign[p] === CONVEX) { concave--; tree.remove(p); } }
    if (sign[q] !== CONVEX) { signCalc(q); if (sign[q] === CONVEX) { concave--; tree.remove(q); } }
    init = reverse ? prev[p] : next[q];   // USE_CLIP_EVEN
    if (sign[init] !== CONVEX) { init = reverse ? prev[init] : next[init]; reverse = !reverse; }   // USE_CLIP_SWEEP
  }
  tris.push([head, next[head], next[next[head]]]);
  return tris;
}

/** AUDIT GN-B1: is_quad_flip_v3_first_third_fast - whether a quad's 0-2 diagonal lies outside it (the two triangles on
 *  it face apart), so Blender cuts it on 1-3. */
export function blenderQuadFlip(pts) {
  const [v1, v2, v3, v4] = toF32(pts);
  const d13 = sub3f(v3, v1);
  return dot3f(cross3f(sub3f(v2, v1), d13), cross3f(sub3f(v4, v1), d13)) > 0;
}

/** AUDIT GN-B1: a face cut into triangles as Blender cuts it (mesh_tessellate) - corner-index triples, each wound as the
 *  face is. The corners in Blender's own coordinates and order (the section above). */
export function blenderTessellate(pts) {
  const n = pts.length;
  if (n < 3) throw new Error(`a polygon with ${n} corners is not a face`);
  if (n === 3) return [[0, 1, 2]];
  if (n === 4) return blenderQuadFlip(pts) ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2], [0, 2, 3]];
  return blenderPolyfill(blenderProject(pts));
}

/**
 * AUDIT GN-B1: WHETHER TRIANGLES TILE THEIR FACE - null when they do, else what is wrong, in words. `p2` the face's
 * corners in a plane (blenderProject's), `tris` index triples into them. Tiling, exactly: as many triangles as the face
 * has corners less two, every one wound as the face winds, their areas summing to the face's to 1e-6 of it - and over
 * every cell the face's edges and the triangles' edges cut the plane into, as many triangles as the face winds about
 * it: one in its planking, none outside it or in a port it runs round, two where it lies over itself. So no triangle
 * stands outside its face and none overlaps another. A triangle OF NO AREA - narrower than four float32 steps at the
 * face's size: three corners on one line, as Blender's tangential ear cuts them along a port's sill - covers nothing and
 * is let be, whichever way rounding tips it; a cell whose middle stands that close to an edge is rounding's (the inside
 * of such a sliver, however it leans in the plane), and goes unasked. Given the face's corners in 3D as well (`pts3`),
 * a triangle's area is judged there: one with area that has next to none in the plane (a millionth of its own) stands
 * EDGE-ON to its face - a bow-tied quad whose Newell normal lies across its two lobes projects so - and is a fault.
 */
export function tilingFault(p2, tris, pts3 = null) {
  const n = p2.length;
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const span = (a, b) => Math.hypot(...a.map((v, k) => b[k] - v));
  let face = 0;
  for (let i = 0; i < n; i++) { const a = p2[i], b = p2[(i + 1) % n]; face += a[0] * b[1] - b[0] * a[1]; }
  face /= 2;
  if (!(Math.abs(face) > 0)) return 'it has no area in its plane';
  if (tris.length !== n - 2) return `${tris.length} triangles where ${n} corners take ${n - 2}`;
  let size = 0;
  for (const p of pts3 ?? p2) for (const v of p) size = Math.max(size, Math.abs(v));
  const thin = 4 * size * 2 ** -23;   // four float32 steps at the face's size
  const s = Math.sign(face);
  const solid = [];   // the triangles with area, and each one's sign
  let sum = 0;
  for (const t of tris) {
    if (t.length !== 3 || t.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) return `a triangle [${t}] names a corner the face does not have`;
    const [a, b, c] = [p2[t[0]], p2[t[1]], p2[t[2]]];
    const twice = area2(a, b, c);
    sum += twice / 2;
    // its area, and its width (twice its area over its longest edge): in 3D when the corners are given, else in the plane
    const [A, B, C] = pts3 ? [pts3[t[0]], pts3[t[1]], pts3[t[2]]] : [a, b, c];
    const own = pts3 ? Math.hypot(...cross3d(A, B, C)) : Math.abs(twice);
    if (!(own > thin * Math.max(span(A, B), span(B, C), span(C, A)))) continue;   // no area: three corners on a line
    if (!(Math.abs(twice) > 1e-6 * own)) return `triangle [${t}] stands edge-on to the face (${(own / 2).toPrecision(4)} of its own, ${(twice / 2).toPrecision(4)} in the face's plane)`;
    // AUDIT GN-B2: a fold - the old fill's fin under her port quarter - is refused here, never baked
    if (Math.sign(twice) !== s) return `triangle [${t}] is wound against the face (${(twice / 2).toPrecision(4)} of ${face.toPrecision(6)})`;
    solid.push([a, b, c, s]);
  }
  if (Math.abs(sum - face) > 1e-6 * Math.abs(face)) return `its triangles cover ${sum.toPrecision(9)} of its ${face.toPrecision(9)}`;
  // the cells: the plane cut into slabs at every corner's and every crossing's abscissa, each slab into cells by the
  // edges that span it; each cell asked at its middle
  const segs = [];
  for (let i = 0; i < n; i++) segs.push([p2[i], p2[(i + 1) % n]]);
  for (const t of tris) for (let k = 0; k < 3; k++) segs.push([p2[t[k]], p2[t[(k + 1) % 3]]]);
  const eps = thin;
  const nearEdge = (q) => segs.some(([a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(q[0] - a[0] - u * dx, q[1] - a[1] - u * dy) <= eps;
  });
  const xs = p2.map((p) => p[0]);
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const [a, b] = segs[i], [c, d] = segs[j];
      const d1 = area2(a, b, c), d2 = area2(a, b, d), d3 = area2(c, d, a), d4 = area2(c, d, b);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) xs.push(a[0] + (b[0] - a[0]) * (d3 / (d3 - d4)));
    }
  }
  xs.sort((a, b) => a - b);
  const winding = (q) => {
    let w = 0;
    for (let e = 0; e < n; e++) {
      const a = p2[e], b = p2[(e + 1) % n], c = area2(a, b, q);
      if (a[1] <= q[1]) { if (b[1] > q[1] && c > 0) w++; } else if (b[1] <= q[1] && c < 0) w--;
    }
    return w;
  };
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i], x1 = xs[i + 1];
    if (!(x1 - x0 > eps)) continue;
    const xm = (x0 + x1) / 2;
    const ys = [];
    for (const [a, b] of segs) {
      if (Math.min(a[0], b[0]) <= x0 && Math.max(a[0], b[0]) >= x1) ys.push(a[1] + (b[1] - a[1]) * (xm - a[0]) / (b[0] - a[0]));
    }
    ys.sort((a, b) => a - b);
    for (let k = 0; k + 1 < ys.length; k++) {
      if (!(ys[k + 1] - ys[k] > eps)) continue;
      const q = [xm, (ys[k] + ys[k + 1]) / 2];
      if (nearEdge(q)) continue;
      let cover = 0;
      for (const [a, b, c, st] of solid) if (st * area2(a, b, q) > 0 && st * area2(b, c, q) > 0 && st * area2(c, a, q) > 0) cover += st;
      const w = winding(q);
      if (cover !== w) return `${Math.abs(cover)} of its triangles${cover < 0 ? ' (against it)' : ''} lie over a point it winds ${w} times about (${q.map((v) => v.toPrecision(6)).join(', ')} in its plane)`;
    }
  }
  return null;
}

/**
 * MW-BRIG1: THE SCENE'S FRAME, read out of the file rather than
 * assumed. Returns `{ m, unitScale }`: `m` is the 3x3 (row-major, the
 * unit folded in) taking a vector in FBX world space - the space
 * `Lcl Translation` lives in - to the modeller's own Z-up scene.
 *
 * AXES. GlobalSettings names which FBX axis is UP and which is the
 * COORD (right) axis; the scene is Z-up with X on the coord axis, and
 * its Y is up x coord, which is what keeps (X, Y, Z) right-handed.
 * Blender's default export is up = +Y, coord = +X, so the scene's Y is
 * FBX -Z, the conversion its exporter applied on the way out.
 *
 * UNITS. `UnitScaleFactor` is centimetres per FBX unit, and a Blender
 * unit at scene scale 1 is a metre - so a scene unit is 100 /
 * UnitScaleFactor FBX units. That is exactly the `Lcl Scaling` 100 a
 * Blender export carries on every object, which is what makes the
 * geometry come back in the scene's own numbers.
 */
export function sceneFrame(tree) {
  const gs = nodeAt(tree.nodes, 'GlobalSettings');
  const num = (name, d) => { const v = gs ? property70(gs, name)?.[0] : undefined; return v === undefined ? d : Number(v); };
  const axis = (i, sign) => { const v = [0, 0, 0]; v[i] = sign < 0 ? -1 : 1; return v; };
  const upI = num('UpAxis', 1); const coordI = num('CoordAxis', 0);
  if (![0, 1, 2].includes(upI) || ![0, 1, 2].includes(coordI) || upI === coordI) {
    throw new Error(`GlobalSettings names UpAxis ${upI} and CoordAxis ${coordI} - not two distinct axes`);
  }
  const up = axis(upI, num('UpAxisSign', 1));
  const coord = axis(coordI, num('CoordAxisSign', 1));
  const side = [up[1] * coord[2] - up[2] * coord[1], up[2] * coord[0] - up[0] * coord[2], up[0] * coord[1] - up[1] * coord[0]];
  const unitScale = num('UnitScaleFactor', 1);
  if (!(unitScale > 0)) throw new Error(`GlobalSettings UnitScaleFactor ${unitScale} is not a length`);
  const u = unitScale / 100;
  // Rows: scene X = coord, scene Y = up x coord, scene Z = up.
  const m = [...coord, ...side, ...up].map((v) => v * u);
  return { m, unitScale };
}

/** The transform properties a T*R*S reading does not carry. Blender
 *  writes none of them; a file that does was authored with a pivot or
 *  an offset this bake would silently drop, so it is refused instead. */
const UNSUPPORTED_TRANSFORM = [
  ['PreRotation', [0, 0, 0]], ['PostRotation', [0, 0, 0]],
  ['RotationOffset', [0, 0, 0]], ['RotationPivot', [0, 0, 0]],
  ['ScalingOffset', [0, 0, 0]], ['ScalingPivot', [0, 0, 0]],
  ['GeometricTranslation', [0, 0, 0]], ['GeometricRotation', [0, 0, 0]], ['GeometricScaling', [1, 1, 1]],
];

/** The object is a ROOT of the scene: its Lcl transform is its world
 *  transform only if nothing above it adds one. */
function assertRootObject(tree, model) {
  const id = model.props[0];
  for (const c of childrenNamed(nodeAt(tree.nodes, 'Connections'), 'C')) {
    if (c.props[0] === 'OO' && c.props[1] === id && c.props[2] !== 0 && c.props[2] !== 0n) {
      throw new Error(`${objectName(model.props[1])} is parented under object ${c.props[2]} - apply or clear the parent in Blender, a scene placement reads the object's own transform only`);
    }
  }
  for (const [name, identity] of UNSUPPORTED_TRANSFORM) {
    const v = property70(model, name);
    if (v && v.some((x, i) => Math.abs(Number(x) - identity[i]) > 1e-9)) {
      throw new Error(`${objectName(model.props[1])} carries ${name} ${JSON.stringify(v)} - a scene placement reads T*R*S only`);
    }
  }
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
export function bakeMesh(tree, { name = null, keepRotation = false, normalise = true, forward = '-z', up = '-x', units = 1, origin = 'centre', placement = 'object' } = {}) {
  if (placement !== 'object' && placement !== 'scene') throw new Error(`placement "${placement}" is not object or scene`);
  const scene = placement === 'scene';
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
  if (scene && !model) throw new Error('a scene placement needs the Model that places the mesh, and this FBX has none');

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
  const translation = (model && property70(model, 'Lcl Translation')) ?? [0, 0, 0];
  const useRotation = keepRotation || scene;
  // eulerXYZ is eOrderXYZ; any other order is a different matrix from
  // the same three numbers, so an applied rotation states the order.
  const rotationOrder = model ? Number(property70(model, 'RotationOrder')?.[0] ?? 0) : 0;
  if (useRotation && rotationOrder !== 0) throw new Error(`RotationOrder ${rotationOrder} is not eOrderXYZ (0) - set the object's rotation mode to XYZ Euler in Blender`);
  const R = useRotation ? eulerXYZ(rotation) : null;
  // MW-BRIG1: the scene placement - the file's axes and units, and the
  // object's translation carried through them. See sceneFrame.
  let frame = null;
  if (scene) {
    assertRootObject(tree, model);
    const f = sceneFrame(tree);
    frame = { m: f.m, t: apply3(f.m, translation.map(Number)), unitScale: f.unitScale };
  }
  // The inverse transpose of a pure scale is its reciprocal - which is
  // why this is not just "apply the same matrix to the normal".
  const nScale = scale.map((s) => (s === 0 ? 0 : 1 / s));

  const placePosition = (p) => {
    let v = [p[0] * scale[0], p[1] * scale[1], p[2] * scale[2]];
    if (R) v = apply3(R, v);
    if (frame) { v = apply3(frame.m, v); v = [v[0] + frame.t[0], v[1] + frame.t[1], v[2] + frame.t[2]]; }
    return toBasis(v);
  };
  const placeNormal = (n) => {
    let v = [n[0] * nScale[0], n[1] * nScale[1], n[2] * nScale[2]];
    if (R) v = apply3(R, v);
    // The frame is a rotation times a positive uniform unit, so it is
    // its own inverse transpose up to a length the divide below takes out.
    if (frame) v = apply3(frame.m, v);
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
  let clipped = 0;
  let repeated = 0;   // MW-EBONY1: faces clipped once their repeated corners were dropped (earClipRepeated)
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
    const ring = poly.map((p, i) => cornerOf(base + i, p));
    // FAN from corner 0 when that is a triangulation - every convex
    // polygon, and every triangle - and EAR-CLIP when it is not (MW-BRIG1,
    // see the header). The test is on the PLACED corners, the geometry
    // the triangles will actually have.
    const pts = poly.length > 3 ? poly.map((p) => placePosition(positions.slice(p * 3, p * 3 + 3))) : null;
    if (!pts || isConvexPolygon(pts)) {
      for (let i = 1; i + 1 < ring.length; i++) indices.push(ring[0], ring[i], ring[i + 1]);
    } else {
      let tris;
      try { tris = earClip(pts); } catch (err) {
        tris = earClipRepeated(pts);
        if (!tris) throw new Error(`${err.message} (the polygon at corner ${base})`);
        repeated++;
      }
      for (const [a, b, c] of tris) indices.push(ring[a], ring[b], ring[c]);
      clipped++;
    }
  }

  if (outPos.length / 3 > 65535) throw new Error(`${outPos.length / 3} vertices will not fit a Uint16 index buffer`);

  // ── the frame: centre on bounds, longest axis to 1 ────────────────
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < outPos.length; i += 3) {
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], outPos[i + k]); max[k] = Math.max(max[k], outPos[i + k]); }
  }
  const size = [0, 1, 2].map((k) => max[k] - min[k]);
  const longest = Math.max(...size);
  // A SCENE PLACEMENT IS NEITHER NORMALISED NOR RE-CENTRED: where the
  // mesh sits, at the size it has, is what the modeller authored.
  const unit = !scene && normalise && longest > 0 ? units / longest : 1;
  // THE PIVOT, measured BEFORE the scale is applied so the anchor is in
  // the mesh's own units and the two decisions stay independent.
  const anchor = scene ? [0, 0, 0]
    : origin === 'grip'
      ? gripAnchor(outPos, min, max)
      : [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  for (let i = 0; i < outPos.length; i += 3) {
    for (let k = 0; k < 3; k++) outPos[i + k] = (outPos[i + k] - anchor[k]) * unit;
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
      // MW-BRIG1: how many concave polygons were ear-clipped, not fanned.
      clipped,
      ...(repeated ? { repeated } : {}),   // MW-EBONY1: said only where a face had one, so every other bake's record is the one it was
      placement,
      appliedScale: round(scale, 6),
      droppedRotation: useRotation ? null : round(rotation, 6),
      // MW-BRIG1: the placement a scene bake kept, in the scene's units.
      ...(frame ? { sceneTranslation: round(frame.t, 6), unitScaleFactor: frame.unitScale } : {}),
      basis: `Morrowind (+Y forward, +Z up), from local forward=${forward} up=${up}`,
      // In the mesh's OWN units after the scale bake, before the unit
      // divide: what one unit of the shipped mesh is worth.
      sizeBeforeNormalise: round(size, 4),
      unitDivisor: +(1 / unit).toFixed(6),
      units: scene ? null : units,
      origin: scene ? 'scene' : origin,
      // Where the pivot landed in the mesh's own pre-scale space, so a
      // re-bake that moved it is visible in the diff.
      anchor: round(anchor, 4),
    },
    // Bounds AFTER the frame, which is what a consumer places against.
    bounds: { min: round([0, 1, 2].map((k) => (min[k] - anchor[k]) * unit), 6), max: round([0, 1, 2].map((k) => (max[k] - anchor[k]) * unit), 6) },
    positions: round(outPos, 6),
    normals: outNrm.length ? round(outNrm, 6) : null,
    uvs: outUv.length ? round(outUv, 6) : null,
    indices,
  };
}

/**
 * THE GRIP, derived rather than typed: the centroid of the vertices in
 * the rearmost `band` of the long axis.
 *
 * After the basis map +Y is forward (the muzzle), so the grip is the
 * MINIMUM end - the same direction `tools/meshTexture.mjs` measures its
 * bands from, said in both places because getting it backwards puts the
 * hand on the barrel.
 *
 * A CENTROID and not a bounds centre, so a grip that is a wedge rather
 * than a box anchors where the material is, and the cross-axes come
 * from the same vertices for the same reason: a hand closes around the
 * middle of the GRIP, not the middle of the weapon.
 */
export function gripAnchor(positions, min, max, band = 0.18) {
  const cut = min[1] + (max[1] - min[1]) * band;
  let n = 0; const sum = [0, 0, 0];
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i + 1] > cut) continue;
    for (let k = 0; k < 3; k++) sum[k] += positions[i + k];
    n++;
  }
  // No vertex in the band cannot happen for a real mesh; a caller
  // handing this a plane would get a divide by zero rather than an
  // answer, so it falls back to the bounds centre. The bake record
  // prints the anchor either way.
  if (!n) return [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  return sum.map((v) => v / n);
}

// ── the CLI ───────────────────────────────────────────────────────────
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (k) => args.includes(`--${k}`);
  const opt = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length !== 2) {
    console.error('usage: node tools/fbxMesh.mjs <in.fbx> <out.json> [--name=X] [--forward=-z] [--up=-x] [--units=N] [--origin=centre|grip] [--keep-rotation] [--no-normalise] [--placement=object|scene]');
    process.exit(2);
  }
  const [inPath, outPath] = files;
  const mesh = bakeMesh(readFbx(readFileSync(inPath)), {
    name: opt('name'), keepRotation: flag('keep-rotation'), normalise: !flag('no-normalise'),
    forward: opt('forward', '-z'), up: opt('up', '-x'),
    units: Number(opt('units', 1)), origin: opt('origin', 'centre'),
    placement: opt('placement', 'object'),
  });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(mesh)}\n`);
  const b = mesh.bake;
  console.log(`${inPath} -> ${outPath}`);
  console.log(`  ${mesh.name}: ${b.polygons} polygons (${b.ngons} n-gons, ${b.clipped} ear-clipped) -> ${mesh.indices.length / 3} triangles`);
  console.log(`  ${b.sourceCorners} corners welded to ${mesh.positions.length / 3} vertices`);
  if (b.placement === 'scene') console.log(`  scene placement kept: translation ${b.sceneTranslation.join(', ')}, size ${b.sizeBeforeNormalise.join(' x ')}`);
  else console.log(`  scale ${b.appliedScale.join(' x ')} baked; size ${b.sizeBeforeNormalise.join(' x ')} / ${b.unitDivisor} -> longest axis ${b.units}`);
  console.log(`  origin ${b.origin} at ${JSON.stringify(b.anchor)}`);
  console.log(`  ${b.basis}`);
  console.log(`  bounds ${JSON.stringify(mesh.bounds.min)} .. ${JSON.stringify(mesh.bounds.max)}`);
}
