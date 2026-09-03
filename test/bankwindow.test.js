// B2: the banking WINDOW against DaggerfallBankingWindow.cs - the
// panel's geometry, the one-transaction-at-a-time input model, and
// the refusals that happen before a button opens anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BANK_PANEL_W, BANK_PANEL_H, BANK_PANEL_X, BANK_PANEL_Y,
  BANK_RECTS, BANK_LABELS, AMOUNT_FIELD, CANNOT_CARRY_GOLD, BankWindow,
} from '../src/ui/bankWindow.js';
import { NATIVE_W, NATIVE_H } from '../src/ui/nativePanel.js';
import {
  TRANSACTION_TYPE, TRANSACTION_RESULT, createBankAccounts,
  accountTotal, loanedTotal, borrowLoan, bankButtonEnabled,
  toggleTransactionInput, parseTransactionAmount,
} from '../src/systems/banking.js';
import { GOLD_PIECE_WEIGHT_KG, letterOfCredit, LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { goldAmount, totalGoldAmount, deductGold, addGold } from '../src/systems/court.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = TRANSACTION_RESULT;
const T = TRANSACTION_TYPE;

const rows = (id) => [{ text: `#${id}`, center: true }];
const idOf = (box) => Number(/^#(\d+)/.exec(box?.rows?.[0]?.text ?? '')?.[1]);

function win(over = {}) {
  const entity = over.entity ?? { level: 5, goldPieces: 1000, items: [] };   // E4: the counter
  const accounts = over.accounts ?? createBankAccounts(62);
  const wagon = over.wagon ?? null;
  let closed = 0;
  const player = {
    gold: () => goldAmount(entity),
    // AUDIT 54: bankPurse's OTHER quantity - PlayerEntity.GetGoldAmount
    // (:1313-1316), coins plus letters of credit. The harness had wired
    // the coin reader alone, which is why the label pin below could not
    // see which one the window drew.
    totalGold: () => totalGoldAmount(entity),
    deductGold: (n) => deductGold(entity, n),
    addGold: (n) => addGold(entity, n),
    wagonGold: () => wagon?.stackCount ?? 0,
    takeWagonGold: (n) => { wagon.stackCount -= n; },
    takeLetter: () => {
      const i = entity.items.findIndex((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);
      return i < 0 ? null : entity.items.splice(i, 1)[0];
    },
    addLetter: (loc) => entity.items.unshift(loc),
    carriedWeightKg: () => over.carriedKg ?? 0,
    maxEncumbranceKg: () => over.maxKg ?? 1e9,
  };
  const w = new BankWindow({
    accounts: () => accounts,
    regionIndex: () => 17,
    level: () => entity.level,
    now: () => 1000,
    player,
    wagonGold: () => wagon?.stackCount ?? 0,
    rows,
    dueDateText: (m) => (m > 0 ? `due-${m}` : ''),
    ownsHouse: () => over.ownsHouse ?? false,
    ownsShip: () => over.ownsShip ?? false,
    ownedShip: () => over.ownedShip ?? -1,
    housesForSale: () => over.housesForSale ?? 0,
    isPortTown: () => over.isPortTown ?? false,
    houseSellPrice: () => over.houseSellPrice ?? 0,
    onClose: () => { closed++; },
    ...over.hooks,
  });
  return { w, entity, accounts, wagon, closed: () => closed };
}

const clickRect = (w, key) => {
  const [x, y, rw, rh] = BANK_RECTS[key];
  return w.click(BANK_PANEL_X + x + rw / 2, BANK_PANEL_Y + y + rh / 2);
};
const type = (w, text) => { for (const ch of text) w.input(`char:${ch}`); };

test('B2: the panel is BANK00I0\'s own size, Center/Middle (:77-79)', () => {
  assert.equal(BANK_PANEL_W, 225);
  assert.equal(BANK_PANEL_H, 181, 'the IMG really ships 225x181 - read, not assumed');
  assert.equal(BANK_PANEL_X, Math.round((NATIVE_W - BANK_PANEL_W) / 2));
  assert.equal(BANK_PANEL_Y, Math.round((NATIVE_H - BANK_PANEL_H) / 2));
  assert.equal(BANK_PANEL_X, 48);
  assert.equal(BANK_PANEL_Y, 10);
  // ten buttons in TWO COLUMNS of five, on an 18-pixel stride (:108-183)
  const left = ['depositGold', 'depositLetters', 'loanRepay', 'buyHouse', 'buyShip'];
  const right = ['withdrawGold', 'withdrawLetter', 'loanBorrow', 'sellHouse', 'sellShip'];
  left.forEach((k, i) => {
    assert.deepEqual([...BANK_RECTS[k]], [120, 58 + i * 18, 45, 8], k);
    assert.deepEqual([...BANK_RECTS[right[i]]], [172, 58 + i * 18, 45, 8], right[i]);
  });
  assert.deepEqual([...BANK_RECTS.exit], [92, 159, 40, 19]);
  assert.deepEqual([...BANK_RECTS.input], [113, 146, 103, 12]);
  assert.deepEqual({ ...AMOUNT_FIELD }, { numeric: true, maxCharacters: 9 });
  // the four live labels (:81-106)
  assert.deepEqual([...BANK_LABELS.account], [150, 14]);
  assert.deepEqual([...BANK_LABELS.inventory], [156, 24]);
  assert.deepEqual([...BANK_LABELS.loanDue], [96, 34]);
  assert.deepEqual([...BANK_LABELS.loanBy], [71, 44]);
  // everything fits inside the panel
  for (const [k, r] of Object.entries(BANK_RECTS)) {
    assert.ok(r[0] + r[2] <= BANK_PANEL_W && r[1] + r[3] <= BANK_PANEL_H, `${k} fits`);
  }
});

test('B2: ONE transaction at a time - every button dies while a field is open (:252-278)', () => {
  const { w } = win();
  // all live to begin with, except Repay (no loan)
  assert.equal(w.enabled('depositGold'), true);
  assert.equal(w.enabled('loanRepay'), false, 'nothing to repay');
  assert.equal(w.transactionType, T.None);

  clickRect(w, 'depositGold');
  assert.equal(w.transactionType, T.Depositing_gold);
  // ...and now EVERY button is dead, including the one that opened it
  for (const k of ['depositGold', 'withdrawGold', 'loanBorrow', 'buyHouse', 'sellShip', 'loanRepay']) {
    assert.equal(w.enabled(k), false, k);
  }
  // a click on another button cannot switch the live transaction
  clickRect(w, 'withdrawGold');
  assert.equal(w.transactionType, T.Depositing_gold, 'the open transaction stands');
  // the law says the same, directly
  assert.equal(toggleTransactionInput(T.Depositing_gold, T.Withdrawing_gold), T.Depositing_gold);
  assert.equal(toggleTransactionInput(T.Depositing_gold, T.None), T.None, 'only through None');
  // Escape cancels the field WITHOUT closing the window
  w.input('Escape');
  assert.equal(w.transactionType, T.None);
  assert.equal(w.done, false, 'Escape closed the FIELD, not the bank');
  // ...and now Escape does close it
  w.input('Escape');
  assert.equal(w.done, true);
});

test('B2: the field is numeric, nine wide, and Enter commits (:185-190, :212-223)', () => {
  const { w, entity, accounts } = win();
  clickRect(w, 'depositGold');
  type(w, 'a4b0c0');
  assert.equal(w.value, '400', 'letters are dropped');
  w.input('backspace');
  assert.equal(w.value, '40');
  type(w, '0');
  w.input('Enter');
  assert.equal(accountTotal(accounts, 17), 400);
  assert.equal(goldAmount(entity), 600);
  assert.equal(w.transactionType, T.None, 'and the field closes behind it');

  // nine characters is the cap
  clickRect(w, 'withdrawGold');
  type(w, '1234567890123');
  assert.equal(w.value.length, 9);

  // an empty or zero amount does NOTHING AT ALL - not an error box
  const b = win();
  clickRect(b.w, 'depositGold');
  b.w.input('Enter');
  assert.equal(b.w.box, null, 'no box');
  assert.equal(accountTotal(b.accounts, 17), 0);
  assert.equal(parseTransactionAmount(''), null);
  assert.equal(parseTransactionAmount('0'), null);
  assert.equal(parseTransactionAmount('-5'), null);
  assert.equal(parseTransactionAmount('12'), 12);
});

test('B2: Enter with no transaction open is NOT a close (:216-223)', () => {
  const { w } = win();
  w.input('Enter');
  assert.equal(w.done, false, 'Return commits an open transaction and does nothing otherwise');
  assert.equal(w.box, null);
});

test('B2: TOO_HEAVY is the one result with no record behind it (:308-309)', () => {
  const { w, entity, accounts } = win({ maxKg: 1, carriedKg: 0 });
  accounts[17].accountGold = 1000000;
  clickRect(w, 'withdrawGold');
  type(w, '1000000');
  w.input('Enter');
  assert.ok(w.box, 'a box opened');
  assert.equal(w.box.rows[0].text, CANNOT_CARRY_GOLD, 'the window supplies its own line');
  assert.equal(goldAmount(entity), 1000, 'and the gold stayed in the bank');
  assert.equal(accountTotal(accounts, 17), 1000000);
  // every OTHER result goes through TEXT.RSC by its own id
  w._dismissBox();
  clickRect(w, 'withdrawGold');
  type(w, '99999999');
  w.input('Enter');
  assert.equal(idOf(w.box), R.NOT_ENOUGH_ACCOUNT);
  // 0.0025 kg a piece is why the first one was refused
  assert.equal(GOLD_PIECE_WEIGHT_KG, 0.0025);
});

test('B2: borrowing refuses BEFORE the field opens, defaulted first (:398-415)', () => {
  // an ordinary region opens the field
  const a = win();
  clickRect(a.w, 'loanBorrow');
  assert.equal(a.w.transactionType, T.Borrowing_loan);
  assert.equal(a.w.box, null);

  // one that already has a loan is told so, and NO field opens
  const b = win();
  borrowLoan(b.accounts, 17, 1000, { level: 5, nowMinutes: 0 });
  clickRect(b.w, 'loanBorrow');
  assert.equal(idOf(b.w.box), R.ALREADY_HAVE_LOAN);
  assert.equal(b.w.transactionType, T.None);
  // ...and having a loan is what makes Repay live
  assert.equal(bankButtonEnabled('loanRepay', { accounts: b.accounts, regionIndex: 17 }), true);

  // DEFAULTED wins over having a loan - the order is DFU's
  const c = win();
  borrowLoan(c.accounts, 17, 1000, { level: 5, nowMinutes: 0 });
  c.accounts[17].hasDefaulted = true;
  clickRect(c.w, 'loanBorrow');
  assert.equal(idOf(c.w.box), R.ALREADY_DEFAULTED, 'not ALREADY_HAVE_LOAN');
});

test('B2: borrowing lands the loan and its due date', () => {
  const { w, accounts } = win();
  clickRect(w, 'loanBorrow');
  type(w, '10000');
  w.input('Enter');
  assert.equal(accountTotal(accounts, 17), 10000, 'the account gets the amount');
  assert.equal(loanedTotal(accounts, 17), 11000, 'the loan is amount + 10%');
  assert.ok(w.labels().loanBy.startsWith('due-'), 'and the due date shows');
  // over the ceiling is a box, not a loan
  const b = win();
  clickRect(b.w, 'loanBorrow');
  type(b.w, '999999');
  b.w.input('Enter');
  assert.equal(idOf(b.w.box), R.LOAN_REQUEST_TOO_HIGH);
  assert.equal(loanedTotal(b.accounts, 17), 0);
});

test('B2: depositing letters ASKS first - it is the only Yes/No (:313-319)', () => {
  const { w, entity, accounts } = win();
  entity.items.push(letterOfCredit(700), letterOfCredit(300));
  clickRect(w, 'depositLetters');
  assert.equal(idOf(w.box), R.DEPOSIT_LOC);
  assert.equal(w.box.buttons, 'YesNo', 'the one result that asks rather than tells');
  assert.equal(accountTotal(accounts, 17), 0, 'nothing banked yet');

  // NO leaves them in the pack
  w.input('KeyN');
  assert.equal(accountTotal(accounts, 17), 0);
  assert.equal(entity.items.filter((i) => i.templateIndex === LETTER_OF_CREDIT_TEMPLATE).length, 2);

  // YES takes them all
  clickRect(w, 'depositLetters');
  w.input('KeyY');
  assert.equal(accountTotal(accounts, 17), 1000, 'both, at face value');
  assert.equal(entity.items.filter((i) => i.templateIndex === LETTER_OF_CREDIT_TEMPLATE).length, 0);
});

test('B2: the house and ship buttons refuse before opening anything (:417-472)', () => {
  // no houses for sale (which is also DFU's answer with no directory)
  const a = win();
  clickRect(a.w, 'buyHouse');
  assert.equal(idOf(a.w.box), R.NO_HOUSES_FOR_SALE);
  // already own one
  const b = win({ ownsHouse: true });
  clickRect(b.w, 'buyHouse');
  assert.equal(idOf(b.w.box), R.ALREADY_OWN_HOUSE);
  // a ship outside a port town
  const c = win();
  clickRect(c.w, 'buyShip');
  assert.equal(idOf(c.w.box), R.NOT_PORT_TOWN);
  // ...and owning one wins over the port-town test
  const d = win({ ownsShip: true, isPortTown: false });
  clickRect(d.w, 'buyShip');
  assert.equal(idOf(d.w.box), R.ALREADY_OWN_SHIP, 'ownership is checked first');
  // selling what you do not own is a SILENT no-op - DFU has no else
  const e = win();
  clickRect(e.w, 'sellHouse');
  assert.equal(e.w.box, null);
  clickRect(e.w, 'sellShip');
  assert.equal(e.w.box, null);
  // owning one raises the offer carrying its price
  const f = win({ ownsShip: true, ownedShip: 0 });
  clickRect(f.w, 'sellShip');
  assert.equal(idOf(f.w.box), R.SELL_SHIP_OFFER);
  assert.equal(f.w.box.amount, 85000, '100000 x 0.85, truncated');
});

test('D6: BUY SHIP in a port opens the SHIPYARD - the else arm, not a refusal (:455-464)', () => {
  // The one reachable SUCCESS case used to answer NOT_PORT_TOWN: a
  // port town with no ship is buyShipDecision's `pick`, and DFU takes
  // the else arm and pushes BankPurchasePopup with a NULL house list
  // (:463). Unlike BUY HOUSE there is no fallback popup here - the
  // ships list is a fixed pair that cannot be empty.
  let opened = 0;
  const hooks = { openShipPurchase: () => { opened++; return true; } };
  const a = win({ isPortTown: true, hooks });
  clickRect(a.w, 'buyShip');
  assert.equal(a.w.box, null, 'a port town with no ship is not refused');
  assert.equal(opened, 1, 'and the shipyard is what it opens');
  // ...and BOTH refusals still stand, in DFU's own order
  const b = win({ isPortTown: true, ownsShip: true, hooks });
  clickRect(b.w, 'buyShip');
  assert.equal(idOf(b.w.box), R.ALREADY_OWN_SHIP);
  const c = win({ isPortTown: false, hooks });
  clickRect(c.w, 'buyShip');
  assert.equal(idOf(c.w.box), R.NOT_PORT_TOWN);
  assert.equal(opened, 1, 'neither refusal ever reaches the list');
});

test('D6: the host mounts BOTH arms of the ONE popup, and PurchaseShip has a caller at last', () => {
  const wm = readFileSync(join(root, 'src', 'scenes', 'worldModes.js'), 'utf8');
  assert.match(wm, /const openBankMarket = \(arms\) => \{/,
    'DFU has one popup class; the port must not grow a second mount for it');
  assert.match(wm, /openShipPurchase: \(\) => openBankMarket\(\{/, 'BUY SHIP reaches it with no house list at all');
  assert.match(wm, /purchaseShip\(playerEntity\.bankAccounts, bankRegion\(\), ship, playerEntity, bankPurse\(\)/,
    'PurchaseShip (:467-486) is callerless again');
  // AssignShipToPlayer (:488-497) makes BOTH scenes permanent - the
  // exact pair SellShip drops
  assert.match(wm, /addPermanentScene\(sceneCache\(\), worldSceneName\(SHIP_COORDS\[s\]\.x, SHIP_COORDS\[s\]\.y\)\)/);
  assert.match(wm, /addPermanentScene\(sceneCache\(\), interiorSceneName\(SHIP_INTERIOR_MAP_IDS\[s\], BUILDING_KEY_0\)\)/);
  // ...and the door of the ship it sells answers the lock ladder: the
  // key was simply absent at the call, so buildingLocks' last arm
  // (PlayerActivate.cs:1307-1308) could never fire
  assert.match(wm, /^ {10}ownsShip: ownsShip\(playerEntity\),$/m,
    'buildingIsUnlocked is handed no ownsShip, so it defaults false');
});

test('B2: the inventory label carries the WAGON in parentheses (:241-246)', () => {
  const dry = win();
  assert.equal(dry.w.labels().inventory, '1000', 'no cart, no parenthesis');
  const cart = win({ wagon: { group: 'Currency', stackCount: 5000 } });
  assert.equal(cart.w.labels().inventory, '1000 (+5000)');
  // AUDIT 54: and the line itself is `playerEntity.GetGoldAmount()`
  // (:241) - coins PLUS every letter of credit in the pack
  // (PlayerEntity.cs:1313-1316), not the bare coin counter. A player
  // who sold while overloaded holds paper and no coin, and this is the
  // one screen whose DEPOSIT LETTERS button banks exactly that paper:
  // it read 0 while offering to take 5000.
  const paper = win({ entity: { level: 5, goldPieces: 0, items: [letterOfCredit(5000)] } });
  assert.equal(paper.w.labels().inventory, '5000', 'the letter is money on this label');
  const both = win({ entity: { level: 5, goldPieces: 250, items: [letterOfCredit(5000)] }, wagon: { group: 'Currency', stackCount: 40 } });
  assert.equal(both.w.labels().inventory, '5250 (+40)', 'coins + letters, then the cart in parentheses');
  // one label, two purses - which is how a player sees what a deposit
  // can actually reach
  cart.accounts[17].accountGold = 42;
  assert.equal(cart.w.labels().account, '42');
  assert.equal(cart.w.labels().loanDue, '0');
  assert.equal(cart.w.labels().loanBy, '', 'no loan, no due date');
});

test('B2: the host consumes the banking route that has been dead since G8', () => {
  const code = readFileSync(join(root, 'src', 'scenes', 'worldModes.js'), 'utf8');
  assert.match(code, /route\.service === 'banking'/, 'the arm exists');
  assert.match(code, /preloadBankArt\(/, 'and the art is preloaded with the rest');
  assert.match(code, /createBankAccounts\(/, 'the accounts are minted on first use');
  // the save carries them
  const save = readFileSync(join(root, 'src', 'systems', 'save.js'), 'utf8');
  assert.match(save, /snap\.bankAccounts =/);
  assert.match(save, /entity\.bankAccounts = \(snap\.bankAccounts \?\? \[\]\)/);
});
