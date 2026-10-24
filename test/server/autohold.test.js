// AUTO-HOLD (2026-10-16, Mac on the Discord reports - "copies of an item were found. Trading is frozen until staff have
// looked": "We need to figure out a better system for trade banning. I dont want to have to manually review";
// bible/06-Systems/Integrity-Arc.md AUTO-HOLD). Pinned here:
//   - A COPY LOCKS ITS PIECE, NEVER THE CHARACTER: however many copies a record shows it trades on, each copied piece
//     locked (item_dupes) and counted once a checkpoint, never a piece at a time;
//   - A CONTESTED CLAIM IS NO STRIKE: a piece handed through a chest whose giver's game died before its record saw the give
//     (the giver rejoins with it) - the receiver's copy locked, nothing counted, both characters trading;
//   - THE PIECE IS NAMED: a checkpoint answers the locked pieces' keys, the realm session tells each once, and the notice
//     names the piece from the pack (scenes/realmHoldHost.js);
//   - THE LAW'S THIRD HOLD IS TIMED: a week, a month each after it, a clean checkpoint no way out inside it and the first
//     past it lifting it; the count forgotten a month after the last finding (or the timed hold's end); staff's clear and
//     rollback reset it;
//   - 'dupe' RETIRED: a row still holding it lifts at its next checkpoint, and migration 0120 lifts every one standing
//     (written as a staff act) and turns a law hold waiting for staff into the first timed hold;
//   - THE SHOP'S SHELF never lands back a piece its reader carries, nor one piece twice (world/interior/interiorShared.js);
//   - (AUDIT) A KEY A RECORD HOLDS TWICE never leaves it, by a route or a trade - one of the two is a copy; a peer's word
//     never hands its reader a piece it carries (systems/peerWord.js notCarried); a key on another piece holds while it is
//     carried, names its piece, and is no strike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { DUPE_GRACE_S } from '../../server-account/src/ledger.js';
import { holdOf, lawCountOf, LAW_HOLD_S, LAW_HOLD_REPEAT_S, LAW_FADE_S } from '../../server-account/src/verdict.js';
import { STRIKES_FOR_TIMED } from '../../server-account/src/judge.js';
import { tradeHeldNotice, tradeHeldLawNotice, ledgerKeyOf, carriedLedgerKeys, carriedPieces, lockedPiecesOf, TRADE_HELD_NOTICES } from '../../src/systems/item/itemIds.js';
import { tradeHeldUntilNotice, heldUntilText, LOCKED_SAID_MAX, TRADE_HELD_STRIKES, takeTradeGoods } from '../../src/net/realm/realmTradeLaw.js';
import { piecesLockedNotice, wireRealmHolds, stowedKeysOf } from '../../src/scenes/realmHoldHost.js';
import { isBound, isBoundByNature, isRealmLocked, setRealmLocked, boundText, boundLine, boundTradeText, boundRefusesPut, BOUND_LINE, BOUND_TRADE_TEXT } from '../../src/systems/item/itemBound.js';
import { tradeRefusal } from '../../src/systems/tradePack.js';
import { peerHanded, notCarried } from '../../src/systems/peerWord.js';
import { ITEM_UID_RE, PROVENANCE_RE, lawTemplate } from '../../src/systems/item/itemLaw.js';
import { holdStandsSql, prepareRealmRecord } from '../../server-account/src/realm.js';
import { leavingKeys } from '../../server-account/src/ledger.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { applyInteriorLoot, applyInteriorShared, withoutCarried } from '../../src/world/interior/interiorShared.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { realmIo, createRealmSession, LEDGER_KEY_RE, REALM_LOCKED_PREFIX } from '../../src/systems/realmSaves.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { seeded } from '../honestItems.mjs';

const rare = (seed = 11, t = 113) => applyRarity(createWeapon(t, 1, seeded(7)), 'rare', seeded(seed));
const withId = (uid, seed = 11, t = 113) => ({ ...rare(seed, t), uid });
const ring = () => ({ templateIndex: 135, group: 'Jewellery', value: 80, hand: 1 });   // 'crafted': a hand on a ring no craft made
const DAY = 24 * 3600;

async function stand(env = {}) {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const seat = async (handle) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    return { who, R };
  };
  const putSave = async ({ who, R }, save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200);
    return res.json();
  };
  const put = (c, items) => putSave(c, freshSave({ name: c.who.handle, items }));
  const row = (id) => ({ ...raw.prepare('SELECT held, held_at, held_until, strikes, law_holds, law_at, dupes, judge_rev FROM realm_characters WHERE id = ?').get(id) });
  const copiesOf = (id) => raw.prepare('SELECT uid FROM item_dupes WHERE char_id = ? ORDER BY uid').all(id).map((r) => r.uid);
  const findings = (id, kind) => raw.prepare('SELECT detail FROM realm_findings WHERE char_id = ? AND kind = ? ORDER BY id').all(id, kind).map((r) => JSON.parse(r.detail));
  // a route handing the record's piece at `at` out (the one gate every service route passes - realm.js prepareRealmRecord)
  const takeOut = (c, at) => prepareRealmRecord({ db: s.env.DB, bucket: s.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: now }, c.who.id, c.R.at(),
    (save) => (takeTradeGoods(save, { items: [save.items[at]], gold: 0 }, [at]) ? null : 'gone'), { outbound: true });
  return { ...s, raw, seat, put, putSave, row, copiesOf, findings, takeOut, now: () => now, wait: (sec) => { now += sec; }, done: () => { Date.now = realNow; } };
}

test('AUTO-HOLD holdOf, pure: staff\'s stands; the law holds while it finds or a timed hold runs (never at its end); the budget only under enforce; a retired \'dupe\' lifts', () => {
  const v = { prev: null, law: 0, until: null, nowS: 1000, over: 0, enforce: false };
  assert.equal(holdOf({ ...v, prev: 'staff' }), 'staff');
  assert.equal(holdOf({ ...v, prev: 'dupe' }), null, 'retired: no verdict keeps it');
  assert.equal(holdOf({ ...v, law: 1 }), 'law');
  assert.equal(holdOf({ ...v, prev: 'law', until: 1001 }), 'law', 'timed: a clean checkpoint is no way out');
  assert.equal(holdOf({ ...v, prev: 'law', until: 1000 }), null, 'its time out: lifted');
  assert.equal(holdOf({ ...v, prev: 'law' }), null, 'a law hold untimed: a clean checkpoint lifts it');
  assert.equal(holdOf({ ...v, over: 5 }), null);
  assert.equal(holdOf({ ...v, over: 5, enforce: true }), 'budget');
});

