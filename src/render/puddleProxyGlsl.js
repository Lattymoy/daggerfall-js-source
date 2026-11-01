// @ts-check
// Separate puddle proxy - NOT in terrain FS (that TDRd).
// Dial copies of wetGlsl / snowCoverGlsl - do not import wetGlsl (cycle: wetGlsl → airPass → here).
import { SNOW_TILE_M } from './snowCoverGlsl.js';
import { ROAD_RECORDS } from '../world/road/roadEdge.js';   // Full colour only on stone puddles

/** GLSL float literal - JS 4.0 stringifies as "4" (int), which breaks mix overloads. */
const asF = (num) => (Number.isInteger(num) ? `${num}.0` : String(num));

/** Max reflection travel (m); grows when the puddle is far from the eye. */
export const WET_PROXY_DIST_M = 40;
export const WET_PROXY_DIST_FAR_M = 64;
/** Vertical span along the ray (m above the puddle) - a single aimH sliced the facade into a strip. */
export const WET_PROXY_AIM0_M = 1.2;
export const WET_PROXY_AIM1_M = 10.0;
export const WET_PROXY_STEPS = 5;   // soft-weighted taps across the span (not discrete bands)
export const WET_PROXY_REFINE = 0;
export const WET_PROXY_GATE = 0.2;
/** World-space match radius - soft alpha, not a hard kill. */
export const WET_PROXY_THICK_M = 1.6;
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
 * Span taps up the reflection ray; keep the best-confidence hit + blur.
 * One fixed aimH sliced the facade; UV-centroid of the span still collapsed to a strip.
 */
