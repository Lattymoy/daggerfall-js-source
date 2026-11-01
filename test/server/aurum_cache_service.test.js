// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): A CACHE CLAIMED, THE
// SERVICE'S - through the real Worker on node:sqlite over the real migrations (test/accountDb.mjs) and the page's own door
// (net/accountClient.js accountAurumCache). One ledger line a cache an account, ever (CACHES-ONCE), no day's bound
// (CACHE-SPREAD), the balance up by the cache's own Aurum; a repeat taken, a forged id, a guest, a closed Aurum and an unseated account
// refused. A Bay dungeon's cache and a lair's past it alike. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { PROGRESS_ROUTES, progressSpentOf } from '../../server-account/src/progress.js';
import { claimCache, AURUM_CACHE_STATUS } from '../../server-account/src/aurumCache.js';
import { accountAurumCache, accountRefusalText, REFUSALS, SESSION_KEY } from '../../src/net/accountClient.js';
import { aurumCacheAurumOf, aurumCacheDungeonKey } from '../../src/net/aurumCacheLaw.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { aurumWeekOf, aurumWeekEndMs } from '../../src/net/aurumLaw.js';
import { mintCacheProof, CACHE_PROOF_TTL_S } from '../../src/net/cacheProof.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';

const NOW = Date.UTC(2026, 10, 18, 12);
const DAY = utcDay(NOW / 1000);
const WEEK = aurumWeekOf(NOW / 1000), UNTIL = aurumWeekEndMs(WEEK) / 1000;   // a Wednesday; the week turns on Monday
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

test('AURUM-CACHES a cache claimed through the Worker: its own Aurum, 5 to 10 (PIN MOVED, CACHE-SPREAD: ten; CACHES-ONCE: twenty-five; AURUM-CACHES BALANCE: fifteen), one ledger line keyed by its UTC week, the balance up by it; the same id again taken, with when the week turns, and nothing written; another account\'s own claim of the same cache (mutants: the line\'s amount, the repeat answered yes, a repeat called capped)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Finder'), other = await s.seated('Second');
  const [bay] = ids(1), [lair] = ids(1, { lair: true });
  assert.equal(await s.balance(me), 0);
  const yes = await s.claim(me, bay);
  assert.deepEqual(yes, { status: 200, body: { ok: true, id: bay, aurum: aurumCacheAurumOf(bay), until: UNTIL } });
  assert.equal(await s.balance(me), aurumCacheAurumOf(bay), 'the balance sums the ledger');
  assert.deepEqual(await s.claim(me, bay), { status: 409, body: { error: 'cache-taken', at: UNTIL } }, 'one claim an id an account a week');
  assert.deepEqual(s.lines(me), [{ ref: `${bay}:${WEEK}`, amount: aurumCacheAurumOf(bay), day: DAY }], 'one line');
  assert.equal((await s.claim(other, bay)).status, 200, 'the cache is every account\'s to claim once a week');
  const past = await s.claim(me, lair);
  assert.deepEqual(past, { status: 200, body: { ok: true, id: lair, aurum: aurumCacheAurumOf(lair), until: UNTIL } }, 'a lair\'s cache past the Bay, alike');
  assert.equal(await s.balance(me), aurumCacheAurumOf(bay) + aurumCacheAurumOf(lair));
  assert.ok(ROUTES.has('/v1/aurum/cache'));
});

// PIN MOVED (CACHE-SPREAD): ten caches a UTC day the forgery bound, the eleventh capped until the next day; before
// CACHES-ONCE three a day, the fourth lost to the next day's roll
test('CACHE-SPREAD no day\'s bound (Mac: "no daily cap"): thirty caches in one UTC day each pay their own Aurum and are written, a repeat still taken; a cache claimed is taken the rest of its UTC week and pays again from Monday (mutants: a bound kept, the amount not the cache\'s, the line\'s day not the claim\'s, the week unkeyed)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.seated('Delver');
  const day = [...ids(15), ...ids(15, { lair: true })];
  for (const id of day) assert.deepEqual(await s.claim(me, id), { status: 200, body: { ok: true, id, aurum: aurumCacheAurumOf(id), until: UNTIL } }, id);
  assert.deepEqual(await s.claim(me, day[0]), { status: 409, body: { error: 'cache-taken', at: UNTIL } }, 'a repeat is taken');
  const sum = day.reduce((a, id) => a + aurumCacheAurumOf(id), 0);
  assert.ok(new Set(day.map(aurumCacheAurumOf)).size >= 4, 'the amounts differ');
  assert.equal(await s.balance(me), sum);
  const byRef = (/** @type {any[]} */ a, /** @type {any[]} */ b) => (a[0] < b[0] ? -1 : 1);
  assert.deepEqual(s.lines(me).map((l) => [l.ref, l.amount, l.day]).sort(byRef), day.map((id) => [`${id}:${WEEK}`, aurumCacheAurumOf(id), DAY]).sort(byRef));
  assert.equal(s.lines(me).length, day.length);
  t.mock.timers.setTime(UNTIL * 1000 - 1000);   // Sunday's last second
  assert.deepEqual(await s.claim(me, day[0]), { status: 409, body: { error: 'cache-taken', at: UNTIL } }, 'taken all week');
  t.mock.timers.setTime(UNTIL * 1000);   // Monday 00:00 UTC
  const next = await s.claim(me, day[0]);
  assert.deepEqual(next, { status: 200, body: { ok: true, id: day[0], aurum: aurumCacheAurumOf(day[0]), until: UNTIL + 7 * 86_400 } }, 'the week turned: it fills again');
  assert.equal(s.lines(me).length, day.length + 1);
  assert.equal(await s.balance(me), sum + aurumCacheAurumOf(day[0]));
  assert.equal('cache-capped' in AURUM_CACHE_STATUS, false);
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
  assert.deepEqual(progressSpentOf('/v1/aurum/cache', yes.body), [], 'no bucket spent: the relay\'s proof is the bar');
  const off = await stand({ AURUM_OPEN: 'off' });
  const shut = await off.seated('Shut');
  assert.deepEqual(await off.claim(shut, id), { status: 409, body: { error: 'cache-closed' } });
  assert.deepEqual(off.lines(shut), []);
  const dev = await stand({ AURUM_OPEN: 'dev', DEVELOPER_HANDLES: 'Lattymoy' });
  assert.equal((await dev.claim(await dev.seated('Lattymoy'), id)).status, 200, 'a developer');
  assert.equal((await dev.claim(await dev.seated('Player'), id)).status, 409, 'and nobody else');
  assert.deepEqual(Object.keys(AURUM_CACHE_STATUS).filter((w) => !(w in REFUSALS)), [], 'every refusal has its sentence');
  assert.equal('cache-capped' in REFUSALS, false, 'no day\'s bound to be refused by');
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
  assert.deepEqual([yes.data.id, yes.data.aurum], [id, aurumCacheAurumOf(id)]);
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
