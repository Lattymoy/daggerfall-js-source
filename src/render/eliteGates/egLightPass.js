// @ts-check
// EG-ZE (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7, 16.2, 16.4, 16.5,
// 27.3 and 27.5): THE SPIRE'S LIGHTS - what world/eliteGates/egLights.js egSpireLights says stands, drawn in one pass:
//   A BEAM      the door's over its END PLATE and the Redoubt's beacon at the court's heart: a column facing the eye
//               about its own axis, a soft core and a glow either side, fading up to nothing, a slow ripple climbing it
//               (none under reduced motion); it keeps EG_DOOR_BEAM.fog through any haze - seen hall-wide;
//   A PILLAR    a ping's and a recall's: the same column, firmer, fading up;
//   A RING      the closing's at the door's reach, its arc lit to the closing's seconds left and the spent arc dim; a
//               witness's mark: flat on the floor, a band with soft edges;
//   A GLYPH     over a ping's pillar (here a ring, danger a triangle with its bar, mine a diamond) and over a witness's
//               mark (an eye): a square facing the eye, its shape drawn by distance.
// Every vertex written on the CPU a frame into one kept buffer (`egLightVertices` - a column faces the eye about its axis,
// a glyph faces the screen by the view's own right and up; nothing made a frame), blended additively - light added to
// what it stands in, never painted over it (a glyph a little more, so its shape reads). READABLE IN THE FOG (section 25.6):
// THE FOG FLOOR within its 30 m (world/eliteGates/egLook.js EG_FOG_FLOOR) and a beam's own floor past it, the light faded with the
// fog rather than mixed toward its colour (light in a haze dims; it does not turn grey). Depth-tested, never written,
// drawn after THE EDGE LINE by its host (scenes/eliteGates/egLookDraw.js).
//
// A foreign pass: it owns its program and its state; the host marks it. Not a DFU member. Ledger A (ELITE-GATES).
import { buildProgram } from '../glProgram.js';
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { EG_FOG_FLOOR } from '../../world/eliteGates/egLook.js';
import { EG_LIGHT_KIND, EG_LIGHTS_MAX, EG_DOOR_BEAM, EG_CLOSING_RING } from '../../world/eliteGates/egLights.js';

/** Floats a vertex: aP xyz, aUV (across, along), aK (kind, glyph or ring's lit arc), aC (rgb, strength). */
export const EG_LIGHT_FLOATS = 10;
/** The sides of a ring. */
export const EG_RING_SIDES = 32;
/** The kept buffer's room (vertices): every light a ring's worth. */
export const EG_LIGHT_VERTS_MAX = EG_LIGHTS_MAX * EG_RING_SIDES * 6;
/** A quad's six corners: [across, along]. */
const QUAD = Object.freeze([[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]);

/**
 * The lights (world/eliteGates/egLights.js egSpireLights) as the pass's vertices into `out` - `eye` the camera, `right` and `up` the
 * view's own axes (a glyph faces the screen by them). Answers how many vertices it wrote (never past `out`'s room). A beam
 * or a pillar faces the eye about its upright axis; a glyph's `aK.y` its shape, a ring's its lit arc. Pure (it writes only
 * `out`).
 * @param {any[]} lights @param {ArrayLike<number>} eye @param {ArrayLike<number>} right @param {ArrayLike<number>} up @param {Float32Array} out
 */
export function egLightVertices(lights, eye, right, up, out) {
  const room = Math.floor(out.length / EG_LIGHT_FLOATS);
  let n = 0;
  const put = (x, y, z, u, v, k, x2, c, a) => {
    const o = n * EG_LIGHT_FLOATS;
    out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = u; out[o + 4] = v; out[o + 5] = k; out[o + 6] = x2; out[o + 7] = c[0] * a; out[o + 8] = c[1] * a; out[o + 9] = c[2] * a;
    n++;
  };
  for (const L of lights) {
    if (!(L.a > 0)) continue;
    if (L.k === EG_LIGHT_KIND.ring) {
      if (n + EG_RING_SIDES * 6 > room) break;
      const r0 = Math.max(0, L.r - L.w / 2), r1 = L.r + L.w / 2;
      for (let i = 0; i < EG_RING_SIDES; i++) {
        const a0 = (i / EG_RING_SIDES) * Math.PI * 2, a1 = ((i + 1) / EG_RING_SIDES) * Math.PI * 2;
        for (const [s, e] of QUAD) {
          const ang = e ? a1 : a0, r = s < 0 ? r0 : r1;
          put(L.x + Math.cos(ang) * r, L.y, L.z + Math.sin(ang) * r, s, (i + e) / EG_RING_SIDES, L.k, L.f, L.c, L.a);
        }
      }
      continue;
    }
    if (n + 6 > room) break;
    if (L.k === EG_LIGHT_KIND.glyph) {
      const h = L.w / 2;
      for (const [s, e] of QUAD) {
        const v = e * 2 - 1;
        put(L.x + (right[0] * s + up[0] * v) * h, L.y + (right[1] * s + up[1] * v) * h, L.z + (right[2] * s + up[2] * v) * h, s, v, L.k, L.f, L.c, L.a);
      }
      continue;
    }
    if (!(L.h > 0)) continue;
    // a column: faces the eye about its upright axis (its side square to the line from the eye in the ground's plane)
    let dx = eye[0] - L.x, dz = eye[2] - L.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) { dx /= d; dz /= d; } else { dx = 0; dz = 1; }
    const sx = -dz * (L.w / 2), sz = dx * (L.w / 2);
    for (const [s, e] of QUAD) put(L.x + sx * s, L.y + L.h * e, L.z + sz * s, s, e, L.k, 0, L.c, L.a);
  }
  return n;
}

