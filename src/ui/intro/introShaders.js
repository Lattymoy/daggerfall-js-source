// INTRO4 (bible/10-UI/UI-Arc.md INTRO4) - THE FILM'S SHADERS. One morning over the Imperial City and the continent: an
// analytic sky (the dawn, the stars, Masser and Secunda), height fog and the lake's mist, a sun with its shadow, and a
// grade - all of it the port's own, no picture of anyone's. Positions reach the vertex stage in metres in the city's
// frame (x east, y up, z south) and leave it camera-relative, so the continent's millions of metres keep their precision.
// Colours are written display-ready (tonemapped, gamma'd); the alpha of the scene's buffer is the open sky, which the
// post pass reads for the sun's rays.

export const COMMON = `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec3 uEye;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform float uNight;
uniform float uMist;
uniform float uTime;
uniform float uFogA;
uniform float uFogH;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, v = 0.0; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = mat2(1.6, -1.2, 1.2, 1.6) * p + 3.1; a *= 0.5; } return v; }
float fbm3(vec2 p){ float a = 0.5, v = 0.0; for (int i = 0; i < 3; i++){ v += a * vnoise(p); p = mat2(1.6, -1.2, 1.2, 1.6) * p + 3.1; a *= 0.5; } return v; }
vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }
vec3 display(vec3 c){ c = max(c, 0.0); c = c * (2.51 * c + 0.03) / (c * (2.43 * c + 0.59) + 0.14); return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }

vec3 skyColour(vec3 ray){
  float s = uSun.y;
  float day = smoothstep(-0.14, 0.32, s);
  float up = max(ray.y, 0.0);
  vec3 zenith = mix(vec3(0.004, 0.007, 0.022), vec3(0.055, 0.13, 0.32), day);
  vec3 horizon = mix(vec3(0.018, 0.022, 0.05), vec3(0.42, 0.46, 0.52), day);
  vec2 rh = normalize(ray.xz + 1e-5), sh = normalize(uSun.xz + 1e-5);
  float toward = max(0.0, dot(rh, sh));
  float dawn = smoothstep(-0.2, 0.0, s) * (1.0 - smoothstep(0.12, 0.5, s));
  float hz = exp(-up * 5.5);
  vec3 c = mix(zenith, horizon, hz);
  c += (vec3(1.0, 0.34, 0.09) * pow(toward, 8.0) * 1.3 + vec3(0.5, 0.26, 0.2) * pow(toward, 2.5) * 0.18) * dawn * hz * hz;
  c += vec3(0.16, 0.07, 0.12) * dawn * exp(-up * 3.0) * 0.18;
  if (ray.y < 0.0) c = mix(c, horizon * 0.55, smoothstep(0.0, -0.25, ray.y));
  float cosS = dot(ray, uSun);
  c += uSunCol * (smoothstep(0.99972, 0.99992, cosS) * 7.0 + pow(max(cosS, 0.0), 380.0) * 1.1 + pow(max(cosS, 0.0), 22.0) * 0.16);
  return c;
}

// exponential height fog along a segment, in the form that never overflows: the two ends' densities, not a ratio of
// exponentials of the whole path (a ray from a continent's height reads exp(2800) the other way)
float heightFog(float a, float b, float y0, float y1, float len){
  float e0 = exp(-max(y0, -50.0) * b), e1 = exp(-max(y1, -50.0) * b), dy = (y1 - y0) * b;
  return abs(dy) < 1e-3 ? a * len * e0 : a * len * (e0 - e1) / dy;
}
vec3 aerial(vec3 col, vec3 p){
  vec3 d = p - uEye; float len = length(d); vec3 rd = d / max(len, 1e-3);
  float fog = heightFog(uFogA, 1.0 / uFogH, uEye.y, p.y, len);
  float mist = heightFog(0.0011 * uMist, 1.0 / 26.0, max(uEye.y, 0.0), max(p.y, 0.0), len) * (0.55 + 0.9 * vnoise(p.xz * 0.0035 + vec2(uTime * 0.03, uTime * 0.01)));
  vec3 sky = skyColour(rd);
  vec3 mistCol = uSkyAmb * 1.5 + uSunCol * 0.12 + sky * 0.25;
  col = mix(col, sky * 0.95, 1.0 - exp(-fog));
  return mix(col, mistCol, 1.0 - exp(-mist));
}

vec3 shade(vec3 albedo, vec3 n, float ao, float lit){
  float ndl = max(dot(n, uSun), 0.0);
  vec3 amb = mix(uGroundAmb, uSkyAmb, n.y * 0.5 + 0.5);
  return albedo * (amb * ao + uSunCol * ndl * lit);
}
`;

/** The shadow map's lookup, for the city's passes. */
export const SHADOW = `
uniform highp sampler2DShadow uShadow;
uniform mat4 uShadowVP;
uniform float uShadowOn;
float sunlit(vec3 w, vec3 n){
  if (uShadowOn < 0.5 || uSun.y <= 0.0) return uSun.y > 0.0 ? 1.0 : 0.0;
  vec4 s = uShadowVP * vec4(w + n * 2.5, 1.0);
  vec3 q = s.xyz / s.w * 0.5 + 0.5;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
  vec2 tx = vec2(1.0 / 2048.0);
  float v = 0.0;
  v += texture(uShadow, vec3(q.xy + vec2(-0.5, -0.5) * tx, q.z - 0.0008));
  v += texture(uShadow, vec3(q.xy + vec2(0.5, -0.5) * tx, q.z - 0.0008));
  v += texture(uShadow, vec3(q.xy + vec2(-0.5, 0.5) * tx, q.z - 0.0008));
  v += texture(uShadow, vec3(q.xy + vec2(0.5, 0.5) * tx, q.z - 0.0008));
  return v * 0.25;
}
`;

