// DECOR-BATCH: one Confirm for a personal home. All of it lands, or none of it does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { ROUTES } from '../../server-account/src/service.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { decorHeldBlocks } from '../../server-account/src/decorBatch.js';
import { DECOR_CAP, DECOR_BATCH_OPS } from '../../src/net/decorLaw.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { r2, seatRealm, recordOf, layRecord, realmAt } from '../realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
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
        _sql: sql,
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const registered = async (handle) => {
    const guest = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    const reg = await call('POST', '/v1/auth/register', { secret: guest.secret, handle, password: 'a good long one', ...ACCEPTED });
    assert.equal(reg.status, 200, `${handle} registers`);
    return guest.secret;
  };
  return { env, call, registered };
}
const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
const home = (extra = {}) => ({ ...HOME, region: 17, character: 'char-aldric', price: 42000, layout: null, ...extra });
const piece = (extra = {}) => ({ id: 'p1', model: 41000, flat: null, pos: [1.5, 0, -2.25], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...extra });
const RICH = (name, gold = 10_000_000) => ({ name, level: 9, goldPieces: gold, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const txn = (n) => `batch-txn-${String(n).padStart(8, '0')}`;
const ids = (body) => (body.pieces ?? []).map((p) => p.id).sort();

test('DECOR-BATCH a home is furnished in one Confirm: place, move, copy and remove land together, a lost answer is the same Confirm, and a stale revision writes nothing', async () => {
  assert.ok(ROUTES.has('/v1/homes/decor/batch'));
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  const at = () => ({ ...HOME, character: A.id, realm: realmAt(env, A.id) });
  const gold = () => recordOf(env, A.id).goldPieces;
  const before = gold();
  const first = await call('POST', '/v1/homes/decor/batch', { ...at(), rev: 0, txn: txn(1), put: [piece(), piece({ id: 'p2', pos: [2, 0, 2] })], drop: [] }, aldric);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.rev, 1);
  assert.equal(first.body.gold, -360);
  assert.equal(gold(), before - 360);
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), ['p1', 'p2']);
  const again = await call('POST', '/v1/homes/decor/batch', { ...at(), rev: 0, txn: txn(1), put: [piece(), piece({ id: 'p2' }), piece({ id: 'p3' })], drop: [] }, aldric);
  assert.equal(again.body.repeat, true);
  assert.equal(gold(), before - 360, 'a lost answer does not charge again');
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), ['p1', 'p2']);
  const moved = await call('POST', '/v1/homes/decor/batch', { ...at(), rev: 1, txn: txn(2), put: [piece({ pos: [3, 0, 3] }), piece({ id: 'p3', pos: [4, 0, 4] })], drop: ['p2'] }, aldric);
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.rev, 2);
  assert.equal(moved.body.gold, -180 + 90, 'the copy is paid and the removal gives half back');
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), ['p1', 'p3']);
  const stale = await call('POST', '/v1/homes/decor/batch', { ...at(), rev: 1, txn: txn(3), put: [], drop: ['p1'] }, aldric);
  assert.equal(stale.body.error, 'decor-rev');
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), ['p1', 'p3']);
  const empty = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, rev: 2, txn: txn(4), put: [], drop: [] }, aldric);
  assert.equal(empty.body.rev, 2, 'a Confirm with nothing to write does not move the revision');
});

