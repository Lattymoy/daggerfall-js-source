// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 31): THE RELAY DEALS ILIAC HAND. Driven: the relay's
// Iliac table (net/iliacTable.js) - its two seats of a cloth's chairs, a deck the law refuses refused, the first game
// after the second seat; the deal from the relay's own source, each seat's hand in a frame to that seat ALONE, the room a
// spectator's view (no hand, no deck); a commit hidden (the room hears that, never what); the turn turned over once both
// have, or by the clock (a pass); six turns and the end; the next game after the pause; a stand mid-game conceding; a
// ranked game's result queued only between two vouched-for seats of two accounts - and its receipt (net/iliacReceipt.js
// i1), the deck order (identityToken.js `deck`), the wire both ways, and the relay itself (server/src/index.js on the
// fake room): two players seated in a tavern's room and a third watching, the alarm's clock, a ranked game's signed
// result to both, a seat refused at a table Hold'em holds, a table kept across a hibernation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  newIliacTable, iliacSit, iliacStand, iliacCommit, iliacTick, iliacNextAt, iliacLook, iliacEmpty, iliacSeatOf, iliacPublicView,
  validIliacIn, validIliacOut, ILIAC_TURN_MS, ILIAC_FIRST_MS, ILIAC_GAP_MS, ILIAC_ORDER_MAX,
} from '../src/net/iliacTable.js';
import { mintIliacReceipt, readIliacReceipt, verifyIliacReceipt, iliacReceiptValid, ILIAC_RECEIPT_V, ILIAC_HOW, ILIAC_GAME_ID_RE } from '../src/net/iliacReceipt.js';
import { mintArenaReceipt, verifyArenaReceipt } from '../src/net/arenaReceipt.js';
import { mintDeckOrder, verifyOrder, orderValid, deckDigest, deckDigestText, ORDER_KINDS, TITLES } from '../src/net/identityToken.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { parseClient, relaySupportsIliac, ILIAC_RELAY_MIN, RELAY_VERSION, ILIAC_FRAME_MAX } from '../src/net/wire.js';
import { STARTER_DECK } from '../src/net/iliacCards.js';
import { ILIAC_TURNS } from '../src/net/iliacHand.js';
import { fakeRoom } from './fakeRoom.mjs';

const { subtle } = webcrypto;
const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const ofRoom = (msgs) => msgs.filter((m) => m.to === null);
const toId = (msgs, id) => msgs.filter((m) => m.to === id);
const DECK = [...STARTER_DECK];
const ready = (opts = {}) => {
  const t = newIliacTable({ chairs: 4 });
  iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: DECK, now: 0, sub: opts.subA ?? null });
  iliacSit(t, { id: 'b', name: 'Bob', chair: 3, deck: DECK, now: 0, sub: opts.subB ?? null });
  const dealt = iliacTick(t, ILIAC_FIRST_MS, seeded(opts.seed ?? 7));
  return { t, dealt };
};

test('CARDS10 the relay\'s Iliac table: two seats of the cloth\'s chairs, a deck the law refuses refused, the first game after the second seat', () => {
  for (const bad of [{ chairs: 1 }, { chairs: 7 }, { chairs: 2.5 }]) assert.equal(newIliacTable(bad), null);
  const t = newIliacTable({ chairs: 4 });
  assert.equal(iliacNextAt(t), null, 'nobody: nothing due');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 4, deck: DECK, now: 0 }), 'no such chair');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: DECK.slice(1), now: 0 }), 'bad deck', 'twenty-nine cards are no deck');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: [...DECK.slice(1), 'no-such-card'], now: 0 }), 'bad deck');
  const m = iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: DECK, now: 0 });
  assert.deepEqual(m[0].frame.events.map((e) => [e.t, e.seat, e.chair]), [['sit', 0, 1]]);
  assert.equal(iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0 }), 'taken');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 2, deck: DECK, now: 0 }), 'seated');
  assert.equal(iliacNextAt(t), null, 'one seat deals nothing');
  iliacSit(t, { id: 'b', name: 'Bob', chair: 3, deck: DECK, now: 100 });
  assert.equal(iliacSit(t, { id: 'c', name: 'Cat', chair: 0, deck: DECK, now: 100 }), 'full', 'a game of two');
  assert.equal(iliacNextAt(t), 100 + ILIAC_FIRST_MS);
  assert.deepEqual(iliacTick(t, 101, seeded(1)), [], 'not yet');
  assert.equal(iliacSeatOf(t, 'b'), 1);
  assert.ok(!JSON.stringify(iliacPublicView(t)).includes('"deck"'), 'a seat\'s deck never leaves the relay');
});

