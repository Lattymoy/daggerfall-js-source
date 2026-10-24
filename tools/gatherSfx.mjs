// THE GATHERING'S SOUNDS, SYNTHESISED AND BAKED (GATHER-FEEL, 2026-10-13, Mac: "I want to improve gathering, add
// gathering sounds and overall make the experience more palatable" - bible/06-Systems/Professions-Arc.md section 44).
//
// OURS, the climb's way (tools/climbSfx.mjs): built here from noise and sine with the shared kit (tools/sfxSynth.mjs)
// and put through the one bake - tools/sndify.mjs, down to DAGGER.SND's own 11025 Hz unsigned 8-bit mono - so an axe in
// a trunk sits IN Daggerfall's world. The acts borrowed DAGGER.SND's combat and window clips until now (a blow's Hit1-5
// for a chop, the parry's ring for an ore, the lock's click for a clean finish, the button's click for a herb and a
// knife's stroke - systems/professions/profSounds.js, which the classic skin keeps); DAGGER.SND has no axe in wood, no pick on
// stone, no leaves, no net and no tree coming down. These thirty-six:
//
//   gather-swing-1/-2      a heavy tool through the air before its blow (the axe's, the pick's lower)
//   gather-chop-1/-3       an axe biting a trunk: the edge's crack on the bark, the bite through the fibres, the wood's
//                          own short note (four damped modes, 380 Hz and up), the trunk's weight, fibres and chips
//   gather-chop-clean      a Clean Cut: the same, fuller and longer-ringing, the chip splitting off, the whole tree taking it
//   gather-creak           the tree groaning at half its chops: a stick-slip train gliding down, ringing the trunk's bands
//   gather-fall            the tree coming down, its ground struck at FALL_S (scenes/treeHost.js, 1.5 s): the hinge
//                          cracking closer and closer over a groan, the crown's rush and its leaves louder to the ground,
//                          the trunk's boom, the earth's thump, the branches breaking, the bounce, the wood settling
//   gather-logs            logs gathered up: three or four hollow wooden knocks
//   gather-pick-1/-3       a pick on stone: the steel point's crack, the rock's brief ring, the pick head's own,
//                          chips flying and pebbles skittering, a breath of dust
//   gather-pick-glint      a strike on the glint: the ore rings - a bright note that hangs, two partials a breath apart
//   gather-rubble          a vein worked out: the face cracking, chunks clonking down, grit and dust
//   gather-rustle-1/-2     hands among the leaves (a kneel at a patch, the Basket's search, a find missed)
//   gather-pluck           a herb coming up: the stem's snap, the roots letting go, soil falling off them
//   gather-bruise          a herb crushed: leaves crunched soft and wet
//   gather-find            the Basket's find: a stalk's tiny snap, and the wicker's hollow tock as it drops in
//   gather-sparkle         a glint showing among the leaves: two soft high pings
//   gather-slice-1/-3      the knife drawn through hide: a band rising under an uneven drag, a wet body under it
//   gather-tear            the knife slipping: a ragged rip
//   gather-peel            the pelt coming away: a long rip falling in pitch, and the pelt laid down wet
//   gather-throw           the net thrown: a rush through the air with the mesh fluttering, the cord paying out
//   gather-net-land        the net on the water: the mesh's slaps spread a few hundredths apart, the floats bobbing up
//   gather-plip-1/-2       the water by the floats while the net waits: a drop's plip
//   gather-tug             the floats dragged under: a deep gulp in a splash
//   gather-thrash-1/-2     the haul: fish fighting in the mesh, a tail's slap
//   gather-net-out         the net hauled in: water streaming off it, the catch flopping in the mesh
//   gather-clean           a clean finish: two soft bell notes, a fourth apart
//   gather-haul            the goods into the bag: a leather satchel's thump, its flap, the goods settling
//   gather-rank            a rank risen: three bell notes rising, and a fourth above them
//
//     node tools/gatherSfx.mjs             # writes public/sfx/gather-*.wav
//     node tools/gatherSfx.mjs --measure   # and prints each clip's attack, crest, tail and brightness (tools/sfxBake.mjs)
//     node tools/gatherSfx.mjs --raw=dir   # also the 44.1 kHz source
//
// DETERMINISTIC: every noise is a seeded PRNG (each clip its own seed), so re-running writes the same bytes - the rule
// public/README.md sets for anything of ours that ships. Provenance: public/sfx/SOURCES.md; the doctrine allow-list
// (test/tooling/doctrine.test.js) carries a row for each.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8, DF_RATE } from './sndify.mjs';
import { RATE, rng, seconds, buf, decay, attack, biquad, sweepLowpass, noise, mix, softClip, envelope, unit, knock, rough, bandSweep, rub, grit, modes, burst, bubble, leaves, groan, splash, bellNote } from './sfxSynth.mjs';
import { isMain } from './lib/isMain.mjs';
import { FALL_S } from '../src/scenes/treeHost.js';   // the felled tree lies flat FALL_S after it begins to go: the fall's ground is struck then

