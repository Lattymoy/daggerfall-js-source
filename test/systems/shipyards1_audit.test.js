// AUDIT SHIPYARDS (2026-10-11, Mac: "Audit everything"): seven cold lanes read the SHIPYARDS change on a frozen snapshot,
// every finding was checked by hand, and each one fixed is pinned here (bible/03-World/Shipyards.md, AUDIT SHIPYARDS).
// The crew hall is driven over the REAL sea fight (test/navalSea.mjs - the producer, never a fake that mints another
// shape: TEST THE SHAPE THE PRODUCER MINTS), the shipmaster's acts over the real Fleet ledger.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../navalSea.mjs';
import { createShipyardHost } from '../../src/scenes/shipyardHost.js';
import { fleetShip, titleDeed, shipLabel, _resetFleetForTests, knowShip, fleetBook, restoreFleetSaveData, fleetSaveData, fleetCrossed, FLEET_SAVE_VENDOR } from '../../src/systems/fleet.js';
import { mintDeed, mintParts } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { SHIPYARD_TEXT, shipWorth, shipSalePrice, shipBuyPrice, SHIPYARD_HULLS } from '../../src/systems/shipyards.js';
import { applyCustoms, customsLines } from '../../src/systems/realmCustoms.js';
import { createBankAccounts } from '../../src/systems/banking.js';
import { COME_SAIL_AWAY_VENDOR } from '../../src/systems/comeSailAway/comeSailAway.js';
import { HULL_NAMES, HULL_PRICES } from '../../src/systems/comeSailAway/comeSailAwayHulls.js';
import { firstBuildOf } from '../../src/systems/naval/navalShips.js';
import { SHIP_STATES, REPAIR_PRICE } from '../../src/systems/naval/navalDamage.js';
import { CREW_PER_HAND } from '../../src/systems/naval/navalBoarding.js';
import { CREW_HALL_TEXT, hireCharge } from '../../src/systems/crewHall.js';

const SITE = Object.freeze({
  key: '4242:shipyard', kind: 'shipyard', mapId: 4242, regionIndex: 17, townName: 'Sentinel', name: 'Voss\'s Shipyard',
  keeper: { name: 'Halbrecht Voss' }, crewmaster: { name: 'Anna Wayrest' }, crewName: 'Wayrest\'s Crew Hall',
});
const SK = Object.freeze({ mercantile: 40, personality: 50 });
const SMALL_SHIP = 2, LARGE_GALLEY = 3;

/** A naval save of one boat of the player's (number 42) at `crew`, her hull whole unless `hull` says, in `state`. */
const saveOf = (hull, crew, { state = SHIP_STATES.afloat, hullHp = null } = {}) => {
  const f = firstBuildOf(hull);
  return { v: 1, boats: { 42: { hull: hullHp ?? f.hullHp, sail: f.sailHp, maxHull: f.hullHp, maxSail: f.sailHp, crew, fire: 0, state, credit: 0, barrels: 0 } } };
};
/** The crew hall over the real sea fight: ship 42 lying at this port, her status the sea fight's own (fleetStatus). */
async function seaRig(hull, crew, { gold = 100000, state, hullHp, fight = false } = {}) {
  _resetFleetForTests();
  const s = await sea({ hull, save: saveOf(hull, crew, { state, hullHp }) });
  s.runtime.sailing = false;   // on foot at the crewmaster's table
  titleDeed(mintDeed(hull, 0, 42, HULL_PRICES[hull]));
  const st = { gold, day: 100 };
  const fleet = {
    model: () => ({ ships: [{ uid: 42, hull, label: shipLabel(fleetShip(42)), hullName: HULL_NAMES[hull], name: null,
      status: { ...s.host.fleetStatus(s.boat), ...(fight ? { inFight: true } : {}) }, can: {}, upgrades: {} }] }),
    whereIs: () => ({ where: 'here', boat: s.boat }),
    act: () => ({ ok: false, text: 'n/a' }),
  };
  const host = createShipyardHost({
    fleet: () => fleet, naval: () => s.host, csa: () => ({ state: {} }), gold: () => st.gold, pay: (n) => { st.gold -= n; },
    day: () => st.day, skills: () => SK,
  });
  const label = shipLabel(fleetShip(42));
  return { s, st, host, label, status: () => s.host.fleetStatus(s.boat), hands: () => s.host.crewHands(s.boat) };
}

