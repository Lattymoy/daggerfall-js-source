// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL1 (2026-10-08, bible/03-World/Tamriel.md) - TAMRIEL ON THE HELD MAP: the continent inked round the Bay.
//
// Mac: "the entirety of tamriel that connects accurately to Daggerfall. Not actually traversalable but used and
// connected as a gigantic map ... seen by players ingame", and "Performance should also not be affected".
//
// The held map's world sheet (ui/heldMap.js) draws the Iliac Bay from the data; this layer draws the rest of Tamriel
// round it from the authored geography (world/tamriel/tamrielGeography.js), in the same hand - the pen, the wash, the carets
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
  PROVINCES, MOUNTAIN_RANGES, RIVERS, SEAS, CITIES, COAST, ISLANDS, BORDERS, closedRing, pts, seaAt, provinceByKey,
} from '../world/tamriel/tamrielGeography.js';
import { pictureToBay, bayToPicture, inBay, BAY_W, BAY_H, tamrielFit, tamrielFrameInBay } from '../world/tamriel/tamrielFrame.js';
// TAMRIEL3: the picture's own land where the world host traced it (world/tamriel/tamrielLand.js) - the coast, the borders and
// the provinces' places come off the trace, the authored shape stands where there is none
import { tamrielTrace, tamrielLandVersion, provinceKeyAt, PROVINCE_OF_ID } from '../world/tamriel/tamrielLand.js';
import { biomeAtPicture, biomeStamp } from '../world/tamriel/tamrielBiomes.js';   // REGION-LINES: the 43 zones' borders on the sheet
// TESA1: the places past the Bay where the trace stands them (world/arenaPlaces.js; TESA12: the port's own)
import { arenaPlaces, arenaPlacesVersion, arenaPixels, arenaStanding } from '../world/arenaPlaces.js';
import { capitalPin, capitalsStanding, capitalsVersion } from '../world/tamrielCapitals.js';   // TESA10d: a capital's pixel on the map, Arena or none
import { arenaRoadsLayer, arenaRoadTiles, arenaRoadTilePixels, arenaRoadsVersion, beyondKey, beyondPixel, ROAD_TILE, roadTileKey } from '../world/arenaRoads.js';
import { DIR, DIR_DELTA } from '../world/road/roadNetwork.js';   // TESA15: a pixel's steps, as the far view draws them   // TESA13: the roads past the Bay, as the kernels paint them; TESA15: a tile at a time
import { pastBayPlacesStamp } from '../world/pastBayPlaces.js';   // TESA15: the places the roads' regions laid, a bin at a time
import { getPixelColorIndex } from './travel/travelMapWindow.js';   // TESA13: a place's classic bucket, under the map's filters
import { locationTypeName } from '../systems/travel/travelOptions.js';   // TESA13: MacroHelper.LocationTypeName - a place's kind in words
import { makeNoise, octaveNoise } from './intro/introMap.js';   // the intro's own seeded value noise - ONE home for it
import { PEN, NAME_FACE, HALO_PEN, FAR_TRACK_PEN, penOf, toPaper, paintGlyph, roundCorners, spacedName, boundarySegments, linkSegments, pathChains, strokePaths, zoomBand, BAND_MARKS, markKind } from './ink/inkMap.js';
import { simplifyChain } from './overworldModel.js';   // TAMRIEL3: the coast's chain thinned as the overworld's are
import { labelPoint } from './provinceMap.js';   // TAMRIEL3: a province's name hangs where the chargen's map hangs it

/** @typedef {{ x: number, y: number }} Pt */
/** TESA13: the host's atlas's answer (world/tamrielAtlas.js placesIn) - the places on a rectangle's pixels. */
/** @typedef {(x0: number, y0: number, x1: number, y1: number) => Array<{ x: number, y: number, type: number, name?: string }>} PlacesIn */

/** How far along the Bay's edge a continent chain's cut end may be moved to meet the data's own coast end, Bay
 *  pixels (52 km). Past it the authored shape and the data disagree, and the chain ends where it was cut. TAMRIEL4: 64,
 *  four of the picture's own pixels at the fit's scale, where it was 40 - the picture cannot place a coast nearer than
 *  its pixels, and on the freeware data Hammerfell's met the Bay's 49 pixels along the south edge and was left there. */
