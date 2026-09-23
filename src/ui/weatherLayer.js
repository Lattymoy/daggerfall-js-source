// @ts-check
// WEATHER3 slice E (2026-09-22, Mac: "imagine a map, one location its
// sunny, one is cloudy, one has a rainstorm, etc"): THE WEATHER ON THE
// MAP. The enhanced travel map (ui/heldMap.js's world sheet) draws the
// world weather map (systems/weatherMap.js) over the bay as REGIONS - the
// worn word read off the law at every cell of the bay, each word's land
// outlined and lightly hatched (WEATHER3h; it was a soft wash per system,
// which read as blots), a small pen glyph at the heart of the wet ones -
// so the map IS the picture Mac drew: sunny here, cloud there, a
// rainstorm over the hills - each word through the ground law where it
// stands, so a winter storm is drawn as the snow it falls as. The hover
// names the weather at the place under the pointer and its FORECAST, read
// off the same pure law a few hours on ("Rain, heavy - clearing in about
// 3 hours").
//
// In the sheet's own hand: the regions lie UNDER the pen's lines, the
// glyphs are the pen, and every pigment leans a little toward the pen's
// brown (inkMap's INK_RGB) - the map reads as one drawing with the
// weather painted onto it, not a radar picture laid over it. WEATHER3g
// (Mac: "this needs more clarity"): each weather its OWN colour - rain
// blue, a storm violet, snow white, a deck slate, cloud pale grey, fog a
// white haze, sand ochre - leaning only a little toward the pen, since a
// third of the way made them one grey-blue; and a legend on the sheet.
// The classic travel map is DFU's and draws none. Pure but for the
// canvas it paints on.

import { TERRAIN_SIZE } from '../world/terrainSampler.js';
import { MAX_MAP_PIXEL_Y } from '../formats/mapsFile.js';
import { INK_RGB, PEN, NAME_FACE, mixRgb, rgba, toPaper, roundCorners } from './inkMap.js';
import { PRIORITY, wornAmong, shapeBound, shapeFactor } from '../systems/weatherMap.js';

/** How long the map's picture of the weather stands before it is read
 *  again, in game minutes - a system drifts a quarter of a map pixel in
 *  that time, so a finer refresh changes nothing the eye can see. */
export const WEATHER_LAYER_REFRESH_MINUTES = 10;
/** How far ahead the hover's forecast reads. */
export const WEATHER_FORECAST_HOURS = 12;

/** The pigment of each weather - one colour each, told apart at a
 *  glance - and how far it leans toward the pen's brown. */
const PIGMENT = Object.freeze({
  cloudy: [150, 160, 172], overcast: [84, 94, 112], fog: [228, 228, 224], rain: [40, 96, 184],
  thunder: [104, 40, 150], snow: [190, 220, 255], sandstorm: [206, 132, 36],
});
export const INK_LEAN = 0.12;
export const WEATHER_INK = Object.freeze(Object.fromEntries(Object.entries(PIGMENT).map(([w, rgb]) => [w, Object.freeze(mixRgb(rgb, INK_RGB, INK_LEAN))])));
/** The legend's rows, the heaviest weather first; clear air is the bare paper. */
export const LEGEND_ROWS = Object.freeze(['thunder', 'rain', 'snow', 'sandstorm', 'fog', 'overcast', 'cloudy', 'sunny']);

/** A heart is signed with its glyph once the storm is this far into its
 *  strength and its heart this many paper pixels across. */
export const GLYPH_MIN_ENV = 0.6;
export const GLYPH_MIN_PX = 12;
/** Fog's glyph waits for a bigger heart: a fog bank is wide and quiet, and
 *  its lines on every bank at the far view were clutter; a storm cell's
 *  too, so a front is signed by its widest cells, not every one. */
export const FOG_GLYPH_MIN_PX = 28;
export const CELL_GLYPH_MIN_PX = 24;

