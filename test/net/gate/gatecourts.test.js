// GATE-COURTS (2026-10-26, the owner: "We need to develop instances for oblivion gate. The player counts are becoming
// too large for one instance"; asked: fifty a court, placed automatically with the party together, the gate standing
// until every court is done, each court's kill said in the chat and the night once on Discord - bible/11-Multiplayer/
// World-Bosses.md section 29): A NIGHT'S BURNING COURTS. The law (net/gate/gateCourts.js: the book's seat, the night
// done, its word, the rite's own), the rooms (net/gate/gateLaw.js gateRoomKey), the wire's `go` and `cf` and the night's
// `fell`, the relay over real Rooms (server/src/index.js _gateSentOn, _gateSeatHere, _gateBookBeat, the hub's doors), the
// client's link (net/gate/gateLink.js) and the host's wiring. tools/mutants/gatecourts.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRooms } from '../../fakeRoom.mjs';
import * as C from '../../../src/net/gate/gateCourts.js';
import { gateTimes, gateRoomKey, gateCourtOfRoom, isGateRoom, gateBossOf, GATE_COLLAPSE_MS } from '../../../src/net/gate/gateLaw.js';
import { COURT_COPY_RE, isCourtCopy, courtOfCopy } from '../../../src/net/hubShards.js';
import { validGateOut, GATE_BRAIN_V, GATE_BRAIN_MIN, SOCIAL_ROOM, PARTY_MAX, GATE_INTERNAL_PARTY, GATE_INTERNAL_FELL, GATE_INTERNAL_SEAT, GATE_INTERNAL_COURT, RITE_INTERNAL_DAY, GATE_TELL_RETRY_MS } from '../../../src/net/wire.js';
import { COURT_CENTRE, BRAIN_TICK_MS, HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { readReceipt, mintReceipt } from '../../../src/net/gate/gateReceipt.js';
import { createGateLink } from '../../../src/net/gate/gateLink.js';
import { courtFellLine, fellLine, createGateOmen, SEAL_SAY_HOLD_MS } from '../../../src/systems/gate/gateOmen.js';
import { validStaffDestination, staffDestinationKey } from '../../../src/net/staffTeleport.js';
import { fellPost } from '../../../src/net/gate/gateHerald.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const DAY = 200;
const TT = gateTimes(DAY);
const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));
const settle = () => new Promise((r) => setImmediate(r));

// ═══ THE LAW ═══════════════════════════════════════════════════════════════════════════════════

test('GATE-COURTS the law: fifty a court, sixteen courts a night, a whole party\'s slack (PARTY_MAX - 1); a court\'s room `gate:<day>.<k>` past the first, and each court copied past its sockets (mutants: the slack not the party\'s; a court past the last)', () => {
  assert.equal(C.GATE_COURT_FIGHTERS, 50, 'the owner\'s fifty');
  assert.equal(C.GATE_COURTS_MAX, 16);
  assert.equal(C.GATE_PARTY_SLACK, PARTY_MAX - 1, 'a whole party stands in one court');
  assert.equal(gateRoomKey(DAY), `gate:${DAY}`, 'the first court is the gate\'s room as it always was');
  for (let c = 0; c < C.GATE_COURTS_MAX; c++) { const k = gateRoomKey(DAY, c); assert.ok(isGateRoom(k), k); assert.equal(gateCourtOfRoom(k), c); }
  assert.equal(isGateRoom(`gate:${DAY}.${C.GATE_COURTS_MAX}`), false, 'no court past the last');
  for (let c = 0; c < C.GATE_COURTS_MAX; c++) { const k = gateRoomKey(DAY, c); assert.ok(isCourtCopy(`${k}#3`), `${k}#3`); assert.equal(courtOfCopy(`${k}#3`), k); }
  assert.equal(isCourtCopy(`gate:${DAY}.${C.GATE_COURTS_MAX}#1`), false, 'COURT_COPY_RE pinned to GATE_COURTS_MAX');
  assert.ok(COURT_COPY_RE.source.includes('1[0-5]'), 'the copies\' law names the sixteen courts');
  for (const c of [0, 15]) assert.equal(C.courtOk(c), true);
  for (const c of [-1, 16, 1.5, '1', null]) assert.equal(C.courtOk(c), false, String(c));
});

test('GATE-COURTS the seat: the lowest court with room that has not won, fifty a court; a seat held is its court for the night; JOINED only where its own court asked and its fight takes it (AUDIT GATE-COURTS R4/C3), pending otherwise - a pending one lapses, and one whose court has won since is placed again (R2/P5) (mutants: the cap; a won court seated; a seat moved; never joined; joined unasked; the law joins whatever the fight; a new seat joined whatever the fight; a new seat joined unasked; never lapsing; a pending seat in a won court kept)', () => {
  const b = C.bookNew(DAY);
  const t0 = 1000;
  assert.equal(C.GATE_SEAT_PENDING_MS, 60_000, 'a minute');
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) assert.equal(C.placeSeat(b, `a${i}`, { asked: 0, now: t0, admits: true, can: true }), 0);
  assert.equal(b.s.a0[2], 1, 'seated where it asked, its fight taking it: joined');
  assert.equal(C.placeSeat(b, 'b0', { asked: 0, now: t0, admits: true, can: true }), 1, 'the fifty-first: the second court');
  assert.deepEqual(b.s.b0, [1, t0, 0], 'pending - asked by the first, its court the second');
  assert.equal(C.placeSeat(b, 'b0', { asked: 2, now: t0 + 10, admits: true, can: true }), 1, 'asked by any court: its own');
  assert.equal(b.s.b0[2], 0, 'still pending - another court asked');
  assert.equal(C.placeSeat(b, 'b0', { asked: 1, now: t0 + 15, admits: true }), 1);
  assert.equal(b.s.b0[2], 0, 'its own court asked, but its fight would not take it now: still pending');
  assert.equal(C.placeSeat(b, 'b0', { asked: 1, now: t0 + 20, admits: true, can: true }), 1);
  assert.equal(b.s.b0[2], 1, 'joined once its own court asked and could seat it');
  const n0 = C.bookNew(DAY);
  assert.equal(C.placeSeat(n0, 'x', { asked: 0, now: t0, admits: true }), 0);
  assert.equal(n0.s.x[2], 0, 'a newcomer its own court cannot take now is given its seat pending');
  assert.deepEqual(C.courtCounts(b, t0 + 20).slice(0, 3), [50, 1, 0]);
  assert.equal(C.placeSeat(b, 'a3', { asked: 5, now: t0 + 30, admits: false }), 0, 'sealed: a seat held is still its court');
  assert.equal(C.placeSeat(b, 'zz', { asked: 0, now: t0 + 30, admits: false }), null, 'sealed: no newcomer');
  // a court that won seats nobody new
  assert.equal(C.placeSeat(b, 'b1', { asked: 0, now: t0 + 35, admits: true }), 1, 'b1 sent on to the second court');
  C.courtFell(b, 1, { at: 5, top: ['x'], n: 1, rs: ['b0'] });
  assert.equal(C.placeSeat(b, 'c0', { asked: 0, now: t0 + 40, admits: true }), 2, 'the second won: the third');
  assert.equal(C.placeSeat(b, 'b0', { asked: 0, now: t0 + 41, admits: true }), 1, 'a JOINED seat is its court whatever it did since');
  assert.equal(C.placeSeat(b, 'b1', { asked: 0, now: t0 + 42, admits: true }), 2, 'a PENDING seat whose court has won since is placed again');
  assert.equal(C.placeSeat(b, 'b1', { asked: 0, now: t0 + 43, admits: false }), 2, 'and held there, sealed or not');
  // a pending seat lapses: its court has room again
  const p = C.bookNew(DAY);
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) C.placeSeat(p, `p${i}`, { asked: 3, now: t0, admits: true });
  assert.equal(C.courtCounts(p, t0)[0], 50, 'given in the first, asked by another - all pending');
  assert.equal(C.placeSeat(p, 'late', { asked: 0, now: t0 + C.GATE_SEAT_PENDING_MS - 1, admits: true }), 1, 'pending seats count while they hold');
  assert.equal(C.placeSeat(p, 'later', { asked: 0, now: t0 + C.GATE_SEAT_PENDING_MS, admits: true }), 0, 'lapsed: the first court has room again');
  assert.equal(p.s.p0, undefined, 'and the lapsed seats let go');
  assert.equal(C.seatLive([0, 0, 1], 9e12), true, 'a joined seat never lapses');
  // every court full: none
  const f = C.bookNew(DAY);
  for (let c = 0; c < C.GATE_COURTS_MAX; c++) for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) f.s[`f${c}.${i}`] = [c, t0, 1];
  assert.equal(C.placeSeat(f, 'one-more', { asked: 0, now: t0, admits: true }), null, 'the night full');
});

