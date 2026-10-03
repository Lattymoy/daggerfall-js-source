// TV3 (2026-09-28, bible/06-Systems/Travel-View.md, Mac: "being able to see other players traveling also"; his call:
// "Region-wide from the start").
//
// Pinned here: the wire's mark (net/wire.js validTravellerMark - the seven keys and no eighth, each in its range - its
// frame, its parse arm, its gates and its relay version), the relay over a real Room (a region's channel keeps each
// socket's mark on its attachment, fans it under the room's budget with the TOKEN's name, hands a joiner the fresh ones
// in its welcome, takes one out on a null, and refuses the world channel's), the session (the send's floor and doors,
// the welcome's marks, the inbound gate, a leave, the count that says ALONE), the client's own law
// (systems/travellerMarks.js - the mark of me and back, the cadence, the book), the readouts (the travel view's edge
// hold, the held map's marks and their paint), and the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validTravellerMark, validTravellerFrame, parseClient, relaySupportsTravellers, isRegionRoom, travHubGate, travRoomGate,
  TRAV_KEYS, TRAV_MODES, TRAV_SEND_MIN_MS, TRAV_KEEPALIVE_MS, TRAV_STALE_MS, TRAV_HUB_MIN_MS, TRAV_ROOM_HZ_MAX, TRAV_WELCOME_MAX,
  TRAVELLER_RELAY_MIN, RELAY_VERSION, chatRegionRoom, CHAT_WORLD_ROOM, DROP_STRIKES_MAX,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import {
  travellerMarkOf, travellerWorldOf, travellerDue, createTravellerBook, headingByte, yawOfHeading, travelModeIndex, TRAV_FRACTION,
} from '../src/systems/travellerMarks.js';
import { edgeHold, TV_EDGE_MARGIN } from '../src/ui/travelViewHud.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';   // AUDIT DEEP T1-1: the host's own lens
import { projectToScreen } from '../src/player/tapRay.js';
import { forwardOf, TV_TILT_DEFAULT, TV_RISE_S } from '../src/player/travelCamera.js';
import { createTravelView } from '../src/scenes/travelView.js';   // AUDIT NAMES N2-1: the badge through the view's own drawHud
import { readTravellerMarks, travellerMarksKey, TRAVELLER_MARK_CSS, TRAVELLER_LEGEND_TEXT } from '../src/ui/partyMapMarks.js';
import { paintInkOverlay } from '../src/ui/inkMap.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS } from '../src/systems/onlineLane.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const MARK = Object.freeze({ px: 207, py: 213, fx: 12, fy: 250, h: 64, m: 1, tv: 1 });

// ── THE WIRE ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('TV3 wire: a mark is seven keys and no eighth, each in its range - refused WHOLE otherwise; `tv` absent reads 0', () => {
  assert.deepEqual(TRAV_KEYS, ['px', 'py', 'fx', 'fy', 'h', 'm', 'tv']);
  assert.deepEqual(validTravellerMark(MARK), MARK);
  assert.deepEqual(validTravellerMark({ ...MARK, tv: undefined }), { ...MARK, tv: 0 });
  assert.deepEqual(TRAV_MODES, ['foot', 'horse', 'cart', 'ship']);
  for (const [why, p] of [
    ['an eighth key', { ...MARK, name: 'Lord Nobody' }], ['off the map east', { ...MARK, px: 1000 }], ['off the map south', { ...MARK, py: 500 }],
    ['a byte past 255', { ...MARK, fx: 256 }], ['a negative', { ...MARK, fy: -1 }], ['a fraction', { ...MARK, h: 1.5 }],
    ['a fifth way', { ...MARK, m: 4 }], ['a journey that is not 0 or 1', { ...MARK, tv: 2 }], ['a string number', { ...MARK, px: '207' }],
    ['an array', [1, 2, 3]], ['nothing', null],
  ]) assert.equal(validTravellerMark(p), null, why);
});

