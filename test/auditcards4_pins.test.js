// AUDIT CARDS-4 (2026-10-08, bible/01-Overview/Audit-Cards-4.md) M: THE MUTANTS THE LANES' COPIES SURVIVED, killed. The
// relay's void doors, its owed cash-outs (told on a sit, by their life, the newest kept past the bound, to the account's
// other sockets), a stake order at other stakes, the buy-in's edges, the sweep's age; the pure table's queue, its broke
// flags and a folded leaver's cash-out at once; the service's landed-batch paths and the old save let go; the device's
// void timer, the region a claim banks into, one claim at a time, a receipt kept or let go by why it was refused; the
// host's closed game and purse read again, the panel's word, the wallet's bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { mintStakeOrder, ORDER_TTL_S } from '../src/net/identityToken.js';
import { readCardReceipt, mintCardReceipt, CARD_RECEIPT_TTL_S } from '../src/net/cardReceipt.js';
import { newTable, sit, stand, tick, actAt, HOLDEM_FIRST_MS } from '../src/net/holdemTable.js';
import { createCardStakes, CARD_STAKES_KEY, CARD_RECEIPTS_KEY, CARD_VOID_AFTER_MS } from '../src/net/cardStakes.js';

const { subtle } = webcrypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ROOM = 'interior:m100.200';
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'));
let _tick = () => {};
async function withRoom(fn) {
  const r = fakeRoom(ROOM);
  r.env.GATE_SIGNING_KEY = await gateKey;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000) }); } finally { Date.now = realNow; _tick = () => {}; }
}
const holdem = (ws) => ws.sent.filter((m) => m.t === 'holdem');
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'holdem', ...o })); };
const receipts = (ws) => holdem(ws).filter((m) => m.cashout).map((m) => readCardReceipt(m.cashout));
let n = 0;
const sid = () => (0xd0000000 + ++n).toString(16).padEnd(20, '0');
async function order(r, nowS, { s, cj = sid(), cr = ROOM, ct = 0, ca = 500, cb = 10 }) {
  const kp = await r.signer();
  return { cj, stake: await mintStakeOrder({ s, cj, cr, ct, ca, cb }, kp.privateKey, { subtle, nowS }) };
}
const join = async (r, id, extra = {}) => { const w = r.connect(); await r.hello(w, id, null, { name: id, ...extra }); return w; };

test('AUDIT CARDS-4 M relay: a void of another room\'s or another account\'s order is refused unspent; an order at other stakes is handed back; the buy-in\'s edges seat', () => withRoom(async ({ r, nowS }) => {
  const b = await join(r, 'peer-b');
  for (const o of [await order(r, nowS(), { s: 'acct-peer-b', cr: 'interior:m9.9' }), await order(r, nowS(), { s: 'acct-peer-c' })]) {
    b.sent.length = 0;
    await word(r, b, { op: 'void', table: 0, stake: o.stake });
    assert.equal(holdem(b).find((m) => m.error)?.error, 'stake refused');
    assert.equal(r.store.get(`cstake:${o.cj}`), undefined);
  }
  b.sent.length = 0;
  const other = await order(r, nowS(), { s: 'acct-peer-b', cb: 20 });
  await word(r, b, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: other.stake });
  assert.equal(holdem(b).find((m) => m.error)?.error, 'stake elsewhere');
  assert.deepEqual(receipts(b).map((x) => [x.j, x.w]), [[other.cj, 'refused']]);
  const lo = await order(r, nowS(), { s: 'acct-peer-b', ca: 200 });
  await word(r, b, { op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10, stake: lo.stake, ct: 1 });
  const a = await join(r, 'peer-a');
  const hi = await order(r, nowS(), { s: 'acct-peer-a', ca: 1000, ct: 2 });
  await word(r, a, { op: 'sit', table: 2, chair: 0, chairs: 2, bb: 10, stake: hi.stake });
  assert.equal(r.room._holdem.get(2)?.seats[0]?.stack, 1000, 'a hundred big blinds sits');
  const lo2 = await order(r, nowS(), { s: 'acct-peer-b', ca: 200, ct: 3 });
  await word(r, b, { op: 'sit', table: 3, chair: 0, chairs: 2, bb: 10, stake: lo2.stake });
  assert.equal(r.room._holdem.get(3)?.seats[0]?.stack, 200, 'twenty big blinds sits');
}));

