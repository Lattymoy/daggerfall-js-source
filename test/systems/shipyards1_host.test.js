// SHIPYARDS (2026-10-11): THE SHIPMASTER'S WINDOW - its host half (scenes/shipyardHost.js: each page's model and every
// act over the Fleet's host, the sea fight's, Come Sail Away's runtime and the purse), the window itself
// (ui/shipyardWindow.js: its tabs, its two-press sale and pay-off, a summons handing the water to the host), and its door
// (ui/naval/navalPlunderDoor.js's third slot). Design: bible/03-World/Shipyards.md.
import { byClass, keydown, Node_ } from '../chargenDom.mjs';   // the suite's minimal DOM (its side effect: the globals)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShipyardHost, SHIPYARD_PAGES, AT_HAND } from '../../src/scenes/shipyardHost.js';
import { mountShipyardWindow, shipCardText, fleetRowText, recruitText, SHIPYARD_TABS, SHIPYARD_TAB_ICONS } from '../../src/ui/shipyardWindow.js';
import { createShipyardOverlay, shipyardOpen, closeShipyard } from '../../src/ui/naval/navalPlunderDoor.js';
import { WARM_CHUNKS } from '../../src/ui/enhanced/enhancedChunk.js';
import { fleetShip, fleetBook, titleDeed, knowShip, _resetFleetForTests, shipLabel } from '../../src/systems/fleet.js';
import { shipBuyPrice, shipSalePrice, shipWorth, shipSpec, SHIPYARD_HULLS, SHIPYARD_TEXT, BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE } from '../../src/systems/shipyards.js';
import { recruitsOf, recruitFee, CREW_HALL_TEXT } from '../../src/systems/crewHall.js';
import { mintDeed, mintParts } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { HULL_PRICES, HULL_NAMES } from '../../src/systems/comeSailAway/comeSailAwayHulls.js';
import { hullBuild } from '../../src/systems/naval/navalShips.js';
import { CREW_PER_HAND } from '../../src/systems/naval/navalBoarding.js';

{   // the suite's DOM, a step nearer a browser for a window that greys its presses (test/ui/naval/nav_f_ui.test.js's own)
  const proto = Node_.prototype;
  const setAttr = proto.setAttribute;
  proto.setAttribute = function (k, v) { setAttr.call(this, k, v); if (k === 'disabled' || k === 'hidden') this[k] = true; };
  proto.removeAttribute = function (k) { delete this.attrs[k]; if (k === 'disabled' || k === 'hidden') this[k] = false; };
}

const SITE = Object.freeze({
  key: '4242:shipyard', kind: 'shipyard', mapId: 4242, regionIndex: 17, townName: 'Sentinel', name: 'Voss\'s Shipyard',
  keeper: { name: 'Halbrecht Voss' }, crewmaster: { name: 'Anna Wayrest' }, crewName: 'Wayrest\'s Crew Hall',
});
const SK = Object.freeze({ mercantile: 40, personality: 50 });

/** The shipmaster's world: the real Fleet ledger, a Fleet host that reads it, a sea fight and a Come Sail Away of fakes.
 *  The ledger is the module's one: a rig is used through before the next is made. */
