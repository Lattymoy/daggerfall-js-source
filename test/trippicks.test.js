// TRIP-PICKS (2026-10-12, a profile of a player's live client from launch into the world: the first world frame froze
// 2.7 s and the frames after it 2.8 s more, the Living World planning its roads' day; bible/07-Rendering/Performance-
// Priority.md TRIP-PICKS) - A TRAVELLER'S ROAD CHOICES, THE SAME ANSWER FOR LESS. Every trip of every traveller of every
// town the roads asked filtered its town's towns near, weighed them, walked the weights' keys for the draw and sorted the
// towns by distance again. The choices are kept by the trip world, the town and the job (trips.js roadChoices) and the
// draw reads them (roadOrder). Every answer is the old one: the old law is restated here and the two compared over every
// town of a mixed map, every job and hundreds of draws, the dice left where the old law left them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadOrder, roadChoices, roadBound, TRIP_RANGE_PX, ROAD_RANGE_PX } from '../src/systems/livingWorld/trips.js';
import { pickWeighted } from '../src/systems/livingWorld/seed.js';

/** mulberry32 */
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The law as it stood (trips.js ownTrip before TRIP-PICKS): the ring, the weights, the draw, the nearer towns. */
function roadOrderAsItWas(r, home, job, world) {
  const [rMin, rMax] = TRIP_RANGE_PX[job] ?? ROAD_RANGE_PX[job] ?? [3, 12];
  const near = world.townsNear(home.px ?? 0, home.py ?? 0, rMax)
    .filter((t) => t.mapId !== home.mapId && Math.max(Math.abs((t.px ?? 0) - (home.px ?? 0)), Math.abs((t.py ?? 0) - (home.py ?? 0))) >= rMin)
    .filter((t) => roadBound(job, home, t));
  if (!near.length) return null;
  const weights = {};
  for (const t of near) {
    const d = Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
    const size = Math.pow(Math.max(1, t.blocks | 0), 0.7);
    let w = job === 'merchant' ? size / (1 + d / 8) : job === 'pilgrim' ? ((world.templeTown?.(t) ? 6 : 0.2) * size) / (1 + d / 12) : 1 / (1 + d / 10);
    if (job === 'adventurer') w = size / (1 + d / 6);
    else if (job === 'patrol' || job === 'noble' || job === 'minstrel') w = size / (1 + d / 8);
    weights[String(t.mapId)] = w;
  }
  const pick = pickWeighted(r, weights);
  const first = near.find((t) => String(t.mapId) === pick);
  if (!first) return null;
  const dist = (t) => Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
  const nearer = near.filter((t) => t !== first && dist(t) < dist(first)).sort((a, b) => dist(b) - dist(a) || a.mapId - b.mapId);
  return [first, ...nearer];
}

/** A mixed map: a grid with gaps and jitter (ties of distance and of none), sizes from a hamlet to a city, three
 *  regions, courts and temples - and its ids (one a town, as the map's) out of the grid's order, so the draw's key order is not the walk's. */
function mixedMap() {
  const r = rng(0x7472);
  const towns = [];
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    if (r() < 0.25) continue;
    const jitter = r() < 0.5 ? 0 : Math.floor(r() * 3) - 1;
    towns.push({ mapId: 3000 + (((j * 16 + i) * 7919) % 4099), px: 200 + i * 2 + jitter, py: 300 + j * 2, blocks: Math.floor(r() * 40), region: (i >> 2) % 3, type: r() < 0.3 ? 0 : 2 });
  }
  let asked = 0;
  const world = {
    townsNear: (px, py, rr) => { asked++; return towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= rr).sort((a, b) => a.mapId - b.mapId); },
    templeTown: (t) => t.blocks >= 16,
  };
  return { towns, world, asked: () => asked, reset: () => { asked = 0; } };
}

const JOBS = [...new Set([...Object.keys(TRIP_RANGE_PX), ...Object.keys(ROAD_RANGE_PX), 'scholar'])];

test('TRIP-PICKS roadOrder is the old law - the pick, then the nearer towns the farther first - for every town of a mixed map, every job and an unlisted one, 12 draws each, and the dice left where the old law left them (mutants: the tie by the higher id, an equal distance taken as nearer, the draw not scaled by the total, the total only the last weight)', () => {
  const { towns, world } = mixedMap();
  const { world: old } = mixedMap();
  let orders = 0, none = 0, longer = 0;
  for (const home of towns) for (const job of JOBS) for (let n = 0; n < 12; n++) {
    const seed = home.mapId * 131 + n * 7 + job.length;
    const a = rng(seed), b = rng(seed);
    const now = roadOrder(a, home, job, world), was = roadOrderAsItWas(b, home, job, old);
    assert.deepEqual(now?.map((t) => t.mapId) ?? null, was?.map((t) => t.mapId) ?? null, `town ${home.mapId} ${job} draw ${n}`);
    assert.equal(a(), b(), `the dice where they were - town ${home.mapId} ${job} draw ${n}`);
    if (!was) none++; else { orders++; if (was.length > 2) longer++; }
  }
  assert.ok(orders > 20000 && none > 5 && longer > 15000, `both answers reached (${orders} orders, ${longer} of three towns or more, ${none} none)`);
});

test('TRIP-PICKS roadChoices are asked of the world once a town and a job and kept by the world - another job and another world ask for themselves (mutants: never kept, kept without the job, kept for the wrong town)', () => {
  const m = mixedMap();
  const homes = [m.towns[3], m.towns[40], m.towns[90]];
  const want = homes.map((h) => roadOrderAsItWas(rng(h.mapId), h, 'merchant', m.world).map((t) => t.mapId));
  m.reset();
  for (let round = 0; round < 3; round++) homes.forEach((h, i) => assert.deepEqual(roadOrder(rng(h.mapId), h, 'merchant', m.world).map((t) => t.mapId), want[i], `home ${h.mapId}`));
  assert.equal(m.asked(), homes.length, 'the world asked once a town');
  const noble = roadChoices(homes[0], 'noble', m.world);
  assert.equal(m.asked(), homes.length + 1, 'another job asks for itself');
  assert.notDeepEqual(noble?.picks.map((p) => p.town.mapId), roadChoices(homes[0], 'merchant', m.world)?.picks.map((p) => p.town.mapId), 'a noble\'s courts are not a merchant\'s towns');
  const other = { ...m.world };
  m.reset();
  assert.deepEqual(roadOrder(rng(homes[0].mapId), homes[0], 'merchant', other).map((t) => t.mapId), want[0]);
  assert.equal(m.asked(), 1, 'another world asks for itself');
});
