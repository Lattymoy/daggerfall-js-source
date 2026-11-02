// AUDIT TESA III E2-1 (2026-10-26, the owner: "Comprehensive audit on everything to ensure perfection";
// bible/01-Overview/audits/Audit-Tesa-III-E2.md): A CELL'S GRANT GATE OUTLIVES ITS SLEEP. GRANT-SLEEP (Spawn-Grants.md
// section 22) took away the ten-minute timer that held a cell awake from a window's first fold, and the gate - each
// account's bucket per kind, the live grants that count against the cell's ceiling, the counter, the sockets that stood
// on a grant - lived in the object's memory alone. So a cell nobody spoke in for ten seconds hibernated and woke with
// every bucket full and its ceiling empty: a client that held its frames back had a Greater Giant's two calls back every
// few seconds where the law gives one in two minutes, and a cell's 192 granted hostiles again on top of the 192 it had.
// The gate is kept in the cell's storage now (net/grantLaw.js grantGateKept, grantGateOf; server/src/index.js
// _grantGateLoad, _grantGateKeep) - and still no timer. tools/mutants/audittesa3e2.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { GRANT_CELL_CEILING, GRANT_TTL_MS, GRANT_KINDS, GRANT_GATE_KEY, GRANT_GATE_V, grantGateKept, grantGateOf, validGrantOut } from '../../src/net/grantLaw.js';

const { subtle } = globalThis.crypto;
const P0 = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
const CELL = cellRoomOfWire(P0.x, P0.z);
const T0 = 1_800_000_000_000;
const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };

/** Every timer of a minute or more armed while the pin runs - recorded, never scheduled (one pending keeps an object
 *  from hibernating, and this fix must arm none). */
function longTimers(t) {
  const real = globalThis.setTimeout, armed = [];
  globalThis.setTimeout = /** @type {any} */ ((fn, ms, ...rest) => { if (ms >= 60_000) { armed.push(ms); return { long: ms }; } return real(fn, ms, ...rest); });
  t.after(() => { globalThis.setTimeout = real; });
  return armed;
}

async function cell(t, env = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  const r = fakeRoom(CELL, { now: () => now });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  Object.assign(r.env, { GATE_SIGNING_KEY: Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), GRANT_MODE: 'enforce', ...env });
  const join = async (id, extra = {}) => {
    const ws = r.connect();
    await quiet(() => r.hello(ws, id, P0, { lv: 7, charLevel: 12, ...extra }));
    let n = 0;
    const ask = async (body) => { now += 1500; await r.raw(ws, JSON.stringify({ t: 'grant', id: ++n, ...body })); if (body.k === 'free' || body.k === 'tally') return null; const a = ws.sent.filter((m) => m.t === 'grant').at(-1); assert.equal(a.id, n, 'answered'); return a; };   // a free and a tally say nothing
    return { ws, ask, foes: () => ws.sent.filter((m) => m.t === 'foes') };
  };
  return { r, join, tick: (ms) => { now += ms; }, get now() { return now; } };
}
const said = (a) => (a.k === 'ok' ? 'ok' : a.r);

test('AUDIT TESA III E2-1 the law: a gate kept is its counter, its buckets that still bind, its live grants and its askers; an idle bucket and an expired grant are not kept, a gate nothing binds is none, a stored shape of another version or a malformed row is passed over (mutants: an idle bucket kept; an expired grant kept; the version unread; a grant\'s members dropped)', () => {
  const now = T0;
  const gr = { g: 7, o: 'sock-a', q: CELL, a: 'acct-a', k: 'camp', p: [402, 151], m: 1, l: 12, r: 7, n: 3, s: 9, e: 0, c: [-1, -1, -1], h: -1, x: now + GRANT_TTL_MS };
  const G = {
    n: 41,
    buckets: new Map([['acct-a|giant', { tokens: 0, at: now }], ['acct-b|enc', { tokens: GRANT_KINDS.enc.cap, at: now }]]),
    live: new Map([[7, { n: 3, x: gr.x, gr, handed: new Set([1]) }], [5, { n: 2, x: now - 1, gr: { ...gr, g: 5 } }]]),
    askers: new Set(['sock-a']),
  };
  const kept = grantGateKept(G, now);
  assert.deepEqual(kept, { v: GRANT_GATE_V, n: 41, b: [['acct-a|giant', 0, now]], l: [[7, 3, gr.x, gr, [1]]], a: ['sock-a'] }, 'the bucket that binds, the grant that lives');
  const back = grantGateOf(structuredClone(kept), now);
  assert.deepEqual([back.n, [...back.buckets], back.liveN, [...back.live.keys()], [...back.live.get(7).handed], [...back.askers]], [41, [['acct-a|giant', { tokens: 0, at: now }]], 3, [7], [1], ['sock-a']]);
  assert.equal(grantGateOf(structuredClone(kept), gr.x)?.liveN, 0, 'a grant past its expiry is not read back');
  assert.equal(grantGateKept({ n: 1, buckets: new Map([['acct-b|enc', { tokens: GRANT_KINDS.enc.cap, at: now }]]), live: new Map() }, now), null, 'nothing binds: no gate kept');
  for (const bad of [undefined, null, 'x', { ...kept, v: GRANT_GATE_V + 1 }, { ...kept, n: 1.5 }, { ...kept, b: 'no' }]) assert.equal(grantGateOf(bad, now), null);
  assert.deepEqual([...grantGateOf({ ...kept, l: [[8, -1, gr.x, gr], [9, 2, gr.x, null], 'junk', [7, 3, gr.x, gr, []]] }, now).live.keys()], [7], 'a malformed row passed over');
  assert.equal(GRANT_GATE_KEY, 'grantgate');
});

