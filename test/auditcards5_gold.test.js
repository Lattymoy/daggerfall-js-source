// AUDIT CARDS-5 (2026-10-08, bible/01-Overview/Audit-Cards-5.md) lane E: THE GOLD TABLES' BOOKS, again. A winner's
// cash-out bounded by every stake that came to its table, not six deep stakes (E1); a new stake at a chair its player is
// leaving cashed out is spent and handed back whole, and the client never confirms on a chair it is leaving (E2); the
// first asking of a stake keeps its request on every word but the service's refusal and the session's never-asked (E3);
// and the lane's survivors: recover on a lost lease, a receipt refused on its signature kept, the stakes kept their
// whole life, a top-up said as one, one ack one receipt, a settle paid once, the top-up's doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { mintStakeOrder } from '../src/net/identityToken.js';
import { readCardReceipt, mintCardReceipt } from '../src/net/cardReceipt.js';
import { HOLDEM_FIRST_MS } from '../src/net/holdemTable.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';
import { createCardStakes, CARD_STAKES_KEY, CARD_RECEIPTS_KEY, CARD_STAKE_KEEP_MS, stakeNeverAsked } from '../src/net/cardStakes.js';

const { subtle } = webcrypto;
const ROOM = 'interior:m100.200';
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'));
let _tick = () => {};
async function withRoom(fn, { gate = true } = {}) {
  const r = fakeRoom(ROOM);
  if (gate) r.env.GATE_SIGNING_KEY = await gateKey;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000) }); } finally { Date.now = realNow; _tick = () => {}; }
}
const holdem = (ws) => ws.sent.filter((m) => m.t === 'holdem');
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'holdem', ...o })); };
const receipts = (ws) => holdem(ws).filter((m) => m.cashout).map((m) => readCardReceipt(m.cashout));
let n = 0;
const sid = () => (0xe0000000 + ++n).toString(16).padEnd(20, '0');
// PIN MOVED (TAVERN-TABLES, world179): a room's gold table is table 1 (net/holdemTable.js HOLDEM_GOLD_TABLE) - every
// staked word below, and the order it carries, names it where they named table 0 (a chips table now: a staked sit there
// is handed its stake back); the order "for another table" names table 0.
async function order(r, nowS, { s, cj = sid(), cr = ROOM, ct = 1, ca = 500, cb = 10 }) {
  const kp = await r.signer();
  return { cj, stake: await mintStakeOrder({ s, cj, cr, ct, ca, cb }, kp.privateKey, { subtle, nowS }) };
}
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };

test('AUDIT CARDS-5 E1: a winner leaves with what came to the table - every seat\'s stakes - and the service pays it; past that, refused and the device keeps it', async () => {
  let now = T0;
  const realNow = Date.now; Date.now = () => now * 1000;
  try {
    const s = await standService({});
    const seat = async (h) => { const who = await s.registered(h); const R = await seatRealm(s.env, who.secret, h, { name: h, level: 5, items: [], goldPieces: 9000 }); return { who, R }; };
    const ann = await seat('ann'), bob = await seat('bob');
    const body = (x, extra = {}) => ({ character: x.R.id, realm: x.R.at(), region: 17, room: 'interior:m1.2', table: 0, bb: 10, amount: 1000, rid: `card-gold-${String(++n).padStart(8, '0')}`, ...extra });
    const a = (await s.call('/v1/cards/stake', body(ann), ann.who.secret)).body;
    for (let i = 0; i < 6; i++) await s.call('/v1/cards/stake', body(bob), bob.who.secret);   // Bob buys in, and in again
    const r = 1000 + 6 * 1000;   // past six deep stakes (6,000), within what came to the table (7,000)
    const won = await mintCardReceipt({ s: ann.who.id, j: a.id, r, w: 'stood' }, s.gatePriv, { subtle, nowS: now });
    const paid = (await s.call('/v1/cards/cashout', { character: ann.R.id, realm: ann.R.at(), receipt: won }, ann.who.secret)).body;
    assert.equal(paid.gold, r, JSON.stringify(paid));
    const b = (await s.call('/v1/cards/stake', body(ann, { table: 1 }), ann.who.secret)).body;
    const over = await mintCardReceipt({ s: ann.who.id, j: b.id, r: 1001, w: 'stood' }, s.gatePriv, { subtle, nowS: now });
    assert.deepEqual((await s.call('/v1/cards/cashout', { character: ann.R.id, realm: ann.R.at(), receipt: over }, ann.who.secret)).body, { error: 'cards-receipt', why: 'sum' }, 'more than came to its table');
  } finally { Date.now = realNow; }
});

