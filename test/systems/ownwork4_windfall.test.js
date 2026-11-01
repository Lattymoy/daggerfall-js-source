// OWN-WORK4 (2026-10-31, the owner: "Our goal is no latching onto other mod authors or needing permissions. A proper 1
// to 1 recreation for everything") - WINDFALL's SOUNDS AND PICTURES, OUR OWN. Windfall 1.0.0 (demifiend000) keeps its
// names, rates, frame counts and sizes; the clips are made by our synthesizer (systems/windfall/windfallSynth.js) and
// the pictures by our painter (systems/windfall/windfallPictures.js), each from a seed. vendor/windfall left the tree.
// bible/07-Rendering/Windfall.md is the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { windfallClipMaker, windfallClipSamples, windfallVoiceFamily, windfallVoiceSeed, WINDFALL_SYNTH_LEVEL } from '../../src/systems/windfall/windfallSynth.js';
import { paintWindfallPicture, WINDFALL_PICTURE_SIZE, WINDFALL_SHEET } from '../../src/systems/windfall/windfallPictures.js';
import { WINDFALL_CLIP_TABLE, WINDFALL_CLIPS, windfallAudio, windfallClipKey } from '../../src/systems/windfallEffects.js';
import { WINDFALL_PICTURES } from '../../src/render/windfallParticles.js';

const clip = (name) => WINDFALL_CLIP_TABLE.find((c) => c.name === name);
const rms = (x, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, to - from)); };
const peak = (x) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p; };
/** zero crossings a second over a stretch - the band a noise sits in, roughly twice its centre */
const crossings = (x, rate, from = 0, to = x.length) => { let n = 0; for (let i = from + 1; i < to; i++) if ((x[i] >= 0) !== (x[i - 1] >= 0)) n++; return n / ((to - from) / rate); };
/** the power at one frequency over a Hann window (Goertzel) */
const tone = (x, from, n, rate, hz) => { const w = 2 * Math.cos((2 * Math.PI * hz) / rate); let s1 = 0, s2 = 0; for (let i = 0; i < n; i++) { const s0 = x[from + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)) + w * s1 - s2; s2 = s1; s1 = s0; } return s1 * s1 + s2 * s2 - w * s1 * s2; };

test('OWN-WORK4 the retired directory: no file of the mod stands in the tree', () => {
  assert.equal(existsSync(new URL('../../vendor/windfall', import.meta.url)), false);
});

