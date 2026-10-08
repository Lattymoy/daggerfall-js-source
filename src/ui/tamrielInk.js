// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL1 (2026-10-08, bible/03-World/Tamriel.md) - TAMRIEL ON THE HELD MAP: the continent inked round the Bay.
//
// Mac: "the entirety of tamriel that connects accurately to Daggerfall. Not actually traversalable but used and
// connected as a gigantic map ... seen by players ingame", and "Performance should also not be affected".
//
// The held map's world sheet (ui/heldMap.js) draws the Iliac Bay from the data; this layer draws the rest of Tamriel
// round it from the authored geography (world/tamrielGeography.js), in the same hand - the pen, the wash, the carets
// for the high ground, the dashed borders, the letter-spaced province names - so the sheet reads as one map.
//
// HOW IT JOINS THE BAY. The Bay's own ground is a HOLE in this layer: every authored chain is CLIPPED to the outside
// of the Bay's rectangle (the data's own 1000 x 500, in the sheet's coordinates 0..1000, 0..500), cut exactly at the
// edge, and its cut ends are STITCHED to the Bay's own coast where the data's coast runs off its edge - the Bay's open
// chains end on that edge (inkMap boundarySegments: the edge of the data is not a shore), and a continent chain
// ending on the same edge within STITCH_REACH is moved onto the nearest such end. So the shoreline the player
// follows out of the Bay is the data's where there is data and ours past it, with no step at the join. The seam's
// honesty is the probe's (tools/tamrielFitProbe.mjs): it reports every edge run of land or water the data and the
// authored shape disagree on.
//
// WHAT IT COSTS, AND WHEN. Built ONCE a data set (`tamrielInkFor`, keyed by the Bay model's own coast array), a few
// thousand points. Painted only onto the sheet's KEPT static layer (the window repaints that on a change of view, not
// per frame), and only when the view reaches past the Bay's rectangle - `viewLeavesBay` is one rectangle test, and
// inside the Bay, which is where every map opens and most stay, this layer costs that test and nothing else. Past it,
// its chains are culled per segment as the Bay's are (inkMap penOf).
//
// Pure canvas 2D over the view's own transform (inkMap toPaper); no game data read here - the Bay's coast chains are
// handed in by the window.
// ═══════════════════════════════════════════════════════════════════
import {
  PROVINCES, MOUNTAIN_RANGES, RIVERS, SEAS, CITIES, COAST, ISLANDS, BORDERS, closedRing, pts, provinceAt, seaAt, provinceByKey,
} from '../world/tamrielGeography.js';
import { pictureToBay, bayToPicture, inBay, BAY_W, BAY_H, PIXELS_PER_PICTURE_UNIT, tamrielFrameInBay } from '../world/tamrielFrame.js';
import { makeNoise, octaveNoise } from './introMap.js';   // the intro's own seeded value noise - ONE home for it
import { PEN, NAME_FACE, HALO_PEN, penOf, toPaper, paintGlyph, roundCorners, spacedName } from './inkMap.js';

/** @typedef {{ x: number, y: number }} Pt */

/** How far along the Bay's edge a continent chain's cut end may be moved to meet the data's own coast end, Bay
 *  pixels (33 km). Past it the authored shape and the data disagree, and the chain ends where it was cut. */
export const STITCH_REACH = 40;
/** The coast's fret: one point every FRET_STEP picture units, displaced across the line by up to FRET_AMP units of
 *  seeded noise, so an authored polygon reads as a shore and not a survey. Nothing within FRET_CALM units of the
 *  Bay's rectangle is displaced, so the cut and the stitch meet a straight line. */
export const FRET_STEP = 1;
export const FRET_AMP = 0.7;
export const FRET_CALM = 3;
export const FRET_SEED = 0x7a3e1;
/** The high ground's carets: one lattice point every CARET_LATTICE picture units across a range's band. */
export const CARET_LATTICE = 1;
/** The sheet is on the continent when it is zoomed out past this fraction of the Bay's own fit. */
export const CONTINENT_BELOW = 0.85;
/** A city beyond the Bay answers a hover within this many paper pixels. */
export const CITY_HIT_PX = 9;
/** The words. */
export const TAMRIEL_TEXT = Object.freeze({
  beyond: 'beyond the Bay',
  sea: (name) => name,
  land: (province) => `${province} (beyond the Bay)`,
  city: (province, city) => `${province} : ${city} (beyond the Bay)`,
});

