// MW-BOW1 (FIELD BUGS 2026-10-09g, the owner: "the arrow on the morrowind weapon isnt shown be drawn and shot, or it's
// misalligned", after MW-D16, MW-D42 and MW-D50 each found the arrow placed by the reference and the report came back):
// A PART THAT MOVES ON ITS OWN CLOCK.
//
// A Morrowind bow is not a rigid stick. Its mesh carries the whole BowAndArrow group's motion baked in - the limbs and
// the string drawing back, and the ArrowBone the arrow hangs from, travelling from the quiver to the string and back
// with it. OpenMW's own words: "OpenMW attaches arrow to the ArrowBone node from bow mesh, so arrow fetching animation
// is baked into bow mesh" (OpenMW issue 5642), and "the engine keeps bow animation (i.e the bow deforming while string
// is being pulled) in sync with character bow drawing animation by the means of a primitive frame offset counted from
// the beginning of the whole animation group" (issue 9322). The mechanism:
//
//   npcanimation.cpp addOrReplaceIndividualPart  PRT_Weapon's controllers take mWeaponAnimationTime (an
//                                                AssignControllerSourcesVisitor: a controller with no source yet)
//   weaponanimation.cpp WeaponAnimationTime      getCurrentTime(weapon group) - getStartTime(group) when relative,
//                                                0 when the group has no state
//   character.cpp setWeaponGroup                 "controllers for ranged weapon should use time for beginning of
//                                                animation to play shooting properly" - relative for Ranged ALONE
//   nifloader.cpp setupController                an AutoPlay node's controllers run on frame time instead
//   nifosg/controller.cpp KeyframeController     the node's keyframes over its rest ([B]: no rotation keys is the rest)
//   nifloader.cpp handleMorphGeometry            an unskinned shape's first ACTIVE NiGeomMorpherController whose base
//                                                morph has the shape's vertex count
//   morphgeometry.cpp MorphGeometry::cull        base + sum(weight_i * morph_i), morph 0 the base and never weighted
//   controller.cpp GeomMorpherController         each morph's weight its own keys at the controller's time (no keys: 0)
//
// The port flattened the bow ONCE at its rest pose (formats/mwNifMesh.js flattenNif) and baked the ArrowBone's rest
// chain into the arrow (resolveWeaponParts' preTransform): a bow that never drew, and an arrow that sat wherever the
// mesh's rest pose left the node, shown from the draw to the loose. This module is the clock's half, pure - no GL:
// `partClockOf(nif)` reads what moves, once per parsed file; `posePartBatch` and `nodeAffineAt` answer a time.
import { deref } from './mwNifFile.js';
import { composeTransform, mat33Apply, GEOMETRY_TYPES } from './mwNifMesh.js';
import { findNodeByName } from './mwCharacter.js';
import { quatToMat33 } from './mwSkin.js';
import { trackFromController, sampleTrack } from './mwAnim.js';
import { sampleKeyGroup } from './mwKeys.js';
import { controllerTime, PARTICLE_FLAG_AUTOPLAY } from './mwParticles.js';
import { activeControllers, timingOf } from './mwVfx.js';

const REST_IDENTITY = Object.freeze({ rotation: Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]), translation: Object.freeze([0, 0, 0]), scale: 1 });

/** Nif::NiNode::AnimFlag_AutoPlay - the same bit the particle systems read (nifloader.cpp setupController). */
export const ANIM_FLAG_AUTOPLAY = PARTICLE_FLAG_AUTOPLAY;

const CLOCKS = new WeakMap();

/**
 * WHAT MOVES IN A PART, read once per parsed file:
 *   tracks  Map(record -> keyframe track + its controller timing) - any node or shape with an active
 *           NiKeyframeController that has data (the first, as the reference's chain walk takes it)
 *   morphs  Map(shape record -> { base, targets: [{ vectors, keys }], timing }) - an unskinned shape's first active
 *           NiGeomMorpherController whose base morph matches the shape's vertex count, with more than one morph
 *   animated  whether anything does
 */
export function partClockOf(nif) {
  let pc = CLOCKS.get(nif);
  if (pc) return pc;
  const tracks = new Map();
  const morphs = new Map();
  for (const rec of nif.records ?? []) {
    if (!rec || !(rec.controller >= 0)) continue;
    for (const c of activeControllers(nif, rec)) {
      if (c.type === 'NiKeyframeController' && !tracks.has(rec)) {
        const track = trackFromController(nif, c);
        if (track) tracks.set(rec, { ...track, timing: timingOf(c) });
      } else if (c.type === 'NiGeomMorpherController' && !morphs.has(rec) && GEOMETRY_TYPES.has(rec.type) && !(rec.skin >= 0)) {
        const md = deref(nif, c.data);
        const shapeData = deref(nif, rec.data);
        const list = md?.morphs ?? [];
        // handleMorphGeometry's two refusals: no morphs, or a base that is not this shape's; and the controller's own
        // (`mKeyFrames.size() <= 1`): a base alone moves nothing
        if (list.length > 1 && shapeData?.vertices && list[0].vectors.length === shapeData.vertices.length) {
          morphs.set(rec, { base: list[0].vectors, targets: list.slice(1).map((m) => ({ vectors: m.vectors, keys: m.keys })), timing: timingOf(c) });
        }
      }
    }
  }
  pc = { tracks, morphs, animated: tracks.size > 0 || morphs.size > 0 };
  CLOCKS.set(nif, pc);
  return pc;
}

