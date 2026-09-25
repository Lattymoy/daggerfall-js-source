// DUEL1 (2026-09-24, Mac: "Add a dueling K/D to the profile menu and player inspect profile"; asked: per account, on the
// main menu's account card): THE RECORD, AND THE SURFACES THE DUEL STANDS ON, DRIVEN. The account service over the real
// migrations (one INSERT is the whole write: the loser's own report, the winner named by the relay's stamp; the gap and
// the pair bound inside it; wins and losses COUNTED off the rows), the worker's two routes behind a session and the
// record on /v1/account, the client's calls, the words and the kept reads; and the Inspect card's Challenge button and
// record line, the challenge prompt, the F-menu's rows, the account card's row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest, reportDuelLoss, duelRecordOf, DUEL_REPORT_GAP_S, DUEL_PAIR_DAY_MAX, DUEL_WINNER_DAY_MAX, DUEL_MUTUAL_S } from '../server-account/src/accounts.js';
import { ROUTES, OPEN_ROUTES, ACCOUNT_VERSION } from '../server-account/src/service.js';
import { accountDuels, SESSION_KEY, REFUSALS } from '../src/net/accountClient.js';
import { duelKd, duelRecordText, createDuelRecords, DUEL_RECORD_TTL_MS } from '../src/net/duelRecord.js';
import { profileView, profileDuelLine, createProfileWindow, DUEL_RECORD_ASKING } from '../src/ui/profileWindow.js';
import { createDuelPrompt, duelPromptSub } from '../src/ui/duelPrompt.js';
import { socialMenuRows, socialPlaqueRows } from '../src/ui/socialMenu.js';
import { DUEL_ASK_TTL_MS } from '../src/net/duelSession.js';

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
/** AUDIT DUEL1 A1: a REGISTERED account - a guest with a handle written on its row, as register() writes it. */
let _handles = 0;
const member = async (db) => {
  const id = await guest(db);
  const h = `Duellist${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};

test('DUEL1 the record: the LOSER\'s report is one row naming the winner - the loser\'s loss and the winner\'s win, both COUNTED off it; a report inside DUEL_REPORT_GAP_S of the loser\'s last does not count again, nor one past DUEL_PAIR_DAY_MAX a day; the loser is never the winner; a winner that is no account is refused (mutants: the gap unread; the pair bound unread; a self-report counted)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db), C = await member(db);
  let r = await reportDuelLoss({ db, nowS: T0 }, A, B.id);
  assert.deepEqual(r, { recorded: true, wins: 0, losses: 1 });
  assert.deepEqual(await duelRecordOf({ db }, B.id), { wins: 1, losses: 0 }, 'the winner\'s win, counted');
  r = await reportDuelLoss({ db, nowS: T0 + DUEL_REPORT_GAP_S - 1 }, A, C.id);
  assert.deepEqual(r, { recorded: false, why: 'gap', wins: 0, losses: 1 }, 'inside the gap: fought, not counted again');
  r = await reportDuelLoss({ db, nowS: T0 + DUEL_REPORT_GAP_S + 1 }, A, C.id);
  assert.equal(r.recorded, true, 'the gap is the loser\'s own');
  // the pair bound
  const D = await member(db), E = await member(db);
  let t = T0;
  let counted = 0, last = null;
  for (let i = 0; i < DUEL_PAIR_DAY_MAX + 3; i++) { t += DUEL_REPORT_GAP_S + 1; last = await reportDuelLoss({ db, nowS: t }, D, E.id); if (last.recorded) counted++; }
  assert.equal(counted, DUEL_PAIR_DAY_MAX, 'one pair counts DUEL_PAIR_DAY_MAX a day');
  assert.equal(last.why, 'pair');
  t += 24 * 3600;
  assert.equal((await reportDuelLoss({ db, nowS: t }, D, E.id)).recorded, true, 'and again the next day');
  assert.deepEqual(await reportDuelLoss({ db, nowS: t + 99 }, D, D.id), { error: 'self' });
  assert.deepEqual(await reportDuelLoss({ db, nowS: t + 99 }, D, 'nobody-at-all'), { error: 'no-player' });
  assert.deepEqual(await reportDuelLoss({ db, nowS: t + 99 }, D, 'x y'), { error: 'no-player' }, 'no account\'s shape');
  // an account that is gone takes its duels with it (both ends cascade)
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(E.id);
  assert.deepEqual(await duelRecordOf({ db }, D.id), { wins: 0, losses: 0 });
  assert.match(src('server-account/migrations/0008_duels.sql'), /THERE ARE NO COUNTER COLUMNS/);
});

test('AUDIT DUEL1 A1 + B5: a record is between two REGISTERED accounts - a guest\'s loss and a loss to a guest are fought, not counted; one winner counts DUEL_WINNER_DAY_MAX a day from anyone; a double knockout (two losses in opposite directions DUEL_MUTUAL_S apart) is a draw, and the one row a report can take away names its own sender the winner (mutants: guests counted; the winner bound unread; the draw unread; the draw taking a stranger\'s row)', async () => {
  const db = d1();
  const M = await member(db), N = await member(db);
  const g = { id: await guest(db), handle: null };
  // guests: the five-guest mint the audit ran is gone at the first row
  assert.deepEqual(await reportDuelLoss({ db, nowS: T0 }, g, M.id), { recorded: false, why: 'guest', wins: 0, losses: 0 }, 'a guest\'s loss is not counted');
  assert.deepEqual(await reportDuelLoss({ db, nowS: T0 }, M, g.id), { recorded: false, why: 'guest', wins: 0, losses: 0 }, 'nor a loss to a guest');
  assert.deepEqual(await duelRecordOf({ db }, M.id), { wins: 0, losses: 0 });
  assert.deepEqual(await reportDuelLoss({ db, nowS: T0 }, g, 'nobody-at-all'), { error: 'no-player' }, 'a guest naming nobody is still refused as nobody');
  // the winner bound: registered losers, each once, all naming N
  let t = T0, counted = 0, last = null;
  for (let i = 0; i < DUEL_WINNER_DAY_MAX + 3; i++) { t += 1; last = await reportDuelLoss({ db, nowS: t }, await member(db), N.id); if (last.recorded) counted++; }
  assert.equal(counted, DUEL_WINNER_DAY_MAX, 'one winner counts DUEL_WINNER_DAY_MAX a day, from anyone');
  assert.equal(last.why, 'winner');
  assert.deepEqual(await duelRecordOf({ db }, N.id), { wins: DUEL_WINNER_DAY_MAX, losses: 0 });
  t += 24 * 3600;
  assert.equal((await reportDuelLoss({ db, nowS: t }, await member(db), N.id)).recorded, true, 'and again the next day');
  // the double knockout: P's loss to Q, then Q's to P inside DUEL_MUTUAL_S - neither counts
  const P = await member(db), Q = await member(db);
  assert.equal((await reportDuelLoss({ db, nowS: t }, P, Q.id)).recorded, true);
  assert.deepEqual(await reportDuelLoss({ db, nowS: t + DUEL_MUTUAL_S }, Q, P.id), { recorded: false, why: 'draw', wins: 0, losses: 0 }, 'the second report is a draw');
  assert.deepEqual(await duelRecordOf({ db }, P.id), { wins: 0, losses: 0 }, 'and the first row is gone with it');
  // past the window it is a second duel, and counts
  const R = await member(db), S = await member(db);
  assert.equal((await reportDuelLoss({ db, nowS: t }, R, S.id)).recorded, true);
  assert.equal((await reportDuelLoss({ db, nowS: t + DUEL_MUTUAL_S + 1 }, S, R.id)).recorded, true, 'a second duel, not a double knockout');
  assert.deepEqual(await duelRecordOf({ db }, R.id), { wins: 1, losses: 1 });
  // a report takes away only a row naming its own sender the winner: U lost to V; W's report naming U touches nothing
  const U = await member(db), V = await member(db), W = await member(db);
  t += 3600;
  assert.equal((await reportDuelLoss({ db, nowS: t }, U, V.id)).recorded, true);
  assert.equal((await reportDuelLoss({ db, nowS: t + 1 }, W, U.id)).recorded, true, 'W lost to U: a result of its own');
  assert.deepEqual(await duelRecordOf({ db }, V.id), { wins: 1, losses: 0 }, 'V\'s win stands');
  assert.match(src('server-account/migrations/0008_duels.sql'), /idx_duel_winner ON duel_results \(winner, at\)/, 'the winner bound reads its own index');
});

async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
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

test('DUEL1 the worker: /v1/duel/loss and /v1/duel/record behind a session, neither open; the caller of `loss` is the loser - the session says so, never the body; any account\'s record by id, in the body; /v1/account carries the caller\'s own; acct8 (mutants: a route open to strangers; the loser read off the body; the account view without the record)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { call } = await stand();
  assert.ok(ROUTES.has('/v1/duel/loss') && ROUTES.has('/v1/duel/record'));
  assert.ok(!OPEN_ROUTES.has('/v1/duel/loss') && !OPEN_ROUTES.has('/v1/duel/record'));
  assert.equal(ACCOUNT_VERSION, 'acct12');   // GUILD1c's guild on the token and its orders moved it on (acct12); DUEL1 was acct8; FOUNDER2's cutoff moved it on (acct9); RENOWN1's Renown, HOME1's homes, DECOR1's decor and GUILD1's guilds, one deploy, moved it again (acct10 - acct9 on the branch); RENOWN4's total in the mint's answer (acct11)
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct12"/);
  const me = (await call('POST', '/v1/auth/guest', {})).body;
  const them = (await call('POST', '/v1/auth/guest', {})).body;
  // AUDIT DUEL1 A1: a guest's loss is fought, not counted - the record is between registered accounts
  assert.deepEqual((await call('POST', '/v1/duel/loss', { winner: them.id }, me.secret)).body, { recorded: false, why: 'guest', wins: 0, losses: 0 });
  for (const [who, h] of [[me, 'DuelMe'], [them, 'DuelThem']]) {
    assert.equal((await call('POST', '/v1/auth/register', { handle: h, password: 'correct horse battery' }, who.secret)).status, 200);
  }
  assert.equal((await call('POST', '/v1/duel/loss', { winner: them.id })).status, 401, 'a stranger reports nothing');
  assert.equal((await call('POST', '/v1/duel/record', { id: them.id })).status, 401);
  const r = await call('POST', '/v1/duel/loss', { winner: them.id, loser: them.id }, me.secret);
  assert.deepEqual(r.body, { recorded: true, wins: 0, losses: 1 }, 'the session is the loser, whatever the body says');
  assert.deepEqual((await call('POST', '/v1/duel/record', { id: them.id }, me.secret)).body, { id: them.id, wins: 1, losses: 0 });
  assert.equal((await call('POST', '/v1/duel/record', { id: 'nobody-here' }, me.secret)).status, 404);
  assert.equal((await call('POST', '/v1/duel/loss', { winner: me.id }, me.secret)).body.error, 'self');
  const acct = (await call('GET', '/v1/account', undefined, them.secret)).body.account;
  assert.deepEqual(acct.duels, { wins: 1, losses: 0 }, 'the main menu\'s card reads its own record here');
  assert.equal(typeof REFUSALS.self, 'string', 'the refusal has its sentence');
});

test('DUEL1 the client: with no session there is no account to lose with - nothing is sent; with one, the loss and the ask go as POSTs carrying the bearer (mutants: a knock with no session; the secret in the body or the URL)', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push({ url, init }); return { ok: true, status: 200, json: async () => ({ recorded: true, wins: 0, losses: 1 }) }; };
  const empty = new Map();
  const storage = { getItem: (k) => empty.get(k) ?? null, setItem: (k, v) => empty.set(k, v), removeItem: (k) => empty.delete(k) };
  const none = accountDuels({ fetch, storage });
  assert.deepEqual(await none.lost('acct-x'), { ok: false, error: 'no-session' });
  assert.equal(sent.length, 0);
  empty.set(SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Me', kind: 'guest', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' }));
  const d = accountDuels({ fetch, storage });
  const r = await d.lost('acct-x');
  assert.equal(r.ok, true);
  assert.match(sent[0].url, /\/v1\/duel\/loss$/);
  assert.equal(sent[0].init.method, 'POST');
  assert.equal(sent[0].init.headers.authorization, 'Bearer SECRETSECRETSECRETSECRET');
  assert.deepEqual(JSON.parse(sent[0].init.body), { winner: 'acct-x' }, 'the winner, and nothing of mine');
  await d.record('acct-y');
  assert.match(sent[1].url, /\/v1\/duel\/record$/);
  assert.deepEqual(JSON.parse(sent[1].init.body), { id: 'acct-y' });
});

test('DUEL1 the words and the kept reads: the K/D is wins over losses (no losses reads the wins), two decimals; a record with none says so; the Inspect card asks once and keeps the answer DUEL_RECORD_TTL_MS, says it is asking meanwhile, and forgets on the word (mutants: K/D inverted; a zero-loss K/D of Infinity; a read every frame)', async () => {
  assert.equal(duelKd(6, 3), 2);
  assert.equal(duelKd(4, 0), 4);
  assert.equal(duelKd(0, 5), 0);
  assert.equal(duelRecordText({ wins: 3, losses: 1 }), '3 won, 1 lost (K/D 3.00)');
  assert.equal(duelRecordText({ wins: 0, losses: 0 }), 'No duels yet');
  assert.equal(duelRecordText(null), null);
  let t = 0, reads = 0, told = 0;
  const recs = createDuelRecords({ read: async () => { reads++; return { ok: true, data: { wins: 2, losses: 1 } }; }, now: () => t, onRecord: () => { told++; } });
  assert.equal(recs.get('acct-x'), 'asking');
  assert.equal(recs.get('acct-x'), 'asking', 'one read out at a time');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(recs.get('acct-x'), { wins: 2, losses: 1 });
  assert.equal(told, 1);
  t += DUEL_RECORD_TTL_MS - 1;
  recs.get('acct-x');
  assert.equal(reads, 1, 'kept');
  t += 2;
  assert.deepEqual(recs.get('acct-x'), { wins: 2, losses: 1 }, 'stale: the kept one shown meanwhile...');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(reads, 2, '...and asked again');
  recs.forget('acct-x');
  assert.equal(recs.get('acct-x'), 'asking');
  assert.equal(recs.get(''), null);
  const bad = createDuelRecords({ read: async () => ({ ok: false, error: 'offline' }), now: () => t });
  bad.get('acct-z');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(bad.get('acct-z'), null, 'the service could not say: no line, never a zero');
});

// ─── THE SURFACES ───────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tag, doc, children: [], attrs: {}, style: {}, dataset: {}, listeners: {}, className: '', textContent: '', id: '', disabled: false,
    append(...cs) { for (const c of cs) if (c) n.children.push(c); },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
    addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
    fire(t, ev = {}) { for (const fn of n.listeners[t] ?? []) fn({ stopPropagation() {}, preventDefault() {}, ...ev }); },
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
const fakeWin = () => ({ addEventListener() {}, removeEventListener() {} });
const all = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) all(c, cls, out); return out; };
const text = (n) => (n.textContent || '') + (n.children ?? []).map(text).join('');

test('DUEL1 the Inspect card: the Challenge button beside Close as the host\'s law says it - pressed, it asks the host; disabled, its reason under it and the press is nothing; their record\'s line under the name, "asking" while the service is asked (mutants: a disabled button that still challenges; the record line from the card\'s own word)', () => {
  const doc = fakeDoc();
  const asked = [];
  const w = createProfileWindow({ doc, win: fakeWin(), onDuel: (id) => asked.push(id) });
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  w.show('peer-0002', profileView({ name: 'Bran', look, state: 'asking', duel: { label: 'Challenge to a duel', enabled: true }, record: { wins: 4, losses: 2 } }));
  const card = w.root.children[0];
  const btn = all(card, 'dfprofile-duel')[0];
  assert.equal(btn.textContent, 'Challenge to a duel');
  btn.fire('click');
  assert.deepEqual(asked, ['peer-0002'], 'the press is the host\'s, for the card\'s peer');
  assert.equal(text(all(card, 'dfprofile-duels')[0]), 'Duels: 4 won, 2 lost (K/D 2.00)');
  assert.ok(all(card, 'dfprofile-close').length === 1, 'Close stands beside it');
  w.update('peer-0002', profileView({ name: 'Bran', look, state: 'asking', duel: { label: 'Challenge to a duel', enabled: false, why: 'A duel is fought outdoors.' }, record: 'asking' }));
  const off = all(w.root.children[0], 'dfprofile-duel')[0];
  assert.equal(off.disabled, true);
  off.fire('click');
  assert.equal(asked.length, 1, 'a disabled button challenges nobody');
  assert.equal(text(all(w.root.children[0], 'dfprofile-why')[0]), 'A duel is fought outdoors.');
  assert.equal(text(all(w.root.children[0], 'dfprofile-duels')[0]), DUEL_RECORD_ASKING);
  // no duel word: no button, and the card is what it was
  w.update('peer-0002', profileView({ name: 'Bran', look, state: 'asking' }));
  assert.equal(all(w.root.children[0], 'dfprofile-duel').length, 0);
  assert.equal(profileDuelLine(null), null);
  assert.equal(profileView({ duel: { label: 'x', enabled: false, why: 'y' } }).duel.why, 'y');
});

test('DUEL1 the challenge prompt: the newest standing challenge with its countdown; Accept and Decline answer for THAT peer through the law; gone the moment the law no longer holds it (mutants: an answer for the wrong peer; the strip standing after the challenge lapsed)', () => {
  const doc = fakeDoc();
  let asks = [{ peer: 'peer-0003', at: 5000 }, { peer: 'peer-0002', at: 1000 }];
  const acted = [];
  const p = createDuelPrompt({ asks: () => asks, accept: (id) => acted.push(['yes', id]), decline: (id) => acted.push(['no', id]), name: (id) => ({ 'peer-0002': 'Bran', 'peer-0003': 'Cid' })[id], now: () => 6000, doc });
  p.render();
  assert.equal(p.root.dataset.up, '1');
  assert.equal(p.peer(), 'peer-0003', 'the newest');
  assert.equal(text(p.root), `Cid challenges you to a duel${duelPromptSub(DUEL_ASK_TTL_MS - 1000)}AcceptDecline`);
  const [yes, no] = all(p.root, 'dfduel-btn');
  yes.fire('click');
  assert.deepEqual(acted, [['yes', 'peer-0003']]);
  asks = [{ peer: 'peer-0002', at: 1000 }];
  p.render();
  no.fire('click');
  assert.deepEqual(acted.at(-1), ['no', 'peer-0002']);
  asks = [];
  p.render();
  assert.equal(p.root.dataset.up, '0', 'gone with the challenge');
  assert.equal(duelPromptSub(0), 'Answer within 1s');
  assert.equal(duelPromptSub(29001), 'Answer within 30s');
});

test('DUEL1 the F-menu\'s rows: a waiting challenge reads Accept duel with Decline duel beside it, a live duel Yield the duel - the challenge itself is the Inspect card\'s alone; the plaque lists the same rows; the account card shows the record (mutants: a Challenge row on the F-menu; the decline missing; the account card silent)', () => {
  const rows = (acts) => socialMenuRows({ peerId: 'peer-0002', canInspect: true, ...acts }).map((r) => [r.key, r.label, r.enabled, r.act?.k ?? null]);
  assert.ok(!rows({}).some(([k]) => k.startsWith('duel')), 'nothing to answer: no duel row');
  assert.deepEqual(rows({ duelRow: { label: 'Accept duel', k: 'duel.accept', enabled: true }, canDeclineDuel: true }).filter(([k]) => k.startsWith('duel')), [['duel', 'Accept duel', true, 'duel.accept'], ['duel-decline', 'Decline duel', true, 'duel.decline']]);
  assert.deepEqual(rows({ duelRow: { label: 'Yield the duel', k: 'duel.yield', enabled: true } }).filter(([k]) => k.startsWith('duel')), [['duel', 'Yield the duel', true, 'duel.yield']]);
  const off = socialMenuRows({ peerId: 'peer-0002', duelRow: { label: 'Accept duel', k: 'duel.accept', enabled: false, why: 'a duel is fought outdoors' } }).find((r) => r.key === 'duel');
  assert.equal(off.why, 'a duel is fought outdoors');
  assert.deepEqual(socialPlaqueRows('peer-0002', { duelRow: { label: 'Yield the duel', k: 'duel.yield', enabled: true } }).map((r) => r.id), ['friend', 'invite', 'duel']);
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(act\.k === 'duel\.accept'\) \{ const r = duelMgr\.accept\(act\.peer\);/);
  assert.match(w, /if \(act\.k === 'duel\.decline'\) \{ duelMgr\.decline\(act\.peer\); return; \}/);
  assert.match(w, /if \(act\.k === 'duel\.yield'\) \{ duelMgr\.yieldDuel\(\); return; \}/);
  assert.match(w, /onDuel: \(peerId\) => duelChallenge\(peerId\),/, 'the Inspect card\'s button');
  assert.match(w, /_profileSub = sub;   \/\/ DUEL1: the account the relay stamped on their answer/, 'the record is read by the relay\'s stamp');
  assert.match(w, /if \(end\.lost && duel\.sub\) \{\s*\n\s*duelAccount\.lost\(duel\.sub\)/, 'only a LOSS is reported, by the loser, naming the stamp');
  const card = src('src/ui/enhancedAccount.js');
  assert.match(card, /const duels = duelRecordText\(flow\.account\.duels\);\s*\n\s*if \(duels\) row\('Duels', duels\);/, 'the main menu\'s account card');
});
