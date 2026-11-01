// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CSA-F (2026-09-27): UNITY'S PARTICLE SYSTEM, THE PART COME SAIL AWAY'S
// PREFABS USE. The mod's wake, bow waves, oar and rudder drops, their
// splashes and its flag are Shuriken systems in the bundle
// (Come Sail Away 2.1's prefabs: every module's serialized fields - OWN-WORK4: ours, world/ships/ownBoats/), which the C#
// plays, stops, re-tunes and reads. Unity's simulation is native code, so
// what is here is its documented behaviour for the modules those systems
// switch on - and nothing they leave off:
//
//   MAIN: a duration (5 s), looping or not; each particle's lifetime,
//     speed, size and rotation at birth - a constant, or a random between
//     two constants (per axis for a 3D rotation); max particles 1000; the
//     simulation space, Local (the particles ride the emitter) or World
//     (they stay where they were born); scaling mode Local - the system's
//     own transform scale, not its parents', scales what it emits;
//   EMISSION: rate over time and rate over distance (the emitter's world
//     movement), each with its own accumulator, the particles of a frame
//     spread along it - born at the fraction of the frame the accumulator
//     crossed a whole one, where the emitter then stood, and aged the rest
//     of the frame; bursts at their time in each loop;
//   SHAPE: a Box (a point in its volume, moving along the shape's +Z) and
//     a Cone (a point on its base disc, moving out along the cone), through
//     the shape's own position, rotation and scale;
//   SIZE OVER LIFETIME: the start size times the curve (one, or per axis)
//     at the particle's normalized age; FORCE OVER LIFETIME: a constant
//     acceleration, in the system's space or the world's;
//   COLLISION against up to six planes (a transform's position and up):
//     crossed within the particle's radius (half its size, times the
//     radius scale), it loses its lifetime by the lifetime-loss fraction
//     (all of it here: it dies) and fires its collision sub-emitters;
//   SUB-EMITTERS: the child system's bursts, emitted at the point.
//   Play and Stop reach the children (withChildren, Unity's default) but
//   never a system that is some parent's sub-emitter.
//
// DECLARED (Port-Ledger, the Come Sail Away row): Unity's particle RNG is
// its own and unseeded - these draws are the host's (`random`, Math.random
// by default), as OH-C's miasma's are; its curves are sampled as the
// AnimationCurve they are (Unity bakes them to polynomial segments for the
// simulation); a world-space force is applied as it stands, unscaled by
// the emitter's transform.
// ═══════════════════════════════════════════════════════════════════

import { quatRotate, quatMultiply, mat4FromQuatPosScale } from './quat.js';
import { resolveNodePointer } from './prefabNode.js';
import { quatEuler } from './unityAnimator.js';
import { evaluateCurve } from './worldClock.js';

/** ParticleSystemShapeType. */
export const SHAPE = Object.freeze({ Cone: 4, Box: 5 });
/** ParticleSystemSimulationSpace (the serialized `moveWithTransform`). */
export const SPACE = Object.freeze({ Local: 0, World: 1 });
/** ParticleSystemScalingMode. */
export const SCALING = Object.freeze({ Hierarchy: 0, Local: 1, Shape: 2 });
/** ParticleSystemSubEmitterType. */
export const SUB_EMITTER = Object.freeze({ Birth: 0, Collision: 1, Death: 2 });
/** ParticleSystemRenderMode. */
export const RENDER_MODE = Object.freeze({
  Billboard: 0,
  Stretch: 1,
  HorizontalBillboard: 2,
  VerticalBillboard: 3,
  Mesh: 4,
});

// ---- curves -----------------------------------------------------------------

const KEY_TUPLES = new WeakMap();
/**
 * AnimationCurve.Evaluate over a curve's serialized keys (`{ time, value, inSlope, outSlope }`): worldClock's
 * evaluateCurve - the port's one home for it, the sun's curves' own - on the keys as its tuples (made once a curve);
 * an empty curve is nought. Unweighted, and no key stepped: the prefabs carry none (pinned).
 * @param {{ time: number, value: number, inSlope: number, outSlope: number }[] | undefined} keys
 * @param {number} t
 */
export function evaluateKeyframes(keys, t) {
  if (!keys?.length) return 0;
  let tuples = KEY_TUPLES.get(keys);
  if (!tuples) {
    tuples = keys.map((k) => [k.time, k.value, k.inSlope, k.outSlope]);
    KEY_TUPLES.set(keys, tuples);
  }
  return evaluateCurve(tuples, t);
}

