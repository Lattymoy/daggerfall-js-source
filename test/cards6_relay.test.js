// CARDS6 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 23): THE RELAY'S GOLD TABLES. Driven on the fake
// room (server/src/index.js): a sit carrying the service's stake order seats that many chips and spends the stake once;
// a gold table seats only stakes, a friendly table none; a sit refused after its stake was spent hands the whole stake
// back in a receipt; a stake order for another room, table or stakes is spent and handed back, another account's is
// refused; a stake never sat is voided back; what the seats leave with comes back in the relay's receipts - every chip
// that came in as a stake, and no more - owed to a player gone from the room till his next look, and let go on his ack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { mintStakeOrder } from '../src/net/identityToken.js';
import { readCardReceipt } from '../src/net/cardReceipt.js';
import { HOLDEM_FIRST_MS, newTable, sit, stand, tick, actAt, publicView } from '../src/net/holdemTable.js';
import { HOLDEM_REFUSALS } from '../src/ui/cardTableHud.js';

const { subtle } = webcrypto;
const ROOM = 'interior:m100.200';
// AUDIT CARDS-4 B3: a room seats a stake only when it can sign its cash-out - the relay's gate key, as the deploy holds it
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'));
async function withRoom(fn, { gate = true } = {}) {
  const r = fakeRoom(ROOM);
  if (gate) r.env.GATE_SIGNING_KEY = await gateKey;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000) }); } finally { Date.now = realNow; _tick = () => {}; }
}
const holdem = (ws) => ws.sent.filter((m) => m.t === 'holdem');
let _tick = () => {};
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'holdem', ...o })); };   // a word at a time, inside the socket's gate
const receipts = (ws) => holdem(ws).filter((m) => m.cashout).map((m) => readCardReceipt(m.cashout));
let n = 0;
const sid = () => (0xa0000000 + ++n).toString(16).padEnd(20, '0');
async function order(r, nowS, { s, cj = sid(), cr = ROOM, ct = 0, ca = 500, cb = 10 }) {
  const kp = await r.signer();
  return { cj, stake: await mintStakeOrder({ s, cj, cr, ct, ca, cb }, kp.privateKey, { subtle, nowS }) };
}
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };

test('CARDS6 a gold table: staked sits seat their stakes, the hand plays, the seats\' receipts bring back every chip the stakes brought and no more', () => withRoom(async ({ r, tick, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const oa = await order(r, nowS(), { s: 'acct-peer-a', ca: 500 }), ob = await order(r, nowS(), { s: 'acct-peer-b', ca: 300 });
  await word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: oa.stake });
  await word(r, b, { op: 'sit', table: 0, chair: 1, chairs: 2, bb: 10, stake: ob.stake });
  const t = r.room._holdem.get(0);
  assert.equal(t.gold, true, 'the first sitter\'s stake made it a gold table');
  assert.deepEqual(t.seats.map((s) => s.stack), [500, 300], 'each seat its stake');
  assert.equal(holdem(a).find((m) => m.state).state.gold, true, 'the room told it is gold');
  tick(HOLDEM_FIRST_MS); await r.fire();
  // whoever is to act folds; both stand once the hand is over
  const toAct = t.seats[t.handSeats[t.hand.toAct]].id === 'peer-a' ? a : b;
  await word(r, toAct, { op: 'act', table: 0, action: { type: 'fold' } });
  await word(r, a, { op: 'stand', table: 0 });
  await word(r, b, { op: 'stand', table: 0 });
  const ra = receipts(a), rb = receipts(b);
  assert.equal(ra.length, 1); assert.equal(rb.length, 1);
  assert.deepEqual([ra[0].j, ra[0].s, ra[0].w, rb[0].j, rb[0].s, rb[0].w], [oa.cj, 'acct-peer-a', 'stood', ob.cj, 'acct-peer-b', 'stood']);
  assert.equal(ra[0].r + rb[0].r, 800, 'what the seats left with is what the stakes brought');
  assert.notEqual(ra[0].r, 500, 'and the blinds moved it');
  assert.equal(r.store.get('holdem'), undefined, 'the table forgotten');
  // the stakes are spent: their orders seat nobody again
  await word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: oa.stake });
  assert.equal(holdem(a).at(-1).error, 'stake spent');
  assert.ok(HOLDEM_REFUSALS['stake spent'], 'said in words');
}));