test('AUDIT CARDS-5 E2: a new stake at the chair its player is leaving cashed out - spent, and handed back whole; the client confirms on no chair it is leaving', () => withRoom(async ({ r, tick, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  const oa = await order(r, nowS(), { s: 'acct-peer-a' }), ob = await order(r, nowS(), { s: 'acct-peer-b' }), oc = await order(r, nowS(), { s: 'acct-peer-c' });
  await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 3, bb: 10, stake: oa.stake });
  await word(r, b, { op: 'sit', table: 1, chair: 1, chairs: 3, bb: 10, stake: ob.stake });
  await word(r, c, { op: 'sit', table: 1, chair: 2, chairs: 3, bb: 10, stake: oc.stake });
  tick(HOLDEM_FIRST_MS); await r.fire();
  const t = r.room._holdem.get(1);
  const who = t.seats[t.handSeats[t.hand.toAct]].id;
  const ws = { 'peer-a': a, 'peer-b': b, 'peer-c': c }[who];
  await word(r, ws, { op: 'stand', table: 1 });   // up mid-hand: cashed out, his chair leaving till the hand ends
  assert.ok(t.hand && t.seats.find((x) => x?.id === who)?.leaving);
  const again = await order(r, nowS(), { s: `acct-${who}` });
  ws.sent.length = 0;
  await word(r, ws, { op: 'sit', table: 1, chair: t.seats.findIndex((x) => x?.id === who), chairs: 3, bb: 10, stake: again.stake });
  assert.equal(holdem(ws).find((m) => m.error)?.error, 'cashed out');
  assert.notEqual(r.store.get(`cstake:${again.cj}`), undefined, 'the new stake spent');
  assert.deepEqual(receipts(ws).filter((x) => x.j === again.cj).map((x) => [x.r, x.w]), [[500, 'refused']], 'and handed back whole');
  // the client: a frame showing my chair LEAVING confirms nothing
  const me = new RemoteCardTable({ myId: who, chair: 0 });
  const view = { chairs: 3, bb: 10, seats: [{ id: who, name: who, stack: 100, leaving: true }, null, null] };
  me.ingest({ table: 0, events: [], state: view, now: 0, at: 0 });
  assert.equal(me.confirmed, false);
  me.ingest({ table: 0, events: [], state: { ...view, seats: [{ id: who, name: who, stack: 100 }, null, null] }, now: 0, at: 0 });
  assert.equal(me.confirmed, true, 'a chair held for me confirms');
}));

function rig(answer) {
  const store = new Map(), log = [];
  const book = createCardStakes({
    door: { stake: async (q) => { log.push(['stake', q]); return answer(q); }, cashout: async () => ({ ok: true, data: { gold: 1 } }) },
    realm: { act: async ({ call, reserve, apply }) => { const undo = reserve ? reserve() : null; const r = await call({}); if (r?.ok) apply?.(r); else if (!r?.unknown) undo?.(); return r; } },
    wallet: () => ({ gold: () => 9999, pay: () => () => {}, bank: () => {} }), character: () => 'CH1', region: () => 17,
    storage: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => 1_000_000,
  });
  return { book, store, log };
}

test('AUDIT CARDS-5 E3: the first asking keeps its request on every word but a refusal and a never-asked - a lease another tab took, a lost answer; an order for a request let go elsewhere is kept again', async () => {
  for (const [answer, kept] of [[{ ok: false, error: 'lease' }, 1], [{ ok: false, error: 'offline', unknown: true }, 1], [{ ok: false, error: 'unknown' }, 1], [{ ok: false, error: 'busy', why: 'busy' }, 0], [{ ok: false, error: 'offline', why: 'offline' }, 0], [{ ok: false, error: 'realm-gold' }, 0]]) {
    const r = rig(() => answer);
    await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
    assert.equal(r.store.get(CARD_STAKES_KEY).length, kept, JSON.stringify(answer));
  }
  assert.equal(stakeNeverAsked({ ok: false, error: 'offline', unknown: true }), false);
  // the request let go by another tab while this one asked: the order kept again
  let r;
  r = rig((q) => { r.store.set(CARD_STAKES_KEY, []); return { ok: true, data: { stake: `o-${q.rid}`, id: 'abcdabcdabcdabcdab01' } }; });
  const got = await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
  assert.equal(got.ok, true);
  assert.deepEqual(r.store.get(CARD_STAKES_KEY).map((x) => [x.id, x.order]), [['abcdabcdabcdabcdab01', got.stake]]);
});

