// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): A CACHE CLAIMED, THE
// SERVICE'S - through the real Worker on node:sqlite over the real migrations (test/accountDb.mjs) and the page's own door
// (net/accountClient.js accountAurumCache). One ledger line a cache an account, ever (CACHES-ONCE), the day's forgery
// bound, the balance up by its Aurum; a repeat taken, a forged id, a guest, a closed Aurum and an unseated account
// refused. A Bay dungeon's cache and a lair's past it alike. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { PROGRESS_ROUTES, progressSpentOf } from '../../server-account/src/progress.js';
import { claimCache, AURUM_CACHE_STATUS } from '../../server-account/src/aurumCache.js';
import { accountAurumCache, accountRefusalText, REFUSALS, SESSION_KEY } from '../../src/net/accountClient.js';
import { AURUM_CACHE_AURUM, AURUM_CACHE_DAY_MAX, aurumCacheDungeonKey } from '../../src/net/aurumCacheLaw.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { mintCacheProof, CACHE_PROOF_TTL_S } from '../../src/net/cacheProof.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';

const NOW = Date.UTC(2026, 10, 18, 12);
const DAY = utcDay(NOW / 1000);
const ON = { AURUM_OPEN: 'on' };
/** `n` caches' ids from the `from`th (CACHES-ONCE: every dungeon's key) - Bay dungeons' pixel ids and, `lair`, lairs past the Bay. */
const ids = (n, { lair = false, from = 1 } = {}) => Array.from({ length: n }, (_, k) => /** @type {string} */ (aurumCacheDungeonKey(lair ? lairPlaceId((from + k) * 31) : (from + k) * 7)));

/** AUDIT AURUM-CACHES E1: the relay's proof that `who` stood in cache `id`'s dungeon - a cache's key is its own map id. */
const proofOf = (s, who, id, { nowS = Math.floor(Date.now() / 1000), m = Number(String(id).slice(1)) } = {}) => mintCacheProof({ s: who.id, m }, s.gatePriv, { subtle: webcrypto.subtle, nowS });

async function stand(env = ON) {
  const s = await standService(env);
  const claim = async (who, id, proof) => s.call('/v1/aurum/cache', { id, proof: proof === undefined ? await proofOf(s, who, id) : proof }, who.secret);
  const balance = async (who) => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json()).aurum?.balance;
  const lines = (who) => s.env.DB._raw.prepare("SELECT ref, amount, day FROM aurum_ledger WHERE account = ? AND kind = 'cache' ORDER BY at, ref").all(who.id).map((r) => ({ ...r }));
  return { ...s, claim, balance, lines };
}

test('AURUM-CACHES a cache claimed through the Worker: ten Aurum (PIN MOVED, CACHES-ONCE: twenty-five; AURUM-CACHES BALANCE: fifteen), one ledger line, the balance up by it; the same id again taken and nothing written; another account\'s own claim of the same cache (mutants: the line\'s amount, the repeat answered yes, a repeat called capped)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Finder'), other = await s.seated('Second');
  const [bay] = ids(1), [lair] = ids(1, { lair: true });
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

// PIN MOVED (CACHES-ONCE): three a day, the fourth lost to the next day's roll, and a cache's id good for two days
test('AURUM-CACHES the day\'s forgery bound: ten caches an account a UTC day - the eleventh capped and unwritten, a cache already claimed still taken - and the capped coffer taken the next day, counted then; a cache claimed is taken on every later day (mutants: the bound off by one, the bound ignored, the day not the claim\'s)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Greedy');
  const day = ids(AURUM_CACHE_DAY_MAX + 1), [next] = ids(1, { lair: true });
  for (const [i, id] of day.slice(0, -1).entries()) assert.deepEqual([(await s.claim(me, id)).body.today], [i + 1], id);
  assert.deepEqual(await s.claim(me, day.at(-1)), { status: 429, body: { error: 'cache-capped' } });
  assert.deepEqual(await s.claim(me, day[0]), { status: 409, body: { error: 'cache-taken' } }, 'a repeat is taken, not capped');
  assert.equal(s.lines(me).length, AURUM_CACHE_DAY_MAX, 'nothing written past the bound');
  assert.equal(await s.balance(me), AURUM_CACHE_DAY_MAX * AURUM_CACHE_AURUM);
  t.mock.timers.setTime(NOW + 86_400_000);
  const late = await s.claim(me, day.at(-1));
  assert.deepEqual([late.status, late.body.today], [200, 1], 'the capped coffer waits: taken the next day, counted then');
  assert.equal((await s.claim(me, next)).status, 200);
  t.mock.timers.setTime(NOW + 40 * 86_400_000);
  assert.deepEqual(await s.claim(me, day[0]), { status: 409, body: { error: 'cache-taken' } }, 'once ever');
  assert.deepEqual(s.lines(me).map((l) => l.day), [...day.slice(0, -1).map(() => DAY), DAY + 1, DAY + 1]);
  assert.equal(AURUM_CACHE_STATUS['cache-capped'], 429);
});

