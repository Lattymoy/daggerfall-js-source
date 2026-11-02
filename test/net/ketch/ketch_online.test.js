// AUDIT KETCH L1-2 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 10): THE PAGE'S HALF OF THE HUB'S RECEIPTS - a
// Ketch receipt heard from my own ship or from the hub (which keeps it for an earner off the ship at the fall), never
// another word of the hub's, never another room's; a voyage's share said `spent` to the hub alone, by a signed-in account,
// to a relay that keeps ships. tools/mutants/ketch_relay.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { OnlineSession } from '../../../src/net/online.js';
import { SOCIAL_ROOM, RELAY_VERSION, worldRoom } from '../../../src/net/wire.js';
import { ketchRoomKey } from '../../../src/net/ketch/ketchLaw.js';

const SHIP = ketchRoomKey(1, '0123456789abcdef');
const R = 'y1.eyJkIjoxfQ.';
function rig(room, { acct = null, v = RELAY_VERSION } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000, ...(acct ? { acct, asecret: `secret-of-${acct}` } : {}) });
  const got = [];
  s.onKetch = (w, rm) => got.push([w.k, rm]);
  const info = console.info; console.info = () => {};
  try {
    s.join(room, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v });
  } finally { console.info = info; }
  const ws = sockets[0];
  return { s, ws, got, out: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'kt') };
}

test('KETCH THE PAGE HEARS ITS RECEIPT FROM THE HUB: from my ship or the hub - the hub\'s receipt alone, never its other words, never a cell\'s; `spent` said to the hub alone, by an account, on a relay that keeps ships (AUDIT KETCH L1-2; mutants: the hub\'s receipt unheard; spent from a ship)', () => {
  const hub = rig(SOCIAL_ROOM, { acct: 'acct-ann' });
  hub.ws.receive({ t: 'kt', k: 'rcpt', r: R });
  assert.deepEqual(hub.got, [['rcpt', SOCIAL_ROOM]], 'the hub\'s hand of my receipt');
  hub.ws.receive({ t: 'kt', k: 'cl', cr: [], br: [], lo: [], ca: [], bk: 0, nd: 0, sk: [] });
  hub.ws.receive({ t: 'kt', k: 'rcpt', r: 'k1.eyJkIjoxfQ.' });
  assert.equal(hub.got.length, 1, 'nothing else of the hub\'s, nor another receipt\'s shape');
  const cell = rig(worldRoom(10, 10));
  cell.ws.receive({ t: 'kt', k: 'rcpt', r: R });
  assert.deepEqual(cell.got, [], 'nor a cell\'s');
  assert.equal(hub.s.sendKetchSpent(1), true);
  assert.deepEqual(hub.out().at(-1), { t: 'kt', k: 'spent', n: 1 });
  assert.equal(hub.s.sendKetchSpent(-1), false, 'the wire\'s law first');
  assert.equal(rig(SHIP, { acct: 'acct-ann' }).s.sendKetchSpent(1), false, 'never from a ship');
  assert.equal(rig(SOCIAL_ROOM).s.sendKetchSpent(1), false, 'never without an account');
  assert.equal(rig(SOCIAL_ROOM, { acct: 'acct-ann', v: 'world252' }).s.sendKetchSpent(1), false, 'never to a relay that closes on it');
});
