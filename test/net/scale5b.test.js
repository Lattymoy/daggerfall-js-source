// SCALE5b (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance", then "I wanna do every single slice"; bible/11-Multiplayer/Scale-Arc.md SCALE5b): THE
// RELAY'S HYGIENE AND THE WIRE'S SECOND FORM. Part one, the second wire's poses: a socket whose hello says `w2` hears
// the room's poses batched (wire.js POSE_BATCH_MS) and slim (wire.js slimPose); a socket that says nothing hears every
// pose as it always has, byte for byte. Held here over the real Room on the pins' fake object (test/fakeRoom.mjs) and
// a real session over the pins' fake socket (test/fakeSocket.mjs). tools/mutants/scale5b.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { SOCKETS_MAX } from '../../src/net/wire.js';
import { RoomMetrics } from '../../server/src/relayScale.js';
import { validPose, slimPose, wire2Batch, POSE_DEFAULTS, POSE_BATCH_MS, ROSTER_BATCH_MS, WIRE2_BATCH_MAX, PIXEL_UNITS, POSE_HZ_MAX, RELAY_VERSION, chatRegionRoom, CHAT_HELLO_HZ_MAX } from '../../src/net/wire.js';
import * as relay from '../../server/src/relay.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** A seeded roll (mulberry32) - every story replays. */
function roll(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BX = 13 * 16 + 8, BY = 13 * 16 + 8;
const KEY = `world:${Math.floor(BX / 16)},${Math.floor(BY / 16)}`;
/** A lawful pose in the block's middle pixel, every field the wire carries drawn - defaults half the time. */
function drawn(rnd) {
  const pick = (v) => (rnd() < 0.5 ? undefined : v);
  return validPose({
    x: (BX + rnd()) * PIXEL_UNITS, y: (rnd() - 0.5) * 400, z: (499 - BY + rnd()) * PIXEL_UNITS, yaw: (rnd() - 0.5) * 7, pitch: (rnd() - 0.5) * 2,
    mv: pick(rnd() < 0.5 ? 1 : 2), wd: pick(1), an: pick((rnd() * 65535) | 0), as: pick(1), am: pick(1), sr: pick(1), cn: pick((rnd() * 900) | 0),
    cr: pick(1), ce: pick((rnd() * 4) | 0), ar: pick((rnd() * 40) | 0), fk: pick((rnd() * 5) | 0), rd: pick(1), rv: pick(2), lh: pick(1), lt: pick(9),
    ts: (rnd() * 60_000) | 0,
  });
}

/** A world room on a clock of its own, three listeners and a crowd of speakers: `w2` the second wire's, `old` the first's,
 *  `w2b` another of the second's. */
async function cell(fn, { speakers = 3 } = {}) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const R = fakeRoom(KEY, { now: () => clock });
      const rnd = roll(5);
      const join = async (id, extra = {}) => { const ws = R.connect(); clock += 200; await R.hello(ws, id, drawn(rnd), extra); assert.equal(ws.closed, null, `${id} taken`); return ws; };
      const w2 = await join('lsn-w2', { w2: 1 });
      const old = await join('lsn-old');
      const w2b = await join('lsn-w2b', { w2: 1 });
      const said = [];
      for (let i = 0; i < speakers; i++) said.push(await join(`spk-${i}`));
      for (const ws of R.state.getWebSockets()) ws.sent.length = 0;
      const speak = async (ws, p) => { clock += Math.ceil(1000 / POSE_HZ_MAX) + 1; await R.pose(ws, p); };
      try { return await fn({ R, w2, old, w2b, said, speak, rnd, tick: (ms) => { clock += ms; } }); } finally { R.room._flushOwed(); }
    });
  } finally { Date.now = realNow; }
}