test('AUDIT CARDS-4 M relay: owed cash-outs - told on a sit, never past their life, the newest kept past the bound, sent to the account\'s other sockets too', () => withRoom(async ({ r, tick, nowS }) => {
  const b = await join(r, 'peer-b');
  const b2 = await join(r, 'peer-b2', { tokenSub: 'acct-peer-b' });   // one player in a second tab
  const v = await order(r, nowS(), { s: 'acct-peer-b' });
  await word(r, b, { op: 'void', table: 0, stake: v.stake });
  assert.deepEqual(receipts(b2).map((x) => x.j), [v.cj], 'the account\'s other socket hears it too');
  b.sent.length = 0;
  await word(r, b, { op: 'sit', table: 4, chair: 0, chairs: 2, bb: 10 });
  assert.deepEqual(receipts(b).map((x) => x.j), [v.cj], 'a sit tells what is owed first');
  await word(r, b, { op: 'stand', table: 4 });
  // the bound keeps the newest
  const js = [];
  for (let i = 0; i < 70; i++) { const o = await order(r, nowS(), { s: 'acct-peer-b' }); js.push(o.cj); await word(r, b, { op: 'void', table: 0, stake: o.stake }); }
  const kept = r.store.get('cashout:acct-peer-b').map((x) => x.j);
  assert.equal(kept.at(-1), js.at(-1), 'the newest kept');
  assert.deepEqual(kept, js.slice(-64), 'the bound: the newest sixty-four');
  assert.ok(!kept.includes(v.cj), 'the oldest gone past the bound');
  // past their life, never told
  tick((CARD_RECEIPT_TTL_S + 60) * 1000);
  b.sent.length = 0;
  await word(r, b, { op: 'look', table: 0 });
  assert.deepEqual(receipts(b), [], 'past its life: not told');
}));

test('AUDIT CARDS-4 M relay: the sweep forgets a spent stake only past the void\'s reach and a day; and an account\'s cash-outs all past their life', () => withRoom(async ({ r, nowS }) => {
  const DAY = 24 * 3600, reach = CARD_RECEIPT_TTL_S;
  await r.state.storage.put('cstake:aaaaaaaaaaaaaaaaaaaa', nowS() - reach - DAY / 2);
  await r.state.storage.put('cstake:bbbbbbbbbbbbbbbbbbbb', nowS() - reach - DAY - 60);
  await r.state.storage.put('cashout:acct-old', [{ j: 'cccccccccccccccccccc', receipt: 'x', e: nowS() - 1 }]);
  await r.state.storage.put('cashout:acct-live', [{ j: 'dddddddddddddddddddd', receipt: 'x', e: nowS() + 60 }]);
  await r.room._sweep();
  assert.notEqual(r.store.get('cstake:aaaaaaaaaaaaaaaaaaaa'), undefined, 'still within a void\'s reach and a day: remembered');
  assert.equal(r.store.get('cstake:bbbbbbbbbbbbbbbbbbbb'), undefined, 'past it: forgotten');
  assert.equal(r.store.get('cashout:acct-old'), undefined);
  assert.notEqual(r.store.get('cashout:acct-live'), undefined);
}));

