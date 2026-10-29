// THE EFFECTS' SOUNDS, SYNTHESISED AND BAKED (STOREFRONT, 2026-10-29; bible/06-Systems/Storefront.md sections 4 and 5).
//
// OURS, the lock's way (tools/lockSfx.mjs): built from noise and sine with the shared kit (tools/sfxSynth.mjs) and put
// through the one bake - tools/sndify.mjs, down to DAGGER.SND's own 11025 Hz unsigned 8-bit mono. DAGGER.SND has no
// body turning to ash, no gate of stone or brass opening and no earthquake; these ten are the kill effects', the portal
// skins' and the season's (scenes/seasonHost.js):
//
//   fx-kill-ashen      a breath of ash: a soft rush falling away, embers ticking as they cool
//   fx-kill-voidrend   the void tearing: a swell drawn in, a hollow thump, a low beating ring
//   fx-kill-pyre       a body taking fire: the whoomph, the crackle, the roar dying down
//   fx-kill-tonal      a Dwemer resonance breaking: a struck brass chord, cogs scattering, a hiss of steam
//   fx-portal-runic    the runic stone: a cold chime and its shimmer, a breath of frost
//   fx-portal-daedric  the daedric stone: a deep rumble and iron grinding, a rush of fire
//   fx-portal-aetheric the aetheric stone: a rising run of bell notes over a swell
//   fx-portal-brass    the brass gate: a blast of steam, the cogs clanking home, a tonal hum
//   fx-season-tremor   the season's tremor: a deep roll of the ground, stones rattling, brass grinding far below
//   fx-season-hum      a Brass Fissure: steam hissing from the crack over a low brass hum that beats
//
//     node tools/storefrontSfx.mjs             # writes public/sfx/fx-*.wav
//     node tools/storefrontSfx.mjs --measure   # and prints each clip's attack, crest, tail and brightness
//
// DETERMINISTIC: every noise is a seeded PRNG, so a re-run writes the same bytes (public/README.md). Provenance:
// public/sfx/SOURCES.md; the doctrine allow-list (test/tooling/doctrine.test.js) carries a row for each.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8, DF_RATE } from './sndify.mjs';
import { RATE, rng, seconds, buf, decay, attack, biquad, sweepLowpass, noise, mix, softClip, envelope, unit, knock, rough, rub, grit, modes, burst, groan, bellNote } from './sfxSynth.mjs';
import { isMain } from './lib/isMain.mjs';

const OUT = 'public/sfx';

/** Noise through a lowpass whose top falls from `from` to `to` Hz - a rush of air, `len` s, swelling in over `inMs`. */
function rush(rand, len, { from, to, tau, inMs = 20, fall = tau }) {
  const x = noise(seconds(len), rand);
  envelope(x, (i) => attack(i, inMs) * decay(i, fall));
  return unit(sweepLowpass(x, from, to, tau));
}

/** A swell drawn IN: noise whose loudness and top both climb to the end of `len` s - a breath taken before a blow. */
function swellIn(rand, len, { lo = 300, hi = 2600 }) {
  const n = seconds(len);
  const x = noise(n, rand);
  const out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, f = lo + (hi - lo) * u * u;
    const a = Math.exp(-2 * Math.PI * f / RATE);
    y = (1 - a) * x[i] + a * y;
    out[i] = y * u * u * u * Math.min(1, (n - i) / seconds(0.006));
  }
  return unit(out);
}

/** Fire's crackle: short bright pops at uneven times through a span, thinning as it goes. */
function crackle(out, rand, { count, from, to, gain }) {
  return grit(out, rand, { count, from, to, lo: 1400, hi: 4200, tauLo: 0.0008, tauHi: 0.003, gain, q: 1.2 });
}

/** A beating ring: two sines a few Hz apart, so the note throbs - the void's hollow, a gate's hum. */
function beat(len, f, apart, tau, inMs = 30) {
  const out = buf(len);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    out[i] = (Math.sin(2 * Math.PI * f * t) + 0.8 * Math.sin(2 * Math.PI * (f + apart) * t)) * attack(i, inMs) * decay(i, tau) * Math.min(1, (out.length - i) / seconds(0.02));
  }
  return unit(out);
}

