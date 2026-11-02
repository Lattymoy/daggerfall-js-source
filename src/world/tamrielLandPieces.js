// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EXACT-PIECES (2026-10-26, the owner: "No band aids"; bible/06-Systems/Travel-View.md EXACT-PIECES) - THE LAND'S PIECES AT
// THE PIXEL, A REGION AT A TIME. FAST-REFUSAL's pieces are the trace's, and a strait narrower than two of its centres is
// one piece there: Mournhold to Ebonheart (Ebonheart's ground cut from the mainland's by such water) still spent the
// planner's whole count before "no way". The roads' regions read every pixel of the land as they are laid
// (world/tamrielRoads.js tamrielRegionSteps), so each labels its core's dry pixels by the Overworld planner's own water
// law (systems/travel/travelRoute.js: water at or under WATER_BYTE; a diagonal step refused only between two water pixels,
// so two dry pixels are one piece where a run of steps through dry pixels side by side joins them - FOUR-connected: a
// diagonal with a dry pixel beside it is two such steps). Its labels go with its layer, in its answer and its cache entry;
// the page joins each region's pieces to its neighbours' across their shared edge as they land (systems/travel/
// landPieces.js). Pure, and world/ alone: the roads' worker imports it.
//
// A region's LAND: its core's width and height, its pieces' count, and its rows as runs - `rowStart` (a row's first run,
// h + 1 of them), each run's length and label (0 the water, 1..count a piece); and its RING, whether each pixel just
// outside the core is dry (north row, south row, west column, east column) - a neighbour the build lays nothing in is
// reached only through a dry one.
// ═══════════════════════════════════════════════════════════════════

/**
 * Label a core's dry pixels four-connected, the pieces numbered in reading order of their first pixel; the rows as runs.
 * @param {(u: number, v: number) => boolean} dryAt @param {number} w @param {number} h
 * `dryAt` is asked of the ring's pixels too (u -1 or w, v -1 or h).
 * @returns {{ w: number, h: number, count: number, rowStart: Uint32Array, runLen: Uint16Array, runLabel: Uint32Array, ring: Uint8Array }}
 */
export function labelLand(dryAt, w, h) {
  const n = w * h,
    root = new Int32Array(n).fill(-1);
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) if (dryAt(u, v)) root[v * w + u] = v * w + u;
  const find = (i) => {
    while (root[i] !== i) {
      root[i] = root[root[i]];
      i = root[i];
    }
    return i;
  };
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++) {
      const i = v * w + u;
      if (root[i] < 0) continue;
      if (u + 1 < w && root[i + 1] >= 0) {
        const a = find(i),
          b = find(i + 1);
        if (a !== b) root[Math.max(a, b)] = Math.min(a, b);
      }
      if (v + 1 < h && root[i + w] >= 0) {
        const a = find(i),
          b = find(i + w);
        if (a !== b) root[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }
  const label = new Map();
  /** @type {number[]} */ const len = [],
    lab = [];
  const rowStart = new Uint32Array(h + 1);
  for (let v = 0; v < h; v++) {
    rowStart[v] = len.length;
    let cur = -1;
    for (let u = 0; u < w; u++) {
      const i = v * w + u;
      let l = 0;
      if (root[i] >= 0) {
        const r = find(i);
        l = label.get(r) ?? 0;
        if (!l) {
          l = label.size + 1;
          label.set(r, l);
        }
      }
      if (l === cur && len[len.length - 1] < 65535) len[len.length - 1]++;
      else {
        len.push(1);
        lab.push(l);
        cur = l;
      }
    }
  }
  rowStart[h] = len.length;
  const ring = new Uint8Array(2 * w + 2 * h);
  for (let u = 0; u < w; u++) {
    ring[u] = dryAt(u, -1) ? 1 : 0;
    ring[w + u] = dryAt(u, h) ? 1 : 0;
  }
  for (let v = 0; v < h; v++) {
    ring[2 * w + v] = dryAt(-1, v) ? 1 : 0;
    ring[2 * w + h + v] = dryAt(w, v) ? 1 : 0;
  }
  return { w, h, count: label.size, rowStart, runLen: Uint16Array.from(len), runLabel: Uint32Array.from(lab), ring };
}

/** The label of a core's pixel (u, v): 0 the water. @param {ReturnType<typeof labelLand>} land */
export function landLabelOf(land, u, v) {
  if (u < 0 || v < 0 || u >= land.w || v >= land.h) return 0;
  let x = 0;
  for (let k = land.rowStart[v], e = land.rowStart[v + 1]; k < e; k++) {
    x += land.runLen[k];
    if (u < x) return land.runLabel[k];
  }
  return 0;
}

/** Is the pixel just outside a core's edge, beside (u, v) on it, dry - `side` 'N', 'S', 'W' or 'E'. @param {ReturnType<typeof labelLand>} land */
export function landRingDry(land, side, t) {
  const { w, h, ring } = land;
  return !!ring && ring[side === 'N' ? t : side === 'S' ? w + t : side === 'W' ? 2 * w + t : 2 * w + h + t] === 1;
}
