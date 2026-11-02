// CREW-TRADE (2026-10-23, the owner: "If you could, please add crew as a resource that can be sold and traded"; asked, the
// owner chose "Exchange good only", "Headcount only" and "Port price, varies"; bible/03-World/Captains-Sea.md CREW-TRADE) -
// crew is a row of every port's exchange: a port has sailors to spare, is short of them or neither, a man is priced as
// a good by that stand and the day's drift, and the exchange signs men on to the ship at the quay and takes them off her
// by the head. Never above the shipwright's price for a man, never her last man, never a hand ashore's place, never a
// crossed ship's crew. The office and the window driven over the REAL sea fight's yard model (test/navalSea.mjs - TEST
// THE SHAPE THE PRODUCER MINTS). tools/mutants/crewtrade.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BAY, ISLE, portStanding, quay } from './crewQuay.mjs';
import { CREW, CREW_BASE, crewStandOf, exchangeOf, priceOf, standOf, DAY_STOCK, MADE_K, WANT_K, PRICE_DRIFT, SPREAD, TRADE_MOST } from '../../../src/systems/naval/tradeGoods.js';
import { crewRowOf, crewPayMost, yardHandPrice, crewSpare, crewRoom, CREW_LEAST, CREW_TRADE_TEXT, signOffOrder, handsNamed } from '../../../src/systems/naval/crewTrade.js';
import { FIRST_MATE } from '../../../src/systems/naval/shipCrew.js';
import { REPAIR_PRICE } from '../../../src/systems/naval/navalDamage.js';
import { YARD_DISCOUNT_MAX } from '../../../src/systems/naval/navalYard.js';
import { RANK_PERKS } from '../../../src/systems/naval/captainLedger.js';
import { CREW_HALL_TEXT } from '../../../src/systems/crewHall.js';
import { playerCrewCount } from '../../../src/systems/naval/crewLife.js';
import { exchangeText } from '../../../src/ui/naval/navalYardWindow.js';
import { townExchangeFactors } from '../../../src/net/townEconLaw.js';
import { restoreFleetSaveData, _resetFleetForTests } from '../../../src/systems/fleet.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const SMALL_SHIP = 2, LARGE_BOAT = 1;
test('CREW-TRADE a port and its sailors: a third of the Bay\'s ports each has men to spare, is short of them or neither - neighbours mixed, the same on every reading (the key\'s own) - and every isle of the Veil is short of them; crew\'s base half the shipwright\'s man (mutants: the draw, the isles, the base)', () => {
  assert.equal(CREW_BASE, REPAIR_PRICE.crew / 2, 'pinned equal: half what the shipwright asks for a man');
  assert.deepEqual([CREW.id, CREW.unit, CREW.units, CREW.kg, CREW.base], ['crew', 'man', 'men', 0, CREW_BASE]);
  const tally = { makes: 0, wants: 0, neither: 0 };
  for (const p of BAY) { const s = crewStandOf(p); assert.equal(crewStandOf({ key: p.key }), s, `${p.key}: the key's own`); assert.equal(standOf(p, 'crew'), s, 'standOf reads it'); tally[s]++; }
  for (const [s, n] of Object.entries(tally)) assert.ok(n >= BAY.length / 4, `${s}: ${n} of ${BAY.length}`);
  const row = BAY.slice(0, 30).map(crewStandOf);
  assert.ok(row.some((s, i) => i > 0 && s !== row[i - 1]) && new Set(row.slice(0, 6)).size > 1, `a row of neighbours mixed: ${row.slice(0, 6)}`);
  assert.equal(crewStandOf(ISLE), 'wants', 'the Veil is short of sailors');
  assert.equal(crewStandOf({ key: '1,1', ether: true }), 'wants');
});

