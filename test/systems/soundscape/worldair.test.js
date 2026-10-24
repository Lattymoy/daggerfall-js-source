// WORLD-AIR (2026-10-24, the owner: "... and whatever else we could improve"; bible/08-Audio/Audio.md SOUNDSCAPE): THE OPEN
// WORLD'S AIR past DFU's four presets (systems/soundscape/worldAir.js). The shore: the surf's reach and its breaker's
// clock, the lap close in on a quiet sea. The wild: each climate's voices by day and by night as the weather, the winter
// and a town's walls leave them; a marsh's insects. The town: its murmur by the hour, its size and the weather; a smith
// at work; a tavern's evening and its small hours. The driver against a fake engine and seeded dice: the surf at the
// edge - the host's own point at the sea's surface, standing while I walk - and a crash peaking on each wave's own
// crash, its loudness the sea's and the distance the panner's, nothing past its reach; the wild's calls `far` where its
// voices are, further off in a town; the town's beds made of the player's own people (never shipped), the murmur two
// loops, the tavern and the anvil at their doors within their reach, the smith by day only; a pause holding every
// clock; stop lets everything go. AUDIT SOUNDSCAPE (2026-10-24): W5, W6, W7, W9, W10, W12, W13, W14; every number the
// record states pinned to its literal (P6).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  surfReach, breakerAt, surfGain, surfEdgeGain, lapGain, wildVoicesFor, marshGain, murmurGain, smithAtWork, tavernGain, createWorldAir, ensureTownBeds,
  SURF, LAP, MARSH, MURMUR, MURMUR_TWIN, MURMUR_WEATHER, SMITHY, TAVERN, BREAKER_CURL_S, BREAKER_PERIOD, CRASH_REACH, CRASH_PEAK_S, SURF_REF,
  TOWN_WILD_GAP, TOWN_WILD_FAR, WORLD_FAR, WILD,
} from '../../../src/systems/soundscape/worldAir.js';
import { SCAPE_SFX } from '../../../src/systems/soundscape/soundscapeSfx.js';
import { _resetMade } from '../../../src/systems/soundscape/soundJobs.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';
import { PEOPLE_RECORDS } from '../../../src/systems/arena/arenaSound.js';

const dice = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r3 = (v) => Math.round(v * 1000) / 1000;
/** A voice's kind and its gap, for a table. */
const brief = (list) => list.map((v) => `${v.kind}:${v.gap[0]}-${v.gap[1]}`);

function fakeEngine({ people = true } = {}) {
  const e = {
    beds: new Map(), beds3d: new Map(), shots: [], faded: [], registered: new Map(),
    registerSamples(key, samples, rate) { e.registered.set(key, [samples.length, rate]); return true; },
    samplesOf(i) { return people && PEOPLE_RECORDS.includes(i) ? Float32Array.from({ length: 4000 }, (_, k) => Math.sin(k * (0.05 + i * 1e-4)) * 0.3) : null; },
    setBed(name, clip, o = {}) { if (clip == null) e.beds.delete(name); else e.beds.set(name, { clip, ...o }); },
    setBed3d(name, clip, pos, o = {}) { if (clip == null) e.beds3d.delete(name); else e.beds3d.set(name, { clip, pos, ...o }); },
    play3d(clip, pos, volume, o) { e.shots.push({ clip, pos, volume, ...o }); return 1; },
    fadeFar(tag) { e.faded.push(tag); },
  };
  return e;
}
const LAND = Object.freeze({ ear: [0, 0, 0], climate: CLIMATES.Woodlands, night: false, hour: 12, weather: 'sunny', wind: 0.4, winter: false, inTown: false, townBlocks: 1, shore: null, smithies: [], taverns: [], paused: false });
const run = (air, seconds, w, dt = 1 / 30) => { for (let k = 0; k < Math.round(seconds / dt); k++) air.frame(dt, typeof w === 'function' ? w(k * dt) : w); };
/** Frames with the engine told the time - each shot says when it was played. */
function runAt(e, air, seconds, w, dt = 1 / 30) {
  for (let k = 0; k < Math.round(seconds / dt); k++) { e.now = (e.now ?? 0) + dt; air.frame(dt, typeof w === 'function' ? w(k * dt) : w); }
}
function timedEngine(o) {
  const e = fakeEngine(o);
  const play3d = e.play3d;
  e.play3d = (clip, pos, volume, opt) => { play3d(clip, pos, volume, opt); e.shots.at(-1).at = e.now; return 1; };
  return e;
}

