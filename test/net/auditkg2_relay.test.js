// AUDIT KG II (2026-10-15, bible/01-Overview/audits/Audit-Kings-Gambit-II.md, lane A): THE KING'S GAMBIT'S MONEY AT THE
// RELAY, FOUND AND FIXED OR PINNED - a stand pressed over the deal (it names the game its panel showed: no contest, each
// stake home - Iliac Hand's AUDIT CARDS-6 E13); a sit on its way when the panel goes (stood up all the same - E11); and
// the lines no test held: an order for another room refused unspent, the drained room's no contest, a room that cannot
// sign seating no stake, an empty table never forgotten with a cash-out unsigned, a rated result told again at a hello
// and a sit, the stored table's queues only what the relay can sign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  newGambitTable, gambitSit, gambitReady, gambitStand, gambitTick, gambitCommand, gambitTableValid, validGambitIn, GAMBIT_FIRST_MS, GAMBIT_LATE_MS,
} from '../../src/net/gambit/gambitTable.js';
import { GAMBIT_FRAME_MAX, CLOSE_REPLACED } from '../../src/net/wire.js';
import { HOLDEM_STAKE_MAX } from '../../src/net/holdemTable.js';
import { GAMBIT_STAKE_BB } from '../../src/net/gambit/gambitStakes.js';
import { mintStakeOrder, verifyOrder } from '../../src/net/identityToken.js';
import { readCardReceipt, mintCardReceipt } from '../../src/net/card/cardReceipt.js';
import { payableOf } from '../../src/net/realm/realmGoldLaw.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { autoFill, reachable, KG_POINT_BUDGET, KG_TILE } from '../../src/net/kingsGambit.js';
import { openGambitTableGame } from '../../src/scenes/gambitTableGame.js';
import { CARD_TABLE_W, CARD_TABLE_D } from '../../src/world/card/cardTableProp.js';
import { xorshift } from '../../tools/kgMeasure.mjs';
import { fakeDoc } from '../decorFakes.mjs';
import { fakeRoom } from '../fakeRoom.mjs';

const { subtle } = webcrypto;
const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));
const stake = (j, sub, amount) => ({ j, sub, amount });

test('AUDIT KG II A1 THE STAND OVER THE DEAL, THE LAW: a stand naming the game before the one just dealt, within GAMBIT_LATE_MS and before the seat acted, lets the game go - each stake home, nothing rated; after it acted, or later, or naming this game, it concedes (mutants: late; the window; spoke; the game named)', () => {
  const dealt = (seed = 3) => {
    const t = newGambitTable({ chairs: 4, gold: true }), rand32 = xorshift(seed);
    gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0, sub: 'acct-a' });
    gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0, sub: 'acct-b' });
    gambitReady(t, { id: 'a', army: army(seed), now: 0, stake: stake('0000000000000000000a', 'acct-a', 50) });
    gambitReady(t, { id: 'b', army: army(seed + 1), now: 0, stake: stake('0000000000000000000b', 'acct-b', 50) });
    gambitTick(t, GAMBIT_FIRST_MS, rand32);
    return { t, rand32 };
  };
  const cash = (t) => t.cashouts.map((x) => [x.s, x.r, x.w]);
  let { t } = dealt();
  const m = gambitStand(t, { id: 'a', now: GAMBIT_FIRST_MS + 500, gameNo: 0 });
  assert.equal(m[0].frame.events[0].how, 'void', 'the game the panel never showed is let go');
  assert.deepEqual(cash(t), [['acct-a', 50, 'void'], ['acct-b', 50, 'void']], 'each stake home');
  assert.deepEqual(t.results, [], 'nothing rated');
  ({ t } = dealt());
  gambitStand(t, { id: 'a', now: GAMBIT_FIRST_MS + GAMBIT_LATE_MS + 1, gameNo: 0 });
  assert.equal(t.last.how, 'left', 'past the window: conceded');
  ({ t } = dealt());
  gambitStand(t, { id: 'a', now: GAMBIT_FIRST_MS + 500, gameNo: 1 });
  assert.equal(t.last.how, 'left', 'naming the game under way: conceded');
  ({ t } = dealt());
  gambitStand(t, { id: 'a', now: GAMBIT_FIRST_MS + 500 });
  assert.equal(t.last.how, 'left', 'naming no game: conceded');
  const d = dealt();
  const g = d.t.game, p = g.pieces.find((x) => x.side === 0 && !x.king && reachable(g, x).length);
  const [c, r] = reachable(g, p)[0];
  gambitCommand(d.t, { id: 'a', cmd: { type: 'move', piece: p.id, col: c, row: r }, gameNo: 1, now: GAMBIT_FIRST_MS + 100, rand32: d.rand32 });
  assert.equal(d.t.seats[0].spoke, true);
  assert.ok(gambitTableValid(JSON.parse(JSON.stringify(d.t))), 'a seat that acted, as stored');
  gambitStand(d.t, { id: 'a', now: GAMBIT_FIRST_MS + 500, gameNo: 0 });
  assert.equal(d.t.last.how, 'left', 'a seat that acted in the game had seen it');
});

