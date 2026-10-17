// THE CLIMB'S SOUNDS, SYNTHESISED AND BAKED (CLIMB4, 2026-10-01, Mac: "I reallty want go to go all in with the detai.
// Liike proer feel to climbing" - the Enhanced Climbing arc, bible/03-World/Parkour-Arc.md).
//
// OURS, the naval arc's way (tools/navalSfx.mjs): built here from noise and sine with the shared kit (tools/sfxSynth.mjs)
// and put through the one bake - tools/sndify.mjs, down to DAGGER.SND's own 11025 Hz unsigned 8-bit mono - so a hand on
// a lip sits IN Daggerfall's world: nothing above 5 kHz that matters, every transient shaped to survive the decimation.
// DAGGER.SND has a body falling, the hard-fall grunt and the stride; it has no hand on stone, no boot scrabbling up a
// wall, no body hauled over a sill and no grit coming away under the fingers - these eleven. The climber's own effort
// is the player's own voice (DAGGER.SND's attack grunts, scenes/hostCombat.js playerClimbStrain), and a foot coming
// down on a top is the stride's (systems/footsteps.js: the ground regained lands one step).
//
//   climb-grab-1/-2   a hand takes a stone lip: the palm's slap (skin on stone, 1.1-1.5 kHz), the fingers' knock under
//                     it (a 200 Hz body), the grip tightening (a short rough rub) and a little grit coming away
//   climb-catch       both hands catch a lip with the body's weight: two slaps a hand's beat apart, the body meeting the
//                     wall (a 120 -> 60 Hz thump and the clothes taking it), the boots scuffing for the face below, and
//                     the grit the catch shook loose pattering down
//   climb-step-1/-3   hand over hand: a lighter slap, a smaller knock, a breath of rub - three, so a climb's rhythm
//                     never repeats one sample (the runtime also lifts and drops each a little)
//   climb-scrape-1/-2 boots scrabbling for purchase: three scuffs on stone, each a rough rub through a leather band
//                     (650-900 Hz) with the grit's own band over it, the last ending in the toe's knock
//   climb-pull        the haul over a lip: the leathers stretching (a swelling rustle with a flutter in it), the body
//                     sliding over the stone edge (a low rough slide), a buckle's small clink, and a knee set down on top
//   climb-whoosh      a body through the air: wind through a band that sweeps up as it launches and down as it flies
//                     (350 -> 1100 -> 450 Hz), the clothes fluttering in it
//   climb-crumble     the grip failing: grit and pebbles coming away under the fingers - a dense crumble, then four
//                     pebbles ticking down the wall away from the ear (each bounce quieter and duller), and the sand's hiss
//
//     node tools/climbSfx.mjs            # writes public/sfx/climb-*.wav
//     node tools/climbSfx.mjs --raw=dir  # also the 44.1 kHz source
//
// DETERMINISTIC: every noise is a seeded PRNG (each clip its own seed), so re-running writes the same bytes - the rule
// public/README.md sets for anything of ours that ships. Provenance: public/sfx/SOURCES.md; the doctrine allow-list
// (test/tooling/doctrine.test.js) carries a row for each.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8, DF_RATE } from './sndify.mjs';
import { RATE, rng, seconds, buf, decay, attack, biquad, sweepLowpass, noise, mix, softClip, envelope, unit, knock, rough, bandSweep, rub, grit } from './sfxSynth.mjs';   // GATHER-FEEL: the climb's own pieces live in the kit now
import { isMain } from './lib/isMain.mjs';

const OUT = 'public/sfx';

// ---- the pieces -------------------------------------------------------

/** Skin meeting stone: a noise burst through the palm's band and a brighter tick of the fingertips over it. */
function slap(rand, { f0 = 1300, q = 0.9, tau = 0.006, tip = 2800, tipGain = 0.35 } = {}) {
  const len = tau * 10 + 0.01;
  const out = buf(len);
  const palm = biquad(noise(seconds(len), rand), { type: 'bandpass', f0, q });
  envelope(palm, (i) => attack(i, 0.3) * decay(i, tau));
  mix(out, unit(palm), 0, 1);
  const tips = biquad(noise(seconds(len), rand), { type: 'bandpass', f0: tip, q: 1.2 });
  envelope(tips, (i) => attack(i, 0.2) * decay(i, tau * 0.5));
  mix(out, unit(tips), 0, tipGain);
  return unit(out);
}

// ---- the clips ----------------------------------------------------------

/** A hand takes a stone lip. */
function grab(seed, { f0 = 1300, knockHz = 210 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.32);
    mix(out, slap(rand, { f0, tau: 0.0065 }), 0, 1);
    mix(out, knock(0.12, knockHz, knockHz * 0.68, 0.01, 0.028), 0.001, 0.28);
    mix(out, rub(rand, 0.14, { f0: 1750, q: 1.4, hz: 140, inMs: 8, tau: 0.035 }), 0.028, 0.4);
    grit(out, rand, { count: 7, from: 0.02, to: 0.24, gain: 0.35 });
    return softClip(out, 1.4);
  };
}

