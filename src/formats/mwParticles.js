// MAC-Q (2026-09-17, Mac: "the torch doesn't emit fire" - and, told this
// port had never drawn a Morrowind particle system, "Please take care of
// the morrowind torch flame"): THE PARTICLE SYSTEM, as OpenMW builds it
// out of a NIF and osgParticle runs it.
//
// THE REFERENCE, file by file:
//   components/nifosg/nifloader.cpp  handleParticleSystem (:1455-1541),
//                                    handleParticleInitialState (:1309-1363),
//                                    handleParticleEmitter (:1365-1406),
//                                    handleParticlePrograms (:1240-1307)
//   components/nifosg/particle.cpp   ParticleShooter::shoot (:203-219),
//                                    GrowFadeAffector::operate (:246-254),
//                                    ParticleColorAffector::operate (:269-279),
//                                    GravityAffector::operate (:314-346),
//                                    Emitter::emitParticles (:454-565),
//                                    PlanarCollider::operate (:646-675),
//                                    SphericalCollider::operate (:703-742)
//   components/nifosg/controller.cpp ParticleSystemController (:580-604),
//                                    ControllerFunction::calculate (:30-70)
//   OpenSceneGraph src/osgParticle/Particle.cpp  update (:58-100)
//   OpenSceneGraph src/osgParticle/ParticleSystem.cpp  the quad (:360-403)
//   OpenSceneGraph include/osgParticle/ConstantRateCounter  (:53-64)
//
// THE SHAPE HERE. `particleSystemsOf(nif)` walks the file through
// flattenNif's own traversal (mwNifMesh.js hands each particle geometry to
// a sink with the same composed transform, property chain and BSParticle
// flags a shape gets) and answers DESCRIPTORS - the controller's terms, the
// emitter node's frame, the modifier chain, the colliders, the initial
// particles, the material with its blend function. `createParticleSystem`
// takes one and is the running thing: `update(dt, clock)` emits, operates
// and ages exactly as the reference's update traversal does, and `quads()`
// answers the billboards osgParticle would draw. Nothing here touches GL;
// combat/fpArm.js places the answers on the rig and render/renderer.js
// draws them.
//
// WHAT IS NOT CARRIED, recorded:
//   - NiBSPArrayController's AtVertex/AtNode emission over a target's
//     geometry (particle.cpp:475-541): a torch emits from ONE node, and the
//     port draws no NiBSPArrayController effects yet. The controller's
//     flags are read and the arm is refused with a note, not guessed.
//   - NiParticleBomb (:349-427): not in any torch; the record is parsed
//     (mwNifFile.js) and skipped here as the reference skips
//     NiParticleRotation ("unused", nifloader.cpp:1283-1286).
//   - the ABSOLUTE reference frame's true WORLD. A lens-local arm has no
//     world; its "world" is the rig root (see fpArm.js), so a flame in
//     that frame trails the HAND's swing but not the player's walk.
//   - the soft-particle effect (nifloader.cpp:1536-1540), a shader
//     feature of the reference's own.

import { deref } from './mwNifFile.js';
import { resolveMaterial, composeTransform, mat33Apply, flattenNif, VERTEX_COLOR_MODE } from './mwNifMesh.js';
import { affineOfTransform, AFFINE_IDENTITY, affineMul, affineApply, affineRotate } from './mwAffine.js';
import { sampleKeyGroup } from './mwKeys.js';

/** NiNode::BSParticleFlags (nif/node.hpp:111-115). */
export const PARTICLE_FLAG_AUTOPLAY = 0x0020;
export const PARTICLE_FLAG_LOCAL_SPACE = 0x0080;
/** NiTimeController::Flag_Active and the extrapolation bits (nif/controller.hpp). */
export const CONTROLLER_FLAG_ACTIVE = 0x0008;
export const EXTRAPOLATION = Object.freeze({ Cycle: 0, Reverse: 2, Constant: 4 });
/** NiParticleSystemController::EmitFlags - NoAutoAdjust (nif/controller.hpp:119-122). */
export const EMIT_FLAG_NO_AUTO_ADJUST = 0x1;
/** NiParticleSystemController's BSPArrayController flags (:113-117). */
export const BSP_AT_NODE = 0x8;
export const BSP_AT_VERTEX = 0x10;
/** NiGravity's field type (nif/particle.hpp ForceType). */
export const FORCE_TYPE = Object.freeze({ Wind: 0, Point: 1 });
/** GravityAffector's own constant (particle.cpp:316): "const float magic = 1.6f". */
export const GRAVITY_MAGIC = 1.6;

