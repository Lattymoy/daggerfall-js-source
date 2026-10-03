// SHIP-CREW and SEA-REPAIR (2026-09-30, Mac: "Let's do #1 and a way to repair ships on the high seas" - named crew
// with morale ("Gentle") and deck orders; "Carpenter's stores"). The pure laws (systems/naval/shipCrew.js, navalYard.js
// seaRepair and provisionOffer, navalStores.js), the living crew's answer to them (crewLife.js), and the real naval host
// (test/navalSea.mjs) - her hands named and fallen, her spirits, her orders, her repairs at sea, the yard's provisions,
// the save.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea, readyPool } from './navalSea.mjs';
import { navalHitData, NAVAL_HIT_MAX } from '../src/systems/naval/navalWire.js';
import { HULL, hullBuild } from '../src/systems/naval/navalShips.js';
import {
  createShipCrew, crewCard, orderRows, handName, spiritsOf, reloadScaleOf, mendScaleOf, handsBonusOf, CREW_ORDERS, ORDER_TEXT,
  MORALE_START, MORALE_EVENT, LOSSES_CAP, SEA_DECAY_S, PORT_RISE_S, PORT_CAP, SING_MIN, GUNS_RELOAD, HIGH_SPIRITS, LOW_SPIRITS,
} from '../src/systems/naval/shipCrew.js';
import { crewRoster, createCrewLife, CHANTY_FIRST_S } from '../src/systems/naval/crewLife.js';
import { seaRepair, wantsRepair, provisionOffer, grogPrice, SEA_REPAIR_PER_S, SEA_REPAIR_UNDER_FIRE, STORE_POINTS, STORE_PRICE, STORES_STOCK, FIELD_QUIET_S, FIELD_MEND_CAP, storesToWhole } from '../src/systems/naval/navalYard.js';
import { mintStores, storesIn, spendStore, STORES_TEMPLATE } from '../src/systems/naval/navalStores.js';
import { createGunDeck } from '../src/systems/naval/navalGunnery.js';
import { yardText } from '../src/ui/navalYardWindow.js';
import { helmButtons } from '../src/ui/enhancedHelm.js';
import { boatMenuRows, BOAT_VERB } from '../src/systems/csaBoatMenu.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const ship = (crew) => crewRoster({ hull: HULL.SmallShip, seed: 7, crew });

test('SHIP-CREW: HER HANDS HAVE NAMES AND ROLES - the waters\' own names off her seed, her First Mate first, her Bard her Bard, the rest dealt in turn; the guns take the last to join first and a hire joins with a new name; the save keeps them (mutants: the roles unset, the fallen order, a hire\'s name reused, the save dropped)', () => {
  const c = createShipCrew({ seed: 7 });
  const r24 = ship(24);
  const { joined } = c.sync(r24);
  assert.equal(joined.length, 4);
  assert.equal(c.hands[0].role, 'First Mate');
  assert.ok(c.hands.some((h) => h.role === 'Bard'), 'her Bard');
  assert.deepEqual(c.hands.filter((h) => h.role !== 'First Mate' && h.role !== 'Bard').map((h) => h.role), ['Bosun', 'Gunner']);
  assert.ok(c.hands.every((h) => /^\S+ \S+/.test(h.name)), 'a first name and a surname');
  assert.equal(new Set(c.hands.map((h) => h.name)).size, 4, 'four names');
  assert.equal(handName(7, 0, 'male'), handName(7, 0, 'male'), 'the same seed, the same name');
  const four = c.hands.map((h) => h.name);
  const { fell } = c.sync(ship(12));
  assert.deepEqual(fell.map((h) => h.name), [four[3], four[2]], 'the last to join falls first');
  const again = c.sync(r24).joined;
  assert.equal(again.length, 2);
  assert.ok(again.every((h) => !four.includes(h.name)), 'a hire is a new name, never a dead man\'s');
  const saved = createShipCrew({ seed: 999, record: JSON.parse(JSON.stringify(c.snapshot())) });
  assert.deepEqual(saved.hands.map((h) => h.name), c.hands.map((h) => h.name), 'the save keeps them');
  assert.equal(saved.sync(r24).joined.length, 0, 'and the next sync takes no new hands');
  const card = crewCard(c, { ship: 'The Small Ship', order: CREW_ORDERS.guns });
  assert.match(card[0], /spirits Steady \(60 of 100\)/);
  assert.equal(card[1], 'Standing order: Man the guns.');
  assert.ok(card.includes(`${c.hands[0].name}, First Mate`));
});