// ── THE MODEL ───────────────────────────────────────────────────

/** The Bay's rectangle in the sheet's coordinates. */
const BAY_RECT = Object.freeze({ x0: 0, y0: 0, x1: BAY_W, y1: BAY_H });

/** Where a segment a-b crosses the rectangle's boundary, as the parameter t along a-b (0..1) - the first crossing
 *  from a; or null when it never does. Liang-Barsky's clip, kept to the entry/exit parameters. */
function rectCrossings(a, b, r) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  const edges = [[-dx, a.x - r.x0], [dx, r.x1 - a.x], [-dy, a.y - r.y0], [dy, r.y1 - a.y]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [t0, t1];
}
const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const insideRect = (p, r) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;

/**
 * A chain cut to the OUTSIDE of a rectangle: the runs that lie outside it, each ending exactly on its edge where
 * it went in. A closed chain (first point repeated last) whose first point is inside is rotated first so no run
 * wraps; one whose first point is outside has its wrapping run joined.
 * @param {Pt[]} chain @param {{x0:number,y0:number,x1:number,y1:number}} r
 * @returns {Pt[][]}
 */
export function clipOutsideRect(chain, r = BAY_RECT) {
  if (chain.length < 2) return chain.length && !insideRect(chain[0], r) ? [chain.slice()] : [];
  const closed = chain[0].x === chain[chain.length - 1].x && chain[0].y === chain[chain.length - 1].y;
  let pts0 = chain;
  if (closed) {
    const open = chain.slice(0, -1);
    let k = open.findIndex((p) => insideRect(p, r));
    if (k < 0) k = 0;
    pts0 = [...open.slice(k), ...open.slice(0, k), open[k]];
  }
  /** @type {Pt[][]} */
  const out = [];
  /** @type {Pt[]} */
  let run = [];
  const flush = () => { if (run.length > 1) out.push(run); run = []; };
  let prevIn = insideRect(pts0[0], r);
  if (!prevIn) run.push(pts0[0]);
  for (let i = 1; i < pts0.length; i++) {
    const a = pts0[i - 1], b = pts0[i];
    const nowIn = insideRect(b, r);
    const cross = rectCrossings(a, b, r);
    if (!prevIn && !nowIn) {
      // both outside: the segment may still pass through the box (a corner clip)
      if (cross && cross[0] > 0 && cross[1] < 1 && cross[0] < cross[1]) {
        run.push(lerpPt(a, b, cross[0])); flush(); run.push(lerpPt(a, b, cross[1]));
      }
      run.push(b);
    } else if (!prevIn && nowIn) {
      run.push(lerpPt(a, b, cross ? cross[0] : 0)); flush();
    } else if (prevIn && !nowIn) {
      run.push(lerpPt(a, b, cross ? cross[1] : 1), b);
    }
    prevIn = nowIn;
  }
  flush();
  // a closed chain that never touched the box is still one closed chain
  if (closed && out.length === 1 && !insideRect(pts0[0], r) && out[0].length === pts0.length) return [out[0]];
  // a closed chain whose first point was outside: the last run and the first are one run
  if (closed && out.length > 1 && !insideRect(pts0[0], r)) {
    const first = out[0], last = out[out.length - 1];
    if (last[last.length - 1].x === pts0[pts0.length - 1].x && last[last.length - 1].y === pts0[pts0.length - 1].y) {
      out.pop(); out[0] = [...last, ...first.slice(1)];
    }
  }
  return out;
}

/** Distance from a point to the rectangle's boundary (0 inside the band, positive outside), picture units. */
function distToRectEdge(x, y, r) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  return Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y);
}

/**
 * The coast's fret: a ring subdivided and displaced across itself by seeded noise, calm near the Bay's rectangle
 * (picture units in, picture units out).
 * @param {Pt[]} ring closed @param {{x0:number,y0:number,x1:number,y1:number}} calmRect
 */
