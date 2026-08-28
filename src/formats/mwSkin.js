// Morrowind skeleton and CPU skinning - slice 3 of the import arc. Pure
// data: build the bone hierarchy out of a parsed NIF, pose it from
// sampled animation tracks, and deform skinned batches on the CPU. The
// game's GPU path comes later; this is the correctness reference the
// viewer runs and the tests pin.
//
// The composition matches the OpenMW reference exactly (riggeometry.cpp
// read behaviorally, no code ported):
//
//   v' = DataTransform( SkinToSkel( SUM_b w_b * BoneInSkelSpace_b(
//        InvBind_b( v ) ) ) )
//
// where InvBind_b is NiSkinData's per-bone transform (mesh space -> bone
// space at bind), BoneInSkelSpace_b is the bone's current transform
// relative to the SKELETON ROOT node, the weighted sum blends the affine
// matrices (translations included), SkinToSkel cancels the transforms
// between the skeleton root and the skin's root bone, and DataTransform
// is NiSkinData's root transform. Skinned geometry's own node transform
// is NOT applied - NetImmerse ignores it for skinned shapes.

import { deref } from './mwNifFile.js';

const NODE_TYPES = new Set([
  'NiNode',
  'NiBSAnimationNode',
  'NiBSParticleNode',
  'NiBillboardNode',
  'AvoidNode',
  'RootCollisionNode',
]);

// Affine {a: Float32Array(9) row-major rotation*scale, t: [x,y,z]}.
const IDENT_A = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);

function affineFrom(rotation, translation, scale) {
  const a = new Float32Array(9);
  for (let i = 0; i < 9; i++) a[i] = rotation[i] * scale;
  return { a, t: [translation[0], translation[1], translation[2]] };
}

/** out = p ∘ l (apply l first, then p). */
function affineMul(p, l) {
  const a = new Float32Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      a[r * 3 + c] =
        p.a[r * 3] * l.a[c] + p.a[r * 3 + 1] * l.a[3 + c] + p.a[r * 3 + 2] * l.a[6 + c];
    }
  }
  return {
    a,
    t: [
      p.a[0] * l.t[0] + p.a[1] * l.t[1] + p.a[2] * l.t[2] + p.t[0],
      p.a[3] * l.t[0] + p.a[4] * l.t[1] + p.a[5] * l.t[2] + p.t[1],
      p.a[6] * l.t[0] + p.a[7] * l.t[1] + p.a[8] * l.t[2] + p.t[2],
    ],
  };
}

/** Inverse of a rotation*uniformScale affine. */
function affineInverse(m) {
  // a = R*s -> a^-1 = R^T / s^2 * s = R^T / s ... derive via s^2 = |col|^2.
  const s2 = m.a[0] * m.a[0] + m.a[3] * m.a[3] + m.a[6] * m.a[6];
  const inv = new Float32Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) inv[r * 3 + c] = m.a[c * 3 + r] / s2;
  }
  const t = [
    -(inv[0] * m.t[0] + inv[1] * m.t[1] + inv[2] * m.t[2]),
    -(inv[3] * m.t[0] + inv[4] * m.t[1] + inv[5] * m.t[2]),
    -(inv[6] * m.t[0] + inv[7] * m.t[1] + inv[8] * m.t[2]),
  ];
  return { a: inv, t };
}

function quatToMat33(q) {
  const [w, x, y, z] = q;
  return Float32Array.from([
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ]);
}

/**
 * Build the skeleton: every node in the graph with its rest transform
 * and parent link.
 * @returns {{nodes: Map<number, {ref:number, name:string, parent:number,
 *   rest:{rotation:Float32Array, translation:number[], scale:number}}>,
 *   byName: Map<string, number>}}
 */
export function buildSkeleton(nif) {
  const nodes = new Map();
  const byName = new Map();
  function walk(ref, parent) {
    const rec = deref(nif, ref);
    if (!rec || !NODE_TYPES.has(rec.type)) return;
    nodes.set(ref, {
      ref,
      name: rec.name || '',
      parent,
      rest: { rotation: rec.rotation, translation: rec.translation, scale: rec.scale },
    });
    if (rec.name) byName.set(rec.name.toLowerCase(), ref);
    for (const child of rec.children) {
      if (child >= 0) walk(child, ref);
    }
  }
  for (const root of nif.roots) {
    if (root >= 0) walk(root, -1);
  }
  return { nodes, byName };
}

/**
 * Pose the skeleton from tracks at a time: local transforms per node,
 * rest values where a channel has no keys.
 * @returns {Map<number, {rotation:Float32Array, translation:number[],
 *   scale:number}>}
 */
