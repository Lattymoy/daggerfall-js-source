// SEA-EVENTS (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Eltheric
// Ocean's events on the shared clock; bible/03-World/Eltheric-Ocean.md SEA-EVENTS): the Aether Storm and the treasure fleet -
// the wire's `fk`/`fd` and the hub's record of a sailing scattered, end to end (net/wire.js, net/wild/wildLaw.js); the law
// of where each is (systems/sea/seaEvents.js); the fleet's ships at sea (scenes/naval/treasureFleet.js); the sea's host
// (scenes/seaVenturesHost.js - the storm's weather, wrack and lightning, the fleet's feed, purse and hub word, the
// rumours); the chart's marks (ui/etherChartWindow.js); the seams by source. tools/mutants/seaevents.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOCIAL_ROOM, validWdunIn, validWdunOut, parseClient, SEA_FLEET_PERIOD_MS, seaFleetSailing, relaySupportsWdunSea } from '../../../src/net/wire.js';
import * as L from '../../../src/net/wild/wildLaw.js';
import * as E from '../../../src/systems/sea/seaEvents.js';
import { BANDS, VEIL_X, LEAGUE_PX, veilhaven, etherBandAt, inEther, ETHER_GOODS } from '../../../src/world/ethericSea.js';
import { HAUNT_SPREAD } from '../../../src/systems/naval/etherShips.js';
import { createShipDamage, SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { ELTHERIC_SET_PIECES, elthericChance } from '../../../src/systems/aetheric.js';
import { createTreasureFleet, FLEET_STAND_M, FLEET_DROP_M } from '../../../src/scenes/naval/treasureFleet.js';
import { createSeaVentures, seaStormShown, WRACK_SITE, FLEET_FEED_MS, FLEET_LEAD_MS } from '../../../src/scenes/seaVenturesHost.js';
import { STRAND_YIELD } from '../../../src/scenes/etherHost.js';
import * as M from '../../../src/ui/etherChartWindow.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const P = SEA_FLEET_PERIOD_MS;
const NP = 32768;
/** A fake streaming state: a native unit a fortieth of a metre (the port's), the scene's origin the world's. */
const STATE = { localFromWorld: (x, z) => [x / 40, z / 40] };

test('SEA-EVENTS the wire and the hub: a sailing scattered is `fk` in, `fd` out and in the hello\'s `st`; the hub keeps this sailing\'s or the last\'s alone, once, till the sailing after it is over (mutants: the bounds, the window, the once, the keep)', () => {
  assert.equal(P, 3 * 3_600_000);
  assert.equal(seaFleetSailing(P * 7 + 5), 7);
  assert.equal(seaFleetSailing(P * 7 - 1), 6);
  assert.deepEqual(validWdunIn({ k: 'fk', n: 12 }), { k: 'fk', n: 12 });
  for (const n of [-1, 1.5, 1e8, '3', null]) assert.equal(validWdunIn({ k: 'fk', n }), null, String(n));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'wdun', k: 'fk', n: 4 }), { hasHello: true }), { t: 'wdun', k: 'fk', n: 4 });
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'fd', fleets: [3, -1, 'x', 4, 5, 6, 7] }), { k: 'fd', fleets: [3, 4] });
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'st', day: 2, locks: [], crows: [], fleets: [9] }).fleets, [9]);
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'st', day: 2, locks: [], crows: [] }).fleets, [], 'an older hub\'s hello: none');
  assert.ok(relaySupportsWdunSea('world246') && !relaySupportsWdunSea('world245'), 'one version with the vaults');
  // PIN MOVED (AUDIT SEA VENTURES A7): heard only while she is under way (her period's hour in port and the hour before
  // her said nothing yet) and a word late on its way - never "this sailing or the last" by the period alone
  const st = L.wdunEmpty(), now = P * 100 + E.FLEET_OFFSET_MS + 5000;
  assert.deepEqual(st.fleets, {});
  assert.equal(L.wdunFleetSunk(st, 101, now), false, 'a sailing not yet come');
  assert.equal(L.wdunFleetSunk(st, 98, now), false, 'one long past');
  assert.equal(L.wdunFleetSunk(L.wdunEmpty(), 100, P * 100 + E.FLEET_OFFSET_MS - 1), false, 'in port yet');
  assert.equal(L.wdunFleetSunk(st, 100, now), true, 'this sailing, under way');
  assert.equal(L.wdunFleetSunk(st, 100, now + 1), false, 'once');
  assert.equal(L.wdunFleetSunk(st, 99, P * 99 + E.FLEET_OFFSET_MS + E.FLEET_SAIL_MS + 60_000), true, 'the last, a word late on its way');
  assert.equal(L.wdunFleetSunk(L.wdunEmpty(), 99, P * 99 + E.FLEET_OFFSET_MS + E.FLEET_SAIL_MS + 60_001), false, 'and no later');
  assert.equal(st.fleets[100], 102 * P, 'kept till the sailing after it is over');
  assert.deepEqual(L.wdunFleets(st, now), [99, 100]);
  assert.deepEqual(L.wdunState(st, 'a', now).fleets, [99, 100]);
  assert.deepEqual(L.wdunOf(JSON.parse(JSON.stringify(st))).fleets, { 99: 101 * P, 100: 102 * P }, 'stored and read back');
  assert.equal(L.wdunPrune(st, 101 * P), true);
  assert.deepEqual(L.wdunFleets(st, 101 * P), [100], 'the last one let go when its keep runs out');
  assert.equal(L.wdunFleetSunk(L.wdunEmpty(), 1.5, now), false);
});

