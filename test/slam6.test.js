// SLAM6 (2026-09-16, AUDIT SLAM, before Mac's 30th-anniversary server slam): THE POSE FAN STOPPED ERASING PEOPLE.
//
// SLAM1 bounded the fan to the nearest POSE_FAN_MAX listeners and sent the rest NOTHING. That is not a quiet peer,
// it is a deleted one: the silence law (AUDIT ONLINE B3/B11/B14) HIDES a peer that says nothing for
// PEER_TIMEOUT_MS. And the bound is a RANK, not a distance, so the DENSEST player in the room reaches the SMALLEST
// radius - which at an event is precisely the person everybody came to see. Measured over the law at 200 players
// standing in one town block (102.4 scene units, an RMB block), uniform and packed alike: the man in the middle was
// heard by 32 and hidden from 167.
//
// THE FIX IS A TIER, NOT A WIDER BOUND. The nearest POSE_FAN_MAX still hear every pose; everyone else is cut into
// POSE_FAR_SHARE slices by distance and hears one pose in POSE_FAR_SHARE, by turns. Nobody is ever hidden, and the
// cost stays bounded: 59.0k sends a second at 200 (59.2k by arithmetic) against 159.2k unbounded.
//
// AND THE SHARE IS DERIVED, NOT CHOSEN. A peer is eased over its own observed interval and that interval is clamped
// at GAP_MAX_MS - past it the ease finishes early and the peer STANDS. A far listener's interval is share/hz, and
// the crowded rate never falls below POSE_HZ_MIN, so POSE_HZ_MIN * GAP_MAX_MS / 1000 = 4 is the largest share that
// keeps every far peer WALKING. Measured: the longest gap any of the 199 saw was 1000ms, exactly GAP_MAX_MS.
//
// THE OTHER HALF IS AT HOME. A pose from an id the welcome never named used to be DROPPED while a `who` was asked,
// and the who is the room's scarcest arm - so the far tier would have reached people the client could not yet draw.
// A stranger's pose now stands the peer where it says it is, unnamed and look-less, and the ask goes on to learn
// who it is. A foes frame is still the introduction's: a pose is one figure, a pool is a world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poseFan, nearestFan, POSE_FAN_MAX, POSE_FAR_SHARE, ROSTER_MAX } from '../src/net/wire.js';
import { POSE_HZ_MIN, GAP_MAX_MS, PEER_TIMEOUT_MS, poseHzFor, OnlineSession } from '../src/net/online.js';
import * as relay from '../server/src/relay.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const at = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });
const line = (n) => Array.from({ length: n }, (_, i) => ({ id: i, p: at(0, i) }));

test('SLAM6: the far share is DERIVED from the ease the client already runs - the largest that still walks, and no larger (mutants: 8, which makes every far peer stand for half its interval; 2, which pays twice for smoothness nothing can show)', () => {
  assert.equal(relay.poseFan, poseFan, 'one home, both ends');
  assert.equal(relay.POSE_FAR_SHARE, POSE_FAR_SHARE);
  // the crowded rate's floor is what the far interval is measured against - it is the worst case, by construction
  assert.equal(Math.min(...[24, 32, 64, 128, 200, 256].map(poseHzFor)), POSE_HZ_MIN, 'poseHzFor never goes below its floor');
  assert.ok((POSE_FAR_SHARE * 1000) / POSE_HZ_MIN <= GAP_MAX_MS, 'a far peer is eased over its whole interval - it never stands');
  assert.ok(((POSE_FAR_SHARE + 1) * 1000) / POSE_HZ_MIN > GAP_MAX_MS, 'and it is the LARGEST share for which that is true');
  // SLAM8 (AUDIT SLAM) CORRECTED THIS LINE. It read `(POSE_FAR_SHARE * 1000) / POSE_HZ_MIN < PEER_TIMEOUT_MS`, i.e.
  // 1000 < 20000 - an assertion that cannot fail, about the rate of a peer that is MOVING. The peer at risk of the
  // silence law is the one STANDING STILL, which speaks at HEARTBEAT_MS, and HEARTBEAT_MS * POSE_FAR_SHARE is
  // PEER_TIMEOUT_MS exactly. A keepalive is therefore never tiered at all (test/slam8.test.js); what this file
  // pins is the moving case, and it pins it against the rate a moving peer actually keeps.
  assert.ok((POSE_FAR_SHARE * 1000) / POSE_HZ_MIN <= GAP_MAX_MS, 'a MOVING far peer is served inside one eased interval');
});

