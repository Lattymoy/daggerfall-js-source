// INT4 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Realm-Arc section 4: "Valuable items get a
// service-issued id ... The same id in two records freezes both for review"): A VALUABLE PIECE'S ID, AND THE LEDGER.
// PIN MOVED (its audit, the same day): the ledger rebuilt (server-account/src/ledger.js) - the FIRST HOLDER KEEPS a piece,
// another record showing it CLAIMS it, and a claim the holder's checkpoint outlasts by DUPE_GRACE_S is a COPY charged to
// the CLAIMANT (the audit: an id stamped on the victim's piece took the VICTIM's trade); a piece let go is no row; the
// service's own moves move the ledger; a crafted piece's copy is told by its `products` owner; the statements bounded.
//   - the client: which pieces earn an id (systems/itemIds.js valuablePiece), the id's shape, the stamp over the
//     character's own five lists (never a stack, a bound piece or one stamped already), and what the player is told as
//     the judge's hold moves - the piece named when the law holds it;
//   - the service, through real checkpoints: a new key taken; let go (no row) and taken up by another; a claim moved by
//     its holder's letting go; a claim outlasted - the claimant charged, its copy written down, the holder's piece the
//     holder's to sell; a key on another piece a law finding, never a claim; a key twice in one record its own copy;
//     DUPES_FOR_HOLD copies held for staff, and a law breach no way out; a claimed piece moved by no route; the service's
//     moves (escrow, delivery) and a crafted piece's owner; a character gone lets go; and the statements bounded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server-account/src/index.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm, freshSave } from './realmSeat.mjs';
import { valuablePiece, mintItemId, stampItemIds, tradeHeldNotice, tradeHeldLawNotice, TRADE_HELD_NOTICES, TRADE_OPEN_NOTICE } from '../src/systems/itemIds.js';
import { DUPES_FOR_HOLD, DUPE_GRACE_S, LEDGER_NEW_MAX, UPSERT_ROWS, UID_CHUNK, ledgerStep, releaseSteps } from '../server-account/src/ledger.js';
import { prepareRealmRecord } from '../server-account/src/realm.js';
import { takeTradeGoods, giveTradeGoods } from '../src/net/realmTradeLaw.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { applyRarity } from '../src/systems/lootRarity.js';
import { letterOfCredit } from '../src/systems/inventory.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { seeded } from './honestItems.mjs';
import { readFileSync } from 'node:fs';
import { SESSION_KEY } from '../src/net/accountClient.js';
import { realmIo, createRealmSession } from '../src/systems/realmSaves.js';

const rare = (seed = 11, t = 113) => applyRarity(createWeapon(t, 1, seeded(7)), 'rare', seeded(seed));
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

test('INT3 client: the hold said as it moves - its reason when it falls, the piece named when the law holds it (AUDIT INT: an honest player was never told which), "open again" when it lifts, nothing when it stands or nothing is known', () => {
  assert.equal(tradeHeldNotice(null, 'law'), TRADE_HELD_NOTICES.law);
  assert.equal(tradeHeldNotice(null, 'law', { code: 'affixes', t: 113 }), tradeHeldLawNotice(templateByIndex(113).name));
  assert.match(tradeHeldNotice(null, 'law', { code: 'affixes', t: 113 }), new RegExp(templateByIndex(113).name));
  assert.equal(tradeHeldNotice(null, 'law', { code: 'level', t: null }), TRADE_HELD_NOTICES.law, 'the character\'s own finding names no piece');
  assert.equal(tradeHeldNotice(null, 'dupe', { t: 113 }), TRADE_HELD_NOTICES.dupe, 'only the law\'s names one');
  assert.equal(tradeHeldNotice('law', 'dupe'), TRADE_HELD_NOTICES.dupe);
  assert.equal(tradeHeldNotice('law', null), TRADE_OPEN_NOTICE);
  assert.equal(tradeHeldNotice(null, null), null);
  assert.equal(tradeHeldNotice('law', 'law'), null);
  assert.equal(tradeHeldNotice('law', undefined), null);
});