const OUT = 'public/sfx';

// ---- the clips: Logging -----------------------------------------------------------------------------------------

/** A heavy tool through the air before its blow - the band rises and falls with the swing, a low push under it. */
function swing(seed, { lo = 260, hi = 820, len = 0.26 } = {}) {
  return () => {
    const rand = rng(seed);
    const n = seconds(len);
    const out = buf(len);
    const air = bandSweep(noise(n, rand), (t) => lo + (hi - lo) * Math.sin(Math.PI * Math.min(1, (t / len) * 1.15)), 1.6);
    for (let i = 0; i < n; i++) air[i] *= Math.pow(Math.sin((Math.PI * i) / n), 1.4);
    mix(out, unit(air), 0, 1);
    const low = biquad(noise(n, rand), { type: 'lowpass', f0: 220, q: 0.7 });
    for (let i = 0; i < n; i++) low[i] *= Math.pow(Math.sin((Math.PI * i) / n), 2);
    mix(out, unit(low), 0, 0.35);
    return softClip(out, 1.2);
  };
}

/** An axe biting a trunk. */
function chop(seed, { body = 150, tok = [380, 700, 1050, 1600], click = 2500 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.36);
    mix(out, burst(rand, { f0: click, q: 0.7, tau: 0.0035 }), 0, 1);                       // the edge on the bark
    mix(out, burst(rand, { f0: 1400, q: 0.9, tau: 0.012 }), 0.0008, 0.65);                   // the bite through the fibres
    mix(out, unit(modes(0.18, [[tok[0], 0.022, 1], [tok[1], 0.016, 0.7], [tok[2], 0.011, 0.5], [tok[3], 0.007, 0.3]])), 0.0005, 0.7);   // the wood's own note
    mix(out, unit(knock(0.15, body * 1.6, body, 0.008, 0.028, 0.8)), 0, 0.6);                // the trunk's weight
    grit(out, rand, { count: 8, from: 0.002, to: 0.06, lo: 1400, hi: 3400, tauLo: 0.001, tauHi: 0.003, gain: 0.3 });   // fibres tearing
    grit(out, rand, { count: 3, from: 0.09, to: 0.32, lo: 1800, hi: 3800, tauLo: 0.0008, tauHi: 0.002, gain: 0.12 });   // chips landing
    return softClip(out, 1.6);
  };
}

/** A Clean Cut: fuller, longer-ringing, the chip splitting off, the whole tree taking it. */
function chopClean() {
  const rand = rng(0xc1ea2c);
  const out = buf(0.55);
  mix(out, burst(rand, { f0: 2800, q: 0.7, tau: 0.004 }), 0, 1);
  mix(out, burst(rand, { f0: 1500, q: 0.9, tau: 0.014 }), 0.0006, 0.7);
  mix(out, unit(modes(0.3, [[430, 0.04, 1], [780, 0.028, 0.65], [1180, 0.018, 0.48], [1750, 0.011, 0.3], [2350, 0.007, 0.18]])), 0.0004, 0.85);
  mix(out, unit(knock(0.25, 220, 115, 0.01, 0.04, 0.8)), 0, 0.75);
  mix(out, unit(knock(0.3, 85, 58, 0.03, 0.06, 2)), 0.002, 0.35);                             // the whole tree takes it
  mix(out, burst(rand, { f0: 3200, q: 0.8, tau: 0.003 }), 0.009, 0.7);                        // the chip splitting off
  grit(out, rand, { count: 10, from: 0.002, to: 0.08, lo: 1500, hi: 3600, tauLo: 0.001, tauHi: 0.003, gain: 0.3 });
  grit(out, rand, { count: 6, from: 0.12, to: 0.45, lo: 1800, hi: 4000, tauLo: 0.0008, tauHi: 0.002, gain: 0.14 });
  return softClip(out, 1.7);
}

