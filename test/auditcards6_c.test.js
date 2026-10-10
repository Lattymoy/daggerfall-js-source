// AUDIT CARDS-6 (2026-10-09, bible/01-Overview/Audit-Cards-6.md) lanes C and E: THE RELAY'S ILIAC TABLE AND ILIAC HAND
// ONLINE ON THE CLIENT. Driven: the relay itself (server/src/index.js on the fake room) and its pure table
// (net/iliacTable.js) - a ranked result kept owed to both accounts and told again on a hello and a look until the device
// says it holds it, off the table's queue only once kept (C1); a sit's refusals asked before the room's sit budget is
// spent, Iliac's and Hold'em's (C2); a commit that names its game and turn, a stale one refused (C3); no ranked game where
// the room cannot sign (C4); a deck order that vouches for one game, asked again between games (C5); a seat the clock
// passes three turns running stood up, its games unranked (C6); a ranked seat kept a moment for its player's blink, no
// contest when both are gone (C7); a commit said without the table (C8); the last board kept for a watcher (C9); every
// event's own fields checked, a refusal's words never a prototype's (C10). And the host's half online
// (scenes/iliacTableGame.js, ui/iliacTableHud.js) on fake pages over the REAL relay, its frames queued so a pin controls
// the network's order: the setup frozen while the realm vouches and no sit from a panel that left it (E4/E12), the table
// asked again after a new socket (E5), a commit latched once a turn (E3), why said in the game (E9), the wait said
// (E10/E19), a sit on its way stood up on the way out (E11), and a stand pressed as the next game deals conceding nothing
// (E13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeDoc, text, all } from './decorFakes.mjs';
import {
  newIliacTable, iliacSit, iliacSitRefusal, iliacStand, iliacCommit, iliacTick, iliacNextAt, iliacVouch, iliacGone, iliacBack, iliacVoid,
  validIliacIn, validIliacOut, ILIAC_FIRST_MS, ILIAC_TURN_MS, ILIAC_GAP_MS, ILIAC_IDLE_TURNS, ILIAC_GONE_MS, ILIAC_LATE_MS,
} from '../src/net/iliacTable.js';
import { newTable as newHoldemTable, sit as holdemSit, sitRefusal as holdemSitRefusal, stand as holdemStand } from '../src/net/holdemTable.js';
import { RemoteIliacTable } from '../src/systems/iliacRemoteTable.js';
import { openIliacTableGame } from '../src/scenes/iliacTableGame.js';
import { iliacHudModel } from '../src/ui/iliacTableHud.js';
import { giveBinderAtChargen } from '../src/systems/iliacItems.js';
import { STARTER_DECK } from '../src/net/iliacCards.js';
import { ILIAC_TURNS, playsRefusal } from '../src/net/iliacHand.js';
import { mintDeckOrder, deckDigest } from '../src/net/identityToken.js';
import { readIliacReceipt, verifyIliacReceipt } from '../src/net/iliacReceipt.js';

const { subtle } = webcrypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const DECK = [...STARTER_DECK];
const ROOM = 'interior:m100.200';
const ofRoom = (msgs) => msgs.filter((m) => m.to === null);
const toId = (msgs, id) => msgs.filter((m) => m.to === id);
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => ({ b64: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), pub: kp.publicKey }));

// ── the relay on the fake room ──────────────────────────────────────────────────────────────────────────────────
async function withRoom(fn, { gate = true } = {}) {
  const r = fakeRoom(ROOM);
  const g = await gateKey;
  if (gate) r.env.GATE_SIGNING_KEY = g.b64;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms) => { clock += ms; };
  const T = () => r.room._iliac?.get(0);
  const iliac = (ws) => ws.sent.filter((m) => m.t === 'iliac');
  const word = (ws, o) => { tick(300); return r.raw(ws, JSON.stringify({ t: 'iliac', ...o })); };
  const hword = (ws, o) => { tick(300); return r.raw(ws, JSON.stringify({ t: 'holdem', ...o })); };
  const join = async (id, extra = {}) => { const w = r.connect(); await r.hello(w, id, null, { name: id, ...extra }); return w; };
  const sit = (ws, chair, extra = {}) => word(ws, { op: 'sit', table: 0, chair, chairs: 4, deck: DECK, ...extra });
  // a commit for the turn the relay's table is on - what a client's own view names
  const commit = (ws, plays = [], at = {}) => word(ws, { op: 'commit', table: 0, gameNo: T().gameNo, turn: T().game.turn, plays, ...at });
  const orderOf = async (s, deck = DECK, ageS = 0) => { const kp = await r.signer(); return mintDeckOrder({ s, dh: await deckDigest(deck, { subtle }) }, kp.privateKey, { subtle, nowS: Math.floor(clock / 1000) - ageS }); };
  const fire = async (ms) => { tick(ms); await r.fire(); };
  const receipts = (ws) => iliac(ws).filter((m) => typeof m.receipt === 'string').map((m) => m.receipt);
  try { await fn({ r, tick, T, iliac, word, hword, join, sit, commit, orderOf, fire, receipts, gatePub: g.pub, now: () => clock }); } finally { Date.now = realNow; }
}
/** Two ranked seats (acct-peer-a, acct-peer-b) and their first game dealt. */
async function rankedPair(c) {
  const A = await c.join('peer-a'), B = await c.join('peer-b');
  await c.sit(A, 0, { order: await c.orderOf('acct-peer-a') });
  await c.sit(B, 2, { order: await c.orderOf('acct-peer-b') });
  await c.fire(ILIAC_GAP_MS);   // a ranked pair's first game waits the gap (C5/D2)
  return { A, B };
}

