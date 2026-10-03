// @ts-check
// NAV-B (2026-09-28) - THE SEA FIGHT, DRAWN: the smoke, the flashes, the spray and the splinters of
// systems/naval/navalEffects.js, the balls in the air (navalShots.js), the fire barrels and casks afloat, and the
// aim - the arc of the laid guns and the zone where the volley will fall - on the world renderer they draw beside.
// The port's own pass, in the port's foreign-pass convention (render/comeSailAwayRender.js's): the renderer's own
// matrices, light and fog, and `markForeignPass` after.
//
// ONE PROGRAM, WORLD TRIANGLES. Everything here is a quad the CPU lays out - a particle turned to face the eye
// (the view's own right and up), a foam ring or a zone disc laid flat on the sea, a ribbon segment turned about its
// own length toward the eye - so one small program draws it all: a vertex is its place, its picture coordinate, its
// colour and whether the scene's light falls on it. Four pictures, made here and never shipped (`naval*Texture`):
// a soft dot, a lumpy smoke puff, a foam ring and a hard disc - white, their shape in alpha - laid side by side on
// one sheet (AUDIT NAV1, the frame's cost, #13: NAVAL_SHEET), so the blended layers, sorted back to front, are one
// draw whatever pictures they wear; the arcs' dashed line is a picture of its own, repeated along them.
//
// TWO BLENDS. ALPHA - smoke, spray, foam, splinters, the balls, the zone - premultiplied in the shader (colour times
// alpha, ONE / ONE_MINUS_SRC_ALPHA), drawn back to front so a wall of smoke layers true; lit by the scene's ambient
// and sun (a night fight's smoke is dark), fogged to the fog's colour. ADD - the flashes, the embers, the aim's
// arc - added onto the frame (ONE / ONE), unlit, their light thinned by the fog. Both test the depth the world
// wrote and write none (a hull in front hides the smoke behind it; the smoke hides nothing).
//
// DRAWN AFTER THE SEA'S TRANSPARENT TOP (the host's order), so what stands above the water blends over it; a
// sinking hull is Come Sail Away's pool's mesh, drawn with the world.

import { buildProgram } from './glProgram.js';
import { FOG_GLSL } from './fogGlsl.js';

/** Floats a vertex: position 3, uv 2, colour 4, lit 1. */
export const NAVAL_STRIDE = 10;
/** The most quads a frame draws (the effects' budget, the balls, the zone and the arc together). */
export const NAVAL_MAX_QUADS = 1600;
/** The pictures' side (texels). */
export const NAVAL_TEX_SIZE = 64;
/** AUDIT NAV1 (the helm): a zone post's half width and half height (m), and a strike mark's half size. */
export const AIM_POST_HALF_W = 0.45;
export const AIM_POST_HALF_H = 1.7;
export const AIM_STRIKE_HALF = 1.1;
/**
 * AUDIT NAV1 (the presentation, #4) - THE ARCS AS LINES. A ball's arc is ARC_WIDTH_VH of the view's height across at
 * any distance (a 0.12 m ribbon was 0.7 px at 150 m and ~30 px beside the eye, where the broadside's arcs leave her
 * side), in the LINE picture - solid across its middle, the same all along it (the soft dot a segment drew it as beads,
 * nought at every joint) - and dashed by its own metres: the picture repeats every ARC_DASH_M of flight, its second
 * half ARC_DASH_DIM, marching out along the flight at ARC_DASH_SPEED (a 2.5 m dash judged once a segment - each 8 m
 * of it - aliased to 1, .35, 1, .35, .35, 1).
 */
export const ARC_WIDTH_VH = 0.003;
export const ARC_DASH_M = 6;
export const ARC_DASH_DIM = 0.35;
export const ARC_DASH_SPEED = 9;

/**
 * The aim's colours: brass laid, red when its guns strike a ship, grey while the battery cannot fire (loading, braced,
 * crippled - where it would fall, not a promise). Premultiplied by the pass; the alpha is the strength.
 */
