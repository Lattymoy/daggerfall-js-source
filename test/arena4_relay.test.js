// ARENA4 (2026-10-02, Mac: "choose to matchmake for a real opponent to take on in real time"; "Players can choose to
// watch AI fights, player fights"): THE ARENA'S ROOMS ON THE RELAY, over fake sockets and fake objects (test/fakeRoom.mjs)
// - the Worker's door, the hall's queue and its offers, a bout between players refereed by PVP-REF to its signed receipt,
// the stands, a forfeit, a void, and a ladder bout against the relay's own fighters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/src/index.js';
import { fakeRooms } from './fakeRoom.mjs';
import { readArenaReceipt, verifyArenaReceipt } from '../src/net/arenaReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import {
  ARENA_HALL, arenaBoutRoom, ARENA_FLOOR_CENTRE, MATCH_ACCEPT_MS, MATCH_WIDEN_MS, ARENA_JOIN_WAIT_MS, ARENA_GONE_MS, ARENA_TICK_MS,
  pvpVitality, ARENA_SPECTATORS_MAX, validArenaIn, validArenaOut, arenaBlowCap, ARENA_HIT, ARENA_BUCKET_DEPTH, MATCH_REPAIR_MS,
  pairQueue, ARENA_BUCKET_RATE,
} from '../src/net/arenaLaw.js';
import { parseClient, relaySupportsArena, RELAY_VERSION } from '../src/net/wire.js';
import { COUNT_MS, callMs, WALK_MAX_MS, END_HOLD_MS, VERDICT_MS, HEAL_HOLD_MS } from '../src/systems/arenaBout.js';

const { subtle } = globalThis.crypto;
const C = ARENA_FLOOR_CENTRE;
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const pose = (r, ws, x, z, extra = {}) => r.pose(ws, { x, y: 0.3, z, yaw: 0, pitch: 0, mv: 0, ...extra });

/** A world on a fake clock. */
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; }, set: (t) => { clock = t; } }); } finally { Date.now = realNow; }
}
/** The relay's signing pair, as tools/mintGateKeys.mjs mints it. */
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  return { pkcs8, pub: kp.publicKey, priv: await importReceiptKey(pkcs8, { subtle }) };
}
/** Two registered fighters in the hall, queued. */
async function hallOf(W, a = { ar: 1000 }, b = { ar: 1040 }) {
  const H = W.room(ARENA_HALL);
  const A = H.connect(), B = H.connect();
  await H.hello(A, 'peer-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ...a });
  await H.hello(B, 'peer-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', ...b });
  return { H, A, B };
}

