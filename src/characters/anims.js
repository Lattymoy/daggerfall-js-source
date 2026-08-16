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


// ---- HIT REACTIONS. A hit from a direction staggers the body AWAY
// from it. COUPLING LAW: reactions use ONLY shared channels (twist,
// lean, roots, head, legs) - body and held weapon move together, so
// every grip/station coupling survives by construction; arm deltas
// would tear grips in the coupled states. Reactions are FREE clips:
// wall-clock, outside the weapon machine (a stagger is not an attack
// frame), and they may interrupt a swing visually.

export const REACTIONS = {
  HurtFront: { dur: 0.36, tracks: {
    'headPitch': [[0, 0], [0.18, -0.32, 'snap'], [0.30, -0.36, 'out'], [1, 0]],
    'lean':      [[0, 0], [0.18, -0.15, 'snap'], [0.34, -0.17, 'out'], [1, 0]],
    'rootZ':     [[0, 0], [0.20, -0.07, 'snap'], [0.40, -0.08, 'out'], [1, 0]],
    'legR.sw':   [[0, 0], [0.22, 0.16, 'snap'], [1, 0]],
    'legR.bd':   [[0, 0], [0.22, 0.12, 'snap'], [1, 0]],
  } },
  HurtBack: { dur: 0.36, tracks: {
    'headPitch': [[0, 0], [0.18, 0.28, 'snap'], [0.30, 0.32, 'out'], [1, 0]],
    'lean':      [[0, 0], [0.18, 0.17, 'snap'], [0.34, 0.19, 'out'], [1, 0]],
    'rootZ':     [[0, 0], [0.20, 0.06, 'snap'], [0.40, 0.07, 'out'], [1, 0]],
    'legL.sw':   [[0, 0], [0.22, -0.14, 'snap'], [1, 0]],
    'legL.bd':   [[0, 0], [0.22, 0.12, 'snap'], [1, 0]],
  } },
  HurtLeft: { dur: 0.36, tracks: {
    'twist':     [[0, 0], [0.18, 0.22, 'snap'], [0.32, 0.25, 'out'], [1, 0]],
    'rootX':     [[0, 0], [0.20, 0.08, 'snap'], [0.40, 0.09, 'out'], [1, 0]],
    'lean':      [[0, 0], [0.20, 0.06, 'snap'], [1, 0]],
    'headPitch': [[0, 0], [0.18, -0.10, 'snap'], [1, 0]],
  } },
  HurtRight: { dur: 0.36, tracks: {
    'twist':     [[0, 0], [0.18, -0.22, 'snap'], [0.32, -0.25, 'out'], [1, 0]],
    'rootX':     [[0, 0], [0.20, -0.08, 'snap'], [0.40, -0.09, 'out'], [1, 0]],
    'lean':      [[0, 0], [0.20, 0.06, 'snap'], [1, 0]],
    'headPitch': [[0, 0], [0.18, -0.10, 'snap'], [1, 0]],
  } },
};

// ---- FIRST-PERSON strikes (fpMelee1H). Dedicated clips like the
// classic FP sprites - the 1H set is authored over the LOW ready and
// breaks on the raised viewmodel base. Design law for FP: the WRIST
// drives the sweep (the arm is already raised into frame), body
// channels stay small (the camera rides the head - lean pitches the
// EYE), and every sweep crosses the frame in its strike's direction.
// Deltas start/end 0 so the viewmodel frame is exact at both ends.

