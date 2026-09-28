// RECOVER-OP (2026-09-27) - A NEW RECOVERY CODE, ISSUED BY THE OPERATOR, for a player who lost both the password and
// the code (Twoddle: "is there anyway this can be fixed without starting a new account as i would like to keep the
// founders badge?"). The operator sets only the new code's hash (tools/reissueRecoveryCode.mjs, run by
// .github/workflows/account-recovery.yml), and the player spends it in the game's own recovery: their own password, a
// new code, every device signed out, the operator's copy dead. Nothing else on the row moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { verifyPassword, codeForHashing } from '../server-account/src/password.js';
import { FOUNDER_UNTIL } from '../server-account/src/titles.js';
import { mintReissue, reissueSql } from '../tools/reissueRecoveryCode.mjs';

const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const TOOL = fileURLToPath(new URL('../tools/reissueRecoveryCode.mjs', import.meta.url));

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

test('RECOVER-OP end to end: the operator\'s code, set by the tool\'s own statement, lets the player back in through the game\'s own recovery - their password, a new code, the operator\'s copy and every old device dead, the Founder kept (mutants: the password set instead; the pretty code hashed; the handle as typed)', async () => {
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

  // A founder who registered, then lost the password AND the code - still signed in on this device.
  const me = (await call('POST', '/v1/auth/guest', {})).body;
  const firstSeen = FOUNDER_UNTIL - 5 * 86400;
  await env.DB.prepare('UPDATE players SET created_at = ? WHERE id = ?').bind(firstSeen, me.id).run();
  const reg = await call('POST', '/v1/auth/register', { handle: 'Twoddle', password: 'the-lost-password' }, me.secret);
  assert.equal(reg.status, 200);
  const lostCode = reg.body.recoveryCode;
  const before = (await call('GET', '/v1/account', undefined, me.secret)).body;
  assert.deepEqual(before.wardrobe.titles, ['founder']);

  // THE OPERATOR: a code minted, and the statement the workflow runs, typed in another case.
  const { code, hash } = await mintReissue({ subtle, rand });
  const changed = env.DB._raw.prepare(reissueSql('TWODDLE', hash)).all();
  assert.deepEqual(changed.map((r) => r.handle), ['Twoddle'], 'RETURNING names the one row it changed');
  assert.equal((await call('POST', '/v1/auth/login', { handle: 'Twoddle', password: 'the-lost-password' })).status, 200, 'the password is untouched until the player spends the code');
  assert.equal((await call('POST', '/v1/auth/recover', { handle: 'Twoddle', code: lostCode, password: 'a-brand-new-password' })).status, 401, 'the lost code is dead');

  // THE PLAYER: the game's own recovery, the code typed without its dashes and in lower case.
  const back = await call('POST', '/v1/auth/recover', { handle: 'twoddle', code: code.replaceAll('-', '').toLowerCase(), password: 'a-brand-new-password' });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.ok(back.body.recoveryCode && back.body.recoveryCode !== code, 'a new code the operator never saw');
  assert.equal((await call('POST', '/v1/auth/recover', { handle: 'Twoddle', code, password: 'another-new-password' })).status, 401, 'the operator\'s code is spent');
  assert.equal((await call('GET', '/v1/account', undefined, me.secret)).status, 401, 'every earlier device is signed out');
  assert.equal((await call('POST', '/v1/auth/login', { handle: 'Twoddle', password: 'the-lost-password' })).status, 401);
  assert.equal((await call('POST', '/v1/auth/login', { handle: 'Twoddle', password: 'a-brand-new-password' })).status, 200);

  const after = (await call('GET', '/v1/account', undefined, back.body.secret)).body;
  assert.equal(after.account.id, before.account.id, 'the same account');
  assert.equal(after.account.createdAt, firstSeen);
  assert.equal(after.account.registeredAt, before.account.registeredAt);
  assert.deepEqual(after.wardrobe.titles, ['founder'], 'and the Founder with it');
});

