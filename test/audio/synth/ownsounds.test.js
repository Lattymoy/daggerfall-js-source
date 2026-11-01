// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything") - THE SOUNDS ARE OURS.
//
// Immersive Footsteps' 210 clips and Better Ambience's 29 left the tree; in their place the synth (src/audio/synth/)
// makes each name the two mods ask for, at the mod's length and rate. These pins hold the primitives to what they
// claim, every clip to its interface (its length, its rate, its level, its quality's depth), the six of a set to six
// different steps, each family to the band a listener knows it by (A-weighted, the ear's own weighting), the rain
// loop to its seam, and the whole set to a digest, so a changed sound is a decision, not an accident.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  seedOf, canvas, addBurst, addMode, addBubble, crush, filterSpan, inTurn, mulberry32, rmsOf,
} from '../../../src/audio/synth/dsp.js';
import { stepSound, STEP_FAMILIES, STEP_PEAK, RETRO } from '../../../src/audio/synth/steps.js';
import { rainLoop, rainLoopInTurns, RAIN_LOOP } from '../../../src/audio/synth/rain.js';
import {
  immersiveFootstepsClip, immersiveFootstepsRecipe, betterAmbienceClip, betterAmbienceClipInTurn, IF_CLIP_MS, BA_CLIPS, BA_RAIN_CLIP, BA_PEAK,
} from '../../../src/audio/synth/clips.js';
import { clipNames, SOUND_CLIP_QUALITY } from '../../../src/systems/immersiveFootsteps.js';
import { baClipNames, MISSING_CLIPS, AMBIENT_RAIN_CLIP } from '../../../src/systems/betterAmbience.js';

const peakOf = (s) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

// ═══ a spectrum, weighted as the ear hears ═══════════════════════════════════

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len / 2;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const vr = re[i + j + h] * cr - im[i + j + h] * ci, vi = re[i + j + h] * ci + im[i + j + h] * cr;
        re[i + j + h] = re[i + j] - vr; im[i + j + h] = im[i + j] - vi; re[i + j] += vr; im[i + j] += vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
/** IEC 61672's A-weighting, as power. */
const aWeight = (f) => {
  const f2 = f * f;
  const r = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return r * r * 1.585;
};
/** The A-weighted power's share in four bands: under 300 Hz (the weight), 300-1,500 (the body), 1,500-5,000 (the
 *  crack, the crunch, the splash) and over 5,000 (the rings, the spray). */
function bands(s, rate, N = 1024) {
  const out = [0, 0, 0, 0];
  let total = 0;
  for (let o = 0; o + N <= s.length; o += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = s[o + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * rate) / N, p = (re[k] * re[k] + im[k] * im[k]) * aWeight(f);
      out[f < 300 ? 0 : f < 1500 ? 1 : f < 5000 ? 2 : 3] += p;
      total += p;
    }
  }
  return out.map((x) => x / total);
}
const corr = (a, b) => {
  const n = Math.min(a.length, b.length);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return ab / Math.sqrt(aa * bb);
};

// ═══ the primitives ══════════════════════════════════════════════════════════