test('AUDIT CARDS-6 C1: a ranked result is KEPT, owed to both accounts - a winner whose link was down at the end is told it on his hello and his look, until his device says it holds it (ack); off the table\'s queue only once kept', () => withRoom(async (c) => {
  const { r, T, word, join, receipts, gatePub, now } = c;
  const { A, B } = await rankedPair(c);
  assert.equal(T().ranked, true, 'a ranked game');
  // A's link is down (the runtime has not told the relay): B stands up mid-game, conceding - A's win sent to a dead socket
  A.send = () => { throw new Error('the link is down'); };
  await word(B, { op: 'stand', table: 0 });
  assert.equal(receipts(B).length, 1, 'the loser holds the result');
  assert.equal(T()?.results?.length ?? 0, 0, 'signed and kept: off the queue');
  const owed = r.store.get('iowed:acct-peer-a');
  assert.equal(owed?.length, 1, 'owed to the winner\'s account');
  assert.equal(r.store.get('iowed:acct-peer-b')?.length, 1, 'and to the loser\'s');
  // A back on a new socket, the same id: his hello is told the result, and so is a look - the same signed bytes
  const A2 = r.connect(); await r.hello(A2, 'peer-a', null, { name: 'peer-a' });
  assert.deepEqual(receipts(A2), receipts(B), 'told on the hello');
  const v = await verifyIliacReceipt(receipts(A2)[0], gatePub, { subtle, nowS: Math.floor(now() / 1000) });
  assert.deepEqual([v.ok, v.claims.r, v.claims.h], [true, 0, 'left'], 'his win, signed');
  await word(A2, { op: 'look', table: 0 });
  assert.equal(receipts(A2).length, 2, 'and again on a look, while his device has not said it holds it');
  // the device keeps it and says so: the room owes it no longer
  await word(A2, { op: 'ack', table: 0, j: readIliacReceipt(receipts(A2)[0]).j });
  await word(A2, { op: 'look', table: 0 });
  assert.equal(receipts(A2).length, 2, 'acked: not told again');
  assert.equal(r.store.get('iowed:acct-peer-a'), undefined, 'and forgotten');
  assert.equal(r.store.get('iowed:acct-peer-b')?.length, 1, 'the other account\'s own ack is its own');
  const B2 = await join('peer-b2', { tokenSub: 'acct-peer-b' });
  assert.equal(receipts(B2).length, 1, 'another socket of the account, told on its hello');
  await word(B2, { op: 'sit', table: 0, chair: 1, chairs: 4, deck: DECK });
  assert.equal(receipts(B2).length, 2, 'and a sit hears what its account is owed first');
  // a keep that fails keeps the result on the table's queue, signed again on the next save (AUDIT CARDS-4 B4's rule)
  const put = r.state.storage.put;
  let fail = 1;
  r.state.storage.put = async (k, val) => { if (typeof k === 'string' && k.startsWith('iowed:') && fail > 0) { fail--; throw new Error('the disk'); } return put(k, val); };
  const t = T();
  t.results.push({ j: '00000000000000c1', f: ['acct-peer-a', 'acct-peer-b'], r: 1, h: 'power', to: ['peer-a', 'peer-b'] });
  await r.room._iliacSave();
  assert.equal(T().results.length, 1, 'not kept: still queued');
  await r.room._iliacSave();
  assert.equal(T().results.length, 0, 'kept on the next save');
  assert.ok(r.store.get('iowed:acct-peer-a').some((x) => x.j === '00000000000000c1'));
  r.state.storage.put = put;
  // the host's half: a receipt kept by the claims is acked to the relay at once
  const w = read('src/scenes/worldModes.js');
  assert.ok(w.includes("    if (typeof f?.receipt === 'string' && host.iliacClaims) { const j = readIliacReceipt(f.receipt)?.j; if (j) host.iliacOnline?.send?.({ op: 'ack', table: f.table, j }); }"));
  assert.deepEqual(validIliacIn({ op: 'ack', table: 0, j: '00000000000000c1' }), { op: 'ack', table: 0, j: '00000000000000c1' });
  assert.equal(validIliacIn({ op: 'ack', table: 0, j: 'nope' }), null);
}));

test('AUDIT CARDS-6 C2: a sit\'s own refusals are asked before the room\'s sit budget is spent - a socket sending refused sits (Iliac\'s \'seated\', Hold\'em\'s \'taken\') four a second keeps no other card table \'busy\'; the budget still binds real sits', () => withRoom(async ({ r, tick, iliac, join }) => {
  const X = await join('peer-x'), Y = await join('peer-y'), H = await join('peer-h'), I = await join('peer-i');
  const raw = (ws, o) => r.raw(ws, JSON.stringify(o));
  await raw(X, { t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 4, deck: DECK });
  await raw(Y, { t: 'holdem', op: 'sit', table: 2, chair: 0, chairs: 4, bb: 10 });
  let busy = 0;
  for (let ms = 0; ms < 8000; ms += 250) {
    tick(250);
    await raw(X, { t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 4, deck: DECK });   // refused 'seated'
    await raw(Y, { t: 'holdem', op: 'sit', table: 2, chair: 0, chairs: 4, bb: 10 });   // refused 'seated' at his own chair
    if (ms % 1000 === 0) {
      await raw(H, { t: 'holdem', op: 'sit', table: 4, chair: 0, chairs: 4, bb: 10 });
      if (H.sent.filter((m) => m.t === 'holdem').at(-1)?.error === 'busy') busy++;
      await raw(H, { t: 'holdem', op: 'stand', table: 4 });
      await raw(I, { t: 'iliac', op: 'sit', table: 6, chair: 0, chairs: 4, deck: DECK });
      if (iliac(I).at(-1)?.error === 'busy') busy++;
      await raw(I, { t: 'iliac', op: 'stand', table: 6 });
    }
  }
  assert.ok(iliac(X).some((m) => m.error === 'seated'), 'the griefer is refused');
  assert.equal(busy, 0, 'and spends nobody\'s turn');
  // the budget still binds: six real sits in one instant, at six tables
  const many = [];
  for (let k = 0; k < 6; k++) many.push(await join(`peer-m${k}`));
  for (let k = 0; k < 6; k++) await raw(many[k], { t: 'iliac', op: 'sit', table: 8 + k, chair: 0, chairs: 4, deck: DECK });
  assert.ok(many.some((w) => iliac(w).at(-1)?.error === 'busy'), 'the room\'s sits are still bounded');
  // the pure halves: each refusal its sit's own word, nothing moved; null where the sit seats
  const t = newIliacTable({ chairs: 4 });
  assert.equal(iliacSitRefusal(t, { id: 'a', chair: 4, deck: DECK }), 'no such chair');
  assert.equal(iliacSitRefusal(t, { id: 'a', chair: 0, deck: DECK.slice(1) }), 'bad deck');
  assert.equal(iliacSitRefusal(t, { id: 'a', chair: 0, deck: DECK }), null);
  iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0 });
  assert.equal(iliacSitRefusal(t, { id: 'a', chair: 1, deck: DECK }), 'seated');
  assert.equal(iliacSitRefusal(t, { id: 'b', chair: 0, deck: DECK }), 'taken');
  iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0 });
  const before = JSON.stringify(t);
  assert.equal(iliacSitRefusal(t, { id: 'c', chair: 2, deck: DECK }), 'full');
  assert.equal(iliacSit(t, { id: 'c', name: 'Cat', chair: 2, deck: DECK, now: 0 }), 'full', 'the sit\'s own word');
  assert.equal(JSON.stringify(t), before, 'nothing moved');
  const h = newHoldemTable({ chairs: 4, bb: 10 });
  assert.equal(holdemSitRefusal(h, { id: 'a', chair: 0 }), null);
  holdemSit(h, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  assert.equal(holdemSitRefusal(h, { id: 'b', chair: 0 }), 'taken');
  assert.equal(holdemSitRefusal(h, { id: 'a', chair: 1 }), 'seated');
  assert.equal(holdemSitRefusal(h, { id: 'a', chair: 9 }), 'no such chair');
  assert.equal(holdemSitRefusal(h, { id: 'b', chair: 1, stake: { j: 'x', sub: 's', amount: 500 } }), 'friendly table');
  holdemStand(h, { id: 'a', now: 1 });
  assert.equal(holdemSitRefusal(h, { id: 'a', chair: 0 }), null, 'a chair stood is free again');
}));

