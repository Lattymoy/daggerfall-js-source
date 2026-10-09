// PERF-RELAY1 (2026-10-09, Mac: "Yes and audit everything", of PERF-NEXT item 15 - bible/07-Rendering/Performance-Next.md;
// bible/11-Multiplayer/Scale-Arc.md PERF-RELAY1): THE RELAY'S POSE PATH, FASTER AND THE SAME.
//
// ONE: `inRangeOf(key, from)` answers inRange(key, from, to) for every `to` - over keys of every kind and poses of every
// shape the wire can carry (absent, empty, NaN, an exact pixel edge, a negative coordinate), so the relay's fan asks the
// same question it asked, with the sender's pixel derived once.
// TWO: a room's fan is the law's - every pose a moving player says reaches exactly the listeners
// `poseFan(heard by inRange, ...)` names, and a keepalive exactly everyone in range, over a crowd past POSE_FAN_MAX with
// listeners out of range among it (the index walked in place, never a socket the fan did not name).
// THREE: the pose path is a method V8 will optimize - `_poseFrame`'s bytecode under --max-optimized-bytecode-size, where
// `_message`, which held it, is over.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { inRange, inRangeOf, poseFan, PIXEL_UNITS, POSE_FAN_MAX, POSE_HZ_MAX, RANGE_PIXELS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';

const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('PERF-RELAY1: inRangeOf(key, from)(to) is inRange(key, from, to) for every key kind and every pose shape - absent, empty, NaN, infinite, a pixel edge, either side of zero (mutants: the range one pixel wider, an absent listener in range, a non-world room culled)', () => {
  assert.equal(relay.inRangeOf, inRangeOf, 'one home, both ends');
  const rnd = mul(637);
  const keys = ['world:13,13', 'world:', 'world:-1,0', 'World:13,13', 'cell:13,13', 'chat:general', 'social', '', null, undefined];
  const odd = [null, undefined, 0, 5, 'abc', {}, { x: NaN, z: 0 }, { x: 0, z: NaN }, { x: Infinity, z: 0 }, { x: 0 }, { z: 0 }];
  const near = () => {   // a pose within a few pixels of the origin's, on an edge a third of the time
    const px = Math.floor(rnd() * 2 * (RANGE_PIXELS + 3)) - (RANGE_PIXELS + 3), pz = Math.floor(rnd() * 2 * (RANGE_PIXELS + 3)) - (RANGE_PIXELS + 3);
    const edge = rnd() < 1 / 3;
    return { x: (px + (edge ? 0 : rnd())) * PIXEL_UNITS, y: 0, z: (pz + (edge ? 0 : rnd())) * PIXEL_UNITS, yaw: 0, pitch: 0, mv: 1 };
  };
  const poses = [...odd, { x: -0, z: -0 }, { x: -1e-9, z: 0 }, ...Array.from({ length: 60 }, near)];
  let asked = 0, yes = 0;
  for (const k of keys) {
    for (const from of poses) {
      const reach = inRangeOf(k, from);
      for (const to of poses) {
        const want = inRange(k, from, to);
        assert.equal(reach(to), want, `inRangeOf(${JSON.stringify(k)}, ${JSON.stringify(from)})(${JSON.stringify(to)})`);
        if (String(k ?? '').startsWith('world:')) { asked++; if (want) yes++; }
      }
    }
  }
  assert.ok(yes > asked / 8 && yes < asked * 7 / 8, `both answers asked often in a world room (${yes} of ${asked} in range)`);
});

