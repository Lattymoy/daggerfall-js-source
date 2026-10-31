// WG2 SETTLEMENT 2.0 (bible/03-World/World-2-Canon.md, "Settlements"): A TOWN MADE FROM ITS GROUND, in the stages the
// specification names - A the site and its footprint, B its entrances, plaza and main roads, C its districts, D its
// streets, E its plots, F its buildings, G the wells, markets, walls, docks, fields and gardens - each reading the
// land through a region's sampler (regionSampler.js). The culture's style (data/styles.json) changes the geometry, not
// only the look: a courtyard town's short lanes, a terraced town's contour streets, a stilt village's boardwalks. Every
// building stands on its ground: levelled, terraced with a wall, or raised on stilts - recorded as terrain operations,
// so the same seed makes the same town and the same ground. No RMB block is read.
import STYLES_JSON from '../data/styles.json' with { type: 'json' };
import TYPES_JSON from '../data/settlementTypes.json' with { type: 'json' };
import PREFABS_JSON from '../data/prefabs.json' with { type: 'json' };
import { rand01, seedOf, noise2, smoothstep } from '../exact.js';
import { CellHeap } from '../gridOps.js';
import { WATER } from '../hydrology.js';
import { ROLES } from './buildingRecord.js';
import { PIXEL_M } from '../regionSampler.js';
import { worldPixelKey } from '../../worldWide/worldGrid.js';
import { padAt, PAD_MARGIN_M } from '../padLaw.js';

export const STYLES = Object.freeze(STYLES_JSON.styles);
export const SETTLEMENT_TYPES = Object.freeze(TYPES_JSON.types);
export const PREFABS = Object.freeze(PREFABS_JSON.prefabs);
export const PREFAB_BUDGETS = Object.freeze(PREFABS_JSON.budgets);
export const styleOf = (k) => STYLES.find((s) => s.key === k) ?? null;
export const typeOf = (k) => SETTLEMENT_TYPES.find((t) => t.key === k) ?? null;

/** The rays a footprint is cast along: 48 unit vectors, made by turning one by 7.5 degrees (its cosine and sine as
 *  literals: exact, WG-2). */
export const RAYS = (() => {
  const C = 0.9914448613738104, S = 0.13052619222005157, out = [];
  let x = 1, y = 0;
  for (let k = 0; k < 48; k++) { out.push([x, y]); [x, y] = [x * C - y * S, x * S + y * C]; }
  return out;
})();
/** Steps and limits, metres. */
export const RAY_STEP = 6;
export const GRID_M = 6;
export const STREET_STEP = 8;
/** The steepest ground a street climbs and a plot stands on unterraced; a terraced style's (rise over run). */
export const STREET_SLOPE = 0.22;
export const TERRACED_SLOPE = 0.38;
/** The most a plot's corners may differ and be levelled on a plinth, and terraced with a retaining wall (m). */
export const PLINTH_M = 1.2;
export const TERRACE_M = 5;
export const STILTS_M = 2.5;

/** @typedef {{ id: string, name: string, type: string, style: string, x: number, y: number, seed: number, mapId?: number,
 *   regenerate?: string[], keep?: any }} SettlementSpec x, y: the centre, world pixels; regenerate: districts to make again */

/**
 * Make a settlement. Answers its record: footprint, plaza, entrances, roads, districts, plots, buildings (ids unminted -
 * buildingRecord.js mintIds gives them), features and terrain operations. `keep` (a settlement made before) and
 * `regenerate` (district keys) make again only those districts' streets, plots and buildings, keeping every other one.
 * @param {import('../regionSampler.js').RegionSampler} S @param {SettlementSpec} spec
 */
