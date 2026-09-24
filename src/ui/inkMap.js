// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAP1 — THE INK: the Iliac Bay drawn onto the held parchment at
// runtime, from the port's own reading of the data.
//
// Nothing here is a picture. The coast is the land/water boundary of
// WOODS.WLD's height bytes under the ONE water law the streamed
// terrain uses (ui/overworldModel.js isWaterPixel); the province
// borders are where the politic bytes change hands between two land
// pixels; the roads and tracks are Hazelnut's vendored arrays traced
// into chains (traceChains - the port's own generated network is never
// drawn on a map, bible/03-World/Roads.md, and the `source` field TO1
// put on the network object is what tells them apart); the marks are
// MAPS.BSA through the classic window's discovery and bucket laws
// (buildMarkerModel); the names are the game's own strings in a face
// the port ships. It is drawn in an INK style - lines, carets for the
// high ground, a soft shore - onto a 2D canvas that lies on the paper.
//
// TWO HALVES, ONE SEAM. `buildInkModel` is pure and answers a display
// list - chains, marks, centroids - that node pins over small fixtures.
// `paintInk` is the only function that touches a CanvasRenderingContext,
// and it takes the context as an argument so a stub can watch what it
// asks for. The window (ui/heldMap.js) owns WHEN each runs: the model
// once per data set, the paint on every change of view, band, mark or
// discovery.
//
// ZOOM BANDS. `scale` is paper pixels per map pixel. Far out the sheet
// shows the coast, the borders, the roads and the cities with the
// region names across the provinces; closer, every discovered town and
// temple and the tracks; closest, every mark the discovery store admits
// with its name. The bands are skin; the discovery and filter laws
// under them are the classic window's and are consulted through their
// owning module, never re-spelled here.
// ═══════════════════════════════════════════════════════════════════

import { CLIMATES } from '../formats/mapsFile.js';
import {
  isWaterPixel, buildMarkerModel, traceChains, simplifyChain,
  TREELINE_BYTE, SNOWLINE_BYTE,
} from './overworldModel.js';

// ── THE INK (skin): the pen and its washes ───────────────────────────────────────────────
/** THE TWO GROUNDS EVERY COLOUR ON THIS SHEET IS MIXED FROM. The pen
 *  is one brown and the paper is one cream, and every entry below is
 *  one of them at some strength - which is why the map reads as one
 *  hand rather than a palette. Named (EM7) because the quarters'
 *  colours are MIXED against them: `rgb()` with the numbers typed a
 *  second time is how a derived colour stops being derived. */
export const INK_RGB = Object.freeze([58, 40, 22]);
export const PARCHMENT_RGB = Object.freeze([238, 222, 190]);
/** `rgba(...)` from a channel triple and an alpha - the one place this
 *  string is built, so a colour and the number behind it cannot part.
 *  @param {ArrayLike<number>} rgb @param {number} a */
export const rgba = (rgb, a) => `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${a})`;
/** Move `from` this far toward `to`, channel by channel.
 *  @param {ArrayLike<number>} from @param {ArrayLike<number>} to @param {number} t
 *  @returns {number[]} */
export const mixRgb = (from, to, t) => [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * t);

export const PEN = Object.freeze({
  line: rgba(INK_RGB, 0.92),         // the pen
  soft: rgba(INK_RGB, 0.42),         // borders, tracks, minor marks
  relief: rgba(INK_RGB, 0.26),       // MAP-FIELD6: the high ground's carets
  wash: rgba(INK_RGB, 0.10),         // the shore's shade
  name: 'rgba(46, 32, 18, 0.95)',    // a place's name
  region: rgba(INK_RGB, 0.55),       // a province's name
  select: 'rgba(168, 112, 24, 0.95)', // the chosen mark's ring
  player: 'rgba(120, 28, 20, 0.95)',  // the player's own mark
  coords: 'rgba(120, 28, 20, 0.75)',  // MAP2: a bare-pixel destination's cross
  halo: rgba(PARCHMENT_RGB, 0.80),    // MAP-FIELD6: the parchment, quieted under a glyph or a name
});

/**
 * EM7 — THE FOUR QUARTERS, IN THIS HAND.
 *
 * Mac (2026-09-21): "keep our own version of the colored buildings that
 * classic uses".
 *
 * Classic sorts a town's pixels into four groups and paints each in a
 * flat, saturated colour - the temple's tan, the shop's blue, the
 * tavern's green, the house's slate - and that one decision is what
 * makes its town map readable at a glance. The reading is kept. The
 * PAINT is not: a flat 0xff1855be laid on this parchment is a sticker
 * on a map, and the whole point of the enhanced sheet is that it looks
 * drawn.
 *
 * SO EACH QUARTER IS CLASSIC'S OWN HUE, TWICE OVER, and both are
 * DERIVED from `ui/townQuarters.js`'s `CLASSIC_ARGB` rather than picked
 * by eye - change the source (or DFU's settings default moves) and
 * these follow, and a pin can ask whether the tavern's wash is still
 * the tavern's green rather than merely whether it is still a string:
 *
 *   THE WASH is that hue at a watercolour's strength, so the paper's
 *   own cracks and stains read straight through it and the sepia
 *   outline still sits on top as the drawing. One alpha for all four,
 *   because a quarter that got its own strength would be a quarter
 *   someone had shaded by hand.
 *
 *   THE NAME INK is that same hue walked most of the way to the PEN,
 *   so a tavern's name is recognisably the tavern's green and is
 *   unmistakably ink - dark enough to letter with, tinted enough to
 *   tell a temple from a smith without reading either.
 */
export const QUARTER_WASH_A = 0.36;
export const QUARTER_INK_MIX = 0.55;
export const QUARTER_INK_A = 0.95;
/**
 * AND THE TWO NUMBERS ABOVE ARE BOUNDED BY A MEASUREMENT, not by
 * taste. Laid over the parchment, the four washes must stay far enough
 * apart that a player can tell a tavern from a house at a glance, and
 * the four inks the same while each stays dark enough to letter with -
 * `test/townsheet.test.js` puts every pair through CIE76 and holds
 * these floors.
 *
 * The first cut sat at 0.30 and the tightest pair - the tavern's green
 * against the house's slate, both low-chroma and both darkened toward
 * the paper - came out at 9.8, which is a difference you can find when
 * you look for it and not one you READ. A wash pulls every hue toward
 * the parchment, so the alpha is what decides whether four colours stay
 * four colours; it is set here at the smallest value that clears the
 * floor rather than at the largest the sheet can bear.
 */
