// SD6b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md sections 8 and 14): THE RELAY JUDGES
// THE ORRERY - a turn of an Ending-stone (`pz`) goes to the Hollow's realm, which judges it by the Orrery's law
// (net/sdBrain.js orreryStep) from where the socket's own pose stands, keeps the hall, and says it to every soul there:
// after each turn and to each at its hello. The page's half: a turn sent down my own socket in the realm, the hall heard
// from my own realm alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_KINDS, SD_OUT_KINDS, validSdIn, validSdOut, parseClient, SD_PZ_STONES, SD_PZ_HOURS, SD_PZ_FRAY_MAX, SD_PZ_Q_MAX, SD_PZ_HZ,
  sdPzGate, sdPzRelayGate, SD_ORRERY_KEY, SD_KEY, SOCIAL_ROOM, RELAY_VERSION, worldRoom, PIXEL_UNITS,
} from '../src/net/wire.js';
import {
  SD_STONES, SD_HOURS, SD_FRAY_MAX, SD_TURN_HZ, SD_STONE_POS, SD_STONE_SETTLE_MS, realmToDungeon, orreryOf, orreryTurn,
  orreryLit, orreryStep, orreryFresh, orrerySolve, sdHour, sdTurnsFor,
} from '../src/net/sdBrain.js';
import { sdRoomKey, sdFell, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { fakeRooms } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const halls = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k === 'pz');
const T0 = 1_800_000_000_000;
/** A pose `d` metres east of stone i, in the dungeon's frame. */
const atStone = (i, d = 1, extra = {}) => { const [x, y, z] = realmToDungeon(SD_STONE_POS[i].x + d, 0, SD_STONE_POS[i].z); return { x, y, z, yaw: 0, pitch: 0, ...extra }; };
const turn = (i, a, q) => JSON.stringify({ t: 'sd', k: 'pz', i, a, q });

