// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-FORECAST (2026-10-19, the owner, of "a weather forecast from the air": "I like this idea, but do it right";
// bible/06-Systems/Travel-View.md OW-FORECAST): THE WEATHER AHEAD, ON THE OVERWORLD.
//
// The world's weather is a map (WEATHER3, systems/weather/weatherMap.js): systems born on the land, drifting, growing and
// dying, the weather at any place and minute a pure function of both - so it can be asked of a place and a minute that
// have not come yet, and the answer is the one the traveller will stand in when they come. TV4's rule holds here: nothing
// is invented - every word below is `weatherAt` for its own ground at the minute it names, through the ground law every
// reader of the map wears (weatherSim.js mapGround: what falls is the air's), on the shared minute online - so two players
// read the same forecast, and it comes true. Three places it is said:
//   - THE WAY AHEAD, while a journey runs: the route still to walk, sampled every ROUTE_STEP_M to ROUTE_AHEAD_M (and its
//     end), each sample asked at the minute the traveller will reach it - each stretch's metres at ITS OWN pace (AUDIT
//     OW-REVISITED L3-1: a road at x100 and the open ground at x60, a road reckless and a track cautious, a town's streets
//     at x5 - the whole way asked at the pace of the moment was untrue on arrival for a third of the "ahead" lines),
//     scaled from the pace MEASURED now (`paceMeter`: the minutes the weather's clock runs a field metre, as the
//     traveller walks this stretch; `wayMinuteAt`: offline the calendar runs with the journey's rate, so only the force
//     changes a stretch's minutes; online the shared clock does not, so the rate does too) - and the first change a
//     traveller meets said ("Rain ahead - 2.4 km, in 20 min"), or the clearing of what falls now, or the same the whole
//     way ("Fair weather all the way to Daggerfall"). The way is read only as far as the traveller walks it on the ground
//     they stand on (a sea leg's pace is the ship's, none measured) - past that, "for the next" what was read.
//   - HERE, standing: the next HERE_HOURS at the traveller's place, every HERE_STEP_MIN (forecastAt) - what falls now and
//     when it clears, or what comes and when.
//   - A PLACE'S CARD, under the pointer: its own next hours, the same law.
// The map's lane only (weatherMapOn: the enhanced skin's world weather map, forced on online). Off it the sky is DFU's
// day roll per climate, which has no tomorrow to read - and nothing is said.
//
// PURE: points, minutes and a reader in; words out - the player's language's (L10N4: every word through the text core,
// `t`, its English here; its numbers in the language's own figures). The host (scenes/overworldForecastHost.js) reads the
// map, the clock, the route and the pace.
// ═══════════════════════════════════════════════════════════════════
import { t, intlLocale } from '../textManager.js';

/** The map's words a traveller is told of (read in the player's language when read) - what falls and what blinds; the
 *  sky's look is never news (AUDIT OW-REVISITED L3-11: its words were never shown). */
export const FORECAST_WORDS = Object.freeze({
  get fog() { return t('forecast.word.fog', 'Fog'); },
  get rain() { return t('forecast.word.rain', 'Rain'); },
  get thunder() { return t('forecast.word.thunder', 'Thunderstorm'); },
  get snow() { return t('forecast.word.snow', 'Snow'); },
  get sandstorm() { return t('forecast.word.sandstorm', 'Sandstorm'); },
});
/** What a traveller meets, as said after another ("Rain - snow in 30 min") - its own words, never a lowercased one. */
const FORECAST_TURNS = Object.freeze({
  get fog() { return t('forecast.turn.fog', 'fog'); },
  get rain() { return t('forecast.turn.rain', 'rain'); },
  get thunder() { return t('forecast.turn.thunder', 'thunderstorm'); },
  get snow() { return t('forecast.turn.snow', 'snow'); },
  get sandstorm() { return t('forecast.turn.sandstorm', 'sandstorm'); },
});
/** What a traveller meets on the way - what falls, what blinds; the rest is the sky's look. */
export const FORECAST_NOTABLE = Object.freeze(new Set(['fog', 'rain', 'thunder', 'snow', 'sandstorm']));
/** The way ahead is asked every ROUTE_STEP_M (field metres - AUDIT OW-REVISITED L3-5: a fog bank under a kilometre across
 *  slipped between the two-pixel samples it was), out to ROUTE_AHEAD_M (the far ring's own reach, past what the view
 *  shows) and at its end, ROUTE_SAMPLES_MAX at most - read a few a frame (the host's FORECAST_SLICE), never a pass in one
 *  frame (L3-10: a whole pass cost up to 26 ms in the HUD's draw). A system younger and smaller than a step can still
 *  lie between two. */