/** The words a player reads. */
export const WEATHER_NAMES = Object.freeze({
  sunny: 'Clear skies', cloudy: 'Cloudy', overcast: 'Overcast', fog: 'Fog', rain: 'Rain', thunder: 'Thunderstorm', snow: 'Snow', sandstorm: 'Sandstorm',
});
const PRECIPITATING = new Set(['rain', 'thunder', 'snow', 'sandstorm']);

/** A field position (metres) to the map's pixel frame (x east, y south),
 *  continuous: the pixel under it is the floor. */
export const mapOfField = (x, z) => [x / TERRAIN_SIZE, MAX_MAP_PIXEL_Y - z / TERRAIN_SIZE];
/** ...and a map pixel's centre back to field metres. */
export const fieldOfMapPixel = (px, py) => [(px + 0.5) * TERRAIN_SIZE, (MAX_MAP_PIXEL_Y - (py + 0.5)) * TERRAIN_SIZE];

/**
 * The map's marks for the systems standing now: each `{ id, type, x, y,
 * env, bands: [[r, word], ...], reach, clip }` in map pixels, its bands core out
 * (`reach` its shaped outline's furthest, WEATHER3h)
 * and `clip` a storm cell's [x, y, r] (its front's core, the only place it
 * paints; null for any other) - sorted so the wash is laid lowest
 * priority first and the storm's heart is inked last, as the sky blends
 * them (WEATHER3c). `ground(word, x, z)` (optional) is the ground law at
 * the system (weatherSim mapGround): the map inks what falls there, as
 * the sky and the player get it.
 */
export function weatherMarks(systems, ground = null) {
  const g = (w, s) => (ground ? ground(w, s.x, s.z) : w);
  return systems.map((s) => {
    const [x, y] = mapOfField(s.x, s.z);
    const clip = s.clip ? [...mapOfField(s.clip[0], s.clip[1]), s.clip[2] / TERRAIN_SIZE, s.clip[3] ?? null] : null;
    return { id: s.id, type: g(s.type, s), x, y, env: s.env, bands: s.bands.map(([r, word]) => [r / TERRAIN_SIZE, g(word, s)]), reach: (s.reach ?? s.r) / TERRAIN_SIZE, clip };
  }).sort((a, b) => PRIORITY.indexOf(b.type) - PRIORITY.indexOf(a.type));
}

/** The glyph at a wet or fogbound system's heart, in the pen: rain's slant
 *  strokes, the storm's bolt, snow's star, the sand's drift, fog's level
 *  lines. `s` its size. */
function glyph(ctx, type, x, y, s) {
  ctx.strokeStyle = PEN.soft; ctx.lineWidth = Math.max(1, s / 7);
  ctx.beginPath();
  if (type === 'rain') {
    for (const dx of [-s / 3, 0, s / 3]) { ctx.moveTo(x + dx + s / 6, y - s / 3); ctx.lineTo(x + dx - s / 6, y + s / 3); }
  } else if (type === 'thunder') {
    ctx.moveTo(x + s / 5, y - s / 2); ctx.lineTo(x - s / 6, y + s / 12); ctx.lineTo(x + s / 6, y + s / 12); ctx.lineTo(x - s / 5, y + s / 2);
  } else if (type === 'snow') {
    for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; ctx.moveTo(x - Math.cos(a) * s / 2.4, y - Math.sin(a) * s / 2.4); ctx.lineTo(x + Math.cos(a) * s / 2.4, y + Math.sin(a) * s / 2.4); }
  } else if (type === 'sandstorm') {
    for (const dy of [-s / 4, s / 4]) { ctx.moveTo(x - s / 2, y + dy); ctx.quadraticCurveTo(x, y + dy - s / 4, x + s / 2, y + dy); }
  } else if (type === 'fog') {
    for (const dy of [-s / 4, 0, s / 4]) { ctx.moveTo(x - s / 2, y + dy); ctx.lineTo(x + s / 2, y + dy); }
  }
  ctx.stroke();
}

