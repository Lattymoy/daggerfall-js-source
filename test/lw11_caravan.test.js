// LW11 (bible/06-Systems/Living-World-II.md "LW11"): THE CARAVAN'S DOOR - the counter a caravan's merchant, a pedlar or
// a carter keeps on the road (its kind, quality, purse; its roll the same all trip, what the character bought or took
// gone from it for good), the deeds against a party reported and charged to the road's region when a witness reaches a
// town (void when none lives to), the hold-up (a party whose armed are all down yields), the escort (hired on, kept by
// staying near, paid at the town, broken by falling behind); the character's road records; the host's windows. Pure and
// synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  counterOf, purseOf, keepsCounter, reportAt, yields, escortOffer, escortPay, escortNear, COUNTERS, CARAVAN_QUALITY, PURSE_PER_QUALITY, FRIEND_DISCOUNT,
  ESCORT_OFFER_MIN, ESCORT_GOLD_DAY, ESCORT_GOLD_LEVEL, ESCORT_FIGHT, ESCORT_KEEP_M, ESCORT_LOST_MIN, ESCORT_SAMPLE_MIN, ESCORT_STILL_M, WARE_KEY,
} from '../src/systems/livingWorld/caravanDoor.js';
import { createCaravanHost, CARAVAN_LINES, travellerOf, tripOfId } from '../src/scenes/caravanHost.js';
import { createRelations, WARES_MAX, REPORTS_MAX } from '../src/systems/livingWorld/relations.js';
import { travellerRoster, mintResident } from '../src/systems/livingWorld/census.js';
import { placeAt } from '../src/systems/livingWorld/lives.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { townTrips, partyAt, CALENDAR_MPM, NATIVE_PER_M, WALK_FROM_H, WALK_TO_H } from '../src/systems/livingWorld/trips.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { partyLabel } from '../src/scenes/livingRoads.js';
import { CRIMES } from '../src/systems/crimes.js';

const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
const town = (mapId, px, py, blocks) => ({ mapId, px, py, blocks, type: 0, region: 17, people: 3, name: `T${mapId}`, port: false });
function miniWorld(towns) {
  const rosters = new Map();
  return {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf: (a, b) => {
      const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
      const pixels = [];
      for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
      return { pixels, kinds: pixels.slice(1).map(() => 'road') };
    },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
    dryAt: () => true,
  };
}
/** The merchants' caravans of a town of 24 blocks bound for one of 20 eight pixels east, by their ids. */
function caravans() {
  const a = town(901, 100, 100, 24), b = town(902, 108, 100, 20);
  const world = miniWorld([a, b]);
  const got = new Map();
  for (let day = 0; day < 40; day++) for (const tr of townTrips(a, day * 1440 + 720, world, O()) ?? []) if (tr.kind === 'merchant') got.set(tr.id, tr);
  return { world, trips: [...got.values()], a, b };
}
/** A caravan with an armed hand. */
const armedCaravan = () => caravans().trips.find((tr) => tr.party.length >= 2 && tr.party.some((m) => m.cls != null) && !tr.enc);
/** A minute the party walks on the way out (by day, past its town). */
const walkingOut = (trip) => {
  for (let t = Math.ceil(trip.outT0); t < trip.outT1; t += 10) { const at = partyAt(trip, t); if (at.phase === 'out' && !at.camp && !at.halt && !at.fight) return t; }
  throw new Error('never walking');
};

test('LW11 the counter: a caravan\'s merchant and a carter keep a general store\'s, a pedlar a pawnbroker\'s, nobody else one; its quality 6 and one each four blocks of its town (1 to 20), its purse PURSE_PER_QUALITY a quality; its name its keeper\'s (mutants: each kind, the quality, the purse)', () => {
  assert.deepEqual({ ...COUNTERS }, { merchant: BUILDING_TYPES.GeneralStore, carter: BUILDING_TYPES.GeneralStore, pedlar: BUILDING_TYPES.PawnShop });
  assert.equal(PURSE_PER_QUALITY, 300);
  assert.deepEqual([0, 3, 4, 24, 55, 56, 200].map((blocks) => CARAVAN_QUALITY({ from: { blocks } })), [6, 6, 7, 12, 19, 20, 20]);
  const m = counterOf({ kind: 'merchant', from: { blocks: 24 }, leader: { name: 'Ana Wode' } });
  assert.deepEqual(m, { buildingType: BUILDING_TYPES.GeneralStore, quality: 12, name: "Ana Wode's caravan", purse: 3600 });
  assert.equal(counterOf({ kind: 'pedlar', from: { blocks: 1 }, leader: { name: 'Pol' } })?.name, "Pol's pack");
  assert.equal(counterOf({ kind: 'pedlar', from: { blocks: 1 }, leader: { name: 'Pol' } })?.buildingType, BUILDING_TYPES.PawnShop);
  assert.equal(counterOf({ kind: 'carter', from: { blocks: 1 }, leader: { name: 'C' } })?.purse, 1800);
  for (const kind of ['adventurer', 'pilgrim', 'courier', 'patrol', 'noble', 'retainer', 'hunter', 'minstrel', 'sailor']) assert.equal(counterOf({ kind, from: { blocks: 40 }, leader: {} }), null, kind);
  assert.equal(purseOf(0), PURSE_PER_QUALITY, 'never an empty purse');
});

test('LW11 who keeps it: the trip\'s leader, standing, on the road out or home and not in a fight - never a hand, never at home before it sets out or after it is in (mutants: the leader, the phase, the fight)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const hand = trip.party.find((m) => m.id !== trip.leader.id);
  assert.equal(keepsCounter(trip, trip.leader, t), true);
  assert.equal(keepsCounter(trip, hand, t), false, 'a hand keeps no counter');
  assert.equal(keepsCounter(trip, trip.leader, trip.outT0 - 60), false, 'at home, before it sets out');
  assert.equal(keepsCounter(trip, trip.leader, trip.backT1 + 60), false, 'home again');
  assert.equal(keepsCounter(trip, trip.leader, (trip.outT1 + trip.backT0) / 2), false, 'in the town it went to, no counter on the road');
  const home = (() => { for (let x = Math.ceil(trip.backT0); x < trip.backT1; x += 10) { const at = partyAt(trip, x); if (at.phase === 'back' && !at.camp) return x; } return null; })();
  assert.ok(home != null && keepsCounter(trip, trip.leader, home), 'on the way home too');
  // AUDIT LW-II (the tests): THE FIGHT A REAL ENCOUNTER'S - the hand-built one had no halt, so `at.fight` never stood and
  // the pin asserted nothing (trouble.js troubleOf, a hand fated: the trouble always comes; troubledTrip its halt)
  const enc = troubleOf(trip, { climateAt: () => 0, foesOf: ({ size }) => Array(size).fill(10), dies: (m) => m.id === hand.id });
  assert.ok(enc && (enc.leg === 'out' || enc.leg === 'back'), 'a trouble on the road');
  const fought = troubledTrip(trip, enc);
  const tf = Math.ceil(enc.t0) + 1;
  assert.equal(partyAt(fought, tf).fight, true, 'at its fight');
  assert.equal(keepsCounter(fought, fought.leader, tf), false, 'never in a fight');
  assert.equal(keepsCounter(fought, fought.leader, Math.ceil(enc.fightEnd) + 1), true, 'the fight done, its halt kept');
  const fallen = { ...trip, fallen: [{ res: trip.leader, t: t - 1 }] };
  assert.equal(keepsCounter(fallen, trip.leader, t), false, 'the fallen keep nothing');
});