test('CREW-TRADE crew\'s row is a good\'s: first at the exchange when asked for (never otherwise - every other row as it was), priced by its stand and the day\'s drift about its base - a man of either sea\'s own at an isle, never exotic - with the exchange\'s spread and its day\'s stock, the captain\'s dealing counted off (mutants: the row first, the flag, the isle exotic, the stand read)', () => {
  for (const port of [portStanding('makes'), portStanding('wants'), portStanding('neither'), ISLE]) {
    for (const day of [3, 40, 211]) {
      const plain = exchangeOf(port, day), all = exchangeOf(port, day, {}, 0, null, true);
      assert.deepEqual(plain.map((r) => r.id).includes('crew'), false, 'not asked for: no crew');
      assert.deepEqual(all.slice(1), plain, `${port.name}: every other row as it was`);
      const r = all[0], p = priceOf(port, 'crew', day), stand = crewStandOf(port);
      assert.deepEqual([r.id, r.name, r.unit, r.units, r.kg, r.stand, r.exotic], ['crew', 'Crew', 'man', 'men', 0, stand, false]);
      const mood = stand === 'makes' ? MADE_K : stand === 'wants' ? WANT_K : 1;
      assert.ok(p.mid >= CREW_BASE * mood * (1 - PRICE_DRIFT) - 1e-9 && p.mid <= CREW_BASE * mood * (1 + PRICE_DRIFT) + 1e-9, `${port.name} ${day}: ${p.mid} about ${CREW_BASE * mood}`);
      assert.deepEqual([r.sell, r.buy], [Math.max(2, Math.round(p.mid * (1 + SPREAD))), Math.max(1, Math.min(r.sell - 1, Math.round(p.mid * (1 - SPREAD))))]);
      assert.deepEqual([r.sells, r.buys], [DAY_STOCK[stand].sell, DAY_STOCK[stand].buy]);
    }
  }
  assert.notEqual(priceOf(BAY[0], 'crew', 3).mid, priceOf(BAY[0], 'crew', 4).mid, 'the day\'s drift');
  const wants = portStanding('wants');
  for (const day of [3, 40, 211]) assert.equal(priceOf({ ...wants, ether: true }, 'crew', day).mid, priceOf(wants, 'crew', day).mid, 'a man at an isle short of sailors is priced as at a port of the Bay short of them - never the other sea\'s exotic price');
  const spare = portStanding('makes');
  const dealt = exchangeOf(spare, 3, { bought: { crew: 12 }, sold: { crew: 3 } }, 0, null, true)[0];
  assert.deepEqual([dealt.sells, dealt.buys], [DAY_STOCK.makes.sell - 12, DAY_STOCK.makes.buy - 3], 'the day\'s dealing counted off');
  const short = portStanding('wants');
  assert.ok(priceOf(short, 'crew', 9).mid > 1.8 * priceOf(spare, 'crew', 9).mid, 'a man dear where sailors are short, cheap where they are to spare');
});

test('CREW-TRADE NO MAN FETCHES THE SHIPWRIGHT\'S PRICE: at every discount a rank gives, every port and day, the captain\'s stars and a town\'s every factor, the exchange pays a gold under what the shipwright asks for a man at most - so no number of men hired at the yard sells at the exchange for anything - and never what it asks (mutants: the cap, the cap\'s gold, the yard\'s price unread)', () => {
  assert.equal(yardHandPrice(0), REPAIR_PRICE.crew);
  assert.deepEqual([crewPayMost(0), crewPayMost(0.2), crewPayMost(0.05), crewPayMost(YARD_DISCOUNT_MAX)], [29, 23, 28, 14], 'a gold under the yard\'s man (28.5 asks 29 of one)');
  assert.equal(yardHandPrice(0.05), 28.5);
  let capped = 0;
  for (const discount of [...RANK_PERKS.map((k) => k.yard), YARD_DISCOUNT_MAX]) {   // AUDIT CREW-TRADE P13: every rank's own favour, and the yard's ceiling
    const yard = yardHandPrice(discount);
    for (const port of [...BAY.slice(0, 60), ISLE]) {
      for (const day of [1, 17, 99]) {
        for (const edge of [0, TRADE_MOST]) {
          for (const town of [null, townExchangeFactors(100), townExchangeFactors(0)]) {
            const r = crewRowOf(port, day, { edge, town, discount });
            const raw = exchangeOf(port, day, {}, edge, town, true)[0];
            if (raw.buy > r.buy) capped++;
            assert.ok(r.buy >= 1 && r.buy < r.sell, `${port.name}: pays ${r.buy} under ${r.sell}`);
            for (const n of [1, 7, 60]) assert.ok(n * r.buy < Math.ceil(n * yard - 1e-9), `${port.name} ${day} at ${discount}: ${n} men paid ${n * r.buy}, the yard asks ${Math.ceil(n * yard)}`);
          }
        }
      }
    }
  }
  assert.ok(capped > 0, 'the cap is what holds a short port\'s price at a high rank');
});

