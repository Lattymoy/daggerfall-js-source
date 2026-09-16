// SLAM11 (2026-09-16, AUDIT SLAM over SLAM1..SLAM7): A FAN LARGER THAN ONE SECOND OF ITS BUDGET COULD NEVER LAND.
//
// `byteGate` is a token bucket CAPPED at `rate`. Three arms charge a whole fan - the frame times its listeners - as
// one indivisible sum against it, and a sum past the cap does not pass slowly: it never passes, however long the
// caller waits, because waiting accumulates nothing beyond the cap. Measured over the real Room, a 100 KiB dungeon
// memory published to a room of N:
//
//     players    fan per publish    sockets handed the memory
//     8          0.7 MiB            7 of 7
//     32         3.0 MiB            31 of 31
//     64         6.2 MiB            0 of 63     <- past the 4 MiB cap, for ever
//     200        19.5 MiB           0 of 199
//
// `worldSeen` latched only inside `if (budget.pass)`, so nothing was remembered and every publish re-attempted the
// same unpayable sum. Doors, levers and emptied containers silently never synced past ~40 players, and the memory
// had to be under ~21 KiB for a full room to receive it at all. Pre-existing (WORLD34 C1 / WORLD2 A5), reachable long
// before the SLAM slices. The act fan had the same cliff at ~5 KiB to 199 listeners, while `actFrameFits` told the
// author anything up to MAX_FRAME_BYTES (16 KiB) would land - and an act is not self-healing; nothing re-sends it.
//
// THE FIX IS A BUCKET THAT CAN BORROW. A must-deliver fan passes when the bucket is not IN DEBT and takes it
// negative by what it costs; nothing else passes until the rate has repaid the debt. The rate law holds on average,
// the debt is bounded by one fan, and the frame lands whole instead of never. The memory push gets its OWN bucket
// besides, because it used to share the foes stream's - and a 100 KiB memory's debt would have blocked live foes
// for seconds. The foes fan itself does NOT borrow: it is a continuous stream where one oversized fan would block
// the next second of frames, and dropping a frame whole is the kinder failure there (the next full frame heals it).
// Its own cliff - a frame the sender cannot make land at this room size - is the sender's to chunk, and is recorded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byteGate, FOES_ROOM_BYTES_PER_S, ACT_ROOM_BYTES_PER_S, MAX_FRAME_BYTES, SOCKETS_MAX } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';

const at = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('SLAM11: a plain bucket can NEVER pass a charge larger than its rate, however long it waits - the cliff, pinned so the reason for borrowing stays true (mutant: the cap removed, which is an unbounded burst)', () => {
  assert.equal(relay.byteGate, byteGate, 'one home, both ends');
  const rate = 1000;
  let b = byteGate(null, 0, 0, rate).bucket;
  for (const wait of [1, 10, 60, 3600]) {
    const r = byteGate(b, wait * 1000, rate + 1, rate);
    assert.equal(r.pass, false, `${wait}s later a charge of rate+1 still cannot pass - the bucket is capped at the rate`);
    assert.equal(r.bucket.bytes, rate, 'and holds exactly the rate, no more');
    b = r.bucket;
  }
  assert.equal(byteGate(b, 10_000, rate, rate).pass, true, 'exactly the rate passes');
});

