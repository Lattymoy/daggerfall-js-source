// EG-ROAR (2026-10-18, Mac: "the music and ambience of the elite breach needs to be insanely better. Its way too tame";
// bible/11-Multiplayer/Elite-Gates.md section 26 and its EG-ROAR record): THE SPIRE'S AIR (scenes/eliteGates/egAir.js).
// The beds: the void's loop meeting itself, its noise the seed's; each band's drone whole over its loop and tuned to the
// score's E (the Galleries' fifths, the Shade's half step high, the Wellhead's E1 harmonics); the band's voice and the
// lord's breath from DAGGER.SND's own, a missing voice left out. The events: pure, whole over the period, the legion's in
// every band and each band's own in its own, the breach's seed choosing them. The moment: the score's place read as the
// air's (open, trial, sleep, rest, end - a fall's own time the end). The seam: one build a frame, each made sound once,
// the beds set by name and swapped with the band, the mix eased, the breath only while the lord sleeps, the events far
// shots on the clock, nothing until the horn stands, everything let go on stop and when the place is gone. The wiring:
// the breach client playing it from the score's place and letting it go on every way out; the dungeon's drips silent in
// the Spire; the Hour's layBed the one home of the laying.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSpireVoid, buildSpireDrone, buildSpireBand, buildLordBreath, egAirEvents, egAirMoment, egAirBreathGain, createEgAir,
  EG_AIR_EVENTS, EG_AIR_PERIOD, EG_AIR_MIX, EG_AIR_LEVEL, EG_AIR_BEDS, EG_AIR_KEYS, EG_AIR_FAR, EG_AIR_LOW_RATE, EG_AIR_RATE, EG_AIR_SECONDS, EG_AIR_EASE_S, EG_AIR_BANDS,
} from '../../../src/scenes/eliteGates/egAir.js';
import { rms } from '../../../src/systems/arena/arenaSound.js';
import { EG_HORN_KEY } from '../../../src/scenes/eliteGates/egCall.js';
import { SPIRE_END_MS } from '../../../src/systems/eliteGates/egScore.js';

/** The magnitude of `hz` in `x` (Goertzel), per sample. */
function tone(x, rate, hz) {
  const w = (2 * Math.PI * hz) / rate, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < x.length; i++) { const s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
  return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / x.length;
}
/** How far a loop's seam steps, against its own typical step. */
function seam(x) {
  let d = 0;
  for (let i = 1; i < x.length; i++) d += Math.abs(x[i] - x[i - 1]);
  return Math.abs(x[0] - x[x.length - 1]) / (d / (x.length - 1));
}

test('EG-ROAR THE BEDS: the void a loop that meets itself, its noise the seed\'s; each band\'s drone whole over its loop and tuned to the score\'s E - the Galleries\' E2 and B2 over F2, the Shade\'s B4 against C5, the Wellhead\'s E1 and its harmonics; the band\'s voice and the lord\'s breath laid from DAGGER.SND\'s own, a missing voice left out (mutants: a partial between turns; the void\'s seam left raw)', () => {
  const v = buildSpireVoid();
  assert.equal(v.length, EG_AIR_LOW_RATE * EG_AIR_SECONDS.void);
  assert.ok(seam(v) < 4, `the void meets itself (${seam(v).toFixed(2)})`);
  assert.ok(Math.abs(rms(v) - 0.06) < 0.003);
  assert.deepEqual([...buildSpireVoid().slice(0, 64)], [...v.slice(0, 64)], 'the same noise every time');
  assert.notDeepEqual([...buildSpireVoid({ seed: 7 }).slice(0, 64)], [...v.slice(0, 64)], 'its seed\'s');
  const D = [0, 1, 2, 3].map((b) => buildSpireDrone(b));
  D.forEach((d, b) => { assert.equal(d.length, EG_AIR_LOW_RATE * EG_AIR_SECONDS.drone); assert.ok(seam(d) < 4, `band ${b}: the drone meets itself (${seam(d).toFixed(2)})`); assert.ok(Math.abs(rms(d) - 0.05) < 0.003); });
  const R = EG_AIR_LOW_RATE, snap = (hz) => Math.round(hz * EG_AIR_SECONDS.drone) / EG_AIR_SECONDS.drone;
  assert.ok(tone(D[0], R, snap(82.41)) > 20 * tone(D[0], R, snap(87.31)) && tone(D[0], R, snap(123.47)) > 20 * tone(D[0], R, snap(87.31)), 'the Galleries: E and B, never F');
  assert.ok(tone(D[2], R, snap(493.88)) > 0.002 && tone(D[2], R, snap(523.25)) > 0.002 && tone(D[2], R, snap(466.16)) < 0.0002, 'the Shade: B against C');
  assert.ok(tone(D[3], R, snap(41.2)) > 20 * tone(D[3], R, snap(43.65)) && tone(D[3], R, snap(82.4)) > 20 * tone(D[3], R, snap(87.31)), 'the Wellhead: E1 and its harmonics');
  const noise = (n, k) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * 0.37 * k) * 0.3);
  const band = buildSpireBand(0, [noise(9000, 1), noise(7000, 2), noise(8000, 3)]);
  assert.equal(band.length, EG_AIR_RATE * EG_AIR_SECONDS.band); assert.ok(rms(band) > 0.04);
  assert.ok(rms(buildSpireBand(3, [null, noise(5000, 1)])) > 0.04, 'a missing voice left out');
  assert.equal(EG_AIR_BANDS.length, 4);
  const breath = buildLordBreath(noise(12000, 1));
  assert.equal(breath.length, EG_AIR_RATE * EG_AIR_SECONDS.breath); assert.ok(rms(breath) > 0.05);
});