test('AUDIT CARDS-6 C3: a commit names the game and the turn it is for - one that crossed the clock\'s turnover is refused \'stale\', never taken as the next turn\'s; the wire requires them', () => withRoom(async (c) => {
  const { r, T, iliac, word, join, sit, commit, fire } = c;
  const A = await join('peer-a'), B = await join('peer-b');
  await sit(A, 0); await sit(B, 2);
  await fire(ILIAC_FIRST_MS);
  await commit(A);
  const seen = { gameNo: T().gameNo, turn: T().game.turn };   // B's view of turn 1
  await fire(T().clockAt - Date.now());   // the clock turns turn 1 over before his word lands
  assert.equal(T().game.turn, 2);
  const hand0 = T().game.players[1].hand.map((x) => x.id);
  const plays = hand0.map((_, card) => ({ card, holding: 0 })).filter((p) => playsRefusal(T().game, 1, [p]) === null).slice(0, 1);
  await word(B, { op: 'commit', table: 0, ...seen, plays });
  assert.equal(iliac(B).at(-1).error, 'stale', 'turn one\'s commit is turn one\'s');
  assert.equal(T().game.players[1].plays, null, 'nothing committed for turn two');
  // Commit pressed twice: the first turns the turn over, the second (for the same turn) is stale - never a pass for the next
  await commit(B);
  const twice = { gameNo: T().gameNo, turn: T().game.turn };
  await commit(A);
  assert.equal(T().game.turn, 3);
  await word(A, { op: 'commit', table: 0, ...twice, plays: [] });
  assert.equal(iliac(A).at(-1).error, 'stale');
  assert.equal(T().game.players[0].plays, null, 'turn three is still his to play');
  await word(A, { op: 'commit', table: 0, gameNo: T().gameNo - 1, turn: T().game.turn, plays: [] });
  assert.equal(iliac(A).at(-1).error, 'stale', 'another game\'s commit is stale too');
  assert.equal(validIliacIn({ op: 'commit', table: 0, plays: [] }), null, 'a commit that names no turn is no commit');
  assert.equal(validIliacIn({ op: 'commit', table: 0, gameNo: 1, turn: ILIAC_TURNS + 1, plays: [] }), null);
  assert.ok(r.room);
}));

test('AUDIT CARDS-6 C4: a room that cannot sign a result seats no ranked game - \'ranked closed\', and a friendly sit still seats', () => withRoom(async ({ iliac, join, sit, orderOf, T }) => {
  const A = await join('peer-a');
  await sit(A, 0, { order: await orderOf('acct-peer-a') });
  assert.equal(iliac(A).at(-1).error, 'ranked closed');
  assert.equal(T()?.seats?.[0] ?? null, null, 'not seated');
  await sit(A, 0);
  assert.equal(T().seats[0].id, 'peer-a', 'friendly, seated');
  assert.equal(T().seats[0].sub, undefined);
}, { gate: false }));

test('AUDIT CARDS-6 C5 (and D2): a deck order vouches for ONE game, and only while it is unexpired at the deal - the room asks a ranked pair for fresh orders as it schedules their next deal (the first one the gap away), checks each as a sit\'s is, and a seat without one plays that game friendly', async () => {
  // pure: the ask, and the first ranked game a gap away; a friendly pair's neither
  const t = newIliacTable({ chairs: 4 });
  iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0, sub: 'acct-a', orderE: 60 });
  const filled = ofRoom(iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 }))[0].frame.events;
  assert.deepEqual(filled.map((e) => e.t), ['sit', 'vouch'], 'each ranked seat asked');
  assert.equal(iliacNextAt(t), ILIAC_GAP_MS, 'and given the gap to answer');
  const f = newIliacTable({ chairs: 4 });
  iliacSit(f, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0 });
  assert.deepEqual(ofRoom(iliacSit(f, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 }))[0].frame.events.map((e) => e.t), ['sit'], 'a friendly seat: no ranked game to ask for');
  assert.equal(iliacNextAt(f), ILIAC_FIRST_MS);
  // pure: an order expired before the deal deals friendly; one vouched again in the gap ranks it
  const x = newIliacTable({ chairs: 4 });
  iliacSit(x, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0, sub: 'acct-a', orderE: 5 });
  iliacSit(x, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 });
  iliacTick(x, ILIAC_GAP_MS, seeded(3));
  assert.equal(x.ranked, false, 'Ann\'s order lapsed before the deal');
  const u = newIliacTable({ chairs: 4 });
  iliacSit(u, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0, sub: 'acct-a', orderE: 5 });
  iliacSit(u, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 });
  assert.equal(iliacVouch(u, { id: 'a', sub: 'acct-a', orderE: 70 }), null);
  iliacTick(u, ILIAC_GAP_MS, seeded(3));
  assert.equal(u.ranked, true, 'vouched again in the gap: ranked');
  const v = newIliacTable({ chairs: 4 });
  iliacSit(v, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0, sub: 'acct-a' });   // no expiry named: never vouched for
  iliacSit(v, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 });
  iliacTick(v, ILIAC_GAP_MS, seeded(3));
  assert.equal(v.ranked, false, 'a ranked seat with no order\'s expiry is never vouched for');
  assert.equal(iliacVouch(u, { id: 'zed', sub: 'acct-z', orderE: 99 }), 'not seated');
  assert.equal(iliacVouch(u, { id: 'a', sub: 'acct-b', orderE: 99 }), 'deck refused', 'an order is its own account\'s');
  assert.equal(iliacVouch(f, { id: 'a', sub: 'acct-a', orderE: 99 }), 'deck refused', 'a friendly seat stays one');
  // the relay: game one on the sit's orders; game two's without a vouch is friendly; checked as a sit's; game three ranked
  await withRoom(async (c) => {
    const { iliac, word, T, fire, orderOf } = c;
    const { A, B } = await rankedPair(c);
    assert.equal(T().ranked, true, 'game one: the sit\'s orders');
    assert.ok(iliac(A).some((m) => m.events?.some((e) => e.t === 'vouch')), 'asked as the table filled');
    await word(B, { op: 'stand', table: 0 });   // B concedes; he sits again for game two with a fresh order
    await c.sit(B, 2, { order: await orderOf('acct-peer-b') });
    await fire(ILIAC_GAP_MS);
    assert.equal(T().gameNo, 2);
    assert.equal(T().ranked, false, 'A\'s order was game one\'s and he did not answer the ask: game two is friendly');
    for (let turn = 1; turn <= ILIAC_TURNS; turn++) { await c.commit(A); await c.commit(B); }
    assert.equal(T().game, null, 'game two over');
    assert.ok(iliac(A).some((m) => m.events?.some((e) => e.t === 'end' && e.gameNo === 2) && m.events.some((e) => e.t === 'vouch')), 'asked again with the end');
    const answer = async (ws, w) => { const n = iliac(ws).length; await word(ws, w); return iliac(ws).slice(n).map((m) => m.error ?? 'frame'); };
    assert.deepEqual(await answer(A, { op: 'vouch', table: 0, order: await orderOf('acct-peer-b') }), ['deck refused'], 'another account\'s order');
    assert.deepEqual(await answer(A, { op: 'vouch', table: 0, order: await orderOf('acct-peer-a', [...DECK.slice(1), 'priest-of-dibella']) }), ['deck refused'], 'another deck\'s order');
    assert.deepEqual(await answer(A, { op: 'vouch', table: 0, order: await orderOf('acct-peer-a') }), [], 'his own, said back with nothing');
    await word(B, { op: 'vouch', table: 0, order: await orderOf('acct-peer-b') });
    await fire(ILIAC_GAP_MS);
    assert.deepEqual([T().gameNo, T().ranked], [3, true], 'both vouched again: ranked');
    // a vouch keeps its order's own expiry too: one fifty-five seconds into its minute has lapsed at the next deal
    for (let turn = 1; turn <= ILIAC_TURNS; turn++) { await c.commit(A); await c.commit(B); }
    await word(A, { op: 'vouch', table: 0, order: await orderOf('acct-peer-a', DECK, 55) });
    await word(B, { op: 'vouch', table: 0, order: await orderOf('acct-peer-b') });
    await fire(ILIAC_GAP_MS);
    assert.deepEqual([T().gameNo, T().ranked], [4, false], 'friendly');
  });
  // the relay keeps the order's own expiry: one sat fifty-five seconds into its minute has lapsed when the gap deals
  await withRoom(async (c) => {
    const { T, fire, orderOf } = c;
    const A = await c.join('peer-a'), B = await c.join('peer-b');
    await c.sit(A, 0, { order: await orderOf('acct-peer-a', DECK, 55) });
    await c.sit(B, 2, { order: await orderOf('acct-peer-b') });
    assert.equal(T().seats[0].sub, 'acct-peer-a', 'seated ranked - the order was good at the sit');
    await fire(ILIAC_GAP_MS);
    assert.deepEqual([T().gameNo, T().ranked], [1, false], 'and lapsed at the deal: friendly');
  });
});