/** ASHEN: a soft rush of ash falling away, and the embers ticking as they cool. */
function ashen() {
  const rand = rng(0xa54e11);
  const out = buf(1.3);
  mix(out, rush(rand, 1.1, { from: 2600, to: 260, tau: 0.35, inMs: 35, fall: 0.32 }), 0, 0.8);
  mix(out, rub(rand, 0.8, { f0: 900, q: 0.8, hz: 40, inMs: 60, tau: 0.3, depth: 0.7 }), 0.04, 0.35);
  grit(out, rand, { count: 22, from: 0.08, to: 1.15, lo: 2600, hi: 4400, tauLo: 0.0006, tauHi: 0.0018, gain: 0.22 });
  return softClip(out, 1.15);
}

/** VOIDREND: a swell drawn in, the tear - a hollow thump - and a low ring beating as it closes. */
function voidrend() {
  const rand = rng(0x701d4e);
  const out = buf(1.6);
  mix(out, swellIn(rand, 0.32, { lo: 200, hi: 2200 }), 0, 0.55);
  mix(out, unit(knock(0.5, 140, 52, 0.05, 0.16, 1.2)), 0.32, 1);
  mix(out, burst(rand, { f0: 700, q: 0.7, tau: 0.012 }), 0.32, 0.45);
  mix(out, beat(1.2, 98, 3.5, 0.45, 60), 0.34, 0.55);
  mix(out, beat(1.1, 147, 2.2, 0.32, 80), 0.36, 0.25);
  mix(out, rush(rand, 0.9, { from: 1200, to: 120, tau: 0.25, inMs: 20, fall: 0.3 }), 0.33, 0.3);
  return softClip(out, 1.3);
}

/** PYRE: the whoomph as a body takes fire, its crackle, and the roar dying down. */
function pyre() {
  const rand = rng(0x9f4e01);
  const out = buf(1.7);
  mix(out, rush(rand, 0.6, { from: 600, to: 3200, tau: 0.08, inMs: 12, fall: 0.2 }), 0, 0.6);
  mix(out, unit(knock(0.35, 110, 60, 0.04, 0.1, 3)), 0, 0.6);
  const roar = biquad(noise(seconds(1.6), rand), { type: 'bandpass', f0: 520, q: 0.6 });
  const r = rough(roar.length, rand, 14);
  envelope(roar, (i) => attack(i, 50) * decay(i, 0.55) * (0.6 + 0.4 * r[i]));
  mix(out, unit(roar), 0.03, 0.55);
  crackle(out, rand, { count: 40, from: 0.05, to: 1.55, gain: 0.32 });
  return softClip(out, 1.25);
}

/** TONAL: a Dwemer resonance breaking - a struck brass chord, cogs scattering and landing, a hiss of steam. */
function tonal() {
  const rand = rng(0x70a41);
  const out = buf(1.8);
  mix(out, burst(rand, { f0: 2800, q: 0.9, tau: 0.002 }), 0, 0.8);
  mix(out, unit(modes(1.5, [[523, 0.5, 1], [784, 0.42, 0.7], [1046, 0.3, 0.5], [1318, 0.25, 0.4], [2093, 0.12, 0.25], [3136, 0.06, 0.15]], { attackMs: 0.8 })), 0.001, 0.75);
  for (const [at, f] of [[0.18, 1760], [0.27, 2210], [0.33, 1490], [0.44, 2640], [0.52, 1980], [0.66, 2350], [0.8, 1700]]) {
    mix(out, unit(modes(0.12, [[f, 0.025, 1], [f * 1.48, 0.015, 0.45]])), at, 0.3 * (0.5 + 0.5 * rand()));
  }
  const hiss = biquad(noise(seconds(1.0), rand), { type: 'bandpass', f0: 3600, q: 0.8 });
  envelope(hiss, (i) => attack(i, 40) * decay(i, 0.25));
  mix(out, unit(hiss), 0.08, 0.3);
  return softClip(out, 1.2);
}

