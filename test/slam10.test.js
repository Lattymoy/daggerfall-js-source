// SLAM10 (2026-09-16, AUDIT SLAM over SLAM1..SLAM7): THREE OF SLAM6'S OWN REGRESSIONS.
//
// ONE: THE FAR TIER WAS INDEXED BY A RANK THAT MOVED. SLAM6 cut the listeners past POSE_FAN_MAX into POSE_FAR_SHARE
// slices of a list re-sorted on every pose, and served slice `turn % share`. When the crowd moves, ranks shuffle; a
// listener crossing a slice boundary between two turns is served twice or skipped; and "served once every share
// poses" was true only for a crowd standing perfectly still - the one case SLAM6 measured before publishing it as
// a guarantee. Measured on the shipped law, 200 in one block at 4 Hz: never-heard stayed 0 at every speed (the
// erasure fix held), but 15% of sender-listener pairs went longer than GAP_MAX_MS at a shuffle and 50% at a walk,
// with worst gaps over 6 s. The far tier is now bucketed by hashKey(listener id) % share - a function of who the
// listener is and nothing else - so every far listener is served exactly once per rotation whatever the crowd does.
//
// TWO: A STRANGER TOOK A MORROWIND BODY. SLAM6 stands a peer from its pose before the relay has named it, and
// PeerBodies offers BODIES_MAX rigs to the nearest peers - so at an event the eight figures closest to the camera
// were eight IDENTICAL default Bretons, each a multi-second mesh parse, each paid twice. A stranger keeps the shared
// look-less doll (one compose for the whole crowd) until it is introduced.
//
// THREE: A PEER CROSSING INTO THE NEAR TIER DASHED. The ease is a lag interpolator, and when a peer's interval fell
// from 1000 ms (far) to 250 ms (near) in one step, the accumulated lag burned inside one 250 ms segment: a peer
// walking at 5 u/s was drawn at 20.6 u/s for a quarter second. The interval may now halve at most per pose, which
// caps the catch-up at 2x and converges in two intervals; growth is unbounded as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poseFan, hashKey, POSE_FAN_MAX, POSE_FAR_SHARE } from '../src/net/wire.js';
import { OnlineSession, GAP_MAX_MS, GAP_MIN_MS } from '../src/net/online.js';
import { PeerBodies, BODIES_MAX } from '../src/net/peerBodies.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const at = (x, z = 0) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });
const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('SLAM10: under a WALKING crowd every far listener is still served exactly once per rotation - the guarantee SLAM6 published and only a standing crowd kept (mutant: the far tier cut by rank, under which half the pairs at a walk exceed GAP_MAX_MS)', () => {
  assert.equal(relay.poseFan, poseFan); assert.equal(relay.hashKey, hashKey, 'one home, both ends');
  const R = 102.4 / 2, N = 200, HZ = 4, SECS = 12, SPEED = 8;   // one RMB block, the crowd rate, a walking pace
  const rnd = mul(11);
  const p = Array.from({ length: N }, (_, i) => ({ id: `p${i}`, x: (rnd() * 2 - 1) * R, z: (rnd() * 2 - 1) * R }));
  const heard = new Map();   // "sender>listener" -> [turn indices heard]
  for (let f = 0; f < SECS * HZ; f++) {
    for (const q of p) {   // everybody walks: a reflecting random walk, so ranks shuffle every pose
      q.x += (rnd() * 2 - 1) * SPEED / HZ; q.z += (rnd() * 2 - 1) * SPEED / HZ;
      if (Math.abs(q.x) > R) q.x = Math.sign(q.x) * (2 * R - Math.abs(q.x));
      if (Math.abs(q.z) > R) q.z = Math.sign(q.z) * (2 * R - Math.abs(q.z));
    }
    for (const s of p) for (const l of poseFan(p.filter((x) => x !== s), s, (x) => x, f)) { const k = `${s.id}>${l.id}`; (heard.get(k) ?? heard.set(k, []).get(k)).push(f); }
  }
  // the law, pair by pair: between any two consecutive hearings of a far pair, at most POSE_FAR_SHARE poses passed
  let pairs = 0, over = 0, worst = 0;
  for (const turns of heard.values()) {
    if (turns.length >= SECS * HZ) continue;   // a near pair for the whole run: heard every pose, nothing to test
    pairs++;
    for (let i = 1; i < turns.length; i++) { const gap = turns[i] - turns[i - 1]; worst = Math.max(worst, gap); if (gap > POSE_FAR_SHARE) over++; }
  }
  assert.ok(pairs > N * N / 2, `most pairs are far pairs in a crowd this size (${pairs})`);
  assert.equal(over, 0, `no far pair ever went more than ${POSE_FAR_SHARE} poses unheard - ${over} did (worst ${worst})`);
  assert.equal(heard.size, N * (N - 1), 'and nobody was erased');
});

test('SLAM10: the bucket is the listener\'s ID and nothing else - the same turn serves it whoever moves, and every id lands in exactly one bucket (mutants: the key ignored; the hash constant; the bucket read off the rank)', () => {
  const ids = Array.from({ length: 300 }, (_, i) => `peer-${String(i).padStart(4, '0')}`);
  const counts = new Array(POSE_FAR_SHARE).fill(0);
  for (const id of ids) counts[hashKey(id) % POSE_FAR_SHARE]++;
  assert.ok(counts.every((c) => c > 0), `every bucket has somebody (${counts.join(',')})`);
  assert.ok(Math.max(...counts) < 2 * Math.min(...counts), 'and no bucket is starved by the hash');
  assert.notEqual(hashKey('peer-0001'), hashKey('peer-0002'), 'distinct ids hash apart');
  assert.equal(hashKey('peer-0001'), hashKey('peer-0001'), 'and the same id always the same');
  // the sender may stand anywhere: the far listeners served on a turn are the same ids
  const list = ids.slice(0, POSE_FAN_MAX + 60).map((id, i) => ({ id, p: at(i) }));
  const a = poseFan(list, at(-500), (x) => x.p, 2).slice(POSE_FAN_MAX).map((x) => x.id).sort();
  const b = poseFan(list, at(+500), (x) => x.p, 2).slice(POSE_FAN_MAX).map((x) => x.id).sort();
  const farBoth = new Set(a.filter((id) => b.includes(id)));
  for (const id of farBoth) assert.equal(hashKey(id) % POSE_FAR_SHARE, 2);
  assert.ok(farBoth.size > 0, 'listeners far from both ends are served on the same turn from both');
});