export const QUARTER_WASH_DE = 11;
export const QUARTER_INK_DE = 15;
/** ...and an ink must also stand off the PAPER, or it is a wash. */
export const QUARTER_INK_PAPER_DE = 45;
/** @param {{r:number,g:number,b:number}} c */
export const quarterWash = (c) => rgba([c.r, c.g, c.b], QUARTER_WASH_A);
/** @param {{r:number,g:number,b:number}} c */
export const quarterInk = (c) => rgba(mixRgb([c.r, c.g, c.b], INK_RGB, QUARTER_INK_MIX), QUARTER_INK_A);
/** MAP-FIELD6 (2026-09-19, Mac: "Some of the glyphs are hard to read. I
 *  want to make everything more readable, without clutter and keeping
 *  the same design").
 *
 *  The trouble was never CONTRAST. The ink sits at luma 43 on parchment
 *  at 172, which is as strong a difference as print. It was that the
 *  parchment is not a flat ground - it is painted with brown cracks and
 *  stains of very nearly the pen's own hue - and a 1.2px line laid over
 *  that has nothing to hold it apart from the paper's own marks.
 *
 *  So each glyph and each name is drawn TWICE: once in `halo`, a wide
 *  soft parchment-light pass that quiets the paper under it, and then
 *  in ink. This is a cartographer's halo and it takes clutter AWAY
 *  rather than adding it - the page keeps exactly the marks it had, and
 *  they stop tangling with the texture. Nothing about the design moves.
 *
 *  The pen is a little heavier with it (1.2 -> 1.5), which thickens
 *  every STROKED glyph - the temple's cross, the dungeon's triangle,
 *  the coven's star, the home's square - and the halo that carries it.
 *
 *  AUDIT MAP-FIELD: the first draft of this sentence said the weight
 *  was "what makes a village's dot and a track's dashes hold together
 *  at the far band", and it was wrong three times over. A village's dot
 *  is `fill()` alone on the ink pass, so `GLYPH_PEN` never touches it -
 *  what changed the dot is its radius, 2 -> 2.2. A track's dashes are
 *  stroked at a width of 1 written into the paint, which this constant
 *  does not reach. And at the FAR band neither is drawn at all: that
 *  band inks cities only, and skips the tracks. */
export const GLYPH_PEN = 1.5;
/** How far the halo stands out past the ink it carries, in paper px.
 *
 *  AUDIT MAP-FIELD: it is the STAND-OFF, and the code now matches the
 *  word. A stroke of width W centred on a path stands out W/2, so a
 *  glyph haloed at `GLYPH_PEN + HALO_PEN` stood out HALO_PEN/2 - half
 *  what this said - while `strokeText` used HALO_PEN as the whole width
 *  and happened to land on the same 1.6px by a different road. Two call
 *  sites, one constant, two meanings, and neither was the one written
 *  here. Both add `2 * HALO_PEN` to the width of the ink they carry
 *  now, so the halo stands out exactly this far from both. */
export const HALO_PEN = 1.6;
/** The room each kind's glyph takes, as a radius in paper pixels - what
 *  a NAME must keep clear of. Taken off paintGlyph below, which is the
 *  one place these shapes are drawn.
 *
 *  AUDIT MAP-FIELD: these are the GEOMETRY, not the ink. A stroked
 *  shape is half a pen wider than its path on each side, so the ink
 *  reaches up to 0.75px past the figures here (worst: the temple, 5.75
 *  against 5). Both users add 1 before testing, and that `+ 1` is
 *  therefore LOAD-BEARING rather than a courtesy margin - it is what
 *  covers the pen. Widen the pen much further and these need redoing. */
export const GLYPH_R = Object.freeze({
  city: 6.5, hamlet: 3.5, village: 2.8, temple: 5, cult: 4.5,
  dungeon: 5, graveyard: 3.8, coven: 5, tavern: 3.2, home: 3.2,
});
/** The hand-lettered face the names are inked in. The enhanced skin's
 *  display face (ui/enhancedStyle.js --display), so the map and the
 *  card beside it agree. */
export const NAME_FACE = "'Cormorant', Georgia, serif";

// ── THE ZOOM BANDS (skin) ────────────────────────────────────────
/** `scale` at which each band begins, in paper pixels per map pixel. */
export const ZOOM_BANDS = Object.freeze([
  Object.freeze({ name: 'far', min: 0 }),
  Object.freeze({ name: 'mid', min: 2.4 }),
  Object.freeze({ name: 'near', min: 5.5 }),
]);
export function zoomBand(scale) {
  let band = ZOOM_BANDS[0].name;
  for (const b of ZOOM_BANDS) if (scale >= b.min) band = b.name;
  return band;
}

/** The classic colour buckets (ui/travelMapWindow.js getPixelColorIndex:
 *  0-2 dungeons, 3 graveyard, 4 coven, 5-7 homes, 8 temple, 9 cult,
 *  10 tavern, 11 city, 12 hamlet, 13 village) read as a GLYPH each. */
export function markKind(colorIndex) {
  if (colorIndex <= 2) return 'dungeon';
  if (colorIndex === 3) return 'graveyard';
  if (colorIndex === 4) return 'coven';
  if (colorIndex <= 7) return 'home';
  if (colorIndex === 8) return 'temple';
  if (colorIndex === 9) return 'cult';
  if (colorIndex === 10) return 'tavern';
  if (colorIndex === 11) return 'city';
  if (colorIndex === 12) return 'hamlet';
  return 'village';
}
/** Which buckets each band inks. Far: the cities alone. Mid: towns,
 *  temples and dungeons. Near: everything the discovery store admits. */
export const BAND_MARKS = Object.freeze({
  far: new Set([11]),
  mid: new Set([0, 1, 2, 8, 9, 10, 11, 12, 13]),
  near: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
});
/** Which buckets each band NAMES (a subset of what it inks). */
export const BAND_NAMES = Object.freeze({
  far: new Set([11]),
  mid: new Set([11, 12]),
  near: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
});
/** The order names compete for room: a city's name beats a farm's. */
export const NAME_RANK = Object.freeze([11, 12, 13, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7]);
/** How many map pixels apart the high-ground carets sit, per band. */
export const CARET_STEP = Object.freeze({ far: 6, mid: 3, near: 2 });