/**
 * MinMaxCurve.Evaluate(time, lerp): Constant (0) the constant; Curve (1) the multiplier times the curve; TwoCurves
 * (2) between the two curves; TwoConstants (3) between the two constants - `r` the particle's own draw.
 */
export function evaluateMinMax(c, t = 0, r = 0) {
  if (!c) return 0;
  switch (c.minMaxState) {
    case 0:
      return c.scalar;
    case 1:
      return c.scalar * evaluateKeyframes(c.maxCurve?.m_Curve, t);
    case 2: {
      const lo = evaluateKeyframes(c.minCurve?.m_Curve, t),
        hi = evaluateKeyframes(c.maxCurve?.m_Curve, t);
      return c.scalar * (lo + (hi - lo) * r);
    }
    case 3:
      return c.minScalar + (c.scalar - c.minScalar) * r;
    default:
      return c.scalar ?? 0;
  }
}
/** `new MinMaxCurve(v)` - what the C#'s `main.startSize = v` and `force.x = new MinMaxCurve(v)` assign. */
export const constantCurve = (v) => ({
  minMaxState: 0,
  scalar: v,
  minScalar: v,
  maxCurve: { m_Curve: [] },
  minCurve: { m_Curve: [] },
});
/** `new MinMaxCurve(min, max)` - the random between two constants (the C#'s rain and snow forces). */
export const twoConstantsCurve = (min, max) => ({
  minMaxState: 3,
  scalar: max,
  minScalar: min,
  maxCurve: { m_Curve: [] },
  minCurve: { m_Curve: [] },
});

// ---- small vector and matrix helpers (column-major 4x4, as the port's) --------

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a);
  return l > 1e-5 ? scale(a, 1 / l) : [0, 0, 0];
};
const mulPoint = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
const mulDir = (m, d) => [
  m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
  m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
  m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
];
const trs = (q, p, s) => mat4FromQuatPosScale(q, p, s);
const vec = (v, d = [0, 0, 0]) => (v ? [v.x ?? d[0], v.y ?? d[1], v.z ?? d[2]] : [...d]);

// ---- the system -------------------------------------------------------------

/**
 * One ParticleSystem component on a prefab instance's node, with its ParticleSystemRenderer (or null).
 * @param {any} node - world/prefabNode.js's PrefabNode
 * @param {any} component - prefabs.json's ParticleSystem record (the instance's own copy)
 * @param {any} rendererComponent - the node's ParticleSystemRenderer record, or null
 * @param {{ random?: () => number }} [opts]
 */
