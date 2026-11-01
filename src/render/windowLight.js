// @ts-check
// WL1 (2026-10-29, the owner: "Windows should have shadowed lightening that shows on the ground at night and also light
// on the inside should show on the ground, all depending on time of day"): WINDOW LIGHT. A lit room's lamp shines out
// through its window's glass onto the street by night; the sun or the moon shines in through a building's glass onto its
// floor. A fragment follows its ray back to the window's plane and reads the glass's mask there, so the lead and the
// frame fall as shadow. The lights are a tile of window texture each (windowAperturesOf), counted in a band of LC1's grid
// and read in both lanes' shaders (windowLightGlsl); a dark mock room throws nothing (world/windowRoomArt.js).
// Not a DFU member: DFU's windows light nothing. 07-Rendering/Real-Windows.md, WL1.

import {
  buildLightClusterBoxes,
  LC_BOX,
  createClusterSpace,
  CLUSTER_X,
  CLUSTER_Y,
  CLUSTER_Z,
  CLUSTER_LIST_W,
  CLUSTER_LIST_ROWS,
  CLUSTER_LIST_CAP,
} from './lightClusters.js';
import {
  roomSeedBits,
  roomLitAt,
  curtainBitsOf,
  roomCurtained,
  curtainEdges,
  ROOM_CURTAIN_EDGE,
} from '../world/windowRoomArt.js';
import { pageParam } from '../systems/pageQuery.js';
import { WL_REC, APERTURE_CELL_REC, windowAperturesOf } from './windowApertures.js';
import { WIN_GLINT_LOD0, WIN_GLINT_LOD1, WIN_GLINT_NEAR_M, WIN_GLINT_FAR_M, WIN_GLINT_FADE_M } from './wetGlsl.js';   // WET1d: how soft a window is in a puddle

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
/** LIGHT-REACH: the far rows' band, past the window lights'. */
export const WL_FAR_GRID_ROW = 2 * CLUSTER_Z;
export const WL_FAR_LIST_BASE = 2 * CLUSTER_LIST_W * CLUSTER_LIST_ROWS;
/** A light's kind (the shader's): a lamp behind the glass, a sun or moon read through the shadow map, or one without. */
export const WL_KIND = Object.freeze({ lamp: 0, sun: 1, sunBare: 2, row: 3 });

/** THE LAMP behind a lit window: how far behind the glass it hangs and how far over the glass's middle (the pane's half
 *  height and this), its reach, the breadth of the room's light (the pool's penumbra), and its gains on the room's lamp
 *  - through the glass's shape, and the glass's own glow onto what faces it. */
export const WL_LAMP_DEPTH = 1.8;
export const WL_LAMP_LIFT = 0.45;
export const WL_LAMP_RANGE = 12;
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
/** WINDOW-NIGHT (a player: "It gets way to bright at night for me"): the night's gains of their own - the moon's well
 *  under the sun's, and the panes' glow a fifth of the day's. At 1 and 0.5 a full Masser's patch was four times a room's
 *  ambient on the Enhanced lane; now about once (Real-Windows.md WINDOW-NIGHT). */
export const WL_MOON_GAIN = 0.3;
export const WL_SKY_GAIN = 0.5;
export const WL_SKY_NIGHT_GAIN = 0.1;
/** AUDIT FB1031 L1: the day's share of the glass's light eases in over the sun's first WL_DUSK_RISE of height - the
 *  glow had stepped from the day's gain to the night's in one capture, eleven minutes before the room's own ambient
 *  turns at 18:00, and Day only had cut all its light in a frame. 0 with the sun down or no outside read. */
export const WL_DUSK_RISE = 0.15;
export const wlDayShare = (o) => {
  const t = o ? Math.min(1, o.sunDir[1] / WL_DUSK_RISE) : 0;
  return t > 1e-3 ? t * t * (3 - 2 * t) : 0; // the clock's night sun stands at sin(pi), 1e-16 over the horizon
};
/** The panes' glow gain at the day's share `k` (wlDayShare): the night's at 0, the day's at 1. */
export const wlGlowGain = (k) => WL_SKY_NIGHT_GAIN + (WL_SKY_GAIN - WL_SKY_NIGHT_GAIN) * k;
/** How far from the eye a lit window is gathered, the share of that where its light begins to fade, and how fast the
 *  cut follows the frame's own (a pool at the cut fades, never pops). */
export const WL_GATHER = 72;
export const WL_FADE_FROM = 0.8;
export const WL_CUT_EASE = 3;
/** AUDIT LIGHT-REACH W1: after a band's list overflowed, its cut eases out no farther than where it was cut for this
 *  long (ms) - easing back each frame overflowed every other one, a 30 Hz beat on the windows at the edge. */
export const WL_FIT_HOLD_MS = 1000;
/** A light's share at distance `d` from the eye, its band's cut `cut`: whole to WL_FADE_FROM of it, none at it. */
export const wlFade = (d, cut) => (d <= cut * WL_FADE_FROM ? 1 : Math.max(0, (cut - d) / (cut * (1 - WL_FADE_FROM))));
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
/** LIGHT-REACH (the owner, 2026-10-29: "Increase distance for street and window lighting in overworld without killing
 *  performance"): THE FAR TIER. Past the nearest WL_MAX_LIGHTS, a street's window light is gathered out to
 *  WL_FAR_GATHER as ROWS - a storey's run of one wall's tiles, up to WL_ROW_TILES - each tile lit by its own lamp through
 *  its own glass, as the near tier lights it, in a second block of WL_FAR_MAX rows. A tile is the near tier's inside its
 *  fade and the row's past it, by the one fade. A row has no glow, and its curtains stand at their mean edges. */
export const WL_FAR_GATHER = 160;
export const WL_FAR_MAX = 127;
export const WL_FAR_UBO_BINDING = 4;
export const WL_ROW_TILES = 10;
/** A row's tiles in one float: a base-3 digit a tile (0 dark, 1 lit, 2 lit behind curtains), and the count above them. */
export const WL_ROW_BASE = 3 ** WL_ROW_TILES;
/** A curtained tile of a row lets the lamp through between the curtains' mean inner edges (ROOM_CURTAIN_EDGE). */
export const WL_ROW_CURTAIN = Object.freeze([
  ROOM_CURTAIN_EDGE[0] + ROOM_CURTAIN_EDGE[1] / 2,
  ROOM_CURTAIN_EDGE[2] - ROOM_CURTAIN_EDGE[3] / 2,
]);
/** The kill door: `?windowlight=off` lights no window (the Real windows row's Off lights none either). */
export function windowLightOn(search = globalThis.location?.search ?? '') {
  return pageParam('windowlight', search) !== 'off';
}
/** Is the sun up for a building's glass in `o` (the outside as setOutside kept it)? By night the moon is the key. */
export const wlSunUp = (o) => !!o && o.sunScale > 0 && o.sunDir[1] > 0.05;
/** WINDOW-NIGHT: a frame's kind under the Window light part (`light`: realWindows.js windowLightMode) - Off lights none,
 *  Day only none while the sun is down (`sunUp`: the renderer hands wlDayShare's above 0 - AUDIT FB1031 L1, the frame
 *  fades by it), and a street's light is a lit room's by night, so none under it. */
export function wlKindFor(kind, light, sunUp) {
  if (!kind || light === 'off') return null;
  return light === 'day' && (kind === 'street' || !sunUp) ? null : kind;
}

// ---------------------------------------------------------------------------------------------------------------
// THE MASKS - a window picture's glass, as a layer of the array the shader reads
// ---------------------------------------------------------------------------------------------------------------

/** The box the glass of a mask spans (rgba, white where glass, rows as uploaded - the texture's own v), in the tile's
 *  uv: [u0, v0, u1, v1], or null for no glass. */
export function maskBoxOf(mask) {
  const { width: W, height: H, colors: c } = mask;
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (c[(y * W + x) * 4] < 128) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return x1 < 0 ? null : [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H];
}

/** A mask resampled to one WL_MASK_SIZE layer (nearest: the lead keeps its edges; the mips soften it), one byte a texel,
 *  rows as given. `alpha`: the glass is where alpha is under a half (a cutout picture's holes). */
export function maskLayerOf(mask, alpha = false) {
  const { width: W, height: H, colors: c } = mask,
    S = WL_MASK_SIZE;
  const out = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    const sy = Math.min(H - 1, Math.floor(((y + 0.5) * H) / S));
    for (let x = 0; x < S; x++) {
      const i = (sy * W + Math.min(W - 1, Math.floor(((x + 0.5) * W) / S))) * 4;
      out[y * S + x] = (alpha ? c[i + 3] < 128 : c[i] > 127) ? 255 : 0;
    }
  }
  return out;
}

/** A cutout picture's holes as a mask (white where alpha is under a half). */
export function holesOf(color32) {
  const src = color32.colors,
    out = new Uint8ClampedArray(src.length);
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
  const U = l.U,
    V = l.V;
  const nx = U[1] * V[2] - U[2] * V[1],
    ny = U[2] * V[0] - U[0] * V[2],
    nz = U[0] * V[1] - U[1] * V[0];
  const vx = V[1] * nz - V[2] * ny,
    vy = V[2] * nx - V[0] * nz,
    vz = V[0] * ny - V[1] * nx; // V x n
  const ux = ny * U[2] - nz * U[1],
    uy = nz * U[0] - nx * U[2],
    uz = nx * U[1] - ny * U[0]; // n x U
  const ku = U[0] * vx + U[1] * vy + U[2] * vz,
    kv = V[0] * ux + V[1] * uy + V[2] * uz;
  const o = at * WL_VEC4 * 4;
  out[o] = l.c[0];
  out[o + 1] = l.c[1];
  out[o + 2] = l.c[2];
  out[o + 3] = l.reach;
  out[o + 4] = vx / ku;
  out[o + 5] = vy / ku;
  out[o + 6] = vz / ku;
  out[o + 7] = l.uv[0];
  out[o + 8] = ux / kv;
  out[o + 9] = uy / kv;
  out[o + 10] = uz / kv;
  out[o + 11] = l.uv[1];
  out[o + 12] = l.nf[0];
  out[o + 13] = l.nf[1];
  out[o + 14] = l.nf[2];
  out[o + 15] = l.uv[2];
  out[o + 16] = l.src[0];
  out[o + 17] = l.src[1];
  out[o + 18] = l.src[2];
  out[o + 19] = l.uv[3];
  out[o + 20] = l.gobo[0];
  out[o + 21] = l.gobo[1];
  out[o + 22] = l.gobo[2];
  out[o + 23] = l.layer + 256 * l.kind;
  out[o + 24] = l.spill[0];
  out[o + 25] = l.spill[1];
  out[o + 26] = l.spill[2];
  out[o + 27] = l.area;
}

