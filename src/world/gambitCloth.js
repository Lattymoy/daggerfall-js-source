// @ts-check
// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 5.3 and 16): THE KING'S GAMBIT'S BOARD ON THE CLOTH -
// where its cells lie on a tavern card table's felt, pure (no renderer, no page): the board's lay, a cell's centre, the
// cell under a point of the table, and the way each side's cards face.
//
// THE LAY (5.3, AUDIT KG C1): along the table's own axes, square to the felt's edges, as Hold'em's board lies
// (world/card/cardTables.js tableFrame's axisYaw), its foot - the host's king's row - at the edge nearest the host's chair.
// From a long side the columns run along the table and the rows across it: KG_ROWS across the felt's short side, 7.08 cm
// cells, a board 1.06 by 0.92 m. From an end the columns run across and the rows along: KG_COLS across the short side,
// 6.13 cm cells. Column 0 is on the host's left as the host faces the board (the mod drew it on the screen's left).
// NOT CHOSEN: Iliac Hand's lay, square to the line to seat 0's chair (world/iliacCloth.js), which lies askew on the felt
// from a long side's chair.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import { CARD_TABLE_W, CARD_TABLE_D, CARD_TABLE_RAIL } from './card/cardTableProp.js';
import { KG_COLS, KG_ROWS, KG_TILE } from '../net/kingsGambit.js';
import { CARD_W, CARD_L } from './card/cardMotion.js';

/** The felt inside the rail: its long and its short side, in metres. */
export const GAMBIT_FELT_LONG = CARD_TABLE_W - 2 * CARD_TABLE_RAIL;
export const GAMBIT_FELT_SHORT = CARD_TABLE_D - 2 * CARD_TABLE_RAIL;
/** The mat stands this far proud of the felt (5.3: "a mat a few millimetres proud of the felt"), and a piece's card this
 *  far over the mat - each surface its own plane, so none flickers through another. */
export const GAMBIT_MAT_LIFT = 0.003;
export const GAMBIT_CARD_LIFT = 0.0015;

/**
 * THE BOARD ON THIS TABLE for the host in the chair at `hostFeet`: `{end, cell, top, right, toHost, width, depth, at(c,
 * r), cellAt(p), corners}` - `end` whether the host sits at an end, `cell` a cell's side in metres, `top` the mat's
 * height, `right` and `toHost` the columns' and the rows' unit directions on the ground (x, z), `at(c, r)` a cell's
 * centre on the mat, `cellAt(p)` the cell under a point of the table (or null off the board), `corners` the board's four
 * corners on the mat (the host's left foot first, round to the head).
 * KG5 (section 18): `flip` lays the board for the GUEST of an online game, who reads the relay's board turned about its
 * middle (net/gambit/gambitTable.js flipGambitState) - its rows and columns run the other way, so every turned cell lands on
 * the felt where the host's own lies: one board on the cloth, each player's king's row at its own foot.
 * @param {{centre: number[], axisYaw: number}} frame  world/card/cardTables.js tableFrame
 * @param {number[]} hostFeet  the host's feet in their chair
 * @param {{flip?: boolean}} [o]
 */
export function gambitPlaces(frame, hostFeet, { flip = false } = {}) {
  const along = [Math.sin(frame.axisYaw), Math.cos(frame.axisYaw)];
  const across = [Math.cos(frame.axisYaw), -Math.sin(frame.axisYaw)];
  const dx = hostFeet[0] - frame.centre[0], dz = hostFeet[2] - frame.centre[2];
  const da = dx * along[0] + dz * along[1], dq = dx * across[0] + dz * across[1];
  const end = Math.abs(da) > Math.abs(dq);
  const sign = (/** @type {number} */ v) => (v < 0 ? -1 : 1);
  const way = flip ? -1 : 1;   // the guest's rows run from the host's foot to its head
  const toHost = end ? [along[0] * sign(da) * way, along[1] * sign(da) * way] : [across[0] * sign(dq) * way, across[1] * sign(dq) * way];
  // the host faces the board, -toHost; the host's right is (fz, -fx) - the world's own handedness (x right, z forward)
  const right = [-toHost[1], toHost[0]];
  const cell = end ? GAMBIT_FELT_SHORT / KG_COLS : GAMBIT_FELT_SHORT / KG_ROWS;
  const top = frame.centre[1] + GAMBIT_MAT_LIFT;
  const cx = frame.centre[0], cz = frame.centre[2];
  const point = (/** @type {number} */ u, /** @type {number} */ v) => [cx + right[0] * u + toHost[0] * v, top, cz + right[1] * u + toHost[1] * v];
  const at = (/** @type {number} */ c, /** @type {number} */ r) => point((c - (KG_COLS - 1) / 2) * cell, (r - (KG_ROWS - 1) / 2) * cell);
  const cellAt = (/** @type {number[]|null} */ p) => {
    if (!p) return null;
    const ux = p[0] - cx, uz = p[2] - cz;
    const c = Math.floor((ux * right[0] + uz * right[1]) / cell + KG_COLS / 2);
    const r = Math.floor((ux * toHost[0] + uz * toHost[1]) / cell + KG_ROWS / 2);
    return c >= 0 && c < KG_COLS && r >= 0 && r < KG_ROWS ? [c, r] : null;
  };
  const w = KG_COLS * cell, d = KG_ROWS * cell;
  const corners = [point(-w / 2, d / 2), point(w / 2, d / 2), point(w / 2, -d / 2), point(-w / 2, -d / 2)];
  return { end, cell, top, right, toHost, width: w, depth: d, at, cellAt, corners };
}

