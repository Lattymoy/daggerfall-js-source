// AUDIT CARDS-4 (2026-10-08, bible/01-Overview/Audit-Cards-4.md) lane D's mutants, killed: THE DECK ON THE CLOTH
// (world/cardMotion.js gatherMotion, DECK_PLATES, DECK_CARDS; world/cardScene.js the pile and the gathered cards), THE
// DELTA LAW (net/holdemTable.js STATE_KEYS across a hand's end, validHoldemOut's delta refusals; cardRemoteTable.js a
// delta's events), the words' shapes (validHoldemIn's stake and ack, validHoldemOut's cash-out), the table's queue
// bound; the relay forgetting an emptied table's last frame and keeping one cash-out a stake; the device's recover
// asking only this character's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gatherMotion, GATHER_S, GATHER_LIFT, DECK_PLATES, DECK_CARDS, RIFFLE_HALF, RIFFLE_S, riffleAt, CARD_T } from '../src/world/cardMotion.js';
import { DECK_SIZE } from '../src/net/cardLaw.js';
import { CardScene, tablePlaces } from '../src/world/cardScene.js';
import { cardTableSeats, tableFrame } from '../src/world/cardTables.js';
import { newTable, sit, stand, tick, actAt, publicView, stateDelta, STATE_KEYS, validHoldemIn, validHoldemOut, HOLDEM_FIRST_MS, HOLDEM_CASHOUTS_MAX, HOLDEM_STAKE_MAX } from '../src/net/holdemTable.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';
import { createCardStakes, CARD_STAKES_KEY } from '../src/net/cardStakes.js';
import { fakeRoom } from './fakeRoom.mjs';

test('AUDIT CARDS-4 D the gather: a card lifts on its way, turns face down, turns to the deck\'s yaw, and is still once there', () => {
  const m = gatherMotion({ from: { pos: [0, 0, 0], yaw: 0, roll: 0 }, to: [1, 0, 0], yaw: 1, t0: 10 });
  const mid = m.at(10 + (m.t1 - 10) / 2), end = m.at(m.t1);
  assert.ok(mid.pos[1] > GATHER_LIFT * 0.5, 'lifted mid-way');
  assert.ok(mid.roll > 0 && mid.roll < Math.PI, 'turning');
  assert.ok(Math.abs(end.roll - Math.PI) < 1e-9 && Math.abs(end.yaw - 1) < 1e-9, 'face down, square to the deck');
  assert.equal(mid.moving, true);
  assert.equal(end.moving, false, 'still once there');
  assert.equal(DECK_CARDS, DECK_SIZE, 'a deck is the law\'s deck');
  assert.equal(DECK_PLATES, RIFFLE_HALF * 2, 'the squared deck is the riffle\'s two halves - it never pops between them');
  assert.equal(riffleAt(RIFFLE_S / 2, 0, [0, 0, 0], 0).length, DECK_PLATES);
});

test('AUDIT CARDS-4 D the pile: squared face down at rest, a plate a layer, full at the next hand\'s deal, thinning as cards LEAVE the hand, at the new dealer\'s place; the gathered cards land on top of it', () => {
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const places = tablePlaces(tableFrame(table), cardTableSeats(table, () => true), [0, 1, 2]);
  const scene = new CardScene({ places, playerSeat: 0, tableSeed: 1 });
  const pile = (t) => scene.poses(t, null).cards.filter((c) => c.seat === -5);
  scene.onEvent({ t: 'hand', hand: 1, button: 1, seats: [0, 1, 2], at: 1000 }, () => -1);
  const p = pile(1 + RIFFLE_S + 0.001);
  assert.ok(p.every((c) => c.roll === Math.PI && c.settled === true), 'face down, at rest');
  assert.deepEqual(p.map((c) => c.pos[1]), p.map((_, k) => places.seats[1].deck[1] + CARD_T * (0.5 + k)), 'a plate a layer');
  const dealt = scene.cards.filter((c) => c.seat >= 0).sort((a, b) => a.motions[0].t0 - b.motions[0].t0);
  const t4 = dealt[3].motions[0].t0 + 1e-6;
  assert.ok(dealt[3].motions.at(-1).t1 > t4, 'the fourth card still in the air');
  assert.equal(pile(t4).length, Math.ceil((DECK_PLATES * (DECK_CARDS - 4)) / DECK_CARDS), 'thinner as soon as four have left the hand');
  scene.onEvent({ t: 'hand', hand: 2, button: 2, seats: [0, 1, 2], at: 10000 }, () => -1);
  const top = places.seats[2].deck[1] + CARD_T * (0.5 + DECK_PLATES) - 1e-9;
  assert.ok(scene.cards.filter((c) => c.seat === -4 && c.id.startsWith('g')).every((c) => c.motions.at(-1).rest[1] >= top), 'gathered onto the top of the deck');
  const after = pile(10 + GATHER_S + RIFFLE_S + 0.001);
  assert.equal(after.length, DECK_PLATES, 'full at the deal - the gathered cards are the deck\'s');
  const to = places.seats[2].deck;
  assert.ok(after.every((c) => Math.hypot(c.pos[0] - to[0], c.pos[2] - to[2]) < 1e-9), 'at the new dealer\'s place');
});

