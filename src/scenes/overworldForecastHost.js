// OW-FORECAST (2026-10-19, the owner: "I like this idea, but do it right"; bible/06-Systems/Travel-View.md OW-FORECAST):
// THE OVERWORLD'S FORECAST - the streaming host's half of systems/weather/owForecast.js. It reads the world weather map
// (weatherMap.js weatherAt / forecastAt, through the host's own ground law) at the host's weather minute (the one the
// sky is sampled at - sampleWeatherField's), the traveller's place AT THEIR HEIGHT (AUDIT OW-REVISITED L3-4: the sky's
// own air - the ground's mean height named the other phase of what was falling on them), the way still to walk
// (travelRoute.js wayStillToWalk - the drawn line's own, the town's walked streets dropped), each stretch's own pace
// (Travel Options' wayPace) and the pace being made, and keeps its answers:
//   - the WAY AHEAD's places read a few a frame (FORECAST_SLICE, L3-10), a pass begun every FORECAST_EVERY_MS of real
//     time and at once when the journey changes; the line said is the last pass's, never one of a journey that ended
//     (L3-8);
//   - HERE (standing, or the pace not yet measured) and a place's card read whole, the minute a change comes found to the
//     minute (L3-7: a bisection inside forecastAt's quarter hour - "in 15 min" was said of a change six minutes off), a
//     card kept a minute of the weather's clock.
// Off the map's lane (weatherMapOn), and while an event holds the sky (`held`: Sun Baby's sun over the land - L3-14), it
// says nothing. While no journey drives (stopped for a foe, a place, the view down) the pace is not measured and HERE is
// said (L3-3: a stopped journey forecast at the pace it no longer had for twenty seconds).
// The streaming host constructs it (scenes/world.js) - the one host with the Overworld; scenes/exterior.js,
// scenes/worldModes.js and scenes/dungeonContext.js raise no Overworld.
import { weatherAt, forecastAt } from '../systems/weather/weatherMap.js';
import { weatherMapOn } from '../systems/weather/weatherSim.js';
import { fieldFromNative } from '../systems/weather/weatherField.js';
import { wayStillToWalk } from '../systems/travel/travelRoute.js';
import { samplesAlong, routeForecast, routeLine, hereLine, paceMeter, wayMinuteAt, FORECAST_NOTABLE, HERE_HOURS, HERE_STEP_MIN } from '../systems/weather/owForecast.js';

/** How often a new pass over the way is begun, real milliseconds. */
export const FORECAST_EVERY_MS = 2000;
/** How many of the way's places a frame reads (a place reads ~0.1-1 ms). */
export const FORECAST_SLICE = 4;
/** How many places' cards are kept at once. */
export const FORECAST_CARDS_MAX = 64;

/**
 * THE WAY STILL TO WALK as the forecast reads it (`wayStillToWalk`, natives), cut where the traveller would leave the
 * ground they stand on (a sea leg ahead of a walker, the shore ahead of a sailor - its pace is not this one's) or where a
 * stretch has no pace; each stretch's pace (`paceOf(of)` - { fwd, rate, sea }); `whole` whether the way runs to the
 * journey's end; and the end's name. Null with no journey of the view's running.
 */
export function wayAhead(me, trip, route, seg, paceOf, sea = false) {
  const w = wayStillToWalk(me, route, seg, trip?.natives);
  if (!w) return null;
  const points = [w.points[0]], paces = [];
  let whole = true;
  for (let i = 0; i < w.of.length; i++) {
    const p = paceOf(w.of[i]);
    if (!p || !!p.sea !== !!sea) { whole = false; break; }
    points.push(w.points[i + 1]); paces.push(p);
  }
  return { points, paces, whole, dest: trip.plan?.summary?.name ?? null };
}

/** The first whole minute in (from, to] the word at (x, z) is no longer `word` - forecastAt's quarter-hour step bisected. */
function changeAt(x, z, from, to, word, read) {
  let lo = from, hi = to;
  while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (read(x, z, m) === word) lo = m; else hi = m; }
  return hi;
}

/**
 * @param {{ climateAt: (px: number, py: number) => number, ground: any, minuteNow: () => number, here: () => ({ x: number, z: number }),
 *   alt?: () => (number|null), tvTrip: any, tvTripLive: () => boolean, travel: () => any, shared?: () => boolean,
 *   rateNow?: () => number, held?: () => boolean }} host - `minuteNow` the weather's clock, game minutes, unfloored; `here`
 *   the traveller's natives, `alt` their height (metres above the sea); `tvTrip` the view's journey (its drawn points and
 *   its place), live while `tvTripLive`; `travel` Travel Options (its route, its walk's run, each stretch's pace and the
 *   walk's now - null while nothing drives); `shared` the shared clock (online); `rateNow` the clock's rate now; `held` an
 *   event holding the sky
 */