test('CARDS10 the deal: the relay\'s source, each seat told ITS OWN hand alone, the room a spectator\'s view; a commit hidden; the turn turned over once both have', () => {
  const { t, dealt } = ready();
  assert.equal(t.gameNo, 1);
  const own = (id) => toId(dealt, id).find((x) => x.frame.mine);
  const va = own('a').frame.mine.view, vb = own('b').frame.mine.view;
  assert.equal(va.viewer, 0); assert.equal(vb.viewer, 1);
  assert.equal(va.players[0].hand.length, 4, 'his own four');
  assert.equal(va.players[1].hand, undefined, 'never the other\'s');
  const pub = ofRoom(dealt);
  assert.equal(pub.length, 1);
  assert.equal(pub[0].frame.state.game.viewer, -1);
  assert.ok(pub[0].frame.state.game.players.every((p) => p.hand === undefined), 'no hand in the room\'s view');
  assert.ok(!JSON.stringify(pub).includes('"deck"'));
  for (const c of va.players[0].hand) assert.ok(!JSON.stringify(pub[0].frame.state).includes(`"uid":${c.uid},"id"`), 'nor any card of a hand');
  assert.deepEqual(pub[0].frame.events.map((e) => e.t), ['game']);
  assert.equal(pub[0].frame.state.clockAt, ILIAC_FIRST_MS + ILIAC_TURN_MS);
  // a commit is heard, never seen; a second turns the turn over
  assert.equal(iliacCommit(t, { id: 'zed', plays: [], now: 1 }), 'not seated');
  const one = iliacCommit(t, { id: 'a', plays: [{ card: 0, holding: 0 }], now: 3000 });
  const heard = ofRoom(one)[0].frame;
  assert.deepEqual(heard.events.map((e) => [e.t, e.seat]), [['commit', 0]]);
  assert.ok(!JSON.stringify(heard).includes('"plays":[{'), 'the room hears that he committed, never what');
  assert.deepEqual(toId(one, 'a')[0].frame.mine.view.players[0].plays, [{ card: 0, holding: 0 }], 'he sees his own');
  assert.equal(iliacCommit(t, { id: 'a', plays: [], now: 3001 }), 'committed');
  const two = iliacCommit(t, { id: 'b', plays: [], now: 3500 });
  const ev = ofRoom(two)[0].frame.events.map((e) => e.t);
  assert.deepEqual([ev[0], ev[1]], ['commit', 'order']);
  assert.ok(ev.includes('turn'), 'turn two');
  assert.equal(t.game.turn, 2);
  assert.equal(t.clockAt, 3500 + ILIAC_TURN_MS, 'the clock again');
  assert.equal(toId(two, 'a').length + toId(two, 'b').length, 2, 'each seat its new view');
  // a look: the room's table, and a seat's own view again (a reload)
  assert.deepEqual(iliacLook(t, 'zed').map((x) => [x.to, !!x.frame.state, !!x.frame.mine]), [['zed', true, false]]);
  assert.ok(iliacLook(t, 'a').some((x) => x.frame.mine?.seat === 0));
});

