// WINDFALL's PRESENTATION AND ITS LAW ON THE FLATS: WindEnvironmentEffects (the sounds and the particle flows), the
// AudioSource the port gives it (systems/audio.js source), the particle systems (render/windfallParticles.js), the
// vertex wind (render/windfallSway.js, run in BB_VS through the GLSL evaluator), and the hosts' wiring.
// bible/07-Rendering/Windfall.md is the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWindfallEffects, WINDFALL_CLIPS, WINDFALL_CLIP_TABLE, WINDFALL_PARTICLE_SYSTEMS, WINDFALL_EMITTER, leafAvailability, leafSeasonMultiplier, gustParticleResponse, windfallAudio, windfallClipKey } from '../../src/systems/windfallEffects.js';
import { AudioEngine } from '../../src/systems/audio.js';
import { WindfallParticles, WINDFALL_PICTURES } from '../../src/render/windfallParticles.js';
import { WINDFALL_SWAY_GLSL, windfallUniforms, windfallLawOn, swayShare, windfallLeanMax, windfallAnchorAfterShift, WINDFALL_ANCHOR_PERIOD, WINDFALL_SCALE_MAX, WINDFALL_STRENGTH_MAX, WINDFALL_TURNS } from '../../src/render/windfallSway.js';
import { bbVertexShader } from '../../src/render/renderer.js';
import { createWindfallHost } from '../../src/scenes/windfallHost.js';
import { registeredModSaveVendors } from '../../src/systems/modSaveData.js';
import { executeConsoleCommand, hasConsoleCommand } from '../../src/systems/consoleCommands.js';
import { setModSetting } from '../../src/systems/modSettings.js';
import { glslFunctions } from '../glsl.mjs';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const read = (p) => hostText(p);   // HOST-SPLIT 2: a host whole
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);
/** a seeded 0..1 (UnityEngine.Random's stand-in) */
const seeded = (s = 7) => () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };

/** A fake AudioSource on a clock: a one-shot runs its clip's length over the pitch. */
function fakeSources(clock) {
  const lengths = new Map([...WINDFALL_CLIPS.gust, ...WINDFALL_CLIPS.ambient, ...WINDFALL_CLIPS.ruffle].map((c) => [c.name, c.length]));
  const make = () => {
    const s = { volume: 0, pitch: 1, plays: [], until: -1, stops: 0,
      get isPlaying() { return clock.t < this.until; },
      playOneShot(name) { this.plays.push({ name, volume: this.volume, pitch: this.pitch, at: clock.t }); this.until = Math.max(this.until, clock.t + lengths.get(name) / this.pitch); },
      stop() { this.until = -1; this.stops++; } };
    return s;
  };
  return { gust: make(), ambient: make(), ruffle: make() };
}
const CFG = { audioEnabled: true, audioVolume: 0.5, regularWindVolume: 1, gustVolume: 1, ruffleVolume: 1, leavesEnabled: true, leafAmount: 2.4, ambientLeafAmount: 1, snowFlurriesEnabled: true, snowFlurryAmount: 1 };
const outdoor = (o = {}) => ({ outside: true, weather: 0, natureArchive: 504, season: 0, climate: 231, windyDay: false, storm: false, gust: 0, windDirection: [1, 0], dt: 0.05, playerPos: [0, 0.9, 0], ...o });

test('WINDFALL1 the clips: the pools WindMod.CreateEnvironmentalEffects loads - twelve gusts, nine intermittent passages, six ruffles - each at Windfall 1.0.0\'s own rate, frame count and length; OWN-WORK4: the sounds are our own, made at that rate and count (test/systems/ownwork4_windfall.test.js) (mutants: a pool short; a length not the clip\'s)', () => {
  assert.deepEqual([WINDFALL_CLIPS.gust.length, WINDFALL_CLIPS.ambient.length, WINDFALL_CLIPS.ruffle.length], [12, 9, 6]);
  assert.equal(WINDFALL_CLIPS.ambient[0].name, 'wind_blowing_01_ultrasoft');
  assert.equal(WINDFALL_CLIPS.ambient[8].name, 'open_wind_03_ultrasoft');
  assert.equal(WINDFALL_CLIPS.gust[4].length, 6);
  near(WINDFALL_CLIPS.ambient[3].length, 13.8545, 1e-3);
  assert.equal(windfallClipKey('leaf_ruffle_01'), 'windfall:leaf_ruffle_01');
  // The table the pools read, pinned as a literal (the mod's 27 clips: rate, frames; the length is frames over rate)
  const TABLE = { wind_gust_01: [22050, 61740], wind_gust_02: [22050, 79380], wind_gust_03: [22050, 97020], wind_gust_04: [22050, 114660], wind_gust_05: [22050, 132300], wind_gust_06: [22050, 68355], wind_gust_07: [22050, 85995], wind_gust_08: [22050, 103635], wind_gust_09: [22050, 121275], wind_gust_10: [22050, 138915], wind_gust_11: [22050, 90405], wind_gust_12: [22050, 127890],
    wind_blowing_01_ultrasoft: [44100, 793800], wind_blowing_02_ultrasoft: [44100, 793800], wind_blowing_03_ultrasoft: [44100, 793800], whistling_wind_01_ultrasoft: [44100, 610986], whistling_wind_02_ultrasoft: [44100, 610986], whistling_wind_03_ultrasoft: [44100, 610986], open_wind_01_ultrasoft: [44100, 633381], open_wind_02_ultrasoft: [44100, 633381], open_wind_03_ultrasoft: [44100, 633381],
    leaf_ruffle_01: [22050, 30870], leaf_ruffle_02: [22050, 37485], leaf_ruffle_03: [22050, 44100], leaf_ruffle_04: [22050, 35280], leaf_ruffle_05: [22050, 48510], leaf_ruffle_06: [22050, 41895] };
  assert.deepEqual(Object.fromEntries(WINDFALL_CLIP_TABLE.map((c) => [c.name, [c.rate, c.samples]])), TABLE);
  for (const c of WINDFALL_CLIP_TABLE) assert.equal(c.length, Math.fround(c.samples / c.rate), c.name);
  assert.equal(WINDFALL_CLIP_TABLE[0].length, 2.799999952316284, 'AudioClip.length, single precision');
  assert.deepEqual([...WINDFALL_CLIPS.gust, ...WINDFALL_CLIPS.ambient, ...WINDFALL_CLIPS.ruffle].map((c) => c.name).sort(), Object.keys(TABLE).sort(), 'every clip in one pool');
});

