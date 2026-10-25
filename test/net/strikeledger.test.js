// KILL CREDIT (2026-10-19): the striker's ledger (src/net/strikeLedger.js), by itself. The pool's behaviour over it is
// test/net/killcredit.test.js (two real pools, the real hit queues, the real kill listeners) and
// test/systems/disc10_online_kill.test.js (the werewolf's urge); this file pins the ledger's own law - once, a minute from the LAST
// blow, the key that names the owner, and the bound that keeps it small.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStrikeLedger, SLAIN_KEEP_MS, STRIKES_KEPT_MAX } from '../../src/net/strikeLedger.js';

const ent = (n) => ({ n });

test('KILL CREDIT ledger: a struck body lands ONCE with the entity and kind my puppet had at the blow; a second word finds nothing', () => {
  const l = createStrikeLedger();
  const e = ent(1);
  l.note('bob', 7, 1000, e, 0);
  const s = l.land('bob', 7, 1500);
  assert.equal(s?.entity, e, 'the entity the blow struck');
  assert.equal(s?.mobileType, 0, 'and what it was');
  assert.equal(l.land('bob', 7, 1600), null, 'once');
  assert.equal(l.size, 0, 'and the entry is spent');
});

test('KILL CREDIT ledger: only a body I STRUCK, only the owner who owns it - another owner\'s number, another number, a body never noted', () => {
  const l = createStrikeLedger();
  l.note('bob', 7, 1000, ent(1), 0);
  assert.equal(l.land('eve', 7, 1100), null, 'the same number under another owner is another body');
  assert.equal(l.land('bob', 8, 1100), null, 'another number of the same owner too');
  assert.equal(l.land('mac', 1, 1100), null, 'a body never struck');
  assert.ok(l.land('bob', 7, 1200), 'and the struck one is still there after the refusals (a forged word spends nothing)');
});

test('KILL CREDIT ledger: the credit is a minute from the LAST blow - 60 s lands, 60 s and a millisecond is let go (and gone), a later blow starts the minute again', () => {
  const l = createStrikeLedger();
  l.note('bob', 1, 0, ent(1), 0);
  assert.ok(l.land('bob', 1, SLAIN_KEEP_MS), 'exactly a minute: inside');
  l.note('bob', 2, 0, ent(2), 0);
  assert.equal(l.land('bob', 2, SLAIN_KEEP_MS + 1), null, 'a millisecond past: let go');
  assert.equal(l.land('bob', 2, 10), null, 'and gone - the entry went with the refusal');
  l.note('bob', 3, 0, ent(3), 0);
  l.note('bob', 3, 50_000, ent(3), 0);   // a second blow, 50 s on
  assert.ok(l.land('bob', 3, 50_000 + SLAIN_KEEP_MS), 'the minute is counted from the last blow');
});

test('KILL CREDIT ledger: the expired are let go as new blows come, and no more than STRIKES_KEPT_MAX bodies are held - the oldest go first', () => {
  const l = createStrikeLedger();
  for (let i = 0; i < 10; i++) l.note('bob', i, i, ent(i), 0);
  l.note('bob', 99, SLAIN_KEEP_MS + 100, ent(99), 0);
  assert.equal(l.size, 1, 'a blow a minute on lets the old ones go');
  const m = createStrikeLedger();
  for (let i = 0; i < STRIKES_KEPT_MAX + 30; i++) m.note('bob', i, 1000 + i, ent(i), 0);
  assert.equal(m.size, STRIKES_KEPT_MAX, 'bounded');
  assert.equal(m.land('bob', 0, 2000), null, 'the oldest went first');
  assert.ok(m.land('bob', STRIKES_KEPT_MAX + 29, 2000), 'the newest stayed');
});

test('KILL CREDIT ledger: a mobile type that is no integer is held as none; clear() empties it (the pool going away)', () => {
  const l = createStrikeLedger();
  l.note('bob', 1, 0, ent(1), /** @type {any} */ ('rat'));
  assert.equal(l.land('bob', 1, 1)?.mobileType, null, 'never a string from a frame');
  l.note('bob', 2, 0, ent(2), 3);
  l.clear();
  assert.equal(l.size, 0);
  assert.equal(l.land('bob', 2, 1), null, 'no blow of the old world is credited in the next');
});
