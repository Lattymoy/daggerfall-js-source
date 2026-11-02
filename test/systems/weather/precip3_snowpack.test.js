// PRECIP3 (2026-10-19): THE SNOW THE GROUND KEEPS - systems/weather/snowpack.js. The pack's step (what falls lying, the
// degree-hours over the step's own sky hours in closed form, the rain's heat), its cover and its snowline (the heights its
// cover crosses 10, 50 and 90 % - one reading for the shader and the host), the snow year from midsummer on the event
// clock's step grid with the summer before's survival, and the lattice of pixel corners that integrates a place's history
// over the weather map: pure in the place and the minute, whoever asks and in whatever company, its skipped steps exact.
// AUDIT PRECIP (the owner: "Audit this and ensure perfection. No band aids") re-pinned every law PACK-1..10 moved.
// bible/07-Rendering/Biome-Precipitation.md is the record, bible/01-Overview/audits/Audit-Precip.md the audit's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SNOWPACK, coverOf, sweOfCover, snowlineOf, coverAtHeight, stepPack, fallRateOf, stepAir, stepAirFloor, positiveCosIntegral,
  cosMinOver, yearOriginOf, levelAltitude, levelAbove, levelIndexAbove, SnowpackLattice, MIDSUMMER_MINUTE, WET_TYPES, cornerField,
  latticeKey,
} from '../../../src/systems/weather/snowpack.js';
import { setAirGround, airParamsAt, airTemperature, LAPSE_C_PER_M, COLDEST_DAY, RAIN_ALL_C } from '../../../src/systems/weather/airTemperature.js';
import { systemsNear, systemsSpanWalk, systemsAmong, seasonCeilings, birthLaw, diurnal, SYSTEM_TYPES, wornAmong, PRIORITY } from '../../../src/systems/weather/weatherMap.js';
import { skyMinuteOfEvent, setSkyCalendar } from '../../../src/systems/skyCalendar.js';
import { SKY_SEGMENTS } from '../../../src/net/skyLaw.js';
import { sharedClassicMinutes } from '../../../src/net/wire.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const N = SNOWPACK.levels.count;
const woods = () => CLIMATES.Woodlands;
/** An air ground over the woods: the ground `g` m above the sea, its pixels' tops `top(px, py)`. */
const woodsGround = (g = 0, top = () => 400) => ({ climateAt: woods, groundAt: () => g, topAt: top });
const Y = 360 * 1440, S = SNOWPACK.stepMinutes;

test('PRECIP3 THE COVER: nought bare, whole at SNOWPACK.fullMm, smooth between; sweOfCover its inverse (mutants: the cover a ramp; the inverse off)', () => {
  assert.equal(coverOf(0), 0); assert.equal(coverOf(-3), 0); assert.equal(coverOf(SNOWPACK.fullMm), 1); assert.equal(coverOf(99), 1);
  near(coverOf(SNOWPACK.fullMm / 2), 0.5, 1e-12, 'half');
  for (const c of [0.05, 0.1, 0.33, 0.5, 0.77, 0.9, 0.97]) near(coverOf(sweOfCover(c)), c, 1e-9, `inverse at ${c}`);
});

