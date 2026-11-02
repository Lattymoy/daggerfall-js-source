// FIELD-WIND1 (2026-09-29, the Discord through Mac: "A repetitive moaning sound in the open world" - a sound that had
// been there a while). The port's wind (WIND3, systems/wind/windAudio.js) played DAGGER.SND's own wind clips on the riding
// loop's shape (audio.setLoop: a clip played from its start again each time it ends) - AmbientWindMoan under 0.62 of
// the wind's strength, AmbientWindBlow1 above. They are DFU's dungeon ONE-SHOTS, short, shaped and pitched: the moan is
// 1.96 s that swells from nothing and falls back with a voice's pitch in it, and end to end it came back every 1.97 s
// under every breeze. Seen live (the retail data, outdoors at Daggerfall: 45 starts of the moan in two minutes, the gap
// never under 1.97 s). The wind is now a BED the port makes - white noise shaped into a soft whoosh, periodic so the
// engine's native loop has no seam, at the moan's own RMS - played once through audio.loop with its gain and pitch set
// live; the gain law is WIND3's. The last test reads the retail DAGGER.SND (ARENA2_PATH): the clips were a voice and a
// whistle, and the bed stands at the moan's level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as wind from '../../src/systems/wind/windAudio.js';
import { AudioEngine, pcm8ToFloat32 } from '../../src/systems/audio.js';
import { windDrive, WIND_NONE } from '../../src/systems/wind/windDrive.js';
import { SndFile, SAMPLE_RATE } from '../../src/formats/sndFile.js';
import { SOUND } from '../../src/systems/soundClips.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

const rmsOf = (x, a = 0, n = x.length - a) => { let s = 0; for (let i = a; i < a + n; i++) s += x[i] * x[i]; return Math.sqrt(s / n); };
/** The level over each quarter second. */
const levels = (x, rate) => { const n = Math.floor(rate / 4), out = []; for (let a = 0; a + n <= x.length; a += n) out.push(rmsOf(x, a, n)); return out; };
/** A VOICE in each fifth of a second: the normalised autocorrelation's peak over the lags of a pitch between 60 and
 *  600 Hz - near 1 a pitched tone, near 0 noise. */
function pitchiness(x, rate) {
  const n = Math.floor(rate / 5), lo = Math.floor(rate / 600), hi = Math.floor(rate / 60), out = [];
  for (let a = 0; a + n + hi <= x.length; a += n) {
    let e0 = 0;
    for (let k = a; k < a + n; k++) e0 += x[k] * x[k];
    let best = 0;
    for (let lag = lo; lag <= hi; lag++) {
      let acc = 0, e1 = 0;
      for (let k = a; k < a + n; k++) { acc += x[k] * x[k + lag]; e1 += x[k + lag] * x[k + lag]; }
      best = Math.max(best, acc / Math.sqrt(e0 * e1 + 1e-30));
    }
    out.push(best);
  }
  return out;
}
const near = (a, b, eps = 1e-12) => Math.abs(a - b) < eps;
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
const sameSamples = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;