test('GATE-COURTS the party: a newcomer sits in the lowest court where a mate holds a live seat, up to GATE_PARTY_SLACK over the fifty; past it, or a mate\'s court won, the lowest with room (mutants: the mates unread; the slack ignored; the highest mate\'s court)', () => {
  const t0 = 1000;
  const b = C.bookNew(DAY);
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) C.placeSeat(b, `a${i}`, { asked: 0, now: t0, admits: true });
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) C.placeSeat(b, `b${i}`, { asked: 1, now: t0, admits: true });
  C.placeSeat(b, 'c0', { asked: 2, now: t0, admits: true });
  assert.equal(C.placeSeat(b, 'stranger', { asked: 0, now: t0, admits: true }), 2, 'no mate: the lowest with room');
  assert.equal(C.placeSeat(b, 'mate-of-a', { asked: 0, now: t0, admits: true, mates: ['b9', 'a7'] }), 0, 'the lowest court a mate sits in - full, but within the slack');
  for (let i = 1; i < C.GATE_PARTY_SLACK; i++) C.placeSeat(b, `x${i}`, { asked: 0, now: t0, admits: true, mates: ['a7'] });
  assert.equal(C.courtCounts(b, t0)[0], C.GATE_COURT_FIGHTERS + C.GATE_PARTY_SLACK);
  assert.equal(C.placeSeat(b, 'too-many', { asked: 0, now: t0, admits: true, mates: ['a7'] }), 2, 'past the slack: the lowest with room');
  C.courtFell(b, 1, { at: 1, top: [], n: 50, rs: [] });
  assert.equal(C.placeSeat(b, 'mate-of-b', { asked: 0, now: t0, admits: true, mates: ['b3'] }), 2, 'a mate\'s court that won seats nobody new');
  assert.equal(C.placeSeat(b, 'self', { asked: 0, now: t0, admits: true, mates: ['self'] }), 2, 'its own name is no mate');
});

test('GATE-COURTS the night: done after the seal once every court a fighter JOINED has won, or GATE_NIGHT_GRACE_MS past the wrath once any has; its word the courts that won of the courts it held, the first to win\'s best three, every winner\'s fighters; the rite\'s own to those no court paid (mutants: before the seal; a pending court counted; the wrath unread; no grace; the grace unbeaten; the minute; the sum)', () => {
  const b = C.bookNew(DAY);
  assert.equal(C.nightDone(b, TT.sealAt, TT), false, 'nobody won: no night to say');
  b.s.a = [0, 1, 1]; b.s.b = [1, 1, 1]; b.s.c = [2, 1, 0];
  C.courtFell(b, 0, { at: 50, top: ['Ann'], n: 30, rs: ['a'] });
  assert.equal(C.nightDone(b, TT.sealAt - 1, TT), false, 'before the seal a newcomer could open a court');
  assert.equal(C.nightDone(b, TT.sealAt, TT), false, 'the second court still fights');
  C.courtFell(b, 1, { at: 40, top: ['Bran'], n: 20, rs: ['b', 'h1'] });
  assert.equal(C.nightDone(b, TT.sealAt, TT), true, 'every joined court won - a pending seat\'s court is no court');
  C.courtFell(b, 1, { at: 99, top: ['Nope'], n: 1, rs: [] });
  assert.deepEqual(b.f[1].top, ['Bran'], 'a court\'s first word kept');
  assert.deepEqual(C.nightWord(b, 777), { at: 777, top: ['Bran'], n: 50, w: 2, cs: 2 }, 'the first to win\'s best three; fifty fighters; two of two');
  assert.deepEqual(C.riteOnly(b, ['h1', 'h2', 'h2', 'a']), ['h2'], 'the rite\'s own to one no court paid, once');
  const w = C.bookNew(DAY);
  w.s.a = [0, 1, 1]; w.s.b = [1, 1, 1];
  C.courtFell(w, 1, { at: 1, top: [], n: 1, rs: [] });
  assert.equal(C.nightDone(w, TT.wrathAt - 1, TT), false);
  assert.equal(C.GATE_NIGHT_GRACE_MS, 3_000);
  assert.equal(C.GATE_SEAT_PENDING_MS, 60_000, 'a seat given and never joined holds a minute');
  assert.equal(C.GATE_MATES_KEEP_MS, 60_000, 'a party the hub said kept a minute');
  assert.ok(C.GATE_NIGHT_GRACE_MS < GATE_COLLAPSE_MS, 'said before the night is forgotten');
  assert.equal(C.nightDone(w, TT.wrathAt + C.GATE_NIGHT_GRACE_MS - 1, TT), false, 'AUDIT GATE-COURTS R3: a kill just before the wrath has its grace to reach the book');
  assert.equal(C.nightDone(w, TT.wrathAt + C.GATE_NIGHT_GRACE_MS, TT), true, 'past the wrath\'s grace: the rest are cast back');
  assert.equal(C.bookNextAt(w, TT, TT.openAt), TT.sealAt);
  assert.equal(C.bookNextAt(w, TT, TT.sealAt), TT.wrathAt + C.GATE_NIGHT_GRACE_MS);
  assert.equal(C.bookNextAt(w, TT, TT.wrathAt + C.GATE_NIGHT_GRACE_MS), null);
  w.end = 5;
  assert.equal(C.bookNextAt(w, TT, TT.openAt), null, 'said: nothing owed');
  assert.equal(C.isGateBook(w), true); assert.equal(C.isGateBook({ d: 1 }), false); assert.equal(C.isGateBook(null), false);
});

// ═══ THE WIRE ═════════════════════════════════════════════════════════════════════════════════

test('GATE-COURTS the wire: `go` its day and court, `cf` a court\'s kill with its court and the courts held, the night\'s `fell` with the courts that won and held - each bounded; the brain\'s law 7 (mutants: a court past the last taken; the night\'s counts dropped)', () => {
  assert.deepEqual(validGateOut({ k: 'go', d: DAY, c: 3, x: 1 }), { k: 'go', d: DAY, c: 3 });
  for (const bad of [{ k: 'go', d: DAY, c: C.GATE_COURTS_MAX }, { k: 'go', d: DAY, c: -1 }, { k: 'go', c: 1 }, { k: 'go', d: -1, c: 1 }]) assert.equal(validGateOut(bad), null, JSON.stringify(bad));
  const fall = { at: 5, top: ['Ann'], n: 4 };
  assert.deepEqual(validGateOut({ k: 'cf', d: DAY, c: 2, ...fall }), { k: 'cf', ...fall, d: DAY, c: 2 });
  assert.deepEqual(validGateOut({ k: 'cf', d: DAY, c: 0, cs: 3, ...fall }), { k: 'cf', ...fall, d: DAY, c: 0, cs: 3 });
  for (const bad of [{ k: 'cf', c: 1, ...fall }, { k: 'cf', d: DAY, c: 16, ...fall }, { k: 'cf', d: DAY, c: 0, cs: 0, ...fall }, { k: 'cf', d: DAY, c: 0 }]) assert.equal(validGateOut(bad), null, JSON.stringify(bad));
  assert.deepEqual(validGateOut({ k: 'fell', d: DAY, w: 2, cs: 3, ...fall }), { k: 'fell', ...fall, d: DAY, w: 2, cs: 3 });
  assert.deepEqual(validGateOut({ k: 'fell', d: DAY, ...fall }), { k: 'fell', ...fall, d: DAY }, 'a night of one court, as every kill was');
  assert.equal(validGateOut({ k: 'fell', d: DAY, w: 17, ...fall }), null);
  assert.equal(GATE_BRAIN_V, 7); assert.equal(GATE_BRAIN_MIN, 7, 'a game that would not hear `go` is told to reload');
});

