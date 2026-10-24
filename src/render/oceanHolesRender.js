// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OH-C (2026-09-26): THE PIT'S LOOK - There's a Hole in the Bottom of the
// Ocean's CreateMaterials and BuildPit, drawn. Three discs of the one
// 48-segment mesh CreateDiscMesh builds (each wedge wound both ways, so it
// shows from either side), on Unity's Unlit/Color: the flat colour, the
// world's fog over it (the shader's multi_compile_fog), opaque. Then, as
// every pass over the carved sea takes them, the water column's share
// (COLUMN_GLSL - it gates itself to what lies under the sea with the camera
// over it) and the sea's distance fog (FOG_GLSL dwWaterFog - on only with
// the camera under). In the mod's render queues: the pit's black (2000) and
// the surface's underside (2001) with the opaque floors, the surface's core
// (3001) after the sea's own transparent top, and the miasma (3002) last.
//
// THE MIASMA is Unity's Standard shader in Fade mode (SrcAlpha /
// OneMinusSrcAlpha, no depth write) with emission: the puff texture's alpha
// times the tint's, the tint lit by the scene's light plus the emission,
// fogged. Standard's physically based lighting of a camera-facing quad is
// taken as the port's billboards take the day's light - ambient plus the
// sun's Lambert term on a normal toward the camera (Port-Ledger, the Ocean
// Holes row); with an albedo this dark the emission is nearly all of it.
// Billboards facing the camera's plane, turned by their own rotation, and
// no larger than maxParticleSize (0.08) of the view's height.
// ═══════════════════════════════════════════════════════════════════

import { buildProgram } from './glProgram.js';
import { FOG_GLSL } from './fogGlsl.js';
import { COLUMN_GLSL } from './columnGlsl.js';
import { createDiscMesh, createMiasmaTexture, MIASMA_COLOR, MIASMA_EMISSION } from '../world/oceanHoles.js';

/** ParticleSystemRenderer.maxParticleSize. */
export const MAX_PARTICLE_SIZE = 0.08;

const DISC_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCentre;
uniform float uRadius;
out vec3 vWorldPos;
void main() {
  vec3 w = uCentre + vec3(aPos.x * uRadius, aPos.y, aPos.z * uRadius);   // localScale (radius, 1, radius)
  vWorldPos = w;
  gl_Position = uProj * uView * vec4(w, 1.0);
}`;

export const DISC_FS = `#version 300 es
precision highp float;
in vec3 vWorldPos;
uniform vec4 uColor;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
${COLUMN_GLSL}
void main() {
  vec3 col = mix(uFogColor, uColor.rgb, fogFactorAt(vWorldPos));   // Unlit/Color: _Color, UNITY_APPLY_FOG, opaque
  col = dwColumn(col, vWorldPos);
  outColor = vec4(dwWaterFog(col, vWorldPos), 1.0);
}`;

const MIASMA_VS = `#version 300 es
layout(location = 0) in vec3 aCentre;
layout(location = 1) in vec2 aCorner;
layout(location = 2) in vec2 aSizeRot;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamPos;
uniform float uMaxSize;   // maxParticleSize x 2 / cot(fov/2): the largest world size per unit of distance
out vec2 vUv;
out vec3 vWorldPos;
out vec3 vNormal;
void main() {
  float d = max(length(aCentre - uCamPos), 1e-3);
  float size = min(aSizeRot.x, uMaxSize * d);
  float c = cos(aSizeRot.y), s = sin(aSizeRot.y);
  vec2 k = vec2(c * aCorner.x - s * aCorner.y, s * aCorner.x + c * aCorner.y) * size;
  vec3 w = aCentre + uCamRight * k.x + uCamUp * k.y;
  vWorldPos = w;
  vNormal = normalize(uCamPos - aCentre);
  vUv = aCorner + 0.5;
  gl_Position = uProj * uView * vec4(w, 1.0);
}`;

export const MIASMA_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorldPos;
in vec3 vNormal;
uniform sampler2D uPuff;
uniform vec4 uColor;
uniform vec3 uEmission;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform float uSunScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
void main() {
  vec4 t = texture(uPuff, vUv);
  float a = t.a * uColor.a;
  vec3 lit = t.rgb * uColor.rgb * (uAmbient + uSunColor * (uSunScale * max(dot(normalize(vNormal), uLightDir), 0.0))) + uEmission;
  vec3 col = mix(uFogColor, lit, fogFactorAt(vWorldPos));
  outColor = vec4(dwWaterFog(col, vWorldPos), a);
}`;

const locs = (gl, p, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));

/** The pit's programs and shared buffers, on the Deep Waters renderer they draw beside. */
export class OceanHolesRenderer {
  /** @param {any} dw - the DeepWatersRenderer (its frame and column uniforms are these passes' too) */
  constructor(dw) {
    this.dw = dw;
    this.gl = dw.gl;
    this._res = null;
    this._stream = null;
  }