test('CARDS6 the doors: every seat staked or none; a sit refused after its stake was spent hands it back whole; another room\'s order handed back, another account\'s refused', () => withRoom(async ({ r, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  await word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 3, bb: 10 });   // a friendly table
  const ob = await order(r, nowS(), { s: 'acct-peer-b' });
  await word(r, b, { op: 'sit', table: 0, chair: 1, chairs: 3, bb: 10, stake: ob.stake });
  assert.equal(holdem(b).find((m) => m.error)?.error, 'friendly table');
  assert.deepEqual(receipts(b).map((x) => [x.j, x.r, x.w]), [[ob.cj, 500, 'refused']], 'the stake back, whole');
  await word(r, b, { op: 'ack', table: 0, j: ob.cj });   // the client holds it: told no more
  const oc = await order(r, nowS(), { s: 'acct-peer-c', ct: 1 });
  await word(r, c, { op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10, stake: oc.stake });   // a gold table at index 1
  await word(r, a, { op: 'sit', table: 1, chair: 1, chairs: 2, bb: 10 });
  assert.equal(holdem(a).at(-1).error, 'gold table', 'a friendly sit at a gold table');
  const elsewhere = await order(r, nowS(), { s: 'acct-peer-b', cr: 'interior:m9.9' });
  b.sent.length = 0;
  await word(r, b, { op: 'sit', table: 2, chair: 0, chairs: 2, bb: 10, stake: elsewhere.stake });
  assert.equal(holdem(b).find((m) => m.error)?.error, 'stake elsewhere');
  // AUDIT CARDS-4 A2/B1 (PIN MOVED): another room's order is that room's - unspent here, nothing handed back (a refund here
  // while the room it names still seated it was the stake paid twice)
  assert.deepEqual(receipts(b), [], 'another room\'s order: nothing handed back');
  assert.equal(r.store.get(`cstake:${elsewhere.cj}`), undefined, 'and not spent - its own room voids it');
  // this room's own order at another table: spent here and handed back whole
  const wrongTable = await order(r, nowS(), { s: 'acct-peer-b', ct: 5 });
  b.sent.length = 0;
  await word(r, b, { op: 'sit', table: 2, chair: 0, chairs: 2, bb: 10, stake: wrongTable.stake });
  assert.equal(holdem(b).find((m) => m.error)?.error, 'stake elsewhere');
  assert.deepEqual(receipts(b).map((x) => [x.j, x.r, x.w]), [[wrongTable.cj, 500, 'refused']]);
  await word(r, b, { op: 'ack', table: 2, j: wrongTable.cj });
  const theirs = await order(r, nowS(), { s: 'acct-peer-c' });
  b.sent.length = 0;
  await word(r, b, { op: 'sit', table: 2, chair: 0, chairs: 2, bb: 10, stake: theirs.stake });
  assert.equal(holdem(b).at(-1).error, 'stake refused');
  assert.deepEqual(receipts(b), [], 'nothing handed back for another account\'s stake');
  assert.equal(r.store.get(`cstake:${theirs.cj}`), undefined, 'and it is not spent');
  // a stake never sat: voided back whole - once
  const never = await order(r, nowS(), { s: 'acct-peer-b' });
  b.sent.length = 0;
  await word(r, b, { op: 'void', table: 0, stake: never.stake });
  assert.deepEqual(receipts(b).map((x) => [x.j, x.r, x.w]), [[never.cj, 500, 'void']]);
  await word(r, b, { op: 'void', table: 0, stake: never.stake });
  assert.equal(holdem(b).at(-1).error, 'stake spent');
  await word(r, b, { op: 'sit', table: 3, chair: 0, chairs: 2, bb: 10, stake: never.stake });
  assert.equal(holdem(b).at(-1).error, 'stake spent', 'nor sat on after');
}));

test('CARDS6 a player gone from the room: his seat stood up at the hand\'s end, the receipt owed - told at his next look in the room, let go on his ack', () => withRoom(async ({ r, tick, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const oa = await order(r, nowS(), { s: 'acct-peer-a', ca: 400 }), ob = await order(r, nowS(), { s: 'acct-peer-b', ca: 400 });
  await word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: oa.stake });
  await word(r, b, { op: 'sit', table: 0, chair: 1, chairs: 2, bb: 10, stake: ob.stake });
  tick(HOLDEM_FIRST_MS); await r.fire();
  await r.drop(a);   // gone mid-hand: folded out of turn, stood up at the hand's end
  const owed = r.store.get('cashout:acct-peer-a');
  assert.equal(owed?.length, 1, 'kept for him');
  assert.equal(readCardReceipt(owed[0].receipt).j, oa.cj);
  const back = await join(r, 'peer-a2');   // the same account, a new socket
  r.room._all();
  const fresh = r.connect(); await r.hello(fresh, 'peer-a3', null, { name: 'a3', tokenSub: 'acct-peer-a' });
  fresh.sent.length = 0;
  await word(r, fresh, { op: 'look', table: 0 });
  assert.deepEqual(receipts(fresh).map((x) => x.j), [oa.cj], 'told at his look');
  await word(r, fresh, { op: 'ack', table: 0, j: oa.cj });
  assert.equal(r.store.get('cashout:acct-peer-a'), undefined, 'let go on his ack');
  void back; void b;
}));