test('TV3 wire: the frame parses after the hello only, a null clears, a bad mark is an error; a frame in is the relay\'s id and name with the badge; the version gates it', () => {
  assert.deepEqual(parseClient(JSON.stringify({ t: 'trav', p: MARK })), { error: 'trav before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'trav', p: MARK }), { hasHello: true }), { t: 'trav', p: MARK });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'trav', p: null }), { hasHello: true }), { t: 'trav', p: null });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'trav', p: { ...MARK, x: 1 } }), { hasHello: true }), { error: 'bad trav' });
  const f = validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', sub: 'acct-0002', p: MARK, title: 'nope' });
  assert.equal(f.id, 'peer-0002'); assert.equal(f.name, 'Bran'); assert.equal(f.sub, 'acct-0002'); assert.deepEqual(f.p, MARK);
  assert.equal(f.title, null, 'a badge off the wire\'s own list, or none');
  assert.equal(validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', p: null }).p, null, 'gone');
  assert.equal(validTravellerFrame({ t: 'trav', id: 'peer-0002', p: { ...MARK, m: 9 } }), null);
  assert.equal(validTravellerFrame({ t: 'trav', id: 'x', p: MARK }), null, 'an id off the wire\'s shape');
  assert.equal(validTravellerFrame({ t: 'party', id: 'peer-0002', p: MARK }), null);
  assert.equal(TRAVELLER_RELAY_MIN, 122);
  assert.equal(relaySupportsTravellers('world121'), false, 'an older relay closes the socket on the frame');
  assert.equal(relaySupportsTravellers('world122'), true);
  assert.equal(relaySupportsTravellers(RELAY_VERSION), true, 'this relay does');
  assert.equal(isRegionRoom(chatRegionRoom(17)), true);
  assert.equal(isRegionRoom(CHAT_WORLD_ROOM), false, 'the world channel is everyone\'s - a mark there would be the whole bay');
  assert.equal(isRegionRoom('chat:region.99'), false, 'a region the politic map does not have');
  assert.equal(isRegionRoom('world:12,13'), false);
});

test('TV3 wire: the cadence and the budgets - the hub\'s cooldown half the client\'s floor, the room\'s fan budget, the staleness past the keepalive', () => {
  assert.equal(TRAV_SEND_MIN_MS, 10_000);
  assert.equal(TRAV_HUB_MIN_MS, TRAV_SEND_MIN_MS / 2, 'AUDIT DROPS C1: a gate at the client\'s own rate drops the honest frame on skew');
  assert.ok(TRAV_STALE_MS > TRAV_KEEPALIVE_MS * 2, 'a standing player refreshed twice before they are stale');
  let g = travHubGate(null, 1000);
  assert.equal(g.pass, true);
  assert.equal(travHubGate(g.at, 1000 + TRAV_HUB_MIN_MS - 1).pass, false);
  assert.equal(travHubGate(g.at, 1000 + TRAV_HUB_MIN_MS).pass, true);
  let b = null, passed = 0;
  for (let i = 0; i < TRAV_ROOM_HZ_MAX * 2; i++) { g = travRoomGate(b, 5000); b = g.bucket; if (g.pass) passed++; }
  assert.equal(passed, TRAV_ROOM_HZ_MAX, 'a second\'s worth, then the room waits');
  assert.equal(TRAV_WELCOME_MAX, 256);
});

// ── THE RELAY ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A plain name the name filter passes, by index: Aa, Ab, ... */
const nameOf = (i) => `Rider ${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`;
async function regionRoom(ids, key = chatRegionRoom(5)) {
  const r = fakeRoom(key);
  const ws = [];
  for (const [i, id] of ids.entries()) { const s = r.connect(); await quiet(() => r.hello(s, id, null, { name: nameOf(i) })); ws.push(s); }
  return { r, ws };
}

test('TV3 relay: a mark in a region\'s channel is KEPT on the attachment (stamped) and fanned to the others with the TOKEN\'s name and account - never the frame\'s; a null takes it out and says so', async () => {
  const { r, ws: [a, b, c] } = await regionRoom(['peer-0001', 'peer-0002', 'peer-0003']);
  for (const s of [a, b, c]) s.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'trav', p: MARK }));
  assert.deepEqual(Object.keys(a.att.tm).sort(), [...TRAV_KEYS, 'at'].sort(), 'kept, stamped');
  for (const s of [b, c]) {
    const t = ofType(s, 'trav');
    assert.equal(t.length, 1);
    assert.equal(t[0].id, 'peer-0001');
    assert.equal(t[0].name, nameOf(0), 'the verified name');
    assert.equal(t[0].sub, 'acct-peer-0001', 'the verified account');
    assert.deepEqual(t[0].p, MARK);
  }
  assert.equal(ofType(a, 'trav').length, 0, 'not my own back');
});

test('TV3 relay: a joiner\'s welcome carries the room\'s FRESH marks, badged; a mark taken out, a stale one and the world channel\'s are not', async () => {
  const realNow = Date.now;
  let t0 = realNow();
  Date.now = () => t0;
  try {
    const { r, ws: [a, b] } = await regionRoom(['peer-0001', 'peer-0002']);
    await r.raw(a, JSON.stringify({ t: 'trav', p: MARK }));
    await r.raw(b, JSON.stringify({ t: 'trav', p: { ...MARK, px: 300 } }));
    const c = r.connect();
    await quiet(() => r.hello(c, 'peer-0003'));
    const tr = ofType(c, 'welcome')[0].tr;
    assert.deepEqual(tr.map((x) => [x.id, x.name, x.p.px]), [['peer-0001', nameOf(0), 207], ['peer-0002', nameOf(1), 300]]);
    assert.deepEqual(Object.keys(tr[0].p).sort(), [...TRAV_KEYS].sort(), 'the mark as sent - the stamp stays the relay\'s');
    t0 += TRAV_HUB_MIN_MS + 1;
    await r.raw(b, JSON.stringify({ t: 'trav', p: null }));
    assert.equal(b.att.tm, undefined, 'taken out');
    assert.deepEqual(ofType(a, 'trav').at(-1), { t: 'trav', id: 'peer-0002', name: nameOf(1), sub: 'acct-peer-0002', p: null }, 'and said');
    t0 += TRAV_STALE_MS + 1;
    const d = r.connect();
    await quiet(() => r.hello(d, 'peer-0004'));
    assert.equal(ofType(d, 'welcome')[0].tr, undefined, 'a mark older than TRAV_STALE_MS is gone, and no field is no traveller');
    // the world channel: junk, kept nowhere, fanned to nobody
    const w = fakeRoom(CHAT_WORLD_ROOM);
    const x = w.connect(), y = w.connect();
    await quiet(() => w.hello(x, 'peer-0005')); await quiet(() => w.hello(y, 'peer-0006'));
    y.sent.length = 0;
    await w.raw(x, JSON.stringify({ t: 'trav', p: MARK }));
    assert.equal(x.att.tm, undefined);
    assert.equal(ofType(y, 'trav').length, 0);
    assert.equal((x.meters.junk ?? 0), 1, 'counted as junk');
  } finally { Date.now = realNow; }
});

test('TV3 relay: a second mark inside the hub\'s cooldown is dropped (and struck) - not kept, not fanned; the room\'s fan budget keeps what it does not fan', async () => {
  const realNow = Date.now;
  let t0 = realNow();
  Date.now = () => t0;
  try {
    const { r, ws: [a, b] } = await regionRoom(['peer-0001', 'peer-0002']);
    b.sent.length = 0;
    await r.raw(a, JSON.stringify({ t: 'trav', p: MARK }));
    t0 += 1000;
    await r.raw(a, JSON.stringify({ t: 'trav', p: { ...MARK, px: 208 } }));
    assert.equal(ofType(b, 'trav').length, 1, 'the second went nowhere');
    assert.equal(a.att.tm.px, 207, 'and was not kept');
    assert.equal(a.meters.travDrops, 1, 'struck');
    // the room's budget: more senders in one instant than it fans
    const many = await regionRoom(Array.from({ length: TRAV_ROOM_HZ_MAX + 4 }, (_, i) => `peer-${String(100 + i).padStart(4, '0')}`), chatRegionRoom(9));
    const ear = many.ws[0];
    ear.sent.length = 0;
    for (const s of many.ws.slice(1)) await many.r.raw(s, JSON.stringify({ t: 'trav', p: MARK }));
    assert.equal(ofType(ear, 'trav').length, TRAV_ROOM_HZ_MAX, 'the room fans its budget');
    assert.ok(many.ws.slice(1).every((s) => s.att.tm), 'and keeps every one - the welcome and the next refresh carry the rest');
    // AUDIT TV C2: ...but a CLEAR is always said - it has no refresh to carry it later (on its own budget since AUDIT DEEP T3-2, and owed past it since AUDIT DEEP2 C2)
    t0 += TRAV_HUB_MIN_MS + 1;
    for (const s of many.ws.slice(2)) await many.r.raw(s, JSON.stringify({ t: 'trav', p: MARK }));   // the budget spent again
    ear.sent.length = 0;
    await many.r.raw(many.ws[1], JSON.stringify({ t: 'trav', p: null }));
    assert.equal(ofType(ear, 'trav').filter((m) => m.p === null).length, 1, 'the clear reached the room with its budget spent');
  } finally { Date.now = realNow; }
});

