// @ts-check
// SD-LOOK S7 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 9): THE PILLARS' WATCH - one foreign pass
// over the arena's four clock-towers (world/sdPillarModel.js), drawn by the world host with the arena's reads:
//
//   THE DIALS - a small clock on each face of each capital (sixteen), laid a hair out of the stone on the pixel law's
//     cells (SD_DIAL_TEXELS a radius): a dark enamel face, a brass bezel lit from the top-left, twelve ticks (the
//     quarters broad) and ONE HAND, which TURNS TO POINT AT THE REMNANT - they watch it (scenes/sdArenaWatch.js
//     sdPillarHandsAt: where it stands, seen on each face's own plane, on the escapement). Lit by the lantern over them
//     (the ambient rung), never by the scene: they read across the arena in the void's dark. Red when the Hour ends.
//   THE LANTERNS - the flame in each lantern stage's brass cage (world/sdPillarModel.js SD_LANTERN): a gold core and its
//     glow posterized in four steps, camera-facing, the cage's bars and the stage's posts in front of it (depth-tested).
//     The glow is the classic set's bloom (SD_HALO_GAIN's law: 1 on the classic set, half on the lane, which blooms it
//     too). Its light on its own housing - the hood's underside over it, the cornice's top under it - laid on them here,
//     posterized in three steps. A light to see, not one that lights the world: the Hour's lamps keep their count
//     (world/sdRealm.js SD_LAMPS).
//   THE RESET'S DIMMING - dials and flames together by `dim` (scenes/sdArenaWatch.js sdLampDimInto, the arena's lamps'
//     own factor), so the Hearts are the brightest things in the world.
//
// Premultiplied (the enamel darkens the stone; the light adds), depth-tested and never written, fogged. One static
// buffer made once, one draw; a frame sets uniforms alone. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from './orderedDither.js';
import { sdPillarDials, sdLanterns, SD_PILLAR_DIAL, SD_PILLAR_LOOK, SD_LANTERN } from '../world/sdPillarModel.js';

/** A dial's radius in the pixel law's cells (its stone's own 32 texels a metre, SD_PILLAR_DIAL.r across). */
export const SD_DIAL_TEXELS = Math.round(SD_PILLAR_DIAL.r * 32);
/** The hand in a dial's cells: its shaft's half-width and reach, its spade (from, to, half-width), its tail and the
 *  counterweight's radius, the boss's radius; the bezel's and the ticks' rings (cells in from the rim). */
export const SD_DIAL_HAND = Object.freeze({ shaftW: 1, reach: 13, spade0: 11, spade1: 18, spadeW: 3.2, tail: 5, weight: 2.3, boss: 2.2 });
export const SD_DIAL_RINGS = Object.freeze({ bezel: 2.2, tick0: 3.2, tick1: 7, tickW: 0.9, quarterW: 1.6 });
/** The parts of a dial (dialPart's answer). */
export const SD_DIAL_PART = Object.freeze({ off: -1, enamel: 0, bezel: 1, tick: 2, hand: 3, boss: 4 });
/** The lantern's flame: its quad's half-size (m, the glow's reach), its core's half-width and half-height (m), the
 *  core's light and the glow's (linear, over SD_LIGHT.gold). */
export const SD_LANTERN_FLAME = Object.freeze({ size: 1.1, coreW: 0.1, coreH: 0.17, core: 1.5, glow: 0.55 });
/** The dial's lights over gold (the lantern's): its bezel and ticks (the ambient rung), its hand (brighter), its boss;
 *  the enamel's darkening. */
export const SD_DIAL_LIGHT = Object.freeze({ bezel: 0.26, tick: 0.3, hand: 0.62, boss: 0.4, enamel: 0.6 });
/** The lantern's light on its housing: the hood's underside's and the cornice's top's (over gold, at the lantern). */
export const SD_LANTERN_SPILL = Object.freeze({ hood: 0.34, cornice: 0.22 });
/** How many dials, how many flames, how many lit faces of their housings: the static buffer's. */
export const SD_PILLAR_DIALS = 16;
export const SD_LANTERNS = 4;
export const SD_LANTERN_SPILLS = 8;

