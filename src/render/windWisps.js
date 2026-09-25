// @ts-check
// WIND3 (2026-09-14, Mac: "World space wisps that indicate the direction
// of wind") - THE WISPS: the wind, seen.
//
// A wisp is a faint streak of air riding the wind: a thin quad stretched
// along the wind's own velocity, born and gone over a couple of seconds
// (a fade in and out on its own phase, so the field is never a rigid
// sheet), wobbling a little as it goes. They live in a box that follows
// the eye and WRAPS (the lab's law from the rain: `p = mod(p - uEye +
// uBox*0.5, uBox) + uEye - uBox*0.5`, so moving reveals other wisps and
// never drags the ones in view), and they travel by the ONE integrated
// wind (systems/windDrive.js `step`, PROTO-19's law: a distance already
// travelled, never wind x time). The count and the alpha follow the
// wind's STRENGTH - a few faint ones in a breeze, the air full of them
// in a gale - with a floor, because the point of them is to be read: a
// player looks up from the map and knows which way it blows before the
// grass tells them.
//
// A sibling of PrecipitationRenderer: its own program, its own instanced
// VAO, drawn after the rain with alpha blend, depth-tested against the
// world, no depth write, unfogged (the box hugs the eye inside any fog's
// near field). The hosts call markForeignPass() after it, as they do
// after the rain (EV6). ENHANCED ONLY, behind its own row (`wind-wisps`
// on the Features home, the pref `windWisps`, the player's own online);
// `?wisps=off` is the kill door.
//
// WISPS-RETURN (2026-09-25, Mac: "I want to return to the original wind
// wisps before our current design"): the streak is back. WIND5
// (2026-09-23) had made each wisp a calligraphic flourish - a 40-segment
// ribbon along an arched or S stroke that ended in a tightening curl,
// drawn on and off along its path. That design is retired whole (the
// path, the pen, the ink, the ribbon and the curl uniform), and a wisp is
// WIND3's thin quad along the wind again, with WIND3's streak length and
// fade. Kept, because they were asks about the amount and the visibility,
// or fixes, and not the design: DISC17-A's count (120 at a gale, 10 in a
// calm) and alpha (0.20/0.24), AUDIT-VC7's whole clock, AUDIT 68's exact
// wrap and its one compile-and-link. The sandstorm's grains were always
// the straight quad and draw as they did.

import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { buildProgram } from './glProgram.js';   // AUDIT 68 S17-gl-program-dup: the one compile and link

/** A JS number as a GLSL float literal (`${1}` is an int to the compiler): the clock's and the gust's derived
 *  literals below. */
const glslF = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
/** AUDIT-VC7 (G6): THE WISPS' CLOCK. uTime is a 32-bit float, and the hosts hand it the page's seconds: ten hours in
 *  its step is 1/256 s, and a life's phase, fract(uTime * rate), moves in steps a quarter of a frame's advance - the
 *  fade and the wobble stutter, and it only gets worse. So every rate the shader runs is a whole number of cycles
 *  over WISP_CLOCK_PERIOD seconds - the wobble's three at 2 pi WISP_WOBBLE_CYCLES over it (0.895, 0.707 and 0.597
 *  radians a second, the 0.9, 0.7 and 0.6 they were), a life's from 0.35 to 0.6 a second in WISP_RATE_STEPS steps
 *  (140 to 240 lives over it) - and the clock is handed wrapped to that period (wispClock, in double precision):
 *  every phase runs on across the wrap unbroken, and uTime is never past 400. */
export const WISP_CLOCK_PERIOD = 400;
export const WISP_WOBBLE_CYCLES = Object.freeze([57, 45, 38]);
export const WISP_RATE_STEPS = 100;
export const wispClock = (seconds) => ((seconds % WISP_CLOCK_PERIOD) + WISP_CLOCK_PERIOD) % WISP_CLOCK_PERIOD;
/** AUDIT 68 S17-wisp-wrap-gust: THE GUST'S DENOMINATOR. A wisp rides windOff x gust; a gust of k / WISP_GUST_DIV
 *  (k 32..48, 0.8..1.2) makes the travel's wrap at box x WISP_GUST_DIV move every wisp a whole number of boxes, which
 *  the eye-box mod removes. A continuous gust wrapped at one box jumped each wisp up to a fifth of the box. */
export const WISP_GUST_DIV = 40;

const HEAD = `#version 300 es
precision highp float;
`;