test('LW11 where a witness carries it: the town the party set out for on the way out, home on the way back or once it has turned (mutants: the cut, the turned)', () => {
  const trip = { outT1: 100, backT1: 300 };
  assert.equal(reportAt(trip, 50), 100);
  assert.equal(reportAt(trip, 99), 100);
  assert.equal(reportAt(trip, 100), 300);
  assert.equal(reportAt(trip, 200), 300);
  assert.equal(reportAt({ ...trip, turned: true }, 50), 300, 'turned home: home');
});

test('LW11 the hold-up: a party whose armed the road left it are all down by the host\'s word (the player\'s hand), its leader standing, yields; a party of none armed never does, nor one whose leader is down, nor one whose guards the road took (mutants: the armed, the leader, the word, the road\'s fallen)', () => {
  const lead = { id: 'L', cls: null }, a = { id: 'A', cls: 144 }, b = { id: 'B', cls: 141 }, p = { id: 'P', cls: null };
  const trip = { party: [lead, a, b, p], leader: lead };
  const beaten = (m) => m.cls != null;
  assert.equal(yields(trip, 10), false, 'all standing');
  assert.equal(yields(trip, 10, beaten), true, 'its armed beaten');
  assert.equal(yields(trip, 10, (m) => m.id === 'A'), false, 'one armed still up');
  // PIN MOVED (AUDIT LW-II C4): the trip's own fallen are the road's - a party whose guards the dice took had nobody for
  // the player to beat, and yielded to whoever passed
  assert.equal(yields({ ...trip, fallen: [{ res: a, t: 5 }, { res: b, t: 6 }] }, 10), false, 'its guards the road\'s: nothing beaten');
  assert.equal(yields({ ...trip, fallen: [{ res: a, t: 5 }, { res: b, t: 6 }] }, 10, beaten), false);
  assert.equal(yields({ ...trip, fallen: [{ res: a, t: 5 }, { res: b, t: 16 }] }, 10, (m) => m.id === 'A'), false, 'not before the last falls');
  assert.equal(yields({ ...trip, fallen: [{ res: a, t: 5 }] }, 10, (m) => m.id === 'B'), true, 'the host\'s word: the last the road left beaten');
  assert.equal(yields({ ...trip, fallen: [{ res: lead, t: 7 }] }, 10, beaten), false, 'the leader down');
  assert.equal(yields({ party: [lead, p], leader: lead }, 10, () => true), false, 'nobody armed: nothing to yield to');
});

test('LW11 the road offered: a merchant\'s caravan, from ESCORT_OFFER_MIN before it sets out until it is in - never turned, never by sea, never another kind (mutants: the window, the kind)', () => {
  assert.equal(ESCORT_OFFER_MIN, 18 * 60);
  const trip = { kind: 'merchant', outT0: 5000, outT1: 7000 };
  assert.equal(escortOffer(trip, 5000 - ESCORT_OFFER_MIN - 1), false);
  assert.equal(escortOffer(trip, 5000 - ESCORT_OFFER_MIN), true);
  assert.equal(escortOffer(trip, 6999), true);
  assert.equal(escortOffer(trip, 7000), false, 'in');
  assert.equal(escortOffer({ ...trip, turned: true }, 6000), false);
  assert.equal(escortOffer({ ...trip, sea: true }, 6000), false);
  for (const kind of ['pedlar', 'carter', 'noble', 'adventurer']) assert.equal(escortOffer({ ...trip, kind }, 6000), false, kind);
});

test('LW11 the escort\'s pay: each day of the walk out (WALK_FROM_H to WALK_TO_H a day, a part a whole) at ESCORT_GOLD_DAY and ESCORT_GOLD_LEVEL a level, and ESCORT_FIGHT a foe of the fights won (mutants: the days, the rate, the fights)', () => {
  assert.deepEqual([ESCORT_GOLD_DAY, ESCORT_GOLD_LEVEL, ESCORT_FIGHT], [60, 15, 100]);
  const day = (WALK_TO_H - WALK_FROM_H) * 60;
  const trip = (min) => ({ way: { len: min * 10 + 300 }, trim0: 100, trim1: 200, pace: 10 });
  assert.equal(escortPay(trip(day), 1), 1 * (60 + 15));
  assert.equal(escortPay(trip(day + 1), 1), 2 * (60 + 15), 'a part of a day a whole');
  assert.equal(escortPay(trip(day * 3), 10), 3 * (60 + 150));
  assert.equal(escortPay(trip(10), 0), 75, 'never less than a day, level 1');
  assert.equal(escortPay(trip(day), 4, 3), 120 + 300);
});

test('LW11 the road\'s records ride the character\'s save - the counters (gone, coin, robbed), the reports, the escort - written only once there is one (an add-only key), kept WARES_MAX and REPORTS_MAX newest, a malformed one dropped (mutants: the caps, the round trip, the add-only key)', () => {
  assert.deepEqual([WARES_MAX, REPORTS_MAX], [40, 40]);
  const r = createRelations();
  assert.equal(r.snapshot().road, undefined, 'none: no key');
  r.setWares('L1.t3:4', [3, 1, 1001, -1, 2.5], 250);
  r.setWares('L1.t4:4', [5, 2], 10, 999);
  r.report({ crime: CRIMES.Murder, region: 17, at: 4000, who: 'Ana', witnesses: ['L1.t3', 'L1.t5', ''] });
  r.setEscort({ trip: 'L1.t3:4', t: 100, pay: 225, fights: 2, leader: 'L1.t3', to: 902 });
  const snap = r.snapshot();
  assert.deepEqual(snap.road, {
    wares: [['L1.t3:4', [1, 3], 250], ['L1.t4:4', [2, 5], 10, 999]],
    reports: [[CRIMES.Murder, 17, 4000, 'Ana', 'L1.t3,L1.t5']],
    escort: ['L1.t3:4', 100, 225, 2, 'L1.t3', 902],
  });
  const back = createRelations(JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.snapshot().road, snap.road, 'the round trip');
  assert.deepEqual([...back.wares('L1.t3:4').gone], [1, 3]);
  assert.equal(back.wares('L1.t4:4').robbed, 999);
  assert.equal(back.escort().fights, 2);
  for (let i = 0; i < WARES_MAX + 5; i++) r.setWares(`L2.t${i}:1`, [i], 0);
  assert.equal(r.snapshot().road.wares.length, WARES_MAX);
  assert.equal(r.wares('L1.t3:4'), null, 'the oldest leave first');
  for (let i = 0; i < REPORTS_MAX + 3; i++) r.report({ crime: 1, region: i, at: i, witnesses: ['x'] });
  assert.equal(r.reports().length, REPORTS_MAX);
  assert.equal(r.reports()[0].region, 3);
  assert.equal(r.report({ crime: 1.5, region: 1, at: 1, witnesses: [] }), false, 'a malformed report');
  r.dropReport(r.reports()[0]);
  assert.equal(r.reports().length, REPORTS_MAX - 1);
  r.setEscort(null);
  assert.equal(r.escort(), null);
  const odd = createRelations({ v: 1, people: {}, road: { wares: [['', [1], 1], 'x', ['L1.t1:1', 'no', 1]], reports: [[1, 2, 3, 'w', 5]], escort: ['L1.t1:1', 'no'] } });
  assert.equal(odd.snapshot().road, undefined, 'malformed: nothing kept');
  assert.equal(createRelations({ v: 2, road: snap.road }).snapshot().road, undefined, 'another version: nothing read');
});