/**
 * THE PEN'S SIGNS (WEATHER3h: the regions are the weather's body; the
 * marks only sign it): a wet or fogbound system's heart carries its glyph
 * once the storm has come into its own and its heart is big enough on the
 * paper to hold one - a storm cell's only where it paints (inside its
 * front, by the front's own shape) and only when it is wide on the paper,
 * so a front is signed, not peppered. `bounds` [w, h] (map pixels) keeps
 * the glyphs to the map: a system off its edge is not signed on the margin.
 */
export function paintWeatherGlyphs(ctx, view, marks, { paperW, paperH, dpr = 1, bounds = null }) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = view.scale;
  for (const m of marks) {
    if (!(PRECIPITATING.has(m.type) || m.type === 'fog') || m.env < GLYPH_MIN_ENV) continue;
    const [cx, cy] = toPaper(view, m.x, m.y);
    const core = m.bands[0][0] * s;
    if (cx + core < 0 || cy + core < 0 || cx - core > paperW || cy - core > paperH) continue;
    const minPx = m.type === 'fog' ? FOG_GLYPH_MIN_PX : m.clip ? CELL_GLYPH_MIN_PX : GLYPH_MIN_PX;
    if (core < minPx) continue;
    if (bounds && !(m.x >= 0 && m.y >= 0 && m.x < bounds[0] && m.y < bounds[1])) continue;
    // map y runs south, the field's z north: the shape is read on the field's bearing
    if (m.clip && Math.hypot(m.x - m.clip[0], m.y - m.clip[1]) / shapeFactor(m.clip[3], m.x - m.clip[0], m.clip[1] - m.y) >= m.clip[2]) continue;
    glyph(ctx, m.type, cx, cy, Math.min(18, core * 0.8));
  }
}

/** The legend's box: its paper-pixel inset from the sheet's top-right corner, and a row's height. */
export const LEGEND_INSET = 16;
export const LEGEND_ROW_PX = 17;
/**
 * THE LEGEND (WEATHER3g): each weather's swatch and name in the pen, in
 * the sheet's top-right corner (the hands hold its lower edge), on a
 * quieted patch of parchment so it reads over any weather. Answers the
 * box it took, [x, y, w, h] in paper pixels.
 */
export function paintWeatherLegend(ctx, { paperW, dpr = 1 }) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = `600 12px ${NAME_FACE}`;
  const sw = 16, gap = 7, pad = 8;
  const textW = Math.max(...LEGEND_ROWS.map((w) => ctx.measureText?.(WEATHER_NAMES[w])?.width ?? WEATHER_NAMES[w].length * 6.5));
  const w = pad * 2 + sw + gap + textW, h = pad * 2 + LEGEND_ROWS.length * LEGEND_ROW_PX;
  const x = paperW - LEGEND_INSET - w, y = LEGEND_INSET;
  ctx.fillStyle = PEN.halo; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PEN.soft; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  LEGEND_ROWS.forEach((word, i) => {
    const ry = y + pad + i * LEGEND_ROW_PX, cy = ry + LEGEND_ROW_PX / 2;
    // the swatch is the region as the map draws it: the word's hatch, outlined in its ink
    if (WEATHER_INK[word]) { ctx.fillStyle = hatchPattern(ctx, word) ?? rgba(WEATHER_INK[word], HATCH[word].tint); ctx.fillRect(x + pad, cy - 5, sw, 10); }
    ctx.strokeStyle = WEATHER_INK[word] ? outlineInk(word) : PEN.soft; ctx.lineWidth = 1; ctx.strokeRect(x + pad + 0.5, cy - 4.5, sw - 1, 9);
    ctx.fillStyle = PEN.name; ctx.fillText(WEATHER_NAMES[word], x + pad + sw + gap, cy);
  });
  return [x, y, w, h];
}

/** The weather in words: the name, and for what falls how hard. */
export function weatherPhrase(word, intensity = 0) {
  const name = WEATHER_NAMES[word] ?? word;
  if (!PRECIPITATING.has(word)) return name;
  return intensity >= 0.7 ? `${name}, heavy` : intensity < 0.35 ? `${name}, light` : name;
}

