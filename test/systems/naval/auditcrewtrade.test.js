// AUDIT CREW-TRADE (2026-10-24, the owner: "Audit this", of CREW-TRADE - bible/01-Overview/audits/Audit-Crew-Trade.md):
// five cold lanes read CREW-TRADE at 5f4f04bef on frozen snapshots - the economy (E), her crew (H), the office, the
// window, online and the realm (O), the pins and the record (P), the real game (R) - and each finding fixed is pinned
// here, over the REAL sea fight (crewQuay.mjs - TEST THE SHAPE THE PRODUCER MINTS). tools/mutants/auditcrewtrade.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BAY, ISLE, portStanding, quay } from './crewQuay.mjs';
import { crewStandOf, exchangeOf, DAY_STOCK, TRADE_MOST } from '../../../src/systems/naval/tradeGoods.js';
import { crewRowOf, crewPayMost, crewSpare, CREW_TRADE_TEXT, signOffOrder, handsNamed } from '../../../src/systems/naval/crewTrade.js';
import { FIRST_MATE } from '../../../src/systems/naval/shipCrew.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { playerCrewCount } from '../../../src/systems/naval/crewLife.js';
import { RANK_PERKS } from '../../../src/systems/naval/captainLedger.js';
import { exchangeText } from '../../../src/ui/naval/navalYardWindow.js';
import { townExchangeFactors } from '../../../src/net/townEconLaw.js';
import { restoreFleetSaveData, _resetFleetForTests } from '../../../src/systems/fleet.js';
import { charterRecord } from '../../../src/systems/naval/passage.js';
import * as tm from '../../../src/systems/textManager.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const SMALL_SHIP = 2;

test('AUDIT CREW-TRADE H1 - A PAID-FOR VETERAN IS NOT ONE MAN\'S PRICE: the order a headcount sale signs named hands off - never one in the shore party, a plain Deckhand before a post\'s holder, her First Mate last of all, the deck\'s own before a hall\'s recruit, the less service before the more, of the rest the last to join; over the real sea, a Veteran First Mate signed on at the crew hall in a hand\'s place keeps his post through a Sell 1 (mutants: each rung of the order)', async () => {
  const H = (name, role, o = {}) => ({ name, role, fights: 0, boardings: 0, prior: 0, ...o });
  const roster = [H('A', FIRST_MATE), H('B', 'Bosun'), H('C', 'Deckhand', { fights: 5 }), H('D', 'Deckhand'), H('E', 'Gunner', { hall: 'x:1:0' }), H('F', 'Deckhand', { hall: 'x:1:1' }), H('G', 'Deckhand'), H('J', 'Bard')];
  assert.deepEqual(signOffOrder(roster).map((h) => h.name), ['G', 'D', 'C', 'F', 'J', 'B', 'E', 'A']);
  assert.deepEqual(signOffOrder(roster, new Set(['D', 'A'])).map((h) => h.name), ['G', 'C', 'F', 'J', 'B', 'E'], 'the shore party never');
  assert.deepEqual(signOffOrder([H('P', 'Deckhand', { fights: 3 }), H('Q', 'Deckhand', { boardings: 2 })]).map((h) => h.name), ['P', 'Q'], 'service before the tail: a boarding counts twice, so the later-joined Q (4) stays past P (3)');
  const q = await quay(SMALL_SHIP, 24, { port: portStanding('wants') });
  const tail = q.s.host.crewHands(q.s.boat).at(-1).name;
  const vet = { id: '4242:1:2', name: 'Old Hrolf', trade: FIRST_MATE, mobile: 0, sex: 'male', fights: 20, boardings: 10, lift: 6 };
  assert.equal(q.s.host.swapHand(q.s.boat, tail, vet).ok, true);
  q.x().sell('crew', 3);   // 21: her deck still stands four
  const was = q.s.host.crewHands(q.s.boat);
  assert.equal(was.at(-1).name, 'Old Hrolf');
  const r = q.x().sell('crew', 1);   // 20: three - one named hand goes
  assert.equal(r.ok, true);
  const now = q.s.host.crewHands(q.s.boat);
  assert.deepEqual([now.length, now.find((h) => h.role === FIRST_MATE)?.name], [3, 'Old Hrolf'], 'the veteran keeps his post');
  const gone = was.find((h) => !now.some((x) => x.name === h.name));
  assert.equal(gone.role, 'Deckhand', `a plain hand went: ${gone.name}`);
  assert.match(r.text, new RegExp(`Paid off: ${gone.name} \\(Deckhand\\)\\.$`), 'and is named');
});