test('AUDIT SHIPYARDS THE CREW HALL OVER THE REAL SEA (L2-6): a ship as she is bought has a FULL deck, and a recruit signs on IN A HAND\'S PLACE the player names - one man for another, her crew as it was, his hall id with him and off the roster (L7-2, L2-9); a hand ashore reads ashore by her roster place (L2-3) and is never paid off nor replaced', async () => {
  const r = await seaRig(SMALL_SHIP, 24);
  const m = r.host.model(SITE, { page: 'crew' });
  assert.equal(m.hands.length, 4, 'a Small Ship as she is bought stands four');
  assert.deepEqual([m.room.ok, m.room.full], [false, true], 'the deck is full');
  assert.ok(m.recruits.length && m.recruits.every((x) => x.swap === true && x.why === null), 'every recruit signs on in a hand\'s place');
  const pick = m.recruits[0];
  assert.deepEqual(r.host.act(SITE, 'hire', 42, pick.id), { ok: false, text: CREW_HALL_TEXT.full }, 'a full deck: no hire without a place named');
  const out = m.hands[3].name, gold0 = r.st.gold;
  const done = r.host.act(SITE, 'hire', 42, { id: pick.id, replace: out });
  assert.equal(done.ok, true, done.text);
  const now = r.hands();
  assert.equal(done.text, CREW_HALL_TEXT.swapped(pick.name, now.at(-1).role, r.label, out));
  assert.deepEqual([r.status().crew, now.length], [24, 4], 'one man for another: her crew as it was');
  assert.deepEqual([now.at(-1).name, now.at(-1).hall], [pick.name, pick.id], 'he stands at her roster\'s end, his hall id with him');
  assert.ok(!now.some((h) => h.name === out), 'the hand named is paid off');
  assert.equal(gold0 - r.st.gold, pick.fee, 'his fee - no men raised');
  assert.ok(!r.host.model(SITE, { page: 'crew' }).recruits.some((x) => x.id === pick.id), 'signed on: off the roster, by his id');
  // a hand ashore at the player's side (crew companions): the page says so by her ROSTER PLACE (navalHost awayOf's answer)
  const a = await seaRig(SMALL_SHIP, 24);
  const hs = a.hands();
  a.s.host.companionPress(a.s.boat, hs[1].name, 0);
  assert.deepEqual([...a.s.host.awayOf(a.s.boat)], [1], 'the producer answers roster places');
  assert.deepEqual(a.host.model(SITE, { page: 'crew' }).hands.map((h) => h.ashore), [false, true, false, false], 'ashore by place, not by name');
  assert.deepEqual(a.host.act(SITE, 'payoff', 42, hs[1].name), { ok: false, text: CREW_HALL_TEXT.ashore(hs[1].name) });
  const rec = a.host.model(SITE, { page: 'crew' }).recruits[0];
  assert.deepEqual(a.host.act(SITE, 'hire', 42, { id: rec.id, replace: hs[1].name }), { ok: false, text: CREW_HALL_TEXT.ashore(hs[1].name) });
});