export function generateSettlement(S, spec) {
  const type = typeOf(spec.type), style = styleOf(spec.style);
  if (!type || !style) throw new Error(`settlement ${spec.id}: type ${spec.type} or style ${spec.style} unknown`);
  const seed = seedOf(spec.seed, spec.id), cx = spec.x, cy = spec.y;
  const W = (lx, ly) => [cx + lx / PIXEL_M, cy + ly / PIXEL_M];
  // the ground with every pad laid so far: a later building stands on what the earlier ones left (padLaw.js)
  const pads = [];
  const ground = (lx, ly) => { const [x, y] = W(lx, ly); let h = S.heightAt(x, y); for (const p of pads) h = padAt(p, x, y, h); return h; };
  const wetAt = (lx, ly) => { const e = /** @type {any} */ (S.env(...W(lx, ly))); return !!(e.water & WATER.wetland); };
  const waterAt = (lx, ly) => !!S.waterAt(...W(lx, ly));
  /** Water, or a channel's bank (a ray's step must not jump a narrow river). */
  const shoreAt = (lx, ly) => { if (waterAt(lx, ly)) return true; const c = S.channel(...W(lx, ly)); return !!c && c.d < c.half + RAY_STEP / 2; };
  const slopeAt = (lx, ly) => S.slopeAt(...W(lx, ly));
  const maxSlope = style.layout === 'terraced' ? TERRACED_SLOPE : STREET_SLOPE;
  const overWater = style.raised;
  const R = type.radius * (0.85 + 0.3 * rand01(seed, 1));

  // ── A: THE FOOTPRINT - each ray out until water (a raised style's boardwalks go on over it), too steep, or its reach
  const reach = RAYS.map((d, k) => {
    const lim = R * (0.8 + 0.4 * (0.5 + 0.5 * noise2(seed, k * 0.37, 1.7)));
    let r = 0, stop = 'reach', shore = 0;
    for (let s = RAY_STEP; s <= lim; s += RAY_STEP) {
      const lx = d[0] * s, ly = d[1] * s;
      if (!S.owns(...W(lx, ly))) { stop = 'edge'; break; }
      if (!shore && shoreAt(lx, ly)) shore = s;
      if (shore && !overWater) { stop = 'water'; break; }
      if (slopeAt(lx, ly) > maxSlope * 1.6) { stop = 'steep'; break; }
      r = s;
    }
    return { r, stop, shore };
  });
  const radii = reach.map((_, k) => Math.max(RAY_STEP * 2, (reach[(k + 47) % 48].r + 2 * reach[k].r + reach[(k + 1) % 48].r) / 4));
  const footprint = RAYS.map((d, k) => W(d[0] * radii[k], d[1] * radii[k]));
  const rayOf = (lx, ly) => {   // the ray nearest a direction: the largest dot product (no angle)
    let best = 0, bk = 0;
    const l = Math.sqrt(lx * lx + ly * ly) || 1;
    for (let k = 0; k < 48; k++) { const v = (RAYS[k][0] * lx + RAYS[k][1] * ly) / l; if (v > best) { best = v; bk = k; } }
    return bk;
  };
  const inside = (lx, ly, margin = 0) => { const k = rayOf(lx, ly); return Math.sqrt(lx * lx + ly * ly) <= radii[k] + margin; };

  // ── B: THE PLAZA, THE ENTRANCES, THE MAIN ROADS
  const plaza = { r: Math.min(30, 10 + type.radius / 14), level: ground(0, 0) };
  const docks = [], entrances = [];
  if (type.docks) {
    let bk = -1;
    for (let k = 0; k < 48; k++) if (reach[k].shore && (bk < 0 || reach[k].shore < reach[bk].shore)) bk = k;
    if (bk >= 0) docks.push({ k: bk, at: [RAYS[bk][0] * reach[bk].shore, RAYS[bk][1] * reach[bk].shore], dir: RAYS[bk] });
  }
  const scoreRay = (k) => radii[k] / R - slopeAt(RAYS[k][0] * radii[k], RAYS[k][1] * radii[k]) * 2 + 0.3 * rand01(seed, 2, k) - (reach[k].stop === 'water' ? 1 : 0);
  const order = [...Array(48).keys()].sort((a, b) => scoreRay(b) - scoreRay(a) || a - b);
  const sep = Math.floor(48 / (type.entrances + 1));
  for (const k of order) {
    if (entrances.length >= type.entrances) break;
    if (entrances.some((e) => Math.min(Math.abs(e.k - k), 48 - Math.abs(e.k - k)) < sep) || docks.some((d) => d.k === k)) continue;
    entrances.push({ k, at: [RAYS[k][0] * radii[k], RAYS[k][1] * radii[k]], dir: RAYS[k] });
  }
  const grid = costGrid(R + 40, (lx, ly) => {
    if (waterAt(lx, ly)) return overWater ? 4 : 60;
    const s = slopeAt(lx, ly);
    return 1 + 40 * s * s + (s > maxSlope ? 30 : 0) + (wetAt(lx, ly) && !overWater ? 3 : 0);
  });
  const roads = [];
  for (const e of [...entrances, ...docks]) {
    const path = aStar(grid, e.at, [0, 0], plaza.r);
    if (path.length > 1) roads.push({ kind: 'main', width: style.street, pts: smooth(path), from: e === docks[0] ? 'dock' : 'gate' });
  }

  // ── C: THE DISTRICTS - each kind's seeds where its rule says, the ground to the nearest seed
  const lattice = [];
  for (let ly = -R; ly <= R; ly += 20) for (let lx = -R; lx <= R; lx += 20) if (inside(lx, ly, -4) && !waterAt(lx, ly)) lattice.push([lx, ly]);
  const nearRoad = (lx, ly) => { let d = Infinity; for (const r of roads) d = Math.min(d, polyDist(r.pts, lx, ly)); return d; };
  const rule = {
    commercial: (p) => -Math.sqrt(p[0] * p[0] + p[1] * p[1]) / R - nearRoad(...p) / 60,
    religious: (p) => (ground(...p) - plaza.level) / 40 - Math.sqrt(p[0] * p[0] + p[1] * p[1]) / R,
    military: (p) => (ground(...p) - plaza.level) / 30 - Math.min(...entrances.map((e) => Math.sqrt(sq(e.at[0] - p[0]) + sq(e.at[1] - p[1]))), R) / R,
    industrial: (p) => Math.sqrt(p[0] * p[0] + p[1] * p[1]) / R - (S.waterNear(...W(...p), 160) < 160 ? -0.6 : 0),
    agricultural: (p) => Math.sqrt(p[0] * p[0] + p[1] * p[1]) / R + /** @type {any} */ (S.env(...W(...p))).fertility,
    residential: (p) => rand01(seed, 9, Math.round(p[0]), Math.round(p[1])),
  };
  const districts = [];
  const K = Math.max(3, Math.round(R / 40));
  for (const kind of Object.keys(type.districts).sort()) {
    const n = Math.max(1, Math.round(type.districts[kind] * K));
    const ranked = lattice.map((p, i) => ({ p, v: rule[kind] ? rule[kind](p) : 0, i })).sort((a, b) => b.v - a.v || a.i - b.i);
    let placed = 0;
    for (const c of ranked) {
      if (placed >= n) break;
      if (districts.some((d) => sq(d.at[0] - c.p[0]) + sq(d.at[1] - c.p[1]) < sq(R / 3))) continue;
      districts.push({ key: `${kind}-${placed}`, kind, at: c.p });
      placed++;
    }
  }
  if (!districts.length) districts.push({ key: 'residential-0', kind: 'residential', at: [0, 0] });
  const districtOf = (lx, ly) => {
    const wx = lx + 12 * noise2(seed + 3, lx / 60, ly / 60), wy = ly + 12 * noise2(seed + 4, lx / 60, ly / 60);
    let best = Infinity, d = districts[0];
    for (const q of districts) { const v = sq(q.at[0] - wx) + sq(q.at[1] - wy); if (v < best) { best = v; d = q; } }
    return d;
  };

  // ── D: THE STREETS - from the main roads every `spacing`, turned toward the contour by the style's bend, until the
  // footprint, water, a steep or another street stops them; a radial town's rings; a grid town's cross streets
  const regen = new Set(spec.regenerate ?? []), keep = spec.keep && regen.size ? spec.keep : null;
  const keptStreets = keep ? keep.roads.filter((r) => r.kind !== 'main' && !regen.has(r.district)) : [];
  const streets = [...keptStreets.map((r) => ({ ...r, pts: r.pts.map(([x, y]) => toLocal(x, y)) }))];
  const allRoads = () => [...roads, ...streets];
  const near = (lx, ly, gap, except) => allRoads().some((r) => r !== except && polyDist(r.pts, lx, ly) < gap);
  const laneW = style.layout === 'courtyard' ? style.lane : (style.street + style.lane) / 2;
  const maxLen = style.layout === 'courtyard' ? style.spacing * 1.4 : R;
  const march = (start, dir, parent, district) => {
    const pts = [start];
    let [x, y] = start, [dx, dy] = dir;
    for (let len = 0; len < maxLen; len += STREET_STEP) {
      const g = gradient(ground, x, y), gl = Math.sqrt(g[0] * g[0] + g[1] * g[1]);
      if (gl > 1e-6 && style.bend > 0) {
        let tx = -g[1] / gl, ty = g[0] / gl;
        if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; }
        const b = style.bend * smoothstep(0.02, 0.12, gl);
        dx += (tx - dx) * b; dy += (ty - dy) * b;
        const l = Math.sqrt(dx * dx + dy * dy); dx /= l; dy /= l;
      }
      const nx = x + dx * STREET_STEP, ny = y + dy * STREET_STEP;
      if (!inside(nx, ny, -3) || (waterAt(nx, ny) && !overWater) || slopeAt(nx, ny) > maxSlope) break;
      if (len > STREET_STEP && near(nx, ny, style.spacing * 0.45, parent)) break;
      if (Math.sqrt(nx * nx + ny * ny) < plaza.r) break;
      if (districtOf(nx, ny).key !== district) break;
      x = nx; y = ny; pts.push([x, y]);
    }
    return pts;
  };
  for (const road of roads) {
    const along = resample(road.pts, style.spacing);
    along.forEach((p, i) => {
      if (i === 0 || Math.sqrt(p.x * p.x + p.y * p.y) < plaza.r + style.spacing * 0.5) return;
      for (const side of [1, -1]) {
        const start = [p.x + side * -p.ty * (road.width / 2 + 1), p.y + side * p.tx * (road.width / 2 + 1)], d = districtOf(...start);
        if (keep && !regen.has(d.key)) continue;
        const pts = march(start, [side * -p.ty, side * p.tx], road, d.key);
        if (pts.length > 2) streets.push({ kind: overWater && pts.some(([x, y]) => waterAt(x, y) || wetAt(x, y)) ? 'boardwalk' : style.layout === 'courtyard' ? 'lane' : 'street', width: laneW, pts, district: d.key });
      }
    });
  }
  if (style.layout === 'radial' || style.layout === 'grid') {
    for (const s of [...streets]) {
      if (s.pts.length < 4) continue;
      for (const p of resample(s.pts, style.spacing).slice(1)) {
        for (const side of [1, -1]) {
          const start = [p.x + side * -p.ty * (s.width / 2 + 1), p.y + side * p.tx * (s.width / 2 + 1)], d = districtOf(...start);
          if (keep && !regen.has(d.key)) continue;
          const pts = march(start, [side * -p.ty, side * p.tx], s, d.key);
          if (pts.length > 2) streets.push({ kind: 'street', width: laneW, pts, district: d.key });
        }
      }
    }
  }

  // ── E, F: THE PLOTS AND THEIR BUILDINGS - along every road and street, both sides, each plot standing on its ground
  const placed = keep ? keep.buildings.filter((b) => !regen.has(b.district)).map((b) => ({ ...b, rect: rectOf(toLocal(b.at.x, b.at.y), b.at.dir, b.footprint, 0) })) : [];
  const features = keep ? keep.features.filter((f) => !regen.has(f.district)) : [];
  const ops = keep ? keep.terrainOps.filter((o) => !regen.has(o.district)) : [];
  pads.push(...ops.filter((o) => o.kind === 'pad'));
  const made = [];
  const plotOk = (r) => !placed.some((b) => overlaps(b.rect, r)) && !made.some((b) => overlaps(b.rect, r));
  const [pw0, pw1] = style.plot[0], [pd0, pd1] = style.plot[1];
  allRoads().forEach((road, ri) => {
    const along = resample(road.pts, (pw0 + pw1) / 2 + 2);
    along.forEach((p, i) => {
      for (const side of [1, -1]) {
        const u = rand01(seed, 11, ri, i, side + 2), w = pw0 + (pw1 - pw0) * u, d = pd0 + (pd1 - pd0) * rand01(seed, 12, ri, i, side + 2);
        const nx = side * -p.ty, ny = side * p.tx, off = road.width / 2 + style.setback + d / 2;
        const c = [p.x + nx * off, p.y + ny * off], dir = /** @type {[number, number]} */ ([-nx, -ny]);
        const dist = districtOf(...c);
        if (keep && !regen.has(dist.key)) continue;
        if (Math.sqrt(c[0] * c[0] + c[1] * c[1]) < plaza.r + d / 2 || !inside(...c, -2)) continue;
        const rect = rectOf(c, dir, [w, d], 1), bare = rectOf(c, dir, [w, d], 0);
        if (!plotOk(rect)) continue;
        if (edgePoints(bare).some(([x, y]) => allRoads().some((r) => polyDist(r.pts, x, y) < r.width / 2 + 0.2))) continue;
        if (!standOn(bare)) continue;   // a plot that cannot stand any building
        made.push({ c, dir, w, d, rect, stand: standOn(bare), district: dist, genKey: `${dist.key}:${ri}:${i}:${side}` });
      }
    });
  });
  /** How a plot stands: on a plinth, terraced, or raised; null where it cannot. */
  function standOn(rect) {
    const pts = spanPoints(rect), hs = pts.map(([x, y]) => ground(x, y)), lo = Math.min(...hs), hi = Math.max(...hs);
    const wet = pts.some(([x, y]) => waterAt(x, y) || wetAt(x, y));
    if (overWater && wet) {
      let top = hi;
      for (const [x, y] of pts) { const w = S.waterAt(...W(x, y)); if (w) top = Math.max(top, w.surface); }
      return { kind: 'stilts', level: top + STILTS_M, lo };
    }
    if (pts.some(([x, y]) => waterAt(x, y))) return null;
    if (hi - lo <= PLINTH_M) return { kind: 'plinth', level: hi + 0.2, lo };
    if (hi - lo <= (style.layout === 'terraced' ? TERRACE_M * 1.6 : TERRACE_M)) return { kind: 'terrace', level: (hi + lo) / 2, lo, hi };
    return null;
  }

  // the roles: the type's services first, each on the best plot for it; the rest by district
  const want = [...type.services];
  const roleScore = {
    tavern: (m) => -dist0(m.c) - (m.district.kind === 'commercial' ? -40 : 0),
    store: (m) => -dist0(m.c) + (m.district.kind === 'commercial' ? 60 : 0),
    temple: (m) => (m.stand.level - plaza.level) * 3 - dist0(m.c) * 0.5 + (m.district.kind === 'religious' ? 80 : 0),
    smith: (m) => (m.district.kind === 'industrial' ? 80 : 0) - dist0(m.c) * 0.3,
    guild: (m) => -dist0(m.c) + (m.district.kind === 'commercial' ? 30 : 0),
    bank: (m) => -dist0(m.c) + (m.district.kind === 'commercial' ? 40 : 0),
    barracks: (m) => (m.district.kind === 'military' ? 80 : 0) - Math.min(...entrances.map((e) => Math.sqrt(sq(e.at[0] - m.c[0]) + sq(e.at[1] - m.c[1]))), 999) * 0.3,
    warehouse: (m) => -(docks.length ? Math.sqrt(sq(docks[0].at[0] - m.c[0]) + sq(docks[0].at[1] - m.c[1])) : dist0(m.c)),
    harbour: (m) => -(docks.length ? Math.sqrt(sq(docks[0].at[0] - m.c[0]) + sq(docks[0].at[1] - m.c[1])) : dist0(m.c)),
    mine: (m) => (m.stand.level - plaza.level) + (m.district.kind === 'industrial' ? 60 : 0),
  };
  const roleOf = new Map();
  for (const svc of want) {
    if (svc === 'well') continue;
    const role = svc === 'store' ? 'shop' : svc;
    if (!ROLES[role]) continue;
    let best = null, bv = -Infinity;
    for (const m of made) { if (roleOf.has(m)) continue; const v = (roleScore[svc] ?? roleScore.tavern)(m); if (v > bv) { bv = v; best = m; } }
    if (best) roleOf.set(best, role);
  }
  const byDistrict = { residential: 'house', commercial: 'shop', industrial: 'smith', agricultural: 'barn', religious: 'house', military: 'barracks' };
  const buildings = [...placed.map(({ rect, ...b }) => b)];
  made.forEach((m, i) => {
    let role = roleOf.get(m) ?? byDistrict[m.district.kind] ?? 'house';
    if (!roleOf.has(m) && role !== 'house' && rand01(seed, 21, i) < 0.55) role = 'house';
    const prefab = choosePrefab(role, style.key, m.w, m.d, rand01(seed, 22, i)) ?? choosePrefab('house', style.key, m.w, m.d, rand01(seed, 22, i));
    if (!prefab) return;
    const fp = /** @type {[number, number]} */ ([prefab.footprint[0], prefab.footprint[1]]);
    // the building stands on its own ground, sampled as the validator samples it (spanPoints)
    const stand = standOn(rectOf(m.c, m.dir, fp, 0));
    if (!stand) return;
    m.stand = stand;
    const level = stand.level, front = [m.c[0] + m.dir[0] * fp[1] / 2, m.c[1] + m.dir[1] * fp[1] / 2];
    const [x, y] = W(...m.c), [fx, fy] = W(...front);
    buildings.push({
      settlement: spec.id, district: m.district.key, genKey: m.genKey, role: prefab.role === 'house' && role !== 'house' ? role : prefab.role,
      type: ROLES[role].type, prefab: prefab.id, at: { x, y, z: level, dir: m.dir }, footprint: fp,
      storeys: Math.max(style.storeys[0], Math.min(style.storeys[1], prefab.storeys || 1)),
      doors: prefab.doors.length ? [{ x: fx, y: fy, z: level, dir: m.dir }] : [], services: ROLES[role].services, access: ROLES[role].access,
      interior: { kind: role === 'well' ? 'none' : 'generated', ref: { prefab: prefab.id, seed: rand01(seed, 23, i) } },
      ground: { kind: m.stand.kind, level },
    });
    if (m.stand.kind === 'terrace') {
      const pad = { kind: 'pad', district: m.district.key, at: [x, y], dir: m.dir, size: [fp[0] + 2 * PAD_MARGIN_M, fp[1] + 2 * PAD_MARGIN_M], level };
      ops.push(pad);
      pads.push(pad);
      if (level - m.stand.lo > PLINTH_M) features.push({ kind: 'retaining', district: m.district.key, at: [x, y], dir: m.dir, height: level - m.stand.lo });
    }
    if (m.stand.kind === 'stilts') features.push({ kind: 'platform', district: m.district.key, at: [x, y], size: fp, level, stilts: level - m.stand.lo });
    const street = ground(...front.map((v, k) => v + m.dir[k] * (style.setback + 1)));
    if (Math.abs(level - street) > 0.6 && m.stand.kind !== 'stilts') features.push({ kind: 'stairs', district: m.district.key, at: [fx, fy], dir: m.dir, rise: level - street });
  });

  // ── G: THE PLAZA'S WELL AND MARKET, THE WALLS AND GATES, THE DOCKS, THE FIELDS, THE BRIDGES
  const [px, py] = W(0, 0);
  if (!keep) {
    features.push({ kind: 'well', district: 'plaza', at: [px, py], level: plaza.level });
    if (type.districts.commercial) for (let k = 0; k < 48; k += 6) features.push({ kind: 'stall', district: 'plaza', at: W(RAYS[k][0] * plaza.r * 0.7, RAYS[k][1] * plaza.r * 0.7), dir: [-RAYS[k][0], -RAYS[k][1]] });
    if (type.walls || (style.walls && ['town', 'port', 'riverTown'].includes(type.key))) {
      const ring = RAYS.map((d, k) => W(d[0] * (radii[k] + 4), d[1] * (radii[k] + 4)));
      features.push({ kind: 'wall', district: 'walls', pts: ring, height: 6 });
      for (const e of entrances) features.push({ kind: 'gate', district: 'walls', at: W(e.at[0] + e.dir[0] * 4, e.at[1] + e.dir[1] * 4), dir: e.dir });
    }
    for (const dk of docks) features.push({ kind: 'dock', district: 'docks', at: W(...dk.at), dir: dk.dir, length: 24 });
    if (type.fields) {
      for (let ly = -R * 1.7; ly <= R * 1.7; ly += 60) for (let lx = -R * 1.7; lx <= R * 1.7; lx += 40) {
        const r2 = lx * lx + ly * ly;
        if (r2 < (R + 20) * (R + 20) || r2 > (R * 1.7) * (R * 1.7) || !S.owns(...W(lx, ly)) || waterAt(lx, ly) || slopeAt(lx, ly) > 0.08) continue;
        if (/** @type {any} */ (S.env(...W(lx, ly))).fertility < 0.15 && !S.waterNear(...W(lx, ly), 160)) continue;
        features.push({ kind: 'field', district: 'fields', at: W(lx, ly), size: [36, 54] });
      }
    }
    for (const r of roads) {
      let run = null;
      r.pts.forEach(([x, y], i) => {
        const wet = waterAt(x, y);
        if (wet && !run) run = { from: i };
        if ((!wet || i === r.pts.length - 1) && run) { features.push({ kind: 'bridge', district: 'roads', from: W(...r.pts[Math.max(0, run.from - 1)]), to: W(x, y) }); run = null; }
      });
    }
  }
  const world = (r) => ({ ...r, pts: r.pts.map(([x, y]) => [...W(x, y), ground(x, y)]) });
  return {
    id: spec.id, name: spec.name, type: type.key, style: style.key, services: type.services, mapId: spec.mapId ?? null, seed: spec.seed, centre: { x: cx, y: cy, key: worldPixelKey(Math.floor(cx), Math.floor(cy)) },
    radius: R, footprint, plaza: { x: px, y: py, r: plaza.r, level: plaza.level },
    entrances: entrances.map((e) => ({ at: W(...e.at), dir: e.dir })), docks: docks.map((d) => ({ at: W(...d.at), dir: d.dir })),
    roads: [...roads.map(world), ...streets.map(world)], districts: districts.map((d) => ({ key: d.key, kind: d.kind, at: W(...d.at) })),
    buildings, features, terrainOps: ops,
  };
  function toLocal(x, y) { return [(x - cx) * PIXEL_M, (y - cy) * PIXEL_M]; }
}

