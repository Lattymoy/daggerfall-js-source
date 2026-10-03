// ARENA2 (2026-10-02, Mac: "During fights, the crowd is present and can cheer/boo you"): THE CROWD - its mood moved by
// the bout's events and settling back (systems/arenaCrowd.js), its favour (the darling, the villain, the home crowd, the
// beast tier's sympathy), the cues it sounds and the barks it shouts (never the same twice running, one every gap), how
// it moves (the gesturers' rate, the hop, what it throws), how many come, who sits where; THE SOUND built at runtime out
// of DAGGER.SND's own voices and noise (systems/arenaSound.js - the shapes, the levels, the loop's seam, the driver's
// cues onto the engine, nothing shipped); and THE MUSIC made in code (systems/arenaScore.js) and its law by phase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  newCrowd, crowdHear, crowdTick, crowdBark, moodBand, darlingOf, villainOf, crowdCount, crowdFlipFps, crowdHop, verdictThrows,
  seatPeople, MOOD_PUSH, FAVOUR_PUSH, MOOD_SETTLE_S, HOME_FAVOUR, BEAST_BASE, BARK_GAP_MS, HATED_AT, FLIP_FPS, FLIP_ROAR_X, HOP_M,
  HOP_MS, CROWD_MAX, CROWD_PEOPLE, THROWN_FLOWERS, THROWN_REFUSE, YIELD_EARLY_SHARE,
} from '../src/systems/arenaCrowd.js';
import {
  synthBed, synthCheer, synthRoar, synthBoo, synthApplause, synthArenaSounds, createArenaSound, addVoice, noise, lowpass,
  highpass, rms, level, swell, bedGain, PEOPLE_RECORDS, ARENA_CLIPS, ARENA_SOUND_KEYS, ARENA_SOUND_RATE, ARENA_SOUND_SECONDS,
  ARENA_SOUND_RMS, BED_GAIN,
} from '../src/systems/arenaSound.js';
import { arenaScoreSongs, arenaScoreFor, ARENA_SONGS, ARENA_SCORE_SILENCE, ARENA_STING_MS } from '../src/systems/arenaScore.js';
import { seededRng } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';

const F = [{ id: 'a', home: 'Wayrest', ai: true }, { id: 'b', home: 'Daggerfall', ai: true }];
const cues = (list) => list.map((c) => c.s);

test('ARENA2 crowd: a new crowd - the home crowd loves Daggerfall\'s own; the beast tier starts sour, pities the man thrown in', () => {
  const c = newCrowd({ fighters: F });
  assert.deepEqual(c.favour, { a: 0, b: HOME_FAVOUR });
  assert.equal(c.mood, 0);
  const beast = newCrowd({ fighters: [{ id: 'you', home: '', ai: false }, { id: 'f0', home: 'the Bayside Woods', ai: true }], beasts: true });
  assert.equal(beast.base, BEAST_BASE);
  assert.equal(beast.favour.you, 0.2);
  assert.equal(newCrowd({ base: 2 }).base, 1, 'a base held to the scale');
});

test('ARENA2 crowd: MOOD moves with the bout - a crit, a comeback, a fall up; a stall, a flight, an early yield down - and settles', () => {
  const c = newCrowd({ fighters: F });
  crowdHear(c, { k: 'crit', a: 'a', b: 'b' });
  assert.equal(c.mood, MOOD_PUSH.crit);
  crowdHear(c, { k: 'comeback', a: 'b' });
  assert.equal(c.mood, MOOD_PUSH.crit + MOOD_PUSH.comeback);
  assert.equal(c.peak, c.mood);
  const was = c.mood;
  crowdHear(c, { k: 'stall' });
  assert.ok(c.mood < was);
  crowdHear(c, { k: 'flee', a: 'a' });
  crowdHear(c, { k: 'yield', a: 'a' }, { share: () => 0.5 });
  for (let i = 0; i < 8; i++) crowdHear(c, { k: 'stall' });
  assert.equal(c.mood, -1, 'held to the scale');
  crowdTick(c, MOOD_SETTLE_S);
  assert.ok(Math.abs(c.mood - (-1 * Math.exp(-1))) < 1e-9, 'one time constant takes it most of the way back');
  crowdTick(c, 0);
  crowdTick(null, 1);
  assert.equal(MOOD_SETTLE_S, 7);
});

