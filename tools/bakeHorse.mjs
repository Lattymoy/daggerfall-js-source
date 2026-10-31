// THE COURSER - THE 3D HORSE, BAKED OUT OF ITS FBX.
//
//     node tools/bakeHorse.mjs [--fbx=src/assets/horse/source/courser.fbx] [--out=src/assets/horse/courser.json] [--report]
//
// COATS3D (2026-10-11, the owner, sending walk.fbx, idle.fbx, idle-1.fbx, gallop.fbx, trot.fbx and two pictures: "The
// first image is for the horse itself and the second is for the tail. These are to be applied to horses for people
// using morrowind with the character properly rigged when riding. These also need to recieve the same texture treatment
// we gave the sprites with parity between each"; asked, every horse of the Morrowind lane - the ridden one with its rider
// astride, other riders, the standing and following horses and the wagon teams - and first person on the 3D horse).
//
// THE FIVE FILES ARE ONE RIG SAVED FIVE TIMES (Blender's FBX 7400, a `Courser_Rig` armature): the same two meshes
// (Horse_Lores_UV2, 943 control points; Alpha_Hair_9_Cards.001, the mane and tail on 9 alpha cards, 120), the same 33
// skin clusters byte for byte, and each a different slice of its animations - idle.fbx (idle-1.fbx is the same bytes)
// carries all eight stacks, the others subsets of them. walk.fbx alone carries a different UV map (two fewer UVs, an
// unwrap's seams merged) that draws the same picture, and a Preview_Ground plane. So idle.fbx is the one committed
// (src/assets/horse/source/courser.fbx) and everything bakes out of it.
//
// WHAT IS BAKED (the JSON's shape is written down in `bakeHorse`'s return):
//  - THE FRAME: the armature's own - Blender's, Z up, +Y the way the horse faces, metres, its origin on the ground
//    under the horse's middle (the rig's Root). The FBX wraps it in the Y-up, centimetre frame every Blender export
//    does (the rig Null's -90 degrees about X and x100); that wrapper is taken off, so a bone, a vertex and a key all
//    stand in the frame the modeller worked in. It is Morrowind's basis too (+Y forward, +Z up).
//  - THE SKELETON: the 33 bones the skin names (Root to the hooves, the jaw, the ears, three tail bones), parent first,
//    each with its BIND (the clusters' TransformLink - the pose the skin was bound in, never the bones' Lcl values,
//    which each file saved at a different point of its timeline) and its inverse.
//  - THE MESHES: triangulated as Blender draws them (tools/fbxMesh.mjs blenderTessellate), welded on (control point,
//    normal, uv), each vertex's four influences - and its weights NORMALISED: the body's were exported summing to
//    anything from 0.07 to 2.0 a vertex, which Blender's armature deform divides out, so the bake does (an unnormalised
//    linear blend collapses a 0.07 vertex toward the origin and doubles a 2.0 one). The hair cards are cut alpha.
//  - THE GAITS: idle (Courser_Idle_Natural, 8 s), walk (Walk_InPlace, 1.33 s), trot (Trot_InPlace, 0.87 s) and gallop
//    (Courser_Gallop_Realistic_v3, 0.53 s), each sampled at the file's 30 frames a second (its keys are linear -
//    KeyAttrFlags 0x6104 on every curve; the idle's eight slow seconds at 15), a bone's rotation a frame and its
//    translation a frame where the gait moves it (`moves`), once where it does not (`rest`). And each gait's SPEED, the
//    ground it covers a second, so the runtime plays a stride as fast as the horse travels and no hoof slides: walk's
//    and trot's off their RootMotion twins' Root travel (0.891 m a cycle, 1.674 m a cycle), the gallop's - which has no
//    twin - off its planted hooves (a hoof on the ground moves back under the body as fast as the body moves forward).
//
// Not a DFU member: Daggerfall's horse is a sprite. Ledger A (COATS3D).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFbx, childrenNamed, childNamed, objectName, property70 } from './fbxRead.mjs';
import { polygonsOf, blenderTessellate } from './fbxMesh.mjs';
import { isMain } from './lib/isMain.mjs';