test('ARENA4 the door and the wire: the Worker opens the hall and a bout\'s room and no other arena key; an arena word is projected both ways, junk refused; the version that opens them (mutants: any arena key admitted; a blow\'s kind unchecked; the cap not doubled for a critical; a bare hand\'s most changed)', async () => {
  const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('x') }) } };
  const at = (k) => worker.fetch(new Request(`https://relay.invalid/room/${k}`), env);
  assert.equal((await at('arena:hall')).status, 426, 'the hall: a socket only');
  assert.equal((await at('arena:b0123456789abcdef')).status, 426, 'a bout');
  assert.equal((await at('arena:lobby')).status, 404, 'no other key');
  assert.equal((await at('arena:b0123')).status, 404);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'arena', k: 'q', lv: 9 }), { hasHello: true }), { t: 'arena', k: 'q', lv: 9 });
  assert.equal(parseClient(JSON.stringify({ t: 'arena', k: 'q' })).error, 'arena before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'arena', k: 'boom' }), { hasHello: true }).error, 'bad arena');
  assert.deepEqual(validArenaIn({ k: 'hit', i: 'a0', d: 12.5, r: 0, w: 120, m: 3, q: 7 }), { k: 'hit', i: 'a0', d: 12.5, r: 0, w: 120, m: 3, q: 7 });
  assert.equal(validArenaIn({ k: 'hit', i: 'p9', d: 1, r: 0 }), null, 'no such fighter');
  assert.equal(validArenaIn({ k: 'hit', i: 'a0', d: 1, r: 3 }), null, 'no such kind');
  assert.equal(validArenaIn({ k: 'in', r: 'f', tier: 10, bout: 0 }), null, 'no eleventh tier');
  assert.equal(validArenaOut({ k: 'blow', i: 'a0', d: 4, to: 'p0' }).to, 'p0');
  assert.equal(validArenaOut({ k: 'st', o: 'x' }), null);
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Melee, w: 123, m: 9 }), 2 * (21 + 6 + 20), 'a Daedric dai-katana, a critical\'s double');
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Spell }), 60);
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Melee }), 2 * (41 + 20), 'ARENA5: a bare hand\'s most (DFU\'s past the softcap) and the modifiers\' room, doubled');
  assert.equal(RELAY_VERSION, 'world169');   // world142 on its branch, renumbered past main's world154 at the merge; AEGIS moved it on (world160), GUILD2 after it (world161, no wire change), PRIMARCH after that (world162), SUNBABY1 after it (world163, a live event's word), PARTY-LEAD after that (world164, the hub's party.lead act), SERPENT1 after it (world165, the serpent frame), SERPENT2 after that (world166, the serpent herald); SHADOW-CLOAK after it (world167, the cloak's word - PIN MOVED); SERAPH-WINGS after it (world168, the wings word - PIN MOVED); AUDIT ARENA-LADDER after that (world169, the arena ladder audit - PIN MOVED)
  assert.equal(relaySupportsArena('world154'), false, 'main\'s FRIENDS-SYNC through BROKER-CAGE took world142-154 and open no arena room');
  assert.equal(relaySupportsArena('world142'), false);
  assert.equal(relaySupportsArena('world155'), true);
});

test('ARENA4 the hall: two registered fighters queued are offered one bout, both say yes and are sent to its room on their sides; a guest is not queued; the band widens with the wait (mutants: the guest queued; the offer to one alone; the sides swapped; the band\'s widening or the offer\'s clock changed; paired youngest first, past the narrower band, short of the nearest, or with themselves)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { H, A, B } = await hallOf(W);
  const G = H.connect();
  await H.hello(G, 'peer-gull', null, { name: 'Gull' });
  await word(H, G, { k: 'q' });
  assert.deepEqual(last(G, 'qx'), { t: 'arena', k: 'qx', m: 'guest' }, 'a guest fights no rated bout');
  await word(H, A, { k: 'q', lv: 9 });
  await word(H, B, { k: 'q', lv: 7 });
  assert.equal(last(A, 'qd').band, 100);
  step(1000); await H.fire();
  const oa = last(A, 'of'), ob = last(B, 'of');
  assert.ok(oa && ob, 'both offered');
  assert.equal(oa.o, ob.o, 'one bout');
  assert.deepEqual(oa.vs, { n: 'Brann', r: 1040 });
  assert.deepEqual(ob.vs, { n: 'Alva', r: 1000 });
  assert.equal(oa.until, Date.now() + MATCH_ACCEPT_MS);
  await word(H, A, { k: 'y', o: oa.o });
  assert.equal(last(A, 'go'), null, 'one yes is not a bout');
  await word(H, B, { k: 'y', o: oa.o });
  const ga = last(A, 'go'), gb = last(B, 'go');
  assert.deepEqual([ga.o, ga.side, gb.side], [gb.o, 0, 1]);
  assert.notEqual(ga.o, oa.o, 'AUDIT PRE-MERGE 1003 S7: the bout\'s room minted at the go, never the offer\'s id');
  assert.ok(W.made.has(arenaBoutRoom(ga.o)), 'the bout\'s room was opened by the hall');
  await word(H, A, { k: 'ls' });
  assert.equal(last(A, 'live').l[0].o, ga.o, 'and it is on the list to watch');
  // the band: 1000 and 1500 wait past four widenings before they meet
  const W2 = fakeRooms();
  const P = await hallOf(W2, { ar: 1000 }, { ar: 1500 });
  await word(P.H, P.A, { k: 'q' }); await word(P.H, P.B, { k: 'q' });
  for (let i = 0; i < 3; i++) { step(MATCH_WIDEN_MS); await P.H.fire(); }
  assert.equal(last(P.A, 'of'), null, '500 apart is past a 400 band');
  assert.equal(last(P.A, 'qd').band, 400);
  step(MATCH_WIDEN_MS); await P.H.fire();
  assert.ok(last(P.A, 'of'), 'the band reached 500');
  // ARENA5: Arena.md 7's two numbers, and pairQueue's own order - the oldest first, the nearest rating inside the
  // narrower of the two bands, never a fighter with themselves
  assert.deepEqual([MATCH_WIDEN_MS, MATCH_ACCEPT_MS], [10_000, 20_000], 'Arena.md 7: "the band widening every 10 s", "both accept in 20 s"');
  const Q = (sub, rating, at) => ({ sub, rating, at });
  const subs = (pairs) => pairs.map(([x, y]) => [x.sub, y.sub]);
  assert.deepEqual(subs(pairQueue([Q('a', 1000, 0), Q('b', 1050, 1), Q('c', 1100, 2)], 2)), [['a', 'b']], 'the oldest chooses first');
  assert.deepEqual(subs(pairQueue([Q('a', 1000, 0), Q('b', 1090, 0), Q('c', 1050, 0)], 0)), [['a', 'c']], 'the nearest rating, not the first inside the band');
  assert.deepEqual(pairQueue([Q('a', 1000, 0), Q('b', 1150, 2 * MATCH_WIDEN_MS)], 2 * MATCH_WIDEN_MS), [], 'a\'s band of 300 admits b; b\'s of 100 does not');
  assert.deepEqual(pairQueue([Q('a', 1000, 0), Q('a', 1000, 5)], 5), [], 'never a fighter with themselves');
}));