test('PRECIP3 THE SNOWLINE: a pack monotone in height crosses 10, 50 and 90 % where coverAtHeight reads them back, between the levels about each; white below the lowest a level under it, bare above the highest a level over it - and the HELD levels\' crossings as all the levels read them, one they never reach a level over the highest held - never clamped to the ground\'s top (AUDIT PRECIP A-4: every crossing held at a metre over the ceil drew a hill\'s top in the snowline\'s band up to a third whiter than its pack) - where a bare pack\'s ground reads bare to its very top (mutants: the crossing off its levels; the crossings clamped to the ground; the stand-in the top of all levels)', () => {
  const swe = new Float32Array(N);
  for (let k = 0; k < N; k++) swe[k] = Math.max(0, (k - 6) * 3.1);
  const line = snowlineOf(swe);
  for (const [q, c] of [[0, 0.1], [1, 0.5], [2, 0.9]]) {
    const h = line[q], k = (h - SNOWPACK.levels.from) / SNOWPACK.levels.step;
    const swAt = swe[Math.floor(k)] + (swe[Math.floor(k) + 1] - swe[Math.floor(k)]) * (k - Math.floor(k));
    near(coverOf(swAt), c, 1e-6, `the pack there is the cover ${c}`);
    near(coverAtHeight(line, h), c, 1e-9, `read back at ${c}`);
  }
  assert.ok(line[0] < line[1] && line[1] < line[2], 'in order up the slope');
  assert.equal(coverAtHeight(line, line[0] - 0.25 * (line[1] - line[0]) - 1), 0, 'bare a quarter span under');
  assert.equal(coverAtHeight(line, line[2] + 0.25 * (line[2] - line[1]) + 1), 1, 'whole a quarter span over');
  const white = new Float32Array(N).fill(50), bare = new Float32Array(N);
  assert.deepEqual(snowlineOf(white), [levelAltitude(-1), levelAltitude(-1), levelAltitude(-1)], 'white to the lowest level');
  assert.deepEqual(snowlineOf(bare), [levelAltitude(N), levelAltitude(N), levelAltitude(N)], 'never');
  // the held levels: a point's ground tops out under level n - 2 (levelIndexAbove), and its crossings read as all the
  // levels read them - the next over the ground's top within a level included
  assert.deepEqual(snowlineOf(swe, [0, 0, 0], 10), line, 'every crossing within the held levels exact - none drawn down to the ground');
  const part = snowlineOf(swe, [0, 0, 0], 9);
  assert.deepEqual(part.slice(0, 2), line.slice(0, 2), 'the crossings the held levels reach exact');
  assert.equal(part[2], levelAltitude(9), 'one they never reach a level over the highest held');
  const held = snowlineOf(bare, [0, 0, 0], 9);
  assert.deepEqual(held, [levelAltitude(9), levelAltitude(9), levelAltitude(9)], 'never this white up to the held levels');
  assert.equal(coverAtHeight(held, levelAltitude(7)), 0, 'a bare pack\'s ground bare to its very top');
  assert.equal(levelAbove(levelAltitude(4) - 1), levelAltitude(5), 'the level over the first at or above');
  assert.equal(levelAbove(levelAltitude(4)), levelAltitude(5));
  assert.equal(levelIndexAbove(1e9), N - 1, 'never past the highest');
  assert.ok(levelAltitude(N - 1) >= 3610, 'the levels reach over the landforms\' tallest ground (LANDFORM_CEILING)');
});

test('PRECIP3 THE MELT IN CLOSED FORM (AUDIT PRECIP PACK-8): positiveCosIntegral is the degree-time of a day\'s cosine over a base, exact against a fine sum for any base, swing and interval; cosMinOver the cosine\'s least over it (mutants: a stretch dropped; the wrong root)', () => {
  const numeric = (A, D, a, b) => { let s = 0; const n = 20000, h = (b - a) / n; for (let i = 0; i < n; i++) s += Math.max(0, A + D * Math.cos(a + (i + 0.5) * h)) * h; return s; };
  for (const [A, D, a, b] of [[2, 5, 0, 1], [-3, 5, -2, 9], [7, 4, 1, 3], [-6, 4, 0, 7], [0.5, 8, -10, 25], [1, 0, 0, 2], [-1, 0, 0, 2], [3, 3, 5, 5.5]]) {
    near(positiveCosIntegral(A, D, a, b), numeric(A, D, a, b), 1e-5, `A ${A} D ${D} [${a}, ${b}]`);
  }
  assert.equal(positiveCosIntegral(1, 2, 3, 3), 0, 'an empty interval');
  for (const [a, b] of [[0, 1], [2, 4], [3, 3.2], [-1, 7], [4, 6]]) {
    let m = Infinity; for (let i = 0; i <= 20000; i++) m = Math.min(m, Math.cos(a + (b - a) * i / 20000));
    near(cosMinOver(a, b), m, 1e-6, `[${a}, ${b}]`);
  }
});