test('SCALE5b slimPose: a validated pose without its defaults, its place in its room\'s units (SLIM-FRAME: a cell\'s x and z whole world units, its height the scene\'s meters to the centimetre) and its turn to a ten-thousandth - validPose reads it back as the pose it was, over every field the wire carries (mutants: a default kept; a field dropped that is not at its default; the place unrounded; the turn rounded coarser)', () => {
  assert.equal(relay.slimPose, slimPose, 'one home, both ends');
  assert.equal(relay.POSE_BATCH_MS, POSE_BATCH_MS);
  const rnd = roll(11);
  let full = 0, slim = 0, n = 0, dropped = 0;
  for (let i = 0; i < 4000; i++) {
    const p = drawn(rnd);
    const s = slimPose(p, KEY);
    const back = validPose(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(Object.keys(back).sort(), Object.keys(p).sort(), 'the same fields, every one');
    for (const k of Object.keys(p)) {
      if (k === 'x' || k === 'z') { assert.ok(Math.abs(back[k] - p[k]) <= 0.5, `${k} within half a unit`); assert.ok(Number.isInteger(s[k]), `${k} whole`); }
      else if (k === 'y') { assert.ok(Math.abs(back.y - p.y) <= 0.005 + 1e-9, `y within half a centimetre (${back.y} for ${p.y})`); assert.equal(s.y, Math.round(p.y * 100) / 100, 'y to the centimetre'); }
      else if (k === 'yaw') { let d = Math.abs(back.yaw - p.yaw); if (d > Math.PI) d = 2 * Math.PI - d; assert.ok(d <= 5.0001e-5, `yaw within half a ten-thousandth (${d})`); }
      else if (k === 'pitch') assert.ok(Math.abs(back.pitch - p.pitch) <= 5.0001e-5, 'pitch within half a ten-thousandth');
      else assert.equal(back[k], p[k], k);
    }
    for (const [k, v] of Object.entries(POSE_DEFAULTS)) { if (p[k] === v) { assert.ok(!(k in s), `${k} at its default is left out`); dropped++; } else assert.equal(s[k], p[k], `${k} off its default is said`); }
    full += JSON.stringify(p).length; slim += JSON.stringify(s).length; n++;
  }
  assert.ok(dropped > n * 3, `defaults met often (${dropped})`);
  assert.ok(slim < full * 0.6, `the slim pose under three fifths of the whole (${(slim / n).toFixed(1)} of ${(full / n).toFixed(1)} bytes)`);
  // a player standing: the pose the wire said every keepalive, against the second wire's
  const stand = validPose({ x: 6_869_221.734, y: -1_412.25, z: 9_111_000.5, yaw: 1.234567, pitch: -0.0123456, ts: 4_100 });
  assert.equal(JSON.stringify(slimPose(stand, KEY)), '{"x":6869222,"y":-1412.25,"z":9111001,"yaw":1.2346,"pitch":-0.0123,"ts":4100}', 'SLIM-FRAME: the height in metres, kept to the centimetre');
});

test('SCALE5b the relay: a `w2` listener hears the batch\'s poses as ONE `poses` frame of slim entries in the order they were said; a listener that said no `w2` hears each pose at once, byte for byte the frame it always heard (mutants: the batch skipped; the entry the whole pose; the legacy frame slimmed; the hello\'s `w2` unread; another offer refused; another offer read as this one)', async () => {
  await cell(async ({ R, w2, old, w2b, said, speak, rnd }) => {
    const order = [];
    for (let round = 0; round < 3; round++) {
      for (const [i, ws] of said.entries()) {
        const p = drawn(rnd);
        await speak(ws, p);
        order.push([`spk-${i}`, p]);
      }
    }
    assert.equal(w2.sent.length, 0, 'nothing yet to the second wire');
    assert.equal(w2b.sent.length, 0);
    // the first wire: one frame a pose, as it was before SCALE5b - the relay's own echo of what was said
    assert.deepEqual(old.sent, order.map(([id, p]) => ({ t: 'pose', id, p })));
    assert.equal(R.room._attach(w2).w2, 1, 'the hello\'s `w2` kept on the socket');
    assert.equal(R.room._attach(old).w2, undefined, 'and none on a socket that did not say it');
    const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
    const offer = (w2) => relay.parseClient(JSON.stringify({ t: 'hello', id: 'lsn-0001', secret: 'secret-of-lsn-0001', name: 'x', look, pose: null, w2 }));
    assert.equal(offer(1).w2, 1, 'the offer read');
    for (const v of [2, true, '1', 0, null, undefined]) { const h = offer(v); assert.equal(h.error, undefined, `an offer of ${JSON.stringify(v)} lets the hello in`); assert.equal(h.w2, undefined, `and is no offer of this wire (${JSON.stringify(v)})`); }
    R.room._flushOwed();
    for (const ws of [w2, w2b]) {
      assert.equal(ws.sent.length, 1, 'one frame for the batch');
      const [f] = ws.sent;
      assert.equal(f.t, 'poses');
      assert.deepEqual(f.l, order.map(([id, p]) => [id, JSON.parse(JSON.stringify(slimPose(p, KEY)))]), 'each pose as its slim entry, in order - SLIM-FRAME: in the units of the room it was said in');
    }
    R.room._flushOwed();
    assert.equal(w2.sent.length, 1, 'a flush with nothing owed says nothing');
  });
});

test('SCALE5b the relay: a `w2` socket\'s owed poses go out AHEAD of any other frame the room sends it - a leave never overtakes the pose said before it - and a socket gone is owed nothing (mutants: the flush before a send; the queue kept past the close)', async () => {
  await cell(async ({ R, w2, old, w2b, said, speak, rnd }) => {
    const p = drawn(rnd);
    await speak(said[0], p);
    await R.drop(said[0]);
    const kinds = (ws) => ws.sent.map((f) => f.t);
    assert.deepEqual(kinds(old), ['pose', 'leave']);
    assert.deepEqual(kinds(w2), ['poses', 'leave'], 'the pose first, then its sayer\'s leave');
    assert.deepEqual(w2.sent[0].l, [['spk-0', JSON.parse(JSON.stringify(slimPose(p, KEY)))]]);
    // the second listener closes owing a pose: nothing is kept for it, and nothing sent
    await speak(said[1], drawn(rnd));
    assert.equal(R.room._owed.has(w2b), true);
    await R.drop(w2b);
    assert.equal(R.room._owed.has(w2b), false, 'the queue went with the socket');
    const before = w2b.sent.length;
    R.room._flushOwed();
    assert.equal(w2b.sent.length, before, 'and the batch sent it nothing');
  });
});

test('SCALE5b the relay: the batch goes out on its own every POSE_BATCH_MS, one timer for the room however many listeners are owed, and none while nothing is (mutants: the timer never set; a timer a pose)', async () => {
  await cell(async ({ R, w2, w2b, said, speak, rnd }) => {
    assert.equal(R.room._owedSoon, null, 'no timer while nothing is owed');
    await speak(said[0], drawn(rnd));
    const first = R.room._owedSoon;
    assert.ok(first, 'a timer once a pose is owed');
    await speak(said[1], drawn(rnd));
    assert.equal(R.room._owedSoon, first, 'the same timer for the next');
    await new Promise((r) => setTimeout(r, POSE_BATCH_MS + 40));
    assert.equal(R.room._owedSoon, null);
    for (const ws of [w2, w2b]) { assert.equal(ws.sent.length, 1); assert.equal(ws.sent[0].l.length, 2); }
  });
});

test('SCALE5b wire2Batch: what a socket is owed as the ONE frame that carries it - poses alone a `poses` frame, one frame alone itself, anything else a frame batch with every run of poses one `poses` frame where it fell, in the order owed (mutants: the runs merged out of order; one frame wrapped; the poses frame for frames)', () => {
  const pose = (id) => JSON.stringify([id, { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 }]);
  const frame = (t, id) => JSON.stringify({ t, id });
  const read = (items) => JSON.parse(wire2Batch(items));
  assert.deepEqual(read([pose('a'), pose('b')]), { t: 'poses', l: [JSON.parse(pose('a')), JSON.parse(pose('b'))] });
  assert.deepEqual(read([frame('join', 'a')]), { t: 'join', id: 'a' }, 'one frame alone goes as itself');
  assert.deepEqual(read([frame('join', 'a'), frame('leave', 'b')]), { t: 'fb', f: [{ t: 'join', id: 'a' }, { t: 'leave', id: 'b' }] });
  assert.deepEqual(read([pose('a'), frame('leave', 'a'), pose('b'), pose('c'), frame('join', 'd')]), { t: 'fb', f: [
    { t: 'poses', l: [JSON.parse(pose('a'))] }, { t: 'leave', id: 'a' }, { t: 'poses', l: [JSON.parse(pose('b')), JSON.parse(pose('c'))] }, { t: 'join', id: 'd' },
  ] }, 'a pose said before a leave stays before it');
  assert.deepEqual(read([frame('join', 'a'), pose('a')]), { t: 'fb', f: [{ t: 'join', id: 'a' }, { t: 'poses', l: [JSON.parse(pose('a'))] }] });
});

/** A region's channel on a clock of its own: `w2` the second wire's listener, `old` the first's. */
async function channel(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const R = fakeRoom(chatRegionRoom(3), { now: () => clock });
      const join = async (id, extra = {}) => { const ws = R.connect(); clock += Math.ceil(1000 / CHAT_HELLO_HZ_MAX) + 1; await R.hello(ws, id, null, extra); assert.equal(ws.closed, null, `${id} taken`); return ws; };
      const w2 = await join('lsn-w2', { w2: 1 });
      const old = await join('lsn-old');
      R.room._flushOwed();   // the listener's own join, owed the other
      for (const ws of [w2, old]) ws.sent.length = 0;
      try { return await fn({ R, w2, old, join, tick: (ms) => { clock += ms; } }); } finally { R.room._flushOwed(); }
    });
  } finally { Date.now = realNow; }
}

test('SCALE5b the relay: a channel\'s joins and leaves to a socket of the second wire are owed it for the roster\'s batch, and go out as ONE frame of exactly the frames a socket of the first wire heard one at a time, in their order - the room\'s count in each (mutants: the join said at once; the leave said at once; a pose\'s cadence for the roster; the roster\'s timer never set)', async () => {
  await channel(async ({ R, w2, old, join }) => {
    const came = [];
    for (let i = 0; i < 5; i++) came.push(await join(`jn-${i}`));
    await R.drop(came[1]);
    assert.deepEqual(old.sent.map((f) => `${f.t}:${f.id}:${f.n}`), ['join:jn-0:3', 'join:jn-1:4', 'join:jn-2:5', 'join:jn-3:6', 'join:jn-4:7', 'leave:jn-1:6'], 'the first wire: one frame each, as it always was');
    assert.equal(w2.sent.length, 0, 'nothing yet to the second');
    assert.equal(R.room._owedSoon, null, 'no pose\'s timer for a roster');
    assert.ok(R.room._owedLate, 'the roster\'s');
    R.room._flushOwed();
    assert.equal(w2.sent.length, 1, 'one frame for the batch');
    assert.deepEqual(w2.sent[0], { t: 'fb', f: old.sent }, 'exactly the frames the first wire heard, in their order');
    assert.equal(R.room._owedLate, null);
  });
});