test('CARDS10 the clock passes for a seat that has not committed; six turns and the end; the next game after the pause; a stand concedes; ranked only between two vouched-for accounts', () => {
  const { t } = ready();
  let now = ILIAC_FIRST_MS;
  iliacCommit(t, { id: 'a', plays: [], now });
  assert.deepEqual(iliacTick(t, now + ILIAC_TURN_MS - 1, seeded(2)), [], 'not yet');
  const timed = iliacTick(t, now + ILIAC_TURN_MS, seeded(2));
  assert.deepEqual(ofRoom(timed)[0].frame.events.filter((e) => e.t === 'commit').map((e) => [e.seat, e.timeout]), [[1, true]], 'Bob passes by the clock');
  now += ILIAC_TURN_MS;
  let last;
  for (let turn = 2; turn <= ILIAC_TURNS; turn++) { iliacCommit(t, { id: 'a', plays: [], now }); last = iliacCommit(t, { id: 'b', plays: [], now: now + 1 }); now += 2; }
  const end = ofRoom(last)[0].frame.events.find((e) => e.t === 'end');
  assert.ok(end, 'the end said');
  assert.equal(end.how, 'draw', 'two passing players draw');
  assert.equal(end.winner, null);
  assert.equal(t.game, null);
  assert.equal(t.results.length, 0, 'a friendly game queues nothing');
  assert.equal(toId(last, 'a').length, 1, 'each seat its last board');
  assert.equal(toId(last, 'a')[0].frame.mine.view.over, true);
  assert.equal(iliacNextAt(t), now - 1 + ILIAC_GAP_MS, 'the next game after the pause');
  const again = iliacTick(t, now - 1 + ILIAC_GAP_MS, seeded(3));
  assert.equal(ofRoom(again)[0].frame.events[0].t, 'game');
  assert.equal(t.gameNo, 2);
  // a stand mid-game concedes to the other seat
  const up = iliacStand(t, { id: 'a', now: now + 9000 });
  const evs = ofRoom(up)[0].frame.events;
  assert.deepEqual(evs.map((e) => e.t), ['end', 'leave']);
  assert.deepEqual([evs[0].winner, evs[0].how], [1, 'left']);
  assert.ok(toId(up, 'b')[0].frame.mine, 'the one left sitting sees the board');
  assert.deepEqual(iliacStand(t, { id: 'a', now: now + 9001 }), [], 'nobody to stand twice');
  iliacStand(t, { id: 'b', now: now + 9002 });
  assert.ok(iliacEmpty(t));
  // RANKED: two vouched-for seats of two accounts - the result queued; one account's two seats, or one friendly seat, never
  const r = ready({ subA: 'acct-a', subB: 'acct-b' });
  assert.equal(r.t.ranked, true);
  assert.ok(ofRoom(r.dealt)[0].frame.events[0].ranked);
  assert.match(r.t.id, ILIAC_GAME_ID_RE);
  iliacStand(r.t, { id: 'b', now: 9e3 });
  assert.deepEqual(r.t.results.map((x) => [x.f, x.r, x.h]), [[['acct-a', 'acct-b'], 0, 'left']], 'the one who stood loses, on the board');
  assert.deepEqual(r.t.results[0].to, ['a', 'b']);
  assert.equal(ready({ subA: 'acct-a', subB: 'acct-a' }).t.ranked, false, 'one account is no pair');
  assert.equal(ready({ subA: 'acct-a' }).t.ranked, false, 'a friendly seat makes a friendly game');
});

