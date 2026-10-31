// WW7-11 and WW7-12 (2026-10-26, the owner on the report's two calls: passages past the Bay rare - "Make them longer";
// the sea serpent kept to the Bay's lanes because moving it moves the relay's law - "Fucking do it"; and the coordinator
// at IC-GRAND's merge: the Imperial City's 625 slices are places, "keep your near lists and wake bounded over them";
// bible/03-World/World-Wide.md WW7-11, WW7-12): THE LONG PASSAGES AND THE SERPENT ON THE WORLD'S LANES - a far lane's
// passage taking the cycles it needs (its block, its room, the cycles it spends at sea, the Bay's passages as they were),
// a capital one town to the living world, and the serpent's site rolled over every lane of the world, the hub telling
// every game where the accounts agree it lies. Each pin mutation-checked (tools/mutants/ww7_longer.json).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { synthMap, livingMap, partiesOver } from '../../lwRoads.mjs';
import {
  ownTrip, seaTrip, townTrips, visitorsOf, memoTrip, formCaravans, cycleOf, voyageBlock, voyageRoom, voyageOver, cyclesAbout, seaRolled,
  SEA_VOYAGE_DAYS, SEA_CHANCE, SEA_PACE_X, CALENDAR_MPM, CYCLE_DAYS, STAY_DAYS,
} from '../../../src/systems/livingWorld/trips.js';
import { DAY_MIN, DAY_START_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { createLivingLanes } from '../../../src/scenes/livingWorld/livingLanes.js';
import { createLivingIndex, capitalStreet } from '../../../src/scenes/livingWorld/livingIndex.js';
import { createLivingTrips } from '../../../src/scenes/livingWorld/livingTrips.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { capitalPlaceId, capitalSpan, CAPITALS } from '../../../src/world/tamrielCapitals.js';
import { portIdOf } from '../../../src/world/worldWide/worldPorts.js';
import { CROSS_LANE_PATH_PX, createWorldLanes, worldLaneWater, BEYOND_LANE_MAX_PX } from '../../../src/scenes/naval/worldLanes.js';
import { validSerpentOut, SOCIAL_ROOM, POSE_BOUND } from '../../../src/net/wire.js';
import { serpentAtWord, agreedSerpentSite, SERPENT_SITE_RECORD } from '../../../src/net/serpent/serpentHerald.js';
import { foldGateSite } from '../../../src/net/gate/gateHerald.js';
import { serpentTimes, serpentRing, SERPENT_EVERY_DAYS, SERPENT_SITE_LAW } from '../../../src/net/serpent/serpentLaw.js';
import { createSerpentLink, SERPENT_STATE_EMPTY } from '../../../src/net/serpent/serpentLink.js';
import { worldSerpentSite, siteOfWord, findSerpentSite, sitePixelOfNative } from '../../../src/systems/serpent/serpentSite.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES, CLIMATES } from '../../../src/formats/mapsFile.js';
import { NATIVE_PIXEL } from '../../../src/systems/seaRaiders.js';
import { fakeRoom } from '../../fakeRoom.mjs';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

/** A passage's span in days (seaTrip's): out and back at SEA_PACE_X a walker's pace, the stay, the turn-round. */
const spanOf = (len, stay, mpm = CALENDAR_MPM) => Math.ceil((2 * Math.ceil(len / (Math.max(0.1, mpm) * SEA_PACE_X))) / DAY_MIN) + Math.max(1, stay) + 1;
const SEA_JOBS = Object.keys(SEA_CHANCE);

/** The synthetic sea (test/lwRoads.mjs) with a far port 300 pixels west of the first row's first port, a far lane between
 *  them its only lane (`far`: past the Bay's, or across its edge) - the land past the Bay standing (`longPassages`). */
function farSea({ living = false, len = 300_000, long = true } = {}) {
  const m = living ? livingMap({ sea: true }) : synthMap({ sea: true });
  const row0 = m.towns.find((t) => t.port && t.mapId !== 9000 && t.px === 100);
  const far = { mapId: 9100, px: -200, py: 100, blocks: 24, region: 17, people: 3, type: 0, name: 'FarPort', port: true };
  m.towns.push(far);
  m.byId?.set(far.mapId, far);
  const base = m.world.lanesFrom;
  m.world.lanesFrom = (t) => (t === row0 ? [{ to: far, len, key: 'far', far: true }] : t === far ? [{ to: row0, len, key: 'far', far: true }] : base(t));
  m.world.longPassages = long;
  return { ...m, row0, far };
}

// ─── 1. THE BLOCK, THE PASSAGE AND ITS ROOM (systems/livingWorld/trips.js) ──────────────────────────

test('WW7-11 THE BLOCK OF LONG PASSAGES: SEA_VOYAGE_DAYS is the longest way a lane of the world is let have (a crossing lane\'s, CROSS_LANE_PATH_PX) out and back with the longest stay; a port\'s sea-going traveller\'s block holds the cycles it needs at the clock\'s pace, its first seeded by the place - no land past the Bay, no port, a job that never sails: every cycle its own (mutants: the block\'s days; the land\'s word unread; the port unread; the job\'s share unread; the place\'s seed unread; the block\'s floor)', () => {
  const stayMax = Math.max(...SEA_JOBS.map((j) => STAY_DAYS[j][1]));
  assert.equal(SEA_VOYAGE_DAYS, spanOf(CROSS_LANE_PATH_PX * 819.2, stayMax), 'the longest way, there and back');
  const m = farSea();
  const roster = m.world.rosterOf(m.row0);
  const want = { merchant: 11, adventurer: 11, pilgrim: 4, courier: 15, pedlar: 13 };
  for (const job of SEA_JOBS) {
    const res = roster.find((r) => r.job === job);
    if (!res) continue;
    assert.equal(voyageBlock(res, m.row0, 50, m.world, 1).m, want[job], `${job}: SEA_VOYAGE_DAYS over its ${CYCLE_DAYS[job]} days`);
    assert.equal(voyageBlock(res, m.row0, 50, m.world, 1).m, Math.ceil(SEA_VOYAGE_DAYS / cycleOf(res, 0, 1).len));
    assert.equal(voyageBlock(res, m.row0, 50, m.world, 2).m, Math.ceil((SEA_VOYAGE_DAYS * 2) / cycleOf(res, 0, 2).len), 'at the clock\'s pace');
  }
  const merchant = roster.find((r) => r.job === 'merchant');
  const blocks = new Map();
  for (let k = -30; k < 80; k++) {
    const { k0, m: n } = voyageBlock(merchant, m.row0, k, m.world, 1);
    assert.ok(k0 <= k && k < k0 + n, 'its block holds it');
    if (blocks.has(k0)) assert.equal(blocks.get(k0), n); else blocks.set(k0, n);
  }
  const starts = [...blocks.keys()];
  assert.ok(starts.every((k0, i) => i === 0 || k0 - starts[i - 1] === 11), 'one block after another');
  const ports = m.towns.filter((t) => t.port);
  const phases = new Set(ports.flatMap((t) => m.world.rosterOf(t).filter((r) => r.job === 'merchant').map((r) => voyageBlock(r, t, 60, m.world, 1).k0 % 11)));
  assert.ok(phases.size > 2, `each place its own first cycle (${phases.size})`);
  assert.deepEqual(voyageBlock(merchant, m.row0, 57, { ...m.world, longPassages: false }, 1), { k0: 57, m: 1 }, 'no land past the Bay: its own');
  const inland = m.towns.find((t) => !t.port);
  assert.deepEqual(voyageBlock(m.world.rosterOf(inland).find((r) => r.job === 'merchant'), inland, 57, m.world, 1), { k0: 57, m: 1 }, 'no port: its own');
  const sw = roster.find((r) => !(SEA_CHANCE[r.job] > 0));
  assert.deepEqual(voyageBlock(sw, m.row0, 57, m.world, 1), { k0: 57, m: 1 }, `a ${sw.job} never sails: its own`);
  assert.deepEqual(cyclesAbout(merchant, m.row0, 57, { ...m.world, longPassages: false }, 1), [56, 57], 'every cycle its own: the two it always was');
  // at a block's first cycle, the block before's first beside the two - a passage of the whole block home in its last
  let k = 60;
  while (voyageBlock(merchant, m.row0, k, m.world, 1).k0 !== k || !seaRolled(merchant, k - 11)) k++;
  assert.deepEqual(cyclesAbout(merchant, m.row0, k, m.world, 1), [k - 11, k - 1, k]);
  while (voyageBlock(merchant, m.row0, k, m.world, 1).k0 >= k - 1 || seaRolled(merchant, voyageBlock(merchant, m.row0, k, m.world, 1).k0)) k++;
  assert.deepEqual(cyclesAbout(merchant, m.row0, k, m.world, 1), [k - 1, k], 'its block\'s first rolled no sea: no passage to ask after');
});

test('WW7-11 A FAR LANE\'S PASSAGE takes the whole cycles its span needs, `room` at most - set out inside its own cycle, home inside its last, `sea.cycles` saying how many; a far lane that fits a cycle is the passage it always was, a Bay lane never grows; too long for the room, the next shorter lane or none (mutants: the far word unread; the room unread; the offset past its own cycle; the end a cycle short; the cycles unsaid)', () => {
  const m = farSea();
  const res = m.world.rosterOf(m.row0).find((r) => r.job === 'merchant');
  const { start, len } = cycleOf(res, 7 * 50, 1);
  for (let i = 0; i < 40; i++) {
    const rolls = [0.05, 0.9, (i * 0.37) % 1, ((i * 0.61) % 1) * 0.999];
    let j = 0;
    const rng = () => rolls[j++ % rolls.length];
    const t = seaTrip(res, m.row0, 50, m.world, { start, len, mpm: CALENDAR_MPM, pace: 1, rng, room: 11 });
    assert.ok(t, 'the far lane, its room the block\'s');
    const stay = Math.floor(t.backT0 / DAY_MIN) - Math.floor(t.outT1 / DAY_MIN);   // its days ashore (at the least one)
    const c = Math.ceil(spanOf(300_000, stay) / len);
    assert.equal(t.sea.cycles, c, 'the cycles it needs');
    assert.ok(c >= 3, 'more than one');
    assert.ok(t.outT0 >= start * DAY_MIN && t.outT0 < (start + len) * DAY_MIN, 'out inside its own cycle');
    assert.ok(t.backT1 <= (start + c * len) * DAY_MIN + DAY_START_MIN, 'home inside its last');
    assert.equal(t.k, 50); assert.equal(t.id, `${res.id}:50`);
  }
  const so = { start, len, mpm: CALENDAR_MPM, pace: 1, rng: () => 0.3 };
  const fits = seaTrip(res, m.row0, 50, m.world, { ...so, room: 11 });
  assert.equal(seaTrip(res, m.row0, 50, m.world, { ...so, room: fits.sea.cycles }).backT1, fits.backT1, 'its room enough');
  assert.equal(seaTrip(res, m.row0, 50, m.world, { ...so, room: fits.sea.cycles - 1 }), null, 'a cycle short: none');
  assert.equal(seaTrip(res, m.row0, 50, m.world, so), null, 'one cycle\'s room: none');
  const bay = { ...m.world, lanesFrom: () => [{ to: m.far, len: 300_000, key: 'far' }] };
  assert.equal(seaTrip(res, m.row0, 50, bay, { ...so, room: 11 }), null, 'a Bay lane never grows');
  const near = [{ to: m.far, len: 20_000, key: 'near' }];
  const one = seaTrip(res, m.row0, 50, { ...m.world, lanesFrom: () => near }, so);
  const farOne = seaTrip(res, m.row0, 50, { ...m.world, lanesFrom: () => near.map((l) => ({ ...l, far: true })) }, { ...so, room: 11 });
  assert.deepEqual(farOne, one, 'a far lane that fits a cycle: the passage it always was, to the byte');
  assert.ok(!('cycles' in one.sea));
  const both = [{ to: m.far, len: 300_000, key: 'far', far: true }, { to: m.towns[1], len: 9000, key: 'short', far: true }];
  assert.equal(seaTrip(res, m.row0, 50, { ...m.world, lanesFrom: () => both }, { ...so, rng: () => 0 }).sea.key, 'short', 'the far one too long for its room: the shorter');
});

test('WW7-11 THE ROOM: one, but at a block\'s first cycle the block\'s - short of any cycle the lives take the traveller or one who walks with them on (its company\'s places, a merchant\'s contract sellswords), and one when the first cycle is that cycle (mutants: the block\'s first unread; the first cycle\'s fate; the fate unread; the sellswords left out; the room run past the block)', () => {
  const m = farSea();
  const roster = m.world.rosterOf(m.row0);
  const merchant = roster.filter((r) => r.job === 'merchant').sort((x, y) => x.slot - y.slot)[0];   // the first: the town's sellsword its contract's
  const { k0, m: n } = voyageBlock(merchant, m.row0, 60, m.world, 1);
  const fatedAt = new Map();
  const world = { ...m.world, fated: (p, j) => fatedAt.get(j) === p.slot };
  assert.equal(voyageRoom(merchant, m.row0, k0, world, [], 1), n, 'the block\'s');
  assert.equal(voyageRoom(merchant, m.row0, k0 + 1, world, [], 1), 1, 'not its first: one');
  assert.equal(voyageRoom(merchant, m.row0, k0, { ...world, longPassages: false }, [], 1), 1, 'no land past the Bay: one');
  fatedAt.set(k0 + 3, merchant.slot);
  assert.equal(voyageRoom(merchant, m.row0, k0, world, [], 1), 3, 'short of the cycle the lives take it on');
  fatedAt.clear(); fatedAt.set(k0, merchant.slot);
  assert.equal(voyageRoom(merchant, m.row0, k0, world, [], 1), 1, 'taken at its first: one');
  const sws = roster.filter((r) => r.job === 'mercenary');
  const merchants = roster.filter((r) => r.job === 'merchant').sort((a, b) => a.slot - b.slot);
  const mine = sws.sort((a, b) => a.slot - b.slot).filter((_, i) => i % merchants.length === merchants.findIndex((x) => x.slot === merchant.slot));
  assert.ok(mine.length > 0, 'a contract sellsword');
  fatedAt.clear(); fatedAt.set(k0 + 2, mine[0].slot);
  assert.equal(voyageRoom(merchant, m.row0, k0, world, [], 1), 2, 'its contract sellsword\'s');
  const rider = roster.find((r) => r.job === 'pilgrim');
  fatedAt.clear(); fatedAt.set(k0 + 4, rider.slot);
  assert.equal(voyageRoom(merchant, m.row0, k0, world, [rider], 1), 4, 'one who walks with it');
  assert.equal(voyageRoom(merchant, m.row0, k0, world, [], 1), n, 'one who does not: none of its');
});

// ─── 2. THE CYCLES AT SEA (ownTrip, townTrips, visitorsOf) ──────────────────────────

/** A merchant of the first port whose block's first cycle sails the long passage, its trip, the block. */
function longPassage(m, o) {
  for (const res of m.world.rosterOf(m.row0).filter((r) => r.job === 'merchant')) {
    for (let k = 40; k < 140; k++) {
      const { k0 } = voyageBlock(res, m.row0, k, m.world, 1);
      if (k0 !== k) continue;
      const holder = m.world.holderOf ? m.world.holderOf(res, k) : res;
      const t = holder && memoTrip(holder, m.row0, k, m.world, o);
      if (t?.sea?.cycles > 1) return { res, holder, k0: k, t };
    }
  }
  return null;
}

test('WW7-11 THE CYCLES AT SEA: a cycle its block\'s long passage spends at sea makes no trip of its own (voyageOver - the passage, read through the trips\' book); the first after it its own again; the passage still being asked, the cycle waits; a cycle whose block\'s first rolled no sea asks nothing of it (mutants: the cycles at sea\'s trip; the passage\'s end; the wait unread; the sea\'s dice unread; the holder of the first cycle)', () => {
  const m = farSea({ living: true });
  const o = O();
  const got = longPassage(m, o);
  assert.ok(got, 'a long passage');
  const { res, k0, t } = got;
  const c = t.sea.cycles;
  for (let k = k0 + 1; k < k0 + c; k++) {
    const h = m.world.holderOf(res, k);
    assert.equal(voyageOver(h, m.row0, k, m.world, o), t, `cycle ${k}: away on it`);
    assert.equal(ownTrip(h, m.row0, k, m.world, o), null, `cycle ${k}: no trip of its own`);
  }
  assert.equal(voyageOver(m.world.holderOf(res, k0 + c), m.row0, k0 + c, m.world, o), null, 'home again: its own cycle');
  assert.equal(voyageOver(res, m.row0, k0, m.world, o), null, 'the first cycle is the passage\'s own');
  // the passage not yet known (the map unread): the cycles it may span wait
  const unread = { ...m.world, lanesFrom: () => undefined };
  assert.equal(voyageOver(res, m.row0, k0 + 1, unread, O()), undefined, 'asked: waits');
  assert.equal(ownTrip(res, m.row0, k0 + 1, unread, O()), undefined);
  assert.equal(voyageOver(res, m.row0, k0 + 1, { ...m.world, holderOf: (r, j) => (j === k0 ? null : r) }, O()), null, 'the place empty at its first: no passage');
  // a block whose first cycle rolled no sea: nothing asked of it (its first's trip waiting on a way)
  const asking = { ...unread, routeOf: () => undefined };
  let quiet = null;
  for (let k = 40; k < 400 && quiet == null; k++) { const b = voyageBlock(res, m.row0, k, m.world, 1); if (b.k0 !== k && !seaRolled(res, b.k0) && ownTrip(res, m.row0, b.k0, asking, O()) === undefined) quiet = k; }
  assert.ok(quiet != null);
  assert.equal(voyageOver(res, m.row0, quiet, asking, O()), null, 'no sea at its first: no passage to wait on');
});

test('WW7-11 THE PASSAGE ON EVERY DAY IT IS UNDER WAY: the town\'s trips hold it on each (townTrips\' cycles - the block\'s first beside the two), once, its traveller in no other; the far port has its party as visitors through the stay; a cycle\'s other trips the ones they always were (mutants: the block\'s first left out; a past passage kept; the visitors\' day)', () => {
  const m = farSea({ living: true });
  const o = O();
  const { res, k0, t } = longPassage(m, o);
  assert.equal(cycleOf(res, Math.floor(t.outT0 / DAY_MIN), 1).k, k0, 'out in its own cycle');
  assert.equal(cycleOf(res, Math.floor((t.backT1 - DAY_START_MIN - 1) / DAY_MIN), 1).k, k0 + t.sea.cycles - 1, 'home in its last');
  const d0 = Math.floor(t.outT0 / DAY_MIN), d1 = Math.floor(t.backT1 / DAY_MIN);
  for (let d = d0; d <= d1; d++) {
    const trips = townTrips(m.row0, d * DAY_MIN + 720, m.world, o);
    assert.ok(trips, `day ${d}: known`);
    const mine = trips.filter((tr) => tr.party.some((p) => p.id === t.leader.id));
    assert.equal(mine.length, 1, `day ${d}: on its passage alone`);
    assert.equal(mine[0].id, t.id);
  }
  const ks = cyclesAbout(res, m.row0, k0 + 2, m.world, 1);
  assert.deepEqual(ks, [k0, k0 + 1, k0 + 2], 'the block\'s first before the two');
  const after = townTrips(m.row0, (d1 + 3) * DAY_MIN + 720, m.world, o);
  assert.ok(!after.some((tr) => tr.id === t.id), 'home: gone from the town\'s trips');
  const stayDay = Math.floor(t.outT1 / DAY_MIN) + 1;
  if (t.backT0 > (stayDay * DAY_MIN) + DAY_START_MIN) {
    const vis = visitorsOf(m.far, stayDay, m.world, o);
    assert.ok(vis.some((v) => v.trip.id === t.id && v.dock), 'the far port\'s visitor off the ship');
  }
  // its windows away never overlap another of its own
  const seen = partiesOver(m, d0 - 20, d1 + 20, o).filter((tr) => tr.party.some((p) => p.id === t.leader.id)).sort((a, b) => a.outT0 - b.outT0);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i].outT0 >= seen[i - 1].backT1, 'one trip at a time');
});

