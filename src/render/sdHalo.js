// @ts-check
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md "The shared kit"): THE HOUR'S HALOS - the classic set's
// bloom, and the lane's soft core: up to SD_HALO_MAX camera-facing quads added onto the frame in one draw from one
// dynamic buffer, their falloff posterized to four steps through the ordered dither (the pixel law), depth-tested and
// never written, fogged as the world is. For a light's core that must read edge-on and through the classic set's lack of
// bloom: the Rift's heart, the ways out, lanterns. Gain 1 on the classic set, 0.5 on the lane (the lane blooms it too).
//
// A foreign pass: it owns its program and its state, and the host marks it (renderer.markForeignPass). Not a DFU member.
// Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { BAYER_GLSL } from './orderedDither.js';

export const SD_HALO_MAX = 64;
/** The halo's gain on the classic set and on the lane. */
export const SD_HALO_GAIN = Object.freeze({ classic: 1, lane: 0.5 });
const FLOATS = 9;   // centre xyz, corner xy, size, colour rgb - a vertex

export const SD_HALO_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aAt;
layout(location = 1) in vec2 aCorner;
layout(location = 2) in float aSize;
layout(location = 3) in vec3 aColor;
uniform mat4 uView, uProj;
out vec2 vQ;
out vec3 vColor;
out vec3 vWorld;
void main() {
  vec4 c = uView * vec4(aAt, 1.0);
  c.xy += aCorner * aSize;
  vQ = aCorner; vColor = aColor; vWorld = aAt;
  gl_Position = uProj * c;
}`;
export const SD_HALO_FS = `#version 300 es
precision highp float;
in vec2 vQ;
in vec3 vColor;
in vec3 vWorld;
uniform float uGain;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}${BAYER_GLSL}
void main() {
  float r = length(vQ);
  if (r >= 1.0) discard;
  float k = (1.0 - r) * (1.0 - r);
  k = floor(k * 4.0 + bayer4(gl_FragCoord.xy) * 0.85) / 4.0;   // four steps, dithered at their edges
  o = vec4(vColor * k * uGain * fogFactorAt(vWorld), 1.0);
}`;

/** The halos, one foreign pass. */
/** A halo's quad as two triangles' corners (x, y each), made once. */
const CORNERS = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
const NO_RANGE = new Float32Array([0, 1]), NO_CAM = new Float32Array(3);

export class SdHaloRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, SD_HALO_VS, SD_HALO_FS, 'sd halo');
    this.u = {};
    for (const n of ['uView', 'uProj', 'uGain', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.data = new Float32Array(SD_HALO_MAX * 6 * FLOATS);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const S = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, S, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, S, 24);
    gl.bindVertexArray(null);
    this.drawn = 0;
  }
  /** Add `halos` ({ at, size, color } each - the world frame, metres, linear light) onto the frame. Answers whether any drew. */
  draw(proj, view, halos, fog = null, gain = SD_HALO_GAIN.classic) {
    const gl = this.gl, U = this.u, d = this.data;
    const n = Math.min(halos?.length ?? 0, SD_HALO_MAX);
    this.drawn = 0;
    if (!n) return false;
    let o = 0;
    for (let i = 0; i < n; i++) {
      const h = halos[i];
      for (let c = 0; c < 12; c += 2) { d[o++] = h.at[0]; d[o++] = h.at[1]; d[o++] = h.at[2]; d[o++] = CORNERS[c]; d[o++] = CORNERS[c + 1]; d[o++] = h.size; d[o++] = h.color[0]; d[o++] = h.color[1]; d[o++] = h.color[2]; }   // AUDIT SD V (P6): the corners made once
    }
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(U.uView, false, view); gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uGain, gain);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_CAM);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 6 * FLOATS);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, 0, n * 6);
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    this.drawn = n;
    return true;
  }
}