/** A record's local transform at `value` on its clock: its keyframe track over its rest. */
function localAt(pc, rec, value) {
  const rest = { rotation: rec.rotation ?? REST_IDENTITY.rotation, translation: rec.translation ?? REST_IDENTITY.translation, scale: rec.scale ?? 1 };
  const track = pc.tracks.get(rec);
  if (!track) return rest;
  const s = sampleTrack(track, controllerTime(track.timing, value));
  return {
    rotation: s.rotation ? quatToMat33(s.rotation) : rest.rotation,
    translation: s.translation ?? rest.translation,
    scale: s.scale ?? rest.scale,
  };
}

/** The transform a chain of records (file root first) composes at `value` - flattenNif's own composition, moved. */
export function chainAt(pc, chain, value) {
  let w = REST_IDENTITY;
  for (const rec of chain) w = composeTransform(w, localAt(pc, rec, value));
  return w;
}

/** The shape's vertices at `value`, morphed - null for a shape no morpher moves. */
export function morphedAt(pc, shape, value) {
  const m = pc.morphs.get(shape);
  if (!m) return null;
  const t = controllerTime(m.timing, value);
  const out = Float32Array.from(m.base);
  for (const target of m.targets) {
    const w = target.keys?.keys?.length ? sampleKeyGroup(target.keys, 1, t) : 0;
    if (!w) continue;
    const v = target.vectors;
    for (let i = 0; i < out.length; i++) out[i] += v[i] * w;
  }
  return out;
}

/** The clock a batch's controllers read: the part's own (`value`) - or frame time under an AutoPlay node. */
export const clockFor = (animFlags, value, frameTime) => ((animFlags & ANIM_FLAG_AUTOPLAY) !== 0 ? frameTime : value);

/** Does anything move this batch - a morph on its shape, or a keyframe track anywhere on its chain? */
export function batchMoves(nif, batch) {
  if (!batch?.chain) return false;
  const pc = partClockOf(nif);
  return pc.animated && (pc.morphs.has(batch.ref) || batch.chain.some((r) => pc.tracks.has(r)));
}

/**
 * A RIGID BATCH OF A PART, POSED AT `value`: its vertices (morphed) through its chain's transform at that time, into
 * `out` (and its normals, rotated, into `outNormals`) - exactly what flattenNif bakes at the rest pose. `batch` is
 * flattenNif's ({ ref, chain, local, localNormals, animFlags }). False, and nothing written, when nothing in its chain
 * or on it moves.
 */
export function posePartBatch(nif, batch, value, out, outNormals = null, frameTime = value) {
  if (!batchMoves(nif, batch)) return false;
  const pc = partClockOf(nif);
  const t = clockFor(batch.animFlags | 0, value, frameTime);
  const w = chainAt(pc, batch.chain, t);
  const verts = morphedAt(pc, batch.ref, t) ?? batch.local;
  for (let i = 0; i + 2 < verts.length && i + 2 < out.length; i += 3) {
    const [x, y, z] = mat33Apply(w.rotation, verts[i] * w.scale, verts[i + 1] * w.scale, verts[i + 2] * w.scale);
    out[i] = x + w.translation[0]; out[i + 1] = y + w.translation[1]; out[i + 2] = z + w.translation[2];
  }
  if (outNormals && batch.localNormals) {
    const n = batch.localNormals;
    for (let i = 0; i + 2 < n.length && i + 2 < outNormals.length; i += 3) {
      const [x, y, z] = mat33Apply(w.rotation, n[i], n[i + 1], n[i + 2]);
      outNormals[i] = x; outNormals[i + 1] = y; outNormals[i + 2] = z;
    }
  }
  return true;
}

const CHAINS = new WeakMap();
/** The records from the file root down to the node of that name (rule 14's visitor: case-insensitive, pre-order). */
function chainTo(nif, name) {
  let byName = CHAINS.get(nif);
  if (!byName) CHAINS.set(nif, (byName = new Map()));
  const key = String(name).toLowerCase();
  if (!byName.has(key)) {
    const hit = findNodeByName(nif, name);
    byName.set(key, hit ? [...hit.parents, hit.rec] : null);
  }
  return byName.get(key);
}

/**
 * THE NODE A PART HANGS FROM, AT `value`: the affine ({a: rotation*scale, t}, nodeTransformOf's shape) from the file
 * root to the named node - the ArrowBone the arrow is instanced under. Null when the file has no such node, or nothing
 * on its chain moves (the rest pose nodeTransformOf already bakes stands).
 */
export function nodeAffineAt(nif, name, value, frameTime = value) {
  const pc = partClockOf(nif);
  if (!pc.animated) return null;
  const chain = chainTo(nif, name);
  if (!chain || !chain.some((r) => pc.tracks.has(r))) return null;
  // the node's own AutoPlay is the nearest animation node's flag above it, as flattenNif carries animFlags down
  let flags = 0;
  for (const r of chain) if (r.type === 'NiBSAnimationNode' || r.type === 'NiBSParticleNode') flags = r.flags | 0;
  const w = chainAt(pc, chain, clockFor(flags, value, frameTime));
  const a = new Float32Array(9);
  for (let i = 0; i < 9; i++) a[i] = w.rotation[i] * w.scale;
  return { a, t: [w.translation[0], w.translation[1], w.translation[2]] };
}
