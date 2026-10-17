// SLIM-FRAME (2026-10-11, the owner: "I notice some players look like they are walking off the ground";
// bible/11-Multiplayer/Scale-Arc.md SLIM-FRAME): THE SECOND WIRE'S PLACE, IN ITS OWN UNITS. SCALE5b's slimPose rounded
// a pose's x, y and z to whole units, reading all three as MapsFile's world unit (2.5 cm). A pose's HEIGHT is the scene's
// metres in every room (scenes/world.js sheds only the floating origin from it), and off the overworld its x and z are
// metres too - so every peer heard on the second wire stood on a whole metre of height, up to half a metre over the
// ground or sunk into it, and off the overworld walked a one-metre grid. Held here on the law (wire.js slimPose,
// nativePoseRoom) and over the real Room on the pins' fake object into a real session on the pins' fake socket.
// tools/mutants/slimframe.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession, nativePoseRoom as sessionNative } from '../../src/net/online.js';
import { validPose, slimPose, nativePoseRoom, SLIM_SCENE_STEPS, PIXEL_UNITS, POSE_HZ_MAX, RELAY_VERSION } from '../../src/net/wire.js';
import * as relay from '../../server/src/relay.js';

const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** A seeded roll (mulberry32) - every story replays. */
function roll(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BX = 13 * 16 + 8, BY = 13 * 16 + 8;
const CELL = `world:${Math.floor(BX / 16)},${Math.floor(BY / 16)}`;
const DUNGEON = 'dungeon:m187';
const OWNED = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:42.9`;
const NATIVE = [CELL, 'siege:3021:20', 'royal:5023:20', OWNED];
const SCENE = [DUNGEON, 'town:m1', 'interior:m1.5', 'gate:5', null];

/** A lawful pose: in the block's middle pixel in a native room (world units), within a dungeon's reach elsewhere (metres);
 *  the height the scene's metres either way. */
function drawn(rnd, native) {
  return validPose({
    x: native ? (BX + rnd()) * PIXEL_UNITS : (rnd() - 0.5) * 200, y: (rnd() - 0.5) * 400, z: native ? (499 - BY + rnd()) * PIXEL_UNITS : (rnd() - 0.5) * 200,
    yaw: (rnd() - 0.5) * 7, pitch: (rnd() - 0.5) * 2, mv: 1, ts: (rnd() * 60_000) | 0,
  });
}

test('SLIM-FRAME the law: a slim pose\'s height is read back within half a centimetre in EVERY room, and its x and z within half a world unit (whole) in a native room and within half a centimetre in every other - and nativePoseRoom is one law, the session\'s and the relay\'s (mutants: the height whole again, SCALE5b verbatim; a scene room\'s x and z whole; the room unread; the battle or the owned interior forgotten)', () => {
  assert.equal(sessionNative, nativePoseRoom, 'one home: the session re-exports the wire\'s');
  assert.equal(relay.nativePoseRoom, nativePoseRoom, 'and the relay runs the same');
  assert.equal(relay.slimPose, slimPose);
  for (const k of NATIVE) assert.equal(nativePoseRoom(k), true, `${String(k).slice(0, 16)}: MapsFile's frame`);
  for (const k of SCENE) assert.equal(nativePoseRoom(k), false, `${k}: the scene's metres`);
  const rnd = roll(41);
  const half = 0.5 / SLIM_SCENE_STEPS + 1e-9;
  for (const [keys, native] of [[NATIVE, true], [SCENE, false]]) {
    for (const key of keys) {
      for (let i = 0; i < 500; i++) {
        const p = drawn(rnd, native);
        const s = slimPose(p, key);
        const back = validPose(JSON.parse(JSON.stringify(s)));
        assert.ok(Math.abs(back.y - p.y) <= half, `${key}: the height within half a centimetre (${back.y} for ${p.y})`);
        for (const a of ['x', 'z']) {
          if (native) { assert.ok(Number.isInteger(s[a]), `${key}: ${a} whole world units`); assert.ok(Math.abs(back[a] - p[a]) <= 0.5, `${key}: ${a} within half a unit`); }
          else assert.ok(Math.abs(back[a] - p[a]) <= half, `${key}: ${a} within half a centimetre (${back[a]} for ${p[a]})`);
        }
      }
    }
  }
  // the report, as a number: a player standing 34.4 m up stood at 34 on the second wire - 40 cm sunk - and one at 34.6
  // stood at 35, 40 cm in the air
  for (const key of [CELL, DUNGEON]) {
    assert.equal(slimPose(validPose({ x: 0, y: 34.4, z: 0, yaw: 0, pitch: 0 }), key).y, 34.4, `${key}: stood where they stand`);
    assert.equal(slimPose(validPose({ x: 0, y: 34.6, z: 0, yaw: 0, pitch: 0 }), key).y, 34.6, `${key}: not in the air`);
  }
  // off the overworld, a step under a metre is a step
  const d = slimPose(validPose({ x: 12.34, y: 0, z: -7.66, yaw: 0, pitch: 0 }), DUNGEON);
  assert.deepEqual([d.x, d.z], [12.34, -7.66], 'a dungeon\'s place to the centimetre, not the metre');
  // a pose with no room is rounded as the scene's - finer, never wrong
  assert.equal(slimPose(validPose({ x: 6_869_221.734, y: 1.234, z: 0, yaw: 0, pitch: 0 })).x, 6_869_221.73);
});

