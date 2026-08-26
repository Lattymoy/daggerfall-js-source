// AUDIT 26 - THE BANK'S BUY SHIP BUTTON, against
// DaggerfallBankingWindow.cs:455-464 / :229-232,
// DaggerfallBankPurchasePopUp.cs:186-197 / :380-392 and
// DaggerfallBankManager.cs:467-497.
//
// BuyShipButton has THREE arms, not two: already own one, not a port
// town, and - the arm a real port reaches - push the purchase window
// with its houses argument null, which is that window's SHIP mode.
// The port answered NOT_PORT_TOWN on the third, so buying a ship was
// impossible in exactly the towns where DFU allows it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BankWindow, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../src/ui/bankWindow.js';
import {
  BankPurchaseWindow, PURCHASE_RECTS, PURCHASE_PANEL_X, PURCHASE_PANEL_Y, LIST_ROW_H, priceRow,
} from '../src/ui/bankPurchaseWindow.js';
import {
  TRANSACTION_RESULT, SHIP_TYPES, SHIP_PRICES, createBankAccounts, ownedShipType,
} from '../src/systems/banking.js';
import { goldAmount, deductGold, addGold } from '../src/systems/court.js';

const R = TRANSACTION_RESULT;
const rows = (id) => [{ text: `#${id}`, center: true }];
const idOf = (box) => Number(/^#(\d+)/.exec(box?.rows?.[0]?.text ?? '')?.[1]);

/** The bank window with the ship half of its host wired. */
function win(over = {}) {
  const entity = over.entity ?? { level: 1, items: [{ group: 'Currency', stackCount: over.purse ?? 0 }] };
  const accounts = over.accounts ?? createBankAccounts(62);
  const scenes = [];
  const opened = [];
  const w = new BankWindow({
    accounts: () => accounts,
    regionIndex: () => 17,
    player: {
      gold: () => goldAmount(entity),
      deductGold: (n) => deductGold(entity, n),
      addGold: (n) => addGold(entity, n),
    },
    rows,
    ownsShip: () => ownedShipType(entity) !== SHIP_TYPES.None,
    ownedShip: () => ownedShipType(entity),
    isPortTown: () => over.isPortTown ?? true,
    shipOwner: over.noOwner ? undefined : () => entity,
    addShipScene: (ship) => scenes.push(ship),
    openShipPurchase: over.noChooser ? undefined : (buy) => { opened.push(buy); return true; },
  });
  return { w, entity, accounts, scenes, opened };
}

const clickBank = (w, key) => {
  const [x, y, rw, rh] = BANK_RECTS[key];
  return w.click(BANK_PANEL_X + x + rw / 2, BANK_PANEL_Y + y + rh / 2);
};

test('A26: in a port town with no ship, BUY SHIP opens the ship list - it does NOT answer NOT_PORT_TOWN (:462-463)', () => {
  const c = win({ isPortTown: true });
  clickBank(c.w, 'buyShip');
  assert.equal(c.w.box, null, 'the pick arm said something; DFU says nothing here, it pushes a window');
  assert.equal(c.opened.length, 1, 'the ship list was never opened');
  assert.equal(typeof c.opened[0], 'function', 'the window was opened with no BUY arm behind it');
});

test('A26: the two refusals above it are unchanged (:458-461)', () => {
  const owner = win({ entity: { ownedShip: SHIP_TYPES.Small, items: [] }, isPortTown: true });
  clickBank(owner.w, 'buyShip');
  assert.equal(idOf(owner.w.box), R.ALREADY_OWN_SHIP);
  assert.equal(idOf(owner.w.box), 284, 'the TEXT.RSC record itself');
  assert.equal(owner.opened.length, 0, 'a player who owns a ship still got the list');

  const inland = win({ isPortTown: false });
  clickBank(inland.w, 'buyShip');
  assert.equal(idOf(inland.w.box), R.NOT_PORT_TOWN);
  assert.equal(idOf(inland.w.box), 285);
  assert.equal(inland.opened.length, 0);
});

test('A26: the list\'s BUY arm IS PurchaseShip - purse first, account for the rest (:229-232, :467-486)', () => {
  const c = win({ purse: 50000 });
  c.accounts[17].accountGold = 60000;
  clickBank(c.w, 'buyShip');
  const r = c.opened[0](SHIP_TYPES.Small);

  assert.equal(r.result, R.PURCHASED_SHIP);
  assert.equal(r.price, SHIP_PRICES[SHIP_TYPES.Small]);
  assert.equal(r.price, 100000, 'shipPrices[0], byte-exact');
  assert.equal(goldAmount(c.entity), 0, 'DeductGoldAmount did not empty the purse first');
  assert.equal(c.accounts[17].accountGold, 10000, 'the account did not cover exactly the shortfall');
  assert.equal(ownedShipType(c.entity), SHIP_TYPES.Small, 'AssignShipToPlayer never ran');
  assert.deepEqual(c.scenes, [SHIP_TYPES.Small], 'the ship\'s permanent scenes were never added');
  // GeneratePurchaseShipPopup passes NO amount (:231), so the record
  // is shown with 0 behind it.
  assert.equal(idOf(c.w.box), 283, 'PURCHASED_SHIP is TEXT.RSC 0283');
  assert.equal(c.w.box.amount, 0);
  assert.equal(c.w.box.buttons, null, 'a purchase asks nothing - there is no Yes/No');
});

test('A26: a ship neither purse nor account can pay for is NOT_ENOUGH_GOLD, and nothing moves (:477-478)', () => {
  const c = win({ purse: 500 });
  c.accounts[17].accountGold = 1000;
  clickBank(c.w, 'buyShip');
  const r = c.opened[0](SHIP_TYPES.Large);
  assert.equal(r.result, R.NOT_ENOUGH_GOLD);
  assert.equal(idOf(c.w.box), 454);
  assert.equal(goldAmount(c.entity), 500, 'the purse paid for a refusal');
  assert.equal(c.accounts[17].accountGold, 1000, 'the account paid for a refusal');
  assert.equal(ownedShipType(c.entity), SHIP_TYPES.None);
  assert.deepEqual(c.scenes, [], 'a refused purchase made a scene permanent');
});

test('A26: a host with no ship list still refuses nothing, and no gold moves', () => {
  // DFU has no refusal on this arm (:463 pushes unconditionally), so
  // a host that cannot mount the list says NOTHING - the one thing it
  // must not do is claim a port town is not one.
  const c = win({ noChooser: true, purse: 999999 });
  clickBank(c.w, 'buyShip');
  assert.equal(c.w.box, null);
  assert.equal(goldAmount(c.entity), 999999);
  // ...and a host that cannot name the ship's owner takes no gold for
  // a ship it cannot deliver.
  const d = win({ noOwner: true, purse: 999999 });
  clickBank(d.w, 'buyShip');
  const r = d.opened[0](SHIP_TYPES.Large);
  assert.equal(r.result, R.NONE);
  assert.equal(goldAmount(d.entity), 999999);
  assert.equal(d.w.box, null, 'NONE says nothing at all (:300-301)');
});

test('A26: the purchase window in SHIP mode lists the two ship prices and its INDEX is the ShipType (:186-190, :387-388)', () => {
  const bought = [];
  let closed = 0;
  const pw = new BankPurchaseWindow({ buy: (s) => bought.push(s), rows, onClose: () => { closed++; } });
  assert.equal(pw.ships, true, 'an absent houses hook is DFU\'s `housesForSale == null`');
  assert.deepEqual(pw.rows().map((r) => r.text), [priceRow(100000), priceRow(200000)]);
  assert.deepEqual(pw.rows().map((r) => r.index), [SHIP_TYPES.Small, SHIP_TYPES.Large]);
  assert.equal(pw.count, 2, 'DFU lists exactly `i < 2`');
  assert.equal(pw.canScrollDown(), false, 'two rows in a ten-row list have nowhere to scroll');

  // BUY with nothing picked does nothing at all (:381-383)
  pw.click(PURCHASE_PANEL_X + PURCHASE_RECTS.buy[0] + 2, PURCHASE_PANEL_Y + PURCHASE_RECTS.buy[1] + 2);
  assert.deepEqual(bought, []);

  // pick the LARGE row, then BUY: the window closes and the ShipType
  // goes to the banking window's GeneratePurchaseShipPopup.
  const [lx, ly] = PURCHASE_RECTS.priceList;
  pw.click(PURCHASE_PANEL_X + lx + 2, PURCHASE_PANEL_Y + ly + LIST_ROW_H + 2);
  assert.equal(pw.selected, SHIP_TYPES.Large);
  pw.click(PURCHASE_PANEL_X + PURCHASE_RECTS.buy[0] + 2, PURCHASE_PANEL_Y + PURCHASE_RECTS.buy[1] + 2);
  assert.deepEqual(bought, [SHIP_TYPES.Large]);
  assert.equal(closed, 1, 'DFU closes the list before the bank speaks (:385)');
  assert.equal(pw.box, null, 'the ship result is the BANK window\'s message, not this window\'s');
});

test('A26: end to end - a port town, the list, and the deed', () => {
  const c = win({ purse: 250000 });
  clickBank(c.w, 'buyShip');
  const pw = new BankPurchaseWindow({ buy: c.opened[0], rows, onClose: () => {} });
  const [lx, ly] = PURCHASE_RECTS.priceList;
  pw.click(PURCHASE_PANEL_X + lx + 2, PURCHASE_PANEL_Y + ly + LIST_ROW_H + 2);   // the large ship
  pw.click(PURCHASE_PANEL_X + PURCHASE_RECTS.buy[0] + 2, PURCHASE_PANEL_Y + PURCHASE_RECTS.buy[1] + 2);
  assert.equal(ownedShipType(c.entity), SHIP_TYPES.Large);
  assert.equal(goldAmount(c.entity), 50000, '200000 came out of the purse');
  assert.equal(idOf(c.w.box), R.PURCHASED_SHIP);
});

test('A26: the house half of the purchase window is untouched by ship mode', () => {
  const houses = [{ buildingKey: 7, meshRadius: 10 }, { buildingKey: 8, meshRadius: 20 }];
  const pw = new BankPurchaseWindow({ houses: () => houses, buy: () => ({ result: R.PURCHASED_HOUSE, amount: 1 }), rows, onClose: () => {} });
  assert.equal(pw.ships, false);
  assert.equal(pw.count, 2);
  assert.deepEqual(pw.rows().map((r) => r.text), [priceRow(10 * 1280), priceRow(20 * 1280)]);
  pw.selected = 0;
  pw._buy();
  assert.equal(idOf(pw.box), R.PURCHASED_HOUSE, 'the HOUSE result is still this window\'s own message');
});