// ── the shore ─────────────────────────────────────────────────────────

test('WORLD-AIR THE SURF\'S REACH: whole within 8 m of the edge, falling away past it, eased to nothing over the last 40 m of its 220 - never a step - and none past it; the breaker curling up from the surf\'s floor to its crash at BREAKER_CURL_S, running back to the floor (mutants: the reach; the full; the ease; the curl\'s length; the floor)', () => {
  assert.deepEqual([SURF.reach, SURF.full, SURF.floor, SURF.max, BREAKER_CURL_S, [...BREAKER_PERIOD], SURF_REF, [...CRASH_PEAK_S]], [220, 8, 0.22, 0.3, 1.0, [7, 11], 12, [0.83, 1.0]]);
  assert.ok(BREAKER_CURL_S >= Math.max(...CRASH_PEAK_S), 'every take can be started to peak on the crash');
  assert.deepEqual([LAP.max, LAP.reach, LAP.state], [0.16, 14, 0.45], 'close in (14 m) on a quiet sea (under 0.45)');
  assert.deepEqual([0, 8, 20, 50, 100, 180, 200, 219.9, 220, 500, NaN].map((d) => r3(surfReach(d))), [1, 1, 0.75, 0.315, 0.124, 0.053, 0.022, 0, 0, 0, 0]);
  let was = surfReach(0);
  for (let d = 0.5; d < 230; d += 0.5) { const v = surfReach(d); assert.ok(v <= was + 1e-12, `falling at ${d}`); assert.ok(was - v < 0.06, `no step at ${d}`); was = v; }
  assert.equal(r3(breakerAt(0, 9)), SURF.floor);
  assert.equal(r3(breakerAt(BREAKER_CURL_S, 9)), 1, 'the crash');
  assert.ok(breakerAt(0.45, 9) > SURF.floor && breakerAt(0.45, 9) < 0.5, 'curling up');
  assert.ok(breakerAt(3, 9) < 0.5 && breakerAt(8.9, 9) - SURF.floor < 0.02, 'running back to the floor');
  assert.equal(r3(surfGain(5, 1, 1)), SURF.max);
  assert.equal(r3(surfGain(5, 0, 1)), r3(SURF.max * 0.4), 'a calm sea breaks gently');
  assert.equal(surfEdgeGain(SURF.reach, 1, 1), 0);
  assert.equal(r3(surfEdgeGain(30, 1, 1)), SURF.max, 'at the edge the panner takes the distance');
  assert.equal(lapGain(5, 0.7), 0, 'a heavy sea, no lap');
  assert.equal(lapGain(5, LAP.state), 0, 'the quiet sea\'s edge itself, none');
  assert.ok(lapGain(13.9, 0.1) > 0 && lapGain(5, 0.44) > 0);
  assert.equal(lapGain(LAP.reach, 0.1), 0);
  assert.equal(r3(lapGain(0, 0)), LAP.max);
});

// ── the wild ──────────────────────────────────────────────────────────