test('CARDS10 the words both ways: a sit carries thirty card ids and an order; a commit its plays; the relay\'s frames checked on the client', () => {
  assert.deepEqual(validIliacIn({ op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK }), { op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK });
  assert.equal(validIliacIn({ op: 'sit', table: 2, chair: 4, chairs: 4, deck: DECK }), null, 'no such chair');
  assert.equal(validIliacIn({ op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK.slice(1) }), null, 'thirty cards');
  assert.equal(validIliacIn({ op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK, order: 'x'.repeat(ILIAC_ORDER_MAX + 1) }), null);
  assert.equal(validIliacIn({ op: 'sit', table: 16, chair: 1, chairs: 4, deck: DECK }), null, 'the room\'s tables');
  assert.deepEqual(validIliacIn({ op: 'commit', table: 0, plays: [{ card: 1, holding: 2, junk: 1 }] }), { op: 'commit', table: 0, plays: [{ card: 1, holding: 2 }] }, 'projected');
  assert.equal(validIliacIn({ op: 'commit', table: 0, plays: [{ card: 1, holding: 3 }] }), null);
  assert.equal(validIliacIn({ op: 'deal', table: 0 }), null, 'the relay deals, never a client');
  const { t, dealt } = ready();
  for (const m of dealt) assert.ok(validIliacOut({ table: 0, now: 1, ...m.frame }), JSON.stringify(m.frame).slice(0, 80));
  assert.ok(validIliacOut({ table: 0, error: 'taken' }));
  assert.equal(validIliacOut({ table: 0, mine: { gameNo: 1, seat: 0, clockAt: 1, view: { ...iliacLook(t, 'a')[1].frame.mine.view, viewer: 1 } } }), false, 'a view for another seat');
  assert.equal(validIliacOut({ table: 0, events: [], state: { ...iliacPublicView(t), seats: [null] } }), false);
  // the wire's arm, its bound, the relay that first deals it
  const sit = JSON.stringify({ t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 2, deck: DECK });
  assert.deepEqual(parseClient(sit, { hasHello: true }), { t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 2, deck: DECK });
  assert.deepEqual(parseClient(sit), { error: 'iliac before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 2, deck: DECK, order: 'x'.repeat(ILIAC_FRAME_MAX) }), { hasHello: true }), { error: 'frame too large' });
  assert.equal(RELAY_VERSION, 'world179');
  assert.equal(ILIAC_RELAY_MIN, 179);
  assert.ok(relaySupportsIliac('world179'));
  assert.ok(!relaySupportsIliac('world178'), 'an older relay closes the socket on the frame');
});

test('CARDS10 a ranked game\'s receipt (i1): minted, read and verified; the arena\'s refused by it and it by the arena\'s; a draw said one way; the deck order a kind of its own', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const what = { j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 1, h: 'holdings' };
  const rc = await mintIliacReceipt(what, kp.privateKey, { subtle, nowS });
  assert.ok(rc.startsWith(`${ILIAC_RECEIPT_V}.`));
  assert.deepEqual({ ...readIliacReceipt(rc), i: 0, e: 0 }, { ...what, i: 0, e: 0, signed: true });
  assert.equal((await verifyIliacReceipt(rc, kp.publicKey, { subtle, nowS })).ok, true);
  assert.equal((await verifyIliacReceipt(rc.slice(0, -2) + 'AA', kp.publicKey, { subtle, nowS })).why, 'signature');
  assert.equal((await verifyIliacReceipt(rc, kp.publicKey, { subtle, nowS: nowS + 8 * 86400 })).why, 'expired');
  const unsigned = await mintIliacReceipt(what, null, { subtle, nowS });
  assert.equal((await verifyIliacReceipt(unsigned, kp.publicKey, { subtle, nowS })).why, 'unsigned');
  const arena = await mintArenaReceipt({ a: 'p', j: what.j, f: what.f, r: 1, h: 'fall' }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyIliacReceipt(arena, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifyArenaReceipt(rc, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.deepEqual(ILIAC_HOW, ['holdings', 'power', 'draw', 'left']);
  assert.equal(iliacReceiptValid({ ...what, r: 2, i: 1, e: 2 }), false, 'a draw is how: draw');
  assert.equal(iliacReceiptValid({ ...what, h: 'draw', i: 1, e: 2 }), false, 'and how: draw is a draw');
  assert.equal(iliacReceiptValid({ ...what, f: ['acct-a', 'acct-a'], i: 1, e: 2 }), false, 'two accounts');
  assert.equal(iliacReceiptValid({ ...what, a: 'p', i: 1, e: 2 }), false, 'no arena field');
  await assert.rejects(mintIliacReceipt({ ...what, j: 'nope' }, null, { subtle, nowS }));
  // the deck order: its digest the deck's set, sorted
  assert.ok(ORDER_KINDS.includes('deck'));
  assert.equal(deckDigestText(['b', 'a', 'a']), 'a,a,b');
  const dh = await deckDigest(DECK, { subtle });
  assert.equal(dh, await deckDigest([...DECK].reverse(), { subtle }), 'an order of the same thirty is the same deck');
  assert.match(dh, /^[0-9a-f]{64}$/);
  const order = await mintDeckOrder({ s: 'acct-a', dh }, kp.privateKey, { subtle, nowS });
  const v = await verifyOrder(order, kp.publicKey, { subtle, nowS, kind: 'deck' });
  assert.deepEqual([v.ok, v.claims.s, v.claims.dh], [true, 'acct-a', dh]);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS, kind: 'stake' })).ok, false, 'a deck order is no stake');
  assert.equal(orderValid({ o: 'mute', s: 'acct-a', mu: 0, dh, i: 1, e: 2 }), false, 'no other kind carries a digest');
  assert.equal(orderValid({ o: 'deck', s: 'acct-a', dh: 'xyz', i: 1, e: 2 }), false);
  assert.ok(TITLES.includes('iliacchampion'), 'the title in the vocabulary');
});

