// MW-SPELLFX1 (2026-10-07, Mac: "We need to implement morrowind spell casting effects and animations"): A MORROWIND
// EFFECT MESH, RUNNING.
//
// Morrowind draws its magic with records that name meshes - an MGEF's casting, bolt, hit and area visuals, and
// VFX_Hands - and those meshes carry their own motion: keyframed nodes that spin and swell, visibility keys, alpha and
// colour ramps on their materials, scrolling UVs, flipbook textures, billboards and particle systems. OpenMW instances
// the mesh and runs every controller on the effect's OWN clock, an EffectAnimationTime that starts at zero
// (mwrender/animation.cpp Animation::addEffect, mwrender/effectmanager.cpp EffectManager::addEffect - the
// AssignControllerSourcesVisitor hands it to every controller that has no source yet); the effect is over when that
// clock reaches the longest controller's stop time (FindMaxControllerLengthVisitor over ControllerFunction::getMaximum,
// which is mStopTime), and is hidden at once unless it loops, when the remainder carries (UpdateVfxCallback).
//
// This module is that, pure - no GL. `vfxOf(nif)` reads a parsed file once into a descriptor; `createVfx(desc)` is one
// running instance whose `update(dt, ...)` advances the clock, poses the graph and answers PACKED STREAMS in
// mwParticles.js's own format (centre, corner, uv, colour, size), so the renderer's particle program draws an effect's
// triangles and its particles alike: a triangle's three vertices carry corner (0, 0) and size 0, which the program
// places exactly where they are.
//
// THE REFERENCE, member by member:
//   nifosg/nifloader.cpp   handleNode (:700-940): "Bounding Box" and the collision node, the hidden flag that skips a
//                          subtree's meshes unless the node carries a NiVisController (:826-843), the geometry name
//                          skip list (:857-868), the switch's one branch; handleMeshControllers (:972-998): a UV
//                          controller lives on the GEOMETRY, nowhere else; handleNodeControllers: keyframes and
//                          visibility on any AV object; handleMaterialControllers / handleTextureControllers: alpha
//                          and colour ramps on the NiMaterialProperty, the flipbook on the NiTexturingProperty, both
//                          riding the node that lists the property; createNode (:676-705): a NiBillboardNode is an
//                          AutoTransform; the first-root texture (:524-539): the ROOT's first NiTexturingProperty is
//                          remembered, and any other node listing that same record is marked "overrideFx"
//   nifosg/controller.cpp  ControllerFunction::calculate (mwParticles.controllerTime); KeyframeController (:179-200 -
//                          a missing rotation rewrites the rest rotation, a missing translation or scale writes nothing:
//                          Morrowind-Rules.md [B]); VisController::calculate (:364-377 - upper_bound, the key at or
//                          before); AlphaController (:434-464 - the "alpha" uniform, 1 with no keys); MaterialColor-
//                          Controller (:466-540 - the target in the flags, (1,1,1) with no keys); UVController::apply
//                          (:316-337 - scaled about the centre, then the offset, U negated); FlipController::apply
//                          (:567-578 - int(t / delta) % count; delta 0 holds the first)
//   nifosg/autotransform.cpp  computeMatrixForFrame: the three billboard modes (rule 60 and its [B] refinement)
//   nifosg/nifloader.cpp   handleParticleSystem (:1470-1570): LocalSpace keeps the particles in the node's space,
//                          anything else in the WORLD under an InverseWorldMatrix - sized in world units, emitted
//                          through the emitter's orthonormalised world frame (particle.cpp :548)
//   mwrender/util.cpp      overrideFirstRootTexture: the effect's particle texture (an MGEF's PTEX) on every marked
//                          node, OVERRIDE, clamped at the edge
//
// THE FRAMES. `place` carries the effect into the MORROWIND world (units, Z up) and `view` carries that world into the
// space the caller draws in. They are kept apart because a world-frame particle lives in the Morrowind world: OpenMW
// keeps it there, so its size and speed are the file's own whatever the effect's scale (an area burst spawned at
// twenty times its size throws sparks of the size the artist drew), and a moving bolt leaves its sparks behind.
//
// WHAT IS NOT CARRIED, recorded:
//   - LIGHTING. OpenMW lights an effect under a white ambient (configureSunAmbientOverride, "Morrowind has a white
//     ambient light attached to the root VFX node"); here a surface's colour is its emission plus its ambient under
//     that white light, with no sun and no lamps. Morrowind's effects are emissive or additive almost to the last
//     shape, which is what this keeps.
//   - AutoPlay's FRAME clock (setupController): every controller here runs on the effect's clock, so a cycling
//     controller under an AutoPlay node starts its loop at zero rather than at the game's time - the same motion in
//     another phase.
//   - NiRollController, NiPathController, NiLookAtController, NiGeomMorpherController: parsed, not run.
//   - NiBSPArrayController's emission over a target's vertices (mwParticles.js refuses it, by name).
//   - SORTING. The reference sorts the transparent bin back to front; these streams draw in file order. An additive
//     effect - nearly all of them - does not care.
//   - A FLIPBOOK UNDER THE OVERRIDE. Where a marked node's subtree also flips its own textures, the override wins here
//     (the reference's answer turns on which stateset the flip writes); no retail effect is known to do both.

