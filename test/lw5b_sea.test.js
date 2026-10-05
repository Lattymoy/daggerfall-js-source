// LW5b (2026-10-05, bible/06-Systems/Living-World.md "LW5b", Mac: NPCs "travel between towns ... link with the ship AI
// at ports"): THE PASSAGE BY SEA - a port town's travellers now and then sail the Bay's lanes to a port across the water:
// out on a morning tide from the dock, at a ship's pace by night as by day, home on a later tide; never on the road; in
// and out of both towns by the dock; a passenger the lives take lost at sea; the towns' talk. On the synthetic map's
// ports (test/lwRoads.mjs `sea`) and the synthetic town.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthMap, livingMap, partiesOver } from './lwRoads.mjs';
import { synthTown } from './lwTown.mjs';
import { ownTrip, seaTrip, partyAt, awayOf, visitorsOf, partiesNear, newsOf, remainsNear, townTrips, cycleOf, SEA_CHANCE, SEA_PACE_X, SEA_TIDE_H, TRIP_REACH_PX, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { seaTrouble, troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { newsScript, SEA_NEWS } from '../src/systems/livingWorld/lines.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { lwRng } from '../src/systems/livingWorld/seed.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
/** A trip with its towns by id (a port's record and a town's with no harbour differ in nothing else). */
const plain = (t) => t && ({ ...t, from: t.from.mapId, to: t.to.mapId });

test('LW5b the passage: a port town\'s traveller sails on about SEA_CHANCE of their cycles (their own dice - a cycle that is none the trip it always was) to a port a lane runs to; out on a morning tide (SEA_TIDE_H), the crossing at SEA_PACE_X a walker\'s pace by night as by day, home on a later tide, inside the cycle - a lane too long for it passed over for a shorter, and none that fits (or no lane at all) the road\'s trip it always was; a town with no harbour, a sailor or a sellsword never; the map unread, none yet (mutants: the chance, the dice, the port, the tide, the pace, the turn-round, the fit, the fallback, the jobs, the unread)', () => {
  assert.deepEqual({ ...SEA_CHANCE }, { merchant: 0.4, pilgrim: 0.3, courier: 0.35, pedlar: 0.2, adventurer: 0.15 });
  assert.equal(SEA_PACE_X, 3);
  assert.deepEqual([...SEA_TIDE_H], [6, 9]);
  const sea = synthMap({ sea: true }), land = synthMap();
  const landOf = new Map(land.towns.map((t) => [t.mapId, t]));
  let sails = 0, trips = 0, same = 0;
  for (const town of sea.towns.filter((t) => t.mapId !== 9000)) {
    for (const res of sea.world.rosterOf(town)) {
      for (let k = 40; k < 70; k++) {
        const t = ownTrip(res, town, k, sea.world, O());
        if (!town.port || !(SEA_CHANCE[res.job] > 0)) { assert.ok(!t?.sea, `${res.job} of ${town.name}: never by sea`); continue; }
        const lt = ownTrip(res, landOf.get(town.mapId), k, land.world, O());
        if (!t) { assert.equal(lt, null, 'no trip at all: none by road either'); continue; }
        trips++;
        const rolled = lwRng(res.town, res.slot, k, 0x736561)() < SEA_CHANCE[res.job];
        if (!t.sea) {
          assert.deepEqual(plain(t), plain(lt), 'no passage (or none that fits): the road\'s trip it always was');
          if (!rolled) same++;
          continue;
        }
        assert.ok(rolled, 'a passage only where its own dice said sail');
        sails++;
        const lane = sea.world.lanesFrom(town).find((l) => l.key === t.sea.key);
        assert.ok(lane && lane.to === t.to, 'to the port its lane runs to');
        const cross = Math.ceil(lane.len / (CALENDAR_MPM * SEA_PACE_X));
        assert.equal(t.outT1 - t.outT0, cross, 'the crossing, by night as by day');
        assert.equal(t.backT1 - t.backT0, cross);
        const tide = (m) => ((m % DAY_MIN) + DAY_MIN) % DAY_MIN;
        assert.ok(tide(t.outT0) >= SEA_TIDE_H[0] * 60 && tide(t.outT0) < SEA_TIDE_H[1] * 60, 'out on the morning tide');
        assert.equal(tide(t.backT0), tide(t.outT0), 'home on the same tide');
        assert.ok(Math.floor(t.backT0 / DAY_MIN) > Math.floor(t.outT1 / DAY_MIN), 'a ship turns round overnight at the least');
        const { start, len } = cycleOf(res, Math.floor(t.outT0 / DAY_MIN), 1);
        assert.ok(t.outT0 >= start * DAY_MIN && t.backT1 <= (start + len) * DAY_MIN + 240, 'inside its cycle');
        assert.equal(t.way.len, 0, 'no road under it');
      }
    }
  }
  assert.ok(trips > 100 && sails > 10 && same > 10, `trips ${trips}, passages ${sails}, the same ${same}`);
  const share = sails / trips;
  assert.ok(share > 0.08 && share < 0.45, `about the jobs' share (${share.toFixed(2)})`);
  // the map unread: none yet
  const port = sea.towns.find((t) => t.port && t.mapId !== 9000);
  const res = sea.world.rosterOf(port).find((r) => r.job === 'merchant');
  assert.equal(seaTrip(res, port, 50, { ...sea.world, lanesFrom: () => undefined }, { start: 350, len: 7, mpm: CALENDAR_MPM, pace: 1, rng: () => 0.1 }), undefined);
  assert.equal(seaTrip(res, port, 50, { ...sea.world, lanesFrom: () => [] }, { start: 350, len: 7, mpm: CALENDAR_MPM, pace: 1, rng: () => 0.1 }), null, 'no lane: none');
  // the fit: a lane too long for the cycle passed over for a shorter; with none shorter, none
  const near = sea.world.lanesFrom(port)[0];
  const long = { to: sea.towns.find((t) => t.mapId === 9000), len: 5e7, key: 'long' };
  const so = { start: 350, len: 7, mpm: CALENDAR_MPM, pace: 1, rng: () => 0.1 };
  assert.equal(seaTrip(res, port, 50, { ...sea.world, lanesFrom: () => [long] }, so), null, 'too long for the cycle: none');
  assert.equal(seaTrip(res, port, 50, { ...sea.world, lanesFrom: () => [long, near] }, so)?.sea.key, near.key, 'the shorter, that fits');
  // the fallback: the cycles a port's traveller's dice said sail, with no lane to sail, are the road's trips they always were
  const noLanes = { ...sea.world, lanesFrom: () => [] };
  let fellBack = 0;
  for (const r of sea.world.rosterOf(port).filter((x) => SEA_CHANCE[x.job] > 0)) {
    for (let k = 40; k < 70; k++) {
      if (!(lwRng(r.town, r.slot, k, 0x736561)() < SEA_CHANCE[r.job])) continue;
      const lt = ownTrip(r, landOf.get(port.mapId), k, land.world, O());
      if (!lt) continue;
      assert.deepEqual(plain(ownTrip(r, port, k, noLanes, O())), plain(lt), 'no lane to sail: the road\'s trip');
      fellBack++;
    }
  }
  assert.ok(fellBack > 3, `fell back (${fellBack})`);
});

test('LW5b at sea, never on the road: a passage is \'sea\' while it sails (out and home), \'stay\' between, home before and after - never \'out\' or \'back\', so no road shows it; its away window and its visitors are the dock\'s; a port\'s visitors come off the ships from a port however far - its lanes unread, not yet (mutants: the phase, the dock, the far haven, the unread)', () => {
  const sea = synthMap({ sea: true });
  const o = O();
  const passages = partiesOver({ ...sea }, 350, 420, o).filter((t) => t.sea);
  assert.ok(passages.length > 5, `passages (${passages.length})`);
  const P = passages[0];
  assert.equal(partyAt(P, P.outT0 - 1).phase, 'home');
  assert.equal(partyAt(P, P.outT0).phase, 'sea');
  assert.equal(partyAt(P, P.outT1 - 1).phase, 'sea');
  assert.equal(partyAt(P, P.outT1).phase, 'stay');
  assert.equal(partyAt(P, P.backT0).phase, 'sea');
  assert.equal(partyAt(P, P.backT1).phase, 'home');
  const mid = Math.floor((P.outT0 + P.outT1) / 2);
  assert.ok(!partiesNear(P.from.px, P.from.py, mid, sea.world, o, 30).parties.some((p) => p.trip.id === P.id), 'no road shows it');
  const days = Math.floor(P.outT0 / DAY_MIN);
  const away = awayOf(P.leader, townTrips(P.from, days * DAY_MIN + 720, sea.world, o));
  assert.ok(away.some((w) => w.dock && w.t0 === P.outT0), 'the away window the dock\'s');
  const arrive = Math.floor((P.outT1 - 240) / DAY_MIN);
  const vis = visitorsOf(P.to, arrive, sea.world, o);
  assert.ok(vis.some((v) => v.trip.id === P.id && v.dock), 'a visitor off the ship, by the dock');
  // the far haven: its passengers come in at the first port, beyond TRIP_REACH_PX of it
  const haven = sea.towns.find((t) => t.mapId === 9000);
  const first = sea.towns.find((t) => t.port && t.px === 100);
  assert.ok(Math.max(Math.abs(haven.px - first.px), Math.abs(haven.py - first.py)) > TRIP_REACH_PX, 'beyond the reach');
  const fromHaven = passages.filter((t) => t.from.mapId === 9000 && t.to.mapId === first.mapId);
  const any = partiesOver({ ...sea }, 350, 470, O()).filter((t) => t.from.mapId === 9000 && t.to.mapId === first.mapId && t.sea);
  const H = fromHaven[0] ?? any[0];
  assert.ok(H, 'a passage from the far haven');
  const hv = visitorsOf(first, Math.floor((H.outT1 - 240) / DAY_MIN), sea.world, O());
  assert.ok(hv.some((v) => v.trip.id === H.id && v.dock), 'the haven\'s passengers among the first port\'s visitors');
  assert.ok(!visitorsOf({ ...first, port: false }, Math.floor((H.outT1 - 240) / DAY_MIN), sea.world, O()).some((v) => v.trip.id === H.id), 'a town with no harbour reads no lanes');
  assert.equal(visitorsOf(first, Math.floor((H.outT1 - 240) / DAY_MIN), { ...sea.world, lanesFrom: () => undefined }, O()), undefined, 'the map unread: not yet');
  const unreadHere = { ...sea.world, lanesFrom: (t) => (t.mapId === first.mapId ? undefined : sea.world.lanesFrom(t)) };
  assert.equal(visitorsOf(first, Math.floor((H.outT1 - 240) / DAY_MIN), unreadHere, O()), undefined, 'its own lanes unread (its neighbours\' trips known): not yet');
});

test('LW5b lost at sea: a passenger the lives take this cycle is lost at a seeded hour of a crossing (no foe of the land), gone from the party there, nowhere to lie; the ship sails on with the rest; none fated, none; the town says so in the sea\'s words (mutants: the fated, the hour, the remains, the rest, the words)', () => {
  const map = livingMap({ sea: true });
  const o = O();
  const passages = partiesOver(map, 350, 420, o).filter((t) => t.sea && !t.enc);
  const P = passages.find((t) => t.party.length >= 1);
  assert.ok(P, 'a passage');
  const victim = P.party[0];
  const world = { ...map.trouble, dies: (m) => m.id === victim.id };
  const enc = seaTrouble(P, world);
  assert.ok(enc, 'the fated meet it');
  assert.deepEqual(enc.foes, [], 'no foe of the land');
  assert.equal(enc.leg, 'sea');
  assert.deepEqual(enc.dead, [victim.id]);
  const inOut = enc.t0 >= P.outT0 && enc.t0 <= P.outT1, inBack = enc.t0 >= P.backT0 && enc.t0 <= P.backT1;
  assert.ok(inOut || inBack, 'during a crossing');
  assert.deepEqual(troubleOf(P, world), enc, 'the trouble of a passage is the sea\'s');
  assert.equal(seaTrouble(P, { ...map.trouble, dies: () => false }), null, 'none fated: none');
  const T = troubledTrip(P, enc);
  assert.deepEqual(T.fallen.map((f) => [f.res.id, f.t, f.atSea]), [[victim.id, enc.t0, true]]);
  assert.equal(T.turned, false, 'the ship sails on');
  assert.equal(T.backT1, P.backT1);
  assert.equal(remainsNear(P.from.px, P.from.py, enc.t0 + 1, { townsNear: () => [P.from], routeOf: map.world.routeOf, rosterOf: map.world.rosterOf, fate: () => T, lanesFrom: map.world.lanesFrom }, O(), 1000).remains.length, 0, 'nowhere on the map to lie');
  // the out crossing the likelier
  let outs = 0, n = 0;
  for (const t of passages) { const e = seaTrouble(t, { ...map.trouble, dies: () => true }); if (!e) continue; n++; if (e.t0 <= t.outT1) outs++; }
  assert.ok(n > 5 && outs / n > 0.45, `out the likelier (${outs}/${n})`);
  // the news: the sea's words
  const news = newsOf([{ ...T, backT1: T.backT1 }], T.backT1 + 1);
  assert.equal(news[0].kind, 'fell');
  assert.equal(news[0].sea, true);
  let told = null;
  for (let seed = 1; seed < 4000 && !told; seed++) told = newsScript(seed, news);
  assert.ok(SEA_NEWS.fell.includes(told.script), 'the sea\'s own words');
});

test('LW5b the town by the dock: a traveller sailing walks to the dock and is gone from it; a visitor off a ship comes in by it and leaves by it (mutants: the dock unread for each)', () => {
  const { nav, buildings, doors } = synthTown();
  const TOWN = { mapId: 12345, blocks: 9, region: 17, people: 3, port: true };
  let roads = null;
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => 100 * DAY_MIN + 600, rate: () => 0.2, mpm: CALENDAR_MPM, tripsOf: () => roads, harbour: () => ({ x: 96 * 1.6, z: -10 }),
  });
  const dock = town.dockSpot();
  assert.ok(dock, 'the harbour sounded');
  const sailor = town.residents.find((r) => r.roll === 't' && r.job === 'merchant');
  const D0 = 100 * DAY_MIN + 240;
  const V = { ...town.residents.find((r) => r.roll === 't' && r.id !== sailor.id), id: 'L777.t3', town: 777 };
  roads = { away: new Map([[sailor.id, [{ t0: D0 + 400, t1: D0 + 3000, yaw: 0, armed: false, dock: true }]]]), visitors: [{ res: V, inT: D0 + 300, outT: D0 + 900, yaw: 1.2, dock: true, trip: { party: [V] } }] };
  const plan = town.planOf(sailor, 100);
  const out = plan.find((e) => e.kind === 'away' || (e.kind === 'walk' && e.t0 >= D0 + 300 && e.t1 <= D0 + 400 + 1));
  assert.ok(plan.some((e) => (e.at?.key ?? '') === dock.key && e.t1 <= D0 + 400 + 1), `the walk out ends at the dock (${out?.kind})`);
  const vplan = town.planOf(V, 100);
  assert.ok(vplan.some((e) => (e.from?.key ?? e.at?.key ?? '') === dock.key && e.t0 >= D0 + 300 - 1 && e.t0 <= D0 + 400), 'in off the dock');
  assert.ok(vplan.some((e) => (e.at?.key ?? '') === dock.key && e.t1 <= D0 + 900 + 1 && e.t1 >= D0 + 600), 'out by the dock');
});

test('LW5b the streaming host: a port town\'s lanes from the Bay\'s own network - the far port, the lane\'s length - none for a town with no harbour, none yet while the map is unread (mutants: the lanes, the harbour, the unread)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /livingTripWorld\.lanesFrom = \(town\) => \{\n\s*if \(!town\?\.port\) return \[\];\n\s*if \(!mapDict\) return undefined;/);
  assert.match(w, /got = laneNet\(\)\.filter\(\(l\) => l\.a\.id === id \|\| l\.b\.id === id\)\.flatMap\(\(l\) => \{\n\s*const way = livingLaneWay\(l\), to = livingTownOfPort\(l\.a\.id === id \? l\.b\.id : l\.a\.id\);\n\s*return way && to \? \[\{ to, len: way\.len, key: l\.key \}\] : \[\];/);
});
