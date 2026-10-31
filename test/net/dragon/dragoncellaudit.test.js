// AUDIT DRAGON-CELL (2026-10-31, the owner: "Audit"; bible/01-Overview/audits/Audit-Dragon-Cell.md): THE AUDIT'S PINS for
// DRAGON-CELL. An omen's seed its own HMAC, a quiet omen told as a far one (D1); an `in` that reads no omen outside its
// socket's cover or far from its pose (D2); a socket told only once it has stood (D3); the client asking again outside a
// told omen's reach (D5) and a null again after a while, from the pixel it asked from (D6); a battle's pose judged and an
// unjudged room silent (D6); the countryside standing before a square is read, read in slices (D8, D9); two older
// records the re-run found alive on main too (D12).
// tools/mutants/dragoncellaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Law from '../../../src/net/dragon/dragonLaw.js';
import { dragonWatchKeyOf, dragonOmenSeeds } from '../../../src/net/dragon/dragonSeed.js';
import { gateHash } from '../../../src/net/gate/gateLaw.js';
import { cellRoomOfWire, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { siegeRoomKey } from '../../../src/net/siege/siegeRef.js';
import { createDragonHost, skyWatchAt, DRAGON_ASK_RETRY_MS, DRAGON_NONE_AGAIN_MS } from '../../../src/scenes/dragonHost.js';
import { createDragonLink } from '../../../src/net/dragon/dragonLink.js';
import { createTheatreGateScans } from '../../../src/scenes/gate/gateLanes.js';
import { DRAGON_TELL_DWELL_MS } from '../../../server/src/dragonFights.js';
import { COUNTRY_SOURCE } from '../../../src/world/tamrielCountry.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, watchOf, dragonOmenFrom, siteOf } from '../../dragonOmen.mjs';

const subtle = globalThis.crypto.subtle;
const OMEN = await dragonOmenFrom(500_000), W = OMEN.w, TT = Law.dragonTimes(OMEN);
const SITE = siteOf(OMEN), CELL = cellRoomOfWire(SITE.sx, SITE.sz);
const posed = (px, py) => { const c = Law.pixelCentreNative(px, py); return { x: c.sx, y: 0, z: c.sz, yaw: 0, pitch: 0 }; };
const words = (ws, k) => ws.sent.filter((m) => m.t === 'dragon' && (!k || m.k === k));
const omens = (ws) => words(ws, 'omen').map(({ w, s }) => [w, s]);

async function withRelay(fn, { start = TT.landAt - DRAGON_TELL_DWELL_MS - 1000 } = {}) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const room = (key) => { const r = world.room(key); r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8; return r; };
    const say = (r, ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o }));
    await fn({ room, say, set: (t) => { clock = t; }, now: () => clock });
  } finally { Date.now = realNow; }
}

// gateHash run back: every step of it undoes (an xor, an odd multiply, an xorshift)
const inv = (a) => { let x = a; for (let i = 0; i < 5; i++) x = Math.imul(x, 2 - Math.imul(a, x)); return x >>> 0; };
const IA = inv(0x01000193), IB = inv(0x2c1b3c6d);
const unmix = (h) => { h >>>= 0; h = (h ^ (h >>> 12) ^ (h >>> 24)) >>> 0; h = Math.imul(h, IB) >>> 0; h = (h ^ (h >>> 15) ^ (h >>> 30)) >>> 0; return Math.imul(h, IA) >>> 0; };
const unhash = (out, w, k) => ((unmix((unmix((unmix(out) ^ k) >>> 0) ^ w) >>> 0) ^ 0x811c9dc5) >>> 0);

test('AUDIT DRAGON-CELL D1 the seeds: each omen\'s its own HMAC under its own label - no told seed runs back to another (the gateHash roll ran back in four guesses) (mutants: one label for every omen; the omens rolled off one seed)', async () => {
  assert.equal(gateHash(unhash(gateHash(123456, W, 101), W, 101), W, 101), gateHash(123456, W, 101), 'the inverse is gateHash\'s');
  assert.equal(unhash(gateHash(123456, W, 101), W, 101), 123456, 'so a seed rolled off another gives it back');
  const key = await dragonWatchKeyOf(RELAY_KEY.pkcs8, { subtle });
  const seeds = await dragonOmenSeeds(key, W, 4, { subtle });
  const mac = new Uint8Array(await subtle.sign('HMAC', key, new TextEncoder().encode(`dragon-omen:${W}:2`)));
  assert.equal(seeds[2], ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0, 'dragon-omen:<watch>:<omen>');
  assert.equal(new Set(seeds).size, 4, 'four seeds');
  for (let w = W; w < W + 200; w++) {
    const o = await watchOf(w);
    for (const told of o.seeds) for (let k = 100; k < 104; k++) {
      const back = unhash(told, w, k);
      for (let j = 100; j < 104; j++) assert.ok(!o.seeds.includes(gateHash(back, w, j)) || gateHash(back, w, j) === told, `watch ${w}: no sibling run back`);
    }
  }
});