test('AUDIT CARDS-4 M table: three staked seats up at once queue three cash-outs; a seat with nothing is broke; a folded leaver is cashed out at once, broke when he has nothing', () => {
  const t = newTable({ chairs: 3, bb: 10, gold: true });
  for (let i = 0; i < 3; i++) sit(t, { id: `p${i}`, name: `p${i}`, chair: i, now: 0, stake: { j: `${i}`.repeat(20), sub: `acct-p${i}`, amount: 500 } });
  t.seats[2].stack = 0;
  for (let i = 0; i < 3; i++) stand(t, { id: `p${i}`, now: 0 });
  assert.deepEqual(t.cashouts.map((c) => [c.r, c.w]), [[500, 'stood'], [500, 'stood'], [0, 'broke']]);
  const u = newTable({ chairs: 3, bb: 10, gold: true });
  for (let i = 0; i < 3; i++) sit(u, { id: `q${i}`, name: `q${i}`, chair: i, now: 0, stake: { j: `${i + 3}`.repeat(20), sub: `acct-q${i}`, amount: 500 } });
  let k = 0;
  tick(u, HOLDEM_FIRST_MS + 1, () => (k++ * 2654435761) >>> 0);
  assert.ok(u.hand, 'dealt');
  const folder = u.handSeats[u.hand.toAct];
  actAt(u, { id: u.seats[folder].id, action: { type: 'fold' }, now: HOLDEM_FIRST_MS + 2 });
  assert.ok(u.hand, 'the hand goes on');
  const kh = u.handSeats.indexOf(folder);
  u.hand.seats[kh].stack = 0;
  stand(u, { id: u.seats[folder].id, now: HOLDEM_FIRST_MS + 3 });
  assert.deepEqual(u.cashouts.map((c) => [c.to, c.r, c.w]), [[`q${folder}`, 0, 'broke']], 'at once, broke');
});

test('AUDIT CARDS-4 M service: a stake or a claim whose batch landed and lost its answer keeps the new save and says the record moved; the old save let go', async () => {
  let now = T0;
  const realNow = Date.now; Date.now = () => now * 1000;
  try {
    const s = await standService({});
    const who = await s.registered('ann');
    const R = await seatRealm(s.env, who.secret, 'ann', { name: 'ann', level: 5, items: [], goldPieces: 5000 });
    const objs = () => s.env.SAVES._map.size;
    const body = (x) => ({ character: R.id, realm: R.at(), region: 17, room: 'interior:m1.2', table: 0, bb: 10, amount: 500, rid: `card-pin-${String(++n).padStart(8, '0')}`, ...x });
    await s.call('/v1/cards/stake', body({}), who.secret);   // the record now holds its save and the one before it
    const before = objs();
    const ok = (await s.call('/v1/cards/stake', body({}), who.secret)).body;
    assert.equal(ok.amount, 500);
    assert.equal(objs(), before, 'the save before the one before let go - the record keeps two');
    const db = s.env.DB, batch = db.batch.bind(db);
    db.batch = async (steps) => { await batch(steps); throw new Error('the answer lost'); };
    const landed = (await s.call('/v1/cards/stake', body({}), who.secret)).body;
    db.batch = batch;
    assert.equal(landed.error, 'seq', `the record moved, said: ${JSON.stringify(landed)}`);
    const row = s.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id);
    assert.ok(s.env.SAVES._map.has(row.obj), 'the landed batch\'s save kept');
    const rec = await mintCardReceipt({ s: who.id, j: ok.id, r: 600, w: 'stood' }, s.gatePriv, { subtle, nowS: now });
    db.batch = async (steps) => { await batch(steps); throw new Error('the answer lost'); };
    const claimed = (await s.call('/v1/cards/cashout', { character: R.id, realm: R.at(), receipt: rec }, who.secret)).body;
    db.batch = batch;
    assert.equal(claimed.error, 'seq', JSON.stringify(claimed));
    assert.ok(s.env.SAVES._map.has(s.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj), 'and the claim\'s');
    const get = await s.fetch('https://accounts.invalid/v1/cards/stake', { method: 'GET', headers: { authorization: `Bearer ${who.secret}` } });
    assert.equal(get.status, 405, 'a stake is a POST');
    // a service with no key to sign the order takes no gold for it
    const stakes = () => s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM card_stakes').get().n;
    const had = stakes();
    delete s.env.IDENTITY_PRIVATE_KEY; _resetKeyForTests();
    assert.equal((await s.call('/v1/cards/stake', body({}), who.secret)).body.error, 'cards-closed');
    assert.equal(stakes(), had, 'nothing held');
  } finally { Date.now = realNow; }
});

