// CARDS6 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 23): THE TWO SIGNED WORDS - the service's stake order
// (net/identityToken.js, kind `stake`) and the relay's cash-out receipt (net/cardReceipt.js, `c1`): each its own fields
// and no other kind's, each checked before a byte is trusted, a void's order read at its own age, a receipt's sum the
// shape its why allows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { orderValid, mintStakeOrder, verifyOrder, verifyStakeOrderAnyAge, mintSiegeOrder, ORDER_TTL_S } from '../src/net/identityToken.js';
import { cardReceiptValid, mintCardReceipt, verifyCardReceipt, readCardReceipt, CARD_RECEIPT_TTL_S } from '../src/net/cardReceipt.js';

const { subtle } = webcrypto;
const keys = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const J = 'abcdef0123456789abcd';

test('CARDS6 the stake order: its fields and no other kind\'s, its room an interior\'s, its id the service\'s, its sum a sum; read whole at any age for a void, and only a stake', async () => {
  const base = { o: 'stake', s: 'acct-a', cj: J, cr: 'interior:m1.2', ct: 0, ca: 500, cb: 10, i: 100, e: 160 };
  assert.equal(orderValid(base), true);
  assert.equal(orderValid({ ...base, cr: 'world:1.2' }), false, 'an interior\'s room alone');
  assert.equal(orderValid({ ...base, cj: 'NOT-HEX' }), false);
  assert.equal(orderValid({ ...base, ca: 0 }), false);
  assert.equal(orderValid({ ...base, ct: 16 }), false);
  assert.equal(orderValid({ o: 'mute', s: 'acct-a', mu: 0, cj: J, i: 100, e: 160 }), false, 'no other kind carries a stake\'s field');
  const kp = await keys();
  const tok = await mintStakeOrder({ s: 'acct-a', cj: J, cr: 'interior:m1.2', ct: 0, ca: 500, cb: 10 }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyOrder(tok, kp.publicKey, { subtle, nowS: 1001, kind: 'stake' })).ok, true);
  assert.equal((await verifyOrder(tok, kp.publicKey, { subtle, nowS: 1000 + ORDER_TTL_S, kind: 'stake' })).why, 'expired', 'a minute\'s life to be sat on');
  const late = await verifyStakeOrderAnyAge(tok, kp.publicKey, { subtle });
  assert.equal(late.ok, true, 'a void reads it at its own age');
  assert.equal(late.claims.cj, J);
  const other = await keys();
  assert.equal((await verifyStakeOrderAnyAge(tok, other.publicKey, { subtle })).ok, false, 'its signature still');
  const pass = await mintSiegeOrder({ s: 'acct-a', sk: 1, sw: 1, sd: 'attack', st: 'palace', sn: 'siege', sb: 1000, se: 2000, sf: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]] }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyStakeOrderAnyAge(pass, kp.publicKey, { subtle })).ok, false, 'a stake, and no other order');
});

test('CARDS6 the cash-out receipt: a stake and a sum, a why, broke is nothing back; signed, unexpired, no other kind\'s field', async () => {
  const c = { s: 'acct-a', j: J, r: 700, w: 'stood', i: 100, e: 100 + CARD_RECEIPT_TTL_S };
  assert.equal(cardReceiptValid(c), true);
  assert.equal(cardReceiptValid({ ...c, w: 'won' }), false, 'a why of its four');
  assert.equal(cardReceiptValid({ ...c, w: 'broke' }), false, 'out of chips is nothing back');
  assert.equal(cardReceiptValid({ ...c, w: 'broke', r: 0 }), true);
  assert.equal(cardReceiptValid({ ...c, x: 1 }), false, 'a watch\'s pixel is no cash-out\'s');
  assert.equal(cardReceiptValid({ ...c, e: c.i + CARD_RECEIPT_TTL_S + 1 }), false);
  const kp = await keys();
  const r = await mintCardReceipt({ s: 'acct-a', j: J, r: 700, w: 'stood' }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyCardReceipt(r, kp.publicKey, { subtle, nowS: 1001 })).ok, true);
  assert.equal((await verifyCardReceipt(r, kp.publicKey, { subtle, nowS: 1000 + CARD_RECEIPT_TTL_S })).why, 'expired');
  assert.equal((await verifyCardReceipt(await mintCardReceipt({ s: 'acct-a', j: J, r: 700, w: 'stood' }, null, { subtle, nowS: 1000 }), kp.publicKey, { subtle, nowS: 1001 })).why, 'unsigned');
  assert.equal(readCardReceipt(r).r, 700, 'the client reads it without a verdict');
});
