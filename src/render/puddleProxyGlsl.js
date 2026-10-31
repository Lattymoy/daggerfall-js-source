// @ts-check
// WET1e: separate puddle proxy - NOT in terrain FS (that TDRd).
// Dial copies of wetGlsl / snowCoverGlsl - do not import wetGlsl (cycle: wetGlsl → airPass → here).
import { SNOW_TILE_M } from './snowCoverGlsl.js';

/** GLSL float literal - JS 4.0 stringifies as "4" (int), which breaks mix overloads. */
const f = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

/** Max reflection travel (m); grows when the puddle is far from the eye. */
export const WET_PROXY_DIST_M = 40;
export const WET_PROXY_DIST_FAR_M = 64;
/** One continuous aim height (lerp by R.y) - two discrete bands striped the facade. */
export const WET_PROXY_AIM0_M = 2.8;
export const WET_PROXY_AIM1_M = 5.2;
export const WET_PROXY_STEPS = 1;
export const WET_PROXY_REFINE = 0;
export const WET_PROXY_GATE = 0.2;
/** World-space match radius - soft alpha, not a hard kill. */
export const WET_PROXY_THICK_M = 1.4;
export const WET_PROXY_UV_CAP_X = 0.06;
export const WET_PROXY_UV_CAP_Y = 0.22;
export const WET_PROXY_UV_CAP = WET_PROXY_UV_CAP_Y;
export const WET_PROXY_MIN_HIT_Y = 0.45;
export const WET_PROXY_BELOW_EYE_M = 0.5;
export const WET_PROXY_NEAR_M = 8;
export const WET_PROXY_FAR_M = 70;
export const PUDDLE_PROXY_FLAT = Object.freeze([0.96, 0.995]);
export const PUDDLE_PROXY_EDGE = 0.22;
export const PUDDLE_PROXY_SPREAD = 0.45;
export const PUDDLE_PROXY_SALT = 0x50554444;
export const WET_PROXY_ALPHA = 0.65;
export const WET_PROXY_BLUR0 = 2.5;
export const WET_PROXY_BLUR1 = 6.0;

/**
 * Full-res single-band sample along the reflection ray of THIS frame + soft blur.
 * Dual bands / march picked different UVs per pixel → horizontal stripe tears.
 */