test('FIELD-WIND1: the bed is a wind, not a moan - no pitch in any fifth of a second (the moan\'s voice 0.57 to 0.78), its level steady over every quarter second (the moan swells four times over), no hiss, at WIND_BED_RMS, and the same every boot', () => {
  assert.equal(typeof wind.windBedSamples, 'function', 'the bed exists');
  const bed = wind.windBedSamples();
  assert.ok(bed instanceof Float32Array);
  assert.equal(bed.length, 8 * 22050, 'eight seconds at 22050 Hz - a repeat no ear finds in a quiet noise');
  assert.equal(wind.WIND_BED_RATE, 22050); assert.equal(wind.WIND_BED_SECONDS, 8);
  assert.equal(wind.WIND_BED_RMS, 0.0349, 'AmbientWindMoan\'s RMS (the last test measures it on the retail DAGGER.SND)');
  assert.ok(Math.abs(rmsOf(bed) - wind.WIND_BED_RMS) < 1e-6, `at its level: ${rmsOf(bed)}`);
  const voice = pitchiness(bed, wind.WIND_BED_RATE);
  assert.ok(Math.max(...voice) < 0.3, `no voice in it: ${Math.max(...voice).toFixed(3)} at the most`);
  const lv = levels(bed, wind.WIND_BED_RATE);
  assert.ok(Math.max(...lv) / Math.min(...lv) < 1.3, `no swell: ${(Math.max(...lv) / Math.min(...lv)).toFixed(2)} between the loudest quarter second and the quietest`);
  // a whoosh, not a hiss: the step from sample to sample is small beside the level (white noise's is 1.4 times it)
  const steps = new Float32Array(bed.length - 1);
  for (let i = 1; i < bed.length; i++) steps[i - 1] = bed[i] - bed[i - 1];
  assert.ok(rmsOf(steps) / rmsOf(bed) < 0.4, `the low-pass holds: ${(rmsOf(steps) / rmsOf(bed)).toFixed(3)}`);
  assert.ok(bed.every((v) => Math.abs(v) < 0.5), 'nowhere near the rail');
  assert.ok(sameSamples(wind.windBedSamples(), bed), 'the same bed every boot (the seed)');
  assert.ok(!sameSamples(wind.windBedSamples({ seed: 7 }), bed), 'another seed, another bed');
});

test('FIELD-WIND1: the loop has no seam - the bed is its filters\' periodic answer, so its last sample runs into its first as any sample into the next: across the wrap no step and no bend larger than the largest inside it (a bed filtered once from rest breaks there)', () => {
  const beds = [wind.windBedSamples(), ...[1, 2, 3, 4, 5, 6, 7, 8].map((seed) => wind.windBedSamples({ seed, seconds: 2 }))];
  for (const x of beds) {
    const n = x.length;
    let step = 0, bend = 0;
    for (let i = 1; i < n; i++) step = Math.max(step, Math.abs(x[i] - x[i - 1]));
    for (let i = 2; i < n; i++) bend = Math.max(bend, Math.abs(x[i] - 2 * x[i - 1] + x[i - 2]));
    const wrapStep = Math.abs(x[0] - x[n - 1]);
    const wrapBend = Math.max(Math.abs(x[0] - 2 * x[n - 1] + x[n - 2]), Math.abs(x[1] - 2 * x[0] + x[n - 1]));
    assert.ok(wrapStep <= step, `the wrap's step ${wrapStep.toExponential(2)} within the bed's ${step.toExponential(2)}`);
    assert.ok(wrapBend <= bend, `the wrap's bend ${wrapBend.toExponential(2)} within the bed's ${bend.toExponential(2)}`);
  }
});

/** An engine that records: the bed registered (false while `ready` is false - no context), the native loops started
 *  (null while not ready), each loop's volumes, pitches and stops - and the riding loop, which must never be asked. */
function fakeEngine() {
  const log = [];
  const e = {
    ready: true, registered: new Map(), handles: [],
    registerSamples(key, samples, rate) {
      log.push(['register', key, rate]);
      if (!e.ready) return false;
      if (!e.registered.has(key)) e.registered.set(key, { samples, rate });
      return true;
    },
    loop(key, volume) {
      log.push(['loop', key, volume]);
      if (!e.ready || !e.registered.has(key)) return null;
      const h = { volumes: [volume], pitches: [], stops: 0, setVolume(v) { h.volumes.push(v); }, setPitch(p) { h.pitches.push(p); }, stop() { h.stops++; } };
      e.handles.push(h);
      return h;
    },
    setLoop(...a) { log.push(['setLoop', ...a]); },
  };
  return { e, log };
}