/**
 * THE FORECAST IN WORDS (weatherMap.js forecastAt's answer): the weather
 * now, and when it next changes and to what - "Rain, heavy - clearing in
 * about 3 hours", "Clear skies - rain in under an hour", "Overcast - no
 * change for the next 12 hours".
 */
export function forecastText(forecast, hours = WEATHER_FORECAST_HOURS) {
  const now = weatherPhrase(forecast.now.word, forecast.now.intensity);
  if (!forecast.next) return `${now} - no change for the next ${hours} hours`;
  const mins = forecast.next.at - forecast.at;
  const h = Math.round(mins / 60);
  const when = mins < 60 ? 'in under an hour' : h === 1 ? 'in about an hour' : `in about ${h} hours`;
  const what = forecast.next.word === 'sunny' ? 'clearing' : (WEATHER_NAMES[forecast.next.word] ?? forecast.next.word).toLowerCase();
  return `${now} - ${what} ${when}`;
}

// ---- WEATHER3h: THE WEATHER AS REGIONS, DRAWN (Mac: "they look too much like blobs and blots") ----
//
// A soft radial wash per system is an ink blot, whatever its colour: every storm a round smudge. A drawn weather
// chart instead shows REGIONS - the land under the rain, the land under the deck - each with a pen outline and a
// hatch of its own. The region is read off the LAW itself: the worn word (weatherMap wornAmong, the ground law
// through it) at every cell of a grid over the bay, so the map and the hover and the player standing there are one
// answer. Each word's cells are traced into closed loops (a directed boundary walk, inside on one hand), the pixel
// staircase rounded off in the coast's own hand (inkMap roundCorners), and the loops filled with the word's hatch
// and outlined in its ink - under the pen already on the sheet.

/** Map pixels a field cell: the bay is read at 500 x 250 cells, a cell 1.6 km. */
export const FIELD_CELL = 2;
/** The words a field cell holds, by index: 0 is clear air. */
export const FIELD_WORDS = Object.freeze(['sunny', ...PRIORITY]);
const WORD_AT = Object.freeze(Object.fromEntries(FIELD_WORDS.map((w, i) => [w, i])));
const BUCKET = 16;   // cells a side of the search buckets

/**
 * THE FIELD: the worn word at the centre of every FIELD_CELL cell of a
 * `width` x `height` map-pixel sheet, from the systems standing now
 * (field metres, as systemsNear gives them) - `{ cols, rows, cell, words }`,
 * `words` a Uint8Array of FIELD_WORDS indices, row-major from the sheet's
 * top. `ground(word, x, z)` is the ground law (weatherSim mapGround at
 * the minute). Pure.
 */
export function weatherField(systems, { width, height, cell = FIELD_CELL, ground = null }) {
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell);
  const bc = Math.ceil(cols / BUCKET), br = Math.ceil(rows / BUCKET);
  const buckets = Array.from({ length: bc * br }, () => []);
  const span = BUCKET * cell;
  for (const s of systems) {
    const [mx, my] = mapOfField(s.x, s.z), rp = (s.reach ?? s.r * shapeBound(s.shape)) / TERRAIN_SIZE;   // WEATHER3h: its shape's reach
    const x0 = Math.max(0, Math.floor((mx - rp) / span)), x1 = Math.min(bc - 1, Math.floor((mx + rp) / span));
    const y0 = Math.max(0, Math.floor((my - rp) / span)), y1 = Math.min(br - 1, Math.floor((my + rp) / span));
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) buckets[by * bc + bx].push(s);
  }
  const words = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const list = buckets[Math.floor(gy / BUCKET) * bc + Math.floor(gx / BUCKET)];
      if (!list.length) continue;
      const mx = (gx + 0.5) * cell, my = (gy + 0.5) * cell;
      const x = mx * TERRAIN_SIZE, z = (MAX_MAP_PIXEL_Y - my) * TERRAIN_SIZE;   // mapOfField's inverse, continuous
      words[gy * cols + gx] = WORD_AT[wornAmong(list, x, z, ground).word] ?? 0;
    }
  }
  return { cols, rows, cell, words };
}

