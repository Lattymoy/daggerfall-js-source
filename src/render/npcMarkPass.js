// @ts-check
// NPC-MARKS (2026-10-21, the owner: "For morrowind models, vendors and quests npcs are hard to find due to everyone looking
// the same. Could we make a bobbing icon above their character for morrowind specifically?"): THE MARK OVER A HEAD - one
// small pixel-art icon bobbing over each standing person in a Morrowind body whom a click would take somewhere other
// than talk: a quest's person (a gold "!"), a merchant (a gold coin) and a guild's servant (a blue gem). What a person IS
// is scenes/npcMarksHost.js's law; this file draws the icons it hands over.
//
// THE FORM. One quad a mark, square to the eye (the camera's own right, the world's up), standing on a point over the
// crown of the body it marks (its bottom there, whatever size it is drawn at); the icon is drawn by the fragment stage on a grid of MARK_GRID x MARK_GRID cells, so it reads as the pixel art
// the classic sprites are and needs no picture (nothing is read from ARENA2, so nothing derived ships). Blended over the
// frame (premultiplied), tested against the depth the world wrote and writing none, so a wall hides the mark and the
// mark hides nothing. Never smaller on the screen than MARK_MIN_RAD of the eye's view, so a shopkeeper across a hall
// still shows one; faded out over the last fifth of its reach. The bob is MARK_BOB_M at MARK_BOB_HZ, each mark a
// phase of its own; under reduced motion it holds still. No fog: a mark is a cue for the player's eye, and the lane it
// rides stands no body past a street's width.
//
// AUDIT NPC-MARKS (bible/04-Characters/Morrowind-NPCs.md section 31): the right axis is the billboards' own (`camRight`,
// the HANDEDNESS mirror - mat4.js mirrorProjectionX - flips the view's first row on the screen); the quad stands on its
// point rather than round it, so a far mark drawn large never sinks into the head; MARK_MIN_RAD keeps two screen pixels a
// cell (at twelve, a far icon's cells came out one and two pixels wide and shimmered as it bobbed); and nothing is bound
// unless a mark will draw - a pass that binds and draws nothing leaves the renderer's program shadow wrong without the
// host knowing to mark the seam (EV6).
//
// Not a DFU member: Daggerfall has no marks over heads, and the classic sprites need none (each shop's keeper is a
// picture of their own). Ledger A row (NPC-MARKS).
import { buildProgram } from './glProgram.js';
import { duelClock } from './duelWall.js';

/** The most marks a frame draws - the people lane's own Near cap (characters/npcBodies.js NPC_BODY_TIERS). */
export const NPC_MARKS_MAX = 12;
/** Half the icon's width and height, metres - a palm across, as a hanging shop sign reads at a street's width. */
export const MARK_HALF_M = 0.16;
/** The narrowest half-width the icon may stand at on the screen, as an angle of the eye's view (radians) - sixteen pixels
 *  of a 1080-line screen at the port's 65-degree field of view, two a cell of the grid. */
export const MARK_MIN_RAD = 0.017;
/** The bob: how far the icon rises and falls (metres) and how often (cycles a second - whole over duelWall.js's
 *  wrapped clock, so the wrap never jumps it). */
export const MARK_BOB_M = 0.06;
export const MARK_BOB_HZ = 1;
/** The icon's pixels a side. */
export const MARK_GRID = 16;
/** The kinds, and the number the shader draws each by. */
export const NPC_MARK_KINDS = Object.freeze({ quest: 0, merchant: 1, service: 2 });

const HEAD = `#version 300 es
precision highp float;
`;
/** x across (-1..1), y up (-1..1): `uAt` the point the icon stands on, its bottom's middle (the bob already in it),
 *  `uRight` the camera's right in the scene, the half-width `h` - `uHalf` or `uMinRad` of the eye's distance, whichever is
 *  wider - so the icon's centre is `h` over the point. */
export const NPC_MARK_VS = HEAD + `layout(location = 0) in vec2 aP;
uniform mat4 uVP;
uniform vec3 uAt;
uniform vec3 uRight;
uniform vec3 uEye;
uniform float uHalf;
uniform float uMinRad;
out vec2 vP;
void main() {
  float h = max(uHalf, length(uEye - uAt) * uMinRad);
  vec3 p = uAt + uRight * (aP.x * h) + vec3(0.0, (aP.y + 1.0) * h, 0.0);
  vP = aP;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const NPC_MARK_FS = HEAD + `in vec2 vP;
