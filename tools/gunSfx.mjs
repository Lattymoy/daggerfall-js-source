// THE GUN LAB'S SOUNDS, SYNTHESISED AND BAKED (2026-09-19).
//
// Mac asked for shooting and reloading sounds that match the
// Daggerfall aesthetic, off Freesound. This session's egress policy
// blocks freesound.org outright (403 on CONNECT), so these are OURS:
// built here, from noise and sine, and put through the same pipe a
// Freesound pick would go through - tools/sndify.mjs, down to
// DAGGER.SND's own 11025 Hz unsigned 8-bit mono.
//
// THAT BAKE IS THE AESTHETIC. Daggerfall's effects are not "old
// sounding" by accident; they are 11kHz and 8 bits, and the
// quantisation grit and the missing top octave are what the ear reads
// as this game. A modern 48kHz shotgun sample sits on top of that
// world rather than in it. Everything below is designed knowing it
// ends there: nothing lives above 5kHz that matters, the transients
// are shaped to survive decimation, and the tails are short enough
// that 8-bit noise never gets a quiet passage to hiss in.
//
// It is also why these hold up as more than placeholders: run
// tools/freesoundPick.mjs when the host is reachable, bake the pick
// with tools/sndify.mjs, drop it on the same filename, and the lab
// does not know the difference.
//
// THE SOUNDS. A big brass-and-iron break-action in a world of stone
// corridors, not a modern tactical 12-gauge:
//
//   gun-fire          a black-powder BOOM - a crack off the top, a
//                     body that falls from 3kHz to 400Hz as the gas
//                     leaves, a 60Hz thump for the chest, and a
//                     stone-room tail with two early reflections.
//   gun-reload-open   the break: a hard mechanical clack, a wooden
//                     knock under it, and the spent shell tumbling.
//   gun-reload-close  the shell home and the lock-up - heavier, lower,
//                     and final, because it is the sound that says the
//                     weapon is ready.
//
//     node tools/gunSfx.mjs            # writes public/sfx/*.wav
//     node tools/gunSfx.mjs --raw=dir  # also the 44.1kHz float source
//
// DETERMINISTIC: the noise is a seeded PRNG, so re-running writes the
// same bytes - the rule public/README.md sets for the drawn icons
// ("re-run the script and the same bytes come out") applies to
// anything of ours that ships.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8, DF_RATE } from './sndify.mjs';

const RATE = 44100;   // synthesise high, bake down - the bake owns the aliasing
const OUT = 'public/sfx';

// ---- the toolkit -----------------------------------------------------
/** mulberry32 - a seeded PRNG, so a re-run is byte-identical. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seconds = (s) => Math.round(s * RATE);
const buf = (s) => new Float32Array(seconds(s));

/** Exponential decay, the shape every percussive envelope wants. */
const decay = (i, tau) => Math.exp(-i / (tau * RATE));
/** A short attack so a transient does not start on a vertical edge -
 *  a step is a click, and a click survives the bake louder than the
 *  sound it belongs to. */
const attack = (i, ms) => Math.min(1, i / Math.max(1, seconds(ms / 1000)));

/** RBJ biquad, the two shapes used here. */
function biquad(x, { type, f0, q }) {
  const w = 2 * Math.PI * f0 / RATE, cw = Math.cos(w), sw = Math.sin(w);
  const alpha = sw / (2 * q);
  let b0, b1, b2;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; }
  else { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }   // lowpass
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 / a0) * x[i] + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** A one-pole lowpass whose cutoff MOVES - the sound of a pressure
 *  wave losing its top as it leaves the barrel. A fixed filter gives a
 *  flat "pff"; the sweep is what makes it a gunshot. */
function sweepLowpass(x, fromHz, toHz, tau) {
  const out = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const f = toHz + (fromHz - toHz) * decay(i, tau);
    const a = Math.exp(-2 * Math.PI * f / RATE);
    y = (1 - a) * x[i] + a * y;
    out[i] = y;
  }
  return out;
}

const noise = (len, rand) => {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = rand() * 2 - 1;
  return out;
};

/** dst += src * gain, starting at `at` seconds. */
function mix(dst, src, at = 0, gain = 1) {
  const o = seconds(at);
  for (let i = 0; i < src.length; i++) {
    const j = o + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * gain;
  }
  return dst;
}

/** tanh saturation: the grit a loud sound has, and a limiter that
 *  cannot overshoot into the 8-bit rail. */
const softClip = (x, drive = 1) => x.map((v) => Math.tanh(v * drive) / Math.tanh(drive));

const envelope = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i); return x; };