test('CREW-TRADE WHO MAY LEAVE HER: men by the head, never her last; never so many that her deck stands no named hand aboard beside the shore party (PIN MOVED, AUDIT CREW-TRADE H1: by the party\'s count, its hands never signed off - not by the last one\'s roster place); none of a ship come through customs - and the room she has for more (mutants: the last man, the shore party, the hand beside it, the customs, the room)', () => {
  assert.equal(CREW_LEAST, 1);
  const hands = ['A', 'B', 'C', 'D'].map((name) => ({ name }));
  assert.deepEqual(crewSpare({ hull: SMALL_SHIP, crew: 24, hands }), { n: 23, why: null }, 'all but her last');
  assert.deepEqual(crewSpare({ hull: SMALL_SHIP, crew: 1, hands: hands.slice(0, 1) }), { n: 0, why: CREW_TRADE_TEXT.lastMan });
  assert.deepEqual(crewSpare({ hull: SMALL_SHIP, crew: 0, hands: [] }), { n: 0, why: CREW_TRADE_TEXT.lastMan });
  assert.equal(CREW_TRADE_TEXT.lastMan, CREW_HALL_TEXT.lastMan, 'the crew hall\'s words, routed (AUDIT CREW-TRADE O3)');
  // one hand ashore: her deck must still stand two - his place and one aboard beside him - 9 men (a man a CREW_PER_HAND,
  // rounded), so fifteen may go; wherever he stands in her roster
  for (const who of ['A', 'C', 'D']) assert.equal(crewSpare({ hull: SMALL_SHIP, crew: 24, hands, away: new Set([who]) }).n, 24 - 9, `${who} ashore`);
  assert.deepEqual([playerCrewCount(SMALL_SHIP, 9), playerCrewCount(SMALL_SHIP, 8)], [2, 1], 'one fewer and nobody stands aboard beside him');
  // two ashore: three places - 15 men
  assert.equal(crewSpare({ hull: SMALL_SHIP, crew: 24, hands, away: new Set(['B', 'C']) }).n, 24 - 15);
  assert.deepEqual(crewSpare({ hull: SMALL_SHIP, crew: 15, hands: hands.slice(0, 3), away: new Set(['B', 'C']) }), { n: 0, why: CREW_TRADE_TEXT.ashore('C') }, 'the shore party\'s words (AUDIT CREW-TRADE H2)');
  assert.match(CREW_TRADE_TEXT.ashore('C'), /^C is in your shore party\. /);
  assert.deepEqual(crewSpare({ hull: SMALL_SHIP, crew: 24, hands, crossed: true }), { n: 0, why: CREW_TRADE_TEXT.crossed });
  assert.deepEqual([crewRoom({ crew: 10, maxCrew: 24 }), crewRoom({ crew: 24, maxCrew: 24 }), crewRoom({ crew: 30, maxCrew: 24 })], [14, 0, 0]);
});

test('CREW-TRADE AT THE QUAY, over the real sea: the shipwright\'s window\'s model carries her crew (`crewDeal`), and the exchange lists crew first - her crew aboard, her whole, the men more she takes - beside her hold\'s goods read off the same model; a hull with no crew lists none (mutants: the deal wired, the row listed, the model\'s hold)', async () => {
  const q = await quay(SMALL_SHIP, 12);
  assert.equal(typeof q.model.crewDeal?.stands, 'function', 'the yard\'s model carries her crew');
  const x = q.x();
  const r = x.rows[0];
  assert.deepEqual([r.id, r.have, r.whole, r.room, r.spare], ['crew', 12, 24, 12, 11]);
  assert.deepEqual(x.rows.slice(1).map((g) => g.id), exchangeOf(q.port, q.day).map((g) => g.id), 'her goods after it');
  assert.equal(x.weight, 0, 'her hold read off the model (cargo())');
  const none = await quay(LARGE_BOAT, 0);
  assert.ok(!none.x().rows.some((g) => g.id === 'crew'), 'a Large Boat carries no crew to deal in');
  assert.deepEqual(none.x().buy('crew', 1), { ok: false, text: CREW_TRADE_TEXT.noCrew });
});