test('WORLD-AIR THE WILD BY CLIMATE: the woods\' crows by day and owls and a far wolf by night, the mountains\' wolves more often, the haunted woods\' crows often, the swamp\'s and the rainforest\'s frogs (a chorus at night), the desert\'s far howl at night, nothing over the ocean (mutants: a climate\'s row; the chorus; the desert\'s day)', () => {
  const at = (climate, night) => brief(wildVoicesFor(climate, { night, weather: 'sunny', winter: false, inTown: false }));
  assert.deepEqual(at(CLIMATES.Woodlands, false), ['crow:25-70']);
  assert.deepEqual(at(CLIMATES.Woodlands, true), ['owl:25-60', 'howl:90-240']);
  assert.deepEqual(at(CLIMATES.Mountain, true), ['howl:45-120', 'owl:60-150']);
  assert.deepEqual(at(CLIMATES.HauntedWoodlands, false), ['crow:14-40']);
  assert.deepEqual(at(CLIMATES.Swamp, false), ['frog:8-25']);
  assert.deepEqual(at(CLIMATES.Swamp, true), ['frog:1.5-6', 'owl:60-150']);
  assert.deepEqual(at(CLIMATES.Desert, false), []);
  assert.deepEqual(at(CLIMATES.Desert2, true), ['jackal:120-300']);
  assert.deepEqual(at(CLIMATES.Ocean, true), []);
  assert.equal(WILD[CLIMATES.Swamp].night[0].chorus, 3);
  assert.deepEqual(wildVoicesFor(CLIMATES.Woodlands, { night: true, weather: 'sunny', winter: false, inTown: false }).map((v) => v.id), ['night:0', 'night:1']);
  const night = wildVoicesFor(CLIMATES.Woodlands, { night: true, weather: 'sunny', winter: false, inTown: false });
  assert.deepEqual(night.map((v) => [v.kind, [...v.dist], [...v.volume]]), [['owl', [18, 55], [0.2, 0.32]], ['howl', [160, 420], [0.4, 0.6]]], 'the owl near and taken down a little (AUDIT SOUNDSCAPE W12), the wolf 160 to 420 m off');
  assert.deepEqual([...wildVoicesFor(CLIMATES.Desert, { night: true, weather: 'sunny', winter: false, inTown: false })[0].dist], [180, 420]);
});

test('WORLD-AIR THE WEATHER, THE WINTER AND THE WALLS: rain quiets the crows and the owls and makes the frogs croak twice as often, the wolf still howls; a storm leaves only the frogs; snow and the winter take the frogs; inside a town no wolf and no frog, and the rest TOWN_WILD_GAP times further between (mutants: the rain\'s frogs; the storm\'s wolf; the winter\'s frogs; the town\'s gap)', () => {
  const v = (climate, now) => brief(wildVoicesFor(climate, { night: false, weather: 'sunny', winter: false, inTown: false, ...now }));
  assert.deepEqual(v(CLIMATES.Woodlands, { weather: 'rain' }), []);
  assert.deepEqual(v(CLIMATES.Woodlands, { weather: 'rain', night: true }), ['howl:90-240']);
  assert.deepEqual(v(CLIMATES.Swamp, { weather: 'rain', night: true }), ['frog:0.75-3']);
  assert.deepEqual(v(CLIMATES.Woodlands, { weather: 'thunder', night: true }), []);
  assert.deepEqual(v(CLIMATES.Swamp, { weather: 'thunder', night: true }), ['frog:0.75-3']);
  assert.deepEqual(v(CLIMATES.Swamp, { night: true, winter: true }), ['owl:60-150']);
  assert.deepEqual(v(CLIMATES.Swamp, { night: true, weather: 'snow' }), ['owl:60-150']);
  assert.deepEqual([TOWN_WILD_GAP, TOWN_WILD_FAR], [3, 1.6]);
  assert.deepEqual([...wildVoicesFor(CLIMATES.Woodlands, { night: true, weather: 'sunny', winter: false, inTown: true })[0].dist].map(r3), [28.8, 88], 'far and seldom (AUDIT SOUNDSCAPE W14)');
  assert.deepEqual(v(CLIMATES.Woodlands, { night: true, inTown: true }), ['owl:75-180']);
  assert.deepEqual(v(CLIMATES.Woodlands, { inTown: true }), ['crow:75-210']);
  assert.deepEqual(v(CLIMATES.Desert, { night: true, inTown: true }), []);
  assert.deepEqual([MARSH.day, MARSH.night], [0.08, 0.13]);
  const m = (climate, now) => r3(marshGain(climate, { night: false, weather: 'sunny', winter: false, inTown: false, ...now }));
  assert.deepEqual([m(CLIMATES.Swamp, {}), m(CLIMATES.Rainforest, { night: true }), m(CLIMATES.Swamp, { inTown: true }), m(CLIMATES.Swamp, { winter: true }), m(CLIMATES.Swamp, { weather: 'thunder' }), m(CLIMATES.Woodlands, {})], [0.08, 0.13, 0, 0, 0.032, 0]);
});

