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
import { tamrielTrace, tamrielLandVersion, provinceKeyAt, PROVINCE_OF_ID, onTamrielTrace } from '../world/tamriel/tamrielLand.js';
// TESA1: the places past the Bay where the trace stands them (world/arenaPlaces.js; TESA12: the port's own)
import { arenaPlaces, arenaPlacesVersion, arenaPixels, arenaStanding } from '../world/arenaPlaces.js';
import { capitalPin, capitalsStanding, capitalsVersion, capitalPlaceId, capitalCanalOpen, capitalSpanPixels, capitalSliceName, capitalHarbourSlice, CAPITALS } from '../world/tamrielCapitals.js';   // TESA10d: a capital's pixel on the map, Arena or none; WW7-6: its seat's key; BAY-LEFT-MAPS: a capital's harbour, as the registry reads it
import { arenaPlaceId } from '../world/arenaLocations.js';   // WW7-6: a place's seat's key
import { countryPixelOfId } from '../world/tamrielCountry.js';   // FIND-FOUND: a found country place's pixel off its id
import { lairPixelOfId } from '../world/tamrielDungeons.js';   // FIND-FOUND: and a found lair's
import { seatMapMark } from '../net/townSeatLaw.js';   // WW7-6: how a seat is marked, the Bay's own law
import { arenaRoadsLayer, arenaRoadTiles, arenaRoadTilePixels, arenaRoadsVersion, beyondKey, beyondPixel, ROAD_TILE, roadTileKey, arenaRoadByte } from '../world/arenaRoads.js';
import { DIR, DIR_DELTA } from '../world/road/roadNetwork.js';   // TESA15: a pixel's steps, as the far view draws them   // TESA13: the roads past the Bay, as the kernels paint them; TESA15: a tile at a time
import { pastBayPlacesStamp, pastBayPlacesVersion } from '../world/pastBayPlaces.js';   // TESA15: the places the roads' regions laid, a bin at a time
import { getPixelColorIndex } from './travel/travelMapWindow.js';   // TESA13: a place's classic bucket, under the map's filters
import { LOCATION_TYPES } from '../formats/mapsFile.js';   // AUDIT TESA II M7: a place past the Bay's type, the Bay's own
import { REGION_NAMES, regionOfTheatre } from '../formats/mapsTables.js';   // BAY-LEFT-MAPS C9: a place's province by its region's name (WW-R)
import { THEATRE_KEYS } from '../world/worldWide/worldGrid.js';   // BAY-LEFT-MAPS C9: a province's theatre by its key
import { locationTypeName } from '../systems/travel/travelOptions.js';   // TESA13: MacroHelper.LocationTypeName - a place's kind in words
import { makeNoise, octaveNoise } from './intro/introMap.js';   // the intro's own seeded value noise - ONE home for it
import { PEN, NAME_FACE, HALO_PEN, FAR_TRACK_PEN, penOf, pathPen, PATH_KINDS, penSolid, toPaper, paintGlyph, paintSeatRing, paintHarbour, markReach, roundCorners, inkChain, spacedName, boundarySegments, linkSegments, pathChains, strokePaths, zoomBand, BAND_MARKS, markKind } from './ink/inkMap.js';   // BAY-LEFT-MAPS: a port's anchor, the Bay's own
import { HUB_CAPITALS } from '../systems/region/regionHubs.js';   // REGION-LINES: the Bay's three kingdoms' capitals, with every province's
import { simplifyChain } from './overworldModel.js';   // TAMRIEL3: the coast's chain thinned as the overworld's are
import { stampSquare, coveragePixels, clearCoverage, penRgb } from './inkRaster.js';   // MAP-WHOLE: the continent's dots rasterised by hand
import { labelPoint } from './provinceMap.js';   // TAMRIEL3: a province's name hangs where the chargen's map hangs it
import { cyrodiilMask, zoneLineSteps } from '../systems/wild/cyrodiilZone.js';   // ZONE-LINE: Cyrodiil's outline is the zone's law's to draw
import { watersInk, watersInkVersion } from '../world/tamriel/watersInk.js';   // MAP-WATERS: stream G's rivers and lakes past the Bay (the worker's copy), inked
import { bridgesOf, inkBridgeLaw } from '../world/road/roadBridges.js';   // ROAD-LOOK: the bridges where the roads cross those rivers, marked
import { lawLines, linkSteps, segKey, drain } from '../world/tamriel/tamrielLines.js';   // SMOOTH-LAND: the land's own lines
import { discoveryGeneration } from '../systems/discovery.js';   // AUDIT TAMRIEL-WIDE D2: a find moves the tiles' stamp
import { t } from '../systems/textManager.js';   // AUDIT TAMRIEL-WIDE D3: the hover in the player's language

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
/** TESA1: a place's glyph, the Bay's own kinds - a capital is the city glyph whatever its kind. REGION-LINES (2026-10-25,
 *  the owner: "daggerfall's clustered icons need to be fixed amd standardized across tamriel"): one glyph a kind across
 *  Tamriel - Arena's city-state is a city as the Bay's TownCity is, its town a hamlet, its village a village. AUDIT TESA II
 *  M7: the kind's location type, the Bay's own - its classic bucket is its glyph, its filter and its hue (travelMapWindow
 *  getPixelColorIndex, inkMap markKind); the map's filters hid the Bay's towns and the countryside's past it, and not these. */
export const ARENA_KIND_TYPES = Object.freeze({ 'city-state': LOCATION_TYPES.TownCity, town: LOCATION_TYPES.TownHamlet, village: LOCATION_TYPES.TownVillage });
/** A city of the ink's bucket under the map's filters (-1: hidden) - an authored city of no kind the hamlet's, as it was. */
export const tamrielCityBucket = (c, filters = {}) => getPixelColorIndex(c.capital ? LOCATION_TYPES.TownCity : ARENA_KIND_TYPES[/** @type {keyof typeof ARENA_KIND_TYPES} */ (c.kind)] ?? LOCATION_TYPES.TownHamlet, filters);
/** The glyph each kind is drawn with - its bucket's (markKind). */
export const ARENA_KIND_GLYPHS = Object.freeze(Object.fromEntries(Object.entries(ARENA_KIND_TYPES).map(([k, type]) => [k, markKind(getPixelColorIndex(type))])));
/** REGION-LINES: THE PROVINCES' LINE - a solid stroke in the shore's own ink on a halo of the parchment (paper px), over the
 *  roads' web, so each province reads distinctly from the next at every zoom (the owner's reference: a map of Tamriel each
 *  province of it cleanly parted from its neighbours). */
export const PROVINCE_PEN = Object.freeze({ halo: 8, line: 2.6 });
/** The words. AUDIT TAMRIEL-WIDE D3: the province and the place, as the Bay's own hover names them - the land past the Bay
 *  is the world's, not an aside to the Bay ("(beyond the Bay)" was every hover's). A place of no province is Tamriel's. */
