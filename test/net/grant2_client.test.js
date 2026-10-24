// GRANT2 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md section 12): THE CLIENT'S ASKS -
// net/online.js reads its cell's law off the welcome (`gm`, from world218), asks down its own cell's socket alone on the
// relay's own bucket, and hears the answer; scenes/grantHost.js askGrant asks for the encounters and camps scenes/world.js
// stands, never awaited.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession } from '../../src/net/online.js';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { GRANT_BURST_MAX } from '../../src/net/grantLaw.js';
import { createGrantHost } from '../../src/scenes/grantHost.js';

const ON = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0 };
const CELL = cellRoomOfWire(ON.x, ON.z);
const quiet = (fn) => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };

function rig(room, welcome = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const heard = [];
  s.onGrant = (g) => heard.push(g);
  quiet(() => s.join(room, { ...ON }));
  const ws = sockets[0];
  ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: 'world218', gm: 'measure', ...welcome }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'grant');
  return { s, ws, heard, out, sockets, tick: (ms) => { t += ms; } };
}

test('GRANT2 THE SESSION: a cell\'s welcome from world218 says its law (GRANT4: a world room\'s too; GRANT6: unsaid until it comes); an older relay\'s, a town\'s or `off` asks nothing (an older relay closes the socket on one); an ask goes down my cell\'s socket whole, on the relay\'s own bucket; my cell\'s answer is heard, and its `off` stops the asks (mutants: the version unchecked; the bucket not kept)', () => {
  const old = rig(CELL, { v: 'world217' });
  assert.equal(old.s.grantMode, 'off');
  assert.equal(old.s.sendGrant({ k: 'mint', id: 1, kind: 'enc', n: 1 }), false);
  assert.equal(old.out().length, 0, 'nothing on the wire of a relay that would close the socket for it');
  assert.equal(rig('dungeon:m123456').s.grantMode, 'measure', 'GRANT4: a world room\'s own lane asks too');
  assert.equal(rig('town:m123456').s.grantMode, 'off', 'a room whose foes ride nothing asks nothing');
  const { FakeWS, sockets } = fakeSocketClass();
  const early = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  quiet(() => early.join(CELL, { ...ON }));
  sockets[0].open();
  assert.equal(early.grantMode, null, 'GRANT6: a socket open, its welcome owed - the law unsaid');
  assert.equal(early.sendGrant({ k: 'mint', id: 1, kind: 'enc', n: 1 }), false, 'and nothing asked of it');
  assert.equal(rig(CELL, { gm: 'off' }).s.grantMode, 'off');
  assert.equal(rig(CELL, { gm: undefined }).s.grantMode, 'off', 'a welcome that says no law');
  const { s, ws, heard, out, tick } = rig(CELL);
  assert.equal(s.grantMode, 'measure');
  assert.equal(s.sendGrant({ k: 'mint', id: 1, kind: 'enc', n: 5 }), false, 'past its kind: never sent');
  assert.equal(s.sendGrant({ k: 'mint', id: 1, kind: 'enc', n: 3 }), true);
  assert.deepEqual(out(), [{ t: 'grant', k: 'mint', id: 1, kind: 'enc', n: 3 }]);
  for (let i = 1; i < GRANT_BURST_MAX; i++) assert.equal(s.sendGrant({ k: 'mint', id: 1 + i, kind: 'camp', n: 4 }), true);
  assert.equal(s.sendGrant({ k: 'mint', id: 99, kind: 'enc', n: 1 }), false, 'the relay\'s bucket, kept at home');
  tick(500);
  assert.equal(s.sendGrant({ k: 'mint', id: 99, kind: 'enc', n: 1 }), true, 'two a second');
  ws.receive({ t: 'grant', k: 'no', id: 99, r: 'bucket' });
  ws.receive({ t: 'grant', k: 'no', id: 99, r: 'because' });
  assert.deepEqual(heard, [{ k: 'no', id: 99, r: 'bucket' }], 'an answer read whole');
  ws.receive({ t: 'grant', k: 'off', id: 100 });
  assert.equal(s.grantMode, 'off', 'the law turned off: no more asks');
  tick(5000);
  assert.equal(s.sendGrant({ k: 'mint', id: 101, kind: 'enc', n: 1 }), false);
});

test('GRANT2-GRANT3 THE HOST WIRED: world.js makes one grants\' host, hands it to the pool\'s net and its session\'s answers; a wanderer stands on an encounter\'s grant (a revenant on its own kind), a chunk\'s camp on a camp\'s, a band on a band\'s, a bounty\'s pack on a bounty\'s - each named on the line its stand already had (mutants: the camp\'s kind dropped; the wanderer\'s kind dropped)', () => {
  const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(W, /const grants = createGrantHost\(\{ session: \(\) => online, climateAt: \(x, y\) => maps\.getClimateIndex\(x, y\) \}\);/);
  assert.match(W, /online\.onGrant = \(g\) => grants\.answer\(g\);/);
  assert.match(W, /\n\s+grants,\s+\/\/ GRANT3: my stands' grants/);
  assert.match(W, /yaw: Math\.atan2\(feet\[0\] - spot\.x, feet\[2\] - spot\.z\), grantKind: hit\.revenant \? 'rev' : 'enc',/);
  assert.match(W, /\.\.\.\(hit\.spawnOpts \?\? \{\}\), grantKind: hit\.fixed \? 'bounty' : hit\.kind === 'band' \? 'band' : 'camp',/);
  assert.equal(typeof createGrantHost, 'function');
});
