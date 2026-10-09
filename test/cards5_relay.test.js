// CARDS5 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 17): THE RELAY DEALS. Driven: the relay's table
// (net/holdemTable.js) - its chairs, its stakes the taverns' own, a sitter's friendly chips, the first deal after the
// second sitter; the deal from the relay's own shuffle, each seat's hole cards in a message to that seat ALONE, the room's
// message a spectator's (no hand, no deck); whose turn and what it may do told to that seat; a word out of turn refused;
// the seat clock checking or folding; a leaver folded out of turn and stood up at the hand's end, a broke seat stood up;
// the words both ways checked - and the relay itself (server/src/index.js on the fake room): two players seated in a
// tavern's room and a third watching, each told only their own cards, the clock on the alarm, a socket gone folded out of
// turn, a table kept across a hibernation, nothing kept outside an interior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newTable, publicView, sit, stand, actAt, tick, nextAt, emptyTable, tableLook, chairOf, validHoldemIn, validHoldemOut,
  HOLDEM_CLOCK_MS, HOLDEM_GAP_MS, HOLDEM_FIRST_MS, HOLDEM_CHIPS_BB, HOLDEM_BBS, HOLDEM_TABLES_MAX,
} from '../src/net/holdemTable.js';
import { TABLE_STAKES } from '../src/systems/cardTableSession.js';
import { parseClient, relaySupportsHoldem, HOLDEM_RELAY_MIN, RELAY_VERSION, HOLDEM_FRAME_MAX } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';

const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const ofRoom = (msgs) => msgs.filter((m) => m.to === null);
const toId = (msgs, id) => msgs.filter((m) => m.to === id);

test('CARDS5 the relay\'s table: its chairs, the taverns\' stakes, the friendly chips, the first deal after the second sitter', () => {
  assert.deepEqual(HOLDEM_BBS, TABLE_STAKES.map((s) => s.bb), 'the relay opens a table at the taverns\' own stakes');
  for (const bad of [{ chairs: 1, bb: 10 }, { chairs: 7, bb: 10 }, { chairs: 4, bb: 7 }, { chairs: 2.5, bb: 10 }]) assert.equal(newTable(bad), null);
  const t = newTable({ chairs: 4, bb: 10 });
  assert.equal(t.sb, 5);
  assert.equal(nextAt(t), null, 'nobody: nothing due');
  assert.equal(sit(t, { id: 'a', name: 'Ann', chair: 4, now: 0 }), 'no such chair');
  const m = sit(t, { id: 'a', name: 'Ann', chair: 1, now: 0 });
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].frame.events.map((e) => [e.t, e.seat]), [['sit', 1]]);
  assert.equal(t.seats[1].stack, HOLDEM_CHIPS_BB * 10);
  assert.equal(sit(t, { id: 'b', name: 'Bob', chair: 1, now: 0 }), 'taken');
  assert.equal(sit(t, { id: 'a', name: 'Ann', chair: 2, now: 0 }), 'seated');
  assert.equal(nextAt(t), null, 'one seat deals nothing');
  sit(t, { id: 'b', name: 'Bob', chair: 3, now: 100 });
  assert.equal(nextAt(t), 100 + HOLDEM_FIRST_MS);
  assert.deepEqual(tick(t, 101, seeded(1)), [], 'not yet');
  assert.equal(chairOf(t, 'b'), 3);
});

