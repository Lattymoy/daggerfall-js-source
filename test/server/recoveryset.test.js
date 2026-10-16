// RECOVERY-SET (2026-10-14) - EIGHT RECOVERY CODES, EACH SPENT ALONE, AND A NEW SET FROM THE PROFILE.
//
// The request: "I want players to be able to click and see their account recovery code in their profile instead of it
// being a one off thing" - and, of the three ways offered, "Lets just do #1": a set of codes the profile shows how many
// are left of and can replace, behind the password, with copy and save-as-a-file. The service still keeps only hashes
// (server-account/src/password.js RECOVERY-SET), so what the profile shows is a NEW set, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { ROUTES } from '../../server-account/src/service.js';
import { createGuest, register, recover, newRecoveryCodes, accountView, LOGIN_MAX } from '../../server-account/src/accounts.js';
import {
  hashPassword, codeForHashing, mintRecoverySet, hashRecoverySet, joinRecoverySet, parseRecoverySet, recoveryLeft,
  matchRecoveryCode, RECOVERY_SET_SIZE, RECOVERY_CODE_ITERS, PBKDF2_ITERS,
} from '../../server-account/src/password.js';
import { AccountFlow, STAGES, FIELDS, codesOf, recoveryCodesText, recoveryCodesFileName } from '../../src/ui/accountFlow.js';
import { accountCard, STAGE_COPY, STAGE_ACTS } from '../../src/ui/enhanced/enhancedAccount.js';
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
const ctxOf = (db) => ({ db, subtle, rand, nowS: NOW });
const rowOf = (ctx, id) => ctx.db._raw.prepare('SELECT * FROM players WHERE id = ?').get(id);

/** A registered account: its id, its row's codes as shown, and the ctx. */
async function registered(handle = 'Nystul', password = 'a good long one') {
  const ctx = ctxOf(d1());
  const g = await createGuest(ctx, {});
  const reg = await register(ctx, g.id, { handle, password, set: true });   // a build that has the set asks for it
  return { ctx, id: g.id, codes: reg.recoveryCodes, reg, password };
}

// ── THE LAW (password.js) ────────────────────────────────────────────

test('RECOVERY-SET: a set is eight minted codes, each salted on its own, and the column reads back as eight (mutants: the size; one salt; the tag)', async () => {
  assert.equal(RECOVERY_SET_SIZE, 8);
  const codes = mintRecoverySet(rand);
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8, 'a code twice');
  for (const c of codes) assert.ok(codeForHashing(c), `${c} is not a code`);
  const stored = await hashRecoverySet(codes, { subtle, rand });
  assert.match(stored, /^codes,pbkdf2-sha256\$10000\$/, 'the column names what it holds, at the code\'s cost');   // PIN MOVED: AUDIT RECOVERY-SET A5 - NIST's 10,000
  const set = parseRecoverySet(stored);
  assert.equal(set.length, 8);
  assert.equal(new Set(set.map((h) => h.split('$')[2])).size, 8, 'two codes share a salt');
  assert.equal(recoveryLeft(stored), 8);
  assert.equal(joinRecoverySet(set), stored, 'the column is the set joined - one form both ways');
});

test('RECOVERY-SET: how many codes a row still opens - a set\'s count, ONE for a code from before the set, none for a guest or garbage (mutants: the single code counted as none; a broken set counted)', async () => {
  const one = await hashPassword(codeForHashing(mintRecoverySet(rand, 1)[0]), { subtle, rand }, 10_000);
  assert.equal(recoveryLeft(one), 1, 'a code from before the set (ACC1c, RECOVER-OP) still opens the account');
  assert.equal(recoveryLeft(null), null);
  assert.equal(recoveryLeft(''), null);
  assert.equal(recoveryLeft('codes,'), null, 'an empty set is not a set');
  assert.equal(recoveryLeft(`codes,${one},not-a-hash`), null, 'a set with a hash this service never wrote is not one');
  assert.equal(parseRecoverySet(one), null, 'a single code is not a set');
});