import { deref } from './mwNifFile.js';
import {
  resolveMaterial, skipGeometryName, stripsToTriangles, hasMarkerFlag, selectedChild,
  ANIM_FLAG_NODES, NODE_TYPES, GEOMETRY_TYPES, PARTICLE_TYPES, VERTEX_COLOR_MODE,
} from './mwNifMesh.js';
import { quatToMat33 } from './mwSkin.js';
import { affineOfTransform, affineMul, affineApply, affineRotate, AFFINE_IDENTITY } from './mwAffine.js';
import { sampleKeyGroup } from './mwKeys.js';
import { trackFromController, sampleTrack } from './mwAnim.js';
import {
  particleSystemsOf, createParticleSystem, controllerTime, packParticleQuads, particleDrawState, affineInverse,
  affineScale, affineOrthoNormalize, PARTICLE_FLOATS, CONTROLLER_FLAG_ACTIVE,
} from './mwParticles.js';

/** NiTimeController's clock terms, as controllerTime takes them (the extrapolation bits unshifted, EXTRAPOLATION). */
export const timingOf = (c) => ({ frequency: c.frequency, phase: c.phase, startTime: c.startTime, stopTime: c.stopTime, extrapolation: c.flags & 0x6 });

/** Every ACTIVE controller on a record's chain (the reference makes no other), in chain order. MW-BOW1: exported - a
 *  part's own clock (formats/mwPartClock.js) reads the same chain. */
export function activeControllers(nif, rec) {
  const out = [];
  const seen = new Set();
  for (let ref = rec?.controller ?? -1; ref >= 0 && !seen.has(ref);) {
    seen.add(ref);
    const c = deref(nif, ref);
    if (!c) break;
    if (c.flags & CONTROLLER_FLAG_ACTIVE) out.push(c);
    ref = c.next;
  }
  return out;
}

/** NiMaterialColorController's target (nif/controller.cpp: `(mFlags >> 4) & 3` in a 4.0.0.2 file). */
export const COLOR_TARGET = Object.freeze({ Ambient: 0, Diffuse: 1, Specular: 2, Emissive: 3 });
/** NiBillboardNode's modes (nif/node.hpp), read off a 4.0.0.2 node's flags as `(flags >> 5) & 3`. */
export const BILLBOARD_MODE = Object.freeze({ AlwaysFaceCamera: 0, RotateAboutUp: 1, RigidFaceCamera: 2, AlwaysFaceCenter: 3 });
/** overrideTexture's wrap: CLAMP_TO_EDGE on both axes - NiTexturingProperty's clamp mode 0. */
export const OVERRIDE_CLAMP_MODE = 0;

