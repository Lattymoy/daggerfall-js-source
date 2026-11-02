// @ts-check
// EE5 / VC4: THE CLOUD SHADOW BLOCK - one text, for every shader that
// needs to know how much sun reaches a point on the ground.
//
// It lives alone in this leaf (no renderer, no lane, no import) because
// TWO passes read it now and a GLSL declaration is visible only inside
// its own compilation unit: the renderer interpolates it into every
// program that lights by the sun, and VC6c interpolates it into the air
// pass's shaft shader. Its old home was a private const in renderer.js;
// airPass.js cannot import from there (the renderer imports the air
// pass, and both build their shader texts at module scope, which is the
// temporal dead zone this tree has been bitten by before).
//
// The map itself is written by render/volumetricClouds.js - a square of
// ground around the camera, each texel the transmittance of the cloud
// slab along the sun's ray from that point. One field: what dims the
// terrain, what dims a character, and what decides whether the sun can
// throw a shaft are the same number.

/** OW-HORIZON (bible/06-Systems/Travel-View.md): where a told program's map hands over to the far law - the share of
 *  the square's half-side (from its centre) past which the map's shadow eases into the far transmittance, reached at
 *  the square's edge. The square's half-side is 6.55 km: the hand-over runs from 5.24 km out. */
export const CLOUD_SHADOW_RIM = 0.8;

/** OW-HORIZON: a deck's transmittance past its square - its `far` (scenes/shared.js: the far ring's cover law) when it
 *  carries a map, else 1 (no map: no shadow anywhere, the block's own `w` of 0). */
export const cloudFarOf = (deck) => (deck?.map && Number.isFinite(deck.far) ? Math.min(1, Math.max(0, deck.far)) : 1);

/** The uniforms and the reader. `uCloudShadowRect` is the square's
 *  corner x and z, one over its side, and the amount - 0 for the
 *  classic skin and for every interior, which is what makes the whole
 *  block answer "full sun" where there is no field.
 *
 *  OW-HORIZON: `uCloudShadowFar` is the ground PAST the square - x its transmittance (the far ring's own cover law,
 *  scenes/shared.js farSun: the deck's `far`), y 1 when the program was told. Past the square a told program takes it,
 *  and inside the square's rim (CLOUD_SHADOW_RIM) the map eases into it, so the clouds' shadows run on from the
 *  streamed ground onto the far ring without a line. A program never told reads (0, 0): full sun past the square and
 *  the map to its edge, exactly as before (the air's shafts, the grass - which grows 300 m about the eye). */
export const CLOUD_SHADOW_GLSL = `
uniform sampler2D uCloudShadowMap;
uniform vec4 uCloudShadowRect;   // VC4: the square's corner x, z; 1 / its side; the amount (0 = no shadow, the classic skin and every interior)
uniform vec2 uCloudShadowFar;    // OW-HORIZON: x the transmittance past the square, y 1 when told ((0, 0): full sun past it, as before)
// the transmittance of the cloud slab along the sun's ray from this
// ground point, read off the map the same field the sky is drawn from
// writes (render/volumetricClouds.js); outside the square the far law
// (OW-HORIZON), no shadow in a program never told it
float cloudShadowAt(vec3 wp) {
  if (uCloudShadowRect.w <= 0.0) return 1.0;
  vec2 uv = (wp.xz - uCloudShadowRect.xy) * uCloudShadowRect.z;
  bool told = uCloudShadowFar.y > 0.5;
  float far = told ? uCloudShadowFar.x : 1.0;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return far;
  float t = 1.0 - (1.0 - texture(uCloudShadowMap, uv).r) * uCloudShadowRect.w;
  if (!told) return t;
  vec2 e = abs(uv - 0.5) * 2.0;
  return mix(t, far, smoothstep(${CLOUD_SHADOW_RIM.toFixed(2)}, 1.0, max(e.x, e.y)));
}
// SKY-CAP: the transmittance at the texel NEAREST ground point g (x, z) the map knows - past the square, its edge. Clamped
// in the map's own UV, never in world metres: the square's far side in metres (corner + 1 / z, in fp32) carried back
// into UV lands a hair past 1.0 for some squares, where cloudShadowAt answers "outside: full sun"
float cloudShadowNearest(vec2 g) {
  if (uCloudShadowRect.w <= 0.0) return 1.0;
  vec2 uv = clamp((g - uCloudShadowRect.xy) * uCloudShadowRect.z, 0.0, 1.0);
  return 1.0 - (1.0 - texture(uCloudShadowMap, uv).r) * uCloudShadowRect.w;
}
`;

/** OW-HORIZON: THE FAR RING'S SUN (render/farRing.js FS and the lane's EL_FAR_RING_FS, after RING_SEA_GLSL, whose vWorld
 *  it reads, and their own uSunScale). The ring had one dim for all of it - the host's uSunScale carries the far law
 *  (scenes/shared.js farSunFactor), the square's own `far` - while the streamed ground beside it took the clouds' map:
 *  a dappled grid against a flat ring, a cloud's shadow cut off at the grid's straight edge, hidden only while the haze
 *  closed there. Now the ring takes the map where the map knows the ground and the far law past it, as the ground does:
 *  the map's transmittance over the far one the scale already carries (`uCloudFar`: the deck's `far` with a map, else
 *  1 - the ring exactly as it was). */
export const RING_CLOUD_GLSL = `${CLOUD_SHADOW_GLSL}
uniform float uCloudFar;   // the far transmittance the host's uSunScale already carries; 1 with no map
float ringSun() { return uSunScale * cloudShadowAt(vWorld) / max(uCloudFar, 0.05); }`;