function createParticleSystem(node, component, rendererComponent, { random = Math.random } = {}) {
  const c = component;
  const main = c.InitialModule ?? {};
  const emission = c.EmissionModule?.enabled ? c.EmissionModule : null;
  const shape = c.ShapeModule?.enabled ? c.ShapeModule : null;
  const size = c.SizeModule?.enabled ? c.SizeModule : null;
  const force = c.ForceModule?.enabled ? c.ForceModule : null;
  const collision = c.CollisionModule?.enabled ? c.CollisionModule : null;
  const subModule = c.SubModule?.enabled ? c.SubModule : null;
  const ps = {
    node,
    component: c,
    renderer: rendererComponent,
    /** @type {any[]} */ particles: [],
    /** The main module's live fields (the C# writes four). */
    main: {
      startLifetime: main.startLifetime,
      startSpeed: main.startSpeed,
      startSize: main.startSize,
      /** CSA-G: startDelay - the seconds a fresh Play waits before its clock starts (the oars' events set it). */
      startDelay: c.startDelay,
      get startLifetimeMultiplier() {
        return this.startLifetime?.scalar ?? 0;
      },
      /** MinMaxCurve.curveMultiplier: a constant's value, a curve's scalar. */
      set startLifetimeMultiplier(v) {
        this.startLifetime = { ...this.startLifetime, scalar: v };
      },
    },
    /** ForceOverLifetimeModule: `space` (0 Local, 1 World) and the x, y, z curves. */
    forceOverLifetime: force
      ? { space: force.inWorldSpace ? SPACE.World : SPACE.Local, x: force.x, y: force.y, z: force.z }
      : null,
    /** @type {{ system:any, type:number, probability:number }[]} */ subEmitters: [],
    /** @type {any[]} */ planes: [],
    time: 0,
    playing: false,
    emitting: false,
    isSubEmitter: false,
    _accTime: 0,
    _accDistance: 0,
    _delay: 0,
    /** @type {number[] | null} */ _lastPosition: null,
    get particleCount() {
      return this.particles.length;
    },
    get isPlaying() {
      return this.playing;
    },
    get isEmitting() {
      return this.emitting;
    },
    /** Play(withChildren): the clock from nought if stopped, emitting again - and every child system not a sub-emitter. */
    play() {
      for (const s of treeSystems(this)) s._playOne();
    },
    /** Stop(withChildren, StopEmitting): no more emitted; the living live on. */
    stop() {
      for (const s of treeSystems(this)) s._stopOne();
    },
    _playOne() {
      if (!this.playing) {
        this.time = 0;
        this._accTime = 0;
        this._accDistance = 0;
        this._firedBursts = new Set();
        this._delay = Math.max(0, evaluateMinMax(this.main.startDelay, 0, random()));
      }
      this.playing = true;
      this.emitting = true;
      this._lastPosition = null;
    },
    _stopOne() {
      this.emitting = false;
    },
    /** GetParticles / SetParticles: the living, as they stand. */
    getParticles() {
      return this.particles;
    },
    setParticles(list) {
      this.particles = list;
    },
    /** One frame of Time.deltaTime, the transforms as they now stand. */
    step(dt) {
      stepSystem(this, dt, random);
    },
    /** Every living particle in the world: its centre, its size per axis and its rotation (radians, Z or 3D). */
    renderList() {
      return renderList(this);
    },
    _firedBursts: new Set(),
    _sim: {
      duration: c.lengthInSec ?? 5,
      looping: !!c.looping,
      space: c.moveWithTransform ?? SPACE.Local,
      scaling: c.scalingMode ?? SCALING.Local,
      maxParticles: main.maxNumParticles ?? 1000,
      rotation3D: !!main.rotation3D,
      size3D: !!main.size3D,
      main,
      emission,
      shape,
      size,
      collision,
      subModule,
    },
  };
  if (c.playOnAwake) ps._playOne();
  return ps;
}

/** The system and every system on its node's subtree that is no system's sub-emitter, as Play(true) reaches them. */
function treeSystems(ps) {
  const out = [];
  for (const n of ps.node.walk())
    for (const comp of n.getComponents('ParticleSystem')) {
      const s = comp.particleSystem;
      if (s && (s === ps || !s.isSubEmitter)) out.push(s);
    }
  return out;
}

/**
 * The instance's sub-emitters and collision planes, once every system of the prefab instance is made: the SubModule's
 * `{ node, component }` owners and the CollisionModule's `plane0..5` nodes resolve against the instance.
 */
export function linkParticleSystem(ps) {
  const sim = ps._sim;
  if (sim.subModule) {
    for (const e of sim.subModule.subEmitters ?? []) {
      const owner = resolveNodePointer(ps.node, e.emitter);
      const sys = owner?.getComponent('ParticleSystem')?.particleSystem ?? null;
      if (!sys) continue;
      sys.isSubEmitter = true;
      ps.subEmitters.push({ system: sys, type: e.type, probability: e.emitProbability ?? 1 });
    }
  }
  if (sim.collision && sim.collision.type === 0) {
    for (let i = 0; i < 6; i++) {
      const n = resolveNodePointer(ps.node, sim.collision[`plane${i}`]);
      if (n) ps.planes.push(n);
    }
  }
}

/** The emitter's frame: its world position and rotation, and the scale its scaling mode takes. */
function emitterMatrix(ps) {
  const n = ps.node;
  if (ps._sim.scaling === SCALING.Hierarchy) return n.worldMatrix();
  return trs(n.rotation, n.position, ps._sim.scaling === SCALING.Local ? n.localScale : [1, 1, 1]);
}