test('ARENA2 crowd: the bands - booing, jeering, murmuring, cheering, roaring - and their words', () => {
  assert.deepEqual([-0.9, -0.3, 0, 0.3, 0.8].map(moodBand), ['boo', 'jeer', 'murmur', 'cheer', 'roar']);
  assert.deepEqual([-0.5, -0.15, 0.15, 0.6].map(moodBand), ['boo', 'murmur', 'murmur', 'roar']);
  for (const b of ['boo', 'jeer', 'murmur', 'cheer', 'roar']) assert.ok(ARENA_TEXT.mood[b]);
});

test('ARENA2 crowd: FAVOUR - a darling and a villain; a hated fighter is booed at every blow', () => {
  const c = newCrowd({ fighters: F });
  assert.equal(darlingOf(c), 'b', 'the home crowd\'s from the start');
  assert.equal(villainOf(c), null);
  crowdHear(c, { k: 'flee', a: 'a' });
  crowdHear(c, { k: 'yield', a: 'a' }, { share: () => 0.9 });
  assert.ok(c.favour.a <= HATED_AT);
  assert.equal(villainOf(c), 'a');
  const before = c.mood;
  const cu = crowdHear(c, { k: 'hit', a: 'a', b: 'b' });
  assert.deepEqual(cues(cu), ['boo'], 'booed every time they strike');
  assert.ok(c.mood < before);
  crowdHear(c, { k: 'comeback', a: 'b' });
  assert.equal(darlingOf(c), 'b');
  assert.equal(FAVOUR_PUSH.comeback, 0.35);
  assert.equal(darlingOf(null), null);
  assert.equal(villainOf(undefined), null);
});

test('ARENA2 crowd: an EARLY yield is the crowd\'s anger; one at the floor of the line is a shrug', () => {
  assert.equal(YIELD_EARLY_SHARE, 0.1);
  const c = newCrowd({ fighters: F });
  crowdHear(c, { k: 'yield', a: 'a' }, { share: () => 0.12 });
  assert.equal(c.mood, MOOD_PUSH.yieldEarly);
  const d = newCrowd({ fighters: F });
  const cu = crowdHear(d, { k: 'yield', a: 'a' }, { share: () => 0.05 });
  assert.equal(d.mood, MOOD_PUSH.yield);
  assert.deepEqual(cu, [{ s: 'boo', v: 0.6 }]);
});

test('ARENA2 crowd: what it SOUNDS - drums before the call, the bell at the word, gasps at a crit, a groan at a knockdown, the fanfares', () => {
  const c = newCrowd({ fighters: F });
  assert.deepEqual(cues(crowdHear(c, { k: 'call' })), ['drumsCall', 'cheer']);
  assert.deepEqual(cues(crowdHear(c, { k: 'walk' })), ['drums']);
  assert.deepEqual(cues(crowdHear(c, { k: 'fight' })), ['bell', 'roar']);
  assert.deepEqual(cues(crowdHear(c, { k: 'crit', a: 'a' }, { now: 5 })), ['gasp', 'roar']);
  assert.deepEqual(cues(crowdHear(c, { k: 'knockdown', a: 'a' })), ['groan', 'roar']);
  assert.deepEqual(cues(crowdHear(c, { k: 'timeout' })), ['bell', 'boo']);
  assert.deepEqual(cues(crowdHear(c, { k: 'verdict' })), ['applause', 'fanfare']);
  assert.deepEqual(cues(crowdHear(c, { k: 'verdict' }, { title: true })), ['applause', 'title'], 'a title\'s own fanfare');
  assert.deepEqual(crowdHear(c, { k: 'miss', a: 'a' }), []);
  assert.deepEqual(crowdHear(null, { k: 'call' }), []);
  assert.deepEqual(crowdHear(c, { k: 'nothing' }), []);
  assert.ok(crowdHear(c, { k: 'crier', a: 'b' })[0].v > crowdHear(c, { k: 'crier', a: 'a' })[0].v, 'the home crowd cheers its own louder');
});

