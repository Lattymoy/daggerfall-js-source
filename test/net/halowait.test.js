// HALO-WAIT (#1134): A CELL CROSSING WAITS FOR ITS HALO. A crossing into a cell whose halo was still connecting - its
// socket opening, or its token being minted - fell through to the ordinary join, which closed my cell and every halo,
// wiped the roster and opened them all again. The forward halo opens RANGE_PIXELS before the edge, 2-4 s ahead at the
// Overworld's x60 and x100, so one slow mint was a teardown. These pins drive the session over fake sockets and a mint
// the test answers, in the world host's own frame order (test/net/auditworld6biiib.test.js hostFrame).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cellHaloFor, isCellRoom, worldRoom } from '../../src/net/wire.js';
import { OnlineSession, HALO_WAIT_MS } from '../../src/net/online.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const TOKEN = `v1.${'a'.repeat(120)}.${'b'.repeat(86)}`;
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
const quiet = async (fn) => { const { info, warn } = console; console.info = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.info = info; console.warn = warn; } };
/** A pose at a map pixel, moving - each frame's differs, so the session's own gate never holds one back as unmoved. */
const poseAt = (mp) => ({ x: mp.x * 100, y: 2, z: mp.y * 100, yaw: 0, pitch: 0, mv: 1 });

/** A session whose every mint the test answers (`mints[i].answer()`), on the test's clock. */
function traveller() {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const mints = [];
  const mintToken = (room) => new Promise((r) => mints.push({ room, answer: () => r(TOKEN) }));
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t, mintToken });
  return { s, sockets, clock, mints };
}

/** The world host's online frame, as world.js orders it: the key from the pixel, the join when the cell is held or the
 *  hold is up (ROOM_HOLD_MS), else the pose; the halo from the pixel plus the cell stood in; the tick. */
function hostFrame(s, mp, now, state) {
  const key = worldRoom(mp.x, mp.y);
  if (key !== state.key) { state.key = key; state.since = now; }
  if (key !== s.room) { if (!s.room || (isCellRoom(key) && s.crossesNow(key)) || now - state.since >= 500) s.join(key, poseAt(mp)); }
  else s.sendPose(poseAt(mp));
  const want = isCellRoom(s.room) ? cellHaloFor(mp.x, mp.y, { current: s.haloRooms() }) : [];
  if (isCellRoom(s.room) && isCellRoom(key) && key !== s.room) want.push(key);
  s.setHalo(want);
  s.tick();
}

/** In cell 2 with Bob, welcomed; then at the cell's last pixel, cell 3's halo opened and its mint asked, unanswered. */
async function atTheEdge() {
  const t = traveller();
  const { s, sockets, clock, mints } = t;
  t.st = { key: null, since: 0 };
  hostFrame(s, { x: 40, y: 200 }, clock.t, t.st);
  sockets[0].open(); await flush(); mints[0].answer(); await flush();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look, pose: poseAt({ x: 40, y: 200 }) }], host: null, world: null });
  clock.t += 100; hostFrame(s, { x: 47, y: 200 }, clock.t, t.st);
  assert.deepEqual(s.haloRooms(), ['world:3,12']); assert.equal(sockets.length, 2);
  sockets[1].open(); await flush();
  assert.equal(mints.length, 2, 'the halo\'s mint is asked'); assert.equal(s._halo.get('world:3,12').status, 'connecting', 'and not answered');
  return t;
}

test('HALO-WAIT: a crossing into a cell whose halo is still minting WAITS from its first frame - nothing closed, nobody wiped, my pose down my own cell all the while, the hold\'s 500 ms included - and promotes the halo the frame its hello goes', () => quiet(async () => {
  const { s, sockets, clock, mints, st } = await atTheEdge();
  const poses = () => sockets[0].sent.filter((f) => f.startsWith('{"t":"pose"')).length;
  const posesBefore = poses();
  s._who.set('eve-0003', clock.t);   // a stranger asked for in my cell
  clock.t += 100; hostFrame(s, { x: 48, y: 200 }, clock.t, st);   // the crossing frame: the hold has not begun to run out
  assert.equal(poses(), posesBefore + 1, 'my pose goes out in the crossing frame itself (the hold sent none for 500 ms)');
  for (const x of [48, 48, 49, 49]) { clock.t += 300; hostFrame(s, { x, y: 200 }, clock.t, st); }   // 1.3 s in cell 3, the 500 ms hold long past
  assert.equal(s.room, 'world:2,12', 'still my old cell'); assert.equal(s._ws, sockets[0]);
  assert.ok(s._who.has('eve-0003'), 'the asked list kept through every frame of the wait - asked before the join\'s clears');
  assert.equal(sockets.length, 2, 'no socket opened'); assert.equal(sockets[0].closed, null); assert.equal(sockets[1].closed, null, 'nothing closed');
  assert.ok(s.peers.has('bob-0002'), 'Bob still stands');
  assert.ok(poses() > posesBefore + 1, 'my pose went on down the cell I hold');
  mints[1].answer(); await flush();
  assert.equal(s._halo.get('world:3,12').status, 'open', 'the halo\'s hello went');
  const reconnects = s.stats.reconnects;
  clock.t += 100; hostFrame(s, { x: 50, y: 200 }, clock.t, st);
  assert.equal(s.room, 'world:3,12'); assert.equal(s._ws, sockets[1], 'the halo\'s socket promoted');
  assert.deepEqual(s.haloRooms(), ['world:2,12'], 'the cell left is a halo'); assert.equal(sockets.length, 2); assert.equal(sockets[0].closed, null);
  assert.equal(s.stats.reconnects, reconnects); assert.ok(s.peers.has('bob-0002'), 'nobody wiped');
  assert.equal(s._who.has('eve-0003'), false, 'the crossing itself forgets who was asked (AUDIT WORLD6b-iii(e) B4)');
}));