const IDENTITY_T = Object.freeze({ rotation: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), translation: [0, 0, 0], scale: 1 });

// ---- affine helpers: {a: row-major 3x3, t: [3]} is the shape the rig's
// own placement uses (mwFirstPerson.js placeAtBone, applyPre) ----------------

// AUDIT 68 S11-affine-dup: the product and the transform's affine live in
// mwAffine.js (mwSkin composes the same ones); re-exported for the rig.
export { affineOfTransform, AFFINE_IDENTITY, affineMul, affineApply, affineRotate };
/** The inverse of an affine whose 3x3 is a rotation times a uniform scale. */
export function affineInverse(m) {
  const a = m.a;
  const det = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
  const d = det !== 0 ? 1 / det : 0;
  const inv = new Float32Array([
    (a[4] * a[8] - a[5] * a[7]) * d, (a[2] * a[7] - a[1] * a[8]) * d, (a[1] * a[5] - a[2] * a[4]) * d,
    (a[5] * a[6] - a[3] * a[8]) * d, (a[0] * a[8] - a[2] * a[6]) * d, (a[2] * a[3] - a[0] * a[5]) * d,
    (a[3] * a[7] - a[4] * a[6]) * d, (a[1] * a[6] - a[0] * a[7]) * d, (a[0] * a[4] - a[1] * a[3]) * d,
  ]);
  const [tx, ty, tz] = mat33Apply(inv, m.t[0], m.t[1], m.t[2]);
  return { a: inv, t: [-tx, -ty, -tz] };
}
/** The uniform scale an affine carries - the length of its first column. */
export function affineScale(m) {
  return Math.hypot(m.a[0], m.a[3], m.a[6]);
}
/** `emitterToPs.orthoNormalize(emitterToPs)` (particle.cpp:548): the
 *  rotation with its scale divided out, the translation kept. */
export function affineOrthoNormalize(m) {
  const s = affineScale(m) || 1;
  const a = new Float32Array(9);
  for (let i = 0; i < 9; i++) a[i] = m.a[i] / s;
  return { a, t: [m.t[0], m.t[1], m.t[2]] };
}

// ---- the file's node transforms, for the emitter node ----------------------

/** The composed transform of ANY node in the file, root to node - the
 *  emitter may be an ancestor, a sibling or a cousin of the particle
 *  geometry, so it is looked up by reference rather than met on the walk.
 *  The parent map is built once per file. */
const PARENTS = new WeakMap();
function parentMap(nif) {
  let m = PARENTS.get(nif);
  if (m) return m;
  m = new Map();
  nif.records.forEach((rec, i) => {
    if (rec && Array.isArray(rec.children)) for (const c of rec.children) if (c >= 0) m.set(c, i);
  });
  PARENTS.set(nif, m);
  return m;
}
export function nodeWorldTransform(nif, ref) {
  const parents = parentMap(nif);
  const chain = [];
  const seen = new Set();
  for (let r = ref; r !== undefined && r >= 0 && !seen.has(r); r = parents.get(r)) {
    seen.add(r);
    const rec = deref(nif, r);
    if (!rec || !rec.rotation) break;
    chain.push(rec);
  }
  let world = IDENTITY_T;
  for (let i = chain.length - 1; i >= 0; i--) world = composeTransform(world, chain[i]);
  return world;
}

// ---- the descriptor -------------------------------------------------------

/** The particle geometry's controller: the FIRST active
 *  NiParticleSystemController / NiBSPArrayController on its chain
 *  (nifloader.cpp:1461-1469 - the last one wins there, walking forward and
 *  overwriting; a torch has one). */
function particleController(nif, rec) {
  let found = null;
  const seen = new Set();
  for (let ref = rec.controller; ref >= 0 && !seen.has(ref);) {
    seen.add(ref);
    const c = deref(nif, ref);
    if (!c) break;
    if ((c.type === 'NiParticleSystemController' || c.type === 'NiBSPArrayController') && (c.flags & CONTROLLER_FLAG_ACTIVE)) found = c;
    ref = c.next;
  }
  return found;
}

