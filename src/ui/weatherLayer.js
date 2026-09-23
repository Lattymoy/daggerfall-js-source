// @ts-check
// WEATHER3 slice E (2026-09-22, Mac: "imagine a map, one location its
// sunny, one is cloudy, one has a rainstorm, etc"): THE WEATHER ON THE
// MAP. The enhanced travel map (ui/heldMap.js's world sheet) inks the
// world weather map's systems (systems/weatherMap.js) over the bay - each
// a soft wash in its weather's pigment, its bands the rings a storm is
// seen coming by, a small pen glyph at the heart of the wet ones - so the
// map IS the picture Mac drew: sunny here, cloud there, a rainstorm over
// the hills - each word through the ground law where it stands, so a
// winter storm is inked as the snow it falls as. The hover names the
// weather at the place under the pointer
// and its FORECAST, read off the same pure law a few hours on ("Rain,
// heavy - clearing in about 3 hours").
//
// In the sheet's own hand: the washes lie UNDER the pen's lines, the
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
import { INK_RGB, PEN, NAME_FACE, mixRgb, rgba, toPaper } from './inkMap.js';
import { PRIORITY } from '../systems/weatherMap.js';

/** How long the map's picture of the weather stands before it is read
 *  again, in game minutes - a system drifts a quarter of a map pixel in
 *  that time, so a finer refresh changes nothing the eye can see. */
export const WEATHER_LAYER_REFRESH_MINUTES = 10;
/** The washes' own layer: map pixels are inked at this many layer pixels
 *  each, once a refresh (the bay is 2000 x 1000), and the sheet draws it
 *  under its view - soft washes lose nothing to the scale. */
export const WASH_LAYER_SCALE = 2;
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
/** How heavy each weather's wash lies at the height of its life. */
export const WASH_ALPHA = Object.freeze({ cloudy: 0.22, overcast: 0.36, fog: 0.62, rain: 0.42, thunder: 0.55, snow: 0.72, sandstorm: 0.45 });
/** The legend's rows, the heaviest weather first; clear air is the bare paper. */
export const LEGEND_ROWS = Object.freeze(['thunder', 'rain', 'snow', 'sandstorm', 'fog', 'overcast', 'cloudy', 'sunny']);

/** The share of each band's disc its wash thins across at the rim - a
 *  storm cell's wider, so a front's cells run together into one dark
 *  heart rather than stand as spots. */
export const WASH_RIM = 0.45;
export const CELL_RIM = 0.8;
/** A heart is signed with its glyph once the storm is this far into its
 *  strength and its heart this many paper pixels across. */
export const GLYPH_MIN_ENV = 0.6;
export const GLYPH_MIN_PX = 12;
/** Fog's glyph waits for a bigger heart: a fog bank is wide and quiet, and
 *  its lines on every bank at the far view were clutter. */
export const FOG_GLYPH_MIN_PX = 28;

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
 * env, bands: [[r, word], ...], clip }` in map pixels, its bands core out
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
    const clip = s.clip ? [...mapOfField(s.clip[0], s.clip[1]), s.clip[2] / TERRAIN_SIZE] : null;
    return { id: s.id, type: g(s.type, s), x, y, env: s.env, bands: s.bands.map(([r, word]) => [r / TERRAIN_SIZE, g(word, s)]), clip };
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
 * Ink the marks over the sheet: each band a thin wash in its word's
 * pigment, heavier toward the heart and with the system's strength, a
 * wet or fogbound system's heart signed with its glyph once it is big
 * enough on the paper to hold one. Only what the paper shows is drawn.
 * `washes` and `glyphs` choose the halves: the sheet inks the washes once
 * a refresh onto a map-sized layer and the glyphs, a handful, as it goes.
 * `bounds` [w, h] (map pixels) keeps the glyphs to the map: a system
 * standing off its edge washes over it but is not signed on the margin.
 */
export function paintWeatherLayer(ctx, view, marks, { paperW, paperH, dpr = 1, washes = true, glyphs = true, bounds = null }) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = view.scale;
  for (const m of marks) {
    const outer = m.bands[m.bands.length - 1][0];
    const [cx, cy] = toPaper(view, m.x, m.y);
    const rp = outer * s;
    if (cx + rp < 0 || cy + rp < 0 || cx - rp > paperW || cy - rp > paperH || rp < 0.75) continue;
    // WEATHER3g: a storm cell paints only inside its front's core
    let clipped = false;
    if (m.clip && washes) {
      const [kx, ky] = toPaper(view, m.clip[0], m.clip[1]);
      ctx.save(); ctx.beginPath(); ctx.arc(kx, ky, m.clip[2] * s, 0, Math.PI * 2); ctx.clip();
      clipped = true;
    }
    for (let i = washes ? m.bands.length - 1 : -1; i >= 0; i--) {
      const [r, word] = m.bands[i];
      const ink = WEATHER_INK[word];
      if (!ink) continue;
      // a wash with a soft rim - full over the inner part of the band's disc, thinning to nothing at its edge - so
      // the systems run into one another as cloud does, and a storm's rings read as its weather thinning outward
      const a = (WASH_ALPHA[word] ?? 0.1) * (0.35 + 0.65 * m.env), rr = r * s;
      const g = ctx.createRadialGradient(cx, cy, rr * (1 - (m.clip ? CELL_RIM : WASH_RIM)), cx, cy, rr);
      g.addColorStop(0, rgba(ink, a)); g.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }
    if (clipped) ctx.restore();
    // the pen signs a wet system's heart only when the storm has come into its own and its heart is big enough on
    // the paper to hold a mark - the far view is not a page of glyphs
    const core = m.bands[0][0] * s;
    const heartShows = (!m.clip || Math.hypot(m.x - m.clip[0], m.y - m.clip[1]) < m.clip[2])   // a cell's glyph only where it paints
      && (!bounds || (m.x >= 0 && m.y >= 0 && m.x < bounds[0] && m.y < bounds[1]));
    const minPx = m.type === 'fog' ? FOG_GLYPH_MIN_PX : GLYPH_MIN_PX;
    if (glyphs && heartShows && (PRECIPITATING.has(m.type) || m.type === 'fog') && m.env >= GLYPH_MIN_ENV && core >= minPx) glyph(ctx, m.type, cx, cy, Math.min(18, core * 0.8));
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
    const ink = WEATHER_INK[word];
    if (ink) { ctx.fillStyle = rgba(ink, Math.min(1, (WASH_ALPHA[word] ?? 0.3) * 1.6)); ctx.fillRect(x + pad, cy - 5, sw, 10); }
    ctx.strokeStyle = PEN.soft; ctx.lineWidth = 1; ctx.strokeRect(x + pad + 0.5, cy - 4.5, sw - 1, 9);
    // the pale four told apart by the pen's own sign, as on the map
    if (PRECIPITATING.has(word) || word === 'fog') glyph(ctx, word, x + pad + sw / 2, cy, 9);
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