/** A host over one trip, its deps recorded; `slain` the player's own hand's (AUDIT LW-II C4), `dead` every hand's. */
function hostOver(trip, { now, rel = createRelations(), dead = new Set(), slain = new Set(), online = false, here = null, level = 5 } = {}) {
  const log = { said: [], charged: [], paid: [], trades: [], loot: [], choices: [], travelled: [] };
  const clock = { t: now };
  const deps = {
    relations: () => rel, clock: () => clock.t, day: (t) => Math.floor(t / 1440), roads: () => ({ parties: () => [{ trip, at: partyAt(trip, clock.t) }] }),
    findTrip: (res) => (trip.party.some((m) => m.id === res.id) ? trip : null),
    tripById: (id) => (id === trip.id ? trip : null),
    resOf: (id) => trip.party.find((m) => m.id === id) ?? null,
    stock: () => [{ name: 'Rope' }, { name: 'Lamp' }, { name: 'Bread' }],
    openTrade: (o) => { log.trades.push(o); return true; },
    openLoot: (o) => { log.loot.push(o); return true; },
    choose: (lines, options) => log.choices.push({ lines, options }),
    say: (text) => log.said.push(text),
    regionAt: () => 17,
    charge: (region, crime) => log.charged.push([region, crime]),
    deadAt: (res) => dead.has(res.id) || slain.has(res.id),
    slainAt: (res) => slain.has(res.id),
    here: () => (typeof here === 'function' ? here() : here),
    level: () => level,
    pay: (g) => log.paid.push(g),
    goldItem: (n) => ({ gold: n }),
    online: () => online,
    travelWith: (tr, until) => { log.travelled.push(until); return true; },
  };
  return { host: createCaravanHost(deps), log, clock, rel, dead, slain, deps };
}
const codes = (log) => log.choices.at(-1)?.options.map((o) => o.code) ?? [];

test('LW11 the door: the caravan\'s merchant on the road asks first - buy, sell, hire on, talk, goodbye; a hand never; the road offered before it sets out with no counter yet; travel on with them only for the escort offline (mutants: the keeper, the offer, the travel)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const { host, log } = hostOver(trip, { now: t });
  const talked = [];
  assert.equal(host.offers({ living: { res: trip.leader } }, () => talked.push(1)), true);
  assert.deepEqual(codes(log), ['KeyB', 'KeyS', 'KeyH', 'KeyA', 'Escape']);
  assert.equal(log.choices[0].lines[0], CARAVAN_LINES.ask(trip.leader.name.split(' ')[0]));
  log.choices[0].options.find((o) => o.code === 'KeyA').action();
  assert.equal(talked.length, 1, 'the talk behind the choice');
  const hand = trip.party.find((m) => m.id !== trip.leader.id);
  assert.equal(host.offers({ living: { res: hand } }, () => {}), false, 'a hand has no door');
  assert.equal(host.offers({ living: null }, () => {}), false);
  // before it sets out: the road offered, no counter
  const early = hostOver(trip, { now: trip.outT0 - 60 });
  assert.equal(early.host.offers({ living: { res: trip.leader } }, () => {}), true);
  assert.deepEqual(codes(early.log), ['KeyH', 'KeyA', 'Escape']);
  // hired: travel on with them offline, not online
  log.choices[0].options.find((o) => o.code === 'KeyH').action();
  assert.equal(host.offers({ living: { res: trip.leader } }, () => {}), true);
  assert.deepEqual(codes(log), ['KeyB', 'KeyS', 'KeyR', 'KeyA', 'Escape']);
  log.choices.at(-1).options.find((o) => o.code === 'KeyR').action();
  assert.ok(log.travelled[0] > t && log.travelled[0] <= trip.outT1, 'to its next stop');
  const on = hostOver(trip, { now: t, online: true });
  on.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902 });
  on.host.offers({ living: { res: trip.leader } }, () => {});
  assert.deepEqual(codes(on.log), ['KeyB', 'KeyS', 'KeyA', 'Escape'], 'online the clock is everyone\'s');
});

test('LW11 the counter opened: its roll with each ware\'s place, a friend\'s prices FRIEND_DISCOUNT off, a sale past the purse refused, the coin paid out kept, what left the shelf gone for good - the next session\'s shelf without it (mutants: the purse, the discount, the gone)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const { host, log, rel } = hostOver(trip, { now: t });
  host.offers({ living: { res: trip.leader } }, () => {});
  log.choices[0].options.find((o) => o.code === 'KeyB').action();
  const o = log.trades[0];
  assert.equal(o.mode, 'Buy');
  assert.deepEqual(o.shelf.items.map((it) => it[WARE_KEY]), [0, 1, 2]);
  assert.equal(o.b.roadDiscount, 0);
  assert.equal(o.b.quality, CARAVAN_QUALITY(trip));
  const purse = counterOf(trip).purse;
  assert.equal(o.allow('Sell', [], purse + 1), false, 'past the purse');
  assert.match(log.said.at(-1), /no more coin/);
  assert.equal(o.allow('Sell', [], purse), true);
  o.done('Sell', [], purse - 10);
  assert.equal(rel.wares(trip.id).coin, purse - 10);
  assert.equal(o.allow('Sell', [], 11), false, 'what it paid out counts');
  assert.equal(o.allow('Buy', [], 1e9), true, 'a purchase is the player\'s purse');
  // a ware bought: gone for good
  o.shelf.items.splice(1, 1);
  host.step();
  assert.deepEqual([...rel.wares(trip.id).gone], [1]);
  const next = hostOver(trip, { now: t, rel });
  next.host.offers({ living: { res: trip.leader } }, () => {});
  next.log.choices[0].options.find((c) => c.code === 'KeyS').action();
  assert.equal(next.log.trades[0].mode, 'Sell');
  assert.deepEqual(next.log.trades[0].shelf.items.map((it) => it.name), ['Rope', 'Bread']);
  // a friend's prices
  for (let d = 0; d < 3; d++) rel.note(trip.leader.id, 'saved', Math.floor(t / 1440));
  const friend = hostOver(trip, { now: t, rel });
  friend.host.offers({ living: { res: trip.leader } }, () => {});
  friend.log.choices[0].options[0].action();
  assert.equal(friend.log.trades[0].b.roadDiscount, FRIEND_DISCOUNT);
  assert.equal(FRIEND_DISCOUNT, 0.1);
});

test('LW11 a deed reported: a hand caught in the goods turns the party against the player and sends word; a traveller slain sends word of a murder - charged to the road\'s region when the party reaches its town, void when every witness is dead by then (mutants: the charge, the void, the minute)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const { host, log, rel, clock, dead } = hostOver(trip, { now: t });
  host.offers({ living: { res: trip.leader } }, () => {});
  log.choices[0].options[0].action();
  log.trades[0].caught();
  assert.ok(rel.regard(trip.leader.id, Math.floor(t / 1440)) < 0, 'the party\'s regard');
  assert.equal(rel.reports().length, 1);
  assert.deepEqual({ ...rel.reports()[0], witnesses: undefined }, { crime: CRIMES.Theft, region: 17, at: trip.outT1, who: trip.leader.name, witnesses: undefined, trip: trip.id });   // PIN MOVED (LW16): the one robbed named, for the tale; PIN MOVED (AUDIT LW-II C10): its trip, its own fallen read at the town
  host.step();
  assert.deepEqual(log.charged, [], 'not before the town');
  clock.t = trip.outT1;
  host.step();
  assert.deepEqual(log.charged, [[17, CRIMES.Theft]]);
  assert.equal(rel.reports().length, 0);
  // LW16: the robbery charged is a tale its region's towns tell, by the one robbed (relations.js TALE_KINDS `held`)
  assert.deepEqual([...rel.turns().held], [[`R17.${trip.outT1}~${CRIMES.Theft}`, { t: trip.outT1, seen: true, who: trip.leader.name }]]);
  // slain - and every witness dead before the town: void
  clock.t = t;
  const victim = trip.party.find((m) => m.id !== trip.leader.id);
  dead.add(victim.id);
  assert.equal(host.slain(victim, t), true);
  assert.equal(rel.reports()[0].crime, CRIMES.Murder);
  assert.equal(rel.reports()[0].who, victim.name);
  assert.ok(!rel.reports()[0].witnesses.includes(victim.id), 'the dead carry nothing');
  for (const m of trip.party) dead.add(m.id);
  clock.t = trip.outT1 + 1;
  host.step();
  assert.deepEqual(log.charged, [[17, CRIMES.Theft]], 'void');
  assert.equal(rel.reports().length, 0);
  assert.equal(host.caught(trip.leader, t), false, 'nobody standing to carry it');
  assert.equal(rel.turns().held.size, 1, 'LW16: void, no tale');
  // LW16: a purse picked and charged is a robbery's tale, by the one robbed; a murder charged never one (the hand's own)
  const m2 = hostOver(trip, { now: t });
  m2.dead.add(victim.id);
  m2.host.caught(trip.leader, t);
  m2.host.slain(victim, t);
  m2.clock.t = trip.outT1;
  m2.host.step();
  assert.deepEqual(m2.log.charged, [[17, CRIMES.Pickpocketing], [17, CRIMES.Murder]]);
  assert.deepEqual([...m2.rel.turns().held].map(([k, h]) => [k, h.who]), [[`R17.${trip.outT1}~${CRIMES.Pickpocketing}`, trip.leader.name]]);
  // LW16: a purse picked and every witness dead before the town: void, no tale
  const m3 = hostOver(trip, { now: t });
  m3.host.caught(trip.leader, t);
  for (const m of trip.party) m3.dead.add(m.id);
  m3.clock.t = trip.outT1;
  m3.host.step();
  assert.deepEqual([m3.log.charged, m3.rel.turns().held.size], [[], 0]);
});