const dist0 = (c) => Math.sqrt(c[0] * c[0] + c[1] * c[1]);
const sq = (v) => v * v;
function gradient(ground, x, y) { return [(ground(x + 3, y) - ground(x - 3, y)) / 6, (ground(x, y + 3) - ground(x, y - 3)) / 6]; }

/** The prefab for a role that fits a plot (its footprint inside w x d), the style's own or every style's; the largest that
 *  fits, ties by `u`. */
export function choosePrefab(role, style, w, d, u) {
  const fits = PREFABS.filter((p) => p.role === role && (p.styles.includes('*') || p.styles.includes(style)) && p.footprint[0] <= w + 0.01 && p.footprint[1] <= d + 0.01);
  if (!fits.length) return null;
  const own = fits.filter((p) => p.styles.includes(style)), pool = own.length && u < 0.7 ? own : fits;
  pool.sort((a, b) => b.footprint[0] * b.footprint[1] - a.footprint[0] * a.footprint[1] || (a.id < b.id ? -1 : 1));
  return pool[Math.min(pool.length - 1, Math.floor(u * Math.min(2, pool.length)))];
}

/** An oriented rectangle (local metres): its centre, its door's facing, [width, depth], grown by `pad`. */
export function rectOf(c, dir, [w, d], pad) {
  const ax = [-dir[1], dir[0]], hw = w / 2 + pad, hd = d / 2 + pad;
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [c[0] + ax[0] * hw * a + dir[0] * hd * b, c[1] + ax[1] * hw * a + dir[1] * hd * b]);
  return { c, axes: [ax, dir], half: [hw, hd], corners };
}
/** The points a building's ground is read at: a 5 x 5 lattice over its rectangle, corners and edges included - the
 *  generator stands it and the validator checks it on the same points. */
