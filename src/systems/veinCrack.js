// @ts-check
// VEIN-CRACKS (GATHER-FEEL II, 2026-10-13, Mac: "Do the not done"; bible/06-Systems/Professions-Arc.md 5.2's Mining
// row - "It cracks in stages (crack decals) and sheds chunks" - and section 45): A WORKED VEIN CRACKS. A leaf: the GLSL
// both billboard shaders share (the classic one, render/renderer.js BB_FS, and the Enhanced Lighting lane's,
// render/enhancedLighting.js EL_BB_FS), and the batch's field - DISSOLVE's shape (systems/dissolve.js).
//
// `batch.crack` = [share worked 0..1, seed 0..1]: the ore's picture is split along the seams of a field of cells a few of
// the art's own texels across, each seam a texel wide - the seams nearest the face's heart open first, spreading outward
// in the order their seed gives (the most of it one network, a few short dashes apart - AUDIT GATHER-FEEL V5), until a
// vein a blow from breaking is broken into fragments. A seam is
// the texel's colour taken down (VEIN_CRACK_SHADE), lit as the flat is, so the light, the wash and the fog fall on it as
// on the ore. Undefined or null: whole. The gathering host lays it on the struck node's own batch as each blow lands
// (scenes/gatherHost.js).

/** A crack's cell, in the art's own texels: seams this far apart - a fist-sized fragment of a vein's ore. */
export const VEIN_CRACK_CELL = 7;
/** What a seam keeps of the texel's colour. */
export const VEIN_CRACK_SHADE = 0.3;
/** A seam's turn to open, of the share worked: its own (the pattern's seed) and its distance from the face's heart (0 the
 *  middle, about 1 the rim), weighted - the heart's the more, so the first blow's crack is a star at the middle and each
 *  blow after spreads it outward, the most of it one network. AUDIT GATHER-FEEL V5: not all of it - the heart is weighed
 *  texel by texel and a seam's own turn seam by seam, so a few short dashes (a texel or a few) open apart from it. */
export const VEIN_CRACK_ORDER = Object.freeze({ own: 0.35, heart: 0.75 });

/** Put a crack on a batch at `share` worked (0 or less, or none: whole), its pattern `seed` (0..1). Written in place: a
 *  blow's crack allocates nothing past its first. */
export function setBatchCrack(batch, share, seed = 0) {
  if (!batch) return;
  if (!(share > 0)) { if (batch.crack) batch.crack = null; return; }
  const c = batch.crack ?? (batch.crack = [0, 0]);
  c[0] = Math.min(1, share);
  c[1] = Number.isFinite(seed) ? seed - Math.floor(seed) : 0;
}

/** A node's crack pattern, off its key: the same vein cracks the same way every blow, and two veins differently. Pure. */
export function crackSeedOf(key) {
  let h = 2166136261;
  const s = String(key ?? '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/** The GLSL: `veinCrackShade(uv)` - what the texel at `uv` keeps of its colour (1 whole, VEIN_CRACK_SHADE on an open
 *  seam). `uCrack` is the batch's field (the shader's uniform). */
export const FLAT_CRACK_GLSL = `
// uCrack (x the share worked, 0 whole and 1 a blow from breaking; y the pattern's seed) is declared by each program that
// composes this block, beside its other per-batch uniforms (AUDIT 47: a unit declares what it uses, where the sweep reads it)
float crackHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7)) + uCrack.y * 61.7) * 43758.5453); }
vec2 crackSite(vec2 c) { return c + 0.2 + 0.6 * vec2(crackHash(c), crackHash(c + vec2(31.7, 11.3))); }
float veinCrackShade(vec2 uv) {
  if (uCrack.x <= 0.0) return 1.0;
  vec2 size = vec2(textureSize(uTex, 0));
  vec2 texel = floor(uv * size) + 0.5;   // the art's own pixels: a seam is a texel wide, never a smooth line
  vec2 p = texel / ${VEIN_CRACK_CELL.toFixed(1)};
  vec2 cell = floor(p);
  float d1 = 1e9, d2 = 1e9;
  vec2 c1 = cell, c2 = cell;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      float d = length(p - crackSite(c));
      if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = c; } else if (d < d2) { d2 = d; c2 = c; }
    }
  }
  if ((d2 - d1) * ${VEIN_CRACK_CELL.toFixed(1)} > 1.0) return 1.0;   // not on a seam
  // the seam's turn to open: its own (the same from either side - the pair's sum and product), and how far it lies from
  // the face's heart; the share worked opens every seam whose turn has come
  float own = crackHash(c1 + c2 + c1 * c2 * 0.013);
  float heart = length(texel / size - 0.5) * 1.6;
  return uCrack.x >= own * ${VEIN_CRACK_ORDER.own.toFixed(2)} + heart * ${VEIN_CRACK_ORDER.heart.toFixed(2)} ? ${VEIN_CRACK_SHADE.toFixed(2)} : 1.0;
}`;
