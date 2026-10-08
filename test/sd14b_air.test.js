// SD14b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7 and section 16's SD14b;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S AIR (scenes/sdAir.js) - four beds and four
// kinds of far event where the Deadlands have three and three. The beds: the void's wind breathing on the Hour's clock,
// the Hour's works (a tick and a tock a second, made out of the player's own clunk and grind) everywhere, the Orrery's
// hum (the bell slowed to a drone, made) in the hall, the arena's gears under its floor - all four let go the frame I
// leave, one engine's at a time. The events: a bell tolled far off, a gear falling into the void, the void's moan, the
// shards grinding overhead - seeded slots whole over the sky's period, pure, each from a stand-in in its own quarter,
// held at its bearing; a gap longer than the backlog plays none. The world host frames it in the Hour and stops it out.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSdAir, sdAirEvents, sdAirWindGain, buildHourWorks, buildOrreryHum, SD_AIR_VOID, SD_AIR_WORKS, SD_AIR_HUM, SD_AIR_GEARS,
  SD_AIR_HUM_AT, SD_AIR_GEARS_AT, SD_AIR_EVENTS, SD_AIR_RATE, SD_WORKS_SECONDS, SD_HUM_SECONDS,
} from '../src/scenes/sdAir.js';
import { airSourceAt, AIR_BACKLOG_S } from '../src/scenes/deadlandsAir.js';
import { SD_SKY_PERIOD } from '../src/render/sdSky.js';
import { SD_ARENA, SD_ORRERY, dungeonToRealm } from '../src/net/sdBrain.js';
import { SOUND } from '../src/systems/soundClips.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const voice = (n, hz = 440, rate = 11025) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * hz * i) / rate) * Math.exp(-i / (n / 3)));

/** An engine that keeps its beds and hears its one-shots. AUDIT SD III (A3, PIN MOVED): the beds are named native loops
 *  (systems/audio.js setBed, setBed3d) - they were setLoop's re-armed one-shots. */
function engine({ archive = true } = {}) {
  const loops = new Map(), loops3d = new Map(), shots = [], reg = [];
  return {
    loops, loops3d, shots, reg,
    setBed: (name, clip, o) => { if (clip == null) loops.delete(name); else loops.set(name, { clip, ...o }); },
    setBed3d: (name, clip, pos, o) => { if (clip == null) loops3d.delete(name); else loops3d.set(name, { clip, pos, ...o }); },
    play3d: (clip, at, volume, o) => shots.push({ clip, at, volume, ...o }),
    registerSamples: (key, s, rate) => { reg.push([key, s.length, rate]); return true; },
    samplesOf: (i) => (archive ? voice(4000, i) : null),
  };
}

test('SD14b THE BEDS: the void\'s wind (the deep moan, lower) breathing on the Hour\'s clock, the Hour\'s works everywhere, the Orrery\'s hum over the hall\'s centre, the arena\'s gears under its floor - the made two once the archive is read, asked again until then; all four let go the frame I leave; a later engine\'s air silencing the old one\'s (mutants: a bed never stood; the hum anywhere; one left looping; the made sounds made every frame)', () => {
  const e = engine();
  const air = createSdAir(e);
  air.frame(10, [0, 1, 0]);
  assert.equal(air.on, true);
  assert.deepEqual([...e.loops.keys()].sort(), [SD_AIR_VOID.loop, SD_AIR_WORKS.loop].sort());
  assert.deepEqual([...e.loops3d.keys()].sort(), [SD_AIR_GEARS.loop, SD_AIR_HUM.loop].sort());
  assert.equal(e.loops.get(SD_AIR_VOID.loop).clip, SD_AIR_VOID.clip, 'the void made');   // AUDIT SD III (A3, PIN MOVED): it was the one moan looped
  assert.equal(SD_AIR_VOID.voice, SOUND.AmbientWindMoanDeep, 'of the deep moan');
  assert.ok(SD_AIR_VOID.pitch < 0.74, 'lower than the Deadlands\' own moan');
  assert.deepEqual(e.loops3d.get(SD_AIR_HUM.loop).pos, SD_AIR_HUM_AT);
  const [hx, , hz] = dungeonToRealm(...SD_AIR_HUM_AT);
  assert.ok(Math.hypot(hx - SD_ORRERY.x, hz - SD_ORRERY.z) < 0.01, 'over the Orrery');
  const [gx, , gz] = dungeonToRealm(...SD_AIR_GEARS_AT);
  assert.ok(Math.hypot(gx - SD_ARENA.x, gz - SD_ARENA.z) < 0.01, 'under the arena');
  assert.ok(SD_AIR_HUM.maxDistance < SD_ARENA.z - SD_ORRERY.z, 'the hum never reaches the arena');
  assert.deepEqual(e.reg.map((r) => r[0]).sort(), [SD_AIR_GEARS.clip, SD_AIR_HUM.clip, SD_AIR_VOID.clip, SD_AIR_WORKS.clip].sort());   // AUDIT SD III (A3, PIN MOVED): all four made
  air.frame(10.1, [0, 1, 0]); air.frame(10.2, [0, 1, 0]);
  assert.equal(e.reg.length, 4, 'made once');
  air.stop();
  assert.equal(e.loops.size + e.loops3d.size, 0, 'nothing left looping');
  assert.equal(air.on, false);
  // no archive yet: nothing stands (a clip of the archive sounds nothing without it either), and the made asked again
  const n = engine({ archive: false });
  const a2 = createSdAir(n);
  a2.frame(5, [0, 0, 0]);
  assert.equal(n.loops.size + n.loops3d.size, 0);   // AUDIT SD III (A3, PIN MOVED): the wind and the gears stood unmade
  assert.equal(n.reg.length, 0);
  // a later engine's air silences the old one's
  const e3 = engine(), old = createSdAir(e3);
  old.frame(1, [0, 0, 0]);
  createSdAir(engine());
  assert.equal(e3.loops.size + e3.loops3d.size, 0);
});