test('AUDIT CARDS-6 C6: a seat the clock passes ILIAC_IDLE_TURNS turns running is stood up, and a ranked game it never committed in counts for nobody; a seat that played and then went idle loses on the board', () => {
  const ranked = () => {
    const t = newIliacTable({ chairs: 4 });
    iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0, sub: 'acct-a', orderE: 60 });
    iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 });
    iliacTick(t, ILIAC_GAP_MS, seeded(5));
    return t;
  };
  // Bob never commits: Ann does, the clock passes Bob, and on the third he is stood up - no result signed
  let t = ranked(), now = ILIAC_GAP_MS, msgs = [];
  assert.equal(t.ranked, true);
  for (let k = 1; k <= ILIAC_IDLE_TURNS; k++) {
    iliacCommit(t, { id: 'a', plays: [], now, gameNo: t.gameNo, turn: t.game.turn });
    now = t.clockAt;
    msgs = iliacTick(t, now, seeded(6));
    assert.equal(!!t.seats[1], k < ILIAC_IDLE_TURNS, `turn ${k}`);
  }
  const evs = ofRoom(msgs).flatMap((m) => m.frame.events);
  const leave = evs.find((e) => e.t === 'leave');
  assert.deepEqual([leave.seat, leave.idle], [1, true], 'stood up by the clock');
  const end = evs.find((e) => e.t === 'end');
  assert.deepEqual([end.winner, end.how, end.ranked], [0, 'left', undefined], 'Ann\'s - but never ranked');
  assert.equal(t.results.length, 0, 'an absent seat\'s game signs nothing');
  // Bob plays a turn, then goes idle: three passes running stand him, and the game counts
  t = ranked(); now = ILIAC_GAP_MS;
  iliacCommit(t, { id: 'a', plays: [], now, gameNo: t.gameNo, turn: 1 });
  iliacCommit(t, { id: 'b', plays: [], now, gameNo: t.gameNo, turn: 1 });
  for (let k = 1; k <= ILIAC_IDLE_TURNS; k++) { iliacCommit(t, { id: 'a', plays: [], now, gameNo: t.gameNo, turn: t.game.turn }); now = t.clockAt; iliacTick(t, now, seeded(6)); }
  assert.equal(t.seats[1], null, 'stood up');
  assert.deepEqual(t.results.map((x) => [x.r, x.h]), [[0, 'left']], 'he was at the table: his loss counts');
  // a commit between the clock's passes resets the run - never three running, never stood
  t = ranked(); now = ILIAC_GAP_MS;
  for (const play of [false, false, true, false, false]) {
    iliacCommit(t, { id: 'a', plays: [], now, gameNo: t.gameNo, turn: t.game.turn });
    if (play) iliacCommit(t, { id: 'b', plays: [], now, gameNo: t.gameNo, turn: t.game.turn });
    else { now = t.clockAt; iliacTick(t, now, seeded(6)); }
  }
  assert.ok(t.seats[1], 'two, a turn played, two: still seated');
});

test('AUDIT CARDS-6 C7: a ranked game keeps a seat whose socket went for ILIAC_GONE_MS - its id no socket\'s, so a stranger saying his id is told no hand; back in time it is his, out of time it concedes; both gone is no contest', () => withRoom(async (c) => {
  const { r, T, iliac, join, fire, receipts, now } = c;
  const { A, B } = await rankedPair(c);
  const goneAt = now();
  await r.drop(A);
  assert.equal(T().game?.over, false, 'the game goes on');
  assert.ok(T().seats[0].away, 'his seat kept');
  assert.notEqual(T().seats[0].id, 'peer-a', 'answering to no socket\'s id');
  assert.ok(iliac(B).at(-1).events.some((e) => e.t === 'gone' && e.seat === 0), 'the other seat told');
  assert.ok(r.alarm.at <= goneAt + ILIAC_GONE_MS, 'the alarm armed for his time');
  // a stranger says his id (its secret went with his socket): no seat, no hand - not on a look, not on the turn's frames
  const S = r.connect(); await r.hello(S, 'peer-a', null, { name: 'stranger', tokenSub: 'acct-evil' });
  await fire(1000);   // an alarm during the grace keeps the seat as it was
  await c.word(S, { op: 'look', table: 0 });
  await c.commit(B);
  await c.word(S, { op: 'commit', table: 0, gameNo: T().gameNo, turn: T().game.turn, plays: [] });
  assert.equal(iliac(S).at(-1).error, 'not seated');
  assert.equal(iliac(S).filter((m) => m.mine).length, 0, 'never his hand');
  assert.ok(T().seats[0].away, 'and never his seat');
  await r.drop(S);
  // A back on a fresh hello with his id and his account, inside his time: the seat is his
  const A2 = r.connect(); await r.hello(A2, 'peer-a', null, { name: 'peer-a' });
  assert.equal(T().seats[0].id, 'peer-a', 'his seat again');
  assert.ok(iliac(A2).some((m) => m.mine?.seat === 0 && m.mine.view.players[0].hand), 'told his own view');
  assert.ok(iliac(B).some((m) => m.events?.some((e) => e.t === 'back' && e.seat === 0)));
  // gone again, past his time: he concedes, ranked
  await r.drop(A2);
  await fire(ILIAC_GONE_MS);
  assert.equal(T().seats[0], null, 'stood up');
  const rc = readIliacReceipt(receipts(B).at(-1));
  assert.deepEqual([rc.r, rc.h], [1, 'left'], 'his loss, signed');
  assert.ok(join);
}));

