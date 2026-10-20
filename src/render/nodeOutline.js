// @ts-check
// NODE-OUTLINE (2026-10-19, the owner: "Overhaul gathering material visuals. Actually outline the sprite itself instead of
// a faint sparkle like it is now"): A NODE'S OUTLINE - every gathering node standing near the player (a herb patch, a
// vein, a boulder, a school, a tree - its flat or its 3D tree) ringed in its profession's colour (ui/nodeMarks.js, the
// colour its compass mark wears) along the edge of ITS OWN PICTURE, at a width the screen keeps whatever the distance.
// It takes the place of NODE-MARKS' glow card (render/nodeGlow.js: a halo, a shimmer and motes on a card before the node)
// wherever the node has a picture to ring; a node with none (a body drawn as a 3D character) keeps the glow.
//
// HOW - A SILHOUETTE, THEN ITS RING:
//   1. THE MASK. Each node's pictures are drawn again, unmoved, by the billboard program's own vertex stage (renderer.js
//      bbVertexShader - so a flat stands, sways and gives way to its 3D tree exactly as the world drew it, and a 3D tree
//      is turned, scaled and swayed as its door drew it), cut where the picture is cut, into a tile of a depth-only atlas
//      (OUTLINE_TILE square, OUTLINE_GRID x OUTLINE_GRID of them): the node's own rectangle on screen fitted into its tile.
//      The tile holds the node's silhouette, and at each of its texels the depth of the node there.
//   2. THE RING. Over the node's rectangle on screen, a fragment outside the silhouette within OUTLINE_PX of it (sixteen
//      taps round it, at the ring's radius and half of it) is the ring: drawn in the profession's colour at the depth of
//      the silhouette it borders, against the world's depth - so whatever stands before the node (a wall, a rock, the
//      grass) hides it, and whatever stands behind it (the ground, another tree) shows it. Never over the node itself: a
//      3D tree's front cards ring nothing over its own back ones (the shifted copies WEAPON-GLOW1 draws a weapon's ring
//      with would - the node's own depth is no test of which picture a pixel is).
// One draw a picture into the mask and one quad a node on screen; the frame's target, its viewport and the world's GL
// baseline handed back as they were. Each node's light is nodeGlow.js's law (`nodeGlows`): it kindles as it first stands
// near and fades out from NODE_GLOW_FADE_M to NODE_GLOW_M; it breathes, and stands still under reduced motion; the fog and
// the jungle's haze fade it as they fade the node. Not a DFU member.
import { bbVertexShader } from './renderer.js';
import { buildProgram } from './glProgram.js';
import { BAYER_GLSL } from './orderedDither.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { billboardKey } from './billboardKey.js';
import { windfallLawOn, swayShare } from './windfallSway.js';
import { nodeGlows, createNodeGlowState, createNodeGlowPass, NODE_GLOW_MAX } from './nodeGlow.js';
import { LPT_INSTANCE_FLOATS } from '../world/lowPolyTrees.js';

/** The ring's width in the drawn image's pixels at OUTLINE_REF_ROWS rows - scaled with the image, held to OUTLINE_PX_MIN
 *  at the least (a retro image's pixels are large: a pixel of its own). */
export const OUTLINE_PX = 2.5;
export const OUTLINE_REF_ROWS = 1080;
export const OUTLINE_PX_MIN = 1.5;
/** The mask's atlas: OUTLINE_GRID x OUTLINE_GRID tiles of OUTLINE_TILE texels - a node a tile, its rectangle on screen
 *  fitted in at a texel a pixel where it fits (a tree filling the screen at fewer). */
export const OUTLINE_TILE = 256;
export const OUTLINE_GRID = 4;
/** The most nodes one frame rings: the atlas's tiles - the glow's own budget. */
export const OUTLINE_MAX = OUTLINE_GRID * OUTLINE_GRID;
/** The ring's taps round a fragment: OUTLINE_TAPS directions, at its radius and half of it. */
export const OUTLINE_TAPS = 8;
/** The ring's opacity at its fullest, and its breath (a share either way, OUTLINE_BREATH_HZ - whole over the glow's
 *  wrapped clock). */