uniform int uKind;       // NPC_MARK_KINDS
uniform float uAlpha;
out vec4 o;
float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  // the cell's centre, so every pixel of a cell is one colour
  vec2 p = (floor((vP * 0.5 + 0.5) * ${MARK_GRID}.0) + 0.5) / ${MARK_GRID}.0 * 2.0 - 1.0;
  float d;            // the shape's distance (inside < 0)
  float inner = 1.0;  // 0 where the shape's own darker detail is
  vec3 fill;
  if (uKind == ${NPC_MARK_KINDS.quest}) {
    // "!": a bar over a dot, both square to the pixel grid
    d = min(box(p - vec2(0.0, 0.3), vec2(0.21, 0.52)), box(p - vec2(0.0, -0.62), vec2(0.21, 0.2)));
    fill = vec3(1.0, 0.93, 0.3);   // a lemon yellow, apart from the coin's amber where both are a few pixels
  } else if (uKind == ${NPC_MARK_KINDS.merchant}) {
    // a coin: a disc, a ring stamped inside its rim
    float r = length(p);
    d = r - 0.8;
    inner = abs(r - 0.5) < 0.09 ? 0.0 : 1.0;
    fill = vec3(0.92, 0.58, 0.14);
  } else {
    // a gem: a rhombus, a facet cut inside it
    float m = abs(p.x) * 1.25 + abs(p.y);
    d = m - 0.95;
    inner = abs(m - 0.5) < 0.1 ? 0.0 : 1.0;
    fill = vec3(0.42, 0.66, 1.0);
  }
  float outline = 0.22;   // a dark pixel's rim round the shape, so it reads over a lit wall and a dark one alike
  if (d > outline) discard;
  vec3 c = d > 0.0 ? vec3(0.1, 0.07, 0.04) : mix(fill * 0.62, fill, inner);
  if (d <= 0.0 && p.y > 0.25 && p.x < 0.0 && inner > 0.5) c = mix(c, vec3(1.0), 0.3);   // the light's catch, top left
  o = vec4(c * uAlpha, uAlpha);
}`;

/** The quad: x across, y up, both -1..1. Pure. */
export function markQuadVertices() {
  return new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
}

/** The bob's lift at `seconds` for a mark of phase `phase` (0..1), metres - none under reduced motion. Pure. */
export function markBob(seconds, phase, still = false) {
  if (still) return 0;
  return MARK_BOB_M * Math.sin(2 * Math.PI * (MARK_BOB_HZ * duelClock(seconds) + phase));
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export class NpcMarkRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const prog = buildProgram(gl, NPC_MARK_VS, NPC_MARK_FS, 'npcMarks');
    this.program = prog;
    /** @type {Record<string, WebGLUniformLocation | null>} */
    this.u = {};
    for (const n of ['uVP', 'uAt', 'uRight', 'uEye', 'uHalf', 'uMinRad', 'uKind', 'uAlpha']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = markQuadVertices();
    this.count = verts.length / 2;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** the marks the last draw stood, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw `n` marks of `marks` ([{ at: [x, y, z] the point the icon stands on, kind: a NPC_MARK_KINDS name, alpha }], the
   * first `n` read). `view` is the frame's view matrix: its first ROW (0, 4, 8) is lookAt's x, which the HANDEDNESS
   * mirror puts on the screen's LEFT, so the icon's right is its negative - the billboards' `camRight`. Nothing to
   * draw, nothing touched: not a program, not a VAO (AUDIT NPC-MARKS R2 - a bind with no draw left the renderer's
   * shadow wrong and the host, told nothing was drawn, marked no seam).
   * @param {ReadonlyArray<{ at: number[], kind: string, alpha: number }>} marks @param {number} n
   * @param {Float32Array} proj @param {Float32Array} view @param {ArrayLike<number>} eye
   */
  draw(marks, n, proj, view, eye) {
    this.drawn = 0;
    const last = Math.min(n | 0, NPC_MARKS_MAX);
    let any = false;
    for (let i = 0; i < last && !any; i++) any = marks[i].alpha > 0.001;
    if (!any || !this.program) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3f(U.uRight, -view[0], -view[4], -view[8]);
    gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(U.uHalf, MARK_HALF_M);
    gl.uniform1f(U.uMinRad, MARK_MIN_RAD);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    for (let i = 0; i < last; i++) {
      const m = marks[i];
      if (!(m.alpha > 0.001)) continue;
      gl.uniform3f(U.uAt, m.at[0], m.at[1], m.at[2]);
      gl.uniform1i(U.uKind, NPC_MARK_KINDS[m.kind] ?? NPC_MARK_KINDS.quest);
      gl.uniform1f(U.uAlpha, Math.min(1, m.alpha));
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /** EVERY ALLOCATION HAS AN OWNER: the program, the VAO and the buffer let go (scenes/npcMarksHost.js, when its last
   *  host lets go). A second call does nothing. */
  dispose() {
    const gl = this.gl;
    if (!this.program) return;
    gl.deleteProgram(this.program); gl.deleteVertexArray(this.vao); gl.deleteBuffer(this.vbo);
    this.program = null; this.vao = null; this.vbo = null;
  }
}