// ── THE SESSION ─────────────────────────────────────────────────────────────────────────────────────────────────────

function regionLink(relayV = RELAY_VERSION, room = chatRegionRoom(5)) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => t });
  const heard = { one: [], room: [], left: [] };
  s.onTraveller = (f) => heard.one.push(f);
  s.onTravellerRoom = (list) => heard.room.push(list);
  s.onTravellerLeft = (id) => heard.left.push(id);
  quiet(() => s.join(room));
  const ws = sockets[0]; ws.open();
  return { s, ws, heard, out: () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'trav'), tick: (ms) => { t += ms; }, welcome: (extra = {}) => quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: relayV, ...extra })) };
}

test('TV3 session: a mark goes only through a relay that knows it, only in a region\'s channel, never sooner than the floor; a bad one never leaves', () => {
  const old = regionLink('world121');
  old.welcome();
  assert.equal(old.s.travOk, false);
  assert.equal(old.s.sendTraveller(MARK), false, 'world121 would close the socket on it');
  const world = regionLink(RELAY_VERSION, CHAT_WORLD_ROOM);
  world.welcome();
  assert.equal(world.s.sendTraveller(MARK), false, 'not in the world channel');
  const { s, out, tick, welcome } = regionLink();
  welcome();
  assert.equal(s.travOk, true);
  assert.equal(s.sendTraveller({ ...MARK, m: 7 }), false, 'refused at home');
  assert.equal(s.sendTraveller(MARK), true);
  assert.deepEqual(out().at(-1), { t: 'trav', p: MARK });
  tick(TRAV_SEND_MIN_MS - 1);
  assert.equal(s.sendTraveller(MARK), false, 'the floor');
  // AUDIT DEEP X-8: a clear goes AT ONCE - the floor is the marks' own, measured from the last MARK
  assert.equal(s.sendTraveller(null), true, 'a clear inside the floor');
  assert.deepEqual(out().at(-1), { t: 'trav', p: null });
  assert.equal(s.sendTraveller(MARK), false, 'the next mark still waits the floor out');
  tick(1);
  assert.equal(s.sendTraveller(MARK), true, 'from the last mark, not the clear');
});

test('TV3 session: the welcome\'s marks REPLACE the book (none is none), a mark in is gated and never my own, a leave takes one out; the count says alone', () => {
  const { s, ws, heard, welcome } = regionLink();
  welcome({ tr: [{ id: 'peer-0002', name: 'Bran', p: MARK }, { id: 'aaaa-0001', name: 'me', p: MARK }, { id: 'peer-0003', name: 'Cass', p: { ...MARK, m: 9 } }] });
  assert.deepEqual(heard.room.at(-1).map((f) => f.id), ['peer-0002'], 'mine and the bad one left out');
  assert.equal(s.othersHere, 0, 'the roster named nobody');
  quiet(() => ws.receive({ t: 'join', id: 'peer-0002', name: 'Bran' }));
  assert.equal(s.othersHere, 1, 'a join - no longer alone');
  quiet(() => ws.receive({ t: 'trav', id: 'peer-0002', name: 'Bran', p: { ...MARK, px: 208 } }));
  quiet(() => ws.receive({ t: 'trav', id: 'aaaa-0001', name: 'me', p: MARK }));
  assert.deepEqual(heard.one.map((f) => [f.id, f.p.px]), [['peer-0002', 208]], 'mine back is not a traveller');
  for (let i = 0; i < TRAV_ROOM_HZ_MAX * 3; i++) quiet(() => ws.receive({ t: 'trav', id: 'peer-0002', name: 'Bran', p: MARK }));
  // AUDIT DEEP2 C3: the room's rate with TWICE its burst - what the relay spaced and the network bunched passes whole
  assert.ok(heard.one.length >= 2 * TRAV_ROOM_HZ_MAX - 2 && heard.one.length <= 2 * TRAV_ROOM_HZ_MAX, `a bunched room's worth passes - two taken by the marks above (${heard.one.length})`);
  assert.ok(heard.one.length < TRAV_ROOM_HZ_MAX * 3 + 1, 'past the room\'s own budget a dishonest relay\'s marks are dropped');
  assert.ok(s.stats.travellersDropped > 0);
  // AUDIT DEEP T3-1: the budget spent, a CLEAR still comes through - it only takes a mark out
  quiet(() => ws.receive({ t: 'trav', id: 'peer-0002', name: 'Bran', p: null }));
  assert.equal(heard.one.at(-1).p, null, 'the player who went in is taken off at once');
  quiet(() => ws.receive({ t: 'leave', id: 'peer-0002' }));
  assert.deepEqual(heard.left, ['peer-0002', 'peer-0002'], 'AUDIT DEEP T3-3: the join took out whatever an older socket of theirs left; the leave takes out this one');
  welcome();
  assert.deepEqual(heard.room.at(-1), [], 'a welcome without marks empties the book');
});

