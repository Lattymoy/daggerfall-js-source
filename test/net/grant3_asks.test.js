// GRANT3 (2026-10-18, Mac: "Do all slices"; bible/11-Multiplayer/Spawn-Grants.md sections 4.3, 4.8 and 13): THE ASKS
// PAST THE MINT - a renewal, a free, a carry into another cell, a member handed on, a reader's tally - their law (net/
// grantLaw.js) and the relay's answer over real Rooms (test/fakeRoom.mjs): each grant signed again only for its own
// socket, a carry only of this relay's own signature, an heir only to a socket in the cell, a tally folded into the
// measure under both accounts and read back by the service's own half.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { validGrantAsk, validGrantOut, validGrant, verifyGrant, grantRenewed, grantCarried, grantHanded, grantSignedHere, signGrant, grantRefusal,
  GRANT_TTL_MS, GRANT_RENEW_MAX, GRANT_TALLY_ROWS_MAX, GRANT_TALLY_MS, GRANT_READER_REFUSALS } from '../../src/net/grantLaw.js';
import { openGrantMeasure, GRANT_MEASURE_SIG_HEADER, newGrantMeasure, foldGrantTally, grantMeasureBatch, grantMeasureValid } from '../../src/net/grantMeasure.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151), P1 = at(418, 151);
const K0 = cellRoomOfWire(P0.x, P0.z), K1 = cellRoomOfWire(P1.x, P1.z);

async function world(t) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pk = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const posts = [];
  const cell = (key) => {
    const r = fakeRoom(key, { now: () => now });
    r.env.GATE_SIGNING_KEY = pk;
    r.env.GRANT_FEED_URL = 'https://accounts.example/v1/mod/grant-feed';
    r.env.ACCOUNTS = { fetch: async (req) => { posts.push({ sig: req.headers.get(GRANT_MEASURE_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: 202 }); } };
    t.after(() => r.room._grantFlush());
    return r;
  };
  const join = async (r, id, pose) => {
    const ws = r.connect();
    await r.hello(ws, id, pose, { lv: 7, charLevel: 12 });
    let n = 0;
    return { ws, ask: (body) => r.raw(ws, JSON.stringify({ t: 'grant', id: ++n, ...body })), last: () => ws.sent.filter((m) => m.t === 'grant').at(-1) };
  };
  return { kp, privateKey: await importReceiptKey(pk, { subtle }), cell, join, posts, tick: (ms) => { now += ms; }, get now() { return now; } };
}

