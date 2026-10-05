// LW-DRY (field, 2026-10-05, Mac: "NPCs will get stuck over bodies of water"; bible/06-Systems/Living-World.md, the
// LW-DRY record): A PARTY STOPS ON DRY GROUND. A way is the planner's straight legs between its pixels' centres and the
// planner's water a whole pixel's, so by a coast a leg runs over the sea's edge - and nothing asked the ground where a
// party stopped: night camped it in the water, trouble fought it there and its fallen lay there. The ground is the
// height map's own (world/dryGround.js over the sampler's kernel and the tile job's water compare); the roads are the
// synthetic map's (test/lwRoads.mjs) with a wet band across it, read here by its own test, never through the code's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDryGround } from '../src/world/dryGround.js';
import { generateSamples, HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { sampleHeight, isWaterHeight } from '../src/world/terrainTiles.js';
import { livingMap, partiesOver } from './lwRoads.mjs';
import { partyAt, wayAt, wayOf, nativeDry, dryStop, STOP_RING_N, DRY_STEP_N, NATIVE_PIXEL, WALK_FROM_H, WALK_TO_H } from '../src/systems/livingWorld/trips.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { CAMP_RING_N, FIGHT_RING_N, FOE_RING_N } from '../src/scenes/livingRoads.js';
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

test('LW-DRY the frame and the sounding: a native point read as the ways are drawn (x east, z north from the map\'s southern edge, the pixel\'s row 499 less), a pixel\'s centre at its middle; a stop sounded on along its way a DRY_STEP_N at a time to the first place its middle and its ring stand dry, kept where they already do, `s` itself with nothing dry in reach or no ground to read; the ring past every ring the roads stand; a party setting out this morning walks a wet stretch by day (mutants: the row unflipped; north read south; the ring unread; a camp behind a morning\'s setting out)', () => {
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
  assert.equal(dryStop(ford, 0.35 * len, 1, 0, 0.38 * len), 0.35 * len, 'nothing dry in reach: where it was');
  assert.equal(dryStop(wayOf(plan), 0.35 * len, 1, 0, len), 0.35 * len, 'no ground to read: where it was');
  // the ring: a band too narrow to hold a stop's middle still wets its ring
  const narrow = wayOf(plan, (nx) => !(nx > lo && nx < lo + STOP_RING_N / 2));
  const s = dryStop(narrow, (lo - x0) - STOP_RING_N / 2, 1, 0, len);
  assert.ok(wayAt(narrow, s).x >= lo + STOP_RING_N / 2 + STOP_RING_N - 1e-6, 'a stop beside the water stands its ring clear of it');
  // a party that sets out this morning from the ford's middle walks it by day - no camp behind it to wait at
  const day = 100 * DAY_MIN, pace = 300;
  const trip = { id: 'ford', way: ford, pace, trim0: 0.35 * len, trim1: 0, outT0: day + 8 * 60, outT1: day + 8 * 60 + 600, backT0: day + 2 * DAY_MIN, backT1: day + 3 * DAY_MIN, party: [] };
  const at = partyAt(trip, trip.outT0 + 10);
  assert.equal(at.camp, false, 'walking');
  assert.ok(Math.abs(at.x - (x0 + 0.35 * len + 10 * pace)) < 1e-6, 'from where it set out, at its pace');
});

/** The synthetic map with a wet band across it (a third of a pixel, between the towns at x 105 and 110), and its own
 *  test of the ground: the stop's middle and its ring. */
function wetMap({ dry = true } = {}) {
  const map = livingMap({ dives: true });
  const X0 = 107.3 * NATIVE_PIXEL, X1 = 107.6 * NATIVE_PIXEL;
  const wet = (nx) => nx > X0 && nx < X1;
  if (dry) map.world.dryAt = (nx) => !wet(nx);
  const standsDry = (x) => !wet(x) && [...Array(8).keys()].every((i) => !wet(x + Math.sin((i * Math.PI) / 4) * STOP_RING_N));
  const crosses = (trip) => !trip.sea && trip.way?.pts?.length && Math.min(...trip.way.pts.map((p) => p[0])) < X0 && Math.max(...trip.way.pts.map((p) => p[0])) > X1;
  return { map, wet, standsDry, crosses };
}
const hourOf = (t) => (((t % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60;

test('LW-DRY the roads: on the synthetic map a wet band across the ways - every party at every minute of every trip over twelve days: camped, halted or waiting only where it stands dry, ring and all; never a jump (no minute\'s step past the catch-up\'s pace); night on the band walks them on to dry ground, and first light waits there till the day\'s walk comes up; the ways read the world\'s ground; without it the same parties camp in the water (mutants: the ground unread, on a trip and on a dive; the night\'s camp unsounded; the walk on a jump; the morning\'s wait a jump back; the trouble met in the water; the trouble met before it is walked up to)', () => {
  const { map, wet, standsDry, crosses } = wetMap();
  const trips = partiesOver(map, 100, 112);
  let crossing = 0, camped = 0, halted = 0, walkedOn = 0, waited = 0;
  for (const trip of trips) {
    if (!trip.sea && trip.way?.pts?.length) assert.equal(trip.way.dry, map.world.dryAt, `${trip.id}: its way reads the world's ground`);
    if (!crosses(trip)) continue;
    crossing++;
    let prev = null;
    for (let t = trip.outT0; t < trip.backT1; t++) {
      const at = partyAt(trip, t);
      if (at.phase !== 'out' && at.phase !== 'back') { prev = null; continue; }
      if (at.camp || at.halt) {
        assert.ok(standsDry(at.x), `${trip.id} at ${t} (${hourOf(t).toFixed(2)} h): ${at.halt ? 'halted' : 'camped'} on dry ground`);
        if (at.camp) camped++;
        if (at.halt) halted++;
      }
      const h = hourOf(t);
      if (!at.camp && !at.halt && (h >= WALK_TO_H || h < WALK_FROM_H) && t > trip.outT0) walkedOn++;
      if (at.camp && !at.halt && h >= WALK_FROM_H && h < WALK_TO_H) waited++;
      if (prev && prev.phase === at.phase) {
        const step = Math.hypot(at.x - prev.x, at.z - prev.z);
        assert.ok(step <= trip.pace * 1.5 + 1e-6, `${trip.id} at ${t}: a minute's step of ${(step / trip.pace).toFixed(2)} paces - a jump`);
      }
      prev = at;
    }
    if (trip.halt) {
      // the trouble met where the party's walk brings it: a minute before, a step from it
      const before = partyAt(trip, trip.halt.t0 - 1);
      const there = wayAt(trip.way, trip.halt.s);
      if (before.phase === trip.halt.leg) assert.ok(Math.hypot(before.x - there.x, before.z - there.z) <= trip.pace * 1.5 + 1e-6, `${trip.id}: walked up to its trouble`);
    }
  }
  assert.ok(crossing > 50 && camped > 10000 && halted > 100, `the band crossed (${crossing} trips, ${camped} minutes camped, ${halted} halted)`);
  assert.ok(walkedOn > 0 && waited > 0, `night on the band walked on (${walkedOn} minutes) and the morning waited (${waited})`);
  // the same parties with no ground to read: camped and halted in the water - else this pins nothing
  const bare = wetMap({ dry: false });
  let inWater = 0, haltWet = 0;
  for (const trip of partiesOver(bare.map, 100, 112)) {
    if (!bare.crosses(trip)) continue;
    for (let t = trip.outT0; t < trip.backT1; t += 5) {
      const at = partyAt(trip, t);
      if ((at.phase === 'out' || at.phase === 'back') && (at.camp || at.halt) && wet(at.x)) { inWater++; if (at.halt) haltWet++; }
    }
  }
  assert.ok(inWater > 100 && haltWet > 0, `unread, the band camped (${inWater}) and halted (${haltWet}) parties`);
});

test('LW-DRY the fallen: a trouble that takes lives on the band - its fight, its halt and its fallen on dry ground, the place every reader of the trip reads (mutants: the trouble met in the water)', () => {
  const { map, wet, standsDry, crosses } = wetMap();
  let met = 0, moved = 0;
  const fatal = { ...map.trouble, dies: () => true, diced: () => true };
  for (const trip of partiesOver(map, 100, 106)) {
    if (!crosses(trip) || trip.dive) continue;
    const enc = troubleOf(trip, fatal);
    if (!enc || enc.camp == null) continue;
    met++;
    assert.ok(standsDry(enc.x), `${trip.id}: met on dry ground`);
    const p = wayAt(trip.way, enc.s);
    assert.deepEqual([enc.x, enc.z], [p.x, p.z], 'its place the way\'s at its stretch');
    const struck = troubledTrip(trip, enc);
    for (const f of struck.fallen ?? []) if (!f.inside && !f.atSea) assert.ok(standsDry(wayAt(trip.way, f.s).x), `${f.res.id}: lies on dry ground`);
    const was = troubleOf({ ...trip, way: { ...trip.way, dry: undefined } }, fatal);
    if (was && wet(was.x)) moved++;
  }
  assert.ok(met > 20 && moved > 0, `troubles met (${met}), ${moved} of them in the water unread - else this pins nothing`);
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