test('AUDIT CARDS-6 C7: both seats gone - the game is no contest, nothing signed (their kept seats out of time together, or the room drained); a game is never dealt to a kept seat', () => withRoom(async (c) => {
  const { r, T, join, fire, iliac } = c;
  let { A, B } = await rankedPair(c);
  const W = await join('peer-w');   // a watcher keeps the room from draining
  await r.drop(A); await r.drop(B);
  assert.ok(T().seats.every((s) => s.away));
  await fire(ILIAC_GONE_MS);
  const end = iliac(W).flatMap((m) => m.events ?? []).find((e) => e.t === 'end');
  assert.deepEqual([end.winner, end.how, end.ranked], [null, 'void', undefined], 'no contest');
  assert.equal(r.store.get('iowed:acct-peer-a'), undefined, 'nothing signed');
  // the room drained mid-game: no contest too
  A = await join('peer-a'); B = await join('peer-b');
  await c.sit(A, 0, { order: await c.orderOf('acct-peer-a') });
  await c.sit(B, 2, { order: await c.orderOf('acct-peer-b') });
  await fire(ILIAC_GAP_MS);
  assert.equal(T().ranked, true);
  await r.drop(W);
  await r.drop(A); await r.drop(B);
  assert.equal(r.store.get('iowed:acct-peer-a'), undefined, 'the drained room signs nobody\'s loss');
  assert.equal(r.store.get('iowed:acct-peer-b'), undefined);
  // pure: a kept seat is dealt no game, and the clock it needs is its time out
  const t = newIliacTable({ chairs: 4 });
  iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0, sub: 'acct-a', orderE: 60 });
  iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 });
  iliacTick(t, ILIAC_GAP_MS, seeded(2));
  assert.equal(ofRoom(iliacGone(t, { id: 'a', now: ILIAC_GAP_MS + 10 }))[0].frame.events[0].t, 'gone');
  assert.equal(iliacNextAt(t), ILIAC_GAP_MS + 10 + ILIAC_GONE_MS, 'sooner than the turn clock');
  iliacStand(t, { id: 'b', now: ILIAC_GAP_MS + 20 });   // Bob concedes to the absent Ann; the gap passes while she is away
  iliacSit(t, { id: 'c', name: 'Cat', chair: 2, deck: DECK, now: ILIAC_GAP_MS + 30 });
  assert.deepEqual(iliacTick(t, ILIAC_GAP_MS + ILIAC_GONE_MS, seeded(2)).filter((m) => m.frame.events?.some((e) => e.t === 'game')), [], 'no game for a kept seat');
  assert.equal(t.game, null);
  assert.deepEqual(iliacBack(t, { id: 'a', sub: 'acct-other', now: 1 }), [], 'never another account\'s');
  assert.deepEqual(iliacVoid(t, 1), [], 'no game, nothing to let go');
}));

test('AUDIT CARDS-6 C8: a commit that does not turn the turn over is said without the table - the client marks that seat committed; a stateless frame of any other event is refused', () => {
  const t = newIliacTable({ chairs: 4 });
  const me = new RemoteIliacTable({ myId: 'z' });
  const feed = (msgs) => { for (const { to, frame } of msgs) if (to == null || to === 'z') me.apply({ table: 0, now: 1, ...frame }, 1); };
  feed(iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0 }));
  feed(iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0 }));
  feed(iliacTick(t, ILIAC_FIRST_MS, seeded(4)));
  const said = iliacCommit(t, { id: 'a', plays: [], now: ILIAC_FIRST_MS + 1, gameNo: 1, turn: 1 });
  const frame = ofRoom(said)[0].frame;
  assert.equal(frame.state, undefined, 'no table carried');
  assert.ok(JSON.stringify(frame).length < 120, 'a line, not a kilobyte');
  assert.ok(validIliacOut({ table: 0, now: 1, ...frame }), 'the client\'s law takes it');
  assert.equal(me.view().players[0].committed, false);
  feed(said);
  assert.equal(me.view().players[0].committed, true, 'Ann committed, on the table I was told');
  assert.equal(validIliacOut({ table: 0, events: [{ t: 'turn', turn: 2 }] }), false, 'a turn without its table is no frame');
  assert.equal(validIliacOut({ table: 0, events: [] }), false);
});

test('AUDIT CARDS-6 C9: the last board is kept with the end (the spectator\'s view) - a watcher sees the last reveal, never a hand', () => {
  const t = newIliacTable({ chairs: 4 });
  const z = new RemoteIliacTable({ myId: 'z' });
  const feed = (msgs) => { for (const { to, frame } of msgs) if (to == null) z.apply({ table: 0, now: 1, ...frame }, 1); };
  feed(iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0 }));
  feed(iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0 }));
  feed(iliacTick(t, ILIAC_FIRST_MS, seeded(4)));
  let last;
  for (let turn = 1; turn <= ILIAC_TURNS; turn++) { feed(iliacCommit(t, { id: 'a', plays: [], now: 9, gameNo: 1, turn })); last = iliacCommit(t, { id: 'b', plays: [], now: 9, gameNo: 1, turn }); feed(last); }
  const st = ofRoom(last)[0].frame.state;
  assert.equal(st.game, null, 'the game over');
  assert.equal(st.last.view.over, true, 'its last board kept');
  assert.equal(st.last.view.viewer, -1, 'the spectator\'s');
  assert.ok(st.last.view.players.every((p) => p.hand === undefined), 'no hand');
  assert.ok(validIliacOut({ table: 0, now: 1, events: [], state: st }));
  assert.equal(z.view().over, true, 'the watcher\'s view is the last board');
  assert.deepEqual(z.view().names, ['Ann', 'Bob']);
  assert.equal(validIliacOut({ table: 0, events: [], state: { ...st, last: { ...st.last, view: { ...st.last.view, viewer: 0 } } } }), false, 'a seat\'s view is no last board');
});

test('AUDIT CARDS-6 C10: each event is checked for the fields the panel reads off its own kind; a refusal\'s words are the book\'s own, never an inherited name\'s', () => {
  const st = { chairs: 4, gameNo: 1, seats: [null, null], game: null, clockAt: 0, last: null };
  const ok = (e) => validIliacOut({ table: 0, events: [e], state: st });
  assert.equal(ok({ t: 'game' }), false, 'a deal names its holdings');
  assert.equal(ok({ t: 'game', gameNo: 1, holdings: 7 }), false);
  assert.equal(ok({ t: 'game', gameNo: 1, holdings: ['a', 'b'] }), false, 'three of them');
  assert.equal(ok({ t: 'game', gameNo: 1, holdings: ['daggerfall', 'shornhelm', 'wayrest'] }), true);
  assert.equal(ok({ t: 'end', how: 'left' }), false, 'an end names its winner');
  assert.equal(ok({ t: 'end', winner: 0 }), false, 'and how');
  assert.equal(ok({ t: 'end', winner: null, how: 'draw' }), true);
  assert.equal(ok({ t: 'sit', seat: 2, chair: 0, name: 'x' }), false, 'two seats');
  assert.equal(ok({ t: 'commit', seat: '0' }), false);
  assert.equal(ok({ t: 'turn', turn: 'two' }), false);
  assert.equal(ok({ t: 'unveil' }), true, 'the rules\' own words are read by their kind alone');
  assert.equal(validIliacOut({ table: 0, events: [], state: { ...st, last: { winner: 3, how: 'left' } } }), false, 'a last end checked too');
  // the panel: a refusal no book holds is said as it came, never a prototype's member
  const g = openIliacTableGame({
    doc: fakeDoc(), renderer: null, entity: (() => { const e = { name: 'a', items: [], goldPieces: 100 }; giveBinderAtChargen(e); return e; })(), say: () => {}, holdCursor: () => () => false, rand32: seeded(9), now: () => 0,
    day: 1, key: 'tav', grade: 0, friendly: true, regulars: [], frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: () => [0, 0, 1], onHoldem: () => {}, onStand: () => {},
    online: { send: () => true, myId: () => 'a', now: () => 0, table: 0, chairs: 4, chair: 0, rankedWhy: () => null, vouch: async () => ({ ok: false }) },
  });
  for (const word of ['constructor', 'toString', '__proto__']) { g.relay({ table: 0, now: 0, error: word }); assert.equal(g.g.why, word); }
  g.relay({ table: 0, now: 0, error: 'stale' });
  assert.equal(g.g.why, 'Too late - that turn had already turned over.');
  g.close();
});