test('RECOVERY-SET: each code of the set opens it, the match answers the OTHERS, and a wrong code, a non-code or a guest\'s row opens nothing (mutants: rest keeps the spent one; a non-code matches; a throwaway slot matches)', async () => {
  const codes = mintRecoverySet(rand);
  const stored = await hashRecoverySet(codes, { subtle, rand });
  const set = parseRecoverySet(stored);
  for (let i = 0; i < codes.length; i++) {
    const m = await matchRecoveryCode(codeForHashing(codes[i].toLowerCase()), stored, { subtle });
    assert.equal(m.ok, true, `code ${i + 1} does not open it`);
    assert.deepEqual(m.rest, set.filter((_, j) => j !== i), `code ${i + 1}: the rest is not the others`);
  }
  const stranger = mintRecoverySet(rand, 1)[0];
  assert.deepEqual(await matchRecoveryCode(codeForHashing(stranger), stored, { subtle }), { ok: false, rest: null });
  assert.deepEqual(await matchRecoveryCode(null, stored, { subtle }), { ok: false, rest: null }, 'a typo opened it');
  assert.deepEqual(await matchRecoveryCode(codeForHashing(codes[0]), null, { subtle }), { ok: false, rest: null }, 'a guest\'s row opened');
  // the single code from before the set still opens as itself, and has no rest
  const one = await hashPassword(codeForHashing(stranger), { subtle, rand }, 10_000);
  assert.deepEqual(await matchRecoveryCode(codeForHashing(stranger), one, { subtle }), { ok: true, rest: null });
  // AUDIT-PW P1 holds for the set: a code that does not canonicalise is refused, never hashed as the empty string
  await assert.rejects(() => hashRecoverySet(['NOT-A-CODE'], { subtle, rand }), /empty credential/);
});

test('RECOVERY-SET: THE SAME WORK FOR EVERY ROW - a set, a single code and no row at all each cost one derivation at the password\'s cost and eight at the code\'s (mutants: the throwaway skipped for a set; the slots only the set\'s; a throwaway at the password\'s cost)', async () => {
  const spy = () => {
    const iters = [];
    return {
      iters,
      subtle: {
        importKey: (...a) => subtle.importKey(...a),
        deriveBits: (alg, ...rest) => { iters.push(alg.iterations); return subtle.deriveBits(alg, ...rest); },
      },
    };
  };
  const codes = mintRecoverySet(rand);
  const set = await hashRecoverySet(codes, { subtle, rand });
  const one = await hashPassword(codeForHashing(codes[0]), { subtle, rand });
  const want = [PBKDF2_ITERS, ...Array(RECOVERY_SET_SIZE).fill(RECOVERY_CODE_ITERS)];
  for (const [what, stored, guess] of [['a set, the right code', set, codes[3]], ['a set, a wrong code', set, mintRecoverySet(rand, 1)[0]],
    ['a single code', one, codes[0]], ['no row', null, codes[0]], ['a typo', set, 'nonsense']]) {
    const s = spy();
    await matchRecoveryCode(codeForHashing(guess), stored, { subtle: s.subtle });
    assert.deepEqual(s.iters.sort((a, b) => b - a), want, `${what}: the clock tells which row this is`);
  }
});

// ── THE SERVICE (accounts.js) ────────────────────────────────────────

test('RECOVERY-SET: registering for a build that asks answers the set and the handle (mutants: a single code minted; PIN MOVED, AUDIT RECOVERY-SET A2: a build from before the set is answered as ACC1c answered it - test/server/audit_recoveryset.test.js)', async () => {
  const { ctx, id, reg } = await registered();
  assert.equal(reg.recoveryCodes.length, RECOVERY_SET_SIZE);
  assert.equal(reg.handle, 'Nystul');
  assert.equal(reg.recoveryCode, undefined, 'a build that asked for the set was handed the old word too');
  assert.equal(recoveryLeft(rowOf(ctx, id).recovery_hash), RECOVERY_SET_SIZE);
  assert.equal(accountView(rowOf(ctx, id), NOW).recoveryLeft, RECOVERY_SET_SIZE, 'the profile\'s count');
});