test('AUDIT CREW-TRADE E1 - A BOOKED PASSAGE\'S CREW IS HER MASTER\'S: a boat on charter (passage.js charterRecord - the record passageBerths.js hands her) lists no crew at the quay\'s exchange, and a press there is refused in so many words; her goods\' rows stand as they were (mutants: the charter unread, the row listed, the refusal\'s order)', async () => {
  const q = await quay(SMALL_SHIP, 24, { port: portStanding('wants') });
  q.s.boat.charter = charterRecord({ to: { name: 'Next', px: 101, py: 100 }, ship: 'Swift', captain: null, fare: 25 });
  assert.ok(q.s.boat.charter, 'a charter as the berth writes it');
  const x = q.x();
  assert.ok(!x.rows.some((r) => r.id === 'crew'), 'no crew row on a booked passage');
  assert.deepEqual(x.rows.map((r) => r.id), exchangeOf(q.port, q.day).map((r) => r.id), 'her goods as they were');
  assert.deepEqual(x.sell('crew', Infinity), { ok: false, text: CREW_TRADE_TEXT.charter });
  assert.deepEqual(x.buy('crew', 1), { ok: false, text: CREW_TRADE_TEXT.charter });
  assert.equal(q.model.ship().crew, 24, 'her master\'s hands all aboard');
  q.st.inFight = true;
  assert.deepEqual(q.x().sell('crew', 1), { ok: false, text: CREW_TRADE_TEXT.charter }, 'a charter answered before a fight');
});

test('AUDIT CREW-TRADE O1 - A GREYED SELL SAYS WHY: a ship come through customs, a shore party\'s last place, her last man - each reason beside the row where the press is greyed, never while the exchange takes none today (mutants: the reason unshown, the reason always)', async () => {
  const c = await quay(SMALL_SHIP, 12, { port: portStanding('wants') });
  restoreFleetSaveData({ v: 1, ships: [], crossed: [42] });
  const t = exchangeText(c.x()).rows[0];
  assert.deepEqual([t.canSell, t.extra], [false, `Aboard: 12 of 24 crew - ${CREW_TRADE_TEXT.crossed}`]);
  _resetFleetForTests();
  assert.equal(exchangeText(c.x()).rows[0].extra, 'Aboard: 12 of 24 crew', 'no reason while men may leave her');
  const spare = await quay(SMALL_SHIP, 24, { port: portStanding('makes') });
  spare.x().sell('crew', Infinity);
  const glut = exchangeText(spare.x()).rows[0];
  assert.deepEqual([glut.canSell, glut.extra], [false, `Aboard: ${24 - DAY_STOCK.makes.buy} of 24 crew`], 'none wanted today: the words say it, no reason of hers');
});

