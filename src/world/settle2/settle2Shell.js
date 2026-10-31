// @ts-check
// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements"): A WORLD 2.0 BUILDING'S SHELL - walls, roof and
// footing made from its prefab's numbers (prefabs.json's 'massing'), as a model family (world/customModels.js). The id is
// the shape, never the building: one GPU mesh serves every building of that shape. The frame is its subrecord's: the door
// at the origin facing -z, x along the front, z in from it, y up from the floor. Pictures are Daggerfall's exterior sets
// under their mountain archives, swapped to the location's climate as a block's models are.
import { MeshBuilder } from '../detStandIns.js';
import { registerCustomModelFamily } from '../customModels.js';

/** The first shell id: past the Imperial City's doors (world/imperialFabricBuildings.js 7,200,000). */
export const SETTLE2_SHELL_MODEL = 8_000_000;
const CODE_BITS = 28;
/** A storey's height, metres; the step a width, a depth or a footing is kept to. */
export const SHELL_STOREY_M = 3.2;
export const SHELL_STEP_M = 0.5;
/** The wall sets by index: a city's stone, a village's half-timber, a tavern's, a temple's (TEXTURE.1xx). */
export const SHELL_WALLS = Object.freeze([112, 164, 158, 161]);
/** The roofs' set (TEXTURE.169: thatch, moss, tile, shingle) and the timber of a stilt house's legs and stair. */
export const SHELL_ROOF = 169;
const TIMBER = Object.freeze([171, 3]);
const BAY_M = 1.6;

/** @typedef {{ w: number, d: number, storeys: number, roof: number, wall: number, roofRec: number, foot: number, stilts: boolean }} ShellShape */

const steps = (m, max) => Math.max(0, Math.min(max, Math.round(m / SHELL_STEP_M)));
/** A shape's model id. Widths and depths keep half metres (1 to 63.5), a footing half metres up (0 to 15.5). @param {ShellShape} s */
export function shellModelId(s) {
  const code = Math.max(1, steps(s.w, 127)) | (Math.max(1, steps(s.d, 127)) << 7) | ((s.storeys & 7) << 14) | ((s.roof & 1) << 17)
    | ((s.wall & 3) << 18) | ((s.roofRec & 3) << 20) | (Math.min(31, Math.ceil(s.foot / SHELL_STEP_M - 1e-9)) << 22) | ((s.stilts ? 1 : 0) << 27);
  return SETTLE2_SHELL_MODEL + code;
}
/** Is a model id a shell's. @param {number} id */
export const isShellId = (id) => id >= SETTLE2_SHELL_MODEL && id < SETTLE2_SHELL_MODEL + 2 ** CODE_BITS;
/** The shape a shell id holds, or null. @param {number} id @returns {ShellShape|null} */
export function shellShapeOf(id) {
  if (!isShellId(id)) return null;
  const c = id - SETTLE2_SHELL_MODEL, S = SHELL_STEP_M;
  return { w: (c & 127) * S, d: ((c >> 7) & 127) * S, storeys: (c >> 14) & 7, roof: (c >> 17) & 1, wall: (c >> 18) & 3, roofRec: (c >> 20) & 3, foot: ((c >> 22) & 31) * S, stilts: !!((c >> 27) & 1) };
}

/** A wall's quads, bay by bay: from corner a to corner b (x, z), its outward normal n - its footing from `base` to the
 *  floor plain, then a storey at a time up to `top`; a wall's first bay its set's corner picture, the rest plain and
 *  window in turn, the door's bay plain. A picture's top row at its storey's top (v rising up it, meshReader.js's law). */
function wall(mb, set, a, b, n, base, top, door) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), bays = Math.max(1, Math.round(len / BAY_M));
  const bands = base < 0 ? [[base, 0, false]] : [];
  for (let y = 0; y < top - 1e-6; y += SHELL_STOREY_M) bands.push([y, Math.min(top, y + SHELL_STOREY_M), true]);
  for (let i = 0; i < bays; i++) {
    const t0 = i / bays, t1 = (i + 1) / bays, p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [x0, z0] = p(t0), [x1, z1] = p(t1), mid = (x0 + x1) / 2;
    for (const [y0, y1, storey] of bands) {
      const v = (y1 - y0) / SHELL_STOREY_M;
      const rec = !storey ? 2 : i === 0 ? 0 : door && y0 === 0 && Math.abs(mid) < BAY_M ? 1 : i % 2 ? 3 : 1;
      mb.quad([set, rec], [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], n, [[0, -v], [1, -v], [1, 0], [0, 0]]);
    }
  }
}
/** A box from (x0, y0, z0) to (x1, y1, z1), every face out. */
function block(mb, tex, x0, y0, z0, x1, y1, z1) {
  mb.box(tex, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], 1 / BAY_M);
}

/**
 * A SHELL'S MODEL (dfMeshToModel's shape, metres): its four walls over its storeys and down its footing, its roof - flat
 * behind a parapet, or a gable with its ridge along the front - and on stilts its legs, its deck and a stair from the
 * ground to its door. No door of its own: the door model stands at the origin (world/imperialFabricBuildings.js).
 * @param {number} id
 */