/** The controllers a property chain hands its drawable: the NEAREST NiMaterialProperty's alpha and colour ramps and the
 *  nearest NiTexturingProperty's flipbook (a nearer property of the kind replaces the farther, controllers and all). */
function propertyControllers(nif, chain, grow) {
  const last = (type) => {
    for (let i = chain.length - 1; i >= 0; i--) { const r = deref(nif, chain[i]); if (r?.type === type) return r; }
    return null;
  };
  const out = { alpha: null, color: null, flip: null };
  for (const c of activeControllers(nif, last('NiMaterialProperty'))) {
    const d = deref(nif, c.data);
    if (c.type === 'NiAlphaController' && d?.data) { out.alpha = { group: d.data, timing: timingOf(c) }; grow(c); }
    else if (c.type === 'NiMaterialColorController' && d?.data) { out.color = { group: d.data, target: (c.flags >> 4) & 3, timing: timingOf(c) }; grow(c); }
  }
  for (const c of activeControllers(nif, last('NiTexturingProperty'))) {
    if (c.type !== 'NiFlipController') continue;
    // handleTextureControllers skips an empty source; a source with no external name keeps its slot and draws the base
    const files = (c.sources ?? []).filter((s) => s >= 0).map((s) => deref(nif, s)).map((s) => (s && s.external && s.fileName ? s.fileName : null));
    if (files.length) { out.flip = { files, delta: c.delta, timing: timingOf(c) }; grow(c); }
  }
  return out;
}

/**
 * THE EFFECT, READ ONCE. `nif` is parseNif's answer. Plain data, shared by every instance:
 *   nodes      Map(ref -> { ref, parent, name, rest: {rotation (3x3, no scale), translation, scale}, billboard (a mode
 *              or null), hidden, track, vis }) - every node, shape and particle geometry, parents first
 *   shapes     [{ ref, name, positions, uvs, colors, indices, material, alpha, color, uv, flip, override }]
 *   particles  [{ desc (mwParticles' descriptor), node, emitter, alpha, flip, override }]
 *   length     the longest active controller's stop time - the effect's life (0: no controller, gone at once)
 */