export const FULLSCREEN = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0, 1); }`;

export const SKY = `#version 300 es
${COMMON}
uniform vec2 uRes; uniform mat3 uBasis; uniform vec2 uHalf; uniform float uCirrus;
out vec4 o;
vec3 stars(vec3 ray){
  if (ray.y < -0.02) return vec3(0);
  vec2 g = vec2(atan(ray.z, ray.x), asin(clamp(ray.y, -1.0, 1.0))) * vec2(160.0, 160.0);
  vec2 i = floor(g), f = fract(g) - 0.5;
  float h = hash12(i);
  if (h < 0.991) return vec3(0);
  float tw = 0.65 + 0.35 * sin(uTime * (2.0 + h * 9.0) + h * 40.0);
  float r = exp(-dot(f, f) * 30.0);
  return mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), hash12(i + 7.0)) * r * tw * (h - 0.991) * 200.0 * smoothstep(0.02, 0.3, ray.y);
}
vec3 moon(vec3 ray, vec3 at, float size, vec3 tint){
  float c = dot(ray, normalize(at));
  if (c < cos(size * 4.0)) return vec3(0);
  float disc = smoothstep(cos(size), cos(size * 0.92), c);
  vec3 a = normalize(at), t1 = normalize(cross(a, vec3(0, 1, 0))), t2 = cross(t1, a);
  vec2 q = vec2(dot(ray - a, t1), dot(ray - a, t2)) / size;
  float lit = smoothstep(-0.25, 0.35, dot(q, normalize(vec2(-0.8, -0.35))) + 0.55);
  float mare = 0.75 + 0.25 * fbm3(q * 3.0 + at.xy * 10.0);
  return tint * disc * (0.12 + 0.88 * lit) * mare + tint * pow(max(c, 0.0), 900.0) * 0.08;
}
void main(){
  vec2 q = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec3 ray = normalize(uBasis * vec3(q.x * uHalf.x, q.y * uHalf.y, 1.0));
  vec3 c = skyColour(ray);
  float night = uNight;
  c += stars(ray) * night * night;
  c += (moon(ray, vec3(0.62, 0.30, -0.72), 0.075, vec3(0.62, 0.42, 0.36)) + moon(ray, vec3(0.80, 0.40, -0.44), 0.032, vec3(0.55, 0.57, 0.62))) * (0.25 + 0.75 * night);
  // high cloud: streaks lit rose at dawn, gold by day
  if (ray.y > 0.0) {
    vec2 p = ray.xz / (ray.y + 0.12) * 1.6 + vec2(uTime * 0.008, 0.0);
    float k = smoothstep(0.6, 0.9, fbm(p * vec2(1.0, 3.2))) * smoothstep(0.0, 0.18, ray.y) * uCirrus;
    float toward = pow(max(0.0, dot(normalize(ray.xz + 1e-5), normalize(uSun.xz + 1e-5))), 3.0);
    vec3 lit = mix(vec3(0.8, 0.34, 0.24), vec3(1.0, 0.86, 0.66), smoothstep(0.0, 0.3, uSun.y)) * (0.15 + 0.7 * toward) * smoothstep(-0.11, 0.04, uSun.y);
    c = mix(c, lit + uSkyAmb * 0.4, k * 0.45);
  }
  o = vec4(display(c), 1.0);
}`;

/** The continent: one grid over the field, heights from its alpha, lit and hazed; the borders inked at the end. */
export const CONTINENT_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aUv;
uniform sampler2D uField; uniform mat4 uVP; uniform vec3 uEye;
uniform vec2 uUnits; uniform vec2 uIC; uniform float uUnitM; uniform float uByteM; uniform float uExag; uniform float uShore;
out vec2 vUv; out vec3 vW;
void main(){
  vUv = aUv;
  float h = textureLod(uField, aUv, 0.0).a * 255.0;
  float y = h > 0.5 ? (h - uShore) * uByteM * uExag : -60.0 * uExag;
  vec2 pic = aUv * uUnits;
  vW = vec3((pic.x - uIC.x) * uUnitM, y, (pic.y - uIC.y) * uUnitM);
  gl_Position = uVP * vec4(vW - uEye, 1.0);
}`;

const CLOUD_PAINT = `
uniform float uClouds;
float cloudCover(vec2 p){
  vec2 q = p / 210000.0 + vec2(uTime * 0.004, -uTime * 0.002);
  return smoothstep(0.58, 0.8, fbm(q) * 0.82 + vnoise(q * 9.0) * 0.18) * uClouds;
}
// the land below the field's texel (3.84 km): its fields and woods, its folds
float landDetail(vec2 p){ return fbm(p / 9000.0) * 0.5 + fbm(p / 1800.0) * 0.32 + vnoise(p / 520.0) * 0.18; }
vec3 paintClouds(vec3 c, vec2 p){
  float cv = cloudCover(p);
  float sh = cloudCover(p - uSun.xz / max(uSun.y, 0.2) * 9000.0);
  c *= 1.0 - 0.45 * sh;
  vec3 white = (uSunCol * max(uSun.y, 0.1) * 1.6 + uSkyAmb * 1.2) * 0.9;
  return mix(c, white, cv * 0.88);
}
`;

