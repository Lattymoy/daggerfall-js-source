// ONCRASH1 (2026-09-15, Mac: "Receiving reports of player browser crashing when online"): THE TWO WAYS A RELAY
// FRAME ENDED SOMEBODY ELSE'S RUN.
//
// 1. THE SEAM. `_receive` runs inside the WebSocket's `onmessage`, and the handlers it calls are the port's whole
//    foe, world and door machinery. Nothing stood between a throw in there and main.js's
//    `addEventListener('error')`, so one bad frame put the red CRASH overlay over every reader's screen - and the
//    next stream tick put it there again. Contained, counted and SAID now.
// 2. THE WRAP. Four sites hand-rolled `while (d > Math.PI) d -= 2 * Math.PI` beside the port's own one-step
//    wrapAngle, and two of them are fed a PEER'S YAW - checked for being finite and nothing else. At a large
//    angle the subtraction is a no-op in doubles and the loop never falls: the reader's tab hangs until the
//    browser kills it. One wrap now (world/mat4.js), and the wire's door bounds the angle besides.
//
// These pins EXECUTE: a real OnlineSession over the fake socket, handlers that really throw, a peer pose that
// really carries 1e300. A hung pin is a failed pin - the old code could not finish test four at all.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { OnlineSession, THREW_SAY_MS } from '../src/net/online.js';
import { validPose, validFoeRecord } from '../src/net/wire.js';
import { wrapAngle } from '../src/world/mat4.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/** Comments are not law: a pin that matches one is matching prose. */
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const pose = (x, yaw = 0) => ({ x, y: 0, z: 0, yaw, pitch: 0, mv: 0 });

/** A session joined and open on a world room, with a peer already known. */
function session({ now = () => 1000 } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now });
  s.join('dungeon:m187853213', pose(0));
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', host: 'bob-0001', peers: [{ id: 'bob-0001', name: 'Bob', look: {}, pose: pose(1) }] });
  return { s, ws: sockets[0] };
}

test('ONCRASH1: a handler that throws does not reach the window - the frame is dropped, the session stands, and the NEXT frame is still heard (mutant: the callback called bare, as it was)', () => {
  const { s, ws } = session();
  let calls = 0;
  s.onFoes = () => { calls++; throw new TypeError('cannot read properties of null (reading \'ai\')'); };
  // the throw is the game's own, deep inside the puppet pool; what matters is that onmessage returns
  assert.doesNotThrow(() => ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } }));
  assert.equal(calls, 1, 'the handler really ran');
  assert.equal(s.stats.threw, 1);
  assert.equal(s.threw.kind, 'foes');
  assert.match(s.threw.text, /TypeError: cannot read properties of null/);
  assert.equal(s.status, 'open', 'the session is not torn down by a bad frame');
  // and the room goes on: the session still hears the next frame, from this peer and from the relay
  s.onFoes = () => { calls++; };
  assert.doesNotThrow(() => ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } }));
  assert.equal(calls, 2);
  assert.equal(s.stats.threw, 1, 'a frame that did not throw does not count');
});

