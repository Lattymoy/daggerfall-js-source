// FOUNDER6 (2026-10-09, Mac: "Everytime I try to grant the founder title to people they dont recieve it", with two
// account cards from the bug-reports channel, spragual's and SylviaBun's, each reading "Registered Sep 24, 2026").
// FOUNDER2 to FOUNDER5 each widened who HOLDS Founder, and since FOUNDER5 (acct92, 2026-09-25T12:00:00Z) both cards'
// accounts hold it on the live service. Holding is not wearing: nothing ever put Founder ON anybody, so a founder who
// never found Wardrobe > Title on the account card wore nothing, and nothing over their name said they had been granted
// anything. Now a row whose `title` is NULL - never chosen - wears Founder while it holds it (titles.js DEFAULT_TITLE,
// titleWorn), and taking a title off stores '' (accounts.js equipTitle), so a player who takes it off stays bare. And
// the two reporters are named in FOUNDER_HANDLES, so no date can leave them out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { titleWorn, wardrobeOf, isNamedFounder, DEFAULT_TITLE, FOUNDER_UNTIL } from '../server-account/src/titles.js';
import { verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { ACCEPTED } from '../src/net/legalLaw.js';

const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const OLD_CUT = Date.UTC(2026, 8, 25) / 1000;   // FOUNDER2's instant, 00:00Z
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── WORN BY DEFAULT ─────────────────────────────────────────────────

test('FOUNDER6 worn by default: a founder who never chose a title (NULL) wears Founder; one who took it off (\'\') wears none; a chosen title stands; a non-founder and a guest wear nothing by default (mutants: no default; the default unconditional)', () => {
  assert.equal(DEFAULT_TITLE, 'founder');
  const env = { DEVELOPER_HANDLES: 'dev' };
  const founder = { handle: 'Sylvia', created_at: OLD_CUT + 2 * HOUR, registered_at: OLD_CUT + 2 * HOUR, title: null };
  assert.equal(titleWorn(founder, env), 'founder', 'never chosen: Founder');
  assert.equal(titleWorn({ ...founder, title: undefined }, env), 'founder', 'a row read without the column is never chosen too');
  assert.equal(titleWorn({ ...founder, title: '' }, env), undefined, 'taken off: none');
  assert.equal(titleWorn({ ...founder, title: 'founder' }, env), 'founder', 'chosen: worn as before');
  assert.equal(titleWorn({ ...founder, handle: 'dev', title: 'developer' }, env), 'developer', 'another title chosen stands');
  assert.equal(titleWorn({ ...founder, title: 'developer' }, env), undefined, 'a chosen title lapsed is not swapped for the default');
  const late = { handle: 'Late', created_at: FOUNDER_UNTIL + DAY, registered_at: FOUNDER_UNTIL + DAY, title: null };
  assert.equal(titleWorn(late, env), undefined, 'not a founder: nothing by default');
  assert.equal(titleWorn({ ...late, handle: 'dev' }, env), undefined, 'a developer who never chose wears no developer title by default');
  assert.equal(titleWorn({ handle: null, created_at: OLD_CUT - DAY, registered_at: null, title: null }, env), undefined, 'a guest holds none, so wears none');
  assert.equal(wardrobeOf(founder, env, OLD_CUT + 14 * DAY).title, 'founder', 'the account card shows it worn');
  assert.equal(wardrobeOf({ ...founder, title: '' }, env, OLD_CUT + 14 * DAY).title, null, 'and taken off');
});

// ── THE NAMES ───────────────────────────────────────────────────────

test('FOUNDER6 the names: FOUNDER_HANDLES in wrangler.toml names spragual and SylviaBun - each holds Founder however late its rows say it played; the version moved to acct97 (mutant: the list emptied)', () => {
  const toml = src('server-account/wrangler.toml');
  const line = toml.match(/^FOUNDER_HANDLES = "([^"]*)"$/m);
  assert.ok(line, 'one FOUNDER_HANDLES line');
  const env = { FOUNDER_HANDLES: line[1] };
  for (const handle of ['spragual', 'SylviaBun']) {
    assert.equal(isNamedFounder({ handle }, env), true, `${handle} named`);
    assert.equal(titleWorn({ handle, created_at: FOUNDER_UNTIL + 9 * DAY, registered_at: FOUNDER_UNTIL + 9 * DAY, title: null }, env), 'founder', `${handle} wears it by default`);
  }
  assert.match(toml, /^ACCOUNT_VERSION = "acct97"$/m);
  assert.match(src('server-account/src/service.js'), /export const ACCOUNT_VERSION = 'acct97';/);
});

// ── THE SERVICE, end to end ─────────────────────────────────────────

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = []; for (const st of stmts) out.push(await st.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
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

test('FOUNDER6, end to end: a founder who never pressed a title wears Founder on the signed token the relay reads; taken off it stays off, and pressed again it is back; a non-founder signs none (mutant: taken off stored as NULL)', async () => {
  const { subtle } = globalThis.crypto;
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', FOUNDER_HANDLES: 'SylviaBun' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const signedTitle = async (secret) => {
    const got = await call('POST', '/v1/auth/token', { secret });
    assert.equal(got.status, 200);
    const r = await verifyToken(got.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(r.ok, r.why);
    return r.claims.t;
  };
  const worn = async (secret) => (await call('GET', '/v1/account', undefined, secret)).body.wardrobe.title;
  const account = async (handle, firstSeen = null) => {
    const g = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    if (firstSeen !== null) await env.DB.prepare('UPDATE players SET created_at = ? WHERE id = ?').bind(firstSeen, g.id).run();
    assert.equal((await call('POST', '/v1/auth/register', { handle, password: 'a-long-enough-password', ...ACCEPTED }, g.secret)).status, 200);
    return g.secret;
  };

  const evening = await account('spragual', OLD_CUT + 2 * HOUR);   // 10pm in New York on the 24th
  assert.equal(await worn(evening), 'founder', 'the account card shows Founder worn without a press');
  assert.equal(await signedTitle(evening), 'founder', 'and the relay signs it over the name');
  const off = await call('POST', '/v1/account/title', { title: null }, evening);
  assert.equal(off.status, 200);
  assert.equal(off.body.title, null);
  assert.equal(await worn(evening), null, 'taken off stays off');
  assert.equal(await signedTitle(evening), undefined, 'on the token too');
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, evening)).body.title, 'founder');
  assert.equal(await signedTitle(evening), 'founder', 'pressed again, back');

  const named = await account('SylviaBun');   // registered now, long past the cutoff: Founder by name alone
  assert.equal(await signedTitle(named), 'founder', 'a named founder wears it by default too');

  const nobody = await account('Latecomer');
  assert.equal(await worn(nobody), null, 'neither by date nor by name: nothing by default');
  assert.equal(await signedTitle(nobody), undefined);
});
