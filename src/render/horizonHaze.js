// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAR-SEA1 (2026-10-10, Mac, from the top of a mountain over the sea: "Anyway we can fix the draw distance for oceans
// without affecting performance?"): THE HORIZON'S HAZE, ONE LAW. The streamed sea faded to the world fog's colour at
// the fog's end (4000 units at the default Land view distance), stood fully fogged out to the streamed grid's square
// edge, and past it the far ring's sea (EV8) came back at its haze hold, 85% - a shade DARKER than the band in front
// of it. A flat sea shows that step whole: dark water, a pale band, a hard square edge, a darker plane to the horizon.
//
// The law is the ring's, as EV8's record words it: the world fog's own ramp, CAPPED at the hold through the middle
// distance - min(ramp, hold), so a surface is fogged exactly as the world is until it reaches the hold - and closed
// to 1 over the ring's rim. The far ring takes it whole (render/farRing.js and the lane's twin,
// render/enhancedLighting.js EL_FAR_RING_FS); the streamed SEA takes its half that reaches it (render/waterSurface.js:
// the world's own linear factor floored at 1 - hold - AUDIT FAR-SEA1 P3: the rim opens at 16.8 km and the streamed
// grid's farthest corner is 8.1 km out, so the rim term is nothing there and the floor IS the law), so the sea in the
// streamed grid and the sea on the ring meet at the same haze and the ocean runs on to the horizon.
//
// The ring's base term had been hold * ramp, which equals the cap wherever the ring stands past the fog's end (every
// Land view distance from 3 up under DFU's rows) and left the ring LESS fogged than the streamed ground beside it
// wherever it stood inside the ramp (a near grid, or Dynamic Skies' Sunny, 2000 to 3600 - AUDIT 61 F9's seam, half
// closed). Capped, it is the world's fog there exactly.
//
// AUDIT FAR-SEA1 L1/L2/C12: THE SEA'S OWN LIGHT, ONE TEXT. The ring's sea had been the overworld's ocean tint lit as
// ground under the water's Fresnel - a different body, the full sun, no glint - so a step stood at the grid's edge
// still, and it was worse than before wherever the edge stood inside the fog's ramp. SEA_LOOK_GLSL is the water
// surface's own open-sea light, which the water's fragment shader now calls and the ring's sea calls with the same
// body (the climate's water texel, averaged, under the water's tint) and a flat normal.
//
// A leaf with no imports, as fogGlsl.js is: the water's module graph takes this file alone.
// ═══════════════════════════════════════════════════════════════════

/** The open sea's own light - the water surface's (render/waterSurface.js) and the far ring's sea (render/farRing.js),
 *  one text:
 *  seaFresnel(ndv, f0): Schlick's reflectance at a facing ndv (the eye's direction dotted with the normal), capped
 *    at 0.85 so the sea never turns to a mirror;
 *  seaSkyRefl(ry, zenith, horizon): the sky a reflected ray of height ry sees;
 *  seaLight(ambient, sunColor, sunDiff, moonColor, moonDiff): the light into the body - the sky's, and the sun's
 *    (softly: 0.6) and the moon's through it;
 *  seaSunLobe(nh), seaMoonLobe(nh): the glints' lobes at a half-vector's dot with the normal;
 *  seaGlints(sunColor, sun, moonColor, moon): the glints' light, each lobe already scaled by its body's strength;
 *  seaSky(lit, ndv, zenith, horizon, f0): the deep sea's colour - its lit body under the sky it reflects, nothing
 *    seen through it. */