test('PRECIP3 THE STEP: snow lies at the levels its air is cold enough at, the degree-hours melt it, rain on it melts more; never under nought nor over SNOWPACK.capMm (AUDIT PRECIP PACK-3: a summit\'s pack grew without bound), and monotone in height whatever the air; the fall the heaviest wet band\'s at its word\'s rate (PACK-10: the worn word\'s) (mutants: the melt\'s sign; the rain\'s heat dropped; the cap; the fall the worn word\'s)', () => {
  const air = (base, day = 0, th0 = 0, th1 = 2 * Math.PI / 8) => ({ base, day, th0, th1 });
  const swe = new Float32Array(N);
  stepPack(swe, air(-10), 2, 3);
  for (let k = 0; k < N; k++) near(swe[k], 6, 1e-5, `lies at level ${k}`);
  const warm = Float32Array.from(swe);
  stepPack(warm, air(5), 0, 3);
  for (let k = 0; k < N; k++) {
    const t = 5 - LAPSE_C_PER_M * levelAltitude(k);
    near(warm[k], Math.max(0, 6 - SNOWPACK.melt * Math.max(0, t) * 3), 1e-4, `melts at level ${k}`);
  }
  const wet = Float32Array.from(swe);
  stepPack(wet, air(5), 4, 3);
  const t0 = 5 - LAPSE_C_PER_M * levelAltitude(0);
  assert.ok(wet[0] < warm[0], 'rain melts more where it is rain');
  near(wet[0], Math.max(0, 6 - SNOWPACK.melt * t0 * 3 - SNOWPACK.rainMelt * 4 * 3 * t0), 1e-4, 'its heat over the ice\'s latent');
  const deep = new Float32Array(N).fill(SNOWPACK.capMm - 1);
  stepPack(deep, air(-20), 3.3, 3);
  for (let k = 0; k < N; k++) assert.equal(deep[k], SNOWPACK.capMm, 'held at the cap');
  const some = new Float32Array(N);
  stepPack(some, air(-5), 1, 3, 4);
  assert.ok(some[3] > 0 && some[4] === 0, 'only the levels held');
  let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const p = new Float32Array(N);
  for (let i = 0; i < 2000; i++) {
    const th0 = rnd() * 20;
    stepPack(p, air(rnd() * 24 - 12, rnd() * 6, th0, th0 + rnd() * 2), rnd() < 0.4 ? rnd() * 3 : 0, 3);
    for (let k = 0; k < N; k++) assert.ok(p[k] >= 0 && p[k] <= SNOWPACK.capMm, 'within its bounds');
    for (let k = 1; k < N; k++) assert.ok(p[k] >= p[k - 1] - 1e-3, `monotone at step ${i} level ${k}`);
  }
  assert.equal(fallRateOf(null), 0);
  assert.equal(fallRateOf({ rain: 0.5, thunder: 0, snow: 0 }), SNOWPACK.rate.rain * 0.5);
  assert.equal(fallRateOf({ rain: 0.9, thunder: 0.3, snow: 0 }), Math.max(SNOWPACK.rate.rain * 0.9, SNOWPACK.rate.thunder * 0.3), 'the heaviest band');
  assert.equal(fallRateOf({ rain: 0, thunder: 2, snow: 0 }), SNOWPACK.rate.thunder, 'clamped');
});

