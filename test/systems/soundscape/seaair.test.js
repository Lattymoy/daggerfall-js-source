// SEA-AIR (2026-10-24, the owner: "different music and ambience sounds for sailing"; bible/08-Audio/Audio.md SOUNDSCAPE):
// THE DECK'S AIR AT SEA (systems/soundscape/seaAir.js). The laws: the sea state of the wind and the weather; the swell's
// clock; the three beds' levels and pitches (the swell's floor and gale, the wash nothing until she has way, the rigging
// only in a strong wind or a storm); the gulls' weather and gaps; the watch bells - the count each half hour of a
// watch, struck in pairs. The driver against a fake engine and seeded dice: the beds named and stopped, nothing on the
// first frame aboard, the gulls only by day in fair weather with land near and nothing else of the deck's own
// (DECK-QUIET, 2026-10-26: the slaps, creaks, ropes, luffs and spray gone), her bell hers and never the camera's, a
// pause holding every clock, the bells at the world's own pace only - a half hour crossed (midnight too), never a jump,
// never at a dial's pace, never twice in a minute of real time. AUDIT SOUNDSCAPE (2026-10-24): S1, S3, S6, S9; every
// number the record states pinned to its literal (P6).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seaState, seaSwellAt, swellBed, washBed, riggingBed, gullsAbout, watchBells, bellStrokes,
  createSeaAir, SEA_BEDS, SEA_FAR, SWELL_WAVES, SEA_STATE_FLOOR, SEA_WEATHER, BELL_CLIP, BELL_PITCH, BELL_MIN_REAL_S,
  GULL_GAP_S, GULL_PAIR, BELL_STROKE_S, BELL_PAIR_S, NORMAL_PACE, BELL_MAX_PACE, BELL_PACE_TAU_S,
} from '../../../src/systems/soundscape/seaAir.js';
import { SCAPE_SFX } from '../../../src/systems/soundscape/soundscapeSfx.js';
import { _resetMade } from '../../../src/systems/soundscape/soundJobs.js';

/** mulberry32 - the tests' dice */
const dice = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** An engine that records: beds by name, one-shots in order, the far tags let go. */
function fakeEngine() {
  const e = {
    beds: new Map(), shots: [], faded: [], registered: new Set(),
    registerSamples(key) { e.registered.add(key); return true; },
    setBed(name, clip, o = {}) { if (clip == null) e.beds.delete(name); else e.beds.set(name, { clip, ...o }); },
    setBed3d() {},
    play3d(clip, pos, volume, o) { e.shots.push({ clip, pos, volume, ...o }); return 1; },
    fadeFar(tag) { e.faded.push(tag); },
  };
  return e;
}
const DECK = Object.freeze({ ear: [0, 0, 0], fwd: [0, 0, 1], way: 0, wind: 0.4, gust: 0.7, weather: 'sunny', night: false, nearLand: false, minute: 600, paused: false });
const run = (air, seconds, s, dt = 1 / 30) => { for (let k = 0; k < Math.round(seconds / dt); k++) air.frame(dt, typeof s === 'function' ? s(k * dt) : s); };

// ── the laws ──────────────────────────────────────────────────────────

test('SEA-AIR THE SEA STATE: the floor in a flat calm, seven tenths of the wind over it, the weather\'s own - a rain\'s squalls, a storm\'s seas, snow - held to 0..1 (mutants: the floor dropped; the storm\'s share; the wind\'s share; the clamp)', () => {
  assert.equal(SEA_STATE_FLOOR, 0.15);
  assert.deepEqual({ ...SEA_WEATHER }, { rain: 0.12, thunder: 0.35, snow: 0.06 });
  const rows = [[0, 'sunny'], [0.5, 'sunny'], [1, 'sunny'], [0.5, 'rain'], [0.5, 'thunder'], [0.5, 'snow'], [1, 'thunder'], [-2, 'fog'], [NaN, 'cloudy']];
  assert.deepEqual(rows.map(([w, x]) => Math.round(seaState(w, x) * 1000) / 1000), [0.15, 0.5, 0.85, 0.62, 0.85, 0.56, 1, 0.15, 0.15]);
});