export const CONTINENT_FRAGMENT = `#version 300 es
${COMMON}
${CLOUD_PAINT}
uniform sampler2D uField; uniform sampler2D uBorder;
uniform vec2 uUnits; uniform float uUnitM; uniform float uByteM; uniform float uExag; uniform float uBorders;
uniform vec2 uIC; uniform float uMarker; uniform vec4 uRivers[32]; uniform int uRiverCount; uniform vec2 uCities[80]; uniform int uCityCount;
in vec2 vUv; in vec3 vW; out vec4 o;
float segDist(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0); return length(p - a - ab * t); }
void main(){
  vec4 f = texture(uField, vUv);
  if (f.a * 255.0 < 2.5) discard;
  vec2 tx = 1.0 / vec2(textureSize(uField, 0));
  float hl = texture(uField, vUv - vec2(tx.x, 0)).a, hr = texture(uField, vUv + vec2(tx.x, 0)).a;
  float hd = texture(uField, vUv - vec2(0, tx.y)).a, hu = texture(uField, vUv + vec2(0, tx.y)).a;
  float k = 255.0 * uByteM * uExag;
  float sx = (hr - hl) * k / (2.0 * tx.x * uUnits.x * uUnitM), sz = (hu - hd) * k / (2.0 * tx.y * uUnits.y * uUnitM);
  vec3 n = normalize(vec3(-sx, 1.0, -sz));
  vec3 alb = toLinear(f.rgb);
  float dl = landDetail(vW.xz);
  alb *= 0.78 + 0.44 * dl;
  n = normalize(n + vec3(vnoise(vW.xz / 7000.0) - 0.5, 0.0, vnoise(vW.zx / 7000.0 + 5.0) - 0.5) * 0.35 * (1.0 - smoothstep(4e5, 2e6, uEye.y)));
  vec3 c = shade(alb, n, 1.0, 1.0);
  c = paintClouds(c, vW.xz);
  // the rivers: a meandering stroke a kilometre and more wide, the sea's own water
  vec2 pic = vUv * uUnits;
  vec2 wob = (vec2(fbm3(pic * 0.9), fbm3(pic * 0.9 + 7.0)) - 0.5) * 0.7;
  float rd = 1e9;
  vec2 q = pic + wob;
  for (int i = 0; i < 32; i++) {
    if (i >= uRiverCount) break;
    vec4 sg = uRivers[i];
    if (q.x < min(sg.x, sg.z) - 0.5 || q.x > max(sg.x, sg.z) + 0.5 || q.y < min(sg.y, sg.w) - 0.5 || q.y > max(sg.y, sg.w) + 0.5) continue;   // the segment's box first
    rd = min(rd, segDist(q, sg.xy, sg.zw));
  }
  float px = length(fwidth(pic));
  float river = 1.0 - smoothstep(0.07, 0.07 + max(px, 0.02), rd);
  c = mix(c, (uSkyAmb * 0.9 + uSunCol * max(uSun.y, 0.0) * 0.25) * toLinear(vec3(0.16, 0.3, 0.38)) * 2.0, river * 0.92);
  // the cities of the geography: a speck of stone and roofs each, a few kilometres across
  float town = 0.0;
  float speck = max(0.1, px * 1.6);   // never under a couple of pixels: on the last frame they are the map's dots
  for (int i = 0; i < 80; i++) { if (i >= uCityCount) break; town = max(town, 1.0 - smoothstep(speck, speck + max(px, 0.02), length(pic - uCities[i]))); }
  c = mix(c, toLinear(vec3(0.58, 0.5, 0.42)) * (uSkyAmb + uSunCol * max(uSun.y, 0.0) * 0.6), town * 0.85);
  float ink = texture(uBorder, vUv).r * uBorders;
  c = mix(c, vec3(1.0, 0.74, 0.34) * (uSunCol * 0.25 + 0.5), ink * 0.9);
  // the Imperial City, marked at the end: a gold point that breathes
  float dm = length(pic - uIC);
  c += vec3(1.0, 0.78, 0.4) * uMarker * (exp(-dm * dm * 8.0) * 1.6 + exp(-dm * 1.4) * 0.12) * (0.85 + 0.15 * sin(uTime * 3.0));
  o = vec4(display(aerial(c, vW)), 0.0);
}`;