// ── the relay itself ─────────────────────────────────────────────────────────────────────────────────────────────
const ROOM = 'interior:m100.200';
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => ({ b64: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), pub: kp.publicKey }));
async function withRoom(fn, key = ROOM) {
  const r = fakeRoom(key);
  const g = await gateKey;
  r.env.GATE_SIGNING_KEY = g.b64;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000), gatePub: g.pub }); } finally { Date.now = realNow; _tick = () => {}; }
}
let _tick = () => {};
const iliac = (ws) => ws.sent.filter((m) => m.t === 'iliac');
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'iliac', ...o })); };
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
const sit = (r, ws, chair, extra = {}) => word(r, ws, { op: 'sit', table: 0, chair, chairs: 4, deck: DECK, ...extra });

test('CARDS10 the relay: two seated in a tavern\'s room and a third watching, each told only his own hand; the alarm deals and keeps the clock; a socket gone concedes; the table kept across a hibernation; nothing outside an interior', () => withRoom(async ({ r, tick }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  await sit(r, a, 0);
  await sit(r, b, 2);
  assert.deepEqual(iliac(c).at(-1).state.seats.map((s) => s?.chair ?? null), [0, 2], 'the watcher told the seats');
  assert.equal(r.room._iliac.get(0).seats.length, 2);
  r.wake();   // hibernated between the sits and the deal: the table is kept
  tick(ILIAC_FIRST_MS); await r.fire();
  const mineA = iliac(a).filter((m) => m.mine), mineB = iliac(b).filter((m) => m.mine);
  assert.equal(mineA.length, 1); assert.equal(mineB.length, 1);
  assert.equal(iliac(c).filter((m) => m.mine).length, 0, 'the watcher sees no hand');
  assert.equal(mineA[0].mine.view.players[0].hand.length, 4);
  for (const m of iliac(c)) assert.ok(validIliacOut(m), 'every frame the client\'s law takes');
  // a commit, and the other seat's clock runs out on the alarm
  await word(r, a, { op: 'commit', table: 0, plays: [] });
  assert.ok(iliac(c).at(-1).events.some((e) => e.t === 'commit' && e.seat === 0));
  tick(ILIAC_TURN_MS); await r.fire();
  assert.ok(iliac(c).at(-1).events.some((e) => e.t === 'turn' && e.turn === 2), 'the clock turned it over');
  await word(r, c, { op: 'commit', table: 0, plays: [] });
  assert.equal(iliac(c).at(-1).error, 'not seated');
  // the third cannot sit at a full table; one gone concedes
  await sit(r, c, 1);
  assert.equal(iliac(c).at(-1).error, 'full');
  await r.drop(b);
  const end = iliac(a).flatMap((m) => m.events ?? []).find((e) => e.t === 'end');
  assert.deepEqual([end.winner, end.how], [0, 'left'], 'a socket gone concedes');
  await word(r, a, { op: 'stand', table: 0 });
  assert.equal(r.store.get('iliac'), undefined, 'the table forgotten');
  // a hallway keeps no table
  await withRoom(async ({ r: h }) => {
    const x = await join(h, 'peer-x');
    await word(h, x, { op: 'sit', table: 0, chair: 0, chairs: 4, deck: DECK });
    assert.equal(iliac(x).length, 0);
    assert.ok(!h.room._iliac?.size, 'no table kept');
    assert.equal(h.store.get('iliac'), undefined);
  }, 'world');
}));

