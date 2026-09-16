// SLAM1 (2026-09-16, Mac: "This Sunday is Daggerfall's 30th anniversary. A streamer is going to host a 30th
// celebration server slam smack dab in DFE"): THE POSE FAN IS BOUNDED TO THE NEAREST LISTENERS.
//
// A pose reached everyone in the room within range, so one Durable Object's cost was N senders times N listeners.
// MEASURED over the real Room on the fake DO, a crowd standing together: 2.4k sends a second at 16 players, 22.6k
// at 48, 91.2k at 96 - clean quadratic - and past about two hundred one object cannot keep up.
//
// THE RANGE CULL DOES NOT SAVE IT, which is the finding that killed the first fix proposed for this. The cull is why
// a cell is cheap when the country is spread out; an event is everybody converging on ONE SPOT, where every range
// test passes and a cell costs exactly what a town costs. Both measured, both identical.
//
// What saves it is that nobody can SEE two hundred people: a name stops at NAME_RANGE, at most BODIES_MAX peers
// stand in a Morrowind body, the rest are billboards in a crowd. So the fan takes the NEAREST POSE_FAN_MAX and no
// more - the same bound and the same reason as `rosterFor`'s nearest-ROSTER_MAX welcome. At 200 in one room that is
// 64k sends a second rather than 398k. (AUDIT SLAM withdrew the CPU figure this line first carried: most of it was
// the harness's own JSON.parse, and "over budget" named a budget this repo does not define. The send counts are
// exact BECAUSE they are arithmetic - N x min(N-1, FAN) x rate - not because anybody observed them. On relay work
// alone the bound may even cost more at 200; it wins only if ws.send() is dear next to a 199-element sort.)
//
// SLAM6 (2026-09-16, AUDIT SLAM) CORRECTED THE SECOND HALF OF THIS. "The nearest win and the rest hear silence" was
// not a bound, it was an ERASURE: the silence law HIDES a peer after PEER_TIMEOUT_MS, so every listener past the
// bound lost that sender off its screen entirely. And because the bound is a RANK, the loss fell hardest on the
// densest player in the room - measured at 200 standing in one town block, the man in the middle was heard by 32 and
// hidden from 167, which at an event is the one person everybody came for. The nearest POSE_FAN_MAX still hear every
// pose; the rest now hear one in POSE_FAR_SHARE by turns, and nobody is hidden. The saving is smaller and real:
// 59.2k sends a second at 200 rather than 159.2k unbounded (arithmetic, as above - not an observation).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestFan, hashKey, POSE_FAN_MAX, POSE_FAR_SHARE, ROSTER_MAX, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';

const at = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('SLAM1: the bound is the wire\'s and the relay\'s one law, and it is no larger than the roster a joiner is told about', () => {
  assert.equal(relay.nearestFan, nearestFan, 'one home, both ends');
  assert.equal(relay.POSE_FAN_MAX, POSE_FAN_MAX);
  assert.ok(POSE_FAN_MAX > 0 && POSE_FAN_MAX <= ROSTER_MAX, 'a pose reaches no more than the welcome names');
});

test('SLAM1: under the bound NOTHING happens - the same array back, unsorted and uncopied, so a room that does not need this pays nothing for it (mutant: sort always, which is the cost on every small room in the Bay)', () => {
  const list = [{ p: at(9, 9) }, { p: at(1, 1) }, { p: at(5, 5) }];
  const got = nearestFan(list, at(0, 0), (x) => x.p, 8);
  assert.equal(got, list, 'the very same array - not a copy, not a sort');
  const exact = new Array(POSE_FAN_MAX).fill(null).map((_, i) => ({ p: at(i, 0) }));
  assert.equal(nearestFan(exact, at(0, 0), (x) => x.p), exact, 'and at exactly the bound too');
});

test('SLAM1: over the bound the NEAREST win, measured from the sender (mutants: the farthest kept; the first N kept; the distance read off one axis)', () => {
  // twenty listeners strung out along z; the sender stands at the far end, so "nearest" is the tail of the list and
  // a first-N answer is exactly wrong
  const list = Array.from({ length: 20 }, (_, i) => ({ id: i, p: at(0, i * 10) }));
  const got = nearestFan(list, at(0, 200), (x) => x.p, 5);
  assert.equal(got.length, 5);
  assert.deepEqual(got.map((x) => x.id), [19, 18, 17, 16, 15], 'the five closest to the sender, nearest first');
  // and the distance is the PLANE's, not one axis: a listener far along x is not near because its z agrees
  const plane = [{ id: 'far-x', p: at(500, 0) }, { id: 'near', p: at(1, 1) }, { id: 'far-z', p: at(0, 500) }];
  assert.deepEqual(nearestFan(plane, at(0, 0), (x) => x.p, 1).map((x) => x.id), ['near']);
});

test('SLAM1: a listener that has never said where it is sorts LAST - a peer with no pose cannot be near (mutant: an absent pose read as the origin, which makes every silent socket the closest thing in the room)', () => {
  const list = [{ id: 'quiet', p: null }, ...Array.from({ length: 40 }, (_, i) => ({ id: i, p: at(i + 1, 0) }))];
  const got = nearestFan(list, at(0, 0), (x) => x.p, 4);
  assert.deepEqual(got.map((x) => x.id), [0, 1, 2, 3]);
  assert.ok(!got.some((x) => x.id === 'quiet'));
  // a pose with a junk coordinate is no position either
  assert.deepEqual(nearestFan([{ id: 'nan', p: { x: NaN, z: 0 } }, { id: 'ok', p: at(99, 99) }], at(0, 0), (x) => x.p, 1).map((x) => x.id), ['ok']);
});