async function stand() {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService();
  const raw = s.env.DB._raw;
  const seat = async (handle) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    return { who, R };
  };
  const putRaw = async ({ who, R }, save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) },
      body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200, 'the checkpoint lands - a verdict never refuses the save');
    return res.json();
  };
  const put = async (c, items) => (await putRaw(c, freshSave({ name: c.who.handle, items }))).tradeHeld;
  const ledger = (uid) => { const r = raw.prepare('SELECT char_id, state, claim_char FROM item_uids WHERE uid = ?').get(uid); return r ? { ...r } : null; };
  const copiesOf = (id) => raw.prepare('SELECT uid FROM item_dupes WHERE char_id = ? ORDER BY uid').all(id).map((r) => r.uid);
  const dupes = (id) => raw.prepare('SELECT dupes FROM realm_characters WHERE id = ?').get(id).dupes;
  const ctx = () => ({ db: s.env.DB, bucket: s.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: now });
  const takeOut = (c, at = 0, o = { outbound: true }) => prepareRealmRecord(ctx(), c.who.id, c.R.at(), (save) => (takeTradeGoods(save, { items: [save.items[at]], gold: 0 }, [at]) ? null : 'gone'), o);
  const land = async (prep) => { assert.ok(!prep.error, JSON.stringify(prep)); await s.env.DB.batch(prep.steps); };
  return { ...s, raw, seat, put, putRaw, ledger, copiesOf, dupes, ctx, takeOut, land, wait: (sec) => { now += sec; }, done: () => { Date.now = realNow; } };
}
const withId = (uid, seed = 11, t = 113) => ({ ...rare(seed, t), uid });

test('INT4 service: a new key taken; let go - no row; taken up by another; shown while its holder holds it, CLAIMED, and the holder\'s letting it go moves it to the claimant - no witness needed', async () => {
  const s = await stand();
  try {
    const A = await s.seat('ann'), B = await s.seat('bea'), C = await s.seat('cai');
    const u1 = '1111111111111111', u2 = '2222222222222222';
    await s.put(A, [withId(u1), withId(u2, 12)]);
    assert.deepEqual(s.ledger(u1), { char_id: A.R.id, state: 'held', claim_char: null });
    await s.put(A, [withId(u2, 12)]);
    assert.equal(s.ledger(u1), null, 'let go: no row (AUDIT INT: the ledger kept every piece ever seen)');
    await s.put(B, [withId(u1)]);
    assert.deepEqual(s.ledger(u1), { char_id: B.R.id, state: 'held', claim_char: null });
    await s.put(C, [withId(u1)]);
    assert.deepEqual(s.ledger(u1), { char_id: B.R.id, state: 'held', claim_char: C.R.id }, 'claimed');
    await s.put(B, []);
    assert.deepEqual(s.ledger(u1), { char_id: C.R.id, state: 'held', claim_char: null }, 'its holder let it go: it moved');
    assert.deepEqual([s.dupes(A.R.id), s.dupes(B.R.id), s.dupes(C.R.id)], [0, 0, 0]);
  } finally { s.done(); }
});

