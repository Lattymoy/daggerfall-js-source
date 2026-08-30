// Morrowind character assembly - slice 4 of the import arc. A character
// is a BASE skeleton (base_anim.nif: the bone hierarchy plus its
// animations) wearing PARTS (b\*.nif body chunks, heads, hairs...), and
// the join is BY BONE NAME: every part file carries its own local copies
// of the bones it needs, which exist only to carry the names across.
// The assembler rebinds a part's skin onto the base skeleton's nodes and
// hands unskinned parts an attachment bone, so one pose drives
// everything. Pure data, like the rest of the format layer.

import { deref } from './mwNifFile.js';
import { flattenNif } from './mwNifMesh.js';
import { skeletonSpaceMatrices, GRAPH_ROOT } from './mwSkin.js';

/**
 * Rebind one part's batches onto the base skeleton.
 *
 * Skinned batches get their skin payload's bone refs remapped by NAME
 * into the base skeleton. A missing bone is NOT fatal (rule 40): its
 * ref is null, its influences are skipped in the blend, and its name is
 * returned in `missingBones` so the caller can surface it - the
 * reference logs and draws, and a port that throws instead drops a
 * whole retail hand over one absent finger bone.
 * The skin's root bone follows the same name mapping, falling back to
 * the part's declared root when the base has no node of that name.
 *
 * Unskinned batches come back under `attached` with their flattened
 * (part-root-relative) geometry; the caller places them with
 * attachmentTransform each frame.
 *
 * @param {object} skeleton - buildSkeleton(baseNif)
 * @param {{records:object[], roots:number[]}} partNif
 * @param {{attachBone?: string}} [opts] - bone name for unskinned
 *   batches; default is the base skeleton's root.
 */
/**
 * RULE 14: `BoneOffset`, a named node inside the part mesh whose matrix
 * TRANSLATION becomes the attachment offset (attach.cpp:146-163).
 *
 *   FindByNameVisitor findBoneOffset("BoneOffset");
 *   clonedToAttach->accept(findBoneOffset);
 *   ...
 *   trans->setPosition(boneOffset->getMatrix().getTrans());
 *   // Now that we used it, get rid of the redundant node.
 *
 * Four details, each of which a port gets wrong by not reading the
 * visitor (components/sceneutil/visitor.cpp:18-47):
 *
 *  1. the name test is `Misc::StringUtils::ciEqual` - CASE-INSENSITIVE
 *     EXACT equality, not a prefix and not case-sensitive;
 *  2. the traversal is depth-first PRE-ORDER and stops at the first
 *     match (`if (!mFoundNode && !checkGroup(group)) traverse(group)`),
 *     and once found nothing further is examined;
 *  3. `apply(osg::Geometry&)` is an EMPTY override, so a DRAWABLE named
 *     BoneOffset is neither matched nor descended into - only groups and
 *     transforms can be the offset node;
 *  4. it is the node's OWN LOCAL translation (`getMatrix().getTrans()`),
 *     not its accumulated world position.
 *
 * AND IT IS ONLY REMOVED WHEN IT IS A LEAF: `if (getNumChildren() == 0
 * && getNumParents() == 1)`. A BoneOffset node WITH children keeps
 * transforming them and the offset is applied on top of that as well -
 * which falls out for free here, because the flattener has already baked
 * the node's transform into anything beneath it and this offset is added
 * afterwards.
 *
 * WHERE IT LANDS. OSG inserts a PositionAttitudeTransform between the
 * attach bone and the part, and a PAT is T(position) * R(attitude) *
 * S(scale) - the same transform rule 13's mirror scale rides. So the
 * offset is applied AFTER the mirror, in the BONE's space:
 *
 *   world = boneMatrix * (translate(offset) * mirror(v))
 *
 * Absent from the reverted arc entirely, and absent from this port until
 * MW-D13 - which means every rigid part whose mesh carries the node has
 * been drawn at the bone's bare origin.
 *
 * @returns {[number,number,number]|null}
 */
export function findNodeByName(nif, name) {
  const want = String(name).toLowerCase();
  let found = null;
  const walk = (ref, parents) => {
    if (found) return;
    const rec = deref(nif, ref);
    if (!rec) return;
    // apply(osg::Geometry&) {} - a drawable is neither matched nor
    // descended into.
    if (rec.type === 'NiTriShape' || rec.type === 'NiTriStrips') return;
    if (String(rec.name || '').toLowerCase() === want) { found = { rec, parents }; return; }
    if (!rec.children) return;
    const chain = [...parents, rec];
    for (const child of rec.children) if (child >= 0) walk(child, chain);
  };
  for (const root of nif.roots ?? []) {
    if (root >= 0) walk(root, []);
    if (found) break;
  }
  return found;
}

/** Rule 14's own use of it. */
export function boneOffsetOf(nif) {
  const hit = findNodeByName(nif, 'BoneOffset');
  if (!hit) return null;
  const t = hit.rec.translation;
  return t ? [t[0], t[1], t[2]] : [0, 0, 0];
}