export function aimTone(aim) {
  if (aim?.ready === false) return AIM_TONES.idle;
  return aim?.hot ? AIM_TONES.hot : AIM_TONES.laid;
}
export const AIM_TONES = Object.freeze({
  laid: Object.freeze({ zone: [0.98, 0.84, 0.46, 0.42], arc: [1, 0.86, 0.55, 0.4], post: [1, 0.84, 0.5, 0.3], strike: [1, 0.8, 0.45, 0.5] }),
  hot: Object.freeze({ zone: [0.95, 0.18, 0.12, 0.55], arc: [1, 0.35, 0.22, 0.55], post: [1, 0.3, 0.2, 0.36], strike: [1, 0.26, 0.16, 0.8] }),
  idle: Object.freeze({ zone: [0.62, 0.64, 0.66, 0.3], arc: [0.62, 0.64, 0.66, 0.22], post: [0.6, 0.62, 0.64, 0.16], strike: [0.62, 0.64, 0.66, 0.35] }),
});

/** A half-axis across the eye's line to `p`, on the flat, `half` long - an upright quad's width turned to the eye. */
export function flatAcross(p, eye, half) {
  const dx = p[0] - eye[0], dz = p[2] - eye[2];
  const l = Math.hypot(dx, dz) || 1;
  return [-dz / l * half, 0, dx / l * half];
}

const VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aColor;
layout(location = 3) in float aLit;
uniform mat4 uProj;
uniform mat4 uView;
out vec2 vUv;
out vec4 vColor;
out float vLit;
out vec3 vWorldPos;
void main() {
  vUv = aUv;
  vColor = aColor;
  vLit = aLit;
  vWorldPos = aPos;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`;
export const NAVAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
in float vLit;
in vec3 vWorldPos;
uniform sampler2D uTex;
uniform int uAdd;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform float uSunScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
void main() {
  float a = texture(uTex, vUv).a * vColor.a;
  if (a < 0.002) discard;
  vec3 c = vColor.rgb;
  if (vLit > 0.5) c *= clamp(uAmbient + uSunColor * (uSunScale * (0.35 + 0.65 * max(uLightDir.y, 0.0))), vec3(0.0), vec3(1.4));
  float f = fogFactorAt(vWorldPos);
  if (uAdd == 1) {
    outColor = vec4(dwWaterFogAdd(c * a * f, vWorldPos), 0.0);
  } else {
    vec3 col = dwWaterFog(mix(uFogColor, c, f), vWorldPos);
    outColor = vec4(col * a, a);
  }
}`;

/** A deterministic draw for the pictures (the same bytes every boot). */
function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A white picture whose alpha is `shape(u, v)` over [-1, 1]^2. */
function picture(shape, size = NAVAL_TEX_SIZE) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
      const i = (y * size + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, shape(u, v))));
    }
  }
  return { width: size, height: size, data };
}
/** The soft dot: a smooth fall to nothing at the rim. */
export const navalSoftTexture = () => picture((u, v) => { const r = Math.min(1, Math.hypot(u, v)); return (1 - r) * (1 - r); });
/** The smoke puff: a soft dot broken into lumps by a few seeded blobs, so a wall of puffs never tiles. */
export function navalSmokeTexture() {
  const rnd = prng(0x5a0e);
  const blobs = Array.from({ length: 9 }, () => ({ x: (rnd() - 0.5) * 1.1, y: (rnd() - 0.5) * 1.1, r: 0.3 + rnd() * 0.35 }));
  return picture((u, v) => {
    let m = 0;
    for (const b of blobs) { const d = Math.hypot(u - b.x, v - b.y) / b.r; m = Math.max(m, Math.max(0, 1 - d * d)); }
    const rim = Math.max(0, 1 - Math.hypot(u, v));
    return m * rim * 1.15;
  });
}
/** The foam ring: bright at 0.7 of the radius, falling away either side. */
export const navalRingTexture = () => picture((u, v) => { const r = Math.hypot(u, v); return Math.max(0, 1 - Math.abs(r - 0.7) / 0.28) * (r < 1 ? 1 : 0); });
/** The hard disc: a ball's, a splinter's and the zone's mark - solid to its edge, a pixel's fall there. */
export const navalDiscTexture = () => picture((u, v) => { const r = Math.hypot(u, v); return Math.max(0, Math.min(1, (1 - r) * 12)); });
/** AUDIT NAV1 (the presentation, #4): the arcs' line - solid across its middle, falling to nothing by its edge texels,
 *  the same along its length but for the dash (the first half of a repeat lit, the second ARC_DASH_DIM); repeated
 *  along (`repeatS`). */
