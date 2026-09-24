// @ts-check
// AUDIT 68 S17-fog-glsl-dup (2026-09-24): THE FOG LAW, ONE HOME. Every world
// pass fogs by the same factor - renderer.js's seven programs, the water
// surface and the lighting lane's five - and it was pasted into nine of
// them; DS1's exp2 mode had to be added to every copy. A leaf with no
// imports, as cloudShadow.js is, so the classic page's static graph grows by
// this file alone. Each shader declares its own uniforms (uFogMode,
// uFogDensity, uFogRange, uCamPos); renderer.js's setFog/_uploadFog is
// their one producer.

/** fogFactorAt(worldPos): 1 unfogged, 0 all fog. uFogMode 0 off, 1 linear
 *  over uFogRange (start, end), 2 exp, 3 exp2 (DS1: FogMode.ExponentialSquared). */
export const FOG_GLSL = `float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}`;
