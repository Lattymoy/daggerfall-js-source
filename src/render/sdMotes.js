// @ts-check
// SD14c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7 and section 16's SD14c;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S MOTES - the air of the Shattered Hour made
// visible. The Deadlands' air carries 896 (render/deadlands.js lifeVertices: embers off the sea and its braziers, ash
// falling); the Hour carried none. Four kinds, SD_MOTES_TOTAL of them, each a point drawn after the realm's solid
// geometry, depth-tested and never written, added onto the frame in the Hour's own colours and its fog:
//
//   BRASS DUST in the hall - specks turning slowly round the Orrery as its stones do, rising and settling;
//   SPARKS OUT OF THE VOID under the Steps - gold rising from far below the course, cooling as they climb, gone by
//     the height a body stands at;
//   THE HOUR'S MOTES over the arena - slow gold-green lights (the Mantella's) orbiting its centre against the clock,
//     breathing;
//   THE SHARDS' DUST high over everything - glints falling slowly out of the broken sky.
//
// Every mote is a pure function of its seeded draws and the Hour's clock (the sky's: world.js deadlandsSeconds, wrapped
// at SD_SKY_PERIOD - every rate a whole number of turns over it), so every screen sees the same air at the same moment.
// `sdMoteAt` is the shader's own law in JS, for the tests. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { SD_SKY_PERIOD } from './sdSky.js';
import { SD_REALM_ORIGIN, SD_ORRERY, SD_ARENA } from '../net/sdBrain.js';
import { SD_FIRST_STEP } from '../world/sdHall.js';
import { SD_COURSE_END } from '../world/sdSteps.js';

/** How many of each kind: the hall's dust, the void's sparks, the arena's motes, the shards' dust. */
export const SD_MOTES = Object.freeze({ dust: 320, sparks: 360, hour: 300, shards: 240 });
export const SD_MOTES_TOTAL = SD_MOTES.dust + SD_MOTES.sparks + SD_MOTES.hour + SD_MOTES.shards;
/** Each kind's span of whole turns (lives) over the period - every mote's own, drawn from it. */
export const SD_MOTE_TURNS = Object.freeze({ dust: [24, 40], sparks: [60, 110], hour: [6, 12], shards: [20, 36] });
/** Where they live, in the realm's frame: the hall's ring and height; the void's band under the course (its x half
 *  width, its z from the first step to the course's end, how deep they rise from and how high they reach); the arena's
 *  ring and height; the shards' sky. */
export const SD_MOTE_HALL = Object.freeze({ r: SD_ORRERY.r + 4, y: [0.4, 7] });
export const SD_MOTE_VOID = Object.freeze({ halfW: 14, z: [SD_FIRST_STEP.z, 0], y: [-26, 1.5] });
export const SD_MOTE_ARENA = Object.freeze({ r: [4, SD_ARENA.r + 4], y: [1, 12] });
export const SD_MOTE_SKY = Object.freeze({ r: 140, y: [14, 46] });
/** The least a mote is drawn across (px); smaller, it is faded by how much (`sdMotePx`). */
export const SD_MOTE_MIN_PX = 2;
/** A mote of `size` m `w` m off at `pxPerM`: drawn across (px) and the share of its light kept - the shader's own. Pure. */
export function sdMotePx(size, w, pxPerM) {
  const px = (size * pxPerM) / Math.max(w, 0.1);
  return { px: Math.min(32, Math.max(SD_MOTE_MIN_PX, px)), keep: Math.max(0, Math.min(1, px / SD_MOTE_MIN_PX)) };
}
const TAU = Math.PI * 2;
const voidZ1 = () => (Number.isFinite(SD_COURSE_END) ? SD_COURSE_END : SD_ARENA.z - SD_ARENA.r);

/** One vertex a mote: kind (0 dust, 1 sparks, 2 the Hour's, 3 the shards'), three draws in [0, 1). Seeded, pure. */
export function sdMoteVertices(seed = 0x5d14c) {
  let x = seed >>> 0;
  const r = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  const out = [];
  [SD_MOTES.dust, SD_MOTES.sparks, SD_MOTES.hour, SD_MOTES.shards].forEach((n, kind) => { for (let i = 0; i < n; i++) out.push(kind, r(), r(), r()); });
  return new Float32Array(out);
}