test('SHIP-CREW: THEIR SPIRITS (GENTLE) - a win, a prize, a hold filled and a round of grog lift them; a hand lost wears them, a fight\'s losses at most LOSSES_CAP until it is over; a wreck; the sea wears a point every SEA_DECAY_S, a port lifts one every PORT_RISE_S to PORT_CAP; the win counts on every hand (mutants: an event\'s sign, the cap, the fight\'s end, the port\'s cap, the sea\'s clock)', () => {
  const c = createShipCrew({ seed: 1 });
  c.sync(ship(24));
  assert.equal(c.morale, MORALE_START);
  c.event('win'); assert.equal(c.morale, MORALE_START + MORALE_EVENT.win);
  assert.ok(c.hands.every((h) => h.fights === 1), 'every hand stood the fight');
  c.event('boarding'); assert.ok(c.hands.every((h) => h.boardings === 1));
  assert.equal(c.morale, MORALE_START + MORALE_EVENT.win, 'a boarding stood is a count, not spirits');
  c.event('handLost', 10);
  assert.equal(c.morale, MORALE_START + MORALE_EVENT.win + LOSSES_CAP, 'a fight\'s losses capped');
  c.event('handLost', 1);
  assert.equal(c.morale, MORALE_START + MORALE_EVENT.win + LOSSES_CAP, 'still capped');
  c.fightOver();
  c.event('handLost', 1);
  assert.equal(c.morale, MORALE_START + MORALE_EVENT.win + LOSSES_CAP + MORALE_EVENT.handLost, 'a new fight counts afresh');
  const w = createShipCrew({ seed: 1 });
  w.event('wrecked'); assert.equal(w.morale, MORALE_START + MORALE_EVENT.wrecked);
  w.event('grog'); w.event('plunder'); w.event('prize');
  assert.equal(w.morale, MORALE_START + MORALE_EVENT.wrecked + MORALE_EVENT.grog + MORALE_EVENT.plunder + MORALE_EVENT.prize);
  // the clock carries what it has run past a point: 0.6 + 0.6 is one point, and 0.2 more of it runs into the next
  const k = createShipCrew({ seed: 1 });
  k.tick(SEA_DECAY_S * 0.6, { atSea: true }); k.tick(SEA_DECAY_S * 0.6, { atSea: true });
  assert.equal(k.morale, MORALE_START - 1);
  k.tick(SEA_DECAY_S * 0.85, { atSea: true });
  assert.equal(k.morale, MORALE_START - 2, 'the carry kept');
  const t = createShipCrew({ seed: 1 });
  t.tick(SEA_DECAY_S * 3 + 1, { atSea: true });
  assert.equal(t.morale, MORALE_START - 3, 'a long step\'s points spent at once (PIN MOVED: AUDIT CC-D4 - a backlog drained a point a frame)');
  for (let i = 0; i < 10; i++) t.tick(SEA_DECAY_S, { atSea: true });
  assert.equal(t.morale, MORALE_START - 13);
  for (let i = 0; i < 100; i++) t.tick(PORT_RISE_S, { inPort: true });
  assert.equal(t.morale, PORT_CAP, 'a port lifts them as far as PORT_CAP');
  t.event('grog'); t.tick(PORT_RISE_S * 5, { inPort: true });
  assert.equal(t.morale, PORT_CAP + MORALE_EVENT.grog, 'and never pulls a round back down');
  assert.equal(spiritsOf(90).label, 'Roaring'); assert.equal(spiritsOf(10).label, 'Grim'); assert.equal(spiritsOf(50).label, 'Steady');
});