test('OWN-WORK4 synth: the primitives are what they say - a name\'s seed, a burst\'s level whatever its band, a mode\'s decay by e every tau, a bubble\'s rising pitch, the retro depth, the seamless pass, one clip a task', async () => {
  assert.equal(seedOf('if:Grass_Footstep_1'), seedOf('if:Grass_Footstep_1'));
  assert.notEqual(seedOf('if:Grass_Footstep_1'), seedOf('if:Grass_Footstep_2'));
  assert.equal(seedOf(''), 0x811c9dc5, 'FNV-1a\'s offset basis');
  const rate = 44100;
  // a burst: the top of its envelope at half its amp, in a narrow band or a wide one
  for (const stages of [[['bandpass', 2000, 8]], [['lowpass', 8000, 0.7]]]) {
    const b = canvas(1, rate);
    addBurst(b, rate, mulberry32(7), { at: 0, amp: 0.8, attack: 0.5, decay: 10, stages });
    const top = rmsOf(b.subarray(Math.round(0.4 * rate), Math.round(0.5 * rate)));
    assert.ok(Math.abs(top - 0.4 * 0.9) < 0.06, `${stages[0][0]}: RMS ${top} near half the amp at the top`);
  }
  // a mode: a damped sine, e down every tau
  const m = canvas(0.2, rate);
  addMode(m, rate, { at: 0, freq: 441, tau: 0.05, amp: 1 });
  const p0 = peakOf(m.subarray(0, 100)), p1 = peakOf(m.subarray(Math.round(0.05 * rate), Math.round(0.05 * rate) + 100));
  assert.ok(Math.abs(p1 / p0 - 1 / Math.E) < 0.03, `${p1 / p0} ~ 1/e`);
  // a bubble: more zero crossings in its last third than its first
  const bb = canvas(0.06, rate);
  addBubble(bb, rate, { at: 0, freq: 1000, tau: 0.02, amp: 1, rise: 0.8 });
  const zc = (a, b) => { let n = 0; for (let i = a + 1; i < b; i++) if (Math.sign(bb[i]) !== Math.sign(bb[i - 1])) n++; return n; };
  assert.ok(zc(Math.round(0.03 * rate), Math.round(0.04 * rate)) > zc(0, Math.round(0.01 * rate)), 'the pitch rises as the bubble closes');
  // the retro quality's depth
  const c = Float64Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7) * 0.9);
  assert.ok(new Set(crush(c, RETRO.bits)).size <= 2 ** RETRO.bits + 1);
  // the seamless pass: a periodic input's answer runs from its end into its start as any sample into the next
  const n = 4410, x = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 7 * i) / n) + Math.sin((2 * Math.PI * 61 * i) / n));
  filterSpan(x, n, [['lowpass', 900, 0.7], ['highpass', 200, 0.7]], rate, 2);
  let step = 0;
  for (let i = 1; i < n; i++) step = Math.max(step, Math.abs(x[i] - x[i - 1]));
  assert.ok(Math.abs(x[0] - x[n - 1]) <= step * 1.01, 'no seam');
  // one a task, in order
  const order = [];
  await Promise.all([inTurn(() => order.push('a')), inTurn(() => order.push('b')), inTurn(() => order.push('c'))]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  await assert.rejects(inTurn(() => { throw new Error('x'); }));
  assert.equal(await inTurn(() => 5), 5, 'a maker that threw does not stop the next');
  assert.throws(() => stepSound('nope', { seed: 1, seconds: 0.1, rate }), /no step family/);
  assert.ok(STEP_FAMILIES.includes('landing:Plate') && STEP_FAMILIES.includes('waterLanding') && STEP_FAMILIES.includes('wade'));
});

// ═══ every clip, to its interface ════════════════════════════════════════════

test('OWN-WORK4: every name Immersive Footsteps asks for is a clip of ours - the mod\'s length at the quality\'s rate, at its kind\'s level, Low at 8 bits; the same name the same sound; the six of a set six steps; High and Low the same events', () => {
  for (const q of [SOUND_CLIP_QUALITY.Low, SOUND_CLIP_QUALITY.High]) {
    for (const name of clipNames(q)) {
      const r = immersiveFootstepsRecipe(name);
      const c = immersiveFootstepsClip(name);
      assert.equal(c.rate, r.rate);
      assert.equal(c.samples.length, Math.round(r.seconds * r.rate), `${name}: its length`);
      assert.ok(c.samples.every(Number.isFinite), name);
      const kind = /Swaying/.test(name) ? 'sway' : /Landing/.test(name) ? 'landing' : 'step';
      const pk = peakOf(c.samples);
      if (q === SOUND_CLIP_QUALITY.High) assert.ok(Math.abs(pk - STEP_PEAK[kind]) < 1e-6, `${name}: peak ${pk}`);
      else {
        assert.ok(Math.abs(pk - STEP_PEAK[kind]) <= 1 / 128, `${name}: retro peak ${pk}`);
        assert.ok(new Set(c.samples).size <= 257, `${name}: 8 bits`);
      }
      assert.ok(rmsOf(c.samples) > 0.02, `${name}: not silent`);
    }
  }
  assert.deepEqual(immersiveFootstepsClip('HQ_Mud_Footstep_4').samples, immersiveFootstepsClip('HQ_Mud_Footstep_4').samples, 'deterministic');
  assert.equal(immersiveFootstepsClip('HQ_Mud_Footstep_9'), null);
  for (const [stem, ms] of Object.entries(IF_CLIP_MS)) {
    const set = ms.map((_, i) => immersiveFootstepsClip(`HQ_${stem}_${i + 1}`).samples);
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) assert.ok(Math.abs(corr(set[i], set[j])) < 0.85, `${stem} ${i + 1} and ${j + 1} differ`);
  }
  // the same events at both rates: their 5 ms envelopes agree (the noise in them is drawn per sample, so it differs)
  const envelope = (x, rate) => { const w = Math.round(0.005 * rate), e = []; for (let i = 0; i + w <= x.length; i += w) e.push(rmsOf(x.subarray(i, i + w))); return e; };
  for (const name of ['Wood_Footstep_1', 'Gravel_Footstep_3', 'Plate_Swaying_2', 'Deep_Water_Footstep_5', 'Chainmail_Hard_Landing_2']) {
    const hq = immersiveFootstepsClip(`HQ_${name}`), lq = immersiveFootstepsClip(`LQ_${name}`);
    const k = corr(envelope(hq.samples, hq.rate), envelope(lq.samples, lq.rate));
    assert.ok(k > 0.9, `${name}: one sound in two qualities (${k})`);
  }
});

