// B1 - THE BANKING LAW: DaggerfallBankManager.cs and LoanChecker.cs
// (MIT, Daggerfall Workshop / Lypyl, Hazelnut), plus FormulaHelper's
// two loan formulas.
//
// Audit-25 listed banking among the six systems at or near zero, and
// several laws already in the tree have been waiting on it with no
// caller at all: CRIMES.LoanDefault (court.js:44) has never fired,
// U40's letter of credit is minted and carried with nowhere to cash
// it, and staticNpcRoute has answered { merchant, 'banking' } since G8
// into a dead arm.
//
// THE STORE IS PER REGION. There is one account per region, not one
// account - so gold banked in Daggerfall cannot be withdrawn in
// Wayrest, and a loan defaults against the region that made it. The
// array is sized from the map reader's region count and every reader
// validates its index rather than trusting the caller.
//
// FOUR THINGS THAT DO NOT READ THE WAY THEY LOOK, all pinned:
//
// 1. WITHDRAWING GOLD CAN BE REFUSED FOR WEIGHT (:539-541). The bank
//    checks CarriedWeight + amount * goldPieceWeightInKg against
//    MaxEncumbrance and answers TOO_HEAVY - the same test U40's
//    letter-of-credit gate makes on the way out of a shop, so the
//    weight law has one home and both callers read it.
//
// 2. THE LETTER-OF-CREDIT COMMISSION IS CHARGED ON THE ACCOUNT AND
//    NOT CARRIED BY THE LETTER (:562-573). `amount * 1.01` leaves the
//    account; the letter is worth `amount`. The 1% is the bank's.
//
// 3. AND THE MINIMUM IS TESTED SECOND. `amountPlusCommission >
//    account` comes BEFORE `amount < 100`, so asking for 50 gold on an
//    empty account is refused for INSUFFICIENT FUNDS rather than for
//    being under the minimum. The order is DFU's and is observable.
//
// 4. BORROWING CREDITS THE ACCOUNT WITH `amount` AND DEBITS THE LOAN
//    WITH `amount + 10%` (:551-554). The interest exists from the
//    instant the loan is made - there is no accrual, and repaying
//    early saves nothing.

import { CRIMES } from './court.js';
import { GOLD_PIECE_WEIGHT_KG, letterOfCredit } from './inventory.js';
import { DAYS_PER_YEAR, DAYS_PER_MONTH, MINUTES_PER_DAY } from './gameDate.js';

/** TransactionResult (:29-51). The values ARE TEXT.RSC record ids for
 *  everything the bank says out loud - 0282-0299 is one contiguous
 *  block of banking dialogue, which is why the enum is written as
 *  four-digit literals in DFU. NONE and TOO_HEAVY are the two that
 *  are not records: 0 is "nothing to say" and 1 is a sentinel the
 *  window turns into its own line. */
export const TRANSACTION_RESULT = Object.freeze({
  NONE: 0,
  TOO_HEAVY: 1,
  PURCHASED_HOUSE: 282,
  PURCHASED_SHIP: 283,
  ALREADY_OWN_SHIP: 284,
  NOT_PORT_TOWN: 285,
  ALREADY_OWN_HOUSE: 286,
  NO_HOUSES_FOR_SALE: 287,
  ALREADY_DEFAULTED: 288,
  ALREADY_HAVE_LOAN: 289,
  NOT_ENOUGH_ACCOUNT: 290,
  DEPOSIT_LOC: 291,
  NOT_ENOUGH_ACCOUNT_LOC: 292,
  LOC_REQUEST_TOO_SMALL: 293,
  OVERPAID_LOAN: 294,
  LOAN_REQUEST_TOO_HIGH: 295,
  LOAN_REQUEST_TOO_LOW: 296,
  BOUNTY_DEFAULT_LOAN: 297,   // DFU's own note: "not used in game"
  SELL_HOUSE_OFFER: 298,
  SELL_SHIP_OFFER: 299,
  NOT_ENOUGH_GOLD: 454,
});

/** TransactionType (:54-68). */
export const TRANSACTION_TYPE = Object.freeze({
  None: 'None',
  Depositing_gold: 'Depositing_gold',
  Withdrawing_gold: 'Withdrawing_gold',
  Withdrawing_Letter: 'Withdrawing_Letter',
  Depositing_LOC: 'Depositing_LOC',
  Repaying_loan: 'Repaying_loan',
  Borrowing_loan: 'Borrowing_loan',
  Repaying_loan_from_account: 'Repaying_loan_from_account',
  Buy_house: 'Buy_house',
  Sell_house: 'Sell_house',
  Buy_ship: 'Buy_ship',
  Sell_ship: 'Sell_ship',
});

