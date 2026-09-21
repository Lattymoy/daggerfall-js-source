// SLAM15 (2026-09-17, AUDIT SLAM FINAL): THE THREE LEFT RECORDED, PAID. Mac: "Take care of the left recorded."
//
// A6 A STOP IS HEARD WHOLE. The pose that ends a walk - the first with `mv` 0 after one that moved - carries where
// the player actually stopped, and the tier served it to one far slice in four. The other three eased to the last
// pose they were served, up to a second of walking short of the truth, and stood there wrong until the heartbeat
// five seconds on. A stop is one frame per walk: fanned whole like a keepalive, under the keepalive's own floor,
// so a client toggling `mv` at the gate's ceiling buys the same two whole fans a second and no more.
//
// B4 `_needed` unioned the WORN keys into the wanted set, and that half was redundant by construction: `sync` adds
// every drawn peer's key to `_wanted` before it touches the batch and destroys every batch it did not draw; destroy()
// empties both. The invariant is pinned here and the union is gone.
//
// B5 `_wanted` was pinned by COUNT ("5 this frame"). It is pinned by LIST now: exactly the look keys of the peers drawn
// as dolls - not a body peer's, not a peer with nothing shown - and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEARTBEAT_MS, KEEPALIVE_FAN_MS, POSE_FAN_MAX, POSE_FAR_SHARE, POSE_HZ_MAX } from '../src/net/wire.js';
import { RemotePlayers, lookKey } from '../src/net/remotePlayers.js';
import { fakeRoom } from './fakeRoom.mjs';

const at = (x, z = 0, mv = 0) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

async function held(n, key = 'town:m9', poseOf = (i) => at(i * 2, 0)) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1_000_000_000; Date.now = () => clock;
  const ws = [];
  for (let i = 0; i < n; i++) { if (i % 7 === 6) clock += 1000; const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, poseOf(i)); ws.push(s); }
  clock += 5000;
  for (const s of ws) s.sent.length = 0;
  return { r, ws, tick: (ms) => { clock += ms; }, get clock() { return clock; }, done: () => { Date.now = realNow; } };
}
const lastPose = (ws) => ofType(ws, 'pose').at(-1)?.p ?? null;

test('SLAM15 A6: the pose that ENDS a walk reaches every listener in range - the far tier stands the player where it stopped, not a second short (mutant: the stop tiered like a step, as SLAM13 shipped it)', async () => {
  const n = POSE_FAN_MAX + 28;
  const h = await held(n);
  try {
    const { r, ws } = h;
    // a walk: eight steps at the crowd rate, then the stop
    for (let k = 1; k <= 8; k++) { h.tick(250); await r.pose(ws[0], at(k * 0.5, 0, 1)); }
    const far = ws.slice(POSE_FAN_MAX + 1);
    assert.ok(far.some((s) => (lastPose(s)?.x ?? -1) !== 4), 'the fixture is real: before the stop, some far listener holds a mid-walk pose');
    h.tick(250);
    await r.pose(ws[0], at(4, 0, 0));   // the stop: same place as the last step, mv 0
    assert.equal(ws.slice(1).filter((s) => lastPose(s)?.x === 4 && lastPose(s)?.mv === 0).length, n - 1, 'EVERY listener holds the stop as its latest pose');
    // and it is one frame: the next unmoved pose inside the floor is tiered (a keepalive flood is still a flood)
    const before = ws.slice(1).map((s) => ofType(s, 'pose').length);
    await r.pose(ws[0], at(4, 0, 0));
    assert.ok(ws.slice(1).filter((s, i) => ofType(s, 'pose').length === before[i] + 1).length < n - 1, 'the same instant again: tiered');
  } finally { h.done(); }
});

test('SLAM15 A6: the stop shares the keepalive\'s floor - a client toggling `mv` at the gate\'s ceiling buys at most one whole fan per KEEPALIVE_FAN_MS (mutant: the stop fanned whole unconditionally, which is 20 x 199 sends a second from one socket again)', async () => {
  const n = POSE_FAN_MAX + 28;
  const h = await held(n);
  try {
    const { r, ws } = h;
    h.tick(KEEPALIVE_FAN_MS);
    for (let k = 0; k < POSE_HZ_MAX; k++) await r.pose(ws[0], at(k * 0.1, 0, k % 2));   // mv 0,1,0,1... ten "stops" in one instant
    const far = ws.slice(POSE_FAN_MAX + 1).map((s) => ofType(s, 'pose').length);
    const farthestHeard = Math.min(...far);
    assert.ok(farthestHeard >= 1, 'the first stop was whole');
    assert.ok(Math.max(...far) <= 1 + Math.ceil((POSE_HZ_MAX - 1) / POSE_FAR_SHARE) + 1, `the rest were tiered - one slice in ${POSE_FAR_SHARE}, not ten whole fans (${Math.max(...far)})`);
    assert.equal(ws[0].att.kept, h.clock, 'the one whole fan is the `kept` stamp, shared with the keepalive');
    // an honest heartbeat later: whole again
    h.tick(HEARTBEAT_MS);
    const before = ws.slice(1).map((s) => ofType(s, 'pose').length);
    await r.pose(ws[0], at((POSE_HZ_MAX - 1) * 0.1, 0, 0));
    assert.equal(ws.slice(1).filter((s, i) => ofType(s, 'pose').length === before[i] + 1).length, n - 1);
  } finally { h.done(); }
});