test('SLAM1/SLAM6: THE RELAY FANS ONE POSE TO THE NEAREST POSE_FAN_MAX AT FULL RATE AND THE REST BY TURNS - and the ones past the bound are still IN the room, heard less often rather than dropped (mutants: the unbounded fan, which is N squared and the whole reason for this; SLAM1\'s own law, which told them nothing at all)', async () => {
  const n = POSE_FAN_MAX + 16;
  const r = fakeRoom('town:m9');
  const ws = [];
  // a crowd in a line: the sender at one end, so the nearest set is unambiguous and a first-N answer is wrong
  for (let i = 0; i < n; i++) {
    const s = r.connect();
    await r.hello(s, `p${String(i).padStart(4, '0')}`, at(0, i * 4));
    ws.push(s);
    await new Promise((res) => setTimeout(res, 110));   // the room's own admission rate (HELLO_HZ_MAX)
  }
  assert.equal(ws.filter((s) => !s.closed).length, n, 'everyone got in at the room\'s admission rate');
  for (const s of ws) s.sent.length = 0;
  // the LAST player moves: the nearest listeners are the ones just before it
  await r.pose(ws[n - 1], at(0, (n - 1) * 4 + 1));
  const far = n - 1 - POSE_FAN_MAX;   // the listeners past the bound: 15 of them here
  const heard = ws.map((s, i) => [i, ofType(s, 'pose').length]).filter(([, c]) => c > 0);
  // SLAM10 re-aimed this count: it was `POSE_FAN_MAX + ceil(far / POSE_FAR_SHARE)`, an equal SLICE of a rank-ordered
  // list - the law SLAM10 withdrew because a moving crowd shuffles ranks. A turn now serves the far listeners whose
  // id hashes to it, so the count is the bound plus that bucket's size, read off the sender's own turn counter.
  const turn = r.room._attach(ws[n - 1]).turn;
  const farIds = ws.slice(0, far).map((s) => s.att.id);
  const inBucket = farIds.filter((id) => hashKey(id) % POSE_FAR_SHARE === turn % POSE_FAR_SHARE).length;
  assert.equal(heard.length, POSE_FAN_MAX + inBucket, `the nearest bound, plus this turn's bucket of the rest (${inBucket} of ${far})`);
  const ids = heard.map(([i]) => i).sort((a, b) => a - b);
  assert.equal(ids[ids.length - 1], n - 2, 'the nearest neighbour heard it');
  assert.ok(ids.includes(n - 1 - POSE_FAN_MAX), 'the whole nearest run is in, every pose');
  assert.equal(ofType(ws[n - 1], 'pose').length, 0, 'never back to the sender');
  // SLAM6: AND NOBODY IS LEFT OUT. Over POSE_FAR_SHARE consecutive poses every listener in the room has heard the
  // sender at least once - which is the whole difference between a peer gone quiet and a peer ERASED, because the
  // silence law hides one that says nothing for PEER_TIMEOUT_MS.
  for (let t = 1; t < POSE_FAR_SHARE; t++) await r.pose(ws[n - 1], at(0, (n - 1) * 4 + 1 + t));
  const ever = ws.map((s, i) => [i, ofType(s, 'pose').length]).filter(([i, c]) => c > 0 && i !== n - 1);
  assert.equal(ever.length, n - 1, `over ${POSE_FAR_SHARE} poses every one of the ${n - 1} listeners heard the sender`);
  const nearest = ws.slice(n - 1 - POSE_FAN_MAX, n - 1);
  assert.ok(nearest.every((s) => ofType(s, 'pose').length === POSE_FAR_SHARE), 'the nearest heard EVERY pose');
  assert.ok(ws.slice(0, far).every((s) => ofType(s, 'pose').length === 1), 'and each of the rest heard exactly one of them');
  // THE ONES PAST THE BOUND ARE NOT DROPPED: no leave, no close - the silence law hides a quiet peer and keeps it
  assert.equal(ws.filter((s) => s.closed).length, 0, 'nobody was closed for standing too far back');
  assert.equal(ws.reduce((a, s) => a + ofType(s, 'leave').length, 0), 0, 'and nobody was said to have left');
  // walking closer resumes at once - the far end moves next, and IT is now somebody's nearest
  for (const s of ws) s.sent.length = 0;
  await r.pose(ws[0], at(0, 1));
  assert.ok(ofType(ws[1], 'pose').length > 0, 'the near neighbour of a different sender hears that one');
});

test('SLAM1: a cell is bounded too - the range cull is not the bound, because an event is everyone inside one range (mutant: the bound applied to places alone, which leaves the streaming world at N squared)', async () => {
  const n = POSE_FAN_MAX + 8;
  const r = fakeRoom('world:3,12');
  const ws = [];
  const base = { x: 3 * PIXEL_UNITS, z: 12 * PIXEL_UNITS };
  for (let i = 0; i < n; i++) {
    const s = r.connect();
    await r.hello(s, `p${String(i).padStart(4, '0')}`, at(base.x + i, base.z));
    ws.push(s);
    await new Promise((res) => setTimeout(res, 110));
  }
  for (const s of ws) s.sent.length = 0;
  await r.pose(ws[0], at(base.x + 0.5, base.z));
  const heard = ws.filter((s) => ofType(s, 'pose').length > 0).length;
  assert.equal(heard, POSE_FAN_MAX + Math.ceil((n - 1 - POSE_FAN_MAX) / POSE_FAR_SHARE), 'a crowd inside one range is bounded like any other crowd - and tiered like any other crowd');
});