/** RUNIC: a cold chime and its shimmer over a breath of frost. */
function runic() {
  const rand = rng(0x2a41c);
  const out = buf(1.6);
  mix(out, rush(rand, 1.0, { from: 4400, to: 1600, tau: 0.4, inMs: 120, fall: 0.35 }), 0, 0.3);
  mix(out, bellNote(1318, 0.45, 1.3), 0.05, 0.6);
  mix(out, bellNote(1975, 0.32, 1.1), 0.14, 0.42);
  mix(out, bellNote(2637, 0.22, 0.9), 0.23, 0.3);
  grit(out, rand, { count: 18, from: 0.1, to: 1.2, lo: 3400, hi: 4700, tauLo: 0.0005, tauHi: 0.0012, gain: 0.14 });
  return softClip(out, 1.1);
}

/** DAEDRIC: the ground's deep rumble, iron grinding as the arch comes up, a rush of fire. */
function daedric() {
  const rand = rng(0xdae1c);
  const out = buf(2.0);
  const rumble = biquad(noise(seconds(1.8), rand), { type: 'lowpass', f0: 140, q: 0.9 });
  const r = rough(rumble.length, rand, 9);
  envelope(rumble, (i) => attack(i, 180) * decay(i, 0.7) * (0.55 + 0.45 * r[i]));
  mix(out, unit(rumble), 0, 1);
  mix(out, groan(rand, 0.9, { rate: (u) => 40 - 22 * u, bands: [[310, 4, 1], [620, 5, 0.5], [1240, 6, 0.25]], env: (u) => Math.sin(Math.PI * Math.min(1, u * 1.2)), noiseGain: 0.2 }), 0.15, 0.5);
  mix(out, rush(rand, 0.9, { from: 500, to: 2600, tau: 0.12, inMs: 30, fall: 0.3 }), 0.55, 0.45);
  crackle(out, rand, { count: 16, from: 0.6, to: 1.7, gain: 0.2 });
  mix(out, unit(knock(0.4, 90, 48, 0.06, 0.14, 2)), 0.55, 0.6);
  return softClip(out, 1.3);
}

/** AETHERIC: a rising run of bell notes as the crystals gather, over a swell that blooms when the ring closes. */
function aetheric() {
  const rand = rng(0xae7e1c);
  const out = buf(2.0);
  mix(out, swellIn(rand, 0.45, { lo: 600, hi: 3600 }), 0, 0.35);
  const run = [784, 988, 1175, 1568, 1976];
  run.forEach((f, k) => mix(out, bellNote(f, 0.3, 0.8), 0.06 + k * 0.075, 0.38 + 0.04 * k));
  mix(out, bellNote(2349, 0.5, 1.4), 0.45, 0.5);
  mix(out, beat(1.4, 392, 1.5, 0.55, 40), 0.44, 0.35);
  grit(out, rand, { count: 24, from: 0.45, to: 1.7, lo: 3000, hi: 4700, tauLo: 0.0005, tauHi: 0.0011, gain: 0.12 });
  return softClip(out, 1.1);
}

/** BRASS: a blast of steam, the cogs clanking home one by one, the gate's tonal hum. */
function brass() {
  const rand = rng(0xb4a55);
  const out = buf(1.8);
  const steam = biquad(noise(seconds(0.9), rand), { type: 'bandpass', f0: 3200, q: 0.6 });
  envelope(steam, (i) => attack(i, 6) * decay(i, 0.2));
  mix(out, unit(steam), 0, 0.7);
  for (const [at, f] of [[0.12, 620], [0.24, 540], [0.36, 700], [0.48, 480]]) {
    mix(out, unit(knock(0.12, f * 1.4, f, 0.004, 0.03, 0.4)), at, 0.5);
    mix(out, unit(modes(0.18, [[f * 2.7, 0.04, 1], [f * 4.1, 0.02, 0.4]])), at, 0.3);
  }
  mix(out, beat(1.2, 220, 2, 0.5, 120), 0.5, 0.45);
  mix(out, bellNote(880, 0.35, 0.9), 0.52, 0.3);
  return softClip(out, 1.2);
}

