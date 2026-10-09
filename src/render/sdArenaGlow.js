// @ts-check
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 9): THE LAST MOMENT'S ARENA, READ - one foreign
// pass over the arena's dark bronze (premultiplied, depth-tested, never written, fogged, the pixel law's cells), drawn
// by the dungeon arm with the Hour's telegraphs. It tells the fight's clock-blows through the floor, never as a second
// telegraph:
//
//   THE FISSURES - eight bold cracks from the boss to the rim (`SD_FISSURES`, a distance field baked once into a 256 R8
//     texture: one tap a fragment), dark, the Mantella barely alight deep in them. ON EVERY MANTELLA PULSE, AT ITS
//     LANDING, they flood green from the centre outward (SD_FLOOD.front_s) and fade (SD_FLOOD.fade_s) - the Hour's
//     heartbeat felt through the floor.
//   THE RIM'S NUMERALS - twelve Roman numerals round the rim (the sky's own glyphs, render/sdSky.js SD_NUMERAL_GLSL),
//     foot to the boss, so a raid can call "to IX!"; at rest a brass glint. THE RESET IS COUNTED ON THEM: over its
//     wind-up they light one by one in its soul-white, the last two in ember, and when XII lights it lands.
//   THE HOUR ENDS - every fissure and numeral red.
//
// What it reads of the fight is `sdArenaGlowAt` (pure over the page's fight state - net/sdFightLink.js - and the clock):
// the Pulse's landing (kept: the clock's blow is replaced by the next), the Reset's wind-up, the End. The same word for
// the Hour's sky (`sdHourClockOf`, render/sdSky.js uClock): the hands sweep to XII with the numerals.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from './orderedDither.js';
import { SD_NUMERAL_GLSL, SD_SKY_MODE } from './sdSky.js';
import { SD_ARENA } from '../net/sdBrain.js';
import { SD_BLOWS } from '../net/sdRemnant.js';

/** The fissures: how many, their reach (m from the boss: from, to), the jag of their runs (m), and the field's texels a
 *  side and its reach (m - the field saturates past it). */
export const SD_FISSURES = Object.freeze({ n: 8, from: 1.6, to: SD_ARENA.r - 1.2, steps: 14, jag: 0.55, size: 256, reach: 2 });
/** The flood on a Pulse's landing: its front's run from the boss to the rim, then its fading (s). */
export const SD_FLOOD = Object.freeze({ front_s: 0.4, fade_s: 1.2 });
/** The rim's numerals: their ring (m from the boss) and a glyph cell (m). */
export const SD_ARENA_NUMERALS = Object.freeze({ r: SD_ARENA.r - 2.1, cell: 0.16 });
/** The floor's cells (m) - the pixel law's chunk at the arena's scale. */
export const SD_ARENA_CELL_M = 0.08;
/** How many of the Reset's numerals light in ember (the last). */
export const SD_RESET_EMBER = 2;

/** mulberry32 (world/sdPixelKit.js's). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The fissures' runs, in the arena's frame (x, z m): each from near the boss to near the rim on its own bearing (one each
 *  eighth, nudged), jagged by a seeded walk. Pure: the same on every page. */
export function sdFissurePaths(seed = 0x5d26) {
  const F = SD_FISSURES, r = rng(seed), out = [];
  for (let i = 0; i < F.n; i++) {
    const a0 = ((i + 0.5) / F.n) * Math.PI * 2 + (r() - 0.5) * 0.35, run = [];
    let side = 0;
    for (let k = 0; k <= F.steps; k++) {
      const rr = F.from + ((F.to - F.from) * k) / F.steps;
      side = k === 0 ? 0 : Math.max(-1.6, Math.min(1.6, side + (r() - 0.5) * 2 * F.jag));
      const a = a0 + side / rr;
      run.push([Math.sin(a) * rr, Math.cos(a) * rr]);
    }
    out.push(run);
  }
  return out;
}
/** The fissures' distance field over the arena's disc: SD_FISSURES.size texels a side over [-r, r] (x across, z up the
 *  image), each the distance to the nearest run over SD_FISSURES.reach, 0..255 (R8). */
export function sdFissureField(paths = sdFissurePaths()) {
  const F = SD_FISSURES, N = F.size, R = SD_ARENA.r, data = new Uint8Array(N * N);
  const segs = paths.flatMap((run) => run.slice(1).map((b, k) => [run[k], b]));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = ((x + 0.5) / N) * 2 * R - R, pz = ((y + 0.5) / N) * 2 * R - R;
    let d = Infinity;
    for (const [a, b] of segs) {
      const bx = b[0] - a[0], bz = b[1] - a[1], h = Math.max(0, Math.min(1, ((px - a[0]) * bx + (pz - a[1]) * bz) / (bx * bx + bz * bz)));
      d = Math.min(d, Math.hypot(px - a[0] - bx * h, pz - a[1] - bz * h));
    }
    data[y * N + x] = Math.round(Math.min(1, d / F.reach) * 255);
  }
  return { size: N, data };
}