test('AUDIT SHIPYARDS PAID OFF OVER THE REAL SEA: her crew falls by a man\'s share; where her men still stand as many on her deck (a galley\'s sixty stand eight) the man who steps up is NAMED, never a stranger unexplained (L2-1); the last of her crew is never paid off (she would strike)', async () => {
  const g = await seaRig(LARGE_GALLEY, 60);
  const before = g.hands();
  assert.equal(before.length, 8, 'a galley\'s whole crew stands eight');
  const name = before[2].name;
  const r = g.host.act(SITE, 'payoff', 42, name);
  const after = g.hands();
  const next = after.find((h) => !before.some((b) => b.name === h.name));
  assert.ok(next, 'one of her men stepped up');
  assert.deepEqual([r.ok, r.text], [true, CREW_HALL_TEXT.steppedUp(name, g.label, next.name)], 'and the hall says who');
  assert.deepEqual([g.status().crew, after.length], [60 - CREW_PER_HAND, 8]);
  const one = await seaRig(SMALL_SHIP, CREW_PER_HAND);
  const last = one.hands();
  assert.equal(last.length, 1);
  assert.deepEqual(one.host.act(SITE, 'payoff', 42, last[0].name), { ok: false, text: CREW_HALL_TEXT.lastMan });
  assert.deepEqual([one.status().crew, one.hands().length], [CREW_PER_HAND, 1], 'nothing moved');
  const two = await seaRig(SMALL_SHIP, 18);
  const off = two.hands()[0].name;
  const plain = two.host.act(SITE, 'payoff', 42, off);
  assert.deepEqual([plain.ok, plain.text, two.status().crew, two.hands().length], [true, CREW_HALL_TEXT.paidOff(off, two.label), 12, 2], 'a place truly freed: no one steps up');
});

test('AUDIT SHIPYARDS A HIRE\'S PRICE AND WHAT IT TOUCHES OVER THE REAL SEA: the men a hire raises past a man\'s share at the shipwright\'s price (L2-2); a wreck stays a wreck (L2-5); a seasoned man\'s lift leaves with him - no pump (L2-4); a roster turned while the window stood says so (L2-8); never while she fights (L2-11)', async () => {
  const thin = await seaRig(SMALL_SHIP, 1);
  const m = thin.host.model(SITE, { page: 'crew' });
  const cheap = [...m.recruits].sort((x, y) => x.fee - y.fee)[0];
  assert.equal(cheap.price, hireCharge(cheap.fee, 11), 'the page shows the hire\'s price');
  assert.equal(cheap.price, Math.max(cheap.fee, 11 * REPAIR_PRICE.crew));
  const g0 = thin.st.gold;
  assert.equal(thin.host.act(SITE, 'hire', 42, cheap.id).ok, true);
  assert.deepEqual([thin.status().crew, g0 - thin.st.gold], [12, cheap.price], 'eleven men raised, paid for as the shipwright would');
  const wreck = await seaRig(SMALL_SHIP, 12, { state: SHIP_STATES.wrecked, hullHp: 30 });
  assert.equal(wreck.status().wrecked, true);
  const w = wreck.host.model(SITE, { page: 'crew' }).recruits[0];
  assert.equal(wreck.host.act(SITE, 'hire', 42, w.id).ok, true);
  assert.deepEqual([wreck.status().wrecked, wreck.status().crew], [true, 18], 'her crew raised, her hull still a wreck\'s');
  // the lift: a seasoned man signed on and paid off again leaves her spirits where they were
  const lift = await seaRig(SMALL_SHIP, 12);
  let pick = null;
  for (let day = 100; day < 200 && !pick; day++) { lift.st.day = day; pick = lift.host.model(SITE, { page: 'crew' }).recruits.find((x) => x.lift >= 4) ?? null; }
  assert.ok(pick, 'a seasoned man at some hall');
  const m0 = lift.status().morale;
  for (let i = 0; i < 3; i++) {
    assert.equal(lift.host.act(SITE, 'hire', 42, pick.id).ok, true);
    assert.equal(lift.status().morale, m0 + pick.lift, 'he steadies them by his lift');
    assert.equal(lift.host.act(SITE, 'payoff', 42, pick.name).ok, true);
    assert.equal(lift.status().morale, m0, 'and takes it with him');
  }
  // the day turned between the page and the press
  const day = await seaRig(SMALL_SHIP, 12);
  const stale = day.host.model(SITE, { page: 'crew' }).recruits[0];
  day.st.day = 101;
  assert.deepEqual(day.host.act(SITE, 'hire', 42, stale.id), { ok: false, text: CREW_HALL_TEXT.newDay });
  // a fight
  const fight = await seaRig(SMALL_SHIP, 12, { fight: true });
  const fm = fight.host.model(SITE, { page: 'crew' });
  assert.equal(fm.why, CREW_HALL_TEXT.fighting);
  assert.ok(fm.recruits.every((x) => x.why === CREW_HALL_TEXT.fighting));
  assert.deepEqual(fight.host.act(SITE, 'hire', 42, fm.recruits[0].id), { ok: false, text: CREW_HALL_TEXT.fighting });
  assert.deepEqual(fight.host.act(SITE, 'payoff', 42, fm.hands[0].name), { ok: false, text: CREW_HALL_TEXT.fighting });
});