test('SEA-AIR THE SWELL\'S CLOCK: three long waves (8.3, 12.7 and 5.1 s) whose shares are the whole, summed to 0..1 about a half - no two swells alike (mutants: a wave\'s period; a share; the half dropped)', () => {
  assert.deepEqual(SWELL_WAVES.map((w) => [...w]), [[8.3, 0.55, 0], [12.7, 0.3, 1.3], [5.1, 0.15, 0.4]]);
  assert.ok(near(SWELL_WAVES.reduce((a, [, s]) => a + s, 0), 1));
  const expect = (t) => 0.5 + 0.5 * (0.55 * Math.sin((2 * Math.PI * t) / 8.3) + 0.3 * Math.sin((2 * Math.PI * t) / 12.7 + 1.3) + 0.15 * Math.sin((2 * Math.PI * t) / 5.1 + 0.4));
  for (const t of [0, 1.7, 4.2, 9.9, 33.3, 120]) assert.ok(near(seaSwellAt(t), expect(t)), `t ${t}`);
  const CREST = 0.72;   // a swell's top: the bed's gain rides it
  let lo = 1, hi = 0, crests = 0, was = seaSwellAt(0);
  for (let t = 0.05; t < 600; t += 0.05) { const v = seaSwellAt(t); lo = Math.min(lo, v); hi = Math.max(hi, v); if (was < CREST && v >= CREST) crests++; was = v; }
  assert.ok(lo >= 0 && hi <= 1 && hi > CREST && lo < 0.2, `${lo} ${hi}`);
  assert.ok(crests > 40 && crests < 110, `a crest every 5 to 15 s over ten minutes: ${crests}`);
});

test('SEA-AIR THE BEDS: the swell from its floor in a calm to its gale\'s, riding the swell; the wash nothing until she has way and all of it at full way; the rigging nothing below a strong wind, a storm adding its own, breathing with the gust (mutants: the swell\'s depth; the wash\'s threshold; the rigging\'s threshold; the storm\'s share)', () => {
  const { min, max, depth } = SEA_BEDS.swell;
  assert.deepEqual([min, max, depth], [0.15, 0.78, 0.55], 'AUDIT SOUNDSCAPE S6: levelled against the mod\'s hull loops');
  const t = 3.1, s = seaSwellAt(t);
  assert.ok(near(swellBed(0, t).volume, min * (1 - depth + depth * s)));
  assert.ok(near(swellBed(1, t).volume, max * (1 - depth + depth * s)));
  assert.ok(swellBed(0.6, 0).pitch > swellBed(0.1, 0).pitch, 'a heavier sea rolls deeper and wider');
  assert.deepEqual([SEA_BEDS.wash.max, SEA_BEDS.wash.from, SEA_BEDS.wash.full], [0.6, 0.4, 7]);
  assert.deepEqual([SEA_BEDS.rigging.max, SEA_BEDS.rigging.from], [0.42, 0.5]);
  assert.equal(washBed(0, 0.5, 2).volume, 0, 'no way, no wash');
  assert.equal(washBed(0.3, 0.5, 2).volume, 0, 'steerage way is not yet a wash');
  assert.equal(washBed(SEA_BEDS.wash.from, 0.5, 2).volume, 0, 'the threshold itself is silent');
  assert.ok(washBed(SEA_BEDS.wash.full, 1, 1.7).volume > washBed(3, 1, 1.7).volume && washBed(3, 1, 1.7).volume > 0);
  assert.ok(near(washBed(SEA_BEDS.wash.full, 1, 1.7).volume, SEA_BEDS.wash.max * (0.75 + 0.25 * seaSwellAt(0))), 'full way: the max, riding the swell a beat behind');
  assert.equal(riggingBed(0.5, 1, 'sunny').volume, 0, 'a fresh breeze does not moan in the lines');
  assert.ok(riggingBed(0.5, 1, 'thunder').volume > 0, 'a storm does');
  assert.ok(near(riggingBed(1, 1, 'sunny').volume, SEA_BEDS.rigging.max), 'a full gale at its height: the max');
  assert.ok(riggingBed(1, 0, 'sunny').volume < riggingBed(1, 1, 'sunny').volume, 'the gust');
});