test('EG-ROAR THE EVENTS (egAirEvents): pure and in time order inside (from, to]; every kind\'s slot dividing the period, so the period plays again; the legion\'s in every band, each band\'s own in its own and no other; the breach\'s seed choosing them (mutants: every band the Galleries\'; one seed for every breach)', () => {
  for (const E of [EG_AIR_EVENTS.legion, ...EG_AIR_EVENTS.bands]) for (const [k, q] of Object.entries(E)) assert.equal(EG_AIR_PERIOD % q.slot, 0, `${k}'s slot divides the period`);
  const legion = Object.keys(EG_AIR_EVENTS.legion);
  for (let b = 0; b < 4; b++) {
    const ev = egAirEvents(0, EG_AIR_PERIOD, b, 99);
    assert.deepEqual(ev, egAirEvents(0, EG_AIR_PERIOD, b, 99), 'the same whoever asks');
    assert.ok(ev.every((e, i) => e.t > 0 && e.t <= EG_AIR_PERIOD && (i === 0 || e.t >= ev[i - 1].t)));
    const kinds = new Set(ev.map((e) => e.kind)), own = Object.keys(EG_AIR_EVENTS.bands[b]);
    for (const k of [...legion, ...own]) assert.ok(kinds.has(k), `band ${b}: ${k} heard in a period`);
    for (let o = 0; o < 4; o++) if (o !== b) for (const k of Object.keys(EG_AIR_EVENTS.bands[o])) if (!own.includes(k)) assert.ok(!kinds.has(k), `band ${b}: never band ${o}'s ${k}`);
    const again = egAirEvents(EG_AIR_PERIOD, 2 * EG_AIR_PERIOD, b, 99);
    assert.deepEqual(again.map((e) => +(e.t - EG_AIR_PERIOD).toFixed(6)), ev.map((e) => +e.t.toFixed(6)), 'whole over the period');
    for (const e of ev) { const E = { ...EG_AIR_EVENTS.legion, ...EG_AIR_EVENTS.bands[b] }[e.kind]; assert.ok(e.volume >= E.volume[0] && e.volume <= E.volume[1] && e.pitch >= E.pitch[0] && e.pitch <= E.pitch[1] && e.lift === E.lift); assert.ok([E.clip].flat().includes(e.clip)); }
  }
  assert.notDeepEqual(egAirEvents(0, 600, 1, 1).map((e) => e.t), egAirEvents(0, 600, 1, 2).map((e) => e.t), 'another breach, another sky');
  assert.ok(egAirEvents(0, 600, 0, 5).some((e) => e.clip === EG_HORN_KEY), 'the call\'s own horn');
  assert.deepEqual(egAirEvents(5, 5, 0, 0), []); assert.deepEqual(egAirEvents(NaN, 9, 0, 0), []);
});

