// @ts-check
// TIME1 (2026-10-01, Mac: "people have to wait insanely long, werewolf forms last insanely long" / "I don't want a
// band aid, I want a detailed way we can do this" / "Let's do it. This needs to be perfect"): THE SKY'S OWN CLOCK.
// Design: bible/06-Systems/Online-Time-Arc.md.
//
// Online two clocks are functions of wall time. WORLD5's (wire.js sharedClassicMinutes, TimeScale 12, a day every two
// real hours) is THE EVENT CLOCK: the relay's gates, raids and rows, the economy, every term and every stamp - its rate
// never changes. This file is THE SKY: the hour, the date and the moons a player sees, at a rate of its own. Nothing
// walks the sky and nothing is stamped on it - it is read for "now" - so its rate is a dial that moves nothing else.
//
// A LEAF, AND NEVER THE RELAY'S. wire.js is in the relay's bundle and test/net/relayversion.test.js binds RELAY_VERSION to
// every byte of it, so the sky lives here, outside the relay's import graph (test/systems/time1_sky.test.js holds it out); the
// account service bundles it through nodeLaw.js, whose UTC days take their season from the sky. It imports wire.js
// alone, so neither graph grows past this one file.
import { sharedClassicMinutes, wallMsForClassicMinutes, ONLINE_MINUTES_PER_MS } from './wire.js';

/**
 * TIME1: the sky's segments, oldest first. From `fromMs` (relay-clock ms) the sky runs at `minutesPerMs` classic
 * minutes per real ms; before the first segment the sky IS the event clock. Each segment starts at the minute the one
 * before it reached, so a new row turns the dial again with no jump. Each `fromMs` is an ALIGNED instant
 * (`node tools/skyCutover.mjs` lists them): there the old sky's hour already equals the new schedule's, so nothing
 * skips at the switch and the new rate's midnights fall on whole fractions of the real day for good - at TimeScale 24
 * on the hour (test/systems/time1_sky.test.js pins both).
 *
 * The first switch must not fall before the build that carries it is live: a tab that loads after it reads the new sky
 * at once, so the sky would jump once at the deploy. Nothing stores the sky, so that jump is only seen, never kept -
 * but if a merge lands after `fromMs`, move it to the next aligned instant instead.
 * @type {ReadonlyArray<Readonly<{fromMs: number, minutesPerMs: number}>>}
 */
export const SKY_SEGMENTS = Object.freeze([
  // TimeScale 24: a day every real hour, midnight on the hour (SKY-SLOW, 2026-10-02: 48's thirty-minute day zoomed by -
  // the row replaced before it went live).
  Object.freeze({ fromMs: Date.UTC(2026, 9, 3, 17, 7, 30), minutesPerMs: 24 / 60 / 1000 }),
]);

/**
 * TIME1: the sky's law over a list of segments - the module's own below is this over SKY_SEGMENTS; the pin builds
 * others to prove a second switch as seamless as the first.
 * @param {ReadonlyArray<{fromMs: number, minutesPerMs: number}>} segments
 */
export function skyLawOf(segments) {
  /** Each segment's first classic minute: the event clock's at the first switch, and each later one where the segment
   *  before it stood at its own switch - the walk that makes every switch continuous. */
  const starts = segments.reduce((/** @type {number[]} */ out, s, i) => {
    out.push(i === 0 ? sharedClassicMinutes(s.fromMs) : out[i - 1] + (s.fromMs - segments[i - 1].fromMs) * segments[i - 1].minutesPerMs);
    return out;
  }, []);
  /** The segment an instant stands in (its index), or -1 before the first switch. */
  const segmentAt = (nowMs) => {
    for (let i = segments.length - 1; i >= 0; i--) if (nowMs >= segments[i].fromMs) return i;
    return -1;
  };
  /** The sky's clock, classic minutes, for a relay-clock instant (ms) - the event clock's before the first switch. */
  const minutesAt = (nowMs) => {
    const i = segmentAt(nowMs);
    return i < 0 ? sharedClassicMinutes(nowMs) : starts[i] + (nowMs - segments[i].fromMs) * segments[i].minutesPerMs;
  };
  /** The inverse: the relay-clock millisecond at which the sky reads a classic minute. */
  const wallMsAt = (classicMinutes) => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (classicMinutes >= starts[i]) return segments[i].fromMs + (classicMinutes - starts[i]) / segments[i].minutesPerMs;
    }
    return wallMsForClassicMinutes(classicMinutes);
  };
  /** The sky's rate at an instant, classic minutes per real ms. */
  const rateAt = (nowMs) => {
    const i = segmentAt(nowMs);
    return i < 0 ? ONLINE_MINUTES_PER_MS : segments[i].minutesPerMs;
  };
  return { minutesAt, wallMsAt, rateAt };
}

const LAW = skyLawOf(SKY_SEGMENTS);

/** TIME1: the sky's clock, classic minutes, for a relay-clock instant (ms) - the event clock's before the first switch. */
export const skyClassicMinutes = (nowMs) => LAW.minutesAt(nowMs);
/** TIME1: the inverse - the relay-clock millisecond at which the sky reads a classic minute (the words that say how long
 *  until the sky's dusk). */
export const wallMsForSkyMinutes = (classicMinutes) => LAW.wallMsAt(classicMinutes);
/** TIME1: the sky's rate at an instant, classic minutes per real ms (the event clock's before the first switch). */
export const skyMinutesPerMsAt = (nowMs) => LAW.rateAt(nowMs);

/**
 * TIME1: the instants after `afterMs` at which the sky could switch to `minutesPerMs` with no jump AND with a midnight
 * at every whole multiple of the new day's length since the Unix epoch (on the hour at TimeScale 24):
 * where the sky's hour as it stands (`skyClassicMinutes`) already equals the new schedule's. Whole seconds, at most
 * `count`, within `withinMs`; an instant where the sky already runs at that rate is no switch, and is never listed.
 * `segments` is the sky the switch is laid on - SKY_SEGMENTS for a new row after the last; AUDIT TIME: the list
 * without its last row to MOVE that row (a merge that lands after it). The tool (tools/skyCutover.mjs) and the pin
 * share it.
 */
export function alignedSkySwitches(minutesPerMs, afterMs, { count = 6, withinMs = 24 * 3600 * 1000, segments = SKY_SEGMENTS } = {}) {
  const law = segments === SKY_SEGMENTS ? LAW : skyLawOf(segments);
  const dayMs = 1440 / minutesPerMs;
  /** The new schedule's minute of the day at an instant less the sky's as it stands, as a signed gap within half a day. */
  const gap = (t) => {
    const want = (((t % dayMs) + dayMs) % dayMs) * minutesPerMs;
    const have = ((law.minutesAt(t) % 1440) + 1440) % 1440;
    return ((want - have + 2160) % 1440) - 720;
  };
  const out = [];
  for (let t = Math.ceil(afterMs / 1000) * 1000; t <= afterMs + withinMs && out.length < count; t += 1000) {
    if (law.rateAt(t - 1) !== minutesPerMs && Math.abs(gap(t)) < 1e-6) out.push(t);
  }
  return out;
}