/** A wide plane under the camera: the sea, at the continent's scale. */
export const PLANE_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uVP; uniform vec3 uEye; uniform float uAltitude; uniform float uHalfSize;
out vec3 vW;
void main(){
  const vec2 corners[6] = vec2[6](vec2(-1, -1), vec2(1, -1), vec2(-1, 1), vec2(-1, 1), vec2(1, -1), vec2(1, 1));
  vec2 c = corners[gl_VertexID] * uHalfSize;
  vW = vec3(uEye.x + c.x, uAltitude, uEye.z + c.y);
  gl_Position = uVP * vec4(vW - uEye, 1.0);
}`;

export const OCEAN_FRAGMENT = `#version 300 es
${COMMON}
${CLOUD_PAINT}
uniform sampler2D uField; uniform vec2 uUnits; uniform vec2 uIC; uniform float uUnitM;
in vec3 vW; out vec4 o;
void main(){
  vec2 uv = (vW.xz / uUnitM + uIC) / uUnits;
  vec3 sea = toLinear(vec3(18.0, 46.0, 70.0) / 255.0) * 0.7;
  if (all(greaterThan(uv, vec2(0))) && all(lessThan(uv, vec2(1)))) sea = toLinear(texture(uField, uv).rgb) * 0.7;
  float dist = length(vW - uEye);
  float s = max(1.0, dist / 4000.0);
  vec2 p = vW.xz / s;
  float w1 = vnoise(p * 0.02 + uTime * 0.05), w2 = vnoise(p * 0.07 - uTime * 0.08);
  vec3 n = normalize(vec3((w1 - 0.5) * 0.12 + (w2 - 0.5) * 0.06, 1.0, (w2 - 0.5) * 0.1));
  vec3 v = normalize(uEye - vW);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(v, n), 0.0), 5.0);
  vec3 refl = skyColour(reflect(-v, n));
  vec3 c = mix(sea * (uSkyAmb * 1.2 + uSunCol * max(uSun.y, 0.0) * 0.5), refl, fres);
  c += uSunCol * pow(max(dot(reflect(-uSun, n), v), 0.0), 220.0) * 2.5;
  c = paintClouds(c, vW.xz);
  o = vec4(display(aerial(c, vW)), 0.0);
}`;

/** The city's ground and its lake: a grid dense at the middle and wide at the rim (introLandscape.js groundGrid), its
 *  land the city's own tiles (introCity.js buildIntroGround), past them the shore's meadows and woods, the lake a
 *  mirror of the sky that catches the Tower. */
export const GROUND_VERTEX = `#version 300 es
${COMMON}
layout(location = 0) in vec2 aXZ;
uniform mat4 uVP;
out vec3 vW;
float hills(vec2 p){ float r = length(p); float k = smoothstep(3100.0, 9000.0, r); return k * (fbm3(p * 0.00022) * 300.0 + fbm3(p * 0.0012) * 45.0 - 60.0); }
void main(){
  vW = vec3(aXZ.x, hills(aXZ), aXZ.y);
  gl_Position = uVP * vec4(vW - uEye, 1.0);
}`;

export const GROUND_FRAGMENT = `#version 300 es
${COMMON}
${SHADOW}
${CLOUD_PAINT}
uniform sampler2D uGround; uniform sampler2D uPlan; uniform float uSpan; uniform float uCellM; uniform float uCells;
uniform vec3 uFar; uniform float uRim; uniform float uLake; uniform float uIsle;
uniform sampler2D uField; uniform float uHasField; uniform vec2 uUnits; uniform vec2 uIC; uniform float uUnitM;
in vec3 vW; out vec4 o;
float towerR(float y){
  if (y < 44.0) return 172.0;
  if (y < 940.0) return mix(112.0, 76.0, (y - 44.0) / 896.0);
  if (y < 988.0) return 124.0;
  if (y < 1096.0) return mix(72.0, 54.0, (y - 988.0) / 108.0);
  return mix(54.0, 0.0, clamp((y - 1096.0) / 264.0, 0.0, 1.0));
}
// what the lake mirrors: the sky, and the Tower and the city wall where a reflected ray meets them
vec3 reflection(vec3 p, vec3 r){
  vec3 sky = skyColour(r);
  if (r.y <= 0.0) return sky;
  vec2 o = p.xz, dxz = r.xz;
  float dd = dot(dxz, dxz);
  // the city wall first: where the ray crosses its ring, if it is below the wall's walk there
  float b = dot(o, dxz), c0 = dot(o, o) - 1950.0 * 1950.0, disc = b * b - dd * c0;
  if (disc > 0.0) {
    float t = (-b - sqrt(disc)) / dd;
    if (t > 0.0 && p.y + r.y * t < 30.0) return mix(shade(toLinear(vec3(0.6, 0.56, 0.48)), normalize(vec3(-o - dxz * t, 0.0).xzy), 0.8, 1.0), sky, 0.15);
  }
  // the Tower: at the ray's nearest pass of its axis, is it inside the Tower's girth at that height
  float t = -b / max(dd, 1e-6);
  if (t > 0.0) {
    vec2 q = o + dxz * t; float y = p.y + r.y * t;
    if (y < 1360.0 && length(q) < towerR(y)) {
      vec3 n = normalize(vec3(-dxz.x, 0.0, -dxz.y));
      vec3 marble = toLinear(y > 1096.0 ? vec3(0.86, 0.66, 0.28) : vec3(0.86, 0.84, 0.78));
      return mix(shade(marble, n, 1.0, 1.0), sky, 0.18);
    }
  }
  return sky;
}
void main(){
  vec2 p = vW.xz;
  float r = length(p);
  vec3 fx = dFdx(vW), fy = dFdy(vW);
  vec3 n = normalize(cross(fy, fx)); if (n.y < 0.0) n = -n;
  vec4 wgt = vec4(0, 0, 0, 0);
  float open = 1.0;
  vec2 guv = (p + uSpan * 0.5) / uSpan;
  if (all(greaterThan(guv, vec2(0))) && all(lessThan(guv, vec2(1)))) {
    vec2 jit = (vec2(vnoise(p * 0.08), vnoise(p * 0.08 + 9.0)) - 0.5) * 0.9 / vec2(textureSize(uGround, 0));
    wgt = texture(uGround, guv + jit);
    open = clamp(1.0 - wgt.r - wgt.g - wgt.b - wgt.a, 0.0, 1.0);
  }
  float water = smoothstep(0.42, 0.58, wgt.r);
  // the land: stone paved in slabs, grass, sand, and past the lake the shore's meadows, woods and fields
  float g = fbm3(p * 0.05);
  vec2 slab = fract(p / vec2(2.4, 1.6) + vec2(floor(p.y / 1.6) * 0.37, 0.0));
  float joint = (1.0 - smoothstep(0.0, 0.05, min(min(slab.x, 1.0 - slab.x), min(slab.y, 1.0 - slab.y)))) * smoothstep(400.0, 60.0, length(vW - uEye));
  vec3 stone = vec3(0.6, 0.57, 0.5) * (0.88 + 0.2 * g) * (1.0 - joint * 0.3);
  vec3 grass = mix(vec3(0.27, 0.36, 0.16), vec3(0.36, 0.42, 0.2), g);
  vec3 sand = vec3(0.68, 0.62, 0.47) * (0.9 + 0.15 * g);
  float wood = smoothstep(0.48, 0.62, fbm3(p * 0.0011 + 4.0));
  vec3 meadow = mix(mix(vec3(0.33, 0.42, 0.2), vec3(0.4, 0.45, 0.24), fbm3(p * 0.004)), vec3(0.2, 0.3, 0.14), wood * 0.8);
  vec3 farLin = toLinear(uHasField > 0.5 ? texture(uField, (p / uUnitM + uIC) / uUnits).rgb : uFar) * (0.78 + 0.44 * landDetail(p));
  float wsum = wgt.g + wgt.b + wgt.a + open + 1e-4;
  vec3 land = (sand * wgt.g + grass * wgt.b + stone * wgt.a + meadow * open) / wsum;
  // a plan cell of Daggerfall's blocks: its streets worn darker
  vec2 cell = (p / uCellM) + uCells * 0.5;
  float code = texture(uPlan, (floor(cell) + 0.5) / uCells).r * 255.0;
  if (abs(code - 3.0) < 0.5) land *= 0.86 + 0.08 * vnoise(p * 0.3);
  vec3 alb = mix(toLinear(land), farLin, smoothstep(3200.0, 9000.0, r) * open);
  float lit = sunlit(vW, n);
  vec3 c = shade(alb, n, 1.0, lit);
  if (water > 0.0) {
    vec3 v = normalize(uEye - vW);
    float dist = length(uEye - vW);
    float s = max(1.0, dist / 300.0);
    float a = vnoise(p / s * 0.9 + vec2(uTime * 0.35, 0.0)), b = vnoise(p / s * 2.3 - vec2(0.0, uTime * 0.5));
    vec3 wn = normalize(vec3((a - 0.5) * 0.06 + (b - 0.5) * 0.03, 1.0, (b - 0.5) * 0.06));
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(v, wn), 0.0), 5.0);
    vec3 deep = toLinear(vec3(0.05, 0.11, 0.13)) * (uSkyAmb + uSunCol * max(uSun.y, 0.0) * 0.4);
    vec3 wc = mix(deep, reflection(vW, reflect(-v, wn)), fres);
    wc += uSunCol * pow(max(dot(reflect(-uSun, wn), v), 0.0), 300.0) * 3.0 * lit;
    c = mix(c, wc, water);
  }
  // the rim fades into the continent drawn under it (premultiplied; the sky's mask is kept where it shows through)
  if (r > 8000.0) c = mix(c, paintClouds(c, p), smoothstep(8000.0, 20000.0, r));
  float rim = 1.0 - smoothstep(uRim * 0.6, uRim * 0.95, r);
  o = vec4(display(aerial(c, vW)) * rim, rim);
}`;

/** The landmarks: one mesh, each vertex its material (CAPITAL_ART's record), painted here by hand. */
export const LANDMARK_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos; layout(location = 1) in vec3 aNormal; layout(location = 2) in vec2 aUv; layout(location = 3) in float aMat;
uniform mat4 uVP; uniform vec3 uEye;
out vec3 vW; out vec3 vN; out vec2 vUv; flat out int vMat;
void main(){ vW = aPos; vN = aNormal; vUv = aUv; vMat = int(aMat + 0.5); gl_Position = uVP * vec4(aPos - uEye, 1.0); }`;