test('LW11 the hold-up: the party\'s armed all down, its leader standing - it yields once, its robbery the character\'s (its cargo a quarter, LW10), a theft reported, the counter its goods and the rest of its purse open to take (mutants: the yield, the robbed minute, the take)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const at = partyAt(trip, t);
  const { host, log, rel, slain } = hostOver(trip, { now: t, here: { x: at.x, z: at.z } });   // PIN MOVED (AUDIT LW-II C4): there, its armed by the player's hand
  for (const m of trip.party) if (m.cls != null) slain.add(m.id);
  host.step();
  assert.equal(rel.wares(trip.id).robbed, t);
  assert.equal(host.robbed(trip.id), t);
  assert.equal(log.said.at(-1), CARAVAN_LINES.yield(trip.leader.name.split(' ')[0]));
  assert.equal(rel.reports()[0].crime, CRIMES.Theft);
  assert.equal(rel.reports()[0].who, trip.leader.name, 'LW16: the one robbed, for the tale');
  host.step();
  assert.equal(log.said.filter((s) => /Take it/.test(s)).length, 1, 'once');
  host.offers({ living: { res: trip.leader } }, () => {});
  assert.deepEqual(codes(log).slice(0, 1), ['KeyT']);
  log.choices.at(-1).options[0].action();
  const loot = log.loot[0];
  assert.equal(loot.items.at(-1).gold, counterOf(trip).purse, 'the whole purse');
  assert.equal(rel.wares(trip.id).coin, counterOf(trip).purse, 'and it is spent');
  assert.equal(loot.items.length, 4);
});

test('LW11 the escort: hired on at the pay of the walk, the fights won counted, paid at the town with the party\'s thanks; broken by falling ESCORT_KEEP_M behind for ESCORT_LOST_MIN; ended when the leader falls or the caravan turns back (mutants: the pay, the keep, the lost, the fell)', () => {
  assert.deepEqual([ESCORT_KEEP_M, ESCORT_LOST_MIN], [300, 60]);
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const near = () => { const at = partyAt(trip, clock.t); return { x: at.x, z: at.z }; };
  let clock;
  const h = hostOver(trip, { now: trip.outT0 - 30, here: () => near(), level: 7 });
  clock = h.clock;
  h.host.offers({ living: { res: trip.leader } }, () => {});
  h.log.choices[0].options.find((o) => o.code === 'KeyH').action();
  const pay = escortPay(trip, 7, 0);
  assert.equal(h.rel.escort().pay, pay);
  assert.match(h.log.said.at(-1), new RegExp(`${pay} gold`));
  for (let x = t; x < trip.outT1; x += 30) { clock.t = x; h.host.step(); }
  assert.ok(h.rel.escort(), 'kept by staying near');
  h.rel.turn('won', 'enc-x');
  clock.t = trip.outT1;
  h.host.step();
  assert.deepEqual(h.log.paid, [pay]);
  assert.equal(h.rel.escort(), null);
  assert.ok(h.rel.regard(trip.leader.id, Math.floor(trip.outT1 / 1440)) > 0, 'the party\'s thanks');
  // within ESCORT_KEEP_M is near; past it, far
  const by = (m) => () => { const at = partyAt(trip, clock.t); return { x: at.x + m * NATIVE_PER_M, z: at.z }; };
  const close = hostOver(trip, { now: t, here: by(ESCORT_KEEP_M - 10) });
  clock = close.clock;
  close.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902 });
  for (let x = t; x < t + 3 * ESCORT_LOST_MIN && x < trip.outT1; x += 10) { clock.t = x; close.host.step(); }
  assert.ok(close.rel.escort(), 'within ESCORT_KEEP_M');
  const off = hostOver(trip, { now: t, here: by(ESCORT_KEEP_M + 10) });
  clock = off.clock;
  off.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902 });
  for (let x = t; x <= t + ESCORT_LOST_MIN + 10; x += 10) { clock.t = x; off.host.step(); }
  assert.equal(off.rel.escort(), null, 'past it');
  // broken: far behind longer than ESCORT_LOST_MIN
  const far = hostOver(trip, { now: t, here: { x: 1e9, z: 1e9 } });
  far.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902 });
  far.host.step();
  far.clock.t = t + ESCORT_LOST_MIN;
  far.host.step();
  assert.ok(far.rel.escort(), 'not yet');
  far.clock.t = t + ESCORT_LOST_MIN + 1;
  far.host.step();
  assert.equal(far.rel.escort(), null);
  assert.equal(far.log.said.at(-1), CARAVAN_LINES.broken(trip.leader.name.split(' ')[0]));
  assert.deepEqual(far.log.paid, []);
  // near again between: the clock of falling behind starts over
  let away = true;
  const back = hostOver(trip, { now: t, here: () => (away ? { x: 1e9, z: 1e9 } : near()) });
  clock = back.clock;
  back.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902 });
  for (const [dt, a] of [[0, true], [50, false], [51, true], [100, true], [110, true]]) { away = a; clock.t = t + dt; back.host.step(); }
  assert.ok(back.rel.escort(), 'never ESCORT_LOST_MIN behind at a stretch');
  // the leader fallen
  const fell = hostOver(trip, { now: t, here: { x: 0, z: 0 } });
  fell.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902 });
  fell.dead.add(trip.leader.id);
  fell.host.step();
  assert.equal(fell.rel.escort(), null);
  assert.equal(fell.log.said.at(-1), CARAVAN_LINES.fell(trip.leader.name.split(' ')[0]));
  // the fights won beside it
  const won = { ...trip, enc: { id: 'enc-w', t0: t - 100, t1: t - 50, foes: [1, 2, 3] } };
  const w = hostOver(won, { now: t, here: () => near() });
  clock = w.clock;
  w.rel.setEscort({ trip: trip.id, t: t - 200, pay: 10, fights: 0, leader: trip.leader.id, to: 902 });   // PIN MOVED (AUDIT LW-II C5e): hired before the fight
  w.host.step();
  assert.equal(w.rel.escort().fights, 0, 'a fight not won counts nothing');
  w.rel.turn('won', 'enc-w');
  w.host.step();
  assert.equal(w.rel.escort().fights, 3);
  for (let x = t; x < trip.outT1; x += 30) { w.clock.t = x; w.host.step(); }   // PIN MOVED (AUDIT LW-II C5b): walked beside it to the town - a jump there is a stretch behind
  w.clock.t = trip.outT1;
  w.host.step();
  assert.deepEqual(w.log.paid, [10 + 3 * ESCORT_FIGHT]);
});

