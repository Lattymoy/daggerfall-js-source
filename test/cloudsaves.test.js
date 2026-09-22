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

// ════════════════════════════════════════════════════════════════════
// ACC2b — THE CLIENT HALF.
//
// `systems/cloudSaves.js` is pure over {fetch, storage}, so a whole
// push and pull is driven here against a fetch that answers THE REAL
// SERVICE - not a stub of it. The `service()` helper below wires the
// real Worker to a fetch-shaped function, so these pins are an
// end-to-end round trip through the same code the deploy ships, which
// is the only way a client pin can be more than a pin about a stub.
// ════════════════════════════════════════════════════════════════════

import {
  cloudIo, cloudList, pushSlot, pullSlot, removeCloudSlot, localSlot,
  slotPath as clientSlotPath, slotKeyOf, CLOUD_REFUSALS, cloudRefusalText,
} from '../src/systems/cloudSaves.js';
import { SESSION_KEY, REFUSALS } from '../src/net/accountClient.js';
import { SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX } from '../src/systems/characterId.js';
import { saveSlot, enumerateSaves } from '../src/systems/saveSlots.js';

/** The slots a store really holds, by saveSlots.js's own enumeration -
 *  SAV4's law that a slot is only real with its card, asked of the module
 *  that owns it rather than by counting keys here. */
const slotsIn = (storage) => [...enumerateSaves(storage).info.entries()].map(([key, info]) => ({ key, info }));

/** Storage that behaves like appStorage: strings in, strings out, and
 *  `length`/`key(i)` because saveSlots.js and saveTransfer.js sweep it. */
function fakeStorage() {
  const m = new Map();
  return {
    _map: m,
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
}

/** The REAL Worker behind a fetch-shaped function. */
function fetchOf(env) {
  return (url, init) => worker.fetch(new Request(url, init), env);
}

const INFO = (over = {}) => JSON.stringify({
  saveVersion: 3,
  saveName: 'QuickSave',
  characterName: 'Nystul',
  dateAndTime: { gameTime: 123456, realTime: 1_758_400_000_000 },
  dfuVersion: 'b123',
  characterId: CHAR,
  ...over,
});
const putLocal = (storage, key, over = {}, { data = '{"world":1}', shot = null } = {}) => {
  storage.setItem(SAVE_DATA_PREFIX + key, data);
  storage.setItem(SAVE_INFO_PREFIX + key, INFO(over));
  if (shot) storage.setItem(SAVE_SHOT_PREFIX + key, shot);
};

/** A stand with a signed-in, registered account and a local store. */
async function client() {
  const { env, call, linked } = await stand();
  const me = await linked('Nystul');
  const storage = fakeStorage();
  storage.setItem(SESSION_KEY, JSON.stringify({ id: me.id, name: me.name, kind: 'linked', sessionId: me.sessionId, secret: me.secret }));
  const io = cloudIo({ fetch: fetchOf(env), storage });
  return { env, call, me, storage, io };
}

test('ACC2b: a whole slot goes up and comes back down, through the REAL service', async () => {
  const { storage, io } = await client();
  const data = JSON.stringify({ world: 'x'.repeat(2000) });
  const shot = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  putLocal(storage, 0, {}, { data, shot });

  const up = await pushSlot(io, storage, 0);
  assert.equal(up.ok, true, up.error);
  assert.equal(up.bytes, new TextEncoder().encode(data).byteLength);
  assert.equal(up.shot, true);

  const list = await cloudList(io);
  assert.equal(list.ok, true);
  assert.equal(list.saves.length, 1);
  assert.equal(list.saves[0].characterId, CHAR);
  assert.equal(list.saves[0].saveName, 'QuickSave');
  assert.equal(list.saves[0].characterName, 'Nystul');

  // ...ONTO A DIFFERENT DEVICE, which is the case that matters: an
  // empty store, and the slot arrives whole.
  const other = fakeStorage();
  other.setItem(SESSION_KEY, storage.getItem(SESSION_KEY));
  const down = await pullSlot(io, other, list.saves[0]);
  assert.equal(down.ok, true, down.error);
  assert.equal(other.getItem(SAVE_DATA_PREFIX + down.key), data, 'the save itself');
  assert.equal(other.getItem(SAVE_SHOT_PREFIX + down.key), shot, 'and its screenshot');

  // THE CARD IT REBUILDS IS THE ONE saveSlots.js READS. Not a shape
  // invented here: the slot enumerates, under its own name, for its own
  // character.
  const slots = slotsIn(other);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].info.saveName, 'QuickSave');
  assert.equal(slots[0].info.characterId, CHAR);
  assert.equal(slots[0].info.characterName, 'Nystul');
  assert.equal(slots[0].info.dateAndTime.gameTime, 123456);
});

