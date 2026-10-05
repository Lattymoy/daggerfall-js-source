// LW5 (2026-10-05, bible/06-Systems/Living-World.md, Mac: NPCs "link with the ship AI at ports"): THE BAY'S SAILORS -
// a port's sailors the crews of the packets calling there (naval/seaLanes.js), each where her clock has her: aboard
// under way, ashore at home, ashore at the far port as her visitors; the town's dock off its harbour; the visiting
// crews' days; and the host's seams - on synthetic lanes and the synthetic town (test/lwTown.mjs). No game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { portPackets, berthOf, sailorAt, crewsAshore } from '../src/systems/livingWorld/portCrews.js';
import { packetAt, packetsAt, LANE_DWELL_S } from '../src/systems/naval/seaLanes.js';
import { harbourDock, townPlaces, HARBOUR_RING } from '../src/systems/livingWorld/places.js';
import { LivingTown, CREW_REPLAN_MIN } from '../src/systems/livingWorld/livingTown.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { NAV_CELL } from '../src/world/cityNavigation.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const port = (id) => ({ id, name: `P${id}`, px: id, py: 0, region: 1 });
const lanes = [
  { key: '10-20', a: port(10), b: port(20) },
  { key: '10-30', a: port(10), b: port(30) },
  { key: '20-30', a: port(20), b: port(30) },
];
const counts = { '10-20': 2, '10-30': 1, '20-30': 3 };
const countOf = (lane) => counts[lane.key] ?? 0;
const sailors = (n, town = 10) => Array.from({ length: n }, (_, i) => ({ id: `L${town}.t${i + 4}`, slot: i + 4, job: 'sailor', town }));

test('LW5 a port\'s packets and its sailors: every packet of every lane with the port at either end, lane by lane (their keys in order), packet by packet; its sailors in slot order dealt over them, round again; a port no packet calls at keeps its sailors at home (mutants: the lanes, the order, the deal)', () => {
  const at10 = portPackets(lanes, 10, countOf);
  assert.deepEqual(at10.map((b) => `${b.lane.key}#${b.k}/${b.count}`), ['10-20#0/2', '10-20#1/2', '10-30#0/1'], 'the lanes touching it, in key order, each packet');
  assert.deepEqual(portPackets(lanes, 30, countOf).map((b) => `${b.lane.key}#${b.k}`), ['10-30#0', '20-30#0', '20-30#1', '20-30#2'], 'either end');
  assert.deepEqual(portPackets([...lanes].reverse(), 10, countOf).map((b) => `${b.lane.key}#${b.k}`), at10.map((b) => `${b.lane.key}#${b.k}`), 'whatever order the lanes come in');
  assert.deepEqual(portPackets(lanes, 99, countOf), [], 'a port no lane reaches');
  assert.deepEqual(portPackets([{ key: '10-40', a: port(10), b: port(40) }], 10, countOf), [], 'a lane with no way on the water, no packets');
  const crew = sailors(5);
  const dealt = crew.map((s) => berthOf(s, [...crew].reverse(), at10));
  assert.deepEqual(dealt.map((b) => `${b.lane.key}#${b.k}`), ['10-20#0', '10-20#1', '10-30#0', '10-20#0', '10-20#1'], 'slot order, round again - whatever order handed in');
  assert.equal(berthOf(crew[0], crew, []), null, 'no packet calls: no berth');
  assert.deepEqual(sailorAt(null, 10, () => ({ phase: 'sail' })), { at: 'home' }, 'and so at home');
});

