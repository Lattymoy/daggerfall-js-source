// CROWN1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE ROYAL TOURNEY'S LAW - the room
// (net/siege/siegeRef.js), the pass (net/identityToken.js's `siege` order with `sn` 'royal'), the wire's royal frames
// (net/wire.js), the bout's `t1` receipt (net/siege/siegeReceipt.js) and the ladder's own rules, pure.
// bible/11-Multiplayer/Seats-Arc.md 7.6; `06-Systems/Online-Arc.md` CROWN1 (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROYAL_ROOM, royalRoomKey, isRoyalRoom, isBattleRoom, battleOfRoom, royalFieldOf, fieldOf, newBattle, royalAsk, royalAccept, royalMarks,
  royalMayStrike, royalStepOk, royalEnd, royalStep, royalLadder, royalNextBeat, ROYAL_RING, ROYAL_PAIR_DAY_MAX, ROYAL_LADDER_SHOWN, SIEGE_UNITS_PER_M,
  SIEGE_TICK_MS,
} from '../../src/net/siege/siegeRef.js';
import {
  settleRing, royalStandings, ROYAL_PAIR_DAY, ROYAL_LADDER_ROWS, ROYAL_WHY, EDICTS, edictForTier, edictCost, edictLine, chronicleLine, seatTitleText,
} from '../../src/net/townSeatLaw.js';
import { siegePassValid, siegeFieldValid, siegePassPoints, SIEGE_PASS_SIDES, ROYAL_PASS_SPAN_S, SIEGE_PASS_SPAN_S, orderValid } from '../../src/net/identityToken.js';
import { validSiegeIn, validSiegeOut, ROYAL_RELAY_MIN, relayRunsRoyal, ROYAL_LADDER_MAX } from '../../src/net/wire.js';
import {
  mintRoyalReceipt, readRoyalReceipt, verifyRoyalReceipt, royalReceiptValid, ROYAL_RECEIPT_V, mintSiegeReceipt, verifySiegeReceipt, readSiegeReceipt, SIEGE_RECEIPT_TTL_S,
  siegeReceiptValid,
} from '../../src/net/siege/siegeReceipt.js';

const { subtle } = globalThis.crypto;
const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000_000;
const DAY = 86_400_000;
const royal = (o = {}) => newBattle({ kind: 'royal', tier: 'crown', startMs: T, endMs: T + 7 * DAY, field: { ring: [100 * M, 50 * M] }, ...o });

test('CROWN1 THE TOURNEY\'S ROOM: `royal:<crown>:<week>` - its own shape, never a siege\'s; a battle room either way, its kind read off the key (mutants: the shape; the kind)', () => {
  assert.equal(royalRoomKey(5023, 20), 'royal:5023:20');
  assert.deepEqual(['royal:5023:20', 'royal:0:0', 'royal:5023', 'royal:05023:20', 'siege:5023:20', 'royal:5023:20:1'].map(isRoyalRoom), [true, true, false, false, false, false]);
  assert.ok(ROYAL_ROOM.test('royal:4294967295:999999'));
  assert.deepEqual(['royal:5023:20', 'siege:3021:20', 'gate:5'].map(isBattleRoom), [true, true, false]);
  assert.deepEqual(battleOfRoom('royal:5023:20'), { kind: 'royal', key: 5023, week: 20 });
  assert.deepEqual(battleOfRoom('siege:3021:20'), { kind: 'siege', key: 3021, week: 20 });
  assert.equal(battleOfRoom('chat:x'), null);
});

