// @ts-check
// EL3 (2026-09-17, the Enhanced Lighting arc, tier three - DEPTH AND AIR).
//
// WHAT THIS IS. Three screen-space effects the lane adds on top of EL1's
// light and EL2's shadows, all fed by ONE new thing: a depth image of the
// world from the camera, drawn at the top of the frame from the shadow
// pass's records (render/shadowPass.js - the same replay, the camera's
// view-projection instead of the light's). Off that depth:
//
//   1. AMBIENT OCCLUSION (SSAO at half resolution): a hemisphere of
//      twelve samples about the surface normal reconstructed from the
//      depth, each projected back and tested against the depth image,
//      range-checked, rotated per pixel by a hash so the pattern is noise
//      and not a stamp, then a 4x4 box blur. The lane's mesh, terrain and
//      character shaders read the result by screen position (AIR_AO_GLSL)
//      and multiply their AMBIENT term - the light that has no direction
//      is the light a crevice loses; the sun and the lanterns keep theirs.
//   2. BLOOM (quarter resolution): sourced from what actually emits -
//      every window's emission map and every self-lit record (the
//      records replayed with an emission-only program), and a glare
//      sprite at each lantern, sized by its range, hidden when the depth
//      image says a wall is in front of it - then a separable 9-tap
//      gaussian, twice, added over the frame.
//   3. LIGHT SHAFTS (quarter resolution, outdoors): the sky's mask (depth
//      at the far plane) weighted toward the sun's screen position, radially
//      blurred toward it with decay - the classic screen-space god rays -
//      in the sun's colour, added over the frame when the sun is in front
//      of the camera.
//
// WHERE IT LANDS. The bloom and the shafts are composited with additive
// blending by the first screen-space draw of the frame (drawScreenQuad,
// which is where the 2D pass begins and the world pass has ended for every
// host, foreign passes included) over the world viewport.
//
// THE DEPARTURE FROM THE PLAN, recorded: the plan named an RGBA16F target
// for the whole world with the tonemap moved to a final composite. Six
// foreign passes (both skies, the clouds, the precipitation, the grass,
// the far ring) restore `bindFramebuffer(null)` behind the renderer's back
// - the render-target helper's own law - so a world drawn off-screen would
// lose every one of them to the canvas. The scene stays forward-tonemapped
// (EL1); the bloom is sourced from the emitters themselves, which is the
// bloom that means something, and a later pass that teaches the six about
// a current target can move the tonemap. Nothing here needs a float
// target.
//
// This module imports nothing of the renderer or the lane; the renderer
// hands it its own vertex shaders and its program builder, as the shadow
// pass takes them.

import { multiply } from '../world/mat4.js';

/** The kill door: `?air=off` keeps EL1 and EL2 and drops the three effects. */
export function airOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('air') !== 'off';
}

/** The AO image's scale of the world viewport, and the bloom's and shafts'. */
export const AIR_AO_SCALE = 0.5;
export const AIR_BLOOM_SCALE = 0.25;
/** The hemisphere's radius in world units (a door is ~2 tall), the sample
 *  count, the strength (1 = a fully occluded crevice loses all ambient),
 *  and the depth bias against self-occlusion. */
export const AIR_AO_RADIUS = 0.8;
export const AIR_AO_SAMPLES = 12;
export const AIR_AO_STRENGTH = 1.0;
export const AIR_AO_BIAS = 0.02;
/** The bloom's gain on the composite, and the glare sprite's size per
 *  square root of a lantern's range (range 18 -> ~1.5 units). */
export const AIR_BLOOM_STRENGTH = 0.6;
export const AIR_GLARE_SIZE = 0.35;
/** The shafts: taps along the ray, the per-tap decay, the gain, the
 *  angular reach of the sun's mask (in the shaft image's UV). */
export const AIR_SHAFT_TAPS = 32;
export const AIR_SHAFT_DECAY = 0.96;
export const AIR_SHAFT_STRENGTH = 0.35;
export const AIR_SHAFT_REACH = 0.35;
/** The reserved texture unit for the AO image (the shadow maps are 13 and 14, the cloud shadow 15). */
export const AIR_AO_UNIT = 12;

/** The four numbers a shader needs to undo the renderer's perspective
 *  (world/mat4.js's `perspective`, mirrored or not): [0] and [5] the focal
 *  terms, [10] and [14] the depth terms. */
