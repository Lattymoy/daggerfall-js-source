// @ts-check
// CSA-E (2026-09-27): UNITY'S ANIMATOR, AS COME SAIL AWAY DRIVES IT.
//
// The mod plays every moving part of a boat through Mecanim: each sail's
// Animator (Stowed, or Unstowed blended by its Wind), the rudder's (the
// oars' rowing blend by RowX and RowZ at RowSpeed, the tiller or the wheel
// by TurnAngle once the sails are up), a door's (Opened). The C# only
// asks - CrossFade, SetBool, SetFloat, GetBool, GetFloat - and Unity's
// Animator does the rest after every Update and before every LateUpdate:
// the state machine, the clips sampled, the poses blended, the bones
// written (the sails' FixDeformations then bakes them). This module is
// that Animator over what tools/comeSailAwayExtract.mjs carried
// (vendor/come-sail-away/Models/animation.json): the compiled controllers,
// the override controllers' clip swaps, and each clip's muscle-clip curves.
//
// What is restated, and how:
// - A CLIP'S CURVE is a constant or streamed Hermite segments: at t, the
//   last segment starting at or before t gives ((a dt + b) dt + c) dt + d,
//   dt the time since its start (Unity's StreamedClip, as AssetStudio reads
//   it); a dense curve is its samples at its rate, linear between two. The
//   clip is sampled at start + its normalized time times its length -
//   wrapped when the clip loops (m_LoopTime), held at an end when not.
// - A BINDING is the CRC32 of the transform's path from the Animator's own
//   node (the node itself is ''), and one of position, rotation (a
//   quaternion, or euler angles turned into one Z, X, Y - Quaternion.Euler's
//   order, Unity's default for an euler curve), scale. Every property some
//   clip of the controller animates is bound; every other is left alone.
// - WRITE DEFAULTS (every state here writes them): a state that does not
//   animate a bound property writes its default - the value the property
//   had when the Animator bound it.
// - A BLEND TREE: Simple 1D by its parameter over its thresholds (below the
//   first the first child, above the last the last, linear between two
//   neighbours); Simple Directional 2D by its two parameters over its
//   children's positions (the centre child at the origin, the two whose
//   directions bracket the input's, barycentric in that triangle - outside
//   it the pair alone, normalised). Its children keep one normalized time;
//   its length is its children's weighted.
// - POSES BLEND by weight: position and scale summed, rotations summed on
//   the first's hemisphere and normalised (Mecanim's weighted quaternion
//   blend).
// - THE STATE MACHINE (one layer - the base layer's weight is one whatever
//   it stores): the default state at time 0 when it first runs; each frame
//   the time advances by dt times the state's speed (times its speed
//   parameter) over its motion's length; not in a transition, the current
//   state's transitions are asked in order - every condition (If, IfNot,
//   Greater, Less, Equals, NotEqual) true and, with an exit time, the
//   normalized time crossing it this frame (below one, on every loop) - and
//   the first that answers starts: the destination at its offset, the
//   crossfade over its duration (seconds, or times the source's length).
// - CROSSFADE (the C#'s only call into it): the named state (short or
//   "Base Layer."), faded to over normalizedTransitionDuration times the
//   current state's length. With the default offset a state already
//   playing is left to play - neither restarted nor faded to - and a
//   transition already running is interrupted from its pose as it stood
//   (held still, the new destination fading in over it). It is taken at
//   the Animator's next update, as Unity takes it; the parameters are set
//   at once.
// - A DISABLED ANIMATOR (its node inactive in the hierarchy, or the
//   component off) does nothing; enabled again, with
//   m_KeepAnimatorControllerStateOnDisable false (every Animator here), it
//   starts over - the default state at time 0, the parameters at their
//   defaults.
//
// - ANIMATION EVENTS (CSA-G): a clip's events fire as its time passes
//   them - each playing leaf of the current state and, in a transition, of
//   the state fading in, while its weight in its blend tree is above nought
//   (Mecanim evaluates no motion it weighs at nothing): an event at a
//   normalized place e of its clip fires once for every loop k whose k + e
//   the frame's normalized time crossed (after the time it stood at, up to
//   the time it reached; a state entered this frame from its start fires
//   its time-0 events too), a clip that does not loop only on its first.
//   Each goes, as Unity's SendMessage sends it, to every component on the
//   Animator's own node with a method of its name (the rudder's
//   RudderAnimationEventListener); none answering, it is dropped.
//
// What is not here: root motion (every Animator here has it off), culling
// (AlwaysAnimate here), layers beyond the base (none here), mirroring and
// cycle offsets (all off and zero here) - each is asserted, not assumed,
// when an Animator binds.

