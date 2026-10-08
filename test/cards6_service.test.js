// CARDS6 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 23): A CARD TABLE'S STAKES, ESCROWED BY THE SERVICE.
// Driven on the real Worker over SQLite (server-account/src/cards.js): a stake takes the buy-in off the realm character's
// record and holds it, answering the service's order (net/identityToken.js) - the room's chips; asked again it is one
// stake; the relay's cash-out receipt (net/cardReceipt.js) pays the record and settles the stake, once; a stake handed
// back whole is the stake; another's receipt, another character's, an unsigned one are refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { verifyOrder } from '../src/net/identityToken.js';
import { mintCardReceipt } from '../src/net/cardReceipt.js';
import { payableOf } from '../src/net/realmGoldLaw.js';
import { HOLDEM_STAKE_MIN_BB, HOLDEM_STAKE_MAX_BB } from '../src/net/holdemTable.js';
import { BUY_IN_MIN_BB, BUY_IN_MAX_BB } from '../src/systems/cardTableSession.js';

const { subtle } = webcrypto;
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `stake-${String(++_rid).padStart(6, '0')}`;
const DF = 17, ROOM = 'interior:m100.200.7';

async function stand() {
  const s = await standService({});
  const raw = s.env.DB._raw;
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  const gold = (who) => payableOf(record(who).save, DF);
  const seated = async (handle, goldPieces = 5000) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces });
    who.character = R.id;
    who.at = R.at;
    return who;
  };
  const stake = (who, extra = {}) => s.call('/v1/cards/stake', { character: who.character, realm: who.at(), region: DF, room: ROOM, table: 0, bb: 10, amount: 500, rid: rid(), ...extra }, who.secret);
  const cashout = (who, receipt, extra = {}) => s.call('/v1/cards/cashout', { character: who.character, realm: who.at(), region: DF, receipt, ...extra }, who.secret);
  const receipt = (claims) => mintCardReceipt(claims, s.gatePriv, { subtle, nowS: _now });
  const row = (id) => raw.prepare('SELECT * FROM card_stakes WHERE id = ?').get(id);
  return { s, raw, gold, seated, stake, cashout, receipt, row, record };
}

