// @ts-check
// WINDFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments
// seamlessly") - WINDFALL's VERTEX WIND, the law the flora sway by while the mod is on. Windfall 1.0.0 swaps DFU's
// billboard-batch shaders on every nature batch (500..511) for its own, which move each billboard's crown - its two top
// corners; the bottom ones stand - by a slow sway and a fast shiver, each a share of the billboard's height (the
// settings' SwayAmountPercent and ShiverAmountPercent), scaled by the profile's Strength and the record's response,
// phased by the flat's place, in the wind's heading.
//
// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): THE SHADER IS OUR OWN, written from
// that description, with no line of the mod's:
//
//   lean = right x (across x sway reach x sin(sway) + shiver reach x sin(shiver)) x (0.7 + 0.6 x own)
//
// `right` is the quad's right axis and `across` the heading's share along it. A card shows only motion in its own plane,
// so a wind along the view sways no card, and a wind across it sways one fully; the shiver shows either way. The two
// reaches are the profile's amounts times its strength (uWindfallSway.xy, made once a frame on the CPU). The sway's
// phase is the frame's (the model runs it at SwaySpeed) plus the WOOD field, two sines some 80 m long, so a stand bends
// in rolling patches, plus an eighth of the flat's OWN field (two sines about 2 m long). The shiver's phase is the
// frame's plus the flat's SHIVER field. `own` also sets each flat's reach, 0.7 to 1.3 of the lean (windfallReach).
//
// BB_VS takes it in place of WIND3's lean - one law or the other, never both: a batch's `uSway` is its mask while the
// mod's law stands (`b.windfall`, the host's windfallResponse at the build), its WIND3 share otherwise (`b.sway`), and the
// law is on while the heading is (uWindfallAxis.xy). The caller scales the lean by the mask and the flat's height, so a
// record of no response (a rock, a stump) stands still. A Low Poly Trees 3D tree takes the same lean up its height,
// linearly, as its far picture's quad does (render/renderer.js), and the shadow pass bounds it by windfallLeanMax.
//
// THE PLACE IS THE LAND'S. The host's anchor (uWindfallAxis.zw) carries every shift of the floating origin, wrapped at
// WINDFALL_ANCHOR_PERIOD, and every field is periodic in it: each sine turns a whole number of times over the period
// (WINDFALL_TURNS). So neither a crossing nor the wrap moves a flat, and a flat read two ways (the 3D tree, LPT1, and
// its far picture, which crossfade in the eye's band) has one phase.

/** The anchor's wrap: every field below repeats over it, so a wrap moves no flat. */
export const WINDFALL_ANCHOR_PERIOD = 49152;
/** The fields' wavenumbers, in whole turns over the period (x, z). The wood's are some 80 m long, so neighbours bend
 *  together; the flat's own and its shiver's about 2 m, so flats a metre apart differ. */
export const WINDFALL_TURNS = Object.freeze({
  wood: Object.freeze([
    [521, 287],
    [-311, 563],
  ]),
  own: Object.freeze([
    [10248, 16976],
    [-21357, 7588],
  ]),
  shiver: Object.freeze([
    [18853, -8840],
    [6493, 24016],
  ]),
});
/** A turn pair as the shader's wave vector: whole turns over the anchor's period, so the field repeats with the anchor.
 *  @param {readonly number[]} t */
const k = (t) =>
  `vec2(${((t[0] * 2 * Math.PI) / WINDFALL_ANCHOR_PERIOD).toPrecision(9)}, ${((t[1] * 2 * Math.PI) / WINDFALL_ANCHOR_PERIOD).toPrecision(9)})`;
/** A flat's reach, at its most (windfallReach(1)), and the strength the reaches are scaled by, at its most. */
export const WINDFALL_SCALE_MAX = 1.3;
export const WINDFALL_STRENGTH_MAX = 2;

/** The uniforms and the lean, for BB_VS (a flat's root on the land and its right axis -> the offset at a top corner of
 *  height 1 and mask 1). */
export const WINDFALL_SWAY_GLSL = `
uniform vec4 uWindfallSway;   // WINDFALL1: the sway's reach and the shiver's (each amount x the strength), the sway's phase, the shiver's
uniform vec4 uWindfallAxis;   // WINDFALL1: the wind's heading x, z (zero while the mod's law is off) and the land's anchor
float windfallField(vec2 w, vec2 a, vec2 b) { return 0.5 + 0.25 * (sin(dot(w, a)) + sin(dot(w, b))); }
float windfallReach(float own) { return 0.7 + 0.6 * own; }
vec3 windfallLean(vec2 root, vec3 right) {
  vec2 w = root + uWindfallAxis.zw;
  float own = windfallField(w, ${k(WINDFALL_TURNS.own[0])}, ${k(WINDFALL_TURNS.own[1])});
  float wood = windfallField(w, ${k(WINDFALL_TURNS.wood[0])}, ${k(WINDFALL_TURNS.wood[1])});
  float sway = sin((wood + own * 0.125) * 6.28318548 + uWindfallSway.z);
  float shiver = sin(windfallField(w, ${k(WINDFALL_TURNS.shiver[0])}, ${k(WINDFALL_TURNS.shiver[1])}) * 6.28318548 + uWindfallSway.w);
  float across = dot(vec3(uWindfallAxis.x, 0.0, uWindfallAxis.y), right);
  return right * ((across * uWindfallSway.x * sway + uWindfallSway.y * shiver) * windfallReach(own));
}
bool windfallLaw() { return dot(uWindfallAxis.xy, uWindfallAxis.xy) > 0.5; }
`;

/** The frame's eight numbers, as the shader takes them: [the sway's reach, the shiver's (each amount x the strength, the
 *  strength 0..2), sway phase, shiver phase, heading x, heading z, anchor x, anchor z] - from systems/windfall.js's frame
 *  (`wf`) and the anchor; written into `out`. A frame with no law (the mod off, no wind) is all zero. */
export function windfallUniforms(wf, anchor, out = new Float32Array(8)) {
  if (!wf || !wf.on || !wf.outside) {
    out.fill(0);
    return out;
  }
  const strength = Math.min(WINDFALL_STRENGTH_MAX, Math.max(0, wf.strength));
  out[0] = wf.profile.swayAmplitude * strength;
  out[1] = wf.profile.shiverAmplitude * strength;
  out[2] = wf.swayPhase;
  out[3] = wf.shiverPhase;
  const [dx, dz] = wf.direction,
    l = Math.hypot(dx, dz) || 1;
  out[4] = dx / l;
  out[5] = dz / l;
  out[6] = anchor?.[0] ?? 0;
  out[7] = anchor?.[1] ?? 0;
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
  const wrap = (v) => {
    const r = v % P;
    return r < 0 ? r + P : r;
  };
  return [wrap(anchor[0] - offset[0]), wrap(anchor[1] - offset[2])];
}
