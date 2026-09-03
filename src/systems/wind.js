// WIND1 - THE WIND IS ITS OWN THING.
//
// Mac: "wind should be something different from the weather. Imagine a
// time-lapse, seeing a storm rolling in as the wind kicks up, and the
// front rolling away as the wind kicks down."
//
// Daggerfall has no wind. DFU's WeatherManager carries no such number;
// the enhanced sky gave each weather ROW a fixed vector, so every sunny
// day blew exactly like every other and a shower and a storm differed
// only in raindrop count. This module is the wind as a STATE of its
// own, in game minutes, with the weather as an INFLUENCE on it rather
// than a lookup:
//
//   THE DAY has a calm - how windy a day is, rolled once and drifting
//   slowly over its hours. A still day can cloud over and stay still.
//
//   A FRONT is a weather change. When the sim turns the sky (once a
//   day, at the date change, or crossing a climate - that is
//   Daggerfall's own law and it is not touched here), the change is
//   the front's arrival, and the wind LEADS it: it rises over the
//   front's lead, holds through it, and decays over its tail. Its
//   strength is the incoming weather's violence times a roll, so some
//   storms arrive wild and some barely stir. A front turns the wind,
//   as fronts do.
//
//   GUSTS are shaped by the wind, not the weather: a strong wind gusts
//   sharp and often, a light one breathes slow. A shower and a storm, a
//   flurry and a blizzard, fall out of the strength rather than being
//   special-cased.
//
// It answers in the sky ROW's own units - the vector `easeWeather`
// carries and WM2b made the ONE seam every consumer reads - so the
// clouds' drift, the ground's cloud shadows, the grass, the rain and
// snow, and the windmills all follow it together, by construction, and
// no shader changes. ENHANCED ONLY: the classic sky has no row and reads
// nothing here.

/** How much wind a weather brings in with it, 0..1. */
export const VIOLENCE = Object.freeze({
  sunny: 0.10, cloudy: 0.25, overcast: 0.30, fog: 0.08, rain: 0.55, snow: 0.45, thunder: 1.0,
});

/** A front's shape, in GAME MINUTES: the wind rises over the lead,
 *  holds, and decays over the tail. Three hours in, two out. */
export const FRONT_LEAD_MIN = 180;
export const FRONT_HOLD_MIN = 60;
export const FRONT_TAIL_MIN = 120;
/** How long a new day's calm takes to arrive, from yesterday's. */
export const CALM_BLEND_MIN = 180;

/** The row's units: the sunny row was 0.0108 (the lab's slider 70,
 *  through labWindSlider's x6500). Calm sits near the lab's 30; a full
 *  front reaches the slider's top. */
export const WIND_ROW_CALM = 0.0046;
export const WIND_ROW_SPAN = 0.0262;

/** mulberry32: a small seeded generator, so a day's calm and a front's
 *  roll are the same whenever the same day is replayed. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The front's envelope at `sinceArrival` game minutes: 0 before the
 * lead, rising to 1 at arrival, 1 through the hold, back to 0 over the
 * tail. Pure. `sinceArrival` is negative before the front arrives.
 */
export function frontFactor(sinceArrival) {
  if (sinceArrival < -FRONT_LEAD_MIN) return 0;
  if (sinceArrival < 0) {
    const u = (sinceArrival + FRONT_LEAD_MIN) / FRONT_LEAD_MIN;
    return u * u * (3 - 2 * u);   // ease-in: a front builds
  }
  if (sinceArrival < FRONT_HOLD_MIN) return 1;
  const v = (sinceArrival - FRONT_HOLD_MIN) / FRONT_TAIL_MIN;
  if (v >= 1) return 0;
  const w = 1 - v;
  return w * w * (3 - 2 * w);   // ease-out: it rolls away
}

/** The gust envelope for a wind of `strength` 0..1 at `tsec` seconds:
 *  a light wind breathes slowly, a strong one gusts sharp and often.
 *  Returns a multiplier around 1. Pure. */
export function gustEnvelope(strength, tsec) {
  const s = Math.max(0, Math.min(1, strength));
  const slow = 0.20 * Math.sin(tsec * (0.20 + 0.25 * s));
  const mid = 0.14 * Math.sin(tsec * (0.70 + 0.9 * s) + 1.7);
  const sharp = (0.06 + 0.22 * s) * Math.max(0, Math.sin(tsec * (1.6 + 2.4 * s) + 0.4)) ** (1 + 2 * s);
  return 0.72 + slow + mid + sharp;
}

/**
 * The model. `tick(nowMinutes, weather)` once a frame; the weather is
 * the sim's CURRENT word ('sunny'...'thunder'). Every read is pure over
 * the state the last tick left.
 */