/** Both hands catch a lip with the body's weight. */
function catchLip() {
  const rand = rng(0xca7c41);
  const out = buf(0.8);
  mix(out, slap(rand, { f0: 1350, tau: 0.007 }), 0, 1);
  mix(out, slap(rand, { f0: 1120, tau: 0.008, tip: 2500 }), 0.022, 0.85);   // the second hand, a beat behind
  mix(out, knock(0.12, 220, 150, 0.01, 0.028), 0.001, 0.25);
  mix(out, knock(0.12, 190, 130, 0.01, 0.028), 0.023, 0.22);
  // the body meeting the wall, and the clothes taking it
  mix(out, knock(0.35, 120, 60, 0.02, 0.09, 2), 0.05, 0.55);
  const cloth = biquad(noise(seconds(0.15), rand), { type: 'lowpass', f0: 900, q: 0.7 });
  envelope(cloth, (i) => attack(i, 2) * decay(i, 0.03));
  mix(out, unit(cloth), 0.05, 0.4);
  // the boots scuffing for the face below
  mix(out, rub(rand, 0.24, { f0: 720, q: 0.8, hz: 90, inMs: 25, tau: 0.07 }), 0.09, 0.5);
  mix(out, rub(rand, 0.16, { f0: 2300, q: 1.4, hz: 160, inMs: 15, tau: 0.04 }), 0.1, 0.22);
  // the grit the catch shook loose, pattering down
  grit(out, rand, { count: 12, from: 0.06, to: 0.62, lo: 2000, hi: 4000, gain: 0.32 });
  return softClip(out, 1.6);
}

/** Hand over hand: a lighter slap, a smaller knock, a breath of rub. */
function step(seed, { f0 = 1600, knockHz = 260 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.2);
    mix(out, slap(rand, { f0, q: 1.1, tau: 0.0045, tipGain: 0.25 }), 0, 0.85);
    mix(out, knock(0.08, knockHz, knockHz * 0.7, 0.008, 0.018), 0.001, 0.18);
    mix(out, rub(rand, 0.06, { f0: 1900, q: 1.5, hz: 160, inMs: 5, tau: 0.018 }), 0.012, 0.3);
    grit(out, rand, { count: 3, from: 0.01, to: 0.14, gain: 0.25 });
    return softClip(out, 1.2);
  };
}

/** Boots scrabbling for purchase on stone. */
function scrape(seed, { band = 780 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.48);
    const scuffs = [[0, 0.09, 1], [0.11 + 0.02 * rand(), 0.11, 0.8], [0.25 + 0.02 * rand(), 0.08, 0.65]];
    for (const [at, len, g] of scuffs) {
      const f0 = band * (0.85 + 0.3 * rand());
      mix(out, rub(rand, len + 0.06, { f0, q: 0.8, hz: 85 + 40 * rand(), inMs: 8, tau: len * 0.45 }), at, g);
      mix(out, rub(rand, len + 0.04, { f0: 2400, q: 1.6, hz: 170, inMs: 6, tau: len * 0.3 }), at + 0.004, g * 0.35);
    }
    const last = scuffs[2][0] + scuffs[2][1];
    mix(out, knock(0.08, 160, 105, 0.008, 0.02), last, 0.25);   // the toe finds its hold
    grit(out, rand, { count: 5, from: 0.03, to: 0.42, gain: 0.22 });
    return softClip(out, 1.5);
  };
}

/** The haul over a lip. */
function pull() {
  const rand = rng(0x9011ed);
  const out = buf(0.85);
  // the leathers stretching: a swelling rustle with a flutter in it
  const n = seconds(0.48);
  const rustle = biquad(noise(n, rand), { type: 'bandpass', f0: 2400, q: 1.1 });
  const flutterPh = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    rustle[i] *= Math.min(1, t / 0.12) * Math.min(1, (0.48 - t) / 0.2) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 11 * t + flutterPh));
  }
  mix(out, unit(rustle), 0, 0.4);
  // the body sliding over the stone edge
  const slide = rub(rand, 0.4, { f0: 420, q: 1.0, hz: 70, inMs: 60, tau: 0.16 });
  mix(out, slide, 0.24, 0.8);
  mix(out, rub(rand, 0.3, { f0: 1500, q: 1.3, hz: 120, inMs: 40, tau: 0.08 }), 0.26, 0.3);
  // a buckle's small clink
  const clink = buf(0.06);
  for (let i = 0; i < clink.length; i++) {
    clink[i] = (Math.sin((2 * Math.PI * 2900 * i) / RATE) + 0.6 * Math.sin((2 * Math.PI * 4100 * i) / RATE)) * attack(i, 0.2) * decay(i, 0.012);
  }
  mix(out, unit(clink), 0.31, 0.16);
  // a knee set down on top
  mix(out, knock(0.12, 170, 110, 0.012, 0.025), 0.62, 0.35);
  mix(out, slap(rand, { f0: 900, q: 0.8, tau: 0.008, tipGain: 0.1 }), 0.62, 0.6);
  grit(out, rand, { count: 6, from: 0.3, to: 0.75, gain: 0.22 });
  return softClip(out, 1.5);
}