// ═══ THE RELAY ════════════════════════════════════════════════════════════════════════════════

/** A night's courts over real Rooms - the first court's object holding the book, the hub's party door answered as `party` says. */
async function night(fn, { start = TT.openAt + 1000, party = {} } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  try {
    return await quiet(async () => {
      const world = fakeRooms({ now: () => clock });
      const get = world.ROOMS.get;
      // `party: null` - the hub's own party door, a real party formed through its frames (AUDIT GATE-COURTS P3)
      if (party) world.ROOMS.get = (id) => { const o = get(id); return id === SOCIAL_ROOM ? { fetch: async (req) => (new URL(req.url).pathname === GATE_INTERNAL_PARTY ? new Response(JSON.stringify({ m: party[(await req.clone().json()).a] ?? [] })) : o.fetch(req)) } : o; };
      const court = (c) => world.room(gateRoomKey(DAY, c));
      const say = (R, ws, o) => R.raw(ws, JSON.stringify({ t: 'gate', ...o }));
      let n = 0;
      /** A fighter into court `c`: its hello (25 ms apart - inside the court's hello bucket, net/wire.js GATE_HELLO_HZ_MAX), its `in`. */
      const into = async (c, id, pose = at((n % 12) - 6, 3 + Math.floor(n / 12) % 8)) => { n++; const R = court(c); const ws = R.connect(); clock += 25; await R.hello(ws, id, pose); await say(R, ws, { k: 'in', lv: 10, bv: GATE_BRAIN_V }); await settle(); return ws; };
      const fire = async (c) => { const R = court(c); if (R.alarm.at != null) await R.fire(); await settle(); };
      const tick = async (cs, k = 1) => { for (let i = 0; i < k; i++) { clock += BRAIN_TICK_MS; for (const c of cs) { const R = court(c); if (R.alarm.at != null && clock >= R.alarm.at) await R.fire(); } await settle(); } };
      const hub = world.room(SOCIAL_ROOM);
      return await fn({ world, court, say, into, fire, tick, hub, now: () => clock, set: (t) => { clock = t; } });
    });
  } finally { Date.now = realNow; }
}
const id = (i) => `peer-${String(i).padStart(4, '0')}`;

test('GATE-COURTS the relay: the first court seats fifty, the fifty-first is sent on (`go`) and fights in the second court\'s own fight; one court a night - a fighter at another court\'s door is sent back to its own (mutants: the book unasked; the seat unconfirmed; the go unsaid; one fight for every court)', async () => {
  await night(async ({ court, into, say, tick, set }) => {
    const first = [];
    for (let i = 0; i < 50; i++) first.push(await into(0, id(i)));
    assert.ok(first.every((ws) => gates(ws, 'st').some((m) => m.me === 1)), 'fifty seated in the first court');
    const late = await into(0, id(50));
    assert.deepEqual(gates(late, 'go'), [{ t: 'gate', k: 'go', d: DAY, c: 1 }], 'the fifty-first: the second court');
    assert.equal(gates(late, 'st').length, 0, 'and nothing of the first court\'s fight');
    assert.equal(court(0).room._fight.players[`acct-${id(50)}`], undefined, 'not seated in the first court\'s fight');
    const there = await into(1, id(50));
    assert.ok(gates(there, 'st').some((m) => m.me === 1), 'seated in the second court');
    assert.ok(court(1).room._fight.players[`acct-${id(50)}`], 'the second court\'s own fight');
    assert.notEqual(court(1).room._fight, court(0).room._fight);
    assert.equal(court(1).room._fight.cn, 1, 'the fight knows its court');
    assert.deepEqual(court(0).store.get('gatebook').s[`acct-${id(50)}`].slice(0, 1).concat(court(0).store.get('gatebook').s[`acct-${id(50)}`][2]), [1, 1], 'the book: the second court, joined');
    // one court a night: a first-court fighter at the third court's door, a second-court fighter at the first's
    const stray = await into(2, id(3));
    assert.deepEqual(gates(stray, 'go'), [{ t: 'gate', k: 'go', d: DAY, c: 0 }], 'back to its own court');
    assert.equal(court(2).room._fight ?? null, null, 'the third court stood no fight for it');
    const back = court(0).connect(); await court(0).hello(back, id(50), at(0, 3));
    await say(court(0), back, { k: 'in', lv: 10, bv: GATE_BRAIN_V }); await settle();
    assert.deepEqual(gates(back, 'go'), [{ t: 'gate', k: 'go', d: DAY, c: 1 }]);
    there.sent.length = 0;
    await tick([0, 1], 24);
    assert.ok(gates(there, 'st').length + gates(there, 'mv').length + gates(there, 'atk').length > 0, 'the second court beats on its own (AUDIT GATE-COURTS P6: its own beats, the join\'s answer cleared first)');
    // after the seal a court's own fighter is its own court's to admit (no book there - its fight's seat)
    set(TT.sealAt + 1000);
    const again = court(1).connect(); await court(1).hello(again, id(50), at(0, 3));
    assert.equal(again.closed, null, 'a second-court fighter back at its court after the seal');
    const none = court(1).connect(); await court(1).hello(none, id(51), at(0, 3));
    assert.deepEqual(none.sent, [{ t: 'error', m: 'the gate is sealed' }], 'a stranger at a court past the first after the seal');
  });
});

test('GATE-COURTS the relay: a party stands together - the book asks the hub its party only once the night holds more than one court, and seats a mate in its party\'s court past the fifty (mutants: the hub never asked; asked for every newcomer; the mate unplaced)', async () => {
  const party = { [`acct-${id(99)}`]: [`acct-${id(99)}`, `acct-${id(60)}`] };
  await night(async ({ world, court, into }) => {
    let asked = 0;
    const get = world.ROOMS.get;
    world.ROOMS.get = (n) => { const o = get(n); return n === SOCIAL_ROOM ? { fetch: (req) => { if (new URL(req.url).pathname === GATE_INTERNAL_PARTY) asked++; return o.fetch(req); } } : o; };
    for (let i = 0; i < 10; i++) await into(0, id(i));
    assert.equal(asked, 0, 'one court with room: no party to ask');
    for (let i = 10; i < 50; i++) await into(0, id(i));
    // the second court opens, its first fighter id(60); then the first court's ... mate id(99) comes
    const g = await into(0, id(60));
    assert.deepEqual(gates(g, 'go').map((m) => m.c), [1]);
    await into(1, id(60));
    for (let i = 61; i <= 110; i++) { if (i === 99) continue; const w = await into(0, id(i)); const c = gates(w, 'go')[0]?.c; if (c != null) await into(c, id(i)); }
    assert.equal(C.courtCounts(court(0).store.get('gatebook'), Date.now())[1], 50, 'the second court full');
    const mate = await into(0, id(99));
    assert.deepEqual(gates(mate, 'go').map((m) => m.c), [1], 'its party\'s court, past the fifty');
    assert.ok(asked > 0, 'the hub asked once the night held two courts');
  }, { party });
});

