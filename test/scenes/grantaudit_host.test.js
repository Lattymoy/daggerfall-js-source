// AUDIT GRANT (2026-10-18, Mac: "Audit this real quick", then "Yes fix them"; bible/11-Multiplayer/Spawn-Grants.md
// section 17): THE CLIENT'S HALF OF THE AUDIT'S FIXES - the session hears a world room's answers and the law each says
// (A1, A10); the grants' host (scenes/grantHost.js) asks nothing of a socket that is not open (A9), keeps the relay's
// clock (A6), carries the grants longest unsaid first (A2), sweeps each pool's watchmen alone (A3), asks a refused
// watchman again (A12), carries again a crossing never answered (A13), and falls back to an encounter for an `encr`
// heir (A14).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession } from '../../src/net/online.js';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { createGrantHost, GRANT_HEIR_WAIT_MS, GRANT_WATCH_REASK_MS, GRANT_CARRY_TRIES } from '../../src/scenes/grantHost.js';
import { signGrant, GRANT_TTL_MS, GRANT_SKEW_MS, GRANT_FRAME_GRANTS_MAX } from '../../src/net/grantLaw.js';

const { subtle } = globalThis.crypto;
const quiet = (fn) => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const CELL = 'world:3,12', NEXT = 'world:4,12';

/** A session the host reads: its answers kept for the test to give (`answer`), or said at once (`auto`). */
function session({ mode = 'measure', room = CELL, status = 'open', clockOffsetMs = 0 } = {}) {
  const s = { room, status, grantMode: mode, clockOffsetMs, asks: [], host: null, auto: null, sendGrant(a) { if (s.status !== 'open' || !s.grantMode || s.grantMode === 'off') return false; s.asks.push(a); if (s.auto) void Promise.resolve().then(() => { const out = s.auto(a); if (out) s.host.answer({ id: a.id, ...out }); }); return true; } };
  return s;
}
const host = (s, opts = {}) => { const h = createGrantHost({ session: () => s, climateAt: () => 231, fetchKey: async () => null, wait: 50, ...opts }); s.host = h; return h; };
const gr = (over = {}) => ({ g: 7, o: 'aaa-0001', q: CELL, a: 'acct-a', k: 'enc', p: [3, 12], m: 9, l: 9, r: 7, n: 1, s: 5, e: 0, c: [-1], h: -1, x: Date.now() + GRANT_TTL_MS, sg: 'A'.repeat(86), ...over });

test('AUDIT GRANT A1/A10 THE SESSION HEARS A WORLD ROOM\'S ANSWERS, AND THE LAW EACH SAYS: a building\'s and a dungeon\'s own lane is answered as a cell is; a mint\'s answer that says another law than the welcome\'s is the law from then (mutants: the answers a cell\'s alone; the answer\'s law unread)', () => {
  for (const room of ['dungeon:m123456', cellRoomOfWire(402 * PIXEL_UNITS + 100, (499 - 151) * PIXEL_UNITS + 100)]) {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
    const heard = [];
    s.onGrant = (g) => heard.push(g);
    quiet(() => s.join(room, { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0 }));
    sockets[0].open();
    quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: 'world218', gm: 'measure' }));
    sockets[0].receive({ t: 'grant', k: 'no', id: 3, r: 'bucket', gm: 'enforce' });
    assert.deepEqual([heard.map((g) => g.k), s.grantMode], [['no'], 'enforce'], room);
  }
});

test('AUDIT GRANT A9/A6 A SOCKET NOT OPEN IS NO LAW, AND THE CLOCK IS THE RELAY\'S: a closed socket\'s last `enforce` refuses nothing and asks nothing; a grant\'s expiry is read on the relay\'s clock, so a machine an hour fast keeps a fresh grant (mutants: the socket\'s status unread; the machine\'s own clock)', async () => {
  const s = session({ mode: 'enforce', status: 'closed' });
  const h = host(s);
  assert.equal(h.enforcing(), false);
  assert.equal(h.memberFor('enc'), null, 'nothing asked of a closed socket');
  const behind = session({ clockOffsetMs: -3600_000 });
  const hb = createGrantHost({ session: () => behind, climateAt: () => 231, fetchKey: async () => null });   // the default clock
  const g = gr({ x: Date.now() - 3600_000 + GRANT_TTL_MS });
  hb.stood(g, 0, {});
  hb.tick();
  assert.ok(hb.live().includes(g) && !g._dead, 'fresh on the relay\'s clock');
  assert.ok(Date.now() > g.x + GRANT_SKEW_MS, 'and stale on this machine\'s - the case the clock is for');
});

test('AUDIT GRANT A2 THE FRAME CARRIES THE GRANTS LONGEST UNSAID FIRST: past GRANT_FRAME_GRANTS_MAX, each full frame takes the ones the last ones left, so a late reader hears every grant within two full frames; a grant signed again rides the next frame first (mutant: the same first ones every full frame)', () => {
  const h = host(session());
  const gs = Array.from({ length: GRANT_FRAME_GRANTS_MAX + 20 }, (_, i) => gr({ g: 100 + i, sg: String(i).padStart(86, 'A') }));
  const first = h.frameGrants(gs, true).map((g) => g.g), second = h.frameGrants(gs, true).map((g) => g.g);
  assert.equal(first.length, GRANT_FRAME_GRANTS_MAX);
  assert.equal(new Set([...first, ...second]).size, gs.length, 'two full frames: every grant');
  const third = h.frameGrants(gs, true).map((g) => g.g), fourth = h.frameGrants(gs, true).map((g) => g.g);
  assert.equal(new Set([...third, ...fourth]).size, gs.length, 'and every two after, for a reader that came in late');
  assert.deepEqual(h.frameGrants(gs, false), [], 'a delta: nothing signed anew');
  gs[5].sg = 'B'.repeat(86);
  assert.deepEqual(h.frameGrants(gs, false).map((g) => g.g), [105], 'signed again: said again');
});

