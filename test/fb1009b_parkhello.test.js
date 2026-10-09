// FIELD BUGS 2026-10-09b - PARK-HELLO, the Discord's "Can't go into Abyss Dungeon portal": "Has happened to me 3 in a
// row now ... It randomly decided to let me in after recalling back to it an 8th time ... Happening to a few people".
//
// A socket says its hello and nothing more until its room welcomes it (SD-HELLO, net/online.js _send). Two senders
// went round that law: the parked team's word (sendPark - every online character's, on every room joined, the frame
// after its hello) and a changed look (_flushLook). Each was gated on the LAST welcome's word (`parkOk`, `lookOk`), so
// the new room's socket carried the frame before its welcome. Most rooms answer a hello at once and never saw it; the
// Shattered Hour's realm awaits the hub's word on its Hollow first (relay _sdAdmit, whenever its copy is over ten
// seconds old), the park arrived while it waited, the relay closed the socket as policy ('park before hello'), and the
// Rift cast its player out at the Hollow's door - "The way to the Shattered Hour is lost." Within ten seconds of
// another player's hello the realm needed no fetch, which is the eighth Recall that let them in. Driven here over the
// real session and the relay's own parse. `01-Overview/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession } from '../src/net/online.js';
import { parseClient, RELAY_VERSION, relaySupportsPark, relaySupportsLook } from '../src/net/wire.js';

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(s); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}
const POSE = { x: 1000, y: 0, z: 1000, yaw: 0, pitch: 0, mv: 0 };
const kinds = (ws) => ws.sent.map((f) => JSON.parse(f).t);

test('PARK-HELLO: through the Rift, the realm\'s socket says its hello and nothing else until it is welcomed - the parked team\'s word waits for the welcome, then goes; the relay would have closed on it (mutant: the park unwelcomed)', () => {
  assert.ok(relaySupportsPark(RELAY_VERSION) && relaySupportsLook(RELAY_VERSION), 'the relay that welcomes knows both frames');
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('dungeon:m77', POSE);   // the Hollow's own room
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: RELAY_VERSION });
  assert.equal(s.parkOk, true, 'the Hollow\'s welcome said the relay knows the park');
  assert.equal(s.sendPark({ c: 'char-0001-abcdef' }), 'room', 'welcomed: the word goes');
  now += 60_000;
  s.join('sd:3', POSE);   // through the Rift: the realm's room
  sockets[1].open();
  assert.equal(s.status, 'open');
  assert.equal(s.sendPark({ c: 'char-0001-abcdef' }), false, 'the realm has not welcomed its socket: the park waits');
  assert.deepEqual(kinds(sockets[1]), ['hello'], 'the hello alone on the realm\'s socket');
  // what the relay does with a park ahead of the hello's end - a policy close, the cast-out
  assert.equal(parseClient(JSON.stringify({ t: 'park', data: { c: 'char-0001-abcdef' } }), { hasHello: false }).error, 'park before hello');
  sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: RELAY_VERSION });
  now += 60_000;
  assert.equal(s.sendPark({ c: 'char-0001-abcdef' }), 'room', 'welcomed: the next frame\'s try goes');
  assert.deepEqual(kinds(sockets[1]), ['hello', 'park']);
});

test('PARK-HELLO: a look changed while a new room\'s hello is out is owed, not dropped and not sent ahead - it goes on the first tick after the welcome (mutants: the look unwelcomed; the owed look forgotten)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('dungeon:m77', POSE);
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: RELAY_VERSION });
  assert.equal(s.lookOk, true);
  s.join('sd:3', POSE);
  sockets[1].open();
  now += 60_000;
  assert.equal(s.setLook({ race: 'Nord', gender: 'male', faceIndex: 3, items: [] }), true, 'the look changed');
  assert.deepEqual(kinds(sockets[1]), ['hello'], 'nothing past the hello');
  sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: RELAY_VERSION });
  now += 60_000;
  s._flushLook();   // the tick's own call
  assert.deepEqual(kinds(sockets[1]), ['hello', 'look'], 'the owed look, after the welcome');
  assert.equal(JSON.parse(sockets[1].sent[1]).look.faceIndex, 3);
});