// ── THE CHAINS ───────────────────────────────────────────────────

/**
 * The boundary of a pixel set as unit segments along pixel EDGES:
 * pixel (x, y) owns the square [x, x+1] x [y, y+1], and an edge is
 * emitted wherever `inside` differs across it. THE EDGE OF THE DATA IS
 * NOT A SHORE: no segment is emitted along the map's outer edge, so a
 * coast that runs off the sheet is an open chain ending at the edge
 * rather than a box drawn round the whole bay (AUDIT-MAP A1 - the
 * browser probe's first screenshot had the bay framed in a coastline
 * and its corners chamfered).
 * @param {(x: number, y: number) => boolean} inside
 * @returns {number[][]} [x0, y0, x1, y1] per segment
 */
export function boundarySegments(inside, width, height) {
  const segs = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const here = inside(x, y);
      if (x + 1 < width && here !== inside(x + 1, y)) segs.push([x + 1, y, x + 1, y + 1]);
      if (y + 1 < height && here !== inside(x, y + 1)) segs.push([x, y + 1, x + 1, y + 1]);
    }
  }
  return segs;
}

/**
 * Join unit segments that share endpoints into polylines. Every segment
 * is walked once; a closed loop comes back with its first point
 * repeated at the end, so a stroke closes without a special case.
 * @param {number[][]} segs
 * @returns {{x: number, y: number}[][]}
 */
export function linkSegments(segs) {
  const key = (x, y) => `${x},${y}`;
  const at = new Map();   // endpoint -> [segment index...]
  segs.forEach((s, i) => {
    for (const [x, y] of [[s[0], s[1]], [s[2], s[3]]]) {
      const k = key(x, y);
      const l = at.get(k);
      if (l) l.push(i); else at.set(k, [i]);
    }
  });
  const used = new Uint8Array(segs.length);
  const chains = [];
  const degree = (x, y) => at.get(key(x, y))?.length ?? 0;
  const step = (x, y) => {
    const l = at.get(key(x, y));
    if (!l) return -1;
    for (const i of l) if (!used[i]) return i;
    return -1;
  };
  // AUDIT-MAP A7: a chain ENDS at a junction vertex (degree other than
  // two - three provinces meeting, or two loops touching at a corner),
  // as traceChains ends a road at one. Walked through, the junction was
  // a corner of whichever chain got there first, and roundCorners cut
  // that corner away from the third arm's end: a visible gap in the
  // dashed border at every three-province point.
  // walk on from (x, y) through vertices of degree two, until a junction
  // or a loose end; the points reached, in order
  const walk = (x, y) => {
    const out = [];
    while (degree(x, y) === 2) {
      const i = step(x, y);
      if (i < 0) break;
      used[i] = 1;
      const s = segs[i];
      const nx = s[0] === x && s[1] === y ? s[2] : s[0];
      const ny = s[0] === x && s[1] === y ? s[3] : s[1];
      out.push({ x: nx, y: ny });
      x = nx; y = ny;
    }
    return out;
  };
  const from = (i) => {
    used[i] = 1;
    const s = segs[i];
    const a = { x: s[0], y: s[1] }, b = { x: s[2], y: s[3] };
    // THIS segment first, then on from both its ends - so an open chain
    // comes back whole, and a chain starting at a junction starts THERE
    const forward = walk(b.x, b.y);
    const backward = walk(a.x, a.y);
    chains.push([...backward.reverse(), a, b, ...forward]);
  };
  // the junction-touching segments first, so every arm starts AT its
  // junction; then whatever is left (loops of degree-2 vertices)
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const s = segs[i];
    if (degree(s[0], s[1]) !== 2 || degree(s[2], s[3]) !== 2) from(i);
  }
  for (let i = 0; i < segs.length; i++) if (!used[i]) from(i);
  return chains;
}

/**
 * Chaikin's corner cut with a BOUND: each corner is replaced by two
 * points a quarter of the way along its legs, but never more than
 * `maxCut` map pixels from the corner. A pixel staircase (legs of a
 * pixel or two) rounds exactly as Chaikin rounds it; a long straight
 * run keeps its corner sharp instead of losing a quarter of its length
 * to a chamfer (AUDIT-MAP A1: the map's edge and the border along a
 * province line were drawn as diagonals). A closed chain (first point
 * repeated last) is cut at that shared corner too, so the loop closes
 * round rather than with a notch.
 */
export function roundCorners(line, maxCut = 1.5) {
  if (line.length < 3) return line.slice();
  const closed = line[0].x === line[line.length - 1].x && line[0].y === line[line.length - 1].y;
  const pts = closed ? line.slice(0, -1) : line;
  const n = pts.length;
  const cut = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const t = len === 0 ? 0 : Math.min(0.25, maxCut / len);
    return [{ x: a.x + dx * t, y: a.y + dy * t }, { x: b.x - dx * t, y: b.y - dy * t }];
  };
  const out = [];
  if (!closed) out.push(pts[0]);
  const first = closed ? 0 : 0, last = closed ? n : n - 1;
  for (let i = first; i < last; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const [p, q] = cut(a, b);
    if (closed || i > 0) out.push(p);
    if (closed || i < n - 2) out.push(q);
  }
  if (!closed) out.push(pts[n - 1]);
  else out.push(out[0]);
  return out;
}

/** A chain softened for the pen: the pixel staircase simplified, then
 *  the bounded corner cut so a coast reads as a shore and not a
 *  sawtooth - and a straight run stays straight. */
export function inkChain(chain, eps = 0.7) {
  return roundCorners(simplifyChain(chain, eps));
}

/** Water, the ONE law: isWaterPixel over the climate and height byte;
 *  -1 (the edge of the data) is not water, it is the edge. */
export function landAt({ heightBytes, width, climateAt }) {
  return (x, y) => {
    const byte = heightBytes[y * width + x] ?? 0;
    const climate = climateAt?.(x, y) ?? CLIMATES.Woodlands;
    return !isWaterPixel(climate, byte);
  };
}

/** The coast: the land set's boundary, softened. */
export function coastChains(ctx) {
  const land = landAt(ctx);
  return linkSegments(boundarySegments(land, ctx.width, ctx.height)).map((c) => inkChain(c));
}

