// ACC2 — THE CLOUD SAVE, SERVICE SIDE.
//
// Step 4 of the arc's own build order: "the card and the blob, backup
// only". These pins drive the REAL Worker over the REAL migrations
// (node:sqlite behind a D1-shaped face, as test/accountworker.test.js
// established - D1 is SQLite, so the schema and the PRIMARY KEY under
// test are the ones that will be live) and a Map behind an R2-shaped
// face.
//
// WHAT THEY DO NOT PROVE, said rather than implied: there is no
// network, no Cloudflare, and no R2 or D1 quota here. They prove the
// law, the SQL and the routing, never the deployment - which is why
// tools/accountProbe.mjs exists and why ACC1-CI's own pins hold the
// workflow separately.
//
// THE TWO PINS THAT MATTER MOST are the wall (a guest may not hold a
// backup, because a guest account is one storage clear from gone) and
// the isolation (two accounts, the same character id and the same slot
// name, and neither may see the other's) - the second being the shape
// this kind of service gets wrong, since `WHERE character_id = ?`
// without the player is one typo from handing somebody another
// account's game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import {
  MAX_BODY_BYTES, SAVE_MAX_BYTES, SHOT_MAX_BYTES, SAVES_MAX, SAVE_NAME_MAX,
  savePathOf, saveKey, savePrefix, SAVE_PARTS, ROUTES,
} from '../server-account/src/service.js';
import { saveCardOf, CHARACTER_NAME_MAX, VERSION_TAG_MAX } from '../server-account/src/saves.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { mintCharacterId } from '../src/systems/characterId.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url))
  .filter((f) => f.endsWith('.sql')).sort();

/** The same D1-shaped face accountworker.test.js uses: D1's whole
 *  surface and nothing more, so a query that passes here cannot fail in
 *  production over an API this fake invented. */
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

/** R2's surface as this service uses it: put, get, delete. `get`
 *  answers null for a key that is not there, which is the arm the
 *  `no-data` refusal is built on. */
function r2() {
  const m = new Map();
  return {
    _map: m,
    async put(key, body) { m.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)))); return { key }; },
    async get(key) {
      const v = m.get(key);
      return v === undefined ? null : { key, size: v.byteLength, body: v };
    },
    async delete(key) { m.delete(key); },
  };
}

const CHAR = 'c0ffee00-1111-2222-3333-444455556666';

async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = {
    DB: d1(),
    SAVES: r2(),
    IDENTITY_PRIVATE_KEY: pkcs8,
    ACCOUNT_VERSION: 'test1',
    ALLOWED_ORIGIN: 'https://daggerfalljs.dev',
  };
  /** JSON in, JSON out. */
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** RAW in, RAW out - the blob routes, which never touch readBody. */
  const blob = async (method, path, bytes, bearer = null, { lie = null } = {}) => {
    const headers = { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };
    if (lie != null) headers['content-length'] = String(lie);
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method, headers, body: bytes === undefined ? undefined : bytes,
    }), env);
    const ct = res.headers.get('content-type') ?? '';
    return {
      status: res.status,
      json: ct.includes('json') ? await res.json().catch(() => null) : null,
      bytes: ct.includes('json') ? null : new Uint8Array(await res.arrayBuffer()),
    };
  };

  /** A guest, and then the same account registered - the wall's two
   *  sides, minted through the service's own routes rather than by
   *  writing rows behind its back. */
  const guest = async () => (await call('POST', '/v1/auth/guest', {})).body;
  const linked = async (handle) => {
    const g = await guest();
    const r = await call('POST', '/v1/auth/register', { handle, password: 'correct horse battery' }, g.secret);
    assert.ok(!r.body?.error, `register: ${r.body?.error}`);
    return g;
  };
  return { env, call, blob, guest, linked };
}

const slotPath = (char, name, part = null) =>
  `/v1/saves/${encodeURIComponent(char)}/${encodeURIComponent(name)}${part ? `/${part}` : ''}`;