export const navalLineTexture = () => ({ ...picture((u, v) => Math.max(0, Math.min(1, (0.97 - Math.abs(v)) / 0.3)) * (u < 0 ? 1 : ARC_DASH_DIM)), repeatS: true });
export const NAVAL_TEXTURES = Object.freeze({ soft: navalSoftTexture, smoke: navalSmokeTexture, ring: navalRingTexture, disc: navalDiscTexture, line: navalLineTexture });

/**
 * AUDIT NAV1 (the frame's cost, #13): THE PICTURES ON ONE SHEET. The blended layers are sorted back to front, and a
 * run of one picture was one draw: two ships trading broadsides put 234-296 draws a frame, and as many texture binds,
 * through this pass once their smoke, spray and splinters mixed. The four particle pictures stand side by side on one
 * sheet, each in a cell of its own a texel wider all round (NAVAL_SHEET_GUTTER, clear), so the linear filter at a
 * quad's edge reads the picture's own rim and never its neighbour's; a quad's picture is its cell (`sheetUv`). The
 * blended pass is one draw, the added two (the sheet's, and the arcs' line, which repeats and has its own).
 */
export const NAVAL_SHEET_GUTTER = 1;
export const NAVAL_SHEET = Object.freeze({ soft: Object.freeze([0, 0]), smoke: Object.freeze([1, 0]), ring: Object.freeze([0, 1]), disc: Object.freeze([1, 1]) });
const SHEET_CELL = NAVAL_TEX_SIZE + 2 * NAVAL_SHEET_GUTTER;
export const NAVAL_SHEET_SIZE = SHEET_CELL * 2;
/** A picture's cell on the sheet: `{ u0, u1, v0, v1 }` - its own texels, edge to edge. */
export function sheetUv(pic) {
  const [col, row] = NAVAL_SHEET[pic] ?? NAVAL_SHEET.soft;
  const x0 = col * SHEET_CELL + NAVAL_SHEET_GUTTER, y0 = row * SHEET_CELL + NAVAL_SHEET_GUTTER;
  return { u0: x0 / NAVAL_SHEET_SIZE, u1: (x0 + NAVAL_TEX_SIZE) / NAVAL_SHEET_SIZE, v0: y0 / NAVAL_SHEET_SIZE, v1: (y0 + NAVAL_TEX_SIZE) / NAVAL_SHEET_SIZE };
}
const SHEET_UV = Object.freeze(Object.fromEntries(Object.keys(NAVAL_SHEET).map((k) => [k, Object.freeze(sheetUv(k))])));
/** The sheet: the four pictures copied into their cells, the gutters clear (white, alpha nought). */
export function navalSheetTexture() {
  const size = NAVAL_SHEET_SIZE, data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; }
  for (const [name, [col, row]] of Object.entries(NAVAL_SHEET)) {
    const pic = NAVAL_TEXTURES[name]();
    const x0 = col * SHEET_CELL + NAVAL_SHEET_GUTTER, y0 = row * SHEET_CELL + NAVAL_SHEET_GUTTER;
    for (let y = 0; y < pic.height; y++) data.set(pic.data.subarray(y * pic.width * 4, (y + 1) * pic.width * 4), ((y0 + y) * size + x0) * 4);
  }
  return { width: size, height: size, data };
}
/** What the pass uploads: the sheet, and the line. */
export const NAVAL_GL_TEXTURES = Object.freeze({ sheet: navalSheetTexture, line: navalLineTexture });

/** Which picture a particle kind wears. */
export const pictureOf = (p) => (p.kind === 'smoke' ? 'smoke' : p.kind === 'foam' ? 'ring' : p.solid ? 'disc' : 'soft');

/**
 * Lays a quad into `out` at vertex `v`: centre `c`, half-axes `ax` and `ay` (world), the colour and the lit flag - its
 * picture's u from `u0` to `u1` along `ax` (0 to 1 but for a line repeated along its length) and v from `v0` to `v1`
 * along `ay` (a picture's cell on the sheet). Answers the next vertex. Pure - the tests read the layout off it.
 */