test('AUDIT GRANT A3/A12 THE WATCH: each pool sweeps its own watchmen - a building\'s empty list ends none of the street\'s; a watchman refused is asked again at the watch\'s pace (mutants: one pool sweeping the other\'s; a refused watchman never asked again)', async () => {
  const s = session();
  let refuse = false;
  s.auto = (a) => (a.k === 'mint' ? (refuse ? { k: 'no', r: 'bucket' } : { k: 'ok', gr: gr({ g: 9, k: 'watch', n: a.n, c: Array(a.n).fill(-1) }) }) : null);
  let t = Date.now();
  const h = host(s, { now: () => t });
  const street = {}, building = {}, g = { mobileType: 146 };
  assert.equal(h.watchReady(g, street), false);
  await settle();
  assert.equal(h.watchReady(g, street), true);
  h.watchSweep([], building);
  assert.ok(g._grant, 'the building\'s sweep ends none of the street\'s');
  h.watchSweep([], street);
  assert.equal(g._grant, null, 'the street\'s own ends him');
  refuse = true;
  const r = { mobileType: 146 };
  h.watchReady(r, street);
  await settle();
  const asked = s.asks.filter((a) => a.kind === 'watch').length;
  h.watchReady(r, street);
  assert.equal(s.asks.filter((a) => a.kind === 'watch').length, asked, 'not again at once');
  refuse = false;
  t += GRANT_WATCH_REASK_MS;
  h.watchReady(r, street);
  await settle();
  assert.equal(s.asks.filter((a) => a.kind === 'watch').length, asked + 1, 'asked again at the watch\'s pace');
  assert.ok(r._grant, 'and stands on it');
});

test('AUDIT GRANT A11 A RECORD JUDGED ONCE IS TALLIED ONCE: the same record on the same grant answers its refusal again without counting it again; a grant heard since it was unheard is judged anew (mutants: a second tally; the memo kept past the grant heard)', async () => {
  const R = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const h = createGrantHost({ session: () => null, climateAt: () => 231, fetchKey: async () => R.publicKey, verdictWait: 30 });
  const g0 = gr({ g: 21, o: 'zzz-0009', n: 2, e: 0, c: [-1, -1] });
  const signed = { ...g0, sg: await signGrant({ ...g0, sg: undefined }, R.privateKey, { subtle }) };
  assert.equal(await h.check('zzz-0009', CELL, { i: 3, t: 0, gr: [21, 0] }), 'ungranted', 'not heard yet');   // PIN MOVED (GRANT-UNHEARD): unheard, never `unsigned`
  h.heard('zzz-0009', [signed]);
  assert.equal(await h.check('zzz-0009', CELL, { i: 3, t: 0, gr: [21, 0] }), null, 'heard since: judged anew, and honest');
  const forged = { i: 4, t: 0, z: 1, gr: [21, 1] };
  assert.equal(await h.check('zzz-0009', CELL, forged), 'marks');
  assert.equal(await h.check('zzz-0009', CELL, forged), 'marks');
  assert.equal(h.tallied().get('zzz-0009|marks'), 1, 'counted once');
});

test('AUDIT GRANT A13/A14 A CROSSING NEVER ANSWERED IS CARRIED AGAIN, AND AN `encr` HEIR FALLS BACK TO AN ENCOUNTER: a carry with no answer keeps its grants and asks again, GRANT_CARRY_TRIES times; an adopted `encr` foe whose grant never comes asks an encounter\'s (mutants: an unanswered carry giving its grants up; `encr` asked)', async () => {
  const s = session();
  const h = host(s);
  const g = gr({ x: Date.now() + GRANT_TTL_MS });
  h.stood(g, 0, {});
  h.tick();
  s.room = NEXT;
  for (let i = 0; i < GRANT_CARRY_TRIES; i++) { h.tick(); await new Promise((r) => setTimeout(r, 80)); }
  assert.equal(s.asks.filter((a) => a.k === 'carry').length, GRANT_CARRY_TRIES, 'asked again while unanswered');
  assert.ok(g._dead, 'given up at the last try');
  // the heir's fallback
  const R = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let t = Date.now();
  const s2 = session();
  const h2 = createGrantHost({ session: () => s2, climateAt: () => 231, now: () => t, fetchKey: async () => R.publicKey, wait: 50 });
  s2.host = h2;
  const encr = gr({ g: 11, k: 'encr', n: 2, c: [-1, -1], o: 'zzz-0009', x: t + GRANT_TTL_MS });
  const signed = { ...encr, sg: await signGrant({ ...encr, sg: undefined }, R.privateKey, { subtle }) };
  h2.heard('zzz-0009', [signed]);
  await h2.check('zzz-0009', CELL, { i: 4, t: 0, gr: [11, 1] });
  const foe = { seq: 4, dead: false, puppet: null };
  h2.adopted('zzz-0009', foe);
  t += GRANT_HEIR_WAIT_MS;
  h2.tick();
  await settle();
  assert.deepEqual(s2.asks.filter((a) => a.k === 'mint').map((a) => a.kind), ['enc']);
});