test('SLAM11: a BORROWING bucket lands a fan larger than its rate whole, goes into debt by it, refuses everything while in debt, and is repaid by the rate (mutants: borrow ignored; the debt not charged; a second frame let through while in debt)', () => {
  const rate = 1000;
  let r = byteGate(null, 0, 5 * rate, rate, true);
  assert.equal(r.pass, true, 'five seconds of budget in one frame: lands');
  assert.equal(r.bucket.bytes, -4 * rate, 'and the bucket is four seconds in debt');
  r = byteGate(r.bucket, 1000, 1, rate, true);
  assert.equal(r.pass, false, 'a second on, still three seconds in debt: even one byte is refused');
  assert.equal(r.bucket.bytes, -3 * rate, 'the rate is repaying it');
  r = byteGate(r.bucket, 4000, 1, rate, true);
  assert.equal(r.pass, true, 'four seconds on: out of debt (bytes = 0), and a frame passes again');
  // the debt is bounded by ONE fan: nothing passes while negative, so it can never be deeper than the last frame
  r = byteGate(null, 0, 100 * rate, rate, true);
  assert.equal(r.pass, true); assert.equal(r.bucket.bytes, -99 * rate);
  assert.equal(byteGate(r.bucket, 0, 1, rate, true).pass, false, 'and nothing stacks on top of it');
  // without borrow the same frame is refused, so the two modes are really two modes
  assert.equal(byteGate(null, 0, 5 * rate, rate).pass, false);
});

test('SLAM11: THE MEMORY LANDS - a room past the old cliff is handed the dungeon\'s memory, on its own bucket, once each (mutant: the indivisible charge against the foes bucket, as it was - 0 of 63 handed it)', async () => {
  const r = fakeRoom('dungeon:m187853213');
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  try {
    const n = 64;   // past the cliff: ~110 KiB x 63 = 6.8 MiB against a 4 MiB cap - under the OLD law not one socket is handed it
    const ws = [];
    for (let i = 0; i < n; i++) { if (i % 7 === 6) clock += 1000; const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, at(1, 1)); ws.push(s); }
    const host = ws[0];
    assert.equal(r.room._hostOf(), 'p0000', 'the first in is the host');
    for (const s of ws) s.sent.length = 0;
    const memory = { ...Object.fromEntries(Array.from({ length: 2200 }, (_, i) => [`door:${i}`, { state: 'open', t: 123456789, lock: 0 }])) };
    const raw = JSON.stringify({ t: 'world', data: memory });
    assert.ok(raw.length > 100 * 1024, `a real dungeon's memory (${raw.length} bytes)`);
    clock += 20_000;   // WORLD_MIN_MS between publishes
    await r.raw(host, raw);
    const handed = ws.slice(1).filter((s) => ofType(s, 'world').length === 1).length;
    assert.equal(handed, n - 1, `every one of the ${n - 1} sockets is handed the memory (${handed})`);
    assert.ok(r.room._roomWorld && r.room._roomWorld.bytes < 0, 'on its OWN bucket, now in debt');
    assert.ok(!r.room._roomFoes || r.room._roomFoes.bytes >= 0, 'and the foes stream\'s bucket was not touched');
    // once each: the next publish hands it to nobody who already has it
    clock += 20_000;
    await r.raw(host, raw);
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'world').length > 1).length, 0, 'nobody is handed it twice');
  } finally { Date.now = realNow; }
});

test('SLAM11/PINS: a REFUSED push latches NOBODY - a socket the memory did not reach is still unseen, and the next publish hands it over once the debt is repaid (mutant: `worldSeen` set on every unseen socket whether or not the frame went, which the committed mutant list found surviving: it makes a refusal permanent)', async () => {
  const r = fakeRoom('dungeon:m187853213');
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  try {
    const ws = [];
    for (let i = 0; i < 6; i++) { const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, at(1, 1)); ws.push(s); }
    const host = ws[0];
    for (const s of ws) s.sent.length = 0;
    const raw = JSON.stringify({ t: 'world', data: { 'door:0': { state: 'open', t: 1, lock: 0 } } });
    clock += 20_000;
    r.room._roomWorld = { bytes: -1, at: clock };   // IN DEBT: the push must be refused
    await r.raw(host, raw);
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'world').length > 0).length, 0, 'refused: nobody handed it');
    for (const s of ws.slice(1)) assert.notEqual(s.att.worldSeen, true, `${s.att.id} is NOT latched as seen - it saw nothing`);
    clock += 20_000;   // the debt repaid by the rate, WORLD_MIN_MS passed
    await r.raw(host, raw);
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'world').length === 1).length, 5, 'the next publish hands it to every one of them');
    for (const s of ws.slice(1)) assert.equal(s.att.worldSeen, true, 'and now they are seen');
  } finally { Date.now = realNow; }
});

