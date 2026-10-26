// FIELD BUGS 2026-10-25i BOUGHT-YOURS (#bug-reports, "Can't buy this piece", Paofrenetico: "I did dismantle the other
// chest i bought days ago, but still i cant buy this one"; bible/11-Multiplayer/Sigil-Sets.md section 7). The report's
// Broker, minted by the real stock off its own day: the window's six rows, its turn and its insignia's word as the
// screenshot shows them; the two Wardens - 2026-10-22's (Malacath's) and 2026-10-25's (Mora's), two offers of one name -
// and the law over them: a sale of another day's never marks today's, a dismantle frees nothing, a refused sale marks
// nothing, a sale gives what it marks; and the window, wired as the host wires it, saying whose sale "Bought" is when a
// press lands on it after the sale.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brokerDay, brokerTurnsIn, brokerStock, brokerOfferState, brokerSale, brokerBought, makeBrokerSale, dismantleWare, spendableStonesIn,
  stoneCount, offerSetName, stonesText, BROKER_REFUSALS, BROKER_SAVE_VENDOR, _resetBrokerForTests, wareName, dismantleAsk,
} from '../../../src/systems/sigil/sigilBroker.js';
import { modSaveRecords, restoreModSaveRecords } from '../../../src/systems/modSaveData.js';
import { sigilStone } from '../../../src/systems/gate/gateSpoils.js';
import { itemLongName } from '../../../src/systems/item/itemInfo.js';
import { RARITIES } from '../../../src/systems/loot/lootRarity.js';
import { INSIGNIA } from '../../../src/net/insignia.js';
import { withDom } from '../../invdrag.mjs';
import { mountBrokerWindow, brokerTurnText, insigniaLabel, buyLabel, BROKER_SOLD } from '../../../src/ui/brokerWindow.js';

/** The screenshot's moment: "New stock in 3h 31m" on the report's day. */
const SHOT = Date.parse('2026-10-25T20:29:00Z');
const TODAY = brokerDay(SHOT);
/** "the other chest i bought days ago": three days before. */
const OLD = brokerDay(Date.parse('2026-10-22T12:00:00Z'));
const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const stateOf = (offer, pack, day) => brokerOfferState(offer, { items: spendableStonesIn(pack), bought: brokerBought(day), day });

test('BOUGHT-YOURS the report\'s window, minted off its day: the six rows by name, set, tier and price, the turn, and the Gatebreaker\'s "Need 10 more" on a purse of 20 - the screenshot\'s "8" is a 6 and its "90" a 30 in the window\'s digits, so the stock is this tree\'s own and every sale of it passes the stock\'s price check', () => {
  assert.equal(TODAY - OLD, 3);
  assert.equal(brokerTurnText(brokerTurnsIn(SHOT)), '3h 31m');
  assert.deepEqual(brokerStock(TODAY).map((o) => [itemLongName(o.item), offerSetName(o), RARITIES[o.item.rarity].label, stonesText(o.price)]), [
    ['Guardian\'s Buckler of Skill', 'Malacath\'s Bulwark', 'Rare', '4 Deadlands Embers'],
    ['Adamantium Guardian\'s Cuirass of Skill', 'Dagon\'s Brand', 'Rare', '4 Deadlands Embers'],
    ['Kite Shield of Skill', 'Nocturnal\'s Shroud', 'Rare', '4 Deadlands Embers'],
    ['The Warden', 'Mora\'s Mantle', 'Legendary', '6 Deadlands Embers'],
    ['Dwarven Warrior\'s Mace of Skill', 'Malacath\'s Bulwark', 'Rare', '6 Deadlands Embers'],
    ['Ruhn\'s Gatecleaver', 'Ruhn\'s Regalia', 'Aetheric', '12 Deadlands Embers'],
  ]);
  for (const o of brokerStock(TODAY)) assert.equal(brokerSale(o, { items: [stack(12)], bought: [], day: TODAY }).ok, true, `${o.id} at its shown price`);
  const gatebreaker = INSIGNIA.find((g) => g.key === 'gatebreaker');
  assert.equal(gatebreaker.price, 30);
  assert.equal(insigniaLabel({ ...gatebreaker, owned: false }, { have: 20, busy: false, pending: false }), 'Need 10 more', 'the screenshot\'s own word, on its own purse');
});

