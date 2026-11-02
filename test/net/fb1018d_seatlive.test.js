// FIELD BUGS 2026-10-18d SEAT-LIVE (FloopZe, "Castle Daggerfall guards loot duping": "I am able to continuously enter/exit
// the castle and the loot/corpses respawn, duping the items/gold upon re-entering the castle. (This fixed itself after a
// few exits...)"). The relay named a room's host as the socket in it longest and kept the room's memory from that socket
// alone, while the page handed the room's foes to a joiner once that host went silent (SEAT-HEAL) - so a host whose page
// was hidden kept the pen while the joiner ran the room, and nothing the joiner did was kept. Mounted, not matched: the
// real relay Room over test/fakeRoom.mjs (net/seatLive.js its law), the real OnlineSession over test/fakeSocket.mjs, and
// the seat clock scenes/world.js reads. The dungeon's own doors across visits are test/scenes/fb1018d_seatloop.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { FOES_STALE_MS, FOES_FULL_MS, PIXEL_UNITS, RELAY_VERSION } from '../../src/net/wire.js';
import { seatOf, createSeatClock, seatStreams, relaySupportsSeatLive, SEAT_RELAY_MIN } from '../../src/net/seatLive.js';

const at = (k = 0) => ({ x: PIXEL_UNITS + 10 + k, y: 0, z: PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const hostSaid = (ws) => ofType(ws, 'host').map((m) => m.id);
/** A room on a clock the pin moves (the Room reads Date.now). */
async function onClock(fn) {
  const real = Date.now;
  const c = { t: real() };
  Date.now = () => c.t;
  try { return await fn(c); } finally { Date.now = real; }
}
const ROOM = 'dungeon:m1291010263';   // Daggerfall's own dungeon room - the castle
const memory = (by) => ({ locationKey: 'dungeon:m1291010263', stamp: by, world: { foes: [{ dead: true }] } });

test('SEAT-LIVE THE RELAY: a dungeon room\'s seat is a live socket\'s - a host that says no frame for FOES_STALE_MS with another there to hear it is no longer named, the joiner is (said to the room), its memory is kept and the silent host\'s refused; the host back from silence is a joiner, told so, and stays one while the seat lives (mutants: the walk by seniority alone; the kept host never asked again; the silence not owed from another\'s coming in; a returner keeping its stamp; the change never said)', async () => {
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = r.connect();
    await r.hello(H, 'hhhh-0001', at());
    c.t += 60_000;   // alone and standing still: it owes the room nothing
    assert.equal(r.room._hostOf(), 'hhhh-0001', 'a host alone is the host, however quiet');
    const P = r.connect();
    await r.hello(P, 'pppp-0002', at(1));
    assert.equal(ofType(P, 'welcome')[0].host, 'hhhh-0001', 'the joiner is told the host: its silence is owed only from the joiner\'s coming in');
    c.t += FOES_STALE_MS - 1000;
    await r.pose(P, at(2));
    assert.equal(r.room._hostOf(), 'hhhh-0001', 'inside FOES_STALE_MS of the joiner\'s coming in, the host stands');
    assert.deepEqual(hostSaid(P), [], 'and nothing is said');
    c.t += 2000;   // the host's page is hidden: it has said nothing since the joiner came in
    await r.pose(P, at(3));
    assert.equal(r.room._hostOf(), 'pppp-0002', 'a host silent past FOES_STALE_MS with another there to hear it is no longer the seat');
    assert.deepEqual(hostSaid(P), ['pppp-0002'], 'the change is said to the room, as a leave\'s is');
    assert.deepEqual(hostSaid(H), ['pppp-0002'], 'to the silent host too (a hidden page still hears)');
    await r.world(P, memory('P'), { final: true });
    assert.equal(r.store.get('world:meta')?.by, 'pppp-0002', 'the joiner who runs the room writes its memory');
    c.t += 1000;
    const since = H.att.since;
    await r.world(H, memory('H-frozen'));
    assert.equal(r.store.get('world:meta')?.by, 'pppp-0002', 'the silent host\'s frozen world is refused');
    assert.ok(H.att.since > since, 'it came back a joiner - its hello stamp is now');
    assert.deepEqual(hostSaid(H), ['pppp-0002', 'pppp-0002'], 'and it is told whose the seat is');
    for (let k = 0; k < 10; k++) {   // both live now: the seat's stream and the returner's poses
      c.t += FOES_FULL_MS;
      await r.pose(P, at(4 + k));
      await r.pose(H, at(5 + k));
    }
    assert.equal(r.room._hostOf(), 'pppp-0002', 'the returner stays a joiner while the seat lives');
    assert.equal(hostSaid(P).length, 1, 'nothing more said');
    c.t += 6000;
    await r.world(P, memory('P2'), { final: true });
    assert.equal(r.store.get('world:meta')?.by, 'pppp-0002', 'and the seat\'s word is still the room\'s');
  });
});

