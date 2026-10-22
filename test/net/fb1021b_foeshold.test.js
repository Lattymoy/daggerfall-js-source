// FOES-HOLD (2026-10-21; bible/11-Multiplayer/Scale-Arc.md FOES-HOLD): A ROOM'S FIRST FRAMES WAIT THEIR TURN. Where a
// room's full frames alone are more than its foes budget (a Starfall's crowd), FOES-FIRST left them first-come and blind
// to size - a refused frame dropped, the next to arrive taking what the bucket had refilled - so one large owner among
// smaller ones heard none of its full frames (tools/foesFirstBench.mjs `stander`: 0%) and the owners the draw passed over
// waited half a minute between theirs. A frame that goes first is now HELD for its turn (server/src/foesHold.js): one line,
// one turn a sender, a newer full frame in its sender's place, nothing of a sender overtaking its own, a held sender beaten
// so its readers keep it, a leaving sender's handovers tried before its leave. Held here over the real Room on the pins'
// fake object, the beat through the real street pool; tools/mutants/fb1021b_foeshold.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom } from '../fakeRoom.mjs';
import { RoomMetrics } from '../../server/src/relayScale.js';
import { createFoesHold, holdFrame, heldHead, heldOf, unhold, served, FOES_HELD_PER_SENDER, FOES_HELD_BYTES_MAX, FOES_TURN_BYTES, FOES_BEAT_SCAN_MS, FOES_LEFT_FLOOR } from '../../server/src/foesHold.js';
import { FOES_FULL_RESERVE, FOES_UNHEARD_MS, FOES_ROOM_BYTES_PER_S, FOES_FULL_MS, FOES_STALE_MS, FOES_FRAME_MAX, PIXEL_UNITS, RELAY_VERSION } from '../../src/net/wire.js';
import { scene, SCENES } from '../../tools/foesFirstBench.mjs';
import { relay as cellRelay, streetPlayer, clock } from './bodyLootHarness.mjs';   // the street pool, mounted as world.js mounts it

const RATE = FOES_ROOM_BYTES_PER_S;
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const nOf = (e) => JSON.parse(e.text).data.n;   // a held frame is kept as the text it came as (AUDIT FOES-HOLD 2)
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
async function onClock(fn) {
  const realNow = Date.now;
  let clockMs = 1_800_000_000_000;
  Date.now = () => clockMs;
  try { return await quiet(() => fn({ now: () => clockMs, tick: (ms) => { clockMs += ms; } })); } finally { Date.now = realNow; }
}
const rec = (i, e = null) => ({ i, x: 1, y: 0, z: 1, h: 10, ...(e ? { e, it: [] } : {}) });
const frameOf = (n, { full = 0, records = 2, pad = 0, hands = null, k = 'world:3,12' } = {}) => JSON.stringify({ t: 'foes', data: { n, k, full, f: Array.from({ length: records }, (_, i) => rec(i, hands)), ...(pad ? { pad: 'p'.repeat(pad) } : {}) } });
async function cellOf(n, { now, tick }, key = 'world:3,12') {
  const R = fakeRoom(key, { now });
  const socks = [];
  for (let i = 0; i < n; i++) { const ws = R.connect(); tick(100); await R.hello(ws, `fh-${String(i).padStart(4, '0')}`, at(1, 1)); socks.push(ws); }
  return { R, socks };
}

test('FOES-HOLD the law (server/src/foesHold.js): a first frame takes a place; a newer full frame of its sender takes the place of its newest held frame that is no handover - its words, never its place - and answers the frame it replaced; a delta of a sender that holds one is refused; a handover waits behind its sender\'s own; past FOES_HELD_PER_SENDER refused; the head is the oldest place; a sent frame\'s sender keeps its turn while the turn\'s frames come to FOES_TURN_BYTES, else its frames take places at the back; a frame unheld unsent ends any turn of its sender (mutants: the place lost on a replacement; the place kept on a refusal; a holding sender\'s delta held; the cap off by one; the head the newest; the turn unbounded; the turn never kept; the replaced frame unanswered)', () => {
  assert.deepEqual([FOES_HELD_PER_SENDER, FOES_HELD_BYTES_MAX, FOES_TURN_BYTES, FOES_BEAT_SCAN_MS, FOES_LEFT_FLOOR], [4, 64 * FOES_FRAME_MAX, 16 * 1024, 250, -2 * FOES_FULL_RESERVE]);
  const A = {}, B = {}, C = {};
  const h = createFoesHold();
  const f = (ws, n, o = {}) => ({ ws, n, length: o.length ?? 100, ranged: true, full: o.full ?? true, hands: o.hands ?? false, at: o.at ?? n });
  const fate = (hold, frame) => holdFrame(hold, frame).fate;
  assert.equal(fate(h, f(A, 1)), 'held');
  assert.equal(fate(h, f(B, 2)), 'held');
  const swap = holdFrame(h, f(A, 3, { length: 140 }));
  assert.equal(swap.fate, 'replaced', 'A\'s newer full frame');
  assert.deepEqual(swap.gone.map((e) => [e.n, e.length, e.full]), [[1, 100, true]], 'answering the frame it replaced, as it was');
  assert.deepEqual(h.entries.map((e) => [e.ws === A ? 'A' : 'B', e.n, e.seq]), [['A', 3, 0], ['B', 2, 1]], 'in A\'s place, with its words');
  assert.equal(h.bytes, 240, 'the bytes its own');
  assert.equal(heldHead(h).n, 3, 'the head the oldest place');
  assert.equal(fate(h, f(A, 4, { full: false })), 'refused', 'a delta of a sender that holds a frame');
  assert.equal(fate(h, f(C, 5, { full: false })), 'held', 'an unheard sender\'s delta takes a place');
  const over = holdFrame(h, f(C, 6));
  assert.deepEqual([over.fate, over.gone.map((e) => [e.n, e.full])], ['replaced', [[5, false]]], 'and its full frame says all it said - the delta it replaced no full frame');
  assert.equal(heldOf(h, C)[0].full, true);
  assert.equal(fate(h, f(B, 7, { hands: true, full: false })), 'held', 'a handover behind its sender\'s own');
  assert.equal(fate(h, f(B, 8)), 'held', 'a full frame behind a handover takes a place of its own - the handover is never replaced');
  assert.deepEqual(heldOf(h, B).map((e) => e.n), [2, 7, 8]);
  assert.equal(fate(h, f(B, 9)), 'replaced', 'the newest no handover');
  assert.equal(fate(h, f(B, 10, { hands: true, full: false })), 'held', 'the fourth');
  assert.equal(heldOf(h, B).length, FOES_HELD_PER_SENDER);
  assert.equal(fate(h, f(B, 11, { hands: true, full: false })), 'refused', 'past FOES_HELD_PER_SENDER');
  // the turn
  const t = createFoesHold();
  holdFrame(t, f(A, 1, { length: 7000 }));
  holdFrame(t, f(B, 2, { length: 7000 }));
  holdFrame(t, f(A, 3, { length: 5000, hands: true, full: false }));
  holdFrame(t, f(A, 4, { length: 5000, hands: true, full: false }));
  served(t, heldHead(t));
  assert.deepEqual([heldHead(t).ws === A, heldHead(t).n], [true, 3], 'A\'s handover in the same turn - 12,000 bytes');
  served(t, heldHead(t));
  assert.deepEqual([heldHead(t).ws === B, heldHead(t).n], [true, 2], 'past FOES_TURN_BYTES (17,000): B\'s turn');
  assert.ok(heldOf(t, A)[0].seq > heldOf(t, B)[0].seq, 'A\'s next at the back');
  served(t, heldHead(t));
  assert.equal(heldHead(t).n, 4, 'then A again');
  const u = createFoesHold();
  holdFrame(u, f(A, 1, { length: 3000 })); holdFrame(u, f(A, 2, { length: 3000, hands: true, full: false })); holdFrame(u, f(B, 3, { length: 3000 }));
  served(u, heldHead(u));
  assert.equal(u.turn.ws, A, 'A\'s turn under way');
  assert.equal(unhold(u, heldHead(u)), true);
  assert.equal(u.turn, null, 'a frame unheld unsent ends its sender\'s turn');
  assert.equal(unhold(u, { ws: A }), false, 'a frame never held');
});