// ON ICE (2026-08-17, Mac): the FP voxel sweeps are parked with the
// viewmodel (see characterSprite.js); PlayerWeapon.pose() and the
// units pins stay green for the thaw.
export const ATTACKS_FP = {
  StrikeDown: { dur: 0.50, tracks: {
    'armL.handPitch': [[0, 0], [0.30, -0.55], [0.38, -0.60, 'snap'], [0.56, 0.75, 'hold'], [0.60, 0.75, 'out'], [0.72, 0.85], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.30, 0.15], [0.56, -0.10, 'snap'], [1, 0]],
    'armL.sw':        [[0, 0], [0.30, 0.10], [0.38, 0.11, 'snap'], [0.56, -0.14, 'out'], [1, 0]],
    'lean':           [[0, 0], [0.38, -0.04, 'snap'], [0.56, 0.10, 'out'], [0.82, 0.03], [1, 0]],
    'rootY':          [[0, 0], [0.56, -0.05, 'snap'], [0.84, -0.01], [1, 0]],
  } },
  StrikeLeft: { dur: 0.50, tracks: {
    'armL.handYaw':   [[0, 0], [0.28, 0.55], [0.36, 0.60, 'snap'], [0.54, -0.70, 'hold'], [0.58, -0.70, 'out'], [0.70, -0.80], [1, 0]],
    'armL.handPitch': [[0, 0], [0.28, -0.15], [0.36, -0.17, 'snap'], [0.54, 0.62, 'hold'], [0.58, 0.62, 'out'], [1, 0]],   // the tip must DROP through mid-frame as the yaw crosses - yaw alone waves along the top edge
    'twist':          [[0, 0], [0.54, -0.08, 'snap'], [0.80, -0.02], [1, 0]],
    'rootX':          [[0, 0], [0.36, 0.03, 'snap'], [0.54, -0.05, 'out'], [1, 0]],
  } },
  StrikeRight: { dur: 0.50, tracks: {
    'armL.handYaw':   [[0, 0], [0.28, -0.55], [0.36, -0.60, 'snap'], [0.54, 0.70, 'hold'], [0.58, 0.70, 'out'], [0.70, 0.80], [1, 0]],
    'armL.handPitch': [[0, 0], [0.28, -0.15], [0.36, -0.17, 'snap'], [0.54, 0.62, 'hold'], [0.58, 0.62, 'out'], [1, 0]],
    'twist':          [[0, 0], [0.54, 0.08, 'snap'], [0.80, 0.02], [1, 0]],
    'rootX':          [[0, 0], [0.36, -0.03, 'snap'], [0.54, 0.05, 'out'], [1, 0]],
  } },
  StrikeDownLeft: { dur: 0.50, tracks: {
    'armL.handPitch': [[0, 0], [0.30, -0.40], [0.38, -0.44, 'snap'], [0.56, 0.55, 'hold'], [0.60, 0.55, 'out'], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.30, 0.40], [0.56, -0.50, 'snap'], [0.78, -0.14], [1, 0]],
    'lean':           [[0, 0], [0.56, 0.07, 'snap'], [1, 0]],
    'rootY':          [[0, 0], [0.56, -0.04, 'snap'], [1, 0]],
  } },
  StrikeDownRight: { dur: 0.50, tracks: {
    'armL.handPitch': [[0, 0], [0.30, -0.40], [0.38, -0.44, 'snap'], [0.56, 0.55, 'hold'], [0.60, 0.55, 'out'], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.30, -0.40], [0.56, 0.50, 'snap'], [0.78, 0.14], [1, 0]],
    'lean':           [[0, 0], [0.56, 0.07, 'snap'], [1, 0]],
    'rootY':          [[0, 0], [0.56, -0.04, 'snap'], [1, 0]],
  } },
  StrikeUp: { dur: 0.50, tracks: {
    'armL.handPitch': [[0, 0], [0.28, -0.20], [0.34, -0.22, 'snap'], [0.52, 0.85, 'hold'], [0.56, 0.85, 'out'], [0.68, 0.92], [1, 0]],   // POSITIVE pitch lowers the tip on this base (empirical): rear up briefly, then LEVEL the point into the frame centre with the lunge
    'armL.bd':        [[0, 0], [0.28, 0.18], [0.34, 0.19, 'snap'], [0.52, -0.10, 'out'], [1, 0]],
    'rootZ':          [[0, 0], [0.34, -0.03, 'snap'], [0.52, 0.12, 'hold'], [0.56, 0.12, 'out'], [0.84, 0.03], [1, 0]],
    'lean':           [[0, 0], [0.52, 0.08, 'snap'], [0.80, 0.02], [1, 0]],
  } },
};

// ---- RANGED (bows, rangedAim). One clip, direction-agnostic (the
// classic bow fires the same regardless of drag direction). The pose
// IS the drawn aim; the clip is the LOOSE: a last-inch pull to
// anchor, a held beat, then the string hand flicks back off the
// loose and settles home to the nock. The bow arm holds.