test('SHIP-CREW: WHAT THEIR SPIRITS AND CREW_ORDERS DO - the reload quicker in high spirits and with her guns manned, slower in low; the mending the same; a boarding\'s hands one more in high spirits or at the rail, one fewer in low; no song under SING_MIN; the gun deck reads the scale (mutants: the reload unscaled, the guns order unread, the mending unscaled, the hands\' bonus, the song)', () => {
  assert.ok(reloadScaleOf(100) < reloadScaleOf(50) && reloadScaleOf(50) < reloadScaleOf(0));
  assert.equal(reloadScaleOf(50), 1);
  assert.ok(Math.abs(reloadScaleOf(50, CREW_ORDERS.guns) - GUNS_RELOAD) < 1e-12);
  assert.ok(mendScaleOf(100) > 1 && mendScaleOf(0) < 1 && mendScaleOf(50) === 1);
  assert.equal(handsBonusOf(HIGH_SPIRITS), 1); assert.equal(handsBonusOf(LOW_SPIRITS), -1); assert.equal(handsBonusOf(50), 0);
  assert.equal(handsBonusOf(50, CREW_ORDERS.rail), 1);
  const c = createShipCrew({ seed: 1 });
  assert.equal(c.sings(), true);
  for (let i = 0; i < 10; i++) c.event('wrecked');
  assert.equal(c.sings(), false, 'grim: no chanty');
  assert.ok(c.morale < SING_MIN);
  const deck = createGunDeck(HULL.SmallShip, { crewed: true, reloadScale: () => 0.5 });
  const full = createGunDeck(HULL.SmallShip, { crewed: true });
  deck.fired('starboard'); full.fired('starboard');
  assert.ok(Math.abs(deck.left('starboard') - full.left('starboard') * 0.5) < 1e-9, 'her reload scaled');
});

test('SHIP-CREW: THE CREW_ORDERS AND THE LIVING CREW - a crewed boat\'s four, a crewless boat\'s two, the standing one marked; her guns manned, her crew at the guns (a hurry, the battle\'s words); at the rail they muster; low spirits sing nothing; their own line said (mutants: the guns order not a fight, the rail unmustered, the song in low spirits, the line unread)', async () => {
  assert.deepEqual(orderRows({ crewed: true, order: CREW_ORDERS.guns }).map((r) => r.label), ['Man the guns (standing)', 'All hands to the rail', 'Make repairs', 'Stand down']);
  assert.deepEqual(orderRows({ crewed: false }).map((r) => r.id), [CREW_ORDERS.repair, CREW_ORDERS.stand]);
  const deck = (await readyPool()).deckOf(HULL.SmallShip, 0);   // her real deck
  const roster = ship(24);
  const run = (ctx, secs) => { const life = createCrewLife({ deck, roster, seed: 3 }); const said = []; for (let t = 0; t < secs; t += 0.1) { life.step(0.1, ctx); for (const l of life.speech()) said.push(l); } return { life, said }; };
  const rail = run({ order: 'rail' }, 5);
  assert.ok(rail.life.members.every((m) => m.state === 'ready' || m.state === 'toMuster'), 'all hands to the rail');
  const low = run({ sings: false }, CHANTY_FIRST_S[1] + 30);
  assert.ok(!low.said.some((l) => l.kind === 'sing'), 'low spirits: no chanty');
  const happy = run({}, CHANTY_FIRST_S[1] + 30);
  assert.ok(happy.said.some((l) => l.kind === 'sing'), 'steady spirits sing');
  const guns = run({ order: 'guns', line: () => 'Guns manned!' }, 200);
  assert.ok(guns.said.some((l) => l.text === 'Guns manned!'), 'their own line');
  assert.ok(!guns.said.some((l) => l.kind === 'sing'), 'no song at the guns');
});