test('WINDFALL1 the sounds: a gust on a windy day plays a gust clip at 0.18..0.40 of the mod\'s volume by its peak (0.44 in a storm), a normal day\'s a soft passage at 0.14; a windy day plays passages end to end with a gap (0.2, 0.28 a storm); never the clip before; pitched (mutants: the storm\'s 0.44 the windy 0.40; the normal day a gust clip; the gap dropped; a repeat allowed)', () => {
  const clock = { t: 0 };
  const src = fakeSources(clock);
  const fx = createWindfallEffects({ sources: src, random: seeded() });
  fx.configure(CFG);
  fx.playWindEvent(1, true, false);
  assert.equal(src.gust.plays.length, 1);
  near(src.gust.plays[0].volume, 0.5 * 0.4, 1e-12, 'a full-peak windy gust: 0.40 of the mod\'s 0.5');
  assert.ok(src.gust.plays[0].pitch >= 0.96 && src.gust.plays[0].pitch <= 1.06);
  fx.playWindEvent(1, false, true);
  near(src.gust.plays[1].volume, 0.5 * 0.44, 1e-12, 'a storm\'s');
  fx.playWindEvent(0.5, true, false);
  near(src.gust.plays[2].volume, 0.5 * (0.18 + (0.4 - 0.18) * 0.5), 1e-12, 'half a peak, half way up');
  for (let i = 3; i < 40; i++) fx.playWindEvent(1, true, false);
  for (let i = 1; i < src.gust.plays.length; i++) assert.notEqual(src.gust.plays[i].name, src.gust.plays[i - 1].name, 'NextNonRepeatingIndex');
  fx.playWindEvent(0.2, false, false);
  assert.equal(src.ambient.plays.length, 1, 'a normal day\'s gust is a soft passage');
  near(src.ambient.plays[0].volume, 0.5 * 0.14, 1e-12);
  assert.equal(src.gust.plays.length, 40, '...not a gust clip');
  // a windy day's passages
  const clock2 = { t: 0 };
  const s2 = fakeSources(clock2);
  const fx2 = createWindfallEffects({ sources: s2, random: seeded(3) });
  fx2.configure(CFG);
  for (let i = 0; i < 2400; i++) { clock2.t += 0.05; fx2.update(outdoor({ windyDay: true })); }   // two minutes
  assert.ok(s2.ambient.plays.length >= 6 && s2.ambient.plays.length <= 9, `passages end to end with a gap: ${s2.ambient.plays.length}`);
  for (const p of s2.ambient.plays) { near(p.volume, 0.5 * 0.2, 1e-12); assert.ok(p.pitch >= 1.02 && p.pitch <= 1.08); }
  for (let i = 1; i < s2.ambient.plays.length; i++) {
    const prev = s2.ambient.plays[i - 1], len = WINDFALL_CLIPS.ambient.find((c) => c.name === prev.name).length / prev.pitch;
    const gap = s2.ambient.plays[i].at - prev.at - len;
    assert.ok(gap >= 0.75 - 0.06 && gap <= 2.5 + 0.06, `a windy day's gap 0.75..2.5 s: ${gap}`);
  }
});

