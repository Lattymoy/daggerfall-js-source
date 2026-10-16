// DRAKES (2026-09-29, Mac: "Can we change the name of marks to something else"; asked what to, "Drakes"; bible/06-Systems/
// Online-Arc.md DRAKES): THE SERVER'S CURRENCY IS CALLED DRAKES WHEREVER A PLAYER READS IT. Only the words changed: the
// balances, the ledger, the routes, the switch (MARKS_OPEN) and the code's own name for them (marks, MARKS1) stand, so
// no account's balance moved and no stored row was touched. SILVER (2026-10-02, test/net/silver.test.js) named it again:
// the words read "silver" now, and these pins read them - the Marks never come back either way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { marksText } from '../../src/net/marksLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A source with its comments blanked - what is left is code and the words it shows. */
function code(text) {
  const out = text.split('');
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (text.startsWith('/*', i)) { const j = text.indexOf('*/', i + 2); const end = j < 0 ? text.length : j + 2; for (let k = i; k < end; k++) if (out[k] !== '\n') out[k] = ' '; i = end - 1; continue; }
    if (text.startsWith('//', i)) { const j = text.indexOf('\n', i); const end = j < 0 ? text.length : j; for (let k = i; k < end; k++) out[k] = ' '; i = end - 1; }
  }
  return out.join('');
}

/** Every file that shows the currency to a player. */
const SHOWN = [
  'src/net/marksLaw.js', 'src/net/marksBook.js', 'src/net/accountClient.js', 'src/scenes/world.js', 'src/ui/bankWindow.js',
  'src/ui/enhanced/enhancedAccount.js', 'src/ui/enhanced/enhancedPorts.js', 'src/ui/marketTab.js', 'src/ui/workTab.js', 'src/ui/noticeWindow.js',
  'src/ui/professions/profPages.js', 'src/ui/socialPanel.js',
];

test('DRAKES a balance never reads in Marks - silver now, one and many (SILVER; mutants: the old name back)', () => {
  assert.equal(marksText(1), '1 silver');
  assert.equal(marksText(1240), '1,240 silver');
  assert.equal(marksText(0), '0 silver');
  assert.equal(accountRefusalText('marks-short'), 'You do not hold that much silver.');
  assert.equal(accountRefusalText('guild-marks-short'), 'The treasury does not hold that much silver.');
});

test('DRAKES no word a player reads says Marks any more - the account card, the Bank, the market, the Work tab, the guild treasury, the professions\' pages, the refusals (mutants: a label or a line left on the old name)', () => {
  for (const f of SHOWN) {
    const left = code(src(f)).split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\bMarks?\b/.test(l));
    assert.deepEqual(left.map(([n, l]) => `${f}:${n}: ${l.trim().slice(0, 90)}`), [], `${f} still shows the old name`);
  }
  // the places it is said, by name
  const ports = src('src/ui/enhanced/enhancedPorts.js');
  for (const w of ["'Silver to sell'", "title: 'Silver'", "['Silver held'", '`${MARKS_BANK.goldPerMark} gold for each silver`', "'Sell silver'"]) assert.ok(ports.includes(w), w);
  assert.match(src('src/ui/enhanced/enhancedAccount.js'), /row\(t\('account\.card\.silver', 'Silver'\), marksText\(flow\.account\.marks\)\)/, 'the account card');   // L10N4 (PIN MOVED): the row's word through t()
  assert.match(src('src/ui/socialPanel.js'), /el\('div', 'dfsocial-sec', 'Silver treasury'\)/, 'the guild\'s treasury');
  assert.match(src('src/ui/bankWindow.js'), /MARKS_COUNTING = 'The Bank counts your silver\.\.\.'/);
  // and the unrelated marks stand: DFU's Mark slots, the King's Mark, the map's middle-click, the blood marks
  assert.match(src('src/ui/enhanced/enhancedInventory.js'), /\[EQUIP_SLOTS\.Mark0\]: \{ x: 44, y: 296, label: 'Mark', off: true \}/);
  assert.match(src('src/systems/loot/lootRarity.js'), /name: "King's Mark"/);
  assert.match(src('src/systems/travel/travelOptionsText.js'), /MiddleClick - Mark a location/);
});