test('SEA-REPAIR: THE REPAIRS AND THE STORES - her hull first, then her canvas, all the way to whole, at SEA_REPAIR_PER_S of the whole a second by her crew and spirits; a store for every STORE_POINTS of work (PIN MOVED: AUDIT CC-D1); none past the stores\' budget; the item stacks and spends one at a time (mutants: the canvas first, the cap kept, the budget unread, the stack spent whole)', () => {
  const d = { hull: 100, maxHull: 400, sail: 50, maxSail: 100 };
  const r = seaRepair(d, 10, { crewed: true, crewShare: 1 });
  assert.ok(Math.abs(r.hull - 400 * SEA_REPAIR_PER_S * 10) < 1e-9 && r.sail === 0, 'her hull first');
  const done = seaRepair({ hull: 399, maxHull: 400, sail: 50, maxSail: 100 }, 100, { crewed: true, crewShare: 1 });
  assert.ok(Math.abs(done.hull - 1) < 1e-9 && done.sail > 0, 'to whole, then her canvas');
  const past = seaRepair({ hull: 390, maxHull: 400, sail: 100, maxSail: 100 }, 1000, { crewed: true, crewShare: 1 });
  assert.ok(Math.abs(past.hull - 10) < 1e-9, 'never past whole - and past FIELD_MEND_CAP');
  assert.ok(FIELD_MEND_CAP < 1);
  const poor = seaRepair(d, 1000, { crewed: true, crewShare: 1, budget: STORE_POINTS });
  assert.ok(Math.abs(poor.work - STORE_POINTS) < 1e-9 && Math.abs(poor.hull - STORE_POINTS) < 1e-9, 'a store\'s worth and no more - on her hull first');
  assert.ok(Math.abs(seaRepair(d, 10, { crewed: false, crewShare: 0 }).hull - r.hull * 0.5) < 1e-9, 'alone, half');
  assert.equal(wantsRepair({ hull: 400, maxHull: 400, sail: 100, maxSail: 100 }), false);
  const items = [mintStores(3)];
  assert.equal(templateByIndex(STORES_TEMPLATE).name, 'Carpenter\'s Stores');
  assert.equal(storesIn(items), 3);
  assert.equal(spendStore(items), true); assert.equal(storesIn(items), 2);
  assert.equal(spendStore(items) && spendStore(items), true); assert.equal(storesIn(items), 0);
  assert.equal(spendStore(items), false);
  // the yard's provisions
  const o = provisionOffer({ stores: 3, morale: 40, crew: 24, crewed: true, gold: STORE_PRICE * 2 + 50 });
  assert.deepEqual(o.rows.map((x) => [x.id, x.missing, x.price, x.afford]), [['stores', STORES_STOCK - 3, STORE_PRICE, 2], ['grog', 1, grogPrice(24), 1]]);
  assert.deepEqual(provisionOffer({ stores: 0, morale: null, crew: 0, crewed: false, gold: 0 }).rows.map((x) => x.id), ['stores'], 'no grog for no crew');
});

/** A crewed Small Ship at sea on the real host - her hurts from a save, her stores in a hold of her own. */
async function atSea({ hull = 420, sail = 160, crew = 24, state = 'afloat', stores = 0 } = {}) {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  h.boat.crewed = true;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull, sail, crew, fire: 0, state, barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  const hold = stores ? [mintStores(stores)] : [];
  h.deps.stores = { count: () => storesIn(hold), spend: () => spendStore(hold), add: (b, n) => { hold.push(mintStores(n)); return true; } };
  h.hold = hold;
  return h;
}