test('ARENA2 crowd: BARKS - one every gap, never the same line twice running, the boos\' own lines for a villain, a town\'s chant', () => {
  assert.equal(BARK_GAP_MS, 2600);
  const c = newCrowd({ fighters: F });
  const dice = seededRng(3);
  const a = crowdBark(c, { k: 'crit', a: 'a' }, 10000, () => 0.9);
  assert.ok(ARENA_TEXT.barks.crit.includes(a));
  assert.equal(crowdBark(c, { k: 'crit', a: 'a' }, 10000 + BARK_GAP_MS - 1, dice), null, 'too soon');
  const b = crowdBark(c, { k: 'crit', a: 'a' }, 10000 + BARK_GAP_MS, () => 0.9);
  assert.notEqual(b, a, 'never the same line twice running');
  assert.equal(crowdBark(c, { k: 'hit', a: 'a' }, 20000, () => 0.9), null, 'a plain hit is barked at only now and then');
  c.favour.a = -0.8;
  assert.ok(ARENA_TEXT.barks.hitHated.includes(crowdBark(c, { k: 'hit', a: 'a' }, 30000, () => 0.5)));
  assert.equal(crowdBark(c, { k: 'comeback', a: 'b' }, 40000, () => 0), ARENA_TEXT.chant('Daggerfall'), 'the darling\'s town, chanted');
  assert.ok(ARENA_TEXT.barks.stall.includes(crowdBark(c, { k: 'stall' }, 50000, () => 0.5)));
  assert.ok(ARENA_TEXT.barks.beast.includes(crowdBark(newCrowd({ beasts: true }), { k: 'fight' }, 0, () => 0.5)));
  assert.equal(crowdBark(c, { k: 'call' }, 90000, dice), null, 'the Herald speaks for the call');
  assert.equal(crowdBark(null, { k: 'crit' }, 0), null);
});

test('ARENA2 crowd: SIGHT - the gesturers flip faster at a roar, the tiers hop at a crit and fall away; flowers and refuse by favour', () => {
  assert.equal(crowdFlipFps(0), FLIP_FPS);
  assert.equal(crowdFlipFps(-1), FLIP_FPS, 'a booing crowd still moves at the classic rate');
  assert.equal(crowdFlipFps(1), FLIP_FPS * FLIP_ROAR_X);
  const c = newCrowd({ fighters: F });
  assert.equal(crowdHop(c, 0), 0);
  crowdHear(c, { k: 'crit', a: 'a' }, { now: 1000 });
  assert.equal(crowdHop(c, 1000), 0);
  assert.ok(Math.abs(crowdHop(c, 1000 + HOP_MS / 2) - HOP_M) < 1e-9, 'the top of the hop');
  assert.equal(crowdHop(c, 1000 + HOP_MS), 0);
  assert.equal(crowdHop(null, 5), 0);
  const liked = verdictThrows({ mood: 0.5, favour: { a: 0.6, b: -0.6 } }, ['a'], ['b']);
  assert.ok(liked.flowers > 0 && liked.refuse > 0, 'flowers for the darling, refuse for the beaten villain');
  const hated = verdictThrows({ mood: 0, favour: { a: -0.8, b: 0 } }, ['a'], ['b']);
  assert.equal(hated.flowers, 0);
  assert.ok(hated.refuse > 0);
  assert.deepEqual(verdictThrows({ mood: 0, favour: {} }, [], []), { flowers: 0, refuse: 0 }, 'a draw: nothing thrown');
  assert.ok(verdictThrows({ mood: 1, favour: { a: 1 } }, ['a'], []).flowers <= 16);
  for (const [a] of [...THROWN_FLOWERS, ...THROWN_REFUSE]) assert.equal(a, 254, 'Daggerfall\'s own item pictures');
});

test('ARENA2 crowd: HOW MANY come - an exhibition\'s afternoon, a ladder bout by its tier, a champion more, the Grand Champion sold out', () => {
  assert.equal(crowdCount({ kind: 'exhibition' }), 140);
  assert.ok(crowdCount({ kind: 'ladder', tier: 0 }) < crowdCount({ kind: 'ladder', tier: 9 }));
  assert.ok(crowdCount({ kind: 'ladder', tier: 3, champion: true }) > crowdCount({ kind: 'ladder', tier: 3 }));
  assert.equal(crowdCount({ grand: true }), CROWD_MAX);
  assert.ok(crowdCount({ kind: 'ladder', tier: 99, champion: true }) <= CROWD_MAX);
  assert.ok(CROWD_MAX >= 300, 'hundreds at a sold-out bout');
});