test('ARENA4 the offer: a no sends the other back to the queue, its wait kept, and the pair is not offered again for a minute; a lapse takes the silent one out; a socket gone takes its place out (mutants: the decliner kept; the pair re-offered at once; a lapse queues the silent one; the minute changed; a socket gone kept in the queue, closed or lost)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { H, A, B } = await hallOf(W);
  await word(H, A, { k: 'q' }); await word(H, B, { k: 'q' });
  step(1000); await H.fire();
  const o = last(A, 'of').o;
  await word(H, B, { k: 'n', o });
  assert.equal(last(A, 'qx').m, 'declined');
  assert.ok(last(A, 'qd'), 'back in the queue');
  assert.equal((await H.room._hallOf()).q.some((e) => e.sub === 'acct-brann'), false, 'ARENA5: the one who said no is out of it');
  assert.equal(MATCH_REPAIR_MS, 60_000, 'ARENA5: a minute');
  await word(H, B, { k: 'q' });
  step(1000); await H.fire();
  assert.equal(arena(A).filter((m) => m.k === 'of').length, 1, 'not offered again inside a minute');
  step(MATCH_REPAIR_MS); await H.fire();
  assert.equal(arena(A).filter((m) => m.k === 'of').length, 2, 'after it, they meet');
  const o2 = last(A, 'of').o;
  await word(H, A, { k: 'y', o: o2 });
  step(MATCH_ACCEPT_MS + 1); await H.fire();
  assert.equal(last(B, 'qx').m, 'lapsed');
  assert.equal(last(A, 'qx').m, 'lapsed');
  const lapsedQ = (await H.room._hallOf()).q.map((e) => e.sub);
  assert.deepEqual([lapsedQ.includes('acct-alva'), lapsedQ.includes('acct-brann')], [true, false], 'ARENA5: a lapse - the one who said yes back in the queue, the silent one out');
  const qdA = arena(A).filter((m) => m.k === 'qd').length;
  step(1000); await H.fire();
  assert.ok(arena(A).filter((m) => m.k === 'qd').length >= qdA, 'the one who said yes waits on');
  await H.drop(A);
  assert.equal((await H.room._hallOf()).q.some((e) => e.sub === 'acct-alva'), false, 'a socket gone takes its place out (ARENA5: at its close)');
  // ARENA5: and a socket the hall lost without a close (the runtime's own drop - a tab gone without a word) is out by
  // the hall's next beat
  await word(H, B, { k: 'q' });
  H.sockets.splice(H.sockets.indexOf(B), 1);
  step(1000); await H.fire();
  assert.equal((await H.room._hallOf()).q.some((e) => e.sub === 'acct-brann'), false, 'a queue holds only accounts with a socket in the hall');
}));

