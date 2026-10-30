// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): A CACHE CLAIMED, THE
// SERVICE'S - through the real Worker on node:sqlite over the real migrations (test/accountDb.mjs) and the page's own door
// (net/accountClient.js accountAurumCache). One ledger line a cache an account, three a UTC day, the balance up by its
// Aurum; a repeat taken, a forged id, a guest, a closed Aurum and an unseated account refused. A Bay dungeon's cache and a
// lair's past it alike. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { PROGRESS_ROUTES, progressSpentOf } from '../../server-account/src/progress.js';
import { claimCache, AURUM_CACHE_STATUS } from '../../server-account/src/aurumCache.js';
import { accountAurumCache, accountRefusalText, REFUSALS, SESSION_KEY } from '../../src/net/accountClient.js';
import { AURUM_CACHE_AURUM, AURUM_CACHE_DAY_MAX, aurumCacheDungeonKey, aurumCacheHolds, aurumCacheId } from '../../src/net/aurumCacheLaw.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { utcDay } from '../../src/net/marksLaw.js';

const NOW = Date.UTC(2026, 10, 18, 12);
const DAY = utcDay(NOW / 1000);
const ON = { AURUM_OPEN: 'on' };
/** Places that hold a cache on `day` (`none`: that hold none) - Bay dungeons' pixel ids and, `lair`, lairs past the Bay. */
const places = (day, n, { lair = false, none = false } = {}) => {
  const out = [];
  for (let i = 1; out.length < n; i++) {
    const p = aurumCacheDungeonKey(lair ? lairPlaceId(i * 31) : i * 7);
    if (aurumCacheHolds(day, p) !== none) out.push(p);
  }
  return out;
};
const ids = (day, n, o) => places(day, n, o).map((p) => aurumCacheId(day, p));

async function stand(env = ON) {
  const s = await standService(env);
  const claim = (who, id) => s.call('/v1/aurum/cache', { id }, who.secret);
  const balance = async (who) => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json()).aurum?.balance;
  const lines = (who) => s.env.DB._raw.prepare("SELECT ref, amount, day FROM aurum_ledger WHERE account = ? AND kind = 'cache' ORDER BY at, ref").all(who.id).map((r) => ({ ...r }));
  return { ...s, claim, balance, lines };
}

test('AURUM-CACHES a cache claimed through the Worker: twenty-five Aurum (PIN MOVED, AURUM-CACHES BALANCE: fifteen), one ledger line, the balance up by it; the same id again taken and nothing written; another account\'s own claim of the same cache (mutants: the line\'s amount, the repeat answered yes, a repeat called capped)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Finder'), other = await s.seated('Second');
  const [bay] = ids(DAY, 1), [lair] = ids(DAY, 1, { lair: true });
  assert.equal(await s.balance(me), 0);
  const yes = await s.claim(me, bay);
  assert.deepEqual(yes, { status: 200, body: { ok: true, id: bay, aurum: AURUM_CACHE_AURUM, today: 1, max: AURUM_CACHE_DAY_MAX } });
  assert.equal(await s.balance(me), AURUM_CACHE_AURUM, 'the balance sums the ledger');
  assert.deepEqual(await s.claim(me, bay), { status: 409, body: { error: 'cache-taken' } }, 'one claim an id an account');
  assert.deepEqual(s.lines(me), [{ ref: bay, amount: AURUM_CACHE_AURUM, day: DAY }], 'one line');
  assert.equal((await s.claim(other, bay)).status, 200, 'the cache is every account\'s to claim once');
  const past = await s.claim(me, lair);
  assert.deepEqual([past.status, past.body.today], [200, 2], 'a lair\'s cache past the Bay, alike');
  assert.equal(await s.balance(me), 2 * AURUM_CACHE_AURUM);
  assert.ok(ROUTES.has('/v1/aurum/cache'));
});

test('AURUM-CACHES the day\'s bound: three caches an account a UTC day - the fourth capped and unwritten, a cache already claimed still taken - and the next day three again; yesterday\'s cache found just before midnight is taken today and counted today (mutants: the bound off by one, the bound ignored, the day the id\'s)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Greedy');
  const today = ids(DAY, 5);
  for (const [i, id] of today.slice(0, 3).entries()) assert.deepEqual([(await s.claim(me, id)).body.today], [i + 1], id);
  assert.deepEqual(await s.claim(me, today[3]), { status: 429, body: { error: 'cache-capped' } });
  assert.deepEqual(await s.claim(me, today[0]), { status: 409, body: { error: 'cache-taken' } }, 'a repeat is taken, not capped');
  assert.equal(s.lines(me).length, 3, 'nothing written past the bound');
  assert.equal(await s.balance(me), 3 * AURUM_CACHE_AURUM);
  t.mock.timers.setTime(NOW + 86_400_000);
  const late = await s.claim(me, today[4]);
  assert.equal(late.status, 200, 'yesterday\'s cache, the next day');
  assert.equal(late.body.today, 1, 'counted on the day it is claimed');
  for (const id of ids(DAY + 1, 2)) assert.equal((await s.claim(me, id)).status, 200, id);
  assert.equal((await s.claim(me, ids(DAY + 1, 3)[2])).status, 429, 'the new day\'s three');
  assert.deepEqual(s.lines(me).map((l) => l.day), [DAY, DAY, DAY, DAY + 1, DAY + 1, DAY + 1]);
  assert.equal(AURUM_CACHE_STATUS['cache-capped'], 429);
});