test('RECOVERY-SET: each code is spent ALONE - seven left, six, ... - and the LAST mints a fresh eight, so a player is never left with none (mutants: every spend mints; the last leaves none; a spent code still opens)', async () => {
  const { ctx, id, codes } = await registered();
  for (let i = 0; i < codes.length - 1; i++) {
    const back = await recover(ctx, { handle: 'nystul', code: codes[i], password: `password number ${i}`, set: true });
    assert.equal(back.id, id, `code ${i + 1} was refused`);
    assert.equal(back.codesLeft, codes.length - 1 - i);
    assert.equal(back.recoveryCodes, undefined, 'a set with codes left minted another');
    assert.equal(accountView(rowOf(ctx, id), NOW).recoveryLeft, codes.length - 1 - i);
    assert.equal((await recover(ctx, { handle: 'Nystul', code: codes[i], password: 'a spent code here', set: true })).error, 'bad-code', `code ${i + 1} opened it twice`);
  }
  const last = await recover(ctx, { handle: 'Nystul', code: codes.at(-1), password: 'the last code spent', set: true });
  assert.equal(last.codesLeft, RECOVERY_SET_SIZE);
  assert.equal(last.recoveryCodes.length, RECOVERY_SET_SIZE, 'the last code left the player with none');
  assert.equal(last.handle, 'Nystul', 'AUDIT RECOVERY-SET B6: the handle as the row holds it, not as it was typed');
  assert.equal(accountView(rowOf(ctx, id), NOW).recoveryLeft, RECOVERY_SET_SIZE);
  for (const c of codes) assert.equal((await recover(ctx, { handle: 'Nystul', code: c, password: 'an old one here', set: true })).error, 'bad-code');
  assert.equal((await recover(ctx, { handle: 'Nystul', code: last.recoveryCodes[5], password: 'a fresh one works', set: true })).codesLeft, RECOVERY_SET_SIZE - 1);
});

test('RECOVERY-SET: a code from before the set (one PBKDF2 string - ACC1c, RECOVER-OP) opens the account as itself, and is replaced by a fresh set (mutants: the single code refused; no set minted for it)', async () => {
  const { ctx, id } = await registered();
  const old = mintRecoverySet(rand, 1)[0];
  ctx.db._raw.prepare('UPDATE players SET recovery_hash = ? WHERE id = ?').run(await hashPassword(codeForHashing(old), { subtle, rand }), id);
  assert.equal(accountView(rowOf(ctx, id), NOW).recoveryLeft, 1);
  const back = await recover(ctx, { handle: 'Nystul', code: old, password: 'from the old code', set: true });
  assert.equal(back.id, id);
  assert.equal(back.recoveryCodes.length, RECOVERY_SET_SIZE);
  assert.equal(recoveryLeft(rowOf(ctx, id).recovery_hash), RECOVERY_SET_SIZE);
});

test('RECOVERY-SET: a NEW set from the profile - the password and one current code (AUDIT RECOVERY-SET A1), the old set dead, the new one live, no device signed out (mutants: no password asked; the old set kept; a wrong password answered codes)', async () => {
  const { ctx, id, codes, password } = await registered();
  const sessions = () => ctx.db._raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?').get(id).n;
  const before = sessions();
  const was = rowOf(ctx, id).recovery_hash;
  assert.deepEqual(await newRecoveryCodes(ctx, rowOf(ctx, id), { password: 'not the password', code: codes[0] }), { error: 'bad-login' });
  assert.equal(rowOf(ctx, id).recovery_hash, was, 'a wrong password moved the set');
  const made = await newRecoveryCodes(ctx, rowOf(ctx, id), { password, code: codes[4] });
  assert.equal(made.recoveryCodes.length, RECOVERY_SET_SIZE);
  assert.equal(made.codesLeft, RECOVERY_SET_SIZE);
  assert.ok(made.recoveryCodes.every((c) => !codes.includes(c)), 'the new set repeats the old');
  assert.equal(sessions(), before, 'making codes signed a device out');
  for (const c of codes) assert.equal((await recover(ctx, { handle: 'Nystul', code: c, password: 'an old code here', set: true })).error, 'bad-code', 'the old set still opens it');
  assert.equal((await recover(ctx, { handle: 'Nystul', code: made.recoveryCodes[2], password: 'a new code works', set: true })).codesLeft, RECOVERY_SET_SIZE - 1);
});

