// EMPIRE-BANK (2026-09-27, Discord: "For online mode, the bank of daggerfall becomes the bank of the empire. The empire
// has come and has reduced loans substantially (90%)").
//
// ONLINE, EVERY BANK IS THE EMPIRE'S: "The Bank of the Empire" whatever region it stands in (world/buildingNames.js),
// the Enhanced Plus teller's title with it, and a bank discovered before shows its name now on its door and its plate
// (systems/discovery.js shownBuildingName) - the save keeps the other side's. AND THE EMPIRE LENDS A TENTH of whatever
// the cap is - DFU's level x 50,000, or Roleplay & Realism's per-level choice (systems/banking.js calculateMaxBankLoan).
// Offline, all of it is Daggerfall's as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateBuildingName, BUILDING_TYPES, EMPIRE_BANK_OF } from '../src/world/buildingNames.js';
import {
  calculateMaxBankLoan, registerMaxBankLoan, borrowLoan, createBankAccounts, TRANSACTION_RESULT, EMPIRE_LOAN_DIVISOR, LOAN_MAX_PER_LEVEL,
} from '../src/systems/banking.js';
import { shownBuildingName } from '../src/systems/discovery.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** The page as the lane reads it: `?online` on the URL (systems/onlineLane.js isOnlinePage). */
function online(fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { search: '?online=1' };
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
}

test('EMPIRE-BANK the name: online every bank is "The Bank of the Empire", in any region; offline it is the region\'s (mutants: the region online; the Empire offline)', () => {
  assert.equal(generateBuildingName(7, BUILDING_TYPES.Bank, { regionName: 'Daggerfall' }), 'The Bank of Daggerfall');
  assert.equal(EMPIRE_BANK_OF, 'the Empire');
  online(() => {
    assert.equal(generateBuildingName(7, BUILDING_TYPES.Bank, { regionName: 'Daggerfall' }), 'The Bank of the Empire');
    assert.equal(generateBuildingName(99, BUILDING_TYPES.Bank, { regionName: 'Sentinel' }), 'The Bank of the Empire');
    assert.notEqual(generateBuildingName(7, BUILDING_TYPES.Tavern, { regionName: 'Daggerfall' }), 'The Bank of the Empire', 'a tavern is its own');
  });
});

test('EMPIRE-BANK a bank discovered before shows its name now; a quest\'s rename and every other building keep the stored one (mutants: the stored name always; a live name for any building)', () => {
  const bank = { buildingType: BUILDING_TYPES.Bank, displayName: 'The Bank of Daggerfall', isOverrideName: false };
  assert.equal(shownBuildingName(bank, 'The Bank of the Empire'), 'The Bank of the Empire');
  assert.equal(shownBuildingName(bank, null), 'The Bank of Daggerfall', 'no live name: the stored one');
  assert.equal(shownBuildingName({ ...bank, isOverrideName: true, displayName: 'The Hideout' }, 'The Bank of the Empire'), 'The Hideout');
  assert.equal(shownBuildingName({ buildingType: BUILDING_TYPES.Tavern, displayName: 'The Rusty Tankard', isOverrideName: false }, 'Something Else'), 'The Rusty Tankard');
  assert.match(src('src/ui/exteriorAutomapWindow.js'), /name = shownBuildingName\(rec, byKey\.get\(b\.buildingKey\)\?\.name\) \|\|/);
  assert.match(src('src/scenes/worldModes.js'), /displayName: home \? homeDoorTitle\(home\) : shownBuildingName\(db, bd\.name\),/);
});

test('EMPIRE-BANK the loans: online the cap is a tenth - DFU\'s law and Roleplay & Realism\'s alike - and a loan past it is refused; offline the cap is whole (mutants: the tenth offline; the override skipped online; the divisor)', () => {
  assert.equal(EMPIRE_LOAN_DIVISOR, 10);
  assert.equal(calculateMaxBankLoan(5), 5 * LOAN_MAX_PER_LEVEL, 'offline: level x 50,000');
  online(() => {
    assert.equal(calculateMaxBankLoan(5), 25_000, 'online: a tenth of 250,000');
    assert.equal(calculateMaxBankLoan(1), 5_000);
    registerMaxBankLoan((level) => level * 10_000);   // R&R's default per-level choice
    try {
      assert.equal(calculateMaxBankLoan(7), 7_000, 'a tenth of R&R\'s 70,000');
      assert.equal(calculateMaxBankLoan(3), 3_000);
    } finally { registerMaxBankLoan(null); }
    const accounts = createBankAccounts();
    assert.equal(borrowLoan(accounts, 17, 5_001, { level: 1, nowMinutes: 0 }), TRANSACTION_RESULT.LOAN_REQUEST_TOO_HIGH);
    assert.equal(borrowLoan(accounts, 17, 5_000, { level: 1, nowMinutes: 0 }), TRANSACTION_RESULT.NONE);
  });
});

test('EMPIRE-BANK the teller: online the Enhanced Plus bank is the Empire\'s, its town beneath (sweep)', () => {
  const P = src('src/ui/enhancedPorts.js');
  assert.match(P, /title: empire \? `Bank of \$\{EMPIRE_BANK_OF\}` : city \? `Bank of \$\{city\}` : 'The Bank'/);
  assert.match(P, /const empire = isOnlinePage\(\);/);
});