test('ONCRASH1: EVERY handler out of _receive is contained, not just the foes stream - world, foes, hit, act, chat, host, clock (mutant: any ONE call site left bare)', () => {
  // The arms, each with the frame that reaches it. `host` and `clock` ride the welcome; the rest are their own frame.
  const arms = [
    ['world', 'onWorld', { t: 'world', id: 'bob-0001', data: { v: 1 } }],
    ['foes', 'onFoes', { t: 'foes', id: 'bob-0001', data: { r: [] } }],
    ['hit', 'onHit', { t: 'hit', id: 'bob-0001', data: { i: 1, d: 5 } }],
    ['act', 'onAct', { t: 'act', id: 'bob-0001', data: { k: 'door' } }],
    ['chat', 'onChat', { t: 'chat', id: 'bob-0001', name: 'Bob', text: 'hello' }],
  ];
  for (const [kind, hook, frame] of arms) {
    const { s, ws } = session();
    if (kind === 'hit') s.host = s.id;   // a blow is mine to apply only while I host; the world and foes arms want the HOST's frame, which is Bob's
    let ran = false;
    s[hook] = () => { ran = true; throw new Error(`${kind} threw`); };
    assert.doesNotThrow(() => ws.receive(frame), `a '${kind}' frame escaped its catch`);
    assert.equal(ran, true, `the '${kind}' handler never ran - the pin proved nothing`);
    assert.equal(s.threw.kind, kind);
    assert.equal(s.stats.threw, 1);
  }
  // the host change: the biggest handler of the lot (it swaps who steps the room's foes)
  {
    const { s, ws } = session();
    let ran = false;
    s.onHost = () => { ran = true; throw new Error('host threw'); };
    assert.doesNotThrow(() => ws.receive({ t: 'host', id: 'carol-01' }));
    assert.equal(ran, true);
    assert.equal(s.threw.kind, 'host');
    assert.equal(s.host, 'carol-01', 'the host still changed - the throw is the handler\'s, not the session\'s bookkeeping');
  }
  // the clock, off the welcome
  {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => 1000 });
    s.onClock = () => { throw new Error('clock threw'); };
    s.join('dungeon:m187853213', pose(0));
    sockets[0].open();
    assert.doesNotThrow(() => sockets[0].receive({ t: 'welcome', id: 'mac-0001', host: 'mac-0001', peers: [], now: Date.now() }));
    assert.equal(s.threw.kind, 'clock');
  }
});

test('ONCRASH1: the throw is SAID - in full on the console once a kind, counted every time, and on the HUD line while it is fresh (mutant: swallowed silently, which is the drawn door PX14 forbids)', () => {
  let now = 1000;
  const { s, ws } = session({ now: () => now });
  const said = [];
  const realError = console.error;
  console.error = (...a) => said.push(a.join(' '));
  try {
    s.onFoes = () => { throw new Error('boom'); };
    ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } });
    ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } });
    ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } });
    assert.equal(said.length, 1, 'a stream that throws throws at FOES_HZ_MAX - the console is not flooded');
    assert.match(said[0], /\[online\] a 'foes' frame threw/);
    assert.match(said[0], /boom/);
    assert.equal(s.stats.threw, 3, 'every one is counted, though only the first is printed');
    // a DIFFERENT kind is its own first time
    s.onAct = () => { throw new Error('door'); };
    ws.receive({ t: 'act', id: 'bob-0001', data: { k: 'x' } });
    assert.equal(said.length, 2);
    assert.match(said[1], /a 'act' frame threw/);
  } finally { console.error = realError; }
  // the HUD line: the player reporting "it crashed" now has the line naming the frame
  assert.match(s.statusLine(), /a 'act' frame from another player was dropped/);
  now += THREW_SAY_MS - 1;
  assert.match(s.statusLine(), /was dropped/, 'still said while it is fresh');
  now += 2;
  assert.equal(s.statusLine(), null, 'one transient frame does not brand the session for ever');
});

test('ONCRASH1: a peer yaw of 1e300 eases in ONE STEP - the wrap cannot loop, at the door or downstream (mutant: the while-loop wrap, which never returns from this test at all)', () => {
  // wrapAngle itself, on the numbers that killed the loop: 1e300 - 2*PI === 1e300 in doubles.
  assert.equal(1e300 - 2 * Math.PI, 1e300, 'the premise: the loop body is a no-op up here');
  for (const a of [1e300, -1e300, 1e9, -1e9, 3 * Math.PI, 0, -0.5]) {
    const r = wrapAngle(a);
    assert.ok(Number.isFinite(r) && r > -Math.PI - 1e-9 && r <= Math.PI + 1e-9, `${a} wrapped to ${r}`);
  }
  assert.equal(wrapAngle(3 * Math.PI), Math.PI, 'the arc is unchanged for the angles the port already wrapped');
  // and the session eases a peer through it: this is where the hang was - tick() over a peer whose last two
  // poses differ by a huge angle. Reaching the assert at all is the pin.
  let now = 1000;
  const { s, ws } = session({ now: () => now });
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(1, 0) });
  now += 50;
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(2, 1e300) });
  now += 50;
  s.tick();
  const drawn = s.peers.get('bob-0001').shown;
  assert.ok(Number.isFinite(drawn.yaw), 'the drawn yaw is a number a camera can use');
  assert.ok(Math.abs(drawn.yaw) <= Math.PI + 1e-9, 'and one the rig can turn to');
});

