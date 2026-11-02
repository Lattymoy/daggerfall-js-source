// COST-1 (2026-10-24, the owner's Cloudflare bill; bible/11-Multiplayer/Scale-Arc.md COST-1): A DRAINED ROOM LEAVES
// NOTHING ARMED. A pending timer keeps a Durable Object from hibernating, and a cell armed windows that waited up to ten
// minutes - the spawn grant's measure, the staff traffic and reaction feeds, the reviewer's feed - so a player who crossed
// a cell left it billed after they walked on. The last leave (server/src/index.js _leave) posts every open window now
// and clears its timer (server/src/drainWindows.js flushAtDrain); a room with a socket still in it posts on its timers as
// before. And the relay's metrics count a storage write by the rows it bills (server/src/relayScale.js countedState).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { GRANT_MEASURE_SIG_HEADER } from '../../src/net/grantMeasure.js';
import { STAFF_FEED_SIG_HEADER } from '../../server/src/staffFeedLaw.js';
import { staffFoesStripped, staffFeedsStop } from '../../server/src/staffFeeds.js';
import { flushAtDrain } from '../../server/src/drainWindows.js';
import { countedState, rowsWritten, RoomMetrics } from '../../server/src/relayScale.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151);
const KEY = cellRoomOfWire(P0.x, P0.z);
const GRANT_URL = 'https://accounts.example/v1/mod/grant-feed', NET_URL = 'https://accounts.example/v1/staff/net-feed', REACT_URL = 'https://accounts.example/v1/mod/reaction-feed';
/** A settled turn: the drain's posts are the leave's, never awaited by it. */
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
/** Until `done()` holds, or two seconds of real time pass. The grant's post signs its window first (crypto.subtle, off
 *  the event loop), so no fixed number of turns is sure to come after it. */
const until = async (done) => {
  const end = performance.now() + 2000;
  while (!done() && performance.now() < end) await new Promise((resolve) => setTimeout(resolve, 5));
};

/** A cell with the relay's receipt key and the grant feed on, its posts recorded; players helloed at P0. */
async function cell(t) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const r = fakeRoom(KEY, { now: () => now });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  r.env.GRANT_FEED_URL = GRANT_URL;
  const posts = [];
  r.env.ACCOUNTS = { fetch: async (req) => { posts.push({ url: req.url, sig: req.headers.get(GRANT_MEASURE_SIG_HEADER) }); return new Response('{}', { status: 202 }); } };
  t.after(() => { staffFeedsStop(r.room); return r.room._grantFlush(); });
  const join = async (id) => {
    const ws = r.connect();
    await r.hello(ws, id, P0, { lv: 7, charLevel: 12 });
    return { ws, ask: (n) => r.raw(ws, JSON.stringify({ t: 'grant', k: 'mint', id: n, kind: 'enc', n: 2 })) };
  };
  return { r, posts, join };
}

test('COST-1 THE DRAIN POSTS THE GRANT\'S WINDOW: a cell whose player asked a grant holds its measure on a ten-minute timer; while another player is in the cell the leave posts nothing and the timer stands; the last leave posts the window at once, signed, and clears the timer - and a room with nothing open posts nothing (mutants: the drain unwired; the window left armed; a leave that is not the last posts)', async (t) => {
  const { r, posts, join } = await cell(t);
  const a = await join('peer-0001'), b = await join('peer-0002');
  await a.ask(1);
  assert.ok(r.room._grants?.w.rows.size, 'the window holds the ask');
  assert.equal(r.room._grants.timer ?? null, null, 'HIBERNATE: and arms no timer - the room may sleep');
  await r.drop(a.ws);
  await settle();
  assert.equal(posts.length, 0, 'a player still here: nothing posted');
  assert.ok(r.room._grants.w.rows.size, 'its window stands');
  await r.drop(b.ws);
  await until(() => posts.length > 0);
  assert.deepEqual(posts.map((p) => p.url), [GRANT_URL], 'the last leave posts the window');
  assert.ok(posts[0].sig, 'signed');
  assert.equal(r.room._grants.timer ?? null, null, 'and nothing is left armed');
  // a second drain with no window open: no post
  const c = await join('peer-0003');
  await r.drop(c.ws);
  await settle();
  assert.equal(posts.length, 1, 'nothing open, nothing posted');
});

/** A room as the staff feeds see it (staffpanel5feeds_relay.test.js's own shape), its socket count `held`, the account
 *  service answering `status` (its next answers, 202 past them). */
async function feedRoom(t, { held = 0, status = [] } = {}) {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const posts = [];
  const room = {
    env: {
      STAFF_NET_FEED_URL: NET_URL, REACTION_FEED_URL: REACT_URL,
      ACCOUNTS: { fetch: async (req) => { posts.push({ url: req.url, sig: req.headers.get(STAFF_FEED_SIG_HEADER) }); return new Response('{}', { status: status.shift() ?? 202 }); } },
    },
    state: { getWebSockets: () => Array.from({ length: held }, () => ({})) },
    _vsocks: new Map(), _all: () => [], _meters: new Map(), _receiptKeyOf: async () => kp.privateKey,
  };
  t.after(() => staffFeedsStop(room));
  return { room, posts };
}
const REACT_ROW = () => ({ a: 'acct-1234', k: 'enc', n: 2, t: Date.now() - 5000, ms: 5000, ps: 20, w0: 0, mv: 12, tn: 40, p1: 100, ac: 900 });