test('INT4 service: a claim its holder outlasts is a COPY, the CLAIMANT\'s - counted on its row, written down, moved by no route; the holder\'s piece stays the holder\'s to sell (AUDIT INT: the holder was charged, and the copier sold first)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('ann'), C = await s.seat('cai');
    const u = '3333333333333333';
    await s.put(A, [withId(u)]);
    await s.put(C, [withId(u)]);
    assert.equal(s.ledger(u).claim_char, C.R.id);
    // while the claim waits, the piece moves by no route - neither side's (AUDIT INT: the contested piece sold first)
    assert.deepEqual(await s.takeOut(C), { error: 'piece-claimed' });
    assert.deepEqual(await s.takeOut(A), { error: 'piece-claimed' });
    // within the grace, the holder's checkpoint still holding it proves nothing (a checkpoint in flight as it dropped)
    s.wait(DUPE_GRACE_S - 10);
    await s.put(A, [withId(u)]);
    assert.equal(s.ledger(u).claim_char, C.R.id);
    s.wait(20);
    await s.put(A, [withId(u)]);
    assert.deepEqual(s.ledger(u), { char_id: A.R.id, state: 'held', claim_char: null }, 'the holder keeps it');
    assert.deepEqual([s.dupes(A.R.id), s.dupes(C.R.id)], [0, 1], 'the claimant counts the copy');
    assert.deepEqual(s.copiesOf(C.R.id), [u]);
    assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM realm_findings WHERE char_id = ? AND kind = 'dupe'").get(C.R.id).n, 1, 'and its finding');
    assert.deepEqual(await s.takeOut(C), { error: 'piece-dupe' }, 'the copy moves by no route');
    const sold = await s.takeOut(A, 0, { outbound: true, escrow: true });
    assert.ok(!sold.error, 'the holder\'s piece sells');
    // the copy shown again is charged never twice
    await s.put(C, [withId(u)]);
    assert.equal(s.dupes(C.R.id), 1);
  } finally { s.done(); }
});

test('INT4 service: a key on ANOTHER piece is no claim - the record showing it holds a forged id (a law finding), and the holder never hears of it (AUDIT INT: an id read off a listing and stamped on a dagger held its owner\'s trade)', async () => {
  const s = await stand();
  try {
    const V = await s.seat('vic'), X = await s.seat('xan');
    const u = '4444444444444444';
    await s.put(V, [withId(u, 11, 113)]);
    const held = await s.put(X, [withId(u, 11, 120)]);   // the victim's id on a piece of another template
    assert.equal(held, 'law');
    assert.deepEqual(s.ledger(u), { char_id: V.R.id, state: 'held', claim_char: null }, 'no claim');
    const f = JSON.parse(s.raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'law'").get(X.R.id).detail);
    assert.ok(f.findings.some((x) => x.code === 'uid' && x.at === u));
    s.wait(DUPE_GRACE_S * 2);
    assert.equal(await s.put(V, [withId(u, 11, 113)]), null, 'the victim\'s trade untouched');
    assert.equal(s.dupes(V.R.id), 0);
  } finally { s.done(); }
});

test('INT4 service: a key twice in one record is its own copy at once; DUPES_FOR_HOLD copies and the trade is held for staff - and stays held, a law breach no way out (AUDIT INT: a \'law\' checkpoint stepped the hold down, and the next clean one lifted it)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('dov');
    for (let i = 0; i < DUPES_FOR_HOLD; i++) {
      const u = `${i + 1}`.repeat(16);
      const held = await s.put(A, [withId(u), withId(u)]);
      assert.equal(held, i + 1 >= DUPES_FOR_HOLD ? 'dupe' : null, `copy ${i + 1}`);
    }
    assert.equal(s.dupes(A.R.id), DUPES_FOR_HOLD);
    assert.equal(await s.put(A, [{ ...rare(), affixes: [] }]), 'dupe', 'a lawless checkpoint keeps the copies\' hold');
    assert.equal(await s.put(A, []), 'dupe', 'and a clean one: staff alone lift it');
  } finally { s.done(); }
});

