// @ts-check
// WL1 (2026-10-29, the owner: "Windows should have shadowed lightening that shows on the ground at night and also light
// on the inside should show on the ground, all depending on time of day"): WINDOW LIGHT. A lit room's lamp shines out
// through its window's glass onto the street by night; the sun or the moon shines in through a building's glass onto its
// floor. A fragment follows its ray back to the window's plane and reads the glass's mask there, so the lead and the
// frame fall as shadow. The lights are a tile of window texture each (windowAperturesOf), counted in a band of LC1's grid
// and read in both lanes' shaders (windowLightGlsl); a dark mock room throws nothing (world/windowRoomArt.js).
// Not a DFU member: DFU's windows light nothing. 07-Rendering/Real-Windows.md, WL1.

import { buildLightClusters, createClusterSpace, CLUSTER_X, CLUSTER_Y, CLUSTER_Z, CLUSTER_LIST_W, CLUSTER_LIST_ROWS, CLUSTER_LIST_CAP } from './lightClusters.js';
import { roomSeedBits, roomLitAt, curtainBitsOf, roomCurtained, curtainEdges } from '../world/windowRoomArt.js';
import { pageParam } from '../systems/pageQuery.js';
import { WL_REC, APERTURE_CELL_REC, windowAperturesOf } from './windowApertures.js';

export { WL_REC, windowAperturesOf };

/** The lights a frame carries, each WL_VEC4 vec4s in one uniform block (WL_VEC4 x 16 bytes x 128 = 14 KB, under the
 *  16 KB every WebGL2 block may hold), and the block's binding point. */
export const WL_MAX_LIGHTS = 128;
export const WL_VEC4 = 7;
export const WL_UBO_BINDING = 3;
/** The glass masks' array: one layer a window picture, on a unit of its own - above the snow's 16-20, the skin's 21, the
 *  panes' 22 and the snow lines' 23 (the snow terrain program is built from the terrain's, and holds both). */
export const WL_MASK_UNIT = 24;
export const WL_MASK_SIZE = 128;
export const WL_MASK_LAYERS = 64;
/** The window lights' band in LC1's two textures: its grid below the lanterns' rows, its lists past theirs. */
export const WL_GRID_ROW = CLUSTER_Z;
export const WL_LIST_BASE = CLUSTER_LIST_W * CLUSTER_LIST_ROWS;
/** A light's kind (the shader's): a lamp behind the glass, a sun or moon read through the shadow map, or one without. */
export const WL_KIND = Object.freeze({ lamp: 0, sun: 1, sunBare: 2 });

/** THE LAMP behind a lit window: how far behind the glass it hangs and how far over the glass's middle (the pane's half
 *  height and this), its reach, the breadth of the room's light (the pool's penumbra), and its gains on the room's lamp
 *  - through the glass's shape, and the glass's own glow onto what faces it. */
export const WL_LAMP_DEPTH = 1.8;
export const WL_LAMP_LIFT = 0.45;
export const WL_LAMP_RANGE = 8;
export const WL_LAMP_RADIUS = 0.1;
export const WL_LAMP_GOBO = 1.1;
export const WL_LAMP_SPILL = 0.26;
/** Curtains pass this share of the light they cover (the glow, never the shape). */
export const WL_CURTAIN_PASS = 0.3;
/** THE SUN through a building's glass: its reach into the room, the sun's breadth (its angular diameter, radians) and the
 *  gains on the sun and the moon as the street is lit, and on the sky's light as a glow from the glass. */
export const WL_SUN_REACH = 24;
export const WL_SUN_ANGLE = 0.0093;
/** The glass's own glow reaches this far (A / (pi d^2 + A) is about 1% of it at 5 m), so a pane the sun does not face
 *  is a small light; and with no sun map a receiver this far under the glass's bottom is under a floor. */
export const WL_SPILL_REACH = 6;
export const WL_STOREY = 2.5;
export const WL_SUN_GAIN = 0.9;
export const WL_MOON_GAIN = 1;
export const WL_SKY_GAIN = 0.5;
/** How far from the eye a lit window is gathered, the share of that where its light begins to fade, and how fast the
 *  cut follows the frame's own (a pool at the cut fades, never pops). */
export const WL_GATHER = 72;
export const WL_FADE_FROM = 0.8;
export const WL_CUT_EASE = 3;
/** A window drawn no longer than this ago still lights (a building turned from, a street behind the eye). A mesh drawn
 *  again within WL_MOVE_REACH of a placement not yet drawn this frame has moved there (a ship, a wagon); a mesh keeps
 *  at most WL_PLACEMENTS_MAX placements. */
export const WL_HOLD_MS = 20000;
export const WL_MOVE_REACH = 2;
export const WL_PLACEMENTS_MAX = 4096;
/** A frame builds at most this many tiles' world data, the nearest cells first (a city's pixel walked into lights over a
 *  few frames, never in one long one). */
export const WL_BUILD_TILES = 384;
/** The outside's light, captured for a building's frame, is asked again this often. */
export const WL_OUTSIDE_EVERY_MS = 250;
/** The kill door: `?windowlight=off` lights no window (the Real windows row's Off lights none either). */
export function windowLightOn(search = globalThis.location?.search ?? '') {
  return pageParam('windowlight', search) !== 'off';
}

// ---------------------------------------------------------------------------------------------------------------
// THE MASKS - a window picture's glass, as a layer of the array the shader reads
// ---------------------------------------------------------------------------------------------------------------

/** The box the glass of a mask spans (rgba, white where glass, rows as uploaded - the texture's own v), in the tile's
 *  uv: [u0, v0, u1, v1], or null for no glass. */
export function maskBoxOf(mask) {
  const { width: W, height: H, colors: c } = mask;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (c[(y * W + x) * 4] < 128) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H];
}

/** A mask resampled to one WL_MASK_SIZE layer (nearest: the lead keeps its edges; the mips soften it), one byte a texel,
 *  rows as given. `alpha`: the glass is where alpha is under a half (a cutout picture's holes). */