test('RECOVER-OP: the statement changes that account\'s recovery_hash and nothing else, finds it in any case, and a quote in a username is data, not SQL (mutants: the handle as typed; the quote not doubled)', async () => {
  const db = d1()._raw;
  db.exec('CREATE TABLE t (x INTEGER)');
  const add = db.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, password, recovery_hash, registered_at) VALUES (?, ?, ?, ?, 1, 2, ?, ?, ?)');
  add.run('a', 'Twoddle', 'twoddle', 'Guest One', 'pw-a', 'rc-a', 3);
  add.run('b', "O'Neil", "o'neil", 'Guest Two', 'pw-b', 'rc-b', 3);
  add.run('c', 'Other', 'other', 'Guest Three', 'pw-c', 'rc-c', 3);
  add.run('d', null, null, 'Guest Four', null, null, null);
  const snap = () => db.prepare('SELECT * FROM players ORDER BY id').all().map((r) => ({ ...r }));
  const was = snap();
  const { hash } = await mintReissue({ subtle, rand });

  assert.deepEqual(db.prepare(reissueSql('TWODDLE', hash)).all().map((r) => r.handle), ['Twoddle']);
  const now = snap();
  assert.equal(now[0].recovery_hash, hash);
  assert.deepEqual({ ...now[0], recovery_hash: 'rc-a' }, was[0], 'nothing else on the row');
  assert.deepEqual(now.slice(1), was.slice(1), 'and no other row');

  assert.deepEqual(db.prepare(reissueSql("o'NEIL", hash)).all().map((r) => r.handle), ["O'Neil"], 'a quote in a username is found, not a syntax error');
  assert.deepEqual(db.prepare(reissueSql('Nobody', hash)).all(), [], 'nobody by that name: no row, which the workflow refuses');
  assert.deepEqual(db.prepare(reissueSql("x';DROP/**/TABLE/**/t;--", hash)).all(), []);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 't'").get(), 'and a username shaped like SQL stays a username');
});

test('RECOVER-OP: the tool refuses anything that is not a username or not a hash exactly as it wrote one, and its code verifies against its hash (mutant: the hash form unchecked)', async () => {
  const { code, hash } = await mintReissue({ subtle, rand });
  assert.ok(await verifyPassword(codeForHashing(code), hash, { subtle }));
  assert.throws(() => reissueSql('Two ddle', hash), /not a username/);
  assert.throws(() => reissueSql('', hash), /not a username/);
  assert.throws(() => reissueSql(undefined, hash), /not a username/);
  assert.throws(() => reissueSql('Twoddle', code), /not a recovery-code hash/, 'the code itself is not a hash');
  assert.throws(() => reissueSql('Twoddle', `${hash}'`), /not a recovery-code hash/);
  assert.throws(() => reissueSql('Twoddle', hash.replace(/\$(?=[^$]*$)/, '$ ')), /not a recovery-code hash/, 'a space pasted into it: what is stored is exactly what the tool wrote');
  assert.throws(() => reissueSql('Twoddle', 'pbkdf2-sha256$100000$abc$def'), /not a recovery-code hash/);

  // THE COMMAND LINE, as the workflow and the operator run it.
  const sql = execFileSync(process.execPath, [TOOL, '--sql', 'Twoddle', hash], { encoding: 'utf8' });
  assert.equal(sql, `${reissueSql('Twoddle', hash)}\n`);
  const bad = spawnSync(process.execPath, [TOOL, '--sql', 'Two ddle', hash], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '', 'nothing for the workflow to run');
  const out = execFileSync(process.execPath, [TOOL, 'Twoddle'], { encoding: 'utf8' });
  const [, printed] = /\n {2}([0-9A-Z]{5}(?:-[0-9A-Z]{5}){3})\n/.exec(out) ?? [];
  const [, printedHash] = /\n {2}(pbkdf2-sha256\$\S+)\n/.exec(out) ?? [];
  assert.ok(printed && printedHash, out);
  assert.ok(await verifyPassword(codeForHashing(printed), printedHash, { subtle }), 'the printed code opens the printed hash');
});

test('RECOVER-OP the workflow: run by hand only, its inputs reach the scripts as environment and never spliced into a run line, the statement is the tool\'s, the deploy\'s queue, and a run that changed no row fails', () => {
  const wf = src('.github/workflows/account-recovery.yml');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(wf)?.[1] ?? '';
  assert.match(on, /^ {2}workflow_dispatch:/);
  assert.doesNotMatch(on, /push:|pull_request|schedule:/);
  assert.equal(wf.match(/\$\{\{ inputs\./g)?.length, 2, 'the two inputs, each read once');
  assert.match(wf, /\n {6}HANDLE: \$\{\{ inputs\.handle \}\}\n {6}HASH: \$\{\{ inputs\.hash \}\}\n/);
  assert.match(wf, /node tools\/reissueRecoveryCode\.mjs --sql "\$HANDLE" "\$HASH" > "\$RUNNER_TEMP\/reissue\.sql"/);
  assert.match(wf, /\nconcurrency:\n {2}group: account-deploy\n {2}cancel-in-progress: false\n/);
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.doesNotMatch(wf, /d1 create|migrations apply/, 'it creates and migrates nothing');
  assert.match(wf, /d1 execute "\$DB_NAME" --remote --json --command "\$\(cat "\$RUNNER_TEMP\/reissue\.sql"\)"/);
  assert.match(wf, /if \[ "\$n" != "1" \]; then\n\s+echo "::error::no registered account is named \$HANDLE - nothing was changed"\n\s+exit 1/);
  assert.match(wf, /never the code itself/);
});
