// @ts-check
// HAZE1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments seamlessly") -
// HEAT HAZE's RING, DRAWN. The translation of the mod's one shader, `Daggerfall/Mods/HeatHaze`
// (vendor/heat-haze/shaders/HeatHaze.glsl, read back from its DXBC), and of the mesh and textures HeatHazeMod makes
// (CreateCylinderMesh, CreateNoiseTexture - systems/heatHaze.js hazeNoise).
//
// THE PASS, AS UNITY RAN IT: a GrabPass (`_HeatHazeGrabTexture`) - the frame as it stands, copied - then the ring
// drawn at Transparent-100 with ZWrite Off and Cull Off over the copy: every fragment of the ring that the depth test
// lets through (what lies BEYOND it - the far land, the sky) writes the copy back, read a few pixels aside. The near
// world fails the test and is untouched. Here: `copyTexSubImage2D` of the world's viewport out of whatever the world
// draws into (the canvas, the air's frame image or the retro image - every one single-sampled RGBA8), then the ring
// with DEPTH_TEST on and the depth mask and CULL_FACE off, then the renderer's baseline back (the host calls
// markForeignPass after, EV6).
//
// THE SHADER, LINE FOR LINE (HeatHaze.glsl's two programs):
//   vertex   - world position; the object-space y kept for the fade (`o2.w = v0.y`);
//   fragment - edge = saturate((|y| - 25) / 45); s = smoothstep(edge); discard where 0.9999 - s < 0; strength =
//              (1 - s) x _IntensityPixels. The noise is read twice over the world: across x and z turned two ways -
//              (0.9239, 0.3827) and (-0.4226, 0.9063) - and up y x 1.5, scaled by _NoiseScale x 0.0022, times 3.6 and
//              7.2, and run by _AnimationSpeed x _Time.y x (0.026, -0.30) and (-0.043, -0.48); the bend is
//              (n1.xy - 0.5) x 1.15 + (n2.yx - 0.5) x 0.85, x (0.3, 1), x strength, over the target's size in pixels.
//   TWO PLACES THE PORT'S SPACES DIFFER, AND ONLY THEY: Direct3D's grab texture runs top-down, so a bend down the
//   screen is +v there and -v here (the y of the bend is turned); and the noise is read off WORLD space, which the
//   port's floating origin moves under the scene at every map pixel crossed - so the scene's position is read in the
//   shader as Unity read its own, and the origin's displacement, and the clock's, are added as one phase per sample
//   worked out in double precision on the CPU (`uPhase`, fract'd: the noise wraps), so the shimmer stands on the land
//   across a crossing and never loses precision to an hours-long clock.
//
// ENHANCED ONLY: the hosts build it on the enhanced lane (sky.enhanced) and draw it while the mod's switch is on.

import { buildProgram } from './glProgram.js';
import { HAZE, hazeNoise } from '../systems/heatHaze.js';

