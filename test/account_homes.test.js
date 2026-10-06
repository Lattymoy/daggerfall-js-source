// ACCOUNT-HOMES (2026-10-06, asked: "House ownership should be account bound, not character bound" and "Deleted
// characters should remove their houses from online"): A HOME IS ITS ACCOUNT'S. Every character of the owning account
// walks in, keeps it, furnishes and paints it, rents its rooms out and collects the rent, stocks its trader and sells it -
// the gold of each act its own record's; the character that BOUGHT it is still the one its cap counts and its delete
// takes; a deed the realm gave (KNIGHT-HOUSE) stays its knight's; a guild's hall is never its guildmaster's account's.
// Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs); migration 0086 on a
// database built to the migration before it; the client's sweep of the homes a save keeps things in that its account
// holds no more; the hosts by source. bible/06-Systems/Online-Arc.md ACCOUNT-HOMES.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm, realmJoinAt } from './realmSeat.mjs';
import { homeSaleRefund, homeInArenaCell, HOME_ARENA_MAP_ID, HOME_ARENA_CELL } from '../src/net/homeLaw.js';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../src/systems/loot.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { seededRng } from '../src/systems/wind.js';
import { homeSceneName, homeSceneOf, homesGoneFrom, homesGoneLine } from '../src/systems/onlineHomes.js';
import { createSceneCache, cacheScene, addPermanentScene, layoutSceneName } from '../src/systems/sceneCache.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RICH = (name, extra = {}) => ({ name, level: 9, goldPieces: 2_000_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })), ...extra });
const MAP = 77, REGION = 17, PRICE = 100_000;
const recordOf = (env, id) => {
  const row = env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id);
  return JSON.parse(new TextDecoder().decode(env.SAVES._map.get(row.obj)));
};
const goldOf = (env, id) => { const s = recordOf(env, id); return (s.goldPieces ?? 0) + (s.bankAccounts ?? []).reduce((n, a) => n + (a?.accountGold ?? 0), 0); };
const piece = (over = {}) => ({ id: 'p1', model: 41000, flat: null, pos: [1.5, 0, -2.25], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...over });

/** One account, Aldric, with two realm characters - A buys, A2 never did - and another account, Mara, with M. */
async function stood(extra = {}) {
  const s = await standService(extra);
  const aldric = await s.registered('Aldric');
  const mara = await s.registered('Mara');
  const A = await seatRealm(s.env, aldric.secret, 'Aldric', RICH('Aldric'));
  const A2 = await seatRealm(s.env, aldric.secret, 'Aldric Two', RICH('Aldric Two'));
  const M = await seatRealm(s.env, mara.secret, 'Mara', RICH('Mara'));
  /** where a character's record stands, its account playing it now (one account plays one character) */
  const at = (R) => realmJoinAt(s.env, R === M ? mara.secret : aldric.secret, R.id);
  const claim = async (key, R = A, price = PRICE) => s.call('/v1/homes/claim', { mapId: MAP, buildingKey: key, region: REGION, price, character: R.id, realm: await at(R), layout: null }, aldric.secret);
  const town = async (R, who = R === M ? mara : aldric) => Object.fromEntries((await s.call('/v1/homes/town', { mapId: MAP, character: R?.id ?? null }, who.secret)).body.homes.map((h) => [h.buildingKey, h]));
  return { ...s, raw: s.env.DB._raw, aldric, mara, A, A2, M, at, claim, town };
}