test('SLAM10: over the REAL relay a far listener is served exactly once per rotation while the crowd moves between the sender\'s poses (mutant: the relay not passing the id, so the bucket is undefined and one turn serves everyone far)', async () => {
  const n = POSE_FAN_MAX + 24;
  const r = fakeRoom('town:m9');
  const ws = [];
  for (let i = 0; i < n; i++) { const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, at(i * 2)); ws.push(s); await new Promise((res) => setTimeout(res, 110)); }
  const sender = ws[0];
  for (const s of ws) s.sent.length = 0;
  // between the sender's poses the FAR listeners move - a different permutation of their ranks every turn, inside
  // the far tier (the near run stands still, so nobody crosses the near/far boundary and the law is exact). 7 is
  // coprime with the 23 far slots, so each turn's placement is a bijection: every far slot is occupied, once.
  const farN = n - 1 - POSE_FAN_MAX;
  for (let turn = 0; turn < POSE_FAR_SHARE; turn++) {
    await r.pose(sender, at(0.1 * (turn + 1)));   // moved past the epsilon, so it is a pose and not a keepalive (SLAM8 fans those to everyone)
    for (let k = 0; k < farN; k++) { const i = 1 + POSE_FAN_MAX + k; await r.pose(ws[i], at((1 + POSE_FAN_MAX + ((k * 7 + turn * 13) % farN)) * 2 + 1)); }
  }
  const fromSender = (s) => s.sent.filter((m) => m.t === 'pose' && m.id === 'p0000').length;
  const near = ws.slice(1, 1 + POSE_FAN_MAX).map(fromSender);
  const far = ws.slice(1 + POSE_FAN_MAX).map(fromSender);
  assert.ok(near.every((c) => c === POSE_FAR_SHARE), 'the near run heard every pose');
  assert.ok(far.every((c) => c === 1), `every far listener heard EXACTLY one over the rotation while its rank changed every turn (${JSON.stringify(far)}) - under the rank-sliced law some heard two and some none`);
});

test('SLAM10: a peer the relay has not introduced takes NO Morrowind body - the nearest strangers do not become eight identical default rigs (mutant: the `told` skip removed)', () => {
  let builds = 0;
  const rig = () => ({ attach() {}, unload() {}, build: async () => { builds++; return { ok: true }; }, canThirdPerson: () => false, setViewMode: () => false, update() {}, drawThird: () => false });
  const bodies = new PeerBodies({ renderer: {}, enabled: () => true, createRig: rig, now: () => 1000, warn: () => {} });
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  const peers = [];
  for (let i = 0; i < 6; i++) peers.push({ id: `st-${i}`, told: false, name: 'Traveller', look: null, shown: at(i * 0.5), pose: at(i * 0.5) });   // the six NEAREST: strangers
  for (let i = 0; i < 10; i++) peers.push({ id: `kn-${i}`, told: true, name: `K${i}`, look, shown: at(10 + i), pose: at(10 + i) });
  bodies.sync(peers, (p) => [p.x, p.y, p.z], { near: [0, 0, 0], dt: 1 / 60 });
  assert.equal([...bodies._bodies.keys()].filter((id) => id.startsWith('st-')).length, 0, 'no stranger stands in a rig');
  assert.equal(bodies._bodies.size, Math.min(BODIES_MAX, 10), 'the slots went to introduced peers');
  assert.ok([...bodies._bodies.keys()].every((id) => id.startsWith('kn-')));
});

test('SLAM10: the ease interval halves at most per pose - a peer promoted from the far tier catches up at no more than twice its speed, in two intervals (mutant: the interval collapsing in one step, the 4x dash)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const info = console.info; console.info = () => {};
  try {
    s.join('town:m1', at(0)); const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: at(0) }], host: null, world: null });
    const p = s.peers.get('eve-0003');
    // far tier: one pose a second, three of them
    for (let k = 1; k <= 3; k++) { now += 1000; ws.receive({ t: 'pose', id: 'eve-0003', p: at(k * 5) }); }
    assert.equal(p.gap, GAP_MAX_MS, 'settled at the far interval');
    // promoted: poses every 250 ms
    const gaps = [];
    for (let k = 1; k <= 4; k++) { now += 250; ws.receive({ t: 'pose', id: 'eve-0003', p: at(15 + k * 1.25) }); gaps.push(p.gap); }
    assert.deepEqual(gaps, [500, 250, 250, 250], 'the interval halves, then meets the real one - never a 1000 -> 250 cliff');
    // and the other way is unbounded, as before: a silence ceilings, it does not crawl
    now += 5000; ws.receive({ t: 'pose', id: 'eve-0003', p: at(40) });
    assert.equal(p.gap, GAP_MAX_MS);
    now += 10; ws.receive({ t: 'pose', id: 'eve-0003', p: at(41) });
    assert.equal(p.gap, Math.max(GAP_MIN_MS, GAP_MAX_MS / 2), 'and a burst after a silence halves rather than snaps');
  } finally { console.info = info; }
});
