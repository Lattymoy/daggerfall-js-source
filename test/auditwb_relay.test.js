// AUDIT WB (2026-09-25, Mac: "A proper audit on everything"): THE RELAY'S HALF, pinned over the real Room and its fake
// sockets - a room filled with silence (A1), a court held by one account's many sockets (A1), a fight full of seats left
// idle (A1), a write a frame from `in` said again (A3), a kill said before it was kept and a hub told once or never
// (A10), a receipt only a hub hello at the right moment ever saw (A4), a late joiner's burst (A8), and a day's gate times
// made again every frame (C7, net/gateLaw.js - the relay's bundle). Design: bible/11-Multiplayer/World-Bosses.md
// section 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFight, joinFight, freeSeat, applyHit, BUCKET_DEPTH_X, dpsRef, GATE_FIGHTERS_MAX, COURT_CENTRE, BRAIN_TICK_MS, HIT_KINDS } from '../src/net/gateBrain.js';
import { readReceipt } from '../src/net/gateReceipt.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import { SOCKETS_MAX, HELLO_WAIT_MS, CLOSE_BUSY, CLOSE_REPLACED, GATE_TELL_RETRY_MS, gateReceiptKey, SOCIAL_ROOM } from '../src/net/wire.js';
import { fakeRoom, fakeRooms } from './fakeRoom.mjs';

const DAY = 200;
const TT = gateTimes(DAY);
const KEY = gateRoomKey(DAY);
const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));
async function withGate(fn, { start = TT.openAt + 1000 } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const r = world.room(KEY);
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
  try { await fn({ world, r, tick, say, now: () => clock, set: (t) => { clock = t; } }); } finally { Date.now = realNow; }
}
const upgrade = (path) => new Request(`https://relay.test${path}`, { headers: { Upgrade: 'websocket' } });

test('AUDIT WB A1 a seat is a hello\'s: a room full of sockets silent past HELLO_WAIT_MS gives their seats back (closed busy, so a real client retries), a young silent socket and every hello\'d one keep theirs', async () => {
  let pairs = 0;
  const hadPair = globalThis.WebSocketPair;
  let stamped = null;
  globalThis.WebSocketPair = class { constructor() { pairs++; this[0] = {}; this[1] = { serializeAttachment(a) { stamped = a; } }; } };
  const realNow = Date.now; const now = realNow(); Date.now = () => now;
  try {
    const place = fakeRoom('town:m9');
    const talker = place.connect(); talker.att.at = now - HELLO_WAIT_MS * 3; await place.hello(talker, 'peer-0001');   // long open, and hello'd
    const silent = [];
    for (let i = 1; i < SOCKETS_MAX; i++) { const ws = place.connect(); ws.att.at = now - HELLO_WAIT_MS - (i % 2 ? 0 : -5000); silent.push(ws); }
    // half of them opened HELLO_WAIT_MS ago exactly, half a moment ago
    const r = await place.room.fetch(upgrade('/room/town:m9')).then((x) => x.status, (e) => e);
    assert.notEqual(r, 503, 'not full once the silent seats are given back');
    assert.equal(pairs, 1);
    assert.equal(stamped?.at, now, 'the new socket stamped as it opens');
    const old = silent.filter((_, k) => (k + 1) % 2);
    assert.ok(old.length > 0 && old.every((ws) => ws.closed?.code === CLOSE_BUSY), 'the silent at the wait closed busy');
    assert.ok(silent.filter((_, k) => !((k + 1) % 2)).every((ws) => !ws.closed), 'a young silent socket keeps its seat');
    assert.equal(talker.closed, null, 'a hello\'d socket is never unseated, however long open');
    // a room full of hellos, and of young silence, is full
    const busy = fakeRoom('town:m8');
    for (let i = 0; i < SOCKETS_MAX; i++) { const ws = busy.connect(); ws.att.at = now - HELLO_WAIT_MS + 1; }
    assert.equal((await busy.room.fetch(upgrade('/room/town:m8'))).status, 503);
    assert.ok(busy.sockets.every((ws) => !ws.closed));
    // a socket from before the stamp (awake across a deploy) counts from now, not from nothing
    const older = fakeRoom('town:m7');
    for (let i = 0; i < SOCKETS_MAX; i++) older.connect();
    assert.equal((await older.room.fetch(upgrade('/room/town:m7'))).status, 503);
    assert.ok(older.sockets.every((ws) => ws.att.at === now), 'stamped now');
  } finally { globalThis.WebSocketPair = hadPair; Date.now = realNow; }
  assert.equal(HELLO_WAIT_MS, 10_000);
});

