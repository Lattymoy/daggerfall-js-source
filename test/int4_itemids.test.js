// INT4 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Realm-Arc section 4: "Valuable items get a
// service-issued id ... The same id in two records freezes both for review"): A VALUABLE PIECE'S ID, AND THE LEDGER.
//   - the client: which pieces earn an id (systems/itemIds.js valuablePiece), the id's shape, the stamp over the
//     character's own five lists (never a stack, a bound piece or one stamped already), and what the player is told as
//     the judge's hold moves;
//   - the service (server-account/src/verdict.js ledgerStep, through real checkpoints): a new id taken; an id let go and
//     shown by another record moved to it, no witness needed; an id shown while its holder still holds it CONTESTED, and
//     settled by the holder's next checkpoint - gone, it moved; still there, a DUPE; an id twice in one record a dupe at
//     once; a piece marked a dupe moved by no route; DUPES_FOR_HOLD duplicates and the character's trade held for staff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server-account/src/index.js';
import { standService } from './accountDb.mjs';
import { seatRealm, freshSave } from './realmSeat.mjs';
import { valuablePiece, mintItemId, stampItemIds, tradeHeldNotice, TRADE_HELD_NOTICES, TRADE_OPEN_NOTICE } from '../src/systems/itemIds.js';
import { DUPES_FOR_HOLD } from '../server-account/src/verdict.js';
import { prepareRealmRecord } from '../server-account/src/realm.js';
import { takeTradeGoods } from '../src/net/realmTradeLaw.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { applyRarity } from '../src/systems/lootRarity.js';
import { letterOfCredit } from '../src/systems/inventory.js';
import { seeded } from './honestItems.mjs';

const rare = (seed = 11) => applyRarity(createWeapon(113, 1, seeded(7)), 'rare', seeded(seed));
const counter = () => { let n = 0; return (b) => { b.fill(0); b[7] = ++n; return b; }; };

test('INT4 client: a valuable piece earns an id - a tier the ladder rolls or records, a DFU magic item or artifact, a craft, a letter of credit; never a stack, a bound piece or a quest\'s; the stamp covers the character\'s own five lists and keeps an id once given', () => {
  const plain = createWeapon(113, 1, seeded(7));
  assert.equal(valuablePiece(plain), false);
  assert.equal(valuablePiece(rare()), true);
  assert.equal(valuablePiece({ ...plain, magic: true }), true);
  assert.equal(valuablePiece({ ...plain, provenance: '0123456789abcdef' }), true);
  assert.equal(valuablePiece(letterOfCredit(500)), true, 'a letter IS gold');
  assert.equal(valuablePiece({ ...rare(), bound: true }), false);
  assert.equal(valuablePiece({ ...rare(), questItem: true }), false);
  assert.equal(valuablePiece({ ...rare(), stackCount: 3 }), false);
  assert.match(mintItemId(), /^[0-9a-f]{16}$/);
  const kept = { ...rare(), uid: 'abcdefabcdefabcd' };
  const entity = { items: [rare(), plain, kept], wagonItems: [rare(12)], bagItems: [], furnishings: [rare(13)], otherItems: [rare(14)] };
  assert.equal(stampItemIds(entity, counter()), 4);
  assert.deepEqual([entity.items[0].uid, entity.items[1].uid, entity.items[2].uid, entity.wagonItems[0].uid], ['0000000000000001', undefined, 'abcdefabcdefabcd', '0000000000000002']);
  assert.equal(stampItemIds(entity, counter()), 0, 'once given, kept');
});

test('INT3 client: the hold said as it moves - its reason when it falls, "open again" when it lifts, nothing when it stands or nothing is known', () => {
  assert.equal(tradeHeldNotice(null, 'law'), TRADE_HELD_NOTICES.law);
  assert.equal(tradeHeldNotice('law', 'dupe'), TRADE_HELD_NOTICES.dupe);
  assert.equal(tradeHeldNotice('law', null), TRADE_OPEN_NOTICE);
  assert.equal(tradeHeldNotice(null, null), null);
  assert.equal(tradeHeldNotice('law', 'law'), null);
  assert.equal(tradeHeldNotice('law', undefined), null);
});