test('ARENA2 crowd: WHO SITS WHERE - Daggerfall\'s own people; the gesturer the most of them; nobles and courtiers in the best seats', () => {
  assert.deepEqual(CROWD_PEOPLE.gesturer, [[182, 0]]);
  assert.deepEqual(CROWD_PEOPLE.entertainers.map((x) => x[1]), [47, 48, 49, 50, 51, 52, 53]);
  assert.deepEqual(CROWD_PEOPLE.courtiers, [[180, 1], [180, 2], [180, 3]]);
  assert.ok(CROWD_PEOPLE.nobles.every(([a]) => a === 183 || a === 185));
  const seats = Array.from({ length: 600 }, (_, i) => ({ x: i, y: 7, z: 0, best: i < 100 }));
  const sat = seatPeople(seats, seededRng(5));
  assert.equal(sat.length, 600);
  const g = sat.filter((s) => s.archive === 182 && s.record === 0).length;
  assert.ok(g > 120 && g < 260, `about a third gesture (${g})`);
  const best = sat.filter((s) => s.best), rest = sat.filter((s) => !s.best);
  const posh = (l) => l.filter((s) => s.archive === 180 || s.archive === 183 || s.archive === 185).length / l.length;
  assert.ok(posh(best) > 0.4 && posh(rest) === 0, 'the nobles keep the best seats');
  for (const s of sat) assert.ok(s.phase >= 0 && s.phase < 1);
  assert.deepEqual(seatPeople(seats.slice(0, 5), seededRng(5)), seatPeople(seats.slice(0, 5), seededRng(5)), 'the seed\'s crowd');
});

// ── THE SOUND ──────────────────────────────────────────────────────────────────────────────────────────────
const voice = (n, f) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * f) * 0.4);
const VOICES = [voice(30000, 0.05), voice(12000, 0.09), voice(40000, 0.031)];
const finite = (x) => x.every((v) => Number.isFinite(v));
const peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test('ARENA2 sound: the voices are DAGGER.SND\'s AmbientPeople1-10; the clips the gasp, the groan, the drums, the bell, the fanfares', () => {
  assert.deepEqual(PEOPLE_RECORDS, [441, 442, 443, 444, 445, 446, 447, 448, 449, 450]);
  assert.deepEqual(ARENA_CLIPS, { maleGasp: 386, femaleGasp: 387, groan: 458, drums: 28, drumsCall: 374, bell: 107, fanfare: 32, title: 33 });
  assert.deepEqual(Object.values(ARENA_SOUND_KEYS), ['arena:bed', 'arena:cheer', 'arena:roar', 'arena:boo', 'arena:applause']);
});

test('ARENA2 sound: every made sound has its length, its level, no NaN and no clip - with voices or with none', () => {
  for (const voices of [VOICES, []]) {
    const all = synthArenaSounds(voices);
    for (const [key, name] of Object.entries(ARENA_SOUND_KEYS)) {
      const x = all[name];
      assert.equal(x.length, Math.round(ARENA_SOUND_SECONDS[key] * ARENA_SOUND_RATE), `${key} length`);
      assert.ok(finite(x), `${key} finite`);
      assert.ok(peak(x) < 0.99, `${key} never clips (${peak(x)})`);
      assert.ok(Math.abs(rms(x) - ARENA_SOUND_RMS[key]) < ARENA_SOUND_RMS[key] * 0.08, `${key} at its level (${rms(x)})`);
    }
  }
  assert.deepEqual(synthCheer(VOICES), synthCheer(VOICES), 'the same crowd every boot');
  assert.notDeepEqual(synthCheer(VOICES).slice(0, 500), synthBoo(VOICES).slice(0, 500));
});

