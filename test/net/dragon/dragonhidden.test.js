// DRAGON-HIDDEN (2026-10-29, as the owner asked;
// bible/11-Multiplayer/Dwarven-Dragon.md section 2): A WATCH'S ROLLS ARE THE RELAY'S SECRET. Pinned: the seed is HMAC of the
// relay's GATE_SIGNING_KEY under its own label - fixed for a watch, another for every watch and every secret, none
// without one; the law keeps no salt a client could roll with; the relay tells a watch's seed only once its landing is
// past, for the watches about alone, and holds no fight for a watch it would not tell; the client asks once its landing
// is past and draws nothing it was not told. tools/mutants/dragonhidden.json; the audit's, dragonhiddenaudit.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Law from '../../../src/net/dragon/dragonLaw.js';
import { dragonWatchKeyOf, dragonOmenSeeds, DRAGON_SEED_INFO } from '../../../src/net/dragon/dragonSeed.js';
import { leaseKeyOf } from '../../../src/net/roomLease.js';
import { cellRoomOfWire, PIXEL_UNITS } from '../../../src/net/wire.js';
import { createDragonHost, DRAGON_ASK_RETRY_MS } from '../../../src/scenes/dragonHost.js';
import { createDragonLink } from '../../../src/net/dragon/dragonLink.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, watchOf, dragonOmenFrom, siteOf, aged } from '../../dragonOmen.mjs';
import { DRAGON_TELL_DWELL_MS } from '../../../server/src/dragonFights.js';

const subtle = globalThis.crypto.subtle;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const OMEN = await dragonOmenFrom(500_000), W = OMEN.w, TT = Law.dragonTimes(OMEN);
const { px: PX, py: PY } = siteOf(OMEN), SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS, CELL = cellRoomOfWire(SX, SZ);
const at = (mx, mz) => ({ x: SX + mx * Law.DRAGON_NATIVE_PER_M, y: 0, z: SZ + mz * Law.DRAGON_NATIVE_PER_M, yaw: 0, pitch: 0 });

test('DRAGON-HIDDEN the seed (AUDIT DRAGON-CELL II E11 - PIN MOVED: the watch\'s seed to its omens\'): HMAC of the relay\'s secret under its own label - the same for an omen every time, another for the next watch and for another secret, a whole 32-bit number, never the lease key\'s; no secret, no key (never a public roll in its place) (mutants: the label the lease\'s; the watch unread; the bytes shortened)', async () => {
  assert.equal(DRAGON_SEED_INFO, 'dfo-dragon-seed:v1');
  const lease = await leaseKeyOf(RELAY_KEY.pkcs8, { subtle });   // AUDIT DRAGON-HIDDEN C6: the keys apart, not their labels alone
  assert.notEqual((await dragonOmenSeeds(lease, W, 1, { subtle }))[0], (await watchOf(W)).seeds[0], 'the seed is never what the lease key signs');
  const k = await dragonWatchKeyOf(RELAY_KEY.pkcs8, { subtle }), k2 = await dragonWatchKeyOf('another secret', { subtle });
  const [a] = await dragonOmenSeeds(k, W, 1, { subtle });
  assert.equal((await dragonOmenSeeds(k, W, 1, { subtle }))[0], a, 'fixed for an omen');
  assert.equal((await watchOf(W)).seeds[0], a, 'the tests\' relay rolls the same');
  assert.notEqual((await dragonOmenSeeds(k, W + 1, 1, { subtle }))[0], a, 'another watch, another seed');
  assert.notEqual((await dragonOmenSeeds(k2, W, 1, { subtle }))[0], a, 'another secret, another seed');
  assert.ok(Number.isSafeInteger(a) && a >= 0 && a <= 0xffffffff);
  const seeds = new Set();
  for (let w = W; w < W + 64; w++) seeds.add((await dragonOmenSeeds(k, w, 1, { subtle }))[0]);
  assert.ok([...seeds].some((s) => s >= 2 ** 31), 'all four bytes, the high one too');
  assert.equal(await dragonWatchKeyOf(undefined, { subtle }), null);
  assert.equal(await dragonWatchKeyOf('', { subtle }), null);
});