test('CARDS10 the relay: a ranked seat\'s deck order checked (its account, its digest); a ranked game\'s result signed and handed to both; one cloth one game - Hold\'em refused at an Iliac table and Iliac at a Hold\'em one', () => withRoom(async ({ r, tick, nowS, gatePub }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const kp = await r.signer();
  const dh = await deckDigest(DECK, { subtle });
  const orderOf = (s, digest = dh) => mintDeckOrder({ s, dh: digest }, kp.privateKey, { subtle, nowS: nowS() });
  await sit(r, a, 0, { order: await orderOf('acct-peer-b') });
  assert.equal(iliac(a).at(-1).error, 'deck refused', 'another account\'s order');
  const other = await deckDigest(['x'], { subtle });
  await sit(r, a, 0, { order: await orderOf('acct-peer-a', other) });
  assert.equal(iliac(a).at(-1).error, 'deck refused', 'another deck\'s order');
  await sit(r, a, 0, { order: await orderOf('acct-peer-a') });
  await sit(r, b, 1, { order: await orderOf('acct-peer-b') });
  assert.equal(r.room._iliac.get(0).seats.every((s) => s.sub), true, 'both ranked');
  // Hold'em at this cloth is refused while the game sits
  _tick(300); await r.raw(a, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 3, chairs: 4, bb: 10 }));
  const c = await join(r, 'peer-c');
  _tick(300); await r.raw(c, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 3, chairs: 4, bb: 10 }));
  assert.equal(c.sent.filter((m) => m.t === 'holdem').at(-1).error, 'other game');
  tick(ILIAC_FIRST_MS); await r.fire();
  assert.ok(iliac(a).some((m) => m.events?.some((e) => e.t === 'game' && e.ranked)), 'a ranked game');
  await word(r, b, { op: 'stand', table: 0 });
  const ra = iliac(a).filter((m) => m.receipt).map((m) => m.receipt), rb = iliac(b).filter((m) => m.receipt).map((m) => m.receipt);
  assert.equal(ra.length, 1, 'the winner holds the result');
  assert.deepEqual(rb, ra, 'and the loser the same bytes');
  const v = await verifyIliacReceipt(ra[0], gatePub, { subtle, nowS: nowS() });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.f, v.claims.r, v.claims.h], [['acct-peer-a', 'acct-peer-b'], 0, 'left']);
  assert.equal(r.room._iliac.get(0).results.length, 0, 'signed, let go');
  // and Iliac refused at a cloth Hold'em holds
  await word(r, a, { op: 'stand', table: 0 });
  _tick(300); await r.raw(c, JSON.stringify({ t: 'holdem', op: 'sit', table: 1, chair: 0, chairs: 4, bb: 10 }));
  await word(r, a, { op: 'sit', table: 1, chair: 1, chairs: 4, deck: DECK });
  assert.equal(iliac(a).at(-1).error, 'other game');
  // sitting at Iliac stands a player up from Hold'em
  await word(r, c, { op: 'sit', table: 2, chair: 0, chairs: 4, deck: DECK });
  assert.ok(!r.room._holdem.get(1)?.seats.some((s) => s?.id === 'peer-c'), 'one seat in a room at a time');
}));