test('ACC2b: a download is SP1\'s import law and not a second merge rule', async () => {
  const { storage, io } = await client();
  putLocal(storage, 0, {}, { data: '{"a":1}' });
  assert.equal((await pushSlot(io, storage, 0)).ok, true);
  const card = (await cloudList(io)).saves[0];

  // THE SAME SAVE, ALREADY HELD, IS SKIPPED RATHER THAN DOUBLED - SP1's
  // law verbatim (same character, same slot name, same game minute),
  // and the reason it exists is that a player pressed Restore twice.
  const again = await pullSlot(io, storage, card);
  assert.equal(again.ok, true, 'already here is not a failure');
  assert.equal(again.skipped, true);
  assert.equal(again.key, null);
  assert.equal(slotsIn(storage).length, 1, 'nothing was doubled');

  // A SLOT NEVER OVERWRITES ANOTHER. With slot 0 occupied by a
  // DIFFERENT save, the arriving one takes the first free number.
  const other = fakeStorage();
  putLocal(other, 0, { saveName: 'elsewhere', dateAndTime: { gameTime: 9, realTime: 9 } });
  const down = await pullSlot(io, other, card);
  assert.equal(down.ok, true);
  assert.notEqual(down.key, 0, 'it took a free number rather than the one it wanted');
  assert.equal(slotsIn(other).length, 2, 'both saves are there');

  // DERIVED: the module really goes through saveTransfer rather than
  // writing the three keys itself, which is what makes the law above
  // one law instead of two.
  const s = src('src/systems/cloudSaves.js');
  assert.match(s, /import \{ importSlots \} from '\.\/saveTransfer\.js'/);
  assert.match(s, /importSlots\(/);
  assert.doesNotMatch(s.split('export async function pullSlot')[1] ?? '', /setItem\(/, 'the pull writes the store through the carrier, never around it');
});

test('ACC2b: the card goes FIRST, the shot is optional, and the credential is only ever a header', async () => {
  const { env, storage } = await client();
  const seen = [];
  const io = cloudIo({
    fetch: (url, init) => { seen.push({ url, init }); return fetchOf(env)(url, init); },
    storage,
  });
  putLocal(storage, 0, {}, { shot: 'data:image/jpeg;base64,AAAA' });
  assert.equal((await pushSlot(io, storage, 0)).ok, true);

  // THE ORDER IS THE LAW: the card creates the slot, and the service
  // refuses a blob that no row names. A push that sent the data first
  // would fail its own first call for ever.
  assert.deepEqual(seen.map((c) => c.url.replace(/^[^/]*\/\/[^/]*/, '')), [
    clientSlotPath(CHAR, 'QuickSave'),
    clientSlotPath(CHAR, 'QuickSave', 'data'),
    clientSlotPath(CHAR, 'QuickSave', 'shot'),
  ]);
  for (const c of seen) {
    assert.equal(c.init.method, 'PUT');
    assert.equal(c.init.headers.authorization, 'Bearer ' + JSON.parse(storage.getItem(SESSION_KEY)).secret);
    // AUDIT-ACC F13, on this side: never a URL.
    assert.doesNotMatch(c.url, /secret|Bearer/i);
  }

  // A SLOT WITH NO SCREENSHOT IS STILL A BACKUP - the shot is skipped,
  // not faked, and the push still succeeds.
  const bare = fakeStorage();
  bare.setItem(SESSION_KEY, storage.getItem(SESSION_KEY));
  putLocal(bare, 0, { saveName: 'no picture' });
  seen.length = 0;
  assert.equal((await pushSlot(cloudIo({ fetch: (u, i) => { seen.push({ url: u, init: i }); return fetchOf(env)(u, i); }, storage: bare }), bare, 0)).ok, true);
  assert.equal(seen.length, 2, 'the card and the data, and no empty shot');
});

test('ACC2b: the slot the SERVICE refuses, and the slot this side refuses, each say what to do about it', async () => {
  const { env, storage, io } = await client();

  // A CARD WITH NO characterId IS A CARD FROM BEFORE CHARID1. It is
  // adopted the first time its character is loaded, so this is a wait
  // and the sentence says so rather than reading as a wall.
  putLocal(storage, 1, { characterId: undefined });
  const legacy = await pushSlot(io, storage, 1);
  assert.deepEqual(legacy, { ok: false, error: 'no-character' });
  assert.match(cloudRefusalText('no-character'), /Load this save once/);

  // A LOCAL SLOT THAT IS NOT THERE.
  assert.deepEqual(await pushSlot(io, storage, 99), { ok: false, error: 'no-save' });
  // ...and a half-written one is not a slot either (SAV4's law, kept on
  // this side too).
  storage.setItem(SAVE_DATA_PREFIX + 5, '{}');
  assert.equal(localSlot(storage, 5), null, 'data with no card is not a slot');
  assert.deepEqual(await pushSlot(io, storage, 5), { ok: false, error: 'no-save' });

  // NOBODY SIGNED IN is not an error state - `cloudIo` answers null,
  // and every entry point says the same word.
  const out = fakeStorage();
  assert.equal(cloudIo({ fetch: fetchOf(env), storage: out }), null);
  for (const r of [await cloudList(null), await pushSlot(null, out, 0), await pullSlot(null, out, { characterId: CHAR, saveName: 'x' })]) {
    assert.deepEqual(r, { ok: false, error: 'signed-out' });
  }

  // THE SERVICE'S WORDS KEEP THE SERVICE'S SENTENCES, and this side's
  // table may not shadow one. A word in both would mean two different
  // sentences for one refusal.
  const shared = Object.keys(CLOUD_REFUSALS).filter((k) => k in REFUSALS);
  assert.deepEqual(shared, [], 'a refusal word with two sentences');
  assert.equal(cloudRefusalText('too-many-saves'), REFUSALS['too-many-saves'], 'the service\'s word falls through to the one table that owns it');
  assert.equal(cloudRefusalText('utterly-unknown'), REFUSALS.server, 'and an unknown word is still a sentence');
});

test('ACC2b: a guest, a dead credential and an offline service each fail the way they should', async () => {
  // THE WALL REACHES THE CLIENT. A guest is signed in - this is not the
  // signed-out case - and the service refuses; the sentence names what
  // to do about it.
  const { env, guest } = await stand();
  const g = await guest();
  const gs = fakeStorage();
  gs.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
  putLocal(gs, 0);
  const gio = cloudIo({ fetch: fetchOf(env), storage: gs });
  const r = await pushSlot(gio, gs, 0);
  assert.equal(r.error, 'saves-need-account');
  assert.match(cloudRefusalText(r.error), /username/);
  assert.ok(gs.getItem(SESSION_KEY), 'a guest is not signed out for being a guest');

  // A DEAD CREDENTIAL IS FORGOTTEN, and only that one: accountClient's
  // law, reached through this module.
  const dead = fakeStorage();
  dead.setItem(SESSION_KEY, JSON.stringify({ id: 'x', secret: 'not-a-session-secret-at-all' }));
  putLocal(dead, 0);
  const dio = cloudIo({ fetch: fetchOf(env), storage: dead });
  assert.equal((await pushSlot(dio, dead, 0)).error, 'auth');
  assert.equal(dead.getItem(SESSION_KEY), null, 'a secret the service has stopped honouring is not a session');

  // AND A NETWORK FAILURE IS A REFUSAL, NOT A THROW - ONCRASH1's law:
  // a throw out of a button handler ends more than the button.
  const off = fakeStorage();
  off.setItem(SESSION_KEY, JSON.stringify({ id: 'x', secret: 'y' }));
  putLocal(off, 0);
  const oio = cloudIo({ fetch: async () => { throw new Error('network down'); }, storage: off });
  assert.deepEqual(await cloudList(oio), { ok: false, error: 'offline' });
  assert.equal((await pushSlot(oio, off, 0)).error, 'offline');
  assert.ok(off.getItem(SESSION_KEY), 'a blip does not sign anybody out');
});

test('ACC2b: a real slot written by saveSlots.js pushes - the two ends agree about what a card is', async () => {
  const { storage, io } = await client();
  // NOT A HAND-WRITTEN CARD. saveSlots.js's own writer makes the slot,
  // so the fields this module reads (`characterId`, `saveName`,
  // `dateAndTime`) are the fields that module really writes - which is
  // the drift a hand-built fixture would hide.
  const wrote = saveSlot('Nystul', 'before the lich',
    { characterId: CHAR, classicMinutes: 500, v: 3, world: 1 }, { storage });
  assert.equal(wrote.ok, true, 'saveSlots wrote a slot');
  const up = await pushSlot(io, storage, wrote.key);
  assert.equal(up.ok, true, up.error);
  assert.equal(up.saveName, 'before the lich', 'a name with spaces rides encoded');

  // AND THE NAMES THAT REALLY NEED THE ENCODE. A space survives an
  // unencoded path by accident - the URL constructor escapes it - so a
  // pin that tests only spaces is green over a module that encodes
  // nothing. A SLASH addresses another slot's part, and a HASH
  // TRUNCATES THE PATH at the fragment, so `danger#1` would be filed
  // and fetched as `danger`. Both are names a player can type.
  for (const name of ['a/b', 'danger#1', 'x?y', '100%']) {
    const w = saveSlot('Nystul', name, { characterId: CHAR, classicMinutes: 7, v: 3 }, { storage });
    assert.equal(w.ok, true);
    const r = await pushSlot(io, storage, w.key);
    assert.equal(r.ok, true, `${name}: ${r.error}`);
    assert.equal(r.saveName, name);
  }
  const names = (await cloudList(io)).saves.map((c) => c.saveName).sort();
  assert.deepEqual(names, ['100%', 'a/b', 'before the lich', 'danger#1', 'x?y'],
    'every name arrived as itself - none truncated, none folded into another slot');

  const card = (await cloudList(io)).saves.find((c) => c.saveName === 'before the lich');
  assert.ok(card);
  assert.equal(card.gameTime, 500);
  assert.equal(card.characterId, CHAR);

  // AND THE DELETE TOUCHES THE CLOUD ONLY, and only the slot it names.
  // The cloud is the copy; deleting the copy is not deleting the save.
  const before = slotsIn(storage).length;
  assert.equal((await removeCloudSlot(io, card)).ok, true);
  const left = (await cloudList(io)).saves.map((c) => c.saveName).sort();
  assert.deepEqual(left, ['100%', 'a/b', 'danger#1', 'x?y'], 'one slot went, and only that one');
  assert.equal(slotsIn(storage).length, before, 'every save is still on this device');
});

test('AUDIT-312 F3: the slot key carries BOTH halves, and one module writes it', () => {
  // `ui/enhancedMenu.js` held its own copy of this and the audit's
  // mutation campaign dropped the character half out of it without a
  // single pin firing. Two characters both called their save QuickSave
  // - which is what two people do - and one backup's spinner, one
  // backup's error and one Delete then landed on both.
  assert.equal(slotKeyOf({ characterId: 'c1', saveName: 'QuickSave' }), 'c1|QuickSave');
  assert.notEqual(
    slotKeyOf({ characterId: 'c1', saveName: 'QuickSave' }),
    slotKeyOf({ characterId: 'c2', saveName: 'QuickSave' }),
    'two characters, one slot name, two keys',
  );
  assert.notEqual(
    slotKeyOf({ characterId: 'c1', saveName: 'QuickSave' }),
    slotKeyOf({ characterId: 'c1', saveName: 'AutoSave' }),
  );
  // A card the SERVICE hands back is keyed by the same function - the
  // menu looks its own slots up in that listing, so a second way of
  // writing the key is a lookup that never matches.
  assert.equal(slotKeyOf({}), '|');
  assert.equal(slotKeyOf(null), '|');
});
