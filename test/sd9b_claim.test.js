// SD9b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE HOURS BROKEN - the
// account service's claim of an `h1` (server-account/src/sds.js claimSd, migration 0088): one row a (slot, account), a
// guest's fought and not counted, Hourbreaker and The Turning Hour rolled off the receipt's seed on the first write alone
// and held for good on the row (`sd_honours`); the route behind a session, the count on the cards; the title held, worn
// and signed; the client's call and the device's book (net/sdClaims.js); the world host's seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { d1 } from './accountDb.mjs';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest } from '../server-account/src/accounts.js';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { claimSd, sdRecordOf, sdHonoursRoll, SD_HONOUR_TITLE, SD_HONOUR_AURA, SD_TITLE_CHANCE, SD_AURA_CHANCE, SD_HONOURS_SALT } from '../server-account/src/sds.js';
import { titlesHeld, equipRefusal } from '../server-account/src/titles.js';
import { mintSdReceipt, readSdReceipt } from '../src/net/sdReceipt.js';
import { mintReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { importPublicKeyB64, TITLES } from '../src/net/identityToken.js';
import { seededRng } from '../src/systems/wind.js';
import { accountSds, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { createSdClaims, sdClaimVerdict, sdRecordText, SD_CLAIMS_KEY, SD_CLAIMS_MAX, SD_CLAIM_RETRY_MS, SD_CLAIM_TEXT } from '../src/net/sdClaims.js';
import { profileSdLine } from '../src/ui/profileWindow.js';
import { TITLE_TEXT, TITLE_RGBA } from '../src/ui/playerBadge.js';
import { ACCEPTED } from '../src/net/legalLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const T0 = 1_800_000_000;
let _handles = 0;
const member = async (db) => {
  const id = (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
  const h = `Breaker${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }), pub };
}
/** A seed whose first write grants what is asked (the honours' own roll) - one in 32 at the rarest, so a thousand seeds
 *  hold one many times over; a roll that can never grant it fails here rather than looping. */
const seedFor = (title, aura) => { for (let c = 1; c <= 1000; c++) { const h = sdHonoursRoll(c); if (h.title === title && h.aura === aura) return c; } throw new Error(`no seed grants title ${title}, aura ${aura}`); };
const settle = () => new Promise((r) => setImmediate(r));   // a tick's own offer, answered
const hour = (s, d, key, { c = seedFor(false, false), x = 'dealt', l = 30, nowS = T0 } = {}) => mintSdReceipt({ d, s, c, x, l }, key, { subtle, nowS });

// ── the roll ──────────────────────────────────────────────────────────

test('SD9b THE ROLL: off the receipt\'s seed, its own stream (salted - never the spoils\' draws): Hourbreaker one kill in four, The Turning Hour one in eight, the two apart; the same seed the same grants (mutants: the spoils\' stream; the odds swapped; one draw for both)', () => {
  assert.equal(SD_TITLE_CHANCE, 1 / 4); assert.equal(SD_AURA_CHANCE, 1 / 8);
  assert.equal(SD_HONOUR_TITLE, 1); assert.equal(SD_HONOUR_AURA, 2);
  const N = 40000;
  let t = 0, a = 0, both = 0, sameAsSpoils = 0;
  for (let c = 0; c < N; c++) {
    const h = sdHonoursRoll(c);
    assert.deepEqual(sdHonoursRoll(c), h, 'deterministic');
    t += h.title; a += h.aura; both += h.title && h.aura;
    if ((seededRng(c)() < SD_TITLE_CHANCE) === h.title) sameAsSpoils++;
  }
  assert.ok(Math.abs(t / N - 0.25) < 0.01, `title ${t / N}`);
  assert.ok(Math.abs(a / N - 0.125) < 0.008, `aura ${a / N}`);
  assert.ok(Math.abs(both / N - 1 / 32) < 0.005, `both ${both / N} - the two apart`);
  assert.ok(sameAsSpoils / N < 0.7, 'never the spoils\' own first draw');
  assert.equal(SD_HONOURS_SALT, 0x484f5552);
  const r = seededRng((7 ^ SD_HONOURS_SALT) >>> 0);
  assert.deepEqual(sdHonoursRoll(7), { title: r() < 0.25, aura: r() < 0.125 }, 'the title first, then the aura');
});

// ── the claim ─────────────────────────────────────────────────────────

test('SD9b THE CLAIM: an `h1` the relay signed, naming the claiming account, is one row a (slot, account) - counted once whatever happens to it; the next Hollow adds one; another\'s, an unsigned one, one another key signed, an expired one and a gate\'s receipt refused; a guest\'s fought and not counted, counted once registered; no public half, no claim; the row says how and at what level; an account gone takes its Hours (mutants: the account unchecked; the slot not the key; the guest counted)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db);
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  const r7 = await hour(A.id, 7, priv);
  assert.deepEqual(await claimSd(ctx, A, r7, pubKey), { recorded: true, slot: 7, title: false, aura: false, broken: 1 });
  assert.deepEqual(await claimSd(ctx, A, r7, pubKey), { recorded: false, why: 'claimed', broken: 1 }, 'once, whatever happens to it');
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 7, priv, { c: 99, nowS: T0 + 5 }), pubKey), { recorded: false, why: 'claimed', broken: 1 }, 'the slot is the key, not the bytes');
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 8, priv, { x: 'stood', l: 41 }), pubKey), { recorded: true, slot: 8, title: false, aura: false, broken: 2 });
  assert.deepEqual(db._raw.prepare('SELECT slot, boss, earned, lv FROM sd_kills WHERE account = ? ORDER BY slot').all(A.id).map((r) => ({ ...r })),
    [{ slot: 7, boss: 'remnant', earned: 'dealt', lv: 30 }, { slot: 8, boss: 'remnant', earned: 'stood', lv: 41 }]);
  assert.deepEqual(await claimSd(ctx, B, r7, pubKey), { error: 'not-yours' }, 'nobody claims another\'s');
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 9, null), pubKey), { error: 'receipt', why: 'unsigned' });
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 9, (await relayPair()).priv), pubKey), { error: 'receipt', why: 'signature' });
  assert.deepEqual(await claimSd({ ...ctx, nowS: T0 + 8 * 24 * 3600 }, A, await hour(A.id, 9, priv), pubKey), { error: 'receipt', why: 'expired' });
  const gate = await mintReceipt({ d: 9, b: 'ruhn', s: A.id, c: 1, x: 'dealt', l: 30 }, priv, { subtle, nowS: T0 });
  assert.deepEqual(await claimSd(ctx, A, gate, pubKey), { error: 'receipt', why: 'version' }, 'a gate\'s is not an Hour');
  assert.deepEqual(await claimSd(ctx, A, r7, null), { error: 'no-gate-key' });
  assert.deepEqual(await sdRecordOf({ db }, A.id), { broken: 2 });
  // a guest's: fought and not counted - counted once it registers (its id survives the registering)
  const g = (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
  const rg = await hour(g, 7, priv);
  assert.deepEqual(await claimSd(ctx, { id: g, handle: null }, rg, pubKey), { recorded: false, why: 'guest', broken: 0 });
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM sd_kills WHERE account = ?').get(g).n, 0);
  assert.equal((await claimSd(ctx, { id: g, handle: 'Late' }, rg, pubKey)).recorded, true, 'counted once registered');
  // an account gone takes its Hours with it
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(A.id);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM sd_kills WHERE account = ?').get(A.id).n, 0);
});

test('SD9b THE GRANTS: a kill\'s first write rolls Hourbreaker and The Turning Hour off its seed and lays them on the account\'s row by that row alone - held for good: a later kill granting nothing takes nothing, a second receipt for a slot already counted grants nothing (the first write alone), a guest\'s grants nothing; the title is then held and may be worn (mutants: the grants on every claim; the grants cleared; written whether the row was or not)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db);
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  const honours = (id) => db._raw.prepare('SELECT sd_honours AS h FROM players WHERE id = ?').get(id).h;
  const row = (id) => db._raw.prepare('SELECT * FROM players WHERE id = ?').get(id);
  assert.equal(honours(A.id), 0, 'none before');
  assert.ok(!titlesHeld(row(A.id), {}).includes('hourbreaker'));
  assert.equal(equipRefusal('hourbreaker', row(A.id), {}), 'not-held');
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 7, priv, { c: seedFor(true, false) }), pubKey), { recorded: true, slot: 7, title: true, aura: false, broken: 1 });
  assert.equal(honours(A.id), SD_HONOUR_TITLE);
  assert.ok(titlesHeld(row(A.id), {}).includes('hourbreaker'), 'held');
  assert.equal(equipRefusal('hourbreaker', row(A.id), {}), null, 'and may be worn');
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 8, priv, { c: seedFor(false, false) }), pubKey), { recorded: true, slot: 8, title: false, aura: false, broken: 2 });
  assert.equal(honours(A.id), SD_HONOUR_TITLE, 'held for good');
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 8, priv, { c: seedFor(true, true) }), pubKey), { recorded: false, why: 'claimed', broken: 2 }, 'a slot counted grants nothing again');
  assert.equal(honours(A.id), SD_HONOUR_TITLE, 'the first write alone');
  assert.deepEqual(await claimSd(ctx, A, await hour(A.id, 9, priv, { c: seedFor(false, true) }), pubKey), { recorded: true, slot: 9, title: false, aura: true, broken: 3 });
  assert.equal(honours(A.id), SD_HONOUR_TITLE | SD_HONOUR_AURA, 'both');
  assert.deepEqual(db._raw.prepare('SELECT slot, title, aura FROM sd_kills WHERE account = ? ORDER BY slot').all(A.id).map((r) => ({ ...r })),
    [{ slot: 7, title: 1, aura: 0 }, { slot: 8, title: 0, aura: 0 }, { slot: 9, title: 0, aura: 1 }], 'each row says what it granted');
  // a guest's grants nothing - and a guest row never holds the title
  const g = (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
  assert.equal((await claimSd(ctx, { id: g, handle: null }, await hour(g, 7, priv, { c: seedFor(true, true) }), pubKey)).why, 'guest');
  assert.equal(honours(g), 0);
  assert.ok(!titlesHeld({ ...row(g), sd_honours: SD_HONOUR_TITLE, handle: null, registered_at: null }, {}).includes('hourbreaker'), 'a guest row holds none');
  assert.equal(honours(B.id), 0, 'another account untouched');
  assert.equal((await claimSd(ctx, B, await hour(B.id, 7, priv, { c: seedFor(false, true) }), pubKey)).aura, true);
  assert.equal(honours(B.id), SD_HONOUR_AURA);
  assert.ok(!titlesHeld(row(B.id), {}).includes('hourbreaker'), 'the aura alone is no title');
  assert.ok(TITLES.includes('hourbreaker'), 'a title the token carries');
});

// ── the worker ────────────────────────────────────────────────────────

async function stand({ gateKey = null } = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: gateKey ?? '' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { env, call };
}

test('SD9b THE WORKER: /v1/sd/claim behind a session and never open - the session the claimant, never the body; the Hours broken on /v1/account and on the Inspect card\'s record; the title on the wardrobe and worn; no public half 503, another\'s 403, a forged one 400 with its rung (mutants: the route open; the cards without the Hours)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { priv, pub } = await relayPair();
  assert.ok(ROUTES.has('/v1/sd/claim') && !OPEN_ROUTES.has('/v1/sd/claim'));
  const { call } = await stand({ gateKey: pub });
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  const them = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  const r = await hour(me.id, 7, priv, { c: seedFor(true, false) });
  assert.deepEqual((await call('POST', '/v1/sd/claim', { receipt: r }, me.secret)).body, { recorded: false, why: 'guest', broken: 0 });
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'HourBreaker1', password: 'correct horse battery', ...ACCEPTED }, me.secret)).status, 200);
  assert.equal((await call('POST', '/v1/sd/claim', { receipt: r })).status, 401, 'a stranger claims nothing');
  assert.deepEqual((await call('POST', '/v1/sd/claim', { receipt: r, account: them.id }, me.secret)).body, { recorded: true, slot: 7, title: true, aura: false, broken: 1 });
  assert.equal((await call('POST', '/v1/sd/claim', { receipt: r }, them.secret)).status, 403, 'another\'s receipt');
  const forged = await call('POST', '/v1/sd/claim', { receipt: await hour(me.id, 8, (await relayPair()).priv) }, me.secret);
  assert.deepEqual([forged.status, forged.body], [400, { error: 'receipt', why: 'signature' }]);
  assert.equal((await call('POST', '/v1/sd/claim', { receipt: 'h1.x.y' }, me.secret)).status, 400);
  const acct = (await call('GET', '/v1/account', undefined, me.secret)).body;
  assert.deepEqual(acct.account.sds, { broken: 1 }, 'the main menu\'s card reads it here');
  assert.ok(acct.wardrobe.titles.includes('hourbreaker'), 'the title on the wardrobe');
  assert.deepEqual((await call('POST', '/v1/duel/record', { id: me.id }, them.secret)).body.sds, { broken: 1 }, 'and the Inspect card');
  const bare = await stand();
  const g = (await bare.call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  const no = await bare.call('POST', '/v1/sd/claim', { receipt: await hour(g.id, 7, priv) }, g.secret);
  assert.deepEqual([no.status, no.body.error], [503, 'no-gate-key']);
  for (const w of ['no-gate-key', 'receipt', 'not-yours']) assert.equal(typeof REFUSALS[w], 'string', `${w} has its sentence`);
});

// ── the client ────────────────────────────────────────────────────────

test('SD9b THE CLIENT\'S CALL: with no session nothing is sent; with one, the receipt goes as a POST with the bearer and nothing else of mine (mutants: a knock with no session)', async () => {
  const sent = [];
  const fetch = async (u, i) => { sent.push([u, i]); return new Response(JSON.stringify({ recorded: true, slot: 7, title: false, aura: false, broken: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const none = accountSds({ fetch, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  assert.deepEqual(await none.claim('h1.x.'), { ok: false, error: 'no-session' });
  assert.equal(none.me(), null);
  assert.equal(sent.length, 0, 'no knock with no session');
  const store = new Map([[SESSION_KEY, JSON.stringify({ id: 'acct-me-0001', secret: 'sekrit' })]]);
  const s = accountSds({ fetch, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } });
  const got = await s.claim('h1.x.');
  assert.equal(got.ok, true);
  assert.match(sent[0][0], /\/v1\/sd\/claim$/);
  assert.equal(sent[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(sent[0][1].body), { receipt: 'h1.x.' }, 'the receipt, nothing else of mine');
});

test('SD9b THE DEVICE\'S BOOK: a signed receipt the relay handed is kept (one a Hollow and account) and offered at once; counted, let go with the count and the grants said; claimed before, let go; a guest\'s kept and said once; a mendable refusal kept, another let go; an unsigned or expired one never kept; another account\'s waits for its sign-in; a refusing store keeps it in memory; the clock - at once the first frame, then no sooner than the retry (mutants: an unsigned one kept; another\'s offered; the grants unsaid)', async () => {
  const { priv } = await relayPair();
  const mine = await hour('acct-me-0001', 7, priv);
  const theirs = await hour('acct-them-0002', 7, priv);
  const bare = await hour('acct-me-0001', 8, null);
  const said = [], asked = [];
  let answer = { ok: true, data: { recorded: true, slot: 7, title: true, aura: true, broken: 3 } };
  let me = 'acct-me-0001', ms = 0;
  const store = new Map();
  const book = createSdClaims({
    claim: async (r) => { asked.push(r); return answer; }, store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) },
    nowS: () => T0, nowMs: () => ms, say: (t) => said.push(t), me: () => me,
  });
  assert.equal(book.add(bare), false, 'unsigned: never kept');
  assert.equal(book.add(theirs), true);
  assert.deepEqual(asked, [], 'another account\'s waits');
  assert.equal(book.add(mine), true);
  await book.flush();
  assert.deepEqual(asked, [mine]);
  assert.deepEqual(said, [SD_CLAIM_TEXT.recorded(3), SD_CLAIM_TEXT.title, SD_CLAIM_TEXT.aura]);
  assert.deepEqual(store.get(SD_CLAIMS_KEY), [theirs], 'counted: let go');
  assert.equal(book.add(mine), false, 'settled this session: not again');
  // another account signs in: offered at once
  me = 'acct-them-0002'; ms += 2000; asked.length = 0; said.length = 0;
  answer = { ok: true, data: { recorded: false, why: 'guest', broken: 0 } };
  assert.equal(book.tick(), true); await settle();
  assert.deepEqual([asked, said], [[theirs], [SD_CLAIM_TEXT.guest]]);
  assert.deepEqual(store.get(SD_CLAIMS_KEY), [theirs], 'a guest\'s kept');
  ms += 2000; assert.equal(book.tick(), false, 'not before the retry');
  ms += SD_CLAIM_RETRY_MS; asked.length = 0; said.length = 0;
  assert.equal(book.tick(), true); await settle();
  assert.deepEqual([asked, said], [[theirs], []], 'offered again; the guest line said once');
  // the verdicts
  assert.equal(sdClaimVerdict({ ok: true, data: { recorded: false, why: 'claimed' } }), 'done');
  assert.equal(sdClaimVerdict({ ok: false, error: 'receipt', why: 'signature' }), 'keep', 'mendable');
  assert.equal(sdClaimVerdict({ ok: false, error: 'receipt', why: 'expired' }), 'done');
  assert.equal(sdClaimVerdict({ ok: false, error: 'offline' }), 'keep');
  assert.equal(sdClaimVerdict({ ok: false, error: 'no-session' }), 'keep');
  // one a Hollow and account; bounded
  const many = createSdClaims({ claim: async () => ({ ok: false, error: 'offline' }), nowS: () => T0, me: () => null });
  for (let d = 1; d <= SD_CLAIMS_MAX + 3; d++) many.add(await hour('acct-me-0001', d, priv));
  many.add(await hour('acct-me-0001', SD_CLAIMS_MAX + 3, priv, { c: 5 }));
  assert.equal(many.kept().length, SD_CLAIMS_MAX, 'bounded, the oldest first out');
  assert.deepEqual(many.kept().map((r) => readSdReceipt(r).d), Array.from({ length: SD_CLAIMS_MAX }, (_, i) => i + 4), 'one a Hollow and account');
  // expired by the relay's clock: let go unasked; a store that refuses: memory
  const late = createSdClaims({ claim: async () => ({ ok: false, error: 'offline' }), nowS: () => T0 + 8 * 24 * 3600, me: () => null, store: { get: () => { throw new Error('no'); }, set: () => { throw new Error('no'); } } });
  assert.equal(late.add(mine), false, 'expired by the relay\'s clock');
  const mem = createSdClaims({ claim: async () => ({ ok: false, error: 'offline' }), nowS: () => T0, me: () => null, store: { get: () => { throw new Error('no'); }, set: () => { throw new Error('no'); } } });
  assert.equal(mem.add(mine), true); assert.deepEqual(mem.kept(), [mine], 'memory holds it');
});

test('SD9b THE WORDS AND THE CARDS: the account card\'s row says the count or "None yet" (a service from before it, nothing); the Inspect card says it once there is one; the title\'s word and its colour of its own', () => {
  assert.equal(sdRecordText({ broken: 3 }), '3');
  assert.equal(sdRecordText({ broken: 0 }), 'None yet');
  assert.equal(sdRecordText(undefined), null); assert.equal(sdRecordText({ broken: -1 }), null);
  assert.equal(profileSdLine({ sds: { broken: 2 } }), 'Hours broken: 2');
  assert.equal(profileSdLine({ sds: { broken: 0 } }), null, 'a stranger\'s none is not news');
  assert.equal(profileSdLine({}), null);
  assert.equal(TITLE_TEXT.hourbreaker, 'Hourbreaker');
  assert.ok(Array.isArray(TITLE_RGBA.hourbreaker) && TITLE_RGBA.hourbreaker.length === 4);
  assert.match(src('src/ui/enhancedAccount.js'), /const hours = sdRecordText\(flow\.account\.sds\);\n\s+if \(hours\) row\('Hours broken', hours\);/);
});

test('SD9b the hosts and the service by source: the world host keeps a book online on the account service\'s call, hands it every receipt the relay hands it and offers it again each frame; the service\'s route, its count on the cards, the grant on the row, the toml and the deploy\'s paths', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const sdClaims = params\.has\('online'\) \? createSdClaims\(\{/);
  assert.match(w, /online\.onSdReceipt = \(r, room\) => \{ sdClaims\?\.add\(r\);/);   // SD9e: and its spoils, by the room it came from (PIN MOVED)
  assert.match(w, /sdClaims\?\.tick\(\);/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /if \(path === '\/v1\/sd\/claim' && request\.method === 'POST'\) \{/);
  assert.match(idx, /sds: await sdRecordOf\(ctx, who\.player\.id\)/);
  assert.match(idx, /sds: await sdRecordOf\(ctx, body\.id\)/);
  assert.match(src('server-account/migrations/0090_sd_kills.sql'), /PRIMARY KEY \(slot, account\)/);
  assert.match(src('server-account/migrations/0090_sd_kills.sql'), /ALTER TABLE players ADD COLUMN sd_honours INTEGER NOT NULL DEFAULT 0;/);
  const deploy = src('.github/workflows/account-deploy.yml');
  for (const p of ['src/net/sdReceipt.js', 'src/systems/wind.js']) assert.ok(deploy.includes(`- "${p}"`), `${p} deploys the service`);
});