test('SEA-AIR THE GULLS\' LAW: by day out of rain, storm and snow with land near, a call every 7 to 26 s and three in ten followed by a second (mutants: the gulls\' rain; the gulls\' gaps)', () => {
  assert.deepEqual([[...GULL_GAP_S], GULL_PAIR], [[7, 26], 0.3]);
  assert.deepEqual(['sunny', 'cloudy', 'fog', 'rain', 'thunder', 'snow'].map((weather) => gullsAbout({ nearLand: true, night: false, weather })), [true, true, true, false, false, false]);
  assert.equal(gullsAbout({ nearLand: true, night: true, weather: 'sunny' }), false);
  assert.equal(gullsAbout({ nearLand: false, night: false, weather: 'sunny' }), false);
});

test('SEA-AIR THE WATCH BELLS: one at the half hour after a watch begins (the watches turning at 0, 4, 8, 12, 16 and 20), one more each half hour, eight as it ends; struck in pairs, an odd bell alone at the end (mutants: the watch\'s length; the eight at the turn; the pair\'s gap)', () => {
  const day = Array.from({ length: 48 }, (_, h) => watchBells(h * 30));
  assert.deepEqual(day.slice(0, 9), [8, 1, 2, 3, 4, 5, 6, 7, 8]);
  for (let w = 0; w < 6; w++) assert.deepEqual(day.slice(w * 8, w * 8 + 8), [8, 1, 2, 3, 4, 5, 6, 7], `watch ${w}`);
  assert.equal(watchBells(1439), 7, 'the middle watch\'s last half hour');
  assert.equal(watchBells(-30), 7, 'a minute before the day wraps');
  assert.deepEqual(bellStrokes(5).map((t) => Math.round(t * 100) / 100), [0, 0.42, 1.15, 1.57, 2.3]);
  assert.deepEqual(bellStrokes(8).length, 8);
  assert.deepEqual(bellStrokes(0), []);
  assert.deepEqual([BELL_CLIP, BELL_PITCH, BELL_MIN_REAL_S, BELL_STROKE_S, BELL_PAIR_S], [107, 1.22, 60, 0.42, 1.15]);
  assert.deepEqual([NORMAL_PACE, BELL_MAX_PACE, BELL_PACE_TAU_S], [0.2, 0.5, 3], 'DFU\'s 12 to 1 is 0.2 of the world\'s minutes a real second');
});

// ── the driver ────────────────────────────────────────────────────────

test('SEA-AIR THE DRIVER\'S BEDS: the swell, the wash and the rigging named on the engine and made first (soundBeds.js), their levels the laws\'; stop lets every bed go and the deck\'s far shots with it, once (mutants: a bed never let go; the far shots kept; a second stop)', () => {
  _resetMade();
  const e = fakeEngine();
  const air = createSeaAir({ engine: e, rand: dice(1) });
  run(air, 2, { ...DECK, way: 6, wind: 1, weather: 'thunder' });
  assert.deepEqual([...e.beds.keys()].sort(), ['sea:rigging', 'sea:swell', 'sea:wash']);
  assert.ok([...e.registered].includes('sea:swell'));
  assert.equal(e.beds.get('sea:swell').clip, 'sea:swell');
  air.stop();
  assert.deepEqual([...e.beds.keys()], [], 'every bed let go');
  assert.deepEqual(e.faded, [SEA_FAR]);
  air.stop();
  assert.deepEqual(e.faded, [SEA_FAR], 'a second stop sends nothing');
  run(air, 1, { ...DECK, way: 0, wind: 0.2 });
  assert.equal(e.beds.has('sea:wash'), false, 'no way, no wash bed at all');
  assert.equal(e.beds.has('sea:rigging'), false, 'a light wind, no rigging');
});

