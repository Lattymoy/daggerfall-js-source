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
import { skeletonSpaceMatrices } from './mwSkin.js';

/**
 * Rebind one part's batches onto the base skeleton.
 *
 * Skinned batches get their skin payload's bone refs remapped by NAME
 * into the base skeleton (a missing bone throws, naming it - a part that
 * doesn't fit the skeleton is a data problem to surface, not to hide).
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
export function boneOffsetOf(nif) {
  const WANT = 'boneoffset';
  let found = null;
  const walk = (ref) => {
    if (found) return;
    const rec = deref(nif, ref);
    if (!rec) return;
    // apply(osg::Geometry&) {} - a drawable is neither matched nor
    // descended into.
    if (rec.type === 'NiTriShape' || rec.type === 'NiTriStrips') return;
    if (String(rec.name || '').toLowerCase() === WANT) {
      const t = rec.translation;
      found = t ? [t[0], t[1], t[2]] : [0, 0, 0];
      return;
    }
    if (!rec.children) return;
    for (const child of rec.children) if (child >= 0) walk(child);
  };
  for (const root of nif.roots ?? []) {
    if (root >= 0) walk(root);
    if (found) break;
  }
  return found;
}

export function bindPart(skeleton, partNif, opts = {}) {
  const batches = flattenNif(partNif);
  const skinned = [];
  const attached = [];
  for (const batch of batches) {
    if (!batch.skinned || !batch.skin) {
      attached.push(batch);
      continue;
    }
    const skin = batch.skin;
    const bones = skin.bones.map((bone) => {
      const ref = skeleton.byName.get(bone.name);
      if (ref === undefined) {
        throw new Error(`bindPart: base skeleton has no bone "${bone.name}"`);
      }
      return { ...bone, ref };
    });
    const partRootName = (deref(partNif, skin.skeletonRoot)?.name || '').toLowerCase();
    const rootRef = skeleton.byName.get(partRootName);
    const skeletonRoot = rootRef !== undefined ? rootRef : firstRoot(skeleton);
    batch.skin = { ...skin, bones, skeletonRoot, rootBone: skeletonRoot };
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
  return { skinned, attached, attachRef, boneOffset };
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