test('CROWN1 THE TOURNEY\'S PASS: `sn` royal at a crown alone, a contender `duel` or a spectator, its window a week at most, its field the ring\'s one point; a contender is a Royal Tourney\'s alone (mutants: the kind; the tier; the side; the span; the points)', () => {
  const pass = (o = {}) => ({ o: 'siege', s: 'acct-a', sk: 5023, sw: 20, sd: 'duel', st: 'crown', sn: 'royal', sb: 1_800_000_000, se: 1_800_000_000 + 7 * 86400, sf: [[4000, 2000]], i: 1_800_000_100, e: 1_800_000_160, ...o });
  assert.deepEqual([...SIEGE_PASS_SIDES], ['attack', 'defend', 'watch', 'duel']);
  assert.deepEqual([siegePassPoints('crown', 'royal'), siegePassPoints('crown'), siegePassPoints('palace')], [1, 7, 6]);
  assert.deepEqual([ROYAL_PASS_SPAN_S, SIEGE_PASS_SPAN_S], [7 * 86400, 7200]);
  assert.ok(siegePassValid(pass()));
  assert.ok(orderValid(pass()), 'an order the relay verifies');
  assert.ok(siegePassValid(pass({ sd: 'watch' })));
  assert.equal(siegePassValid(pass({ sd: 'attack' })), false, 'a tourney has no sides');
  assert.equal(siegePassValid(pass({ st: 'palace' })), false, 'a crown\'s alone');
  assert.equal(siegePassValid(pass({ se: 1_800_000_000 + 7 * 86400 + 1 })), false, 'a week at most');
  assert.equal(siegePassValid(pass({ sf: [[4000, 2000], [1, 1]] })), false, 'one point');
  assert.equal(siegePassValid(pass({ sn: 'siege', sf: Array(7).fill([0, 0]), se: 1_800_000_000 + 3600 })), false, 'a contender is no siege\'s');
  assert.equal(siegePassValid(pass({ sn: 'siege', sd: 'attack', sf: Array(7).fill([0, 0]), se: 1_800_000_000 + 8 * 3600 })), false, 'a siege\'s window keeps its two hours');
  assert.ok(siegePassValid(pass({ sn: 'siege', sd: 'attack', sf: Array(7).fill([0, 0]), se: 1_800_000_000 + 3600 })));
  assert.deepEqual([siegeFieldValid([[1, 2]], 'crown', 'royal'), siegeFieldValid([[1.5, 2]], 'crown', 'royal'), siegeFieldValid([[1, 2]], 'crown')], [true, false, false]);
});

test('CROWN1 THE RING\'S FIELD AND A NEW TOURNEY: the pass\'s point the ring\'s centre; the week its window; no bout, an empty ladder (mutants: the field; the window)', () => {
  assert.deepEqual(royalFieldOf([[4000, 2000]]), { ring: [4000, 2000] });
  assert.deepEqual(fieldOf([[4000, 2000]], 'crown', 'royal'), { ring: [4000, 2000] });
  assert.equal(royalFieldOf([[4000, 2000], [0, 0]]), null);
  assert.equal(royalFieldOf([[4000]]), null);
  assert.equal(royalFieldOf([[NaN, 0]]), null);
  assert.equal(royalFieldOf(null), null);
  const b = royal();
  assert.deepEqual([b.kind, b.tier, b.startMs, b.endMs, b.bout, b.n, b.ladder, b.result], ['royal', 'crown', T, T + 7 * DAY, null, 0, {}, null]);
  assert.equal(royalNextBeat(b, T + 1000), T + 7 * DAY, 'no bout: the week\'s end');
});