test('LW5 where a sailor is: where their packet is, on HER clock - under way, at SEA; lying at their own port, at HOME; lying at the far port, ABROAD there until her dwell is done - with the Bay\'s own packets, out and back on the shared clock (mutants: the sea, the home, the abroad, the dwell\'s end)', () => {
  const b = { lane: lanes[0], k: 0, count: 1 };
  assert.deepEqual(sailorAt(b, 10, () => ({ phase: 'sail', port: null })), { at: 'sea' });
  assert.deepEqual(sailorAt(b, 10, () => ({ phase: 'dwell', port: { id: 10 }, until: 9 })), { at: 'home' });
  assert.deepEqual(sailorAt(b, 10, () => ({ phase: 'dwell', port: { id: 20 }, until: 777 })), { at: 'abroad', port: 20, until: 777 });
  assert.deepEqual(sailorAt(b, 10, () => null), { at: 'home' }, 'no packet read: at home');
  // the Bay's own packet on a hand-laid way: out a to b, her dwell at b, home, her dwell at a
  const lane = { key: '10-20', a: port(10), b: port(20) };
  const way = { pts: [{ x: 0, z: 0 }, { x: 40 * 3000, z: 0 }], len: 3000 };
  const count = packetsAt(lane, way, 0).length;
  const berth = { lane, k: 0, count };
  const read = (ms) => sailorAt(berth, 10, (bb) => packetAt(bb.lane, way, ms, bb.k, bb.count));
  const seen = { sea: 0, home: 0, abroad: 0 };
  let lastAbroad = null;
  for (let s = 0; s < 6 * 3600; s += 30) {
    const ms = s * 1000;
    const p = packetAt(lane, way, ms, 0, count);
    const where = read(ms);
    seen[where.at]++;
    if (p.phase === 'sail') assert.equal(where.at, 'sea', `${s}s: under way, aboard`);
    else if (p.port.id === 10) assert.equal(where.at, 'home', `${s}s: lying at home, ashore at home`);
    else { assert.equal(where.at, 'abroad'); assert.equal(where.port, 20); assert.equal(where.until, p.until, 'until her dwell is done'); lastAbroad = where; }
  }
  assert.ok(seen.sea && seen.home && seen.abroad, `each in its turn (${JSON.stringify(seen)})`);
  assert.ok(lastAbroad.until > 0);
});

test('LW5 the crews ashore at a port: every packet calling there that lies there now, and of her crew the far port\'s hands - none while she sails, none of the port\'s own (mutants: the dwell, the far port, the crew\'s deal)', () => {
  const crews = { 10: sailors(3, 10), 20: sailors(4, 20), 30: sailors(2, 30) };
  const lying = (berth) => (berth.lane.key === '10-20' && berth.k === 1 ? { phase: 'dwell', port: { id: 20 }, until: 4321 } : { phase: 'sail', port: null });
  const at20 = crewsAshore(20, lanes, countOf, lying, (id) => crews[id] ?? []);
  const theirs = portPackets(lanes, 10, countOf);
  const expected = crews[10].filter((s) => { const b = berthOf(s, crews[10], theirs); return b.lane.key === '10-20' && b.k === 1; }).map((s) => s.id);
  assert.ok(expected.length > 0, 'some hand of port 10 sails her');
  assert.deepEqual(at20.map((c) => c.res.id), expected, 'her hands from the far port, ashore here');
  assert.ok(at20.every((c) => c.until === 4321), 'until she sails');
  assert.deepEqual(crewsAshore(10, lanes, countOf, lying, (id) => crews[id] ?? []), [], 'none at a port she lies not at');
  assert.deepEqual(crewsAshore(20, lanes, countOf, () => ({ phase: 'sail' }), (id) => crews[id] ?? []), [], 'none while every packet sails');
});