test('FIELD-WIND1: the driver plays the bed on the native loop - ONE audio.loop for the whole blow at the first slew step, its gain and pitch set live on that one source, never the riding loop\'s retriggered clip; an engine not running yet is asked again the next frame; stopped once on the floor and at once on a modal frame', () => {
  const { e, log } = fakeEngine();
  const wa = wind.createWindAudio(e);
  const gale = windDrive({ cloudShadow: { wind: [0.045, 0.016] }, gustAt: () => 1 }, 0, 0.016);
  const breeze = windDrive({ cloudShadow: { wind: [0.010, 0.004] }, gustAt: () => 1 }, 0, 0.016);
  // no context yet: the bed is offered, nothing plays, and the next frame asks again
  e.ready = false;
  wa.update(gale, 1 / 60, true);
  assert.equal(wa.playing, false); assert.equal(e.handles.length, 0);
  assert.deepEqual(log.at(-1), ['register', wind.WIND_BED_KEY, wind.WIND_BED_RATE]);
  e.ready = true;
  wa.update(gale, 1 / 60, true);
  assert.equal(wa.playing, true); assert.equal(e.handles.length, 1, 'one loop');
  const bed = e.registered.get(wind.WIND_BED_KEY);
  assert.ok(bed && sameSamples(bed.samples, wind.windBedSamples()) && bed.rate === wind.WIND_BED_RATE, 'the bed, at its rate');
  assert.deepEqual(log.at(-1).slice(0, 2), ['loop', wind.WIND_BED_KEY]);
  assert.ok(near(log.at(-1)[2], 2 * wind.WIND_SLEW_PER_S / 60), 'started at the slewed gain - two steps in, the first frame\'s included - not the target');
  const h = e.handles[0];
  assert.deepEqual(h.pitches, [wind.windPitchFor(gale.strength01)]);
  // the blow: the same one source for ten seconds, the gain rising to the ceiling, the pitch following the wind down
  for (let i = 0; i < 600; i++) wa.update(gale, 1 / 60, true);
  wa.update(breeze, 1 / 60, true);
  assert.equal(e.handles.length, 1, 'no second loop - nothing restarts');
  assert.deepEqual(['register', 'loop'].map((k) => log.filter((l) => l[0] === k).length), [2, 1], 'the bed offered on the two frames it was wanted, the loop asked for once');
  assert.equal(h.volumes.length, 602); assert.ok(h.volumes.every((v) => v > 0 && v <= wind.WIND_GAIN_MAX + 1e-12));
  assert.ok(Math.abs(h.volumes.at(-2) - wind.WIND_GAIN_MAX) < 1e-9, 'the ceiling reached');
  assert.equal(h.pitches.at(-1), wind.windPitchFor(breeze.strength01)); assert.ok(h.pitches.at(-1) < h.pitches[0], 'lower in the breeze');
  // switched off: wound down, stopped once on the floor, then nothing
  for (let i = 0; i < 600; i++) wa.update(breeze, 1 / 60, false);
  assert.equal(h.stops, 1); assert.equal(wa.playing, false); assert.equal(wa.gain, 0);
  assert.ok(h.volumes.slice(602).every((v) => v >= wind.WIND_GAIN_FLOOR), 'every frame before the stop above the floor');
  // the classic sky never starts it; a modal frame stops it at once, and a second stop is silent
  const before = log.length;
  wa.update(WIND_NONE, 1 / 60, true);
  assert.equal(log.length, before, 'no deck, no call');
  wa.update(gale, 1 / 60, true);
  assert.equal(e.handles.length, 2); assert.ok(near(e.handles[1].volumes[0], wind.WIND_SLEW_PER_S / 60), 'a new blow starts from one step');
  wa.stop(); wa.stop();
  assert.equal(e.handles[1].stops, 1); assert.equal(wa.gain, 0); assert.equal(wa.playing, false);
  assert.equal(log.filter((l) => l[0] === 'setLoop').length, 0, 'never the riding loop (a clip replayed from its start: the moan)');
});