test('SD14b THE MADE SOUNDS: the Hour\'s works a periodic loop of SD_WORKS_SECONDS - its tick at the start, its tock half a loop on, at its level; the Orrery\'s hum a periodic loop of SD_HUM_SECONDS, darkened, at its level; no archive, silence (mutants: no tock; the hum bright)', () => {
  const clunk = voice(3000, 900), grind = voice(5000, 120), bell = voice(9000, 330);
  const w = buildHourWorks(clunk, grind);
  assert.equal(w.length, SD_AIR_RATE * SD_WORKS_SECONDS);
  assert.ok(Math.abs(rms(w) - 0.05) < 1e-3, `its level (${rms(w).toFixed(4)})`);
  const win = (x, at, n = 400) => rms(x.subarray(at, at + n));
  const half = w.length / 2;
  assert.ok(win(w, 0) > 3 * win(w, Math.round(w.length * 0.3)), 'the tick at the start');
  const tt = buildHourWorks(clunk, null);   // the woods alone: the tick and the tock
  assert.ok(win(tt, half) > 0.5 * win(tt, 0) && win(tt, Math.round(tt.length * 0.3)) < 1e-6, 'the tock half a loop on, nothing between');
  const h = buildOrreryHum(bell);
  assert.equal(h.length, SD_AIR_RATE * SD_HUM_SECONDS);
  assert.ok(Math.abs(rms(h) - 0.06) < 1e-3);
  // darkened: a bell of noise, its brightness (the first difference's energy over its own) cut to under half what the
  // slowed bell alone keeps (0.064 undarkened)
  let x = 12345;
  const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return (x / 4294967296) * 2 - 1; };
  const noise = Float32Array.from({ length: 11025 }, (_, i) => rnd() * Math.exp(-i / 4000));
  const hn = buildOrreryHum(noise);
  let hi = 0, lo = 0;
  for (let i = 1; i < hn.length; i++) { const d = hn[i] - hn[i - 1]; hi += d * d; lo += hn[i] * hn[i]; }
  assert.ok(hi / lo < 0.035, `a drone, not a chime (${(hi / lo).toFixed(4)})`);
  assert.equal(rms(buildHourWorks(null, null)), 0); assert.equal(rms(buildOrreryHum(null)), 0);
});