export function projInfo(proj, out = new Float32Array(4)) {
  out[0] = proj[0]; out[1] = proj[5]; out[2] = proj[10]; out[3] = proj[14];
  return out;
}

/** View-space depth (negative, the camera looks down -z) from an NDC depth
 *  z in [-1, 1] - the JS of the shader's reconstruction, term for term. */
export function viewDepth(zNdc, p10, p14) {
  return -p14 / (zNdc + p10);
}

/** The sun's position on screen as [u, v] in [0, 1] of the viewport, or
 *  null when it is behind the camera. `lightDir` is the direction TOWARD
 *  the sun; a directional light projects as a point at infinity (w = 0). */
export function sunScreenUV(proj, view, lightDir) {
  const vx = view[0] * lightDir[0] + view[4] * lightDir[1] + view[8] * lightDir[2];
  const vy = view[1] * lightDir[0] + view[5] * lightDir[1] + view[9] * lightDir[2];
  const vz = view[2] * lightDir[0] + view[6] * lightDir[1] + view[10] * lightDir[2];
  const cx = proj[0] * vx + proj[4] * vy + proj[8] * vz;
  const cy = proj[1] * vx + proj[5] * vy + proj[9] * vz;
  const cw = proj[3] * vx + proj[7] * vy + proj[11] * vz;
  if (!(cw > 1e-6)) return null;
  return [cx / cw * 0.5 + 0.5, cy / cw * 0.5 + 0.5];
}

/** The hemisphere kernel: n samples in the +z hemisphere, more of them
 *  near the origin (scale = lerp(0.1, 1, (i/n)^2)), from a fixed
 *  linear-congruential stream so every page draws the same noise. */
export function aoKernel(n = AIR_AO_SAMPLES) {
  const out = new Float32Array(n * 3);
  let seed = 0x2545F491;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd();
    const l = Math.hypot(x, y, z) || 1;
    x /= l; y /= l; z /= l;
    const t = i / n;
    const scale = (0.1 + 0.9 * t * t) * rnd();
    out[i * 3] = x * scale; out[i * 3 + 1] = y * scale; out[i * 3 + 2] = z * scale;
  }
  return out;
}

/** A lantern's glare sprite size, world units, from its range. */
export function glareSize(range) {
  return AIR_GLARE_SIZE * Math.sqrt(Math.max(range, 0));
}

/** THE RECEIVER BLOCK for the lane's lit shaders: the AO image by screen
 *  position, 1.0 while the pass is off (params.z, the viewport's width). */
export const AIR_AO_GLSL = `
uniform sampler2D uAO;
uniform vec4 uAOInfo;   // the world viewport x, y, w, h in pixels; w 0 = no AO
float aoAt() {
  if (uAOInfo.z <= 0.0) return 1.0;
  vec2 uv = (gl_FragCoord.xy - uAOInfo.xy) / uAOInfo.zw;
  return texture(uAO, uv).r;
}
`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const AO_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uDepth;
uniform vec4 uProjInfo;     // proj[0], proj[5], proj[10], proj[14]
uniform vec3 uKernel[${AIR_AO_SAMPLES}];
uniform vec4 uAOParams;     // radius, strength, bias, unused
out vec4 outColor;
vec3 posAt(vec2 uv) {
  float z = texture(uDepth, uv).r * 2.0 - 1.0;
  float vz = -uProjInfo.w / (z + uProjInfo.z);
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * (-vz) / uProjInfo.x, ndc.y * (-vz) / uProjInfo.y, vz);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float d0 = texture(uDepth, vUV).r;
  if (d0 >= 0.99999) { outColor = vec4(1.0); return; }
  vec3 p = posAt(vUV);
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (dot(n, -p) < 0.0) n = -n;   // a normal faces the eye whatever the projection's handedness did to the derivatives
  vec3 rnd = normalize(vec3(hash(gl_FragCoord.xy) * 2.0 - 1.0, hash(gl_FragCoord.yx + 7.0) * 2.0 - 1.0, 0.0));
  vec3 t = normalize(rnd - n * dot(rnd, n));
  vec3 b = cross(n, t);
  mat3 tbn = mat3(t, b, n);
  float radius = uAOParams.x;
  float occ = 0.0;
  for (int i = 0; i < ${AIR_AO_SAMPLES}; i++) {
    vec3 s = p + tbn * uKernel[i] * radius;
    vec2 suv = vec2(s.x * uProjInfo.x, s.y * uProjInfo.y) / (-s.z) * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
    float sz = posAt(suv).z;
    float range = smoothstep(0.0, 1.0, radius / abs(p.z - sz));
    occ += (sz >= s.z + uAOParams.z ? 1.0 : 0.0) * range;
  }
  float ao = 1.0 - occ / ${AIR_AO_SAMPLES}.0 * uAOParams.y;
  outColor = vec4(vec3(ao), 1.0);
}`;

const BOX_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  float acc = 0.0;
  for (int y = -2; y < 2; y++) {
    for (int x = -2; x < 2; x++) {
      acc += texture(uSrc, vUV + (vec2(float(x), float(y)) + 0.5) * uTexel).r;
    }
  }
  outColor = vec4(vec3(acc / 16.0), 1.0);
}`;