test('WW7-11 A LONG PASSAGE IS ITS OWN: none joins it, it joins none (a joiner walks its train\'s timeline - on a passage of more cycles its own cycles would set out again from aboard); a passage of a cycle\'s train as it was (mutant: the join law unchanged)', () => {
  const m = farSea();
  const roster = m.world.rosterOf(m.row0);
  const merchant = roster.find((r) => r.job === 'merchant'), pedlar = roster.find((r) => r.job === 'pedlar');
  const sea = (r, cycles) => ({ id: `${r.id}:9`, k: 9, kind: r.job, leader: r, party: [r], from: m.row0, to: m.far, way: { pts: [], cum: [0], len: 0, kinds: [] }, pace: 1,
    outT0: 9000, outT1: 30000, backT0: 32000, backT1: 52000, trim0: 0, trim1: 0, sea: { key: 'far', len: 300_000, ...(cycles > 1 ? { cycles } : {}) } });
  for (const [mc, jc, joined] of [[1, 1, true], [4, 4, false], [4, 1, false], [1, 4, false]]) {
    const mt = sea(merchant, mc), jt = sea(pedlar, jc);
    const tripOf = (r) => (r.slot === merchant.slot ? mt : r.slot === pedlar.slot ? jt : null);
    const out = formCaravans(m.row0, [mt, jt], roster, tripOf, 1);
    const train = out.find((tr) => tr.leader.slot === merchant.slot);
    assert.equal(train.party.some((p) => p.slot === pedlar.slot), joined, joined ? 'a cycle\'s: the train as it was' : `a long passage (${mc}, ${jc}): none joins, none joined`);
    assert.equal(out.some((tr) => tr.leader.slot === pedlar.slot), !joined);
  }
});