test('DRAGON-HIDDEN the law keeps no salt: nothing a client holds rolls a watch - every roll takes an omen, and no watch to come is ever told (mutants: the seed told before its landing; a watch to come told)', async () => {
  assert.equal(/** @type {any} */ (Law).DRAGON_SALT, undefined);
  for (const gone of ['dragonAt', 'isDragonWatch']) assert.equal(/** @type {any} */ (Law)[gone], undefined, `${gone} is gone`);
  assert.doesNotMatch(src('src/net/dragon/dragonLaw.js'), /0xd7a6/i, 'the old public salt');
  assert.equal(Law.dragonSeedTold(OMEN, W, TT.landAt - 1), false);
  assert.equal(Law.dragonSeedTold(OMEN, W, TT.landAt), true);
  assert.equal(Law.dragonSeedTold({ w: W + 1, s: (await watchOf(W + 1)).seeds[0] }, W + 1, (W + 1) * Law.DRAGON_WATCH_MS - 1), false);
});

async function withRelay(fn, { start = TT.landAt + 60_000, key = RELAY_KEY.pkcs8, cell = CELL } = {}) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = aged(world.room(cell));
    if (key) r.env.GATE_SIGNING_KEY = key;
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o }));
    await fn({ r, say, set: (t) => { clock = t; } });
  } finally { Date.now = realNow; }
}
const omens = (ws) => ws.sent.filter((m) => m.t === 'dragon' && m.k === 'omen');

test('DRAGON-HIDDEN the cell tells a watch\'s omen once its landing is past - for this watch and the last alone, each time asked (AUDIT DRAGON-HIDDEN B2); before its landing, or a watch to come, nothing; no secret, a null seed. DRAGON-CELL: only a player near the omen\'s cell is told its seed, never the watch\'s own; one far is told null, no sooner than a quiet watch (mutants: told before the landing; told for any watch; told once a socket)', async () => {
  await withRelay(async ({ r, say, set }) => {
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', at(2000, 0)); await r.hello(b, 'peer-0002', at(0, 0));
    set(TT.landAt - 1);
    await say(a, { k: 'ask', w: W });
    assert.equal(omens(a).length, 0, 'never before it lands');
    set(TT.landAt + 1);
    await say(a, { k: 'ask', w: W + 1 }); await say(a, { k: 'ask', w: W - 2 });
    assert.equal(omens(a).length, 0, 'never a watch to come, nor one long past');
    await say(a, { k: 'ask', w: W });
    assert.deepEqual(omens(a).map(({ w, s }) => [w, s]), [[W, OMEN.s]], 'its omen\'s seed, near its cell - never the watch\'s own');
    await say(a, { k: 'ask', w: W });
    assert.deepEqual(omens(a).map(({ w, s }) => [w, s]), [[W, OMEN.s], [W, OMEN.s]], 'told again: an answer lost is never the watch lost');
    const last = Law.dragonCandidateAt(await watchOf(W - 1), PX, PY);
    await say(b, { k: 'ask', w: W - 1 });
    assert.deepEqual(omens(b).map(({ w, s }) => [w, s]), [[W - 1, last && Law.isDragonOmen(last) ? last.s : null]], 'the last watch\'s too - its remains may lie (a quiet omen told null - AUDIT DRAGON-CELL D1)');
  }, { start: TT.landAt - DRAGON_TELL_DWELL_MS - 1000 });   // AUDIT DRAGON-CELL D3: the sockets stood before it lands
  await withRelay(async ({ r, say }) => {
    const a = r.connect();
    await r.hello(a, 'peer-0001', at(0, 0));
    await say(a, { k: 'ask', w: W });
    assert.deepEqual(omens(a).map(({ w, s }) => [w, s]), [[W, null]], 'no secret here: no dragon');
    await say(a, { k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: SX, sz: SZ });
    assert.equal(r.room._dg.fights.size, 0, 'and no fight stands');
  }, { key: null, start: Law.dragonQuietAt(W) });   // DRAGON-HIDDEN-TIME: no secret is told quiet, at the latest landing
});