export function vfxOf(nif) {
  const nodes = new Map();
  const shapes = [];
  const particleChains = new Map();   // particle geometry ref -> { chain, override }
  let length = 0;
  const grow = (c) => { if (Number.isFinite(c?.stopTime)) length = Math.max(length, c.stopTime); };
  const rootRec = deref(nif, nif.roots.find((r) => r >= 0) ?? -1);
  // :527-533 - the ROOT's first NiTexturingProperty: what an effect's particle texture replaces
  const rootTex = (rootRec?.properties ?? []).find((p) => deref(nif, p)?.type === 'NiTexturingProperty') ?? -1;
  const hasMarkers = rootRec ? hasMarkerFlag(nif, rootRec) : false;

  const visit = (ref, parent, chain, animFlags, overridden, skipMeshes, isRoot) => {
    const rec = deref(nif, ref);
    if (!rec) return;
    if (!isRoot && String(rec.name || '').toLowerCase() === 'bounding box') return;   // rule 58 (1)
    if (rec.type === 'RootCollisionNode') return;   // rule 58 (2): hidden, its meshes skipped - nothing of it draws
    const isNode = NODE_TYPES.has(rec.type);
    const isShape = GEOMETRY_TYPES.has(rec.type);
    const isParticles = PARTICLE_TYPES.has(rec.type);
    if (!isNode && !isShape && !isParticles) return;
    const flags = ANIM_FLAG_NODES.has(rec.type) ? rec.flags | 0 : animFlags;
    const own = (rec.properties ?? []).filter((p) => p >= 0);
    // :535-538 - any node but the root that lists the root's texturing property is marked, and OVERRIDE carries the
    // texture over its whole subtree
    const marked = overridden || (!isRoot && rootTex >= 0 && own.includes(rootTex));
    const nextChain = own.length ? [...chain, ...own] : chain;
    const controllers = activeControllers(nif, rec);
    const hidden = (rec.flags & 1) !== 0;
    const hasVis = controllers.some((c) => c.type === 'NiVisController');
    const entry = {
      ref, parent, name: rec.name || '',
      rest: { rotation: Float32Array.from(rec.rotation ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]), translation: [...(rec.translation ?? [0, 0, 0])], scale: rec.scale ?? 1 },
      billboard: rec.type === 'NiBillboardNode' ? (rec.flags >> 5) & 3 : null,
      hidden, track: null, vis: null,
    };
    for (const c of controllers) {
      if (c.type === 'NiKeyframeController') {
        const track = trackFromController(nif, c);
        if (track) { entry.track = { ...track, timing: timingOf(c) }; grow(c); }
      } else if (c.type === 'NiVisController') {
        const data = deref(nif, c.data);
        entry.vis = { keys: data?.keys ?? [], timing: timingOf(c) };
        grow(c);
      }
    }
    nodes.set(ref, entry);
    // :826-843 - a hidden node with no visibility controller skips every mesh beneath it
    const skip = skipMeshes || (hidden && !hasVis);
    if (isParticles) {
      if (!skip && !skipGeometryName(rec.name, hasMarkers)) particleChains.set(ref, { chain: nextChain, override: marked });
      return;
    }
    if (isNode) {
      const only = selectedChild(rec);
      const kids = only !== null ? [rec.children?.[only]] : (rec.children ?? []);
      for (const child of kids) if (child !== undefined && child >= 0) visit(child, ref, nextChain, flags, marked, skip, false);
      return;
    }
    if (skip || rec.skin >= 0 || skipGeometryName(rec.name, hasMarkers)) return;   // a skinned shape is no effect's
    const data = deref(nif, rec.data);
    if (!data || !data.vertices) return;
    const indices = rec.type === 'NiTriStrips' ? stripsToTriangles(data) : Uint16Array.from(data.triangles ?? []);
    if (!indices.length) return;
    const props = nextChain.map((p) => deref(nif, p)).filter(Boolean);
    const shape = {
      ref, name: rec.name || '',
      positions: Float32Array.from(data.vertices),
      uvs: data.uvSets?.length ? Float32Array.from(data.uvSets[0]) : null,
      colors: data.colors ? Float32Array.from(data.colors) : null,
      indices,
      material: resolveMaterial(nif, props, !!data.colors),
      uv: null,
      override: marked,
      ...propertyControllers(nif, nextChain, grow),
    };
    for (const c of controllers) {
      if (c.type !== 'NiUVController') continue;
      const d = deref(nif, c.data);
      if (d?.groups) { shape.uv = { groups: d.groups, timing: timingOf(c) }; grow(c); }
    }
    shapes.push(shape);
  };
  for (const r of nif.roots) if (r >= 0) visit(r, -1, [], 0, false, false, true);

  // the particle systems through mwParticles' own walk, each tied to its node in this graph by its record - from the
  // roots that are scene objects (a .kf's NiSequence root has no transform to compose)
  const particles = [];
  const sceneRoots = nif.roots.filter((r) => r >= 0 && deref(nif, r)?.rotation);
  for (const desc of particleSystemsOf(sceneRoots.length === nif.roots.length ? nif : { ...nif, roots: sceneRoots }, { includeHidden: true })) {
    const own = particleChains.get(desc.ref);
    if (!own) continue;   // under a hidden node with no visibility controller, or skipped by name: never drawn
    grow(desc.controller);
    const { alpha, flip } = propertyControllers(nif, own.chain, grow);
    particles.push({ desc, node: desc.ref, emitter: desc.emitter ? desc.emitter.ref : null, alpha, flip, override: own.override });
  }
  return { nodes, shapes, particles, length };
}