export function fretRing(ring, calmRect, noise = makeNoise(FRET_SEED)) {
  const out = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / FRET_STEP));
    const nx = -(b.y - a.y) / (len || 1), ny = (b.x - a.x) / (len || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const p = lerpPt(a, b, t);
      const calm = Math.min(1, Math.max(0, (distToRectEdge(p.x, p.y, calmRect) - 1) / FRET_CALM));
      const corner = Math.min(t, 1 - t) * 2;   // the authored vertices themselves are kept: k = 0 is the vertex, untouched
      const d = k === 0 ? 0 : (octaveNoise(noise, p.x * 0.9, p.y * 0.9, 3) - 0.5) * 2 * FRET_AMP * calm * Math.min(1, corner * 2 + 0.15);
      out.push({ x: p.x + nx * d, y: p.y + ny * d });
    }
  }
  out.push({ ...out[0] });
  return out;
}

const toBay = (p) => { const [x, y] = pictureToBay(p.x, p.y); return { x, y }; };
const chainToBay = (c) => c.map(toBay);

/** The Bay's open coast ends: every first or last point of a chain that lies on the data's edge. */
export function bayCoastEnds(bayCoast) {
  const onEdge = (p) => p.x === 0 || p.x === BAY_W || p.y === 0 || p.y === BAY_H;
  const ends = [];
  for (const c of bayCoast ?? []) {
    if (c.length < 2) continue;
    const a = c[0], b = c[c.length - 1];
    if (onEdge(a)) ends.push({ x: a.x, y: a.y });
    if (onEdge(b) && (b.x !== a.x || b.y !== a.y)) ends.push({ x: b.x, y: b.y });
  }
  return ends;
}
const edgeOf = (p) => (p.x <= 0 ? 'w' : p.x >= BAY_W ? 'e' : p.y <= 0 ? 'n' : p.y >= BAY_H ? 's' : null);

/**
 * Join the continent's cut coast ends to the Bay's own: a cut end on an edge of the rectangle is moved onto the
 * nearest unclaimed Bay end on the SAME edge within STITCH_REACH. Answers the stitched chains and the count joined.
 * @param {Pt[][]} chains Bay coordinates @param {Pt[]} ends
 */
export function stitchToBay(chains, ends, reach = STITCH_REACH) {
  const free = ends.map((e) => ({ ...e, used: false }));
  let joined = 0;
  const snap = (p) => {
    const e = edgeOf(p);
    if (!e) return p;
    let best = null, bd = reach;
    for (const f of free) {
      if (f.used || edgeOf(f) !== e) continue;
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d < bd) { bd = d; best = f; }
    }
    if (!best) return p;
    best.used = true; joined++;
    return { x: best.x, y: best.y };
  };
  const out = chains.map((c) => {
    if (c.length < 2) return c;
    const r = c.slice();
    r[0] = snap(r[0]);
    r[r.length - 1] = snap(r[r.length - 1]);
    return r;
  });
  return { chains: out, joined };
}