// ── KG4: THE BOARD BUILT, THE CARDS STANDING, THE LEAN ─────────────────────────────────────────────────────────────

/** A piece's card on its cell: this share of the cell wide (10.1's plate, 4.5 cm on a 7.08 cm cell). */
export const GAMBIT_CARD_SHARE = 0.64;
/** THE BUILT BOARD (5.3): a wall a stone block a cell square and a few centimetres high, a pillar a column, the water
 *  recessed under the mat (metres; a pillar's radius a share of the cell). MEASURE (KG4): read in the lab's photographs. */
export const GAMBIT_WALL_H = 0.024;
export const GAMBIT_PILLAR_H = 0.042;
export const GAMBIT_PILLAR_R = 0.34;
export const GAMBIT_WATER_DROP = 0.0025;
/** THE STAND (10.1): a turned disc this share of a cell across and this high (m); the card's foot this deep in its slot;
 *  the chosen piece lifted this much (m). */
export const GAMBIT_DISC_SHARE = 0.84;
export const GAMBIT_DISC_H = 0.006;
export const GAMBIT_SLOT_DEPTH = 0.003;
export const GAMBIT_SELECT_LIFT = 0.01;
/** A standing card's height on a board of `cell` (m): the plate's own 63:88 at GAMBIT_CARD_SHARE of the cell. */
export const gambitCardHeight = (/** @type {number} */ cell) => (GAMBIT_CARD_SHARE * cell * CARD_L) / CARD_W;
/** The foot of a standing card over the mat (m): on its disc, in its slot. */
export const GAMBIT_CARD_FOOT = GAMBIT_DISC_H - GAMBIT_SLOT_DEPTH;

/**
 * THE PRESS ON THE BUILT BOARD (14.3): the cell a ray from `eye` along `dir` presses - the nearest of a standing card (its
 * face, square to the board's rows, both sides alike), a wall's top, a pillar's top, and the mat itself, or null off the
 * board. A press on a card's face is its cell, as the press on its cell is; one on a wall's top is the wall's cell (which
 * presses nothing - the law moves no piece there), never the cell the ray would reach on the mat behind it.
 * @param {ReturnType<typeof gambitPlaces>} places @param {{tiles: number[], pieces: {id?: number, col: number, row: number}[]}} board
 * @param {number[]} eye @param {number[]} dir @param {number|null} [selected] the chosen piece's id (its card lifted)
 */