/** One particle's birth in the shape's frame: [position, direction]. */
function shapeSample(sim, random) {
  const sh = sim.shape;
  let p = [0, 0, 0],
    d = [0, 0, 1];
  if (sh) {
    if (sh.type === SHAPE.Box) {
      p = [random() - 0.5, random() - 0.5, random() - 0.5];
      d = [0, 0, 1];
    } else if (sh.type === SHAPE.Cone) {
      const radius = sh.radius?.value ?? 1,
        thickness = sh.radiusThickness ?? 1;
      const arc = ((sh.arc?.value ?? 360) * Math.PI) / 180;
      const theta = random() * arc;
      const inner = 1 - thickness;
      const u = Math.sqrt(inner * inner + random() * (1 - inner * inner)); // uniform by area over the ring
      const x = Math.cos(theta) * u,
        y = Math.sin(theta) * u;
      const tan = Math.tan(((sh.angle ?? 25) * Math.PI) / 180);
      p = [x * radius, y * radius, 0];
      d = norm([x * tan, y * tan, 1]);
    }
    const q = quatEuler(...vec(sh.m_Rotation));
    const m = trs(q, vec(sh.m_Position), vec(sh.m_Scale, [1, 1, 1]));
    p = mulPoint(m, p);
    // the shape's scale bends a direction with it (the bow waves' flattened cone); one it bends to nothing - a
    // point emitter's zero scale - keeps the shape's own turned axis (the drops' Box, which still falls)
    const bent = mulDir(m, d);
    d = len(bent) > 1e-5 ? norm(bent) : norm(quatRotate(q, d));
  }
  return [p, d];
}

/** A newborn particle: in the system's space, `age` seconds already lived. */
function birth(ps, at, ageAhead, random, originWorld = null) {
  const sim = ps._sim,
    m = sim.main;
  const [lp, ld] = shapeSample(sim, random);
  const lifetime = evaluateMinMax(ps.main.startLifetime, 0, random());
  const speed = evaluateMinMax(ps.main.startSpeed, 0, random());
  const s0 = evaluateMinMax(ps.main.startSize, 0, random());
  const startSize = sim.size3D
    ? [s0, evaluateMinMax(m.startSizeY, 0, random()), evaluateMinMax(m.startSizeZ, 0, random())]
    : [s0, s0, s0];
  const rotation = sim.rotation3D
    ? [
        evaluateMinMax(m.startRotationX, 0, random()),
        evaluateMinMax(m.startRotationY, 0, random()),
        evaluateMinMax(m.startRotation, 0, random()),
      ]
    : [0, 0, evaluateMinMax(m.startRotation, 0, random())];
  let position, velocity;
  if (sim.space === SPACE.World) {
    position = originWorld ? add(originWorld, mulDir(at, lp)) : mulPoint(at, lp);
    velocity = scale(mulDir(at, ld), speed);
  } else {
    position = originWorld ? add(inverseDir(ps, originWorld), lp) : lp;
    velocity = scale(ld, speed);
  }
  const part = { position, velocity, startLifetime: lifetime, remainingLifetime: lifetime, startSize, rotation };
  if (ageAhead > 0) advance(ps, part, ageAhead);
  return part;
}
/** A world point into the system's local (unscaled-by-matrix) frame - a local-space sub-emitter born at a point. */
function inverseDir(ps, world) {
  const m = emitterMatrix(ps);
  const d = sub(world, [m[12], m[13], m[14]]);
  const inv = (col) => {
    const l2 = col[0] * col[0] + col[1] * col[1] + col[2] * col[2];
    return l2 > 0 ? dot(d, col) / l2 : 0;
  };
  return [inv([m[0], m[1], m[2]]), inv([m[4], m[5], m[6]]), inv([m[8], m[9], m[10]])];
}

/** The force module's acceleration in the system's space. */
function forceOf(ps, part) {
  const fo = ps.forceOverLifetime;
  if (!fo) return null;
  const t = 1 - part.remainingLifetime / (part.startLifetime || 1);
  let a = [evaluateMinMax(fo.x, t, 0.5), evaluateMinMax(fo.y, t, 0.5), evaluateMinMax(fo.z, t, 0.5)];
  const worldSim = ps._sim.space === SPACE.World;
  if (fo.space === SPACE.World && !worldSim) a = inverseDir(ps, add(a, positionOf(ps)));
  else if (fo.space === SPACE.Local && worldSim) a = mulDir(emitterMatrix(ps), a);
  return a;
}
const positionOf = (ps) => {
  const m = emitterMatrix(ps);
  return [m[12], m[13], m[14]];
};

/** A particle lived on by `dt`: its lifetime spent, the force on its velocity, the velocity on its position. */
function advance(ps, part, dt) {
  part.remainingLifetime -= dt;
  const a = forceOf(ps, part);
  if (a) part.velocity = add(part.velocity, scale(a, dt));
  part.position = add(part.position, scale(part.velocity, dt));
}

