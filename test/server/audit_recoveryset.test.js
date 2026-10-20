// AUDIT RECOVERY-SET (2026-10-14, "Audit this") - three cold lanes over RECOVERY-SET as pushed (7ce77a95b7): the
// service and its security, the client and its card, the pins and the records. Every finding reproduced before it was
// paid; this file pins each one at its root. bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md AUDIT RECOVERY-SET.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { createGuest, register, login, recover, changePassword, newRecoveryCodes, accountView, LOGIN_MAX } from '../../server-account/src/accounts.js';
import {
  hashPassword, parseStored, codeForHashing, mintRecoverySet, recoveryLeft, RECOVERY_SET_SIZE, RECOVERY_CODE_ITERS, PBKDF2_ITERS,
} from '../../server-account/src/password.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { accountCard } from '../../src/ui/enhanced/enhancedAccount.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { SESSION_KEY, DEFAULT_ACCOUNT_SERVICE, accountRefusalText } from '../../src/net/accountClient.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

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
        _result() { const results = stmt.all(...args); return { results, meta: { changes: Number(db.prepare('SELECT changes() AS c').get().c) } }; },
      };
      return api;
    },
    // SIGN-BATCH (PIN MOVED): D1's batch, as the runtime runs it - one transaction, rolled back whole when a statement throws
    // (the badge's doors ask the three games' honours in one, honours.js withHonours)
    async batch(list) { db.exec('BEGIN'); try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}
const NOW = 1_760_400_000;
const ctxOf = (db, sub = subtle) => ({ db, subtle: sub, rand, nowS: NOW });
const rowOf = (ctx, id) => ctx.db._raw.prepare('SELECT * FROM players WHERE id = ?').get(id);
async function registered({ set = true } = {}) {
  const ctx = ctxOf(d1());
  const g = await createGuest(ctx, {});
  const reg = await register(ctx, g.id, { handle: 'Nystul', password: 'a good long one', set });
  return { ctx, id: g.id, reg, codes: reg.recoveryCodes, password: 'a good long one' };
}
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { env, call };
}

// ── A1 (severe): A STOLEN PASSWORD ALONE CANNOT KILL THE CODES ─────────

test('AUDIT RECOVERY-SET A1: the password thief - with a session and the password, but no code - cannot make a new set, so after changing the password the owner\'s codes still take the account back and sign the thief out (mutants: the code not asked; a wrong code answered a set)', async () => {
  const { call } = await stand();
  const owner = (await call('/v1/auth/guest', { ...ACCEPTED })).body;
  const reg = (await call('/v1/auth/register', { handle: 'Kithlan', password: 'the owner one', ...ACCEPTED, set: true }, owner.secret)).body;
  const thief = (await call('/v1/auth/login', { handle: 'Kithlan', password: 'the owner one' })).body;
  const noCode = await call('/v1/account/recovery-codes', { password: 'the owner one' }, thief.secret);
  assert.deepEqual([noCode.status, noCode.body.error], [401, 'bad-code'], 'the password alone killed the owner\'s codes');
  const guessed = await call('/v1/account/recovery-codes', { password: 'the owner one', code: mintRecoverySet(rand, 1)[0] }, thief.secret);
  assert.deepEqual([guessed.status, guessed.body.error], [401, 'bad-code']);
  assert.equal((await call('/v1/account/password', { oldPassword: 'the owner one', password: 'the thief one' }, thief.secret)).status, 200);
  const back = await call('/v1/auth/recover', { handle: 'Kithlan', code: reg.recoveryCodes[6], password: 'the owner again', set: true });
  assert.equal(back.status, 200, 'the owner\'s code no longer takes the account back');
  assert.equal((await call('/v1/auth/token', { secret: thief.secret })).status, 401, 'the thief is still signed in');
});