/** The engine over a context that records its sources and buffers (audio3d.test.js's rig). */
function riggedEngine() {
  const param = () => ({ value: 0 });
  const sources = [], gains = [];
  const ctx = {
    state: 'running', destination: { connect(n) { return n; } },
    createGain: () => { const g = { gain: param(), connect(n) { return n; }, disconnect() {} }; gains.push(g); return g; },
    createBufferSource: () => { const s = { buffer: null, playbackRate: param(), loop: false, started: 0, connect(n) { return n; }, start() { s.started++; }, stop() {}, disconnect() {} }; sources.push(s); return s; },
    createBuffer: (channels, length, sampleRate) => { const data = new Float32Array(length); return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: () => data }; },
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  return { e, sources, gains };
}

test('FIELD-WIND1: the engine\'s two doors - registerSamples makes a mono buffer of the samples at their own rate under the key (once; false with no context), and a native loop\'s handle sets its one source\'s pitch live', () => {
  const { e, sources, gains } = riggedEngine();
  assert.equal(typeof e.registerSamples, 'function', 'the door exists');
  const samples = Float32Array.of(0.25, -0.5, 0.125);
  assert.equal(e.registerSamples('wind:test', samples, 22050), true);
  const b = e.buffers.get('wind:test');
  assert.equal(b.numberOfChannels, 1); assert.equal(b.sampleRate, 22050); assert.equal(b.length, 3);
  assert.deepEqual([...b.getChannelData(0)], [0.25, -0.5, 0.125]);
  assert.equal(e.registerSamples('wind:test', new Float32Array(9), 11025), true, 'a second offer stands on the first');
  assert.equal(e.buffers.get('wind:test'), b, 'not remade');
  const h = e.loop('wind:test', 0.05);
  assert.equal(sources.length, 1); assert.equal(sources[0].buffer, b); assert.equal(sources[0].loop, true, 'the native loop - no seam, nothing replayed');
  assert.equal(sources[0].started, 1);
  assert.equal(typeof h.setPitch, 'function');
  h.setPitch(1.07); assert.equal(sources[0].playbackRate.value, 1.07);
  const g = gains.find((x) => x.gain.value === 0.05);
  h.setVolume(0.12); assert.equal(g.gain.value, 0.12, 'its gain, live');
  assert.equal(sources.length, 1, 'the pitch and the gain move on the playing source');
  // no context to make it on (node has no AudioContext): false, and the caller asks again
  assert.equal(new AudioEngine().registerSamples('wind:test', samples, 22050), false);
});

test('FIELD-WIND1 on the retail DAGGER.SND: AmbientWindMoan is the moan the players heard - 1.96 s, a voice in most of its fifths of a second, a swell four times over - AmbientWindBlow1 a whistle; the bed stands at the moan\'s level', { skip: skipReal }, () => {
  const snd = new SndFile();
  assert.ok(snd.load(readFileSync(join(ARENA2, 'DAGGER.SND'))));
  const clip = (i) => pcm8ToFloat32(snd.getSound(i).waveData);
  const moan = clip(SOUND.AmbientWindMoan);
  assert.ok(Math.abs(moan.length / SAMPLE_RATE - 1.96) < 0.01, `${(moan.length / SAMPLE_RATE).toFixed(3)} s`);
  assert.ok(median(pitchiness(moan, SAMPLE_RATE)) > 0.5, 'a voice');
  const lv = levels(moan, SAMPLE_RATE);
  assert.ok(Math.max(...lv) / Math.min(...lv) > 3, 'a swell from nothing and back');
  assert.ok(median(pitchiness(clip(SOUND.AmbientWindBlow1), SAMPLE_RATE)) > 0.5, 'the blow: a whistle');
  assert.ok(Math.abs(rmsOf(moan) - wind.WIND_BED_RMS) < 1e-4, `the moan's level ${rmsOf(moan).toFixed(6)}: the bed's`);
});