/** A particle's world centre. */
function worldPosition(ps, part) {
  return ps._sim.space === SPACE.World ? part.position : mulPoint(emitterMatrix(ps), part.position);
}
/** A particle's size per axis at its age (the size module's curves times the start size), before the transform's scale. */
function sizeOf(ps, part) {
  const sz = ps._sim.size;
  if (!sz) return part.startSize;
  const t = Math.min(1, Math.max(0, 1 - part.remainingLifetime / (part.startLifetime || 1)));
  if (sz.separateAxes)
    return [
      part.startSize[0] * evaluateMinMax(sz.curve, t, 0.5),
      part.startSize[1] * evaluateMinMax(sz.y, t, 0.5),
      part.startSize[2] * evaluateMinMax(sz.z, t, 0.5),
    ];
  const k = evaluateMinMax(sz.curve, t, 0.5);
  return [part.startSize[0] * k, part.startSize[1] * k, part.startSize[2] * k];
}

/** The collision planes against a particle's move from `p0` to `p1` (world): the first crossing's point, or null. */
function planeHit(ps, part, p0, p1) {
  if (!ps.planes.length) return null;
  const sim = ps._sim;
  const s = emitterScale(ps);
  const radius = ((sizeOf(ps, part)[0] * s) / 2) * (sim.collision.radiusScale ?? 1);
  for (const n of ps.planes) {
    const o = n.position,
      up = norm(quatRotate(n.rotation, [0, 1, 0]));
    const d0 = dot(sub(p0, o), up) - radius,
      d1 = dot(sub(p1, o), up) - radius;
    if (d0 >= 0 && d1 < 0) {
      const t = d0 / (d0 - d1);
      return add(p0, scale(sub(p1, p0), t));
    }
  }
  return null;
}
const emitterScale = (ps) =>
  ps._sim.scaling === SCALING.Local
    ? (ps.node.localScale?.[0] ?? 1)
    : ps._sim.scaling === SCALING.Hierarchy
      ? (ps.node.lossyScale?.[0] ?? 1)
      : 1;

/** A collision's sub-emitters: each one's bursts, at the point. */
function fireSubEmitters(ps, type, point, random) {
  for (const e of ps.subEmitters) {
    if (e.type !== type || random() >= e.probability) continue;
    const sys = e.system,
      sim = sys._sim;
    if (!sys.node.activeInHierarchy) continue;
    const at = emitterMatrix(sys);
    for (const b of sim.emission?.m_Bursts ?? []) {
      if (b.time > 0) continue;
      const n = Math.max(0, Math.round(evaluateMinMax(b.countCurve, 0, random())));
      for (let i = 0; i < n && sys.particles.length < sim.maxParticles; i++)
        sys.particles.push(birth(sys, at, 0, random, point));
    }
  }
}