export const LANDMARK_FRAGMENT = `#version 300 es
${COMMON}
${SHADOW}
in vec3 vW; in vec3 vN; in vec2 vUv; flat in int vMat; out vec4 o;
float courses(vec3 w, vec3 n, float h, float l){
  float along = abs(n.x) > abs(n.z) ? w.z : w.x;
  float row = floor(w.y / h);
  vec2 q = vec2(fract(along / l + row * 0.5), fract(w.y / h));
  float j = 1.0 - smoothstep(0.0, 0.035, min(min(q.x, 1.0 - q.x) * l / h, min(q.y, 1.0 - q.y)));
  return j * 0.4 + (hash12(vec2(floor(along / l + row * 0.5), row)) - 0.5) * 0.18;
}
void main(){
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  vec3 alb; float spec = 0.0, rough = 60.0;
  float near = smoothstep(900.0, 120.0, length(vW - uEye));
  if (vMat == 0) { // marble: pale, veined
    float v = abs(fbm3(vW.xz * 0.025 + vW.y * 0.012) - 0.5);
    alb = vec3(0.74, 0.72, 0.67) * (0.95 + 0.08 * vnoise(vW.xy * 0.05 + vW.zy * 0.05)) * (1.0 - (v < 0.02 ? 0.12 : 0.0) * near);
    spec = 0.25; rough = 40.0;
  } else if (vMat == 1) { alb = vec3(0.86, 0.66, 0.28); spec = 1.4; rough = 24.0;
  } else if (vMat == 2) { alb = vec3(0.64, 0.6, 0.52) * (1.0 - courses(vW, n, 0.9, 1.7) * near);
  } else if (vMat == 3) { alb = vec3(0.3, 0.33, 0.38) * (0.85 + 0.25 * step(0.5, fract(vW.y / 0.5)) * near);
  } else if (vMat == 4) { alb = vec3(0.56, 0.53, 0.47) * (1.0 - courses(vW, n, 1.2, 2.4) * near);
  } else if (vMat == 5) { alb = vec3(0.05, 0.045, 0.04);
  } else if (vMat == 7) { alb = vec3(0.25, 0.34, 0.52) * (0.85 + 0.25 * step(0.5, fract(vW.y / 0.45)) * near); spec = 0.2;
  } else if (vMat == 8) { alb = vec3(0.44, 0.31, 0.2) * (0.85 + 0.2 * vnoise(vW.xz * 2.0 + vW.y));
  } else if (vMat == 10) { alb = vec3(0.8, 0.64, 0.42);
  } else if (vMat == 11) { float pt = smoothstep(0.45, 0.7, fbm3(vW.xz * 0.3 + vW.y * 0.2)); alb = mix(vec3(0.52, 0.38, 0.2), vec3(0.32, 0.52, 0.44), pt); spec = 0.8 * (1.0 - pt);
  } else if (vMat == 16) { alb = vec3(0.84, 0.72, 0.52) * (1.0 - courses(vW, n, 1.1, 2.2) * near * 0.7);
  } else { alb = vec3(0.62, 0.6, 0.56); }
  vec3 a = toLinear(alb);
  float ao = 0.55 + 0.45 * smoothstep(0.0, 14.0, vW.y);
  float lit = sunlit(vW, n);
  vec3 c = shade(a, n, ao, lit);
  // the palace's windows up the Tower, lit before dawn: slits in rows round the shaft
  float axis = length(vW.xz);
  if (vMat == 0 && axis < 180.0 && vW.y > 60.0 && vW.y < 1090.0 && abs(n.y) < 0.4) {
    float col = atan(vW.z, vW.x) * 56.0 / 6.2831853, row = vW.y / 11.0;
    vec2 f = fract(vec2(col, row));
    float slit = step(0.42, f.x) * step(f.x, 0.58) * step(0.25, f.y) * step(f.y, 0.75);
    float on = step(0.5, hash12(floor(vec2(col, row))));
    c += vec3(1.0, 0.66, 0.3) * slit * on * uNight * 2.2;
  }
  // the gilt: ribbed, brightest along its arrises
  if (vMat == 1) a *= 0.82 + 0.3 * smoothstep(0.3, 0.5, abs(fract(atan(vW.z, vW.x) * 16.0 / 6.2831853) - 0.5)) * near;
  vec3 v = normalize(uEye - vW);
  c += uSunCol * spec * pow(max(dot(reflect(-uSun, n), v), 0.0), rough) * lit * (vMat == 1 ? toLinear(alb) * 2.0 : vec3(0.6));
  if (vMat == 1 || vMat == 11) { vec3 env = skyColour(reflect(-v, n)); c = mix(c, env * toLinear(alb) * 1.4, vMat == 1 ? 0.55 : 0.2); }
  o = vec4(display(aerial(c, vW)), 0.0);
}`;

