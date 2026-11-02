// OVERLOAD-EASE (2026-10-29: the account database overloaded): the account's festival is asked once a sign-in, not at
// every relay reconnect (a failed ask again after OFFERING_REFRESH_MS), and a Soul Cake or bowl restack queues no realm
// checkpoint - the stack mirrors the service's count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('OVERLOAD-EASE: festival/mine is asked per account, retried on its own clock', () => {
  const w = src('src/scenes/witchesHost.js');
  assert.doesNotMatch(w, /heard = false/, 'a reconnect no longer forgets the account was heard');
  assert.match(w, /if \(heardFor !== account && !mineAsking && Date\.now\(\) - mineAt >= OFFERING_REFRESH_MS\) \{/);
  assert.match(w, /if \(ok && asked === account\) heardFor = asked;/, 'only an answer marks it heard');
  assert.match(w, /if \(who && who === heardFor && pendingSale\(\)\) \{ heardFor = null; mineAt = -Infinity; \}/, 'a pending sale is resumed on reconnect');
});

test('OVERLOAD-EASE: a restack is no save', () => {
  const c = src('src/systems/festival/festivalClient.js');
  assert.match(c, /if \(Array\.isArray\(items\)\) restackSoulCakes\(items, d\.cakes\);/);
  assert.match(c, /if \(Array\.isArray\(items\)\) restackHearthOfferings\(items, d\.bowls\);/);
});