import { quatMultiply, quatAngleAxis } from './quat.js';

const f = Math.fround;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const utf8 = new TextEncoder();
/** Unity's binding path hash: CRC32 of the path's UTF-8 bytes. */
export function pathHash(path) {
  const bytes = utf8.encode(path);
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── the clips ────────────────────────────────────────────────────────────────

/** One curve component at clip time t. */
export function sampleComponent(comp, t, clip = null) {
  if ('constant' in comp) return comp.constant;
  if (comp.streamed) {
    const keys = comp.streamed;
    let lo = 0, hi = keys.length - 1, k = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid][0] <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    const [t0, a, b, c, d] = keys[k];
    if (a === 0 && b === 0 && c === 0) return d;   // a flat segment (Unity's sentinel at -infinity among them)
    const dt = f(t - t0);
    return f(f(f(f(f(f(a * dt) + b) * dt) + c) * dt) + d);
  }
  const s = comp.dense;
  const rate = clip?.denseRate ?? 0;
  if (!s?.length || !(rate > 0)) return 0;
  const x = (t - (clip?.denseBegin ?? 0)) * rate;
  if (x <= 0) return s[0];
  const i = Math.floor(x);
  if (i >= s.length - 1) return s[s.length - 1];
  const u = x - i;
  return f(s[i] + f(f(s[i + 1] - s[i]) * u));
}

/** A clip's length in seconds (Unity's AnimationClip.length). */
export const clipLength = (clip) => (clip ? Math.max(0, clip.stop - clip.start) : 0);

/** The clip time a normalized time samples: wrapped when the clip loops, held at an end when not. */
export function clipTime(clip, normalizedTime) {
  const len = clipLength(clip);
  let u = normalizedTime;
  if (clip.loop) u -= Math.floor(u);
  else u = Math.min(1, Math.max(0, u));
  return clip.start + u * len;
}

/** Quaternion.Euler(x, y, z) in degrees - Z, then X, then Y. */
export function quatEuler(x, y, z) {
  return quatMultiply(quatAngleAxis(y, [0, 1, 0]), quatMultiply(quatAngleAxis(x, [1, 0, 0]), quatAngleAxis(z, [0, 0, 1])));
}

const ATTR = Object.freeze({ position: 'position', rotation: 'rotation', euler: 'rotation', scale: 'scale' });

// ── blending ─────────────────────────────────────────────────────────────────

/** Weighted sum of poses: vectors summed, quaternions summed on the first's hemisphere and normalised. */
export function blendPoses(props, poses, weights) {
  const out = new Array(props.length);
  for (let i = 0; i < props.length; i++) {
    if (props[i].attr === 'rotation') {
      let x = 0, y = 0, z = 0, w = 0, ref = null;
      for (let k = 0; k < poses.length; k++) {
        const wt = weights[k];
        if (!(wt > 0)) continue;
        const q = poses[k][i];
        ref ??= q;
        const s = (ref[0] * q[0] + ref[1] * q[1] + ref[2] * q[2] + ref[3] * q[3]) < 0 ? -wt : wt;
        x += q[0] * s; y += q[1] * s; z += q[2] * s; w += q[3] * s;
      }
      const l = Math.hypot(x, y, z, w);
      out[i] = l > 0 ? [x / l, y / l, z / l, w / l] : [...props[i].def];
    } else {
      const v = [0, 0, 0];
      let any = false;
      for (let k = 0; k < poses.length; k++) {
        const wt = weights[k];
        if (!(wt > 0)) continue;
        const p = poses[k][i];
        v[0] += p[0] * wt; v[1] += p[1] * wt; v[2] += p[2] * wt;
        any = true;
      }
      out[i] = any ? v : [...props[i].def];
    }
  }
  return out;
}

/** Simple 1D: the thresholds' two neighbours, linear between them; clamped to the ends. */
export function weights1D(thresholds, v) {
  const n = thresholds.length;
  const w = new Array(n).fill(0);
  if (n === 0) return w;
  if (n === 1 || v <= thresholds[0]) { w[0] = 1; return w; }
  if (v >= thresholds[n - 1]) { w[n - 1] = 1; return w; }
  for (let i = 0; i < n - 1; i++) {
    const a = thresholds[i], b = thresholds[i + 1];
    if (v >= a && v <= b) {
      const u = b > a ? (v - a) / (b - a) : 0;
      w[i] = 1 - u; w[i + 1] = u;
      return w;
    }
  }
  return w;
}