/** ShipType (:70-74). None is -1, so it indexes nothing. */
export const SHIP_TYPES = Object.freeze({ None: -1, Small: 0, Large: 1 });
/** shipPrices (:95) and the model ids that stand them in the world. */
export const SHIP_PRICES = Object.freeze([100000, 200000]);
export const SHIP_MODEL_IDS = Object.freeze([910, 909]);
export const SHIP_COORDS = Object.freeze([{ x: 2, y: 2 }, { x: 5, y: 5 }]);
/** deedSellMult (:93) - a deed sells back for 85% of its price. */
export const DEED_SELL_MULT = 0.85;
/** housePriceMult (:94) - a house costs its MESH RADIUS times this,
 *  which is DFU's whole house valuation: a bigger building is worth
 *  more, measured off the model. */
export const HOUSE_PRICE_MULT = 1280;
/** loanRepayMinutes (:96) - a loan runs for exactly one year. */
export const LOAN_REPAY_MINUTES = DAYS_PER_YEAR * MINUTES_PER_DAY;
/** loanMaxPerLevel (:189). DFU's own comment: "unoffical wiki says max
 *  possible loan is 1,100,000 but testing indicates otherwise - rep.
 *  doesn't seem to effect cap, it's just level * 50k". */
export const LOAN_MAX_PER_LEVEL = 50000;
/** locCommission (:191) - the 1% the bank keeps on a letter. */
export const LOC_COMMISSION = 1.01;
/** The two floors, both `< 100` (:566, :546). */
export const LOC_MINIMUM = 100;
export const LOAN_MINIMUM = 100;
/** LoanChecker's month (:14) and its three reminder marks (:39). */
export const MINUTES_PER_MONTH = MINUTES_PER_DAY * DAYS_PER_MONTH;
export const LOAN_REMINDER_MONTHS = Object.freeze([6, 3, 1]);

export const shipPrice = (ship) => (ship >= 0 ? SHIP_PRICES[ship] : 0);
/** GetShipSellPrice (:120) - a C# (int) cast, so it TRUNCATES. */
export const shipSellPrice = (ship) => Math.trunc(shipPrice(ship) * DEED_SELL_MULT);

/** GetHousePrice (:165-172): the model's radius times 1280, truncated.
 *  `radius` is DFMesh.Radius, which the port's arch3d reader already
 *  divides by POINT_DIVISOR exactly as DFU's does. */
export const housePrice = (meshRadius) => Math.trunc(meshRadius * HOUSE_PRICE_MULT);
export const houseSellPrice = (meshRadius) => Math.trunc(housePrice(meshRadius) * DEED_SELL_MULT);

/** SetupAccounts (:237-246) / SetupHouses (:175-184) - one record per
 *  region, each remembering its own index. */
/** MapFileReader.RegionCount - four BSA records per region, which is
 *  62 in the shipping MAPS.BSA. The accounts array is sized from the
 *  reader where one is in scope and from this where none is; a save
 *  restores its own length either way. */
export const BANK_REGION_COUNT = 62;

export function createBankAccounts(regionCount = BANK_REGION_COUNT) {
  return Array.from({ length: regionCount }, (_, regionIndex) => ({
    regionIndex, accountGold: 0, loanTotal: 0, loanDueDate: 0, hasDefaulted: false,
  }));
}
export function createHouses(regionCount) {
  return Array.from({ length: regionCount }, (_, regionIndex) => ({
    regionIndex, location: '', mapId: 0, buildingKey: 0,
  }));
}

/** ValidateRegion (:559-567). Every reader goes through it; DFU's
 *  getters THROW on a bad index rather than answering zero, which is
 *  what tells a caller with a -1 region (the wilderness) apart from
 *  one whose account is simply empty. */
export const validateRegion = (accounts, regionIndex) =>
  regionIndex >= 0 && regionIndex < accounts.length;

const mustValidate = (accounts, regionIndex) => {
  if (!validateRegion(accounts, regionIndex)) {
    throw new RangeError(`region ${regionIndex} is outside the ${accounts.length} bank accounts`);
  }
};

export function accountTotal(accounts, regionIndex) {
  mustValidate(accounts, regionIndex);
  return accounts[regionIndex].accountGold;
}
export function loanedTotal(accounts, regionIndex) {
  mustValidate(accounts, regionIndex);
  return accounts[regionIndex].loanTotal;
}
export function loanDueDate(accounts, regionIndex) {
  mustValidate(accounts, regionIndex);
  return accounts[regionIndex].loanDueDate;
}
/** HasLoan / HasDefaulted (:213-231) do NOT throw - they answer false
 *  for a bad region, which is why the checker can sweep every index. */