test('RECOVERY-SET: the password guess spends LOGIN\'s bucket, a guest has no codes to make, and two presses racing cannot both answer a set (mutants: no rate; the write unguarded)', async () => {
  const { ctx, id, password, codes } = await registered();
  const stale = rowOf(ctx, id);
  assert.ok((await newRecoveryCodes(ctx, stale, { password, code: codes[0] })).recoveryCodes);
  assert.deepEqual(await newRecoveryCodes(ctx, stale, { password, code: codes[1] }), { error: 'codes-moved' }, 'the second press answered codes the first one\'s write already replaced');
  assert.ok(accountRefusalText('codes-moved') && !/codes-moved/.test(accountRefusalText('codes-moved')), 'a player meets codes-moved as a sentence');
  for (let i = 0; i < LOGIN_MAX; i++) await newRecoveryCodes(ctx, rowOf(ctx, id), { password: `guess ${i}` });
  assert.deepEqual(await newRecoveryCodes(ctx, rowOf(ctx, id), { password }), { error: 'rate' }, 'the password ground through this door without limit');
  const guest = await createGuest(ctx, {});
  assert.deepEqual(await newRecoveryCodes(ctx, rowOf(ctx, guest.id), { password: 'anything at all' }), { error: 'not-registered' });
});

test('RECOVERY-SET: the route - behind a session, 200 with the set, 401 on a wrong password, named among the service\'s routes (mutants: the route gone; the status of a wrong password)', async () => {
  _resetKeyForTests();
  assert.ok(ROUTES.has('/v1/account/recovery-codes'));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const me = (await call('/v1/auth/guest', { ...ACCEPTED })).body;
  const reg = (await call('/v1/auth/register', { handle: 'Kithlan', password: 'the first one', ...ACCEPTED, set: true }, me.secret)).body;
  assert.equal(reg.recoveryCodes.length, RECOVERY_SET_SIZE, 'the route did not carry the ask for a set');
  assert.equal((await call('/v1/account/recovery-codes', { password: 'the first one', code: reg.recoveryCodes[0] })).status, 401, 'no session made codes');
  const wrong = await call('/v1/account/recovery-codes', { password: 'the wrong one', code: reg.recoveryCodes[0] }, me.secret);
  assert.deepEqual([wrong.status, wrong.body.error], [401, 'bad-login']);
  const noCode = await call('/v1/account/recovery-codes', { password: 'the first one', code: 'NOT-A-CODE' }, me.secret);
  assert.deepEqual([noCode.status, noCode.body.error], [401, 'bad-code'], 'AUDIT RECOVERY-SET A1: a password alone made a set');
  const made = await call('/v1/account/recovery-codes', { password: 'the first one', code: reg.recoveryCodes[3] }, me.secret);
  assert.equal(made.status, 200);
  assert.equal(made.body.recoveryCodes.length, RECOVERY_SET_SIZE);
  const view = await worker.fetch(new Request('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${me.secret}` } }), env);
  const acct = await view.json();
  assert.equal(acct.account.recoveryLeft, RECOVERY_SET_SIZE);
  for (const c of made.body.recoveryCodes) assert.ok(!JSON.stringify(acct).includes(c), 'the view ships a code');
});

// ── THE CARD'S FLOW (accountFlow.js) ─────────────────────────────────

function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}
function flowWith(script, seed = null) {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '').replace(/^https?:\/\/[^/]+/, '');
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null });
    const answer = script[path];
    if (!answer) throw new Error(`the fake service has no answer for ${path}`);
    return { ok: (answer.status ?? 200) < 400, status: answer.status ?? 200, json: async () => answer.body };
  };
  const storage = fakeStorage(seed);
  return { flow: AccountFlow({ io: { fetch }, storage }), calls, storage };
}
const SIGNED = { id: 'p1', name: 'Nystul', kind: 'linked', sessionId: 's1', secret: 'sec-one' };
const VIEW = { account: { id: 'p1', name: 'Nystul', handle: 'Nystul', kind: 'linked', recoveryLeft: 8 }, devices: [] };
const SET = ['AAAAA-AAAAA-AAAAA-AAAA1', 'AAAAA-AAAAA-AAAAA-AAAA2', 'AAAAA-AAAAA-AAAAA-AAAA3'];