const CARD = { characterName: 'Nystul', gameTime: 123456, realTime: 1_758_400_000_000, dfuVersion: 'b123', saveVersion: 3 };

// ── THE WALL ────────────────────────────────────────────────────────

test('ACC2: A GUEST MAY NOT HOLD A BACKUP - every save route, read and write alike, and the population is WALKED', async () => {
  const { call, blob, guest, linked } = await stand();
  const g = await guest();

  // DERIVED: every save route this service has, built from the two
  // parts it names and the three shapes the ladder answers, rather than
  // a list somebody keeps in step by hand.
  const routes = [
    ['GET', '/v1/saves', undefined],
    ['PUT', slotPath(CHAR, 'QuickSave'), CARD],
    ['DELETE', slotPath(CHAR, 'QuickSave'), undefined],
    ...SAVE_PARTS.flatMap((p) => [['GET', slotPath(CHAR, 'QuickSave', p), undefined], ['PUT', slotPath(CHAR, 'QuickSave', p), undefined]]),
  ];
  assert.equal(routes.length, 7, 'the whole save surface');
  for (const [method, path] of routes) {
    const r = method === 'PUT' && path.endsWith('/data') === false && !path.endsWith('/shot')
      ? await call(method, path, CARD, g.secret)
      : await blob(method, path, method === 'PUT' ? new Uint8Array([1, 2, 3]) : undefined, g.secret);
    assert.equal(r.status, 403, `${method} ${path} admitted a guest`);
    assert.equal((r.body ?? r.json)?.error, 'saves-need-account');
  }

  // ...AND THE SAME ACCOUNT, REGISTERED, IS LET IN. A refusal pin with
  // no positive control is green over a service that refuses everybody.
  const l = await linked('Nystul');
  const ok = await call('GET', '/v1/saves', undefined, l.secret);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { saves: [] });

  // ITS OWN WORD, AND ITS OWN SENTENCE. `not-registered` already means
  // "this account has no password yet" at the sign-in routes, and the
  // refusal table maps one word to one sentence - so reusing it would
  // tell a player standing at the backup button to sign in again, which
  // is not what they need to do.
  const client = src('src/net/accountClient.js');
  assert.match(client, /'saves-need-account': '[^']*username[^']*'/, 'the sentence names what to do about it');
  assert.notEqual(
    /'saves-need-account': '([^']*)'/.exec(client)?.[1],
    /'not-registered': '([^']*)'/.exec(client)?.[1],
    'two different situations must not share one sentence',
  );
});

// ── THE ROUND TRIP ──────────────────────────────────────────────────

test('ACC2: the card, the blob and the shot go up and come back, and the listing is the card', async () => {
  const { call, blob, linked, env } = await stand();
  const me = await linked('Nystul');
  const data = new TextEncoder().encode(JSON.stringify({ hello: 'x'.repeat(5000) }));
  const shot = new Uint8Array(1024).fill(7);

  const made = await call('PUT', slotPath(CHAR, 'QuickSave'), CARD, me.secret);
  assert.deepEqual(made.body, { ok: true, created: true });

  // A SLOT WITH NO DATA IS VISIBLE AS ONE. saveSlots.js keeps SAV4's
  // "a slot is only real WITH its SaveInfo"; the card being the
  // SaveInfo means an upload that died halfway reads as unfinished
  // rather than passing for a backup.
  const mid = await call('GET', '/v1/saves', undefined, me.secret);
  assert.equal(mid.body.saves[0].bytes, 0);

  assert.equal((await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), data, me.secret)).json.bytes, data.byteLength);
  assert.equal((await blob('PUT', slotPath(CHAR, 'QuickSave', 'shot'), shot, me.secret)).json.bytes, shot.byteLength);

  const list = await call('GET', '/v1/saves', undefined, me.secret);
  assert.equal(list.body.saves.length, 1);
  assert.deepEqual(
    { ...list.body.saves[0], createdAt: 0, updatedAt: 0 },
    {
      characterId: CHAR, saveName: 'QuickSave', characterName: 'Nystul',
      gameTime: 123456, realTime: 1_758_400_000_000, dfuVersion: 'b123', saveVersion: 3,
      bytes: data.byteLength, shotBytes: shot.byteLength, createdAt: 0, updatedAt: 0,
    },
  );

  const back = await blob('GET', slotPath(CHAR, 'QuickSave', 'data'), undefined, me.secret);
  assert.equal(back.status, 200);
  assert.deepEqual(back.bytes, data, 'the bytes that went up');
  const shotBack = await blob('GET', slotPath(CHAR, 'QuickSave', 'shot'), undefined, me.secret);
  assert.deepEqual(shotBack.bytes, shot);

  // THE KEY IS PLAYER-FIRST, which is what makes "everything this
  // account holds" a prefix walk rather than a join.
  const keys = [...env.SAVES._map.keys()];
  assert.deepEqual(keys.sort(), [saveKey(me.id, CHAR, 'QuickSave', 'data'), saveKey(me.id, CHAR, 'QuickSave', 'shot')].sort());
  for (const k of keys) assert.ok(k.startsWith(savePrefix(me.id)), `${k} is not under this player's prefix`);
});