export const ROUTE_STEP_M = 400;
export const ROUTE_AHEAD_M = 40000;
export const ROUTE_SAMPLES_MAX = 101;
/** Here: the next HERE_HOURS, a word every HERE_STEP_MIN. */
export const HERE_HOURS = 6;
export const HERE_STEP_MIN = 15;
/** The pace meter's memory (real seconds, an exponential mean), and the least pace that is travelling (field metres a
 *  real second): slower, the way ahead has no minutes to give, and HERE is said instead. */
export const PACE_TAU_S = 3;
export const PACE_MIN_MPS = 0.5;
/** A step faster than this (field metres a real second) is a jump - a teleport, a load - and starts the meter again. */
export const PACE_JUMP_MPS = 20000;
/** AUDIT OW-REVISITED L3-3: a gap longer than this between two steps (real seconds - the view down, a window, a load) is no
 *  measure of the pace: the meter starts again. */
export const PACE_GAP_S = 1;
/** AUDIT OW-REVISITED L3-9: the weather's clock stepping more than this many game minutes past what its pace says (the
 *  shared minute re-heard online, a rest) is a jump too. */
export const PACE_CLOCK_STEP_MIN = 2;

const say = (w) => FORECAST_WORDS[w] ?? w;
const notable = (w) => FORECAST_NOTABLE.has(w);

/** Game minutes as a traveller says them: "in 20 min" to the nearest five under the hour, "in about 3 h" past it. */
export function etaWords(min) {
  if (!(min > 0)) return t('forecast.eta.now', 'now');
  if (min < 57.5) return t('forecast.eta.min', 'in {n} min', { n: Math.max(5, Math.round(min / 5) * 5) });
  return t('forecast.eta.hours', 'in about {n} h', { n: Math.round(min / 60) });
}
/** Field metres as a distance: tenths of a kilometre under ten, whole ones past - in the language's own figures (AUDIT
 *  OW-REVISITED L3-12: "2,4 km" in German). */
export const kmWords = (m) => {
  const tenths = m < 9950, n = tenths ? Math.round(m / 100) / 10 : Math.round(m / 1000);
  return t('forecast.km', '{n} km', { n: new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: tenths ? 1 : 0, maximumFractionDigits: tenths ? 1 : 0 }).format(n) });
};

/**
 * The places along a line of points (field metres, the traveller first) the way ahead is asked at: every `step` from
 * the traveller to `ahead` (never the traveller's own), and the line's end when it lies within `ahead` - each
 * `{ x, z, d, end }`, `d` the metres along, `end` set on the line's end when it is the JOURNEY's (`whole`: false where the
 * way was read only so far). At most `max`.
 */
export function samplesAlong(points, step = ROUTE_STEP_M, ahead = ROUTE_AHEAD_M, max = ROUTE_SAMPLES_MAX, whole = true) {
  const out = [];
  if (!points || points.length < 2) return out;
  let walked = 0, next = step;
  for (let i = 1; i < points.length && out.length < max; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    while (next <= walked + len && next <= ahead && out.length < max) {
      const t = len > 0 ? (next - walked) / len : 1;
      out.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, d: next, end: false });
      next += step;
    }
    walked += len;
    if (walked > ahead) return out;
  }
  const [ex, ez] = points[points.length - 1];
  if (walked <= ahead && out.length < max) out.push({ x: ex, z: ez, d: walked, end: !!whole });
  return out;
}

/**
 * AUDIT OW-REVISITED L3-1: THE MINUTES ALONG THE WAY - a line of points (field metres) and each stretch's minutes a metre
 * (`mpm[i]` for the stretch from point i to i+1): the game minutes from the first point to `d` metres along it (past the
 * end, at the last stretch's). The host makes `mpm` from the pace measured now and each stretch's own (overworldForecastHost.js).
 */
export function wayMinuteAt(points, mpm) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return (d) => {
    let m = 0;
    for (let i = 0; i < cum.length - 1 && d > cum[i]; i++) m += (Math.min(d, cum[i + 1]) - cum[i]) * (mpm[i] ?? 0);
    if (d > cum[cum.length - 1]) m += (d - cum[cum.length - 1]) * (mpm[mpm.length - 1] ?? 0);
    return m;
  };
}

/**
 * THE WAY AHEAD: each sample asked at the minute the traveller reaches it (`minuteAt(d)` - absolute), against what falls
 * where they stand now (`nowWord`). The first change that matters - something met (`ahead`), or what falls now giving
 * out (`clearing`) - else the same the whole way read (`steady`: what falls now, or fair; `all` when the way's end was
 * among the samples). `wordAt(x, z, minute)` the map's word there and then.
 * @returns {{ kind: 'ahead'|'clearing'|'steady', word: string, d: number, min: number, all: boolean }}
 */
