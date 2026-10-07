// @ts-check
// SD5b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR'S SKY -
// "a void of brass light and slow aurorae, the Bay's skylines hanging upside down in it - Daggerfall's towers,
// Sentinel's domes, Wayrest's bridges - the shards of the endings, turning on the realm's clock; a great clock-face of
// stars behind the arena whose hands run backwards."
//
// PAINTED, NOT BUILT - the Deadlands' law (render/deadlands.js): one triangle over the screen AT THE FAR PLANE,
// depth-tested and never written, each pixel reading its own ray (`skyBasis`), drawn in the realm's world pass after its
// solid geometry and before its flats (PERF2's law: the Hour's islands drawn first, so the sky shows only where they do
// not). Azimuth is measured from the realm's +z - toward the arena, where the clock-face hangs - turning toward +x.
//
//   THE VOID - near black brass, a glow of brass along the horizon that meets the frame's haze (SD_REALM_FOG), and stars.
//   THE AURORAE - slow curtains of brass light high over the islands, a pale green at their hems (the Mantella's).
//   THE SHARDS - three of the Bay's skylines hanging upside down from the upper sky, dark against the glow with a lit
//     rim: DAGGERFALL'S towers and their spires, SENTINEL'S domes and minarets, WAYREST'S bridge on its piers. Each
//     drifts round the sky its own way.
//   THE CLOCK-FACE - a ring of stars over the arena, its twelve hours the brightest, and two hands of light turning
//     BACKWARDS - the Hour unwinding.
//
// THE CLOCK is the realm's, anchored (world.js hands the Deadlands' own anchored relay clock, render/deadlands.js
// anchoredClock), so every screen shows the same moment; every rate is a whole number of cycles over SD_SKY_PERIOD and
// the clock is handed wrapped, so the sky never jumps.
//
// Colours are display-encoded (the lit lane's frame image), scaled by `gain` with the realm's fog (render/deadlands.js
// skyGain's law). Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { skyBasis, DEAD_NOISE_GLSL } from './deadlands.js';

/** Every rate is whole cycles over this many seconds; the clock is handed wrapped to it. */
export const SD_SKY_PERIOD = 720;
export const sdSkyClock = (seconds) => ((seconds % SD_SKY_PERIOD) + SD_SKY_PERIOD) % SD_SKY_PERIOD;
/** The clock-face: where it hangs (radians - over the arena, +z), how wide, and its hands' turns a period (backwards). */
export const SD_CLOCK_FACE = Object.freeze({ az: 0, elev: 0.38, r: 0.36, hourTurns: 1, minuteTurns: 12 });
/** The shards: each skyline's azimuth at the clock's zero, its half-width and depth (radians), its turns a period. */
export const SD_SKY_SHARDS = Object.freeze([
  Object.freeze({ name: 'daggerfall', az: 2.2, halfW: 0.42, depth: 0.32, turns: 1 }),
  Object.freeze({ name: 'sentinel', az: -2.1, halfW: 0.38, depth: 0.26, turns: -1 }),
  Object.freeze({ name: 'wayrest', az: 3.05, halfW: 0.5, depth: 0.22, turns: 2 }),
]);
/** Where the shards hang from (the upper sky, radians of elevation), the aurorae's band, and their slow drift's turns. */
export const SD_SHARD_TOP = 1.02;
export const SD_AURORA = Object.freeze({ low: 0.3, high: 1.15, turns: 3 });

const HEAD = `#version 300 es
precision highp float;
`;

export const SD_SKY_VS = HEAD + `layout(location = 0) in vec2 aPos;
uniform vec3 uRight, uUp, uFwd;
uniform vec4 uProj;
out vec3 vRay;
void main() {
  vRay = uRight * ((aPos.x + uProj.z) / uProj.x) + uUp * ((aPos.y + uProj.w) / uProj.y) + uFwd;
  gl_Position = vec4(aPos, 1.0, 1.0); }`;