const TICKS_PER_SECOND = 46186158000; // FBX's KTime
export const HORSE_FPS = 30;
/** The gaits, and the stacks they are baked from (and the twins their speed is measured on). */
export const GAIT_STACKS = Object.freeze({
  idle: { stack: 'Courser_Rig|Courser_Idle_Natural', speedFrom: null, fps: 15 }, // eight slow seconds: half the file's rate
  walk: { stack: 'Courser_Rig|Walk_InPlace', speedFrom: 'Courser_Rig|Walk_RootMotion', fps: HORSE_FPS },
  trot: { stack: 'Courser_Rig|Trot_InPlace', speedFrom: 'Courser_Rig|Trot_RootMotion', fps: HORSE_FPS },
  gallop: { stack: 'Courser_Rig|Courser_Gallop_Realistic_v3', speedFrom: 'hooves', fps: HORSE_FPS },
});
const HOOVES = ['Fore.L.Hoof', 'Fore.R.Hoof', 'Hind.L.Hoof', 'Hind.R.Hoof'];
const MESHES = Object.freeze({
  Horse_Lores_UV2: { part: 'body', texture: 'body', alpha: false },
  'Alpha_Hair_9_Cards.001': { part: 'hair', texture: 'hair', alpha: true },
});

// ── column-major 4x4, column vectors (FBX's own) ────────────────────────────────────────────────────────────────────
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
function inv(m) {
  // general 4x4 inverse (cofactors)
  const a = m,
    o = new Array(16);
  o[0] =
    a[5] * a[10] * a[15] -
    a[5] * a[11] * a[14] -
    a[9] * a[6] * a[15] +
    a[9] * a[7] * a[14] +
    a[13] * a[6] * a[11] -
    a[13] * a[7] * a[10];
  o[4] =
    -a[4] * a[10] * a[15] +
    a[4] * a[11] * a[14] +
    a[8] * a[6] * a[15] -
    a[8] * a[7] * a[14] -
    a[12] * a[6] * a[11] +
    a[12] * a[7] * a[10];
  o[8] =
    a[4] * a[9] * a[15] -
    a[4] * a[11] * a[13] -
    a[8] * a[5] * a[15] +
    a[8] * a[7] * a[13] +
    a[12] * a[5] * a[11] -
    a[12] * a[7] * a[9];
  o[12] =
    -a[4] * a[9] * a[14] +
    a[4] * a[10] * a[13] +
    a[8] * a[5] * a[14] -
    a[8] * a[6] * a[13] -
    a[12] * a[5] * a[10] +
    a[12] * a[6] * a[9];
  o[1] =
    -a[1] * a[10] * a[15] +
    a[1] * a[11] * a[14] +
    a[9] * a[2] * a[15] -
    a[9] * a[3] * a[14] -
    a[13] * a[2] * a[11] +
    a[13] * a[3] * a[10];
  o[5] =
    a[0] * a[10] * a[15] -
    a[0] * a[11] * a[14] -
    a[8] * a[2] * a[15] +
    a[8] * a[3] * a[14] +
    a[12] * a[2] * a[11] -
    a[12] * a[3] * a[10];
  o[9] =
    -a[0] * a[9] * a[15] +
    a[0] * a[11] * a[13] +
    a[8] * a[1] * a[15] -
    a[8] * a[3] * a[13] -
    a[12] * a[1] * a[11] +
    a[12] * a[3] * a[9];
  o[13] =
    a[0] * a[9] * a[14] -
    a[0] * a[10] * a[13] -
    a[8] * a[1] * a[14] +
    a[8] * a[2] * a[13] +
    a[12] * a[1] * a[10] -
    a[12] * a[2] * a[9];
  o[2] =
    a[1] * a[6] * a[15] -
    a[1] * a[7] * a[14] -
    a[5] * a[2] * a[15] +
    a[5] * a[3] * a[14] +
    a[13] * a[2] * a[7] -
    a[13] * a[3] * a[6];
  o[6] =
    -a[0] * a[6] * a[15] +
    a[0] * a[7] * a[14] +
    a[4] * a[2] * a[15] -
    a[4] * a[3] * a[14] -
    a[12] * a[2] * a[7] +
    a[12] * a[3] * a[6];
  o[10] =
    a[0] * a[5] * a[15] -
    a[0] * a[7] * a[13] -
    a[4] * a[1] * a[15] +
    a[4] * a[3] * a[13] +
    a[12] * a[1] * a[7] -
    a[12] * a[3] * a[5];
  o[14] =
    -a[0] * a[5] * a[14] +
    a[0] * a[6] * a[13] +
    a[4] * a[1] * a[14] -
    a[4] * a[2] * a[13] -
    a[12] * a[1] * a[6] +
    a[12] * a[2] * a[5];
  o[3] =
    -a[1] * a[6] * a[11] +
    a[1] * a[7] * a[10] +
    a[5] * a[2] * a[11] -
    a[5] * a[3] * a[10] -
    a[9] * a[2] * a[7] +
    a[9] * a[3] * a[6];
  o[7] =
    a[0] * a[6] * a[11] -
    a[0] * a[7] * a[10] -
    a[4] * a[2] * a[11] +
    a[4] * a[3] * a[10] +
    a[8] * a[2] * a[7] -
    a[8] * a[3] * a[6];
  o[11] =
    -a[0] * a[5] * a[11] +
    a[0] * a[7] * a[9] +
    a[4] * a[1] * a[11] -
    a[4] * a[3] * a[9] -
    a[8] * a[1] * a[7] +
    a[8] * a[3] * a[5];
  o[15] =
    a[0] * a[5] * a[10] -
    a[0] * a[6] * a[9] -
    a[4] * a[1] * a[10] +
    a[4] * a[2] * a[9] +
    a[8] * a[1] * a[6] -
    a[8] * a[2] * a[5];
  const det = a[0] * o[0] + a[1] * o[4] + a[2] * o[8] + a[3] * o[12];
  if (!det) throw new Error('a singular matrix');
  return o.map((x) => x / det);
}
const point = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
const dir = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z,
  m[1] * x + m[5] * y + m[9] * z,
  m[2] * x + m[6] * y + m[10] * z,
];
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
/** FBX's eEulerXYZ, degrees: the X turn first, then Y, then Z - R = Rz Ry Rx. */
function eulerXYZ([rx, ry, rz]) {
  const [a, b, c] = [rx, ry, rz].map((d) => (d * Math.PI) / 180);
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)];
  return [
    cb * cc,
    cb * sc,
    -sb,
    0,
    sa * sb * cc - ca * sc,
    sa * sb * sc + ca * cc,
    sa * cb,
    0,
    ca * sb * cc + sa * sc,
    ca * sb * sc - sa * cc,
    ca * cb,
    0,
    0,
    0,
    0,
    1,
  ];
}
const trs = (t, r, s) => {
  const R = eulerXYZ(r);
  const S = [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
  const M = mul(R, S);
  M[12] = t[0];
  M[13] = t[1];
  M[14] = t[2];
  return M;
};
/** A rotation matrix's quaternion [x, y, z, w]. */
function quatOf(m) {
  const [m00, m10, m20, , m01, m11, m21, , m02, m12, m22] = m;
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  const l = Math.hypot(...q);
  return q.map((x) => x / l);
}
const r = (x, d) => {
  const k = 10 ** d;
  const v = Math.round(x * k) / k;
  return Object.is(v, -0) ? 0 : v;
};

/** The FBX's scene graph: objects by id, the connections, the models' parents. */
function sceneOf(tree) {
  const objects = childNamed(tree.nodes, 'Objects');
  const byId = new Map(objects.children.map((n) => [String(n.props[0]), n]));
  const conns = childrenNamed(childNamed(tree.nodes, 'Connections'), 'C').map((c) => ({
    kind: c.props[0],
    src: String(c.props[1]),
    dst: String(c.props[2]),
    prop: c.props[3] ?? null,
  }));
  const models = new Map();
  for (const m of childrenNamed(objects, 'Model')) {
    const pre = property70(m, 'PreRotation'),
      post = property70(m, 'PostRotation'),
      order = property70(m, 'RotationOrder');
    if (
      (pre && pre.some((v) => Math.abs(v) > 1e-9)) ||
      (post && post.some((v) => Math.abs(v) > 1e-9)) ||
      (order && order[0] !== 0)
    )
      throw new Error(
        `${objectName(m.props[1])}: a pre/post rotation or a rotation order other than XYZ - the bake does not carry one`,
      );
    models.set(String(m.props[0]), {
      id: String(m.props[0]),
      name: objectName(m.props[1]),
      type: objectName(m.props[2]),
      t: property70(m, 'Lcl Translation') ?? [0, 0, 0],
      r: property70(m, 'Lcl Rotation') ?? [0, 0, 0],
      s: property70(m, 'Lcl Scaling') ?? [1, 1, 1],
      parent: null,
    });
  }
  for (const c of conns)
    if (c.kind === 'OO' && models.has(c.src) && models.has(c.dst)) models.get(c.src).parent = c.dst;
  return { objects, byId, conns, models };
}
const globalOf = (models, id, local = (m) => trs(m.t, m.r, m.s)) => {
  const m = models.get(id);
  const L = local(m);
  return m.parent ? mul(globalOf(models, m.parent, local), L) : L;
};

/** A stack's curves: bone name -> { 'Lcl Translation': [xCurve, yCurve, zCurve] , ... } where a curve is { times (s), values } or a constant. */
function stackCurves(scene, stackName) {
  const { objects, byId, conns, models } = scene;
  const stack = childrenNamed(objects, 'AnimationStack').find((s) => objectName(s.props[1]) === stackName);
  if (!stack) throw new Error(`no animation stack ${stackName}`);
  const into = (dst) => conns.filter((c) => c.dst === dst);
  const out = new Map();
  let duration = 0;
  for (const lc of into(String(stack.props[0]))) {
    if (byId.get(lc.src)?.name !== 'AnimationLayer') continue;
    for (const c of into(lc.src)) {
      const cn = byId.get(c.src);
      if (cn?.name !== 'AnimationCurveNode') continue;
      const target = conns.find((k) => k.src === c.src && k.kind === 'OP' && models.has(k.dst));
      if (!target) continue;
      const bone = models.get(target.dst).name;
      const defaults = ['d|X', 'd|Y', 'd|Z'].map((k) => property70(cn, k)?.[0] ?? 0);
      const axes = defaults.map((d) => ({ times: null, values: null, constant: d }));
      for (const cc of into(c.src)) {
        const cv = byId.get(cc.src);
        if (cv?.name !== 'AnimationCurve') continue;
        const k = ['d|X', 'd|Y', 'd|Z'].indexOf(cc.prop);
        if (k < 0) continue;
        const flags = childNamed(cv, 'KeyAttrFlags')?.props?.[0] ?? [];
        if (flags.some((f) => ((f >>> 0) & 0x0e) !== 0x04))
          throw new Error(`${bone} ${target.prop}: a key that is not linear - the bake samples linear keys alone`);
        const times = childNamed(cv, 'KeyTime').props[0].map((t) => Number(t) / TICKS_PER_SECOND);
        axes[k] = { times, values: childNamed(cv, 'KeyValueFloat').props[0], constant: null };
        duration = Math.max(duration, times[times.length - 1]);
      }
      if (!out.has(bone)) out.set(bone, {});
      out.get(bone)[target.prop] = axes;
    }
  }
  return { curves: out, duration };
}
function sampleAxis(a, t) {
  if (!a.times) return a.constant;
  const { times, values } = a;
  if (t <= times[0]) return values[0];
  if (t >= times[times.length - 1]) return values[values.length - 1];
  let lo = 0,
    hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - times[lo]) / (times[hi] - times[lo]);
  return values[lo] + (values[hi] - values[lo]) * f;
}

