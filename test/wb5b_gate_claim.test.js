// WB5b (2026-09-25, Mac, Option B: the relay "issues a signed kill record the account service honours"): THE GATES
// CLOSED, DRIVEN. The account service over the real migrations (one row a (day, account); the receipt verified with
// the relay's public half and naming the session's account; a guest's fought and not counted), the worker's route
// behind a session and the count on /v1/account and on the Inspect card's record; the client's call; the device's
// queue of receipts (net/gateClaims.js - what settles one and what keeps it, its clock, its bounds); the cards' words;
// the key tool; and the world host's seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest, claimGate, gateRecordOf } from '../server-account/src/accounts.js';
import { ROUTES, OPEN_ROUTES, ACCOUNT_VERSION } from '../server-account/src/service.js';
import { mintReceipt, importReceiptKey, verifyReceipt, RECEIPT_TTL_S } from '../src/net/gateReceipt.js';
import { importPublicKeyB64 } from '../src/net/identityToken.js';
import { accountGates, SESSION_KEY, REFUSALS } from '../src/net/accountClient.js';
import {
  createGateClaims, gateClaimVerdict, gateRecordText, GATE_CLAIMS_KEY, GATE_CLAIMS_MAX, GATE_CLAIM_RETRY_MS, GATE_CLAIM_TEXT,
} from '../src/net/gateClaims.js';
import { createGateLink } from '../src/net/gateLink.js';
import { createDuelRecords } from '../src/net/duelRecord.js';
import { profileView, profileGateLine, createProfileWindow } from '../src/ui/profileWindow.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}
const T0 = 1_800_000_000;
const guest = async (db) => (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
let _handles = 0;
/** A REGISTERED account - a guest with a handle written on its row, as register() writes it. */
const member = async (db) => {
  const id = await guest(db);
  const h = `Closer${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
/** The relay's pair, as tools/mintGateKeys.mjs mints it. */
async function gatePair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }), pub, pkcs8 };
}
const receiptFor = (s, d, key, nowS = T0, b = 'ruhn') => mintReceipt({ d, b, s, c: 4242, x: 'dealt' }, key, { subtle, nowS });

test('WB5b the claim: a receipt the relay signed, naming the claiming account, is one row a (day, account) - counted once, whatever happens to it; a gate a day adds one; a receipt naming another account, an unsigned one, one another key signed and an expired one are refused; a guest\'s is fought and not counted, and counts once the account registers; no public half, no claim; an account that is gone takes its gates (mutants: the account not checked; the day not the key; the guest counted)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db);
  const { priv, pubKey } = await gatePair();
  const ctx = { db, nowS: T0 + 60, subtle };
  const r700 = await receiptFor(A.id, 700, priv);
  assert.deepEqual(await claimGate(ctx, A, r700, pubKey), { recorded: true, closed: 1 });
  assert.deepEqual(await claimGate(ctx, A, r700, pubKey), { recorded: false, why: 'claimed', closed: 1 }, 'once, whatever happens to it');
  assert.deepEqual(await claimGate(ctx, A, await receiptFor(A.id, 700, priv, T0 + 5), pubKey), { recorded: false, why: 'claimed', closed: 1 }, 'the day is the key, not the bytes');
  assert.deepEqual(await claimGate(ctx, A, await receiptFor(A.id, 701, priv), pubKey), { recorded: true, closed: 2 }, 'the next gate adds one');
  assert.deepEqual(await claimGate(ctx, B, r700, pubKey), { error: 'not-yours' }, 'nobody claims another\'s');
  assert.deepEqual(await gateRecordOf({ db }, B.id), { closed: 0 });
  assert.deepEqual(await claimGate(ctx, A, await receiptFor(A.id, 702, null), pubKey), { error: 'receipt', why: 'unsigned' });
  const other = await gatePair();
  assert.deepEqual(await claimGate(ctx, A, await receiptFor(A.id, 702, other.priv), pubKey), { error: 'receipt', why: 'signature' });
  assert.deepEqual(await claimGate({ ...ctx, nowS: T0 + RECEIPT_TTL_S }, A, await receiptFor(A.id, 702, priv), pubKey), { error: 'receipt', why: 'expired' });
  assert.deepEqual(await claimGate(ctx, A, 'v1.not.a-receipt', pubKey), { error: 'receipt', why: 'version' });
  assert.deepEqual(await claimGate(ctx, A, await receiptFor(A.id, 703, priv), null), { error: 'no-gate-key' });
  // a guest fights and loots, and is not on a record until it registers - the same id
  const G = await guest(db);
  const rg = await receiptFor(G, 700, priv);
  assert.deepEqual(await claimGate(ctx, { id: G, handle: null }, rg, pubKey), { recorded: false, why: 'guest', closed: 0 });
  assert.deepEqual(await claimGate(ctx, { id: G, handle: 'Registered' }, rg, pubKey), { recorded: true, closed: 1 }, 'registered, the same receipt counts');
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(A.id);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM gate_kills WHERE account = ?').get(A.id).n, 0, 'the account gone, its gates with it');
  const sql = src('server-account/migrations/0014_gate_kills.sql');
  assert.match(sql, /PRIMARY KEY \(day, account\)/);
  assert.match(sql, /FOREIGN KEY \(account\) REFERENCES players\(id\) ON DELETE CASCADE/);
});

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

test('WB5b the worker: /v1/gate/claim behind a session and never open - the session is the claimant, never the body; the count on /v1/account and on the Inspect card\'s record; no public half is the service\'s gap (503), another\'s receipt 403, a forged one 400; every word has its sentence; acct10, the toml in step, the public half a var that ships empty (mutants: the route open; the account view without the gates; the key read per request)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { priv, pub } = await gatePair();
  assert.ok(ROUTES.has('/v1/gate/claim') && !OPEN_ROUTES.has('/v1/gate/claim'));
  assert.equal(ACCOUNT_VERSION, 'acct12');   // acct10 on its branch; main's RENOWN1, HOME1, DECOR1 and GUILD1 took acct10 first; SHADOW-FANG moved it on (acct12)
  const toml = src('server-account/wrangler.toml');
  assert.match(toml, /ACCOUNT_VERSION = "acct12"/);
  assert.match(toml, /^GATE_PUBLIC_KEY = ""$/m, 'the public half is a var, empty until the pair is minted');
  assert.doesNotMatch(toml, /GATE_SIGNING_KEY\s*=/, 'the private half is never in the account service\'s file');
  const { call } = await stand({ gateKey: pub });
  const me = (await call('POST', '/v1/auth/guest', {})).body;
  const them = (await call('POST', '/v1/auth/guest', {})).body;
  const r = await receiptFor(me.id, 700, priv, T0);
  assert.deepEqual((await call('POST', '/v1/gate/claim', { receipt: r }, me.secret)).body, { recorded: false, why: 'guest', closed: 0 });
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'GateCloser', password: 'correct horse battery' }, me.secret)).status, 200);
  assert.equal((await call('POST', '/v1/gate/claim', { receipt: r })).status, 401, 'a stranger claims nothing');
  assert.deepEqual((await call('POST', '/v1/gate/claim', { receipt: r, account: them.id }, me.secret)).body, { recorded: true, closed: 1 });
  assert.equal((await call('POST', '/v1/gate/claim', { receipt: r }, them.secret)).status, 403, 'another\'s receipt');
  assert.equal((await call('POST', '/v1/gate/claim', { receipt: 'r1.x.y' }, me.secret)).status, 400);
  // AUDIT WB A5: a refused receipt says which rung refused it - a signature the service's half does not verify is one
  // the client keeps (the pair can be mended within the week), a shape it lets go
  const forged = await call('POST', '/v1/gate/claim', { receipt: await receiptFor(me.id, 704, (await gatePair()).priv, T0) }, me.secret);
  assert.deepEqual([forged.status, forged.body], [400, { error: 'receipt', why: 'signature' }]);
  assert.equal((await call('POST', '/v1/gate/claim', { receipt: 'r1.x.y' }, me.secret)).body.error, 'receipt');
  assert.equal(typeof (await call('POST', '/v1/gate/claim', { receipt: 'r1.x.y' }, me.secret)).body.why, 'string');
  assert.deepEqual((await call('GET', '/v1/account', undefined, me.secret)).body.account.gates, { closed: 1 }, 'the main menu\'s card reads it here');
  assert.deepEqual((await call('POST', '/v1/duel/record', { id: me.id }, them.secret)).body.gates, { closed: 1 }, 'and the Inspect card with the duels');
  const bare = await stand();
  const g = (await bare.call('POST', '/v1/auth/guest', {})).body;
  const no = await bare.call('POST', '/v1/gate/claim', { receipt: await receiptFor(g.id, 700, priv, T0) }, g.secret);
  assert.equal(no.status, 503); assert.equal(no.body.error, 'no-gate-key');
  for (const w of ['no-gate-key', 'receipt', 'not-yours']) assert.equal(typeof REFUSALS[w], 'string', `${w} has its sentence`);
  const signing = src('server-account/src/signing.js');
  assert.match(signing, /if \(_gateKey !== undefined\) return _gateKey;/, 'imported once per isolate');
});

test('WB5b the client: with no session there is no account to claim for - nothing is sent; with one, the receipt goes as a POST carrying the bearer and nothing else of mine (mutants: a knock with no session; the secret in the body)', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push({ url, init }); return { ok: true, status: 200, json: async () => ({ recorded: true, closed: 1 }) }; };
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  assert.deepEqual(await accountGates({ fetch, storage }).claim('r1.a.b'), { ok: false, error: 'no-session' });
  assert.equal(sent.length, 0);
  mem.set(SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Me', kind: 'linked', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' }));
  const r = await accountGates({ fetch, storage }).claim('r1.a.b');
  assert.deepEqual(r, { ok: true, data: { recorded: true, closed: 1 }, status: 200 });
  assert.match(sent[0].url, /\/v1\/gate\/claim$/);
  assert.equal(sent[0].init.method, 'POST');
  assert.equal(sent[0].init.headers.authorization, 'Bearer SECRETSECRETSECRETSECRET');
  assert.deepEqual(JSON.parse(sent[0].init.body), { receipt: 'r1.a.b' });
});

/** A device queue over a Map store, a scripted service, and two clocks. */
async function queue(answers = () => ({ ok: true, data: { recorded: true, closed: 1 } }), { me = 'acct-me' } = {}) {
  const mem = new Map();
  const store = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)) };
  const clock = { s: T0 + 10, ms: 1_000_000 };
  const asked = [], said = [], closed = [];
  const q = createGateClaims({
    claim: async (r) => { asked.push(r); return answers(r, asked.length); },
    store, nowS: () => clock.s, nowMs: () => clock.ms, say: (t) => said.push(t), onClosed: (n) => closed.push(n),
    me: () => me,   // AUDIT WB A9: the signed-in account - its receipts alone are offered
  });
  const { priv } = await gatePair();
  return { q, mem, store, clock, asked, said, closed, priv };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

/** The duel test's fake DOM, enough for the profile card. */
function fakeNode(tag, doc) {
  const n = {
    tag, doc, children: [], attrs: {}, style: {}, dataset: {}, listeners: {}, className: '', textContent: '', id: '', disabled: false,
    append(...cs) { for (const c of cs) if (c) n.children.push(c); },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
    addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
    removeEventListener() {},
    focus() {}, remove() { n.removed = true; },
  };
  return n;
}
function fakeDoc() {
  const doc = {};
  doc.createElement = (t) => fakeNode(t, doc);
  doc.createElementNS = (ns, t) => fakeNode(t, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  return doc;
}
const all = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) all(c, cls, out); return out; };

test('WB5b the device\'s queue: a receipt the relay hands the socket is kept and offered at once; counted, it is let go and said with the count; counted before, let go quietly; refused for good (not a receipt the gate signed, another\'s), let go; anything else - no session, no public half, the network, a guest - kept, and a guest told once; an unsigned or expired one is never kept, one a day, the same one re-sent after it settled is nothing (mutants: a kept receipt lost on a transient refusal; a settled one offered again; the guest line every time; the unsigned kept)', async () => {
  const h = await queue();
  const r = await receiptFor('acct-me', 700, h.priv, T0);
  assert.equal(h.q.add(r), true);
  await settle();
  assert.deepEqual(h.asked, [r], 'offered at once');
  assert.deepEqual(h.said, [GATE_CLAIM_TEXT.recorded(1)]); assert.deepEqual(h.closed, [1]);
  assert.deepEqual(h.q.kept(), [], 'counted: let go');
  assert.equal(h.q.add(r), false, 'the relay re-sends it after a reconnect: settled is settled');
  assert.equal(h.q.add(await receiptFor('acct-me', 701, null, T0)), false, 'an unsigned receipt is never kept - the service could only decline it');
  assert.equal(h.q.add(await receiptFor('acct-me', 702, h.priv, T0 - RECEIPT_TTL_S)), false, 'nor an expired one');
  // the verdicts
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: true, closed: 3 } }), 'done');
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: false, why: 'claimed', closed: 3 } }), 'done');
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: false, why: 'guest', closed: 0 } }), 'keep');
  assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why: 'expired' }), 'done', 'not a receipt the gate signed, for good');
  assert.equal(gateClaimVerdict({ ok: false, error: 'receipt' }), 'done', 'no rung named: for good');
  assert.equal(gateClaimVerdict({ ok: false, error: 'not-yours' }), 'keep', 'AUDIT WB A9: another account\'s waits for it');
  for (const e of ['no-session', 'no-gate-key', 'offline', 'server', 'rate', 'auth']) assert.equal(gateClaimVerdict({ ok: false, error: e }), 'keep', e);
  // kept through a transient refusal; the guest told once
  const k = await queue((_r, n) => (n === 1 ? { ok: false, error: 'offline' } : { ok: true, data: { recorded: false, why: 'guest', closed: 0 } }));
  const r2 = await receiptFor('acct-me', 700, k.priv, T0);
  k.q.add(r2);
  await settle();
  assert.deepEqual(k.q.kept(), [r2], 'the network: kept');
  await k.q.flush(); await k.q.flush();
  assert.deepEqual(k.q.kept(), [r2], 'a guest: kept, for the week it carries');
  assert.deepEqual(k.said, [GATE_CLAIM_TEXT.guest], 'and told once');
  // one a day; the oldest go past the bound
  const d = await queue(() => ({ ok: false, error: 'no-gate-key' }));
  d.q.add(await receiptFor('acct-me', 700, d.priv, T0));
  d.q.add(await receiptFor('acct-me', 700, d.priv, T0 + 1));
  await settle();
  assert.equal(d.q.kept().length, 1, 'one a day');
  for (let day = 701; day < 701 + GATE_CLAIMS_MAX + 2; day++) d.q.add(await receiptFor('acct-me', day, d.priv, T0));
  await settle(); await settle();
  assert.equal(d.q.kept().length, GATE_CLAIMS_MAX, 'bounded');
  // refused for good
  const f = await queue(() => ({ ok: false, error: 'receipt', why: 'claims' }));
  f.q.add(await receiptFor('acct-me', 700, f.priv, T0));
  await settle();
  assert.deepEqual(f.q.kept(), [], 'not the gate\'s: let go');
  assert.equal(JSON.parse(f.mem.get(GATE_CLAIMS_KEY)).length, 0);
});

test('WB5b the queue\'s clock: the first frame of a session offers what is kept at once, then no sooner than GATE_CLAIM_RETRY_MS after the last offer; a receipt past its week is let go unasked; one that lands during an offer is offered as soon as it ends (mutants: an offer every frame; the retry never; the receipt that landed mid-offer left for the clock)', async () => {
  let open = null;
  const h = await queue(() => (open ? open : { ok: false, error: 'offline' }));
  const r = await receiptFor('acct-me', 700, h.priv, T0);
  h.store.set(GATE_CLAIMS_KEY, [r]);   // kept by the last session
  assert.equal(h.q.tick(), true, 'the first frame offers at once');
  await settle();
  assert.equal(h.asked.length, 1);
  h.clock.ms += GATE_CLAIM_RETRY_MS - 1;
  assert.equal(h.q.tick(), false, 'not before its time');
  h.clock.ms += 1;
  assert.equal(h.q.tick(), true);
  await settle();
  assert.equal(h.asked.length, 2);
  h.clock.s = T0 + RECEIPT_TTL_S;   // its week is over
  h.clock.ms += GATE_CLAIM_RETRY_MS;
  assert.equal(h.q.tick(), false, 'nothing live is kept');
  assert.equal(h.asked.length, 2, 'let go unasked');
  // a receipt that lands while an offer is out
  let release;
  const slow = await queue(() => new Promise((res) => { release = () => res({ ok: true, data: { recorded: true, closed: 1 } }); }));
  const a = await receiptFor('acct-me', 700, slow.priv, T0), b = await receiptFor('acct-me', 701, slow.priv, T0);
  slow.q.add(a);
  await settle();
  slow.q.add(b);
  await settle();
  assert.deepEqual(slow.asked, [a], 'one offer at a time');
  release(); await settle(); await settle();
  assert.deepEqual(slow.asked, [a, b], 'the second offered as soon as the first ends');
  release(); await settle();
});

test('WB5b the words and the cards: the account card\'s row says the count or "None yet", and a service from before it says nothing; the Inspect card carries their count off the duels\' record answer and says it only when there is one to say (mutants: a stranger\'s nought said; the gates dropped off the record)', async () => {
  assert.equal(gateRecordText({ closed: 3 }), '3');
  assert.equal(gateRecordText({ closed: 0 }), 'None yet');
  assert.equal(gateRecordText(null), null); assert.equal(gateRecordText({ closed: -1 }), null); assert.equal(gateRecordText({}), null);
  assert.equal(profileGateLine({ wins: 1, losses: 0, gates: { closed: 2 } }), 'Gates closed: 2');
  assert.equal(profileGateLine({ wins: 1, losses: 0, gates: { closed: 0 } }), null, 'a stranger\'s none is not news');
  assert.equal(profileGateLine('asking'), null); assert.equal(profileGateLine(null), null);
  assert.equal(profileView({ name: 'Bran', record: { wins: 0, losses: 0, gates: { closed: 5 } } }).gates, 'Gates closed: 5');
  // the kept read keeps the gates
  const seen = [];
  const recs = createDuelRecords({ read: async () => ({ ok: true, data: { id: 'x', wins: 2, losses: 1, gates: { closed: 4 } } }), onRecord: (id, rec) => seen.push(rec) });
  recs.get('acct-x');
  await settle(); await settle();
  assert.deepEqual(seen[0], { wins: 2, losses: 1, gates: { closed: 4 } });
  const old = createDuelRecords({ read: async () => ({ ok: true, data: { id: 'x', wins: 2, losses: 1 } }), onRecord: (id, rec) => seen.push(rec) });
  old.get('acct-y');
  await settle(); await settle();
  assert.deepEqual(seen[1], { wins: 2, losses: 1 }, 'a service from before it');
  // the card draws the line
  const doc = fakeDoc();
  const w = createProfileWindow({ doc, win: { addEventListener() {}, removeEventListener() {} } });
  w.show('peer-1', profileView({ name: 'Bran', state: 'asking', record: { wins: 0, losses: 0, gates: { closed: 3 } } }));
  assert.deepEqual(all(w.root.children[0], 'dfprofile-gates').map((n) => n.textContent), ['Gates closed: 3'], 'the Inspect card\'s line');
  w.update('peer-1', profileView({ name: 'Bran', state: 'asking', record: { wins: 0, losses: 0, gates: { closed: 0 } } }));
  assert.equal(all(w.root.children[0], 'dfprofile-gates').length, 0, 'and none for none');
  const card = src('src/ui/enhancedAccount.js');
  assert.match(card, /const gates = gateRecordText\(flow\.account\.gates\);\s*\n\s*if \(gates\) row\('Gates closed', gates\);/, 'the main menu\'s account card');
});

test('WB5b the key tool mints ONE pair - the relay\'s private half (PKCS8, what the relay imports) and the account service\'s public half (base64url raw, what it verifies with), a receipt signed by the one verifying with the other - and writes nothing to disk (mutants: two pairs; a key on disk)', async () => {
  const out = execFileSync(process.execPath, ['tools/mintGateKeys.mjs', '--pipe'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).trim().split('\n');
  assert.equal(out.length, 2, 'the private half, then the public half, nothing else');
  const priv = await importReceiptKey(out[0], { subtle });
  const pub = await importPublicKeyB64(out[1], { subtle });
  assert.ok(priv && pub);
  const r = await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-me', c: 1, x: 'stood' }, priv, { subtle, nowS: T0 });
  assert.equal((await verifyReceipt(r, pub, { subtle, nowS: T0 + 1 })).ok, true, 'one pair');
  const tool = src('tools/mintGateKeys.mjs');
  assert.doesNotMatch(tool, /writeFile|appendFile|createWriteStream/, 'nothing is ever written to disk');
});

test('WB5b the seams: the gate link tells every receipt it folds; the world host keeps a queue online on the account service\'s call and the spoils\' JSON door, hands it each receipt, offers it on the gate frame, and draws the Inspect card\'s line off the same record (mutants: each seam removed)', () => {
  const told = [];
  const link = createGateLink({ now: () => 0, onReceipt: (r) => told.push(r) });
  link.word({ k: 'rcpt', r: 'junk' });
  assert.deepEqual(told, [], 'a word that is not a receipt tells nothing');
  const w = src('src/scenes/world.js');
  assert.match(w, /const _spoilsStore = spoilsStore\(appStorage\(\)\);/);
  assert.match(w, /const _accountGates = accountGates\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\) \}\);/);
  assert.match(w, /const gateClaims = params\.has\('online'\) \? createGateClaims\(\{\n    claim: _accountGates\.claim,\n    me: _accountGates\.me,\n    store: _spoilsStore,/, 'AUDIT WB A6/A9: the one store, and the signed-in account');
  assert.match(w, /\n    onReceipt: \(r\) => \{ gateClaims\?\.add\(r\); grantSpoilsOutside\(r\); \},/);
  assert.match(w, /\n    gateClaims\?\.tick\(\);   \/\/ WB5b/);
  assert.match(w, /duels: _profileSub \? profileDuelLine\(rec\) : null, gates: profileGateLine\(rec\) \};/);
  assert.ok(w.indexOf('const gateClaims = ') < w.indexOf('const gateLink = '), 'the queue stands before the link that feeds it');
});

test('WB5b a folded receipt reaches the queue: the gate link\'s `rcpt` for a real receipt is told once a fold (mutants: the hook never called)', async () => {
  const { priv } = await gatePair();
  const r = await receiptFor('acct-me', 700, priv, T0);
  const told = [];
  const link = createGateLink({ now: () => 0, onReceipt: (x) => told.push(x) });
  link.word({ k: 'rcpt', r });
  assert.deepEqual(told, [r]);
  assert.equal(link.receipt(700), r, 'and kept for the spoils as before');
});