export const PUDDLE_PASS_FS = `#version 300 es
precision highp float;
precision highp usampler2D;
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
uniform usampler2D uTilemap;   // the chunk under the eye (renderer stashes it)
uniform vec4 uRoadMap;   // origin.xz, tileSize m, enabled
uniform highp ivec2 uEcoOrigin;   // same lattice as terrain snowNoise / wetGround
out vec4 outColor;
// shortcut: one tilemap (eye's chunk); pixels outside 0..128 stay matte
float roadGate(vec3 wp) {
  if (uRoadMap.w < 0.5) return 0.0;
  vec2 unwrapped = (wp.xz - uRoadMap.xy) / uRoadMap.z;
  if (unwrapped.x < 0.0 || unwrapped.y < 0.0 || unwrapped.x >= 128.0 || unwrapped.y >= 128.0) return 0.0;
  highp uint r = texelFetch(uTilemap, ivec2(unwrapped), 0).r >> 2u;
  return (r == ${ROAD_RECORDS[0]}u || r == ${ROAD_RECORDS[1]}u || r == ${ROAD_RECORDS[2]}u) ? 1.0 : 0.0;
}
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
  // match snowNoise: lattice keyed by the chunk's first world tile, not raw world xz
  highp ivec2 i = uEcoOrigin / cell + ivec2(fl);
  vec2 fr = q - fl;
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  float a = pudHash(i, salt), b = pudHash(i + ivec2(1, 0), salt);
  float c = pudHash(i + ivec2(0, 1), salt), d = pudHash(i + ivec2(1, 1), salt);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 sampleBlur(vec2 hitUV, float along) {
  vec2 base = (uRect.xy + hitUV * uRect.zw) / uCanvas;
  float rad = mix(${asF(WET_PROXY_BLUR0)}, ${asF(WET_PROXY_BLUR1)}, smoothstep(2.0, 22.0, along));
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
  if (uWet.y <= ${asF(WET_PROXY_GATE)}) { outColor = vec4(0.0); return; }
  vec2 wuv = (vUV * uCanvas - uRect.xy) / uRect.zw;
  if (wuv.x < 0.0 || wuv.x > 1.0 || wuv.y < 0.0 || wuv.y > 1.0) { outColor = vec4(0.0); return; }
  float d01 = depthAt(wuv);
  if (d01 >= 0.999) { outColor = vec4(0.0); return; }
  vec3 wp = worldAt(wuv);
  if (wp.y > uCamPos.y - ${asF(WET_PROXY_BELOW_EYE_M)}) { outColor = vec4(0.0); return; }
  float dist = length(uCamPos - wp);
  float distFade = smoothstep(${asF(WET_PROXY_FAR_M)}, ${asF(WET_PROXY_NEAR_M)}, dist);
  if (distFade <= 0.001) { outColor = vec4(0.0); return; }
  vec3 dx = dFdx(wp), dy = dFdy(wp);
  vec3 n = normalize(cross(dx, dy));
  if (n.y < 0.0) n = -n;
  float flatN = smoothstep(${asF(PUDDLE_PROXY_FLAT[0])}, ${asF(PUDDLE_PROXY_FLAT[1])}, n.y);
  if (flatN <= 0.001) { outColor = vec4(0.0); return; }
  // pixel-local metres like wetGround(vLocalXZ), not raw world xz
  vec2 lt = (wp.xz - uRoadMap.xy) / ${asF(SNOW_TILE_M)};
  float p = 0.6 * pudNoise(lt, 1, ${PUDDLE_PROXY_SALT}u) + 0.4 * pudNoise(lt, 4, ${PUDDLE_PROXY_SALT + 1}u);
  float th = 1.0 - ${asF(PUDDLE_PROXY_SPREAD)} * uWet.y;
  float road = roadGate(wp);   // soil never takes the building mirror
  if (road <= 0.001) { outColor = vec4(0.0); return; }
  float pud = smoothstep(th - ${asF(PUDDLE_PROXY_EDGE)} * 0.35, th + ${asF(PUDDLE_PROXY_EDGE)}, p) * flatN * road;
  if (pud <= ${asF(WET_PROXY_GATE)}) { outColor = vec4(0.0); return; }
  vec3 V = normalize(uCamPos - wp);
  vec3 nFlat = vec3(0.0, 1.0, 0.0);
  vec3 R = reflect(-V, nFlat);
  if (R.y < 0.04) { outColor = vec4(0.0); return; }
  float maxT = mix(${asF(WET_PROXY_DIST_M)}, ${asF(WET_PROXY_DIST_FAR_M)}, smoothstep(10.0, 40.0, dist));
  float thick = mix(${asF(WET_PROXY_THICK_M)}, ${asF(WET_PROXY_THICK_M * 1.35)}, smoothstep(10.0, 40.0, dist));
  float ry = max(R.y, 0.05);
  float t0 = clamp(${asF(WET_PROXY_AIM0_M)} / ry, 0.5, maxT);
  float t1 = clamp(${asF(WET_PROXY_AIM1_M)} / ry, 0.5, maxT);
  if (t1 < t0) { float s = t0; t0 = t1; t1 = s; }
  // Best geometric hit in the span (soft thick) - UV average of heights re-collapsed to a mid-facade strip
  vec2 hitUV = vec2(-1.0);
  float tHit = 0.0;
  float best = 0.0;
  for (int i = 0; i < ${WET_PROXY_STEPS}; i++) {
    float u = (float(i) + 0.5) / ${asF(WET_PROXY_STEPS)};
    float t = mix(t0, t1, u);
    vec3 rayP = wp + R * t;
    vec2 uv = project(rayP);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
    if (uv.y < wuv.y) continue;
    if (depthAt(uv) >= 0.999) continue;
    vec3 sceneW = worldAt(uv);
    if (sceneW.y < wp.y + ${asF(WET_PROXY_MIN_HIT_Y)}) continue;
    float err = length(sceneW - rayP);
    float conf = exp((-err * err) / max(2.0 * thick * thick, 1e-4));
    float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
    conf *= smoothstep(0.0, 0.05, edge);
    conf *= smoothstep(0.25, 0.85, t);
    if (conf > best) { best = conf; hitUV = uv; tHit = t; }
  }
  if (best < 0.03) { outColor = vec4(0.0); return; }
  vec3 col = sampleBlur(hitUV, tHit);
  float lum = dot(col, vec3(0.25, 0.55, 0.2));
  col *= mix(1.12, 0.55, smoothstep(0.55, 1.7, lum));
  float fres = mix(0.4, 1.0, pow(1.0 - max(dot(nFlat, V), 0.0), 3.5));
  float a = fres * pud * distFade * best * ${asF(WET_PROXY_ALPHA)};
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