test('AUDIT DEEP T3-2/T3-6/X-8 relay: a clear takes out a mark that is THERE - one with none is said to nobody, one right after a mark goes past the cooldown unstruck; clears and marks each spend their own budget; a welcome row says its age', async () => {
  const realNow = Date.now;
  let t0 = realNow();
  Date.now = () => t0;
  try {
    const { r, ws: [a, b] } = await regionRoom(['peer-0001', 'peer-0002']);
    b.sent.length = 0;
    await r.raw(a, JSON.stringify({ t: 'trav', p: null }));
    assert.equal(ofType(b, 'trav').length, 0, 'a clear of nothing is said to nobody');
    assert.equal(a.meters.travDrops ?? 0, 0, 'one costs no strike');
    t0 += TRAV_HUB_MIN_MS + 1;   // AUDIT DEEP2 C1: but it spends the cooldown, as a mark does
    await r.raw(a, JSON.stringify({ t: 'trav', p: MARK }));
    t0 += 1000;
    await r.raw(a, JSON.stringify({ t: 'trav', p: null }));
    assert.deepEqual(ofType(b, 'trav').map((m) => m.p === null), [false, true], 'the clear a second after the mark went at once');
    assert.equal(a.att.tm, undefined);
    assert.equal(a.meters.travDrops ?? 0, 0, 'unstruck');
    await r.raw(a, JSON.stringify({ t: 'trav', p: null }));
    assert.equal(ofType(b, 'trav').length, 2, 'a second clear finds nothing to take out');
    // the budgets, apart
    const ids = Array.from({ length: TRAV_ROOM_HZ_MAX + 4 }, (_, i) => `peer-${String(200 + i).padStart(4, '0')}`);
    const many = await regionRoom(ids, chatRegionRoom(11));
    const ear = many.ws[0];
    for (const s of many.ws.slice(1)) await many.r.raw(s, JSON.stringify({ t: 'trav', p: MARK }));
    t0 += TRAV_HUB_MIN_MS + 1;
    ear.sent.length = 0;
    for (const s of many.ws.slice(1)) await many.r.raw(s, JSON.stringify({ t: 'trav', p: null }));
    assert.equal(ofType(ear, 'trav').length, TRAV_ROOM_HZ_MAX, 'a flood of clears is held to its own budget');
    ear.sent.length = 0;
    for (const s of many.ws.slice(1)) await many.r.raw(s, JSON.stringify({ t: 'trav', p: MARK }));
    assert.equal(ofType(ear, 'trav').length, TRAV_ROOM_HZ_MAX, 'and never spent the marks\' - they fan whole in the same instant');
    // T3-6: the welcome's row says how old it is
    t0 += 42_500;
    const c = r.connect();
    await quiet(() => r.hello(c, 'peer-0009'));
    assert.equal(ofType(c, 'welcome')[0].tr, undefined, 'a cleared mark is in no welcome');
    await r.raw(b, JSON.stringify({ t: 'trav', p: MARK }));
    t0 += 42_500;
    const d = r.connect();
    await quiet(() => r.hello(d, 'peer-0010'));
    assert.deepEqual(ofType(d, 'welcome')[0].tr.map((x) => [x.id, x.ag]), [['peer-0002', 42]], 'whole seconds since it was sent');
    // AUDIT DEEP2 C1: clears of nothing, as fast as a socket can send them, padded to the frame's limit - metered and
    // struck as marks are, and the socket closed; unmetered they were parsed forever at no cost to the sender
    const e = r.connect();
    await quiet(() => r.hello(e, 'peer-0011'));
    const pad = 'x'.repeat(8000);
    for (let i = 0; i < DROP_STRIKES_MAX + 10 && !e.closed; i++) await quiet(() => r.raw(e, JSON.stringify({ t: 'trav', p: null, z: pad })));
    assert.equal(e.closed?.reason, 'too many traveller marks', `the flood is struck out (${JSON.stringify(e.closed)})`);
  } finally { Date.now = realNow; }
});

test('AUDIT DEEP2 C2 relay: a clear over the room\'s budget is OWED, not lost - said on the room\'s next traveller frame; a new mark or a leave makes it moot', async () => {
  const realNow = Date.now;
  let t0 = realNow();
  Date.now = () => t0;
  try {
    const ids = Array.from({ length: TRAV_ROOM_HZ_MAX + 11 }, (_, i) => `peer-${String(300 + i).padStart(4, '0')}`);
    const { r, ws } = await regionRoom(ids, chatRegionRoom(12));
    const [ear, ...rest] = ws;
    for (const s of rest) await r.raw(s, JSON.stringify({ t: 'trav', p: MARK }));
    t0 += TRAV_HUB_MIN_MS + 1;
    ear.sent.length = 0;
    for (const s of rest) await r.raw(s, JSON.stringify({ t: 'trav', p: null }));   // thirty clears in one instant
    const heard = () => new Set(ofType(ear, 'trav').filter((m) => m.p === null).map((m) => m.id));
    assert.equal(heard().size, TRAV_ROOM_HZ_MAX, 'the budget\'s worth said at once');
    const owed = rest.map((s) => s.att.id).filter((id) => !heard().has(id));
    assert.equal(owed.length, 10);
    // in the same instant (the clears' budget still spent) one owed player steps out again - a new mark: their owed
    // clear is moot, never said after it; another leaves - the leave says it
    const back = rest.find((s) => s.att.id === owed[0]);
    await r.raw(back, JSON.stringify({ t: 'trav', p: MARK }));
    const gone = rest.find((s) => s.att.id === owed[1]);
    await quiet(() => r.drop(gone));
    t0 += 1000;   // the budget back: the room's next traveller frame pays what is owed
    await r.raw(rest.find((s) => s.att.id === heard().values().next().value), JSON.stringify({ t: 'trav', p: MARK }));
    const said = heard();
    for (const id of owed.slice(2)) assert.ok(said.has(id), `${id}'s clear said on the next frames`);
    assert.equal(ofType(ear, 'trav').findLast((m) => m.id === owed[0])?.p === null, false, 'the one who marked again stands where they are - their old clear never said after the mark');
    assert.equal(ofType(ear, 'trav').filter((m) => m.id === owed[1]).length, 0, 'the one who left: the leave said it, no clear after');
  } finally { Date.now = realNow; }
});