test('HALO-WAIT: a pixel that moves on into a THIRD cell while waiting (a corner at speed) is joined by the same rule for that cell - waited for while its halo is connecting, then promoted, nothing torn down', () => quiet(async () => {
  const { s, sockets, clock, mints } = traveller();
  const st = { key: null, since: 0 };
  const sock = (room) => sockets.find((w) => w.url.endsWith(`/room/${room}`) && !w.closed);
  const mintOf = (room) => mints.find((m) => m.room === room);
  hostFrame(s, { x: 40, y: 200 }, clock.t, st);
  sockets[0].open(); await flush(); mints[0].answer(); await flush();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look, pose: poseAt({ x: 40, y: 200 }) }], host: null, world: null });
  clock.t += 100; hostFrame(s, { x: 47, y: 207 }, clock.t, st);   // cell 2,12's corner pixel: three halos
  assert.deepEqual(s.haloRooms().sort(), ['world:2,13', 'world:3,12', 'world:3,13']);
  for (const r of s.haloRooms()) sock(r).open();
  await flush();
  for (let i = 0; i < 3; i++) { clock.t += 300; hostFrame(s, { x: 48, y: 207 }, clock.t, st); }   // into 3,12 and past its hold: waiting
  assert.equal(s.room, 'world:2,12', 'waiting on 3,12');
  for (let i = 0; i < 3; i++) { clock.t += 300; hostFrame(s, { x: 48, y: 208 }, clock.t, st); }   // on into 3,13 and past its own hold: waiting on 3,13
  assert.equal(s.room, 'world:2,12', 'waiting on 3,13 now'); assert.equal(sockets.filter((w) => w.closed).length, 0, 'nothing closed');
  mintOf('world:3,13').answer(); await flush();
  clock.t += 100; hostFrame(s, { x: 48, y: 208 }, clock.t, st);
  assert.equal(s.room, 'world:3,13'); assert.equal(s._ws, sock('world:3,13'), '3,13\'s own halo promoted');
  assert.ok(s.peers.has('bob-0002'), 'nobody wiped'); assert.ok(s.haloRooms().includes('world:2,12'), 'the cell left a halo');
  for (const m of mints) m.answer();
  await flush();
}));

test('HALO-WAIT: the wait is BOUNDED - a halo still connecting HALO_WAIT_MS after it opened is not waited for, and the crossing is joined the ordinary way (its socket closed, not leaked)', () => quiet(async () => {
  const { s, sockets, clock, mints, st } = await atTheEdge();
  const opened = s._halo.get('world:3,12').since;
  clock.t += 600; hostFrame(s, { x: 48, y: 200 }, clock.t, st);
  assert.equal(s.room, 'world:2,12', 'waiting');
  clock.t = opened + HALO_WAIT_MS - 1; hostFrame(s, { x: 49, y: 200 }, clock.t, st);
  assert.equal(s.room, 'world:2,12', 'waiting to the last millisecond');
  clock.t = opened + HALO_WAIT_MS; hostFrame(s, { x: 49, y: 200 }, clock.t, st);
  assert.equal(s.room, 'world:3,12', 'joined'); assert.notEqual(s._ws, sockets[1]);
  assert.deepEqual(sockets[1].closed, { code: 1000, reason: 'leaving' }, 'the halo that never opened is closed');
  assert.ok(sockets.slice(2).some((w) => w.url.endsWith('/room/world:3,12')), 'a socket of its own for the cell stood in');
  for (const m of mints) m.answer();   // the mints the sockets awaited, let go, so no wait outlives the pin
  await flush();
}));

