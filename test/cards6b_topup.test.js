// CARDS6 follow-up (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 24): A GOLD SEAT'S TOP-UP, AND GOLD OWED
// ELSEWHERE. The relay (server/src/index.js _holdemTopUp, net/holdemTable.js topUp) adds a stake of the seat's own
// account to its stack between hands, never past the table's most, checked before the stake is spent and settled at
// once in a 'joined' receipt (its chips come home in the seat's own); the service (server-account/src/cards.js) holds a
// top-up from HOLDEM_TOPUP_MIN_BB and settles its 'joined' receipt for nothing; the device (net/cardStakes.js) keeps
// where it staked, and the host says on a visit what other rooms still owe this character; the panel offers the top-up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { mintStakeOrder } from '../src/net/identityToken.js';
import { readCardReceipt, mintCardReceipt } from '../src/net/cardReceipt.js';
import { HOLDEM_FIRST_MS, HOLDEM_TOPUP_MIN_BB, validHoldemIn } from '../src/net/holdemTable.js';
import { createCardStakes } from '../src/net/cardStakes.js';
import { cardHudModel, eventLine, HOLDEM_REFUSALS } from '../src/ui/cardTableHud.js';

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
const sid = () => (0xc0000000 + ++n).toString(16).padEnd(20, '0');
async function order(r, nowS, { s, cj = sid(), cr = ROOM, ct = 0, ca = 500, cb = 10 }) {
  const kp = await r.signer();
  return { cj, stake: await mintStakeOrder({ s, cj, cr, ct, ca, cb }, kp.privateKey, { subtle, nowS }) };
}
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };

test('CARDS6 top-up at the relay: between hands onto the stack and settled at once ("joined", nothing back by it); refused unspent in a hand, past the most, for another room or at a chips table; every chip the stakes brought comes home in the seats\' receipts', () => withRoom(async ({ r, tick, nowS }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  const oa = await order(r, nowS(), { s: 'acct-peer-a', ca: 500 }), ob = await order(r, nowS(), { s: 'acct-peer-b', ca: 300 });
  await word(r, a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: oa.stake });
  await word(r, b, { op: 'sit', table: 0, chair: 1, chairs: 2, bb: 10, stake: ob.stake });
  const t = r.room._holdem.get(0);
  const up = await order(r, nowS(), { s: 'acct-peer-a', ca: 200 });
  await word(r, a, { op: 'topup', table: 0, stake: up.stake });
  assert.equal(t.seats[0].stack, 700, 'onto the stack');
  assert.deepEqual(receipts(a).map((x) => [x.j, x.r, x.w]), [[up.cj, 0, 'joined']], 'settled at once - its chips are the seat\'s');
  assert.ok(holdem(b).some((m) => (m.events ?? []).some((e) => e.t === 'topup' && e.amount === 200)), 'the room told');
  a.sent.length = 0;
  await word(r, a, { op: 'topup', table: 0, stake: up.stake });
  assert.equal(holdem(a).find((m) => m.error)?.error, 'stake spent', 'a top-up\'s stake is spent once');
  assert.equal(t.seats[0].stack, 700);
  const refusedUnspent = async (ws, o, why) => {
    ws.sent.length = 0;
    await word(r, ws, { op: 'topup', table: 0, stake: o.stake });
    assert.equal(holdem(ws).find((m) => m.error)?.error, why);
    assert.equal(r.store.get(`cstake:${o.cj}`), undefined, `${why}: not spent - voided back in its room`);
    assert.deepEqual(receipts(ws), []);
  };
  await refusedUnspent(a, await order(r, nowS(), { s: 'acct-peer-a', ca: 400 }), 'bad stake');   // 700 + 400 past the most
  await refusedUnspent(a, await order(r, nowS(), { s: 'acct-peer-a', ca: HOLDEM_TOPUP_MIN_BB * 10 - 1 }), 'bad stake');
  await refusedUnspent(a, await order(r, nowS(), { s: 'acct-peer-a', ca: 200, cr: 'interior:m9.9' }), 'stake elsewhere');
  await refusedUnspent(a, await order(r, nowS(), { s: 'acct-peer-b', ca: 200 }), 'stake refused');
  await refusedUnspent(c, await order(r, nowS(), { s: 'acct-peer-c', ca: 200 }), 'not seated');
  assert.equal(t.seats[0].stack, 700, 'unmoved');
  tick(HOLDEM_FIRST_MS); await r.fire();
  await refusedUnspent(b, await order(r, nowS(), { s: 'acct-peer-b', ca: 200 }), 'in hand');
  const toAct = t.seats[t.handSeats[t.hand.toAct]].id === 'peer-a' ? a : b;
  await word(r, toAct, { op: 'act', table: 0, action: { type: 'fold' } });
  a.sent.length = 0; b.sent.length = 0;
  await word(r, a, { op: 'stand', table: 0 });
  await word(r, b, { op: 'stand', table: 0 });
  assert.equal([...receipts(a), ...receipts(b)].reduce((s, x) => s + x.r, 0), 1000, 'what the seats left with is what the stakes brought, the top-up with them');
  // at a chips table
  const f = await join(r, 'peer-f');
  await word(r, f, { op: 'sit', table: 1, chair: 0, chairs: 2, bb: 10 });
  f.sent.length = 0;
  const fo = await order(r, nowS(), { s: 'acct-peer-f', ca: 200, ct: 1 });
  await word(r, f, { op: 'topup', table: 1, stake: fo.stake });
  assert.equal(holdem(f).find((m) => m.error)?.error, 'friendly table');
  for (const w of ['in hand', 'not seated', 'bad stake', 'friendly table']) assert.ok(HOLDEM_REFUSALS[w], w);
  assert.deepEqual(validHoldemIn({ op: 'topup', table: 0, stake: up.stake }), { op: 'topup', table: 0, stake: up.stake });
  assert.equal(validHoldemIn({ op: 'topup', table: 0 }), null);
}));