async function stand() {
  const s = await standService();
  const raw = s.env.DB._raw;
  const seat = async (handle) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    return { who, R };
  };
  const put = async ({ who, R }, items) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) },
      body: JSON.stringify(freshSave({ name: who.handle, items })),
    }), s.env);
    return (await res.json()).tradeHeld;
  };
  const ledger = (uid) => ({ ...raw.prepare('SELECT char_id, state, other_char FROM item_uids WHERE uid = ?').get(uid) });
  const dupes = (id) => raw.prepare("SELECT COUNT(*) AS n FROM realm_findings WHERE char_id = ? AND kind = 'dupe'").get(id).n;
  return { ...s, raw, seat, put, ledger, dupes };
}
const withId = (uid, seed = 11) => ({ ...rare(seed), uid });

test('INT4 service: a new id taken; let go and shown by another record, moved - no witness needed; shown while its holder holds it, CONTESTED, and the holder\'s next checkpoint settles it - gone, it moved; still there, a DUPE that no route moves again', async () => {
  const s = await stand();
  const A = await s.seat('ann'), B = await s.seat('bea'), C = await s.seat('cai');
  const u1 = '1111111111111111', u2 = '2222222222222222';
  await s.put(A, [withId(u1), withId(u2, 12)]);
  assert.deepEqual(s.ledger(u1), { char_id: A.R.id, state: 'held', other_char: null });
  // A drops u1; B picks it up: moved
  await s.put(A, [withId(u2, 12)]);
  assert.equal(s.ledger(u1).state, 'gone');
  await s.put(B, [withId(u1)]);
  assert.deepEqual(s.ledger(u1), { char_id: B.R.id, state: 'held', other_char: null });
  // B shows u1 to C while B still checkpoints it - contested, then B lets it go: it moved to C
  await s.put(C, [withId(u1)]);
  assert.deepEqual(s.ledger(u1), { char_id: B.R.id, state: 'contested', other_char: C.R.id });
  await s.put(B, []);
  assert.deepEqual(s.ledger(u1), { char_id: C.R.id, state: 'held', other_char: null });
  // C shows u2 while A holds it, and A's next checkpoint STILL holds it: a dupe
  await s.put(C, [withId(u1), withId(u2, 12)]);
  assert.equal(s.ledger(u2).state, 'contested');
  await s.put(A, [withId(u2, 12)]);
  assert.equal(s.ledger(u2).state, 'dupe');
  assert.equal(s.dupes(A.R.id), 1, 'the record that kept it counts one');
  // no route moves it again: a listing that would take it out of C's record is refused
  const ctx = { db: s.env.DB, bucket: s.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: 1 };
  const take = (save) => (takeTradeGoods(save, { items: [save.items[1]], gold: 0 }, [1]) ? null : 'gone');
  assert.deepEqual(await prepareRealmRecord(ctx, C.who.id, C.R.at(), take, { outbound: true }), { error: 'piece-dupe' });
  // carrying a marked dupe on is no new one
  await s.put(A, [withId(u2, 12)]);
  assert.equal(s.dupes(A.R.id), 1);
});

test('INT4 service: an id twice in one record is a dupe at once; DUPES_FOR_HOLD duplicates made and the trade is held for staff - and stays held when the pieces go', async () => {
  const s = await stand();
  const A = await s.seat('dov');
  for (let i = 0; i < DUPES_FOR_HOLD; i++) {
    const u = `${i}`.repeat(16);
    const held = await s.put(A, [withId(u), withId(u)]);
    assert.equal(s.ledger(u).state, 'dupe');
    assert.equal(held, i + 1 >= DUPES_FOR_HOLD ? 'dupe' : null, `duplicate ${i + 1}`);
  }
  assert.equal(await s.put(A, []), 'dupe', 'staff alone lift it');
});
