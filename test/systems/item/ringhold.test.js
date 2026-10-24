// RING-HOLD (2026-10-11, a player on Discord: "I was with a trade lock because of a Ring, I got rid of the ring and now
// it says only 'something'"): a law hold that stands past STRIKES_FOR_TIMED after the piece is gone says so, and a trade's
// refusal over my own hold names the piece the session heard - never "something". AUTO-HOLD (2026-10-16): that hold is
// timed and says its end - it was staff's, said as a review. PIN MOVED (AUTO-HOLD): the review's words retired for the
// timed hold's (tradeHeldWhy `until`), and the strikes' warning names a week where it named staff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server-account/src/index.js';
import { standService } from '../../accountDb.mjs';
import { seatRealm, freshSave } from '../../realmSeat.mjs';
import { TRADE_HELD_NOTICES, tradeHeldUntilNotice } from '../../../src/net/realm/realmTradeLaw.js';
import { tradeHeldNotice, tradeHeldLawNotice } from '../../../src/systems/item/itemIds.js';
import { settleRealmTradeHalf } from '../../../src/systems/realmSaves.js';
import { STRIKES_FOR_TIMED } from '../../../server-account/src/judge.js';
import { LAW_HOLD_S } from '../../../server-account/src/verdict.js';

const ring = () => ({ templateIndex: 135, group: 'Jewellery', value: 80, hand: 1 });   // 'crafted': a hand on a ring no craft made

test('RING-HOLD: the third hold stands once the ring is gone - and the answer says when it lifts (AUTO-HOLD: a week, on its own; it said staff\'s), never "until it is gone"', async () => {
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const who = await s.registered('ann'); const R = await seatRealm(s.env, who.secret, 'ann');
  const put = async (save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, { method: 'PUT',
      headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(save) }), s.env);
    return res.json();
  };
  const carry = freshSave({ name: 'ann', items: [ring()] });
  const dropped = freshSave({ name: 'ann', world: { piles: [{ items: [ring()] }] } });
  for (let i = 0; i < STRIKES_FOR_TIMED - 1; i++) {
    assert.deepEqual(await put(carry), { ok: true, seq: 2 + 2 * i, tradeHeld: 'law', tradeHeldWhy: { code: 'crafted', t: 135 }, locked: [] });   // PIN MOVED: AUDIT AUTO-HOLD - every answer names the locked pieces, [] for none
    assert.equal((await put(dropped)).tradeHeld, null, 'dropped: lifted');
  }
  const third = await put(carry);
  const until = third.tradeHeldWhy?.until;
  assert.deepEqual(third, { ok: true, seq: 2 * STRIKES_FOR_TIMED, tradeHeld: 'law', tradeHeldWhy: { code: 'until', t: 135, until }, locked: [] }, 'the third: timed, the piece still named');   // PIN MOVED: AUDIT AUTO-HOLD - every answer names the locked pieces, [] for none
  assert.ok(Math.abs(until - (Math.floor(Date.now() / 1000) + LAW_HOLD_S)) < 60, 'a week from now');
  const gone = await put(dropped);
  assert.deepEqual([gone.tradeHeld, gone.tradeHeldWhy], ['law', { code: 'until', t: null, until }], 'held still - and said when it lifts');
  assert.equal(tradeHeldNotice('law', gone.tradeHeld, gone.tradeHeldWhy), tradeHeldUntilNotice(until));
  assert.doesNotMatch(tradeHeldUntilNotice(until), /something|until it is gone|staff/);
});

test('RING-HOLD: a trade refused over my own law hold names the piece the session heard (it said "something")', async () => {
  const session = {
    tradeHeld: 'law', tradeHeldWhy: { code: 'crafted', t: 135 },
    transact: async (fn) => fn({ id: 'c', lease: 'l', seq: 1,
      io: { base: 'https://accounts.invalid', secret: 'x', fetch: async () => new Response(JSON.stringify({ state: 'refused', why: 'trade-held', held: 'mine' }), { status: 200, headers: { 'content-type': 'application/json' } }) } }),
  };
  const half = { sid: 's'.repeat(16), give: { items: [], gold: 1 }, get: { items: [], gold: 0 }, pick: [] };
  const r = await settleRealmTradeHalf({ session, half, wait: async () => {}, heldSaid: () => tradeHeldNotice(null, session.tradeHeld, session.tradeHeldWhy) });
  assert.equal(r.why, 'trade-held');
  assert.match(r.text, /it carries a Ring/);
  assert.doesNotMatch(r.text, /something/);
});

test('RING-WARN: a law hold\'s notice says each hold counts and the third is timed - named or not - and the words\' "third" is the service\'s STRIKES_FOR_TIMED', () => {
  assert.equal(STRIKES_FOR_TIMED, 3, 'the notices say "the third time" and the timed hold "three times" - a new count moves the words');
  const named = tradeHeldNotice(null, 'law', { code: 'crafted', t: 135 });
  assert.equal(named, tradeHeldLawNotice('Ring'));
  for (const text of [named, TRADE_HELD_NOTICES.law]) {
    assert.match(text, /until it is gone\. Holds add up: from the third, trading stays frozen for a week even after it is gone, and for a month each time after that\.$/);   // PIN MOVED (AUDIT AUTO-HOLD): "then opens on its own" was false with the piece still carried
  }
  assert.match(tradeHeldUntilNotice(1_800_000_000), /held 3 times/);
  assert.deepEqual(Object.keys(TRADE_HELD_NOTICES).sort(), ['budget', 'law', 'staff'], 'AUTO-HOLD: no notice says a copy holds the character, or a review');
});
