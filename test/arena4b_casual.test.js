// ARENA4b (2026-10-03, the audit's last ARENA4 gap): THE CASUAL BOUT (Arena.md 7: "A casual bout (unranked) may run under
// DUEL1's defender-resolved law"). Built refereed rather than defender-resolved - the hall's queue word with `u`, paired
// only with another casual seeker (net/arenaLaw.js pairQueue), its offer, call, listing and `st` saying so, its room
// owing no receipt (net/arenaBrain.js receiptsOwed) - so a casual bout is PVP-REF's bout all the same and counted nowhere:
// no rating, no points, no record. Over fake sockets (test/fakeRoom.mjs) and the client's models headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from './fakeRoom.mjs';
import { ARENA_HALL, arenaBoutRoom, ARENA_FLOOR_CENTRE, ARENA_TICK_MS, pairQueue, validArenaIn, validArenaOut } from '../src/net/arenaLaw.js';
import { foldHall, HALL_EMPTY } from '../src/net/arenaLink.js';
import { onlineCards } from '../src/systems/arenaBoard.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { COUNT_MS, callMs } from '../src/systems/arenaBout.js';

const { subtle } = globalThis.crypto;
const C = ARENA_FLOOR_CENTRE;
const O = ARENA_TEXT.online;
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
async function hallOf(W, fighters) {
  const H = W.room(ARENA_HALL);
  const out = [];
  for (const [id, name, ar] of fighters) {
    const ws = H.connect();
    await H.hello(ws, `peer-${id}`, null, { name, kind: 'linked', tokenSub: `acct-${id}`, ar });
    out.push(ws);
  }
  return { H, ws: out };
}

test('ARENA4b casual bout, the law and the wire: like is paired with like - a casual seeker never with a rated one at any rating, two of a kind as ever; the queue word, the offer, the call, the listing and a players\' `st` carry `u` both ways, and nothing else does (mutants: ARENA4b-CAS-PAIR-MIXED, ARENA4b-CAS-IN-DROPPED, ARENA4b-CAS-OUT-DROPPED)', () => {
  const at = 1000;
  const q = (sub, rating, casual) => ({ sub, rating, at, ...(casual ? { casual: true } : {}) });
  assert.deepEqual(pairQueue([q('a', 1000, true), q('b', 1000, false)], at), [], 'one casual, one rated: no pair, rating equal');
  assert.deepEqual(pairQueue([q('a', 1000, true), q('b', 1010, true)], at).map(([x, y]) => [x.sub, y.sub]), [['a', 'b']], 'two casual');
  assert.deepEqual(pairQueue([q('a', 1000, false), q('c', 1000, true), q('b', 1020, false)], at).map(([x, y]) => [x.sub, y.sub]), [['a', 'b']], 'the rated pair past the casual one');
  assert.deepEqual(validArenaIn({ k: 'q', lv: 9, u: 1 }), { k: 'q', lv: 9, u: 1 });
  assert.deepEqual(validArenaIn({ k: 'q', u: 2 }), { k: 'q' }, 'only a 1 is a casual seeker');
  assert.equal(validArenaOut({ k: 'of', o: '0123456789abcdef', vs: { n: 'Brann' }, until: 5, u: 1 }).u, 1);
  assert.equal(validArenaOut({ k: 'go', o: '0123456789abcdef', vs: { n: 'Brann' }, side: 1, u: 1 }).u, 1);
  assert.equal(validArenaOut({ k: 'of', o: '0123456789abcdef', vs: { n: 'Brann' }, until: 5 }).u, undefined);
  assert.equal(validArenaOut({ k: 'live', l: [{ o: '0123456789abcdef', kind: 'pvp', a: { n: 'Alva' }, b: { n: 'Brann' }, sp: 0, at: 1, u: 1 }] }).l[0].u, 1);
  const st = { k: 'st', o: '0123456789abcdef', ph: 'call', pa: 1, lim: 1, f: [], me: '', sp: 0, u: 1 };
  assert.equal(validArenaOut({ ...st, kind: 'pvp' }).u, 1);
  assert.equal(validArenaOut({ ...st, kind: 'pve' }).u, undefined, 'a ladder bout is never casual');
});

