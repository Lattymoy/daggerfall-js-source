// DLV2 (bible/03-World/Delve-II.md law 9 and section 6): EVERY WORD AN ENCOUNTER SAYS, AND ITS VAULT'S ROLL. Each line
// through the text core under its own key, short (PLAIN-TEXT: 40 words a string, 25 a sentence), the event then what
// to do; the vault never empty. Pins held to fail under the mutations in tools/mutants/dlv2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DELVE_NEAR_TEXT, DELVE_HOLD_TEXT, DELVE_LITANY_TEXT, DELVE_VAULT_TEXT, DELVE_SAY_S, DELVE_SAY_LONG_S } from '../../../src/systems/delve/delveWords.js';
import { rollVault } from '../../../src/systems/delve/delveVault.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const lines = () => [
  DELVE_NEAR_TEXT.hold(), DELVE_NEAR_TEXT.litany(4),
  ...Object.values(DELVE_HOLD_TEXT).map((f) => f(2, 3)), ...Object.values(DELVE_LITANY_TEXT).map((f) => f()),
  ...Object.values(DELVE_VAULT_TEXT).map((f) => f()),
];

test('DLV2 THE WORDS: each its own key in the text core, said short - no line past 40 words, no sentence past 25, no dash aside, numbers as numerals (mutants: a line off the text core)', () => {
  const src = rd('src/systems/delve/delveWords.js');
  const keys = [...src.matchAll(/t\('(delve\.[a-zA-Z.]+)'/g)].map((m) => m[1]);
  assert.equal(keys.length, new Set(keys).size, 'one key a line');
  assert.equal(keys.length, 20);
  for (const k of keys) assert.match(rd('locales/en/Port_Strings.csv'), new RegExp(`^${k.replace(/\./g, '\\.')},`, 'm'), `${k} is in the English table`);
  for (const s of lines()) {
    assert.ok(typeof s === 'string' && s.length > 0);
    assert.ok(s.split(/\s+/).length <= 40, s);
    for (const sentence of s.split(/(?<=[.!?])\s+/)) assert.ok(sentence.split(/\s+/).length <= 25, sentence);
    assert.doesNotMatch(s, / - |—/, 'no dash aside');
  }
  assert.equal(DELVE_HOLD_TEXT.wave(2, 3), 'Wave 2 of 3');
  assert.equal(DELVE_NEAR_TEXT.litany(5), '5 plates are set in a ring in this floor. Step inside the ring to wake them.');
  assert.deepEqual([DELVE_SAY_S, DELVE_SAY_LONG_S], [3, 5]);
});

test('DLV2 THE VAULT\'S ROLL: the pile\'s own roll; empty, rolled again once; empty twice, the level\'s gold - never an empty vault (mutants: no second roll; the gold\'s floor)', () => {
  let n = 0;
  assert.deepEqual(rollVault(() => { n++; return [{ name: 'Dagger' }]; }, 5), [{ name: 'Dagger' }]);
  assert.equal(n, 1, 'a roll with items, once');
  n = 0;
  assert.deepEqual(rollVault(() => (++n === 1 ? [] : [{ name: 'Ruby' }]), 5), [{ name: 'Ruby' }]);
  assert.equal(n, 2, 'empty, rolled again');
  n = 0;
  const gold = rollVault(() => { n++; return []; }, 7);
  assert.equal(n, 2, 'twice and no more');
  assert.equal(gold.length, 1);
  assert.equal(gold[0].group, 'Currency');
  assert.equal(gold[0].stackCount, 7, 'the level\'s gold');
  assert.equal(rollVault(() => null, 0)[0].stackCount, 1, 'at least 1');
  assert.equal(rollVault(() => [], 3.7)[0].stackCount, 3);
});