test('AUDIT CREW-TRADE O2/O3 - IN THE PLAYER\'S LANGUAGE: the crew row\'s title, its stand, its two prices and its counts, the note of a sale and the refusals are the language\'s own, the gold a number in its own figures - no English left in German (mutants: the title, the prices\' words, the gold a string)', async () => {
  const q = await quay(SMALL_SHIP, 24, { port: portStanding('wants') });
  const en = exchangeText(q.x()).rows[0];
  const de = Object.fromEntries(tm.parseStringTableCsv(rd('locales/de/Port_Strings.csv')));
  try {
    tm.patchLocaleTable('de', 'Port_Strings', Object.entries(de));
    tm.setLocale('de');
    const r = exchangeText(q.x()).rows[0];
    assert.equal(r.title, de['sea.crew.title']);
    assert.ok(r.words.startsWith(de['sea.crew.standWants']), r.words);
    for (const w of ['buy at', 'sell at', 'left today', 'wanted', 'Short of', 'Aboard']) assert.ok(!`${r.title} ${r.words} ${r.extra}`.includes(w), `no English: ${w} in ${r.words} | ${r.extra}`);
    const row = q.x().rows[0], n = Math.min(row.spare, row.buys);
    const sold = q.x().sell('crew', Infinity);
    assert.equal(sold.ok, true);
    assert.ok(!/ gold|contracts|Paid off/.test(sold.text), `the note in German: ${sold.text}`);
    const total = n * row.buy;
    assert.ok(sold.text.includes(new Intl.NumberFormat('de').format(total)), `the gold in German figures: ${total} in ${sold.text}`);
    assert.deepEqual(q.x().sell('crew', 1).text, CREW_TRADE_TEXT.lastMan, 'her last man: the refusal in German');
    assert.equal(CREW_TRADE_TEXT.lastMan, de['sea.crew.lastMan']);
    assert.ok(!/That's your last|Not while the ship/.test(CREW_TRADE_TEXT.lastMan + CREW_TRADE_TEXT.fighting), 'the crew hall\'s refusals routed');
  } finally { tm.setLocale('en'); tm._resetTextManagerForTests(); }
  assert.deepEqual(exchangeText(q.x()).rows[0].title, en.title, 'English again');
});

test('AUDIT CREW-TRADE P1/P2 - THE PURSE, THE LEDGER AND THE LOG FOR THE MEN THAT MOVED: Buy 10 with room for three pays for three, Sell 10 past her spare pays for her spare - the day\'s dealing, the log\'s trade and the note counting the men who moved, never the men asked for; a purse a gold short of four men signs on three (mutants: the asked paid, the asked credited, the asked dealt, the asked logged, the purse at the wrong price)', async () => {
  const q = await quay(SMALL_SHIP, 21, { port: portStanding('makes') });   // men to spare: thirty to sign on today
  const row = q.x().rows[0];
  const on = q.x().buy('crew', 10);
  assert.equal(q.model.ship().crew, 24, 'three men: her whole');
  assert.equal(q.purse.gold, 100000 - 3 * row.sell, 'paid for the three');
  assert.equal(q.ledger.dealtAt(q.port.key, q.day).bought.crew, 3);
  assert.ok(on.text.startsWith(CREW_TRADE_TEXT.bought(3, 3 * row.sell)), on.text);
  // a ship at 4 men sells 3 of a Sell 10
  const s = await quay(SMALL_SHIP, 4, { port: portStanding('wants') });
  const r = s.x().rows[0];
  const off = s.x().sell('crew', 10);
  assert.equal(s.model.ship().crew, 1);
  assert.equal(s.purse.gold, 100000 + 3 * r.buy, 'credited for the three');
  assert.equal(s.ledger.dealtAt(s.port.key, s.day).sold.crew, 3);
  assert.equal(s.ledger.log.traded, 3 * r.buy);
  assert.ok(off.text.startsWith(CREW_TRADE_TEXT.sold(3, 3 * r.buy)), off.text);
  // the purse: a gold short of four men - three at the price the captain pays, never four at the price he is paid
  const probe = await quay(SMALL_SHIP, 6, { port: portStanding('makes') });
  const { sell, buy } = probe.x().rows[0];
  assert.ok(buy < sell);
  const p = await quay(SMALL_SHIP, 6, { port: portStanding('makes'), gold: 4 * sell - 1 });
  assert.equal(p.x().buy('crew', 10).ok, true);
  assert.deepEqual([p.model.ship().crew, p.purse.gold], [9, sell - 1], 'three signed on, the purse never under nothing');
});

