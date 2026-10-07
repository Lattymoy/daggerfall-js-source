// @ts-check
// SD17 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's SD17): THE HOUR-HAND'S
// BEAM IN THE AIR - a ribbon of the Remnant's gold light from its pointing hand to where the sweep's bearing meets the
// floor (or a pillar's face), turned about its own length to face the eye, ADDED onto the frame (ONE, ONE - the duel
// wall's law, render/duelWall.js: fixed geometry placed by uniforms, no depth written, tested against the depth the world
// wrote, fogged, its rates whole cycles over the wrapped clock). A bright core and a soft glow across it, brightest at
// the hand, light running out along it toward the floor, its far end flaring where it strikes. The floor's telegraph is
// SD8d's (scenes/sdRemnantBlows.js); this is the blow itself.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { duelClock } from './duelWall.js';

/** The most beams a frame draws (the Remnant's, and the two Echoes' paired sweep). */
export const SD_BEAM_MAX = 3;
/** Its width at the hand and at its far end (m), the narrowest it stands on the screen (an angle of the eye's view), the
 *  light's run out along it (cycles a second, whole over the duel clock), and its colours: the core, the glow. */
export const SD_BEAM_W = Object.freeze([0.55, 1.6]);
export const SD_BEAM_MIN_RAD = 0.003;
export const SD_BEAM_RUN_HZ = 2;
export const SD_BEAM_CORE = Object.freeze([1.0, 0.92, 0.62]);
export const SD_BEAM_GLOW = Object.freeze([1.0, 0.62, 0.18]);

const HEAD = `#version 300 es
precision highp float;
`;
/** One strip a beam: x across it (-1..1), y along it (0 at the hand, 1 at its far end). */
export const SD_BEAM_VS = HEAD + `layout(location = 0) in vec2 aP;
uniform mat4 uVP;
uniform vec3 uA;         // the hand
uniform vec3 uB;         // its far end
uniform vec2 uW;         // its width at the hand, at its end
uniform float uMinRad;
uniform vec3 uEye;
out vec2 vP;
out vec3 vWorld;
out float vLen;
void main() {
  vec3 along = uB - uA;
  vec3 mid = uA + along * aP.y;
  vec3 toEye = uEye - mid;
  vec3 across = cross(along, toEye);
  float l = length(across);
  across = l > 1e-5 ? across / l : vec3(1.0, 0.0, 0.0);   // turned about its own length to face the eye
  float w = max(mix(uW.x, uW.y, aP.y), length(toEye) * uMinRad);
  vec3 p = mid + across * (aP.x * 0.5 * w);
  vP = aP;
  vWorld = p;
  vLen = length(along);
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const SD_BEAM_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
in float vLen;
uniform vec3 uCore;
uniform vec3 uGlow;
uniform float uAlpha;
uniform float uTime;     // duelClock's seconds
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  float x = vP.x, y = vP.y;
  float core = exp(-x * x * 18.0);                                          // the bright thread
  float glow = exp(-x * x * 3.0);                                           // the light about it
  float run = 0.75 + 0.25 * sin((y * vLen * 0.35 - uTime * ${SD_BEAM_RUN_HZ}.0) * 6.283185307179586);   // light running out along it
  float hand = 1.0 + 1.6 * exp(-y * 18.0);                                  // brightest at the hand
  float strike = 1.0 + 1.2 * exp(-(1.0 - y) * 22.0);                        // flaring where it strikes
  float ends = smoothstep(0.0, 0.015, y) * smoothstep(1.0, 0.985, y);
  vec3 c = (uCore * core * 1.4 + uGlow * glow * 0.55 * run) * hand * strike * ends;
  o = vec4(c * uAlpha * fogFactorAt(vWorld), 1.0);
}`;

/** The strip: x across (-1, 1), y along (0, 1) - eight steps along it, so the fog and the glow follow its length. Pure. */
export function sdBeamVertices(steps = 8) {
  const v = [];
  for (let i = 0; i < steps; i++) {
    const y0 = i / steps, y1 = (i + 1) / steps;
    v.push(-1, y0, 1, y0, 1, y1, -1, y0, 1, y1, -1, y1);
  }
  return new Float32Array(v);
}

export class SdBeamRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, SD_BEAM_VS, SD_BEAM_FS, 'sd beam');
    this.u = {};
    for (const n of ['uVP', 'uA', 'uB', 'uW', 'uMinRad', 'uEye', 'uCore', 'uGlow', 'uAlpha', 'uTime', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.program, n);
    const verts = sdBeamVertices();
    this.count = verts.length / 2;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** the beams the last draw lit, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw the beams: `beams` [{ a: [x, y, z] the hand, b: [x, y, z] its far end - the scene's frame, alpha }] (at most
   * SD_BEAM_MAX), `eye` the camera, `seconds` any clock (wrapped here), `fog` the frame's as the renderer set it. Nothing
   * to draw, nothing touched; answers whether it drew.
   */
  draw(beams, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const list = (Array.isArray(beams) ? beams : []).filter((g) => g && [g.a, g.b].every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) && !(g.alpha <= 0.001)).slice(0, SD_BEAM_MAX);
    if (!list.length) return false;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, duelClock(seconds));
    gl.uniform2f(U.uW, SD_BEAM_W[0], SD_BEAM_W[1]);
    gl.uniform1f(U.uMinRad, SD_BEAM_MIN_RAD);
    gl.uniform3fv(U.uCore, SD_BEAM_CORE);
    gl.uniform3fv(U.uGlow, SD_BEAM_GLOW);
    const at = eye ?? list[0].a;
    gl.uniform3f(U.uEye, at[0], at[1], at[2]);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? at);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    for (const g of list) {
      gl.uniform3f(U.uA, g.a[0], g.a[1], g.a[2]);
      gl.uniform3f(U.uB, g.b[0], g.b[1], g.b[2]);
      gl.uniform1f(U.uAlpha, Math.min(1, g.alpha ?? 1));
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return this.drawn > 0;
  }
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