export const WISP_VS = HEAD + `layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSeed;      // x,y,z in the box + phase
uniform mat4 uVP; uniform vec3 uEye;
uniform float uTime, uBox, uStrength;
uniform vec2 uWindV, uWindOff, uLen;   // WEATHER2d: the look's streak length (base, spread)
out float vT; out float vLife;
void main(){
  float seed = aSeed.w;
  vec3 p = aSeed.xyz;
  // every wisp takes its own share of the wind, so the field is not one
  // rigid direction (the rain's per-drop gust, PROTO-9)
  float gust = (${glslF(WISP_GUST_DIV * 4 / 5)} + floor(fract(seed*3.7) * ${glslF(WISP_GUST_DIV * 2 / 5 + 1)})) / ${glslF(WISP_GUST_DIV)};   // AUDIT 68 S17-wisp-wrap-gust: 0.8..1.2 in whole 1/WISP_GUST_DIV steps
  p += vec3(uWindOff.x, 0.0, uWindOff.y) * gust;
  // a slow wobble across and along, phased per wisp
  p.y += sin(uTime*${glslF(2 * Math.PI * WISP_WOBBLE_CYCLES[0] / WISP_CLOCK_PERIOD)} + seed*31.0) * 0.35;   // AUDIT-VC7 (G6): whole cycles over the clock's period
  p.xz += vec2(cos(uTime*${glslF(2 * Math.PI * WISP_WOBBLE_CYCLES[1] / WISP_CLOCK_PERIOD)} + seed*17.0), sin(uTime*${glslF(2 * Math.PI * WISP_WOBBLE_CYCLES[2] / WISP_CLOCK_PERIOD)} + seed*23.0)) * 0.25;
  p = mod(p - uEye + uBox*0.5, uBox) + uEye - uBox*0.5;
  // born, brightest at half life, gone: a fade on the wisp's own clock
  float rate = 0.35 + floor(fract(seed*5.3) * ${glslF(WISP_RATE_STEPS)}) * ${glslF(0.25 / WISP_RATE_STEPS)};   // AUDIT-VC7 (G6): in steps, each a whole number of lives over the clock's period
  vLife = sin(fract(uTime*rate + seed*7.0) * 3.14159);
  // a streak along the wind's velocity, longer in a stronger wind
  vec3 drift = vec3(uWindV.x, 0.0, uWindV.y) * gust;
  float dl = length(drift);
  vec3 vel = dl > 1e-3 ? drift / dl : vec3(1.0, 0.0, 0.0);
  float len = (uLen.x + fract(seed*13.1)*uLen.y) * (0.5 + uStrength);
  float sz = 0.05 + fract(seed*11.7)*0.05;
  p += vel * (aCorner.y-0.5) * len;
  vec3 toEye = uEye - p;
  vec3 c0 = cross(vel, toEye);
  vec3 side = length(c0) > 1e-4 ? normalize(c0) : vec3(0.0, 1.0, 0.0);
  p += side * (aCorner.x-0.5) * sz;
  vT = aCorner.y;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const WISP_FS = HEAD + `in float vT; in float vLife;
