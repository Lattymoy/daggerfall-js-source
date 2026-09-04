// B1: the banking law against DaggerfallBankManager.cs, LoanChecker.cs
// and FormulaHelper's two loan formulas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TRANSACTION_RESULT, TRANSACTION_TYPE, SHIP_TYPES, SHIP_PRICES,
  DEED_SELL_MULT, HOUSE_PRICE_MULT, LOAN_REPAY_MINUTES, LOAN_MAX_PER_LEVEL,
  LOC_COMMISSION, LOC_MINIMUM, LOAN_MINIMUM, MINUTES_PER_MONTH, LOAN_REMINDER_MONTHS,
  shipPrice, shipSellPrice, housePrice, houseSellPrice,
  shipModelId, shipCoords, ownsShip, ownedShipType, purchaseShip, sellShip, assignShipToPlayer,
  createBankAccounts, createHouses, validateRegion,
  accountTotal, loanedTotal, loanDueDate, hasLoan, hasDefaulted, setDefaulted,
  calculateMaxBankLoan, calculateBankLoanRepayment,
  depositGold, withdrawGold, depositAllLetters, withdrawLetter,
  repayLoan, borrowLoan, checkOverdueLoans, settleOverdueLoan,
} from '../src/systems/banking.js';
import { GOLD_PIECE_WEIGHT_KG, letterOfCredit, LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { goldAmount, deductGold, addGold, CRIMES } from '../src/systems/court.js';
import { DAYS_PER_YEAR, MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const R = TRANSACTION_RESULT;

/** The host's purse seam over a plain entity. */
const purse = (entity, { maxKg = 1e9, carriedKg = 0, wagon = null } = {}) => ({
  gold: () => goldAmount(entity),
  deductGold: (n) => deductGold(entity, n),
  addGold: (n) => addGold(entity, n),
  wagonGold: () => wagon?.stackCount ?? 0,
  takeWagonGold: (n) => { wagon.stackCount -= n; },
  takeLetter: () => {
    const i = (entity.items ?? []).findIndex((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);
    return i < 0 ? null : entity.items.splice(i, 1)[0];
  },
  addLetter: (loc) => entity.items.unshift(loc),
  carriedWeightKg: () => carriedKg,
  maxEncumbranceKg: () => maxKg,
});
// E4: the purse is PlayerEntity.GoldPieces, a counter.
const player = (gold = 1000) => ({ level: 5, goldPieces: gold, items: [] });

test('B1: TransactionResult values ARE TEXT.RSC ids (:29-51)', () => {
  // 0282-0299 is one contiguous block of banking dialogue, which is
  // why DFU writes the enum as four-digit literals
  assert.equal(R.PURCHASED_HOUSE, 282);
  assert.equal(R.SELL_SHIP_OFFER, 299);
  for (const k of ['PURCHASED_HOUSE', 'PURCHASED_SHIP', 'ALREADY_OWN_SHIP', 'NOT_PORT_TOWN',
    'ALREADY_OWN_HOUSE', 'NO_HOUSES_FOR_SALE', 'ALREADY_DEFAULTED', 'ALREADY_HAVE_LOAN',
    'NOT_ENOUGH_ACCOUNT', 'DEPOSIT_LOC', 'NOT_ENOUGH_ACCOUNT_LOC', 'LOC_REQUEST_TOO_SMALL',
    'OVERPAID_LOAN', 'LOAN_REQUEST_TOO_HIGH', 'LOAN_REQUEST_TOO_LOW', 'BOUNTY_DEFAULT_LOAN',
    'SELL_HOUSE_OFFER', 'SELL_SHIP_OFFER']) {
    assert.ok(R[k] >= 282 && R[k] <= 299, `${k} is inside the banking block`);
  }
  // the two that are NOT records
  assert.equal(R.NONE, 0);
  assert.equal(R.TOO_HEAVY, 1);
  // and the one borrowed from the trade window
  assert.equal(R.NOT_ENOUGH_GOLD, 454);
  // every TransactionType MakeTransaction switches on exists
  for (const t of ['Depositing_gold', 'Withdrawing_gold', 'Withdrawing_Letter', 'Depositing_LOC',
    'Repaying_loan', 'Borrowing_loan', 'Repaying_loan_from_account',
    'Buy_house', 'Sell_house', 'Buy_ship', 'Sell_ship']) {
    assert.ok(TRANSACTION_TYPE[t], t);
  }
});

test('B1: the deed prices - ships flat, houses by MESH RADIUS (:93-172)', () => {
  assert.deepEqual([...SHIP_PRICES], [100000, 200000]);
  assert.equal(SHIP_TYPES.None, -1, 'None indexes nothing');
  assert.equal(shipPrice(SHIP_TYPES.Small), 100000);
  assert.equal(shipPrice(SHIP_TYPES.Large), 200000);
  assert.equal(shipPrice(SHIP_TYPES.None), 0, 'a ship you do not own is worth nothing');
  // deedSellMult 0.85, and the C# (int) cast TRUNCATES
  assert.equal(DEED_SELL_MULT, 0.85);
  assert.equal(shipSellPrice(SHIP_TYPES.Small), 85000);
  assert.equal(shipSellPrice(SHIP_TYPES.Large), 170000);
  // a house is its MODEL's radius x 1280 - the whole valuation
  assert.equal(HOUSE_PRICE_MULT, 1280);
  assert.equal(housePrice(10), 12800);
  assert.equal(houseSellPrice(10), Math.trunc(12800 * 0.85));
  // and the C# (int) cast TRUNCATES rather than rounding. 3.7 x 1280
  // is exactly 4736, so it proves nothing - the radius has to land on
  // a real fraction, which a mesh radius (a raw int over POINT_DIVISOR)
  // routinely does.
  const third = 1 / 3;
  assert.equal(housePrice(third), 426, 'trunc(426.66)');
  assert.equal(Math.round(third * HOUSE_PRICE_MULT), 427, 'rounding would say 427');
  assert.notEqual(housePrice(third), Math.round(third * HOUSE_PRICE_MULT));
  // the sell price truncates a SECOND time, over the truncated price
  assert.equal(houseSellPrice(third), Math.trunc(426 * 0.85));
});

test('B1: the store is PER REGION, and a bad index is not an empty account', () => {
  const accounts = createBankAccounts(62);
  assert.equal(accounts.length, 62);
  assert.equal(accounts[17].regionIndex, 17, 'each record remembers its own index');
  assert.deepEqual(createHouses(62)[3], { regionIndex: 3, location: '', mapId: 0, buildingKey: 0 });

  assert.equal(validateRegion(accounts, 0), true);
  assert.equal(validateRegion(accounts, 61), true);
  assert.equal(validateRegion(accounts, -1), false, 'the wilderness region');
  assert.equal(validateRegion(accounts, 62), false);
  // the READERS throw on a bad index rather than answering zero - that
  // is what tells a -1 region apart from an empty account (:559-567)
  assert.throws(() => accountTotal(accounts, -1), RangeError);
  assert.throws(() => loanedTotal(accounts, 62), RangeError);
  assert.throws(() => loanDueDate(accounts, -1), RangeError);
  // ...but hasLoan/hasDefaulted do NOT, which is why the overdue
  // sweep can walk every index (:213-231)
  assert.equal(hasLoan(accounts, -1), false);
  assert.equal(hasDefaulted(accounts, 999), false);
  setDefaulted(accounts, -1, true);   // a silent no-op, not a throw
  assert.equal(hasDefaulted(accounts, 0), false);
});

test('B1: depositing draws on the WAGON only for the shortfall (:339-360)', () => {
  const accounts = createBankAccounts(62);
  const e = player(100);
  const wagon = { stackCount: 500 };
  const p = purse(e, { wagon });
  // more than purse + wagon is refused outright
  assert.equal(depositGold(accounts, 0, 601, p), R.NOT_ENOUGH_GOLD);
  assert.equal(accountTotal(accounts, 0), 0, 'and nothing moved');

  // within the purse: the wagon is untouched
  assert.equal(depositGold(accounts, 0, 60, p), R.NONE);
  assert.equal(accountTotal(accounts, 0), 60);
  assert.equal(goldAmount(e), 40);
  assert.equal(wagon.stackCount, 500, 'the cart was not opened');

  // past the purse: the purse EMPTIES and the cart covers the rest
  assert.equal(depositGold(accounts, 0, 240, p), R.NONE);
  assert.equal(accountTotal(accounts, 0), 300);
  assert.equal(goldAmount(e), 0, 'the purse goes first');
  assert.equal(wagon.stackCount, 300, '200 of the 240 came off the cart');
});

test('B1: withdrawing gold can be refused for WEIGHT (:362-375)', () => {
  const accounts = createBankAccounts(62);
  accounts[0].accountGold = 1000000;
  const e = player(0);
  // more than the account
  assert.equal(withdrawGold(accounts, 0, 2000000, purse(e)), R.NOT_ENOUGH_ACCOUNT);

  // gold is 0.0025 kg a piece, so a million pieces is 2500 kg
  const heavy = purse(e, { carriedKg: 0, maxKg: 100 });
  assert.equal(withdrawGold(accounts, 0, 1000000, heavy), R.TOO_HEAVY);
  assert.equal(goldAmount(e), 0, 'and it is refused OUTRIGHT, not partly paid');
  assert.equal(accountTotal(accounts, 0), 1000000);

  // the boundary is >, so landing exactly on the cap is allowed
  const exact = 100 / GOLD_PIECE_WEIGHT_KG;   // 40000 pieces
  assert.equal(withdrawGold(accounts, 0, exact, purse(e, { maxKg: 100 })), R.NONE);
  assert.equal(goldAmount(e), exact);
  assert.equal(withdrawGold(accounts, 0, 1, purse(e, { carriedKg: 100, maxKg: 100 })), R.TOO_HEAVY);
});

test('B1: the letter commission is the BANK\'s, and the minimum is tested SECOND (:391-404)', () => {
  const accounts = createBankAccounts(62);
  accounts[0].accountGold = 10000;
  const e = player(0);
  const p = purse(e);

  assert.equal(withdrawLetter(accounts, 0, 1000, p), R.NONE);
  // the ACCOUNT pays 1010; the LETTER is worth 1000
  assert.equal(accountTotal(accounts, 0), 10000 - 1010);
  assert.equal(e.items[0].templateIndex, LETTER_OF_CREDIT_TEMPLATE);
  assert.equal(e.items[0].value, 1000, 'the commission is not carried by the letter');
  assert.equal(LOC_COMMISSION, 1.01);

  // THE ORDER: the balance test comes BEFORE the minimum, so a small
  // request against a poor account is refused for FUNDS, not size
  const broke = createBankAccounts(62);
  assert.equal(withdrawLetter(broke, 0, 50, p), R.NOT_ENOUGH_ACCOUNT_LOC,
    'not LOC_REQUEST_TOO_SMALL - the balance is checked first');
  // ...and with the funds there, the same request IS too small
  broke[0].accountGold = 10000;
  assert.equal(withdrawLetter(broke, 0, 50, p), R.LOC_REQUEST_TOO_SMALL);
  assert.equal(LOC_MINIMUM, 100);
  assert.equal(withdrawLetter(broke, 0, 100, p), R.NONE, 'exactly 100 is allowed');
});

test('B1: depositing letters takes EVERY one, at face value (:377-389)', () => {
  const accounts = createBankAccounts(62);
  const e = player(0);
  e.items.push(letterOfCredit(500), letterOfCredit(1500), { group: 'Weapons', templateIndex: 7 });
  assert.equal(depositAllLetters(accounts, 0, purse(e)), R.NONE);
  assert.equal(accountTotal(accounts, 0), 2000, 'both letters, at face value');
  assert.equal(e.items.filter((i) => i.templateIndex === LETTER_OF_CREDIT_TEMPLATE).length, 0);
  assert.equal(e.items.length, 1, 'the sword is untouched (E4: the purse is not an item)');
  // an empty pack is not an error
  assert.equal(depositAllLetters(accounts, 0, purse(e)), R.NONE);
});

test('B1: borrowing credits the account with the AMOUNT and the loan with amount + 10% (:542-556)', () => {
  const accounts = createBankAccounts(62);
  assert.equal(LOAN_MAX_PER_LEVEL, 50000);
  assert.equal(calculateMaxBankLoan(5), 250000, 'level x 50k, and nothing else');
  assert.equal(calculateMaxBankLoan(1), 50000);
  // `(int)(amount + amount * .1)` - a float sum truncated ONCE
  assert.equal(calculateBankLoanRepayment(1000), 1100);
  assert.equal(calculateBankLoanRepayment(999), Math.trunc(999 + 99.9));
  assert.equal(calculateBankLoanRepayment(999), 1098);
  // EQUIVALENT MUTANT, recorded so nobody re-hunts it: truncating the
  // two halves separately - `amount + trunc(amount * .1)` - cannot be
  // told apart from DFU's single trailing cast. `amount` is an int, so
  // it contributes no fraction of its own and the only fraction in the
  // sum is the one both forms truncate. Swept rather than argued, over
  // the whole range a loan can take (the floor is 100, the ceiling is
  // level x 50k).
  for (const a of [100, 101, 999, 1000, 12345, 99999, 4250000]) {
    assert.equal(calculateBankLoanRepayment(a), a + Math.trunc(a * 0.1), `amount ${a}`);
  }

  assert.equal(borrowLoan(accounts, 0, 50, { level: 5 }), R.LOAN_REQUEST_TOO_LOW);
  assert.equal(LOAN_MINIMUM, 100);
  assert.equal(borrowLoan(accounts, 0, 250001, { level: 5 }), R.LOAN_REQUEST_TOO_HIGH);
  assert.equal(accountTotal(accounts, 0), 0, 'a refused loan changes nothing');

  assert.equal(borrowLoan(accounts, 0, 10000, { level: 5, nowMinutes: 1000 }), R.NONE);
  assert.equal(accountTotal(accounts, 0), 10000, 'the account gets the AMOUNT');
  assert.equal(loanedTotal(accounts, 0), 11000, 'the loan is amount + 10%');
  // the interest exists from the instant the loan is made - there is
  // no accrual, so repaying early saves nothing
  assert.equal(loanDueDate(accounts, 0), 1000 + LOAN_REPAY_MINUTES);
  assert.equal(LOAN_REPAY_MINUTES, DAYS_PER_YEAR * MINUTES_PER_DAY, 'exactly one year');
  assert.equal(hasLoan(accounts, 0), true);
});

test('B1: repaying spans purse, letters and account in ONE transaction (:508-540)', () => {
  const accounts = createBankAccounts(62);
  borrowLoan(accounts, 0, 10000, { level: 5, nowMinutes: 0 });   // owes 11000, account 10000
  const e = player(500);
  const p = purse(e);

  // more than purse + account is refused
  assert.equal(repayLoan(accounts, 0, 99999, p).result, R.NOT_ENOUGH_GOLD);
  assert.equal(loanedTotal(accounts, 0), 11000, 'nothing paid');

  // a payment the purse can cover comes off the PURSE alone
  assert.equal(repayLoan(accounts, 0, 400, p).result, R.NONE);
  assert.equal(goldAmount(e), 100);
  assert.equal(accountTotal(accounts, 0), 10000, 'the account is untouched');
  assert.equal(loanedTotal(accounts, 0), 10600);

  // a payment PAST the purse takes the remainder off the account
  assert.equal(repayLoan(accounts, 0, 600, p).result, R.NONE);
  assert.equal(goldAmount(e), 0, 'the purse emptied');
  assert.equal(accountTotal(accounts, 0), 10000 - 500, 'and 500 came off the account');
  assert.equal(loanedTotal(accounts, 0), 10000);
});

test('B1: overpaying CLAMPS to the loan and says so (:526-530)', () => {
  const accounts = createBankAccounts(62);
  borrowLoan(accounts, 0, 1000, { level: 5, nowMinutes: 0 });   // owes 1100
  const e = player(100000);
  const r = repayLoan(accounts, 0, 5000, purse(e));
  assert.equal(r.result, R.OVERPAID_LOAN);
  assert.equal(r.amount, 1100, 'the caller is told what was ACTUALLY taken');
  assert.equal(goldAmount(e), 100000 - 1100, 'and only that much left the purse');
  assert.equal(loanedTotal(accounts, 0), 0);
  // a cleared loan drops its due date, so the checker stops watching
  assert.equal(loanDueDate(accounts, 0), 0);
  assert.equal(hasLoan(accounts, 0), false);
  // and repaying nothing owed is a silent NONE
  assert.equal(repayLoan(accounts, 0, 100, purse(e)).result, R.NONE);
});

test('B1: the loan reminder fires on a CROSSING, not on a state (:32-47)', () => {
  assert.deepEqual([...LOAN_REMINDER_MONTHS], [6, 3, 1]);
  const accounts = createBankAccounts(62);
  const due = 100 * MINUTES_PER_MONTH;
  accounts[0].loanDueDate = due;
  accounts[0].loanTotal = 5000;

  const at = (last, now) => checkOverdueLoans(accounts, last, now);
  // seven months out, ticking to just past six: the 6-month mark is
  // crossed and the reminder speaks ONCE
  const crossing = at(due - 6.1 * MINUTES_PER_MONTH, due - 5.9 * MINUTES_PER_MONTH);
  assert.equal(crossing.reminders.length, 1);
  assert.equal(crossing.reminders[0].regionIndex, 0);
  assert.equal(crossing.reminders[0].owed, 5000);

  // ...and a tick that stays inside the same month says NOTHING. A
  // poll reading "months <= 6" would nag on every tick for months.
  assert.deepEqual(at(due - 5.9 * MINUTES_PER_MONTH, due - 5.5 * MINUTES_PER_MONTH).reminders, []);
  assert.deepEqual(at(due - 5.5 * MINUTES_PER_MONTH, due - 4.0 * MINUTES_PER_MONTH).reminders, []);
  // the 3 and 1 marks each speak on their own crossing
  assert.equal(at(due - 3.1 * MINUTES_PER_MONTH, due - 2.9 * MINUTES_PER_MONTH).reminders.length, 1);
  assert.equal(at(due - 1.1 * MINUTES_PER_MONTH, due - 0.9 * MINUTES_PER_MONTH).reminders.length, 1);
  // a month boundary that is NOT one of the three is silent
  assert.deepEqual(at(due - 5.1 * MINUTES_PER_MONTH, due - 4.9 * MINUTES_PER_MONTH).reminders, []);

  // past the due date it is OVERDUE, not a reminder
  const late = at(due + 10, due + 20);
  assert.deepEqual(late.reminders, []);
  assert.deepEqual(late.overdue, [0]);
  // THE TICK THAT CROSSES IT is the case that matters, because that
  // is how a loan actually comes due - not on a tick that starts
  // already late. The test compares against NOW, so a due date the
  // tick stepped over is caught on that tick and not a tick later.
  const crossed = at(due - 5, due + 5);
  assert.deepEqual(crossed.overdue, [0], 'due date passed BETWEEN the two ticks');
  assert.deepEqual(crossed.reminders, [], 'and it is not also a reminder');
  // the boundary is strict: landing exactly ON the due minute is not
  // yet overdue
  assert.deepEqual(at(due - 5, due).overdue, [], 'exactly due is not yet late');
  assert.deepEqual(at(due - 5, due + 1).overdue, [0], 'one minute past is');

  // RECORDED, not hunted: DFU guards the reminder block with
  // `if (remainingMonths < lastRemainingMonths)` before running the
  // 6/3/1 test, and that guard is IMPLIED by the test itself - the
  // predicate `last >= m && now < m` can only hold when now < last.
  // The port keeps the guard because the source has it, but removing
  // it is an equivalent mutant and no pin here can kill it.
  // and an account with no loan is never looked at
  assert.deepEqual(checkOverdueLoans(createBankAccounts(62), 0, 1e9), { reminders: [], overdue: [] });
});

test('B1: an overdue loan raids the ACCOUNT first, and defaults ONCE (:53-72)', () => {
  const accounts = createBankAccounts(62);
  const e = player(100000);
  const p = purse(e);

  // the account covers it: settled, no default, and the PURSE is not
  // touched - the sweep pays from the account alone
  borrowLoan(accounts, 0, 1000, { level: 5, nowMinutes: 0 });   // owes 1100, account 1000
  accounts[0].accountGold = 5000;
  assert.deepEqual(settleOverdueLoan(accounts, 0, p), { kind: 'settled' });
  assert.equal(loanedTotal(accounts, 0), 0);
  assert.equal(goldAmount(e), 100000, 'the purse was never opened');
  assert.equal(hasDefaulted(accounts, 0), false);

  // the account CANNOT cover it: what it has goes, and the rest is a
  // default carrying the crime the court law has had since S25 with
  // no caller at all
  const poor = createBankAccounts(62);
  borrowLoan(poor, 1, 10000, { level: 5, nowMinutes: 0 });   // owes 11000, account 10000
  poor[1].accountGold = 400;
  const d = settleOverdueLoan(poor, 1, p);
  assert.equal(d.kind, 'defaulted');
  assert.equal(d.crime, CRIMES.LoanDefault);
  assert.equal(CRIMES.LoanDefault, 15);
  assert.equal(accountTotal(poor, 1), 0, 'the account was drained for what it had');
  assert.equal(loanedTotal(poor, 1), 11000 - 400);
  assert.equal(hasDefaulted(poor, 1), true);

  // a SECOND sweep does not drop reputation twice
  assert.deepEqual(settleOverdueLoan(poor, 1, p), { kind: 'alreadyDefaulted' });
});

test('B1: DeductGoldAmount - a LETTER OF CREDIT is legal tender (:1324-1354)', () => {
  // The port's deductGold was a clamp: it could not spend a letter and
  // it reported nothing. Both halves matter, and the first one makes
  // every existing caller more correct - a character holding a big
  // letter and a few coins could not pay a fine.
  const e = player(10);
  e.items.push(letterOfCredit(5000));
  assert.equal(deductGold(e, 100), 0, 'fully paid');
  assert.equal(goldAmount(e), 10, 'the COINS are untouched - the letter paid');
  assert.equal(e.items.find((i) => i.templateIndex === LETTER_OF_CREDIT_TEMPLATE).value, 4900,
    'and the letter carries its remainder');

  // a payment inside the purse never breaks a letter
  const e2 = player(1000);
  e2.items.push(letterOfCredit(5000));
  assert.equal(deductGold(e2, 400), 0);
  assert.equal(goldAmount(e2), 600);
  assert.equal(e2.items.find((i) => i.templateIndex === LETTER_OF_CREDIT_TEMPLATE).value, 5000);

  // whole letters are SPENT, then the purse covers the rest
  const e3 = player(500);
  e3.items.push(letterOfCredit(100), letterOfCredit(200));
  assert.equal(deductGold(e3, 700), 0);
  assert.equal(e3.items.filter((i) => i.templateIndex === LETTER_OF_CREDIT_TEMPLATE).length, 0,
    'both letters spent');
  assert.equal(goldAmount(e3), 100, '300 from letters, 400 from the purse');

  // AND IT RETURNS THE SHORTFALL. B1's loan repayment is the first
  // caller that reads it - the bank takes the remainder off the account.
  const e4 = player(50);
  assert.equal(deductGold(e4, 200), 150, 'the 150 it could not cover');
  assert.equal(goldAmount(e4), 0, 'and the purse is empty, not negative');
  // a plain full payment still answers 0, so the 21 existing callers
  // that ignore the return are unaffected
  assert.equal(deductGold(player(500), 500), 0);
});

test('B1: the accounts and the loan SURVIVE a save (SerializablePlayer)', async () => {
  const { snapshotPlayer, restorePlayer } = await import('../src/systems/save.js');
  const e = {
    name: 'Rin', stats: { strength: 50 }, skills: [], skillUses: [], items: [],
    spells: [], activeEffects: [], level: 5,
    bankAccounts: createBankAccounts(62),
  };
  borrowLoan(e.bankAccounts, 17, 10000, { level: 5, nowMinutes: 500000 });
  e.bankAccounts[3].accountGold = 777;
  e.bankAccounts[3].hasDefaulted = true;

  const snap = snapshotPlayer(e, {});
  // clobber the live state the way a fresh session would
  const loaded = { stats: {}, items: [] };
  restorePlayer(loaded, snap);

  assert.equal(loaded.bankAccounts.length, 62, 'every region came back');
  assert.equal(accountTotal(loaded.bankAccounts, 17), 10000);
  assert.equal(loanedTotal(loaded.bankAccounts, 17), 11000, 'the loan survived');
  assert.equal(loanDueDate(loaded.bankAccounts, 17), 500000 + LOAN_REPAY_MINUTES,
    'and so did its due date - without this the checker forgets to collect');
  assert.equal(accountTotal(loaded.bankAccounts, 3), 777, 'a DIFFERENT region kept its own gold');
  assert.equal(hasDefaulted(loaded.bankAccounts, 3), true, 'and its defaulted flag');
  // the snapshot is DETACHED from the live entity - banking after a
  // save must not rewrite the save. Mutating the ENTITY is the side
  // that matters; mutating the restored copy proves nothing, because
  // restore already built fresh objects.
  e.bankAccounts[17].accountGold = 1;
  e.bankAccounts[17].loanTotal = 0;
  assert.equal(snap.bankAccounts[17].accountGold, 10000, 'the snapshot did not follow the entity');
  assert.equal(snap.bankAccounts[17].loanTotal, 11000);
  // ...and the restored copy is detached from the snapshot too
  loaded.bankAccounts[3].accountGold = 5;
  assert.equal(snap.bankAccounts[3].accountGold, 777);
  // a PRE-B1 save restores empty rather than throwing
  const old = { ...snap };
  delete old.bankAccounts;
  const fresh = { stats: {}, items: [] };
  restorePlayer(fresh, old);
  assert.deepEqual(fresh.bankAccounts, []);
});

// ── H3: SHIP OWNERSHIP + the two SELL arms ───────────────────────
//
// The tables, prices and decisions all shipped with B1/H1/H2; what
// was missing was the ownership STATE and the transactions that move
// it, plus the two sell offers actually selling anything.

test('H3: ShipType.None is -1 so it indexes NOTHING, and every table read is guarded', () => {
  // DFU guards each accessor with `ship >= 0` (:118-124) because None
  // would otherwise index shipPrices[-1] and throw. IN JS THAT GUARD
  // IS NOT OBSERVABLE - `arr[-1]` is already undefined - so what these
  // lines pin is the ANSWER (0 / null), not the guard. Removing the
  // guard entirely still passes; making None fall through to Small's
  // row does not, which is the failure that matters.
  assert.equal(SHIP_TYPES.None, -1);
  assert.equal(shipPrice(SHIP_TYPES.None), 0);
  assert.equal(shipSellPrice(SHIP_TYPES.None), 0);
  assert.equal(shipModelId(SHIP_TYPES.None), 0);
  // ...and a player with no ship has no coords at all - DFU returns
  // null rather than coords[-1] (:126)
  assert.equal(shipCoords({}), null);
  assert.equal(ownsShip({}), false);
  assert.equal(ownedShipType({}), SHIP_TYPES.None);
});

test('H3: a deed sells for 85% of its price, TRUNCATED', () => {
  // deedSellMult (:93) through a C# (int) cast (:120, :173). BOTH SHIP
  // PRICES ARE EXACT MULTIPLES of 0.85, so the ship rows cannot show
  // the truncation at all - the house line at the bottom is the one
  // that does, and it is the one that fails when the cast is dropped.
  assert.equal(shipSellPrice(SHIP_TYPES.Small), Math.trunc(100000 * DEED_SELL_MULT));
  assert.equal(shipSellPrice(SHIP_TYPES.Large), Math.trunc(200000 * DEED_SELL_MULT));
  assert.equal(shipSellPrice(SHIP_TYPES.Small), 85000);
  // the truncation is observable on a radius that does not divide
  const radius = 7.77;
  assert.equal(houseSellPrice(radius), Math.trunc(Math.trunc(radius * HOUSE_PRICE_MULT) * DEED_SELL_MULT));
});

test('H3: buying a ship takes the PURSE first and the account covers the rest (:481-482)', () => {
  const accounts = createBankAccounts(3);
  accounts[1].accountGold = 60000;
  const player = {};
  let purseGold = 50000;
  // DeductGoldAmount answers what it could NOT take - that remainder
  // is what the account pays.
  const purse = {
    gold: () => purseGold,
    deductGold: (n) => { const took = Math.min(purseGold, n); purseGold -= took; return n - took; },
  };
  const r = purchaseShip(accounts, 1, SHIP_TYPES.Small, player, purse);
  assert.equal(r.kind, 'purchased');
  assert.equal(r.price, 100000);
  assert.equal(purseGold, 0, 'the purse was not emptied first');
  assert.equal(accounts[1].accountGold, 10000, 'the account did not cover exactly the shortfall');
  assert.equal(ownedShipType(player), SHIP_TYPES.Small);
  assert.equal(ownsShip(player), true);
});

test('H3: a ship you cannot afford between purse AND account is refused, and nothing moves', () => {
  const accounts = createBankAccounts(3);
  accounts[0].accountGold = 1000;
  const player = {};
  const purse = { gold: () => 500, deductGold: () => { throw new Error('must not deduct on a refusal'); } };
  const r = purchaseShip(accounts, 0, SHIP_TYPES.Large, player, purse);
  assert.equal(r.kind, 'refuse');
  assert.equal(r.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD);
  assert.equal(accounts[0].accountGold, 1000, 'the account moved on a refusal');
  assert.equal(ownsShip(player), false);
});

test('H3: buying a ship makes BOTH its scenes permanent, selling drops both', () => {
  // AssignShipToPlayer (:488-497) and SellShip (:499-507). The port
  // hands the ship type to one hook and lets the host name the pair,
  // because only the host knows how it spells a scene.
  const accounts = createBankAccounts(2);
  accounts[0].accountGold = 200000;
  const player = {};
  const added = [];
  const dropped = [];
  purchaseShip(accounts, 0, SHIP_TYPES.Large, player,
    { gold: () => 0, deductGold: (n) => n },
    { addPermanentScene: (ship) => added.push(ship) });
  assert.deepEqual(added, [SHIP_TYPES.Large], 'the purchase made no scene permanent');
  const r = sellShip(accounts, 0, player, { removePermanentScene: (ship) => dropped.push(ship) });
  assert.equal(r.kind, 'sold');
  assert.deepEqual(dropped, [SHIP_TYPES.Large], 'the sale dropped no scene');
  assert.equal(ownsShip(player), false, 'the ship survived its own sale');
});

test('H3: a ship sale credits the ACCOUNT, not the purse - a deed is paid into the bank', () => {
  const accounts = createBankAccounts(2);
  const player = { ownedShip: SHIP_TYPES.Small };
  const r = sellShip(accounts, 1, player);
  assert.equal(r.price, 85000);
  assert.equal(accounts[1].accountGold, 85000, 'the sale did not reach the account');
  assert.equal(ownedShipType(player), SHIP_TYPES.None);
});

test('H3 DEPARTURE: selling a ship you do not own is REFUSED, where DFU credits zero', () => {
  // SellShip has no ownership guard (:499): with ShipType.None it
  // credits GetShipSellPrice(None), which the `ship >= 0` guard makes
  // 0, so DFU's arithmetic is harmless but it still clears the scenes
  // and re-assigns None. The port refuses outright - recorded in
  // Ledger A rather than silently matched.
  const accounts = createBankAccounts(2);
  let dropped = 0;
  const r = sellShip(accounts, 0, {}, { removePermanentScene: () => { dropped++; } });
  assert.equal(r.kind, 'none');
  assert.equal(accounts[0].accountGold, 0);
  assert.equal(dropped, 0, 'a sale that never happened dropped a scene');
});

test('H3 hosts: the three stubbed producers are producing', () => {
  const wm = readFileSync(join(process.cwd(), 'src/scenes/worldModes.js'), 'utf8');
  // These three shipped as literals - `() => 0`, `() => false`,
  // `() => -1` - so the bank window drew a Sell button that quoted
  // nothing and a Buy Ship that could never be in a port.
  for (const stub of ['houseSellPrice: () => 0', 'ownsShip: () => false', 'ownedShip: () => -1', 'isPortTown: () => false']) {
    assert.ok(!wm.includes(stub), `the ${stub.split(':')[0]} producer is stubbed again`);
  }
  // the sell price is measured off the OWNED building's mesh, the same
  // reader the market list uses
  assert.match(wm, /houseSellPrice\(houseMeshRadius\(owned\)\)/, 'the sell price is not measured off the owned house');
  // ...and PortTownAndUnknown reaches it from the location directory
  assert.match(wm, /portTownAndUnknown \?\? 0\) !== 0/, 'the port-town test is not the PortTownAndUnknown byte');
  const w = readFileSync(join(process.cwd(), 'src/scenes/world.js'), 'utf8');
  assert.match(w, /portTownAndUnknown: loc\.exterior\?\.exteriorData\?\.portTownAndUnknown/,
    'the host never reads the byte off the location');

  const bw = readFileSync(join(process.cwd(), 'src/ui/bankWindow.js'), 'utf8');
  // BOTH sell offers ask, not just the letter deposit (:313-334) -
  // and a Yes has to actually sell
  assert.match(bw, /\[TRANSACTION_RESULT\.SELL_HOUSE_OFFER\]: \(\) => this\.hooks\.sellHouse/,
    'accepting the house offer does not sell the house');
  assert.match(bw, /\[TRANSACTION_RESULT\.SELL_SHIP_OFFER\]: \(\) => this\.hooks\.sellShip/,
    'accepting the ship offer does not sell the ship');
});