const HEAD = `#version 300 es
precision highp float;
`;
export const SD_PILLAR_VS = HEAD + `layout(location = 0) in vec3 aAt;
layout(location = 1) in vec2 aQ;
layout(location = 2) in float aKind;
uniform mat4 uView, uProj;
out vec2 vQ;
out float vKind;
out vec3 vWorld;
void main() {
  vQ = aQ; vKind = aKind; vWorld = aAt;
  if (aKind > ${SD_PILLAR_DIALS - 0.5} && aKind < ${SD_PILLAR_DIALS + SD_LANTERNS - 0.5}) {
    vec4 c = uView * vec4(aAt, 1.0);   // a lantern's flame: camera-facing about its centre
    c.xy += aQ * ${SD_LANTERN_FLAME.size.toFixed(3)};
    gl_Position = uProj * c;
  } else gl_Position = uProj * uView * vec4(aAt, 1.0);
}`;
export const SD_PILLAR_FS = HEAD + `in vec2 vQ;
in float vKind;
in vec3 vWorld;
uniform float uHands[${SD_PILLAR_DIALS}];
uniform float uDim;      // the Reset's dimming: 1 at rest, down to 0.4
uniform float uEnd;      // the Hour ends: the dials red
uniform float uGain;     // the flames' glow: 1 on the classic set, half on the lane
uniform float uSteps;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
out vec4 o;
${BAYER_GLSL}${SD_PIXEL_GLSL}${FOG_FACTOR_GLSL}
const float TAU = 6.283185307179586;
const float N = ${SD_DIAL_TEXELS.toFixed(1)};
const vec3 GOLD = vec3(1.0, 0.78, 0.4);
const vec3 HOT = vec3(1.0, 0.92, 0.62);
const vec3 RED = vec3(1.0, 0.32, 0.26);
// what of a dial stands at cell centre c (cells from its centre, u right and v up), its hand at angle a (0 at XII, a
// quarter at III): -1 off the dial, 0 enamel, 1 bezel, 2 a tick, 3 the hand, 4 its boss
float dialPart(vec2 c, float a) {
  float r = length(c);
  if (r > N) return -1.0;
  vec2 dir = vec2(sin(a), cos(a)), side = vec2(cos(a), -sin(a));
  float along = dot(c, dir), off = abs(dot(c, side));
  if (r <= ${SD_DIAL_HAND.boss.toFixed(2)}) return 4.0;
  float spade = (along - ${SD_DIAL_HAND.spade0.toFixed(1)}) / ${(SD_DIAL_HAND.spade1 - SD_DIAL_HAND.spade0).toFixed(1)};
  if (spade >= 0.0 && spade <= 1.0 && off <= ${SD_DIAL_HAND.spadeW.toFixed(2)} * (1.0 - abs(spade * 2.0 - 1.0)) + 0.5) return 3.0;
  if (along >= -${SD_DIAL_HAND.tail.toFixed(1)} && along <= ${SD_DIAL_HAND.reach.toFixed(1)} && off <= ${SD_DIAL_HAND.shaftW.toFixed(2)}) return 3.0;
  if (length(c + dir * ${SD_DIAL_HAND.tail.toFixed(1)}) <= ${SD_DIAL_HAND.weight.toFixed(2)}) return 3.0;
  if (r > N - ${SD_DIAL_RINGS.bezel.toFixed(2)}) return 1.0;
  if (r > N - ${SD_DIAL_RINGS.tick1.toFixed(1)} && r < N - ${SD_DIAL_RINGS.tick0.toFixed(1)}) {
    float h = floor(mod(atan(c.x, c.y) + TAU, TAU) / (TAU / 12.0) + 0.5);
    float ha = h * TAU / 12.0;
    float w = mod(h, 3.0) < 0.5 ? ${SD_DIAL_RINGS.quarterW.toFixed(2)} : ${SD_DIAL_RINGS.tickW.toFixed(2)};
    if (abs(dot(c, vec2(cos(ha), -sin(ha)))) <= w) return 2.0;
  }
  return 0.0;
}
void main() {
  float fog = fogFactorAt(vWorld);
  if (vKind < ${SD_PILLAR_DIALS - 0.5}) {
    vec2 cell = floor(vQ * N), c = cell + 0.5;
    float part = dialPart(c, uHands[int(vKind + 0.5)]);
    if (part < -0.5) discard;
    vec3 tone = uEnd > 0.5 ? RED : GOLD;
    vec3 col = vec3(0.0);
    float alpha = ${SD_DIAL_LIGHT.enamel.toFixed(2)};
    if (part > 3.5) { col = tone * ${SD_DIAL_LIGHT.boss.toFixed(2)}; alpha = 1.0; }
    else if (part > 2.5) { col = (uEnd > 0.5 ? RED : HOT) * ${SD_DIAL_LIGHT.hand.toFixed(2)}; alpha = 1.0; }
    else if (part > 1.5) { col = tone * ${SD_DIAL_LIGHT.tick.toFixed(2)}; alpha = 1.0; }
    else if (part > 0.5) {
      float lit = dot(normalize(c), vec2(-0.7071, 0.7071));   // the bezel lit from the top-left, as the paint box bevels
      col = tone * ${SD_DIAL_LIGHT.bezel.toFixed(2)} * (0.8 + 0.35 * lit); alpha = 1.0;
    }
    o = vec4(sdPixel(col * uDim * fog, cell, uSteps), alpha * fog);
    return;
  }
  if (vKind > ${SD_PILLAR_DIALS + SD_LANTERNS - 0.5}) {
    // the lantern's light on its housing, from its middle out, in three steps
    bool hood = vKind < ${SD_PILLAR_DIALS + SD_LANTERNS + SD_LANTERNS - 0.5};
    vec2 cell = floor(vQ * 25.0);
    float k = clamp(1.0 - length((cell + 0.5) / 25.0) / 1.3, 0.0, 1.0);
    k = floor(k * k * 3.0 + bayer4(cell) * 0.85) / 3.0;
    o = vec4(GOLD * (hood ? ${SD_LANTERN_SPILL.hood.toFixed(2)} : ${SD_LANTERN_SPILL.cornice.toFixed(2)}) * k * uDim * fog, 0.0);
    return;
  }
  // a lantern's flame: the core, then the glow in four steps
  float r = length(vQ);
  if (r >= 1.0) discard;
  vec2 q = vQ * ${SD_LANTERN_FLAME.size.toFixed(3)};
  vec2 cell = floor(q / 0.03125);
  vec2 qc = (cell + 0.5) * 0.03125;
  float core = (qc.x * qc.x) / ${(SD_LANTERN_FLAME.coreW ** 2).toFixed(5)} + ((qc.y + 0.03) * (qc.y + 0.03)) / ${(SD_LANTERN_FLAME.coreH ** 2).toFixed(5)};
  float k = (1.0 - r) * (1.0 - r);
  k = floor(k * 4.0 + bayer4(gl_FragCoord.xy) * 0.85) / 4.0;
  vec3 col = GOLD * ${SD_LANTERN_FLAME.glow.toFixed(2)} * k * uGain;
  if (core <= 1.0) col = max(col, HOT * ${SD_LANTERN_FLAME.core.toFixed(2)} * (1.0 - 0.35 * core));
  o = vec4(col * uDim * fog, 0.0);
}`;