test('HALO-WAIT: only a halo with a socket CONNECTING is waited for - one dropped (its retry pending) is joined once the hold is up, and so is any crossing while my own cell\'s socket is down', () => quiet(async () => {
  {
    const { s, sockets, clock, mints, st } = await atTheEdge();
    sockets[1].drop(1006);
    assert.equal(s._halo.get('world:3,12').status, 'closed');
    assert.equal(s.crossesNow('world:3,12'), false, 'a dropped halo is nothing to wait for');
    clock.t += 100; hostFrame(s, { x: 48, y: 200 }, clock.t, st);   // the crossing frame: the hold begins
    assert.equal(s.room, 'world:2,12', 'the hold kept - an edge paced is not a churn (AUDIT ONLINE D11)'); assert.equal(sockets[0].closed, null);
    clock.t += 500; hostFrame(s, { x: 48, y: 200 }, clock.t, st);
    assert.equal(s.room, 'world:3,12', 'a dropped halo: joined the ordinary way'); assert.deepEqual(sockets[0].closed, { code: 1000, reason: 'leaving' });
    for (const m of mints) m.answer();
    await flush();
  }
  {
    const { s, sockets, clock, mints, st } = await atTheEdge();
    sockets[0].drop(1006);
    // my own cell's retry: a socket again, still connecting - a socket, and no open cell to wait in
    const since = s._halo.get('world:3,12').since;
    while (!sockets.slice(2).some((w) => w.url.endsWith('/room/world:2,12')) && clock.t - since < 7000) { clock.t += 250; hostFrame(s, { x: 47, y: 200 }, clock.t, st); }
    assert.ok(s._ws && s._ws.url.endsWith('/room/world:2,12'), 'my cell retried'); assert.equal(s.status, 'connecting');
    assert.equal(s._halo.get('world:3,12').status, 'connecting', 'and the halo still connecting');
    clock.t += 100; hostFrame(s, { x: 48, y: 200 }, clock.t, st);
    clock.t += 500; hostFrame(s, { x: 48, y: 200 }, clock.t, st);
    assert.equal(s.room, 'world:3,12', 'my own cell down: no cell to wait in, joined');
    for (const m of mints) m.answer();
    await flush();
  }
}));

test('HALO-WAIT: an edge paced back and forth while the halo connects churns nothing - each step over waits, each step back is my own cell again, and no socket opens or closes', () => quiet(async () => {
  const { s, sockets, clock, mints, st } = await atTheEdge();
  for (const x of [48, 47, 48, 47, 48]) { clock.t += 200; hostFrame(s, { x, y: 200 }, clock.t, st); }
  assert.equal(s.room, 'world:2,12'); assert.equal(sockets.length, 2, 'no socket opened'); assert.equal(sockets.filter((w) => w.closed).length, 0, 'none closed');
  assert.deepEqual(s.haloRooms(), ['world:3,12'], 'the halo held throughout');
  for (const m of mints) m.answer();
  await flush();
}));

test('HALO-WAIT by source: the wait is asked before the join clears its lists, sends the pose it was handed, and ends no halo of its own; the host joins at once on crossesNow; the record', () => {
  const o = rd('src/net/online.js');
  assert.match(o, /if \(room === this\.room && this\._ws\) return;\n(?:\s*\/\/[^\n]*\n)+\s*if \(this\._haloWait\(room\)\) \{ if \(pose\) this\.sendPose\(pose\); return; \}\n\s*this\._threwKinds\.clear\(\);/, 'asked before the clears');
  assert.match(o, /return !!h\?\.ws && h\.status === 'connecting' && !!this\._ws && this\.status === 'open' && isCellRoom\(room\) && isCellRoom\(this\.room\)\n\s*&& this\._now\(\) - \(h\.since \?\? -Infinity\) < HALO_WAIT_MS;/);
  assert.match(o, /export const HALO_WAIT_MS = BACKOFF_MAX_MS;/, 'the wait is the halo\'s own connecting life (A7)');
  assert.equal((o.match(/this\._endHalo\(\);/g) ?? []).length, 3, 'leave and the two terminal closes, as AUDIT WORLD6b-iii(b) A4 counts them');
  assert.match(o, /crossesNow\(key\) \{ return this\.inRoom\(key\) \|\| this\._haloWait\(key\); \}/, 'a crossing needs no hold into a cell held or waited for');
  assert.match(rd('src/scenes/world.js'), /\(isCellRoom\(key\) && online\.crossesNow\(key\)\) \|\| now - _onlineKeySince >= ROOM_HOLD_MS/, 'the host joins at once on it, the hold left to everything else');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## HALO-WAIT - A CELL CROSSING WAITS FOR ITS HALO \(2026-10-22, #1134\)/, 'the record');
});