test('WINDFALL1 the ruffle: where the canopy has leaves (LeafAvailability x LeafSeasonMultiplier) - not in snow, not under a winter nature set, not in the desert - a gust\'s onset ruffles it at 0.16..0.26 by the gust, and its own clock every 35-75 s (16-35 windy, 10-24 a storm) at 0.09..0.15, times the canopy (mutants: the onset every frame; the winter set ruffling; the canopy not scaling it)', () => {
  assert.deepEqual([223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 300].map(leafAvailability), [0.9, 0, 0, 0.2, 1, 0.75, 0.85, 0.8, 1, 0.9, 0]);
  assert.deepEqual([0, 1, 2, 3, 9].map(leafSeasonMultiplier), [1, 0.6, 0.75, 0.35, 0]);
  const run = (o) => {
    const clock = { t: 0 }, src = fakeSources(clock);
    const fx = createWindfallEffects({ sources: src, random: seeded(11) });
    fx.configure(CFG);
    for (let i = 0; i < 20; i++) { clock.t += 0.05; fx.update(outdoor(o)); }
    for (let i = 0; i < 100; i++) { clock.t += 0.05; fx.update(outdoor({ ...o, gust: 0.8 })); }   // five seconds of one gust: longer than any ruffle
    return src.ruffle.plays;
  };
  const woods = run({});
  assert.equal(woods.length, 1, 'the gust\'s onset, once');
  near(woods[0].volume, 0.5 * (0.16 + 0.1 * 0.8) * 1 * 1, 1e-12, 'by the gust, times the canopy (woodlands in the fall: 1 x 1)');
  assert.equal(run({ weather: 6 }).length, 0, 'not in snow');
  assert.equal(run({ natureArchive: 505 }).length, 0, 'not under a winter set');
  assert.equal(run({ climate: 224 }).length, 0, 'not in the desert');
  const summer = run({ season: 2 });
  near(summer[0].volume, 0.5 * (0.16 + 0.1 * 0.8) * 0.75, 1e-12, 'summer\'s canopy, three quarters');
  // its own clock
  const clock = { t: 0 }, src = fakeSources(clock);
  const fx = createWindfallEffects({ sources: src, random: seeded(5) });
  fx.configure(CFG);
  for (let i = 0; i < 20 * 300; i++) { clock.t += 0.05; fx.update(outdoor({ storm: true, windyDay: true })); }   // five minutes of a storm
  assert.ok(src.ruffle.plays.length >= 12 && src.ruffle.plays.length <= 30, `a storm's ruffle every 10-24 s: ${src.ruffle.plays.length}`);
  for (const p of src.ruffle.plays) assert.ok(p.volume >= 0.5 * 0.09 - 1e-12 && p.volume <= 0.5 * 0.15 + 1e-12);
});

test('WINDFALL1 indoors: every source fades at 0.8 of its volume a second and stops at nothing; the particles stop, cleared once; the switch\'s Suppress the same (mutants: the fade 0.5; the stop at nothing dropped; the clear every frame)', () => {
  const clock = { t: 0 }, src = fakeSources(clock);
  const fx = createWindfallEffects({ sources: src, random: seeded() });
  fx.configure(CFG);
  fx.playWindEvent(1, true, true);
  const v0 = src.gust.volume;
  fx.update(outdoor({ outside: false, dt: 0.1 }));
  near(src.gust.volume, v0 - 0.08, 1e-12, '0.8 a second');
  assert.equal(fx.flows.leaves.clear, true, 'the first indoor frame clears');
  fx.flows.leaves.clear = false;
  fx.update(outdoor({ outside: false, dt: 0.1 }));
  assert.equal(fx.flows.leaves.clear, false, '...once');
  for (let i = 0; i < 10; i++) fx.update(outdoor({ outside: false, dt: 0.1 }));
  assert.equal(src.gust.volume, 0); assert.ok(src.gust.stops >= 1, 'stopped at nothing');
  fx.configure({ ...CFG, audioEnabled: false });
  assert.ok(src.ambient.stops >= 1, 'the sound switched off stops every source');
});

