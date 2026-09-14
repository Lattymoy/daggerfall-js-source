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

import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';

const HEAD = `#version 300 es
precision highp float;
`;

export const WISP_VS = HEAD + `layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSeed;      // x,y,z in the box + phase
uniform mat4 uVP; uniform vec3 uEye;
uniform float uTime, uBox, uStrength;
uniform vec2 uWindV, uWindOff;
out float vT; out float vLife;
void main(){
  float seed = aSeed.w;
  vec3 p = aSeed.xyz;
  // every wisp takes its own share of the wind, so the field is not one
  // rigid direction (the rain's per-drop gust, PROTO-9)
  float gust = 0.80 + fract(seed*3.7)*0.4;
  p += vec3(uWindOff.x, 0.0, uWindOff.y) * gust;
  // a slow wobble across and along, phased per wisp
  p.y += sin(uTime*0.9 + seed*31.0) * 0.35;
  p.xz += vec2(cos(uTime*0.7 + seed*17.0), sin(uTime*0.6 + seed*23.0)) * 0.25;
  p = mod(p - uEye + uBox*0.5, uBox) + uEye - uBox*0.5;
  // born, brightest at half life, gone: a fade on the wisp's own clock
  float rate = 0.35 + fract(seed*5.3)*0.25;
  vLife = sin(fract(uTime*rate + seed*7.0) * 3.14159);
  // a streak along the wind's velocity, longer in a stronger wind
  vec3 drift = vec3(uWindV.x, 0.0, uWindV.y) * gust;
  float dl = length(drift);
  vec3 vel = dl > 1e-3 ? drift / dl : vec3(1.0, 0.0, 0.0);
  float len = (1.6 + fract(seed*13.1)*2.4) * (0.5 + uStrength);
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
out vec4 o;
void main(){
  // bright toward the head, faint at the tail; never more than a breath
  float a = smoothstep(0.0, 0.45, vT) * (1.0 - smoothstep(0.85, 1.0, vT));
  a *= vLife * (0.10 + 0.12 * uStrength);
  o = vec4(vec3(0.86, 0.89, 0.94), a);
}`;

/** The box that follows the eye, metres a side (the rain's is 42; the
 *  wisps read from further, so the wind is legible over a field). */
export const WISP_BOX = 90;
/** The most wisps the field draws, at a gale. */
export const WISP_MAX = 2400;
/** The share of WISP_MAX drawn in a dead calm - the floor that keeps
 *  the direction readable. */
export const WISP_FLOOR = 0.12;

/** How many wisps a wind of `strength01` draws: the floor plus the rest
 *  over a smoothstep of the strength. Pure. */
export function wispCount(strength01) {
  const s = Math.max(0, Math.min(1, strength01));
  const u = Math.max(0, Math.min(1, (s - 0.05) / 0.85));
  const ss = u * u * (3 - 2 * u);
  return Math.round(WISP_MAX * (WISP_FLOOR + (1 - WISP_FLOOR) * ss));
}

/** The wisps' switch: the enhanced skin, the `windWisps` pref, and
 *  `?wisps=off` the kill door. Read once a frame by the exterior hosts. */
export function wispsOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('windWisps') && new URLSearchParams(search).get('wisps') !== 'off';
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
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
  constructor(gl) {
    this.gl = gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, WISP_VS));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, WISP_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uTime', 'uBox', 'uStrength', 'uWindV', 'uWindOff']) this.u[n] = gl.getUniformLocation(prog, n);
    // the instances: x,y,z in [0, BOX) + a phase, from one seeded
    // xorshift so the field is the same field every load
    const inst = new Float32Array(WISP_MAX * 4);
    let s = 0x7a3d9f1b;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < WISP_MAX; i++) { inst[i * 4] = rnd() * WISP_BOX; inst[i * 4 + 1] = rnd() * WISP_BOX; inst[i * 4 + 2] = rnd() * WISP_BOX; inst[i * 4 + 3] = rnd(); }
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
     *  step each frame and kept inside one box's span - the wrap makes
     *  the two identical, and a bounded number never loses precision
     *  over a long session */
    this.windOff = new Float32Array(2);
    this._vp = new Float32Array(16);
    /** the count the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  /** Advance the travel by the frame's step and wrap it. */
  advance(step) {
    for (let i = 0; i < 2; i++) {
      let v = this.windOff[i] + (step?.[i] ?? 0);
      v = ((v % WISP_BOX) + WISP_BOX) % WISP_BOX;
      this.windOff[i] = v;
    }
  }

  /** Draw the frame's wisps for `wd` (systems/windDrive.js's answer):
   *  nothing when the deck is unknown. Advances the travel first. */
  draw(wd, proj, view, eye, timeSeconds) {
    this.drawn = 0;
    if (!wd?.on) return;
    this.advance(wd.step);
    const count = wispCount(wd.strength01);
    if (count <= 0) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3fv(U.uEye, eye);
    gl.uniform1f(U.uTime, timeSeconds);
    gl.uniform1f(U.uBox, WISP_BOX);
    gl.uniform1f(U.uStrength, wd.strength01);
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
