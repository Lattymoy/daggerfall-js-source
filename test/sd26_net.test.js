// SD26 - AUDIT SD IV, the net lifecycle, the fight's laws and the relay lens (bible/11-Multiplayer/Super-Dungeons.md).
// SD-HELLO held `_send` and the realm's own words behind the welcome, and the rest of the page's senders wrote their
// socket directly: a look, every directed frame (`_socketFor`: trade, cast, card, page, duel, wed), a `who` and the
// parked team's word went down a realm socket before its welcome - each a frame before hello, refused for good, and the
// page cast out of the Hour. The park word went on EVERY entry: world.js says it again in every room joined.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession } from '../src/net/online.js';
import { RELAY_VERSION, WHO_RETRY_MS, parseClient } from '../src/net/wire.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const T0 = 1_800_000_000_000;
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 2, items: [] };
const HELM = { ...LOOK, items: [{ templateIndex: 102, group: 'Armor', material: 0, dye: 0, variant: 0, equipSlot: 1 }] };
const pose = (x) => ({ x, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 });
const HEAL = { name: 'Heal', element: 4, rangeType: 1, icon: 0, effects: [{ type: 9, subType: -1 }] };
/** A session over fake sockets on a clock the test turns; console.info quiet. */
function session() {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: T0 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', look: LOOK, id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  return { s, sockets, clock };
}
const quiet = (fn) => { const i = console.info; console.info = () => {}; try { return fn(); } finally { console.info = i; } };
const kinds = (ws) => ws.sent.map((x) => JSON.parse(x).t).filter((t) => t !== 'ping');   // the runtime's own, never the room's
/** What the relay's own parse says of each frame a socket sent while it had no name (its hello awaiting the hub). */
const beforeHello = (ws) => ws.sent.map((x) => parseClient(x, { hasHello: false })).filter((m) => m.t !== 'hello' && m.t !== 'ping').map((m) => m.error ?? m.t);

test('AUDIT SD IV (0): A REALM SOCKET BLINKS, AND ITS RETRY SAYS NOTHING PAST ITS HELLO UNTIL ITS WELCOME - a look, an ally\'s heal, a card, a `who` all held (the relay would refuse each as before hello, and the page be cast out); the peer still reached (a trade is not ended by a hello\'s round trip); the welcome lets each go, the look once (mutants SD26-0-directed-ungated, SD26-0-reach-welcomed-only, SD26-0-look-ungated, SD26-0-look-dropped, SD26-0-who-ungated)', () => {
  const { s, sockets, clock } = session();
  quiet(() => {
    s.join('sd:7', pose(0));
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [{ id: 'bob-0001', name: 'Bob', look: LOOK, pose: pose(3) }] });
    sockets[0].receive({ t: 'pose', id: 'zed-0001', p: pose(4) });   // a stranger stood by its pose, not yet introduced
  });
  assert.equal(s.lookOk && s.castOk && s.cardOk, true, 'the first welcome said this relay knows each frame');
  sockets[0].drop(1006);   // the blink: the roster kept on purpose (SLAM12)
  clock.now += 10_000; quiet(() => s.tick(clock.now));
  const ws = sockets[1];
  assert.ok(ws, 'the retry opened a socket'); ws.open();
  assert.equal(s.status, 'open'); assert.deepEqual(kinds(ws), ['hello']);
  clock.now += WHO_RETRY_MS + 1;
  assert.equal(s.setLook(HELM), true, 'the look changed');
  quiet(() => s.tick(clock.now));   // the tick's flush and the who round
  assert.equal(s.sendCast({ to: 'bob-0001', level: 30, spell: HEAL }), false, 'no heal down an unwelcomed socket');
  assert.equal(s.sendCard({ to: 'bob-0001', ask: true }), false, 'nor a card');
  assert.equal(s.reachesPeer('bob-0001'), true, 'Bob is still reached - a socket that said its hello counts');
  assert.deepEqual(kinds(ws), ['hello'], 'nothing past the hello');
  assert.deepEqual(beforeHello(ws), []);
  quiet(() => ws.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [{ id: 'bob-0001', name: 'Bob', look: LOOK, pose: pose(3) }] }));
  quiet(() => s.tick(clock.now));
  assert.equal(s.sendCast({ to: 'bob-0001', level: 30, spell: HEAL }), true, 'welcomed: the heal goes');
  assert.equal(s.sendCard({ to: 'bob-0001', ask: true }), true);
  const sent = ws.sent.map((x) => JSON.parse(x));
  assert.deepEqual(sent.filter((f) => f.t === 'look').map((f) => f.look), [s.look], 'the held look went once the socket was welcomed, the latest');
  assert.deepEqual(sent.filter((f) => f.t === 'who').map((f) => f.id), ['zed-0001'], 'and the stranger is asked for');
});