test('CARDS5 the deal: the relay\'s shuffle, each seat told its OWN cards alone, the room a spectator\'s view - no hand, no deck', () => {
  const t = newTable({ chairs: 4, bb: 10 });
  sit(t, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  sit(t, { id: 'b', name: 'Bob', chair: 2, now: 0 });
  sit(t, { id: 'c', name: 'Cat', chair: 3, now: 0 });
  const msgs = tick(t, HOLDEM_FIRST_MS, seeded(7));
  const ha = toId(msgs, 'a').find((x) => x.frame.hole), hb = toId(msgs, 'b').find((x) => x.frame.hole);
  assert.ok(ha && hb);
  assert.deepEqual(ha.frame.hole.cards, t.hand.seats[t.handSeats.indexOf(0)].hole, 'Ann told her own two');
  assert.notDeepEqual(ha.frame.hole.cards, hb.frame.hole.cards);
  for (const id of ['a', 'b', 'c']) assert.equal(toId(msgs, id).filter((x) => x.frame.hole).length, 1, `${id}: one hole message, its own`);
  const pub = ofRoom(msgs);
  assert.equal(pub.length, 1);
  const text = JSON.stringify(pub);
  assert.ok(!/"deck"/.test(text), 'the deck never leaves the relay');
  assert.ok(pub[0].frame.state.hand.seats.every((s) => s.hole === null), 'no hand in the room\'s view');
  for (const c of ha.frame.hole.cards) assert.ok(!JSON.stringify(pub[0].frame.state).includes(`"hole":[${c}`), 'nor any hole card');
  const ev = pub[0].frame.events[0];
  assert.deepEqual([ev.t, ev.hand, ev.seats], ['hand', 1, [0, 2, 3]]);
  assert.equal(ev.seed, t.seed, 'the cloth\'s seed travels with the deal');
  assert.notEqual(t.seed, 0, 'drawn from the relay\'s source');
  // the seat to act told what it may do, and until when
  const turn = msgs.find((x) => x.frame.turn);
  assert.equal(turn.to, t.seats[t.handSeats[t.hand.toAct]].id);
  assert.equal(turn.frame.turn.clockAt, HOLDEM_FIRST_MS + HOLDEM_CLOCK_MS);
  // a word out of turn refused; the turn's own taken by the law
  const notMe = ['a', 'b', 'c'].find((id) => id !== turn.to);
  assert.equal(actAt(t, { id: notMe, action: { type: 'fold' }, now: 3000 }), 'not your turn');
  assert.equal(actAt(t, { id: turn.to, action: { type: 'raise', to: 1 }, now: 3000 }), 'refused', 'the law refuses a raise below its least');
  const after = actAt(t, { id: turn.to, action: { type: 'call' }, now: 3000 });
  assert.equal(ofRoom(after)[0].frame.events[0].type, 'call');
  assert.equal(ofRoom(after)[0].frame.events[0].paid, 10);
  // a newcomer looking is told the table, and a seat its own cards again (a reload)
  assert.deepEqual(tableLook(t, 'zed', 3001).map((x) => [x.to, !!x.frame.state, !!x.frame.hole]), [['zed', true, false]]);
  assert.ok(tableLook(t, 'a', 3001).some((x) => x.frame.hole?.cards.join() === ha.frame.hole.cards.join()));
});

test('CARDS5 the clock, the leaver and the broke: a seat out of time checked or folded, a leaver folded out of turn and stood at the hand\'s end', () => {
  const t = newTable({ chairs: 3, bb: 10 });
  sit(t, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  sit(t, { id: 'b', name: 'Bob', chair: 1, now: 0 });
  sit(t, { id: 'c', name: 'Cat', chair: 2, now: 0 });
  tick(t, HOLDEM_FIRST_MS, seeded(3));
  const first = t.seats[t.handSeats[t.hand.toAct]].id;
  assert.equal(nextAt(t), HOLDEM_FIRST_MS + HOLDEM_CLOCK_MS);
  const late = tick(t, HOLDEM_FIRST_MS + HOLDEM_CLOCK_MS, seeded(3));
  const ev = ofRoom(late)[0].frame.events[0];
  assert.deepEqual([ev.type, ev.timeout, ev.seat], ['fold', true, chairOf(t, first)], 'facing the blind, the clock folds');
  // a seat leaves out of turn: folded, still seated (leaving) until the hand's end
  const toAct = t.seats[t.handSeats[t.hand.toAct]].id;
  const other = ['a', 'b', 'c'].find((id) => id !== toAct && id !== first);
  const left = stand(t, { id: other, now: 40000 });
  const lev = ofRoom(left)[0].frame.events;
  assert.equal(lev[0].type, 'fold');
  assert.ok(t.hand === null || t.seats[chairOf(t, other)]?.leaving, 'still in the chair, leaving');
  // the hand over (the leaver's fold left one), he is stood up, and said so
  assert.equal(t.hand, null, 'one left: the hand is over');
  assert.ok(lev.some((e) => e.t === 'showdown'));
  assert.ok(lev.some((e) => e.t === 'leave' && e.name), 'stood up at the hand\'s end');
  assert.equal(chairOf(t, other), -1);
  assert.equal(nextAt(t), 40000 + HOLDEM_GAP_MS);
  // a broke seat stands up too: heads-up all in, the loser out of chips
  const h = newTable({ chairs: 2, bb: 10 });
  sit(h, { id: 'x', name: 'X', chair: 0, now: 0 });
  sit(h, { id: 'y', name: 'Y', chair: 1, now: 0 });
  let out = tick(h, HOLDEM_FIRST_MS, seeded(5));
  for (let i = 0; i < 6 && h.hand; i++) {
    const id = h.seats[h.handSeats[h.hand.toAct]].id;
    const l = out.find((x) => x.frame.turn)?.frame.turn.legal;
    out = actAt(h, { id, action: l?.raise ? { type: 'raise', to: l.raise.max } : { type: 'call' }, now: 3000 + i });
  }
  const evs = ofRoom(out).flatMap((x) => x.frame.events);
  const sd = evs.find((e) => e.t === 'showdown');
  assert.ok(sd?.result.shown, 'shown down');
  assert.ok(sd.holes.every((x) => x && x.length === 2), 'the shown hands said to the room');
  if (!sd.result.payouts.every((p) => p === 1000)) {
    assert.ok(evs.some((e) => e.t === 'leave' && e.broke), 'the broke seat stands up');
    assert.equal(h.seats.filter(Boolean).length, 1);
  }
  stand(h, { id: 'x', now: 9e9 }); stand(h, { id: 'y', now: 9e9 });
  assert.equal(emptyTable(h), true);
  assert.deepEqual(stand(h, { id: 'x', now: 9e9 }), [], 'nobody to stand');
});

test('CARDS5 the words both ways: the client\'s checked by the wire, the relay\'s checked by the client, the frame only for a relay that deals', () => {
  assert.deepEqual(validHoldemIn({ op: 'sit', table: 0, chair: 1, chairs: 4, bb: 10, extra: 1 }), { op: 'sit', table: 0, chair: 1, chairs: 4, bb: 10 });
  for (const bad of [null, {}, { op: 'sit', table: 0, chair: 4, chairs: 4, bb: 10 }, { op: 'sit', table: 0, chair: 0, chairs: 4, bb: 3 }, { op: 'sit', table: HOLDEM_TABLES_MAX, chair: 0, chairs: 4, bb: 10 },
    { op: 'act', table: 0, action: { type: 'raise' } }, { op: 'act', table: 0, action: { type: 'shove' } }, { op: 'deal', table: 0 }]) assert.equal(validHoldemIn(bad), null);
  assert.deepEqual(validHoldemIn({ op: 'act', table: 2, action: { type: 'raise', to: 40, card: 51 } }), { op: 'act', table: 2, action: { type: 'raise', to: 40 } }, 'nothing but the action rides it');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'holdem', op: 'look', table: 3 }), { hasHello: true }), { t: 'holdem', op: 'look', table: 3 });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'holdem', op: 'look', table: 3 }), { hasHello: false }), { error: 'holdem before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'holdem', op: 'look', table: 3, pad: 'x'.repeat(HOLDEM_FRAME_MAX) }), { hasHello: true }), { error: 'frame too large' });
  const t = newTable({ chairs: 2, bb: 2 });
  sit(t, { id: 'a', name: 'A', chair: 0, now: 0 });
  // the relay's frame is `{t, table: index, now, ...message}` - the table's state rides as `state`, never as a second
  // `table` (a spread would have written the state over the index)
  assert.equal(validHoldemOut({ table: 1, events: [{ t: 'sit' }] }), false, 'no state');
  assert.equal(validHoldemOut({ table: 1, events: [{ t: 'sit' }], state: { ...publicView(t), chairs: 9 } }), false);
  assert.equal(validHoldemOut({ table: 1, events: [{ t: 'sit' }], state: publicView(t) }), true);
  assert.equal(validHoldemOut({ table: 1, hole: { handNo: 1, cards: [0, 51] } }), true);
  assert.equal(validHoldemOut({ table: 1, hole: { handNo: 1, cards: [0, 52] } }), false);
  assert.equal(validHoldemOut({ table: 1, error: 'taken' }), true);
  // PIN MOVED (AUDIT CARDS-6 E20): TAVERN CARDS is world178 since the merge (176 on its branch) - main's 176 and 177 deal nothing
  assert.equal(HOLDEM_RELAY_MIN, 178);
  assert.equal(relaySupportsHoldem(RELAY_VERSION), true);
  assert.equal(relaySupportsHoldem('world175'), false, 'the live relay closes on the frame - never sent it');
});