test('ACC2: a re-written CARD does not reset the bytes that are already up', async () => {
  const { call, blob, linked } = await stand();
  const me = await linked('Nystul');
  await call('PUT', slotPath(CHAR, 'QuickSave'), CARD, me.secret);
  await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), new Uint8Array(64), me.secret);
  const again = await call('PUT', slotPath(CHAR, 'QuickSave'), { ...CARD, gameTime: 999 }, me.secret);
  assert.deepEqual(again.body, { ok: true, created: false }, 'the same slot, not a second one');
  const list = await call('GET', '/v1/saves', undefined, me.secret);
  assert.equal(list.body.saves.length, 1);
  assert.equal(list.body.saves[0].gameTime, 999, 'the card moved');
  assert.equal(list.body.saves[0].bytes, 64, 'and a good backup did not start reading as an unfinished one');
});

// ── WHAT BOUNDS R2 ──────────────────────────────────────────────────

test('ACC2: A BLOB WITHOUT A CARD IS REFUSED, and nothing is written - the only thing bounding R2', async () => {
  const { blob, linked, env } = await stand();
  const me = await linked('Nystul');
  for (const part of SAVE_PARTS) {
    const r = await blob('PUT', slotPath(CHAR, 'QuickSave', part), new Uint8Array(8), me.secret);
    assert.equal(r.status, 404);
    assert.equal(r.json.error, 'no-slot');
  }
  assert.equal(env.SAVES._map.size, 0, 'an object under a key no row names is an object nothing can ever bound');
  // ...and reading one is the same answer, so a slot that is not this
  // account's reads the same whether it is missing or somebody else's.
  const g = await blob('GET', slotPath(CHAR, 'QuickSave', 'data'), undefined, me.secret);
  assert.equal(g.json.error, 'no-slot');
});

test('ACC2: a card with no data answers no-data, which is not the same as no-slot', async () => {
  const { call, blob, linked } = await stand();
  const me = await linked('Nystul');
  await call('PUT', slotPath(CHAR, 'QuickSave'), CARD, me.secret);
  const r = await blob('GET', slotPath(CHAR, 'QuickSave', 'data'), undefined, me.secret);
  assert.equal(r.status, 404);
  assert.equal(r.json.error, 'no-data', 'the slot exists and its blob does not - a client can tell the two apart');
});

