// AUDIT GRANT (2026-10-18, Mac: "Audit this real quick", then "Yes fix them"; bible/11-Multiplayer/Spawn-Grants.md
// section 17): THE RELAY'S HALF OF THE AUDIT'S FIXES, over real Rooms (test/fakeRoom.mjs) - a mint's answer says the law
// in force (A10); a reader's tally posts the window at its whole bound and begins the next, never past it (A4); a
// window begins at its first fold, not at the last post (A5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { validGrantOut } from '../../src/net/grantLaw.js';
import { foldGrantAsk, openGrantMeasure, GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_ROWS } from '../../src/net/grantMeasure.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const P0 = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
const K0 = cellRoomOfWire(P0.x, P0.z);

async function cell(t, env = {}) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const r = fakeRoom(K0, { now: () => now });
  const posts = [];
  Object.assign(r.env, {
    GATE_SIGNING_KEY: Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'),
    GRANT_FEED_URL: 'https://accounts.example/v1/mod/grant-feed',
    ACCOUNTS: { fetch: async (req) => { posts.push({ sig: req.headers.get(GRANT_MEASURE_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: 202 }); } },
    ...env,
  });
  t.after(() => r.room._grantFlush());
  const join = async (id) => {
    const ws = r.connect();
    await r.hello(ws, id, P0, { lv: 7, charLevel: 12 });
    let n = 0;
    return { ws, ask: (body) => r.raw(ws, JSON.stringify({ t: 'grant', id: ++n, ...body })), last: () => ws.sent.filter((m) => m.t === 'grant').at(-1) };
  };
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((res) => setTimeout(res, 0)); };
  return { r, kp, join, posts, settle, tick: (ms) => { now += ms; }, get now() { return now; } };
}

test('AUDIT GRANT A10 A MINT\'S ANSWER SAYS THE LAW IN FORCE: `ok` and `no` carry the mode the relay read at the ask - a cold cell\'s welcome may have said another, and the client takes the answer\'s (mutant: the mode left off the answer)', async (t) => {
  const W = await cell(t, { GRANT_MODE: 'enforce' });
  const mac = await W.join('sock-mac-01');
  await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  assert.deepEqual([mac.last().k, validGrantOut(mac.last())?.gm], ['ok', 'enforce']);
  for (let i = 0; i < 8; i++) await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  const no = mac.ws.sent.filter((m) => m.t === 'grant' && m.k === 'no').at(-1);
  assert.deepEqual([no?.r, validGrantOut(no)?.gm], ['bucket', 'enforce']);
});

test('AUDIT GRANT A4/A5 THE WINDOW: a reader\'s tally that fills it posts it at its whole bound and folds the rest into the next - never past GRANT_MEASURE_ROWS, which no batch is; and a window begins at its first fold, so an idle cell\'s hours are no asking time (mutants: the tally folded whole before the post; the window begun at the last post)', async (t) => {
  const W = await cell(t);
  const mac = await W.join('sock-mac-01'), zed = await W.join('sock-zed-01'), ann = await W.join('sock-ann-01');
  await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  const G = W.r.room._grants;
  for (let i = 0; G.w.rows.size + G.w.tallies.size < GRANT_MEASURE_ROWS - 1; i++) foldGrantAsk(G.w, `acct-${1000 + i}`, 'camp', 1, null, 1);
  await ann.ask({ k: 'tally', rows: [{ o: 'sock-mac-01', r: 'marks', n: 1 }, { o: 'sock-zed-01', r: 'twice', n: 2 }] });
  await W.settle();
  assert.equal(W.posts.length, 1, 'posted at its bound');
  const opened = await openGrantMeasure(W.posts[0].body, W.posts[0].sig, W.kp.publicKey, { subtle, nowMs: W.now });
  assert.ok(opened.ok, `a batch the service reads: ${opened.error ?? ''}`);
  assert.equal(opened.batch.rows.length + opened.batch.tl.length, GRANT_MEASURE_ROWS);
  assert.deepEqual([...G.w.tallies.values()].map((x) => x.r), ['twice'], 'the rest begin the next window');
  void zed;
  // A5: the next window begins at its first fold
  await W.r.room._grantFlush();
  W.tick(3 * 3600_000);
  await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  assert.equal(W.r.room._grants.w.from, W.now, 'three idle hours are no asking time');
});