test('DRAGON-HIDDEN the cell holds no fight for a watch its secret brings no dragon, and tells an old game - the public salt\'s - to reload (mutants: the brain\'s floor left at 1; the quiet watch is two guards - dragonHolds and dragonAdmits each refuse it - so no one mutant of either moves it, and DRAGON2-every-watch-a-dragon holds the roll they share)', async () => {
  let quiet = W + 1, qc = null;   // DRAGON-CELL: a watch with a quiet omen, at a site in its cell
  while (!(qc = Law.dragonCandidates(await watchOf(quiet)).find((c) => !Law.isDragonOmen(c)))) quiet++;
  const Q = siteOf(qc), qAt = (mx, mz) => ({ x: Q.sx + mx * Law.DRAGON_NATIVE_PER_M, y: 0, z: Q.sz + mz * Law.DRAGON_NATIVE_PER_M, yaw: 0, pitch: 0 });
  await withRelay(async ({ r, say }) => {
    const a = r.connect();
    await r.hello(a, 'peer-0001', qAt(40, 0));
    await say(a, { k: 'in', w: quiet, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: Q.sx, sz: Q.sz });
    assert.ok(a.sent.some((m) => m.t === 'dragon' && m.k === 'no' && m.m === 'gone'));
    assert.equal(r.room._dg.fights.size, 0);
  }, { start: Law.dragonQuietAt(quiet) + 60_000, cell: cellRoomOfWire(Q.sx, Q.sz) });
  assert.deepEqual([Law.DRAGON_BRAIN_V, Law.DRAGON_BRAIN_MIN], [3, 3]);   // PIN MOVED: DRAGON-CELL, a game that finds its site off a lane told to reload
  await withRelay(async ({ r, say }) => {
    const a = r.connect();
    await r.hello(a, 'peer-0001', at(40, 0));
    await say(a, { k: 'in', w: W, bv: 1, lv: 20, sx: SX, sz: SZ });
    assert.ok(a.sent.some((m) => m.t === 'dragon' && m.k === 'no' && m.m === 'reload'));
  });
});

test('DRAGON-HIDDEN the client asks from its watch\'s start (DRAGON-HIDDEN-TIME: the landing is nobody\'s to count), naming no cell - never before, again while unanswered, never once told - and draws nothing it was not told (mutants: asked before the landing; the ask never again; a dragon drawn untold)', () => {
  const M = 40, SITE = { w: W, lane: 0, px: PX, py: PY, ...Law.pixelCentreNative(PX, PY), near: 'Here' };
  const S = { t: W * Law.DRAGON_WATCH_MS - 5000, sent: [], made: 0 };
  const link = createDragonLink({ now: () => S.t, site: () => S.host.site() });
  S.host = createDragonHost({
    now: () => S.t, link, sites: { of: (o) => (o.w === W ? SITE : null) },
    online: { ready: () => true, send: (w, cell) => { S.sent.push({ ...w, cell }); return true; } },
    local: (nx, nz) => [nx / M, nz / M], native: (x, z) => [x * M, z * M], ground: () => 0,
    feet: () => [SITE.sx / M, 0, SITE.sz / M - 100], eye: () => [SITE.sx / M, 1.6, SITE.sz / M - 100], level: () => 20,
    renderer: { createBillboardBatch: () => { S.made++; return {}; }, destroyBillboardBatch: () => {} }, getTexture: () => null,
  });
  const asks = () => S.sent.filter((w) => w.k === 'ask' && w.w === W);
  S.host.frame();
  assert.equal(asks().length, 0, 'before its watch, no ask');
  S.t = W * Law.DRAGON_WATCH_MS;
  assert.equal(S.host.frame(), false);
  assert.equal(S.host.site(), null, 'nothing drawn untold');   // AUDIT DRAGON-HIDDEN B3: the frame's answer is a fight of mine alone
  assert.deepEqual(asks().map((w) => w.cell), [undefined], 'asked of whatever room I stand in (AUDIT DRAGON-HIDDEN B1)');
  S.t += DRAGON_ASK_RETRY_MS - 1; S.host.frame();
  assert.equal(asks().length, 1);
  S.t += 1; S.host.frame();
  assert.equal(asks().length, 2, 'again while unanswered');
  S.host.omen({ w: W, s: OMEN.s });
  S.t += DRAGON_ASK_RETRY_MS; S.host.frame();
  assert.equal(asks().length, 2, 'never once told');
  S.t = Math.max(S.t, TT.landAt); S.host.frame();
  assert.equal(S.host.site()?.w, W, 'told, its site found and its sky drawn');
});