test('SEAT-LIVE THE RELAY: a live host keeps its seat - its frames inside FOES_STALE_MS hold it however long a quiet joiner stands; a reconnect keeps a live socket\'s stamp (AUDIT WORLD A4) and gives a silent one a new one; a building\'s room, whose host streams nothing, keeps the old law (mutants: the staleness off by its own bound; every room judged; the reconnect\'s stamp kept whatever)', async () => {
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = r.connect(), P = r.connect();
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    for (let k = 0; k < 15; k++) { c.t += FOES_FULL_MS; await r.pose(H, at(k)); }   // the host streams; the joiner stands
    c.t += FOES_STALE_MS;   // exactly the bound since the host's last frame: still live
    await r.pose(P, at(2));
    assert.equal(r.room._hostOf(), 'hhhh-0001', 'a host heard within FOES_STALE_MS is the seat');
    assert.ok(hostSaid(P).every((id) => id === 'hhhh-0001'), 'and nobody is told otherwise (the quiet joiner, back, is told the seat it already knew)');
    // a blip: the host's socket reconnects while live - it keeps its seat (AUDIT WORLD A4)
    const H2 = r.connect();
    await r.hello(H2, 'hhhh-0001', at());
    assert.equal(r.room._hostOf(), 'hhhh-0001', 'a live host\'s reconnect keeps its seat');
    // a page hidden long enough that its socket died: the reconnect after silence comes in a joiner
    c.t += FOES_STALE_MS + 1000;
    await r.pose(P, at(3));
    assert.equal(r.room._hostOf(), 'pppp-0002', 'silent, it lost the seat');
    c.t += 500;
    const H3 = r.connect();
    await r.hello(H3, 'hhhh-0001', at());
    assert.equal(ofType(H3, 'welcome')[0].host, 'pppp-0002', 'its reconnect after silence is welcomed a joiner');
    assert.equal(r.room._hostOf(), 'pppp-0002');
    // a building's room: its host streams no foes (AUDIT WORLD6a B8) - standing still is no silence there
    const b = fakeRoom('interior:m187.65537');
    const BH = b.connect(), BP = b.connect();
    await b.hello(BH, 'hhhh-0001', at());
    await b.hello(BP, 'pppp-0002', at(1));
    c.t += 120_000;
    await b.pose(BP, at(2));
    assert.equal(b.room._hostOf(), 'hhhh-0001', 'a building\'s host is its eldest, as ever');
    assert.deepEqual(hostSaid(BP), []);
  });
});

