// LOAN-AMNESTY (2026-09-29, Mac: "Can we reset the loans for everyone online. The bank of the empire has decided to
// forgive everyone's loans"; bible/06-Systems/Online-Arc.md LOAN-AMNESTY): THE EMPIRE FORGIVES EVERY ONLINE LOAN, ONCE.
// The law (systems/banking.js forgiveLoans, loanAmnestyLines, LOAN_AMNESTY), the mark the save carries
// (systems/save/save.js), customs' mark (systems/realmCustoms.js applyCustoms) and the realm boot that applies it
// (scenes/world.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  forgiveLoans, loanAmnestyLines, LOAN_AMNESTY, createBankAccounts, createHouses, empireRefusal, garnishDeposit, TRANSACTION_RESULT,
  SHIP_TYPES,
} from '../../src/systems/banking.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { applyCustoms } from '../../src/systems/realmCustoms.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A save's bank as a realm save holds it: `rows` by region. */
function saveWith(rows, extra = {}) {
  const bankAccounts = createBankAccounts();
  for (const [r, a] of Object.entries(rows)) Object.assign(bankAccounts[r], a);
  return { level: 5, goldPieces: 0, bankAccounts, ...extra };
}

test('LOAN-AMNESTY the law: a save from before the amnesty has every loan struck off - the debt, its due date and the default - the borrowed gold kept, and is marked; told once (mutants: the default kept; the gold taken back; the due date kept; not marked)', () => {
  const snap = saveWith({ 3: { accountGold: 900, loanTotal: 1100, loanDueDate: 525_600 }, 5: { loanTotal: 440, loanDueDate: 100, hasDefaulted: true }, 7: { accountGold: 50 } });
  const r = forgiveLoans(snap);
  assert.deepEqual(r, { forgiven: 1540, defaulted: 1 });
  assert.equal(snap.loanAmnesty, LOAN_AMNESTY, 'marked');
  for (const i of [3, 5]) assert.deepEqual([snap.bankAccounts[i].loanTotal, snap.bankAccounts[i].loanDueDate, snap.bankAccounts[i].hasDefaulted], [0, 0, false], `region ${i} clear`);
  assert.deepEqual([snap.bankAccounts[3].accountGold, snap.bankAccounts[7].accountGold], [900, 50], 'the gold where it was');
  assert.equal(empireRefusal(snap.bankAccounts), null, 'the Empire lends again');
  assert.deepEqual(loanAmnestyLines(r), ['The Bank of the Empire has forgiven your loan of 1,540 gold.', 'Its branches will lend to you again.']);
  // a default whose debt was already drawn down to nothing: the mark alone is forgiven
  const marked = saveWith({ 9: { hasDefaulted: true } });
  assert.deepEqual(forgiveLoans(marked), { forgiven: 0, defaulted: 1 });
  assert.deepEqual(loanAmnestyLines({ forgiven: 0, defaulted: 1 }), ['The Bank of the Empire has forgiven your debt.', 'Its branches will lend to you again.']);
  assert.deepEqual(loanAmnestyLines(null), []);
});

test('LOAN-AMNESTY once: a save that has had it keeps any loan taken since; a save with nothing owed is marked and told nothing; a torn save is no crash (mutants: forgiven every boot; the mark ignored)', () => {
  const snap = saveWith({ 3: { loanTotal: 1100, loanDueDate: 10 } });
  forgiveLoans(snap);
  snap.bankAccounts[4].loanTotal = 2200;   // borrowed after it
  snap.bankAccounts[4].loanDueDate = 900;
  assert.equal(forgiveLoans(snap), null, 'had it');
  assert.equal(snap.bankAccounts[4].loanTotal, 2200, 'a loan taken after the amnesty is owed');
  const clean = saveWith({ 1: { accountGold: 10 } });
  assert.equal(forgiveLoans(clean), null, 'nothing to forgive: nothing said');
  assert.equal(clean.loanAmnesty, LOAN_AMNESTY, 'but marked - a loan it takes next is its own');
  const later = saveWith({ 2: { loanTotal: 500, loanDueDate: 5 } }, { loanAmnesty: LOAN_AMNESTY });
  assert.equal(forgiveLoans(later), null, 'a character made after it');
  assert.equal(later.bankAccounts[2].loanTotal, 500);
  for (const torn of [null, 7, {}, { bankAccounts: 'x' }, { bankAccounts: [null, 3] }]) assert.doesNotThrow(() => forgiveLoans(torn));
});

