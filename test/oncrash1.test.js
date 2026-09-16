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
import { OnlineSession, THREW_SAY_MS, lerpPose } from '../src/net/online.js';
import { PeerBodies, peerCamera } from '../src/net/peerBodies.js';
import { withinYaw, turnTowards } from '../src/characters/enemyMotor.js';
import { validPose, validFoeRecord, validSharedFoe, SHARED_EFFECTS_MAX } from '../src/net/wire.js';
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
  // AUDIT ONCRASH1 C4: the WELCOME's world is a SECOND `world` call site, and the first cut drove only the frame's -
  // so leaving this one bare passed. It is the largest single handler call in a session (a whole room's memory) and
  // it arrives at the exact moment the crash reports describe: joining.
  {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => 1000 });
    let ran = false;
    s.onWorld = () => { ran = true; throw new Error('the welcome\'s world threw'); };
    s.join('dungeon:m187853213', pose(0));
    sockets[0].open();
    assert.doesNotThrow(() => sockets[0].receive({ t: 'welcome', id: 'mac-0001', host: 'bob-0001', peers: [], world: { v: 1 } }));
    assert.equal(ran, true, 'the welcome\'s world handler really ran');
    assert.equal(s.threw.kind, 'world');
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

test('ONCRASH1: the throw is SAID - the FULL text on the console once per distinct throw, counted every time, and on the HUD line while it is fresh (mutants: swallowed silently; the text dropped from the line; the second, different throw of a kind never printed)', () => {
  const { s, ws } = session();
  const said = [];
  const realError = console.error;
  console.error = (...a) => said.push(a.join(' '));
  try {
    s.onFoes = () => { throw new Error('boom'); };
    for (let i = 0; i < 3; i++) ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } });
    assert.equal(said.length, 1, 'the SAME throw again is not said again - a stream that throws throws at FOES_HZ_MAX');
    assert.match(said[0], /\[online\] a 'foes' frame threw/);
    assert.match(said[0], /boom/);
    assert.equal(s.stats.threw, 3, 'every one is counted, though only the first is printed');
    // AUDIT ONCRASH1 A5: a DIFFERENT throw of the SAME kind is its own first time. The first cut gated on the kind
    // alone, so error B overwrote the HUD text while the console still held error A's stack - the exact pairing this
    // was built to prevent.
    s.onFoes = () => { throw new Error('a different one'); };
    ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } });
    assert.equal(said.length, 2, 'the second, different foes throw IS said');
    assert.match(said[1], /a different one/);
    s.onAct = () => { throw new Error('door'); };
    ws.receive({ t: 'act', id: 'bob-0001', data: { k: 'x' } });
    assert.equal(said.length, 3);
    assert.match(said[2], /a 'act' frame threw/);
  } finally { console.error = realError; }
  // the HUD line: the player reporting "it crashed" has the KIND and the TEXT - the text is the whole point, and
  // dropping it from the line passed the first cut's pin
  const line = s.statusLine();
  assert.match(line, /a 'act' frame from another player was dropped/);
  assert.match(line, /Error: door/, 'the error itself is on the line, not just that one happened');
  assert.match(s.statusLine('chat'), /^chat: /, 'the label is the session\'s own');
});

test('ONCRASH1 A6: the HUD window is measured on a MONOTONIC clock, so a wall-clock step cannot strand the line (mutant: the window read off Date.now, which is what the session\'s own CLOCK_WARNING asks the player to change)', () => {
  const { s, ws } = session();
  s.onAct = () => { throw new Error('door'); };
  const realError = console.error; console.error = () => {};
  try { ws.receive({ t: 'act', id: 'bob-0001', data: { k: 'x' } }); } finally { console.error = realError; }
  assert.match(s.statusLine(), /was dropped/);
  assert.ok(Number.isFinite(s.threw.mono), 'the stamp the window reads is its own');
  // the wall clock steps a year BACKWARD - the player fixing the clock OL3 just told them to fix. The window is
  // unmoved, because it never read that clock.
  s.threw.at -= 366 * 24 * 3600 * 1000;
  assert.match(s.statusLine(), /was dropped/, 'a backwards step does not strand the line');
  s.threw.mono -= THREW_SAY_MS + 1;
  assert.equal(s.statusLine(), null, 'and the window still closes, on its own reading');
});