test('SCALE5b the relay: a channel\'s owed roster goes ahead of a line said after it, and goes out on its own after ROSTER_BATCH_MS (mutants: the flush before a send; the roster\'s timer a pose\'s)', async () => {
  await channel(async ({ R, w2, old, join }) => {
    await join('jn-0');
    await R.chat(old, 'hail');
    assert.deepEqual(w2.sent.map((f) => f.t), ['join', 'chat'], 'the join it was owed, then the line');
    await join('jn-1');
    await new Promise((r) => setTimeout(r, POSE_BATCH_MS + 30));
    assert.equal(w2.sent.length, 2, 'not out at a pose\'s batch');
    await new Promise((r) => setTimeout(r, ROSTER_BATCH_MS - POSE_BATCH_MS + 30));
    assert.deepEqual(w2.sent.map((f) => f.t), ['join', 'chat', 'join'], 'out at the roster\'s');
  });
});

test('SCALE5b the relay: a socket owed WIRE2_BATCH_MAX items is sent them at once, in one frame - a reader takes no more from a batch (mutants: the bound unasked)', async () => {
  await cell(async ({ R, w2 }) => {
    const entry = JSON.stringify(['spk-0', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 }]);
    for (let i = 0; i < WIRE2_BATCH_MAX - 1; i++) R.room._owe(w2, entry);
    assert.equal(w2.sent.length, 0);
    R.room._owe(w2, entry);
    assert.equal(w2.sent.length, 1);
    assert.equal(w2.sent[0].l.length, WIRE2_BATCH_MAX);
    assert.equal(R.room._owed.has(w2), false);
  });
});

/** A session in the room `KEY`, welcomed, on a clock of its own. */
function welcomed(opts = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, ...opts });
  s.join(KEY, { x: (BX + 0.5) * PIXEL_UNITS, y: 0, z: (499 - BY + 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: RELAY_VERSION, now: t });
  return { s, ws: sockets[0], hello: JSON.parse(sockets[0].sent.find((x) => x.startsWith('{"t":"hello"'))) };
}
/** What a session holds of its peers - every field but the clock's. */
const held = (s, room = KEY) => JSON.stringify([...s.peers].map(([id, p]) => [id, p.pose, p.name, p.src, [...s._roomSet(room)].sort()]));

test('SCALE5b the client: a session asked for the second wire says `w2` in its hello and one not asked says nothing; a `poses` batch is read entry by entry through the door every pose comes in by - the peers it stands are exactly those its poses, said one frame each and whole, stand (mutants: the hello\'s `w2`; the batch unread; an entry skipped; the bound unasked; a malformed entry read)', async () => {
  await quiet(() => {
    assert.equal(welcomed().hello.w2, undefined, 'an older build\'s hello, and a session not asked');
    const { s: batched, ws: wb, hello } = welcomed({ wire2: true });
    assert.equal(hello.w2, 1, 'the second wire offered');
    const { s: single, ws: w1 } = welcomed();
    const rnd = roll(23);
    // poses whose place and turn are already what the slim pose rounds them to - so the whole pose and the slim one are the same pose
    const poses = Array.from({ length: 40 }, (_, i) => {
      const p = drawn(rnd);
      for (const k of ['x', 'y', 'z']) p[k] = Math.round(p[k]);
      for (const k of ['yaw', 'pitch']) p[k] = Math.round(p[k] * 1e4) / 1e4;
      return [`peer-${String(i % 17).padStart(4, '0')}`, validPose(p)];
    });
    for (const [id, p] of poses) w1.receive({ t: 'pose', id, p });
    wb.receive({ t: 'poses', l: poses.map(([id, p]) => [id, slimPose(p)]) });
    assert.equal(batched.peers.size, 17);
    assert.equal(held(batched), held(single), 'the batch stood every peer where its poses, said whole, stand them');
    // the bound, and an entry that is no entry
    const { s: bounded, ws: wbd } = welcomed({ wire2: true });
    const many = Array.from({ length: WIRE2_BATCH_MAX + 5 }, (_, i) => [`far-${String(i).padStart(4, '0')}`, slimPose(poses[0][1])]);
    wbd.receive({ t: 'poses', l: [null, 7, ['x'], [5, {}], ['bad-0001', null], ...many] });
    assert.equal(bounded.peers.size, WIRE2_BATCH_MAX - 5, 'WIRE2_BATCH_MAX entries read at most - the five that were no entry among them, read as nothing');
    assert.equal(bounded.peers.has('far-0000'), true);
    wbd.receive({ t: 'poses', l: 'nope' });
    wbd.receive({ t: 'poses' });
  });
});

test('SCALE5b the client: a frame batch is read frame by frame as if each came alone - its runs of poses through the pose arm, its joins, leaves and lines through theirs - WIRE2_BATCH_MAX all told, and no batch within a batch (mutants: the batch unread; a frame skipped; the bound unasked; a batch read within a batch)', async () => {
  await quiet(() => {
    const room = chatRegionRoom(3);
    const open = (wire2) => {
      const { FakeWS, sockets } = fakeSocketClass();
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, rand: () => 0, presence: false, wire2 });
      const lines = [];
      s.onChat = (l) => lines.push(`${l.id}:${l.text}`);
      s.join(room);
      sockets[0].open();
      sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 600, v: RELAY_VERSION, now: 1_000_000 });   // a roster cut: the room's count is kept
      return { s, ws: sockets[0], lines };
    };
    const rnd = roll(31);
    const p = () => { const q = drawn(rnd); for (const k of ['x', 'y', 'z']) q[k] = Math.round(q[k]); for (const k of ['yaw', 'pitch']) q[k] = Math.round(q[k] * 1e4) / 1e4; return validPose(q); };
    const said = [
      { t: 'join', id: 'ann-0001', name: 'Ann', n: 2 }, { t: 'join', id: 'bob-0001', name: 'Bob', n: 3 },
      { t: 'chat', id: 'ann-0001', name: 'Ann', text: 'hail' },
      { t: 'pose', id: 'ann-0001', p: p() }, { t: 'pose', id: 'bob-0001', p: p() },
      { t: 'leave', id: 'bob-0001', n: 2 }, { t: 'join', id: 'cat-0001', name: 'Cat', n: 3 }, { t: 'chat', id: 'cat-0001', name: 'Cat', text: 'well met' },
    ];
    const one = open(false), many = open(true);
    for (const f of said) one.ws.receive(f);
    const f = [said[0], said[1], said[2], { t: 'poses', l: [[said[3].id, slimPose(said[3].p)], [said[4].id, slimPose(said[4].p)]] }, said[5], said[6], said[7]];
    many.ws.receive({ t: 'fb', f });
    assert.deepEqual(many.lines, one.lines);
    assert.deepEqual(many.lines, ['ann-0001:hail', 'cat-0001:well met']);
    assert.equal(many.s.roomCount, one.s.roomCount);
    assert.equal(many.s.roomCount, 3);
    assert.equal(held(many.s, room), held(one.s, room), 'the same peers, where the same poses stand them');
    // the bound: frames and poses counted together; a batch within a batch read as nothing
    const bound = open(true);
    const joins = Array.from({ length: WIRE2_BATCH_MAX }, (_, i) => ({ t: 'join', id: `j-${String(i).padStart(4, '0')}`, name: 'J' }));
    bound.ws.receive({ t: 'fb', f: [null, { t: 'fb', f: [{ t: 'join', id: 'deep-0001', name: 'Deep' }] }, { t: 'poses', l: [[said[3].id, slimPose(said[3].p)]] }, ...joins] });
    assert.equal(bound.s.peers.has('deep-0001'), false, 'no batch within a batch');
    assert.equal(bound.s.peers.has(said[3].id), true, 'the poses frame in it read');
    assert.equal(bound.s.peers.has('j-0000'), true);
    assert.equal(bound.s.peers.size, 1 + WIRE2_BATCH_MAX - 3, 'WIRE2_BATCH_MAX all told');
    bound.ws.receive({ t: 'fb', f: 'nope' });
    bound.ws.receive({ t: 'fb' });
  });
});

