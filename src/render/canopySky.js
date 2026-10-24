// @ts-check
// VALENWOOD-CANOPY (2026-10-24, bible/03-World/Tamriel-Biomes.md "Valenwood's closed canopy"; the owner: "i want valenwood
// to have no sky like the trees will cover it up") - THE CEILING OF LEAVES over every sky pass. The sun baby's contract
// (render/sunbabySkyRenderer.js): draw(yaw, pitch, fovY, aspect) after the sky and its clouds, at the far plane (LEQUAL
// passes only the cleared depth, so the land and the trees stand over it), blended over what is there - here by the
// canopy's weight and its leaves' cover. At weight 0 it draws nothing. world/jungle/jungleCanopy.js is its law
// (canopyUniforms writes uCanopy), scenes/shared.js's sky controller its host.
//
// THE CEILING. A view ray meets a level ceiling at the canopy's height over the eye (uCanopy[1].z), at a place fixed to
// the world (uCanopy[1].xy, the eye's own wrapped at JUNGLE_CANOPY.period - the lattice below repeats at it, so the wrap
// shows no seam); there four octaves of value noise (8, 4, 2 and 1 m) are the leaves, and a ridged octave of 16 m the
// branches across them. Straight overhead a share uCanopy[1].w of it opens on the sky behind; toward the horizon it
// closes - a ray that far off meets the canopy's depth, not its underside - and its detail fades as the ray's footprint
// grows (no shimmer at the horizon). A leaf by an opening is lit through, yellow-green; the rest is its underside
// (uCanopy[0].rgb, the frame's fog colour as the leaves pass it). Over it all the haze's own horizon (render/hazeGlsl.js
// hazeSky), so the canopy and the land close into one air.

import { buildProgram } from './glProgram.js';   // the one compile and link
import { HAZE_SKY_GLSL } from './hazeGlsl.js';

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 1.0, 1.0); }`;   // AT the far plane, as the sky's

/** The ceiling's law, a block the tests run in the repo's GLSL reader (test/glsl.mjs): canopyCover(dir) - [the leaves'
 *  colour, their cover 0..1] along a view ray `dir` (unit, y up). */
export const CANOPY_SKY_GLSL = `
uniform vec4 uCanopy[2];   // [0] rgb the leaves' underside, w the weight | [1] xy the eye's place (m, wrapped), z the ceiling over the eye (m), w the open share overhead
const float CANOPY_PERIOD = 2048.0;   // JUNGLE_CANOPY.period - every octave's cell divides it
float canopyHash(vec2 c, float n) {   // a hash without sine (its precision the same on every GPU), its lattice wrapped at n
  vec3 p3 = fract(vec3(mod(c, n).xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float canopyNoise(vec2 p, float cell) {
  vec2 q = p / cell;
  vec2 i = floor(q), f = q - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = CANOPY_PERIOD / cell;
  float a = canopyHash(i, n), b = canopyHash(i + vec2(1.0, 0.0), n), c = canopyHash(i + vec2(0.0, 1.0), n), d = canopyHash(i + vec2(1.0, 1.0), n);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec4 canopyCover(vec3 dir) {
  float up = max(dir.y, 0.02);
  vec2 p = uCanopy[1].xy + dir.xz * (uCanopy[1].z / up);
  float detail = smoothstep(0.12, 0.45, dir.y);   // the footprint grows toward the horizon: its detail fades there
  float leaves = 0.5 * canopyNoise(p, 8.0) + 0.25 * canopyNoise(p, 4.0) + 0.15 * canopyNoise(p, 2.0) + 0.1 * canopyNoise(p, 1.0);
  leaves = mix(0.5, leaves, detail);
  float open = uCanopy[1].w * smoothstep(0.35, 0.95, dir.y);   // a share of it open straight overhead, none toward the horizon
  float edge = 0.81 - 0.45 * sqrt(open);   // the leaves' level a share open of the ceiling stands over (their sum's measured spread)
  float gap = smoothstep(edge - 0.012, edge + 0.012, leaves) * step(1e-4, open);
  float lit = smoothstep(edge - 0.12, edge, leaves) * detail;   // a leaf by an opening, lit through
  float branch = smoothstep(0.92, 0.98, 1.0 - abs(2.0 * canopyNoise(p + vec2(37.0, 11.0), 16.0) - 1.0)) * detail;
  vec3 c = uCanopy[0].rgb * (0.7 + 0.6 * leaves);
  c += uCanopy[0].rgb * vec3(2.4, 2.8, 1.2) * lit;
  c *= 1.0 - 0.6 * branch;
  return vec4(c, (1.0 - gap) * clamp(uCanopy[0].w, 0.0, 1.0));
}`;

/** The pass's fragment shader - the sky's ray, the ceiling along it, the haze's horizon over it. */
export const CANOPY_SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform float uYaw, uPitch, uTanHalfFov, uAspect;
out vec4 outColor;
${CANOPY_SKY_GLSL}
${HAZE_SKY_GLSL}
void main() {
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 dir = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));
  vec4 c = canopyCover(dir);
  outColor = vec4(hazeSky(c.rgb, dir), c.a);
}`;

export const CANOPY_SKY_UNIFORMS = Object.freeze(['uYaw', 'uPitch', 'uTanHalfFov', 'uAspect', 'uCanopy', 'uHazeSky']);

export class CanopySkyRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, VS, CANOPY_SKY_FS, 'canopy sky');
    this.u = {};
    for (const name of CANOPY_SKY_UNIFORMS) this.u[name] = gl.getUniformLocation(this.program, name);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    /** The canopy's eight uniforms (world/jungle/jungleCanopy.js canopyUniforms) - the host's; [3] 0 none. */
    this.canopy = new Float32Array(8);
    /** The jungle's haze over the sky (render/hazeGlsl.js uHazeSky) - the host's, w 0 none. */
    this.hazeSky = new Float32Array(4);
  }

  draw(yaw, pitch, fovY, aspect) {
    if (!(this.canopy[3] > 0)) return;
    const gl = this.gl, u = this.u;
    gl.useProgram(this.program);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);   // only where nothing nearer has drawn - z is the far plane
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);   // over the sky by its cover; the buffer's alpha untouched
    gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform4fv(u.uCanopy, this.canopy);
    gl.uniform4fv(u.uHazeSky, this.hazeSky);
    gl.disable(gl.CULL_FACE);   // the triangle winds CCW under a CW front face, as the sky's
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
  }
}