// ---- the shot --------------------------------------------------------
function fire() {
  const rand = rng(0x5ca1ab1e);
  const out = buf(0.62);

  // the CRACK: the muzzle report's top end, gone in 20ms
  const crack = biquad(noise(seconds(0.05), rand), { type: 'bandpass', f0: 2400, q: 0.7 });
  envelope(crack, (i) => attack(i, 0.4) * decay(i, 0.008));
  mix(out, crack, 0, 1.0);

  // the BODY: the gas leaving, falling 3kHz -> 380Hz
  const body = sweepLowpass(noise(seconds(0.34), rand), 3000, 380, 0.05);
  envelope(body, (i) => attack(i, 1.2) * decay(i, 0.07));
  mix(out, body, 0.002, 1.5);

  // the THUMP: a 110 -> 52Hz sweep, the chest of it
  const thump = buf(0.2);
  let phase = 0;
  for (let i = 0; i < thump.length; i++) {
    const f = 52 + (110 - 52) * decay(i, 0.035);
    phase += 2 * Math.PI * f / RATE;
    thump[i] = Math.sin(phase) * attack(i, 1) * decay(i, 0.065);
  }
  mix(out, thump, 0, 0.85);

  // the ROOM: a stone corridor - a long soft tail and two early
  // reflections, which is what stops it sounding like it went off in a
  // field
  const tail = biquad(noise(seconds(0.6), rand), { type: 'lowpass', f0: 900, q: 0.7 });
  envelope(tail, (i) => attack(i, 6) * decay(i, 0.16));
  mix(out, tail, 0.01, 0.34);
  mix(out, tail, 0.055, 0.17);
  mix(out, tail, 0.098, 0.10);

  return softClip(out, 1.9);
}

// ---- the mechanism ---------------------------------------------------
/** One clack: a metal edge (bandpassed noise, gone in ~10ms) over a
 *  wooden knock (a low sine with a body). Both, or it is a tick. */
function clack(rand, { metal = 2600, wood = 210, tau = 0.009, woodTau = 0.03, len = 0.16 } = {}) {
  const out = buf(len);
  const edge = biquad(noise(seconds(len), rand), { type: 'bandpass', f0: metal, q: 1.1 });
  envelope(edge, (i) => attack(i, 0.3) * decay(i, tau));
  mix(out, edge, 0, 1);
  const knock = buf(len);
  for (let i = 0; i < knock.length; i++) {
    knock[i] = Math.sin(2 * Math.PI * wood * i / RATE) * attack(i, 0.5) * decay(i, woodTau);
  }
  mix(out, knock, 0, 0.55);
  return out;
}

/** The spent shell, tumbling: three small high ticks, unevenly spaced,
 *  each quieter than the last. Even spacing reads as a machine. */
function shellRattle(rand, at, out, gain) {
  const offs = [0, 0.043, 0.092], gains = [1, 0.62, 0.38];
  for (let k = 0; k < offs.length; k++) {
    const tick = biquad(noise(seconds(0.05), rand), { type: 'bandpass', f0: 3300 + k * 400, q: 1.6 });
    envelope(tick, (i) => attack(i, 0.2) * decay(i, 0.004));
    mix(out, tick, at + offs[k], gain * gains[k]);
  }
}

function reloadOpen() {
  const rand = rng(0x09e17a);
  const out = buf(0.42);
  mix(out, clack(rand, { metal: 2900, wood: 240, tau: 0.008, woodTau: 0.028 }), 0, 1);
  shellRattle(rand, 0.13, out, 0.4);
  return softClip(out, 1.5);
}

function reloadClose() {
  const rand = rng(0xc105e);
  const out = buf(0.4);
  // the shell going home: a soft push before the lock-up
  const push = biquad(noise(seconds(0.09), rand), { type: 'bandpass', f0: 1400, q: 0.8 });
  envelope(push, (i) => attack(i, 2) * decay(i, 0.022));
  mix(out, push, 0, 0.5);
  // and the breech closing - lower, heavier, final
  mix(out, clack(rand, { metal: 1900, wood: 140, tau: 0.012, woodTau: 0.05, len: 0.28 }), 0.075, 1.15);
  return softClip(out, 1.6);
}

// ---- write -----------------------------------------------------------
// `-synth` in the name on purpose: these sit in the lab's dropdown
// BESIDE the Freesound picks (tools/gunSfxInstall.mjs), as the option
// that is ours outright - nothing to attribute, nothing to re-license,
// and it still exists if a picked recording ever has to come out.
const CLIPS = [
  ['gun-fire-synth', fire, 0.92],
  ['gun-reload-open-synth', reloadOpen, 0.80],
  ['gun-reload-close-synth', reloadClose, 0.86],
];

const rawDir = process.argv.find((a) => a.startsWith('--raw='))?.split('=')[1] ?? null;
mkdirSync(OUT, { recursive: true });
if (rawDir) mkdirSync(rawDir, { recursive: true });

for (const [name, make, peak] of CLIPS) {
  const mono = make();
  const pcm = bake(mono, RATE, { peak });
  writeFileSync(join(OUT, `${name}.wav`), writeWav8(pcm));
  if (rawDir) {
    // the pre-bake source, 8-bit at 44.1k, for hearing what the bake
    // actually does rather than taking it on trust
    writeFileSync(join(rawDir, `${name}-44k.wav`), writeWav8(bakeRaw(mono), RATE));
  }
  console.log(`${name}.wav  ${DF_RATE}Hz 8-bit mono  ${pcm.length} samples  ${(pcm.length / DF_RATE).toFixed(3)}s  ${(44 + pcm.length)} bytes`);
}

function bakeRaw(mono) {
  let max = 0;
  for (const v of mono) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? 0.92 / max : 1;
  const out = new Uint8Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(Math.max(-1, Math.min(1, mono[i] * g)) * 127 + 128)));
  }
  return out;
}
