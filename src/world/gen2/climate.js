// WG2 CLIMATE (Phase 2): the air over a region - its mean temperature, its rain and
// snow, how damp it is, how the wind and the sun find each slope, and how far summer is from winter. The lore sets each
// province's numbers (data/provinces.json) and the land shapes them: the air cools 6.5 C a kilometre up, a slope that
// faces the wet wind takes more rain, and the land behind a high ridge takes less - the rain shadow.
import { Field } from './field.js';
import { blur, prominence } from './gridOps.js';
import { canonTheatre, canonRelief, worldToPicture } from './canon.js';
import { regionGrid, byteMetres } from './geology.js';
import { clampExact } from './exact.js';
import { provinceProfile } from './tables.js';

/** C lost a metre up. */
export const LAPSE = 0.0065;
/** C gained a picture unit south of a province's middle (its latitude within it). */
export const LATITUDE = 0.045;
/** The wet wind's fetch: how many steps upwind, and a step in world pixels. */
export const FETCH_STEPS = 24;
export const FETCH_PX = 2;
/** Rain gained a kilometre of rise into the wind, and the rain shadow's strength a kilometre of ridge upwind. */
export const OROGRAPHIC = 2.4;
export const RAIN_SHADOW = 1.1;

/** Each province's middle row on the picture (for the latitude terms). */
const _mid = new Map();
function provinceMidY(fit, t) {
  if (!_mid.has(t)) {
    let sum = 0, n = 0;
    for (let py = 0; py < 200; py += 2) for (let px = 0; px < 320; px += 2) if (canonTheatre(px, py) === t) { sum += py; n++; }
    _mid.set(t, n ? sum / n : 100);
  }
  return _mid.get(t);
}

/**
 * THE AIR. `temp` mean C, `precip` mm a year, `humidity` 0..1, `exposure` (to the wind) 0..1, `solar` (the sun on the
 * slope, 1 for flat ground) and `season` (C between the warmest and coldest month).
 * @param {import('./geology.js').RegionSpec} spec @param {ReturnType<import('./geology.js').canonGrid>} canon @param {Field} elev metres
 */
export function climate(spec, canon, elev) {
  const g = regionGrid(spec), n = g.w * g.h;
  // the provinces' own numbers, blended across their borders over some 10 km
  const t0 = new Field(g.w, g.h, g.frame), p0 = new Field(g.w, g.h, g.frame), s0 = new Field(g.w, g.h, g.frame);
  const wx = new Field(g.w, g.h, g.frame), wy = new Field(g.w, g.h, g.frame);
  for (let k = 0; k < n; k++) {
    const i = k % g.w, j = (k / g.w) | 0, t = canon.theatre.data[k] || nearestLand(canon, i, j), prof = provinceProfile(t);
    const [, py] = worldToPicture(spec.fit, ...g.centre(i, j)), dy = py - provinceMidY(spec.fit, t);
    t0.data[k] = prof.temp + LATITUDE * dy;
    p0.data[k] = Math.max(40, prof.precip + prof.southWet * dy);
    s0.data[k] = prof.season;
    wx.data[k] = prof.wind[0]; wy.data[k] = prof.wind[1];
  }
  const r = Math.max(1, Math.round(6 * spec.res));
  const T0 = blur(t0, r), P0 = blur(p0, r), S0 = blur(s0, r), WX = blur(wx, r), WY = blur(wy, r);
  // the land the wind crosses: the region's own, the canon's relief past its edge
  const ground = (x, y) => (elev.covers(x, y) ? elev.at(x, y) : byteMetres(canonRelief(...worldToPicture(spec.fit, x, y))));
  const temp = elev.like(), precip = elev.like(), humidity = elev.like(), season = elev.like();
  const sea = (x, y) => canonTheatre(...worldToPicture(spec.fit, x, y)) === 0;
  for (let k = 0; k < n; k++) {
    const i = k % g.w, j = (k / g.w) | 0, [x, y] = g.centre(i, j), e = Math.max(0, elev.data[k]);
    let ux = WX.data[k], uy = WY.data[k];
    const ul = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= ul; uy /= ul;
    // upwind: the rise into the wind over the last few pixels, the highest ridge the air crossed, and the sea's nearness
    const back = ground(x - ux * 3, y - uy * 3);
    const rise = Math.max(0, e - Math.max(0, back));
    let ridge = 0, seaNear = 0;
    for (let s = 1; s <= FETCH_STEPS; s++) {
      const qx = x - ux * s * FETCH_PX, qy = y - uy * s * FETCH_PX, q = ground(qx, qy);
      if (q > ridge) ridge = q;
      if (!seaNear && sea(qx, qy)) seaNear = 1 - (s - 1) / FETCH_STEPS;
    }
    const shadow = Math.max(0, ridge - e) / 1000;
    const p = P0.data[k] * (1 + OROGRAPHIC * rise / 1000 + 0.25 * seaNear) / (1 + RAIN_SHADOW * shadow);
    precip.data[k] = clampExact(p, 20, 5000);
    temp.data[k] = T0.data[k] - LAPSE * e + 1.5 * seaNear;
    season.data[k] = S0.data[k] * (1 - 0.35 * seaNear);
    humidity.data[k] = clampExact(precip.data[k] / 2200 + 0.25 * seaNear, 0, 1);
  }
  // the wind on a slope: how a cell stands over its neighbourhood, and its height
  const prom = prominence(elev, Math.max(2, 3 * spec.res)), exposure = elev.like(), solar = elev.like();
  const cell = g.cellM;
  for (let k = 0; k < n; k++) {
    const i = k % g.w, j = (k / g.w) | 0;
    exposure.data[k] = clampExact(0.5 + prom.data[k] / 400 + Math.max(0, elev.data[k]) / 6000, 0, 1);
    // the sun from the south, 45 degrees up (y runs south): a normal's share of it, 1 on flat ground, more facing south
    const gx = (elev.get(i + 1, j) - elev.get(i - 1, j)) / (2 * cell), gy = (elev.get(i, j + 1) - elev.get(i, j - 1)) / (2 * cell);
    const nl = Math.sqrt(gx * gx + gy * gy + 1);
    solar.data[k] = clampExact((1 - gy) / nl, 0, 1.5);
  }
  return { temp, precip, humidity, exposure, solar, season };
}

/** The theatre of the nearest land cell in the row (a sea cell takes its coast's numbers). */
function nearestLand(canon, i, j) {
  const t = canon.theatre;
  for (let d = 1; d < t.w; d++) {
    const a = t.get(i - d, j), b = t.get(i + d, j);
    if (a) return a;
    if (b) return b;
  }
  return 0;
}
