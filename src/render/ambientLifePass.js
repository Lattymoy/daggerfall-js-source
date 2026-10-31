// @ts-check
// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): THE CREATURES' PASS. Every bird, bat, butterfly and runner in one
// instanced draw of 39 vertices each, the body built in the vertex stage from its kind's measures (systems/ambientLife/
// ambientCast.js AL_KINDS) - wings that beat, fold and glide, legs that step - so no picture is loaded and no ARENA2
// art is drawn. Two-sided: the eye under a wing sees its underside's colour. Lit by the flats' light at the player
// (renderer.flatLightAt) and fogged as the terrain is; the fireflies a second, added draw of glowing points.
import { buildProgram } from './glProgram.js';
import { FOG_GLSL } from './fogGlsl.js';
import { AL_KIND_LIST } from '../systems/ambientLife/ambientCast.js';
import { AL_INSTANCE_FLOATS, AL_MAX_INSTANCES } from '../systems/ambientLife/ambientBody.js';

/** Vertices a body is built from: thirteen triangles - a bird's body seen from below and from the side, its tail and two
 *  wings of three; a runner's back, head, tail and four legs. */
export const AL_BODY_VERTS = 39;
const KINDS = 16;

const VS = `#version 300 es
precision highp float;
layout(location=0) in float aVertex;
layout(location=1) in vec4 aPlace;   // x, y, z, scale
layout(location=2) in vec4 aTurn;    // yaw, pitch, bank, phase
layout(location=3) in vec4 aWing;    // spread, amp, kind, glow
layout(location=4) in vec4 aColor;   // rgb, the underside's lift
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCamPos;
uniform vec4 uKindA[${KINDS}];
uniform vec4 uKindB[${KINDS}];
uniform float uShape[${KINDS}];
uniform vec3 uLight;
uniform int uGlowPass;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uPixel;
out vec3 vWorld;
out vec3 vColor;
out vec2 vUV;

vec3 turn(vec3 p, vec3 a) {   // bank about the body, pitch the nose, then the heading (+z is forward at yaw 0)
  float cb = cos(a.z), sb = sin(a.z);
  p = vec3(p.x * cb - p.y * sb, p.x * sb + p.y * cb, p.z);
  float cp = cos(a.y), sp = sin(a.y);
  p = vec3(p.x, p.y * cp + p.z * sp, -p.y * sp + p.z * cp);
  float cy = cos(a.x), sy = sin(a.x);
  return vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
}
vec3 pick(int c, vec3 a, vec3 b, vec3 d) { return c == 0 ? a : c == 1 ? b : d; }

// A winged body's corner c of triangle t: 0-1 the body from below, 2 the tail, 3-5 and 6-8 the wings (inner to tip),
// 9-12 the body's side - beak, crown, back, tail and breast - so a bird on a roof has a shape from the side.
vec3 wingCorner(int t, int c, vec4 A, vec4 B, float spread, float amp, float phase) {
  float L = A.y;
  if (t < 2) {
    float s = t == 0 ? -1.0 : 1.0;
    return pick(c, vec3(0.0, 0.0, L * 0.5), vec3(s * L * 0.14, 0.0, L * 0.05), vec3(0.0, 0.0, -L * 0.5));
  }
  if (t == 2) return pick(c, vec3(0.0, 0.0, -L * 0.3), vec3(-B.y, 0.0, -L * 0.5 - B.x), vec3(B.y, 0.0, -L * 0.5 - B.x));
  if (t > 8) {
    vec3 beak = vec3(0.0, 0.1, 0.58) * L, crown = vec3(0.0, 0.3, 0.34) * L, back = vec3(0.0, 0.2, 0.05) * L;
    vec3 rump = vec3(0.0, 0.06, -0.35) * L, belly = vec3(0.0, -0.16, -0.05) * L, breast = vec3(0.0, -0.08, 0.3) * L;
    if (t == 9) return pick(c, beak, crown, breast);
    if (t == 10) return pick(c, crown, back, breast);
    if (t == 11) return pick(c, back, belly, breast);
    return pick(c, back, rump, belly);
  }
  float span = A.x * mix(0.3, 1.0, spread);
  float sweep = B.z + (1.0 - spread) * A.x * 0.6;   // folded, the wing lies back along the body
  float a1 = mix(-0.35, B.w + amp * sin(phase), spread);
  float a2 = a1 + mix(-0.4, amp * 0.55 * sin(phase - 1.1), spread);   // the outer wing lags the inner
  float s = t < 6 ? 1.0 : -1.0;
  int k = t - (t < 6 ? 3 : 6);
  vec3 d1 = vec3(s * cos(a1), sin(a1), 0.0), d2 = vec3(s * cos(a2), sin(a2), 0.0);
  vec3 root = vec3(s * L * 0.07, 0.0, L * 0.08);
  vec3 mid = root + d1 * span * 0.45 - vec3(0.0, 0.0, sweep * 0.35);
  vec3 tip = mid + d2 * span * 0.55 - vec3(0.0, 0.0, sweep);
  vec3 h1 = vec3(0.0, 0.0, A.z * 0.5), h2 = vec3(0.0, 0.0, A.w * 0.5);
  if (k == 0) return pick(c, root + h1, root - h1, mid - h2);
  if (k == 1) return pick(c, root + h1, mid - h2, mid + h2);
  return pick(c, mid + h2, mid - h2, tip);
}

// A runner's corner c of triangle t: 0-3 its back, 4-7 its head (none on a crab, B.w), 8 its tail, 9-12 its legs, the
// feet stepping in pairs.
vec3 runnerCorner(int t, int c, vec4 A, vec4 B, float phase, float amp) {
  float L = A.x, W = A.y, H = A.z;
  if (t < 4) {
    vec3 spine = vec3(0.0, H, -L * 0.05), nose = vec3(0.0, H * 0.55, L * 0.38), tail = vec3(0.0, H * 0.45, -L * 0.5);
    vec3 l = vec3(-W, H * 0.3, 0.0), r = vec3(W, H * 0.3, 0.0);
    if (t == 0) return pick(c, nose, l, spine);
    if (t == 1) return pick(c, l, tail, spine);
    if (t == 2) return pick(c, tail, r, spine);
    return pick(c, r, nose, spine);
  }
  if (t < 8) {
    if (B.w > 0.5) return vec3(0.0, H * 0.5, 0.0);
    float hw = W * 0.65;
    vec3 crown = vec3(0.0, H * 0.85, L * 0.42), snout = vec3(0.0, H * 0.4, L * 0.5 + W * 1.3);
    vec3 l = vec3(-hw, H * 0.5, L * 0.42), r = vec3(hw, H * 0.5, L * 0.42), nape = vec3(0.0, H * 0.55, L * 0.3);
    if (t == 4) return pick(c, snout, l, crown);
    if (t == 5) return pick(c, l, nape, crown);
    if (t == 6) return pick(c, nape, r, crown);
    return pick(c, r, snout, crown);
  }
  if (t == 8) {
    float tw = max(B.x, 0.006);
    return pick(c, vec3(-tw, H * 0.45, -L * 0.45), vec3(tw, H * 0.45, -L * 0.45), vec3(0.0, H * 0.4 + B.y, -L * 0.5 - A.w));
  }
  int leg = t - 9;
  float s = (leg == 0 || leg == 2) ? -1.0 : 1.0, f = leg < 2 ? 1.0 : -1.0;
  float pair = (leg == 0 || leg == 3) ? 0.0 : 3.14159;   // diagonal pairs step together
  vec3 hip = vec3(s * W * 0.7, H * 0.35, f * L * 0.22);
  vec3 foot = vec3(s * (W * 0.7 + B.z), 0.0, f * L * 0.22 + sin(phase + pair) * amp * L * 0.18);
  return pick(c, hip, hip - vec3(0.0, 0.0, max(0.02, L * 0.08)), foot);
}

vec3 corner(int t, int c, float shape, vec4 A, vec4 B) {
  return shape < 0.5 ? wingCorner(t, c, A, B, aWing.x, aWing.y, aTurn.w) : runnerCorner(t, c, A, B, aTurn.w, aWing.y);
}

void main() {
  int kind = int(aWing.z + 0.5);
  vec4 A = uKindA[kind], B = uKindB[kind];
  if (uGlowPass == 1) {
    int k = int(aVertex + 0.5);
    vec2 c = k == 0 ? vec2(0.0) : k == 1 || k == 4 ? vec2(1.0, 0.0) : k == 2 || k == 3 ? vec2(0.0, 1.0) : vec2(1.0);
    float s = max(A.x * aPlace.w * 4.0, length(aPlace.xyz - uCamPos) * uPixel * 3.0);   // never under three pixels
    vec3 w = aPlace.xyz + (uRight * (c.x - 0.5) + uUp * (c.y - 0.5)) * s;
    vUV = c; vWorld = w; vColor = aColor.rgb * aWing.w;
    gl_Position = uProj * uView * vec4(w, 1.0);
    return;
  }
  int v = int(aVertex + 0.5), t = v / 3;
  float shape = uShape[kind];
  vec3 p0 = corner(t, 0, shape, A, B), p1 = corner(t, 1, shape, A, B), p2 = corner(t, 2, shape, A, B);
  vec3 p = pick(v - t * 3, p0, p1, p2);
  vec3 w = aPlace.xyz + turn(p * aPlace.w, aTurn.xyz);
  // the face's own normal, turned to the eye: an underside seen from below wears the underside's colour
  vec3 n = cross(p1 - p0, p2 - p0);
  n = length(n) > 1e-9 ? normalize(turn(n, aTurn.xyz)) : vec3(0.0, 1.0, 0.0);
  if (dot(n, uCamPos - w) < 0.0) n = -n;
  vec3 col = n.y < -0.25 ? mix(aColor.rgb, vec3(0.9, 0.88, 0.82), aColor.a) * 0.85 : aColor.rgb;
  vColor = col * uLight * (0.72 + 0.28 * clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
  vWorld = w; vUV = vec2(0.0);
  gl_Position = uProj * uView * vec4(w, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vColor;
in vec2 vUV;
uniform highp int uGlowPass;   // the vertex stage's int is highp; a uniform both stages read agrees
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${FOG_GLSL}
out vec4 o;
void main() {
  float f = fogFactorAt(vWorld);
  if (uGlowPass == 1) {
    float r = length(vUV - 0.5) * 2.0;
    float a = smoothstep(0.4, 0.0, r) + pow(max(0.0, 1.0 - r), 2.0) * 0.35;   // a hot core in a soft halo
    o = vec4(dwWaterFogAdd(vColor * a * f, vWorld), 0.0);
    return;
  }
  o = vec4(dwWaterFog(mix(uFogColor, vColor, f), vWorld), 1.0);
}`;
// SHADER-EASE: the host builds it through compiledPass (glProgram.js), started at the first frame that has a creature.
export const AMBIENT_LIFE_PROGRAMS = Object.freeze([Object.freeze(/** @type {const} */ ([VS, FS]))]);

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const NO_HAZE = new Float32Array(8);
const NO_WATER_FOG = new Float32Array(20);
const STRIDE = AL_INSTANCE_FLOATS * 4;
const UNIFORMS = ['uProj', 'uView', 'uCamPos', 'uKindA', 'uKindB', 'uShape', 'uLight', 'uGlowPass', 'uRight', 'uUp', 'uPixel',
  'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uFocus', 'uJungleHaze', 'uDwFog'];