/**
 * The province borders: every edge between two LAND pixels whose region
 * differs. Sea-facing edges are the coast's, not a border's - a region
 * that meets the sea is bounded by the shore, as the province page draws
 * it. `regionAt` answers the region index or -1 where the politic byte
 * names none.
 */
export function borderChains({ width, height, regionAt, isLand }) {
  const segs = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isLand(x, y)) continue;
      const r = regionAt(x, y);
      if (r < 0) continue;
      if (x + 1 < width && isLand(x + 1, y)) {
        const q = regionAt(x + 1, y);
        if (q >= 0 && q !== r) segs.push([x + 1, y, x + 1, y + 1]);
      }
      if (y + 1 < height && isLand(x, y + 1)) {
        const q = regionAt(x, y + 1);
        if (q >= 0 && q !== r) segs.push([x, y + 1, x + 1, y + 1]);
      }
    }
  }
  return linkSegments(segs).map((c) => inkChain(c, 0.9));
}

/**
 * The roads and tracks - ONLY the mod's arrays. The network object the
 * host hands carries `source: 'basic-roads'` when it was read off
 * vendor/roads-hazelnut (world/roadsProducer.js loadModRoads); the
 * port's own generated network carries no such word and is never inked
 * (bible/03-World/Roads.md). Chains are pixel CENTRES, so a road
 * meets a town's mark rather than its corner.
 */
export function roadChains(net, width, height) {
  if (!net || net.source !== 'basic-roads') return { roads: [], tracks: [] };
  const centre = (chain) => chain.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  const soften = (mask) => (mask ? traceChains(mask, width, height).map((c) => roundCorners(simplifyChain(centre(c)))) : []);
  return { roads: soften(net.roads), tracks: soften(net.tracks) };
}

/** Where each province's name sits: the mean of its land pixels. */
export function regionCentroids({ width, height, regionAt, isLand, regionCount }) {
  const sx = new Float64Array(regionCount), sy = new Float64Array(regionCount), n = new Uint32Array(regionCount);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isLand(x, y)) continue;
      const r = regionAt(x, y);
      if (r < 0 || r >= regionCount) continue;
      sx[r] += x + 0.5; sy[r] += y + 0.5; n[r]++;
    }
  }
  const out = [];
  for (let r = 0; r < regionCount; r++) if (n[r] > 0) out.push({ region: r, x: sx[r] / n[r], y: sy[r] / n[r], n: n[r] });
  return out;
}

/** The high ground: every land pixel over the treeline, and whether
 *  it is over the snowline - the painter thins these by band. */
export function highGround({ heightBytes, width, height, isLand }) {
  const out = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const b = heightBytes[y * width + x] ?? 0;
      if (b < TREELINE_BYTE || !isLand(x, y)) continue;
      out.push({ x, y, peak: b >= SNOWLINE_BYTE });
    }
  }
  return out;
}

/**
 * THE MODEL. Pure over the deps; the window caches it per data set and
 * rebuilds only the marks when the filters or the discovery set change.
 *
 * @param {{
 *   width: number, height: number, heightBytes: Uint8Array|number[],
 *   climateAt?: (x: number, y: number) => number,
 *   regionAt?: (x: number, y: number) => number, regionCount?: number,
 *   roads?: any, summaries?: Iterable<any>, filters?: any,
 *   isDiscovered?: (summary: any) => boolean, nameOf?: (summary: any) => string,
 * }} deps
 */
export function buildInkModel(deps) {
  const { width, height, heightBytes } = deps;
  const isLand = landAt({ heightBytes, width, climateAt: deps.climateAt });
  const regionAt = deps.regionAt ?? (() => -1);
  const regionCount = deps.regionCount ?? 0;
  const high = highGround({ heightBytes, width, height, isLand });
  return {
    width, height,
    coast: coastChains({ heightBytes, width, height, climateAt: deps.climateAt }),
    borders: borderChains({ width, height, regionAt, isLand }),
    ...roadChains(deps.roads, width, height),
    regions: regionCentroids({ width, height, regionAt, isLand, regionCount }),
    high,
    // AUDIT-MAP (perf): the carets thinned once per band here, not per
    // paint - the far band iterated a hundred thousand pixels a frame to
    // draw three thousand carets
    highBands: {
      far: high.filter((h) => h.x % CARET_STEP.far === 0 && h.y % CARET_STEP.far === 0),
      mid: high.filter((h) => h.x % CARET_STEP.mid === 0 && h.y % CARET_STEP.mid === 0),
      near: high.filter((h) => h.x % CARET_STEP.near === 0 && h.y % CARET_STEP.near === 0),
    },
    marks: buildInkMarks(deps),
  };
}

/** The marks alone - the classic window's discovery and bucket laws
 *  through buildMarkerModel, each carrying its name and glyph kind.
 *  Rebuilt on its own when a filter or a discovery changes, because
 *  the chains never do. */
/**
 * MAP2: `isPort` says which marks carry a harbour (Travel Options'
 * port list, systems/travelPorts.js hasPort, asked through the window
 * so this module never learns the list); `mapId` is MapSummary.MapID,
 * what the mod's mark and ports laws key on.
 * @param {{ summaries?: Iterable<any>, filters?: any,
 *   isDiscovered?: (summary: any) => boolean, nameOf?: (summary: any) => string,
 *   isPort?: (summary: any) => boolean }} deps
 */
export function buildInkMarks({ summaries = [], filters = {}, isDiscovered = undefined, nameOf = () => '', isPort = () => false }) {
  const opts = isDiscovered ? { isDiscovered } : {};
  return buildMarkerModel(summaries, filters, opts).map((m) => ({
    x: m.x, y: -m.z,             // the pixel's centre, in map pixels (y down)
    colorIndex: m.colorIndex,
    kind: markKind(m.colorIndex),
    name: nameOf(m.summary),
    summary: m.summary,
    mapId: m.summary?.mapID ?? m.summary?.mapId ?? null,
    port: !!isPort(m.summary),
  }));
}

// ── THE VIEW ─────────────────────────────────────────────────────

/** How far in the paper lets you go, in paper pixels per map pixel. */
export const SCALE_MAX = 14;