test('AUDIT CARDS-4 M device: the void timer runs from the order, said again after a minute; a claim banks where it was staked, one claim at a time; a receipt refused on its clock kept, on its sum let go', async () => {
  const store = new Map(), log = [];
  let clock = 1_000_000, reg = 17, why = 'future';
  const st = { get: (k) => store.get(k), set: (k, v) => store.set(k, v) };
  const book = createCardStakes({
    door: { stake: async (q) => { clock += 5 * 60_000; return { ok: true, data: { stake: `o-${q.rid}`, id: sid() } }; }, cashout: async () => { log.push('ask'); await new Promise((res) => setTimeout(res, 5)); return why ? { ok: false, error: 'cards-receipt', why } : { ok: true, data: { gold: 9 } }; } },
    realm: { act: async ({ call, apply }) => { const r = await call({}); if (r.ok) apply?.(r); return r; } },
    wallet: (g) => ({ gold: () => 9999, pay: () => () => {}, bank: (x) => log.push(['bank', g, x]) }), character: () => 'CH1', region: () => reg, storage: st, now: () => clock,
  });
  assert.ok(CARD_VOID_AFTER_MS > ORDER_TTL_S * 1000, 'past the order\'s own minute');
  const s1 = await book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
  assert.deepEqual(book.voidable('interior:a'), [], 'the timer from the order\'s answer, not the request');
  clock += CARD_VOID_AFTER_MS;
  assert.equal(book.voidable('interior:a').length, 1);
  book.voiding(s1.id);
  assert.equal(book.voidable('interior:a').length, 0);
  clock += 61_000;
  assert.equal(book.voidable('interior:a').length, 1, 'said again after a minute');
  const rec = await mintCardReceipt({ s: 'acct-me', j: s1.id, r: 200, w: 'stood' }, null, { subtle, nowS: 1000 });
  book.receive(rec);
  reg = 5;
  await Promise.all([book.claim(), book.claim()]);
  assert.equal(log.filter((x) => x === 'ask').length, 1, 'one claim at a time');
  assert.equal(store.get(CARD_RECEIPTS_KEY).length, 1, 'refused on its clock: kept');
  why = 'sum';
  await book.claim();
  assert.deepEqual(store.get(CARD_RECEIPTS_KEY), [], 'refused for what it is: let go');
  book.receive(await mintCardReceipt({ s: 'acct-me', j: (await book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 })).id, r: 9, w: 'stood' }, null, { subtle, nowS: 1000 }));
  reg = 3;
  why = null;
  await book.claim();
  assert.deepEqual(log.filter((x) => Array.isArray(x)), [['bank', 5, 9]], 'banked at the region it was staked from');
  assert.ok(Array.isArray(store.get(CARD_STAKES_KEY)));
});

test('AUDIT CARDS-4 M host: a game closed while the realm answered sits nobody; the purse read again at the press; the panel\'s word for a closed realm; the wallet banks into the region\'s account', () => {
  const wm = read('src/scenes/worldModes.js'), w = read('src/scenes/world.js');
  assert.match(wm, /g\.staking = false;\n\s+if \(g !== cardGame \|\| !cardSeat\) return;\n\s+if \(!r\.ok\) \{ say\(\(r\.unknown/);
  assert.match(wm, /if \(game\.goldOnline\) \{   \/\/ CARDS6: the relay's gold table - no regulars, the stake the service's\n\s+game\.buyIn = buyInRange\(host\.cardStakes\.purse\(\) \?\? 0, game\.stakes\);/);
  assert.match(wm, /'cards-closed': 'The realm is not holding stakes right now\.'/);
  assert.match(w, /bank: \(n\) => \{ if \(account\) account\.accountGold = \(Number\.isFinite\(account\.accountGold\) \? account\.accountGold : 0\) \+ n; else addGold\(playerEntity, n\); \},/);
});