/** The two noise reads' world axes and scales (HeatHaze.glsl, verbatim). */
export const HAZE_AXES = Object.freeze({ a: [0.9239, 0.3827], b: [-0.4226, 0.9063], up: 1.5, scale: 0.0022, k1: 3.6, k2: 7.2 });
/** The two reads' drift per second of _AnimationSpeed x _Time.y: (u1, v1, u2, v2). */
export const HAZE_DRIFT = Object.freeze([0.026, -0.30, -0.043, -0.48]);

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCenter;
uniform vec3 uScale;
out vec3 vWorld;
out float vObjY;
void main() {
  vec3 w = uCenter + aPos * uScale;
  vWorld = w;
  vObjY = aPos.y;
  gl_Position = uProj * uView * vec4(w, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in float vObjY;
uniform sampler2D uNoise;
uniform sampler2D uGrab;
uniform float uIntensity;   // _IntensityPixels (the eased strength)
uniform float uNoiseScale;  // _NoiseScale
uniform vec4 uPhase;        // the origin's and the clock's displacement of the two reads, fract'd
uniform vec4 uPort;         // the world's viewport: x, y, width, height in pixels
out vec4 outColor;
void main() {
  float edge = clamp((abs(vObjY) - 25.0) * 0.0222222228, 0.0, 1.0);
  float s = edge * edge * (3.0 - 2.0 * edge);
  if (0.9999 - s < 0.0) discard;
  float strength = (1.0 - s) * uIntensity;
  float k = uNoiseScale * 0.0022;
  vec4 r1 = vec4(dot(vWorld.xz, vec2(0.9239, 0.3827)), vWorld.y * 1.5, dot(vWorld.xz, vec2(-0.4226, 0.9063)), vWorld.y * 1.5) * k;
  vec4 uv = r1 * vec4(3.6, 3.6, 7.2, 7.2) + uPhase;
  vec2 n1 = texture(uNoise, uv.xy).xy - 0.5;
  vec2 n2 = texture(uNoise, uv.zw).yx - 0.5;
  vec2 bend = (n1 * 1.15 + n2 * 0.85) * vec2(0.3, 1.0) * strength;
  bend.y = -bend.y;   // Direct3D's grab is top-down
  vec2 grabUv = (gl_FragCoord.xy - uPort.xy) / uPort.zw + bend / max(uPort.zw, vec2(1.0));
  outColor = texture(uGrab, grabUv);
}`;

/** CreateCylinderMesh: 128 sides of a unit circle, y +-70, two triangles a side - positions and indices. */
export function hazeCylinder(segments = HAZE.cylinderSegments, half = HAZE.cylinderHalfHeight) {
  const pos = new Float32Array(segments * 2 * 3);
  const idx = new Uint16Array(segments * 6);
  for (let i = 0; i < segments; i++) {
    const a = Math.fround(Math.fround(Math.fround(i) * Math.fround(Math.PI)) * 2 / segments);
    const c = Math.cos(a), s = Math.sin(a);
    pos.set([c, -half, s, c, half, s], i * 6);
    const n = (i + 1) % segments, o = i * 6;
    idx.set([i * 2, n * 2 + 1, i * 2 + 1, i * 2, n * 2, n * 2 + 1], o);
  }
  return { pos, idx };
}

/** The two reads' phases for a world displacement `anchor` ([x, y, z] metres the scene sits from the land) and the
 *  clock (`speedTime` = _AnimationSpeed x seconds) at `noiseScale` - each fract'd, as the wrapped texture reads it -
 *  into `out` (the draw's own four: no array a frame - AUDIT ENVIRONS W7). */
export function hazePhase(anchor, speedTime, noiseScale, out = [0, 0, 0, 0]) {
  const k = noiseScale * HAZE_AXES.scale;
  const ax = anchor[0] * HAZE_AXES.a[0] + anchor[2] * HAZE_AXES.a[1];
  const bx = anchor[0] * HAZE_AXES.b[0] + anchor[2] * HAZE_AXES.b[1];
  const up = anchor[1] * HAZE_AXES.up;
  out[0] = ax * k * HAZE_AXES.k1; out[1] = up * k * HAZE_AXES.k1; out[2] = bx * k * HAZE_AXES.k2; out[3] = up * k * HAZE_AXES.k2;
  for (let i = 0; i < 4; i++) { const v = out[i] + speedTime * HAZE_DRIFT[i]; out[i] = v - Math.floor(v); }
  return out;
}

export class HeatHazeRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, VS, FS, 'heat haze');
    const L = (n) => gl.getUniformLocation(this.prog, n);
    this.loc = {
      proj: L('uProj'), view: L('uView'), center: L('uCenter'), scale: L('uScale'), noise: L('uNoise'), grab: L('uGrab'),
      intensity: L('uIntensity'), noiseScale: L('uNoiseScale'), phase: L('uPhase'), port: L('uPort'),
    };
    const { pos, idx } = hazeCylinder();
    this.count = idx.length;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    this.ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    // the noise: 64 x 64 RGBA, bilinear, repeating, no mips (CreateNoiseTexture's import)
    this.noise = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, HAZE.noiseSize, HAZE.noiseSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, hazeNoise());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // the grab: the world's viewport, sized on its first use and whenever the viewport changes
    this.grab = gl.createTexture();
    this.grabW = 0; this.grabH = 0;
    gl.bindTexture(gl.TEXTURE_2D, null);
    /** The land's displacement from the scene, metres, kept across the floating origin's shifts (double precision). */
    this.anchor = [0, 0, 0];
    this._phase = [0, 0, 0, 0];
  }

  /** The floating origin moved the scene by `offset` (the hosts' `state.update` answer): the land did not move. */
  offsetOrigin(offset) {
    if (!offset) return;
    this.anchor[0] -= offset[0]; this.anchor[1] -= offset[1]; this.anchor[2] -= offset[2];
  }

  /**
   * Draw the ring over the frame as it stands. `state` is systems/heatHaze.js createHeatHaze().tick's answer;
   * `viewport` the world's pixel rect ([x, y, w, h], the renderer's worldViewportPx or the drawing buffer's whole);
   * `seconds` the shader's clock (Unity's _Time.y: the game's seconds - systems/heatHaze.js tick's `seconds`). Answers true when it drew (the host then marks the foreign pass).
   * @param {{visible: boolean, intensity: number, center: number[], radius: number, halfHeight: number, noiseScale: number, animationSpeed: number}} state
   * @param {Float32Array|number[]} proj @param {Float32Array|number[]} view @param {number[]} viewport @param {number} seconds
   */
  draw(state, proj, view, viewport, seconds) {
    if (!state?.visible) return false;
    const gl = this.gl;
    const [vx, vy, vw, vh] = viewport;
    if (!(vw > 0 && vh > 0)) return false;
    // the GrabPass: the frame's colour, as it stands, into the grab texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.grab);
    if (vw !== this.grabW || vh !== this.grabH) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, vw, vh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.grabW = vw; this.grabH = vh;
    }
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, vx, vy, vw, vh);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    // the ring: ZWrite Off, Cull Off, no blend - the depth test is what keeps the near world out of it
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.loc.proj, false, proj);
    gl.uniformMatrix4fv(this.loc.view, false, view);
    gl.uniform3f(this.loc.center, state.center[0], state.center[1], state.center[2]);
    gl.uniform3f(this.loc.scale, state.radius, state.halfHeight / HAZE.cylinderHalfHeight, state.radius);
    gl.uniform1i(this.loc.noise, 0);
    gl.uniform1i(this.loc.grab, 1);
    gl.uniform1f(this.loc.intensity, state.intensity);
    gl.uniform1f(this.loc.noiseScale, state.noiseScale);
    gl.uniform4fv(this.loc.phase, hazePhase(this.anchor, state.animationSpeed * seconds, state.noiseScale, this._phase));
    gl.uniform4f(this.loc.port, vx, vy, vw, vh);
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    // the baseline back (renderer.js's: depth written, back faces culled)
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    return true;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the host's teardown. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.prog);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
    gl.deleteBuffer(this.ebo);
    gl.deleteTexture(this.noise);
    gl.deleteTexture(this.grab);
  }
}
