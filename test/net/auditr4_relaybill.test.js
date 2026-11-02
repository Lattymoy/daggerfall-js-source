// AUDIT RELEASE R4 (2026-10-26, the owner: "ensure everything is perfect and that everything is covered for a smooth
// release that expands our world seamlessly", and before it "ensuring this new integration doesnt implode the server or
// insanely skyrocket our server cost"; bible/01-Overview/audits/Audit-Release-R4.md) - THE RELAY'S BILL, HELD BY COUNT.
// What a Durable Object is billed for is its time awake and its storage's rows, so the two budgets the release leans on
// are pinned as counts, never as a clock:
//   R4-1 the relay arms a timer at exactly the sites it armed before the land past the Bay opened - a timer pending is
//        what keeps an object from hibernating (GRANT-SLEEP took the last one a cell held), so a new one is a choice
//        made in this census, not one made by accident;
//   R4-2 a cell's grant gate (AUDIT TESA III E2-1) costs one storage row an ask that can move it, one read an instance
//        life, and nothing for a pose or a tally - the per-ask write the release adds to the bill, and no more.
// tools/mutants/auditr4.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { GRANT_GATE_KEY } from '../../src/net/grantLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return await fn(); } finally { Object.assign(console, { warn: w, log: l, info: i }); } };

/** THE RELAY'S TIMERS, each by what it runs - the census of 2026-10-26 (relay world260, this branch): the hub's pose
 *  batches and bus links, the counts it says, the polls and the feed's wait. Each fires and is gone; none is armed by a
 *  cell, a channel past the Bay or a grant. A timer added, moved to another callee or taken away moves this list in the
 *  same change, with its reason in the audit's page. */
const TIMERS = Object.freeze([
  ['server/src/index.js', 'this._flushOwed(), POSE_BATCH_MS'],
  ['server/src/index.js', 'this._flushOwed(), ms'],
  ['server/src/index.js', 'this._hubUpFlush(); }, HUB_BATCH_MS'],
  ['server/src/index.js', 'this._hubUpFlush(); }, this._upHoldUntil - now'],
  ['server/src/index.js', 'this._hubUpFlush(); }, HUB_RETRY_MS'],
  ['server/src/index.js', 'setTimeout(r, HUB_BATCH_MS)'],
  ['server/src/index.js', 'this._pollWake = null; done(false); }, ms'],
  ['server/src/index.js', 'this._hubCountSay(); }, HUB_COUNT_MS'],
  ['server/src/index.js', 'this._busCountTell(); }, HUB_COUNT_MS'],
  ['server/src/index.js', 'this._downFlush(); }, HUB_BATCH_MS'],
  ['server/src/index.js', 'this._pollAnswer(hub, p), HUB_POLL_MS'],
  ['server/src/index.js', 'void this._feedFlush(); }, FEED_WAIT_MS'],
  // PIN MOVED (AUDIT RELEASE R3, the merge of main into TESA): the staff panel's two windows armed no timer on main's
  // HIBERNATE (they post on their next frame, and COST-1's drain posts what is left - server/src/drainWindows.js), so
  // their rows are gone; COST-1's and COST-2's files are counted beside the rest
]);
const RELAY_FILES = ['server/src/index.js', 'server/src/relay.js', 'server/src/relayScale.js', 'server/src/foesHold.js', 'server/src/staffEvents.js',
  'server/src/staffFeedLaw.js', 'server/src/staffFeeds.js', 'server/src/staffFollow.js', 'server/src/staffFreeze.js', 'server/src/staffHidden.js',
  'server/src/staffMessage.js', 'server/src/staffTeleport.js', 'server/src/drainWindows.js', 'server/src/cellHandover.js', 'server/src/cellMoves.js',
  'server/src/cellNodes.js'];