test('SEA-EVENTS the hub, end to end over the fake relay: a flagship sunk is said to everyone online and in every hello after; a second word moves nothing; another sailing\'s is refused (mutants: the hub\'s arm)', async () => {
  const realNow = Date.now; let clock = P * 92592 + E.FLEET_OFFSET_MS + 60_000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    // PIN MOVED (AUDIT SEA VENTURES A7): a registered account's word - a guest's scatters nothing
    const join = async (n, kind = 'linked') => { const ws = hub.connect(); await hub.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-${n}`, kind }); clock += 700; return ws; };
    const a = await join('a'), b = await join('b'), g = await join('g', 'guest');
    const wd = (ws, o) => hub.raw(ws, JSON.stringify({ t: 'wdun', ...o }));
    const got = (ws, k) => ws.sent.filter((m) => m.t === 'wdun' && m.k === k);
    const n = seaFleetSailing(clock);
    await wd(g, { k: 'fk', n }); clock += 700;
    assert.equal(got(b, 'fd').length, 0, 'a guest\'s word refused');
    await wd(a, { k: 'fk', n: n + 5 }); clock += 700;
    assert.equal(got(b, 'fd').length, 0, 'another sailing\'s refused');
    await wd(a, { k: 'fk', n }); clock += 700;
    assert.deepEqual(got(b, 'fd').at(-1), { t: 'wdun', k: 'fd', fleets: [n] }, 'said to everyone online');
    assert.deepEqual(got(a, 'fd').at(-1)?.fleets, [n]);
    await wd(b, { k: 'fk', n }); clock += 700;
    assert.equal(got(a, 'fd').length, 1, 'a second word moves nothing');
    const c = await join('c');
    await wd(c, { k: 'hi' }); clock += 700;
    assert.deepEqual(got(c, 'st').at(-1).fleets, [n], 'in every hello after');
  } finally { Date.now = realNow; }
});

test('SEA-EVENTS the storm\'s law: one each two hours, blowing fifty minutes; its eye born in the deep waters\' corridor and drifting STORM_DRIFT_PX; its reach STORM_R_PX; the same every call and every client (mutants: the period, the life, the waters, the drift, the reach, the window)', () => {
  assert.deepEqual([E.STORM_PERIOD_MS, E.STORM_LIFE_MS, E.STORM_R_PX, E.STORM_DRIFT_PX, E.STORM_ABYSS_LEAGUES, E.STORM_WRACK_MS], [7_200_000, 3_000_000, 40, 60, 60, 90_000]);
  const deep = BANDS.find((b) => b.id === 'deep'), abyss = BANDS.find((b) => b.id === 'abyss');
  const x0 = VEIL_X - (abyss.from + E.STORM_ABYSS_LEAGUES) * LEAGUE_PX, x1 = VEIL_X - deep.from * LEAGUE_PX;
  const seen = new Set(), bands = new Set();
  for (let n = 1000; n < 1060; n++) {
    const s = E.stormOf(n);
    bands.add(etherBandAt(s.x0).id);
    assert.deepEqual(s, E.stormOf(n), 'the same every call');
    assert.equal(s.start, n * E.STORM_PERIOD_MS);
    assert.equal(s.end, s.start + E.STORM_LIFE_MS);
    assert.ok(s.x0 >= x0 && s.x0 <= x1, `born in the deep waters: ${s.x0}`);
    assert.ok(Math.abs(s.y0 - veilhaven().py) <= HAUNT_SPREAD.deep);
    assert.ok(Math.abs(Math.hypot(s.x1 - s.x0, s.y1 - s.y0) - E.STORM_DRIFT_PX) < 1e-9, 'its drift');
    assert.ok(['deep', 'abyss'].includes(etherBandAt(s.x0).id));
    seen.add(Math.round(s.x0));
  }
  assert.ok(seen.size > 50, 'a new place each time');
  assert.deepEqual([...bands].sort(), ['abyss', 'deep'], 'in the Deep Aether and past the Abyss\'s edge');
  const s = E.stormOf(1000);
  assert.equal(E.stormAt(s.start - 1), null, 'between storms');
  assert.deepEqual(E.stormAt(s.start), s);
  assert.deepEqual(E.stormAt(s.end - 1), s);
  assert.equal(E.stormAt(s.end), null, 'blown out');
  assert.equal(E.stormAt(NaN), null);
  assert.deepEqual(E.nextStorm(s.start + 5), E.stormOf(1001));
  assert.deepEqual(E.stormEye(s, s.start), { x: s.x0, y: s.y0 });
  assert.deepEqual(E.stormEye(s, s.end), { x: s.x1, y: s.y1 });
  assert.deepEqual(E.stormEye(s, s.end + 9e6), { x: s.x1, y: s.y1 }, 'where it died, after');
  assert.deepEqual(E.stormEye(s, s.start - 9e6), { x: s.x0, y: s.y0 }, 'where it is born, before');
  const mid = E.stormEye(s, s.start + E.STORM_LIFE_MS / 2);
  assert.ok(Math.abs(mid.x - (s.x0 + s.x1) / 2) < 1e-9 && Math.abs(mid.y - (s.y0 + s.y1) / 2) < 1e-9, 'halfway, half its drift');
  const t = s.start + 600_000, e = E.stormEye(s, t);
  assert.deepEqual(E.stormHere(e.x + 39.9, e.y, t), s, 'within its reach');
  assert.equal(E.stormHere(e.x + 40.1, e.y, t), null, 'past it');
  assert.equal(E.stormHere(e.x, e.y, s.end), null, 'blown out');
  assert.equal(E.stormHere(500, 250, t), null, 'the Bay');
  assert.equal(E.stormHere(NaN, e.y, t), null);
  assert.equal(E.stormWrackSlot(s, s.start), 0);
  assert.equal(E.stormWrackSlot(s, s.start + E.STORM_WRACK_MS - 1), 0);
  assert.equal(E.stormWrackSlot(s, s.start + E.STORM_WRACK_MS), 1);
});

test('SEA-EVENTS the storm\'s wrack and lightning: a cask one of the sea\'s goods, as many as the band\'s strand; a strike a quarter of the time, its shares of hull and canvas, a fifth of them alight; laid on a ship afloat alone, never under her last timber (mutants: the yield, the chance, the shares, the floor, the state)', () => {
  const seenGoods = new Set();
  for (let slot = 0; slot < 40; slot++) {
    const w = E.wrackOf(77, slot, 'abyss', STRAND_YIELD);
    assert.ok(ETHER_GOODS.includes(w.good));
    assert.equal(w.n, STRAND_YIELD[3], 'the Abyss\'s yield');
    assert.equal(E.wrackOf(77, slot, 'abyss', STRAND_YIELD).good, w.good, 'the slot\'s own');
    seenGoods.add(w.good);
  }
  assert.equal(seenGoods.size, ETHER_GOODS.length, 'every good of the sea');
  assert.equal(E.wrackOf(77, 0, 'deep', STRAND_YIELD).n, STRAND_YIELD[2]);
  assert.equal(E.wrackOf(77, 0, 'nowhere', STRAND_YIELD).n, STRAND_YIELD[0], 'an unknown band the Shallows\' first');
  assert.equal(typeof E.wrackOf(77, 0, 'deep', STRAND_YIELD).rolls, 'function');
  assert.deepEqual([E.STORM_STRIKE_CHANCE, E.STORM_STRIKE.hull, E.STORM_STRIKE.sail, E.STORM_STRIKE.fire], [0.25, 0.04, 0.08, 0.2]);
  const seq = (...v) => { let i = 0; return () => v[i++]; };
  assert.equal(E.stormStrikeOf(seq(0.25)), null, 'three in four miss');
  assert.deepEqual(E.stormStrikeOf(seq(0.24, 0.5)), { hull: 0.04, sail: 0.08, fire: false });
  assert.deepEqual(E.stormStrikeOf(seq(0.1, 0.19)), { hull: 0.04, sail: 0.08, fire: true });
  const d = createShipDamage({ hullHp: 400, sailHp: 200, crew: 20, player: true });
  assert.deepEqual(E.stormHurt(d, { hull: 0.04, sail: 0.08, fire: true }), { hull: 16, sail: 16, crew: 0, fire: true });
  assert.deepEqual(E.stormHurt(createShipDamage({ hullHp: 10, sailHp: 0, crew: 1 }), { hull: 0.04, sail: 0.08, fire: false }), { hull: 1, sail: 0, crew: 0, fire: false }, 'at least a timber; no canvas, none');
  assert.equal(E.strikeShip(d, { hull: 0.04, sail: 0.08, fire: false }, 3), true);
  assert.deepEqual([d.hull, d.sail, d.fires], [384, 184, 0]);
  const low = createShipDamage({ hullHp: 400, sailHp: 200, crew: 20, player: true });
  low.apply({ hull: 399, sail: 0, crew: 0 }, 0);
  assert.equal(E.strikeShip(low, { hull: 0.04, sail: 0.08, fire: false }, 1), true);
  assert.equal(low.hull, 1, 'never under her last timber by it alone');
  assert.equal(low.state, SHIP_STATES.afloat);
  const wreck = createShipDamage({ hullHp: 40, sailHp: 20, crew: 2, player: true });
  wreck.apply({ hull: 40, sail: 0, crew: 0 }, 0);
  assert.equal(E.strikeShip(wreck, { hull: 0.04, sail: 0.08, fire: false }, 1), false, 'a wreck is no ship to strike');
  assert.equal(E.strikeShip(null, { hull: 0.04 }, 1), false);
  assert.equal(E.strikeShip(d, null, 1), false);
});

test('SEA-EVENTS the fleet\'s law: a sailing each three hours, under way ninety minutes from the first hour; mustered in the Deep Aether or the Abyss\'s first leagues, bound east at a convoy\'s way; a merchant carrack and her band\'s corsair escorts, the sailing\'s own seeds and name; its purse its band\'s (mutants: the offset, the sail, the waters, the route, the ships, the purse, the window)', () => {
  assert.deepEqual([E.FLEET_OFFSET_MS, E.FLEET_SAIL_MS, E.FLEET_MPS, E.FLEET_ABYSS_LEAGUES], [3_600_000, 5_400_000, 5, 80]);
  assert.deepEqual({ ...E.FLEET_PURSE }, { deep: 6000, abyss: 12000 });
  assert.equal(E.FLEET_FLAGSHIP, 'merchantCarrack');
  assert.deepEqual(JSON.parse(JSON.stringify(E.FLEET_ESCORTS)), { deep: ['pirateBrig', 'pirateGalley'], abyss: ['pirateFlagship', 'pirateGalley', 'pirateBrig'] });
  const deep = BANDS.find((b) => b.id === 'deep'), abyss = BANDS.find((b) => b.id === 'abyss');
  const len = (E.FLEET_MPS * E.FLEET_SAIL_MS) / 1000 / E.PX_M;
  const bands = new Set(), names = new Set();
  for (let n = 500; n < 560; n++) {
    const f = E.fleetOf(n);
    assert.deepEqual(f, E.fleetOf(n), 'the same every call');
    assert.equal(f.start, n * P + E.FLEET_OFFSET_MS);
    assert.equal(f.end, f.start + E.FLEET_SAIL_MS);
    const [x0, x1] = f.band === 'deep' ? [VEIL_X - abyss.from * LEAGUE_PX, VEIL_X - deep.from * LEAGUE_PX] : [VEIL_X - (abyss.from + E.FLEET_ABYSS_LEAGUES) * LEAGUE_PX, VEIL_X - abyss.from * LEAGUE_PX];
    assert.ok(f.from.x >= x0 && f.from.x <= x1, `mustered in its band: ${f.band} ${f.from.x}`);
    assert.equal(etherBandAt(f.from.x).id, f.band);
    assert.ok(Math.abs(f.from.y - veilhaven().py) <= HAUNT_SPREAD.deep);
    assert.ok(Math.abs(Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) - len) < 1e-9, 'a convoy\'s way over its sail');
    assert.ok(f.to.x > f.from.x && Math.abs(Math.atan2(f.to.y - f.from.y, f.to.x - f.from.x)) <= 0.3 + 1e-9, 'bound east, give or take');
    assert.deepEqual(f.ships.map((s) => s.classId), [E.FLEET_FLAGSHIP, ...E.FLEET_ESCORTS[f.band]]);
    assert.deepEqual(f.ships.map((s) => s.flag), [true, ...E.FLEET_ESCORTS[f.band].map(() => false)]);
    assert.deepEqual(f.ships.map((s) => s.station), E.FLEET_STATIONS.slice(0, f.ships.length));
    assert.equal(new Set(f.ships.map((s) => s.seed)).size, f.ships.length, 'a seed each');
    assert.equal(f.purse, E.FLEET_PURSE[f.band]);
    assert.ok(typeof f.name === 'string' && f.name.length > 0);
    bands.add(f.band); names.add(f.name);
  }
  assert.deepEqual([...bands].sort(), ['abyss', 'deep'], 'both bands sail');
  assert.ok(names.size > 3);
  const f = E.fleetOf(500);
  assert.equal(E.fleetAt(f.start - 1), null, 'in port');
  assert.deepEqual(E.fleetAt(f.start), f);
  assert.equal(E.fleetAt(f.end), null, 'made port');
  assert.equal(E.fleetAt(NaN), null);
  assert.deepEqual(E.nextFleet(f.start - 1), f, 'this sailing\'s while it lies in port');
  assert.deepEqual(E.nextFleet(f.start + 1), E.fleetOf(501), 'the next once it has sailed');
  assert.deepEqual(E.fleetPlace(f, f.start).x, f.from.x);
  assert.deepEqual(E.fleetPlace(f, f.end + 9e9).x, f.to.x, 'held at its end');
  const h = E.fleetPlace(f, f.start + E.FLEET_SAIL_MS / 2);
  assert.ok(Math.abs(h.x - (f.from.x + f.to.x) / 2) < 1e-9);
  assert.ok(Math.abs(h.yaw - Math.atan2(f.to.x - f.from.x, -(f.to.y - f.from.y))) < 1e-12 && h.yaw > 0.9 && h.yaw < 2.3, 'her heading east, the map\'s north 0');
  assert.equal(E.fleetBandAt(f, f.start), f.band);
  assert.ok(Math.abs(E.PX_M - 819.2) < 0.01);
});

/** A fake naval sea for the fleet's module: ships launched where asked, the captain at `me`. */
function navalSea({ me = [0, 0, 0], launches = true, water = () => true } = {}) {
  const sea = new Map(), out = { gave: [], said: [], ended: [], retired: [] };
  let n = 0;
  const ship = (spec, owner = null) => ({ id: `${owner ?? 'me'}:${++n}`, owner, ship: { seed: spec.seed >>> 0, pos: [...spec.pos], course: null, mode: 'cruise', names: { name: `Ship ${spec.seed}` }, damage: { state: SHIP_STATES.afloat } }, ether: spec.ether, classId: spec.classId });
  const st = { me, launches, busy: new Set(), paid: 12000 };
  const fleet = createTreasureFleet({
    sea, launch: (spec) => { const e = ship(spec); sea.set(e.id, e); return e; }, retire: (e) => { e.retiring = true; out.retired.push(e.id); }, busy: (e) => st.busy.has(e.id),
    feet: () => st.me, isWater: (x, z) => water(x, z), seaY: () => 0, launches: () => st.launches,
    give: (items) => out.gave.push(...items), say: (text) => out.said.push(text), fleetEnded: (k, act) => { out.ended.push([k, act]); return st.paid; },   // PIN MOVED (AUDIT SEA VENTURES D2): the world answers her purse
  });
  return { sea, fleet, out, st, peer: (spec) => { const e = ship(spec, 'peer'); sea.set(e.id, e); return e; } };
}
const LIST = (n = 7, band = 'abyss') => ({ n, band, ships: [{ seed: 11, classId: 'merchantCarrack', flag: true, pos: [100, 0, 0], ahead: [100, 0, 300], yaw: 0 }, { seed: 12, classId: 'pirateBrig', flag: false, pos: [-160, 0, -180], ahead: [-160, 0, 120], yaw: 0 }, { seed: 13, classId: 'pirateGalley', flag: false, pos: [5000, 0, 0], ahead: [5000, 0, 300], yaw: 0 }] });

test('SEA-EVENTS the fleet at sea (treasureFleet.js): her ships within FLEET_STAND_M stood once each, by the one who stands the traffic, never one spent or one a peer stands, none while the flagship is down; each steers her station; past FLEET_DROP_M let go unless she fights (mutants: the reach, the once, the spent, the peer, the launcher, the sunk, the steer, the drop)', () => {
  assert.deepEqual([FLEET_STAND_M, FLEET_DROP_M], [1200, 1700]);
  const s = navalSea();
  s.fleet.step(LIST());
  assert.deepEqual([...s.sea.values()].map((e) => [e.ship.seed, e.classId, e.ether, e.fleet]), [[11, 'merchantCarrack', 'abyss', { n: 7, seed: 11, flag: true }], [12, 'pirateBrig', 'abyss', { n: 7, seed: 12, flag: false }]], 'the two within reach, tagged');
  assert.deepEqual([...s.sea.values()].map((e) => e.ship.course), [[100, 300], [-160, 120]], 'each steers her station on');
  s.fleet.step(LIST());
  assert.equal(s.sea.size, 2, 'once each');
  [...s.sea.values()][1].ship.damage.state = SHIP_STATES.sinking;
  s.fleet.step(LIST());
  s.sea.delete([...s.sea.keys()][1]);
  s.fleet.step(LIST());
  assert.equal(s.sea.size, 1, 'a ship spent is never stood again');
  assert.ok(s.fleet.spent().has(12));
  s.fleet.step(LIST(8));
  assert.equal(s.sea.size, 2, 'a new sailing: the spent forgotten (her seed stood again)');
  const p = navalSea();
  p.peer({ seed: 11, classId: 'merchantCarrack', pos: [100, 0, 0], ether: 'abyss' });
  p.fleet.step(LIST());
  assert.deepEqual([...p.sea.values()].map((e) => [e.owner, e.ship.seed]), [['peer', 11], [null, 12]], 'a peer\'s copy stands her: never twice');
  assert.deepEqual([...p.sea.values()][0].fleet, { n: 7, seed: 11, flag: true }, 'the peer\'s copy known by her seed');
  assert.equal([...p.sea.values()][0].ship.course, null, 'a peer\'s copy is the peer\'s to steer');
  const r = navalSea();
  r.fleet.step({ ...LIST(), ships: [{ ...LIST().ships[1], pos: [-1500, 0, 0] }] });
  assert.equal(r.sea.size, 0, 'past FLEET_STAND_M, never stood (though short of FLEET_DROP_M)');
  r.fleet.step({ ...LIST(), ships: [{ ...LIST().ships[1], pos: [-1190, 0, 0] }] });
  assert.equal(r.sea.size, 1, 'within it, stood');
  const q = navalSea({ launches: false });
  q.fleet.step(LIST());
  assert.equal(q.sea.size, 0, 'another captain stands the traffic here');
  const k = navalSea();
  k.fleet.step(LIST(), { sunk: true });
  assert.equal(k.sea.size, 0, 'a sailing scattered stands none');
  const w = navalSea({ water: (x) => x < 0 });
  w.fleet.step(LIST());
  assert.deepEqual([...w.sea.values()].map((e) => e.ship.seed), [12], 'never one where her hull has no water');
  const d = navalSea();
  d.fleet.step(LIST());
  const [flag, brig] = [...d.sea.values()];
  d.st.me = [3000, 0, 0];
  d.st.busy.add(brig.id);
  d.fleet.step(LIST());
  assert.deepEqual(d.out.retired, [flag.id], 'past FLEET_DROP_M let go - one fighting kept');
  d.st.me = [0, 0, 0];
  d.fleet.step(LIST());
  assert.equal(flag.retiring, false, 'back in reach as she faded: she stays');
  d.fleet.step(null);
  assert.equal(flag.ship.course, null, 'the sailing over: no station to keep');
});

test('SEA-EVENTS the flagship\'s spoils (treasureFleet.js ended): sunk or taken, a Tidemail piece every time into the boat I sail and said, and the world told; an escort, or a ship merely struck, none (mutants: the flag, the act, the piece, the word)', () => {
  const s = navalSea();
  s.fleet.step(LIST());
  const [flag, brig] = [...s.sea.values()];
  assert.equal(s.fleet.ended(brig, 'sink'), null, 'an escort');
  assert.equal(s.fleet.ended(flag, 'strike'), null, 'struck, not ended');
  assert.equal(elthericChance('fleet', 'abyss'), 1);
  const piece = s.fleet.ended(flag, 'board');
  assert.ok(piece && ELTHERIC_SET_PIECES.some((r) => r.name === piece.name), 'a piece of the Tidemail');
  assert.deepEqual(s.out.gave, [piece]);
  assert.match(s.out.said[0], /From the treasure fleet's flagship Ship 11: .+, a piece of The Eltheric Tidemail!/);
  assert.deepEqual(s.out.ended, [[7, 'board']]);
  assert.ok(s.fleet.spent().has(11));
  assert.equal(s.fleet.ended(null, 'sink'), null);
});

/** The sea's host over fake deps at the shared clock `t.now`, the player at `t.px`. */
function ventures(t) {
  const said = [], mids = [], credits = [], sent = [], fed = [], strikes = [];
  const naval = { fleet: (list, o) => fed.push([list, o]), stormStrike: (k) => { strikes.push(k); return t.hit ?? true; } };
  const link = { wdunSeaOk: t.seaOk ?? true, status: 'open', sendWdun: (w) => { sent.push(w); return true; } };
  const sea = createSeaVentures({
    live: () => false, day: () => 0, pixel: () => t.px, locks: new Map(), crows: new Map(), mine: () => null,
    clock: () => t.now, naval: () => naval, state: STATE, link: () => link,
    ether: { credit: (n) => credits.push(n), mid: (s) => mids.push(s), say: (s) => said.push(s) },
  });
  return { sea, said, mids, credits, sent, fed, strikes };
}
/** A storm's moment and a pixel inside it (its middle within the reach), and one outside. */
function inStorm(n = 1000) {
  const s = E.stormOf(n), now = s.start + 600_000, e = E.stormEye(s, now);
  return { s, now, inside: { x: Math.floor(e.x), y: Math.floor(e.y) }, outside: { x: Math.floor(e.x + 60), y: Math.floor(e.y) } };
}

test('SEA-EVENTS the storm at the host (seaVenturesHost.js): its thunder the shown weather while the player stands in it, turned once each way (the world\'s short front); its wrack a strand\'s cask a slot, hauled once - a good of the sea by the band and on its share a piece of the Tidemail; its words in and out, and its lightning on the ship I sail (mutants: the word, the turn, the slot, the once, the goods, the strike, the words)', () => {
  const { s, now, inside, outside } = inStorm();
  const t = { now, px: outside };
  const v = ventures(t);
  assert.equal(v.sea.stormWord(), null);
  v.sea.stormTurned();
  assert.equal(seaStormShown(), null);
  t.px = inside;
  assert.equal(v.sea.stormWord(), 'thunder');
  assert.equal(v.sea.stormTurned(), true, 'into it: turned');
  assert.equal(seaStormShown(), 'thunder', 'the world\'s shown weather');
  assert.equal(v.sea.stormTurned(), false, 'once');
  t.now = s.end;
  assert.equal(v.sea.stormTurned(), true, 'blown out: turned back');
  assert.equal(seaStormShown(), null);
  t.now = now;
  const sites = v.sea.wrackSites(inside.x, inside.y);
  const slot = E.stormWrackSlot(s, now);
  assert.deepEqual(sites.map((x) => [x.id, x.kind, x.px, x.py, x.n]), [[`${WRACK_SITE}${s.n}:${slot}`, 'strand', inside.x, inside.y, 1]]);
  assert.equal(sites[0].word, 'The storm throws up wrack. A cask bobs in the swell alongside.');
  assert.deepEqual(v.sea.wrackSites(outside.x, outside.y), [], 'none outside it');
  assert.equal(v.sea.gather('strand:4,5'), null, 'an isle\'s strand is the ether host\'s');
  const g = v.sea.gather(sites[0].id);
  const band = etherBandAt(inside.x).id, w = E.wrackOf(s.n, slot, band, STRAND_YIELD);
  assert.equal(g.items[0].stackCount, w.n);
  assert.match(g.text, new RegExp(`^${w.n} \\w+ of [a-z ]+ from the storm's wrack\\.`));
  assert.deepEqual(v.sea.gather(sites[0].id), { items: [], text: '' }, 'hauled once');
  assert.deepEqual(v.sea.wrackSites(inside.x, inside.y), [], 'its slot spent');
  t.now = now + E.STORM_WRACK_MS;
  assert.equal(v.sea.wrackSites(inside.x, inside.y).length, 1, 'the next slot\'s cask');
  let tidemail = 0;
  for (let k = 0; k < 400; k++) if (v.sea.gather(`${WRACK_SITE}${s.n}:${1000 + k}`).items.length > 1) tidemail++;
  assert.ok(tidemail > 0 && tidemail < 60, `a piece now and then (${tidemail} of 400)`);
  // the words and the lightning, in the frame's step
  t.now = now; t.px = outside;
  const u = ventures(t);
  u.sea.step(0);
  assert.equal(u.mids.filter((m) => /^An Aether storm gathers to the [a-z-]+ \(The (Deep Aether|Abyss)\)\.$/.test(m)).length, 1, 'the storm gathering, said once');
  t.px = inside;
  u.sea.step(3);
  assert.deepEqual(u.said.filter((m) => /sail into the Aether storm/.test(m)).length, 1);
  const realRandom = Math.random;
  try {
    Math.random = () => 0.1;
    u.sea.step(5);
    assert.equal(u.strikes.length, 1, 'a new strike looked for: it finds her');
    assert.match(u.said.at(-1), /Lightning strikes your ship and sets her alight!/);
    u.sea.step(5);
    assert.equal(u.strikes.length, 1, 'no new strike, none');
    Math.random = () => 0.9;
    u.sea.step(6);
    assert.equal(u.strikes.length, 1, 'three in four miss');
    Math.random = () => 0.1;
    t.px = outside;
    u.sea.step(9);
    assert.equal(u.strikes.length, 1, 'outside it, no strike - whatever the dice');
  } finally { Math.random = realRandom; }
  assert.equal(u.mids.filter((m) => /^An Aether storm gathers to the/.test(m)).length, 1, 'the storm gathering said once, every step after');
  assert.ok(u.said.some((m) => m === 'You sail out of the Aether storm.'));
  t.px = { x: 500, y: 250 };
  const [nSaid, nMids, nStrikes] = [u.said.length, u.mids.length, u.strikes.length];
  t.now = E.stormOf(1001).start + 1000;
  u.sea.step(50);
  assert.deepEqual([u.said.length, u.mids.length, u.strikes.length], [nSaid, nMids, nStrikes], 'off the sea, nothing said and nothing struck');
});

test('SEA-EVENTS the fleet at the host: fed to the naval host FLEET_FEED_MS apart, each ship at her station in the scene and FLEET_LEAD_MS on; scattered by the hub\'s word or my hand - her purse, the hub told, the scattering said to the sea; its sailing said once (mutants: the feed, the stations, the sunk, the purse, the word, the hub)', () => {
  assert.deepEqual([FLEET_FEED_MS, FLEET_LEAD_MS], [500, 60_000]);
  const f = E.fleetOf(92592 * 1 + 1), now = f.start + 1_800_000, at = E.fleetPlace(f, now);
  const t = { now, px: { x: Math.floor(at.x), y: Math.floor(at.y) } };
  const v = ventures(t);
  const list = v.sea.fleetList(now);
  assert.equal(list.n, f.n);
  assert.equal(list.band, f.band);
  const scene = (p) => STATE.localFromWorld(p.x * NP, (500 - p.y) * NP);
  const [ax, az] = scene(at), [bx, bz] = scene(E.fleetPlace(f, now + FLEET_LEAD_MS));
  const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
  assert.ok(near(list.ships[0].pos, [ax, 0, az]), 'the flagship at the route\'s place');
  assert.ok(near(list.ships[0].ahead, [bx, 0, bz]), 'and steering for it FLEET_LEAD_MS on');
  const L0 = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L0, dz = (bz - az) / L0;
  assert.ok(Math.abs(L0 - E.FLEET_MPS * FLEET_LEAD_MS / 1000) < 1e-6, 'a convoy\'s way, in metres');
  assert.ok(near(list.ships[1].pos, [ax + dz * -260 - dx * 180, 0, az - dx * -260 - dz * 180]), 'an escort at her station: abeam and astern');
  assert.ok(Math.abs(list.ships[1].yaw - Math.atan2(dx, dz)) < 1e-12);
  assert.equal(v.sea.fleetList(f.start - 1), null, 'in port');
  t.px = { x: 500, y: 250 };
  assert.equal(v.sea.fleetList(now), null, 'off the sea');
  t.px = { x: Math.floor(at.x), y: Math.floor(at.y) };
  v.sea.step(0);
  assert.equal(v.fed.length, 1);
  assert.equal(v.fed[0][0].n, f.n);
  assert.deepEqual(v.fed[0][1], { sunk: false });
  assert.equal(v.mids.filter((m) => m.startsWith('A treasure fleet weighs anchor (')).length, 1, 'its sailing said');
  t.now += FLEET_FEED_MS - 1;
  v.sea.step(0);
  assert.equal(v.fed.length, 1, 'FLEET_FEED_MS apart');
  t.now += 1;
  v.sea.step(0);
  assert.equal(v.fed.length, 2);
  assert.equal(v.mids.filter((m) => m.startsWith('A treasure fleet weighs anchor (')).length, 1, 'once a sailing');
  // the hub's word: scattered by another
  assert.equal(v.sea.hubWord({ k: 'cr', crows: [] }), false);
  assert.equal(v.sea.hubWord({ k: 'fd', fleets: [f.n] }), true);
  assert.ok(v.mids.includes('The treasure fleet\'s flagship has gone down. The fleet scatters.'));
  t.now += FLEET_FEED_MS;
  v.sea.step(0);
  assert.deepEqual(v.fed.at(-1)[1], { sunk: true }, 'the naval host stands none of it');
  assert.equal(v.sea.chartWord().fleet.sunk, true);
  assert.equal(v.sea.hubWord({ k: 'st', fleets: [] }), false, 'the hello\'s word read, the world\'s to read too');
  assert.equal(v.sea.chartWord().fleet.sunk, false, 'the hub\'s word is the record');
  // my hand: her purse, the hub told
  assert.equal(v.sea.fleetEnded(f.n, 'sink'), f.purse);
  assert.deepEqual(v.credits, [f.purse]);
  assert.deepEqual(v.sent, [{ k: 'fk', n: f.n }]);
  assert.equal(v.mids.at(-1), `The ${f.name} is sunk! ${f.purse} gold floats up from her strongroom.`);
  // PIN MOVED (AUDIT SEA VENTURES D2): a second end of the same sailing pays nothing and says nothing - her purse once a sailing
  assert.equal(v.sea.fleetEnded(f.n, 'board'), 0);
  assert.deepEqual(v.credits, [f.purse], 'paid once');
  assert.equal(v.mids.at(-1), `The ${f.name} is sunk! ${f.purse} gold floats up from her strongroom.`);
  const taken = ventures({ ...t });
  taken.sea.fleetEnded(f.n, 'board');
  assert.equal(taken.mids.at(-1), `The ${f.name} is taken! ${f.purse} gold from her strongroom.`);
  assert.equal(v.sea.chartWord().fleet.sunk, true);
  v.sea.hubWord({ k: 'st', fleets: [] });
  assert.equal(v.sea.chartWord().fleet.sunk, true, 'D5: the hub\'s hello never puts my own sinking out');
  const old = ventures({ ...t, seaOk: false });
  old.sea.fleetEnded(f.n, 'sink');
  assert.deepEqual(old.sent, [], 'an older relay is never asked');
  assert.deepEqual(old.credits, [f.purse], 'her purse paid all the same');
});

test('SEA-EVENTS the chart\'s word and the harbourmaster\'s talk: the storm\'s eye and reach, the fleet\'s place, heading and route; a freeport\'s rumours - the fleet under way or the next to sail, the storm blowing or the next to gather, each its way and minutes (mutants: the word, the rumours)', () => {
  const { s, now } = inStorm(1000);
  const v = ventures({ now, px: { x: 8000, y: -5185 } });
  const w = v.sea.chartWord();
  const e = E.stormEye(s, now);
  assert.deepEqual(w.storm, { n: s.n, x: e.x, y: e.y, r: E.STORM_R_PX });
  const f = E.fleetAt(now);
  if (f) assert.deepEqual([w.fleet.n, w.fleet.name, w.fleet.band, w.fleet.from, w.fleet.to], [f.n, f.name, f.band, f.from, f.to]);
  else assert.equal(w.fleet, null);
  const port = { px: 8068, py: -5185 };
  const r = v.sea.rumours(port);
  assert.equal(r.length, 2);
  assert.match(r[1], /^An Aether storm is blowing [a-z-]+ of here\. It blows itself out in 40 minutes\.$/);
  const quiet = ventures({ now: s.end + 60_000, px: { x: 8000, y: -5185 } });
  const q = quiet.sea.rumours(port);
  assert.match(q[1], /^Sailors say an Aether storm will gather [a-z-]+ of here in 69 minutes\.$/);
  const g = E.fleetOf(9000), at = ventures({ now: g.start + 600_000, px: { x: 8000, y: -5185 } });
  assert.match(at.sea.rumours(port)[0], new RegExp(`^A treasure fleet is under way \\(The (Deep Aether|Abyss)\\): the ${g.name} and her escorts, [a-z-]+ of here and bound east\\. It makes port in 80 minutes\\.$`));
  const before = ventures({ now: g.start - 120_000, px: { x: 8000, y: -5185 } });
  assert.match(before.sea.rumours(port)[0], /^The next treasure fleet weighs anchor in 2 minutes \(The (Deep Aether|Abyss)\), [a-z-]+ of here\.$/);
});

test('SEA-EVENTS the chart: the storm a violet ring about its eye, named once wide enough; the fleet a gold hull on her heading over her route, named, crossed when scattered; each keyed while the word carries it (mutants: the ring, the name, the hull, the route, the key)', () => {
  const W = 1000, H = 600;
  const word = { px: 7700, py: -5100, yaw: 0, charted: [], legends: [], stats: {}, storm: { n: 1, x: 7700, y: -5100, r: 40 }, fleet: { n: 2, x: 7720, y: -5100, yaw: Math.PI / 2, from: { x: 7710, y: -5100 }, to: { x: 7740, y: -5100 }, band: 'deep', name: 'Quiet Wind', sunk: false } };
  const view = { cx: 7700, cy: -5100, zoom: 1 };
  const k = M.CHART_ZOOMS[1];
  const m = M.chartModel(word, view, W, H);
  assert.deepEqual(m.storm, { x: W / 2, y: H / 2, r: 40 * k, named: 40 * k >= M.STORM_NAME_R });
  assert.deepEqual([m.fleet.x, m.fleet.y, m.fleet.yaw, m.fleet.sunk, m.fleet.on], [W / 2 + 20 * k, H / 2, Math.PI / 2, false, true]);
  assert.deepEqual([m.fleet.from, m.fleet.to], [[W / 2 + 10 * k, H / 2], [W / 2 + 40 * k, H / 2]]);
  assert.equal(m.fleet.name, 'Treasure fleet: Quiet Wind');
  assert.equal(M.chartModel({ ...word, fleet: { ...word.fleet, sunk: true } }, view, W, H).fleet.name, 'Treasure fleet (scattered)');
  assert.equal(M.chartModel({ ...word, storm: null, fleet: null }, view, W, H).storm, null);
  assert.equal(M.chartModel({ ...word, storm: { ...word.storm, x: 9000 } }, view, W, H).storm, null, 'off the canvas');
  assert.equal(M.chartModel(word, { ...view, zoom: 0 }, W, H).storm.named, 40 * M.CHART_ZOOMS[0] >= M.STORM_NAME_R);
  const log = [];
  const g = new Proxy({}, { get: (_, key) => (key === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => log.push([key, ...a])), set: (_, key, val) => { log.push(['=', key, val]); return true; } });
  M.paintChart(g, m, W, H);
  assert.ok(log.some((c) => c[0] === 'arc' && c[1] === W / 2 && c[2] === H / 2 && c[3] === 40 * k), 'the storm\'s ring');
  assert.ok(log.some((c) => c[0] === '=' && c[1] === 'fillStyle' && c[2] === M.STORM_FILL));
  const hull = log.findIndex((c) => c[0] === 'rotate' && c[1] === Math.PI / 2);
  assert.ok(hull >= 0 && log.slice(hull).find((c) => c[0] === '=' && c[1] === 'fillStyle')?.[2] === M.FLEET_INK, 'the fleet\'s gold hull, on her heading');
  const g2log = [];
  const g2 = new Proxy({}, { get: (_, key) => (key === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => g2log.push([key, ...a])), set: (_, key, val) => { g2log.push(['=', key, val]); return true; } });
  M.paintChart(g2, M.chartModel({ ...word, fleet: { ...word.fleet, sunk: true } }, view, W, H), W, H);
  const hull2 = g2log.findIndex((c) => c[0] === 'rotate' && c[1] === Math.PI / 2);
  assert.equal(g2log.slice(hull2).find((c) => c[0] === '=' && c[1] === 'fillStyle')?.[2], '#8c8c98', 'scattered: greyed');
  assert.ok(log.some((c) => c[0] === 'moveTo' && c[1] === W / 2 + 10 * k && c[2] === H / 2), 'its route from its muster');
  assert.ok(log.some((c) => c[0] === 'fillText' && c[1] === 'Treasure fleet: Quiet Wind'), 'named');
  assert.ok(log.some((c) => c[0] === 'fillText' && c[1] === 'AETHER STORM'), 'the storm named');
  assert.deepEqual([...M.CHART_STORM_KEY], ['storm', 'The Aether storm, blowing now']);
  assert.deepEqual([...M.CHART_FLEET_KEY], ['fleet', 'The treasure fleet, under way']);
  const chart = src('src/ui/etherChartWindow.js');
  assert.match(chart, /stormItem\.hidden = !word\.storm; fleetItem\.hidden = !word\.fleet;/);
});

test('SEA-EVENTS the seams by source: the world shows the storm\'s thunder (its weather, its front, its rain, its sky, its wind) as the Sun Baby\'s clear day is shown; the sea\'s host wired over the clock, the naval host, the scene, the hub and the ether host, stepped with the lanes; its wrack among the captain\'s sites and its haul; the hub\'s word; the flagship\'s end; the harbourmaster\'s talk; the naval host\'s fleet, spoils and lightning (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const shownWeather = \(\) => \(sunbaby\.on \? SUNBABY_WEATHER : seaStormShown\(\) \?\? currentWeather\(\)\);/);
  assert.match(w, /weatherType: \(\) => WEATHER_TYPES\.indexOf\(seaStormShown\(\) \?\? currentWeather\(\)\),/);
  assert.match(w, /const crossing = weatherCrossingStamp\(\) !== seenCrossing \|\| seaVentures\.stormTurned\(\);/);
  assert.match(w, /peak: weatherOverride \? null : seaStormShown\(\) \? 1 : currentWeatherIntensity\(\) \}\);/);
  assert.match(w, /violence: weatherOverride \?\? seaStormShown\(\) \?\? currentWeatherRaw\(\),/);
  assert.match(w, /cloudBase: weatherOverride \|\| seaStormShown\(\) \? null : currentCloudBase\(\),/);
  assert.match(w, /clock: \(\) => raidNowMs\(\), naval: \(\) => naval, state, link: socialLink, ether: etherHost,/);   // V4: raidNowMs is declared below the sea's host - read when called
  assert.match(w, /\{ laneShips\(\); seaVentures\.step\(lightning\?\.strikes \?\? 0\); \}/);
  assert.match(w, /const wdunWord = \(w\) => \{\n\s+const now = Date\.now\(\);\n\s+seaVentures\.hubWord\(w\);/);
  assert.match(w, /gather: \(siteId\) => seaVentures\.gather\(siteId\) \?\? etherHost\.gather\(siteId\),/);
  assert.match(w, /fleetEnded: \(n, act\) => seaVentures\.fleetEnded\(n, act\),/);
  assert.match(w, /\.\.\.etherHost\.sites\(p\.x, p\.y\), \.\.\.seaVentures\.wrackSites\(p\.x, p\.y\)\]/);
  assert.match(w, /rumours: \[\.\.\.o\.rumours, \.\.\.seaVentures\.rumours\(port\)\],/);
  const n = src('src/scenes/naval/navalHost.js');
  assert.match(n, /const treasureFleet = createTreasureFleet\(\{/);
  assert.match(n, /fleetEnded: \(n, act\) => deps\.ether\?\.fleetEnded\?\.\(n, act\),/);
  assert.match(n, /treasureFleet\.ended\(entry, act\);/);
  assert.match(n, /fleet: \(list, o\) => \{ if \(enabled\) treasureFleet\.step\(list, o\); \},/);
  assert.match(n, /stormStrike: \(strike\) => strikeShip\(enabled && aboardShip\(\) \? myBoatState\(boatInPlay\(\)\)\?\.damage : null, strike, clock\),/);
  assert.match(n, /deps\.say\?\.\(site\.word \?\? SITE_WORDS\[site\.kind\], 4\)/);
  const eh = src('src/scenes/etherHost.js');
  assert.match(eh, /credit: \(n\) => deps\.credit\?\.\(n\), mid: \(text, s\) => deps\.mid\?\.\(text, s\), say: \(text, s\) => deps\.say\?\.\(text, s\),/);
  assert.match(src('server/src/index.js'), /if \(m\.k === 'fk'\) \{[^\n]*\n\s+if \(a\?\.gu\) return;[^\n]*\n\s+if \(wdunFleetSunk\(st, m\.n, now\)\) \{ await this\._wdunSave\(now, true\); this\._wildFan\(\{ t: 'wdun', k: 'fd', fleets: wdunFleets\(st, now\) \}\); \}/);   // PIN MOVED (AUDIT SEA VENTURES A7): never a guest's
  assert.ok(inEther(8000, -5100));
});