/** The shipmaster's acts over the real Fleet ledger, the sea fight OFF (Naval Combat off: `naval()` none), Come Sail Away
 *  a fake that can hold a placing armed. */
function tradeRig({ gold = 500000, canCarry = true } = {}) {
  _resetFleetForTests();
  const log = { paid: [], credited: [], forgot: [], stops: 0, laid: [], pack: [], fleetActs: [] };
  const st = { where: new Map(), boats: new Map(), status: new Map(), ashore: new Map(), aboard: 0, cabins: new Map(), placing: null, layUp: true };
  const fleet = {
    model: () => ({ ships: [...st.where.keys()].map((uid) => fleetShip(uid)).filter(Boolean).map((rec) => ({ uid: rec.uid, hull: rec.hull, label: shipLabel(rec),
      hullName: HULL_NAMES[rec.hull], name: rec.name, status: st.status.get(rec.uid) ?? { hull: 100, maxHull: 100 }, can: {}, upgrades: {} })) }),
    whereIs: (rec) => ({ where: st.where.get(rec.uid) ?? 'lost', boat: st.boats.get(rec.uid) ?? null }),
    act: (uid, verb) => { log.fleetActs.push([uid, verb, log.stops]); return { ok: true, text: `${verb} done` }; },
  };
  const csa = {
    state: { PackedCargoes: new Map(), get placing() { return !!st.placing; }, get placeItem() { return st.placing; } },
    StopPlacing: () => { log.stops++; st.placing = null; },
    LayUpBoat: (b) => { log.laid.push(b.uid); return st.layUp; },
    forgetHold: () => true,
  };
  const host = createShipyardHost({
    fleet: () => fleet, naval: () => null, csa: () => csa,
    pack: () => log.pack, addToPack: (it) => log.pack.push(it), gold: () => gold, pay: (n) => log.paid.push(n), credit: (n) => log.credited.push(n),
    skills: () => SK, mintUid: () => 9001, day: () => 100, changed: () => {}, traded: () => {},
    canCarry: () => canCarry, ashore: (uid) => st.ashore.get(uid) ?? 0, forgetBoat: (uid) => log.forgot.push(uid),
    cabinHolds: (uid) => st.cabins.get(uid) ?? 0, cabinSold: () => 0, passengersAboard: () => st.aboard,
  });
  /** A ship of the player's: entered in the ledger, lying `where`, her boat standing when she stands. */
  const own = (uid, hull, where, { cargo = 0 } = {}) => {
    if (where === 'packed') { knowShip(uid, hull, 0, HULL_PRICES[hull]); log.pack.push(mintParts(hull, 0, uid)); } else titleDeed(mintDeed(hull, 0, uid, HULL_PRICES[hull]));
    st.where.set(uid, where);
    if (where === 'here' || where === 'laidup') st.boats.set(uid, { uid, hull, Cargo: { Items: Array.from({ length: cargo }, () => ({ name: 'crate' })) } });
  };
  return { log, st, host, own };
}