test('SCALE5b the world host asks the second wire on every socket the page holds - the presence session (its halo with it) and each chat link (mutants: the presence session\'s; a link\'s)', () => {
  const world = src('src/scenes/world.js');
  const links = world.match(/new OnlineSession\(\{[^\n]*presence: false[^\n]*\}\)/g) ?? [];
  assert.ok(links.length >= 2, 'the chat links and the hall');
  for (const l of links) assert.match(l, /wire2: true/, l.slice(0, 80));
  assert.match(world, /wave: pageWave,[^\n]*\n\s+wire2: true,/, 'the presence session');
});

// ═══ PART THREE: THE RELAY'S HYGIENE ════════════════════════════════════════════════════════════════════════════════

/** A story of a room's sockets - hellos, a reconnect replacing its own id, closes said and unsaid, wakes, the clock past
 *  the index's trust - and after every step `check(room, sockets)`. */
async function socketStory(seed, key, check, { steps = 120, ids = 9 } = {}) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const R = fakeRoom(key, { now: () => clock });
      const rnd = roll(seed);
      const open = [];
      for (let step = 0; step < steps; step++) {
        const r = rnd();
        clock += 150 + Math.floor(rnd() * 400);
        if (r < 0.5 || open.length < 2) {
          const ws = R.connect();
          const id = `p-${String(Math.floor(rnd() * ids)).padStart(4, '0')}`;
          await R.hello(ws, id, { x: (BX + rnd()) * PIXEL_UNITS, y: 0, z: (499 - BY + rnd()) * PIXEL_UNITS, yaw: 0, pitch: 0 });
          if (!ws.closed) open.push(ws);
        } else if (r < 0.75) {
          const ws = open.splice(Math.floor(rnd() * open.length), 1)[0];
          await R.drop(ws);
        } else if (r < 0.85) {
          // the runtime lets a socket go and says nothing - the index finds it gone on its next walk past IDX_TRUST_MS
          const ws = open.splice(Math.floor(rnd() * open.length), 1)[0];
          const i = R.sockets.indexOf(ws); if (i >= 0) R.sockets.splice(i, 1);
          clock += 1100;
        } else if (r < 0.92) R.wake();
        else clock += 1100;
        check(R.room, R.state.getWebSockets(), step);
      }
    });
  } finally { Date.now = realNow; }
}

test('SCALE5b the host KEPT: `_hostOf` answers what its walk of every socket answers - asked with no socket left out and with each one - after every hello, reconnect, close, silent close, wake and the index\'s re-walk (mutants: the host never asked again after a hello; after a close; after a wake\'s walk; the kept answer for the host left out)', async () => {
  let asked = 0, changed = 0, last;
  for (const seed of [1, 2, 3, 4]) {
    await socketStory(seed, KEY, (room, sockets) => {
      const host = room._hostOf();
      assert.equal(host, room._hostWalk(null), 'the room\'s host');
      if (host !== last) changed++;
      last = host;
      for (const ws of sockets) { assert.equal(room._hostOf(ws), room._hostWalk(ws), 'with one socket left out'); asked++; }
    });
  }
  assert.ok(asked > 400 && changed > 12, `asked ${asked} times, the host changed ${changed} times`);
});

test('SCALE5b directed frames by the id index: `_idFirst(id, except)` is the first socket but `except` holding the id in the index\'s order - what the copy and search of every socket answered - and `_withId` every one, over the same story (mutants: the index not moved on a hello; not on a close; not rebuilt with the walk; the order unread; `except` unread)', async () => {
  let found = 0, asked = 0;
  for (const seed of [5, 6, 7]) {
    await socketStory(seed, KEY, (room, sockets) => {
      for (const id of [null, undefined, '', ...Array.from({ length: 9 }, (_, i) => `p-${String(i).padStart(4, '0')}`)]) {
        for (const except of [null, ...sockets]) {
          const want = id ? [...room._all()].find(([o, b]) => o !== except && b.id === id) ?? null : null;
          const got = room._idFirst(id, except);
          assert.equal(got?.[0] ?? null, want?.[0] ?? null, `the socket of ${id}`);
          assert.equal(got?.[1] ?? null, want?.[1] ?? null);
          if (want) found++;
          asked++;
          if (id) assert.deepEqual(room._withId(id, except).map((e) => e[0]), [...room._all()].filter(([o, b]) => o !== except && b.id === id).map((e) => e[0]));
        }
      }
    }, { steps: 80 });
  }
  assert.ok(found > asked / 8, `found ${found} of ${asked}`);
});

test('SCALE5b the drain\'s sweep not paid twice: an empty room\'s first hello after a drain\'s sweep lists nothing - and one after a wake, or with leftovers a silent close kept, sweeps as before (mutants: the marker never set; never cleared by a hello; the marker read where a socket stands)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const R = fakeRoom(KEY, { now: () => clock });
      let lists = 0;
      const real = R.state.storage.list.bind(R.state.storage);
      R.state.storage.list = (...a) => { lists++; return real(...a); };
      const enter = async (id) => { const ws = R.connect(); clock += 300; await R.hello(ws, id, null); assert.equal(ws.closed, null); return ws; };
      const a = await enter('p-0001');
      assert.ok(lists > 0, 'a room never swept sweeps at its first hello');
      lists = 0;
      await R.drop(a);
      assert.ok(lists > 0, 'the drain sweeps');
      lists = 0;
      const b = await enter('p-0002');
      assert.equal(lists, 0, 'the next hello into the drained room sweeps nothing');
      const c = await enter('p-0003');
      assert.equal(lists, 0);
      await R.drop(c);
      assert.equal(lists, 0, 'a leave that is not the last sweeps nothing');
      lists = 0;
      await R.drop(b);
      lists = 0;
      R.wake();
      R.state.storage.list = (...x) => { lists++; return real(...x); };
      const d = await enter('p-0004');
      assert.ok(lists > 0, 'a woken room does not know it was swept - it sweeps');
      // a socket the runtime let go with nothing said leaves its look and secret behind: the next empty hello sweeps them
      const i = R.sockets.indexOf(d); R.sockets.splice(i, 1);
      clock += 1100;
      lists = 0;
      await enter('p-0005');
      assert.ok(lists > 0, 'an empty room no drain swept sweeps');
      assert.equal(await R.state.storage.get('secret:p-0004'), undefined, 'and takes what was left behind');
      // and awake: a drain's sweep, then a hello that writes, then that socket let go with nothing said - the room is not
      // as the drain left it, and the next empty hello sweeps
      const e = R.sockets[R.sockets.length - 1];
      await R.drop(e);
      const f = await enter('p-0006');
      R.sockets.splice(R.sockets.indexOf(f), 1);
      clock += 1100;
      lists = 0;
      await enter('p-0007');
      assert.ok(lists > 0, 'a hello since the drain\'s sweep - the next empty hello sweeps');
      assert.equal(await R.state.storage.get('secret:p-0006'), undefined, 'and takes what it left behind');
    });
  } finally { Date.now = realNow; }
});