test('AUDIT DEEP T3-5/T3-6 session: a fresh socket knows nothing of its relay until ITS welcome (a rollback closes on a mark); a welcome row is aged as old as it says, and no older than the stale limit', () => {
  const { s, ws, heard, welcome } = regionLink();
  welcome();
  assert.equal(s.travOk, true);
  ws.open();   // the same socket's handlers on a fresh open - a reconnect
  assert.equal(s.travOk, false, 'reset on the open');
  assert.equal(s.sendTraveller(MARK), false, 'no mark before the welcome says the relay knows it');
  welcome({ tr: [{ id: 'peer-0002', name: 'Bran', p: MARK, ag: 120 }, { id: 'peer-0003', name: 'Cass', p: MARK, ag: 1e9 }, { id: 'peer-0004', name: 'Dai', p: MARK }] });
  assert.equal(s.travOk, true);
  const list = heard.room.at(-1);
  assert.deepEqual(list.map((f) => [f.id, f.ag]), [['peer-0002', 120], ['peer-0003', TRAV_STALE_MS / 1000], ['peer-0004', 0]], 'as said, clamped, and none is fresh (an older relay)');
  const book = createTravellerBook();
  book.reset(list, 1_000_000);
  assert.deepEqual(book.live(1_000_000 + TRAV_STALE_MS - 120_000 + 1).map((m) => m.id), ['peer-0004'], 'the two-minute-old mark goes stale two minutes sooner; the one at the limit is already gone');
});

// ── THE CLIENT'S LAW ────────────────────────────────────────────────────────────────────────────────────────────────

test('TV3 law: the mark of me is the pixel worldCoordToMapPixel names and a 256th within it, the heading a 256th of a turn; back again it lands within that 256th', () => {
  const x = 207 * 32768 + 20000, z = (499 - 213) * 32768 + 31000;
  const m = travellerMarkOf({ x, z, yaw: Math.PI / 2, mode: 'Horse', journey: true });
  assert.deepEqual(m, { px: 207, py: 213, fx: Math.floor(20000 / TRAV_FRACTION), fy: Math.floor(31000 / TRAV_FRACTION), h: 64, m: 1, tv: 1 });
  const w = travellerWorldOf(m);
  assert.ok(Math.abs(w.x - x) <= TRAV_FRACTION && Math.abs(w.z - z) <= TRAV_FRACTION, 'within a 256th (3.2 m)');
  assert.equal(headingByte(0), 0); assert.equal(headingByte(-Math.PI / 2), 192); assert.equal(headingByte(2 * Math.PI), 0);
  assert.ok(Math.abs(yawOfHeading(64) - Math.PI / 2) < 1e-12);
  assert.equal(travelModeIndex('Ship'), 3); assert.equal(travelModeIndex('Foot'), 0); assert.equal(travelModeIndex('Balloon'), 0);
  assert.deepEqual(validTravellerMark(travellerMarkOf({ x: -5, z: 1e12 })), travellerMarkOf({ x: -5, z: 1e12 }), 'clamped onto the map: always a valid mark');
});

test('TV3 law: WHEN TO SEND - the first, a pixel crossed, a new way or journey, a refresh when it is due; nothing while ALONE; a clear once, when I go in or hide', () => {
  const st = { last: null, at: 0 };
  const q = (over = {}) => ({ now: 1000, mark: MARK, alone: false, shown: true, ...over });
  assert.equal(travellerDue(st, q()), 'send', 'the first');
  assert.equal(travellerDue(st, q({ alone: true })), null, 'alone in the region: nobody to see it - the region\'s object sleeps');
  const sent = { last: MARK, at: 1000 };
  assert.equal(travellerDue(sent, q()), null, 'the same pixel, the same way: nothing');
  assert.equal(travellerDue(sent, q({ mark: { ...MARK, fx: 99 } })), null, 'a step inside the pixel is not worth a frame');
  assert.equal(travellerDue(sent, q({ mark: { ...MARK, px: 208 } })), 'send', 'a pixel crossed');
  assert.equal(travellerDue(sent, q({ mark: { ...MARK, m: 0 } })), 'send', 'off the horse');
  assert.equal(travellerDue(sent, q({ mark: { ...MARK, tv: 0 } })), 'send', 'the journey over');
  assert.equal(travellerDue(sent, q({ now: 1000 + TRAV_KEEPALIVE_MS })), 'send', 'the refresh');
  assert.equal(travellerDue(sent, q({ shown: false })), 'clear', 'indoors, or the switch off');
  assert.equal(travellerDue(sent, q({ mark: null })), 'clear');
  assert.equal(travellerDue(st, q({ shown: false })), null, 'nothing held: nothing to clear');
  assert.equal(travellerDue(sent, q({ shown: false, alone: true })), 'clear', 'a clear goes even alone - the room holds my mark for the next joiner');
});

test('TV3 law: the book - put, a null takes out, a leave drops, a welcome replaces, and a mark unheard for TRAV_STALE_MS is pruned', () => {
  const book = createTravellerBook();
  book.put({ id: 'peer-0002', name: 'Bran', p: MARK }, 0);
  book.put({ id: 'peer-0003', name: 'Cass', p: MARK }, 0);
  assert.equal(book.live(1).length, 2);
  book.put({ id: 'peer-0003', p: null }, 1);
  assert.deepEqual(book.live(1).map((t) => t.id), ['peer-0002']);
  book.put({ id: 'peer-0004', name: 'Dov', p: MARK }, TRAV_STALE_MS);
  assert.deepEqual(book.live(TRAV_STALE_MS + 1).map((t) => t.id), ['peer-0004'], 'Bran unheard too long');
  book.drop('peer-0004');
  assert.equal(book.size, 0);
  book.reset([{ id: 'peer-0005', name: 'E', p: MARK }, { id: 'peer-0006', p: null }], 5);
  assert.deepEqual(book.live(5).map((t) => t.id), ['peer-0005']);
});

