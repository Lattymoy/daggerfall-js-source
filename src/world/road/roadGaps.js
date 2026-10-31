// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ROAD-GAPS (2026-10-26, the owner: "Take care of exclusions and gaps"; bible/06-Systems/Travel-View.md ROAD-GAPS) - THE
// LINKS A REGION'S ROADS LAY WHERE TWO OF ITS NETWORKS MEET UNJOINED. A region's build (world/tamrielRoads.js) routes its
// places a route at a time, and some of what it lays stands as pieces of its own that no bit joins to the rest: on the
// freeware's Hammerfell (regions (2, 3) and (2, 4) laid fresh) 339 pieces, 52 pairs of them within three pixels of each
// other - a village's tracks a pixel off the road it was meant for, two roads' ends side by side - and the Overworld's
// planner, which walks the roads as roads (ROAD-BEYOND), walked round by whatever joins them, or across the field.
//
// THE LAW: the region's network as one graph by its bits (a step joins two pixels where each carries the other's edge);
// its pieces; each path pixel of the region's core, in reading order, looks for a pixel of ANOTHER piece within LINK_GAP
// (the nearest first, then reading order) whose straight way to it is dry land - no water the build refuses, no pixel
// it routes round, and no other path pixel between - and lays that way as a road where both are roads, else a track; the
// two pieces are one from then on. Pure: arrays in, the arrays written in place, the links counted. The same on every
// client (the region's own network alone, never the order the regions land in).
// ═══════════════════════════════════════════════════════════════════
import { DIR_DELTA } from './roadNetwork.js';

/** How far apart (pixels, the longest axis) two pieces of a region's network may stand and be linked. */
export const LINK_GAP = 3;

const BIT_OF = new Map(DIR_DELTA.map(([bit, dx, dy]) => [`${dx},${dy}`, bit]));
const BACK = new Map(DIR_DELTA.map(([bit, dx, dy]) => [bit, /** @type {number} */ (BIT_OF.get(`${-dx},${-dy}`))]));
/** The offsets within LINK_GAP, nearest first (then reading order). */
const OFFSETS = (() => {
  const out = [];
  for (let dy = -LINK_GAP; dy <= LINK_GAP; dy++)
    for (let dx = -LINK_GAP; dx <= LINK_GAP; dx++)
      if (dx || dy) out.push([dx, dy, Math.max(Math.abs(dx), Math.abs(dy))]);
  return out.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
})();

/**
 * Link the pieces of a region's network that stand within LINK_GAP of each other.
 * @param {{ roads: Uint8Array, tracks: Uint8Array }} net the region's grid's network (written in place)
 * @param {number} W @param {number} H
 * @param {{ blocked: (u: number, v: number) => boolean, owns: (u: number, v: number) => boolean }} o `blocked` a pixel no
 *   link crosses (water the build refuses, a place it routes round, the Bay); `owns` a pixel of the region's core
 * @returns {number} the links laid
 */
export function linkGaps(net, W, H, { blocked, owns }) {
  const n = W * H,
    root = new Int32Array(n).fill(-1);
  const path = (i) => net.roads[i] | net.tracks[i];
  for (let i = 0; i < n; i++) if (path(i)) root[i] = i;
  const find = (i) => {
    while (root[i] !== i) {
      root[i] = root[root[i]];
      i = root[i];
    }
    return i;
  };
  const join = (a, b) => {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) root[ra] = rb;
  };
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const i = v * W + u,
        b = path(i);
      if (!b) continue;
      for (const [bit, dx, dy] of DIR_DELTA) {
        if (!(b & bit)) continue;
        const x = u + dx,
          y = v + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x;
        if (path(j) & /** @type {number} */ (BACK.get(bit))) join(i, j);
      }
    }
  }
  let links = 0;
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const i = v * W + u;
      if (root[i] < 0 || !owns(u, v)) continue;
      for (const [dx, dy] of OFFSETS) {
        const x = u + dx,
          y = v + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x;
        if (root[j] < 0 || find(i) === find(j)) continue;
        const way = straightWay(u, v, x, y);
        if (
          way.slice(1, -1).some(([a, b]) => blocked(a, b) || root[b * W + a] >= 0) ||
          way.some(([a, b]) => blocked(a, b))
        )
          continue;
        const kind = net.roads[i] && net.roads[j] ? net.roads : net.tracks;
        for (let k = 1; k < way.length; k++) {
          const [ax, ay] = way[k - 1],
            [bx, by] = way[k];
          const bit = /** @type {number} */ (BIT_OF.get(`${bx - ax},${by - ay}`));
          kind[ay * W + ax] |= bit;
          kind[by * W + bx] |= /** @type {number} */ (BACK.get(bit));
        }
        for (const [a, b] of way) {
          const k = b * W + a;
          if (root[k] < 0) root[k] = k;
          join(i, k);
        }
        links++;
        break;
      }
    }
  }
  return links;
}

/** The compass steps from (ax, ay) to (bx, by): diagonal first, then straight - every pixel, both ends. */
function straightWay(ax, ay, bx, by) {
  const out = [[ax, ay]];
  let x = ax,
    y = ay;
  while (x !== bx || y !== by) {
    x += Math.sign(bx - x);
    y += Math.sign(by - y);
    out.push([x, y]);
  }
  return out;
}