// ── the town ──────────────────────────────────────────────────────────

test('WORLD-AIR THE TOWN\'S HOURS: the murmur from half past six, rising to the busy hours (10 to 17), falling to half past nine and none after, as loud as the root of the town\'s size (16 blocks its whole) and the weather leaves the street; a smith at the anvil from 7 to 19; a tavern\'s evening from 17 to 2 (mutants: the open; the busy hours; the size\'s root; the rain; the smith\'s day; the tavern\'s evening)', () => {
  assert.deepEqual([MURMUR.max, MURMUR.open, MURMUR.close, [...MURMUR.busy], MURMUR.blocks], [0.22, 6.5, 21.5, [10, 17], 16]);
  assert.deepEqual([5, 6.5, 8, 10, 13, 17, 19, 21.4, 21.5, 23].map((h) => r3(murmurGain(h, 16, 'sunny'))), [0, 0, 0.094, 0.22, 0.22, 0.22, 0.122, 0.005, 0, 0]);
  assert.equal(r3(murmurGain(12, 4, 'sunny')), r3(0.22 * 0.5), 'a quarter the blocks, half the people');
  assert.equal(r3(murmurGain(12, 64, 'sunny')), 0.22, 'a city at its whole, no louder');
  assert.deepEqual(MURMUR_WEATHER, { rain: 0.45, thunder: 0.2, snow: 0.6 });
  assert.equal(r3(murmurGain(12, 16, 'rain')), r3(0.22 * 0.45));
  assert.equal(r3(murmurGain(36, 16, 'sunny')), 0.22, 'the hour wraps');
  assert.deepEqual([6.9, 7, 12, 18.9, 19, 23].map(smithAtWork), [false, true, true, true, false, false]);
  assert.deepEqual([12, 16.9, 17, 23, 1.9, 2, 4, 9.9, 10].map(tavernGain), [TAVERN.day, TAVERN.day, TAVERN.night, TAVERN.night, TAVERN.night, TAVERN.small, TAVERN.small, TAVERN.small, TAVERN.day], 'louder from 17 to 2, asleep from 2 to 10 (AUDIT SOUNDSCAPE W13)');
  assert.deepEqual({ ...TAVERN }, { name: 'town:tavern', key: 'town:tavern', reach: 35, day: 0.18, night: 0.5, small: 0.03, evening: 17, late: 2, opens: 10, ref: 4 });
  assert.deepEqual([SMITHY.reach, SMITHY.open, SMITHY.close, [...SMITHY.blows], [...SMITHY.beat], [...SMITHY.rest]], [45, 7, 19, [3, 9], [0.55, 0.8], [5, 16]]);
  assert.deepEqual({ ...MURMUR_TWIN }, { name: 'town:murmur:2', pitch: 0.917 });
});

// ── the driver ────────────────────────────────────────────────────────