export function createOverworldForecast(host) {
  const { climateAt, ground, minuteNow, here, tvTrip, tvTripLive, travel } = host;
  const route = () => travel()?.route ?? null, seg = () => travel()?.state?.autopilot?.seg ?? 0;
  const paceOf = (of) => travel()?.wayPace?.(of) ?? null, paceNow = () => travel()?.paceNow ?? null;
  const alt = host.alt ?? (() => null);
  const shared = host.shared ?? (() => false), rateNow = host.rateNow ?? (() => 1), held = host.held ?? (() => false);
  const pace = paceMeter();
  const cards = new Map();
  let kept = { at: -Infinity, line: '', plan: null, route: false };
  let pass = null;   // { plan, samples, minuteAt, now, nowWord, words, i, dest }
  // the words read at the whole minute the sky is sampled at (sampleWeatherField's floor); the pace on the clock unfloored
  const wordAt = (x, z, minute, a = null) => weatherAt(x, z, Math.floor(minute), climateAt, { ground, alt: a }).word;
  /** A place's next hours (`n` natives, `a` its height or null for the ground's), the change found to the minute. */
  const hereAt = (n, minute, a = null) => {
    const [x, z] = fieldFromNative(n.x, n.z), m = Math.floor(minute);
    const fc = forecastAt(x, z, m, climateAt, { hours: HERE_HOURS, step: HERE_STEP_MIN, ground, alt: a });
    const k = fc.steps.findIndex((s) => s.word !== fc.now.word);
    if (k >= 0) fc.steps[k] = { ...fc.steps[k], at: changeAt(x, z, k ? fc.steps[k - 1].at : m, fc.steps[k].at, k ? fc.steps[k - 1].word : fc.now.word, (px, pz, mm) => wordAt(px, pz, mm, a)) };
    return hereLine(fc);
  };
  const off = () => { pace.reset(); pass = null; kept = { at: -Infinity, line: '', plan: null, route: false }; return ''; };
  /** A pass over the way ahead begun now, or null where the way cannot be read (no journey, no pace yet). */
  function begin(n, minute, fx, fz) {
    const now = paceNow();
    if (!tvTripLive() || !now) return null;
    const w = wayAhead(n, tvTrip, route(), seg(), paceOf, now.sea);
    const mpmNow = pace.minutesFor(1);
    if (!w || w.points.length < 2 || mpmNow == null) return null;
    // each stretch's minutes a metre: the pace measured now, scaled by the stretch's force against the walk's now, and -
    // online, where the shared clock does not run with the journey - by its rate against the clock's now (offline the
    // calendar runs with the rate, which so cancels)
    const pNow = now.fwd * (shared() ? rateNow() : 1);
    const mpm = w.paces.map((p) => mpmNow * pNow / (p.fwd * (shared() ? p.rate : 1)));
    const points = w.points.map(([x, z]) => fieldFromNative(x, z));
    const samples = samplesAlong(points, undefined, undefined, undefined, w.whole);
    if (!samples.length) return null;
    const along = wayMinuteAt(points, mpm);
    return { plan: tvTrip.plan, samples, now: minute, minuteAt: (d) => minute + along(d), nowWord: wordAt(fx, fz, minute, alt()), i: 0, met: false, dest: w.dest };
  }
  return {
    /** The Overworld's forecast line, asked every frame of the view (`nowMs` real). */
    line(nowMs) {
      if (!weatherMapOn() || held()) return off();
      const n = here(), minute = minuteNow();
      const [fx, fz] = fieldFromNative(n.x, n.z);
      const driving = !!paceNow();
      if (driving) pace.step(nowMs / 1000, fx, fz, minute);
      else { pace.reset(); pass = null; }   // nothing drives (a stop, the view down): no pace, no way read - here
      const plan = tvTripLive() ? tvTrip.plan : null;
      if (pass && pass.plan !== plan) pass = null;   // a pass of a journey that is over: dropped
      if (!pass && (nowMs - kept.at >= FORECAST_EVERY_MS || kept.plan !== plan || (!driving && kept.route))) {
        const changed = kept.plan !== plan;
        pass = driving ? begin(n, minute, fx, fz) : null;
        // standing, stopped, or the pace not yet measured: here - and here too while a new journey's first pass reads its
        // way, so the line of the journey that ended is never said of the next (AUDIT OW-REVISITED L3-8)
        if (!pass || changed) kept = { at: nowMs, line: hereAt(n, minute, alt()), plan, route: false };
        if (!pass) return kept.line;
      }
      if (pass) {
        // read a few places a frame, in order, until the first that changes what matters (routeForecast's own test)
        const news = (w) => w !== pass.nowWord && (FORECAST_NOTABLE.has(w) || FORECAST_NOTABLE.has(pass.nowWord));
        for (let k = 0; k < FORECAST_SLICE && pass.i < pass.samples.length && !pass.met; k++, pass.i++) {
          const s = pass.samples[pass.i];
          s.w = wordAt(s.x, s.z, pass.minuteAt(s.d));
          pass.met = news(s.w);
        }
        if (pass.met || pass.i >= pass.samples.length) {
          const f = routeForecast(pass.samples.slice(0, pass.i), { nowWord: pass.nowWord, now: pass.now, minuteAt: pass.minuteAt, wordAt });
          kept = { at: nowMs, line: routeLine(f, pass.dest), plan: pass.plan, route: true };
          pass = null;
        }
      }
      return kept.line;
    },
    /** How many places' cards are kept (FORECAST_CARDS_MAX at most) - the cache's own bound, read by its pin. */
    cardsKept: () => cards.size,
    /** A place's own next hours, for its card (`n` its natives) - kept a minute of the weather's clock. */
    placeLine(n) {
      if (!weatherMapOn() || held()) return '';
      const minute = Math.floor(minuteNow());
      const key = `${Math.round(n.x)},${Math.round(n.z)}`;
      const c = cards.get(key);
      if (c && c.minute === minute) return c.line;
      const line = hereAt(n, minute);
      if (cards.size >= FORECAST_CARDS_MAX) cards.delete(cards.keys().next().value);
      cards.set(key, { minute, line });
      return line;
    },
  };
}
