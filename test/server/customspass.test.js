// CUSTOMS-PASS (2026-09-29, the field - bible/01-Overview/bugs/Field-Bugs-2026-09-29b.md). Gryphoth's character was made and
// played online on a build from before the realm, after the census froze, so the realm never saw it before it began and
// customs refuses it - by the census law (L1-F5), and rightly. REALM-DOOR stops that happening again; for the characters
// it already happened to, Mac chose, asked: "Staff customs pass" - a developer grants ONE account a single-use pass, and
// that account's next Bring online of a character the census does not count is admitted once, through customs as any
// is (the loans called in, the wealth capped at the level's allowance). No self-service door: the census stays frozen
// for everyone else, and a pass never admits a character already in, from any account - so no Copy to offline comes
// back through one either.
//
// The real account Worker over the real migrations (test/server/fb0929_customs.test.js's face), and the tool a developer runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { r2, freshSave } from '../realmSeat.mjs';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { customsAllowance } from '../../src/net/realm/realmGoldLaw.js';
import { passRequest } from '../../tools/customsPass.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** The realm's start, as the census reads it (migration 0022): the commit that brought 0020 to main. */
const REALM_START_S = 1790638734;
/** Offline characters' ids, as CHARID1 mints them. */
const GRYPHOTH_ID = 'c3f0e7a2-5b1d-4e8f-9a6c-2d4b8e1f7a90';
const SECOND_ID = '8d1e4b77-0c2a-4f3e-b5d6-9a8c7e6f5d41';

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