/** The width either side of the midline a vertex is ON it (metres) - the seam's vertices stand at |x| < 1e-4. */
const MIDLINE = 2e-3;
/**
 * EACH FLANK ITS OWN TEXELS. The body's unwrap is MIRRORED: its two islands that cross the midline - the barrel and
 * neck, and the head - lay the horse's left half over its right, every left vertex on its right twin's UV, so a texel
 * is painted on both flanks at once. The painting does not need it: Mac's body picture carries each island's mirror
 * image beside it (the barrel reflected about u 0.4175 and the head about 0.6195 - measured, a mean 6.6 and 3.7 levels
 * of 255 between a texel and its reflection), unused. A coat's markings are laid in the texture (COATS3D, the 3D dye),
 * so on shared texels a pinto's patches and a leopard's spots came out the same on both sides - a mirror horse, which
 * no horse is. So each left triangle of a crossing island takes its texels from the reflection: its corners' u
 * reflected about the island's axis - the u its midline vertices stand at along the island's near edge - on twins of
 * those corners (a midline vertex on the axis is its own twin). The legs, ears and eyes are islands a side already
 * (each pair on one painting, which they keep: a sock is a sock either side). The bay draws as it did, its left flank
 * now off the painting's own left half. In place; answers the axes and the twins made.
 */