/** TREMOR: the ground rolling - a sub rumble swelling and dying, stones rattling in it, brass grinding far under. */
function tremor() {
  const rand = rng(0x7e4a0);
  const out = buf(2.1);
  const rumble = biquad(noise(seconds(2.0), rand), { type: 'lowpass', f0: 90, q: 0.8 });
  const r = rough(rumble.length, rand, 6);
  envelope(rumble, (i) => { const u = i / rumble.length; return Math.min(1, u * 4) * Math.pow(1 - u, 1.2) * (0.6 + 0.4 * r[i]); });
  mix(out, unit(rumble), 0, 1);
  grit(out, rand, { count: 34, from: 0.15, to: 1.6, lo: 900, hi: 2600, tauLo: 0.002, tauHi: 0.006, gain: 0.22 });
  mix(out, groan(rand, 1.4, { rate: (u) => 18 - 8 * u, bands: [[240, 3, 1], [480, 4, 0.4]], env: (u) => Math.sin(Math.PI * u), noiseGain: 0.3 }), 0.3, 0.32);
  return softClip(out, 1.35);
}

/** HUM: a fissure heard from beside it - steam hissing out of the crack over a low brass hum beating against itself. */
function hum() {
  const rand = rng(0x4e3a1);
  const out = buf(2.0);
  mix(out, beat(2.0, 110, 1.6, 2.5, 300), 0, 0.6);
  mix(out, beat(2.0, 165, 2.3, 2.5, 300), 0, 0.3);
  const hiss = biquad(noise(seconds(2.0), rand), { type: 'bandpass', f0: 3000, q: 0.7 });
  const r = rough(hiss.length, rand, 4);
  envelope(hiss, (i) => { const u = i / hiss.length; return Math.min(1, u * 5) * Math.min(1, (1 - u) * 5) * (0.5 + 0.5 * r[i]); });
  mix(out, unit(hiss), 0, 0.35);
  return softClip(out, 1.1);
}

// ---- write ----------------------------------------------------------
/** [name, make, the bake's peak] - every clip, in the header's order. */
export const CLIPS = [
  ['fx-kill-ashen', ashen, 0.78],
  ['fx-kill-voidrend', voidrend, 0.86],
  ['fx-kill-pyre', pyre, 0.84],
  ['fx-kill-tonal', tonal, 0.82],
  ['fx-portal-runic', runic, 0.76],
  ['fx-portal-daedric', daedric, 0.86],
  ['fx-portal-aetheric', aetheric, 0.78],
  ['fx-portal-brass', brass, 0.82],
  ['fx-season-tremor', tremor, 0.88],
  ['fx-season-hum', hum, 0.7],
];

/** One clip's bytes, as the shipped file holds them past its 44-byte header. */
export const bakeClip = (name) => {
  const [, make, peak] = /** @type {any} */ (CLIPS.find(([n]) => n === name));
  return bake(make(), RATE, { peak });
};

if (isMain(import.meta.url)) {
  const measuring = process.argv.includes('--measure');
  const { measure, measureLine } = measuring ? await import('./sfxBake.mjs') : {};
  mkdirSync(OUT, { recursive: true });
  for (const [name] of CLIPS) {
    const pcm = bakeClip(name);
    writeFileSync(join(OUT, `${name}.wav`), writeWav8(pcm));
    if (measuring) console.log(measureLine(`${name}.wav`, measure(pcm)));
    else console.log(`${name}.wav  ${DF_RATE}Hz 8-bit mono  ${pcm.length} samples  ${(pcm.length / DF_RATE).toFixed(3)}s  ${(44 + pcm.length)} bytes`);
  }
}