test('SCALE5b a beat\'s frames: a socket of the second wire hears a boss\'s beat as ONE frame batch, at once - one frame alone as itself - and any other socket each frame as it always did (mutants: the batch for the second wire; one frame wrapped)', async () => {
  await cell(async ({ R, w2, old, w2b }) => {
    R.room._gateFan([{ k: 'hp', v: 3 }, { k: 'move', x: 1 }, { k: 'say', s: 'ha' }]);
    assert.deepEqual(old.sent, [{ t: 'gate', k: 'hp', v: 3 }, { t: 'gate', k: 'move', x: 1 }, { t: 'gate', k: 'say', s: 'ha' }]);
    for (const ws of [w2, w2b]) assert.deepEqual(ws.sent, [{ t: 'fb', f: old.sent }], 'one frame, now');
    for (const ws of [w2, old]) ws.sent.length = 0;
    const batches = R.room._metrics.c.batches;
    R.room._siegeFan([{ k: 'hp', v: 2 }]);
    assert.deepEqual(w2.sent, [{ t: 'siege', k: 'hp', v: 2 }]);
    assert.deepEqual(old.sent, w2.sent);
    assert.equal(R.room._metrics.c.batches, batches, 'one frame is no batch');
  });
});

test('SCALE5b the foes fan, a method of its own with the budget asked before its walk: every frame reaches exactly the listeners the law names and leaves the room\'s bucket exactly where the law leaves it - over budgets below one listener\'s worth, between one\'s and all of theirs, and above - and a frame the room cannot afford for one listener walks nobody (mutants: the budget borrowed; the walk before the budget; the range unread; the sender heard)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const key = KEY;   // a cell's room: its foes are anyone's, ranged as the pose is
      const R = fakeRoom(key, { now: () => clock });
      const rnd = roll(41);
      const socks = [];
      for (let i = 0; i < 14; i++) {
        const ws = R.connect(); clock += 300;
        const far = i % 4 === 3 ? 7 : 0;   // a quarter of them out of range
        await R.hello(ws, `f-${String(i).padStart(4, '0')}`, { x: (BX + far + rnd()) * PIXEL_UNITS, y: 0, z: (499 - BY + rnd()) * PIXEL_UNITS, yaw: 0, pitch: 0 });
        socks.push(ws);
      }
      // PIN MOVED (FOES-FIRST, Scale-Arc.md FOES-FIRST): every frame here is FULL and comes a second or more after its
      // sender's last, so it goes first - its floor is minus FOES_FULL_RESERVE, and the bucket stands that far lower
      // (it read byteGate's law, the floor at 0, for every frame alike). test/net/fb1021_foesfirst.test.js holds the rest.
      // PIN MOVED (FOES-HOLD, Scale-Arc.md FOES-HOLD): a full frame the budget refuses is HELD for its turn, not dropped -
      // each round here starts with an empty hold (the turns are test/net/fb1021b_foeshold.test.js's), and a refusal is
      // counted held.
      const { floorGate, inRange, FOES_ROOM_BYTES_PER_S, FOES_FULL_RESERVE } = relay;
      const floor = -FOES_FULL_RESERVE;
      let dropped = 0, passed = 0, between = 0;
      const low = [], mid = [];   // how many times the index was asked for a frame refused below one listener's worth, and for one refused between
      for (let round = 0; round < 60; round++) {
        clock += 1000;   // past every sender's own meter
        for (const ws of socks) ws.sent.length = 0;
        R.room._foesHolds = null;
        const from = socks[Math.floor(rnd() * socks.length)];
        const a = R.room._attach(from);
        const frame = JSON.stringify({ t: 'foes', data: { n: round, full: 1, f: Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => ({ i, x: 1, y: 0, z: 1, h: 10 })) } });
        const per = frame.length + a.id.length + 8;
        const heard = socks.filter((o) => o !== from && inRange(key, a.pose, R.room._attach(o).pose));
        const want = per * heard.length;
        // the bucket stood anywhere from empty to past the whole fan's cost
        const over = [0, per / 2, per, (per + want) / 2, want - 1, want, want * 2][round % 7];
        const bytes = floor + over;
        if (over >= per && over < want) between++;
        R.room._roomFoes = { bytes, at: clock };
        const law = floorGate({ bytes, at: clock }, clock, want, FOES_ROOM_BYTES_PER_S, floor);
        let walked = 0;
        const all = R.room._all.bind(R.room);
        R.room._all = () => { walked++; return all(); };
        const before = walked;
        await R.raw(from, frame);
        R.room._all = all;
        const got = socks.filter((o) => o.sent.some((f) => f.t === 'foes'));
        assert.deepEqual(got, law.pass ? heard : [], `round ${round}: the listeners (bucket ${bytes}, a listener ${per}, all ${want})`);
        assert.deepEqual(R.room._roomFoes, law.bucket, `round ${round}: the bucket`);
        if (law.pass) passed++; else dropped++;
        assert.equal(R.room._meterOf(from).junk ?? 0, 0, `round ${round}: never junk`);
        (over < per ? low : over < want ? mid : []).push(walked - before);
      }
      assert.ok(dropped > 10 && passed > 10 && between > 10, `both answers, and the band between one listener and all (${dropped} dropped, ${passed} passed, ${between} between)`);
      assert.equal(R.room._metrics.c.held, dropped, 'each refusal held for its turn and counted');
      assert.equal(R.room._metrics.c.drops, 0, 'and none dropped');
      assert.equal(R.room._metrics.c.foes, 60, 'and each frame');
      assert.ok(low.length > 5 && mid.length > 5);
      assert.ok(Math.max(...low) < Math.min(...mid), `a frame the room cannot afford for one listener walks nobody - the index asked ${JSON.stringify([...new Set(low)])} times for it, ${JSON.stringify([...new Set(mid)])} for one that walked`);
    });
  } finally { Date.now = realNow; }
});