test('WORLD-AIR THE DRIVER\'S SHORE: the surf a bed AT the edge when its bearing is known (flat when it is not, never both), breaking on its clock - a heavy sea a third quicker - with a crash at the edge while it is near, nothing past its reach; the lap close in on a quiet day (mutants: the crash\'s reach; both beds at once; the heavy sea\'s quicker waves)', () => {
  _resetMade();
  const e = fakeEngine();
  const air = createWorldAir({ engine: e, rand: dice(5) });
  run(air, 40, { ...LAND, shore: { dist: 30, dir: [1, 0] }, wind: 0.9, weather: 'rain' });
  const surf = e.beds3d.get(SURF.name);
  assert.ok(surf && surf.clip === SURF.bed && surf.pos[0] === 30 && surf.pos[2] === 0 && surf.volume > 0 && surf.refDistance === SURF_REF, JSON.stringify(surf));
  assert.equal(e.beds.has(SURF.name), false, 'never flat and at the edge at once');
  const crashes = e.shots.filter((s) => SCAPE_SFX.shoreCrash.includes(s.clip));
  assert.ok(crashes.length >= 3 && crashes.length <= 9, `a wave every 5 to 11 s: ${crashes.length}`);
  assert.ok(crashes.every((s) => s.pos[0] === 30 && s.far === WORLD_FAR));
  e.shots.length = 0;
  assert.equal(CRASH_REACH, 90);
  run(air, 30, { ...LAND, shore: { dist: 120, dir: [1, 0] } });
  assert.equal(e.shots.filter((s) => SCAPE_SFX.shoreCrash.includes(s.clip)).length, 0, 'too far for the crash to be told from the surf');
  run(air, 2, { ...LAND, shore: { dist: 150, dir: null } });
  assert.ok(e.beds.get(SURF.name)?.volume > 0 && !e.beds3d.has(SURF.name), 'no bearing: flat');
  run(air, 2, { ...LAND, shore: { dist: 400, dir: [1, 0] } });
  assert.equal(e.beds.has(SURF.name) || e.beds3d.has(SURF.name), false, 'past the reach: none');
  run(air, 2, { ...LAND, shore: { dist: 3, dir: [0, 1] }, wind: 0 });
  assert.ok(e.beds.get(LAP.name)?.volume > 0, 'close in on a quiet sea: the lap');
  const count = (wind, weather) => {
    const x = fakeEngine();
    run(createWorldAir({ engine: x, rand: dice(17) }), 300, { ...LAND, shore: { dist: 20, dir: [1, 0] }, wind, weather });
    return x.shots.filter((s) => SCAPE_SFX.shoreCrash.includes(s.clip)).length;
  };
  const calm = count(0, 'sunny'), gale = count(1, 'thunder');
  assert.ok(gale >= 1.3 * calm, `a heavy sea's waves a third quicker: ${gale} against ${calm}`);
});

test('WORLD-AIR THE EDGE STANDS AND THE CRASH IS THE WAVE\'S (AUDIT SOUNDSCAPE W5, W6, W9, W10): the host\'s edge - a point at the sea\'s surface - is where the surf and every crash stand while I walk, its distance measured live; each crash started so its loudest falls on the bed\'s own crash (BREAKER_CURL_S into the wave), once a wave; its loudness the sea\'s alone, the distance the panner\'s (mutants: the edge moving with me; the crash at the wave\'s start; the crash attenuated twice)', () => {
  const e = timedEngine();
  const air = createWorldAir({ engine: e, rand: dice(23) });
  const at = [40, -2.5, 0];
  runAt(e, air, 60, (t) => ({ ...LAND, ear: [t * 0.5, 0, 0], shore: { dist: 40 - t * 0.5, dir: [1, 0], at }, wind: 0.6 }));
  const crashes = e.shots.filter((s) => SCAPE_SFX.shoreCrash.includes(s.clip));
  assert.ok(crashes.length >= 5, `crashes: ${crashes.length}`);
  for (const s of crashes) assert.deepEqual(s.pos, at, 'at the edge, at the sea\'s surface - not where my ear stood');
  assert.deepEqual(e.beds3d.get(SURF.name).pos, at);
  const volumes = new Set(crashes.map((s) => s.volume));
  assert.equal(volumes.size, 1, 'the sea\'s loudness alone - nearer or further, the panner says');
  // each crash's loudest on the wave's own crash: the bed's breaker peaks BREAKER_CURL_S into its wave, and the take -
  // its own loudest CRASH_PEAK_S into it - is started so the two fall together
  const w2 = timedEngine();
  const air2 = createWorldAir({ engine: w2, rand: dice(29) });
  const vol = [];
  for (let k = 0; k < 60 * 30; k++) { w2.now = (k + 1) / 30; air2.frame(1 / 30, { ...LAND, shore: { dist: 20, dir: [1, 0] }, wind: 0.6 }); vol.push([w2.now, w2.beds3d.get(SURF.name)?.volume ?? 0]); }
  const peaks = vol.filter(([, v], i) => i > 0 && i < vol.length - 1 && v >= vol[i - 1][1] && v > vol[i + 1][1]).map(([at]) => at);
  const crash2 = w2.shots.filter((s) => SCAPE_SFX.shoreCrash.includes(s.clip));
  assert.ok(crash2.length >= 4 && peaks.length >= crash2.length, `${crash2.length} crashes, ${peaks.length} crests`);
  for (const s of crash2) {
    const loudest = s.at + CRASH_PEAK_S[SCAPE_SFX.shoreCrash.indexOf(s.clip)];   // within two frames: the wave's wrap and the queue each fall on a frame
    assert.ok(peaks.some((p) => Math.abs(p - loudest) < 0.07), `a crash loudest at ${loudest.toFixed(3)} s, the waves' crests at ${peaks.map((p) => p.toFixed(2)).join(' ')}`);
  }
});