test('CARDS6 the table law: a gold table seats stakes within its buy-in and nothing else; a staked seat gone queues its cash-out with the table', () => {
  const t = newTable({ chairs: 2, bb: 10, gold: true });
  assert.equal(publicView(t).gold, true);
  assert.equal(sit(t, { id: 'a', name: 'A', chair: 0, now: 0 }), 'gold table');
  assert.equal(sit(t, { id: 'a', name: 'A', chair: 0, now: 0, stake: { j: 'x'.repeat(20), sub: 's', amount: 199 } }), 'bad stake');
  assert.equal(sit(t, { id: 'a', name: 'A', chair: 0, now: 0, stake: { j: 'x'.repeat(20), sub: 's', amount: 1001 } }), 'bad stake');
  assert.ok(Array.isArray(sit(t, { id: 'a', name: 'A', chair: 0, now: 0, stake: { j: 'aaaaaaaaaaaaaaaaaaaa', sub: 'sa', amount: 600 } })));
  assert.equal(t.seats[0].stack, 600);
  const f = newTable({ chairs: 2, bb: 10 });
  assert.equal(sit(f, { id: 'a', name: 'A', chair: 0, now: 0, stake: { j: 'aaaaaaaaaaaaaaaaaaaa', sub: 'sa', amount: 600 } }), 'friendly table');
});

test('CARDS6 a staked leaver mid-hand: cashed out at once with his stack behind (he can win nothing more), never again at the hand\'s end, and never seated on it again', () => {
  const t = newTable({ chairs: 3, bb: 10, gold: true });
  const st = (j, amount) => ({ j: j.repeat(20), sub: `s${j}`, amount });
  sit(t, { id: 'a', name: 'A', chair: 0, now: 0, stake: st('a', 500) });
  sit(t, { id: 'b', name: 'B', chair: 1, now: 0, stake: st('b', 500) });
  sit(t, { id: 'c', name: 'C', chair: 2, now: 0, stake: st('c', 500) });
  tick(t, HOLDEM_FIRST_MS, () => 7);
  const who = t.seats[t.handSeats[t.hand.toAct]].id;
  const k = t.hand.toAct, chair = t.handSeats[k];
  actAt(t, { id: who, action: { type: 'call' }, now: 1 });   // he puts chips in, then walks out
  const behind = t.hand.seats[k].stack;
  assert.ok(behind < 500, 'what he has behind, not what he sat with');
  stand(t, { id: who, now: 1 });
  assert.ok(t.hand, 'the hand goes on without him');
  assert.deepEqual(t.cashouts.map((x) => [x.to, x.r, x.w]), [[who, behind, 'stood']], 'his stack behind, now');
  assert.equal(sit(t, { id: who, name: 'X', chair, now: 2 }), 'cashed out', 'his chair is not his to play again');
  // the hand plays out: no second cash-out for him
  for (let i = 0; i < 40 && t.hand; i++) { const id = t.seats[t.handSeats[t.hand.toAct]].id; actAt(t, { id, action: { type: t.hand.currentBet > t.hand.seats[t.hand.toAct].bet ? 'call' : 'check' }, now: 3 + i }); }
  assert.equal(t.hand, null);
  assert.equal(t.cashouts.filter((x) => x.to === who).length, 1, 'once');
});

test('CARDS6 a dropped player back at a gold table mid-hand: his own chair, his stake not asked again', () => withRoom(async ({ r, tick: tk, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  for (const [ws, s, chair] of [[a, 'acct-peer-a', 0], [b, 'acct-peer-b', 1], [c, 'acct-peer-c', 2]]) {
    const o = await order(r, nowS(), { s });
    await word(r, ws, { op: 'sit', table: 0, chair, chairs: 3, bb: 10, stake: o.stake });
  }
  tk(HOLDEM_FIRST_MS); await r.fire();
  const t = r.room._holdem.get(0);
  // a is marked leaving but not stood (a blip the relay has not yet stood him for): his sit back takes his chair
  t.seats[0].leaving = true;
  a.sent.length = 0;
  await word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 3, bb: 10, stake: 'whatever-it-was' });
  assert.equal(t.seats[0].leaving, undefined, 'his own chair, back');
  assert.ok(!holdem(a).some((m) => m.error), 'no stake asked of him');
}));

