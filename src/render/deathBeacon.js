import { buildProgram } from './glProgram.js';

const VS = `#version 300 es
precision highp float;
uniform mat4 uProj, uView;
uniform vec3 uBase, uRight;
uniform vec2 uSize;
uniform float uSky;
out vec2 uv;
void main() {
  const vec2 corners[6] = vec2[6](vec2(-1,0),vec2(1,0),vec2(-1,1),vec2(-1,1),vec2(1,0),vec2(1,1));
  uv = corners[gl_VertexID];
  vec3 p = uBase + uRight * uv.x * uSize.x + vec3(0,uv.y*uSize.y,0);
  gl_Position = uProj * uView * vec4(p,1);
  // A navigation beacon remains in the sky past the world's far clip.
  if(uSky > 0.5) gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999);
}`;
const FS = `#version 300 es
precision highp float;
in vec2 uv;
uniform float uTime, uOpacity, uLowerWave;
uniform vec3 uColor;
out vec4 color;
void main() {
  float drift = 0.16*sin(uv.y*19.0-uTime*0.7) + 0.08*sin(uv.y*41.0+uTime);
  // Keep the foot anchored, but optionally carry the wisps down the lower column.
  float lowSway = smoothstep(0.0,0.12,uv.y)*(0.65+0.35*uv.y);
  float x = uv.x + drift*mix(uv.y,lowSway,uLowerWave);
  float veil = exp(-8.0*x*x)*(0.32+0.13*sin(uv.y*34.0-uTime*1.5));
  float core = exp(-95.0*x*x)*0.48;
  float fade = smoothstep(0.0,0.035,uv.y)*(1.0-smoothstep(0.48,1.0,uv.y));
  float a = (veil+core)*fade;
  color = vec4(uColor,a*uOpacity);
}`;

// One camera-facing procedural sprite, with no textures or particle allocations.
export class DeathBeacon {
  static programs = [[VS, FS]];
  constructor(gl) {
    this.gl = gl; this.program = buildProgram(gl, VS, FS, 'death beacon'); this.vao = gl.createVertexArray();
    this.u = Object.fromEntries(['Proj', 'View', 'Base', 'Right', 'Size', 'Time', 'Color', 'Opacity', 'LowerWave', 'Sky'].map((k) => [k, gl.getUniformLocation(this.program, `u${k}`)]));
  }
  draw(r, at, { height = 100, width = 2, time = 0, color = [.58,.85,1], opacity = 1, lowerWave = 0, throughWalls = true } = {}) {
    const gl = this.gl;
    if (gl.isContextLost() || !r._proj || !r._view) return;
    r.endUiRun();
    const get = (key) => gl.getParameter(key);
    const saved = { program: get(gl.CURRENT_PROGRAM), vao: get(gl.VERTEX_ARRAY_BINDING), mask: get(gl.DEPTH_WRITEMASK), depthFunc:get(gl.DEPTH_FUNC),
      src: get(gl.BLEND_SRC_RGB), dst: get(gl.BLEND_DST_RGB), srcA: get(gl.BLEND_SRC_ALPHA), dstA: get(gl.BLEND_DST_ALPHA),
      eq: get(gl.BLEND_EQUATION_RGB), eqA: get(gl.BLEND_EQUATION_ALPHA),
      flags: [gl.BLEND, gl.DEPTH_TEST, gl.CULL_FACE].map((v) => [v, gl.isEnabled(v)]) };
    try {
      const v = r._view, n = Math.hypot(v[0], v[8]) || 1;
      gl.useProgram(this.program); gl.bindVertexArray(this.vao);
      gl.uniformMatrix4fv(this.u.Proj, false, r._proj); gl.uniformMatrix4fv(this.u.View, false, v);
      gl.uniform3fv(this.u.Base, at); gl.uniform3f(this.u.Right, v[0]/n, 0, v[8]/n);
      gl.uniform2f(this.u.Size, width, height); gl.uniform1f(this.u.Time, time);
      gl.uniform3fv(this.u.Color,color); gl.uniform1f(this.u.Opacity,opacity);
      gl.uniform1f(this.u.LowerWave,Number.isFinite(lowerWave)?Math.max(0,Math.min(1,lowerWave)):0);
      gl.uniform1f(this.u.Sky,throughWalls?1:0);
      gl.depthMask(false); if(throughWalls)gl.disable(gl.DEPTH_TEST);else {gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);} gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } finally {
      gl.depthMask(saved.mask); gl.depthFunc(saved.depthFunc); gl.blendEquationSeparate(saved.eq, saved.eqA); gl.blendFuncSeparate(saved.src, saved.dst, saved.srcA, saved.dstA);
      for (const [flag, on] of saved.flags) { if (on) gl.enable(flag); else gl.disable(flag); }
      gl.bindVertexArray(saved.vao); gl.useProgram(saved.program); r.markForeignPass();
    }
  }
  dispose() { this.gl.deleteProgram(this.program); this.gl.deleteVertexArray(this.vao); }
}