const RESET = SD_BLOWS.reset, PULSE = SD_BLOWS.pulse, END = SD_BLOWS.end;
/**
 * WHAT THE ARENA'S FLOOR TELLS at `t` of the fight state `s` (net/sdFightLink.js state(); null - none): `memo`, filled and
 * answered - `{ flood: the front's reach (m, < 0 none), floodK: its strength 0..1, reset: numerals lit (-1 none), end:
 * 0|1, pulseAt }`. The Pulse's landing is kept in `memo` (the clock's blow is replaced by the next), so a flood plays out
 * once landed; a stun takes the Reset's count out. Nothing made (the frame's).
 */
export function sdArenaGlowAt(s, t, memo) {
  memo.flood = -1; memo.floodK = 0; memo.reset = -1; memo.end = 0;
  if (!s || s.fell) return memo;
  const clk = s.clk;
  if (clk && clk.a === PULSE.id && clk.at > (memo.pulseAt ?? -Infinity)) memo.pulseAt = clk.at;   // its landing, before or after: the age says
  const age = (t - (memo.pulseAt ?? -Infinity)) / 1000;
  if (age >= 0 && age < SD_FLOOD.front_s + SD_FLOOD.fade_s) {
    memo.flood = Math.min(1, age / SD_FLOOD.front_s) * SD_ARENA.r;
    memo.floodK = age < SD_FLOOD.front_s ? 1 : 1 - (age - SD_FLOOD.front_s) / SD_FLOOD.fade_s;
  }
  const atk = s.rem?.atk;
  if (atk && atk.a === RESET.id && t < atk.at + RESET.active && !(s.su > t)) {
    const called = atk.at - RESET.windup;
    memo.reset = t >= atk.at ? 12 : Math.max(0, Math.min(12, Math.floor(((t - called) / RESET.windup) * 12) + 1));
  }
  if (s.lost || (clk && clk.a === END.id) || (Number.isFinite(s.ends) && t >= s.ends - END.windup)) memo.end = 1;
  return memo;
}
/**
 * THE HOUR'S SKY'S WORD FOR THE FIGHT (render/sdSky.js uClock) at `t` of `s`, into `out` (4 floats): the End, the
 * Reset's hands sweeping to XII (its share of the wind-up), the Dragon Break while the Echoes stand, or the living
 * fight's share of its Hour burnt and whether its last minute has come; none once it has fallen.
 */
export function sdHourClockOf(s, t, out) {
  out[0] = SD_SKY_MODE.none; out[1] = 0; out[2] = 0; out[3] = 0;
  if (!s || s.fell || !(t >= s.op)) return out;
  const atk = s.rem?.atk;
  if (s.lost || s.clk?.a === END.id || (Number.isFinite(s.ends) && t >= s.ends - END.windup)) out[0] = SD_SKY_MODE.end;
  else if (atk && atk.a === RESET.id && t < atk.at && !(s.su > t)) { out[0] = SD_SKY_MODE.reset; out[1] = Math.max(0, Math.min(1, (t - (atk.at - RESET.windup)) / RESET.windup)); }
  else if ((s.ec ?? []).some((E) => E.h > 0)) out[0] = SD_SKY_MODE.break;
  else if (Number.isFinite(s.ends) && s.ends > s.op) { out[0] = SD_SKY_MODE.fight; out[1] = Math.max(0, Math.min(1, (t - s.op) / (s.ends - s.op))); out[2] = s.ends - t <= 60_000 ? 1 : 0; }
  return out;
}