/** The world's clock running from `m0` at `pace` of its minutes a real second (DFU's 12 to 1 is NORMAL_PACE), wrapping
 *  at midnight as the clock's minute of the day does. */
const ticking = (m0, pace = NORMAL_PACE) => (t) => (m0 + pace * t) % 1440;
/** Frames through the air with the engine told each frame's time and number - so a shot says when it was played. */
function runAt(e, air, seconds, s, dt = 1 / 30) {
  for (let k = 0; k < Math.round(seconds / dt); k++) { e.now = (e.now ?? 0) + dt; e.frame = (e.frame ?? 0) + 1; air.frame(dt, typeof s === 'function' ? s(k * dt) : s); }
}
function timedEngine() {
  const e = fakeEngine();
  const play3d = e.play3d;
  e.play3d = (clip, pos, volume, o) => { play3d(clip, pos, volume, o); Object.assign(e.shots.at(-1), { at: e.now, frame: e.frame }); return 1; };
  return e;
}

test('SEA-AIR THE DRIVER\'S EVENTS: nothing on the first frame aboard; the gulls only with land near by day in fair weather, over the water off the ship; and nothing of the deck\'s own - no slap, creak, rope, luff or spray in a storm at speed with sail set head to wind (DECK-QUIET, 2026-10-26: "Remove all deck at sea") (mutants: the clocks unseeded; the gulls\' law)', () => {
  const e = fakeEngine();
  const air = createSeaAir({ engine: e, rand: dice(7) });
  air.frame(1 / 30, { ...DECK, nearLand: true });
  assert.deepEqual(e.shots, [], 'the first frame aboard plays nothing');
  run(air, 90, { ...DECK, wind: 1, weather: 'thunder', way: 9, sailsUp: true, inIrons: true });
  assert.deepEqual(e.shots, [], 'a storm at speed, sail set head to wind, no land near: the deck sounds nothing of its own');
  const of = (group) => e.shots.filter((s) => SCAPE_SFX[group].includes(s.clip));
  run(air, 60, { ...DECK, wind: 0.9, weather: 'sunny', way: 9, nearLand: true });
  assert.ok(of('gull').length >= 2, `the gulls: ${of('gull').length}`);
  assert.equal(of('gull').length, e.shots.length, 'the gulls and nothing else');
  for (const s of of('gull')) assert.ok(s.pos[1] >= 12 && s.pos[1] <= 30 && Math.hypot(s.pos[0], s.pos[2]) >= 22 && Math.hypot(s.pos[0], s.pos[2]) <= 70, 'over the water, off the ship');
  e.shots.length = 0;
  run(air, 120, { ...DECK, night: true, nearLand: true });
  assert.equal(of('gull').length, 0, 'none at night');
  run(air, 120, { ...DECK, weather: 'rain', nearLand: true });
  assert.equal(of('gull').length, 0, 'none in the rain');
});

test('SEA-AIR HER BOW, NOT THE CAMERA (AUDIT SOUNDSCAPE S3): her heading given, the bell on her deck ahead whatever way the ear looks; with none, the ear\'s forward (mutants: the bell turning with the head)', () => {
  const bellOf = (bow) => {
    const e = fakeEngine();
    const air = createSeaAir({ engine: e, rand: dice(11) });
    // the helmsman looks astern-ish (-z)
    run(air, 12, (t) => ({ ...DECK, fwd: [0, 0, -1], bow, minute: ticking(29, NORMAL_PACE)(t) }));
    const bell = e.shots.filter((s) => s.clip === BELL_CLIP);
    assert.equal(bell.length, 1);
    return bell[0].pos.map((v) => Math.round(v * 1e9) / 1e9);
  };
  assert.deepEqual(bellOf([1, 0, 0]), [3, 2.5, 0], 'she heads +x: on her deck, ahead');
  assert.deepEqual(bellOf(null), [0, 2.5, -3], 'no bow given: the ear\'s forward');
});