test('AUTO-HOLD lawCountOf, pure: the third strike a week\'s hold and none counted after; each after it a month; the fade at LAW_FADE_S from the last finding - or from a timed hold\'s end, never inside it', () => {
  const n = 10_000_000;
  const none = { strikes: null, served: null, until: null, at: null };
  assert.deepEqual(lawCountOf(none, { rising: true, holding: true, nowS: n }), { strikes: 1, served: 0, until: null, at: n });
  assert.deepEqual(lawCountOf({ ...none, strikes: STRIKES_FOR_TIMED - 2, at: n }, { rising: true, holding: true, nowS: n + 5 }), { strikes: STRIKES_FOR_TIMED - 1, served: 0, until: null, at: n + 5 });
  assert.deepEqual(lawCountOf({ ...none, strikes: STRIKES_FOR_TIMED - 1, at: n }, { rising: true, holding: true, nowS: n + 5 }), { strikes: 0, served: 1, until: n + 5 + LAW_HOLD_S, at: n + 5 + LAW_HOLD_S }, 'the first: a week');
  assert.deepEqual(lawCountOf({ strikes: STRIKES_FOR_TIMED - 1, served: 1, until: null, at: n }, { rising: true, holding: true, nowS: n + 5 }), { strikes: 0, served: 2, until: n + 5 + LAW_HOLD_REPEAT_S, at: n + 5 + LAW_HOLD_REPEAT_S }, 'the next: a month');
  // the same piece carried on (no strike) inside a timed hold: the hold and its end stand, the fade counts from its end
  const timed = { strikes: 0, served: 1, until: n + LAW_HOLD_S, at: n + LAW_HOLD_S };
  assert.deepEqual(lawCountOf(timed, { rising: false, holding: true, nowS: n + DAY }), { strikes: 0, served: 1, until: n + LAW_HOLD_S, at: n + LAW_HOLD_S });
  assert.deepEqual(lawCountOf(timed, { rising: false, holding: false, nowS: n + LAW_HOLD_S }), { strikes: 0, served: 1, until: null, at: n + LAW_HOLD_S }, 'run out');
  assert.deepEqual(lawCountOf(timed, { rising: false, holding: false, nowS: n + LAW_HOLD_S + LAW_FADE_S - 1 }).served, 1, 'a second short: remembered');
  assert.deepEqual(lawCountOf(timed, { rising: false, holding: false, nowS: n + LAW_HOLD_S + LAW_FADE_S }), { strikes: 0, served: 0, until: null, at: null }, 'faded');
  assert.deepEqual(lawCountOf({ strikes: 2, served: 0, until: null, at: n }, { rising: true, holding: true, nowS: n + LAW_FADE_S }), { strikes: 1, served: 0, until: null, at: n + LAW_FADE_S }, 'two strikes a month old forgotten: this one the first');
  // AUDIT AUTO-HOLD: a piece dropped and taken up inside a timed hold is no new hold - no strike (three were a month)
  assert.deepEqual(lawCountOf(timed, { rising: true, holding: true, nowS: n + DAY }), { strikes: 0, served: 1, until: n + LAW_HOLD_S, at: n + LAW_HOLD_S });
  assert.deepEqual(lawCountOf({ ...timed, until: n + DAY }, { rising: true, holding: true, nowS: n + DAY }).strikes, 1, 'its end come: a new hold strikes again');
  // the owner's numbers, by value (AUDIT AUTO-HOLD: every pin above reads the constants themselves)
  assert.deepEqual([STRIKES_FOR_TIMED, LAW_HOLD_S, LAW_HOLD_REPEAT_S, LAW_FADE_S], [3, 7 * 86_400, 30 * 86_400, 30 * 86_400]);
});

test('AUTO-HOLD service: the law\'s third hold is TIMED - a clean checkpoint inside it holds still, the first past it lifts it, the next three a month - and the count fades a month after', async () => {
  const s = await stand();
  try {
    const A = await s.seat('ann');
    const strike = async () => { assert.equal((await s.put(A, [ring()])).tradeHeld, 'law'); return s.put(A, []); };
    for (let i = 0; i < STRIKES_FOR_TIMED - 1; i++) assert.equal((await strike()).tradeHeld, null, `strike ${i + 1}: lifted when gone`);
    const third = await strike();
    const until = s.now() + LAW_HOLD_S;
    assert.deepEqual([third.tradeHeld, third.tradeHeldWhy], ['law', { code: 'until', t: null, until }], 'the piece gone, held a week - and said so');
    assert.deepEqual(s.row(A.R.id), { ...s.row(A.R.id), held: 'law', held_until: until, strikes: 0, law_holds: 1, law_at: until });
    s.wait(LAW_HOLD_S - 1);
    assert.equal((await s.put(A, [])).tradeHeld, 'law', 'a second short: held');
    s.wait(1);
    const out = await s.put(A, []);
    assert.deepEqual([out.tradeHeld, out.tradeHeldWhy], [null, undefined], 'lifted on its own');
    assert.deepEqual([s.row(A.R.id).held_until, s.row(A.R.id).law_holds], [null, 1]);
    // three more inside the month: a month's hold
    for (let i = 0; i < STRIKES_FOR_TIMED - 1; i++) await strike();
    const again = await strike();
    assert.equal(again.tradeHeldWhy.until, s.now() + LAW_HOLD_REPEAT_S, 'a month');
    // ...served, and a month and more clean: forgotten - the next strike the first, no hold past the piece
    s.wait(LAW_HOLD_REPEAT_S + LAW_FADE_S);
    assert.equal((await s.put(A, [])).tradeHeld, null);
    assert.deepEqual([s.row(A.R.id).strikes, s.row(A.R.id).law_holds], [0, 0], 'faded');
    assert.equal((await strike()).tradeHeld, null);
    assert.equal(s.row(A.R.id).strikes, 1);
  } finally { s.done(); }
});