function ownFlanks(mesh) {
  const { positions: P, uvs: UV, indices: I } = mesh;
  const n = P.length / 3;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let t = 0; t < I.length; t += 3) {
    parent[find(I[t + 1])] = find(I[t]);
    parent[find(I[t + 2])] = find(I[t]);
  }
  const islands = new Map();
  for (let v = 0; v < n; v++) {
    const r = find(v);
    if (!islands.has(r)) islands.set(r, []);
    islands.get(r).push(v);
  }
  const axes = new Map();
  for (const [r, vs] of islands) {
    const xs = vs.map((v) => P[v * 3]);
    if (!(Math.min(...xs) < -MIDLINE && Math.max(...xs) > MIDLINE)) continue;
    const u0 = Math.min(...vs.map((v) => UV[v * 2]));
    const on = vs
      .filter((v) => Math.abs(P[v * 3]) < MIDLINE && UV[v * 2] < u0 + 0.005)
      .map((v) => UV[v * 2])
      .sort((a, b) => a - b);
    if (!on.length) throw new Error('a crossing island with no midline on its near edge');
    const a = on[on.length >> 1];
    const far = Math.max(...vs.map((v) => UV[v * 2]));
    if (2 * a - far < 0) throw new Error(`the island about u ${a} reflects off the picture`);
    axes.set(r, a);
  }
  const twin = new Map();
  const twinOf = (v, a) => {
    const u = 2 * a - UV[v * 2];
    if (Math.abs(u - UV[v * 2]) < 1e-6) return v;
    let w = twin.get(v);
    if (w === undefined) {
      w = P.length / 3;
      twin.set(v, w);
      P.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      mesh.normals.push(mesh.normals[v * 3], mesh.normals[v * 3 + 1], mesh.normals[v * 3 + 2]);
      UV.push(u, UV[v * 2 + 1]);
      for (let j = 0; j < 4; j++) {
        mesh.joints.push(mesh.joints[v * 4 + j]);
        mesh.weights.push(mesh.weights[v * 4 + j]);
      }
    }
    return w;
  };
  for (let t = 0; t < I.length; t += 3) {
    const a = axes.get(find(I[t]));
    if (a === undefined) continue;
    if (P[I[t] * 3] + P[I[t + 1] * 3] + P[I[t + 2] * 3] >= 0) continue; // a right triangle (or on the midline)
    for (let k = 0; k < 3; k++) I[t + k] = twinOf(I[t + k], a);
  }
  return { axes: [...axes.values()].sort((x, y) => x - y), twins: twin.size };
}

