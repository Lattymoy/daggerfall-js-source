// KG6 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 10.7 and 19): GOLD AT THE RED TABLE. The table's law
// (net/gambit/gambitTable.js): a gold table's Ready a stake, the same both seats, a friendly table's none; a stake never dealt
// home whole (Not ready, a stand, a broken deal), the deal's pot, the end's cash-outs - the whole pot the winner's,
// nothing the loser's, each stake its own when nobody won; the stored table's stakes checked. The relay itself
// (server/src/index.js on the fake room): the service's stake order checked (its account, room, table and the game's big
// blind) and spent once, the Ready's own refusals asked before the spend, the cash-outs signed and kept (CARDS6's),
// the rated result signed and owed to both accounts (net/gambit/gambitReceipt.js g1) until acked. The realm service's escrow
// (server-account/src/cards.js): The King's Gambit's arm - the mod's online stakes at the gold table alone - and the
// winner's cash-out of the whole pot, bounded by the table's King's Gambit stakes alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  newGambitTable, gambitSit, gambitReady, gambitReadyRefusal, gambitUnready, gambitStand, gambitForfeit, gambitTick,
  gambitVoid, gambitPublicView, gambitTableValid, validGambitIn, validGambitOut, GAMBIT_FIRST_MS,
} from '../../../src/net/gambit/gambitTable.js';
import { GAMBIT_ONLINE_STAKES, GAMBIT_STAKE_BB, gambitStakeOk } from '../../../src/net/gambit/gambitStakes.js';
import { verifyGambitReceipt, readGambitReceipt } from '../../../src/net/gambit/gambitReceipt.js';
import { mintStakeOrder, verifyOrder } from '../../../src/net/identityToken.js';
import { verifyCardReceipt, readCardReceipt, mintCardReceipt } from '../../../src/net/card/cardReceipt.js';
import { HOLDEM_BBS, HOLDEM_GOLD_TABLE } from '../../../src/net/holdemTable.js';
import { autoFill, KG_POINT_BUDGET } from '../../../src/net/kingsGambit.js';
import { payableOf } from '../../../src/net/realm/realmGoldLaw.js';
import { xorshift } from '../../../tools/kgMeasure.mjs';
import { fakeRoom } from '../../fakeRoom.mjs';
import { standService, T0 } from '../../accountDb.mjs';
import { seatRealm } from '../../realmSeat.mjs';

const { subtle } = webcrypto;
const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));
const stakeOf = (j, sub, amount) => ({ j, sub, amount });
/** Two seated at a gold table, each ready with a stake of `amount`, dealt. */
function goldDealt(amount = 50, seed = 3) {
  const t = newGambitTable({ chairs: 4, gold: true }), rand32 = xorshift(seed);
  gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0, sub: 'acct-a' });
  gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0, sub: 'acct-b' });
  gambitReady(t, { id: 'a', army: army(seed), now: 0, stake: stakeOf('ja', 'acct-a', amount) });
  gambitReady(t, { id: 'b', army: army(seed + 1), now: 0, stake: stakeOf('jb', 'acct-b', amount) });
  gambitTick(t, GAMBIT_FIRST_MS, rand32);
  return { t, rand32 };
}

test('KG6 THE STAKES\' LAW: the mod\'s online stakes, one home; a King\'s Gambit stake\'s big blind no Hold\'em table plays (mutants: a stake; the mark)', () => {
  assert.deepEqual(GAMBIT_ONLINE_STAKES, [10, 50, 200, 1000, 5000]);
  assert.ok(!HOLDEM_BBS.includes(GAMBIT_STAKE_BB), 'the escrow tells the games apart by it');
  assert.equal(gambitStakeOk(200), true);
  assert.equal(gambitStakeOk(100), false);
  assert.equal(HOLDEM_GOLD_TABLE, 1);
});

