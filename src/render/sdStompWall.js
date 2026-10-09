// @ts-check
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 9): THE STOMP'S RING AS A WALL - the ring a
// Brass Stomp rolls out (net/sdRemnant.js stompRingAt - the very front the law strikes) stood up as a low wall of brass
// light SD_STOMP_WALL.h tall, not a line on the floor: it reads "jump this". A cylinder strip of SD_STOMP_WALL.segs sides
// about the Stomp's centre at the front's radius, ADDED onto the frame (the beam's law, render/sdBeam.js: fixed geometry
// placed by uniforms, no depth written, tested against the world's, fogged), its light posterized in bands rising to a
// bright top lip, fading as the roll ends. The gate telegraph's floor ring stays under it (scenes/sdRemnantBlows.js).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { SD_BLOWS, stompRingAt } from '../net/sdRemnant.js';
import { SD_ARENA, realmToDungeon } from '../net/sdBrain.js';

/** The wall: its height (m - under a jump's reach, over a step's), its sides, the most a frame stands (the Remnant's
 *  and the two Echoes'), and its brass. */
export const SD_STOMP_WALL = Object.freeze({ h: 0.6, segs: 64, max: 3, color: Object.freeze([1.0, 0.7, 0.26]) });

const STOMP = SD_BLOWS.stomp;
/** A body's blow if it is a Stomp rolling at `t` - the wall's `{ x, z, r, k }` into `w` (the arena's frame; k its light,
 *  fading over the roll's last fifth) - else false. */
function rolling(atk, t, w) {
  if (!atk || atk.a !== STOMP.id) return false;
  const r = stompRingAt(atk, t);
  if (r == null) return false;
  const u = (t - atk.at) / STOMP.active;
  w.x = atk.x; w.z = atk.z; w.r = r; w.k = u > 0.8 ? Math.max(0, (1 - u) / 0.2) : 1;
  return true;
}
/**
 * THE WALLS STANDING at `t` of the fight state `s`: the Remnant's Stomp and each living Echo's, rolling - written into
 * `out` (SD_STOMP_WALL.max kept records, made once by the caller) and counted. Nothing made (the frame's).
 */
export function sdStompWalls(s, t, out) {
  let n = 0;
  if (!s || s.fell) return 0;
  if (rolling(s.rem?.atk, t, out[n])) n++;
  const ec = s.ec ?? [];
  for (let i = 0; i < ec.length && n < out.length; i++) if (ec[i].h > 0 && rolling(ec[i].atk, t, out[n])) n++;
  return n;
}
/** Kept records for `sdStompWalls`. */
export const sdStompWallRecords = () => Array.from({ length: SD_STOMP_WALL.max }, () => ({ x: 0, z: 0, r: 0, k: 0 }));

const HEAD = `#version 300 es
precision highp float;
`;
export const SD_STOMP_WALL_VS = HEAD + `layout(location = 0) in vec2 aP;   // round it (0..1), up it (0..1)
uniform mat4 uVP;
uniform vec3 uC;     // its centre on the floor (the scene's frame)
uniform float uR;
out vec2 vP;
out vec3 vWorld;
void main() {
  float a = aP.x * 6.283185307179586;
  vec3 p = uC + vec3(sin(a) * uR, aP.y * ${SD_STOMP_WALL.h.toFixed(2)}, cos(a) * uR);
  vP = aP;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const SD_STOMP_WALL_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
uniform vec3 uColor;
uniform float uK;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  float v = vP.y;
  // banded, rising to its lip: four steps of light up it, the top a bright brass edge
  float k = floor((0.45 + 0.6 * v) * 4.0) / 4.0;
  if (v > 0.86) k = 1.25;
  o = vec4(uColor * k * uK * fogFactorAt(vWorld), 1.0);
}`;

/** The strip: SD_STOMP_WALL.segs quads round, one up. Pure. */
export function sdStompWallVertices(segs = SD_STOMP_WALL.segs) {
  const v = [];
  for (let i = 0; i < segs; i++) {
    const a = i / segs, b = (i + 1) / segs;
    v.push(a, 0, b, 0, b, 1, a, 0, b, 1, a, 1);
  }
  return new Float32Array(v);
}

export class SdStompWallRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, SD_STOMP_WALL_VS, SD_STOMP_WALL_FS, 'sd stomp wall');
    this.u = {};
    for (const n of ['uVP', 'uC', 'uR', 'uColor', 'uK', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.program, n);
    const verts = sdStompWallVertices();
    this.count = verts.length / 2;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    this.drawn = 0;
  }
  /** Draw the first `n` of `walls` (sdStompWalls's), in `fog`. Answers whether it drew. */
  draw(walls, n, proj, view, fog = null) {
    this.drawn = 0;
    if (!(n > 0)) return false;
    const gl = this.gl, U = this.u, V = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) V[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, V);
    gl.uniform3fv(U.uColor, SD_STOMP_WALL.color);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_FOG_RANGE3);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false); gl.disable(gl.CULL_FACE);
    const o = ARENA_AT;
    for (let i = 0; i < n && i < walls.length; i++) {
      const w = walls[i];
      if (!(w.k > 0.001) || !(w.r > 0)) continue;
      gl.uniform3f(U.uC, o[0] + w.x, o[1] + 0.02, o[2] + w.z);
      gl.uniform1f(U.uR, w.r); gl.uniform1f(U.uK, w.k);
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE); gl.depthMask(true); gl.disable(gl.BLEND);
    return this.drawn > 0;
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
  }
}
const ARENA_AT = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z);
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOG_RANGE3 = new Float32Array(3);
