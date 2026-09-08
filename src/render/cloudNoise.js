// VC2 (2026-09-07): THE CLOUD NOISE, GENERATED ON THE GPU.
//
// Volumetric clouds (bible/07-Rendering/Volumetric-Clouds-Arc.md) are
// a density field read off two tiling 3D noise volumes, the shape the
// Nubis/Schneider recipe made standard: a SHAPE volume (128^3, RGBA -
// R a Perlin-Worley, G/B/A three Worley octaves at rising frequency,
// which the march remaps into the base shape and erodes with) and a
// DETAIL volume (32^3, RGB - three Worley octaves) that carves the
// edges. Both are TILEABLE on every axis (the lattice is taken modulo
// its period in the hash, so texel 0 and texel N meet) - a cloud that
// drifts for an hour never finds an edge.
//
// Filling 128^3 texels on the CPU is eight megabytes of JavaScript
// loops at boot; the GPU does it in 128 draws of a full-screen
// triangle, one per layer (render/renderTarget.js). That is a DRAW
// path, run once when the sky is built, never on an upload path.
//
// No uniforms live in the shared GLSL block: the AUDIT 47 sweep reads
// each template's own declarations, and a block that declares none
// cannot hide one. The lab's slice viewer (`?noise=`) is the eyeball
// tool and the probe's door (tools/cloudNoiseProbe.mjs).

export const SHAPE_SIZE = 128;
export const DETAIL_SIZE = 32;

/** Tileable value hash, gradient (Perlin) noise and inverted Worley
 *  noise on [0,1)^3, every lattice taken modulo its period. */
export const NOISE_GLSL = `
vec3 hash33(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yxz + 19.19);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// gradient noise on a lattice of period cells, in [0,1]
float perlin3(vec3 x, float period) {
  vec3 p = x * period;
  vec3 pi = floor(p), pf = p - pi;
  vec3 w = pf * pf * pf * (pf * (pf * 6.0 - 15.0) + 10.0);
  float n = 0.0;
  for (int k = 0; k < 8; k++) {
    vec3 c = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));
    vec3 g = hash33(mod(pi + c, period)) * 2.0 - 1.0;
    vec3 wt = mix(1.0 - w, w, c);
    n += dot(g, pf - c) * wt.x * wt.y * wt.z;
  }
  return clamp(n * 0.7 + 0.5, 0.0, 1.0);
}
// inverted Worley (1 at a cell feature point, 0 far from every one) on cells cells
float worley3(vec3 x, float cells) {
  vec3 q = x * cells;
  vec3 qi = floor(q), qf = q - qi;
  float d = 1e9;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int xx = -1; xx <= 1; xx++) {
    vec3 o = vec3(float(xx), float(y), float(z));
    vec3 r = o + hash33(mod(qi + o, cells)) - qf;
    d = min(d, dot(r, r));
  }
  return 1.0 - clamp(sqrt(d), 0.0, 1.0);
}
float perlinFbm(vec3 x, float period) {
  return (perlin3(x, period) * 0.5 + perlin3(x, period * 2.0) * 0.25 + perlin3(x, period * 4.0) * 0.125 + perlin3(x, period * 8.0) * 0.0625) / 0.9375;
}
float worleyFbm(vec3 x, float cells) {
  return worley3(x, cells) * 0.625 + worley3(x, cells * 2.0) * 0.25 + worley3(x, cells * 4.0) * 0.125;
}
float remap(float v, float lo, float hi, float nlo, float nhi) {
  return nlo + (v - lo) / (hi - lo) * (nhi - nlo);
}
`;

export const NOISE_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** One layer of the shape volume: p in [0,1)^3 at the texel's centre. */
export const SHAPE_FS = `#version 300 es
precision highp float;
uniform float uZ;      // this layer's centre, (z + 0.5) / size
uniform float uSize;   // the face's texel count
out vec4 outColor;
${NOISE_GLSL}
void main() {
  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);
  float perlin = perlinFbm(p, 4.0);
  float w4 = worleyFbm(p, 4.0);
  float pw = clamp(remap(perlin, 0.0, 1.0, w4, 1.0), 0.0, 1.0);   // Perlin-Worley: the billows dilated by the cells (Schneider), in [w4, 1]
  outColor = vec4(pw, worleyFbm(p, 8.0), worleyFbm(p, 16.0), worleyFbm(p, 32.0));
}`;