uniform float uStrength;
uniform vec3 uColor;   // WEATHER2d: the look's colour
uniform vec2 uAlpha;   // WEATHER2d: the look's alpha (base, per strength)
out vec4 o;
void main(){
  // bright toward the head, faint at the tail; never more than a breath
  float a = smoothstep(0.0, 0.45, vT) * (1.0 - smoothstep(0.85, 1.0, vT));
  a *= vLife * (uAlpha.x + uAlpha.y * uStrength);
  o = vec4(uColor, a);
}`;

/** The box that follows the eye, metres a side (the rain's is 42; the
 *  wisps read from further, so the wind is legible over a field). */
export const WISP_BOX = 90;
/** The most wisps the field draws, at a gale.
 *
 *  WIND4 (2026-09-15, Mac: "the wind wisps are far too many and the
 *  amount should be reduced"). This was 2400 in a 90 m box - about one
 *  wisp per three cubic metres of the air in front of you at a gale,
 *  which reads as a fog of streaks rather than as wind. The field's
 *  job is to make the DIRECTION legible, and that is carried by a few
 *  streaks moving together, not by filling the box: 650 at a gale,
 *  and a calm that is nearly clear.
 *
 *  WIND5 (2026-09-23, Mac: "lets reduce the amount of wind streaks"): 240, each wisp then a flourish; a calm 19.
 *
 *  DISC17-A (2026-09-24, Mac: "I really want to give the wisps more opacity and reduce the amount of wind wisps"):
 *  120, half - fewer marks, each one twice as dark (WISP_LOOK's alpha); a calm keeps 10.
 *
 *  WISPS-RETURN (2026-09-25): the streak is back and this number stays. Mac asked for fewer twice, as the amount,
 *  and the return was to the design. */
export const WISP_MAX = 120;
/** The share of WISP_MAX drawn in a dead calm - the floor that keeps
 *  the direction readable. 0.08 of DISC17-A's maximum is 10 wisps (of
 *  WIND5's 240, 19; of WIND4's 650, 52), where 0.12 of the old was 288 - a still day should be still. */
export const WISP_FLOOR = 0.08;

/** WEATHER2d: A LOOK - the program in a dress. The wisps' own, and the
 *  sandstorm's: tan, dense, short streaks in a lower box, no floor (no
 *  sand without a storm), the front's intensity its strength. */
export const WISP_LOOK = Object.freeze({ color: Object.freeze([0.86, 0.89, 0.94]), alpha: Object.freeze([0.20, 0.24]), len: Object.freeze([1.6, 2.4]), count: WISP_MAX, floor: WISP_FLOOR, box: WISP_BOX });   // WISPS-RETURN: WIND3's streak length (WIND5's 2.6, 2.0 held a curl); DISC17-A's alpha kept (WIND3's 0.10, 0.12 doubled) - a gale's streak peaks at 0.44, a calm's at 0.20
export const SAND_LOOK = Object.freeze({ color: Object.freeze([0.80, 0.64, 0.40]), alpha: Object.freeze([0.28, 0.30]), len: Object.freeze([0.8, 1.2]), count: 7000, floor: 0, box: 70 });

/** How many wisps a wind of `strength01` draws: the floor plus the rest
 *  over a smoothstep of the strength. Pure. */
export function wispCount(strength01, look = WISP_LOOK) {
  const s = Math.max(0, Math.min(1, strength01));
  const u = Math.max(0, Math.min(1, (s - 0.05) / 0.85));
  const ss = u * u * (3 - 2 * u);
  return Math.round(look.count * (look.floor + (1 - look.floor) * ss));
}

/** The wisps' switch: the enhanced skin, the `windWisps` pref, and
 *  `?wisps=off` the kill door. Read once a frame by the exterior hosts. */
export function wispsOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('windWisps') && new URLSearchParams(search).get('wisps') !== 'off';
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export class WindWispsRenderer {
  /** Built by the enhanced lane at boot, so a shader fault is a
   *  constructor fault the boot probe sees (the rain's law). */
  constructor(gl, look = WISP_LOOK) {
    this.gl = gl;
    this.look = look;   // WEATHER2d
    const prog = buildProgram(gl, WISP_VS, WISP_FS);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uTime', 'uBox', 'uStrength', 'uWindV', 'uWindOff', 'uLen', 'uColor', 'uAlpha']) this.u[n] = gl.getUniformLocation(prog, n);
    // the instances: x,y,z in [0, BOX) + a phase, from one seeded
    // xorshift so the field is the same field every load
    const n = look.count, box = look.box;
    const inst = new Float32Array(n * 4);
    let s = 0x7a3d9f1b;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) { inst[i * 4] = rnd() * box; inst[i * 4 + 1] = rnd() * box; inst[i * 4 + 2] = rnd() * box; inst[i * 4 + 3] = rnd(); }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const q = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, q, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    this.vao = vao;
    /** the wind's travel so far, metres, integrated from windDrive's
     *  step each frame and kept inside box x WISP_GUST_DIV - every
     *  wisp's gust times that span is whole boxes, so the wrap moves no
     *  wisp (AUDIT 68 S17-wisp-wrap-gust), and a bounded number never
     *  loses precision over a long session (3600 m: a float32 step of
     *  a quarter millimetre) */
    this.windOff = new Float32Array(2);
    this._vp = new Float32Array(16);
    /** the count the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  /** Advance the travel by the frame's step and wrap it. */
  advance(step) {
    const period = this.look.box * WISP_GUST_DIV;   // AUDIT 68 S17-wisp-wrap-gust: a common period of every wisp's travel
    for (let i = 0; i < 2; i++) {
      let v = this.windOff[i] + (step?.[i] ?? 0);
      v = ((v % period) + period) % period;
      this.windOff[i] = v;
    }
  }

  /** Draw the frame's wisps for `wd` (systems/windDrive.js's answer):
   *  nothing when the deck is unknown. Advances the travel first. */
  draw(wd, proj, view, eye, timeSeconds) {
    this.drawn = 0;
    if (!wd?.on) return;
    this.advance(wd.step);
    const count = wispCount(wd.strength01, this.look);
    if (count <= 0) return;
    const gl = this.gl, U = this.u, look = this.look;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3fv(U.uEye, eye);
    gl.uniform1f(U.uTime, wispClock(timeSeconds));   // AUDIT-VC7 (G6): wrapped here, in double precision
    gl.uniform1f(U.uBox, look.box);
    gl.uniform1f(U.uStrength, wd.strength01);
    gl.uniform2f(U.uLen, look.len[0], look.len[1]); gl.uniform3fv(U.uColor, look.color); gl.uniform2f(U.uAlpha, look.alpha[0], look.alpha[1]);   // WEATHER2d: the look
    gl.uniform2f(U.uWindV, wd.windV[0], wd.windV[1]);
    gl.uniform2fv(U.uWindOff, this.windOff);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.drawn = count;
  }
}