/** A matched bout between Alva and Brann, both on its sand, its law running. */
async function matched(W, step) {
  const { H, A, B } = await hallOf(W, { ar: 1000, lv: 20 }, { ar: 1040, lv: 30 });   // AUDIT PRE-MERGE 1003 S3: the vitality's level is the hall's token's, never the queue word's
  await word(H, A, { k: 'q', lv: 20 }); await word(H, B, { k: 'q', lv: 30 });
  step(1000); await H.fire();
  const of = last(A, 'of').o;
  await word(H, A, { k: 'y', o: of }); await word(H, B, { k: 'y', o: of });
  const o = last(A, 'go').o;   // AUDIT PRE-MERGE 1003 S7: the room the go names
  const R = W.room(arenaBoutRoom(o));
  const pair = await relayPair();
  R.env.GATE_SIGNING_KEY = pair.pkcs8;
  const a = R.connect(), b = R.connect();
  await R.hello(a, 'fight-alva', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', lv: 20 });
  await R.hello(b, 'fight-brann', { x: C[0] + 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: 30 });
  await word(R, a, { k: 'in', r: 'f' });
  assert.equal(last(a, 'st').ph, 'wait', 'one fighter on the sand waits for the other');
  await word(R, b, { k: 'in', r: 'f' });
  return { R, a, b, o, pair };
}
/** The clock walked to the fight's word, the room's beat run each step. */
async function toFight(R, step, n = 2) {
  const total = callMs({ fighters: Array(n) }) + 300 + COUNT_MS + 600;
  for (let t = 0; t < total; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); }
}