/** Simple Directional 2D: the centre child and the two whose directions bracket the input's, barycentric. */
export function weights2DDirectional(positions, x, y) {
  const n = positions.length;
  const w = new Array(n).fill(0);
  const centre = positions.findIndex((p) => p[0] === 0 && p[1] === 0);
  if (x === 0 && y === 0) {
    if (centre >= 0) { w[centre] = 1; return w; }
    for (let i = 0; i < n; i++) w[i] = 1 / n;
    return w;
  }
  const around = [];
  for (let i = 0; i < n; i++) if (i !== centre) around.push({ i, a: Math.atan2(positions[i][1], positions[i][0]) });
  around.sort((p, q) => p.a - q.a);
  const ang = Math.atan2(y, x);
  let A = null, B = null;
  if (around.length === 1) { A = around[0]; }
  else {
    for (let k = 0; k < around.length; k++) {
      const p = around[k], q = around[(k + 1) % around.length];
      let lo = p.a, hi = q.a;
      if (k === around.length - 1) hi += 2 * Math.PI;
      let t = ang;
      if (t < lo) t += 2 * Math.PI;
      if (t >= lo && t <= hi) { A = p; B = q; break; }
    }
  }
  if (!A) return w;
  if (!B) {   // one direction only: its share by projection, the rest the centre's
    const pa = positions[A.i];
    const s = Math.max(0, (x * pa[0] + y * pa[1]) / (pa[0] * pa[0] + pa[1] * pa[1]));
    const a = Math.min(1, s);
    w[A.i] = a; if (centre >= 0) w[centre] = 1 - a; else w[A.i] = 1;
    return w;
  }
  const pa = positions[A.i], pb = positions[B.i];
  const det = pa[0] * pb[1] - pa[1] * pb[0];
  let a, b;
  if (Math.abs(det) < 1e-12) { a = 1; b = 0; }
  else { a = (x * pb[1] - y * pb[0]) / det; b = (pa[0] * y - pa[1] * x) / det; }
  a = Math.max(0, a); b = Math.max(0, b);
  const sum = a + b;
  if (sum > 1 || centre < 0) { w[A.i] = a / (sum || 1); w[B.i] = b / (sum || 1); return w; }
  w[A.i] = a; w[B.i] = b; w[centre] = 1 - sum;
  return w;
}

// ── the controller as the Animator reads it ──────────────────────────────────

/** A controller reference - an override (its base, its clips swapped) or a controller - resolved against the data. */
export function resolveController(animation, ref) {
  const override = animation.overrides?.[ref];
  const controller = animation.controllers?.[override ? override.base : ref];
  if (!controller) return null;
  const swap = new Map(override?.clips ?? []);
  const clipOf = (name) => (name == null ? null : animation.clips?.[swap.get(name) ?? name] ?? null);
  return { name: ref, controller, clipOf };
}

/** Every leaf clip a state's motion reaches, as [motionIndex, clip]. */
function leaves(motion, clipOf, at = 0, out = []) {
  const m = motion?.[at];
  if (!m) return out;
  if (m.clip != null || !m.children?.length) out.push([at, clipOf(m.clip)]);
  else for (const c of m.children) leaves(motion, clipOf, c, out);
  return out;
}

/**
 * THE ANIMATOR over one node: the controller resolved, the properties bound, its parameters and its layer.
 * @param {import('./prefabNode.js').PrefabNode} node - the node the Animator component sits on
 * @param {any} component - the component record ({ m_Controller: { controller }, m_Enabled, ... })
 * @param {any} animation - animation.json
 */