test('SEAT-LIVE THE RELAY: the seat\'s leave is said - a joiner named by the host\'s silence that leaves hands the seat on, and the room is told; the law is one function (mutants: the leave read by seniority alone, which told nobody)', async () => {
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = r.connect(), P = r.connect(), Q = r.connect();
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    await r.hello(Q, 'qqqq-0003', at(2));
    c.t += FOES_STALE_MS + 1000;
    await r.pose(P, at(3));
    assert.equal(r.room._hostOf(), 'pppp-0002', 'the eldest live');
    await r.pose(Q, at(4));
    await r.drop(P);
    assert.equal(r.room._hostOf(), 'qqqq-0003', 'the seat passes to the next live socket');
    assert.equal(hostSaid(Q).at(-1), 'qqqq-0003', 'and the room is told');
    assert.equal(hostSaid(H).at(-1), 'qqqq-0003');
  });
  // a returner always comes in AFTER the live seat - even one stamped in this same millisecond (the tie goes by id)
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const A = r.connect(), H = r.connect(), P = r.connect();
    await r.hello(A, 'aaaa-0001', at());
    await r.hello(H, 'hhhh-0002', at(1));
    await r.hello(P, 'pppp-0003', at(2));
    for (let k = 0; k < 4; k++) { c.t += FOES_FULL_MS; await r.pose(P, at(3 + k)); }
    assert.equal(r.room._hostOf(), 'pppp-0003', 'the only live one');
    c.t += 1000;
    await r.pose(H, at(9));   // back: stamped after the seat - now
    await r.drop(P);   // the seat leaves this same millisecond: the returner is the only live one
    assert.equal(r.room._hostOf(), 'hhhh-0002');
    await r.pose(A, at(10));   // the eldest back, still in that millisecond
    assert.equal(r.room._hostOf(), 'hhhh-0002', 'the eldest back from silence comes in after the seat stamped this millisecond - never level with it, where its id would win');
  });
  // the law alone: the eldest live, else the eldest
  const now = 100_000;
  const a = { id: 'a', since: 1, hi: 1, hd: 1 }, b = { id: 'b', since: 2, hi: 50_000, hd: now - 100 };
  assert.equal(seatOf([a, b], now), 'b', 'the eldest silent since the other came in is passed over');
  assert.equal(seatOf([a, b], now, { live: false }), 'a', 'by seniority alone, the eldest');
  assert.equal(seatOf([a], now), 'a', 'alone, it is the seat');
  assert.equal(seatOf([a, { ...b, hd: 1, hi: now - 10 }], now), 'a', 'the other came in moments ago: nothing is owed yet');
  assert.equal(seatOf([{ ...a }, { ...b, hd: 1 }], now), 'a', 'none live: the eldest');
  assert.equal(seatStreams(ROOM), true); assert.equal(seatStreams('interior:m187.65537'), false); assert.equal(seatStreams('cell:0,0'), false);
});

test('SEAT-LIVE THE PAGE: the session asks a seat-live relay for a silent host\'s seat - an unmoved pose every FOES_FULL_MS once the named host\'s stream has not come for FOES_STALE_MS, none while it comes, none of an older relay, none for its own seat (mutants: no ask; the ask every frame; the host\'s frame no word)', () => {
  const quiet = (fn) => { const l = console.log, w = console.warn, i = console.info; console.log = console.warn = console.info = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; console.info = i; } };
  const rig = (v = `world${SEAT_RELAY_MIN}`, host = 'hhhh-0001') => {
    const { FakeWS, sockets } = fakeSocketClass();
    const c = { t: 1_000_000 };
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'p', id: 'pppp-0002', secret: 'secret-of-pppp-0002', WebSocketImpl: FakeWS, now: () => c.t });
    quiet(() => s.join(ROOM, at()));
    const ws = sockets[0];
    ws.open();
    quiet(() => ws.receive({ t: 'welcome', id: 'pppp-0002', peers: [{ id: 'hhhh-0001', name: 'h', pose: at(1) }], host, world: null, v }));
    s.sendPose(at(2));
    const poses = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'pose').length;
    const run = (ms) => { for (let k = 0; k < ms; k += 100) { c.t += 100; quiet(() => s.tick()); } };
    return { s, ws, c, poses, run };
  };
  assert.equal(relaySupportsSeatLive(`world${SEAT_RELAY_MIN}`), true); assert.equal(relaySupportsSeatLive(`world${SEAT_RELAY_MIN - 1}`), false);
  const p = rig();
  const p0 = p.poses();
  p.run(FOES_STALE_MS - 200);
  assert.equal(p.poses(), p0, 'inside FOES_STALE_MS of the host\'s word: nothing asked');
  p.run(400);
  assert.equal(p.poses(), p0 + 1, 'the host silent: my pose, unmoved, so the relay hears me');
  p.run(FOES_FULL_MS * 3 - 100);
  assert.equal(p.poses(), p0 + 4, 'every FOES_FULL_MS, never every frame');
  quiet(() => p.ws.receive({ t: 'foes', id: 'hhhh-0001', data: { n: 1, k: ROOM, f: [] } }));
  const p1 = p.poses();
  p.run(FOES_STALE_MS - 200);
  assert.equal(p.poses(), p1, 'the host\'s stream came: no ask');
  quiet(() => p.ws.receive({ t: 'host', id: 'pppp-0002' }));
  const p2 = p.poses();
  p.run(FOES_STALE_MS * 2);
  assert.equal(p.poses(), p2, 'named: the seat is mine, nothing to ask');
  const old = rig(`world${SEAT_RELAY_MIN - 1}`);
  const o0 = old.poses();
  old.run(FOES_STALE_MS * 2);
  assert.equal(old.poses(), o0, 'an older relay keeps the eldest whatever is said: never asked');
});

