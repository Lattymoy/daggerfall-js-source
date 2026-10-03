// AUDIT REALM2 (2026-09-28, the audit of the REALM service on main - bible/06-Systems/Realm-Arc.md): S1-S8, each
// reproduced against the REAL Worker over the REAL migrations before it was fixed, and pinned here. The service is
// node:sqlite behind a D1-shaped face whose batch is one transaction - and which fails on purpose where an audit needs
// it: a statement refused (`hooks.onRun`), or a batch that COMMITS and then throws (`hooks.afterCommit`), as a D1
// answer lost after the commit does - with R2's calls beside it (test/realmSeat.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { r2, layRecord, freshSave, realmAt } from './realmSeat.mjs';
import { REALM_BIRTH_LEVEL, REALM_BIRTH_WEALTH_MAX, customsAllowance, liquidWealthOf, stashedItemLists, deedsOf, CUSTOMS_HOUSE_PRICE } from '../src/net/realmGoldLaw.js';
import * as customs from '../src/systems/realmCustoms.js';
import { STARTING_GOLD } from '../src/systems/startingGear.js';
import { LETTER_OF_CREDIT_TEMPLATE, goldStack, isGoldPieces } from '../src/systems/inventory.js';
import { LOOT_CONTAINER_TYPES, interiorSceneName } from '../src/systems/sceneCache.js';
import { DEED_SELL_MULT, SHIP_TYPES, SHIP_INTERIOR_MAP_IDS, shipSellPrice } from '../src/systems/banking.js';
import { BUILDING_KEY_0 } from '../src/systems/talkTopics.js';
import { recordIsOffered, takeTradeGoods, REALM_TRADE_RECORD_MAX, TRADE_VOLATILE_FIELDS } from '../src/net/realmTradeLaw.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { validLootItem } from '../src/systems/loot.js';
import { GUILD_FOUND_GOLD, GUILD_FOUND_RENOWN } from '../src/net/guildLaw.js';
import { renownXpFor } from '../src/net/renown.js';
import { homeSaleRefund } from '../src/net/homeLaw.js';
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