// ── the relay ─────────────────────────────────────────────────────────────────────────────────────────────────────

const ROOM = 'interior:m100.200';
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => ({ b64: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), pub: kp.publicKey }));
let _tick = () => {};
async function withRoom(fn, { sign = true } = {}) {
  const r = fakeRoom(ROOM);
  if (sign) r.env.GATE_SIGNING_KEY = (await gateKey).b64;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000) }); } finally { Date.now = realNow; _tick = () => {}; }
}
const kg = (ws) => ws.sent.filter((m) => m.t === 'gambit');
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'gambit', ...o })); };
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
let _cj = 0;
const cj = () => (0xdef000 + ++_cj).toString(16).padStart(20, '0');
/** Two seated at the gold table (1), each ready with a stake of 50; `deal` dealt. */
async function goldSeated(r, tick, nowS, { deal = true } = {}) {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const kp = await r.signer();
  const order = (s, ca, extra = {}) => mintStakeOrder({ s, cj: cj(), cr: ROOM, ct: 1, ca, cb: GAMBIT_STAKE_BB, ...extra }, kp.privateKey, { subtle, nowS: nowS() });
  await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
  await word(r, b, { op: 'sit', table: 1, chair: 2, chairs: 4, crown: 1 });
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: await order('acct-peer-a', 50) });
  await word(r, b, { op: 'ready', table: 1, army: army(2), stake: await order('acct-peer-b', 50) });
  if (deal) { tick(GAMBIT_FIRST_MS); await r.fire(); }
  return { a, b, kp, order };
}
const cashOf = (r, sub) => (r.store.get(`cashout:${sub}`) ?? []).map((x) => readCardReceipt(x.receipt)).map((c) => [c.r, c.w]);

test('AUDIT KG II A1 THE STAND OVER THE DEAL, AT THE RELAY: a stand naming game 0 heard just after game 1\'s deal - no contest, each stake home, nothing rated (mutants: the relay passes the game named)', () => withRoom(async ({ r, tick, nowS }) => {
  const { a } = await goldSeated(r, tick, nowS);
  await word(r, a, { op: 'stand', table: 1, gameNo: 0 });
  const result = kg(a).flatMap((m) => m.events ?? []).find((e) => e.t === 'result');
  assert.deepEqual([result.gameNo, result.winner, result.how], [1, null, 'void']);
  assert.deepEqual(cashOf(r, 'acct-peer-a'), [[50, 'void']]);
  assert.deepEqual(cashOf(r, 'acct-peer-b'), [[50, 'void']]);
  assert.equal(r.store.get('gowed:acct-peer-a'), undefined, 'nothing rated');
}));