const GAUSS_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uDir;   // the texel step along the axis blurred
out vec4 outColor;
const float W[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
void main() {
  vec3 acc = texture(uSrc, vUV).rgb * W[0];
  for (int i = 1; i < 5; i++) {
    acc += texture(uSrc, vUV + uDir * float(i)).rgb * W[i];
    acc += texture(uSrc, vUV - uDir * float(i)).rgb * W[i];
  }
  outColor = vec4(acc, 1.0);
}`;

const SHAFT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uDepth;
uniform vec2 uSun;          // the sun's screen position, uv
uniform vec4 uShaftParams;  // decay, strength, reach, aspect
uniform vec3 uSunColor;
out vec4 outColor;
float mask(vec2 uv) {
  float sky = texture(uDepth, uv).r >= 0.99999 ? 1.0 : 0.0;
  vec2 d = (uv - uSun) * vec2(uShaftParams.w, 1.0);
  return sky * smoothstep(uShaftParams.z, 0.0, length(d));
}
void main() {
  vec2 step = (uSun - vUV) / ${AIR_SHAFT_TAPS}.0;
  vec2 uv = vUV;
  float acc = 0.0, w = 1.0;
  for (int i = 0; i < ${AIR_SHAFT_TAPS}; i++) {
    acc += mask(uv) * w;
    w *= uShaftParams.x;
    uv += step;
  }
  outColor = vec4(uSunColor * (acc / ${AIR_SHAFT_TAPS}.0 * uShaftParams.y), 1.0);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uBloom;
uniform sampler2D uShaft;
uniform vec2 uGain;   // bloom, shafts
out vec4 outColor;
void main() {
  outColor = vec4(texture(uBloom, vUV).rgb * uGain.x + texture(uShaft, vUV).rgb * uGain.y, 1.0);
}`;

/** The emission-only fragment shaders for the bloom source: a solid's
 *  emission map in its colour (the window style, or white for a self-lit
 *  record); a flat's emission map behind its cutout. */
export const EMIT_MESH_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uEmissionTex;
uniform vec3 uEmissionColor;
out vec4 outColor;
void main() {
  outColor = vec4(texture(uEmissionTex, vUV).rgb * uEmissionColor, 1.0);
}`;
export const EMIT_BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
out vec4 outColor;
void main() {
  if (texture(uTex, vUV).a < 0.5) discard;
  outColor = vec4(texture(uEmissionTex, vUV).rgb, 1.0);
}`;

/** The lantern glare: a camera-facing quad at the light, collapsed to
 *  nothing when the depth image holds a surface in front of its centre. */
const GLARE_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCenter;
uniform float uSize;
uniform sampler2D uDepth;
out vec2 vUV;
out float vVis;
void main() {
  vec4 vc = uView * vec4(uCenter, 1.0);
  vec4 clip = uProj * vc;
  float vis = 0.0;
  if (clip.w > 0.0) {
    vec3 ndc = clip.xyz / clip.w;
    if (abs(ndc.x) < 1.2 && abs(ndc.y) < 1.2) {
      float d = texture(uDepth, ndc.xy * 0.5 + 0.5).r;
      vis = (ndc.z * 0.5 + 0.5) <= d + 0.002 ? 1.0 : 0.0;
    }
  }
  vVis = vis;
  vUV = aCorner;
  gl_Position = uProj * (vc + vec4(aCorner * uSize, 0.0, 0.0));
}`;
const GLARE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in float vVis;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  float r = length(vUV) * 2.0;
  float a = max(0.0, 1.0 - r * r);
  outColor = vec4(uColor * a * a * vVis, 1.0);
}`;

/**
 * The pass. `opts.build(vs, fs)` compiles; `opts.vs` is { mesh, bb } - the
 * renderer's own vertex shaders for the emission replay.
 */
export class AirPass {
  constructor(gl, opts) {
    this.gl = gl;
    const u = (p, n) => gl.getUniformLocation(p, n);
    const P = (vs, fs, names) => { const p = opts.build(vs, fs); const o = { p }; for (const n of names) o[n] = u(p, n); return o; };
    this.programs = {
      ao: P(QUAD_VS, AO_FS, ['uDepth', 'uProjInfo', 'uKernel', 'uAOParams']),
      box: P(QUAD_VS, BOX_FS, ['uSrc', 'uTexel']),
      gauss: P(QUAD_VS, GAUSS_FS, ['uSrc', 'uDir']),
      shaft: P(QUAD_VS, SHAFT_FS, ['uDepth', 'uSun', 'uShaftParams', 'uSunColor']),
      composite: P(QUAD_VS, COMPOSITE_FS, ['uBloom', 'uShaft', 'uGain']),
      emitMesh: P(opts.vs.mesh, EMIT_MESH_FS, ['uProj', 'uView', 'uModel', 'uEmissionTex', 'uEmissionColor']),
      emitBb: P(opts.vs.bb, EMIT_BB_FS, ['uProj', 'uView', 'uRight', 'uUp', 'uOrigin', 'uSize', 'uTex', 'uEmissionTex', 'uFlatWind', 'uSway']),
      glare: P(GLARE_VS, GLARE_FS, ['uProj', 'uView', 'uCenter', 'uSize', 'uDepth', 'uColor']),
    };
    // the fullscreen quad and the glare's corner quad
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.glareVao = gl.createVertexArray();
    gl.bindVertexArray(this.glareVao);
    const gb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.kernel = aoKernel();
    this.projInfo = new Float32Array(4);
    this.aoParams = new Float32Array([AIR_AO_RADIUS, AIR_AO_STRENGTH, AIR_AO_BIAS, 0]);
    this.shaftParams = new Float32Array([AIR_SHAFT_DECAY, AIR_SHAFT_STRENGTH, AIR_SHAFT_REACH, 1]);
    this.aoInfo = new Float32Array(4);
    this.gain = new Float32Array([AIR_BLOOM_STRENGTH, 1]);
    this.pending = false;   // a composite is owed to the frame
    this.width = 0; this.height = 0;
    this.targets = null;
    this.stats = { emitDraws: 0, glares: 0, shafts: false };
    this._identityView = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this._black = new Float32Array(3);
    this._white = new Float32Array([1, 1, 1]);
    this._zeroWind = new Float32Array(4);
    this._vp = new Float32Array(16);
  }

  /** (Re)allocate the images for a world viewport of w x h pixels. */
  resize(w, h) {
    if (this.targets && this.width === w && this.height === h) return;
    const gl = this.gl;
    if (this.targets) this._free();
    this.width = w; this.height = h;
    const color = (cw, ch) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo, w: cw, h: ch };
    };
    // the depth image: a depth texture, sampled plainly (no compare)
    const depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depthFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    const aw = Math.max(1, Math.round(w * AIR_AO_SCALE)), ah = Math.max(1, Math.round(h * AIR_AO_SCALE));
    const bw = Math.max(1, Math.round(w * AIR_BLOOM_SCALE)), bh = Math.max(1, Math.round(h * AIR_BLOOM_SCALE));
    this.targets = {
      depth: { tex: depthTex, fbo: depthFbo, w, h },
      ao: color(aw, ah), aoBlur: color(aw, ah),
      bloom: color(bw, bh), bloomB: color(bw, bh),
      shaft: color(bw, bh),
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  _free() {
    const gl = this.gl, t = this.targets;
    for (const k of Object.keys(t)) { gl.deleteTexture(t[k].tex); gl.deleteFramebuffer(t[k].fbo); }
    this.targets = null;
  }

  /**
   * Draw the frame's images. `f`: { proj, view, lightDir, sunScale,
   * sunColor, pointLights, pointColors (decoded vec3s), viewport [x,y,w,h],
   * shadows (the ShadowPass: its records and its depth programs), textures,
   * emissionTextures, blackTex, windowEmission, isSpectral, bindVao }.
   * Leaves no framebuffer bound; the caller's program shadow is dirty.
   */
  render(f) {
    const gl = this.gl, sp = f.shadows;
    const [, , w, h] = f.viewport;
    this.resize(w, h);
    const T = this.targets;
    this.stats.emitDraws = 0; this.stats.glares = 0; this.stats.shafts = false;
    projInfo(f.proj, this.projInfo);
    const vp = multiply(f.proj, f.view, this._vp);
    // 1. the depth image, from the records
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.depth.fbo);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    if (sp && sp.count > 0) sp.replay({ bindVao: f.bindVao, textures: f.textures, isSpectral: f.isSpectral }, vp, null);
    gl.colorMask(true, true, true, true);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    // 2. the ambient occlusion, then its box blur
    const quad = (prog, target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(prog.p);
      gl.bindVertexArray(this.quadVao);
    };
    gl.activeTexture(gl.TEXTURE0);
    quad(this.programs.ao, T.ao);
    gl.bindTexture(gl.TEXTURE_2D, T.depth.tex);
    gl.uniform1i(this.programs.ao.uDepth, 0);
    gl.uniform4fv(this.programs.ao.uProjInfo, this.projInfo);
    gl.uniform3fv(this.programs.ao.uKernel, this.kernel);
    gl.uniform4fv(this.programs.ao.uAOParams, this.aoParams);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    quad(this.programs.box, T.aoBlur);
    gl.bindTexture(gl.TEXTURE_2D, T.ao.tex);
    gl.uniform1i(this.programs.box.uSrc, 0);
    gl.uniform2f(this.programs.box.uTexel, 1 / T.ao.w, 1 / T.ao.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.aoInfo[0] = f.viewport[0]; this.aoInfo[1] = f.viewport[1]; this.aoInfo[2] = w; this.aoInfo[3] = h;
    // 3. the bloom source: the emitters, and a glare per lantern
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.bloom.fbo);
    gl.viewport(0, 0, T.bloom.w, T.bloom.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);   // the emitters and the glares add; the target has no depth, the glares hide by the depth image themselves
    gl.blendFunc(gl.ONE, gl.ONE);
    if (sp && sp.count > 0) this._replayEmission(f, sp, vp);
    this._glares(f);
    gl.disable(gl.BLEND);
    // ...blurred, twice, across the two bloom images
    for (let pass = 0; pass < 2; pass++) {
      quad(this.programs.gauss, T.bloomB);
      gl.bindTexture(gl.TEXTURE_2D, T.bloom.tex);
      gl.uniform1i(this.programs.gauss.uSrc, 0);
      gl.uniform2f(this.programs.gauss.uDir, 1 / T.bloom.w, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      quad(this.programs.gauss, T.bloom);
      gl.bindTexture(gl.TEXTURE_2D, T.bloomB.tex);
      gl.uniform2f(this.programs.gauss.uDir, 0, 1 / T.bloom.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // 4. the shafts, when the sun is up and in front of the camera
    const sun = f.sunScale > 0.01 && f.lightDir && f.lightDir[1] > 0 ? sunScreenUV(f.proj, f.view, f.lightDir) : null;
    quad(this.programs.shaft, T.shaft);
    if (sun) {
      gl.bindTexture(gl.TEXTURE_2D, T.depth.tex);
      gl.uniform1i(this.programs.shaft.uDepth, 0);
      gl.uniform2f(this.programs.shaft.uSun, sun[0], sun[1]);
      this.shaftParams[3] = w / h;
      gl.uniform4fv(this.programs.shaft.uShaftParams, this.shaftParams);
      gl.uniform3fv(this.programs.shaft.uSunColor, f.sunColor);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.shafts = true;
    } else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(f.clearColor[0], f.clearColor[1], f.clearColor[2], f.clearColor[3]);
    this.pending = true;
  }

  _replayEmission(f, sp, vp) {
    const gl = this.gl, P = this.programs;
    let bound = null;
    for (let i = 0; i < sp.count; i++) {
      const r = sp.records[i];
      if (r.kind === 0) {
        const mesh = r.mesh;
        if (!mesh?.vao || mesh._dead || !mesh.subMeshes?.length) continue;
        if (bound !== P.emitMesh) { bound = P.emitMesh; gl.useProgram(bound.p); gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView); gl.uniform1i(bound.uEmissionTex, 1); }
        gl.uniformMatrix4fv(P.emitMesh.uModel, false, r.matrix);
        f.bindVao(mesh.vao);
        for (const sm of mesh.subMeshes) {
          const emis = sm._evEmis;
          if (!emis || emis === f.blackTex) continue;   // nothing to bloom: the main pass resolved no mask, or the black one
          gl.uniform3fv(P.emitMesh.uEmissionColor, sm._evEmisWhite ? this._white : f.windowEmission);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, emis);
          gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
          this.stats.emitDraws++;
        }
      } else if (r.kind === 2) {
        for (const b of r.batches) {
          if (!b?.vao || b._dead || b.conceal) continue;
          const key = b._bbKey ?? (b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`);
          const emis = f.emissionTextures.get(key);
          const tex = f.textures.get(key);
          if (!emis || !tex) continue;
          if (bound !== P.emitBb) {
            bound = P.emitBb; gl.useProgram(bound.p);
            gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView);
            gl.uniform1i(bound.uTex, 0); gl.uniform1i(bound.uEmissionTex, 1);
            gl.uniform4fv(bound.uFlatWind, r.flatWind);
          }
          gl.uniform3fv(P.emitBb.uRight, r.right); gl.uniform3fv(P.emitBb.uUp, r.up);   // the camera basis the batch was drawn with
          const o = b.origin || [0, 0, 0];
          gl.uniform3f(P.emitBb.uOrigin, o[0], o[1], o[2]);
          gl.uniform2f(P.emitBb.uSize, b.size.w, b.size.h);
          gl.uniform1f(P.emitBb.uSway, b.sway || 0);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, emis);
          f.bindVao(b.vao);
          gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
          this.stats.emitDraws++;
        }
      }
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  _glares(f) {
    const gl = this.gl, P = this.programs.glare, L = f.pointLights, C = f.pointColors;
    const n = L.length >> 2;
    if (n === 0) return;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.uProj, false, f.proj);
    gl.uniformMatrix4fv(P.uView, false, f.view);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.depth.tex);
    gl.uniform1i(P.uDepth, 0);
    gl.bindVertexArray(this.glareVao);
    for (let i = 0; i < n; i++) {
      const range = L[i * 4 + 3];
      if (!(range > 0)) continue;
      gl.uniform3f(P.uCenter, L[i * 4], L[i * 4 + 1], L[i * 4 + 2]);
      gl.uniform1f(P.uSize, glareSize(range));
      gl.uniform3f(P.uColor, C ? C[i * 3] : 1, C ? C[i * 3 + 1] : 1, C ? C[i * 3 + 2] : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.glares++;
    }
  }

  /** Bind the AO image on its unit and upload the receiver's two uniforms
   *  for one program (`loc`: ao, aoInfo). */
  upload(loc) {
    const gl = this.gl;
    if (!this.targets) return;
    gl.activeTexture(gl.TEXTURE0 + AIR_AO_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.aoBlur.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.ao, AIR_AO_UNIT);
    gl.uniform4fv(loc.aoInfo, this.aoInfo);
  }

  /** Add the bloom and the shafts over the world viewport. Called by the
   *  frame's first screen-space draw; a no-op until a render is owed. */
  composite() {
    if (!this.pending || !this.targets) return;
    this.pending = false;
    const gl = this.gl, P = this.programs.composite, T = this.targets;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(this.aoInfo[0], this.aoInfo[1], this.aoInfo[2], this.aoInfo[3]);
    gl.useProgram(P.p);
    gl.bindVertexArray(this.quadVao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.bloom.tex); gl.uniform1i(P.uBloom, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.shaft.tex); gl.uniform1i(P.uShaft, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2fv(P.uGain, this.gain);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
  }
}