test('AUDIT SHIPYARDS THE SHIPMASTER\'S GUARDS THROUGH HIS ACT (L6-6): a placing armed with a ship\'s item is let go as she is sold - no ghost to sell twice (L1-1) - and a summons lets an armed placing go first (L1-9); her hands ashore by her number and her sea-fight record forgotten whatever the sea fight\'s switch (L1-6); another player aboard, a fight, her hold, a lay-up that failed and her cabin each refused; parts bought only into a pack that carries them (L1-4); a deed bought turns the window to her (L7-4)', () => {
  const r = tradeRig();
  r.own(501, 2, 'laidup');
  r.st.placing = fleetBook().find((d) => d.UID === 501);   // Bring her here, no berth: her deed armed for the click
  const sold = r.host.act(SITE, 'sell', 501);
  assert.equal(sold.ok, true, sold.text);
  assert.deepEqual([r.log.stops, r.st.placing, r.log.credited.length], [1, null, 1], 'her placing let go with the sale');
  assert.deepEqual(r.log.forgot, [501], 'her sea-fight record forgotten, the sea fight off');
  r.own(502, 2, 'laidup');
  r.st.placing = { UID: 777, templateIndex: 0 };   // another ship's placing stands
  assert.equal(r.host.act(SITE, 'sell', 502).ok, true);
  assert.equal(r.log.stops, 1, 'a sale lets go only a placing that holds her');
  r.own(503, 2, 'laidup');
  r.host.act(SITE, 'summon', 503);
  assert.deepEqual(r.log.fleetActs.at(-1), [503, 'summon', 2], 'the armed placing let go before the summons asks the water');
  // her hands ashore - packed, the sea fight off: by her number
  r.own(504, 0, 'packed');
  r.st.ashore.set(504, 1);
  assert.deepEqual(r.host.act(SITE, 'sell', 504), { ok: false, text: 'Some of the crew are ashore with you. Send them back aboard first.' });
  // each refusal through the act
  r.own(505, 2, 'here');
  r.st.aboard = 1;
  assert.equal(r.host.act(SITE, 'sell', 505).text, 'Another player is aboard.');
  r.st.aboard = 0;
  r.st.status.set(505, { hull: 100, maxHull: 100, inFight: true });
  assert.equal(r.host.act(SITE, 'sell', 505).text, 'Not while the ship is in combat.');
  r.st.status.delete(505);
  r.own(506, 2, 'here', { cargo: 2 });
  assert.equal(r.host.act(SITE, 'sell', 506).text, 'Empty the hold first. The shipmaster does not buy cargo.');
  r.st.layUp = false;
  assert.deepEqual(r.host.act(SITE, 'sell', 505), { ok: false, text: 'The ship couldn\'t be brought in to be sold.' });
  r.st.layUp = true;
  r.st.cabins.set(505, 3);
  assert.equal(r.host.act(SITE, 'sell', 505).text, 'Empty the cabin first. Anything left in it is sold with the ship.');
  // buying: the parts only into a pack that carries them; a deed's ship answers her page
  const heavy = tradeRig({ canCarry: false });
  const parts = heavy.host.act(SITE, 'buy', 0);
  assert.deepEqual([parts.ok, parts.text, heavy.log.paid.length, heavy.log.pack.length], [false, SHIPYARD_TEXT.heavy(mintParts(0, 0, 9001).name), 0, 0], 'no coin moves');
  const deed = r.host.act(SITE, 'buy', 2);
  assert.deepEqual([deed.ok, deed.page, deed.uid], [true, 'fleet', 9001], 'the window turns to her');
  assert.match(deed.text, /laid up at Sentinel\. Press Bring here/);
});