test('CROWN1 A CHALLENGE AND ITS ACCEPT: an ask stands thirty seconds, never to oneself nor into a bout; the accept begins the bout after the countdown, to DUEL1\'s longest and never past the week; one at a time; the marks either side of the centre, facing it (mutants: the ask\'s life; the self; the bout\'s two; the ring taken; the countdown; the length; the marks)', () => {
  const b = royal();
  assert.equal(royalAsk(b, 'a', 'b', T - 1), 'the tourney is not open');
  assert.equal(royalAsk(b, 'a', 'a', T + 1), 'no such contender');
  assert.equal(royalAsk(b, 'a', 'b', T + 1), null);
  assert.deepEqual(royalAccept(b, 'c', 'a', T + 2), { no: 'no such challenge' }, 'asked of another');
  assert.deepEqual(royalAccept(b, 'b', 'a', T + 1 + ROYAL_RING.askMs + 1), { no: 'no such challenge' }, 'lapsed');
  royalAsk(b, 'a', 'b', T + 100_000);
  const { bout } = royalAccept(b, 'b', 'a', T + 100_001);
  assert.deepEqual({ ...bout, gone: null }, { n: 1, a: 'a', b: 'b', startMs: T + 100_001 + ROYAL_RING.countdownMs, endMs: T + 100_001 + ROYAL_RING.countdownMs + ROYAL_RING.boutMs, gone: null });
  assert.equal(b.asks.a, undefined, 'the ask spent');
  assert.equal(royalAsk(b, 'c', 'a', T + 100_002), 'a bout is on');
  royalAsk(b, 'c', 'd', T + 100_002);
  assert.deepEqual(royalAccept(b, 'd', 'c', T + 100_003), { no: 'the ring is taken' });
  const [pa, pb] = royalMarks(b, { y: 7 }, null);
  assert.deepEqual(pa, { x: 96 * M, y: 7, z: 50 * M, yaw: Math.PI / 2, pitch: 0 });
  assert.deepEqual(pb, { x: 104 * M, y: 0, z: 50 * M, yaw: -Math.PI / 2, pitch: 0 });
  // never past the week
  const late = royal();
  royalAsk(late, 'a', 'b', T + 7 * DAY - 60_000);
  assert.equal(royalAccept(late, 'b', 'a', T + 7 * DAY - 60_000).bout.endMs, T + 7 * DAY);
  royalAsk(late, 'c', 'd', T + 7 * DAY - 2000);
  late.bout = null;
  assert.deepEqual(royalAccept(late, 'd', 'c', T + 7 * DAY - 2000), { no: 'the tourney is not open' }, 'no countdown past the end');
});

test('CROWN1 THE BOUT\'S TWO: only they strike each other, once the countdown has run and until the bout\'s end; the ring and its slack hold them, no one else (mutants: the pair; the countdown; the end; the ring)', () => {
  const b = royal();
  royalAsk(b, 'a', 'b', T);
  const { bout } = royalAccept(b, 'b', 'a', T);
  assert.deepEqual([royalMayStrike(b, 'a', 'b', bout.startMs - 1), royalMayStrike(b, 'a', 'b', bout.startMs), royalMayStrike(b, 'b', 'a', bout.startMs), royalMayStrike(b, 'a', 'c', bout.startMs), royalMayStrike(b, 'c', 'a', bout.startMs), royalMayStrike(b, 'a', 'b', bout.endMs)],
    [false, true, true, false, false, false]);
  const edge = (100 + ROYAL_RING.radiusM + ROYAL_RING.outSlackM) * M;
  assert.deepEqual([royalStepOk(b, 'a', { x: edge, z: 50 * M }), royalStepOk(b, 'a', { x: edge + 1, z: 50 * M }), royalStepOk(b, 'c', { x: edge + 1000, z: 50 * M })], [true, false, true]);
  assert.equal(royalMayStrike(royal(), 'a', 'b', T), false, 'no bout');
});