/**
 * THE BAKE. Answers `{ bake, source, frame, bones, meshes, gaits, report }`:
 *  - bones: [{ name, parent (index, -1 the root), bind: [16] (armature space, column-major), inverseBind: [16] }]
 *  - meshes: [{ part, texture, alpha, positions, normals, uvs (v up, as FBX), joints (4 a vertex), weights (4), indices }]
 *  - gaits: { idle|walk|trot|gallop: { duration, fps, frames, speed (m/s, 0 for idle), rest: [bones x 3],
 *    moves: [bone], t: [frames x moves x 3], q: [frames x bones x 4] } } - each bone's LOCAL translation (`rest`'s, or
 *    the frame's for a bone in `moves`) and rotation (x, y, z, w) a frame, parent space.
 */
export function bakeHorse(buf) {
  const tree = readFbx(buf);
  const scene = sceneOf(tree);
  const { objects, byId, conns, models } = scene;
  const rig = [...models.values()].find((m) => m.name === 'Courser_Rig');
  if (!rig) throw new Error('no Courser_Rig');
  const toArm = inv(globalOf(models, rig.id));
  // the skin: each mesh's clusters, their bones, their binds
  const deformers = new Map(childrenNamed(objects, 'Deformer').map((d) => [String(d.props[0]), d]));
  const meshModels = [...models.values()].filter((m) => MESHES[m.name]);
  // Blender writes a cluster's TransformLink as its bone's bind in the FBX's global frame, and its Transform as the
  // INVERSE BIND - the mesh object's frame to the bone's - which every mesh of one rig shares bone for bone
  const boneBind = new Map(); // bone name -> TransformLink (FBX global)
  const boneInvBind = new Map(); // bone name -> Transform (mesh object frame -> bone)
  const clustersOf = new Map(); // mesh name -> [{ bone, idx, w }]
  for (const mm of meshModels) {
    const geo = conns
      .filter((c) => c.dst === mm.id)
      .map((c) => byId.get(c.src))
      .find((n) => n?.name === 'Geometry');
    const skin = conns
      .filter((c) => c.dst === String(geo.props[0]))
      .map((c) => deformers.get(c.src))
      .find((d) => d && objectName(d.props[2]) === 'Skin');
    const list = [];
    for (const c of conns.filter((k) => k.dst === String(skin.props[0]))) {
      const cl = deformers.get(c.src);
      if (!cl || objectName(cl.props[2]) !== 'Cluster') continue;
      const bone = models.get(conns.find((k) => k.dst === c.src && models.has(k.src)).src).name;
      const link = childNamed(cl, 'TransformLink').props[0],
        tf = childNamed(cl, 'Transform').props[0];
      const prev = boneBind.get(bone),
        prevInv = boneInvBind.get(bone);
      if (prev && prev.some((v, i) => Math.abs(v - link[i]) > 1e-6))
        throw new Error(`${bone}: two meshes bound it in two places`);
      if (prevInv && prevInv.some((v, i) => Math.abs(v - tf[i]) > 1e-6))
        throw new Error(`${bone}: two meshes bound to it from two frames`);
      boneBind.set(bone, link);
      boneInvBind.set(bone, tf);
      list.push({
        bone,
        idx: childNamed(cl, 'Indexes')?.props?.[0] ?? [],
        w: childNamed(cl, 'Weights')?.props?.[0] ?? [],
      });
    }
    clustersOf.set(mm.name, { geo, list });
  }
  // THE SKELETON - the skinned bones, parent first (the armature's own order: a depth-first walk from the Root)
  const limb = [...models.values()].filter((m) => m.type === 'LimbNode' && boneBind.has(m.name));
  const children = (id) => limb.filter((m) => m.parent === id);
  const order = [];
  const walk = (m) => {
    order.push(m);
    for (const c of children(m.id)) walk(c);
  };
  for (const root of limb.filter((m) => !boneBind.has(models.get(m.parent)?.name))) walk(root);
  if (order.length !== boneBind.size)
    throw new Error(`the skinned bones are not one tree under the rig (${order.length} of ${boneBind.size} walked)`);
  const index = new Map(order.map((m, i) => [m.name, i]));
  // each mesh object must stand where the rig does (the frame the inverse binds are in IS the armature's), and each bone's
  // two binds must agree - TransformLink taken into the armature against the inverse of Transform
  for (const mm of meshModels) {
    const g = mul(toArm, globalOf(models, mm.id));
    if (g.some((v, i) => Math.abs(v - I4()[i]) > 1e-5))
      throw new Error(`${mm.name}: the mesh object does not stand where its rig does`);
  }
  let bindAgree = 0;
  const bones = order.map((m) => {
    const inverseBind = boneInvBind.get(m.name).slice();
    const bind = inv(inverseBind);
    const link = mul(toArm, boneBind.get(m.name).slice());
    bindAgree = Math.max(bindAgree, ...bind.map((v, i) => Math.abs(v - link[i])));
    return { name: m.name, parent: index.get(models.get(m.parent)?.name) ?? -1, bind, inverseBind };
  });
  if (bindAgree > 1e-4) throw new Error(`the clusters' two binds disagree by ${bindAgree}`);
  // THE MESHES
  const report = { weights: {}, rest: 0 };
  const meshes = [];
  for (const mm of meshModels) {
    const { geo, list } = clustersOf.get(mm.name);
    const toArmMesh = I4(); // the mesh object's frame is the armature's (checked above)
    const cps = childNamed(geo, 'Vertices').props[0];
    const pvi = childNamed(geo, 'PolygonVertexIndex').props[0];
    const nl = childNamed(geo, 'LayerElementNormal'),
      ul = childNamed(geo, 'LayerElementUV');
    const layer = (l, key, idxKey) => {
      const map = String(childNamed(l, 'MappingInformationType').props[0]),
        ref = String(childNamed(l, 'ReferenceInformationType').props[0]);
      if (map !== 'ByPolygonVertex') throw new Error(`${mm.name}: ${key} mapped ${map}, not ByPolygonVertex`);
      const data = childNamed(l, key).props[0],
        ix = ref === 'IndexToDirect' ? childNamed(l, idxKey).props[0] : null;
      return (corner) => (ix ? ix[corner] : corner);
    };
    const nAt = layer(nl, 'Normals', 'NormalsIndex'),
      uAt = layer(ul, 'UV', 'UVIndex');
    const N = childNamed(nl, 'Normals').props[0],
      UV = childNamed(ul, 'UV').props[0];
    // influences a control point: the top four, normalised (see the header)
    const nCp = cps.length / 3;
    const infl = Array.from({ length: nCp }, () => []);
    for (const { bone, idx, w } of list)
      for (let k = 0; k < idx.length; k++) if (w[k] > 0) infl[idx[k]].push([index.get(bone), w[k]]);
    let over = 0,
      unnormal = 0,
      none = 0;
    const skin = infl.map((a) => {
      a.sort((x, y) => y[1] - x[1]);
      if (a.length > 4) over++;
      const top = a.slice(0, 4);
      const sum = top.reduce((s, x) => s + x[1], 0);
      if (!top.length) {
        none++;
        return [[index.get('Root'), 1]];
      }
      if (Math.abs(sum - 1) > 1e-3) unnormal++;
      return top.map(([b, w]) => [b, w / sum]);
    });
    report.weights[MESHES[mm.name].part] = {
      controlPoints: nCp,
      overFour: over,
      renormalised: unnormal,
      unweighted: none,
    };
    // the corners, triangulated as Blender draws them, welded on (cp, normal, uv)
    const positions = [],
      normals = [],
      uvs = [],
      joints = [],
      weights = [],
      indices = [];
    const weld = new Map();
    let corner = 0;
    const cpPos = (i) => [cps[i * 3], cps[i * 3 + 1], cps[i * 3 + 2]];
    for (const poly of polygonsOf(pvi)) {
      const base = corner;
      corner += poly.length;
      const tris = blenderTessellate(poly.map(cpPos));
      for (const tri of tris)
        for (const k of tri) {
          const c = base + k,
            cp = poly[k];
          const ni = nAt(c),
            ui = uAt(c);
          const key = `${cp}|${ni}|${ui}`;
          let v = weld.get(key);
          if (v === undefined) {
            v = positions.length / 3;
            weld.set(key, v);
            positions.push(...point(toArmMesh, cpPos(cp)));
            normals.push(...norm(dir(toArmMesh, [N[ni * 3], N[ni * 3 + 1], N[ni * 3 + 2]])));
            uvs.push(UV[ui * 2], UV[ui * 2 + 1]);
            const s = skin[cp];
            for (let j = 0; j < 4; j++) {
              joints.push(s[j]?.[0] ?? 0);
              weights.push(s[j]?.[1] ?? 0);
            }
          }
          indices.push(v);
        }
    }
    const mesh = { ...MESHES[mm.name], positions, normals, uvs, joints, weights, indices };
    if (mesh.part === 'body') report.flanks = ownFlanks(mesh);
    meshes.push(mesh);
  }
  // THE REST POSE AGREES WITH THE BIND? (the clusters' links against the bones' own chain, idle's first frame)
  // THE GAITS
  const gaits = {};
  const sampleLocal = (curves, bone, t) => {
    const c = curves.get(bone) ?? {};
    const tr = (c['Lcl Translation'] ?? [0, 0, 0].map((v) => ({ constant: v }))).map((a) => sampleAxis(a, t));
    const rot = (c['Lcl Rotation'] ?? [0, 0, 0].map((v) => ({ constant: v }))).map((a) => sampleAxis(a, t));
    const sc = (c['Lcl Scaling'] ?? [1, 1, 1].map((v) => ({ constant: v }))).map((a) => sampleAxis(a, t));
    return { t: tr, r: rot, s: sc };
  };
  const posedArm = (curves, t) => {
    // every skinned bone's armature-space matrix at time t (the Root's parent is the rig: armature space itself)
    const out = [];
    bones.forEach((b, i) => {
      const L = sampleLocal(curves, b.name, t);
      const M = trs(L.t, L.r, L.s);
      out[i] = b.parent < 0 ? M : mul(out[b.parent], M);
    });
    return out;
  };
  let scaleDrift = 0;
  for (const [gait, { stack, speedFrom, fps }] of Object.entries(GAIT_STACKS)) {
    const { curves, duration } = stackCurves(scene, stack);
    const frames = Math.round(duration * fps) + 1;
    // a bone's translation is keyed in a gait or it is not: the ones that never move are written once (`rest`), the
    // ones that do (`moves`) a frame each - most of a rig's bones only turn
    const local = Array.from({ length: frames }, (_, f) => bones.map((b) => sampleLocal(curves, b.name, f / fps)));
    for (const row of local) for (const L of row) scaleDrift = Math.max(scaleDrift, ...L.s.map((v) => Math.abs(v - 1)));
    const rest = bones.flatMap((_, i) => local[0][i].t.map((v) => r(v, 4)));
    const moves = bones
      .map((_, i) => i)
      .filter((i) => local.some((row) => row[i].t.some((v, k) => r(v, 4) !== rest[i * 3 + k])));
    const t = [],
      q = [];
    for (const row of local) {
      for (const i of moves) t.push(...row[i].t.map((v) => r(v, 4)));
      for (const L of row) q.push(...quatOf(eulerXYZ(L.r)).map((v) => r(v, 4)));
    }
    let speed = 0;
    if (speedFrom === 'hooves') {
      // a planted hoof moves back under the body as fast as the body goes forward: its armature-space Y velocity, over
      // the frames each hoof stands lowest (within 2 cm of its lowest), the median of them all
      const vel = [];
      const hoof = HOOVES.map((n) => index.get(n));
      const pos = Array.from({ length: frames }, (_, f) => posedArm(curves, f / fps)).map((ms) =>
        hoof.map((i) => [ms[i][12], ms[i][13], ms[i][14]]),
      );
      hoof.forEach((_, h) => {
        const zs = pos.map((p) => p[h][2]);
        const low = Math.min(...zs);
        for (let f = 0; f + 1 < frames; f++)
          if (zs[f] < low + 0.02 && zs[f + 1] < low + 0.02) vel.push(-(pos[f + 1][h][1] - pos[f][h][1]) * fps);
      });
      vel.sort((a, b) => a - b);
      speed = vel[vel.length >> 1];
    } else if (speedFrom) {
      const twin = stackCurves(scene, speedFrom);
      const a = sampleLocal(twin.curves, 'Root', 0).t,
        b = sampleLocal(twin.curves, 'Root', twin.duration).t;
      speed = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / twin.duration;
    }
    gaits[gait] = { duration: r(duration, 5), fps, frames, speed: r(speed, 4), rest, moves, t, q };
  }
  report.scaleDrift = scaleDrift;
  report.bindAgree = bindAgree;
  // the bind against the idle's first frame - how far the rig's own pose stands from where the skin was bound
  {
    const { curves } = stackCurves(scene, GAIT_STACKS.idle.stack);
    const ms = posedArm(curves, 0);
    report.rest = Math.max(
      ...bones.map((b, i) => Math.max(...[12, 13, 14].map((k) => Math.abs(ms[i][k] - b.bind[k])))),
    );
  }
  const all = meshes.flatMap((m) =>
    [...Array(m.positions.length / 3)].map((_, i) => m.positions.slice(i * 3, i * 3 + 3)),
  );
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))),
    hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])));
  return {
    bake: 'COATS3D',
    source: createHash('sha256').update(buf).digest('hex'),
    frame: {
      units: 'metres',
      up: '+z',
      forward: '+y',
      bounds: { min: lo.map((v) => r(v, 4)), max: hi.map((v) => r(v, 4)) },
    },
    bones: bones.map((b) => ({
      name: b.name,
      parent: b.parent,
      bind: b.bind.map((v) => r(v, 6)),
      inverseBind: b.inverseBind.map((v) => r(v, 6)),
    })),
    meshes: meshes.map((m) => ({
      ...m,
      positions: m.positions.map((v) => r(v, 4)),
      normals: m.normals.map((v) => r(v, 3)),
      uvs: m.uvs.map((v) => r(v, 5)),
      weights: m.weights.map((v) => r(v, 3)),
    })),
    gaits,
    report,
  };
}

if (isMain(import.meta.url)) {
  const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const fbx = arg('fbx', 'src/assets/horse/source/courser.fbx');
  const out = arg('out', 'src/assets/horse/courser.json');
  const baked = bakeHorse(readFileSync(fbx));
  const { report, ...asset } = baked;
  if (process.argv.includes('--report'))
    console.log(
      JSON.stringify(
        {
          report,
          bounds: asset.frame.bounds,
          bones: asset.bones.length,
          meshes: asset.meshes.map((m) => [m.part, m.positions.length / 3, m.indices.length / 3]),
          gaits: Object.fromEntries(
            Object.entries(asset.gaits).map(([k, g]) => [
              k,
              { duration: g.duration, frames: g.frames, speed: g.speed },
            ]),
          ),
        },
        null,
        1,
      ),
    );
  writeFileSync(out, JSON.stringify(asset));
  console.log(`${out}: ${(JSON.stringify(asset).length / 1024).toFixed(0)} KB`);
}