/** VisController::calculate - the key at or before the time (upper_bound, then one back); no keys is visible. */
export function visAt(keys, time) {
  if (!keys || !keys.length) return true;
  let lo = 0; let hi = keys.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (time < keys[mid].time) hi = mid; else lo = mid + 1; }
  return !!keys[Math.max(0, lo - 1)].value;
}

/** UVController::apply's texture matrix on one coordinate pair: scaled about (0.5, 0.5), then offset - U's negated. */
export function uvAt(u, v, { uTrans = 0, vTrans = 0, uScale = 1, vScale = 1 }) {
  return [(u - 0.5) * uScale + 0.5 - uTrans, (v - 0.5) * vScale + 0.5 + vTrans];
}

/** FlipController::apply's slot: int(t / delta) % count, and the first when delta is 0. */
export function flipIndex(time, delta, count) {
  if (!(count > 0)) return -1;
  if (!delta) return 0;
  const i = Math.trunc(time / delta) % count;
  return i < 0 ? i + count : i;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * A surface's colour under the effect's white ambient (see the header), per vertex: rgb the emission plus the
 * ambient, the vertex colour SUBSTITUTED into the channel its mode names (rule 63); alpha the diffuse alpha - the
 * vertex's where it is the diffuse - times the AlphaController's uniform.
 */
export function shapeVertexColour(material, colors, i, alphaUniform = 1) {
  const vc = colors ? [colors[i * 4], colors[i * 4 + 1], colors[i * 4 + 2], colors[i * 4 + 3]] : null;
  const mode = material.vertexColorMode;
  const emissive = vc && mode === VERTEX_COLOR_MODE.Emission ? vc : material.emissive;
  const ambient = vc && (mode === VERTEX_COLOR_MODE.AmbientAndDiffuse || mode === VERTEX_COLOR_MODE.Ambient) ? vc : material.ambient;
  const diffuseA = vc && (mode === VERTEX_COLOR_MODE.AmbientAndDiffuse || mode === VERTEX_COLOR_MODE.Diffuse) ? vc[3] : material.alpha;
  return [clamp01(emissive[0] + ambient[0]), clamp01(emissive[1] + ambient[1]), clamp01(emissive[2] + ambient[2]), clamp01(diffuseA * alphaUniform)];
}

// ---- 3x3 helpers, row-major, column vectors (mwAffine's convention) --------
const m3mul = (a, b) => {
  const o = new Float32Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
};
/** The transpose applied - the inverse of a rotation. */
const m3tApply = (a, v) => [a[0] * v[0] + a[3] * v[1] + a[6] * v[2], a[1] * v[0] + a[4] * v[1] + a[7] * v[2], a[2] * v[0] + a[5] * v[1] + a[8] * v[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]; };
/** A 3x3 whose columns are the three vectors - an osg row matrix `set(r0, r1, r2)` read as a column-vector map. */
const fromColumns = (a, b, c) => Float32Array.from([a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]]);

/**
 * AutoTransform::computeMatrixForFrame's rotation (nifosg/autotransform.cpp), as the column-vector 3x3 the node's
 * local transform takes: `mat.getRotate() * mBaseRotation` is osg's "first mat, then the base", so R = base * mat.
 * `base` is the node's own rotation (its keyed one, [B]); `eye`, `look` and `up` are the cull stack's, in the node's
 * PARENT's space; `translation` is the node's own. A degenerate frame leaves `mat` the identity - the file's rotation
 * alone, as the reference's guards leave it.
 */