// ── the host's half on fake pages over the real relay ────────────────────────────────────────────────────────────
/** The real relay (fake room) and the real host half (openIliacTableGame) on fake pages: online.js's send law
 *  (validIliacIn) and receive law (validIliacOut), the words and frames QUEUED so a pin controls the network's order. */
async function world({ gate = true } = {}) {
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const r = fakeRoom(ROOM);
  if (gate) r.env.GATE_SIGNING_KEY = (await gateKey).b64;
  const W = { r, clock: () => clock, tick: (ms) => { clock += ms; }, restore: () => { Date.now = realNow; }, pages: [] };
  W.T = () => r.room._iliac?.get(0);
  W.join = async (id) => {
    const ws = r.connect(); ws.inbox = [];
    const orig = ws.send.bind(ws);
    ws.send = function (s) { orig(s); const m = JSON.parse(s); if (m.t === 'iliac') ws.inbox.push(m); };
    await r.hello(ws, id, null, { name: id });
    return ws;
  };
  W.orderOf = async (s) => { const kp = await r.signer(); return mintDeckOrder({ s, dh: await deckDigest(DECK, { subtle }) }, kp.privateKey, { subtle, nowS: Math.floor(clock / 1000) }); };
  W.page = async (id, { chair = 0, ranked = null, vouch = null, regulars = [] } = {}) => {
    const p = { id, ws: await W.join(id), up: [], game: null, said: [], claims: [], welcomes: 1, gateShut: false, deaf: false };
    p.entity = { name: id, items: [], goldPieces: 100 };
    giveBinderAtChargen(p.entity);
    p.open = () => {
      p.game = openIliacTableGame({
        doc: fakeDoc(), renderer: null, entity: p.entity, say: (t) => p.said.push(t), holdCursor: () => () => false, rand32: seeded(9), now: () => clock,
        day: 1, key: 'tav', grade: 0, friendly: true, regulars,
        frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: (k) => [k, 0, 1], onHoldem: () => {}, onStand: () => p.close(),
        online: {
          send: (w) => { if (p.gateShut) return false; const v = validIliacIn(w); if (!v) return false; p.up.push({ t: 'iliac', ...v }); return true; },
          myId: () => id, now: () => clock, table: 0, chairs: 4, chair, welcomes: () => p.welcomes,
          rankedWhy: () => ranked, vouch: vouch ?? (async () => ({ ok: true, order: await W.orderOf(`acct-${id}`) })),
        },
      });
      return p.game;
    };
    p.close = () => { const g = p.game; p.game = null; g?.close(); };
    p.flushUp = async () => { while (p.up.length) { const m = p.up.shift(); clock += 300; await r.raw(p.ws, JSON.stringify(m)); } };
    p.flushDown = () => {
      while (p.ws.inbox.length) {
        const m = p.ws.inbox.shift();
        if (p.deaf || !validIliacOut(m)) continue;
        if (typeof m.receipt === 'string') p.claims.push(m.receipt);
        p.game?.relay?.({ ...m, at: clock });
      }
    };
    /** A new socket: the old one gone (dropped, or `replaced` - the new hello takes its id while it is open). */
    p.reconnect = async ({ drop = true } = {}) => { if (drop) await r.drop(p.ws); p.ws = await W.join(id); p.welcomes++; p.game?.frame(0); };
    p.words = () => p.up.map((w) => w.op);
    p.msg = () => all(p.game.g.hud.root, 'msg')[0]?.textContent ?? '';
    p.buttons = () => { const out = []; const walk = (n) => { if (n.tag === 'button') out.push(`${n.disabled ? '[x]' : '[ ]'}${n.textContent}`); for (const ch of n.children ?? []) walk(ch); }; walk(p.game.g.hud.root); return out; };
    W.pages.push(p);
    return p;
  };
  W.settle = async () => { for (let k = 0; k < 4; k++) { for (const p of W.pages) await p.flushUp(); for (const p of W.pages) p.flushDown(); } };
  W.fire = async (ms) => { clock += ms; await r.fire(); await W.settle(); };
  /** Two pages seated at table 0 and their first game dealt. */
  W.pair = async (opts = {}) => {
    const A = await W.page('peer-a', { chair: 0, ...opts }), B = await W.page('peer-b', { chair: 2, ...opts });
    A.open(); B.open(); await W.settle();
    A.game.press('deal'); B.game.press('deal');
    await new Promise((res) => setImmediate(res)); await new Promise((res) => setImmediate(res));
    await W.settle();
    await W.fire(ILIAC_FIRST_MS);
    return { A, B };
  };
  return W;
}
const vouchLater = () => { let answer; const asked = []; const fn = (deck) => { asked.push(deck); return new Promise((res) => { answer = res; }); }; return { fn, asked, answer: (v) => answer(v) }; };
const ticks = () => new Promise((res) => setImmediate(res));

test('AUDIT CARDS-6 E3: Commit is pressed once a turn - a second press before the relay answers sends nothing, and the word names its game and turn', async () => {
  const W = await world();
  try {
    const { A, B } = await W.pair();
    B.game.press('commit'); await W.settle();
    A.game.press('commit');
    assert.match(A.buttons().join(' '), /\[x\]Committing\.\.\./, 'latched');
    A.game.press('commit');
    const sent = A.up.filter((w) => w.op === 'commit');
    assert.equal(sent.length, 1, 'one commit');
    assert.deepEqual([sent[0].gameNo, sent[0].turn], [1, 1]);
    await W.settle();
    assert.equal(W.T().game.turn, 2, 'the turn turned over on it');
    assert.equal(W.T().game.players[0].plays, null, 'no pass committed for turn two');
    assert.match(A.buttons().join(' '), /\[ \]Pass this turn/, 'turn two\'s commit is his to press');
    assert.match(A.msg(), /^Turn 2 of 6/);
    // a refusal answers the commit in flight: the latch is let go, his turn his to commit again
    A.game.press('commit');
    A.game.relay({ table: 0, now: W.clock(), error: 'magicka' });
    A.game.press('commit');
    assert.equal(A.up.filter((w) => w.op === 'commit').length, 2, 'pressed again after the refusal');
  } finally { W.restore(); }
});

