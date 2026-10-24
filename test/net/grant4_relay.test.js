// GRANT4, GRANT8, GRANT9 (2026-10-18, Mac: "Do all slices"; bible/11-Multiplayer/Spawn-Grants.md sections 14 and 16):
// THE RELAY'S SIDE OF THE LAST SLICES, over real Rooms (test/fakeRoom.mjs): a world room (a building's, a dungeon's) takes
// its own lane's asks - no pixel, no open-country kind, no carry in or out; with `grantRoll` on an encounter's grant is
// `encr`, its species its seed's; with `grantStrip` on the relay drops a record its grant does not stand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { validGrantAsk, validGrantOut, verifyGrant, grantMarks, grantKindRolled, GRANT_OPEN_KINDS, GRANT_KINDS } from '../../src/net/grantLaw.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151);
const CELL = cellRoomOfWire(P0.x, P0.z), ROOM = 'interior:m123456.7';

async function world(t, env = {}) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pk = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const room = (key) => {
    const r = fakeRoom(key, { now: () => now });
    Object.assign(r.env, { GATE_SIGNING_KEY: pk, ...env });
    t.after(() => r.room._grantFlush());
    return r;
  };
  const join = async (r, id, pose) => {
    const ws = r.connect();
    await r.hello(ws, id, pose, { lv: 7, charLevel: 12 });
    let n = 0;
    return { ws, id, ask: (body) => r.raw(ws, JSON.stringify({ t: 'grant', id: ++n, ...body })), last: () => ws.sent.filter((m) => m.t === 'grant').at(-1), foes: () => ws.sent.filter((m) => m.t === 'foes' || m.t === 'own') };
  };
  return { kp, room, join };
}

test('GRANT4 A WORLD ROOM\'S OWN LANE: its welcome says the law; a stand of its own lane is granted there, naming no pixel; an open-country kind is refused `kind`; a grant is carried cell to cell alone - never into a room, never out of one (mutants: a room\'s grant read off a scene pose; an encounter granted indoors; a carry into a room)', async (t) => {
  const W = await world(t);
  const R = W.room(ROOM);
  const mac = await W.join(R, 'sock-mac-01', { x: 3, y: 1, z: 4, yaw: 0, pitch: 0 });
  assert.equal(mac.ws.sent.find((m) => m.t === 'welcome')?.gm, 'measure', 'a world room\'s welcome says the law');
  await mac.ask({ k: 'mint', kind: 'loose', n: 2 });
  const g = validGrantOut(mac.last())?.gr;
  assert.deepEqual([g?.k, g?.q, g?.p, g?.n, g?.o], ['loose', ROOM, [0, 0], 2, 'sock-mac-01'], 'its room\'s, no pixel');
  assert.equal(await verifyGrant(g, W.kp.publicKey, { subtle }), true);
  for (const kind of GRANT_OPEN_KINDS.filter((k) => k !== 'encr')) {
    await mac.ask({ k: 'mint', kind, n: 1 });
    assert.deepEqual([mac.last().k, mac.last().r], ['no', 'kind'], `${kind}: the open country's alone`);
  }
  // a carry: the room's grant into a cell refused there; a cell's grant into the room refused here
  const C = W.room(CELL);
  const ann = await W.join(C, 'sock-mac-01', P0);
  await ann.ask({ k: 'carry', grs: [g] });
  assert.deepEqual(validGrantOut(ann.last()).grs, [null], 'a room\'s grant stays its own');
  await ann.ask({ k: 'mint', kind: 'enc', n: 1 });
  const cg = validGrantOut(ann.last()).gr;
  await mac.ask({ k: 'carry', grs: [cg] });
  assert.deepEqual(validGrantOut(mac.last()).grs, [null], 'and a cell\'s never comes in');
});