function rig({ gold = 500000, csa = true, naval = true } = {}) {
  _resetFleetForTests();
  const log = { paid: [], credited: [], traded: 0, changed: 0, sold: [], laidUp: [], forgotBoats: [], forgotHolds: [], fleetActs: [], enlisted: [], released: [], yardBuys: [] };
  const st = { gold, pack: [], where: new Map(), boats: new Map(), hands: new Map(), away: new Map(), cabins: new Map(), held: new Map(), uid: 7000, day: 100 };
  const boatOf = (uid) => st.boats.get(uid) ?? null;
  const fleet = {
    model: () => ({ ships: [...st.where.keys()].map((uid) => fleetShip(uid)).filter(Boolean).map((rec) => ({
      uid: rec.uid, hull: rec.hull, label: shipLabel(rec), hullName: HULL_NAMES[rec.hull], name: rec.name, value: rec.value, where: st.where.get(rec.uid),
      status: { hull: 80, maxHull: 100, sail: 10, maxSail: 10, crew: CREW_PER_HAND * (st.hands.get(rec.uid)?.length ?? 0), maxCrew: hullBuild(rec.hull).crew }, upgrades: { ...rec.upgrades }, loan: null,
      can: { summon: null, away: null, repair: null, yard: null, refit: null },
    })) }),
    whereIs: (rec) => ({ where: st.where.get(rec.uid) ?? 'lost', boat: boatOf(rec.uid) }),
    act: (uid, verb, arg) => { log.fleetActs.push([uid, verb, arg]); return verb === 'summon' ? { ok: true, text: 'Click the water.', door: () => true } : { ok: true, text: `${verb} done` }; },
    offer: (uid) => ({ why: null, rows: [{ id: 'hold', label: 'Hold', what: 'Her hold', per: 0.25, tier: 0, max: 3, next: { gold: 600, mats: [] }, afford: true }], gold: st.gold, uid }),
  };
  const sea = {
    crewHands: (boat) => st.hands.get(boat.uid) ?? [],
    // AUDIT SHIPYARDS L6-1 (TEST THE SHAPE THE PRODUCER MINTS): navalHost.js awayOf answers her ROSTER PLACES ashore
    awayOf: (boat) => { const names = st.away.get(boat.uid) ?? new Set(); return new Set((st.hands.get(boat.uid) ?? []).flatMap((h, i) => (names.has(h.name) ? [i] : []))); },
    enlistHand: (boat, r) => { log.enlisted.push([boat.uid, r.name, r.trade]); const h = { name: r.name, role: r.trade, hall: r.id }; st.hands.set(boat.uid, [...(st.hands.get(boat.uid) ?? []), h]); return { ok: true, text: '', hand: h, raise: CREW_PER_HAND }; },
    releaseHand: (boat, name) => { log.released.push([boat.uid, name]); const hs = st.hands.get(boat.uid) ?? []; const h = hs.find((x) => x.name === name); if (!h) return { ok: false, text: 'There\'s no crew member by that name aboard.' }; st.hands.set(boat.uid, hs.filter((x) => x !== h)); return { ok: true, text: '', hand: h }; },
    forgetBoat: (uid) => log.forgotBoats.push(uid),
    // AUDIT SHIPYARDS L6-7: the shipwright's model as navalHost.js yardModelOf mints it (the yard window's own shape)
    yardModelOf: (boat) => ({
      uid: boat.uid, hasBarrels: false,
      ship: () => ({ hull: 80, maxHull: 100, sail: 10, maxSail: 10, crew: 18, maxCrew: 24, barrels: 0 }),
      offer: () => ({ gold: st.gold, rows: [{ id: 'hull', missing: 20, price: 5, cost: 100, afford: 20, whole: 100 }, { id: 'sail', missing: 0, price: 3, cost: 0, afford: 0, whole: 0 }, { id: 'crew', missing: 6, price: 30, cost: 180, afford: 6, whole: 180 }] }),
      provisions: () => ({ rows: [] }),
      buy: (id) => { log.yardBuys.push([boat.uid, id]); return { ok: true, text: `${id} mended` }; },
      buyAll: () => ({ ok: true, text: 'whole' }),
    }),
  };
  const sail = {
    state: { PackedCargoes: st.held },
    LayUpBoat: (boat) => { log.laidUp.push(boat.uid); return true; },
    forgetHold: (uid) => { log.forgotHolds.push(uid); return true; },
  };
  const deps = {
    fleet: () => fleet, naval: () => (naval ? sea : null), csa: () => (csa ? sail : null),
    pack: () => st.pack, addToPack: (it) => st.pack.push(it), gold: () => st.gold,
    pay: (n) => { st.gold -= n; log.paid.push(n); }, credit: (n) => { st.gold += n; log.credited.push(n); },
    skills: () => SK, traded: () => { log.traded++; }, mintUid: () => ++st.uid, day: () => st.day, changed: () => { log.changed++; },
    cabinHolds: (uid) => st.cabins.get(uid) ?? 0, cabinSold: (uid, region) => log.sold.push([uid, region]), passengersAboard: () => 0,
  };
  return { log, st, deps, host: createShipyardHost(deps) };
}
/** A ship of the player's, entered in the ledger, `where` she lies, her boat standing where she stands. */
function own(r, uid, hull, where, { value = HULL_PRICES[hull], hands = [] } = {}) {
  if (where === 'packed') { knowShip(uid, hull, 0, value); r.st.pack.push(mintParts(hull, 0, uid)); } else titleDeed(mintDeed(hull, 0, uid, value));
  r.st.where.set(uid, where);
  if (where === 'here' || where === 'sailing' || where === 'laidup') r.st.boats.set(uid, { uid, hull, Cargo: { Items: [] } });
  if (hands.length) r.st.hands.set(uid, hands.map((name) => ({ name, role: 'Deckhand' })));
}