test('KG6 THE GOLD TABLE\'S READY: a stake needed, the same both seats, none at a friendly table; Not ready and a stand before the deal hand a stake home whole; the deal takes both into the pot, the room told each stake and the pot (mutants: the stake needed; the match; the refunds; the pot)', () => {
  const t = newGambitTable({ chairs: 4, gold: true });
  gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0, sub: 'acct-a' });
  gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0, sub: 'acct-b' });
  assert.equal(gambitReady(t, { id: 'a', army: army(1), now: 0 }), 'stake needed');
  assert.equal(gambitReadyRefusal(t, { id: 'a', army: army(1), stake: 60 }), 'stake refused', 'one of the mod\'s stakes');
  const m = gambitReady(t, { id: 'a', army: army(1), now: 0, stake: stakeOf('ja', 'acct-a', 50) });
  assert.equal(m[0].frame.state.seats[0].stake, 50, 'the room told the stake');
  assert.ok(!JSON.stringify(m).includes('acct-a'), 'never the account');
  assert.equal(gambitReady(t, { id: 'a', army: army(1), now: 0, stake: stakeOf('jz', 'acct-a', 50) }), 'ready', 'said once');
  assert.equal(gambitReadyRefusal(t, { id: 'b', army: army(2), stake: 200 }), 'stake differs');
  // Not ready: the stake home whole
  gambitUnready(t, { id: 'a', now: 1 });
  assert.deepEqual(t.cashouts.splice(0), [{ to: 'a', j: 'ja', s: 'acct-a', r: 50, w: 'stood' }]);
  gambitReady(t, { id: 'a', army: army(1), now: 2, stake: stakeOf('ja2', 'acct-a', 200) });
  // a stand before the deal: home whole too
  gambitStand(t, { id: 'a', now: 3 });
  assert.deepEqual(t.cashouts.splice(0), [{ to: 'a', j: 'ja2', s: 'acct-a', r: 200, w: 'stood' }]);
  const f = newGambitTable({ chairs: 4 });
  gambitSit(f, { id: 'c', name: 'Cael', chair: 0, crown: 0, now: 0 });
  assert.equal(gambitReady(f, { id: 'c', army: army(1), now: 0, stake: stakeOf('jc', 'acct-c', 50) }), 'friendly table');
  // the deal: the pot
  const { t: d } = goldDealt(200);
  assert.deepEqual(d.pot.map((x) => x.amount), [200, 200]);
  assert.equal(gambitPublicView(d).pot, 400);
  assert.ok(d.seats.every((s) => s.stake === null), 'the seats\' stakes in the pot');
  assert.ok(validGambitOut({ table: 1, events: [], state: gambitPublicView(d) }));
  assert.ok(gambitTableValid(JSON.parse(JSON.stringify(d))), 'a gold game as it is stored');
  const bent = JSON.parse(JSON.stringify(d)); bent.pot[1].amount = 50;
  assert.equal(gambitTableValid(bent), false, 'two stakes unlike');
});

test('KG6 THE POT AT THE END: the whole of it the winner\'s, nothing the loser\'s - a forfeit, a stand mid-game; each stake its own player\'s when nobody won; a rated result for two accounts, none for one account twice (mutants: the winner\'s sum; the loser\'s nothing; the void; the rated)', () => {
  const { t } = goldDealt(50);
  gambitForfeit(t, { id: 'a', gameNo: 1, now: 10 });
  assert.deepEqual(t.cashouts, [{ to: 'a', j: 'ja', s: 'acct-a', r: 0, w: 'broke' }, { to: 'b', j: 'jb', s: 'acct-b', r: 100, w: 'stood' }]);
  assert.equal(t.results.length, 1);
  assert.deepEqual([t.results[0].f, t.results[0].r, t.results[0].h], [['acct-a', 'acct-b'], 1, 'forfeit']);
  assert.match(t.results[0].j, /^[0-9a-f]{16}$/);
  assert.equal(t.pot, null);
  // a stand mid-game: the stood seat's loss
  const s = goldDealt(1000).t;
  gambitStand(s, { id: 'b', now: 5 });
  assert.deepEqual(s.cashouts.map((x) => [x.s, x.r, x.w]), [['acct-a', 2000, 'stood'], ['acct-b', 0, 'broke']]);
  assert.equal(s.results[0].h, 'left');
  // the room drained: no contest - each stake home, nobody rated
  const v = goldDealt(10).t;
  gambitVoid(v, 5);
  assert.deepEqual(v.cashouts.map((x) => [x.s, x.r, x.w]), [['acct-a', 10, 'void'], ['acct-b', 10, 'void']]);
  assert.equal(v.results.length, 0);
  // one account in both seats is no rated game
  const one = newGambitTable({ chairs: 4 }), rand32 = xorshift(4);
  gambitSit(one, { id: 'x', name: 'X', chair: 0, crown: 0, now: 0, sub: 'acct-x' });
  gambitSit(one, { id: 'y', name: 'Y', chair: 1, crown: 1, now: 0, sub: 'acct-x' });
  gambitReady(one, { id: 'x', army: army(1), now: 0 }); gambitReady(one, { id: 'y', army: army(2), now: 0 });
  gambitTick(one, GAMBIT_FIRST_MS, rand32);
  gambitForfeit(one, { id: 'x', gameNo: 1, now: 9 });
  assert.equal(one.results.length, 0, 'one account twice');
  assert.equal(one.cashouts.length, 0, 'a friendly game owes no gold');
  assert.deepEqual(validGambitIn({ op: 'ack', table: 0, j: '0123456789abcdef' }), { op: 'ack', table: 0, j: '0123456789abcdef' });
  assert.equal(validGambitIn({ op: 'ack', table: 0, j: 'x' }), null);
  assert.ok(validGambitIn({ op: 'ready', table: 1, army: [1], stake: 'x'.repeat(400) }));
});