test('CREW-TRADE SIGNED ON: men bought at the port\'s price into her crew - as many as the exchange signs on today, the purse pays for and her whole takes - the named hands who join her said in the note (AUDIT CREW-TRADE H3), the day\'s dealing kept, the purse paid (mutants: the room, the purse, the stock, the ledger, the pay, the joined unsaid)', async () => {
  const q = await quay(SMALL_SHIP, 6);
  const row = q.x().rows[0];
  const had = new Set(q.s.host.crewHands(q.s.boat).map((h) => h.name));
  const r = q.x().buy('crew', 10);
  const joined = q.s.host.crewHands(q.s.boat).filter((h) => !had.has(h.name));
  assert.equal(joined.length, 2, 'two named hands joined her');
  // PIN MOVED (AUDIT CREW-TRADE H3): the hands who joined her named, as the shipwright's hire names them
  assert.deepEqual(r, { ok: true, text: `${CREW_TRADE_TEXT.bought(10, 10 * row.sell)} ${CREW_TRADE_TEXT.signedOn(handsNamed(joined))}` });
  assert.match(r.text, new RegExp(`Signed on: ${joined[0].name} \\(${joined[0].role}\\), ${joined[1].name} \\(${joined[1].role}\\)\\.$`));
  assert.equal(q.model.ship().crew, 16);
  assert.equal(q.purse.gold, 100000 - 10 * row.sell);
  assert.equal(q.s.host.crewHands(q.s.boat).length, playerCrewCount(SMALL_SHIP, 16), 'her deck stands her new men, named');
  assert.equal(q.st.lastCrew, 16, 'no loss on her spirits\' books');
  assert.equal(q.ledger.dealtAt(q.port.key, q.day).bought.crew, 10);
  assert.equal(q.x().rows[0].sells, DAY_STOCK.makes.sell - 10, 'the exchange signs fewer on today');
  const all = q.x().buy('crew', Infinity);
  assert.equal(all.ok, true);
  assert.equal(q.model.ship().crew, 24, 'her whole, and no more');
  assert.deepEqual(q.x().buy('crew', 1), { ok: false, text: CREW_TRADE_TEXT.full });
  // a purse short of a man
  const poor = await quay(SMALL_SHIP, 6, { gold: 3 });
  const price = poor.x().rows[0].sell;
  assert.deepEqual(poor.x().buy('crew', 1), { ok: false, text: CREW_TRADE_TEXT.short(price) });
  assert.equal(poor.model.ship().crew, 6);
  // the day's stock spent
  const short = await quay(SMALL_SHIP, 6, { port: portStanding('wants') });
  assert.equal(short.x().buy('crew', 99).ok, true);
  assert.equal(short.model.ship().crew, 6 + DAY_STOCK.wants.sell);
  assert.deepEqual(short.x().buy('crew', 1), { ok: false, text: CREW_TRADE_TEXT.noneToday });
});