/** The houses: a box and a roof per instance (introCity.js BUILDING_FLOATS), stood on their cells; windows lit before dawn. */
export const HOUSE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 iA; layout(location = 2) in vec4 iB; layout(location = 3) in vec4 iC; layout(location = 4) in vec2 iD;
uniform mat4 uVP; uniform vec3 uEye; uniform int uPart;
out vec3 vW; out vec3 vWall; flat out float vSeed; flat out float vRoof; flat out float vKind; out float vH; out float vLocalY;
void main(){
  float w = iA.z, d = iA.w, h = iB.x, roofH = iB.y, kind = iD.x;
  vec3 p;
  if (uPart == 0) { p = vec3(aPos.x * w, aPos.y * h, aPos.z * d); }
  else {
    float k = kind < 0.5 ? 1.0 : kind < 1.5 ? 0.0 : 1.0;
    float rh = kind > 1.5 ? 1.2 : roofH;
    float ox = w + 1.2, oz = d + 1.2;
    float x = aPos.y > 0.5 ? aPos.x * k : aPos.x;
    p = vec3(x * ox, h + aPos.y * rh, aPos.z * (aPos.y > 0.5 ? 0.0 : oz));
    if (kind > 1.5) p = vec3(aPos.x * w, h + aPos.y * rh, aPos.z * d);
  }
  float a = iB.z * 1.5707963;
  p = vec3(p.x * cos(a) - p.z * sin(a), p.y, p.x * sin(a) + p.z * cos(a));
  vW = p + vec3(iA.x, 0.0, iA.y);
  vWall = iC.rgb; vSeed = iB.w; vRoof = iC.a; vKind = iD.y; vH = h; vLocalY = p.y;
  gl_Position = uVP * vec4(vW - uEye, 1.0);
}`;

export const HOUSE_FRAGMENT = `#version 300 es
${COMMON}
${SHADOW}
uniform int uPart; uniform vec3 uRoofs[6];
in vec3 vW; in vec3 vWall; flat in float vSeed; flat in float vRoof; flat in float vKind; in float vH; in float vLocalY; out vec4 o;
void main(){
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  if (dot(n, uEye - vW) < 0.0) n = -n;
  float dist = length(uEye - vW);
  vec3 alb; vec3 glow = vec3(0);
  if (uPart == 1) {
    alb = uRoofs[int(vRoof + 0.5)] * (0.8 + 0.3 * vSeed);
    float rows = step(0.5, fract(vW.y / 0.42));
    alb *= 1.0 - 0.12 * rows * smoothstep(300.0, 60.0, dist);
  } else {
    alb = vWall * (0.86 + 0.22 * vSeed);
    float along = abs(n.x) > abs(n.z) ? vW.z : vW.x;
    float y = vLocalY;
    if (y < 1.2) alb *= 0.72;
    // half-timber on the upper floors of a third of the houses
    if (vKind < 0.5 && vSeed > 0.66 && y > 3.4) {
      float beam = step(fract(along / 1.5), 0.12) + step(fract((y - 3.4) / 2.9), 0.1);
      alb = mix(vec3(0.9, 0.86, 0.76), vec3(0.24, 0.16, 0.1), clamp(beam, 0.0, 1.0));
    }
    // the windows, a floor every 3.2 m; before dawn a share of them lit
    vec2 cell = vec2(along / 2.8, (y - 2.0) / 3.2);
    vec2 f = fract(cell);
    float win = step(0.36, f.x) * step(f.x, 0.64) * step(0.3, f.y) * step(f.y, 0.74) * step(1.0, cell.y) * step(y, vH - 1.0) * smoothstep(700.0, 200.0, dist);
    float on = step(0.6, hash13(vec3(floor(cell), vSeed * 97.0)));
    alb = mix(alb, vec3(0.1, 0.11, 0.13), win);
    glow = vec3(1.0, 0.62, 0.28) * win * on * uNight * 2.4;
    // at a distance a lit window is a point of light, not a pane
    float far = smoothstep(500.0, 2200.0, dist) * step(0.7, hash13(vec3(floor(vW.xz / 6.0), floor(y / 3.2)))) * step(2.0, y) * step(y, vH - 1.0);
    glow += vec3(1.0, 0.6, 0.25) * far * uNight * 1.2;
  }
  vec3 a = toLinear(alb);
  float ao = 0.6 + 0.4 * smoothstep(0.0, 6.0, vLocalY);
  vec3 c = shade(a, n, ao, sunlit(vW, n)) + glow;
  o = vec4(display(aerial(c, vW)), 0.0);
}`;

/** The trees: a crown on a trunk, per instance (introCity.js TREE_FLOATS). */
export const TREE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos; layout(location = 1) in vec4 iT;
uniform mat4 uVP; uniform vec3 uEye; uniform float uTime;
out vec3 vW; out vec3 vN; flat out float vSeed; out float vY;
void main(){
  // a tree past the haze's reach is folded away - thirty thousand of them, most a pixel or less
  float h = iT.z * (1.0 - step(iT.z * 320.0, length(iT.xy - uEye.xz))), s = iT.w;   // past ~1.5 px tall
  float rad = h * (0.26 + 0.12 * s);
  vec3 p = vec3(aPos.x * rad, aPos.y * h, aPos.z * rad);
  float sway = sin(uTime * 1.3 + s * 40.0) * 0.015 * h * aPos.y;
  vW = vec3(iT.x + p.x + sway, p.y, iT.y + p.z);
  vN = normalize(vec3(aPos.x, (aPos.y - 0.55) * 2.0, aPos.z));
  vSeed = s; vY = aPos.y;
  gl_Position = uVP * vec4(vW - uEye, 1.0);
}`;