test('WORLD-AIR THE DRIVER\'S WILD: a woodland night\'s owls near and wolves far, played `far` about the ear at their distances; a swamp night\'s frogs in choruses at the reeds; a woodland day\'s crow; a desert night\'s jackal far and pitched up; the marsh\'s bed in the swamp alone (mutants: the wolf\'s distance; the chorus; the jackal\'s pitch; the marsh\'s bed)', () => {
  const e = fakeEngine();
  const air = createWorldAir({ engine: e, rand: dice(11) });
  run(air, 600, { ...LAND, night: true, hour: 23 });
  const owls = e.shots.filter((s) => SCAPE_SFX.owl.includes(s.clip)), wolves = e.shots.filter((s) => SCAPE_SFX.howl.includes(s.clip));
  assert.ok(owls.length >= 6, `owls: ${owls.length}`);
  assert.ok(wolves.length >= 2, `wolves: ${wolves.length}`);
  for (const s of owls) assert.ok(Math.hypot(s.pos[0], s.pos[2]) <= 55 && s.far === WORLD_FAR && s.volume <= 0.32);
  for (const s of wolves) assert.ok(Math.hypot(s.pos[0], s.pos[2]) >= 160 && Math.hypot(s.pos[0], s.pos[2]) <= 420 && s.refDistance === 60);
  assert.equal(e.beds.has(MARSH.name), false, 'no marsh in the woods');
  e.shots.length = 0;
  run(air, 60, { ...LAND, climate: CLIMATES.Swamp, night: true, hour: 23 });
  const frogs = e.shots.filter((s) => SCAPE_SFX.frog.includes(s.clip));
  assert.ok(frogs.length >= 15, `a chorus: ${frogs.length}`);
  assert.ok(frogs.every((s) => s.pos[1] <= 0 && Math.hypot(s.pos[0], s.pos[2]) <= 37), 'at the reeds');
  assert.ok(e.beds.get(MARSH.name)?.volume > 0, 'the marsh hums');
  e.shots.length = 0;
  run(air, 400, LAND);
  assert.ok(e.shots.filter((s) => SCAPE_SFX.crow.includes(s.clip)).length >= 3, 'the woods by day: crows');
  assert.equal(e.shots.filter((s) => SCAPE_SFX.owl.includes(s.clip)).length, 0, 'and no owl');
  e.shots.length = 0;
  run(air, 1500, { ...LAND, climate: CLIMATES.Desert, night: true, hour: 23 });
  const jackals = e.shots.filter((s) => SCAPE_SFX.howl.includes(s.clip));
  assert.ok(jackals.length >= 3, `jackals: ${jackals.length}`);
  for (const s of jackals) assert.ok(s.pitch >= 1.25 && s.pitch <= 1.45 && Math.hypot(s.pos[0], s.pos[2]) >= 180, 'far, and pitched up');
});

