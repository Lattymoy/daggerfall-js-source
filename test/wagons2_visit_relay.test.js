// WAGONS2-VISIT (2026-10-09, Mac: "People should be able to use the interior just like houses, like crafting and such";
// who comes in, "Like an online home"): THE RELAY'S HALF, BY EXECUTION over the real Room (test/fakeRoom.mjs) and the real
// session (net/online.js over a fake socket) - a caravan's own room keeps what its OWNER placed in it (the `caravan`
// frame: net/wire.js validCaravanData), keyed as the cell keys the caravan's record (parkKeyOf of the account the token
// verified and the character the frame names), hands it to every joiner after its welcome, fans each new one, and forgets
// it PARK_TTL_MS after it was said; the session says it only to a relay that keeps it, and hears it only from the caravan's
// room it stands in. test/wagons2_visit.test.js is the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from './fakeRoom.mjs';
import { parseClient, parkKeyOf, validCaravanData, relaySupportsCaravan, CARAVAN_DECOR_KEY, CARAVAN_RELAY_MIN, PARK_TTL_MS, RELAY_VERSION, CARAVAN_DOC_MIN_MS, ACT_SENDER_BYTES_PER_S, ACT_ROOM_BYTES_PER_S, PARK_REFRESH_MS } from '../src/net/wire.js';
import { caravanRoomOf, privateInteriorPrefix, privateInteriorRoom } from '../src/net/privateInterior.js';
import { OnlineSession } from '../src/net/online.js';

const CA = 'char-ann-0001', CA2 = 'char-ann-0002';
const DOC = { v: 1, p: [{ id: 'p1', model: 41000, flat: null, pos: [1, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 100 }] };
const framesOf = (ws, t) => ws.sent.filter((f) => f.t === t);
/** A caravan's room over the real Room, its owner `ann1` (account acct-ann1, character CA). */
async function caravanRoom() {
  const k = await parkKeyOf('acct-ann1', CA);
  const r = fakeRoom(caravanRoomOf(k));
  const join = async (id, acct = null) => { const ws = r.connect(); await r.hello(ws, id, null, acct ? { tokenSub: acct } : {}); return ws; };
  // each word on a fresh act bucket, as the client spaces them (CARAVAN_DECOR_MIN_MS apart)
  const say = (ws, data) => { r.room._meterOf(ws).abucket = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'caravan', data })); };
  return { k, r, join, say };
}

test('WAGONS2-VISIT THE FRAME: `caravan` is `{ c, d }` - the park frame\'s character and a document (a plain object) or null - after a hello only; a relay before CARAVAN_RELAY_MIN closes the socket on it, so it is never sent there (mutant: any character\'s frame)', () => {
  assert.deepEqual(validCaravanData({ c: CA, d: DOC }), { c: CA, d: DOC });
  assert.deepEqual(validCaravanData({ c: CA, d: null }), { c: CA, d: null });
  for (const bad of [null, [], { c: 'x', d: DOC }, { d: DOC }, { c: CA, d: [] }, { c: CA, d: 'doc' }, { c: CA }]) assert.equal(validCaravanData(bad), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'caravan', data: { c: CA, d: DOC } }), { hasHello: true }), { t: 'caravan', data: { c: CA, d: DOC } });
  assert.equal(parseClient(JSON.stringify({ t: 'caravan', data: { c: CA, d: DOC } })).error, 'caravan before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'caravan', data: { c: CA, d: 7 } }), { hasHello: true }).error, 'bad caravan');
  assert.equal(CARAVAN_RELAY_MIN, 187);
  assert.equal(relaySupportsCaravan('world186'), false); assert.equal(relaySupportsCaravan('world188'), true); assert.equal(relaySupportsCaravan(RELAY_VERSION), true);
  assert.equal(relaySupportsCaravan(null), false);
});