export const TREE_FRAGMENT = `#version 300 es
${COMMON}
${SHADOW}
in vec3 vW; in vec3 vN; flat in float vSeed; in float vY; out vec4 o;
void main(){
  vec3 n = normalize(vN + (vec3(vnoise(vW.xz * 0.7), 0.0, vnoise(vW.zx * 0.7 + 3.0)) - 0.5) * 0.9);
  vec3 alb = vY < 0.2 ? vec3(0.22, 0.16, 0.1) : mix(vec3(0.12, 0.2, 0.08), vec3(0.22, 0.3, 0.12), vSeed) * (0.75 + 0.5 * vnoise(vW.xz * 1.3 + vW.y));
  float ao = 0.45 + 0.55 * smoothstep(0.15, 1.0, vY);
  vec3 c = shade(toLinear(alb), n, ao, sunlit(vW, n));
  o = vec4(display(aerial(c, vW)), 0.0);
}`;

/** The birds: a wheeling flock round the Tower's crown, each two wings beating (all of it in the vertex stage). */
export const BIRD_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uVP; uniform vec3 uEye; uniform float uTime;
out vec3 vW;
float h(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){
  int bird = gl_VertexID / 6, k = gl_VertexID % 6;
  float b = float(bird), s1 = h(b), s2 = h(b + 17.0), s3 = h(b + 41.0);
  float radius = 260.0 + s1 * 520.0, speed = (0.08 + s2 * 0.06) * (s3 > 0.5 ? 1.0 : 0.85);
  float a = uTime * speed + s1 * 6.2831;
  vec3 c = vec3(cos(a) * radius, 880.0 + s2 * 380.0 + sin(uTime * 0.5 + b) * 18.0, sin(a) * radius);
  vec3 fwd = normalize(vec3(-sin(a), 0.0, cos(a)));
  vec3 side = normalize(cross(fwd, vec3(0, 1, 0)));
  float flap = sin(uTime * (7.0 + s3 * 3.0) + b) * 0.55;
  float span = 2.6 + s3 * 1.4;
  vec3 tip = side * span * cos(flap) + vec3(0, span * sin(flap), 0);
  vec3 p = k == 0 ? c - fwd * 0.6 : k == 1 ? c + fwd * 0.9 : k == 2 ? c + tip : k == 3 ? c - fwd * 0.6 : k == 4 ? c + fwd * 0.9 : c - tip * vec3(1, -1, 1) - vec3(0, 2.0 * span * sin(flap), 0);
  vW = p;
  gl_Position = uVP * vec4(p - uEye, 1.0);
}`;

export const BIRD_FRAGMENT = `#version 300 es
${COMMON}
in vec3 vW; out vec4 o;
void main(){ o = vec4(display(aerial(vec3(0.012, 0.011, 0.01) + uSkyAmb * 0.05, vW)), 0.0); }`;

/** The cloud deck the ascent climbs through - three sheets, lit gold on their tops, grey under. */
export const DECK_FRAGMENT = `#version 300 es
${COMMON}
uniform float uCover;
in vec3 vW; out vec4 o;
void main(){
  vec2 p = vW.xz / 2600.0 + vec2(uTime * 0.02, uTime * 0.008) + vW.y * 0.001;
  float d = smoothstep(0.5, 0.8, fbm(p) * 0.85 + vnoise(p * 7.0) * 0.15) * uCover;
  float r = length(vW.xz);
  d *= 1.0 - smoothstep(26000.0, 34000.0, r);
  if (d < 0.01) discard;
  float above = step(vW.y, uEye.y);
  vec3 c = mix(uSkyAmb * 0.9 + uSunCol * 0.15, uSunCol * max(uSun.y, 0.05) * 1.6 + uSkyAmb * 1.3, above * 0.7 + 0.3 * fbm3(p * 3.0));
  float a = d * 0.72;
  o = vec4(display(aerial(c, vW)) * a, a);
}`;

/** The frame's last pass: the scene, its bloom off its own mips, the sun's rays through the open sky, a grade and a
 *  grain. */
export const POST_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uScene; uniform vec2 uRes; uniform vec2 uSunUv; uniform float uSunVis; uniform vec3 uRayCol;
uniform float uFlare; uniform float uTime; uniform float uWarm;
out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uScene, uv).rgb;
  vec3 b = textureLod(uScene, uv, 2.0).rgb * 0.45 + textureLod(uScene, uv, 4.0).rgb * 0.35 + textureLod(uScene, uv, 6.0).rgb * 0.3;
  c += max(b - 0.6, 0.0) * 0.85;
  if (uSunVis > 0.001) {
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 d = (uSunUv - uv) / 40.0;
    vec2 p = uv; float acc = 0.0, wgt = 1.0;
    for (int i = 0; i < 40; i++) {
      p += d;
      vec4 s = texture(uScene, p);
      acc += s.a * max(dot(s.rgb, vec3(0.3, 0.5, 0.2)) - 0.35, 0.0) * wgt;
      wgt *= 0.96;
    }
    float fall = smoothstep(1.3, 0.0, length((uv - uSunUv) * asp));
    c += uRayCol * acc / 40.0 * uSunVis * 2.2 * fall;
    c += uRayCol * uFlare * exp(-length((uv - uSunUv) * asp) * 3.5) * 0.6;
  }
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
  c *= mix(vec3(0.94, 1.0, 1.05), vec3(1.05, 1.0, 0.92), smoothstep(0.15, 0.7, l));
  c = mix(c, vec3(l) * vec3(1.08, 0.98, 0.82), uWarm * 0.28);
  c = mix(vec3(0.012, 0.016, 0.022), c, 0.985);
  c += (hash(uv * uRes + fract(uTime) * 61.0) - 0.5) * 0.022;
  o = vec4(c, 1.0);
}`;

/** The shadow map's own pass: depth alone, from the sun. */
export const DEPTH_FRAGMENT = `#version 300 es
precision mediump float;
out vec4 o;
void main(){ o = vec4(1); }`;