test('WINDFALL1 the flows: the gust\'s leaves from 13 m upwind and 7 up at its particle response (a smoothstep past 0.3) x the canopy x 32 (48 a storm) x LeafAmount; the ambient leaves 4 upwind and 8 up at 0.25 a second (1.3 windy, 2.6 a storm); the snow in winter under a winter set, steady and by the gust; the sheet by the season, a change clearing the leaves (mutants: the leaves downwind; the storm\'s 48; the snow out of winter; the sheet not cleared)', () => {
  assert.equal(gustParticleResponse(0.3), 0); assert.equal(gustParticleResponse(1), 1); near(gustParticleResponse(0.65), 0.5, 1e-12);
  const fx = createWindfallEffects({ random: seeded() });
  fx.configure(CFG);
  const f = fx.update(outdoor({ gust: 1, storm: true, windyDay: true, windDirection: [0, 1], playerPos: [100, 10, 50] }));
  assert.deepEqual(f.leaves.position, [100, 17, 37], '13 m upwind, 7 up');
  near(f.leaves.rate, 1 * 1 * 1 * 48 * 2.4, 1e-9);
  assert.deepEqual(f.leaves.velocity, [0, -0.35, 1 * (5.5 + 7)], 'the wind x 5.5 + gust x 7, falling 0.35');
  near(f.leaves.noiseStrength, 0.5 + 1.8, 1e-12);
  assert.deepEqual(f.ambientLeaves.position, [100, 18, 46]);
  near(f.ambientLeaves.rate, 2.6, 1e-12);
  assert.equal(f.snow.rate, 0, 'no snow in the fall');
  assert.equal(fx.update(outdoor({ gust: 1, season: 0, natureArchive: 505 })).snow.rate, 0, 'nor off a winter set out of winter');
  assert.equal(fx.leafSeason, 'fall');
  const w = fx.update(outdoor({ gust: 1, season: 3, natureArchive: 505, windDirection: [1, 0], playerPos: [0, 0, 0] }));
  assert.equal(w.leaves.rate, 0, 'no leaves under a winter set');
  near(w.snow.rate, (0.25 + 160) * 1 * 1, 1e-9, 'steady and by the gust');
  assert.deepEqual(w.snow.position, [-13, 7, 0], 'from 13 m upwind at a full gust');
  const s = createWindfallEffects({ random: seeded() });
  s.configure(CFG);
  s.update(outdoor({ season: 1 }));
  assert.equal(s.leafSeason, 'springSummer'); assert.equal(s.flows.leaves.clear, false, 'the sheet it was made with');
  s.update(outdoor({ season: 0 }));
  assert.equal(s.leafSeason, 'fall'); assert.equal(s.flows.leaves.clear, true, 'a new sheet clears the leaves'); assert.equal(s.flows.ambientLeaves.clear, true);
  const t = createWindfallEffects({ random: seeded() });
  t.configure(CFG);
  assert.match(t.triggerLeafTest([0, 0, 0], [1, 0]), /Sixty test leaves blow past/);
  assert.equal(t.flows.leaves.emit, 60);
});

test('WINDFALL1 the AudioSource: a live volume (a playing shot follows it - the fade), a pitch, isPlaying while a shot it started runs, Stop ending them all, a shot that cannot start leaving it idle; the bus\'s SoundVolume left to the bus (mutants: the volume fixed at the shot; isPlaying never true)', () => {
  const nodes = [];
  const ctx = { state: 'running', currentTime: 0, destination: {},
    createGain() { const g = { gain: { value: 1 }, connect(n) { return n; }, disconnect() {}, context: ctx }; nodes.push(g); return g; },
    createBufferSource() { const s = { playbackRate: { value: 1 }, connect(n) { return n; }, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; this.onended?.(); } }; return s; } };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  e.buffers.set('windfall:x', { duration: 2 });
  const s = e.source();
  assert.equal(s.isPlaying, false);
  assert.equal(s.playOneShot('windfall:none'), undefined, 'no such clip: nothing starts');
  assert.equal(s.isPlaying, false);
  s.pitch = 2; s.volume = 0.4;
  assert.equal(s.playOneShot('windfall:x'), 1, 'its length at this pitch');
  assert.equal(s.isPlaying, true);
  const gain = nodes.find((n) => n.gain.value === 0.4);
  assert.ok(gain, 'the source\'s gain carries its volume');
  s.volume = 0.1;
  assert.equal(gain.gain.value, 0.1, 'live');
  s.volume = 3; assert.equal(s.volume, 1, 'clamped as Unity\'s');
  s.stop();
  assert.equal(s.isPlaying, false);
  const fakeEngine = { source: () => ({ volume: 1, pitch: 1, isPlaying: false, playOneShot: (k) => k, stop() {}, dispose() {} }), registerSound: async () => true };
  const wa = windfallAudio(fakeEngine, { make: async () => new Float32Array(4) });
  assert.equal(wa.sources.gust.playOneShot('wind_gust_01'), 'windfall:wind_gust_01', 'a clip by its name, on the bus by its key');
});