test('INT4 service: the service\'s own moves move the ledger - a piece listed is in ESCROW (its seller still showing it claims it), a piece delivered is its taker\'s whoever showed it, a piece spent is no row', async () => {
  const s = await stand();
  try {
    const S1 = await s.seat('sel'), B = await s.seat('buy');
    const u = '5555555555555555';
    await s.put(S1, [withId(u)]);
    await s.land(await s.takeOut(S1, 0, { outbound: true, escrow: true }));
    assert.deepEqual(s.ledger(u), { char_id: '', state: 'escrow', claim_char: null }, 'the market\'s');
    // a seller that kept a copy shows it: a claim on the market's piece
    await s.put(S1, [withId(u)]);
    assert.equal(s.ledger(u).claim_char, S1.R.id);
    // the market hands it to its buyer (a delivery collected - the service's word): the buyer's, the seller's claim standing
    const give = await prepareRealmRecord(s.ctx(), B.who.id, B.R.at(), (save) => { giveTradeGoods(save, [withId(u)], 0); return null; });
    await s.land(give);
    assert.deepEqual(s.ledger(u), { char_id: B.R.id, state: 'held', claim_char: S1.R.id });
    s.wait(DUPE_GRACE_S + 1);
    await s.put(B, [withId(u)]);
    assert.deepEqual([s.dupes(S1.R.id), s.dupes(B.R.id)], [1, 0], 'the seller kept a copy: the seller\'s, never the buyer\'s');
    assert.deepEqual(s.ledger(u), { char_id: B.R.id, state: 'held', claim_char: null });
    // spent (a payment, a disenchant): no row
    await s.land(await s.takeOut(B));
    assert.equal(s.ledger(u)?.state, 'gone', 'a piece a copy of is known is kept gone, so the copy cannot take it up');
    await s.put(S1, [withId(u)]);
    assert.equal(s.ledger(u)?.char_id === S1.R.id && s.ledger(u)?.state === 'held', false, 'the copy takes nothing up');
  } finally { s.done(); }
});

