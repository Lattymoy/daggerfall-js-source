// @ts-check
// POI-3 (2026-10-14, bible/06-Systems/POI-Editor-Arc.md): THE EDITOR'S LINES - the gizmo's handles (poi/poiGizmo.js
// gizmoShape), a selection's box and the cursor's mark, drawn over the world in one foreign pass a batch.
//
// Lines as screen-width quads (render/superDungeon/sdStepsPass.js's law, never GL_LINES - WebGL caps those at one pixel, gone on a
// high-DPI screen), each segment its own colour; a dynamic buffer the editor fills a frame (`packLines` - grown, never
// shrunk, so a frame makes nothing once the largest gizmo has drawn), its edges feathered. A batch is drawn ON TOP (no depth test: a handle
// is never hidden behind the thing it moves) or IN the world (depth-tested, never written: a box seen where the model
// stands), straight alpha over. A foreign pass: it owns its program and its state and puts the state back; the host
// marks it (renderer.markForeignPass).
//
// Not a DFU member. Ledger A (POI).
import { buildProgram } from './glProgram.js';
import { telegraphLineW } from './gate/gateTelegraph.js';

const FLOATS = 12;   // aA xyz, aB xyz, aM (side, end), aC rgba
const VERTS = 6;     // two triangles a segment

/**
 * Lines into a vertex buffer: each `{ a, b, color }` (world points, rgba 0 - 1) as one quad's six vertices. `out` is
 * reused when it is large enough. Answers `{ data, count }` (count in vertices). Pure.
 * @param {ReadonlyArray<{ a: number[], b: number[], color: number[] }>} lines @param {Float32Array | null} [out]
 */
export function packLines(lines, out = null) {
  const need = lines.length * VERTS * FLOATS;
  const data = out && out.length >= need ? out : new Float32Array(Math.max(need, (out?.length ?? 0) * 2, 64 * VERTS * FLOATS));
  let o = 0;
  for (const { a, b, color } of lines) {
    for (const [side, end] of [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]) {
      data[o++] = a[0]; data[o++] = a[1]; data[o++] = a[2]; data[o++] = b[0]; data[o++] = b[1]; data[o++] = b[2];
      data[o++] = side; data[o++] = end;
      data[o++] = color[0]; data[o++] = color[1]; data[o++] = color[2]; data[o++] = color[3] ?? 1;
    }
  }
  return { data, count: lines.length * VERTS };
}

export const POI_LINES_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aA;
layout(location = 1) in vec3 aB;
layout(location = 2) in vec2 aM;   // its side (-1, 1), its end (0, 1)
layout(location = 3) in vec4 aC;
uniform mat4 uVP;
uniform vec2 uViewport;   // px
uniform float uWidth;     // px
out vec4 vC;
out float vSide;   // -1 to 1 across the line: its edges feathered (a handle's line reads smooth at any angle)
void main() {
  vec4 ca = uVP * vec4(aA, 1.0), cb = uVP * vec4(aB, 1.0);
  const float E = 0.01;   // an end behind the eye: the segment cut at the near side
  vC = aC;
  vSide = aM.x;
  if (ca.w < E && cb.w < E) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (ca.w < E) ca = mix(ca, cb, (E - ca.w) / (cb.w - ca.w));
  else if (cb.w < E) cb = mix(cb, ca, (E - cb.w) / (ca.w - cb.w));
  vec2 h = uViewport * 0.5, sa = ca.xy / ca.w * h, sb = cb.xy / cb.w * h, d = sb - sa;
  float L = length(d);
  d = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  bool far = aM.y > 0.5;
  vec4 c = far ? cb : ca;
  c.xy += (n * aM.x + d * (far ? 1.0 : -1.0)) * (uWidth * 0.5) / h * c.w;   // square caps: the corners meet
  gl_Position = c;
}`;
export const POI_LINES_FS = `#version 300 es
precision highp float;
in vec4 vC;
in float vSide;
layout(location = 0) out vec4 o;
const float FEATHER = 0.35;   // the share of the half-width faded out at each edge
void main() { o = vec4(vC.rgb, vC.a * clamp((1.0 - abs(vSide)) / FEATHER, 0.0, 1.0)); }`;

export class PoiGizmoPass {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, POI_LINES_VS, POI_LINES_FS, 'poi editor lines');
    this.u = {};
    for (const n of ['uVP', 'uViewport', 'uWidth']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const S = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, S, 32);
    gl.bindVertexArray(null);
    /** @type {Float32Array | null} */
    this.data = null;
    this.capacity = 0;   // bytes the GPU buffer holds
    this._vp = new Float32Array(16);
    this._viewport = new Float32Array(2);
  }
  /**
   * Draw a batch of lines over the frame. `onTop` true: no depth test (handles); false: tested, never written (a box
   * where the model stands). `px` the lines' width at a tall screen (telegraphLineW widens them on a short one).
   * Answers whether anything drew.
   * @param {Float32Array} proj @param {Float32Array} view @param {ReadonlyArray<{ a: number[], b: number[], color: number[] }>} lines
   * @param {{ onTop?: boolean, px?: number, vw?: number, vh?: number }} [opts]
   */
  draw(proj, view, lines, { onTop = true, px = 2, vw = 0, vh = 0 } = {}) {
    if (!lines.length) return false;
    const gl = this.gl, U = this.u, V = this._vp;
    const { data, count } = packLines(lines, this.data);
    this.data = data;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) V[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    const h = vh || gl.drawingBufferHeight;
    this._viewport[0] = vw || gl.drawingBufferWidth; this._viewport[1] = h;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, V);
    gl.uniform2fv(U.uViewport, this._viewport);
    gl.uniform1f(U.uWidth, px * telegraphLineW(h));
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const bytes = count * FLOATS * 4;
    if (bytes > this.capacity) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); this.capacity = data.byteLength; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * FLOATS);
    if (onTop) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, count);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    return true;
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
  }
}