const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

/**
 * THE LAW, the shader's own in JS: where mote (kind, a, b, c) stands at clock time `t` (s) in the realm's frame, its
 * size (m), its alpha and its warmth (0 cold, 1 hot) - `{ p: [x, y, z], size, alpha, heat }`. Pure.
 */
export function sdMoteAt(kind, a, b, c, t) {
  const T = ((t % SD_SKY_PERIOD) + SD_SKY_PERIOD) % SD_SKY_PERIOD;
  /** @param {readonly number[]} s @param {number} u */
  const turnsOf = (s, u) => Math.floor(s[0] + u * (s[1] - s[0]));
  if (kind === 0) {
    // the hall's dust: a ring turning once a period (the Orrery's own way round), each speck bobbing
    const life = SD_SKY_PERIOD / turnsOf(SD_MOTE_TURNS.dust, a), u = ((T + b * life) % life) / life;
    const ang = c * TAU + (T / SD_SKY_PERIOD) * TAU, rad = Math.sqrt(a) * SD_MOTE_HALL.r;
    const y = SD_MOTE_HALL.y[0] + (SD_MOTE_HALL.y[1] - SD_MOTE_HALL.y[0]) * (0.5 + 0.5 * Math.sin(u * TAU + c * 9));
    return { p: [SD_ORRERY.x + Math.cos(ang) * rad, y, SD_ORRERY.z + Math.sin(ang) * rad], size: 0.05 + 0.05 * b, alpha: 0.35 + 0.35 * Math.sin(u * Math.PI), heat: 0.3 };
  }
  if (kind === 1) {
    // the void's sparks: up out of the dark under the course, cooling, gone by the height a body stands at
    const life = SD_SKY_PERIOD / turnsOf(SD_MOTE_TURNS.sparks, a), u = ((T + b * life) % life) / life;
    const z0 = SD_MOTE_VOID.z[0], z1 = voidZ1();
    const x = (c * 2 - 1) * SD_MOTE_VOID.halfW + Math.sin(u * TAU + a * 20) * 0.8;
    const y = SD_MOTE_VOID.y[0] + (SD_MOTE_VOID.y[1] - SD_MOTE_VOID.y[0]) * u;
    return { p: [x, y, z0 + (z1 - z0) * ((a * 7.31 + b * 3.7) % 1)], size: 0.12 + 0.12 * c, alpha: Math.min(1, u * 8) * (1 - u) * (1 - u), heat: 1 - u };
  }
  if (kind === 2) {
    // the Hour's motes: orbiting the arena's centre AGAINST the clock, breathing
    const turns = turnsOf(SD_MOTE_TURNS.hour, a), ang = c * TAU - (T / SD_SKY_PERIOD) * turns * TAU;
    const rad = SD_MOTE_ARENA.r[0] + (SD_MOTE_ARENA.r[1] - SD_MOTE_ARENA.r[0]) * Math.sqrt(b);
    const y = SD_MOTE_ARENA.y[0] + (SD_MOTE_ARENA.y[1] - SD_MOTE_ARENA.y[0]) * ((a * 5.17 + c * 2.3) % 1);
    return { p: [SD_ARENA.x + Math.cos(ang) * rad, y, SD_ARENA.z + Math.sin(ang) * rad], size: 0.16 + 0.1 * a, alpha: 0.4 + 0.3 * Math.sin((T / SD_SKY_PERIOD) * turns * 4 * TAU + b * 11), heat: 0.55 };
  }
  // the shards' dust: falling slowly out of the sky over everything
  const life = SD_SKY_PERIOD / turnsOf(SD_MOTE_TURNS.shards, a), u = ((T + b * life) % life) / life;
  const ang = c * TAU, rad = Math.sqrt((a * 13.7 + c) % 1) * SD_MOTE_SKY.r;
  const centreZ = (SD_ORRERY.z + SD_ARENA.z) / 2;
  return { p: [Math.cos(ang) * rad, SD_MOTE_SKY.y[1] - u * (SD_MOTE_SKY.y[1] - SD_MOTE_SKY.y[0]), centreZ + Math.sin(ang) * rad], size: 0.3 + 0.3 * b, alpha: Math.min(1, u * 10) * (1 - u), heat: 0.15 };
}