test('SEAT-LIVE THE PAGE: the page\'s own absence spends no seat\'s patience - a gap of FOES_STALE_MS between its frames gives the named seat FOES_STALE_MS again, so SEAT-HEAL never takes the foes on the first frame back; scenes/world.js tells the clock each frame before it reads the seat, and stamps it where the old heartbeat was (mutants: the gap unread; the gap\'s bound off by one)', () => {
  const k = createSeatClock(FOES_STALE_MS);
  k.heard(0);
  for (let t = 16; t <= 5000; t += 16) k.frame(t);
  assert.equal(k.live(5000), true);
  for (let t = 5016; t <= 7000; t += 16) k.frame(t);
  assert.equal(k.live(7000), false, 'a page that drew every frame and heard nothing for FOES_STALE_MS: the seat is silent');
  const back = createSeatClock(FOES_STALE_MS);
  back.heard(0);
  back.frame(16);
  back.frame(16 + FOES_STALE_MS);   // the page was hidden: no frame for FOES_STALE_MS
  assert.equal(back.live(16 + FOES_STALE_MS), true, 'back from a hidden spell: the named seat has its patience again');
  assert.equal(back.live(16 + FOES_STALE_MS * 2), false, 'and it is spent only on frames this page drew');
  const short = createSeatClock(FOES_STALE_MS);
  short.heard(0); short.frame(16); short.frame(16 + FOES_STALE_MS - 1);
  assert.equal(short.live(16 + FOES_STALE_MS - 1), false, 'a gap short of FOES_STALE_MS is no absence');
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /seatClock\.frame\(now\); modes\?\.setDungeonAuthority\?\.\(dungeonAuthority\(now\)\);/, 'the frame tells the clock first');
  assert.match(w, /&& online\.host && !online\.isHost\(\) && seatClock\.live\(now\)\);/, 'the seat reads the clock');
  assert.equal((w.match(/seatClock\.heard\(performance\.now\(\)\)/g) ?? []).length, 2, 'the host\'s word and its stream applied');
});

test('SEAT-LIVE (AUDIT FB1018D L4-2): A SILENT HOST THAT LEAVES WITH NO FAREWELL HANDS THE SEAT ON, SAID - its silence past FOES_STALE_MS, its socket closed (a phone\'s background kill, a crash) before any frame said the change: the room is told the joiner, the joiner\'s session holds the seat and its memory is kept; and a room drained and come into again is told nothing past its welcome (mutants: the leave read by the live law alone; the told host\'s absence unasked)', async () => {
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = r.connect(), P = r.connect();
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    for (let k = 0; k < 3; k++) { c.t += FOES_FULL_MS; await r.pose(H, at(k)); await r.pose(P, at(1 + k)); }   // both live
    const t0 = c.t;
    c.t += FOES_STALE_MS - 1500; await r.pose(P, at(5));   // the joiner heard, the host still inside its bound
    assert.deepEqual(hostSaid(P), [], 'nothing said yet');
    c.t = t0 + FOES_STALE_MS + 500;   // the host silent past its bound - and no frame from anyone since
    await r.drop(H);   // its socket closes without a farewell
    assert.deepEqual(hostSaid(P), ['pppp-0002'], 'the leave says the seat the room never heard move');
    c.t += 500; await r.pose(P, at(6));
    assert.deepEqual(hostSaid(P), ['pppp-0002'], 'said once');
    await r.world(P, memory('P'), { final: true });
    assert.equal(r.store.get('world:meta')?.by, 'pppp-0002', 'its memory kept');
    // drained, and come into again: the welcome says the host, and no frame says it twice
    await r.drop(P);
    c.t += 1000;
    const Q = r.connect();
    await r.hello(Q, 'qqqq-0003', at(9));
    assert.equal(ofType(Q, 'welcome')[0].host, 'qqqq-0003');
    for (let k = 0; k < 4; k++) { c.t += FOES_FULL_MS; await r.pose(Q, at(10 + k)); }
    assert.deepEqual(hostSaid(Q), [], 'a host told to nobody here is not said again');
  });
});