test('AUDIT RECOVERY-SET A1: the code is SPENT by the new set (the old set dies whole), a single code from before the set is asked for the same way, and a row holding no codes asks the password alone (mutants: the row\'s shape ignored)', async () => {
  const { ctx, id, codes, password } = await registered();
  const made = await newRecoveryCodes(ctx, rowOf(ctx, id), { password, code: codes[2] });
  assert.equal(made.recoveryCodes.length, RECOVERY_SET_SIZE);
  assert.equal((await recover(ctx, { handle: 'Nystul', code: codes[2], password: 'the spent one here', set: true })).error, 'bad-code');
  // a single code (ACC1c, RECOVER-OP)
  const old = mintRecoverySet(rand, 1)[0];
  ctx.db._raw.prepare('UPDATE players SET recovery_hash = ? WHERE id = ?').run(await hashPassword(codeForHashing(old), { subtle, rand }), id);
  assert.deepEqual(await newRecoveryCodes(ctx, rowOf(ctx, id), { password, code: made.recoveryCodes[0] }), { error: 'bad-code' });
  assert.equal((await newRecoveryCodes(ctx, rowOf(ctx, id), { password, code: old })).recoveryCodes.length, RECOVERY_SET_SIZE);
  // nothing to kill: a registered row with no codes at all
  ctx.db._raw.prepare('UPDATE players SET recovery_hash = NULL WHERE id = ?').run(id);
  assert.equal((await newRecoveryCodes(ctx, rowOf(ctx, id), { password })).recoveryCodes.length, RECOVERY_SET_SIZE);
});

test('AUDIT RECOVERY-SET A1: a guess at the code through the profile spends RECOVER\'s bucket, as recover spends it, and a right one forgives it (mutants: the code unthrottled; never forgiven)', async () => {
  const { ctx, id, codes, password } = await registered();
  for (let i = 0; i < LOGIN_MAX; i++) assert.equal((await newRecoveryCodes(ctx, rowOf(ctx, id), { password, code: mintRecoverySet(rand, 1)[0] })).error, 'bad-code');
  assert.deepEqual(await newRecoveryCodes(ctx, rowOf(ctx, id), { password, code: codes[0] }), { error: 'rate' }, 'codes ground through the profile without limit');
  assert.equal((await recover(ctx, { handle: 'Nystul', code: codes[0], password: 'a new one here', set: true })).error, 'rate', 'one code, one allowance, whichever door');
  const fresh = await registered();
  for (let i = 0; i < LOGIN_MAX - 1; i++) await newRecoveryCodes(fresh.ctx, rowOf(fresh.ctx, fresh.id), { password, code: mintRecoverySet(rand, 1)[0] });
  assert.ok((await newRecoveryCodes(fresh.ctx, rowOf(fresh.ctx, fresh.id), { password, code: fresh.codes[1] })).recoveryCodes);
  assert.equal((await newRecoveryCodes(fresh.ctx, rowOf(fresh.ctx, fresh.id), { password, code: mintRecoverySet(rand, 1)[0] })).error, 'bad-code', 'a right code did not forgive the bucket');
});

// ── C3 / C4: THE PASSWORD'S BUCKET IS LOGIN'S, AND A RIGHT ONE FORGIVES ──

test('AUDIT RECOVERY-SET C3 C4: a password guessed through the profile spends LOGIN\'s bucket - LOGIN_MAX there and login itself answers rate - and a right one forgives it (mutants: a bucket of its own; never forgiven)', async () => {
  const { ctx, id, codes, password } = await registered();
  for (let i = 0; i < LOGIN_MAX; i++) await newRecoveryCodes(ctx, rowOf(ctx, id), { password: `guess ${i}`, code: codes[0] });
  assert.equal((await login(ctx, { handle: 'Nystul', password })).error, 'rate', 'the profile\'s guesses were not the password\'s');
  const fresh = await registered();
  for (let i = 0; i < LOGIN_MAX - 1; i++) await newRecoveryCodes(fresh.ctx, rowOf(fresh.ctx, fresh.id), { password: `guess ${i}`, code: fresh.codes[0] });
  assert.ok((await newRecoveryCodes(fresh.ctx, rowOf(fresh.ctx, fresh.id), { password, code: fresh.codes[0] })).recoveryCodes);
  assert.equal((await newRecoveryCodes(fresh.ctx, rowOf(fresh.ctx, fresh.id), { password: 'one more guess', code: fresh.codes[1] })).error, 'bad-login', 'a right password did not forgive the bucket');
});