const look = (i) => ({ race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: i, group: 'Armor', equipSlot: 1 }] });
function host() {
  const c = { destroyed: 0 };
  const rp = new RemotePlayers({
    renderer: { uploadTexture: () => {}, releaseTexture: () => {}, createBillboardBatch: () => ({}), destroyBillboardBatch: () => { c.destroyed++; } },
    deps: {}, compose: async () => ({ rgba: new Uint8Array(64).fill(255), width: 4, height: 4 }), now: () => 1000,
  });
  const frame = async (list, opts) => { rp.sync(list, undefined, opts); for (let k = 0; k < list.length * 2 + 30; k++) { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); } };
  return { rp, c, frame };
}

test('SLAM15 B5: `_wanted` is EXACTLY the look keys of the peers drawn as dolls this frame - a body peer\'s and an unshown peer\'s are not in it, and nothing else is (mutants: the set not rebuilt each frame; a body peer\'s key added; the unshown peer\'s key added)', async () => {
  const { rp, frame } = host();
  const dolls = Array.from({ length: 6 }, (_, k) => ({ id: `d${k}`, look: look(k), shown: { x: k, y: 0, z: 0 } }));
  const body = { id: 'b0', look: look(50), shown: { x: 9, y: 0, z: 0 } };      // stands in a Morrowind body: no doll
  const unshown = { id: 'u0', look: look(60), shown: null };                     // nothing to draw yet
  await frame([...dolls, body, unshown], { bodyHeight: (id) => (id === 'b0' ? 1.8 : 0) });
  assert.deepEqual([...rp._wanted].sort(), dolls.map((p) => lookKey(p.look)).sort(), 'the six dolls\' keys, by list');
  assert.ok(!rp._wanted.has(lookKey(body.look)) && !rp._wanted.has(lookKey(unshown.look)));
  await frame(dolls.slice(2, 4));
  assert.deepEqual([...rp._wanted].sort(), dolls.slice(2, 4).map((p) => lookKey(p.look)).sort(), 'rebuilt: this frame\'s two, the other four gone at once');
});

test('SLAM15 B4: after any sync every worn key is already wanted, so the worn half of `_needed` was redundant and is gone - and destroy() empties both (mutants: a batch kept for a peer the sync did not draw; the worn union restored, which is equivalent and recorded as such)', async () => {
  const { rp, frame } = host();
  const crowd = Array.from({ length: 40 }, (_, k) => ({ id: `p${k}`, look: look(k), shown: { x: k, y: 0, z: 0 } }));
  await frame(crowd); await frame(crowd);   // the first sync asks, the second dresses - a doll lands between frames
  assert.equal(rp._batches.size, 40);
  for (const e of rp._batches.values()) assert.ok(rp._wanted.has(e.key), 'worn implies wanted');
  assert.deepEqual([...rp._needed()].sort(), [...rp._wanted].sort(), 'the needed set is the wanted set - as SETS, so a restored worn-union is equivalent, which is the proof it was redundant');
  // a peer changes look: the old batch goes in the same sync, the new key is wanted
  const changed = crowd.map((p, i) => (i === 3 ? { ...p, look: look(99) } : p));
  await frame(changed); await frame(changed);
  for (const e of rp._batches.values()) assert.ok(rp._wanted.has(e.key));
  assert.equal(rp._batches.size, 40, 'the changed peer is dressed anew');
  assert.ok(rp._wanted.has(lookKey(look(99))) && !rp._wanted.has(lookKey(look(3))));
  // half the crowd leaves: their batches are dropped in the same sync, so nothing worn is unwanted
  await frame(crowd.slice(0, 20));
  assert.equal(rp._batches.size, 20);
  for (const e of rp._batches.values()) assert.ok(rp._wanted.has(e.key));
  rp.destroy();
  assert.equal(rp._batches.size, 0); assert.equal(rp._wanted.size, 0); assert.equal(rp._needed().size, 0);
});
