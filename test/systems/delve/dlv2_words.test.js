// DLV2 (bible/03-World/Delve-II.md law 9 and section 6): EVERY WORD AN ENCOUNTER SAYS. Each line
// through the text core under its own key, short (PLAIN-TEXT: 40 words a string, 25 a sentence), the event then what
// to do. The vault's roll is test/systems/delve/delvevault.test.js (DELVE-VAULT). Pins held to fail under the mutations in
// tools/mutants/dlv2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as WORDS from '../../../src/systems/delve/delveWords.js';
import { DELVE_NEAR_TEXT, DELVE_HOLD_TEXT, DELVE_SAY_S, DELVE_SAY_LONG_S } from '../../../src/systems/delve/delveWords.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
/** Every line of every table (DLV4: the new kinds' too), each source look's near line, at the arguments they take. */
const lines = () => [
  ...['tomb', 'pool', 'altar'].map((look) => DELVE_NEAR_TEXT.springs(look, 3)),
  ...Object.entries(WORDS).filter(([k, v]) => /_TEXT$/.test(k) && v && typeof v === 'object').flatMap(([, table]) => Object.values(table).map((f) => f(2, 3))),
];

test('DLV2 THE WORDS: each its own key in the text core, said short - no line past 40 words, no sentence past 25, no dash aside, numbers as numerals (mutants: a line off the text core)', () => {
  const src = rd('src/systems/delve/delveWords.js');
  const keys = [...src.matchAll(/t\('(delve\.[a-zA-Z.]+)'/g)].map((m) => m[1]);
  assert.equal(keys.length, new Set(keys).size, 'one key a line');
  assert.equal(keys.length, 66, 'DLV4: the Hold\'s and the Litany\'s twenty, and the five new kinds\' forty-three; DLV3: a won vault not mine, another party\'s site and my own elsewhere');
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

