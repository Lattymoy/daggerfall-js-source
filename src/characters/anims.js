// Directional attack animations for the neutral rig (1H melee).
//
// DIRECTIONS are 1:1 with Daggerfall Unity: WeaponManager.MouseDirections
// (None, UpLeft, Up, UpRight, Left, Right, DownLeft, Down, DownRight)
// and FPSWeapon.OnAttackDirection's switch - Down/DownLeft/DownRight/
// Left/Right map to their strikes, Up + UpLeft + UpRight ALL map to
// StrikeUp (the thrust). Ported verbatim below.
//
// CLIPS are keyframed DELTAS over the active pose (melee1H): every
// track starts and ends at 0, so entry/exit are continuous by
// construction. Channels are the pose-v2 joints plus two body
// channels the attacks unlock: `twist` (rotY about the spine - body
// commitment into slashes) and `headPitch` (rotX about the neck; the
// run loco also uses it to look UP against the charge lean).
// A track is [[t, v], ...] with t normalized 0..1 over `dur` seconds;
// sampling smoothsteps between keys. Phases: windup (pull opposite,
// ~0..0.32) -> strike (fast sweep through the named direction,
// ~0.32..0.55) -> recover (settle, ..1).

export const MOUSE_DIRECTIONS = Object.freeze([
  'None', 'UpLeft', 'Up', 'UpRight', 'Left', 'Right', 'DownLeft', 'Down', 'DownRight',
]);

// FPSWeapon.OnAttackDirection, verbatim (Up/UpLeft/UpRight -> StrikeUp).
export const DIRECTION_TO_STRIKE = Object.freeze({
  Down: 'StrikeDown',
  DownLeft: 'StrikeDownLeft',
  Left: 'StrikeLeft',
  Right: 'StrikeRight',
  DownRight: 'StrikeDownRight',
  Up: 'StrikeUp', UpLeft: 'StrikeUp', UpRight: 'StrikeUp',
});

export const STRIKES = Object.freeze(['StrikeDown', 'StrikeDownLeft', 'StrikeDownRight', 'StrikeLeft', 'StrikeRight', 'StrikeUp']);

// Per-SEGMENT easing (the left key names it): 'smooth' (default,
// hermite), 'snap' (u^3 - slow load, explosive arrival: the strike),
// 'out' (1-(1-u)^3 - hard launch, decelerating stop: follow-through
// and settles), 'lin', 'hold' (step at the segment end).
const EASE = {
  smooth: (t) => t * t * (3 - 2 * t),
  snap: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  lin: (t) => t,
  hold: (t) => (t >= 1 ? 1 : 0),
};

/** Sample one track at normalized u (0..1). Key = [t, v, ease?]. */
function sampleTrack(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let k = 0; k + 1 < keys.length; k++) {
    const [t0, v0, e] = keys[k], [t1, v1] = keys[k + 1];
    if (u <= t1) return v0 + (v1 - v0) * (EASE[e] || EASE.smooth)((u - t0) / (t1 - t0 || 1e-9));
  }
  return keys[keys.length - 1][1];
}

/** Sample a clip at time t (seconds) -> nested delta object
 *  { armL:{sw,...}, armR:{...}, twist, lean, headPitch }. null when done. */
export function sampleClip(clip, t) {
  const u = t / clip.dur;
  if (u >= 1) return null;
  const out = {};
  for (const [path, keys] of Object.entries(clip.tracks)) {
    const v = sampleTrack(keys, u);
    const dot = path.indexOf('.');
    if (dot < 0) out[path] = v;
    else { const limb = path.slice(0, dot), ch = path.slice(dot + 1); (out[limb] ||= {})[limb ? ch : ch] = v; }
  }
  return out;
}

// ---- The six 1H strikes (left-hand weapon; +x = character's right,
// +z forward). NOTE: armL spread/handYaw/twist land MIRRORED in world
// (the g=2 sign flip) - lateral tracks are authored post-mirror, tuned
// against fist-travel probes (dx sign + magnitude checked live).

