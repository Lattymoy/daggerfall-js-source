import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession } from '../src/net/online.js';
import { relaySupportsFoeInventory, parseClient, validFoeRecord, RELAY_VERSION } from '../src/net/wire.js';
import { goldStack } from '../src/systems/inventory.js';

function client(version) {
  const sockets = [];
  class FakeWS {
    constructor() { this.sent = []; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() {}
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  const s = new OnlineSession({ id: 'ann-0001', secret: 'secret-of-ann-0001', WebSocketImpl: FakeWS, now: () => 10000 });
  s.join('world:3,12', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.onopen?.();
  ws.receive({ t: 'welcome', id: 'ann-0001', peers: [], v: version });
  return { s, ws };
}

test('FG-03: inventory handover waits for the required advertised relay protocol', () => {
  for (const version of [undefined, 'world154', 'world155', 'world156', 'world157', 'world158', 'world159', 'world160', 'world161', 'world162', 'world163', 'world164', 'world165', 'world166', 'world167', 'world168', 'world169']) {
    const { s, ws } = client(version);
    const items = [goldStack(125)];
    const data = { n: 1, k: s.room, full: 0, f: [{ i: 1, t: 0, d: 0, e: 'bob-0002', it: items }] };
    const capable = version === 'world159' || version === 'world160' || version === 'world161' || version === 'world162' || version === 'world163' || version === 'world164' || version === 'world165' || version === 'world166' || version === 'world167' || version === 'world168' || version === 'world169';
    assert.equal(relaySupportsFoeInventory(version), capable, 'upstream arena and unpublished candidates must not advertise combined inventory handover');
    assert.equal(s.foeInventoryOk, capable);
    assert.equal(s.sendFoes(data), capable);
    assert.equal(ws.sent.some((m) => m.t === 'foes'), capable);
    if (capable) assert.deepEqual(parseClient(JSON.stringify(ws.sent.at(-1)), { hasHello: true }).data.f[0].it, items);
    s.leave();
  }
});

test('FG-03: ordinary frames still send and the foe validator rejects corpse inventories', () => {
  const { s } = client(RELAY_VERSION);
  assert.equal(s.sendFoes({ n: 1, k: s.room, full: 0, f: [] }), true);
  const dead = { t: 'foes', data: { n: 2, k: s.room, full: 0, f: [{ i: 1, t: 0, d: 1, e: 'bob-0002', it: [] }] } };
  assert.equal(validFoeRecord(dead.data.f[0]), null);
  for (const f of [null, {}, 'bad']) assert.equal(s.sendFoes({ n: 3, k: s.room, full: 0, f }), false);
  s.leave();
});
