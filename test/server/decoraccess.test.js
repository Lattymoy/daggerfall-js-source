// DECOR-ACCESS: a container and a station open for the owner, and for who the owner named.
// A guest's claim is not a key. Goods move once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { decorOf } from '../../server-account/src/decor.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { r2, seatRealm, recordOf, layRecord, realmAt } from '../realmSeat.mjs';
import { validLootList } from '../../src/systems/loot/loot.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { homeSceneName } from '../../src/net/homeScene.js';

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
      method, headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const registered = async (handle) => {
    const guest = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    assert.equal((await call('POST', '/v1/auth/register', { secret: guest.secret, handle, password: 'a good long one', ...ACCEPTED })).status, 200);
    return guest.secret;
  };
  return { env, call, registered };
}
const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
const RICH = (name, items = []) => ({ name, level: 9, goldPieces: 10_000_000, items, bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const piece = (extra = {}) => ({ id: 'p1', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 180, ...extra });
const RUBY = { uid: '0123456789abcdef', name: 'Ruby', stackCount: 1 };
const home = (character, realm) => ({ ...HOME, region: 17, character, price: 42000, layout: null, realm });

test('DECOR-ACCESS a chest and a station stay the owner\'s until the owner names who else, and a good moves once', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric', [{ ...RUBY }]));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', [{ ...RUBY, uid: 'fedcba9876543210' }]));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece({ id: 's1', storage: false, station: 'alchemy', pos: [2, 0, 2] }) }, aldric)).status, 200);
  const forged = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', kind: 'storage', item: { ...RUBY, uid: 'fedcba9876543210' }, friend: true, guild: true }, mara);
  assert.equal(forged.body.error, 'decor-shut');
  assert.equal(recordOf(env, M.id).items.length, 1, 'a refused deposit leaves the good where it was');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
  const craft = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 's1' }, mara);
  assert.equal(craft.body.error, 'decor-shut');
  const named = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] }, aldric);
  assert.deepEqual(named.body.names, ['Mara']);
  assert.equal(named.body.player, undefined, 'the answer carries no account id');
  const station = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 's1', kind: 'station', mode: 'chosen_friends', names: ['Mara'] }, aldric);
  assert.equal(station.status, 200, JSON.stringify(station.body));
  const put = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', item: { ...RUBY, uid: 'fedcba9876543210' } }, mara);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(Number.isSafeInteger(put.body.realm?.seq), true, 'the save moved, so the next checkpoint follows it');
  assert.equal(recordOf(env, M.id).items.length, 0);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1);
  const again = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', item: { ...RUBY, uid: 'fedcba9876543210' } }, mara);
  assert.equal(again.body.repeat, true);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1);
  const ownerCraft = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'craft', id: 's1' }, aldric);
  assert.equal(ownerCraft.body.ok, true);
  const friendCraft = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 's1' }, mara);
  assert.equal(friendCraft.body.ok, true);
  const dropped = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: [] }, aldric);
  assert.equal(dropped.status, 200);
  const shut = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'withdraw', id: 'p1', uid: 'fedcba9876543210', realm: realmAt(env, M.id) }, mara);
  assert.equal(shut.body.error, 'decor-shut');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1, 'a shut withdraw leaves the good in the chest');
  const back = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'withdraw', id: 'p1', uid: 'fedcba9876543210' }, aldric);
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal(Number.isSafeInteger(back.body.realm?.seq), true);
  assert.equal(recordOf(env, A.id).items.some((it) => it.uid === 'fedcba9876543210'), true);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
  const twice = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'withdraw', id: 'p1', uid: 'fedcba9876543210' }, aldric);
  assert.equal(twice.body.error, 'no-item');
  assert.equal(recordOf(env, A.id).items.filter((it) => it.uid === 'fedcba9876543210').length, 1);
  const copy = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'open', id: 'p2', kind: 'storage' }, mara);
  assert.equal(copy.body.error, 'decor-shut', 'another piece does not inherit this one\'s names');
});

test('DECOR-ACCESS a guildmate may, and may not after they leave', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara'));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece({ storage: false, station: 'alchemy' }) }, aldric)).status, 200);
  const owner = env.DB._raw.prepare('SELECT player FROM homes WHERE map_id = ?').get(HOME.mapId).player;
  const mate = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get('mara').id;
  env.DB._raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Hall', 'the hall', 'HALL', '[]', 0, 1)`).run();
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 0, \'Aldric\', 1)').run(owner, A.id);
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 1, \'Mara\', 1)').run(mate, M.id);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'station', mode: 'guild', names: ['not-a-friend'] }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 'p1' }, mara)).body.ok, true);
  env.DB._raw.prepare('DELETE FROM guild_members WHERE player = ?').run(mate);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 'p1' }, mara)).body.error, 'decor-shut');
  const kept = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'grants' }, aldric);
  assert.ok(kept.body.station.includes('p1'), 'the owner still may');
  const party = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'station', mode: 'party', names: ['Mara'] }, aldric);
  assert.equal(party.body.mode, 'party');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 'p1' }, mara)).body.ok, true);
  const shown = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'grants' }, aldric);
  assert.deepEqual(shown.body.use, [{ id: 'p1', mode: 'party' }]);
});