test('SLAM11: THE ACT LANDS - an act whose fan costs more than a second of ACT_ROOM_BYTES_PER_S reaches every listener and leaves the bucket in debt; the next act waits for the rate (mutant: the indivisible charge, which dropped it whole and told nobody)', async () => {
  const r = fakeRoom('dungeon:m187853213');
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  try {
    const n = 12;
    const ws = [];
    for (let i = 0; i < n; i++) { if (i % 7 === 6) clock += 1000; const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, at(1, 1)); ws.push(s); }
    for (const s of ws) s.sent.length = 0;
    // a chest cascade: 15 KiB, legal by actFrameFits, to 11 listeners = 165 KiB - so set the bucket to what a full
    // room would leave it, just under the fan's cost, the case the old law could never pass
    const act = { k: 'dungeon:1', l: [{ k: 'loot:3', r: [{ t: 1, pad: 'x'.repeat(15 * 1024) }] }] };
    const frame = JSON.stringify({ t: 'act', data: act });
    assert.ok(frame.length < MAX_FRAME_BYTES, 'the wire admits it');
    clock += 1000;
    r.room._roomActBytes = { bytes: frame.length * (n - 1) - 1, at: clock };   // one byte short of the whole fan
    await r.raw(ws[1], frame);
    assert.equal(ws.slice(2).filter((s) => ofType(s, 'act').length === 1).length, n - 2, 'every listener got the door');
    assert.equal(ofType(ws[0], 'act').length, 1, 'the host too');
    assert.ok(r.room._roomActBytes.bytes < 0, 'the bucket is in debt by the overshoot');
    await r.raw(ws[2], JSON.stringify({ t: 'act', data: { k: 'dungeon:1', a: [{ key: 'door:0', state: 'forward', t: 0, lock: 0, moveState: 'start', moveT: 0 }] } }));
    assert.equal(ofType(ws[0], 'act').length, 1, 'while in debt the next act waits');
    clock += 2000;
    await r.raw(ws[2], JSON.stringify({ t: 'act', data: { k: 'dungeon:1', a: [{ key: 'door:0', state: 'forward', t: 0, lock: 0, moveState: 'start', moveT: 0 }] } }));
    assert.equal(ofType(ws[0], 'act').length, 2, 'repaid: the next act lands');
    assert.ok(MAX_FRAME_BYTES * SOCKETS_MAX <= 4 * ACT_ROOM_BYTES_PER_S, 'the deepest possible act debt is four seconds of acts');
  } finally { Date.now = realNow; }
});

test('SLAM11: the FOES fan does NOT borrow - a continuous stream drops an oversized frame whole so the next frame is not blocked behind its debt (mutant: borrow on the stream, which stalls live foes for seconds after one big frame)', async () => {
  const r = fakeRoom('dungeon:m187853213');
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  try {
    const ws = [];
    for (let i = 0; i < 4; i++) { const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, at(1, 1)); ws.push(s); }
    for (const s of ws) s.sent.length = 0;
    clock += 1000;
    r.room._roomFoes = { bytes: 100, at: clock };   // nearly spent
    const big = JSON.stringify({ t: 'foes', data: { n: 1, full: 1, f: Array.from({ length: 50 }, (_, i) => ({ i, x: 1, y: 0, z: 1, h: 10 })) } });
    await r.raw(ws[0], big);
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'foes').length > 0).length, 0, 'over the budget: the frame is dropped whole, as before');
    assert.ok(r.room._roomFoes.bytes >= 0, 'and the stream\'s bucket is NOT in debt - the next frame is not blocked');
    assert.ok(FOES_ROOM_BYTES_PER_S > 0);
  } finally { Date.now = realNow; }
});