test('EG-ROAR THE MOMENT (egAirMoment): outside the Spire none; the end, and a fall for SPIREEND\'s own time; a Redoubt\'s rest; a Court whose lord sleeps; a hall\'s fight; the gather, the arrival and the closing whole (mutants: the lord\'s sleep a fight; the rest a fight; a fall unheard)', () => {
  assert.equal(egAirMoment(null), null);
  const P = (o) => ({ band: 1, sg: 'trial', kind: 'span', asleep: false, end: false, sinceFall: Infinity, ...o });
  assert.equal(egAirMoment(P({})), 'trial');
  assert.equal(egAirMoment(P({ kind: 'court', asleep: true })), 'sleep');
  assert.equal(egAirMoment(P({ kind: 'court' })), 'trial');
  assert.equal(egAirMoment(P({ sg: 'rest' })), 'rest');
  for (const sg of ['gather', 'arrive', 'closing']) assert.equal(egAirMoment(P({ sg })), 'open');
  assert.equal(egAirMoment(P({ end: true, sg: 'rest' })), 'end');
  assert.equal(egAirMoment(P({ sinceFall: 1000 })), 'end'); assert.equal(egAirMoment(P({ sinceFall: SPIRE_END_MS })), 'trial');
  assert.ok(EG_AIR_MIX.trial.void < EG_AIR_MIX.open.void && EG_AIR_MIX.rest.events < EG_AIR_MIX.trial.events && EG_AIR_MIX.sleep.breath === 1 && EG_AIR_MIX.trial.breath === 0, 'under the war, quiet at rest, the breath only asleep');
});

/** A recording engine: its made sounds, its beds, its far shots. */
function fakeEngine() {
  const E = { regs: [], beds: new Map(), bedLog: [], shots: [], fades: [] };
  return Object.assign(E, {
    registerSamples: (key, s, rate) => { E.regs.push([key, s.length, rate]); return true; },
    samplesOf: (r) => Float32Array.from({ length: 6000 }, (_, i) => Math.sin(i * 0.01 * (r + 1)) * 0.3),
    setBed: (name, clip, o) => { E.bedLog.push([name, clip, o?.volume]); if (clip == null) E.beds.delete(name); else E.beds.set(name, { clip, volume: o.volume }); },
    play3d: (clip, pos, volume, o) => E.shots.push({ clip, pos, volume, o }),
    fadeFar: (tag) => E.fades.push(tag),
  });
}