test('WORLD-AIR THE DRIVER\'S TOWN: the murmur and the tavern made of the player\'s own people (none without them - never shipped); the murmur by day in the town, two loops of it (the second lower), each the whole\'s power over the root of two; the tavern at its door within 35 m; the anvil at the smithy\'s door within 45 m in bouts of 3 to 9 blows, rests of 5 to 16 s between, by day and never at night; stop lets every bed and far shot go (mutants: the smith at night; the tavern\'s place; a door\'s reach unbounded; the murmur out of town; one loop; a bed left at stop)', () => {
  _resetMade();
  const quiet = fakeEngine({ people: false });
  assert.equal(ensureTownBeds(quiet, { worker: null, idle: null }), false, 'no archive: no town beds');
  const e = timedEngine();
  const air = createWorldAir({ engine: e, rand: dice(13) });
  const smithy = [20, 0, 5], tavern = [-10, 0, 8];
  runAt(e, air, 120, { ...LAND, inTown: true, townBlocks: 16, hour: 11, smithies: [smithy], taverns: [tavern] });
  assert.ok(e.registered.has(MURMUR.key) && e.registered.has(TAVERN.key), 'made of the people');
  const whole = murmurGain(11, 16, 'sunny');
  assert.ok(Math.abs(e.beds.get(MURMUR.name)?.volume - whole * Math.SQRT1_2) < 1e-9, `the street at eleven: ${e.beds.get(MURMUR.name)?.volume}`);
  assert.deepEqual([e.beds.get(MURMUR_TWIN.name)?.clip, e.beds.get(MURMUR_TWIN.name)?.volume, e.beds.get(MURMUR_TWIN.name)?.pitch], [MURMUR.key, e.beds.get(MURMUR.name)?.volume, MURMUR_TWIN.pitch], 'and its twin, lower');
  const t = e.beds3d.get(TAVERN.name);
  assert.ok(t && t.pos[0] === -10 && t.pos[1] === 1 && t.volume === TAVERN.day, JSON.stringify(t));
  const blows = e.shots.filter((s) => s.clip === SCAPE_SFX.anvil[0]);
  assert.ok(blows.length >= 12, `the smith at work: ${blows.length}`);
  assert.ok(blows.every((s) => s.pos[0] === 20 && s.pos[1] === 1 && s.pos[2] === 5));
  // the bouts: blows a beat apart, rests between
  const bouts = [[blows[0]]];
  for (let i = 1; i < blows.length; i++) (blows[i].at - blows[i - 1].at <= SMITHY.beat[1] + 0.05 ? bouts.at(-1) : (bouts.push([]), bouts.at(-1))).push(blows[i]);
  for (const b of bouts.slice(1, -1)) assert.ok(b.length >= 3 && b.length <= 9, `a bout of ${b.length}`);
  for (let i = 1; i < bouts.length; i++) { const gap = bouts[i][0].at - bouts[i - 1].at(-1).at; assert.ok(gap >= SMITHY.rest[0] - 0.05 && gap <= SMITHY.rest[1] + 0.05, `a rest of ${gap.toFixed(2)} s`); }
  e.shots.length = 0;
  runAt(e, air, 30, { ...LAND, inTown: true, townBlocks: 16, hour: 22, night: true, smithies: [smithy], taverns: [tavern] });
  assert.equal(e.shots.filter((s) => SCAPE_SFX.anvil.includes(s.clip)).length, 0, 'no smith at night');
  assert.equal(e.beds.has(MURMUR.name) || e.beds.has(MURMUR_TWIN.name), false, 'the street gone home');
  assert.equal(e.beds3d.get(TAVERN.name)?.volume, TAVERN.night, 'the tavern in the evening');
  runAt(e, air, 30, { ...LAND, inTown: true, hour: 12, smithies: [[50, 0, 0]], taverns: [[0, 0, 40]] });
  assert.equal(e.beds3d.has(TAVERN.name), false, 'a tavern\'s door 40 m off: past its reach');
  assert.equal(e.shots.filter((s) => SCAPE_SFX.anvil.includes(s.clip)).length, 0, 'a smithy 50 m off: past its reach');
  runAt(e, air, 2, { ...LAND, inTown: false, hour: 12, smithies: [smithy], taverns: [tavern] });
  assert.equal(e.beds.has(MURMUR.name) || e.beds3d.has(TAVERN.name), false, 'out of town, none of it');
  runAt(e, air, 2, { ...LAND, inTown: true, hour: 12, shore: { dist: 10, dir: [1, 0] } });
  air.stop();
  assert.deepEqual([[...e.beds.keys()], [...e.beds3d.keys()], e.faded], [[], [], [WORLD_FAR]]);
});