test('FOES-HOLD ROOM IN THE HOLD, made fair (AUDIT FOES-HOLD 2): past FOES_HELD_BYTES_MAX a frame takes its room from the sender holding the most, while that one holds more than the frame\'s sender will - its newest frame that is no handover first, a handover only when it holds nothing else; a frame that would hold as much as anyone is refused, and a refusal takes nothing (mutants: FH-room-never-made; FH-room-from-the-least; FH-room-past-the-taker; FH-room-takes-the-handover-first; FH-room-taken-on-a-refusal; FH-room-cap-off-by-one)', () => {
  const A = {}, B = {}, C = {}, D = {};
  const f = (ws, n, o = {}) => ({ ws, n, length: o.length ?? 100, ranged: true, full: o.full ?? true, hands: o.hands ?? false, at: n });
  const M = FOES_HELD_BYTES_MAX;
  const h = createFoesHold();
  assert.equal(holdFrame(h, f(A, 1, { length: M - 10 })).fate, 'held');
  assert.deepEqual([holdFrame(h, f(B, 2, { length: 10 })).fate, h.bytes], ['held', M], 'to the cap, held - nothing taken');
  assert.equal(heldOf(h, A).length, 1);
  const r = holdFrame(h, f(C, 3, { length: 1 }));
  assert.deepEqual([r.fate, r.gone.map((e) => e.n)], ['held', [1]], 'one byte past it: the room from A, who holds the most');
  assert.equal(h.bytes, 11);
  // the most, each time; never below what the frame's own sender will hold
  const g = createFoesHold();
  holdFrame(g, f(A, 1, { length: M / 4 })); holdFrame(g, f(A, 2, { length: M / 4, hands: true, full: false }));
  holdFrame(g, f(B, 3, { length: M / 4 })); holdFrame(g, f(C, 4, { length: M / 4 - 100 }));
  const before = { entries: g.entries.length, bytes: g.bytes };
  const refused = holdFrame(g, f(D, 5, { length: M / 2 + 1 }));
  assert.deepEqual([refused.fate, refused.gone], ['refused', []], 'a frame that would hold more than anyone but A, and A cut below it - refused');
  assert.deepEqual({ entries: g.entries.length, bytes: g.bytes }, before, 'and nothing taken');
  const fair = holdFrame(g, f(D, 6, { length: 300 }));
  assert.deepEqual([fair.fate, fair.gone.map((e) => [e.n, e.hands])], ['held', [[1, false]]], 'from A, the most: its full frame, its handover kept');
  assert.deepEqual(heldOf(g, A).map((e) => e.n), [2]);
  assert.equal(holdFrame(g, f(D, 7, { length: M / 4, hands: true, full: false })).fate, 'refused', 'A, B and C a quarter or less, D to hold more than that: no room made');
  const k = createFoesHold();
  holdFrame(k, f(A, 1, { length: M - 50, hands: true, full: false })); holdFrame(k, f(B, 2, { length: 10 }));
  const last = holdFrame(k, f(C, 3, { length: 100 }));
  assert.deepEqual([last.fate, last.gone.map((e) => [e.n, e.hands])], ['held', [[1, true]]], 'a handover, when it is all the most has');
  const most = createFoesHold();
  holdFrame(most, f(A, 1, { length: 2000 })); holdFrame(most, f(B, 2, { length: M - 3000 }));
  assert.deepEqual(holdFrame(most, f(C, 3, { length: 1500 })).gone.map((e) => e.n), [2], 'from the one holding the most, not the first holding more');
  const part = createFoesHold();
  holdFrame(part, f(A, 1, { length: 1000 })); holdFrame(part, f(A, 2, { length: M / 4 - 10, hands: true, full: false }));
  holdFrame(part, f(B, 3, { length: M / 4 })); holdFrame(part, f(C, 4, { length: M / 4 })); holdFrame(part, f(D, 5, { length: M / 4 - 990 }));
  const kept = part.entries.map((e) => e.n);
  assert.deepEqual(holdFrame(part, f({}, 6, { length: M / 4 })), { fate: 'refused', gone: [] }, 'A\'s full frame would not make the room, and no one else holds more');
  assert.deepEqual(part.entries.map((e) => e.n), kept, 'so none is taken');
  // a replacement makes its room as a frame does
  const p = createFoesHold();
  holdFrame(p, f(A, 1, { length: M - 1000 })); holdFrame(p, f(B, 2, { length: 1000 }));
  const grow = holdFrame(p, f(B, 3, { length: 2000 }));
  assert.deepEqual([grow.fate, grow.gone.map((e) => e.n)], ['replaced', [2, 1]], 'B\'s newer, larger list: the one it replaced, and room from A');
  const q = createFoesHold();
  holdFrame(q, f(A, 1, { length: M / 2 })); holdFrame(q, f(B, 2, { length: M / 2 }));
  assert.deepEqual(holdFrame(q, f(B, 3, { length: M / 2 + 1 })), { fate: 'refused', gone: [] }, 'a replacement no room is made for: refused, the older kept');
  assert.equal(heldOf(q, B)[0].n, 2);
});