/** The tree groaning at half its chops. */
function creak() {
  const rand = rng(0xc2eaa4);
  const LEN = 1.3;
  const out = buf(LEN);
  mix(out, groan(rand, LEN, {
    rate: (u) => 70 - 30 * u + 8 * Math.sin(2 * Math.PI * 2.1 * u),
    jitter: 0.12,
    bands: [[180, 14, 1], [410, 12, 0.85], [760, 9, 0.55], [1300, 7, 0.3]],
    env: (u) => Math.min(1, u / 0.18) * Math.min(1, (1 - u) / 0.3) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 3 * u)),
    noiseGain: 0.05,
  }), 0, 1);
  grit(out, rand, { count: 5, from: 0.85, to: 1.25, lo: 1300, hi: 3000, gain: 0.18 });       // a fibre or two giving
  return softClip(out, 1.4);
}

/** The tree coming down - its ground struck FALL_S after the first crack, as the picture lies flat. */
function fall() {
  const rand = rng(0xfa11ed);
  const LEN = 2.75, HIT = FALL_S;
  const out = buf(LEN);
  // the hinge giving: cracks, closer and closer, over a groan
  for (const [at, big] of [[0, 1], [0.07, 0], [0.12, 0], [0.19, 0], [0.24, 0], [0.31, 1], [0.36, 0], [0.4, 0], [0.44, 0], [0.47, 0], [0.51, 0], [0.55, 0]]) {
    const t = at + (at > 0 ? 0.015 * (2 * rand() - 1) : 0);
    const g = big ? 1 : 0.3 + 0.35 * rand();
    mix(out, burst(rand, { f0: 1800 + 1400 * rand(), q: 0.7, tau: big ? 0.004 : 0.0015 + 0.0012 * rand() }), t, 0.75 * g);
    mix(out, unit(knock(0.16, 150 + 60 * rand(), 75, 0.01, big ? 0.05 : 0.025, 0.5)), t, 0.6 * g);
  }
  mix(out, groan(rand, 0.9, { rate: (u) => 55 - 25 * u, jitter: 0.15, bands: [[160, 14, 1], [380, 12, 0.7], [700, 9, 0.4]], env: (u) => Math.min(1, u / 0.15) * Math.min(1, (1 - u) / 0.4), noiseGain: 0.05 }), 0.002, 0.5);
  // the crown sweeping down: the air and the leaves, faster and louder to the ground
  const RUSH_FROM = 0.3, rushS = HIT - RUSH_FROM, rushN = seconds(rushS + 0.05);
  const rush = bandSweep(noise(rushN, rand), (t) => 260 + 900 * Math.pow(Math.min(1, t / rushS), 2), 1.1);
  for (let i = 0; i < rushN; i++) {
    const u = Math.min(1, i / seconds(rushS));
    rush[i] *= Math.pow(u, 2.2) * (i < seconds(rushS) ? 1 : decay(i - seconds(rushS), 0.01));
  }
  mix(out, unit(rush), RUSH_FROM, 0.5);
  leaves(out, rand, { count: 260, from: RUSH_FROM + 0.25, to: HIT, lo: 1700, hi: 4300, gain: 0.32, env: (u) => Math.pow(u, 1.8) });
  // the ground: the trunk's boom, the earth's thump, the branches breaking, the leaves' crash
  mix(out, unit(knock(0.9, 95, 40, 0.05, 0.2, 1.5)), HIT, 1);
  const thump = biquad(noise(seconds(0.5), rand), { type: 'lowpass', f0: 420, q: 0.8 });
  envelope(thump, (i) => attack(i, 2) * decay(i, 0.09));
  mix(out, unit(thump), HIT, 0.75);
  grit(out, rand, { count: 70, from: HIT, to: HIT + 0.45, lo: 650, hi: 3200, tauLo: 0.002, tauHi: 0.008, gain: 0.5, q: 1.4 });
  const crash = biquad(noise(seconds(0.7), rand), { type: 'bandpass', f0: 2800, q: 0.7 });
  envelope(crash, (i) => attack(i, 3) * decay(i, 0.13));
  mix(out, unit(crash), HIT + 0.004, 0.45);
  // the bounce, and the wood settling
  mix(out, unit(knock(0.4, 85, 45, 0.04, 0.09, 1.5)), HIT + 0.24, 0.42);
  grit(out, rand, { count: 18, from: HIT + 0.3, to: LEN - 0.1, lo: 1400, hi: 3800, gain: 0.2 });
  leaves(out, rand, { count: 90, from: HIT + 0.15, to: LEN - 0.05, lo: 1800, hi: 4200, gain: 0.18, env: (u) => Math.pow(1 - u, 2) });
  return softClip(out, 1.6);
}