test('DECOR-BATCH refuses what would lose goods, gold or the room, and a batch that dies midway leaves the room and the purse as they were', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  layRecord(env, A.id, RICH('Aldric', 50));
  const poor = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, realm: realmAt(env, A.id), rev: 0, txn: txn(1), put: [piece()], drop: [] }, aldric);
  assert.equal(poor.body.error, 'realm-gold');
  assert.equal(recordOf(env, A.id).goldPieces, 50);
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), []);
  layRecord(env, A.id, RICH('Aldric'));
  const placed = await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece({ storage: true }) }, aldric);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const save = recordOf(env, A.id);
  save.sceneCache = { scenes: [{ decorItems: { p1: [{ name: 'Ruby', stackCount: 2 }] } }] };
  layRecord(env, A.id, save);
  const held = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, realm: realmAt(env, A.id), rev: 0, txn: txn(2), put: [], drop: ['p1'] }, aldric);
  assert.equal(held.body.error, 'decor-holds');
  assert.equal(recordOf(env, A.id).sceneCache.scenes[0].decorItems.p1[0].stackCount, 2);
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), ['p1']);
  const owner = env.DB._raw.prepare('SELECT player FROM homes WHERE map_id = ?').get(HOME.mapId).player;
  env.DB._raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n, vendor_map, vendor_id)
    VALUES ('L1', ?, ?, 17, 'material', 'ore:iron', 1, 1, 3, 1, 10, 20, 'r1', 'n1', ?, 'vend')`).run(owner, A.id, HOME.mapId);
  env.DB._raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, 'vend', 41000, ?, 1, 180, 0)`).run(HOME.mapId, HOME.buildingKey, JSON.stringify(piece({ id: 'vend', station: 'vendor' })));
  const stocked = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, rev: 0, txn: txn(3), put: [], drop: ['vend'] }, aldric);
  assert.equal(stocked.body.error, 'vendor-stocked');
  await registered('Thief');
  const thief = env.DB._raw.prepare("SELECT id FROM players WHERE handle = 'Thief'").get().id;
  env.DB._raw.prepare('UPDATE homes SET player = ? WHERE map_id = ?').run(thief, HOME.mapId);
  const stolen = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, realm: realmAt(env, A.id), rev: 0, txn: txn(4), put: [piece({ id: 'x1', pos: [5, 0, 5] })], drop: [] }, aldric);
  assert.equal(stolen.body.error, 'no-home', JSON.stringify(stolen.body));
  env.DB._raw.prepare('UPDATE homes SET player = ? WHERE map_id = ?').run(owner, HOME.mapId);
  assert.ok(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body).includes('p1'));
  const liveGold = recordOf(env, A.id).goldPieces;
  const real = env.DB.batch.bind(env.DB);
  env.DB.batch = async (list) => {
    if (list.some((st) => String(st._sql).includes('INSERT INTO decor_batch_receipt'))) throw new Error('cut');
    return real(list);
  };
  const cut = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, realm: realmAt(env, A.id), rev: 0, txn: txn(5), put: [piece({ id: 'x2', pos: [6, 0, 6] })], drop: [] }, aldric);
  assert.ok(cut.body.error, 'a batch that dies answers a refusal');
  env.DB.batch = real;
  assert.equal(recordOf(env, A.id).goldPieces, liveGold);
  assert.ok(!ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body).includes('x2'));
  const healed = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, realm: realmAt(env, A.id), rev: 0, txn: txn(5), put: [piece({ id: 'x2', pos: [6, 0, 6] })], drop: [] }, aldric);
  assert.equal(healed.status, 200, JSON.stringify(healed.body));
  assert.equal(recordOf(env, A.id).goldPieces, liveGold - 180);
});

test('DECOR-BATCH the room\'s bounds: the final count is what the cap sees, a body past 128 KiB is refused, and pieces already placed are still there', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  const old = await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece({ id: 'kept' }) }, aldric);
  assert.equal(old.status, 200, JSON.stringify(old.body));
  const listed = await call('POST', '/v1/homes/decor', HOME, aldric);
  assert.equal(listed.body.rev, 0, 'a house furnished before the revision still reads');
  assert.deepEqual(ids(listed.body), ['kept']);
  const place = JSON.stringify(piece({ id: 'n' }));
  const ins = env.DB._raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, 1, 180, 0)');
  for (let i = 0; i < DECOR_CAP - 1; i++) ins.run(HOME.mapId, HOME.buildingKey, `n${i}`, place);
  assert.equal((await call('POST', '/v1/homes/decor', HOME, aldric)).body.pieces.length, DECOR_CAP);
  const over = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, rev: 0, txn: txn(1), put: [piece({ id: 'more', pos: [7, 0, 7] })], drop: [] }, aldric);
  assert.equal(over.body.error, 'decor-cap');
  const swap = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, realm: realmAt(env, A.id), rev: 0, txn: txn(2), put: [piece({ id: 'more', pos: [7, 0, 7] })], drop: ['n0'] }, aldric);
  assert.equal(swap.status, 200, JSON.stringify(swap.body));
  assert.equal((await call('POST', '/v1/homes/decor', HOME, aldric)).body.pieces.length, DECOR_CAP);
  const many = Array.from({ length: DECOR_BATCH_OPS + 1 }, (_, i) => piece({ id: `z${i}`, pos: [1, 0, 1] }));
  const ops = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, rev: 1, txn: txn(3), put: many, drop: [] }, aldric);
  assert.equal(ops.body.error, 'decor-ops');
  const fat = await call('POST', '/v1/homes/decor/batch', { ...HOME, character: A.id, rev: 1, txn: txn(4), put: [piece()], drop: [], pad: 'x'.repeat(130 * 1024) }, aldric);
  assert.equal(fat.status, 413);
  const other = await call('POST', '/v1/homes/decor/place', JSON.stringify({ ...HOME, pad: 'x'.repeat(5000) }), aldric);
  assert.equal(other.status, 400, 'another route stays inside 4 KiB');
  assert.deepEqual(decorHeldBlocks({ sceneCache: { scenes: [{ decorItems: { a: [{ n: 1 }], b: [] } }] } }, ['a', 'b']), ['a']);
});