test('CARDS5 the client\'s session: the word sent only to a relay that deals, through its gate; a table\'s frame heard only from the room the player stands in', async () => {
  const { OnlineSession } = await import('../src/net/online.js');
  const { fakeSocketClass } = await import('./fakeSocket.mjs');
  const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
  const link = (v) => {
    const { FakeWS, sockets } = fakeSocketClass();
    let clock = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => clock });
    const heard = []; s.onHoldem = (f) => heard.push(f);
    quiet(() => s.join('interior:m1.2'));
    const ws = sockets[0]; ws.open();
    quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v }));
    return { s, ws, heard, sent: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'holdem'), tick: (ms) => { clock += ms; } };
  };
  const old = link('world175');
  assert.equal(old.s.holdemOk, false);
  assert.equal(old.s.sendHoldem({ op: 'look', table: 0 }), false, 'world175 would close the socket on it');
  assert.equal(old.sent().length, 0);
  const now = link(RELAY_VERSION);
  assert.equal(now.s.holdemOk, true);
  assert.equal(now.s.sendHoldem({ op: 'sit', table: 1, chair: 0, chairs: 2, bb: 2 }), true);
  assert.equal(now.s.sendHoldem({ op: 'deal', table: 1 }), false, 'a word the table does not know');
  assert.deepEqual(now.sent(), [{ t: 'holdem', op: 'sit', table: 1, chair: 0, chairs: 2, bb: 2 }]);
  let more = 0;
  for (let i = 0; i < 20; i++) if (now.s.sendHoldem({ op: 'look', table: 1 })) more++;
  assert.ok(more < 20, 'the gate holds a flood');
  const t = newTable({ chairs: 2, bb: 2 });
  const frame = { t: 'holdem', table: 1, now: 5, ...sit(t, { id: 'aaaa-0001', name: 'A', chair: 0, now: 5 })[0].frame };
  quiet(() => now.s._receive(JSON.stringify(frame), 'interior:m9.9'));
  assert.equal(now.heard.length, 0, 'a halo room\'s table is not this room\'s');
  quiet(() => now.s._receive(JSON.stringify(frame)));
  assert.equal(now.heard.length, 1, 'the room the player stands in');
  quiet(() => now.s._receive(JSON.stringify({ t: 'holdem', table: 1, now: 5, hole: { handNo: 1, cards: [3, 99] } })));
  assert.equal(now.heard.length, 1, 'a card no deck has is no frame');
});