test('GATE-COURTS the relay: each court\'s kill is its own - its receipts, the hub\'s `cf` (its court; the first court\'s the courts it holds), the book told; the gate stands for the night\'s other courts until the seal, and the night\'s `fell` is said once every joined court has won - its courts, once (mutants: a court\'s kill said as the night; the book untold; the night before the seal; said twice)', async () => {
  await night(async ({ court, into, fire, tick, hub, set }) => {
    const h = hub.connect(); await hub.hello(h, id(900));
    const a = await into(0, id(1));
    const c1 = court(0);
    for (let i = 2; i <= 50; i++) await into(0, id(i));
    await into(0, id(51));
    const b = await into(1, id(51));
    await tick([0, 1], 3);
    // the second court wins first
    const f1 = court(1).room._fight;
    f1.players[`acct-${id(51)}`].stoodMs = 1e9; f1.hp = 1;
    await court(1).raw(b, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell }));
    await settle();
    assert.equal(gates(b, 'fell').length, 1, 'the second court saw its kill');
    assert.equal(gates(a, 'fell').length, 0, 'the first court\'s fight goes on');
    assert.equal(gates(b, 'rcpt').length, 1, 'and its fighter its receipt');
    await tick([0, 1], 2);
    assert.deepEqual(gates(h, 'cf').map((m) => [m.c, m.cs ?? null]), [[1, null]], 'the hub said the second court\'s kill');
    assert.equal(gates(h, 'fell').length, 0, 'the gate stands');
    assert.ok(c1.store.get('gatebook').f[1], 'the book heard it');
    assert.equal(court(1).store.get('gatefight').booked, true);
    // the first court wins before the seal: said, the gate still standing
    const f0 = c1.room._fight;
    f0.players[`acct-${id(1)}`].stoodMs = 1e9; f0.hp = 1;
    await c1.raw(a, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell }));
    await tick([0, 1], 2);
    assert.deepEqual(gates(h, 'cf').map((m) => [m.c, m.cs ?? null]), [[1, null], [0, 2]], 'the first court\'s kill, and the courts the night holds');
    assert.equal(gates(h, 'fell').length, 0, 'before the seal a newcomer may open a third court');
    // the seal: every joined court has won - the night, once
    set(TT.sealAt);
    await fire(0);
    const night = gates(h, 'fell');
    assert.equal(night.length, 1);
    assert.deepEqual([night[0].d, night[0].at, night[0].w, night[0].cs, night[0].n], [DAY, TT.sealAt, 2, 2, 51]);
    await tick([0, 1], 30);
    assert.equal(gates(h, 'fell').length, 1, 'once');
    assert.equal(c1.store.get('gatebook').told, 1);
  });
});

test('GATE-COURTS the relay: the rite\'s own receipt is the night\'s book\'s, minted at the night\'s end for one who broke the rite and holds no court\'s - never at a court\'s kill (mutants: minted by the court; to a court\'s fighter; before the night)', async () => {
  await night(async ({ world, court, into, fire, tick, hub, set }) => {
    const get = world.ROOMS.get;
    world.ROOMS.get = (n) => { const o = get(n); return n === SOCIAL_ROOM ? { fetch: async (req) => (new URL(req.url).pathname === RITE_INTERNAL_DAY ? new Response(JSON.stringify({ h: [`acct-${id(1)}`, `acct-${id(7)}`] })) : o.fetch(req)) } : o; };
    const a = await into(0, id(1));
    await tick([0], 2);
    const f = court(0).room._fight;
    f.players[`acct-${id(1)}`].stoodMs = 1e9; f.hp = 1;
    await court(0).raw(a, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell }));
    await tick([0], 2);
    assert.equal(readReceipt(gates(a, 'rcpt')[0].r).r, 1, 'the fighter who broke it: its own receipt, an ember more');
    assert.equal(Object.keys(f.rc).includes(`acct-${id(7)}`), false, 'the court mints no rite\'s receipt');
    assert.equal(hub.store.get(`gaterc:acct-${id(7)}`), undefined, 'not before the night');
    set(TT.sealAt);
    await fire(0);
    const kept = hub.store.get(`gaterc:acct-${id(7)}`);
    assert.ok(kept, 'the hub keeps the rite\'s own');
    assert.equal(readReceipt(kept.r).x, 'rite');
    assert.equal(readReceipt(kept.r).b, gateBossOf(DAY).id);
    assert.equal(readReceipt(hub.store.get(`gaterc:acct-${id(1)}`).r).x === 'rite', false, 'never over a court\'s');
  });
});

test('GATE-COURTS the relay: the night full - every court seated - a newcomer is the court\'s watcher; after the seal the first court is the door of a fighter of any court, a stranger refused (mutants: the full night seated; a court\'s fighter shut out at the first court after the seal)', async () => {
  await night(async ({ court, into, set, say }) => {
    const book = C.bookNew(DAY);
    for (let c = 1; c < C.GATE_COURTS_MAX; c++) for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) book.s[`acct-c${c}.${i}`] = [c, Date.now(), 1];
    book.s[`acct-${id(77)}`] = [4, Date.now(), 1];
    court(0).store.set('gatebook', book);
    for (let i = 0; i < 50; i++) await into(0, id(i));
    const w = await into(0, id(50));
    assert.deepEqual(gates(w, 'no').map((m) => m.m), ['the court is full'], 'every court full: the watcher\'s word');
    assert.ok(gates(w, 'st').length === 1 && gates(w, 'st')[0].me === undefined, 'handed the first court\'s fight to watch');
    set(TT.sealAt + 1000);
    const back = court(0).connect(); await court(0).hello(back, id(77), at(0, 3));
    assert.equal(back.closed, null, 'a fourth-court fighter comes in at the first court after the seal');
    await say(court(0), back, { k: 'in', lv: 10, bv: GATE_BRAIN_V }); await settle();
    assert.deepEqual(gates(back, 'go').map((m) => m.c), [4], 'and is sent on to its own');
    const stranger = court(0).connect(); await court(0).hello(stranger, id(88), at(0, 3));
    assert.deepEqual(stranger.sent, [{ t: 'error', m: 'the gate is sealed' }]);
  });
});

test('GATE-COURTS the hub: a court\'s kill (`c`) said as `cf`, its receipts handed, neither kept nor the herald\'s; the night (`night`) is the gate\'s `fell`, kept and heralded once (mutants: a court\'s kill kept as the night; the herald told each court)', async () => {
  await night(async ({ hub }) => {
    hub.env.GATE_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcDEF_-x';   // the herald on: what it is owed is read back
    const h = hub.connect(); await hub.hello(h, id(5));
    const door = (body) => hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body) }));
    assert.equal((await door({ d: DAY, c: 3, at: 10, top: ['Ann'], n: 4, rc: [], here: [] })).status, 200);
    assert.deepEqual(gates(h, 'cf'), [{ t: 'gate', k: 'cf', at: 10, top: ['Ann'], n: 4, d: DAY, c: 3 }]);
    assert.equal(hub.store.get('gatefell'), undefined, 'a court\'s kill is not the night');
    assert.equal(hub.store.get('herald'), undefined, 'nor owed to the channel');
    await door({ d: DAY, night: 1, at: 20, top: ['Ann'], n: 9, w: 2, cs: 3, rc: [], here: [] });
    assert.deepEqual(gates(h, 'fell'), [{ t: 'gate', k: 'fell', at: 20, top: ['Ann'], n: 9, d: DAY, w: 2, cs: 3 }]);
    assert.deepEqual(hub.store.get('gatefell'), { k: 'fell', at: 20, top: ['Ann'], n: 9, d: DAY, w: 2, cs: 3 }, 'kept for a hello');
    assert.deepEqual(hub.store.get('herald')?.owe, { d: DAY, top: ['Ann'], n: 9, w: 2, cs: 3 }, 'and owed to the channel once, with its courts');
    const party = await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_PARTY}`, { method: 'POST', body: JSON.stringify({ a: `acct-${id(5)}` }) }));
    assert.deepEqual(await party.json(), { m: [] }, 'one in no party: no mates');
    assert.equal((await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_PARTY}`, { method: 'POST', body: '{}' }))).status, 400);
  });
});

// ═══ THE CLIENT ═══════════════════════════════════════════════════════════════════════════════