test('SCALE5b the metrics point: a socket refused \'room full\' is counted - the door counted nothing - and the window says the most sockets it held, the frames its budgets dropped, its foes frames, blows and lines, and the second wire\'s items and the batches that carried them, in doubles 13 to 20 (mutants: the full room uncounted; the peak the window\'s last count; a batch uncounted; an item uncounted)', async () => {
  const hadPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { this[0] = {}; this[1] = { serializeAttachment() {} }; } };
  const realNow = Date.now; const now = realNow(); Date.now = () => now;
  try {
    await quiet(async () => {
      const points = [];
      const busy = fakeRoom('town:m8');
      busy.room.env.METRICS = { writeDataPoint: (p) => points.push(p) };
      for (let i = 0; i < SOCKETS_MAX; i++) { const ws = busy.connect(); ws.att.at = now - 1; }
      const upgrade = (p) => new Request(`https://relay.test${p}`, { headers: { Upgrade: 'websocket' } });
      assert.equal((await busy.room.fetch(upgrade('/room/town:m8'))).status, 503);
      assert.equal((await busy.room.fetch(upgrade('/room/town:m8'))).status, 503);
      assert.equal(busy.room._metrics.c.full, 2, 'each refusal counted');
      for (const ws of busy.sockets.slice(0, 200)) busy.sockets.splice(busy.sockets.indexOf(ws), 1);
      busy.room._idx = null;   // the runtime let them go; the index walks again
      busy.room._metricsTick(true);
      assert.equal(points.length, 1);
      const d = points[0].doubles;
      assert.equal(d.length, 20);
      assert.equal(d[12], 2, 'double13: refused room full');
      assert.equal(d[14], SOCKETS_MAX, 'double15: the most it held in the window, not the count at its end');
    });
  } finally { globalThis.WebSocketPair = hadPair; Date.now = realNow; }
  // the second wire's work, a cell's frames by type
  await cell(async ({ R, w2, w2b, old, said, speak, rnd }) => {
    const c0 = { ...R.room._metrics.c };
    for (const ws of said) await speak(ws, drawn(rnd));
    R.room._flushOwed();
    const c = R.room._metrics.c;
    assert.equal(c.owed - c0.owed, 2 * said.length, 'every pose owed the two listeners of the second wire');
    assert.equal(c.batches - c0.batches, 2, 'and one batch each');
    R.room._gateFan([{ k: 'a' }, { k: 'b' }]);
    assert.equal(c.batches - c0.batches, 4, 'a beat a batch to each of the second wire');
    assert.equal(c.owed - c0.owed, 2 * said.length + 4);
    await R.chat(old, 'hail');
    assert.equal(c.chats - c0.chats, 1);
    await R.raw(said[0], JSON.stringify({ t: 'hit', data: { to: 'spk-0001', i: 0, d: 3 } }));
    assert.equal(c.hits - c0.hits, 1);
    void w2; void w2b;
  });
  // the law alone: the point's last eight, in their order
  const m = new RoomMetrics(0);
  Object.assign(m.c, { frames: 1, full: 3, drops: 4, peak: 9, foes: 5, hits: 6, chats: 7, owed: 8, batches: 2 });
  const got = [];
  m.flush({ writeDataPoint: (p) => got.push(p) }, 'world', 7, 'w', 1, true);
  assert.deepEqual(got[0].doubles.slice(12), [3, 4, 9, 5, 6, 7, 8, 2]);
  const n = new RoomMetrics(0);
  n.c.full = 1;
  assert.equal(n.flush({ writeDataPoint: (p) => got.push(p) }, 'world', 0, 'w', 1, true), true, 'a window that only refused a full room still says so');
  assert.equal(got[1].doubles[14], 0);
  const k = new RoomMetrics(0);
  k.c.frames = 1; k.c.peak = 3;
  k.flush({ writeDataPoint: (p) => got.push(p) }, 'world', 11, 'w', 1, true);
  assert.equal(got[2].doubles[14], 11, 'the peak is never under the sockets the room holds at the point');
});

// ═══ PART FOUR: THE RELAY'S SETTINGS, AT RUN TIME (net/relayCfg.js) ═════════════════════════════════════════════════

test('SCALE5b relayCfg: a setting is one of seventeen names and a string of at most RELAY_CFG_VALUE_MAX, or null (handed back to the var); the one in force is the hub\'s, else the var; a developer alone may set one; /relay\'s words (mutants: a name not a setting\'s; the bound unasked; null refused; the var over the hub\'s; a Dungeon Master let in)', async () => {
  const C = await import('../../src/net/relayCfg.js');
  assert.deepEqual(C.RELAY_CFG_KEYS, ['bossBody', 'gateRole', 'serpentRole', 'sdRole', 'gateThread', 'serpentThread', 'sdThread', 'egThread', 'ktRole', 'ktThread', 'egDrain', 'groundGate', 'grantMode', 'grantRoll', 'grantStrip', 'grantDoor', 'leaseDoor']);   // PIN MOVED (KETCH, world253: the Sky-Ketch's herald's role and thread); PIN MOVED (HERALD-CARDS, net/herald/heraldCard.js: the four heralds' threads, beside the roles); PIN MOVED (LEASE1, net/roomLease.js: leaseDoor - a lease room refuses a build that hands on no lease, off until the site serves it); PIN MOVED (GRANT-DOOR, Spawn-Grants.md section 20: grantDoor); PIN MOVED (GRANT8-GRANT9, Spawn-Grants.md section 16: grantRoll and grantStrip, each off until a developer sets it); PIN MOVED (GRANT2, bible/11-Multiplayer/Spawn-Grants.md section 12: grantMode, the spawn grants' law); PIN MOVED (GROUND-GATE, bible/01-Overview/bugs/Field-Bugs-2026-10-17f.md): the old ground's door - a ground room refuses a build on an older ground while it is on; PIN MOVED (EG-H2, bible/11-Multiplayer/Elite-Gates.md section 22): THE DRAIN's switch - the Spire's road shut while a deploy drains it
  assert.deepEqual(Object.values(C.RELAY_CFG_VARS), ['BOSS_BODY', 'GATE_DISCORD_ROLE', 'SERPENT_DISCORD_ROLE', 'SD_DISCORD_ROLE', 'GATE_DISCORD_THREAD', 'SERPENT_DISCORD_THREAD', 'SD_DISCORD_THREAD', 'EG_DISCORD_THREAD', 'KT_DISCORD_ROLE', 'KT_DISCORD_THREAD', 'EG_DRAIN', 'GROUND_GATE', 'GRANT_MODE', 'GRANT_ROLL', 'GRANT_STRIP', 'GRANT_DOOR', 'LEASE_DOOR']);   // PIN MOVED (KETCH): their vars; PIN MOVED (HERALD-CARDS): their vars; PIN MOVED (LEASE1): its var; PIN MOVED (GRANT-DOOR): its var; PIN MOVED (GRANT8-GRANT9): their vars; PIN MOVED (GRANT2): GRANT_MODE, the spawn grants' law; PIN MOVED (GROUND-GATE): the old ground's door's var
  assert.deepEqual(C.validRelayCfgIn({ k: 'gateRole', v: '1555589839825670258' }), { k: 'gateRole', v: '1555589839825670258' });
  assert.deepEqual(C.validRelayCfgIn({ k: 'bossBody', v: null }), { k: 'bossBody', v: null });
  assert.deepEqual(C.validRelayCfgIn({ k: 'bossBody', v: 'x'.repeat(C.RELAY_CFG_VALUE_MAX) })?.v.length, C.RELAY_CFG_VALUE_MAX);
  for (const bad of [null, {}, { k: 'BOSS_BODY', v: '' }, { k: 'toString', v: '' }, { k: 'bossBody' }, { k: 'bossBody', v: 5 }, { k: 'bossBody', v: 'x'.repeat(C.RELAY_CFG_VALUE_MAX + 1) }]) assert.equal(C.validRelayCfgIn(bad), null, JSON.stringify(bad)?.slice(0, 60));
  assert.deepEqual(C.validRelayCfgOut({ k: 'sdRole', v: '' }), { k: 'sdRole', v: '' });
  assert.deepEqual(C.validRelayCfgOut({ k: 'sdRole', error: 'no' }), { k: 'sdRole', error: 'no' });
  assert.equal(C.validRelayCfgOut({ k: 'sdRole' }), null);
  const env = { BOSS_BODY: '{"enforce":true}', GATE_DISCORD_ROLE: '1' };
  assert.equal(C.relayCfgValue({}, env, 'bossBody'), '{"enforce":true}', 'the var while the hub holds none');
  assert.equal(C.relayCfgValue({ bossBody: '' }, env, 'bossBody'), '', 'the hub\'s - an empty one too - over the var');
  assert.equal(C.relayCfgValue(null, env, 'gateRole'), '1');
  assert.equal(C.relayCfgValue([], {}, 'sdRole'), undefined);
  assert.equal(C.mayRelayCfg(['dev']), true);
  for (const g of [['dm'], ['shadowfang'], ['mod'], [], null, 'dev']) assert.equal(C.mayRelayCfg(g), false, String(g));
  assert.equal(C.relayCfgSupported('world191'), false, 'main\'s WARDEN1 relay takes none (PIN MOVED: world192 at the merge)'); assert.equal(C.relayCfgSupported('world192'), true); assert.equal(C.relayCfgSupported('x'), false);
  const { parseStaffCommand, STAFF_HELP_LINES } = await import('../../src/net/staffCommands.js');
  assert.deepEqual(parseStaffCommand('/relay'), { cmd: 'relay' });
  assert.deepEqual(parseStaffCommand('/relay bossbody {"enforce": true}'), { cmd: 'relay', k: 'bossBody', v: '{"enforce": true}' });
  assert.deepEqual(parseStaffCommand('/relay gateRole -'), { cmd: 'relay', k: 'gateRole', v: null });
  assert.ok('error' in parseStaffCommand('/relay gateRole'));
  assert.ok('error' in parseStaffCommand('/relay nothing 5'));
  assert.ok(STAFF_HELP_LINES.some((l) => l.startsWith('/relay')));
});