// HOME-POUR (FIELD BUGS 2026-10-25d): the home's own scene, as the owner's client writes it - never the building's
const chestScene = (items) => ({ sceneName: homeSceneName(HOME.mapId, HOME.buildingKey), decorItems: { p1: items } });

test('DECOR-ACCESS a chest\'s goods move with its access, or the access stays', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200);
  const save = recordOf(env, A.id);
  save.sceneCache = { scenes: [chestScene([{ ...RUBY }, { name: 'Loose' }])] };
  layRecord(env, A.id, save);
  const blind = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'friends', names: [] }, aldric);
  assert.equal(blind.body.error, 'realm-needed');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_access').get().n, 0);
  assert.equal(recordOf(env, A.id).sceneCache.scenes[0].decorItems.p1.length, 2, 'a missed record leaves the old chest where it was');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
  const shared = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'set', id: 'p1', kind: 'storage', mode: 'friends', names: [] }, aldric);
  assert.equal(shared.body.moved, true, JSON.stringify(shared.body));
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 2);
  assert.equal(recordOf(env, A.id).sceneCache.scenes[0].decorItems?.p1, undefined, 'the old chest left the save in the same answer');
  const marked = env.DB._raw.prepare('SELECT item FROM decor_bin').all().map((row) => JSON.parse(row.item));
  assert.equal(marked.length, 2);
  assert.ok(marked.every((it) => /^[0-9a-f]{16}$/.test(it.uid)), 'an unmarked good is marked as it moves');
  const mine = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'set', id: 'p1', kind: 'storage', mode: 'private' }, aldric);
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.ok(mine.body.restored?.some((it) => it.uid === RUBY.uid));
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_access').get().n, 0);
  assert.equal(recordOf(env, A.id).sceneCache.scenes[0].decorItems.p1.length, 2);
});

test('DECOR-ACCESS a hall chest is the guild\'s own bin', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', [{ ...RUBY }]));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  const owner = env.DB._raw.prepare('SELECT player FROM homes WHERE map_id = ?').get(HOME.mapId).player;
  const mate = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get('mara').id;
  env.DB._raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Hall', 'the hall', 'HALL', '[]', 0, 1)`).run();
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 0, \'Aldric\', 1)').run(owner, A.id);
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 2, \'Mara\', 1)').run(mate, M.id);
  env.DB._raw.prepare('UPDATE homes SET guild_id = \'g1\' WHERE map_id = ?').run(HOME.mapId);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200, 'a keeper places the chest');
  const shut = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'private' }, aldric);
  assert.equal(shut.body.error, 'bad-decor');
  const open = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1' }, mara);
  assert.equal(open.body.ok, true, 'no row is the whole guild');
  const leaders = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'party', rank: 0, names: ['Mara'] }, aldric);
  assert.equal(leaders.body.mode, 'guild');
  assert.equal(leaders.body.rank, 0);
  assert.equal(env.DB._raw.prepare('SELECT mode, friends FROM decor_access').get().friends, '0', 'a party word does not stick');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'list', id: 'p1' }, aldric)).body.ok, true, 'the guildmaster still may');
  const stolen = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'withdraw', id: 'p1', uid: RUBY.uid, rank: 0, mode: 'guild', friend: true }, mara);
  assert.equal(stolen.body.error, 'decor-shut');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', item: { ...RUBY }, rank: 0 }, mara)).body.error, 'decor-shut');
  assert.equal(recordOf(env, M.id).items.length, 1, 'a lower rank puts nothing in and takes nothing out');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'set', id: 'p1', kind: 'storage', mode: 'guild', rank: 3 }, mara)).body.error, 'no-home');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'guild', rank: 3 }, aldric)).body.rank, 3);
  const put = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', item: { ...RUBY } }, mara);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1);
  env.DB._raw.prepare('DELETE FROM guild_members WHERE player = ?').run(mate);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1' }, mara)).body.error, 'decor-shut');
});