export function writeQuad(out, v, c, ax, ay, color, lit, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  for (const [sx, sy] of corners) {
    const o = v * NAVAL_STRIDE;
    out[o] = c[0] + ax[0] * sx + ay[0] * sy;
    out[o + 1] = c[1] + ax[1] * sx + ay[1] * sy;
    out[o + 2] = c[2] + ax[2] * sx + ay[2] * sy;
    out[o + 3] = u0 + (u1 - u0) * (sx + 1) / 2; out[o + 4] = v0 + (v1 - v0) * (1 - sy) / 2;
    out[o + 5] = color[0]; out[o + 6] = color[1]; out[o + 7] = color[2]; out[o + 8] = color[3];
    out[o + 9] = lit ? 1 : 0;
    v++;
  }
  return v;
}

/** The view's right and up in the world, from a column-major view matrix (its rows). */
export function viewAxes(view) {
  return { right: [view[0], view[4], view[8]], up: [view[1], view[5], view[9]] };
}

/** A particle's two half-axes: facing the eye (turned by its roll) or, `flat`, lying on the sea - AUDIT NAV1 (#15):
 *  `aspect` times as long as it is wide along its first (a plank). */
export function particleAxes(p, axes) {
  const h = p.size * 0.5, c = Math.cos(p.rot ?? 0), s = Math.sin(p.rot ?? 0);
  const hl = h * (p.aspect ?? 1);
  if (p.flat) return { ax: [c * hl, 0, s * hl], ay: [-s * h, 0, c * h] };
  const { right: R, up: U } = axes;
  return {
    ax: [(R[0] * c + U[0] * s) * h, (R[1] * c + U[1] * s) * h, (R[2] * c + U[2] * s) * h],
    ay: [(-R[0] * s + U[0] * c) * h, (-R[1] * s + U[1] * c) * h, (-R[2] * s + U[2] * c) * h],
  };
}

/**
 * A ribbon along `points` - each segment a quad turned about its own length toward the eye - into `out` from vertex
 * `v`. `width` across: metres, or with `vh` (the view's height in metres a metre from the eye, `2 / proj[5]`) a share
 * of the view's height at the segment's own distance - one width on the screen, near or far (AUDIT NAV1, #4). With a
 * `period` its picture's u runs the metres flown over it from `offset` - a line picture repeated along the arc by its
 * own length. Answers the next vertex.
 */
export function writeRibbon(out, v, points, eye, width, color, { vh = 0, period = 0, offset = 0 } = {}) {
  let run = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-6) continue;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const e = [eye[0] - mid[0], eye[1] - mid[1], eye[2] - mid[2]];
    let s = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]];
    const sl = Math.hypot(s[0], s[1], s[2]) || 1;
    const w = vh > 0 ? width * vh * Math.hypot(e[0], e[1], e[2]) : width;
    s = [s[0] / sl * w / 2, s[1] / sl * w / 2, s[2] / sl * w / 2];
    const u0 = period > 0 ? (run - offset) / period : 0, u1 = period > 0 ? (run + len - offset) / period : 1;
    run += len;
    v = writeQuad(out, v, mid, [d[0] / 2, d[1] / 2, d[2] / 2], s, color, false, u0, u1);
  }
  return v;
}

const LIGHT_FOG = ['uAmbient', 'uSunColor', 'uSunScale', 'uLightDir', 'uCamPos', 'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uDwFog', 'uFocus'];