export const STITCH_REACH = 64;
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
/** TESA1: a place's kind, as the hover says it. */
export const ARENA_KIND_WORDS = Object.freeze({ 'city-state': 'city-state', town: 'town', village: 'village' });
/** TESA1: a place's glyph, the Bay's own kinds - a capital is the city glyph whatever its kind. */
export const ARENA_KIND_GLYPHS = Object.freeze({ 'city-state': 'hamlet', town: 'village', village: 'village' });
/** The words. */
export const TAMRIEL_TEXT = Object.freeze({
  beyond: 'beyond the Bay',
  sea: (name) => name,
  land: (province) => `${province} (beyond the Bay)`,
  city: (province, city, kind = null) => (kind ? `${province} : ${city} (${ARENA_KIND_WORDS[kind] ?? kind}, beyond the Bay)` : `${province} : ${city} (beyond the Bay)`),
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

/** TAMRIEL4: a clipped chain without the runs that lie ALONG the rectangle's edge - where the picture's own coast
 *  happens to fall on the Bay's frame (the trace's land just outside it, the picture's sea just inside), the line is
 *  the frame's, not a shore's, and the Bay's own data says what is inside. The chain is cut there; a piece of one
 *  point is dropped. */
/** @param {Pt[]} chain @param {{x0:number,y0:number,x1:number,y1:number}} [r] */
export function dropEdgeRuns(chain, r = BAY_RECT) {
  const onEdge = (a, b) => (a.x === r.x0 && b.x === r.x0) || (a.x === r.x1 && b.x === r.x1) || (a.y === r.y0 && b.y === r.y0) || (a.y === r.y1 && b.y === r.y1);
  const out = [];
  let run = [chain[0]];
  for (let i = 1; i < chain.length; i++) {
    if (onEdge(chain[i - 1], chain[i])) { if (run.length > 1) out.push(run); run = [chain[i]]; } else run.push(chain[i]);
  }
  if (run.length > 1) out.push(run);
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

/** How far (picture pixels) an authored city is moved to stand on its own province's traced land. Past it the city
 *  is left off the sheet: a town the picture puts in the sea is not drawn in the sea. */
export const CITY_SNAP_PX = 10;

/** TAMRIEL4: the smoothing's passes - Chaikin's corner cut, each quartering every corner - so the contour's steps round
 *  to the painted shore they quantise. */
export const SMOOTH_PASSES = 3;
/** TAMRIEL4: a chain's own steps straightened before the cut (picture pixels), and the most a corner is cut - the shore
 *  and the border stay within about half a picture pixel of the traced land (one pixel is 15 km). */
export const COAST_SIMPLIFY_PX = 0.4;
export const COAST_CUT_PX = 0.75;
/** TAMRIEL4: how far a border's end is moved onto the coast, picture pixels. */
export const BORDER_SNAP_PX = 1.5;

/**
 * TAMRIEL4 - THE COAST AT THE PICTURE'S OWN RESOLUTION, NOT ITS STAIRCASE. The land mask's 0.5 contour over its pixel
 * centres (marching squares, the sea round the picture's edge): every edge between a land and a sea centre crossed at
 * its middle, a saddle's two lands kept apart (the trace's land is 4-connected - its pieces are). Segments in picture
 * units, for linkSegments. TAMRIEL3 linked the pixels' own edges and simplified the staircase at three quarters of a
 * pixel: a 15 km tooth on every diagonal shore, and a cape of one pixel a square.
 * @param {(x: number, y: number) => boolean} inside @returns {number[][]}
 */
export function contourSegments(inside, w, h) {
  const v = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && inside(x, y) ? 1 : 0);
  const segs = [];
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const a = v(x, y), b = v(x + 1, y), c = v(x + 1, y + 1), d = v(x, y + 1);
      const k = a * 8 + b * 4 + c * 2 + d;
      if (k === 0 || k === 15) continue;
      const T = [x + 1, y + 0.5], R = [x + 1.5, y + 1], B = [x + 1, y + 1.5], L = [x + 0.5, y + 1];
      const seg = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      switch (k) {
        case 1: case 14: seg(L, B); break;
        case 2: case 13: seg(B, R); break;
        case 3: case 12: seg(L, R); break;
        case 4: case 11: seg(T, R); break;
        case 6: case 9: seg(T, B); break;
        case 7: case 8: seg(T, L); break;
        case 5: seg(T, R); seg(L, B); break;   // b and d land, a saddle: each its own
        case 10: seg(T, L); seg(B, R); break;   // a and c land
        default: break;
      }
    }
  }
  return segs;
}

/** Chaikin's corner cut, `passes` times: a closed chain (its first point repeated last) all round, an open one with
 *  its two ends kept where they are (a border's ends meet the coast and each other). Each cut a quarter of its segment,
 *  never more than `maxCut` along it (a simplified chain's long run would otherwise lose a corner by a quarter of it). */
export function chaikinCapped(chain, passes = SMOOTH_PASSES, maxCut = Infinity) {
  let pts = chain;
  for (let n = 0; n < passes && pts.length > 2; n++) {
    const closed = pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y;
    const src = closed ? pts.slice(0, -1) : pts;
    const m = src.length;
    const q = (a, b) => { const len = Math.hypot(b.x - a.x, b.y - a.y), t = len > 0 ? Math.min(0.25, maxCut / len) : 0.25; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    const out = [];
    if (closed) {
      for (let i = 0; i < m; i++) { const a = src[i], b = src[(i + 1) % m]; out.push(q(a, b), q(b, a)); }
      out.push({ ...out[0] });
    } else {
      out.push(src[0]);
      for (let i = 0; i < m - 1; i++) {
        const a = src[i], b = src[i + 1];
        if (i > 0) out.push(q(a, b));
        if (i < m - 2) out.push(q(b, a));
      }
      out.push(src[m - 1]);
    }
    pts = out;
  }
  return pts;
}

/** A border's open ends moved onto the nearest point of the coast's line within BORDER_SNAP_PX (picture units in and
 *  out) - its nearest point on any of the coast's segments, so a straight shore with no vertex near still takes it. */
function snapEnds(chain, coast) {
  if (chain.length < 2 || (chain[0].x === chain[chain.length - 1].x && chain[0].y === chain[chain.length - 1].y)) return chain;
  const near = (p) => {
    let best = null, bd = BORDER_SNAP_PX;
    for (const c of coast) {
      for (let i = 0; i + 1 < c.length; i++) {
        const a = c[i], b = c[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
        const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bd) { bd = d; best = q; }
      }
    }
    return best ?? p;
  };
  const out = chain.slice();
  out[0] = near(out[0]);
  out[out.length - 1] = near(out[out.length - 1]);
  return out;
}

/** TAMRIEL3: the picture's coast and borders as chains in Bay coordinates, and each province's name at its clearest
 *  point (provinceMap labelPoint). TAMRIEL4: the coast is the land's contour (contourSegments) linked and smoothed
 *  (chaikinCapped) - a shore at the picture's own resolution, no staircase; a border runs where two land pixels change
 *  province, its staircase simplified at a third of a pixel and smoothed with its ends kept, and each end that reaches
 *  the sea moved onto the coast's own line (snapEnds) - so the dashed border meets the shore it divides.
 *  @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace */
export function tracedChains(trace) {
  const { w, h, land, province } = trace;
  const ppu = tamrielFit().ppu;
  const toBay = (seg) => seg.map((p) => { const [x, y] = pictureToBay(p.x, p.y); return { x, y }; });
  const coastPic = linkSegments(contourSegments((x, y) => land[y * w + x] === 1, w, h)).map((c) => chaikinCapped(simplifyChain(c, COAST_SIMPLIFY_PX), SMOOTH_PASSES, COAST_CUT_PX));
  const coast = coastPic.map((c) => simplifyChain(toBay(c), ppu * 0.05));
  const segs = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!land[i]) continue;
      if (x + 1 < w && land[i + 1] && province[i + 1] !== province[i]) segs.push([x + 1, y, x + 1, y + 1]);
      if (y + 1 < h && land[i + w] && province[i + w] !== province[i]) segs.push([x, y + 1, x + 1, y + 1]);
    }
  }
  const borders = linkSegments(segs).map((c) => simplifyChain(toBay(chaikinCapped(snapEnds(simplifyChain(c, COAST_SIMPLIFY_PX), coastPic), SMOOTH_PASSES, COAST_CUT_PX)), ppu * 0.05));
  const labels = [];
  for (const [id, key] of Object.entries(PROVINCE_OF_ID)) {
    const mask = new Uint8Array(w * h);
    let n = 0;
    for (let i = 0; i < mask.length; i++) if (land[i] && province[i] === Number(id)) { mask[i] = 1; n++; }
    if (!n) continue;
    const [lx, ly] = labelPoint(mask, w, h);
    labels.push({ key, px: lx, py: ly });
  }
  return { coast, borders, labels };
}