// PIN MOVED (CACHES-ONCE): an id was `<day>:d<dungeon>`, refused two days old, a day ahead, or where no cache stood that day
test('AURUM-CACHES a forged id: a second spelling, a day\'s id from before CACHES-ONCE, a key past a dungeon\'s bound, another kind of place and no id are each `cache-id`, and nothing is written (mutants: the id unchecked)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Forger');
  const [real] = ids(1);
  for (const id of [`d0${real.slice(1)}`, `${DAY}:${real}`, 'd4294967296', `p${real.slice(1)}`, ` ${real}`, '', null, 42, undefined]) {
    assert.deepEqual(await s.claim(me, id), { status: 400, body: { error: 'cache-id' } }, String(id));
  }
  assert.deepEqual(s.lines(me), []);
  assert.equal(await s.balance(me), 0);
});

test('AURUM-CACHES the guards: a guest refused; AURUM_OPEN off closes it, `dev` opens it to the developers alone; an account with no seated realm character refused before a word is read, on the pass\'s stream - its answer spends nothing (mutants: a guest claims, the switch unread, the route no progression claim)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const [id] = ids(1);
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
  assert.match(accountRefusalText('cache-capped'), new RegExp(`${AURUM_CACHE_DAY_MAX} Aurum coffers`), 'the bound in its sentence');
});

test('AURUM-CACHES the page\'s door: its session\'s account asks with the cache\'s id and reads the answer; no session is no ask (mutants: the id unsent)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Door');
  const io = { fetch: (u, i) => s.fetch(String(u).replace(/^.*?\/v1\//, 'https://accounts.invalid/v1/'), i), storage: sessionStorageOf(SESSION_KEY, me) };
  const [id] = ids(1);
  const proof = await proofOf(s, me, id);
  const yes = await accountAurumCache(io).claim(id, proof, me.id);
  assert.equal(yes.ok, true, JSON.stringify(yes));
  assert.deepEqual([yes.data.id, yes.data.aurum], [id, AURUM_CACHE_AURUM]);
  const again = await accountAurumCache(io).claim(id);
  assert.deepEqual([again.ok, again.error, again.status], [false, 'cache-taken', 409], 'a held cache is said held with no proof');
  assert.deepEqual(await accountAurumCache({ fetch: io.fetch, storage: { getItem: () => null } }).claim(id), { ok: false, error: 'no-session' });
  // AUDIT AURUM-CACHES lane 3 F2: a coffer stood for one account, pressed after another signed in - no claim for the other
  const [next] = ids(1, { from: 2 });
  const switched = await accountAurumCache(io).claim(next, await proofOf(s, me, next), 'acct-someone-else');
  assert.deepEqual([switched.ok, switched.error], [false, 'no-session']);
  assert.equal(s.lines(me).length, 1, 'nothing written');
});

test("E1 A CLAIM FROM NO DUNGEON: no proof, another account's, another dungeon's, an expired one, one the relay never signed and a forged one are each `cache-proof` and write nothing; the right proof still pays (mutants: the proof unread, the account unmatched, the dungeon unmatched)", async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Visitor'), other = await s.seated('Elsewhere');
  const [id] = ids(1, { from: 3 }), [there] = ids(1, { from: 4 });
  const nowS = NOW / 1000;
  const stranger = await importReceiptKey(Buffer.from(await webcrypto.subtle.exportKey('pkcs8', (await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey)).toString('base64'), { subtle: webcrypto.subtle });
  const good = await proofOf(s, me, id);
  const [v, , sig] = good.split('.');
  const forged = `${v}.${Buffer.from(JSON.stringify({ s: me.id, m: Number(there.slice(1)), i: nowS, e: nowS + 3600 })).toString('base64url')}.${sig}`;
  const refused = {
    none: null,
    'another account\'s': await proofOf(s, other, id),
    'another dungeon\'s': await proofOf(s, me, there),
    expired: await proofOf(s, me, id, { nowS: nowS - CACHE_PROOF_TTL_S - 1 }),
    'unsigned by the relay': await mintCacheProof({ s: me.id, m: Number(id.slice(1)) }, stranger, { subtle: webcrypto.subtle, nowS }),
    forged,
    junk: 'q1.x.y',
  };
  for (const [why, proof] of Object.entries(refused)) assert.deepEqual(await s.claim(me, id, proof), { status: 403, body: { error: 'cache-proof' } }, why);
  assert.deepEqual(await s.claim(me, there, forged), { status: 403, body: { error: 'cache-proof' } }, 'the forged map\'s own cache');
  assert.deepEqual(s.lines(me), [], 'nothing written');
  assert.equal((await s.claim(me, id, good)).status, 200, 'the right proof pays');
  assert.match(accountRefusalText('cache-proof'), /dungeon/);
});