/** D1's face, with the two faults the audit reproduces through it. */
function d1(hooks) {
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
        async first() { hooks.onRun?.(sql); return stmt.get(...args) ?? null; },
        async all() { hooks.onRun?.(sql); return { results: stmt.all(...args) }; },
        async run() { hooks.onRun?.(sql); const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      db.exec('BEGIN');
      let out;
      try { out = list.map((st) => st._result()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      if (hooks.afterCommit) { hooks.afterCommit = false; throw new Error('D1_ERROR: Network connection lost.'); }
      return out;
    },
  };
}

/** One service: its routes, a checkpoint's PUT and a join's GET, accounts, and realm characters with a record laid over
 *  their first save (realmSeat.mjs). */
async function stand() {
  _resetKeyForTests();
  const hooks = {};
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(hooks), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
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
  const load = async (id, secret) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, { headers: { authorization: `Bearer ${secret}` } }), env);
    if ((res.headers.get('content-type') ?? '').includes('json')) return { status: res.status, body: await res.json() };
    return { status: res.status, seq: Number(res.headers.get('x-realm-seq')), save: JSON.parse(await res.text()) };
  };
  let n = 0;
  /** An account: a guest, registered when it needs to own (homes and guilds are a registered account's). */
  const account = async (register = true) => {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    if (register) assert.equal((await call('/v1/auth/register', { secret: g.secret, handle: `player${++n}x`, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200);
    return { id: g.id, secret: g.secret };
  };
  /** A realm character of `who`: made, its first save a fresh one, `save` laid over it; `at()` where its record stands. */
  const character = async (who, name, save = null) => {
    const made = (await call('/v1/realm/create', { name }, who.secret)).body;
    assert.equal((await put(made.id, JSON.stringify(freshSave({ name })), who.secret, { lease: made.lease, seq: 1 })).status, 200);
    if (save) layRecord(env, made.id, save);
    return { id: made.id, lease: made.lease, at: () => realmAt(env, made.id) };
  };
  const rows = (sql, ...a) => env.DB._raw.prepare(sql).all(...a).map((r) => ({ ...r }));
  const exec = (sql, ...a) => env.DB._raw.prepare(sql).run(...a);
  /** A character's Renown track - what the census counted, customs carries and (RENOWN-CHAR: the character's own again)
   *  the service gates a founding on. */
  const renown = (who, charId, level = GUILD_FOUND_RENOWN) => {
    exec('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)', who.id, charId, 'x', renownXpFor(level));
  };
  /** Is the object the row names now in R2 - the save a join would load? */
  const saveStands = (id) => env.SAVES._map.has(env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id).obj);
  return { env, hooks, call, put, load, account, character, rows, exec, renown, saveStands };
}
const letter = (value) => ({ group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value });

// ---- S1: THE FIRST SAVE IS READ ----------------------------------------------------------------------------------------

test('AUDIT REALM2 S1: a character born online starts where chargen starts one - its first save at level 1 and within a new character\'s purse, read before a byte lands; an offline save, a level past the first or wealth anywhere customs counts is refused, and the row waits unsaved', async () => {
  assert.equal(REALM_BIRTH_LEVEL, 1);
  assert.ok(REALM_BIRTH_WEALTH_MAX > STARTING_GOLD, 'chargen\'s own hundred, and a biography\'s gold, fit inside');
  const s = await stand();
  const P = await s.account(false);
  const made = (await s.call('/v1/realm/create', { name: 'Rich' }, P.secret)).body;
  const first = (save) => s.put(made.id, typeof save === 'string' ? save : JSON.stringify(save), P.secret, { lease: made.lease, seq: 1 });
  const offline = { name: 'Rich', level: 60, goldPieces: 10_000_000, items: [], bankAccounts: [{ accountGold: 50_000_000 }] };
  assert.deepEqual(Object.values(await first(offline)), [403, { error: 'realm-birth' }], 'ten million gold at level sixty is no birth');
  assert.equal(s.env.SAVES._map.size, 0, 'refused before a byte lands');
  assert.deepEqual(s.rows('SELECT seq, bytes FROM realm_characters'), [{ seq: 0, bytes: 0 }], 'the row waits unsaved');
  const over = REALM_BIRTH_WEALTH_MAX + 1;
  const houseChest = (items) => ({ sceneCache: { scenes: [{ lootContainers: [{ containerType: LOOT_CONTAINER_TYPES.HouseContainers, items }] }] } });
  for (const [why, save] of [
    ['a level past the first', freshSave({ level: 2 })],
    ['no level at all', { goldPieces: 100, items: [] }],
    ['a purse one past the bound', freshSave({ goldPieces: over })],
    ['a bank account', freshSave({ goldPieces: 0, bankAccounts: [{ accountGold: 0 }, { accountGold: over }] })],
    ['a letter of credit in the pack', freshSave({ goldPieces: 0, items: [letter(over)] })],
    ['gold in the wagon', freshSave({ goldPieces: 0, wagonItems: [goldStack(over)] })],
    ['a letter in a house chest - customs\' own count', freshSave({ goldPieces: 0, ...houseChest([letter(over)]) })],
    ['a purse that is no number', freshSave({ goldPieces: { v: 1 } })],
    ['no JSON', 'save one'],
    ['a list', [freshSave()]],
  ]) assert.deepEqual(Object.values(await first(save)), [403, { error: 'realm-birth' }], why);
  assert.equal(s.env.SAVES._map.size, 0);
  // chargen's own - level 1, the purse to the bound - lands; the NEXT checkpoint is no birth (the first is what the
  // realm's later checks measure from)
  assert.deepEqual(Object.values(await first(freshSave({ goldPieces: REALM_BIRTH_WEALTH_MAX }))), [200, { ok: true, seq: 1 }]);
  assert.equal((await s.put(made.id, JSON.stringify({ level: 2, goldPieces: REALM_BIRTH_WEALTH_MAX * 2 }), P.secret, { lease: made.lease, seq: 2 })).status, 200);
});

test('AUDIT REALM2 S1: a customs character\'s first save carries no more than the allowance at the level customs was asked at - never the save\'s own word of its level; the capped copy lands', async () => {
  const s = await stand();
  const P = await s.account(false);
  const origin = 'offline-legacy-03';
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', P.id, origin);
  const c = (await s.call('/v1/realm/customs', { origin, name: 'Legacy', summary: { level: 3 } }, P.secret)).body;
  const allowance = customsAllowance(3);
  assert.equal(allowance, 50_000);
  const first = (save) => s.put(c.id, JSON.stringify(save), P.secret, { lease: c.lease, seq: 1 });
  for (const [why, save] of [
    ['one past the allowance', { name: 'Legacy', level: 3, goldPieces: allowance + 1 }],
    ['fifty million', { name: 'Legacy', level: 3, goldPieces: 50_000_000 }],
    ['its own word of a higher level', { name: 'Legacy', level: 60, goldPieces: customsAllowance(60) }],
    ['in the bank', { name: 'Legacy', level: 3, goldPieces: 0, bankAccounts: [{ accountGold: allowance + 1 }] }],
    ['no JSON', 'not a save'],
  ]) assert.deepEqual(Object.values(typeof save === 'string' ? await s.put(c.id, save, P.secret, { lease: c.lease, seq: 1 }) : await first(save)), [403, { error: 'customs-allowance' }], why);
  assert.equal(s.env.SAVES._map.size, 0);
  assert.deepEqual(Object.values(await first({ name: 'Legacy', level: 3, goldPieces: allowance })), [200, { ok: true, seq: 1 }], 'the copy customs capped');
  // a customs asked with no level is held to a first level's allowance
  const origin2 = 'offline-legacy-04';
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', P.id, origin2);
  const d = (await s.call('/v1/realm/customs', { origin: origin2, name: 'Quiet' }, P.secret)).body;
  assert.equal((await s.put(d.id, JSON.stringify({ level: 9, goldPieces: customsAllowance(1) + 1 }), P.secret, { lease: d.lease, seq: 1 })).body.error, 'customs-allowance');
});

test('AUDIT REALM2 S1: the service measures a save as customs does - ONE law (net/realmGoldLaw.js, re-exported by systems/realmCustoms.js): the purse, the banks, gold and letters in the pack, the wagon and every container (AUDIT REALM2 T5), and each deed at what the realm\'s bank pays (T3); its constants are the game\'s', () => {
  assert.equal(customs.liquidWealthOf, liquidWealthOf, 'the client caps with the very function the service reads with');
  assert.equal(customs.stashedItemLists, stashedItemLists);
  assert.equal(customs.customsAllowance, customsAllowance);
  assert.equal(customs.deedsOf, deedsOf);
  assert.ok(isGoldPieces(goldStack(5)), 'the game\'s gold pile');
  const scene = (containerType) => ({ sceneCache: { scenes: [{ lootContainers: [{ containerType, items: [goldStack(7), letter(11)] }] }] } });
  const T = LOOT_CONTAINER_TYPES;
  assert.deepEqual([T.DroppedLoot, T.HouseContainers, T.ShopShelves, T.RandomTreasure, T.CorpseMarker].map((t) => liquidWealthOf(scene(t))), [18, 18, 18, 18, 18],
    'AUDIT REALM2 T5: the pack fills any container, so every one counts');
  // the deeds' numbers are the game's (the Worker bundles no systems/): each ship at shipSellPrice, filed where the game
  // files its room, and a house at the deed's share of CUSTOMS_HOUSE_PRICE
  const piece = { paid: 400 };   // half back on its sale (decorSaleBack)
  for (const ship of [SHIP_TYPES.Small, SHIP_TYPES.Large]) {
    const room = { sceneName: interiorSceneName(SHIP_INTERIOR_MAP_IDS[ship], BUILDING_KEY_0), decor: [piece] };
    assert.deepEqual(deedsOf({ ownedShip: ship, sceneCache: { scenes: [room] } }).map((d) => d.value), [shipSellPrice(ship) + 200], `ship ${ship}`);
  }
  assert.deepEqual(deedsOf({ ownedShip: SHIP_TYPES.None }), []);
  const house = { mapId: 42, buildingKey: 7 };
  const room = { sceneName: interiorSceneName(house.mapId, house.buildingKey), decor: [piece] };
  assert.deepEqual(deedsOf({ houses: [house], sceneCache: { scenes: [room] } }).map((d) => d.value), [Math.trunc(CUSTOMS_HOUSE_PRICE * DEED_SELL_MULT) + 200]);
  assert.equal(liquidWealthOf({ goldPieces: 1, bankAccounts: [{ accountGold: 2 }], items: [goldStack(3), letter(4), { templateIndex: 120 }], wagonItems: [goldStack(5)] }), 15);
  assert.equal(liquidWealthOf({ items: [{ group: 'MiscItems', templateIndex: goldStack(1).templateIndex, stackCount: 99 }] }), 0, 'gold is the Currency row\'s alone, as isGoldPieces reads it');
});

// ---- S2: A HOUSE, A PIECE AND A FOUNDING ARE A REALM CHARACTER'S --------------------------------------------------------

test('AUDIT REALM2 S2: a house, a piece and a founding are a realm character\'s - any other id is refused and writes nothing (no building squatted at a price of 1, no free station, no free guild); customs carries the census\'s Renown track in - and, since CUSTOMS-CARRY (Mac 2026-09-29: "Carry them"), its home and its guild place from before the realm; a realm character claims, places and founds on its record', async () => {
  const s = await stand();
  const P = await s.account();
  const house = { mapId: 12345, buildingKey: 777, region: 17, layout: null };
  assert.deepEqual(Object.values(await s.call('/v1/homes/claim', { ...house, character: 'madeUpId01', price: 1 }, P.secret)), [400, { error: 'realm-only' }]);
  for (let k = 1; k <= 3; k++) assert.equal((await s.call('/v1/homes/claim', { ...house, buildingKey: 1000 + k, character: `fake${k}0000`, price: 1 }, P.secret)).body.error, 'realm-only');
  assert.deepEqual(s.rows('SELECT COUNT(*) AS n FROM homes'), [{ n: 0 }], 'no building taken');
  // an offline character that played online before the realm: census'd, its home and its guild from before the realm
  const origin = 'offline-0001';
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', P.id, origin);
  s.renown(P, origin, 12);
  s.exec("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (999, 42, ?, ?, 'Old', 3, 'private', 1, 1)", P.id, origin);
  s.exec("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('gold1', 'The Old Order', 'the old order', 'OLD', '[]', 0, 1)");
  s.exec("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, 'gold1', 0, 'Old', 1)", P.id, origin);
  const station = { id: 'station01', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, station: 'enchant' };
  assert.deepEqual(Object.values(await s.call('/v1/homes/decor/place', { mapId: 999, buildingKey: 42, character: origin, piece: station }, P.secret)), [400, { error: 'realm-only' }], 'no 200,000-gold station for nothing');
  assert.deepEqual(Object.values(await s.call('/v1/guilds/found', { character: origin, name: 'Free Founders', tag: 'FREE' }, P.secret)), [400, { error: 'realm-only' }], 'no guild with no fee');
  assert.deepEqual([s.rows('SELECT COUNT(*) AS n FROM home_decor')[0].n, s.rows('SELECT COUNT(*) AS n FROM guilds')[0].n], [0, 1]);
  const came = await s.call('/v1/realm/customs', { origin, name: 'Carried' }, P.secret);
  assert.equal(came.status, 200);
  assert.deepEqual(s.rows('SELECT char_id, xp FROM renown_tracks WHERE player = ?', P.id), [{ char_id: came.body.id, xp: renownXpFor(12) }], 'its Renown comes in');
  assert.deepEqual(s.rows('SELECT char_id FROM homes'), [{ char_id: came.body.id }], 'CUSTOMS-CARRY: its house from before the realm comes in');
  assert.deepEqual(s.rows('SELECT char_id, rank FROM guild_members'), [{ char_id: came.body.id, rank: 0 }], 'and its guild place');
  // a realm character does all three on its record
  const R = await s.character(P, 'Realmer', { name: 'Realmer', level: 5, goldPieces: 100_000, items: [] });
  s.renown(P, R.id);
  const claimed = await s.call('/v1/homes/claim', { ...house, character: R.id, price: 20_000, realm: R.at() }, P.secret);
  assert.deepEqual([claimed.status, claimed.body.home.character, claimed.body.realm.seq], [200, R.id, 2]);
  const placed = await s.call('/v1/homes/decor/place', { ...house, character: R.id, piece: { ...station, station: undefined, paid: 40 }, realm: R.at() }, P.secret);
  assert.deepEqual([placed.status, placed.body.gold, placed.body.realm.seq], [200, -40, 3]);
  const founded = await s.call('/v1/guilds/found', { character: R.id, name: 'Paid Founders', tag: 'PAID', realm: R.at() }, P.secret);
  assert.deepEqual([founded.status, founded.body.realm.seq], [200, 4]);
  assert.equal((await s.load(R.id, P.secret)).save.goldPieces, 100_000 - 20_000 - 40 - GUILD_FOUND_GOLD, 'each paid on the record');
});

// ---- S3: A BATCH THAT LANDED AND LOST ITS ANSWER KEEPS ITS SAVE ---------------------------------------------------------

test('AUDIT REALM2 S3: a settle that COMMITS and then throws keeps both traders\' saves - the rows name them, so nothing drops them - and the half is told the trade is done', async () => {
  const s = await stand();
  const A = await s.account(false), B = await s.account(false);
  const dagger = createWeapon(113, 9, () => 0.5);
  const a = await s.character(A, 'Arthago', { name: 'Arthago', items: [dagger], goldPieces: 10 });
  const b = await s.character(B, 'Brisienna', { name: 'Brisienna', items: [], goldPieces: 500 });
  const give = { items: [validLootItem(dagger)], gold: 0 }, get = { items: [], gold: 400 };
  assert.deepEqual((await s.call('/v1/realm/trade', { ...a.at(), sid: 'sidcommit1', give, get, pick: [0] }, A.secret)).body, { state: 'waiting' });
  s.hooks.afterCommit = true;
  const settled = await s.call('/v1/realm/trade', { ...b.at(), sid: 'sidcommit1', give: get, get: give, pick: [] }, B.secret);
  assert.deepEqual([settled.status, settled.body.state, settled.body.seq, settled.body.gold], [200, 'done', 2, 0], 'the row says how it ended');
  assert.ok(s.saveStands(a.id) && s.saveStands(b.id), 'both saves stand');
  const [la, lb] = [await s.load(a.id, A.secret), await s.load(b.id, B.secret)];
  assert.deepEqual([la.seq, la.save.goldPieces, la.save.items.length, lb.seq, lb.save.goldPieces, lb.save.items[0].templateIndex], [2, 410, 0, 2, 100, 113]);
});

test('AUDIT REALM2 S3: every realm act whose batch COMMITS and then throws keeps the record it moved - a claim, a sale, a piece, a founding, a deposit - and answers where the record stands', async () => {
  const s = await stand();
  const P = await s.account();
  const R = await s.character(P, 'Payer', { name: 'Payer', level: 9, goldPieces: 500_000, items: [], bankAccounts: new Array(20).fill(0).map(() => ({ accountGold: 0 })) });
  s.renown(P, R.id);
  const house = { mapId: 7, buildingKey: 9, region: 17, layout: null };
  const lost = async (path, body) => {
    const at = R.at();
    s.hooks.afterCommit = true;
    const r = await s.call(path, { ...body, realm: at }, P.secret);
    assert.deepEqual([r.status, r.body], [409, { error: 'seq', seq: at.seq + 1 }], `${path}: the record one on - the act, landed`);
    assert.ok(s.saveStands(R.id), `${path}: the save the row names stands`);
    assert.equal((await s.load(R.id, P.secret)).seq, at.seq + 1);
  };
  await lost('/v1/homes/claim', { ...house, character: R.id, price: 1_000 });
  await lost('/v1/homes/decor/place', { mapId: 7, buildingKey: 9, character: R.id, piece: { id: 'p1', model: 41000, flat: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 40 } });
  await lost('/v1/homes/release', { mapId: 7, buildingKey: 9 });
  await lost('/v1/guilds/found', { character: R.id, name: 'Lost Answers', tag: 'LOST' });
  await lost('/v1/guilds/deposit', { character: R.id, gold: 1_000 });
  const save = (await s.load(R.id, P.secret)).save;
  assert.deepEqual([save.goldPieces, save.bankAccounts[17].accountGold], [500_000 - 1_000 - 40 - GUILD_FOUND_GOLD - 1_000, homeSaleRefund(1_000) + 20],
    'each landed once: the house, the piece, the founding and the deposit paid, the sale\'s share and the piece\'s half into the region\'s account');
  assert.deepEqual(s.rows('SELECT treasury FROM guilds'), [{ treasury: 1_000 }]);
});

// ---- S4: A TRADE MOVES WHAT THE OFFER SHOWED --------------------------------------------------------------------------

test('AUDIT REALM2 S4: an offer is its record BOTH ways - a record carrying what its offer never showed (a worn edge, an enchantment, padding) is refused and moves nothing; the volatile fields stay volatile; a record past the bound never moves', async () => {
  // the law
  const dagger = createWeapon(113, 9, () => 0.5);
  const wire = validLootItem(dagger);
  assert.ok(recordIsOffered(JSON.parse(JSON.stringify(dagger)), wire), 'an honest record is its wire projection');
  assert.ok(recordIsOffered({ ...dagger, equipSlot: null, questItem: false, stackCount: 3, value: 1 }, wire), 'its count, its price and the receiver\'s marks aside');
  assert.deepEqual(TRADE_VOLATILE_FIELDS, ['stackCount', 'value', 'equipSlot', 'questItem']);
  const minimal = validLootItem({ templateIndex: 113, material: 9 });
  for (const [why, rec] of [
    ['a worn edge', { ...dagger, currentCondition: 1 }],
    ['an enchantment nobody was shown', { ...dagger, enchantments: [{ type: 9, param: 0 }] }],
    ['a field of padding', { ...dagger, note: 'x'.repeat(100) }],
  ]) assert.equal(recordIsOffered(rec, wire), false, why);
  assert.equal(recordIsOffered(dagger, minimal), false, 'an offer of a template and a material is no whole dagger');
  const padded = { ...dagger, value: 'x'.repeat(REALM_TRADE_RECORD_MAX) };   // a price is volatile: the bound is what stops it
  assert.ok(recordIsOffered(padded, wire));
  assert.equal(takeTradeGoods({ items: [padded], goldPieces: 0 }, { items: [wire], gold: 0 }, [0]), null, 'past the bound, nothing moves');
  assert.equal(takeTradeGoods({ items: [dagger], goldPieces: 0 }, { items: [wire], gold: 0 }, [0]).length, 1, 'an honest record moves');
  // the service: the minimal offer against a broken, enchanted, padded record - refused, nothing moved
  const s = await stand();
  const A = await s.account(false), B = await s.account(false);
  const broken = { ...dagger, currentCondition: 1, enchantments: [{ type: 9, param: 0 }], note: 'x'.repeat(1_000) };
  const a = await s.character(A, 'Buyer', { name: 'Buyer', items: [], goldPieces: 20_000 });
  const b = await s.character(B, 'Seller', { name: 'Seller', items: [broken], goldPieces: 0 });
  const offerB = { items: [minimal], gold: 0 }, offerA = { items: [], gold: 15_000 };
  assert.deepEqual((await s.call('/v1/realm/trade', { ...a.at(), sid: 'scam00001', give: offerA, get: offerB }, A.secret)).body, { state: 'waiting' });
  assert.deepEqual((await s.call('/v1/realm/trade', { ...b.at(), sid: 'scam00001', give: offerB, get: offerA, pick: [0] }, B.secret)).body, { state: 'refused', why: 'goods' });
  assert.deepEqual([(await s.load(a.id, A.secret)).save.goldPieces, (await s.load(b.id, B.secret)).save.items.length], [20_000, 1], 'nothing moved');
});

// ---- S5: ONE WAITING HALF A CHARACTER ----------------------------------------------------------------------------------

test('AUDIT REALM2 S5: a character leaves one trade half waiting - each new half takes the place of the last, and another character\'s stands; a half replaced and asked again waits anew', async () => {
  const s = await stand();
  const P = await s.account(false), Q = await s.account(false);
  const c = await s.character(P, 'Filler', { name: 'Filler', items: [], goldPieces: 100 });
  const q = await s.character(Q, 'Other', { name: 'Other', items: [], goldPieces: 100 });
  const half = (who, sid) => s.call('/v1/realm/trade', { ...who.at(), sid, give: { items: [], gold: 1 }, get: { items: [], gold: 0 } }, who === c ? P.secret : Q.secret);
  assert.deepEqual((await half(q, 'otherside1')).body, { state: 'waiting' });
  for (let i = 0; i < 5; i++) assert.deepEqual((await half(c, `fill${i}0000`)).body, { state: 'waiting' });
  const waiting = () => s.rows("SELECT sid, a_char FROM realm_trades WHERE state = 'waiting' ORDER BY sid");
  assert.deepEqual(waiting(), [{ sid: 'fill40000', a_char: c.id }, { sid: 'otherside1', a_char: q.id }], 'one a character: its last, and the other\'s');
  assert.deepEqual((await half(c, 'fill00000')).body, { state: 'waiting' }, 'a replaced half asked again waits anew');
  assert.deepEqual(waiting().map((r) => r.sid), ['fill00000', 'otherside1']);
});

// ---- S6: CUSTOMS CARRIES IN ITS OWN BATCH, AND AGAIN ON A RESUME --------------------------------------------------------

test('AUDIT REALM2 S6: customs carries the track in the census\'s own batch - a failure after it strands nothing - and a resume carries again what was left under the offline id; a batch that committed and lost its answer is taken up again', async () => {
  const s = await stand();
  const P = await s.account(false);
  const origin = 'offline-legacy-01';
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', P.id, origin);
  s.renown(P, origin, 20);
  let fail = true;
  s.hooks.onRun = (sql) => { if (fail && /SET lease = NULL WHERE player = \? AND id != \?/.test(sql)) { fail = false; throw new Error('D1_ERROR: transient'); } };
  assert.equal((await s.call('/v1/realm/customs', { origin, name: 'Legacy' }, P.secret)).status, 500, 'D1 fails once after the batch');
  s.hooks.onRun = null;
  const [row] = s.rows('SELECT id FROM realm_characters');
  assert.deepEqual(s.rows('SELECT char_id FROM renown_tracks'), [{ char_id: row.id }], 'the track came in with the census spent');
  // a track left under the offline id (a report filed for it since) is carried by the resume
  s.exec('UPDATE renown_tracks SET char_id = ? WHERE char_id = ?', origin, row.id);
  const again = await s.call('/v1/realm/customs', { origin, name: 'Legacy' }, P.secret);
  assert.deepEqual([again.status, again.body.id, again.body.resumed], [200, row.id, true]);
  assert.deepEqual(s.rows('SELECT char_id FROM renown_tracks'), [{ char_id: row.id }], 'carried again');
  // a track the realm's id already holds is never written over
  s.renown(P, origin, 3);
  assert.equal((await s.call('/v1/realm/customs', { origin, name: 'Legacy' }, P.secret)).status, 200);
  assert.deepEqual(s.rows('SELECT char_id, xp FROM renown_tracks ORDER BY xp'), [{ char_id: origin, xp: renownXpFor(3) }, { char_id: row.id, xp: renownXpFor(20) }]);
  // the batch that committed and lost its answer: the track is in, and the retry takes the row up again
  const origin2 = 'offline-legacy-02';
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', P.id, origin2);
  s.renown(P, origin2, 7);
  s.hooks.afterCommit = true;
  assert.equal((await s.call('/v1/realm/customs', { origin: origin2, name: 'Second' }, P.secret)).body.error, 'customs-already');
  const second = s.rows('SELECT id FROM realm_characters WHERE origin_id = ?', origin2)[0];
  assert.deepEqual(s.rows('SELECT char_id FROM renown_tracks WHERE xp = ?', renownXpFor(7)), [{ char_id: second.id }]);
  const retried = await s.call('/v1/realm/customs', { origin: origin2, name: 'Second' }, P.secret);
  assert.deepEqual([retried.body.id, retried.body.resumed], [second.id, true]);
});

// ---- S7: TWO CHECKPOINTS UNDER ONE LEASE ------------------------------------------------------------------------------

test('AUDIT REALM2 S7: two checkpoints under one lease race to one sequence - the loser is told `seq` with the service\'s own, never `lease`, and the lease stands; a checkpoint that lost to a join is still told `lease`', async () => {
  const s = await stand();
  const P = await s.account(false);
  const c = await s.character(P, 'Racer', { name: 'Racer', goldPieces: 1 });
  const realPut = s.env.SAVES.put.bind(s.env.SAVES);
  s.env.SAVES.put = async (k, b) => { await new Promise((r) => { setTimeout(r, 20); }); return realPut(k, b); };
  const [x, y] = await Promise.all([
    s.put(c.id, '{"v":"first"}', P.secret, { lease: c.lease, seq: 2 }),
    s.put(c.id, '{"v":"retry"}', P.secret, { lease: c.lease, seq: 2 }),
  ]);
  assert.deepEqual([x, y].map((r) => [r.status, r.body]).sort((m, n) => m[0] - n[0]), [[200, { ok: true, seq: 2 }], [409, { error: 'seq', seq: 2 }]]);
  assert.equal(s.rows('SELECT lease FROM realm_characters')[0].lease, c.lease, 'the lease stands');
  // a join while the checkpoint's object is on its way
  let joined = null;
  s.env.SAVES.put = async (k, b) => { joined = await s.call('/v1/realm/join', { id: c.id }, P.secret); return realPut(k, b); };
  assert.deepEqual(Object.values(await s.put(c.id, '{"v":"late"}', P.secret, { lease: c.lease, seq: 3 })), [409, { error: 'lease' }]);
  assert.equal(joined.status, 200);
});

// ---- S8: A LONE GUILDMASTER DELETED EMPTIES THE TREASURY FIRST ----------------------------------------------------------

test('AUDIT REALM2 S8: a lone guildmaster is deleted only once its treasury is empty - `guild-treasury`, as leaving asks - and nothing of it goes before', async () => {
  const s = await stand();
  const P = await s.account();
  const m = await s.character(P, 'Master', { name: 'Master', level: 9, goldPieces: 200_000, items: [] });
  s.renown(P, m.id);
  assert.equal((await s.call('/v1/guilds/found', { character: m.id, name: 'Rich Guild', tag: 'RICH', realm: m.at() }, P.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/deposit', { character: m.id, gold: 100_000, realm: m.at() }, P.secret)).body.treasury, 100_000);
  assert.deepEqual(Object.values(await s.call('/v1/guilds/leave', { character: m.id }, P.secret)), [409, { error: 'guild-treasury' }], 'the guild\'s own law');
  assert.deepEqual(Object.values(await s.call('/v1/realm/delete', { id: m.id }, P.secret)), [409, { error: 'guild-treasury' }]);
  assert.ok(s.saveStands(m.id), 'the character stands');
  assert.deepEqual(s.rows('SELECT treasury, (SELECT COUNT(*) FROM guild_members) AS members FROM guilds'), [{ treasury: 100_000, members: 1 }]);
  assert.equal((await s.call('/v1/guilds/withdraw', { character: m.id, gold: 100_000, realm: m.at() }, P.secret)).body.treasury, 0);
  assert.deepEqual((await s.call('/v1/realm/delete', { id: m.id }, P.secret)).body, { ok: true }, 'emptied, it goes');
});