/**
 * A view is {ox, oy, scale}: the map pixel at the paper's top-left and
 * the paper pixels per map pixel. Clamped so the map never leaves the
 * parchment: an axis the map is smaller than at this scale is CENTRED
 * on the paper, one it is larger than may pan only until the map's
 * edge meets the paper's. `scaleMin` fits the whole sheet (contain).
 */
export function clampView(view, { mapW, mapH, paperW, paperH }) {
  const scaleMin = Math.min(paperW / mapW, paperH / mapH);
  if (!Number.isFinite(view.scale)) view = { ox: 0, oy: 0, scale: scaleMin };   // a total function: a NaN view rests
  // contain wins over the ceiling: a bay smaller than the sheet (a
  // probe's synthetic one) is never let shrink off it
  const scale = Math.max(scaleMin, Math.min(SCALE_MAX, view.scale));
  const axis = (o, map, paper) => {
    const visible = paper / scale;
    if (visible >= map) return (map - visible) / 2;
    return Math.min(map - visible, Math.max(0, o));
  };
  return { ox: axis(view.ox, mapW, paperW), oy: axis(view.oy, mapH, paperH), scale };
}
export function scaleMinOf({ mapW, mapH, paperW, paperH }) {
  return Math.min(paperW / mapW, paperH / mapH);
}
/** The view that centres map pixel (x, y) at `scale`, before clamping. */
export function viewCentredOn(x, y, scale, { paperW, paperH }) {
  return { ox: x - paperW / (2 * scale), oy: y - paperH / (2 * scale), scale };
}
/** Zoom by `factor` keeping the map point under paper point (px, py) still. */
export function zoomAt(view, factor, px, py) {
  const scale = view.scale * factor;
  const mx = view.ox + px / view.scale, my = view.oy + py / view.scale;
  return { ox: mx - px / scale, oy: my - py / scale, scale };
}
export const toPaper = (view, x, y) => [(x - view.ox) * view.scale, (y - view.oy) * view.scale];

// ── EM4: THE TWO THINGS EVERY SHEET DOES THE SAME WAY ──────────────
//
// The dungeon's plan and the town's plan each grew their own caret and
// their own "fit at rest", byte for byte alike, and the one-home gate
// caught both the moment the second sheet landed. They live here, with
// the pen and the view laws, because that is what this module is: the
// things three sheets share.

/** The player's caret, in paper pixels. It does NOT scale with the
 *  zoom - it is a cursor, not a room, and one that shrank with the plan
 *  would vanish at a far zoom. */
export const CARET_R = 8;

/** How much of the fit a sheet rests at: a little in, so the outermost
 *  line is not against the paper's torn edge. */
export const FIT_MARGIN = 0.92;

/**
 * THE CARET, pointing where the player LOOKS. `yaw` is the motor's own,
 * measured from +Z (north) and growing clockwise looking down (forward
 * is [sin yaw, 0, cos yaw]), and every sheet lays +Z UP the paper
 * (DISC8-C), so the heading is (sin yaw, -cos yaw).
 * Haloed then filled, as every mark on every sheet is.
 *
 * @param {*} ctx @param {number} x @param {number} y paper pixels
 * @param {number} yaw radians @param {{fill?:string, halo?:string, haloPen?:number}} [pen]
 */
export function paintCaret(ctx, x, y, yaw = 0, pen = {}) {
  if (!ctx?.beginPath) return;
  const hx = Math.sin(yaw), hy = -Math.cos(yaw);
  const px = -hy, py = hx;
  ctx.fillStyle = pen.fill ?? PEN.player;
  ctx.strokeStyle = pen.halo ?? PEN.halo;
  ctx.lineWidth = pen.haloPen ?? (2 * HALO_PEN);
  ctx.beginPath();
  ctx.moveTo(x + hx * CARET_R, y + hy * CARET_R);
  ctx.lineTo(x + px * CARET_R * 0.55 - hx * CARET_R * 0.6, y + py * CARET_R * 0.55 - hy * CARET_R * 0.6);
  ctx.lineTo(x - hx * CARET_R * 0.25, y - hy * CARET_R * 0.25);
  ctx.lineTo(x - px * CARET_R * 0.55 - hx * CARET_R * 0.6, y - py * CARET_R * 0.55 - hy * CARET_R * 0.6);
  ctx.closePath();
  ctx.stroke();   // the halo first
  ctx.fill();
}

/** DISC23-A: a party member's label sits this far under the member's caret, and two members standing on one spot
 *  have their names this near before the second drops a line (AUDIT SOC D2's stack, on a plan). */
export const PARTY_CARET_LABEL_GAP = 3;
export const PARTY_CARET_STACK_PX = 10;

/**
 * DISC23-A: THE PARTY ON A PLAN - each member a caret of the player's own shape, facing where they face, in the party's
 * green, with the name under it haloed as every name on every sheet is. The caret, not the bay's ring: on a street or a
 * storey a member is a body with a heading, the thing the player's own caret is, and a friend walking toward you reads
 * as one. Drawn BEFORE the player's caret, so the player is never under a friend.
 *
 * `marks` are in PAPER pixels already; `pen` carries the green (ui/partyMapMarks.js PARTY_MARK_CSS, handed in by the
 * sheet so this module keeps no online import) and the sheet's halo.
 * @param {*} ctx
 * @param {Array<{x:number, y:number, yaw?:number, name?:string}>} marks
 * @param {{fill:string, halo:string}} pen
 */
