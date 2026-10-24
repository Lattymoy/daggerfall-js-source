// EMPIRE-ACCOUNT (2026-10-01, the field - maya: "i deposited alot of letters of credit in a random bank somewhere but
// theyre gone in the daggerfall bank"; Mac chose "2": online, every region one Empire-wide account). Online every branch
// keeps one account, the Empire's, at Daggerfall's index; a loan still stands where it was taken; an online character's
// older branches fold into it as it boots; the service pays a realm record from the same account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRANSACTION_RESULT as R, createBankAccounts, EMPIRE_ACCOUNT_REGION, goldRegion, foldEmpireAccounts, empireAccountLines,
  depositGold, withdrawGold, depositAllLetters, withdrawLetter, repayLoan, borrowLoan, settleOverdueLoan, callInEmpireDebt,
  purchaseShip, sellShip, purchaseHouse, sellHouse, creditMarksSale, accountTotal, SHIP_TYPES, shipPrice, shipSellPrice,
  housePrice, createHouses, drawEmpireAccounts, bankedGold, empireDrawLines,
} from '../../src/systems/banking.js';
import { REALM_EMPIRE_ACCOUNT, payFromSave, payableOf, creditSave, accountOfSave } from '../../src/net/realm/realmGoldLaw.js';
import { REGION_NAMES } from '../../src/formats/mapsFile.js';
import { deductGold, goldAmount } from '../../src/systems/court.js';
import { letterOfCredit, LETTER_OF_CREDIT_TEMPLATE } from '../../src/systems/inventory.js';
import { BankWindow } from '../../src/ui/bankWindow.js';
import { empireJoin, runDayChange, DAY_ARMS } from '../../src/systems/worldTick.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const E = EMPIRE_ACCOUNT_REGION;
/** Runs `fn` as if the page were `search`, then restores the page. */
function onPage(search, fn) {
  const was = globalThis.location;
  globalThis.location = { search };
  try { return fn(); } finally { globalThis.location = was; }
}
function bank(by) {
  const accounts = createBankAccounts();
  for (const [r, v] of Object.entries(by)) Object.assign(accounts[r], v);
  return accounts;
}
/** A purse over an entity, as worldModes.js bankPurse hands the bank one. */
function purseOf(entity) {
  return {
    gold: () => entity.goldPieces,
    totalGold: () => goldAmount(entity),
    deductGold: (n) => deductGold(entity, n),
    addGold: (n) => { entity.goldPieces += n; },
    wagonGold: () => 0,
    takeLetter: () => { const i = entity.items.findIndex((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE); return i < 0 ? null : entity.items.splice(i, 1)[0]; },
    addLetter: (it) => entity.items.push(it),
    carriedWeightKg: () => 0,
    maxEncumbranceKg: () => 1e9,
  };
}

test('EMPIRE-ACCOUNT: the Empire\'s account is Daggerfall\'s, at both ends - and online every branch\'s gold is its, offline each region\'s own', () => {
  assert.equal(REGION_NAMES[E], 'Daggerfall');
  assert.equal(REALM_EMPIRE_ACCOUNT, E, 'the service\'s law names the same account (it does not bundle banking.js)');
  const accounts = createBankAccounts();
  for (const r of [0, 5, 17, 61]) {
    assert.equal(goldRegion(accounts, r, true), E, `online, region ${r} banks with the Empire`);
    assert.equal(goldRegion(accounts, r, false), r, `offline, region ${r} banks with itself`);
  }
  assert.equal(goldRegion(createBankAccounts(5), 3, true), 3, 'a short table with no Empire account keeps its own');
  onPage('?online=1', () => assert.equal(goldRegion(accounts, 5), E, 'the page says online'));
  onPage('', () => assert.equal(goldRegion(accounts, 5), 5, 'the page says offline'));
});

test('EMPIRE-ACCOUNT: maya\'s letters - deposited at one branch online, they are there at Daggerfall\'s and at any other; offline they stay where they were paid in', () => {
  const entity = { goldPieces: 0, items: [letterOfCredit(30_000), letterOfCredit(20_000)] };
  const on = createBankAccounts();
  assert.equal(depositAllLetters(on, 5, purseOf(entity), { online: true }), R.NONE);
  assert.equal(on[5].accountGold, 0, 'nothing waits at the branch it was paid in');
  assert.equal(accountTotal(on, goldRegion(on, E, true)), 50_000, 'the capital shows it');
  assert.equal(accountTotal(on, goldRegion(on, 40, true)), 50_000, 'and any branch');
  assert.equal(withdrawGold(on, 40, 1_000, purseOf(entity), { online: true }), R.NONE, 'drawn far from where it was paid in');
  assert.equal(withdrawLetter(on, 22, 10_000, purseOf(entity), { online: true }), R.NONE);
  assert.equal(on[E].accountGold, 50_000 - 1_000 - 10_100, 'the coins, then the letter and its commission');
  assert.equal(depositGold(on, 33, 1_000, purseOf(entity), { online: true }), R.NONE);
  assert.equal(on[E].accountGold, 39_900);
  assert.equal(on[33].accountGold, 0);

  // a default's garnish takes from the account the deposit went into - the Empire's - whatever branch took it
  const owing = bank({ 3: { loanTotal: 5_000, hasDefaulted: true } });
  depositGold(owing, 33, 2_000, purseOf({ goldPieces: 2_000, items: [] }), { online: true });
  assert.deepEqual([owing[E].accountGold, owing[33].accountGold, owing[3].loanTotal], [0, 0, 3_000], 'garnished from the Empire\'s account');

  const back = { goldPieces: 0, items: [letterOfCredit(30_000)] };
  const off = createBankAccounts();
  depositAllLetters(off, 5, purseOf(back), { online: false });
  assert.deepEqual([off[5].accountGold, off[E].accountGold], [30_000, 0], 'offline, Daggerfall\'s sixty-two accounts stand');
  assert.equal(withdrawGold(off, 40, 1, purseOf(back), { online: false }), R.NOT_ENOUGH_ACCOUNT);
});

test('EMPIRE-ACCOUNT: the bank window online shows the Empire\'s account at every branch, and the loan of the branch it stands at', () => {
  const accounts = bank({ [E]: { accountGold: 12_345 }, 5: { loanTotal: 1_100, loanDueDate: 9_000 } });
  const at = (region, search) => onPage(search, () => new BankWindow({
    accounts: () => accounts, regionIndex: () => region, level: () => 5, now: () => 0,
    player: purseOf({ goldPieces: 7, items: [] }), rows: () => [],
  }).labels());
  assert.equal(at(40, '?online=1').account, '12345');
  assert.equal(at(5, '?online=1').account, '12345');
  assert.equal(at(5, '?online=1').loanDue, '1100', 'the loan is its own branch\'s');
  assert.equal(at(40, '?online=1').loanDue, '0');
  assert.equal(at(40, '').account, '0', 'offline, the branch\'s own');
});

test('EMPIRE-ACCOUNT: a loan stands where it was taken - its due date and default are that region\'s - and the Empire\'s account lends it and repays it', () => {
  const entity = { goldPieces: 0, items: [] };
  const accounts = createBankAccounts();
  assert.equal(borrowLoan(accounts, 5, 10_000, { level: 5, nowMinutes: 100, online: true }), R.NONE);
  assert.deepEqual([accounts[5].loanTotal, accounts[5].accountGold, accounts[E].accountGold], [11_000, 0, 10_000]);
  assert.ok(accounts[5].loanDueDate > 100);
  const paid = repayLoan(accounts, 5, 4_000, purseOf(entity), { online: true });
  assert.deepEqual([paid.result, accounts[5].loanTotal, accounts[E].accountGold], [R.NONE, 7_000, 6_000], 'the purse was empty: the Empire\'s account paid');
  // overdue: the Empire's account pays first, then every other branch (the loan's own among them), and only what is still
  // owed is a default - of the loan's own region
  const late = bank({ 5: { loanTotal: 10_000, loanDueDate: 1, accountGold: 1_000 }, [E]: { accountGold: 2_000 }, 9: { accountGold: 3_000 } });
  const out = settleOverdueLoan(late, 5, purseOf(entity), { online: true });
  assert.deepEqual(out, { kind: 'defaulted', crime: out.crime });
  assert.deepEqual([late[E].accountGold, late[5].accountGold, late[9].accountGold, late[5].loanTotal, late[5].hasDefaulted], [0, 0, 0, 4_000, true]);
  assert.equal(late[E].hasDefaulted, false, 'the default is the loan\'s region\'s, not Daggerfall\'s');
  // the draw skips only the account already paid from
  const draw = bank({ 5: { loanTotal: 500, accountGold: 200 }, 9: { accountGold: 300 } });
  assert.equal(drawEmpireAccounts(draw, 5, 500, { online: true }), 500, 'online the loan\'s own branch is one of the others');
  assert.equal(drawEmpireAccounts(bank({ 5: { loanTotal: 500, accountGold: 200 }, 9: { accountGold: 300 } }), 5, 500, { online: false }), 300, 'offline its own paid first, by the caller');
});

test('EMPIRE-ACCOUNT: the Empire\'s call at the join pays from the Empire\'s account first - and the join itself, online', () => {
  const accounts = bank({ 7: { loanTotal: 110_000, loanDueDate: 500_000 }, [E]: { accountGold: 60_000 } });
  const call = callInEmpireDebt(accounts, { deductGold: () => 0 }, { cap: 50_000, nowMinutes: 1, online: true });
  assert.deepEqual([call.paid, call.owed, accounts[E].accountGold, accounts[7].loanTotal], [55_000, 0, 5_000, 55_000]);
  onPage('?online=1', () => {
    const entity = { level: 10, goldPieces: 0, items: [], bankAccounts: bank({ 7: { loanTotal: 110_000, loanDueDate: 1_000_000 }, [E]: { accountGold: 60_000 } }) };
    const joined = empireJoin({ entity, nowMinutes: 900_000 });
    assert.deepEqual([joined.owed, entity.bankAccounts[E].accountGold, entity.bankAccounts[7].hasDefaulted], [0, 5_000, false]);
  });
});

test('EMPIRE-ACCOUNT: a ship, a house and the Marks pay from and into the Empire\'s account online; offline the region\'s', () => {
  const rich = { goldPieces: 0, items: [] };
  const on = bank({ [E]: { accountGold: shipPrice(SHIP_TYPES.Small) } });
  const ship = {};
  assert.equal(purchaseShip(on, 40, SHIP_TYPES.Small, ship, purseOf(rich), { online: true }).kind, 'purchased');
  assert.equal(on[E].accountGold, 0);
  assert.equal(sellShip(on, 40, ship, { online: true }).kind, 'sold');
  assert.deepEqual([on[E].accountGold, on[40].accountGold], [shipSellPrice(SHIP_TYPES.Small), 0]);
  const off = bank({ [E]: { accountGold: shipPrice(SHIP_TYPES.Small) } });
  assert.equal(purchaseShip(off, 40, SHIP_TYPES.Small, {}, purseOf(rich), { online: false }).kind, 'refuse', 'offline, another region\'s gold is not this bank\'s');

  const price = housePrice(10);
  const houses = createHouses(62);
  const homeBank = bank({ [E]: { accountGold: price } });
  assert.equal(purchaseHouse(homeBank, houses, 40, { buildingKey: 9 }, purseOf(rich), { meshRadius: 10, online: true }).result, R.PURCHASED_HOUSE);
  assert.deepEqual([homeBank[E].accountGold, houses[40].buildingKey], [0, 9], 'the house is the region\'s, the gold the Empire\'s');
  assert.equal(sellHouse(homeBank, houses, 40, { meshRadius: 10, online: true }).kind, 'sold');
  assert.ok(homeBank[E].accountGold > 0 && homeBank[40].accountGold === 0);

  const marks = createBankAccounts();
  assert.equal(creditMarksSale(marks, 40, 700, { online: true }), 700);
  assert.deepEqual([marks[E].accountGold, marks[40].accountGold], [700, 0]);
  assert.equal(creditMarksSale(createBankAccounts(), 40, 700, { online: false }), 700);
});

test('EMPIRE-ACCOUNT: the fold - every other branch\'s gold into the Empire\'s, the total kept, every loan where it stands; once', () => {
  const snap = { bankAccounts: bank({ 5: { accountGold: 50_000 }, [E]: { accountGold: 1_000 }, 30: { accountGold: 250, loanTotal: 1_100, loanDueDate: 9 }, 41: { accountGold: -50 }, 60: { hasDefaulted: true } }) };
  const total = snap.bankAccounts.reduce((s, a) => s + a.accountGold, 0);
  assert.deepEqual(foldEmpireAccounts(snap), { gold: 50_200, branches: 3 });
  assert.equal(snap.bankAccounts[E].accountGold, total);
  assert.equal(snap.bankAccounts.reduce((s, a) => s + a.accountGold, 0), total, 'no gold made or lost');
  for (const r of [5, 30, 41]) assert.equal(snap.bankAccounts[r].accountGold, 0);
  assert.deepEqual([snap.bankAccounts[30].loanTotal, snap.bankAccounts[30].loanDueDate, snap.bankAccounts[60].hasDefaulted], [1_100, 9, true], 'loans and defaults stand');
  assert.equal(foldEmpireAccounts(snap), null, 'folded, nothing moves again');
  assert.equal(foldEmpireAccounts({ bankAccounts: createBankAccounts(5) }), null, 'a short table has no Empire account to fold into');
  assert.equal(foldEmpireAccounts({}), null);
  assert.equal(foldEmpireAccounts(null), null);
  assert.deepEqual(empireAccountLines({ gold: 50_200, branches: 3 }), ['The Bank of the Empire keeps one account now,', 'open at every branch. 50,200 gold came in from other regions.']);
  assert.deepEqual(empireAccountLines(null), []);
  assert.deepEqual(empireAccountLines({ gold: -5, branches: 1 }), [], 'a branch in the red folds in silently');
});

test('EMPIRE-ACCOUNT, the service: a realm record pays from the Empire\'s account whatever region the wallet names, then any branch not yet folded; credits land in it', () => {
  const save = () => ({ goldPieces: 100, items: [], bankAccounts: bank({ [E]: { accountGold: 1_000 }, 5: { accountGold: 500 } }) });
  const s = save();
  assert.equal(payableOf(s, 40), 1_600, 'the purse, the Empire\'s account and the branch not yet folded');
  assert.equal(payableOf(s, null), 100, 'no region named, the purse alone');
  assert.equal(accountOfSave(s, 40), s.bankAccounts[E]);
  assert.equal(payFromSave(s, 1_300, 40), true);
  assert.deepEqual([s.goldPieces, s.bankAccounts[E].accountGold, s.bankAccounts[5].accountGold], [0, 0, 300], 'the purse, the Empire\'s, then the branch');
  assert.equal(payFromSave(s, 301, 40), false, 'what it cannot pay changes nothing');
  assert.equal(s.bankAccounts[5].accountGold, 300);
  const c = save();
  assert.equal(creditSave(c, 900, { bank: 40 }), true);
  assert.deepEqual([c.bankAccounts[E].accountGold, c.bankAccounts[40].accountGold], [1_900, 0], 'a home sold, rent collected, a Mark\'s gold: into the Empire\'s account');

  // a folded record and the client's wallet (scenes/world.js: deductGold, then the Empire's account) agree
  const record = save(), live = save();
  foldEmpireAccounts(record);
  foldEmpireAccounts(live);
  assert.equal(payFromSave(record, 1_200, 5), true);
  const short = deductGold(live, 1_200);
  live.bankAccounts[goldRegion(live.bankAccounts, 5, true)].accountGold -= short;
  assert.deepEqual(record, live);
});

test('EMPIRE-ACCOUNT by source: the boot folds beside the amnesty, says so once the world stands, and every online wallet and the purchase window read the Empire\'s account', () => {
  const w = hostText('src/scenes/world.js');
  const fold = w.indexOf('const empireFolded = realmBoot ? foldEmpireAccounts(bootSnapRead) : null;');
  assert.ok(fold > 0);
  assert.ok(fold > w.indexOf('const loansForgiven = realmBoot ? forgiveLoans(bootSnapRead) : null;'), 'after the amnesty');
  assert.ok(fold < w.indexOf('empireJoin({ entity: playerEntity'), 'before the join settles a loan');
  assert.match(w, /for \(const line of empireAccountLines\(empireFolded\)\) townTalk\.say\(line\);/);
  assert.match(w, /const account = playerEntity\.bankAccounts\[goldRegion\(playerEntity\.bankAccounts, region\)\] \?\? null;/, 'the market\'s wallet');
  // PIN MOVED (INSTANCES' HOST-SPLIT, 2026-10-15): the yard's wallet left bootWorld whole for scenes/homeYards.js, which reads
  // only the player handed it; bootWorld hands it the player
  assert.match(src('src/scenes/homeYards.js'), /const a = entity\.bankAccounts\[goldRegion\(entity\.bankAccounts, region\)\] \?\? null;/, 'the yard\'s wallet');
  assert.doesNotMatch(src('src/scenes/homeYards.js'), /bankAccounts\[region\] \?\? null/, 'the yard\'s wallet reads no branch\'s own account');
  assert.match(w, /wallet: \(region\) => homeYardWallet\(playerEntity, region\),/, '...handed the player');
  assert.match(w, /const account = playerEntity\.bankAccounts\[goldRegion\(playerEntity\.bankAccounts, _questRegionIndex\(\) \?\? 0\)\] \?\? null;/, 'the guild\'s wallet');
  assert.doesNotMatch(w, /bankAccounts\[region\] \?\? null/, 'no wallet reads a branch\'s own account');
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /return playerEntity\.bankAccounts\[goldRegion\(playerEntity\.bankAccounts, region\)\] \?\? null;/, 'a home\'s wallet');
  assert.match(m, /accountGold: playerEntity\.bankAccounts\?\.\[goldRegion\(playerEntity\.bankAccounts, interiorOverlay\.region\)\]\?\.accountGold \?\? 0,/, 'the purchase window');
});