export const ATTACKS_RANGED = {
  // THE LOOSE (v2): last-inch pull with the whole back (twist
  // deepens), a held ANCHOR beat, then the snap - the string hand
  // flies back-open past the ear with a hard stop, the bow JUMPS and
  // ROLLS in the loose grip (handRoll about the forearm = about the
  // aim axis), the frame recoils, and everything settles home to the
  // nock. Head stays on the target throughout.
  Release: { dur: 0.70, tracks: {
    'armR.sw':     [[0, 0], [0.36, 0.12], [0.46, 0.14, 'snap'], [0.54, 0.42, 'hold'], [0.58, 0.42, 'out'], [0.72, 0.55], [0.88, 0.20], [1, 0]],
    'armR.bd':     [[0, 0], [0.36, 0.18], [0.46, 0.20, 'snap'], [0.54, -0.35, 'out'], [0.80, -0.08], [1, 0]],
    'armR.spread': [[0, 0], [0.36, 0.10], [0.46, 0.11, 'snap'], [0.54, -0.20, 'out'], [0.82, -0.05], [1, 0]],
    'twist':       [[0, 0], [0.36, 0.08], [0.46, 0.09, 'snap'], [0.54, -0.06, 'out'], [0.80, -0.02], [1, 0]],
    'armL.handRoll': [[0, 0], [0.50, 0, 'snap'], [0.56, 0.85, 'hold'], [0.60, 0.85, 'out'], [0.84, 0.22], [1, 0]],
    'armL.sw':     [[0, 0], [0.50, 0, 'snap'], [0.56, -0.10, 'out'], [0.80, -0.03], [1, 0]],
    'lean':        [[0, 0], [0.40, -0.03], [0.50, -0.03, 'snap'], [0.58, 0.05, 'out'], [0.82, 0.01], [1, 0]],
    'rootZ':       [[0, 0], [0.50, 0, 'snap'], [0.58, -0.035, 'out'], [0.84, -0.01], [1, 0]],
    'headPitch':   [[0, 0], [0.40, -0.03], [0.70, -0.01], [1, 0]],
  } },
};

// ---- 2H strikes (Claymore, melee2H). COUPLING RULE: both fists must
// hold their hilt STATIONS every frame. armL + body channels are
// authored freely (they move the hilt); the armR tracks below are
// PRE-SOLVED offline against the moving off-hand station (dense 'lin'
// keys, solved frame-to-frame with continuity seeding) and baked in -
// exact at the keys, drift verified live. Greatsword character:
// slower, heavier, bigger travel than 1H; the body does the work.

