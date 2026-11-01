// @ts-check
// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): COME SAIL AWAY'S FIVE CLIPS, OURS,
// made as PCM from synth.js on fixed seeds - the five ComeSailAway.Start loads (comeSailAwayBoat.js AUDIO_CLIPS): the
// boat at rest (water lapping, a slap, a creak), under way (the rush, the spray, the canvas's thump), and a stroke's
// catch, pull and lift that the rowing clips' events play (comeSailAway.js OarEvent_In/Sweep/Out). Each keeps its
// clip's rate, the strokes their lengths; the loops are seamless. Made once, at the first boat heard. Not a DFU member.
import * as synth from './synth.js';
import { loudnessTo } from '../../../audio/synth/dsp.js';

/** Each clip's rate and length in samples (the strokes' Come Sail Away 2.1's own; the loops ours, seamless). A loop is a
 *  minute: at 20 s its slaps and creaks came round again three times a minute (the mod's ran 182 and 202 s). */
export const CSA_CLIP_FORMAT = Object.freeze({
  SmallShipAmbience: Object.freeze({ rate: 32000, samples: 32000 * 60 }),
  ShipExteriorAmbience2: Object.freeze({ rate: 44100, samples: 44100 * 60 }),
  Oars_In: Object.freeze({ rate: 22050, samples: 131982 }),
  Oars_Sweep: Object.freeze({ rate: 22050, samples: 122865 }),
  Oars_Out: Object.freeze({ rate: 22050, samples: 134314 }),
});

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

/** How loud each is made. A loop by its RMS, at the mod's own loops' -24 dBFS at the helm (bible/08-Audio/Audio.md
 *  SEA-AIR, AUDIT SOUNDSCAPE S6: the sea's beds were set under that); a stroke by its loudness (dsp.js loudnessOf) near
 *  DAGGER.SND's large splash heard at 0.7 (-15.5). */
export const CSA_CLIP_LEVEL = Object.freeze({ loopRmsDb: -24, strokeLoudness: -17 });

/** `pcm` scaled so its RMS stands at `db` dBFS (in place). @param {Float32Array} pcm @param {number} db */
function rmsTo(pcm, db) {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  const k = sum > 0 ? 10 ** (db / 20) / Math.sqrt(sum / pcm.length) : 0;
  for (let i = 0; i < pcm.length; i++) pcm[i] *= k;
  return pcm;
}
const loopLevel = (/** @type {Float32Array} */ pcm) => rmsTo(pcm, CSA_CLIP_LEVEL.loopRmsDb);
const strokeLevel = (/** @type {Float32Array} */ pcm, /** @type {number} */ rate) =>
  loudnessTo(pcm, rate, CSA_CLIP_LEVEL.strokeLoudness);

/** The boat at rest, a pass at a time (each `yield` a place the page may take a turn). */
function* smallShip({ rate, samples }) {
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
  yield;
  const die = synth.seededDie(0xc5a2);
  let made = 0;
  for (let time = 0.6; time < count / rate - 0.6; time += 1.4 + die() * 1.8) {
    splashInto(water, rate, {
      at: time,
      hertz: 380 + die() * 380,
      quality: 0.9,
      decay: 0.18 + die() * 0.12,
      gain: 0.5 + die() * 0.5,
      seed: 0xc5b0 + Math.round(time * 10),
    });
    if (++made % 5 === 0) yield;
  }
  yield;
  for (let time = 2.2; time < count / rate - 1.5; time += 4.5 + die() * 4) {
    const groan = synth.creak(rate, {
      length: 0.45 + die() * 0.5,
      fromHz: 65 + die() * 40,
      toHz: 95 + die() * 60,
      body: 300 + die() * 300,
      quality: 5,
      seed: Math.round(time * 100),
    });
    synth.mixInto(water, groan, Math.round(time * rate), 0.35 + die() * 0.3);
    if (++made % 5 === 0) yield;
  }
  yield;
  synth.onePoleHighpass(water, rate, 40);
  yield;
  return loopLevel(synth.seamless(water, rate, samples, 1));
}

/** The boat under way, a pass at a time. */
function* exterior({ rate, samples }) {
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
  const die = synth.seededDie(0xe7a3);
  let made = 0;
  for (let time = 1.5; time < count / rate - 1; time += 3 + die() * 3) {
    const thump = synth.strikeEnvelope(
      synth.onePoleLowpass(synth.whiteNoise(Math.round(0.4 * rate), Math.round(time * 1000)), rate, 180),
      rate,
      { attack: 0.01, decay: 0.09, gain: 1.6 },
    );
    synth.mixInto(rush, thump, Math.round(time * rate));
    if (++made % 5 === 0) yield;
  }
  for (let time = 3.1; time < count / rate - 1.5; time += 6 + die() * 4) {
    const groan = synth.creak(rate, {
      length: 0.5 + die() * 0.4,
      fromHz: 70 + die() * 30,
      toHz: 110 + die() * 50,
      body: 360 + die() * 220,
      quality: 5,
      seed: Math.round(time * 77),
    });
    synth.mixInto(rush, groan, Math.round(time * rate), 0.3);
    if (++made % 5 === 0) yield;
  }
  yield;
  return loopLevel(synth.seamless(rush, rate, samples, 1));
}

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

/** @typedef {{ rate: number, samples: number }} Format */
/** A clip made in one pass, after a turn. @param {(fmt: Format) => Float32Array} make */
const onePass = (make) =>
  /** @param {Format} fmt */
  function* (fmt) {
    yield;
    return make(fmt);
  };
/** Each clip as passes. @type {Record<string, (fmt: Format) => Generator<undefined, Float32Array>>} */
const MAKE = Object.freeze({
  SmallShipAmbience: smallShip,
  ShipExteriorAmbience2: exterior,
  Oars_In: onePass(oarsIn),
  Oars_Sweep: onePass(oarsSweep),
  Oars_Out: onePass(oarsOut),
});
const _made = new Map();
/** The clip's passes, run to the end: its PCM. @param {Generator<undefined, Float32Array>} passes */
function finish(passes) {
  for (;;) {
    const pass = passes.next();
    if (pass.done) return pass.value;
  }
}
/** A clip's PCM (mono) and its rate, made once; null for a name that is none of the five. */
export function csaClip(name) {
  const fmt = CSA_CLIP_FORMAT[name];
  if (!fmt) return null;
  if (!_made.has(name)) _made.set(name, { samples: finish(MAKE[name](fmt)), rate: fmt.rate });
  return _made.get(name);
}
/** The same clip made a pass a task (a minute's loop is 60 to 200 ms of work); made once, as csaClip. */
async function csaClipInTurns(name) {
  const fmt = CSA_CLIP_FORMAT[name];
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
 * The five made and handed to `register(name, clip)` (the bus's registerSamples), one a task so no frame holds them
 * all; resolves once all stand, rejects when one is refused (no audio context yet: the next ask tries again).
 * @param {(name: string, clip: { samples: Float32Array, rate: number }) => boolean} register
 * @param {readonly string[]} names
 */
export function registerCsaClips(register, names) {
  return names.reduce(
    (chain, name) =>
      chain.then(async () => {
        const clip = await csaClipInTurns(name);
        if (!clip || !register(name, clip)) throw new Error(`${name}: refused`);
      }),
    Promise.resolve(),
  );
}