const f4 = (v) => v.toFixed(4);
const shardGlsl = SD_SKY_SHARDS.map((s, i) => `  { float c = ${f4(s.az)} + ${f4(s.turns)} * TAU * uTime / PERIOD; float du = wrapPi(az - c) / ${f4(s.halfW)}; float dv = (${f4(SD_SHARD_TOP)} - e) / ${f4(s.depth)};
    if (abs(du) < 1.0 && dv > -0.05 && dv < 1.0) { float m = skyline${i}(du, dv); float rim = skyline${i}(du * 1.03, dv - 0.025) * (1.0 - m);
      col = mix(col, SHARD_DARK * uGain, m * 0.92); col += BRASS_BRIGHT * rim * 0.9 * uGain; } }`).join('\n');

export const SD_SKY_FS = HEAD + `in vec3 vRay;
uniform float uTime;     // the realm's seconds, wrapped to the period
uniform vec3 uHaze;      // the frame's fog colour
uniform float uGain;     // the realm's light against its own at full
out vec4 o;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
const float PERIOD = ${SD_SKY_PERIOD.toFixed(1)};
const vec3 VOID = vec3(0.035, 0.026, 0.016);
const vec3 BRASS = vec3(0.62, 0.45, 0.2);
const vec3 BRASS_BRIGHT = vec3(1.0, 0.82, 0.48);
const vec3 MANTELLA = vec3(0.55, 1.0, 0.75);
const vec3 SHARD_DARK = vec3(0.02, 0.015, 0.01);
${DEAD_NOISE_GLSL}
float wrapPi(float a) { return mod(a + PI, TAU) - PI; }
float box(float u, float v, float c, float w, float h) { return step(abs(u - c), w) * step(v, h); }
// DAGGERFALL: towers of uneven height hanging from the shard's edge, each ending in a spire (pointing down)
float skyline0(float u, float v) {
  float m = 0.0;
  for (int i = 0; i < 7; i++) {
    float c = -0.82 + float(i) * 0.27, w = 0.06 + 0.03 * fract(float(i) * 0.618), h = 0.35 + 0.45 * fract(float(i) * 0.371 + 0.2);
    m = max(m, box(u, v, c, w, h));
    m = max(m, step(v, h + (w - abs(u - c)) * 2.2) * step(abs(u - c), w) * step(h, v));   // the spire
  }
  return max(m, step(v, 0.12));   // the ground they stand on, above them
}
// SENTINEL: domes bulging down from the edge, a minaret beside each
float skyline1(float u, float v) {
  float m = step(v, 0.1);
  for (int i = 0; i < 4; i++) {
    float c = -0.66 + float(i) * 0.44, w = 0.13 + 0.05 * fract(float(i) * 0.5);
    float d = length(vec2((u - c) / w, (v - 0.1) / (w * 1.6)));
    m = max(m, step(d, 1.0) * step(0.1, v));
    m = max(m, box(u, v, c + w * 1.35, 0.022, 0.62 + 0.15 * fract(float(i) * 0.77)));
  }
  return m;
}
// WAYREST: its bridge - the deck along the edge, its spans' arches bowed toward it between the piers, two gate towers
float skyline2(float u, float v) {
  float m = step(v, 0.08);                         // the city's edge
  float cell = fract((u + 1.0) * 2.0);             // four spans across the shard
  float curve = 0.14 + 0.36 * pow(2.0 * cell - 1.0, 2.0);
  m = max(m, step(v, curve) * step(0.08, v));      // the deck, and the piers thickening to its arches' feet
  m = max(m, box(u, v, -0.5, 0.05, 0.62));
  m = max(m, box(u, v, 0.5, 0.05, 0.62));
  return m;
}
float star(vec3 d, float scale, float density) {
  vec3 q = d * scale, c = floor(q), f = fract(q) - 0.5;
  float h = dhash(c.xy + c.z * 17.17);
  if (h < density) return 0.0;
  vec3 j = vec3(dhash(c.yz + 3.1), dhash(c.zx + 5.7), dhash(c.xy + 9.3)) - 0.5;
  return smoothstep(0.12, 0.0, length(f - j * 0.6)) * (0.5 + 0.5 * h);
}
float segment(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return smoothstep(w, w * 0.25, length(pa - ba * t));
}
void main() {
  vec3 d = normalize(vRay);
  float e = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, d.z);
  // THE VOID and its horizon's brass glow, meeting the haze
  float band = exp(-abs(e) * 7.0);
  vec3 col = mix(VOID, BRASS * 0.55, band) * uGain;
  col = mix(col, uHaze, 0.5 * band);
  col += BRASS_BRIGHT * (star(d, 90.0, 0.985) + 0.6 * star(d, 160.0, 0.992)) * smoothstep(-0.1, 0.25, e) * uGain;
  // THE AURORAE: slow curtains high over the islands
  if (e > ${f4(SD_AURORA.low)} && e < ${f4(SD_AURORA.high)}) {
    float drift = ${f4(SD_AURORA.turns)} * TAU * uTime / PERIOD;
    float curtain = sin(az * 3.0 + dfbm(vec2(az * 1.3, e * 2.0) + vec2(cos(drift), sin(drift)) * 0.7, 4) * 4.0 + drift);
    float k = smoothstep(0.55, 1.0, curtain) * smoothstep(${f4(SD_AURORA.low)}, ${f4(SD_AURORA.low)} + 0.2, e) * smoothstep(${f4(SD_AURORA.high)}, ${f4(SD_AURORA.high)} - 0.25, e);
    float hem = smoothstep(0.55, 0.7, curtain) * (1.0 - smoothstep(0.7, 0.95, curtain));
    col += (BRASS * 0.55 * k + MANTELLA * 0.25 * hem * k) * uGain;
  }
  // THE CLOCK-FACE over the arena: a ring of stars, its twelve hours bright, two hands turning backwards
  {
    vec2 p = vec2(wrapPi(az - ${f4(SD_CLOCK_FACE.az)}), e - ${f4(SD_CLOCK_FACE.elev)}) / ${f4(SD_CLOCK_FACE.r)};
    float r = length(p);
    if (r < 1.25) {
      float ang = atan(p.x, p.y);
      float ring = smoothstep(0.03, 0.0, abs(r - 1.0)) * 0.5;
      float hourMark = smoothstep(0.06, 0.0, length(p - 0.9 * vec2(sin(floor(ang / (TAU / 12.0) + 0.5) * TAU / 12.0), cos(floor(ang / (TAU / 12.0) + 0.5) * TAU / 12.0))));
      float back = -TAU * uTime / PERIOD;
      float hHand = segment(p, vec2(0.0), 0.55 * vec2(sin(back * ${f4(SD_CLOCK_FACE.hourTurns)}), cos(back * ${f4(SD_CLOCK_FACE.hourTurns)})), 0.035);
      float mHand = segment(p, vec2(0.0), 0.85 * vec2(sin(back * ${f4(SD_CLOCK_FACE.minuteTurns)}), cos(back * ${f4(SD_CLOCK_FACE.minuteTurns)})), 0.022);
      col += BRASS_BRIGHT * (ring + hourMark * 1.4 + 0.9 * max(hHand, mHand)) * uGain;
    }
  }
  // THE SHARDS: the Bay's skylines hanging upside down, drifting round
${shardGlsl}
  o = vec4(col, 1.0);
}`;