function modifierChain(nif, first) {
  const out = [];
  const seen = new Set();
  for (let ref = first; ref >= 0 && !seen.has(ref);) {
    seen.add(ref);
    const m = deref(nif, ref);
    if (!m) break;
    out.push(m);
    ref = m.next;
  }
  return out;
}

/**
 * One particle system's descriptor, from the bundle the flattener sinks.
 * Null when the geometry has no active controller (the reference logs "No
 * particle controller found" and draws nothing, :1470-1474).
 */
export function particleSystemOf(nif, bundle) {
  const { ref, rec, world, props, animFlags } = bundle;
  const ctrl = particleController(nif, rec);
  if (!ctrl) return null;
  const data = rec.data >= 0 ? deref(nif, rec.data) : null;
  const material = resolveMaterial(nif, props, true);   // "hasVertexColors = true" (:1531): the particle colour IS the vertex colour
  const modifiers = [];
  for (const m of modifierChain(nif, ctrl.particleModifier)) {
    switch (m.type) {
      case 'NiParticleGrowFade': modifiers.push({ type: 'growFade', grow: m.grow, fade: m.fade }); break;
      case 'NiGravity':
        modifiers.push({ type: 'gravity', decay: m.decay, force: m.force, fieldType: m.fieldType, position: [...m.position], direction: [...m.direction] });
        break;
      case 'NiParticleColorModifier': {
        const cd = m.colorData >= 0 ? deref(nif, m.colorData) : null;
        if (cd && cd.data && cd.data.keys && cd.data.keys.length) modifiers.push({ type: 'color', keys: cd.data.keys.map((k) => ({ time: k.time, value: [...k.value], inTan: k.inTan ? [...k.inTan] : null, outTan: k.outTan ? [...k.outTan] : null, tbc: k.tbc ? [...k.tbc] : null })), interpolation: cd.data.type });   // AUDIT 68 S11-colorkey-tbc: a TCB key's tension/continuity/bias ride along
        break;
      }
      case 'NiParticleRotation': break;   // "unused" (nifloader.cpp:1283-1286)
      case 'NiParticleBomb': modifiers.push({ type: 'bomb', unsupported: true }); break;
      default: break;
    }
  }
  const colliders = [];
  for (const c of modifierChain(nif, ctrl.particleCollider)) {
    if (c.type === 'NiPlanarCollider') {
      colliders.push({ type: 'planar', bounce: c.bounce, height: c.height, width: c.width, position: [...c.position], xVector: [...c.xVector], yVector: [...c.yVector], normal: [...c.plane.normal], constant: c.plane.constant });
    } else if (c.type === 'NiSphericalCollider') {
      colliders.push({ type: 'spherical', bounce: c.bounce, radius: c.radius, position: [...c.position] });
    }
  }
  const emitterRef = ctrl.emitter;
  const emitterWorld = emitterRef >= 0 ? nodeWorldTransform(nif, emitterRef) : null;
  const numParticles = data && data.numParticles ? data.numParticles : (ctrl.particles ? ctrl.particles.length : 0);
  return {
    kind: 'particles',
    name: rec.name || '',
    ref,
    // the particle node's own frame in the file, which is the space the
    // particles live in under the RELATIVE reference frame
    world: { rotation: Float32Array.from(world.rotation), translation: [...world.translation], scale: world.scale },
    localSpace: (animFlags & PARTICLE_FLAG_LOCAL_SPACE) !== 0,
    autoPlay: (animFlags & PARTICLE_FLAG_AUTOPLAY) !== 0,
    controller: {
      type: ctrl.type,
      flags: ctrl.flags, frequency: ctrl.frequency, phase: ctrl.phase, startTime: ctrl.startTime, stopTime: ctrl.stopTime,
      extrapolation: ctrl.flags & 0x6,
      speed: ctrl.speed, speedVariation: ctrl.speedVariation,
      declination: ctrl.declination, declinationVariation: ctrl.declinationVariation,
      planarAngle: ctrl.planarAngle, planarAngleVariation: ctrl.planarAngleVariation,
      initialColor: [...ctrl.initialColor], initialSize: ctrl.initialSize,
      emitStart: ctrl.emitStartTime, emitStop: ctrl.emitStopTime,
      birthRate: ctrl.birthRate, lifetime: ctrl.lifetime, lifetimeVariation: ctrl.lifetimeVariation,
      emitFlags: ctrl.useBirthRate | 0,
      emitterDimensions: [...ctrl.emitterDimensions],
      bspFlags: ctrl.type === 'NiBSPArrayController' ? (ctrl.flags & (BSP_AT_NODE | BSP_AT_VERTEX)) : 0,
      particles: (ctrl.particles ?? []).map((p) => ({ velocity: [...p.velocity], age: p.age, lifeSpan: p.lifeSpan, code: p.code })),
    },
    emitter: emitterWorld ? { ref: emitterRef, world: { rotation: Float32Array.from(emitterWorld.rotation), translation: [...emitterWorld.translation], scale: emitterWorld.scale } } : null,
    data: data ? {
      numParticles,
      numActive: data.numActive | 0,
      vertices: data.vertices ? Float32Array.from(data.vertices) : null,
      sizes: data.sizes ? Float32Array.from(data.sizes) : null,
      radius: data.particleRadius ?? 0,
    } : { numParticles, numActive: 0, vertices: null, sizes: null, radius: 0 },
    modifiers,
    colliders,
    material,
  };
}