test('AUDIT CREW-TRADE P4/P5 - THE STARS AND THE TOWN: crew\'s row is priced as a good\'s - the captain\'s stars closing the spread and the port town\'s factors - at the office too, under the cap; and every dealing, a buy and a sell, is told to the town economy (mutants: the row\'s stars, the row\'s town, the office\'s stars, the office\'s town, a deal untold)', async () => {
  for (const discount of RANK_PERKS.map((k) => k.yard)) {
    for (const port of [...BAY.slice(0, 40), ISLE]) {
      for (const [edge, town] of [[0, null], [TRADE_MOST, null], [0, townExchangeFactors(0)], [TRADE_MOST, townExchangeFactors(100)]]) {
        const raw = exchangeOf(port, 11, {}, edge, town, true)[0];
        const r = crewRowOf(port, 11, { edge, town, discount });
        assert.deepEqual([r.sell, r.buy], [raw.sell, Math.min(raw.buy, crewPayMost(discount))], `${port.name} at ${discount}`);
      }
    }
  }
  const town = townExchangeFactors(0);
  const port = portStanding('makes');
  const q = await quay(SMALL_SHIP, 12, { port, edge: TRADE_MOST, town });
  const raw = exchangeOf(port, q.day, {}, TRADE_MOST, town, true)[0];
  assert.deepEqual([q.x().rows[0].sell, q.x().rows[0].buy], [raw.sell, Math.min(raw.buy, crewPayMost(0))], 'the office reads the stars and the town');
  assert.notDeepEqual([raw.sell, raw.buy], [exchangeOf(port, q.day, {}, 0, null, true)[0].sell, exchangeOf(port, q.day, {}, 0, null, true)[0].buy], 'and they move the price');
  q.x().buy('crew', 2);
  assert.equal(q.towned.deals, 1, 'a buy told');
  q.x().sell('crew', 1);
  assert.equal(q.towned.deals, 2, 'a sell told');
});

test('AUDIT CREW-TRADE P6/P7/P8 - HER DECK AS THE GAME RUNS IT: men signed on stand on her deck named and unsaid, men signed off leave it and nobody is said fallen - read off her own roster and the sea run before anything else syncs it; and a sign-on puts out no fire and floats no wreck (mutants: the sign-on unsynced, the sign-off unsynced, the muster a repair)', async () => {
  const q = await quay(SMALL_SHIP, 6, { port: portStanding('makes') });
  q.s.log.say.length = 0;
  q.x().buy('crew', 12);
  assert.equal(q.st.crew.hands.length, playerCrewCount(SMALL_SHIP, 18), 'her roster read straight: her new hands stand');
  q.s.run(0.3);
  assert.ok(!q.s.log.say.some((t) => /signs on|has fallen/.test(t)), `unsaid: ${q.s.log.say}`);
  const o = await quay(SMALL_SHIP, 18, { port: portStanding('wants') });
  o.s.log.say.length = 0;
  o.x().sell('crew', 10);
  assert.equal(o.st.crew.hands.length, playerCrewCount(SMALL_SHIP, 8), 'her roster read straight: the hands who left are gone');
  o.s.run(0.3);
  assert.ok(!o.s.log.say.some((t) => /has fallen|signs on/.test(t)), `nobody said fallen: ${o.s.log.say}`);
  const w = await quay(SMALL_SHIP, 6, { port: portStanding('makes'), state: SHIP_STATES.wrecked, fire: 20 });
  const d = w.st.damage;
  assert.deepEqual([d.state, d.fire > 0], [SHIP_STATES.wrecked, true], 'a wreck, burning, at the quay');
  w.x().buy('crew', 10);
  assert.deepEqual([d.crew, d.state, d.fire > 0], [16, SHIP_STATES.wrecked, true], 'men aboard her - still a wreck, still burning');
});