test('EG-ROAR THE SEAM (createEgAir): one made sound a frame, each once; the beds set by name - the void, the band\'s drone and voice - and swapped with the band; the mix eased toward the moment over EG_AIR_EASE_S; the breath only while the lord sleeps and let go when it wakes; the events far shots on the clock, the horn only once it stands, none across a gap; a place gone or stop() letting every bed and far shot go (mutants: every sound built in one frame; the mix stepped; the breath kept; the beds left looping)', () => {
  const E = fakeEngine(), air = createEgAir(E), ear = [1, 2, 3];
  const place = (o = {}) => ({ band: 1, sg: 'gather', kind: 'span', end: false, sinceFall: Infinity, ...o });
  let t = 1000;
  air.frame(place(), t, ear, 77);
  assert.equal(E.regs.length, 1, 'one build a frame');
  for (let i = 0; i < 6; i++) air.frame(place(), (t += 0.05), ear, 77);
  assert.deepEqual(E.regs.map((r) => r[0]).sort(), [EG_AIR_KEYS.void, `${EG_AIR_KEYS.drone}:1`, `${EG_AIR_KEYS.band}:1`, EG_HORN_KEY].sort(), 'the void, the Cairn\'s drone and voice, the horn - once each');
  assert.equal(E.regs.find((r) => r[0] === EG_AIR_KEYS.void)[2], EG_AIR_LOW_RATE);
  assert.equal(E.beds.get(EG_AIR_BEDS.drone).clip, `${EG_AIR_KEYS.drone}:1`);
  assert.ok(Math.abs(E.beds.get(EG_AIR_BEDS.drone).volume - EG_AIR_LEVEL.drone) < 1e-9, 'whole in the gather');
  assert.ok(!E.beds.has(EG_AIR_BEDS.breath));
  // into a fight: eased, not stepped
  air.frame(place({ sg: 'trial' }), (t += 0.1), ear, 77);
  const mid = E.beds.get(EG_AIR_BEDS.drone).volume;
  assert.ok(mid < EG_AIR_LEVEL.drone && mid > EG_AIR_LEVEL.drone * EG_AIR_MIX.trial.drone, 'eased');
  for (let i = 0; i < 80; i++) air.frame(place({ sg: 'trial' }), (t += 0.1), ear, 77);
  assert.ok(Math.abs(E.beds.get(EG_AIR_BEDS.drone).volume - EG_AIR_LEVEL.drone * EG_AIR_MIX.trial.drone) < 1e-3, `there after ${EG_AIR_EASE_S} s and more`);
  // a sleeping lord's breath, let go at its wake
  for (let i = 0; i < 40; i++) air.frame(place({ sg: 'trial', kind: 'court', asleep: true }), (t += 0.1), ear, 77);
  assert.equal(E.beds.get(EG_AIR_BEDS.breath)?.clip, EG_AIR_KEYS.breath, 'the lord breathes');
  assert.ok(E.beds.get(EG_AIR_BEDS.breath).volume <= EG_AIR_LEVEL.breath * egAirBreathGain(t) + 1e-9);
  for (let i = 0; i < 100; i++) air.frame(place({ sg: 'trial', kind: 'court' }), (t += 0.1), ear, 77);
  assert.ok(!E.beds.has(EG_AIR_BEDS.breath), 'awake: its breath gone');
  // another band: its drone and its voice swapped in
  for (let i = 0; i < 4; i++) air.frame(place({ band: 3 }), (t += 0.1), ear, 77);
  assert.equal(E.beds.get(EG_AIR_BEDS.drone).clip, `${EG_AIR_KEYS.drone}:3`); assert.equal(E.beds.get(EG_AIR_BEDS.band).clip, `${EG_AIR_KEYS.band}:3`);
  // the events, as far shots on the clock
  E.shots.length = 0;
  const from = t;
  for (let i = 0; i < 1200; i++) air.frame(place({ band: 3 }), (t += 0.5), ear, 77);
  const want = egAirEvents(from, t, 3, 77);
  assert.equal(E.shots.length, want.length, 'each event once');
  assert.ok(E.shots.every((s) => s.o.far === EG_AIR_FAR && s.o.refDistance === 13));
  assert.deepEqual(E.shots.map((s) => s.clip), want.map((e) => e.clip));
  E.shots.length = 0; air.frame(place({ band: 3 }), (t += 30), ear, 77);
  assert.equal(E.shots.length, 0, 'none across a gap');
  // gone
  air.frame(null, t + 1, ear, 77);
  assert.equal(E.beds.size, 0, 'every bed let go'); assert.deepEqual(E.fades, [EG_AIR_FAR]);
  assert.equal(air.on, false);
  // the horn waits for its own sound
  const E2 = fakeEngine(); E2.registerSamples = (key, s, rate) => { if (key === EG_HORN_KEY) return false; E2.regs.push([key, s.length, rate]); return true; };
  const air2 = createEgAir(E2);
  let u = 0;
  for (let i = 0; i < 4000; i++) air2.frame(place({ band: 0 }), (u += 0.5), ear, 5);
  assert.ok(E2.shots.length > 0 && !E2.shots.some((s) => s.clip === EG_HORN_KEY), 'no horn until it stands');
  air2.stop(); assert.equal(E2.beds.size, 0);
});

test('EG-ROAR THE WIRING: the breach client plays the air from the score\'s own place on the breach\'s clock each frame it stands in the Spire, and lets it go on every way out the reverb is and on away(); the dungeon\'s drips, doors and birds silent in the Spire as in the court and the Hour; the Hour\'s layBed the one home of the laying (mutants: the air never played; never let go; the drips back)', () => {
  const C = readFileSync(new URL('../../../src/scenes/eliteGates/egClient.js', import.meta.url), 'utf8');
  assert.match(C, /\n {6}if \(inSpire\(\)\) \{\n {8}spireFrame\(E, t\);[\s\S]{0,900}?\n {8}air\.frame\(api\.scoreView\(\)\?\.place \?\? null, t \/ 1000, cam\?\.pos \?\? null, E\.seed\);/, 'played in the Spire\'s frame');
  assert.match(C, /\n {8}if \(!swapping && !answering\) reverb\.release\(\);[^\n]*\n {8}if \(!swapping && !answering\) air\.stop\(\);/, 'let go with the reverb');
  assert.match(C, /away\(\) \{[^\n]*\bair\.stop\(\);/, 'and on away()');
  assert.match(C, /const air = createEgAir\(audio\);/);
  const D = readFileSync(new URL('../../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(D, /&& !_sdRealm && !_egHall && !_ketch\) sceneAmbience\.update\(dt, \{/, 'no drip in the Spire');   // PIN MOVED (KETCH): nor on a ship in the sky
  const A = readFileSync(new URL('../../../src/scenes/eliteGates/egAir.js', import.meta.url), 'utf8');
  assert.match(A, /import \{ layBed \} from '\.\.\/superDungeon\/sdAir\.js';/);
  assert.ok(!/function layBed/.test(A), 'one home');
});