export function poseSkeleton(skeleton, tracks, sampleTrack, time) {
  const pose = new Map();
  for (const [ref, node] of skeleton.nodes) {
    const track = tracks && tracks.get(node.name.toLowerCase());
    if (!track) {
      pose.set(ref, node.rest);
      continue;
    }
    const s = sampleTrack(track, time);
    pose.set(ref, {
      rotation: s.rotation ? quatToMat33(s.rotation) : node.rest.rotation,
      translation: s.translation ?? node.rest.translation,
      scale: s.scale ?? node.rest.scale,
    });
  }
  return pose;
}

/** Affine per node RELATIVE TO skeletonRoot (root itself = identity). */
export function skeletonSpaceMatrices(skeleton, pose, skeletonRoot) {
  const out = new Map();
  function matOf(ref) {
    if (out.has(ref)) return out.get(ref);
    let m;
    if (ref === skeletonRoot || ref < 0 || !skeleton.nodes.has(ref)) {
      m = { a: IDENT_A, t: [0, 0, 0] };
    } else {
      const node = skeleton.nodes.get(ref);
      const local = pose.get(ref) ?? node.rest;
      m = affineMul(matOf(node.parent), affineFrom(local.rotation, local.translation, local.scale));
    }
    out.set(ref, m);
    return m;
  }
  for (const ref of skeleton.nodes.keys()) matOf(ref);
  return out;
}

/**
 * The transform canceling the chain between the skeleton root and the
 * skin's root bone: inverse of the composed locals of every node on that
 * path below the root, root-bone inclusive. Identity when they're the
 * same node.
 */
export function skinToSkelMatrix(skeleton, pose, skeletonRoot, rootBone) {
  const chain = [];
  let ref = rootBone;
  while (ref >= 0 && ref !== skeletonRoot && skeleton.nodes.has(ref)) {
    chain.unshift(ref);
    ref = skeleton.nodes.get(ref).parent;
  }
  if (ref !== skeletonRoot || !chain.length) return { a: IDENT_A, t: [0, 0, 0] };
  let m = { a: IDENT_A, t: [0, 0, 0] };
  for (const r of chain) {
    const local = pose.get(r) ?? skeleton.nodes.get(r).rest;
    m = affineMul(m, affineFrom(local.rotation, local.translation, local.scale));
  }
  return affineInverse(m);
}

/**
 * CPU-skin one batch (from flattenNif, carrying batch.skin) into out
 * arrays. positionsOut/normalsOut must be sized like the batch's own.
 */
export function skinBatch(batch, skeleton, pose, skelMats, positionsOut, normalsOut) {
  const skin = batch.skin;
  const post = affineMul(
    affineFrom(skin.transform.rotation, skin.transform.translation, skin.transform.scale),
    skinToSkelMatrix(skeleton, pose, skin.skeletonRoot, skin.rootBone),
  );
  const n = batch.positions.length / 3;
  // Per-vertex blended affines, translations included - 12 floats each.
  const acc = new Float32Array(n * 12);
  const wsum = new Float32Array(n);
  for (const bone of skin.bones) {
    const m = affineMul(affineMul(post, skelMats.get(bone.ref)), bone.invBind);
    for (let k = 0; k < bone.indices.length; k++) {
      const v = bone.indices[k];
      const w = bone.weights[k];
      const o = v * 12;
      for (let i = 0; i < 9; i++) acc[o + i] += m.a[i] * w;
      acc[o + 9] += m.t[0] * w;
      acc[o + 10] += m.t[1] * w;
      acc[o + 11] += m.t[2] * w;
      wsum[v] += w;
    }
  }
  for (let v = 0; v < n; v++) {
    const o = v * 12;
    // An unweighted vertex keeps its authored position.
    const a = wsum[v] > 0 ? acc.subarray(o, o + 12) : null;
    const x = batch.positions[v * 3];
    const y = batch.positions[v * 3 + 1];
    const z = batch.positions[v * 3 + 2];
    if (a) {
      positionsOut[v * 3] = a[0] * x + a[1] * y + a[2] * z + a[9];
      positionsOut[v * 3 + 1] = a[3] * x + a[4] * y + a[5] * z + a[10];
      positionsOut[v * 3 + 2] = a[6] * x + a[7] * y + a[8] * z + a[11];
    } else {
      positionsOut[v * 3] = x;
      positionsOut[v * 3 + 1] = y;
      positionsOut[v * 3 + 2] = z;
    }
    if (normalsOut && batch.normals) {
      const nx = batch.normals[v * 3];
      const ny = batch.normals[v * 3 + 1];
      const nz = batch.normals[v * 3 + 2];
      let ox = nx;
      let oy = ny;
      let oz = nz;
      if (a) {
        ox = a[0] * nx + a[1] * ny + a[2] * nz;
        oy = a[3] * nx + a[4] * ny + a[5] * nz;
        oz = a[6] * nx + a[7] * ny + a[8] * nz;
      }
      const len = Math.hypot(ox, oy, oz) || 1;
      normalsOut[v * 3] = ox / len;
      normalsOut[v * 3 + 1] = oy / len;
      normalsOut[v * 3 + 2] = oz / len;
    }
  }
}