test('WW7-11 THE BAY\'S PASSAGES AS THEY WERE: a port with no far lane sails the trips it always did with the land past the Bay standing or not, to the byte; a lane says it is far past the Bay or across its edge alone (mutants: the Bay\'s lanes far; a crossing lane not; a lane past the Bay not)', () => {
  const on = livingMap({ sea: true }), off = livingMap({ sea: true });
  on.world.longPassages = true;
  const a = partiesOver(on, 300, 360), b = partiesOver(off, 300, 360);
  assert.ok(a.length > 200 && a.some((t) => t.sea), `${a.length} parties, ${a.filter((t) => t.sea).length} at sea`);
  assert.deepEqual(a.map((t) => [t.id, t.outT0, t.backT1, t.to.mapId, t.party.map((p) => p.id), t.sea?.key ?? null]), b.map((t) => [t.id, t.outT0, t.backT1, t.to.mapId, t.party.map((p) => p.id), t.sea?.key ?? null]));
  // the far word: livingLanes.js
  const bay = { mapId: 250300, px: 300, py: 250, port: true }, bay2 = { mapId: 240300, px: 300, py: 240, port: true };
  const past = { mapId: 77, px: -50, py: 250, port: true }, past2 = { mapId: 78, px: -80, py: 250, port: true };
  const byPort = new Map([bay, bay2, past, past2].map((t) => [portIdOf(t), t]));
  const lanes = [{ key: 'b', a: { id: portIdOf(bay2) }, b: { id: portIdOf(bay) } }, { key: 'x', a: { id: portIdOf(bay) }, b: { id: portIdOf(past) }, cross: true }, { key: 'p', a: { id: portIdOf(past) }, b: { id: portIdOf(past2) } }];
  const ll = createLivingLanes({ lanes: () => lanes, way: () => ({ len: 9000 }), townOfPort: (id) => byPort.get(id) ?? null, sailorsOf: () => [], generation: () => 1 });
  assert.deepEqual(ll.from(bay).map((l) => [l.key, l.far ?? null]), [['b', null], ['x', true]], 'a Bay port: its Bay lane as it was, its crossing far');
  assert.ok(!('far' in ll.from(bay)[0]), 'the Bay\'s lane the shape it always had');
  assert.deepEqual(ll.from(past).map((l) => [l.key, l.far ?? null]), [['x', true], ['p', true]], 'past the Bay: every lane far');
});