test('AUDIT CARDS-6 E4/E12: the setup is frozen while the realm vouches - Play a regular, another deck, the box untick do nothing; a vouch that answers after the panel left the setup sits nobody', async () => {
  const W = await world();
  try {
    const v = vouchLater();
    const A = await W.page('peer-a', { chair: 0, ranked: null, vouch: v.fn, regulars: [{ name: 'Ana', seed: 5, chair: 1 }] });
    A.open(); await W.settle();
    A.game.press('ranked');
    A.game.press('deal');
    assert.equal(A.game.g.busy, true, 'asking the realm');
    assert.match(A.buttons().join(' '), /\[x\]Play a regular instead/, 'the regulars greyed');
    A.game.press('regulars');
    assert.equal(A.game.g.mode, 'online', 'Play a regular: nothing');
    A.game.press('ranked');
    assert.equal(A.game.g.rankedOn, true, 'the box: nothing');
    const deck = A.game.g.setup.deck;
    A.game.press('deck', 1);
    assert.equal(A.game.g.setup.deck, deck, 'another deck: nothing');
    v.answer({ ok: true, order: await W.orderOf('acct-peer-a') }); await ticks();
    assert.deepEqual(A.words(), ['sit'], 'the sit, of what was pressed');
    await W.settle();
    assert.equal(W.T().seats[0].sub, 'acct-peer-a', 'ranked, as the box said');
    // a game dealt to others while his vouch is asked: the vouch answers into a watched game - no sit
    const v2 = vouchLater();
    const B = await W.page('peer-b', { chair: 2 }), Z = await W.page('peer-z', { chair: 3, vouch: v2.fn });
    Z.open(); await W.settle();
    Z.game.press('ranked'); Z.game.press('deal');
    B.open(); await W.settle(); B.game.press('deal'); await ticks(); await W.settle();
    await W.fire(ILIAC_FIRST_MS);
    assert.equal(Z.game.g.phase, 'playing', 'watching the game');
    v2.answer({ ok: true, order: await W.orderOf('acct-peer-z') }); await ticks();
    assert.ok(!Z.words().includes('sit'), 'no sit from a panel that left its setup');
  } finally { W.restore(); }
  // the regulars' game keeps the relay's table (its close stands any seat the relay holds him in)
  const W3 = await world();
  try {
    const solo = await W3.page('peer-s', { chair: 1, regulars: [{ name: 'Ana', seed: 5, chair: 3 }] });
    solo.open(); await W3.settle();
    solo.game.press('regulars');
    assert.equal(solo.game.g.mode, 'regulars');
    solo.game.relay({ t: 'iliac', table: 0, now: W3.clock(), events: [{ t: 'leave', seat: 0, chair: 0, name: 'x' }], state: { chairs: 4, gameNo: 9, seats: [null, null], game: null, clockAt: 0, last: null } });
    assert.equal(solo.game.g.remote.state.gameNo, 9, 'the relay\'s table kept in the regulars\' mode');
    assert.equal(solo.game.g.phase, 'setup', 'and never the tavern\'s game\'s panel');
  } finally { W3.restore(); }
});

test('AUDIT CARDS-6 E5: a new socket asks the table again - seated but stood up by the relay meanwhile, the panel says so and goes back to the setup; a game dealt while the frames were lost is the panel\'s game', async () => {
  const W = await world();
  try {
    const { A, B } = await W.pair();
    assert.equal(A.game.g.phase, 'playing');
    // (a) the old socket's close reached the relay first: a friendly game conceded, his seat gone
    A.deaf = true;
    await W.r.drop(A.ws);
    A.deaf = false;
    A.ws = await W.join('peer-a'); A.welcomes++;
    await W.settle();
    assert.equal(A.game.g.phase, 'playing', 'nothing told him yet');
    A.game.frame(0);
    assert.ok(A.words().includes('look'), 'the table asked again');
    await W.settle();
    assert.equal(A.game.g.phase, 'setup', 'back to the setup');
    assert.match(A.msg(), /You are no longer seated at this table\./);
    assert.equal(B.game.g.phase, 'over');
    // a sit the old socket carried and lost: the look's answer says so; one that landed (the socket replaced) is kept
    const C = await W.page('peer-c', { chair: 1 });
    C.open(); await W.settle();
    C.game.press('deal');
    C.up.length = 0;   // the sit went with the old socket
    await C.reconnect();
    await W.settle();
    assert.equal(C.game.g.phase, 'setup');
    assert.equal(C.msg(), 'The table did not hear you sit down - sit again.');
    C.game.press('deal'); C.deaf = true; await W.settle(); C.deaf = false;   // it landed; its echo did not
    await C.reconnect({ drop: false });
    await W.settle();
    assert.equal(C.game.g.phase, 'playing', 'seated, as the relay says');
    assert.equal(C.game.g.seated, true);
    assert.doesNotMatch(C.msg(), /did not hear/);
    // a sit pressed on the NEW socket, its look not yet answered: the answer (no seat yet) loses nothing
    C.close(); await W.settle();
    const D = await W.page('peer-d', { chair: 3 });
    D.open(); await W.settle();
    await D.reconnect();
    D.game.press('deal');
    assert.deepEqual(D.words(), ['look', 'sit']);
    await W.settle();
    assert.equal(D.game.g.seated, true, 'seated');
    assert.doesNotMatch(D.msg(), /did not hear/, 'never told his sit was lost');
    // (b) a socket replaced while frames were lost: the game dealt meanwhile is his game, his old staging gone with it
    const W2 = await world();
    try {
      const P = await W2.pair();
      for (let turn = 1; turn < ILIAC_TURNS; turn++) { P.A.game.press('commit'); P.B.game.press('commit'); await W2.settle(); }
      P.A.game.g.staged = [{ card: 0, holding: 0 }];   // staged on game one's last turn
      P.A.deaf = true;
      P.B.game.press('commit'); await W2.settle();
      await W2.fire(ILIAC_TURN_MS);   // game one ends by the clock
      await W2.fire(ILIAC_GAP_MS);    // game two dealt
      assert.equal(W2.T().gameNo, 2);
      P.A.deaf = false;
      await P.A.reconnect({ drop: false });
      await W2.settle();
      assert.equal(P.A.game.g.phase, 'playing');
      assert.deepEqual(P.A.game.g.staged, [], 'game one\'s staging gone');
      assert.equal(P.A.game.g.remote.view().players[0].hand.length, 4, 'game two\'s hand');
      assert.match(P.A.msg(), /^Turn 1 of 6/);
    } finally { W2.restore(); }
  } finally { W.restore(); }
});

test('AUDIT CARDS-6 E9/E10/E19: the panel says why a press did nothing in the game; the wait said while no game is on (never "Turn 1 of 6 - your magicka 0 of 0"); the next game deals only with both chairs filled, a watcher back at the setup when a chair frees', async () => {
  const W = await world();
  try {
    const A = await W.page('peer-a', { chair: 0 }), B = await W.page('peer-b', { chair: 2 }), Z = await W.page('peer-z', { chair: 3 });
    A.open(); B.open(); await W.settle();
    A.game.press('deal');
    assert.equal(A.msg(), 'Sitting down at the table...', 'the sit on its way');
    await W.settle();
    assert.equal(A.msg(), 'Waiting for another player to sit down.');
    B.game.press('deal'); await W.settle();
    assert.equal(A.msg(), 'Both chairs are filled - the game deals in a moment.');
    assert.doesNotMatch(A.msg(), /magicka 0 of 0/);
    await W.fire(ILIAC_FIRST_MS);
    // a refusal and a dead link in the game: said
    A.gateShut = true;
    A.game.press('commit');
    assert.match(A.msg(), /The relay is not answering - try again\.$/);
    A.gateShut = false;
    A.game.relay({ table: 0, now: W.clock(), error: 'committed' });
    assert.match(A.msg(), /You have committed this turn\.$/);
    // B concedes: A alone waits; Z, who watched, can sit
    Z.open(); await W.settle();
    assert.equal(Z.game.g.phase, 'playing', 'watching');
    B.close(); await W.settle();
    assert.equal(A.game.g.phase, 'over');
    assert.equal(A.msg(), 'Your opponent stands up and concedes - the game is yours. Waiting for another player to sit down.');
    assert.equal(Z.game.g.phase, 'setup', 'a chair free: the setup');
    assert.match(Z.msg(), /^peer-b concedes - peer-a wins\. Sit down and wait for another player\.$/);
    Z.game.press('deal'); await W.settle();
    assert.equal(A.msg(), 'Your opponent stands up and concedes - the game is yours. The next game deals in a moment.', 'both chairs again');
  } finally { W.restore(); }
});