test('GRANT3 THE ASKS\' LAW: a renewal and a carry only signed grants (AUDIT GRANT A8: a renewal whole), a free my grants\' numbers, a handover\'s heirs each a member its grant stands (AUDIT GRANT A7: a turn\'s frees and heirs one ask each), a tally a reader\'s reasons; an answer to a mint says the law in force (AUDIT GRANT A10); the answers read whole; a grant renewed, carried or handed on is the same foe - its seed and marks - under a new expiry, cell or owner; the relay checks its own signature by signing again (mutants: an heir past a handed grant\'s member; a carried grant\'s cell unchanged; the expiry not moved)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const G = { g: 41, o: 'sock-mac-01', q: K0, a: 'acct-mac', k: 'enc', p: [402, 151], m: 9, l: 12, r: 7, n: 3, s: 77, e: 0b010, c: [3, -1, -1], h: -1, x: 5_000 };
  const sg = await signGrant(G, kp.privateKey, { subtle });
  const S = { ...G, sg };
  assert.deepEqual(validGrantAsk({ k: 'free', id: 1, gs: [41, 42] }), { k: 'free', id: 1, gs: [41, 42] });
  assert.equal(validGrantAsk({ k: 'renew', id: 1, grs: [S] }).grs[0].sg, sg);
  const hand = (gr, i, to = 'sock-ann-01') => ({ gr, i, to });
  for (const bad of [{ k: 'free', id: 1, gs: [] }, { k: 'free', id: 1, gs: [41, 41] }, { k: 'free', id: 1, gs: Array.from({ length: GRANT_RENEW_MAX + 1 }, (_, i) => i) },
    { k: 'free', id: 1, g: 41 }, { k: 'renew', id: 1, gs: [41] }, { k: 'renew', id: 1, grs: [G] }, { k: 'renew', id: 1, grs: Array(GRANT_RENEW_MAX + 1).fill(S) },
    { k: 'carry', id: 1, grs: [G] }, { k: 'heir', id: 1, hs: [hand(S, 3)] }, { k: 'heir', id: 1, hs: [hand({ ...S, h: 1 }, 0)] }, { k: 'heir', id: 1, hs: [] },
    { k: 'heir', id: 1, hs: [hand(S, 0, 'a b')] }, { k: 'heir', id: 1, hs: [hand(S, 0), hand(S, 3)] }, { k: 'heir', id: 1, gr: S, i: 0, to: 'sock-ann-01' },
    { k: 'tally', id: 1, rows: [{ o: 'sock-ann-01', r: 'bucket', n: 1 }] }, { k: 'tally', id: 1, rows: [] },
    { k: 'tally', id: 1, rows: Array.from({ length: GRANT_TALLY_ROWS_MAX + 1 }, () => ({ o: 'sock-ann-01', r: 'marks', n: 1 })) }, { k: 'gift', id: 1 }]) assert.equal(validGrantAsk(bad), null, JSON.stringify(bad).slice(0, 80));
  assert.equal(validGrantAsk({ k: 'carry', id: 1, grs: [S] }).grs[0].sg, sg);
  assert.deepEqual(validGrantAsk({ k: 'heir', id: 2, hs: [hand({ ...S, h: 1 }, 1), hand(S, 2, 'sock-zed-01')] })?.hs.map((x) => [x.i, x.to]), [[1, 'sock-ann-01'], [2, 'sock-zed-01']], 'a handed grant handed on again, its own member; two heirs in one ask');
  assert.deepEqual(validGrantAsk({ k: 'tally', id: 3, rows: [{ o: 'sock-ann-01', r: 'marks', n: 2, x: 1 }] }), { k: 'tally', id: 3, rows: [{ o: 'sock-ann-01', r: 'marks', n: 2 }] });
  assert.deepEqual(GRANT_READER_REFUSALS, ['unsigned', 'sender', 'cell', 'expired', 'member', 'marks', 'dice', 'twice', 'ungranted', 'stats']);   // PIN MOVED (FOE-BOUNDS, Spawn-Grants section 19): `stats`, a record whose health no builder could give it
  assert.deepEqual(validGrantOut({ k: 'carry', id: 4, grs: [S, null] }).grs.map((g) => g && g.g), [41, null]);
  assert.equal(validGrantOut({ k: 'renew', id: 4, grs: [{ g: 1 }] }), null);
  assert.equal(validGrantOut({ k: 'heir', id: 4, gr: S }).gr.g, 41);
  assert.deepEqual([validGrantOut({ k: 'ok', id: 4, gr: S, gm: 'enforce' }).gm, validGrantOut({ k: 'no', id: 4, r: 'bucket', gm: 'enforce' }).gm, validGrantOut({ k: 'ok', id: 4, gr: S, gm: 'loud' }).gm], ['enforce', 'enforce', undefined], 'the law in force, in the law\'s words alone');
  const r = grantRenewed(S, 9_000);
  assert.deepEqual([r.x, r.sg, r.s, r.e, r.c, r.g, r.q, r.o], [9_000 + GRANT_TTL_MS, undefined, 77, 0b010, [3, -1, -1], 41, K0, 'sock-mac-01']);
  const c = grantCarried(S, K1, 7, 9_000);
  assert.deepEqual([c.g, c.q, c.o, c.s, c.h], [7, K1, 'sock-mac-01', 77, -1]);
  const h = grantHanded(S, 1, 'sock-ann-01', 8, 9_000);
  assert.deepEqual([h.g, h.o, h.h, h.s, h.n, h.e], [8, 'sock-ann-01', 1, 77, 3, 0b010]);
  assert.ok(validGrant(h) && validGrant(c) && validGrant(r));
  assert.equal(grantRefusal(h, { from: 'sock-ann-01', cell: K0, nowMs: 9_000, i: 0 }), 'member', 'the heir stands its one member');
  assert.equal(await grantSignedHere(S, kp.privateKey, { subtle }), true, 'Ed25519 is deterministic: the relay signs again and compares');
  assert.equal(await grantSignedHere({ ...S, s: 78 }, kp.privateKey, { subtle }), false);
  assert.equal(await grantSignedHere(G, kp.privateKey, { subtle }), false, 'unsigned');
  assert.equal(await grantSignedHere(S, null, { subtle }), false, 'no key');
  // the window's tallies
  const w = newGrantMeasure(1000);
  foldGrantTally(w, 'acct-ann', 'acct-mac', 'marks', 2);
  foldGrantTally(w, 'acct-ann', 'acct-mac', 'marks', 3);
  const b = grantMeasureBatch(w, 'a'.repeat(16), K0, 2000);
  assert.deepEqual([b.rows, b.tl], [[], [{ a: 'acct-ann', b: 'acct-mac', r: 'marks', n: 5 }]]);
  assert.ok(grantMeasureValid(b), 'a window of tallies alone');
  assert.equal(grantMeasureValid({ ...b, tl: [{ a: 'acct-ann', b: 'acct-ann', r: 'marks', n: 1 }] }), false, 'a reader never tallies itself');
  assert.equal(grantMeasureValid({ ...b, tl: [{ a: 'acct-ann', b: 'acct-mac', r: 'bucket', n: 1 }] }), false, 'a reader\'s reasons alone');
});