test('SCALE5b the hub keeps a developer\'s setting - in its storage, in force for its herald at once - answers what is now in force, and refuses anyone else in words; outside the hub the frame is junk; a boss\'s room reads the hub\'s at its beat, at most every RELAY_CFG_TTL_MS, and its count runs by it (mutants: the glyph unasked; the setting unkept; the herald kept; the hand-back ignored; the room never asking; asking every beat)', async () => {
  const C = await import('../../src/net/relayCfg.js');
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const W = (await import('../fakeRoom.mjs')).fakeRooms({ now: () => clock });
      const H = W.room('chat:world');
      H.env.GATE_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcDEF_-x';
      H.env.GATE_DISCORD_ROLE = '111111111111111111';
      H.env.BOSS_BODY = '';
      const join = async (id, glyphs) => { const ws = H.connect(); clock += 300; await H.hello(ws, id, null, glyphs ? { glyphs } : {}); assert.equal(ws.closed, null); ws.sent.length = 0; return ws; };
      const dev = await join('dev-0001', ['dev']);
      const dm = await join('dm-0001', ['dm']);
      assert.equal(H.room._heraldOf().role, '111111111111111111', 'the var, while the hub holds nothing');
      const say = async (ws, k, v) => { clock += 5000; await H.raw(ws, JSON.stringify({ t: 'cfg', k, v })); return ws.sent.filter((f) => f.t === 'cfg').at(-1); };
      assert.deepEqual(await say(dm, 'gateRole', '222222222222222222'), { t: 'cfg', k: 'gateRole', error: 'only a developer may change the relay\'s settings' });
      assert.equal(dm.closed, null, 'and nobody struck');
      assert.deepEqual(await say(dev, 'gateRole', '222222222222222222'), { t: 'cfg', k: 'gateRole', v: '222222222222222222' });
      assert.deepEqual(await H.state.storage.get('relaycfg'), { gateRole: '222222222222222222' }, 'kept in the hub\'s storage');
      assert.equal(H.room._heraldOf().role, '222222222222222222', 'the herald\'s at once');
      assert.equal(H.room._heraldOf().serpentRole, '222222222222222222', 'and the roles that fall back to it');
      H.wake();
      assert.equal(H.room._heraldOf().role, '111111111111111111', 'a woken hub, its settings not yet read: the var');
      await H.room._relayCfgOf();
      assert.equal(H.room._heraldOf().role, '222222222222222222', 'a woken hub reads it back - and its herald with it');
      const body = JSON.stringify({ enforce: true, body: { depth: 0.5, perS: 0.02 } });
      const dev2 = await join('dev-0002', ['dev']);
      assert.deepEqual(await say(dev2, 'bossBody', body), { t: 'cfg', k: 'bossBody', v: body });
      // a boss's room: the hub's line at its beat, asked again only past RELAY_CFG_TTL_MS
      const G = W.room('world:9,9');
      G.env.BOSS_BODY = '';
      assert.equal(G.room._bodyLine().enforce, false, 'the var\'s line before it asks');
      let asked = 0;
      const hub = W.made.get('chat:world');
      const fetch0 = hub.room.fetch.bind(hub.room);
      hub.room.fetch = (req) => { if (new URL(req.url).pathname === C.RELAY_INTERNAL_CFG) asked++; return fetch0(req); };
      await G.room._relayCfgFresh(clock);
      assert.equal(asked, 1);
      assert.equal(G.room._bodyLine().enforce, true, 'the hub\'s line, from its beat on');
      assert.equal(G.room._bodyLine().body.depth, 0.5);
      await G.room._relayCfgFresh(clock + C.RELAY_CFG_TTL_MS - 1);
      assert.equal(asked, 1, 'not again inside RELAY_CFG_TTL_MS');
      assert.deepEqual(await say(dev2, 'bossBody', null), { t: 'cfg', k: 'bossBody', v: '' }, 'handed back to the var - which is empty');
      await G.room._relayCfgFresh(clock + C.RELAY_CFG_TTL_MS);
      assert.equal(asked, 2);
      assert.equal(G.room._bodyLine().enforce, false, 'the var\'s again');
      // outside the hub the frame is junk
      const ws = G.connect(); clock += 300; await G.hello(ws, 'dev-0003', null, { glyphs: ['dev'] });
      await G.raw(ws, JSON.stringify({ t: 'cfg', k: 'gateRole', v: '1' }));
      assert.equal(G.room._meterOf(ws).junk, 1);
      assert.equal(await G.state.storage.get('relaycfg'), undefined);
      // every boss's beat asks before it judges: the gate's court, an Abyss realm's Remnant, a serpent's cell
      const relay = src('server/src/index.js');
      for (const tick of ['async _gateTick() {', 'async _sdFightTick() {', 'async _serpentTick() {']) {
        const body = relay.slice(relay.indexOf(tick), relay.indexOf('\n  }\n', relay.indexOf(tick)));
        // PIN MOVED (AUDIT SCALE II R1-2): asked, never awaited - a slow hub froze the beat (test/net/auditscale2_relay.test.js)
        assert.match(body, /const now = Date\.now\(\);\n\s+void this\._relayCfgFresh\(now\);/, `${tick} asks the hub at its beat`);
      }
    });
  } finally { Date.now = realNow; }
});