export const EG_LIGHT_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aP;
layout(location = 1) in vec2 aUV;
layout(location = 2) in vec2 aK;    // its kind, and a glyph's shape or a ring's lit arc
layout(location = 3) in vec3 aC;    // its colour at its strength
uniform mat4 uVP;
out vec3 vWorld;
out vec2 vUV;
flat out int vKind;
flat out float vX;
out vec3 vCol;
void main() {
  vWorld = aP; vUV = aUV; vKind = int(aK.x + 0.5); vX = aK.y; vCol = aC;
  vec4 c = uVP * vec4(aP, 1.0);
  c.z -= 0.0004 * c.w;   // a hair toward the eye, as the edge line: a ring wins over the plate it lies on
  gl_Position = c;
}`;
export const EG_LIGHT_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec2 vUV;
flat in int vKind;
flat in float vX;
in vec3 vCol;
uniform float uTime;      // s
uniform float uStill;     // 1: reduced motion - no ripple
uniform vec3 uFogFloor;   // floor, within, ease (m) - world/eliteGates/egLook.js EG_FOG_FLOOR
uniform float uBeamFog;   // the fog a beam keeps at any range (world/eliteGates/egLights.js EG_DOOR_BEAM.fog)
uniform float uSpent;     // how lit a ring's spent arc stays
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// a glyph's ink at p (its square from -1 to 1), by world/eliteGates/egLights.js EG_GLYPH: here a ring, danger a triangle and its
// bar, mine a diamond, the witness's eye an almond and its pupil
float glyphInk(vec2 p, float g) {
  float d;
  if (g < 0.5) d = abs(length(p) - 0.62);
  else if (g < 1.5) {
    vec2 A = vec2(0.0, 0.8), B = vec2(-0.78, -0.62), C = vec2(0.78, -0.62);
    d = min(min(seg(p, A, B), seg(p, B, C)), seg(p, C, A));
    d = min(d, seg(p, vec2(0.0, 0.32), vec2(0.0, -0.12)));
    d = min(d, length(p - vec2(0.0, -0.36)) - 0.02);
  }
  else if (g < 2.5) d = abs(abs(p.x) + abs(p.y) - 0.72) * 0.7071;
  else {
    float lid = abs(length(vec2(p.x, abs(p.y) + 0.55)) - 1.05);
    d = abs(p.x) < 0.86 ? lid : 1.0;
    d = min(d, max(0.0, length(p) - 0.24));
  }
  return 1.0 - smoothstep(0.08, 0.16, d);
}
void main() {
  float I, a = 0.0;
  float u = abs(vUV.x), v = clamp(vUV.y, 0.0, 1.0);
  if (vKind == ${EG_LIGHT_KIND.beam}) {
    float ripple = uStill > 0.5 ? 1.0 : 0.88 + 0.12 * sin(v * 24.0 - uTime * 2.4);
    I = (exp(-u * u * 10.0) + 0.35 * (1.0 - u)) * pow(1.0 - v, 1.5) * ripple;
  } else if (vKind == ${EG_LIGHT_KIND.pillar}) {
    I = (exp(-u * u * 6.0) + 0.25) * (1.0 - smoothstep(0.8, 1.0, u)) * pow(1.0 - v, 0.7);
  } else if (vKind == ${EG_LIGHT_KIND.ring}) {
    I = (1.0 - u * u) * (v <= vX ? 1.0 : uSpent);
  } else {
    I = glyphInk(vUV, vX);
    a = 0.6 * I;
  }
  float d = distance(vWorld, uCamPos);
  float kept = uFogFloor.x * (1.0 - smoothstep(uFogFloor.y, uFogFloor.y + uFogFloor.z, d));
  if (vKind == ${EG_LIGHT_KIND.beam}) kept = max(kept, uBeamFog);
  float f = max(fogFactorAt(vWorld), kept);
  o = vec4(vCol * I * f, a * f);
}`;