test('AUTO-HOLD service: a contested claim - a piece through a chest, its giver\'s game killed before its record saw the give - locks the RECEIVER\'s copy, counts nothing, holds neither; the receiver\'s next checkpoint names it', async () => {
  const s = await stand();
  try {
    const G = await s.seat('gil'), R = await s.seat('rhe');
    const k = 'a1a1a1a1a1a1a1a1';
    await s.put(G, [withId(k)]);
    // the receiver takes it from the chest and checkpoints; the giver's game dies, and it rejoins from its record - k still in it
    assert.equal((await s.put(R, [withId(k)])).tradeHeld, null);
    s.wait(DUPE_GRACE_S);
    assert.equal((await s.put(G, [withId(k)])).tradeHeld, null, 'the giver trades on');
    assert.deepEqual([s.row(G.R.id).dupes, s.row(R.R.id).dupes, s.row(R.R.id).held], [0, 0, null], 'no strike, no hold');
    assert.deepEqual(s.copiesOf(R.R.id), [k], 'the receiver\'s copy locked');
    assert.deepEqual(s.findings(R.R.id, 'dupe'), [{ keys: [k], count: 1, contested: true }]);
    const next = await s.put(R, [withId(k), withId('b2b2b2b2b2b2b2b2')]);
    assert.deepEqual([next.tradeHeld, next.locked], [null, [k]], 'named in the answer');
    assert.deepEqual((await s.put(R, [])).locked, [], 'gone from the record: nothing to name');   // PIN MOVED: AUDIT AUTO-HOLD - said as none, never left unsaid
  } finally { s.done(); }
});

test('AUTO-HOLD service: three copied pieces in one record are one incident - each locked and named, the character trading (it held the character at once)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('dov');
    const keys = ['1111111111111111', '2222222222222222', '3333333333333333'];
    const r = await s.put(A, keys.flatMap((k) => [withId(k), withId(k)]));
    assert.deepEqual([r.tradeHeld, r.locked], [null, keys]);
    assert.equal(s.row(A.R.id).dupes, 1, 'one incident');
    assert.deepEqual(s.copiesOf(A.R.id), keys);
    const again = await s.put(A, keys.flatMap((k) => [withId(k), withId(k)]));
    assert.deepEqual([again.tradeHeld, again.locked, s.row(A.R.id).dupes, s.row(A.R.id).held], [null, keys, 1, null], 'named again, never counted again - and held never');
  } finally { s.done(); }
});

test('AUTO-HOLD service: a row still held \'dupe\' lifts at its next checkpoint; staff\'s clear and rollback forget the timed hold and its count; staff\'s reads show it', async () => {
  const s = await stand({ DEVELOPER_HANDLES: 'mac' });
  try {
    const A = await s.seat('old');
    s.raw.prepare("UPDATE realm_characters SET held = 'dupe', held_at = 1 WHERE id = ?").run(A.R.id);
    assert.equal((await s.put(A, [])).tradeHeld, null);
    const mac = await s.registered('mac');
    const timed = () => s.raw.prepare("UPDATE realm_characters SET held = 'law', held_until = ?, law_holds = 2, law_at = ?, strikes = 1 WHERE id = ?").run(s.now() + DAY, s.now() + DAY, A.R.id);
    timed();
    const holds = await s.call('/v1/mod/realm-holds', {}, mac.secret);
    const listed = holds.body.characters.find((c) => c.id === A.R.id);
    assert.deepEqual([listed.held, listed.held_until, listed.law_holds, listed.strikes], ['law', s.now() + DAY, 2, 1], 'the holds list says the end and the count');
    const read = await s.call('/v1/mod/realm-findings', { id: A.R.id }, mac.secret);
    assert.deepEqual([read.body.character.heldUntil, read.body.character.lawHolds, read.body.character.dupes], [s.now() + DAY, 2, 0]);
    assert.equal((await s.call('/v1/mod/realm-clear', { id: A.R.id }, mac.secret)).status, 200);
    assert.deepEqual(s.row(A.R.id), { ...s.row(A.R.id), held: null, held_until: null, strikes: 0, law_holds: 0, law_at: null });
    timed();
    const back = await s.call('/v1/mod/realm-rollback', { id: A.R.id }, mac.secret);
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.deepEqual(s.row(A.R.id), { ...s.row(A.R.id), held: null, held_until: null, strikes: 0, law_holds: 0, law_at: null }, 'the rollback forgets it too');
  } finally { s.done(); }
});