export function spanPoints(r) {
  const out = [], [a0, a1] = r.axes, [hw, hd] = r.half;
  for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
    const u = (i / 2 - 1) * hw, v = (j / 2 - 1) * hd;
    out.push([r.c[0] + a0[0] * u + a1[0] * v, r.c[1] + a0[1] * u + a1[1] * v]);
  }
  return out;
}
/** A rectangle's corners, the middles of its sides and its centre. */
export const edgePoints = (r) => [...r.corners, ...r.corners.map(([x, y], i) => [(x + r.corners[(i + 1) % 4][0]) / 2, (y + r.corners[(i + 1) % 4][1]) / 2]), r.c];
/** Do two oriented rectangles overlap (the separating axis test)? */
export function overlaps(a, b) {
  for (const r of [a, b]) for (const ax of r.axes) {
    const proj = (q) => q.corners.map(([x, y]) => x * ax[0] + y * ax[1]);
    const pa = proj(a), pb = proj(b);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}
/** A point's distance to a polyline. */
export function polyDist(pts, x, y) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const dx = x - ax - vx * t, dy = y - ay - vy * t, d = Math.sqrt(dx * dx + dy * dy);
    if (d < best) best = d;
  }
  if (pts.length === 1) best = Math.sqrt(sq(x - pts[0][0]) + sq(y - pts[0][1]));
  return best;
}
/** Points every `step` metres along a polyline, each with its unit tangent. */
export function resample(pts, step) {
  const out = [];
  let carry = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.sqrt(sq(bx - ax) + sq(by - ay));
    if (l === 0) continue;
    const tx = (bx - ax) / l, ty = (by - ay) / l;
    for (let s = carry; s < l; s += step) out.push({ x: ax + tx * s, y: ay + ty * s, tx, ty });
    carry = (carry - l) % step;
    if (carry < 0) carry += step;
  }
  return out;
}
/** Chaikin twice, ends kept. */
function smooth(pts) {
  let p = pts;
  for (let n = 0; n < 2; n++) {
    if (p.length < 3) break;
    const out = [p[0]];
    for (let i = 0; i + 1 < p.length; i++) { const [ax, ay] = p[i], [bx, by] = p[i + 1]; out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

/** A square grid of the cost of crossing each GRID_M cell, `half` metres each way of the centre. */
function costGrid(half, cost) {
  const n = 2 * Math.ceil(half / GRID_M) + 1, o = (n - 1) / 2, data = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = cost((i - o) * GRID_M, (j - o) * GRID_M);
  return { n, o, data };
}
/** The cheapest way across the grid from a point to within `stop` metres of another (A*, eight ways, ties by index):
 *  its cells' centres, local metres. */
function aStar(g, from, to, stop) {
  const { n, o, data } = g, idx = ([x, y]) => clampI(Math.round(y / GRID_M) + o, n) * n + clampI(Math.round(x / GRID_M) + o, n);
  const start = idx(from), cost = new Float64Array(n * n).fill(Infinity), prev = new Int32Array(n * n).fill(-1), heap = new CellHeap(n * n * 8);
  const at = (k) => [((k % n) - o) * GRID_M, (((k / n) | 0) - o) * GRID_M];
  const h = (k) => { const [x, y] = at(k); return Math.sqrt(sq(x - to[0]) + sq(y - to[1])) / GRID_M; };
  cost[start] = 0; heap.push(start, h(start));
  let end = -1;
  while (heap.size) {
    const k = heap.pop(), [x, y] = at(k);
    if (Math.sqrt(sq(x - to[0]) + sq(y - to[1])) <= stop) { end = k; break; }
    const i = k % n, j = (k / n) | 0;
    for (let d = 0; d < 8; d++) {
      const a = i + [1, 1, 0, -1, -1, -1, 0, 1][d], b = j + [0, 1, 1, 1, 0, -1, -1, -1][d];
      if (a < 0 || b < 0 || a >= n || b >= n) continue;
      const nk = b * n + a, step = (d & 1 ? Math.SQRT2 : 1) * (data[k] + data[nk]) / 2, c = cost[k] + step;
      if (c < cost[nk]) { cost[nk] = c; prev[nk] = k; heap.push(nk, c + h(nk)); }
    }
  }
  if (end < 0) return [];
  const path = [];
  for (let k = end; k >= 0; k = prev[k]) path.push(at(k));
  path.reverse();
  path[0] = from;
  return path;
}
const clampI = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