test('AUDIT RECOVERY-SET C4 A4: the routes\' words - 429 for rate; two presses racing answer one set and one 409; two of a set\'s codes recovering at once answer one 200 and one 409 codes-moved, a sentence and not "wrong code" (mutants: rate as 400; codes-moved as 400; the race loser told bad-code)', async (t) => {
  // THE WINDOW IS THE WALL CLOCK'S (overRate: `floor(nowS / LOGIN_WINDOW_S) * LOGIN_WINDOW_S`, a quarter hour), and the worker
  // reads it per request: a run whose ten guesses straddled a quarter hour opened a fresh window before the eleventh call,
  // which went through (CI on #997's head, "200 !== 429"). The clock is held at NOW - a window's first second - for the
  // whole test, as accountworker.test.js holds its own, so every call is judged in the one window the bound speaks of.
  t.mock.method(Date, 'now', () => NOW * 1000);
  const { call } = await stand();
  const me = (await call('/v1/auth/guest', { ...ACCEPTED })).body;
  const reg = (await call('/v1/auth/register', { handle: 'Medora', password: 'the right one', ...ACCEPTED, set: true }, me.secret)).body;
  const both = await Promise.all([
    call('/v1/account/recovery-codes', { password: 'the right one', code: reg.recoveryCodes[0] }, me.secret),
    call('/v1/account/recovery-codes', { password: 'the right one', code: reg.recoveryCodes[1] }, me.secret),
  ]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], 'two presses both answered a set');
  assert.equal(both.find((r) => r.status === 409).body.error, 'codes-moved');
  const live = both.find((r) => r.status === 200).body.recoveryCodes;
  const race = await Promise.all([
    call('/v1/auth/recover', { handle: 'Medora', code: live[0], password: 'new password one', set: true }),
    call('/v1/auth/recover', { handle: 'Medora', code: live[1], password: 'new password two', set: true }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  assert.equal(race.find((r) => r.status === 409).body.error, 'codes-moved', 'a right code that lost the race was told it was wrong');
  assert.ok(!/username|wrong|match/i.test(accountRefusalText('codes-moved')), 'the race word reads as a wrong code');
  const signedIn = race.find((r) => r.status === 200).body;
  for (let i = 0; i < LOGIN_MAX; i++) await call('/v1/account/recovery-codes', { password: `guess ${i}`, code: live[2] }, signedIn.secret);
  assert.equal((await call('/v1/account/recovery-codes', { password: 'new password one', code: live[2] }, signedIn.secret)).status, 429);
});

// ── A2: A BUILD FROM BEFORE THE SET IS ANSWERED AS ACC1c ANSWERED IT ───

test('AUDIT RECOVERY-SET A2: a build from before the set asks for nothing and is minted the ONE code it can show, at the password\'s cost; recovering, it is handed one new code that replaces whatever the row held - never a set it cannot show (mutants: the flag ignored at register; at recover)', async () => {
  const { ctx, id, reg } = await registered({ set: false });
  assert.deepEqual(Object.keys(reg).sort(), ['handle', 'recoveryCode']);
  assert.equal(parseStored(rowOf(ctx, id).recovery_hash)?.iters, PBKDF2_ITERS, 'a build from before was minted a set it can show one of');
  assert.equal(accountView(rowOf(ctx, id), NOW).recoveryLeft, 1);
  // its player later on a build with the set, then back on the old build: the old build recovers with a code of the set
  const made = await newRecoveryCodes(ctx, rowOf(ctx, id), { password: 'a good long one', code: reg.recoveryCode });
  const back = await recover(ctx, { handle: 'Nystul', code: made.recoveryCodes[0], password: 'from the old build' });
  assert.equal(typeof back.recoveryCode, 'string', 'the old build was shown nothing');
  assert.equal(back.recoveryCodes, undefined);
  assert.equal(back.codesLeft, undefined);
  assert.equal(accountView(rowOf(ctx, id), NOW).recoveryLeft, 1, 'a set it cannot show was left standing');
  assert.equal((await recover(ctx, { handle: 'Nystul', code: back.recoveryCode, password: 'and again from it' })).id, id, 'the code it was shown does not work');
  // and the route reads the ask only as `true`
  assert.match(src('server-account/src/index.js'), /legal: \{ terms: body\.terms, privacy: body\.privacy \}, set: body\.set === true \}\)/);
  assert.match(src('server-account/src/index.js'), /password: body\.password, set: body\.set === true \}\)/);
});