test('AUDIT WB A1 one seat an account in a gate\'s court: a second socket of the same account replaces the first, its leave said; another account, and any room but a court, keep both', async () => {
  await withGate(async ({ r }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3), { tokenSub: 'acct-x' });
    const b = r.connect(); await r.hello(b, 'peer-0002', at(0, 3), { tokenSub: 'acct-x' });
    assert.equal(b.sent[0].t, 'welcome');
    assert.equal(a.closed?.code, CLOSE_REPLACED, 'the older seat goes');
    const c = r.connect(); await r.hello(c, 'peer-0003', at(0, 3), { tokenSub: 'acct-y' });
    assert.equal(b.closed, null, 'another account keeps its own');
    assert.ok(c.sent.some((m) => m.t === 'welcome'));
  });
  const town = fakeRoom('town:m9');
  const a = town.connect(); await town.hello(a, 'peer-0001', null, { tokenSub: 'acct-x' });
  const b = town.connect(); await town.hello(b, 'peer-0002', null, { tokenSub: 'acct-x' });
  assert.equal(a.closed, null, 'two tabs of one account in a place are two players');
});

test('AUDIT WB A1 a full fight frees a seat left idle - never one present, never one who struck or stood - and the boss\'s health keeps its fraction', () => {
  const f = newFight(7, 0, 10_000_000, 'ruhn');
  for (let i = 0; i < GATE_FIGHTERS_MAX; i++) assert.ok(joinFight(f, `s${i}`, `P${i}`, 10, 0, true));
  f.hp = f.max * 0.5;
  f.players.s0.dealt = 5; f.players.s1.stoodMs = 1000;
  const everyone = new Set(Object.keys(f.players));
  assert.equal(joinFight(f, 'late', 'L', 10, 0, true, everyone), false, 'all present: full');
  assert.equal(joinFight(f, 'late', 'L', 10, 0, true), false, 'no word of who is present: nothing freed');
  const present = new Set(everyone); present.delete('s0'); present.delete('s1'); present.delete('s3');   // s2 idle but here
  f.target = 's3';
  const frac = f.hp / f.max;
  assert.ok(joinFight(f, 'late', 'L', 10, 0, true, present));
  assert.equal(f.players.s3, undefined, 'the idle, absent seat freed');
  assert.ok(f.players.s2, 'an idle one present keeps theirs');
  assert.ok(f.players.s0 && f.players.s1, 'a striker and a stander keep theirs, absent or not');
  assert.equal(f.target, null);
  assert.ok(Math.abs(f.hp / f.max - frac) < 1e-9, 'the fraction he stood at');
  assert.equal(Object.keys(f.players).length, GATE_FIGHTERS_MAX);
  assert.equal(freeSeat(f, new Set()), true);
  assert.equal(freeSeat({ players: {}, threat: {}, max: 0, hp: 0 }, new Set()), false);
});