// ─── 3. A CAPITAL IS ONE TOWN (scenes/livingWorld/livingIndex.js, livingTrips.js) ──────────────────────────

test('WW7-11 A CAPITAL IS ONE TOWN: the Imperial City\'s 625 slices are places, but no square, area or town\'s list past the Bay names a street - its centre alone, the capital\'s own map id - and a street sends no traveller; a street\'s own record stands for a reader on it (mutants: the streets binned; the roads\' places\' streets; the street\'s roster; the centre a street)', () => {
  const k = CAPITALS.findIndex((c) => c.key === 'imperial-city'), n = capitalSpan(CAPITALS[k]), h = (n - 1) / 2;
  assert.equal(n * n, 625);
  const cx = 600, cy = -300;
  const rows = [];
  for (let s = 0; s < n * n; s++) rows.push({ mapId: capitalPlaceId(k, s === 312 ? 0 : s < 312 ? s + 1 : s), name: `IC${s}`, px: cx + (s % n) - h, py: cy + Math.floor(s / n) - h, type: LOCATION_TYPES.TownCity, w: 8, h: 8, port: false });
  rows.push({ mapId: 31, name: 'Near', px: cx + 15, py: cy, type: LOCATION_TYPES.TownHamlet });
  const places = createWorldPlaces();
  places.register('tesa', rows);
  assert.equal(capitalStreet({ mapId: capitalPlaceId(k, 0) }), false, 'the centre is the city');
  assert.equal(capitalStreet({ mapId: capitalPlaceId(k, 7) }), true);
  assert.equal(capitalStreet({ mapId: 31 }), false);
  const beyond = { epoch: () => 1, placesIn: () => [{ x: cx + 1, y: cy + 1 }, { x: cx + 15, y: cy }], landedIn: () => true, landed: () => 0 };
  const idx = createLivingIndex({ places, populated: () => true, peopleAt: () => 0, beyond });
  const near = idx.townsNear(cx + 15, cy, 18).map((t) => t.mapId);
  assert.deepEqual(near, [31, capitalPlaceId(k, 0)].sort((a, b) => a - b), 'one town for the city');
  const area = idx.townAt(cx, cy).area;
  assert.ok(idx.townsIn(area).every((t) => !capitalStreet(t)) && idx.townsIn(area).some((t) => t.mapId === capitalPlaceId(k, 0)), 'its area: the centre');
  const street = idx.townAt(cx + 3, cy + 3);
  assert.equal(street.mapId, capitalPlaceId(k, 312 + 3 * n + 3), 'a street\'s record stands');
  const trips = createLivingTrips({ places, populated: () => true, peopleAt: () => 0, maps: { getClimateIndex: () => 0 }, woods: { getHeightMapValue: () => 0 }, roads: () => null });
  assert.deepEqual(trips.world.rosterOf(street), [], 'a street sends none');
  assert.ok(trips.world.rosterOf(idx.townAt(cx, cy)).length > 10, 'the city\'s travellers its centre\'s');
  assert.equal(trips.world.longPassages, false, 'no land past the Bay: no long passage');
  const landed = createLivingTrips({ places, populated: () => true, peopleAt: () => 0, maps: { getClimateIndex: () => 0 }, woods: { getHeightMapValue: () => 0 }, roads: () => null,
    pastTheBay: { build: () => 1, landedIn: () => true, onRegion: () => {} } });
  assert.equal(landed.world.longPassages, true, 'the land past the Bay standing: its long passages');
});