test('AURUM-CACHES a forged id: a place that holds no cache today, a cache two days old, one of tomorrow, a second spelling and no id are each `cache-id`, and nothing is written (mutants: the id unchecked, an old day taken)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Forger');
  const [cold] = ids(DAY, 1, { none: true }), [old] = ids(DAY - 2, 1), [ahead] = ids(DAY + 1, 1), [real] = ids(DAY, 1);
  for (const id of [cold, old, ahead, `0${real}`, `${real.split(':')[0]}:d0${real.split(':d')[1]}`, '', null, 42, undefined]) {
    assert.deepEqual(await s.claim(me, id), { status: 400, body: { error: 'cache-id' } }, String(id));
  }
  assert.deepEqual(s.lines(me), []);
  assert.equal(await s.balance(me), 0);
});

test('AURUM-CACHES the guards: a guest refused; AURUM_OPEN off closes it, `dev` opens it to the developers alone; an account with no seated realm character refused before a word is read, on the pass\'s stream - its answer spends nothing (mutants: a guest claims, the switch unread, the route no progression claim)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const [id] = ids(DAY, 1);
  const s = await stand();
  assert.deepEqual(await claimCache({ db: s.env.DB, nowS: NOW / 1000 }, { id: 'g', handle: null }, { id }, ON), { error: 'cache-guest' });
  const g = await s.guest();
  assert.equal((await s.call('/v1/aurum/cache', { id }, g.secret)).status, 403, 'a guest at the door');
  assert.deepEqual(PROGRESS_ROUTES['/v1/aurum/cache'], ['pass', false], 'names no character: the account\'s seat is asked');
  const bare = await s.registered('Scripted');
  const no = await s.call('/v1/aurum/cache', { id }, bare.secret);
  assert.deepEqual([no.status, no.body?.error], [403, 'progress-seat'], 'a session\'s secret alone, no game played');
  assert.deepEqual(s.lines(bare), []);
  const yes = await s.claim(await s.seated('Played'), id);
  assert.deepEqual(progressSpentOf('/v1/aurum/cache', yes.body), [], 'the day\'s bound is the bound - no bucket spent');
  const off = await stand({ AURUM_OPEN: 'off' });
  const shut = await off.seated('Shut');
  assert.deepEqual(await off.claim(shut, id), { status: 409, body: { error: 'cache-closed' } });
  assert.deepEqual(off.lines(shut), []);
  const dev = await stand({ AURUM_OPEN: 'dev', DEVELOPER_HANDLES: 'Lattymoy' });
  assert.equal((await dev.claim(await dev.seated('Lattymoy'), id)).status, 200, 'a developer');
  assert.equal((await dev.claim(await dev.seated('Player'), id)).status, 409, 'and nobody else');
  assert.deepEqual(Object.keys(AURUM_CACHE_STATUS).filter((w) => !(w in REFUSALS)), [], 'every refusal has its sentence');
  assert.match(accountRefusalText('cache-capped'), /3 Aurum caches/, 'the cap in its sentence');
});

test('AURUM-CACHES the page\'s door: its session\'s account asks with the cache\'s id and reads the answer; no session is no ask (mutants: the id unsent)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Door');
  const io = { fetch: (u, i) => s.fetch(String(u).replace(/^.*?\/v1\//, 'https://accounts.invalid/v1/'), i), storage: sessionStorageOf(SESSION_KEY, me) };
  const [id] = ids(DAY, 1);
  const yes = await accountAurumCache(io).claim(id);
  assert.equal(yes.ok, true, JSON.stringify(yes));
  assert.deepEqual([yes.data.id, yes.data.aurum], [id, AURUM_CACHE_AURUM]);
  const again = await accountAurumCache(io).claim(id);
  assert.deepEqual([again.ok, again.error, again.status], [false, 'cache-taken', 409]);
  assert.deepEqual(await accountAurumCache({ fetch: io.fetch, storage: { getItem: () => null } }).claim(id), { ok: false, error: 'no-session' });
});