test('LW11 the session forgotten with its character: another character\'s records (a load, a new game) read their own counters again (mutants: the reset)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const first = createRelations();
  let now = first;
  const h = hostOver(trip, { now: t, rel: first });
  const host = createCaravanHost({ ...h.deps, relations: () => now });
  assert.equal(host.shelfOf(trip).items.length, 3);
  host.shelfOf(trip).items.splice(0, 1);
  host.step();
  assert.deepEqual([...first.wares(trip.id).gone], [0]);
  now = createRelations();
  assert.equal(host.shelfOf(trip).items.length, 3, 'another character: their own counter');
  now = first;
  assert.equal(host.shelfOf(trip).items.length, 2, 'and back: theirs');
});

test('LW11 the host\'s wiring: the road\'s trade window (its counter\'s discount on Buy, the purse\'s refusal returning the goods, its steal the road\'s crime and no city guard), the talk\'s door before the words, the roads reading a robbed caravan, the hand caught on the road no town\'s crime, the step once a second (mutants: each wire)', () => {
  const modes = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(modes, /if \(b\?\.roadDiscount && mode === 'Buy'\) return Math\.round\(adj \* f \* \(1 - b\.roadDiscount\)\);/);
  assert.match(modes, /if \(road\.allow\?\.\(m, staged, price\) === false\) \{ if \(m === 'Sell' \|\| m === 'SellMagic'\) \(playerEntity\.items \?\?= \[\]\)\.push\(\.\.\.staged\); return false; \}/);
  assert.match(modes, /crimeTheft: \(\) => road\.caught\?\.\(\),\n\s+spawnCityGuards: \(\) => \{\},/);
  assert.match(modes, /return !!mountServiceWindow\(openTradeWindow\(o\.shelf, o\.b, tradeMode, \{\}, o\)\);/);
  const talk = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(talk, /if \(livingTalk\?\.offers\?\.\(target\.person, \(\) => converse\(target\)\)\) return;/);
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /if \(livingWorldOn\(\) && \(_caravanT -= dt\) <= 0\) \{ _caravanT = 1; caravanHostOf\(\)\.step\(\); \}/);
  assert.match(world, /\n {4}caravanStep\(dt\);   \/\/ LW11: the hold-ups/, 'the open world\'s');   // PIN MOVED (AUDIT LW-II C5b): one step, two frames
  assert.match(world, /offers: \(person, talk\) => \(livingWorldOn\(\) \? caravanHostOf\(\)\.offers\(person, talk\) \|\| !!livingDivers\?\.offers\(person, talk\) : false\)/);   // PIN MOVED (LW14): and a company below
  assert.match(world, /robbed: \(tripId\) => caravanHostOf\(\)\.robbed\(tripId\),/);
  assert.match(world, /if \(p\?\.living\?\.res\) \{ caravanHostOf\(\)\.caught\(p\.living\.res, skyMinutes\(\)\); setCrimeCommitted\(playerEntity, CRIMES\.None\); \}/);
  assert.match(world, /const livingRoadSlay = \(res, t, seen\) => \{ livingSlay\(res, t, seen\); caravanHostOf\(\)\.slain\(res, t\); \};/);
  assert.match(world, /charge: \(region, crime\) => \{ lowerRepForCrime\(playerEntity, region, crime\); tallyCrimeGuildRequirements\(playerEntity, false, 1\); \}/);
  // the Overworld's mark of a caravan the character robbed
  assert.equal(partyLabel({ kind: 'merchant', party: [1], to: { name: 'Far' }, robbed: true }), 'Caravan to Far (robbed)');
  assert.equal(partyLabel({ kind: 'pedlar', party: [1], robbed: true }), 'Pedlar (robbed)');
  assert.equal(partyLabel({ kind: 'merchant', party: [1], to: { name: 'Far' }, robbed: true }, '', 'Orcs'), 'Caravan beset by Orcs');
  const roads = readFileSync(new URL('../src/scenes/livingRoads.js', import.meta.url), 'utf8');
  assert.match(roads, /label: partyLabel\(\{ \.\.\.p\.trip, party: members, robbed: deps\.robbed\?\.\(p\.trip\.id\) != null \}, '', beset\),/);
  assert.match(roads, /const trip = deps\.robbed\?\.\(p\.trip\.id\) != null \? \{ \.\.\.p\.trip, robbed: \{ t: /);
});

// ═══════════════════════════════════════════════════════════════════
// AUDIT LW-II (2026-10-10): THE CARAVAN'S DOOR, AUDITED - each finding reproduced, fixed, and pinned below.

test('AUDIT LW-II C1: at the game\'s epoch every place is a newcomer\'s - a witness and an escort\'s leader found by their place, the newcomer minted as the lives mint them; a murder carried in is charged, an escort kept and paid; a trip\'s trips waiting answer undefined (mutants: the newcomer, the place, the pending)', () => {
  const a = town(901, 100, 100, 24), b = town(902, 108, 100, 20);
  const world = miniWorld([a, b]);
  const byId = new Map([[901, a], [902, b]]);
  const townOf = (id) => byId.get(id) ?? null;
  // the lives' holders, as world.js livingPlaceOf mints them (no turns: the dice's own)
  world.holderOf = (res, k) => {
    const pl = placeAt(res, k, null);
    if (pl.vacant) return null;
    return pl.holder == null ? res : mintResident(byId.get(res.town), res.roll ?? 't', res.slot, res.job, { gen: pl.holder, home: res.home, work: res.work, faction: res.faction });
  };
  const T0 = 405 * 360 * DAY_MIN;   // the game's own years
  const o = O();
  let trip = null;
  for (let d = 0; d < 60 && !trip; d++) trip = (townTrips(a, T0 + d * DAY_MIN + 720, world, o) ?? []).find((tr) => tr.kind === 'merchant' && tr.party.length >= 2 && tr.party.some((m) => m.cls != null) && !tr.enc) ?? null;
  assert.ok(trip && /~\d+$/.test(trip.leader.id), 'a newcomer leads it');
  const resOf = (id) => travellerOf(id, townOf, world.rosterOf);
  for (const m of trip.party) assert.deepEqual([resOf(m.id)?.id, resOf(m.id)?.name], [m.id, m.name], 'each found, as the lives minted them');
  assert.equal(resOf('L901.t1'), world.rosterOf(a).find((r) => r.id === 'L901.t1'), 'the census\'s own');
  assert.equal(resOf('L999.t1~3'), null, 'no such town');
  assert.equal(resOf('L901.t999~3'), null, 'no such place');
  const tripsOf = (tw, t) => townTrips(tw, t, world, o);
  assert.equal(tripOfId(trip.id, trip.outT0, townOf, tripsOf)?.id, trip.id);
  assert.equal(tripOfId(trip.id, trip.outT0, townOf, () => undefined), undefined, 'its town\'s trips waiting on their ways: asked again');
  assert.equal(tripOfId(`${trip.id}9`, trip.outT0, townOf, tripsOf), null, 'none');
  // the host over them, as world.js wires it
  const rel = createRelations();
  const clock = { t: walkingOut(trip) };
  const log = { charged: [], paid: [], said: [] };
  const near = () => { const at = partyAt(trip, clock.t); return at.x == null ? null : { x: at.x, z: at.z }; };
  const host = createCaravanHost({
    relations: () => rel, clock: () => clock.t, day: (t) => Math.floor(t / 1440), roads: () => ({ parties: () => [{ trip }] }),
    findTrip: () => trip, tripById: (id, t) => tripOfId(id, t, townOf, tripsOf), resOf, slainAt: () => false,
    stock: () => [], openTrade: () => true, openLoot: () => true, choose: () => {}, say: (x) => log.said.push(x), regionAt: () => 17,
    charge: (r, c) => log.charged.push([r, c]), deadAt: () => false, here: near, level: () => 10, pay: (g) => log.paid.push(g),
    goldItem: (n) => ({ gold: n }), online: () => false,
  });
  const victim = trip.party.find((m) => m.id !== trip.leader.id);
  assert.equal(host.slain(victim, clock.t), true);
  rel.setEscort({ trip: trip.id, t: clock.t, pay: 300, fights: 0, leader: trip.leader.id, to: 902, near: clock.t });
  for (let x = clock.t; x < trip.outT1; x += 30) { clock.t = x; host.step(); }
  assert.ok(rel.escort(), 'the escort kept beside its newcomer leader');
  clock.t = trip.outT1;
  host.step();
  assert.deepEqual(log.charged, [[17, CRIMES.Murder]], 'its witnesses lived to carry it');
  assert.deepEqual(log.paid, [300]);
  // its trips waiting on their ways (a load before the roads are planned): the escort and the report wait too
  const wait = createRelations();
  wait.setEscort({ trip: trip.id, t: trip.outT0, pay: 300, fights: 0, leader: trip.leader.id, to: 902, near: trip.outT0 });
  wait.report({ crime: CRIMES.Theft, region: 17, at: trip.outT1, who: 'x', witnesses: [trip.leader.id], trip: trip.id });
  const said = [];
  const pending = createCaravanHost({
    relations: () => wait, clock: () => trip.outT1 + 5, day: () => 0, roads: () => null, findTrip: () => null, tripById: () => undefined, resOf,
    slainAt: () => false, stock: () => [], openTrade: () => true, openLoot: () => true, choose: () => {}, say: (x) => said.push(x), regionAt: () => 17,
    charge: () => said.push('charged'), deadAt: () => false, here: () => null, level: () => 1, pay: () => said.push('paid'), goldItem: (n) => n, online: () => false,
  });
  pending.step();
  assert.deepEqual([said, wait.reports().length, !!wait.escort()], [[], 1, true], 'asked again, nothing dropped');
});

test('AUDIT LW-II C4: the hold-up is the player\'s for armed the player\'s own hand beat, the player there - never guards who died fighting beside them, nor ones the road took, nor a party off beyond ESCORT_KEEP_M (mutants: the hand, the near)', () => {
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const at = partyAt(trip, t);
  const by = (m) => ({ x: at.x + m * NATIVE_PER_M, z: at.z });
  const armed = trip.party.filter((m) => m.cls != null);
  // died fighting beside the player: dead to the lives, never slain by them
  const died = hostOver(trip, { now: t, here: by(0) });
  for (const m of armed) died.dead.add(m.id);
  died.host.step();
  assert.deepEqual([died.rel.wares(trip.id), died.rel.reports().length, died.log.said.length], [null, 0, 0], 'none of the player\'s');
  // the road's own fallen
  const fell = { ...trip, fallen: armed.map((m) => ({ res: m, t: t - 100, s: 0 })) };
  const road = hostOver(fell, { now: t, here: by(0) });
  road.host.step();
  assert.equal(road.rel.wares(trip.id), null, 'the road\'s');
  // slain by the player, the party off beyond the reach
  const far = hostOver(trip, { now: t, here: by(ESCORT_KEEP_M + 10) });
  for (const m of armed) far.slain.add(m.id);
  far.host.step();
  assert.equal(far.rel.wares(trip.id), null, 'far off');
  const none = hostOver(trip, { now: t, here: null });
  for (const m of armed) none.slain.add(m.id);
  none.host.step();
  assert.equal(none.rel.wares(trip.id), null, 'nowhere (indoors)');
  // slain by the player, there: it yields
  const own = hostOver(trip, { now: t, here: by(ESCORT_KEEP_M - 10) });
  for (const m of armed) own.slain.add(m.id);
  own.host.step();
  assert.equal(own.rel.wares(trip.id).robbed, t);
});

test('AUDIT LW-II C5: the escort paid for the road walked beside it - hired late, the share of the walk ahead; the clock past the town in one step with the party never near, broken; a rest beside its camp kept, one slept through its leaving broken; travelled on with them kept; a caravan turned back unpaid from its trouble; its leader fallen to the road; a fight won before the hire none of it; never the road of a party the character robbed (mutants: each)', () => {
  assert.deepEqual([ESCORT_SAMPLE_MIN, ESCORT_STILL_M], [5, 5]);
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const level = 20;
  const whole = escortPay(trip, level, 0);
  // (a) hired late: the share of the walk still ahead
  assert.equal(escortPay(trip, level, 0, trip.outT0 - 60), whole, 'before it sets out: the whole walk');
  const mid = (trip.outT0 + trip.outT1) / 2;
  const s = partyAt(trip, mid).s;
  const share = (trip.way.len - trip.trim1 - s) / (trip.way.len - trip.trim0 - trip.trim1);
  assert.equal(escortPay(trip, level, 0, mid), Math.round(whole * share));
  assert.ok(escortPay(trip, level, 0, trip.outT1 - 1) <= 1, 'a minute short of the town: next to nothing');
  assert.equal(escortPay(trip, level, 2, trip.outT1 - 1) >= 2 * ESCORT_FIGHT, true, 'its fights all the same');
  let clock;
  const near = () => { const at = partyAt(trip, clock.t); return at.x == null ? null : { x: at.x, z: at.z }; };
  const late = hostOver(trip, { now: trip.outT1 - 1, here: () => near(), level });
  clock = late.clock;
  late.host.offers({ living: { res: trip.leader } }, () => {});
  late.log.choices.at(-1).options.find((x) => x.code === 'KeyH').action();
  clock.t = trip.outT1;
  late.host.step();
  assert.deepEqual(late.log.paid, [escortPay(trip, level, 0, trip.outT1 - 1)], 'a minute\'s pay for a minute');
  // (b) hired before it sets out, never near, the clock past the town in one step (a rest, a wait, indoors): broken
  const jump = hostOver(trip, { now: trip.outT0 - 60, here: { x: 1e9, z: 1e9 }, level });
  jump.host.offers({ living: { res: trip.leader } }, () => {});
  jump.log.choices.at(-1).options.find((x) => x.code === 'KeyH').action();
  jump.host.step();
  jump.clock.t = trip.outT1 + 30;
  jump.host.step();
  assert.deepEqual([jump.log.paid, jump.rel.escort(), jump.log.said.at(-1)], [[], null, CARAVAN_LINES.broken(trip.leader.name.split(' ')[0])]);
  // (c) a rest beside its night's camp: the clock across the night in steps of a rest's, the party camped beside the
  // sleeper - kept; slept on past its leaving, the sleeper where it camped - broken
  let camp = null;
  for (let x = Math.ceil(trip.outT0); x < trip.outT1 && camp == null; x += 10) if (partyAt(trip, x).camp) camp = x;
  assert.ok(camp != null, 'it camps on the way');
  let dawn = camp;
  while (partyAt(trip, dawn + 10).camp) dawn += 10;
  const bed = partyAt(trip, camp);
  const rest = hostOver(trip, { now: camp, here: { x: bed.x, z: bed.z } });
  rest.rel.setEscort({ trip: trip.id, t: camp - 100, pay: 10, fights: 0, leader: trip.leader.id, to: 902, near: camp });
  for (let x = camp; x <= dawn; x += 80) { rest.clock.t = x; rest.host.step(); }
  assert.ok(rest.rel.escort(), 'a night beside its camp, slept in hours a step');
  assert.equal(escortNear(trip, { x: bed.x, z: bed.z }, camp, dawn), dawn, 'with it the night through');
  let gone = dawn;
  while (gone < trip.outT1 && Math.hypot(partyAt(trip, gone).x - bed.x, partyAt(trip, gone).z - bed.z) / NATIVE_PER_M <= ESCORT_KEEP_M) gone += 1;
  rest.clock.t = gone + ESCORT_LOST_MIN + 2 * ESCORT_SAMPLE_MIN;
  rest.host.step();
  assert.equal(rest.rel.escort(), null, 'slept on past its leaving: broken');
  // woken a little past its leaving - the last step long before, the camp beside the sleeper the while: kept (the party
  // within reach until it set off, then a stretch under ESCORT_LOST_MIN)
  const woke = hostOver(trip, { now: gone - 85, here: { x: bed.x, z: bed.z } });
  woke.rel.setEscort({ trip: trip.id, t: camp - 100, pay: 10, fights: 0, leader: trip.leader.id, to: 902, near: gone - 85 });
  woke.host.step();
  woke.clock.t = gone + 30;
  woke.host.step();
  assert.ok(woke.rel.escort(), 'it set off half an hour ago: not yet broken');
  // a journey that set the player down where the party had passed (by its town, the clock past its arrival): the gap is
  // read back only for a player who stood still - never one who travelled ahead
  const at0 = partyAt(trip, t), last = partyAt(trip, trip.outT1 - 5);
  let spot = { x: at0.x, z: at0.z };
  const ahead = hostOver(trip, { now: t, here: () => spot });
  ahead.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902, near: t });
  ahead.host.step();
  spot = { x: last.x, z: last.z };
  ahead.clock.t = trip.outT1 + 30;
  ahead.host.step();
  assert.deepEqual([ahead.log.paid, ahead.rel.escort()], [[], null], 'travelled ahead to its town: broken');
  // (d) travelled on with them: the jump is the road beside it
  const ride = hostOver(trip, { now: t, here: null });
  ride.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902, near: t });
  ride.host.offers({ living: { res: trip.leader } }, () => {});
  ride.log.choices.at(-1).options.find((x) => x.code === 'KeyR').action();
  const until = ride.log.travelled[0];
  assert.equal(ride.rel.escort().near, until, 'with them to its next stop');
  ride.clock.t = until;
  ride.host.step();
  assert.ok(ride.rel.escort(), 'set down beside it, kept');
  // (e) turned back at its trouble: from its trouble's minute, unpaid (it paid through the halt before)
  const fledEnc = { id: `${trip.id}:e`, leg: 'out', camp: false, t0: t + 30, t1: t + 45, fightEnd: t + 38, s: partyAt(trip, t + 30).s, x: 0, z: 0, px: 0, py: 0, foes: [10, 10], level: 3, kind: 'fled', shape: 'fled', dead: [] };
  const fled = troubledTrip(trip, fledEnc);
  assert.equal(fled.turned, true);
  const ft = hostOver(fled, { now: t, here: () => near() });
  clock = ft.clock;
  ft.rel.setEscort({ trip: fled.id, t: t - 10, pay: 99, fights: 0, leader: trip.leader.id, to: 902, near: t - 10 });
  for (const x of [t, t + 10, t + 20, fledEnc.t0 + 5]) { clock.t = x; ft.host.step(); }
  assert.deepEqual([ft.log.paid, ft.rel.escort(), ft.log.said.at(-1)], [[], null, CARAVAN_LINES.turned(trip.leader.name.split(' ')[0])]);
  // ... a real encounter whose leader the road takes (troubleOf, the leader fated): did not live to pay
  let fellTrip = null;
  for (const tr of caravans().trips) {
    const e = troubleOf(tr, { climateAt: () => 0, foesOf: ({ size }) => Array(size).fill(10), dies: (m) => m.id === tr.leader.id });
    if (e?.kind === 'fell' && e.leg === 'out') { fellTrip = troubledTrip(tr, e); break; }
  }
  assert.ok(fellTrip?.turned, 'a caravan whose leader the road takes on the way out');
  let fc;
  const fnear = () => { const at = partyAt(fellTrip, fc.t); return at.x == null ? null : { x: at.x, z: at.z }; };
  const fl = hostOver(fellTrip, { now: fellTrip.enc.t0 - 30, here: () => fnear() });
  fc = fl.clock;
  fl.rel.setEscort({ trip: fellTrip.id, t: fellTrip.enc.t0 - 60, pay: 99, fights: 0, leader: fellTrip.leader.id, to: 902, near: fellTrip.enc.t0 - 30 });
  for (const x of [fellTrip.enc.t0 - 30, fellTrip.enc.t0 + 1]) { fc.t = x; fl.host.step(); }
  assert.deepEqual([fl.log.paid, fl.rel.escort(), fl.log.said.at(-1)], [[], null, CARAVAN_LINES.fell(fellTrip.leader.name.split(' ')[0])]);
  // (f) its leader fallen to the road, unturned - the trip's own fallen, which no hand death reads
  const down = { ...trip, fallen: [{ res: trip.leader, t: t + 5, s: 0 }] };
  const dl = hostOver(down, { now: t, here: () => near() });
  clock = dl.clock;
  dl.rel.setEscort({ trip: trip.id, t, pay: 10, fights: 0, leader: trip.leader.id, to: 902, near: t });
  dl.host.step();
  assert.ok(dl.rel.escort(), 'standing yet');
  clock.t = t + 6;
  dl.host.step();
  assert.deepEqual([dl.rel.escort(), dl.log.said.at(-1)], [null, CARAVAN_LINES.fell(trip.leader.name.split(' ')[0])]);
  // (g) a fight won before the hire
  const won = { ...trip, enc: { id: 'enc-b', t0: t - 100, t1: t - 50, foes: [1, 2, 3] } };
  const wb = hostOver(won, { now: t, here: () => near() });
  clock = wb.clock;
  wb.rel.turn('won', 'enc-b');
  wb.rel.setEscort({ trip: trip.id, t: t - 50, pay: 10, fights: 0, leader: trip.leader.id, to: 902, near: t - 50 });
  wb.host.step();
  assert.equal(wb.rel.escort().fights, 0, 'won before the hire: none of the escort\'s');
  // (h) never the road of a party the character robbed
  const robbed = hostOver(trip, { now: trip.outT0 - 60 });
  robbed.rel.setWares(trip.id, [], 0, trip.outT0 - 600);
  robbed.host.offers({ living: { res: trip.leader } }, () => {});
  assert.ok(!codes(robbed.log).includes('KeyH'), 'no road offered');
  // the contract's minute near rides the save (an add-only field)
  const r = createRelations();
  r.setEscort({ trip: 'L1.t1:2', t: 10, pay: 5, fights: 0, leader: 'L1.t1', to: 2, near: 40 });
  assert.deepEqual(r.snapshot().road.escort, ['L1.t1:2', 10, 5, 0, 'L1.t1', 2, 40]);
  assert.equal(createRelations(JSON.parse(JSON.stringify(r.snapshot()))).escort().near, 40);
  assert.equal(createRelations({ v: 1, road: { escort: ['L1.t1:2', 10, 5, 0, 'L1.t1', 2] } }).escort().near, null, 'an older save\'s: unknown');
});