test('SEA-AIR A PAUSE (AUDIT SOUNDSCAPE S1): a pause holds every clock - nothing played under it, and the bell\'s strokes due across it fall at their own spacing after, never together on the unpause frame (mutants: the pause ignored; the clock run under a pause)', () => {
  const e = timedEngine();
  const air = createSeaAir({ engine: e, rand: dice(5) });
  const clock = ticking(239, NORMAL_PACE);
  let elapsed = 0;
  const frameAt = (paused) => (t) => ({ ...DECK, wind: 1, weather: 'thunder', way: 9, nearLand: true, minute: clock(elapsed + t), paused });
  runAt(e, air, 6, frameAt(false));   // eight bells due from 5 s on
  elapsed = 6;
  const before = e.shots.length;
  runAt(e, air, 20, frameAt(true));
  assert.equal(e.shots.length, before, 'nothing under a pause');
  runAt(e, air, 10, frameAt(false));
  const strokes = e.shots.filter((s) => s.clip === BELL_CLIP);
  assert.equal(strokes.length, 8, 'the watch\'s eight, all of them');
  const perFrame = new Map();
  for (const s of strokes) perFrame.set(s.frame, (perFrame.get(s.frame) ?? 0) + 1);
  assert.ok(Math.max(...perFrame.values()) === 1, 'one stroke a frame - never bunched on the unpause');
});

test('SEA-AIR THE DRIVER\'S BELLS (AUDIT SOUNDSCAPE S9): a half hour of the world\'s clock crossed at its own pace - read off the clock, never a dial - strikes the watch\'s count on Daggerfall\'s bell, aloft, in pairs; midnight\'s eight; none at a dial\'s pace (Come Sail Away\'s x5 is five times DFU\'s), none for a jump, none twice inside BELL_MIN_REAL_S (mutants: the wrap; the pace\'s gate; the jump\'s gate; the real-time gap)', () => {
  const strokes = (clock, seconds = 12) => {
    const e = fakeEngine();
    const air = createSeaAir({ engine: e, rand: dice(3) });
    run(air, seconds, (t) => ({ ...DECK, minute: clock(t) }));
    return e.shots.filter((s) => s.clip === BELL_CLIP);
  };
  const one = strokes(ticking(29));
  assert.equal(one.length, 1, 'the half hour after the watch began: one bell');
  assert.deepEqual([one[0].pitch, one[0].far, one[0].pos[2] > 0, one[0].pos[1]], [BELL_PITCH, SEA_FAR, true, 2.5]);
  assert.equal(strokes(ticking(239)).length, 8, 'the watch ends at four: eight bells');
  assert.equal(strokes(ticking(1439)).length, 8, 'midnight wraps the minute of the day and still strikes eight');
  assert.equal(strokes(ticking(85, 5 * NORMAL_PACE)).length, 0, 'the helm\'s x5: a pace the bells never ring at');
  assert.equal(strokes(ticking(1435, 5 * NORMAL_PACE)).length, 0, 'nor at midnight');
  assert.equal(strokes((t) => (t < 4 ? 30.5 : 150.5)).length, 0, 'a jump of the clock is not a half hour struck');
  // the clock set back over a half hour it has just struck: not again inside a minute of real time, and again past it
  assert.equal(strokes((t) => (t < 6 ? ticking(29)(t) : ticking(29.5)(t - 6)), 20).length, 1, 'never twice inside BELL_MIN_REAL_S');
  assert.equal(strokes((t) => (t < 6 ? ticking(29)(t) : t < 66 ? 29.5 : ticking(29.5)(t - 66)), 80).length, 2, 'past it, again');
});
