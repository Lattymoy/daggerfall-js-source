// AUDIT FULLER-LW A7 (2026-10-29, bible/01-Overview/audits/Audit-Fuller-Living-World.md; the owner: "Increase performance"):
// THE FULLER LIVING WORLD'S COST CUT, ITS ANSWERS KEPT. Pinned: the carried word's towns about worked a traveller at a
// time (townTripsSteps - the same trips, a yield a traveller, none warm); the street's search's answers held; the day's
// incidents the same as before the stays that meet one were found by the clock; the host's carried word works the
// stepped towns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { livingMap } from '../../lwRoads.mjs';
import { synthTown } from '../../lwTown.mjs';
import { townTrips, townTripsSteps, TRIP_CHANCE, ROAD_TRIP_CHANCE } from '../../../src/systems/livingWorld/trips.js';
import { townPathSearch } from '../../../src/systems/livingWorld/townPaths.js';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND, MPM = PERSON_MOVE_SPEED / RATE;
const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
const drain = (gen) => { let n = 0; for (;;) { const r = gen.next(); if (r.done) return { value: r.value, yields: n }; n++; } };

test('AUDIT FULLER-LW A7 the towns about a traveller at a time: townTripsSteps answers what townTrips answers, cold or warm - a yield after each traveller, none once the day is in the book (mutants: the yield, the warm book unread)', () => {
  const map = livingMap({});
  let towns = 0, yields = 0;
  for (const town of map.towns.slice(0, 12)) {
    const noon = 300 * DAY_MIN + 960;
    const whole = townTrips(town, noon, map.world, { mpm: MPM, memo: new Map() });
    const memo = new Map();
    const stepped = drain(townTripsSteps(town, noon, map.world, { mpm: MPM, memo }));
    assert.deepEqual(stepped.value?.map((tr) => tr.id), whole?.map((tr) => tr.id), `${town.mapId}: the same trips`);
    const travellers = map.world.rosterOf(town).filter((r) => (TRIP_CHANCE[r.job] ?? ROAD_TRIP_CHANCE[r.job] ?? 0) > 0).length;
    assert.equal(stepped.yields, travellers, `${town.mapId}: a slice a traveller`);
    assert.equal(drain(townTripsSteps(town, noon, map.world, { mpm: MPM, memo })).yields, 0, 'warm: none');
    towns++; yields += stepped.yields;
  }
  assert.ok(towns === 12 && yields > 12, `${yields} slices over ${towns} towns`);
});

test('AUDIT FULLER-LW A7 the street\'s search, its answers held: sixty walks across the synthetic city, sliced as the book slices them - the paths and the cells opened as they stand, so a faster loop is proven the same loop (an inner-loop rewrite measured no faster, and was not kept)', () => {
  const nav = synthTown({ blocksW: 8, blocksH: 8 }).nav;
  const walk = [];
  for (let y = 0; y < nav.height; y++) for (let x = 0; x < nav.width; x++) if (nav.weightAt(x, y) > 0) walk.push([x, y]);
  let s = 777;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const paths = [];
  let cells = 0;
  for (let i = 0; i < 60; i++) {
    const p = walk[Math.floor(rnd() * walk.length)], q = walk[Math.floor(rnd() * walk.length)];
    const search = townPathSearch(nav, p, q);
    let r;
    do { r = search.step(5000); cells += search.spent; } while (r === undefined);
    paths.push(r ? r.map((c) => c.join(',')).join(';') : 'null');
  }
  assert.deepEqual({ paths: fnv(paths.join('|')), cells }, { paths: '5f993533', cells: 743872 }, 'the answers as they stand');
});

test('AUDIT FULLER-LW A7 the day\'s incidents: two days of the synthetic city of 64 blocks dealt as before the stays that meet one were found by the clock - 250 incidents, to their people and minutes (mutants: the window\'s start, its end)', () => {
  const built = synthTown({ blocksW: 8, blocksH: 8 });
  const lt = new LivingTown(built.nav, { town: { mapId: 24680, blocks: 64, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
    makePerson: () => null, suppressSpawns: () => true, clock: () => 100 * DAY_MIN, rate: () => RATE, mpm: MPM, tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null }) });
  const sig = [];
  for (const day of [200, 201]) {
    const got = lt._stirOf(day, lt.peopleOf(day));
    for (const [k, l] of [...got.by].sort((x, y) => (x[0] < y[0] ? -1 : 1))) for (const c of l) sig.push(`${day}|${k}|${c.kind}|${c.members.map((m) => m.id).join(',')}|${c.t0.toFixed(4)}|${c.end.toFixed(4)}|${c.guard?.id ?? ''}`);
  }
  assert.deepEqual({ n: sig.length, deal: fnv(sig.join('\n')) }, { n: 250, deal: 'd775e76d' });
});

test('AUDIT FULLER-LW A7 the host\'s carried word works the towns about a traveller at a time (scenes/world.js livingVisitsGen)', () => {
  const src = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function* livingVisitsGen('), src.indexOf('const _livingVisitorsKept'));
  assert.match(body, /yield\* townTripsSteps\(near, noon, livingTripWorld, o\)/);
  assert.match(body, /yield\* townTripsSteps\(tr\.from, fromNoon - b \* 1440, livingTripWorld, o\)/);
  assert.doesNotMatch(body, /[^.\w]townTrips\(/, 'no town\'s day whole in one slice');
});
