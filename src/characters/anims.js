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
  // OVERHAUL (v3): every strike is built as a KINETIC CHAIN with
  // real timing, not a symmetric ease. Structure per clip:
  //   load (slow, 'smooth') -> loaded HOLD (a beat at full coil) ->
  //   LAUNCH ('snap': u^3, explosive arrival at impact) ->
  //   FOLLOW-THROUGH ('out': the blade passes the target line and
  //   hard-stops) -> settle -> home (all tracks end at 0).
  // SEQUENCING: the hips (twist) load and fire ~0.04 EARLIER than the
  // arm, the wrist/blade ~0.04 LATER - energy travels hips -> shoulder
  // -> blade like a whip. The GUARD ARM counters every swing; LEGS
  // shift weight (rest-state only - the gait owns them while moving).
  // Seat context: the +45 carry is near-horizontal, tip below the
  // wrist pivot - twist is the lateral engine, handPitch the vertical.

  // EXECUTIONER CHOP: rise and coil overhead with a visible beat,
  // then the wrist slams the tip down the centreline, body folding
  // after it, weight sinking into the lead knee.
  StrikeDown: { dur: 0.60, tracks: {
    'twist':          [[0, 0], [0.20, 0.14], [0.28, 0.16, 'snap'], [0.44, -0.16, 'out'], [0.54, -0.10], [0.78, -0.03], [1, 0]],
    'armL.sw':        [[0, 0], [0.24, -0.72], [0.32, -0.76, 'snap'], [0.48, 0.18, 'out'], [0.58, 0.32], [0.80, 0.10], [1, 0]],
    'armL.bd':        [[0, 0], [0.24, 0.50], [0.32, 0.52, 'snap'], [0.48, 0.04], [0.70, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.28, -0.60], [0.36, -0.65, 'snap'], [0.52, 1.00, 'hold'], [0.55, 1.00, 'out'], [0.64, 1.28], [0.82, 0.55], [1, 0]],
    'armR.sw':        [[0, 0], [0.28, -0.60, 'snap'], [0.52, -0.10], [0.75, -0.04], [1, 0]],
    'armR.bd':        [[0, 0], [0.28, 0.65, 'snap'], [0.52, 0.12], [1, 0]],
    'legR.bd':        [[0, 0], [0.36, 0.04, 'snap'], [0.54, 0.30], [0.80, 0.12], [1, 0]],
    'legL.sw':        [[0, 0, 'snap'], [0.54, 0.10], [1, 0]],
    'lean':           [[0, 0], [0.26, -0.12], [0.34, -0.13, 'snap'], [0.52, 0.30, 'out'], [0.62, 0.35], [0.84, 0.14], [1, 0]],
    'headPitch':      [[0, 0], [0.28, -0.22, 'snap'], [0.52, 0.12], [1, 0]],
  } },

  // FLAT CUT RIGHT: hips wind left with a beat, then fire right;
  // the blade lags and whips through, passing the line before the
  // hard stop. Guard arm swings opposite for balance.
  StrikeRight: { dur: 0.42, tracks: {
    'twist':          [[0, 0], [0.18, -0.34], [0.26, -0.38, 'snap'], [0.42, 0.48, 'out'], [0.52, 0.58], [0.76, 0.18], [1, 0]],
    'armL.sw':        [[0, 0], [0.22, -0.38], [0.30, -0.40, 'snap'], [0.46, -0.18], [0.70, -0.06], [1, 0]],
    'armL.spread':    [[0, 0], [0.22, 0.18, 'snap'], [0.46, -0.12], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.26, -0.55], [0.34, -0.58, 'snap'], [0.50, 0.62, 'hold'], [0.53, 0.62, 'out'], [0.62, 0.74], [0.80, 0.22], [1, 0]],
    'armR.sw':        [[0, 0], [0.26, -0.35, 'snap'], [0.48, 0.20], [0.75, 0.06], [1, 0]],
    'armR.spread':    [[0, 0], [0.26, 0.30, 'snap'], [0.48, -0.08], [1, 0]],
    'legL.sw':        [[0, 0, 'snap'], [0.44, -0.10], [0.75, -0.03], [1, 0]],
    'lean':           [[0, 0, 'snap'], [0.44, 0.12, 'out'], [0.60, 0.14], [1, 0]],
  } },
  // FLAT CUT LEFT (backhand): mirrored, slightly tighter windup.
  StrikeLeft: { dur: 0.42, tracks: {
    'twist':          [[0, 0], [0.18, 0.34], [0.26, 0.38, 'snap'], [0.42, -0.48, 'out'], [0.52, -0.58], [0.76, -0.18], [1, 0]],
    'armL.sw':        [[0, 0], [0.22, -0.38], [0.30, -0.40, 'snap'], [0.46, -0.18], [0.70, -0.06], [1, 0]],
    'armL.spread':    [[0, 0], [0.22, -0.18, 'snap'], [0.46, 0.12], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.26, 0.55], [0.34, 0.58, 'snap'], [0.50, -0.62, 'hold'], [0.53, -0.62, 'out'], [0.62, -0.74], [0.80, -0.22], [1, 0]],
    'armR.sw':        [[0, 0], [0.26, -0.35, 'snap'], [0.48, 0.20], [0.75, 0.06], [1, 0]],
    'armR.spread':    [[0, 0], [0.26, -0.30, 'snap'], [0.48, 0.08], [1, 0]],
    'legL.sw':        [[0, 0, 'snap'], [0.44, 0.10], [0.75, 0.03], [1, 0]],
    'lean':           [[0, 0, 'snap'], [0.44, 0.12, 'out'], [0.60, 0.14], [1, 0]],
  } },

  // DIAGONAL HACKS: shorter, brutal - half chop, half cut, weight
  // dropping through the swing.
  StrikeDownRight: { dur: 0.46, tracks: {
    'twist':          [[0, 0], [0.18, -0.16], [0.26, -0.18, 'snap'], [0.42, 0.42, 'out'], [0.52, 0.50], [0.78, 0.14], [1, 0]],
    'armL.sw':        [[0, 0], [0.22, -0.70], [0.30, -0.74, 'snap'], [0.46, 0.06, 'out'], [0.56, 0.16], [1, 0]],
    'armL.bd':        [[0, 0], [0.22, 0.32, 'snap'], [0.46, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.26, -0.50], [0.34, -0.55, 'snap'], [0.50, 0.72, 'hold'], [0.53, 0.72, 'out'], [0.62, 0.90], [0.82, 0.30], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.26, -0.60, 'snap'], [0.50, 0.70], [0.80, 0.20], [1, 0]],
    'armR.sw':        [[0, 0], [0.26, -0.40, 'snap'], [0.50, 0.12], [1, 0]],
    'legR.bd':        [[0, 0, 'snap'], [0.50, 0.26], [0.80, 0.10], [1, 0]],
    'lean':           [[0, 0], [0.26, -0.08, 'snap'], [0.50, 0.24, 'out'], [0.62, 0.28], [1, 0]],
    'headPitch':      [[0, 0], [0.26, -0.14, 'snap'], [0.50, 0.08], [1, 0]],
  } },
  StrikeDownLeft: { dur: 0.46, tracks: {
    'twist':          [[0, 0], [0.18, 0.16], [0.26, 0.18, 'snap'], [0.42, -0.42, 'out'], [0.52, -0.50], [0.78, -0.14], [1, 0]],
    'armL.sw':        [[0, 0], [0.22, -0.70], [0.30, -0.74, 'snap'], [0.46, 0.06, 'out'], [0.56, 0.16], [1, 0]],
    'armL.bd':        [[0, 0], [0.22, 0.32, 'snap'], [0.46, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.26, -0.50], [0.34, -0.55, 'snap'], [0.50, 0.72, 'hold'], [0.53, 0.72, 'out'], [0.62, 0.90], [0.82, 0.30], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.26, 0.60, 'snap'], [0.50, -0.70], [0.80, -0.20], [1, 0]],
    'armR.sw':        [[0, 0], [0.26, -0.40, 'snap'], [0.50, 0.12], [1, 0]],
    'legR.bd':        [[0, 0, 'snap'], [0.50, 0.26], [0.80, 0.10], [1, 0]],
    'lean':           [[0, 0], [0.26, -0.08, 'snap'], [0.50, 0.24, 'out'], [0.62, 0.28], [1, 0]],
    'headPitch':      [[0, 0], [0.26, -0.14, 'snap'], [0.50, 0.08], [1, 0]],
  } },

  // PISTON THRUST: coil the elbow with the pommel at the hip - a
  // clear loaded beat - then the point punches out on a lunge, rear
  // leg driving, guard hand pulling back hard for balance, overshoot
  // past full extension before the stop.
  StrikeUp: { dur: 0.38, tracks: {
    'armL.sw':        [[0, 0], [0.24, 0.32], [0.32, 0.34, 'snap'], [0.48, -1.10, 'hold'], [0.51, -1.10, 'out'], [0.58, -1.28], [0.78, -0.40], [1, 0]],
    'armL.bd':        [[0, 0], [0.24, 1.15], [0.32, 1.18, 'snap'], [0.48, -0.04], [0.70, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.24, -0.38, 'snap'], [0.48, 0.34, 'out'], [0.58, 0.40], [1, 0]],
    'twist':          [[0, 0], [0.22, 0.20], [0.30, 0.22, 'snap'], [0.46, -0.14], [1, 0]],
    'armR.sw':        [[0, 0], [0.24, -0.20, 'snap'], [0.48, 0.60], [0.72, 0.20], [1, 0]],
    'armR.bd':        [[0, 0], [0.24, 0.30, 'snap'], [0.48, 0.45], [1, 0]],
    'legR.sw':        [[0, 0], [0.30, 0.06, 'snap'], [0.48, -0.38], [0.80, -0.12], [1, 0]],
    'legR.bd':        [[0, 0, 'snap'], [0.48, 0.10], [1, 0]],
    'legL.bd':        [[0, 0, 'snap'], [0.48, 0.32], [0.80, 0.10], [1, 0]],
    'lean':           [[0, 0], [0.26, -0.05, 'snap'], [0.48, 0.30, 'out'], [0.58, 0.36], [0.82, 0.12], [1, 0]],
    'headPitch':      [[0, 0, 'snap'], [0.48, -0.06], [1, 0]],
  } },
};