/** Logs gathered up: hollow wooden knocks. */
function logs() {
  const rand = rng(0x1065);
  const out = buf(0.5);
  for (const [at, f, g] of [[0, 330, 1], [0.085, 410, 0.75], [0.15, 290, 0.6], [0.23, 470, 0.4]]) {
    mix(out, unit(modes(0.16, [[f, 0.035, 1], [f * 2.3, 0.018, 0.5], [f * 3.9, 0.009, 0.25]])), at, g);
    mix(out, burst(rand, { f0: 1600 + 800 * rand(), q: 0.9, tau: 0.002 }), at, 0.4 * g);
    mix(out, unit(knock(0.1, 140, 90, 0.01, 0.03)), at, 0.4 * g);
  }
  return softClip(out, 1.4);
}

// ---- the clips: Mining and Quarrying ------------------------------------------------------------------------------

/** A pick on stone. */
function pick(seed, { stone = [1250, 1900, 2750], ring = [2650, 3950], thud = 170 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.42);
    mix(out, burst(rand, { f0: 3300, q: 0.6, tau: 0.0016 }), 0, 1);                         // the steel point on stone
    mix(out, unit(modes(0.12, [[stone[0], 0.016, 1], [stone[1], 0.011, 0.7], [stone[2], 0.007, 0.45]])), 0.0003, 0.7);   // the rock's brief ring
    mix(out, unit(modes(0.2, [[ring[0], 0.05, 1], [ring[1], 0.03, 0.55]])), 0.0003, 0.3);    // the pick head's own
    mix(out, unit(knock(0.1, thud, thud * 0.65, 0.008, 0.02, 0.4)), 0, 0.35);               // the rock's mass
    grit(out, rand, { count: 12, from: 0.003, to: 0.3, lo: 2200, hi: 4700, gain: 0.4 });    // chips flying, pebbles skittering
    const dust = biquad(noise(seconds(0.3), rand), { type: 'bandpass', f0: 3400, q: 0.7 });
    envelope(dust, (i) => attack(i, 3) * decay(i, 0.05));
    mix(out, unit(dust), 0.002, 0.1);
    return softClip(out, 1.6);
  };
}

/** A strike on the glint: the ore rings. */
function pickGlint() {
  const rand = rng(0x9117);
  const out = buf(0.9);
  mix(out, burst(rand, { f0: 3500, q: 0.6, tau: 0.0016 }), 0, 1);
  mix(out, unit(modes(0.12, [[1300, 0.012, 1], [2000, 0.008, 0.6]])), 0.0003, 0.4);
  mix(out, unit(modes(0.8, [[1960, 0.16, 1], [1967, 0.15, 0.55], [2610, 0.1, 0.5], [3420, 0.065, 0.32], [4380, 0.04, 0.18]], { attackMs: 0.3 })), 0.0005, 0.85);
  mix(out, unit(knock(0.1, 180, 120, 0.008, 0.02, 0.4)), 0, 0.4);
  grit(out, rand, { count: 10, from: 0.003, to: 0.28, lo: 2400, hi: 4700, gain: 0.3 });
  return softClip(out, 1.4);
}

/** A vein worked out: the face cracking, chunks clonking down, grit and dust. */
function rubble() {
  const rand = rng(0x2bb1e);
  const LEN = 1.05;
  const out = buf(LEN);
  mix(out, burst(rand, { f0: 2600, q: 0.6, tau: 0.004 }), 0, 0.9);
  mix(out, unit(knock(0.3, 150, 70, 0.02, 0.07, 0.8)), 0, 0.8);
  for (let k = 0; k < 9; k++) {
    const at = 0.04 + 0.62 * Math.pow(rand(), 1.3);
    const f = 260 + 650 * rand();
    const g = (0.35 + 0.65 * rand()) * (1 - (0.6 * at) / 0.7);
    mix(out, unit(modes(0.12, [[f, 0.02, 1], [f * 2.4, 0.01, 0.5], [f * 4.1, 0.006, 0.3]])), at, 0.55 * g);
    mix(out, burst(rand, { f0: 2000 + 1500 * rand(), q: 0.8, tau: 0.0015 }), at, 0.35 * g);
  }
  grit(out, rand, { count: 45, from: 0.01, to: 0.85, lo: 1800, hi: 4600, gain: 0.35 });
  const dust = biquad(noise(seconds(0.9), rand), { type: 'bandpass', f0: 2800, q: 0.6 });
  envelope(dust, (i) => attack(i, 8) * decay(i, 0.22));
  mix(out, unit(dust), 0.01, 0.16);
  return softClip(out, 1.5);
}

