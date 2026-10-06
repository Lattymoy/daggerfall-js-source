// LW-DRY (field, 2026-10-05, Mac: "NPCs will get stuck over bodies of water"; bible/06-Systems/Living-World.md, the
// LW-DRY record): A PARTY STOPS ON DRY GROUND. A way is the planner's straight legs between its pixels' centres and the
// planner's water a whole pixel's, so by a coast a leg runs over the sea's edge - and nothing asked the ground where a
// party stopped: night camped it in the water, trouble fought it there and its fallen lay there. The ground is the
// height map's own (world/dryGround.js over the sampler's kernel and the tile job's water compare); the roads are the
// synthetic map's (test/lwRoads.mjs) with wet ground across it, read here by its own test, never through the code's.
// AUDIT LW-DRY: a party's place is one place a minute, ever on along its leg - night walks it on to dry ground, into
// the morning if it must, and the morning waits there; a trouble meets it where it is; no dry ground before the leg's
// end, its end (the town's own ground); a halted party stands in its ring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDryGround } from '../src/world/dryGround.js';
import { generateSamples, HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { sampleHeight, isWaterHeight } from '../src/world/terrainTiles.js';
import { livingMap, partiesOver } from './lwRoads.mjs';
import { partyAt, wayAt, wayOf, nativeDry, dryStop, whenWalked, STOP_RING_N, DRY_STEP_N, NATIVE_PIXEL, NATIVE_PER_M, CALENDAR_MPM, WALK_FROM_H, WALK_TO_H, HALT_CATCH_UP } from '../src/systems/livingWorld/trips.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { CAMP_RING_N, FIGHT_RING_N, FOE_RING_N, partyPlaces } from '../src/scenes/livingRoads.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

/** A WoodsFile's three-method surface over a byte-per-pixel function (test/spawnshore.test.js's), the large map flat. */
const woodsOf = (byteAt, large = 0) => ({
  getHeightMapValue: byteAt,
  getHeightMapValuesRange1Dim(x0, y0, dim) {
    const dst = new Uint8Array(dim * dim);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) dst[x + y * dim] = byteAt(x0 + x, y0 + y);
    return dst;
  },
  getLargeHeightMapValuesRange: (x, y, dim) => new Uint8Array(dim * 3 * dim * 3).fill(large),
});

test('LW-DRY the ground: a point is dry when the four corners of its terrain cell are - each the pixel\'s own sample (generateSamples, x east and y north) above the tile job\'s water (sampleHeight, isWaterHeight); a coast\'s pixel wet on its sea side and dry inland, whichever side the sea lies (mutants: a corner unread; the axes crossed)', () => {
  const span = HEIGHTMAP_DIMENSION - 1;
  // the sea to the west of pixel 101 (map x), then to its south (map y runs south): a low shore (6 x 8 = 48 m against
  // the sea's 27.2) puts each coast mid-pixel - a pixel's west edge is its western neighbour's byte, its south edge its
  // own (terrainSampler.js: the base map's rows read inverted)
  for (const [name, byteAt, side] of [
    ['west', (x) => (x >= 101 ? 6 : 0), (fx) => fx],
    ['south', (x, y) => (y <= 100 ? 6 : 0), (fx, fz) => fz],
  ]) {
    const woods = woodsOf(byteAt, 0);
    const dry = createDryGround(woods);
    let seen = 0, wet = 0, dryN = 0;
    for (const px of [100, 101, 102]) {
      const samples = generateSamples(woods, px, 101);
      const waterAt = (x, y) => isWaterHeight(sampleHeight(samples[x * HEIGHTMAP_DIMENSION + y]));
      for (let i = 0; i < 400; i++) {
        const fx = ((i * 37) % 400) / 400 + 0.0011, fz = ((i * 91) % 400) / 400 + 0.0007;
        const x0 = Math.min(span - 1, Math.floor(fx * span)), y0 = Math.min(span - 1, Math.floor(fz * span));
        const truth = !waterAt(x0, y0) && !waterAt(x0 + 1, y0) && !waterAt(x0, y0 + 1) && !waterAt(x0 + 1, y0 + 1);
        assert.equal(dry(px, 101, fx, fz), truth, `${name} coast, pixel ${px} at (${fx.toFixed(3)}, ${fz.toFixed(3)})`);
        seen++;
        if (truth) dryN++; else wet++;
        if (px === 101 && side(fx, fz) < 0.3) assert.equal(truth, false, `${name}: the sea's side of the coast's pixel is wet`);
        if (px === 101 && side(fx, fz) > 0.7) assert.equal(truth, true, `${name}: its land side dry`);
      }
    }
    assert.ok(seen === 1200 && wet > 300 && dryN > 300, `${name}: both kinds of ground read (${wet} wet, ${dryN} dry)`);
  }
});