test('AUDIT CARDS-5 lane E\'s survivors: recover on a lost lease keeps; a receipt refused on its signature kept; a stake kept its whole life; a top-up said as one; one ack, one receipt; a receipt paid once however often brought at once; the top-up\'s doors', async () => {
  // recover on a lease another tab took: kept
  let first = true;
  const lost = rig(() => (first ? { ok: false, error: 'offline', unknown: true } : { ok: false, error: 'lease' }));
  await lost.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
  first = false;
  await lost.book.recover();
  assert.equal(lost.store.get(CARD_STAKES_KEY).length, 1, 'a lease is no refusal');
  // a receipt refused on its signature: kept
  const store = new Map();
  const book = createCardStakes({ door: { stake: async () => ({}), cashout: async () => ({ ok: false, error: 'cards-receipt', why: 'signature' }) }, realm: { act: async ({ call }) => call({}) },
    wallet: () => ({ gold: () => 0, pay: () => () => {}, bank: () => {} }), character: () => 'CH1', region: () => 17, storage: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => 0 });
  book.receive(await mintCardReceipt({ s: 'acct-me', j: sid(), r: 5, w: 'stood' }, null, { subtle, nowS: 1000 }));
  await book.claim();
  assert.equal(store.get(CARD_RECEIPTS_KEY).length, 1, 'a key rotating keeps no gold from its owner');
  // a stake kept its whole life, then let go
  let clock = 0;
  const kept = new Map();
  const life = createCardStakes({ door: { stake: async (q) => ({ ok: true, data: { stake: `o-${q.rid}`, id: sid() } }), cashout: async () => ({}) }, realm: { act: async ({ call }) => call({}) },
    wallet: () => ({ gold: () => 9999, pay: () => () => {}, bank: () => {} }), character: () => 'CH1', region: () => 17, storage: { get: (k) => kept.get(k), set: (k, v) => kept.set(k, v) }, now: () => clock });
  await life.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
  clock = CARD_STAKE_KEEP_MS - 1; life.prune();
  assert.equal(kept.get(CARD_STAKES_KEY).length, 1, 'kept to the end of its life');
  clock = CARD_STAKE_KEEP_MS + 2; life.prune();
  assert.equal(kept.get(CARD_STAKES_KEY).length, 0);
  // a top-up said as one, on the first asking and the next
  const tu = rig((q) => ({ ok: false, error: 'offline', unknown: true, q }));
  await tu.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 50, topup: true });
  await tu.book.recover();
  assert.deepEqual(tu.log.map(([, q]) => q.topup), [true, true]);
  // the relay: one ack lets one receipt go; the top-up's doors
  await withRoom(async ({ r, nowS }) => {
    const b = await join(r, 'peer-b');
    for (let i = 0; i < 2; i++) await word(r, b, { op: 'void', table: 1, stake: (await order(r, nowS(), { s: 'acct-peer-b' })).stake });
    const owed = r.store.get('cashout:acct-peer-b');
    await word(r, b, { op: 'ack', table: 1, j: owed[0].j });
    assert.deepEqual(r.store.get('cashout:acct-peer-b').map((x) => x.j), [owed[1].j], 'the other still owed');
    const o = await order(r, nowS(), { s: 'acct-peer-b' });
    await word(r, b, { op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10, stake: o.stake });
    for (const [extra, why] of [[{ ct: 0 }, 'stake elsewhere'], [{ cb: 20 }, 'stake elsewhere']]) {
      b.sent.length = 0;
      const up = await order(r, nowS(), { s: 'acct-peer-b', ca: 100, ...extra });
      await word(r, b, { op: 'topup', table: 1, stake: up.stake });
      assert.equal(holdem(b).find((m) => m.error)?.error, why, JSON.stringify(extra));
      assert.equal(r.store.get(`cstake:${up.cj}`), undefined, 'not spent');
    }
  });
  await withRoom(async ({ r, nowS }) => {
    const b = await join(r, 'peer-b');
    const up = await order(r, nowS(), { s: 'acct-peer-b', ca: 100 });
    await word(r, b, { op: 'topup', table: 1, stake: up.stake });
    assert.equal(holdem(b).find((m) => m.error)?.error, 'stakes closed', 'no key to sign: no top-up');
  }, { gate: false });
  // the service: one receipt brought twice at once pays once
  let now = T0;
  const realNow = Date.now; Date.now = () => now * 1000;
  try {
    const s = await standService({});
    const who = await s.registered('cat');
    const R = await seatRealm(s.env, who.secret, 'cat', { name: 'cat', level: 5, items: [], goldPieces: 5000 });
    const st = (await s.call('/v1/cards/stake', { character: R.id, realm: R.at(), region: 17, room: 'interior:m1.2', table: 0, bb: 10, amount: 500, rid: 'card-once-0000001' }, who.secret)).body;
    const rec = await mintCardReceipt({ s: who.id, j: st.id, r: 500, w: 'stood' }, s.gatePriv, { subtle, nowS: now });
    const at = R.at();
    const both = await Promise.all([0, 1].map(() => s.call('/v1/cards/cashout', { character: R.id, realm: at, receipt: rec }, who.secret)));
    assert.equal(both.filter((x) => x.body.ok && !x.body.repeat).length, 1, 'paid once');
    assert.equal(s.env.DB._raw.prepare('SELECT paid FROM card_stakes WHERE id = ?').get(st.id).paid, 500);
  } finally { Date.now = realNow; }
});

