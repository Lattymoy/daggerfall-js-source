// @ts-check
// AUDIT 68 S17-fog-glsl-dup (2026-09-24): THE FOG LAW, ONE HOME. Every world
// pass fogs by the same factor - renderer.js's seven programs, the water
// surface and the lighting lane's five - and it was pasted into nine of
// them; DS1's exp2 mode had to be added to every copy. A leaf with no
// imports, as cloudShadow.js is, so the classic page's static graph grows by
// this file alone. Each shader declares its own uniforms (uFogMode,
// uFogDensity, uFogRange, uCamPos); renderer.js's setFog/_uploadFog is
// their one producer.
//
// DW-C (2026-09-25): AND THE SEA'S. Iliac Puddle No More 1.2.2 (jet082)
// closes the view under its carved sea with a post effect of its own -
// UnderwaterDistanceFog.shader, over the camera's image and depth: the
// light absorbed per channel and scattered back in over the distance the
// ray travels IN THE WATER (a ray that climbs out through the surface stops
// counting there), the whole darkened with the camera's depth, and closed
// to the fog colour over a near band and a far one. The port's classic
// frame has no depth to read, so the same arithmetic runs per fragment,
// after the world fog, in every program that takes this block: the
// affine map a pixel's colour goes through is the one its own distance
// sets, and an alpha blend of two fogged fragments is the fog of the blend
// wherever they share a distance - the surface and everything seen
// through it do, the ray being capped at the surface for both. The sky,
// which no program here draws, takes the same map in its own pass
// (deepWatersRender.js drawSkyFog). Its one uniform is declared here with
// its only reader: five vec4s from world/deepWaterLook.js
// distanceFogUniforms, [0].x 0 when the effect is off (renderer.js
// setWaterFog - a frame's, cleared by beginFrame).

/** fogFactorAt(worldPos): 1 unfogged, 0 all fog. uFogMode 0 off, 1 linear
 *  over uFogRange (start, end), 2 exp, 3 exp2 (DS1: FogMode.ExponentialSquared).
 *  dwWaterFog(colour, worldPos): the Deep Waters distance fog over a
 *  finished colour (the colour back unchanged while it is off);
 *  dwWaterFogAdd(colour, worldPos): an ADDED colour's share of it. */
export const FOG_GLSL = `float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}
uniform vec4 uDwFog[5];   // DW-C: on, sea Y, vision, strength | absorb rgb, scatter per m | in-scatter rgb, darkening | fog rgb, far factor | far start, far end, sky distance, -
float dwWaterDistance(vec3 worldPos) {   // the ray's length in the water: capped where it climbs through the surface
  vec3 r = worldPos - uCamPos;
  float dist = length(r);
  float toSurface = uDwFog[0].y - uCamPos.y;
  float dy = r.y / max(dist, 1e-6);
  return (dy > 1e-4 && toSurface > 0.0) ? min(toSurface / dy, dist) : dist;
}
float dwWaterClose(float d) {   // the two bands' closing to the fog colour
  float v = uDwFog[0].z;
  return max(smoothstep(0.5 * v, 1.45 * v, d), uDwFog[3].w * smoothstep(uDwFog[4].x, uDwFog[4].y, d));
}
vec3 dwWaterFogAt(vec3 col, float d) {
  vec3 c = (col * exp(-d * uDwFog[1].xyz) + (1.0 - exp(-d * uDwFog[1].w)) * uDwFog[2].xyz) * uDwFog[2].w;
  return mix(c, uDwFog[3].xyz, dwWaterClose(d));
}
vec3 dwWaterFog(vec3 col, vec3 worldPos) {
  if (uDwFog[0].x < 0.5) return col;
  return dwWaterFogAt(col, dwWaterDistance(worldPos));
}
vec3 dwWaterFogAdd(vec3 add, vec3 worldPos) {
  if (uDwFog[0].x < 0.5) return add;
  float d = dwWaterDistance(worldPos);
  return add * exp(-d * uDwFog[1].xyz) * uDwFog[2].w * (1.0 - dwWaterClose(d));
}`;
