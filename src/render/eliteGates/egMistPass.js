// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11.2 - the Mist Stair's
// signature - and layer three's "the mist is not drawn"): THE MIST, DRAWN - a Mist Stair's and the Sinking Stair's mist
// surge as a sheet of drifting mist at the surge's line (net/eliteGates/egFragLaw.js egMistAt), hiding the depth below it for its 3 s.
//
// It never hides footing (section 11.2): its top stops EG_MIST.below under the landing it serves (world/eliteGates/egLook.js
// egMistSheets - "it stops 0.3 m below any landing within one jump"), it is depth-tested against the platforms standing
// out of it, and the edge lines and the telegraphs draw after it (section 25.6 - scenes/eliteGates/egLookDraw.js). One quad a sheet,
// its texture value noise drifting on the shared clock, posterized through the ordered dither (the Hour's pixel law),
// fogged as the world is, premultiplied over what lies under it. Sight only - nothing here is judged.
// EG-LOOK (2026-10-15, Elite-Gates-Look.md section 5): and THE CAIRN'S MIST under every rim (render/eliteGates/egMotes.js
// egRimMists) - the same sheet, held still at its own height; a sheet that says `round` fades to the circle inside its
// box (under a disc), any other to its box's edges as before.
//
// A foreign pass: it owns its program and its state; the host marks it. Not a DFU member. Ledger A (ELITE-GATES).
import { buildProgram } from '../glProgram.js';
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from '../orderedDither.js';

/** The most sheets one frame draws (a hall's mists). */
export const EG_MIST_MAX = 8;

export const EG_MIST_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aQ;   // 0..1 over the sheet
uniform mat4 uVP;
uniform vec4 uRect;   // x0, z0, x1, z1 (the scene's frame)
uniform float uY;
out vec3 vWorld;
out vec2 vQ;
void main() {
  vQ = aQ;
  vWorld = vec3(mix(uRect.x, uRect.z, aQ.x), uY, mix(uRect.y, uRect.w, aQ.y));
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
export const EG_MIST_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec2 vQ;
uniform vec3 uColor;
uniform float uAlpha;    // the surge's share (0 lying low, 1 risen)
uniform float uTime;
uniform float uSteps;
uniform float uRound;    // EG-LOOK: 1 - the sheet is the circle inside its box (a rim's mist under a disc)
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}${BAYER_GLSL}${SD_PIXEL_GLSL}
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec2 p = vWorld.xz * 0.35 + vec2(uTime * 0.11, uTime * 0.07);
  float n = 0.6 * vn(p) + 0.3 * vn(p * 2.3 - uTime * 0.05) + 0.1 * vn(p * 5.1);
  float rim = uRound > 0.5 ? 1.0 - smoothstep(0.72, 1.0, length(vQ * 2.0 - 1.0)) : smoothstep(0.0, 0.08, vQ.x) * smoothstep(0.0, 0.08, 1.0 - vQ.x) * smoothstep(0.0, 0.06, vQ.y) * smoothstep(0.0, 0.06, 1.0 - vQ.y);
  float a = uAlpha * rim * (0.62 + 0.3 * n);
  if (a <= 0.004) discard;
  vec3 c = sdPixel(uColor * (0.75 + 0.35 * n), floor(gl_FragCoord.xy), uSteps) * fogFactorAt(vWorld);
  o = vec4(c * a, a);
}`;

/** FIRST-USE (#1144): the pass's one program, as its constructor builds it - what the hall's load starts and the
 *  look's door waits on (render/glProgram.js startPrograms, compiledPass). */
export const EG_MIST_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[EG_MIST_VS, EG_MIST_FS]]));

/** The pass. */
export class EgMistPass {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [[vs, fs]] = EG_MIST_PROGRAMS;
    this.program = buildProgram(gl, vs, fs, 'eg mist');
    this.u = {};
    for (const n of ['uVP', 'uRect', 'uY', 'uColor', 'uAlpha', 'uTime', 'uSteps', 'uRound', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    this.drawn = 0;
  }
  /**
   * Draw `sheets` ([{ rect: [x0, z0, x1, z1], y, alpha, round? }] in the scene's frame - scenes/eliteGates/egLookDraw.js) in `color`
   * (linear), `seconds` the shared clock. Answers whether any drew.
   */
  draw(proj, view, eye, sheets, color, seconds, fog = null, steps = 10) {
    this.drawn = 0;
    if (!sheets?.length) return false;
    const gl = this.gl, U = this.u, V = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) V[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, V);
    gl.uniform3f(U.uColor, color[0], color[1], color[2]);
    gl.uniform1f(U.uTime, seconds % 600);
    gl.uniform1f(U.uSteps, steps);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? NO_FOG_EYE);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    for (let k = 0, n = Math.min(sheets.length, EG_MIST_MAX); k < n; k++) {   // AUDIT EG V (L6-4): read in place, never sliced a frame
      const s = sheets[k];
      if (!(s.alpha > 0)) continue;
      gl.uniform4f(U.uRect, s.rect[0], s.rect[1], s.rect[2], s.rect[3]);
      gl.uniform1f(U.uY, s.y);
      gl.uniform1f(U.uAlpha, Math.min(1, s.alpha));
      gl.uniform1f(U.uRound, s.round ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    return this.drawn > 0;
  }
  destroy() { const gl = this.gl; gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program); }
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOG_EYE = new Float32Array(3);