test('AUDIT DRAGON-CELL D1 a quiet omen is told as a far one is: null at a quiet watch\'s time - its seed ran back to its siblings, and says nothing a null does not (mutants: a quiet omen\'s seed told)', async () => {
  let quiet = W + 1, qc = null;
  while (!(qc = Law.dragonCandidates(await watchOf(quiet)).find((c) => !Law.isDragonOmen(c)))) quiet++;
  const Q = siteOf(qc);
  await withRelay(async ({ room, say, set, now }) => {
    const r = room(cellRoomOfWire(Q.sx, Q.sz)), a = r.connect();
    await r.hello(a, 'peer-0001', posed(Q.px, Q.py));
    set(now() + DRAGON_TELL_DWELL_MS + 1000);   // stood: only the omen's quiet keeps its seed
    await say(r, a, { k: 'ask', w: quiet });
    assert.deepEqual(omens(a), [[quiet, null]]);
  }, { start: Law.dragonQuietAt(quiet) + 1000 });
});

test('AUDIT DRAGON-CELL D2 an `in` reads no omen for a site its socket does not cover, nor from a pose far from it: the same answer whether a dragon stands there or none (mutants: the cover read after the omen; the pose\'s reach read after it)', async () => {
  const empty = Law.pixelCentreNative(SITE.px + 3 * Law.DRAGON_CELL_PX, SITE.py), AWAY = posed(SITE.px + 6 * Law.DRAGON_CELL_PX, SITE.py);
  await withRelay(async ({ room, say }) => {
    const aw = room(cellRoomOfWire(AWAY.x, AWAY.z)), a = aw.connect(), b = aw.connect();
    await aw.hello(a, 'peer-0001', AWAY); await aw.hello(b, 'peer-0002', AWAY);
    await say(aw, a, { k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: SITE.sx, sz: SITE.sz });
    await say(aw, b, { k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: empty.sx, sz: empty.sz });
    assert.deepEqual([words(a), words(b), a.meters.junk, b.meters.junk], [[], [], 1, 1], 'the dragon\'s cell and an empty one: junk alike');
    const r = room(CELL), c = r.connect(), d = r.connect();
    const twoKm = { ...posed(SITE.px, SITE.py), x: SITE.sx + 2000 * Law.DRAGON_NATIVE_PER_M };
    await r.hello(c, 'peer-0003', twoKm); await r.hello(d, 'peer-0004', twoKm);
    const none = Law.pixelCentreNative(SITE.px + 1, SITE.py);   // its cell, no dragon's site
    await say(r, c, { k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: SITE.sx, sz: SITE.sz });
    await say(r, d, { k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: none.sx, sz: none.sz });
    assert.deepEqual([words(c).map((m) => m.m), words(d).map((m) => m.m)], [['far'], ['far']], 'far from the pose: far alike');
  }, { start: TT.landAt + 60_000 });
});

test('AUDIT DRAGON-CELL D3 a socket is told an omen once it has stood DRAGON_TELL_DWELL_MS in its room - before, as a far one: nothing, then null at a quiet watch\'s time (mutants: no dwell; the new socket told silence after the quiet time)', async () => {
  assert.equal(DRAGON_TELL_DWELL_MS, 20_000);
  await withRelay(async ({ room, say, set }) => {
    const r = room(CELL), a = r.connect();
    await r.hello(a, 'peer-0001', posed(SITE.px, SITE.py));
    set(Math.max(TT.landAt, Law.dragonQuietAt(W)) + 1);
    await say(r, a, { k: 'ask', w: W });
    assert.deepEqual(omens(a), [[W, null]], 'new: as far');
    set(Law.dragonQuietAt(W) + DRAGON_TELL_DWELL_MS + 1);
    await say(r, a, { k: 'ask', w: W });
    assert.deepEqual(omens(a), [[W, null], [W, OMEN.s]], 'stood: told');
  }, { start: Law.dragonQuietAt(W) });
});

test('AUDIT DRAGON-CELL D6 the relay: a battle\'s pose is judged on its own map frame, as a cell\'s - its players see the sky (AUDIT DRAGON-HIDDEN B1); a room that judges no pose answers nothing (mutants: a battle never judged; the hub answered)', async () => {
  await withRelay(async ({ room, say, set }) => {
    const b = room(siegeRoomKey(3021, 20)), a = b.connect();
    await b.hello(a, 'peer-0001', posed(SITE.px, SITE.py), { glyphs: ['dev'] });
    const h = room(SOCIAL_ROOM), c = h.connect();
    await h.hello(c, 'peer-0002');
    set(TT.landAt + 1000);
    await say(b, a, { k: 'ask', w: W }); await say(h, c, { k: 'ask', w: W });
    assert.deepEqual([omens(a), omens(c)], [[[W, OMEN.s]], []]);
  });
});

/** A screen standing on map pixel `S.px`, SITE's row. */
function screen(S) {
  const M = 40;
  const link = createDragonLink({ now: () => S.t, site: () => null });
  const host = createDragonHost({
    now: () => S.t, link, sites: { of: () => null },
    online: { ready: () => true, send: (w) => { S.sent.push(w); return true; } },
    local: (nx, nz) => [nx / M, nz / M], native: (x, z) => [x * M, z * M], ground: () => 0,
    feet: () => { const c = Law.pixelCentreNative(S.px, SITE.py); return [c.sx / M, 0, c.sz / M]; }, eye: () => [0, 1.6, 0], level: () => 20,
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} }, getTexture: () => null,
  });
  return { host, asks: () => S.sent.filter((w) => w.k === 'ask' && w.w === W).length };
}

