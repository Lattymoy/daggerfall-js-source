// @ts-check
// OWN-WORK4 (2026-10-31): RAIN, MADE. A hiss of a thousand far drops (noise in a broad band about 2.5 kHz), a low body
// of the heavier ones on a roof, and the near drops one by one - a tick each, a bubble's ping where one falls in a
// puddle - and, in a layer of its own (rainEaves), now and then a slow drip from an eave. The level breathes with a slow
// gust. It loops without a seam: the hiss's filters run over the noise twice and the second pass is kept (the beds'
// way, soundscape/soundBeds.js), every drop that runs past the end is folded back to the start, and the gust's period
// divides the loop. Pure (dsp.js).
import { addBubble, addBurst, between, filterSpan, inTurn, logBetween, mulberry32, quietBetween, rmsTo, toPcm } from './dsp.js';

/** The loop: its length (the indoor rain loop's, 29.55 s), its rate and its RMS. Mono: both of its plays pass a
 *  4,236 Hz low-pass, so 22,050 Hz holds all of it. */
export const RAIN_LOOP = Object.freeze({ seconds: 29.546, rate: 22050, rmsDb: -22.2 });
/** THE EAVES' LAYER (audio/layeredLoop.js): the drips are the bed's one sound a listener can count, so they loop on
 *  their own 41 s, beside the bed's 29.546 - together they come round after 2,473 hours. Their level is the one they had
 *  in the bed, 13.8 dB under it; their pings lie under 2.4 kHz, so 11,025 Hz holds them. */
export const RAIN_EAVES = Object.freeze({ seconds: 41, rate: 11025, rmsDb: -36 });

/** The hiss and the body: each a chain of sections over the same noise, at its own gain. Nothing over 7 kHz is made
 *  (the loop's plays cut at 4,236 Hz). */
/** @type {ReadonlyArray<import('./dsp.js').Stage>} */
const HISS = Object.freeze([
  ['highpass', 400, 0.7],
  ['bandpass', 2500, 0.45],
]);
/** @type {ReadonlyArray<import('./dsp.js').Stage>} */
const BODY = Object.freeze([['lowpass', 450, 0.7]]);

/**
 * THE LOOP, made a step at a time: each `yield` is a resting place (a stage of the hiss, the drops, the mix), so a
 * caller can hand the page a turn between them (rainLoopInTurns). The near drops are made on a canvas half a second
 * longer than the loop and the overhang folded back onto its start. Its last value is mono Float32 at `rate`.
 * @param {{ seed?: number, seconds?: number, rate?: number, rmsDb?: number }} [options]
 * @returns {Generator<undefined, Float32Array>}
 */
export function* rainSteps({ seed = 0x7261696e, seconds = RAIN_LOOP.seconds, rate = RAIN_LOOP.rate, rmsDb = RAIN_LOOP.rmsDb } = {}) {
  const n = Math.round(seconds * rate);
  const dice = mulberry32(seed),
    noise = mulberry32(seed ^ 0x9e3779b9);
  const hiss = new Float64Array(n);
  for (let i = 0; i < n; i++) hiss[i] = noise() * 2 - 1;
  const body = new Float64Array(hiss);
  yield;
  // each stage twice over the noise, the second pass kept, so the bed's end runs into its start
  for (const stage of HISS) {
    filterSpan(hiss, n, [stage], rate, 2);
    yield;
  }
  for (const stage of BODY) {
    filterSpan(body, n, [stage], rate, 2);
    yield;
  }
  const over = Math.round(0.5 * rate);
  const drops = new Float64Array(n + over);
  // the near drops: about ninety a second, a tick each and a quarter of them a puddle's ping; a rest every 5 s of them
  let rest = 5;
  for (let time = 0; time < seconds; time += -Math.log(1 - dice()) / 90) {
    if (time > rest) {
      rest += 5;
      yield;
    }
    const amp = quietBetween(dice, 0.02, 0.35);
    addBurst(drops, rate, noise, {
      at: time,
      amp,
      decay: between(dice, 0.0006, 0.002),
      stages: [['bandpass', logBetween(dice, 1500, 7000), 1.5]],
    });
    if (dice() < 0.25) {
      const freq = logBetween(dice, 1500, 4500);
      addBubble(drops, rate, { at: time, freq, tau: between(dice, 0.004, 0.012), amp: amp * 0.6, rise: 0.4 });
    }
  }
  for (let i = 0; i < over; i++) drops[i] += drops[n + i];
  yield;
  const phase1 = dice() * 6.283,
    phase2 = dice() * 6.283;
  // the gust, worked out every 64 samples and held between: it moves over seconds
  let gust = 1;
  for (let i = 0; i < n; i++) {
    if ((i & 63) === 0) {
      const along = i / n;
      gust = 1 + 0.18 * Math.sin(2 * Math.PI * 3 * along + phase1) + 0.08 * Math.sin(2 * Math.PI * 7 * along + phase2);
    }
    hiss[i] = (hiss[i] * 0.17 + body[i] * 0.09) * gust + drops[i];
  }
  return toPcm(rmsTo(hiss, rmsDb));
}

/** The eaves' drips, about one in a second and a half, folded at the end as the drops are: mono Float32 at `rate`.
 *  @param {{ seed?: number, seconds?: number, rate?: number, rmsDb?: number }} [options] */
export function rainEaves({ seed = 0x65617665, seconds = RAIN_EAVES.seconds, rate = RAIN_EAVES.rate, rmsDb = RAIN_EAVES.rmsDb } = {}) {
  const n = Math.round(seconds * rate),
    over = Math.round(0.5 * rate);
  const dice = mulberry32(seed);
  const drips = new Float64Array(n + over);
  for (let time = dice(); time < seconds; time += -Math.log(1 - dice()) / 0.7) {
    addBubble(drips, rate, {
      at: time,
      freq: between(dice, 700, 1800),
      tau: between(dice, 0.02, 0.04),
      amp: between(dice, 0.15, 0.3),
      rise: 0.3,
    });
  }
  for (let i = 0; i < over; i++) drips[i] += drips[n + i];
  return toPcm(rmsTo(drips.subarray(0, n), rmsDb));
}

/** The loop, made at once. @param {Parameters<typeof rainSteps>[0]} [options] */
export function rainLoop(options) {
  const steps = rainSteps(options);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/** The loop, made a step a task (dsp.js inTurn), so the page never waits on all of it at once. @param {Parameters<typeof rainSteps>[0]} [options] */
export async function rainLoopInTurns(options) {
  const steps = rainSteps(options);
  for (;;) {
    const step = await inTurn(() => steps.next());
    if (step.done) return step.value;
  }
}