export function maskLayerOf(mask, alpha = false) {
  const { width: W, height: H, colors: c } = mask, S = WL_MASK_SIZE;
  const out = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    const sy = Math.min(H - 1, Math.floor((y + 0.5) * H / S));
    for (let x = 0; x < S; x++) {
      const i = (sy * W + Math.min(W - 1, Math.floor((x + 0.5) * W / S))) * 4;
      out[y * S + x] = (alpha ? c[i + 3] < 128 : c[i] > 127) ? 255 : 0;
    }
  }
  return out;
}

/** A cutout picture's holes as a mask (white where alpha is under a half). */
export function holesOf(color32) {
  const src = color32.colors, out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) if (src[i + 3] < 128) out.fill(255, i, i + 4);
  return { colors: out, width: color32.width, height: color32.height };
}

// ---------------------------------------------------------------------------------------------------------------
// THE LIGHTS - one record of WL_VEC4 vec4s each, written for the frame
// ---------------------------------------------------------------------------------------------------------------

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * ONE WINDOW'S LIGHT into `out` at `at` (WL_VEC4 vec4s): the aperture (its centre `c`, its world span `U` and `V`), the
 * side its light goes to (`nf`), the mask's uv over the aperture (`uv`: centre u, centre v, span u, span v) and its layer,
 * the source (`src`: the lamp's place, or the direction toward the sun), its kind, the colour through the glass's shape
 * (`gobo`), the glass's glow (`spill`, over `area`) and the reach. The shader's layout:
 *   0 c, reach   1 u* (the dual of U: a = dot(w - c, u*)), uv centre u   2 v*, uv centre v   3 nf, uv span u
 *   4 src, uv span v   5 gobo, layer + 256 kind   6 spill, area
 */
export function writeWindowLight(out, at, l) {
  const U = l.U, V = l.V;
  const nx = U[1] * V[2] - U[2] * V[1], ny = U[2] * V[0] - U[0] * V[2], nz = U[0] * V[1] - U[1] * V[0];
  const vx = V[1] * nz - V[2] * ny, vy = V[2] * nx - V[0] * nz, vz = V[0] * ny - V[1] * nx;   // V x n
  const ux = ny * U[2] - nz * U[1], uy = nz * U[0] - nx * U[2], uz = nx * U[1] - ny * U[0];   // n x U
  const ku = U[0] * vx + U[1] * vy + U[2] * vz, kv = V[0] * ux + V[1] * uy + V[2] * uz;
  const o = at * WL_VEC4 * 4;
  out[o] = l.c[0]; out[o + 1] = l.c[1]; out[o + 2] = l.c[2]; out[o + 3] = l.reach;
  out[o + 4] = vx / ku; out[o + 5] = vy / ku; out[o + 6] = vz / ku; out[o + 7] = l.uv[0];
  out[o + 8] = ux / kv; out[o + 9] = uy / kv; out[o + 10] = uz / kv; out[o + 11] = l.uv[1];
  out[o + 12] = l.nf[0]; out[o + 13] = l.nf[1]; out[o + 14] = l.nf[2]; out[o + 15] = l.uv[2];
  out[o + 16] = l.src[0]; out[o + 17] = l.src[1]; out[o + 18] = l.src[2]; out[o + 19] = l.uv[3];
  out[o + 20] = l.gobo[0]; out[o + 21] = l.gobo[1]; out[o + 22] = l.gobo[2]; out[o + 23] = l.layer + 256 * l.kind;
  out[o + 24] = l.spill[0]; out[o + 25] = l.spill[1]; out[o + 26] = l.spill[2]; out[o + 27] = l.area;
}

/** THE LAMP of a lit room behind an aperture whose centre is `c`, its normal `nf` (to the street) and its world span `V`
 *  upward: over the glass's middle by half the pane and WL_LAMP_LIFT, WL_LAMP_DEPTH behind it. */
export function lampOf(c, nf, V, out = [0, 0, 0]) {
  const lift = 0.5 * Math.abs(V[1]) + WL_LAMP_LIFT;
  out[0] = c[0] - nf[0] * WL_LAMP_DEPTH; out[1] = c[1] + lift - nf[1] * WL_LAMP_DEPTH; out[2] = c[2] - nf[2] * WL_LAMP_DEPTH;
  return out;
}

/** The shader's own walk of one light for one point (the GLSL's twin, for the pins): what reaches `wp` (normal `n`)
 *  through the glass, by the mask `maskAt(u, v)` (0..1) and the lamp's falloff `atten(d, r)`. */
export function windowLightAt(rec, wp, n, maskAt, atten) {
  const g = (k) => [rec[k * 4], rec[k * 4 + 1], rec[k * 4 + 2], rec[k * 4 + 3]];
  const c0 = g(0), c1 = g(1), c2 = g(2), c3 = g(3), c4 = g(4), c5 = g(5), c6 = g(6);
  const rel = sub3(wp, c0), d2 = dot(rel, rel);
  if (d2 >= c0[3] * c0[3]) return [0, 0, 0];
  const s = dot(rel, c3);
  if (s <= 0) return [0, 0, 0];
  const d = Math.sqrt(d2), x2 = d2 / WL_SPILL_REACH ** 2, win = d2 < WL_SPILL_REACH ** 2 ? (1 - x2 * x2) ** 2 : 0;
  const cr = Math.max(-dot(n, rel), 0) / Math.max(d, 1e-4);
  const sp = c6[3] * (s / Math.max(d, 1e-4)) * cr / (Math.PI * d2 + c6[3]) * win;
  const acc = [c6[0] * sp, c6[1] * sp, c6[2] * sp];
  const kind = Math.floor((c5[3] + 0.5) / 256);
  let ray, tt;
  if (kind === WL_KIND.lamp) { ray = sub3(c4, wp); const sl = dot(sub3(c4, c0), c3); tt = s / (s - sl); }
  else { ray = [c4[0], c4[1], c4[2]]; const dn = dot(ray, c3); if (dn > -1e-3) return acc; tt = -s / dn; }
  const w = [wp[0] + ray[0] * tt - c0[0], wp[1] + ray[1] * tt - c0[1], wp[2] + ray[2] * tt - c0[2]];
  const a = dot(w, c1), b = dot(w, c2);
  const pw = kind === WL_KIND.lamp ? 2 * WL_LAMP_RADIUS * tt : WL_SUN_ANGLE * tt;
  const pa = pw * Math.hypot(c1[0], c1[1], c1[2]), pb = pw * Math.hypot(c2[0], c2[1], c2[2]);
  if (Math.abs(a) > 0.5 + pa || Math.abs(b) > 0.5 + pb) return acc;
  if (kind === WL_KIND.sunBare && wp[1] < c0[1] - 0.5 / Math.max(Math.hypot(c2[0], c2[1], c2[2]), 1e-4) - WL_STOREY) return acc;
  const rl = Math.hypot(ray[0], ray[1], ray[2]);
  const ndl = Math.max(dot(n, ray), 0) / Math.max(rl, 1e-4);
  const m = maskAt(c1[3] + a * c3[3], c2[3] + b * c4[3]);
  const k = m * ndl * (kind === WL_KIND.lamp ? atten(rl, c0[3]) : 1);
  return [acc[0] + c5[0] * k, acc[1] + c5[1] * k, acc[2] + c5[2] * k];
}

// ---------------------------------------------------------------------------------------------------------------
// THE SHADER TEXT - one block, interpolated into both lanes' lit programs
// ---------------------------------------------------------------------------------------------------------------

const f = (x) => { const s = Number(x).toFixed(6).replace(/0+$/, ''); return s.endsWith('.') ? `${s}0` : s; };

/** THE BLOCK. `atten` the lane's lamp falloff (a GLSL expression of rl, the lamp's distance, and r), `shadow` whether the lane's sun map is
 *  there to read (SHADOW_GLSL interpolated before this; 'flat' the billboard program's, which takes flatSun alone),
 *  `clusters` whether the program declares LC1's grid itself (the classic set: the lane's EL_CLUSTER_GLSL already does).
 *  winLit(wp, n, isFlat, flatSun): what the frame's window lights add at a point (a flat passes no normal and its sun
 *  map's word, read once a quad - LA-COST3's vBBSunVis).
 * @param {{ atten?: string, shadow?: boolean | 'flat', clusters?: boolean }} [opts] */
export function windowLightGlsl({ atten = 'wlClassicAtten(rl, r)', shadow = false, clusters = false } = {}) {
  return `
// WL1: WINDOW LIGHT (render/windowLight.js)
layout(std140) uniform WinLights { vec4 uWinL[${WL_MAX_LIGHTS * WL_VEC4}]; };
uniform highp sampler2DArray uWinMask;   // the glass's masks, a layer a window picture
uniform int uWinOn;                      // 1: the frame carries window lights, in LC1's grid's band; 2: and a sun through glass the sun map holds
${clusters ? `uniform highp usampler2D uClusterGrid;
uniform highp usampler2D uClusterList;
uniform vec4 uClusterRect;
uniform vec2 uClusterZ;
uniform vec4 uCamFwd;` : ''}
float wlClassicAtten(float d, float r) { float a = clamp(1.0 - d / r, 0.0, 1.0); return a * a; }
vec3 winLit(vec3 wp, vec3 n, float isFlat, float flatSun) {
  if (uWinOn == 0) return vec3(0.0);
  ivec2 tc = clamp(ivec2((gl_FragCoord.xy - uClusterRect.xy) * uClusterRect.zw), ivec2(0), ivec2(${CLUSTER_X - 1}, ${CLUSTER_Y - 1}));
  int zc = clamp(int(log(max((dot(uCamFwd.xyz, wp) + uCamFwd.w) * uClusterZ.x, 1.0)) * uClusterZ.y), 0, ${CLUSTER_Z - 1});
  highp uvec2 cell = texelFetch(uClusterGrid, ivec2(tc.x + tc.y * ${CLUSTER_X}, zc + ${WL_GRID_ROW}), 0).rg;
  int cnt = int(cell.y);
  vec3 acc = vec3(0.0);
  for (int j = 0; j < ${WL_MAX_LIGHTS}; j++) {
    if (j >= cnt) break;
    highp int at = ${WL_LIST_BASE} + int(cell.x) + j;
    int i = int(texelFetch(uClusterList, ivec2(at & ${CLUSTER_LIST_W - 1}, at >> ${Math.log2(CLUSTER_LIST_W)}), 0).r) * ${WL_VEC4};
    vec4 c0 = uWinL[i];
    vec3 rel = wp - c0.xyz;
    float d2 = dot(rel, rel);
    if (d2 >= c0.w * c0.w) continue;
    vec4 c3 = uWinL[i + 3];
    float s = dot(rel, c3.xyz);
    if (s <= 0.0) continue;   // behind the glass: the wall it stands in keeps its light
    float d = sqrt(d2);
    if (d2 < ${f(WL_SPILL_REACH * WL_SPILL_REACH)}) {   // the glass's glow, a small lit area
      vec4 c6 = uWinL[i + 6];
      float x2 = d2 / ${f(WL_SPILL_REACH * WL_SPILL_REACH)}, win = (1.0 - x2 * x2) * (1.0 - x2 * x2);
      float cr = isFlat > 0.5 ? 1.0 : max(-dot(n, rel), 0.0) / max(d, 1e-4);
      acc += c6.rgb * (c6.w * (s / max(d, 1e-4)) * cr / (3.14159265 * d2 + c6.w) * win);
    }
    vec4 c4 = uWinL[i + 4], c5 = uWinL[i + 5];
    int code = int(c5.w + 0.5), kind = code >> 8;
    vec3 ray; float tt;
    if (kind == 0) { ray = c4.xyz - wp; tt = s / (s - dot(c4.xyz - c0.xyz, c3.xyz)); }   // toward the lamp, to the glass's plane
    else { ray = c4.xyz; float dn = dot(ray, c3.xyz); if (dn > -1e-3) continue; tt = -s / dn; }   // toward the sun
    vec3 w = wp + ray * tt - c0.xyz;
    vec4 c1 = uWinL[i + 1], c2 = uWinL[i + 2];
    float a = dot(w, c1.xyz), b = dot(w, c2.xyz);
    float pw = kind == 0 ? ${f(2 * WL_LAMP_RADIUS)} * tt : ${f(WL_SUN_ANGLE)} * tt;   // the source's footprint on the glass's plane, metres
    float pa = pw * length(c1.xyz), pb = pw * length(c2.xyz);   // ... in the aperture's own units
    if (abs(a) > 0.5 + pa || abs(b) > 0.5 + pb) continue;   // the ray crosses the wall, not the window or its soft edge
    if (kind == 2 && wp.y < c0.y - 0.5 / max(length(c2.xyz), 1e-4) - ${f(WL_STOREY)}) continue;   // no sun map: a storey down is under a floor
    float rl = length(ray);
    float ndl = isFlat > 0.5 ? 1.0 : max(dot(n, ray), 0.0) / max(rl, 1e-4);
    if (ndl <= 0.0) continue;
    float lod = log2(max(max(pa * c3.w, pb * c4.w) * ${WL_MASK_SIZE}.0, 1.0));
    float m = textureLod(uWinMask, vec3(c1.w + a * c3.w, c2.w + b * c4.w, float(code & 255)), lod).r;
    if (m <= 0.0) continue;
    float r = c0.w;
    float g = kind == 0 ? ${atten} : ${shadow === 'flat' ? '(kind == 1 ? flatSun : 1.0)' : shadow ? '(kind == 1 ? (isFlat > 0.5 ? flatSun : sunShadowAt(wp, n)) : 1.0)' : '1.0'};
    acc += c5.rgb * (m * ndl * g);
  }
  return acc;
}
`;
}

// ---------------------------------------------------------------------------------------------------------------
// THE PASS - the renderer's: the masks, the windows drawn lately, and each frame's lights
// ---------------------------------------------------------------------------------------------------------------

/** An instance matrix on a point (`w` 1) or a direction (`w` 0), into `o` at `i`: the frame writes, never allocates. */
function xfTo(o, i, m, x, y, z, w) {
  o[i] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  o[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  o[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
}
const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; };
const lightRec = () => ({ c: [0, 0, 0], U: [0, 0, 0], V: [0, 0, 0], nf: [0, 0, 0], uv: [0, 0, 0, 0], src: [0, 0, 0], gobo: [0, 0, 0], spill: [0, 0, 0], kind: 0, layer: 0, reach: 0, area: 0, halfDiag: 0, ball: [0, 0, 0, 0] });

const byDistance = (a, b) => a.d - b.d;

export class WindowLightPass {
  /** @param {WebGL2RenderingContext} gl @param {{ activeTexture: (u: number) => void }} deps */
  constructor(gl, deps) {
    this.gl = gl;
    this.deps = deps;
    this.masks = new Map();       // key -> { box, bytes, layer (-1: none now), used }
    this._layers = 0;             // layers ever given out; a freed one waits in _free
    this._free = [];
    this._holder = [];            // layer -> the mask on it
    this._mipsDirty = false;
    this.sources = { street: new Map(), inside: new Map() };   // mesh -> [{ m, remap, seen, subs }]
    this.data = new Float32Array(WL_MAX_LIGHTS * WL_VEC4 * 4);
    this.spheres = new Float32Array(WL_MAX_LIGHTS * 4);
    this.space = createClusterSpace(WL_MAX_LIGHTS);
    this.count = 0;
    this.outside = null;          // { at, sunDir, sunColor, sunScale, moonDir, moonColor, moonScale, sky } - display colours
    this._cuts = { street: WL_GATHER, inside: WL_GATHER };   // each kind's own cut and clock: a building's frame
    this._at = { street: 0, inside: 0 };                      // draws the view out's street between two of its own
    this._cand = [];
    this._pool = [];              // the candidates' records, the frame's to reuse
    this._used = 0;
    this._pending = [];           // cells near enough not yet built: { d, s, sub, p, ci }, reused
    this._pendN = 0;
    this._ld = new Float32Array(WL_MAX_LIGHTS);   // each written light's distance, for the cut on an overflow
    this._lt = lightRec();        // the light being written, and a curtained window's whole glass
    this._whole = lightRec();
    this._v = [0, 0, 0];
    this.stats = { lights: 0, candidates: 0, cells: 0, walked: 0, built: 0, dropped: 0 };   // walked: the tiles a gather measured; built: their world data made; dropped: past the list
    this.tex = null;
    this.ubo = null;
  }

  /** The block, on its binding point from the renderer's first frame: every lit program holds it, and a draw whose
   *  program reads a block with no buffer behind it is an INVALID_OPERATION (EVERY ALLOCATION HAS AN OWNER: release). */
  _ensureBlock() {
    if (this.ubo) return;
    const gl = this.gl;
    this.ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, WL_UBO_BINDING, this.ubo);
  }

  /** The masks' array, made with the first mask: a renderer that never meets a window holds none. */
  _ensureMasks() {
    if (this.tex) return;
    const gl = this.gl;
    this.tex = gl.createTexture();
    this.deps.activeTexture(gl.TEXTURE0 + WL_MASK_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(WL_MASK_SIZE) + 1, gl.R8, WL_MASK_SIZE, WL_MASK_SIZE, WL_MASK_LAYERS);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.deps.activeTexture(gl.TEXTURE0);
  }

  /** The block on its point, and the array on its unit once there is one, for a draw that reads them. */
  bind() {
    this._ensureBlock();
    if (!this.tex) return;
    const gl = this.gl;
    this.deps.activeTexture(gl.TEXTURE0 + WL_MASK_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    this.deps.activeTexture(gl.TEXTURE0);
  }

  /** A window picture's glass (`mask`: rgba, white where glass; `alpha`: its holes instead) under its key: its box and
   *  its layer's bytes, kept - it goes up onto a layer when a frame's light first reads it (_resident). */
  addMask(key, mask, alpha = false) {
    if (!mask?.colors || this.masks.has(key)) return;
    const m = alpha ? holesOf(mask) : mask;
    const box = maskBoxOf(m);
    if (box) this.masks.set(key, { box, bytes: maskLayerOf(m), layer: -1, used: -Infinity });
  }

  /** A mask let go with its picture (the texture evicted): its layer is free. A new upload of the key adds it again. */
  dropMask(key) {
    const k = this.masks.get(key);
    if (!k) return;
    if (k.layer >= 0) { this._holder[k.layer] = null; this._free.push(k.layer); }
    this.masks.delete(key);
  }

  /** A mask on a layer for this frame's light: its own, a free one, or that of the mask read least lately of those this
   *  frame has not read - from the bytes kept, so no picture is ever lost. False when every layer is this frame's. */
  _resident(k, now) {
    if (k.layer >= 0) { k.used = now; return true; }
    let layer = this._free.length ? /** @type {number} */ (this._free.pop()) : this._layers < WL_MASK_LAYERS ? this._layers++ : -1;
    if (layer < 0) {
      let old = null;
      for (const h of this._holder) if (h && h.used < now && (!old || h.used < old.used)) old = h;
      if (!old) return false;
      layer = old.layer;
      old.layer = -1;
    }
    this._ensureMasks();
    const gl = this.gl;
    this.deps.activeTexture(gl.TEXTURE0 + WL_MASK_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, WL_MASK_SIZE, WL_MASK_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, k.bytes);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    this.deps.activeTexture(gl.TEXTURE0);
    this._holder[layer] = k;
    k.layer = layer; k.used = now;
    this._mipsDirty = true;
    return true;
  }

  /** A mesh drawn in a frame of `kind` ('street' or 'inside') at `m`, its pictures through `remap`: kept as a source of
   *  window light for WL_HOLD_MS. A placement is one source however often it is drawn. */
  note(mesh, m, remap, kind, now) {
    const map = this.sources[kind];
    let list = map.get(mesh);
    if (!list) map.set(mesh, list = Object.assign([], { hint: 0 }));
    const n = list.length;
    let moved = null, near = WL_MOVE_REACH * WL_MOVE_REACH;
    for (let j = 0; j < n; j++) {   // from where the last draw matched: a frame draws its placements in the same order
      const at = (list.hint + j) % n, s = list[at];
      const dx = s.m[12] - m[12], dy = s.m[13] - m[13], dz = s.m[14] - m[14];
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3 && Math.abs(dz) < 1e-3 && Math.abs(s.m[0] - m[0]) < 1e-5 && Math.abs(s.m[2] - m[2]) < 1e-5) {
        s.seen = now; s.remap = remap; list.hint = (at + 1) % n;
        return;
      }
      const d2 = dx * dx + dy * dy + dz * dz;
      if (s.seen !== now && d2 < near) { near = d2; moved = s; }
    }
    if (moved) { moved.m.set(m); moved.subs = null; moved.seen = now; moved.remap = remap; return; }   // a mover: its windows go with it
    if (n < WL_PLACEMENTS_MAX) list.push({ m: Float32Array.from(m), remap, seen: now, subs: null });
  }

  /** A mesh let go: none of its windows lights. */
  forget(mesh) { this.sources.street.delete(mesh); this.sources.inside.delete(mesh); }

  /** The floating origin moved by `offset`: every kept placement follows it. */
  shift(offset) {
    for (const map of Object.values(this.sources)) for (const list of map.values()) for (const s of list) {
      s.m[12] += offset[0]; s.m[13] += offset[1]; s.m[14] += offset[2];
      if (s.subs) for (const p of s.subs) if (p) {
        for (let i = 0; i < p.ball.length; i += 4) { p.ball[i] += offset[0]; p.ball[i + 1] += offset[1]; p.ball[i + 2] += offset[2]; }
        p.all[0] += offset[0]; p.all[1] += offset[1]; p.all[2] += offset[2];
        for (const t of p.tiles) if (t) for (let i = 0; i < t.cent.length; i += 3) { t.cent[i] += offset[0]; t.cent[i + 1] += offset[1]; t.cent[i + 2] += offset[2]; }
      }
    }
  }

  /** The outside's light as a building's frame sees it through its glass (the clock's, the weather's). */
  setOutside(o) { this.outside = o; }

  /** Is the sun (or the moon) up outside and facing glass this frame could light - a building's, with its mask, within
   *  the gather of `eye` (`glass(key)` the renderer's word on a key's glass) - the direction toward it, or null. The
   *  frame's shadow pass draws its map for this.
   *  @param {number[]} eye @param {number} now @param {(key: string) => any} [glass] */
  sunFor(eye, now, glass = () => 'glass') {
    const o = this.outside;
    if (!o) return null;
    const dir = o.sunScale > 0 && o.sunDir[1] > 0.05 ? o.sunDir : o.moonScale > 0 && o.moonDir[1] > 0.05 ? o.moonDir : null;
    if (!dir) return null;
    const far = (b, i) => Math.hypot(b[i] - eye[0], b[i + 1] - eye[1], b[i + 2] - eye[2]) - b[i + 3] > WL_GATHER;
    const v = this._v;
    for (const [mesh, list] of this.sources.inside) {
      if (mesh._dead || !mesh.wl) continue;
      for (const s of list) {
        if (now - s.seen > WL_HOLD_MS) continue;
        for (let si = 0; si < mesh.wl.length; si++) {
          const sub = mesh.wl[si];
          const key = s.remap && s.remap.has(sub.key) ? s.remap.get(sub.key) : sub.key;
          if (!glass(key) || !this.masks.has(key)) continue;
          const p = this._cellsOf(s, si, sub);
          if (far(p.all, 0)) continue;
          for (let ci = 0; ci < p.tiles.length; ci++) {
            if (far(p.ball, ci * 4)) continue;
            const first = sub.cells[ci * APERTURE_CELL_REC + 4], n = sub.cells[ci * APERTURE_CELL_REC + 5];
            for (let k = first * WL_REC; k < (first + n) * WL_REC; k += WL_REC) {
              xfTo(v, 0, s.m, sub.ap[k + 11], sub.ap[k + 12], sub.ap[k + 13], 0);
              if (v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2] < -0.02 * Math.hypot(v[0], v[1], v[2])) return dir;
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * THE FRAME'S LIGHTS. `kind` 'street' (a lit room's lamp through its glass, by night: `lamp` the rooms' lamp, display
   * colour, or null) or 'inside' (the outside's sun or moon and sky through the building's glass; `shadows` whether the
   * sun map is drawn). `glass(key)` answers what a resolved picture key's glass is ('window' DFU's, 'glass' an interior's
   * or a hole) or null. Fills the block, the spheres and the grid space; answers the count.
   */
  frame({ kind, eye, view, proj, now, lamp = null, shadows = false, glass, decode = null }) {
    const cand = this._cand;
    cand.length = 0;
    this._used = 0;
    this._pendN = 0;
    this.stats.walked = 0; this.stats.built = 0;
    let gathered = 0;
    const o = this.outside;
    const sunDir = o && o.sunScale > 0 && o.sunDir[1] > 0.05 ? o.sunDir : null;
    const moonDir = !sunDir && o && o.moonScale > 0 && o.moonDir[1] > 0.05 ? o.moonDir : null;
    // the colours as the set lights in: decoded first, then scaled (the lane decodes a colour and multiplies its scale)
    const dec = (c) => (decode ? decode(c) : [c[0], c[1], c[2]]);
    const lampC = lamp ? dec(lamp) : null;
    const keyC = o ? (sunDir ? dec(o.sunColor).map((v) => v * o.sunScale) : moonDir ? dec(o.moonColor).map((v) => v * o.moonScale) : null) : null;
    const skyC = o ? dec(o.sky) : null;
    if (kind === 'street' ? !!lamp : !!o) {
      for (const [mesh, list] of this.sources[kind]) {
        if (mesh._dead || !mesh.wl) { this.sources[kind].delete(mesh); continue; }
        for (let li = list.length - 1; li >= 0; li--) {
          const s = list[li];
          if (now - s.seen > WL_HOLD_MS) { list.splice(li, 1); continue; }
          gathered += this._gather(mesh, s, kind, eye, glass, cand);
        }
        if (!list.length) this.sources[kind].delete(mesh);
      }
    }
    gathered += this._buildPending(kind, eye, cand);
    this.stats.candidates = gathered;
    // the nearest WL_MAX_LIGHTS; the cut eases toward the frame's own so a pool at the edge fades
    cand.sort(byDistance);
    const n = Math.min(cand.length, WL_MAX_LIGHTS);
    const want = n < cand.length ? cand[n - 1].d : WL_GATHER;
    const dt = this._at[kind] ? Math.max(0, Math.min(0.25, (now - this._at[kind]) / 1000)) : 0;
    this._at[kind] = now;
    this._cuts[kind] = dt > 0 ? this._cuts[kind] + (want - this._cuts[kind]) * (1 - Math.exp(-WL_CUT_EASE * dt)) : want;
    const cut = Math.min(this._cuts[kind], WL_GATHER);
    let w = 0;
    for (let i = 0; i < n; i++) {
      const c = cand[i];
      if (c.d >= cut) break;
      const fade = c.d <= cut * WL_FADE_FROM ? 1 : (cut - c.d) / (cut * (1 - WL_FADE_FROM));
      if (!this._resident(c.mask, now)) continue;   // every layer read this frame already
      const l = kind === 'street' ? this._lampLight(c, lampC, fade) : this._sunLight(c, sunDir ?? moonDir, !!sunDir, keyC, skyC, shadows, fade);
      if (!l) continue;
      writeWindowLight(this.data, w, l);
      this.spheres.set(l.ball, w * 4);
      this._ld[w] = c.d;
      w++;
    }
    if (this._mipsDirty) {   // the layers put up this frame, their mips once
      const gl = this.gl;
      this.deps.activeTexture(gl.TEXTURE0 + WL_MASK_UNIT);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      this.deps.activeTexture(gl.TEXTURE0);
      this._mipsDirty = false;
    }
    // more cells than the band's list holds: the nearest that fit (the lights stand nearest first), never none - and
    // the cut comes in to the first left out, so the edge fades from the next frame on
    let fit = w;
    while (fit > 0 && !buildLightClusters(this.spheres, fit, view, proj, this.space)) fit = Math.min(fit - 1, Math.floor(fit * CLUSTER_LIST_CAP / this.space.need * 0.9));
    if (fit < w) this._cuts[kind] = Math.min(this._cuts[kind], this._ld[fit]);
    this.stats.dropped = w - fit;
    w = fit;
    this.count = w;
    this.stats.lights = w;
    if (!w) return 0;
    this.stats.cells = this.space.total;
    const gl = this.gl;
    this._ensureBlock();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.data, 0, w * WL_VEC4 * 4);   // the lights written, not the whole block
    return w;
  }

  /** One placement's windows into `cand`: every tile near enough whose picture has glass of the frame's kind on the
   *  share of it the mesh covers - walked by the cells near the eye, a placement past the reach by one check. A cell
   *  not yet built waits for _buildPending. */
  _gather(mesh, s, kind, eye, glass, cand) {
    let n = 0;
    const far = (b, i) => Math.hypot(b[i] - eye[0], b[i + 1] - eye[1], b[i + 2] - eye[2]) - b[i + 3] > WL_GATHER;
    for (let si = 0; si < mesh.wl.length; si++) {
      const sub = mesh.wl[si];
      const key = s.remap && s.remap.has(sub.key) ? s.remap.get(sub.key) : sub.key;
      const g = glass(key);
      if (!g || (kind === 'street' && g !== 'window')) continue;
      const mask = this.masks.get(key);
      if (!mask) continue;
      const p = this._cellsOf(s, si, sub);
      if (far(p.all, 0)) continue;
      for (let ci = 0; ci < p.tiles.length; ci++) {
        if (far(p.ball, ci * 4)) continue;
        if (p.tiles[ci]) { n += this._gatherCell(s, sub, p.tiles[ci], ci, mask, kind, eye, cand); continue; }
        const q = this._pending[this._pendN] ??= { d: 0, s: null, sub: null, p: null, ci: 0, mask: null };
        this._pendN++;
        q.d = Math.hypot(p.ball[ci * 4] - eye[0], p.ball[ci * 4 + 1] - eye[1], p.ball[ci * 4 + 2] - eye[2]);
        q.s = s; q.sub = sub; q.p = p; q.ci = ci; q.mask = mask;
      }
    }
    return n;
  }

  /** One built cell's tiles into `cand`. */
  _gatherCell(s, sub, t, ci, mask, kind, eye, cand) {
    let n = 0;
    const ap = sub.ap, box = mask.box, first = sub.cells[ci * APERTURE_CELL_REC + 4], P = t.cent;
    this.stats.walked += t.street.length;
    for (let j = 0; j < t.street.length; j++) {
      if (kind === 'street' && !t.street[j]) continue;   // a dark room throws nothing; glass in a roof shows no room
      const k = (first + j) * WL_REC;
      if (!(Math.min(ap[k + 16], box[2]) - Math.max(ap[k + 14], box[0]) > 1e-3 && Math.min(ap[k + 17], box[3]) - Math.max(ap[k + 15], box[1]) > 1e-3)) continue;   // no glass on its share
      const d = Math.hypot(P[3 * j] - eye[0], P[3 * j + 1] - eye[1], P[3 * j + 2] - eye[2]);
      if (d > WL_GATHER) continue;
      const c = this._pool[this._used] ??= { d: 0, s: null, ap: null, k: 0, j: 0, t: null, mask: null };
      this._used++;
      c.d = d; c.s = s; c.ap = ap; c.k = k; c.j = j; c.t = t; c.mask = mask;
      cand.push(c);
      n++;
    }
    return n;
  }

  /** The cells the gather found unbuilt, the nearest first, built up to WL_BUILD_TILES tiles (one cell at least) and
   *  walked this frame; the rest wait for the next. Answers the candidates they added. */
  _buildPending(kind, eye, cand) {
    const n = this._pendN, list = this._pending;
    let added = 0, built = 0;
    if (n > 1) { const live = list.slice(0, n).sort(byDistance); for (let i = 0; i < n; i++) list[i] = live[i]; }
    for (let i = 0; i < n; i++) {
      const q = list[i];
      if (!q.p.tiles[q.ci] && (built === 0 || built < WL_BUILD_TILES)) {
        q.p.tiles[q.ci] = this._cellTiles(q.s, q.sub, q.ci);
        built += q.sub.cells[q.ci * APERTURE_CELL_REC + 5];
        added += this._gatherCell(q.s, q.sub, q.p.tiles[q.ci], q.ci, q.mask, kind, eye, cand);
      }
      q.s = null; q.sub = null; q.p = null; q.mask = null;
    }
    this.stats.built = built;
    return added;
  }

  /** A placement's cells of one sub-mesh in the world, made once and kept with it (shifted with the origin): each cell's
   *  centre and radius, the ball of them all, and each cell's tiles once a gather first walks it (_cellTiles). */
  _cellsOf(s, si, sub) {
    s.subs ??= [];
    let p = s.subs[si];
    if (p) return p;
    const C = sub.cells, nc = C.length / APERTURE_CELL_REC, m = s.m, sc = Math.hypot(m[0], m[1], m[2]);
    p = { ball: new Float64Array(4 * nc), all: new Float64Array(4), tiles: new Array(nc).fill(null) };
    const B = p.ball, A = p.all;
    for (let c = 0; c < nc; c++) {
      xfTo(B, 4 * c, m, C[c * APERTURE_CELL_REC], C[c * APERTURE_CELL_REC + 1], C[c * APERTURE_CELL_REC + 2], 1);
      B[4 * c + 3] = C[c * APERTURE_CELL_REC + 3] * sc;
      A[0] += B[4 * c] / nc; A[1] += B[4 * c + 1] / nc; A[2] += B[4 * c + 2] / nc;
    }
    for (let c = 0; c < nc; c++) A[3] = Math.max(A[3], Math.hypot(B[4 * c] - A[0], B[4 * c + 1] - A[1], B[4 * c + 2] - A[2]) + B[4 * c + 3]);
    s.subs[si] = p;
    return p;
  }

  /** One cell's tiles in the world: each covered centre, its unit normal, whether a street's lamp lights it (its room
   *  lit by the mock rooms' own seed, realWindows.js rwSeedBits - the normal in quarters and the plane off the model's
   *  own frame - and its glass in a wall, not a roof) and its curtains. */
  _cellTiles(s, sub, ci) {
    const ap = sub.ap, first = sub.cells[ci * APERTURE_CELL_REC + 4], T = sub.cells[ci * APERTURE_CELL_REC + 5], m = s.m, v = this._v;
    const t = { cent: new Float32Array(3 * T), nrm: new Float32Array(3 * T), street: new Uint8Array(T), curtains: new Array(T).fill(null) };
    const q = (x) => Math.floor(x * 4 + 0.5);
    for (let j = 0; j < T; j++) {
      const k = (first + j) * WL_REC;
      const cu = 0.5 * (ap[k + 14] + ap[k + 16]), cv = 0.5 * (ap[k + 15] + ap[k + 17]);   // the covered share's centre
      xfTo(t.cent, 3 * j, m, ap[k + 2] + ap[k + 5] * cu + ap[k + 8] * cv, ap[k + 3] + ap[k + 6] * cu + ap[k + 9] * cv, ap[k + 4] + ap[k + 7] * cu + ap[k + 10] * cv, 1);
      xfTo(v, 0, m, ap[k + 11], ap[k + 12], ap[k + 13], 0);
      const nl = Math.hypot(v[0], v[1], v[2]) || 1;
      const nx = v[0] / nl, ny = v[1] / nl, nz = v[2] / nl;
      t.nrm[3 * j] = nx; t.nrm[3 * j + 1] = ny; t.nrm[3 * j + 2] = nz;
      xfTo(v, 0, m, ap[k + 2] + ap[k + 5] * cu + ap[k + 8] * cv, ap[k + 3] + ap[k + 6] * cu + ap[k + 9] * cv, ap[k + 4] + ap[k + 7] * cu + ap[k + 10] * cv, 0);   // the glass's middle, off the model's own (uModel[3])
      const plane = Math.floor((nx * v[0] + ny * v[1] + nz * v[2]) * 40 + 0.5);
      const h = roomSeedBits(q(nx), q(ny), q(nz), plane, ap[k], ap[k + 1]);
      t.street[j] = roomLitAt(h) && Math.abs(ny) <= 0.5 ? 1 : 0;
      const cb = curtainBitsOf(h);
      if (roomCurtained(cb)) t.curtains[j] = curtainEdges(cb);
    }
    return t;
  }

  /** The aperture of a candidate in the world, into `o`: the tile's glass box under the share the mesh covers, `clip`
   *  the curtains' edges (or null) - its centre, spans, normal, area and mask uv. False when nothing is left. */
  _aperture(c, clip, o) {
    const { ap, k, s, mask, t, j } = c, m = s.m;
    let u0 = Math.max(ap[k + 14], mask.box[0]), u1 = Math.min(ap[k + 16], mask.box[2]);
    const v0 = Math.max(ap[k + 15], mask.box[1]), v1 = Math.min(ap[k + 17], mask.box[3]);
    if (clip) { u0 = Math.max(u0, clip[0]); u1 = Math.min(u1, clip[1]); }
    if (!(u1 - u0 > 1e-3 && v1 - v0 > 1e-3)) return false;
    const du = u1 - u0, dv = v1 - v0, um = 0.5 * (u0 + u1), vm = 0.5 * (v0 + v1);
    const U = o.U, V = o.V;
    xfTo(U, 0, m, ap[k + 5] * du, ap[k + 6] * du, ap[k + 7] * du, 0);
    xfTo(V, 0, m, ap[k + 8] * dv, ap[k + 9] * dv, ap[k + 10] * dv, 0);
    xfTo(o.c, 0, m, ap[k + 2] + ap[k + 5] * um + ap[k + 8] * vm, ap[k + 3] + ap[k + 6] * um + ap[k + 9] * vm, ap[k + 4] + ap[k + 7] * um + ap[k + 10] * vm, 1);
    set3(o.nf, t.nrm[3 * j], t.nrm[3 * j + 1], t.nrm[3 * j + 2]);
    o.area = Math.hypot(U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]);
    if (!(o.area > 1e-6 && o.area < 400)) return false;   // no plane to cross (the duals NaN), or a mapping past reason
    o.uv[0] = um; o.uv[1] = vm; o.uv[2] = du; o.uv[3] = dv;
    o.halfDiag = 0.5 * Math.hypot(U[0] + V[0], U[1] + V[1], U[2] + V[2]);
    return true;
  }

  /** A lit room's light through its window (the frame's one record, rewritten for each). */
  _lampLight(c, lamp, fade) {
    const l = this._lt, curtains = c.t.curtains[c.j];
    if (!this._aperture(c, curtains, l)) return null;
    if (curtains && this._aperture(c, null, this._whole)) l.area += (this._whole.area - l.area) * WL_CURTAIN_PASS;
    lampOf(l.c, l.nf, l.V, l.src);
    const kg = WL_LAMP_GOBO * fade, ks = WL_LAMP_SPILL * fade;
    set3(l.gobo, lamp[0] * kg, lamp[1] * kg, lamp[2] * kg);
    set3(l.spill, lamp[0] * ks, lamp[1] * ks, lamp[2] * ks);
    l.kind = WL_KIND.lamp; l.layer = c.mask.layer; l.reach = WL_LAMP_RANGE;
    l.ball[0] = l.c[0]; l.ball[1] = l.c[1]; l.ball[2] = l.c[2]; l.ball[3] = WL_LAMP_RANGE + l.halfDiag;
    return l;
  }

  /** The sun's or the moon's light through a building's glass (`key`, toward `dir`), and the sky's glow off it (`sky`) -
   *  null when neither reaches. */
  _sunLight(c, dir, day, key, sky, shadows, fade) {
    const l = this._lt;
    if (!this._aperture(c, null, l)) return null;
    const faces = !!dir && !!key && dir[0] * l.nf[0] + dir[1] * l.nf[1] + dir[2] * l.nf[2] < -0.02;
    const kg = faces ? (day ? WL_SUN_GAIN : WL_MOON_GAIN) * fade : 0, ks = WL_SKY_GAIN * fade;
    if (faces) set3(l.gobo, key[0] * kg, key[1] * kg, key[2] * kg); else set3(l.gobo, 0, 0, 0);
    set3(l.spill, sky[0] * ks, sky[1] * ks, sky[2] * ks);
    if (!(l.gobo[0] + l.gobo[1] + l.gobo[2] + l.spill[0] + l.spill[1] + l.spill[2] > 1e-4)) return null;
    if (faces) set3(l.src, dir[0], dir[1], dir[2]); else set3(l.src, 0, 1, 0);
    l.kind = shadows ? WL_KIND.sun : WL_KIND.sunBare; l.layer = c.mask.layer;
    // its ball: the beam into the room (away from the sun, its reach long) and the glow round the glass; a pane the sun
    // does not face only glows
    const h = faces ? WL_SUN_REACH / 2 : 0;
    l.reach = faces ? WL_SUN_REACH : WL_SPILL_REACH;
    if (faces) { l.ball[0] = l.c[0] - dir[0] * h; l.ball[1] = l.c[1] - dir[1] * h; l.ball[2] = l.c[2] - dir[2] * h; } else set3(l.ball, l.c[0], l.c[1], l.c[2]);
    l.ball[3] = h + Math.max(l.halfDiag, WL_SPILL_REACH);
    return l;
  }

  /** The frame's grid space, its rows for the renderer's upload into LC1's band. */
  get grid() { return this.space; }

  /** EVERY ALLOCATION HAS AN OWNER: the array and the block. */
  release() {
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.ubo) gl.deleteBuffer(this.ubo);
    this.tex = null; this.ubo = null;
    this.masks.clear(); this._layers = 0;
  }
}