/** The fake world driven to a FOUND Hollow (slot 1) and its realm standing - SD3's own way there. */
async function withHall(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room(`chat:r17`); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      assert.equal(hub.store.get(SD_KEY).ph, 'found');
      const realm = world.room(sdRoomKey(rec.s));
      await fn({ world, hub, cell, realm, rec, o: orreryOf(rec.s), step: (ms) => { clock += ms; }, set: (t) => { clock = t; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('SD6b the wire: `pz` each way - a turn (which stone, which way, its number) and the hall (six hours, the fray, the dial, the Concord, the turn and its turner, the snap); its numbers the Orrery\'s own, pinned equal (the wire imports no law) (mutants: a seventh stone believed; a turn of two hours; a hall of five stones; the fray past its most)', () => {
  assert.deepEqual([...SD_KINDS].slice(0, 2), ['found', 'pz']);   // SD8b (PIN MOVED): the fight's words after them
  assert.deepEqual([...SD_OUT_KINDS].slice(0, 2), ['ev', 'pz']);   // SD8b (PIN MOVED): the fight's words after them
  assert.equal(SD_PZ_STONES, SD_STONES.length); assert.equal(SD_PZ_HOURS, SD_HOURS); assert.equal(SD_PZ_FRAY_MAX, SD_FRAY_MAX); assert.equal(SD_PZ_HZ, SD_TURN_HZ);
  assert.deepEqual(validSdIn({ k: 'pz', i: 5, a: -1, q: 7, junk: 1 }), { k: 'pz', i: 5, a: -1, q: 7 });
  for (const bad of [{ i: 6, a: 1, q: 1 }, { i: -1, a: 1, q: 1 }, { i: 0, a: 2, q: 1 }, { i: 0, a: 0, q: 1 }, { i: 0, a: 1, q: -1 }, { i: 0, a: 1, q: 1.5 }, { i: 0, a: 1 }, { i: '0', a: 1, q: 1 }, { i: 0, a: 1, q: SD_PZ_Q_MAX + 1 }])
    assert.equal(validSdIn({ k: 'pz', ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'sd', k: 'pz', i: 2, a: 1, q: 3, x: 9 }), { hasHello: true }), { t: 'sd', k: 'pz', i: 2, a: 1, q: 3 });
  assert.equal(parseClient(JSON.stringify({ t: 'sd', k: 'pz', i: 9, a: 1, q: 3 }), { hasHello: true }).error, 'bad sd');
  const hall = { k: 'pz', s: 4, st: [0, 11, 3, 4, 5, 6], f: 48, lit: 6, ok: true };
  assert.deepEqual(validSdOut(hall), hall);
  assert.deepEqual(validSdOut({ ...hall, ok: false, f: 0, i: 1, a: -1, id: 'peer-ann', q: 9, x: 1 }), { ...hall, ok: false, f: 0, i: 1, a: -1, id: 'peer-ann', q: 9, x: 1 });
  assert.deepEqual(validSdOut({ ...hall, x: 2 }), hall, 'a snap is 1 or nothing');
  for (const bad of [{ st: [0, 1, 2, 3, 4] }, { st: [0, 1, 2, 3, 4, 12] }, { st: [0, 1, 2, 3, 4, -1] }, { f: SD_PZ_FRAY_MAX + 1 }, { lit: 7 }, { ok: 1 }, { s: 0 }, { i: 1 }, { i: 6, a: 1 }, { id: 'x' }, { q: -2 }])
    assert.equal(validSdOut({ ...hall, ...bad }), null, JSON.stringify(bad));
  // the bucket: SD_PZ_HZ a second from a page, a turn deeper at the relay
  let b = null, n = 0;
  for (let k = 0; k < 10; k++) { const g = sdPzGate(b, 1000); b = g.bucket; n += g.pass ? 1 : 0; }
  assert.equal(n, SD_PZ_HZ);
  b = null; n = 0;
  for (let k = 0; k < 10; k++) { const g = sdPzRelayGate(b, 1000); b = g.bucket; n += g.pass ? 1 : 0; }
  assert.equal(n, SD_PZ_HZ + 1);
});

test('SD6b A TURN JUDGED: the hall said at the hello; a turn from within reach turns the stone and its partners, kept and said to everyone with its turner; out of reach, inside the gear\'s settling, a number said twice, a dead pose, a turn in a cell - nothing (mutants: the reach unasked; the settling skipped; a number taken twice; the dead turning)', async () => {
  await withHall(async ({ realm, cell, rec, o, step }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', atStone(0), { name: 'Ann' });
    assert.equal(ann.closed, null);
    assert.deepEqual(halls(ann), [{ t: 'sd', k: 'pz', s: rec.s, st: [...o.start], f: 0, lit: orreryLit(o, o.start), ok: false }], 'the hall at the hello');
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', atStone(3, -1), { name: 'Bo' });
    // Ann turns the stone she stands at
    await realm.raw(ann, turn(0, 1, 1));
    let st = orreryTurn(o, o.start, 0, 1);
    const said = { t: 'sd', k: 'pz', s: rec.s, st, f: 1, lit: orreryLit(o, st), ok: false, i: 0, a: 1, id: 'peer-ann', q: 1 };
    assert.deepEqual(halls(ann).at(-1), said);
    assert.deepEqual(halls(bo).at(-1), said, 'everyone in the realm hears it');
    assert.deepEqual(realm.store.get(SD_ORRERY_KEY), { s: rec.s, st, f: 1, ok: false, last: [Date.now(), 0, 0, 0, 0, 0] }, 'the hall kept');
    const quietAfter = async (ws, frame, why) => { const n = halls(ann).length + halls(bo).length; await realm.raw(ws, frame); assert.equal(halls(ann).length + halls(bo).length, n, why); };
    await quietAfter(ann, turn(3, 1, 2), 'a stone out of reach');
    step(SD_STONE_SETTLE_MS - 1);
    await quietAfter(ann, turn(0, 1, 3), 'the gear still settling');
    step(1);
    await realm.raw(ann, turn(0, -1, 4));
    st = orreryTurn(o, st, 0, -1);
    assert.deepEqual(halls(bo).at(-1), { t: 'sd', k: 'pz', s: rec.s, st, f: 2, lit: orreryLit(o, st), ok: false, i: 0, a: -1, id: 'peer-ann', q: 4 });
    step(SD_STONE_SETTLE_MS);
    await quietAfter(ann, turn(0, 1, 4), 'a number said twice is one turn');
    await quietAfter(ann, turn(0, 1, 2), 'nor an older one');
    // Bo, at another stone, turns it; then falls - the dead turn nothing
    await realm.raw(bo, turn(3, -1, 1));
    st = orreryTurn(o, st, 3, -1);
    assert.deepEqual(halls(ann).at(-1).st, st);
    await realm.pose(bo, atStone(3, -1, { dd: 1 }));
    step(SD_STONE_SETTLE_MS);
    await quietAfter(bo, turn(3, 1, 2), 'the dead turn nothing');
    // a turn in a cell is junk - nothing kept there, nothing said
    const c = cell.connect(); await cell.hello(c, 'peer-cy', doorPose(5), { name: 'Cy' });
    await cell.raw(c, turn(0, 1, 1));
    assert.equal(c.meters.junk, 1);
    assert.equal(cell.store.get(SD_ORRERY_KEY), undefined);
  });
});

test('SD6b THE FRAY AND THE CONCORD: the 48th turn snaps the hall back and says the lash; the Concord, reached, is said, kept past an eviction, and every turn after it is nothing; a newcomer hears it (mutants: the snap unsaid; the Concord forgotten)', async () => {
  await withHall(async ({ realm, rec, o, step }) => {
    const stand = async (i, id) => { const ws = realm.connect(); await realm.hello(ws, id, atStone(i), { name: id }); return ws; };
    const at = [];
    for (let i = 0; i < 6; i++) at[i] = await stand(i, `peer-s${i}`);
    const q = [0, 0, 0, 0, 0, 0];
    const turnAt = async (i, a) => { step(SD_STONE_SETTLE_MS); await realm.raw(at[i], turn(i, a, ++q[i])); };
    // forty-eight turns of one stone the long way: the last snaps back, and lashes
    let want = orreryFresh(o), last = null;
    for (let k = 0; k < SD_FRAY_MAX; k++) { await turnAt(0, 1); last = orreryStep(o, want, 0, 1); want = last; if (want.ok) break; }
    assert.ok(!want.ok, 'one stone alone never makes it');
    const snap = halls(at[5]).at(-1);
    assert.deepEqual(snap, { t: 'sd', k: 'pz', s: rec.s, st: [...o.start], f: 0, lit: orreryLit(o, o.start), ok: false, i: 0, a: 1, id: 'peer-s0', q: SD_FRAY_MAX, x: 1 });
    // now the way: each stone the short way round to its share, the stone no other turn moves first
    const t = orrerySolve(o, o.start);
    for (let p = 5; p >= 0; p--) { const i = o.order[p]; for (let k = 0; k < sdTurnsFor(t[i]); k++) await turnAt(i, sdHour(t[i]) <= 6 ? 1 : -1); }
    const won = halls(at[0]).at(-1);
    assert.equal(won.ok, true, 'the Concord');
    assert.deepEqual(won.st, [...o.truth]);
    assert.equal(won.lit, 6);
    assert.equal(won.x, undefined);
    assert.equal(realm.store.get(SD_ORRERY_KEY).ok, true, 'kept');
    const n = halls(at[0]).length;
    await turnAt(o.order[0], 1);
    assert.equal(halls(at[0]).length, n, 'a turn after the Concord is nothing');
    // evicted and woken: the hall from storage; a newcomer hears the Concord
    realm.wake();
    const late = await stand(2, 'peer-late');
    assert.deepEqual(halls(late), [{ t: 'sd', k: 'pz', s: rec.s, st: [...o.truth], f: won.f, lit: 6, ok: true }]);
  });
});

test('SD6b the Hour closed: a turn after the Hollow is gone is nothing (the realm asks the hub\'s record, as its hello does)', async () => {
  await withHall(async ({ realm, hub, rec, step, set }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', atStone(1), { name: 'Ann' });
    const fell = sdFell(hub.store.get(SD_KEY), Date.now(), { top: 'Ann', n: 1 });
    await hub.room._sdSave(fell);
    set(fell.fellAt + SD_COLLAPSE_MS);
    step(10_001);   // past the realm's kept answer
    const n = halls(ann).length;
    await realm.raw(ann, turn(1, 1, 1));
    assert.equal(halls(ann).length, n);
    assert.equal(realm.store.get(SD_ORRERY_KEY), undefined);
    void rec;
  });
});

/** A session joined to `room` at a relay that says `relayV`, its socket open and welcomed. */
function rig(room, relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const heard = [], records = [];
  s.onSdHall = (r, rm) => heard.push([r, rm]);
  s.onSd = (r, rm) => records.push([r, rm]);
  const info = console.info; console.info = () => {};
  try {
    s.join(room, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: relayV });
  } finally { console.info = info; }
  const ws = sockets[0];
  return { s, ws, heard, records, out: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'sd'), tick: (ms) => { t += ms; } };
}

test('SD6b the session: a turn goes down my own socket in the realm alone, numbered, at a relay that keeps it, SD_PZ_HZ a second; the hall heard from my own realm alone - never the hub\'s, never a hub\'s record from the realm (mutants: a turn sent from a cell; the hall heard from anywhere)', () => {
  const realmKey = sdRoomKey(4);
  assert.equal(rig(worldRoom(PX, PY)).s.sendSdTurn(0, 1), false, 'no turn from a cell');
  const old = rig(realmKey, 'world174');
  assert.equal(old.s.sendSdTurn(0, 1), false, 'never at a relay that would close the socket on it');
  assert.equal(old.out().length, 0);
  const { s, ws, heard, records, out, tick } = rig(realmKey);
  assert.equal(s.sendSdTurn(2, -1), true);
  assert.deepEqual(out().at(-1), { t: 'sd', k: 'pz', i: 2, a: -1, q: 1 });
  assert.equal(s.sendSdTurn(2, 1), true);
  assert.equal(out().at(-1).q, 2, 'numbered');
  assert.equal(s.sendSdTurn(6, 1), false, 'a turn the wire refuses');
  assert.equal(s.sendSdTurn(1, 2), false);
  assert.equal(s.sendSdTurn(1, 1), true);
  assert.equal(s.sendSdTurn(1, 1), false, 'SD_PZ_HZ a second');
  assert.equal(out().length, SD_PZ_HZ);
  tick(1000);
  assert.equal(s.sendSdTurn(1, 1), true);
  assert.equal(out().at(-1).q, 4, 'a refused turn spends no number');
  const word = { t: 'sd', k: 'pz', s: 4, st: [1, 2, 3, 4, 5, 6], f: 3, lit: 1, ok: false, i: 1, a: 1, id: 'aaaa-0001', q: 4 };
  const info = console.info; console.info = () => {};
  try {
    ws.receive(word);
    ws.receive({ ...word, st: [1, 2, 3] });
    ws.receive({ t: 'sd', k: 'ev', s: 1, ph: 'risen', r: 3, at: 1, until: 2, next: 3 });
  } finally { console.info = info; }
  const { t: _t, ...r } = word; void _t;
  assert.deepEqual(heard, [[r, realmKey]], 'the hall, projected - and one the wire refuses dropped');
  assert.equal(records.length, 0, 'the realm never says the record');
  // the hub's socket: a hall there is dropped, and no turn goes from it
  const hub = rig(SOCIAL_ROOM);
  console.info = () => {};
  try { hub.ws.receive({ t: 'sd', k: 'pz', s: 4, st: [1, 2, 3, 4, 5, 6], f: 3, lit: 1, ok: false }); } finally { console.info = info; }
  assert.equal(hub.heard.length, 0, 'the hub never says a hall');
  assert.equal(hub.s.sendSdTurn(0, 1), false);
});

test('SD6b the relay by source: a turn routed before the find\'s bucket, on the hall\'s own; judged from the socket\'s own pose; the hall said after the welcome on the world path, where a realm\'s hello goes', () => {
  const src = read('server/src/index.js');
  const pz = src.indexOf("      if (m.k === 'pz') {\n        if (!this._spend(ws, now, sdPzRelayGate, 'sdPzBucket', 'sdPzDrops', 'too many turns')) return;\n        if (!isSdRoom(a.key)) { this._junk(ws); return; }");
  const found = src.indexOf("      if (!this._spend(ws, now, sdRelayGate, 'sdBucket', 'sdDrops', 'too many sd frames')) return;");
  assert.ok(pz > 0 && found > pz, 'the turn before the find\'s bucket');
  assert.match(src, /const \[x, , z\] = dungeonToRealm\(a\.pose\.x, a\.pose\.y \?\? 0, a\.pose\.z\);\n\s+if \(!stoneInReach\(m\.i, x, z, SD_STONE_REACH_SLACK\)\) return;/);
  const welcome = src.indexOf('      if (!this._send(ws, welcome)) return;');
  const hall = src.indexOf('      if (isSdRoom(a.key)) { try { if (!this._send(ws, this._sdHallWord(await this._sdHallOf(sdSlotOfRoom(a.key))))) return; }');
  assert.ok(welcome > 0 && hall > welcome, 'after the world path\'s welcome');
  assert.equal(SD_ORRERY_KEY, 'sdorrery');
  assert.match(read('bible/11-Multiplayer/Super-Dungeons.md'), /### SD6b - shipped 2026-10-07/);
});