test('ARENA2 sound: the boo is low and the cheer bright; the applause a rain of short claps; the bed loops without a seam', () => {
  // brightness: the mean absolute first difference against the RMS - a low sound changes slowly sample to sample
  const bright = (x) => { let d = 0; for (let i = 1; i < x.length; i++) d += Math.abs(x[i] - x[i - 1]); return d / x.length / rms(x); };
  assert.ok(bright(synthBoo(VOICES)) < bright(synthCheer(VOICES)), 'the boo under the cheer');
  assert.ok(bright(synthApplause(VOICES)) > bright(synthBoo(VOICES)));
  const a = synthApplause([]);
  let quiet = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i]) < 0.002) quiet++;
  assert.ok(quiet > a.length * 0.02, 'claps, not a wash: there is air between them');
  // every layer wraps round the loop: a voice longer than the loop sounds from the loop's first sample
  const dc = synthBed([new Float32Array(11025 * 10).fill(0.4)]);
  const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length;
  assert.ok(mean(dc.slice(0, 2205)) > 0.6 * mean(dc), 'the bed\'s first moment holds the voices too');
  const bed = synthBed(VOICES);
  const seam = Math.abs(bed[0] - bed[bed.length - 1]);
  assert.ok(seam < 0.2, `the loop's ends meet (${seam})`);
  assert.ok(synthRoar(VOICES).length > synthCheer(VOICES).length, 'the roar is the longer');
});

test('ARENA2 sound: the pieces - a voice resampled and wrapped, noise, the filters, the level, the swell', () => {
  const out = new Float32Array(10);
  addVoice(out, 10, Float32Array.from([1, 1, 1, 1]), 10, { offset: 0.8, wrap: true });
  assert.deepEqual([...out], [1, 1, 0, 0, 0, 0, 0, 0, 1, 1], 'wrapped round the loop');
  const o2 = new Float32Array(4);
  addVoice(o2, 10, Float32Array.from([1, 1, 1, 1]), 10, { offset: -0.1 });
  assert.deepEqual([...o2], [1, 1, 1, 0], 'unwrapped: what falls off is lost');
  assert.equal(addVoice(o2, 10, null, 10), o2);
  const up = new Float32Array(4);
  addVoice(up, 10, Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7]), 10, { ratio: 2 });
  assert.deepEqual([...up], [0, 2, 4, 6], 'an octave up reads every other sample');
  const n = noise(1000, seededRng(1));
  assert.ok(n.every((v) => v >= -1 && v < 1));
  const lp = lowpass(Float32Array.from({ length: 200 }, (_, i) => (i % 2 ? 1 : -1)), 1000, 20);
  assert.ok(peak(lp.slice(100)) < 0.2, 'a low-pass kills the top');
  const hp = highpass(new Float32Array(200).fill(1), 1000, 50);
  assert.ok(Math.abs(hp[199]) < 0.01, 'a high-pass kills the steady');
  assert.equal(rms(new Float32Array(0)), 0);
  const lv = level(Float32Array.from([0.1, -0.1, 0.1, -0.1]), 0.5);
  assert.ok(Math.abs(rms(lv) - 0.5) < 1e-6);
  assert.deepEqual([...level(new Float32Array(3), 1)], [0, 0, 0], 'silence stays silence');
  const sw = swell(0.25, 0.25);
  assert.deepEqual([0, 0.125, 0.5, 0.875, 1].map(sw), [0, 0.5, 1, 0.5, 0]);
  assert.equal(bedGain(0, 1), BED_GAIN * 0.55);
  assert.equal(bedGain(1, 1), BED_GAIN);
  assert.equal(bedGain(-1, 0.5), BED_GAIN * 0.5);
  assert.equal(bedGain(0.5, 0), 0);
});