const HEAD = `#version 300 es
precision highp float;
`;
export const SD_ARENA_GLOW_VS = HEAD + `layout(location = 0) in vec2 aDisc;
uniform mat4 uView, uProj, uModel;
uniform float uR;
out vec2 vP;
out vec3 vWorld;
void main() {
  vP = aDisc * uR;
  vec4 w = uModel * vec4(vP.x, 0.015, vP.y, 1.0);
  vWorld = w.xyz;
  gl_Position = uProj * uView * w;
}`;
export const SD_ARENA_GLOW_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
uniform sampler2D uField;
uniform float uR;
uniform vec2 uFlood;     // the Pulse's front (m, < 0 none) and its strength
uniform float uReset;    // the Reset's numerals lit (-1 none)
uniform float uEnd;      // the Hour ends: red
uniform float uSteps;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
out vec4 o;
${BAYER_GLSL}${SD_PIXEL_GLSL}${FOG_FACTOR_GLSL}${SD_NUMERAL_GLSL}
const float TAU = 6.283185307179586;
const vec3 MANTELLA = vec3(0.45, 1.0, 0.6);
const vec3 SOUL = vec3(0.6, 1.0, 0.82);
const vec3 EMBER = vec3(1.0, 0.376, 0.157);
const vec3 RED = vec3(1.0, 0.32, 0.26);
const vec3 BRASS = vec3(0.85, 0.62, 0.27);
// numeral h's glyph at p (m, the arena's frame): foot to the boss, on the rim's ring
float numeralAt(vec2 p, int h) {
  float a = float(h) * TAU / 12.0;
  vec2 out_ = vec2(sin(a), cos(a)), side = vec2(cos(a), -sin(a));
  vec2 q = p - out_ * ${SD_ARENA_NUMERALS.r.toFixed(3)};
  vec2 lc = vec2(dot(q, side), dot(q, out_)) / ${SD_ARENA_NUMERALS.cell.toFixed(3)};
  int cx = int(floor(lc.x + float(numeralWidth(h)) * 0.5)), cy = int(floor(3.5 - lc.y));
  return (cx >= 0 && cx < numeralWidth(h)) ? numeralLit(h, cx, cy) : 0.0;
}
void main() {
  vec2 cell = floor(vP / ${SD_ARENA_CELL_M.toFixed(3)});
  vec2 p = (cell + 0.5) * ${SD_ARENA_CELL_M.toFixed(3)};
  float r = length(p);
  if (r > uR) discard;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  // the fissures: a dark crack, the Mantella barely alight in it - flooded by the Pulse, red when the Hour ends
  float d = texture(uField, p / (2.0 * uR) + 0.5).r * ${SD_FISSURES.reach.toFixed(2)};
  float crack = 1.0 - smoothstep(0.16, 0.34, d), core = 1.0 - smoothstep(0.02, 0.14, d);
  if (crack > 0.0) {
    alpha = 0.6 * crack;
    col = MANTELLA * 0.12 * core;
    if (uFlood.x >= 0.0 && r <= uFlood.x) {
      float lip = 1.0 - smoothstep(0.0, 1.6, uFlood.x - r);   // the front brightest
      col += MANTELLA * uFlood.y * (0.75 * core + 0.35 * crack + 0.5 * lip * crack);
    }
    if (uEnd > 0.5) col = max(col, RED * (0.55 * core + 0.25 * crack));
  }
  // the rim's numerals: a brass glint; the Reset counts on them; red when the Hour ends
  if (abs(r - ${SD_ARENA_NUMERALS.r.toFixed(3)}) < 0.8) {
    int h = int(mod(floor(mod(atan(p.x, p.y) + TAU, TAU) / (TAU / 12.0) + 0.5), 12.0));
    if (numeralAt(p, h) > 0.5) {
      // the count: I first, XII last (it lands as XII lights)
      int order = h == 0 ? 12 : h;
      vec3 g = BRASS * 0.22;
      if (uReset >= 0.0 && float(order) <= uReset) g = order > ${12 - SD_RESET_EMBER} ? EMBER : SOUL;
      if (uEnd > 0.5) g = RED;
      col = g; alpha = 0.0;
    }
  }
  col *= fogFactorAt(vWorld);
  o = vec4(sdPixel(col, cell, uSteps), alpha);
}`;

/** The pass: one disc over the arena's floor. */
export class SdArenaGlowRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, SD_ARENA_GLOW_VS, SD_ARENA_GLOW_FS, 'sd arena glow');
    this.u = {};
    for (const n of ['uView', 'uProj', 'uModel', 'uR', 'uField', 'uFlood', 'uReset', 'uEnd', 'uSteps', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFogColor']) this.u[n] = gl.getUniformLocation(this.prog, n);
    const fan = [], n = 64;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      fan.push(0, 0, Math.sin(a1), Math.cos(a1), Math.sin(a0), Math.cos(a0));
    }
    this.count = fan.length / 2;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fan), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    const f = sdFissureField();
    this.field = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.field);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, f.size, f.size, 0, gl.RED, gl.UNSIGNED_BYTE, f.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._flood = new Float32Array(2);
  }
  /** Draw over the arena's floor at `model` (its centre, the realm's frame into the dungeon's) what `look`
   *  (sdArenaGlowAt's) says, in `fog`, at the pixel law's `steps`. Answers whether it drew. */
  draw(proj, view, model, look, fog = null, steps = 10) {
    const gl = this.gl, U = this.u;
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(U.uView, false, view); gl.uniformMatrix4fv(U.uProj, false, proj); gl.uniformMatrix4fv(U.uModel, false, model);
    gl.uniform1f(U.uR, SD_ARENA.r);
    this._flood[0] = look.flood; this._flood[1] = look.floodK;
    gl.uniform2fv(U.uFlood, this._flood); gl.uniform1f(U.uReset, look.reset); gl.uniform1f(U.uEnd, look.end); gl.uniform1f(U.uSteps, steps);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0); gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? [0, 1]); gl.uniform3fv(U.uCamPos, fog?.camPos ?? [0, 0, 0]); gl.uniform3fv(U.uFogColor, fog?.color ?? [0, 0, 0]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.field); gl.uniform1i(U.uField, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE);
    return true;
  }
  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this.field); gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
  }
}
