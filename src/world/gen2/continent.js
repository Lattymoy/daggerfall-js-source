// @ts-check
// WG2 THE CONTINENT'S DRAINAGE (bible/03-World/World-2-Canon.md, "Water"): the whole of Tamriel at the relief's own grain
// (two cells a picture unit, some 6 km), its rain run to the sea - so a region knows the rivers that enter it from beyond
// its edge (`regionInflow`), and an edit knows how far downstream its water can reach (`downstreamOf`, the stages' basin).
// Made once from the canon alone (the authored land and ranges, the owner's relief, the profiles), exact arithmetic.
import { Field } from './field.js';
import { routeFlow } from './drainage.js';
import { canonTheatre, canonRelief, canonRange, pictureToWorld, worldToPicture } from './canon.js';
import { byteMetres } from './geology.js';
import { runoff, evaporation } from './hydrology.js';
import { LAPSE } from './climate.js';
import { provinceProfile } from './tables.js';

/** Cells a picture unit, each way (the relief's). */
export const CONTINENT_RES = 2;
const YEAR_S = 31557600;

/** @type {Map<string, any>} */
const _made = new Map();

/**
 * The continent's drainage for a fit: its grid (picture units x CONTINENT_RES), each cell's receiver, its discharge
 * (m3/s) and its height (m). Kept for the fit.
 * @param {import('./canon.js').Fit} fit
 */
export function continent(fit) {
  const key = `${fit.ox}:${fit.oy}:${fit.ppu}`;
  if (_made.has(key)) return _made.get(key);
  const W = 320 * CONTINENT_RES, H = 200 * CONTINENT_RES, n = W * H, cellM = (819.2 * fit.ppu) / CONTINENT_RES;
  const elev = new Field(W, H, { x0: 0, y0: 0, res: 1 }), theatre = new Uint8Array(n), own = new Float64Array(n);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const px = (i + 0.5) / CONTINENT_RES, py = (j + 0.5) / CONTINENT_RES, k = j * W + i, t = canonTheatre(px, py);
    theatre[k] = t;
    if (!t) { elev.data[k] = -10; continue; }
    const prof = provinceProfile(t), rg = canonRange(px, py), e = byteMetres(canonRelief(px, py)) + prof.range * rg.lift * 0.7;
    elev.data[k] = e;
    const temp = prof.temp - LAPSE * e, precip = Math.max(40, prof.precip) / 1000;
    own[k] = (runoff(precip, evaporation(temp)) * cellM * cellM) / YEAR_S;
  }
  const rt = routeFlow(elev, cellM, (k) => theatre[k] === 0);
  const Q = Float64Array.from(own);
  for (let o = n - 1; o >= 0; o--) { const k = rt.order[o], r = rt.rcv[k]; if (r >= 0) Q[r] += Q[k]; }
  const made = { W, H, cellM, fit, rcv: rt.rcv, Q, elev, theatre };
  _made.set(key, made);
  return made;
}

/** The continental cell a world point stands in. @param {any} c @param {number} x @param {number} y */
export function continentCell(c, x, y) {
  const [px, py] = worldToPicture(c.fit, x, y), i = Math.floor(px * CONTINENT_RES), j = Math.floor(py * CONTINENT_RES);
  return i < 0 || j < 0 || i >= c.W || j >= c.H ? -1 : j * c.W + i;
}
/** A continental cell's centre in world pixels. @param {any} c @param {number} k @returns {[number, number]} */
export const cellWorld = (c, k) => pictureToWorld(c.fit, ((k % c.W) + 0.5) / CONTINENT_RES, (((k / c.W) | 0) + 0.5) / CONTINENT_RES);

/**
 * The water that enters a region from beyond its edge: for each continental cell outside the region whose receiver lies
 * inside it, its discharge, laid on the region cell one in from the edge nearest where it crosses. Answers m3/s a cell of
 * the region's grid. @param {import('./geology.js').RegionSpec} spec
 */
export function regionInflow(spec) {
  const c = continent(spec.fit), R = spec.rect, w = R.w * spec.res, h = R.h * spec.res, out = new Float64Array(w * h);
  const inside = (x, y) => x >= R.x && y >= R.y && x < R.x + R.w && y < R.y + R.h;
  const reach = Math.ceil(spec.fit.ppu / CONTINENT_RES) + 2;
  const k0 = continentCell(c, R.x - reach, R.y - reach), k1 = continentCell(c, R.x + R.w + reach, R.y + R.h + reach);
  if (k0 < 0 || k1 < 0) return out;
  for (let j = (k0 / c.W) | 0; j <= ((k1 / c.W) | 0); j++) for (let i = k0 % c.W; i <= k1 % c.W; i++) {
    const k = j * c.W + i, r = c.rcv[k];
    if (r < 0) continue;
    const [x, y] = cellWorld(c, k), [rx, ry] = cellWorld(c, r);
    if (inside(x, y) || !inside(rx, ry)) continue;
    // the crossing: the outside cell's centre brought to the region, one cell inside its edge
    const cxw = Math.min(R.x + R.w - 1.5 / spec.res, Math.max(R.x + 1.5 / spec.res, x)), cyw = Math.min(R.y + R.h - 1.5 / spec.res, Math.max(R.y + 1.5 / spec.res, y));
    const ci = Math.floor((cxw - R.x) * spec.res), cj = Math.floor((cyw - R.y) * spec.res);
    out[cj * w + ci] += c.Q[k];
  }
  return out;
}

/** The rectangle of world pixels a change in `rect` can reach by water: the rectangle and every continental cell
 *  downstream of it to the sea. The stages' hydrology reach (stageGraph.js staleAfter's `basinOf`).
 *  @param {import('./canon.js').Fit} fit @param {{ x: number, y: number, w: number, h: number }} rect */
export function downstreamOf(fit, rect) {
  const c = continent(fit);
  let x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.w, y1 = rect.y + rect.h;
  const seen = new Set();
  for (const [x, y] of [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h], [rect.x + rect.w / 2, rect.y + rect.h / 2]]) {
    for (let k = continentCell(c, x, y); k >= 0 && !seen.has(k); k = c.rcv[k]) {
      seen.add(k);
      const [wx, wy] = cellWorld(c, k), half = spec2(c);
      x0 = Math.min(x0, Math.floor(wx - half)); y0 = Math.min(y0, Math.floor(wy - half)); x1 = Math.max(x1, Math.ceil(wx + half)); y1 = Math.max(y1, Math.ceil(wy + half));
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const spec2 = (c) => c.fit.ppu / CONTINENT_RES / 2;