test('FOES-HOLD THE LINE over the real Room: a full frame the budget refuses is held, and goes first once the bucket holds it - before a smaller full frame that came after it and would have fitted, which waits its turn behind it; while any frame is held no delta passes; a holding sender\'s delta is dropped and its newer full frame goes in its place, never the older; each to the listeners its sender has where it stands at its turn (mutants: FH-delta-passes-a-held-frame; FH-drain-unasked; FH-a-small-frame-jumps-the-line; FH-replacement-drops-the-place; FH-drain-floor-at-zero)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(24, clk);
    const [L, S, D] = socks;
    const heard = (ws) => socks.filter((o) => o !== ws && ofType(o, 'foes').some((m) => m.id === R.room._attach(ws).id && m.data.n !== undefined)).length;   // a numbered frame - a beat carries none
    const clear = () => { for (const s of socks) s.sent.length = 0; };
    clk.tick(5000);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    for (const ws of [L, S, D]) await R.raw(ws, frameOf(0, { full: 0 }));   // each heard once: no sender here goes first for being unheard
    clk.tick(200); clear();
    const bigFan = (frameOf(1, { full: 1, pad: 60_000 }).length + 15) * 23;
    assert.ok(bigFan > FOES_FULL_RESERVE && bigFan < RATE + FOES_FULL_RESERVE, `the large frame's fan past what an empty bucket affords, inside what a full one does (${bigFan})`);
    R.room._roomFoes = { bytes: 0, at: clk.now() };
    await R.raw(L, frameOf(1, { full: 1, pad: 60_000 }));
    assert.equal(heard(L), 0, 'the large full frame: refused');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 1, 'and held');
    clk.tick(10);
    await R.raw(S, frameOf(2, { full: 1 }));
    assert.equal(heard(S), 0, 'a small full frame that fits waits behind it');
    clk.tick(10);
    await R.raw(D, frameOf(3, { full: 0 }));
    assert.equal(heard(D), 0, 'a delta passes no held frame');
    await R.raw(L, frameOf(4, { full: 0 }));
    assert.equal(heard(L), 0, 'nor its sender\'s own');
    clk.tick(1100);
    R.room._roomFoes = { bytes: 0, at: clk.now() };   // still short of the large fan
    await R.raw(L, frameOf(5, { full: 1, pad: 60_000 }));
    assert.deepEqual(R.room._foesHoldOf('foes').entries.map(nOf), [5, 2], 'L\'s newer full frame in L\'s place');
    clk.tick(1);
    clear();
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    await R.raw(D, frameOf(6, { full: 0 }));
    assert.deepEqual(ofType(socks[5], 'foes').map((m) => m.data.n), [5, 2, 6], 'its turn: the large one first, in its newest words, then the small one, then the delta');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 0);
    const c = R.room._metrics.c;
    assert.ok(c.held >= 3 && c.heldSent === 2, `held ${c.held}, sent ${c.heldSent}`);
  });
});

test('FOES-HOLD NOTHING PASSES A HELD FRAME, AND A HELD FRAME BORROWS: with a fan too large for the bucket waiting, a delta the reserve would afford is dropped all the same; the held frame goes once the bucket holds its fan down to minus FOES_FULL_RESERVE - borrowing, not waiting for a whole one; a newer full frame of its sender inside its cadence takes its place in the line, the older never sent (mutants: FH-delta-passes-a-held-frame; FH-drain-floor-at-zero; FH-newer-full-dropped-inside-the-cadence)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(48, clk);
    const [L, D] = socks;
    const clear = () => { for (const s of socks) s.sent.length = 0; };
    clk.tick(5000);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    for (const ws of [L, D]) await R.raw(ws, frameOf(0, { full: 0 }));
    clk.tick(1200); clear();
    const fan = (frameOf(1, { full: 1, pad: 60_000 }).length + 15) * 47;
    assert.ok(fan > 2 * FOES_FULL_RESERVE + 10_000 && fan < RATE + FOES_FULL_RESERVE, `a fan past twice the reserve (${fan})`);
    R.room._roomFoes = { bytes: 0, at: clk.now() };
    await R.raw(L, frameOf(1, { full: 1, pad: 60_000 }));
    clk.tick(300);
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE + 50_000, at: clk.now() };   // the delta's floor and room for it - short of the held fan
    await R.raw(D, frameOf(2, { full: 0 }));
    assert.equal(ofType(socks[5], 'foes').length, 0, 'a delta the reserve affords passes no held frame');
    clk.tick(10);
    R.room._roomFoes = { bytes: 0, at: clk.now() };
    await R.raw(L, frameOf(3, { full: 1, pad: 60_000 }));   // inside its cadence: a delta to the budget - and its sender's newer list
    assert.deepEqual(R.room._foesHoldOf('foes').entries.map(nOf), [3], 'a newer full frame inside the cadence takes its sender\'s place');
    clk.tick(10);
    R.room._roomFoes = { bytes: fan - FOES_FULL_RESERVE / 2, at: clk.now() };   // short of the whole fan, past it less the reserve
    await R.raw(D, frameOf(4, { full: 0 }));
    assert.deepEqual(ofType(socks[5], 'foes').map((m) => m.data.n), [3], 'the held frame goes, borrowing - its newest words; the delta behind it within its floor or not');
    assert.ok(R.room._roomFoes.bytes >= -FOES_FULL_RESERVE && R.room._roomFoes.bytes < 0, 'into the debt the reserve bounds');
    clk.tick(730);   // FOES_FIRST_MS and 50 after L's turn was taken - its frame 3 took L's place, and spent no turn
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: clk.now() };   // the deltas' floor
    await R.raw(L, frameOf(5, { full: 1 }));
    assert.deepEqual(ofType(socks[5], 'foes').map((m) => m.data.n), [3, 5], 'L\'s next turn, first past the reserve (mutants: FF-turn-on-any-full)');
  });
});