test('SHIPYARDS THE HOST\'S PAGES: ships, fleet, yard, refits and the crew hall - each its model; the window\'s tabs in that order; a ship at hand is one at this port, at the helm or laid up', () => {
  assert.deepEqual([...SHIPYARD_PAGES], ['ships', 'fleet', 'yard', 'refits', 'crew']);
  assert.deepEqual(SHIPYARD_TABS.map((t) => t.id), [...SHIPYARD_PAGES]);
  assert.deepEqual([...AT_HAND], ['here', 'sailing', 'laidup']);
  const r = rig();
  const m = r.host.model(SITE, { page: 'ships' });
  assert.deepEqual([m.title, m.keeper, m.crewName, m.crewmaster, m.town, m.gold, m.sailing, m.sea], ['Voss\'s Shipyard', 'Halbrecht Voss', 'Wayrest\'s Crew Hall', 'Anna Wayrest', 'Sentinel', 500000, true, true]);
  assert.deepEqual(m.ships.map((s) => s.hull), [...SHIPYARD_HULLS]);
  for (const s of m.ships) {
    assert.equal(s.asked, shipBuyPrice(HULL_PRICES[s.hull], SK), 'the counter\'s haggle');
    assert.deepEqual({ ...s, asked: undefined, docks: undefined, why: undefined }, { ...shipSpec(s.hull), asked: undefined, docks: undefined, why: undefined });
  }
  assert.equal(m.ships.find((s) => s.hull === 3).docks, false, 'no quay takes a galley');
  assert.equal(r.host.model(SITE, { page: 'nowhere' }).page, 'ships', 'an unknown page: the first');
  const poor = rig({ gold: 5000 });
  const pm = poor.host.model(SITE, { page: 'ships' });
  assert.equal(pm.ships.find((s) => s.hull === 0).why, null);
  assert.equal(pm.ships.find((s) => s.hull === 2).why, SHIPYARD_TEXT.short(shipBuyPrice(HULL_PRICES[2], SK)));
  assert.ok(rig({ csa: false }).host.model(SITE, { page: 'ships' }).ships.every((s) => s.why === SHIPYARD_TEXT.noSail), 'Come Sail Away off: nothing to buy');
});

test('SHIPYARDS BUYING: a deed is entered in the Fleet\'s book waiting at this port, the Rowboat\'s parts go in the pack; the haggled price paid, the deal tallied - never with a purse short or Come Sail Away off, nor a hull the yard has not (mutants: the deed into the pack, unpaid)', () => {
  const r = rig();
  const price = shipBuyPrice(HULL_PRICES[4], SK);
  const res = r.host.act(SITE, 'buy', 4);
  assert.equal(res.ok, true);
  const rec = fleetShip(res.uid);
  assert.deepEqual([rec.hull, rec.value, rec.port], [4, HULL_PRICES[4], { name: 'Sentinel' }], 'her record, waiting at this port');
  assert.ok(fleetBook().some((d) => d.UID === res.uid && d.templateIndex === BOAT_DEED_TEMPLATE), 'her title in the book');
  assert.equal(r.st.pack.length, 0, 'no deed in the pack');
  assert.deepEqual(r.log.paid, [price]);
  assert.equal(res.text, SHIPYARD_TEXT.bought(shipLabel(rec), 'Sentinel'));
  assert.equal(r.log.traded, 1, 'a concluded deal\'s Mercantile tally');
  const row = r.host.act(SITE, 'buy', 0);
  assert.equal(row.ok, true);
  assert.deepEqual(r.st.pack.map((it) => [it.templateIndex, it.UID]), [[BOAT_PARTS_TEMPLATE, row.uid]], 'the Rowboat\'s parts in the pack');
  assert.equal(r.log.traded, 2);
  assert.equal(r.host.act(SITE, 'buy', 9).ok, false, 'no such hull');
  const poor = rig({ gold: 10 });
  assert.equal(poor.host.act(SITE, 'buy', 2).ok, false);
  assert.deepEqual(poor.log.paid, [], 'nothing paid');
  assert.equal(rig({ csa: false }).host.act(SITE, 'buy', 1).text, SHIPYARD_TEXT.noSail);
});