test('AUDIT RECOVERY-SET A2 C1: THIS build asks for the set at register and at recover, and the shape the service mints - eight codes and the handle - is what the card shows, for the account as the row names it (mutants: the ask unsent; the register shown one code of eight; whose unset)', async () => {
  const set = mintRecoverySet(rand);
  const calls = [];
  const answers = {
    '/v1/auth/guest': { body: { id: 'p1', name: 'Helpar Enakis', kind: 'guest', sessionId: 's1', secret: 'sec-one' } },
    '/v1/auth/register': { body: { recoveryCodes: set, handle: 'Nystul' } },
  };
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '').replace(/^https?:\/\/[^/]+/, '');
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null });
    return { ok: true, status: 200, json: async () => answers[path].body };
  };
  const m = new Map();
  const flow = AccountFlow({ io: { fetch }, storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } });
  await flow.start();
  flow.go('register');
  for (const [k, v] of [['handle', 'nystul'], ['password', 'correcthorse'], ['confirm', 'correcthorse']]) flow.set(k, v);
  flow.agree('terms', true); flow.agree('privacy', true);
  await flow.submit();
  assert.equal(calls.find((c) => c.path === '/v1/auth/register').body.set, true, 'this build did not ask for the set');
  assert.deepEqual(flow.recoveryCodes, set, 'the card showed fewer than the service minted');
  assert.equal(flow.codesFor, 'Nystul', 'the saved file names the typing, not the account');
  assert.match(src('src/net/accountClient.js'), /call\(io, '\/v1\/auth\/recover', \{ handle, code, password, set: true \}\)/, 'recover does not ask for the set');
});

// ── A5, C5, C11 ───────────────────────────────────────────────────────

test('AUDIT RECOVERY-SET A5: a code of a set is derived at NIST SP 800-63B\'s "typically at least 10,000", not parseStored\'s floor', () => {
  assert.equal(RECOVERY_CODE_ITERS, 10_000);
});

test('AUDIT RECOVERY-SET C5: THE SAME WORK, WHERE RECOVER DOES IT - a handle nobody holds, a guest-shaped handle and a wrong code for a real set each cost one derivation at the password\'s cost and eight at the code\'s, read off a spy through recover itself (mutants: the derivations skipped when there is no row)', async () => {
  const { ctx } = await registered();
  const spy = () => {
    const iters = [];
    return { iters, subtle: { importKey: (...a) => subtle.importKey(...a), deriveBits: (alg, ...r) => { iters.push(alg.iterations); return subtle.deriveBits(alg, ...r); }, digest: (...a) => subtle.digest(...a) } };
  };
  const want = [PBKDF2_ITERS, ...Array(RECOVERY_SET_SIZE).fill(RECOVERY_CODE_ITERS)];
  for (const [what, handle] of [['nobody', 'NobodyAtAll'], ['a real set, a wrong code', 'Nystul']]) {
    const s = spy();
    const r = await recover({ ...ctx, subtle: s.subtle }, { handle, code: mintRecoverySet(rand, 1)[0], password: 'some new password', set: true });
    assert.equal(r.error, 'bad-code');
    assert.deepEqual(s.iters.sort((a, b) => b - a), want, `${what}: the clock tells which handles exist`);
  }
});

test('AUDIT RECOVERY-SET C11: a guest\'s view counts NO codes - null, not none left (mutants: a guest read as zero)', async () => {
  const ctx = ctxOf(d1());
  const g = await createGuest(ctx, {});
  assert.equal(accountView(rowOf(ctx, g.id), NOW).recoveryLeft, null);
  assert.equal(recoveryLeft(null), null);
});

// ── THE CARD: B1, B4, B7, C2, C9 ─────────────────────────────────────

function fakeDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', disabled: false, children: [], attrs: {},
      append: (...kids) => n.children.push(...kids.filter(Boolean)),
      setAttribute: (k, v) => { n.attrs[k] = String(v); },
      click: () => { n.clicked = true; },
      remove: () => { n.removed = true; },
      get text() { return [n.textContent, ...n.children.map((c) => c.text)].filter(Boolean).join(' '); },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  const made = [];
  return { createElement: (tag) => { const n = mk(tag); made.push(n); return n; }, body: mk('body'), made };
}
const SET = mintRecoverySet(rand);
function cardWith(script = {}, { onClose = () => {} } = {}) {
  const doc = fakeDoc();
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '').replace(/^https?:\/\/[^/]+/, '');
    const a = script[path];
    if (!a) throw new Error(`no answer for ${path}`);
    if (a.hang) return new Promise(() => {});
    return { ok: (a.status ?? 200) < 400, status: a.status ?? 200, json: async () => a.body };
  };
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'p1', name: 'Nystul', kind: 'linked', sessionId: 's1', secret: 'sec-one' })]]);
  const flow = AccountFlow({ io: { fetch }, storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } });
  const card = accountCard(doc, flow, { onClose });
  return { doc, flow, card };
}
const buttons = (card) => card.root.all.filter((n) => n.tag === 'button');