/** Every particle system in a file, through flattenNif's own walk. `opts`
 *  are flattenNif's (underNode, excludeNode, includeHidden). */
export function particleSystemsOf(nif, opts = {}) {
  const effects = [];
  flattenNif(nif, { ...opts, effects });
  const out = [];
  for (const bundle of effects) {
    const d = particleSystemOf(nif, bundle);
    if (d) out.push(d);
  }
  return out;
}

// ---- the running system ---------------------------------------------------

/** ControllerFunction::calculate (nifosg/controller.cpp:30-70): the
 *  controller's own clock over the caller's. */
export function controllerTime(c, value) {
  const time = c.frequency * value + c.phase;
  if (time >= c.startTime && time <= c.stopTime) return time;
  const delta = c.stopTime - c.startTime;
  switch (c.extrapolation) {
    case EXTRAPOLATION.Cycle: {
      if (delta <= 0) return c.startTime;
      const cycles = (time - c.startTime) / delta;
      return c.startTime + (cycles - Math.floor(cycles)) * delta;
    }
    case EXTRAPOLATION.Reverse: {
      if (delta <= 0) return c.startTime;
      const cycles = (time - c.startTime) / delta;
      const remainder = (cycles - Math.floor(cycles)) * delta;
      return (Math.abs(Math.floor(cycles)) % 2) === 0 ? c.startTime + remainder : c.stopTime - remainder;
    }
    default:
      return Math.min(c.stopTime, Math.max(c.startTime, time));   // Constant: clamped to the window
  }
}

/** ValueInterpolator::interpKey over a colour key list (nifosg/controller.hpp
 *  :99-129, :135-166): first key at or before the range, last past it,
 *  linear between - Constant snaps at the half, Quadratic takes the cubic
 *  Hermite with the file's tangents and TCB with the generated ones. The
 *  KeyGroup sampler is mwKeys.js's, the bones' own (AUDIT 68
 *  S11-colorkey-tbc). Default (1,1,1,1) is ParticleColorAffector's own
 *  (particle.cpp:257). */
export function interpColorKey(keys, time, interpolation = 1) {
  if (!keys || !keys.length) return [1, 1, 1, 1];
  return sampleKeyGroup({ keys, type: interpolation }, 4, time);
}

/** `(osg::Quat(vdir, Y) * osg::Quat(hdir, Z)) * (0, 0, 1)` (particle.cpp:
 *  209-210). osg's quaternion product applies the LEFT operand first
 *  (`q1 * q2` rotates by q1 then q2), so the +Z shot is turned about Y by
 *  the vertical angle first and about Z by the horizontal angle after. */
export function shootDirection(hdir, vdir) {
  // R_y(vdir) on (0,0,1): (sin v, 0, cos v)
  const x1 = Math.sin(vdir), y1 = 0, z1 = Math.cos(vdir);
  // R_z(hdir) on that
  const ch = Math.cos(hdir), sh = Math.sin(hdir);
  return [x1 * ch - y1 * sh, x1 * sh + y1 * ch, z1];
}