test('FOES-HOLD A HELD SENDER IS STILL HEARD: a sender whose frames wait while it streams is beaten once its readers have heard nothing of it for FOES_UNHEARD_MS - an empty frame of its own, `{ f: [] }` and its held frame\'s `k` when that is a room key\'s shape, no number, no `full` - once each FOES_UNHEARD_MS, charged to the budget a listener\'s worth each, never past the first frames\' floor (owed still, it goes at the next scan the budget holds it); a sender gone quiet past FOES_FULL_MS is not; and the street pool takes the beat as its owner heard - its record kept past FOES_STALE_MS, its counter unmoved, nothing swept (mutants: FH-beat-unasked; FH-beat-every-scan; FH-beat-for-a-quiet-sender; FH-beat-numbered; FH-beat-uncounted; FH-beat-uncharged; FH-beat-past-the-floor; FH-beat-stamped-unsent; FH-beat-any-key)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(6, clk);
    const [H, B] = socks;
    clk.tick(5000);
    const room = (bytes = -FOES_FULL_RESERVE + 4000) => { R.room._roomFoes = { bytes, at: clk.now() }; };   // never a held frame's fan: a beat's, or a few
    const big = (n, o = {}) => frameOf(n, { full: 1, pad: 60_000, ...o });
    room();
    await R.raw(H, big(1));
    assert.equal(R.room._foesHoldOf('foes').entries.length, 1, 'held');
    const beats = () => ofType(socks[3], 'foes').filter((m) => m.id === 'fh-0000' && m.data.n === undefined);
    const stream = (n, t, o = {}) => (t % FOES_FULL_MS === 0 ? big(n + t, o) : frameOf(n + t, { full: 0, ...o }));   // world.js foesStream: every FOES_MS, whole every FOES_FULL_MS
    const step = async (n, t, bytes, o) => { clk.tick(200); room(bytes); const was = beats().length; await R.raw(H, stream(n, t, o)); return { beat: beats().length > was, left: R.room._roomFoes.bytes }; };
    const steps = [];
    for (let t = 200; t <= FOES_UNHEARD_MS + 2000; t += 200) steps.push(await step(2, t));
    const said = beats();
    assert.equal(said.length, 1, `one beat in ${FOES_UNHEARD_MS + 2000} ms`);
    assert.deepEqual(said[0], { t: 'foes', id: 'fh-0000', data: { f: [], k: 'world:3,12' } }, 'an empty frame of its own: its held frame\'s k, no number, no full');
    assert.equal(R.room._metrics.c.beats, 1);
    const cost = JSON.stringify(said[0]).length * (socks.length - 1);
    assert.deepEqual(steps.filter((x) => x.beat).map((x) => x.left), [-FOES_FULL_RESERVE + 4000 - cost], 'charged to the budget: its bytes to each listener (AUDIT FOES-HOLD 1)');
    const scans = [];
    for (let i = 0; i < 20; i++) { clk.tick(20); room(); await R.raw(H, frameOf(50_000 + i, { full: 0 })); scans.push(R.room._foesHoldOf('foes').beatAt); }
    const at = [...new Set(scans)];
    assert.ok(at.length >= 2 && at.every((t, i) => i === 0 || t - at[i - 1] >= FOES_BEAT_SCAN_MS), `twenty frames in 400 ms: the held senders asked at most each FOES_BEAT_SCAN_MS (${at.map((t) => t - at[0])})`);
    for (let t = 200; t <= FOES_UNHEARD_MS; t += 200) await step(90_000, t);
    assert.equal(beats().length, 2, 'the next FOES_UNHEARD_MS on');
    // the room at the first frames' floor: the beat owed, not sent, and owed still
    for (let t = 200; t <= FOES_UNHEARD_MS + 1000; t += 200) await step(150_000, t, -FOES_FULL_RESERVE + 10);
    assert.equal(beats().length, 2, 'a beat the budget cannot take to its floor is not sent');
    assert.ok(R.room._roomFoes.bytes >= -FOES_FULL_RESERVE, 'nor put the room past it');
    await step(160_000, 200); await step(160_000, 400);
    assert.equal(beats().length, 3, 'at the next scan the budget holds it, it goes - owed still, its clock not stamped');
    // a sender gone quiet: B held, then silent; H's frames keep the lane asked
    clk.tick(FOES_FULL_MS);   // H's own frames go on below; B says nothing past its one
    room();
    await R.raw(B, big(200_000));
    const bBeats = () => ofType(socks[3], 'foes').filter((m) => m.id === 'fh-0001' && m.data.n === undefined).length;
    for (let t = 200; t <= FOES_UNHEARD_MS + 2000; t += 200) await step(300_000, t);
    assert.equal(bBeats(), 0, 'a sender that streams no longer is not beaten - its readers let it go as they did');
  });
  // the key: the frame's own word, repeated only in a room key's shape (AUDIT FOES-HOLD 1: 58 KB of it, a beat each 4 s to every listener)
  for (const [k, want] of [['x'.repeat(81), undefined], ['world:3,12 <b>', undefined], [{ room: 'world:3,12' }, undefined], ['dungeon:m12345.s', 'dungeon:m12345.s']]) {
    await onClock(async (clk) => {
      const { R, socks } = await cellOf(4, clk);
      clk.tick(5000);
      const room = () => { R.room._roomFoes = { bytes: -FOES_FULL_RESERVE + 4000, at: clk.now() }; };
      room();
      await R.raw(socks[0], frameOf(1, { full: 1, pad: 60_000, k }));
      for (let t = 200; t <= FOES_UNHEARD_MS + 400; t += 200) { clk.tick(200); room(); await R.raw(socks[0], frameOf(1 + t, { full: 0, k })); }
      const beat = ofType(socks[2], 'foes').filter((m) => m.data.n === undefined);
      assert.equal(beat.length, 1, `beaten (${JSON.stringify(k).slice(0, 20)})`);
      assert.deepEqual(beat[0].data, want === undefined ? { f: [] } : { f: [], k: want }, `the key ${want === undefined ? 'left off' : 'kept'}`);
    });
  }
  // the reader: the street pool (scenes/exteriorFoes.js applyFoes, pruneOwners), the owner's frame its own pool's mint
  const net = cellRelay();
  const owner = streetPlayer(net, 'own-0001', [30, 0, 30]);
  const reader = streetPlayer(net, 'rdr-0002', [11, 0, 11]);
  const alive = new Set(['own-0001']);
  const rat = await owner.pool().spawnFoe(0, [12, 0, 12], { feetGiven: true });
  assert.ok(rat, 'the owner\'s foe stands');
  const first = owner.frame(true);
  reader.foes('own-0001', first);
  const stands = () => reader.pool().foes.some((x) => x.puppet === 'own-0001' && !x.dead);
  for (let i = 0; i < 40 && !stands(); i++) await new Promise((r) => setTimeout(r, 0));
  assert.ok(stands(), 'its puppet stands at the reader');
  clock.t += FOES_UNHEARD_MS;
  assert.equal(reader.foes('own-0001', { f: [], k: first.k }), true, 'the beat lands');
  clock.t += FOES_STALE_MS - FOES_UNHEARD_MS + 500;
  reader.prune(alive);
  assert.ok(stands(), 'kept past FOES_STALE_MS of its last numbered frame - and nothing swept');
  const next = owner.frame(true);
  assert.equal(next.n, first.n + 1);
  assert.equal(reader.foes('own-0001', next), true, 'its counter unmoved: the held frame that comes in its turn is taken');
  clock.t += FOES_STALE_MS + 1;
  reader.prune(alive);
  assert.equal(stands(), false, 'without a word, let go as before');
});