test('PRECIP3 THE AIR A STEP is the air\'s own: stepAir\'s base and swing at the step\'s middle are airTemperature\'s at the sea, over the step\'s SKY hours (AUDIT PRECIP PACK-8: online the sky runs its own pace); stepAirFloor under every air of the step (mutants: a term dropped; the floor over the air)', () => {
  setAirGround(woodsGround(30));
  try {
    const [x, z] = cornerField(150, 40), p = airParamsAt(x, z);
    for (const t0 of [(405 * 360 + 3) * 1440 + 360, (405 * 360 + 200) * 1440 + 900]) {
      const t1 = t0 + S, tm = (t0 + t1) / 2;
      for (const fall of [null, { intensity: 0.7, rain: 0.7, thunder: 0, snow: 0.7, cover: 1 }, { intensity: 0.3, rain: 0.3, thunder: 0, snow: 0, cover: 0.4 }]) {
        const a = stepAir(p, x, z, t0, t1, fall);
        const th = a.th0 + (a.th1 - a.th0) / 2;
        near(a.base + a.day * Math.cos(th), airTemperature(x, z, 0, tm, skyMinuteOfEvent(tm), fall), 1e-9, 'at the step\'s middle');
        near(a.th1 - a.th0, 2 * Math.PI * (skyMinuteOfEvent(t1) - skyMinuteOfEvent(t0)) / 1440, 1e-9, 'the sky\'s hours');
        const floor = stepAirFloor(p, x, z, t0, t1);
        for (let i = 0; i <= 12; i++) assert.ok(floor <= a.base + a.day * Math.cos(a.th0 + (a.th1 - a.th0) * i / 12) + 1e-9, 'the floor under the step\'s air');
      }
    }
  } finally { setAirGround(null); }
});

test('PRECIP3 THE SNOW YEAR: its origin a step on the event clock\'s grid at or before the sky\'s last midsummer - never after the minute it holds (AUDIT PRECIP PACK-9: online it began in its future) - the same for every minute of the year (mutants: the origin off the grid; the origin after the minute)', () => {
  for (const t of [MIDSUMMER_MINUTE + 1, 405 * Y + 10, 405 * Y + MIDSUMMER_MINUTE - 1, 405 * Y + MIDSUMMER_MINUTE + 7, 406 * Y + 359 * 1440]) {
    const o = yearOriginOf(t);
    assert.equal(o % S, 0, 'on the grid');
    assert.ok(o <= t && t - o < Y + S, 'its year, begun');
    assert.ok(((MIDSUMMER_MINUTE - o) % Y + Y) % Y < S, 'at midsummer');
  }
  assert.equal(yearOriginOf(405 * Y + 10), yearOriginOf(405 * Y + MIDSUMMER_MINUTE - 1), 'one year, one origin');
  assert.notEqual(yearOriginOf(405 * Y + MIDSUMMER_MINUTE - 1), yearOriginOf(405 * Y + MIDSUMMER_MINUTE + S), 'midsummer turns it');
  assert.equal(MIDSUMMER_MINUTE, (COLDEST_DAY + 180) * 1440);
  setSkyCalendar(true);
  try {
    for (const days of [30, 200, 500, 900]) {
      for (const hrs of [0, 7, 13]) {
        const t = sharedClassicMinutes(SKY_SEGMENTS[0].fromMs + days * 86_400_000 + hrs * 3_600_000);
        const o = yearOriginOf(t);
        assert.equal(o % S, 0, `on the event clock's grid, ${days} days on`);
        assert.ok(o <= t, 'never after the minute');
        const at = ((skyMinuteOfEvent(o) - MIDSUMMER_MINUTE) % Y + Y) % Y, next = ((skyMinuteOfEvent(o + S) - MIDSUMMER_MINUTE) % Y + Y) % Y;
        assert.ok(at > Y / 2 || at === 0, `the last step at or before the sky's midsummer, ${days} days on`);
        assert.ok(next < Y / 2, 'the step after it past it');
      }
    }
  } finally { setSkyCalendar(false); }
});