async function stand() {
  _resetKeyForTests();
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', DEVELOPER_HANDLES: 'MacDev' };
  const call = async (path, body, secret) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const put = async (id, text, secret, { lease, seq }) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) }, body: text,
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const guest = async () => (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  /** A registered account under `handle`. */
  const registered = async (handle) => {
    const g = await guest();
    assert.equal((await call('/v1/auth/register', { secret: g.secret, handle, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200, handle);
    return { id: g.id, secret: g.secret, handle };
  };
  const rows = (sql, ...a) => env.DB._raw.prepare(sql).all(...a).map((r) => ({ ...r }));
  const exec = (sql, ...a) => env.DB._raw.prepare(sql).run(...a);
  const pass = (dev, body) => call('/v1/mod/customs-pass', body, dev.secret);
  const customs = (who, origin, level = 3) => call('/v1/realm/customs', { origin, name: 'Carried', summary: { level } }, who.secret);
  /** A census trace from before the realm (0022's cloud backup), for a character the census counts. */
  const counted = (who, charId) => {
    exec('INSERT INTO saves (player_id, character_id, save_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', who.id, charId, 'QuickSave', REALM_START_S - 60, REALM_START_S - 60);
    exec('INSERT OR IGNORE INTO realm_census (player, char_id) VALUES (?, ?)', who.id, charId);
  };
  return { env, call, put, guest, registered, rows, exec, pass, customs, counted };
}

test('CUSTOMS-PASS, the field: a developer grants Gryphoth\'s account a pass by its handle, and his character the census never counted comes in once, through customs as any does - the pass spent on it, and the next such character refused as before (mutants: the pass not spent; the pass ignored by customs)', async () => {
  const s = await stand();
  const dev = await s.registered('MacDev');
  const gryphoth = await s.registered('Gryphoth');
  assert.deepEqual([(await s.customs(gryphoth, GRYPHOTH_ID)).status, (await s.customs(gryphoth, GRYPHOTH_ID)).body], [403, { error: 'customs-never-online' }], 'the field: refused, the census never saw him');
  const granted = await s.pass(dev, { name: 'gryphoth' });
  assert.deepEqual([granted.status, granted.body], [200, { ok: true, target: gryphoth.id, name: 'Gryphoth', open: true, changed: true }], 'a handle is case-folded, as the unique index is');
  assert.deepEqual((await s.pass(dev, { name: 'Gryphoth' })).body, { ok: true, target: gryphoth.id, name: 'Gryphoth', open: true, changed: false }, 'one open pass an account - a second grant is the same pass');
  const came = await s.customs(gryphoth, GRYPHOTH_ID);
  assert.equal(came.status, 200, `the pass admits him: ${JSON.stringify(came.body)}`);
  // THROUGH CUSTOMS AS ANY: the first save is read against the level's allowance (AUDIT REALM2 S1)
  const rich = freshSave({ name: 'Gryphoth', level: 3, goldPieces: customsAllowance(3) + 1 });
  assert.deepEqual((await s.put(came.body.id, JSON.stringify(rich), gryphoth.secret, { lease: came.body.lease, seq: 1 })).body, { error: 'customs-allowance' }, 'no more than the allowance crosses');
  assert.equal((await s.put(came.body.id, JSON.stringify(freshSave({ name: 'Gryphoth', level: 3 })), gryphoth.secret, { lease: came.body.lease, seq: 1 })).status, 200, 'customs\' own copy lands');
  const [spent] = s.rows('SELECT player, granted_by, origin_id, spent_at FROM realm_passes');
  assert.deepEqual({ ...spent, spent_at: spent.spent_at > 0 }, { player: gryphoth.id, granted_by: dev.id, origin_id: GRYPHOTH_ID, spent_at: true }, 'the pass is spent, and says on whom and by whose grant');
  assert.deepEqual(s.rows('SELECT player, char_id, spent FROM realm_census WHERE char_id = ?', GRYPHOTH_ID), [{ player: gryphoth.id, char_id: GRYPHOTH_ID, spent: 1 }], 'and the character is counted in - once');
  assert.deepEqual((await s.customs(gryphoth, SECOND_ID)).body, { error: 'customs-never-online' }, 'a pass is one character: the next the census does not count is refused');
  assert.deepEqual((await s.customs(gryphoth, GRYPHOTH_ID)).body, { error: 'customs-already' }, 'and he never comes in twice');
});

test('CUSTOMS-PASS never admits a character already in, from any account, and a refusal leaves the pass open; a character the census counts comes in by the census and leaves the pass unspent (mutants: the pass admits a spent origin; the pass admits an origin a realm character stands on; a census customs spends the pass)', async () => {
  const s = await stand();
  const dev = await s.registered('MacDev');
  const A = await s.registered('Alessia'), B = await s.registered('Bretta');
  // B brought X in before; a copy of X sits on A's device, which A's census never counted
  s.counted(B, 'xcopied0001');
  assert.equal((await s.customs(B, 'xcopied0001')).status, 200, 'X came in on B');
  assert.equal((await s.pass(dev, { name: 'Alessia' })).status, 200);
  assert.deepEqual([(await s.customs(A, 'xcopied0001')).status, (await s.customs(A, 'xcopied0001')).body], [409, { error: 'customs-already' }], 'a pass never brings a character in twice');
  // a realm character standing on the origin, its census row gone (0022 counts that as spent too - L3-F2)
  s.counted(B, 'ystanding01');
  assert.equal((await s.customs(B, 'ystanding01')).status, 200);
  s.exec('DELETE FROM realm_census WHERE char_id = ?', 'ystanding01');
  assert.deepEqual((await s.customs(A, 'ystanding01')).body, { error: 'customs-already' }, 'nor one a realm character stands on');
  // a realm character DELETED: nothing stands on its origin any more, and its census stays spent - it never comes in
  // again (L3-F2), and a pass does not bring it back either. HOUSE-LOSS (at the merge): one whose first save never landed
  // is UNDONE by its delete - the realm as it stood before that customs - so this one's first save lands first
  s.counted(B, 'wdeleted001');
  const gone = await s.customs(B, 'wdeleted001');
  assert.equal(gone.status, 200);
  assert.equal((await s.put(gone.body.id, JSON.stringify(freshSave({ name: 'Carried', level: 3 })), B.secret, { lease: gone.body.lease, seq: 1 })).status, 200, 'its first save lands: a realm character');
  assert.equal((await s.call('/v1/realm/delete', { id: gone.body.id }, B.secret)).status, 200, 'B deletes the character it brought in');
  assert.deepEqual((await s.customs(A, 'wdeleted001')).body, { error: 'customs-already' }, 'nor one whose realm character was deleted');
  assert.deepEqual((await s.customs(A, `r${'1a'.repeat(10)}`)).body, { error: 'body' }, 'nor a realm id - never an origin');
  assert.equal(s.rows('SELECT spent_at FROM realm_passes WHERE player = ?', A.id)[0].spent_at, null, 'every refusal left the pass open');
  // a character A's census counts comes in by the census - the pass is not spent on it
  s.counted(A, 'zcounted001');
  assert.equal((await s.customs(A, 'zcounted001')).status, 200);
  assert.equal(s.rows('SELECT spent_at FROM realm_passes WHERE player = ?', A.id)[0].spent_at, null, 'the census admitted it, and the pass is still open');
  assert.equal((await s.customs(A, GRYPHOTH_ID)).status, 200, 'which then admits the one the census never counted');
  assert.equal(s.rows('SELECT origin_id FROM realm_passes WHERE player = ?', A.id)[0].origin_id, GRYPHOTH_ID);
});

test('CUSTOMS-PASS, two customs racing one pass: exactly one comes in (mutants: the pass read outside the guarded write)', async () => {
  const s = await stand();
  const dev = await s.registered('MacDev');
  const A = await s.registered('Alessia');
  assert.equal((await s.pass(dev, { name: 'Alessia' })).status, 200);
  const both = await Promise.all([s.customs(A, GRYPHOTH_ID), s.customs(A, SECOND_ID)]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 403], 'one pass, one character');
  assert.equal(s.rows('SELECT COUNT(*) AS n FROM realm_characters WHERE player = ?', A.id)[0].n, 1);
});

test('CUSTOMS-PASS, who grants and to whom: a developer alone; a handle, a guest\'s two-word name when it is one account\'s, or an account id; revoked while unspent, and a revoked pass admits nothing (mutants: a moderator or any registered player grants; an ambiguous guest name picks one; revoke takes a spent pass)', async () => {
  const s = await stand();
  const dev = await s.registered('MacDev');
  const plain = await s.registered('Plainplayer');
  const g1 = await s.guest(), g2 = await s.guest(), g3 = await s.guest();
  s.exec('UPDATE players SET guest_name = ? WHERE id IN (?, ?)', 'Twin Name', g1.id, g2.id);
  s.exec('UPDATE players SET guest_name = ? WHERE id = ?', 'Only Once', g3.id);
  s.env.MODERATOR_HANDLES = 'Plainplayer';
  assert.deepEqual([(await s.pass(plain, { name: 'MacDev' })).status, (await s.pass(plain, { name: 'MacDev' })).body], [403, { error: 'not-developer' }], 'a moderator is no developer: a pass admits a character, which is the realm\'s economy');
  assert.deepEqual((await s.pass(g3, { name: 'Plainplayer' })).body, { error: 'not-developer' }, 'nor a guest');
  assert.deepEqual([(await s.pass(dev, { name: 'Nobodyholds' })).status, (await s.pass(dev, { name: 'Nobodyholds' })).body], [404, { error: 'no-player' }]);
  assert.deepEqual([(await s.pass(dev, { name: 'Twin Name' })).status, (await s.pass(dev, { name: 'Twin Name' })).body], [409, { error: 'ambiguous' }], 'two guests share that name: name the account instead');
  assert.equal((await s.pass(dev, { name: 'Only Once' })).body.target, g3.id, 'a guest\'s name, when it is one account\'s');
  assert.equal((await s.pass(dev, { account: g1.id })).body.target, g1.id, 'an account by its id');
  for (const body of [{}, { name: 'MacDev', account: g1.id }, { name: 42 }, { account: 'no spaces allowed' }, { name: 'Plainplayer', revoke: 'yes' }]) {
    assert.deepEqual((await s.pass(dev, body)).body, { error: 'body' }, JSON.stringify(body));
  }
  const back = await s.pass(dev, { account: g1.id, revoke: true });
  assert.deepEqual(back.body, { ok: true, target: g1.id, name: 'Twin Name', open: false, changed: true }, 'an open pass taken back');
  assert.deepEqual((await s.pass(dev, { account: g1.id, revoke: true })).body.changed, false, 'and again is nothing');
  assert.deepEqual((await s.customs(g1, GRYPHOTH_ID)).body, { error: 'customs-never-online' }, 'a revoked pass admits nothing');
  // a spent pass stays the record of what it admitted - revoke never takes it
  assert.equal((await s.customs(g3, GRYPHOTH_ID)).status, 200);
  assert.equal((await s.pass(dev, { name: 'Only Once', revoke: true })).body.changed, false, 'a spent pass is history, not revoked');
  assert.equal(s.rows('SELECT COUNT(*) AS n FROM realm_passes WHERE player = ? AND spent_at IS NOT NULL', g3.id)[0].n, 1);
  // and an account deleted takes its passes with it (the players row's cascade)
  s.exec('DELETE FROM players WHERE id = ?', g3.id);
  assert.equal(s.rows('SELECT COUNT(*) AS n FROM realm_passes WHERE player = ?', g3.id)[0].n, 0);
});

test('CUSTOMS-PASS, the door\'s word: the refusal a stranded player meets says what counts and where to ask', () => {
  const said = accountRefusalText('customs-never-online');
  for (const w of ['before it opened', 'Renown', 'online home', 'guild place', 'raid', 'cloud backup', 'new online character']) assert.ok(said.includes(w), w);
  assert.match(said, /older version/, 'the case the pass exists for is named');
  assert.match(said, /Discord/, 'and where a developer can be asked');
});

test('CUSTOMS-PASS, the tool: a handle, a guest\'s two words, or --account; --revoke; anything else is its usage (mutants: a guest\'s name split; an unknown flag taken as a name)', () => {
  assert.deepEqual(passRequest(['Gryphoth']), { body: { name: 'Gryphoth' } });
  assert.deepEqual(passRequest(['Akh\'bil', 'Zakar']), { body: { name: 'Akh\'bil Zakar' } }, 'a guest\'s name, unquoted');
  assert.deepEqual(passRequest(['Akh\'bil Zakar', '--revoke']), { body: { name: 'Akh\'bil Zakar', revoke: true } });
  assert.deepEqual(passRequest(['--account', 'RIEiLzNBPm-K6KBerP6b6eun']), { body: { account: 'RIEiLzNBPm-K6KBerP6b6eun' } });
  for (const argv of [[], ['--account'], ['--account', 'x', 'Gryphoth'], ['--frobnicate', 'Gryphoth'], ['a', 'b', 'c']]) {
    assert.ok(typeof passRequest(argv).usage === 'string', JSON.stringify(argv));
  }
});