export const hasLoan = (accounts, regionIndex) =>
  validateRegion(accounts, regionIndex) && accounts[regionIndex].loanTotal > 0;
export const hasDefaulted = (accounts, regionIndex) =>
  validateRegion(accounts, regionIndex) && accounts[regionIndex].hasDefaulted;
export function setDefaulted(accounts, regionIndex, defaulted) {
  if (!validateRegion(accounts, regionIndex)) return;
  accounts[regionIndex].hasDefaulted = defaulted;
}

/** CalculateMaxBankLoan (:2006-2015) - level times 50k, and nothing
 *  else. Reputation does not enter it, which DFU's comment says it
 *  tested for. */
export const calculateMaxBankLoan = (level) => level * LOAN_MAX_PER_LEVEL;
/** CalculateBankLoanRepayment (:2017-2024) - `(int)(amount + amount *
 *  .1)`, a FLOAT sum truncated once at the end. */
export const calculateBankLoanRepayment = (amount) => Math.trunc(amount + amount * 0.1);

// ── the transactions ───────────────────────────────────────────────
// Each answers a TRANSACTION_RESULT and mutates the account in place.
// `player` is the host's purse seam: { gold(), deductGold(n),
// addGold(n), wagonGold(), takeWagonGold(n), letters(), takeLetter(),
// addLetter(item), carriedWeightKg(), maxEncumbranceKg() }.

/** DepositGold (:339-360). The WAGON counts toward what can be
 *  deposited, and is drawn on only for the shortfall after the purse
 *  is empty - so depositing everything empties the purse first. */
export function depositGold(accounts, regionIndex, amount, player) {
  mustValidate(accounts, regionIndex);
  const purse = player.gold();
  const wagon = player.wagonGold?.() ?? 0;
  if (amount > purse + wagon) return TRANSACTION_RESULT.NOT_ENOUGH_GOLD;
  accounts[regionIndex].accountGold += amount;
  if (amount > purse && wagon > 0) {
    player.takeWagonGold(amount - purse);
    player.deductGold(purse);
  } else {
    player.deductGold(amount);
  }
  return TRANSACTION_RESULT.NONE;
}

/** WithdrawGold (:362-375). The weight gate is the point: gold is
 *  0.0025 kg a piece, so a large withdrawal is refused outright
 *  rather than partially paid. */
export function withdrawGold(accounts, regionIndex, amount, player) {
  mustValidate(accounts, regionIndex);
  if (amount > accounts[regionIndex].accountGold) return TRANSACTION_RESULT.NOT_ENOUGH_ACCOUNT;
  if (player.carriedWeightKg() + amount * GOLD_PIECE_WEIGHT_KG > player.maxEncumbranceKg()) {
    return TRANSACTION_RESULT.TOO_HEAVY;
  }
  accounts[regionIndex].accountGold -= amount;
  player.addGold(amount);
  return TRANSACTION_RESULT.NONE;
}

/** DepositAll_LOC (:377-389) - EVERY letter in the pack, at face
 *  value, in one go. There is no partial deposit. */
export function depositAllLetters(accounts, regionIndex, player) {
  mustValidate(accounts, regionIndex);
  for (;;) {
    const loc = player.takeLetter();
    if (!loc) return TRANSACTION_RESULT.NONE;
    accounts[regionIndex].accountGold += loc.value ?? 0;
  }
}

/** Withdraw_LOC (:391-404). The commission leaves the ACCOUNT and the
 *  letter is worth the plain amount; and the balance test comes
 *  BEFORE the minimum, so a small request against an empty account
 *  is refused for funds rather than for size. */
export function withdrawLetter(accounts, regionIndex, amount, player) {
  mustValidate(accounts, regionIndex);
  const amountPlusCommission = Math.trunc(amount * LOC_COMMISSION);
  if (amountPlusCommission > accounts[regionIndex].accountGold) {
    return TRANSACTION_RESULT.NOT_ENOUGH_ACCOUNT_LOC;
  }
  if (amount < LOC_MINIMUM) return TRANSACTION_RESULT.LOC_REQUEST_TOO_SMALL;
  accounts[regionIndex].accountGold -= amountPlusCommission;
  player.addLetter(letterOfCredit(amount));
  return TRANSACTION_RESULT.NONE;
}