test('ONCRASH1 C3: the DOOR is onmessage - a throw in _receive\'s OWN body is contained too, not just the handlers\' (mutant: onmessage left bare, as the first cut had it, which a browser probe caught and the node pins did not)', () => {
  const { s, ws } = session();
  // The roster machinery runs outside every handler: `_member`, `_askWho`, the prune, the projections. Nothing in the
  // first cut stood between a throw there and the window. A peer object the session is about to read is the cheapest
  // way to reach it from outside.
  const boom = new Error('bookkeeping threw');
  Object.defineProperty(s.peers, 'get', { value: () => { throw boom; }, configurable: true });
  const realError = console.error; console.error = () => {};
  try {
    assert.doesNotThrow(() => ws.receive({ t: 'pose', id: 'bob-0001', p: pose(3) }), 'a throw in the frame\'s own bookkeeping escaped');
  } finally { console.error = realError; }
  assert.equal(s.stats.threw, 1);
  assert.equal(s.threw.kind, 'frame', 'said as the FRAME\'s throw - it is not any one handler\'s');
});

test('ONCRASH1 A1: a handler that hands back a PROMISE is followed to its end (mutant: _deliver returning at the first tick, as it did - the dungeon\'s retype arms are exactly this shape and landed as unhandled rejections)', async () => {
  const { s, ws } = session();
  let settled = null;
  s.onFoes = () => { const p = Promise.reject(new Error('the async tail threw')); settled = p; return p; };
  const realError = console.error; console.error = () => {};
  try {
    assert.doesNotThrow(() => ws.receive({ t: 'foes', id: 'bob-0001', data: { r: [] } }));
    await settled.catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
  } finally { console.error = realError; }
  assert.equal(s.stats.threw, 1, 'the rejection was contained, not left for the window');
  assert.equal(s.threw.kind, 'foes');
  assert.match(s.threw.text, /the async tail threw/);
});

test('ONCRASH1: wrapAngle IS a wrap - exact values across (PI, 2PI), the half-open contract at the ends, idempotent (mutants: a CLAMP, identity below 2PI, `<` for `<=` at -PI - all three passed the first cut, which only ever asked for a RANGE)', { timeout: 5000 }, () => {
  assert.equal(1e300 - 2 * Math.PI, 1e300, 'the premise: the loop body those four sites ran is a no-op up here');
  const TAU = 2 * Math.PI;
  // the region that tells a wrap from a clamp and from identity - the first cut never tested one point of it
  for (const a of [3.5, 4, 5, 6, 3.2, TAU - 0.01]) assert.equal(wrapAngle(a), a - TAU, `${a} wraps by a turn`);
  for (const a of [-3.5, -4, -5, -6]) assert.equal(wrapAngle(a), a + TAU, `${a} wraps back`);
  assert.equal(wrapAngle(Math.PI), Math.PI, 'the closed end');
  assert.equal(wrapAngle(-Math.PI), Math.PI, 'the OPEN end - (-PI, PI], so -PI is the same angle as +PI');
  assert.equal(wrapAngle(3 * Math.PI), Math.PI);
  assert.ok(Math.abs(wrapAngle(TAU)) < 1e-15, 'a whole turn is none');
  for (const a of [0, -0.5, 1.25, Math.PI, -Math.PI + 1e-9]) assert.equal(wrapAngle(a), wrapAngle(wrapAngle(a)), `idempotent at ${a}`);
  for (const a of [1e300, -1e300, 1e9, -1e9, 2 ** 53, 1e21]) {
    const r = wrapAngle(a);
    assert.ok(Number.isFinite(r) && r > -Math.PI && r <= Math.PI, `${a} answered ${r} in one step`);
  }
});