export const SEA_LOOK_GLSL = `
float seaFresnel(float ndv, float f0) { return f0 + (0.85 - f0) * pow(1.0 - clamp(ndv, 0.0, 1.0), 5.0); }
vec3 seaSkyRefl(float ry, vec3 zenith, vec3 horizon) { return mix(horizon, zenith, clamp(0.2 + ry * 1.4, 0.0, 1.0)); }
vec3 seaLight(vec3 ambient, vec3 sunColor, float sunDiff, vec3 moonColor, float moonDiff) {
  return ambient + sunColor * (sunDiff * 0.6) + moonColor * moonDiff;
}
float seaSunLobe(float nh) { return pow(max(nh, 0.0), 180.0); }
float seaMoonLobe(float nh) { return pow(max(nh, 0.0), 220.0); }
vec3 seaGlints(vec3 sunColor, float sun, vec3 moonColor, float moon) { return sunColor * (1.6 * sun) + moonColor * (0.7 * moon); }
vec3 seaSky(vec3 lit, float ndv, vec3 zenith, vec3 horizon, float f0) {
  float F = seaFresnel(ndv, f0);
  return lit * (1.0 - F) + seaSkyRefl(ndv, zenith, horizon) * F;
}`;

/** horizonHaze(d, ...): the mix toward the fog colour at eye distance `d`, 0 clear to 1 all fog - the world fog's
 *  linear ramp over (fogStart, fogEnd) capped at `hold`, and the rest closed over (rimStart, rimEnd). */
export const HORIZON_HAZE_GLSL = `
float horizonHaze(float d, float fogStart, float fogEnd, float rimStart, float rimEnd, float hold) {
  float ramp = clamp((d - fogStart) / max(fogEnd - fogStart, 1.0), 0.0, 1.0);
  return min(min(ramp, hold) + (1.0 - hold) * smoothstep(rimStart, rimEnd, d), 1.0);
}`;

/** The sea's band about its own level (world units): a water fragment within it is the sea and takes the horizon's
 *  haze; any other water (a mountain lake, a river above the coast) fogs as the land round it does. The sheet stands
 *  WATER_LIFT over the clamp, and its swell has faded out long before the haze leaves the world's own ramp. AUDIT
 *  FAR-SEA1 L3: the water's arm fades over its outer half (smoothstep from half the band to the band), so a river
 *  running down to the sea crosses into the sea's haze without a line. */
export const SEA_HAZE_BAND = 1.0;

/** FAR-SEA1: what both lanes' far-ring fragment shaders read for the ring's sea and the horizon's haze - the vertex
 *  shader's sea weight, its world point and the sea's body (render/farRing.js VS: the camera climate's water texel
 *  under the water's tint), the eye in the same frame, the sky the water reflects, the water's Fresnel at normal
 *  incidence, and whether there is a sky to reflect at all. ringSea(ambient, sunColor, moonColor, sunScale) is the sea's
 *  colour in the water's own (classic) space: the FS hands it the frame's light as the water takes it, and the sun's
 *  scale at its point (OW-HORIZON: render/cloudShadow.js ringSun - the clouds' shadow on it, as on the land). It reads
 *  the FS's own uLightDir, uMoonDir and uMoonScale, declared before this block. */
export const RING_SEA_GLSL = `in float vSea;
in vec3 vWorld;
in vec3 vSeaBody;
uniform vec3 uEye;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform float uSeaF0;
uniform float uSeaLook;   // 1 with a sky to reflect (and the Enhanced water on), 0 without (the sea lit as ground, as before)
${SEA_LOOK_GLSL}
${HORIZON_HAZE_GLSL}
vec3 ringSea(vec3 ambient, vec3 sunColor, vec3 moonColor, float sunScale) {
  vec3 V = normalize(uEye - vWorld);   // the normal is up: the facing and the reflected ray's height are V.y
  vec3 lit = vSeaBody * seaLight(ambient, sunColor, sunScale * max(uLightDir.y, 0.0), moonColor, uMoonScale * max(uMoonDir.y, 0.0));
  vec3 H = normalize(uLightDir + V);
  vec3 Hm = normalize(uMoonDir + V);
  return seaSky(lit, V.y, uSkyZenith, uSkyHorizon, uSeaF0) + seaGlints(sunColor, seaSunLobe(H.y) * sunScale, moonColor, seaMoonLobe(Hm.y) * uMoonScale);
}`;