test('AUDIT KG II A3 (a) + (c) THE ORDER\'S ROOM, AND A ROOM THAT CANNOT SIGN: an order naming another room is refused unspent; a relay with no receipt key seats no stake (mutants: the room check; stakes closed)', async () => {
  await withRoom(async ({ r, tick, nowS }) => {
    const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
    const kp = await r.signer();
    await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
    await word(r, b, { op: 'sit', table: 1, chair: 2, chairs: 4, crown: 1 });
    const elsewhere = await mintStakeOrder({ s: 'acct-peer-a', cj: cj(), cr: 'interior:m9.9', ct: 1, ca: 50, cb: GAMBIT_STAKE_BB }, kp.privateKey, { subtle, nowS: nowS() });
    await word(r, a, { op: 'ready', table: 1, army: army(1), stake: elsewhere });
    assert.equal(kg(a).at(-1).error, 'stake elsewhere');
    const j = (await verifyOrder(elsewhere, kp.publicKey, { subtle, nowS: nowS(), kind: 'stake' })).claims.cj;
    assert.equal(r.store.get(`cstake:${j}`), undefined, 'unspent here - the room it names still voids it');
    tick(1);
  });
  await withRoom(async ({ r, nowS }) => {
    const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
    const kp = await r.signer();
    await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
    await word(r, b, { op: 'sit', table: 1, chair: 2, chairs: 4, crown: 1 });
    const o = await mintStakeOrder({ s: 'acct-peer-a', cj: cj(), cr: ROOM, ct: 1, ca: 50, cb: GAMBIT_STAKE_BB }, kp.privateKey, { subtle, nowS: nowS() });
    await word(r, a, { op: 'ready', table: 1, army: army(1), stake: o });
    assert.equal(kg(a).at(-1).error, 'stakes closed', 'a cash-out it could not sign is a stake held for good');
    const j = (await verifyOrder(o, kp.publicKey, { subtle, nowS: nowS(), kind: 'stake' })).claims.cj;
    assert.equal(r.store.get(`cstake:${j}`), undefined);
  }, { sign: false });
});

test('AUDIT KG II A3 (b) THE DRAINED ROOM: a gold game under way when the room drains is no contest - each stake home, nothing rated, nobody\'s win (mutants: the void before the stands)', () => withRoom(async ({ r, tick, nowS }) => {
  await goldSeated(r, tick, nowS);
  r.wake();   // the room's instance gone and back: no socket holds a seat
  await r.room._sweep(ROOM);
  assert.deepEqual(cashOf(r, 'acct-peer-a'), [[50, 'void']]);
  assert.deepEqual(cashOf(r, 'acct-peer-b'), [[50, 'void']]);
  assert.equal(r.store.get('gowed:acct-peer-b'), undefined, 'no rated win for the seat stood second');
  assert.equal(r.store.get('gambit'), undefined, 'the table forgotten once its cash-outs are kept');
}));

test('AUDIT KG II A3 (d) AN EMPTY TABLE OWING A CASH-OUT NOT YET KEPT: kept, never forgotten - and forgotten once it is (mutants: the queue\'s keep)', () => withRoom(async ({ r }) => {
  const t = newGambitTable({ chairs: 4, gold: true });
  t.cashouts.push({ to: null, j: '00000000000000000abc', s: 'acct-peer-a', r: 50, w: 'stood' });
  assert.ok(gambitTableValid(t));
  r.store.set('gambit', { 1: t });
  r.wake();
  await r.room._gambitOf();
  const keep = r.room._holdemReceipt;
  r.room._holdemReceipt = async () => false;   // the write that keeps it refused (AUDIT CARDS-4 B4)
  await r.room._gambitSave();
  assert.equal(r.store.get('gambit')?.[1]?.cashouts?.length, 1, 'kept to sign again');
  r.room._holdemReceipt = keep;
  await r.room._gambitSave();
  assert.equal(r.store.get('gambit'), undefined, 'kept: the empty table forgotten');
  assert.deepEqual(cashOf(r, 'acct-peer-a'), [[50, 'stood']]);
}));

test('AUDIT KG II A3 (e) A RATED RESULT OWED: told again at a hello and at a sit until acked (mutants: the hello\'s owed; the sit\'s owed)', () => withRoom(async ({ r, tick, nowS }) => {
  const { a } = await goldSeated(r, tick, nowS);
  await word(r, a, { op: 'forfeit', table: 1, gameNo: 1 });
  assert.equal(r.store.get('gowed:acct-peer-b').length, 1);
  const b2 = await join(r, 'peer-b');
  assert.equal(kg(b2).filter((m) => m.receipt).length, 1, 'told at the hello');
  await word(r, b2, { op: 'sit', table: 0, chair: 1, chairs: 4, crown: 0 });
  assert.equal(kg(b2).filter((m) => m.receipt).length, 2, 'and at a sit');
}));

