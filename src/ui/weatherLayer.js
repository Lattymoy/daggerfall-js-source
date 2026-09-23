// @ts-check
// WEATHER3 slice E (2026-09-22, Mac: "imagine a map, one location its
// sunny, one is cloudy, one has a rainstorm, etc"): THE WEATHER ON THE
// MAP. The enhanced travel map (ui/heldMap.js's world sheet) inks the
// world weather map's systems (systems/weatherMap.js) over the bay - each
// a soft wash in its weather's pigment, its bands the rings a storm is
// seen coming by, a small pen glyph at the heart of the wet ones - so the
// map IS the picture Mac drew: sunny here, cloud there, a rainstorm over
// the hills. The hover names the weather at the place under the pointer
// and its FORECAST, read off the same pure law a few hours on ("Rain,
// heavy - clearing in about 3 hours").
//
// In the sheet's own hand: every pigment is mixed toward the pen's brown
// (inkMap's INK_RGB), washes are thin, and the glyphs are the pen - the
// map reads as one drawing with the weather sketched onto it, not a
// radar picture laid over it. The classic travel map is DFU's and draws
// none. Pure but for the canvas it paints on.

import { TERRAIN_SIZE } from '../world/terrainSampler.js';
import { MAX_MAP_PIXEL_Y } from '../formats/mapsFile.js';
import { INK_RGB, PEN, mixRgb, rgba, toPaper } from './inkMap.js';
import { PRIORITY } from '../systems/weatherMap.js';

/** How long the map's picture of the weather stands before it is read
 *  again, in game minutes - a system drifts a quarter of a map pixel in
 *  that time, so a finer refresh changes nothing the eye can see. */
export const WEATHER_LAYER_REFRESH_MINUTES = 10;
/** How far ahead the hover's forecast reads. */
export const WEATHER_FORECAST_HOURS = 12;

/** The pigment of each weather, mixed a third of the way to the pen so
 *  the washes sit in the sheet's own hand. */
const PIGMENT = Object.freeze({
  cloudy: [150, 150, 146], overcast: [112, 114, 118], fog: [176, 172, 160], rain: [58, 84, 132],
  thunder: [66, 44, 92], snow: [150, 176, 204], sandstorm: [184, 132, 58],
});
export const WEATHER_INK = Object.freeze(Object.fromEntries(Object.entries(PIGMENT).map(([w, rgb]) => [w, Object.freeze(mixRgb(rgb, INK_RGB, 0.33))])));
/** How heavy each weather's wash lies at the height of its life. */
export const WASH_ALPHA = Object.freeze({ cloudy: 0.07, overcast: 0.11, fog: 0.12, rain: 0.16, thunder: 0.2, snow: 0.14, sandstorm: 0.16 });

/** The share of each band's disc its wash thins across at the rim. */
export const WASH_RIM = 0.45;
/** A heart is signed with its glyph once the storm is this far into its
 *  strength and its heart this many paper pixels across. */
export const GLYPH_MIN_ENV = 0.6;
export const GLYPH_MIN_PX = 12;

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
 * env, bands: [[r, word], ...] }` in map pixels, its bands core out -
 * sorted so the wash is laid lowest priority first and the storm's heart
 * is inked last, as the sky blends them (WEATHER3c).
 */
export function weatherMarks(systems) {
  return systems.map((s) => {
    const [x, y] = mapOfField(s.x, s.z);
    return { id: s.id, type: s.type, x, y, env: s.env, bands: s.bands.map(([r, word]) => [r / TERRAIN_SIZE, word]) };
  }).sort((a, b) => PRIORITY.indexOf(b.type) - PRIORITY.indexOf(a.type));
}

/** The glyph at a wet system's heart, in the pen: rain's slant strokes,
 *  the storm's bolt, snow's star, the sand's drift. `s` its size. */
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
 * wet system's heart signed with its glyph once it is big enough on the
 * paper to hold one. Only what the paper shows is drawn.
 */
export function paintWeatherLayer(ctx, view, marks, { paperW, paperH, dpr = 1 }) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = view.scale;
  for (const m of marks) {
    const outer = m.bands[m.bands.length - 1][0];
    const [cx, cy] = toPaper(view, m.x, m.y);
    const rp = outer * s;
    if (cx + rp < 0 || cy + rp < 0 || cx - rp > paperW || cy - rp > paperH || rp < 0.75) continue;
    for (let i = m.bands.length - 1; i >= 0; i--) {
      const [r, word] = m.bands[i];
      const ink = WEATHER_INK[word];
      if (!ink) continue;
      // a wash with a soft rim - full over the inner part of the band's disc, thinning to nothing at its edge - so
      // the systems run into one another as cloud does, and a storm's rings read as its weather thinning outward
      const a = (WASH_ALPHA[word] ?? 0.1) * (0.35 + 0.65 * m.env), rr = r * s;
      const g = ctx.createRadialGradient(cx, cy, rr * (1 - WASH_RIM), cx, cy, rr);
      g.addColorStop(0, rgba(ink, a)); g.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }
    // the pen signs a wet system's heart only when the storm has come into its own and its heart is big enough on
    // the paper to hold a mark - the far view is not a page of glyphs
    const core = m.bands[0][0] * s;
    if ((PRECIPITATING.has(m.type) || m.type === 'fog') && m.env >= GLYPH_MIN_ENV && core >= GLYPH_MIN_PX) glyph(ctx, m.type, cx, cy, Math.min(18, core * 0.8));
  }
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
