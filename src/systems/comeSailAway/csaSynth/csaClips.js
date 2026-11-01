// @ts-check
// COME SAIL AWAY'S FIVE CLIPS, OURS, made as PCM from synth.js on fixed seeds - the five ComeSailAway.Start loads
// (comeSailAwayBoat.js AUDIO_CLIPS): the boat at rest (water lapping, a slap, a creak), under way (the rush, the spray,
// the canvas's thump), and a stroke's catch, pull and lift that the rowing clips' events play (comeSailAway.js
// OarEvent_In/Sweep/Out). Each keeps its clip's rate, the strokes their lengths; the loops are seamless. Made once, at
// the first boat heard. Not a DFU member.
import * as synth from './synth.js';
import { loudnessTo } from '../../../audio/synth/dsp.js';

/** Each clip's rate and length in samples: the strokes' Come Sail Away 2.1's own; a loop's its bed's (CSA_LAYERS). */
export const CSA_CLIP_FORMAT = Object.freeze({
  SmallShipAmbience: Object.freeze({ rate: 32000, samples: 32000 * 29 }),
  ShipExteriorAmbience2: Object.freeze({ rate: 44100, samples: 44100 * 31 }),
  Oars_In: Object.freeze({ rate: 22050, samples: 131982 }),
  Oars_Sweep: Object.freeze({ rate: 22050, samples: 122865 }),
  Oars_Out: Object.freeze({ rate: 22050, samples: 134314 }),
});

/** A LOOP IN LAYERS (audio/layeredLoop.js): the bed and each kind of event its own loop, each a whole number of
 *  seconds and no two sharing a factor, so the three come round together after 29 x 41 x 37 s (12 hours) at rest and
 *  31 x 43 x 47 s (17 hours) under way. One loop of 20 s let the slaps and creaks come round three times a minute; the
 *  mod's ran 182 and 202 s. The events lie under 4 kHz, so their layers are made at 16 and 11.025 kHz. */
export const CSA_LAYERS = Object.freeze({
  SmallShipAmbience: Object.freeze(['SmallShipAmbience', 'SmallShipAmbience/slaps', 'SmallShipAmbience/creaks']),
  ShipExteriorAmbience2: Object.freeze([
    'ShipExteriorAmbience2',
    'ShipExteriorAmbience2/thumps',
    'ShipExteriorAmbience2/creaks',
  ]),
});
/** The event layers' rates and lengths. */
export const CSA_LAYER_FORMAT = Object.freeze({
  'SmallShipAmbience/slaps': Object.freeze({ rate: 16000, samples: 16000 * 41 }),
  'SmallShipAmbience/creaks': Object.freeze({ rate: 11025, samples: 11025 * 37 }),
  'ShipExteriorAmbience2/thumps': Object.freeze({ rate: 11025, samples: 11025 * 43 }),
  'ShipExteriorAmbience2/creaks': Object.freeze({ rate: 11025, samples: 11025 * 47 }),
});
/** A clip's layers: a loop's three, a stroke itself. @param {string} name @returns {readonly string[]} */
export const csaLayersOf = (name) => /** @type {Record<string, readonly string[]>} */ (CSA_LAYERS)[name] ?? [name];

/** A splash: a burst of filtered noise, `hertz` its colour, at `at` s. */
function splashInto(out, rate, { at, hertz = 1200, quality = 0.8, decay = 0.12, gain = 1, seed }) {
  const count = Math.round((decay * 5 + 0.01) * rate);
  const burst = synth.strikeEnvelope(synth.bandpass(synth.whiteNoise(count, seed), rate, hertz, quality), rate, {
    attack: 0.003,
    decay,
    gain,
  });
  synth.mixInto(out, burst, Math.round(at * rate));
}
/** Drips: `count` plips spread from `from` to `to` s, each fainter than the last. */
function dripsInto(out, rate, { from, to, count, gain = 0.3, seed }) {
  const die = synth.seededDie(seed);
  for (let k = 0; k < count; k++) {
    const at = from + (to - from) * (k / count + die() / count);
    const drop = synth.plip(rate, { hertz: 900 + die() * 1400, decay: 0.012 + die() * 0.02, seed: seed + k });
    synth.mixInto(out, drop, Math.round(at * rate), gain * (1 - (0.7 * k) / count) * (0.5 + die() * 0.5));
  }
}

