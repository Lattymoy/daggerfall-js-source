// @ts-check
// ═══════════════════════════════════════════════════════════════════
// VALENWOOD-CANOPY (2026-10-24, bible/03-World/Tamriel-Biomes.md "Valenwood's closed canopy"; the owner, with ESO's
// concept art of a Bosmer village under the graht-oaks: "i want valenwood to have no sky like the trees will cover it
// up") - THE CLOSED CANOPY: where a zone's canopy closes (world/tamriel/tamrielBiomes.js `canopy` - Valenwood's forest),
// the sky overhead is the leaves'. PURE - the jungle's host (scenes/jungleHost.js) hands it the frame's eye and colour and
// hands its answer to the sky (render/canopySky.js) and the world host's light.
//
//   - WHERE. The canopy zones' own field (world/jungle/jungleRegion.js jungleField, its `beyond` a zone's `canopy`), read at
//     the camera's eye: none at the line, whole JUNGLE_CANOPY.edge.in metres inside it (the layout's own canopy closes over
//     JUNGLE_EDGE.in, 480 m) - so walking in, the sky closes over half a kilometre, and never at a line. An eye higher over
//     its ground than the canopy's top (JUNGLE_CANOPY.height) sees the sky open again over JUNGLE_CANOPY.above metres: the
//     travel view's raised eye looks down on the crowns, and a bare crag over the trees stands under the sky.
//   - EASED as the haze is (JUNGLE_CANOPY.lag), snapped on the first frame and wherever the eye jumped.
//   - THE SKY (render/canopySky.js): a ceiling of leaves drawn over every sky pass - the dome, the clouds, the sun baby's -
//     at the canopy's height over the eye, fixed to the world (it passes overhead as the player walks), its few openings
//     overhead (JUNGLE_CANOPY.open, none toward the horizon) showing the sky behind; leaves lit through near an opening,
//     branches dark across them, and the haze's own horizon over it.
//   - THE LIGHT under it: the sun's key taken (JUNGLE_CANOPY.key - what reaches the floor comes dappled through the leaves),
//     the ambient dimmed (JUNGLE_CANOPY.ambient) and both leaned green (JUNGLE_CANOPY.tint); the moon's key with the sun's;
//     the fog's colour dimmed and leaned with the ambient (the air under the leaves is lit by what comes through them),
//     and the water's sky the leaves'.
// ═══════════════════════════════════════════════════════════════════

/** The canopy's numbers, in one place. Metres, seconds. */
export const JUNGLE_CANOPY = Object.freeze({
  /** the share across the canopy zones' line (m of depth, jungleDepthAt): none at it, whole this far inside */
  edge: Object.freeze({ out: 0, in: 600 }),
  /** the canopy's top over the ground (m) - the emergents' crowns (Bantha's 1.28-1.55 scale over its 20 m canopy) */
  height: 34,
  /** an eye this far over the canopy's top sees the whole sky (m) */
  above: 18,
  /** how slowly the share follows its target (s), and the jump (m) that snaps it - the haze's own */
  lag: 2.0,
  jump: 250,
  /** the sun's key taken at a whole canopy; the ambient's; the fog colour's */
  key: 0.72,
  ambient: 0.3,
  fog: 0.35,
  /** the light under the leaves, leaned toward this (normalised by nothing: a tint, its green 1) */
  tint: Object.freeze([0.84, 1.0, 0.76]),
  /** the leaves' underside, as a share of the frame's fog colour (the light that comes through them) */
  leaf: Object.freeze([0.2, 0.31, 0.14]),
  /** the share of the ceiling open to the sky straight overhead; it closes to none toward the horizon */
  open: 0.08,
  /** the ceiling's place wraps every this many metres (the shader's lattice repeats at it - render/canopySky.js) */
  period: 2048,
  /** the ceiling never stands nearer the eye than this (m) - a climber in a crown is under its top */
  near: 6,
  /** AUDIT TESA II G10: the canopy field's far maps' cap (pixels kept past the Bay's map, each map - jungleRegion.js
   *  jungleField `beyondMax`): the canopy reads the eye's 3x3 alone (its 13 x 13 of sides), so a walk of a hundred pixels
   *  fits, where the jungle's field (the terrain jobs' 3x3 over every built pixel) keeps JUNGLE_BEYOND_MAX - about 0.7 MB
   *  at the cap against 45.8 MB; a drop is read again, the same */
  fieldMax: 16384,
});

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The canopy's share at a depth into its zones (m): 0 at the line, 1 past JUNGLE_CANOPY.edge.in inside. */
export const canopyShare = (depth) => smoothstep(-JUNGLE_CANOPY.edge.out, JUNGLE_CANOPY.edge.in, depth);

/** How much of the canopy an eye `h` metres over its ground stands under: 1 under the top, 0 JUNGLE_CANOPY.above over it
 *  (a height not known - the ground not yet built - is under it). */
export const canopyUnder = (h) => (Number.isFinite(h) ? 1 - smoothstep(JUNGLE_CANOPY.height, JUNGLE_CANOPY.height + JUNGLE_CANOPY.above, h) : 1);

