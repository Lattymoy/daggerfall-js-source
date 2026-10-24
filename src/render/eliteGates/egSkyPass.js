// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7 and 25): THE SPIRE'S
// SKIES - each band's own void over its halls, where EG-PLAY drew the Hour's (its clock-face and the Bay's cities hanging in
// it were the Hour's story, not the Spire's).
//
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 6):
// THE FETCH over a painted sky - SD5b's law (render/superDungeon/sdSky.js SdSkyRenderer). The band's realm is painted into an
// octahedral map a quadrant a frame (render/eliteGates/egSkyMap.js - the Deadlands, the Soul Cairn, the Evergloam, the Havoc
// Wellhead), and this pass is one triangle at the far plane, drawn only where nothing nearer has (PERF2). Each pixel:
//   THE SKY'S OWN PIXEL - the ray snapped to a world-fixed cell of Daggerfall's own sky pixel (render/skyRenderer.js
//     SKY_ANGLE_PER_PIXEL, pi/512) on the port's ring grid (render/orderedDither.js ringSnap: rows of constant elevation),
//     so the sky's pixels stand square to the horizon (the octahedral map's own texels lie at 45 degrees to it there, and
//     read as a lattice of diamonds), and one NEAREST tap of the map at the cell's centre;
//   THE HAZE - the frame's own fog (the renderer's colour, either lane) mixed over the realm by the share the map holds:
//     the line is the fog itself, so the far wreck (world/eliteGates/egVista.js) melts into it;
//   THE REALM'S LIGHT - behind the haze at the band's gain against its fog (render/deadlands.js skyGain - the lane's dungeon
//     fog against the band's) taken to EG_SKY_LIGHT.pow: the lane falls the void's ambient by the gain, but the fire-sea,
//     the moon and the eruptions are light, not ambient, and fall by its root;
//   THE PIXEL LAW - the whole through SD_PIXEL_GLSL at the cell, in the square root of its value and squared back (a
//     palette's ramp: its dark steps close, so the void dithers between dark steps and never speckles).
// The gradient sky and its painted disc for the Spire's underside are gone: the underside is the wreck's model (one,
// never two). The map is painted outside the sky slot (`paint` - scenes/eliteGates/egLookDraw.js paintSky, from the breach client's
// pass with the world viewport in hand), and the fetch draws nothing until the map holds its band whole: a frame with no
// sky is the level's clear (under the veil - a band's first frame).
//
// A foreign pass: it owns its program, its state and its map; the host marks it. Not a DFU member. Ledger A (ELITE-GATES).
import { buildProgram } from '../glProgram.js';
import { sdSkyBasisInto, SD_OCT_GLSL } from '../superDungeon/sdSky.js';
import { DITHER_GLSL, SD_PIXEL_GLSL } from '../orderedDither.js';
import { SKY_ANGLE_PER_PIXEL } from '../skyRenderer.js';
import { EgSkyMap, EG_SKY_MAP, EG_SKY_STEPS } from './egSkyMap.js';

/** THE REALM'S LIGHT behind the haze: the host's gain (the band's fog against the frame's) taken to `pow`. */
export const EG_SKY_LIGHT = Object.freeze({ pow: 0.5 });
/** The realm's light at the host's `gain` (1 on the classic set). Pure - the fetch's uLift. */
export const egSkyLift = (gain) => Math.pow(Math.max(0, gain), EG_SKY_LIGHT.pow);