export function gambitPressCell(places, board, eye, dir, selected = null) {
  /** @type {{t: number, cell: number[]}|null} */ let best = null;
  const take = (/** @type {number} */ t, /** @type {number[]} */ cell) => { if (t > 0 && (!best || t < best.t)) best = { t, cell }; };
  const planeY = (/** @type {number} */ y) => (Math.abs(dir[1]) > 1e-9 ? (y - eye[1]) / dir[1] : -1);
  const pointAt = (/** @type {number} */ t) => [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
  const local = (/** @type {number[]} */ p, /** @type {number} */ c, /** @type {number} */ r) => {
    const o = places.at(c, r), dx = p[0] - o[0], dz = p[2] - o[2];
    return [(dx * places.right[0] + dz * places.right[1]) / places.cell, (dx * places.toHost[0] + dz * places.toHost[1]) / places.cell];
  };
  const H = gambitCardHeight(places.cell), half = GAMBIT_CARD_SHARE / 2;
  for (const p of board.pieces ?? []) {
    // the card's face: the plane through its cell's centre along the rows (normal toHost), its width across the cell
    const o = places.at(p.col, p.row), n = places.toHost;
    const den = dir[0] * n[0] + dir[2] * n[1];
    if (Math.abs(den) < 1e-9) continue;
    const t = ((o[0] - eye[0]) * n[0] + (o[2] - eye[2]) * n[1]) / den;
    // AUDIT KG II C7: the chosen card stands lifted as it is drawn (gambitTableDraw.js) - its press is tested there too
    const q = pointAt(t), [u] = local(q, p.col, p.row), y = q[1] - (places.top + GAMBIT_CARD_FOOT + (p.id === selected ? GAMBIT_SELECT_LIFT : 0));
    if (Math.abs(u) <= half && y >= 0 && y <= H) take(t, [p.col, p.row]);
  }
  for (let r = 0; r < KG_ROWS; r++) for (let c = 0; c < KG_COLS; c++) {
    const tile = board.tiles?.[r * KG_COLS + c];
    if (tile !== KG_TILE.wall && tile !== KG_TILE.pillar) continue;
    const t = planeY(places.top + (tile === KG_TILE.wall ? GAMBIT_WALL_H : GAMBIT_PILLAR_H));
    if (t <= 0) continue;
    const [u, v] = local(pointAt(t), c, r);
    if (tile === KG_TILE.wall ? Math.abs(u) <= 0.5 && Math.abs(v) <= 0.5 : Math.hypot(u, v) <= GAMBIT_PILLAR_R) take(t, [c, r]);
  }
  const tm = planeY(places.top);
  if (tm > 0) { const cell = places.cellAt(pointAt(tm)); if (cell) take(tm, cell); }
  return best ? /** @type {any} */ (best).cell : null;
}

/** THE LEAN (10.7): pitched this far down (first guess 55 degrees - any of 48 to 63 keeps the board in view), and the
 *  board's projected box kept this share of the clear screen at most (a margin round it). */
export const GAMBIT_LEAN_PITCH = (55 * Math.PI) / 180;
export const GAMBIT_LEAN_FILL = 0.94;

/**
 * THE LEAN (10.7, 14.7; MEASURE KG4): the seated eye moved forward over the player's own edge of the board and up, and
 * pitched down, until the whole board - its corners and its head row's cards standing - lies in the CLEAR part of the
 * screen (`clear`: `{x0, x1, y0, y1}`, shares of the world's view, y down - the screen past the panel's column, above the
 * phone's strip, under the touch layer's presses), centred there. Solved, not guessed: the board's projected box is fitted
 * by moving the eye back along its line of sight and sideways along the board, a few rounds. Answers `{eye, fwd}`.
 * @param {ReturnType<typeof gambitPlaces>} places
 * @param {{aspect: number, fovY: number, clear?: {x0: number, x1: number, y0: number, y1: number}, pitch?: number}} view
 */
export function gambitLean(places, { aspect, fovY, clear: given = { x0: 0, x1: 1, y0: 0, y1: 1 }, pitch = GAMBIT_LEAN_PITCH }) {
  // AUDIT KG II C5: a clear screen with no extent fits nothing - the whole view instead (the eye never thrown away)
  const clear = given && given.x1 - given.x0 > 0 && given.y1 - given.y0 > 0 ? given : { x0: 0, x1: 1, y0: 0, y1: 1 };
  const f = [-places.toHost[0] * Math.cos(pitch), -Math.sin(pitch), -places.toHost[1] * Math.cos(pitch)];   // toward the head, down
  const rt = [places.right[0], 0, places.right[1]];
  const up = [f[1] * rt[2] - f[2] * rt[1], f[2] * rt[0] - f[0] * rt[2], f[0] * rt[1] - f[1] * rt[0]];   // forward x right: the screen's up (the world's left hand - Unity's axes)
  const ty = Math.tan(fovY / 2), tx = ty * aspect;
  const H = gambitCardHeight(places.cell);
  const head = [places.corners[2], places.corners[3]];
  const pts = [...places.corners, ...head.map((p) => [p[0], p[1] + H, p[2]])];
  const centre = [(places.corners[0][0] + places.corners[2][0]) / 2, places.top, (places.corners[0][2] + places.corners[2][2]) / 2];
  // the clear screen in the projection's own units (x right, y up)
  const cx0 = clear.x0 * 2 - 1, cx1 = clear.x1 * 2 - 1, cy0 = 1 - clear.y1 * 2, cy1 = 1 - clear.y0 * 2;
  let dist = 1, sx = 0, sy = 0;
  const eyeOf = () => [0, 1, 2].map((i) => centre[i] - f[i] * dist + rt[i] * sx + up[i] * sy);
  const box = () => {
    const e = eyeOf();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]];
      const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
      const x = (d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2]) / (Math.max(z, 1e-6) * tx);
      const y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / (Math.max(z, 1e-6) * ty);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  };
  for (let round = 0; round < 24; round++) {
    const b = box();
    const k = Math.max((b.x1 - b.x0) / ((cx1 - cx0) * GAMBIT_LEAN_FILL), (b.y1 - b.y0) / ((cy1 - cy0) * GAMBIT_LEAN_FILL));
    dist *= Math.max(0.5, Math.min(2, k));
    // centre it: the box's middle moved to the clear screen's, the eye slid square to its line of sight
    const n = box();
    const dx = ((cx0 + cx1) - (n.x0 + n.x1)) / 2, dy = ((cy0 + cy1) - (n.y0 + n.y1)) / 2;
    sx -= dx * dist * tx; sy -= dy * dist * ty;
  }
  return { eye: eyeOf(), fwd: f, box: box() };
}

/** The yaw a side's cards lie at on the mat - each side reads its own the right way up, a card's top (the plate's +Z)
 *  away from its owner (Iliac Hand's cloth's way, world/iliacCloth.js): the host's toward the head, the guest's toward
 *  the foot - the side told by the card's turn as well as by the mat's mark under it (14.8: a side never by colour
 *  alone). @param {{toHost: number[]}} places @param {number} side */
export const gambitCardYaw = (places, side) => Math.atan2(places.toHost[0], places.toHost[1]) + (side === 0 ? Math.PI : 0);