test('AUDIT KG II A2 + A1 THE CLIENT\'S STAND: a sit on its way when the panel closes is stood up all the same; every stand names the game the panel showed (mutants: the sit on its way; the game named)', () => {
  const FRAME = { centre: [0, 0.8, 0], axisYaw: Math.PI / 2, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 };
  const CHAIRS = [[0, 0, -0.9], [0.9, 0, 0], [0, 0, 0.9], [-0.9, 0, 0]];
  const open = () => {
    const sent = [];
    const renderer = { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} };
    const g = openGambitTableGame({
      doc: fakeDoc(), renderer, entity: { name: 'me', items: [], goldPieces: 0 }, say() {}, holdCursor: () => () => true, relock() {},
      rand32: () => 7, now: () => 0, day: () => 1, key: 'k', friendly: true, regulars: [], frame: FRAME, mySeatFeet: CHAIRS[3], touch: () => false,
      onHoldem() {}, onIliac() {}, onStand() {},
      online: { send: (w) => { sent.push(w); return true; }, myId: () => 'me', now: () => 0, table: 1, chairs: 4, chair: 3, chairFeet: (k) => CHAIRS[k] },
    });
    return { g, sent };
  };
  const view = (seats, gameNo = 0) => ({ chairs: 4, gameNo, seats, game: null, clockAt: 0, last: null });
  const A = open();
  A.g.relay({ t: 'gambit', table: 1, now: 0, events: [], state: view([null, null]) });
  A.g.press('sit');
  A.g.close();
  assert.deepEqual(A.sent.map((w) => w.op), ['look', 'sit', 'stand'], 'stood up from a sit the relay may yet seat');
  const B = open();
  B.g.relay({ t: 'gambit', table: 1, now: 0, events: [], state: view([null, { id: 'me', name: 'Ves', chair: 3, crown: 0 }], 4) });
  B.g.press('leave');
  assert.deepEqual(B.sent.at(-1), { op: 'stand', gameNo: 4, table: 1 }, 'the game the panel showed');
});

test('AUDIT KG II A8 THE STORED QUEUES, ONLY WHAT THE RELAY CAN SIGN: a result without the seats it goes to, or one account twice, and a cash-out no receipt can carry, are refused as the room loads them (mutants: the queue checks)', () => {
  const t = newGambitTable({ chairs: 4, gold: true });
  const ok = { j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 0, h: 'king', to: ['a', 'b'] };
  t.results.push(ok);
  t.cashouts.push({ to: 'a', j: '00000000000000000abc', s: 'acct-a', r: 50, w: 'stood' });
  assert.ok(gambitTableValid(t));
  const bent = (fn) => { const x = structuredClone(t); fn(x); return gambitTableValid(x); };
  assert.equal(bent((x) => { delete x.results[0].to; }), false, 'no seats to send it to');
  assert.equal(bent((x) => { x.results[0].f = ['acct-a', 'acct-a']; }), false, 'one account twice');
  assert.equal(bent((x) => { x.results[0].j = 'x'; }), false, 'no game id a receipt carries');
  assert.equal(bent((x) => { x.cashouts[0].j = 'not a stake id'; }), false, 'no stake id');
  assert.equal(bent((x) => { x.cashouts[0].s = ''; }), false, 'no account');
  assert.equal(bent((x) => { x.cashouts[0].to = 7; }), false, 'no seat');
});

test('AUDIT KG II A4 THE ESCROW\'S BOUND ON A KING\'S GAMBIT POT: a cash-out no more than twice its own stake - two pots at the table are never one winner\'s (mutants: the pot\'s bound)', async () => {
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
    const stakeIt = (who) => s.call('/v1/cards/stake', { character: who.character, realm: who.at(), region: DF, room: ROOMS, table: 1, bb: GAMBIT_STAKE_BB, amount: 200, rid: `kg2a4-stake-${String(++rid).padStart(4, '0')}` }, who.secret);
    const cashout = (who, receipt) => s.call('/v1/cards/cashout', { character: who.character, realm: who.at(), region: DF, receipt }, who.secret);
    const receipt = (claims) => mintCardReceipt(claims, s.gatePriv, { subtle, nowS: now });
    const [A, B, C, D] = [await seated('Ansel'), await seated('Brin'), await seated('Cass'), await seated('Dov')];
    const sb = await stakeIt(B);
    for (const who of [A, C, D]) assert.equal((await stakeIt(who)).status, 200);
    now += 60;
    const greedy = await cashout(B, await receipt({ s: B.id, j: sb.body.id, r: 600, w: 'stood' }));
    assert.deepEqual([greedy.status, greedy.body.why], [400, 'sum'], 'four stakes came to the table - one pot is two');
    const won = await cashout(B, await receipt({ s: B.id, j: sb.body.id, r: 400, w: 'stood' }));
    assert.equal(won.status, 200, JSON.stringify(won.body));
    assert.equal(gold(B), 5200);
  } finally { Date.now = realNow; }
});