test('AUDIT CARDS-5 lane E\'s survivors (second pass), the relay: a top-up from a chair its player is leaving is "not seated"; a socket\'s top-up of an account not its own, or of an account not its seat\'s, refused unspent; one the table moved under after its spend handed back whole', async () => {
  // leaving mid-hand, cashed out: not seated, nothing spent
  await withRoom(async ({ r, tick, nowS }) => {
    const ws = { 'peer-a': await join(r, 'peer-a'), 'peer-b': await join(r, 'peer-b'), 'peer-c': await join(r, 'peer-c') };
    for (const [i, id] of ['peer-a', 'peer-b', 'peer-c'].entries()) await word(r, ws[id], { op: 'sit', table: 1, chair: i, chairs: 3, bb: 10, stake: (await order(r, nowS(), { s: `acct-${id}` })).stake });
    tick(HOLDEM_FIRST_MS); await r.fire();
    const t = r.room._holdem.get(1);
    const who = t.seats[t.handSeats[t.hand.toAct]].id;
    await word(r, ws[who], { op: 'stand', table: 1 });
    assert.ok(t.hand && t.seats.find((x) => x?.id === who)?.leaving);
    ws[who].sent.length = 0;
    const up = await order(r, nowS(), { s: `acct-${who}`, ca: 100 });
    await word(r, ws[who], { op: 'topup', table: 1, stake: up.stake });
    assert.equal(holdem(ws[who]).find((m) => m.error)?.error, 'not seated', 'a chair cashed out is no seat to top up');
    assert.equal(r.store.get(`cstake:${up.cj}`), undefined);
  });
  // the seat's id reconnected under another account: neither account's order tops it up
  await withRoom(async ({ r, nowS }) => {
    const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
    await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10, stake: (await order(r, nowS(), { s: 'acct-peer-a' })).stake });
    await word(r, b, { op: 'sit', table: 1, chair: 1, chairs: 2, bb: 10, stake: (await order(r, nowS(), { s: 'acct-peer-b' })).stake });
    const a2 = r.connect();
    await r.hello(a2, 'peer-a', null, { name: 'peer-a', tokenSub: 'acct-other' });
    const t = r.room._holdem.get(1);
    assert.equal(t.seats[0]?.id, 'peer-a', 'the chair kept');
    for (const s of ['acct-other', 'acct-peer-a']) {   // the socket's own account (not the seat's); the seat's (not the socket's)
      a2.sent.length = 0;
      const up = await order(r, nowS(), { s, ca: 100 });
      await word(r, a2, { op: 'topup', table: 1, stake: up.stake });
      assert.equal(holdem(a2).find((m) => m.error)?.error, 'stake refused', s);
      assert.equal(r.store.get(`cstake:${up.cj}`), undefined, `${s}: not spent`);
      assert.equal(t.seats[0].stack, 500, `${s}: the stack unmoved`);
    }
  });
  // a hand dealt while the top-up's spend was written: spent, refused, the whole of it back
  await withRoom(async ({ r, tick, nowS }) => {
    const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
    await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10, stake: (await order(r, nowS(), { s: 'acct-peer-a' })).stake });
    await word(r, b, { op: 'sit', table: 1, chair: 1, chairs: 2, bb: 10, stake: (await order(r, nowS(), { s: 'acct-peer-b' })).stake });
    const up = await order(r, nowS(), { s: 'acct-peer-a', ca: 100 });
    const st = r.state.storage, get = st.get;
    st.get = async (k) => { if (k === `cstake:${up.cj}`) { st.get = get; tick(HOLDEM_FIRST_MS); await r.fire(); } return get.call(st, k); };
    a.sent.length = 0;
    await word(r, a, { op: 'topup', table: 1, stake: up.stake });
    st.get = get;
    const t = r.room._holdem.get(1);
    assert.ok(t.hand, 'the hand dealt meanwhile');
    assert.equal(holdem(a).find((m) => m.error)?.error, 'in hand');
    assert.notEqual(r.store.get(`cstake:${up.cj}`), undefined, 'spent');
    assert.deepEqual(receipts(a).filter((x) => x.j === up.cj).map((x) => [x.r, x.w]), [[100, 'refused']], 'and handed back whole');
  });
});