test('AUDIT CARDS-6 E11/E13: a sit on its way is stood up on the way out (no ghost seat); Leave pressed over a game\'s end as the next is dealt concedes nothing - the stand names the game the panel showed', async () => {
  const W = await world();
  try {
    const A = await W.page('peer-a', { chair: 0 });
    A.open(); await W.settle();
    A.game.press('deal');
    A.close();
    assert.deepEqual(A.words(), ['sit', 'stand'], 'the stand follows the sit');
    await W.settle();
    assert.equal(W.T()?.seats.some((s) => s?.id === 'peer-a') ?? false, false, 'no ghost seat');
  } finally { W.restore(); }
  const W2 = await world();
  try {
    const { A, B } = await W2.pair();
    // ranked would be the same; the friendly pair shows the word - game one ends, A presses Leave as game two deals
    for (let turn = 1; turn <= ILIAC_TURNS; turn++) { A.game.press('commit'); B.game.press('commit'); await W2.settle(); }
    assert.equal(A.game.g.phase, 'over');
    W2.tick(ILIAC_GAP_MS); await W2.r.fire();   // game two dealt; its frames not yet down
    A.close();
    const stand = A.up.find((w) => w.op === 'stand');
    assert.equal(stand.gameNo, 1, 'the game his panel showed');
    await W2.settle();
    const end = W2.T().last;
    assert.deepEqual([end.gameNo, end.how, end.winner], [2, 'void', null], 'game two let go - no contest');
    assert.match(B.msg(), /^No contest - the game is let go\./);
  } finally { W2.restore(); }
  // pure: the window and the commit - a stand naming the last game late, or after a commit in the new one, concedes
  const ranked = () => {
    const t = newIliacTable({ chairs: 4 });
    iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0, sub: 'acct-a', orderE: 60 });
    iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0, sub: 'acct-b', orderE: 60 });
    iliacTick(t, ILIAC_GAP_MS, seeded(5));
    return t;
  };
  let t = ranked();
  iliacStand(t, { id: 'a', now: ILIAC_GAP_MS + ILIAC_LATE_MS, gameNo: 0 });
  assert.deepEqual([t.last.how, t.results.length], ['void', 0], 'inside the window: nothing signed');
  t = ranked();
  iliacStand(t, { id: 'a', now: ILIAC_GAP_MS + ILIAC_LATE_MS + 1, gameNo: 0 });
  assert.deepEqual(t.results.map((x) => [x.r, x.h]), [[1, 'left']], 'past it: a concession');
  t = ranked();
  iliacCommit(t, { id: 'a', plays: [], now: ILIAC_GAP_MS + 1, gameNo: 1, turn: 1 });
  iliacStand(t, { id: 'a', now: ILIAC_GAP_MS + 2, gameNo: 0 });
  assert.deepEqual(t.results.map((x) => [x.r, x.h]), [[1, 'left']], 'he committed in it: he saw it');
  t = ranked();
  iliacStand(t, { id: 'a', now: ILIAC_GAP_MS + 2, gameNo: 1 });
  assert.deepEqual(t.results.map((x) => [x.r, x.h]), [[1, 'left']], 'the game he saw: conceded');
  assert.deepEqual(validIliacIn({ op: 'stand', table: 0, gameNo: 3 }), { op: 'stand', table: 0, gameNo: 3 });
  assert.equal(validIliacIn({ op: 'stand', table: 0, gameNo: -1 }), null);
  // the relay passes the stand's game on
  await withRoom(async (c) => {
    const { A, B } = await rankedPair(c);
    await c.word(A, { op: 'stand', table: 0, gameNo: 0 });
    assert.equal(c.T().last.how, 'void', 'the relay\'s stand names the game');
    assert.equal(c.receipts(B).length, 0);
  });
});

test('AUDIT CARDS-6 C5/D2 (the client): a ranked seat answers the relay\'s ask - the table filled, a game ended - with a fresh order of the realm\'s, so the next game is ranked; a refusal is said, the seat plays friendly from then and asks no more', async () => {
  const W = await world();
  try {
    let refuseA = false, askedA = 0;
    const A = await W.page('peer-a', { chair: 0, vouch: async () => { askedA++; return refuseA ? { ok: false, why: 'Your realm character does not hold every card of that deck.' } : { ok: true, order: await W.orderOf('acct-peer-a') }; } });
    const B = await W.page('peer-b', { chair: 2 });   // the page's own vouch: its account's order
    // the realm's answer is WebCrypto's (a digest and a signature, on the thread pool): waited for on the real clock
    const vouched = async () => { const t0 = performance.now(); while ([A, B].some((p) => p.game.g.busy || p.game.g.vouching) && performance.now() - t0 < 10000) await new Promise((res) => setTimeout(res, 1)); };
    const answered = async () => { for (let k = 0; k < 3; k++) { await W.settle(); await vouched(); } await W.settle(); };
    A.open(); B.open(); await W.settle();
    A.game.press('ranked'); B.game.press('ranked');
    A.game.press('deal'); await vouched(); await W.settle();
    assert.equal(askedA, 1, 'the sit\'s order');
    B.game.press('deal'); await answered();
    assert.equal(askedA, 2, 'the table filled: asked again');
    assert.equal(W.T().seats[0].vouchFor, 1);
    await W.fire(ILIAC_GAP_MS);
    assert.deepEqual([W.T().gameNo, W.T().ranked], [1, true], 'game one ranked');
    const play = async () => { for (let turn = 1; turn <= ILIAC_TURNS; turn++) { A.game.press('commit'); B.game.press('commit'); await W.settle(); } await answered(); };
    await play();
    assert.equal(A.game.g.phase, 'over');
    assert.equal(askedA, 3, 'the game ended: asked again in the gap');
    assert.deepEqual(W.T().seats.map((x) => x.vouchFor), [2, 2], 'each seat\'s deck vouched for the next game');
    await W.fire(ILIAC_GAP_MS);
    assert.deepEqual([W.T().gameNo, W.T().ranked], [2, true], 'game two ranked');
    refuseA = true;
    await play();
    assert.match(A.msg(), /Your realm character does not hold every card of that deck\. You play friendly at this table from now\.$/);
    await W.fire(ILIAC_GAP_MS);
    assert.deepEqual([W.T().gameNo, W.T().ranked], [3, false], 'game three friendly');
    await play();
    assert.equal(askedA, 4, 'a seat the realm would not vouch for asks no more');
  } finally { W.restore(); }
});