test('AUDIT CREW-TRADE P9/R3 - THE PRESSES FOLLOW THE DAY AND THE PURSE: Buy greyed when the exchange signs on nobody more today or the purse cannot pay a man, Sell greyed when it takes nobody more; a port that is neither says so (R4) (mutants: the stock unread, the purse unread, the neither unsaid)', async () => {
  const q = await quay(SMALL_SHIP, 1, { port: portStanding('wants') });
  q.x().buy('crew', DAY_STOCK.wants.sell);
  const spent = exchangeText(q.x()).rows[0];
  assert.deepEqual([spent.canBuy, spent.canSell], [false, true], 'none to sign on today: Buy greyed, room or not');
  const g = await quay(SMALL_SHIP, 24, { port: portStanding('makes') });
  g.x().sell('crew', DAY_STOCK.makes.buy);
  assert.deepEqual([exchangeText(g.x()).rows[0].canSell], [false], 'none wanted today: Sell greyed, spare or not');
  const price = (await quay(SMALL_SHIP, 6, { port: portStanding('makes') })).x().rows[0].sell;
  const poor = await quay(SMALL_SHIP, 6, { port: portStanding('makes'), gold: price - 1 });
  assert.equal(exchangeText(poor.x()).rows[0].canBuy, false, 'a gold short of a man: Buy greyed');
  const rich = await quay(SMALL_SHIP, 6, { port: portStanding('makes'), gold: price });
  assert.equal(exchangeText(rich.x()).rows[0].canBuy, true, 'a man\'s price: Buy lit');
  const n = await quay(SMALL_SHIP, 6, { port: portStanding('neither') });
  assert.match(exchangeText(n.x()).rows[0].words, /^Sailors to be had here: the usual price - buy at /);
});

test('AUDIT CREW-TRADE P10/P11/P13 - THE LAW\'S EDGES: every isle of the Veil short of sailors whatever its key would draw in the Bay; at her last man the last man\'s words, a hand ashore or not; the cap at every rank\'s own favour (mutants: the isle by its draw, the last man said ashore)', () => {
  let isles = 0;
  for (let i = 0; i < 400 && isles < 40; i++) {
    const key = `${600 + i},${17 + (i % 13)}`;
    if (crewStandOf({ key }) === 'wants') continue;
    isles++;
    assert.equal(crewStandOf({ key, ether: true }), 'wants', `${key}: draws ${crewStandOf({ key })} in the Bay, short past the Veil`);
  }
  assert.ok(isles >= 20);
  const hands = [{ name: 'A' }];
  assert.deepEqual(crewSpare({ hull: SMALL_SHIP, crew: 1, hands, away: new Set(['A']) }), { n: 0, why: CREW_TRADE_TEXT.lastMan });
  assert.deepEqual(RANK_PERKS.map((k) => crewPayMost(k.yard)), [29, 28, 26, 25, 23], 'a gold under the yard\'s man at each rank');
});

test('AUDIT CREW-TRADE R2 - CREW SELLS TEN AT A TIME: the crew row\'s presses are Buy 1, Buy 10, Sell 1, Sell 10 - one press never takes a ship from her crew to her last man; the goods\' rows keep Sell all (mutants: Sell all on crew)', async () => {
  const src = rd('src/ui/naval/navalYardWindow.js');
  assert.match(src, /if \(r\.id === CREW\.id\) mk\('Sell 10', r\.canSell, \(\) => press\(x\.sell\(r\.id, 10\)\)\);\n\s+else mk\('Sell all', r\.canSell, \(\) => press\(x\.sell\(r\.id, Infinity\)\)\);/);
  const q = await quay(SMALL_SHIP, 24, { port: portStanding('wants') });
  q.x().sell('crew', 10);
  assert.equal(q.model.ship().crew, 14, 'a Sell 10 is ten men');
});