test('LW5 the town\'s dock: a Ship building\'s, else the street cell nearest its harbour\'s berth (within HARBOUR_RING), facing it - found once the harbour is sounded, its sailors planned again to work it (mutants: the nearest, the facing, the replan)', () => {
  assert.equal(HARBOUR_RING, 120);
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  assert.equal(places.dock.length, 0, 'the synthetic town has no Ship building');
  const off = { x: -30, z: (nav.height * NAV_CELL) / 2 };   // thirty metres off its west edge
  const d = harbourDock(nav, places, off.x, off.z);
  assert.ok(d && d.kind === 'dock');
  assert.equal(places.net[d.cell[1] * nav.width + d.cell[0]], places.netId, 'on the street');
  for (let gy = 0; gy < nav.height; gy++) for (let gx = 0; gx < nav.width; gx++) {
    if (places.net[gy * nav.width + gx] !== places.netId) continue;
    assert.ok(Math.hypot(gx * NAV_CELL + NAV_CELL / 2 - off.x, gy * NAV_CELL + NAV_CELL / 2 - off.z) >= Math.hypot(d.x - off.x, d.z - off.z) - 1e-9, 'the nearest street cell');
  }
  assert.ok(Math.abs(d.yaw - Math.atan2(off.x - d.x, off.z - d.z)) < 1e-9, 'facing the water');
  assert.equal(harbourDock(nav, places, -10000, -10000), null, 'none past the ring');
  let harbour = null;
  const TOWN = { mapId: 777, blocks: 9, region: 17, people: 3, port: true };
  const town = new LivingTown(nav, { town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => 50 * DAY_MIN + 600, rate: () => 0.2, mpm: CALENDAR_MPM, harbour: () => harbour });
  assert.equal(town.dockSpot(), null, 'no harbour sounded: no dock');
  const sailor = town.residents.find((r) => r.job === 'sailor');
  assert.ok(sailor, 'a port keeps sailors');
  const before = town.planOf(sailor, 50);
  assert.ok(!before.some((e) => e.kind === 'dock'), 'no dock to work');
  harbour = off;
  const dock = town.dockSpot();
  assert.ok(dock && town.places.dock.includes(dock), 'the dock off the harbour');
  assert.ok(town.planOf(sailor, 50).some((e) => e.kind === 'dock'), 'its sailors planned again to work it');
});