test('GATE-COURTS the link: `go` moves my room to that court for its day; a court\'s kill said once in its own words, moving no fall; the night\'s `fell` the fall, said only where no court\'s was; a court\'s own `fell` folds its fight alone (mutants: the go unkept; a court\'s kill as the fall; said twice; the night said over a court\'s)', () => {
  const said = [];
  const link = createGateLink({ now: () => 0, onFell: (day, f) => said.push([day, f.c ?? null, f.cs ?? null]) });
  assert.equal(link.room(DAY), gateRoomKey(DAY), 'the first court until the book says');
  link.word({ k: 'go', d: DAY, c: 4 });
  assert.equal(link.room(DAY), gateRoomKey(DAY, 4));
  assert.equal(link.room(DAY + 1), gateRoomKey(DAY + 1), 'a court is its night\'s');
  link.word({ k: 'st', d: DAY, b: 'ruhn', ph: 1, h: 5, m: 10, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 1, fell: null, wrath: null, md: null, ct: 0, xa: [], cx: null, su: 0, rk: 0, op: 0 });
  link.word({ k: 'fell', at: 5, top: [], n: 1 });
  assert.equal(link.state().fell?.at, 5, 'a court\'s own kill folds its fight');
  assert.equal(link.fellAt(DAY), null, 'and moves no fall - it names no day, and the court it was is not the night');
  link.word({ k: 'cf', d: DAY, c: 4, at: 5, top: ['Ann'], n: 3 });
  link.word({ k: 'cf', d: DAY, c: 4, at: 5, top: ['Ann'], n: 3 });
  link.word({ k: 'cf', d: DAY, c: 0, cs: 5, at: 6, top: [], n: 2 });
  assert.deepEqual(said, [[DAY, 4, 0], [DAY, 0, 5]], 'each court once');
  assert.equal(link.fellAt(DAY), null, 'the gate stands');
  link.word({ k: 'fell', d: DAY, at: 9, top: [], n: 5, w: 2, cs: 5 });
  assert.equal(link.fellAt(DAY), 9, 'the night\'s fall');
  assert.equal(said.length, 2, 'said nothing more - its courts were');
  const quiet2 = [];
  const other = createGateLink({ now: () => 0, onFell: (day, f) => quiet2.push(f.c ?? null) });
  other.word({ k: 'fell', d: DAY, at: 9, top: [], n: 5 });
  assert.deepEqual(quiet2, [null], 'a night heard with no court\'s kill before it: said, as every kill was');
});

test('GATE-COURTS the words: a court\'s kill by its number, where, and who struck - no collapse; a night of courts on Discord says the courts that won of the courts it held (mutants: the court\'s number; the collapse said for a court)', () => {
  assert.equal(courtFellLine({ near: 'Copperham', boss: 'Valkynaz Ruhn', top: ['Ann', 'Bran'], c: 2 }), "Valkynaz Ruhn has fallen in court 3 of Dagon's Breach near Copperham, struck down by Ann, Bran.");
  assert.equal(courtFellLine({ near: null, boss: 'Valkynaz Ruhn', top: [], c: 0 }), "Valkynaz Ruhn has fallen in court 1 of Dagon's Breach in the wilds.");
  assert.ok(!courtFellLine({ near: 'X', boss: 'B', top: [], c: 0 }).includes('collapses'), 'the breach stands for the other courts');
  assert.ok(fellLine({ near: 'X', boss: 'B', top: [] }).includes('The breach collapses.'), 'the night\'s own line keeps it');
  const card = (o) => JSON.stringify(fellPost({ day: DAY, place: 'Copperham', top: ['Ann'], n: 9, ...o }));
  assert.ok(card({ w: 2, cs: 3 }).includes(`${gateBossOf(DAY).name} has fallen in 2 of 3 courts`));
  assert.ok(card({}).includes(`${gateBossOf(DAY).name} has fallen"`), 'a night of one court: the card as it was');
});

test('GATE-COURTS the wiring: the host\'s room is the court the book seats me in, a court\'s kill its own line; the relay\'s doors and its seat asked before a newcomer\'s fight (mutants: the first court forever; the doors unrouted; the seat asked after the fight is made)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /else if \(modes\?\.roomIdentity\?\.\(\)\?\.kind === 'gate'\) key = \(gateLink\?\.room \?\? gateRoomKey\)\(modes\?\.roomIdentity\?\.\(\)\?\.day\);/);
  assert.match(w, /eventNotice\('gate', \(f\.c != null \? courtFellLine : fellLine\)\(\{ \.\.\.f,/);
  const r = src('server/src/index.js');
  for (const [door, fn] of [['GATE_INTERNAL_SEAT', '_gateSeatInternal'], ['GATE_INTERNAL_COURT', '_gateCourtInternal'], ['GATE_INTERNAL_PARTY', '_gatePartyInternal']]) assert.ok(r.includes(`if (path === ${door}) return this.${fn}(request);`), door);
  const frame = r.slice(r.indexOf('  async _gateFrame(ws, a, m, now) {'));
  assert.ok(frame.indexOf('await this._gateSentOn(ws, a, f, now)') > 0 && frame.indexOf('await this._gateSentOn(ws, a, f, now)') < frame.indexOf('if (!f) { f = this._fight = GATE_SEAM.new('), 'asked before the fight is made');
  assert.ok(r.includes('if (!f) return this._gateBookTick();'), 'a first court\'s book beats with no fight of its own');
});

// ═══ AUDIT GATE-COURTS (2026-10-26) ════════════════════════════════════════════════════════════
// The owner: "Audit this". Three cold lanes (the relay; the law, the wire and the client; the pins, the record and the
// cost) - bible/11-Multiplayer/World-Bosses.md section 30. Each finding's pin below fails on the code before its fix.

const inWord = { k: 'in', lv: 10, bv: GATE_BRAIN_V };
/** The Warden of court `c` a blow from falling, `ws` its fighter who stood the fight. */
const killIn = async (R, ws, sub) => { const f = R.room._fight; f.players[sub].stoodMs = 1e9; f.hp = 1; await R.raw(ws, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell })); await settle(); };
/** The doors' answers on the way to `id` changed as `answer(req)` says (a Response, or undefined for the room's own). */
const doors = (world, id, answer) => { const get = world.ROOMS.get; world.ROOMS.get = (n) => { const o = get(n); return n === id ? { fetch: async (req) => (await answer(req)) ?? o.fetch(req) } : o; }; return () => { world.ROOMS.get = get; }; };

test('AUDIT GATE-COURTS R1 the relay: two newcomers whose `in`s land together at a court with no fight yet both fight its ONE fight - the fight is read again after the book is asked (mutants: the fight not read again)', async () => {
  await night(async ({ court, into, say }) => {
    for (let i = 0; i < 50; i++) await into(0, id(i));
    await into(0, id(50)); await into(0, id(51));
    const R = court(1);
    const a = R.connect(); await R.hello(a, id(50), at(0, 3));
    const b = R.connect(); await R.hello(b, id(51), at(1, 3));
    await Promise.all([say(R, a, inWord), say(R, b, inWord)]);
    await settle();
    const both = [`acct-${id(50)}`, `acct-${id(51)}`];
    assert.deepEqual(Object.keys(R.room._fight.players).sort(), both, 'one fight holds both');
    assert.deepEqual(Object.keys(R.store.get('gatefight').players).sort(), both, 'and storage keeps that one');
  });
});