test('SHIPYARDS THE FLEET PAGE AND SELLING: each ship\'s worth and the shipmaster\'s offer for her; a ship he will not buy says why (her helm, her hold, her cabin\'s chests); sold, she is laid up first, her title and record gone, her sea state and hold let go, her cabin sold as a house\'s, the offer credited and tallied (mutants: unpaid, her title kept, her cabin kept)', () => {
  const r = rig();
  own(r, 501, 2, 'here');
  own(r, 502, 4, 'sailing');
  own(r, 503, 0, 'packed');
  own(r, 504, 1, 'laidup', { value: 2000 });
  r.st.held.set('504', [{ name: 'Rum' }]);
  r.st.cabins.set(501, 2);
  const fm = r.host.model(SITE, { page: 'fleet' });
  const row = (uid) => fm.fleet.find((x) => x.uid === uid);
  const worth = shipWorth(fleetShip(501), 0.8);
  assert.deepEqual([row(501).worth, row(501).offer], [worth, shipSalePrice(worth, SK)], 'her worth by her hull\'s state, and the offer');
  assert.match(row(501).sell, /cabin/, 'her cabin\'s chests');
  assert.match(row(502).sell, /helm/);
  assert.equal(row(503).sell, null, 'her parts in the pack: sold as they lie');
  assert.match(row(504).sell, /hold/, 'a laid-up hold');
  assert.equal(r.host.act(SITE, 'sell', 501).ok, false);
  assert.deepEqual(r.log.credited, [], 'refused: nothing paid');
  r.st.cabins.set(501, 0);
  const offer = row(501).offer;
  const sold = r.host.act(SITE, 'sell', 501);
  assert.equal(sold.ok, true);
  assert.equal(sold.text, SHIPYARD_TEXT.sold(shipLabel({ hull: 2, variant: 0 }), offer));
  assert.deepEqual(r.log.laidUp, [501], 'a standing boat leaves the water as a ship sent away');
  assert.equal(fleetShip(501), null, 'her record gone');
  assert.equal(fleetBook().some((d) => d.UID === 501), false, 'her title gone');
  assert.deepEqual([r.log.forgotBoats, r.log.forgotHolds, r.log.sold], [[501], [501], [[501, 17]]]);
  assert.deepEqual(r.log.credited, [offer]);
  assert.equal(r.log.traded, 1);
  const packed = r.host.act(SITE, 'sell', 503);
  assert.equal(packed.ok, true);
  assert.equal(r.st.pack.some((it) => it.UID === 503), false, 'her parts out of the pack');
  assert.equal(r.host.act(SITE, 'sell', 9999).ok, false, 'no such ship');
});

test('SHIPYARDS THE FLEET\'S OWN ACTS through the shipmaster - her summoning (its water handed to the host), her laying up, her name, her refits and a hand\'s post - and the yard and refit pages over the ships at hand', () => {
  const r = rig();
  own(r, 601, 2, 'here');
  own(r, 602, 4, 'away');
  const s = r.host.act(SITE, 'summon', 602);
  assert.equal(typeof s.door, 'function', 'a summons that wants the water clicked');
  r.host.act(SITE, 'rename', 601, 'Kestrel');
  r.host.act(SITE, 'refit', 601, 'hold');
  r.host.act(SITE, 'role', 601, { name: 'Bram', role: 'Gunner' });
  assert.deepEqual(r.log.fleetActs, [[602, 'summon', undefined], [601, 'rename', 'Kestrel'], [601, 'refit', 'hold'], [601, 'role', { name: 'Bram', role: 'Gunner' }]]);
  const y = r.host.model(SITE, { page: 'yard' });
  assert.deepEqual(y.choices.map((c) => c.uid), [601], 'a ship afar is not at hand');
  assert.equal(y.yard.uid, 601, 'the shipwright\'s own model, of the ship chosen');
  assert.equal(typeof y.yard.offer, 'function', 'as the sea fight mints it');
  const f = r.host.model(SITE, { page: 'refits' });
  assert.equal(f.refit.uid, 601);
  assert.match(rig({ naval: false }).host.model(SITE, { page: 'yard' }).why, /Naval Combat/);
  assert.match(rig().host.model(SITE, { page: 'refits' }).why, /No ship/);
});