export function billboardRotation(mode, base, translation, eye, look, up) {
  let mat = null;
  if (mode === BILLBOARD_MODE.RotateAboutUp) {
    const d = m3tApply(base, [eye[0] - translation[0], eye[1] - translation[1], eye[2] - translation[2]]);
    const n = Math.hypot(d[0], d[2]);
    if (n > 1e-12) { const x = d[0] / n, z = d[2] / n; mat = fromColumns([z, 0, -x], [0, 1, 0], [x, 0, z]); }
  } else {
    // AlwaysFaceCamera, RigidFaceCamera - and the two "center" modes, which the reference builds with the DEFAULT mode,
    // RigidFaceCamera (rule 60)
    const relForward = norm(m3tApply(base, look));
    let relUp = m3tApply(base, up);
    const relRight = norm(cross(relUp, relForward));
    relUp = norm(cross(relForward, relRight));
    if (mode === BILLBOARD_MODE.AlwaysFaceCamera) {
      const n = Math.sqrt(relUp[1] * relUp[1] + relRight[1] * relRight[1]);
      if (n > 1e-6) {
        const cos = relUp[1] / n, sin = -relRight[1] / n;
        mat = fromColumns(
          [-relRight[0] * cos - relUp[0] * sin, -relRight[1] * cos - relUp[1] * sin, -relRight[2] * cos - relUp[2] * sin],
          [relUp[0] * cos - relRight[0] * sin, relUp[1] * cos - relRight[1] * sin, relUp[2] * cos - relRight[2] * sin],
          [-relForward[0], -relForward[1], -relForward[2]]);
      }
    } else {
      mat = fromColumns(relRight, relUp, relForward);
    }
  }
  return mat ? m3mul(base, mat) : Float32Array.from(base);
}

/** The node's local transform at `clock`, in parts: its keyframe track over its rest ([B]: no rotation keys is the rest
 *  rotation, no translation or scale keys leaves what was there). */
function localParts(node, clock) {
  const rest = node.rest;
  if (!node.track) return rest;
  const s = sampleTrack(node.track, controllerTime(node.track.timing, clock));
  return {
    rotation: s.rotation ? quatToMat33(s.rotation) : rest.rotation,
    translation: s.translation ? [s.translation[0], s.translation[1], s.translation[2]] : rest.translation,
    scale: s.scale ?? rest.scale,
  };
}

/** A direction through an affine's linear part alone. */
const turn = (m, v) => affineRotate(m, v[0], v[1], v[2]);

/**
 * ONE RUNNING EFFECT. `textureOverride` is its particle texture (an MGEF's PTEX), for the shapes and particle systems
 * the first-root rule marked; `rolls` the particles' dice; `loop` keeps it running past its length.
 *
 * `update(dt, { place, view, eye })` advances the clock by `dt` and answers the frame:
 *   `place`  the affine from the effect into the Morrowind world (units, Z up) - null is identity
 *   `view`   the affine from the Morrowind world into the space the caller draws in - null is identity
 *   `eye`    `{ position, look, up }` in the caller's space, for the billboards - null leaves them as authored
 * The answer: `{ time, done, streams: [{ key, packed, count, drawState, texture }] }`, every stream in the caller's
 * space (draw it with the identity model), `count` in vertices.
 */