/** AUDIT LIGHT-REACH W1: light `at`'s gobo and glow in `out` scaled by `k` - its fade taken in to a nearer cut. */
export function scaleWindowLight(out, at, k) {
  const o = at * WL_VEC4 * 4;
  out[o + 20] *= k;
  out[o + 21] *= k;
  out[o + 22] *= k;
  out[o + 24] *= k;
  out[o + 25] *= k;
  out[o + 26] *= k;
}

/** THE LAMP of a lit room behind an aperture whose centre is `c`, its normal `nf` (to the street) and its world span `V`
 *  upward: over the glass's middle by half the pane and WL_LAMP_LIFT, WL_LAMP_DEPTH behind it. */
export function lampOf(c, nf, V, out = [0, 0, 0]) {
  const lift = 0.5 * Math.abs(V[1]) + WL_LAMP_LIFT;
  out[0] = c[0] - nf[0] * WL_LAMP_DEPTH;
  out[1] = c[1] + lift - nf[1] * WL_LAMP_DEPTH;
  out[2] = c[2] - nf[2] * WL_LAMP_DEPTH;
  return out;
}

/** The length of (x, y, z) - AUDIT LIGHT-REACH W5: Math.hypot's answer was a fresh heap number a call on the
 *  gather's paths and the boxes' build, and the far tier's 160 m tripled its calls. */
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
/** LIGHT-REACH: THE VOLUME A WINDOW'S LIGHT CAN REACH, a box in the glass's own frame (LC_BOX floats into `out` at `at`,
 *  for lightClusters.js buildLightClusterBoxes): the glass's glow out to WL_SPILL_REACH on its side, and the beam - from
 *  the lamp (`l.src`) through the glass to its reach, or along the sun's rays (`l.src` toward the sun) into the room.
 *  `beam` false: the glow alone; `spill` false: the beam alone (a far row). The box of the reach's sphere was six to
 *  nine times this, and every fragment in it walked the light only to be turned away. */
export function windowLightBox(l, beam, out, at, spill = true) {
  // AUDIT LIGHT-REACH W5: the frame's 128 boxes written out - no closures, no literals (a third of the pass's garbage)
  const c = l.c,
    U = l.U,
    V = l.V,
    nf = l.nf,
    f0 = nf[0],
    f1 = nf[1],
    f2 = nf[2];
  const un = U[0] * f0 + U[1] * f1 + U[2] * f2;
  let u0 = U[0] - f0 * un,
    u1 = U[1] - f1 * un,
    u2 = U[2] - f2 * un;
  const ul = len3(u0, u1, u2) || 1;
  u0 /= ul;
  u1 /= ul;
  u2 /= ul;
  const v0 = f1 * u2 - f2 * u1,
    v1 = f2 * u0 - f0 * u2,
    v2 = f0 * u1 - f1 * u0;
  // the glass's corners, widened by the soft edge's most (the lamp's footprint, or the sun's over its beam)
  const lamp = l.kind === WL_KIND.lamp,
    edge = lamp ? 2 * WL_LAMP_RADIUS : WL_SUN_ANGLE * (l.reach + l.halfDiag);
  let aLo = Infinity,
    aHi = -Infinity,
    bLo = Infinity,
    bHi = -Infinity;
  for (let k = 0; k < 4; k++) {
    const su = k & 1 ? 0.5 : -0.5,
      sv = k & 2 ? 0.5 : -0.5;
    const x = U[0] * su + V[0] * sv,
      y = U[1] * su + V[1] * sv,
      z = U[2] * su + V[2] * sv;
    const a = x * u0 + y * u1 + z * u2,
      b = x * v0 + y * v1 + z * v2;
    if (a < aLo) aLo = a;
    if (a > aHi) aHi = a;
    if (b < bLo) bLo = b;
    if (b > bHi) bHi = b;
  }
  aLo -= edge;
  aHi += edge;
  bLo -= edge;
  bHi += edge;
  const S = spill ? WL_SPILL_REACH : 0;
  // nHi a float from the start (Math.max): begun as the export's whole number, every beam's depth was boxed to join it
  let xLo = Math.min(aLo, -S),
    xHi = Math.max(aHi, S),
    yLo = Math.min(bLo, -S),
    yHi = Math.max(bHi, S),
    nHi = Math.max(0, S);
  if (beam && lamp) {
    // the frustum from the lamp (behind the glass, n < 0) through the glass, out to where the lamp's reach ends
    const sx = l.src[0] - c[0],
      sy = l.src[1] - c[1],
      sz = l.src[2] - c[2];
    const pa = sx * u0 + sy * u1 + sz * u2,
      pb = sx * v0 + sy * v1 + sz * v2,
      pn = sx * f0 + sy * f1 + sz * f2,
      r = l.reach;
    const n1 = Math.min(r, r + pn);
    if (pn < 0 && n1 > 0) {
      const k = (n1 - pn) / -pn;
      xLo = Math.min(xLo, Math.max(pa - r, Math.min(aLo, pa + k * (aLo - pa))));
      xHi = Math.max(xHi, Math.min(pa + r, Math.max(aHi, pa + k * (aHi - pa))));
      yLo = Math.min(yLo, Math.max(pb - r, Math.min(bLo, pb + k * (bLo - pb))));
      yHi = Math.max(yHi, Math.min(pb + r, Math.max(bHi, pb + k * (bHi - pb))));
      nHi = Math.max(nHi, n1);
    }
  } else if (beam) {
    // the sun's rays through the glass run away from the sun: the glass's rectangle carried that way, as far as the reach
    const T = l.reach + l.halfDiag,
      s0 = l.src[0],
      s1 = l.src[1],
      s2 = l.src[2];
    const ea = -(s0 * u0 + s1 * u1 + s2 * u2) * T,
      eb = -(s0 * v0 + s1 * v1 + s2 * v2) * T,
      en = -(s0 * f0 + s1 * f1 + s2 * f2) * T;
    if (en > 0) {
      xLo = Math.min(xLo, aLo, aLo + ea);
      xHi = Math.max(xHi, aHi, aHi + ea);
      yLo = Math.min(yLo, bLo, bLo + eb);
      yHi = Math.max(yHi, bHi, bHi + eb);
      nHi = Math.max(nHi, en);
    }
  }
  const ma = 0.5 * (xLo + xHi),
    mb = 0.5 * (yLo + yHi),
    mn = 0.5 * nHi,
    ha = 0.5 * (xHi - xLo),
    hb = 0.5 * (yHi - yLo),
    hn = 0.5 * nHi;
  out[at] = c[0] + u0 * ma + v0 * mb + nf[0] * mn;
  out[at + 1] = c[1] + u1 * ma + v1 * mb + nf[1] * mn;
  out[at + 2] = c[2] + u2 * ma + v2 * mb + nf[2] * mn;
  out[at + 3] = u0 * ha;
  out[at + 4] = u1 * ha;
  out[at + 5] = u2 * ha;
  out[at + 6] = v0 * hb;
  out[at + 7] = v1 * hb;
  out[at + 8] = v2 * hb;
  out[at + 9] = f0 * hn;
  out[at + 10] = f1 * hn;
  out[at + 11] = f2 * hn;
}

/** The shader's own walk of one light for one point (the GLSL's twin, for the pins): what reaches `wp` (normal `n`)
 *  through the glass, by the mask `maskAt(u, v)` (0..1) and the lamp's falloff `atten(d, r)`. */
export function windowLightAt(rec, wp, n, maskAt, atten) {
  const g = (k) => [rec[k * 4], rec[k * 4 + 1], rec[k * 4 + 2], rec[k * 4 + 3]];
  const c0 = g(0),
    c1 = g(1),
    c2 = g(2),
    c3 = g(3),
    c4 = g(4),
    c5 = g(5),
    c6 = g(6);
  const rel = sub3(wp, c0),
    d2 = dot(rel, rel);
  if (d2 >= c0[3] * c0[3]) return [0, 0, 0];
  const s = dot(rel, c3);
  if (s <= 0) return [0, 0, 0];
  const d = Math.sqrt(d2),
    x2 = d2 / WL_SPILL_REACH ** 2,
    win = d2 < WL_SPILL_REACH ** 2 ? (1 - x2 * x2) ** 2 : 0;
  const cr = Math.max(-dot(n, rel), 0) / Math.max(d, 1e-4);
  const sp = ((c6[3] * (s / Math.max(d, 1e-4)) * cr) / (Math.PI * d2 + c6[3])) * win;
  const acc = [c6[0] * sp, c6[1] * sp, c6[2] * sp];
  const kind = Math.floor((c5[3] + 0.5) / 256);
  let ray, tt;
  if (kind === WL_KIND.lamp) {
    ray = sub3(c4, wp);
    const sl = dot(sub3(c4, c0), c3);
    tt = s / (s - sl);
  } else {
    ray = [c4[0], c4[1], c4[2]];
    const dn = dot(ray, c3);
    if (dn > -1e-3) return acc;
    tt = -s / dn;
  }
  const w = [wp[0] + ray[0] * tt - c0[0], wp[1] + ray[1] * tt - c0[1], wp[2] + ray[2] * tt - c0[2]];
  const a = dot(w, c1),
    b = dot(w, c2);
  const pw = kind === WL_KIND.lamp ? 2 * WL_LAMP_RADIUS * tt : WL_SUN_ANGLE * tt;
  const pa = pw * Math.hypot(c1[0], c1[1], c1[2]),
    pb = pw * Math.hypot(c2[0], c2[1], c2[2]);
  if (Math.abs(a) > 0.5 + pa || Math.abs(b) > 0.5 + pb) return acc;
  if (kind === WL_KIND.sunBare && wp[1] < c0[1] - 0.5 / Math.max(Math.hypot(c2[0], c2[1], c2[2]), 1e-4) - WL_STOREY)
    return acc;
  const rl = Math.hypot(ray[0], ray[1], ray[2]);
  const ndl = Math.max(dot(n, ray), 0) / Math.max(rl, 1e-4);
  const m = maskAt(c1[3] + a * c3[3], c2[3] + b * c4[3]);
  const k = m * ndl * (kind === WL_KIND.lamp ? atten(rl, c0[3]) : 1);
  return [acc[0] + c5[0] * k, acc[1] + c5[1] * k, acc[2] + c5[2] * k];
}