export const TAMRIEL_TEXT = Object.freeze({
  get beyond() { return t('map.sheet.tamriel', 'Tamriel'); },
  sea: (name) => name,
  land: (province) => province,
  city: (province, city, kind = null) => (kind
    ? t('map.tamriel.placeKind', '{province} : {place} ({kind})', { province, place: city, kind: ARENA_KIND_WORDS[kind] ?? kind })
    : t('map.tamriel.place', '{province} : {place}', { province, place: city })),
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
/** EDGE-RUN: how far (map pixels) off the frame a run still lies along it. SMOOTH-LAND's lines cross between two pixel
 *  centres, so the frame's own line lies up to half a pixel off the edge, never on it: at -0.109 it stood as a hard
 *  line in the sea down the Bay's west edge. */
export const EDGE_RUN_PX = 0.5;
/** @param {Pt[]} chain @param {{x0:number,y0:number,x1:number,y1:number}} [r] */
export function dropEdgeRuns(chain, r = BAY_RECT) {
  const near = (u, v, edge) => Math.abs(u - edge) <= EDGE_RUN_PX && Math.abs(v - edge) <= EDGE_RUN_PX;
  const onEdge = (a, b) => near(a.x, b.x, r.x0) || near(a.x, b.x, r.x1) || near(a.y, b.y, r.y0) || near(a.y, b.y, r.y1);
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
/** TAMRIEL4: how far a border's end is moved onto the coast, picture pixels. (SMOOTH-LAND: the ink draws the land's own
 *  smooth law's lines now - tracedChains - so the picture contour below, its cut and this snap draw nothing; kept, with
 *  their pins, as TAMRIEL4's reading of the picture.) */
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

/** TAMRIEL3: the picture's coast and borders as chains in Bay coordinates, and each province's name at its clearest
 *  point (provinceMap labelPoint). SMOOTH-LAND (2026-10-26, bible/03-World/Tamriel.md SMOOTH-LAND; the owner: "Whatever is
 *  most detailed"): the coast and the borders are the land's own smooth law's lines (world/tamriel/tamrielLines.js
 *  lawLines - where its label changes between two map pixels' centres, at the map's own pixel), thinned by INK_THIN map
 *  pixels with their ends kept; Cyrodiil's outline is the zone's line (systems/wild/cyrodiilZone.js zoneLineOf - the same
 *  crossings, its runs in place of the province's own pieces there, `keys`), so a neighbour's coast and border end on it.
 *  TAMRIEL4's picture contour (contourSegments, chaikinCapped) and its staircase borders are no longer drawn.
 *  @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace */
export function tracedChains(trace) {
  return drain(tracedSteps(trace));
}
/** AUDIT RELEASE R4-7: the traced chains a trace, its fit, its land's version and the zone's mask made them for - one, so
 *  the held map's open takes what the idle job made. @type {WeakMap<object, { key: string, mask: any, value: any }>} */
const _traced = new WeakMap();
/**
 * tracedChains as steps (AUDIT RELEASE R4-7): the law's walk a picture square a step (tamrielLines.js steps), the zone's
 * line (cyrodiilZone.js zoneLineSteps), the linking (linkSteps), a chain's thinning and a province's label a step each -
 * the same chains, kept for the trace (`_traced`), whether walked whole or a budget at a time.
 * @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace
 * @returns {Generator<undefined, { coast: Pt[][], borders: Pt[][], labels: Array<{ key: string, px: number, py: number }> }, unknown>}
 */
export function* tracedSteps(trace) {
  const f = tamrielFit(), key = `${f.ox}:${f.oy}:${f.ppu}:${tamrielLandVersion()}`, zoneMask = cyrodiilMask();
  const kept = _traced.get(trace);
  if (kept && kept.key === key && kept.mask === zoneMask) return kept.value;
  const { w, h, land, province } = trace;
  const lines = lawLines(trace);
  yield* lines.steps();
  const zone = zoneMask ? yield* zoneLineSteps(trace, zoneMask) : null;
  const { segs } = lines.all();
  /** @param {'coast'|'border'} kind */
  const own = function* (kind) {
    const chains = yield* linkSteps(segs.filter((s) => s.kind === kind && !zone?.keys.has(segKey(s))), lines.points);
    const out = [];
    for (const c of chains) { out.push(simplifyChain(c, INK_THIN)); if (c.length > 256) yield; }
    return out;
  };
  const coast = yield* own('coast'), borders = yield* own('border');
  const labels = [];
  for (const [id, pkey] of Object.entries(PROVINCE_OF_ID)) {
    const mask = new Uint8Array(w * h);
    let n = 0;
    for (let i = 0; i < mask.length; i++) if (land[i] && province[i] === Number(id)) { mask[i] = 1; n++; }
    if (!n) continue;
    const [lx, ly] = labelPoint(mask, w, h);
    labels.push({ key: pkey, px: lx, py: ly });
    yield;
  }
  const value = { coast: zone ? coast.concat(zone.coast) : coast, borders: zone ? borders.concat(zone.borders) : borders, labels };
  _traced.set(trace, { key, mask: zoneMask, value });
  return value;
}

/** AUDIT RELEASE R4-7: how many steps of tracedSteps the idle job takes in one slice of the page's idle time - each step
 *  a picture square's map squares, LINK_STEP pieces, a chain's thinning or a province's label (some milliseconds at
 *  most), so a slice stays well under a frame's worth of 100 ms. */
export const TRACED_SLICE_STEPS = 24;
/** The idle job's scheduler: `requestIdleCallback` on a page, none in node (a test sets its own; null stops it). */
let _schedule = /** @type {((run: () => void) => void)|null} */ (typeof globalThis.requestIdleCallback === 'function' ? (run) => globalThis.requestIdleCallback(() => run()) : null);
export function setTracedScheduler(fn) { _schedule = fn; }
/**
 * AUDIT RELEASE R4-7: THE HELD MAP'S LINES MADE IN IDLE TIME. When a trace lands on the page (tamrielLand.js
 * onTamrielTrace), its traced chains - the continent's walk, Cyrodiil's line, the linking and thinning - are made
 * TRACED_SLICE_STEPS steps a slice of idle time, into the one keep tracedChains reads; the map's first open then takes
 * them made. A trace that moves on stops the job (the next one starts its own). Returns the job's state for its pins.
 * @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace
 */
export function startTracedJob(trace) {
  const job = { slices: 0, steps: 0, done: false };
  if (!_schedule || !trace) return job;
  /** @type {Generator<undefined, any, unknown>|null} */
  let gen = null;
  const slice = () => {
    if (tamrielTrace() !== trace) return;   // another trace landed: its own job makes its chains
    gen ??= tracedSteps(trace);
    job.slices++;
    for (let n = 0; n < TRACED_SLICE_STEPS; n++) {
      job.steps++;
      if (gen.next().done) { job.done = true; return; }
    }
    _schedule?.(slice);
  };
  _schedule(slice);
  return job;
}
onTamrielTrace((trace) => { if (trace) startTracedJob(trace); });
/** SMOOTH-LAND: how far (map pixels) the ink's own lines are thinned - a quarter of a pixel, so a line stands on the law. */
export const INK_THIN = 0.25;

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
 *  end on the teleport map and a place's journey on the travel map (TRAVEL-EVERYWHERE); else `pixel` is null and a press picks nothing, as TESA1's did.
 *  @param {NonNullable<ReturnType<typeof arenaPlaces>>} model */
export function arenaInkCities(model) {
  const capital = new Set(CITIES.filter((c) => c.capital).map((c) => `${c.province}|${c.name}`));
  const stood = new Map();
  if (arenaStanding()) for (const p of arenaPixels()?.stood ?? []) stood.set(`${p.provinceIndex}|${p.id}`, { x: p.bx, y: p.by, pinned: !!p.pinned, port: !!p.port });   // BAY-LEFT-MAPS C11: a port where it stands on its shore (TESA6)
  const out = [];
  for (const p of model.places) {
    if (!p.name) continue;
    const [x, y] = pictureToBay(p.px, p.py);
    if (inBay(x, y)) continue;
    const st = stood.get(`${p.provinceIndex}|${p.id}`), pixel = st ? { x: st.x, y: st.y } : capitalStandsAt(p);
    // AUDIT-TESA A7-4: a place on a capital's pixel (its pin, or the capital standing where the places do not) is inked
    // there - on the city the world stands, not on its own point a pixel or more away
    const on = pixel && (st?.pinned || !st) ? [pixel.x + 0.5, pixel.y + 0.5] : [x, y];
    const isCapital = capital.has(`${p.province}|${p.name}`), k = isCapital ? CAPITALS.findIndex((cap) => cap.name === p.name) : -1;
    // WW7-6: its map id - the seat's key (scenes/tamrielPlacesHost.js seatPlaces: a capital's its centre's, a city's its own).
    // BAY-LEFT-MAPS (C11): whether it is a port, by its provider's word as the registry reads it (world/pastBayRows.js): the
    // place as it stands - the lore's port a port only on its shore (TESA6, world/arenaPlaces.js standArenaPixels), the lore's
    // word where no host stands the places - and a capital's whose own place is one, or whose harbour's canal is open
    // (NIBEN-SEA)
    const port = (st ? st.port : !!p.port) || (k >= 0 && capitalCanalOpen(k));
    out.push({ name: p.name, province: p.province, capital: isCapital, kind: p.kind, x: on[0], y: on[1], pixel, mapId: k >= 0 ? capitalPlaceId(k, 0) : arenaPlaceId(p), port });
  }
  return out;
}

/** BAY-LEFT-MAPS (AUDIT LEFT IN THE BAY C9): THE FIND BOX'S PLACES PAST THE BAY - the ink's cities (every named place the
 *  continent's sheet inks: Arena's and the capitals), each on the pixel the world stands it on (`pixel`, else its ink
 *  point's), and a standing capital's slices by their names: the registry's listed rows (world/pastBayRows.js - a capital's
 *  every slice a place of its own), one row a name a capital, the slice of it nearest the centre - its harbour's slice for
 *  its own name (the Imperial City is 625 slices on 14 names; the Waterfront District's is many). Each `{ name, regionName, x, y, port }` - its province's region's name (WW-R's, as the Bay's rows
 *  name theirs: Cyrodiil, not the painting's Imperial Province), and whether it is a port (the city's own word,
 *  arenaInkCities; a capital's harbour slice its capital's). The find box's index read MAPS.BSA's 62 regions alone.
 *  @param {?{ cities: any[] }} ink */
export function tamrielFindRows(ink) {
  const out = [];
  for (const c of ink?.cities ?? []) {
    const x = c.pixel ? c.pixel.x : Math.floor(c.x), y = c.pixel ? c.pixel.y : Math.floor(c.y);
    const regionName = REGION_NAMES[regionOfTheatre(THEATRE_KEYS.indexOf(c.province))] ?? provinceByKey(c.province)?.name ?? '';
    out.push({ name: c.name, regionName, x, y, port: !!c.port });
    const k = c.capital && c.pixel ? CAPITALS.findIndex((cap) => cap.name === c.name && cap.province === c.province) : -1;
    if (k < 0) continue;
    const cap = CAPITALS[k], seen = new Set([c.name]), harbour = capitalHarbourSlice(cap);
    // the harbour's slice first - its name's row its own, a port where its capital is (the registry's) - then nearest the centre
    const slices = capitalSpanPixels(k).map((p, s) => ({ p, s, d: s === harbour ? -1 : Math.hypot(p.x - x, p.y - y) })).sort((a, b) => a.d - b.d || a.s - b.s);
    for (const { p, s } of slices) {
      const name = capitalSliceName(cap, s);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, regionName, x: p.x, y: p.y, port: s === harbour && !!c.port });
    }
  }
  return out;
}

/** FIND-FOUND (Discord, 2026-10-31: a quest's town "Helbenar" not in the find box): THE FIND BOX'S FOUND PLACES PAST THE
 *  BAY - the countryside's and the lairs' (TESA7, TESA8) are a pixel's roll and no list, so the box finds one once the
 *  player has found it, as the Bay's box finds a discovered place. `found` is the store's rows (systems/discovery.js
 *  foundMadePlaces); each row its pixel read back off its map id, the Bay's own ids and any other lane left out.
 *  @param {ReadonlyArray<{ mapId: number, regionName: string, locationName: string }>} found */
export function tamrielFoundRows(found) {
  const out = [];
  for (const f of found ?? []) {
    const p = countryPixelOfId(f.mapId) ?? lairPixelOfId(f.mapId);
    if (!p || inBay(p.x, p.y)) continue;
    out.push({ name: f.locationName, regionName: f.regionName ?? '', x: p.x, y: p.y, port: false });
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
/** AUDIT TESA II M11: how many road tiles' walked chains are kept - the one read longest ago let go first. They had no
 *  bound: a pan over the whole continent at mid or near kept every tile's, 40 MB on the freeware's network, for the
 *  session. A mid view reads about 150 road tiles (its paint tiles' rectangles and their rims); this is three of them. */
export const ROAD_INK_KEPT = 512;
export function arenaRoadInkAt(tx, ty) {
  const k = roadTileKey(tx, ty), v = arenaRoadTiles().get(k);
  if (!v) { _roadInk.delete(k); return NO_ROADS; }
  const had = _roadInk.get(k);
  if (had?.v === v) { _roadInk.delete(k); _roadInk.set(k, had); return had.ink; }   // read again: to the back of the line
  const ink = arenaRoadInkTile(arenaRoadsLayer(), tx, ty);
  _roadInk.delete(k);
  _roadInk.set(k, { v, ink });
  while (_roadInk.size > ROAD_INK_KEPT) _roadInk.delete(/** @type {number} */ (_roadInk.keys().next().value));
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
 *  all) or ROAD_KEPT_TILES are kept. AUDIT TESA II M11: the one read longest ago let go first (they were dropped whole
 *  when full), a tile with no pixel kept as none at all (the contain view asks every tile of the frame, 5,546, and the
 *  empty ones filled the count), and the count past the freeware's network (1,702 road tiles hold a pixel) so the
 *  continent's contain view is kept whole. */
export const ROAD_KEPT_TILES = 2048;
/** AUDIT TESA II M11: the runs are dearer to keep than the dots (two points a step against two floats a pixel: the whole
 *  network's runs 85 MB, its dots 7) and are read at far alone, where a view reads some 530 road tiles with their rims -
 *  so they are kept to their own count. */
export const ROAD_RUNS_KEPT = 768;
let _keptFor = -1;
/** @type {Map<number, { roads: Pt[][], tracks: Pt[][] }>} */ const _steps = new Map();
/** @type {Map<number, { roads: Float32Array, tracks: Float32Array }>} */ const _dots = new Map();
const NO_STEPS = Object.freeze({ roads: Object.freeze([]), tracks: Object.freeze([]) });
const NO_DOTS = Object.freeze({ roads: new Float32Array(0), tracks: new Float32Array(0) });
const keptFresh = () => {
  const v = arenaRoadsVersion();
  if (v !== _keptFor) { _keptFor = v; _steps.clear(); _dots.clear(); }
};
/** A kept map's entry read again: to the back of the line. */
const touch = (m, k) => { const had = m.get(k); if (had) { m.delete(k); m.set(k, had); } return had; };
const keep = (m, k, v, cap) => { m.set(k, v); while (m.size > cap) m.delete(/** @type {number} */ (m.keys().next().value)); return v; };
/** AUDIT TESA II M11: what the map's road ink keeps, let go - the window shut (ui/heldMap.js _close): the walked chains, the
 *  runs and the dots are walked again from the installed layer the next time the map is open. */
export function releasePastBayInk() { _roadInk.clear(); _steps.clear(); _dots.clear(); _keptFor = -1; }
const roadTileOf = (v) => Math.floor(v / ROAD_TILE);
/** AUDIT TESA II M10: the layer's pixels the far painters have walked to make their kept runs and dots - a step of the
 *  sliced paint counts them as its work beside what it lays, so a cold tile's walk is a step's share, not a stall. */
let _walked = 0;
/** A road tile's runs: the steps that start on it, each run one two-point chain. AUDIT TESA II M12: a run is cut where it
 *  leaves its road tile - it ends on the first pixel past it, and that pixel starts the next - so every run lies on its own
 *  tile and one step over its edge, and a far tile, which reads the runs of its road tiles and their one-tile rim, strokes
 *  every step that crosses it whatever the run's length (one longer than ROAD_TILE, starting off the rim, was left off). */
function tileSteps(layer, tx, ty) {
  keptFresh();
  const k = roadTileKey(tx, ty), had = touch(_steps, k);
  if (had) return had;
  const keys = arenaRoadTilePixels(tx, ty);
  if (!keys.size) return NO_STEPS;
  _walked += keys.size;
  /** @type {{ roads: Pt[][], tracks: Pt[][] }} */
  const out = { roads: [], tracks: [] };
  const home = (x, y) => roadTileOf(x) === tx && roadTileOf(y) === ty;
  for (const key of keys) {
    const [x, y] = beyondPixel(key);
    for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
      const bits = layer[kind].get(key);
      if (!bits) continue;
      for (const [bit, dx, dy] of DIR_DELTA) {
        if (!(bits & bit) || (!FORWARD.has(bit) && (layer[kind].get(beyondKey(x + dx, y + dy)) ?? 0) & /** @type {number} */ (OPPOSITE_BIT.get(bit)))) continue;
        let n = 1;
        if (FORWARD.has(bit)) {
          if (home(x - dx, y - dy) && (layer[kind].get(beyondKey(x - dx, y - dy)) ?? 0) & bit) continue;   // the run's own start draws it
          while (home(x + n * dx, y + n * dy) && (layer[kind].get(beyondKey(x + n * dx, y + n * dy)) ?? 0) & bit) n++;
        }
        out[kind].push([{ x: x + 0.5, y: y + 0.5 }, { x: x + n * dx + 0.5, y: y + n * dy + 0.5 }]);
      }
    }
  }
  return keep(_steps, k, out, ROAD_RUNS_KEPT);
}
/** A road tile's pixels of each kind, as centres (x, y, x, y, ...). */
function tileDots(layer, tx, ty) {
  keptFresh();
  const k = roadTileKey(tx, ty), had = touch(_dots, k);
  if (had) return had;
  const keys = arenaRoadTilePixels(tx, ty);
  if (!keys.size) return NO_DOTS;
  _walked += keys.size;
  const at = { roads: /** @type {number[]} */ ([]), tracks: /** @type {number[]} */ ([]) };
  for (const key of keys) {
    for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
      if (!layer[kind].get(key)) continue;
      const [x, y] = beyondPixel(key);
      at[kind].push(x + 0.5, y + 0.5);
    }
  }
  return keep(_dots, k, { roads: Float32Array.from(at.roads), tracks: Float32Array.from(at.tracks) }, ROAD_KEPT_TILES);
}
/** AUDIT TESA II M11: how many road tiles the far painters keep now, each kind (the pins' read). */
export const roadKeptCounts = () => ({ steps: _steps.size, dots: _dots.size, ink: _roadInk.size });
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
  return `${r}|${p}|${watersInkVersion()}|${discoveryGeneration()}`;   // MAP-WATERS: and the waters' install - AUDIT TAMRIEL-WIDE D2: and a find, which inks its place
}