test('EMPIRE-ACCOUNT: an overdue loan\'s draw is said online - at the join and on the day\'s sweep - where it took the gold without a word; offline it stays silent', () => {
  assert.deepEqual(empireDrawLines(3_000, 'Wayrest'), ['The Empire takes', '3000 gold from your account for your loan in Wayrest.']);
  assert.deepEqual(empireDrawLines(0, 'Wayrest'), []);
  assert.equal(bankedGold(bank({ [E]: { accountGold: 5 }, 3: { accountGold: 7 } })), 12);
  const due = () => ({ level: 10, goldPieces: 0, items: [], bankAccounts: bank({ 5: { loanTotal: 10_000, loanDueDate: 10 }, [E]: { accountGold: 3_000 } }) });
  const heard = (search, run) => onPage(search, () => { const said = []; const entity = due(); run(entity, (l) => said.push(l)); return { said, entity }; });
  const joined = heard('?online=1', (entity, say) => empireJoin({ entity, nowMinutes: 1_000, say }));
  assert.deepEqual(joined.said, ['The Empire takes', `3000 gold from your account for your loan in ${REGION_NAMES[5]}.`]);
  assert.deepEqual([joined.entity.bankAccounts[E].accountGold, joined.entity.bankAccounts[5].loanTotal, joined.entity.bankAccounts[5].hasDefaulted], [0, 7_000, true]);
  const swept = heard('?online=1', (entity, say) => runDayChange({ entity, lastMinutes: 0, nowMinutes: 1_440 * 2, rolls: () => 0.99, say, arms: DAY_ARMS.own }));
  assert.ok(swept.said.includes(`3000 gold from your account for your loan in ${REGION_NAMES[5]}.`), JSON.stringify(swept.said));
  const again = onPage('?online=1', () => { const said = []; runDayChange({ entity: swept.entity, lastMinutes: 1_440 * 2, nowMinutes: 1_440 * 3, rolls: () => 0.99, say: (l) => said.push(l), arms: DAY_ARMS.own }); return said; });
  assert.ok(!again.some((l) => l.startsWith('The Empire takes')), 'an account already empty: nothing taken, nothing said');
  const quiet = heard('', (entity, say) => { entity.bankAccounts[5].accountGold = 2_000; runDayChange({ entity, lastMinutes: 0, nowMinutes: 1_440 * 2, rolls: () => 0.99, say, arms: DAY_ARMS.own }); });
  assert.ok(!quiet.said.some((l) => l.startsWith('The Empire takes')), 'offline, Daggerfall\'s silent sweep');
  assert.deepEqual([quiet.entity.bankAccounts[5].loanTotal, quiet.entity.bankAccounts[5].accountGold, quiet.entity.bankAccounts[E].accountGold], [8_000, 0, 3_000], 'offline only the loan\'s own account paid');
});