test('LW-DRY the frame and the sounding: a native point read as the ways are drawn (x east, z north from the map\'s southern edge, the pixel\'s row 499 less), a pixel\'s centre at its middle; a stop sounded on along its way two metres at a time to the first place its middle and its ring of five stand dry - a dry place too narrow for an eight-metre step found - kept where they already do; none before the leg\'s end, its end (the town\'s own ground); no ground to read, where it was; the ring past every ring the roads stand; a party setting out this morning walks a wet stretch by day (mutants: the row unflipped; north read south; the ring unread; the step coarse; the water kept when nothing dry lies ahead)', () => {
  assert.equal(DRY_STEP_N, 80, 'two metres');
  assert.equal(STOP_RING_N, 200, 'five metres');
  assert.equal(NATIVE_PER_M, 40);
  const asked = [];
  const read = nativeDry((px, py, fx, fz) => { asked.push([px, py, fx, fz]); return true; });
  read(100.25 * NATIVE_PIXEL, (499 - 37 + 0.75) * NATIVE_PIXEL);
  assert.deepEqual(asked[0], [100, 37, 0.25, 0.75]);
  const way = wayOf({ pixels: [{ x: 120, y: 60 }, { x: 121, y: 60 }] });
  read(way.pts[0][0], way.pts[0][1]);
  assert.deepEqual(asked[1], [120, 60, 0.5, 0.5], 'a way\'s point is its pixel\'s centre');
  assert.ok(STOP_RING_N >= FOE_RING_N && STOP_RING_N >= CAMP_RING_N && STOP_RING_N >= FIGHT_RING_N, 'the ring holds every ring the roads stand');
  // a way east along a row; wet from 0.3 to 0.4 of its length (a ford), measured by the band's own edges
  const plan = { pixels: [{ x: 100, y: 60 }, { x: 101, y: 60 }, { x: 102, y: 60 }] };
  const x0 = wayOf(plan).pts[0][0], len = wayOf(plan).len;
  const lo = x0 + 0.3 * len, hi = x0 + 0.4 * len;
  const ford = wayOf(plan, (nx) => !(nx > lo && nx < hi));
  assert.equal(dryStop(ford, 0.1 * len, 1, 0, len), 0.1 * len, 'dry already: kept');
  const on = dryStop(ford, 0.35 * len, 1, 0, len);
  assert.ok(on > 0.4 * len + STOP_RING_N - 1e-6 && on <= 0.4 * len + STOP_RING_N + DRY_STEP_N, `on past the ford by the ring (${((on - 0.4 * len) / 40).toFixed(1)} m)`);
  const back = dryStop(ford, 0.35 * len, -1, 0, len);
  assert.ok(back < 0.3 * len - STOP_RING_N + 1e-6 && back >= 0.3 * len - STOP_RING_N - DRY_STEP_N, 'home the other way');
  assert.equal(dryStop(ford, 0.35 * len, 1, 0, 0.38 * len), 0.38 * len, 'nothing dry before the leg\'s end: its end, the town\'s own ground');
  assert.equal(dryStop(ford, 0.35 * len, -1, 0.32 * len, len), 0.32 * len, 'and the other way');
  assert.equal(dryStop(wayOf(plan), 0.35 * len, 1, 0, len), 0.35 * len, 'no ground to read: where it was');
  // the ring: water a ring's width across beside a stop's middle wets its ring (the ground's water comes in tiles of
  // 6.4 m, wider than a gap between the ring's nine readings about the middle)
  const narrow = wayOf(plan, (nx) => !(nx > lo && nx < lo + STOP_RING_N));
  const s = dryStop(narrow, (lo - x0) - STOP_RING_N / 2, 1, 0, len);
  assert.ok(wayAt(narrow, s).x >= lo + 2 * STOP_RING_N - 1e-6, 'a stop beside the water stands its ring clear of it');
  // a dry islet of a stop's ring and four metres in a wide wet band: found, though an eight-metre step steps over it
  const islet = wayOf(plan, (nx) => !(nx > lo && nx < hi && !(nx > lo + 2000 && nx < lo + 2000 + 2 * STOP_RING_N + 160)));
  const found = dryStop(islet, lo - x0 + 400, 1, 0, len);
  assert.ok(found > lo - x0 + 2000 && found < lo - x0 + 2000 + 2 * STOP_RING_N + 160, `the islet (${((found - (lo - x0)) / 40).toFixed(1)} m in)`);
  // a party that sets out this morning from the ford's middle walks it by day - no camp behind it to wait at
  const day = 100 * DAY_MIN, pace = 300;
  const trip = { id: 'ford', way: ford, pace, trim0: 0.35 * len, trim1: 0, outT0: day + 8 * 60, outT1: day + 8 * 60 + 600, backT0: day + 2 * DAY_MIN, backT1: day + 3 * DAY_MIN, party: [] };
  const at = partyAt(trip, trip.outT0 + 10);
  assert.equal(at.camp, false, 'walking');
  assert.ok(Math.abs(at.x - (x0 + 0.35 * len + 10 * pace)) < 1e-6, 'from where it set out, at its pace');
});