/** TESA13: THE COUNTRYSIDE'S AND THE LAIRS' MARKS IN A VIEW - each place the host's atlas holds on the view's pixels
 *  (world/tamrielAtlas.js placesIn, within the continent's frame) that the band inks and no filter hides - the Bay's own
 *  laws for its marks (travelMapWindow getPixelColorIndex, inkMap BAND_MARKS and markKind) - as `{ place, kind, x, y }`
 *  on the pixel's centre, in the sheet's coordinates. None at far: far inks the cities alone, and none is the
 *  countryside's. No discovery law: every place past the Bay is inked, as TESA1's are. BAY-LEFT-MAPS (C11): none under
 *  the Ports filter (`portsOnly`, the travel map's Ports button) - the countryside and the lairs stand no harbour (TESA7),
 *  and on the Bay the filter keeps a port's mark alone.
 *  @param {{ox:number,oy:number,scale:number}} view @param {?PlacesIn} placesIn
 *  @param {{ paperW: number, paperH: number, band?: string, filters?: any, portsOnly?: boolean, frame?: ?{ x0: number, y0: number, w: number, h: number } }} opts */
export function tamrielMarksIn(view, placesIn, opts) {
  const { paperW, paperH, band = zoomBand(view.scale), filters = {}, frame = null } = opts;
  if (!placesIn || band === 'far' || opts.portsOnly) return [];
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
 *  @param {{ band?: string, filters?: any, portsOnly?: boolean, frame?: any }} [opts] */
export function tamrielMarkAt(mx, my, view, placesIn, opts = {}) {
  const reach = CITY_HIT_PX / view.scale;
  if (!placesIn || farInBay(mx, my, reach)) return null;   // AUDIT TESA II M14: a mark on the seam answers from the Bay's side too
  const near = { ox: mx - reach, oy: my - reach, scale: view.scale };
  let best = null, bd = reach;
  for (const m of tamrielMarksIn(near, placesIn, { ...opts, paperW: 2 * CITY_HIT_PX, paperH: 2 * CITY_HIT_PX, band: opts.band ?? zoomBand(view.scale) })) {
    const d = Math.hypot(m.x - mx, m.y - my);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** TESA10d: the pixel a city of a capital's name and province stands on - a portal's end there and a journey's (TRAVEL-EVERYWHERE) - the capital's, where a host stands the
 *  capitals (world/tamrielCapitals.js capitalsStanding) - or null. */
function capitalStandsAt(city) {
  const at = capitalsStanding() ? capitalPin(city) : null;
  return at ? { x: at.px, y: at.py } : null;
}

/** The continent's city within CITY_HIT_PX of a sheet point (paper pixels at the view's scale), or null - the hover's
 *  read and, TESA2, the press's. */
export function tamrielCityAt(mx, my, view, ink, { filters = {}, continent = false, portsOnly = false } = {}) {
  const reach = CITY_HIT_PX / view.scale;
  if (!ink || farInBay(mx, my, reach)) return null;   // AUDIT TESA II M14: a city on the seam answers from the Bay's side too
  let best = null, bd = reach;
  for (const c of ink.cities) {
    // AUDIT TESA II M7: only a city the sheet inks - under the map's filters, and on the continent the capitals alone
    // (BAY-LEFT-MAPS C11: and under the Ports filter a port alone, as paintTamrielInk inks them)
    if ((continent && !c.capital) || tamrielCityBucket(c, filters) < 0 || (portsOnly && !c.port)) continue;
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
    const pixel = capitalStandsAt(c);   // TESA10d: a capital the world stands is inked on its pixel - on the teleport map a portal's end, on the travel map a journey's (TRAVEL-EVERYWHERE)
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
  if (stale(ink)) { ink = { ...buildTamrielInk({ bayCoast: key }), bayCapitals: bayCapitals(bayModel) }; _inks.set(key, ink); }
  return ink;
}

/** REGION-LINES: the Bay's capitals - the three kingdoms' own cities (systems/region/regionHubs.js HUB_CAPITALS) - as the
 *  continent's layer names a capital, so out on the continent the Bay stands as every other province does.
 *  @param {{ marks?: Array<{ kind: string, name?: string, x: number, y: number, summary?: any }> }} bayModel */
export function bayCapitals(bayModel) {
  return (bayModel?.marks ?? []).filter((m) => m.kind === 'city' && HUB_CAPITALS.includes(m.name ?? '')).map((m) => ({ name: m.name, x: m.x, y: m.y, capital: true, kind: 'city-state', mapId: m.summary?.mapID ?? m.summary?.mapId ?? null }));   // WW7-6: its seat's key
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
 * AUDIT TESA II M10: handed a tile's `job` it answers its paint as steps (pastBayJob) - the tile painted a step at a time
 * under the frame's budget, each translucent pass laid on the job's scratch and down whole - and with none paints whole.
 * @param {CanvasRenderingContext2D} ctx @param {{ox:number,oy:number,scale:number}} view
 * @param {{ paperW: number, paperH: number, band?: string, continent?: boolean, filters?: any, inks?: any, portsOnly?: boolean,
 *   placesIn?: ?PlacesIn, frame?: ?{ x0: number, y0: number, w: number, h: number } }} opts
 * @param {?{ scratch: () => any, coverage?: () => any, pixels?: () => Uint8ClampedArray }} [job] - MAP-WHOLE: `coverage` the job's mask and `pixels` its RGBA, the continent's dots rasterised by hand (ui/inkRaster.js)
 */
export function paintPastBay(ctx, view, opts, job = null) {
  const it = pastBayJob(ctx, view, opts, job);
  if (job) return it;
  ctx.save();
  for (const _ of it) { /* painted whole, straight onto the sheet */ }
  ctx.restore();
  return undefined;
}
/** AUDIT TESA II M10: how much of a tile's paint is one step of it - rects or segments a pass, glyphs of the marks - so a
 *  frame's budget (ui/tamrielTiles.js TILE_BUDGET_MS) is read between steps, not only between tiles: out on the continent
 *  one tile was a path of 302,205 rects (the freeware's network, the contain view at one device pixel a point). */
export const PAST_BAY_STEP = 2048;
export const PAST_BAY_MARKS_STEP = 512;
/** MAP-WHOLE: a rasterised dot's share of a step against a path's rect - a few typed-array writes where the canvas walked
 *  a sub-path (measured on a CPU canvas: 300,000 dots 28 ms against 370-1,500 ms); a step of the raster is eight times
 *  PAST_BAY_STEP dots. */
export const RASTER_STEP_SHARE = 1 / 8;
/** A translucent pass laid down: the scratch it was laid on solid, at the pen's alpha, whole. */
function layDown(ctx, target, alpha) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(target.canvas, 0, 0);
  ctx.restore();
}
/** Where a translucent pass is laid: the job's scratch, solid (layDown lays it at the pen's alpha once, so a pass cut in
 *  steps reads as the one fill or stroke it was), or - painting whole - the canvas itself in the pen. */
function passOf(ctx, job, style) {
  if (!job) return { target: ctx, style, alpha: 1 };
  const { solid, alpha } = penSolid(style), target = job.scratch();
  target.lineCap = 'round';
  target.lineJoin = 'round';
  return { target, style: solid, alpha };
}
/**
 * MAP-WHOLE (ui/inkRaster.js): a dots pass RASTERISED - the job's coverage mask (its own, ui/tamrielTiles.js) and its
 * scratch, where the canvas can take pixels (a 2D context with putImageData; anything else paints its paths as before).
 * `stamp` lays the pass's shapes in paper pixels (dpr the scratch's own: its canvas's width over the paper's), `lay`
 * puts the mask on the scratch in the pen's solid colour and lays the scratch down at its alpha - the one fill or stroke
 * the pass was (layDown).
 */
function rasterPass(ctx, job, style, paperW) {
  const cov = job?.coverage?.();
  if (!cov) return null;
  const target = job.scratch();
  if (typeof target?.putImageData !== 'function' || typeof ImageData === 'undefined' || !(target.canvas?.width > 0)) return null;
  clearCoverage(cov);
  const d = target.canvas.width / paperW, { alpha } = penSolid(style), rgb = penRgb(style);
  return {
    dot: (x, y, w) => stampSquare(cov, x * d, y * d, w * d),
    lay: () => {
      if (cov.any) target.putImageData(new ImageData(/** @type {Uint8ClampedArray<ArrayBuffer>} */ (coveragePixels(cov, rgb, job.pixels?.())), cov.w, cov.h), 0, 0);
      layDown(ctx, target, alpha);
    },
  };
}

/** The paint as steps (paintPastBay): the roads and the tracks a pass a kind, then the marks' halos and their glyphs. */
function* pastBayJob(ctx, view, opts, job) {
  const { paperW, paperH } = opts;
  const band = opts.band ?? zoomBand(view.scale), filters = opts.filters ?? {};
  const step = job ? PAST_BAY_STEP : Infinity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const x1 = view.ox + paperW / view.scale, y1 = view.oy + paperH / view.scale;
  // the installed layer read again after every step: an install between two frames is the one the next step walks (a
  // whole install moves every tile's word, and the tile's paint is begun again)
  let layer = arenaRoadsLayer();
  const fresh = () => (layer = arenaRoadsLayer());
  // MAP-WATERS: stream G's rivers and lakes first, under the roads (a bridge's road over its river), a tile's paint like
  // the rest - off the worker's copy (world/tamriel/watersInk.js), so the law's compile is never the map's
  const waters = watersInk();
  if (waters) { paintWaters(ctx, view, paperW, paperH, waters); if (job) yield; }
  if (band === 'far' && view.scale < DOTS_BELOW) {
    // out on the continent each pixel a dot of the far pen's width (DOTS_BELOW), the tracks under the roads
    const s = view.scale;
    for (const kind of /** @type {const} */ (['tracks', 'roads'])) {
      if (filters[kind] || !layer) continue;
      const pen = pathPen(kind, 'far'), w = pen.width;
      const ras = rasterPass(ctx, job, pen.style, paperW);
      if (ras) {   // MAP-WHOLE: each pixel's dot a square of the mask, the pass laid once
        let n = 0, walked = _walked;
        for (let ty = Math.floor(view.oy / ROAD_TILE); ty <= Math.floor(y1 / ROAD_TILE); ty++) {
          for (let tx = Math.floor(view.ox / ROAD_TILE); tx <= Math.floor(x1 / ROAD_TILE); tx++) {
            const at = tileDots(layer, tx, ty)[kind];
            for (let i = 0; i < at.length; i += 2) ras.dot((at[i] - view.ox) * s, (at[i + 1] - view.oy) * s, w);
            n += at.length / 2;
            if (n * RASTER_STEP_SHARE + _walked - walked >= step) { n = 0; walked = _walked; yield; if (!fresh()) return; }
          }
        }
        ras.lay();
        continue;
      }
      const p = passOf(ctx, job, pen.style);
      p.target.fillStyle = p.style;
      p.target.beginPath();
      let n = 0, walked = _walked;
      for (let ty = Math.floor(view.oy / ROAD_TILE); ty <= Math.floor(y1 / ROAD_TILE); ty++) {
        for (let tx = Math.floor(view.ox / ROAD_TILE); tx <= Math.floor(x1 / ROAD_TILE); tx++) {
          const at = tileDots(layer, tx, ty)[kind];   // ZOOM-FAST: the tile's centres, kept
          for (let i = 0; i < at.length; i += 2) {
            p.target.rect((at[i] - view.ox) * s - w / 2, (at[i + 1] - view.oy) * s - w / 2, w, w);
            if (++n >= step) { p.target.fill(); yield; if (!fresh()) return; p.target.fillStyle = p.style; p.target.beginPath(); n = 0; walked = _walked; }
          }
          if (n + _walked - walked >= step) { p.target.fill(); yield; if (!fresh()) return; p.target.fillStyle = p.style; p.target.beginPath(); n = 0; walked = _walked; }
        }
      }
      p.target.fill();
      if (job) layDown(ctx, p.target, p.alpha);
    }
  } else if (band === 'far') {
    // at far each pixel's steps as they lie (arenaRoadSteps' runs, a road tile's own), the roads under the tracks
    for (const kind of PATH_KINDS) {
      if (filters[kind] || !layer) continue;
      const pen = pathPen(kind, band), p = passOf(ctx, job, pen.style), { stroke } = penOf(p.target, view, paperW, paperH);
      let batch = [], walked = _walked;
      for (let ty = Math.floor(view.oy / ROAD_TILE) - 1; ty <= Math.floor(y1 / ROAD_TILE) + 1; ty++) {
        for (let tx = Math.floor(view.ox / ROAD_TILE) - 1; tx <= Math.floor(x1 / ROAD_TILE) + 1; tx++) {
          for (const c of tileSteps(layer, tx, ty)[kind]) batch.push(c);
          // a step's work: the runs it lays and the pixels it walked to make them - a tile at most past PAST_BAY_STEP
          if (batch.length + _walked - walked >= step) { stroke(batch, pen.width, p.style, pen.dash); batch = []; walked = _walked; yield; if (!fresh()) return; }
        }
      }
      stroke(batch, pen.width, p.style, pen.dash);
      if (job) layDown(ctx, p.target, p.alpha);
    }
  } else {
    // in to the Bay's scale the walked chains, softened as the Bay's own - a mid or near tile is a few Bay pixels a side
    strokePaths(penOf(ctx, view, paperW, paperH).stroke, arenaRoadsIn(view.ox, view.oy, x1, y1), band, filters);
    if (band === 'near' && waters) paintBridges(ctx, view, paperW, paperH, waters, filters);   // ROAD-LOOK: and their bridges over the rivers
  }
  if (!opts.continent) {
    yield;
    const pad = MARK_REACH_PX / view.scale;
    const near = { ox: view.ox - pad, oy: view.oy - pad, scale: view.scale };
    const marks = tamrielMarksIn(near, opts.placesIn ?? null, { paperW: paperW + 2 * MARK_REACH_PX, paperH: paperH + 2 * MARK_REACH_PX, band, filters, portsOnly: !!opts.portsOnly, frame: opts.frame ?? null });   // BAY-LEFT-MAPS C11: the Ports filter
    const at = marks.map((m) => toPaper(view, m.x, m.y));
    // MAP-FIELD6: every halo before every glyph - each its own path, so the steps change nothing of how they lie
    for (const halo of [true, false]) {
      for (let i = 0; i < marks.length; i++) {
        paintGlyph(ctx, marks[i].kind, at[i][0], at[i][1], halo, halo ? undefined : opts.inks?.[marks[i].kind]);
        if ((i + 1) % PAST_BAY_MARKS_STEP === 0 && job) yield;
      }
    }
  }
}

/** ROAD-LOOK: A BRIDGE'S MARK - the road's two parapets drawn either side of it along it, BRIDGE_MARK.gap paper pixels
 *  out, over the river's width (never under BRIDGE_MARK.least), in the line's own pen. */
export const BRIDGE_MARK = Object.freeze({ gap: 2.5, least: 3, width: 1.2 });
/** ROAD-LOOK: THE BRIDGES ON THE SHEET, in to the Bay's scale (`near`): every bridge (world/road/roadBridges.js bridgesOf - its
 *  crossings wider than a ford) of a pixel the map's copy of the rivers reaches and the view holds, off the installed layer
 *  and that copy (inkBridgeLaw: the law's compile never the map's), a kind its filter hides drawn none. */
export function paintBridges(ctx, view, paperW, paperH, waters, filters = {}) {
  const law = inkBridgeLaw(waters), { stroke } = penOf(ctx, view, paperW, paperH);
  const x1 = view.ox + paperW / view.scale, y1 = view.oy + paperH / view.scale, chains = [];
  for (const k of law.index.keys()) {
    const px = Math.round(k / 65536), py = k - px * 65536;   // the key x * 65536 + y: a row north of the Bay's (y < 0) its own
    if (px < view.ox - 1 || px > x1 || py < view.oy - 1 || py > y1) continue;
    for (const b of bridgesOf(px, py, arenaRoadByte, law)) {
      if (filters[b.kind === 'road' ? 'roads' : 'tracks']) continue;
      const L = Math.max(b.half / PIXEL_M, BRIDGE_MARK.least / view.scale), o = BRIDGE_MARK.gap / view.scale, nx = -b.uy, ny = b.ux;
      for (const side of [-1, 1]) chains.push([{ x: b.x - b.ux * L + side * nx * o, y: b.y - b.uy * L + side * ny * o }, { x: b.x + b.ux * L + side * nx * o, y: b.y + b.uy * L + side * ny * o }]);
    }
  }
  if (chains.length) stroke(chains, BRIDGE_MARK.width, PEN.line);
  return chains.length / 2;
}

/** MAP-WATERS: a river's width on the map, paper pixels - its metres at the view's scale, in steps of `step` (so a river's
 *  runs are few), never under `min` (a hairline out on the continent) nor over `max`; `wash` the shore's shade round it. */
export const RIVER_PEN = Object.freeze({ min: 0.9, step: 0.5, max: 14, wash: 2.5 });
const PIXEL_M = 819.2;
/** A river's runs at a scale: its centre line cut where its width's step changes - `{ width, chain }`, the chain the run's
 *  points ({x, y}, Bay coordinates) with its neighbours' shared ends. Kept a river and a scale at a time. */
const _runs = new WeakMap();
export function riverRuns(river, scale) {
  let byScale = _runs.get(river);
  if (!byScale) _runs.set(river, byScale = new Map());
  let runs = byScale.get(scale);
  if (runs) return runs;
  runs = [];
  let cur = null;
  for (let i = 0; i < river.n; i++) {
    const p = { x: river.pts[2 * i], y: river.pts[2 * i + 1] };
    const w = Math.min(RIVER_PEN.max, Math.max(RIVER_PEN.min, Math.round((river.width[i] / PIXEL_M) * scale / RIVER_PEN.step) * RIVER_PEN.step));
    if (!cur) { cur = { width: w, chain: [p] }; runs.push(cur); continue; }
    if (w !== cur.width) { cur.chain.push(p); cur = { width: w, chain: [p] }; runs.push(cur); continue; }   // the point a step changes at ends one run and opens the next
    cur.chain.push(p);
  }
  // thinned to a third of a paper pixel: a river's points stand some 100 m apart, forty to a paper pixel out on the continent
  for (const run of runs) if (run.chain.length > 2) run.chain = simplifyChain(run.chain, 0.35 / scale);
  byScale.set(scale, runs);
  return runs;
}
/** MAP-WATERS: stream G's waters (world/tamriel/watersInk.js - the law's rivers and lakes) in the shore's hand - the wash
 *  round each river's run, then its line at its width; a lake's ring as the coast is drawn - those whose box the view
 *  reaches. */
function paintWaters(ctx, view, paperW, paperH, waters) {
  const { stroke } = penOf(ctx, view, paperW, paperH);
  const s = view.scale, seen = watersInView(view, paperW, paperH, waters);
  for (const r of seen.rivers) {
    const runs = riverRuns(r, s);
    for (const run of runs) stroke([run.chain], Math.max(RIVER_PEN.wash, run.width * 2 + 1), PEN.wash);
    for (const run of runs) stroke([run.chain], run.width, PEN.line);
  }
  const lakes = seen.lakes.map(lakeChainOf);
  if (!lakes.length) return;
  stroke(lakes, Math.max(3, s * 1.6), PEN.wash);   // the coast's own hand (paintTamrielInk)
  stroke(lakes, 1.3, PEN.line);
}
/** MAP-WATERS: the rivers and lakes whose box (Bay pixels) the view reaches, a pixel's slack round it - the rest not
 *  walked at all (a river's runs are made a scale at a time, riverRuns). */
export function watersInView(view, paperW, paperH, waters) {
  const x1 = view.ox + paperW / view.scale, y1 = view.oy + paperH / view.scale;
  const off = (b) => b[0] > x1 + 1 || b[2] < view.ox - 1 || b[1] > y1 + 1 || b[3] < view.oy - 1;
  return { rivers: waters.rivers.filter((r) => !off(boxOf(r.pts, r.n))), lakes: waters.lakes.filter((l) => !off(boxOf(l, l.length / 2))) };
}
const _boxes = new WeakMap(), _lakes = new WeakMap();
function boxOf(pts, n) {
  let b = _boxes.get(pts);
  if (b) return b;
  b = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) { const x = pts[2 * i], y = pts[2 * i + 1]; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
  _boxes.set(pts, b);
  return b;
}
const lakeChainOf = (ring) => { let c = _lakes.get(ring); if (!c) _lakes.set(ring, c = ringChain(ring)); return c; };
/** A lake's ring (Bay coordinates, x y pairs) as a closed chain. */
export function ringChain(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i += 2) out.push({ x: ring[i], y: ring[i + 1] });
  if (out.length) out.push({ ...out[0] });
  return out;
}

/** MAP-WHOLE (ui/tamrielTiles.js BASE_SCALE): the base's paint - the continent's whole frame out on the continent, under
 *  the view's own filters and hues (its key is theirs), its words read again when the roads' installs or the places'
 *  adds move. */
export function baseOf(past, ink) {
  if (!ink.frame) return null;
  return { key: `far|1|${JSON.stringify(past.filters)}|${JSON.stringify(past.inks)}`, paint: { ...past, band: 'far', continent: true }, frame: ink.frame, version: `${arenaRoadsVersion()}|${pastBayPlacesVersion()}|${watersInkVersion()}` };
}

/** REGION-LINES: the provinces' line (PROVINCE_PEN) - halo, then the stroke, solid. */
function provinceLines(ctx, view, paperW, paperH, chains) {
  const { stroke } = penOf(ctx, view, paperW, paperH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  stroke(chains, PROVINCE_PEN.halo, PEN.halo);
  stroke(chains, PROVINCE_PEN.line, PEN.line);
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
 *   under?: () => void, part?: 'under' | 'roads' | 'over', settling?: boolean, seatAt?: (city: any) => any, nameless?: ?((c: any) => boolean),
 *   portsOnly?: boolean }} opts -
 *   AUDIT TESA II M6: `nameless` a city whose name the window letters itself (the zone map's, inside its zone); `under` painted over the land, the
 *   roads and the borders and under the cities and the names. ZOOM-FAST: `part` paints one third alone - the land under the
 *   roads (the shore, the high ground, the rivers), the roads' tiles, or what stands over them (the borders, the window's
 *   `under`, the Bay's frame, the cities, the names) - so the window keeps the first and the last on layers of their own and
 *   a frame that only paints the roads' owed tiles is three drawImages; `settling` (the view's scale still moving) paints no
 *   tile, only the kept ones and their stand-ins. WW7-6: `seatAt` the seat a city is (its `mapId`, the seat's key), or
 *   null - ringed under its glyph. BAY-LEFT-MAPS (C11): `portsOnly` the travel map's Ports filter - a port alone inked, as
 *   on the Bay - and a port's anchor beside its glyph in to the Bay's own scale.
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
  const past = { paperW, paperH, band, continent, filters: opts.filters ?? {}, inks: opts.inks ?? null, placesIn: opts.placesIn ?? null, frame: ink.frame, portsOnly: !!opts.portsOnly };   // BAY-LEFT-MAPS C11: the Ports filter
  if (!part || part === 'roads') {
    if (opts.tiles) opts.tiles.draw(ctx, view, { paperW, paperH, dpr: opts.dpr ?? 1, key: `${band}|${continent ? 1 : 0}|${JSON.stringify(past.filters)}|${JSON.stringify(past.inks)}|${past.portsOnly ? 1 : 0}`, paint: past, ...(opts.settling ? { budgetMs: 0, force: false } : {}), base: baseOf(past, ink) });
    else paintPastBay(ctx, view, past);
  }
  if (part && part !== 'over') { ctx.restore(); return true; }
  // REGION-LINES (the owner: "Theres no visible region lines", then a map of Tamriel each province cleanly parted: "This is
  // what I mean by region lines. Each region distinctly separated"): the provinces' borders - the regions past the Bay
  // (WW-R) - solid on a halo (PROVINCE_PEN), OVER the roads' web (under it, in the tracks' own pen, a border read as one
  // more track). High Rock and Hammerfell need none on the Bay: its water and the Bjoulsae part them on Daggerfall's own
  // map. The 43 biome zones' borders stood here a day and were withdrawn (2026-10-25, the owner: "Those are just random
  // lines"): unnamed, wandering through the land, they told a player nothing
  provinceLines(ctx, view, paperW, paperH, ink.borders);
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
  const named = [], marks = [];
  for (const c of continent && ink.bayCapitals ? ink.cities.concat(ink.bayCapitals) : ink.cities) {   // REGION-LINES: the Bay's capitals out on the continent
    if (!c.capital && !all) continue;
    if (!visible(c.x, c.y)) continue;
    // TESA1: a place past the Bay by its kind - AUDIT TESA II M7: its bucket under the map's filters, its glyph that
    // bucket's and in its classic hue (MAP-KEY), as the Bay's own towns and the countryside's
    const bucket = tamrielCityBucket(c, opts.filters ?? {});
    if (bucket < 0) continue;
    // BAY-LEFT-MAPS (AUDIT LEFT IN THE BAY C11): the Ports filter keeps a port alone, as the Bay's own marks (heldMap.js
    // _discovered, portsFilterAllows) - and a port's anchor beside its glyph wherever the sheet is in to the Bay's own scale
    // (inkMap paintHarbour, PORT-MAP's: out on the continent the Bay draws none either, REGION-LINES)
    if (opts.portsOnly && !c.port) continue;
    const glyph = markKind(bucket);
    const [x, y] = toPaper(view, c.x, c.y);
    marks.push({ kind: glyph, seat: c.mapId != null ? opts.seatAt?.(c) ?? null : null, x, y, port: all && !!c.port });   // WW7-6: its seat's ring under its glyph
    if (!opts.nameless?.(c)) named.push([c, x, y]);   // AUDIT TESA II M6: a name the window letters itself (the zone map's)
  }
  // WW7-6: a seat's ring past the Bay as the Bay rings its own (inkMap paintSeatRing, Seats-Arc 3.3) - under the glyph
  for (const m of marks) if (m.seat) paintSeatRing(ctx, m.x, m.y, markReach(m), seatMapMark(m.seat));
  for (const m of marks) paintGlyph(ctx, m.kind, m.x, m.y, true);
  for (const m of marks) paintGlyph(ctx, m.kind, m.x, m.y, false, opts.inks?.[m.kind]);   // AUDIT TESA II M7: in its classic hue (MAP-KEY)
  for (const m of marks) if (m.port) paintHarbour(ctx, m.x, m.y, true);   // BAY-LEFT-MAPS C11: a port's anchor, beside its glyph
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
  // REGION-LINES: each province's name on a halo of the parchment, as a place's is - over the roads' web the bare name
  // was lost, and the name is what tells one parted province from the next
  ctx.font = `300 ${continent ? 18 : 19}px ${NAME_FACE}`;
  const shown = ink.provinces.filter((p) => visible(p.x, p.y, 60)).map((p) => [spacedName(p.name), ...toPaper(view, p.x, p.y)]);
  ctx.strokeStyle = PEN.halo;
  ctx.lineWidth = 3 * HALO_PEN;
  for (const [name, x, y] of shown) ctx.strokeText(name, x, y);
  ctx.fillStyle = PEN.region;
  for (const [name, x, y] of shown) ctx.fillText(name, x, y);
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
 * @param {?{ placesIn: ?PlacesIn, nameOf?: ?((x: number, y: number) => string), band?: string, filters?: any, portsOnly?: boolean, continent?: boolean }} [marks]
 */
export function tamrielPlaceAt(mx, my, view, ink = null, marks = null) {
  return tamrielHoverAt(mx, my, view, ink, marks)?.label ?? null;
}
/** AUDIT TESA II M8, M14: tamrielPlaceAt's answer and what it answers ON - `{ on: 'city' | 'mark' | 'land' | 'sea', label }`,
 *  a mark's with its `name` and world `pixel` - so the window can hand bare land its ore card as the Bay's own ground has, and ask the
 *  seam: a city's or a mark's glyph past the Bay answers within its reach though the pointer is on the Bay's side of the
 *  edge (the Bay's own reads come first; the land and the sea answer past the Bay alone).
 *  `marks.continent`: on the continent the cities' hover is the capitals', as the sheet inks them. */
export function tamrielHoverAt(mx, my, view, ink = null, marks = null) {
  const best = tamrielCityAt(mx, my, view, ink, { filters: marks?.filters ?? {}, continent: !!marks?.continent, portsOnly: !!marks?.portsOnly });   // BAY-LEFT-MAPS C11: the Ports filter
  if (best) return { on: 'city', label: TAMRIEL_TEXT.city(provinceByKey(best.province)?.name ?? best.province, best.name, best.kind) };
  // TESA13: a mark of the countryside's or a lair's the view inks, named with its kind in DFU's own words - its province
  // its own pixel's (AUDIT TESA II M14: the pointer may stand on the Bay's side)
  const mark = marks ? tamrielMarkAt(mx, my, view, marks.placesIn, { ...marks, frame: ink?.frame ?? null }) : null;
  if (mark) {
    const mk = provinceKeyAt(...bayToPicture(mark.x, mark.y));
    const name = mark.place.name ?? marks?.nameOf?.(mark.place.x, mark.place.y) ?? '';
    return { on: 'mark', label: TAMRIEL_TEXT.city(provinceByKey(mk)?.name ?? TAMRIEL_TEXT.beyond, name, locationTypeName(mark.place.type)), name, pixel: { x: mark.place.x, y: mark.place.y } };   // OW-PAST-BAY: the pixel a press walks to
  }
  if (inBay(mx, my)) return null;
  const [px, py] = bayToPicture(mx, my);
  const key = provinceKeyAt(px, py);
  if (key) return { on: 'land', label: TAMRIEL_TEXT.land(provinceByKey(key)?.name ?? key) };
  const sea = seaAt(px, py);
  return sea ? { on: 'sea', label: TAMRIEL_TEXT.sea(sea.name) } : null;
}
/** AUDIT TESA II M14: a point on the Bay's own ground further than `reach` from its edge - none of the land past the Bay's
 *  glyphs reaches it. */
const farInBay = (x, y, reach) => inBay(x, y) && Math.min(x, BAY_W - x, y, BAY_H - y) >= reach;