// ── THE READOUTS ────────────────────────────────────────────────────────────────────────────────────────────────────

test('TV3 view: a traveller off the picture is held at its edge, pointing their way; one behind the eye points the way round; one on the picture stands where it is', () => {
  const W = 1000, H = 600, M = TV_EDGE_MARGIN;
  assert.equal(edgeHold({ x: 500, y: 300, front: true }, W, H), null, 'on the picture');
  const right = edgeHold({ x: 3000, y: 300, front: true }, W, H);
  assert.deepEqual([Math.round(right.x), Math.round(right.y), Math.round(right.angle)], [W - M, 300, 90]);
  const up = edgeHold({ x: 500, y: -900, front: true }, W, H);
  assert.deepEqual([Math.round(up.x), Math.round(up.y), Math.round(up.angle)], [500, M, 0]);
  const behind = edgeHold({ x: 700, y: 300, front: false }, W, H);
  assert.ok(behind.x < 500, 'the mirror turned round: to the left');
  assert.equal(Math.round(behind.angle), -90);
  const dead = edgeHold({ x: 500, y: 300, front: false }, W, H);
  assert.equal(Math.round(dead.y), H - M, 'straight behind: below');
  assert.equal(edgeHold(null, W, H), null);
});

test('AUDIT DEEP T1-1: through the host\'s REAL lens (mirrored, 52 degrees down), a traveller behind the eye is held at the edge on THEIR side - left behind left, right behind right, straight behind at the bottom - never all in one corner', () => {
  const W = 1280, H = 720;
  const proj = mirrorProjectionX(perspective((65 * Math.PI) / 180, W / H, 0.2, 6000));
  const eye = [0, 260, -203], fwd = forwardOf(0, -TV_TILT_DEFAULT);
  const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
  const at = (p) => projectToScreen(p, W, H, proj, view, null, true);
  const held = (p) => edgeHold(at(p), W, H);
  // the same lateral offsets, ahead (on the picture) and 2 km behind
  const aheadL = at([-60, 0, 150]), aheadR = at([60, 0, 150]);
  assert.ok(aheadL.front && aheadR.front && Math.sign(aheadL.x - W / 2) === -Math.sign(aheadR.x - W / 2), 'ahead: the two sides of the picture');
  const bl = held([-800, 0, -2000]), br = held([800, 0, -2000]), bb = held([0, 0, -2000]);
  assert.equal(at([-800, 0, -2000]).front, false, 'behind the eye');
  assert.equal(Math.sign(bl.x - W / 2), Math.sign(aheadL.x - W / 2), 'behind-left is held on the left');
  assert.equal(Math.sign(br.x - W / 2), Math.sign(aheadR.x - W / 2), 'behind-right on the right');
  assert.ok(bl.y > H / 2 && br.y > H / 2 && bb.y > H / 2, 'all in the lower half - the ground behind');
  assert.ok(Math.abs(bb.x - W / 2) < 2, `straight behind: the bottom's middle (${bb.x.toFixed(1)})`);
  assert.ok(Math.abs(bl.angle) > 90 && Math.abs(br.angle) > 90 && Math.sign(bl.angle) !== Math.sign(br.angle), 'the arrows point down, each its own way');
  // AUDIT DEEP T3-9: the held map rings my party as theirs - a party member is never drawn a second time as a stranger
  assert.match(rd('src/scenes/world.js'), /travellers: \(\) => travellerBook\.live\(Date\.now\(\)\)\.filter\(\(t\) => !social\?\.inMyParty\(social\.accountOfPeer\(t\.id\)\)\)\.map\(/);
  // AUDIT DEEP T3-4/T3-7: the switch says what it shares, and with whom, truly
  assert.match(rd('src/ui/enhancedMenu.js'), /players in your region see you on the overworld and the map/);
  assert.match(rd('src/ui/enhancedMenu.js'), /Kept on this device\./);
  assert.match(rd('src/scenes/world.js'), /project: \(p\) => \(_lastProj && _lastView \? projectToScreen\(p, canvas\.clientWidth, canvas\.clientHeight, _lastProj, _lastView, worldViewportRect\(canvas\.clientWidth, canvas\.clientHeight\), true\) : null\),/, 'the view\'s own projection asks for the mirror');
  // the default stays the hide: every other caller never draws a mirror
  assert.deepEqual(projectToScreen([0, 0, -2000], W, H, proj, view), { x: 0, y: 0, depth: 0, front: false });
});

test('TV3 map: the travellers are marks placed to their 256th (the fraction turned round - y counts south), keyed on what moves them; painted under the party, a stranger\'s smaller ring', () => {
  const rows = [{ id: 'peer-0002', name: 'Bran', ...MARK }, { id: 'bad', px: 1000, py: 3 }, { name: 'no id', px: 1, py: 1 }];
  const marks = readTravellerMarks(() => rows);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].x, 207 + 12.5 / 256);
  assert.equal(marks[0].y, 213 + 1 - 250.5 / 256, 'north within the pixel is up the sheet');
  assert.equal(marks[0].journey, true);
  assert.deepEqual(readTravellerMarks(null), []);
  assert.notEqual(travellerMarksKey(marks), travellerMarksKey(readTravellerMarks(() => [{ ...rows[0], fx: 13 }])), 'a step moves the key');
  assert.equal(TRAVELLER_LEGEND_TEXT, 'Traveller');
  const calls = [];
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => calls.push([k, ...a])), set: (o, k, v) => { o[k] = v; calls.push([`=${String(k)}`, v]); return true; } });
  paintInkOverlay(ctx, { ox: 0, oy: 0, scale: 4 }, { paperW: 4000, paperH: 2000, travellers: [{ x: 207.05, y: 213.02, name: 'Bran', color: TRAVELLER_MARK_CSS, journey: true }], party: [{ x: 207.5, y: 213.5, name: 'Friend', color: '#0f0' }] });
  const texts = calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  assert.deepEqual(texts, ['Bran →', 'Friend'], 'the traveller first, so the party reads over them; a journey arrowed');
  const arcs = calls.filter((c) => c[0] === 'arc').map((c) => c[3]);
  assert.ok(arcs[0] < arcs[1], 'a stranger\'s ring smaller than a friend\'s');
});

