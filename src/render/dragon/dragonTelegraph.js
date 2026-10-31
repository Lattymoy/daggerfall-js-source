// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md sections 6 and 9): THE DRAGON'S TELEGRAPHS, DRAPED - the gate's telegraph
// (render/gate/gateTelegraph.js: the fragment's own law, the shape a question of each point) on a grid laid over the land's
// heights, so a shape on a hillside follows the hill and never cuts through it or floats over a hollow. The gate's quad is a
// flat floor's; the open world has none. A grid is made once a shape (`drapeGrid` - pure) and lent to the gate's pass for
// its draw, as the Spire's fight floors are (drawFloors). Not a DFU member. Ledger A (DRAGON).
import {
  GateTelegraphRenderer,
  TELEGRAPH_FS,
  TELEGRAPH_KIND,
  TELEGRAPH_REACH,
  telegraphBounds,
} from '../gate/gateTelegraph.js';

/** A grid cell's side (m), the most cells along a side, and how far over the ground the shape lies (m). */
export const DRAPE_CELL_M = 2;
export const DRAPE_CELLS_MAX = 48;
export const DRAPE_LIFT_M = 0.2;
const NO_HAZE = new Float32Array(8); // uJungleHaze off ([1].x 0)
const NO_FOCUS = new Float32Array(4); // the eye's own fog (uFocus.w 0)
/** The floor every shape is drawn over: the fight's ground about its site, wider than any blow reaches. */
export const DRAGON_TELEGRAPH_FLOOR = Object.freeze({ r: 400, courts: Object.freeze([Object.freeze([0, 0])]) });

/** The draped stage: each vertex `aGround` its point in the site's frame (x, z) and the land's height under it (y, the
 *  scene's), `uCentre` the site's origin in the scene. */
export const DRAGON_TELEGRAPH_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aGround;
uniform mat4 uVP;
uniform vec3 uCentre;
uniform float uLift;
out vec2 vCourt;
out vec3 vWorld;
void main() {
  vCourt = aGround.xz;
  vWorld = vec3(uCentre.x + aGround.x, aGround.y + uLift + ${DRAPE_LIFT_M.toFixed(3)}, uCentre.z + aGround.z);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
export const DRAGON_TELEGRAPH_PROGRAMS = Object.freeze([Object.freeze([DRAGON_TELEGRAPH_VS, TELEGRAPH_FS])]);

/** The ground a shape can draw on, [x0, z0, x1, z1] in the site's frame: the gate's bounds, a ring's its outer circle. */
export function drapeBounds(sh) {
  if (sh?.kind === TELEGRAPH_KIND.ring) {
    const R = sh.r1 + TELEGRAPH_REACH;
    return [sh.origin[0] - R, sh.origin[1] - R, sh.origin[0] + R, sh.origin[1] + R];
  }
  return telegraphBounds(sh);
}

/**
 * THE GRID over `b` ([x0, z0, x1, z1], the site's frame): two triangles a cell, each vertex [x, y, z] with `y` the land's
 * height under it (`ground(x, z)`, a scene height) - `fallback` where the land is not there yet (`missing` then). Pure.
 * @param {number[]} b @param {(x: number, z: number) => number} ground @param {number} fallback
 * @returns {{ buf: Float32Array, n: number, missing: boolean }}
 */
export function drapeGrid(b, ground, fallback) {
  const w = Math.max(0.01, b[2] - b[0]),
    d = Math.max(0.01, b[3] - b[1]);
  const nx = Math.max(1, Math.min(DRAPE_CELLS_MAX, Math.ceil(w / DRAPE_CELL_M))),
    nz = Math.max(1, Math.min(DRAPE_CELLS_MAX, Math.ceil(d / DRAPE_CELL_M)));
  const ys = new Float32Array((nx + 1) * (nz + 1));
  let missing = false;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      let y = ground(b[0] + (w * i) / nx, b[1] + (d * j) / nz);
      if (!Number.isFinite(y)) {
        y = fallback;
        missing = true;
      }
      ys[j * (nx + 1) + i] = y;
    }
  }
  const n = nx * nz * 6,
    buf = new Float32Array(n * 3);
  let o = 0;
  const put = (i, j) => {
    buf[o++] = b[0] + (w * i) / nx;
    buf[o++] = ys[j * (nx + 1) + i];
    buf[o++] = b[1] + (d * j) / nz;
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      put(i, j);
      put(i + 1, j);
      put(i + 1, j + 1);
      put(i, j);
      put(i + 1, j + 1);
      put(i, j + 1);
    }
  return { buf, n, missing };
}

/** THE PASS: the gate's renderer under the draped stage, each shape drawn over its own grid. */
export class DragonTelegraphPass {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.pass = new GateTelegraphRenderer(gl, { programs: /** @type {any} */ (DRAGON_TELEGRAPH_PROGRAMS) });
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
    this.cap = 0;
    // AUDIT BANTHA1 HAZE-3: the fog block's haze and focus (fogGlsl.js fogFactorAt), which the gate's pass never uploads -
    // it draws in the court; this one draws on the open land, where the jungle's haze stands
    this.uHaze = gl.getUniformLocation(this.pass.program, 'uJungleHaze');
    this.uFocus = gl.getUniformLocation(this.pass.program, 'uFocus');
    /** how many shapes the last draw laid down */
    this.drawn = 0;
  }

  /**
   * Each `{ sh, mesh }` drawn, the site's origin at `centre` in the scene, under the renderer's own view and fog (the
   * frame's, as render/serpentRender.js reads them). Answers whether anything was drawn.
   * @param {Array<{ sh: any, mesh: { buf: Float32Array, n: number } }>} list @param {any} r @param {number[]} centre
   */
  draw(list, r, centre) {
    this.drawn = 0;
    if (!list.length || !r?._proj || !r?._view || !this.gl) return false;
    const gl = this.gl,
      p = this.pass,
      vao = p.vao,
      count = p.count;
    const fog = { mode: r._fogMode, density: r._fogDensity, range: r._fogRange, camPos: r._camPos, haze: r._haze };
    const seconds = performance.now() / 1000;
    gl.useProgram(p.program);
    if (this.uHaze) gl.uniform4fv(this.uHaze, r._haze ?? NO_HAZE);
    if (this.uFocus) gl.uniform4fv(this.uFocus, r._focus ?? NO_FOCUS);
    try {
      for (const { sh, mesh } of list) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        if (this.cap < mesh.n * 3) {
          gl.bufferData(gl.ARRAY_BUFFER, mesh.n * 12, gl.DYNAMIC_DRAW);
          this.cap = mesh.n * 3;
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.buf.subarray(0, mesh.n * 3));
        p.vao = this.vao;
        p.count = mesh.n;
        p.draw(sh, r._proj, r._view, r._camPos, seconds, fog, centre, null, DRAGON_TELEGRAPH_FLOOR);
        this.drawn += p.drawn;
      }
    } finally {
      p.vao = vao;
      p.count = count;
    }
    if (this.drawn) r.markForeignPass?.();
    return this.drawn > 0;
  }

  /** Every GL object let go, once. */
  destroy() {
    const gl = this.gl;
    if (!gl) return;
    this.gl = null;
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    this.pass.destroy();
    this.vao = null;
    this.vbo = null;
  }
}