test('ARENA4 PVP-REF: a matched bout runs the bout law on the relay - both on the sand, the call, the count, the fight; the relay holds each fighter\'s vitality (300 + 2 x level) and believes a blow only in reach, under the rate, capped by the weapon and the bucket - and signs the result for both (mutants: a blow from across the sand landed; the rate unchecked; the bucket unspent; the vitality the client\'s; a pose too fast believed; the bucket\'s rate changed)', async () => onClock(async ({ step, now }) => {
  const W = fakeRooms();
  const { R, a, b, o, pair } = await matched(W, step);
  const st = last(a, 'st');
  assert.equal(st.ph, 'call');
  assert.equal(st.me, 'p0');
  assert.equal(last(b, 'st').me, 'p1');
  assert.deepEqual(st.f.map((f) => [f[0], f[4]]), [['p0', pvpVitality(20)], ['p1', pvpVitality(30)]], 'the vitality the relay holds');
  assert.deepEqual([pvpVitality(20), pvpVitality(30), pvpVitality(9999)], [340, 360, 420], 'ARENA5: 300 + 2 x level, the level held at sixty - a lie about it buys little');
  assert.ok(a.sent.some((m) => m.t === 'join' && m.id === 'fight-brann'), 'each fighter comes onto the other\'s sand');
  await toFight(R, step);
  assert.equal(last(a, 'st').ph, 'fight');
  // from across the sand: a miss
  await word(R, a, { k: 'hit', i: 'p1', d: 20, r: 0, w: 120, m: 1, q: 1 });
  assert.equal(last(a, 'hp')?.h?.find((h) => h[0] === 'p1')?.[1] ?? pvpVitality(30), pvpVitality(30), 'twelve metres is out of reach');
  // in reach: lands, capped by the weapon
  await pose(R, a, C[0] + 4.5, C[2]);
  step(300);
  await word(R, a, { k: 'hit', i: 'p1', d: 999, r: 0, w: 120, m: 1, q: 2 });
  const capped = arenaBlowCap({ r: 0, w: 120, m: 1 });
  assert.equal(last(b, 'hp').h.find((h) => h[0] === 'p1')[1], pvpVitality(30) - capped, `a longsword's claim of 999 is ${capped} at most`);
  // ARENA5: a pose too fast to believe is not believed - the reach is measured from the last good one
  step(300);
  await pose(R, a, C[0] - 13, C[2]);
  await word(R, a, { k: 'hit', i: 'p1', d: 3, r: 0, w: 120, m: 1, q: 3 });
  assert.equal(last(b, 'hp').h.find((h) => h[0] === 'p1')[1], pvpVitality(30) - capped - 3, 'seventeen metres in a third of a second is no step: the blow lands from where Alva last truly stood');
  // the rate: four blows a second; the fifth inside it is not believed
  step(1100);
  const before = last(b, 'hp').h.find((h) => h[0] === 'p1')[1];
  for (let q = 10; q < 15; q++) await word(R, a, { k: 'hit', i: 'p1', d: 5, r: 0, w: 120, m: 1, q });
  assert.equal(last(b, 'hp').h.find((h) => h[0] === 'p1')[1], before - 20, 'four of five');
  // the bucket: a long run of capped blows is held to its rate
  const hpB = () => last(b, 'hp').h.find((h) => h[0] === 'p1')[1];
  let down = hpB();
  const takes = [];
  for (let i = 0; i < 4; i++) { const h0 = hpB(); step(1000); await R.fire(); await word(R, a, { k: 'hit', i: 'p1', d: 999, r: 0, w: 123, m: 9, q: 100 + i }); takes.push(h0 - hpB()); }
  const after = hpB();
  assert.ok(down - after <= 4 * 40 + ARENA_BUCKET_DEPTH, `four seconds of capped blows took ${down - after}`);
  // ARENA5: the bound above is no tighter than what Brann had left (a run that fells him passes it - an unspent bucket's
  // did), so the run is read blow by blow: the first the weapon's capped most, then, the bucket dry, a second's refill
  assert.equal(takes[0], arenaBlowCap({ r: 0, w: 123, m: 9 }), 'the first, a Daedric dai-katana\'s capped most');
  assert.deepEqual(takes.slice(2), [ARENA_BUCKET_RATE, ARENA_BUCKET_RATE], `then the bucket's own rate, however a claim is dressed: ${takes}`);
  // to the floor: the fall, the end, the receipt
  for (let i = 0; i < 40 && !last(a, 'rc'); i++) { step(1000); await R.fire(); await word(R, a, { k: 'hit', i: 'p1', d: 999, r: 0, w: 123, m: 9, q: 200 + i }); }
  await R.fire();
  const ra = last(a, 'rc'), rb = last(b, 'rc');
  assert.ok(ra && rb, 'both are handed the receipt');
  assert.equal(ra.r, rb.r, 'one bout, one receipt');
  const c = readArenaReceipt(ra.r);
  assert.deepEqual([c.a, c.j, c.f, c.r, c.h], ['p', o, ['acct-alva', 'acct-brann'], 0, 'fall']);
  assert.equal((await verifyArenaReceipt(ra.r, pair.pub, { subtle, nowS: Math.floor(now() / 1000) })).ok, true, 'signed by the relay');
  void down;
}));