/** REGION-LINES: the zones' raster's samples a picture unit, each way; the shortest zone border kept (picture units) - the
 *  relief's peaks zones leave specks a cell or two across, which read as noise on the sheet; and a slice's budget (ms) -
 *  the raster is ~0.15 s whole, made a few rows a frame while the map is open (stepZoneInk), never a frame's stall. */
export const ZONE_SAMPLES = 2;
export const ZONE_MIN_CHAIN = 2;
export const ZONE_SLICE_MS = 6;
/** The zones' raster, empty: `row` the next row to sample. */
function zoneRaster(k) {
  const W = 320 * k, H = 200 * k;
  return { k, W, H, row: 0, keys: new Array(W * H).fill(null), zones: new Int32Array(W * H).fill(-1), ids: /** @type {Map<string, number>} */ (new Map()) };
}
/** Rows of the raster sampled until `budget` ms pass (`now` the clock); true once every row is. */
function zoneRows(r, budget, now) {
  const t0 = now(), { k, W, H, keys, zones, ids } = r;
  while (r.row < H && now() - t0 < budget) {
    const j = r.row++;
    for (let i = 0; i < W; i++) {
      const px = (i + 0.5) / k, py = (j + 0.5) / k, key = provinceKeyAt(px, py);
      if (!key) continue;
      const z = biomeAtPicture(key, px, py);
      if (!z) continue;
      let id = ids.get(z.key);
      if (id === undefined) ids.set(z.key, (id = ids.size));
      keys[j * W + i] = key; zones[j * W + i] = id;
    }
  }
  return r.row >= H;
}
/** The sampled raster's borders: where two land samples of ONE province stand in different zones. */
function zoneFinish(r) {
  const { k, W, H, keys, zones } = r, segs = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = j * W + i;
    if (zones[a] < 0) continue;
    if (i + 1 < W && zones[a + 1] >= 0 && keys[a + 1] === keys[a] && zones[a + 1] !== zones[a]) segs.push([i + 1, j, i + 1, j + 1]);
    if (j + 1 < H && zones[a + W] >= 0 && keys[a + W] === keys[a] && zones[a + W] !== zones[a]) segs.push([i, j + 1, i + 1, j + 1]);
  }
  const ppu = tamrielFit().ppu, out = [];
  const len = (c) => { let l = 0; for (let n = 1; n < c.length; n++) l += Math.hypot(c[n].x - c[n - 1].x, c[n].y - c[n - 1].y); return l; };
  for (const c of linkSegments(segs)) {
    const pic = chaikinCapped(simplifyChain(c.map((p) => ({ x: p.x / k, y: p.y / k })), COAST_SIMPLIFY_PX), SMOOTH_PASSES, COAST_CUT_PX);
    if (len(pic) < ZONE_MIN_CHAIN) continue;
    for (const piece of clipOutsideRect(simplifyChain(chainToBay(pic), ppu * 0.05))) if (piece.length > 1) out.push(piece);
  }
  return out;
}
/** REGION-LINES (2026-10-24, the owner: "Theres no visible region lines"): THE ZONES' BORDERS past the Bay - where two land
 *  samples of ONE province stand in different zones (world/tamriel/tamrielBiomes.js biomeAtPicture, TESA-BIOME's 43), on a
 *  raster of `k` samples a picture unit over the land in use (the trace, else the authored rings), linked, simplified and
 *  smoothed as the provinces' borders are (tracedChains), in Bay coordinates, clipped to outside the Bay's rectangle
 *  (Daggerfall's own regions draw there) and short specks dropped. Never along a coast or a province's border: those are
 *  their own chains. Pure over the land and the zones, at once (the window's is made a slice a frame: tamrielZoneChains). */
export function zoneChains(k = ZONE_SAMPLES) {
  const r = zoneRaster(k);
  zoneRows(r, Infinity, () => 0);
  return zoneFinish(r);
}
let _zoneInk = { stamp: -1, chains: /** @type {{x:number,y:number}[][]} */ ([]), build: /** @type {any} */ (null) };
/** The zones' borders as they stand: none while the zones' stamp (the land, the fit - tamrielBiomes.js biomeStamp) is newer
 *  than the last made, whose raster is then begun - stepZoneInk makes it. */
export function tamrielZoneChains() {
  const stamp = biomeStamp();
  if (_zoneInk.stamp !== stamp) _zoneInk = { stamp, chains: [], build: zoneRaster(ZONE_SAMPLES) };
  return _zoneInk.chains;
}
/** One slice of the zones' borders' making, ZONE_SLICE_MS of rows (the window's tick); true when they landed this slice. */
export function stepZoneInk(budget = ZONE_SLICE_MS, now = () => performance.now()) {
  const b = _zoneInk.build;
  if (!b || !zoneRows(b, budget, now)) return false;
  _zoneInk.chains = zoneFinish(b);
  _zoneInk.build = null;
  return true;
}

/** TAMRIEL3: an authored city on the traced land of its own province - where it stands, or the nearest such pixel
 *  within CITY_SNAP_PX, or null (left off). On the authored shape every city already stands in its province. */
export function placeCity(city) {
  const [x, y] = city.at;
  if (provinceKeyAt(x, y) === city.province) return [x, y];
  if (!tamrielTrace()) return null;
  let best = null, bd = CITY_SNAP_PX + 1e-9;
  for (let dy = -CITY_SNAP_PX; dy <= CITY_SNAP_PX; dy++) {
    for (let dx = -CITY_SNAP_PX; dx <= CITY_SNAP_PX; dx++) {
      const d = Math.hypot(dx, dy);
      if (d >= bd) continue;
      if (provinceKeyAt(Math.floor(x) + dx + 0.5, Math.floor(y) + dy + 0.5) === city.province) { bd = d; best = [Math.floor(x) + dx + 0.5, Math.floor(y) + dy + 0.5]; }
    }
  }
  return best;
}