function stepSystem(ps, dt, random) {
  const sim = ps._sim;
  // AUDIT NAV1 (the presentation, #17): AN IDLE SYSTEM - stopped, nothing alive - has nothing to step: it returned
  // below, after walking up its node's parents to ask whether it was active (a war galley carries 224 systems, one
  // of them live, and walked the rest every frame - 0.45 ms of a far galley's). Returned first, the same no-op.
  if (!ps.playing && !ps.particles.length) return;
  if (!ps.node.activeInHierarchy || dt <= 0) return;
  // the living: lived on, dead dropped, collided
  const kept = [];
  for (const part of ps.particles) {
    const p0 = worldPosition(ps, part);
    advance(ps, part, dt);
    if (part.remainingLifetime <= 0) continue;
    if (ps.planes.length) {
      const hit = planeHit(ps, part, p0, worldPosition(ps, part));
      if (hit) {
        const loss = evaluateMinMax(sim.collision.m_EnergyLossOnCollision, 0, 0.5);
        part.remainingLifetime -= part.startLifetime * loss;
        const damp = evaluateMinMax(sim.collision.m_Dampen, 0, 0.5),
          bounce = evaluateMinMax(sim.collision.m_Bounce, 0, 0.5);
        part.velocity = scale(part.velocity, (1 - damp) * bounce);
        fireSubEmitters(ps, SUB_EMITTER.Collision, hit, random);
        if (part.remainingLifetime <= 0) continue;
      }
    }
    kept.push(part);
  }
  ps.particles = kept;
  if (!ps.playing) return;
  // CSA-G: a fresh Play's startDelay is waited out before the clock and the emission start; the emitter's movement
  // over it is none of its distance
  if (ps._delay > 0) {
    const waited = Math.min(ps._delay, dt);
    ps._delay -= waited;
    dt -= waited;
    if (!(dt > 0)) {
      const m0 = emitterMatrix(ps);
      ps._lastPosition = [m0[12], m0[13], m0[14]];
      return;
    }
  }
  // the clock, the loop and the bursts
  const t0 = ps.time;
  let t1 = t0 + dt;
  const m = emitterMatrix(ps);
  const here = [m[12], m[13], m[14]];
  if (ps.emitting && sim.emission && !ps.isSubEmitter) {
    for (const [bi, b] of (sim.emission.m_Bursts ?? []).entries()) {
      if (ps._firedBursts.has(bi) || b.time > t1) continue;
      ps._firedBursts.add(bi);
      if (random() >= (b.probability ?? 1)) continue;
      const n = Math.max(0, Math.round(evaluateMinMax(b.countCurve, 0, random())));
      for (let i = 0; i < n && ps.particles.length < sim.maxParticles; i++)
        ps.particles.push(birth(ps, m, t1 - Math.max(b.time, t0), random));
    }
    // rate over time and over distance: the frame's whole crossings, each at its fraction of the frame
    const rate = evaluateMinMax(sim.emission.rateOverTime, t0 / sim.duration, random());
    const perMetre = evaluateMinMax(sim.emission.rateOverDistance, t0 / sim.duration, random());
    const moved = ps._lastPosition ? len(sub(here, ps._lastPosition)) : 0;
    const from = ps._lastPosition ?? here;
    const emitAlong = (accKey, gain) => {
      const a0 = ps[accKey];
      const a1 = a0 + gain;
      for (let k = Math.floor(a0) + 1; k <= a1 && ps.particles.length < sim.maxParticles; k++) {
        const frac = gain > 0 ? (k - a0) / gain : 1;
        const at = m.slice();
        at[12] = from[0] + (here[0] - from[0]) * frac;
        at[13] = from[1] + (here[1] - from[1]) * frac;
        at[14] = from[2] + (here[2] - from[2]) * frac;
        ps.particles.push(birth(ps, at, (1 - frac) * dt, random));
      }
      ps[accKey] = a1 - Math.floor(a1);
    };
    if (rate > 0) emitAlong('_accTime', rate * dt);
    if (perMetre > 0 && moved > 0) emitAlong('_accDistance', perMetre * moved);
  }
  ps._lastPosition = here;
  if (t1 >= sim.duration) {
    if (sim.looping) {
      t1 -= sim.duration * Math.floor(t1 / sim.duration);
      ps._firedBursts = new Set();
    } else {
      t1 = sim.duration;
      ps.emitting = false;
    }
  }
  ps.time = t1;
  if (!ps.emitting && !ps.particles.length) ps.playing = false;
}

function renderList(ps) {
  const out = [];
  if (!ps.node.activeInHierarchy) return out;
  const s =
    ps._sim.scaling === SCALING.Local
      ? ps.node.localScale
      : ps._sim.scaling === SCALING.Hierarchy
        ? ps.node.lossyScale
        : [1, 1, 1];
  const rot = ps.node.rotation;
  for (const part of ps.particles) {
    const sz = sizeOf(ps, part);
    out.push({
      position: worldPosition(ps, part),
      size: [sz[0] * s[0], sz[1] * s[1], sz[2] * s[2]],
      rotation: part.rotation,
      systemRotation: rot,
    });
  }
  return out;
}

/** Every ParticleSystem under an instance's root made and linked - an instance's systems are each other's sub-emitters. */
export function instanceParticleSystems(root, opts) {
  const systems = [];
  for (const n of root.walk()) {
    const r = n.getComponent('ParticleSystemRenderer');
    for (const comp of n.getComponents('ParticleSystem')) {
      comp.particleSystem = createParticleSystem(n, comp, r, opts);
      systems.push(comp.particleSystem);
    }
  }
  for (const s of systems) linkParticleSystem(s);
  return systems;
}

/** The C#'s `quatMultiply` of the flag's cube: the system's rotation, then the particle's own (3D, radians, Unity's Z-X-Y). */
export function particleMeshRotation(systemRotation, rotation3) {
  const d = 180 / Math.PI;
  return quatMultiply(systemRotation, quatEuler(rotation3[0] * d, rotation3[1] * d, rotation3[2] * d));
}