/** RepayLoan (:508-540). `accountOnly` is the overdue sweep's arm -
 *  it pays from the account alone and never touches the purse.
 *  Answers { result, amount } because DFU passes `amount` by REF and
 *  CLAMPS it to the outstanding loan on an overpayment, which the
 *  caller then sees. */
export function repayLoan(accounts, regionIndex, amount, player, { accountOnly = false } = {}) {
  mustValidate(accounts, regionIndex);
  const account = accounts[regionIndex];
  let available = account.accountGold;
  if (!accountOnly) available += player.gold();

  if (!hasLoan(accounts, regionIndex)) return { result: TRANSACTION_RESULT.NONE, amount };
  if (amount > available) return { result: TRANSACTION_RESULT.NOT_ENOUGH_GOLD, amount };

  let result = TRANSACTION_RESULT.NONE;
  let paid = amount;
  if (paid > account.loanTotal) {
    result = TRANSACTION_RESULT.OVERPAID_LOAN;
    paid = account.loanTotal;
  }
  account.loanTotal -= paid;
  // The PURSE pays first and DeductGoldAmount answers the REMAINDER it
  // could not cover (:534-537); whatever is left comes off the
  // account. So a part-purse part-account payment is one transaction.
  let remainder = paid;
  if (!accountOnly) remainder = player.deductGold(paid);
  if (remainder > 0) account.accountGold -= remainder;
  if (account.loanTotal <= 0) account.loanDueDate = 0;
  return { result, amount: paid };
}

/** BorrowLoan (:542-556). The account is credited with `amount` and
 *  the loan is debited with amount + 10% - the interest exists from
 *  the instant the loan is made, so repaying early saves nothing. */
export function borrowLoan(accounts, regionIndex, amount, { level = 1, nowMinutes = 0 } = {}) {
  mustValidate(accounts, regionIndex);
  if (amount < LOAN_MINIMUM) return TRANSACTION_RESULT.LOAN_REQUEST_TOO_LOW;
  if (amount > calculateMaxBankLoan(level)) return TRANSACTION_RESULT.LOAN_REQUEST_TOO_HIGH;
  const account = accounts[regionIndex];
  account.loanTotal += calculateBankLoanRepayment(amount);
  account.accountGold += amount;
  account.loanDueDate = nowMinutes + LOAN_REPAY_MINUTES;
  return TRANSACTION_RESULT.NONE;
}

/** LoanChecker.CheckOverdueLoans (:18-51) as a decision over every
 *  region. Answers the reminders to show and the regions that went
 *  overdue, so the host does the HUD text and the reputation drop.
 *
 *  The reminder fires on a CROSSING, not on a state: it compares the
 *  months left at the last tick with the months left now, and speaks
 *  only when one of 6/3/1 was passed between them. A poll that read
 *  "months <= 3" would nag every tick for three months. */
export function checkOverdueLoans(accounts, lastGameMinutes, gameMinutes) {
  const reminders = [];
  const overdue = [];
  for (let regionIndex = 0; regionIndex < accounts.length; regionIndex++) {
    const due = accounts[regionIndex].loanDueDate;
    if (!due) continue;
    if (due < gameMinutes) { overdue.push(regionIndex); continue; }
    const lastRemaining = Math.trunc((due - lastGameMinutes) / MINUTES_PER_MONTH);
    const remaining = Math.trunc((due - gameMinutes) / MINUTES_PER_MONTH);
    if (remaining >= lastRemaining) continue;
    if (LOAN_REMINDER_MONTHS.some((m) => lastRemaining >= m && remaining < m)) {
      reminders.push({ regionIndex, owed: accounts[regionIndex].loanTotal, months: remaining + 1 });
    }
  }
  return { reminders, overdue };
}

/** OverdueLoan (:53-72). The account is raided FIRST - as much of the
 *  loan as it can cover - and only a loan still standing after that
 *  is a default. The reputation drop happens ONCE, guarded by the
 *  hasDefaulted flag, and DFU notes that flag "does not seem to ever
 *  be set in classic". Answers what the host must do. */
export function settleOverdueLoan(accounts, regionIndex, player) {
  const transfer = Math.min(loanedTotal(accounts, regionIndex), accountTotal(accounts, regionIndex));
  repayLoan(accounts, regionIndex, transfer, player, { accountOnly: true });
  if (!hasLoan(accounts, regionIndex)) return { kind: 'settled' };
  if (hasDefaulted(accounts, regionIndex)) return { kind: 'alreadyDefaulted' };
  setDefaulted(accounts, regionIndex, true);
  return { kind: 'defaulted', crime: CRIMES.LoanDefault };
}