// ── the relay ─────────────────────────────────────────────────────────────────────────────────────────────────────

const ROOM = 'interior:m100.200';
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => ({ b64: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), pub: kp.publicKey }));
async function withRoom(fn) {
  const r = fakeRoom(ROOM);
  const g = await gateKey;
  r.env.GATE_SIGNING_KEY = g.b64;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000), gatePub: g.pub }); } finally { Date.now = realNow; _tick = () => {}; }
}
let _tick = () => {};
const kg = (ws) => ws.sent.filter((m) => m.t === 'gambit');
const cashouts = (ws) => ws.sent.filter((m) => m.t === 'holdem' && m.cashout).map((m) => m.cashout);
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'gambit', ...o })); };
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
let _cj = 0;
const cj = () => (0xabc000 + ++_cj).toString(16).padStart(20, '0');

test('KG6 THE RELAY AT THE GOLD TABLE: the service\'s order checked - another account\'s, another table\'s, a Hold\'em stake refused unspent - and spent once; a stake unlike the other\'s refused before its spend; the forfeit\'s cash-outs signed (the pot the winner\'s, nothing the loser\'s) and the rated result signed to both accounts, owed until acked; Not ready\'s stake home (mutants: the order\'s checks; the spend; the ready refusal first; the signing; the owed; the ack)', () => withRoom(async ({ r, tick, nowS, gatePub }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const kp = await r.signer();
  const order = (s, ca, extra = {}) => mintStakeOrder({ s, cj: cj(), cr: ROOM, ct: 1, ca, cb: GAMBIT_STAKE_BB, ...extra }, kp.privateKey, { subtle, nowS: nowS() });
  await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
  await word(r, b, { op: 'sit', table: 1, chair: 2, chairs: 4, crown: 1 });
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: await order('acct-peer-b', 50) });
  assert.equal(kg(a).at(-1).error, 'stake refused', 'another account\'s order');
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: await order('acct-peer-a', 50, { ct: 0 }) });
  assert.equal(kg(a).at(-1).error, 'stake elsewhere', 'another table\'s');
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: await order('acct-peer-a', 500, { cb: 10 }) });
  assert.equal(kg(a).at(-1).error, 'stake elsewhere', 'a Hold\'em buy-in');
  const aStake = await order('acct-peer-a', 50);
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: aStake });
  assert.equal(kg(b).at(-1).state.seats[0].stake, 50);
  const aj = (await verifyOrder(aStake, kp.publicKey, { subtle, nowS: nowS(), kind: 'stake' })).claims.cj;
  assert.ok(r.store.get(`cstake:${aj}`), 'spent');
  const unlike = await order('acct-peer-b', 200);
  await word(r, b, { op: 'ready', table: 1, army: army(2), stake: unlike });
  assert.equal(kg(b).at(-1).error, 'stake differs');
  const uj = (await verifyOrder(unlike, kp.publicKey, { subtle, nowS: nowS(), kind: 'stake' })).claims.cj;
  assert.equal(r.store.get(`cstake:${uj}`), undefined, 'refused before its spend - the device voids it back');
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: aStake });
  assert.equal(kg(a).at(-1).error, 'ready', 'said once');
  await word(r, b, { op: 'ready', table: 1, army: army(2), stake: await order('acct-peer-b', 50) });
  tick(GAMBIT_FIRST_MS); await r.fire();
  assert.equal(kg(a).at(-1).state.pot, 100);
  // the host forfeits
  await word(r, a, { op: 'forfeit', table: 1, gameNo: 1 });
  const [ca] = cashouts(a), [cb] = cashouts(b);
  const va = await verifyCardReceipt(ca, gatePub, { subtle, nowS: nowS() }), vb = await verifyCardReceipt(cb, gatePub, { subtle, nowS: nowS() });
  assert.ok(va.ok && vb.ok, `${va.why} ${vb.why}`);
  assert.deepEqual([va.claims.s, va.claims.r, va.claims.w], ['acct-peer-a', 0, 'broke']);
  assert.deepEqual([vb.claims.s, vb.claims.r, vb.claims.w], ['acct-peer-b', 100, 'stood'], 'the whole pot');
  const ra = kg(a).find((m) => m.receipt), rb = kg(b).find((m) => m.receipt);
  assert.equal(ra.receipt, rb.receipt, 'one result, both accounts');
  const g = await verifyGambitReceipt(ra.receipt, gatePub, { subtle, nowS: nowS() });
  assert.ok(g.ok, g.why);
  assert.deepEqual([g.claims.f, g.claims.r, g.claims.h], [['acct-peer-a', 'acct-peer-b'], 1, 'forfeit']);
  assert.ok(validGambitOut(ra));
  // owed until acked
  assert.equal(r.store.get('gowed:acct-peer-a').length, 1);
  await word(r, a, { op: 'ack', table: 1, j: g.claims.j });
  assert.equal(r.store.get('gowed:acct-peer-a'), undefined, 'acked: owed no longer');
  const before = kg(b).filter((m) => m.receipt).length;
  await word(r, b, { op: 'look', table: 1 });
  assert.equal(kg(b).filter((m) => m.receipt).length, before + 1, 'told again on a look until acked');
  // the order spent is spent: a second Ready with it refused
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: aStake });
  assert.equal(kg(a).at(-1).error, 'stake spent');
  // Not ready: the stake home whole
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: await order('acct-peer-a', 10) });
  await word(r, a, { op: 'unready', table: 1 });
  const back = readCardReceipt(cashouts(a).at(-1));
  assert.deepEqual([back.r, back.w], [10, 'stood']);
  assert.ok(readGambitReceipt(ra.receipt));
}));