export const ATTACKS_1H = {
  // ACTION REDESIGN (v4, Mac: "stiff, not action oriented"): the
  // missing piece was ROOT MOTION - every clip fired from a statue
  // bolted to the floor. Clips now carry `rootX/rootY/rootZ` tracks:
  // whole-body translation (torso, head, arms, legs, the held sword,
  // and the cloth pins all ride it). Every strike MOVES: the chop
  // STEPS IN and drives down through the target, the thrust rocks
  // back then LUNGES, the cuts throw weight ACROSS the stance, the
  // hacks DROP the body through the swing. Rhythm now differs per
  // clip (fast cuts, theatrical chop, instant thrust) instead of one
  // shared windup/impact grid. Kinetic-chain stagger, snap/out
  // easing, hitstops, guard counters and the SKULL-CLEAR shallow
  // coils (sweep-picked) all carry over.

  // STEPPING CHOP (0.58): gather back + rise, a beat, then step in
  // and drive DOWN through it - lead foot lands with the blade.
  StrikeDown: { dur: 0.58, tracks: {
    'rootY':          [[0, 0], [0.30, 0.05], [0.36, 0.05, 'snap'], [0.50, -0.06, 'hold'], [0.53, -0.06, 'out'], [0.78, -0.02], [1, 0]],
    'rootZ':          [[0, 0], [0.30, -0.03], [0.36, -0.03, 'snap'], [0.50, 0.15, 'out'], [0.58, 0.17], [0.82, 0.06], [1, 0]],
    'twist':          [[0, 0], [0.22, 0.14], [0.30, 0.16, 'snap'], [0.46, -0.16, 'out'], [0.56, -0.10], [0.80, -0.03], [1, 0]],
    'armL.sw':        [[0, 0], [0.26, -0.72], [0.34, -0.76, 'snap'], [0.50, 0.18, 'out'], [0.60, 0.32], [0.82, 0.10], [1, 0]],
    'armL.bd':        [[0, 0], [0.26, 0.50], [0.34, 0.52, 'snap'], [0.50, 0.04, 'out'], [0.72, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.30, -0.60], [0.38, -0.65, 'snap'], [0.52, 1.00, 'hold'], [0.55, 1.00, 'out'], [0.66, 1.28], [0.84, 0.55], [1, 0]],
    'armR.sw':        [[0, 0], [0.30, -0.60], [0.52, -0.10, 'snap'], [0.78, -0.04], [1, 0]],
    'armR.bd':        [[0, 0], [0.30, 0.65], [0.52, 0.12, 'snap'], [1, 0]],
    'legR.sw':        [[0, 0], [0.30, -0.10], [0.36, -0.10, 'snap'], [0.50, -0.34, 'out'], [0.80, -0.10], [1, 0]],
    'legR.bd':        [[0, 0], [0.50, 0.28, 'out'], [0.82, 0.10], [1, 0]],
    'legL.sw':        [[0, 0], [0.36, 0.02, 'snap'], [0.50, 0.16, 'out'], [0.80, 0.05], [1, 0]],
    'lean':           [[0, 0], [0.28, -0.12], [0.36, -0.13, 'snap'], [0.52, 0.30, 'hold'], [0.55, 0.30, 'out'], [0.66, 0.36], [0.86, 0.14], [1, 0]],
    'headPitch':      [[0, 0], [0.30, -0.22], [0.52, 0.12, 'snap'], [1, 0]],
  } },

  // CROSSING CUT RIGHT (0.40): fast - weight loads LEFT, then the
  // whole body crosses RIGHT with the blade, pivoting on the lead.
  StrikeRight: { dur: 0.40, tracks: {
    'rootX':          [[0, 0], [0.20, -0.08], [0.26, -0.08, 'snap'], [0.44, 0.10, 'hold'], [0.47, 0.10, 'out'], [0.58, 0.12], [0.82, 0.04], [1, 0]],
    'rootZ':          [[0, 0], [0.26, 0.00, 'snap'], [0.44, 0.05, 'out'], [0.80, 0.02], [1, 0]],
    'twist':          [[0, 0], [0.16, -0.34], [0.24, -0.38, 'snap'], [0.42, 0.48, 'hold'], [0.45, 0.48, 'out'], [0.56, 0.58], [0.78, 0.18], [1, 0]],
    'armL.sw':        [[0, 0], [0.20, -0.38], [0.28, -0.40, 'snap'], [0.44, -0.18, 'out'], [0.72, -0.06], [1, 0]],
    'armL.spread':    [[0, 0], [0.20, 0.18], [0.44, -0.12, 'snap'], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.24, -0.55], [0.32, -0.58, 'snap'], [0.48, 0.62, 'hold'], [0.51, 0.62, 'out'], [0.62, 0.74], [0.82, 0.22], [1, 0]],
    'armR.sw':        [[0, 0], [0.24, -0.35], [0.46, 0.20, 'snap'], [0.76, 0.06], [1, 0]],
    'armR.spread':    [[0, 0], [0.24, 0.30], [0.46, -0.08, 'snap'], [1, 0]],
    'legL.sw':        [[0, 0], [0.42, -0.12, 'snap'], [0.76, -0.03], [1, 0]],
    'lean':           [[0, 0], [0.42, 0.12, 'snap'], [0.58, 0.14, 'out'], [1, 0]],
  } },
  StrikeLeft: { dur: 0.40, tracks: {
    'rootX':          [[0, 0], [0.20, 0.08], [0.26, 0.08, 'snap'], [0.44, -0.10, 'hold'], [0.47, -0.10, 'out'], [0.58, -0.12], [0.82, -0.04], [1, 0]],
    'rootZ':          [[0, 0], [0.26, 0.00, 'snap'], [0.44, 0.05, 'out'], [0.80, 0.02], [1, 0]],
    'twist':          [[0, 0], [0.16, 0.34], [0.24, 0.38, 'snap'], [0.42, -0.48, 'hold'], [0.45, -0.48, 'out'], [0.56, -0.58], [0.78, -0.18], [1, 0]],
    'armL.sw':        [[0, 0], [0.20, -0.38], [0.28, -0.40, 'snap'], [0.44, -0.18, 'out'], [0.72, -0.06], [1, 0]],
    'armL.spread':    [[0, 0], [0.20, -0.18], [0.44, 0.12, 'snap'], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.24, 0.55], [0.32, 0.58, 'snap'], [0.48, -0.62, 'hold'], [0.51, -0.62, 'out'], [0.62, -0.74], [0.82, -0.22], [1, 0]],
    'armR.sw':        [[0, 0], [0.24, -0.35], [0.46, 0.20, 'snap'], [0.76, 0.06], [1, 0]],
    'armR.spread':    [[0, 0], [0.24, -0.30], [0.46, 0.08, 'snap'], [1, 0]],
    'legL.sw':        [[0, 0], [0.42, 0.12, 'snap'], [0.76, 0.03], [1, 0]],
    'lean':           [[0, 0], [0.42, 0.12, 'snap'], [0.58, 0.14, 'out'], [1, 0]],
  } },

  // DROPPING HACKS (0.46): the body FALLS through the diagonal - dip
  // and drive, weight crashing onto the bent lead knee.
  StrikeDownRight: { dur: 0.46, tracks: {
    'rootY':          [[0, 0], [0.26, 0.03], [0.32, 0.03, 'snap'], [0.48, -0.11, 'hold'], [0.51, -0.11, 'out'], [0.80, -0.03], [1, 0]],
    'rootZ':          [[0, 0], [0.32, -0.02, 'snap'], [0.48, 0.10, 'out'], [0.58, 0.12], [0.84, 0.04], [1, 0]],
    'rootX':          [[0, 0], [0.32, -0.04, 'snap'], [0.48, 0.06, 'out'], [1, 0]],
    'twist':          [[0, 0], [0.18, -0.16], [0.26, -0.18, 'snap'], [0.44, 0.42, 'out'], [0.54, 0.50], [0.80, 0.14], [1, 0]],
    'armL.sw':        [[0, 0], [0.22, -0.70], [0.30, -0.74, 'snap'], [0.46, 0.06, 'out'], [0.56, 0.16], [1, 0]],
    'armL.bd':        [[0, 0], [0.22, 0.32], [0.46, 0.02, 'snap'], [1, 0]],
    'armL.handPitch': [[0, 0], [0.26, -0.50], [0.34, -0.55, 'snap'], [0.50, 0.72, 'hold'], [0.53, 0.72, 'out'], [0.62, 0.90], [0.82, 0.30], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.26, -0.60], [0.50, 0.70, 'snap'], [0.80, 0.20], [1, 0]],
    'armR.sw':        [[0, 0], [0.26, -0.40], [0.50, 0.12, 'snap'], [1, 0]],
    'legR.bd':        [[0, 0], [0.50, 0.26, 'out'], [0.82, 0.10], [1, 0]],
    'lean':           [[0, 0], [0.26, -0.08], [0.50, 0.24, 'hold'], [0.53, 0.24, 'out'], [0.64, 0.28], [1, 0]],
    'headPitch':      [[0, 0], [0.26, -0.14], [0.50, 0.08, 'snap'], [1, 0]],
  } },
  StrikeDownLeft: { dur: 0.46, tracks: {
    'rootY':          [[0, 0], [0.26, 0.03], [0.32, 0.03, 'snap'], [0.48, -0.11, 'hold'], [0.51, -0.11, 'out'], [0.80, -0.03], [1, 0]],
    'rootZ':          [[0, 0], [0.32, -0.02, 'snap'], [0.48, 0.10, 'out'], [0.58, 0.12], [0.84, 0.04], [1, 0]],
    'rootX':          [[0, 0], [0.32, 0.04, 'snap'], [0.48, -0.06, 'out'], [1, 0]],
    'twist':          [[0, 0], [0.18, 0.16], [0.26, 0.18, 'snap'], [0.44, -0.42, 'out'], [0.54, -0.50], [0.80, -0.14], [1, 0]],
    'armL.sw':        [[0, 0], [0.22, -0.70], [0.30, -0.74, 'snap'], [0.46, 0.06, 'out'], [0.56, 0.16], [1, 0]],
    'armL.bd':        [[0, 0], [0.22, 0.32], [0.46, 0.02, 'snap'], [1, 0]],
    'armL.handPitch': [[0, 0], [0.26, -0.50], [0.34, -0.55, 'snap'], [0.50, 0.72, 'hold'], [0.53, 0.72, 'out'], [0.62, 0.90], [0.82, 0.30], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.26, 0.42], [0.50, -0.70, 'snap'], [0.80, -0.20], [1, 0]],
    'armR.sw':        [[0, 0], [0.26, -0.40], [0.50, 0.12, 'snap'], [1, 0]],
    'legR.bd':        [[0, 0], [0.50, 0.26, 'out'], [0.82, 0.10], [1, 0]],
    'lean':           [[0, 0], [0.26, -0.08], [0.50, 0.24, 'hold'], [0.53, 0.24, 'out'], [0.64, 0.28], [1, 0]],
    'headPitch':      [[0, 0], [0.26, -0.14], [0.50, 0.08, 'snap'], [1, 0]],
  } },

  // LUNGING THRUST (0.36): rock back onto the trail foot, then the
  // WHOLE BODY launches - the biggest root drive of the set, point
  // punching out level, guard hand hauling back.
  StrikeUp: { dur: 0.36, tracks: {
    'rootZ':          [[0, 0], [0.24, -0.06], [0.30, -0.06, 'snap'], [0.46, 0.22, 'hold'], [0.50, 0.22, 'out'], [0.58, 0.24], [0.84, 0.08], [1, 0]],
    'rootY':          [[0, 0], [0.30, 0.00, 'snap'], [0.46, -0.06, 'out'], [0.84, -0.02], [1, 0]],
    'armL.sw':        [[0, 0], [0.24, 0.32], [0.30, 0.34, 'snap'], [0.46, -1.10, 'hold'], [0.49, -1.10, 'out'], [0.58, -1.28], [0.80, -0.40], [1, 0]],
    'armL.bd':        [[0, 0], [0.24, 1.15], [0.30, 1.18, 'snap'], [0.46, -0.04, 'out'], [0.72, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.24, -0.38], [0.46, 0.34, 'snap'], [0.56, 0.40, 'out'], [1, 0]],
    'twist':          [[0, 0], [0.22, 0.20], [0.28, 0.22, 'snap'], [0.44, -0.14, 'out'], [1, 0]],
    'armR.sw':        [[0, 0], [0.24, -0.20], [0.46, 0.60, 'snap'], [0.74, 0.20], [1, 0]],
    'armR.bd':        [[0, 0], [0.24, 0.30], [0.46, 0.45, 'snap'], [1, 0]],
    'legR.sw':        [[0, 0], [0.28, 0.06], [0.46, -0.38, 'snap'], [0.82, -0.12], [1, 0]],
    'legR.bd':        [[0, 0], [0.46, 0.10, 'snap'], [1, 0]],
    'legL.bd':        [[0, 0], [0.46, 0.32, 'snap'], [0.82, 0.10], [1, 0]],
    'lean':           [[0, 0], [0.26, -0.05], [0.46, 0.30, 'hold'], [0.49, 0.30, 'out'], [0.58, 0.36], [0.84, 0.12], [1, 0]],
    'headPitch':      [[0, 0], [0.46, -0.06, 'snap'], [1, 0]],
  } },
};