/** TESA1: the ink's cities off the places past the Bay (TESA12: the port's own) - every named place beyond the Bay's
 *  rectangle (the Bay's own are Daggerfall's, inked by the Bay's painter), each a capital where TAMRIEL1 named it one, by
 *  name in its province. TESA2: where a host stands the places
 *  (arenaStanding), each carries the Bay pixel it stands on (`pixel`, world/arenaPlaces.js standArenaPixels) - a portal's
 *  end on the teleport map (TESA-NO-FAST: never a journey); else `pixel` is null and a press picks nothing, as TESA1's did.
 *  @param {NonNullable<ReturnType<typeof arenaPlaces>>} model */
export function arenaInkCities(model) {
  const capital = new Set(CITIES.filter((c) => c.capital).map((c) => `${c.province}|${c.name}`));
  const stood = new Map();
  if (arenaStanding()) for (const p of arenaPixels()?.stood ?? []) stood.set(`${p.provinceIndex}|${p.id}`, { x: p.bx, y: p.by, pinned: !!p.pinned });
  const out = [];
  for (const p of model.places) {
    if (!p.name) continue;
    const [x, y] = pictureToBay(p.px, p.py);
    if (inBay(x, y)) continue;
    const st = stood.get(`${p.provinceIndex}|${p.id}`), pixel = st ? { x: st.x, y: st.y } : capitalStandsAt(p);
    // AUDIT-TESA A7-4: a place on a capital's pixel (its pin, or the capital standing where the places do not) is inked
    // there - on the city the world stands, not on its own point a pixel or more away
    const on = pixel && (st?.pinned || !st) ? [pixel.x + 0.5, pixel.y + 0.5] : [x, y];
    out.push({ name: p.name, province: p.province, capital: capital.has(`${p.province}|${p.name}`), kind: p.kind, x: on[0], y: on[1], pixel });
  }
  return out;
}

export { ROAD_TILE };   // TESA13: the tile the layer is walked in - TESA15: world/arenaRoads.js's, which stamps it

/** TESA13: ARENA'S ROADS AND TRACKS AS THE SHEET'S CHAINS - the layer the kernels paint past the Bay (world/arenaRoads.js:
 *  a Bay pixel's byte its compass bits, ROADS 1's layout, the Bay's own masks'), walked and softened as the Bay's roads are
 *  (inkMap pathChains), a ROAD_TILE tile at a time. A tile's mask has a pixel's margin round it: the walk takes a pixel's
 *  last step over the tile's edge into it (traceChains follows a bit onto any pixel in bounds), so the tiles either side
 *  both draw that step and the road's halves meet. The layer holds none of the Bay's pixels (the crossings' joins are a
 *  map of their own, not read here): the Bay's roads are the Bay's ink. TESA15: one tile's chains (the map keeps each,
 *  arenaRoadInkAt) - the whole layer's are every tile's (arenaRoadInk).
 *  @param {?{ roads: Map<number, number>, tracks: Map<number, number> }} layer */
export function arenaRoadInkTile(layer, tx, ty) {
  /** @type {{ roads: Pt[][], tracks: Pt[][] }} */
  const out = { roads: [], tracks: [] };
  if (!layer) return out;
  const side = ROAD_TILE + 2, ox = tx * ROAD_TILE - 1, oy = ty * ROAD_TILE - 1;
  for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
    const bytes = layer[kind];
    if (!bytes?.size) continue;
    let mask = null;
    for (let v = 0; v < ROAD_TILE; v++) {
      for (let u = 0; u < ROAD_TILE; u++) {
        const bits = bytes.get(beyondKey(tx * ROAD_TILE + u, ty * ROAD_TILE + v));
        if (bits) (mask ??= new Uint8Array(side * side))[(v + 1) * side + (u + 1)] = bits;
      }
    }
    if (mask) for (const c of pathChains(mask, side, side)) out[kind].push(c.map((p) => ({ x: p.x + ox, y: p.y + oy })));
  }
  return out;
}
/** Every tile's chains of a layer. @param {?{ roads: Map<number, number>, tracks: Map<number, number> }} layer */
export function arenaRoadInk(layer) {
  /** @type {{ roads: Pt[][], tracks: Pt[][] }} */
  const out = { roads: [], tracks: [] };
  const tiles = new Set();
  for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
    for (const key of layer?.[kind]?.keys() ?? []) { const [x, y] = beyondPixel(key); tiles.add(`${Math.floor(x / ROAD_TILE)},${Math.floor(y / ROAD_TILE)}`); }
  }
  for (const t of tiles) {
    const [tx, ty] = t.split(',').map(Number), ink = arenaRoadInkTile(layer, tx, ty);
    out.roads.push(...ink.roads); out.tracks.push(...ink.tracks);
  }
  return out;
}

/** TESA15: THE INSTALLED LAYER'S CHAINS ON ONE TILE, kept - walked again only when the install that last moved the tile
 *  (world/arenaRoads.js arenaRoadTiles) is not the one they were walked at, so a region landing re-inks the tiles it
 *  reaches and no others (TESA13 walked the whole layer again on every landing: 6 to 13 seconds a region, past the Bay's
 *  forty-eight). */
const _roadInk = new Map();
const NO_ROADS = Object.freeze({ roads: Object.freeze([]), tracks: Object.freeze([]) });
export function arenaRoadInkAt(tx, ty) {
  const k = roadTileKey(tx, ty), v = arenaRoadTiles().get(k);
  if (!v) { _roadInk.delete(k); return NO_ROADS; }
  const had = _roadInk.get(k);
  if (had?.v === v) return had.ink;
  const ink = arenaRoadInkTile(arenaRoadsLayer(), tx, ty);
  _roadInk.set(k, { v, ink });
  return ink;
}
/** TESA15: the chains on the tiles a rectangle of Bay pixels reaches, and one tile round it (a chain's last step reaches
 *  over a tile's edge). */
export function arenaRoadsIn(x0, y0, x1, y1) {
  /** @type {{ roads: Pt[][], tracks: Pt[][] }} */
  const out = { roads: [], tracks: [] };
  for (let ty = Math.floor(y0 / ROAD_TILE) - 1; ty <= Math.floor(y1 / ROAD_TILE) + 1; ty++) {
    for (let tx = Math.floor(x0 / ROAD_TILE) - 1; tx <= Math.floor(x1 / ROAD_TILE) + 1; tx++) {
      const ink = arenaRoadInkAt(tx, ty);
      for (const c of ink.roads) out.roads.push(c);
      for (const c of ink.tracks) out.tracks.push(c);
    }
  }
  return out;
}
/** TESA15: the steps a layer's bits take on the tiles a rectangle reaches and its rim, as two-point chains from a pixel's
 *  centre - the far view's paint: out there a walked chain and its pixels' own run are the same stroke, and walking the
 *  continent is seconds. ROADS 1's layout stamps a step on both its ends, so each is drawn from the end it leaves east or
 *  south of, or from the one end that holds it (a capital's gate's step into its city); a straight run of steps one way is
 *  one chain, from the pixel that starts it to the one it ends on - a stroke a run, not a step. */