test('ARENA4 the stands: a spectator takes a seat - HOTFIX 1003f: a body the fighters see, as it sees them - and the whole bout, its cheer is fanned; sixty seats (mutants: the spectator drawn to nobody; its pose to nobody; the seats unbounded; sixty changed; a stranger let onto the sand)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { R, a, b } = await matched(W, step);
  const s = R.connect();
  await R.hello(s, 'seat-sola', { x: C[0], y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name: 'Sola' });
  const welcome = s.sent.find((m) => m.t === 'welcome');
  assert.deepEqual(welcome.peers.map((p) => p.id).sort(), ['fight-alva', 'fight-brann'], 'the stands see both fighters');
  await word(R, s, { k: 'in', r: 's' });
  assert.equal(last(s, 'st').me, '', 'a spectator fights nobody');
  await word(R, s, { k: 'in', r: 'f' });
  assert.equal(last(s, 'no').m, 'not yours', 'ARENA5: and is let onto nobody\'s sand');
  assert.equal(last(a, 'sp').n, 1);
  assert.ok(a.sent.some((m) => m.t === 'join' && m.id === 'seat-sola'), 'HOTFIX 1003f: the fighters see the stands - a spectator\'s hello is said to the room');
  const seen = a.sent.length;
  await pose(R, s, C[0] + 1, C[2] - 21);
  assert.ok(a.sent.slice(seen).some((m) => m.t === 'pose' && m.id === 'seat-sola'), 'HOTFIX 1003f: a spectator\'s pose reaches the fighters');
  await pose(R, a, C[0] - 5, C[2]);
  assert.ok(s.sent.some((m) => m.t === 'pose' && m.id === 'fight-alva'), 'a fighter\'s reaches the stands');
  await word(R, s, { k: 'ch', c: 1 });
  assert.deepEqual(last(b, 'cr'), { t: 'arena', k: 'cr', c: 1, n: 1 });
  await word(R, s, { k: 'ch', c: 1 });
  assert.equal(arena(b).filter((m) => m.k === 'cr').length, 1, 'one cheer a spectator in its time');
  await word(R, a, { k: 'ch', c: 1 });
  assert.equal(arena(b).filter((m) => m.k === 'cr').length, 1, 'a fighter cheers nobody');
  (await R.room._boutOf()).spectators = ARENA_SPECTATORS_MAX;
  const late = R.connect();
  await R.hello(late, 'seat-late', null, { name: 'Late' });
  await word(R, late, { k: 'in', r: 's' });
  assert.equal(last(late, 'no').m, 'seats full');
  assert.equal(ARENA_SPECTATORS_MAX, 60, 'ARENA5: Arena.md 7 - up to 60');
}));

test('ARENA4 a forfeit and a void: a fighter gone from a live fight past fifteen seconds forfeits it; a matched bout nobody comes to is void and leaves the list (mutants: no forfeit; a forfeit at once; the void never said; the fifteen seconds changed)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { R, a, b } = await matched(W, step);
  await toFight(R, step);
  assert.equal(ARENA_GONE_MS, 15_000, 'ARENA5: fifteen seconds');
  await R.drop(b);
  for (let t = 0; t < ARENA_GONE_MS - 1000; t += 1000) { step(1000); await R.fire(); }
  assert.equal(last(a, 'rc'), null, 'not yet');
  for (let t = 0; t < 3000; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); }
  const c = readArenaReceipt(last(a, 'rc').r);
  assert.deepEqual([c.r, c.h], [0, 'forfeit'], 'the one who stayed wins by forfeit');
  // void
  const W2 = fakeRooms();
  const { H, A, B } = await hallOf(W2);
  await word(H, A, { k: 'q' }); await word(H, B, { k: 'q' });
  step(1000); await H.fire();
  const of = last(A, 'of').o;
  await word(H, A, { k: 'y', o: of }); await word(H, B, { k: 'y', o: of });
  const o = last(A, 'go').o;   // AUDIT PRE-MERGE 1003 S7: the room the go names
  const R2 = W2.room(arenaBoutRoom(o));
  const x = R2.connect();
  await R2.hello(x, 'fight-x01', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva' });
  await word(R2, x, { k: 'in', r: 'f' });
  for (let t = 0; t <= ARENA_JOIN_WAIT_MS + 1000; t += 1000) { step(1000); await R2.fire(); }
  assert.equal(last(x, 'no').m, 'void');
  assert.equal(last(x, 'st').ph, 'void');
  await word(H, A, { k: 'ls' });
  assert.equal(last(A, 'live').l.some((e) => e.o === o), false, 'the hall forgets it');
}));