export function createVfx(desc, { textureOverride = null, rolls = Math.random, loop = false } = {}) {
  let time = 0;
  let finished = false;
  const sims = desc.particles.map((p) => createParticleSystem(p.desc, { rolls }));
  const shapeBufs = desc.shapes.map(() => null);
  const partBufs = desc.particles.map(() => null);
  const worldOf = new Map();
  const visibleOf = new Map();
  const order = [...desc.nodes.keys()];   // the walk met parents first

  function pose(eyeLocal) {
    worldOf.clear(); visibleOf.clear();
    for (const ref of order) {
      const node = desc.nodes.get(ref);
      const parentW = node.parent >= 0 ? (worldOf.get(node.parent) ?? AFFINE_IDENTITY) : AFFINE_IDENTITY;
      const p = localParts(node, time);
      let rotation = p.rotation;
      if (node.billboard !== null && eyeLocal) {
        const inv = affineInverse(parentW);   // the cull stack's eye, look and up, in the PARENT's space
        const eye = affineApply(inv, eyeLocal.position[0], eyeLocal.position[1], eyeLocal.position[2]);
        rotation = billboardRotation(node.billboard, p.rotation, p.translation, eye, turn(inv, eyeLocal.look), turn(inv, eyeLocal.up));
      }
      worldOf.set(ref, affineMul(parentW, affineOfTransform({ rotation, translation: p.translation, scale: p.scale })));
      // rule 57: the hidden flag hides, and a visibility controller overrides it every frame
      const vis = node.vis ? visAt(node.vis.keys, controllerTime(node.vis.timing, time)) : !node.hidden;
      visibleOf.set(ref, vis && (node.parent >= 0 ? visibleOf.get(node.parent) ?? true : true));
    }
  }

  function textureOf(item, base) {
    if (item.override && textureOverride) return textureOverride;
    if (item.flip) return item.flip.files[flipIndex(controllerTime(item.flip.timing, time), item.flip.delta, item.flip.files.length)] ?? base;
    return base;
  }
  function drawStateOf(item, material) {
    const s = particleDrawState(material);
    return item.override && textureOverride ? { ...s, textureFile: textureOverride, clampMode: OVERRIDE_CLAMP_MODE } : s;
  }
  const alphaOf = (item) => (item.alpha ? sampleKeyGroup(item.alpha.group, 1, controllerTime(item.alpha.timing, time)) ?? 1 : 1);

  function packShape(i, shape, m) {
    let material = shape.material;
    if (shape.color) {
      const c = sampleKeyGroup(shape.color.group, 3, controllerTime(shape.color.timing, time)) ?? [1, 1, 1];
      const key = ['ambient', 'diffuse', null, 'emissive'][shape.color.target];
      if (key) material = { ...material, [key]: [c[0], c[1], c[2]] };
    }
    const alpha = alphaOf(shape);
    let uvT = null;
    if (shape.uv && shape.uvs) {
      const t = controllerTime(shape.uv.timing, time);
      const g = shape.uv.groups;
      uvT = { uTrans: sampleKeyGroup(g[0], 1, t) ?? 0, vTrans: sampleKeyGroup(g[1], 1, t) ?? 0, uScale: sampleKeyGroup(g[2], 1, t) ?? 1, vScale: sampleKeyGroup(g[3], 1, t) ?? 1 };
    }
    const n = shape.indices.length;
    const need = n * PARTICLE_FLOATS;
    let buf = shapeBufs[i];
    if (!buf || buf.length < need) buf = shapeBufs[i] = new Float32Array(need);
    let o = 0;
    for (let k = 0; k < n; k++) {
      const v = shape.indices[k];
      const p = affineApply(m, shape.positions[v * 3], shape.positions[v * 3 + 1], shape.positions[v * 3 + 2]);
      let u = shape.uvs ? shape.uvs[v * 2] : 0; let w = shape.uvs ? shape.uvs[v * 2 + 1] : 0;
      if (uvT) [u, w] = uvAt(u, w, uvT);
      const c = shapeVertexColour(material, shape.colors, v, alpha);
      buf[o++] = p[0]; buf[o++] = p[1]; buf[o++] = p[2];
      buf[o++] = 0; buf[o++] = 0;
      buf[o++] = u; buf[o++] = w;
      buf[o++] = c[0]; buf[o++] = c[1]; buf[o++] = c[2]; buf[o++] = c[3];
      buf[o++] = 0;
    }
    return { key: `shape:${i}`, packed: buf, count: n, drawState: drawStateOf(shape, shape.material), texture: textureOf(shape, shape.material.textureFile) };
  }

  return {
    desc,
    get time() { return time; },
    get done() { return finished; },
    /** The particle systems, for a pin. */
    get systems() { return sims; },
    update(dt, { place = null, view = null, eye = null } = {}) {
      if (finished) return { time, done: true, streams: [] };
      time += dt;
      if (time >= desc.length) {
        if (loop && desc.length > 0) time -= desc.length * Math.floor(time / desc.length);   // UpdateVfxCallback: the remainder carried
        else { finished = true; return { time, done: true, streams: [] }; }   // "Hide effect immediately"
      }
      const placeA = place ?? AFFINE_IDENTITY;
      const viewA = view ?? AFFINE_IDENTITY;
      const out = affineMul(viewA, placeA);   // the effect's space -> the caller's
      let eyeLocal = null;
      if (eye) {
        const inv = affineInverse(out);
        eyeLocal = { position: affineApply(inv, eye.position[0], eye.position[1], eye.position[2]), look: turn(inv, eye.look), up: turn(inv, eye.up) };
      }
      pose(eyeLocal);
      const streams = [];
      desc.shapes.forEach((shape, i) => {
        if (visibleOf.get(shape.ref) ?? true) streams.push(packShape(i, shape, affineMul(out, worldOf.get(shape.ref) ?? AFFINE_IDENTITY)));
      });
      desc.particles.forEach((p, i) => {
        const sim = sims[i];
        const ps = worldOf.get(p.node) ?? affineOfTransform(p.desc.world);
        const em = p.emitter !== null ? worldOf.get(p.emitter) ?? null : null;
        let packed;
        if (p.desc.localSpace) {
          // RELATIVE: kept in the node's space and carried with it; sized in the file's units through the placement
          sim.update(dt, time, null, em ? affineMul(affineInverse(ps), em) : null);
          const m = affineMul(out, ps);
          packed = packParticleQuads(sim.quads(), partBufs[i], { place: (x, y, z) => affineApply(m, x, y, z), sizeScale: affineScale(m) });
        } else {
          // ABSOLUTE: kept in the Morrowind world, emitted through the emitter's orthonormalised world frame
          const frame = affineOrthoNormalize(affineMul(placeA, ps));
          const emW = em ? affineOrthoNormalize(affineMul(placeA, em)) : null;
          sim.update(dt, time, frame, emW ? affineMul(affineInverse(frame), emW) : null);
          packed = packParticleQuads(sim.quads(), partBufs[i], { place: (x, y, z) => affineApply(viewA, x, y, z), sizeScale: affineScale(viewA) });
        }
        partBufs[i] = packed.packed;
        if (!(visibleOf.get(p.node) ?? true) || !packed.count) return;
        const alpha = alphaOf(p);
        if (alpha !== 1) for (let k = 10; k < packed.count * PARTICLE_FLOATS; k += PARTICLE_FLOATS) packed.packed[k] = clamp01(packed.packed[k] * alpha);
        streams.push({ key: `particles:${i}`, packed: packed.packed, count: packed.count, drawState: drawStateOf(p, p.desc.material), texture: textureOf(p, p.desc.material?.textureFile ?? null) });
      });
      return { time, done: false, streams };
    },
  };
}

/** Every texture an effect can ask for - its shapes', their flipbooks', its particles' - for a preload. */
export function vfxTextures(desc) {
  const out = new Set();
  const add = (f) => { if (f) out.add(f); };
  for (const s of desc.shapes) { add(s.material.textureFile); for (const f of s.flip?.files ?? []) add(f); }
  for (const p of desc.particles) { add(p.desc.material?.textureFile); for (const f of p.flip?.files ?? []) add(f); }
  return [...out];
}

/** The most vertices each of an effect's streams can hold - a shape's triangles, a particle system's quota of quads -
 *  for the GL buffers a drawer sizes once, keyed as `update`'s streams are. */
export function vfxCapacity(desc) {
  const out = new Map();
  desc.shapes.forEach((s, i) => out.set(`shape:${i}`, s.indices.length));
  desc.particles.forEach((p, i) => out.set(`particles:${i}`, Math.max(1, p.desc.data?.numParticles | 0) * 6));
  return out;
}