test('RECOVERY-SET: the codes an answer carries - the set, or the one a service from before it answers, or none (mutants: the old word ignored; the set\'s junk kept)', () => {
  assert.deepEqual(codesOf({ recoveryCodes: SET, recoveryCode: SET[0] }), SET, 'the set outranks its first');
  assert.deepEqual(codesOf({ recoveryCode: 'OLD11-OLD22' }), ['OLD11-OLD22']);
  assert.deepEqual(codesOf({ recoveryCodes: ['X1', '', null, 7] }), ['X1']);
  assert.deepEqual(codesOf({ codesLeft: 6 }), []);
  assert.deepEqual(codesOf(null), []);
});

test('RECOVERY-SET: the profile\'s `codes` stage - the password and a current code (AUDIT RECOVERY-SET A1), the set shown once on `code` for whose it is, never written to storage (mutants: the stage gone; the password not sent; the code not sent; the codes kept)', async () => {
  assert.ok(STAGES.includes('codes'));
  assert.deepEqual(FIELDS.codes, ['oldPassword', 'code']);
  const { flow, calls, storage } = flowWith({ '/v1/account': { body: VIEW }, '/v1/account/recovery-codes': { body: { recoveryCodes: SET, codesLeft: 3 } } }, SIGNED);
  await flow.start();
  flow.go('codes');
  await flow.submit();
  assert.equal(flow.stage, 'codes', 'no password, and the card moved on');
  assert.ok(flow.error, 'no password, and nothing said');
  assert.equal(calls.filter((c) => c.path === '/v1/account/recovery-codes').length, 0, 'asked the service without a password');
  flow.set('oldPassword', 'my password here');
  await flow.submit();
  assert.equal(calls.filter((c) => c.path === '/v1/account/recovery-codes').length, 0, 'asked the service without a code');
  flow.set('code', ' aaaaa-aaaaa-aaaaa-aaaa9 ');
  await flow.submit();
  assert.deepEqual(calls.find((c) => c.path === '/v1/account/recovery-codes').body, { password: 'my password here', code: 'aaaaa-aaaaa-aaaaa-aaaa9' });
  assert.equal(flow.stage, 'code');
  assert.deepEqual(flow.recoveryCodes, SET);
  assert.equal(flow.codesFor, 'Nystul', 'the saved file names nobody');
  assert.ok(![...storage._map.values()].join('|').includes('AAAA1'), 'a code went to storage');
  await flow.acknowledgeCode();
  assert.equal(flow.recoveryCodes, null);
});

test('RECOVERY-SET: a wrong password stays on the stage and says so; the refusal is the service\'s sentence (mutants: the refusal swallowed)', async () => {
  const { flow } = flowWith({ '/v1/account': { body: VIEW }, '/v1/account/recovery-codes': { status: 401, body: { error: 'bad-login' } } }, SIGNED);
  await flow.start();
  flow.go('codes');
  flow.set('oldPassword', 'not my password');
  flow.set('code', 'AAAAA-AAAAA-AAAAA-AAAA1');
  await flow.submit();
  assert.equal(flow.stage, 'codes');
  assert.equal(flow.error, accountRefusalText('bad-login'));
  assert.equal(flow.recoveryCodes, null);
});