/** The relay over the fake room on a clock of its own. */
async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tickMs = (ms) => { clock += ms; };
  try { await fn({ r, tickMs, now: () => clock }); } finally { Date.now = realNow; }
}
const holdem = (ws) => ws.sent.filter((m) => m.t === 'holdem');

test('CARDS5 the relay: two seated in a tavern\'s room and one watching - each told only their own cards, the clock on the alarm, a leaver folded, a table kept through a hibernation', () => withRoom('interior:m100.200', async ({ r, tickMs }) => {
  const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
  const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
  const c = r.connect(); await r.hello(c, 'peer-c', null, { name: 'Cat' });
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 0, chairs: 4, bb: 10 }));
  await r.raw(b, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 2, chairs: 4, bb: 10 }));
  for (const ws of [a, b, c]) assert.equal(holdem(ws).filter((m) => m.state || m.delta).length, 2, 'every socket in the room sees both sit');
  assert.ok(holdem(a)[0].state && !holdem(a)[1].state, 'CARDS-TIDY: the table whole first, then its changes');
  assert.deepEqual(Object.keys(holdem(a)[1].delta), ['seats'], 'a sit changes the seats alone');
  assert.equal(holdem(a)[1].delta.seats[2].name, 'Bob', 'the name the relay verified');
  assert.ok(Number.isFinite(r.alarm.at), 'the first deal on the alarm');
  // a word to a taken chair is refused to its sender alone
  await r.raw(c, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 2, chairs: 4, bb: 10 }));
  assert.deepEqual(holdem(c).at(-1), { t: 'holdem', table: 0, now: Date.now(), error: 'taken' });
  for (const ws of [a, b, c]) ws.sent.length = 0;
  tickMs(HOLDEM_FIRST_MS);
  await r.fire();
  const holeA = holdem(a).filter((m) => m.hole), holeB = holdem(b).filter((m) => m.hole), holeC = holdem(c).filter((m) => m.hole);
  assert.equal(holeA.length, 1); assert.equal(holeB.length, 1);
  assert.equal(holeC.length, 0, 'the spectator is told no hand');
  assert.notDeepEqual(holeA[0].hole.cards, holeB[0].hole.cards);
  const pub = holdem(c).find((m) => m.state || m.delta?.hand);
  const ph = (pub.state ?? pub.delta).hand;
  assert.ok(ph && ph.seats.every((s) => s.hole === null), 'the watcher sees the public hand');
  for (const card of holeA[0].hole.cards) assert.ok(!JSON.stringify(holdem(b)).includes(`"cards":[${card},`) || holeB[0].hole.cards.includes(card), 'Bob never sees Ann\'s cards');
  assert.ok(holdem(a).concat(holdem(b)).some((m) => m.turn), 'the seat to act is told');
  assert.equal(r.alarm.at, Date.now() + HOLDEM_CLOCK_MS, 'the seat clock on the alarm');
  // the table survives a hibernation: a new object reads it back and runs the clock
  r.wake();
  for (const ws of [a, b, c]) ws.sent.length = 0;
  tickMs(HOLDEM_CLOCK_MS);
  await r.fire();
  assert.ok(holdem(c).some((m) => m.events?.some((e) => e.timeout)), 'the clock ran out after a wake: checked or folded');
  // Ann's socket goes: folded out of turn if a hand holds her, stood up
  for (const ws of [b, c]) ws.sent.length = 0;
  await r.drop(a);
  const evs = holdem(c).flatMap((m) => m.events ?? []);
  assert.ok(evs.some((e) => e.t === 'leave' && e.seat === 0) || evs.some((e) => e.t === 'act' && e.type === 'fold' && e.seat === 0), 'the leaver folded or stood');
  // nothing outside an interior: a table word in a world cell is nothing
  await withRoom('world:100.200', async ({ r: w }) => {
    const x = w.connect(); await w.hello(x, 'peer-x', null, { name: 'Xen' });
    x.sent.length = 0;
    await w.raw(x, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 0, chairs: 2, bb: 2 }));
    assert.equal(holdem(x).length, 0);
    assert.equal(w.store.get('holdem'), undefined);
  });
}));