test('ONCRASH1: EVERY wrap site answers a huge angle, with the wire\'s door BYPASSED - the door is not the pin (mutant: any one of the four loops restored; the first cut passed all four because validPose had already wrapped the yaw before lerpAngle saw it)', { timeout: 5000 }, () => {
  // AUDIT ONCRASH1 C1: this is the finding. Test four used to drive a peer pose through `_receive`, and every peer
  // pose goes through `validPose`, which wraps - so the value reaching `lerpAngle` was ALREADY inside the turn and a
  // restored loop fell in one step. These calls hand the raw angle straight to each site, which is the only way to
  // pin the downstream half at all. A `{ timeout }` makes a hang a RED: node --test has no default one, so the
  // first cut's "a hung pin is a failed pin" was a hope, not a mechanism - CI would have hung for ever.
  const big = 1e300;
  // 1. net/online.js - lerpPose's angle arm
  const eased = lerpPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 }, { x: 0, y: 0, z: 0, yaw: big, pitch: 0, mv: 0 }, 0.5);
  assert.ok(Number.isFinite(eased.yaw) && Math.abs(eased.yaw) <= Math.PI, `lerpPose answered ${eased.yaw}`);
  // 2. characters/enemyMotor.js - the facing test a puppet's streamed yaw reaches
  assert.equal(withinYaw(big, 0, 1, 45), withinYaw(wrapAngle(big), 0, 1, 45), 'withinYaw answers, and answers the wrapped angle\'s answer');
  assert.equal(typeof turnTowards(big, 0, 1, 10), 'number');
  // 3. net/peerBodies.js - the rig's eased yaw
  const bodies = new PeerBodies({ renderer: null, enabled: () => false });
  assert.equal(typeof bodies.heightOf('nobody'), 'number', 'the body pool stands with no rig');
  const cam = peerCamera({ yaw: big, mv: 0 }, [0, 0, 0], 0);
  assert.equal(cam.yaw, big, 'peerCamera carries the yaw it is handed - the wrap is the rig\'s, at its own diff');
  // 4. the session end to end, through the door as a player really meets it
  let now = 1000;
  const { s, ws } = session({ now: () => now });
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(1, 0) });
  now += 50;
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(2, big) });
  now += 50;
  s.tick();
  const drawn = s.peers.get('bob-0001').shown;
  assert.ok(Number.isFinite(drawn.yaw) && Math.abs(drawn.yaw) <= Math.PI, 'and the drawn yaw is one a camera can use');
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