export const EG_SKY_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
uniform vec3 uRight, uUp, uFwd;
uniform vec4 uProj;
out vec3 vRay;
void main() {
  vRay = uRight * ((aPos.x + uProj.z) / uProj.x) + uUp * ((aPos.y + uProj.w) / uProj.y) + uFwd;
  gl_Position = vec4(aPos, 1.0, 1.0); }`;
/** THE FETCH: `egSkyFetch(d)` the sky's colour along d - its cell, its tap, the frame's fog over the realm's light, the
 *  pixel law. */
export const EG_SKY_FS = `#version 300 es
precision highp float;
in vec3 vRay;
uniform sampler2D uSkyMap;
uniform float uLift;     // the realm's light at this lane (egSkyLift of the host's gain)
uniform vec3 uFog;       // the frame's own fog: the haze over the realm, and the line itself
uniform float uSteps;    // the pixel law's steps (EG_SKY_STEPS)
out vec4 o;
const float MAP = ${EG_SKY_MAP.toFixed(1)};
const float CELL = ${SKY_ANGLE_PER_PIXEL.toFixed(8)};
${DITHER_GLSL}${SD_PIXEL_GLSL}${SD_OCT_GLSL}
// what the map holds at a direction: the realm's colour (kept in its square root) and the haze's share
vec4 egSkyTap(vec3 c) {
  ivec2 tx = clamp(ivec2(floor(octEncode(c) * MAP)), ivec2(0), ivec2(int(MAP) - 1));
  vec4 t = texelFetch(uSkyMap, tx, 0);
  return vec4(t.rgb * t.rgb, t.a);
}
// the haze over the realm's light
vec3 egSkyHazed(vec4 t) { return mix(t.rgb * uLift, uFog, t.a); }
vec3 egSkyFetch(vec3 d) {
  vec2 cell;
  vec3 c = ringSnap(normalize(d), CELL, cell);
  vec3 s = sdPixel(sqrt(max(egSkyHazed(egSkyTap(c)), vec3(0.0))), floor(cell), uSteps);
  return s * s;
}
void main() { o = vec4(egSkyFetch(vRay), 1.0); }`;

/** A fog colour for a draw that hands none. */
const NO_FOG = new Float32Array(3);

/** FIRST-USE (#1144): the pass's one program, as its constructor builds it - what the hall's load starts and the
 *  look's door waits on (render/glProgram.js startPrograms, compiledPass). */
export const EG_SKY_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[EG_SKY_VS, EG_SKY_FS]]));

/** The pass: the fetch and the map it owns. */
export class EgSkyPass {
  /** @param {WebGL2RenderingContext} gl @param {{ lite?: boolean }} [o] */
  constructor(gl, { lite = false } = {}) {
    this.gl = gl;
    const [[vs, fs]] = EG_SKY_PROGRAMS;
    this.program = buildProgram(gl, vs, fs, 'eg sky');
    this.u = {};
    for (const n of ['uRight', 'uUp', 'uFwd', 'uProj', 'uSkyMap', 'uLift', 'uFog', 'uSteps']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._b = { right: new Float32Array(3), up: new Float32Array(3), fwd: new Float32Array(3), lens: new Float32Array(4) };
    /** EG-LOOK: the painted map (render/eliteGates/egSkyMap.js) */
    this.map = new EgSkyMap(gl, { lite });
    this.drawn = false;
  }
  /** Band `band`'s map's next quadrant at `seconds` on the sky's clock, `viewport` handed back (render/eliteGates/egSkyMap.js
   *  EgSkyMap.paint). Answers whether it painted. */
  paint(band, seconds, viewport = null) { return this.map.paint(band, seconds, viewport); }
  /** Fetch band `band`'s sky where nothing nearer has drawn: `gain` the band's fog against the frame's (the realm's light
   *  at egSkyLift of it), `fog` the frame's fog colour (the haze), `steps` the pixel law's - nothing (false) until its map
   *  is painted whole.
   *  @param {ArrayLike<number>} proj @param {ArrayLike<number>} view @param {number} band @param {number} [gain] @param {Float32Array|number[]|null} [fog] @param {number} [steps] */
  draw(proj, view, band, gain = 1, fog = null, steps = /** @type {number} */ (EG_SKY_STEPS.lane)) {
    this.drawn = false;
    if (!this.program || !this.map.holds(band | 0)) return false;
    const gl = this.gl, U = this.u, b = sdSkyBasisInto(view, proj, this._b);
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.uniform3fv(U.uRight, b.right); gl.uniform3fv(U.uUp, b.up); gl.uniform3fv(U.uFwd, b.fwd); gl.uniform4fv(U.uProj, b.lens);
    gl.uniform1f(U.uLift, egSkyLift(gain));
    gl.uniform3fv(U.uFog, fog ?? NO_FOG);
    gl.uniform1f(U.uSteps, steps);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.map.texture); gl.uniform1i(U.uSkyMap, 0);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);   // PERF2: only where nothing nearer has drawn - z is the far plane
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    this.drawn = true;
    return true;
  }
  /** Every GL object it made - the fetch's and the map's - freed once. */
  destroy() {
    const gl = this.gl;
    if (!this.program) return;
    this.map.release();
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
    this.program = /** @type {any} */ (null);
  }
}