test('DECOR-BATCH a yard Confirm reads the yard, and the room list stays the room', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  const at = () => ({ ...HOME, character: A.id, realm: realmAt(env, A.id) });
  const stood = await call('POST', '/v1/homes/decor/place', { ...at(), piece: piece({ id: 'yard1' }), yard: true }, aldric);
  assert.equal(stood.status, 200, JSON.stringify(stood.body));
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), []);
  const yard = await call('POST', '/v1/homes/decor', { ...HOME, yard: true }, aldric);
  assert.deepEqual(ids(yard.body), ['yard1']);
  const moved = await call('POST', '/v1/homes/decor/batch', { ...at(), yard: true, rev: yard.body.rev, txn: txn(9), put: [piece({ id: 'yard1', pos: [3, 0, 3] })], drop: [] }, aldric);
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  const after = await call('POST', '/v1/homes/decor', { ...HOME, yard: true }, aldric);
  assert.equal(after.body.pieces[0].pos[0], 3);
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), []);
});

test('DECOR-BATCH a guild hall Confirm charges the keeper and pays the treasury, and does not net them', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  const owner = env.DB._raw.prepare('SELECT player FROM homes WHERE map_id = ?').get(HOME.mapId).player;
  env.DB._raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Hall', 'the hall', 'HALL', '[]', 0, 1)`).run();
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 0, \'Aldric\', 1)').run(owner, A.id);
  env.DB._raw.prepare('UPDATE homes SET guild_id = \'g1\' WHERE map_id = ?').run(HOME.mapId);
  const at = () => ({ ...HOME, character: A.id, realm: realmAt(env, A.id) });
  const before = recordOf(env, A.id).goldPieces;
  const own = await call('POST', '/v1/homes/decor/batch', { ...at(), rev: 0, txn: txn(1), put: [piece({ paid: 0, item: { t: 1, g: 8 } })], drop: [] }, aldric);
  assert.equal(own.body.error, 'hall-item');
  const placed = await call('POST', '/v1/homes/decor/batch', { ...at(), rev: 0, txn: txn(2), put: [piece(), piece({ id: 'p2', pos: [2, 0, 2] })], drop: [] }, aldric);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  assert.equal(placed.body.gold, -360);
  assert.equal(recordOf(env, A.id).goldPieces, before - 360);
  assert.equal(env.DB._raw.prepare(`SELECT treasury FROM guilds WHERE id = 'g1'`).get().treasury, 0);
  const mixed = await call('POST', '/v1/homes/decor/batch', { ...at(), rev: 1, txn: txn(3), put: [piece({ id: 'p3', pos: [4, 0, 4] })], drop: ['p2'] }, aldric);
  assert.equal(mixed.status, 200, JSON.stringify(mixed.body));
  assert.equal(mixed.body.gold, -180, 'the new piece is paid in full');
  assert.equal(mixed.body.treasury, 90, 'the removal is the guild\'s');
  assert.equal(recordOf(env, A.id).goldPieces, before - 540);
  assert.equal(env.DB._raw.prepare(`SELECT treasury FROM guilds WHERE id = 'g1'`).get().treasury, 90);
  const yard = await call('POST', '/v1/homes/decor/batch', { ...at(), yard: true, rev: mixed.body.rev, txn: txn(4), put: [piece({ id: 'yard1', pos: [1, 0, 1] })], drop: [] }, aldric);
  assert.equal(yard.status, 200, JSON.stringify(yard.body));
  assert.equal(yard.body.gold, -180);
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', { ...HOME, yard: true }, aldric)).body), ['yard1']);
  assert.deepEqual(ids((await call('POST', '/v1/homes/decor', HOME, aldric)).body), ['p1', 'p3']);
});