export function createWindModel({ seed = 7 } = {}) {
  let day = null;         // the game day the calm was rolled for
  let calm = 0.2;         // this day's baseline strength, 0..1
  let prevCalm = 0.2;     // yesterday's, blended out over the morning - the day boundary is
                          // also the weather's, and a calm that SNAPPED there made a departing
                          // storm's wind drop in one tick instead of rolling away
  let heading = 0.35;     // radians, the day's prevailing direction
  let last = null;        // the weather word at the last tick
  let front = null;       // { at, strength, turn } or null
  let nowMin = 0;
  let jumpPending = false;   // WX2a: the next change of word is a jump, not a front

  const rollDay = (d) => {
    const r = seededRng(seed * 1000003 + d);
    prevCalm = day === null ? 0.06 + r() * 0.50 : calm;
    day = d;
    calm = 0.06 + r() * 0.50;                  // a still day to a brisk one
    heading = r() * Math.PI * 2;               // the day's prevailing wind
  };

  return {
    tick(nowMinutes, weather) {
      nowMin = nowMinutes;
      const d = Math.floor(nowMinutes / 1440);
      if (d !== day) rollDay(d);
      if (weather !== last) {
        if (jumpPending) {
          // WX2a (AUDIT 57): THE PLAYER ARRIVED, NOT THE WEATHER - a load,
          // a travel landing, a respawn roll, a day rolled out of sight.
          // No front builds: the sky they stand under is already this one.
          front = null;
        } else if (last !== null) {
          // THE CHANGE IS THE FRONT. Strength from the incoming weather's
          // violence, times a roll: some storms arrive wild, some barely
          // stir. It leads by FRONT_LEAD_MIN, which from the ground reads
          // as the wind rising before the sky turns.
          const r = seededRng(seed * 7919 + Math.floor(nowMinutes));
          const violence = VIOLENCE[weather] ?? 0.2;
          front = {
            at: nowMinutes + FRONT_LEAD_MIN,   // the sky finishes turning here; the wind is already up
            strength: violence * (0.6 + r() * 0.8),
            turn: (r() - 0.5) * Math.PI * 0.8,  // a front turns the wind, up to ~72 degrees
          };
        }
        last = weather;
      }
      jumpPending = false;
      if (front && nowMinutes - front.at > FRONT_HOLD_MIN + FRONT_TAIL_MIN) front = null;
    },

    /** WX2a: the host saw the sim's jump stamp move this frame. Any
     *  front up is dropped now - the world it belonged to is gone - and
     *  the change the next tick sees (if any) builds none. */
    jump() {
      front = null;
      jumpPending = true;
    },

    /** 0..1: the day's calm, with the front on top of it. */
    strength() {
      const drift = 0.85 + 0.15 * Math.sin(nowMin / 1440 * Math.PI * 4 + calm * 9);   // the day's own slow breath
      // The day's calm arrives over its first CALM_BLEND_MIN, from
      // yesterday's - so a still morning after a windy night is a wind
      // dying down, not a switch.
      const into = nowMin - Math.floor(nowMin / 1440) * 1440;
      const u = Math.min(1, into / CALM_BLEND_MIN);
      const c = prevCalm + (calm - prevCalm) * u * u * (3 - 2 * u);
      const f = front ? frontFactor(nowMin - front.at) * front.strength : 0;
      return Math.min(1, c * drift + f);
    },

    /** Where the front is: 0 before and after, 1 at its height. */
    frontProgress() {
      return front ? frontFactor(nowMin - front.at) : 0;
    },

    /** WX2: how far the INCOMING weather has arrived, 0..1 - the front's
     *  rise, and 1 from its arrival on, through the hold and the tail,
     *  where frontProgress falls back to 0 because the WIND is leaving
     *  while the weather stays. 1 with no front up: a boot into rain is
     *  rain. The ground's terms and the drops cross on this
     *  (systems/weatherFront.js), as the sky's ease already does. */
    arrival() {
      return front && nowMin < front.at ? frontFactor(nowMin - front.at) : 1;
    },

    /** WIND2: true from the weather change until the front ARRIVES - the
     *  whole lead, including its first minute when the factor is still
     *  0. The sky eases its row on THIS, so the clouds arrive behind the
     *  wind rather than ahead of it. */
    inLead() {
      return !!front && nowMin < front.at;
    },

    /** The wind's direction in radians: the day's, turned by the front. */
    heading() {
      const f = front ? frontFactor(nowMin - front.at) : 0;
      return heading + (front ? front.turn * f : 0);
    },

    /** THE VECTOR, in the sky row's units - the one thing every consumer
     *  reads. */
    vector() {
      const m = WIND_ROW_CALM + this.strength() * WIND_ROW_SPAN;
      const h = this.heading();
      return [Math.cos(h) * m, Math.sin(h) * m];
    },

    /** The gust multiplier for now, shaped by the strength. */
    gust(tsec) {
      return gustEnvelope(this.strength(), tsec);
    },

    /** For the record and the tests. */
    state() { return { day, calm, prevCalm, heading, front: front ? { ...front } : null, last, jumpPending }; },
  };
}