export const PUDDLE_PASS_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform highp sampler2D uDepth;
uniform sampler2D uFrame;
uniform vec4 uProjInfo;
uniform vec4 uRect;
uniform vec2 uCanvas;
uniform mat4 uVP;
uniform mat3 uViewRot;
uniform vec3 uCamPos;
uniform vec4 uWet;
out vec4 outColor;
float depthAt(vec2 wuv) {
  return textureLod(uDepth, (uRect.xy + wuv * uRect.zw) / uCanvas, 0.0).r;
}
vec2 texelUV(vec2 wuv) {
  vec2 px = floor(uRect.xy + wuv * uRect.zw) + 0.5;
  return (px - uRect.xy) / uRect.zw;
}
vec3 viewAt(vec2 uvIn) {
  vec2 uv = texelUV(uvIn);
  float z = depthAt(uv) * 2.0 - 1.0;
  float vz = -uProjInfo.w / (z + uProjInfo.z);
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * (-vz) / uProjInfo.x, ndc.y * (-vz) / uProjInfo.y, vz);
}
vec3 worldAt(vec2 wuv) {
  return uCamPos + uViewRot * viewAt(wuv);
}
vec2 project(vec3 p) {
  vec4 clip = uVP * vec4(p, 1.0);
  if (clip.w <= 0.0) return vec2(-1.0);
  return clip.xy / clip.w * 0.5 + 0.5;
}
float pudHash(ivec2 c, uint salt) {
  uint h = (uint(c.x) * 0x8da6b343u) ^ (uint(c.y) * 0xd8163841u) ^ (salt * 0xcb1ab31fu);
  h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
  return float(h >> 8u) * (1.0 / 16777216.0);
}
float pudNoise(vec2 lt, int cell, uint salt) {
  vec2 q = lt / float(cell);
  vec2 fl = floor(q);
  ivec2 i = ivec2(fl);
  vec2 fr = q - fl;
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  float a = pudHash(i, salt), b = pudHash(i + ivec2(1, 0), salt);
  float c = pudHash(i + ivec2(0, 1), salt), d = pudHash(i + ivec2(1, 1), salt);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 sampleBlur(vec2 hitUV, float along) {
  vec2 base = (uRect.xy + hitUV * uRect.zw) / uCanvas;
  float rad = mix(${f(WET_PROXY_BLUR0)}, ${f(WET_PROXY_BLUR1)}, smoothstep(2.0, 22.0, along));
  vec2 px = rad / vec2(textureSize(uFrame, 0));
  vec3 c = texture(uFrame, base).rgb * 0.30;
  c += texture(uFrame, base + vec2(px.x, 0.0)).rgb * 0.12;
  c += texture(uFrame, base - vec2(px.x, 0.0)).rgb * 0.12;
  c += texture(uFrame, base + vec2(0.0, px.y)).rgb * 0.12;
  c += texture(uFrame, base - vec2(0.0, px.y)).rgb * 0.12;
  c += texture(uFrame, base + px * 1.6).rgb * 0.055;
  c += texture(uFrame, base - px * 1.6).rgb * 0.055;
  c += texture(uFrame, base + vec2(px.x, -px.y) * 1.6).rgb * 0.055;
  c += texture(uFrame, base + vec2(-px.x, px.y) * 1.6).rgb * 0.055;
  c += texture(uFrame, base + vec2(px.x * 2.2, 0.0)).rgb * 0.025;
  c += texture(uFrame, base - vec2(px.x * 2.2, 0.0)).rgb * 0.025;
  c += texture(uFrame, base + vec2(0.0, px.y * 2.2)).rgb * 0.025;
  c += texture(uFrame, base - vec2(0.0, px.y * 2.2)).rgb * 0.025;
  return c;
}
void main() {
  if (uWet.y <= ${f(WET_PROXY_GATE)}) { outColor = vec4(0.0); return; }
  vec2 wuv = (vUV * uCanvas - uRect.xy) / uRect.zw;
  if (wuv.x < 0.0 || wuv.x > 1.0 || wuv.y < 0.0 || wuv.y > 1.0) { outColor = vec4(0.0); return; }
  float d01 = depthAt(wuv);
  if (d01 >= 0.999) { outColor = vec4(0.0); return; }
  vec3 wp = worldAt(wuv);
  if (wp.y > uCamPos.y - ${f(WET_PROXY_BELOW_EYE_M)}) { outColor = vec4(0.0); return; }
  float dist = length(uCamPos - wp);
  float distFade = smoothstep(${f(WET_PROXY_FAR_M)}, ${f(WET_PROXY_NEAR_M)}, dist);
  if (distFade <= 0.001) { outColor = vec4(0.0); return; }
  vec3 dx = dFdx(wp), dy = dFdy(wp);
  vec3 n = normalize(cross(dx, dy));
  if (n.y < 0.0) n = -n;
  float flatN = smoothstep(${f(PUDDLE_PROXY_FLAT[0])}, ${f(PUDDLE_PROXY_FLAT[1])}, n.y);
  if (flatN <= 0.001) { outColor = vec4(0.0); return; }
  vec2 lt = wp.xz / ${f(SNOW_TILE_M)};
  float p = 0.6 * pudNoise(lt, 1, ${PUDDLE_PROXY_SALT}u) + 0.4 * pudNoise(lt, 4, ${PUDDLE_PROXY_SALT + 1}u);
  float th = 1.0 - ${f(PUDDLE_PROXY_SPREAD)} * uWet.y;
  float pud = smoothstep(th - ${f(PUDDLE_PROXY_EDGE)} * 0.35, th + ${f(PUDDLE_PROXY_EDGE)}, p) * flatN;
  if (pud <= ${f(WET_PROXY_GATE)}) { outColor = vec4(0.0); return; }
  vec3 V = normalize(uCamPos - wp);
  vec3 nFlat = vec3(0.0, 1.0, 0.0);
  vec3 R = reflect(-V, nFlat);
  if (R.y < 0.04) { outColor = vec4(0.0); return; }
  float maxT = mix(${f(WET_PROXY_DIST_M)}, ${f(WET_PROXY_DIST_FAR_M)}, smoothstep(10.0, 40.0, dist));
  float thick = mix(${f(WET_PROXY_THICK_M)}, ${f(WET_PROXY_THICK_M * 1.35)}, smoothstep(10.0, 40.0, dist));
  // One sample: aim height leans up with steeper R - continuous in wp, no band fight
  float aimH = mix(${f(WET_PROXY_AIM0_M)}, ${f(WET_PROXY_AIM1_M)}, smoothstep(0.06, 0.4, R.y));
  float t = clamp(aimH / max(R.y, 0.05), 0.5, maxT);
  vec3 rayP = wp + R * t;
  vec2 hitUV = project(rayP);
  if (hitUV.x < 0.0 || hitUV.x > 1.0 || hitUV.y < 0.0 || hitUV.y > 1.0) { outColor = vec4(0.0); return; }
  if (hitUV.y < wuv.y) { outColor = vec4(0.0); return; }
  if (depthAt(hitUV) >= 0.999) { outColor = vec4(0.0); return; }
  vec3 sceneW = worldAt(hitUV);
  if (sceneW.y < wp.y + ${f(WET_PROXY_MIN_HIT_Y)}) { outColor = vec4(0.0); return; }
  float err = length(sceneW - rayP);
  float conf = exp((-err * err) / max(2.0 * thick * thick, 1e-4));
  float edge = min(min(hitUV.x, hitUV.y), min(1.0 - hitUV.x, 1.0 - hitUV.y));
  conf *= smoothstep(0.0, 0.05, edge);
  conf *= smoothstep(0.35, 0.9, t);
  if (conf < 0.03) { outColor = vec4(0.0); return; }
  vec3 col = sampleBlur(hitUV, t);
  float lum = dot(col, vec3(0.25, 0.55, 0.2));
  col *= mix(1.12, 0.55, smoothstep(0.55, 1.7, lum));
  float fres = mix(0.4, 1.0, pow(1.0 - max(dot(nFlat, V), 0.0), 3.5));
  float a = fres * pud * distFade * conf * ${f(WET_PROXY_ALPHA)};
  outColor = vec4(col, a);
}`;

/** Upsample blend onto the resolved frame (src-alpha). */
export const PUDDLE_BLEND_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uPuddle;
out vec4 outColor;
void main() {
  outColor = texture(uPuddle, vUV);
}
`;