/** LIGHT-REACH: the shader's walk of a far row (winRow) for one point - `rec` the row's WL_VEC4 vec4s, `frame` the far
 *  block's two words (eye and near cut, lamp colour and far cut), `maskAt(u, v)` 0..1, `atten(d, r)` the lane's falloff. */
export function windowRowAt(rec, frame, wp, n, maskAt, atten) {
  const g = (k) => [rec[k * 4], rec[k * 4 + 1], rec[k * 4 + 2], rec[k * 4 + 3]];
  const r0 = g(0),
    r1 = g(1),
    r2 = g(2),
    r3 = g(3),
    r4 = g(4),
    r5 = g(5),
    r6 = g(6);
  const out = [0, 0, 0],
    rel = sub3(wp, r0),
    lr = sub3(r4, r0),
    s = dot(rel, r3),
    sl = dot(lr, r3);
  if (s <= 0 || sl >= 0) return out;
  const tt = s / (s - sl),
    w0 = [0, 1, 2].map((i) => rel[i] * (1 - tt) + lr[i] * tt);
  const pw = 2 * WL_LAMP_RADIUS * tt,
    pa = pw * Math.hypot(r1[0], r1[1], r1[2]),
    pb = pw * Math.hypot(r2[0], r2[1], r2[2]);
  const b = dot(w0, r2);
  if (Math.abs(b) > 0.5 + pb) return out;
  const a0 = dot(w0, r1),
    stp = (1 - tt) / r3[3],
    code = Math.round(r6[3]),
    cnt = Math.floor(code / WL_ROW_BASE);
  const j0 = Math.max(0, Math.min(cnt, Math.ceil((a0 - 0.5 - pa) / stp))),
    j1 = Math.max(-1, Math.min(cnt - 1, Math.floor((a0 + 0.5 + pa) / stp)));
  const fadeN = (d) => Math.max(0, Math.min(1, (frame[3] - d) / (frame[3] * (1 - WL_FADE_FROM))));
  const fadeF = (d) => Math.max(0, Math.min(1, (frame[7] - d) / (frame[7] * (1 - WL_FADE_FROM))));
  for (let j = j0; j <= j1; j++) {
    const st = Math.floor(code / 3 ** j) % 3;
    if (!st) continue;
    const dq = Math.hypot(
      r0[0] + r6[0] + r5[0] * j - frame[0],
      r0[1] + r6[1] + r5[1] * j - frame[1],
      r0[2] + r6[2] + r5[2] * j - frame[2],
    );
    const wt = (1 - fadeN(dq)) * fadeF(dq);
    if (!(wt > 0)) continue;
    const u = r1[3] + (a0 - j * stp) * r3[3];
    if (st === 2 && (u < WL_ROW_CURTAIN[0] - pa * r3[3] || u > WL_ROW_CURTAIN[1] + pa * r3[3])) continue;
    const ray = [r4[0] + r5[0] * j - wp[0], r4[1] + r5[1] * j - wp[1], r4[2] + r5[2] * j - wp[2]],
      rl = Math.hypot(...ray);
    if (rl >= r0[3]) continue;
    const ndl = Math.max(dot(n, ray), 0) / Math.max(rl, 1e-4);
    if (!(ndl > 0)) continue;
    const k = maskAt(u, r2[3] + b * r4[3]) * ndl * atten(rl, r0[3]) * wt;
    out[0] += frame[4] * k;
    out[1] += frame[5] * k;
    out[2] += frame[6] * k;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// THE SHADER TEXT - one block, interpolated into both lanes' lit programs
// ---------------------------------------------------------------------------------------------------------------

const f = (x) => {
  const s = Number(x).toFixed(6).replace(/0+$/, '');
  return s.endsWith('.') ? `${s}0` : s;
};

/** THE BLOCK. `atten` the lane's lamp falloff (a GLSL expression of rl, the lamp's distance, and r), `shadow` whether the lane's sun map is
 *  there to read (SHADOW_GLSL interpolated before this; 'flat' the billboard program's, which takes flatSun alone),
 *  `clusters` whether the program declares LC1's grid itself (the classic set: the lane's EL_CLUSTER_GLSL already does).
 *  winLit(wp, n, isFlat, flatSun): what the frame's window lights add at a point (a flat passes no normal and its sun
 *  map's word, read once a quad - LA-COST3's vBBSunVis).
 *  `wetGlint` the wet ground's mirror of the glass (needs AIR_CONTACT_GLSL above - the enhanced lane only).
 * @param {{ atten?: string, shadow?: boolean | 'flat', clusters?: boolean, wetGlint?: boolean }} [opts] */
export function windowLightGlsl({ atten = 'wlClassicAtten(rl, r)', shadow = false, clusters = false, wetGlint = false } = {}) {
  return `
// WL1: WINDOW LIGHT (render/windowLight.js)
layout(std140) uniform WinLights { vec4 uWinL[${WL_MAX_LIGHTS * WL_VEC4}]; };
// LIGHT-REACH: the far rows, and the frame's word on the two tiers: the eye and the near cut, the lamp's colour and the far cut
layout(std140) uniform WinFar { vec4 uWinF[${WL_FAR_MAX * WL_VEC4}]; vec4 uWinFrame[2]; };
const highp int WL_P3[${WL_ROW_TILES}] = int[${WL_ROW_TILES}](${Array.from({ length: WL_ROW_TILES }, (_, j) => 3 ** j).join(', ')});
uniform highp sampler2DArray uWinMask;   // the glass's masks, a layer a window picture
uniform int uWinOn;                      // 1: the frame carries window lights, in LC1's grid's band; 2: and a sun through glass the sun map holds
${
  clusters
    ? `uniform highp usampler2D uClusterGrid;
uniform highp usampler2D uClusterList;
uniform vec4 uClusterRect;
uniform vec2 uClusterZ;
uniform vec4 uCamFwd;`
    : ''
}
float wlClassicAtten(float d, float r) { float a = clamp(1.0 - d / r, 0.0, 1.0); return a * a; }
// LIGHT-REACH: far row i's light at wp - each lit tile's lamp through that tile's own glass, for the tiles whose glass a
// ray from wp to their lamps can cross; each weighted by its distance from the eye, so it takes what the near tier's
// fade leaves and fades at the far cut. Its record: G0 reach | u* uv-u | v* uv-v | nf span-u | lamp0 span-v | PU code |
// (the coverage centre - G0) states - tile j's glass centre and lamp are tile 0's plus PU j.
vec3 winRow(int i, vec3 wp, vec3 n, float isFlat) {
  int o = i * ${WL_VEC4};
  vec4 r0 = uWinF[o], r3 = uWinF[o + 3], r4 = uWinF[o + 4];
  vec3 rel = wp - r0.xyz, lr = r4.xyz - r0.xyz;
  float s = dot(rel, r3.xyz), sl = dot(lr, r3.xyz);
  if (s <= 0.0 || sl >= 0.0) return vec3(0.0);   // behind the wall
  float tt = s / (s - sl);   // where a ray to any of the row's lamps crosses the glass's plane
  vec4 r1 = uWinF[o + 1], r2 = uWinF[o + 2];
  vec3 w0 = rel * (1.0 - tt) + lr * tt;   // ... from tile 0's glass centre; tile j's is this less PU j (1 - tt)
  float pw = ${f(2 * WL_LAMP_RADIUS)} * tt, pa = pw * length(r1.xyz), pb = pw * length(r2.xyz);
  float b = dot(w0, r2.xyz);   // the same for every tile: the row runs along the glass's u
  if (abs(b) > 0.5 + pb) return vec3(0.0);
  float a0 = dot(w0, r1.xyz), stp = (1.0 - tt) / r3.w;   // tile j's a is a0 - j stp (u* . PU is 1 / span-u)
  vec4 r5 = uWinF[o + 5], r6 = uWinF[o + 6];
  highp int code = int(r6.w + 0.5);
  highp int cnt = code / ${WL_ROW_BASE};
  int j0 = int(clamp(ceil((a0 - 0.5 - pa) / stp), 0.0, float(cnt))), j1 = int(clamp(floor((a0 + 0.5 + pa) / stp), -1.0, float(cnt - 1)));
  float lod = log2(max(max(pa * r3.w, pb * r4.w) * ${WL_MASK_SIZE}.0, 1.0)), layer = float(int(r5.w + 0.5) & 255), r = r0.w;
  vec3 acc = vec3(0.0);
  for (int j = j0; j <= j1; j++) {
    highp int st = (code / WL_P3[j]) % 3;
    if (st == 0) continue;   // a dark room
    float dq = length(r0.xyz + r6.xyz + r5.xyz * float(j) - uWinFrame[0].xyz);
    float wt = (1.0 - clamp((uWinFrame[0].w - dq) / (uWinFrame[0].w * ${f(1 - WL_FADE_FROM)}), 0.0, 1.0)) * clamp((uWinFrame[1].w - dq) / (uWinFrame[1].w * ${f(1 - WL_FADE_FROM)}), 0.0, 1.0);
    if (wt <= 0.0) continue;   // the near tier's, or past the far cut
    float u = r1.w + (a0 - float(j) * stp) * r3.w;
    if (st == 2 && (u < ${f(WL_ROW_CURTAIN[0])} - pa * r3.w || u > ${f(WL_ROW_CURTAIN[1])} + pa * r3.w)) continue;   // behind a curtain
    vec3 ray = r4.xyz + r5.xyz * float(j) - wp;
    float rl = length(ray);
    if (rl >= r) continue;
    float ndl = isFlat > 0.5 ? 1.0 : max(dot(n, ray), 0.0) / max(rl, 1e-4);
    if (ndl <= 0.0) continue;
    float m = textureLod(uWinMask, vec3(u, r2.w + b * r4.w, layer), lod).r;
    acc += uWinFrame[1].rgb * (m * ndl * (${atten}) * wt);
  }
  return acc;
}
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
  // LIGHT-REACH: the far rows, in their own band of the grid
  highp uvec2 fcell = texelFetch(uClusterGrid, ivec2(tc.x + tc.y * ${CLUSTER_X}, zc + ${WL_FAR_GRID_ROW}), 0).rg;
  int fcnt = int(fcell.y);
  for (int j = 0; j < ${WL_FAR_MAX}; j++) {
    if (j >= fcnt) break;
    highp int at = ${WL_FAR_LIST_BASE} + int(fcell.x) + j;
    acc += winRow(int(texelFetch(uClusterList, ivec2(at & ${CLUSTER_LIST_W - 1}, at >> ${Math.log2(CLUSTER_LIST_W)}), 0).r), wp, n, isFlat);
  }
  return acc;
}
${wetGlint ? `// WET1d: the glass itself in wet ground at wp - mirror ray into the aperture's mask (a row of panes is the mask, not
// one lamp), V toward the eye; pw tightens the lobe. Occlusion marches the previous depth along the ray past a bush
// (contactShadow's 0.6 m is too short for a shrub between the puddle and the pane). Needs AIR_CONTACT_GLSL above.
float winGlintOcc(vec3 wp, vec3 n, vec3 dir, float dist) {
  float len = min(dist, 10.0);
  if (len < 0.08) return 1.0;
  vec3 start = wp + n * ${f(0.02)};
  vec4 c0 = uPrevVP * vec4(start, 1.0);
  if (c0.w <= 0.0) return 1.0;
  vec2 uv0 = c0.xy / c0.w * 0.5 + 0.5;
  if (uv0.x < 0.0 || uv0.x > 1.0 || uv0.y < 0.0 || uv0.y > 1.0) return 1.0;
  vec4 dc = uPrevVP * vec4(dir * (len / 8.0), 0.0);
  float occ = 0.0;
  for (int s = 1; s <= 8; s++) {
    vec4 c = c0 + dc * float(s);
    if (c.w <= 0.0) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float z = texture(uPrevDepth, prevDepthUV(uv)).r * 2.0 - 1.0;
    float behind = c.w - uPrevProjInfo.w / (z + uPrevProjInfo.z);
    occ = max(occ, smoothstep(0.02, 0.1, behind) * (1.0 - smoothstep(0.6, 1.2, behind)));
  }
  return mix(1.0, ${f(0.15)}, occ);
}
// scatter 0 = stones/road, 1 = soil - soil always softens more than paving at the same distance
vec3 winGlint(vec3 wp, vec3 n, vec3 V, float pw, float scatter) {
  if (uWinOn == 0) return vec3(0.0);
  ivec2 tc = clamp(ivec2((gl_FragCoord.xy - uClusterRect.xy) * uClusterRect.zw), ivec2(0), ivec2(${CLUSTER_X - 1}, ${CLUSTER_Y - 1}));
  int zc = clamp(int(log(max((dot(uCamFwd.xyz, wp) + uCamFwd.w) * uClusterZ.x, 1.0)) * uClusterZ.y), 0, ${CLUSTER_Z - 1});
  highp uvec2 cell = texelFetch(uClusterGrid, ivec2(tc.x + tc.y * ${CLUSTER_X}, zc + ${WL_GRID_ROW}), 0).rg;
  int cnt = int(cell.y);
  vec3 R = reflect(-V, n);
  if (R.y < 0.02) return vec3(0.0);
  float soil = clamp(scatter, 0.0, 1.0);
  vec3 acc = vec3(0.0);
  for (int j = 0; j < ${WL_MAX_LIGHTS}; j++) {
    if (j >= cnt) break;
    highp int at = ${WL_LIST_BASE} + int(cell.x) + j;
    int i = int(texelFetch(uClusterList, ivec2(at & ${CLUSTER_LIST_W - 1}, at >> ${Math.log2(CLUSTER_LIST_W)}), 0).r) * ${WL_VEC4};
    vec4 c0 = uWinL[i], c3 = uWinL[i + 3], c5 = uWinL[i + 5];
    if ((int(c5.w + 0.5) >> 8) != 0) continue;   // lamp panes only
    float dn = dot(R, c3.xyz);
    if (dn >= -1e-3) continue;   // ray into the wall or past the glass
    float t = -dot(wp - c0.xyz, c3.xyz) / dn;
    if (t < 0.05 || t > c0.w) continue;
    float winD = length(c0.xyz - uCamPos);
    float blur = clamp(smoothstep(${f(WIN_GLINT_NEAR_M)}, ${f(WIN_GLINT_FAR_M)}, winD) + soil * 0.7, 0.0, 1.0);
    float fade = 1.0 - smoothstep(${f(WIN_GLINT_FAR_M)}, ${f(WIN_GLINT_FADE_M)}, winD);
    if (fade < 0.02) continue;
    float pwSoft = mix(pw, max(pw * 0.45, 80.0), blur);
    vec3 hit = wp + R * t;
    vec4 c1 = uWinL[i + 1], c2 = uWinL[i + 2], c4 = uWinL[i + 4];
    vec3 w = hit - c0.xyz;
    float a = dot(w, c1.xyz), b = dot(w, c2.xyz);
    float ax = abs(a), bx = abs(b);
    // soil: falloff from the centre even up close; road keeps a tighter pane (+25% soft vs the first stone dial)
    float softIn = mix(mix(0.33, 0.0, blur), 0.0, soil * 0.85);
    float softOut = mix(mix(0.65, 0.95, blur), mix(0.7, 1.0, blur), soil);
    float soft = (1.0 - smoothstep(softIn, softOut, ax)) * (1.0 - smoothstep(softIn, softOut, bx));
    if (soft < 0.02) continue;
    float lod = mix(${f(WIN_GLINT_LOD0)}, ${f(WIN_GLINT_LOD1)}, blur) + soil * 1.8;
    float layer = float(int(c5.w + 0.5) & 255);
    float tap = mix(0.005, 0.03, blur) + soil * 0.025;
    vec2 uv = vec2(c1.w + a * c3.w, c2.w + b * c4.w);
    float m = (
      textureLod(uWinMask, vec3(uv, layer), lod).r
      + textureLod(uWinMask, vec3(uv + vec2(tap, 0.0), layer), lod).r
      + textureLod(uWinMask, vec3(uv - vec2(tap, 0.0), layer), lod).r
      + textureLod(uWinMask, vec3(uv + vec2(0.0, tap), layer), lod).r
      + textureLod(uWinMask, vec3(uv - vec2(0.0, tap), layer), lod).r
    ) * 0.2;
    if (m <= 0.02) continue;
    vec3 H = normalize(R + V);
    float vh = 1.0 - clamp(dot(V, H), 0.0, 1.0);
    float lobe = pow(max(dot(n, H), 0.0), pwSoft) * (0.04 + 0.96 * vh * vh * vh * vh * vh);
    float gain = mix(1.0, 0.4, blur) * mix(1.0, 0.55, soil) * fade;
    acc += c5.rgb * (m * soft * lobe * gain * winGlintOcc(wp, n, R, t) / (1.0 + 0.04 * t));
  }
  return acc;
}
` : `vec3 winGlint(vec3 wp, vec3 n, vec3 V, float pw, float scatter) { return vec3(0.0); }
`}
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
const set3 = (o, x, y, z) => {
  o[0] = x;
  o[1] = y;
  o[2] = z;
};
const lightRec = () => ({
  c: [0, 0, 0],
  U: [0, 0, 0],
  V: [0, 0, 0],
  nf: [0, 0, 0],
  uv: [0, 0, 0, 0],
  src: [0, 0, 0],
  gobo: [0, 0, 0],
  spill: [0, 0, 0],
  kind: 0,
  layer: 0,
  reach: 0,
  area: 0,
  halfDiag: 0,
  beam: false,
});

const byDistance = (a, b) => a.d - b.d;
/** Whether the ball at `i` in `b` (centre, radius) lies wholly past `reach` of the eye. */
const pastBall = (b, i, eye, reach) => len3(b[i] - eye[0], b[i + 1] - eye[1], b[i + 2] - eye[2]) - b[i + 3] > reach;
/** AUDIT LIGHT-REACH W5: a far row's sort key - its nearest tile in WL_FAR_KEY ths of a metre, then its index among
 *  the frame's gathered (at most WL_FAR_KEY_N): 160 m and 65536 rows in 38 bits, a double's whole numbers. */
const WL_FAR_KEY = 16384,
  WL_FAR_KEY_N = 65536;

/** LIGHT-REACH: A CELL'S ROWS (the far tier's lights) - its wall tiles grouped by the picture's mapping on one plane (the
 *  line tile 0 of a storey stands on, the spans, the normal), their storey and their share of v; each group's
 *  neighbours along u in runs of up to WL_ROW_TILES. A tile the mesh covers only in part along u is a row alone. Each row:
 *  its tiles by u (`js`, the cell's own indices), its states (WL_ROW_BASE) and whether any is lit. */
export function cellRows(ap, first, t) {
  const q = (x) => Math.round(x * 256),
    groups = new Map(),
    rows = [];
  for (let j = 0; j < t.street.length; j++) {
    if (Math.abs(t.nrm[3 * j + 1]) > 0.5) continue; // glass in a roof shows no room
    const k = (first + j) * WL_REC,
      tx = ap[k];
    if (ap[k + 14] > 1e-4 || ap[k + 16] < 1 - 1e-4) {
      rows.push(rowOf([j], t));
      continue;
    }
    const key = [
      ap[k + 1],
      q(ap[k + 2] - ap[k + 5] * tx),
      q(ap[k + 3] - ap[k + 6] * tx),
      q(ap[k + 4] - ap[k + 7] * tx),
      q(ap[k + 5]),
      q(ap[k + 6]),
      q(ap[k + 7]),
      q(ap[k + 8]),
      q(ap[k + 9]),
      q(ap[k + 10]),
      q(ap[k + 11]),
      q(ap[k + 12]),
      q(ap[k + 13]),
      q(ap[k + 15]),
      q(ap[k + 17]),
    ].join();
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(j);
  }
  const txOf = (j) => ap[(first + j) * WL_REC];
  for (const g of groups.values()) {
    g.sort((a, b) => txOf(a) - txOf(b));
    let run = [g[0]];
    for (let i = 1; i <= g.length; i++) {
      const j = g[i];
      if (j !== undefined && txOf(j) === txOf(run[run.length - 1]) + 1 && run.length < WL_ROW_TILES) {
        run.push(j);
        continue;
      }
      rows.push(rowOf(run, t));
      if (j !== undefined) run = [j];
    }
  }
  return rows;
}
/** A row of tiles `js`: its states, a base-3 digit a tile (0 dark, 1 lit, 2 lit behind curtains) and the count above. */
function rowOf(js, t) {
  let states = js.length * WL_ROW_BASE,
    lit = false;
  js.forEach((j, i) => {
    if (t.street[j]) {
      states += (t.curtains[j] ? 2 : 1) * 3 ** i;
      lit = true;
    }
  });
  return { js, states, lit, rec: null, box: null, mask: null, ok: false, ha: 0, pu: 0 };
}

/** AUDIT LIGHT-REACH W6: A ROW'S BOX THIS FRAME - over its lit tiles the far tier weighs (past the near fade's start
 *  `from`, inside the far cut `to`, by their coverage centres as the shader reads them), not the whole run: a row
 *  beside the eye whose near tiles are the near tier's covered the screen, and beside a long wall the far band's list
 *  overflowed and its cut fell to 12 m. Its whole box shrunk along u; false when no lit tile weighs. */
function rowBox(row, eye, from, to, out, at) {
  const rec = row.rec,
    b = row.box,
    n1 = row.js.length - 1,
    px = rec[20],
    py = rec[21],
    pz = rec[22];
  const cx = rec[0] + rec[24] - eye[0],
    cy = rec[1] + rec[25] - eye[1],
    cz = rec[2] + rec[26] - eye[2];
  let ja = -1,
    jb = -1;
  for (let j = 0, p3 = 1; j <= n1; j++, p3 *= 3) {
    if (Math.floor(row.states / p3) % 3 === 0) continue; // a dark tile
    const d = len3(cx + px * j, cy + py * j, cz + pz * j);
    if (d > from && d < to) {
      if (ja < 0) ja = j;
      jb = j;
    }
  }
  if (ja < 0) return false;
  if (!(row.ha > 0)) {
    ja = 0;
    jb = n1;
  }
  const k = 0.5 * (ja + jb) - 0.5 * n1,
    g = row.ha > 0 ? (row.ha + 0.5 * (jb - ja) * row.pu) / (row.ha + 0.5 * n1 * row.pu) : 1;
  out[at] = b[0] + px * k;
  out[at + 1] = b[1] + py * k;
  out[at + 2] = b[2] + pz * k;
  out[at + 3] = b[3] * g;
  out[at + 4] = b[4] * g;
  out[at + 5] = b[5] * g;
  for (let i = 6; i < LC_BOX; i++) out[at + i] = b[i];
  return true;
}

export class WindowLightPass {
  /** @param {WebGL2RenderingContext} gl @param {{ activeTexture: (u: number) => void }} deps */
  constructor(gl, deps) {
    this.gl = gl;
    this.deps = deps;
    this.masks = new Map(); // key -> { box, bytes, layer (-1: none now), used }
    this._layers = 0; // layers ever given out; a freed one waits in _free
    this._free = [];
    this._holder = []; // layer -> the mask on it
    this._mipsDirty = false;
    this.sources = { street: new Map(), inside: new Map() }; // mesh -> [{ m, remap, seen, subs }]
    this.data = new Float32Array(WL_MAX_LIGHTS * WL_VEC4 * 4);
    this.boxes = new Float32Array(WL_MAX_LIGHTS * LC_BOX); // LIGHT-REACH: each light's reach as a box, for the grid
    this.space = createClusterSpace(WL_MAX_LIGHTS);
    this.farBoxes = new Float32Array(WL_FAR_MAX * LC_BOX); // LIGHT-REACH: the far rows' boxes and band
    this.farSpace = createClusterSpace(WL_FAR_MAX);
    this.count = 0;
    this.farData = new Float32Array((WL_FAR_MAX * WL_VEC4 + 2) * 4); // LIGHT-REACH: the far rows, then the frame's two words
    this.farCount = 0;
    this._cutFar = WL_FAR_GATHER;
    this._farCand = []; // the rows near enough this frame: { row, dMin, dMax, mask, s, sub, ci, t }, from _farPool
    this._farPool = [];
    this._farUsed = 0;
    this._fd = new Float32Array(WL_FAR_MAX); // each written row's nearest tile, for the far cut on an overflow
    this._farKeys = new Float64Array(1024); // AUDIT LIGHT-REACH W5: the gathered rows' sort keys (nearest tile, then index)
    this._fitCut = { street: Infinity, inside: Infinity, far: Infinity }; // AUDIT LIGHT-REACH W1: each band's cut at its last overflow
    this._fitAt = { street: -Infinity, inside: -Infinity, far: -Infinity };
    this._rt = lightRec(); // a row's first tile, as a light, while its record is made
    this.outside = null; // { at, sunDir, sunColor, sunScale, moonDir, moonColor, moonScale, sky } - display colours
    this._cuts = { street: WL_GATHER, inside: WL_GATHER }; // each kind's own cut and clock: a building's frame
    this._at = { street: 0, inside: 0 }; // draws the view out's street between two of its own
    this._cand = [];
    this._pool = []; // the candidates' records, the frame's to reuse
    this._used = 0;
    this._pending = []; // cells near enough not yet built: { d, s, sub, p, ci }, reused
    this._pendN = 0;
    this._ld = new Float32Array(WL_MAX_LIGHTS); // each written light's distance, for the cut on an overflow
    this._lf = new Float32Array(WL_MAX_LIGHTS); // AUDIT LIGHT-REACH W1: and its fade, so an overflow's cut refades it
    this._lt = lightRec(); // the light being written, and a curtained window's whole glass
    this._whole = lightRec();
    this._v = [0, 0, 0];
    this.stats = { lights: 0, candidates: 0, cells: 0, walked: 0, built: 0, dropped: 0, far: 0, rows: 0 }; // walked: the tiles a gather measured; built: their world data made; dropped: past the list; far: rows lit; rows: rows gathered
    this.tex = null;
    this.ubo = null;
    this.farUbo = null;
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
    this.farUbo = gl.createBuffer(); // LIGHT-REACH: the far rows' block, as the near one
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.farUbo);
    gl.bufferData(gl.UNIFORM_BUFFER, this.farData.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, WL_FAR_UBO_BINDING, this.farUbo);
  }

  /** The masks' array, made with the first mask: a renderer that never meets a window holds none. */
  _ensureMasks() {
    if (this.tex) return;
    const gl = this.gl;
    this.tex = gl.createTexture();
    this.deps.activeTexture(gl.TEXTURE0 + WL_MASK_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texStorage3D(
      gl.TEXTURE_2D_ARRAY,
      Math.log2(WL_MASK_SIZE) + 1,
      gl.R8,
      WL_MASK_SIZE,
      WL_MASK_SIZE,
      WL_MASK_LAYERS,
    );
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
    if (k.layer >= 0) {
      this._holder[k.layer] = null;
      this._free.push(k.layer);
    }
    this.masks.delete(key);
  }

  /** A mask on a layer for this frame's light: its own, a free one, or that of the mask read least lately of those this
   *  frame has not read - from the bytes kept, so no picture is ever lost. False when every layer is this frame's. */
  _resident(k, now) {
    if (k.layer >= 0) {
      k.used = now;
      return true;
    }
    let layer = this._free.length
      ? /** @type {number} */ (this._free.pop())
      : this._layers < WL_MASK_LAYERS
        ? this._layers++
        : -1;
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
    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      0,
      0,
      layer,
      WL_MASK_SIZE,
      WL_MASK_SIZE,
      1,
      gl.RED,
      gl.UNSIGNED_BYTE,
      k.bytes,
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    this.deps.activeTexture(gl.TEXTURE0);
    this._holder[layer] = k;
    k.layer = layer;
    k.used = now;
    this._mipsDirty = true;
    return true;
  }

  /** A mesh drawn in a frame of `kind` ('street' or 'inside') at `m`, its pictures through `remap`: kept as a source of
   *  window light for WL_HOLD_MS. A placement is one source however often it is drawn. */
  note(mesh, m, remap, kind, now) {
    const map = this.sources[kind];
    let list = map.get(mesh);
    if (!list) map.set(mesh, (list = Object.assign([], { hint: 0 })));
    const n = list.length;
    let moved = null,
      near = WL_MOVE_REACH * WL_MOVE_REACH;
    for (let j = 0; j < n; j++) {
      // from where the last draw matched: a frame draws its placements in the same order
      const at = (list.hint + j) % n,
        s = list[at];
      const dx = s.m[12] - m[12],
        dy = s.m[13] - m[13],
        dz = s.m[14] - m[14];
      if (
        Math.abs(dx) < 1e-3 &&
        Math.abs(dy) < 1e-3 &&
        Math.abs(dz) < 1e-3 &&
        Math.abs(s.m[0] - m[0]) < 1e-5 &&
        Math.abs(s.m[2] - m[2]) < 1e-5
      ) {
        s.seen = now;
        s.remap = remap;
        list.hint = (at + 1) % n;
        return;
      }
      const d2 = dx * dx + dy * dy + dz * dz;
      if (s.seen !== now && d2 < near) {
        near = d2;
        moved = s;
      }
    }
    if (moved) {
      moved.m.set(m);
      moved.subs = null;
      moved.seen = now;
      moved.remap = remap;
      return;
    } // a mover: its windows go with it
    if (n < WL_PLACEMENTS_MAX) list.push({ m: Float32Array.from(m), remap, seen: now, subs: null });
  }

  /** A mesh let go: none of its windows lights. */
  forget(mesh) {
    this.sources.street.delete(mesh);
    this.sources.inside.delete(mesh);
  }

  /** The floating origin moved by `offset`: every kept placement follows it. */
  shift(offset) {
    for (const map of Object.values(this.sources))
      for (const list of map.values())
        for (const s of list) {
          s.m[12] += offset[0];
          s.m[13] += offset[1];
          s.m[14] += offset[2];
          if (s.subs)
            for (const p of s.subs)
              if (p) {
                for (let i = 0; i < p.ball.length; i += 4) {
                  p.ball[i] += offset[0];
                  p.ball[i + 1] += offset[1];
                  p.ball[i + 2] += offset[2];
                }
                p.all[0] += offset[0];
                p.all[1] += offset[1];
                p.all[2] += offset[2];
                for (const t of p.tiles)
                  if (t) {
                    for (let i = 0; i < t.cent.length; i += 3) {
                      t.cent[i] += offset[0];
                      t.cent[i + 1] += offset[1];
                      t.cent[i + 2] += offset[2];
                    }
                    for (const r of t.rows) r.mask = null; // LIGHT-REACH: a row's record is in the world - made again
                  }
              }
        }
  }

  /** The outside's light as a building's frame sees it through its glass (the clock's, the weather's). */
  setOutside(o) {
    this.outside = o;
  }

  /** Is the sun (or the moon) up outside and facing glass this frame could light - a building's, with its mask, within
   *  the gather of `eye` (`glass(key)` the renderer's word on a key's glass) - the direction toward it, or null. The
   *  frame's shadow pass draws its map for this.
   *  @param {number[]} eye @param {number} now @param {(key: string) => any} [glass] */
  sunFor(eye, now, glass = () => 'glass') {
    const o = this.outside;
    if (!o) return null;
    const dir = wlSunUp(o) ? o.sunDir : o.moonScale > 0 && o.moonDir[1] > 0.05 ? o.moonDir : null;
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
            const first = sub.cells[ci * APERTURE_CELL_REC + 4],
              n = sub.cells[ci * APERTURE_CELL_REC + 5];
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
   * or a hole) or null. `dayOnly` the Window light part's Day only: no moon, the rest faded by the day's share. Fills
   * the block, the boxes and the grid space; answers the count.
   */
  frame({ kind, eye, view, proj, now, lamp = null, shadows = false, glass, decode = null, dayOnly = false }) {
    const cand = this._cand;
    cand.length = 0;
    this._used = 0;
    this._pendN = 0;
    this._farUsed = 0;
    this.stats.walked = 0;
    this.stats.built = 0;
    let gathered = 0;
    const o = this.outside;
    const sunDir = wlSunUp(o) ? o.sunDir : null;
    const moonDir = !sunDir && !dayOnly && o && o.moonScale > 0 && o.moonDir[1] > 0.05 ? o.moonDir : null;
    // AUDIT FB1031 L1: the glow's gain by the day's share, and Day only's whole light faded by it (never the moon's)
    const share = wlDayShare(o),
      dim = dayOnly ? share : 1;
    const keyGain = (sunDir ? WL_SUN_GAIN : WL_MOON_GAIN) * dim,
      glowGain = wlGlowGain(share) * dim;
    // the colours as the set lights in: decoded first, then scaled (the lane decodes a colour and multiplies its scale)
    const dec = (c) => (decode ? decode(c) : [c[0], c[1], c[2]]);
    const lampC = lamp ? dec(lamp) : null;
    const keyC = o
      ? sunDir
        ? dec(o.sunColor).map((v) => v * o.sunScale)
        : moonDir
          ? dec(o.moonColor).map((v) => v * o.moonScale)
          : null
      : null;
    const skyC = o ? dec(o.sky) : null;
    if (kind === 'street' ? !!lamp : !!o) {
      for (const [mesh, list] of this.sources[kind]) {
        if (mesh._dead || !mesh.wl) {
          this.sources[kind].delete(mesh);
          continue;
        }
        for (let li = list.length - 1; li >= 0; li--) {
          const s = list[li];
          if (now - s.seen > WL_HOLD_MS) {
            list.splice(li, 1);
            continue;
          }
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
    const want = Math.min(n < cand.length ? cand[n - 1].d : WL_GATHER, this._held(kind, now));
    const dt = this._at[kind] ? Math.max(0, Math.min(0.25, (now - this._at[kind]) / 1000)) : 0;
    this._at[kind] = now;
    this._cuts[kind] = dt > 0 ? this._cuts[kind] + (want - this._cuts[kind]) * (1 - Math.exp(-WL_CUT_EASE * dt)) : want;
    // AUDIT LIGHT-REACH W2: never past the first tile the block leaves out - one inside the cut and not written lost its
    // fade's share whole, and its far row (which takes the rest) did not make it up
    if (n < cand.length) this._cuts[kind] = Math.min(this._cuts[kind], cand[n].d);
    let cut = Math.min(this._cuts[kind], WL_GATHER);
    let w = 0;
    this.stats.dropped = 0;
    for (let i = 0; i < n; i++) {
      const c = cand[i];
      if (c.d >= cut) break;
      const fade = wlFade(c.d, cut);
      if (!this._resident(c.mask, now)) continue; // every layer read this frame already
      const l =
        kind === 'street'
          ? this._lampLight(c, lampC, fade)
          : this._sunLight(c, sunDir ?? moonDir, keyGain, glowGain, keyC, skyC, shadows, fade);
      if (!l) continue;
      writeWindowLight(this.data, w, l);
      windowLightBox(l, l.beam, this.boxes, w * LC_BOX);
      this._ld[w] = c.d;
      this._lf[w] = fade;
      w++;
    }
    // more cells than the band's list holds: the nearest that fit (the lights stand nearest first), never none - and
    // the cut comes in to the first left out. AUDIT LIGHT-REACH W1: THIS frame - the kept refaded to it, the far rows
    // given it - or a tile left out lost its light while its row took only the old fade's rest
    const fit = this._fitBand(this.boxes, w, view, proj, this.space, (f) => {
      this._cuts[kind] = Math.min(this._cuts[kind], this._ld[f]);
    });
    if (fit < w) {
      cut = this._ld[fit];
      for (let i = 0; i < fit; i++) scaleWindowLight(this.data, i, wlFade(this._ld[i], cut) / this._lf[i]);
      this._fitCut[kind] = cut;
      this._fitAt[kind] = now;
    }
    w = fit;
    // LIGHT-REACH: the far rows past the near cut's fade, in a band of their own, fitted to it the same way - their cut
    // a word of the far block, written again when the fit comes in
    const asked = kind === 'street' && lampC ? this._farFrame(eye, cut, lampC, now, dt) : 0;
    const wf = this._fitBand(this.farBoxes, asked, view, proj, this.farSpace, (f) => {
      this._cutFar = Math.min(this._cutFar, this._fd[f]);
      this.farData[WL_FAR_MAX * WL_VEC4 * 4 + 7] = this._cutFar;
      this._fitCut.far = this._cutFar;
      this._fitAt.far = now;
    });
    if (this._mipsDirty) {
      // the layers put up this frame, their mips once - AUDIT LIGHT-REACH W4: the far rows' too
      const gl = this.gl;
      this.deps.activeTexture(gl.TEXTURE0 + WL_MASK_UNIT);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      this.deps.activeTexture(gl.TEXTURE0);
      this._mipsDirty = false;
    }
    this.count = w;
    this.farCount = wf;
    this.stats.lights = w;
    this.stats.far = wf;
    if (!w && !wf) return 0;
    this.stats.cells = this.space.total;
    const gl = this.gl;
    this._ensureBlock();
    if (w) {
      // the lights written, not the whole block (a length of 0 copies all of it)
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.data, 0, w * WL_VEC4 * 4);
    }
    if (wf) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.farUbo);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.farData, 0, wf * WL_VEC4 * 4);
      gl.bufferSubData(gl.UNIFORM_BUFFER, WL_FAR_MAX * WL_VEC4 * 16, this.farData, WL_FAR_MAX * WL_VEC4 * 4, 8);
    }
    return w + wf;
  }

  /** AUDIT LIGHT-REACH W1: how far a band's cut may ease out (`kind`: street, inside or far) - where its list last
   *  overflowed, for WL_FIT_HOLD_MS. */
  _held(kind, now) {
    return now - this._fitAt[kind] < WL_FIT_HOLD_MS ? this._fitCut[kind] : Infinity;
  }

  /** A band's lights into its grid: the nearest `n` that fit its list (`cut(fit)` told the first left out), an empty
   *  band's grid emptied so no cell lists last frame's lights. Answers how many stand. */
  _fitBand(boxes, n, view, proj, space, cut) {
    let fit = n;
    while (fit > 0 && !buildLightClusterBoxes(boxes, fit, view, proj, space))
      fit = Math.min(fit - 1, Math.floor(((fit * CLUSTER_LIST_CAP) / space.need) * 0.9));
    if (!fit) buildLightClusterBoxes(boxes, 0, view, proj, space);
    if (fit < n) {
      cut(fit);
      this.stats.dropped += n - fit;
    }
    return fit;
  }

  /** LIGHT-REACH: THE FAR TIER'S ROWS - those the gather found with a lit tile past the near fade's start (`cut`'s
   *  WL_FADE_FROM), the nearest WL_FAR_MAX by their nearest tile, their cut easing as the near one's does - into the far
   *  block and their boxes, the frame's two words last. Answers the rows written. */
  _farFrame(eye, cut, lamp, now, dt) {
    const fc = this._farCand,
      pool = this._farPool,
      from = cut * WL_FADE_FROM;
    // AUDIT LIGHT-REACH W5: ordered by keys in a typed array - nearest tile, then the pool's index - not a comparator's
    // sort, whose copies were a fifth of the pass's garbage a frame
    if (this._farKeys.length < this._farUsed) this._farKeys = new Float64Array(2 * this._farUsed);
    const keys = this._farKeys;
    let n = 0;
    for (let i = 0; i < this._farUsed; i++)
      if (pool[i].dMax > from) keys[n++] = Math.floor(pool[i].dMin * WL_FAR_KEY) * WL_FAR_KEY_N + i;
    keys.subarray(0, n).sort();
    for (let i = 0; i < n; i++) fc[i] = pool[keys[i] % WL_FAR_KEY_N];
    this.stats.rows = n;
    const keep = Math.min(n, WL_FAR_MAX);
    const want = Math.min(keep < n ? fc[keep - 1].dMin : WL_FAR_GATHER, this._held('far', now));
    this._cutFar = dt > 0 ? this._cutFar + (want - this._cutFar) * (1 - Math.exp(-WL_CUT_EASE * dt)) : want;
    if (keep < n) this._cutFar = Math.min(this._cutFar, fc[keep].dMin); // AUDIT LIGHT-REACH W2: as the near cut's
    const cutF = Math.min(this._cutFar, WL_FAR_GATHER);
    let w = 0;
    for (let i = 0; i < keep; i++) {
      const c = fc[i];
      if (c.dMin >= cutF) break;
      if (
        !this._resident(c.mask, now) ||
        !this._rowRecord(c) ||
        !rowBox(c.row, eye, from, cutF, this.farBoxes, w * LC_BOX)
      )
        continue;
      const rec = c.row.rec;
      rec[23] = c.mask.layer + 256 * WL_KIND.row;
      this.farData.set(rec, w * WL_VEC4 * 4);
      this._fd[w] = c.dMin;
      w++;
    }
    const h = WL_FAR_MAX * WL_VEC4 * 4,
      F = this.farData;
    F[h] = eye[0];
    F[h + 1] = eye[1];
    F[h + 2] = eye[2];
    F[h + 3] = cut;
    F[h + 4] = lamp[0] * WL_LAMP_GOBO;
    F[h + 5] = lamp[1] * WL_LAMP_GOBO;
    F[h + 6] = lamp[2] * WL_LAMP_GOBO;
    F[h + 7] = cutF;
    return w;
  }

  /** One placement's windows into `cand`: every tile near enough whose picture has glass of the frame's kind on the
   *  share of it the mesh covers - walked by the cells near the eye, a placement past the reach by one check. A cell
   *  not yet built waits for _buildPending. */
  _gather(mesh, s, kind, eye, glass, cand) {
    let n = 0;
    const reach = kind === 'street' ? WL_FAR_GATHER : WL_GATHER; // LIGHT-REACH: a street's rows reach past its tiles
    for (let si = 0; si < mesh.wl.length; si++) {
      const sub = mesh.wl[si];
      const key = s.remap && s.remap.has(sub.key) ? s.remap.get(sub.key) : sub.key;
      const g = glass(key);
      if (!g || (kind === 'street' && g !== 'window')) continue;
      const mask = this.masks.get(key);
      if (!mask) continue;
      const p = this._cellsOf(s, si, sub);
      if (pastBall(p.all, 0, eye, reach)) continue;
      for (let ci = 0; ci < p.tiles.length; ci++) {
        if (pastBall(p.ball, ci * 4, eye, reach)) continue;
        if (p.tiles[ci]) {
          n += this._gatherBuilt(s, sub, p, ci, mask, kind, eye, cand);
          continue;
        }
        const q = (this._pending[this._pendN] ??= { d: 0, s: null, sub: null, p: null, ci: 0, mask: null });
        this._pendN++;
        q.d = Math.hypot(p.ball[ci * 4] - eye[0], p.ball[ci * 4 + 1] - eye[1], p.ball[ci * 4 + 2] - eye[2]);
        q.s = s;
        q.sub = sub;
        q.p = p;
        q.ci = ci;
        q.mask = mask;
      }
    }
    return n;
  }

  /** LIGHT-REACH: a built cell into the frame - its tiles as the near tier's candidates while the cell is within
   *  WL_GATHER, and on the street its rows as the far tier's. */
  _gatherBuilt(s, sub, p, ci, mask, kind, eye, cand) {
    const b = p.ball,
      i = ci * 4,
      d = len3(b[i] - eye[0], b[i + 1] - eye[1], b[i + 2] - eye[2]) - b[i + 3];
    const n = d > WL_GATHER ? 0 : this._gatherCell(s, sub, p.tiles[ci], ci, mask, kind, eye, cand);
    if (kind === 'street') this._gatherRows(s, sub, p.tiles[ci], ci, mask, eye);
    return n;
  }

  /** LIGHT-REACH: a built cell's rows with a lit tile, each by its nearest and farthest tile (the coverage centres: a
   *  row's are on one line, its ends the farthest), within WL_FAR_GATHER. */
  _gatherRows(s, sub, t, ci, mask, eye) {
    const P = t.cent;
    for (const row of t.rows) {
      if (!row.lit) continue;
      const a = row.js[0] * 3,
        b = row.js[row.js.length - 1] * 3;
      const ax = P[a] - eye[0],
        ay = P[a + 1] - eye[1],
        az = P[a + 2] - eye[2];
      const ex = P[b] - P[a],
        ey = P[b + 1] - P[a + 1],
        ez = P[b + 2] - P[a + 2];
      const L2 = ex * ex + ey * ey + ez * ez,
        k = L2 > 0 ? Math.max(0, Math.min(1, -(ax * ex + ay * ey + az * ez) / L2)) : 0;
      const dMin = len3(ax + ex * k, ay + ey * k, az + ez * k);
      if (dMin > WL_FAR_GATHER || this._farUsed >= WL_FAR_KEY_N) continue;
      const c = (this._farPool[this._farUsed] ??= {
        row: null,
        dMin: 0,
        dMax: 0,
        mask: null,
        s: null,
        sub: null,
        ci: 0,
        t: null,
      });
      this._farUsed++;
      c.row = row;
      c.dMin = dMin;
      c.dMax = Math.max(len3(ax, ay, az), len3(ax + ex, ay + ey, az + ez));
      c.mask = mask;
      c.s = s;
      c.sub = sub;
      c.ci = ci;
      c.t = t;
    }
  }

  /** One built cell's tiles into `cand`. */
  _gatherCell(s, sub, t, ci, mask, kind, eye, cand) {
    let n = 0;
    const ap = sub.ap,
      box = mask.box,
      first = sub.cells[ci * APERTURE_CELL_REC + 4],
      P = t.cent;
    this.stats.walked += t.street.length;
    for (let j = 0; j < t.street.length; j++) {
      if (kind === 'street' && !t.street[j]) continue; // a dark room throws nothing; glass in a roof shows no room
      const k = (first + j) * WL_REC;
      if (!(
        Math.min(ap[k + 16], box[2]) - Math.max(ap[k + 14], box[0]) > 1e-3 &&
        Math.min(ap[k + 17], box[3]) - Math.max(ap[k + 15], box[1]) > 1e-3
      ))
        continue; // no glass on its share
      const d = Math.hypot(P[3 * j] - eye[0], P[3 * j + 1] - eye[1], P[3 * j + 2] - eye[2]);
      if (d > WL_GATHER) continue;
      const c = (this._pool[this._used] ??= { d: 0, s: null, ap: null, k: 0, j: 0, t: null, mask: null });
      this._used++;
      c.d = d;
      c.s = s;
      c.ap = ap;
      c.k = k;
      c.j = j;
      c.t = t;
      c.mask = mask;
      cand.push(c);
      n++;
    }
    return n;
  }

  /** The cells the gather found unbuilt, the nearest first, built up to WL_BUILD_TILES tiles (one cell at least) and
   *  walked this frame; the rest wait for the next. Answers the candidates they added. */
  _buildPending(kind, eye, cand) {
    const n = this._pendN,
      list = this._pending;
    let added = 0,
      built = 0;
    if (n > 1) {
      const live = list.slice(0, n).sort(byDistance);
      for (let i = 0; i < n; i++) list[i] = live[i];
    }
    for (let i = 0; i < n; i++) {
      const q = list[i];
      if (!q.p.tiles[q.ci] && (built === 0 || built < WL_BUILD_TILES)) {
        q.p.tiles[q.ci] = this._cellTiles(q.s, q.sub, q.ci);
        built += q.sub.cells[q.ci * APERTURE_CELL_REC + 5];
        added += this._gatherBuilt(q.s, q.sub, q.p, q.ci, q.mask, kind, eye, cand);
      }
      q.s = null;
      q.sub = null;
      q.p = null;
      q.mask = null;
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
    const C = sub.cells,
      nc = C.length / APERTURE_CELL_REC,
      m = s.m,
      sc = Math.hypot(m[0], m[1], m[2]);
    p = { ball: new Float64Array(4 * nc), all: new Float64Array(4), tiles: new Array(nc).fill(null) };
    const B = p.ball,
      A = p.all;
    for (let c = 0; c < nc; c++) {
      xfTo(B, 4 * c, m, C[c * APERTURE_CELL_REC], C[c * APERTURE_CELL_REC + 1], C[c * APERTURE_CELL_REC + 2], 1);
      B[4 * c + 3] = C[c * APERTURE_CELL_REC + 3] * sc;
      A[0] += B[4 * c] / nc;
      A[1] += B[4 * c + 1] / nc;
      A[2] += B[4 * c + 2] / nc;
    }
    for (let c = 0; c < nc; c++)
      A[3] = Math.max(A[3], Math.hypot(B[4 * c] - A[0], B[4 * c + 1] - A[1], B[4 * c + 2] - A[2]) + B[4 * c + 3]);
    s.subs[si] = p;
    return p;
  }

  /** One cell's tiles in the world: each covered centre, its unit normal, whether a street's lamp lights it (its room
   *  lit by the mock rooms' own seed, realWindows.js rwSeedBits - the normal in quarters and the plane off the model's
   *  own frame - and its glass in a wall, not a roof) and its curtains. */
  _cellTiles(s, sub, ci) {
    const ap = sub.ap,
      first = sub.cells[ci * APERTURE_CELL_REC + 4],
      T = sub.cells[ci * APERTURE_CELL_REC + 5],
      m = s.m,
      v = this._v;
    const t = {
      cent: new Float32Array(3 * T),
      nrm: new Float32Array(3 * T),
      street: new Uint8Array(T),
      curtains: new Array(T).fill(null),
    };
    const q = (x) => Math.floor(x * 4 + 0.5);
    for (let j = 0; j < T; j++) {
      const k = (first + j) * WL_REC;
      const cu = 0.5 * (ap[k + 14] + ap[k + 16]),
        cv = 0.5 * (ap[k + 15] + ap[k + 17]); // the covered share's centre
      xfTo(
        t.cent,
        3 * j,
        m,
        ap[k + 2] + ap[k + 5] * cu + ap[k + 8] * cv,
        ap[k + 3] + ap[k + 6] * cu + ap[k + 9] * cv,
        ap[k + 4] + ap[k + 7] * cu + ap[k + 10] * cv,
        1,
      );
      xfTo(v, 0, m, ap[k + 11], ap[k + 12], ap[k + 13], 0);
      const nl = Math.hypot(v[0], v[1], v[2]) || 1;
      const nx = v[0] / nl,
        ny = v[1] / nl,
        nz = v[2] / nl;
      t.nrm[3 * j] = nx;
      t.nrm[3 * j + 1] = ny;
      t.nrm[3 * j + 2] = nz;
      xfTo(
        v,
        0,
        m,
        ap[k + 2] + ap[k + 5] * cu + ap[k + 8] * cv,
        ap[k + 3] + ap[k + 6] * cu + ap[k + 9] * cv,
        ap[k + 4] + ap[k + 7] * cu + ap[k + 10] * cv,
        0,
      ); // the glass's middle, off the model's own (uModel[3])
      const plane = Math.floor((nx * v[0] + ny * v[1] + nz * v[2]) * 40 + 0.5);
      const h = roomSeedBits(q(nx), q(ny), q(nz), plane, ap[k], ap[k + 1]);
      t.street[j] = roomLitAt(h) && Math.abs(ny) <= 0.5 ? 1 : 0;
      const cb = curtainBitsOf(h);
      if (roomCurtained(cb)) t.curtains[j] = curtainEdges(cb);
    }
    t.rows = cellRows(ap, first, t); // LIGHT-REACH: the far tier's runs of this cell's tiles
    return t;
  }

  /** LIGHT-REACH: a far candidate's row record and box (WL_VEC4 vec4s, LC_BOX floats), made from its first tile and the
   *  mask's glass, kept with the row until the mask or the floating origin changes. False when no glass is on its share. */
  _rowRecord(c) {
    const { row, s, sub, ci, t, mask } = c;
    if (row.mask === mask) return row.ok;
    row.mask = mask;
    const ap = sub.ap,
      k = (sub.cells[ci * APERTURE_CELL_REC + 4] + row.js[0]) * WL_REC,
      m = s.m,
      box = mask.box,
      l = this._rt,
      j0 = row.js[0];
    const u0 = Math.max(ap[k + 14], box[0]),
      u1 = Math.min(ap[k + 16], box[2]),
      v0 = Math.max(ap[k + 15], box[1]),
      v1 = Math.min(ap[k + 17], box[3]);
    row.ok = false;
    if (!(u1 - u0 > 1e-3 && v1 - v0 > 1e-3)) return false;
    const du = u1 - u0,
      dv = v1 - v0,
      um = 0.5 * (u0 + u1),
      vm = 0.5 * (v0 + v1);
    xfTo(l.U, 0, m, ap[k + 5] * du, ap[k + 6] * du, ap[k + 7] * du, 0);
    xfTo(l.V, 0, m, ap[k + 8] * dv, ap[k + 9] * dv, ap[k + 10] * dv, 0);
    xfTo(
      l.c,
      0,
      m,
      ap[k + 2] + ap[k + 5] * um + ap[k + 8] * vm,
      ap[k + 3] + ap[k + 6] * um + ap[k + 9] * vm,
      ap[k + 4] + ap[k + 7] * um + ap[k + 10] * vm,
      1,
    );
    set3(l.nf, t.nrm[3 * j0], t.nrm[3 * j0 + 1], t.nrm[3 * j0 + 2]);
    const U = l.U,
      V = l.V;
    l.area = Math.hypot(U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]);
    if (!(l.area > 1e-6 && l.area < 400)) return false;
    l.uv[0] = um;
    l.uv[1] = vm;
    l.uv[2] = du;
    l.uv[3] = dv;
    l.halfDiag = 0.5 * Math.hypot(U[0] + V[0], U[1] + V[1], U[2] + V[2]);
    lampOf(l.c, l.nf, V, l.src);
    l.kind = WL_KIND.lamp;
    l.reach = WL_LAMP_RANGE;
    l.layer = 0;
    const rec = (row.rec ??= new Float32Array(WL_VEC4 * 4));
    writeWindowLight(rec, 0, l);
    // tile j's glass centre and lamp: tile 0's plus PU j; the fade reads tile j's coverage centre, G0 plus this offset
    const PU = this._v;
    xfTo(PU, 0, m, ap[k + 5], ap[k + 6], ap[k + 7], 0);
    rec[20] = PU[0];
    rec[21] = PU[1];
    rec[22] = PU[2];
    rec[24] = t.cent[3 * j0] - l.c[0];
    rec[25] = t.cent[3 * j0 + 1] - l.c[1];
    rec[26] = t.cent[3 * j0 + 2] - l.c[2];
    rec[27] = row.states;
    const b = (row.box ??= new Float32Array(LC_BOX)),
      n1 = row.js.length - 1;
    windowLightBox(l, true, b, 0, false);
    // the box of tile 0's beam, carried along the row: its centre by half the run, its u half-axis grown by as much
    const ha = Math.hypot(b[3], b[4], b[5]),
      grow = 0.5 * n1 * Math.hypot(PU[0], PU[1], PU[2]);
    b[0] += PU[0] * 0.5 * n1;
    b[1] += PU[1] * 0.5 * n1;
    b[2] += PU[2] * 0.5 * n1;
    if (ha > 0) {
      const g = (ha + grow) / ha;
      b[3] *= g;
      b[4] *= g;
      b[5] *= g;
    }
    row.ha = ha;
    row.pu = Math.hypot(PU[0], PU[1], PU[2]); // AUDIT LIGHT-REACH W6: for the frame's own run (rowBox)
    row.ok = true;
    return true;
  }

  /** The aperture of a candidate in the world, into `o`: the tile's glass box under the share the mesh covers, `clip`
   *  the curtains' edges (or null) - its centre, spans, normal, area and mask uv. False when nothing is left. */
  _aperture(c, clip, o) {
    const { ap, k, s, mask, t, j } = c,
      m = s.m;
    let u0 = Math.max(ap[k + 14], mask.box[0]),
      u1 = Math.min(ap[k + 16], mask.box[2]);
    const v0 = Math.max(ap[k + 15], mask.box[1]),
      v1 = Math.min(ap[k + 17], mask.box[3]);
    if (clip) {
      u0 = Math.max(u0, clip[0]);
      u1 = Math.min(u1, clip[1]);
    }
    if (!(u1 - u0 > 1e-3 && v1 - v0 > 1e-3)) return false;
    const du = u1 - u0,
      dv = v1 - v0,
      um = 0.5 * (u0 + u1),
      vm = 0.5 * (v0 + v1);
    const U = o.U,
      V = o.V;
    xfTo(U, 0, m, ap[k + 5] * du, ap[k + 6] * du, ap[k + 7] * du, 0);
    xfTo(V, 0, m, ap[k + 8] * dv, ap[k + 9] * dv, ap[k + 10] * dv, 0);
    xfTo(
      o.c,
      0,
      m,
      ap[k + 2] + ap[k + 5] * um + ap[k + 8] * vm,
      ap[k + 3] + ap[k + 6] * um + ap[k + 9] * vm,
      ap[k + 4] + ap[k + 7] * um + ap[k + 10] * vm,
      1,
    );
    set3(o.nf, t.nrm[3 * j], t.nrm[3 * j + 1], t.nrm[3 * j + 2]);
    o.area = Math.hypot(U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]);
    if (!(o.area > 1e-6 && o.area < 400)) return false; // no plane to cross (the duals NaN), or a mapping past reason
    o.uv[0] = um;
    o.uv[1] = vm;
    o.uv[2] = du;
    o.uv[3] = dv;
    o.halfDiag = 0.5 * Math.hypot(U[0] + V[0], U[1] + V[1], U[2] + V[2]);
    return true;
  }

  /** A lit room's light through its window (the frame's one record, rewritten for each). */
  _lampLight(c, lamp, fade) {
    const l = this._lt,
      curtains = c.t.curtains[c.j];
    if (!this._aperture(c, curtains, l)) return null;
    const whole = curtains && this._aperture(c, null, this._whole) ? this._whole : null;
    if (whole) l.area += (whole.area - l.area) * WL_CURTAIN_PASS;
    // AUDIT LIGHT-REACH W3: the room's lamp behind the whole glass - a curtain hides it, it does not move it (and the far
    // row hangs it there: the gap's middle made the pool jump sideways at the hand-over)
    lampOf(whole ? whole.c : l.c, l.nf, l.V, l.src);
    const kg = WL_LAMP_GOBO * fade,
      ks = WL_LAMP_SPILL * fade;
    set3(l.gobo, lamp[0] * kg, lamp[1] * kg, lamp[2] * kg);
    set3(l.spill, lamp[0] * ks, lamp[1] * ks, lamp[2] * ks);
    l.kind = WL_KIND.lamp;
    l.layer = c.mask.layer;
    l.reach = WL_LAMP_RANGE;
    l.beam = true;
    return l;
  }

  /** The sun's or the moon's light through a building's glass (`key`, toward `dir`, at `keyGain`), and the sky's glow off
   *  it (`sky`, at `glowGain`) - null when neither reaches. */
  _sunLight(c, dir, keyGain, glowGain, key, sky, shadows, fade) {
    const l = this._lt;
    if (!this._aperture(c, null, l)) return null;
    const faces = !!dir && !!key && dir[0] * l.nf[0] + dir[1] * l.nf[1] + dir[2] * l.nf[2] < -0.02;
    const kg = faces ? keyGain * fade : 0,
      ks = glowGain * fade;
    if (faces) set3(l.gobo, key[0] * kg, key[1] * kg, key[2] * kg);
    else set3(l.gobo, 0, 0, 0);
    set3(l.spill, sky[0] * ks, sky[1] * ks, sky[2] * ks);
    if (!(l.gobo[0] + l.gobo[1] + l.gobo[2] + l.spill[0] + l.spill[1] + l.spill[2] > 1e-4)) return null;
    if (faces) set3(l.src, dir[0], dir[1], dir[2]);
    else set3(l.src, 0, 1, 0);
    l.kind = shadows ? WL_KIND.sun : WL_KIND.sunBare;
    l.layer = c.mask.layer;
    // the beam runs into the room, away from the sun, its reach long; a pane the sun does not face only glows
    l.reach = faces ? WL_SUN_REACH : WL_SPILL_REACH;
    l.beam = faces;
    return l;
  }

  /** The frame's grid space, its rows for the renderer's upload into LC1's band. */
  get grid() {
    return this.space;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the array and the block. */
  release() {
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.ubo) gl.deleteBuffer(this.ubo);
    if (this.farUbo) gl.deleteBuffer(this.farUbo);
    this.tex = null;
    this.ubo = null;
    this.farUbo = null;
    // AUDIT LIGHT-REACH W7: the free list and the holders go with the layers - kept, a freed layer was given out again
    // beside the counter's own count of it (two masks on one layer)
    this.masks.clear();
    this._layers = 0;
    this._free.length = 0;
    this._holder.length = 0;
  }
}