/** How loud each is made. A loop by its RMS, at the mod's own loops' -24 dBFS at the helm (
 *  SEA-AIR, AUDIT SOUNDSCAPE S6: the sea's beds were set under that); a stroke by its loudness (dsp.js loudnessOf) near
 *  DAGGER.SND's large splash heard at 0.7 (-15.5). */
export const CSA_CLIP_LEVEL = Object.freeze({ loopRmsDb: -24, strokeLoudness: -17 });
/** Each layer's share of its loop's power, in dB: the balance the one-loop mix had (the events 11 to 23 dB under). */
export const CSA_LAYER_SHARE_DB = Object.freeze({
  SmallShipAmbience: -0.5,
  'SmallShipAmbience/slaps': -10.8,
  'SmallShipAmbience/creaks': -14.8,
  ShipExteriorAmbience2: -0.1,
  'ShipExteriorAmbience2/thumps': -21.7,
  'ShipExteriorAmbience2/creaks': -23.3,
});

/** `pcm` scaled so its RMS stands at `db` dBFS (in place). @param {Float32Array} pcm @param {number} db */
function rmsTo(pcm, db) {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  const k = sum > 0 ? 10 ** (db / 20) / Math.sqrt(sum / pcm.length) : 0;
  for (let i = 0; i < pcm.length; i++) pcm[i] *= k;
  return pcm;
}
/** A layer at its share of the loop's level. @param {Float32Array} pcm @param {string} name */
const layerLevel = (pcm, name) =>
  rmsTo(pcm, CSA_CLIP_LEVEL.loopRmsDb + /** @type {Record<string, number>} */ (CSA_LAYER_SHARE_DB)[name]);
const strokeLevel = (/** @type {Float32Array} */ pcm, /** @type {number} */ rate) =>
  loudnessTo(pcm, rate, CSA_CLIP_LEVEL.strokeLoudness);

/** @typedef {{ rate: number, samples: number }} Format */

/** The water at rest, a pass at a time (each `yield` a place the page may take a turn): a crossfaded seam. */
function* smallShipBed({ rate, samples }) {
  const count = samples + rate;
  const water = synth.whiteNoise(count, 0xc5a1);
  yield;
  synth.onePoleLowpass(water, rate, 520);
  yield;
  synth.modulate(
    water,
    rate,
    (time) => 0.55 + 0.3 * Math.sin(2 * Math.PI * 0.11 * time) + 0.15 * Math.sin(2 * Math.PI * 0.29 * time + 1.3),
  );
  synth.onePoleHighpass(water, rate, 40);
  yield;
  return layerLevel(synth.seamless(water, rate, samples, 1), 'SmallShipAmbience');
}

/** The rush and spray under way. */
function* exteriorBed({ rate, samples }) {
  const count = samples + rate;
  const rush = synth.onePoleHighpass(synth.onePoleLowpass(synth.whiteNoise(count, 0xe7a1), rate, 1500), rate, 120);
  yield;
  const hiss = synth.onePoleLowpass(synth.onePoleHighpass(synth.whiteNoise(count, 0xe7a2), rate, 3000), rate, 7000);
  yield;
  synth.modulate(
    rush,
    rate,
    (time) => 0.65 + 0.25 * Math.sin(2 * Math.PI * 0.45 * time) + 0.1 * Math.sin(2 * Math.PI * 0.13 * time + 0.7),
  );
  synth.modulate(hiss, rate, (time) => 0.09 + 0.09 * Math.sin(2 * Math.PI * 0.45 * time + 2.1));
  synth.mixInto(rush, hiss);
  yield;
  return layerLevel(synth.seamless(rush, rate, samples, 1), 'ShipExteriorAmbience2');
}

/**
 * An event layer: `lay(out, rate, seconds)` puts its events (a pass every few) on a canvas two seconds past the loop,
 * and the overhang is folded onto the start - a tail that runs past the end sounds at the start, so it has no seam.
 * @param {string} name @param {(out: Float32Array, rate: number, seconds: number) => Generator<undefined, void>} lay
 */