test('AUDIT GATE-COURTS R2/P5 the relay: the book hears a court\'s kill AT the kill - a newcomer that moment is never seated before a fallen Warden; a page sent on before a court\'s kill, refused at its door after it, is placed again at the first court (mutants: the book told on the next beat; told only once said; a pending seat in a won court kept)', async () => {
  await night(async ({ court, into }) => {
    const a = await into(0, id(1));
    await killIn(court(0), a, `acct-${id(1)}`);
    assert.ok(court(0).store.get('gatebook').f[0], 'the first court\'s kill in its book before any beat');
    const n = await into(0, id(2));
    assert.deepEqual(gates(n, 'go').map((m) => m.c), [1], 'a newcomer the same moment: the second court');
    assert.equal(court(0).room._fight.players[`acct-${id(2)}`], undefined);
  });
  await night(async ({ court, into }) => {
    for (let i = 0; i < 50; i++) await into(0, id(i));
    await into(0, id(50));
    const b = await into(1, id(50));
    const late = await into(0, id(60));
    assert.deepEqual(gates(late, 'go').map((m) => m.c), [1], 'sent on to the second court while its Warden stands');
    await killIn(court(1), b, `acct-${id(50)}`);
    assert.ok(court(0).store.get('gatebook').f[1], 'the second court\'s kill told the book at the kill');
    const R = court(1), door = R.connect(); await R.hello(door, id(60), at(0, 3));
    assert.deepEqual(door.sent, [{ t: 'error', m: 'the gate is closing' }], 'its court refuses it - its Warden fell before it came');
    const again = await into(0, id(60));
    assert.deepEqual(gates(again, 'go').map((m) => m.c), [2], 'the first court places it again: the third court');
  });
});

test('AUDIT GATE-COURTS R4/C3 the relay: a seat is JOINED only where its court\'s fight takes it - a page sent on before the seal whose `in` lands after it is refused, its seat stays pending, and the night is said at the seal (mutants: joined whatever the fight; the court\'s word ignored; the word unsent)', async () => {
  await night(async ({ court, into, say, set, fire, hub }) => {
    const h = hub.connect(); await hub.hello(h, id(900));
    const a = await into(0, id(0));
    for (let i = 1; i < 50; i++) await into(0, id(i));
    await killIn(court(0), a, `acct-${id(0)}`);
    set(TT.sealAt - 1000);   // sent on a moment before the seal - its seat still live (GATE_SEAT_PENDING_MS) when its `in` lands
    await into(0, id(70));
    const R = court(1), n = R.connect(); await R.hello(n, id(70), at(0, 3));
    set(TT.sealAt + 100);
    await say(R, n, inWord); await settle();
    assert.deepEqual(gates(n, 'no').map((m) => m.m), ['the gate is sealed']);
    assert.equal(court(0).store.get('gatebook').s[`acct-${id(70)}`][2], 0, 'pending - no fight took it');
    await fire(0);
    assert.equal(gates(h, 'fell').length, 1, 'the night at the seal: the second court never held a fighter');
  });
});

test('AUDIT GATE-COURTS R3 the hub: a receipt of the rite alone never goes over a same-day receipt the account holds - neither kept nor handed (mutants: the rite\'s own written over a court\'s)', async () => {
  await night(async ({ hub }) => {
    const sub = `acct-${id(9)}`;
    const h = hub.connect(); await hub.hello(h, id(9), null, { name: id(9), acct: sub, asecret: `secret-of-${sub}` });
    const nowS = Math.floor(Date.now() / 1000), subtle = globalThis.crypto.subtle;
    const won = await mintReceipt({ d: DAY, b: gateBossOf(DAY).id, s: sub, c: 7, x: 'stood', l: 10 }, null, { subtle, nowS });
    const rite = await mintReceipt({ d: DAY, b: gateBossOf(DAY).id, s: sub, c: 8, x: 'rite' }, null, { subtle, nowS });
    const door = (body) => hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body) }));
    await door({ d: DAY, c: 1, at: 10, top: [], n: 1, rc: [[sub, won]], here: [] });
    await door({ d: DAY, night: 1, at: 20, top: [], n: 1, w: 1, cs: 1, rc: [[sub, rite]], here: [] });
    assert.equal(hub.store.get(`gaterc:${sub}`).r, won, 'the court\'s kept');
    assert.deepEqual(gates(h, 'rcpt').map((m) => readReceipt(m.r).x), ['stood'], 'and only it handed');
  });
});

test('AUDIT GATE-COURTS R5/P10 the relay: a socket sent on is answered the same `go` for COURT_WATCH_ASK_MS without the book asked or written; the book is written only when a seat changed it (mutants: the go unthrottled; the book written unchanged)', async () => {
  await night(async ({ world, court, into, say }) => {
    for (let i = 0; i < 50; i++) await into(0, id(i));
    let writes = 0, calls = 0;
    const put = court(0).state.storage.put.bind(court(0).state.storage);
    court(0).state.storage.put = async (k, v) => { if (k === 'gatebook') writes++; return put(k, v); };
    const n = await into(0, id(50));
    assert.equal(writes, 1, 'the seat given: one write');
    for (let i = 0; i < 5; i++) await say(court(0), n, inWord);
    await settle();
    assert.deepEqual(gates(n, 'go').map((m) => m.c), [1, 1, 1, 1, 1, 1], 'the same court each time');
    assert.equal(writes, 1, 'and nothing written for the asks');
    const undo = doors(world, gateRoomKey(DAY), (req) => { if (new URL(req.url).pathname === GATE_INTERNAL_SEAT) calls++; });
    const stray = await into(2, id(3));
    for (let i = 0; i < 4; i++) await say(court(2), stray, inWord);
    await settle(); undo();
    assert.equal(calls, 1, 'a court past the first asks the book once');
    assert.equal(writes, 1, 'a seat held asked again: unchanged, unwritten');
  });
});

test('AUDIT GATE-COURTS P1 the relay: the night is said until the hub answers - the same word and the same rite\'s receipts, kept with the night\'s moment before they are said, once (mutants: told although unanswered; the night\'s moment unkept; no retry)', async () => {
  await night(async ({ world, court, into, fire, tick, hub, set }) => {
    const h = hub.connect(); await hub.hello(h, id(900));
    const a = await into(0, id(1));
    await killIn(court(0), a, `acct-${id(1)}`);
    await tick([0], 2);
    let refused = 0;
    const undo = doors(world, SOCIAL_ROOM, async (req) => { if (new URL(req.url).pathname === GATE_INTERNAL_FELL && (await req.clone().json()).night && refused++ === 0) return new Response('no', { status: 503 }); });
    set(TT.sealAt);
    await fire(0);
    const book = court(0).store.get('gatebook');
    assert.equal(book.end, TT.sealAt, 'the night\'s moment kept');
    assert.equal(book.told, 0, 'not told - the hub did not answer');
    assert.equal(gates(h, 'fell').length, 0);
    assert.equal(court(0).alarm.at, TT.sealAt + GATE_TELL_RETRY_MS, 'a beat to tell it again');
    await tick([0], Math.ceil(GATE_TELL_RETRY_MS / BRAIN_TICK_MS) + 1);
    undo();
    assert.equal(court(0).store.get('gatebook').told, 1);
    assert.equal(gates(h, 'fell').length, 1, 'said');
    assert.equal(gates(h, 'fell')[0].at, TT.sealAt, 'the same night');
    await tick([0], 40);
    assert.equal(gates(h, 'fell').length, 1, 'once');
  });
});

test('AUDIT GATE-COURTS P2 the relay: a court\'s kill is told the book until it hears; the last court to win after the seal has the night said within a retry, never at the wrath (mutants: told although unheard; told although it threw; the retry unarmed; the court door arming nothing)', async () => {
  await night(async ({ world, court, into, tick, hub, set, now }) => {
    const h = hub.connect(); await hub.hello(h, id(900));
    const a = await into(0, id(0));
    for (let i = 1; i < 50; i++) await into(0, id(i));
    await into(0, id(50));
    const b = await into(1, id(50));
    await tick([0, 1], 2);
    await killIn(court(0), a, `acct-${id(0)}`);
    await tick([0, 1], 2);
    set(TT.sealAt + 10);
    await tick([0, 1], 2);
    assert.equal(gates(h, 'fell').length, 0, 'the second court still fights');
    let refused = 0;
    // refused twice - the kill's own try throws, the next beat's is answered 503: only the retry that beat arms delivers it
    const undo = doors(world, gateRoomKey(DAY), (req) => { if (new URL(req.url).pathname !== GATE_INTERNAL_COURT) return undefined; const k = refused++; if (k === 0) throw new Error('the first court is down'); return k === 1 ? new Response('no', { status: 503 }) : undefined; });
    await killIn(court(1), b, `acct-${id(50)}`);
    assert.equal(court(0).store.get('gatebook').f[1], undefined, 'the book did not hear');
    assert.equal(court(1).store.get('gatefight').booked, undefined, 'and the court knows it');
    await tick([0, 1], Math.ceil(GATE_TELL_RETRY_MS / BRAIN_TICK_MS) + 2);
    undo();
    assert.equal(refused, 3, 'asked a third time');
    assert.ok(court(0).store.get('gatebook').f[1], 'told again until heard');
    await tick([0, 1], Math.ceil(GATE_TELL_RETRY_MS / BRAIN_TICK_MS) + 2);
    assert.equal(gates(h, 'fell').length, 1, 'the night said');
    assert.ok(now() < TT.wrathAt, 'long before the wrath');
  });
});