export function routeForecast(samples, { nowWord, now, minuteAt, wordAt }) {
  let last = null;
  for (const s of samples) {
    const at = minuteAt(s.d);
    const w = s.w ?? wordAt(s.x, s.z, at);   // a word the host already read (its pass reads a few a frame)
    last = { s, w, at };
    if (w !== nowWord && (notable(w) || notable(nowWord))) return { kind: notable(w) ? 'ahead' : 'clearing', word: notable(w) ? w : nowWord, d: s.d, min: at - now, all: false };
  }
  return { kind: 'steady', word: nowWord, d: last?.s.d ?? 0, min: 0, all: !!last?.s.end };
}

/** The way ahead in words. `dest` the journey's end's name (a place's), or null. */
export function routeLine(f, dest = null) {
  const word = say(f.word), km = kmWords(f.d);
  if (f.kind === 'ahead') return t('forecast.route.ahead', '{word} ahead - {km}, {eta}', { word, km, eta: etaWords(f.min) });
  if (f.kind === 'clearing') return t('forecast.route.clears', '{word} clears {km} ahead', { word, km });
  if (notable(f.word)) {
    if (!f.all) return t('forecast.route.forNext', '{word} for the next {km}', { word, km });
    return dest ? t('forecast.route.allTo', '{word} all the way to {dest}', { word, dest }) : t('forecast.route.all', '{word} all the way', { word });
  }
  if (!f.all) return t('forecast.route.fairAhead', 'Fair weather ahead');
  return dest ? t('forecast.route.fairAllTo', 'Fair weather all the way to {dest}', { dest }) : t('forecast.route.fairAll', 'Fair weather all the way');
}

/** HERE in words, from forecastAt's answer ({ at, now, steps, next }): what falls now and when it clears, what comes and
 *  when, or fair for the hours read. */
export function hereLine(fc, hours = HERE_HOURS) {
  if (!fc?.now) return '';
  const nowWord = fc.now.word;
  if (notable(nowWord)) {
    const clear = fc.steps.find((s) => s.word !== nowWord), word = say(nowWord);
    if (!clear) return t('forecast.here.forNext', '{word} for the next {hours} h', { word, hours });
    const eta = etaWords(clear.at - fc.at);
    return notable(clear.word) ? t('forecast.here.turns', '{word} - {next} {eta}', { word, next: FORECAST_TURNS[clear.word], eta }) : t('forecast.here.clearing', '{word} - clearing {eta}', { word, eta });
  }
  const comes = fc.steps.find((s) => notable(s.word));
  return comes ? t('forecast.here.comes', '{word} {eta}', { word: say(comes.word), eta: etaWords(comes.at - fc.at) }) : t('forecast.here.fair', 'Fair for the next {hours} h', { hours });
}

/**
 * THE PACE, MEASURED: field metres the traveller covers a real second, and game minutes the weather's clock runs a real
 * second - exponential means over PACE_TAU_S. `step(realS, x, z, minute)` each frame; a jump (PACE_JUMP_MPS), a gap
 * (PACE_GAP_S) or a clock that steps back or far ahead (PACE_CLOCK_STEP_MIN) starts it again. `minutesFor(d)` the game
 * minutes `d` metres ahead take at that pace, or null while not travelling.
 */
export function paceMeter(tau = PACE_TAU_S) {
  let last = null, v = 0, r = 0, warm = 0;
  return {
    step(t, x, z, minute) {
      if (last && t > last.t) {
        const dt = t - last.t;
        const sp = Math.hypot(x - last.x, z - last.z) / dt;
        const clockJump = minute < last.m || (warm > 0 && minute - last.m > PACE_CLOCK_STEP_MIN + 4 * r * dt);
        if (sp > PACE_JUMP_MPS || clockJump || dt > PACE_GAP_S) { v = 0; r = 0; warm = 0; }
        else {
          const k = warm > 0 ? 1 - Math.exp(-dt / tau) : 1;   // the first measure taken whole - a mean from nothing reads every pace slow
          v += (sp - v) * k;
          r += ((minute - last.m) / dt - r) * k;
          warm += dt;
        }
      }
      last = { t, x, z, m: minute };
    },
    get v() { return v; },
    get r() { return r; },
    minutesFor(d) { return warm >= tau / 2 && v >= PACE_MIN_MPS ? (d / v) * r : null; },
    reset() { last = null; v = 0; r = 0; warm = 0; },
  };
}