export function paintPartyCarets(ctx, marks, pen) {
  if (!ctx?.beginPath || !marks?.length) return;
  const placed = [];
  for (const m of marks) {
    paintCaret(ctx, m.x, m.y, m.yaw ?? 0, { fill: pen.fill, halo: pen.halo });
    // the i-th member standing where another already is drops a line, so two names never print over each other
    const stack = placed.filter((q) => Math.abs(q.x - m.x) < PARTY_CARET_STACK_PX && Math.abs(q.y - m.y) < PARTY_CARET_STACK_PX).length;
    placed.push(m);
    if (!m.name) continue;
    const ly = m.y + CARET_R + PARTY_CARET_LABEL_GAP + stack * PARTY_LABEL_STACK;
    ctx.font = `600 12px ${NAME_FACE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 2 * HALO_PEN;
    ctx.strokeStyle = pen.halo;
    ctx.strokeText(m.name, m.x, ly);
    ctx.fillStyle = pen.fill;
    ctx.fillText(m.name, m.x, ly);
  }
}

/**
 * WHERE A SHEET RESTS: the whole plan on the paper, centred on `focus`
 * where there is one and left to the window's own clamp where there is
 * not. A map that opens on the far corner is a map the player has to
 * pan before it says anything.
 *
 * @param {{mapW:number,mapH:number,paperW:number,paperH:number}} limits
 * @param {{x:number,y:number}|null} [focus]
 */
export function fitView(limits, focus = null) {
  const min = scaleMinOf(limits);
  if (!focus) return { ox: 0, oy: 0, scale: min };
  return viewCentredOn(focus.x, focus.y, min / FIT_MARGIN, limits);
}
export const toMap = (view, px, py) => [view.ox + px / view.scale, view.oy + py / view.scale];

// ── THE NAMES ────────────────────────────────────────────────────

/** The face a mark's name is set in - ONE string for the measure and the
 *  paint, so a city's bold name is measured as wide as it draws. */
export function nameFont(mark, size) {
  return `${mark.kind === 'city' ? '600 ' : ''}${size}px ${NAME_FACE}`;
}

/** The rectangle a name's INK occupies, from the baseline the painter
 *  will pass to `fillText`. ONE formula, used to reserve the room and
 *  returned on the placement, so the box that was reserved is the box a
 *  reader can test against.
 *
 *  `ASC`/`DESC` are the display face's ink above and below the baseline
 *  as a fraction of the em. They are a measurement of a Garamond cut
 *  rather than of this exact font at this exact size - a canvas can
 *  answer that and node cannot - so they are rounded OUTWARD: a box a
 *  shade too tall drops a label that would have just fitted, where one
 *  a shade too short lets a descender sit on the next name. */
export const NAME_ASC = 0.78;
export const NAME_DESC = 0.28;
export function nameBox(x, baseline, w, size) {
  return { x, y: baseline - (size * NAME_ASC), w, h: size * (NAME_ASC + NAME_DESC) };
}

/**
 * Where the names go, and which ones fit. Greedy in NAME_RANK order: a
 * name that would overlap one already placed is dropped, so a crowded
 * coast keeps its cities legible instead of smearing every hamlet over
 * them. Pure: `measure(text, size)` answers a width so node can drive
 * it with a stub.
 *
 * MAP-FIELD6: a name is kept clear of every GLYPH the band inks, not
 * only of other names. This was the readability fault Mac could see
 * rather than the one he could name: a label was free to land squarely
 * on the next town's mark, so "Proofhold" ran through the ring of the
 * city beside it and a cluster of hamlets sat on top of its own label.
 * The glyph boxes are seeded into the same greedy test the names use,
 * which means a name that has nowhere clear to go is DROPPED - the mark
 * itself is still there to hover, and one unreadable label is worth
 * less than the mark it was covering.
 */
export function placeNames(marks, view, band, { paperW, paperH, measure }) {
  const named = BAND_NAMES[band] ?? BAND_NAMES.near;
  const shown = BAND_MARKS[band] ?? BAND_MARKS.near;
  const rank = new Map(NAME_RANK.map((c, i) => [c, i]));
  const size = band === 'near' ? 14 : 13;
  const out = [];
  const boxes = [];
  // AUDIT-MAP2: culled to the sheet BEFORE the sort - at the near band
  // every named mark in the bay qualified, and the whole set was sorted
  // per pan frame to place the dozen on the paper
  const onSheet = (m) => { const [px, py] = toPaper(view, m.x, m.y); return !(px < -40 || py < -20 || px > paperW + 40 || py > paperH + 20); };
  const sorted = marks.filter((m) => m.name && named.has(m.colorIndex) && onSheet(m))
    .sort((a, b) => (rank.get(a.colorIndex) ?? 99) - (rank.get(b.colorIndex) ?? 99));
  // the ground the glyphs already hold - seeded BEFORE any name is
  // placed, so the first name is as bound by them as the last
  for (const m of marks) {
    if (!shown.has(m.colorIndex) || !onSheet(m)) continue;
    const [px, py] = toPaper(view, m.x, m.y);
    const r = (GLYPH_R[m.kind] ?? 4) + 1;
    boxes.push({ x: px - r, y: py - r, w: r * 2, h: r * 2 });
  }
  const hits = (box) => boxes.some((b) => b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y);
  for (const m of sorted) {
    const [px, py] = toPaper(view, m.x, m.y);
    const measured = measure(m.name, size, nameFont(m, size));
    const w = Number.isFinite(measured) ? measured : 0;   // a stub's NaN would let every name overlap
    const glyph = (GLYPH_R[m.kind] ?? 4) + 1;
    // MAP-FIELD6: FOUR PLACES TO TRY, not one. Seeding the glyphs into
    // the test (above) is what stops a label landing on a mark, but with
    // a single candidate it also silenced the two names that most needed
    // saying - a city whose label reached over its neighbour's ring was
    // simply dropped. A label has somewhere else to go, and the sheet
    // reads better for a name set to the left or under its town than for
    // no name at all. Right first, because that is where the eye looks
    // for it and where every label sat before this.
    //
    // AUDIT MAP-FIELD: each candidate names only its BASELINE, and the
    // box is derived from that baseline by `nameBox` - one formula. The
    // first draft gave every candidate its own `y` as well, three
    // different offsets from three different baselines, and then threw
    // the `y` away on the way out: no consumer could rebuild the
    // rectangle that had been reserved, and the pin invented a fourth
    // that matched none of them. The box is RETURNED now.
    const cands = [
      { x: px + glyph + 3, base: py + size * 0.35 },
      { x: px - glyph - 3 - w, base: py + size * 0.35 },
      { x: px - w * 0.5, base: py - glyph - 5 },
      { x: px - w * 0.5, base: py + glyph + 2 + size * 0.85 },
    ];
    // AUDIT MAP-FIELD: BOUNDED ON BOTH AXES. The first draft bounded x
    // alone, so the above/below candidates could place a label wholly
    // off the top or bottom of the sheet - painted where nobody can see
    // it AND holding a box that then blocked a neighbour that could
    // have been drawn. That is strictly worse than the drop the design
    // intends, and it was a fault this commit introduced: the single
    // candidate it replaced always sat at the mark's own height.
    const fit = cands.map((c) => ({ ...c, box: nameBox(c.x, c.base, w, size) }))
      .find((c) => c.box.x >= 2 && c.box.x + c.box.w <= paperW - 2
        && c.box.y >= 2 && c.box.y + c.box.h <= paperH - 2 && !hits(c.box));
    if (!fit) continue;
    boxes.push(fit.box);
    out.push({ mark: m, x: fit.x, y: fit.base, size, w, box: fit.box });
  }
  return out;
}

// ── THE PAINT ────────────────────────────────────────────────────

/**
 * Draw the model into a 2D context, in paper pixels. Clears first: the
 * paper beneath the canvas is the sprite's own, so a cleared canvas IS
 * blank parchment. `dpr` scales the backing store; every width below
 * is in paper pixels.
 *
 * @param {CanvasRenderingContext2D|any} ctx
 * @param {ReturnType<typeof buildInkModel>} model
 * @param {{ox: number, oy: number, scale: number}} view
 * @param {{ paperW: number, paperH: number, dpr?: number, band?: string,
 *   filters?: any, player?: {x: number, y: number}|null,
 *   selected?: {x: number, y: number, coords?: boolean}|null,
 *   party?: {x: number, y: number, name: string, online: boolean, stack: number, color: string}[],
 *   regionNames?: string[], names?: ReturnType<typeof placeNames>, pulse?: number,
 *   ports?: boolean, markedMapId?: number, markColor?: string|null }} opts
 */
export function paintInk(ctx, model, view, opts) {
  paintInkStatic(ctx, model, view, opts);
  paintInkOverlay(ctx, view, { ...opts, clear: false });
}

/** The visible test and the chain stroke, shared by the two halves. */
function penOf(ctx, view, paperW, paperH) {
  const s = view.scale;
  const visible = (x, y, pad = 2) => x >= view.ox - pad && y >= view.oy - pad
    && x <= view.ox + paperW / s + pad && y <= view.oy + paperH / s + pad;
  const stroke = (chains, width, style, dash = null) => {
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    for (const c of chains) {
      // AUDIT-MAP A5: culled per SEGMENT, not per point - a point is
      // drawn when it or a neighbour is on the sheet, so a long straight
      // run whose ends are both off the paper still crosses it, and a
      // chain leaving the view runs to the paper's edge instead of
      // lifting the pen at its last visible vertex
      let on = false;
      for (let i = 0; i < c.length; i++) {
        const p = c[i];
        const draw = visible(p.x, p.y, 8)
          || (i > 0 && meets(view, paperW, paperH, c[i - 1], p))
          || (i + 1 < c.length && meets(view, paperW, paperH, p, c[i + 1]));
        if (!draw) { on = false; continue; }
        const [x, y] = toPaper(view, p.x, p.y);
        if (!on) { ctx.moveTo(x, y); on = true; } else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  return { visible, stroke };
}
/** Whether the segment a-b might cross the sheet: its bounding box meets
 *  the padded view (the canvas clips the rest). */
function meets(view, paperW, paperH, a, b) {
  const x0 = view.ox - 8, y0 = view.oy - 8, x1 = view.ox + paperW / view.scale + 8, y1 = view.oy + paperH / view.scale + 8;
  return Math.max(a.x, b.x) >= x0 && Math.min(a.x, b.x) <= x1 && Math.max(a.y, b.y) >= y0 && Math.min(a.y, b.y) <= y1;
}

/**
 * THE STATIC INK: everything that changes only with the view, the band,
 * the marks or the mod's state - the window paints it once per such
 * change onto a kept layer, and the overlay below over it per pulse.
 */
export function paintInkStatic(ctx, model, view, opts) {
  const { paperW, paperH, dpr = 1 } = opts;
  const band = opts.band ?? zoomBand(view.scale);
  const s = view.scale;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, paperW, paperH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const { visible, stroke } = penOf(ctx, view, paperW, paperH);

  // the shore: a soft shade under a firm line
  stroke(model.coast, Math.max(3, s * 1.6), PEN.wash);
  stroke(model.coast, 1.3, PEN.line);
  // the high ground: carets, thinned by band (once, at build).
  // MAP-FIELD6: in PEN.relief, not PEN.soft - a hatch this dense at the
  // pen's own weight reads as ink competing with the marks, and it is
  // the one thing on the sheet that is meant to be felt, not read.
  ctx.strokeStyle = PEN.relief;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const caret = Math.max(2.5, Math.min(7, s * 0.9));
  const step = CARET_STEP[band] ?? 3;
  const carets = model.highBands?.[band] ?? model.high.filter((h) => h.x % step === 0 && h.y % step === 0);
  for (const h of carets) {
    if (!visible(h.x, h.y)) continue;
    const [x, y] = toPaper(view, h.x + 0.5, h.y + 0.5);
    const k = h.peak ? caret * 1.3 : caret;
    ctx.moveTo(x - k, y + k * 0.6); ctx.lineTo(x, y - k * 0.6); ctx.lineTo(x + k, y + k * 0.6);
  }
  ctx.stroke();
  // the provinces
  stroke(model.borders, 1, PEN.soft, [4, 3]);
  // the roads and the tracks
  if (!opts.filters?.roads) stroke(model.roads, band === 'far' ? 1 : 1.5, PEN.line);
  if (band !== 'far' && !opts.filters?.tracks) stroke(model.tracks, 1, PEN.soft, [2, 3]);

  // the marks - and MAP2's harbour glyph beside a port's, while the mod
  // restricts ship travel to ports (the classic page's ports button
  // shows under the same condition, TravelOptionsMapWindow.cs:148)
  const shown = BAND_MARKS[band] ?? BAND_MARKS.near;
  // MAP-FIELD6: EVERY halo first, then every glyph. One pass per mark
  // would let a neighbour's halo fall on the ink already laid down, so
  // a crowded coast would come out with bites taken out of it - which
  // is worse than the tangle the halo is here to fix.
  const inked = [];
  for (const m of model.marks) {
    if (!shown.has(m.colorIndex) || !visible(m.x, m.y)) continue;
    inked.push([m, ...toPaper(view, m.x, m.y)]);
  }
  for (const [m, x, y] of inked) paintGlyph(ctx, m.kind, x, y, true);
  for (const [m, x, y] of inked) {
    paintGlyph(ctx, m.kind, x, y);
    if (opts.ports && m.port && band !== 'far') paintHarbour(ctx, x, y);
  }
  // MAP2: the mod's MARK (TravelOptionsMapWindow.cs:532-550, drawn in
  // MarkLocationColor) - a ring on the marked place at EVERY band, whether
  // or not the band inks the place itself: the mark is the thing the
  // player put there to steer by.
  if (opts.markColor && opts.markedMapId != null && opts.markedMapId >= 0) {
    for (const m of model.marks) {
      if (m.mapId !== opts.markedMapId || !visible(m.x, m.y)) continue;
      const [x, y] = toPaper(view, m.x, m.y);
      ctx.strokeStyle = opts.markColor; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // the names - MAP-FIELD6: haloed the same way, and for the same
  // reason. A name set in a light serif over the sheet's own cracks was
  // the least readable thing on the page.
  if (opts.names) {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PEN.halo;
    ctx.lineWidth = 2 * HALO_PEN;   // strokeText is centred on the glyph too
    for (const n of opts.names) {
      ctx.font = nameFont(n.mark, n.size);
      ctx.strokeText(n.mark.name, n.x, n.y);
    }
    ctx.fillStyle = PEN.name;
    for (const n of opts.names) {
      ctx.font = nameFont(n.mark, n.size);
      ctx.fillText(n.mark.name, n.x, n.y);
    }
  }
  // the provinces' names, far and mid
  if (band !== 'near' && opts.regionNames) {
    ctx.fillStyle = PEN.region;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `300 ${band === 'far' ? 15 : 19}px ${NAME_FACE}`;
    for (const r of model.regions) {
      const name = opts.regionNames[r.region];
      if (!name || !visible(r.x, r.y, 30)) continue;
      const [x, y] = toPaper(view, r.x, r.y);
      ctx.fillText(name.toUpperCase().split('').join(' '), x, y);
    }
  }
}

/**
 * THE OVERLAY: the party, the selection and the player - the marks that
 * breathe or move without the sheet changing under them. `clear` false
 * draws over whatever the context holds (the static layer just copied
 * in); true clears first (a stub driving the overlay alone).
 */
export function paintInkOverlay(ctx, view, opts) {
  const { paperW, paperH, dpr = 1 } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opts.clear) ctx.clearRect(0, 0, paperW, paperH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const { visible } = penOf(ctx, view, paperW, paperH);
  const pulse = opts.pulse ?? 0;
  for (const m of opts.party ?? []) {
    if (!visible(m.x, m.y)) continue;
    const [x, y] = toPaper(view, m.x, m.y);
    ctx.strokeStyle = m.color; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, 7 + pulse * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = m.color;
    ctx.font = `600 12px ${NAME_FACE}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    // AUDIT SOC D2: the i-th member on a shared pixel drops i labels down
    ctx.fillText(m.name, x, y + 9 + (m.stack ?? 0) * PARTY_LABEL_STACK);
  }
  if (opts.selected) {
    const [x, y] = toPaper(view, opts.selected.x, opts.selected.y);
    if (opts.selected.coords) {
      // MAP2: a bare pixel chosen as a destination - a cross where no
      // mark is, since there is no place to ring
      ctx.strokeStyle = PEN.coords; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6);
      ctx.stroke();
    }
    ctx.strokeStyle = PEN.select; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 10 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
  }
  if (opts.player) {
    const [x, y] = toPaper(view, opts.player.x + 0.5, opts.player.y + 0.5);
    ctx.strokeStyle = PEN.player; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.stroke();
  }
}
/** The stack of party labels on ONE pixel: each member's name this
 *  much further down than the last (AUDIT SOC D2's law, on ink). */