/**
 * The system, running. `rolls` is Misc::Rng::rollClosedProbability -
 * uniform on [0, 1] - injectable so a pin can drive the dice.
 */
export function createParticleSystem(desc, { rolls = Math.random } = {}) {
  const c = desc.controller;
  const quota = Math.max(0, desc.data.numParticles | 0);
  const particles = [];   // { pos, vel, age, life, size, color:[r,g,b], alpha }
  let carry = 0;   // ConstantRateCounter's `_carryOver`
  let frozen = !desc.autoPlay;   // `if (!(animflags & AutoPlay)) partsys->setFrozen(true)` (:1511-1514)
  let enabled = true;
  const unsupported = desc.controller.bspFlags & BSP_AT_VERTEX ? 'NiBSPArrayController emits at a target’s vertices, which this port does not draw' : null;

  // handleParticleEmitter (:1365-1406): the RATE, then the shooter's terms
  const noAutoAdjust = (c.emitFlags & EMIT_FLAG_NO_AUTO_ADJUST) !== 0;
  const rate = noAutoAdjust ? c.birthRate
    : (c.lifetime === 0 && c.lifetimeVariation === 0) ? 0
      : c.particles.length / (c.lifetime + c.lifetimeVariation / 2);
  const minSpeed = c.speed - c.speedVariation * 0.5;
  const maxSpeed = c.speed + c.speedVariation * 0.5;
  const hdim = [c.emitterDimensions[0] / 2, c.emitterDimensions[1] / 2, c.emitterDimensions[2] / 2];

  // the emitter's frame in the particles' space: emitter node -> file ->
  // particle node (particle.cpp:459-472 for the relative case), orthonormalised (:548)
  const psWorld = affineOfTransform(desc.world);
  const emitterToPs = desc.emitter
    ? affineOrthoNormalize(affineMul(affineInverse(psWorld), affineOfTransform(desc.emitter.world)))
    : AFFINE_IDENTITY;

  // handleParticleInitialState (:1309-1363): the file's own live particles
  const d = desc.data;
  if (d.vertices) {
    let i = 0;
    for (const p of c.particles) {
      if (i++ >= d.numActive) break;
      if (p.lifeSpan <= 0) continue;
      if (p.code * 3 + 2 >= d.vertices.length) continue;
      if (particles.length >= quota) break;
      let size = c.initialSize;
      if (d.sizes && p.code < d.sizes.length) size *= d.sizes[p.code];
      particles.push({
        pos: [d.vertices[p.code * 3], d.vertices[p.code * 3 + 1], d.vertices[p.code * 3 + 2]],
        vel: [p.velocity[0], p.velocity[1], p.velocity[2]],
        age: Math.max(0, p.age), life: p.lifeSpan, size,
        color: [c.initialColor[0], c.initialColor[1], c.initialColor[2]], colorA: c.initialColor[3], alpha: 1,
      });
    }
  }

  const growFade = desc.modifiers.find((m) => m.type === 'growFade') ?? null;
  const colour = desc.modifiers.find((m) => m.type === 'color') ?? null;
  const gravities = desc.modifiers.filter((m) => m.type === 'gravity');

  /** ConstantRateCounter::numParticlesToCreate (ConstantRateCounter:53-64). */
  function count(dt) {
    const v = dt * rate;
    let n = Math.trunc(v);
    carry += v - n;
    if (carry > 1) { n++; carry -= 1; }
    return Math.max(0, n);
  }

  /** ParticleShooter::shoot (particle.cpp:203-219) on a placed particle. */
  function shoot(p) {
    const hdir = c.planarAngle + c.planarAngleVariation * (2 * rolls() - 1);
    const vdir = c.declination + c.declinationVariation * (2 * rolls() - 1);
    const dir = shootDirection(hdir, vdir);
    const vel = minSpeed + (maxSpeed - minSpeed) * rolls();
    p.vel = [dir[0] * vel, dir[1] * vel, dir[2] * vel];
    p.life = Math.max(Number.EPSILON, c.lifetime + c.lifetimeVariation * rolls());
  }

  /** Emitter::emitParticles (:454-565) - the counter, the box placer, the
   *  shooter, and `transformPositionVelocity(emitterToPs)`. `frame` is the
   *  affine that carries the particle node's space into the frame the
   *  particles are kept in - identity under LocalSpace, the caller's
   *  world under the absolute frame. */
  function emit(dt, frame) {
    if (!enabled || frozen) return 0;
    const n = count(dt);
    let made = 0;
    for (let i = 0; i < n && particles.length < quota; i++) {
      // osgParticle::BoxPlacer: uniform inside the half-dimensions
      const p = {
        pos: [(2 * rolls() - 1) * hdim[0], (2 * rolls() - 1) * hdim[1], (2 * rolls() - 1) * hdim[2]],
        vel: [0, 0, 0], age: 0, life: 0, size: c.initialSize,
        color: [c.initialColor[0], c.initialColor[1], c.initialColor[2]], colorA: c.initialColor[3], alpha: 1,
      };
      shoot(p);
      p.pos = affineApply(emitterToPs, p.pos[0], p.pos[1], p.pos[2]);
      p.vel = affineRotate(emitterToPs, p.vel[0], p.vel[1], p.vel[2]);
      if (frame) { p.pos = affineApply(frame, p.pos[0], p.pos[1], p.pos[2]); p.vel = affineRotate(frame, p.vel[0], p.vel[1], p.vel[2]); }
      particles.push(p);
      made++;
    }
    return made;
  }

  /** ModularProgram: every operator over every live particle, modifiers
   *  in chain order and the colliders after them (nifloader.cpp:1249-1307). */
  function operate(dt, frame) {
    const inv = frame ? affineInverse(frame) : null;
    for (const p of particles) {
      if (growFade) {
        // GrowFadeAffector::operate (:246-254) - off the DEFAULT size, not the particle's own
        let size = c.initialSize;
        if (p.age < growFade.grow && growFade.grow !== 0) size *= p.age / growFade.grow;
        if (p.life - p.age < growFade.fade && growFade.fade !== 0) size *= (p.life - p.age) / growFade.fade;
        p.size = size;
      }
      if (colour) {
        // ParticleColorAffector::operate (:269-279): the key's rgb as the colour, its a as the alpha
        const k = interpColorKey(colour.keys, p.age / p.life, colour.interpolation);
        p.color = [k[0], k[1], k[2]]; p.colorA = 1; p.alpha = k[3];
      }
      for (const g of gravities) {
        // GravityAffector::operate (:314-346), relative frame: position and direction as authored
        const pos = g.position, dir = normalize(g.direction);
        // the particle's position in the PARTICLE NODE's space, which is where the field is authored
        const q = inv ? affineApply(inv, p.pos[0], p.pos[1], p.pos[2]) : p.pos;
        if (g.fieldType === FORCE_TYPE.Wind) {
          let decay = 1;
          if (g.decay !== 0) {
            const dist = Math.abs(dir[0] * (q[0] - pos[0]) + dir[1] * (q[1] - pos[1]) + dir[2] * (q[2] - pos[2]));
            decay = Math.exp(-g.decay * dist);
          }
          const k = g.force * dt * decay * GRAVITY_MAGIC;
          const w = frame ? affineRotate(frame, dir[0], dir[1], dir[2]) : dir;
          p.vel[0] += w[0] * k; p.vel[1] += w[1] * k; p.vel[2] += w[2] * k;
        } else {
          const diff = [pos[0] - q[0], pos[1] - q[1], pos[2] - q[2]];
          const len = Math.hypot(diff[0], diff[1], diff[2]);
          const decay = g.decay !== 0 ? Math.exp(-g.decay * len) : 1;
          const n = len > 0 ? [diff[0] / len, diff[1] / len, diff[2] / len] : [0, 0, 0];
          const k = g.force * dt * decay * GRAVITY_MAGIC;
          const w = frame ? affineRotate(frame, n[0], n[1], n[2]) : n;
          p.vel[0] += w[0] * k; p.vel[1] += w[1] * k; p.vel[2] += w[2] * k;
        }
      }
      for (const col of desc.colliders) {
        const q = inv ? affineApply(inv, p.pos[0], p.pos[1], p.pos[2]) : p.pos;
        const v = inv ? affineRotate(inv, p.vel[0], p.vel[1], p.vel[2]) : p.vel;
        const r = col.type === 'planar' ? planarCollide(col, q, v, dt) : sphericalCollide(col, q, v, dt);
        if (r) p.vel = frame ? affineRotate(frame, r[0], r[1], r[2]) : r;
      }
    }
  }

  /** osgParticle::Particle::update (Particle.cpp:58-100): the age is
   *  judged BEFORE it advances, then the position moves. */
  function age(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const x = p.life > 0 ? p.age / p.life : 0;
      p.age += dt;
      if (x > 1) { particles.splice(i, 1); continue; }
      p.pos[0] += p.vel[0] * dt; p.pos[1] += p.vel[1] * dt; p.pos[2] += p.vel[2] * dt;
    }
  }

  return {
    desc,
    unsupported,
    get particles() { return particles; },
    get quota() { return quota; },
    get rate() { return rate; },
    get emitterToPs() { return emitterToPs; },
    get frozen() { return frozen; },
    get enabled() { return enabled; },
    /**
     * One frame. `clock` is the controller's INPUT - the animation clock
     * the part's controllers ride (the lower body's, per the reference's
     * AssignControllerSourcesVisitor); null means no source, which is
     * the frozen system of nifosg/controller.cpp:602-603. `frame` is for
     * the ABSOLUTE reference frame only: the particle node's frame in the
     * space the caller keeps world particles in; null keeps them local.
     */
    update(dt, clock = null, frame = null) {
      if (clock === null || clock === undefined) { frozen = true; return; }
      const t = controllerTime(c, clock);
      frozen = false;
      enabled = t >= c.emitStart && t < c.emitStop;   // ParticleSystemController (nifosg/controller.cpp:594-604)
      if (unsupported) return;
      emit(dt, frame);
      operate(dt, frame);
      age(dt);
    },
    /** The billboards, as osgParticle draws them (ParticleSystem.cpp:360-403):
     *  centre, half-extent (`xAxis * currentSize`), colour, and the alpha
     *  the colour's own a is multiplied by. */
    quads() {
      return particles.map((p) => ({ pos: [p.pos[0], p.pos[1], p.pos[2]], size: p.size, color: p.color, alpha: p.colorA * p.alpha }));
    },
  };
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** PlanarCollider::operate (particle.cpp:646-675): the reflected velocity,
 *  or null when the particle does not cross the plane inside its bounds
 *  this step. The plane is `Plane(-normal, distance)` (:612). */
