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
  if (attached.length) {
    const name = (opts.attachBone || '').toLowerCase();
    attachRef = name ? skeleton.byName.get(name) : firstRoot(skeleton);
    if (attachRef === undefined) {
      throw new Error(`bindPart: base skeleton has no bone "${opts.attachBone}" to attach to`);
    }
  }
  return { skinned, attached, attachRef };
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