export const OUTLINE_ALPHA = 0.95;
export const OUTLINE_BREATH = 0.12;
export const OUTLINE_BREATH_HZ = 0.25;
/** How far behind the silhouette it borders the ring stands (m): never in front of the node's own surface, where a
 *  fitted tile's texel and the screen's pixel part by one (a tree nearer than its tile holds whole). */
export const OUTLINE_RING_BACK = 0.08;
/** How far round a 3D tree's root its crown is taken to reach, in its picture's widths (its far picture is drawn from one
 *  side; turned, a crown may reach past half of it). */
export const OUTLINE_TREE_REACH = 0.75;
/** A flat's six indices (u32) in its batch's index range - renderer.js BB_QUAD_INDEX_BYTES. */
export const OUTLINE_QUAD_INDEX_BYTES = 24;

if (OUTLINE_MAX !== NODE_GLOW_MAX) throw new Error('NODE-OUTLINE: the atlas holds the glow\'s budget');

/** The ring's width in pixels for an image `rows` tall. Pure. */
export const outlinePx = (rows) => Math.max(OUTLINE_PX_MIN, (OUTLINE_PX * rows) / OUTLINE_REF_ROWS);
/** The ring's opacity share at `seconds` (the glow's wrapped clock) - whole, still under reduced motion. Pure. */
export const outlineBreath = (seconds, still = false) => (still ? 1 : 1 - OUTLINE_BREATH * 0.5 * (1 - Math.cos(2 * Math.PI * OUTLINE_BREATH_HZ * seconds)));

/** THE MASK'S VERTEX STAGE: the billboard program's own, and after it places the vertex, the node's rectangle on screen
 *  (uMaskRect: its NDC centre, and one over its half size) stretched over the tile the viewport is. A vertex given way
 *  (`gone`, a far picture inside its 3D tree's radius) stays off the clip volume. */
export const NODE_MASK_VS = bbVertexShader({
  head: 'uniform vec4 uMaskRect;   // NODE-OUTLINE: the node\'s rectangle in NDC - its centre (xy), one over its half size (zw)',
  main: '  if (!gone) gl_Position.xy = (gl_Position.xy - uMaskRect.xy * gl_Position.w) * uMaskRect.zw;   // NODE-OUTLINE (render/nodeOutline.js): the rectangle over the tile',
});

/** THE MASK'S FRAGMENT STAGE: the picture's own cut and nothing else (the atlas is depth alone) - a flat's texel at its
 *  0.5, its quad's margin clear; a 3D tree's by its material and its handover's screen-door (render/lowPolyTreesGlsl.js
 *  LPT_FS_TEXEL, term for term). */