test('FOES-HOLD A SENDER LEAVING: its held handover is tried before its leave is said - on its lane\'s budget to FOES_LEFT_FLOOR, one reserve past the first frames\' floor the line keeps the bucket near, never deeper - and its other held frames go with it; a handover is never aged out, a full frame FOES_STALE_MS old leaves the hold unsent - its newest words\' age, not its place\'s (mutants: FH-leave-untried; FH-leave-after-the-word; FH-leave-borrows-deeper; FH-leave-at-the-first-floor; FH-handover-aged-out; FH-full-never-aged; FH-stale-by-its-place)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(6, clk);
    const [O] = socks;
    clk.tick(5000);
    R.room._roomFoes = { bytes: -FOES_FULL_RESERVE + 10, at: clk.now() };
    await R.raw(O, frameOf(1, { full: 1 }));
    await R.raw(O, frameOf(2, { hands: 'fh-0003' }));
    assert.equal(heldOf(R.room._foesHoldOf('foes'), O).length, 2, 'both held');
    clk.tick(300);   // the bucket refills past a handover's fan
    await R.drop(O);
    const words = socks[2].sent.filter((m) => m.t === 'foes' || m.t === 'leave').map((m) => (m.t === 'leave' ? 'leave' : m.data.n));
    assert.deepEqual(words, [2, 'leave'], 'the handover, then the leave - the full frame gone with its sender');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 0);
    assert.ok(R.room._roomFoes.bytes >= FOES_LEFT_FLOOR, 'no deeper than its floor');
    // at the first frames' floor, where a crowded room's line keeps the bucket (AUDIT FOES-HOLD 3): the leaver borrows one reserve more
    const [, P, , Q] = socks;
    R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 };
    await R.raw(P, frameOf(3, { hands: 'fh-0003' }));
    assert.equal(heldOf(R.room._foesHoldOf('foes'), P).length, 1, 'held at the first frames\' floor');
    await R.drop(P);
    assert.equal(socks[2].sent.filter((m) => m.t === 'foes' && m.data.n === 3).length, 1, 'heard at its leave');
    assert.ok(R.room._roomFoes.bytes < -FOES_FULL_RESERVE && R.room._roomFoes.bytes >= FOES_LEFT_FLOOR, 'past the first frames\' floor, to its own');
    // a leave the budget cannot afford even so: nothing borrowed past it
    R.room._roomFoes = { bytes: FOES_LEFT_FLOOR, at: clk.now() + 10_000 };
    await R.raw(Q, frameOf(4, { hands: 'fh-0002' }));
    await R.drop(Q);
    assert.equal(socks[2].sent.filter((m) => m.t === 'foes' && m.data.n === 4).length, 0, 'refused at FOES_LEFT_FLOOR');
    assert.ok(R.room._roomFoes.bytes >= FOES_LEFT_FLOOR, 'never put the room deeper in debt');
  });
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(6, clk);
    const [A, B, C] = socks;
    clk.tick(5000);
    const starve = () => { R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 }; };
    starve();
    await R.raw(A, frameOf(1, { full: 1 }));
    await R.raw(B, frameOf(2, { hands: 'fh-0002' }));
    clk.tick(FOES_STALE_MS + 1); starve();
    await R.raw(C, frameOf(3, { full: 0 }));
    const left = R.room._foesHoldOf('foes').entries.map(nOf);
    assert.deepEqual(left.filter((n) => n < 3), [2], 'the full frame FOES_STALE_MS old gone unsent, the handover kept');   // (C, unheard on this instance, holds its own word behind them)
    assert.ok(R.room._metrics.c.heldGone >= 1);
  });
  await onClock(async (clk) => {
    // its age is its newest words': a frame that took an older one's place is as old as they are
    const { R, socks } = await cellOf(4, clk);
    const [D, E] = socks;
    clk.tick(5000);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    const starve = () => { R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 }; };
    starve();
    await R.raw(D, frameOf(10, { full: 1 }));
    clk.tick(FOES_STALE_MS - 1000); starve();
    await R.raw(D, frameOf(11, { full: 1 }));
    assert.deepEqual(R.room._foesHoldOf('foes').entries.map(nOf), [11], 'D\'s newer words in its place, at the head');
    clk.tick(2000); starve();
    await R.raw(E, frameOf(12, { full: 0 }));
    assert.deepEqual(heldOf(R.room._foesHoldOf('foes'), D).map(nOf), [11], 'its place FOES_STALE_MS old, its words not: kept');
    clk.tick(FOES_STALE_MS); starve();
    await R.raw(E, frameOf(13, { full: 0 }));
    assert.equal(heldOf(R.room._foesHoldOf('foes'), D).length, 0, 'its words FOES_STALE_MS old: gone');
  });
});