test('DECOR-ACCESS a chest is one person\'s, and every move waits for one write', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const ruby = { ...RUBY };
  const gem = { ...RUBY, uid: 'abcdef0123456789', name: 'Gem' };
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', [ruby, gem]));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] }, aldric)).status, 200);
  const open = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara);
  assert.equal(open.body.ok, true, JSON.stringify(open.body));
  const busy = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'list', id: 'p1', hold: true }, aldric);
  assert.equal(busy.body.error, 'decor-busy');
  const forged = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', put: ['0123456789abcdef', '0000000000000000'] }, mara);
  assert.equal(forged.body.error, 'no-item');
  assert.equal(recordOf(env, M.id).items.length, 2, 'a refused write leaves the pack');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body.ok, true);
  const put = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', put: [ruby.uid, gem.uid] }, mara);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(Number.isSafeInteger(put.body.realm?.seq), true);
  assert.equal(recordOf(env, M.id).items.length, 0);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 2);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_hold').get().n, 0, 'the close lets the chest go');
  const again = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'list', id: 'p1', hold: true }, aldric);
  assert.equal(again.body.ok, true);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body.error, 'decor-busy');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'release', id: 'p1' }, aldric)).body.ok, true);
  const back = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara);
  assert.equal(back.body.items.length, 2);
  const out = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', take: [ruby.uid, gem.uid] }, mara);
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(recordOf(env, M.id).items.map((it) => it.uid).sort().join(), [gem.uid, ruby.uid].sort().join());
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
  const twice = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'list', id: 'p1', hold: true }, mara);
  assert.equal(twice.body.ok, true);
  const againTake = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', take: [ruby.uid, gem.uid] }, mara);
  assert.equal(againTake.body.error, 'no-item');
  assert.equal(recordOf(env, M.id).items.length, 2, 'a second take of the same goods grants nothing');
  env.DB._raw.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').run(HOME.mapId, HOME.buildingKey, 'p1', ruby.uid, JSON.stringify(ruby));
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body.ok, true);
  const stuck = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', take: [ruby.uid] }, mara);
  assert.equal(stuck.status, 200, JSON.stringify(stuck.body));
  assert.equal(recordOf(env, M.id).items.filter((it) => it.uid === ruby.uid).length, 1, 'a piece the pack already holds is not granted twice');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0, 'the chest lets that row go');
  const coins = { uid: 'cccccccccccccccc', group: 'Currency', templateIndex: 276, name: 'Gold', stackCount: 4, value: 1 };
  const purse = recordOf(env, M.id).goldPieces;
  env.DB._raw.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').run(HOME.mapId, HOME.buildingKey, 'p1', coins.uid, JSON.stringify(coins));
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body.ok, true);
  const tookCoins = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', take: [coins.uid] }, mara);
  assert.equal(tookCoins.status, 200, JSON.stringify(tookCoins.body));
  assert.equal(recordOf(env, M.id).goldPieces, purse, 'the window already counted the coins');
  assert.equal(recordOf(env, M.id).items.some((it) => it.group === 'Currency'), false, 'the chest does not hand the pile back as an item');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
});

test('DECOR-ACCESS a guildmaster pours the vault into the open chest', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara'));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200);
  const owner = env.DB._raw.prepare('SELECT player FROM homes WHERE map_id = ?').get(HOME.mapId).player;
  const mate = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get('mara').id;
  env.DB._raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Hall', 'the hall', 'HALL', '[]', 0, 1)`).run();
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 0, \'Aldric\', 1)').run(owner, A.id);
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 2, \'Mara\', 1)').run(mate, M.id);
  env.DB._raw.prepare('UPDATE homes SET guild_id = \'g1\' WHERE map_id = ?').run(HOME.mapId);
  const blade = { ...validLootList([createWeapon(113, 1, seededRng(1))])[0], uid: 'abcdef0123456789' };
  env.DB._raw.prepare('INSERT INTO guild_vault (guild_id, slot, rec, name, count, dep_player, dep_char, dep_name, at) VALUES (\'g1\', 0, ?, \'Dagger\', 1, ?, ?, \'Aldric\', 1)').run(JSON.stringify(blade), owner, A.id);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body.master, undefined);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'vault', id: 'p1' }, mara)).body.error, 'decor-shut');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM guild_vault').get().n, 1);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'release', id: 'p1' }, mara)).body.ok, true);
  const held = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'list', id: 'p1', hold: true }, aldric);
  assert.equal(held.body.master, true);
  const poured = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'vault', id: 'p1' }, aldric);
  assert.equal(poured.status, 200, JSON.stringify(poured.body));
  assert.equal(poured.body.items.length, 1);
  assert.equal(poured.body.items[0].uid, blade.uid);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM guild_vault').get().n, 0);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1);
  assert.equal(recordOf(env, A.id).items.length, 0, 'the vault does not pass through the pack');
});