export const ATTACKS_2H = {
  // OVERHEAD CLEAVE (0.66): the whole frame rises and coils, a long
  // beat, then steps in and brings everything down through the line.
  StrikeDown: { dur: 0.66, tracks: {
    'rootY':          [[0, 0], [0.30, 0.06], [0.38, 0.06, 'snap'], [0.52, -0.09, 'hold'], [0.55, -0.09, 'out'], [0.80, -0.03], [1, 0]],
    'rootZ':          [[0, 0], [0.30, -0.04], [0.38, -0.04, 'snap'], [0.52, 0.18, 'out'], [0.62, 0.20], [0.84, 0.07], [1, 0]],
    'twist':          [[0, 0], [0.24, 0.10], [0.32, 0.12, 'snap'], [0.48, -0.12, 'out'], [0.78, -0.03], [1, 0]],
    'lean':           [[0, 0], [0.28, -0.14], [0.38, -0.15, 'snap'], [0.54, 0.30, 'hold'], [0.57, 0.30, 'out'], [0.68, 0.36], [0.86, 0.14], [1, 0]],
    'headPitch':      [[0, 0], [0.30, -0.22], [0.54, 0.12, 'snap'], [1, 0]],
    'armL.sw':        [[0, 0], [0.28, -0.55], [0.36, -0.58, 'snap'], [0.52, 0.30, 'hold'], [0.55, 0.30, 'out'], [0.66, 0.40], [0.84, 0.12], [1, 0]],
    'armR.sw': [[0, 0], [0.0588, -0.222, 'lin'], [0.1176, -0.432, 'lin'], [0.1765, -0.624, 'lin'], [0.2353, -0.754, 'lin'], [0.2941, -0.784, 'lin'], [0.3529, -0.826, 'lin'], [0.4118, -0.796, 'lin'], [0.4706, -0.566, 'lin'], [0.5, -0.207, 'lin'], [0.5294, 0.312, 'lin'], [0.5882, 0.522, 'lin'], [0.6471, 0.602, 'lin'], [0.7059, 0.602, 'lin'], [0.7647, 0.342, 'lin'], [0.8235, 0.07, 'lin'], [0.8824, -0.01, 'lin'], [0.9412, -0.022, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.bd': [[0, 0], [0.0588, -0.264, 'lin'], [0.1176, -0.306, 'lin'], [0.1765, -0.268, 'lin'], [0.2353, -0.292, 'lin'], [0.2941, -0.266, 'lin'], [0.3529, -0.32, 'lin'], [0.4118, -0.3, 'lin'], [0.4706, -0.292, 'lin'], [0.5, -0.312, 'lin'], [0.5294, -0.088, 'lin'], [0.5882, 0.134, 'lin'], [0.6471, 0.256, 'lin'], [0.7059, 0.336, 'lin'], [0.7647, 0.088, 'lin'], [0.8235, -0.214, 'lin'], [0.8824, -0.306, 'lin'], [0.9412, -0.138, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.spread': [[0, 0], [0.0588, -0.024, 'lin'], [0.1176, -0.092, 'lin'], [0.1765, -0.23, 'lin'], [0.2353, -0.422, 'lin'], [0.2941, -0.502, 'lin'], [0.3529, -0.54, 'lin'], [0.4118, -0.498, 'lin'], [0.4706, -0.196, 'lin'], [0.5, -0.019, 'lin'], [0.5294, -0.042, 'lin'], [0.5882, -0.08, 'lin'], [0.6471, -0.092, 'lin'], [0.7059, -0.08, 'lin'], [0.7647, -0.038, 'lin'], [0.8235, -0.02, 'lin'], [0.8824, -0.008, 'lin'], [0.9412, -0.008, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armL.bd':        [[0, 0], [0.28, 0.35], [0.36, 0.36, 'snap'], [0.52, 0.02, 'out'], [1, 0]],
    'armL.handPitch': [[0, 0], [0.30, -0.45], [0.38, -0.48, 'snap'], [0.54, 0.70, 'hold'], [0.57, 0.70, 'out'], [0.68, 0.76], [0.86, 0.28], [1, 0]],
    'legR.sw':        [[0, 0], [0.38, -0.08, 'snap'], [0.52, -0.30, 'out'], [0.82, -0.10], [1, 0]],
    'legR.bd':        [[0, 0], [0.52, 0.30, 'out'], [0.84, 0.10], [1, 0]],
    'legL.sw':        [[0, 0], [0.52, 0.16, 'out'], [0.82, 0.05], [1, 0]],
  } },
  // GREAT CUTS (0.50): the hips are the blade - big twist with the
  // frame crossing on rootX, arms carrying the hilt around.
  StrikeRight: { dur: 0.50, tracks: {
    'twist':          [[0, 0], [0.20, -0.42], [0.28, -0.46, 'snap'], [0.46, 0.55, 'hold'], [0.49, 0.55, 'out'], [0.60, 0.66], [0.82, 0.20], [1, 0]],
    'rootX':          [[0, 0], [0.24, -0.10], [0.30, -0.10, 'snap'], [0.48, 0.12, 'hold'], [0.51, 0.12, 'out'], [0.62, 0.14], [0.84, 0.05], [1, 0]],
    'rootZ':          [[0, 0], [0.30, 0.00, 'snap'], [0.48, 0.06, 'out'], [0.82, 0.02], [1, 0]],
    'lean':           [[0, 0], [0.46, 0.12, 'snap'], [0.62, 0.15, 'out'], [1, 0]],
    'armL.sw':        [[0, 0], [0.24, -0.30], [0.32, -0.32, 'snap'], [0.48, -0.10, 'out'], [0.76, -0.03], [1, 0]],
    'armR.sw': [[0, 0], [0.0588, -0.11, 'lin'], [0.1176, -0.302, 'lin'], [0.1765, -0.332, 'lin'], [0.2353, -0.424, 'lin'], [0.2941, -0.454, 'lin'], [0.3529, -0.454, 'lin'], [0.4118, -0.404, 'lin'], [0.4706, -0.274, 'lin'], [0.5294, -0.174, 'lin'], [0.5882, -0.174, 'lin'], [0.6471, -0.174, 'lin'], [0.7059, -0.174, 'lin'], [0.7647, -0.186, 'lin'], [0.8235, -0.186, 'lin'], [0.8824, -0.168, 'lin'], [0.9412, -0.168, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.bd': [[0, 0], [0.0588, -0.134, 'lin'], [0.1176, -0.326, 'lin'], [0.1765, -0.188, 'lin'], [0.2353, -0.28, 'lin'], [0.2941, -0.322, 'lin'], [0.3529, -0.31, 'lin'], [0.4118, -0.28, 'lin'], [0.4706, -0.3, 'lin'], [0.5294, -0.242, 'lin'], [0.5882, -0.3, 'lin'], [0.6471, -0.318, 'lin'], [0.7059, -0.318, 'lin'], [0.7647, -0.33, 'lin'], [0.8235, -0.33, 'lin'], [0.8824, -0.312, 'lin'], [0.9412, -0.33, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.spread': [[0, 0], [0.0588, -0.012, 'lin'], [0.1176, -0.024, 'lin'], [0.1765, -0.042, 'lin'], [0.2353, -0.06, 'lin'], [0.2941, -0.06, 'lin'], [0.3529, -0.06, 'lin'], [0.4118, -0.048, 'lin'], [0.4706, -0.048, 'lin'], [0.5294, -0.066, 'lin'], [0.5882, -0.066, 'lin'], [0.6471, -0.066, 'lin'], [0.7059, -0.054, 'lin'], [0.7647, -0.042, 'lin'], [0.8235, -0.03, 'lin'], [0.8824, -0.018, 'lin'], [0.9412, -0.018, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armL.handYaw':   [[0, 0], [0.26, -0.40], [0.34, -0.43, 'snap'], [0.50, 0.48, 'hold'], [0.53, 0.48, 'out'], [0.64, 0.58], [0.84, 0.16], [1, 0]],
    'legL.sw':        [[0, 0], [0.46, -0.12, 'snap'], [0.78, -0.03], [1, 0]],
  } },
  StrikeLeft: { dur: 0.50, tracks: {
    'twist':          [[0, 0], [0.20, 0.42], [0.28, 0.46, 'snap'], [0.46, -0.55, 'hold'], [0.49, -0.55, 'out'], [0.60, -0.66], [0.82, -0.20], [1, 0]],
    'rootX':          [[0, 0], [0.24, 0.10], [0.30, 0.10, 'snap'], [0.48, -0.12, 'hold'], [0.51, -0.12, 'out'], [0.62, -0.14], [0.84, -0.05], [1, 0]],
    'rootZ':          [[0, 0], [0.30, 0.00, 'snap'], [0.48, 0.06, 'out'], [0.82, 0.02], [1, 0]],
    'lean':           [[0, 0], [0.46, 0.12, 'snap'], [0.62, 0.15, 'out'], [1, 0]],
    'armL.sw':        [[0, 0], [0.24, -0.30], [0.32, -0.32, 'snap'], [0.48, -0.10, 'out'], [0.76, -0.03], [1, 0]],
    'armR.sw': [[0, 0], [0.0588, -0.122, 'lin'], [0.1176, -0.29, 'lin'], [0.1765, -0.302, 'lin'], [0.2353, -0.382, 'lin'], [0.2941, -0.412, 'lin'], [0.3529, -0.424, 'lin'], [0.4118, -0.386, 'lin'], [0.4706, -0.248, 'lin'], [0.5294, -0.218, 'lin'], [0.5882, -0.206, 'lin'], [0.6471, -0.194, 'lin'], [0.7059, -0.194, 'lin'], [0.7647, -0.194, 'lin'], [0.8235, -0.194, 'lin'], [0.8824, -0.176, 'lin'], [0.9412, -0.164, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.bd': [[0, 0], [0.0588, -0.164, 'lin'], [0.1176, -0.318, 'lin'], [0.1765, -0.18, 'lin'], [0.2353, -0.26, 'lin'], [0.2941, -0.302, 'lin'], [0.3529, -0.314, 'lin'], [0.4118, -0.292, 'lin'], [0.4706, -0.234, 'lin'], [0.5294, -0.3, 'lin'], [0.5882, -0.318, 'lin'], [0.6471, -0.318, 'lin'], [0.7059, -0.318, 'lin'], [0.7647, -0.318, 'lin'], [0.8235, -0.33, 'lin'], [0.8824, -0.312, 'lin'], [0.9412, -0.318, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.spread': [[0, 0], [0.0588, -0.024, 'lin'], [0.1176, -0.054, 'lin'], [0.1765, -0.104, 'lin'], [0.2353, -0.134, 'lin'], [0.2941, -0.134, 'lin'], [0.3529, -0.146, 'lin'], [0.4118, -0.116, 'lin'], [0.4706, -0.036, 'lin'], [0.5294, 0.014, 'lin'], [0.5882, 0.026, 'lin'], [0.6471, 0.026, 'lin'], [0.7059, 0.026, 'lin'], [0.7647, 0.014, 'lin'], [0.8235, 0.002, 'lin'], [0.8824, 0.002, 'lin'], [0.9412, 0.002, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armL.handYaw':   [[0, 0], [0.26, 0.40], [0.34, 0.43, 'snap'], [0.50, -0.48, 'hold'], [0.53, -0.48, 'out'], [0.64, -0.58], [0.84, -0.16], [1, 0]],
    'legL.sw':        [[0, 0], [0.46, 0.12, 'snap'], [0.78, 0.03], [1, 0]],
  } },
  // DIAGONAL CLEAVES (0.56): half overhead, half cut; the frame drops.
  StrikeDownRight: { dur: 0.56, tracks: {
    'rootY':          [[0, 0], [0.28, 0.04], [0.34, 0.04, 'snap'], [0.50, -0.13, 'hold'], [0.53, -0.13, 'out'], [0.82, -0.04], [1, 0]],
    'rootZ':          [[0, 0], [0.34, -0.02, 'snap'], [0.50, 0.12, 'out'], [0.62, 0.14], [0.86, 0.05], [1, 0]],
    'rootX':          [[0, 0], [0.34, -0.05, 'snap'], [0.50, 0.07, 'out'], [1, 0]],
    'twist':          [[0, 0], [0.20, -0.20], [0.28, -0.22, 'snap'], [0.46, 0.40, 'out'], [0.58, 0.48], [0.82, 0.14], [1, 0]],
    'lean':           [[0, 0], [0.28, -0.10], [0.52, 0.26, 'hold'], [0.55, 0.26, 'out'], [0.66, 0.30], [1, 0]],
    'headPitch':      [[0, 0], [0.28, -0.14], [0.52, 0.08, 'snap'], [1, 0]],
    'armL.sw':        [[0, 0], [0.24, -0.45], [0.32, -0.48, 'snap'], [0.48, 0.10, 'out'], [0.60, 0.18], [1, 0]],
    'armR.sw': [[0, 0], [0.0588, -0.24, 'lin'], [0.1176, -0.382, 'lin'], [0.1765, -0.55, 'lin'], [0.2353, -0.562, 'lin'], [0.2941, -0.654, 'lin'], [0.3529, -0.654, 'lin'], [0.4118, -0.528, 'lin'], [0.4706, -0.226, 'lin'], [0.5294, 0.076, 'lin'], [0.5882, 0.268, 'lin'], [0.6471, 0.28, 'lin'], [0.7059, 0.322, 'lin'], [0.7647, 0.222, 'lin'], [0.8235, 0.012, 'lin'], [0.8824, 0, 'lin'], [0.9412, -0.1, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.bd': [[0, 0], [0.0588, -0.33, 'lin'], [0.1176, -0.292, 'lin'], [0.1765, -0.318, 'lin'], [0.2353, -0.18, 'lin'], [0.2941, -0.302, 'lin'], [0.3529, -0.314, 'lin'], [0.4118, -0.268, 'lin'], [0.4706, -0.33, 'lin'], [0.5294, -0.33, 'lin'], [0.5882, -0.028, 'lin'], [0.6471, 0.014, 'lin'], [0.7059, 0.136, 'lin'], [0.7647, 0.066, 'lin'], [0.8235, -0.236, 'lin'], [0.8824, -0.148, 'lin'], [0.9412, -0.26, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.spread': [[0, 0], [0.0588, -0.012, 'lin'], [0.1176, -0.042, 'lin'], [0.1765, -0.104, 'lin'], [0.2353, -0.146, 'lin'], [0.2941, -0.158, 'lin'], [0.3529, -0.188, 'lin'], [0.4118, -0.158, 'lin'], [0.4706, -0.04, 'lin'], [0.5294, -0.04, 'lin'], [0.5882, -0.052, 'lin'], [0.6471, -0.052, 'lin'], [0.7059, -0.052, 'lin'], [0.7647, -0.034, 'lin'], [0.8235, -0.022, 'lin'], [0.8824, -0.022, 'lin'], [0.9412, -0.01, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armL.handPitch': [[0, 0], [0.28, -0.32], [0.36, -0.35, 'snap'], [0.52, 0.62, 'hold'], [0.55, 0.62, 'out'], [0.66, 0.78], [0.86, 0.26], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.28, -0.35], [0.52, 0.45, 'snap'], [0.84, 0.12], [1, 0]],
    'legR.bd':        [[0, 0], [0.52, 0.28, 'out'], [0.84, 0.10], [1, 0]],
  } },
  StrikeDownLeft: { dur: 0.56, tracks: {
    'rootY':          [[0, 0], [0.28, 0.04], [0.34, 0.04, 'snap'], [0.50, -0.13, 'hold'], [0.53, -0.13, 'out'], [0.82, -0.04], [1, 0]],
    'rootZ':          [[0, 0], [0.34, -0.02, 'snap'], [0.50, 0.12, 'out'], [0.62, 0.14], [0.86, 0.05], [1, 0]],
    'rootX':          [[0, 0], [0.34, 0.05, 'snap'], [0.50, -0.07, 'out'], [1, 0]],
    'twist':          [[0, 0], [0.20, 0.20], [0.28, 0.22, 'snap'], [0.46, -0.40, 'out'], [0.58, -0.48], [0.82, -0.14], [1, 0]],
    'lean':           [[0, 0], [0.28, -0.10], [0.52, 0.26, 'hold'], [0.55, 0.26, 'out'], [0.66, 0.30], [1, 0]],
    'headPitch':      [[0, 0], [0.28, -0.14], [0.52, 0.08, 'snap'], [1, 0]],
    'armL.sw':        [[0, 0], [0.24, -0.45], [0.32, -0.48, 'snap'], [0.48, 0.10, 'out'], [0.60, 0.18], [1, 0]],
    'armR.sw': [[0, 0], [0.0588, -0.24, 'lin'], [0.1176, -0.37, 'lin'], [0.1765, -0.52, 'lin'], [0.2353, -0.562, 'lin'], [0.2941, -0.612, 'lin'], [0.3529, -0.642, 'lin'], [0.4118, -0.542, 'lin'], [0.4706, -0.24, 'lin'], [0.5294, 0.062, 'lin'], [0.5882, 0.272, 'lin'], [0.6471, 0.284, 'lin'], [0.7059, 0.314, 'lin'], [0.7647, 0.202, 'lin'], [0.8235, -0.008, 'lin'], [0.8824, -0.076, 'lin'], [0.9412, -0.106, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.bd': [[0, 0], [0.0588, -0.33, 'lin'], [0.1176, -0.292, 'lin'], [0.1765, -0.312, 'lin'], [0.2353, -0.266, 'lin'], [0.2941, -0.318, 'lin'], [0.3529, -0.33, 'lin'], [0.4118, -0.272, 'lin'], [0.4706, -0.33, 'lin'], [0.5294, -0.33, 'lin'], [0.5882, -0.028, 'lin'], [0.6471, 0.014, 'lin'], [0.7059, 0.136, 'lin'], [0.7647, 0.024, 'lin'], [0.8235, -0.266, 'lin'], [0.8824, -0.318, 'lin'], [0.9412, -0.26, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.spread': [[0, 0], [0.0588, -0.024, 'lin'], [0.1176, -0.074, 'lin'], [0.1765, -0.154, 'lin'], [0.2353, -0.216, 'lin'], [0.2941, -0.234, 'lin'], [0.3529, -0.222, 'lin'], [0.4118, -0.122, 'lin'], [0.4706, 0.028, 'lin'], [0.5294, -0.06, 'lin'], [0.5882, -0.09, 'lin'], [0.6471, -0.102, 'lin'], [0.7059, -0.084, 'lin'], [0.7647, -0.034, 'lin'], [0.8235, -0.016, 'lin'], [0.8824, -0.016, 'lin'], [0.9412, -0.004, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armL.handPitch': [[0, 0], [0.28, -0.32], [0.36, -0.35, 'snap'], [0.52, 0.62, 'hold'], [0.55, 0.62, 'out'], [0.66, 0.78], [0.86, 0.26], [1, 0]],
    'armL.handYaw':   [[0, 0], [0.28, 0.24], [0.52, -0.45, 'snap'], [0.84, -0.12], [1, 0]],
    'legR.bd':        [[0, 0], [0.52, 0.28, 'out'], [0.84, 0.10], [1, 0]],
  } },
  // RAM THRUST (0.42): the biggest lunge in the set - coil onto the
  // trail leg, then the whole frame drives the point out.
  StrikeUp: { dur: 0.42, tracks: {
    'rootZ':          [[0, 0], [0.26, -0.07], [0.32, -0.07, 'snap'], [0.48, 0.26, 'hold'], [0.52, 0.26, 'out'], [0.60, 0.28], [0.86, 0.09], [1, 0]],
    'rootY':          [[0, 0], [0.32, 0.00, 'snap'], [0.48, -0.07, 'out'], [0.86, -0.02], [1, 0]],
    'twist':          [[0, 0], [0.24, 0.14], [0.30, 0.16, 'snap'], [0.46, -0.10, 'out'], [1, 0]],
    'lean':           [[0, 0], [0.28, -0.06], [0.48, 0.28, 'hold'], [0.51, 0.28, 'out'], [0.60, 0.34], [0.86, 0.12], [1, 0]],
    'headPitch':      [[0, 0], [0.48, -0.06, 'snap'], [1, 0]],
    'armL.sw':        [[0, 0], [0.26, 0.22], [0.32, 0.24, 'snap'], [0.48, -0.55, 'hold'], [0.51, -0.55, 'out'], [0.60, -0.66], [0.84, -0.20], [1, 0]],
    'armR.sw': [[0, 0], [0.0588, -0.06, 'lin'], [0.1176, -0.14, 'lin'], [0.1765, -0.232, 'lin'], [0.2353, -0.244, 'lin'], [0.2941, -0.232, 'lin'], [0.3529, -0.182, 'lin'], [0.4118, -0.182, 'lin'], [0.4706, -0.374, 'lin'], [0.5294, -0.604, 'lin'], [0.5882, -0.616, 'lin'], [0.6471, -0.628, 'lin'], [0.7059, -0.46, 'lin'], [0.7647, -0.41, 'lin'], [0.8235, -0.26, 'lin'], [0.8824, -0.272, 'lin'], [0.9412, -0.104, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.bd': [[0, 0], [0.0588, -0.084, 'lin'], [0.1176, -0.206, 'lin'], [0.1765, -0.328, 'lin'], [0.2353, -0.31, 'lin'], [0.2941, -0.318, 'lin'], [0.3529, -0.28, 'lin'], [0.4118, -0.2, 'lin'], [0.4706, -0.062, 'lin'], [0.5294, -0.292, 'lin'], [0.5882, -0.224, 'lin'], [0.6471, -0.266, 'lin'], [0.7059, -0.128, 'lin'], [0.7647, -0.27, 'lin'], [0.8235, -0.132, 'lin'], [0.8824, -0.224, 'lin'], [0.9412, -0.086, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armR.spread': [[0, 0], [0.0588, -0.012, 'lin'], [0.1176, -0.012, 'lin'], [0.1765, -0.03, 'lin'], [0.2353, -0.048, 'lin'], [0.2941, -0.048, 'lin'], [0.3529, -0.048, 'lin'], [0.4118, -0.06, 'lin'], [0.4706, -0.16, 'lin'], [0.5294, -0.252, 'lin'], [0.5882, -0.302, 'lin'], [0.6471, -0.272, 'lin'], [0.7059, -0.184, 'lin'], [0.7647, -0.104, 'lin'], [0.8235, -0.066, 'lin'], [0.8824, -0.048, 'lin'], [0.9412, -0.018, 'lin'], [1, 0]],   // SOLVED (station-coupled)
    'armL.bd':        [[0, 0], [0.26, 0.55], [0.32, 0.57, 'snap'], [0.48, -0.06, 'out'], [0.76, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.26, -0.20], [0.48, 0.24, 'snap'], [0.58, 0.28, 'out'], [1, 0]],
    'legR.sw':        [[0, 0], [0.30, 0.06], [0.48, -0.40, 'snap'], [0.84, -0.12], [1, 0]],
    'legL.bd':        [[0, 0], [0.48, 0.34, 'snap'], [0.84, 0.10], [1, 0]],
  } },
};

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
