// A house changes owners as one write. The row is never deleted, so nobody else can claim it on the way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { ROUTES } from '../../server-account/src/service.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
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
      body: body === undefined ? undefined : JSON.stringify(body),
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
const home = (extra = {}) => ({ ...HOME, region: 17, price: 42000, layout: null, ...extra });
const RICH = (name, gold = 10_000_000) => ({ name, level: 9, goldPieces: gold, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const ownerOf = (env) => env.DB._raw.prepare('SELECT player, char_id FROM homes WHERE map_id = ? AND building_key = ?').get(HOME.mapId, HOME.buildingKey);

test('HOME-TRANSFER a free gift and a paid sale each land once, and a second answer does not move the gold again', async () => {
  assert.ok(ROUTES.has('/v1/homes/transfer'));
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', 5000));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  const gift = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: true, keepItems: false }, aldric);
  assert.equal(gift.status, 200, JSON.stringify(gift.body));
  const again = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: true, keepItems: false }, aldric);
  assert.equal(again.body?.error, 'offer-open');
  env.DB._raw.prepare('UPDATE home_offers SET until = 1 WHERE id = ?').run(gift.body.id);
  const replaced = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: true, keepItems: false }, aldric);
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
  assert.equal((await call('POST', '/v1/homes/transfer', { op: 'cancel', id: replaced.body.id }, aldric)).status, 200);
  const sale = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 1000, keepDecor: true, keepItems: false }, aldric);
  assert.equal(sale.status, 200, JSON.stringify(sale.body));
  const stranger = await registered('Cedric');
  assert.equal((await call('POST', '/v1/homes/transfer', { op: 'accept', id: sale.body.id, character: A.id }, stranger)).body?.error, 'offer-closed');
  const sellerGold = recordOf(env, A.id).goldPieces;
  const buyerGold = recordOf(env, M.id).goldPieces;
  const took = await call('POST', '/v1/homes/transfer', { op: 'accept', id: sale.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(took.status, 200, JSON.stringify(took.body));
  assert.equal(recordOf(env, M.id).goldPieces, buyerGold - 1000);
  assert.equal(recordOf(env, A.id).goldPieces, sellerGold + 1000);
  assert.equal(ownerOf(env).player, ownerOf(env).player);
  const buyer = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get('mara');
  assert.equal(ownerOf(env).player, buyer.id);
  assert.equal(ownerOf(env).char_id, M.id);
  const lost = await call('POST', '/v1/homes/transfer', { op: 'accept', id: sale.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(lost.status, 200, JSON.stringify(lost.body));
  assert.equal(lost.body.repeat, true);
  assert.equal(recordOf(env, M.id).goldPieces, buyerGold - 1000);
  assert.equal((await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: true, keepItems: false }, aldric)).body?.error, 'no-home');
});

test('HOME-TRANSFER refuses a buyer who cannot pay, a full character, a house that is not empty, and a stale offer', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', 50));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  const poor = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 1000, keepDecor: true, keepItems: false }, aldric);
  assert.equal(poor.status, 200, JSON.stringify(poor.body));
  const broke = await call('POST', '/v1/homes/transfer', { op: 'accept', id: poor.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(broke.body?.error, 'realm-gold');
  assert.equal(ownerOf(env).char_id, A.id);
  env.DB._raw.prepare('UPDATE home_offers SET until = 1 WHERE id = ?').run(poor.body.id);
  assert.equal((await call('POST', '/v1/homes/transfer', { op: 'accept', id: poor.body.id, character: M.id, realm: realmAt(env, M.id) }, mara)).body?.error, 'offer-closed');
  assert.equal(ownerOf(env).char_id, A.id);
  layRecord(env, M.id, RICH('Mara'));
  for (const key of [0x10204, 0x10205, 0x10206]) {
    const claimed = await call('POST', '/v1/homes/claim', home({ buildingKey: key, character: M.id, realm: realmAt(env, M.id) }), mara);
    assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  }
  const full = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: true, keepItems: false }, aldric);
  assert.equal(full.status, 200, JSON.stringify(full.body));
  const capped = await call('POST', '/v1/homes/transfer', { op: 'accept', id: full.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(capped.body?.error, 'home-cap');
  assert.equal(ownerOf(env).char_id, A.id);
  assert.equal((await call('POST', '/v1/homes/transfer', { op: 'decline', id: full.body.id }, mara)).status, 200);
  env.DB._raw.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').run(HOME.mapId, HOME.buildingKey, 'p1', '0123456789abcdef', '{"uid":"0123456789abcdef"}');
  const held = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: false, keepItems: false }, aldric);
  assert.equal(held.body?.error, 'home-holds');
  const both = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: false, keepItems: true }, aldric);
  assert.equal(both.body?.error, 'bad-offer');
  env.DB._raw.prepare('DELETE FROM homes WHERE building_key IN (?,?,?)').run(0x10204, 0x10205, 0x10206);
  const withGoods = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: true, keepItems: true }, aldric);
  assert.equal(withGoods.status, 200, JSON.stringify(withGoods.body));
  env.DB._raw.prepare('INSERT INTO decor_access (map_id, building_key, piece_id, kind, mode, friends) VALUES (?, ?, ?, ?, ?, ?)').run(HOME.mapId, HOME.buildingKey, 'p1', 'storage', 'friends', '["someone"]');
  env.DB._raw.prepare('INSERT INTO decor_rev (map_id, building_key, rev) VALUES (?, ?, 1) ON CONFLICT(map_id, building_key) DO UPDATE SET rev = rev + 1').run(HOME.mapId, HOME.buildingKey);
  const stale = await call('POST', '/v1/homes/transfer', { op: 'accept', id: withGoods.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(stale.body?.error, 'offer-stale');
  assert.equal((await call('POST', '/v1/homes/transfer', { op: 'cancel', id: withGoods.body.id }, aldric)).status, 200);
  const fresh = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: true, keepItems: true }, aldric);
  assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
  const moved = await call('POST', '/v1/homes/transfer', { op: 'accept', id: fresh.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin WHERE map_id = ? AND building_key = ?').get(HOME.mapId, HOME.buildingKey).n, 1);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_access WHERE map_id = ? AND building_key = ?').get(HOME.mapId, HOME.buildingKey).n, 0);
  assert.equal(ownerOf(env).char_id, M.id);
});

