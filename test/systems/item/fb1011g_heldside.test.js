// HELD-SIDE (FIELD BUGS 2026-10-11g #6, the Discord's "Cant trade after yesterdays character lockout.": "i havent been
// able to trade anything - i was able to trade ONCE ... It will just say something along the lines of: 'character
// under review'"). The realm refuses a trade when either side that gives is held by the judge (INT3), and told both
// sides alike "The realm is reviewing a character in this trade" - so a player whose PARTNER was held read it as their
// own lockout, and a player who was held was never told why at the trade. The service keeps the held side with its word
// now (server-account/src/realmTrade.js: `trade-held:a`), each side is told whose it was (`held`: 'mine' or 'theirs'),
// and the client says it - mine with my hold's reason (net/realm/realmTradeLaw.js TRADE_HELD_NOTICES, the one home
// systems/item/itemIds.js re-exports). Against the real Worker over the real migrations. bible/01-Overview/bugs/Field-Bugs-2026-10-11g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server-account/src/index.js';
import { standService } from '../../accountDb.mjs';
import { seatRealm, freshSave } from '../../realmSeat.mjs';
import { realmTradeRefusalText, TRADE_HELD_NOTICES } from '../../../src/net/realm/realmTradeLaw.js';
import { TRADE_HELD_NOTICES as NOTICES_OF_IDS, tradeHeldNotice } from '../../../src/systems/item/itemIds.js';
import { settleRealmTradeHalf } from '../../../src/systems/realmSaves.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { seeded } from '../../honestItems.mjs';

/** A dagger no honest client mints - the law holds its carrier (int2_judge's own). */
const forged = () => freshSave({ name: 'ann', items: [{ ...createWeapon(113, 1, seeded(7)), affixes: [{ id: 'damage', value: 40 }] }] });

async function stand() {
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const put = async (who, R, save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(save),
    }), s.env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const seat = async (handle) => { const who = await s.registered(handle); return { who, R: await seatRealm(s.env, who.secret, handle) }; };
  const half = (P, at, sid, give, get) => s.call('/v1/realm/trade', { ...at, sid, give, get, pick: [] }, P.secret);
  return { ...s, put, seat, half };
}
const GOLD = (n) => ({ items: [], gold: n });

test('HELD-SIDE: the held side SECOND - the service tells it the hold is its own, and the side that waited that the hold is the other\'s; the word itself unchanged for every client (mutants: the side unkept; the side read backwards)', async () => {
  const s = await stand();
  const { who: ann, R: A } = await s.seat('ann');
  const { who: bea, R: B } = await s.seat('bea');
  assert.equal((await s.put(ann, A, forged())).body.tradeHeld, 'law', 'ann is held');
  assert.deepEqual((await s.half(bea, B.at(), 'heldside1', GOLD(0), GOLD(50))).body, { state: 'waiting' });
  assert.deepEqual((await s.half(ann, A.at(), 'heldside1', GOLD(50), GOLD(0))).body, { state: 'refused', why: 'trade-held', held: 'mine' });
  assert.deepEqual((await s.half(bea, B.at(), 'heldside1', GOLD(0), GOLD(50))).body, { state: 'refused', why: 'trade-held', held: 'theirs' }, 'bea, who waited, is told it was the other\'s');
});

test('HELD-SIDE: the held side FIRST - the side that settles is told the hold is the other\'s, the held one that it is its own (mutants: the side unkept; the side read backwards)', async () => {
  const s = await stand();
  const { who: ann, R: A } = await s.seat('ann');
  const { who: bea, R: B } = await s.seat('bea');
  await s.put(ann, A, forged());
  assert.deepEqual((await s.half(ann, A.at(), 'heldside2', GOLD(50), GOLD(0))).body, { state: 'waiting' });
  assert.deepEqual((await s.half(bea, B.at(), 'heldside2', GOLD(0), GOLD(50))).body, { state: 'refused', why: 'trade-held', held: 'theirs' });
  assert.deepEqual((await s.half(ann, A.at(), 'heldside2', GOLD(50), GOLD(0))).body, { state: 'refused', why: 'trade-held', held: 'mine' });
  // a refusal that is no hold's carries no side
  assert.deepEqual((await s.half(ann, A.at(), 'heldside3', GOLD(5), GOLD(0))).body, { state: 'waiting' });
  assert.deepEqual((await s.half(bea, B.at(), 'heldside3', GOLD(0), GOLD(6))).body, { state: 'refused', why: 'mismatch' });
});

