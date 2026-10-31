// @ts-check
// ═══════════════════════════════════════════════════════════════════
// VALENWOOD-CANOPY (2026-10-24, bible/03-World/Tamriel-Biomes.md "Valenwood's closed canopy"; the owner, with ESO's
// concept art of a Bosmer village under the graht-oaks: "i want valenwood to have no sky like the trees will cover it
// up") - THE CLOSED CANOPY: where a zone's canopy closes (world/tamriel/tamrielBiomes.js `canopy` - Valenwood's forest),
// the sky overhead is the leaves'. PURE - the jungle's host (scenes/jungleHost.js) hands it the frame's eye and colour and
// hands its answer to the world host's light and the water.
// GRAHT1 (bible/03-World/Graht-Oaks.md; the owner, 2026-10-25: "The current simple skybox method is very low quality and
// band aided"): THE LEAVES OVERHEAD ARE THE GRAHT-OAKS' OWN - the trees themselves (world/jungle/grahtOaks.js,
// scenes/grahtHost.js) stand over the canopy's zones and close the sky with their crowns, its gaps theirs; no ceiling is
// drawn. What stays here is the canopy's LIGHT, which every tree under the crowns stands in.
//
//   - WHERE. The canopy zones' own field (world/jungle/jungleRegion.js jungleField, its `beyond` a zone's `canopy`), read at
//     the camera's eye: none at the line, whole JUNGLE_CANOPY.edge.in metres inside it (the layout's own canopy closes over
//     JUNGLE_EDGE.in, 480 m) - so walking in, the light closes over half a kilometre, and never at a line - the share the
//     graht-oaks thin to none by, too (grahtOaks.js grahtSites). An eye higher over its ground than the crowns' underside
//     (JUNGLE_CANOPY.height) comes into their light over JUNGLE_CANOPY.above metres, to the crowns' tops: the travel view's
//     raised eye looks down on the crowns in the sun.
//   - EASED as the haze is (JUNGLE_CANOPY.lag), snapped on the first frame and wherever the eye jumped.
//   - THE LIGHT under it: the sun's key taken (JUNGLE_CANOPY.key - what reaches the floor comes dappled through the leaves),
//     the ambient dimmed (JUNGLE_CANOPY.ambient) and both leaned green (JUNGLE_CANOPY.tint); the moon's key with the sun's;
//     the fog's colour dimmed and leaned with the ambient (the air under the leaves is lit by what comes through them),
//     and the water's sky the leaves' (canopyLeaves, canopyWaterSky).
// ═══════════════════════════════════════════════════════════════════

/** The canopy's numbers, in one place. Metres, seconds. */
export const JUNGLE_CANOPY = Object.freeze({
  /** the share across the canopy zones' line (m of depth, jungleDepthAt): none at it, whole this far inside */
  edge: Object.freeze({ out: 0, in: 600 }),
  /** GRAHT1: the crowns' underside over the ground (m) - where the graht-oaks' limbs leave their trunks (74-88 m at scale
   *  1, 62-106 m at their scales: world/jungle/grahtOakMesh.js GRAHT_SHAPE.trunk.crownFrom); it was the emergents' 34 */
  height: 80,
  /** an eye this far over the crowns' underside stands over their tops, in the whole sky's light (m) - GRAHT1: it was 18 */
  above: 110,
  /** how slowly the share follows its target (s), and the jump (m) that snaps it - the haze's own */
  lag: 2.0,
  jump: 250,
  /** the sun's key taken at a whole canopy; the ambient's; the fog colour's */
  key: 0.72,
  ambient: 0.3,
  fog: 0.35,
  /** the light under the leaves, leaned toward this (normalised by nothing: a tint, its green 1) */
  tint: Object.freeze([0.84, 1.0, 0.76]),
  /** the leaves' underside, as a share of the frame's fog colour (the light that comes through them) - the water's mirror */
  leaf: Object.freeze([0.2, 0.31, 0.14]),
  /** AUDIT TESA II G10: the canopy field's far maps' cap (pixels kept past the Bay's map, each map - jungleRegion.js
   *  jungleField `beyondMax`): the canopy reads the eye's 3x3 and (GRAHT1) the terrain jobs' 3x3 of the pixels the stream
   *  builds - the default land view's 11 x 11 and their rings, a few hundred pixels - so a walk of a hundred pixels fits,
   *  where the jungle's field keeps JUNGLE_BEYOND_MAX - about 0.7 MB at the cap against 45.8 MB; a drop is read again,
   *  the same */
  fieldMax: 16384,
});

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The canopy's share at a depth into its zones (m): 0 at the line, 1 past JUNGLE_CANOPY.edge.in inside. */
export const canopyShare = (depth) => smoothstep(-JUNGLE_CANOPY.edge.out, JUNGLE_CANOPY.edge.in, depth);

/** How much of the canopy an eye `h` metres over its ground stands under: 1 under the crowns' underside, 0
 *  JUNGLE_CANOPY.above over it, at their tops (a height not known - the ground not yet built - is under it). */
export const canopyUnder = (h) =>
  Number.isFinite(h) ? 1 - smoothstep(JUNGLE_CANOPY.height, JUNGLE_CANOPY.height + JUNGLE_CANOPY.above, h) : 1;

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
  const e = (s.eye ??= [0, 0, 0]); // the state's own, never a frame's allocation
  e[0] = eye[0];
  e[1] = eye[1];
  e[2] = eye[2];
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
  const k = clamp01(w || 0),
    t = JUNGLE_CANOPY.tint;
  for (let c = 0; c < 3; c++) out[c] = color[c] * (1 - JUNGLE_CANOPY.fog * k) * (1 + (t[c] - 1) * k);
  return out;
}

/**
 * THE LEAVES THE WATER MIRRORS: [their underside's rgb, the weight] - `out` written when handed. `color` the frame's fog
 * colour (canopyFog's: the light that comes through them). GRAHT1: what the sky controller keeps for the water
 * (scenes/shared.js setCanopy) - the ceiling these eight uniforms once lit is gone.
 * @param {number} w @param {ArrayLike<number>} color @param {Float32Array} [out]
 */
export function canopyLeaves(w, color, out = new Float32Array(4)) {
  const l = JUNGLE_CANOPY.leaf;
  for (let c = 0; c < 3; c++) out[c] = clamp01(color[c] * l[c]);
  out[3] = clamp01(w);
  return out;
}

/** The sky the water reflects (shared.js waterSky's `{ zenith, horizon }`) under a canopy (canopyLeaves's `u`): leaned
 *  to the leaves by the weight - the zenith to their underside, the horizon to it lifted toward the fog's. */
export function canopyWaterSky(sky, u) {
  const w = u ? u[3] : 0;
  if (!sky || !(w > 0)) return sky;
  const lerp = (a, b) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * w);
  return {
    zenith: lerp(sky.zenith, [u[0], u[1], u[2]]),
    horizon: lerp(sky.horizon, [u[0] * 1.6, u[1] * 1.6, u[2] * 1.6]),
  };
}
