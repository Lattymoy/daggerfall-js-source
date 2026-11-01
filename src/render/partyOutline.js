import { buildProgram, startPrograms, releasePrograms } from './glProgram.js';

const VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uMask, uDepth;
uniform vec2 uSize;
uniform vec4 uClip;
uniform float uWidth, uAlpha;
uniform vec3 uColor;
out vec4 color;
float maskAt(vec2 p) {
  if (any(lessThan(p, uClip.xy)) || any(greaterThanEqual(p, uClip.zw))) return 0.0;
  if (any(lessThan(p, vec2(0.0))) || any(greaterThanEqual(p, uSize))) return 0.0;
  return texture(uMask, p / uSize).a;
}
void main() {
  vec2 p = gl_FragCoord.xy;
  if (maskAt(p) > 0.1) discard;
  float found = 0.0, depth = 1.0;
  int radius = int(ceil(uWidth));
  for (int y = -radius; y <= radius; ++y) for (int x = -radius; x <= radius; ++x) {
    vec2 delta = vec2(float(x), float(y));
    if (length(delta) > uWidth) continue;
    vec2 q = p + delta;
    float a = maskAt(q);
    if (a > 0.1) { found = 1.0; depth = min(depth, texture(uDepth, q / uSize).r); }
  }
  if (found == 0.0) discard;
  gl_FragDepth = max(0.0, depth - 0.000001);
  color = vec4(uColor, uAlpha);
}`;

// Reuses the real character draw, so alpha cutouts, riders and rig poses agree.
export class PartyOutline {
  constructor(gl) {
    this.gl = gl; this.program = null; this.ready = startPrograms(gl, [[VS, FS]]);
    this.vao = gl.createVertexArray(); this.fbo = gl.createFramebuffer();
    this.mask = gl.createTexture(); this.depth = gl.createTexture(); this.width = 0; this.height = 0;
  }

  init() {
    if (this.program) return true;
    if (!this.ready()) return false;
    this.program = buildProgram(this.gl, VS, FS, 'party outline');
    this.u = Object.fromEntries(['Mask', 'Depth', 'Size', 'Width', 'Alpha', 'Color', 'Clip'].map((k) => [k, this.gl.getUniformLocation(this.program, `u${k}`)]));
    return true;
  }

  resize(w, h) {
    if (w === this.width && h === this.height) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    for (const [tex, internal, format, type] of [[this.mask, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.depth, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT]]) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.mask, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depth, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Party outline framebuffer unavailable');
    this.width = w; this.height = h;
  }

  draw(renderer, rows, options, drawMember) {
    if (!rows.length || this.gl.isContextLost() || !this.init()) return;
    renderer.endUiRun();
    const gl = this.gl, get = (key) => gl.getParameter(key);
    const saved = { fb: get(gl.DRAW_FRAMEBUFFER_BINDING), read: get(gl.READ_FRAMEBUFFER_BINDING), vp: get(gl.VIEWPORT),
      scissor: get(gl.SCISSOR_BOX), clear: get(gl.COLOR_CLEAR_VALUE), clearDepth: get(gl.DEPTH_CLEAR_VALUE),
      depthMask: get(gl.DEPTH_WRITEMASK), depthFunc: get(gl.DEPTH_FUNC), active: get(gl.ACTIVE_TEXTURE),
      program: get(gl.CURRENT_PROGRAM), vao: get(gl.VERTEX_ARRAY_BINDING), array: get(gl.ARRAY_BUFFER_BINDING),
      srcRGB: get(gl.BLEND_SRC_RGB), dstRGB: get(gl.BLEND_DST_RGB), srcA: get(gl.BLEND_SRC_ALPHA), dstA: get(gl.BLEND_DST_ALPHA),
      eqRGB: get(gl.BLEND_EQUATION_RGB), eqA: get(gl.BLEND_EQUATION_ALPHA), colorMask: get(gl.COLOR_WRITEMASK),
      flags: [gl.BLEND, gl.DEPTH_TEST, gl.CULL_FACE, gl.SCISSOR_TEST].map((k) => [k, gl.isEnabled(k)]),
      frame: renderer._frameFbo, shadows: renderer._shadows };
    gl.activeTexture(gl.TEXTURE0); saved.tex0 = get(gl.TEXTURE_BINDING_2D);
    gl.activeTexture(gl.TEXTURE1); saved.tex1 = get(gl.TEXTURE_BINDING_2D);
    try {
      const w = Math.max(gl.drawingBufferWidth, saved.vp[0] + saved.vp[2]);
      const h = Math.max(gl.drawingBufferHeight, saved.vp[1] + saved.vp[3]);
      this.resize(w, h);
      const rgb = [1, 3, 5].map((i) => parseInt(options.color.slice(i, i + 2), 16) / 255);
      renderer._shadows = null;
      for (const row of rows) {
        const b = row.bounds || saved.vp;
        // Include the complete maximum outline neighbourhood; ignore stale mask pixels beyond it.
        const x = Math.max(0, Math.floor(b[0] - 8)), y = Math.max(0, Math.floor(b[1] - 8));
        const right = Math.min(w, Math.ceil(b[0] + b[2] + 8)), top = Math.min(h, Math.ceil(b[1] + b[3] + 8));
        if (right <= x || top <= y) continue;
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
        renderer._frameFbo = this.fbo;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x, y, right-x, top-y); gl.colorMask(true, true, true, true); gl.depthMask(true);
        gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(...saved.vp); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
        renderer.markForeignPass();
        drawMember(row.id);
        renderer._frameFbo = saved.frame;
        gl.bindFramebuffer(gl.FRAMEBUFFER, saved.fb);
        gl.viewport(0, 0, w, h); gl.enable(gl.SCISSOR_TEST); gl.scissor(...(row.bounds || saved.vp));
        gl.useProgram(this.program); gl.bindVertexArray(this.vao);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.mask);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.depth);
        gl.uniform1i(this.u.Mask, 0); gl.uniform1i(this.u.Depth, 1);
        gl.uniform4f(this.u.Clip, x, y, right, top);
        gl.uniform2f(this.u.Size, w, h); gl.uniform1f(this.u.Width, Math.min(6, options.width * (options.pixelRatio || 1)));
        gl.uniform1f(this.u.Alpha, row.alpha); gl.uniform3fv(this.u.Color, rgb);
        gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
        if (options.throughWalls) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        renderer.markForeignPass();
      }
    } finally {
      renderer._frameFbo = saved.frame; renderer._shadows = saved.shadows;
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, saved.fb); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, saved.read);
      gl.viewport(...saved.vp); gl.scissor(...saved.scissor); gl.clearColor(...saved.clear); gl.clearDepth(saved.clearDepth);
      gl.colorMask(...saved.colorMask); gl.depthMask(saved.depthMask); gl.depthFunc(saved.depthFunc);
      gl.blendFuncSeparate(saved.srcRGB, saved.dstRGB, saved.srcA, saved.dstA); gl.blendEquationSeparate(saved.eqRGB, saved.eqA);
      for (const [flag, on] of saved.flags) { if (on) gl.enable(flag); else gl.disable(flag); }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, saved.tex0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, saved.tex1); gl.activeTexture(saved.active);
      gl.bindVertexArray(saved.vao); gl.bindBuffer(gl.ARRAY_BUFFER, saved.array); gl.useProgram(saved.program);
      renderer.markForeignPass();
    }
  }

  dispose() {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program); else releasePrograms(gl, [[VS, FS]]); gl.deleteVertexArray(this.vao); gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.mask); gl.deleteTexture(this.depth);
  }
}