export const PARTY_LABEL_STACK = 13;

/** MAP2: the harbour glyph - a small anchor beside a port's mark. Skin. */
export function paintHarbour(ctx, x, y) {
  const ax = x + 8, ay = y - 1;
  ctx.strokeStyle = PEN.soft; ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 4); ctx.lineTo(ax, ay + 3);        // the shank
  ctx.moveTo(ax - 2.5, ay - 2); ctx.lineTo(ax + 2.5, ay - 2);   // the stock
  // the flukes: a fresh subpath, or the canvas joins the stock's end to
  // the arc's start with a stray diagonal (AUDIT-MAP A6)
  ctx.moveTo(ax + 3 * Math.cos(Math.PI * 0.15), ay + 0.5 + 3 * Math.sin(Math.PI * 0.15));
  ctx.arc(ax, ay + 0.5, 3, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

/** One glyph per kind, at paper (x, y). Skin.
 *
 *  MAP-FIELD6: `halo` true draws the SAME shape in the parchment-light
 *  halo, fattened, so a later ink pass lands on quiet paper instead of
 *  on the sheet's own cracks. The filled kinds are stroked as well as
 *  filled on that pass, or their halo would sit inside them and show
 *  nothing. Both passes are driven from this one switch, so a glyph
 *  cannot be drawn in ink in a shape its halo did not clear. */
export function paintGlyph(ctx, kind, x, y, halo = false) {
  ctx.strokeStyle = halo ? PEN.halo : PEN.line;
  ctx.fillStyle = halo ? PEN.halo : PEN.line;
  ctx.lineWidth = halo ? GLYPH_PEN + (2 * HALO_PEN) : GLYPH_PEN;
  const solid = () => { ctx.fill(); if (halo) ctx.stroke(); };
  ctx.beginPath();
  switch (kind) {
    case 'city':
      ctx.arc(x, y, 3.2, 0, Math.PI * 2); solid();
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      return;
    case 'hamlet': ctx.arc(x, y, 3, 0, Math.PI * 2); solid(); return;
    case 'village': ctx.arc(x, y, 2.2, 0, Math.PI * 2); solid(); return;
    case 'temple':
      ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 4); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x + 3, y - 2); ctx.stroke(); return;
    case 'cult':
      ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.stroke(); return;
    case 'dungeon':
      ctx.moveTo(x, y - 4.5); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.closePath(); ctx.stroke(); return;
    case 'graveyard':
      ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke(); return;
    case 'coven':
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * 4 * Math.PI / 5;
        const px = x + Math.cos(a) * 4.5, py = y + Math.sin(a) * 4.5;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke(); return;
    case 'tavern':
      ctx.rect(x - 2.5, y - 2.5, 5, 5); solid(); return;
    default:   // home
      ctx.rect(x - 2.5, y - 2.5, 5, 5); ctx.stroke();
  }
}