test('FOES-HOLD THE LINE MOVES: a frame whose fan no bucket can take (FOES_ROOM_BYTES_PER_S and the reserve) is dropped - at once with nothing held, at its turn when it was held behind others (its fan is asked at the head) - and the line moves on to the frame behind it; a frame sent from the hold hears its sender (mutants: FH-unaffordable-fan-held; FH-oversize-head-blocks-the-line; FH-oversize-head-uncounted; FH-drained-frame-leaves-its-sender-unheard)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(84, clk);
    const [S, X, C, W] = socks;
    clk.tick(5000);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    for (const ws of [S, X, C, W]) await R.raw(ws, frameOf(0, { full: 0 }));
    clk.tick(1200);
    for (const o of socks) o.sent.length = 0;
    const huge = (n) => frameOf(n, { full: 1, pad: 65_000 });
    assert.ok(huge(1).length <= FOES_FRAME_MAX && (huge(1).length + 15) * 83 > RATE + FOES_FULL_RESERVE, 'a frame the wire takes, whose fan to this room no bucket can');
    const c = R.room._metrics.c;
    R.room._roomFoes = { bytes: 0, at: clk.now() };
    const drops = c.fullDrops;
    await R.raw(X, huge(1));
    assert.deepEqual([R.room._foesHoldOf('foes').entries.length, c.fullDrops - drops], [0, 1], 'nothing held: dropped at once, never held');
    clk.tick(1100);
    R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 };
    await R.raw(S, frameOf(2, { full: 1 }));
    await R.raw(X, huge(3));
    await R.raw(C, frameOf(4, { full: 1 }));
    assert.deepEqual(R.room._foesHoldOf('foes').entries.map(nOf), [2, 3, 4], 'held behind another, its fan unasked');
    clk.tick(10);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    const gone = c.heldGone;
    await R.raw(W, frameOf(5, { full: 0 }));
    assert.deepEqual(ofType(socks[9], 'foes').map((m) => m.data.n), [2, 4, 5], 'at its turn, dropped - and the line moved on');
    assert.deepEqual([R.room._foesHoldOf('foes').entries.length, c.heldGone - gone], [0, 1], 'counted gone');
    assert.equal(R.room._foesLane(S, 'foes').heard, clk.now(), 'the sender of a frame sent from the hold, heard');
  });
});

test('FOES-HOLD THE OWN LANE (a world room\'s, OWN1): held, beaten and tried at a leave as the cell\'s foes lane is - on its own budget (`_roomOwn`), the foes lane\'s untouched (mutants: FH-own-leave-on-the-foes-budget; FH-own-unheld)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(5, clk, 'dungeon:m123');
    const [O, P] = socks;
    clk.tick(5000);
    const own = (n, o = {}) => frameOf(n, o).replace('{"t":"foes"', '{"t":"own"');
    const room = (bytes = -FOES_FULL_RESERVE + 4000) => { R.room._roomOwn = { bytes, at: clk.now() }; };
    const foes = { bytes: 123_456, at: clk.now() + 600_000 };
    R.room._roomFoes = foes;
    room();
    await R.raw(O, own(1, { full: 1, pad: 60_000 }));
    assert.equal(R.room._foesHoldOf('own').entries.length, 1, 'held on its own lane');
    assert.equal(R.room._foesHolds.foes, undefined, 'the foes lane holds nothing');
    for (let t = 200; t <= FOES_UNHEARD_MS + 400; t += 200) { clk.tick(200); room(); await R.raw(O, own(1 + t, { full: 0 })); }
    assert.deepEqual(socks[2].sent.filter((m) => m.t === 'own' && m.id === 'fh-0000' && m.data.n === undefined).map((m) => m.data), [{ f: [], k: 'world:3,12' }], 'beaten on its lane');
    room(-FOES_FULL_RESERVE);
    await R.raw(P, own(10_000, { hands: 'fh-0002' }));
    assert.equal(heldOf(R.room._foesHoldOf('own'), P).length, 1);
    await R.drop(P);
    assert.equal(socks[2].sent.filter((m) => m.t === 'own' && m.data.n === 10_000).length, 1, 'its handover heard at its leave');
    assert.ok(R.room._roomOwn.bytes < -FOES_FULL_RESERVE, 'on the own lane\'s budget');
    assert.equal(R.room._roomFoes, foes, 'the foes lane\'s untouched');
  });
});