/** FIRST-USE (#1144): the pass's one program, as its constructor builds it - what the hall's load starts and the
 *  look's door waits on (render/glProgram.js startPrograms, compiledPass). */
export const EG_LIGHT_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[EG_LIGHT_VS, EG_LIGHT_FS]]));

/** The pass. */
export class EgLightPass {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [[vs, fs]] = EG_LIGHT_PROGRAMS;
    this.program = buildProgram(gl, vs, fs, 'eg lights');
    this.u = {};
    for (const n of ['uVP', 'uTime', 'uStill', 'uFogFloor', 'uBeamFog', 'uSpent', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray(); this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, EG_LIGHT_VERTS_MAX * EG_LIGHT_FLOATS * 4, gl.DYNAMIC_DRAW);
    const S = EG_LIGHT_FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, S, 28);
    gl.bindVertexArray(null);
    this._data = new Float32Array(EG_LIGHT_VERTS_MAX * EG_LIGHT_FLOATS);
    this._vp = new Float32Array(16);
    this._right = new Float32Array(3); this._up = new Float32Array(3);
    this.drawn = 0;
  }
  /**
   * Draw `lights` (world/eliteGates/egLights.js egSpireLights) onto the frame - `eye` the camera, `fog` the frame's ({ mode,
   * density, range, camPos }), `seconds` any clock, `still` reduced motion. Answers whether anything drew.
   */
  draw(proj, view, eye, seconds, fog = null, lights = null, still = false) {
    this.drawn = 0;
    if (!lights?.length) return false;
    const gl = this.gl, U = this.u, V = this._vp, R = this._right, P = this._up;
    R[0] = view[0]; R[1] = view[4]; R[2] = view[8];   // the view's own right and up (its rotation's rows)
    P[0] = view[1]; P[1] = view[5]; P[2] = view[9];
    const n = egLightVertices(lights, eye ?? fog?.camPos ?? NO_EYE, R, P, this._data);
    if (!n) return false;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) V[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, V);
    gl.uniform1f(U.uTime, seconds % 60);
    gl.uniform1f(U.uStill, still ? 1 : 0);
    gl.uniform3f(U.uFogFloor, EG_FOG_FLOOR.floor, EG_FOG_FLOOR.within, EG_FOG_FLOOR.ease);
    gl.uniform1f(U.uBeamFog, EG_DOOR_BEAM.fog);
    gl.uniform1f(U.uSpent, EG_CLOSING_RING.spent);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? NO_EYE);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._data, 0, n * EG_LIGHT_FLOATS);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    this.drawn = n;
    return true;
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
  }
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_EYE = new Float32Array(3);