test('ACC2: the blob routes carry their OWN bound, because MAX_BODY_BYTES would refuse every real save', async () => {
  const { call, blob, linked } = await stand();
  const me = await linked('Nystul');
  await call('PUT', slotPath(CHAR, 'QuickSave'), CARD, me.secret);

  // THE FACT THAT MAKES THIS PIN NECESSARY: a save is orders of
  // magnitude past the JSON body cap, so a save route that went through
  // readBody would refuse every real save and one that quietly skipped
  // it would have no cap at all.
  assert.ok(SAVE_MAX_BYTES > MAX_BODY_BYTES * 100, 'a save is not a JSON request');
  assert.ok(SHOT_MAX_BYTES < SAVE_MAX_BYTES, 'a 320x200 JPEG is not a save');

  const real = new Uint8Array(300 * 1024).fill(3);   // a Daggerfall envelope's size class
  assert.ok(real.byteLength > MAX_BODY_BYTES);
  assert.equal((await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), real, me.secret)).status, 200);

  // ...AND THE BOUND REALLY BOUNDS, both by what the caller ANNOUNCES
  // and by what actually arrives. A content-length is the caller's
  // word: believing it alone would let a liar through, and believing
  // only the body would mean reading a gigabyte to refuse it.
  const tooBig = new Uint8Array(SHOT_MAX_BYTES + 1);
  const byBody = await blob('PUT', slotPath(CHAR, 'QuickSave', 'shot'), tooBig, me.secret);
  assert.equal(byBody.status, 413);
  assert.equal(byBody.json.error, 'too-large');
  const byHeader = await blob('PUT', slotPath(CHAR, 'QuickSave', 'shot'), new Uint8Array(8), me.secret, { lie: SAVE_MAX_BYTES * 4 });
  assert.equal(byHeader.status, 413, 'an announced gigabyte is refused before a byte is read');

  // an empty body is a request, not a blob
  assert.equal((await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), new Uint8Array(0), me.secret)).status, 400);
});

test('ACC2: SAVES_MAX bounds the SLOTS, and the oldest is never taken to make room', async () => {
  const { call, linked } = await stand();
  const me = await linked('Nystul');
  for (let i = 0; i < SAVES_MAX; i++) {
    const r = await call('PUT', slotPath(CHAR, `save ${i}`), CARD, me.secret);
    assert.equal(r.status, 200, `slot ${i}`);
  }
  const over = await call('PUT', slotPath(CHAR, 'one too many'), CARD, me.secret);
  assert.equal(over.status, 409);
  assert.equal(over.body.error, 'too-many-saves');
  const list = await call('GET', '/v1/saves', undefined, me.secret);
  assert.equal(list.body.saves.length, SAVES_MAX, 'nothing was deleted to make room - this is a BACKUP');

  // AT THE BOUND A PLAYER CAN STILL SAVE. The bound is on how many
  // slots exist, not on how often they are written, and an account that
  // could never back up again would be the opposite of the point.
  assert.equal((await call('PUT', slotPath(CHAR, 'save 0'), { ...CARD, gameTime: 7 }, me.secret)).status, 200);
});

// ── THE ISOLATION ───────────────────────────────────────────────────

