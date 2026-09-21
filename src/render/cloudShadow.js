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

/** The uniforms and the reader. `uCloudShadowRect` is the square's
 *  corner x and z, one over its side, and the amount - 0 for the
 *  classic skin and for every interior, which is what makes the whole
 *  block answer "full sun" where there is no field. */
export const CLOUD_SHADOW_GLSL = `
uniform sampler2D uCloudShadowMap;
uniform vec4 uCloudShadowRect;   // VC4: the square's corner x, z; 1 / its side; the amount (0 = no shadow, the classic skin and every interior)
// the transmittance of the cloud slab along the sun's ray from this
// ground point, read off the map the same field the sky is drawn from
// writes (render/volumetricClouds.js); outside the square, no shadow
float cloudShadowAt(vec3 wp) {
  if (uCloudShadowRect.w <= 0.0) return 1.0;
  vec2 uv = (wp.xz - uCloudShadowRect.xy) * uCloudShadowRect.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  return 1.0 - (1.0 - texture(uCloudShadowMap, uv).r) * uCloudShadowRect.w;
}
`;