test('WINDFALL1 the particles: the three systems at the mod\'s caps (800, 300, 1800), emitted at the flow\'s rate inside the 30 x 10 x 20 box, carried by its velocity over lifetime, gone at their lifetimes, cleared and burst on the flow\'s word, shifted with the floating origin (mutants: the cap; the box twice as wide; the velocity not integrated; a clear ignored)', () => {
  assert.deepEqual([WINDFALL_PARTICLE_SYSTEMS.leaves.maxParticles, WINDFALL_PARTICLE_SYSTEMS.ambientLeaves.maxParticles, WINDFALL_PARTICLE_SYSTEMS.snow.maxParticles], [800, 300, 1800]);
  assert.deepEqual(WINDFALL_EMITTER, { box: [30, 10, 20], noiseFrequency: 0.35, noiseScroll: 0.25 });
  assert.deepEqual(WINDFALL_PICTURES, { springSummer: 'spring_summer_leaves', fall: 'fall_leaves', snow: 'snowflake' });
  const p = new WindfallParticles(null, { random: seeded(9) });
  const flow = () => ({ position: [100, 50, -20], rate: 0, velocity: [0, 0, 0], noiseStrength: 0, clear: false, emit: 0 });
  const flows = { leaves: flow(), ambientLeaves: flow(), snow: flow() };
  flows.leaves.rate = 40;
  for (let i = 0; i < 10; i++) p.step(flows, 0.05);
  assert.equal(p.systems.leaves.count, 20, '40 a second for half a second');
  const L = p.systems.leaves;
  for (let i = 0; i < L.count; i++) {
    assert.ok(Math.abs(L.pos[i * 3] - 100) <= 15 && Math.abs(L.pos[i * 3 + 1] - 50) <= 5 && Math.abs(L.pos[i * 3 + 2] + 20) <= 10, 'inside the box');
    assert.ok(L.size[i] >= 0.16 && L.size[i] <= 0.34 && L.life[i] >= 4 && L.life[i] <= 8 && L.tile[i] >= 0 && L.tile[i] < 64);
  }
  flows.leaves.rate = 0; flows.leaves.velocity = [2, -1, 0];
  const x0 = L.pos[0], y0 = L.pos[1];
  p.step(flows, 0.1);
  near(L.pos[0], x0 + 0.2, 1e-5, 'carried by the velocity'); near(L.pos[1], y0 - 0.1, 1e-5);
  for (let i = 0; i < 100; i++) p.step(flows, 0.1);
  assert.equal(L.count, 0, 'gone at their lifetimes (eight seconds at most)');
  flows.snow.rate = 100000;
  p.step(flows, 0.1);
  assert.equal(p.systems.snow.count, 1800, 'the cap');
  for (let i = 0; i < p.systems.snow.count; i++) assert.equal(p.systems.snow.tile[i], -1, 'the flake is one picture');
  const sx = p.systems.snow.pos[0];
  p.offsetOrigin([819.2, 0, 0]);
  near(p.systems.snow.pos[0], sx + 819.2, 1e-3, 'they stand on the land');
  flows.snow.rate = 0; flows.snow.clear = true;
  p.step(flows, 0.01);
  assert.equal(p.systems.snow.count, 0, 'a clear'); assert.equal(flows.snow.clear, false, 'taken');
  flows.leaves.emit = 60;
  p.step(flows, 0.01);
  assert.equal(p.systems.leaves.count, 60, 'a burst'); assert.equal(flows.leaves.emit, 0);
  assert.equal(p.draw('fall', [], [], [1, 0, 0], [0, 1, 0], [1, 1, 1]), false, 'no context, no pictures: nothing drawn');
});

test('WINDFALL1 / OWN-WORK4 the law\'s numbers, our own: the sway\'s and the shiver\'s reach each its amount x the strength (0..2), the phases, the heading made unit, the anchor - all zero with no law (the mod off, indoors); a batch\'s share its mask under the law, its WIND3 sway else; the most a crown leans (mutants: the shiver\'s strength dropped; the strength uncapped; the share WIND3\'s under the law)', () => {
  const wf = { on: true, outside: true, strength: 1.5, profile: { swayAmplitude: 0.026, shiverAmplitude: 0.012 }, swayPhase: 1, shiverPhase: 2, direction: [3, 4] };
  const u = windfallUniforms(wf, [10, 20]);
  near(u[0], 0.026 * 1.5, 1e-7); near(u[1], 0.012 * 1.5, 1e-7);
  assert.deepEqual([...u.slice(2)].map((v) => Math.round(v * 1e6) / 1e6), [1, 2, 0.6, 0.8, 10, 20]);
  near(windfallUniforms({ ...wf, strength: 0.4 })[1], 0.012 * 0.4, 1e-7, 'linear in the strength');
  assert.equal(WINDFALL_STRENGTH_MAX, 2);
  near(windfallUniforms({ ...wf, strength: 3 })[0], 0.026 * 2, 1e-7, 'the strength capped at 2');
  assert.equal(windfallUniforms({ ...wf, strength: -1 })[1], 0, 'and never below nothing');
  assert.deepEqual([...windfallUniforms({ ...wf, outside: false })], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...windfallUniforms(null)], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(windfallLawOn(u), true); assert.equal(windfallLawOn(new Float32Array(8)), false);
  const b = { sway: 0.6, windfall: 166 / 255 };
  assert.equal(swayShare(b, true), 166 / 255); assert.equal(swayShare(b, false), 0.6); assert.equal(swayShare({}, true), 0);
  near(windfallLeanMax(u, 1, 10), (0.039 + 0.018) * WINDFALL_SCALE_MAX * 10, 1e-6);
  assert.equal(WINDFALL_SCALE_MAX, 1.3, 'a flat\'s reach at its most');
  assert.deepEqual(windfallAnchorAfterShift([0, 0], [819.2, 0, -819.2]), [WINDFALL_ANCHOR_PERIOD - 819.2, 819.2], 'the anchor moves back, wrapped');
  assert.equal(WINDFALL_ANCHOR_PERIOD, 49152);
  for (const pair of Object.values(WINDFALL_TURNS)) for (const t of pair.flat()) assert.ok(Number.isInteger(t), 'every field a whole number of turns over the period');
});

const lean = glslFunctions(WINDFALL_SWAY_GLSL, { uWindfallSway: [0.04, 0.01, 0.7, 1.9], uWindfallAxis: [1, 0, 0, 0] }, { fp32: true });