test('BOUGHT-YOURS the two Wardens: two offers of one name, each a chest - a sale of 2026-10-22\'s leaves 2026-10-25\'s for sale, and dismantling it frees nothing; only a sale of today\'s own offer marks it, that sale gives the piece, and its own dismantle keeps the day\'s mark (SS5); a sale refused as too heavy moves nothing and marks nothing, and a save from before the sale holds the offer unmarked (mutants: a heavy sale marked; a sale that gives nothing; the record kept on its old day; a dismantle that frees the day; another day\'s marks read as today\'s)', () => {
  _resetBrokerForTests();
  const old = brokerStock(OLD)[0], warden = brokerStock(TODAY)[3];
  assert.deepEqual([itemLongName(old.item), offerSetName(old), old.item.rarity, old.item.templateIndex], ['The Warden', 'Malacath\'s Bulwark', 'legendary', 102]);
  assert.deepEqual([itemLongName(warden.item), offerSetName(warden), warden.item.rarity, warden.item.templateIndex], ['The Warden', 'Mora\'s Mantle', 'legendary', 102]);
  assert.notEqual(old.id, warden.id, 'two offers');
  // AUDIT FB1025i A8: and a dismantle asked of either names its set - "The Warden" alone could not say which
  assert.deepEqual([dismantleAsk(wareName(itemLongName(old.item), old.item), 3)[0], dismantleAsk(wareName(itemLongName(warden.item), warden.item), 3)[0]],
    ['Dismantle The Warden (Malacath\'s Bulwark)?', 'Dismantle The Warden (Mora\'s Mantle)?']);
  assert.equal(wareName('Deadlands Ember', sigilStone()), 'Deadlands Ember', 'a piece of no set, its name');
  const pack = [stack(32)];
  const first = makeBrokerSale(old, { items: pack, day: OLD });
  assert.equal(first.ok, true);
  assert.ok(pack.includes(first.item), 'the old Warden in the pack');
  assert.deepEqual(stateOf(warden, pack, TODAY), { ok: true, reason: null, price: 6, have: 26 }, 'three days on, an older sale never marks the day\'s offer');
  assert.deepEqual(dismantleWare(first.item, { items: pack }), { ok: true, stones: 3 });
  assert.equal(stateOf(warden, pack, TODAY).ok, true, 'nor does its dismantle change a thing');
  // a sale refused as too heavy: nothing out, nothing in, nothing marked
  assert.deepEqual(makeBrokerSale(warden, { items: pack, day: TODAY, canCarry: () => false }), { ok: false, reason: 'heavy' });
  assert.equal(stoneCount(pack), 29);
  assert.equal(pack.length, 1);
  assert.deepEqual(brokerBought(TODAY), [], 'a refused sale marks nothing');
  const before = modSaveRecords()[BROKER_SAVE_VENDOR];
  // the sale: the piece in, the offer marked - the screenshot's "Bought"
  const sale = makeBrokerSale(warden, { items: pack, day: TODAY });
  assert.equal(sale.ok, true);
  assert.ok(pack.includes(sale.item), 'what is marked was given');
  assert.equal(stoneCount(pack), 23);
  assert.deepEqual(brokerBought(TODAY), [warden.id]);
  assert.deepEqual(modSaveRecords()[BROKER_SAVE_VENDOR], { day: TODAY, ids: [warden.id] }, 'the mark rides the save beside the pack');
  assert.equal(stateOf(warden, pack, TODAY).reason, 'bought');
  assert.deepEqual(dismantleWare(sale.item, { items: pack }), { ok: true, stones: 3 });
  assert.equal(stateOf(warden, pack, TODAY).reason, 'bought', 'SS5: a ware dismantled is not bought again that day');
  assert.deepEqual(makeBrokerSale(brokerStock(TODAY)[3], { items: pack, day: TODAY }), { ok: false, reason: 'bought' });
  assert.equal(stateOf(brokerStock(TODAY + 1)[3], pack, TODAY + 1).ok, true, 'the next day\'s stock is a new list');
  // a save from before the sale: its offer unmarked
  restoreModSaveRecords({ [BROKER_SAVE_VENDOR]: before });
  assert.deepEqual(brokerBought(TODAY), []);
  _resetBrokerForTests();
});

test('BOUGHT-YOURS the window, wired as the host wires it (world.js openBroker): Buy on today\'s Warden sells it once and says so; a second press on its Bought says whose sale it was and that it is the day\'s, in its title and its name too (mutant: the old "Bought today")', () => {
  _resetBrokerForTests();
  const pack = [stack(26)];
  const sales = [];
  withDom(() => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountBrokerWindow(host, {
      stock: () => brokerStock(TODAY), day: () => TODAY, now: () => SHOT,
      items: () => spendableStonesIn(pack), bought: () => brokerBought(TODAY),
      buy: (o) => { const r = makeBrokerSale(o, { items: pack, day: TODAY }); if (r.ok) sales.push(o.id); return r; },
      picture: () => null, wearer: null, nameOf: (it) => itemLongName(it),
    });
    try {
      const shell = one(host, 'broker-shell');
      const button = () => one(kids(shell, 'broker-offer')[3], 'broker-buy');
      assert.equal(button().textContent, 'Buy');
      button().onclick({ stopPropagation() {} });
      assert.equal(one(shell, 'broker-note').textContent, BROKER_SOLD('The Warden', 6));
      assert.equal(one(shell, 'broker-purse').textContent, '20 Deadlands Embers', 'the screenshot\'s purse');
      assert.equal(button().textContent, 'Bought');
      assert.equal(buyLabel(stateOf(brokerStock(TODAY)[3], pack, TODAY)), 'Bought');
      // the press after it - a second tap, or the player asking why
      button().onclick({ stopPropagation() {} });
      assert.deepEqual(sales, [`${TODAY}:3`], 'sold once');
      assert.equal(pack.filter((it) => itemLongName(it) === 'The Warden').length, 1);
      const said = 'You bought this one today. You can buy each piece once a day.';
      assert.equal(BROKER_REFUSALS.bought, said);
      assert.equal(one(shell, 'broker-note').textContent, said, 'the note says whose sale it was');
      assert.equal(button().attrs.title, said);
      assert.equal(button().attrs['aria-label'], `Bought - The Warden: ${said}`);
    } finally { view.unmount(); }
  });
  _resetBrokerForTests();
});
