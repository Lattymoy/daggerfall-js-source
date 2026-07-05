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

const smooth = (a, b, t) => { const u = t * t * (3 - 2 * t); return a + (b - a) * u; };

/** Sample one track at normalized u (0..1). */
function sampleTrack(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let k = 0; k + 1 < keys.length; k++) {
    const [t0, v0] = keys[k], [t1, v1] = keys[k + 1];
    if (u <= t1) return smooth(v0, v1, (u - t0) / (t1 - t0 || 1e-9));
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
  // WRIST-DRIVEN (v2): the grip-pitched blade's TIP sits near the
  // shoulder/elbow rotX lines (tip radius 0.57 vs pommel 0.73 about
  // the shoulder - arm swings whirl the POMMEL around a hovering tip,
  // Mac: "it's all relative to the tip"). About the WRIST the ratio
  // inverts (tip 0.735 vs pommel 0.196 for pitch; 0.471 vs 0.163 for
  // yaw), so every strike carries its energy in handPitch/handYaw and
  // the arm channels only carry the swing. Lateral signs are authored
  // POST-MIRROR (g=2 flips them), tuned against TIP-travel probes.

  // Vertical chop: blade cocked back over the shoulder, wrist slams
  // the tip down the centreline, body folding after it.
  StrikeDown: { dur: 0.55, tracks: {
    'armL.sw':     [[0, 0], [0.30, -0.90], [0.52, 0.10], [1, 0]],
    'armL.bd':     [[0, 0], [0.30, 0.35], [0.52, 0.05], [1, 0]],
    'armL.handPitch': [[0, 0], [0.30, -1.35], [0.52, 0.95], [1, 0]],
    'twist':       [[0, 0], [0.30, 0.14], [0.52, -0.10], [1, 0]],
    'lean':        [[0, 0], [0.30, -0.10], [0.52, 0.26], [1, 0]],
    'headPitch':   [[0, 0], [0.30, -0.18], [0.52, 0.10], [1, 0]],
  } },
  // Horizontal slashes: the wrist yaw throws the tip flat across;
  // spread + twist carry the arm and hips with it.
  StrikeRight: { dur: 0.45, tracks: {
    'armL.sw':     [[0, 0], [0.30, -0.35], [0.54, -0.25], [1, 0]],
    'armL.spread': [[0, 0], [0.30, 0.15], [0.54, -0.10], [1, 0]],
    'armL.handYaw': [[0, 0], [0.30, -1.15], [0.54, 1.30], [1, 0]],
    'twist':       [[0, 0], [0.30, -0.30], [0.54, 0.38], [1, 0]],
    'lean':        [[0, 0], [0.54, 0.10], [1, 0]],
  } },
  StrikeLeft: { dur: 0.45, tracks: {
    'armL.sw':     [[0, 0], [0.30, -0.35], [0.54, -0.25], [1, 0]],
    'armL.spread': [[0, 0], [0.30, -0.10], [0.54, 0.15], [1, 0]],
    'armL.handYaw': [[0, 0], [0.30, 1.30], [0.54, -1.15], [1, 0]],
    'twist':       [[0, 0], [0.30, 0.38], [0.54, -0.30], [1, 0]],
    'lean':        [[0, 0], [0.54, 0.10], [1, 0]],
  } },
  // Diagonal hacks: wrist pitch (chop share) + wrist yaw (slash share).
  StrikeDownRight: { dur: 0.50, tracks: {
    'armL.sw':     [[0, 0], [0.30, -1.05], [0.53, 0.05], [1, 0]],
    'armL.bd':     [[0, 0], [0.30, 0.30], [0.53, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.30, -0.90], [0.53, 0.70], [1, 0]],
    'armL.handYaw': [[0, 0], [0.30, -0.75], [0.53, 0.85], [1, 0]],
    'twist':       [[0, 0], [0.30, -0.22], [0.53, 0.28], [1, 0]],
    'lean':        [[0, 0], [0.53, 0.20], [1, 0]],
    'headPitch':   [[0, 0], [0.30, -0.12], [1, 0]],
  } },
  StrikeDownLeft: { dur: 0.50, tracks: {
    'armL.sw':     [[0, 0], [0.30, -1.05], [0.53, 0.05], [1, 0]],
    'armL.bd':     [[0, 0], [0.30, 0.30], [0.53, 0.02], [1, 0]],
    'armL.handPitch': [[0, 0], [0.30, -0.90], [0.53, 0.70], [1, 0]],
    'armL.handYaw': [[0, 0], [0.30, 0.85], [0.53, -0.75], [1, 0]],
    'twist':       [[0, 0], [0.30, 0.22], [0.53, -0.28], [1, 0]],
    'lean':        [[0, 0], [0.53, 0.20], [1, 0]],
    'headPitch':   [[0, 0], [0.30, -0.12], [1, 0]],
  } },
  // Thrust: coil, then the point punches straight out, blade levelled
  // by the wrist, body lunging.
  StrikeUp: { dur: 0.42, tracks: {
    'armL.sw':     [[0, 0], [0.32, 0.28], [0.55, -1.05], [1, 0]],
    'armL.bd':     [[0, 0], [0.32, 1.05], [0.55, -0.06], [1, 0]],
    'armL.handPitch': [[0, 0], [0.32, -0.20], [0.55, 0.85], [1, 0]],
    'twist':       [[0, 0], [0.32, 0.18], [0.55, -0.12], [1, 0]],
    'lean':        [[0, 0], [0.32, -0.04], [0.55, 0.22], [1, 0]],
  } },
};