test('SEAT-LIVE (AUDIT FB1018D L4-3): THE FRAMES THAT HOLD A SEAT ARE A PAGE\'S - a host that only streams its foes, standing still, keeps the seat; a joiner heard on its own lane alone is live; a ping the room hears, an act or a chat line keeps no hidden host\'s seat (mutants: the foes stream, the own lane uncounted; a ping, any frame counted)', async () => {
  const foes = (n) => JSON.stringify({ t: 'foes', data: { n, k: ROOM, f: [] } });
  const own = (n) => JSON.stringify({ t: 'own', data: { n, k: ROOM, f: [] } });
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = r.connect(), P = r.connect();
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    for (let k = 0; k < 15; k++) { c.t += FOES_FULL_MS; await r.raw(H, foes(k)); await r.pose(P, at(2 + k)); }
    assert.equal(r.room._hostOf(), 'hhhh-0001', 'its stream alone holds it');
  });
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = r.connect(), P = r.connect(), Q = r.connect();
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    await r.hello(Q, 'qqqq-0003', at(2));
    for (let k = 0; k < 6; k++) { c.t += FOES_FULL_MS; await r.raw(P, own(k)); await r.pose(Q, at(3 + k)); }
    assert.equal(r.room._hostOf(), 'pppp-0002', 'the eldest live is the own lane\'s');
  });
  for (const say of ['{"t":"ping","x":1}', JSON.stringify({ t: 'act', data: { d: 1 } }), JSON.stringify({ t: 'chat', text: 'brb' })]) {
    await onClock(async (c) => {
      const r = fakeRoom(ROOM);
      const H = r.connect(), P = r.connect();
      await r.hello(H, 'hhhh-0001', at());
      await r.hello(P, 'pppp-0002', at(1));
      for (let k = 0; k < 8; k++) { c.t += 1000; await r.raw(H, say); await r.pose(P, at(2 + k)); }
      assert.equal(r.room._hostOf(), 'pppp-0002', `${say} is no page's frame`);
    });
  }
});

test('SEAT-LIVE (AUDIT FB1018D L4-1, L4-3): THE RELAY TO ASK IS THE ONE THAT CARRIES THE LAW, AND A HOST NAMED IS HEARD - world220 first (world219 is EG-PERFECT\'s, with no seat law), and this build\'s own; a session told a new host asks nothing for FOES_STALE_MS after (mutants: the min a relay too low; the host frame not heard)', () => {
  assert.equal(SEAT_RELAY_MIN, 220, 'world220 first carries net/seatLive.js');
  assert.equal(relaySupportsSeatLive('world219'), false, 'EG-PERFECT\'s world219 keeps the eldest');
  assert.equal(relaySupportsSeatLive(RELAY_VERSION), true, 'this build\'s relay');
  const { FakeWS, sockets } = fakeSocketClass();
  const c = { t: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'p', id: 'pppp-0002', secret: 'secret-of-pppp-0002', WebSocketImpl: FakeWS, now: () => c.t });
  const quiet = (fn) => { const l = console.log, w = console.warn, i = console.info; console.log = console.warn = console.info = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; console.info = i; } };
  quiet(() => s.join(ROOM, at()));
  const ws = sockets[0];
  ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'pppp-0002', peers: [{ id: 'hhhh-0001', name: 'h', pose: at(1) }, { id: 'qqqq-0003', name: 'q', pose: at(2) }], host: 'hhhh-0001', world: null, v: RELAY_VERSION }));
  s.sendPose(at(2));
  const poses = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'pose').length;
  const run = (ms) => { for (let k = 0; k < ms; k += 100) { c.t += 100; quiet(() => s.tick()); } };
  run(FOES_STALE_MS + FOES_FULL_MS * 2);
  assert.ok(poses() > 1, 'asking while the named host is unheard');
  quiet(() => ws.receive({ t: 'host', id: 'qqqq-0003' }));
  const p0 = poses();
  run(FOES_STALE_MS - 200);
  assert.equal(poses(), p0, 'a host just named is a host heard: nothing asked of it yet');
});

/** AUDIT FB1018D L5-3: a socket as the runtime's Room.fetch accepts it - its attachment stamped `at`, when it opened (AUDIT
 *  WB A1). test/fakeRoom.mjs's connect leaves it out, and a building's seat reads it (net/seatLive.js seatInAt: no `hi`
 *  is written there). */
const opened = (r) => { const ws = r.connect(); ws.att.at = Date.now(); return ws; };