/** The static buffer: each dial a quad over its face (its centre, its right and up times its radius), each flame a quad
 *  about its centre (the vertex shader turns it to the eye) - centre xyz, corner uv, which (0-15 a dial, 16-19 a flame). */
export function sdPillarPassGeometry() {
  const D = sdPillarDials(), L = sdLanterns(), R = SD_PILLAR_DIAL.r, out = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  D.forEach((d, i) => { for (const [u, v] of corners) out.push(d.at[0] + d.right[0] * u * R, d.at[1] + v * R, d.at[2] + d.right[2] * u * R, u, v, i); });
  L.forEach((p, k) => { for (const [u, v] of corners) out.push(p[0], p[1], p[2], u, v, SD_PILLAR_DIALS + k); });
  // the housing's lit faces: each hood's underside a hair under it, then each cornice's top a hair over it
  const P = SD_PILLAR_LOOK, faces = [[P.lantern.y1 - 0.004, P.roof.w - 0.01], [P.cornice.y1 + 0.004, P.cornice.w - 0.01]];
  faces.forEach(([y, h], f) => L.forEach((p, k) => { for (const [u, v] of corners) out.push(p[0] + u * h, p[1] - SD_LANTERN.flameY + y, p[2] + v * h, u, v, SD_PILLAR_DIALS + SD_LANTERNS * (1 + f) + k); }));
  return new Float32Array(out);
}

/** The pass. */
export class SdPillarPassRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, SD_PILLAR_VS, SD_PILLAR_FS, 'sd pillars');
    this.u = {};
    for (const n of ['uView', 'uProj', 'uHands', 'uDim', 'uEnd', 'uGain', 'uSteps', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFogColor']) this.u[n] = gl.getUniformLocation(this.prog, n);
    const data = sdPillarPassGeometry();
    this.count = data.length / 6;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
    gl.bindVertexArray(null);
  }
  /** Draw the dials and the flames as `look` says (`{ hands, k: [dim, end] }` - scenes/sdArenaWatch.js's kept record),
   *  in `fog`, at the pixel law's `steps`, the flames' glow at `gain`. Answers whether it drew. */
  draw(proj, view, look, fog = null, steps = 10, gain = 1) {
    const gl = this.gl, U = this.u;
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(U.uView, false, view); gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1fv(U.uHands, look.hands); gl.uniform1f(U.uDim, look.k[0]); gl.uniform1f(U.uEnd, look.k[1]); gl.uniform1f(U.uGain, gain); gl.uniform1f(U.uSteps, steps);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0); gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? [0, 1]); gl.uniform3fv(U.uCamPos, fog?.camPos ?? [0, 0, 0]); gl.uniform3fv(U.uFogColor, fog?.color ?? [0, 0, 0]);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE);
    return true;
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
  }
}