/** A body through the air. */
function whoosh() {
  const rand = rng(0x700511);
  const LEN = 0.58;
  const n = seconds(LEN);
  const out = buf(LEN);
  const air = bandSweep(noise(n, rand), (t) => (t < 0.18 ? 350 + (1100 - 350) * (t / 0.18) : 1100 - (1100 - 450) * Math.min(1, (t - 0.18) / (LEN - 0.18))), 1.4);
  const flutterPh = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const body = Math.pow(Math.sin(Math.PI * Math.min(1, t / LEN)), 1.6) * Math.min(1, t / 0.06);
    air[i] *= body * (0.78 + 0.22 * Math.sin(2 * Math.PI * 23 * t + flutterPh));
  }
  mix(out, unit(air), 0, 1);
  const low = biquad(noise(n, rand), { type: 'lowpass', f0: 260, q: 0.7 });
  for (let i = 0; i < n; i++) low[i] *= Math.pow(Math.sin(Math.PI * Math.min(1, i / n)), 2);
  mix(out, unit(low), 0, 0.3);
  return softClip(out, 1.3);
}

/** The grip failing: grit and pebbles coming away and ticking down the wall. */
function crumble() {
  const rand = rng(0xc2b1e);
  const LEN = 1.35;
  const out = buf(LEN);
  grit(out, rand, { count: 16, from: 0, to: 0.13, lo: 1800, hi: 4500, gain: 0.55 });
  // the pebbles, ticking down the wall away from the ear: each bounce quieter, the gaps lengthening as they fall
  const pebbles = buf(LEN);
  for (let p = 0; p < 4; p++) {
    let at = 0.04 + 0.08 * p + 0.05 * rand();
    let g = 0.7 - 0.1 * p;
    const f0 = 2300 + 1300 * rand();
    for (let b = 0; b < 4 + Math.floor(rand() * 2) && at < LEN - 0.05; b++) {
      const t = biquad(noise(seconds(0.03), rand), { type: 'bandpass', f0: f0 * (1 - 0.06 * b), q: 4 });
      envelope(t, (i) => attack(i, 0.1) * decay(i, 0.003));
      mix(pebbles, unit(t), at, g);
      at += 0.09 + 0.07 * b + 0.04 * rand();
      g *= 0.62;
    }
  }
  mix(out, sweepLowpass(pebbles, 5000, 1100, 0.5), 0, 1);
  // the sand's hiss
  const sand = biquad(noise(seconds(0.6), rand), { type: 'bandpass', f0: 3300, q: 0.7 });
  envelope(sand, (i) => attack(i, 6) * decay(i, 0.16));
  mix(out, unit(sand), 0.01, 0.16);
  return softClip(out, 1.3);
}

// ---- write ----------------------------------------------------------
export const CLIPS = [
  ['climb-grab-1', grab(0x96ab01), 0.86],
  ['climb-grab-2', grab(0x96ab02, { f0: 1120, knockHz: 190 }), 0.86],
  ['climb-catch', catchLip, 0.9],
  ['climb-step-1', step(0x57e901), 0.8],
  ['climb-step-2', step(0x57e902, { f0: 1450, knockHz: 240 }), 0.8],
  ['climb-step-3', step(0x57e903, { f0: 1750, knockHz: 280 }), 0.8],
  ['climb-scrape-1', scrape(0x5c4a01), 0.84],
  ['climb-scrape-2', scrape(0x5c4a02, { band: 680 }), 0.84],
  ['climb-pull', pull, 0.86],
  ['climb-whoosh', whoosh, 0.8],
  ['climb-crumble', crumble, 0.82],
];

function bakeRaw(mono) {
  let max = 0;
  for (const v of mono) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? 0.92 / max : 1;
  const out = new Uint8Array(mono.length);
  for (let i = 0; i < mono.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(Math.max(-1, Math.min(1, mono[i] * g)) * 127 + 128)));
  return out;
}

if (isMain(import.meta.url)) {
  const rawDir = process.argv.find((a) => a.startsWith('--raw='))?.split('=')[1] ?? null;
  mkdirSync(OUT, { recursive: true });
  if (rawDir) mkdirSync(rawDir, { recursive: true });
  for (const [name, make, peak] of CLIPS) {
    const mono = make();
    const pcm = bake(mono, RATE, { peak });
    writeFileSync(join(OUT, `${name}.wav`), writeWav8(pcm));
    if (rawDir) writeFileSync(join(rawDir, `${name}-44k.wav`), writeWav8(bakeRaw(mono), RATE));
    console.log(`${name}.wav  ${DF_RATE}Hz 8-bit mono  ${pcm.length} samples  ${(pcm.length / DF_RATE).toFixed(3)}s  ${(44 + pcm.length)} bytes`);
  }
}