test('CROWN1 A BOUT\'S END AND THE LADDER: a win and a loss counted - the same two three times a UTC day, then not, the next day again; a draw neither; the ladder by wins then fewer losses, ten rows (mutants: the count; the pair\'s day; the draw; the order; the rows)', () => {
  const b = royal();
  const fight = (x, y, w, at) => { royalAsk(b, x, y, at); royalAccept(b, y, x, at); return royalEnd(b, w, at + 10_000); };
  const t = T + DAY / 2;
  assert.deepEqual(fight('a', 'b', 'a', t), { n: 1, w: 'a', l: 'b', a: 'a', b: 'b', counted: true });
  fight('b', 'a', 'a', t + 60_000);
  fight('a', 'b', 'b', t + 120_000);
  assert.equal(fight('a', 'b', 'a', t + 180_000).counted, false, 'the fourth between them today');
  assert.deepEqual(b.ladder, { a: { w: 2, l: 1 }, b: { w: 1, l: 2 } });
  assert.equal(fight('b', 'a', 'a', t + DAY).counted, true, 'tomorrow, again');
  const d = fight('c', 'd', null, t);
  assert.deepEqual([d.w, d.l, d.counted], [null, null, false], 'a draw');
  assert.equal(b.ladder.c, undefined);
  assert.equal(royalEnd(b, 'a', t), null, 'no bout on');
  for (let i = 0; i < 12; i++) fight(`x${String(i).padStart(2, '0')}`, `y${String(i).padStart(2, '0')}`, `x${String(i).padStart(2, '0')}`, t + i * 1000);
  const lad = royalLadder(b);
  assert.equal(lad.length, ROYAL_LADDER_SHOWN);
  assert.deepEqual(lad[0], ['a', 3, 1]);
  assert.deepEqual(lad.slice(1, 3), [['x00', 1, 0], ['x01', 1, 0]], 'the same wins: fewer losses, then the name');
  assert.equal(ROYAL_PAIR_DAY_MAX, 3);
});

test('CROWN1 THE TOURNEY\'S BEAT: lapsed asks forgotten; a bout past its time a draw; a bout\'s fighter gone ten seconds loses; at the week\'s end the bout on a draw and the tourney over; each second while a bout is on (mutants: the lapse; the draw; the walkover; the end; the beat)', () => {
  const b = royal();
  const here = new Set(['a', 'b']);
  royalAsk(b, 'c', 'd', T);
  royalStep(b, () => true, T + ROYAL_RING.askMs + 1);
  assert.deepEqual(b.asks, {});
  royalAsk(b, 'a', 'b', T + 60_000);
  const { bout } = royalAccept(b, 'b', 'a', T + 60_000);
  assert.equal(royalNextBeat(b, T + 60_000), T + 60_000 + SIEGE_TICK_MS, 'a bout on: each second');
  here.delete('b');
  assert.deepEqual(royalStep(b, (s) => here.has(s), T + 70_000), []);
  assert.deepEqual(royalStep(b, (s) => here.has(s), T + 70_000 + ROYAL_RING.goneMs - 1), [], 'gone, not yet long enough');
  here.add('b');
  royalStep(b, (s) => here.has(s), T + 70_000 + ROYAL_RING.goneMs - 1);
  assert.deepEqual(bout.gone, {}, 'back: forgiven');
  here.delete('b');
  royalStep(b, (s) => here.has(s), T + 90_000);
  const ev = royalStep(b, (s) => here.has(s), T + 90_000 + ROYAL_RING.goneMs);
  assert.deepEqual(ev.map((e) => [e.k, e.w, e.l]), [['bout', 'a', 'b']], 'a walkover');
  royalAsk(b, 'a', 'b', T + 200_000);
  const second = royalAccept(b, 'b', 'a', T + 200_000).bout;
  assert.deepEqual(royalStep(b, () => true, second.endMs).map((e) => [e.k, e.w]), [['bout', null]], 'run its length: a draw');
  royalAsk(b, 'a', 'b', T + 7 * DAY - 60_000);
  royalAccept(b, 'b', 'a', T + 7 * DAY - 60_000);
  assert.deepEqual(royalStep(b, () => true, T + 7 * DAY).map((e) => e.k), ['bout', 'end']);
  assert.equal(b.result, 'over');
  assert.deepEqual(royalStep(b, () => true, T + 8 * DAY), [], 'over is over');
});

