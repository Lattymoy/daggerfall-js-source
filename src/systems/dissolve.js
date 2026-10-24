// @ts-check
// DISSOLVE (2026-10-02, Mac: "Killing should show a unique animation where you destroy your foe"; "Companions when
// playing catch up, spawning in, or spawning out should use a unique portal animation instead of just popping in and
// out") - A SPRITE THAT BURNS AWAY, OR GATHERS OUT OF NOTHING. A leaf: the GLSL both billboard shaders share (the
// classic one, render/renderer.js BB_FS, and the Enhanced Lighting lane's, render/enhancedLighting.js EL_BB_FS), the
// batch's field, and its colours.
//
// `batch.dissolve` = [share gone 0..1, r, g, b]: the sprite is eaten in two-texel grains - the art's own chunky
// pixels - from the feet up, every grain blazing in the colour along the edge it burns at. Undefined or null: whole.
// The execution burns a foe away in ember (REVENANT-FATE); a companion stepping through a portal gathers in arcane
// violet as its share falls to nothing, and is eaten in it as it leaves (COMPANION-PORTAL).

/** The edge's colours. */
export const DISSOLVE_EMBER = Object.freeze([1.0, 0.42, 0.1]);
export const DISSOLVE_ARCANE = Object.freeze([0.62, 0.4, 1.0]);

/** MWNPC16 (AUDIT MWNPC16-18 R1): MORE GONE THAN WHOLE, NO SHADOW - the share past which a dissolving thing casts none:
 *  a flat (setBatchDissolve's noShadow) and the Morrowind body standing in its place (net/peer/peerBodies.js `cast`), one
 *  threshold. The body is drawn dissolving off its flat's dissolve and cast its whole shape: a foe burnt nine parts away
 *  (REVENANT-FATE) or a companion not yet through its portal threw a whole man's shadow, where the flat it replaced cast
 *  none. */
export const DISSOLVE_SHADOWLESS = 0.5;
/** Whether a dissolve ([share gone, r, g, b, ...], or none) casts no shadow. @param {ArrayLike<number> | null | undefined} d */
export const dissolveShadowless = (d) => !!d && d[0] > DISSOLVE_SHADOWLESS;

/** Put a dissolve on a batch (null: whole). Written only when it changes, as the hit flash's. */
export function setBatchDissolve(batch, share, colour = DISSOLVE_EMBER) {
  if (!batch) return;
  if (!(share > 0)) {
    if (batch.dissolve) { if (batch.dissolve[4]) batch.noShadow = undefined; batch.dissolve = null; }
    return;
  }
  const s = Math.min(1, share);
  const d = batch.dissolve ?? (batch.dissolve = [0, 0, 0, 0, 0]);
  // AUDIT (2026-10-02): more gone than whole, it casts no shadow - the shadow replays cut by the texture's alpha alone,
  // so a body burnt away (or not yet through its portal) kept its whole shadow. [4] says the dissolve took it.
  if (s > DISSOLVE_SHADOWLESS) { if (!batch.noShadow) { batch.noShadow = true; d[4] = 1; } } else if (d[4]) { batch.noShadow = undefined; d[4] = 0; }
  d[0] = s; d[1] = colour[0]; d[2] = colour[1]; d[3] = colour[2];   // in place: a frame's burn allocates nothing
}

/** The GLSL: `dissolveCut(uv)` the grain's threshold test (discard where gone), `dissolveEdge(uv)` how much of the edge
 *  glow a surviving texel takes. `uDissolve` is the batch's field (the shader's uniform). */
export const FLAT_DISSOLVE_GLSL = `
// uDissolve (x the share gone, 0 whole and 1 gone; yzw the edge's colour) is declared by each program that composes
// this block, beside its other per-batch uniforms (AUDIT 47: a unit declares what it uses, where the sweep reads it)
float dissolveGrain(vec2 uv) {
  vec2 cell = floor(uv * vec2(textureSize(uTex, 0)) * 0.5);   // two-texel grains: the art's own pixels
  float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  return h * 0.72 + uv.y * 0.28;   // v = 0 is the feet: they go first
}
float dissolveCutAt(float x) { return x * 1.1 - 0.05; }
bool dissolveGone(vec2 uv) { return uDissolve.x > 0.0 && dissolveGrain(uv) < dissolveCutAt(uDissolve.x); }
float dissolveEdge(vec2 uv) {
  if (uDissolve.x <= 0.0) return 0.0;
  float k = 1.0 - smoothstep(0.0, 0.09, dissolveGrain(uv) - dissolveCutAt(uDissolve.x));
  return k * min(1.0, uDissolve.x * 8.0);
}
vec3 dissolveLit(vec3 lit, vec2 uv, vec3 edge) {   // edge: uDissolve.yzw in the program's own light (the lane's decoded)
  float k = dissolveEdge(uv);
  return k > 0.0 ? mix(lit, edge * 1.6, k) : lit;
}`;