/**
 * MW-D16: THE ACCUMULATED transform of a named node INSIDE a mesh,
 * root-first, which is what `getInstance(model, parent)` means when the
 * parent is a node several levels down someone else's file.
 *
 * Rule 34 has already wiped the root's transform by the time this runs
 * (it happens in the parser), so the chain this composes is exactly the
 * chain the reference's scene graph would carry.
 *
 * @returns {{a: Float32Array, t: number[]}|null} an affine, or null when
 *   the mesh has no such node.
 */
export function nodeTransformOf(nif, name) {
  const hit = findNodeByName(nif, name);
  if (!hit) return null;
  let m = { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 0, 0] };
  for (const node of [...hit.parents, hit.rec]) {
    const local = affineOf(node);
    m = mulAffine(m, local);
  }
  return m;
}

const affineOf = (rec) => {
  const a = new Float32Array(9);
  const s = rec.scale ?? 1;
  for (let i = 0; i < 9; i++) a[i] = (rec.rotation ? rec.rotation[i] : (i % 4 === 0 ? 1 : 0)) * s;
  const t = rec.translation || [0, 0, 0];
  return { a, t: [t[0], t[1], t[2]] };
};

const mulAffine = (p, l) => {
  const a = new Float32Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      a[r * 3 + c] = p.a[r * 3] * l.a[c] + p.a[r * 3 + 1] * l.a[3 + c] + p.a[r * 3 + 2] * l.a[6 + c];
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
};

export function bindPart(skeleton, partNif, opts = {}) {
  const batches = flattenNif(partNif);
  const skinned = [];
  const attached = [];
  const missingBones = new Set();
  for (const batch of batches) {
    if (!batch.skinned || !batch.skin) {
      attached.push(batch);
      continue;
    }
    const skin = batch.skin;
    // RULE 40: A MISSING BONE IS NOT FATAL. The reference logs
    // "RigGeometry did not find bone", stores nullptr, and skips every
    // influence naming it in the blend (riggeometry.cpp:195-196) - it
    // does NOT abort the part. This used to THROW here, which on a
    // retail mesh weighting one bone the first-person skeleton lacks
    // (a finger, say) dropped the WHOLE hand where the reference draws
    // it. The ref is null now, skinBatch skips it, and the caller gets
    // the names so the card can say what was skipped.
    const bones = skin.bones.map((bone) => {
      const ref = skeleton.byName.get(bone.name);
      if (ref === undefined) {
        missingBones.add(bone.name);
        return { ...bone, ref: null };
      }
      return { ...bone, ref };
    });
    // MW-D20: A REBOUND PART LIVES IN GRAPH SPACE, FULL STOP. The port
    // used to resolve the part's declared skin-root NAME into the base
    // skeleton and make matrices relative to whatever node answered -
    // an invention the reference has no counterpart for. In OpenMW the
    // copied rig looks its root name up on its own RENDER path
    // (updateSkinToSkelMatrix, riggeometry.cpp:288-324), where a base
    // skeleton bone can never appear, so the lookup ALWAYS falls back
    // to "cancel the copied chain" and bone matrices stay in the one
    // space below the Skeleton group - root transform included. Two
    // parts declaring different roots therefore pose in the SAME space
    // in the reference and posed in DIFFERENT spaces here: on retail
    // data that is a hand floating away from the forearm it belongs
    // to, and on every fixture (identity roots throughout) it was
    // invisible.
    batch.skin = { ...skin, bones, skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT };
    skinned.push(batch);
  }
  let attachRef = null;
  let boneOffset = null;
  if (attached.length) {
    const name = (opts.attachBone || '').toLowerCase();
    attachRef = name ? skeleton.byName.get(name) : firstRoot(skeleton);
    if (attachRef === undefined) {
      throw new Error(`bindPart: base skeleton has no bone "${opts.attachBone}" to attach to`);
    }
    // Rule 14. Only the ATTACHED (rigid) path takes it: the skinned
    // branch of attach() returns before the visitor ever runs, because a
    // skinned part is placed by its own bones and has no attach node to
    // offset from.
    boneOffset = boneOffsetOf(partNif);
  }
  return { skinned, attached, attachRef, boneOffset, missingBones: [...missingBones] };
}

function firstRoot(skeleton) {
  for (const [ref, node] of skeleton.nodes) {
    if (node.parent < 0) return ref;
  }
  return -1;
}

/**
 * Where an attached (unskinned) part sits this frame: the attach bone's
 * skeleton-space affine. Geometry stays as flattened (part-root
 * relative); the renderer applies this on top.
 * @param {Map} skelMats - skeletonSpaceMatrices(...) for the frame.
 */
export function attachmentTransform(skelMats, attachRef) {
  return skelMats.get(attachRef) ?? { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 0, 0] };
}

export { skeletonSpaceMatrices };