test('DECOR-ACCESS two stacks of one good land as one stack', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const pile = { uid: 'aaaaaaaaaaaaaaaa', name: 'Ruby', group: 'Gems', templateIndex: 0, stackCount: 98 };
  const rest = { uid: 'bbbbbbbbbbbbbbbb', name: 'Ruby', group: 'Gems', templateIndex: 0, stackCount: 54 };
  const more = { uid: 'cccccccccccccccc', name: 'Gold Pieces', group: 'Currency', templateIndex: 276, stackCount: 11, value: 1 };
  const sitting = { uid: 'dddddddddddddddd', name: 'Gold Pieces', group: 'Currency', templateIndex: 276, stackCount: 4, value: 1 };
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', [pile, rest, more]));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] }, aldric)).status, 200);
  env.DB._raw.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').run(HOME.mapId, HOME.buildingKey, 'p1', sitting.uid, JSON.stringify(sitting));
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body.ok, true);
  const put = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', put: [pile.uid, rest.uid, more.uid] }, mara);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const rows = env.DB._raw.prepare('SELECT item FROM decor_bin').all().map((r) => JSON.parse(r.item));
  assert.deepEqual(rows.map((it) => [it.group, it.stackCount]).sort(), [['Currency', 15], ['Gems', 152]]);
  assert.equal(recordOf(env, M.id).items.length, 0);
});

test('DECOR-ACCESS several goods are still there at the next open, and using the chest does not rebuild the town', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const goods = [
    { uid: '1111111111111111', name: 'Ruby', group: 'Gems', templateIndex: 0, stackCount: 1 },
    { uid: '2222222222222222', name: 'Dagger', group: 'Weapons', templateIndex: 1, stackCount: 1 },
    { uid: '3333333333333333', name: 'Potion', group: 'UselessItems2', templateIndex: 2, stackCount: 1 },
    { uid: '4444444444444444', name: 'Ring', group: 'Jewellery', templateIndex: 3, stackCount: 1 },
    { uid: '5555555555555555', name: 'Shirt', group: 'MensClothing', templateIndex: 4, stackCount: 1 },
  ];
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', goods));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] }, aldric)).status, 200);
  env.DB._raw.prepare('INSERT INTO home_yards_ver (map_id, ver) VALUES (?, 4)').run(HOME.mapId);
  env.DB._raw.prepare("INSERT INTO home_yards (map_id, built, shape, rows) VALUES (?, 1, 'stale', 'kept')").run(HOME.mapId);
  const open = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  assert.equal(env.DB._raw.prepare('SELECT rows FROM home_yards WHERE map_id = ?').get(HOME.mapId).rows, 'kept', 'opening a chest does not rebuild the town');
  const busy = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'list', id: 'p1', hold: true }, aldric);
  assert.equal(busy.status, 409);
  assert.equal(busy.body.error, 'decor-busy');
  const saves = env.SAVES;
  env.SAVES = undefined;
  const bare = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', put: goods.map((it) => it.uid) }, mara);
  env.SAVES = saves;
  assert.equal(bare.status, 503);
  assert.equal(bare.body.error, 'no-storage');
  assert.equal(recordOf(env, M.id).items.length, 5, 'a chest the service cannot keep leaves the pack');
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body.ok, true);
  const put = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', put: goods.map((it) => it.uid) }, mara);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(env.DB._raw.prepare('SELECT rows FROM home_yards WHERE map_id = ?').get(HOME.mapId).rows, 'kept', 'closing a chest does not rebuild the town');
  assert.equal(recordOf(env, M.id).items.length, 0);
  const again = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara);
  assert.deepEqual(again.body.items.map((it) => it.uid).sort(), goods.map((it) => it.uid).sort());
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'release', id: 'p1' }, mara)).body.ok, true);
  const back = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'list', id: 'p1' }, aldric);
  assert.deepEqual(back.body.items.map((it) => it.uid).sort(), goods.map((it) => it.uid).sort());
});

test('DECOR-BATCH a standing poll is the revision row', async () => {
  const db = d1();
  db._raw.prepare('INSERT INTO decor_rev (map_id, building_key, rev) VALUES (1, 2, 7)').run();
  assert.deepEqual(await decorOf({ db }, 'p', { mapId: 1, buildingKey: 2, revOnly: true }), { mapId: 1, buildingKey: 2, rev: 7 });
  const empty = await decorOf({ db }, 'p', { mapId: 3, buildingKey: 4, revOnly: true });
  assert.equal(empty.rev, 0);
  assert.equal(empty.pieces, undefined);
});