test('CREW-TRADE SIGNED OFF: men sold out of her crew at the port\'s price - never her last, as many as the exchange takes today - her named hands past her deck paid off the crew hall\'s way, the least worth losing first and each named (PIN MOVED, AUDIT CREW-TRADE H1: the tail went first, and a hall\'s recruit stands there), a recruit\'s lift leaving with him, no loss on her spirits\' books, nobody said fallen; the gold, the ledger\'s dealing and the log\'s trade (mutants: the last man, the stock, the order, the release, the books, the credit, the paid off unsaid)', async () => {
  const q = await quay(SMALL_SHIP, 24, { port: portStanding('wants') });
  const recruit = { id: '4242:1:0', name: 'Brynja Holt', trade: 'Gunner', mobile: 0, sex: 'female', lift: 6 };
  q.s.host.swapHand(q.s.boat, q.s.host.crewHands(q.s.boat).at(-1).name, recruit);
  const lifted = q.st.crew.morale;
  const before = q.s.host.crewHands(q.s.boat);
  assert.deepEqual([before.at(-1).name, before.at(-1).hall], ['Brynja Holt', '4242:1:0'], 'a hall\'s recruit at her roster\'s tail');
  const leaving = signOffOrder(before).slice(0, 2);
  assert.ok(!leaving.some((h) => h.name === 'Brynja Holt' || h.role === FIRST_MATE), `neither the recruit nor her First Mate among the first to go: ${handsNamed(leaving)}`);
  const row = q.x().rows[0];
  const r = q.x().sell('crew', 10);
  assert.deepEqual(r, { ok: true, text: `${CREW_TRADE_TEXT.sold(10, 10 * row.buy)} ${CREW_TRADE_TEXT.paidOff(handsNamed(leaving))}` });
  assert.equal(q.model.ship().crew, 14);
  assert.equal(q.purse.gold, 100000 + 10 * row.buy);
  const hands = q.s.host.crewHands(q.s.boat);
  assert.equal(hands.length, playerCrewCount(SMALL_SHIP, 14));
  assert.deepEqual(hands.map((h) => h.name).sort(), before.filter((h) => !leaving.includes(h)).map((h) => h.name).sort(), 'the least worth losing went');
  assert.ok(hands.some((h) => h.name === 'Brynja Holt'), 'the hall\'s recruit stays while a plain hand stands');
  assert.equal(q.st.crew.morale, lifted, 'and so do the spirits she lifted');
  assert.equal(q.st.lastCrew, 14, 'no loss on her spirits\' books');
  q.s.log.say.length = 0;
  q.s.run(0.3);
  assert.ok(!q.s.log.say.some((t) => /has fallen/.test(t)), `nobody said fallen: ${q.s.log.say}`);
  assert.equal(q.ledger.dealtAt(q.port.key, q.day).sold.crew, 10);
  assert.equal(q.ledger.log.traded, 10 * row.buy, 'the log\'s trade');
  const mate = hands.find((h) => h.role === FIRST_MATE);
  assert.ok(mate, 'her First Mate stands');
  const rest = q.x().sell('crew', Infinity);
  assert.equal(rest.ok, true, rest.text);
  assert.equal(q.model.ship().crew, 1, 'all but her last');
  assert.deepEqual(q.s.host.crewHands(q.s.boat).map((h) => h.name), [mate.name], 'her First Mate the last to go: he stands to her last man');
  assert.equal(q.st.crew.morale, lifted - 6, 'the recruit gone, the spirits she lifted with her');
  assert.deepEqual(q.x().sell('crew', 1), { ok: false, text: CREW_TRADE_TEXT.lastMan });
  // the day's taking spent at a port with men to spare
  const spare = await quay(SMALL_SHIP, 24, { port: portStanding('makes') });
  assert.equal(spare.x().sell('crew', Infinity).ok, true);
  assert.equal(spare.model.ship().crew, 24 - DAY_STOCK.makes.buy);
  assert.deepEqual(spare.x().sell('crew', 1), { ok: false, text: CREW_TRADE_TEXT.noneWanted });
});

test('CREW-TRADE REFUSED: never in a fight; never a hand of the shore party, nor her last hand aboard beside it (PIN MOVED, AUDIT CREW-TRADE H1/H2 - the party\'s words); never a ship come into the realm through customs (her crew an offline save\'s) - though men may still sign on to her (mutants: the fight, the shore party, the customs read)', async () => {
  const f = await quay(SMALL_SHIP, 12);
  f.st.inFight = true;
  assert.deepEqual(f.x().buy('crew', 1), { ok: false, text: CREW_TRADE_TEXT.fighting });
  assert.deepEqual(f.x().sell('crew', 1), { ok: false, text: CREW_TRADE_TEXT.fighting });
  assert.equal(CREW_TRADE_TEXT.fighting, CREW_HALL_TEXT.fighting, 'the crew hall\'s words, routed (AUDIT CREW-TRADE O3)');
  assert.equal(f.model.ship().crew, 12);
  const a = await quay(SMALL_SHIP, 24, { port: portStanding('wants') });
  const hs = a.s.host.crewHands(a.s.boat);
  a.s.host.companionPress(a.s.boat, hs[2].name, 0);
  assert.equal(a.x().rows[0].spare, 15, 'her third hand ashore: her deck keeps his place and one beside him');
  const off = a.x().sell('crew', Infinity);
  assert.equal(off.ok, true);
  assert.equal(a.model.ship().crew, 9);
  const left = a.s.host.crewHands(a.s.boat);
  assert.deepEqual(left.map((h) => h.name).sort(), [hs[2].name, hs.find((h) => h.role === FIRST_MATE).name].sort(), 'he is still hers, and her First Mate beside him');
  assert.ok(!off.text.includes(hs[2].name), 'never named among the paid off');
  assert.deepEqual(a.x().sell('crew', 1), { ok: false, text: CREW_TRADE_TEXT.ashore(hs[2].name) });
  const c = await quay(SMALL_SHIP, 12, { port: portStanding('wants') });
  restoreFleetSaveData({ v: 1, ships: [], crossed: [42] });
  assert.deepEqual(c.x().sell('crew', 1), { ok: false, text: CREW_TRADE_TEXT.crossed });
  assert.equal(c.x().buy('crew', 2).ok, true, 'men signed on to her all the same');
  assert.equal(c.model.ship().crew, 14);
  _resetFleetForTests();
});