/** A gold game dealt at the table's law, each stake 50, with a host piece standing beside a foe (a blow's roll due). */
function goldBlow(seed = 3) {
  const t = newGambitTable({ chairs: 4, gold: true }), rand32 = xorshift(seed);
  gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0, sub: 'acct-a' });
  gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0, sub: 'acct-b' });
  gambitReady(t, { id: 'a', army: army(seed), now: 0, stake: stake('0000000000000000000a', 'acct-a', 50) });
  gambitReady(t, { id: 'b', army: army(seed + 1), now: 0, stake: stake('0000000000000000000b', 'acct-b', 50) });
  gambitTick(t, GAMBIT_FIRST_MS, rand32);
  const g = t.game;
  g.tiles = g.tiles.map(() => KG_TILE.floor);
  g.hazards = [];
  const atk = g.pieces.find((p) => p.side === 0 && !p.king && !p.ranged), foe = g.pieces.find((p) => p.side === 1 && !p.king);
  for (const p of g.pieces) if (p !== atk && p !== foe) { p.col = p.side ? 14 - (p.id % 7) : p.id % 7; p.row = p.side ? 0 : 12; }
  atk.col = 7; atk.row = 6; foe.col = 7; foe.row = 5;
  return { t, rand32, atk, foe };
}

test('AUDIT KG II E1 A BROKEN SOURCE AT THE GOLD TABLE IS NO CONTEST - at a blow, at a turn\'s end, at the deal: each stake home, nothing rated (mutants: the three voids)', () => {
  const broken = () => -1;
  const cash = (t) => t.cashouts.map((x) => [x.s, x.r, x.w]);
  const v = goldBlow();
  const m = gambitCommand(v.t, { id: 'a', cmd: { type: 'attack', piece: v.atk.id, target: v.foe.id }, gameNo: 1, now: GAMBIT_FIRST_MS + 10, rand32: broken });
  assert.equal(m[0].frame.events[0].how, 'void', 'at a blow');
  assert.deepEqual(cash(v.t), [['acct-a', 50, 'void'], ['acct-b', 50, 'void']]);
  assert.deepEqual(v.t.results, []);
  // at a turn's end: two turns played out, the second's end drawing on the broken source
  const w = goldBlow(5);
  let now = GAMBIT_FIRST_MS + 10, how = null;
  for (let k = 0; k < 6 && w.t.game; k++) {
    const side = w.t.game.turn;
    gambitCommand(w.t, { id: side === 0 ? 'a' : 'b', cmd: { type: 'end' }, gameNo: 1, now, rand32: w.rand32 });
    now = w.t.endAt;
    const out = gambitTick(w.t, now, broken);
    how = out[0]?.frame?.events?.find((e) => e.t === 'result')?.how ?? null;
    if (how) break;
  }
  assert.equal(how, 'void', 'at a turn\'s end that draws');
  assert.deepEqual(cash(w.t), [['acct-a', 50, 'void'], ['acct-b', 50, 'void']]);
  // at the deal
  const d = newGambitTable({ chairs: 4, gold: true });
  gambitSit(d, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0, sub: 'acct-a' });
  gambitSit(d, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0, sub: 'acct-b' });
  gambitReady(d, { id: 'a', army: army(1), now: 0, stake: stake('0000000000000000000c', 'acct-a', 200) });
  gambitReady(d, { id: 'b', army: army(2), now: 0, stake: stake('0000000000000000000d', 'acct-b', 200) });
  gambitTick(d, GAMBIT_FIRST_MS, broken);
  assert.equal(d.game, null);
  assert.deepEqual(cash(d), [['acct-a', 200, 'void'], ['acct-b', 200, 'void']]);
});