/**
 * The boundary loops of the cells where `inside(gx, gy)` holds, in cell
 * corners: every boundary edge directed with the inside on its left, and
 * linked end to start, so every loop closes and the outer shores run one
 * way round and the holes the other (a nonzero fill is the region, holes
 * and all). Each loop comes back with its first point repeated last.
 */
export function traceLoops(inside, cols, rows) {
  const out = new Map();   // start vertex -> edges starting there
  const edges = [];
  const add = (ax, ay, bx, by) => {
    const e = { ax, ay, bx, by, used: false };
    edges.push(e);
    const k = ay * (cols + 1) + ax;
    const l = out.get(k);
    if (l) l.push(e); else out.set(k, [e]);
  };
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (!inside(gx, gy)) continue;
      if (gy === 0 || !inside(gx, gy - 1)) add(gx + 1, gy, gx, gy);
      if (gx === 0 || !inside(gx - 1, gy)) add(gx, gy, gx, gy + 1);
      if (gy === rows - 1 || !inside(gx, gy + 1)) add(gx, gy + 1, gx + 1, gy + 1);
      if (gx === cols - 1 || !inside(gx + 1, gy)) add(gx + 1, gy + 1, gx + 1, gy);
    }
  }
  const loops = [];
  for (const e0 of edges) {
    if (e0.used) continue;
    const loop = [{ x: e0.ax, y: e0.ay }];
    let e = e0;
    while (e && !e.used) {
      e.used = true;
      loop.push({ x: e.bx, y: e.by });
      e = (out.get(e.by * (cols + 1) + e.bx) ?? []).find((n) => !n.used);
    }
    loops.push(loop);
  }
  return loops;
}

/** A loop's straight runs as single legs (the pixel staircase's corners kept, its collinear points gone). */
function corners(loop) {
  const pts = loop.slice(0, -1), n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    if ((b.x - a.x) * (c.y - b.y) !== (b.y - a.y) * (c.x - b.x)) out.push(b);
  }
  out.push(out[0]);
  return out;
}

/** The rounding leaves points far closer than the field can resolve: keep one every REGION_STEP map pixels
 *  (a loop's first and last kept, so it still closes). */
export const REGION_STEP = FIELD_CELL / 3;
function decimate(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], p = pts[i];
    if (Math.hypot(p.x - a.x, p.y - a.y) >= REGION_STEP) out.push(p);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** How many times a region's staircase is rounded, and how far a corner may be cut (map pixels). */
export const REGION_ROUNDS = 3;
export const REGION_CUT = FIELD_CELL * 1.5;

/**
 * THE REGIONS: for every word the field holds, its loops - the staircase
 * rounded REGION_ROUNDS times in the coast's hand, in map pixels - with
 * each loop's bounding box for the cull. `{ word: [{ pts, box }] }`,
 * clear air none. Pure.
 */
export function fieldRegions(field) {
  const { cols, rows, cell, words } = field;
  const regions = {};
  const present = new Set(words);
  for (const i of present) {
    if (i === 0) continue;
    const loops = traceLoops((gx, gy) => words[gy * cols + gx] === i, cols, rows).map((loop) => {
      let pts = corners(loop).map((p) => ({ x: p.x * cell, y: p.y * cell }));
      for (let k = 0; k < REGION_ROUNDS; k++) pts = roundCorners(pts, REGION_CUT);
      pts = decimate(pts);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
      return { pts, box: [x0, y0, x1, y1] };
    });
    regions[FIELD_WORDS[i]] = loops;
  }
  return regions;
}

/**
 * Each weather's hand, in paper pixels, kept LIGHT (Mac: "the goal is not
 * being overbearing on the map. It needs to be more subtle"): a faint
 * tint, a sparse hatch across a HATCH_TILE square only where something
 * falls or lies on the ground, and an outline only where it helps - the
 * wide pale weathers (cloud, the deck) are a tint and nothing more, so
 * the coast, the roads and the marks read through them.
 */
