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
    // RULE 16: duplicates go to the FIRST. The reference's bone cache is
    // an unordered_map filled with emplace (skeleton.cpp:23-29), which
    // NEVER overwrites - so on a skeleton carrying two nodes of one name
    // every lookup answers the first in traversal order. A plain
    // Map.set answered the LAST, which on a retail rig with a
    // duplicated attach bone hangs the weapon on the wrong copy.
    if (rec.name) {
      const key = rec.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, ref);
    }
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
 * RULE 56: THE ACCUMULATION ROOT IS A TWO-NAME TABLE, not a search.
 *
 * Morrowind animations carry the actor's locomotion in one bone's
 * translation channel (a flight cycle literally contains the flight path
 * - OAAB's bat keys y=1892 into it), and the engine extracts that motion
 * for MOVEMENT while the visual skeleton stays put. The reference
 * accumulates X,Y and leaves Z animated (jumps, hovers). Posing without
 * extraction is the geometry-all-over-the-place bug: every walk loop
 * translates the whole body away.
 *
 * WHICH bone, though, was ported as "the topmost tracked bone" and that
 * is not the rule (Animation::addAnimSource, animation.cpp:712-734):
 *
 *   // Priority matters! bip01 is preferred.
 *   static const std::initializer_list<std::string_view> accumRootNames
 *       = { "bip01", "root bone" };
 *
 * and a candidate is accepted only if BOTH the name resolves in the node
 * map AND the loaded KF drives a controller of that same name
 * (case-insensitively). MW-D14 corrected it, and the difference is not
 * academic: a first-person weapon .kf keys nothing on bip01, so "topmost
 * tracked bone" answered an UPPER ARM - and any translation channel on
 * that bone would then have had its X and Y zeroed, silently deforming
 * the arm rather than moving the actor.
 *
 * With neither name driven the answer is NULL, which is the correct
 * answer and not a failure: an animation with no accum root simply
 * accumulates nothing.
 *
 * STICKINESS IS THE CALLER'S. `if (!mAccumRoot)` guards the whole block,
 * so the choice is made by the FIRST anim source that resolves one and
 * later sources do not re-pick it. This function answers for ONE source;
 * a caller with several must ask them in push order and keep the first
 * non-null answer.
 */
export const ACCUM_ROOT_NAMES = Object.freeze(['bip01', 'root bone']);

export function accumRootRef(skeleton, tracks) {
  const byName = skeleton && skeleton.byName;
  if (!byName) return null;
  for (const name of ACCUM_ROOT_NAMES) {
    if (!byName.has(name)) continue;
    if (!tracks || !tracks.has(name)) continue;
    return byName.get(name);
  }
  return null;
}

/**
 * Pose the skeleton from tracks at a time: local transforms per node,
 * rest values where a channel has no keys. Pass `accumRoot` (from
 * accumRootRef) to extract root motion.
 *
 * MW-D33: the accumulated axes are ZEROED, not pinned to rest -
 * ResetAccumRootCallback multiplies the node's translation by
 * (0,0,1) component-wise ("anything that accumulates (1.f) should be
 * reset in the callback to (0.f)", animation.cpp:515-539), and it does
 * so on WHATEVER the transform holds, keyed or rest alike. Only Z
 * stays, the reference's (1,1,0) accumulation. The port had substituted
 * the bone's rest X,Y, which is only the same thing when the rest
 * translation happens to be zero.
 * @returns {Map<number, {rotation:Float32Array, translation:number[],
 *   scale:number}>}
 */
export function poseSkeleton(skeleton, tracks, sampleTrack, time, opts = {}) {
  const pose = new Map();
  for (const [ref, node] of skeleton.nodes) {
    const track = tracks && tracks.get(node.name.toLowerCase());
    if (!track) {
      pose.set(ref, node.rest);
      continue;
    }
    const s = sampleTrack(track, time);
    let translation = s.translation ?? node.rest.translation;
    if (ref === opts.accumRoot) {
      translation = [0, 0, translation[2]];   // componentMultiply((0,0,1), trans)
    }
    pose.set(ref, {
      rotation: s.rotation ? quatToMat33(s.rotation) : node.rest.rotation,
      translation,
      scale: s.scale ?? node.rest.scale,
    });
  }
  return pose;
}

/**
 * MW-D20: THE GRAPH-SPACE SENTINEL. The reference's "skeleton space" is
 * the full path below the SceneUtil::Skeleton GROUP - the file's root
 * node is a CHILD of that group, so the root's own transform (which
 * rule 34 KEEPS when the root is a NiNode named bip01) is INCLUDED in
 * every bone matrix (Bone::update with no parent answers the node's own
 * matrix, skeleton.cpp:169; the loader adopts the root nodes as
 * children, nifloader.cpp:450-480). Pass this as `skeletonRoot` to get
 * that space: no real ref equals it, so no node is zeroed out.
 *
 * Every fixture's root was identity, which is why matrices relative to
 * the root REF (identity AT the root, its own transform excluded) were
 * indistinguishable from the reference for two milestones - and why a
 * retail skeleton whose Bip01 root carries a real transform pulled
 * every skinned piece out from under the rigid ones.
 */
export const GRAPH_ROOT = -1;

/** Affine per node RELATIVE TO skeletonRoot (root itself = identity);
 *  pass GRAPH_ROOT for the reference's own space, every node's
 *  transform included. */
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
  // MW-D20: THE SHAPE'S OWN TRANSFORM APPLIES. The blend's output rides
  // the render chain, and the trishape's own transform node is the one
  // part of that chain the reference never cancels: the rebound
  // fallback stops its cancellation AT the trishape's parent
  // ("cancel out everything up till the trishape",
  // riggeometry.cpp:303-309), and the same-file path cancels only up
  // THROUGH the named skin root. "NetImmerse ignores a skinned shape's
  // own transform" - the sentence that stood in the flattener - is folk
  // wisdom the reference's own code contradicts. Identity on every
  // retail shape anyone has measured, which is why nothing saw it.
  let post = affineMul(
    affineFrom(skin.transform.rotation, skin.transform.translation, skin.transform.scale),
    skinToSkelMatrix(skeleton, pose, skin.skeletonRoot, skin.rootBone),
  );
  if (skin.shapeTransform) {
    const st = skin.shapeTransform;
    post = affineMul(affineFrom(st.rotation, st.translation, st.scale), post);
  }
  const n = batch.positions.length / 3;
  // Per-vertex blended affines, translations included - 12 floats each.
  // MW-D31: the blend accumulates ONLY invBind * boneInSkelSpace - the
  // reference's resultMat starts at zero with its W column pinned to
  // (0,0,0,1) and sums exactly those per-bone products
  // (riggeometry.cpp:172-202); `post` is applied ONCE to the blended
  // result (`resultMat *= transform`, :204), never folded into each
  // bone term. The difference is the translation column: folded per
  // bone it comes out (sum w)*post.t, and rule 39 forbids
  // renormalising, so any vertex whose weights do not sum to 1 - a
  // missing-bone skip, or a file authored that way - slid toward the
  // origin by the deficit.
  const acc = new Float32Array(n * 12);
  const wsum = new Float32Array(n);
  // RULE 40: an influence naming a MISSING bone (ref null, from
  // bindPart) is skipped in the blend - and the remaining weights are
  // NOT renormalised (rule 39). But the vertex is still marked TOUCHED,
  // because the reference distinguishes two cases the sum alone cannot:
  // a vertex with no influences AT ALL keeps its authored position
  // (rule 39's erased-empty-set), while one weighted ONLY to missing
  // bones goes through the blend with a ZERO accumulator - rows 0-2
  // zero, row 3 the skin transform's - and collapses onto that
  // translation with a zero normal (riggeometry.cpp:191-210, read at
  // the rule 40 verification). Faithful, and ugly on purpose: papering
  // it over with bind pose would hide exactly the data problem the
  // missing-bone note names.
  const touched = new Uint8Array(n);
  for (const bone of skin.bones) {
    if (bone.ref == null) {
      for (let k = 0; k < bone.indices.length; k++) touched[bone.indices[k]] = 1;
      continue;
    }
    const m = affineMul(skelMats.get(bone.ref), bone.invBind);
    for (let k = 0; k < bone.indices.length; k++) {
      const v = bone.indices[k];
      const w = bone.weights[k];
      const o = v * 12;
      for (let i = 0; i < 9; i++) acc[o + i] += m.a[i] * w;
      acc[o + 9] += m.t[0] * w;
      acc[o + 10] += m.t[1] * w;
      acc[o + 11] += m.t[2] * w;
      wsum[v] += w;
      touched[v] = 1;
    }
  }
  const collapse = new Float32Array(12);
  collapse[9] = post.t[0];
  collapse[10] = post.t[1];
  collapse[11] = post.t[2];
  // MW-D31: post composed onto the BLENDED affine, once per vertex -
  // the row-vector `resultMat *= transform` in column terms. The
  // collapse row is that same law on a zero accumulator: post.a*0 +
  // post.t, which is why it stays post.t verbatim.
  const composed = new Float32Array(12);
  const pa = post.a;
  const pt = post.t;
  const composePost = (o) => {
    for (let c = 0; c < 3; c++) {           // three columns of acc's 3x3
      const x = acc[o + c]; const y = acc[o + 3 + c]; const z = acc[o + 6 + c];
      composed[c] = pa[0] * x + pa[1] * y + pa[2] * z;
      composed[3 + c] = pa[3] * x + pa[4] * y + pa[5] * z;
      composed[6 + c] = pa[6] * x + pa[7] * y + pa[8] * z;
    }
    const tx = acc[o + 9]; const ty = acc[o + 10]; const tz = acc[o + 11];
    composed[9] = pa[0] * tx + pa[1] * ty + pa[2] * tz + pt[0];
    composed[10] = pa[3] * tx + pa[4] * ty + pa[5] * tz + pt[1];
    composed[11] = pa[6] * tx + pa[7] * ty + pa[8] * tz + pt[2];
    return composed;
  };
  for (let v = 0; v < n; v++) {
    const o = v * 12;
    // An untouched vertex keeps its authored position; a touched one
    // with no surviving weight takes the zero-accumulator collapse.
    const a = wsum[v] > 0 ? composePost(o) : touched[v] ? collapse : null;
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

/**
 * MW-D7: WHICH BONES THE CLIP ACTUALLY DRIVES.
 *
 * poseSkeleton above answers a bone with no track by handing back
 * `node.rest` (:151-154). That is correct - it is what the reference
 * does - and it is also the deadliest silent failure in the animation
 * stage: hand it a .kf that keys nothing this skeleton has, and every
 * bone falls through to rest. The result is a clean, plausible, entirely
 * static arm. No error, no warning, no empty picture. A pixel count
 * passes it. A symmetry check passes it. It looks exactly like a working
 * idle that happens to be holding still.
 *
 * So the match has to be reportable, and it has to be reported by THIS
 * file, using the same comparison the poser uses one function up
 * (`node.name.toLowerCase()` against the track map's own lowercased
 * keys). A copy of that comparison in the page could agree with the page
 * and disagree with the pose - which is the one way a binding report can
 * be worse than no report at all.
 *
 * @returns {{matched:{bone:string, ref:number}[], unmatchedTracks:string[],
 *   untrackedBones:string[]}}
 */
export function trackBinding(skeleton, tracks) {
  const matched = [];
  const untrackedBones = [];
  const hit = new Set();
  for (const [ref, node] of skeleton?.nodes ?? []) {
    const key = node.name.toLowerCase();
    if (tracks && tracks.has(key)) {
      matched.push({ bone: node.name, ref });
      hit.add(key);
    } else {
      untrackedBones.push(node.name);
    }
  }
  const unmatchedTracks = [...(tracks?.keys() ?? [])].filter((k) => !hit.has(k));
  return { matched, unmatchedTracks, untrackedBones };
}