test('SLAM6: under the bound NOTHING happens - the same array back, unsorted and uncopied, exactly as nearestFan (mutant: the tier applied to every room, which is a sort on every pose in the Bay)', () => {
  const small = line(POSE_FAN_MAX);
  assert.equal(poseFan(small, at(0, 0), (x) => x.p, 0), small, 'the very same array at the bound - not a copy, not a sort');
  const tiny = line(3);
  for (let turn = 0; turn < POSE_FAR_SHARE + 1; turn++) assert.equal(poseFan(tiny, at(0, 0), (x) => x.p, turn), tiny, 'and under it, whatever the turn');
  assert.equal(poseFan([], at(0, 0), (x) => x.p, 0).length, 0);
  assert.deepEqual(poseFan(null, at(0, 0), (x) => x.p, 0), null, 'and a caller holding nothing is handed it back');
});

test('SLAM6: over the bound the NEAREST are in every turn and the rest are cut into POSE_FAR_SHARE slices, each served exactly once per rotation - so every listener hears the sender and none hears it twice (mutants: the far slice fixed at turn 0, which starves every other slice; the rotation over the WHOLE list, which drops the nearest)', () => {
  const n = POSE_FAN_MAX + 30;
  const list = line(n);
  const from = at(0, 0);   // the sender at one end: the nearest run is 0..POSE_FAN_MAX-1
  const seen = new Map();
  for (let turn = 0; turn < POSE_FAR_SHARE; turn++) {
    const got = poseFan(list, from, (x) => x.p, turn);
    const ids = got.map((x) => x.id);
    assert.deepEqual(ids.slice(0, POSE_FAN_MAX), list.slice(0, POSE_FAN_MAX).map((x) => x.id), `turn ${turn}: the nearest run, every turn`);
    assert.equal(new Set(ids).size, ids.length, `turn ${turn}: nobody served twice in one pose`);
    const slice = Math.ceil((n - POSE_FAN_MAX) / POSE_FAR_SHARE);
    assert.equal(got.length, POSE_FAN_MAX + Math.min(slice, n - POSE_FAN_MAX - turn * slice), `turn ${turn}: the bound plus this turn's slice (the last one is short when the rest do not divide)`);
    for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  assert.equal(seen.size, n, 'over one rotation every listener in the room has heard the sender');
  for (const x of list.slice(0, POSE_FAN_MAX)) assert.equal(seen.get(x.id), POSE_FAR_SHARE, 'the nearest heard every pose');
  for (const x of list.slice(POSE_FAN_MAX)) assert.equal(seen.get(x.id), 1, 'and each of the rest heard exactly one');
  // the turn is read modulo the share, so a counter that wraps or arrives negative still lands on a real slice
  assert.deepEqual(poseFan(list, from, (x) => x.p, POSE_FAR_SHARE).map((x) => x.id), poseFan(list, from, (x) => x.p, 0).map((x) => x.id));
  assert.deepEqual(poseFan(list, from, (x) => x.p, -1).map((x) => x.id), poseFan(list, from, (x) => x.p, POSE_FAR_SHARE - 1).map((x) => x.id));
});

test('SLAM6: the far tier is ranked by the SAME distance the near one is, and the near set is exactly nearestFan\'s (mutant: the far slices cut in socket order, which puts the man across the square in the same slice as the man at your elbow)', () => {
  const list = line(POSE_FAN_MAX + 20);
  const from = at(0, 1000);   // the sender at the FAR end: "nearest" is the tail, and a first-N answer is exactly wrong
  const near = poseFan(list, from, (x) => x.p, 0).slice(0, POSE_FAN_MAX).map((x) => x.id);
  assert.deepEqual(near, nearestFan(list, from, (x) => x.p).map((x) => x.id), 'one ranking, both doors');
  assert.equal(near[0], list.length - 1, 'the nearest first');
  // the first far slice is the listeners just past the bound, not the ones at the other end of the square
  const firstFar = poseFan(list, from, (x) => x.p, 0).slice(POSE_FAN_MAX).map((x) => x.id);
  const lastFar = poseFan(list, from, (x) => x.p, POSE_FAR_SHARE - 1).slice(POSE_FAN_MAX).map((x) => x.id);
  assert.ok(Math.min(...firstFar) > Math.max(...lastFar), 'the near slices come first and the far end of the room comes last');
  assert.ok(POSE_FAN_MAX <= ROSTER_MAX, 'the full-rate set is no larger than the welcome the joiner was handed');
});

test('SLAM6: at an event the man in the middle is heard by EVERYONE - the whole point, over a crowd standing in one town block (mutant: SLAM1\'s own law, which hides him from 167 of 199)', () => {
  // a crowd in a disc of one RMB block (102.4 scene units); the streamer dead centre, which under a RANK bound is
  // the worst place in the room to stand
  const R = 102.4 / 2;
  let a = 7;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const crowd = [{ id: 'streamer', p: at(0, 0) }];
  for (let i = 1; i < 200; i++) { const th = rnd() * 2 * Math.PI, r = R * rnd(); crowd.push({ id: `p${i}`, p: at(r * Math.cos(th), r * Math.sin(th)) }); }
  const others = crowd.slice(1);
  const slam1 = new Set(nearestFan(others, crowd[0].p, (x) => x.p).map((x) => x.id));
  assert.equal(slam1.size, POSE_FAN_MAX, 'SLAM1: the streamer reached 32 of 199');
  const heard = new Set();
  let sends = 0;
  for (let turn = 0; turn < POSE_FAR_SHARE; turn++) { const got = poseFan(others, crowd[0].p, (x) => x.p, turn); sends += got.length; for (const x of got) heard.add(x.id); }
  assert.equal(heard.size, 199, 'SLAM6: and now all 199, inside one rotation');
  // one rotation is POSE_FAR_SHARE poses, which at the crowded rate is one second - far inside the silence law
  assert.ok((POSE_FAR_SHARE * 1000) / poseHzFor(200) <= GAP_MAX_MS, 'and inside one eased interval, so they walk');
  // and the cost is the bound's, not the room's: the sum is the arithmetic, per pose
  assert.equal(sends, POSE_FAR_SHARE * POSE_FAN_MAX + 199 - POSE_FAN_MAX, 'over a rotation: the nearest four times over, everyone else once');
  assert.ok(sends < POSE_FAR_SHARE * 199, 'strictly cheaper than telling everybody everything');
});

test('SLAM6: at home a stranger\'s pose STANDS the peer at once and asks after - and the ask goes on until the relay introduces it, not until the peer exists (mutants: the ask keyed on peers.has, which never asks again; keyed on the look, which asks a look-less peer forever)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const info = console.info; console.info = () => {};
  try {
    s.join('town:m9', at(0, 0));
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
    const whos = () => ws.sent.filter((x) => x.startsWith('{"t":"who"')).map((x) => JSON.parse(x).id);
    ws.receive({ t: 'pose', id: 'eve-0003', p: { ...at(9, 9), yaw: 0.5 } });
    const p = s.peers.get('eve-0003');
    assert.ok(p, 'stood on the first frame - not held back for an answer the room answers WHO_ROOM_HZ_MAX a second');
    assert.equal(p.told, false, 'and known to be a stranger still');
    assert.equal(p.shown.x, 9, 'standing where its pose says'); assert.equal(p.look, null, 'in the look-less doll');
    s.tick();   // SLAM9: the ask is the tick's fair round (`_askRound`), not a reaction to the pose that stood it
    assert.deepEqual(whos(), ['eve-0003'], 'and asked for on the next tick');
    // the ask keeps coming back until the introduction lands - a peer record is not an answer
    now += 60_000;
    ws.receive({ t: 'pose', id: 'eve-0003', p: at(10, 9) }); s.tick();
    assert.deepEqual(whos(), ['eve-0003', 'eve-0003'], 'asked again past the retry - it is still a stranger');
    // the answer: now it is told, and the asks stop for good
    ws.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look: { race: 'Nord', gender: 'female', faceIndex: 1, items: [] }, pose: at(10, 9) });
    assert.equal(s.peers.get('eve-0003').told, true); assert.equal(s.peers.get('eve-0003').name, 'Eve');
    now += 60_000;
    ws.receive({ t: 'pose', id: 'eve-0003', p: at(11, 9) }); s.tick();
    assert.equal(whos().length, 2, 'an introduced peer is never asked for again');
    assert.equal(s.peers.get('eve-0003').pose.x, 11, 'and its poses are placed as any peer\'s');
    // a look-less peer the relay DID introduce is not asked for either - the mark is the introduction, not the look
    ws.receive({ t: 'join', id: 'nud-0005', name: 'Nud', look: null, pose: at(1, 1) });
    now += 60_000;
    ws.receive({ t: 'pose', id: 'nud-0005', p: at(2, 1) }); s.tick();
    assert.equal(s.peers.get('nud-0005').look, null); assert.equal(whos().length, 2, 'a peer with no look of its own is not asked about forever');
    // my own pose back from the relay stands nobody
    ws.receive({ t: 'pose', id: 'mac-0001', p: at(3, 3) });
    assert.equal(s.peers.has('mac-0001'), false);
  } finally { console.info = info; }
});