test('SCALE5b the client: a session sends a relay setting only on the hub\'s link to a relay that takes one, reads the hub\'s answer from the hub alone; the world host runs /relay for a developer alone and hands the answer to the tab that asked (mutants: the version unasked; the answer from any room; the developer unasked)', async () => {
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, rand: () => 0, presence: false });
    const heard = [];
    s.onRelayCfg = (m) => heard.push(m);
    s.join('chat:world');
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world191', now: 1_000_000 });
    assert.equal(s.sendRelayCfg({ k: 'gateRole', v: '1' }), false, 'a relay before it takes none - main\'s WARDEN1 world191 among them (PIN MOVED: world192 at the merge)');
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world192', now: 1_000_000 });
    assert.equal(s.sendRelayCfg({ k: 'gateRole', v: '1' }), true);
    assert.equal(s.sendRelayCfg({ k: 'nope', v: '1' }), false);
    assert.deepEqual(JSON.parse(sockets[0].sent.at(-1)), { t: 'cfg', k: 'gateRole', v: '1' });
    sockets[0].receive({ t: 'cfg', k: 'gateRole', v: '1' });
    assert.deepEqual(heard, [{ k: 'gateRole', v: '1' }]);
  });
  const world = src('src/scenes/world.js');
  assert.match(world, /if \(c\.cmd === 'relay'\) \{[\s\S]{0,300}if \(!mayRelayCfg\(staffGlyphs\(\)\)\) \{ say\('Only a developer may change the relay\\'s settings\.'\); return; \}/);
  assert.match(world, /relayCfgTab = tabId;\s*if \(!relayCfgLink\?\.sendRelayCfg\(\{ k: c\.k, v: c\.v \}\)\)/);
  assert.match(world, /if \(tab\.room === SOCIAL_ROOM\) \{\s*relayCfgLink = link;[^\n]*\n\s*link\.onRelayCfg = \(m\) => chatLog\.push\(relayCfgTab \?\? tab\.id,/);
});

// ═══ PART FIVE: THE RELAY'S WORD OF ITS REFEREES, FOR A HALO ═════════════════════════════════════════════════════════

test('SCALE5b the relay\'s referee word: a cell that judges the poses reaching it - a duel, the Wild zone, a serpent\'s fight - says so in its welcome (`rf`), and when that moves says it to the second wire\'s sockets, once (mutants: the welcome\'s word unsaid; the change unsaid; said every pose; said to the first wire)', async () => {
  const { newWildRef } = await import('../../src/net/wild/wildRef.js');
  await cell(async ({ R, w2, w2b, old, said, speak, rnd }) => {
    const rf = (ws) => ws.sent.filter((f) => f.t === 'rf');
    await speak(said[0], drawn(rnd));
    assert.equal(rf(w2).length, 0, 'nothing to say while nothing judges');
    R.room._wildRef = newWildRef();
    R.room._wildRef.fighters.set('acct-nobody', { id: 'nobody' });
    await speak(said[0], drawn(rnd));
    await speak(said[1], drawn(rnd));
    for (const ws of [w2, w2b]) assert.deepEqual(rf(ws), [{ t: 'rf', on: 1 }], 'said once, as it began');
    assert.deepEqual(rf(old), [], 'never to the first wire');
    const ws = R.connect(); await R.hello(ws, 'late-0001', drawn(rnd), { w2: 1 });
    assert.equal(ws.sent.find((f) => f.t === 'welcome').rf, 1, 'a newcomer\'s welcome says it');
    R.room._wildRef.fighters.clear();
    R.room._serpents = new Map([['s1', { players: {} }]]);
    await speak(said[2], drawn(rnd));
    assert.equal(rf(w2).length, 1, 'a serpent\'s fight judges as the zone did - nothing moved');
    R.room._serpents = new Map();
    await speak(said[2], drawn(rnd));
    assert.deepEqual(rf(w2).at(-1), { t: 'rf', on: 0 }, 'and said as it ended');
    const ws2 = R.connect(); await R.hello(ws2, 'late-0002', drawn(rnd), { w2: 1 });
    assert.equal(ws2.sent.find((f) => f.t === 'welcome').rf, undefined);
  });
});

test('SCALE5b the session hears the relay\'s referee word: a halo whose cell says it judges the poses that reach it (`rf`, its welcome or a later word) hears every pose; one that does not, HALO-THIN\'s due poses alone - main\'s HALO-THIN is the halos\' one law, this word one more reason it goes whole (mutants: the referee word unread; the later word unread)', async () => {
  await quiet(() => {
    const run = ({ rf = false, word = null } = {}) => {
      const { FakeWS, sockets } = fakeSocketClass();
      let t = 1_000_000;
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0 });
      const at = (dx) => ({ x: (BX + 0.5) * PIXEL_UNITS + dx, y: 0, z: (499 - BY + 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0, mv: 1, an: 0 });
      s.join(KEY, at(0));
      s.setHalo([`world:${Math.floor(BX / 16) + 1},${Math.floor(BY / 16)}`]);
      for (const ws of sockets) ws.open();
      const [cellWs, haloWs] = sockets;
      cellWs.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world192', now: t });
      haloWs.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world192', now: t, ...(rf ? { rf: 1 } : {}) });
      const sentPoses = (ws) => ws.sent.filter((x) => x.startsWith('{"t":"pose"')).length;
      const c0 = sentPoses(cellWs), h0 = sentPoses(haloWs);
      const heard = [];
      for (let i = 1; i <= 40; i++) {
        if (word && word[i] !== undefined) haloWs.receive({ t: 'rf', on: word[i] });   // the cell's later word
        t += 110;
        const before = sentPoses(haloWs);
        s.sendPose(at(i * 40));   // a metre a pose: under HALO-THIN's step, in one map pixel
        heard.push(sentPoses(haloWs) > before);
      }
      return { cell: sentPoses(cellWs) - c0, halo: sentPoses(haloWs) - h0, heard };
    };
    const thin = run();
    assert.equal(thin.cell, 40, 'its own cell hears every pose');
    assert.ok(thin.halo > 0 && thin.halo < 10, `a halo whose cell judges nothing hears HALO-THIN's due poses alone (${thin.halo} of 40)`);
    assert.equal(run({ rf: true }).halo, 40, 'a halo whose cell says it judges poses hears every one');
    const turned = run({ word: { 1: 1, 21: 0 } });
    assert.deepEqual(turned.heard.slice(0, 20), Array(20).fill(true), 'a cell that says it judges from now hears every pose from now');
    assert.ok(turned.heard.slice(20).filter(Boolean).length < 5, 'and HALO-THIN\'s due poses again once it says it no longer does');
  });
});