/** Wet ground across the synthetic map (its towns every 5 pixels from 100): `band` a third of a pixel between the towns
 *  at x 105 and 110; `wide` 2.6 pixels there, longer than a night's walk at online's pace; `ends` a disc about every
 *  town wider than its trim, a party setting out from and coming to wet ground. With its own test of a stop's ground. */
const WET = {
  band: (x) => x > 107.3 * NATIVE_PIXEL && x < 107.6 * NATIVE_PIXEL,
  wide: (x) => x > 106.2 * NATIVE_PIXEL && x < 108.8 * NATIVE_PIXEL,
  ends: (x, z) => {
    const px = x / NATIVE_PIXEL, py = 499 - z / NATIVE_PIXEL;
    const tx = 100 + 5 * Math.round((px - 100.5) / 5), ty = 100 + 5 * Math.round((py - 100.5) / 5);
    return Math.hypot(px - (tx + 0.5), py - (ty + 0.5)) < 0.75;
  },
};
function wetMap(kind, { dry = true } = {}) {
  const map = livingMap({ dives: true });
  const wet = WET[kind];
  if (dry) map.world.dryAt = (nx, nz) => !wet(nx, nz);
  const standsDry = (x, z) => !wet(x, z) && [...Array(8).keys()].every((i) => !wet(x + Math.sin((i * Math.PI) / 4) * STOP_RING_N, z + Math.cos((i * Math.PI) / 4) * STOP_RING_N));
  const touches = (trip) => {
    if (trip.sea || !trip.way?.pts?.length) return false;
    for (let s = trip.trim0; s <= trip.way.len - trip.trim1; s += 320) { const p = wayAt(trip.way, s); if (wet(p.x, p.z)) return true; }
    return false;
  };
  return { map, wet, standsDry, touches };
}
const hourOf = (t) => (((t % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60;

test('LW-DRY the roads: wet ground across the synthetic map - a band, one wider than a night\'s walk at online\'s pace, and wet ground about every town - every party at every minute of every trip that touches it, dives and turned walks home among them: camped, halted or waiting only where it stands dry, ring and all, or at its leg\'s end; never a jump (no minute\'s step past the catch-up\'s pace); night on wet ground walks it on and the morning waits; the ways read the world\'s ground; without it the same parties camp in the water (mutants: the ground unread, on a trip and on a dive; the night\'s camp unsounded; the walk on cut at dawn; the dusk sounded from the day\'s walk; the walk not held through a halt; the trouble met in the water; the trouble met before it is walked up to)', () => {
  for (const [kind, mpm, days] of [['band', CALENDAR_MPM, 12], ['wide', CALENDAR_MPM / 2, 8], ['ends', CALENDAR_MPM, 6]]) {
    const { map, wet, standsDry, touches } = wetMap(kind);
    const o = { mpm, memo: new Map() };
    const trips = partiesOver(map, 100, 100 + days, o);
    let touching = 0, dives = 0, camped = 0, halted = 0, walkedOn = 0, waited = 0, atEnd = 0;
    for (const trip of trips) {
      if (!trip.sea && trip.way?.pts?.length) assert.equal(trip.way.dry, map.world.dryAt, `${kind} ${trip.id}: its way reads the world's ground`);
      if (!touches(trip)) continue;
      touching++;
      if (trip.dive) dives++;
      const lo = trip.trim0, hi = trip.way.len - trip.trim1;
      let prev = null;
      for (let t = trip.outT0; t < trip.backT1; t++) {
        const at = partyAt(trip, t);
        if (at.phase !== 'out' && at.phase !== 'back') { prev = null; continue; }
        if (at.camp || at.halt) {
          const end = Math.abs(at.s - lo) < 1e-6 || Math.abs(at.s - hi) < 1e-6;
          if (end) atEnd++;
          else assert.ok(standsDry(at.x, at.z), `${kind} ${trip.id} at ${t} (${hourOf(t).toFixed(2)} h): ${at.halt ? 'halted' : 'camped'} on dry ground`);
          if (at.camp) camped++;
          if (at.halt) halted++;
        }
        const h = hourOf(t);
        if (!at.camp && !at.halt && (h >= WALK_TO_H || h < WALK_FROM_H) && prev) walkedOn++;
        if (at.camp && !at.halt && h >= WALK_FROM_H && h < WALK_TO_H) waited++;
        if (prev && prev.phase === at.phase) {
          const step = Math.hypot(at.x - prev.x, at.z - prev.z);
          assert.ok(step <= trip.pace * (1 + HALT_CATCH_UP) + 1e-6, `${kind} ${trip.id} at ${t} (${h.toFixed(2)} h): a minute's step of ${(step / trip.pace).toFixed(2)} paces - a jump`);
        }
        prev = at;
      }
    }
    assert.ok(touching > 50 && camped > 5000 && walkedOn > 0 && waited > 0, `${kind}: the wet ground met (${touching} trips, ${camped} minutes camped, walked on ${walkedOn}, waited ${waited})`);
    if (kind !== 'band') assert.ok(dives > 0 && atEnd > 0, `${kind}: dives among them (${dives}), stops at a leg's end (${atEnd})`);
    // the same parties with no ground to read: camped in the water - else this pins nothing
    const bare = wetMap(kind, { dry: false });
    let inWater = 0;
    for (const trip of partiesOver(bare.map, 100, 100 + days, { mpm, memo: new Map() })) {
      if (!bare.touches(trip)) continue;
      for (let t = trip.outT0; t < trip.backT1; t += 7) { const at = partyAt(trip, t); if ((at.phase === 'out' || at.phase === 'back') && at.camp && wet(at.x, at.z)) inWater++; }
    }
    assert.ok(inWater > 50, `${kind}: unread, parties camped in the water (${inWater})`);
  }
});

/** One way east along a row of pixels 100..112, its trims a block, and a hand-made trip on it. */
const LONG = { pixels: Array.from({ length: 13 }, (_, i) => ({ x: 100 + i, y: 60 })), kinds: Array(12).fill('road') };
const X0 = wayOf(LONG).pts[0][0];
function handTrip(id, job, pace, outT0, dry, cls = null) {
  const way = wayOf(LONG, dry);
  const leader = { id, job, cls, level: 3, town: 1, slot: 0, name: id };
  return { id, kind: job, leader, party: [leader], way, pace, trim0: 4096, trim1: 4096, outT0, outT1: whenWalked(outT0, (way.len - 8192) / pace), backT0: outT0 + 9 * DAY_MIN, backT1: outT0 + 12 * DAY_MIN, k: 1, from: { mapId: 1 }, to: { mapId: 2 } };
}
/** Every minute's step along a trip, in paces: the largest. */
const largestStep = (trip, from, to) => {
  let prev = null, most = 0;
  for (let t = from; t < to; t++) {
    const at = partyAt(trip, t);
    if (at.phase !== 'out' && at.phase !== 'back') { prev = null; continue; }
    if (prev && prev.phase === at.phase) most = Math.max(most, Math.abs(at.s - prev.s) / trip.pace);
    prev = at;
  }
  return most;
};

test('LW-DRY the night\'s turns: a camp\'s trouble met before the walk on reaches the camp waits for it, met at the camp as it is reached; a halt across nightfall holds the walk where it stood; a party setting out before dawn from wet ground walks on to dry ground and on into its day; a wet stretch longer than a night\'s walk walked on into the next day, the next dusk sounded from where the party stands - never a jump, never a step back (mutants: the trouble at eleven on a camp not reached; the walk on cut at dawn; the dusk sounded from the day\'s walk)', () => {
  const day = 100 * DAY_MIN;
  // a camp's trouble: dusk falls a kilometre into a wet stretch 2.6 km long - four and a half hours of walking on
  {
    const pace = 0.85 * CALENDAR_MPM * NATIVE_PER_M, outT0 = day + 7 * 60;
    const dusk = 4096 + pace * 720;
    const a = X0 + dusk - 1000 * 40, b = X0 + dusk + 1600 * 40;
    let found = null;
    for (let k = 0; k < 4000 && !found; k++) {
      const trip = handTrip(`campTrouble:${k}`, 'merchant', pace, outT0, (nx) => !(nx > a && nx < b));
      const enc = troubleOf(trip, { climateAt: () => 230, foesOf: () => [128], foeLevel: () => 3, diced: (r) => r.id === trip.leader.id, dies: () => false });
      if (enc && enc.camp && enc.leg === 'out') found = troubledTrip(trip, enc);
    }
    assert.ok(found, 'the dice put a trouble at the first night\'s camp');
    const camp = partyAt(found, found.halt.t0 - 1);
    assert.ok(found.halt.t0 > day + 23 * 60, `met after eleven, as the camp is reached (${hourOf(found.halt.t0).toFixed(2)} h)`);
    assert.ok(Math.abs(camp.s - found.halt.s) <= found.pace + 1e-6, 'a step from the halt the minute before');
    assert.ok(found.halt.s >= b - X0 + STOP_RING_N - 1e-6, 'the camp past the wet stretch');
    assert.ok(largestStep(found, found.halt.t0 - 600, found.halt.t1 + 600) <= 1 + 1e-6, 'never a jump about it');
  }
  // a halt across nightfall (ten to seven to half past): the walk held at it, so the night is read where the party stood
  {
    const pace = 0.85 * CALENDAR_MPM * NATIVE_PER_M, outT0 = day + 7 * 60;
    const trip = handTrip('haltAtDusk', 'merchant', pace, outT0, () => true);
    const t0 = day + 18 * 60 + 50, s = /** @type {number} */ (partyAt(trip, t0).s);
    const halted = { ...trip, halt: { t0, t1: day + 19 * 60 + 30, fightEnd: t0 + 10, s, leg: /** @type {'out'} */ ('out') } };
    assert.ok(largestStep(halted, t0 - 60, day + 21 * 60) <= 1 + 1e-6, 'never a jump as the halt ends after dark');
    assert.ok(Math.abs(/** @type {number} */ (partyAt(halted, day + 20 * 60).s) - s) < 1e-6, 'the night where it halted');
  }
  // setting out before dawn from wet ground: a 500 m wet stretch from the town's edge
  {
    const pace = 1.05 * CALENDAR_MPM * NATIVE_PER_M, outT0 = day + 6 * 60 + 20;
    const trip = handTrip('dawnStart', 'adventurer', pace, outT0, (nx) => !(nx > X0 && nx < X0 + 4096 + 500 * 40), 3);
    assert.ok(largestStep(trip, outT0, outT0 + 600) <= 1 + 1e-6, 'never a jump at first light');
    const at7 = partyAt(trip, day + 7 * 60 + 10);
    assert.ok(at7.s >= 4096 + 500 * 40 + STOP_RING_N - 1e-6 || !at7.camp, 'past the wet stretch, or walking');
  }
  // a wet stretch longer than a night's walk at online's pace
  {
    const pace = 0.85 * (CALENDAR_MPM / 2) * NATIVE_PER_M, outT0 = day + 7 * 60;
    const dusk = 4096 + pace * 720;
    const trip = handTrip('longWet', 'merchant', pace, outT0, (nx) => !(nx > X0 + dusk - 400 && nx < X0 + dusk + 2400 * 40));
    assert.ok(largestStep(trip, outT0, outT0 + 3 * DAY_MIN) <= 1 + 1e-6, 'never a jump over three days');
    let prevS = -Infinity;
    for (let t = outT0; t < outT0 + 3 * DAY_MIN; t += 5) { const at = partyAt(trip, t); if (at.phase !== 'out') break; assert.ok(at.s >= prevS - 1e-6, 'never a step back'); prevS = at.s; }
    const morning = partyAt(trip, day + DAY_MIN + 8 * 60);
    assert.equal(morning.camp, false, 'still walking on into the morning');
  }
});

test('LW-DRY the fallen and the halted: a trouble that takes lives on wet ground - its fight, its halt and its fallen on dry ground; a halted party, its fight done, stands in its ring about the stop, idle - never in file with the walk\'s stride, walking on the spot past the dry ground (mutants: the trouble met in the water; the halted party in file)', () => {
  const { map, wet, standsDry, touches } = wetMap('band');
  let met = 0, moved = 0;
  const fatal = { ...map.trouble, dies: () => true, diced: () => true };
  for (const trip of partiesOver(map, 100, 106)) {
    if (!touches(trip) || trip.dive) continue;
    const enc = troubleOf(trip, fatal);
    if (!enc || enc.camp == null) continue;
    met++;
    assert.ok(standsDry(enc.x, enc.z), `${trip.id}: met on dry ground`);
    const p = wayAt(trip.way, enc.s);
    assert.deepEqual([enc.x, enc.z], [p.x, p.z], 'its place the way\'s at its stretch');
    const struck = troubledTrip(trip, enc);
    for (const f of struck.fallen ?? []) if (!f.inside && !f.atSea) assert.ok(standsDry(wayAt(trip.way, f.s).x, wayAt(trip.way, f.s).z), `${f.res.id}: lies on dry ground`);
    const was = troubleOf({ ...trip, way: { ...trip.way, dry: undefined } }, fatal);
    if (was && wet(was.x, was.z)) moved++;
  }
  assert.ok(met > 20 && moved > 0, `troubles met (${met}), ${moved} of them in the water unread - else this pins nothing`);
  // a party of six halted by day, its fight done
  const six = Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, job: 'merchant', cls: i < 3 ? 3 : null }));
  const trip = { id: 'halted', party: six, way: wayOf(LONG), kind: 'merchant' };
  const at = { phase: 'out', x: X0 + 50000, z: wayOf(LONG).pts[0][1], yaw: Math.PI / 2, camp: false, halt: true, fight: false, s: 50000 };
  const places = partyPlaces(trip, at);
  assert.equal(places.length, 6);
  for (const m of places) {
    assert.equal(m.moving, false, `${m.res.id}: stands`);
    assert.ok(Math.hypot(m.x - at.x, m.z - at.z) <= STOP_RING_N, `${m.res.id}: within the stop's ring`);
  }
});

test('LW-DRY the host: the streaming host hands its trips the height map\'s own ground (world/dryGround.js, read in the ways\' frame) - the four hosts named in the record (mutants: the host unwired)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /dryAt: \(nx, nz\) => \(_livingDry \?\?= nativeDry\(createDryGround\(woods\)\)\)\(nx, nz\),/);
  const at = w.indexOf('const livingTripWorld = {');
  const end = w.indexOf('};', at);
  assert.ok(at > 0 && w.slice(at, end).includes('dryAt:'), 'in the trips\' world');
  const bible = readFileSync(new URL('../bible/06-Systems/Living-World.md', import.meta.url), 'utf8');
  const rec = bible.slice(bible.indexOf('## LW-DRY'), bible.indexOf('\n## ', bible.indexOf('## LW-DRY') + 4));
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) assert.ok(rec.includes(host), `the record names ${host}`);
});