test('CROWN1 THE WIRE\'S ROYAL FRAMES: a challenge and an accept name the other; the room\'s ask, bout, bend (a draw, a walkover), ladder and receipt projected and bounded; the first relay that keeps them (mutants: each projection; the bounds; the relay\'s floor)', () => {
  assert.deepEqual(validSiegeIn({ k: 'ask', to: 'peer-0002', x: 1 }), { k: 'ask', to: 'peer-0002' });
  assert.deepEqual(validSiegeIn({ k: 'yes', to: 'peer-0002' }), { k: 'yes', to: 'peer-0002' });
  assert.equal(validSiegeIn({ k: 'ask', to: '' }), null);
  assert.deepEqual(validSiegeOut({ k: 'ask', id: 'peer-0001' }), { k: 'ask', id: 'peer-0001' });
  assert.equal(validSiegeOut({ k: 'ask', id: 5 }), null);
  assert.deepEqual(validSiegeOut({ k: 'bout', a: 'peer-0001', b: 'peer-0002', n: 3, s: 10, e: 20, x: 1 }), { k: 'bout', a: 'peer-0001', b: 'peer-0002', n: 3, s: 10, e: 20 });
  assert.equal(validSiegeOut({ k: 'bout', a: 'peer-0001', b: 'peer-0001', n: 3, s: 10, e: 20 }), null, 'two');
  assert.equal(validSiegeOut({ k: 'bout', a: 'peer-0001', b: 'peer-0002', n: 0, s: 10, e: 20 }), null);
  assert.equal(validSiegeOut({ k: 'bout', a: 'peer-0001', b: 'peer-0002', n: 3, s: 20, e: 20 }), null);
  assert.deepEqual(validSiegeOut({ k: 'bend', n: 2, w: 'peer-0001', l: 'peer-0002', c: 1 }), { k: 'bend', n: 2, w: 'peer-0001', l: 'peer-0002', c: 1 });
  assert.deepEqual(validSiegeOut({ k: 'bend', n: 2, w: 'peer-0001', l: '', c: 1 }), { k: 'bend', n: 2, w: 'peer-0001', l: '', c: 1 }, 'a walkover');
  assert.deepEqual(validSiegeOut({ k: 'bend', n: 2, w: '', l: '', c: 1 }), { k: 'bend', n: 2, w: '', l: '', c: 0 }, 'a draw counts nothing');
  assert.equal(validSiegeOut({ k: 'bend', n: 2, w: '', l: 'peer-0002', c: 0 }), null, 'a loser with no winner');
  assert.equal(validSiegeOut({ k: 'bend', n: 2, w: 'peer-0001', l: 'peer-0001', c: 0 }), null);
  assert.equal(validSiegeOut({ k: 'bend', n: 2, w: 'peer-0001', l: 'peer-0002', c: 2 }), null);
  assert.deepEqual(validSiegeOut({ k: 'lad', l: [['peer-0001', 3, 1], ['', 1, 0]] }), { k: 'lad', l: [['peer-0001', 3, 1], ['', 1, 0]] });
  assert.equal(validSiegeOut({ k: 'lad', l: Array(ROYAL_LADDER_MAX + 1).fill(['', 0, 0]) }), null);
  assert.equal(validSiegeOut({ k: 'lad', l: [['peer-0001', -1, 0]] }), null);
  assert.equal(ROYAL_LADDER_MAX, ROYAL_LADDER_SHOWN, 'pinned equal');
  assert.deepEqual(validSiegeOut({ k: 'won', rc: 't1.abc.def' }), { k: 'won', rc: 't1.abc.def' });
  assert.equal(validSiegeOut({ k: 'won', rc: 's1.abc.def' }), null, 'a bout\'s receipt alone');
  assert.deepEqual([ROYAL_RELAY_MIN, relayRunsRoyal('world148'), relayRunsRoyal('world147'), relayRunsRoyal('x')], [148, true, false, false]);   // PIN MOVED (main's FRIENDS-SYNC took world142): world146 until that merge   // PIN MOVED (MERGE #519-#523): main's ELITE FOES took world143 - world147 until that merge
});