// ---- the clips: Herbalism -----------------------------------------------------------------------------------------

/** Hands among the leaves, a knee or a sleeve among the stems. */
function rustle(seed, { lo = 1700, hi = 4300, len = 0.5 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(len);
    leaves(out, rand, { count: 90, from: 0, to: len - 0.04, lo, hi, gain: 0.5, env: (u) => Math.min(1, u / 0.15) * Math.pow(1 - u, 1.2) });
    mix(out, rub(rand, len * 0.7, { f0: 520, q: 0.8, hz: 60, inMs: 40, tau: 0.12 }), 0.01, 0.15);
    return softClip(out, 1.3);
  };
}

/** A herb coming up: the stem's snap, the roots letting go, soil falling off them. */
function pluck() {
  const rand = rng(0x91c4);
  const out = buf(0.45);
  leaves(out, rand, { count: 40, from: 0, to: 0.06, lo: 1800, hi: 4200, gain: 0.35 });          // the hand closing on it
  mix(out, burst(rand, { f0: 2900, q: 1.1, tau: 0.0012 }), 0.07, 0.95);                      // the stem snaps
  mix(out, unit(modes(0.05, [[620, 0.008, 1], [1450, 0.005, 0.6]])), 0.07, 0.5);
  mix(out, rub(rand, 0.1, { f0: 1500, q: 1.0, hz: 260, inMs: 4, tau: 0.03, depth: 0.95 }), 0.075, 0.45);   // the roots let go
  grit(out, rand, { count: 8, from: 0.1, to: 0.3, lo: 1200, hi: 2600, gain: 0.18 });          // soil falling off them
  leaves(out, rand, { count: 70, from: 0.08, to: 0.4, lo: 1800, hi: 4300, gain: 0.3, env: (u) => Math.pow(1 - u, 1.5) });
  return softClip(out, 1.4);
}

/** A herb crushed: leaves crunched soft and wet. */
function bruise() {
  const rand = rng(0xb2015e);
  const out = buf(0.32);
  grit(out, rand, { count: 26, from: 0, to: 0.16, lo: 650, hi: 1700, tauLo: 0.0015, tauHi: 0.005, gain: 0.55, q: 1.2 });
  mix(out, unit(knock(0.1, 240, 150, 0.01, 0.03)), 0.005, 0.4);
  const wet = biquad(noise(seconds(0.2), rand), { type: 'bandpass', f0: 900, q: 1.3 });
  envelope(wet, (i) => attack(i, 6) * decay(i, 0.04));
  mix(out, unit(wet), 0.01, 0.3);
  return softClip(out, 1.4);
}

/** The Basket's find: a stalk's tiny snap, and the wicker's hollow tock as it drops in. */
function find() {
  const rand = rng(0xf19d);
  const out = buf(0.4);
  leaves(out, rand, { count: 45, from: 0, to: 0.12, lo: 1800, hi: 4200, gain: 0.35, env: (u) => 1 - u });
  mix(out, burst(rand, { f0: 2400, q: 1.4, tau: 0.001 }), 0.06, 0.6);
  mix(out, unit(modes(0.15, [[740, 0.03, 1], [1520, 0.016, 0.5], [2390, 0.009, 0.25]])), 0.16, 0.7);
  mix(out, burst(rand, { f0: 1900, q: 1.0, tau: 0.002 }), 0.16, 0.35);
  return softClip(out, 1.3);
}

/** A glint showing among the leaves: two soft high pings. */
function sparkle() {
  const out = buf(0.3);
  mix(out, unit(modes(0.28, [[2640, 0.06, 1], [2652, 0.055, 0.5]], { attackMs: 1 })), 0, 0.7);
  mix(out, unit(modes(0.22, [[3960, 0.04, 1], [3975, 0.035, 0.5]], { attackMs: 1 })), 0.03, 0.5);
  return softClip(out, 1.1);
}

// ---- the clips: Hunting -------------------------------------------------------------------------------------------