test('ACCOUNT-HOMES the sale: the character that did not buy a home sells it - the deed share into ITS record, the buyer\'s untouched, its sum said at its door; another account sells nothing; a home no record paid for is crossed to every character of the account (mutants: the sale\'s DELETE the buyer\'s again; the town\'s sum to the buyer alone; crossed the buyer\'s alone)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call, env, raw, aldric, mara, A, A2, M, at, claim, town } = await stood();
  assert.equal((await claim(3)).status, 200);
  const seen = (await town(A2))[3];
  assert.deepEqual([seen.mine, seen.character, seen.refund], [true, A.id, homeSaleRefund(PRICE)], 'the other character\'s door: the account\'s, bought by A, and what its sale pays');
  assert.ok(!('refund' in (await town(M))[3]), 'another account learns nothing of it');
  const theirs = await call('/v1/homes/release', { mapId: MAP, buildingKey: 3, realm: await at(M) }, mara.secret);
  assert.equal(theirs.body.error, 'no-home', 'another account\'s character sells nothing');
  // AUDIT REALM L1-F3, whichever character sells: a piece from before the realm stands in it - no record paid for it, so
  // its half of the price its place names (400) is never paid back
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at) VALUES (?, 3, 'old', 41000, '{"pos":[0,0,0],"rot":[0,0,0],"scale":1,"paid":400}', 1)`).run(MAP);
  const [before, beforeA] = [goldOf(env, A2.id), goldOf(env, A.id)];
  const sold = await call('/v1/homes/release', { mapId: MAP, buildingKey: 3, realm: await at(A2) }, aldric.secret);
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.deepEqual([sold.body.refund, sold.body.decorCount, sold.body.decorBack], [homeSaleRefund(PRICE), 1, 0]);
  assert.equal(goldOf(env, A2.id), before + homeSaleRefund(PRICE), 'paid into the seller\'s record');
  assert.equal(goldOf(env, A.id), beforeA, 'the buyer\'s untouched');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes').get().n, 0, 'the building free again');
  // a home from before the realm, the account's: crossed to every character of it - no sale, no price at its door
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, 5, ?, 'char-old', 'Aldric', ?, 'private', 42000, 1)").run(MAP, aldric.id, REGION);
  for (const R of [A, A2]) {
    const h = (await town(R))[5];
    assert.deepEqual([h.crossed, 'refund' in h], [true, false], `${R === A ? 'A' : 'A2'}: crossed, no sum`);
    assert.equal((await call('/v1/homes/release', { mapId: MAP, buildingKey: 5, realm: await at(R) }, aldric.secret)).body.error, 'home-crossed');
  }
  assert.ok(raw.prepare('SELECT 1 FROM homes WHERE building_key = 5').get(), 'and it stands');
});

test('ACCOUNT-HOMES every owner\'s act is the account\'s: the other character furnishes and paints the home, offers its rooms and collects their rent into its own record; a deed the realm gave stays its knight\'s; a guild\'s hall is never its guildmaster\'s account\'s - no room offered in it (mutants: rent\'s OWNS the buyer\'s; the collection the buyer\'s; OWNS\'s deed clause dropped; rent\'s hall guard dropped)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call, env, raw, aldric, mara, A, A2, M, at, claim, found } = await stood();
  assert.equal((await claim(3)).status, 200);
  // furnished and painted by the character that did not buy it, on its own record
  const placed = await call('/v1/homes/decor/place', { mapId: MAP, buildingKey: 3, character: A2.id, realm: await at(A2), piece: piece() }, aldric.secret);
  assert.deepEqual([placed.status, placed.body.gold], [200, -180], JSON.stringify(placed.body));
  assert.equal((await call('/v1/homes/look', { mapId: MAP, buildingKey: 3, character: A2.id, look: { walls: { set: 'manor', climate: 'swamp' } } }, aldric.secret)).status, 200);
  // its rooms let by it, rented by another account, the rent collected into ITS record
  assert.equal((await call('/v1/homes/rooms/offer', { mapId: MAP, buildingKey: 3, character: A2.id, room: 1, anchor: [1.5, 0.4, 2], price: 40 }, aldric.secret)).status, 200);
  const rented = await call('/v1/homes/rooms/rent', { mapId: MAP, buildingKey: 3, character: M.id, realm: await at(M), room: 1, days: 3, price: 40 }, mara.secret);
  assert.equal(rented.status, 200, JSON.stringify(rented.body));
  const before = goldOf(env, A2.id);
  const got = await call('/v1/homes/rooms/collect', { mapId: MAP, buildingKey: 3, character: A2.id, realm: await at(A2) }, aldric.secret);
  assert.deepEqual([got.status, got.body.gold], [200, 120], JSON.stringify(got.body));
  assert.equal(goldOf(env, A2.id), before + 120, 'into the collecting character\'s record');
  assert.equal(raw.prepare('SELECT rent_due FROM homes WHERE building_key = 3').get().rent_due, 0);
  // KNIGHT-HOUSE: a deed the realm gave A2 - Daggerfall's house in A2's save - is A2's alone: A furnishes and paints none of it
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, deed) VALUES (?, 9, ?, ?, 'Aldric', ?, 'private', 0, 1, 0, 1)").run(MAP, aldric.id, A2.id, REGION);
  assert.equal((await call('/v1/homes/look', { mapId: MAP, buildingKey: 9, character: A.id, look: null }, aldric.secret)).body.error, 'no-home', 'not the knight: nothing of it');
  assert.equal((await call('/v1/homes/decor/place', { mapId: MAP, buildingKey: 9, character: A.id, realm: await at(A), piece: piece({ id: 'k1' }) }, aldric.secret)).body.error, 'no-home');
  assert.equal((await call('/v1/homes/rooms/offer', { mapId: MAP, buildingKey: 9, character: A.id, room: 1, anchor: [1.5, 0.4, 2], price: 40 }, aldric.secret)).body.error, 'no-home');
  assert.equal((await call('/v1/homes/look', { mapId: MAP, buildingKey: 9, character: A2.id, look: null }, aldric.secret)).status, 200, 'the knight as before');
  // GUILD1d: a guild's hall - its row's account the guildmaster's who bought it - is no home of that account's
  const founder = { ...aldric, character: 'char-aldric', handle: 'Aldric' };
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(aldric.id, 'char-aldric', 'Aldric', 10_000_000, T0, T0);
  assert.equal((await found(founder, { name: 'The Iron Oath', tag: 'IRON' })).status, 200);
  const gid = raw.prepare('SELECT id FROM guilds').get().id;
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, guild_id) VALUES (?, 11, ?, ?, 'The Iron Oath', ?, 'guild', 1000, 1, 1500, ?)").run(MAP, aldric.id, `guild:${gid}`, REGION, gid);
  for (const R of [A, A2]) {
    assert.equal((await call('/v1/homes/rooms/offer', { mapId: MAP, buildingKey: 11, character: R.id, room: 1, anchor: [1.5, 0.4, 2], price: 40 }, aldric.secret)).body.error, 'no-home', 'no room of a hall is the account\'s to let');
    assert.equal((await call('/v1/homes/rooms/collect', { mapId: MAP, buildingKey: 11, character: R.id, realm: await at(R) }, aldric.secret)).body.error, 'no-home');
  }
});

test('ACCOUNT-HOMES a home opened to its guild opens to the guilds of ALL its account\'s characters - a member of the guild another of them is in walks in (mutants: the guild the buyer\'s alone)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call, raw, aldric, mara, M, claim, town, found } = await stood();
  assert.equal((await claim(3)).status, 200);
  assert.equal((await call('/v1/homes/entry', { mapId: MAP, buildingKey: 3, entry: 'guild' }, aldric.secret)).status, 200);
  assert.ok(!(await town(M))[3].guildmate, 'A is in no guild: nobody is its guildmate');
  // another character of Aldric's founds a guild (A, who bought the house, is in none) and Mara's character joins it
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(aldric.id, 'char-aldric', 'Aldric', 10_000_000, T0, T0);
  const founder = { ...aldric, character: 'char-aldric', handle: 'Aldric' };
  assert.equal((await found(founder, { name: 'The Iron Oath', tag: 'IRON' })).status, 200);
  assert.equal((await call('/v1/guilds/invite', { character: founder.character, handle: 'Mara' }, aldric.secret)).status, 200);
  const inv = await call('/v1/guilds/invites', {}, mara.secret);
  assert.equal((await call('/v1/guilds/answer', { character: M.id, guild: inv.body.invites[0].guild, accept: true }, mara.secret)).status, 200);
  assert.equal((await town(M))[3].guildmate, true, 'a member of the guild one of the owner\'s characters is in walks in');
});

/** A drop's weapon - a piece a trader can hold (test/homevendor_service.test.js's own). */
const weapon = () => generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(11))
  .find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE);
const HUBS = { 17: [207, 212], 23: [590, 166] };

test('ACCOUNT-HOMES the trader and the delete: the other character stocks the trader of the home the first bought; deleting the buyer waits while those goods stand there (home-vendor-stocked), then takes its homes - and what the other character placed in them - and lets its towns\' kept yards go; the other character stands (mutants: listGood\'s home the buyer\'s; the stock unasked; the yards kept)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call, env, raw, aldric, A, A2, at, claim } = await stood({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  assert.equal((await claim(3)).status, 200);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (?, 3, 'trader1', NULL, 182, 3, ?, ?, NULL, 0, 0)`)
    .run(MAP, JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, station: 'vendor' }), T0);
  // A2's own piece, laid on its record, stocked at the trader of the home A bought
  const w = weapon();
  const rec = recordOf(env, A2.id);
  rec.items = [w];
  const row = raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(A2.id);
  env.SAVES._map.set(row.obj, new TextEncoder().encode(JSON.stringify(rec)));
  raw.prepare('UPDATE realm_characters SET bytes = ? WHERE id = ?').run(env.SAVES._map.get(row.obj).byteLength, A2.id);
  const listed = await call('/v1/market/list', {
    character: A2.id, region: 23, kind: 'item', item: validLootList([w])?.[0] ?? null, pick: 0, price: 50, hubs: HUBS, rid: 'ah-000001',
    currency: 'gold', realm: await at(A2), vendor: { map: MAP, id: 'trader1' },
  }, aldric.secret);
  assert.equal(listed.status, 200, `the other character stocks the account's trader: ${JSON.stringify(listed.body)}`);
  // a yard piece, read into the isolate's kept yards
  const yardPlaced = await call('/v1/homes/decor/place', { mapId: MAP, buildingKey: 3, character: A2.id, realm: await at(A2), yard: true, piece: piece({ id: 'y1', pos: [8, 0, 2], rot: [0, 0, 0], paid: 120 }) }, aldric.secret);
  assert.equal(yardPlaced.status, 200, JSON.stringify(yardPlaced.body));
  assert.equal((await call('/v1/homes/yards', { mapId: MAP })).body.yards.length, 1, 'the yard read - and kept');
  // the buyer's delete waits for what the other character has standing at the trader
  const waits = await call('/v1/realm/delete', { id: A.id }, aldric.secret);
  assert.deepEqual([waits.status, waits.body.error], [409, 'home-vendor-stocked']);
  assert.ok(raw.prepare('SELECT 1 FROM homes WHERE building_key = 3').get(), 'nothing gone');
  raw.prepare("UPDATE market_listings SET state = 'removed', returned = 1").run();
  const gone = await call('/v1/realm/delete', { id: A.id }, aldric.secret);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes').get().n, 0, 'the homes it bought go with it - every character of the account loses them');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'and what the other character placed in them');
  assert.deepEqual((await call('/v1/homes/yards', { mapId: MAP })).body.yards, [], 'its town\'s kept yards let go - never thirty seconds of a yard gone');
  assert.ok(raw.prepare('SELECT 1 FROM realm_characters WHERE id = ?').get(A2.id), 'the other character stands');
});