const eventLayer = (name, lay) =>
  /** @param {Format} fmt */
  function* ({ rate, samples }) {
    const out = new Float32Array(samples + 2 * rate);
    yield* lay(out, rate, samples / rate);
    for (let i = samples; i < out.length; i++) out[i - samples] += out[i];
    return layerLevel(out.slice(0, samples), name);
  };

/** A creak at `time`, its timbre from the die. */
const creakAt = (out, rate, time, gain, shape) => synth.mixInto(out, synth.creak(rate, shape), Math.round(time * rate), gain);

/** @type {Record<string, (fmt: Format) => Generator<undefined, Float32Array>>} */
const LAYER_MAKE = {
  'SmallShipAmbience/slaps': eventLayer('SmallShipAmbience/slaps', function* (out, rate, seconds) {
    const die = synth.seededDie(0xc5a2);
    let made = 0;
    for (let time = 0.6; time < seconds; time += 1.4 + die() * 1.8) {
      splashInto(out, rate, {
        at: time,
        hertz: 380 + die() * 380,
        quality: 0.9,
        decay: 0.18 + die() * 0.12,
        gain: 0.5 + die() * 0.5,
        seed: 0xc5b0 + Math.round(time * 10),
      });
      if (++made % 5 === 0) yield;
    }
  }),
  'SmallShipAmbience/creaks': eventLayer('SmallShipAmbience/creaks', function* (out, rate, seconds) {
    const die = synth.seededDie(0xc5a4);
    for (let time = 2.2; time < seconds; time += 4.5 + die() * 4) {
      const shape = { length: 0.45 + die() * 0.5, fromHz: 65 + die() * 40, toHz: 95 + die() * 60, body: 300 + die() * 300 };
      creakAt(out, rate, time, 0.35 + die() * 0.3, { ...shape, quality: 5, seed: Math.round(time * 100) });
      yield;
    }
  }),
  'ShipExteriorAmbience2/thumps': eventLayer('ShipExteriorAmbience2/thumps', function* (out, rate, seconds) {
    const die = synth.seededDie(0xe7a3);
    let made = 0;
    for (let time = 1.5; time < seconds; time += 3 + die() * 3) {
      const thump = synth.strikeEnvelope(
        synth.onePoleLowpass(synth.whiteNoise(Math.round(0.4 * rate), Math.round(time * 1000)), rate, 180),
        rate,
        { attack: 0.01, decay: 0.09, gain: 1.6 },
      );
      synth.onePoleHighpass(thump, rate, 30); // the low-pass reaches down to 0 Hz: a DC offset without it
      synth.mixInto(out, thump, Math.round(time * rate));
      if (++made % 5 === 0) yield;
    }
  }),
  'ShipExteriorAmbience2/creaks': eventLayer('ShipExteriorAmbience2/creaks', function* (out, rate, seconds) {
    const die = synth.seededDie(0xe7a4);
    for (let time = 3.1; time < seconds; time += 6 + die() * 4) {
      const shape = { length: 0.5 + die() * 0.4, fromHz: 70 + die() * 30, toHz: 110 + die() * 50, body: 360 + die() * 220 };
      creakAt(out, rate, time, 0.3, { ...shape, quality: 5, seed: Math.round(time * 77) });
      yield;
    }
  }),
};