/** One room on a clock of its own: a speaker, a listener on the first wire and one on the second. */
async function room(key, fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const R = fakeRoom(key, { now: () => clock });
      const native = nativePoseRoom(key);
      const at = native ? { x: (BX + 0.5) * PIXEL_UNITS, y: 34, z: (499 - BY + 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 } : { x: 3, y: 34, z: 4, yaw: 0, pitch: 0 };
      const join = async (id, extra = {}) => { const ws = R.connect(); clock += 200; await R.hello(ws, id, validPose(at), extra); assert.equal(ws.closed, null, `${id} taken`); return ws; };
      const w2 = await join('lsn-w2', { w2: 1 });
      const old = await join('lsn-old');
      const spk = await join('spk-0001');
      for (const ws of R.state.getWebSockets()) ws.sent.length = 0;
      const speak = async (p) => { clock += Math.ceil(1000 / POSE_HZ_MAX) + 1; await R.pose(spk, p); };
      try { return await fn({ R, w2, old, speak, at }); } finally { R.room._flushOwed(); }
    });
  } finally { Date.now = realNow; }
}

/** A session in `key`, welcomed - the second wire's when asked - reading `frames` as the relay sent them. */
function stood(key, at, frames, wire2) {
  const { FakeWS, sockets } = fakeSocketClass();
  const t = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, wire2 });
  s.join(key, at);
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: RELAY_VERSION, now: t });
  for (const f of frames) sockets[0].receive(f);
  return s.peers.get('spk-0001')?.pose ?? null;
}

test('SLIM-FRAME the relay to the screen: a peer standing at a height that is no whole metre - and, in a dungeon, at a place that is none - is stood by a session reading the second wire within half a centimetre of where a session reading the first stands them, in a cell and off the overworld; a cell\'s x and z still ride whole world units (mutants: the relay\'s fan unkeyed; the height whole again)', async () => {
  for (const key of [CELL, DUNGEON]) {
    await room(key, async ({ R, w2, old, speak, at }) => {
      const native = nativePoseRoom(key);
      const rnd = roll(key.length);
      for (let i = 0; i < 40; i++) {
        const p = validPose({ ...at, x: at.x + (native ? rnd() * 400 : rnd() * 9.99), y: 30 + rnd() * 9.99, z: at.z + (native ? rnd() * 400 : rnd() * 9.99), yaw: rnd() - 0.5, pitch: 0, mv: 1 });
        await speak(p);
      }
      R.room._flushOwed();
      const batch = w2.sent.filter((f) => f.t === 'poses');
      assert.equal(batch.length, 1, `${key}: one batch`);
      assert.equal(batch[0].l.length, 40);
      const whole = old.sent.filter((f) => f.t === 'pose');
      assert.equal(whole.length, 40);
      for (const [i, [id, e]] of batch[0].l.entries()) {
        const full = whole[i].p;
        assert.equal(id, 'spk-0001');
        assert.ok(Math.abs(e.y - full.y) <= 0.005 + 1e-9, `${key}: the height kept (${e.y} for ${full.y})`);
        for (const a of ['x', 'z']) {
          if (native) assert.ok(Number.isInteger(e[a]), `${key}: ${a} whole world units on a cell's wire`);
          else assert.ok(Math.abs(e[a] - full[a]) <= 0.005 + 1e-9, `${key}: ${a} kept (${e[a]} for ${full[a]})`);
        }
      }
      // and the screen: the last pose said, as each wire's reader stands it
      const one = stood(key, at, old.sent, false);
      const two = stood(key, at, w2.sent, true);
      assert.ok(one && two, `${key}: the peer stood on both wires`);
      assert.ok(Math.abs(one.y - two.y) <= 0.005 + 1e-9, `${key}: the second wire's peer on the first wire's ground (${two.y} for ${one.y})`);
      assert.ok(Math.abs(one.x - two.x) <= (native ? 0.5 : 0.005) + 1e-9 && Math.abs(one.z - two.z) <= (native ? 0.5 : 0.005) + 1e-9, `${key}: and at its place`);
    });
  }
});
