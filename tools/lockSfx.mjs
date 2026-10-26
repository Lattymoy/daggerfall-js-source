// THE LOCK'S SOUNDS, SYNTHESISED AND BAKED (LOCKPICK, 2026-10-26, the owner: "I want to build a detailed lock picking
// minigame and introduce a lockpick item" - bible/06-Systems/Lockpicking.md).
//
// OURS, the gathering's way (tools/gatherSfx.mjs): built here from noise and sine with the shared kit (tools/sfxSynth.mjs)
// and put through the one bake - tools/sndify.mjs, down to DAGGER.SND's own 11025 Hz unsigned 8-bit mono. DAGGER.SND has
// one lock sound, the picked lock's chime (ActivateLockUnlock, 316), which the world still plays as the lock opens; the
// tumblers' small sounds are these seven:
//
//   lock-tick-1/-2   the pick lifting a pin: a tiny steel tick on brass, a pin's short ring
//   lock-spring      a FREE pin: it springs straight back - a light ting and the spring's short buzz
//   lock-set         a pin SET at the shear line: a crisp click, the plug giving a hair
//   lock-false       a spool's FALSE SET: a dull clunk, the plug turning back against the tension
//   lock-slip        the pick slipping off a pin: a thin steel scrape
//   lock-snap        the pick snapping: a sharp crack, and the broken tip ringing as it falls
//
//     node tools/lockSfx.mjs             # writes public/sfx/lock-*.wav
//     node tools/lockSfx.mjs --measure   # and prints each clip's attack, crest, tail and brightness (tools/sfxBake.mjs)
//
// DETERMINISTIC: every noise is a seeded PRNG (each clip its own seed), so re-running writes the same bytes - the rule
// public/README.md sets for anything of ours that ships. Provenance: public/sfx/SOURCES.md; the doctrine allow-list
// (test/tooling/doctrine.test.js) carries a row for each.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8, DF_RATE } from './sndify.mjs';
import { RATE, rng, buf, mix, softClip, unit, knock, modes, burst, rub, grit } from './sfxSynth.mjs';
import { isMain } from './lib/isMain.mjs';

const OUT = 'public/sfx';

/** The pick lifting a pin: a tiny steel tick on brass, the pin's short ring. */
function tick(seed, { ring = [2350, 3420], click = 3800 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.14);
    mix(out, burst(rand, { f0: click, q: 1.6, tau: 0.0007 }), 0, 0.9);
    mix(out, unit(modes(0.12, [[ring[0], 0.012, 1], [ring[1], 0.008, 0.5]])), 0.0004, 0.45);
    return softClip(out, 1.2);
  };
}

/** A free pin: a light ting, and the spring's short buzz as it throws the pin back. */
function spring() {
  const rand = rng(0x5b21e6);
  const out = buf(0.22);
  mix(out, burst(rand, { f0: 4200, q: 1.8, tau: 0.0006 }), 0, 0.7);
  mix(out, unit(modes(0.2, [[2900, 0.02, 1], [4100, 0.012, 0.4]])), 0.0003, 0.5);
  mix(out, rub(rand, 0.09, { f0: 1700, q: 2.2, hz: 210, inMs: 2, tau: 0.025, depth: 0.9 }), 0.012, 0.35);
  return softClip(out, 1.25);
}

/** A pin set at the shear line: a crisp click, the plug giving a hair. */
function set() {
  const rand = rng(0x5e7c11c);
  const out = buf(0.2);
  mix(out, burst(rand, { f0: 3100, q: 1.2, tau: 0.0009 }), 0, 1);
  mix(out, unit(modes(0.15, [[1720, 0.018, 1], [2680, 0.011, 0.55], [3900, 0.006, 0.3]])), 0.0003, 0.6);
  mix(out, unit(knock(0.06, 420, 300, 0.006, 0.014, 0.3)), 0.001, 0.35);
  return softClip(out, 1.3);
}

/** A spool's false set: a dull clunk, and the plug turning back against the tension. */
function falseSet() {
  const rand = rng(0xfa15e5);
  const out = buf(0.32);
  mix(out, unit(knock(0.16, 260, 170, 0.012, 0.04, 0.5)), 0, 0.85);
  mix(out, burst(rand, { f0: 1500, q: 0.9, tau: 0.0018 }), 0, 0.5);
  mix(out, rub(rand, 0.16, { f0: 1200, q: 1.4, hz: 90, inMs: 8, tau: 0.05, depth: 0.8 }), 0.06, 0.35);
  mix(out, unit(modes(0.1, [[1350, 0.01, 1], [2100, 0.007, 0.4]])), 0.2, 0.3);
  return softClip(out, 1.35);
}

/** The pick slipping off a pin: a thin steel scrape. */
function slip() {
  const rand = rng(0x5119);
  const out = buf(0.24);
  mix(out, rub(rand, 0.2, { f0: 3300, q: 2.4, hz: 340, inMs: 3, tau: 0.06, depth: 0.95 }), 0, 0.8);
  grit(out, rand, { count: 10, from: 0.005, to: 0.16, lo: 3000, hi: 4600, gain: 0.25 });
  mix(out, unit(modes(0.1, [[2480, 0.01, 1]])), 0.15, 0.25);
  return softClip(out, 1.3);
}

/** The pick snapping: a sharp crack, and the broken tip ringing as it falls and lands. */
function snap() {
  const rand = rng(0x5a4b);
  const out = buf(0.6);
  mix(out, burst(rand, { f0: 3600, q: 0.7, tau: 0.0012 }), 0, 1);
  mix(out, unit(modes(0.3, [[2200, 0.05, 1], [3300, 0.03, 0.6], [4400, 0.02, 0.3]])), 0.0004, 0.6);
  mix(out, unit(modes(0.2, [[3050, 0.025, 1], [4250, 0.015, 0.5]])), 0.33, 0.45);
  mix(out, unit(modes(0.15, [[2800, 0.018, 1]])), 0.41, 0.25);
  return softClip(out, 1.35);
}

// ---- write ----------------------------------------------------------
/** [name, make, the bake's peak] - every clip, in the header's order. */
export const CLIPS = [
  ['lock-tick-1', tick(0x71c401), 0.78],
  ['lock-tick-2', tick(0x71c402, { ring: [2180, 3260], click: 3500 }), 0.78],
  ['lock-spring', spring, 0.76],
  ['lock-set', set, 0.84],
  ['lock-false', falseSet, 0.82],
  ['lock-slip', slip, 0.78],
  ['lock-snap', snap, 0.86],
];

if (isMain(import.meta.url)) {
  const measuring = process.argv.includes('--measure');
  const { measure, measureLine } = measuring ? await import('./sfxBake.mjs') : {};   // the audition bench's four numbers
  mkdirSync(OUT, { recursive: true });
  for (const [name, make, peak] of CLIPS) {
    const pcm = bake(make(), RATE, { peak });
    writeFileSync(join(OUT, `${name}.wav`), writeWav8(pcm));
    if (measuring) console.log(measureLine(`${name}.wav`, measure(pcm)));
    else console.log(`${name}.wav  ${DF_RATE}Hz 8-bit mono  ${pcm.length} samples  ${(pcm.length / DF_RATE).toFixed(3)}s  ${(44 + pcm.length)} bytes`);
  }
}