test('SEAT-LIVE (AUDIT FB1018D L5-3): A BUILDING\'S ROOM KEEPS THE ELDEST - its host streams no foes, so no silence there takes a seat: a third socket come in after a quiet spell leaves the eldest its seat, the eldest\'s leave is said, a reconnect after a quiet spell keeps its stamp (AUDIT WORLD A4), and the page asks no building for its seat (mutants: the walk, the lead, the reconnect and the ask read every room as a dungeon\'s)', async () => {
  const BUILDING = 'interior:m187.65537';
  const room = async (fn) => onClock(async (c) => {
    const r = fakeRoom(BUILDING);
    const H = opened(r), P = opened(r);
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    c.t += 3 * FOES_STALE_MS;
    await fn(r, H, P, c);
  });
  await room(async (r) => {
    const Q = opened(r);
    await r.hello(Q, 'qqqq-0003', at(2));
    assert.equal(r.room._hostOf(), 'hhhh-0001', 'a third come in: the eldest');
    await r.drop(r.sockets[0]);
    assert.equal(r.room._hostOf(), 'pppp-0002');
    assert.equal(hostSaid(r.sockets[1]).at(-1), 'pppp-0002', 'the eldest\'s leave said: the next eldest holds it');
  });
  await room(async (r) => {
    const H2 = opened(r);
    await r.hello(H2, 'hhhh-0001', at());
    assert.equal(r.room._hostOf(), 'hhhh-0001', 'the reconnect keeps the eldest\'s stamp');
  });
  const { FakeWS, sockets } = fakeSocketClass();
  const c = { t: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'p', id: 'pppp-0002', secret: 'secret-of-pppp-0002', WebSocketImpl: FakeWS, now: () => c.t });
  const quiet = (fn) => { const l = console.log, w = console.warn, i = console.info; console.log = console.warn = console.info = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; console.info = i; } };
  quiet(() => s.join(BUILDING, at()));
  sockets[0].open();
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'pppp-0002', peers: [{ id: 'hhhh-0001', name: 'h', pose: at(1) }], host: 'hhhh-0001', world: null, v: RELAY_VERSION }));
  s.sendPose(at(2));
  const poses = () => sockets[0].sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'pose').length;
  const p0 = poses();
  for (let k = 0; k < FOES_STALE_MS * 3; k += 100) { c.t += 100; quiet(() => s.tick()); }
  assert.equal(poses(), p0, 'no ask in a building');
});

test('SEAT-LIVE (AUDIT FB1018D L5-4): A SOCKET BACK FROM SILENCE COMES IN NOW - after a joiner who came in while it was away, so when the seat leaves it passes to that joiner (mutant: the returner stamped just after the seat, outranking the newer joiner)', async () => {
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = opened(r), P = opened(r);
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    c.t += FOES_STALE_MS + 1000;
    await r.pose(P, at(2));
    assert.equal(r.room._hostOf(), 'pppp-0002', 'the host silent: the joiner holds the seat');
    c.t += 1000;
    const Q = opened(r);
    await r.hello(Q, 'qqqq-0003', at(3));
    c.t += 1000;
    await r.pose(H, at(4));   // back from silence: a joiner, stamped now
    await r.pose(Q, at(5));
    await r.drop(P);
    assert.equal(r.room._hostOf(), 'qqqq-0003', 'the seat passes to the one who came in before the returner came back');
  });
});

test('SEAT-LIVE (AUDIT FB1018D L4-2): A LEAVER THAT LED BY THE LIVE LAW, BEFORE THE ROOM WAS TOLD, IS A HOST LEAVING - the told host silent past its bound, the eldest live joiner leaves before any frame said the change: the room is told the next live socket at the leave, not a frame later (mutant: the leave read by seniority)', async () => {
  await onClock(async (c) => {
    const r = fakeRoom(ROOM);
    const H = opened(r), P = opened(r), Q = opened(r);
    await r.hello(H, 'hhhh-0001', at());
    await r.hello(P, 'pppp-0002', at(1));
    await r.hello(Q, 'qqqq-0003', at(2));
    for (let k = 0; k < 2; k++) { c.t += FOES_FULL_MS; await r.pose(H, at(k)); await r.pose(P, at(3 + k)); await r.pose(Q, at(5 + k)); }
    c.t += FOES_STALE_MS - 500; await r.pose(P, at(7)); await r.pose(Q, at(8));   // the host still inside its bound
    assert.deepEqual(hostSaid(Q), [], 'nothing said');
    c.t += 1000;   // the host past its bound; P, the eldest live, leaves before any frame
    await r.drop(P);
    assert.deepEqual(hostSaid(Q), ['qqqq-0003'], 'told at the leave');
  });
});