test('RECOVERY-SET: a recovery that leaves the set\'s others standing lands signed in and says how many are left; a fresh set lands on `code` (mutants: the count unsaid; an empty code stage)', async () => {
  const left = flowWith({ '/v1/auth/recover': { body: { ...SIGNED, codesLeft: 6 } }, '/v1/account': { body: VIEW } });
  await left.flow.start();
  left.flow.go('recover');
  for (const [k, v] of [['handle', 'Nystul'], ['code', 'AAAAA-AAAAA-AAAAA-AAAA1'], ['password', 'brandnewpassword'], ['confirm', 'brandnewpassword']]) left.flow.set(k, v);
  await left.flow.submit();
  assert.equal(left.flow.stage, 'in', 'an empty code stage');
  assert.match(left.flow.note, /6 recovery codes are left/);
  const fresh = flowWith({ '/v1/auth/recover': { body: { ...SIGNED, codesLeft: 8, recoveryCodes: SET, handle: 'Nystul' } }, '/v1/account': { body: VIEW } });
  await fresh.flow.start();
  fresh.flow.go('recover');
  for (const [k, v] of [['handle', 'nystul'], ['code', 'AAAAA-AAAAA-AAAAA-AAAA1'], ['password', 'brandnewpassword'], ['confirm', 'brandnewpassword']]) fresh.flow.set(k, v);
  await fresh.flow.submit();
  assert.equal(fresh.flow.stage, 'code');
  assert.deepEqual(fresh.flow.recoveryCodes, SET);
  assert.equal(fresh.flow.codesFor, 'Nystul', 'AUDIT RECOVERY-SET B6: the file names the account as the row does, not as it was typed');
});

test('RECOVERY-SET: the saved file - whose codes, the rule, a code a line numbered as the card numbers them; a name per account, nothing a path could hold (mutants: unnumbered; the name unsanitised)', () => {
  const text = recoveryCodesText('Nystul', SET);
  const lines = text.split('\n');
  assert.equal(lines[0], 'DFO Online recovery codes for Nystul');
  assert.match(lines[1], /works once/);
  assert.deepEqual(lines.slice(3, 6), ['1. AAAAA-AAAAA-AAAAA-AAAA1', '2. AAAAA-AAAAA-AAAAA-AAAA2', '3. AAAAA-AAAAA-AAAAA-AAAA3']);
  assert.equal(recoveryCodesFileName('Nystul'), 'dfo-recovery-codes-nystul.txt');
  assert.equal(recoveryCodesFileName('../evil/name'), 'dfo-recovery-codes-evilname.txt');
  assert.equal(recoveryCodesFileName(''), 'dfo-recovery-codes-account.txt');
});

// ── THE CARD (enhancedAccount.js) ────────────────────────────────────

function fakeDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', maxLength: 0, disabled: false, children: [], attrs: {},
      append: (...kids) => n.children.push(...kids.filter(Boolean)),
      setAttribute: (k, v) => { n.attrs[k] = String(v); },
      click: () => { n.clicked = true; },
      remove: () => {},
      get text() { return [n.textContent, ...n.children.map((c) => c.text)].filter(Boolean).join(' '); },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  const made = [];
  return { createElement: (tag) => { const n = mk(tag); made.push(n); return n; }, body: mk('body'), made };
}
const cardOf = () => {
  const doc = fakeDoc();
  const flow = AccountFlow({ io: { fetch: async () => { throw new Error('no network in this test'); } }, storage: fakeStorage() });
  return { doc, flow, card: accountCard(doc, flow) };
};
const buttons = (card) => card.root.all.filter((n) => n.tag === 'button');