/** The kinds' measures as the vertex stage reads them. */
export function kindTables() {
  const a = new Float32Array(KINDS * 4), b = new Float32Array(KINDS * 4), shape = new Float32Array(KINDS);
  for (const k of AL_KIND_LIST) {
    a.set(k.a, k.id * 4); b.set(k.b, k.id * 4); shape[k.id] = k.shape;
  }
  return { a, b, shape };
}

export class AmbientLifePass {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    if (AL_KIND_LIST.length > KINDS) throw new Error(`ambient life: ${AL_KIND_LIST.length} kinds, the pass holds ${KINDS}`);
    this.gl = gl;
    this.prog = buildProgram(gl, VS, FS, 'ambient life');
    /** @type {Record<string, WebGLUniformLocation|null>} */
    this.loc = {};
    for (const n of UNIFORMS) this.loc[n] = gl.getUniformLocation(this.prog, n);
    const t = kindTables();
    gl.useProgram(this.prog);
    gl.uniform4fv(this.loc.uKindA, t.a); gl.uniform4fv(this.loc.uKindB, t.b); gl.uniform1fv(this.loc.uShape, t.shape);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.verts = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verts);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from({ length: AL_BODY_VERTS }, (_, i) => i), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 4, 0);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, AL_MAX_INSTANCES * STRIDE, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribDivisor(1 + i, 1); }
    this.point(0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** The instance attributes read from instance `first` on (the buffer bound). */
  point(first) {
    const gl = this.gl;
    for (let i = 0; i < 4; i++) gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE, first * STRIDE + i * 16);
  }

  /**
   * Draw `solid` bodies, then `glow` lights after them, from `instances`. `r` the renderer (its fog, its eye), `light`
   * the flats' light, `heightPx` the world image's height (a light's least size). Answers whether it drew.
   * @param {any} r @param {Float32Array|number[]} proj @param {Float32Array|number[]} view @param {ArrayLike<number>} light
   * @param {Float32Array} instances @param {number} solid @param {number} glow @param {number} heightPx
   */
  draw(r, proj, view, light, instances, solid, glow, heightPx) {
    const gl = this.gl, L = this.loc, n = solid + glow;
    if (!n) return false;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(L.uProj, false, proj);
    gl.uniformMatrix4fv(L.uView, false, view);
    gl.uniform3fv(L.uCamPos, r._camPos);
    gl.uniform3f(L.uLight, light[0], light[1], light[2]);
    gl.uniform3f(L.uRight, view[0], view[4], view[8]);
    gl.uniform3f(L.uUp, view[1], view[5], view[9]);
    gl.uniform1f(L.uPixel, 2 / (Math.abs(proj[5]) * Math.max(1, heightPx)));
    gl.uniform3fv(L.uFogColor, r._fogColor);
    gl.uniform1i(L.uFogMode, r._fogMode ?? 0);
    gl.uniform1f(L.uFogDensity, r._fogDensity ?? 0);
    gl.uniform2fv(L.uFogRange, r._fogRange ?? NO_FOG_RANGE);
    if (L.uFocus) gl.uniform4fv(L.uFocus, r._focus ?? NO_FOCUS);
    if (L.uJungleHaze) gl.uniform4fv(L.uJungleHaze, r._haze ?? NO_HAZE);
    if (L.uDwFog) gl.uniform4fv(L.uDwFog, r._dwFog ?? NO_WATER_FOG);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, n * AL_INSTANCE_FLOATS);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    if (solid) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.uniform1i(L.uGlowPass, 0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, AL_BODY_VERTS, solid);
    }
    if (glow) {
      this.point(solid);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      gl.depthMask(false);
      gl.uniform1i(L.uGlowPass, 1);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, glow);
      this.point(0);
      gl.disable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(true);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enable(gl.CULL_FACE);
    return true;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the program, the buffers, the vertex array. */
  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.verts); gl.deleteBuffer(this.buf);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
  }
}
