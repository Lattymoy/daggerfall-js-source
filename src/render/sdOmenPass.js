// @ts-check
// SD2c (2026-10-06, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 4): THE HOLLOW'S OMEN,
// DRAWN - a column of brass-gold light straight up over a Super dungeon's pixel from the moment it rises, seen from
// SD_OMEN_PX map pixels round (systems/sdOmen.js). It is the gate's beacon in its own colours: the gate's column - its
// shaders and its geometry, exported by render/gatePass.js - built again here under this pass's own program, so the
// gate's module is not touched (SERPENT1's rule, Sea-Serpent.md: the gate's bytes stay as their pins hold them). ADDED
// onto the frame (ONE, ONE), both faces, fogged by the frame's own fog but never below the gate's floor of its light, so
// a Hollow kilometres off still stands on the horizon. No depth written, depth tested.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { BEACON_VS, BEACON_FS, BEACON_RADIUS_M, beaconVertices, gateClock } from './gatePass.js';
import { buildProgram } from './glProgram.js';
import { multiply } from '../world/mat4.js';

/** Its light, display-encoded as the gate's beacon's is (gatePass.js BEACON_COLOR): brass, gold at its heart - the
 *  gate's red never, so a column on the horizon says which it is. */
export const SD_OMEN_COLOR = Object.freeze([1.0, 0.7, 0.26]);

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const WHITE = new Float32Array([1, 1, 1]);
const COLOR = new Float32Array(SD_OMEN_COLOR);

/** The Hollow's column, one foreign pass. */
export class SdOmenPassRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, BEACON_VS, BEACON_FS, 'sd omen');
    this.u = {};
    for (const n of ['uVP', 'uOrigin', 'uEye', 'uRadius', 'uTime', 'uFade', 'uColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus']) this.u[n] = gl.getUniformLocation(this.program, n);
    const verts = beaconVertices();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.count = verts.length / 2;
    this._vp = new Float32Array(16);
    /** the columns the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw the columns: `omens` [{ origin: [x, y, z] the Hollow's ground in the scene, fade 0..1 }] (the dark skipped),
   * `eye` the view's own eye, `seconds` any clock (wrapped here), `fog` the frame's fog. Answers how many it drew -
   * nothing to draw, nothing touched.
   */
  draw(omens, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const list = (Array.isArray(omens) ? omens : []).filter((o) => o && Array.isArray(o.origin) && o.origin.length === 3 && o.origin.every(Number.isFinite) && o.fade > 0.001);
    if (!list.length) return 0;
    const gl = this.gl, U = this.u;
    multiply(proj, view, this._vp);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, gateClock(seconds));
    gl.uniform1f(U.uRadius, BEACON_RADIUS_M);
    gl.uniform3fv(U.uEye, eye ?? fog?.camPos ?? WHITE);
    gl.uniform3fv(U.uColor, COLOR);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? WHITE);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.vao);
    for (const o of list) {
      gl.uniform3f(U.uOrigin, o.origin[0], o.origin[1], o.origin[2]);
      gl.uniform1f(U.uFade, Math.min(1, o.fade));
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return this.drawn;
  }
}