test('HELD-SIDE: the words - mine says my hold\'s reason, the same sentence the hold\'s notice said; the other\'s says it is the other\'s, and that mine is open when my last checkpoint held nothing; a service before it says what it always said (mutants: mine unsaid; the reason unread; theirs unsaid)', () => {
  assert.equal(NOTICES_OF_IDS, TRADE_HELD_NOTICES, 'one home: itemIds re-exports the trade law\'s');
  for (const why of ['law', 'budget', 'staff']) {   // PIN MOVED (AUTO-HOLD, 2026-10-16): 'dupe' retired - no verdict writes it, no notice says it
    assert.equal(realmTradeRefusalText('trade-held', 'mine', why), `${TRADE_HELD_NOTICES[why]} Nothing was traded.`);
    assert.equal(tradeHeldNotice(null, why), TRADE_HELD_NOTICES[why], 'the notice that said the hold began, word for word');
  }
  assert.equal(realmTradeRefusalText('trade-held', 'mine', undefined), 'The realm is reviewing your character, and its trading is frozen. Nothing was traded.', 'no checkpoint answered yet: mine, no reason');
  assert.equal(realmTradeRefusalText('trade-held', 'theirs', null), 'The realm is reviewing the other character in this trade, and its trading is frozen. Nothing changed hands. Your own trading is open.');
  assert.equal(realmTradeRefusalText('trade-held', 'theirs', 'law'), 'The realm is reviewing the other character in this trade, and its trading is frozen. Nothing changed hands.', 'mine held too: never told it is open');
  assert.equal(realmTradeRefusalText('trade-held'), 'The realm is reviewing a character in this trade, and its trading is frozen. Nothing changed hands.', 'an older service\'s word, as before');
  assert.match(realmTradeRefusalText('record-unjudged', 'theirs'), /the other character's latest save/);
  assert.match(realmTradeRefusalText('record-unjudged', 'mine'), /your latest save/);
});

test('HELD-SIDE: the client\'s half carries the service\'s side into the refusal it says, read with the session\'s own hold (mutants: the side dropped at the call; the session\'s hold unread)', async () => {
  // the session's own transaction over an io whose service answers `answer` (realmSaves.js realmAsk's io)
  const session = (answer, tradeHeld) => ({
    tradeHeld,
    transact: async (fn) => fn({
      id: 'c', lease: 'l', seq: 1,
      io: { base: 'https://accounts.invalid', secret: 'x', fetch: async () => new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }) },
    }),
  });
  const half = { sid: 's'.repeat(16), give: GOLD(1), get: GOLD(0), pick: [] };
  const theirs = await settleRealmTradeHalf({ session: session({ state: 'refused', why: 'trade-held', held: 'theirs' }, null), half, wait: async () => {} });
  assert.deepEqual([theirs.ok, theirs.why, theirs.held], [false, 'trade-held', 'theirs']);
  assert.equal(theirs.text, realmTradeRefusalText('trade-held', 'theirs', null));
  const mine = await settleRealmTradeHalf({ session: session({ state: 'refused', why: 'trade-held', held: 'mine' }, 'budget'), half, wait: async () => {} });
  assert.equal(mine.text, `${TRADE_HELD_NOTICES.budget} Nothing was traded.`);
  const old = await settleRealmTradeHalf({ session: session({ state: 'refused', why: 'trade-held' }, null), half, wait: async () => {} });
  assert.equal('held' in old, false, 'an older service\'s answer carries no side');
  assert.equal(old.text, realmTradeRefusalText('trade-held'));
});