test('FOES-HOLD THE HOLD COUNTED (AUDIT FOES-HOLD 6): the frames held are the held sent, the held gone and the still held - a frame replaced counted gone, a full frame among the drops only when the one replaced was full, a frame junk at its turn gone and never sent; and a held frame is kept as the text it came as, nothing parsed (mutants: FH-replaced-uncounted; FH-replaced-delta-a-full-drop; FH-hold-keeps-the-parse; FH-text-unparsed-at-the-turn; FH-junk-counted-sent)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(5, clk);
    const [A, B] = socks;
    const c = R.room._metrics.c;
    clk.tick(5000);
    const starve = () => { R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 }; };
    starve();
    await R.raw(A, frameOf(1, { full: 0 }));   // unheard: its delta goes first, held
    const was = { gone: c.heldGone, drops: c.drops, full: c.fullDrops };
    clk.tick(10); starve();
    await R.raw(A, frameOf(2, { full: 1 }));
    assert.deepEqual([c.heldGone - was.gone, c.drops - was.drops, c.fullDrops - was.full], [1, 1, 0], 'the delta replaced: gone, a drop, no full one');
    clk.tick(1100); starve();
    await R.raw(A, frameOf(3, { full: 1 }));
    assert.deepEqual([c.heldGone - was.gone, c.drops - was.drops, c.fullDrops - was.full], [2, 2, 1], 'a full frame replaced: a full drop');
    await R.raw(B, frameOf(4, { full: 1 }));
    for (const e of R.room._foesHoldOf('foes').entries) {
      assert.equal(typeof e.text, 'string');
      assert.ok(Object.entries(e).every(([key, v]) => key === 'ws' || v === null || typeof v !== 'object'), `nothing parsed kept (${Object.keys(e)})`);
    }
    const C = socks[2];
    await R.raw(C, '{"t":"foes","data":{"n":5,"full":1,"f":[{"i":0,"x":1e20,"y":0,"z":1,"h":10}]}}');   // grows as it is re-serialised: junk at its turn
    const sent = c.heldSent, gone = c.heldGone;
    clk.tick(10);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    await R.raw(socks[3], frameOf(6, { full: 0 }));
    assert.deepEqual(ofType(socks[4], 'foes').map((m) => m.data.n), [3, 4, 6], 'the held, parsed again at their turn, in their words - the junk to nobody');
    assert.deepEqual([c.heldSent - sent, c.heldGone - gone], [2, 1], 'two sent, the junk gone');
    assert.equal(c.held, c.heldSent + c.heldGone + R.room._foesHoldOf('foes').entries.length, `held ${c.held} = sent ${c.heldSent} + gone ${c.heldGone} + held`);
  });
});

test('FOES-HOLD ROOM IN THE HOLD over the real Room (AUDIT FOES-HOLD 2): sixteen sockets holding the hold full of the largest handovers the wire takes cannot shut an honest owner out - its full frame finds a place, room taken from the most; and the bytes the hold counts are the text it keeps', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(26, clk);
    clk.tick(5000);
    const starve = () => { R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 }; };
    const hostile = socks.slice(0, 16), H = socks[20];
    let n = 0;
    for (let round = 0; round < FOES_HELD_PER_SENDER; round++) for (const ws of hostile) { clk.tick(20); starve(); await R.raw(ws, frameOf(++n, { hands: 'fh-0025', pad: 65_200 })); }
    const hold = R.room._foesHoldOf('foes');
    const honest = frameOf(10_000, { full: 1, records: 20, pad: 12_000 });   // a star owner's list
    assert.ok(hold.entries.length === 64 && FOES_HELD_BYTES_MAX - hold.bytes < honest.length, `the hold full past the honest frame (${hold.bytes})`);
    assert.equal(hold.bytes, hold.entries.reduce((sum, e) => sum + e.text.length, 0), 'its bytes the text it keeps');
    const gone = R.room._metrics.c.heldGone;
    clk.tick(20); starve();
    await R.raw(H, honest);
    assert.deepEqual(heldOf(hold, H).map(nOf), [10_000], 'the honest owner\'s full frame held (first come, first served, it was refused)');
    assert.deepEqual([R.room._metrics.c.heldGone - gone, hold.entries.length, hold.bytes <= FOES_HELD_BYTES_MAX], [1, 64, true], 'one of the most\'s frames gone for it');
  });
});