// ── the window's own decisions (DaggerfallBankingWindow.cs) ────────
// The buttons are not all live all the time, and three of them refuse
// before they open anything. Keeping that here rather than in the
// window is what lets it be pinned without art.

/** UpdateButtons (:252-265). EVERY button is dead while a transaction
 *  input is open - the window takes one amount at a time - and Repay
 *  is additionally dead with no loan to repay. DFU sets depoLOCButton
 *  twice in this block and loanRepayButton is the only one with a
 *  second clause; the duplicate is harmless and kept out of the port
 *  because a repeated assignment is not a behaviour. */
export function bankButtonEnabled(button, { transactionType = TRANSACTION_TYPE.None, accounts = null, regionIndex = 0 } = {}) {
  if (transactionType !== TRANSACTION_TYPE.None) return false;
  if (button === 'loanRepay') return !!accounts && hasLoan(accounts, regionIndex);
  return true;
}

/** ToggleTransactionInput (:268-278). Two guards, and the second is
 *  the interesting one: a request to switch from one LIVE transaction
 *  straight to another is REFUSED, so the player must finish or
 *  cancel before starting a different one. Only a move through None
 *  is allowed. */
export function toggleTransactionInput(current, next) {
  if (current === next) return current;
  if (current !== TRANSACTION_TYPE.None && next !== TRANSACTION_TYPE.None) return current;
  return next;
}

/** HandleTransactionInput (:280-295). int.TryParse, then `< 1` - an
 *  empty, unparsable or zero amount does NOTHING AT ALL, not an error
 *  box. The same silence the tavern's day count answers with. */
export function parseTransactionAmount(text) {
  if (text == null || text === '') return null;
  const n = Number.parseInt(text, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** LoanBorrowButton_OnMouseClick (:398-415). Two refusals BEFORE the
 *  input opens, and their order is DFU's: a defaulted region is told
 *  so even if it also has a loan outstanding. */
export function borrowDecision(accounts, regionIndex) {
  if (hasDefaulted(accounts, regionIndex)) return { kind: 'refuse', result: TRANSACTION_RESULT.ALREADY_DEFAULTED };
  if (hasLoan(accounts, regionIndex)) return { kind: 'refuse', result: TRANSACTION_RESULT.ALREADY_HAVE_LOAN };
  return { kind: 'input', transactionType: TRANSACTION_TYPE.Borrowing_loan };
}

/** BuyHouseButton (:417-436) and BuyShipButton (:453-464). Both refuse
 *  what you already own; the ship additionally refuses OUTSIDE A PORT
 *  TOWN, which is the one place PortTownAndUnknown is read. */
export function buyHouseDecision({ ownsHouse = false, housesForSale = 0 } = {}) {
  if (ownsHouse) return { kind: 'refuse', result: TRANSACTION_RESULT.ALREADY_OWN_HOUSE };
  if (housesForSale < 1) return { kind: 'refuse', result: TRANSACTION_RESULT.NO_HOUSES_FOR_SALE };
  return { kind: 'pick' };
}
export function buyShipDecision({ ownsShip = false, isPortTown = false } = {}) {
  if (ownsShip) return { kind: 'refuse', result: TRANSACTION_RESULT.ALREADY_OWN_SHIP };
  if (!isPortTown) return { kind: 'refuse', result: TRANSACTION_RESULT.NOT_PORT_TOWN };
  return { kind: 'pick' };
}

/** The two SELL buttons (:438-451, :466-472). Owning nothing is a
 *  silent no-op - DFU has no else - and owning something raises the
 *  offer box carrying the sell price. */
export function sellDecision(kind, { owns = false, price = 0 } = {}) {
  if (!owns) return { kind: 'ignore' };
  return {
    kind: 'offer',
    result: kind === 'ship' ? TRANSACTION_RESULT.SELL_SHIP_OFFER : TRANSACTION_RESULT.SELL_HOUSE_OFFER,
    price,
  };
}

// FLAGGED, with the slices they wait on:
//  - PurchaseHouse/SellHouse (:406-462) need the building directory
//    and the permanent-scene set, neither of which the port has; the
//    PRICE law is here and pinned, the allocation is not.
//  - PurchaseShip/SellShip (:464-506) need the two fixed ship scenes
//    at map pixels (2,2) and (5,5), which is a streaming-world seam.
//  - ReadNativeBankData (:580+) reads a classic .SAV BankAccount
//    record; the classic save reader is its own unported system.
