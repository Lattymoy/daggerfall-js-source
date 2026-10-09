// SHIP-CREDIT WITHDRAWN (2026-10-08, Mac: "Remove ship buying loan from the bank"; bible/03-World/Naval-Combat.md
// SHIP-CREDIT). It stood from 2026-10-01: a boat the purse fell short of was offered at a shop's counter on the bank's
// credit, the purse a fifth and the shop region's bank the rest. Withdrawn whole: no counter offers it in either trade
// skin, the host hands the windows no credit hook and its commit pays the whole price from the purse, and the laws that
// priced it (banking.js creditDecision/takeCredit, tradeModes.js's lot and box rows) are gone. A ship bought on credit
// before keeps her claim from the save until her bank is owed nothing (test/fleet.test.js, test/auditholdings.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as banking from '../src/systems/banking.js';
import * as tradeModes from '../src/systems/tradeModes.js';
import * as fleet from '../src/systems/fleet.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const MODES = src('scenes/worldModes.js');
const ENHANCED = src('ui/enhancedTrade.js');

const deed = () => ({ templateIndex: 1321, name: "Deed to Small Ship 'I'", value: 100000, message: 20 });
const hooks = (o = {}) => ({
  mode: 'Buy', shelfItems: () => [], packItems: () => [], accepts: () => true, enchanted: () => false,
  priceCtx: () => ({ quality: 10, skills: {} }), gold: () => 6000, rows: (id) => [{ text: `#${id}`, center: true }],
  weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }), commit: () => {},
  icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() }, ...o,
});

test('SHIP-CREDIT WITHDRAWN the classic trade window: a boat the purse falls short of is refused as any purchase is - the gold\'s own records, no Yes, never the bank asked, whatever hook a host hands it; a purchase the purse pays commits with no proceeds (mutants: the offer back, the credit as proceeds)', () => {
  const asked = [];
  const credit = { kind: 'credit', loan: 19000, pay: 6000, owed: 20900 };
  const w = new NativeTradeWindow(hooks({ credit: (staged, price) => { asked.push([staged.length, price]); return credit; } }));
  w.basket.push(deed());
  w._modeAction();
  assert.equal(asked.length, 0, 'the bank is never asked');
  assert.equal(w.box.buttons, null, 'no Yes: the refusal box');
  assert.ok(w.box.rows.length > 0 && w.box.rows.every((x) => /^#/.test(x.text)), 'the gold\'s own records, nothing of the bank\'s');
  // paid in full: the commit's proceeds are none
  const committed = [];
  const rich = new NativeTradeWindow(hooks({ gold: () => 1e9, credit: () => credit, commit: (...a) => committed.push(a) }));
  rich.basket.push(deed());
  rich._modeAction();
  assert.equal(rich.box.buttons, 'YesNo');
  rich.box.onYes();
  assert.equal(committed.length, 1);
  assert.equal(committed[0][0], 'Buy');
  assert.equal(committed[0][3], null, 'no credit handed to the commit');
});

test('SHIP-CREDIT WITHDRAWN the enhanced trade window and the host: the same refusal, no credit hook read or handed, and the Buy commit pays the whole price from the purse (mutants: the enhanced offer back, the host\'s hook back, the purse\'s share)', () => {
  assert.doesNotMatch(ENHANCED, /deps\.credit|creditRows|creditRefusalRows|confirmTrade\(price, credit\)/, 'the enhanced window knows no bank\'s credit');
  assert.match(ENHANCED, /box = \{ rows: d\.textIds\.flatMap\(\(id\) => rowsFor\(id, price\)\), buttons: null \};/);
  assert.match(ENHANCED, /const proceeds = isSelling \? sellProceeds\(price, deps\.weight\?\.\(\) \?\? \{\}\) : null;/);
  assert.doesNotMatch(MODES, /credit: \(staged/, 'the host hands the trade window no credit hook');
  assert.match(MODES, /if \(mode === 'Buy'\) \{\n\s*deductGold\(playerEntity, price\);\n/);
  assert.doesNotMatch(MODES, /takeCredit|creditDecision|creditShip/);
});

test('SHIP-CREDIT WITHDRAWN its laws are gone - the bank prices no credit purchase, the trade laws stage no boat for one, the Fleet stamps no claim at a purchase - and the bank\'s own loan stands (mutants: none - a law back is an export back)', () => {
  for (const k of ['creditDecision', 'takeCredit', 'CREDIT_DOWN_SHARE']) assert.equal(k in banking, false, `banking.js ${k}`);
  for (const k of ['lotHasBoat', 'lotAllBoats', 'creditRows', 'creditRefusalRows', 'CREDIT_ITEM_TEMPLATES', 'CREDIT_REFUSALS', 'CREDIT_BOAT_ALONE']) {
    assert.equal(k in tradeModes, false, `tradeModes.js ${k}`);
  }
  assert.equal('creditShip' in fleet, false, 'fleet.js creditShip');
  // the bank's window lends as ever (BorrowLoan, :542-556)
  const a = banking.createBankAccounts(62);
  assert.equal(banking.borrowLoan(a, 5, 19000, { level: 3, nowMinutes: 0, online: false }), banking.TRANSACTION_RESULT.NONE);
  assert.equal(a[5].loanTotal, banking.calculateBankLoanRepayment(19000));
  assert.equal(a[5].accountGold, 19000, 'the bank\'s own loan lends into the account');
});
