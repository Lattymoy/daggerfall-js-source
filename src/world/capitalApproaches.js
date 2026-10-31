// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ROAD-FOLLOW (2026-10-27, the owner: "Also, city gates do not line up with the roads"; bible/03-World/Town-Shapes.md
// ROAD-FOLLOW) - A CAPITAL'S APPROACHES: the road on from where the roads past the Bay end, at its span's edge, to its own
// gate in its wall.
//
// The roads come to a capital at its gate pixel (world/tamrielCapitals.js capitalGates) and stop at its span's edge: the
// painter paints no location's own tiles (world/road/roadPainter.js), and a road's arm into a pixel ends at the middle of
// the pixel's side. The walls stand in from there - the rim's 70.4 m the land's own ground (CAPITAL_RIM_M), and the city's
// own ground before the wall - and their gates are where the city's streets need them (Alinor's north gate 158 m east of
// the palace's axis, on its lane; Solitude's main gate 113.6 m east of the slice's middle, between the tavern's block and
// Castle Dour): every road stopped 80 to 200 m short of its gate, up to 160 m to one side of it. The gates stay; the
// capital lays the rest of its road, as Daggerfall's walled cities' gate blocks carry theirs through their wall ring: two
// tiles of the road's own surface (world/road/roadPainter.js TILE.road) from the arm's end straight in, and - for a gate
// to one side - along the wall's foot APPROACH_SKIRT outside it, and in to the gate. Its ground is laid by the capital's
// own blocks (capitalPortBlocks' laws, over its rim too). Pure: the plan's gates (`gateAt`, its anchor's metres) and the
// capital's span (`dims`, capitalDims') are handed in - or (SOLITUDE-RELIEF) the capital's own line, `approach`.
// ═══════════════════════════════════════════════════════════════════

import { BLOCK_M } from './blockHash.js';
import { TILE } from './road/roadPainter.js';

/** The approach's ground: the road's own surface, the record the painter lays a road's middle with. */
export const APPROACH_TILE = TILE.road;
/** A ground tile's side, metres. */
const T = BLOCK_M / 16;
/** The approach's half width - two tiles, as the painter lays a cardinal road. */
export const APPROACH_HALF = T;
/** How far outside its wall's line the approach runs along it to a gate off its arrival's line, metres - three tiles:
 *  the road's near edge two tiles clear of the wall's line, past every capital's towers. */
export const APPROACH_SKIRT = 3 * T;

/** Each side's frame: from the plan's metres to `[u, v]` - along the side, and in from its edge - and the edge's own place
 *  in the plan's metres (`edge(cap, dims)`). */
const FRAMES = Object.freeze({
  N: Object.freeze({ uv: (x, z, e) => [x, z - e], lateral: 0, edge: (cap) => -cap.anchor[1] * BLOCK_M }),
  S: Object.freeze({ uv: (x, z, e) => [x, e - z], lateral: 0, edge: (cap, D) => (8 * D.h - cap.anchor[1]) * BLOCK_M }),
  W: Object.freeze({ uv: (x, z, e) => [z, x - e], lateral: 1, edge: (cap) => -cap.anchor[0] * BLOCK_M }),
  E: Object.freeze({ uv: (x, z, e) => [z, e - x], lateral: 1, edge: (cap, D) => (8 * D.w - cap.anchor[0]) * BLOCK_M }),
});

/** THE GATE'S SLICE: the slice along a side its plan's gate stands in (its column for a north or south gate, its row for an
 *  east or west one) - the roads' gate pixel stands off it (world/tamrielCapitals.js capitalGates); the capital's own
 *  slice's where its plan has no gate there (Falinesti: no wall). @param {any} cap @param {{ w: number, h: number, mx: number, my: number }} D
 *  @param {string} side @returns {number} */
export function capitalGateSlice(cap, D, side) {
  const g = cap.gateAt?.[side],
    lat = FRAMES[side]?.lateral;
  if (!g || lat === undefined) return lat === 1 ? D.my : D.mx;
  const n = lat === 1 ? D.h : D.w,
    s = Math.floor((g[lat] + cap.anchor[lat] * BLOCK_M) / (8 * BLOCK_M));
  return Math.max(0, Math.min(n - 1, s));
}

/** WHERE THE ROAD ENDS: the middle of the gate slice's side - the arm's end, in the plan's metres. @param {any} cap
 *  @param {{ w: number, h: number, mx: number, my: number }} D @param {string} side @returns {[number, number]} */
export function capitalArrival(cap, D, side) {
  const F = FRAMES[side],
    s = capitalGateSlice(cap, D, side),
    e = F.edge(cap, D),
    mid = (8 * s + 4 - cap.anchor[F.lateral]) * BLOCK_M;
  return F.lateral === 1 ? [e, mid] : [mid, e];
}