test('AUDIT SD IV (0): THE PARKED TEAM\'S WORD IS SAID IN EVERY ROOM JOINED, AND THE REALM IS A ROOM - from a cell into the Hour it waits for the realm\'s welcome (it went on the first frame after the hello: park before hello, every entry); a halo\'s cell not yet welcomed takes no record, the anchor goes down mine (mutants SD26-0-park-ungated, SD26-0-park-halo-ungated)', () => {
  const { s, sockets, clock } = session();
  quiet(() => {
    s.join('world:100,200', pose(0));
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] });
  });
  assert.equal(s.parkOk, true);
  // a halo opening on the next cell: its hello said, its welcome not yet come
  quiet(() => s.setHalo(['world:101,200']));
  const halo = sockets[1]; halo.open();
  assert.deepEqual(kinds(halo), ['hello']);
  assert.equal(s.sendPark({ c: 'char-0001', a: [1601, 3201] }, 'world:101,200'), 'room', 'the anchor alone, down my own welcomed socket');
  assert.deepEqual(kinds(halo), ['hello'], 'nothing down the halo before its welcome');
  assert.deepEqual(beforeHello(halo), []);
  quiet(() => halo.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] }));
  assert.equal(s.sendPark({ c: 'char-0001', a: [1601, 3201] }, 'world:101,200'), 'cell', 'welcomed: the cell keeps it');
  // into the Hour
  quiet(() => s.join('sd:7', pose(0)));
  const realm = sockets.at(-1); realm.open();
  assert.equal(s.status, 'open');
  clock.now += 1_000;   // the park bucket full again: what holds the word below is the welcome alone
  assert.equal(s.sendPark({ c: 'char-0001' }), false, 'the realm has not welcomed me: nothing said');
  assert.deepEqual(kinds(realm), ['hello']);
  assert.deepEqual(beforeHello(realm), []);
  quiet(() => realm.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] }));
  clock.now += 1_000;   // the park bucket's
  assert.equal(s.sendPark({ c: 'char-0001' }), 'room', 'welcomed: said');
});

test('AUDIT SD IV (0): A HALO MID-HELLO HOLDS THE LOOK ON EVERY SOCKET - the halo said its hello in the look before, and a look down it now is a look before hello; its welcome lets the latest go down both (mutant SD26-0-look-halo-ungated)', () => {
  const { s, sockets, clock } = session();
  quiet(() => {
    s.join('world:100,200', pose(0));
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] });
    s.setHalo(['world:101,200']);
  });
  const halo = sockets[1]; halo.open();
  assert.equal(s.setLook(HELM), true);
  clock.now += 5_000; quiet(() => s.tick(clock.now));
  assert.deepEqual(kinds(sockets[0]).filter((t) => t === 'look'), [], 'held on my own socket too');
  assert.deepEqual(kinds(halo), ['hello']);
  quiet(() => halo.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] }));
  quiet(() => s.tick(clock.now));
  assert.deepEqual(kinds(sockets[0]).filter((t) => t === 'look'), ['look']);
  assert.deepEqual(kinds(halo).filter((t) => t === 'look'), ['look']);
});