test('OWN-WORK4: every name Better Ambience asks for is a clip of ours at its list\'s rate and length - but water_001, which never was; the rain loop is its length, mono at 22.05 kHz, seamless, its drops heard over its hiss, the same made at once or a step a task', async () => {
  let made = 0;
  for (const name of baClipNames()) {
    if (name === AMBIENT_RAIN_CLIP) continue;
    const c = betterAmbienceClip(name);
    if (MISSING_CLIPS.includes(name)) { assert.equal(c, null, name); continue; }
    const m = /^(.+)_(\d{3})$/.exec(name);
    const list = BA_CLIPS[m[1]];
    assert.equal(c.rate, list.rate, name);
    assert.equal(c.samples.length, Math.round((list.ms[Number(m[2])] / 1000) * list.rate), name);
    assert.ok(Math.abs(peakOf(c.samples) - BA_PEAK) < 1e-6, name);
    made++;
  }
  assert.equal(made, 28);
  const r = betterAmbienceClip(BA_RAIN_CLIP);
  assert.equal(r.rate, RAIN_LOOP.rate);
  assert.equal(r.samples.length, Math.round(RAIN_LOOP.seconds * RAIN_LOOP.rate));
  assert.ok(Math.abs(peakOf(r.samples) - RAIN_LOOP.peak) < 1e-6);
  const d = [];
  for (let i = 1; i < r.samples.length; i++) d.push(Math.abs(r.samples[i] - r.samples[i - 1]));
  d.sort((a, b) => a - b);
  assert.ok(Math.abs(r.samples[0] - r.samples[r.samples.length - 1]) <= d[Math.floor(d.length * 0.99)], 'the end runs into the start');
  assert.ok(peakOf(r.samples) / rmsOf(r.samples) > 6, 'the drops stand over the hiss (a crest a hiss alone never has)');
  assert.ok(bands(r.samples.subarray(0, 4 * RAIN_LOOP.rate), RAIN_LOOP.rate)[2] > 0.6, 'a hiss of drops, 1.5 to 5 kHz');
  assert.deepEqual(await rainLoopInTurns(), rainLoop(), 'a step a task makes the same loop');
  assert.deepEqual((await betterAmbienceClipInTurn('sfx_footstep_stone_001')).samples, betterAmbienceClip('sfx_footstep_stone_001').samples);
});

// ═══ each family sounds like what it is ══════════════════════════════════════