/** The knife drawn through hide. */
function slice(seed, { from = 1500, to = 2900, len = 0.17 } = {}) {
  return () => {
    const rand = rng(seed);
    const n = seconds(len);
    const out = buf(len);
    const cut = bandSweep(noise(n, rand), (t) => from + (to - from) * Math.min(1, t / (len * 0.7)), 2.2);
    const drag = rough(n, rand, 140);
    for (let i = 0; i < n; i++) { const u = i / n; cut[i] *= Math.min(1, u / 0.12) * Math.pow(1 - u, 1.6) * (0.55 + 0.45 * drag[i]); }
    mix(out, unit(cut), 0, 1);
    const wet = biquad(noise(n, rand), { type: 'lowpass', f0: 700, q: 0.8 });
    envelope(wet, (i) => attack(i, 4) * decay(i, 0.03));
    mix(out, unit(wet), 0, 0.3);
    return softClip(out, 1.3);
  };
}

/** The knife slipping: a ragged rip. */
function tear() {
  const rand = rng(0x7ea2);
  const LEN = 0.3;
  const out = buf(LEN);
  mix(out, groan(rand, LEN, { rate: (u) => 140 - 60 * u, jitter: 0.5, bands: [[900, 2.5, 1], [1700, 2.2, 0.8], [2900, 2, 0.5]], env: (u) => Math.min(1, u / 0.05) * Math.pow(1 - u, 1.3), noiseGain: 0.35 }), 0, 1);
  return softClip(out, 1.5);
}

/** The pelt coming away: a long rip falling in pitch, and the pelt laid down wet. */
function peel() {
  const rand = rng(0x9ee1);
  const out = buf(0.85);
  mix(out, groan(rand, 0.6, { rate: (u) => 160 - 100 * u, jitter: 0.5, bands: [[1100, 4, 1], [2000, 3.5, 0.7], [3100, 3, 0.4], [650, 4, 0.5]], env: (u) => Math.min(1, u / 0.1) * (1 - 0.5 * u) * Math.min(1, (1 - u) / 0.15) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 9 * u)), noiseGain: 0.15 }), 0, 0.9);
  mix(out, burst(rand, { f0: 1100, q: 0.9, tau: 0.006 }), 0.62, 0.7);
  const body = biquad(noise(seconds(0.2), rand), { type: 'lowpass', f0: 300, q: 0.8 });
  envelope(body, (i) => attack(i, 1.5) * decay(i, 0.035));
  mix(out, unit(body), 0.62, 0.65);
  return softClip(out, 1.4);
}

// ---- the clips: Fishing -------------------------------------------------------------------------------------------

/** The net thrown: a rush through the air with the mesh fluttering, the cord paying out. */
function throwNet() {
  const rand = rng(0x7a20);
  const LEN = 0.62;
  const n = seconds(LEN);
  const out = buf(LEN);
  const air = bandSweep(noise(n, rand), (t) => (t < 0.2 ? 380 + (1250 - 380) * (t / 0.2) : 1250 - (1250 - 520) * Math.min(1, (t - 0.2) / (LEN - 0.2))), 1.3);
  const ph = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    air[i] *= Math.pow(Math.sin(Math.PI * Math.min(1, t / LEN)), 1.3) * Math.min(1, t / 0.05) * (0.62 + 0.38 * Math.sin(2 * Math.PI * 31 * t + ph));
  }
  mix(out, unit(air), 0, 1);
  mix(out, rub(rand, 0.4, { f0: 1600, q: 1.4, hz: 90, inMs: 30, tau: 0.15 }), 0.05, 0.22);
  return softClip(out, 1.3);
}

/** The net on the water: the mesh's slaps spread a few hundredths apart, the floats bobbing up, the water settling. */
function netLand() {
  const rand = rng(0x2e7a2d);
  const out = buf(1.0);
  for (let k = 0; k < 9; k++) {
    const at = 0.16 * Math.pow(rand(), 0.9);
    mix(out, splash(rand, { len: 0.3, from: 3600 + 900 * rand(), to: 450, tau: 0.03 + 0.03 * rand(), body: 0.4, drops: 3, dropsTo: 0.25 }), at, 0.45 + 0.4 * rand());
  }
  for (let k = 0; k < 4; k++) {
    const f = 420 + 260 * rand();
    mix(out, bubble(0.1, f, f * 1.7, 0.03, 0.025), 0.16 + 0.32 * rand(), 0.18);
  }
  for (let k = 0; k < 10; k++) {
    const at = 0.25 + 0.65 * rand();
    const f = 900 + 1300 * rand();
    mix(out, bubble(0.05, f, f * 1.5, 0.008, 0.01), at, 0.08 * (1 - (at - 0.25) / 0.7));
  }
  return softClip(out, 1.5);
}