// ─── 4. THE SERPENT ON THE WORLD'S LANES (WW7-12) ──────────────────────────

const DAY = 611;   // a serpent day (serpent2_herald.test.js's)
const T = serpentTimes(DAY);
const SITE = { sx: 81_000, sz: -42_000, pl: 'Northpoint' };

test('WW7-12 THE HUB\'S WORD: `at` - the day, the site\'s native point to the whole unit, the port it lies off (the `site` word\'s law); serpentAtWord the record\'s agreed site while its day is the one the clock is about, else none (mutants: the kind unknown; a fraction let through; the bound; the place\'s law; the day\'s test; the agreement unread)', () => {
  assert.deepEqual(validSerpentOut({ k: 'at', ...SITE, d: DAY, x: 1 }), { k: 'at', d: DAY, ...SITE });
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: DAY, sx: 81_000.5 }), null, 'to the whole unit');
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: DAY, sz: POSE_BOUND + 1 }), null, 'inside the world');
  assert.ok(validSerpentOut({ k: 'at', ...SITE, d: DAY, sx: -POSE_BOUND }));
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: -1 }), null);
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: DAY, pl: '<@&1> Sentinel' }), null, 'a place a mention never');
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: DAY, pl: ' Sentinel' }), null);
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: DAY, pl: 7 }), null);
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: DAY, pl: '7 Hills' }), null, 'a place begins with a letter');
  assert.equal(validSerpentOut({ k: 'at', ...SITE, d: DAY, pl: 'Sentinel <@&1>' }), null, 'and is the wire\'s own');
  assert.equal(validSerpentOut({ k: 'at', d: DAY, pl: SITE.pl }), null, 'no site: no word');
  let rec = foldGateSite(null, DAY, 'acct-a', SITE.sx, SITE.sz, SITE.pl);
  assert.equal(serpentAtWord(rec, T.omenAt), null, 'one account: nothing agreed');
  rec = foldGateSite(rec, DAY, 'acct-b', SITE.sx, SITE.sz, SITE.pl);
  assert.deepEqual(serpentAtWord(rec, T.omenAt), { t: 'serpent', k: 'at', d: DAY, sx: SITE.sx, sz: SITE.sz, pl: SITE.pl });
  assert.deepEqual(agreedSerpentSite(rec, DAY), { sx: SITE.sx, sz: SITE.sz, place: SITE.pl });
  assert.ok(serpentAtWord(rec, T.soundAt - 1), 'the day the clock is about');
  assert.equal(serpentAtWord(rec, serpentTimes(DAY + SERPENT_EVERY_DAYS).omenAt), null, 'another day\'s: none');
  assert.equal(serpentAtWord(null, T.omenAt), null);
  assert.equal(serpentAtWord('junk', T.omenAt), null);
});