test('WAGONS2-VISIT THE ROOM KEEPS ITS OWNER\'S WORD: the owner\'s document is stored and fanned to everyone else here; another account naming the owner\'s character, or the owner\'s account naming another character, reaches nothing - junk; a joiner is handed the document after its welcome, whether the owner is there or not; null forgets it (mutants: anyone\'s word kept, the joiner handed nothing)', async () => {
  const { k, r, join, say } = await caravanRoom();
  const ann = await join('ann1');
  const bob = await join('bob1');
  assert.deepEqual(framesOf(bob, 'caravan'), [], 'nothing kept yet: nothing handed');
  await say(ann, { c: CA, d: DOC });
  assert.deepEqual(r.store.get(CARAVAN_DECOR_KEY).d, DOC);
  assert.deepEqual(framesOf(bob, 'caravan').at(-1), { t: 'caravan', data: DOC }, 'fanned');
  assert.equal(framesOf(ann, 'caravan').length, 0, 'never back to its sayer');
  assert.ok(r.alarm.at > Date.now() + PARK_TTL_MS - 60_000, 'its forgetting armed');
  // mallory, in the room with her own token, says ann's character: junk, nothing stored or fanned
  const mal = await join('mal1', 'acct-mal1');
  const before = framesOf(bob, 'caravan').length;
  await say(mal, { c: CA, d: { v: 1, p: [] } });
  await say(ann, { c: CA2, d: { v: 1, p: [] } });   // the owner's account, another character: another caravan
  assert.deepEqual(r.store.get(CARAVAN_DECOR_KEY).d, DOC, 'the owner\'s document stands');
  assert.equal(framesOf(bob, 'caravan').length, before, 'and nobody was told otherwise');
  assert.ok((mal.meters.junk ?? 0) >= 1, 'counted against her');
  // the owner leaves: a visitor walking in later is handed what they placed, after the welcome
  await r.drop(ann);
  const cid = await join('cid1');
  const kinds = cid.sent.map((f) => f.t);
  assert.ok(kinds.indexOf('welcome') < kinds.indexOf('caravan'), 'after the welcome that resets its session');
  assert.deepEqual(framesOf(cid, 'caravan')[0].data, DOC);
  // the owner back, nothing kept: forgotten, said to whoever is in
  const ann2 = await join('ann2', 'acct-ann1');
  r.room._cvSaidAt -= CARAVAN_DOC_MIN_MS;   // the room's second (FINAL AUDIT)
  await say(ann2, { c: CA, d: null });
  assert.equal(r.store.has(CARAVAN_DECOR_KEY), false);
  assert.equal(framesOf(cid, 'caravan').at(-1).data, null);
  const dee = await join('dee1');
  assert.deepEqual(framesOf(dee, 'caravan'), [], 'nothing kept, nothing handed');
  assert.equal(k.length, 24);
});

test('WAGONS2-VISIT THE ROOM FORGETS: PARK_TTL_MS after its owner last said it, as the cell forgets the caravan - the alarm re-arms until then and deletes past it; a stale one past its time is handed to nobody (mutants: never forgotten, a stale document handed)', async () => {
  const { r, join, say } = await caravanRoom();
  const ann = await join('ann1');
  await say(ann, { c: CA, d: DOC });
  const at = r.store.get(CARAVAN_DECOR_KEY).at;
  await r.fire();
  assert.ok(r.store.has(CARAVAN_DECOR_KEY), 'still within its time');
  assert.equal(r.alarm.at, at + PARK_TTL_MS, 're-armed at its time');
  r.store.set(CARAVAN_DECOR_KEY, { at: Date.now() - PARK_TTL_MS - 1, d: DOC });
  const late = await join('bob1');
  assert.deepEqual(framesOf(late, 'caravan'), [], 'past its time: handed to nobody');
  await r.fire();
  assert.equal(r.store.has(CARAVAN_DECOR_KEY), false, 'and forgotten');
});

test('WAGONS2-VISIT ONLY A CARAVAN\'S ROOM KEEPS ONE: the frame in a cell, a building or an owned room is junk and stores nothing (the room the frame names its owner by is the caravan\'s)', async () => {
  const owned = privateInteriorRoom(await privateInteriorPrefix('acct-ann1', 'realm-ann'), 77, 9);   // ann's own owned room - she is admitted to it
  for (const key of ['world:6,9', 'interior:m77.9', owned, 'caravan:not-a-key']) {
    const r = fakeRoom(key);
    const ws = r.connect(); await r.hello(ws, 'ann1');
    await r.room.webSocketMessage(ws, JSON.stringify({ t: 'caravan', data: { c: CA, d: DOC } }));
    assert.equal(r.store.has(CARAVAN_DECOR_KEY), false, key);
    assert.ok((ws.meters.junk ?? 0) >= 1, key);
  }
});

