// @ts-check
// WB5 (2026-09-25, Mac: "On death the boss would physically spew out per player loot and bounce (sort of how dropping a
// torch works) and have a sort of rarity glow attached to it"): THE SPOILS' GLOW - the first place in the port a rarity
// is drawn in the world. Design: bible/11-Multiplayer/World-Bosses.md section 7 ("The glow").
//
// WBX3 (2026-09-26, Mac: "Loot drops should show their sprite and have a small colored loot line that extrudes from the
// sprite itself"): A LINE, NOT A BEAM. WB5 stood each piece in a wide beam over a halo on the floor - a column 0.64 m
// across and up to 8 m tall, which read as a light standing beside the piece rather than as the piece itself, and hid
// what it marked. Now each resting piece sends a THIN LINE of its tier's colour straight up out of the top of its own
// sprite (scenes/spoilsPool.js hands the line's root, the sprite's crown): brightest where it leaves the sprite,
// thinning to nothing at its tip, a soft glint climbing it. Small by intent, taller by tier - a Legendary is seen across
// the court, a Magic a few paces off - and never thinner on the screen than SPOILS_LINE_MIN_RAD of the eye's view, so a
// piece across the floor still shows its line.
//
// The duel wall's law (render/duelWall.js): fixed geometry placed by uniforms, ADDED onto the frame (ONE, ONE) so it only
// ever brightens what stands behind it, no depth written, tested against the depth the world wrote (the sprite itself and
// the floor hide what stands behind them), fogged, and every rate a whole number of cycles over the wrapped clock. One
// quad a piece, turned about the upright to face the eye. The colours are Loot Rarity's own (systems/lootRarity.js
// RARITIES), display-encoded.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { duelClock } from './duelWall.js';
import { RARITIES } from '../systems/lootRarity.js';

/** The most pieces one frame draws (three pieces, the gold and the Sigil Stone - and room for more). */
export const SPOILS_GLOW_MAX = 8;
/** WBX3: how tall the line stands out of the sprite, by tier (metres), and how wide it is. */
export const SPOILS_LINE_H = Object.freeze({ common: 0.7, magic: 1.0, rare: 1.4, legendary: 1.9, artifact: 2.3 });
export const SPOILS_LINE_W = 0.07;
/** The narrowest the line may stand on the screen, as an angle of the eye's view (radians): about two pixels of a
 *  1080-line screen at the port's field of view - a piece across the court keeps a line the eye can find. */
export const SPOILS_LINE_MIN_RAD = 0.0022;
/** The climbing glint's and the Legendary pulse's rates, cycles a second (whole over duelWall.js DUEL_CLOCK_PERIOD). */
export const SPOILS_CLIMB_HZ = 1;
export const SPOILS_PULSE_HZ = 1;

/** A tier's colour as the pass draws it: Loot Rarity's own hex, as display-encoded floats. */
export function tierColour(tier) {
  const hex = (RARITIES[tier] ?? RARITIES.common).colour;
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The line's height for a tier (an unknown tier stands as Common's). */
export const lineHeight = (tier) => SPOILS_LINE_H[RARITIES[tier] ? tier : 'common'] ?? SPOILS_LINE_H.common;

const HEAD = `#version 300 es
precision highp float;
`;
/** One quad a piece: x across the line (-1..1), y up it (0 at the sprite's crown, 1 at the tip). */
export const SPOILS_GLOW_VS = HEAD + `layout(location = 0) in vec2 aP;
uniform mat4 uVP;
uniform vec3 uRoot;      // where the line leaves the sprite: its crown
uniform float uHeight;
uniform float uWidth;
uniform float uMinRad;   // the narrowest it may stand, as an angle of the eye's view
uniform vec3 uEye;
out vec2 vP;
out vec3 vWorld;
void main() {
  vec3 mid = uRoot + vec3(0.0, aP.y * uHeight, 0.0);
  vec3 toEye = uEye - mid;
  vec2 flat2 = vec2(toEye.x, toEye.z);
  float fl = length(flat2);
  vec3 across = fl > 1e-4 ? vec3(flat2.y / fl, 0.0, -flat2.x / fl) : vec3(1.0, 0.0, 0.0);   // turned about the upright to face the eye
  float w = max(uWidth, length(toEye) * uMinRad);
  vec3 p = mid + across * (aP.x * 0.5 * w);
  vP = aP;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const SPOILS_GLOW_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
uniform vec3 uColor;
uniform float uAlpha;    // its rise at rest, and its fade when taken
uniform float uPulse;    // 1 for a Legendary or better, 0 for the rest
uniform float uTime;     // duelClock's seconds
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  float pulse = 1.0 + uPulse * 0.35 * sin(uTime * 6.283185307179586 * ${SPOILS_PULSE_HZ}.0);
  float h = vP.y;
  float core = exp(-vP.x * vP.x * 3.0);                                    // a soft core across it
  float tail = pow(1.0 - h, 1.6);                                          // thinning to nothing at its tip
  float root = exp(-h * 14.0);                                             // brightest where it leaves the sprite
  float glint = exp(-pow((fract(h - uTime * ${SPOILS_CLIMB_HZ}.0) - 0.5) * 9.0, 2.0));   // a soft glint climbing it
  float light = core * (tail * (0.75 + 0.55 * glint) + 0.8 * root);
  o = vec4(uColor * light * pulse * uAlpha * fogFactorAt(vWorld), 1.0);
}`;

/** The line's quad: x across (-1, 1), y up (0, 1). Pure. */
export function spoilsLineVertices() {
  return new Float32Array([-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1]);
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

const NO_FOG_RANGE = new Float32Array([0, 1]);

export class SpoilsGlowRenderer {
  constructor(gl) {
    this.gl = gl;
    const prog = buildProgram(gl, SPOILS_GLOW_VS, SPOILS_GLOW_FS);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uRoot', 'uHeight', 'uWidth', 'uMinRad', 'uEye', 'uColor', 'uAlpha', 'uPulse', 'uTime', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = spoilsLineVertices();
    this.count = verts.length / 2;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
    this._vp = new Float32Array(16);
    /** the pieces the last draw lit, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw the lines: `lines` [{ root: [x, y, z] the sprite's crown in the scene, tier, alpha }] (at most SPOILS_GLOW_MAX,
   * the faded skipped), `eye` the camera, `seconds` any clock (wrapped here), `fog` the frame's fog as the renderer set
   * it. Nothing to draw, nothing touched.
   */
  draw(lines, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const list = (Array.isArray(lines) ? lines : []).filter((g) => g && Array.isArray(g.root) && g.root.length === 3 && g.root.every(Number.isFinite) && g.alpha > 0.001).slice(0, SPOILS_GLOW_MAX);
    if (!list.length) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, duelClock(seconds));
    gl.uniform1f(U.uWidth, SPOILS_LINE_W);
    gl.uniform1f(U.uMinRad, SPOILS_LINE_MIN_RAD);
    const at = eye ?? list[0].root;
    gl.uniform3f(U.uEye, at[0], at[1], at[2]);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? at);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    for (const g of list) {
      const tier = RARITIES[g.tier] ? g.tier : 'common';
      gl.uniform3f(U.uRoot, g.root[0], g.root[1], g.root[2]);
      gl.uniform1f(U.uHeight, lineHeight(tier));
      gl.uniform3fv(U.uColor, tierColour(tier));
      gl.uniform1f(U.uAlpha, Math.min(1, g.alpha));
      gl.uniform1f(U.uPulse, RARITIES[tier].rank >= RARITIES.legendary.rank ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