test('FOES-HOLD THE LAW HOLDS, at random (a persistent hold over the real Room): senders streaming deltas, full frames and handovers of every size, the budget starved and refilled, senders leaving - every reader hears each sender\'s frames in their order, never one past a newer; the hold never past its bytes or a sender\'s four; the budget never past FOES_LEFT_FLOOR, nor past the first frames\' floor but at a leave; the held are the sent, the gone and the still held', async () => {
  let seed = 0x5eed;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  for (let run = 0; run < 3; run++) {
    await onClock(async (clk) => {
      const { R, socks } = await cellOf(10, clk);
      clk.tick(5000);
      const n = new Map(socks.map((ws) => [ws, 0]));
      const live = new Set(socks);
      const c = R.room._metrics.c;
      for (let step = 0; step < 500; step++) {
        clk.tick(5 + Math.floor(rnd() * 150));
        const roll = rnd();
        if (roll < 0.6) R.room._roomFoes = { bytes: -FOES_FULL_RESERVE + Math.floor(rnd() * 300_000), at: clk.now() };   // a crowded room's budget, near the first frames' floor
        const ws = [...live][Math.floor(rnd() * live.size)];
        let left = false;
        if (roll > 0.995 && live.size > 4) { await R.drop(ws); live.delete(ws); left = true; } else {
          const kind = rnd();
          const hands = kind < 0.12, full = !hands && kind < 0.4;
          n.set(ws, n.get(ws) + 1);
          await R.raw(ws, frameOf(n.get(ws), { full: full ? 1 : 0, hands: hands ? 'fh-0009' : null, records: 1 + Math.floor(rnd() * 20), pad: rnd() < 0.3 ? Math.floor(rnd() * 60_000) : 0 }));
        }
        const hold = R.room._foesHoldOf('foes');
        assert.equal(hold.bytes, hold.entries.reduce((sum, e) => sum + e.length, 0));
        assert.ok(hold.bytes <= FOES_HELD_BYTES_MAX);
        for (const s of live) assert.ok(heldOf(hold, s).length <= FOES_HELD_PER_SENDER);
        const b = R.room._roomFoes?.bytes ?? 0;
        assert.ok(b >= (left ? FOES_LEFT_FLOOR : -FOES_FULL_RESERVE), `run ${run} step ${step}: the budget at ${b}${left ? ' (a leave)' : ''}`);
        assert.equal(c.held, c.heldSent + c.heldGone + hold.entries.length, `run ${run} step ${step}: the hold counted`);
      }
      for (const reader of live) {
        const last = new Map();
        for (const m of ofType(reader, 'foes')) {
          if (m.data.n === undefined) continue;   // a beat
          assert.ok(m.data.n > (last.get(m.id) ?? 0), `run ${run}: ${m.id}'s ${m.data.n} after its ${last.get(m.id)}`);
          last.set(m.id, m.data.n);
        }
      }
      assert.ok(c.held > 20 && c.heldSent > 10, `the hold in use (held ${c.held}, sent ${c.heldSent}, gone ${c.heldGone})`);
    });
  }
});

test('FOES-HOLD A STAR, measured (tools/foesFirstBench.mjs over the real Room): the stander - one owner of 48 records among 39 of 24 - hears its full frames as often as the rest (0% before), every owner\'s full frames come round inside FOES_STALE_MS (37 s apart at the 99th before); at the record cap no owner unheard past its readers\' patience; an owner handing on three batches at once is heard whole, and so is every owner handing on its foes as it closes; a page that calls every 16 KiB frame a handover buys its one turn and no more; the quiet and the crowded cells as they were (mutants: FH-a-small-frame-jumps-the-line; FH-beat-unasked; FH-hands-dropped-inside-the-cadence; FH-leave-at-the-first-floor)', async () => {
  const by = (name) => SCENES.find((s) => s.name === name);
  const quietCell = await scene(by('quiet'), 20);
  assert.deepEqual([quietCell.full, quietCell.delta], [100, 100], 'inside the budget, everything');
  const crowded = await scene(by('crowded'), 20);
  assert.equal(crowded.full, 100);
  assert.ok(crowded.delta > 5, `the deltas past the budget, some heard (${crowded.delta}%)`);
  const stander = await scene(by('stander'), 20);
  assert.ok(stander.heavyFull > 30 && Math.abs(stander.heavyFull - stander.full) < 10, `the stander's full frames as the rest's (${JSON.stringify(stander)})`);
  assert.ok(stander.gapP99 * 1000 < FOES_STALE_MS + 1000, 'every owner\'s full frames come round');
  assert.equal(stander.stale, 0);
  const star = await scene(by('star80'), 20);
  assert.ok(star.gapMax * 1000 < FOES_STALE_MS + 1500 && star.stale === 0, `the bigger star (${JSON.stringify(star)})`);
  const big = await scene(by('big'), 20);
  assert.equal(big.stale, 0, `the record cap: nobody past its readers' patience (${JSON.stringify(big)})`);
  assert.ok(big.unheardMax * 1000 < FOES_STALE_MS && big.beats > 0, 'kept by the beats');
  const burst = await scene(by('burst'), 20);
  assert.equal(burst.hands, 100, `three batches at once, every one heard (${JSON.stringify(burst)})`);
  const leavers = await scene(by('leavers'), 20);
  assert.equal(leavers.hands, 100, `thirty owners each handing on 24 foes and closing in the same moment - a door, a teleport, a death - every batch heard (${JSON.stringify(leavers)})`);
  const liar = await scene(by('liar'), 20);
  assert.ok(liar.flood < 10 && liar.full > 55 && liar.gapP99 * 1000 < FOES_STALE_MS, `a page whose every frame is a "handover" buys its turn (${JSON.stringify(liar)})`);
});

test('FOES-HOLD the metrics point: the frames held, the held sent, the held gone unsent, their waits summed and the beats, as blob6 to blob10 after FOES-FIRST\'s three, decimal; reset with the window (mutants: a hold blob dropped; their order; the waits unsummed)', async () => {
  const m = new RoomMetrics(0);
  Object.assign(m.c, { frames: 1, hitDrops: 1, fullDrops: 2, fulls: 3, held: 4, heldSent: 5, heldGone: 6, heldMs: 7.4, beats: 8 });
  const got = [];
  m.flush({ writeDataPoint: (p) => got.push(p) }, 'world', 7, 'w', 1, true);
  assert.deepEqual(got[0].blobs, ['world', 'w', '1', '2', '3', '4', '5', '6', '7', '8']);
  assert.deepEqual([m.c.held, m.c.heldSent, m.c.heldGone, m.c.heldMs, m.c.beats], [0, 0, 0, 0, 0]);
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(4, clk);
    clk.tick(5000);
    R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() };
    await R.raw(socks[0], frameOf(1, { full: 1 }));
    clk.tick(400);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    await R.raw(socks[1], frameOf(2, { full: 0 }));
    assert.deepEqual([R.room._metrics.c.held, R.room._metrics.c.heldSent, R.room._metrics.c.heldMs], [1, 1, 400], 'held, sent 400 ms on');
    assert.ok(RELAY_VERSION);
  });
});