// ─── the session ──────────────────────────────────────────────────────────────────────────────────────────────────────
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

test('WAGONS2-VISIT THE SESSION: my document goes down my primary socket only welcomed, in a caravan\'s room, at a relay that keeps one; the room\'s word is heard only from the caravan\'s room I stand in (mutants: said to an older relay, a cell\'s word taken for a caravan\'s)', async () => {
  const k = await parkKeyOf('acct-ann1', CA);
  const room = caravanRoomOf(k);
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Ann', look: { race: 'Nord', gender: 'female', faceIndex: 1, items: [] }, id: 'ann-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => now });
  const heard = [];
  s.onCaravan = (r, d) => heard.push([r, d]);
  s.join(room, POSE);
  sockets[0].open();
  assert.equal(s.sendCaravan({ c: CA, d: DOC }), false, 'not welcomed: nothing but the hello');
  sockets[0].receive({ t: 'welcome', id: 'ann-0001', peers: [], v: 'world182' });
  assert.equal(s.caravanOk, false);
  assert.equal(s.sendCaravan({ c: CA, d: DOC }), false, 'an older relay would close the socket on it');
  sockets[0].receive({ t: 'welcome', id: 'ann-0001', peers: [], v: RELAY_VERSION });
  assert.equal(s.caravanOk, true);
  assert.equal(s.sendCaravan({ c: 'x', d: DOC }), false, 'not a frame the relay takes');
  assert.equal(s.sendCaravan({ c: CA, d: DOC }), true);
  assert.deepEqual(JSON.parse(sockets[0].sent.at(-1)), { t: 'caravan', data: { c: CA, d: DOC } });
  assert.deepEqual(parseClient(sockets[0].sent.at(-1), { hasHello: true }).data, { c: CA, d: DOC }, 'the relay\'s own door takes it');
  sockets[0].receive({ t: 'caravan', data: DOC });
  sockets[0].receive({ t: 'caravan', data: [1] });
  assert.deepEqual(heard, [[room, DOC]], 'the caravan\'s word, a document or nothing');
  // in a cell: nothing said, nothing heard
  now += 60_000;
  s.join('world:6,9', POSE);
  sockets[1].open();
  sockets[1].receive({ t: 'welcome', id: 'ann-0001', peers: [], v: RELAY_VERSION });
  assert.equal(s.sendCaravan({ c: CA, d: DOC }), false, 'no caravan\'s room, no word');
  sockets[1].receive({ t: 'caravan', data: DOC });
  assert.equal(heard.length, 1);
});