test('PRECIP3 THE LATTICE: its points on map pixel CORNERS (AUDIT PRECIP HOST-5); a place\'s pack the same whoever integrates it and in whatever company, in one go or in slices, its quiet steps skipped exactly; the pack now the blend of its two step packs - the earlier at its step, the later at the next (PACK-4: it ran the last step on under the fall of the instant) - and a clock set back inside them answered as it stands (PACK-9); only the levels up to its ground\'s top held (PACK-7) (mutants: the skip loosened; a point\'s history leaning on its neighbours; the blend\'s ends swapped; every level held)', () => {
  setAirGround(woodsGround(0, (px) => 200 + (px % 7) * 90));
  try {
    assert.deepEqual(cornerField(10, 20), [10 * TERRAIN_SIZE, (500 - 20) * TERRAIN_SIZE], 'the north-west corner of pixel (10, 20)');
    const t = (406 * 360 + 360 - 20) * 1440 + 600;
    const a = new SnowpackLattice({ climateAt: woods }), b = new SnowpackLattice({ climateAt: woods }), c = new SnowpackLattice({ climateAt: woods });
    assert.deepEqual(a.indexOf(203, 101), [Math.round(203.5 / 2), Math.round(101.5 / 2)]);
    const pa = [], pb = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) pa.push(a.point(50 + i, 60 + j, t));
    for (let j = 2; j < 5; j++) for (let i = 2; i < 5; i++) pb.push(b.point(50 + i, 60 + j, t));
    a.advance(pa, t); b.advance(pb, t);
    const shared = a.point(52, 62, t), shared2 = b.point(52, 62, t);
    assert.deepEqual([...shared.swe], [...shared2.swe], 'one place, one pack');
    assert.ok(shared.swe.some((v) => v > 0), 'a winter has laid snow');
    for (const pt of pa) {
      assert.equal(pt.n, levelIndexAbove(pt.ceil) + 1, 'held to the level over its top');
      assert.ok(pt.n < N, 'never every level on a low ground');
      assert.ok(pt.ceil >= 200, 'its ceil the highest top about it');
    }
    const pc = [c.point(52, 62, t)];
    let calls = 0;
    while (!c.advance(pc, t, 0)) calls++;
    assert.ok(calls > 100, 'sliced');
    assert.deepEqual([...pc[0].swe], [...shared.swe], 'sliced, the same pack');
    assert.ok(a.stepsSkipped > 0, 'the warm early autumn skipped');
    // AUDIT PRECIP PACK-6: a step's systems are found a node at a time - a deadline already past answers none, and the
    // finding goes on where it stood at the next ask
    const e = new SnowpackLattice({ climateAt: woods }), pe = [e.point(70, 80, t)];
    let tries = 0, found = null;
    while ((found = e.systemsFor(pe[0].step + S, pe, -Infinity)) === null) tries++;
    assert.ok(tries > 0, `walked over ${tries} asks`);
    assert.ok(Array.isArray(found));
    const d = new SnowpackLattice({ climateAt: woods });
    const pd = pa.map((p) => { const q = d.point(p.i, p.j, t); q.top = N - 1; return q; });
    d.advance(pd, t);
    assert.equal(d.stepsSkipped, 0);
    for (let k = 0; k < pd.length; k++) assert.deepEqual(snowlineOf(pd[k].swe, [0, 0, 0], pa[k].n), snowlineOf(pa[k].swe, [0, 0, 0], pa[k].n), 'the skipped steps changed no line');
    // the pack now: its older pack at the step before, its newer at the step, the blend between
    const pt = a.point(51, 61, t);
    a.advance([pt], t);
    assert.ok(pt.step >= t && pt.step - t < S, 'integrated one step ahead');
    const at = (m) => Array.from(a.packNow(pt, m)).slice(0, pt.n);
    assert.deepEqual(at(pt.step), Array.from(pt.swe), 'the newer at its step');
    assert.deepEqual(at(pt.step - S), Array.from(pt.prev), 'the older at the step before');
    const mid = at(pt.step - S / 2);
    for (let k = 0; k < pt.n; k++) near(mid[k], (pt.prev[k] + pt.swe[k]) / 2, 1e-4, `half way at level ${k}`);
    const back = a.point(51, 61, pt.step - S + 1);
    assert.equal(back, pt, 'a clock set back inside its two packs keeps the point');
    assert.deepEqual(WET_TYPES, ['rain', 'snow']);
    for (const held of a._systems.values()) for (const disc of held) for (const s of disc.systems) assert.ok(['rain', 'snow', 'thunder'].includes(s.type), `the wet types alone: ${s.type}`);
    for (const s of systemsNear(pt.x, pt.z, t, woods, 20000, WET_TYPES)) assert.ok(['rain', 'snow', 'thunder'].includes(s.type), 'wet alone');
    assert.ok(PRIORITY.length > WET_TYPES.length);
    assert.equal(latticeKey(3, -4), latticeKey(3, -4)); assert.notEqual(latticeKey(3, -4), latticeKey(-4, 3));
  } finally { setAirGround(null); }
});