test('GRANT8 THE SEED ROLLS THE SPECIES: with `grantRoll` on an encounter\'s ask is answered `encr` - the same marks, its species its seed\'s on every machine (scenes/grantHost.js grantSpecies); off, `enc`; `encr` is never asked by name (mutants: the switch unread; `encr` asked)', async (t) => {
  assert.equal(grantKindRolled('enc', true), 'encr');
  assert.deepEqual(['enc', 'camp', 'loose'].map((k) => grantKindRolled(k, false)).concat(grantKindRolled('camp', true)), ['enc', 'camp', 'loose', 'camp']);
  assert.equal(validGrantAsk({ k: 'mint', id: 1, kind: 'encr', n: 1 }), null, 'the relay\'s word, never an ask\'s');
  assert.deepEqual(GRANT_KINDS.encr, GRANT_KINDS.enc, 'an encounter\'s own bounds');
  const off = await world(t);
  const a = await off.join(off.room(CELL), 'sock-mac-01', P0);
  await a.ask({ k: 'mint', kind: 'enc', n: 3 });
  assert.equal(validGrantOut(a.last()).gr.k, 'enc');
  const on = await world(t, { GRANT_ROLL: 'on' });
  const b = await on.join(on.room(CELL), 'sock-mac-01', P0);
  await b.ask({ k: 'mint', kind: 'enc', n: 3 });
  const gr = validGrantOut(b.last()).gr;
  assert.equal(gr.k, 'encr');
  assert.deepEqual({ e: gr.e, c: gr.c }, grantMarks(gr.s, 3, gr.r), 'an encounter\'s marks');
  assert.equal(await verifyGrant(gr, on.kp.publicKey, { subtle }), true);
  await b.ask({ k: 'mint', kind: 'camp', n: 3 });
  assert.equal(validGrantOut(b.last()).gr.k, 'camp', 'an encounter alone');
});

test('GRANT9 THE RELAY STRIPS RECORDS: with `grantStrip` on a foes frame loses each record whose grant this cell does not hold as the sender\'s, a member past its grant, marks past its grant, and a live hostile record with no grant from a socket that stands on grants - a body, a standing foe\'s delta and an ally pass; a socket that never asked passes whole; off, nothing is read (mutants: the sender unchecked; the member\'s bound; the marks unchecked; an ally stripped)', async (t) => {
  for (const strip of [false, true]) {
    const W = await world(t, strip ? { GRANT_STRIP: 'on' } : {});
    const C = W.room(CELL);
    const mac = await W.join(C, 'sock-mac-01', P0), ann = await W.join(C, 'sock-ann-01', P0), zed = await W.join(C, 'sock-zed-01', P0);
    await mac.ask({ k: 'mint', kind: 'enc', n: 2 });
    const g = validGrantOut(mac.last()).gr;
    await ann.ask({ k: 'mint', kind: 'enc', n: 1 });
    const other = validGrantOut(ann.last()).gr;
    const plain = [0, 1].find((i) => !((g.e >>> i) & 1));
    const rec = (i, extra = {}) => ({ i, t: 0, f: [1, 2, 3], ...extra });
    const f = [
      rec(1, { gr: [g.g, 0] }), rec(2, { gr: [g.g, 1] }),
      rec(3, { gr: [g.g, 2] }),   // past the grant
      rec(4, { gr: [other.g, 0] }),   // another's
      rec(5, { gr: [999, 0] }),   // none this cell holds
      rec(6, { gr: [g.g, plain], z: 1 }),   // an elite its grant never rolled
      rec(7),   // a live hostile with none
      rec(8, { d: 1 }), { i: 9, f: [1, 2, 3] }, rec(10),   // a body, a delta, an ally (cp)
    ];
    await C.raw(mac.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full: 1, f, cp: [10] } }));
    const heard = zed.foes().at(-1)?.data?.f.map((r) => r.i);
    assert.deepEqual(heard, strip ? [1, 2, 8, 9, 10] : f.map((r) => r.i), strip ? 'what the grants stand, and what needs none' : 'off: the frame as it was sent');
    // a socket that never asked passes whole - an older build, or one whose law is off
    await C.raw(zed.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full: 1, f: [rec(1), rec(2)] } }));
    assert.deepEqual(mac.foes().at(-1)?.data?.f.map((r) => r.i), [1, 2]);
  }
});