test('AUDIT LW-II C6/C7: a caravan the band robbed first has no purse left for the player\'s robbery; a robbed counter\'s record is the last the book forgets, and the session writes back its own coin and robbery - never a forgotten record\'s nothing (mutants: the band\'s purse, the eviction, the write-back)', () => {
  const base = armedCaravan();
  const t = walkingOut(base);
  const at = partyAt(base, t);
  // C6: held up by a band an hour before, then by the player
  const trip = { ...base, robbed: { t: t - 60, by: 'O17.0~0' } };
  const h = hostOver(trip, { now: t, here: { x: at.x, z: at.z } });
  for (const m of trip.party) if (m.cls != null) h.slain.add(m.id);
  h.host.step();
  h.host.offers({ living: { res: trip.leader } }, () => {});
  h.log.choices.at(-1).options.find((o) => o.code === 'KeyT').action();
  assert.deepEqual(h.log.loot.at(-1).items.filter((i) => i.gold != null), [], 'the band took every septim');
  assert.equal(h.log.loot.at(-1).items.length, 2, 'and half its goods');
  // C7: the book's eviction - the oldest counter not robbed first, while robberies are half the book or fewer
  const r = createRelations();
  r.setWares('rob:1', [0], 50, 100);
  for (let i = 0; i < WARES_MAX; i++) r.setWares(`buy:${i}`, [i], 0);
  assert.equal(r.wares('rob:1')?.robbed, 100, 'a robbery outlives forty trades');
  assert.equal(r.wares('buy:0'), null, 'the oldest trade went first');
  for (let i = 0; i < WARES_MAX; i++) r.setWares(`rob:x${i}`, [], 0, 200 + i);
  assert.equal(r.snapshot().road.wares.length, WARES_MAX);
  assert.equal(r.wares('rob:1'), null, 'past half the book robbed, the oldest robbery goes');
  assert.equal([...r.snapshot().road.wares].filter((w) => w[3] != null).length, WARES_MAX / 2, 'robberies kept to half the book: the trades the rest');
  // the session's write-back: a robbed counter taken from, its record forgotten - written again as the session holds it
  const s = hostOver(base, { now: t, here: { x: at.x, z: at.z } });
  for (const m of base.party) if (m.cls != null) s.slain.add(m.id);
  s.host.step();
  s.host.offers({ living: { res: base.leader } }, () => {});
  s.log.choices.at(-1).options.find((o) => o.code === 'KeyT').action();
  s.log.loot.at(-1).items.splice(0);
  s.host.step();
  const was = s.rel.wares(base.id);
  assert.deepEqual([[...was.gone], was.coin, was.robbed], [[0, 1, 2], counterOf(base).purse, t]);
  for (let i = 0; i < WARES_MAX; i++) s.rel.setWares(`rob:y${i}`, [], 0, 300 + i);
  assert.equal(s.rel.wares(base.id), null, 'pushed out of the book');
  assert.equal(s.host.robbed(base.id), t, 'the session\'s shelf still knows it');
  s.host.step();
  const back = s.rel.wares(base.id);
  assert.deepEqual([[...back.gone], back.coin, back.robbed], [[0, 1, 2], counterOf(base).purse, t], 'written back whole');
  s.host.offers({ living: { res: base.leader } }, () => {});
  assert.deepEqual(codes(s.log).slice(0, 1), ['KeyT'], 'robbed still: no counter to sell to');
  // a counter not robbed, pushed out: left out (the newest kept), never churned back each second
  const b = hostOver(base, { now: t });
  b.host.shelfOf(base).items.splice(0, 1);
  b.host.step();
  assert.deepEqual([...b.rel.wares(base.id).gone], [0]);
  for (let i = 0; i < WARES_MAX; i++) b.rel.setWares(`buy:z${i}`, [], 0);
  b.host.step();
  assert.equal(b.rel.wares(base.id), null);
  b.host.shelfOf(base).items.splice(0, 1);
  b.host.step();
  assert.deepEqual([...b.rel.wares(base.id).gone], [0, 1], 'a new deal written');
});