/** The Hour's sky, one foreign pass. */
export class SdSkyRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, SD_SKY_VS, SD_SKY_FS, 'sd sky');
    this.u = {};
    for (const n of ['uRight', 'uUp', 'uFwd', 'uProj', 'uTime', 'uHaze', 'uGain']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    /** whether the last draw put the sky up (the stats and the tests) */
    this.drawn = false;
  }

  /** Paint the sky where nothing nearer has drawn: `seconds` the realm's clock (wrapped here), `fog` the frame's (its
   *  colour the haze the horizon meets), `gain` the realm's light against its own. Answers true. */
  draw(proj, view, seconds, fog = null, gain = 1) {
    const gl = this.gl, U = this.u, b = skyBasis(view, proj);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.uniform3fv(U.uRight, b.right); gl.uniform3fv(U.uUp, b.up); gl.uniform3fv(U.uFwd, b.fwd); gl.uniform4fv(U.uProj, b.lens);
    gl.uniform1f(U.uTime, sdSkyClock(seconds));
    gl.uniform3fv(U.uHaze, fog?.color ?? [0.2, 0.15, 0.07]);
    gl.uniform1f(U.uGain, gain);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);   // PERF2: only where nothing nearer has drawn - z is the far plane
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    this.drawn = true;
    return true;
  }
}