/** [the set, a band test over the four shares] - each held for every variant, in both qualities. */
const CHARACTER = [
  ['Path_Footstep', (b) => b[0] > 0.2 && b[2] + b[3] > 0.25, 'a boot on stone: its weight, and its crack'],
  ['Leather_Footstep', (b) => b[0] > 0.2 && b[2] + b[3] > 0.25, 'a leather sole on stone: weight and a muted crack'],
  ['Wood_Footstep', (b) => b[0] + b[1] > 0.85, 'boards: a hollow knock, all under 1.5 kHz'],
  ['Plate_Footstep', (b) => b[1] > 0.65, 'plate: the plate\'s ring, 300 to 1,500 Hz'],
  ['Plate_Hard_Landing', (b) => b[1] > 0.65, 'a plated fall: the ring'],
  ['Chainmail_Footstep', (b) => b[2] + b[3] > 0.7, 'mail: rings over the step'],
  ['Chainmail_Swaying', (b) => b[2] + b[3] > 0.95, 'mail in motion: nothing but rings'],
  ['Grass_Footstep', (b) => b[2] + b[3] > 0.85, 'grass: a swish and a crackle'],
  ['Gravel_Footstep', (b) => b[2] > 0.55, 'gravel: a crunch'],
  ['Sand_Footstep', (b) => b[2] > 0.55, 'sand: a hush'],
  ['Tile_Footstep', (b) => b[2] > 0.75, 'tile: a bright clack'],
  ['Shallow_Water_Footstep', (b) => b[2] > 0.7, 'shallow water: a splash'],
  ['Deep_Water_Footstep', (b) => b[1] > 0.8, 'deep water: a slosh'],
  ['Mud_Footstep', (b) => b[1] > 0.6, 'mud: a wet slap and a suck'],
  ['Snow_Footstep', (b) => b[1] + b[2] > 0.9 && b[3] < 0.05, 'snow: a packed crunch, no hiss over it'],
  ['Unarmored_Footstep', (b) => b[0] + b[1] > 0.55 && b[3] < 0.03, 'a bare foot: a soft pat'],
];

test('OWN-WORK4: each family is heard as what it is - its A-weighted power in the band a listener knows it by, every variant, both qualities; and Better Ambience\'s flags are short where its boards ring on', () => {
  for (const [stem, holds, why] of CHARACTER) {
    for (const q of ['HQ', 'LQ']) {
      IF_CLIP_MS[stem].forEach((_, i) => {
        const c = immersiveFootstepsClip(`${q}_${stem}_${i + 1}`);
        const b = bands(c.samples, c.rate);
        assert.ok(holds(b), `${q}_${stem}_${i + 1} - ${why}: ${b.map((x) => Math.round(100 * x)).join('/')}`);
      });
    }
  }
  const tailMs = (s, rate) => { const pk = peakOf(s); let last = 0; for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > pk * 0.1) last = i; return (1000 * last) / rate; };
  for (let i = 0; i < 4; i++) {
    const stone = betterAmbienceClip(`sfx_footstep_stone_00${i}`), wood = betterAmbienceClip(`sfx_footstep_wood_00${i}`);
    assert.ok(tailMs(stone.samples, stone.rate) < 110 && tailMs(wood.samples, wood.rate) > 150, `${i}: the flags stop, the boards ring`);
  }
  for (let i = 0; i < 4; i++) {
    const g = betterAmbienceClip(`sfx_footstep_crunchy-grass_00${i}`);
    assert.ok(bands(g.samples, g.rate)[2] + bands(g.samples, g.rate)[3] > 0.9, `crunchy grass ${i}: dry stalks`);
  }
});

// ═══ the whole set, to a digest ══════════════════════════════════════════════

/** sha256 of every clip's Float32 PCM in order, its first 16 hex digits. A changed sound changes it: write the new one
 *  here in the change that meant it. */
const DIGEST = Object.freeze({ HQ: 'ef018ba370e6dad7', LQ: 'acc8e9874b2bd29e', BA: 'af5f4d8d323e2169', rain: '5fd4f34494fa5947' });
const digest = (clips) => {
  const h = createHash('sha256');
  for (const c of clips) h.update(new Uint8Array(c.samples.buffer, c.samples.byteOffset, c.samples.byteLength));
  return h.digest('hex').slice(0, 16);
};

test('OWN-WORK4: the sounds are exactly what our code makes - a digest of each set', () => {
  for (const q of ['HQ', 'LQ']) {
    const clips = Object.entries(IF_CLIP_MS).flatMap(([s, ms]) => ms.map((_, i) => immersiveFootstepsClip(`${q}_${s}_${i + 1}`)));
    assert.equal(digest(clips), DIGEST[q], `Immersive Footsteps ${q}`);
  }
  const ba = Object.entries(BA_CLIPS).flatMap(([s, l]) => l.ms.map((m, i) => (m ? betterAmbienceClip(`${s}_${String(i).padStart(3, '0')}`) : null)).filter(Boolean));
  assert.equal(digest(ba), DIGEST.BA, 'Better Ambience\'s steps');
  assert.equal(digest([betterAmbienceClip(BA_RAIN_CLIP)]), DIGEST.rain, 'the rain loop');
});