test('AUDIT DRAGON-CELL D5 the client: a seed told is asked again once I stand outside its omen\'s reach - another omen of the watch may be about me (mutants: a seed never asked again)', () => {
  const S = { t: TT.landAt + 1000, sent: [], px: SITE.px };
  const { host, asks } = screen(S);
  host.frame();
  host.omen({ w: W, s: OMEN.s });
  S.t += DRAGON_ASK_RETRY_MS; S.px += 3; host.frame();
  assert.equal(asks(), 1, 'within its reach: not asked');
  S.px += 3 * Law.DRAGON_CELL_PX; host.frame();
  assert.equal(asks(), 2, 'outside it: asked again');
});

test('AUDIT DRAGON-CELL D6 the client: a null is asked again from the pixel it was asked from after DRAGON_NONE_AGAIN_MS (a room or a pose the relay could not judge yet), and is kept against the pixel it was asked from, not the one it arrived on (mutants: a null kept for good there; kept against the pixel it arrived on)', () => {
  assert.equal(DRAGON_NONE_AGAIN_MS, 60_000);
  const S = { t: TT.landAt + 1000, sent: [], px: SITE.px };
  const { host, asks } = screen(S);
  host.frame();
  S.px += 1;   // the answer arrives a pixel on: the null is the pixel it was asked from
  host.omen({ w: W, s: null });
  S.t += DRAGON_ASK_RETRY_MS; host.frame();
  assert.equal(asks(), 2, 'here was never asked: asked');
  host.omen({ w: W, s: null });
  S.t += DRAGON_ASK_RETRY_MS; host.frame();
  assert.equal(asks(), 2, 'told none here: not asked again yet');
  S.t += DRAGON_NONE_AGAIN_MS; host.frame();
  assert.equal(asks(), 3, 'a minute on: asked again');
});

test('AUDIT DRAGON-CELL D8, D9 a square\'s ground: none until the countryside stands (read before it, a square named another site), and where the page has idle moments read a slice at a time - the same ground as at once (mutants: read before the countryside; no slices; a slice reads the whole)', () => {
  const town = { px: 2001, py: -98, name: 'Helbenar', type: LOCATION_TYPES.TownVillage, area: 100, theatre: 3, mapId: 1 };
  const srcs = [];
  const places = { generation: () => 1, theatres: () => [], inTheatre: () => [], sources: () => srcs, at: (x, y) => (x === town.px && y === town.py ? town : null) };
  const queue = [];
  const idle = (fn) => { queue.push(fn); };
  const sliced = createTheatreGateScans({ places: /** @type {any} */ (places), wet: () => false, spawnSalt: 1, idle, clock: () => 0 });
  assert.equal(sliced.groundIn(2000, -100, 16), null, 'no countryside: none');
  assert.equal(queue.length, 0, 'and nothing begun');
  srcs.push(COUNTRY_SOURCE);
  assert.equal(sliced.groundIn(2000, -100, 16), null, 'begun, not whole');
  let slices = 0;
  while (queue.length) { slices++; let budget = 8; queue.shift()({ didTimeout: false, timeRemaining: () => (budget-- > 0 ? 3 : 0) }); }
  assert.ok(slices > 2, `read in slices (${slices})`);
  const whole = createTheatreGateScans({ places: /** @type {any} */ (places), wet: () => false, spawnSalt: 1, idle: null }).groundIn(2000, -100, 16);
  const flat = (g) => [...g.byArea.values()].flatMap((l) => [...l]);
  assert.deepEqual(flat(sliced.groundIn(2000, -100, 16)), flat(whole));
  assert.ok(flat(whole).length > 0);
});

test('AUDIT DRAGON-CELL D12 two older laws no pin read (alive on main too): a watch untold draws nothing at any minute of it; the last watch\'s dragon is still drawn past the watch\'s turn while its remains may lie (mutants: DRAGON-HIDDEN-a-dragon-drawn-untold; DRAGON3-the-remains-forgotten-at-the-watchs-turn)', () => {
  for (let t = W * Law.DRAGON_WATCH_MS; t < (W + 2) * Law.DRAGON_WATCH_MS; t += 30_000) assert.equal(skyWatchAt(t, () => null), null, `minute ${(t / 60_000) % 60}`);
  const late = { w: W, s: 0 };
  while (!(Law.isDragonOmen(late) && Law.dragonLandOf(late) > 15 * 60_000)) late.s++;
  const T = Law.dragonTimes(late), turn = (W + 1) * Law.DRAGON_WATCH_MS;
  assert.ok(T.leaveAt + Law.DRAGON_REMAINS_MS > turn + 60_000);
  assert.equal(skyWatchAt(turn + 60_000, (w) => (w === W ? late.s : null))?.w, W, 'past the turn: the last watch\'s');
});