test('CARDS6 top-up at the service: a seated player\'s addition held from HOLDEM_TOPUP_MIN_BB (a buy-in from the tavern\'s own); its "joined" receipt settles it for nothing', async () => {
  let now = T0;
  const realNow = Date.now; Date.now = () => now * 1000;
  try {
    const s = await standService({});
    const who = await s.registered('ann');
    const R = await seatRealm(s.env, who.secret, 'ann', { name: 'ann', level: 5, items: [], goldPieces: 5000 });
    const body = (x) => ({ character: R.id, realm: R.at(), region: 17, room: 'interior:m1.2', table: 0, bb: 10, amount: 50, rid: `card-top-${String(++n).padStart(8, '0')}`, ...x });
    assert.equal((await s.call('/v1/cards/stake', body({}), who.secret)).body.error, 'bad-buy-in', 'a sit\'s stake: the tavern\'s buy-in');
    assert.equal((await s.call('/v1/cards/stake', body({ topup: true, amount: HOLDEM_TOPUP_MIN_BB * 10 - 1 }), who.secret)).body.error, 'bad-buy-in');
    const t = (await s.call('/v1/cards/stake', body({ topup: true }), who.secret)).body;
    assert.equal(t.amount, 50, JSON.stringify(t));
    const joined = await mintCardReceipt({ s: who.id, j: t.id, r: 0, w: 'joined' }, s.gatePriv, { subtle, nowS: now });
    const paid = (await s.call('/v1/cards/cashout', { character: R.id, realm: R.at(), receipt: joined }, who.secret)).body;
    assert.deepEqual([paid.ok, paid.gold], [true, 0]);
    assert.equal(s.env.DB._raw.prepare('SELECT status FROM card_stakes WHERE id = ?').get(t.id).status, 'paid');
    assert.equal(await mintCardReceipt({ s: who.id, j: t.id, r: 5, w: 'joined' }, s.gatePriv, { subtle, nowS: now }).then(() => 'minted', () => 'refused'), 'refused', 'a joined receipt carries nothing');
  } finally { Date.now = realNow; }
});

test('CARDS6 gold owed elsewhere: the device keeps where it staked; what other rooms owe this character listed, its own room\'s not; the host says it on a visit; the panel offers the top-up between hands', async () => {
  const store = new Map();
  let ch = 'CH1';
  const book = createCardStakes({ door: { stake: async (q) => ({ ok: true, data: { stake: `o-${q.rid}`, id: sid() } }), cashout: async () => ({ ok: false }) },
    realm: { act: async ({ call }) => call({}) }, wallet: () => ({ gold: () => 9999, pay: () => () => {}, bank: () => {} }), character: () => ch, region: () => 17,
    storage: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => 0 });
  const here = await book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 300, place: 'The Rusty Mug, Daggerfall' });
  const there = await book.stake({ room: 'interior:b', table: 1, bb: 10, amount: 500, place: 'The Bilge, Wayrest' });
  book.seated(here.id); book.seated(there.id);
  assert.deepEqual(book.elsewhere('interior:a'), [{ room: 'interior:b', place: 'The Bilge, Wayrest', amount: 500 }]);
  ch = 'CH2';
  assert.deepEqual(book.elsewhere('interior:a'), [], 'another character\'s are its own');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /cardElsewhereSay\(\); \}   \/\/ CARDS6: a lost stake's answer asked again/);
  assert.match(wm, /say\(`Gold you staked waits at card tables elsewhere - \$\{\[\.\.\.by\]\.map\(\(\[p, n\]\) => `\$\{n\} at \$\{p\}`\)\.join\('; '\)\}\. Each table hands it over when you return\.`\);/);
  assert.match(wm, /if \(!seat \|\| seat\.leaving \|\| \(st\.hand && st\.handSeats\.includes\(me\)\)\) return null;\n\s+const most = Math\.min\(HOLDEM_STAKE_MAX_BB \* st\.bb - seat\.stack, host\.cardStakes\?\.purse\?\.\(\) \?\? 0\);\n\s+return most >= HOLDEM_TOPUP_MIN_BB \* st\.bb \? most : null;/);
  assert.match(wm, /const r = await host\.cardStakes\.stake\(\{ room: host\.cardOnline\.room\(\), table: g\.table, bb: g\.stakes\.bb, amount, topup: true, place: cardPlaceName\(\) \}\);/);
  const model = (topUp, staking = false) => cardHudModel({ phase: 'playing', view: { seats: [], handSeats: [], hand: null, button: -1 }, stakes: { sb: 5, bb: 10 }, gold: true, topUp, staking });
  assert.deepEqual(model(400).actions.find((x) => x.id === 'topup'), { id: 'topup', label: 'Top up 400', enabled: true });
  assert.equal(model(null).actions.find((x) => x.id === 'topup'), undefined);
  assert.equal(model(400, true).actions.find((x) => x.id === 'topup').enabled, false, 'one stake at a time');
  assert.equal(eventLine({ t: 'topup', seat: 0, name: 'Ann', amount: 200 }, ['Ann'], 0), 'You top up by 200 gold.');
});