test('SEA-REPAIR on the host: MAKE REPAIRS mends her to whole out of the fight\'s reach, spending her stores as the work is done; none aboard, the order refused in her First Mate\'s words; she wants none, the same; the stores spent, it stands down with a word; a wreck floats again; the plate says REPAIRING (mutants: the stores unspent, the quiet unread, the refusal unsaid, the stand-down unsaid)', async () => {
  const none = await atSea({ hull: 200 });
  none.host.frame(0.1);
  assert.equal(none.host.giveOrder(none.boat, CREW_ORDERS.repair).ok, false);
  assert.ok(none.log.say.some((l) => /no carpenter's stores aboard/.test(l)), 'no stores: refused');
  const whole = await atSea({ stores: 5 });
  whole.host.frame(0.1);
  assert.equal(whole.host.giveOrder(whole.boat, CREW_ORDERS.repair).ok, false);
  assert.ok(whole.log.say.some((l) => /needs no repairs/.test(l)));
  const h = await atSea({ hull: 210, sail: 160, stores: 10 });
  h.host.frame(0.1);
  const mate = h.host.crewOf(h.boat).hands[0].name;
  assert.equal(h.host.giveOrder(h.boat, CREW_ORDERS.repair).ok, true);
  assert.ok(h.log.say.includes(`${mate}: ${ORDER_TEXT.repair.said}`), 'her First Mate answers');
  for (let t = 0; t < FIELD_QUIET_S + 5; t += 0.1) h.host.frame(0.1);   // a save's hurts: quiet first
  assert.equal(h.host.hudModel().ship.repairing, true);
  // PIN MOVED (QUICK-REPAIRS): a pirate near - DAMAGE CONTROL, the work goes on under her guns at SEA_REPAIR_UNDER_FIRE of the
  // pace (it stood still while she threatened), and at the full pace once she is gone
  const pid = h.host.spawnShip('pirateBrig', { range: 200, temper: 'bold' });
  for (let t = 0; t < 1; t += 0.1) h.host.frame(0.1);
  const held = h.host.hudModel().ship.hull;
  for (let t = 0; t < 3; t += 0.1) { h.host._sea.get(pid).ship.pos = [0, 0, 200]; h.host.frame(0.1); }
  assert.equal(h.host.hudModel().ship.repairing, true, 'damage control with a pirate in the offing');
  const under = h.host.hudModel().ship.hull - held, pace = SEA_REPAIR_PER_S * mendScaleOf(h.host.crewOf(h.boat).morale) * 3;
  assert.ok(Math.abs(under - pace * SEA_REPAIR_UNDER_FIRE) < pace * 0.05, `made good at the pace under fire (${under.toFixed(4)} of ${(pace * SEA_REPAIR_UNDER_FIRE).toFixed(4)})`);
  h.host._sea.delete(pid);
  for (let t = 0; t < 400 && h.host.crewOf(h.boat).order === CREW_ORDERS.repair; t += 0.1) h.host.frame(0.1);
  assert.ok(Math.abs(h.host.hudModel().ship.hull - 1) < 1e-9, 'whole');
  assert.equal(h.host.crewOf(h.boat).order, CREW_ORDERS.stand, 'stood down');
  assert.ok(h.log.say.some((l) => /Repairs done/.test(l)));
  // half her hull made good is five stores' work, less the free mending's share
  assert.ok(storesIn(h.hold) >= 4 && storesIn(h.hold) <= 6, `stores spent as the work went (${storesIn(h.hold)} left)`);
  // too few stores: stands down with its word
  const short = await atSea({ hull: 0, state: 'wrecked', stores: 1 });
  short.host.frame(0.1);
  short.host.giveOrder(short.boat, CREW_ORDERS.repair);
  for (let t = 0; t < FIELD_QUIET_S + 120; t += 0.1) short.host.frame(0.1);
  assert.equal(short.host.hudModel().ship.wrecked, false, 'afloat again');
  assert.equal(storesIn(short.hold), 0);
  assert.ok(short.log.say.some((l) => /stores are spent/.test(l)));
  assert.equal(short.host.crewOf(short.boat).order, CREW_ORDERS.stand);
});

test('SHIP-CREW on the host: A HAND LOST FALLS BY NAME and wears their spirits; a ship struck to her lifts them; the order changes her reload; the save keeps her crew and her store part-spent; the yard sells stores into her hold and a round of grog; the plate says her spirits and her order (mutants: the fallen unsaid, the loss unfelt, the win unfelt, the save dropped, the grog unfelt)', async () => {
  const h = await atSea({ crew: 24 });
  h.host.frame(0.1);
  const c0 = h.host.crewOf(h.boat);
  assert.equal(c0.hands.length, 4);
  assert.equal(c0.morale, MORALE_START);
  // a hand lost: her crew's points down past a shown man - named as he falls, and felt
  const last = c0.hands[3];
  h.host._myState(h.boat).damage.apply({ hull: 0, sail: 0, crew: 7 }, 0);
  h.host.frame(0.1);
  assert.equal(h.host.crewOf(h.boat).hands.length, 3);
  assert.ok(h.log.say.includes(`${last.name}, ${last.role}, has fallen.`), 'named as he falls');
  assert.ok(h.host.crewOf(h.boat).morale < MORALE_START, 'and felt');
  // the win: a ship struck by me
  const w = await atSea();
  w.host.frame(0.1);
  const id = w.host.spawnShip('merchantGalleon', { range: 300 });
  const e = w.host._sea.get(id);
  w.host.frame(0.1);
  const m0 = w.host.crewOf(w.boat).morale;
  for (let left = Math.floor(e.ship.damage.hull - 1); left > 0; left -= NAVAL_HIT_MAX) w.host.applyPeerHit('local', navalHitData('local', { n: e.n, hull: Math.min(left, NAVAL_HIT_MAX) }));   // PIN MOVED (TOUGHER-SHIPS): her hull past one hit's most
  w.host.frame(0.1);
  assert.equal(e.ship.damage.state, 'struck');
  assert.equal(w.host.crewOf(w.boat).morale, m0 + MORALE_EVENT.win, 'she struck to us: spirits up');
  assert.ok(w.host.crewOf(w.boat).hands.every((x) => x.fights === 1), 'a fight on every hand');
  // orders and the reload
  w.host.giveOrder(w.boat, CREW_ORDERS.guns);
  assert.equal(w.host.crewOf(w.boat).order, CREW_ORDERS.guns);
  assert.equal(w.host.hudModel().ship.order, ORDER_TEXT.guns.label);
  assert.equal(w.host.hudModel().ship.spirits, spiritsOf(w.host.crewOf(w.boat).morale).label);
  // the save
  const s = w.host.getSaveData().boats[42];
  assert.ok(s.mates && s.mates.hands.length === 4 && Number.isFinite(s.credit), 'her crew and her store in the save');
  assert.equal(s.crew, 24, 'her crew\'s count its own key still');
  const back = await atSea();
  back.host.restoreSaveData({ v: 1, boats: { 42: s }, notoriety: {}, day: 1, raids: [] });
  back.host.frame(0.1);
  assert.deepEqual(back.host.crewOf(back.boat).hands.map((x) => x.name), w.host.crewOf(w.boat).hands.map((x) => x.name), 'the same names after a load');
  // the yard's provisions
  const y = await atSea({ stores: 2 });
  let purse = 100000; const paid = [];
  y.deps.gold = () => purse; y.deps.pay = (n) => { paid.push(n); purse -= n; };
  y.host.frame(0.1);
  let model = null;
  y.deps.openYard = (m) => { model = m; return true; };
  y.deps.where = ((w0) => () => ({ ...w0(), nearPort: true }))(y.deps.where);
  y.host.frame(0.1);
  y.host.activate();
  assert.ok(model, 'the yard\'s window');
  {
    const r = model.buyProvision('stores');
    assert.equal(r.ok, true); assert.equal(storesIn(y.hold), Math.max(STORES_STOCK, storesToWhole({ hull: 0, maxHull: hullBuild(HULL.SmallShip).hullHp, sail: 0, maxSail: hullBuild(HULL.SmallShip).sailHp })), 'her hold stocked to what her wreck takes (PIN MOVED: AUDIT CC-D1; TOUGHER-SHIPS: her build\'s)');
    const m0 = y.host.crewOf(y.boat).morale;
    assert.equal(model.buyProvision('grog').ok, true);
    assert.equal(y.host.crewOf(y.boat).morale, m0 + MORALE_EVENT.grog);
    const t = yardText(model);
    assert.deepEqual(t.provisions.map((x) => x.id), ['stores', 'grog']);
  }
});

test('SHIP-CREW, SEA-REPAIR: THE WORLD\'S WIRING - the stores are her hold\'s (Come Sail Away\'s cargo); her crew named off the seed her living crew stands on; a hand of mine speaks by name; her order, spirits and lines ride to her living crew; the helm panel\'s Orders and the boat\'s menu Crew and Give orders (mutants: a wire cut)', () => {
  assert.match(WORLD, /count: \(boat\) => storesIn\(boat\?\.Cargo\?\.Items\),/);
  assert.match(WORLD, /spend: \(boat\) => spendStore\(boat\?\.Cargo\?\.Items\),/);
  assert.match(WORLD, /crewSeed: \(boat\) => _crewSeedOf\(boat\),/);
  assert.match(WORLD, /const name = csa\.boats\.includes\(l\.key\) \? naval\?\.crewName\?\.\(l\.key, l\.member\.i\) : null;/);
  assert.match(WORLD, /_crewCtx\.order = ship\.mine\?\.order \?\? null; _crewCtx\.sings = ship\.mine\?\.sings \?\? true; _crewCtx\.line = ship\.mine\?\.line \?\? null;/);
  assert.match(WORLD, /orders: \(\) => \{ const b = csaRuntime\?\.state\?\.CurrentBoat; if \(b\) navalOrders\(b\); \},/);
  assert.match(WORLD, /if \(helm\) helm = \{ \.\.\.helm, orders: navalOn\(\) \};/);
  assert.ok(helmButtons({ hasSails: true, orders: true }).some((b) => b.act === 'orders' && b.kind === 'hook'), 'the panel\'s Orders');
  assert.ok(!helmButtons({ hasSails: true }).some((b) => b.act === 'orders'), 'none with the naval arc off');
  const rows = boatMenuRows({ boxes: new Set(['drive']), packable: true, naval: true, crewed: true }).map((r) => r.id);
  assert.ok(rows.includes(BOAT_VERB.crew) && rows.includes(BOAT_VERB.orders));
  assert.ok(!boatMenuRows({ boxes: new Set(['drive']), packable: true }).map((r) => r.id).includes(BOAT_VERB.orders), 'none with the naval arc off');
  assert.match(WORLD, /if \(verb === BOAT_VERB\.crew \|\| verb === BOAT_VERB\.orders \|\| verb === BOAT_VERB\.companions\) \{/);   // PIN MOVED (CREW-COMPANIONS; AUDIT CC-F: exact - an optional clause pinned nothing)   // PIN MOVED (CREW-COMPANIONS): the Companions row rides the same dispatch
});