test('AUDIT LW-II C10: a report\'s crime is the law\'s and its region the map\'s, read or written; a witness the road took on the way carries nothing (mutants: the crime, the region, the road\'s fallen)', () => {
  const loaded = createRelations({ v: 1, people: {}, road: { reports: [[999, 3, 0, 'x', 'L1.t1'], [13, -7, 0, 'x', 'L1.t1'], [13, 62, 0, 'y', 'L1.t2'], [0, 3, 0, 'z', 'L1.t3'], [13, 61, 5, 'w', 'L1.t4', 'L1.t4:2']] } });
  assert.deepEqual(loaded.reports().map((r) => [r.crime, r.region, r.trip]), [[13, 61, 'L1.t4:2']], 'only the law\'s crime in one of the map\'s regions');
  const r = createRelations();
  assert.equal(r.report({ crime: 999, region: 3, at: 1, witnesses: ['a'] }), false);
  assert.equal(r.report({ crime: CRIMES.None, region: 3, at: 1, witnesses: ['a'] }), false);
  assert.equal(r.report({ crime: CRIMES.Theft, region: -1, at: 1, witnesses: ['a'] }), false, 'the sea is no region');
  assert.equal(r.report({ crime: CRIMES.Theft, region: 62, at: 1, witnesses: ['a'] }), false);
  assert.equal(r.report({ crime: CRIMES.Theft, region: 0, at: 1, witnesses: ['a'] }), true);
  // the witnesses fall on the way (the trip's own fallen, the road's - no hand death): void at the town
  const trip = armedCaravan();
  const t = walkingOut(trip);
  const fell = { ...trip, fallen: trip.party.map((m) => ({ res: m, t: t + 10, s: 0 })) };
  const h = hostOver(fell, { now: t });
  h.host.caught(trip.leader, t);
  assert.equal(h.rel.reports()[0].trip, trip.id);
  h.clock.t = fell.outT1;
  h.host.step();
  assert.deepEqual([h.log.charged, h.rel.reports().length], [[], 0], 'nobody lived to carry it');
  const kept = hostOver(trip, { now: t });
  kept.host.caught(trip.leader, t);
  kept.clock.t = trip.outT1;
  kept.host.step();
  assert.deepEqual(kept.log.charged, [[17, CRIMES.Pickpocketing]], 'they did: charged');
});

