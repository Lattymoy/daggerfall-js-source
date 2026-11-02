// DEV-SIGNUP (2026-11-02): a dev server opens new accounts only for an invite code from its SIGNUP_CODES; unset (live)
// changes nothing. The register form draws the code box once that server asks for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { ACCEPTED } from '../../src/net/legalLaw.js';
import { signupCodeRefusal } from '../../server-account/src/accounts.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import worker from '../../server-account/src/index.js';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

function service(extra = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of readdirSync(new URL('server-account/migrations/', ROOT)).filter((f) => f.endsWith('.sql')).sort()) db.exec(read(`server-account/migrations/${f}`));
  const DB = {
    prepare(sql) {
      const stmt = db.prepare(sql); let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
  const env = { DB, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', ...extra };
  const call = async (body) => {
    const res = await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
    return { status: res.status, body: await res.json() };
  };
  return { call, rows: () => db.prepare('SELECT * FROM players').all() };
}

test('DEV-SIGNUP the law: no codes is no gate; a listed code (trimmed) passes; a missing, wrong or prefix code is refused', () => {
  assert.equal(signupCodeRefusal({}, {}), null);
  assert.equal(signupCodeRefusal({ SIGNUP_CODES: ' , ' }, {}), null);
  const env = { SIGNUP_CODES: 'alpha-1, beta-2' };
  assert.equal(signupCodeRefusal(env, { invite: 'beta-2' }), null);
  assert.equal(signupCodeRefusal(env, { invite: ' alpha-1 ' }), null);
  for (const invite of [undefined, '', 'alpha', 'alpha-12', 'gamma', 42]) assert.deepEqual(signupCodeRefusal(env, { invite }), { error: 'invite' }, String(invite));
});

test('DEV-SIGNUP the route: a gated service writes no row without a code and opens one with it; live (unset) opens as before', async () => {
  const gated = service({ SIGNUP_CODES: 'tester-7' });
  assert.deepEqual(await gated.call({ label: 'x', ...ACCEPTED }), { status: 403, body: { error: 'invite' } });
  assert.equal((await gated.call({ label: 'x', ...ACCEPTED, invite: 'nope' })).status, 403);
  assert.equal(gated.rows().length, 0, 'a refused request wrote a row');
  assert.equal((await gated.call({ label: 'x', ...ACCEPTED, invite: 'tester-7' })).status, 200);
  assert.equal(gated.rows().length, 1);
  assert.equal((await service().call({ label: 'x', ...ACCEPTED })).status, 200, 'no SIGNUP_CODES: no gate');
});

test('DEV-SIGNUP the form: no code box until the service asks; then the typed code goes with the next press, and the refusal has its own words', async () => {
  const bodies = [];
  const fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ error: 'invite' }), { status: 403, headers: { 'content-type': 'application/json' } });
  };
  const flow = AccountFlow({ io: { fetch }, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  flow.go('register');
  assert.equal(flow.inviteAsked, false);
  flow.set('handle', 'Nystul'); flow.set('password', 'a good long one'); flow.set('confirm', 'a good long one');
  flow.agree('terms', true); flow.agree('privacy', true);
  assert.equal(await flow.submit(), false);
  assert.equal(flow.inviteAsked, true);
  assert.equal(flow.error, REFUSALS.invite);
  assert.equal('invite' in bodies[0], false, 'nothing typed, nothing sent');
  flow.set('invite', ' tester-7 ');
  await flow.submit();
  assert.equal(bodies.at(-1).invite, 'tester-7');
});