test('COST-1 THE DRAIN POSTS THE STAFF FEEDS: the traffic feed\'s row armed for its window\'s end and the reaction feed\'s finished episodes waiting on their tick both go at the drain, and both timers are cleared; a reviewer\'s batch of lines goes too; a post that fails arms itself again, and a room still empty lets that go - one a socket came back to keeps it (mutants: the net feed left; the reaction feed left; the lines left; a failed post\'s retry kept in an empty room; a retry cleared under a socket)', async (t) => {
  const { room, posts } = await feedRoom(t);
  staffFoesStripped(room, { key: KEY, sub: 'acct-strip-0001' }, 3, Date.now());
  assert.ok(room._staffNet.foes.size || room._staffNet.rows.size, 'the traffic window holds its row');
  assert.equal(room._staffNet.timer ?? null, null, 'HIBERNATE: and arms no timer - it posts on a frame past its end or at the drain');
  room._staffReact = { open: new Map(), openN: 0, rows: [REACT_ROW()], from: Date.now(), q: KEY, timer: setTimeout(() => {}, 60_000), retry: null };
  let lines = 0;
  room._feedQ = { lines: [{ text: 'a line' }], timer: setTimeout(() => {}, 30_000) };
  room._feedFlush = async () => { lines++; clearTimeout(room._feedQ.timer); room._feedQ.timer = null; room._feedQ.lines.length = 0; return true; };
  assert.equal(await flushAtDrain(room), 3);
  assert.deepEqual(posts.map((p) => p.url).sort(), [NET_URL, REACT_URL].sort(), 'both feeds posted, signed');
  assert.ok(posts.every((p) => p.sig));
  assert.equal(lines, 1, 'the reviewer\'s lines posted');
  assert.deepEqual([room._staffNet.timer ?? null, room._staffReact.timer, room._feedQ.timer], [null, null, null], 'nothing left armed');
  assert.equal(await flushAtDrain(room), 0, 'drained again with nothing open: nothing');

  // the service fails: the post arms itself to go again - an empty room lets it go, a room someone came back to keeps it
  const empty = await feedRoom(t, { status: [503] });
  staffFoesStripped(empty.room, { key: KEY, sub: 'acct-strip-0002' }, 3, Date.now());
  await flushAtDrain(empty.room);
  assert.ok(empty.room._staffNet.retry, 'the failed batch kept for its next post');
  assert.equal(empty.room._staffNet.timer ?? null, null, 'but no timer holds the empty room awake for it');
  const back = await feedRoom(t, { status: [503], held: 1 });
  staffFoesStripped(back.room, { key: KEY, sub: 'acct-strip-0003' }, 3, Date.now());
  back.room._feedQ = { lines: [{ text: 'a line' }], timer: setTimeout(() => {}, 30_000) };   // the reviewer's lines, their post failing
  back.room._feedFlush = async () => false;
  t.after(() => clearTimeout(back.room._feedQ.timer));
  await flushAtDrain(back.room);
  assert.ok(back.room._feedQ.timer, 'a socket came back: the lines\' timer stays armed');
  assert.ok(back.room._staffNet.retry, 'a socket came back: its retry kept for the next frame past the window (HIBERNATE: never a timer)');
  assert.equal(back.room._staffNet.timer ?? null, null);
});

test('COST-1 A WRITE IS COUNTED BY THE ROWS IT BILLS: a key\'s put or delete one, a put of entries one an entry, a delete of keys one a key, deleteAll one, an alarm set or deleted one; reads as before - so double11 is the storage rows the bill counts (mutants: an alarm uncounted; entries counted as one; keys counted as one; a read counted a write)', async () => {
  const m = new RoomMetrics(0);
  const store = { get: async () => null, list: async () => new Map(), put: async () => {}, delete: async () => true, deleteAll: async () => {}, setAlarm: async () => {}, deleteAlarm: async () => {}, getAlarm: async () => null };
  const s = countedState({ storage: store, id: 'x' }, m).storage;
  const writes = async (fn) => { const w0 = m.c.writes; await fn(); return m.c.writes - w0; };
  assert.equal(await writes(() => s.put('k', 1)), 1);
  assert.equal(await writes(() => s.put({ a: 1, b: 2, c: 3 })), 3);
  assert.equal(await writes(() => s.delete('k')), 1);
  assert.equal(await writes(() => s.delete(['a', 'b'])), 2);
  assert.equal(await writes(() => s.deleteAll()), 1);
  assert.equal(await writes(() => s.setAlarm(5)), 1);
  assert.equal(await writes(() => s.deleteAlarm()), 1);
  assert.equal(await writes(() => s.getAlarm()), 0, 'reading the alarm writes nothing');
  const r0 = m.c.reads;
  await s.get(['a', 'b']); await s.list();
  assert.equal(m.c.reads - r0, 2, 'reads as before');
  assert.equal(rowsWritten('put', [{}]), 0, 'a put of nothing bills nothing');
});