/** The hub with accounts and Date.now at the harness's clock (serpent2_herald.test.js's harness, Discord left out). */
async function withHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM);
  r.room._heraldBeat = async () => {}; r.room._heraldNextAt = () => null; r.room._serpentHeraldBeat = async () => {};
  const realNow = Date.now, warn = console.warn;
  let clock = T.omenAt - 10 * 60_000;
  Date.now = () => clock;
  console.warn = () => {};
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); clock += 10; return ws; };
  const site = (ws, d, s) => r.raw(ws, JSON.stringify({ t: 'serpent', k: 'site', d, ...s, sl: SERPENT_SITE_LAW }));   // PIN MOVED (AUDIT TAMRIEL-WIDE E3): a word of the hub's own site law
  try { await fn({ r, join, site, set: (t) => { clock = t; } }); } finally { Date.now = realNow; console.warn = warn; }
}
const ats = (ws) => ws.sent.filter((w) => w.t === 'serpent' && w.k === 'at');

test('WW7-12 THE HUB TELLS: every game online hears where the accounts agree the serpent lies as soon as they do, and again only when that moves - one account\'s word, or a forged one beside the agreed, says nothing; a hello hears it while its day holds (mutants: the word never said; said on every word; said to the speaker alone; the hello\'s word)', async () => {
  await withHub(async ({ r, join, site, set }) => {
    const a = await join('a'), b = await join('b'), c = await join('c');
    await site(a, DAY, SITE);
    assert.deepEqual([a, b, c].map((ws) => ats(ws).length), [0, 0, 0], 'one account: nothing agreed, nothing said');
    await site(b, DAY, SITE);
    const word = { t: 'serpent', k: 'at', d: DAY, sx: SITE.sx, sz: SITE.sz, pl: SITE.pl };
    assert.deepEqual([a, b, c].map((ws) => ats(ws)), [[word], [word], [word]], 'two agree: every game told');
    await site(c, DAY, { sx: 1, sz: 2, pl: 'Daggerfall' });
    assert.deepEqual([a, b, c].map((ws) => ats(ws).length), [1, 1, 1], 'a forged word beside it: nothing new');
    const d = await join('d');
    assert.deepEqual(ats(d), [word], 'a hello hears it');
    const e = await join('e'), f = await join('f');
    await site(d, DAY, { sx: 1, sz: 2, pl: 'Daggerfall' });
    await site(e, DAY, { sx: 1, sz: 2, pl: 'Daggerfall' });
    const moved = { t: 'serpent', k: 'at', d: DAY, sx: 1, sz: 2, pl: 'Daggerfall' };
    assert.deepEqual(ats(f), [word, moved], 'the agreement moved: told again');
    set(serpentTimes(DAY + SERPENT_EVERY_DAYS).omenAt);
    const g = await join('g');
    assert.deepEqual(ats(g), [], 'its day gone: a hello hears none');
    assert.equal(r.store.get(SERPENT_SITE_RECORD).d, DAY);   // PIN MOVED (AUDIT TAMRIEL-WIDE E3): the record its site law's
  });
  const s = rd('server/src/index.js');
  assert.match(s, /this\._serpentSiteRec = rec;\n\s*this\._serpentAtTell\(had, rec, now\);/);
  assert.match(s, /\{ try \{ await this\._serpentAtTo\(ws, now\); \} catch/);
});

test('WW7-12 THE CLIENT KEEPS THE HUB\'S WORD: the link keeps the latest `at` by its day (toldAt), folds none of it into a fight; the session hands it on from the hub alone; a site the hub told is never said back as this game\'s (mutants: the word folded; an older day over a newer; another day\'s answered; the cell\'s `at` let through; the told site said back)', () => {
  const link = createSerpentLink({ now: () => 0, site: () => null });
  link.word({ k: 'at', d: DAY, ...SITE });
  assert.deepEqual(link.toldAt(DAY), { d: DAY, ...SITE });
  assert.equal(link.toldAt(DAY + 2), null, 'another day\'s: none');
  assert.equal(link.state(), SERPENT_STATE_EMPTY, 'no fight\'s word');
  link.word({ k: 'at', d: DAY - 2, sx: 5, sz: 5, pl: 'Old' });
  assert.deepEqual(link.toldAt(DAY), { d: DAY, ...SITE }, 'an older day\'s never over it');
  link.word({ k: 'at', d: DAY, sx: 9, sz: 9, pl: 'Moved' });
  assert.deepEqual(link.toldAt(DAY), { d: DAY, sx: 9, sz: 9, pl: 'Moved' }, 'the agreement moved');
  assert.match(rd('src/net/online.js'), /isSocialRoom\(room\) \? r\.k === 'fell' \|\| r\.k === 'rcpt' \|\| r\.k === 'at' : isCellRoom\(room\) && r\.k !== 'at'/);
  assert.match(hostText('src/scenes/world.js'), /if \(a && !a\.site\.told\) socialLink\(\)\?\.sendSerpentSite\?\.\(a\.day, a\.site\.sx, a\.site\.sz, a\.site\.near\);/);
});

/** A made world sea: the Bay's lane water its west half; past it all open sea. */
function madeSea() {
  setTamrielTrace({ w: 140, h: 130, land: new Uint8Array(140 * 130), province: new Uint8Array(140 * 130) });
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const bayOpen = (x, y) => inBay(x, y) && x < 300;
  const lw = worldLaneWater({ bayOpen, water: () => true, climateAt: () => CLIMATES.Ocean, beyond: () => true });
  return { bayOpen, ...lw };
}

test('WW7-12 THE SITE OVER THE WORLD\'S LANES: a game standing the world\'s lanes whole rolls it over every one of them (the Bay\'s, past it, across its edge - its waters on any); one that does not rises its serpent where the hub says the accounts agree, never one of its own; with neither, none; the lanes whole once the Bay\'s directory, the land past the Bay and its picture stand (mutants: the hub\'s word over a game\'s own roll; the told site\'s fields; the whole\'s picture, land or directory unread)', () => {
  const s = madeSea();
  const P = (id, px, py) => ({ id, name: `P${id}`, px, py, region: 17, road: { x: px, y: py } });
  const lane = (key, a, b, o = {}) => ({ key, a, b, ...o });
  const straight = (l) => { const pts = [l.a, l.b].map((p) => ({ x: (p.road.x + 0.5) * NATIVE_PIXEL, z: (500 - p.road.y - 0.5) * NATIVE_PIXEL })); return { pts, len: Math.hypot(pts[1].x - pts[0].x, pts[1].z - pts[0].z) * (819.2 / NATIVE_PIXEL) }; };
  const lanes = [lane('bay', P(1, 100, 100), P(2, 200, 100)), lane('past', P(3, -100, 100), P(4, -100, 300)), lane('cross', P(5, 150, 300), P(6, -200, 300), { cross: true })];
  const on = new Set();
  const book = (whole) => ({ whole: () => whole, all: () => lanes, way: straight, open: s.open });
  for (let d = 1; d < 400; d += 2) { const site = worldSerpentSite(d, book(true), () => { throw new Error('a game standing the lanes asks the hub nothing'); }); if (site) on.add(site.lane); }
  assert.deepEqual([...on].sort(), ['bay', 'cross', 'past'], 'its waters on every kind of lane');
  const own = findSerpentSite(DAY, { lanes, wayOf: straight, open: s.open });
  assert.deepEqual(worldSerpentSite(DAY, book(true), () => SITE), own, 'standing them: its own roll');
  const told = worldSerpentSite(DAY, { ...book(false), all: () => { throw new Error('no lanes asked'); } }, (d) => (d === DAY ? SITE : null));
  const [px, py] = sitePixelOfNative(SITE.sx, SITE.sz);
  assert.deepEqual({ ...told }, { day: DAY, lane: null, px, py, sx: SITE.sx, sz: SITE.sz, near: 'Northpoint', region: '', place: 'Northpoint', between: [null, null], ring: serpentRing(DAY, SITE.sx, SITE.sz), told: true });
  assert.deepEqual({ ...siteOfWord(DAY, SITE) }, { ...told });
  assert.equal(worldSerpentSite(DAY, book(false), () => null), null, 'neither: none');
  // the world's lanes whole (scenes/naval/worldLanes.js)
  const A = { id: 250100, px: 100, py: 250 };
  const dict = new Map([[A.id, { id: A.id, regionIndex: 17, mapIndex: 0 }]]);
  let beyond = true, dir = dict;
  const wl = createWorldLanes({ mapDict: () => dir, maps: { getRegion: () => ({ mapNames: ['A'] }), getClimateIndex: () => CLIMATES.Ocean }, portIds: [A.id], ports: { list: () => [], version: () => 'v' },
    bayOpen: s.bayOpen, bayOpenNative: (x, z) => s.bayOpen(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(z / NATIVE_PIXEL)), water: () => true, beyond: () => beyond });
  assert.equal(wl.whole(), true, 'all of it standing');
  beyond = false; assert.equal(wl.whole(), false, 'the land past the Bay off'); beyond = true;
  setTamrielTrace(null); assert.equal(wl.whole(), false, 'no picture'); madeSea();
  const wl2 = createWorldLanes({ mapDict: () => null, maps: { getRegion: () => null, getClimateIndex: () => CLIMATES.Ocean }, portIds: [A.id], ports: { list: () => [], version: () => 'v' }, bayOpen: s.bayOpen, bayOpenNative: () => true, water: () => true, beyond: () => true });
  assert.equal(wl2.whole(), false, 'the Bay\'s directory not yet');
  assert.equal(dir, dict);
  assert.match(hostText('src/scenes/world.js'), /return worldSerpentSite\(day, worldLanes, serpentLink\.toldAt\);/);
});

// ─── 5. ON THE FREEWARE'S WORLD ──────────────────────────────────

test('WW7-11 and WW7-12 with ARENA2: every lane past the Bay and every crossing lane fits a passage of every kind of traveller that sails (the fit, lanes per kind, logged against a cycle\'s alone); the serpent\'s site over the world\'s lanes, its waters past the Bay and across its edge on some of its days (logged)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { tamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundWoods, groundMaps, tamrielClimateAt, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { buildMapDict } = await import('../../../src/systems/map/mapDirectory.js');
  const { PORT_LOCATION_IDS } = await import('../../../src/systems/travel/travelPorts.js');
  const { createWorldPorts } = await import('../../../src/world/worldWide/worldPorts.js');
  const { arenaPixels, pastBayLakeAt } = await import('../../../src/world/arenaPlaces.js');
  const { arenaPlaceId, ARENA_TEMPLATE_KINDS } = await import('../../../src/world/arenaLocations.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const ground = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
    const bayOpen = (x, y) => inBay(x, y) && isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)) && maps.getClimateIndex(x, y) === CLIMATES.Ocean;
    const bayOpenNative = (x, z) => bayOpen(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(z / NATIVE_PIXEL));
    const places = createWorldPlaces();
    places.register('tesa', arenaPixels().stood.map((p) => ({ mapId: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, type: ARENA_TEMPLATE_KINDS[p.kind].type, port: !!p.port })));
    const ports = createWorldPorts({ places, openSea: (x, y) => water(x, y) && !pastBayLakeAt(x, y) });
    const dict = buildMapDict(maps);
    const wl = createWorldLanes({ mapDict: () => dict, maps, portIds: PORT_LOCATION_IDS, ports, bayOpen, bayOpenNative, water, beyond: () => true });
    assert.equal(wl.whole(), true);
    const far = [...wl.beyond(), ...wl.cross()].map((l) => ({ l, way: wl.way(l) })).filter((x) => x.way);
    assert.ok(far.length >= 20, `${far.length} far lanes with a way`);
    assert.ok(BEYOND_LANE_MAX_PX === 400);
    // PIN MOVED (AUDIT SEA PATHS C1): a lane past the Bay its search ran past its cap for runs longer than any block -
    // seaTrip passes it for a shorter, its packets sail it; every lane within the longest way a lane is let have fits
    const within = far.filter(({ way }) => way.len <= CROSS_LANE_PATH_PX * 819.2);
    assert.ok(within.length >= far.length - 5, `${far.length - within.length} lanes past the longest way`);
    // THE FIT: a passage of each sailing kind on each far lane, at a block's first cycle, the longest stay
    const town = { mapId: 1, px: -10, py: 10, port: true, blocks: 30 };
    const fit = {}, cycle = {};
    for (const job of SEA_JOBS) {
      const res = { id: `L1.t0`, town: 1, slot: 0, job };
      const len = cycleOf(res, 0, 1).len;
      const room = voyageBlock(res, town, 0, { longPassages: true }, 1).m;
      fit[job] = within.filter(({ way }) => seaTrip(res, town, 0, { lanesFrom: () => [{ to: { mapId: 2 }, len: way.len, key: 'x', far: true }], templeTown: () => true }, { start: 0, len, mpm: CALENDAR_MPM, pace: 1, rng: () => 0.99, room })?.sea).length;
      cycle[job] = far.filter(({ way }) => spanOf(way.len, STAY_DAYS[job][1]) <= len).length;
    }
    const km = far.map(({ way }) => Math.round(way.len / 1000)).sort((a, b) => a - b);
    console.log(`[ww7-11] far lanes ${far.length} (${wl.beyond().length} past the Bay, ${wl.cross().length} across), ${km[0]}..${km.at(-1)} km; fit a block ${JSON.stringify(fit)}; a cycle alone ${JSON.stringify(cycle)}`);
    for (const job of SEA_JOBS) assert.equal(fit[job], within.length, `every far lane a ${job}'s`);
    // THE SERPENT over the world's lanes: a run of its days, each site's lane counted by its kind
    const all = wl.all(), kinds = { bay: 0, past: 0, cross: 0, none: 0 };
    const kindOf = new Map(all.map((l) => [l.key, l.cross ? 'cross' : inBay(l.a.px, l.a.py) ? 'bay' : 'past']));
    let t0 = performance.now();
    for (let d = 1; d < 120; d += SERPENT_EVERY_DAYS) { const site = findSerpentSite(d, { lanes: all, wayOf: wl.way, open: wl.open }); kinds[site ? kindOf.get(site.lane) : 'none']++; }
    const ms = performance.now() - t0;
    console.log(`[ww7-12] ${all.length} lanes (${wl.bay().length} the Bay's); 60 serpent days: ${JSON.stringify(kinds)}, ${ms.toFixed(0)} ms`);
    assert.ok(kinds.past + kinds.cross > 0 && kinds.bay > 0, 'its waters on the Bay\'s and past it');
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