const FORWARD = /** @type {Set<number>} */ (new Set([DIR.E, DIR.SE, DIR.S, DIR.SW]));
const OPPOSITE_BIT = new Map(DIR_DELTA.map(([bit], k) => [bit, DIR_DELTA[(k + 4) % 8][0]]));
/** ZOOM-FAST (2026-10-24, the owner: "The map also is slow to load when zooming in and out"): EACH ROAD TILE'S RUNS AND
 *  DOTS, KEPT - the far painters read eight of the layer's bits a pixel over a tile and its rim at every tile's paint (three
 *  parts in four of a far tile's time, measured); now a road tile's runs (the steps that start on it) and its pixels' dots
 *  are walked once and kept until the roads' layer moves (a run reaches its neighbours' bits, so any install drops them
 *  all) or ROAD_KEPT_TILES are kept (dropped whole). */
export const ROAD_KEPT_TILES = 1536;
let _keptFor = -1;
/** @type {Map<number, { roads: Pt[][], tracks: Pt[][] }>} */ const _steps = new Map();
/** @type {Map<number, { roads: Float32Array, tracks: Float32Array }>} */ const _dots = new Map();
const keptFresh = () => {
  const v = arenaRoadsVersion();
  if (v !== _keptFor) { _keptFor = v; _steps.clear(); _dots.clear(); }
};
/** A road tile's runs: the steps that start on it, each run one two-point chain. */
function tileSteps(layer, tx, ty) {
  keptFresh();
  const k = roadTileKey(tx, ty), had = _steps.get(k);
  if (had) return had;
  /** @type {{ roads: Pt[][], tracks: Pt[][] }} */
  const out = { roads: [], tracks: [] };
  for (const key of arenaRoadTilePixels(tx, ty)) {
    const [x, y] = beyondPixel(key);
    for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
      const bits = layer[kind].get(key);
      if (!bits) continue;
      for (const [bit, dx, dy] of DIR_DELTA) {
        if (!(bits & bit) || (!FORWARD.has(bit) && (layer[kind].get(beyondKey(x + dx, y + dy)) ?? 0) & /** @type {number} */ (OPPOSITE_BIT.get(bit)))) continue;
        let n = 1;
        if (FORWARD.has(bit)) {
          if ((layer[kind].get(beyondKey(x - dx, y - dy)) ?? 0) & bit) continue;   // the run's own start draws it
          while ((layer[kind].get(beyondKey(x + n * dx, y + n * dy)) ?? 0) & bit) n++;
        }
        out[kind].push([{ x: x + 0.5, y: y + 0.5 }, { x: x + n * dx + 0.5, y: y + n * dy + 0.5 }]);
      }
    }
  }
  if (_steps.size >= ROAD_KEPT_TILES) _steps.clear();
  _steps.set(k, out);
  return out;
}
/** A road tile's pixels of each kind, as centres (x, y, x, y, ...). */
function tileDots(layer, tx, ty) {
  keptFresh();
  const k = roadTileKey(tx, ty), had = _dots.get(k);
  if (had) return had;
  const at = { roads: /** @type {number[]} */ ([]), tracks: /** @type {number[]} */ ([]) };
  for (const key of arenaRoadTilePixels(tx, ty)) {
    for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
      if (!layer[kind].get(key)) continue;
      const [x, y] = beyondPixel(key);
      at[kind].push(x + 0.5, y + 0.5);
    }
  }
  const out = { roads: Float32Array.from(at.roads), tracks: Float32Array.from(at.tracks) };
  if (_dots.size >= ROAD_KEPT_TILES) _dots.clear();
  _dots.set(k, out);
  return out;
}
export function arenaRoadSteps(x0, y0, x1, y1) {
  /** @type {{ roads: Pt[][], tracks: Pt[][] }} */
  const out = { roads: [], tracks: [] };
  const layer = arenaRoadsLayer();
  if (!layer) return out;
  for (let ty = Math.floor(y0 / ROAD_TILE) - 1; ty <= Math.floor(y1 / ROAD_TILE) + 1; ty++) {
    for (let tx = Math.floor(x0 / ROAD_TILE) - 1; tx <= Math.floor(x1 / ROAD_TILE) + 1; tx++) {
      const kept = tileSteps(layer, tx, ty);
      for (const c of kept.roads) out.roads.push(c);
      for (const c of kept.tracks) out.tracks.push(c);
    }
  }
  return out;
}

/** TESA15: below this scale (paper pixels a Bay pixel) each road's and track's pixel is laid as a dot of the far pen's
 *  width, the dots of a kind one filled path - not stroked: out on the continent a tile's sixty thousand steps were a
 *  frame's time and more each - and while the dots of a run stand under a paper pixel apart, a diagonal's too, the dots
 *  and the stroke are the same ink. */
export const DOTS_BELOW = 0.7;
/** The dots: each pixel a square the far pen's width (inkMap strokePaths: the road 1, the track FAR_TRACK_PEN in the soft
 *  pen), on its centre. */
function dotPaths(ctx, view, x1, y1, filters) {
  const layer = arenaRoadsLayer();
  if (!layer) return;
  const s = view.scale;
  for (const [kind, style, w] of /** @type {const} */ ([['tracks', PEN.soft, FAR_TRACK_PEN], ['roads', PEN.line, 1]])) {
    if (filters[kind]) continue;
    ctx.fillStyle = style;
    ctx.beginPath();
    for (let ty = Math.floor(view.oy / ROAD_TILE); ty <= Math.floor(y1 / ROAD_TILE); ty++) {
      for (let tx = Math.floor(view.ox / ROAD_TILE); tx <= Math.floor(x1 / ROAD_TILE); tx++) {
        const at = tileDots(layer, tx, ty)[kind];   // ZOOM-FAST: the tile's centres, kept
        for (let i = 0; i < at.length; i += 2) ctx.rect((at[i] - view.ox) * s - w / 2, (at[i + 1] - view.oy) * s - w / 2, w, w);
      }
    }
    ctx.fill();
  }
}