test('WAGONS2-VISIT (AUDIT) THE DOCUMENT METERED: one a second at most - a sooner one dropped, neither stored nor told; an unchanged one neither stored again nor fanned until its lease wants renewing; a changed one fanned and its fan charged to the sender\'s own act bytes - a sender in debt tells nobody yet, its document kept and its fan OWED to the alarm at the repay (mutants: no interval, the unchanged fanned, the fan uncharged, the owed fan dropped)', async () => {
  const { r, join } = await caravanRoom();
  const ann = await join('ann1');
  const bob = await join('bob1');
  const raw = (ws, data) => { r.room._meterOf(ws).abucket = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'caravan', data })); };
  const later = () => { r.room._cvSaidAt -= CARAVAN_DOC_MIN_MS; };
  const DOC2 = { v: 1, p: [] }, DOC3 = { v: 1, p: [{ ...DOC.p[0], id: 'p3' }] };
  await raw(ann, { c: CA, d: DOC });
  await raw(ann, { c: CA, d: DOC2 });   // within the second
  assert.deepEqual(r.store.get(CARAVAN_DECOR_KEY).d, DOC, 'the sooner one dropped');
  assert.equal(framesOf(bob, 'caravan').length, 1);
  later();
  const at = r.store.get(CARAVAN_DECOR_KEY).at - 5000;
  r.store.set(CARAVAN_DECOR_KEY, { at, d: DOC });
  await raw(ann, { c: CA, d: DOC });   // unchanged
  assert.equal(framesOf(bob, 'caravan').length, 1, 'unchanged: told nobody');
  assert.equal(r.store.get(CARAVAN_DECOR_KEY).at, at, 'nor stored again');
  later();
  r.room._cvAt -= PARK_REFRESH_MS;   // its lease wants renewing
  await raw(ann, { c: CA, d: DOC });   // unchanged still
  assert.ok(r.store.get(CARAVAN_DECOR_KEY).at > at, 'renewed: stored again');
  assert.equal(framesOf(bob, 'caravan').length, 1, 'and told nobody');
  later();
  await raw(ann, { c: CA, d: DOC2 });
  assert.equal(framesOf(bob, 'caravan').length, 2, 'changed: told');
  assert.ok(r.room._meterOf(ann).abytes?.bytes < ACT_SENDER_BYTES_PER_S, 'its fan charged to the sender');
  later();
  r.room._meterOf(ann).abytes = { bytes: -ACT_SENDER_BYTES_PER_S / 2, at: Date.now() };   // in debt half a second
  await raw(ann, { c: CA, d: DOC3 });
  assert.deepEqual(r.store.get(CARAVAN_DECOR_KEY).d, DOC3, 'kept for its visitors');
  assert.equal(framesOf(bob, 'caravan').length, 2, 'not fanned while in debt');
  // FINAL AUDIT: OWED, NOT DROPPED - nothing says an unchanged document again, so the fan waits for the alarm at the
  // time the bucket has repaid, and goes then (the lease's alarm after it)
  assert.ok(r.alarm.at <= Date.now() + 600, 'the alarm at the repay, not the lease');
  await r.fire();
  assert.equal(framesOf(bob, 'caravan').length, 2, 'still in debt: owed still');
  r.room._meterOf(ann).abytes.at -= 1000;   // half a second has repaid it, and more
  await r.fire();
  assert.deepEqual(framesOf(bob, 'caravan').at(-1), { t: 'caravan', data: DOC3 }, 'repaid: fanned');
  assert.equal(r.alarm.at, r.store.get(CARAVAN_DECOR_KEY).at + PARK_TTL_MS, 'and the lease re-armed');
  await r.fire();
  assert.equal(framesOf(bob, 'caravan').length, 3, 'once');
  assert.equal(CARAVAN_DOC_MIN_MS, 1000);
});

test('WAGONS2-VISIT (FINAL AUDIT) THE ROOM\'S SECOND AND THE ROOM\'S BYTES: one document a second from the ROOM - the owner\'s second socket within it dropped, so N sockets are not N seconds; the fan charged to the room\'s act bytes after the sender\'s, and a room in debt charges the sender nothing and owes the fan (mutants: a socket\'s second, the room uncharged)', async () => {
  const { r, join } = await caravanRoom();
  const ann = await join('ann1');
  const ann2 = await join('ann2', 'acct-ann1');
  const bob = await join('bob1');
  const raw = (ws, data) => { r.room._meterOf(ws).abucket = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'caravan', data })); };
  const DOC2 = { v: 1, p: [] };
  await raw(ann, { c: CA, d: DOC });
  await raw(ann2, { c: CA, d: DOC2 });   // the owner's other socket, within the second
  assert.deepEqual(r.store.get(CARAVAN_DECOR_KEY).d, DOC, 'the room\'s second: dropped');
  assert.equal(framesOf(bob, 'caravan').length, 1);
  assert.ok(r.room._roomActBytes?.bytes < ACT_ROOM_BYTES_PER_S, 'the room charged for the fan');
  r.room._cvSaidAt -= CARAVAN_DOC_MIN_MS;
  r.room._roomActBytes = { bytes: -ACT_ROOM_BYTES_PER_S / 4, at: Date.now() };   // the room in debt
  const before = r.room._meterOf(ann2).abytes?.bytes ?? ACT_SENDER_BYTES_PER_S;
  await raw(ann2, { c: CA, d: DOC2 });
  assert.equal(framesOf(bob, 'caravan').length, 1, 'the room in debt: owed');
  assert.ok((r.room._meterOf(ann2).abytes?.bytes ?? ACT_SENDER_BYTES_PER_S) >= before, 'and the sender not charged');
  r.room._roomActBytes.at -= 1000;
  await r.fire();
  assert.deepEqual(framesOf(bob, 'caravan').at(-1), { t: 'caravan', data: DOC2 }, 'repaid: fanned');
  assert.equal(framesOf(ann, 'caravan').length, 1, 'to the owner\'s other socket too - it is not the sayer');
});