test('AUDIT TESA III E2-1 the relay: an account\'s bucket and the cell\'s ceiling outlive a hibernation - a Greater Giant\'s third call is refused before the cell sleeps and after it wakes, the live members counted across the wake, the ceiling refusing after it as before - and no timer is armed to do it (mutants: the gate never kept; the kept gate never read; the buckets not laid back; the live grants not laid back; the timer back)', async (t) => {
  const armed = longTimers(t);
  const C = await cell(t);
  const mac = await C.join('sock-mac-01');
  assert.deepEqual([await mac.ask({ k: 'mint', kind: 'giant', n: 1 }), await mac.ask({ k: 'mint', kind: 'giant', n: 1 }), await mac.ask({ k: 'mint', kind: 'giant', n: 1 })].map(said), ['ok', 'ok', 'bucket']);
  for (let i = 0; i < 12; i++) await mac.ask({ k: 'mint', kind: 'loose', n: 12 });   // the loose bucket's twelve, 146 members live
  const before = C.r.room._grants.liveN;
  assert.ok(before >= 140 && before < GRANT_CELL_CEILING, `members live before the sleep: ${before}`);
  assert.deepEqual(armed, [], 'nothing pending: the cell may hibernate (GRANT-SLEEP)');
  C.tick(15_000);
  C.r.wake();   // the hibernation: a fresh object over the same storage and sockets
  assert.equal(said(await mac.ask({ k: 'mint', kind: 'giant', n: 1 })), 'bucket', 'the giant\'s bucket is the account\'s still');
  assert.equal(C.r.room._grants.liveN, before, 'the ceiling counts what stood before the sleep');
  const zed = await C.join('sock-zed-01');
  const over = [];
  for (let i = 0; i < 6; i++) over.push(said(await zed.ask({ k: 'mint', kind: 'loose', n: 12 })));
  assert.equal(over.filter((x) => x === 'ok').length, Math.floor((GRANT_CELL_CEILING - before) / 12), 'a fresh account fills only what the ceiling has left');
  assert.ok(over.includes('ceiling'), over.join());
  assert.deepEqual(armed, [], 'and still no timer');
});

test('AUDIT TESA III E2-1 a renewal and the strip across a wake: the owner\'s grant is the cell\'s own after it wakes - renewed as its own, and with `grantStrip` on its record passes from the second frame (the first kicks the read) (mutants: the strip never reads the kept gate)', async (t) => {
  const C = await cell(t, { GRANT_STRIP: 'on' });
  const mac = await C.join('sock-mac-01', { gv: 1 }), zed = await C.join('sock-zed-01', { gv: 1 });
  const ok = await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  const gr = validGrantOut(ok)?.gr ?? ok.gr;
  assert.equal(ok.k, 'ok');
  const frame = (n) => JSON.stringify({ t: 'foes', data: { n, k: CELL, full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3], gr: [gr.g, 0] }] } });
  await quiet(() => C.r.raw(mac.ws, frame(1)));
  assert.deepEqual(zed.foes().at(-1)?.data?.f.map((r) => r.i), [1], 'granted: it passes');
  C.tick(15_000);
  C.r.wake();
  await quiet(() => C.r.raw(mac.ws, frame(2)));
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  await quiet(() => C.r.raw(mac.ws, frame(3)));
  assert.deepEqual(zed.foes().at(-1)?.data?.f.map((r) => r.i), [1], 'after the wake, the kept grant stands it');
  const renewed = await mac.ask({ k: 'renew', grs: [gr] });
  assert.equal(renewed.grs.length, 1, 'renewed as the cell\'s own');
  assert.ok(renewed.grs[0].x > gr.x);
});

test('AUDIT TESA III E2-1 the storage it costs: one key, kept while anything binds and let go once nothing does - at the next ask, and at a woken cell\'s read of a key gone stale (mutants: the key never let go; the stale key kept at the read)', async (t) => {
  const C = await cell(t);
  const mac = await C.join('sock-mac-01');
  const ok = await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  assert.equal(ok.k, 'ok');
  assert.ok(C.r.store.has(GRANT_GATE_KEY), 'kept');
  C.tick(GRANT_TTL_MS + 7 * 60_000);   // the grant expired, the bucket full again
  await mac.ask({ k: 'free', gs: [ok.gr.g] });
  assert.equal(C.r.store.has(GRANT_GATE_KEY), false, 'nothing binds: let go');
  await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  assert.ok(C.r.store.has(GRANT_GATE_KEY));
  C.tick(GRANT_TTL_MS + 7 * 60_000);
  C.r.wake();
  await mac.ask({ k: 'tally', rows: [{ o: 'sock-zed-09', r: 'marks', n: 1 }] });
  assert.equal(C.r.store.has(GRANT_GATE_KEY), false, 'a woken cell lets a stale gate go at its read');
});