/** A canopy's live state, eased frame to frame (stepCanopy). */
export function createCanopyState() {
  return { w: 0, eye: null, primed: false };
}

/**
 * THE FRAME'S STEP: the canopy's weight eased toward `target` by JUNGLE_CANOPY.lag over `dt` seconds - snapped on the first
 * frame, and wherever the eye (`eye`, the world's frame: [x, y, z] m) jumped JUNGLE_CANOPY.jump.
 * @param {ReturnType<typeof createCanopyState>} s @param {{ dt: number, eye: ArrayLike<number>, target: number }} f
 */
export function stepCanopy(s, { dt, eye, target }) {
  const jumped = !s.primed || !s.eye || Math.hypot(eye[0] - s.eye[0], eye[2] - s.eye[2]) > JUNGLE_CANOPY.jump;
  const t = clamp01(target);
  s.w = jumped ? t : s.w + (t - s.w) * (1 - Math.exp(-Math.max(0, dt) / JUNGLE_CANOPY.lag));
  if (s.w < 1e-4) s.w = 0;
  const e = (s.eye ??= [0, 0, 0]);   // the state's own, never a frame's allocation
  e[0] = eye[0]; e[1] = eye[1]; e[2] = eye[2];
  s.primed = true;
  return s;
}

/** A colour (rgb, 0..1) under a canopy of weight `w`: dimmed by `take` and leaned to `tint`. The same instance at no
 *  canopy (a Float32Array handed in), a new Float32Array otherwise - the world host's light leans (etherLight's shape).
 *  @param {ArrayLike<number>} rgb @param {number|undefined} w @param {number} [take] @param {ArrayLike<number>} [tint] */
export function canopyLight(rgb, w, take = JUNGLE_CANOPY.ambient, tint = JUNGLE_CANOPY.tint) {
  const k = clamp01(w || 0);
  if (!(k > 0) && rgb instanceof Float32Array) return rgb;
  return new Float32Array([0, 1, 2].map((i) => rgb[i] * (1 - take * k) * (1 + (tint[i] - 1) * k)));
}
/** The sun's key's factor under a canopy of weight `w`. */
export const canopyKey = (w) => 1 - JUNGLE_CANOPY.key * clamp01(w || 0);
/** The moon's key (renderer.setMoonlight's `{ scale, dir, color }`, or null) under a canopy of weight `w` - the sun's
 *  key's share taken, its colour leaned; itself at no canopy. */
export function canopyMoon(moon, w) {
  if (!moon || !(w > 0)) return moon;
  return { ...moon, scale: moon.scale * canopyKey(w), color: canopyLight(moon.color, w, 0) };
}

/** The frame's fog colour under a canopy of weight `w`, into `out` (the air under the leaves lit by what comes through). */
export function canopyFog(color, w, out = new Float32Array(3)) {
  const k = clamp01(w || 0), t = JUNGLE_CANOPY.tint;
  for (let c = 0; c < 3; c++) out[c] = color[c] * (1 - JUNGLE_CANOPY.fog * k) * (1 + (t[c] - 1) * k);
  return out;
}

/**
 * THE SKY'S EIGHT UNIFORMS (render/canopySky.js uCanopy): [the leaves' underside rgb, the weight, the eye's place x and z
 * (world metres, x east and z north, wrapped at JUNGLE_CANOPY.period), the ceiling's height over the eye (m), the open
 * share overhead] - `out` written when handed. `color` the frame's fog colour (canopyFog's), `eyeX`/`eyeZ` the eye's world
 * place, `over` its height over its ground (m; not finite: on it).
 * @param {number} w @param {ArrayLike<number>} color @param {number} eyeX @param {number} eyeZ @param {number} over
 * @param {Float32Array} [out]
 */
export function canopyUniforms(w, color, eyeX, eyeZ, over, out = new Float32Array(8)) {
  const P = JUNGLE_CANOPY.period, l = JUNGLE_CANOPY.leaf;
  for (let c = 0; c < 3; c++) out[c] = clamp01(color[c] * l[c]);
  out[3] = clamp01(w);
  out[4] = ((eyeX % P) + P) % P;
  out[5] = ((eyeZ % P) + P) % P;
  out[6] = Math.max(JUNGLE_CANOPY.near, JUNGLE_CANOPY.height - (Number.isFinite(over) ? over : 0));
  out[7] = JUNGLE_CANOPY.open;
  return out;
}

/** The sky the water reflects (shared.js waterSky's `{ zenith, horizon }`) under a canopy (canopyUniforms's `u`): leaned
 *  to the leaves by the weight - the zenith to their underside, the horizon to it lifted toward the fog's. */
export function canopyWaterSky(sky, u) {
  const w = u ? u[3] : 0;
  if (!sky || !(w > 0)) return sky;
  const lerp = (a, b) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * w);
  return { zenith: lerp(sky.zenith, [u[0], u[1], u[2]]), horizon: lerp(sky.horizon, [u[0] * 1.6, u[1] * 1.6, u[2] * 1.6]) };
}