/** The water by the floats while the net waits: a drop's plip. */
function plip(seed, { f = 820 } = {}) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.2);
    mix(out, bubble(0.15, f, f * 1.8, 0.02, 0.022), 0, 1);
    mix(out, burst(rand, { f0: 2600, q: 1, tau: 0.0015 }), 0, 0.25);
    mix(out, bubble(0.08, f * 1.6, f * 2.3, 0.01, 0.012), 0.05 + 0.03 * rand(), 0.35);
    return softClip(out, 1.1);
  };
}

/** The floats dragged under: a deep gulp in a splash. */
function tug() {
  const rand = rng(0x7a9);
  const out = buf(0.55);
  mix(out, splash(rand, { len: 0.35, from: 3200, to: 380, tau: 0.04, body: 0.7, drops: 6, dropsTo: 0.3 }), 0, 0.8);
  mix(out, bubble(0.25, 210, 520, 0.05, 0.06), 0.004, 0.9);
  mix(out, bubble(0.12, 520, 900, 0.02, 0.03), 0.09, 0.4);
  return softClip(out, 1.4);
}

/** The haul: fish fighting in the mesh, a tail's slap. */
function thrash(seed) {
  return () => {
    const rand = rng(seed);
    const out = buf(0.5);
    const n = 3 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const at = 0.02 + (0.32 * k) / n + 0.05 * rand();
      mix(out, splash(rand, { len: 0.22, from: 3000 + 1200 * rand(), to: 500, tau: 0.02 + 0.025 * rand(), body: 0.5, drops: 3, dropsTo: 0.18 }), at, 0.5 + 0.5 * rand());
    }
    mix(out, burst(rand, { f0: 1300, q: 0.9, tau: 0.004 }), 0.1 + 0.15 * rand(), 0.35);
    return softClip(out, 1.4);
  };
}

/** The net hauled in: water streaming off it, the catch flopping in the mesh. */
function netOut() {
  const rand = rng(0x2e70);
  const out = buf(1.15);
  const stream = biquad(noise(seconds(0.9), rand), { type: 'bandpass', f0: 1800, q: 0.6 });
  envelope(stream, (i) => attack(i, 30) * decay(i, 0.25));
  mix(out, unit(stream), 0, 0.35);
  for (let k = 0; k < 40; k++) {
    const at = 0.02 + 0.85 * Math.pow(rand(), 1.4);
    const f = 800 + 1800 * rand();
    mix(out, bubble(0.05, f, f * 1.5, 0.006, 0.008), at, 0.22 * (0.4 + 0.6 * rand()) * (1 - at));
  }
  for (const at of [0.25, 0.52, 0.8]) {
    const g = 0.6 + 0.4 * rand();
    mix(out, burst(rand, { f0: 850 + 250 * rand(), q: 0.7, tau: 0.007, attackMs: 0.8 }), at, 0.42 * g);
    const body = biquad(noise(seconds(0.16), rand), { type: 'lowpass', f0: 280, q: 0.8 });
    envelope(body, (i) => attack(i, 2) * decay(i, 0.03));
    mix(out, unit(body), at, 0.6 * g);
  }
  return softClip(out, 1.4);
}

// ---- the clips: what an act gave ----------------------------------------------------------------------------------

/** A clean finish: two soft bell notes, a fourth apart (E6, A6). */
function clean() {
  const out = buf(1.7);
  mix(out, bellNote(1318.5, 0.3), 0, 0.7);
  mix(out, bellNote(1760, 0.3), 0.09, 0.85);
  return softClip(out, 1.05);
}

/** The goods into the bag: a leather satchel's thump, its flap, the goods settling. */
function haul() {
  const rand = rng(0x4a01);
  const out = buf(0.38);
  const leather = biquad(noise(seconds(0.2), rand), { type: 'lowpass', f0: 520, q: 0.9 });
  envelope(leather, (i) => attack(i, 2) * decay(i, 0.035));
  mix(out, unit(leather), 0, 0.85);
  mix(out, unit(knock(0.12, 150, 95, 0.012, 0.03)), 0, 0.55);
  mix(out, rub(rand, 0.12, { f0: 1300, q: 1.0, hz: 110, inMs: 8, tau: 0.04 }), 0.004, 0.3);
  grit(out, rand, { count: 6, from: 0.01, to: 0.12, lo: 900, hi: 2200, tauLo: 0.002, tauHi: 0.005, gain: 0.3 });
  return softClip(out, 1.3);
}