test('AUDIT CARDS-4 B3: a room that cannot sign a cash-out seats no stake - its receipt would go out unsigned and the gold stay held', () => withRoom(async ({ r, nowS }) => {
  const b = await join(r, 'peer-b');
  const o = await order(r, nowS(), { s: 'acct-peer-b' });
  await word(r, b, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: o.stake });
  assert.equal(holdem(b).find((m) => m.error)?.error, 'stakes closed');
  assert.equal(r.store.get(`cstake:${o.cj}`), undefined, 'not spent');
}, { gate: false }));

test('AUDIT CARDS-4 B2: two staked first sits at once on one new table - both seated at ONE table, both stakes come home', () => withRoom(async ({ r, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const oa = await order(r, nowS(), { s: 'acct-peer-a' }), ob = await order(r, nowS(), { s: 'acct-peer-b' });
  await Promise.all([word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: oa.stake }), word(r, b, { op: 'sit', table: 0, chair: 1, chairs: 2, bb: 10, stake: ob.stake })]);
  const kept = r.store.get('holdem')?.[0];
  assert.deepEqual(kept.seats.map((x) => x?.stake ?? null), [oa.cj, ob.cj], 'both stakes seated at the one table');
  await word(r, a, { op: 'stand', table: 0 });
  await word(r, b, { op: 'stand', table: 0 });
  const back = [...receipts(a), ...receipts(b)].filter((x, i, all) => all.findIndex((y) => y.j === x.j) === i);
  assert.equal(back.reduce((n, x) => n + x.r, 0), 1000, 'every chip the stakes brought, home');
  assert.deepEqual(back.map((x) => x.j).sort(), [oa.cj, ob.cj].sort());
}));

test('AUDIT CARDS-4 B4: a cash-out whose write threw stays queued with its table, and is signed and owed at the next save - never dropped', () => withRoom(async ({ r, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const o = await order(r, nowS(), { s: 'acct-peer-a' });
  await word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: o.stake });
  const put = r.state.storage.put.bind(r.state.storage);
  let threw = 0;
  r.state.storage.put = async (k, v) => { if (typeof k === 'string' && k.startsWith('cashout:') && !threw++) throw new Error('storage down'); return put(k, v); };
  await word(r, a, { op: 'stand', table: 0 });
  assert.equal(threw, 1);
  assert.deepEqual(receipts(a), [], 'not signed and kept yet');
  assert.equal(r.room._holdem.get(0)?.cashouts?.length, 1, 'still queued, the table kept for it');
  await word(r, b, { op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10 });   // the next save
  assert.deepEqual(receipts(a).map((x) => [x.j, x.r, x.w]), [[o.cj, 500, 'stood']], 'signed and owed');
  assert.equal(r.room._holdem.get(0), undefined, 'and the table gone with its last cash-out');
}));

test('AUDIT CARDS-4 B3/C6: a void too needs a room that can sign; and a void takes an order a receipt\'s life old, not a week', async () => {
  await withRoom(async ({ r, nowS }) => {
    const b = await join(r, 'peer-b');
    const o = await order(r, nowS(), { s: 'acct-peer-b' });
    await word(r, b, { op: 'void', table: 0, stake: o.stake });
    assert.equal(holdem(b).find((m) => m.error)?.error, 'stakes closed');
    assert.equal(r.store.get(`cstake:${o.cj}`), undefined);
  }, { gate: false });
  await withRoom(async ({ r, nowS }) => {
    const b = await join(r, 'peer-b');
    const fortnight = await order(r, nowS() - 20 * 24 * 3600, { s: 'acct-peer-b' });
    await word(r, b, { op: 'void', table: 0, stake: fortnight.stake });
    assert.deepEqual(receipts(b).map((x) => [x.j, x.w]), [[fortnight.cj, 'void']], 'twenty days on, still voided back');
    b.sent.length = 0;
    const stale = await order(r, nowS() - 31 * 24 * 3600, { s: 'acct-peer-b' });
    await word(r, b, { op: 'void', table: 0, stake: stale.stake });
    assert.equal(holdem(b).find((m) => m.error)?.error, 'stake too old');
  });
});