test('PERF-RELAY1: a room\'s fan is the law\'s - every moving pose reaches exactly the listeners poseFan names over those inRange hears, a keepalive exactly everyone in range, and a listener out of range never (mutants: the sender in its own fan, an id-less socket heard, the range read off the sender\'s last pose)', async () => {
  const realNow = Date.now;
  let clock = realNow();
  Date.now = () => clock;
  const quiet = { info: console.info, warn: console.warn, log: console.log };
  console.info = () => {}; console.warn = () => {}; console.log = () => {};
  try {
    const N = POSE_FAN_MAX + 28, FAR = 8;   // past the bound, with a few out of range among it and a few on its edge
    const bx = 13 * 16 + 8, by = 13 * 16 + 8;
    const key = `world:${Math.floor(bx / 16)},${Math.floor(by / 16)}`;
    const R = fakeRoom(key, { now: () => clock });
    const rnd = mul(15);
    // the crowd stands in the block's middle pixel; FAR of it stands RANGE_PIXELS + 2 pixels east, out of its range, and
    // FAR more walk the range's edge - RANGE_PIXELS east on an even round, one past it on an odd - all in the one room
    const at = (i, round) => { const off = i < FAR ? RANGE_PIXELS + 2 : i < 2 * FAR ? RANGE_PIXELS + (round & 1) : 0; return { x: (bx + off + rnd()) * PIXEL_UNITS, y: 0, z: (499 - by + rnd()) * PIXEL_UNITS, yaw: rnd() * 3, pitch: 0, mv: 1 }; };
    const socks = [];
    for (let i = 0; i < N; i++) {
      const ws = R.connect();
      clock += 200;   // past the room's hello gate
      await R.hello(ws, `peer-${String(i).padStart(4, '0')}`, at(i, 0));
      assert.equal(ws.closed, null, `hello ${i} taken`);
      socks.push(ws);
    }
    // a socket in the index with a pose and no id - what a replaced one is until the index lets it go (index.js's hello:
    // `{ ...b, id: null, replaced: true }`), kept open here so a send to it is seen: heard by nobody's fan
    const lurker = R.connect();
    Object.assign(R.room._attach(lurker), { pose: at(2 * FAR, 0), replaced: true });
    const idOf = (ws) => R.room._attach(ws).id;
    // the law, asked of the room as it stands before the pose: inRange per listener over a copy of the index, as the arm
    // asked it before PERF-RELAY1
    const expect = (ws, p, still) => {
      const heard = [];
      for (const [other, b] of [...R.room._all()]) if (other !== ws && b.id && inRange(key, p, b.pose)) heard.push([other, b]);
      if (still) return { set: new Set(heard.map((e) => e[0])), heard: heard.length };
      const turn = ((R.room._attach(ws).turn | 0) + 1) & 0xffff;
      return { set: new Set(poseFan(heard, p, (e) => e[1].pose, turn, (e) => e[1].id).map((e) => e[0])), heard: heard.length };
    };
    const say = async (ws, p) => {
      for (const s of [...socks, lurker]) s.sent.length = 0;
      await R.pose(ws, p);
      const id = idOf(ws);
      return new Set([...socks, lurker].filter((s) => s.sent.some((f) => f.t === 'pose' && f.id === id)));
    };
    let moving = 0, kept = 0, farHeard = 0, tiered = 0, edge = [0, 0];
    for (let round = 0; round < 6; round++) {
      clock += Math.ceil(1000 / POSE_HZ_MAX) + 1;
      for (let i = 0; i < N; i++) {
        const ws = socks[i], p = at(i, round);
        const want = expect(ws, p, false);
        const got = await say(ws, p);
        assert.deepEqual([...got].map(idOf).sort(), [...want.set].map(idOf).sort(), `round ${round}: peer ${i}'s pose reached the law's listeners`);
        assert.ok(!got.has(ws) && !got.has(lurker), 'never the sender, never a socket without an id');
        if (i >= 2 * FAR) for (let j = 0; j < FAR; j++) if (got.has(socks[j])) farHeard++;
        if (i >= 2 * FAR) for (let j = FAR; j < 2 * FAR; j++) if (got.has(socks[j])) edge[round & 1]++;
        if (want.set.size < want.heard) tiered++;
        moving++;
      }
    }
    // a keepalive: the pose each peer last said, said again once KEEPALIVE_FAN_MS has passed - heard by all in range
    clock += 60_000;
    for (let i = 0; i < N; i++) {
      const ws = socks[i], p = { ...R.room._attach(ws).pose };
      const want = expect(ws, p, true);
      const got = await say(ws, p);
      assert.deepEqual([...got].map(idOf).sort(), [...want.set].map(idOf).sort(), `keepalive ${i}: everyone in range`);
      kept++;
    }
    assert.equal(farHeard, 0, 'a listener out of range heard nobody in the crowd');
    assert.ok(edge[0] > 0 && edge[1] === 0, `a listener on the edge heard the crowd from inside it and never from one past it (${edge})`);
    assert.ok(tiered > N, `the far tier was exercised (${tiered} tiered fans of ${moving})`);
    assert.equal(kept, N);
  } finally {
    Date.now = realNow;
    Object.assign(console, quiet);
  }
});

test('PERF-RELAY1: the pose path is a method V8 optimizes - _poseFrame\'s bytecode under --max-optimized-bytecode-size and under an eighth of it, one such function in the relay\'s whole graph (an arm folded back into _message leaves no _poseFrame to print); _message\'s size said beside it, the reason the arm moved', (t) => {
  const opts = spawnSync(process.execPath, ['--v8-options'], { encoding: 'utf8' }).stdout;
  const ceiling = Number(/default: --max-optimized-bytecode-size=(\d+)/.exec(opts)?.[1]);
  assert.ok(ceiling > 0, 'this node says its ceiling');
  // AUDIT PERF-RELAY1 L1: the relay by its URL, not by the directory the suite runs from
  const entry = new URL('../server/src/index.js', import.meta.url).href;
  const lengths = (fn) => {
    const out = spawnSync(process.execPath, ['--no-lazy', '--print-bytecode', `--print-bytecode-filter=${fn}`, '--input-type=module', '-e', `await import(${JSON.stringify(entry)})`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const all = [...out.stdout.matchAll(new RegExp(`\\[generated bytecode for function: ${fn} [^\\n]*\\]\\n(?:[^\\n]*\\n){0,4}?Bytecode length: (\\d+)`, 'g'))].map((m) => Number(m[1]));
    assert.ok(all.length, `${fn}'s bytecode printed (${out.stderr.slice(0, 200)})`);
    return all;
  };
  const pose = lengths('_poseFrame');
  assert.equal(pose.length, 1, `one _poseFrame in the relay's graph (AUDIT PERF-RELAY1 L2: the first printed was the one measured) - ${pose}`);
  assert.ok(pose[0] < ceiling, `_poseFrame is ${pose[0]} bytes of bytecode, under ${ceiling}`);
  assert.ok(pose[0] < ceiling / 8, `and under an eighth of it - room for the arm to grow (${pose[0]})`);
  // AUDIT PERF-RELAY1 L2: said, not pinned - `_message` under the ceiling one day (more arms moved out) is a better relay
  const msg = lengths('_message');
  t.diagnostic(`_message: ${msg.join(', ')} bytes of bytecode against the ceiling's ${ceiling}${msg.some((n) => n > ceiling) ? ' - over it, and so never optimized' : ''}`);
});