test('RECOVERY-SET: the profile\'s Account section says how many codes are left and offers "Make new codes" beside it, which opens the stage - not in the window\'s foot (AUDIT RECOVERY-SET B3); a guest, or a service from before it, is offered neither (mutants: the row gone; the act gone; the row shown to a guest; the act offered an old service; the act in the foot)', () => {
  const { flow, card } = cardOf();
  flow.stage = 'in';
  flow.account = { name: 'Nystul', handle: 'Nystul', kind: 'linked', recoveryLeft: 5 };
  card.paint();
  const box = card.root.all.find((n) => n.className === 'acctwear acctrecovery');
  assert.ok(box, 'no codes row on the profile');
  assert.equal(box.text, 'Recovery codes 5 left Make new codes');
  const open = box.all.find((n) => n.tag === 'button');
  assert.equal(open?.textContent, 'Make new codes', 'no way to a new set from the profile');
  const foot = card.root.all.find((n) => n.className === 'acts');
  assert.deepEqual(foot.children.map((b) => b.textContent), ['Change password', 'Sign out', 'Sign out everywhere'], 'the foot grew a fifth press');
  open.onclick();
  assert.equal(flow.stage, 'codes');
  assert.ok(STAGE_COPY.codes.title && STAGE_ACTS.codes.submit && STAGE_ACTS.codes.back === 'in');
  assert.match(STAGE_COPY.codes.blurb, /one of your current recovery codes\. Those codes will stop working/i, 'what to type, and the one thing to know before pressing it, unsaid');

  const guest = cardOf();
  guest.flow.stage = 'in';
  guest.flow.account = { name: 'A B', handle: null, guestName: 'A B', kind: 'guest', recoveryLeft: null };
  guest.card.paint();
  assert.ok(!buttons(guest.card).some((b) => b.textContent === 'Make new codes'), 'a guest was offered codes it has none of');
  assert.ok(!guest.card.root.text.includes('left'), 'a guest was told how many codes it has left');

  // a service from before acct131 counts no codes, and has no route to make them: no row, no act
  const old = cardOf();
  old.flow.stage = 'in';
  old.flow.account = { name: 'Nystul', handle: 'Nystul', kind: 'linked' };
  old.card.paint();
  assert.ok(!buttons(old.card).some((b) => b.textContent === 'Make new codes'), 'an old service was offered a route it does not have');
  assert.ok(!old.card.root.all.some((n) => n.className === 'acctwear acctrecovery'));
  assert.ok(buttons(old.card).some((b) => b.textContent === 'Change password'));
});

test('RECOVERY-SET: on `code`, Copy puts the file\'s text on the clipboard and Save as a file downloads it under the account\'s name - and neither leaves the stage (mutants: copy writes nothing; save names no file)', async () => {
  const { doc, flow, card } = cardOf();
  flow.stage = 'code';
  flow.recoveryCodes = SET;
  flow.codesFor = 'Nystul';
  card.paint();
  let written = null;
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async (s) => { written = s; } } }, configurable: true });
  const urls = { created: 0 };
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = () => { urls.created++; return 'blob:codes'; };
  URL.revokeObjectURL = () => {};
  try {
    await buttons(card).find((b) => b.textContent === 'Copy').onclick();
    assert.equal(written, recoveryCodesText('Nystul', SET));
    assert.equal(flow.stage, 'code', 'Copy left the stage');
    assert.match(flow.note, /Copied/);
    card.paint();
    buttons(card).find((b) => b.textContent === 'Save as a file').onclick();
    const link = doc.made.find((n) => n.tag === 'a');
    assert.equal(link?.download, 'dfo-recovery-codes-nystul.txt');
    assert.equal(link.href, 'blob:codes');
    assert.ok(link.clicked, 'the file was never asked for');
    assert.equal(urls.created, 1);
    assert.equal(flow.stage, 'code', 'Save left the stage');
  } finally {
    URL.createObjectURL = createObjectURL; URL.revokeObjectURL = revokeObjectURL;
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator;
  }
});