test('ACC2: TWO ACCOUNTS, THE SAME CHARACTER ID AND THE SAME SLOT NAME, AND NEITHER SEES THE OTHER', async () => {
  const { call, blob, linked, env } = await stand();
  const a = await linked('Nystul');
  const b = await linked('Julianos');
  const mine = new TextEncoder().encode('MINE');
  const theirs = new TextEncoder().encode('THEIRS');

  await call('PUT', slotPath(CHAR, 'QuickSave'), { ...CARD, characterName: 'A' }, a.secret);
  await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), mine, a.secret);
  await call('PUT', slotPath(CHAR, 'QuickSave'), { ...CARD, characterName: 'B' }, b.secret);
  await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), theirs, b.secret);

  // The same triple but for the player: two rows, two objects.
  assert.equal(env.SAVES._map.size, 2);
  assert.deepEqual((await blob('GET', slotPath(CHAR, 'QuickSave', 'data'), undefined, a.secret)).bytes, mine);
  assert.deepEqual((await blob('GET', slotPath(CHAR, 'QuickSave', 'data'), undefined, b.secret)).bytes, theirs);
  assert.equal((await call('GET', '/v1/saves', undefined, a.secret)).body.saves[0].characterName, 'A');
  assert.equal((await call('GET', '/v1/saves', undefined, b.secret)).body.saves[0].characterName, 'B');

  // AND A DELETE REACHES ONLY THE CALLER'S. This is the one that would
  // be catastrophic and silent.
  assert.equal((await call('DELETE', slotPath(CHAR, 'QuickSave'), undefined, a.secret)).status, 200);
  assert.equal((await call('GET', '/v1/saves', undefined, a.secret)).body.saves.length, 0);
  assert.equal((await call('GET', '/v1/saves', undefined, b.secret)).body.saves.length, 1, 'somebody else\'s account was reached');
  assert.deepEqual((await blob('GET', slotPath(CHAR, 'QuickSave', 'data'), undefined, b.secret)).bytes, theirs);

  // DERIVED, NOT REMEMBERED: every statement in saves.js that touches
  // the table binds the player. A query that filters by character and
  // slot alone is the whole bug.
  const s = src('server-account/src/saves.js');
  const statements = [...s.matchAll(/FROM saves[^']*|UPDATE saves[^']*|DELETE FROM saves[^']*/g)].map((m) => m[0]);
  assert.ok(statements.length >= 5, `found ${statements.length} statements over the table`);
  for (const q of statements) assert.match(q, /WHERE player_id = \?|player_id = \?/, `a statement over saves does not bind the player: ${q}`);
});

test('ACC2: delete takes both objects and the row, and a slot that is not there is a 404', async () => {
  const { call, blob, linked, env } = await stand();
  const me = await linked('Nystul');
  await call('PUT', slotPath(CHAR, 'QuickSave'), CARD, me.secret);
  await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), new Uint8Array(8), me.secret);
  await blob('PUT', slotPath(CHAR, 'QuickSave', 'shot'), new Uint8Array(4), me.secret);
  assert.equal(env.SAVES._map.size, 2);
  assert.deepEqual((await call('DELETE', slotPath(CHAR, 'QuickSave'), undefined, me.secret)).body, { ok: true });
  assert.equal(env.SAVES._map.size, 0, 'an object nothing names is an object nothing can reach again');
  const gone = await call('DELETE', slotPath(CHAR, 'QuickSave'), undefined, me.secret);
  assert.equal(gone.status, 404);
  assert.equal(gone.body.error, 'no-slot');
});

// ── THE CARD, PROJECTED ─────────────────────────────────────────────

test('ACC2: the card is PROJECTED - the fields this service keeps, and a number it did not write is null', () => {
  const full = saveCardOf({ ...CARD, secret: 'nope', bytes: 999, extra: { a: 1 } });
  assert.deepEqual(Object.keys(full).sort(), ['characterName', 'dfuVersion', 'gameTime', 'realTime', 'saveVersion']);
  assert.equal(full.characterName, 'Nystul');
  // Every numeric field is a compare-and-display value (saveSlots.js
  // says so of gameTime and realTime both), so a fractional or negative
  // one is not a smaller number - it is a card this service did not
  // write.
  for (const bad of [-1, 1.5, NaN, Infinity, '5', null, undefined, {}]) {
    assert.equal(saveCardOf({ gameTime: bad }).gameTime, null, `gameTime ${String(bad)}`);
  }
  assert.equal(saveCardOf({ characterName: 'x'.repeat(500) }).characterName.length, CHARACTER_NAME_MAX, 'a long name is CUT, never refused - it is display only');
  assert.equal(saveCardOf({ dfuVersion: 'v'.repeat(500) }).dfuVersion.length, VERSION_TAG_MAX);
  assert.equal(saveCardOf({ characterName: '' }).characterName, null);
  for (const bad of [null, undefined, 'a string', [1, 2], 42]) assert.equal(saveCardOf(bad), null, String(bad));
});

// ── THE PATH ────────────────────────────────────────────────────────