export function planarCollide(col, pos, vel, dt) {
  const n = [-col.normal[0], -col.normal[1], -col.normal[2]];
  const dist = n[0] * pos[0] + n[1] * pos[1] + n[2] * pos[2] + col.constant;
  const velDot = vel[0] * n[0] + vel[1] * n[1] + vel[2] * n[2];
  if (dist * velDot >= 0) return null;
  const next = dist + velDot * dt;
  if (dist * next > 0) return null;
  const rel = [pos[0] - col.position[0], pos[1] - col.position[1], pos[2] - col.position[2]];
  const xd = rel[0] * col.xVector[0] + rel[1] * col.xVector[1] + rel[2] * col.xVector[2];
  const yd = rel[0] * col.yVector[0] + rel[1] * col.yVector[1] + rel[2] * col.yVector[2];
  // "NB: extent components are intentionally swapped" (:663-667)
  if (-col.width * 0.5 > xd || col.width * 0.5 < xd) return null;
  if (-col.height * 0.5 > yd || col.height * 0.5 < yd) return null;
  const k = 2 * velDot;
  return [(vel[0] - n[0] * k) * col.bounce, (vel[1] - n[1] * k) * col.bounce, (vel[2] - n[2] * k) * col.bounce];
}

/** SphericalCollider::operate (:703-742). */
export function sphericalCollide(col, pos, vel, dt) {
  const cent = [pos[0] - col.position[0], pos[1] - col.position[1], pos[2] - col.position[2]];
  const r2 = col.radius * col.radius;
  const c2 = cent[0] * cent[0] + cent[1] * cent[1] + cent[2] * cent[2];
  const inside = c2 <= r2;
  const cv = cent[0] * vel[0] + cent[1] * vel[1] + cent[2] * vel[2];
  if (!inside && cv >= 0) return null;
  const v2 = vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2];
  if (v2 === 0) return null;
  const b = -cv / v2;
  const u = [cent[0] + vel[0] * b, cent[1] + vel[1] * b, cent[2] + vel[2] * b];
  const u2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
  if (!inside && u2 >= r2) return null;
  const d = (r2 - u2) / v2;
  const k = inside ? Math.sqrt(d) + b : b - Math.sqrt(d);
  if (k >= dt) return null;
  const contact = [pos[0] + vel[0] * k, pos[1] + vel[1] * k, pos[2] + vel[2] * k];
  const n = normalize([contact[0] - col.position[0], contact[1] - col.position[1], contact[2] - col.position[2]]);
  const dot = vel[0] * n[0] + vel[1] * n[1] + vel[2] * n[2];
  return [(vel[0] - n[0] * 2 * dot) * col.bounce, (vel[1] - n[1] * 2 * dot) * col.bounce, (vel[2] - n[2] * 2 * dot) * col.bounce];
}