test('OWN-WORK4 the clips are ours: every clip the pools play is made at its row\'s rate and frame count, the same every time and the same made in slices as whole, each from its own name\'s seed; a gust and a ruffle levelled by their peak, a passage by its RMS (mutants: a level moved; the seed not the name\'s)', () => {
  assert.deepEqual(WINDFALL_SYNTH_LEVEL, { gustPeak: 0.8, passageRms: 0.05, passagePeak: 0.45, rufflePeak: 0.6 });
  let fnv = 0x811c9dc5;
  for (const ch of 'leaf_ruffle_03') fnv = Math.imul(fnv ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  assert.equal(windfallVoiceSeed('leaf_ruffle_03'), fnv, 'FNV-1a over the name');
  const families = { gust: 0, blowing: 0, whistling: 0, open: 0, ruffle: 0 };
  for (const c of WINDFALL_CLIP_TABLE) {
    const family = windfallVoiceFamily(c.name);
    families[family]++;
    const x = windfallClipSamples(c);
    assert.ok(x instanceof Float32Array && x.length === c.samples, `${c.name}: ${c.samples} frames`);
    const level = WINDFALL_SYNTH_LEVEL;
    if (family === 'gust') assert.ok(Math.abs(peak(x) - level.gustPeak) < 1e-6, c.name);
    else if (family === 'ruffle') assert.ok(Math.abs(peak(x) - level.rufflePeak) < 1e-6, c.name);
    else assert.ok(Math.abs(rms(x) - level.passageRms) < 1e-4 || Math.abs(peak(x) - level.passagePeak) < 1e-6, c.name);
    assert.ok(peak(x) <= 1, `${c.name}: never past full scale`);
  }
  assert.deepEqual(families, { gust: 12, blowing: 3, whistling: 3, open: 3, ruffle: 6 });
  for (const name of ['wind_gust_07', 'whistling_wind_02_ultrasoft', 'leaf_ruffle_05']) {
    const whole = windfallClipSamples(clip(name));
    assert.deepEqual(windfallClipSamples(clip(name)), whole, `${name}: the same every time`);
    const maker = windfallClipMaker(clip(name));
    let turns = 0;
    while (!maker.step(4410)) turns++;
    assert.ok(turns > 0, 'made a slice a turn');
    assert.deepEqual(maker.samples, whole, `${name}: in slices as whole`);
  }
  assert.notDeepEqual(windfallClipSamples({ name: 'wind_gust_01', rate: 22050, samples: 4000 }), windfallClipSamples({ name: 'wind_gust_02', rate: 22050, samples: 4000 }), 'each its own seed');
});

test('OWN-WORK4 the clips\' shapes: every clip rises from silence and dies to it; a gust swells to its top in its first half, its band rising with it; a whistling passage holds a thin whistle a plain one does not; the open wind is the deepest and a ruffle the brightest, a shower of grains (mutants: the passage\'s fade dropped; the gust\'s band fixed; the whistle dropped; the ruffle\'s grains smoothed)', () => {
  for (const c of WINDFALL_CLIP_TABLE) {
    const x = windfallClipSamples(c), edge = Math.floor(c.rate * 0.005), whole = rms(x);
    assert.ok(rms(x, 0, edge) < whole * 0.02 && rms(x, x.length - edge) < whole * 0.02, `${c.name}: from silence to silence`);
  }
  // the gust: its loudest twentieth in the first half; its band at the top above its band at the start
  const gust = windfallClipSamples(clip('wind_gust_05')), rate = 22050;
  const window = Math.floor(gust.length / 20);
  let loudest = 0, best = 0;
  for (let w = 0; w < 20; w++) { const r = rms(gust, w * window, (w + 1) * window); if (r > best) { best = r; loudest = w; } }
  assert.ok(loudest >= 2 && loudest <= 10, `the top in the first half: twentieth ${loudest}`);
  const early = crossings(gust, rate, window, 2 * window), top = crossings(gust, rate, loudest * window, (loudest + 1) * window);
  assert.ok(top > early * 1.25, `the band rises with the swell: ${early.toFixed(0)} -> ${top.toFixed(0)} crossings a second`);
  // the whistle: one frequency far above its neighbours in the passage's middle
  const tonality = (name) => {
    const x = windfallClipSamples(clip(name)), from = Math.floor(x.length * 0.45), powers = [];
    for (let hz = 600; hz <= 1500; hz += 5) powers.push(tone(x, from, 8192, 44100, hz));
    const sorted = [...powers].sort((a, b) => a - b);
    return Math.max(...powers) / sorted[Math.floor(sorted.length / 2)];
  };
  for (const n of [1, 2, 3]) assert.ok(tonality(`whistling_wind_0${n}_ultrasoft`) > 80, `whistling_wind_0${n} whistles`);
  for (const n of [1, 2, 3]) assert.ok(tonality(`wind_blowing_0${n}_ultrasoft`) < 60, `wind_blowing_0${n} does not`);
  // deep to bright
  const band = (name) => { const x = windfallClipSamples(clip(name)); return crossings(x, clip(name).rate); };
  const open = band('open_wind_01_ultrasoft'), blowing = band('wind_blowing_01_ultrasoft'), gusty = band('wind_gust_01'), ruffle = band('leaf_ruffle_01');
  assert.ok(open < blowing * 0.6 && blowing < ruffle && gusty < ruffle && ruffle > 4000, `open ${open} < blowing ${blowing}, gust ${gusty} < ruffle ${ruffle}`);
  const leaves = windfallClipSamples(clip('leaf_ruffle_02'));
  assert.ok(peak(leaves) / rms(leaves) > 7, `a ruffle is grains, not a hiss: crest ${(peak(leaves) / rms(leaves)).toFixed(1)}`);
});

test('OWN-WORK4 the clips\' one load: each clip made once and registered under its key at its row\'s rate; a host built again over the same engine makes none twice; an engine that takes none (no context) stops the load at the first; one with no door for made sounds makes none (mutants: the held set ignored; the stop on a refusal dropped)', async () => {
  const sources = () => ({ volume: 1, pitch: 1, isPlaying: false, playOneShot: () => {}, stop() {}, dispose() {} });
  const taken = new Map();
  const engine = { source: sources, registerSamples(key, samples, rate) { taken.set(key, { n: samples.length, rate }); return true; } };
  let made = 0;
  const make = async (c) => { made++; return new Float32Array(c.samples > 50000 ? 3 : 2); };
  const first = windfallAudio(engine, { make });
  const loading = first.load();
  assert.equal(first.load(), loading, 'one load');
  await loading;
  assert.equal(made, 27);
  assert.deepEqual([...taken.keys()], WINDFALL_CLIP_TABLE.map((c) => windfallClipKey(c.name)));
  assert.deepEqual(taken.get('windfall:open_wind_02_ultrasoft'), { n: 3, rate: 44100 });
  assert.deepEqual(taken.get('windfall:leaf_ruffle_01'), { n: 2, rate: 22050 });
  await windfallAudio(engine, { make }).load();
  assert.equal(made, 27, 'a host built again makes none twice');
  let refused = 0;
  const cold = { source: sources, registerSamples() { refused++; return false; } };
  let coldMade = 0;
  await windfallAudio(cold, { make: async () => { coldMade++; return new Float32Array(1); } }).load();
  assert.deepEqual([coldMade, refused], [1, 1], 'an engine with no context: the first refused, the rest not made');
  let none = 0;
  await windfallAudio({ source: sources }, { make: async () => { none++; return new Float32Array(1); } }).load();
  assert.equal(none, 0);
  assert.deepEqual(Object.values(WINDFALL_CLIPS).flat().length, 27);
});

test('OWN-WORK4 the pictures are ours: the three the particles wear, under their names and at their sizes - two 64 x 64 sheets of 8 x 8 leaves and a 16 x 16 flake - every pixel whole or empty, the same every time; a leaf in every tile, the same shapes on both sheets, green in spring and summer, red and gold in the fall; the flake round its centre (mutants: a sheet\'s colours swapped; the leaf\'s shape by the sheet; a tile left empty)', () => {
  assert.deepEqual(WINDFALL_PICTURE_SIZE, { spring_summer_leaves: 64, fall_leaves: 64, snowflake: 16 });
  assert.deepEqual(WINDFALL_SHEET, { tiles: 8, tile: 8 });
  for (const name of Object.values(WINDFALL_PICTURES)) {
    const p = paintWindfallPicture(name);
    assert.deepEqual([p.width, p.height, p.data.length], [WINDFALL_PICTURE_SIZE[name], WINDFALL_PICTURE_SIZE[name], WINDFALL_PICTURE_SIZE[name] ** 2 * 4], name);
    for (let i = 3; i < p.data.length; i += 4) assert.ok(p.data[i] === 0 || p.data[i] === 255, `${name}: whole or empty`);
    assert.deepEqual(paintWindfallPicture(name), p, `${name}: the same every time`);
  }
  assert.equal(paintWindfallPicture('no_such_picture'), null);
  const spring = paintWindfallPicture('spring_summer_leaves'), fall = paintWindfallPicture('fall_leaves');
  let green = 0, warm = 0, opaque = 0;
  for (let tile = 0; tile < 64; tile++) {
    let count = 0;
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const at = (((tile >> 3) * 8 + row) * 64 + (tile % 8) * 8 + col) * 4;
      assert.equal(spring.data[at + 3], fall.data[at + 3], 'one shape on both sheets');
      if (spring.data[at + 3] !== 255) continue;
      count++; opaque++;
      if (spring.data[at + 1] > spring.data[at] && spring.data[at + 1] > spring.data[at + 2]) green++;
      if (fall.data[at] > fall.data[at + 1] && fall.data[at] > fall.data[at + 2]) warm++;
    }
    assert.ok(count >= 8 && count <= 40, `tile ${tile}: one leaf of ${count} pixels`);
  }
  assert.ok(green === opaque && warm === opaque, `spring green ${green}/${opaque}, fall red and gold ${warm}/${opaque}`);
  const flake = paintWindfallPicture('snowflake');
  const alpha = (row, col) => flake.data[(row * 16 + col) * 4 + 3];
  let filled = 0;
  for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
    if (alpha(row, col)) filled++;
    assert.equal(alpha(row, col), alpha(15 - row, 15 - col), 'the flake turned half round is itself');
  }
  assert.ok(alpha(8, 8) === 255 && alpha(0, 0) === 0 && filled > 40 && filled < 140, `a flake of ${filled} pixels`);
});