test('CREW-TRADE THE YARD\'S PRICE IS THE CAPTAIN\'S: the exchange holds a man under what this captain\'s shipwright asks at this port - his rank\'s discount read where the shipwright reads it (perksHere) (mutants: the discount unread)', async () => {
  const top = 0.2;   // the highest rank's favour at the yard (captainLedger.js RANK_PERKS)
  // a port short of sailors on a day its price for a man runs past what that captain's shipwright asks
  let at = null;
  for (const port of BAY.filter((p) => crewStandOf(p) === 'wants')) {
    for (let day = 0; day < 200 && !at; day++) if (exchangeOf(port, day, {}, 0, null, true)[0].buy > crewPayMost(top)) at = { port, day };
    if (at) break;
  }
  assert.ok(at, 'a day the cap holds');
  const plain = await quay(SMALL_SHIP, 12, at);
  const ranked = await quay(SMALL_SHIP, 12, { ...at, rank: 1 });
  const yard = ranked.office.perksHere().yard;
  assert.equal(yard, top, 'the highest rank\'s favour, read where the shipwright reads it');
  assert.equal(ranked.x().rows[0].buy, crewPayMost(yard), `held a gold under the ranked yard's ${yardHandPrice(yard)}`);
  assert.equal(plain.x().rows[0].buy, exchangeOf(at.port, at.day, {}, 0, null, true)[0].buy, 'unranked: the port\'s own price');
  assert.ok(plain.x().rows[0].buy > ranked.x().rows[0].buy);
});

test('CREW-TRADE THE EXCHANGE\'S TAB: crew first - whether the port has sailors to spare or is short of them, a man\'s two prices and how many today, her crew aboard against her whole; Buy while she has room, Sell while any may leave her (mutants: the stand\'s words, the presses, the aboard line)', async () => {
  const q = await quay(SMALL_SHIP, 24, { port: portStanding('makes') });
  const r0 = q.x().rows[0];
  const t = exchangeText(q.x()).rows[0];
  assert.deepEqual([t.id, t.title, t.canBuy, t.canSell, t.extra], ['crew', 'Crew', false, true, 'Aboard: 24 of 24 crew']);
  assert.equal(t.words, `Sailors to spare here: cheap - buy at ${r0.sell} gold a man (${DAY_STOCK.makes.sell} left today) - sell at ${r0.buy} gold (${DAY_STOCK.makes.buy} wanted)`);
  const short = await quay(SMALL_SHIP, 1, { port: portStanding('wants') });
  const ts = exchangeText(short.x()).rows[0];
  assert.deepEqual([ts.canBuy, ts.canSell, ts.extra], [true, false, `Aboard: 1 of 24 crew - ${CREW_TRADE_TEXT.lastMan}`], 'AUDIT CREW-TRADE O1: why Sell is greyed, said beside it');
  assert.match(ts.words, /^Short of sailors here: dear - /);
  const sx = short.x(), goods = exchangeText(sx).rows.slice(1);
  goods.forEach((g, i) => { const m = sx.rows[i + 1]; assert.deepEqual([g.canBuy, g.canSell], [m.sells > 0, m.have > 0 && m.buys > 0], `${g.id}: as it was`); assert.doesNotMatch(g.words + g.extra, /Sailors|Aboard/); });
  assert.match(rd('src/scenes/naval/navalHost.js'), /crewDeal: crewDealOf\(boat, st, crewHands, companions\),/, 'the naval host wires her crew into the yard\'s model');
});