/** One layer of the detail volume: three Worley octaves. */
export const DETAIL_FS = `#version 300 es
precision highp float;
uniform float uZ;
uniform float uSize;
out vec4 outColor;
${NOISE_GLSL}
void main() {
  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);
  outColor = vec4(worleyFbm(p, 4.0), worleyFbm(p, 8.0), worleyFbm(p, 16.0), 1.0);
}`;

/** The lab's slice viewer: a z-slice of a volume, one channel or the
 *  RGB, tiled `uTiles` times across the frame so a seam would show. */
export const SLICE_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUV;
uniform sampler3D uVolume;
uniform float uZ;
uniform float uTiles;
uniform int uChannel;   // 0 r, 1 g, 2 b, 3 a, 4 rgb
out vec4 outColor;
void main() {
  vec4 t = texture(uVolume, vec3(vUV * uTiles, uZ));
  vec3 c = uChannel == 0 ? t.rrr : uChannel == 1 ? t.ggg : uChannel == 2 ? t.bbb : uChannel == 3 ? t.aaa : t.rgb;
  outColor = vec4(c, 1.0);
}`;

import { createVolume, withVolumeLayer, finishVolume } from './renderTarget.js';

function link(gl, vs, fs) {
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

export class CloudNoise {
  /** Builds both volumes at once - a DRAW path. `viewport` is the
   *  caller's [x, y, w, h] to restore; the caller marks the pass
   *  (EV6) as it marks the sky's. */
  constructor(gl, viewport) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.shapeProgram = link(gl, NOISE_VS, SHAPE_FS);
    this.detailProgram = link(gl, NOISE_VS, DETAIL_FS);
    this.sliceProgram = link(gl, NOISE_VS, SLICE_FS);
    this.su = { uZ: gl.getUniformLocation(this.shapeProgram, 'uZ'), uSize: gl.getUniformLocation(this.shapeProgram, 'uSize') };
    this.du = { uZ: gl.getUniformLocation(this.detailProgram, 'uZ'), uSize: gl.getUniformLocation(this.detailProgram, 'uSize') };
    this.lu = {};
    for (const n of ['uVolume', 'uZ', 'uTiles', 'uChannel']) this.lu[n] = gl.getUniformLocation(this.sliceProgram, n);
    this.shape = createVolume(gl, SHAPE_SIZE);
    this.detail = createVolume(gl, DETAIL_SIZE);
    this._fill(this.shape, this.shapeProgram, this.su, viewport);
    this._fill(this.detail, this.detailProgram, this.du, viewport);
  }

  _fill(volume, program, u, viewport) {
    const gl = this.gl;
    gl.useProgram(program);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.uniform1f(u.uSize, volume.size);
    gl.bindVertexArray(this.vao);
    for (let z = 0; z < volume.size; z++) {
      withVolumeLayer(gl, volume, z, () => {
        gl.uniform1f(u.uZ, (z + 0.5) / volume.size);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
    }
    gl.bindVertexArray(null);
    finishVolume(gl, volume, viewport);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }

  /** The lab's viewer: draw a slice over the current viewport. A DRAW
   *  path like the sky's - the host marks it. */
  drawSlice(which, z, channel, tiles = 1) {
    const gl = this.gl, u = this.lu;
    const volume = which === 'detail' ? this.detail : this.shape;
    gl.useProgram(this.sliceProgram);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, volume.tex);
    gl.uniform1i(u.uVolume, 0);
    gl.uniform1f(u.uZ, z); gl.uniform1f(u.uTiles, tiles); gl.uniform1i(u.uChannel, channel);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_3D, null);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }
}