// ── the realm service's escrow ───────────────────────────────────────────────────────────────────────────────────

test('KG6 THE ESCROW\'S ARM (AUDIT KG C24): a King\'s Gambit stake one of the mod\'s online stakes, at the gold table alone, never a top-up; the winner\'s cash-out the whole pot, the loser\'s nothing - the sum bounded by the table\'s King\'s Gambit stakes alone, never a Hold\'em buy-in there (mutants: the arm; the table; the stake; the sum\'s big blind)', async () => {
  const realNow = Date.now; let now = T0; Date.now = () => now * 1000;
  try {
    const s = await standService({});
    const raw = s.env.DB._raw;
    const DF = 17, ROOMS = 'interior:m100.200.7';
    let rid = 0;
    const seated = async (handle) => {
      const who = await s.registered(handle);
      const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces: 5000 });
      who.character = R.id; who.at = R.at;
      return who;
    };
    const gold = (who) => { const row = raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character); return payableOf(JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))), DF); };
    const stake = (who, extra = {}) => s.call('/v1/cards/stake', { character: who.character, realm: who.at(), region: DF, room: ROOMS, table: 1, bb: GAMBIT_STAKE_BB, amount: 200, rid: `kg6-stake-${String(++rid).padStart(4, '0')}`, ...extra }, who.secret);
    const cashout = (who, receipt) => s.call('/v1/cards/cashout', { character: who.character, realm: who.at(), region: DF, receipt }, who.secret);
    const receipt = (claims) => mintCardReceipt(claims, s.gatePriv, { subtle, nowS: now });
    const A = await seated('Ansel'), B = await seated('Brin');
    assert.equal((await stake(A, { amount: 250 })).body.error, 'bad-buy-in', 'not one of the stakes');
    assert.equal((await stake(A, { table: 0 })).body.error, 'bad-table', 'the gold table alone');
    assert.equal((await stake(A, { topup: true })).body.error, 'bad-buy-in', 'never a top-up');
    const sa = await stake(A), sb = await stake(B);
    assert.equal(sa.status, 200, JSON.stringify(sa.body));
    const o = await verifyOrder(sa.body.stake, s.identityPublic, { subtle, nowS: now, kind: 'stake' });
    assert.deepEqual([o.claims.ct, o.claims.ca, o.claims.cb], [1, 200, GAMBIT_STAKE_BB]);
    assert.equal(gold(A), 4800, 'held');
    // a Hold'em buy-in at the same table is no part of a King's Gambit pot
    const C = await seated('Cass');
    assert.equal((await s.call('/v1/cards/stake', { character: C.character, realm: C.at(), region: DF, room: ROOMS, table: 1, bb: 10, amount: 500, rid: 'kg6-holdem-0001' }, C.secret)).status, 200);
    now += 60;
    const over = await cashout(B, await receipt({ s: B.id, j: sb.body.id, r: 401, w: 'stood' }));
    assert.deepEqual([over.status, over.body.why], [400, 'sum'], 'past the two stakes - a Hold\'em buy-in counts nothing');
    const won = await cashout(B, await receipt({ s: B.id, j: sb.body.id, r: 400, w: 'stood' }));
    assert.equal(won.status, 200, JSON.stringify(won.body));
    assert.equal(gold(B), 5200, 'the whole pot');
    const lost = await cashout(A, await receipt({ s: A.id, j: sa.body.id, r: 0, w: 'broke' }));
    assert.equal(lost.status, 200);
    assert.equal(gold(A), 4800, 'nothing the loser\'s');
  } finally { Date.now = realNow; }
});
