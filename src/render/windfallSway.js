// @ts-check
// WINDFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments
// seamlessly") - WINDFALL's VERTEX WIND, the law the flora sway by while the mod is on. Windfall swaps DFU's two
// billboard-batch shaders on every nature batch (500..511) for its own (Windfall/BillboardBatch, read back from the
// DXBC at vendor/windfall/shaders/BillboardBatch.glsl, pass 0's vertex shader), which add one offset to the quad's two
// top corners (the bottom ones stand):
//
//   offset = (d x 0.15 + r x (d . r) x 0.85) x (sway amplitude x sin(sway) + shiver amplitude x saturate(S) x sin(shiver))
//            x min(S, 2) x mask x (0.8 + 0.4 x h2) x the flat's height
//
// d the wind's heading, r the quad's right (so the lean is mostly ACROSS the view, where a card can show it), S the
// profile's strength (systems/windfall.js), the mask the record's response (WindRecordWeights - TryPatchBatch's wind
// mask, a byte a record), sway = the cell's phase (a 12 m cell's hash: a wood sways together) with a fifth of the
// flat's own, plus the global sway phase, shiver = the flat's second hash plus the global shiver phase, and h2 that
// hash again (each flat 0.8 to 1.2 of the lean).
//
// BB_VS takes it (render/renderer.js) in place of WIND3's lean - one law or the other, never both: a batch's `uSway`
// is its mask while the mod's law stands (`b.windfall`, the host's windfallResponse at the build), its WIND3 share
// otherwise (`b.sway`), and the law is on while the heading is (uWindfallAxis.xy). The products the shader needs of the
// profile - sway amplitude x min(S, 2), shiver amplitude x saturate(S) x min(S, 2) - are made once a frame on the CPU.
//
// DEPARTURE (Port-Ledger A, WINDFALL1): THE FLAT'S OWN TWO HASHES ARE SMOOTH IN ITS PLACE. The mod hashes the flat's
// world position fract(sin(p . k) x 43758.5) three times; that hash turns over at the last bit of its input, and the
// port reads one flat's place two ways - the 3D tree (LPT1) and its far picture, which crossfade in the eye's band, and
// every flat on either side of a floating-origin crossing - so a rounding apart gave a tree two phases, and every tree a
// new one at every map pixel crossed. The cell's hash is the mod's (its input, the cell's corner, is exact); the
// flat's own two are sums of two sines of the place in [0, 1], which a rounding cannot turn over. The place is the
// LAND's: the host's anchor (uWindfallAxis.zw) carries every shift of the floating origin, wrapped at
// WINDFALL_ANCHOR_PERIOD - and every hash is PERIODIC in it (the cells counted round 4096 of them, each sine a whole
// number of turns over it: WINDFALL_TURNS), so the wrap moves no flat either.

/** The anchor's wrap: 4096 of the mod's 12 m cells - every hash below repeats over it, so a wrap moves no flat. */
export const WINDFALL_ANCHOR_PERIOD = 49152;
/** The flat's own two hashes' wavenumbers, in whole turns over the period (x, z): about 1-3 radians a metre, so flats a
 *  metre apart differ, each a whole number of turns so the period repeats them. */
export const WINDFALL_TURNS = Object.freeze({ own: Object.freeze([[10248, 16976], [-21357, 7588]]), shiver: Object.freeze([[18853, -8840], [6493, 24016]]) });
/** A turn pair as the shader's wave vector: whole turns over the anchor's period, so the field repeats with the anchor.
 *  @param {readonly number[]} t */
const k = (t) => `vec2(${(t[0] * 2 * Math.PI / WINDFALL_ANCHOR_PERIOD).toPrecision(9)}, ${(t[1] * 2 * Math.PI / WINDFALL_ANCHOR_PERIOD).toPrecision(9)})`;
/** The most of the mod's per-flat multiplier (0.8 + 0.4 x h2). */
export const WINDFALL_SCALE_MAX = 1.2;

/** The uniforms and the lean, for BB_VS (a flat's root on the land and its right axis -> the offset at a top corner of
 *  height 1 and mask 1). */