test('ACC2: a save name is the PLAYER\'S WORDS, so the path is encoded and the matcher refuses what it cannot be sure of', async () => {
  // A NAME MAY HOLD A SLASH, A SPACE OR A HASH. Pasting one into a path
  // unencoded is how one slot comes to address another.
  for (const name of ['QuickSave', 'before the lich', 'a/b', '#1', 'Ω the end', 'x'.repeat(SAVE_NAME_MAX)]) {
    const got = savePathOf(slotPath(CHAR, name, 'data'));
    assert.deepEqual(got, { characterId: CHAR, saveName: name, part: 'data' }, name);
  }
  assert.equal(savePathOf(slotPath(CHAR, 'QuickSave')).part, null, 'no tail is the card itself');
  for (const bad of [
    '/v1/saves/', `/v1/saves/${CHAR}`, `/v1/saves/${CHAR}/`, `/v1/saves/${CHAR}/x/bogus`,
    `/v1/saves/${CHAR}/x/data/more`, '/v1/saves/ab/x', `/v1/saves/${CHAR}/${'x'.repeat(SAVE_NAME_MAX + 1)}`,
    `/v1/saves/${CHAR}/%ZZ`, `/v1/saves/${CHAR}/${encodeURIComponent('a\u0000b')}`, `/v1/saves/${CHAR}/${encodeURIComponent('a\nb')}`,
    '/v1/saves', '/v1/account', null, 42,
  ]) assert.equal(savePathOf(bad), null, `savePathOf(${String(bad)})`);

  // A NAME THAT DIFFERS ONLY BY ENCODING IS A DIFFERENT SLOT, and the
  // key says so - the encode is not cosmetic.
  assert.notEqual(saveKey('p', CHAR, 'a/b', 'data'), saveKey('p', CHAR, 'a', 'b/data'));

  // THE MATCHER IS THE 404's OTHER HALF: a path neither the Set nor the
  // matcher admits is not-found, and it is answered before any
  // credential is looked at.
  const { blob, linked } = await stand();
  const me = await linked('Nystul');
  const r = await blob('GET', `/v1/saves/${CHAR}/QuickSave/bogus`, undefined, me.secret);
  assert.equal(r.status, 404);
  assert.equal(r.json.error, 'not-found');
  assert.ok(ROUTES.has('/v1/saves'), 'the listing is a fixed path and lives in the Set');

  // EVERY ID systems/characterId.js MINTS passes, on both its arms -
  // the UUID and the old-WebView fallback - because a character whose
  // id the service will not file under is a character with no backup.
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(mintCharacterId());
  for (const id of ids) assert.ok(savePathOf(slotPath(id, 'QuickSave')), `characterId.js minted ${id} and the service refuses it`);
  // ...INCLUDING THE ARM THIS RUNTIME NEVER TAKES. node has
  // crypto.randomUUID, so the 500 draws above are all UUIDs and the old
  // WebView fallback would go untested - which is the arm a phone
  // actually uses. It is built here the way the module builds it, and
  // the module's own line is read back so the two cannot drift.
  assert.match(
    src('src/systems/characterId.js'),
    /return `\$\{Date\.now\(\)\.toString\(36\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 12\)\}`;/,
    'the fallback this pin models is still the one characterId.js mints',
  );
  for (let i = 0; i < 100; i++) {
    const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    assert.ok(savePathOf(slotPath(fallback, 'x')), `the old-WebView arm minted ${fallback} and the service refuses it`);
  }
});

test('ACC2: with no bucket bound, a save route says so rather than pretending', async () => {
  const { call, blob, linked, env } = await stand();
  const me = await linked('Nystul');
  await call('PUT', slotPath(CHAR, 'QuickSave'), CARD, me.secret);
  env.SAVES = null;
  const put = await blob('PUT', slotPath(CHAR, 'QuickSave', 'data'), new Uint8Array(8), me.secret);
  assert.equal(put.status, 503);
  assert.equal(put.json.error, 'no-storage');
  const get = await blob('GET', slotPath(CHAR, 'QuickSave', 'data'), undefined, me.secret);
  assert.equal(get.status, 503);
  // The card half still works, because it is D1 and D1 is there - a
  // service that is half up says which half.
  assert.equal((await call('GET', '/v1/saves', undefined, me.secret)).status, 200);
});