export const SD_MOTES_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSeed;   // kind, three draws in [0, 1)
uniform mat4 uVP;
uniform vec3 uOrigin;      // the realm's origin in the dungeon's frame (net/sdBrain.js SD_REALM_ORIGIN)
uniform float uTime;       // the Hour's clock, wrapped at the period
uniform float uPxPerM;     // pixels a metre at one metre off
out float vHeat;
out float vAlpha;
out float vKind;
out vec3 vWorld;
const float PERIOD = ${f(SD_SKY_PERIOD)};
const float TAU = 6.283185307179586;
float turnsOf(vec2 s, float u) { return floor(s.x + u * (s.y - s.x)); }
void main() {
  float a = aSeed.y, b = aSeed.z, c = aSeed.w, T = uTime;
  vec3 p; float size;
  if (aSeed.x < 0.5) {
    float life = PERIOD / turnsOf(vec2(${f(SD_MOTE_TURNS.dust[0])}, ${f(SD_MOTE_TURNS.dust[1])}), a), u = mod(T + b * life, life) / life;
    float ang = c * TAU + T / PERIOD * TAU, rad = sqrt(a) * ${f(SD_MOTE_HALL.r)};
    float y = ${f(SD_MOTE_HALL.y[0])} + ${f(SD_MOTE_HALL.y[1] - SD_MOTE_HALL.y[0])} * (0.5 + 0.5 * sin(u * TAU + c * 9.0));
    p = vec3(${f(SD_ORRERY.x)} + cos(ang) * rad, y, ${f(SD_ORRERY.z)} + sin(ang) * rad);
    size = 0.05 + 0.05 * b; vAlpha = 0.35 + 0.35 * sin(u * 3.141592653589793); vHeat = 0.3;
  } else if (aSeed.x < 1.5) {
    float life = PERIOD / turnsOf(vec2(${f(SD_MOTE_TURNS.sparks[0])}, ${f(SD_MOTE_TURNS.sparks[1])}), a), u = mod(T + b * life, life) / life;
    float x = (c * 2.0 - 1.0) * ${f(SD_MOTE_VOID.halfW)} + sin(u * TAU + a * 20.0) * 0.8;
    float y = ${f(SD_MOTE_VOID.y[0])} + ${f(SD_MOTE_VOID.y[1] - SD_MOTE_VOID.y[0])} * u;
    p = vec3(x, y, ${f(SD_MOTE_VOID.z[0])} + ${f(voidZ1() - SD_MOTE_VOID.z[0])} * fract(a * 7.31 + b * 3.7));
    size = 0.12 + 0.12 * c; vAlpha = min(1.0, u * 8.0) * (1.0 - u) * (1.0 - u); vHeat = 1.0 - u;
  } else if (aSeed.x < 2.5) {
    float turns = turnsOf(vec2(${f(SD_MOTE_TURNS.hour[0])}, ${f(SD_MOTE_TURNS.hour[1])}), a), ang = c * TAU - T / PERIOD * turns * TAU;
    float rad = ${f(SD_MOTE_ARENA.r[0])} + ${f(SD_MOTE_ARENA.r[1] - SD_MOTE_ARENA.r[0])} * sqrt(b);
    float y = ${f(SD_MOTE_ARENA.y[0])} + ${f(SD_MOTE_ARENA.y[1] - SD_MOTE_ARENA.y[0])} * fract(a * 5.17 + c * 2.3);
    p = vec3(${f(SD_ARENA.x)} + cos(ang) * rad, y, ${f(SD_ARENA.z)} + sin(ang) * rad);
    size = 0.16 + 0.1 * a; vAlpha = 0.4 + 0.3 * sin(T / PERIOD * turns * 4.0 * TAU + b * 11.0); vHeat = 0.55;
  } else {
    float life = PERIOD / turnsOf(vec2(${f(SD_MOTE_TURNS.shards[0])}, ${f(SD_MOTE_TURNS.shards[1])}), a), u = mod(T + b * life, life) / life;
    float ang = c * TAU, rad = sqrt(fract(a * 13.7 + c)) * ${f(SD_MOTE_SKY.r)};
    p = vec3(cos(ang) * rad, ${f(SD_MOTE_SKY.y[1])} - u * ${f(SD_MOTE_SKY.y[1] - SD_MOTE_SKY.y[0])}, ${f((SD_ORRERY.z + SD_ARENA.z) / 2)} + sin(ang) * rad);
    size = 0.3 + 0.3 * b; vAlpha = min(1.0, u * 10.0) * (1.0 - u); vHeat = 0.15;
  }
  vKind = aSeed.x;
  vWorld = uOrigin + p;
  vec4 cp = uVP * vec4(vWorld, 1.0);
  gl_Position = cp;
  // a mote under SD_MOTE_MIN_PX across is drawn that wide and faded by how much smaller it is: a one-pixel point whose
  // pixel's centre fell outside its disc was dropped, so the far air flickered and thinned (the probe's measure)
  float px = size * uPxPerM / max(cp.w, 0.1);
  gl_PointSize = clamp(px, ${f(SD_MOTE_MIN_PX)}, 32.0);
  vAlpha *= clamp(px / ${f(SD_MOTE_MIN_PX)}, 0.0, 1.0);
}`;
export const SD_MOTES_FS = `#version 300 es
precision highp float;
in float vHeat;
in float vAlpha;
in float vKind;
in vec3 vWorld;
uniform float uGain;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = dot(q, q);
  if (d > 1.0 || vAlpha <= 0.001) discard;
  float core = exp(-d * 5.0), halo = exp(-d * 1.6) * 0.35;
  // brass going to gold as it warms; the Hour's own a gold-green (the Mantella's); the shards' a pale glint
  vec3 col = mix(vec3(0.55, 0.36, 0.14), vec3(1.0, 0.82, 0.42), vHeat);
  if (vKind > 1.5 && vKind < 2.5) col = vec3(0.72, 0.95, 0.55);
  if (vKind > 2.5) col = vec3(0.86, 0.84, 0.74);
  o = vec4(col * (core * 1.3 + halo) * vAlpha * fogFactorAt(vWorld) * uGain, 1.0);
}`;

function mul4(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

/** The Hour's motes on a GL2 context: built once, drawn each frame in the realm's world pass. */
export class SdMotesRenderer {
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, SD_MOTES_VS, SD_MOTES_FS);
    this.u = {};
    for (const n of ['uVP', 'uOrigin', 'uTime', 'uPxPerM', 'uGain', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.count = SD_MOTES_TOTAL;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, sdMoteVertices(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** what the last draw drew, for the tests: the count of points */
    this.drawn = 0;
  }

  /**
   * The motes, depth-tested and never written, added onto the frame - after the realm's solid geometry, in its fog
   * (`fog` the renderer's as it set it) and at the sky's light (`gain`). `viewH` the world image's height in pixels.
   */
  draw(proj, view, seconds, fog = null, gain = 1, viewH = 0) {
    const gl = this.gl;
    this.drawn = 0;
    if (!Number.isFinite(seconds)) return false;
    const U = this.u;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(U.uVP, false, mul4(this._vp, proj, view));
    gl.uniform3fv(U.uOrigin, SD_REALM_ORIGIN);
    gl.uniform1f(U.uTime, ((seconds % SD_SKY_PERIOD) + SD_SKY_PERIOD) % SD_SKY_PERIOD);
    gl.uniform1f(U.uPxPerM, (Math.max(1, viewH || gl.drawingBufferHeight || 720) * proj[5]) / 2);
    gl.uniform1f(U.uGain, gain);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? [0, 1]);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? [0, 0, 0]);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.drawn = this.count;
    return true;
  }
}
