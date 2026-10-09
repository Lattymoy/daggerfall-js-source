// @ts-check
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 3): THE STEP THROUGH THE HOUR - the Shattered
// Hour's own veil, chosen by theme in ui/gateVeil.js beside Dagon's fire (render/gateVeil.js keeps its program and its
// law: `veilAt` times this one too). One triangle over the veil's own canvas, as the fire's.
//
//   INTO THE HOUR - twelve heavy brass blades sweep in from the screen's edges, pivoting on the point where the Rift
//     stood on the screen (`uCentre`), closing like the Rift's own iris: engraved with minute ticks, a rivet at each
//     pivot, gold light along each leading edge, gold pouring through the gaps. Shut, the iris is a dial - its twelve
//     seams the hours, its Roman numerals the sky's own (render/sdSky.js SD_NUMERAL_GLSL) - and a spade hand sweeps
//     BACKWARDS from XII (`sdVeilHand`); past its first turn the Dragon Break: six gold and silver ghost hands at
//     slightly different speeds, and a crack across the face. Opening, the face breaks along its cracks into shards
//     that fall outward as the blades spin back off the screen.
//   OUT BY THE WAY BACK OR THE RETURN - the same iris in silver, its face already cracked, its hand running FORWARD and
//     slowing. Nothing is mended.
//   OUT BY THE WAY HOME - silver, the hand running forward, and the crack MENDS (`uMend`); the face turns white-gold
//     before it opens. The victory beat.
//   FORCED (death in the Hour, cast out, the collapse - `flash`) - the whole face at once, cracked red, then it SHATTERS
//     into about forty pieces that spin and fall away, revealing where you land.
//   REDUCED MOTION - nothing spins, nothing shatters: the face holds still and an ordered dither wipes it.
//
// Every pixel posterized to six levels through the ordered dither, in the Hour's palette (world/sdLook.js); the canvas
// is a third of the device's pixels (ui/gateVeil.js), drawn pixelated. Output premultiplied. Not a DFU member. Ledger A
// (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { BAYER_GLSL } from './orderedDither.js';
import { SD_NUMERAL_GLSL } from './sdSky.js';

/** The veil's modes: into the Hour, out by the way back (or the Return), out by the way home, forced out. */
export const SD_VEIL_MODE = Object.freeze({ in: 0, back: 1, home: 2, cast: 3 });
/** The blades: how many, their most turn as they close (turns), the dial's radius when shut (screen radii), the
 *  numerals' ring on it and a numeral's cell. */
export const SD_VEIL_BLADES = 12;
export const SD_VEIL_TWIST = 0.3;
export const SD_VEIL_FACE_R = 0.42;
export const SD_VEIL_NUMERAL_R = 0.33;
export const SD_VEIL_CELL = 0.012;
/** The hand: a turn in SD_VEIL_TURN_S while the hold is young, one in SD_VEIL_SLOW_S once it has run SD_VEIL_SLOW_AFTER_S
 *  (the stillness looks deliberate); the Dragon Break after its first whole turn. */
export const SD_VEIL_TURN_S = 2;
export const SD_VEIL_SLOW_S = 6;
export const SD_VEIL_SLOW_AFTER_S = 3;
/** The forced shatter: its pieces (a grid of jittered cells), and how long it takes. */
export const SD_VEIL_SHATTER = Object.freeze({ cols: 8, rows: 5, s: 1.4 });

/**
 * THE HAND at `t` seconds shut in `mode`: its turn (radians, clockwise from XII as the screen shows it) - BACKWARDS into
 * the Hour (a turn in SD_VEIL_TURN_S, slowing to one in SD_VEIL_SLOW_S past SD_VEIL_SLOW_AFTER_S), FORWARD and slowing
 * out of it. Pure: the shader's own law (pinned equal), and the quarters' clock (ui/gateVeil.js strikes them as it passes
 * IX, VI, III and XII).
 */