test('WINDFALL1 / OWN-WORK4 the vertex wind, our own law (run in BB_VS\'s own function): the lean lies along the quad\'s right - a card moves in its own plane - the sway by the heading\'s share across the view, the shiver whatever the heading; linear in the two reaches; each flat 0.7..1.3 of it; a wood bends in patches, flats a metre apart nearly together and 40 m apart not; each field periodic over the anchor\'s wrap; the place the land\'s - a floating-origin shift carried by the anchor moves no flat (mutants: the heading\'s share dropped; the reach widened; the wood field lost; the anchor ignored)', () => {
  const g = lean.globals;
  const across = lean.windfallLean([3.2, 7.7], [1, 0, 0]);
  assert.equal(Math.abs(across[1]), 0, 'level'); assert.equal(Math.abs(across[2]), 0, 'along the right axis alone');
  // the heading's share across the view: none along it, half at 45 degrees; the shiver whatever the heading
  g.uWindfallSway = [0.04, 0, 0.7, 1.9];
  const full = lean.windfallLean([3.2, 7.7], [1, 0, 0])[0];
  assert.ok(Math.abs(full) > 1e-3, `a wind across the view sways the card: ${full}`);
  assert.deepEqual(lean.windfallLean([3.2, 7.7], [0, 0, 1]).map(Math.abs), [0, 0, 0], 'a wind along the view sways no card');
  near(lean.windfallLean([3.2, 7.7], [Math.SQRT1_2, 0, Math.SQRT1_2])[0], full * 0.5, 1e-6, 'at 45 degrees, half along x');
  g.uWindfallSway = [0, 0.01, 0.7, 1.9];
  let shiverAlong = 0;
  for (let i = 0; i < 20; i++) shiverAlong += Math.abs(lean.windfallLean([i * 1.37, 2.5], [0, 0, 1])[2]);
  assert.ok(shiverAlong > 0.02, `the shiver shows along the view: ${shiverAlong}`);
  // linear in the two reaches
  g.uWindfallSway = [0.04, 0.01, 0.7, 1.9];
  const once = lean.windfallLean([3.2, 7.7], [1, 0, 0])[0];
  g.uWindfallSway = [0.08, 0.01, 0.7, 1.9];
  const twice = lean.windfallLean([3.2, 7.7], [1, 0, 0])[0];
  g.uWindfallSway = [0, 0.01, 0.7, 1.9];
  const shiverOnly = lean.windfallLean([3.2, 7.7], [1, 0, 0])[0];
  near(twice - shiverOnly, 2 * (once - shiverOnly), 1e-5, 'linear in the sway\'s reach');
  // each flat 0.7..1.3 of the lean, and never past the reaches x 1.3
  near(lean.windfallReach(0), 0.7, 1e-6); near(lean.windfallReach(1), WINDFALL_SCALE_MAX, 1e-6);
  g.uWindfallSway = [0.04, 0.01, 0.7, 1.9];
  let most = 0;
  for (let i = 0; i < 400; i++) most = Math.max(most, Math.abs(lean.windfallLean([i * 1.37, i * 2.11], [1, 0, 0])[0]));
  assert.ok(most <= 0.05 * WINDFALL_SCALE_MAX + 1e-6 && most > 0.05 * 0.7, `the spread: ${most}`);
  // the wood: the sway of flats a metre apart moves together, 40 m apart it does not
  const sway = (gap) => {
    let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < 200; i++) {
      const p = [(i * 37.13) % 3000, (i * 91.7) % 2500];
      for (const phase of [0, 1.3, 2.9, 4.4]) {
        g.uWindfallSway = [0.04, 0, phase, 0];
        const a = lean.windfallLean(p, [1, 0, 0])[0], b = lean.windfallLean([p[0] + gap, p[1]], [1, 0, 0])[0];
        xy += a * b; xx += a * a; yy += b * b;
      }
    }
    return xy / Math.sqrt(xx * yy);
  };
  const near1 = sway(1), far40 = sway(40);
  assert.ok(near1 > 0.8, `a metre apart, nearly one sway: ${near1}`);
  assert.ok(far40 < 0.4, `40 m apart, another patch: ${far40}`);
  // each field repeats over the anchor's wrap
  const kOf = (t) => [(t[0] * 2 * Math.PI) / WINDFALL_ANCHOR_PERIOD, (t[1] * 2 * Math.PI) / WINDFALL_ANCHOR_PERIOD];
  const field = glslFunctions(WINDFALL_SWAY_GLSL, {}).windfallField;
  for (const pair of Object.values(WINDFALL_TURNS)) {
    const [a, b] = pair.map(kOf);
    near(field([123.4, 567.8], a, b), field([123.4 + WINDFALL_ANCHOR_PERIOD, 567.8 - WINDFALL_ANCHOR_PERIOD], a, b), 1e-6, 'one field a wrap on');
  }
  // the land's place: the scene moved by a shift, the anchor back by it - one lean
  g.uWindfallSway = [0.04, 0.01, 0.7, 1.9];
  g.uWindfallAxis = [0.6, 0.8, 100, 200];
  const before = lean.windfallLean([5.3, 4.1], [1, 0, 0]);
  const [ax, az] = windfallAnchorAfterShift([100, 200], [819.2, 0, -819.2]);
  g.uWindfallAxis = [0.6, 0.8, ax, az];
  const after = lean.windfallLean([5.3 + 819.2, 4.1 - 819.2], [1, 0, 0]);
  near(after[0], before[0], 1e-4, 'a crossing moves no flat (fp32 at the wrap: a place near 49 km holds 4 mm)'); near(after[2], before[2], 1e-4);
  g.uWindfallAxis = [1, 0, 0, 0];
});