  _ensure() {
    if (this._res) return this._res;
    const gl = this.gl;
    const disc = buildProgram(gl, DISC_VS, DISC_FS, 'ocean holes disc');
    const miasma = buildProgram(gl, MIASMA_VS, MIASMA_FS, 'ocean holes miasma');
    const mesh = createDiscMesh();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const puff = createMiasmaTexture();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, puff.width, puff.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, puff.pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);   // FilterMode.Bilinear, no mips
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);   // TextureWrapMode.Clamp
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.dw.renderer.markForeignPass?.();
    this._res = {
      disc: { p: disc, u: locs(gl, disc, ['uProj', 'uView', 'uCentre', 'uRadius', 'uColor', 'uCamPos', 'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uDwFog', 'uFocus', 'uJungleHaze',
        'uSurfaceTex', 'uDwCamFwd', 'uColumnOn', 'uSeaY', 'uTopColor', 'uTopVision', 'uSurfaceScroll', 'uPixelOrigin']) },
      miasma: { p: miasma, u: locs(gl, miasma, ['uProj', 'uView', 'uCamRight', 'uCamUp', 'uCamPos', 'uMaxSize', 'uPuff', 'uColor', 'uEmission',
        'uAmbient', 'uSunColor', 'uSunScale', 'uLightDir', 'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uDwFog', 'uFocus', 'uJungleHaze']) },   // TV1: the travel view's focus - Deep Waters' _frameUniforms sends it
      vao, vbo, ebo, count: mesh.indices.length, tex,
    };
    return this._res;
  }

  /**
   * One queue's discs.
   * @param {Array<{centre: number[], radius: number, color: ArrayLike<number>, origin: number[]}>} list
   * @param {object} frame - dwColumnFrame's (the column's share)
   */
  drawDiscs(list, frame) {
    if (!list.length) return;
    const gl = this.gl;
    const { disc, vao, count } = this._ensure();
    const u = disc.u;
    gl.useProgram(disc.p);
    this.dw._frameUniforms(u);
    this.dw._columnUniforms(u, frame);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);   // Unlit/Color writes depth
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);   // Cull Back - the mesh carries both windings
    gl.bindVertexArray(vao);
    for (const it of list) {
      gl.uniform3fv(u.uCentre, it.centre);
      gl.uniform1f(u.uRadius, it.radius);
      gl.uniform4fv(u.uColor, it.color);
      gl.uniform3fv(u.uPixelOrigin, it.origin);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
    gl.depthFunc(gl.LESS);
    this.dw.renderer.markForeignPass?.();
  }

  /**
   * The miasma's particles, every pit's in one stream: world centres, sizes
   * and rotations.
   * @param {Array<{centre: number[], size: number, rot: number}>} parts
   */
  drawMiasma(parts) {
    if (!parts.length) return;
    const gl = this.gl, r = this.dw.renderer;
    const { miasma, tex } = this._ensure();
    const u = miasma.u, v = r._view, P = r._proj;
    const n = parts.length;
    const st = this._stream ??= { vao: gl.createVertexArray(), vbo: gl.createBuffer(), ebo: gl.createBuffer(), cap: 0, data: null };
    if (st.cap < n) {
      st.cap = Math.max(n, st.cap * 2, 64);
      st.data = new Float32Array(st.cap * 4 * 7);
      const idx = new Uint32Array(st.cap * 6);
      for (let i = 0; i < st.cap; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
      gl.bindVertexArray(st.vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, st.ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, st.data.byteLength, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 20);
      gl.bindVertexArray(null);
    }
    const d = st.data;
    const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    let o = 0;
    for (const q of parts) {
      for (const c of corners) { d[o++] = q.centre[0]; d[o++] = q.centre[1]; d[o++] = q.centre[2]; d[o++] = c[0]; d[o++] = c[1]; d[o++] = q.size; d[o++] = q.rot; }
    }
    gl.useProgram(miasma.p);
    this.dw._frameUniforms(u);
    gl.uniform3f(u.uCamRight, -v[0], -v[4], -v[8]);   // the lookAt's first row is minus the camera's right
    gl.uniform3f(u.uCamUp, v[1], v[5], v[9]);
    gl.uniform1f(u.uMaxSize, MAX_PARTICLE_SIZE * 2 / Math.abs(P[5] || 1));
    gl.uniform4fv(u.uColor, MIASMA_COLOR);
    gl.uniform3f(u.uEmission, MIASMA_EMISSION[0], MIASMA_EMISSION[1], MIASMA_EMISSION[2]);
    gl.uniform3fv(u.uAmbient, r._ambient);
    gl.uniform3fv(u.uSunColor, r._sunColor);
    gl.uniform1f(u.uSunScale, r._sunScale ?? 0);
    gl.uniform3fv(u.uLightDir, r._lightDir);
    gl.uniform1i(u.uPuff, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bindVertexArray(st.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, n * 4 * 7));
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);   // _ZWrite 0
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);   // _SrcBlend 5, _DstBlend 10
    gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    r.markForeignPass?.();
  }

  dispose() {
    const res = this._res, gl = this.gl;
    if (res) {
      gl.deleteProgram(res.disc.p); gl.deleteProgram(res.miasma.p);
      gl.deleteVertexArray(res.vao); gl.deleteBuffer(res.vbo); gl.deleteBuffer(res.ebo); gl.deleteTexture(res.tex);
    }
    if (this._stream) { gl.deleteVertexArray(this._stream.vao); gl.deleteBuffer(this._stream.vbo); gl.deleteBuffer(this._stream.ebo); }
    this._res = null; this._stream = null;
  }
}