/** TESA15: what a rectangle's paint past the Bay reads, as a word - each tile's roads' install and places' add, the
 *  greatest of each over the tiles it and its rim reach: the same word, the same paint (ui/tamrielTiles.js keeps it). */
export function pastBayStamp(x0, y0, x1, y1) {
  const tiles = arenaRoadTiles();
  let r = 0, p = 0;
  for (let ty = Math.floor(y0 / ROAD_TILE) - 1; ty <= Math.floor(y1 / ROAD_TILE) + 1; ty++) {
    for (let tx = Math.floor(x0 / ROAD_TILE) - 1; tx <= Math.floor(x1 / ROAD_TILE) + 1; tx++) {
      r = Math.max(r, tiles.get(roadTileKey(tx, ty)) ?? 0);
      p = Math.max(p, pastBayPlacesStamp(tx, ty));
    }
  }
  return `${r}|${p}`;
}

/** TESA13: THE COUNTRYSIDE'S AND THE LAIRS' MARKS IN A VIEW - each place the host's atlas holds on the view's pixels
 *  (world/tamrielAtlas.js placesIn, within the continent's frame) that the band inks and no filter hides - the Bay's own
 *  laws for its marks (travelMapWindow getPixelColorIndex, inkMap BAND_MARKS and markKind) - as `{ place, kind, x, y }`
 *  on the pixel's centre, in the sheet's coordinates. None at far: far inks the cities alone, and none is the
 *  countryside's. No discovery law: every place past the Bay is inked, as TESA1's are.
 *  @param {{ox:number,oy:number,scale:number}} view @param {?PlacesIn} placesIn
 *  @param {{ paperW: number, paperH: number, band?: string, filters?: any, frame?: ?{ x0: number, y0: number, w: number, h: number } }} opts */
export function tamrielMarksIn(view, placesIn, opts) {
  const { paperW, paperH, band = zoomBand(view.scale), filters = {}, frame = null } = opts;
  if (!placesIn || band === 'far') return [];
  const shown = BAND_MARKS[band] ?? BAND_MARKS.near;
  let x0 = Math.floor(view.ox), y0 = Math.floor(view.oy);
  let x1 = Math.ceil(view.ox + paperW / view.scale), y1 = Math.ceil(view.oy + paperH / view.scale);
  if (frame) {
    x0 = Math.max(x0, Math.floor(frame.x0)); y0 = Math.max(y0, Math.floor(frame.y0));
    x1 = Math.min(x1, Math.ceil(frame.x0 + frame.w)); y1 = Math.min(y1, Math.ceil(frame.y0 + frame.h));
  }
  const out = [];
  for (const place of placesIn(x0, y0, x1, y1)) {
    const colorIndex = getPixelColorIndex(place.type, filters);
    if (colorIndex < 0 || !shown.has(colorIndex)) continue;
    out.push({ place, kind: markKind(colorIndex), x: place.x + 0.5, y: place.y + 0.5 });
  }
  return out;
}

/** TESA13: the countryside's or a lair's mark within CITY_HIT_PX of a sheet point, among the ones the view inks - or
 *  null. @param {{ox:number,oy:number,scale:number}} view @param {?PlacesIn} placesIn
 *  @param {{ band?: string, filters?: any, frame?: any }} [opts] */