test('LOAN-AMNESTY the forgiven default is no longer garnished: a deposit goes to the account, not the old debt (mutants: the default kept)', () => {
  const snap = saveWith({ 5: { accountGold: 100, loanTotal: 440, loanDueDate: 100, hasDefaulted: true } });
  assert.equal(empireRefusal(snap.bankAccounts)?.result, TRANSACTION_RESULT.ALREADY_DEFAULTED, 'before: refused for good');
  assert.equal(garnishDeposit(snap.bankAccounts.map((a) => ({ ...a })), 5, 100), 100, 'before: a deposit goes to the default');
  forgiveLoans(snap);
  assert.equal(garnishDeposit(snap.bankAccounts, 5, 100), 0, 'after: nothing taken');
  assert.equal(snap.bankAccounts[5].accountGold, 100, 'the deposit is the account\'s');
});

test('LOAN-AMNESTY the mark rides the save: a save from before it restores unmarked (0), one written after carries the mark, and a character never restored from an older save is born past it (mutants: an old save read as marked; a new character born unmarked)', () => {
  const character = { name: 'Gary', gender: 'male', careerIndex: 4, level: 3, reflexes: 2, health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
    startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
    stats: { strength: 55, luck: 60 }, skills: [30, 28], skillUses: [100, 0], career: { name: 'Healer', hitPointsPerLevel: 8 },
    items: [], spells: [], activeEffects: [], bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: SHIP_TYPES.None };
  const born = JSON.parse(JSON.stringify(snapshotPlayer(character, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  assert.equal(born.loanAmnesty, LOAN_AMNESTY, 'a new character is past it');
  const old = JSON.parse(JSON.stringify(born));
  delete old.loanAmnesty;
  const loaded = { ...character };
  restorePlayer(loaded, old, new Map());
  assert.equal(loaded.loanAmnesty, 0, 'a save from before it has had none');
  const again = JSON.parse(JSON.stringify(snapshotPlayer(loaded, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  assert.equal(again.loanAmnesty, 0, 'and still has had none when it is saved again offline');
  forgiveLoans(again);
  const after = { ...character };
  restorePlayer(after, again, new Map());
  assert.equal(after.loanAmnesty, LOAN_AMNESTY);
});

test('LOAN-AMNESTY customs: a character crossing online is marked as it crosses - its offline loans are called in, never forgiven (mutants: customs unmarked)', () => {
  const copy = saveWith({ 3: { loanTotal: 5_000, loanDueDate: 999_999 } }, { classicMinutes: 100, level: 3, goldPieces: 0 });
  applyCustoms(copy);
  assert.equal(copy.loanAmnesty, LOAN_AMNESTY);
  assert.equal(forgiveLoans(copy), null, 'nothing forgiven at its first boot');
  assert.equal(copy.bankAccounts[3].loanTotal, 5_000, 'the loan customs called in stands, unpaid and due');
  assert.equal(copy.bankAccounts[3].loanDueDate, 100);
});

test('LOAN-AMNESTY the boot: an online character\'s save is forgiven in the one parse, before it is restored and before the Empire\'s join; the words said once the world stands; an offline save is never touched (mutants: applied offline; after the restore; never said)', () => {
  const w = src('src/scenes/world.js');
  const at = w.indexOf('\n  const loansForgiven = realmBoot ? forgiveLoans(bootSnapRead) : null;');
  assert.ok(at > w.indexOf('if (realmBoot) { bootSnapRead = realmBoot.snap; realmBoot.snap = null; }'), 'on the realm\'s one parse, once it is held');
  assert.ok(at > w.indexOf("if (testRoomOffline && realmSession) {"), 'a test room character is never the realm\'s');
  assert.ok(at > 0 && at < w.indexOf('empireJoin('), 'before the join settles a loan');
  assert.ok(at < w.indexOf('await worldQuickLoad({ ...bootLoadPick, snap });'), 'before the save is restored');
  assert.match(w, /for \(const line of reclaimLines\(realmGiven\)\) townTalk\.say\(line\);[^\n]*\n\s*for \(const line of loanAmnestyLines\(loansForgiven\)\) townTalk\.say\(line\);/);
});