test('PRECIP3 A SPAN OF STEPS (AUDIT PRECIP DOC-7): one walk of the weather map serves a day of the history - at every step of the span the systems each step\'s own walk finds there, the same and in the same order; and a storm cell\'s candidate is thinned by its season\'s ceiling only where no climate\'s law could keep it then (mutants: the span\'s order lost; a birth born at its end left out; the season\'s ceiling without its hours; the ceiling one climate\'s)', () => {
  let seed = 11; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  let steps = 0, found = 0;
  for (let k = 0; k < 12; k++) {
    const x = rnd() * 600000, z = rnd() * 300000, range = 6000 + rnd() * 20000, S = SNOWPACK.stepMinutes;
    const t0 = (405 * 360 + Math.floor(rnd() * 360)) * 1440 + Math.floor(rnd() * 8) * S, t1 = t0 + 7 * S;
    const walk = systemsSpanWalk(x, z, t0, t1, woods, range, WET_TYPES);
    let r = walk.next(); while (!r.done) r = walk.next();
    for (let t = t0; t <= t1; t += S) {
      const a = systemsAmong(r.value, t), b = systemsNear(x, z, t, woods, range, WET_TYPES);
      assert.deepEqual(a.map((s) => [s.id, s.d]), b.map((s) => [s.id, s.d]), `${x.toFixed(0)}, ${z.toFixed(0)} at ${t}`);
      steps++; found += b.length;
    }
  }
  assert.ok(found > steps / 2, `systems found: ${found} over ${steps} steps`);
  const ceil = seasonCeilings();
  for (const type of PRIORITY) {
    for (const season of [0, 1, 2, 3]) {
      for (const climate of Object.values(CLIMATES)) {
        const law = birthLaw(climate, season);
        if (!law) continue;
        for (let h = 0; h < 24; h += 0.5) assert.ok(law.weight[type] * diurnal(type, h, season) <= ceil[type][season] + 1e-12, `${type} in season ${season}, climate ${climate} at ${h}`);
      }
    }
  }
  assert.ok(Object.keys(SYSTEM_TYPES).length > 0);
});

test('PRECIP3 THE SUMMER BEFORE (AUDIT PRECIP PACK-3): a point whose air can keep snow through the summer begins its year from the year before\'s survival (its spin, integrated from nothing on the main grid) - a summit\'s pack outlives midsummer - and a lowland that melts out starts from none, its spin never run; the turn continuous (mutants: the spin skipped; meltsOut always true)', () => {
  setAirGround({ climateAt: () => CLIMATES.Mountain, groundAt: () => 0, topAt: () => 3400 });
  try {
    const t = (406 * 360 + 60) * 1440;   // early spring
    const lat = new SnowpackLattice({ climateAt: () => CLIMATES.Mountain });
    const pt = lat.point(400, 30, t);
    assert.ok(pt.spin, 'a summit\'s point spins the year before');
    lat.advance([pt], yearOriginOf(t) + 1);
    assert.ok(lat.spinsRun > 1000, 'the year before integrated');
    assert.equal(pt.spin, null);
    assert.ok(pt.swe[pt.n - 1] > 0, 'its highest level white at midsummer');
  } finally { setAirGround(null); }
  setAirGround({ climateAt: () => CLIMATES.Rainforest, groundAt: () => 0, topAt: () => 300 });
  try {
    const lat = new SnowpackLattice({ climateAt: () => CLIMATES.Rainforest });
    const pt = lat.point(400, 400, (406 * 360 + 60) * 1440);
    assert.equal(pt.spin, null, 'the tropics\' lowland melts out: no spin');
  } finally { setAirGround(null); }
});