test('AUDIT SHIPYARDS CUSTOMS CROSSES THE FLEET (L1-2): every Come Sail Away ship a crossing save holds - the Fleet\'s records, the placed boats, the deeds and parts in its lists - is entered crossed in the Fleet\'s record, said on the customs page, kept through a save, and never bought by a shipmaster; a record\'s worth is never above a new hull of hers, and an offer is never below nothing', () => {
  _resetFleetForTests();
  const snap = { level: 5, goldPieces: 100, items: [mintParts(0, 0, 601)], wagonItems: [], bankAccounts: createBankAccounts(), sceneCache: null, dungeon: null, world: { piles: [] },
    modData: { [FLEET_SAVE_VENDOR]: { v: 1, ships: [{ uid: 501, hull: 2, variant: 0, value: HULL_PRICES[2] }] }, [COME_SAIL_AWAY_VENDOR]: { placedBoats: [{ UID: 502, Hull: 3 }, { UID: 501, Hull: 2 }] } } };
  const rep = applyCustoms(snap);
  assert.equal(rep.fleet, 3, 'three ships by number: a record, a placed boat (the record\'s twice), a pack\'s parts');
  assert.deepEqual([...snap.modData[FLEET_SAVE_VENDOR].crossed].sort(), [501, 502, 601]);
  assert.ok(customsLines(rep, { before: true }).includes('Your 3 boats will come with you; no shipyard in the realm buys a boat that comes through customs.'));
  restoreFleetSaveData(snap.modData[FLEET_SAVE_VENDOR]);
  assert.deepEqual([fleetCrossed(501), fleetCrossed(502), fleetCrossed(601), fleetCrossed(999)], [true, true, true, false]);
  assert.deepEqual(fleetSaveData().crossed.sort(), [501, 502, 601], 'kept through a save');
  // the shipmaster's refusal, through his act
  const r = tradeRig();
  restoreFleetSaveData({ v: 1, ships: [], crossed: [701] });
  r.own(701, 2, 'laidup');
  r.own(702, 2, 'laidup');
  assert.deepEqual(r.host.act(SITE, 'sell', 701), { ok: false, text: SHIPYARD_TEXT.crossed });
  assert.equal(r.host.act(SITE, 'sell', 702).ok, true, 'a ship bought in the realm sells');
  // a hand-made worth: no more than a new hull of hers - the counter's 32-bit haggle never reached - and no negative offer
  assert.equal(shipWorth({ hull: 2, value: 9_000_000 }), shipWorth({ hull: 2, value: HULL_PRICES[2] }));
  for (const skills of [{ mercantile: 40, personality: 50 }, { mercantile: 100, personality: 100 }]) {
    assert.ok(shipSalePrice(shipWorth({ hull: 3, value: 9_000_000 }), skills) > 0, 'the offer stands');
    assert.ok(shipSalePrice(50_000_000, skills) >= 0, 'never below nothing');
  }
});

test('AUDIT SHIPYARDS NO LOOP ONLINE, OVER THE SHIPYARD\'S OWN PRICES (L6-4): with the page online, what the shipmaster pays for any ship of his never reaches what he asks for her new, at any Mercantile and Personality (the old pin priced the counter directly - the shipyard\'s own path never ran); a worth past a few million never turns his offer negative', () => {
  const prev = globalThis.location;
  try {
    globalThis.location = { search: '?online' };
    for (const hull of SHIPYARD_HULLS) {
      const price = HULL_PRICES[hull];
      for (const mercantile of [5, 40, 75, 100, 150]) for (const personality of [10, 50, 100]) {
        const sk = { mercantile, personality };
        const asked = shipBuyPrice(price, sk), paid = shipSalePrice(shipWorth({ hull, value: price }), sk);
        assert.ok(paid > 0 && paid * 2 <= asked + 1, `${HULL_NAMES[hull]} at ${mercantile}/${personality}: paid ${paid}, asked ${asked}`);
      }
    }
    globalThis.location = { search: '' };
    assert.ok(shipSalePrice(shipWorth({ hull: 3, value: 9e9 }), { mercantile: 100, personality: 100 }) > 0, 'offline the worth is capped at her hull\'s price');
    assert.equal(shipSalePrice(-5e9, { mercantile: 100, personality: 100 }) >= 0, true, 'never below nothing');
  } finally { globalThis.location = prev; }
});