/** A range's carets: lattice points across its band, each with its lattice index for thinning by zoom. */
function rangeCarets(range, noise) {
  const out = [];
  const seen = new Set();
  const P = range.pts.map(([x, y]) => ({ x, y }));
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / (len || 1), ny = (b.x - a.x) / (len || 1);
    const n = Math.max(1, Math.round(len / CARET_LATTICE));
    const rows = Math.round(range.w / CARET_LATTICE);
    for (let k = 0; k <= n; k++) {
      const p = lerpPt(a, b, k / n);
      for (let r = -rows; r <= rows; r++) {
        const taper = 1 - Math.abs(r) / (rows + 1);   // the band thins toward its edge
        if (noise(p.x * 3 + r, p.y * 3 - r) > taper + 0.1) continue;
        const x = p.x + nx * r * CARET_LATTICE, y = p.y + ny * r * CARET_LATTICE;
        const ix = Math.round(x / CARET_LATTICE), iy = Math.round(y / CARET_LATTICE);
        const key = `${ix},${iy}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x, y, ix, iy, peak: Math.abs(r) <= rows / 3 && range.gain >= 0.9 });
      }
    }
  }
  return out;
}

/**
 * THE INK MODEL: everything the painter strokes, in the sheet's (Bay) coordinates, clipped to the outside of the
 * Bay's rectangle and stitched to the Bay's own coast ends. Pure over its inputs.
 * @param {{ bayCoast?: Pt[][] }} [deps]
 */
export function buildTamrielInk({ bayCoast = [] } = {}) {
  const rect = { x0: 0, y0: 0, x1: BAY_W, y1: BAY_H };
  const calm = (() => { const [x0, y0] = bayToPicture(0, 0), [x1, y1] = bayToPicture(BAY_W, BAY_H); return { x0, y0, x1, y1 }; })();
  const noise = makeNoise(FRET_SEED);
  const rings = [closedRing(COAST), ...Object.values(ISLANDS).map((r) => closedRing(r))];
  /** @type {Pt[][]} */
  let coast = [];
  for (const r of rings) for (const c of clipOutsideRect(chainToBay(fretRing(r, calm, noise)), rect)) coast.push(roundCorners(c, 6));
  const ends = bayCoastEnds(bayCoast);
  const stitched = stitchToBay(coast, ends);
  coast = stitched.chains;
  const borders = [];
  for (const b of Object.values(BORDERS)) for (const c of clipOutsideRect(chainToBay(pts(b.run)), rect)) borders.push(roundCorners(c, 12));
  const rivers = [];
  for (const rv of RIVERS) for (const c of clipOutsideRect(chainToBay(rv.pts.map(([x, y]) => ({ x, y }))), rect)) rivers.push(roundCorners(c, 12));
  const carets = [];
  for (const rg of MOUNTAIN_RANGES) for (const c of rangeCarets(rg, noise)) { const q = toBay(c); if (!inBay(q.x, q.y)) carets.push({ ...c, x: q.x, y: q.y }); }
  const provinces = PROVINCES.map((p) => { const [x, y] = pictureToBay(p.label[0], p.label[1]); return { key: p.key, name: p.name, x, y }; });
  const seas = SEAS.map((s) => { const [x, y] = pictureToBay(s.at[0], s.at[1]); return { name: s.name, x, y }; });
  const cities = CITIES.map((c) => { const [x, y] = pictureToBay(c.at[0], c.at[1]); return { name: c.name, province: c.province, capital: !!c.capital, x, y }; })
    .filter((c) => !inBay(c.x, c.y));
  const frame = tamrielFrameInBay();
  return { coast, borders, rivers, carets, provinces, seas, cities, frame, joined: stitched.joined, bayEnds: ends.length };
}

/** ONE model a data set: keyed by the Bay model's own coast array (the window mints one per WOODS buffer). */
const _inks = new WeakMap();
const _noBay = { ink: null };
export function tamrielInkFor(bayModel) {
  const key = bayModel?.coast;
  if (!key) { if (!_noBay.ink) _noBay.ink = buildTamrielInk(); return _noBay.ink; }
  let ink = _inks.get(key);
  if (!ink) { ink = buildTamrielInk({ bayCoast: key }); _inks.set(key, ink); }
  return ink;
}

// ── THE PAINT ───────────────────────────────────────────────────

/** Does the view reach past the Bay's own ground? ONE rectangle test - the whole of this layer's cost while the
 *  sheet shows the Bay. */
export function viewLeavesBay(view, paperW, paperH) {
  const s = view.scale;
  return view.ox < 0 || view.oy < 0 || view.ox + paperW / s > BAY_W || view.oy + paperH / s > BAY_H;
}

/** Is the sheet out on the continent - zoomed past CONTINENT_BELOW of the Bay's own fit? */
export const onContinent = (scale, bayFit) => scale < bayFit * CONTINENT_BELOW;

/**
 * The continent onto the sheet, over the Bay's own static ink (which clears the canvas first, so this comes after).
 * Answers whether anything was painted.
 * @param {CanvasRenderingContext2D} ctx @param {{ox:number,oy:number,scale:number}} view
 * @param {ReturnType<typeof buildTamrielInk>} ink
 * @param {{ paperW: number, paperH: number, continent?: boolean, bayFit?: number }} opts
 */
export function paintTamrielInk(ctx, view, ink, opts) {
  const { paperW, paperH } = opts;
  if (!ink || !viewLeavesBay(view, paperW, paperH)) return false;
  const s = view.scale;
  const continent = opts.continent ?? false;
  const { visible, stroke } = penOf(ctx, view, paperW, paperH);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // the shore, in the Bay's own hand
  stroke(ink.coast, Math.max(3, s * 1.6), PEN.wash);
  stroke(ink.coast, 1.3, PEN.line);
  // the high ground: the lattice thinned so a caret never lands under its neighbour
  const unit = s * PIXELS_PER_PICTURE_UNIT * CARET_LATTICE;   // paper px between lattice points
  const k = Math.max(1, Math.ceil(5 / Math.max(unit, 1e-6)));
  const caret = Math.max(2.5, Math.min(7, s * 0.9));
  ctx.strokeStyle = PEN.relief;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const h of ink.carets) {
    if (h.ix % k !== 0 || h.iy % k !== 0 || !visible(h.x, h.y)) continue;
    const [x, y] = toPaper(view, h.x, h.y);
    const c = h.peak ? caret * 1.3 : caret;
    ctx.moveTo(x - c, y + c * 0.6); ctx.lineTo(x, y - c * 0.6); ctx.lineTo(x + c, y + c * 0.6);
  }
  ctx.stroke();
  // the provinces' borders, and the rivers
  stroke(ink.borders, 1, PEN.soft, [4, 3]);
  stroke(ink.rivers, 1, PEN.soft);
  // the Bay's own edge: a faint dotted frame, so the player sees where the data's ground ends
  const bay = [{ x: 0, y: 0 }, { x: BAY_W, y: 0 }, { x: BAY_W, y: BAY_H }, { x: 0, y: BAY_H }, { x: 0, y: 0 }];
  stroke([bay], 1, PEN.wash, [2, 4]);
  // the cities: every capital at any zoom, the rest once the sheet is in to the Bay's own scale
  const all = !continent;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const named = [];
  for (const c of ink.cities) {
    if (!c.capital && !all) continue;
    if (!visible(c.x, c.y)) continue;
    const [x, y] = toPaper(view, c.x, c.y);
    paintGlyph(ctx, c.capital ? 'city' : 'hamlet', x, y, true);
    paintGlyph(ctx, c.capital ? 'city' : 'hamlet', x, y, false);
    named.push([c, x, y]);
  }
  const size = continent ? 11 : 12;
  ctx.font = `${size}px ${NAME_FACE}`;
  ctx.strokeStyle = PEN.halo;
  ctx.lineWidth = 2 * HALO_PEN;
  for (const [c, x, y] of named) ctx.strokeText(c.name, x + (c.capital ? 8 : 5), y + 4);
  ctx.fillStyle = PEN.name;
  for (const [c, x, y] of named) ctx.fillText(c.name, x + (c.capital ? 8 : 5), y + 4);
  // the provinces' names, and the seas'
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PEN.region;
  ctx.font = `300 ${continent ? 15 : 19}px ${NAME_FACE}`;
  for (const p of ink.provinces) {
    if (!visible(p.x, p.y, 60)) continue;
    const [x, y] = toPaper(view, p.x, p.y);
    ctx.fillText(spacedName(p.name), x, y);
  }
  ctx.fillStyle = PEN.soft;
  ctx.font = `italic 300 ${continent ? 13 : 16}px ${NAME_FACE}`;
  for (const sea of ink.seas) {
    if (!visible(sea.x, sea.y, 60)) continue;
    const [x, y] = toPaper(view, sea.x, sea.y);
    ctx.fillText(spacedName(sea.name), x, y);
  }
  ctx.restore();
  return true;
}

/**
 * What a hover over the continent answers: a city within CITY_HIT_PX, else the province, else the sea - or null
 * on the Bay's own ground (the Bay's reads are the window's).
 * @param {number} mx @param {number} my sheet coordinates @param {{ox:number,oy:number,scale:number}} view
 */
export function tamrielPlaceAt(mx, my, view, ink = null) {
  if (inBay(mx, my)) return null;
  if (ink) {
    const reach = CITY_HIT_PX / view.scale;
    let best = null, bd = reach;
    for (const c of ink.cities) {
      const d = Math.hypot(c.x - mx, c.y - my);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) return TAMRIEL_TEXT.city(provinceByKey(best.province)?.name ?? best.province, best.name);
  }
  const [px, py] = bayToPicture(mx, my);
  const p = provinceAt(px, py);
  if (p) return TAMRIEL_TEXT.land(p.name);
  const sea = seaAt(px, py);
  return sea ? TAMRIEL_TEXT.sea(sea.name) : null;
}