export function createAnimator(node, component, animation) {
  const ref = component?.m_Controller?.controller ?? null;
  const resolved = ref != null ? resolveController(animation, ref) : null;
  const layer0 = resolved?.controller.layers?.[0] ?? null;
  if (resolved && component.m_ApplyRootMotion) throw new Error(`${ref}: root motion is not restated`);
  if (resolved && (resolved.controller.layers?.length ?? 0) > 1) throw new Error(`${ref}: one layer is restated`);
  const states = layer0?.states ?? [];
  const stateByName = new Map();
  for (const s of states) { stateByName.set(s.name, s); if (s.fullPath) stateByName.set(s.fullPath, s); }
  const clipOf = resolved?.clipOf ?? (() => null);

  // the bindings: every property some clip of the controller animates, on a node under this one
  const nodeByHash = new Map();
  for (const n of node.walk()) nodeByHash.set(pathHash(n.pathFrom(node)), n);
  const props = [];
  const propIndex = new Map();
  for (const s of states) {
    for (const [, clip] of leaves(s.motion, clipOf)) {
      for (const cv of clip?.curves ?? []) {
        const target = nodeByHash.get(cv.path);
        const attr = ATTR[cv.attribute];
        if (!target || !attr) continue;   // a curve naming no node here animates nothing, as in Unity
        const key = `${cv.path}:${attr}`;
        if (propIndex.has(key)) continue;
        propIndex.set(key, props.length);
        props.push({ node: target, attr, def: null });
      }
    }
  }

  const params = new Map();
  const resetParams = () => {
    params.clear();
    for (const p of resolved?.controller.params ?? []) params.set(p.name, { type: p.type, value: p.type === 'Bool' || p.type === 'Trigger' ? !!p.default : Number(p.default) });
  };
  resetParams();

  /** @type {any} */
  const a = {
    node, component, controllerName: ref, props,
    _internals: null,
    /** @type {null | { state: any, time: number }} */ current: null,
    /** @type {null | { state: any, time: number }} */ next: null,
    /** @type {null | { duration: number, elapsed: number, snapshot: any[] | null }} */ transition: null,
    /** @type {null | { state: any, duration: number }} */ pending: null,
    bound: false,
    wasEnabled: false,
    lastPose: null,

    GetBool(name) { const p = params.get(name); return p ? !!p.value : false; },
    SetBool(name, v) { const p = params.get(name); if (p) p.value = !!v; },
    GetFloat(name) { const p = params.get(name); return p ? Number(p.value) : 0; },
    SetFloat(name, v) { const p = params.get(name); if (p) p.value = f(v); },
    /** Animator.CrossFade(stateName, normalizedTransitionDuration) - the default layer and offset. */
    CrossFade(stateName, normalizedTransitionDuration) {
      const s = stateByName.get(stateName) ?? stateByName.get(`${layer0?.name}.${stateName}`) ?? null;
      if (!s) return;
      a.pending = { state: s, duration: normalizedTransitionDuration };
    },
    /** Animator.Play(stateName, layer, normalizedTime), Unity's arguments in Unity's order - straight into a state at
     *  `normalizedTime`, no blend: what is playing and any transition under way are dropped at the next frame (a
     *  CrossFade to the state a transition already heads for is no change, as in Unity - so a slow transition can only
     *  be cut short this way). `layer` is read as the first (-1 or 0 alike: the port runs a controller's first layer, as
     *  CrossFade does). AUDIT GN-G2: a gun's shutter snapped open as its ball leaves (systems/naval/galleonGunDeck.js). */
    Play(stateName, layer = -1, normalizedTime = 0) {
      const s = stateByName.get(stateName) ?? stateByName.get(`${layer0?.name}.${stateName}`) ?? null;
      if (!s) return;
      a.pending = { state: s, duration: 0, play: true, time: normalizedTime };
    },
    /** The state playing, or fading in (Animator.GetCurrentAnimatorStateInfo / GetNextAnimatorStateInfo). */
    get stateName() { return a.current?.state.name ?? layer0?.defaultState ?? null; },
    get nextStateName() { return a.next?.state.name ?? null; },
    get enabled() { return component?.m_Enabled !== 0 && component?.m_Enabled !== false; },
    /** The Animator's frame. */
    update(dt) { animatorUpdate(a, dt); },
  };

  const motionLength = (state) => {
    const m = state?.motion;
    if (!m?.length) return 0;
    return treeLength(m, 0);
  };
  const treeLength = (m, at) => {
    const node0 = m[at];
    if (node0.clip != null || !node0.children?.length) return clipLength(clipOf(node0.clip));
    const w = treeWeights(m, at);
    let len = 0;
    node0.children.forEach((c, k) => { if (w[k] > 0) len += w[k] * treeLength(m, c); });
    return len;
  };
  const treeWeights = (m, at) => {
    const node0 = m[at];
    if (node0.type === 1) return weights2DDirectional(node0.positions, a.GetFloat(node0.param), a.GetFloat(node0.paramY));
    return weights1D(node0.thresholds, a.GetFloat(node0.param));
  };
  // PERF-SAILS4 (2026-10-14, the owner's client online in a port: a ship's animators 0.31 ms of the frame, every one of
  // them standing - her sails stowed, her doors and gunports closed, her rudder home): A CLIP'S CURVES ARE BOUND ONCE,
  // AND A CLIP THAT DOES NOT MOVE IS POSED ONCE. Each frame asked every curve's property by a string made for it, and
  // posed every clip anew - 129 of the vendored 141 clips hold every component `constant`, so their pose is the same at
  // any time. Its bindings are kept in its curves' order (a later curve on one property is the one that stands, as
  // before), and a constant clip's pose is made at its first ask after the props are bound (their `def`, read once) and
  // handed out as made - its readers (the write, the blend, a transition's snapshot) read it and never write it.
  const clipBinds = new Map();   // clip -> { binds: [property index, curve, euler?] in its curves' order, constant, pose }
  const bindsOf = (clip) => {
    let b = clipBinds.get(clip);
    if (!b) {
      const binds = [];
      for (const cv of clip.curves) {
        const i = propIndex.get(`${cv.path}:${ATTR[cv.attribute]}`);
        if (i != null) binds.push(i, cv, cv.attribute === 'euler');
      }
      b = { binds, constant: clip.curves.every((cv) => cv.components.every((c) => 'constant' in c)), pose: null };
      clipBinds.set(clip, b);
    }
    return b;
  };
  const leafPose = (clip, normalizedTime) => {
    if (!clip) return props.map((p) => [...p.def]);
    const b = bindsOf(clip);
    if (b.pose) return b.pose;
    const pose = props.map((p) => [...p.def]);
    const t = clipTime(clip, normalizedTime);
    const binds = b.binds;
    for (let k = 0; k < binds.length; k += 3) {
      const cv = binds[k + 1];
      const v = cv.components.map((c) => sampleComponent(c, t, clip));
      pose[binds[k]] = binds[k + 2] ? quatEuler(v[0], v[1], v[2]) : v;
    }
    if (b.constant) b.pose = pose;
    return pose;
  };
  const treePose = (m, at, normalizedTime) => {
    const node0 = m[at];
    if (node0.clip != null || !node0.children?.length) return leafPose(clipOf(node0.clip), normalizedTime);
    const w = treeWeights(m, at);
    const poses = [], ws = [];
    node0.children.forEach((c, k) => { if (w[k] > 0) { poses.push(treePose(m, c, normalizedTime)); ws.push(w[k]); } });
    return poses.length ? blendPoses(props, poses, ws) : props.map((p) => [...p.def]);
  };
  const statePose = (entry) => (entry.state.motion?.length ? treePose(entry.state.motion, 0, entry.time) : props.map((p) => [...p.def]));
  /** CSA-G: every leaf clip a state's motion plays, with its weight through the tree (none weighed at nothing). */
  const leafClips = (m, at = 0, w = 1, out = []) => {
    const node0 = m?.[at];
    if (!node0) return out;
    if (node0.clip != null || !node0.children?.length) { out.push([clipOf(node0.clip), w]); return out; }
    const tw = treeWeights(m, at);
    node0.children.forEach((c, k) => { if (tw[k] > 0) leafClips(m, c, w * tw[k], out); });
    return out;
  };
  /** CSA-G: the events an entry's clips passed this frame, from `from` to `to` in its normalized time, in time order. */
  const eventsCrossed = (entry, from, to, closedStart) => {
    const out = [];
    if (!(to > from) && !(closedStart && to === from)) return out;
    for (const [clip] of leafClips(entry.state.motion)) {   // none weighed at nought: the walk leaves them out
      const len = clipLength(clip);
      if (!(len > 0) || !clip.events?.length) continue;
      for (const ev of clip.events) {
        const e = (ev.time - clip.start) / len;
        const kMax = clip.loop ? Math.floor(to - e) : 0;
        for (let k = clip.loop ? Math.max(0, Math.ceil(from - e)) : 0; k <= kMax; k++) {
          const at = k + e;
          if (at > to || at < from || (at === from && !closedStart)) continue;
          out.push({ at, ev, clip });
        }
      }
    }
    return out.sort((x, y) => x.at - y.at);
  };
  const speedOf = (state) => (state.speed ?? 1) * (state.speedParam ? a.GetFloat(state.speedParam) : 1);

  const conditionsHold = (t) => (t.conditions ?? []).every((c) => {
    const p = params.get(c.param);
    if (!p) return false;
    switch (c.mode) {
      case 'If': return !!p.value;
      case 'IfNot': return !p.value;
      case 'Greater': return Number(p.value) > c.threshold;
      case 'Less': return Number(p.value) < c.threshold;
      case 'Equals': return Number(p.value) === c.threshold;
      case 'NotEqual': return Number(p.value) !== c.threshold;
      default: return false;
    }
  });
  // the exit time crossed this frame: below one on every loop (the first k + exit past `before`), else once
  const exitCrossed = (exit, before, after) => {
    if (exit < 1) {
      let at = Math.floor(before) + exit;
      if (at <= before) at += 1;
      return at <= after;
    }
    return before < exit && exit <= after;
  };

  a._internals = { motionLength, statePose, speedOf, conditionsHold, exitCrossed, stateByName, layer0, resetParams, eventsCrossed };
  return a;
}