test('CROWN1 THE BOUT\'S RECEIPT: `t1` - the winner, the loser, the crown, the week, the bout - signed by the relay\'s key, verified rung for rung, read unsigned by the client; never a siege\'s `s1`, nor it a `t1` (mutants: each field; the TTL; the version; the disjointness)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const rc = await mintRoyalReceipt({ s: 'acct-a', l: 'acct-b', sk: 5023, sw: 20, n: 7 }, kp.privateKey, { subtle, nowS });
  assert.ok(rc.startsWith(`${ROYAL_RECEIPT_V}.`));
  const v = await verifyRoyalReceipt(rc, kp.publicKey, { subtle, nowS });
  assert.ok(v.ok, v.why);
  assert.deepEqual(v.claims, { s: 'acct-a', l: 'acct-b', sk: 5023, sw: 20, n: 7, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S });
  assert.equal(readRoyalReceipt(rc).signed, true);
  assert.equal(readRoyalReceipt(await mintRoyalReceipt({ s: 'acct-a', l: 'acct-b', sk: 5023, sw: 20, n: 7 }, null, { subtle, nowS })).signed, false);
  assert.equal((await verifyRoyalReceipt(await mintRoyalReceipt({ s: 'acct-a', l: 'acct-b', sk: 5023, sw: 20, n: 7 }, null, { subtle, nowS }), kp.publicKey, { subtle, nowS })).why, 'unsigned');
  assert.equal((await verifyRoyalReceipt(rc, kp.publicKey, { subtle, nowS: nowS + SIEGE_RECEIPT_TTL_S })).why, 'expired');
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  assert.equal((await verifyRoyalReceipt(rc, other.publicKey, { subtle, nowS })).why, 'signature');
  await assert.rejects(mintRoyalReceipt({ s: 'acct-a', l: 'acct-a', sk: 5023, sw: 20, n: 7 }, null, { subtle, nowS }), 'never oneself');
  await assert.rejects(mintRoyalReceipt({ s: 'acct-a', l: 'acct-b', sk: 5023, sw: 20, n: 0 }, null, { subtle, nowS }));
  const base = { s: 'acct-a', l: 'acct-b', sk: 5023, sw: 20, n: 1, i: 10, e: 10 + SIEGE_RECEIPT_TTL_S };
  assert.ok(royalReceiptValid(base));
  assert.deepEqual([{ ...base, e: 11 + SIEGE_RECEIPT_TTL_S }, { ...base, r: 'attack' }, { ...base, sd: 'attack' }, { ...base, sk: -1 }, { ...base, sw: 1.5 }, { ...base, l: '' }].map(royalReceiptValid), [false, false, false, false, false, false]);
  // disjoint from a siege's
  const s1 = await mintSiegeReceipt({ s: 'acct-a', sk: 5023, sw: 20, sd: 'attack', r: 'attack', a: 1, h: 1 }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyRoyalReceipt(s1, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifySiegeReceipt(rc, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal(readSiegeReceipt(rc), null);
  assert.equal(readRoyalReceipt(s1), null);
  const s1c = { s: 'acct-a', sk: 5023, sw: 20, sd: 'attack', r: 'attack', a: 1, h: 1, i: 10, e: 10 + SIEGE_RECEIPT_TTL_S };
  assert.deepEqual([siegeReceiptValid(s1c), siegeReceiptValid({ ...s1c, l: 'acct-b' })], [true, false], 'a siege\'s refuses a bout\'s loser');
});

test('CROWN1 THE SERVICE\'S LAW: the ring settled by two different contenders\' agreeing; the ladder\'s standings - most wins, fewest losses, the earlier last win, the account; the pair\'s cap pinned equal to the room\'s; the Edict, its words, its Chronicle rows and the champion\'s title (mutants: the two; the order; the cap; the cost; the words)', () => {
  const ring = JSON.stringify([[4000, 2000]]), other = JSON.stringify([[4001, 2000]]);
  assert.equal(settleRing([{ account: 'a', field: ring, at: 1 }]), null, 'one contender');
  assert.equal(settleRing([{ account: 'a', field: ring, at: 1 }, { account: 'a', field: ring, at: 2 }]), null, 'one contender twice');
  assert.equal(settleRing([{ account: 'a', field: ring, at: 1 }, { account: 'b', field: other, at: 2 }]), null, 'two that differ');
  assert.equal(settleRing([{ account: 'a', field: ring, at: 1 }, { account: 'b', field: other, at: 2 }, { account: 'c', field: other, at: 3 }, { account: 'd', field: ring, at: 4 }]), other, 'the first point a second account sent alike');
  assert.equal(settleRing(null), null);
  const st = royalStandings([
    { winner: 'b', loser: 'a', at: 5 }, { winner: 'a', loser: 'b', at: 6 }, { winner: 'c', loser: 'd', at: 3 },
    { winner: 'e', loser: 'f', at: 1 }, { winner: 'e', loser: 'g', at: 2 }, { winner: 'h', loser: 'g', at: 9 }, { winner: 'h', loser: 'e', at: 10 },
  ]);
  assert.deepEqual(st.map((r) => [r.account, r.wins, r.losses]), [['h', 2, 0], ['e', 2, 1], ['c', 1, 0], ['b', 1, 1], ['a', 1, 1], ['d', 0, 1], ['f', 0, 1], ['g', 0, 2]]);
  assert.deepEqual(st.slice(0, 3).map((r) => r.account), ['h', 'e', 'c'], 'two wins and no loss before two and one; then one and none');
  assert.deepEqual(royalStandings([{ winner: 'x', loser: 'y', at: 9 }, { winner: 'z', loser: 'w', at: 4 }]).slice(0, 2).map((r) => r.account), ['z', 'x'], 'the same: the earlier last win');
  assert.deepEqual(royalStandings([{ winner: 'q', loser: 'p', at: 4 }, { winner: 'o', loser: 'n', at: 4 }]).slice(0, 2).map((r) => r.account), ['o', 'q'], 'then the account');
  assert.deepEqual(royalStandings([]), []);
  assert.deepEqual(royalStandings([{ winner: 'x', loser: 'p', at: 9 }, { winner: 'x', loser: 'q', at: 2 }, { winner: 'z', loser: 'p', at: 5 }, { winner: 'z', loser: 'q', at: 6 }]).slice(0, 2).map((r) => r.account),
    ['z', 'x'], 'a win\'s time is its latest, whatever order the rows come in');
  assert.equal(ROYAL_PAIR_DAY, ROYAL_PAIR_DAY_MAX, 'the service counts as the room does');
  assert.equal(ROYAL_LADDER_ROWS, 10);
  assert.deepEqual({ ...EDICTS['royal-tourney'], cost: { ...EDICTS['royal-tourney'].cost } }, { name: 'Royal Tourney', standing: 0, cost: { crown: 5000 }, repeat: false, crown: true });
  assert.deepEqual([edictForTier('royal-tourney', 'crown'), edictForTier('royal-tourney', 'palace'), edictCost('royal-tourney', 'crown')], [true, false, 5000]);
  assert.match(edictLine('royal-tourney', 'crown'), /^Royal Tourney: A duel ladder all week .* Costs 5,000 silver\.$/);
  const seat = { key: 5023, name: 'Wayrest', tier: 'crown', region: 23 };
  assert.equal(chronicleLine({ kind: 'royal-champion', week: 9, data: { name: 'Arden', kingdom: 'wayrest', wins: 4, prize: 5000 } }, seat), 'In week 9, Arden won the Royal Tourney at Wayrest with 4 bouts - Champion of Wayrest.');
  assert.equal(chronicleLine({ kind: 'royal-none', week: 9, data: { kingdom: 'wayrest' } }, seat), 'In week 9, no bout of the Royal Tourney at Wayrest was won; its prize went home.');
  assert.equal(seatTitleText('champion', [5023, 2], (k) => (k === 5023 ? seat : null)), 'Champion of Wayrest, Season 2');
  assert.equal(seatTitleText('champion', [9, 2], () => null), null, 'a crown this client cannot name');
  assert.deepEqual(Object.keys(ROYAL_WHY), ['royal-none', 'royal-over', 'ring-unsettled']);
});