/** A rank risen: three bell notes rising (C6, E6, G6) and a fourth above them (C7). */
function rank() {
  const out = buf(2.5);
  for (const [f, at, g] of [[1046.5, 0, 0.75], [1318.5, 0.11, 0.8], [1568, 0.22, 0.9], [2093, 0.34, 0.55]]) mix(out, bellNote(f, 0.42), at, g);
  return softClip(out, 1.05);
}

// ---- write ----------------------------------------------------------
/** [name, make, the bake's peak] - every clip, in the header's order. */
export const CLIPS = [
  ['gather-swing-1', swing(0x5711a1), 0.8],
  ['gather-swing-2', swing(0x5711a2, { lo: 220, hi: 700, len: 0.28 }), 0.8],
  ['gather-chop-1', chop(0xc409a1), 0.88],
  ['gather-chop-2', chop(0xc409a2, { body: 135, tok: [350, 650, 990, 1500], click: 2300 }), 0.88],
  ['gather-chop-3', chop(0xc409a3, { body: 165, tok: [410, 740, 1120, 1690], click: 2700 }), 0.88],
  ['gather-chop-clean', chopClean, 0.9],
  ['gather-creak', creak, 0.84],
  ['gather-fall', fall, 0.9],
  ['gather-logs', logs, 0.84],
  ['gather-pick-1', pick(0x91c401), 0.88],
  ['gather-pick-2', pick(0x91c402, { stone: [1150, 1780, 2600], ring: [2500, 3720], thud: 155 }), 0.88],
  ['gather-pick-3', pick(0x91c403, { stone: [1360, 2050, 2950], ring: [2800, 4150], thud: 185 }), 0.88],
  ['gather-pick-glint', pickGlint, 0.88],
  ['gather-rubble', rubble, 0.86],
  ['gather-rustle-1', rustle(0x2a571e1), 0.8],
  ['gather-rustle-2', rustle(0x2a571e2, { lo: 1500, hi: 3900, len: 0.55 }), 0.8],
  ['gather-pluck', pluck, 0.84],
  ['gather-bruise', bruise, 0.82],
  ['gather-find', find, 0.82],
  ['gather-sparkle', sparkle, 0.7],
  ['gather-slice-1', slice(0x511ce1), 0.82],
  ['gather-slice-2', slice(0x511ce2, { from: 1350, to: 2600, len: 0.18 }), 0.82],
  ['gather-slice-3', slice(0x511ce3, { from: 1650, to: 3150, len: 0.16 }), 0.82],
  ['gather-tear', tear, 0.82],
  ['gather-peel', peel, 0.86],
  ['gather-throw', throwNet, 0.8],
  ['gather-net-land', netLand, 0.86],
  ['gather-plip-1', plip(0x9119a1), 0.7],
  ['gather-plip-2', plip(0x9119a2, { f: 1050 }), 0.7],
  ['gather-tug', tug, 0.88],
  ['gather-thrash-1', thrash(0x74a5a1), 0.84],
  ['gather-thrash-2', thrash(0x74a5a2), 0.84],
  ['gather-net-out', netOut, 0.84],
  ['gather-clean', clean, 0.78],
  ['gather-haul', haul, 0.82],
  ['gather-rank', rank, 0.8],
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
  const measuring = process.argv.includes('--measure');
  const { measure, measureLine } = measuring ? await import('./sfxBake.mjs') : {};   // the audition bench's four numbers (it loads Chromium's decoder door, so only when asked)
  mkdirSync(OUT, { recursive: true });
  if (rawDir) mkdirSync(rawDir, { recursive: true });
  for (const [name, make, peak] of CLIPS) {
    const mono = make();
    const pcm = bake(mono, RATE, { peak });
    writeFileSync(join(OUT, `${name}.wav`), writeWav8(pcm));
    if (rawDir) writeFileSync(join(rawDir, `${name}-44k.wav`), writeWav8(bakeRaw(mono), RATE));
    if (measuring) console.log(measureLine(`${name}.wav`, measure(pcm)));
    else console.log(`${name}.wav  ${DF_RATE}Hz 8-bit mono  ${pcm.length} samples  ${(pcm.length / DF_RATE).toFixed(3)}s  ${(44 + pcm.length)} bytes`);
  }
}