export function shellModel(id) {
  const s = shellShapeOf(id);
  if (!s) return null;
  const mb = new MeshBuilder(), set = SHELL_WALLS[s.wall], hw = s.w / 2, d = s.d, H = Math.max(1, s.storeys) * SHELL_STOREY_M;
  const base = s.stilts ? 0 : -s.foot, roofTex = [SHELL_ROOF, s.roofRec], C = [[-hw, 0], [hw, 0], [hw, d], [-hw, d]];
  const top = s.roof ? H : H + 0.5;
  // the walls: the front (its door's bay plain), the right side, the back, the left side, each seen from outside
  wall(mb, set, C[1], C[0], [0, 0, -1], base, top, true);
  wall(mb, set, C[2], C[1], [1, 0, 0], base, top, false);
  wall(mb, set, C[3], C[2], [0, 0, 1], base, top, false);
  wall(mb, set, C[0], C[3], [-1, 0, 0], base, top, false);
  if (s.roof) {
    const ov = 0.4, rise = Math.min(4, d * 0.35), ridge = H + rise, x0 = -hw - ov, x1 = hw + ov, k = ov * (rise / (d / 2));
    const slope = Math.hypot(d / 2 + ov, rise + k) / SHELL_STOREY_M, nf = norm([0, d / 2, -rise]), nb = norm([0, d / 2, rise]);
    mb.quad(roofTex, [x1, H - k, -ov], [x0, H - k, -ov], [x0, ridge, d / 2], [x1, ridge, d / 2], nf, [[0, 0], [s.w / 3.2, 0], [s.w / 3.2, -slope], [0, -slope]]);
    mb.quad(roofTex, [x0, H - k, d + ov], [x1, H - k, d + ov], [x1, ridge, d / 2], [x0, ridge, d / 2], nb, [[0, 0], [s.w / 3.2, 0], [s.w / 3.2, -slope], [0, -slope]]);
    for (const x of [-hw, hw]) mb.tri([set, 1], [x, H, 0], [x, H, d], [x, ridge, d / 2], [Math.sign(x), 0, 0], [0, -rise / SHELL_STOREY_M], [d / BAY_M, -rise / SHELL_STOREY_M], [d / BAY_M / 2, 0]);
  } else {
    mb.quad(roofTex, [-hw, H, 0], [hw, H, 0], [hw, H, d], [-hw, H, d], [0, 1, 0], [[0, 0], [s.w / 3.2, 0], [s.w / 3.2, -d / 3.2], [0, -d / 3.2]]);
    // the parapet's inner faces, seen from the roof
    const i = 0.01, y0 = H, y1 = top;
    mb.quad([set, 1], [-hw, y0, i], [hw, y0, i], [hw, y1, i], [-hw, y1, i], [0, 0, 1], [[0, -0.16], [1, -0.16], [1, 0], [0, 0]]);
    mb.quad([set, 1], [hw, y0, d - i], [-hw, y0, d - i], [-hw, y1, d - i], [hw, y1, d - i], [0, 0, -1], [[0, -0.16], [1, -0.16], [1, 0], [0, 0]]);
    mb.quad([set, 1], [hw - i, y0, 0], [hw - i, y0, d], [hw - i, y1, d], [hw - i, y1, 0], [-1, 0, 0], [[0, -0.16], [1, -0.16], [1, 0], [0, 0]]);
    mb.quad([set, 1], [-hw + i, y0, d], [-hw + i, y0, 0], [-hw + i, y1, 0], [-hw + i, y1, d], [1, 0, 0], [[0, -0.16], [1, -0.16], [1, 0], [0, 0]]);
  }
  if (s.stilts && s.foot > 0) stilts(mb, s, hw, d);
  return mb.build();
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** A stilt house's underside: a deck a hand under its floor and out past its door, a leg every bay or so, and a stair of
 *  rises under the 0.5 m a body steps (player/collider.js STEP_OFFSET) from the ground to the deck before the door. */
function stilts(mb, s, hw, d) {
  const deck = 0.25, out = 1.2, foot = s.foot;
  block(mb, TIMBER, -hw - 0.2, -deck, -out, hw + 0.2, 0, d + 0.2);
  const nx = Math.max(2, Math.round(s.w / 3) + 1), nz = Math.max(2, Math.round(d / 3) + 1);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
    const x = -hw + (s.w * i) / (nx - 1), z = (d * j) / (nz - 1);
    block(mb, TIMBER, x - 0.15, -foot - 0.3, z - 0.15, x + 0.15, -deck, z + 0.15);
  }
  const n = Math.max(1, Math.ceil(foot / 0.3)), rise = foot / n, run = 0.32;
  for (let k = 0; k < n; k++) block(mb, TIMBER, -0.7, -foot - 0.3, -out - (n - k) * run, 0.7, -foot + (k + 1) * rise, -out - (n - k - 1) * run);
}

let _installed = false;
/** The shells' family, once: solid, its pictures swapped for the climate as a block's are. */
export function installSettle2Shells() {
  if (_installed) return;
  _installed = true;
  registerCustomModelFamily({ owns: isShellId, build: shellModel, keep: 256, climateFree: false });
}