test('INT4 service: a CRAFTED piece\'s key is its provenance, and its copy is told by the craft\'s own record - a seller that kept a sold piece is the copier, the piece goes to its buyer', async () => {
  const s = await stand();
  try {
    const S1 = await s.seat('smi'), B = await s.seat('pur');
    const p = 'abcdef0123456789';
    s.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, credited)
      VALUES (?, ?, ?, NULL, 'longsword:steel', 113, 1, 2, 7, 'p1..', ?, 1)`).run(p, S1.who.id, S1.R.id, T0);
    const piece = { ...createWeapon(113, 1, seeded(7)), material: 1, quality: 2, provenance: p, uid: '6666666666666666' };
    await s.put(S1, [piece]);
    assert.equal(s.ledger(p).char_id, S1.R.id, 'keyed by its provenance, never the client\'s id');
    assert.equal(s.ledger('6666666666666666'), null);
    // sold at the market: the craft's record moves to the buyer (market.js), and the seller's save keeps it
    s.raw.prepare('UPDATE products SET owner = ?, credited = 0 WHERE provenance = ?').run(B.who.id, p);
    await s.put(B, [piece]);
    assert.equal(s.ledger(p).claim_char, B.R.id);
    s.wait(DUPE_GRACE_S + 1);
    await s.put(S1, [piece]);
    assert.deepEqual(s.ledger(p), { char_id: B.R.id, state: 'held', claim_char: null }, 'the buyer\'s');
    assert.deepEqual([s.dupes(S1.R.id), s.dupes(B.R.id)], [1, 0], 'the seller kept it: the copy is the seller\'s');
  } finally { s.done(); }
});

test('INT4 service: a character gone lets go - its claims withdrawn, what it held no record\'s (an heir takes it up)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('old'), B = await s.seat('hei');
    const u1 = '7777777777777777', u2 = '8888888888888888';
    await s.put(B, [withId(u2)]);
    await s.put(A, [withId(u1), withId(u2)]);
    assert.equal(s.ledger(u2).claim_char, A.R.id);
    await s.env.DB.batch(releaseSteps(s.env.DB, A.R.id, 1));
    assert.equal(s.ledger(u1), null);
    assert.equal(s.ledger(u2).claim_char, null);
    await s.put(B, [withId(u2), withId(u1)]);
    assert.equal(s.ledger(u1).char_id, B.R.id);
  } finally { s.done(); }
});

test('INT4 service: THE STATEMENTS BOUNDED (AUDIT INT: one a key, every checkpoint, past D1\'s thousand at ~985 keys) - a first judgement of LEDGER_NEW_MAX keys in a few dozen, the rest the next; a record held still writes nothing', async () => {
  const s = await stand();
  try {
    const A = await s.seat('big');
    const n = LEDGER_NEW_MAX + 40;
    const pieces = Array.from({ length: n }, (_, i) => ({ key: i.toString(16).padStart(16, '0'), fp: '113:1' }));
    const at = { player: A.who.id, char: A.R.id, seq: 5, nowS: T0 };
    let reads = 0;
    const db = s.env.DB;
    // the database, its reads counted
    const read = (/** @type {any} */ t) => new Proxy(t, { get(o, k) { const v = o[k]; if (k === 'all' || k === 'first') return async (...x) => { reads++; return v.apply(o, x); }; return typeof v === 'function' ? v.bind(o) : v; } });
    const counted = { prepare: (sql) => { const st = db.prepare(sql); return { bind: (...a) => read(st.bind(...a)) }; } };
    const first = await ledgerStep(counted, at, pieces);
    assert.deepEqual([LEDGER_NEW_MAX, UPSERT_ROWS, UID_CHUNK], [960, 48, 90]);
    assert.equal(first.steps.length, 20, 'the 960 new keys, 48 a statement - and no more than LEDGER_NEW_MAX of them');
    assert.equal(reads, 2 + 12, 'the character\'s rows, its copies, and the 1,000 keys 90 a read');
    await db.batch(first.steps);
    const second = await ledgerStep(db, at, pieces);
    assert.equal(second.steps.length, 1, 'the forty left, the next checkpoint');
    await db.batch(second.steps);
    const still = await ledgerStep(db, at, pieces);
    assert.equal(still.steps.length, 0, 'held still: nothing written');
  } finally { s.done(); }
});

test('INT3/INT4 client: the realm\'s session hears the hold and the piece as its checkpoint lands, and tells its handler (the host says it - world.js); the host stamps the ids before every realm checkpoint (AUDIT INT: no pin held either)', async () => {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  try {
    const s = await standService();
    const who = await s.registered('heard');
    const R = await seatRealm(s.env, who.secret, 'heard');
    const kept = new Map([[SESSION_KEY, JSON.stringify({ id: who.id, secret: who.secret })]]);
    const storage = { get length() { return kept.size; }, key: (i) => [...kept.keys()][i] ?? null, getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
    const at = R.at();
    const session = createRealmSession({ io: realmIo({ fetch: (u, i) => worker.fetch(new Request(u, i), s.env), storage }), id: at.id, lease: at.lease, seq: at.seq });
    const told = [];
    session.onTradeHeld = (prev, held, why) => told.push([prev, held, why]);
    await session.checkpoint(JSON.stringify(freshSave({ name: 'heard', items: [{ ...createWeapon(113, 1, seeded(7)), affixes: [{ id: 'damage', value: 40 }] }] })));
    assert.deepEqual(told, [[null, 'law', { code: 'rarity', t: 113 }]]);
    assert.equal(session.tradeHeld, 'law');
    await session.checkpoint(JSON.stringify(freshSave({ name: 'heard' })));
    assert.deepEqual(told.at(-1), ['law', null, null], 'open again');
  } finally { Date.now = realNow; }
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const body = world.slice(world.indexOf('  function realmCheckpoint({ sink = null } = {}) {'), world.indexOf('  function realmCheckpoint({ sink = null } = {}) {') + 1200);
  assert.ok(body.indexOf('stampItemIds(playerEntity);') > 0 && body.indexOf('stampItemIds(playerEntity);') < body.indexOf('quickSaveNow'), 'the ids, before the save is composed');
  assert.match(world, /realmSession\.onTradeHeld = \(prev, now, why\) => \{ const t = tradeHeldNotice\(prev, now, why\); if \(t\) townTalk\.say\(t\); \};/);
});