export class NavalRenderer {
  /** @param {any} renderer - render/renderer.js's (its matrices, light and fog are this pass's too) */
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    /** @type {any} */ this._p = null;
    /** @type {Map<string, WebGLTexture>} */ this._tex = new Map();
    this.data = new Float32Array(NAVAL_MAX_QUADS * 6 * NAVAL_STRIDE);
    /** what the last draw put up, for the probes and the tests */
    this.drawn = 0;
  }

  _ensure() {
    if (this._p) return this._p;
    const gl = this.gl;
    const p = buildProgram(gl, VS, NAVAL_FS, 'naval effects');
    const u = Object.fromEntries(['uProj', 'uView', 'uTex', 'uAdd', ...LIGHT_FOG].map((n) => [n, gl.getUniformLocation(p, n)]));
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const F = 4, S = NAVAL_STRIDE * F;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 3 * F);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 5 * F);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 9 * F);
    gl.bindVertexArray(null);
    for (const [name, make] of Object.entries(NAVAL_GL_TEXTURES)) {
      const pic = make();
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pic.width, pic.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pic.data);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, pic.repeatS ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._tex.set(name, tex);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._p = { p, u, vao, vbo };
    return this._p;
  }

  _uniforms(u) {
    const gl = this.gl, r = this.renderer;
    gl.uniformMatrix4fv(u.uProj, false, r._proj);
    gl.uniformMatrix4fv(u.uView, false, r._view);
    gl.uniform3fv(u.uAmbient, r._ambient);
    gl.uniform3fv(u.uSunColor, r._sunColor);
    gl.uniform1f(u.uSunScale, r._sunScale ?? 0);
    gl.uniform3fv(u.uLightDir, r._lightDir);
    gl.uniform3fv(u.uCamPos, r._camPos);
    gl.uniform3fv(u.uFogColor, r._fogColor);
    gl.uniform1i(u.uFogMode, r._fogMode);
    gl.uniform1f(u.uFogDensity, r._fogDensity);
    gl.uniform2fv(u.uFogRange, r._fogRange);
    if (r._dwFog) gl.uniform4fv(u.uDwFog, r._dwFog);
    if (u.uFocus) gl.uniform4fv(u.uFocus, r._focus);
  }

  /**
   * One frame's drawing. `frame` = { particles (navalEffects drawList), balls ([{ pos, gun }]), floaters ([{ kind,
   * pos }]), aim: { arcs: point[][], zone: point[], strikes?: point[], hot: boolean, ready?: boolean, posts?: boolean,
   * radius?: number } | null, time? (the host's clock, s: the arcs' dash marches on it) } - every list optional.
   */
  draw(frame) {
    this.drawn = 0;
    const r = this.renderer;
    if (!r?._proj || !r?._view) return;
    const eye = r._camPos ?? [0, 0, 0];
    const axes = viewAxes(r._view);
    /** AUDIT NAV1 (#13): each blend's runs in the order laid - [texture, first vertex, end] - one draw a run */
    const runs = { alpha: [], add: [] };
    const run = (blend, tex, start) => {
      if (v <= start) return;
      const list = runs[blend], last = list[list.length - 1];
      if (last && last[0] === tex && last[2] === start) last[2] = v; else list.push([tex, start, v]);
    };
    const alpha = [], add = [];
    for (const p of frame.particles ?? []) (p.blend === 'add' ? add : alpha).push(p);
    for (const b of frame.balls ?? []) alpha.push({ pos: b.pos, size: b.gun === 'heavy' ? 0.34 : b.gun === 'swivel' ? 0.16 : 0.26, color: [0.07, 0.07, 0.08, 1], rot: 0, blend: 'alpha', solid: true, kind: 'ball' });
    // SALVAGE: a sunk ship's wreckage (`wreck`, the host's mark) floats larger and paler than her casks - broken timber
    for (const f of frame.floaters ?? []) {
      const wreck = f.kind === 'flotsam' && !!f.wreck;
      alpha.push({ pos: [f.pos[0], f.pos[1] + (wreck ? 0.25 : 0.35), f.pos[2]], size: wreck ? 1.4 : 0.9, color: f.kind === 'barrel' ? [0.45, 0.2, 0.08, 1] : wreck ? [0.66, 0.54, 0.36, 1] : [0.52, 0.38, 0.2, 1], rot: 0, blend: 'alpha', solid: true, kind: f.kind });
    }
    // back to front, so the blended layers stack as they stand
    const d2 = (p) => (p.pos[0] - eye[0]) ** 2 + (p.pos[1] - eye[1]) ** 2 + (p.pos[2] - eye[2]) ** 2;
    alpha.sort((a, b) => d2(b) - d2(a));
    let v = 0;
    const cap = NAVAL_MAX_QUADS * 6;
    const lay = (list, blend) => {
      // every picture a cell of the sheet: the list, in its order, is one run
      const start = v;
      for (const p of list) {
        if (v + 6 > cap) break;
        const { ax, ay } = particleAxes(p, axes);
        const uv = SHEET_UV[pictureOf(p)];
        v = writeQuad(this.data, v, p.pos, ax, ay, p.color, blend === 'alpha' && p.kind !== 'flash', uv.u0, uv.u1, uv.v0, uv.v1);
      }
      run(blend, 'sheet', start);
    };
    lay(alpha, 'alpha');
    // the aim: the zone's marks flat on the sea (blended), the posts and the strikes and the arcs' ribbons (added)
    const aim = frame.aim;
    const tone = aimTone(aim);
    if (aim?.zone?.length) {
      const start = v, uv = SHEET_UV.ring;
      for (const z of aim.zone) {
        if (v + 6 > cap) break;
        v = writeQuad(this.data, v, [z[0], z[1] + 0.06, z[2]], [aim.radius ?? 2.2, 0, 0], [0, 0, aim.radius ?? 2.2], tone.zone, false, uv.u0, uv.u1, uv.v0, uv.v1);
      }
      run('alpha', 'sheet', start);
    }
    lay(add, 'add');
    // AUDIT NAV1 (the helm): a ball's fall stood up over its mark - a disc on the sea 150 m off is a line, a post of
    // light is not - and a ball that meets a hull marked where it strikes her. Added light: laid before the arcs, it
    // sums the same, and runs on with the flashes' sheet
    if (aim?.posts && aim.zone?.length) {
      const start = v, uv = SHEET_UV.soft;
      for (const z of aim.zone) {
        if (v + 6 > cap) break;
        const f = flatAcross(z, eye, AIM_POST_HALF_W);
        v = writeQuad(this.data, v, [z[0], z[1] + AIM_POST_HALF_H, z[2]], f, [0, AIM_POST_HALF_H, 0], tone.post, false, uv.u0, uv.u1, uv.v0, uv.v1);
      }
      run('add', 'sheet', start);
    }
    if (aim?.strikes?.length) {
      const start = v, uv = SHEET_UV.soft;
      const h = AIM_STRIKE_HALF;
      for (const z of aim.strikes) {
        if (v + 6 > cap) break;
        v = writeQuad(this.data, v, z, [axes.right[0] * h, axes.right[1] * h, axes.right[2] * h], [axes.up[0] * h, axes.up[1] * h, axes.up[2] * h], tone.strike, false, uv.u0, uv.u1, uv.v0, uv.v1);
      }
      run('add', 'sheet', start);
    }
    if (aim?.arcs?.length) {
      // AUDIT NAV1 (the presentation, #4): one width on the screen, dashed by the metres flown and marching out
      const start = v;
      const vh = 2 / (r._proj[5] || 1);
      const offset = (frame.time ?? 0) * ARC_DASH_SPEED;
      for (const arc of aim.arcs) {
        if (v + arc.length * 6 > cap) break;
        v = writeRibbon(this.data, v, arc, eye, ARC_WIDTH_VH, tone.arc, { vh, period: ARC_DASH_M, offset });
      }
      run('add', 'line', start);
    }
    if (!v) return;
    const gl = this.gl;
    const P = this._ensure();
    gl.useProgram(P.p);
    this._uniforms(P.u);
    gl.bindVertexArray(P.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, v * NAVAL_STRIDE));
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(P.u.uTex, 0);
    // the blended first (back to front as laid), then the added over them
    let bound = null;
    for (const blend of ['alpha', 'add']) {
      gl.uniform1i(P.u.uAdd, blend === 'add' ? 1 : 0);
      gl.blendFunc(gl.ONE, blend === 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      for (const [tex, a, b] of runs[blend]) {
        if (bound !== tex) { gl.bindTexture(gl.TEXTURE_2D, this._tex.get(tex)); bound = tex; }
        gl.drawArrays(gl.TRIANGLES, a, b - a);
      }
    }
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);
    this.drawn = v / 6;
    r.markForeignPass?.();
  }

  dispose() {
    const gl = this.gl;
    if (this._p) { gl.deleteProgram(this._p.p); gl.deleteBuffer(this._p.vbo); gl.deleteVertexArray(this._p.vao); this._p = null; }
    for (const t of this._tex.values()) gl.deleteTexture(t);
    this._tex.clear();
  }
}