test('ONCRASH1 C2: THE SWEEP IS A SWEEP - no hand-rolled angle wrap anywhere under src/ or server/, however it is spelled (mutants that all walked past the first cut\'s regex: a hoisted TAU constant, `for (;;)`, a recursive wrap, and `while (Math.abs(dy) > Math.PI)`, whose own parenthesis broke its character class)', () => {
  // The first cut matched /while\s*\([^)]*Math\.PI[^)]*\)/ and called it generative. It was a SPELLING test: blind
  // to a hoisted constant, a for-loop, a recursion, and to a nested call inside the condition - the last of which is
  // the most natural way the next author would write it.
  //
  // What every hand-rolled wrap has in common is not its loop: it is STEPPING A VALUE BY A WHOLE TURN. So that is
  // what this looks for, and it resolves each file's own names for a turn first, which is what defeated the regex.
  // It is still a smoke alarm and this test says so: what PROVES no wrap can hang is the executing pin above, which
  // drives every site with the wire's door bypassed.
  const TURN = String.raw`(?:2\s*\*\s*Math\.PI|Math\.PI\s*\*\s*2|6\.283\d*)`;
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL('../' + dir + '/', import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(`${dir}/${e.name}`); }
      else if (e.name.endsWith('.js')) files.push(`${dir}/${e.name}`);
    }
  };
  walk('src'); walk('server/src');   // the relay re-exports net/wire.js, so its own tree is swept too
  const offenders = [];
  for (const f of files) {
    if (f === 'src/world/mat4.js') continue;   // the ONE home; its body is pinned by exact value above
    const text = code(f);
    // this file's own names for a whole turn - `const TAU = 6.283...`, `const T = 2 * Math.PI`
    const names = [];
    for (const m of text.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*${TURN}`, 'g'))) names.push(m[1]);
    const turn = names.length ? `(?:${TURN}|\\b(?:${names.join('|')})\\b)` : TURN;
    // the shape: a value stepped by a whole turn, INSIDE a loop (a while, a for, a for(;;)) or by a function calling
    // ITSELF - which is every hand-rolled wrap and none of the honest full-turn arithmetic (a random bearing, a
    // shader's modulo) that a game engine is full of.
    const step = new RegExp(String.raw`[-+]=\s*[^;\n]*${turn}|[-+]\s*${turn}`);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!step.test(lines[i])) continue;
      const near = lines.slice(Math.max(0, i - 2), i + 3).join(' ');
      const inLoop = /\b(?:while|for)\s*\(/.test(near);
      const selfCall = new RegExp(String.raw`\b([A-Za-z_$][\w$]*)\s*\([^)]*[-+]\s*[^)]*${turn}`).exec(lines[i]);
      const recurses = selfCall && new RegExp(String.raw`(?:function\s+|const\s+|let\s+)${selfCall[1]}\b`).test(text);
      if (inLoop || recurses) offenders.push(`${f}:${i + 1}`);
    }
  }
  assert.deepEqual(offenders, [], `a value stepped by a whole turn - the shape of every hand-rolled wrap: ${offenders.join(', ')}. Use world/mat4.js wrapAngle, which answers in one step whatever the input.`);
  assert.match(code('src/world/mat4.js'), /export function wrapAngle\s*\(/, 'the wrap lives in the math module');
  assert.match(code('src/player/lockOn.js'), /from '\.\.\/world\/mat4\.js'/, 'lockOn no longer carries its own body');
});

test('ONCRASH1 A3: validSharedFoe IS the memory\'s door - every field by its own law, a bad one refusing the record WHOLE, a vocabulary it will not say it will not hear (mutant: the feet checked for being an array and nothing else, which is what patchFoe throws on)', () => {
  const ok = validSharedFoe({ health: 10, maxHealth: 20, dead: false, feet: [1, 2, 3], yaw: 0.5, mobileType: 3, gender: 'male', team: 2, hostile: 1 });
  assert.deepEqual(ok.feet, [1, 2, 3]);
  assert.equal(ok.yaw, 0.5, 'an ordinary record passes through unmoved');
  assert.equal(ok.hostile, true, 'the flags are booleans, whatever the memory wrote');
  // THE FEET are what `patchFoe` indexes - `f.ai.feet[0] = sf.feet[0]` - and an absent or short one is the throw the
  // incident in that function's own comment describes
  for (const feet of [[1, 2], [1, 2, 3, 4], ['a', 2, 3], [NaN, 0, 0], [Infinity, 0, 0], 'xyz', {}, null]) {
    assert.equal(validSharedFoe({ health: 1, feet }), null, `feet ${JSON.stringify(feet)} refuses the record whole`);
  }
  assert.equal(validSharedFoe({ feet: [1e9, 0, 0] }), null, 'and past the world\'s bound, as a pose is');
  assert.equal(validSharedFoe({ feet: [0, 1e9, 0] }), null, 'the sky\'s bound too');
  // THE YAW reaches the puppet's facing and the rig's turn
  assert.equal(validSharedFoe({ yaw: 'x' }), null);
  assert.equal(validSharedFoe({ yaw: NaN }), null);
  assert.ok(Math.abs(validSharedFoe({ yaw: 1e300 }).yaw) <= Math.PI, 'a huge one is wrapped, not admitted');
  // THE NUMBERS are bounded, not merely finite
  for (const k of ['health', 'maxHealth', 'magicka', 'fatigue']) {
    assert.equal(validSharedFoe({ [k]: 1e300 }), null, `${k} past the bound`);
    assert.equal(validSharedFoe({ [k]: 'x' }), null, `${k} not a number`);
    assert.equal(validSharedFoe({ [k]: 5 })[k], 5, `${k} ordinary`);
  }
  assert.equal(validSharedFoe({ mobileType: 900 }), null);
  assert.equal(validSharedFoe({ mobileType: 1.5 }), null);
  assert.equal(validSharedFoe({ gender: 'x'.repeat(40) }), null);
  // THE VOCABULARY: what sharedWorld deletes, this does not admit (AUDIT WORLD4 D3's law)
  assert.equal(validSharedFoe({ health: 1, items: [{ a: 1 }] }).items, undefined, 'a foe\'s item list is not the memory\'s to carry');
  assert.equal(validSharedFoe({ health: 1, somethingNew: 7 }).somethingNew, undefined, 'a field outside the law is dropped, never passed along');
  // and the one list that could grow without bound is bounded
  const many = validSharedFoe({ activeEffects: Array.from({ length: 500 }, () => ({ effect: { key: 'x' } })) });
  assert.ok(many.activeEffects.length <= SHARED_EFFECTS_MAX && many.activeEffects.length > 0);
  assert.equal(validSharedFoe(null), null);
  assert.equal(validSharedFoe([1, 2]), null);
});

test('ONCRASH1 A2/A3/B4a: the three doors a stranger\'s foe comes through - the memory\'s records projected and the latch taken LAST, the dungeon\'s stream through the wire\'s own door (mutants: the latch back in front of the apply; the foes left raw; validFoeRecord dropped from the stream)', () => {
  const d = code('src/scenes/dungeonContext.js');
  // A3: the memory's foes projected, like its actions
  assert.match(d, /shared\.world\.foes\.slice\(0, _layoutFoes\)\.map\(validSharedFoe\)\.filter\(Boolean\)/, 'the memory\'s foe records go through the wire');
  // A2: the latch is the LAST thing - a throw half way leaves it DOWN and the host's next publish retries
  const body = d.slice(d.indexOf('restoreSharedWorld(shared)'));
  const applyAt = body.indexOf('applyLoot(shared.world.loot)');
  const latchAt = body.indexOf('_sharedApplied = true');
  assert.ok(applyAt > 0 && latchAt > applyAt, 'the latch is set AFTER both applies, never before - a half-applied memory must be retried, not remembered as done');
  // B4a: the stream's own door
  assert.match(d, /const r = validFoeRecord\(raw\);\s*if \(!r\) return;/, 'the dungeon\'s stream projects its records, as the exterior cell always has');
  assert.match(d, /validFoeRecord/, 'and it imports the wire\'s door rather than checking by hand');
  // A4: the heartbeat is the APPLY's word
  assert.match(code('src/scenes/world.js'), /if \(modes\?\.applyDungeonFoes\?\.\(id, data\) && modes\?\.mode === 'dungeon'\) _foesInAt = performance\.now\(\);/, 'a frame that did not apply is no heartbeat');
  // B5d: the SAVE is a door too - ONCRASH1 said the angle defect was not reachable offline; it was, here
  assert.match(code('src/scenes/world.js'), /if \(Number\.isFinite\(pose\.yaw\)\) cam\.yaw = wrapAngle\(pose\.yaw\);/, 'a save\'s yaw is bounded like the wire\'s');
  // B5a: the collider's substep count has a ceiling of its own, not one held by its callers
  assert.match(code('src/player/collider.js'), /const n = Math\.min\(SUBSTEPS_MAX, Math\.ceil\(maxComp \/ maxStep\)\);/, 'no caller\'s arithmetic can buy an unbounded sweep');
});