test('CARDS6 the stake: the buy-in off the realm record and held, the service\'s order on it for the room, one stake however often asked', async () => {
  assert.deepEqual([HOLDEM_STAKE_MIN_BB, HOLDEM_STAKE_MAX_BB], [BUY_IN_MIN_BB, BUY_IN_MAX_BB], 'a gold table\'s buy-in is the tavern\'s own');
  const t = await stand();
  const ann = await t.seated('ann');
  const before = t.gold(ann);
  const r = await t.stake(ann, { rid: 'stake-ann-0001' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(t.gold(ann), before - 500, 'the buy-in left the record');
  const held = t.row(r.body.id);
  assert.deepEqual([held.status, Number(held.amount), held.room, Number(held.tbl), Number(held.bb), held.char_id], ['held', 500, ROOM, 0, 10, ann.character]);
  const v = await verifyOrder(r.body.stake, t.s.identityPublic, { subtle, nowS: _now, kind: 'stake' });
  assert.ok(v.ok, `the room can read it: ${v.why}`);
  assert.deepEqual([v.claims.s, v.claims.cj, v.claims.cr, v.claims.ct, v.claims.ca, v.claims.cb], [ann.id, r.body.id, ROOM, 0, 500, 10]);
  const again = await t.stake(ann, { rid: 'stake-ann-0001' });
  assert.equal(again.body.repeat, true);
  assert.equal(again.body.id, r.body.id, 'the same stake');
  assert.equal(t.gold(ann), before - 500, 'no gold moved twice');
  // the bounds: the tavern's buy-in at the stakes, a real room and table, a realm character
  for (const [extra, err] of [[{ amount: 199 }, 'bad-buy-in'], [{ amount: 1001 }, 'bad-buy-in'], [{ bb: 7 }, 'bad-stakes'], [{ table: 16 }, 'bad-table'], [{ table: -1 }, 'bad-table'], [{ room: 'world:1.2' }, 'bad-room'], [{ rid: 'x' }, 'bad-rid']]) {
    const no = await t.stake(ann, extra);
    assert.equal(no.body?.error, err, JSON.stringify(extra));
  }
  const poor = await t.seated('poor', 100);
  assert.equal((await t.stake(poor, { amount: 200 })).body.error, 'realm-gold', 'a record that cannot pay it');
  const guest = await t.s.registered('gus');
  assert.equal((await t.s.call('/v1/cards/stake', { character: null, region: DF, room: ROOM, table: 0, bb: 10, amount: 500, rid: rid() }, guest.secret)).body.error, 'cards-realm', 'a character the service does not keep plays for chips');
});

test('CARDS6 the cash-out: the relay\'s receipt paid into the character that staked, the stake settled once; a stake handed back whole is the stake', async () => {
  const t = await stand();
  const ann = await t.seated('ann'), bob = await t.seated('bob');
  const a = (await t.stake(ann)).body, b = (await t.stake(bob)).body;
  const g0 = t.gold(ann);
  // Ann leaves with Bob's stake and her own
  const win = await t.receipt({ s: ann.id, j: a.id, r: 1000, w: 'stood' });
  const paid = await t.cashout(ann, win);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.gold, 1000);
  assert.equal(t.gold(ann), g0 + 1000);
  assert.deepEqual([t.row(a.id).status, Number(t.row(a.id).paid)], ['paid', 1000]);
  const twice = await t.cashout(ann, win);
  assert.equal(twice.body.repeat, true);
  assert.equal(t.gold(ann), g0 + 1000, 'paid once');
  // Bob is out of chips: settled, nothing paid
  const gb = t.gold(bob);
  const broke = await t.cashout(bob, await t.receipt({ s: bob.id, j: b.id, r: 0, w: 'broke' }));
  assert.equal(broke.body.gold, 0);
  assert.equal(t.gold(bob), gb);
  assert.equal(t.row(b.id).status, 'paid');
  // refused or voided: the whole stake, never more or less
  const c = (await t.stake(ann)).body;
  assert.equal((await t.cashout(ann, await t.receipt({ s: ann.id, j: c.id, r: 400, w: 'refused' }))).body.error, 'cards-receipt');
  assert.equal((await t.cashout(ann, await t.receipt({ s: ann.id, j: c.id, r: 501, w: 'refused' }))).body.error, 'cards-receipt', 'a refusal hands back no more than the stake');
  assert.equal((await t.cashout(ann, await t.receipt({ s: ann.id, j: c.id, r: 499, w: 'void' }))).body.error, 'cards-receipt', 'a void hands back the whole stake, no less');
  const g1 = t.gold(ann);
  assert.equal((await t.cashout(ann, await t.receipt({ s: ann.id, j: c.id, r: 500, w: 'void' }))).body.gold, 500);
  assert.equal(t.gold(ann), g1 + 500);
});

test('CARDS6 the cash-out refuses: another\'s receipt, another character, a stake that is not there, an unsigned or a tampered receipt, past every seat\'s chips', async () => {
  const t = await stand();
  const ann = await t.seated('ann'), bob = await t.seated('bob');
  const a = (await t.stake(ann)).body;
  const r = await t.receipt({ s: ann.id, j: a.id, r: 600, w: 'stood' });
  assert.equal((await t.cashout(bob, r)).body.error, 'cards-not-yours');
  assert.equal((await t.cashout(ann, await t.receipt({ s: ann.id, j: 'ffffffffffffffffffff', r: 5, w: 'stood' }))).body.error, 'cards-no-stake');
  const unsigned = await mintCardReceipt({ s: ann.id, j: a.id, r: 600, w: 'stood' }, null, { subtle, nowS: _now });
  assert.equal((await t.cashout(ann, unsigned)).body.error, 'cards-receipt');
  const [v, body, sig] = r.split('.');
  const forged = `${v}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), r: 9000 })).toString('base64url')}.${sig}`;
  assert.equal((await t.cashout(ann, forged)).body.error, 'cards-receipt', 'a sum written over the relay\'s');
  assert.equal((await t.cashout(ann, await t.receipt({ s: ann.id, j: a.id, r: 100 * 10 * 6 + 1, w: 'stood' }))).body.error, 'cards-receipt', 'more than six deep stakes');
  assert.equal(t.row(a.id).status, 'held', 'nothing settled by any of it');
  const pays = await t.cashout(ann, r);
  assert.equal(pays.body.gold, 600, `and the true one pays: ${JSON.stringify(pays.body)}`);
  // another character of the same account: the gold goes home to the one that staked it
  const c = (await t.stake(ann)).body;
  const R2 = await seatRealm(t.s.env, ann.secret, 'ann2', { name: 'ann2', level: 5, items: [], goldPieces: 10 });
  assert.equal((await t.cashout({ ...ann, character: R2.id, at: R2.at }, await t.receipt({ s: ann.id, j: c.id, r: 500, w: 'stood' }))).body.error, 'cards-other-character');
});

test('AUDIT CARDS-4 A1, A3, A4, A6, A7: a repeat is the same order; a receipt pays whenever brought; the wire says why one was refused; the cash-out goes home to the region staked from; a character with a stake held is not deleted', async () => {
  const t = await stand();
  const ann = await t.seated('ann');
  const a = (await t.stake(ann, { rid: 'stake-ann-a1-01' })).body;
  const at = Number(t.row(a.id).at);
  _now += 9 * 24 * 3600;
  const again = (await t.stake(ann, { rid: 'stake-ann-a1-01' })).body;
  assert.equal(again.repeat, true);
  const claimsOf = (o) => JSON.parse(Buffer.from(o.split('.')[1], 'base64url').toString());
  assert.equal(claimsOf(again.stake).i, at, 'A1: the order minted at the stake\'s own instant - never a fresh minute to sit on');
  assert.equal(again.stake, a.stake, 'the same order');
  // A4: a refusal's why on the wire
  const unsigned = await mintCardReceipt({ s: ann.id, j: a.id, r: 500, w: 'stood' }, null, { subtle, nowS: _now });
  assert.deepEqual((await t.cashout(ann, unsigned)).body, { error: 'cards-receipt', why: 'unsigned' });
  // A3: brought past its thirty days, a receipt still pays its stake once
  const late = await t.receipt({ s: ann.id, j: a.id, r: 500, w: 'stood' });
  _now += 31 * 24 * 3600;
  // A3: and while it is held the character is not deleted
  assert.equal((await t.s.call('/v1/realm/delete', { id: ann.character }, ann.secret)).body.error, 'cards-held');
  // A7: the region the client names is not where it goes - the stake's own
  const before = t.gold(ann);
  const paid = await t.cashout(ann, late, { region: DF + 1 });
  assert.equal(paid.body.gold, 500, JSON.stringify(paid.body));
  assert.equal(t.gold(ann), before + 500, 'home to the region it was staked from');
  assert.equal(Number(t.row(a.id).region), DF);
  // A6: a zero receipt's settle that fails is said, never answered paid
  const b = (await t.stake(ann, { rid: 'stake-ann-a6-01' })).body;
  const db = t.s.env.DB, batch = db.batch.bind(db);
  db.batch = async () => { throw new Error('d1 down'); };
  const broke = await t.cashout(ann, await t.receipt({ s: ann.id, j: b.id, r: 0, w: 'broke' }));
  db.batch = batch;
  assert.equal(broke.body.error, 'cards-cashout-failed');
  assert.equal(t.row(b.id).status, 'held');
});

test('AUDIT CARDS-4 E6: a claim that landed, asked again at the sequence it was asked at - answered where the record stands (seq), never a quiet repeat', async () => {
  const t = await stand();
  const ann = await t.seated('ann');
  const a = (await t.stake(ann)).body;
  const rec = await t.receipt({ s: ann.id, j: a.id, r: 700, w: 'stood' });
  const where = ann.at();
  const paid = await t.s.call('/v1/cards/cashout', { character: ann.character, realm: where, receipt: rec }, ann.secret);
  assert.equal(paid.body.gold, 700);
  const again = await t.s.call('/v1/cards/cashout', { character: ann.character, realm: where, receipt: rec }, ann.secret);
  assert.equal(again.body.error, 'seq', JSON.stringify(again.body));
  assert.equal((await t.cashout(ann, rec)).body.repeat, true, 'at the record\'s own sequence: the repeat');
});