test('AUDIT WB A1 the court tells the fight who is in it: a newcomer to a full fight takes the seat of one gone, never of one here', async () => {
  await withGate(async ({ r, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    await say(a, { k: 'in', lv: 10 });
    const f = r.room._fight;
    for (let i = 0; f && Object.keys(f.players).length < GATE_FIGHTERS_MAX; i++) joinFight(f, `gone-${i}`, 'G', 10, 0, true);
    assert.equal(Object.keys(f.players)[0], 'acct-peer-0001', 'the one here is the first seat - idle, as a fresh fighter is');
    const b = r.connect(); await r.hello(b, 'peer-0002', at(0, 3));
    await say(b, { k: 'in', lv: 10 });
    assert.equal(gates(b, 'no').length, 0, 'admitted - the court is not full of the gone');
    assert.ok(f.players['acct-peer-0001'], 'the one here kept');
    assert.ok(f.players['acct-peer-0002']);
    assert.equal(f.players['gone-0'], undefined, 'one gone freed');
  });
});

test('AUDIT WB A8 a newcomer to a fight already bled comes with an empty bucket - no string of late joiners each spending a full one at once', () => {
  const f = newFight(7, 0, 10_000_000, 'ruhn');
  joinFight(f, 'a', 'A', 10, 0, true);
  joinFight(f, 'b', 'B', 10, 0, true);
  assert.equal(f.players.b.bucket, BUCKET_DEPTH_X * dpsRef(10), 'before a blow, a full bucket');
  f.hp -= 1;
  joinFight(f, 'c', 'C', 10, 1000, true);
  assert.equal(f.players.c.bucket, 0);
  // and it fills at its own rate from then: a blow the moment it arrives deals nothing
  f.pos = [0, 0];
  assert.equal(applyHit(f, 'c', 50, HIT_KINDS.Spell, { x: 3, z: 3 }, 1000), 0);
  assert.ok(applyHit(f, 'c', 50, HIT_KINDS.Spell, { x: 3, z: 3 }, 3000) > 0, 'two seconds on, it deals');
});

test('AUDIT WB A3 an `in` said again (every welcome says one) writes nothing; a newcomer\'s is kept at once', async () => {
  await withGate(async ({ r, say }) => {
    let writes = 0;
    const put = r.state.storage.put.bind(r.state.storage);
    r.state.storage.put = async (k, v) => { if (k === 'gatefight') writes++; return put(k, v); };
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    await say(a, { k: 'in', lv: 10 });
    assert.equal(writes, 1, 'the newcomer kept');
    for (let i = 0; i < 5; i++) await say(a, { k: 'in', lv: 10 });
    assert.equal(writes, 1, 'the same fighter again: nothing to keep');
    const b = r.connect(); await r.hello(b, 'peer-0002', at(0, 3));
    await say(b, { k: 'in', lv: 10 });
    assert.equal(writes, 2);
  });
});

test('AUDIT WB A10 the kill is kept before it is said, and the hub is told until it answers - a beat tells it again, and it is told once', async () => {
  await withGate(async ({ world, r, tick, say, now }) => {
    const hub = world.room(SOCIAL_ROOM);
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    await say(a, { k: 'in', lv: 10 });
    await tick(2);
    // the order: when the fight is written with its kill, nothing of the kill has been said
    let saidAtWrite = null;
    const put = r.state.storage.put.bind(r.state.storage);
    r.state.storage.put = async (k, v) => { if (k === 'gatefight' && v?.said && saidAtWrite === null) saidAtWrite = gates(a, 'fell').length + gates(a, 'rcpt').length; return put(k, v); };
    // the hub will not answer
    const get = world.ROOMS.get;
    let asked = 0;
    world.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async () => { asked++; return new Response('no', { status: 503 }); } } : get(id));
    r.room._fight.hp = 1;
    await say(a, { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell });
    assert.equal(saidAtWrite, 0, 'kept first, said after');
    assert.equal(gates(a, 'fell').length, 1);
    assert.equal(asked, 1);
    assert.equal(r.store.get('gatefight').told, undefined, 'not told: the hub did not answer');
    await tick(1);
    assert.equal(r.alarm.at, now() + GATE_TELL_RETRY_MS, 'a beat set to tell it again');
    // the hub answers again
    world.ROOMS.get = get;
    for (let i = 0; i < Math.ceil(GATE_TELL_RETRY_MS / BRAIN_TICK_MS) + 1; i++) await tick(1);
    assert.equal(r.store.get('gatefight').told, true);
    assert.equal(gates(h, 'fell').length, 1, 'the hub heard it');
    const told = gates(h, 'fell').length;
    await tick(Math.ceil(GATE_TELL_RETRY_MS / BRAIN_TICK_MS) * 2);
    assert.equal(gates(h, 'fell').length, told, 'and once');
    assert.equal(gates(a, 'fell').length, 1, 'the court said it once');
  });
});

test('AUDIT WB A4 the hub keeps each account\'s receipt for its life and hands it to that account\'s next hello; a spent one is forgotten', async () => {
  await withGate(async ({ world, r, tick, say, set, now }) => {
    const hub = world.room(SOCIAL_ROOM);
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    await say(a, { k: 'in', lv: 10 });
    await tick(2);
    r.room._fight.players['acct-peer-0001'].stoodMs = 1e9;   // stood the whole fight
    r.room._fight.hp = 1;
    await say(a, { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell });
    const mine = gates(a, 'rcpt')[0]?.r;
    assert.ok(mine, 'earned');
    const kept = hub.store.get(gateReceiptKey('acct-peer-0001'));
    assert.deepEqual(kept, { d: DAY, r: mine, e: readReceipt(mine).e });
    // away when it was said: the next hub hello - hours later, the gate long gone - is handed it
    set(TT.wrathAt + 3 * 3600_000);
    const back = hub.connect(); await hub.hello(back, 'peer-0001', null, { name: 'peer-0001b' });
    assert.deepEqual(gates(back, 'rcpt').map((m) => m.r), [mine]);
    const other = hub.connect(); await hub.hello(other, 'peer-0005');
    assert.equal(gates(other, 'rcpt').length, 0, 'nobody else\'s');
    // spent: forgotten on the next hello
    set((readReceipt(mine).e + 1) * 1000);
    const late = hub.connect(); await hub.hello(late, 'peer-0001', null, { name: 'peer-0001c' });
    assert.equal(gates(late, 'rcpt').length, 0);
    assert.equal(hub.store.has(gateReceiptKey('acct-peer-0001')), false);
    assert.ok(now() > 0);
  });
});

test('AUDIT WB C7 a day\'s gate times made once and frozen - the client\'s clock asks every frame, and an evicted day is made again alike', () => {
  assert.equal(gateTimes(660), gateTimes(660), 'one object a day');
  assert.ok(Object.isFrozen(gateTimes(660)));
  const first = { ...gateTimes(660) };
  for (let d = 0; d < 20; d++) gateTimes(900 + d);
  assert.deepEqual({ ...gateTimes(660) }, first);
});