export const NODE_MASK_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vShade;
in float vAlpha;
in float vFade;
uniform sampler2D uTex;
out vec4 o;
${BAYER_GLSL}
void main() {
  vec4 tex = texture(uTex, vUV);   // sampled before any branch (SPRITE-GRAD's law)
  float a = tex.a;
  if (vFade < 1.5 && (vUV.x < 0.0 || vUV.x > 1.0 || vUV.y < 0.0 || vUV.y > 1.0)) a = 0.0;   // a flat's margin clear; a tree's uv wraps
  a = vAlpha > 0.0 ? a * vAlpha : 1.0;
  if (vFade < 1.0 ? bayer4(gl_FragCoord.xy) + 0.03125 >= vFade : (vFade > 1.5 && vFade < 3.0 && bayer4(gl_FragCoord.xy) + 0.03125 < 3.0 - vFade)) discard;
  if (a < 0.5) discard;
  o = vec4(0.0);
}`;

/** THE RING'S VERTEX STAGE: the node's rectangle on screen (uRect: NDC centre, half size), its depth the fragment's. */
export const NODE_RING_VS = `#version 300 es
layout(location = 0) in vec2 aP;
uniform vec4 uRect;
void main() { gl_Position = vec4(uRect.xy + aP * uRect.zw, 0.0, 1.0); }`;

const TAP_DIRS = Array.from({ length: OUTLINE_TAPS }, (_, k) => [Math.cos((2 * Math.PI * k) / OUTLINE_TAPS), Math.sin((2 * Math.PI * k) / OUTLINE_TAPS)]);
/** THE RING'S FRAGMENT STAGE: where the fragment falls in the node's tile; inside the silhouette, nothing; else the
 *  nearest depth of the silhouette among the taps round it - none, nothing; one, the ring, at that depth, faded by the fog
 *  and the haze where that depth stands in the world (uInvVP). */
export const NODE_RING_FS = `#version 300 es
precision highp float;
uniform highp sampler2D uMask;   // the atlas (depth)
uniform vec4 uRect;              // the rectangle's NDC centre (xy) and half size (zw)
uniform vec4 uTile;              // its tile in the atlas: the corner (xy) and the size (zw), in texels
uniform vec4 uViewport;          // the frame's viewport, in pixels
uniform float uRing;             // the ring's width, in the tile's texels
uniform vec4 uOutlineColor;      // rgb, and the ring's opacity (its kindling, its distance's fade and its breath)
uniform mat4 uInvVP;
uniform mat4 uVP;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
float maskAt(vec2 at, ivec2 lo, ivec2 hi) { return texelFetch(uMask, clamp(ivec2(floor(at)), lo, hi), 0).r; }
void main() {
  vec2 ndc = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw * 2.0 - 1.0;
  vec2 at = uTile.xy + ((ndc - uRect.xy) / uRect.zw * 0.5 + 0.5) * uTile.zw;
  ivec2 lo = ivec2(uTile.xy), hi = ivec2(uTile.xy + uTile.zw) - 1;
  if (maskAt(at, lo, hi) < 1.0) discard;   // the node itself
  float d = 1.0;
${TAP_DIRS.map(([x, y]) => `  d = min(d, min(maskAt(at + vec2(${x.toFixed(6)}, ${y.toFixed(6)}) * uRing, lo, hi), maskAt(at + vec2(${x.toFixed(6)}, ${y.toFixed(6)}) * (0.5 * uRing), lo, hi)));`).join('\n')}
  if (d >= 1.0) discard;   // no silhouette within the ring's reach
  vec4 w = uInvVP * vec4(ndc, d * 2.0 - 1.0, 1.0);
  vec3 at3 = w.xyz / w.w;
  vec3 away = at3 - uCamPos;
  vec4 c = uVP * vec4(at3 + away * (${OUTLINE_RING_BACK.toFixed(4)} / max(length(away), 1e-4)), 1.0);   // stood behind the silhouette it borders
  gl_FragDepth = clamp(c.z / c.w * 0.5 + 0.5, 0.0, 1.0);
  o = vec4(uOutlineColor.rgb, uOutlineColor.a * fogFactorAt(at3));
}`;

const MASK_UNIFORMS = ['uProj', 'uView', 'uRight', 'uUp', 'uOrigin', 'uSize', 'uFlatWind', 'uSway', 'uWindfallSway', 'uWindfallAxis', 'uTip',
  'uFacePoint', 'uElitePad', 'uTex', 'uMesh', 'uMeshScale', 'uMeshColor', 'uMeshAlpha', 'uLptCut', 'uLptBand', 'uLptSun', 'uMaskRect'];
const RING_UNIFORMS = ['uMask', 'uRect', 'uTile', 'uViewport', 'uRing', 'uOutlineColor', 'uInvVP', 'uVP', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze'];
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const ZERO4 = new Float32Array(4);
const ZERO_ORIGIN = Object.freeze([0, 0, 0]);
const isVec3 = (v) => v != null && typeof v === 'object' && v.length >= 3;

/**
 * A NODE'S PICTURES, as the outline draws them: `{ batch, first, count, centers }` - `count` flats of `batch` from its
 * `first`, and their centres (as the batch was made with them, about its origin) - and for a tree, `center` (the forest
 * flat's centre, the very array its pixel's 3D tree set holds) and `entry` (its pixel). The gathering host's marks carry
 * them (scenes/gatherHost.js `pictures`).
 * @typedef {{ batch: any, first: number, count: number, centers?: number[][]|null, center?: number[]|null, entry?: any }} NodePicture
 */

/** A tree's 3D instance this frame: the frame of the renderer's that drew its handle, the run it was drawn in, and its
 *  instance row `[x, y, z, yaw, scale]` (scene) written into `out` - or null. `frames` the renderer's drawn tree frames
 *  (lptDrawnFrames). Pure but for `rows` (a set's centre -> its row, made the first time a set is asked) and `out`.
 *  @param {NodePicture} pic @param {ReadonlyArray<any>} frames @param {WeakMap<any[], Map<any, number>>} rows @param {Float32Array} out */
export function treeInstanceOf(pic, frames, rows, out) {
  if (!pic.center || !pic.entry) return null;
  for (const set of [pic.entry.lowPolyTrees, pic.entry.jungleTrees]) {
    if (!set?.trees || !set.centers) continue;
    let byCenter = rows.get(set.centers);
    if (!byCenter) { byCenter = new Map(); for (let k = 0; k < set.centers.length; k++) byCenter.set(set.centers[k], k); rows.set(set.centers, byCenter); }
    const k = byCenter.get(pic.center);
    if (k === undefined) continue;
    const o = k * 6, handle = set.handles[set.trees[o]];
    for (const f of frames) {
      if (!f?.cut?.has(handle)) continue;
      const run = f.runs.find((r) => r.run.handle === handle);
      if (!run) return null;
      out[0] = set.trees[o + 1] + set.ox; out[1] = set.trees[o + 2] + set.oy; out[2] = set.trees[o + 3] + set.oz; out[3] = set.trees[o + 5]; out[4] = set.trees[o + 4];
      return { frame: f, run };
    }
    return null;
  }
  return null;
}

/**
 * THE NODE'S RECTANGLE ON SCREEN: the first `count` of `boxes` (each [x0, y0, z0, x1, y1, z1], scene) through `vp`
 * (proj x view), as `[cx, cy, hx, hy]` in NDC, widened by `pad` (NDC, x and y), held to the screen; null off it. A box
 * reaching behind the eye stands for the whole screen. Pure but for `out`.
 * @param {ReadonlyArray<ArrayLike<number>>} boxes @param {number} count @param {ArrayLike<number>} vp @param {[number, number]} pad @param {number[]} out
 */
export function screenRect(boxes, count, vp, pad, out) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, whole = false;
  for (let i = 0; i < count && !whole; i++) {
    const b = boxes[i];
    for (let c = 0; c < 8 && !whole; c++) {
      const x = c & 1 ? b[3] : b[0], y = c & 2 ? b[4] : b[1], z = c & 4 ? b[5] : b[2];
      const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (!(w > 1e-3)) { whole = true; break; }
      const px = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w, py = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
  }
  if (whole) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; }
  x0 = Math.max(-1, x0 - pad[0]); y0 = Math.max(-1, y0 - pad[1]); x1 = Math.min(1, x1 + pad[0]); y1 = Math.min(1, y1 + pad[1]);
  if (!(x1 > x0 && y1 > y0)) return null;
  out[0] = (x0 + x1) / 2; out[1] = (y0 + y1) / 2; out[2] = (x1 - x0) / 2; out[3] = (y1 - y0) / 2;
  return out;
}

/** A rectangle `[cx, cy, hx, hy]` (NDC) widened to whole pixels of a `vw` x `vh` viewport, in place. Pure but for
 *  `rect`. */
export function snapRect(rect, vw, vh) {
  const x0 = Math.floor((rect[0] - rect[2] + 1) * 0.5 * vw), x1 = Math.ceil((rect[0] + rect[2] + 1) * 0.5 * vw);
  const y0 = Math.floor((rect[1] - rect[3] + 1) * 0.5 * vh), y1 = Math.ceil((rect[1] + rect[3] + 1) * 0.5 * vh);
  rect[0] = ((x0 + x1) / vw) - 1; rect[2] = (x1 - x0) / vw;
  rect[1] = ((y0 + y1) / vh) - 1; rect[3] = (y1 - y0) / vh;
  return rect;
}

function invert4(m, out) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const id = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * id; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * id;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * id; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * id;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * id; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * id;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * id; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * id;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * id; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * id;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * id; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * id;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * id; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * id;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * id; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * id;
  return out;
}
function mul4(a, b, out) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

export class NodeOutlineRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.mask = buildProgram(gl, NODE_MASK_VS, NODE_MASK_FS, 'node outline mask');
    this.ring = buildProgram(gl, NODE_RING_VS, NODE_RING_FS, 'node outline ring');
    /** @type {Record<string, WebGLUniformLocation|null>} */
    this.um = {};
    for (const n of MASK_UNIFORMS) this.um[n] = gl.getUniformLocation(this.mask, n);
    /** @type {Record<string, WebGLUniformLocation|null>} */
    this.ur = {};
    for (const n of RING_UNIFORMS) this.ur[n] = gl.getUniformLocation(this.ring, n);
    const size = OUTLINE_TILE * OUTLINE_GRID;
    this.atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.atlas, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    this.quadVb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    /** one tree's instance row */
    this.inst = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, LPT_INSTANCE_FLOATS * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._row = new Float32Array(LPT_INSTANCE_FLOATS);
    /** @type {WeakMap<any, WebGLVertexArrayObject>} a tree door's buffers under this pass's instance (its gpu -> a VAO) */
    this._vaos = new WeakMap();
    /** @type {WebGLVertexArrayObject[]} every VAO made, freed with the pass */
    this._made = [];
    /** @type {WeakMap<any[], Map<any, number>>} */
    this._rows = new WeakMap();
    // the frame's scratch: each node's rectangle, its tile, its boxes; the matrices
    this._nodes = Array.from({ length: OUTLINE_MAX }, () => ({ g: null, rect: [0, 0, 0, 0], tile: [0, 0, 0, 0], ring: 1, boxes: /** @type {number[][]} */ ([]) }));
    this._vp = new Float32Array(16);
    this._inv = new Float32Array(16);
    this._pad = /** @type {[number, number]} */ ([0, 0]);
    /** how many nodes the last draw ringed, and how many of their pictures were 3D trees - for the stats and the tests */
    this.drawn = 0;
    this.trees = 0;
  }

  /** The tree door's buffers (its vertices and indices) with this pass's one instance row. */
  _vaoFor(gpu) {
    let vao = this._vaos.get(gpu);
    if (vao) return vao;
    const gl = this.gl;
    vao = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.vb);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.ib);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    const stride = LPT_INSTANCE_FLOATS * 4;
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._vaos.set(gpu, vao);
    this._made.push(vao);
    return vao;
  }

  /** A box a slot of `boxes` (grown as needed), written. */
  static _box(boxes, i, x0, y0, z0, x1, y1, z1) {
    const b = boxes[i] ??= [0, 0, 0, 0, 0, 0];
    b[0] = x0; b[1] = y0; b[2] = z0; b[3] = x1; b[4] = y1; b[5] = z1;
  }

  /**
   * RING the frame's nodes - `list` nodeGlows' records whose marks carry their `pictures` - under the renderer's frame:
   * its camera, its billboard basis, its wind, the 3D trees it drew and its fog (`r` the renderer; `seconds` the glow's
   * clock; `still` reduced motion). Hands back the frame's target and viewport, and the world's baseline: blend off, depth
   * LESS and written, faces culled. Answers how many nodes it ringed.
   * @param {ReadonlyArray<any>} list @param {any} r @param {number} seconds @param {boolean} [still]
   */
  draw(list, r, seconds, still = false) {
    this.drawn = 0; this.trees = 0;
    const gl = this.gl;
    if (!list.length || !r._proj || !r._view || !isVec3(r._camPos)) return 0;
    const vpm = mul4(r._proj, r._view, this._vp);
    const view = gl.getParameter(gl.VIEWPORT), target = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const vw = Math.max(1, view[2]), vh = Math.max(1, view[3]);
    const ringPx = outlinePx(vh);
    this._pad[0] = (2 * (ringPx + 2)) / vw; this._pad[1] = (2 * (ringPx + 2)) / vh;
    const frames = r.lptDrawnFrames?.() ?? [];
    // THE NODES' RECTANGLES: each picture's box - a flat's quad about each centre (its batch's size, the tallest it stands),
    // a 3D tree's crown about its root - through the frame's camera
    let n = 0;
    for (const g of list) {
      if (n >= OUTLINE_MAX) break;
      const pics = g.mark?.pictures;
      if (!pics?.length || !(g.alpha > 0.001)) continue;
      const s = this._nodes[n];
      let k = 0;
      for (const pic of /** @type {NodePicture[]} */ (pics)) {
        const b = pic.batch;
        if (b?.size && pic.centers?.length) {
          const o = b.origin || ZERO_ORIGIN, hw = b.size.w * 0.5, h = b.size.h;
          for (const c of pic.centers) NodeOutlineRenderer._box(s.boxes, k++, c[0] + o[0] - hw, c[1] + o[1], c[2] + o[2] - hw, c[0] + o[0] + hw, c[1] + o[1] + h, c[2] + o[2] + hw);
        }
        const t = pic.center ? treeInstanceOf(pic, frames, this._rows, this._row) : null;
        if (t) {
          const row = this._row, reach = t.run.size[0] * OUTLINE_TREE_REACH * row[4], h = t.run.size[1] * row[4] * t.run.scale[1];
          NodeOutlineRenderer._box(s.boxes, k++, row[0] - reach, row[1], row[2] - reach, row[0] + reach, row[1] + h, row[2] + reach);
        }
      }
      if (!k || !screenRect(s.boxes, k, vpm, this._pad, s.rect)) continue;
      snapRect(s.rect, vw, vh);   // whole pixels: a tile that holds the node whole holds it a texel a pixel
      const wPx = s.rect[2] * vw, hPx = s.rect[3] * vh, fit = Math.min(1, OUTLINE_TILE / Math.max(wPx, hPx));
      s.tile[0] = (n % OUTLINE_GRID) * OUTLINE_TILE; s.tile[1] = Math.floor(n / OUTLINE_GRID) * OUTLINE_TILE;
      s.tile[2] = Math.max(1, Math.min(OUTLINE_TILE, Math.ceil(wPx * fit))); s.tile[3] = Math.max(1, Math.min(OUTLINE_TILE, Math.ceil(hPx * fit)));
      s.ring = Math.max(1, ringPx * fit);
      s.g = g;
      n++;
    }
    if (!n) return 0;
    // 1. THE MASKS, a tile each
    const U = this.um;
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);   // a world frame keeps none; a UI scissor would cut the atlas
    if (scissor) gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, OUTLINE_TILE * OUTLINE_GRID, OUTLINE_TILE * OUTLINE_GRID);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.mask);
    gl.uniformMatrix4fv(U.uProj, false, r._proj);
    gl.uniformMatrix4fv(U.uView, false, r._view);
    gl.uniform3fv(U.uRight, r._bbRight);
    gl.uniform3fv(U.uUp, r._bbUp);
    gl.uniform4fv(U.uFlatWind, r._flatWind ?? ZERO4);
    if (U.uWindfallAxis) { gl.uniform4fv(U.uWindfallSway, r._windfallSway ?? ZERO4); gl.uniform4fv(U.uWindfallAxis, r._windfallAxis ?? ZERO4); }
    gl.uniform4f(U.uFacePoint, 0, 0, 0, 0);
    gl.uniform4f(U.uElitePad, 0, 0, 0, 0);
    gl.uniform1i(U.uTex, 0);
    gl.uniform3f(U.uMeshColor, 1, 1, 1);
    gl.uniform4f(U.uLptSun, 0, 1, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    const wfLaw = windfallLawOn(r._windfall);
    let lptOn;
    const sendCut = (f) => {
      if (f === lptOn) return;
      lptOn = f;
      gl.uniform4f(U.uLptCut, f ? f.eye[0] : 0, f ? f.eye[1] : 0, f ? f.eye[2] : 0, f ? f.radius : 0);
      gl.uniform1f(U.uLptBand, f ? f.band : 0);
    };
    for (let i = 0; i < n; i++) {
      const s = this._nodes[i];
      gl.viewport(s.tile[0], s.tile[1], s.tile[2], s.tile[3]);
      gl.uniform4f(U.uMaskRect, s.rect[0], s.rect[1], 1 / s.rect[2], 1 / s.rect[3]);
      for (const pic of /** @type {NodePicture[]} */ (s.g.mark.pictures)) {
        const b = pic.batch;
        // THE FLAT: its own six indices a flat (its far picture's handover by the frame that drew its 3D tree - a far
        // picture inside the radius draws none)
        const tex = b?.vao && !b._dead && pic.count > 0 ? r.textures?.get(billboardKey(b)) ?? null : null;
        if (tex) {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1f(U.uMesh, 0);
          gl.uniform2f(U.uSize, b.size.w, b.size.h);
          const o = b.origin || ZERO_ORIGIN;
          gl.uniform3f(U.uOrigin, o[0], o[1], o[2]);
          gl.uniform1f(U.uSway, swayShare(b, wfLaw));
          const tp = b.tip;
          gl.uniform3f(U.uTip, tp ? tp[0] : 0, tp ? tp[1] : 0, tp ? tp[2] : 0);
          sendCut(b.lptProto ? frames.find((f) => f?.cut?.has(b.lptProto)) ?? null : null);
          gl.bindVertexArray(b.vao);
          gl.drawElements(gl.TRIANGLES, 6 * pic.count, gl.UNSIGNED_INT, (b._ibOff | 0) + pic.first * OUTLINE_QUAD_INDEX_BYTES);
        }
        // THE 3D TREE the flat gives way to near the eye: its door's buffers, this pass's one instance row
        const t = pic.center ? treeInstanceOf(pic, frames, this._rows, this._row) : null;
        if (!t) continue;
        const { frame: f, run } = t;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._row);
        gl.bindVertexArray(this._vaoFor(f.gpu));
        gl.uniform1f(U.uMesh, 1);
        gl.uniform3f(U.uTip, 0, 0, 0);
        gl.uniform3f(U.uOrigin, 0, 0, 0);
        gl.uniform3f(U.uMeshScale, run.scale[0], run.scale[1], run.scale[2]);
        gl.uniform2f(U.uSize, run.size[0], run.size[1]);
        gl.uniform1f(U.uSway, swayShare(run, wfLaw));
        sendCut(f);
        for (const sub of run.subs) {
          if (!sub.tex) continue;
          gl.bindTexture(gl.TEXTURE_2D, sub.tex);
          gl.uniform1f(U.uMeshAlpha, sub.alpha);
          gl.drawElementsInstanced(gl.TRIANGLES, sub.count, gl.UNSIGNED_INT, sub.offset, 1);
        }
        this.trees++;
      }
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.uniform1f(U.uMesh, 0);
    // 2. THE RINGS, on the frame's own target, against its depth
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(view[0], view[1], view[2], view[3]);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
    const R = this.ur;
    gl.useProgram(this.ring);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(R.uMask, 0);
    gl.uniform4f(R.uViewport, view[0], view[1], vw, vh);
    gl.uniformMatrix4fv(R.uInvVP, false, invert4(vpm, this._inv) ?? this._inv);
    gl.uniformMatrix4fv(R.uVP, false, vpm);
    gl.uniform1i(R.uFogMode, r._fogMode ?? 0);
    gl.uniform1f(R.uFogDensity, r._fogDensity ?? 0);
    gl.uniform2fv(R.uFogRange, r._fogRange ?? NO_FOG_RANGE);
    gl.uniform3fv(R.uCamPos, r._camPos);
    if (R.uFocus) gl.uniform4fv(R.uFocus, r._focus ?? NO_FOCUS);
    if (R.uJungleHaze) gl.uniform4fv(R.uJungleHaze, r._haze);   // BANTHA1: the jungle's haze, the frame's (renderer.setJungleHaze), as every fogged pass
    gl.bindVertexArray(this.quad);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    const breath = outlineBreath(seconds, still);
    for (let i = 0; i < n; i++) {
      const s = this._nodes[i], g = s.g;
      gl.uniform4f(R.uRect, s.rect[0], s.rect[1], s.rect[2], s.rect[3]);
      gl.uniform4f(R.uTile, s.tile[0], s.tile[1], s.tile[2], s.tile[3]);
      gl.uniform1f(R.uRing, s.ring);
      gl.uniform4f(R.uOutlineColor, g.rgb[0], g.rgb[1], g.rgb[2], OUTLINE_ALPHA * Math.min(1, g.alpha) * breath);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      s.g = null;
    }
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    this.drawn = n;
    return n;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the programs, the atlas and its framebuffer, the buffers and every VAO it made. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.mask); gl.deleteProgram(this.ring);
    gl.deleteFramebuffer(this.fb); gl.deleteTexture(this.atlas);
    gl.deleteVertexArray(this.quad); gl.deleteBuffer(this.quadVb); gl.deleteBuffer(this.inst);
    for (const v of this._made) gl.deleteVertexArray(v);
    this._made.length = 0;
    this.mask = null; this.ring = null; this.fb = null; this.atlas = null; this.quad = null; this.quadVb = null; this.inst = null;
  }
}

/** AUDIT NODE-MARKS: the system's reduced motion, asked once a second at most (nodeGlow.js's own reading). */
function reducedMotionReader() {
  let at = -Infinity, reduced = false;
  return (nowS) => {
    if (nowS - at > 1) { at = nowS; try { reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { reduced = false; } }
    return reduced;
  };
}
/** PERF-WARM's idle wait (render/warmPrograms.js). */
const idleCall = (fn) => (globalThis.requestIdleCallback ? globalThis.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0));

/**
 * THE WORLD HOST'S PASS: the gathering host's marks each frame - a mark with its pictures ringed by the outline, a mark
 * with none lit by the glow (`glow`, nodeGlow.js's pass - a body drawn as a 3D character; the pass builds its own, so the
 * host wires one pass and bootWorld holds no glow of its own - HOST-SPLIT), each kindling as it first
 * stands near (nodeGlows). The programs are built at IDLE once a node is first ringed (PERF-WARM's law) - nothing is
 * ringed until they stand; an outline that will not build costs the outline, never the game (its marks go to the glow).
 * A pass that ran is a foreign pass. `draw(marks)` answers how many it ringed; `marks` null forgets every node.
 * @param {any} renderer
 * @param {{ glow?: { draw: (marks: any) => number } | null, now?: () => number, build?: (gl: any) => NodeOutlineRenderer,
 *   idle?: (fn: () => void) => void, reduced?: (nowS: number) => boolean }} [o]
 */
export function createNodeOutlinePass(renderer, { glow = createNodeGlowPass(renderer), now = () => performance.now() / 1000, build = (gl) => new NodeOutlineRenderer(gl), idle = idleCall, reduced = reducedMotionReader() } = {}) {
  const state = createNodeGlowState(), list = /** @type {any[]} */ ([]), bare = /** @type {any[]} */ ([]), ringed = /** @type {any[]} */ ([]);
  let pass = /** @type {NodeOutlineRenderer|null} */ (null), asked = false, dead = false, failed = false;
  const make = () => {
    if (dead) return;
    try { pass = build(renderer.gl); } catch (e) { failed = true; console.warn('[prof] the nodes\' outline would not build', e?.message ?? e); pass = null; }
  };
  return {
    /** @param {ReadonlyArray<any>|null|undefined} marks */
    draw(marks) {
      bare.length = 0; ringed.length = 0;
      if (marks) for (const m of marks) (failed || !m?.pictures?.length ? bare : ringed).push(m);
      glow?.draw(marks ? bare : null);   // a node with no picture to ring keeps its glow
      const t = now();
      if (!asked && ringed.length) { asked = true; idle(make); }   // the first node ringed: the compile, at idle
      if (!nodeGlows(marks ? ringed : null, renderer._camPos, t, state, list).length || !pass) return 0;
      const n = pass.draw(list, renderer, t % 60, reduced(t));
      renderer.markForeignPass();
      return n;
    },
    /** The pass's end - its programs and its atlas freed, and never built again. */
    dispose() { dead = true; asked = true; pass?.dispose(); pass = null; },
    /** For the tests and the probes. */
    get pass() { return pass; },
  };
}