test('WORLD-AIR A PAUSE (AUDIT SOUNDSCAPE W7): a pause holds every clock - the wild\'s voices, the waves, the smith\'s bouts and every call queued - nothing played under it, the queue never bunched on the unpause; a smith\'s queued run let go the moment he stops (mutants: the wild\'s clock run under a pause; the smith at work under one; the queue\'s clock run; the smith\'s queue kept)', () => {
  const e = timedEngine();
  const air = createWorldAir({ engine: e, rand: dice(31) });
  const w = { ...LAND, climate: CLIMATES.Swamp, night: true, hour: 12, inTown: false, shore: { dist: 20, dir: [1, 0] }, smithies: [[5, 0, 5]] };
  runAt(e, air, 20, w);
  const before = e.shots.length;
  assert.ok(before > 5);
  runAt(e, air, 120, { ...w, paused: true });
  assert.equal(e.shots.length, before, 'nothing under a pause');
  // the smith with dice that always queue his run (a roll of 0.1: a bout of four blows from the first frame, done by
  // 1.76 s, its run queued for 4.81 s) - paused at 3 s with the run still owed
  const town = timedEngine();
  const air2 = createWorldAir({ engine: town, rand: () => 0.1 });
  const tw = { ...LAND, inTown: true, hour: 12, smithies: [[5, 0, 5]] };
  runAt(town, air2, 3, tw);
  const n = town.shots.length;
  assert.equal(n, 4, 'a bout of four');
  runAt(town, air2, 60, { ...tw, paused: true });
  assert.equal(town.shots.length, n, 'the smith and his queued run rest with the world');
  runAt(town, air2, 3, tw);
  assert.ok(town.shots.some((x) => x.clip === SCAPE_SFX.anvil[1]), 'the run, owed, played after');
  // and let go the moment the smith stops: the evening comes with his run owed
  const eve = timedEngine();
  const air3 = createWorldAir({ engine: eve, rand: () => 0.1 });
  runAt(eve, air3, 3, tw);
  runAt(eve, air3, 5, { ...tw, hour: 19.5 });
  assert.equal(eve.shots.filter((x) => x.clip === SCAPE_SFX.anvil[1]).length, 0, 'the smith gone home: his queued run with him');
  const frames = new Map();
  runAt(e, air, 5, w);
  for (const s of e.shots.slice(before)) frames.set(s.at, (frames.get(s.at) ?? 0) + 1);
  assert.ok(Math.max(0, ...frames.values()) <= 4, 'no burst on the unpause frame');
});

test('WORLD-AIR THE FROGS\' EDGES (AUDIT SOUNDSCAPE W12): each croak cut out of its take mid-sound eased in and out (tools/soundscapeSfxInstall.mjs FROG_EDGES, sndify.mjs bake `edges`) - its last 5 ms near silence and its last sample at rest, where they ended at a tenth of their peak and clicked (mutants: the edges unbaked; the fade the wrong way)', async () => {
  const { readFileSync } = await import('node:fs');
  const { bake } = await import('../../../tools/sndify.mjs');
  const { FROG_EDGES, PICKS } = await import('../../../tools/soundscapeSfxInstall.mjs');
  assert.deepEqual([...FROG_EDGES], [0.004, 0.015]);
  assert.deepEqual(PICKS.filter((p) => p.edges).map((p) => p.as), ['wild-frog-1', 'wild-frog-2', 'wild-frog-3', 'wild-frog-4']);
  assert.ok(readFileSync(new URL('../../../tools/soundscapeSfxInstall.mjs', import.meta.url), 'utf8').includes('maxSeconds: p.max, edges: p.edges ?? null });'), 'the tool hands each pick\'s edges to the bake');
  const flat = bake(new Float32Array(2205).fill(0.5), 11025, { trim: false, peak: 0.8, edges: FROG_EDGES });
  assert.ok(Math.abs(flat[0] - 128) <= 1 && Math.abs(flat.at(-1) - 128) <= 1, 'from rest and back to it');
  assert.ok(Math.abs(flat[1102] - 128) > 90, 'the middle untouched');
  for (const k of SCAPE_SFX.frog) {
    const x = [...readFileSync(new URL(`../../../public/sfx/${k}.wav`, import.meta.url)).subarray(44)].map((v) => (v - 128) / 128);
    const n = Math.round(0.005 * 11025), tail = Math.sqrt(x.slice(-n).reduce((a, v) => a + v * v, 0) / n);
    assert.ok(tail < 0.03 && Math.abs(x.at(-1)) < 0.01, `${k}: its tail ${tail.toFixed(3)}`);
  }
});