test('AUDIT GATE-COURTS P3 the relay: a REAL party, formed through the hub\'s own frames - a mate arriving when the first court holds exactly fifty sits with its party past the fifty; the hub asked once for it, not again for a seat it holds (mutants: the hub\'s party never read; the first court\'s fifty no reason to ask; asked again at the confirmation)', async () => {
  await night(async ({ world, hub, court, into, set, now }) => {
    const sock = {};
    for (const n of [40, 99]) { const ws = hub.connect(); await hub.hello(ws, id(n), null, { name: id(n), acct: `acct-${id(n)}`, asecret: `secret-of-acct-${id(n)}` }); sock[n] = ws; }
    await hub.raw(sock[40], JSON.stringify({ t: 'social', k: 'party.invite', peer: id(99) }));
    const pid = sock[99].sent.filter((m) => m.t === 'social' && m.k === 'invite').at(-1)?.party;
    assert.ok(pid, 'invited');
    await hub.raw(sock[99], JSON.stringify({ t: 'social', k: 'party.accept', party: pid }));
    let asked = 0;
    doors(world, SOCIAL_ROOM, (req) => { if (new URL(req.url).pathname === GATE_INTERNAL_PARTY) asked++; });
    for (let i = 0; i < 50; i++) await into(0, id(i));
    assert.equal(C.courtCounts(court(0).store.get('gatebook'), Date.now())[0], 50, 'exactly fifty, no court past the first');
    const mate = await into(0, id(99));
    assert.ok(gates(mate, 'st').some((m) => m.me === 1), 'seated with its party in the first court');
    assert.equal(asked, 1, 'the hub asked its party');
    const stranger = await into(0, id(98));
    assert.deepEqual(gates(stranger, 'go').map((m) => m.c), [1]);
    const before = asked;
    await into(1, id(98));
    assert.equal(asked, before, 'its seat confirmed in its court: the hub not asked again');
    set(now() + C.GATE_MATES_KEEP_MS + 1);   // the party the hub said has lapsed (GATE_MATES_KEEP_MS); the seat, joined, has not
    assert.ok(now() < TT.sealAt);
    const back = await into(0, id(98));
    assert.deepEqual(gates(back, 'go').map((m) => m.c), [1], 'back at the first court\'s door: its own court');
    assert.equal(asked, before, 'a seat held: the hub not asked');
  }, { party: null });
});

test('AUDIT GATE-COURTS P4 the relay: the rite\'s own waits for the hub to say the helpers; a helper who fought in a court past the first holds that court\'s receipt and no rite\'s own (mutants: the night said with no helpers heard; the court pays nobody; a court\'s payees dropped at the book\'s door)', async () => {
  await night(async ({ world, court, into, fire, tick, hub, set }) => {
    const h = hub.connect(); await hub.hello(h, id(900));
    let silent = true;
    doors(world, SOCIAL_ROOM, (req) => (new URL(req.url).pathname === RITE_INTERNAL_DAY ? (silent ? new Response('busy', { status: 503 }) : new Response(JSON.stringify({ h: [`acct-${id(50)}`, `acct-${id(77)}`] }))) : undefined));
    const a = await into(0, id(0));
    for (let i = 1; i < 50; i++) await into(0, id(i));
    await into(0, id(50));
    const b = await into(1, id(50));
    await tick([0, 1], 2);
    await killIn(court(0), a, `acct-${id(0)}`);
    await killIn(court(1), b, `acct-${id(50)}`);
    await tick([0, 1], 2);
    set(TT.sealAt);
    await fire(0);
    assert.equal(court(0).store.get('gatebook').end, 0, 'the hub said no helpers: the night waits');
    assert.equal(gates(h, 'fell').length, 0);
    silent = false;
    await tick([0], Math.ceil(GATE_TELL_RETRY_MS / BRAIN_TICK_MS) + 1);
    assert.equal(gates(h, 'fell').length, 1, 'said once the helpers are heard');
    const rc = new Map(court(0).store.get('gatebook').rc);
    assert.ok(rc.has(`acct-${id(77)}`), 'the helper who fought nowhere: the rite\'s own');
    assert.equal(rc.has(`acct-${id(50)}`), false, 'the helper who fought in the second court: its court\'s, never the rite\'s');
  });
});