// ---- the quad stream the renderer draws ------------------------------------

/** One quad is six vertices of PARTICLE_FLOATS: centre xyz, corner xy
 *  (-1/+1), uv, rgba, size. The corner is turned into a billboard by the
 *  shader off the view's own axes, so the stream is view-independent. */
export const PARTICLE_FLOATS = 12;
/** The corner-to-texel map. osgParticle hands c0 = pos - p1 - p2 (the
 *  BOTTOM-left of the quad in view space) the texture's (0,0), and OSG
 *  images are stored bottom row first - so its (0,0) is the picture's
 *  BOTTOM-left. This port uploads a decoded DDS top row first, exactly as
 *  the NIF's own UVs expect (every textured piece proves it), so the
 *  picture's TOP is v = 0 here: the top corners take v 0, the bottom
 *  corners v 1, and the flame stands the way it was painted. */
export const PARTICLE_CORNERS = Object.freeze([
  [-1, -1, 0, 1], [1, -1, 1, 1], [1, 1, 1, 0],
  [-1, -1, 0, 1], [1, 1, 1, 0], [-1, 1, 0, 0],
]);

/**
 * Pack quads into a Float32Array the renderer's particle VAO reads.
 * `place` maps a particle-space centre to the buffer's space (the rig's,
 * for an arm) and `sizeScale` is the uniform scale that trip carries,
 * so a torch authored in file units lands in rig units.
 */