test('SD14b THE EVENTS: four kinds - a bell tolled far off, a gear falling into the void below, the void\'s moan, the shards grinding overhead - in seeded slots whole over the sky\'s period; pure, in time order, a frame\'s worth the same whichever way the time is cut; the next period the same; each kind\'s share near its chance; the void\'s below the ear, the shards\' above (mutants: a kind never sounding; every slot sounding; the period not whole; the shards below)', () => {
  const a = sdAirEvents(0, SD_SKY_PERIOD);
  assert.deepEqual(a, sdAirEvents(0, SD_SKY_PERIOD), 'pure');
  for (let i = 1; i < a.length; i++) assert.ok(a[i].t >= a[i - 1].t);
  const cut = [...sdAirEvents(0, 100), ...sdAirEvents(100, 333.3), ...sdAirEvents(333.3, SD_SKY_PERIOD)];
  assert.deepEqual(cut, a, 'however the frames cut it');
  const next = sdAirEvents(SD_SKY_PERIOD, 2 * SD_SKY_PERIOD).map((e) => ({ ...e, t: Math.round((e.t - SD_SKY_PERIOD) * 1e6) / 1e6 }));
  assert.deepEqual(next, a.map((e) => ({ ...e, t: Math.round(e.t * 1e6) / 1e6 })), 'whole over the period');
  for (const [kind, E] of Object.entries(SD_AIR_EVENTS)) {
    assert.ok(Number.isInteger(SD_SKY_PERIOD / E.slot), `${kind}'s slot whole over the period`);
    const n = a.filter((e) => e.kind === kind), slots = SD_SKY_PERIOD / E.slot;
    assert.ok(n.length > 0 && n.length < slots, `${kind}: some of its slots (${n.length} of ${slots})`);
    assert.ok(Math.abs(n.length / slots - E.chance) < 0.3, `${kind}: near its chance`);
    for (const e of n) {
      assert.ok(e.volume >= E.volume[0] && e.volume <= E.volume[1] && e.pitch >= E.pitch[0] && e.pitch <= E.pitch[1] && Math.abs(e.az) <= Math.PI);
      assert.equal(e.clip, E.clip); assert.equal(e.lift, E.lift);
    }
  }
  assert.ok(SD_AIR_EVENTS.gear.lift < 0 && SD_AIR_EVENTS.moan.lift < 0, 'the void below');
  assert.ok(SD_AIR_EVENTS.grind.lift > 0 && SD_AIR_EVENTS.toll.lift > 0, 'the shards and the bell above');
  assert.deepEqual(sdAirEvents(5, 5), []); assert.deepEqual(sdAirEvents(NaN, 3), []);
});

test('SD14b HEARD FROM ITS QUARTER: each event played as it falls in a frame, far - from a stand-in in its quarter held at its bearing; a gap longer than the backlog plays none of what it passed; the wind breathing between its floor and its level, whole over the period (mutants: events at the ear; the backlog played; the wind flat)', () => {
  const e = engine(), air = createSdAir(e), ear = [3, 1, -2];
  const first = sdAirEvents(0, SD_SKY_PERIOD)[0];
  air.frame(first.t - 0.5, ear);
  air.frame(first.t + 0.01, ear);
  assert.equal(e.shots.length, 1);
  assert.deepEqual(e.shots[0].at, airSourceAt(ear, first.az, first.lift));
  assert.equal(e.shots[0].far, true); assert.equal(e.shots[0].clip, first.clip);
  air.frame(first.t + 0.01 + AIR_BACKLOG_S + 60, ear);
  assert.equal(e.shots.length, 1, 'a tab put away: nothing of what it passed');
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < SD_SKY_PERIOD; t += 0.5) { const g = sdAirWindGain(t); lo = Math.min(lo, g); hi = Math.max(hi, g); }
  assert.ok(Math.abs(hi - SD_AIR_VOID.volume) < 1e-3 && Math.abs(lo - SD_AIR_VOID.volume * (1 - SD_AIR_VOID.depth)) < 1e-3, 'breathing');
  assert.ok(Math.abs(sdAirWindGain(0) - sdAirWindGain(SD_SKY_PERIOD)) < 1e-12 && Math.abs(sdAirWindGain(-3) - sdAirWindGain(SD_SKY_PERIOD - 3)) < 1e-12);
  assert.ok(Number.isInteger(SD_AIR_VOID.breathTurns));
});

test('SD14b THE WORLD HOST: made on the engine beside the Deadlands\' air, framed on the sky\'s clock while I stand in the Hour and stopped every other frame, after the ways out have run (mutants: never framed; never stopped)', () => {
  assert.match(W, /const sdAir = createSdAir\(audio\);/);
  assert.match(W, /const sdAirFrame = \(\) => \{ if \(modes\?\.sdRealmSlot\?\.\(\) != null\) sdAir\.frame\(deadlandsSeconds\(\), cam\.pos\); else sdAir\.stop\(\); \};/);
  assert.match(W, /deadlandsAirFrame\(\);[^\n]*\n\s*sdAirFrame\(\);/);
});