function oarsIn({ rate, samples }) {
  const out = new Float32Array(samples);
  splashInto(out, rate, { at: 0.02, hertz: 1300, quality: 0.7, decay: 0.11, gain: 1, seed: 0x01a1 });
  splashInto(out, rate, { at: 0.02, hertz: 260, quality: 1.4, decay: 0.07, gain: 0.8, seed: 0x01a2 });
  dripsInto(out, rate, { from: 0.18, to: 1.6, count: 9, gain: 0.25, seed: 0x01a3 });
  return strokeLevel(out, rate);
}
function oarsSweep({ rate, samples }) {
  const out = new Float32Array(samples);
  const count = Math.round(1.2 * rate);
  const swirl = synth.onePoleLowpass(
    synth.whiteNoise(count, 0x02a1),
    rate,
    (i) => 300 + 650 * Math.sin((Math.PI * i) / count),
  );
  synth.onePoleHighpass(swirl, rate, 60); // the low-pass reaches down to 0 Hz: a DC offset without it
  synth.strikeEnvelope(swirl, rate, { attack: 0.22, decay: 0.32, gain: 1 });
  synth.mixInto(out, swirl, Math.round(0.03 * rate));
  const knock = synth.strikeEnvelope(
    synth.bandpass(synth.whiteNoise(Math.round(0.2 * rate), 0x02a2), rate, 820, 5),
    rate,
    { attack: 0.002, decay: 0.025, gain: 2.5 },
  );
  synth.mixInto(out, knock, 0);
  return strokeLevel(out, rate);
}
function oarsOut({ rate, samples }) {
  const out = new Float32Array(samples);
  splashInto(out, rate, { at: 0.02, hertz: 1800, quality: 0.9, decay: 0.07, gain: 0.7, seed: 0x03a1 });
  dripsInto(out, rate, { from: 0.08, to: 2.6, count: 22, gain: 0.35, seed: 0x03a2 });
  return strokeLevel(out, rate);
}

/** A clip made in one pass, after a turn. @param {(fmt: Format) => Float32Array} make */
const onePass = (make) =>
  /** @param {Format} fmt */
  function* (fmt) {
    yield;
    return make(fmt);
  };
/** Each clip and layer as passes. @type {Record<string, (fmt: Format) => Generator<undefined, Float32Array>>} */
const MAKE = Object.freeze({
  SmallShipAmbience: smallShipBed,
  ShipExteriorAmbience2: exteriorBed,
  ...LAYER_MAKE,
  Oars_In: onePass(oarsIn),
  Oars_Sweep: onePass(oarsSweep),
  Oars_Out: onePass(oarsOut),
});
/** @param {string} name @returns {Format | undefined} */
const formatOf = (name) =>
  /** @type {Record<string, Format>} */ (CSA_CLIP_FORMAT)[name] ??
  /** @type {Record<string, Format>} */ (CSA_LAYER_FORMAT)[name];
const _made = new Map();
/** The clip's passes, run to the end: its PCM. @param {Generator<undefined, Float32Array>} passes */
function finish(passes) {
  for (;;) {
    const pass = passes.next();
    if (pass.done) return pass.value;
  }
}
/** A clip's or a layer's PCM (mono) and its rate, made once; null for a name that is none of them. */
export function csaClip(name) {
  const fmt = formatOf(name);
  if (!fmt) return null;
  if (!_made.has(name)) _made.set(name, { samples: finish(MAKE[name](fmt)), rate: fmt.rate });
  return _made.get(name);
}
/** The same clip made a pass a task (a loop's bed is 30 to 120 ms of work); made once, as csaClip. */
async function csaClipInTurns(name) {
  const fmt = formatOf(name);
  if (!fmt) return null;
  if (!_made.has(name)) {
    const passes = MAKE[name](fmt);
    let pass;
    do {
      await new Promise((resolve) => setTimeout(resolve, 0));
      pass = passes.next();
    } while (!pass.done);
    if (!_made.has(name)) _made.set(name, { samples: pass.value, rate: fmt.rate });
  }
  return _made.get(name);
}

/**
 * The five, each loop with its layers (csaLayersOf), made and handed to `register(name, clip)` (the bus's
 * registerSamples) a pass a task; resolves once all stand, rejects when one is refused (no audio context yet: the next
 * ask tries again).
 * @param {(name: string, clip: { samples: Float32Array, rate: number }) => boolean} register
 * @param {readonly string[]} names
 */
export function registerCsaClips(register, names) {
  return names
    .flatMap((name) => csaLayersOf(name))
    .reduce(
      (chain, name) =>
        chain.then(async () => {
          const clip = await csaClipInTurns(name);
          if (!clip || !register(name, clip)) throw new Error(`${name}: refused`);
        }),
      Promise.resolve(),
    );
}