test('ARENA2 sound: the driver builds once off the archive\'s voices, plays the law\'s cues on the engine, keeps the bed at its level', () => {
  const calls = [];
  let looped = null;
  const audio = {
    samplesOf: (i) => (i === 441 ? VOICES[0] : i === 445 ? VOICES[2] : null),
    registerSamples: (k, x, r) => { calls.push(['reg', k, x.length, r]); return true; },
    playOneShot: (i, v, p) => calls.push(['shot', i, +v.toFixed(2), p != null]),
    loop: (k, v) => { looped = { k, vol: v, stopped: false, setVolume(x) { this.vol = x; }, stop() { this.stopped = true; } }; return looped; },
  };
  const S = createArenaSound(audio);
  assert.equal(S.made, false);
  assert.equal(S.ensure(), true);
  assert.equal(calls.filter((c) => c[0] === 'reg').length, 5);
  assert.ok(calls.every((c) => c[0] !== 'reg' || c[3] === ARENA_SOUND_RATE));
  assert.equal(S.ensure(), true);
  assert.equal(calls.filter((c) => c[0] === 'reg').length, 5, 'built once');
  calls.length = 0;
  S.cue([{ s: 'cheer', v: 0.5 }, { s: 'gasp', v: 1 }, { s: 'gasp', v: 1 }, { s: 'groan', v: 1 }, { s: 'drums', v: 1 }, { s: 'drumsCall', v: 1 }, { s: 'bell', v: 1 }, { s: 'fanfare', v: 1 }, { s: 'title', v: 1 }, { s: '??', v: 1 }], 0.5);
  assert.deepEqual(calls.map((c) => c[1]), ['arena:cheer', 386, 387, 458, 28, 374, 107, 32, 33]);
  assert.equal(calls[0][2], 0.25, 'the cue\'s volume times how near');
  assert.ok(calls[0][3], 'a made sound pitched a hair each time');
  calls.length = 0;
  S.cue([{ s: 'boo', v: 1 }], 0);
  assert.equal(calls.length, 0, 'out of earshot, nothing');
  S.bed(0.5, 1);
  assert.equal(looped.k, 'arena:bed');
  assert.equal(looped.vol, bedGain(0.5, 1));
  S.bed(0, 0);
  assert.equal(looped.stopped, true, 'out of earshot the bed stops');
  const none = createArenaSound({ samplesOf: () => null, registerSamples: () => true });
  assert.equal(none.ensure(), false, 'no archive yet: asked again next frame');
  assert.equal(createArenaSound(null).ensure(), false);
});

test('ARENA2 sound: nothing new ships - no crowd file in public/, the engine\'s door reads the player\'s own archive', () => {
  const sfx = readdirSync(new URL('../public/sfx/', import.meta.url));
  assert.ok(!sfx.some((f) => /arena|crowd|cheer|boo|applause/i.test(f)));
  const a = readFileSync(new URL('../src/systems/audio.js', import.meta.url), 'utf8');
  assert.match(a, /samplesOf\(index\) \{\n\s+const rec = this\.snd\?\.getSound\?\.\(index\);\n\s+return rec\?\.waveData\?\.length \? pcm8ToFloat32\(rec\.waveData\) : null;/);
});

// ── THE MUSIC ───────────────────────────────────────────────────────────────────────────────────────────────
test('ARENA2 music: a march and a victory fanfare made in code, in the HMI song\'s shape; the law by phase', () => {
  const S = arenaScoreSongs();
  assert.equal(S.march.name, ARENA_SONGS.march);
  assert.equal(S.win.name, ARENA_SONGS.win);
  assert.equal(arenaScoreSongs(), S, 'made once');
  for (const song of Object.values(S)) {
    assert.ok(song.secondsPerTick > 0 && song.durationTicks > 0 && song.seamless);
    assert.ok(song.events.length > 50);
    for (let i = 1; i < song.events.length; i++) assert.ok(song.events[i].tick >= song.events[i - 1].tick, 'tick-ordered');
    for (const e of song.events) if (e.type === 'noteOn') { assert.ok(e.note >= 0 && e.note <= 127); assert.ok(e.velocity >= 1 && e.velocity <= 127); assert.ok(e.duration >= 1); }
    assert.ok(song.events.some((e) => e.type === 'noteOn' && e.channel === 9), 'the kit');
  }
  assert.equal(S.march.beatsPerMinute, 116);
  assert.equal(S.march.durationTicks, 16 * 4 * 60, 'sixteen bars');
  assert.equal(arenaScoreFor(null, NaN, 0), null);
  assert.equal(arenaScoreFor('done', 0, 0), null);
  for (const p of ['call', 'walk', 'count', 'fight']) assert.equal(arenaScoreFor(p, NaN, 0), ARENA_SONGS.march);
  assert.equal(arenaScoreFor('verdict', 1000, 1000 + ARENA_STING_MS - 1), ARENA_SONGS.win);
  assert.equal(arenaScoreFor('heal', 1000, 1000 + ARENA_STING_MS), ARENA_SCORE_SILENCE);
  assert.equal(arenaScoreFor('end', NaN, 5), ARENA_SCORE_SILENCE, 'the end before the verdict is quiet');
});