const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BBU = { uProj: I16, uView: I16, uRight: [1, 0, 0], uUp: [0, 1, 0], uOrigin: [0, 0, 0], uSize: [2, 4], uFlatWind: [0, 0, 0, 0], uSway: 0, uTip: [0, 0, 0], uFacePoint: [0, 0, 0, 0], uElitePad: [0, 0, 0, 0], uMesh: 0, uMeshScale: [1, 1, 1], uMeshColor: [1, 1, 1], uMeshAlpha: 1, uLptCut: [0, 0, 0, 0], uLptBand: 20, uLptSun: [0, 1, 0, 0], aNormal: [0, 1, 0], aInst: [0, 0, 0, 0], aScale: 1, uWindfallSway: [0, 0, 0, 0], uWindfallAxis: [0, 0, 0, 0] };
const bbAt = (b) => { const f = glslFunctions(bbVertexShader(), { ...BBU, ...b }, { fp32: true }); f.main(); return f.globals; };

test('WINDFALL1 BB_VS: while the mod\'s law stands its lean is the flat\'s - the top corners by the flat\'s height and its mask, the bottom ones still - and WIND3\'s lean is not added; with the law off WIND3\'s is as it was; a low-poly tree leans up its height linearly, as its far picture\'s quad (mutants: both laws at once; the bottom corners moving; the mask ignored; the tree\'s lean squared)', () => {
  const law = { uWindfallSway: [0.04, 0.01, 0.7, 1.9], uWindfallAxis: [1, 0, 0, 0], uFlatWind: [12, 0, 3, 1] };
  const still = bbAt({ aCenter: [10, 0, 0], aCorner: [0.5, 0.5] });
  const top = bbAt({ ...law, uSway: 1, aCenter: [10, 0, 0], aCorner: [0.5, 0.5] });
  const want = lean.windfallLean;
  lean.globals.uWindfallSway = law.uWindfallSway; lean.globals.uWindfallAxis = law.uWindfallAxis;
  const l = want([10, 0], [1, 0, 0]);
  near(top.vBBWorld[0] - still.vBBWorld[0], l[0] * 4, 1e-5, 'the lean x the height (4) at the top, WIND3\'s none');
  const bottom = bbAt({ ...law, uSway: 1, aCenter: [10, 0, 0], aCorner: [0.5, -0.5] });
  assert.deepEqual(bottom.vBBWorld, bbAt({ aCenter: [10, 0, 0], aCorner: [0.5, -0.5] }).vBBWorld, 'the bottom stands');
  const half = bbAt({ ...law, uSway: 0.5, aCenter: [10, 0, 0], aCorner: [0.5, 0.5] });
  near(half.vBBWorld[0] - still.vBBWorld[0], l[0] * 4 * 0.5, 1e-5, 'by its mask');
  const none = bbAt({ ...law, uSway: 0, aCenter: [10, 0, 0], aCorner: [0.5, 0.5] });
  assert.deepEqual(none.vBBWorld, still.vBBWorld, 'a rock\'s mask is 0');
  const wind3 = bbAt({ uFlatWind: [12, 0, 3, 1], uSway: 1, aCenter: [10, 0, 0], aCorner: [0.5, 0.5] });
  assert.ok(wind3.vBBWorld[0] - still.vBBWorld[0] > 0.01, 'with no law, WIND3 leans the crown');
  // the low-poly tree, up its own height
  const tree = (y, sway = 1) => bbAt({ ...law, uMesh: 1, uSway: sway, uSize: [2, 6], aCenter: [0, y, 0], aCorner: [0, 0], aInst: [10, 0, 0, 0], aScale: 1 }).vBBWorld;
  const root = tree(0), crown = tree(6), mid = tree(3);
  near(root[0], 10, 1e-6, 'the root stands');
  near(crown[0] - 10, l[0] * 6, 1e-5, 'the crown by the lean x its height');
  near(mid[0] - 10, l[0] * 6 * 0.5, 1e-5, 'half way up, half - the quad\'s line');
});