test('ACCOUNT-HOMES migration 0086: the homes of realm characters already gone are released with their pieces; a tombstone\'s, an offline id\'s, a living character\'s and a guild\'s hall stand (mutants: the realm id\'s shape unread; a row standing on it unasked)', () => {
  const files = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  const at = files.indexOf('0086_account_homes.sql');
  assert.ok(at > 0, 'the migration is there');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of files.slice(0, at)) db.exec(src(`server-account/migrations/${f}`));
  db.prepare("INSERT INTO players (id, guest_name, created_at, last_seen) VALUES ('p1', 'Quiet Fox', 1, 1)").run();
  const realm = (id, dead = null) => db.prepare('INSERT INTO realm_characters (id, player, name, seq, bytes, created_at, updated_at, dead_at) VALUES (?, \'p1\', \'X\', 1, 10, 1, 1, ?)').run(id, dead);
  const LIVE = 'r00000000000000000001', DEAD = 'r00000000000000000002', GONE = 'r00000000000000000003';
  realm(LIVE); realm(DEAD, 5);
  db.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES ('g1', 'The Iron Oath', 'the iron oath', 'IRON', '[]', 1)").run();
  const home = (key, charId, guild = null) => db.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, guild_id) VALUES (77, ?, 'p1', ?, 'Fox', 17, 'private', 1000, 1, ?)").run(key, charId, guild);
  home(1, LIVE); home(2, DEAD); home(3, GONE); home(4, 'char-old'); home(5, 'guild:g1', 'g1'); home(6, 'R00000000000000000003');
  db.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at) VALUES (77, 3, 'd1', 41000, '{}', 1)`).run();
  db.exec(src('server-account/migrations/0086_account_homes.sql'));
  assert.deepEqual(db.prepare('SELECT building_key FROM homes ORDER BY building_key').all().map((r) => r.building_key), [1, 2, 4, 5, 6], 'the home whose realm character is gone, alone');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'its pieces with it');
});

test('ACCOUNT-HOMES the sweep: a home this save keeps things in that its account holds no more gives back this character\'s own things that stood in it and is let go (its other layouts\' visits too); a home the account holds, one bought while the list was read, one in the arena\'s cell, and every other scene stand (mutants: the held unread; the arena\'s unskipped; ownNow unread; the permanent mark kept)', () => {
  const cache = createSceneCache();
  const sword = { name: 'Longsword', templateIndex: 115 };
  const bed = { name: 'Fancy Double Bed', group: 'Furniture', templateIndex: 220 };   // a furnishing as the furnisher mints one (test/arena2_move.test.js's)
  const at = (key) => homeSceneName(MAP, key);
  for (const [key, own] of [[3, { a: sword }], [4, { b: bed }], [5, { c: { name: 'Mace' } }], [6, { d: { name: 'Axe' } }]]) {
    cacheScene(cache, at(key), { decorOwn: own });
    addPermanentScene(cache, at(key));
  }
  cacheScene(cache, layoutSceneName(at(3), 'villages'), { decorOwn: { e: { name: 'Dagger' } } });
  addPermanentScene(cache, layoutSceneName(at(3), 'villages'));
  cacheScene(cache, 'Interior [MapID=77, BuildingKey=3]', { decorOwn: { f: { name: 'Shield' } } });
  addPermanentScene(cache, 'Interior [MapID=77, BuildingKey=3]');
  // the arena's cell: Daggerfall's (4,3) - a key the cell holds (block 4,3, record 1)
  const arena = { mapId: HOME_ARENA_MAP_ID, key: (HOME_ARENA_CELL[0] << 16) | (HOME_ARENA_CELL[1] << 8) | 1 };
  assert.equal(homeInArenaCell(arena.mapId, arena.key), true);
  cacheScene(cache, homeSceneName(arena.mapId, arena.key), { decorOwn: { g: { name: 'Club' } } });
  addPermanentScene(cache, homeSceneName(arena.mapId, arena.key));
  const { own, gone } = homesGoneFrom(cache, [{ mapId: MAP, buildingKey: 5 }], { ownNow: (m, k) => m === MAP && k === 6 });
  assert.deepEqual(own.map((it) => it.name).sort(), ['Dagger', 'Fancy Double Bed', 'Longsword'], 'the gone homes\' own things, every layout\'s');
  assert.deepEqual(gone.sort(), [at(3), at(4)]);
  assert.deepEqual([...cache.permanent].sort(), [at(5), at(6), 'Interior [MapID=77, BuildingKey=3]', homeSceneName(arena.mapId, arena.key)].sort(), 'let go: the held, the bought-now, the arena\'s and other scenes stand');
  assert.deepEqual(Object.keys(cache.scenes.get(at(5)).decorOwn), ['c'], 'a held home\'s own things untouched');
  assert.deepEqual(homesGoneFrom(cache, [{ mapId: MAP, buildingKey: 5 }], { ownNow: (m, k) => m === MAP && k === 6 }).own, [], 'a sweep again gives nothing twice');
  assert.deepEqual([homeSceneOf(at(3)), homeSceneOf(layoutSceneName(at(3), 'villages')), homeSceneOf('Interior [MapID=77, BuildingKey=3]'), homeSceneOf('OnlineHome [MapID=77, BuildingKey=-1]')],
    [{ mapId: MAP, buildingKey: 3 }, { mapId: MAP, buildingKey: 3 }, null, null]);
  assert.equal(homesGoneLine([sword, bed]), 'One of your things stood in a home your account no longer holds, and came back to your pack. A piece of your furniture came back to Your things.');
});

test('ACCOUNT-HOMES the hosts, by source: the client\'s `own` is the account\'s; the world sweeps the homes the account holds no more once a boot, beside the arena\'s move and the deeds\' holds, sparing one bought while the list was read; the delete\'s door says the homes it bought go for every character (mutants: each wire cut)', () => {
  const h = src('src/systems/onlineHomes.js');
  assert.match(h, /const own = row\.mine && !row\.deed;/);
  assert.match(h, /if \(row\.mine && row\.deed && typeof me === 'string' && row\.character === me\) return null;/);
  const w = src('src/scenes/world.js');
  assert.match(w, /let _homesGoneAsked = false;/);
  assert.ok(w.indexOf('let _homesGoneAsked = false;') < w.indexOf('void sweepHomesGoneOnline();'), 'declared above the boot\'s first landing (HOTFIX 1003\'s TDZ)');
  assert.match(w, /void holdRealmDeedsOnline\(\);[^\n]*\n\s*void sweepHomesGoneOnline\(\);/);
  assert.match(w, /const swept = homesGoneFrom\(playerEntity\.sceneCache \?\?= createSceneCache\(\), r\.data\.homes, \{ ownNow: \(m, k\) => !!onlineHomes\?\.homeAt\(m, k\)\?\.own \}\);/);
  assert.match(w, /if \(swept\.own\.length\) \{ arenaGiveOwn\(swept\.own\); townTalk\.say\(homesGoneLine\(swept\.own\)\); \}/);
  assert.match(w, /if \(!r\?\.ok \|\| !Array\.isArray\(r\.data\?\.homes\)\) \{ _homesGoneAsked = false; return null; \}/, 'a list not read sweeps nothing');
  assert.match(src('src/ui/enhancedMenu.js'), /the homes it bought and its guild place with it \(a home is your account\\'s: your other characters lose it too\)/);
});