test('GRANT3 THE RELAY\'S ASKS: a renewal signs my live grants again with a new expiry and passes over another\'s (AUDIT GRANT A8: and one this cell forgot, when it is mine and this relay\'s own); a free takes my grants off the cell\'s count, never another\'s; a carry into the next cell is signed again there under its number for my socket and account, and refused when another relay signed it, when it is another socket\'s, or from this cell; an heir only to a socket in the cell, said to the heir, once a member across its renewals and never from a grant freed (AUDIT GRANT A15), standing its one member, counting nothing more (mutants: a member handed on twice; a renewal of another\'s grant; a free of another\'s; a carry of a forged grant; a forgotten grant not signed again; another\'s forgotten grant adopted; handed members forgotten at a renewal; a freed grant handed on)', async (t) => {
  const W = await world(t);
  const c0 = W.cell(K0), c1 = W.cell(K1);
  const mac = await W.join(c0, 'sock-mac-01', P0), ann = await W.join(c0, 'sock-ann-01', P0);
  await mac.ask({ k: 'mint', kind: 'enc', n: 3 });
  const g1 = mac.last().gr;
  await ann.ask({ k: 'mint', kind: 'camp', n: 4 });
  const g2 = ann.last().gr;
  assert.equal(c0.room._grants.liveN, 7);
  W.tick(60_000);
  await mac.ask({ k: 'renew', grs: [g1, g2] });
  const ren = validGrantOut(mac.last());
  assert.deepEqual(ren.grs.map((g) => [g.g, g.x]), [[g1.g, W.now + GRANT_TTL_MS]], 'mine alone, its expiry moved');
  assert.equal(await verifyGrant(ren.grs[0], W.kp.publicKey, { subtle }), true);
  assert.equal(ren.grs[0].s, g1.s, 'the same foes');
  // AUDIT GRANT A8: a cell that forgot them (a deploy, an eviction) signs mine again and counts them; another's it leaves
  c0.room._grants.live.clear(); c0.room._grants.liveN = 0;
  await mac.ask({ k: 'renew', grs: [ren.grs[0], g2] });
  assert.deepEqual(validGrantOut(mac.last()).grs.map((g) => g.g), [g1.g], 'mine signed again; another\'s never adopted');
  assert.equal(c0.room._grants.liveN, 3, 'counted live again');
  await ann.ask({ k: 'renew', grs: [g2] });
  assert.equal(c0.room._grants.liveN, 7);
  await mac.ask({ k: 'free', gs: [g2.g] });
  assert.equal(c0.room._grants.liveN, 7, 'another\'s grant is never mine to free');
  await mac.ask({ k: 'free', gs: [g1.g, g2.g] });
  assert.equal(c0.room._grants.liveN, 4);
  // a carry: a fresh grant of mine, taken east into the next cell
  await mac.ask({ k: 'mint', kind: 'enc', n: 2 });
  const g3 = mac.last().gr;
  const mac1 = await W.join(c1, 'sock-mac-01', P1);
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const forged = { ...g3, g: g3.g + 1, sg: await signGrant({ ...g3, g: g3.g + 1, sg: undefined }, other.privateKey, { subtle }) };
  delete forged.sg; forged.sg = await signGrant({ ...g3, g: g3.g + 1 }, other.privateKey, { subtle });
  await mac1.ask({ k: 'carry', grs: [g3, forged, g2, { ...g3, sg: g3.sg }] });
  const car = validGrantOut(mac1.last());
  assert.equal(car.grs.length, 4);
  assert.deepEqual([car.grs[0].q, car.grs[0].o, car.grs[0].a, car.grs[0].s, car.grs[0].n], [K1, 'sock-mac-01', 'acct-sock-mac-01', g3.s, 2], 'mine, signed again for the cell I stand in');
  assert.equal(await verifyGrant(car.grs[0], W.kp.publicKey, { subtle }), true);
  assert.equal(car.grs[1], null, 'another key\'s');
  assert.equal(car.grs[2], null, 'another socket\'s');
  assert.equal(c1.room._grants.liveN, 4, 'its members count here now (twice: the same grant carried twice is two asks of the cell\'s count)');
  await mac.ask({ k: 'carry', grs: [g3] });
  assert.equal(validGrantOut(mac.last()).grs[0], null, 'not from this very cell');
  // an heir
  await mac.ask({ k: 'heir', hs: [{ gr: g3, i: 1, to: 'sock-zed-01' }] });
  assert.deepEqual(mac.last(), { t: 'grant', k: 'no', id: mac.last().id, r: 'sender' }, 'nobody of that id here');
  const before = c0.room._grants.liveN, toMac = mac.ws.sent.length;
  await mac.ask({ k: 'heir', hs: [{ gr: g3, i: 1, to: 'sock-ann-01' }] });
  const heir = validGrantOut(ann.last());
  assert.equal(mac.ws.sent.length, toMac, 'said to the heir, never back to its owner');
  assert.deepEqual([heir.k, heir.gr.o, heir.gr.h, heir.gr.s, heir.gr.e, heir.gr.c], ['heir', 'sock-ann-01', 1, g3.s, g3.e, g3.c]);
  assert.equal(await verifyGrant(heir.gr, W.kp.publicKey, { subtle }), true);
  assert.equal(c0.room._grants.liveN, before, 'counted once, under its first grant');
  const toAnn = ann.ws.sent.length;
  W.tick(10_000);   // the socket's grant bucket refilled
  await mac.ask({ k: 'renew', grs: [g3] });   // AUDIT GRANT A15: a renewal forgets no member handed on
  const g3r = validGrantOut(mac.last()).grs[0];
  await mac.ask({ k: 'heir', hs: [{ gr: g3r, i: 1, to: 'sock-ann-01' }] });
  assert.deepEqual([mac.ws.sent.length, mac.last().r, ann.ws.sent.length], [toMac + 2, 'sender', toAnn], 'a member is handed on once, its grant renewed or not');
  await ann.ask({ k: 'heir', hs: [{ gr: g3r, i: 0, to: 'sock-ann-01' }] });
  assert.equal(ann.last().r, 'sender', 'only its owner hands it on');
  const toAnn2 = ann.ws.sent.length;
  await mac.ask({ k: 'free', gs: [g3r.g] });
  await mac.ask({ k: 'heir', hs: [{ gr: g3r, i: 0, to: 'sock-ann-01' }] });
  assert.deepEqual([mac.last().r, ann.ws.sent.length], ['sender', toAnn2], 'a grant freed hands nothing on');
});