test('ONCRASH1: the wire BOUNDS an angle like every other field - a pose\'s yaw and pitch and a foe record\'s yaw wrapped at the door, idempotent for an ordinary one (mutant: finite and nothing else, as it was)', () => {
  const p = validPose({ x: 0, y: 0, z: 0, yaw: 1e300, pitch: 0, mv: 0 });
  assert.ok(p && Math.abs(p.yaw) <= Math.PI, 'the yaw is inside the turn, not 1e300');
  const q = validPose({ x: 0, y: 0, z: 0, yaw: 3 * Math.PI, pitch: -0.4, mv: 0 });
  assert.equal(q.yaw, Math.PI);
  assert.equal(q.pitch, -0.4, 'an ordinary pitch is untouched - the wrap is idempotent inside the turn');
  const ok = validPose({ x: 1, y: 2, z: 3, yaw: 1.25, pitch: -0.4, mv: 1 });
  assert.equal(ok.yaw, 1.25, 'and so is an ordinary yaw: a legitimate pose is not moved');
  // a NON-finite one is still refused outright - a wrap of NaN is NaN, and NaN must never reach the scene
  assert.equal(validPose({ x: 0, y: 0, z: 0, yaw: NaN, pitch: 0 }), null);
  assert.equal(validPose({ x: 0, y: 0, z: 0, yaw: Infinity, pitch: 0 }), null);
  // the foe record's yaw is the same field by another name - it reaches enemyMotor's wrap through the puppet
  const r = validFoeRecord({ i: 7, y: 1e300 });
  assert.ok(r && Math.abs(r.y) <= Math.PI);
  assert.equal(validFoeRecord({ i: 7, y: 0.5 }).y, 0.5);
  assert.equal(validFoeRecord({ i: 7, y: Infinity }), null);
});

test('ONCRASH1: there is ONE angle wrap in src/, and it is not a loop - a fifth hand-rolled copy is the defect coming back (generative: the whole tree, comments stripped)', () => {
  // The four that existed: net/online.js, net/peerBodies.js, characters/enemyMotor.js, combat/fpArm.js - each
  // beside a correct one-step wrap in player/lockOn.js that none of them knew about.
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL('../' + dir + '/', import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.js')) files.push(`${dir}/${e.name}`);
    }
  };
  walk('src');
  const loops = files.filter((f) => /while\s*\([^)]*Math\.PI[^)]*\)/.test(code(f)));
  assert.deepEqual(loops, [], `an angle wrapped by a LOOP: ${loops.join(', ')} - use world/mat4.js wrapAngle, which answers in one step`);
  // and the one home is where the callers can reach it
  const home = code('src/world/mat4.js');
  assert.match(home, /export function wrapAngle\s*\(/, 'the wrap lives in the math module');
  assert.match(code('src/player/lockOn.js'), /from '\.\.\/world\/mat4\.js'/, 'lockOn no longer carries its own body');
  for (const f of ['src/net/online.js', 'src/net/peerBodies.js', 'src/net/wire.js', 'src/characters/enemyMotor.js', 'src/combat/fpArm.js']) {
    assert.match(code(f), /wrapAngle/, `${f} wraps through the one home`);
  }
});