test('LW5 the town reads the ships: a sailor at sea or ashore abroad is in no street of their town; a hand of a packet lying here from elsewhere is in off the dock at her making fast, lodged at a tavern, back aboard by her sailing - planned again only when her arrival moves past CREW_REPLAN_MIN (mutants: the sea\'s sailor seen, the crew unread, the dock, the replan)', () => {
  assert.equal(CREW_REPLAN_MIN, 5);
  const { nav, buildings, doors } = synthTown();
  const TOWN = { mapId: 777, blocks: 9, region: 17, people: 3, port: true };
  const clock = { t: 50 * DAY_MIN + 600 };
  let where = 'sea';
  let crews = [];
  const town = new LivingTown(nav, { town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => 0.2, mpm: CALENDAR_MPM, harbour: () => ({ x: -30, z: (nav.height * NAV_CELL) / 2 }),
    ashore: (r) => (r.job === 'sailor' && r.town === TOWN.mapId ? where : null), crews: () => crews });
  const dock = town.dockSpot();
  const seenIds = (fromMin, toMin, at) => {
    const seen = new Set();
    for (let m = fromMin; m < toMin; m += 1) { clock.t = m; for (let i = 0; i < 4; i++) { town.update(0.25, at, 0, at, true); } for (const r of town.pool) if (r.active && r.res) seen.add(r.res.id); }
    return seen;
  };
  const at = [dock.x, 0, dock.z];
  const sailorIds = town.residents.filter((r) => r.job === 'sailor').map((r) => r.id);
  const D = 50 * DAY_MIN;
  const atSea = seenIds(D + 7 * 60, D + 11 * 60, at);
  assert.ok(!sailorIds.some((id) => atSea.has(id)), 'aboard and under way: in no street');
  where = 'home';
  const ashore = seenIds(D + 7 * 60, D + 11 * 60, at);
  assert.ok(sailorIds.some((id) => ashore.has(id)), 'ashore at home: at their dock work');
  where = 'abroad';
  assert.ok(!sailorIds.some((id) => seenIds(D + 7 * 60, D + 9 * 60, at).has(id)), 'ashore at the far port: not here');
  // a far port's hand, ashore here an hour from now for two hours
  const far = travellerRoster({ mapId: 888, blocks: 9, region: 17, people: 3, port: true }).find((r) => r.job === 'sailor');
  const inT = D + 12 * 60, outT = inT + 120;
  crews = [{ res: far, inT, outT }];
  town._crewsNow();   // the census reads the crews lying here
  const plan = town.planOf(far, 50);
  const firstIn = plan.find((e) => e.t1 > inT && e.kind !== 'away');
  assert.ok(firstIn && firstIn.t0 >= inT - 1, 'in at her making fast');
  const walkIn = plan.find((e) => e.kind === 'walk' && e.t0 >= inT - 1);
  assert.ok(walkIn && walkIn.from.key === dock.key, 'off the dock');
  const out = plan.find((e) => e.kind === 'away' && e.t0 >= outT - 1);
  assert.ok(out, 'back aboard by her sailing');
  const back = plan.filter((e) => e.kind === 'walk' && e.t1 <= outT + 1).pop();
  assert.equal(back?.to.key, dock.key, 'the walk back ends at the dock');
  const onStreet = seenIds(inT + 5, outT - 5, at);
  assert.ok(onStreet.has(far.id), 'and seen in the street while she lies here');
  assert.ok(!seenIds(outT + 30, outT + 60, at).has(far.id), 'and gone once she sails');
  crews = [{ res: far, inT, outT }];
  town._crewsNow();
  assert.equal(town.planOf(far, 50), plan, 'the same day for the same stay');
  crews = [{ res: far, inT: inT + 2, outT }];
  town._crewsNow();
  assert.equal(town.planOf(far, 50), plan, 'a hair of drift: the same day');
  crews = [{ res: far, inT: inT + 30, outT: outT + 30 }];
  town._crewsNow();
  assert.notEqual(town.planOf(far, 50), plan, 'her arrival moved: planned again');
  // the host
  const w = rd('src/scenes/world.js');
  assert.match(w, /const livingSailing = \(\) => !!naval\?\.enabled && !!mapDict;/);
  assert.match(w, /if \(res\.job !== 'sailor' \|\| res\.town !== town\?\.mapId \|\| !town\?\.port \|\| !livingSailing\(\)\) return null;/, 'its own sailors alone: a visiting crew is the crews\' own');
  assert.match(w, /return sailorAt\(berthOf\(res, book\.sailors, book\.packets\), portId, livingPacketAt\)\.at;/);
  assert.match(w, /const livingPacketAt = \(b\) => \{ const way = livingLaneWay\(b\.lane\); return way \? packetAt\(b\.lane, way, raidNowMs\(\), b\.k, b\.count\) : null; \};/);
  assert.match(w, /return res \? \[\{ res: res\.id === c\.res\.id \? c\.res : res, berth: c\.berth, inT: t - Math\.max\(0, nowS - \(c\.until - LANE_DWELL_S\)\) \* rate, outT: t \+ Math\.max\(0, c\.until - nowS\) \* rate \}\] : \[\];/);
  assert.match(w, /ashore: \(res\) => livingAshore\(livingTown, res\), crews: \(\) => livingCrews\(livingTown\),/);
  assert.match(w, /const b = harbourBook\.get\(`port:\$\{maskMapId\(livingTown\.mapId\)\}`\)\?\.harbour\?\.berths\?\.\[0\];/);
  assert.match(w, /return \{ x: b\.pos\[0\] - locOrigin\[0\] - tr\[0\], z: b\.pos\[1\] - locOrigin\[2\] - tr\[2\] \};/);
  assert.match(w, /_livingTownByPort\.set\(maskMapId\(t\.mapId\), t\)/);
  assert.equal(LANE_DWELL_S, 600);
});