test('PRECIP3 THE FALL IN A YEAR (AUDIT PRECIP PACK-2): the map\'s wet hours at the calibrated rates fall as a temperate maritime land does - 700 to 1,400 mm of water a year on the woods and the ranges, a few hundred on the desert (they fell 2,400 to 3,900 mm: a boreal pack on lowland woods) (mutants: a rate tripled)', () => {
  for (const [c, lo, hi] of [[CLIMATES.Woodlands, 700, 1400], [CLIMATES.Mountain, 700, 1400], [CLIMATES.Desert, 0, 450]]) {
    const at = () => c;
    for (const [x, z] of [[300 * 819.2, 300 * 819.2], [700 * 819.2, 100 * 819.2]]) {
      let mm = 0;
      for (let t = 406 * Y; t < 407 * Y; t += S) mm += fallRateOf(wornAmong(systemsNear(x, z, t, at, 0, WET_TYPES), x, z).fall) * S / 60;
      assert.ok(mm >= lo && mm <= hi, `climate ${c} at ${x.toFixed(0)}: ${mm.toFixed(0)} mm a year`);
    }
  }
});

test('PRECIP3 A LONG CATCH-UP LETS ITS BIRTHS GO (AUDIT PRECIP HOST-10): the lattice reads the weather map\'s births through a function of its own, never the sim\'s - so its history lands in a memo of its own - and lets it go once it stands after more than two days of steps (mutants: the sim\'s read; the memo kept)', () => {
  setAirGround(woodsGround());
  try {
    const lat = new SnowpackLattice({ climateAt: woods });
    const first = lat._births;
    assert.notEqual(first, woods, 'a read of its own');
    const t = (406 * 360 + 340) * 1440;
    lat.advance([lat.point(30, 40, t)], t);
    assert.notEqual(lat._births, first, 'let go after the catch-up');
    const kept = lat._births;
    lat.advance([lat.point(30, 40, t + S)], t + S);
    assert.equal(lat._births, kept, 'a step on keeps it');
  } finally { setAirGround(null); }
});

// On the freeware's own map (CLAUDE.md: ARENA2 is fetched - `sh tools/fetch-data.sh`). Off it, skipped.
const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(join(A, 'CLIMATE.PAK'));
test('PRECIP3 THE CEIL IS THE GROUND\'S TOP on the freeware\'s map (AUDIT PRECIP PACK-1): no fragment of the drawn ground - the landforms\' ranges with their hills - stands over its pixel\'s top, so no ground is white for standing over its line (mutants: the top a byte\'s; the hills unread)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const rd = (f) => new Uint8Array(readFileSync(join(A, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const wf = new WoodsFile(); wf.load(rd('WOODS.WLD'));
  const { lawAirGround } = await import('../../../src/systems/weather/airGround.js');
  const { landformClimates, createLandforms } = await import('../../../src/world/landforms.js');
  const { sampleKernel, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } = await import('../../../src/world/terrain/terrainSampler.js');
  const { SEA_LEVEL_M } = await import('../../../src/systems/weather/airTemperature.js');
  const table = landformClimates((x, y) => maps.getClimateIndex(x, y));
  const g = lawAirGround({ woods: wf, maps, landforms: true, climates: () => table });
  const lf = createLandforms({ woods: wf, climates: table });
  let worstOver = -Infinity, checked = 0;
  for (let k = 0; k < 80; k++) {
    const px = 30 + ((k * 7919) % 940), py = 20 + ((k * 104729) % 460);
    const f = sampleKernel(wf, px, py, 129, true, lf), top = g.topAt(px, py);
    for (let j = 0; j <= 128; j += 4) for (let i = 0; i <= 128; i += 4) { worstOver = Math.max(worstOver, f(i, j) * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE - SEA_LEVEL_M - top); checked++; }
  }
  assert.ok(worstOver <= 0, `${checked} samples, the most over the top ${worstOver.toFixed(2)} m`);
  assert.ok(RAIN_ALL_C > 0);
});
