// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA1 (bible/03-World/Bantha-Jungle.md; the owner: "When traveling inside the area there should be a fog-like haze
// that reduces visability") - THE JUNGLE'S HAZE, ONE LAW. A leaf with no imports, as horizonHaze.js is: every world
// program takes it inside the fog block (FOG_GLSL), the far ring takes it beside its horizon's haze, and the skies take
// its sky half - so the ground, the trees, the water, the ring and the sky close into one haze at one rate.
//
// THE LAW. A layer of humid air lies on the land: its extinction is whole (uJungleHaze[0].x, per metre) up to a FLOOR
// (uJungleHaze[0].y - the canopy's height over the ground the eye stands on, the host's) and falls off above it by e every
// 1/uJungleHaze[0].z metres. A ray from the eye to a point crosses it for its length less a clear start about the eye
// (uJungleHaze[0].w); its optical depth is that run times the layer's MEAN density along it - exact for a straight ray
// through an exponential layer clamped at its floor (hazeMean, below) - and what reaches the eye is exp(-depth). So a
// valley under the floor is the layer's thickest, a ridge above it clears, and looking down from a summit the haze
// below is a sea. world/jungle/jungleHaze.js hazeTransmittance is this function's CPU twin, term for term
// (test/world/bantha1_jungle.test.js runs both and holds them together; the host's cull is its bound, hazeHides -
// AUDIT BANTHA1 DOC-17).
//
// THE SKY. A ray that never meets the ground leaves the layer: its depth is the depth straight up from the eye
// (uHazeSky.w - the host's: the floor's share and the falloff's above it) over the ray's height per metre - so the
// horizon is the haze's whole colour and the zenith keeps its own blue, a milky band that is the same air the ground
// stands in.
// ═══════════════════════════════════════════════════════════════════

/** hazeAt(worldPos, origin): 1 clear, 0 all haze - the share of a point's light that reaches `origin` (the eye, or the
 *  travel view's focus) through the layer. uJungleHaze[1].x is 0 when there is no haze at all (every program's default). */
export const HAZE_LAW_GLSL = `
uniform vec4 uJungleHaze[2];   // BANTHA1: [0] the floor's extinction (1/m), the floor's height, 1 / the falloff (1/m), the clear start (m) | [1].x on
float hazeMean(float a, float b) {   // the mean density over a ray from height a to b (in falloffs over the floor), the floor's 1
  float lo = min(a, b), hi = max(a, b);
  if (hi <= 0.0) return 1.0;
  float span = hi - lo;
  if (span < 1e-4) return exp(-max(lo, 0.0));
  float lo0 = max(lo, 0.0);
  return ((lo0 - lo) + (exp(-lo0) - exp(-hi))) / span;
}
float hazeAt(vec3 worldPos, vec3 origin) {
  if (uJungleHaze[1].x < 0.5) return 1.0;
  float run = length(worldPos - origin) - uJungleHaze[0].w;
  if (run <= 0.0) return 1.0;
  float k = uJungleHaze[0].z;
  return exp(-uJungleHaze[0].x * run * hazeMean((origin.y - uJungleHaze[0].y) * k, (worldPos.y - uJungleHaze[0].y) * k));
}`;

/** hazeSkyMix(y): how much of the haze's colour a sky ray of height-per-metre `y` (its direction's y) shows - 1 at and
 *  under the horizon; hazeSky(colour, dir): the sky's colour under it. uHazeSky.w 0 is no haze. */
export const HAZE_SKY_GLSL = `
uniform vec4 uHazeSky;   // BANTHA1: rgb the haze's colour, w its optical depth straight up from the eye (0 none)
float hazeSkyMix(float y) {
  if (uHazeSky.w <= 0.0) return 0.0;
  return 1.0 - exp(-uHazeSky.w / max(y, 0.004));
}
vec3 hazeSky(vec3 c, vec3 dir) { return mix(c, uHazeSky.rgb, hazeSkyMix(dir.y)); }`;

/** THE FAR RING'S (both lanes'): ringHaze(m) the horizon's haze `m` (0 clear, 1 all fog) with the jungle's over it, the
 *  two multiplied as transmittances - measured from uHazeEye (the world's own eye: the travel view's focus, else the
 *  camera) to the ring's vWorld, which the ring's sea block (render/horizonHaze.js RING_SEA_GLSL) declares before this. */
export const RING_HAZE_GLSL = `${HAZE_LAW_GLSL}
uniform vec3 uHazeEye;
float ringHaze(float m) { return 1.0 - (1.0 - m) * hazeAt(vWorld, uHazeEye); }`;