test('AUDIT CARDS-5 lane E\'s survivors (second pass), the device and the service: a receipt banks where its stake was staked, wherever the player stands now; a paid request asked again is refused; a top-up is one said as true; a settle by nothing brought twice at once is one settle', async () => {
  // the device: staked at 17, the receipt heard at 42 - home to 17
  let reg = 17;
  const banked = [], kept = new Map();
  const book = createCardStakes({ door: { stake: async (q) => ({ ok: true, data: { stake: `o-${q.rid}`, id: sid() } }), cashout: async () => ({ ok: true, data: { gold: 300 } }) },
    realm: { act: async ({ call, reserve, apply }) => { reserve?.(); const x = await call({}); if (x?.ok) apply?.(x); return x; } },
    wallet: (g) => ({ gold: () => 9999, pay: () => () => {}, bank: (v) => banked.push([g, v]) }), character: () => 'CH1', region: () => reg,
    storage: { get: (k) => kept.get(k), set: (k, v) => kept.set(k, v) }, now: () => 0 });
  const st = await book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 300 });
  book.seated(st.id);
  reg = 42;
  assert.equal(book.receive(await mintCardReceipt({ s: 'acct-me', j: st.id, r: 300, w: 'stood' }, null, { subtle, nowS: 1000 })), st.id);
  await book.claim();
  assert.deepEqual(banked, [[17, 300]], 'the region it was staked from');
  // the service
  let now = T0;
  const realNow = Date.now; Date.now = () => now * 1000;
  try {
    const s = await standService({});
    const who = await s.registered('dee');
    const R = await seatRealm(s.env, who.secret, 'dee', { name: 'dee', level: 5, items: [], goldPieces: 5000 });
    const body = (x) => ({ character: R.id, realm: R.at(), region: 17, room: 'interior:m1.2', table: 0, bb: 10, amount: 500, rid: `card-pass-${String(++n).padStart(8, '0')}`, ...x });
    const q = body({});
    const held = (await s.call('/v1/cards/stake', q, who.secret)).body;
    const rec = await mintCardReceipt({ s: who.id, j: held.id, r: 500, w: 'stood' }, s.gatePriv, { subtle, nowS: now });
    assert.equal((await s.call('/v1/cards/cashout', { character: R.id, realm: R.at(), receipt: rec }, who.secret)).body.gold, 500);
    assert.deepEqual((await s.call('/v1/cards/stake', { ...q, realm: R.at() }, who.secret)).body, { error: 'cards-stake-paid' }, 'a paid stake gives no order again');
    for (const topup of [1, 'yes']) assert.equal((await s.call('/v1/cards/stake', body({ topup, amount: 50 }), who.secret)).body.error, 'bad-buy-in', `topup ${JSON.stringify(topup)} is no top-up`);
    const top = (await s.call('/v1/cards/stake', body({ topup: true, amount: 50 }), who.secret)).body;
    const joined = await mintCardReceipt({ s: who.id, j: top.id, r: 0, w: 'joined' }, s.gatePriv, { subtle, nowS: now });
    const at = R.at();
    // both past the row's read before either settles: the first batch waits for the second
    const DB = s.env.DB, batch = DB.batch;
    let open, calls = 0;
    const met = new Promise((res) => { open = res; });
    let timer;
    DB.batch = async (list) => { if (++calls === 1) await Promise.race([met, new Promise((res) => { timer = setTimeout(res, 1000); })]); else open(); return batch.call(DB, list); };
    const both = (await Promise.all([0, 1].map(() => s.call('/v1/cards/cashout', { character: R.id, realm: at, receipt: joined }, who.secret)))).map((x) => x.body);
    DB.batch = batch; clearTimeout(timer);
    assert.equal(calls, 2, 'both reached the settle');
    assert.deepEqual(both.map((x) => [x.ok, x.gold, !!x.repeat]).sort(), [[true, 0, false], [true, 0, true]], JSON.stringify(both));
  } finally { Date.now = realNow; }
});
