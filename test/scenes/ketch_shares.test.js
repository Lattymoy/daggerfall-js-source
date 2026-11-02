// AUDIT KETCH L2-2, L2-5 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9): THE SHARES THE HOLD PAID, ON THIS
// DEVICE (scenes/ketch/ketchShares.js) - kept in the device's store the moment the service pays one, until the Ketch's own
// pool holds it: thrown from the chest aboard, into the pack off the ship, at leaving and at a stand-up after a crash; two
// paid at once both kept; another account's never given to this one. tools/mutants/ketch_client.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKetchShares, KT_OWED_KEY, KT_SHARES_OWED_MAX } from '../../src/scenes/ketch/ketchShares.js';
import { ketchSpoilsDay, KT_SPOILS_TEXT } from '../../src/systems/ketch/ketchSpoils.js';

const SHIP = '0123456789abcdef';
const claims = (d, s = 'acct-ann', c = 77) => ({ d, o: SHIP, s, c, l: 30, x: 'dealt' });
/** A pool that remembers what it was handed - once a day and account, as the real one's spent mark does. */
function fakePool({ floor = true } = {}) {
  const spent = new Set(), granted = [], spewed = [];
  return {
    granted, spewed,
    grant: (o) => { const k = `${o.day}|${o.acct}`; if (spent.has(k)) return false; spent.add(k); granted.push(o.day); return true; },
    spew: (o) => { if (!floor) return false; const k = `${o.day}|${o.acct}`; if (spent.has(k)) return false; spent.add(k); spewed.push(o.day); return true; },
  };
}
const settle = () => new Promise((go) => setTimeout(go, 0));
const book = (o = {}) => {
  const store = o.store ?? new Map(), pool = o.pool ?? fakePool(), said = [], saves = [];
  let aboard = o.aboard ?? true;
  const s = createKetchShares({ store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, pool, level: () => 30, me: () => o.me ?? 'acct-ann', aboard: () => aboard, say: (t) => said.push(t), changed: () => saves.push(1) });
  return { s, store, pool, said, saves, off: () => { aboard = false; } };
};

test('KETCH A SHARE PAID ABOARD IS KEPT ON THE DEVICE AT ONCE: a reload before the chest loses nothing - the next stand-up gives it to the pack; the chest throws it, and once thrown it is never given again (AUDIT KETCH L2-2; mutants: a share kept in memory alone; a thrown share kept)', async () => {
  const store = new Map();
  const a = book({ store });
  assert.equal(a.s.paid(claims(3)), true);
  assert.deepEqual(store.get(KT_OWED_KEY).map((e) => e.d), [3], 'written the moment it is paid');
  // the page reloads: a new book over the same store, off the ship - the crash's door
  const b = book({ store, aboard: false });
  await b.s.give();
  assert.deepEqual(b.pool.granted, [ketchSpoilsDay(3, SHIP)], 'given at the stand-up');
  assert.deepEqual(store.get(KT_OWED_KEY), [], 'and let go');
  assert.equal(b.saves.length, 1, 'a save asked for (AUDIT KETCH L3-13)');
  // aboard: the chest throws it
  const c = book();
  c.s.paid(claims(4));
  assert.equal(c.s.chest([0, 0, 0], 0), true);
  assert.deepEqual(c.pool.spewed, [ketchSpoilsDay(4, SHIP)]);
  assert.deepEqual(c.said, [KT_SPOILS_TEXT.spilled]);
  assert.deepEqual(c.s.owed(), [], 'thrown: owed no more');
  assert.equal(c.s.chest([0, 0, 0], 0), false, 'the chest empty');
});

test('KETCH TWO SHARES PAID AT ONCE ARE TWO: the second never writes over the first - the chest throws the oldest, leaving gives the rest to the pack; a share paid twice is kept once; another account\'s is never given to this one (AUDIT KETCH L2-5; mutants: one share held; another\'s given)', async () => {
  const a = book();
  a.s.paid(claims(3)); a.s.paid(claims(4)); a.s.paid(claims(4));
  a.s.paid(claims(5, 'acct-bo'));
  assert.deepEqual(a.s.owed().map((e) => [e.d, e.s]), [[3, 'acct-ann'], [4, 'acct-ann'], [5, 'acct-bo']]);
  a.s.chest([0, 0, 0], 0);
  assert.deepEqual(a.pool.spewed, [ketchSpoilsDay(3, SHIP)], 'the oldest first');
  a.off();
  await a.s.give();
  assert.deepEqual(a.pool.granted, [ketchSpoilsDay(4, SHIP)], 'the rest into the pack - mine alone');
  assert.deepEqual(a.s.owed().map((e) => e.s), ['acct-bo'], 'another account\'s waits for its own sign-in');
  // off the ship from the first: given at once
  const b = book({ aboard: false });
  b.s.paid(claims(6));
  await settle();
  assert.deepEqual(b.pool.granted, [ketchSpoilsDay(6, SHIP)]);
  assert.deepEqual(b.s.owed(), []);
  // no floor to throw onto: the pack
  const c = book({ pool: fakePool({ floor: false }) });
  c.s.paid(claims(7));
  c.s.chest([0, 0, 0], 0);
  await settle();
  assert.deepEqual(c.pool.granted, [ketchSpoilsDay(7, SHIP)]);
  // bounded
  const d = book();
  for (let n = 1; n <= KT_SHARES_OWED_MAX + 3; n++) d.s.paid(claims(n));
  assert.equal(d.s.owed().length, KT_SHARES_OWED_MAX);
  assert.equal(d.s.paid({ d: 1 }), false, 'claims that are not a receipt\'s: nothing');
});