test('AUDIT RECOVERY-SET B1 C8: in its host - a Close passed - the code stage offers NO Close, and Close is held while a press is out; the menu holds the window open over codes and keeps one flow per window (mutants: Close on the code stage; Close live while busy; the window closed over codes; the flow built per render)', () => {
  const { flow, card } = cardWith();
  flow.stage = 'code';
  flow.recoveryCodes = SET;
  card.paint();
  assert.deepEqual(buttons(card).map((b) => b.textContent), ['Copy', 'Save as a file', 'I have written them down'], 'a second way off the code stage');
  flow.stage = 'codes';
  flow.busy = true;
  card.paint();
  assert.equal(buttons(card).find((b) => b.textContent === 'Close')?.disabled, true, 'Close live while a set is being made');
  flow.busy = false;
  card.paint();
  assert.equal(buttons(card).find((b) => b.textContent === 'Close')?.disabled, false);

  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const accountMayClose = \(\) => !acctFlow \|\| \(acctFlow\.stage !== 'code' && !acctFlow\.busy\);\nfunction closeAccount\(\) \{\n  if \(!accountMayClose\(\)\) return;/);
  // every door out of the window is that one: its Close, a tap outside (both hosts), Escape
  assert.match(menu, /onClose: closeAccount,/);
  assert.equal((menu.match(/closeOnOutsideTap\(home, '\.px-(acct)?win', closeAccount\);/g) ?? []).length, 2);
  assert.match(menu, /const back = accountOpen \? \(\) => closeAccount\(\)/);
  assert.doesNotMatch(menu, /accountOpen = false; render\(\);/, 'a door closes the window around closeAccount');
  // the flow is the window's: built when there is none, started once, kept across renders, dropped with the window
  assert.match(menu, /const fresh = !acctFlow;\n  if \(fresh\) \{\n    acctFlow = AccountFlow\(\{/);
  assert.match(menu, /if \(fresh\) Promise\.resolve\(acctFlow\.start\(\)\)\.catch\(\(\) => \{\}\);/);
});

test('AUDIT RECOVERY-SET C2 B4: the codes are dropped the moment they are acknowledged (not when the account read returns) and by any move off the stage; a sentence about them is said only while they are up, and leaves with them (mutants: the acknowledgement keeps them; go keeps them; say off the stage; the note outlives them)', async () => {
  const { flow } = cardWith({ '/v1/account': { hang: true } });
  flow.stage = 'code';
  flow.recoveryCodes = SET;
  flow.codesFor = 'Nystul';
  flow.say('Copied.');
  assert.equal(flow.note, 'Copied.');
  const p = flow.acknowledgeCode();
  assert.equal(flow.recoveryCodes, null, 'the codes stayed in memory while the account was read');
  assert.equal(flow.codesFor, '');
  assert.equal(flow.note, '', '"Copied." was said on the card after the codes');
  flow.say('late clipboard', true);
  assert.equal(flow.error, '', 'a clipboard answering after the codes left spoke on the next card');
  void p;
  const two = cardWith();
  two.flow.stage = 'code';
  two.flow.recoveryCodes = SET;
  two.flow.go('in');
  assert.equal(two.flow.recoveryCodes, null, 'a move off the stage kept the codes');
});

test('AUDIT RECOVERY-SET C9 B7: the card numbers the codes as the file does; Copy and Save as a file each say why when they cannot; the file is plain text whose URL is freed and whose link is removed; "Saving as", since a save can be cancelled (mutants: unnumbered; a refusal unsaid; the URL kept; the link left; untyped)', async () => {
  const { doc, flow, card } = cardWith();
  flow.stage = 'code';
  flow.recoveryCodes = SET;
  flow.codesFor = 'Nystul';
  card.paint();
  const lis = card.root.all.filter((n) => n.tag === 'li').map((li) => li.text);
  assert.deepEqual(lis, SET.map((c, i) => `${i + 1}. ${c}`));
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const { createObjectURL, revokeObjectURL } = URL;
  const realTimeout = globalThis.setTimeout;
  try {
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => { throw new Error('denied'); } } }, configurable: true });
    await buttons(card).find((b) => b.textContent === 'Copy').onclick();
    assert.match(flow.error, /blocked copying to the clipboard/, 'a refused copy said nothing');
    card.paint();
    URL.createObjectURL = () => { throw new Error('no blobs here'); };
    buttons(card).find((b) => b.textContent === 'Save as a file').onclick();
    assert.match(flow.error, /could not be saved/, 'a refused save said nothing');
    card.paint();
    let blob = null; const revoked = []; const timers = [];
    URL.createObjectURL = (b) => { blob = b; return 'blob:codes'; };
    URL.revokeObjectURL = (u) => revoked.push(u);
    globalThis.setTimeout = (fn) => { timers.push(fn); return 0; };
    buttons(card).find((b) => b.textContent === 'Save as a file').onclick();
    assert.equal(blob.type, 'text/plain');
    const link = doc.made.filter((n) => n.tag === 'a').at(-1);
    assert.ok(link.clicked && link.removed, 'the link was left in the page');
    for (const fn of timers) fn();
    assert.deepEqual(revoked, ['blob:codes'], 'the file\'s URL was never freed');
    assert.equal(flow.note, 'Saving as dfo-recovery-codes-nystul.txt.');
  } finally {
    URL.createObjectURL = createObjectURL; URL.revokeObjectURL = revokeObjectURL; globalThis.setTimeout = realTimeout;
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator;
  }
});