test('SHIPYARDS THE CREW HALL: the day\'s roster less the names already serving, each recruit\'s fee and why not; a hire pays his fee and signs him on to the chosen ship; a hand paid off leaves - never one gone from the roster since, nor with the sea fight off (mutants: unpaid, the serving offered)', () => {
  const r = rig();
  const all = recruitsOf({ mapId: SITE.mapId, day: 100, regionIndex: SITE.regionIndex });
  own(r, 701, 2, 'here', { hands: [all[0].name, 'Bram'] });
  r.st.hands.get(701)[0].hall = all[0].id;   // PIN MOVED (AUDIT SHIPYARDS L2-9): a recruit serving her is known by his hall id
  own(r, 702, 4, 'laidup');
  own(r, 703, 1, 'here');   // a Large Boat: no crew
  const m = r.host.model(SITE, { page: 'crew', uid: 702 });
  assert.deepEqual(m.choices.map((c) => c.uid), [701, 702], 'the crewed ships at hand');
  assert.equal(m.uid, 702);
  assert.deepEqual(m.recruits.map((x) => x.id), all.slice(1).map((x) => x.id), 'a sailor serving her is not on the roster');
  for (const x of m.recruits) assert.deepEqual([x.fee, x.price, x.swap], [recruitFee(x.grade, x.trade), recruitFee(x.grade, x.trade), false], 'a man\'s share raised: his fee');
  const pick = m.recruits[0];
  const hired = r.host.act(SITE, 'hire', 702, pick.id);
  assert.equal(hired.ok, true);
  assert.equal(hired.text, CREW_HALL_TEXT.signed(pick.name, pick.trade, shipLabel(fleetShip(702))));
  assert.deepEqual(r.log.paid, [pick.fee]);
  assert.deepEqual(r.log.enlisted, [[702, pick.name, pick.trade]]);
  assert.equal(r.host.act(SITE, 'hire', 702, pick.id).text, CREW_HALL_TEXT.gone, 'signed on: gone from the hall');
  const off = r.host.act(SITE, 'payoff', 701, 'Bram');
  assert.deepEqual([off.ok, off.text], [true, CREW_HALL_TEXT.paidOff('Bram', shipLabel(fleetShip(701)))]);
  assert.equal(r.host.act(SITE, 'payoff', 701, 'Bram').ok, false, 'no such hand');
  assert.equal(r.host.act(SITE, 'hire', 703, pick.id).text, CREW_HALL_TEXT.noShip, 'a boat with no crew');
  const poor = rig({ gold: 50 });
  own(poor, 701, 2, 'here');
  const p = poor.host.model(SITE, { page: 'crew' });
  assert.ok(p.recruits.every((x) => x.why === CREW_HALL_TEXT.short(x.price)));
  assert.equal(poor.host.act(SITE, 'hire', 701, p.recruits[0].id).ok, false);
  assert.deepEqual(poor.log.enlisted, [], 'short: nobody signed');
  const dry = rig({ naval: false });
  own(dry, 701, 2, 'here');
  assert.equal(dry.host.model(SITE, { page: 'crew' }).why, CREW_HALL_TEXT.noSea);
  assert.equal(dry.host.act(SITE, 'hire', 701, 'x').text, CREW_HALL_TEXT.noSea);
});

test('SHIPYARDS THE WINDOW\'S WORDS: a ship\'s card (her figures, a galley lying off), a fleet row (where she lies, her worth and the offer), a recruit (grade, trade, class and record)', () => {
  const card = shipCardText({ ...shipSpec(3), asked: 150000, docks: false, why: null });
  assert.match(card.figs, /a crew of \d+, 8 named on deck/);
  assert.doesNotMatch(card.figs, /a ram/, 'BOARD-MAGNET: the galley is sold with no ram - the ram is gone');
  assert.equal(card.note, 'Too big for the quay. It anchors off the harbor.');
  assert.deepEqual([card.press, card.can], ['Buy - 150,000 gold', true]);
  const row = shipCardText({ ...shipSpec(0), asked: 4000, docks: true, why: 'short' });
  assert.match(row.figs, /no crew \(you sail it alone\)/);
  assert.deepEqual([row.can, row.why], [false, 'short']);
  const f = fleetRowText({ label: 'Kestrel', hullName: 'Small Ship', where: 'laidup', port: 'Sentinel', worth: 90000, offer: 40000, sell: null, upgrades: { hold: 1 }, can: {} });
  assert.match(f.worth, /^Worth 90,000 gold\. The shipmaster offers 40,000 gold\./);
  assert.equal(f.canSell, true);
  const t = recruitText({ name: 'Anna Voss', gradeLabel: 'Seasoned', trade: 'Gunner', className: 'Archer', sex: 'female', fights: 1, boardings: 3, line: 'Twelve years.', fee: 500, why: null });
  assert.equal(t.who, 'Seasoned Gunner - Archer, she has 1 fight, 3 boardings.');
  assert.deepEqual([t.quote, t.press], ['"Twelve years."', 'Sign on - 500 gold']);
  assert.equal(recruitText({ name: 'B', gradeLabel: 'Green', trade: 'Cook', className: 'Monk', sex: 'male', fights: 0, boardings: 0, line: '', fee: 180 }).who, 'Green Cook - Monk, he has never been in a fight.');
});