export const HATCH_TILE = 12;
export const HATCH = Object.freeze({
  cloudy: { tint: 0.08, outline: 0 },
  overcast: { tint: 0.13, outline: 0.18 },
  fog: { tint: 0.22, lines: [[2, 4, 6, 4], [8, 10, 11, 10]], alpha: 0.3, outline: 0.22 },
  rain: { tint: 0.12, lines: [[0, 12, 12, 0]], alpha: 0.38, outline: 0.42 },
  thunder: { tint: 0.18, lines: [[0, 12, 12, 0], [0, 0, 12, 12]], alpha: 0.42, outline: 0.5 },
  snow: { tint: 0.26, dots: [[3, 3], [9, 9]], alpha: 0.55, outline: 0.4 },
  sandstorm: { tint: 0.16, dots: [[2, 3], [8, 5], [5, 10]], alpha: 0.45, outline: 0.42 },
});
/** A region's outline: its weather's ink darkened toward the pen, as strong as its hand says, and thin. */
export const OUTLINE_LEAN = 0.35;
export const OUTLINE_PX = 0.9;
export const outlineInk = (word) => rgba(mixRgb(WEATHER_INK[word], INK_RGB, OUTLINE_LEAN), HATCH[word]?.outline ?? 0.4);

const _patterns = new Map();
/** The word's hatch as a canvas pattern (null with no canvas - a headless host fills the tint alone; only a made
 *  pattern is kept, so a call before there is a canvas never pins the tint for good). */
export function hatchPattern(ctx, word) {
  if (_patterns.has(word)) return _patterns.get(word);
  let pat = null;
  const tile = typeof document !== 'undefined' ? document.createElement?.('canvas') : null;
  const t = tile?.getContext?.('2d');
  if (t && ctx.createPattern) {
    tile.width = tile.height = HATCH_TILE;
    const h = HATCH[word], ink = WEATHER_INK[word];
    t.fillStyle = rgba(ink, h.tint); t.fillRect(0, 0, HATCH_TILE, HATCH_TILE);
    t.strokeStyle = rgba(ink, h.alpha ?? 0.6); t.lineWidth = 0.9; t.lineCap = 'round';
    t.beginPath(); for (const [a, b, c, d] of h.lines ?? []) { t.moveTo(a, b); t.lineTo(c, d); } t.stroke();
    t.fillStyle = rgba(mixRgb(ink, INK_RGB, OUTLINE_LEAN), h.alpha ?? 0.6);
    for (const [x, y] of h.dots ?? []) { t.beginPath(); t.arc(x, y, 1.1, 0, Math.PI * 2); t.fill(); }
    pat = ctx.createPattern(tile, 'repeat');
  }
  if (pat) _patterns.set(word, pat);
  return pat;
}

/**
 * Ink the regions: each word's loops filled with its hatch (the tint
 * alone with no canvas for the pattern), lowest priority first, then
 * outlined in its ink. Only loops the paper shows are drawn.
 */
export function paintWeatherRegions(ctx, view, regions, { paperW, paperH, dpr = 1 }) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = view.scale;
  const shown = (box) => !((box[2] - view.ox) * s < 0 || (box[0] - view.ox) * s > paperW || (box[3] - view.oy) * s < 0 || (box[1] - view.oy) * s > paperH);
  const trace = (loops) => {
    ctx.beginPath();
    for (const { pts, box } of loops) {
      if (!shown(box)) continue;
      pts.forEach((p, i) => { const [x, y] = toPaper(view, p.x, p.y); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
    }
  };
  const order = [...PRIORITY].reverse().filter((w) => regions[w]?.length);
  for (const w of order) {
    trace(regions[w]);
    ctx.fillStyle = hatchPattern(ctx, w) ?? rgba(WEATHER_INK[w], HATCH[w].tint);
    ctx.fill('nonzero');
  }
  ctx.lineWidth = OUTLINE_PX; ctx.lineJoin = 'round';
  for (const w of order) {
    if (!(HATCH[w].outline > 0)) continue;
    trace(regions[w]);
    ctx.strokeStyle = outlineInk(w);
    ctx.stroke();
  }
}