export function tamrielMarkAt(mx, my, view, placesIn, opts = {}) {
  if (!placesIn || inBay(mx, my)) return null;
  const reach = CITY_HIT_PX / view.scale;
  const near = { ox: mx - reach, oy: my - reach, scale: view.scale };
  let best = null, bd = reach;
  for (const m of tamrielMarksIn(near, placesIn, { ...opts, paperW: 2 * CITY_HIT_PX, paperH: 2 * CITY_HIT_PX, band: opts.band ?? zoomBand(view.scale) })) {
    const d = Math.hypot(m.x - mx, m.y - my);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** TESA10d: the pixel a city of a capital's name and province stands on - a portal's end there (TESA-NO-FAST) - the capital's, where a host stands the
 *  capitals (world/tamrielCapitals.js capitalsStanding) - or null. */
function capitalStandsAt(city) {
  const at = capitalsStanding() ? capitalPin(city) : null;
  return at ? { x: at.px, y: at.py } : null;
}

/** The continent's city within CITY_HIT_PX of a sheet point (paper pixels at the view's scale), or null - the hover's
 *  read and, TESA2, the press's. */
export function tamrielCityAt(mx, my, view, ink) {
  if (!ink || inBay(mx, my)) return null;
  const reach = CITY_HIT_PX / view.scale;
  let best = null, bd = reach;
  for (const c of ink.cities) {
    const d = Math.hypot(c.x - mx, c.y - my);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/**
 * THE INK MODEL: everything the painter strokes, in the sheet's (Bay) coordinates, clipped to the outside of the
 * Bay's rectangle and stitched to the Bay's own coast ends. Pure over its inputs and the land module's state.
 * @param {{ bayCoast?: Pt[][] }} [deps]
 */
export function buildTamrielInk({ bayCoast = [] } = {}) {
  const rect = { x0: 0, y0: 0, x1: BAY_W, y1: BAY_H };
  const calm = (() => { const [x0, y0] = bayToPicture(0, 0), [x1, y1] = bayToPicture(BAY_W, BAY_H); return { x0, y0, x1, y1 }; })();
  const noise = makeNoise(FRET_SEED);
  const trace = tamrielTrace();
  const traced = trace ? tracedChains(trace) : null;
  /** @type {Pt[][]} */
  let coast = [];
  if (traced) {
    for (const c of traced.coast) for (const piece of clipOutsideRect(c, rect)) coast.push(...dropEdgeRuns(piece, rect));
  } else {
    const rings = [closedRing(COAST), ...Object.values(ISLANDS).map((r) => closedRing(r))];
    for (const r of rings) for (const c of clipOutsideRect(chainToBay(fretRing(r, calm, noise)), rect)) coast.push(roundCorners(c, 6));
  }
  const ends = bayCoastEnds(bayCoast);
  const stitched = stitchToBay(coast, ends);
  coast = stitched.chains;
  const borders = [];
  if (traced) for (const c of traced.borders) for (const piece of clipOutsideRect(c, rect)) borders.push(piece);
  else for (const b of Object.values(BORDERS)) for (const c of clipOutsideRect(chainToBay(pts(b.run)), rect)) borders.push(roundCorners(c, 12));
  const rivers = [];
  // TAMRIEL4: on the trace the rivers are the picture's own - the Niben, Lake Rumare and the rest it paints are its
  // water, inked as its coast. The lore map's six (TAMRIEL1) were drawn from memory as straight runs, and on the
  // picture half of them ran out across the sea; they stand on the authored shape alone.
  if (!traced) for (const rv of RIVERS) for (const c of clipOutsideRect(chainToBay(rv.pts.map(([x, y]) => ({ x, y }))), rect)) rivers.push(roundCorners(c, 12));
  const carets = [];
  // the ranges are authored; on the trace a caret stands only where the picture has land
  for (const rg of MOUNTAIN_RANGES) for (const c of rangeCarets(rg, noise)) { if (traced && !provinceKeyAt(c.x, c.y)) continue; const q = toBay(c); if (!inBay(q.x, q.y)) carets.push({ ...c, x: q.x, y: q.y }); }
  const provinces = traced
    ? traced.labels.map((l) => { const p = provinceByKey(l.key); const [x, y] = pictureToBay(l.px, l.py); return { key: l.key, name: p?.name ?? l.key, x, y }; })
    : PROVINCES.map((p) => { const [x, y] = pictureToBay(p.label[0], p.label[1]); return { key: p.key, name: p.name, x, y }; });
  const seas = SEAS.map((s) => { const [x, y] = pictureToBay(s.at[0], s.at[1]); return { name: s.name, x, y }; })
    .filter((s) => !traced || !provinceKeyAt(...bayToPicture(s.x, s.y)));   // a sea's name on the picture's land is left off
  // TESA1: the places past the Bay where the trace stands them (TESA12: the port's own); TAMRIEL1's authored cities else
  const arena = traced ? arenaPlaces() : null;
  const cities = arena ? arenaInkCities(arena) : CITIES.map((c) => {
    const pixel = capitalStandsAt(c);   // TESA10d: a capital the world stands is inked on its pixel - on the teleport map a portal's end (TESA-NO-FAST)
    if (pixel) return { name: c.name, province: c.province, capital: !!c.capital, kind: null, x: pixel.x + 0.5, y: pixel.y + 0.5, pixel };
    const at = placeCity(c); if (!at) return null; const [x, y] = pictureToBay(at[0], at[1]); return { name: c.name, province: c.province, capital: !!c.capital, kind: null, x, y };
  })
    .filter((c) => c && !inBay(c.x, c.y));
  const frame = tamrielFrameInBay();
  // TESA15: the roads past the Bay are no part of it - they are inked a tile at a time as they land (arenaRoadInkAt)
  return { coast, borders, rivers, carets, provinces, seas, cities, frame, joined: stitched.joined, bayEnds: ends.length, traced: !!traced, arena: !!arena, version: tamrielLandVersion(), arenaVersion: arenaPlacesVersion(), capitalsVersion: capitalsVersion() };
}

/** ONE model a data set and a trace: keyed by the Bay model's own coast array (the window mints one per WOODS
 *  buffer), rebuilt when the land module's version moves (TAMRIEL3: the trace lands after the boot, the fit with it). */
const _inks = new WeakMap();
const _noBay = { ink: null };
export function tamrielInkFor(bayModel) {
  const key = bayModel?.coast;
  const v = tamrielLandVersion(), a = arenaPlacesVersion(), c = capitalsVersion();   // TESA1: the places' standing moved rebuilds it too; TESA10d: the capitals standing (TESA15: the roads are their own tiles')
  const stale = (ink) => !ink || ink.version !== v || ink.arenaVersion !== a || ink.capitalsVersion !== c;
  if (!key) { if (stale(_noBay.ink)) _noBay.ink = buildTamrielInk(); return _noBay.ink; }
  let ink = _inks.get(key);
  if (stale(ink)) { ink = buildTamrielInk({ bayCoast: key }); _inks.set(key, ink); }
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

/** TESA15: how far a mark's glyph and its halo reach from its pixel's centre, paper pixels - a mark just outside a view
 *  that reaches into it is painted too, so a tile's edge cuts no glyph. */
export const MARK_REACH_PX = 10;
/**
 * TESA15: THE ROADS, THE TRACKS AND THE PLACES PAST THE BAY in a view - the Bay's own pens, band and filters (inkMap
 * strokePaths), and in to the Bay's own scale (never out on the continent) the countryside's and the lairs' marks off
 * `placesIn`, every halo before every glyph (MAP-FIELD6), each kind in its classic dot's hue where there is a palette
 * (MAP-KEY). The one painter of them: the window's kept tiles (ui/tamrielTiles.js) are its paint, a tile's view at a time.
 * @param {CanvasRenderingContext2D} ctx @param {{ox:number,oy:number,scale:number}} view
 * @param {{ paperW: number, paperH: number, band?: string, continent?: boolean, filters?: any, inks?: any,
 *   placesIn?: ?PlacesIn, frame?: ?{ x0: number, y0: number, w: number, h: number } }} opts
 */
export function paintPastBay(ctx, view, opts) {
  const { paperW, paperH } = opts;
  const band = opts.band ?? zoomBand(view.scale);
  const { stroke } = penOf(ctx, view, paperW, paperH);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const x1 = view.ox + paperW / view.scale, y1 = view.oy + paperH / view.scale;
  // in to the Bay's scale the walked chains, softened as the Bay's own; at far each pixel's steps (arenaRoadSteps); out
  // on the continent its dots (DOTS_BELOW)
  if (band === 'far' && view.scale < DOTS_BELOW) dotPaths(ctx, view, x1, y1, opts.filters ?? {});
  else strokePaths(stroke, band === 'far' ? arenaRoadSteps(view.ox, view.oy, x1, y1) : arenaRoadsIn(view.ox, view.oy, x1, y1), band, opts.filters ?? {});
  if (!opts.continent) {
    const pad = MARK_REACH_PX / view.scale;
    const near = { ox: view.ox - pad, oy: view.oy - pad, scale: view.scale };
    const marks = tamrielMarksIn(near, opts.placesIn ?? null, { paperW: paperW + 2 * MARK_REACH_PX, paperH: paperH + 2 * MARK_REACH_PX, band, filters: opts.filters ?? {}, frame: opts.frame ?? null });
    const at = marks.map((m) => toPaper(view, m.x, m.y));
    marks.forEach((m, i) => paintGlyph(ctx, m.kind, at[i][0], at[i][1], true));
    marks.forEach((m, i) => paintGlyph(ctx, m.kind, at[i][0], at[i][1], false, opts.inks?.[m.kind]));
  }
  ctx.restore();
}

/**
 * The continent onto the sheet, over the Bay's own static ink (which clears the canvas first, so this comes after).
 * Answers whether anything was painted.
 * @param {CanvasRenderingContext2D} ctx @param {{ox:number,oy:number,scale:number}} view
 * @param {ReturnType<typeof buildTamrielInk>} ink
 * TESA13: the roads past the Bay, and the countryside's and the lairs' marks where the window hands its places
 * (`placesIn`), under the band and the filters the Bay's own ink keeps (`band`, `filters`, each kind's ink in `inks`) -
 * TESA15: off the window's kept tiles (`tiles`, at its `dpr`) where it keeps them.
 * @param {{ paperW: number, paperH: number, continent?: boolean, bayFit?: number, band?: string, filters?: any,
 *   inks?: any, placesIn?: ?PlacesIn, tiles?: ?ReturnType<typeof import('./tamrielTiles.js').createTamrielTiles>, dpr?: number,
 *   under?: () => void, part?: 'under' | 'roads' | 'over', settling?: boolean }} opts - `under` painted over the land, the
 *   roads and the borders and under the cities and the names. ZOOM-FAST: `part` paints one third alone - the land under the
 *   roads (the shore, the high ground, the rivers), the roads' tiles, or what stands over them (the borders, the window's
 *   `under`, the Bay's frame, the cities, the names) - so the window keeps the first and the last on layers of their own and
 *   a frame that only paints the roads' owed tiles is three drawImages; `settling` (the view's scale still moving) paints no
 *   tile, only the kept ones and their stand-ins.
 */
export function paintTamrielInk(ctx, view, ink, opts) {
  const { paperW, paperH } = opts;
  if (!ink || !viewLeavesBay(view, paperW, paperH)) return false;
  const part = opts.part ?? null;
  const s = view.scale;
  const continent = opts.continent ?? false;
  const band = opts.band ?? zoomBand(s);
  const { visible, stroke } = penOf(ctx, view, paperW, paperH);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (!part || part === 'under') {
    // the shore, in the Bay's own hand
    stroke(ink.coast, Math.max(3, s * 1.6), PEN.wash);
    stroke(ink.coast, 1.3, PEN.line);
    // the high ground: the lattice thinned so a caret never lands under its neighbour
    const unit = s * tamrielFit().ppu * CARET_LATTICE;   // paper px between lattice points
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
    // the rivers (REGION-LINES: the provinces' borders are drawn over the roads' web, below)
    stroke(ink.rivers, 1, PEN.soft);
  }
  // TESA13: the roads, the tracks, the countryside and the lairs past the Bay - TESA15: off the window's kept tiles of
  // them (ui/tamrielTiles.js, paintPastBay's paint a tile at a time), or painted here where it keeps none
  const past = { paperW, paperH, band, continent, filters: opts.filters ?? {}, inks: opts.inks ?? null, placesIn: opts.placesIn ?? null, frame: ink.frame };
  if (!part || part === 'roads') {
    if (opts.tiles) opts.tiles.draw(ctx, view, { paperW, paperH, dpr: opts.dpr ?? 1, key: `${band}|${continent ? 1 : 0}|${JSON.stringify(past.filters)}|${JSON.stringify(past.inks)}`, paint: past, ...(opts.settling ? { budgetMs: 0, force: false } : {}) });
    else paintPastBay(ctx, view, past);
  }
  if (part && part !== 'over') { ctx.restore(); return true; }
  // REGION-LINES (the owner: "Theres no visible region lines"): the zones' borders and the provinces', OVER the roads' web -
  // under it, in the tracks' own pen, a border read as one more track - each on a halo of the parchment, the provinces' in
  // the region's ink and their old dash, the zones' a finer dot
  const zones = tamrielZoneChains();
  stroke(zones, 2.5, PEN.halo);
  stroke(zones, 1, PEN.region, [1, 3]);
  stroke(ink.borders, 3.5, PEN.halo);
  stroke(ink.borders, 1.4, PEN.region, [4, 3]);
  // ZONE-NAMES-OVER: what the window lays over the land and under its names (the open zone's fog and red line - WILD1
  // had them under the place marks; laid after this layer, the fog's 0.78 hid Cyrodiil's every name)
  opts.under?.();
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
    const glyph = c.capital ? 'city' : (ARENA_KIND_GLYPHS[c.kind] ?? 'hamlet');   // TESA1: a place past the Bay by its kind
    paintGlyph(ctx, glyph, x, y, true);
    paintGlyph(ctx, glyph, x, y, false);
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
 * What a hover over the continent answers: a city within CITY_HIT_PX, else (TESA13) a mark of the countryside's or a
 * lair's the view inks (`marks`: the window's places, band and filters; TESA15: its name `nameOf` the host's roll - the
 * places the roads' regions laid carry none), else the province, else the sea - or null on the
 * Bay's own ground (the Bay's reads are the window's).
 * @param {number} mx @param {number} my sheet coordinates @param {{ox:number,oy:number,scale:number}} view
 * @param {?ReturnType<typeof buildTamrielInk>} [ink]
 * @param {?{ placesIn: ?PlacesIn, nameOf?: ?((x: number, y: number) => string), band?: string, filters?: any }} [marks]
 */
export function tamrielPlaceAt(mx, my, view, ink = null, marks = null) {
  if (inBay(mx, my)) return null;
  const best = tamrielCityAt(mx, my, view, ink);
  if (best) return TAMRIEL_TEXT.city(provinceByKey(best.province)?.name ?? best.province, best.name, best.kind);
  const [px, py] = bayToPicture(mx, my);
  const key = provinceKeyAt(px, py);
  // TESA13: a mark of the countryside's or a lair's the view inks, named with its kind in DFU's own words
  const mark = marks ? tamrielMarkAt(mx, my, view, marks.placesIn, { ...marks, frame: ink?.frame ?? null }) : null;
  if (mark) return TAMRIEL_TEXT.city(provinceByKey(key)?.name ?? TAMRIEL_TEXT.beyond, mark.place.name ?? marks.nameOf?.(mark.place.x, mark.place.y) ?? '', locationTypeName(mark.place.type));
  if (key) return TAMRIEL_TEXT.land(provinceByKey(key)?.name ?? key);
  const sea = seaAt(px, py);
  return sea ? TAMRIEL_TEXT.sea(sea.name) : null;
}