test('AUDIT GATE-COURTS P7 the relay: a first court whose book outlives its fight says the night on its own alarm and forgets the book at the day\'s end; the seat door arms the alarm (mutants: the book\'s tick asleep; the book kept; the seat door arming nothing)', async () => {
  await night(async ({ court, fire, hub, set }) => {
    const h = hub.connect(); await hub.hello(h, id(900));
    const book = C.bookNew(DAY);
    book.s[`acct-${id(1)}`] = [0, Date.now(), 1];
    C.courtFell(book, 0, { at: Date.now(), top: ['Ann'], n: 1, rs: [`acct-${id(1)}`] });
    court(0).store.set('gatebook', book);
    await court(0).state.storage.setAlarm(TT.sealAt);   // the alarm its book armed, as a wake after a deploy finds it
    set(TT.sealAt);
    await fire(0);
    assert.equal(gates(h, 'fell').length, 1, 'no fight of its own: the book\'s beat said the night');
    set(TT.wrathAt + GATE_COLLAPSE_MS);
    await fire(0);
    assert.equal(court(0).store.has('gatebook'), false, 'the day over: the book forgotten');
  });
  await night(async ({ court }) => {
    const res = await court(0).room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_SEAT}`, { method: 'POST', body: JSON.stringify({ d: DAY, s: `acct-${id(1)}`, c: 3 }) }));
    assert.deepEqual(await res.json(), { c: 0 });
    assert.equal(court(0).alarm.at, TT.sealAt, 'the seat door arms the book\'s next moment');
  });
});

test('AUDIT GATE-COURTS P8 the doors, the words and the bounds: the seat and court doors refuse what is not a seat or a court past the first; a newcomer sealed out and closed out in their own words; the night\'s `cs` bounded; the herald\'s post says its courts (mutants: the seat door unchecked; the court door takes the first; the count unchecked; sealed or closing one word; the courts dropped from the post; the courts dropped from the send; `cs` unbounded)', async () => {
  assert.equal(validGateOut({ k: 'fell', d: DAY, at: 5, top: [], n: 1, cs: C.GATE_COURTS_MAX + 1 }), null, 'cs past the courts');
  await night(async ({ court, into, say, set }) => {
    const door = (path, body) => court(0).room.fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body) }));
    assert.equal((await door(GATE_INTERNAL_SEAT, { d: DAY, s: 'x', c: C.GATE_COURTS_MAX })).status, 400, 'a court past the last');
    assert.equal((await door(GATE_INTERNAL_SEAT, { d: DAY, s: '', c: 1 })).status, 400, 'no account');
    assert.equal((await door(GATE_INTERNAL_COURT, { d: DAY, c: 0, at: 1, n: 1 })).status, 400, 'the first court tells its own book');
    assert.equal((await door(GATE_INTERNAL_COURT, { d: DAY, c: 2, at: 1, n: -1 })).status, 400, 'a count');
    const R = court(0), a = R.connect(); await R.hello(a, id(1), at(0, 3));
    set(TT.sealAt + 1);
    await say(R, a, inWord); await settle();
    assert.deepEqual(gates(a, 'no').map((m) => m.m), ['the gate is sealed'], 'sealed out');
  });
  await night(async ({ court, into, say, set }) => {
    const f = await into(0, id(0));
    await killIn(court(0), f, `acct-${id(0)}`);
    const R = court(0), a = R.connect(); await R.hello(a, id(1), at(0, 3));
    set(TT.sealAt + 1);
    await say(R, a, inWord); await settle();
    assert.deepEqual(gates(a, 'no').map((m) => m.m), ['the gate is closing'], 'its Warden fallen: closing');
  });
  const realFetch = globalThis.fetch, posts = [];
  globalThis.fetch = async (url, init) => { posts.push(JSON.parse(init.body)); return { ok: true, status: 204 }; };
  try {
    await night(async ({ hub, fire }) => {
      hub.env.GATE_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcDEF_-x';
      await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d: DAY, night: 1, at: Date.now(), top: ['Ann'], n: 9, w: 2, cs: 3, rc: [], here: [] }) }));
      await hub.fire();
    });
  } finally { globalThis.fetch = realFetch; }
  assert.ok(posts.some((p) => JSON.stringify(p).includes(`${gateBossOf(DAY).name} has fallen in 2 of 3 courts`)), 'the herald posted the night with its courts');
});

test('AUDIT GATE-COURTS C5/P10 the relay: a full night\'s watcher in a first court whose Warden has fallen is handed no fallen fight (it would stop asking); the watcher\'s party asked of the hub once a minute, not every ask (mutants: a fallen fight handed; the party asked every time)', async () => {
  await night(async ({ world, court, into, say, set, now }) => {
    let asked = 0;
    doors(world, SOCIAL_ROOM, (req) => { if (new URL(req.url).pathname === GATE_INTERNAL_PARTY) asked++; });
    const book = C.bookNew(DAY);
    for (let c = 1; c < C.GATE_COURTS_MAX; c++) for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) book.s[`acct-c${c}.${i}`] = [c, now(), 1];
    court(0).store.set('gatebook', book);
    const first = await into(0, id(0));
    for (let i = 1; i < 50; i++) await into(0, id(i));
    await killIn(court(0), first, `acct-${id(0)}`);
    asked = 0;   // each of the fifty asked its own party - the watcher's are counted from here
    const w = await into(0, id(50));
    assert.deepEqual(gates(w, 'no').map((m) => m.m), ['the court is full']);
    assert.equal(gates(w, 'st').length, 0, 'no fallen fight handed');
    set(now() + 15_500);
    await say(court(0), w, inWord); await settle();
    assert.equal(gates(w, 'no').length, 2, 'asked again');
    assert.equal(asked, 1, 'the hub asked its party once');
  });
});

test('AUDIT GATE-COURTS C6 staff: a staff landing names the court its player stands in, and lands there - the relay seats staff in no book (mutants: the court dropped from the landing; a court past the last landed; one key for every court; the court unnamed; the court not kept landing; the host names no court; the host lands in the first court; staff sent on by the book)', async () => {
  const link = createGateLink({ now: () => 0 });
  link.word({ k: 'go', d: DAY, c: 5 });
  const gate = { day: DAY, px: 10, py: 20, spot: [1, 2], near: 'X' };
  assert.deepEqual(link.withCourt(gate), { ...gate, c: 5 });
  const dest = { kind: 'gate', pixel: { x: 10, y: 20 }, pos: [0, 0, 0], yaw: 0, pitch: 0, gate: { ...gate, c: 5 } };
  assert.equal(validStaffDestination(dest)?.gate?.c, 5, 'carried');
  assert.equal(validStaffDestination({ ...dest, gate: { ...gate, c: C.GATE_COURTS_MAX } }), null, 'bounded');
  assert.equal(staffDestinationKey(dest), `gate:${DAY}.5`);
  const staffLink = createGateLink({ now: () => 0 });
  assert.equal(staffLink.seatFor(validStaffDestination(dest).gate).c, 5);
  assert.equal(staffLink.room(DAY), gateRoomKey(DAY, 5), 'staff land in the player\'s court');
  const w = src('src/scenes/world.js');
  assert.ok(w.includes("dest = { ...dest, kind: 'gate', gate: gateLink?.withCourt?.(gate) ?? gate };"), 'the host names the court on its landing');
  assert.ok(w.includes("entered = await modes?.enterGateArena?.(gateLink?.seatFor?.(d.gate) ?? d.gate);"), 'and lands staff in it');
  await night(async ({ court, say }) => {
    const R = court(5), s = R.connect(); await R.hello(s, id(1), at(0, 3), { glyphs: ['dev'] });
    await say(R, s, inWord); await settle();
    assert.equal(gates(s, 'go').length, 0, 'never sent on');
    assert.ok(R.room._fight.players[`acct-${id(1)}`], 'fights where it stands');
    assert.equal(court(0).store.get('gatebook'), undefined, 'and no book seated it');
  });
});

test('AUDIT GATE-COURTS C1/C2/C8 the link: the night\'s word folds no court\'s fight; leaving the court forgets the court the book sent me to; `go` carries nothing of one court into the next (mutants: the night folded; the court kept; a court carried)', () => {
  const st = { k: 'st', d: DAY, b: 'ruhn', ph: 1, h: 5, m: 10, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 1, fell: null, wrath: null, md: null, ct: 0, xa: [], cx: null, su: 0, rk: 0, op: 0 };
  const link = createGateLink({ now: () => 0 });
  link.word(st);
  link.word({ k: 'fell', d: DAY, at: 9, top: ['Ann'], n: 50, w: 1, cs: 2 });
  assert.equal(link.state().fell, null, 'my court still fights - another court\'s best three never fold into it');
  assert.equal(link.fellAt(DAY), 9);
  link.word({ k: 'go', d: DAY, c: 3 });
  assert.equal(link.state().day, null, 'the court I leave by `go` carries nothing');
  link.word(st);
  link.leave();
  assert.equal(link.room(DAY), gateRoomKey(DAY), 'out of the court: the first court\'s book is asked again');
});

test('AUDIT GATE-COURTS C4/C7 the words and the move: the seal\'s line waits for the night\'s word, and is never said once the gate collapses with it; the move between courts takes no room\'s hold (mutants: the seal said at once; the hold kept)', () => {
  const said = [];
  let clock = TT.sealAt, fell = null;
  const omen = createGateOmen({ now: () => clock, site: (d) => ({ day: d, place: 'Copperham, Wrothgarian Mountains', near: 'Copperham', px: 1, py: 1, spot: [0, 0], ring: { cx: 1, cy: 1, r: 2 } }), say: (s) => said.push(s), localTime: () => '00:00', fellAt: () => fell });
  omen.frame();
  assert.equal(said.filter((s) => s.includes('has sealed')).length, 0, 'held at the seal');
  clock = TT.sealAt + SEAL_SAY_HOLD_MS;
  omen.frame();
  assert.equal(said.filter((s) => s.includes('has sealed')).length, 1, 'said once the hold is over');
  const quiet2 = [];
  let clock2 = TT.sealAt;
  const omen2 = createGateOmen({ now: () => clock2, site: (d) => ({ day: d, place: 'P', near: 'N', px: 1, py: 1, spot: [0, 0], ring: { cx: 1, cy: 1, r: 2 } }), say: (s) => quiet2.push(s), localTime: () => '00:00', fellAt: () => fell });
  omen2.frame();
  fell = TT.sealAt + 500;
  clock2 = TT.sealAt + SEAL_SAY_HOLD_MS;
  omen2.frame();
  assert.deepEqual(quiet2.filter((s) => s.includes('has sealed') || s.includes('Covenant tears')), [], 'the gate collapsed with the night: neither the seal nor the wrath said');
  assert.match(src('src/scenes/world.js'), /\(isGateRoom\(key\) && isGateRoom\(online\.room\)\) \|\|/, 'a move between a night\'s courts takes no hold');
});