export function packParticleQuads(quads, out = null, { place = null, sizeScale = 1 } = {}) {
  const need = quads.length * 6 * PARTICLE_FLOATS;
  const buf = out && out.length >= need ? out : new Float32Array(Math.max(need, 6 * PARTICLE_FLOATS));
  let o = 0;
  for (const q of quads) {
    const p = place ? place(q.pos[0], q.pos[1], q.pos[2]) : q.pos;
    const size = q.size * sizeScale;
    for (const [cx, cy, u, v] of PARTICLE_CORNERS) {
      buf[o++] = p[0]; buf[o++] = p[1]; buf[o++] = p[2];
      buf[o++] = cx; buf[o++] = cy;
      buf[o++] = u; buf[o++] = v;
      buf[o++] = q.color[0]; buf[o++] = q.color[1]; buf[o++] = q.color[2]; buf[o++] = q.alpha;
      buf[o++] = size;
    }
  }
  return { packed: buf, count: quads.length * 6 };
}

/** The draw state a particle material asks for, as the renderer reads it:
 *  the reference applies the drawable's NiAlphaProperty and
 *  NiZBufferProperty to the particle system exactly as to a shape
 *  (nifloader.cpp:1521-1523 collectDrawableProperties / applyDrawableProperties). */
export function particleDrawState(material) {
  const m = material ?? {};
  return {
    blend: !!m.alphaBlend,
    srcBlend: m.srcBlend ?? 6, dstBlend: m.dstBlend ?? 7,
    alphaCut: m.alphaTest ? (m.alphaThreshold || 0) / 255 : 0,
    depthTest: m.depthTest !== false, depthWrite: m.depthWrite !== false,
    textureFile: m.textureFile ?? null, clampMode: m.clampMode ?? 3,
    // the particle colour substitutes for the material channel the vertex
    // colour mode names (rule 63); LightMode_Emissive's arm leaves ONLY the
    // emission, which is the flame's whole point - it does not care what
    // the room is lit by
    emissive: m.vertexColorMode === VERTEX_COLOR_MODE.Emission || (m.emissive && (m.emissive[0] > 0 || m.emissive[1] > 0 || m.emissive[2] > 0)),
  };
}
