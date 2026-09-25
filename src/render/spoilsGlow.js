// @ts-check
// WB5 (2026-09-25, Mac: "On death the boss would physically spew out per player loot and bounce (sort of how dropping a
// torch works) and have a sort of rarity glow attached to it"): THE SPOILS' GLOW - each piece of a fallen boss's
// spoils, once it comes to rest, stands in a BEAM of its tier's colour rising from a HALO on the ground, the first place
// in the port a rarity is drawn in the world. Design: bible/11-Multiplayer/World-Bosses.md section 7 ("The glow").
//
// The duel wall's law (render/duelWall.js): fixed geometry placed by uniforms, ADDED onto the frame (ONE, ONE) so it only
// ever brightens what stands behind it, no depth written, tested against the depth the world wrote (the piece and the
// floor hide what stands behind them), fogged, and every rate a whole number of cycles over the wrapped clock. Two
// draws a piece: the beam - an open cylinder, bright at its foot and gone at its top, a soft band climbing it - and the
// halo - a ring on the floor with a soft heart. A Legendary's beam is taller and pulses; an Artifact's is the tallest.
// The colours are Loot Rarity's own (systems/lootRarity.js RARITIES), display-encoded.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { duelClock } from './duelWall.js';
import { RARITIES } from '../systems/lootRarity.js';

/** The most pieces one frame draws (three pieces, the gold and the Sigil Stone - and room for more). */
export const SPOILS_GLOW_MAX = 8;
/** The beam's quads around, its radius, and how tall it stands by tier (metres). */
export const SPOILS_BEAM_SEGMENTS = 20;
export const SPOILS_BEAM_R = 0.32;
export const SPOILS_BEAM_H = Object.freeze({ common: 1.6, magic: 2.6, rare: 3.8, legendary: 6.5, artifact: 8 });
/** The halo's radius on the floor, and how far over it it lies. */
export const SPOILS_HALO_R = 0.85;
export const SPOILS_HALO_LIFT = 0.03;
/** The climbing band's and the Legendary pulse's rates, cycles a second (whole over duelWall.js DUEL_CLOCK_PERIOD). */
export const SPOILS_CLIMB_HZ = 0.5;
export const SPOILS_PULSE_HZ = 1;

/** A tier's colour as the pass draws it: Loot Rarity's own hex, as display-encoded floats. */
export function tierColour(tier) {
  const hex = (RARITIES[tier] ?? RARITIES.common).colour;
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const HEAD = `#version 300 es
precision highp float;
`;
/** One vertex layout for both shapes: x around the beam (0..1) or across the halo (-1..1), y up the beam (0..1) or
 *  along the halo, and the shape's own flag in z (0 the beam, 1 the halo). */
export const SPOILS_GLOW_VS = HEAD + `layout(location = 0) in vec3 aP;
uniform mat4 uVP;
uniform vec3 uFoot;      // where the piece rests
uniform float uHeight;
uniform float uBeamR;
uniform float uHaloR;
uniform float uLift;
out vec3 vP;
out vec3 vWorld;
void main() {
  vec3 p;
  if (aP.z < 0.5) {
    float a = aP.x * 6.283185307179586;
    p = uFoot + vec3(cos(a) * uBeamR, aP.y * uHeight, sin(a) * uBeamR);
  } else {
    p = uFoot + vec3(aP.x * uHaloR, uLift, aP.y * uHaloR);
  }
  vP = aP;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const SPOILS_GLOW_FS = HEAD + `in vec3 vP;
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
  float light;
  if (vP.z < 0.5) {
    float h = vP.y;
    float foot = 1.0 - smoothstep(0.0, 1.0, h);                  // bright at its foot, gone at its top
    float band = exp(-pow((fract(h * 1.5 - uTime * ${SPOILS_CLIMB_HZ.toFixed(1)}) - 0.5) * 7.0, 2.0));   // a soft band climbing it
    light = (0.35 + 0.35 * band) * foot * foot;
  } else {
    float r = length(vP.xy);
    if (r > 1.0) discard;
    float ring = exp(-pow((r - 0.78) * 11.0, 2.0));
    float heart = (1.0 - smoothstep(0.0, 0.8, r)) * 0.35;
    light = ring * 0.9 + heart;
  }
  o = vec4(uColor * light * pulse * uAlpha * fogFactorAt(vWorld), 1.0);
}`;

/** The shapes' vertices: the beam's quads around (x around, y up, z 0) then the halo's quad (x, y across, z 1). Pure. */
export function spoilsGlowVertices(segments = SPOILS_BEAM_SEGMENTS) {
  const out = [];
  for (let i = 0; i < segments; i++) {
    const a = i / segments, b = (i + 1) / segments;
    for (const [u, v] of [[a, 0], [b, 0], [b, 1], [a, 0], [b, 1], [a, 1]]) out.push(u, v, 0);
  }
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) out.push(x, y, 1);
  return new Float32Array(out);
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
    for (const n of ['uVP', 'uFoot', 'uHeight', 'uBeamR', 'uHaloR', 'uLift', 'uColor', 'uAlpha', 'uPulse', 'uTime', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = spoilsGlowVertices();
    this.beamCount = SPOILS_BEAM_SEGMENTS * 6;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
    this._vp = new Float32Array(16);
    /** the pieces the last draw lit, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw the glows: `glows` [{ foot: [x, y, z] in the scene, tier, alpha }] (at most SPOILS_GLOW_MAX, the faded skipped),
   * `seconds` any clock (wrapped here), `fog` the frame's fog as the renderer set it. Nothing to draw, nothing touched.
   */
  draw(glows, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const list = (Array.isArray(glows) ? glows : []).filter((g) => g && Array.isArray(g.foot) && g.foot.length === 3 && g.foot.every(Number.isFinite) && g.alpha > 0.001).slice(0, SPOILS_GLOW_MAX);
    if (!list.length) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, duelClock(seconds));
    gl.uniform1f(U.uBeamR, SPOILS_BEAM_R);
    gl.uniform1f(U.uHaloR, SPOILS_HALO_R);
    gl.uniform1f(U.uLift, SPOILS_HALO_LIFT);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? list[0].foot);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    for (const g of list) {
      const tier = RARITIES[g.tier] ? g.tier : 'common';
      gl.uniform3f(U.uFoot, g.foot[0], g.foot[1], g.foot[2]);
      gl.uniform1f(U.uHeight, SPOILS_BEAM_H[tier]);
      gl.uniform3fv(U.uColor, tierColour(tier));
      gl.uniform1f(U.uAlpha, Math.min(1, g.alpha));
      gl.uniform1f(U.uPulse, RARITIES[tier].rank >= RARITIES.legendary.rank ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.beamCount + 6);   // the beam's quads, then the halo's
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