test('ARENA4b casual bout on the relay: two casual seekers offered one bout that says so, called to a room that says so and is listed as one; a rated seeker of the same rating waits for a rated one; the bout is refereed to its fall and hands NO receipt - nothing of it is the realm\'s to keep (mutants: ARENA4b-CAS-QUEUE-FLAG, ARENA4b-CAS-OFFER-WORD, ARENA4b-CAS-OPEN-FLAG, ARENA4b-CAS-RECEIPT-OWED, ARENA4b-CAS-ST-WORD, ARENA4b-CAS-LIVE-WORD)', () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { H, ws: [A, B, R0] } = await hallOf(W, [['alva', 'Alva', 1000], ['brann', 'Brann', 1040], ['rhun', 'Rhun', 1020]]);
  await word(H, A, { k: 'q', lv: 20, u: 1 });
  await word(H, R0, { k: 'q', lv: 25 });
  step(1000); await H.fire();
  assert.equal(last(A, 'of'), null, 'a casual seeker is not offered the rated one beside them');
  assert.equal(last(R0, 'of'), null);
  await word(H, B, { k: 'q', lv: 30, u: 1 });
  step(1000); await H.fire();
  const oa = last(A, 'of'), ob = last(B, 'of');
  assert.ok(oa && ob && oa.o === ob.o, 'the two casual seekers offered one bout');
  assert.deepEqual([oa.u, ob.u], [1, 1], 'an offer that says so');
  assert.equal(last(R0, 'of'), null, 'the rated seeker waits on');
  await word(H, A, { k: 'y', o: oa.o }); await word(H, B, { k: 'y', o: oa.o });
  assert.deepEqual([last(A, 'go').u, last(B, 'go').u], [1, 1], 'called to a casual bout');
  const o = last(A, 'go').o;   // AUDIT PRE-MERGE 1003 S7: the bout's room is the go's, never the offer's id
  await word(H, A, { k: 'ls' });
  assert.equal(last(A, 'live').l.find((e) => e.o === o).u, 1, 'listed as one');
  const Rm = W.room(arenaBoutRoom(o));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  Rm.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const a = Rm.connect(), b = Rm.connect();
  await Rm.hello(a, 'fight-alva', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', lv: 20 });
  await Rm.hello(b, 'fight-brann', { x: C[0] + 0.5, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: 30 });
  await word(Rm, a, { k: 'in', r: 'f' }); await word(Rm, b, { k: 'in', r: 'f' });
  assert.equal(last(a, 'st').u, 1, 'its state says so');
  const total = callMs({ fighters: Array(2) }) + 300 + COUNT_MS + 600;
  for (let t = 0; t < total; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await Rm.fire(); }
  await Rm.pose(a, { x: C[0], y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 });
  for (let i = 0; i < 60 && last(a, 'st')?.res == null; i++) {
    step(1000); await Rm.fire();
    await word(Rm, a, { k: 'hit', i: 'p1', d: 999, r: 0, w: 123, m: 9, q: 300 + i });
  }
  for (let i = 0; i < 30; i++) { step(1000); await Rm.fire(); }
  assert.ok(arena(a).some((m) => m.k === 'st' && m.res), 'refereed to its end');
  assert.equal(last(a, 'rc'), null, 'no receipt to the winner');
  assert.equal(last(b, 'rc'), null, 'nor to the beaten');
}));

test('ARENA4b casual bout on the client: the Challenge card offers Find a match and Casual bout side by side, a casual seeker\'s line, an offer that says it counts nowhere, the listing; the hall\'s fold keeps the casual flag on the offer and the call; the press sends the queue word with `u`, through the gate\'s door, and the end says nothing was counted (mutants: ARENA4b-CAS-CARD-PRESS, ARENA4b-CAS-FOLD, ARENA4b-CAS-ACT-WORD, ARENA4b-CAS-GATE-DOOR, ARENA4b-CAS-END-LINE)', () => {
  const open = { ...HALL_EMPTY, status: 'open' };
  const [players, idle] = onlineCards({ hall: open, me: null, now: 0 });
  assert.deepEqual(idle.acts.map((a) => [a.act, a.label]), [['queue', O.findMatch], ['casual', O.casualMatch]], 'both presses');
  assert.ok(idle.lines.includes(O.casualLine));
  assert.equal(players.key, 'players');
  const queued = onlineCards({ hall: { ...open, queue: 'queued', band: 100, n: 3, casual: true }, me: null, now: 0 })[1];
  assert.ok(queued.lines.includes(O.casualQueued(3)), 'a casual seeker\'s line');
  const offered = foldHall({ ...open, queue: 'queued' }, { k: 'of', o: '0123456789abcdef', vs: { n: 'Brann', r: 1040 }, until: 20_000, u: 1 }, 0);
  assert.equal(offered.offer.casual, true, 'the fold keeps the casual flag on the offer');
  assert.ok(onlineCards({ hall: offered, me: null, now: 0 })[1].lines.includes(O.casualOffer));
  const going = foldHall(offered, { k: 'go', o: '0123456789abcdef', side: 0, vs: { n: 'Brann' }, u: 1 }, 1);
  assert.equal(going.go.casual, true, 'and on the call');
  assert.equal(foldHall(open, { k: 'of', o: '0123456789abcdef', vs: { n: 'Brann' }, until: 1 }, 0).offer.casual, false, 'a rated offer is not');
  const listed = onlineCards({ hall: { ...open, live: [{ o: '0123456789abcdef', kind: 'pvp', a: { n: 'Alva' }, b: { n: 'Brann' }, sp: 2, at: 1, u: 1 }] }, me: null, now: 0 })[0];
  assert.equal(listed.live[0].title, O.liveCasual, 'listed as a casual bout');
  const src = rd('src/scenes/arenaOnline.js');
  // AUDIT PRE-MERGE 1003 O4/O5: the word is kept (said again on a hall socket come back) before it is sent
  assert.match(src, /const q = \{ k: 'q', lv: Math\.max\(1, Math\.floor\(deps\.level\?\.\(\) \?\? 1\)\), \.\.\.myBanner\(\), \.\.\.\(casual \? \{ u: 1 \} : \{\}\) \};[\s\S]{0,400}?if \(!hallSend\(q\)\)/, 'the press sends `u`');
  assert.match(src, /if \(w\.k === 'go'\) goTo\(\{ o: w\.o, kind: 'pvp', side: w\.side, vs: w\.vs, casual: w\.u === 1 \}\);/);
  assert.match(src, /onEnd: \(\) => \{ if \(b\.casual\) say\(O\.casualEnd\); askBoard\(true\); \}/, 'the end says so');
  assert.match(rd('src/scenes/arenaGate.js'), /kind === 'queue' \|\| kind === 'casual' \|\| kind === 'unqueue'/, 'the window\'s press reaches the hall');
});