test('AUDIT CARDS-4 D the delta law across a hand\'s end: every frame from deal to showdown to the next deal, laid over the last, IS the table', () => {
  const t = newTable({ chairs: 2, bb: 10 });
  sit(t, { id: 'a', name: 'A', chair: 0, now: 0 }); sit(t, { id: 'b', name: 'B', chair: 1, now: 0 });
  let x = 7;
  const rand = () => { x = (x * 1103515245 + 12345) >>> 0; return x; };
  let prev = publicView(t), now = 0, seen = new Set();
  for (let step = 0; step < 400 && t.handNo < 4; step++) {
    now += HOLDEM_FIRST_MS;
    if (t.hand && t.hand.toAct >= 0) actAt(t, { id: t.seats[t.handSeats[t.hand.toAct]].id, action: { type: step % 3 ? 'call' : 'fold' }, now });
    else tick(t, now, rand);
    const next = publicView(t), d = stateDelta(prev, next);
    if (d) { for (const k of Object.keys(d)) seen.add(k); assert.deepEqual(JSON.parse(JSON.stringify({ ...prev, ...d })), JSON.parse(JSON.stringify(next))); }
    prev = next;
  }
  for (const k of ['last', 'seed', 'button']) assert.ok(seen.has(k) && STATE_KEYS.includes(k), `${k} changed and was said`);
});

test('AUDIT CARDS-4 D the words\' shapes: a delta of another table\'s chairs, too many seats, or a list is no frame; a delta\'s events reach the cloth; a sit\'s stake, an ack\'s id and a cash-out\'s length are bounded', () => {
  assert.equal(validHoldemOut({ table: 0, events: [], delta: { chairs: 9 } }), false);
  assert.equal(validHoldemOut({ table: 0, events: [], delta: { seats: Array(7).fill(null) } }), false);
  assert.equal(validHoldemOut({ table: 0, events: [], delta: [] }), false);
  const r = new RemoteCardTable({ myId: null });
  const t = newTable({ chairs: 2, bb: 10 });
  r.ingest({ table: 0, events: [], state: publicView(t), n: 0, now: 0, at: 0 });
  sit(t, { id: 'a', name: 'A', chair: 0, now: 0 });
  r.ingest({ table: 0, events: [{ t: 'sit', seat: 0, name: 'A', at: 0 }], delta: stateDelta(publicView(newTable({ chairs: 2, bb: 10 })), publicView(t)), n: 1, now: 0, at: 0 });
  assert.deepEqual(r.drain().map((e) => e.t), ['sit'], 'a delta\'s events are the table\'s');
  assert.equal(validHoldemIn({ op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: 5 }), null);
  assert.equal(validHoldemIn({ op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10, stake: 'x'.repeat(HOLDEM_STAKE_MAX + 1) }), null);
  assert.equal(validHoldemIn({ op: 'ack', table: 0, j: 'not-a-stake' }), null);
  assert.equal(validHoldemOut({ table: 0, cashout: 'c'.repeat(HOLDEM_STAKE_MAX + 1) }), false);
  // the table's queue is bounded
  const g = newTable({ chairs: 2, bb: 10, gold: true });
  for (let i = 0; i < HOLDEM_CASHOUTS_MAX + 10; i++) { sit(g, { id: `p${i}`, name: 'P', chair: 0, now: 0, stake: { j: `${i}`.padStart(20, '0'), sub: 's', amount: 500 } }); stand(g, { id: `p${i}`, now: 0 }); }
  assert.equal(g.cashouts.length, HOLDEM_CASHOUTS_MAX);
});

test('AUDIT CARDS-4 D the relay: an emptied table\'s last frame forgotten - reopened, it is told whole; one owed cash-out a stake', async () => {
  const r = fakeRoom('interior:m1.2');
  const join = async (id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
  const a = await join('peer-a'), c = await join('peer-c');
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const word = (ws, o) => { clock += 300; return r.raw(ws, JSON.stringify({ t: 'holdem', ...o })); };
    await word(a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10 });
    await word(a, { op: 'stand', table: 0 });
    c.sent.length = 0;
    await word(a, { op: 'sit', table: 0, chair: 0, chairs: 2, bb: 10 });
    const f = c.sent.filter((m) => m.t === 'holdem' && m.table === 0).at(-1);
    assert.ok(f.state && !f.delta && f.n === 0, 'reopened: told whole, its first frame');
    await r.room._holdemReceipt(0, 'peer-a', { j: 'e'.repeat(20), s: 'acct-peer-a', r: 5, w: 'stood' });
    await r.room._holdemReceipt(0, 'peer-a', { j: 'e'.repeat(20), s: 'acct-peer-a', r: 5, w: 'stood' });
    assert.equal(r.store.get('cashout:acct-peer-a').length, 1, 'one owed a stake');
  } finally { Date.now = realNow; }
});

test('AUDIT CARDS-4 D the device: recover asks only this character\'s lost requests', async () => {
  const store = new Map([[CARD_STAKES_KEY, [{ rid: 'card-aaaaaaaaaaaaaaaaaaaa', room: 'interior:a', table: 0, bb: 10, amount: 200, c: 'CH2', reg: 17, at: 0 }]]]);
  let asked = 0;
  const book = createCardStakes({ door: { stake: async () => { asked++; return { ok: false, error: 'offline', unknown: true }; }, cashout: async () => ({}) }, realm: { act: async ({ call }) => call({}) },
    wallet: () => ({ gold: () => 0, pay: () => () => {}, bank: () => {} }), character: () => 'CH1', region: () => 17, storage: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => 0 });
  await book.recover();
  assert.equal(asked, 0, 'another character\'s request waits for it');
});