test('AUDIT RECOVERY-SET C9: a new set\'s answer with no codes in it is a refusal, not an empty plaque; a recovery whose account read fails says that and not the count; the codes press is held while busy (mutants: the empty answer shown; the count over a refusal; the press live while busy)', async () => {
  const empty = cardWith({ '/v1/account': { body: { account: { name: 'Nystul', handle: 'Nystul', kind: 'linked', recoveryLeft: 8 } } }, '/v1/account/recovery-codes': { body: { codesLeft: 8 } } });
  await empty.flow.start();
  empty.flow.go('codes');
  empty.flow.set('oldPassword', 'my password here');
  empty.flow.set('code', SET[0]);
  await empty.flow.submit();
  assert.equal(empty.flow.stage, 'codes');
  assert.equal(empty.flow.error, accountRefusalText('server'));

  const blip = cardWith({ '/v1/auth/recover': { body: { id: 'p1', name: 'Nystul', sessionId: 's2', secret: 'sec-two', codesLeft: 6 } }, '/v1/account': { status: 503, body: { error: 'server' } } });
  blip.flow.go('recover');
  for (const [k, v] of [['handle', 'Nystul'], ['code', SET[0]], ['password', 'brandnewpassword'], ['confirm', 'brandnewpassword']]) blip.flow.set(k, v);
  await blip.flow.submit();
  assert.equal(blip.flow.stage, 'in');
  assert.ok(blip.flow.error, 'the read failed and nothing was said');
  assert.equal(blip.flow.note, '', 'the count was said over a refusal');

  const busy = cardWith();
  busy.flow.stage = 'in';
  busy.flow.account = { name: 'Nystul', handle: 'Nystul', kind: 'linked', recoveryLeft: 3 };
  busy.flow.busy = true;
  busy.card.paint();
  assert.equal(buttons(busy.card).find((b) => b.textContent === 'Make new codes')?.disabled, true);
});

// ── B2 / C10: ONE LINE A CODE, AT EVERY WIDTH ──────────────────────────

const ruleIn = (css, media, selector) => {
  const at = media ? css.indexOf(`@media (${media}) {`) : 0;
  assert.ok(at >= 0, `no @media (${media})`);
  const from = css.indexOf(`${selector} {`, at);
  assert.ok(from >= 0, `no ${selector} under ${media ?? 'the sheet'}`);
  return css.slice(from, css.indexOf('}', from));
};
test('AUDIT RECOVERY-SET B2 C10: each code of a set keeps to one line on a phone AND above one - the single code\'s wide tracking broke a code before its last letter at 421-480px and on the desktop window - in one column, the window never being wide enough for two (mutants: nowrap gone on a phone; above one; two columns promised)', () => {
  assert.match(ruleIn(ENHANCED_CSS, 'max-width: 420px', '.card .acctcode li code'), /white-space: nowrap;/);
  const above = ruleIn(ENHANCED_CSS, 'min-width: 421px', '.card .acctcode li code');
  assert.match(above, /white-space: nowrap;/);
  assert.match(above, /letter-spacing: 0\.06em;/);
  assert.match(above, /font-size: min\(21px, 4\.2vw\);/);
  assert.doesNotMatch(ruleIn(ENHANCED_CSS, null, '.card .acctcode ol'), /auto-fit|grid-template-columns/);
});