// ── THE SWITCH AND THE HOST ─────────────────────────────────────────────────────────────────────────────────────────

test('TV3 switch: "Show me to travellers in my region" - on by default, the player\'s own say online, on the Other players card', () => {
  assert.equal(PREF_DEFAULTS.showToTravellers, true);
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes('showToTravellers'), 'the room never forces it');
  assert.match(rd('src/ui/enhancedMenu.js'), /prefRow\('showToTravellers', 'Show me to travellers in my region',/);
});

test('TV3 host wiring: the book hoisted above its readers, filled by the Region tab\'s own link; my mark sent when due, on that link, from the open air alone and with the switch on; the view and the map draw the book', () => {
  const w = rd('src/scenes/world.js');
  assert.ok(((i, j) => i >= 0 && j >= 0 && i < j)(w.indexOf('const travellerBook = createTravellerBook();'), w.indexOf('travellers: () => travellerBook.live(Date.now())')), 'BOOT-TDZ: above the map that reads it');
  assert.match(w, /if \(tab\.id === 'region'\) \{   \/\/ TV3[^\n]*\n\s*link\.onTraveller = \(f\) => travellerBook\.put\(f, Date\.now\(\)\);/);
  // AUDIT TV C1: a welcome is a fresh socket - the room holds nothing of mine, so the next frame sends my mark again
  assert.match(w, /link\.onTravellerRoom = \(list\) => \{ travellerBook\.reset\(list, Date\.now\(\)\); travellerSent\.last = null; travellerSent\.at = 0; \};/);
  assert.match(w, /link\.onTravellerLeft = \(id\) => travellerBook\.drop\(id\);/);
  // AUDIT TV C5: offline (another tab has the seat), nobody is seen travelling
  assert.match(w, /for \(const link of chatLinks\?\.values\?\.\(\) \?\? \[\]\) link\.supersede\(\);\n(?:\s*\/\/[^\n]*\n)*\s*try \{ arenaOnline\?\.leaveAll\(\); \}[^\n]*\n\s*travellerBook\.clear\(\); travellerSent\.last = null;/);
  assert.match(w, /chatRegionFrame\(performance\.now\(\)\);[^\n]*\n\s*travellerFrame\(performance\.now\(\)\);/, 'after the region link has moved');
  assert.match(w, /if \(link\.room !== travellerSent\.room\) \{ travellerSent\.room = link\.room; travellerSent\.last = null; travellerSent\.at = 0;/, 'a new room holds nothing of mine');
  assert.match(w, /const outdoors = \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && walkMode && playerSpawned && \(playerEntity\.health \?\? 0\) > 0;/, 'nothing from indoors');
  assert.match(w, /const shown = outdoors && isEnhanced\(\) && getPref\('showToTravellers'\) !== false && link\.room === chatRegionRoom\(_questRegionIndex\(\)\)( && !concealBits\(playerEntity\))?;/, 'AUDIT TV C4: never into the region just left');
  assert.match(w, /travellerDue\(travellerSent, \{ now, mark, alone: link\.othersHere === 0, shown \}\)/);
  assert.match(w, /if \(near\.has\(t\.id\) \|\| Math\.max\(Math\.abs\(t\.p\.px - me\.x\), Math\.abs\(t\.p\.py - me\.y\)\) <= TV_BODY_RANGE\) continue;/, 'inside the pose range a traveller is their body - marked as a player drawn here (OVERWORLD NAMES), never twice');
  assert.match(w, /const kind = social\?\.isPartyPeer\(t\.id\) \? 'party' : 'traveller';/, 'AUDIT TV C3: the peer\'s id asked of the party\'s seats; AUDIT NAMES N1-10: as play\'s names ask it');
  assert.match(w, /marks\.push\(\{ key: `trav:\$\{t\.id\}`, at: tvSceneKept\(t, w\.x, w\.z, 2, ship\), label: t\.name, kind: `\$\{kind\}\$\{ship \? ' ship' : ''\}\$\{t\.p\.tv \? ' journey' : ''\}`, edge: true, badge: tvBadgeOf\(t\) \}\);/);   // OWS1: at sea, a ship
  assert.match(w, /return \[x, ringHeight\(byte\) \+ state\.pixelTranslation\(px\.x, px\.y\)\[1\] \+ lift, z\];/, 'past the grid, the far ring\'s own height');
  assert.match(rd('src/ui/heldMap.js'), /travellers: this\._trav\.map\(\(t\) => \(\{ x: t\.x, y: t\.y, name: t\.name, color: TRAVELLER_MARK_CSS, journey: t\.journey, ship: t\.ship \}\)\),/);   // OWS1
  // the relay: one arm, the region's channel alone, the attachment, the room's budget, the welcome
  const idx = rd('server/src/index.js');
  assert.match(idx, /if \(m\.t === 'trav'\) \{/);
  assert.match(idx, /if \(!isRegionRoom\(a\.key\)\) \{ this\._junk\(ws\); return; \}\n(\s*\/\/[^\n]*\n)*\s*if \(this\._travOwed\.size\) this\._payTravOwed\(now\);[^\n]*\n(\s*\/\/[^\n]*\n)*\s*if \(m\.p \|\| !a\.tm\) \{ a = this\._meterTrav\(ws, a, now\); if \(!a\) return; \}\n\s*if \(!m\.p && !a\.tm\) return;/);
  assert.match(idx, /const tr = isRegionRoom\(a\.key\) \? others\.filter\(\(b\) => b\.tm && now - b\.tm\.at <= TRAV_STALE_MS\)\.slice\(0, TRAV_WELCOME_MAX\)/);
});

test('AUDIT DEEP2 C4/C5 by source: a Region link that moves empties the book (the old room\'s leaves can no longer reach it); the switch says what stays unshared - the region\'s channel, not the party\'s pose', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /if \(link\.room !== travellerSent\.room\) \{ travellerSent\.room = link\.room; travellerSent\.last = null; travellerSent\.at = 0; travellerBook\.clear\(\); \}/);
  const menu = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(menu, /Nothing is shared from indoors except with your party\./);
  assert.doesNotMatch(menu, /'Nothing is shared from indoors\./);
});

test('AUDIT DEEP2 C by source: a welcome never hands a joiner a socket already closing (ONE-SEAT R4\'s rule, as the other tabs are counted)', () => {
  const srv = readFileSync(new URL('../server/src/index.js', import.meta.url), 'utf8');
  assert.match(srv, /for \(const \[other, b\] of this\._all\(\)\) if \(other !== ws && b\.id && !this\._dead\.has\(other\) && !this\._gone\.has\(other\)\) others\.push\(b\);/);
});

test('OVERWORLD NAMES wire, book and host: a traveller frame keeps the Renown and the guild\'s tag the relay stamps (a bad one refused as nothing); the book keeps the whole badge; every player drawn here is marked with it, the veiled never, and the names over the heads stand down under the view', () => {
  const f = validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', p: MARK, title: 'founder', glyphs: ['dev'], lv: 12, gt: 'HND' });
  assert.deepEqual([f.title, f.glyphs, f.lv, f.gt], ['founder', ['dev'], 12, 'HND']);
  const bad = validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', p: MARK, lv: 1e9, gt: '<script>' });
  assert.deepEqual([bad.lv, bad.gt], [null, null], 'a level past the bound and a tag no guild wears: nothing');
  const book = createTravellerBook();
  book.put(f, 1000);
  const t = book.live(1000)[0];
  assert.deepEqual([t.title, t.glyphs, t.lv, t.gt], ['founder', ['dev'], 12, 'HND']);
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /for \(const d of online\?\.drawable\?\.\(\) \?\? \[\]\) \{\n\s*if \(!d\?\.shown \|\| _hiddenPeers\.has\(d\.id\) \|\| _veils\.has\(d\.id\)\) continue;/, 'the concealed and the veiled are never marked');
  assert.match(w, /marks\.push\(\{ key: `peer:\$\{d\.id\}`, at: \[f\[0\], f\[1\] \+ h, f\[2\]\], label: d\.name \?\? '', kind: `\$\{party \? 'party' : 'traveller'\}\$\{isShipMark\(t\?\.p\) \? ' ship' : ''\}\$\{t\?\.p\.tv \? ' journey' : ''\}`, edge: party \|\| !!t, badge: tvBadgeOf\(d\) \}\);/);   // OWS1: at sea, a ship
  assert.match(w, /const tvBadgeOf = \(p\) => \(\{ title: p\.title \?\? null, glyphs: Array\.isArray\(p\.glyphs\) \? p\.glyphs : \[\], lv: p\.lv \?\? null, gt: p\.gt \?\? null, rb: p\.rb \?\? null \}\);/);   // AUDIT-SEATS (PIN MOVED): and a Season's banner ribbon
  assert.match(w, /const namesOff = covered \|\| !!travelView\?\.active;/);
  assert.match(w, /remotePlayers\.nameFrame\(\{\n\s*proj, view, eye, toScene: onlineToScene, covered: namesOff,/);
});

test('AUDIT NAMES: the badge reaches the readout through the view\'s own drawHud (N2-1); the switch holds - one who shares nothing is named only as close as play names them, never held at the edge (N2-2); the concealed share nothing with the region (N2-3); a journey keeps its arrow within the pose range', () => {
  // N2-1: THE REAL VIEW - drawHud rebuilt each mark field by field and left the badge behind (every marker a bare name)
  let seen = null;
  const tv = createTravelView({
    canvas: {}, win: { addEventListener() {}, removeEventListener() {} },
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0, 0) }),
    yaw: () => 0, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: () => [],
    project: (p) => ({ x: 100 + p[0], y: 100 - p[2], front: true }),
    marks: () => [{ key: 'peer:abc', at: [5, 2, 5], label: 'Bran', kind: 'party journey', edge: true, badge: { title: 'founder', glyphs: ['dev'], lv: 12, gt: 'HND' } }],
    hud: { show() {}, hide() {}, update: (f) => { seen = f; } },
    schedule: () => null, cancel: () => {},
  });
  tv.enter();
  for (let i = 0; i < 90; i++) tv.frame(TV_RISE_S / 60);
  tv.drawHud();
  assert.deepEqual(seen.marks[0].badge, { title: 'founder', glyphs: ['dev'], lv: 12, gt: 'HND' }, 'the badge rides to the readout');
  assert.equal(seen.marks[0].kind, 'party journey');
  // N2-2 / the journey (world.js, by source): the region's marks read once, by id; a stranger who shares nothing is
  // named only within NAME_RANGE of where I stand, and held at the edge only when of my party or sharing
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /import \{ RemotePlayers, composeLook, createSightCache, NAME_RANGE \} from '\.\.\/net\/remotePlayers\.js';/);
  assert.match(w, /const book = travellerBook\.live\(Date\.now\(\)\);\n\s*const sharing = new Map\(\);[^\n]*\n\s*for \(const t of book\) sharing\.set\(t\.id, t\);/);
  assert.match(w, /const party = !!social\?\.isPartyPeer\(d\.id\), t = sharing\.get\(d\.id\);\n\s*if \(!party && !t && Math\.hypot\(f\[0\] - player\.pos\[0\], f\[2\] - player\.pos\[2\]\) > NAME_RANGE\) continue;/);
  assert.match(w, /for \(const t of book\) \{\n\s*if \(near\.has\(t\.id\)/, 'the region\'s loop reads the same book');
  // N2-3: the switch's gate reads my concealment - the clear goes the frame it takes
  assert.match(w, /const shown = outdoors && isEnhanced\(\) && getPref\('showToTravellers'\) !== false && link\.room === chatRegionRoom\(_questRegionIndex\(\)\) && !concealBits\(playerEntity\);/);
  assert.equal(travellerDue({ last: { px: 1, py: 1, m: 0, tv: 0 }, at: 0 }, { now: 1, mark: null, alone: false, shown: false }), 'clear', 'concealed: the mark the relay holds is taken out');
});