/**
 * A CAPITAL'S APPROACHES: for each of its gates with a gate in its plan (`gates`, `gateAt`), the rectangles of road from
 * the arrival to the gate - each `[u0, v0, u1, v1]` in its side's frame (along, in): the straight run in, where the gate
 * stands within a tile of the arrival's line; else the run in to APPROACH_SKIRT short of the wall's line, the run along
 * it, and the run in to the gate, its line on the tiles' own. @param {any} cap
 * @param {{ w: number, h: number, mx: number, my: number }} D
 * @returns {Array<{ side: string, edge: number, rects: number[][] }>}
 */
export function capitalApproaches(cap, D) {
  const out = [];
  for (const side of cap.gates ?? []) {
    const g = cap.gateAt?.[side],
      F = FRAMES[side];
    if (!g || !F) continue;
    const e = F.edge(cap, D),
      [ua] = F.uv(...capitalArrival(cap, D, side), e),
      [ug0, vg] = F.uv(g[0], g[1], e),
      ug = Math.round(ug0 / T) * T,
      H = APPROACH_HALF;
    if (Math.abs(ug - ua) < T) {
      out.push({ side, edge: e, rects: [[ua - H, 0, ua + H, vg]] });
      continue;
    }
    const vs = vg - APPROACH_SKIRT;
    out.push({
      side,
      edge: e,
      rects: [
        [ua - H, 0, ua + H, vs + H],
        [Math.min(ua, ug) - H, vs - H, Math.max(ua, ug) + H, vs + H],
        [ug - H, vs - H, ug + H, vg],
      ],
    });
  }
  return out;
}

const _onWay = new WeakMap();
/** Is a point of the plan (its anchor's metres, x east, z south) on one of a capital's approaches - kept a capital and a
 *  span. @param {any} cap @param {{ w: number, h: number, mx: number, my: number }} D
 *  @returns {(x: number, z: number) => boolean} */
export function onCapitalApproach(cap, D) {
  if (cap.approach) return cap.approach; // SOLITUDE-RELIEF: a capital whose road on to its gate is a line of its own (Solitude's Gate Road)
  let k = _onWay.get(cap);
  if (!k || k.D !== D) {
    const ways = capitalApproaches(cap, D);
    const test = ways.length
      ? (x, z) =>
          ways.some(({ side, edge, rects }) => {
            const [u, v] = FRAMES[side].uv(x, z, edge);
            return rects.some(([u0, v0, u1, v1]) => u > u0 && u < u1 && v > v0 && v < v1);
          })
      : () => false;
    _onWay.set(cap, (k = { D, test }));
  }
  return k.test;
}

/** The plan's cells (`[r, c]`, its rows from the north) an approach crosses. @param {any} cap
 *  @param {{ w: number, h: number, mx: number, my: number }} D @returns {Array<[number, number]>} */
export function capitalApproachCells(cap, D) {
  const out = new Map(),
    on = onCapitalApproach(cap, D),
    [ax, ar] = cap.anchor;
  if (cap.approach) {
    // SOLITUDE-RELIEF: its own line - every tile of the plan asked
    for (let x = -ax * BLOCK_M + T / 2; x < (8 * D.w - ax) * BLOCK_M; x += T) {
      for (let z = -ar * BLOCK_M + T / 2; z < (8 * D.h - ar) * BLOCK_M; z += T) {
        if (!on(x, z)) continue;
        const r = Math.floor(z / BLOCK_M + ar),
          c = Math.floor(x / BLOCK_M + ax);
        out.set(`${r},${c}`, [r, c]);
      }
    }
    return [...out.values()];
  }
  for (const { side, edge, rects } of capitalApproaches(cap, D)) {
    for (const [u0, v0, u1, v1] of rects) {
      // the rectangle's corners back in the plan's metres, and every tile centre between them asked
      const pts = [
        [u0, v0],
        [u1, v1],
      ].map(([u, v]) =>
        side === 'N' ? [u, edge + v] : side === 'S' ? [u, edge - v] : side === 'W' ? [edge + v, u] : [edge - v, u],
      );
      const x0 = Math.min(pts[0][0], pts[1][0]),
        x1 = Math.max(pts[0][0], pts[1][0]),
        z0 = Math.min(pts[0][1], pts[1][1]),
        z1 = Math.max(pts[0][1], pts[1][1]);
      for (let x = Math.floor(x0 / T) * T + T / 2; x < x1; x += T) {
        for (let z = Math.floor(z0 / T) * T + T / 2; z < z1; z += T) {
          if (!on(x, z)) continue;
          const r = Math.floor(z / BLOCK_M + ar),
            c = Math.floor(x / BLOCK_M + ax);
          out.set(`${r},${c}`, [r, c]);
        }
      }
    }
  }
  return [...out.values()];
}
