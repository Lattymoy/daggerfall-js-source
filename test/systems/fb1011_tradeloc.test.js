// TRADE-LOC II (FIELD BUGS 2026-10-11d #2, the Discord's "letter of credit during trade": "Cant see how much a letter of
// credit is worth when trading directly with players", a screenshot of two Letters of Credit in the pack's list, each
// "0.10kg"). TRADE-LOC (2026-10-10) said a letter's worth in the trade window's detail strip and in the row's hover -
// one a click away, the other a pointer's alone: a phone has no hover, and two letters in a list could not be told
// apart without clicking each. The row says it now, under the letter's name, on either side of the trade; and the
// pack's own card (every pack, shop and trade hover's) says it as its Worth. bible/01-Overview/bugs/Field-Bugs-2026-10-11d.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { letterWorthGold, letterWorthLine } from '../../src/systems/walletItem.js';
import { letterOfCredit } from '../../src/systems/inventory.js';
import { validLootList } from '../../src/systems/loot/loot.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('TRADE-LOC II: a letter\'s worth as gold - the letter the bank mints, and the one a peer\'s offer carries over the wire; anything else none, and the line TRADE-LOC said is the same words (mutants: the worth read off the template; anything a letter)', () => {
  assert.equal(letterWorthGold(letterOfCredit(12500)), '12,500 gold');
  assert.equal(letterWorthGold(letterOfCredit(0)), '0 gold');
  assert.equal(letterWorthGold(letterOfCredit(99.9)), '99 gold', 'a whole coin, as the bank counts it');
  const [arrived] = validLootList([JSON.parse(JSON.stringify(letterOfCredit(4321)))]);
  assert.equal(letterWorthGold(arrived), '4,321 gold', 'through the wire clamp');
  assert.equal(letterWorthGold({ templateIndex: 113, value: 900 }), null, 'a sword is not a letter');
  assert.equal(letterWorthGold(null), null);
  assert.equal(letterWorthLine(letterOfCredit(12500)), 'Worth 12,500 gold');
  assert.equal(letterWorthLine({ templateIndex: 113, value: 900 }), null);
});

test('TRADE-LOC II: the trade window\'s row says a letter\'s worth under its name - mine and theirs, no hover or click asked - and the pack\'s card says it as its Worth (mutants: the row without it; the card without it)', () => {
  const t = src('src/ui/enhanced/enhancedPlayerTrade.js');
  // the one row builder both lists and both offers draw through (`row(item, side, count)`)
  // PIN MOVED (FIELD BUGS 2026-10-25i QUEST-MARK, AUDIT FB1025i B6): the row's words end with a quest item's own
  assert.match(t, /const row = \(item, side, count = null\) => \{[\s\S]{0,700}const sub = \[letterWorthLine\(item\), line\.material, line\.word, line\.quest != null \? questWord\(\) : null\]\.filter\(Boolean\)\.join\(' · '\);[^\n]*\n\s+if \(sub\) mid\.append\(el\('small', null, sub\)\);/);
  // PIN MOVED (TRADE-VIRT): each list drawn through its window (`fill`, ui/virtualRows.js), the one row its build
  // PIN MOVED (AUDIT TRADE-VIRT, 2026-10-20): each named - its rows' heights kept by name across repaints
  for (const call of ["fill(list, items, (it) => row(it, 'pack'), 'pack');", "fill(list, entries(), (e) => row(e.item, 'offer', e.count), 'offer');", "fill(list, session.theirs.items, (it) => row(it, 'theirs'), 'theirs');"]) assert.ok(t.includes(call), `${call} - the pack, my offer and theirs draw through the one row`);
  const inv = src('src/ui/enhanced/enhancedInventory.js');
  assert.match(inv, /  pair\('Armour', line\.armour\);\n  pair\('Worth', letterWorthGold\(picked\)\);/, 'the card\'s headline pair - a letter is its worth');
});