test('GRANT3 A READER\'S TALLY: folded into the cell\'s window under the reader\'s account and the sender\'s, a sender this cell holds; one tally a reader a window; posted signed and read back by the service\'s half (mutants: the tally under the sender\'s socket id; a second tally inside the window kept)', async (t) => {
  const W = await world(t);
  const c0 = W.cell(K0);
  const mac = await W.join(c0, 'sock-mac-01', P0), ann = await W.join(c0, 'sock-ann-01', P0);
  void mac;
  await ann.ask({ k: 'tally', rows: [{ o: 'sock-mac-01', r: 'marks', n: 4 }, { o: 'sock-gone-01', r: 'dice', n: 2 }, { o: 'sock-ann-01', r: 'dice', n: 1 }] });
  await ann.ask({ k: 'tally', rows: [{ o: 'sock-mac-01', r: 'marks', n: 40 }] });
  assert.deepEqual([...c0.room._grants.w.tallies.values()], [{ a: 'acct-sock-ann-01', b: 'acct-sock-mac-01', r: 'marks', n: 4 }], 'a sender here alone, never the reader itself; one tally a window');
  W.tick(GRANT_TALLY_MS);
  await ann.ask({ k: 'tally', rows: [{ o: 'sock-mac-01', r: 'unsigned', n: 1 }] });
  // HIBERNATE: no timer posts the window - the first fold after it has waited GRANT_MEASURE_MS does, its own row in it
  assert.equal(c0.room._grants.w.tallies.size, 0, 'posted on the next fold, that fold\'s tally in it');
  for (let i = 0; i < 50 && !W.posts.length; i++) await new Promise((r) => setTimeout(r, 5));
  const opened = await openGrantMeasure(W.posts.at(-1).body, W.posts.at(-1).sig, W.kp.publicKey, { subtle, nowMs: W.now });
  assert.ok(opened.ok);
  assert.deepEqual(opened.batch.tl, [{ a: 'acct-sock-ann-01', b: 'acct-sock-mac-01', r: 'marks', n: 4 }, { a: 'acct-sock-ann-01', b: 'acct-sock-mac-01', r: 'unsigned', n: 1 }]);
  assert.deepEqual(opened.batch.rows, []);
});