test('AUDIT R4-1 the relay\'s timers: twelve sites (fourteen before main\'s HIBERNATE took the staff panel\'s two - PIN MOVED, AUDIT RELEASE R3), each by its callee, and no interval anywhere - a timer pending keeps a Durable Object awake, so a new one is counted here (mutants: a timer added to a cell\'s path; an interval)', () => {
  const sites = [];
  for (const f of RELAY_FILES) {
    const text = src(f);
    assert.doesNotMatch(text, /\bsetInterval\s*\(/, `${f}: an interval never lets its object sleep`);
    for (const line of text.split('\n')) {
      const code = line.replace(/\/\/.*$/, '');
      const n = (code.match(/\bsetTimeout\s*\(/g) ?? []).length;
      for (let i = 0; i < n; i++) sites.push([f, line]);
    }
  }
  const named = sites.map(([f, line]) => TIMERS.findIndex(([tf, needle]) => tf === f && line.includes(needle)));
  assert.equal(sites.length, TIMERS.length, `the relay arms ${sites.length} timers: ${sites.filter((_, i) => named[i] < 0).map(([f, l]) => `${f}: ${l.trim().slice(0, 120)}`).join(' | ')}`);
  assert.deepEqual([...named].sort((a, b) => a - b), TIMERS.map((_, i) => i), 'each census row names one site');
});

const P0 = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
const T0 = 1_800_000_000_000;

/** A cell in enforce, its storage's operations on the grant gate's key counted. */
async function cell(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  const r = fakeRoom(cellRoomOfWire(P0.x, P0.z), { now: () => now });
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  Object.assign(r.env, { GATE_SIGNING_KEY: Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), GRANT_MODE: 'enforce' });
  const ops = { get: 0, put: 0, delete: 0 };
  const touches = (k) => (Array.isArray(k) ? k.includes(GRANT_GATE_KEY) : k && typeof k === 'object' ? Object.hasOwn(k, GRANT_GATE_KEY) : k === GRANT_GATE_KEY);
  for (const op of /** @type {const} */ (['get', 'put', 'delete'])) {
    const real = r.state.storage[op].bind(r.state.storage);
    r.state.storage[op] = (k, ...rest) => { if (touches(k)) ops[op]++; return real(k, ...rest); };
  }
  const ws = r.connect();
  await quiet(() => r.hello(ws, 'sock-r4-0001', P0, { lv: 7, charLevel: 12 }));
  let n = 0;
  const ask = async (body) => { now += 1500; await quiet(() => r.raw(ws, JSON.stringify({ t: 'grant', id: ++n, ...body }))); return ws.sent.filter((m) => m.t === 'grant').at(-1); };
  const pose = async () => { now += 200; await r.pose(ws, { ...P0, x: P0.x + (n % 7) }); };
  return { r, ws, ask, pose, ops: () => ({ ...ops }) };
}

test('AUDIT R4-2 a cell\'s grant gate costs one storage row an ask that moves it, one read an instance life, nothing a pose or a tally - and a wake reads it once again (mutants: the read every ask; a row written for a tally; a row written for a pose)', async (t) => {
  const C = await cell(t);
  for (let i = 0; i < 20; i++) await C.pose();
  assert.deepEqual(C.ops(), { get: 0, put: 0, delete: 0 }, 'poses touch no gate');
  for (let i = 0; i < 4; i++) await C.ask({ k: 'tally', rows: [{ o: 'sock-zed-09', r: 'marks', n: 1 }] });
  assert.deepEqual(C.ops(), { get: 1, put: 0, delete: 0 }, 'a tally reads the gate once (its first ask an instance life) and writes nothing - the measure is a sample, in memory');
  const minted = [];
  for (let i = 0; i < 3; i++) minted.push(await C.ask({ k: 'mint', kind: 'loose', n: 2 }));
  assert.deepEqual(minted.map((a) => a.k), ['ok', 'ok', 'ok']);
  assert.deepEqual(C.ops(), { get: 1, put: 3, delete: 0 }, 'one row an ask that moved the gate, and no second read');
  for (let i = 0; i < 20; i++) await C.pose();
  for (let i = 0; i < 4; i++) await C.ask({ k: 'tally', rows: [{ o: 'sock-zed-09', r: 'marks', n: 1 }] });
  assert.deepEqual(C.ops(), { get: 1, put: 3, delete: 0 }, 'and still nothing a pose, nor a tally with a gate standing');
  C.r.wake();
  await C.ask({ k: 'mint', kind: 'loose', n: 2 });
  await C.ask({ k: 'mint', kind: 'loose', n: 2 });
  assert.deepEqual(C.ops(), { get: 2, put: 5, delete: 0 }, 'a woken cell reads its gate once, then a row an ask');
});