test('ARENA4 the ladder on the relay: the fighter\'s own `in` opens a ladder bout against the relay\'s fighters - they walk at the fighter, telegraph and land blows the fighter\'s game applies; beaten, the receipt names the tier and the bout (mutants: no walk; a blow out of reach landed; the receipt\'s step wrong; the receipt\'s result reversed; a class fighter\'s body changed)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const o = '00000000000000aa';
  const R = W.room(arenaBoutRoom(o));
  R.env.GATE_SIGNING_KEY = (await relayPair()).pkcs8;
  const p = R.connect();
  let px = C[0] - 6;
  await R.hello(p, 'fight-ceryn', { x: px, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-ceryn' });
  await word(R, p, { k: 'in', r: 'f', tier: 0, bout: 1, lv: 6, mh: 90, z: 'feedc0de00000001' });
  const st = last(p, 'st');
  assert.equal(st.kind, 'pve');
  assert.deepEqual([st.tier, st.bout], [0, 1]);
  assert.deepEqual(st.f.map((f) => [f[0], f[6], f[7]]), [['p0', 0, -1], ['a0', 1, 136]], 'the Pit\'s second bout: a Rogue');
  assert.equal(st.f[1][4], 26, 'ARENA5: a Rogue of level 2 - 10 and 8 a level');
  assert.ok(last(p, 'mv'), 'its place said');
  await toFight(R, step);
  // it walks at me
  step(ARENA_TICK_MS); await R.fire();
  const mv = arena(p).filter((m) => m.k === 'mv' && m.v > 0).at(-1);
  assert.ok(mv && mv.tx < mv.x, 'the Rogue walks west, at me');
  // I stand; it comes, telegraphs, and lands
  for (let t = 0; t < 6000 && !last(p, 'blow'); t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await pose(R, p, px, C[2]); await R.fire(); }
  const atk = last(p, 'atk');
  assert.ok(atk && atk.tg === 'p0', 'a blow telegraphed at me');
  const blow = last(p, 'blow');
  assert.ok(blow && blow.to === 'p0' && blow.d >= 1 && blow.d <= 8, `a Rogue's blow: ${blow?.d}`);
  // ARENA5: a blow telegraphed lands only on a foe still in its reach - step out of it before it falls and it is a miss
  const atks = () => arena(p).filter((m) => m.k === 'atk').length, blows = () => arena(p).filter((m) => m.k === 'blow').length;
  const atk0 = atks();
  for (let t = 0; t < 4000 && atks() === atk0; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await pose(R, p, px, C[2]); await R.fire(); }
  assert.ok(atks() > atk0, 'its next blow telegraphed');
  const blows0 = blows();
  step(ARENA_TICK_MS); px -= 3; await pose(R, p, px, C[2]); await R.fire();
  step(ARENA_TICK_MS); await R.fire();
  assert.equal(blows(), blows0, 'stepped back out of its reach before it fell: no blow');
  // I beat it
  for (let i = 0; i < 60 && !last(p, 'rc'); i++) {
    step(300); await pose(R, p, px, C[2]); await R.fire();
    await word(R, p, { k: 'hit', i: 'a0', d: 8, r: 0, w: 116, m: 1, q: 500 + i });
  }
  for (let i = 0; i < 4 && !last(p, 'rc'); i++) { step(ARENA_TICK_MS); await R.fire(); }
  const c = readArenaReceipt(last(p, 'rc').r);
  assert.deepEqual([c.a, c.s, c.q, c.u, c.j], ['l', 'acct-ceryn', 0, 1, o]);
  assert.equal(typeof c.r, 'number');
  assert.equal(c.r, 1, 'ARENA5: beaten - the receipt says the fighter won');
  void WALK_MAX_MS; void END_HOLD_MS; void VERDICT_MS; void HEAL_HOLD_MS;
}));