test('HOME-TRANSFER a batch that dies leaves the owner and both purses where they were, and a tenant or a stocked trader stops it', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara'));
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: A.id, realm: A.at() }), aldric)).status, 200);
  const placed = await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: { id: 'p1', model: 41000, flat: null, pos: [1.5, 0, -2.25], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 180 } }, aldric);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const bare = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: A.id, to: 'Mara', price: 0, keepDecor: false, keepItems: false }, aldric);
  assert.equal(bare.status, 200, JSON.stringify(bare.body));
  const sellerGold = recordOf(env, A.id).goldPieces;
  const batch = env.DB.batch.bind(env.DB);
  env.DB.batch = async (list) => {
    if (list.some((st) => String(st._sql).includes('UPDATE homes SET player'))) throw new Error('died');
    return batch(list);
  };
  const died = await call('POST', '/v1/homes/transfer', { op: 'accept', id: bare.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.notEqual(died.status, 200);
  assert.equal(ownerOf(env).char_id, A.id);
  assert.equal(recordOf(env, A.id).goldPieces, sellerGold);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE map_id = ? AND building_key = ?').get(HOME.mapId, HOME.buildingKey).n, 1);
  env.DB.batch = batch;
  const tenant = await registered('Nessa');
  const who = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get('nessa');
  env.DB._raw.prepare('INSERT INTO home_rooms (map_id, building_key, room, anchor, price, tenant, until) VALUES (?, ?, 1, ?, 10, ?, ?)').run(HOME.mapId, HOME.buildingKey, '[0,0,0]', who.id, 4_000_000_000);
  const rented = await call('POST', '/v1/homes/transfer', { op: 'accept', id: bare.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(rented.body?.error, 'home-tenants');
  env.DB._raw.prepare('DELETE FROM home_rooms WHERE map_id = ? AND building_key = ?').run(HOME.mapId, HOME.buildingKey);
  const seller = ownerOf(env).player;
  env.DB._raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, rid, n, currency, item, state, vendor_map, vendor_id)
    VALUES ('vend0001', ?, ?, 17, 'item', 1, 0, 0, 10, 1, 1, 2, 'rid-vend-00000001', 'n', 'gold', '{}', 'open', ?, 'p1')`).run(seller, A.id, HOME.mapId);
  const stocked = await call('POST', '/v1/homes/transfer', { op: 'accept', id: bare.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(stocked.body?.error, 'home-vendor-stocked');
  env.DB._raw.prepare("DELETE FROM market_listings WHERE id = 'vend0001'").run();
  const gone = await call('POST', '/v1/homes/transfer', { op: 'accept', id: bare.body.id, character: M.id, realm: realmAt(env, M.id) }, mara);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE map_id = ? AND building_key = ?').get(HOME.mapId, HOME.buildingKey).n, 0);
  assert.equal(recordOf(env, A.id).goldPieces, sellerGold + 90);
  assert.equal(ownerOf(env).char_id, M.id);
  env.DB._raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Hall', 'the hall', 'HALL', '[]', 0, 1)`).run();
  env.DB._raw.prepare('UPDATE homes SET guild_id = ? WHERE map_id = ? AND building_key = ?').run('g1', HOME.mapId, HOME.buildingKey);
  const hall = await call('POST', '/v1/homes/transfer', { op: 'offer', ...HOME, character: M.id, to: 'Aldric', price: 0, keepDecor: true, keepItems: false }, mara);
  assert.equal(hall.body?.error, 'no-home');
});