test('AUTO-HOLD service (AUDIT): a hold a reader cannot wait out - a dead maker\'s law hold whose time is out, its last judgement finding nothing - stands no more for its crafts and its listings; any other stands', async () => {
  const s = await stand();
  try {
    const A = await s.seat('mak');
    const now = 1_000_000;
    const stands = (row) => {
      s.raw.prepare('UPDATE realm_characters SET held = ?, held_until = ?, dead_at = ?, law_sig = ? WHERE id = ?').run(row.held, row.until ?? null, row.dead ?? null, row.sig ?? null, A.R.id);
      return s.raw.prepare(`SELECT ${holdStandsSql('r', '?1')} AS v FROM realm_characters r WHERE r.id = ?2`).get(now, A.R.id).v;
    };
    assert.equal(stands({ held: 'law', until: now - 1, dead: 5 }), 0, 'dead, its week out, nothing carried: none');
    assert.equal(stands({ held: 'law', until: now, dead: 5 }), 0, 'out at its very end');
    assert.equal(stands({ held: 'law', until: now + 1, dead: 5 }), 1, 'its week still running');
    assert.equal(stands({ held: 'law', until: now - 1 }), 1, 'alive: its next checkpoint is the lift');
    assert.equal(stands({ held: 'law', until: now - 1, dead: 5, sig: 'crafted:135' }), 1, 'dead carrying what the law found');
    assert.equal(stands({ held: 'law', dead: 5 }), 1, 'an untimed law hold');
    assert.equal(stands({ held: 'staff', until: now - 1, dead: 5 }), 1, 'staff\'s');
    assert.equal(stands({ held: null }), 0);
    const realm = readFileSync(new URL('../../server-account/src/realm.js', import.meta.url), 'utf8');
    const market = readFileSync(new URL('../../server-account/src/market.js', import.meta.url), 'utf8');
    assert.match(realm, /WHERE p\.provenance = \?1 AND \$\{holdStandsSql\('r', '\?3'\)\}`\)\.bind\(provenance, playerId, Math\.floor\(Date\.now\(\) \/ 1000\)\)/, 'the craft\'s hold asks it');
    assert.match(market, /const PATRON_HELD_SQL = `EXISTS \(SELECT 1 FROM realm_characters c WHERE c\.id = l\.char_id AND c\.player = l\.seller AND \(\$\{holdStandsSql\('c', /, 'the patrons\' too');
  } finally { s.done(); }
});

test('AUTO-HOLD service (AUDIT): an answer names at most LOCKED_SAID_MAX locked pieces', async () => {
  const s = await stand();
  try {
    const A = await s.seat('mny');
    const keys = Array.from({ length: LOCKED_SAID_MAX + 2 }, (_, i) => `a${i.toString(16).padStart(15, '0')}`);
    const r = await s.put(A, keys.flatMap((k) => [withId(k), withId(k)]));
    assert.equal(r.locked.length, LOCKED_SAID_MAX);
    assert.equal(LOCKED_SAID_MAX, 200);   // PIN MOVED: AUDIT AUTO-HOLD - 40 left a record's 41st copy free on the client (the service refuses it still)
  } finally { s.done(); }
});

test('AUTO-HOLD service (AUDIT): a key a record holds TWICE never leaves it - one of the two is a copy, whichever is handed on, by a route or a trade, whatever the ledger has written down yet (each route asked only for a key GONE from the record, and one of two left unasked); a piece it holds once moves', async () => {
  const s = await stand();
  try {
    const A = await s.seat('two'), B = await s.seat('tak');
    const u = 'abababababababab', w = 'cdcdcdcdcdcdcdcd';
    await s.put(A, [withId(u), withId(u), withId(w, 12)]);
    await s.put(B, []);
    assert.deepEqual(s.copiesOf(A.R.id), [u]);
    assert.deepEqual(await s.takeOut(A, 0), { error: 'piece-dupe' }, 'one of the two, by a route');
    s.raw.prepare('DELETE FROM item_dupes WHERE char_id = ?').run(A.R.id);
    assert.deepEqual(await s.takeOut(A, 1), { error: 'piece-dupe' }, 'the other, the ledger\'s copy unwritten');
    assert.ok((await s.takeOut(A, 2)).steps, 'a piece it holds once moves');
    // the realm's own trade: the same
    const half = (c, sid, give, get, pick) => s.call('/v1/realm/trade', { ...c.R.at(), sid, give, get, pick }, c.who.secret);
    const one = { items: [JSON.parse(JSON.stringify(withId(u)))], gold: 0 }, none = { items: [], gold: 0 };
    assert.deepEqual((await half(B, 'twicetrade1', none, one, [])).body, { state: 'waiting' });
    assert.deepEqual((await half(A, 'twicetrade1', one, none, [0])).body, { state: 'refused', why: 'piece-dupe' }, 'one of the two, by a trade');
    assert.deepEqual((await half(A, 'twicetrade2', one, none, [1])).body, { state: 'waiting' });
    assert.deepEqual((await half(B, 'twicetrade2', none, one, [])).body, { state: 'refused', why: 'piece-dupe' }, 'and as the half that waited');
    const once = { items: [JSON.parse(JSON.stringify(withId(w, 12)))], gold: 0 };
    assert.deepEqual((await half(B, 'oncetrade1', none, once, [])).body, { state: 'waiting' });
    assert.equal((await half(A, 'oncetrade1', once, none, [2])).body.state, 'done', 'a piece it holds once trades');
  } finally { s.done(); }
});

test('AUTO-HOLD leavingKeys, pure (AUDIT): every key whose count fell is leaving, not only one gone; one the record held twice is `twice`', () => {
  const k = (...ks) => ks.map((key) => ({ key }));
  assert.deepEqual(leavingKeys(k('a', 'a', 'b'), k('a', 'b')), { leaving: ['a'], twice: ['a'] });
  assert.deepEqual(leavingKeys(k('a', 'b', 'c'), k('b')), { leaving: ['a', 'c'], twice: [] });
  assert.deepEqual(leavingKeys(k('a', 'a'), k('a', 'a', 'b')), { leaving: [], twice: [] }, 'arriving is no leaving');
  assert.deepEqual(leavingKeys(k('a', 'a', 'a'), k()), { leaving: ['a'], twice: ['a'] });
});

test('AUTO-HOLD service (AUDIT): a key on ANOTHER piece holds while it is carried and names that piece - and is NO STRIKE (a peer can plant one over a body or a chest: three were a week\'s hold for whoever took them up)', async () => {
  const s = await stand();
  try {
    const V = await s.seat('vic'), X = await s.seat('xan');
    const v = 'efefefefefefefef';
    await s.put(V, [withId(v, 11, 113)]);
    for (let i = 0; i < STRIKES_FOR_TIMED; i++) {
      assert.deepEqual(await s.put(X, [withId(v, 11, 120)]), { ok: true, seq: 2 + 2 * i, tradeHeld: 'law', tradeHeldWhy: { code: 'uid', t: 120 }, locked: [] }, 'held while carried, the piece it is on named');
      assert.equal((await s.put(X, [])).tradeHeld, null, 'lifted once it is gone');
    }
    assert.deepEqual([s.row(X.R.id).strikes, s.row(X.R.id).law_holds, s.row(X.R.id).held_until], [0, 0, null], 'no strike, no timed hold');
    assert.ok(s.findings(X.R.id, 'law').every((f) => f.findings.some((x) => x.code === 'uid' && x.at === v && x.t === 120)), 'each finding naming the piece');
    // with another finding beside it, the law strikes as ever
    await s.put(X, [withId(v, 11, 120), ring()]);
    assert.equal(s.row(X.R.id).strikes, 1, 'a finding of its own strikes');
  } finally { s.done(); }
});

test('AUTO-HOLD migration 0120: a hold waiting for staff on three strikes - law\'s or, AUDIT, a copies\' one over them - the first timed hold a week on, written with what it was; every other \'dupe\' hold lifted, written; every strike standing given its fade from its last finding (AUDIT: they stood for good); nothing else moved', async () => {
  const s = await stand();
  try {
    const D = await s.seat('dup'), D2 = await s.seat('dlw'), L = await s.seat('law'), K = await s.seat('kep'), F = await s.seat('few'), N = await s.seat('non');
    const set = (c, held, strikes) => s.raw.prepare('UPDATE realm_characters SET held = ?, held_at = ?, strikes = ?, held_until = NULL, law_holds = 0, law_at = NULL WHERE id = ?').run(held, held ? 777 : null, strikes, c.R.id);
    set(D, 'dupe', 0); set(D2, 'dupe', STRIKES_FOR_TIMED); set(L, 'law', STRIKES_FOR_TIMED); set(K, 'staff', STRIKES_FOR_TIMED); set(F, 'law', STRIKES_FOR_TIMED - 1); set(N, null, 0);
    const lawAt = s.now() - 40 * DAY;   // F's last law finding: the fade counts from it
    s.raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 0, 'law', '{}')").run(F.who.id, F.R.id, lawAt);
    const revs = Object.fromEntries([D, D2, L, K, F, N].map((c) => [c.who.handle, s.row(c.R.id).judge_rev]));
    const sql = readFileSync(new URL('../../server-account/migrations/0120_auto_hold.sql', import.meta.url), 'utf8');
    const dml = sql.split('\n').filter((l) => !l.startsWith('--') && !l.startsWith('ALTER TABLE')).join('\n');
    const before = Math.floor(realNowS());
    s.raw.exec(dml);
    const after = Math.ceil(realNowS());
    const week = (r) => r.held_until >= before + LAW_HOLD_S && r.held_until <= after + LAW_HOLD_S;
    assert.deepEqual([s.row(D.R.id).held, s.row(D.R.id).held_at, s.row(D.R.id).judge_rev], [null, null, revs.dup + 1]);
    assert.deepEqual(s.findings(D.R.id, 'staff'), [{ act: 'clear', by: 'auto-hold', was: 'dupe' }]);
    for (const [c, was] of [[L, 'law'], [D2, 'dupe']]) {
      const r = s.row(c.R.id);
      assert.deepEqual([r.held, r.strikes, r.law_holds, r.law_at, r.judge_rev, week(r)], ['law', 0, 1, r.held_until, revs[c.who.handle] + 1, true], `${was}: a week's hold from the migration`);
      assert.deepEqual(s.findings(c.R.id, 'staff'), [{ act: 'timed', by: 'auto-hold', was, until: r.held_until }], `${was}: written with what it was`);
    }
    assert.equal(s.row(L.R.id).held_at, 777, 'a law hold keeps the time it began');
    assert.ok(s.row(D2.R.id).held_at >= before && s.row(D2.R.id).held_at <= after, 'a copies\' hold turned the law\'s begins now');
    const k = s.row(K.R.id);
    assert.deepEqual([k.held, k.held_until, k.strikes], ['staff', null, STRIKES_FOR_TIMED], 'staff\'s own: never timed by the migration');
    assert.ok(k.law_at >= before && k.law_at <= after, 'its strikes fade from now - no finding to count from');
    const f = s.row(F.R.id);
    assert.deepEqual([f.held, f.held_until, f.strikes, f.law_at, f.judge_rev], ['law', null, STRIKES_FOR_TIMED - 1, lawAt, revs.few + 1], 'a law hold under three: its fade from its last finding');
    assert.deepEqual([s.row(N.R.id).law_at, s.row(N.R.id).judge_rev], [null, revs.non], 'no strike: untouched');
    // and that fade is the law's: a clean checkpoint a month past the finding forgets the two strikes
    assert.equal((await s.put(F, [])).tradeHeld, null);
    assert.deepEqual([s.row(F.R.id).strikes, s.row(F.R.id).law_at], [0, null]);
  } finally { s.done(); }
});
/** The wall clock the migration's SQL reads (`new Date()` is the engine's own - the stand replaces only Date.now). */
const realNowS = () => new Date().getTime() / 1000;

/** A device's storage, in memory. */
const memoryStorage = () => {
  const kept = new Map();
  return { kept, get length() { return kept.size; }, key: (i) => [...kept.keys()][i] ?? null, getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
};
/** A realm session over a scripted service: each checkpoint answered `{ ok, seq, ...answers.shift() }`. */
const scriptedSession = (answers, storage = memoryStorage()) => {
  let seq = 1;
  const io = {
    base: 'https://accounts.invalid', secret: 'x', storage, player: 'p',
    fetch: async () => { seq += 1; return new Response(JSON.stringify({ ok: true, seq, ...(answers.shift() ?? {}) }), { status: 200, headers: { 'content-type': 'application/json' } }); },
  };
  return createRealmSession({ io, id: 'rtestrtestrtestrtest', lease: 'l'.repeat(32), seq: 1 });
};

test('AUTO-HOLD client: the realm session - a timed hold heard with its end and its piece, again when its end moves, and (AUDIT) the law\'s hold it leaves behind said as one; the locked pieces told ONCE on this device across joins, the whole set kept and handed on, an answer naming none clearing it', async () => {
  const U1 = 1_800_000_000, U2 = U1 + 30 * DAY, k1 = 'c3c3c3c3c3c3c3c3', k2 = 'd4d4d4d4d4d4d4d4';
  const storage = memoryStorage();
  const session = scriptedSession([
    { tradeHeld: 'law', tradeHeldWhy: { code: 'until', t: 135, until: U1 }, locked: [k1, 'not-a-key', k1] },
    { tradeHeld: 'law', tradeHeldWhy: { code: 'until', t: null, until: U1 }, locked: [k1] },
    { tradeHeld: 'law', tradeHeldWhy: { code: 'until', t: null, until: U2 }, locked: [k1, k2] },
    { tradeHeld: 'law', tradeHeldWhy: { code: 'crafted', t: 135 }, locked: [k1, k2] },
    { tradeHeld: null, locked: [] },   // PIN MOVED: AUDIT AUTO-HOLD - every answer names the locked pieces, [] for none
  ], storage);
  const held = [], told = [], sets = [];
  session.onTradeHeld = (prev, now, why) => held.push([prev, now, why]);
  session.onPiecesLocked = (keys) => told.push(keys);
  session.onLockedKeys = (keys) => sets.push(keys);
  for (let i = 0; i < 4; i++) await session.checkpoint(JSON.stringify({ n: i }));
  assert.equal(storage.getItem(`${REALM_LOCKED_PREFIX}rtestrtestrtestrtest`), JSON.stringify([k1, k2]), 'what it told, kept on the device');
  await session.checkpoint(JSON.stringify({ n: 4 }));
  assert.deepEqual(held, [
    [null, 'law', { code: 'until', t: 135, until: U1 }],
    ['law', 'law', { code: 'until', t: null, until: U2 }],
    [null, 'law', { code: 'crafted', t: 135 }],   // AUDIT: the week out, the Ring still carried - a law hold, said as one
    ['law', null, null],
  ], 'the same end twice said once');
  assert.deepEqual(told, [[k1], [k2]], 'each once');
  assert.deepEqual(sets, [[k1], [k1], [k1, k2], [k1, k2], []], 'the whole set each landing, none at the last');
  assert.deepEqual([session.lockedKeys, storage.kept.has(`${REALM_LOCKED_PREFIX}rtestrtestrtestrtest`)], [[], false], 'an answer naming none: none locked, nothing kept');
  assert.equal(session.landedText, JSON.stringify({ n: 4 }), 'the last save the realm took');
  // what the player hears of those moves
  assert.equal(tradeHeldNotice(null, 'law', held[0][2]), tradeHeldUntilNotice(U1, 'Ring'));
  assert.match(tradeHeldNotice(null, 'law', held[0][2]), /the last over a Ring it carries\. Its trading is frozen until .*, and after that until the Ring is gone\.$/);
  assert.equal(tradeHeldNotice('law', 'law', held[1][2]), tradeHeldUntilNotice(U2), 'a timed hold re-said with its new end');
  assert.match(tradeHeldUntilNotice(U2), /^This character has been held 3 times\. Its trading is frozen until .*, then reopens on its own\.$/);
  assert.equal(tradeHeldNotice(null, 'law', held[2][2]), tradeHeldLawNotice('Ring'));
  assert.equal(tradeHeldNotice(null, 'law', { code: 'until', t: null, until: 'soon' }), TRADE_HELD_NOTICES.law, 'an end that is no time is no timed hold');
  // a second join on this device: what it told is told no more
  const again = scriptedSession([{ tradeHeld: null, locked: [k1, k2] }, { tradeHeld: null, locked: [k1, k2, 'e5e5e5e5e5e5e5e5'] }], (() => { const st = memoryStorage(); st.setItem(`${REALM_LOCKED_PREFIX}rtestrtestrtestrtest`, JSON.stringify([k1, k2])); return st; })());
  assert.deepEqual(again.lockedKeys, [k1, k2], 'kept from the last join, before any answer');
  const told2 = [];
  again.onPiecesLocked = (keys) => told2.push(keys);
  await again.checkpoint('{}');
  await again.checkpoint('{}');
  assert.deepEqual(told2, [['e5e5e5e5e5e5e5e5']]);
  // AUDIT: an answer saying nothing of them (a service mid-deploy, before every answer named them) leaves them standing
  const sets2 = [];
  again.onLockedKeys = (keys) => sets2.push(keys);
  await again.checkpoint('{}');
  assert.deepEqual([again.lockedKeys, sets2, told2.length], [[k1, k2, 'e5e5e5e5e5e5e5e5'], [], 1], 'kept, unbound by nothing');
  // and never more than an answer names
  const many = scriptedSession([{ tradeHeld: null, locked: Array.from({ length: LOCKED_SAID_MAX + 5 }, (_, i) => `b${i.toString(16).padStart(15, '0')}`) }]);
  await many.checkpoint('{}');
  assert.equal(many.lockedKeys.length, LOCKED_SAID_MAX);
  assert.deepEqual([LEDGER_KEY_RE.source, LEDGER_KEY_RE.source], [ITEM_UID_RE.source, PROVENANCE_RE.source], 'a key as the ledger keys a piece');
});

test('AUTO-HOLD client: over the real Worker, the third strike heard timed with its piece; the notices name every locked piece, accuse no one, and count what they cannot name; the wiring binds the locked and reads the stowed', async () => {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  try {
    const s = await standService();
    const who = await s.registered('told');
    const R = await seatRealm(s.env, who.secret, 'told');
    const kept = new Map([[SESSION_KEY, JSON.stringify({ id: who.id, secret: who.secret })]]);
    const storage = { get length() { return kept.size; }, key: (i) => [...kept.keys()][i] ?? null, getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
    const at = R.at();
    const session = createRealmSession({ io: realmIo({ fetch: (u, i) => worker.fetch(new Request(u, i), s.env), storage }), id: at.id, lease: at.lease, seq: at.seq });
    const held = [];
    session.onTradeHeld = (prev, now2, why) => held.push([prev, now2, why]);
    for (let i = 0; i < STRIKES_FOR_TIMED; i++) {
      await session.checkpoint(JSON.stringify(freshSave({ name: 'told', items: [ring()] })));
      await session.checkpoint(JSON.stringify(freshSave({ name: 'told' })));
    }
    const until = now + LAW_HOLD_S;
    assert.deepEqual(held.at(-1), [null, 'law', { code: 'until', t: 135, until }], 'the third: timed, said with its end and the piece');
    assert.deepEqual(session.tradeHeldWhy, { code: 'until', t: null, until }, 'the piece gone: the same hold, its end kept for a refusal to say - and not said again');
  } finally { Date.now = realNow; }
  // the notice: each locked piece named from the pack - a key it shows twice, twice - and those it cannot name counted
  const a = withId('e5e5e5e5e5e5e5e5'), a2 = { ...withId('e5e5e5e5e5e5e5e5') }, b = withId('f6f6f6f6f6f6f6f6', 12);
  const entity = { items: [a, a2], wagonItems: [b] };
  assert.deepEqual(lockedPiecesOf(entity, ['f6f6f6f6f6f6f6f6', 'e5e5e5e5e5e5e5e5', '0000000000000009']), { pieces: [a, a2, b], unfound: 1 });
  assert.deepEqual(lockedPiecesOf(entity, ['f6f6f6f6f6f6f6f6']), { pieces: [b], unfound: 0 });
  const tail = 'Your other pieces and your trading are not affected.';
  assert.equal(piecesLockedNotice([itemLongName(b)], 1), `The realm has locked your ${itemLongName(b)}: it found the same piece somewhere else too. It stays with you and cannot be traded, sold, dropped or stored where others can take it. ${tail}`);
  assert.match(piecesLockedNotice([], 1), /^The realm has locked one of your pieces: it found the same piece somewhere else too\. It stays with you/);
  assert.match(piecesLockedNotice([], 6), /^The realm has locked 6 of your pieces: it found the same pieces somewhere else too\. They stay with you and cannot be traded/);
  assert.match(piecesLockedNotice(['A', 'B', 'C', 'D'], 6), /^The realm has locked 6 of your pieces \(A, B, C and 3 more\): it found the same pieces somewhere else too\./);
  assert.match(piecesLockedNotice(['A', 'B'], 2), /^The realm has locked 2 of your pieces \(A, B\): /);
  assert.equal(piecesLockedNotice([], 0), null);
  for (const text of [piecesLockedNotice(['A'], 1), piecesLockedNotice(['A', 'B'], 3)]) assert.doesNotMatch(text, /copy of your|copies of|was found|were found/i, 'it says what happened, and accuses no one');
  // the wiring: the notices, the locked pieces bound while they are, the stowed read off the last save the realm took
  const said = [];
  const rented = withId('7b7b7b7b7b7b7b7b', 13);
  const save = { items: [withId('8a8a8a8a8a8a8a8a')], rentedRooms: [{ mapId: 1, buildingKey: 2 }], sceneCache: { scenes: [{ sceneName: 'DaggerfallInterior [MapID=1, BuildingKey=2]', lootContainers: [{ items: [rented] }] }] } };
  const session = { lockedKeys: ['e5e5e5e5e5e5e5e5'], landedText: JSON.stringify(save) };
  wireRealmHolds(session, { say: (t) => said.push(t), entity });
  try {
    assert.equal(isRealmLocked(a), true, 'the set kept from the last join, bound at once');
    session.onPiecesLocked(['e5e5e5e5e5e5e5e5']);
    session.onTradeHeld('law', 'law', { code: 'until', t: null, until: 1_800_000_000 });
    session.onTradeHeld('law', null, null);
    assert.deepEqual(said, [piecesLockedNotice([itemLongName(a), itemLongName(a2)], 2), tradeHeldUntilNotice(1_800_000_000), 'This character\'s trading is open again.']);
    session.onLockedKeys(['f6f6f6f6f6f6f6f6']);
    assert.deepEqual([isRealmLocked(a), isRealmLocked(b)], [false, true], 'the set as the last answer named it');
    assert.deepEqual([...carriedPieces(entity).stowed], ['7b7b7b7b7b7b7b7b'], 'a rented room\'s chest - never the pack\'s, which the live pack says');
    session.landedText = 'not json';
    assert.deepEqual([...carriedPieces(entity).stowed], [], 'a save that does not read: nothing stowed');
    // AUDIT: a peer's word never hands the reader a piece it carries (a griefer's grant of a key it saw on the wire)
    const other = withId('9c9c9c9c9c9c9c9c', 14);
    assert.deepEqual(notCarried([withId('f6f6f6f6f6f6f6f6', 12), other]), [other], 'one it carries: never landed');
    assert.equal(notCarried(null), null, 'a refusal stays one');
  } finally { wireRealmHolds(null, { say: () => {}, entity: null }); }
  assert.deepEqual([isRealmLocked(b), [...carriedPieces(entity).stowed], notCarried([b, b]).length], [false, [], 2], 'offline: nothing locked, nothing stowed, nothing filtered');
  // and every door a peer's word lands a piece through asks it (by source): a body's grant, a room's give, a body restored
  const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(src('../../src/scenes/bodyLootHost.js'), /const grant = notCarried\(peerHanded\(validLootList\(data\.grant\)\)\);/);   // PIN MOVED (OUTDOOR-LOOT): the legacy grant's landing is the body block's, the line as it was
  assert.match(src('../../src/scenes/roomLootHost.js'), /function roomGive\(item, n\) \{\n    if \(n <= 0\) return;\n    if \(!notCarried\(\[item\]\)\?\.length\) return;/);
  assert.match(src('../../src/scenes/dungeonContext.js'), /else if \(sf\.items != null\) \{ const li = notCarried\(peerHanded\(validLootList\(sf\.items\)\)\); if \(li\) f\.entity\.items = li; \}/);
  // its end, written the game's language's way (the tests' English) - its own clock, never the wire's milliseconds
  assert.equal(heldUntilText(1_800_000_000), new Date(1_800_000_000_000).toLocaleString('en', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
  // AUDIT: no refusal says a review will come
  const refusal = accountRefusalText('trade-held');
  assert.equal(typeof refusal === 'function' ? refusal() : refusal, 'This character\'s trading is frozen. The notice shown when it froze says why, and until when.');
  assert.match(TRADE_HELD_STRIKES, /^ Holds add up: from the third, trading stays frozen for a week even after it is gone, and for a month each time after that\.$/);
  // the host wires it at one line (HOST-SPLIT)
  const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /^  wireRealmHolds\(realmSession, \{ say: \(t\) => townTalk\.say\(t\), entity: playerEntity \}\);$/m);
});

test('AUTO-HOLD client (AUDIT): A PIECE THE REALM LOCKED STAYS WITH ITS HOLDER - bound while it is, every door a binding closes closed to it (a counter, a trade, the ground, a room\'s container, a peer\'s word), in its own words; the wagon and the player\'s own storage still take it', () => {
  const piece = withId('9d9d9d9d9d9d9d9d'), craft = { ...rare(14), provenance: 'abababababababab' }, free = withId('1e1e1e1e1e1e1e1e');
  const stone = { templateIndex: lawTemplateIndexBound(), bound: true };
  try {
    setRealmLocked(['9d9d9d9d9d9d9d9d', 'abababababababab']);
    assert.deepEqual([isRealmLocked(piece), isRealmLocked(craft), isRealmLocked(free)], [true, true, false], 'by its key - an id, or a craft\'s provenance');
    assert.deepEqual([isBound(piece), isBoundByNature(piece), isBound(free)], [true, false, false]);
    assert.equal(boundText('Dagger', piece), 'Dagger is locked by the realm because the same piece was found somewhere else too. It stays with you and cannot be dropped, traded, sold or stored where others can take it.');
    assert.equal(boundText('Stone', stone), 'Stone is bound to you. It cannot be dropped, traded or sold.', 'a binding of its nature says so');
    assert.equal(boundLine(piece), 'Locked by the realm. It stays with you and cannot be dropped, traded, sold or stored where others can take it.');
    assert.deepEqual([boundLine(stone), boundLine(free)], [BOUND_LINE, null]);
    assert.deepEqual([boundTradeText(piece), boundTradeText(stone)], ['A piece the realm locked cannot be traded.', BOUND_TRADE_TEXT]);
    assert.equal(tradeRefusal(piece), 'A piece the realm locked cannot be traded.');
    assert.deepEqual(['loot', 'dropped', 'corpse', 'wagon', 'storage'].map((kind) => boundRefusesPut(piece, kind)), [true, true, true, false, false]);
    assert.deepEqual(peerHanded([piece, free]), [free], 'a peer\'s word never hands a reader a piece it holds locked');
    setRealmLocked([]);
    assert.deepEqual([isBound(piece), boundLine(piece), tradeRefusal(piece) === null || typeof tradeRefusal(piece) === 'string'], [false, null, true], 'unlocked: as any piece');
  } finally { setRealmLocked([]); }
  // every door passes the piece, so the refusal can say which law refused it
  const rd = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
  assert.match(rd('ui/native/nativeTrade.js'), /boundText\(itemLongName\(item, \{ getQuest: this\.hooks\.getQuest \?\? null \}\), item\)/);
  assert.match(rd('ui/enhanced/enhancedTrade.js'), /boundText\(itemLine\(item, deps\.entity\)\.name, item\)/);
  assert.match(rd('ui/enhanced/enhancedInventory.js'), /notice = boundText\(itemLongName\(item, \{ getQuest: deps\.getQuest \?\? null \}\), item\);/);
  assert.match(rd('ui/enhanced/enhancedInventory.js'), /const bline = boundLine\(picked\);/);
  assert.match(rd('ui/native/nativeInventory.js'), /this\._refuse\(\{ text: boundText\(itemLongName\(it, \{ getQuest: this\.hooks\.getQuest \?\? null \}\), it\) \}\);/);
  assert.match(rd('systems/physicalItems.js'), /boundText\(name\(\), item\)/);
  assert.match(rd('systems/tradePack.js'), /if \(isBound\(item\)\) return boundTradeText\(item\);/);
});
/** A template the game binds by its nature (the Sigil Stone's - systems/item/itemBound.js SS1). */
const lawTemplateIndexBound = () => { for (let i = 0; i < 4096; i++) if (lawTemplate(i)?.bound === true) return i; return -1; };

test('AUTO-HOLD shelf: the room\'s word never lands back a piece its reader carries, nor one piece twice - and (AUDIT) a SHOP\'S SHELF never one it stowed, while a container (a rented room\'s chest, its stowage) still lands its own; a shelf never opened here too; a piece the ledger does not follow lands as it always did; every landing hands it the pack\'s keys', () => {
  const k = '7a7a7a7a7a7a7a7a', away = '6c6c6c6c6c6c6c6c';
  const wire = (it) => JSON.parse(JSON.stringify(it));
  const plain = createWeapon(113, 1, seeded(7));   // no tier: a piece the ledger does not follow
  const shelf = { items: [] };
  const ctx = { shelves: [shelf, { items: null }], containers: [{ items: [] }] };
  const word = [{ k: 'shelf:0', r: [wire(withId(k)), wire(plain), wire(withId('8b8b8b8b8b8b8b8b', 12)), wire(withId('8b8b8b8b8b8b8b8b', 12)), wire(withId(away, 13))], d: 1 }];
  const carried = { ...carriedPieces({ items: [withId(k)] }), stowed: new Set([away]) };
  assert.deepEqual([[...carried.keys], carried.keyOf], [[k], ledgerKeyOf]);
  assert.deepEqual([...carriedLedgerKeys({ items: [withId(k)], wagonItems: [withId('9c9c9c9c9c9c9c9c', 12)] })], [k, '9c9c9c9c9c9c9c9c']);
  assert.equal(applyInteriorLoot(ctx, word, { carried }), 1);
  assert.deepEqual(shelf.items.map(ledgerKeyOf), [null, '8b8b8b8b8b8b8b8b'], 'mine not back, nor what I stowed; the twice-named once; the plain piece as it was');
  assert.equal(shelf.items[0].templateIndex, 113);
  // a shelf never opened here takes the word whole - filtered the same (AUDIT: its branch unpinned)
  applyInteriorLoot(ctx, [{ ...word[0], k: 'shelf:1' }], { carried });
  assert.deepEqual(ctx.shelves[1].items.map(ledgerKeyOf), [null, '8b8b8b8b8b8b8b8b']);
  // a container may be the reader's own stowage: what it stowed lands there - what it carries never
  applyInteriorLoot(ctx, [{ ...word[0], k: 'container:0' }], { carried });
  assert.deepEqual(ctx.containers[0].items.map(ledgerKeyOf), [null, '8b8b8b8b8b8b8b8b', away]);
  // nothing carried: the word lands whole, twice-named once; no rule handed in, as it came
  applyInteriorLoot(ctx, word, { carried: carriedPieces({}) });
  assert.deepEqual(shelf.items.map(ledgerKeyOf), [k, null, '8b8b8b8b8b8b8b8b', away]);
  applyInteriorLoot(ctx, word);
  assert.deepEqual(shelf.items.map(ledgerKeyOf), [k, null, '8b8b8b8b8b8b8b8b', '8b8b8b8b8b8b8b8b', away]);
  // the memory's landing hands it on
  const shelf2 = { items: [] };
  assert.equal(applyInteriorShared({ shelves: [shelf2], containers: [], actions: null }, { locationKey: 'L', stamp: 'x', world: { loot: word, actions: [] } }, { locationKey: 'L', stamp: 'y', carried }), true);
  assert.deepEqual(shelf2.items.map(ledgerKeyOf), [null, '8b8b8b8b8b8b8b8b']);
  assert.equal(withoutCarried([withId(k), withId(k)], carriedPieces(null)).length, 1);
  assert.equal(withoutCarried([withId(k), withId(k)], null).length, 2);
  assert.deepEqual(withoutCarried([withId(away)], carried).map(ledgerKeyOf), [away], 'stowed keys only where asked');
  // the stowed: what a save holds beyond its own five lists, as the judge reads it
  const boat = withId('5d5d5d5d5d5d5d5d', 14);
  assert.deepEqual([...stowedKeysOf({ items: [withId(k)], modData: { 'come-sail-away': { placedBoats: [{ Items: [boat] }] } } })], ['5d5d5d5d5d5d5d5d']);
  assert.deepEqual([...stowedKeysOf(null)], []);
  const modes = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.equal(modes.match(/carried: carriedPieces\(playerEntity\)/g)?.length, 2, 'both landings');
  assert.match(modes, /applyInteriorShared\(interiorCtx, shared, \{ \.\.\._intShared, today: stockedToday\(\), carried: carriedPieces\(playerEntity\) \}\)/);
  assert.match(modes, /applyInteriorLoot\(interiorCtx, data\.l, \{ \.\.\._intShared, from: id, today: stockedToday\(\), carried: carriedPieces\(playerEntity\) \}\)/);   // PIN MOVED (OUTDOOR-LOOT): the bag whole (its set of the unreadable, its room) and the sender, beside the pieces I carry
  // AUDIT: and a dungeon's - a search's find, a pile - with what I carry (never the stowed: a dungeon holds none of mine)
  assert.match(readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8'), /for \(const it of withoutCarried\(items, carriedPieces\(playerEntity\)\)\) held\.push\(it\);/);
  // the pure half never loads the item law: its registration changes what every reader of the wire lands
  assert.doesNotMatch(readFileSync(new URL('../../src/world/interior/interiorShared.js', import.meta.url), 'utf8'), /from '[^'\n]*\/(itemIds|itemLaw)\.js'/);   // TIDY: any depth - interiorShared stands in world/interior/
});