test('AUDIT LW-II C1/C4/C5b: the host\'s wiring - the traveller by place, the trip pending, the player\'s own hand, the step in the modal frame too, nowhere near a party indoors (mutants: each wire)', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /const livingTravellerOf = \(id\) => travellerOf\(id, livingTownOfId, livingTripWorld\.rosterOf\);/);
  assert.match(world, /tripById: \(id, t\) => tripOfId\(id, t, livingTownOfId, \(town, at\) => tripsOfTown\(town, at, livingTripWorld, livingTripO\(\)\)\),/);
  assert.match(world, /resOf: livingTravellerOf, slainAt: livingSlainAt,/);
  assert.match(world, /const h = slain\.get\(turnKey\(res, livingCycleOf\(res, Math\.floor\(\(t - 240\) \/ 1440\)\)\)\);\n\s*return h != null && h\.t <= t;/);
  assert.match(world, /here: \(\) => \(playerSpawned && _mode\(\) === 'exterior' \? state\.worldCoords\(walkMode \? player\.pos : cam\.pos\) : null\),   \/\/ AUDIT LW-II C5b/);
  const modal = world.slice(world.indexOf('    if (modes.frame(dt, now)) {'), world.indexOf('    // Q4-v: the quest machine\'s EXTERIOR tick'));
  assert.ok(modal.length > 1000 && modal.includes('requestAnimationFrame(frame);'), 'the modal arm read');
  assert.match(modal, /\n {6}caravanStep\(dt\);   \/\/ AUDIT LW-II C5b/, 'indoors and below too');
});