test('SHIPYARDS THE WINDOW MOUNTED: its tabs page the model; a ship bought, a ship sold and a hand paid off each take a SECOND press - never the click that asked (AUDIT SHIPYARDS L1-5: a double click is one press); a deed bought turns the window to her (L7-4); the Crew Hall, the Shipwright and the Refits pages mounted (L6-7); a summons hands its water to the host and the window makes way; the back key leaves', async () => {
  const r = rig();
  own(r, 801, 2, 'here', { hands: ['Bram'] });
  own(r, 802, 4, 'away');
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const exits = [], doors = [];
  let t = 1000;
  const pics = [];   // MENU-ORDER: her own picture, as the host draws her (scenes/shipPortraits.js)
  const view = mountShipyardWindow(host, { model: (v) => r.host.model(SITE, v), act: (verb, a, b) => r.host.act(SITE, verb, a, b), page: 'ships', onDoor: (d) => doors.push(d), onExit: (why) => exits.push(why), now: () => t,
    picture: (hull, where) => { pics.push([hull, where]); return Promise.resolve(hull === 0 ? null : `data:ship${hull}`); } });
  const click = (b) => b.dispatch('click', { stopPropagation() {} });
  const note = () => byClass(host, 'dfnaval-note')[0].textContent;
  const tab = (id) => byClass(host, 'dfyard-tab').find((b) => b.getAttribute('data-tab') === id);
  const selected = () => byClass(host, 'dfyard-tab').find((b) => b.getAttribute('aria-selected') === 'true')?.getAttribute('data-tab');
  assert.equal(byClass(host, 'dfyard-card').length, SHIPYARD_HULLS.length);
  // MENU-ORDER (bible/10-UI/Menu-Order.md f): each page its picture, each ship's card a ship
  assert.deepEqual(byClass(host, 'dfyard-tab').map((b) => b.getAttribute('data-dficon')), SHIPYARD_TABS.map((t) => SHIPYARD_TAB_ICONS[t.id]));
  assert.ok(byClass(host, 'dfyard-card').every((c) => byClass(c, 'dfyard-pic')[0]?.getAttribute('data-dficon') === 'ship'), 'a ship on every card');
  assert.deepEqual(pics.map(([h]) => h), SHIPYARD_HULLS, 'her own picture asked, once a hull');
  await Promise.resolve(); await Promise.resolve();
  const img = (hull) => byClass(byClass(host, 'dfyard-card').find((c) => c.getAttribute('data-hull') === String(hull)), 'dfyard-shipimg')[0];
  assert.ok(SHIPYARD_HULLS.filter((h) => h !== 0).every((h) => img(h).getAttribute('src') === `data:ship${h}`), 'set over her glyph as it lands');
  assert.ok(img(0).getAttribute('src') == null, 'none to be had: her glyph stands');
  click(tab('fleet')); click(tab('ships'));
  assert.equal(img(2).getAttribute('src'), 'data:ship2', 'kept - drawn again at once');
  assert.deepEqual(pics.map(([h]) => h), [...SHIPYARD_HULLS, 0], 'only the one never had is asked again');
  // buying: the first press asks, a second at once (a double click) does nothing, a second a beat later buys
  const buyBtn = () => byClass(byClass(host, 'dfyard-card').find((c) => c.getAttribute('data-hull') === '1'), 'dfnaval-take')[0];
  click(buyBtn());
  assert.deepEqual([r.log.paid.length, /Press again to confirm/.test(note())], [0, true], 'the first press asks');
  click(buyBtn());
  assert.equal(r.log.paid.length, 0, 'a double click is one press');
  t += 400;
  click(buyBtn());
  assert.equal(r.log.paid.length, 1, 'the second press buys');
  assert.equal(selected(), 'fleet', 'a deed bought: the window turns to her on Your fleet');
  // selling, the same way
  const rowOf = (uid) => byClass(host, 'dfyard-row').find((x) => x.getAttribute('data-uid') === String(uid));
  const sellBtn = () => byClass(rowOf(801), 'dfnaval-btn').find((b) => /^Sell$|^Yes - sell/.test(b.textContent));
  click(sellBtn());
  assert.equal(r.log.credited.length, 0, 'the first press asks');
  assert.match(note(), /Press again to confirm/);
  click(sellBtn());
  assert.equal(r.log.credited.length, 0, 'not the click that asked');
  t += 400;
  click(sellBtn());
  assert.equal(r.log.credited.length, 1, 'the second sells');
  assert.equal(rowOf(801), undefined, 'gone from the fleet');
  // the Crew Hall: a hand paid off by a second press
  own(r, 803, 2, 'here', { hands: ['Odo', 'Bram'] });
  click(tab('crew'));
  const payBtn = () => byClass(byClass(host, 'dfyard-row').find((x) => byClass(x, 'dfnaval-btn').some((b) => /^Pay off|^Yes - pay/.test(b.textContent)) && x.textContent?.includes?.('Bram') !== false && /Bram/.test(JSON.stringify(x.textContent ?? ''))) ?? byClass(host, 'dfyard-row')[1], 'dfnaval-btn').find((b) => /^Pay off|^Yes - pay/.test(b.textContent));
  click(payBtn());
  assert.deepEqual(r.log.released, [], 'the first press asks');
  t += 400;
  click(payBtn());
  assert.equal(r.log.released.length, 1, 'the second pays him off');
  // the Shipwright and the Refits pages stand on the chosen ship
  click(tab('yard'));
  assert.equal(selected(), 'yard');
  assert.ok(byClass(host, 'dfnaval-sechead').some((h) => /The shipwright/.test(h.textContent)), 'the shipwright\'s page');
  const mend = byClass(byClass(host, 'dfyard-row').find((x) => x.getAttribute('data-row') === 'hull'), 'dfnaval-btn')[0];
  click(mend);
  assert.equal(r.log.yardBuys.length, 1, 'a shipwright\'s row pressed is his work bought');
  click(tab('refits'));
  assert.ok(byClass(host, 'dfyard-row').some((x) => x.getAttribute('data-line') === 'hold'), 'the refits\' lines');
  const refit = byClass(byClass(host, 'dfyard-row').find((x) => x.getAttribute('data-line') === 'hold'), 'dfnaval-btn')[0];
  click(refit);
  assert.ok(r.log.fleetActs.some(([, verb, line]) => verb === 'refit' && line === 'hold'), 'a refit pressed is the Fleet\'s act');
  click(tab('fleet'));
  const summon = byClass(rowOf(802), 'dfnaval-btn').find((b) => b.textContent === 'Bring here');
  click(summon);
  assert.equal(doors.length, 1, 'the summons\' water handed to the host');
  assert.deepEqual(exits, ['door'], 'and the window makes way');
  keydown('Escape');
  assert.deepEqual(exits, ['door', 'close'], 'the back key leaves');
  view.unmount();
  host.remove();
});

test('SHIPYARDS THE DOOR: the shipmaster\'s window a third slot of the sea fight\'s door - one at a time, shut by the host (a load, a re-anchor), its chunk warmed', () => {
  const r = rig();
  const deps = { model: (v) => r.host.model(SITE, v), act: (verb, a, b) => r.host.act(SITE, verb, a, b), page: 'fleet' };
  assert.equal(shipyardOpen(), false);
  const a = createShipyardOverlay(deps);
  assert.ok(a && shipyardOpen());
  const b = createShipyardOverlay(deps);
  assert.equal(a.done, true, 'one at a time');
  assert.equal(closeShipyard(), true);
  assert.equal(b.done, true);
  assert.equal(shipyardOpen(), false);
  assert.equal(closeShipyard(), false);
  assert.ok(WARM_CHUNKS.some((f) => String(f).includes('shipyardWindow.js')), 'warmed');
});