export const WINDFALL_SWAY_GLSL = `
uniform vec4 uWindfallSway;   // WINDFALL1: sway amplitude x min(S, 2), shiver amplitude x saturate(S) x min(S, 2), the sway's phase, the shiver's
uniform vec4 uWindfallAxis;   // WINDFALL1: the wind's heading x, z (zero while the mod's law is off) and the land's anchor
vec3 windfallLean(vec2 root, vec3 right) {
  vec2 w = root + uWindfallAxis.zw;
  float cell = fract(sin(dot(mod(floor(w * 0.0833333358), 4096.0) * 12.0, vec2(12.9898, 78.233))) * 43758.5469);
  float own = 0.5 + 0.25 * (sin(dot(w, ${k(WINDFALL_TURNS.own[0])})) + sin(dot(w, ${k(WINDFALL_TURNS.own[1])})));
  float shiv = 0.5 + 0.25 * (sin(dot(w, ${k(WINDFALL_TURNS.shiver[0])})) + sin(dot(w, ${k(WINDFALL_TURNS.shiver[1])})));
  float sway = sin((cell + (own - cell) * 0.2) * 6.28318548 + uWindfallSway.z);
  float shiver = sin(shiv * 6.28318548 + uWindfallSway.w);
  vec3 d = vec3(uWindfallAxis.x, 0.0, uWindfallAxis.y);
  return (d * 0.15 + right * (dot(d, right) * 0.85)) * (uWindfallSway.x * sway + uWindfallSway.y * shiver) * (shiv * 0.400000036 + 0.8);
}
bool windfallLaw() { return dot(uWindfallAxis.xy, uWindfallAxis.xy) > 0.5; }
`;

/** The frame's eight numbers, as the shader takes them: [sway x min(S,2), shiver x sat(S) x min(S,2), sway phase,
 *  shiver phase, heading x, heading z, anchor x, anchor z] - from systems/windfall.js's frame (`wf`) and the anchor;
 *  written into `out`. A frame with no law (the mod off, no wind) is all zero. */
export function windfallUniforms(wf, anchor, out = new Float32Array(8)) {
  if (!wf || !wf.on || !wf.outside) { out.fill(0); return out; }
  const s = Math.max(0, wf.strength), cap = Math.min(s, 2), sat = Math.min(1, s);
  out[0] = wf.profile.swayAmplitude * cap;
  out[1] = wf.profile.shiverAmplitude * sat * cap;
  out[2] = wf.swayPhase; out[3] = wf.shiverPhase;
  const [dx, dz] = wf.direction, l = Math.hypot(dx, dz) || 1;
  out[4] = dx / l; out[5] = dz / l;
  out[6] = anchor?.[0] ?? 0; out[7] = anchor?.[1] ?? 0;
  return out;
}
/** Is the mod's law on in these eight numbers (the heading's set)? */
export const windfallLawOn = (wf) => !!wf && (wf[4] !== 0 || wf[5] !== 0);
/** The share of the lean batch `b` takes: the mod's mask under its law, WIND3's sway otherwise. */
export const swayShare = (b, lawOn) => (lawOn ? b.windfall : b.sway) || 0;
/** The most the mod's law leans a flat of height `h` at its crown, world units (the heading's blend is at most 1 long). */
export const windfallLeanMax = (wf, share, h) => (Math.abs(wf[0]) + Math.abs(wf[1])) * WINDFALL_SCALE_MAX * share * h;
/** The anchor after a shift of the floating origin by `offset` ([dx, dy, dz]): the land's place of a scene point is
 *  the point plus the anchor, and the shift moves the point by `offset` - so the anchor moves back, kept in
 *  0..WINDFALL_ANCHOR_PERIOD (double precision; the shader's sum is small). */
export function windfallAnchorAfterShift(anchor, offset) {
  const P = WINDFALL_ANCHOR_PERIOD;
  const wrap = (v) => { const r = v % P; return r < 0 ? r + P : r; };
  return [wrap(anchor[0] - offset[0]), wrap(anchor[1] - offset[2])];
}