test('AUDIT KG II E4 + E9 THE ROOM\'S OWN REFUSALS: a sit in a layer (busy), a second seat for one account, a staked Ready in a layer (stakes closed), and a Ready the table refused after its spend handed back whole as \'refused\' (mutants: the layer\'s sit; one seat an account; the layer\'s stake; the refused cash-out) - ONE-BODY (PIN MOVED): a second tab replaces the first in a place', () => withRoom(async ({ r, tick, nowS }) => {
  const kp = await r.signer();
  const lay = r.connect(); lay.att.ly = 3; await r.hello(lay, 'peer-l', null, { name: 'peer-l' });
  await word(r, lay, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
  assert.equal(kg(lay).at(-1).error, 'busy', 'no table in a layer');
  assert.equal(await r.room._gambitReady({ id: 'peer-l', ly: 3, sub: 'acct-peer-l', key: ROOM }, { table: 1, army: army(1), stake: 'x' }, Date.now()), 'stakes closed');
  // PIN MOVED (ONE-BODY, FIELD BUGS 2026-10-15c): this stood one account's twin tab beside it in the building's room (ROOM)
  // and refused its sit 'account seated'. ROOM is a world room, and a place stands one body an account now
  // (server/src/index.js the hello's one-socket law): the twin's hello closes the first tab (CLOSE_REPLACED) and is the
  // account's one body here, which sits and readies below. The refusal still guards an interior no world room names
  // (net/online.js roomKeyFor's name-keyed room, or any `interior:` key a page opens; a table sits in any interior),
  // where both tabs stand: the second seat's refusal moved there.
  const first = await join(r, 'peer-a');
  const a = r.connect(); await r.hello(a, 'peer-a2', null, { name: 'peer-a2', tokenSub: 'acct-peer-a' });
  assert.equal(first.closed?.code, CLOSE_REPLACED, 'a place: the twin tab replaces the first');
  await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
  const n = fakeRoom('interior:17.Daggerfall.200');
  const n1 = await join(n, 'peer-a'), twin = n.connect(); await n.hello(twin, 'peer-a2', null, { name: 'peer-a2', tokenSub: 'acct-peer-a' });
  assert.equal(n1.closed, null, 'no world room: both tabs stand');
  await word(n, n1, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
  await word(n, twin, { op: 'sit', table: 1, chair: 2, chairs: 4, crown: 1 });
  assert.equal(kg(twin).at(-1).error, 'account seated', 'one seat an account');
  // a Ready refused after its spend: the table changed under the spend's write
  const b = await join(r, 'peer-b');
  await word(r, b, { op: 'sit', table: 1, chair: 2, chairs: 4, crown: 1 });
  const put = r.room.state.storage.put.bind(r.room.state.storage);
  r.room.state.storage.put = async (k, v) => { if (String(k).startsWith('cstake:')) r.room._gambit.get(1).seats[0].ready = true; return put(k, v); };
  const o = await mintStakeOrder({ s: 'acct-peer-a', cj: cj(), cr: ROOM, ct: 1, ca: 50, cb: GAMBIT_STAKE_BB }, kp.privateKey, { subtle, nowS: nowS() });
  await word(r, a, { op: 'ready', table: 1, army: army(1), stake: o });
  r.room.state.storage.put = put;
  assert.equal(kg(a).at(-1).error, 'ready');
  assert.deepEqual(cashOf(r, 'acct-peer-a'), [[50, 'refused']], 'spent, refused: the whole of it back');
  tick(1);
}));

test('AUDIT KG II E12 + E20 THE LONGEST LAWFUL READY FITS ITS FRAME; AN ACCOUNT\'S OWED RESULTS PAST THEIR LIFE SWEPT (mutants: the cap; the gowed sweep)', () => withRoom(async ({ r }) => {
  const longest = JSON.stringify({ t: 'gambit', op: 'ready', table: 15, army: new Array(12).fill(10_000), crown: 3, stake: 'x'.repeat(HOLDEM_STAKE_MAX) });
  assert.ok(validGambitIn({ op: 'ready', table: 15, army: new Array(12).fill(10_000), crown: 3, stake: 'x'.repeat(HOLDEM_STAKE_MAX) }), 'lawful');
  assert.ok(longest.length <= GAMBIT_FRAME_MAX, `${longest.length} within ${GAMBIT_FRAME_MAX}`);
  assert.equal(validGambitIn({ op: 'ready', table: 15, army: [1], stake: 'x'.repeat(HOLDEM_STAKE_MAX + 1) }), null, 'a stake past the order\'s length');
  r.store.set('gowed:acct-old', [{ j: '0123456789abcdef', receipt: 'r', e: Math.floor(Date.now() / 1000) - 1 }]);
  r.store.set('gowed:acct-live', [{ j: '0123456789abcdee', receipt: 'r', e: Math.floor(Date.now() / 1000) + 3600 }]);
  await r.room._sweep(ROOM);
  assert.equal(r.store.get('gowed:acct-old'), undefined, 'past its life: gone');
  assert.ok(r.store.get('gowed:acct-live'), 'still owed: kept');
}));