/** One Animator frame: bind on first enable, take a CrossFade asked since, advance, transition, evaluate, write. */
function animatorUpdate(a, dt) {
  const on = a.enabled && a.node.activeInHierarchy && a._internals.layer0;
  if (!on) { a.wasEnabled = false; a.pending = null; return; }
  const I = a._internals;
  if (!a.bound) {
    for (const p of a.props) p.def = p.attr === 'position' ? [...p.node.localPosition] : p.attr === 'rotation' ? [...p.node.localRotation] : [...p.node.localScale];
    a.bound = true;
  }
  if (!a.wasEnabled) {   // enabled (again): the default state at 0, the parameters at their defaults
    const def = I.stateByName.get(I.layer0.defaultState) ?? I.layer0.states[0] ?? null;
    a.current = def ? { state: def, time: 0, fresh: true } : null;
    a.next = null; a.transition = null;
    if (a.lastPose) I.resetParams();
    a.wasEnabled = true;
  }
  if (!a.current) return;

  // a CrossFade asked since the last frame
  if (a.pending) {
    const { state, duration, play, time } = a.pending;
    a.pending = null;
    const playing = a.transition ? a.next.state : a.current.state;
    if (play) { a.current = { state, time: time ?? 0, fresh: true }; a.next = null; a.transition = null; }   // Play: no blend
    else if (state !== playing) {
      const srcLen = I.motionLength(a.current.state);
      const snapshot = a.transition ? (a.lastPose ?? I.statePose(a.current)) : null;
      a.next = { state, time: 0, fresh: true };
      a.transition = { duration: duration * srcLen, elapsed: 0, snapshot };
    }
  }

  // advance
  const advance = (entry) => {
    const len = I.motionLength(entry.state);
    const before = entry.time;
    entry.time += len > 0 ? (dt * I.speedOf(entry.state)) / len : 0;
    return before;
  };
  const before = advance(a.current);
  const nextBefore = a.next ? advance(a.next) : null;
  // CSA-G: the events the frame's time passed - the current state's, then the one fading in
  const fired = [[a.current, before], ...(a.next ? [[a.next, nextBefore]] : [])];
  for (const [entry, from] of fired) {
    const crossed = I.eventsCrossed(entry, from, entry.time, !!entry.fresh);
    entry.fresh = false;
    for (const { ev } of crossed) for (const comp of a.node.components ?? []) if (typeof comp?.[ev.functionName] === 'function') comp[ev.functionName](ev);
  }

  // the transitions
  if (a.transition) {
    a.transition.elapsed += dt;
    if (a.transition.elapsed >= a.transition.duration) { a.current = a.next; a.next = null; a.transition = null; }
  } else {
    for (const t of a.current.state.transitions ?? []) {
      if (!I.conditionsHold(t)) continue;
      if (t.hasExitTime && !I.exitCrossed(t.exitTime, before, a.current.time)) continue;
      const to = I.stateByName.get(t.to);
      if (!to) continue;
      const srcLen = I.motionLength(a.current.state);
      a.next = { state: to, time: t.offset ?? 0, fresh: true };
      a.transition = { duration: t.hasFixedDuration ? t.duration : t.duration * srcLen, elapsed: 0, snapshot: null };
      if (!(a.transition.duration > 0)) { a.current = a.next; a.next = null; a.transition = null; }
      break;
    }
  }

  // evaluate and write
  let pose = I.statePose(a.current);
  if (a.transition) {
    const w = Math.min(1, a.transition.elapsed / a.transition.duration);
    const src = a.transition.snapshot ?? pose;
    pose = blendPoses(a.props, [src, I.statePose(a.next)], [1 - w, w]);
  }
  a.lastPose = pose;
  a.props.forEach((p, i) => {
    if (p.attr === 'position') p.node.localPosition = [...pose[i]];
    else if (p.attr === 'rotation') p.node.localRotation = [...pose[i]];
    else p.node.localScale = [...pose[i]];
  });
}