export function sdVeilHand(t, mode) {
  const s = Math.max(0, t);
  if (mode === SD_VEIL_MODE.in || mode === SD_VEIL_MODE.cast) {
    const turns = s < SD_VEIL_SLOW_AFTER_S ? s / SD_VEIL_TURN_S : SD_VEIL_SLOW_AFTER_S / SD_VEIL_TURN_S + (s - SD_VEIL_SLOW_AFTER_S) / SD_VEIL_SLOW_S;
    return -Math.PI * 2 * turns;
  }
  return Math.PI * 2 * 1.2 * (1 - Math.exp(-s * 0.7));
}
/** How many quarters the hand has struck by `t` (backwards from XII: IX, VI, III, XII - one each quarter turn). */
export const sdVeilQuarters = (t, mode) => Math.floor(Math.abs(sdVeilHand(t, mode)) / (Math.PI / 2) + 1e-9);

const f4 = (v) => v.toFixed(4);
export const SD_VEIL_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;       // the canvas, pixels
uniform float uTime;     // seconds since the veil began
uniform float uCover;    // how much of the screen the blades have taken (render/gateVeil.js veilAt)
uniform float uShut;     // seconds the veil has stood shut (the hand's clock; 0 before)
uniform float uOpening;  // 0..1 through its opening (0 before)
uniform vec2 uCentre;    // the Rift on the screen, screen radii (the corners at 1)
uniform float uMode;     // SD_VEIL_MODE
uniform float uMend;     // the way home's crack mending, 0..1
uniform float uShatter;  // the forced shatter, 0..1
uniform float uReduce;   // 1: reduced motion - nothing spins, a dither wipes
out vec4 o;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
const float NB = ${SD_VEIL_BLADES.toFixed(1)};
${BAYER_GLSL}${SD_NUMERAL_GLSL}
float vh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float handAt(float t, float mode) {
  float s = max(0.0, t);
  if (mode < 0.5 || mode > 2.5) {
    float turns = s < ${f4(SD_VEIL_SLOW_AFTER_S)} ? s / ${f4(SD_VEIL_TURN_S)} : ${f4(SD_VEIL_SLOW_AFTER_S / SD_VEIL_TURN_S)} + (s - ${f4(SD_VEIL_SLOW_AFTER_S)}) / ${f4(SD_VEIL_SLOW_S)};
    return -TAU * turns;
  }
  return TAU * 1.2 * (1.0 - exp(-s * 0.7));
}
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// a hand at angle a (clockwise from XII), its spade near its tip
float hand(vec2 p, float a, float len, float w) {
  vec2 d = vec2(sin(a), cos(a)), side = vec2(d.y, -d.x), tip = d * len * 0.84;
  float core = step(seg(p, vec2(0.0), d * len), w);
  float spade = step(abs(dot(p - tip, d)) / (len * 0.12) + abs(dot(p - tip, side)) / (w * 3.4), 1.0);
  return max(core, spade);
}
// the crack across the face: a jagged line through it
float crack(vec2 p) {
  vec2 d = normalize(vec2(0.86, 0.5)), n = vec2(-d.y, d.x);
  float x = dot(p, d), y = dot(p, n);
  return abs(y - 0.035 * sin(x * 23.0) - 0.018 * sin(x * 61.0 + 1.3) - 0.01 * sign(sin(x * 9.0)));
}
// the dial: what the shut iris shows - its numerals, its hand, the Break's ghosts, the crack
vec3 face(vec2 p, float mode, float t, out float lit) {
  float r = length(p), a = atan(p.x, p.y);
  bool silver = mode > 0.5 && mode < 2.5;
  vec3 base = silver ? vec3(0.32, 0.34, 0.38) : vec3(0.36, 0.25, 0.1);
  vec3 ink = silver ? vec3(0.86, 0.9, 1.0) : vec3(1.0, 0.82, 0.48);
  if (mode > 1.5 && mode < 2.5) { base = mix(base, vec3(0.62, 0.55, 0.38), uMend); ink = mix(ink, vec3(1.0, 0.94, 0.7), uMend); }
  if (mode > 2.5) { base = vec3(0.3, 0.12, 0.08); ink = vec3(1.0, 0.45, 0.35); }
  vec3 c = base * (0.75 + 0.25 * step(0.5, fract(r * 30.0)));
  lit = 0.0;
  // the numerals at their hours, upright and on whole pixels - a glyph's cell a whole number of the canvas's pixels, so
  // each reads crisp at the canvas's third
  int hr = int(mod(floor(mod(a + TAU, TAU) / (TAU / 12.0) + 0.5), 12.0));
  float phi = float(hr) * TAU / 12.0, unit = 0.5 * length(uRes), cellPx = max(1.0, floor(uRes.y * ${f4(SD_VEIL_CELL)} + 0.5));
  vec2 at = floor(0.5 * uRes + (uCentre + ${f4(SD_VEIL_NUMERAL_R)} * vec2(sin(phi), cos(phi))) * unit);
  vec2 lc = (floor(0.5 * uRes + (p + uCentre) * unit) - at) / cellPx;   // p's own pixel: a shard carries its numerals
  int cx = int(floor(lc.x + float(numeralWidth(hr)) * 0.5)), cy = int(floor(3.5 - lc.y));
  if (cx >= 0 && cx < numeralWidth(hr) && numeralLit(hr, cx, cy) > 0.5) { c = ink; lit = 1.0; }
  // the hand, and past its first turn into the Hour the Dragon Break's six ghost pairs
  float ha = handAt(t, mode);
  if (hand(p, ha, 0.28, 0.011) > 0.5) { c = ink * 1.1; lit = 1.0; }
  if (mode < 0.5 && t >= ${f4(SD_VEIL_TURN_S)}) {
    for (int k = 0; k < 6; k++) {
      float sp = 1.0 + 0.13 * float(k), g = ha * sp + 0.07 * float(k);
      if (hand(p, g, 0.26, 0.006) > 0.5) { c = mix(c, (k & 1) == 0 ? vec3(1.0, 0.8, 0.42) : vec3(0.8, 0.86, 1.0), 0.6); lit = max(lit, 0.6); }
    }
  }
  // the crack: in the Break into the Hour, always on the way back, mending on the way home, red when forced
  float w = mode < 0.5 ? 0.008 * step(${f4(SD_VEIL_TURN_S)}, t) : mode < 1.5 ? 0.008 : mode < 2.5 ? 0.008 * (1.0 - uMend) : 0.012;
  if (crack(p) < w) { c = mode > 2.5 ? vec3(1.0, 0.32, 0.26) : vec3(0.05, 0.03, 0.02); lit = mode > 2.5 ? 1.0 : 0.0; }
  // the hub: a boss of brass, and in it the Mantella's green - the Hour's heart
  if (r < 0.03) { c = r < 0.017 ? vec3(0.45, 1.0, 0.62) * (r < 0.008 ? 1.2 : 0.8) : ink * 0.8; lit = 1.0; }
  return c;
}
// the blades at p, closed by the cover (twist its turn): their brass, engraved minute ticks, a rivet at each pivot, light
// along each leading edge and gold pouring through the gap behind it
vec3 blades(vec2 p, float twist, float mode) {
  float r = length(p), a = atan(p.x, p.y), sector = TAU / NB;
  bool gold = mode < 0.5;
  vec3 lo = gold ? vec3(0.34, 0.23, 0.09) : mode > 2.5 ? vec3(0.3, 0.12, 0.08) : vec3(0.3, 0.32, 0.36);
  vec3 hi = gold ? vec3(0.85, 0.62, 0.27) : mode > 2.5 ? vec3(0.62, 0.3, 0.2) : vec3(0.75, 0.79, 0.86);
  vec3 edge = gold ? vec3(1.0, 0.82, 0.45) : mode > 2.5 ? vec3(1.0, 0.4, 0.3) : vec3(0.85, 0.9, 1.0);
  if (mode > 1.5 && mode < 2.5) { hi = mix(hi, vec3(1.0, 0.92, 0.66), uMend); edge = mix(edge, vec3(1.0, 0.9, 0.55), uMend); }
  float s = (a - twist) / sector + 0.55 * r, along = fract(s);
  vec3 c = mix(lo, hi, 0.25 + 0.5 * along);
  if (along > 0.3 && along < 0.8 && fract(r * 34.0) < 0.12) c *= 0.7;
  // two rivets down each blade's spine
  for (int i = 0; i < 2; i++) {
    float rr = i == 0 ? 0.62 : 0.95, k = (floor(s) + 0.5 - 0.55 * rr) * sector + twist;
    vec2 d = p - vec2(sin(k), cos(k)) * rr;
    if (length(d) < 0.016) c = d.x - d.y < 0.0 ? hi * 1.2 : lo * 0.8;
  }
  if (along < 0.02) c = mix(c, edge * 1.2, 0.85);
  if (along > 0.975) c = mix(c, edge * 1.4, 0.7);
  return c;
}
// the veil stood shut at p: the dial inside its face, the blades round it
vec3 shutAt(vec2 p, float mode, float t) {
  float lit;
  return length(p) < ${f4(SD_VEIL_FACE_R)} ? face(p, mode, t, lit) : blades(p, ${f4(SD_VEIL_TWIST)} * TAU * (mode < 0.5 ? 1.0 : -1.0), mode);
}
vec4 px(vec3 c, float alpha) {
  c = floor(c * 6.0 + bayer4(gl_FragCoord.xy)) / 6.0;   // six levels through the ordered dither - pixel art
  return vec4(c * alpha, alpha);
}
void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * length(uRes));
  vec2 p = q - uCentre;
  float r = length(p), a = atan(p.x, p.y);
  float cover = clamp(uCover, 0.0, 1.0), reach = 1.6 + length(uCentre);
  float dither = bayer4(gl_FragCoord.xy) + 0.03125;
  // REDUCED MOTION: nothing spins, nothing shatters - the shut face, its hand still at XII, wiped in and out by the dither
  if (uReduce > 0.5) {
    float shown = uMode > 2.5 ? 1.0 - uShatter : cover;
    o = px(shutAt(p, uMode, 0.0), step(dither, shown));
    return;
  }
  // FORCED: the whole face at once, cracked red - then it shatters into pieces that spin and fall away, the cells
  // above first, revealing where you land
  if (uMode > 2.5) {
    vec2 g = vec2(${SD_VEIL_SHATTER.cols.toFixed(1)}, ${SD_VEIL_SHATTER.rows.toFixed(1)});
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 home = floor(uv * g);
    for (int dy = 0; dy <= 5; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 cell = home + vec2(float(dx), float(dy));
        if (cell.y > g.y || cell.x < -1.0 || cell.x > g.x) continue;   // a piece of the screen, or just past its edges
        float h = vh(cell + 7.0), tt = max(0.0, uShatter * ${f4(SD_VEIL_SHATTER.s)} - h * 0.45);
        vec2 seed = (cell + 0.3 + 0.4 * vec2(vh(cell), vh(cell + 3.1))) / g;
        float spin = (vh(cell + 9.2) - 0.5) * 6.0 * tt;
        vec2 rel = uv - seed - vec2((h - 0.5) * 0.3 * tt, -2.4 * tt * tt);
        vec2 src = seed + vec2(cos(spin) * rel.x - sin(spin) * rel.y, sin(spin) * rel.x + cos(spin) * rel.y);
        // whether the screen point it came from is this piece's - nearest its seed of the jittered grid
        vec2 sc = floor(src * g), bc = sc;
        float best = 1e9, next = 1e9;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c2 = sc + vec2(float(i), float(j)), s2 = (c2 + 0.3 + 0.4 * vec2(vh(c2), vh(c2 + 3.1))) / g;
          vec2 e = (src - s2) * vec2(uRes.x / uRes.y, 1.0);
          float d2 = dot(e, e);
          if (d2 < best) { next = best; best = d2; bc = c2; } else if (d2 < next) next = d2;
        }
        if (bc == cell) {
          vec2 fq = (src * uRes - 0.5 * uRes) / (0.5 * length(uRes));
          vec3 c = shutAt(fq - uCentre, uMode, uShut);
          if (sqrt(next) - sqrt(best) < 0.008) c = vec3(1.0, 0.32, 0.26);   // its cracks, alight in red
          o = px(c * (1.0 - 0.4 * clamp(tt, 0.0, 1.0)), 1.0);
          return;
        }
      }
    }
    o = vec4(0.0);
    return;
  }
  // THE BLADES: an iris whose aperture is the cover, pivoting on the Rift on the screen, turned as it closes (into the
  // Hour sunwise, out of it widdershins)
  float ra = (1.0 - cover) * reach;
  float twist = cover * ${f4(SD_VEIL_TWIST)} * TAU * (uMode < 0.5 ? 1.0 : -1.0);
  float sector = TAU / NB;
  float poly = ra * cos(PI / NB) / cos(mod(a - twist, sector) - PI / NB);
  bool shut = cover > 0.985 && uOpening <= 0.0;
  // OPENING: the face broken along its cracks - twelve hours by three rings - its shards flung outward, each turning a
  // little its own way, fading; a dark seam round each
  if (uOpening > 0.0) {
    float u2 = uOpening * uOpening, aw = mod(a + TAU, TAU), hw = TAU / 12.0, ring = ${f4(SD_VEIL_FACE_R / 3)};
    float hr = floor(aw / hw), fade = 1.0 - smoothstep(0.35, 0.9, uOpening);
    for (int j = -1; j <= 1; j++) {
      float hs = hr + float(j);
      for (int k = 0; k < 3; k++) {
        vec2 id = vec2(mod(hs + 12.0, 12.0), float(k));
        float sa = aw - (vh(id + 5.3) - 0.5) * 0.9 * u2;                 // its turn
        float sr = r - u2 * (0.7 + 0.6 * vh(id + 2.7)) * 1.4;            // flung outward
        float r0 = float(k) * ring;
        if (sr < r0 || sr >= r0 + ring || sr <= 0.0 || floor(sa / hw) != hs || dither >= fade) continue;
        float lit;
        vec2 sp = vec2(sin(sa), cos(sa)) * sr;
        vec3 c = face(sp, uMode, uShut, lit);
        if (min(sr - r0, r0 + ring - sr) < 0.006 || min(fract(sa / hw), 1.0 - fract(sa / hw)) * sr * hw < 0.006) c *= 0.35;
        o = px(c, 1.0);
        return;
      }
    }
  }
  if (r > poly || shut) {
    float lit;
    vec3 c = shut && r < ${f4(SD_VEIL_FACE_R)} ? face(p, uMode, uShut, lit) : blades(p, twist, uMode);
    o = px(c, 1.0);
    return;
  }
  // what the blades have not yet taken: tinted toward the Hour's brass (silver, out of it) as they close
  o = px((uMode < 0.5 ? vec3(0.22, 0.15, 0.04) : vec3(0.14, 0.15, 0.18)), cover * 0.5);
}`;

/** The Hour's veil, one triangle over the veil's canvas. `draw(w, h, t, v, look)` - `v` a veilAt answer, `look`
 *  `{ mode, centre, shut, opening, mend, shatter, reduce }`. */
export class SdVeilRenderer {
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`, SD_VEIL_FS, 'sd veil');
    this.u = {};
    for (const n of ['uRes', 'uTime', 'uCover', 'uShut', 'uOpening', 'uCentre', 'uMode', 'uMend', 'uShatter', 'uReduce']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
  }
  draw(w, h, t, v, look) {
    const gl = this.gl, U = this.u;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uCover, v.cover);
    gl.uniform1f(U.uShut, look.shut ?? 0);
    gl.uniform1f(U.uOpening, look.opening ?? 0);
    gl.uniform2f(U.uCentre, look.centre?.[0] ?? 0, look.centre?.[1] ?? 0);
    gl.uniform1f(U.uMode, look.mode ?? SD_VEIL_MODE.in);
    gl.uniform1f(U.uMend, look.mend ?? 0);
    gl.uniform1f(U.uShatter, look.shatter ?? 0);
    gl.uniform1f(U.uReduce, look.reduce ? 1 : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
  }
}