test('WINDFALL1 the hosts: world.js and exterior.js build the one runtime on their lane, tick it outdoors (the outdoors\' wind\'s heading handed) and indoors, hand its law to the flats beside WIND3\'s under the sway\'s switch, draw its particles before the haze, and tag every nature batch and every far picture with its mask; world.js carries its anchor across the floating origin; the interiors and the dungeons build none (THE FOUR HOSTS: their frames are the hosts\' indoor branch) (mutants: a host unwired; the law handed without the switch)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.match(s, /const windfall = createWindfallHost\(\{ gl: renderer\.gl, enhanced: !!sky\.enhanced \}\);/, `${host}: built on the lane`);
    // AUDIT ENVIRONS: WindMod.Update's Time.deltaTime - held by a pause, scaled with the world (the host's own scale)
    const scaled = host.endsWith('world.js') ? 'dt: gamePaused\\(\\) \\? 0 : dt \\* worldTimeScale\\(\\)' : 'dt: gamePaused\\(\\) \\? 0 : dt \\* hccTimeScale\\(\\)';
    assert.match(s, new RegExp(`windfall\\.frame\\(\\{ ${scaled}, outside: false, `), `${host}: ticked indoors, on the game's seconds`);
    assert.match(s, new RegExp(`const windfallLaw = windfall\\.frame\\(\\{ ${scaled}, outside: true, [^\\n]*\\n\\s*heading: wd\\.on \\? wd\\.dir : null,`), `${host}: ticked outdoors on the one wind, on the game's seconds`);
    assert.match(s, /renderer\.setFlatWind\([^\n]*, floraSwayOn\(\) && wd\.on \? windfallLaw : null\);/, `${host}: the law under the sway's switch`);
    assert.ok(s.indexOf('windfall.draw(proj, view, renderer.flatLightAt(') < s.indexOf('if (hazeGl) {', s.indexOf('windfall.draw(proj')), `${host}: the particles before the haze grabs the world`);
    assert.equal((s.match(/batch\.windfall = windfallResponse\(archive, record/g) || []).length, 3, `${host}: the far picture, the season's and the classic batch`);
    assert.match(host.endsWith('world.js') ? read('src/scenes/treesHost.js') : s, /windfallOf: \(proto\) => _?lptWindfall\.get\(proto\) \?\? 0/, `${host}: the 3D trees by their far pictures' mask`);   // BANTHA1 (HOST-SPLIT): the world's near trees are scenes/treesHost.js's
  }
  assert.match(hostText('src/scenes/world.js'), /windfall\.offsetOrigin\(r\.offset\);/);
  assert.match(hostText('src/scenes/world.js'), /csaReanchor\(state\.initOffset\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*snowfall\.offsetOrigin\(state\.initOffset\);\n\s*windfall\.offsetOrigin\(state\.initOffset\);/, 'AUDIT ENVIRONS: a teleport\'s new frame carries the anchor and the leaves in the air, as a recentre does');
  assert.match(read('src/scenes/yardNature.js'), /batch\.windfall = pic\.windfall;/);
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(host), /createWindfallHost/, `${host}: none`);
  // the passes: the shadow and the air replay by the law the flats were drawn with
  const sp = read('src/render/shadowPass.js');
  assert.match(sp, /if \(P\.bb\.wfAxis\) \{ gl\.uniform4fv\(P\.bb\.wfSway, r\.wfSway\); gl\.uniform4fv\(P\.bb\.wfAxis, r\.wfAxis\); \}/);
  assert.match(sp, /const sw = swayShare\(b, law\);/);
  assert.match(read('src/render/airPass.js'), /gl\.uniform1f\(P\.emitBb\.uSway, swayShare\(b, windfallLawOn\(r\.windfall\)\)\);/);
});

test('WINDFALL1 the runtime (scenes/windfallHost.js): off the enhanced lane it answers no law and does nothing; on it, a law outdoors and none indoors; its save record and its console command registered, the command there while the mod is (AUDIT 28 F7) (mutants: the lane ignored; the indoor law kept; the gate dropped)', () => {
  const engine = { source: () => ({ volume: 1, pitch: 1, isPlaying: false, playOneShot() {}, stop() {}, dispose() {} }), registerSound: async () => true };
  const f = { dt: 0.02, outside: true, weather: 'sunny', minutes: 523530, climate: 231, mapPixel: { x: 100, y: 200 }, heading: [1, 0], feet: [0, 0, 0], height: 1.8 };
  const classic = createWindfallHost({ enhanced: false, engine, picture: async () => null });
  assert.equal(classic.frame(f), null);
  setModSetting('windfall', 'Enabled', true);
  const host = createWindfallHost({ enhanced: true, engine, random: seeded(), picture: async () => null });
  const law = host.frame(f);
  assert.ok(law instanceof Float32Array && law.length === 8 && windfallLawOn(law), 'a law outdoors');
  assert.equal(host.frame({ ...f, outside: false }), null, 'none indoors');
  assert.ok(registeredModSaveVendors().includes('windfall'));
  assert.equal(hasConsoleCommand('windfall'), true);
  assert.match(executeConsoleCommand('windfall', ['storm']), /Wind test mode: storm/);
  assert.match(executeConsoleCommand('windfall', ['status']), /^override=storm/);
  assert.match(executeConsoleCommand('windfall', []), /^Usage: windfall/);
  setModSetting('windfall', 'Enabled', false);
  assert.equal(hasConsoleCommand('windfall'), false, 'the mod off: no command');
  assert.equal(host.frame(f), null, 'the mod off: no law');
});
