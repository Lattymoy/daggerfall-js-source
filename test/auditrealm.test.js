// AUDIT REALM (2026-09-28, Mac: "finish up the audit" of the REALM branch - bible/06-Systems/Realm-Arc.md): the
// findings of the audit of REALM P0.1-P2.2b on the tree merged with main (#412, the Sigil Stones), each reproduced
// before it was fixed and pinned here. The service is driven through the REAL Worker over the REAL migrations
// (node:sqlite behind a D1-shaped face whose batch is one transaction, and R2's calls), as test/realm4.test.js does.
import { REST_ITEM_ROWS } from '../src/systems/restItems.js';   // REST6: the tenth registrar
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import { tradeableRecord, BOUND_TEMPLATES, boundRecord } from '../src/net/realmTradeLaw.js';
import { isBound } from '../src/systems/itemBound.js';
import { ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { SURVIVAL_TEMPLATES } from '../src/systems/survival/items.js';
import { DEEP_WATERS_FISH_TEMPLATES } from '../src/systems/deepWatersFishItems.js';
import { SIGIL_STONE_TEMPLATES, SIGIL_STONE_TEMPLATE, sigilStone, WELKYND_SHARD_TEMPLATES } from '../src/systems/gateSpoils.js';   // LOOT9: the Welkynd Shard's row, bound beside the Stone's
import { THUNDERLOCK_TEMPLATES } from '../src/systems/thunderlock.js';
import { CSA_ITEM_TEMPLATES } from '../src/systems/comeSailAwayItems.js';   // THE MERGE: main's Come Sail Away registers the sixth
import { RRI_TEMPLATES, RRI_TEMPLATE_PATCHES } from '../src/systems/rriItems.js';
import { FORAGING_TEMPLATES } from '../src/systems/foragingLaw.js';   // MERGE 2: the professions branch's two registrars (FORAGE1, PROF2-PROF4)
import { MINING_TEMPLATE_ROWS, WOOD_TEMPLATE_ROWS, REPAIR_KIT_ROW } from '../src/systems/profTemplates.js';
import { STORES_ROW } from '../src/systems/naval/navalStores.js';   // SEA-REPAIR: the carpenter's stores' row
import { createTradePack, tradeRefusal } from '../src/systems/tradePack.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { realmIo, realmCreate, realmFetch, realmPut, realmTradeCall, realmJoin, realmDelete, createRealmSession, realmGoldAct, realmTradeEscrow } from '../src/systems/realmSaves.js';
import { webcrypto } from 'node:crypto';
import { accountGuilds, accountHomes, accountDecor } from '../src/net/accountClient.js';
import { GUILD_FOUND_GOLD, GUILD_FOUND_RENOWN, GUILD_RANK_MEMBER } from '../src/net/guildLaw.js';
import { renownXpFor } from '../src/net/renown.js';
import { homeSaleRefund } from '../src/net/homeLaw.js';
import { decorRefund } from '../src/net/decorLaw.js';
import { empireJoin } from '../src/systems/worldTick.js';
import { createOnlineHomes, buyOnlineHome, sellOnlineHome, homeRefund } from '../src/systems/onlineHomes.js';
import { TradeSession } from '../src/net/tradeSession.js';
import { applyCustoms, liquidWealthOf, stashedItemLists } from '../src/systems/realmCustoms.js';
import { LETTER_OF_CREDIT_TEMPLATE, goldStack } from '../src/systems/inventory.js';
import { LOOT_CONTAINER_TYPES } from '../src/systems/sceneCache.js';
import { createBankAccounts } from '../src/systems/banking.js';
import { freshSave, layRecord } from './realmSeat.mjs';   // AUDIT REALM2 S1: a first save is a new character's
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

// ---- the service, as test/realm4.test.js stands it -------------------------------------------------------------------

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
function r2() {
  const m = new Map();
  return {
    _map: m,
    async put(key, body) { m.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)))); return { key }; },
    async get(key) {
      const v = m.get(key);
      return v === undefined ? null : { key, size: v.byteLength, body: v, async text() { return new TextDecoder().decode(v); } };
    },
    async delete(key) { m.delete(key); },
    async list({ prefix = '' } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
function fakeStorage() {
  const m = new Map();
  return { _map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
/** One service; `player()` is a signed-in guest account on its own device. */
async function realm() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  async function player() {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    return { g, storage, env, io: realmIo({ fetch: (url, init) => worker.fetch(new Request(url, init), env), storage }) };
  }
  return { env, player };
}
/** A realm character with its first save: `{ id, lease, seq }` after the checkpoint. AUDIT REALM2 S1: the first save a
 *  new character's (the service reads it), and `save` - the record the pins count from - laid over it at that sequence. */
async function character(P, name, save) {
  const made = (await realmCreate(P.io, name)).data;
  const put = await realmPut(P.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name })));
  assert.equal(put.ok, true);
  layRecord(P.env, made.id, save);
  return { id: made.id, lease: made.lease, seq: 1 };
}
const record = async (io, id) => { const r = await realmFetch(io, id); return { seq: r.seq, save: JSON.parse(r.text) }; };
const dagger = () => createWeapon(113, 9, () => 0.5);

// ---- F1: the service's trade law binds as the game does ---------------------------------------------------------------

test('AUDIT REALM F1: a Sigil Stone never changes hands through the realm - the service\'s law binds by the row as well as the mark (itemBound.js isBound), so two halves naming a stone are refused and move nothing', { timeout: 60_000 }, async () => {
  const stone = sigilStone();
  assert.equal(stone.bound, undefined, 'a stone\'s record carries no mark of its own - its row binds it');
  // the law over plain save records, beside the pack's own
  const table = [
    [stone, false],
    [{ ...stone, stackCount: 7 }, false],
    [{ ...stone, bound: false }, false],   // no field on the record unbinds what the row binds
    [{ ...dagger(), bound: true }, false],   // SS4: the Broker's ware, bound by its own mark
    [dagger(), true],
  ];
  for (const [rec, may] of table) {
    const plain = JSON.parse(JSON.stringify(rec));
    assert.equal(tradeableRecord(plain), may, JSON.stringify(plain).slice(0, 90));
    assert.equal(boundRecord(plain), isBound(rec), 'the service reads a binding as the game does');
    assert.equal(tradeRefusal(rec) === null, may, 'the pack\'s own law says the same');
  }
  // the service, driven: two colluding halves - A gives a stone off its stack of three, B takes it - are refused whole
  const r = await realm();
  const A = await r.player(), B = await r.player();
  A.char = await character(A, 'Arthago', { name: 'Arthago', items: [{ ...stone, stackCount: 3 }], goldPieces: 50 });
  B.char = await character(B, 'Brisienna', { name: 'Brisienna', items: [dagger()], goldPieces: 50 });   // enough to pay: only the stone refuses
  const before = [await record(A.io, A.char.id), await record(B.io, B.char.id)];
  const give = { items: [{ ...stone, stackCount: 1 }], gold: 0 }, get = { items: [], gold: 10 };
  const ask = (P, sid, g, t) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: P.char.seq, sid, give: g, get: t, pick: g.items.map((_, i) => i) });
  assert.deepEqual((await ask(A, 'sidstone1', give, get)).data, { state: 'waiting' });
  assert.deepEqual((await ask(B, 'sidstone1', get, give)).data, { state: 'refused', why: 'goods' }, 'A\'s record cannot back a bound piece');
  assert.deepEqual([await record(A.io, A.char.id), await record(B.io, B.char.id)], before, 'both records as they were: three stones with A, none with B');
});

test('AUDIT REALM F1: BOUND_TEMPLATES is every row the game registers with `bound` - the classic table, each registrar\'s rows and RRI\'s patches - and the registrars are the eight it reads (Come Sail Away\'s the sixth, at the merge with main; Foraging\'s and the professions\' the seventh and eighth, at MERGE 2)', () => {
  const rows = [
    ...ITEM_TEMPLATES.map((t, i) => ({ ...t, index: t.index ?? i })),
    ...SURVIVAL_TEMPLATES, ...DEEP_WATERS_FISH_TEMPLATES, ...SIGIL_STONE_TEMPLATES, ...WELKYND_SHARD_TEMPLATES, ...THUNDERLOCK_TEMPLATES, ...CSA_ITEM_TEMPLATES, ...RRI_TEMPLATES, ...RRI_TEMPLATE_PATCHES,
    ...FORAGING_TEMPLATES, ...MINING_TEMPLATE_ROWS, ...WOOD_TEMPLATE_ROWS, REPAIR_KIT_ROW,   // MERGE 2: Foraging's and the professions' rows - none bound: a material and a tool change hands
    STORES_ROW,   // SEA-REPAIR: the carpenter's stores - not bound: timber and pitch change hands
    ...REST_ITEM_ROWS,   // REST6: the seven rest supplies - none bound: a Bedroll or a Tonic changes hands
  ];
  assert.deepEqual(rows.filter((t) => t.bound === true).map((t) => t.index).sort((a, b) => a - b), [...BOUND_TEMPLATES]);
  assert.ok(BOUND_TEMPLATES.includes(SIGIL_STONE_TEMPLATE));
  // PIN MOVED (SEA-REPAIR): the carpenter's stores the ninth registrar - a tenth must join the list above, or its bound rows would pass the service unseen
  const registrars = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js') && /registerCustomTemplates\(|registerTemplateOverrides\(/.test(src(p)) && p !== 'src/systems/itemTemplates.js') registrars.push(p);
    }
  };
  walk('src');
  assert.deepEqual(registrars.sort(), ['src/systems/comeSailAwayItems.js', 'src/systems/deepWatersFishItems.js', 'src/systems/foragingInstall.js', 'src/systems/gateSpoils.js', 'src/systems/naval/navalStores.js', 'src/systems/profTemplates.js', 'src/systems/restItems.js', 'src/systems/rriInstall.js', 'src/systems/survival/items.js', 'src/systems/thunderlock.js']);   // SEA-REPAIR: the ninth, the carpenter's stores; REST6: the tenth, the rest supplies
  // and the honest client never offers one: the window's pack refuses it before a half is ever written
  const holder = { items: [{ ...sigilStone(), stackCount: 2 }], goldPieces: 0 };
  assert.equal(createTradePack(holder).offerable(holder.items[0]), tradeRefusal(holder.items[0]));
  assert.notEqual(tradeRefusal(holder.items[0]), null);
});

// ---- F2: customs caps the wealth a character left in the world too ----------------------------------------------------

// AUDIT REALM2 T5 re-aimed this pin: F2 left a shelf, a body, a treasure pile and a dungeon's `piles` to the world - but the
// pack fills any of them, and the save carries them back, so customs counts and takes from every one
// (test/auditrealm2_customs.test.js).
test('AUDIT REALM F2: customs counts every coin and letter the character owns wherever it lies - the wagon\'s letters, a house chest, a storage piece, a pile dropped in a room, on a street or in a dungeon - and takes the excess from those stashes first (AUDIT REALM2 T5: the world\'s loot with them)', () => {
  const letter = (value) => ({ group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value });
  const T = LOOT_CONTAINER_TYPES;
  const scene = {
    sceneName: 'house',
    lootContainers: [
      { containerType: T.HouseContainers, key: 'container:0', items: [goldStack(40_000), letter(60_000)] },
      { containerType: T.ShopShelves, key: 'shelf:0', items: [letter(9_999)] },   // a shop's stock: a closed shop's shelf opens both ways
      { containerType: T.CorpseMarker, key: 'body:0', items: [goldStack(7_777)] },   // a body: the pack fills it too
    ],
    droppedPiles: [{ pos: [0, 0, 0], items: [goldStack(15_000)] }],
    decorItems: { 'piece-1': [goldStack(25_000), letter(5_000)] },
  };
  const street = { sceneName: 'street', lootContainers: [{ containerType: T.DroppedLoot, items: [goldStack(1_000)] }, { containerType: T.RandomTreasure, items: [goldStack(4_444)] }] };
  const open = { level: 1, goldPieces: 10_000, items: [letter(3_000)], wagonItems: [letter(100_000), goldStack(2_000)], bankAccounts: createBankAccounts(),
    sceneCache: { permanentScenes: ['house'], scenes: [scene, street] }, dungeon: null, world: { piles: [{ items: [goldStack(8_000)] }] } };
  // before AUDIT REALM these crossed uncapped: 100,000 in a wagon letter, 145,000 in the house and 9,000 on the floors
  // (and before AUDIT REALM2 T5, the shelf's, the body's and the treasure's 22,220)
  assert.equal(liquidWealthOf(open), 10_000 + 3_000 + 102_000 + (40_000 + 60_000 + 15_000 + 25_000 + 5_000) + 1_000 + 8_000 + (9_999 + 7_777 + 4_444));
  const stashed = stashedItemLists(open);
  assert.ok(stashed.includes(scene.lootContainers[0].items) && stashed.includes(scene.decorItems['piece-1']) && stashed.includes(scene.droppedPiles[0].items));
  assert.ok(stashed.includes(scene.lootContainers[1].items) && stashed.includes(scene.lootContainers[2].items) && stashed.includes(street.lootContainers[1].items), 'AUDIT REALM2 T5: a shelf, a body and a treasure pile too');
  const r = applyCustoms(open);
  assert.equal(r.allowance, 30_000);
  assert.equal(liquidWealthOf(open), 30_000, 'what is left is the allowance, wherever it lay');
  assert.equal(r.taken, 291_220 - 30_000);
  // the stashes went first - so the wagon, the pack and the purse the player sees at the door are what stays
  assert.deepEqual([scene.lootContainers[0].items, scene.decorItems['piece-1'], scene.droppedPiles[0].items, street.lootContainers[0].items, open.world.piles[0].items], [[], [], [], [], []], 'every stash emptied, and the emptied records gone from their lists');
  assert.equal(open.wagonItems.length, 2);
  assert.equal(open.wagonItems[0].value + open.wagonItems[1].stackCount, 30_000 - 10_000 - 3_000 + 0, 'the wagon keeps what the allowance leaves after the pack and the purse');
  assert.deepEqual([open.items[0].value, open.goldPieces], [3_000, 10_000]);
  // AUDIT REALM2 T5: the world's loot went with the stashes
  assert.deepEqual([scene.lootContainers[1].items, scene.lootContainers[2].items, street.lootContainers[1].items], [[], [], []]);
  // a dungeon save: its `droppedLoot` is the player's, its `piles` are the dungeon's treasure - which the pack fills too
  const deep = { level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: createBankAccounts(), dungeon: { id: 1 },
    world: { piles: [{ items: [goldStack(90_000)] }], droppedLoot: [{ items: [goldStack(50_000)] }] } };
  assert.equal(liquidWealthOf(deep), 140_000);
  applyCustoms(deep);
  assert.deepEqual([deep.world.droppedLoot[0].items.map((it) => it.stackCount), deep.world.piles[0].items], [[30_000], []]);
});

// ---- lane 1 and lane 2: the service settles exactly, and answers each half its own outcome -----------------------------

const letterOf = (value) => ({ group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, name: 'Letter of Credit', value });
const lettersIn = (save) => (save.items ?? []).filter((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE).map((it) => it.value);

test('AUDIT REALM L1-F1: the pack names where each offered record stands in the save it checkpoints - the pack\'s own order, never the offer\'s; one not in the pack is -1', () => {
  const [a, b, c] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  const pack = createTradePack({ items: [a, b, c], goldPieces: 0 });
  assert.deepEqual(pack.picks([{ item: c, count: 1 }, { item: a, count: 1 }]), [2, 0]);
  assert.deepEqual(pack.picks([{ item: { name: 'a' }, count: 1 }]), [-1], 'the very object, never a look-alike');
});

test('AUDIT REALM L1-F1: a trade gives the very record its half picked, and a letter of credit IS its value - the 10-gold letter leaves, the 100,000 stays; a half that names one letter and picks the other moves nothing', { timeout: 60_000 }, async () => {
  const r = await realm();
  const A = await r.player(), B = await r.player();
  A.char = await character(A, 'Arthago', { name: 'Arthago', items: [letterOf(100_000), letterOf(10)], goldPieces: 0 });
  B.char = await character(B, 'Brisienna', { name: 'Brisienna', items: [], goldPieces: 50 });
  const ask = (P, sid, give, get, pick) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: P.char.seq, sid, give, get, pick });
  const giveA = { items: [letterOf(10)], gold: 0 }, giveB = { items: [], gold: 5 };
  // picking the 100,000 letter for an offer of 10: refused - the value is what a letter is
  assert.deepEqual((await ask(A, 'sidlet01', giveA, giveB, [0])).data, { state: 'waiting' });
  assert.deepEqual((await ask(B, 'sidlet01', giveB, giveA, [])).data, { state: 'refused', why: 'goods' });
  // the letter it offers, at its place: the 10 leaves, the 100,000 stays
  assert.deepEqual((await ask(A, 'sidlet02', giveA, giveB, [1])).data, { state: 'waiting' });
  const done = await ask(B, 'sidlet02', giveB, giveA, []);
  assert.deepEqual([done.data.state, done.data.items.map((it) => it.value)], ['done', [10]]);
  assert.deepEqual([lettersIn((await record(A.io, A.char.id)).save), lettersIn((await record(B.io, B.char.id)).save)], [[100_000], [10]]);
});

test('AUDIT REALM L1-F4 / L2-F1: a settle landing between the first side\'s reads is answered as the settle - the record is read before the trade, so the poll never takes a done trade for a moved record', { timeout: 60_000 }, async () => {
  const r = await realm();
  const A = await r.player(), B = await r.player();
  A.char = await character(A, 'Arthago', { name: 'Arthago', items: [dagger()], goldPieces: 50 });
  B.char = await character(B, 'Brisienna', { name: 'Brisienna', items: [], goldPieces: 50 });
  const giveA = { items: [JSON.parse(JSON.stringify((await record(A.io, A.char.id)).save.items[0]))], gold: 0 }, giveB = { items: [], gold: 20 };
  const ask = (P, give, get, pick) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: P.char.seq, sid: 'sidrace9', give, get, pick });
  assert.deepEqual((await ask(A, giveA, giveB, [0])).data, { state: 'waiting' });
  // A's next poll: B's half settles the trade the moment A's record has been read, before A reads the trade
  const realPrepare = r.env.DB.prepare.bind(r.env.DB);
  let armed = true;
  r.env.DB.prepare = (sql) => {
    const st = realPrepare(sql);
    if (!/^SELECT seq, lease, bytes, obj, prev FROM realm_characters/.test(sql)) return st;
    let args = [];
    const wrap = { ...st, bind(...a) { args = a; st.bind(...a); return wrap; }, async first() {
      const row = await st.first();
      if (armed && args[0] === A.char.id) { armed = false; r.env.DB.prepare = realPrepare; assert.equal((await ask(B, giveB, giveA, [])).data.state, 'done'); }
      return row;
    } };
    return wrap;
  };
  const polled = await ask(A, giveA, giveB, [0]);
  assert.deepEqual([polled.data?.state, polled.data?.seq], ['done', 2], 'the first side is told the settle, never "seq"');
  const [ra, rb] = [(await record(A.io, A.char.id)).save, (await record(B.io, B.char.id)).save];
  assert.deepEqual([ra.items.length, ra.goldPieces, rb.items.length, rb.goldPieces], [0, 70, 1, 30], 'one dagger and 100 gold in the realm, as before');
});

test('AUDIT REALM L1-F6: an outcome is its own half\'s - a later trade under a spent sid is refused and moves nothing, and a character that was no party is told nothing', { timeout: 60_000 }, async () => {
  const r = await realm();
  const A = await r.player(), B = await r.player();
  A.char = await character(A, 'Arthago', { name: 'Arthago', items: [dagger()], goldPieces: 50 });
  B.char = await character(B, 'Brisienna', { name: 'Brisienna', items: [], goldPieces: 50 });
  const giveA = { items: [JSON.parse(JSON.stringify((await record(A.io, A.char.id)).save.items[0]))], gold: 0 }, giveB = { items: [], gold: 20 };
  const ask = (P, over) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: P.char.seq, sid: 'sidspent1', ...over });
  await ask(A, { give: giveA, get: giveB, pick: [0] });
  // the first side's half, waiting, is its own: the same sid with another half is no half of it
  assert.equal((await ask(A, { give: { items: [], gold: 1 }, get: giveB, pick: [] })).error, 'trade-spent');
  assert.equal((await ask(B, { give: giveB, get: giveA, pick: [] })).data.state, 'done');
  const before = [await record(A.io, A.char.id), await record(B.io, B.char.id)];
  assert.equal((await ask(B, { give: giveB, get: giveA, pick: [] })).data.state, 'done', 'the second side, asking again with its half, is told its outcome');
  // a second trade under the same sid, each side at its new sequence: no half of the old trade - refused, nothing moves
  const again = await realmTradeCall(A.io, { id: A.char.id, lease: A.char.lease, seq: 2, sid: 'sidspent1', give: { items: [], gold: 1 }, get: { items: [], gold: 0 }, pick: [] });
  assert.equal(again.error, 'trade-spent');
  const againB = await realmTradeCall(B.io, { id: B.char.id, lease: B.char.lease, seq: 2, sid: 'sidspent1', give: { items: [], gold: 1 }, get: { items: [], gold: 0 }, pick: [] });
  assert.equal(againB.error, 'trade-spent', 'nor the second side\'s');
  assert.deepEqual([await record(A.io, A.char.id), await record(B.io, B.char.id)], before, 'nothing moved - no receipt applied twice');
  // the old half asked again is told its outcome; the same account's other character is told nothing
  assert.equal((await ask(A, { give: giveA, get: giveB, pick: [0] })).data.state, 'done');
  const other = await character(B, 'Cyrus', { name: 'Cyrus', items: [], goldPieces: 0 });
  assert.equal((await realmTradeCall(B.io, { id: other.id, lease: other.lease, seq: 1, sid: 'sidspent1', give: giveB, get: giveA, pick: [] })).error, 'trade-spent');
});

// ---- lane 1 and lane 2: a gold act's lost answer is read by the record, asked first ----------------------------------

const { subtle } = webcrypto;
/** Registered accounts (homes and guilds are an account's), each playing a realm character with a first save. */
async function registered() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  async function player(handle, save, { renown = GUILD_FOUND_RENOWN } = {}) {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const reg = await worker.fetch(new Request('https://accounts.invalid/v1/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: g.secret, handle, password: 'a good long one', ...ACCEPTED }),
    }), env);
    assert.equal(reg.status, 200);
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    const door = { lose: null };
    const fetch = async (url, init) => {
      const res = await worker.fetch(new Request(url, init), env);
      if (door.lose && String(url).includes(door.lose)) { door.lose = null; throw new TypeError('the answer was lost'); }
      return res;
    };
    const io = realmIo({ fetch, storage });
    const made = (await realmCreate(io, handle)).data;
    assert.equal((await realmPut(io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: handle })))).ok, true);
    layRecord(env, made.id, save);   // AUDIT REALM2 S1: the record the pins count from, over a new character's first save
    env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(g.id, made.id, handle, renownXpFor(renown), 1, 1);   // RENOWN-CHAR: the character's own track
    const session = createRealmSession({ io, id: made.id, lease: made.lease, seq: 1 });
    return { id: g.id, io, door, char: made.id, lease: made.lease, session, guilds: accountGuilds({ fetch, storage }), homes: accountHomes({ fetch, storage }), decor: accountDecor({ fetch, storage }) };
  }
  const saveOf = async (P) => JSON.parse((await realmFetch(P.io, P.char)).text);
  return { env, player, saveOf };
}
const noWait = () => Promise.resolve();

test('AUDIT REALM L1-F2 / L2-F2: a founding whose answer is lost is asked again and read as landed - the service answers where the record stands before "guild-already" - paid once; a record one on at the first asking is no landing', { timeout: 60_000 }, async () => {
  const s = await registered();
  const A = await s.player('Arthago', { name: 'Arthago', goldPieces: GUILD_FOUND_GOLD + 1_000, items: [] });
  const purse = { gold: GUILD_FOUND_GOLD + 1_000 };
  let calls = 0;
  A.door.lose = '/v1/guilds/found';   // the first founding lands on the service; its answer never comes back
  const r = await realmGoldAct({
    session: A.session, checkpoint: () => {}, wait: noWait,
    reserve: () => { purse.gold -= GUILD_FOUND_GOLD; return () => { purse.gold += GUILD_FOUND_GOLD; }; },
    call: (at) => { calls++; return A.guilds.found({ character: A.char, name: 'The Iron Oath', tag: 'IRON', realm: at }).catch(() => ({ ok: false, error: 'offline' })); },
  });
  assert.deepEqual([r.ok, r.landed, calls], [true, true, 2], 'asked twice, read as the founding, landed');
  assert.equal(purse.gold, 1_000, 'paid once - never given back');
  assert.equal((await s.saveOf(A)).goldPieces, 1_000, 'the record paid once');
  assert.equal(s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM guilds').get().n, 1);
  // the first asking finds the record already on: nothing this act sent moved it - unknown, the session ends
  const B = await s.player('Brisienna', { name: 'Brisienna', goldPieces: GUILD_FOUND_GOLD, items: [] });
  await realmPut(B.io, B.char, { lease: B.lease, seq: 2 }, JSON.stringify({ name: 'Brisienna', goldPieces: GUILD_FOUND_GOLD, items: [] }));   // a move this session never made
  const lost = await realmGoldAct({ session: B.session, checkpoint: () => {}, wait: noWait, call: (at) => B.guilds.found({ character: B.char, name: 'Second', tag: 'TWO', realm: at }) });
  assert.deepEqual([lost.ok, lost.unknown, B.session.lost], [false, true, 'unknown']);
});

test('AUDIT REALM L1-F3: a realm record is paid back only what realm records paid in - another character\'s house is no sale, a treasury deposit no record made is no withdrawal, a house from before the realm comes back as a house, a piece no record paid for gives nothing back', { timeout: 60_000 }, async () => {
  const s = await registered();
  const A = await s.player('Arthago', { name: 'Arthago', goldPieces: 500_000, items: [], bankAccounts: new Array(20).fill(0).map(() => ({ accountGold: 0 })) });
  const at = () => ({ id: A.char, lease: A.lease, seq: A.session.seq });
  // (a) a house held by a character no record stands behind, at the price cap - the realm record's sale is refused. One
  // from before the realm: a claim is a realm character's alone now (AUDIT REALM2 S2)
  assert.equal((await A.homes.claim({ mapId: 1234, buildingKey: 5, region: 17, character: 'an-offline-id-0001', price: 10_000_000 })).error, 'realm-only');
  s.env.DB._raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (1234, 5, ?, 'an-offline-id-0001', 'Arthago', 17, 'private', 10000000, 1)").run(A.id);
  const sale = await A.homes.release(1234, 5, at());
  assert.deepEqual([sale.ok, sale.error], [false, 'no-home'], 'not the realm character\'s house');
  assert.equal((await s.saveOf(A)).bankAccounts[17].accountGold, 0);
  // (c) a house customs carried in from before the realm (no record paid for it): no gold - and HOME-CROSSED (FIELD BUGS
  // 2026-09-30, PIN MOVED): no sale at all; it was sold for nothing and taken, house and pieces
  s.env.DB._raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (77, 9, ?, ?, 'Arthago', 17, 'private', 10000000, 1)").run(A.id, A.char);
  s.env.DB._raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at) VALUES (77, 9, 'p1', 41000, '{"pos":[0,0,0],"rot":[0,0,0],"scale":1,"paid":400}', 1)`).run();
  const old = await A.homes.release(77, 9, at());
  assert.deepEqual([old.ok, old.error], [false, 'home-crossed'], 'a house and a piece no record paid for: kept, no gold');
  assert.ok(s.env.DB._raw.prepare('SELECT 1 FROM home_decor WHERE map_id = 77 AND building_key = 9').get(), 'its piece stands');
  assert.equal((await s.saveOf(A)).bankAccounts[17].accountGold, 0);
  // a house the record bought pays back the deed share of what it paid
  const bought = await A.homes.claim({ mapId: 55, buildingKey: 3, region: 17, character: A.char, price: 100_000, realm: at() });
  assert.equal(bought.ok, true);
  const sold = await A.homes.release(55, 3, { id: A.char, lease: A.lease, seq: bought.data.realm.seq });
  assert.equal(sold.data.refund, homeSaleRefund(100_000));
  // (b) a deposit by a character no record stands behind is no gold a realm record may take out
  const found = await A.guilds.found({ character: A.char, name: 'The Iron Oath', tag: 'IRON', realm: { id: A.char, lease: A.lease, seq: sold.data.realm.seq } });
  assert.equal(found.ok, true);
  const guildId = s.env.DB._raw.prepare('SELECT id FROM guilds').get().id;
  s.env.DB._raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, 'an-offline-id-0002', ?, ?, 'Old', 1)").run(A.id, guildId, GUILD_RANK_MEMBER);
  assert.equal((await A.guilds.deposit('an-offline-id-0002', 1_000_000)).ok, true, 'the old lane still takes a deposit on its word');
  const took = await A.guilds.withdraw(A.char, 1_000_000, { id: A.char, lease: A.lease, seq: found.data.realm.seq });
  assert.deepEqual([took.ok, took.error], [false, 'guild-treasury-old']);
  // what a record put in, a record may take out
  const inAt = { id: A.char, lease: A.lease, seq: found.data.realm.seq };
  const dep = await A.guilds.deposit(A.char, 5_000, inAt, 17);
  assert.equal(dep.ok, true);
  const out = await A.guilds.withdraw(A.char, 5_000, { id: A.char, lease: A.lease, seq: dep.data.realm.seq });
  assert.equal(out.ok, true);
  assert.deepEqual({ ...s.env.DB._raw.prepare('SELECT treasury, realm_gold FROM guilds').get() }, { treasury: 1_000_000, realm_gold: 0 });
  // what records paid in never stands above what the treasury holds: the old lane emptying it takes the realm's part too,
  // so gold the old lane puts back in is never a record's to take out
  const dep2 = await A.guilds.deposit(A.char, 5_000, { id: A.char, lease: A.lease, seq: out.data.realm.seq }, 17);
  assert.equal(dep2.ok, true);
  s.env.DB._raw.prepare('UPDATE guild_members SET rank = 0 WHERE char_id = ?').run('an-offline-id-0002');   // a guildmaster the old lane plays
  for (const n of [1_000_000, 5_000]) assert.equal((await A.guilds.withdraw('an-offline-id-0002', n)).ok, true);   // GUILD_MOVE_MAX a move
  assert.equal((await A.guilds.deposit('an-offline-id-0002', 5_000)).ok, true);
  const took2 = await A.guilds.withdraw(A.char, 5_000, { id: A.char, lease: A.lease, seq: dep2.data.realm.seq });
  assert.deepEqual([took2.ok, took2.error], [false, 'guild-treasury-old']);
});

test('AUDIT REALM L1-F3: the purse takes only what the service paid the record - a house from before the realm sells for nothing, never the client\'s share of its price; a claim answered `repeat` gives the reserve back', { timeout: 60_000 }, async () => {
  const s = await registered();
  const A = await s.player('Arthago', { name: 'Arthago', goldPieces: 50_000, items: [] });
  const act = (o) => realmGoldAct({ session: A.session, checkpoint: () => {}, wait: noWait, ...o });
  const homes = createOnlineHomes({ api: A.homes, character: () => A.char });
  s.env.DB._raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (77, 9, ?, ?, 'Arthago', 17, 'private', 1000000, 1)").run(A.id, A.char);
  const credited = [];
  const sold = await sellOnlineHome(homes, { mapId: 77, buildingKey: 9, credit: (n) => credited.push(n), realm: { act } });
  // HOME-CROSSED (FIELD BUGS 2026-09-30, PIN MOVED): refused, where it sold for nothing
  assert.deepEqual([sold.ok, sold.error, credited], [false, 'home-crossed', []], `nothing - never homeRefund(1,000,000) = ${homeRefund(1_000_000)}`);
  // a house the record bought pays back the deed share of what it paid
  const purse = { gold: 50_000 };
  const buy = () => buyOnlineHome(homes, {
    mapId: 55, buildingKey: 3, region: 17, price: 1_000, afford: (n) => n <= purse.gold,
    pay: (n) => { purse.gold -= n; }, refund: (n) => { purse.gold += n; }, realm: { act },
  });
  assert.equal((await buy()).ok, true);
  assert.equal(purse.gold, 49_000);
  // pressed again once the first had answered: the service says `repeat` and moves nothing - nor does the purse
  assert.equal((await buy()).ok, true);
  assert.equal(purse.gold, 49_000, 'paid once');
  assert.equal((await s.saveOf(A)).goldPieces, 49_000, 'as the record holds it');
  const back = [];
  const sale = await sellOnlineHome(homes, { mapId: 55, buildingKey: 3, credit: (n) => back.push(n), realm: { act } });
  assert.deepEqual([sale.ok, back], [true, [homeSaleRefund(1_000)]]);
});

test('AUDIT REALM L1-F3: a placed piece pays back half of what records paid for it - placed by the record, half; shrunk, half of the part records paid; one from before the realm, nothing', { timeout: 60_000 }, async () => {
  const s = await registered();
  const A = await s.player('Arthago', { name: 'Arthago', goldPieces: 500_000, items: [] });
  const bought = await A.homes.claim({ mapId: 55, buildingKey: 3, region: 17, character: A.char, price: 1_000, realm: { id: A.char, lease: A.lease, seq: 1 } });
  let seq = bought.data.realm.seq;
  const where = () => ({ id: A.char, lease: A.lease, seq });
  const piece = { id: 'd1', model: 41000, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, paid: 400 };
  const placed = await A.decor.place({ mapId: 55, buildingKey: 3, character: A.char, piece, realm: where() });
  assert.deepEqual([placed.ok, placed.data.gold], [true, -400]);
  seq = placed.data.realm.seq;
  const removed = await A.decor.remove({ mapId: 55, buildingKey: 3, character: A.char, id: 'd1', realm: where() });
  assert.deepEqual([removed.ok, removed.data.gold], [true, decorRefund(400)], 'the record paid it all: half back');
  seq = removed.data.realm.seq;
  // a piece from before the realm (no record paid for it) - its removal names the record and gets nothing
  s.env.DB._raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at) VALUES (55, 3, 'old', 41000, '{"pos":[0,0,0],"rot":[0,0,0],"scale":1,"paid":400}', 1)`).run();
  const gone = await A.decor.remove({ mapId: 55, buildingKey: 3, character: A.char, id: 'old', realm: where() });
  assert.equal(gone.ok, true);
  assert.equal(gone.data.gold ?? 0, 0, 'nothing back for gold no record paid');
  assert.equal((await s.saveOf(A)).goldPieces, 500_000 - 1_000 - 400 + decorRefund(400));
});

test('AUDIT REALM L1-F7: a realm character deleted takes its house, its guild place and its Renown with it - and a guildmaster with members hands the guild over first', { timeout: 60_000 }, async () => {
  const s = await registered();
  const A = await s.player('Arthago', { name: 'Arthago', goldPieces: 500_000, items: [] });
  const claimed = await A.homes.claim({ mapId: 7, buildingKey: 9, region: 17, character: A.char, price: 1_000, realm: { id: A.char, lease: A.lease, seq: 1 } });
  const founded = await A.guilds.found({ character: A.char, name: 'The Iron Oath', tag: 'IRON', realm: { id: A.char, lease: A.lease, seq: claimed.data.realm.seq } });
  assert.equal(founded.ok, true);
  const guildId = s.env.DB._raw.prepare('SELECT id FROM guilds').get().id;
  const B = await s.player('Brisienna', { name: 'Brisienna', goldPieces: 500_000, items: [] });
  s.env.DB._raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, 'x-char-0001', ?, ?, 'Mira', 1)").run(B.id, guildId, GUILD_RANK_MEMBER);
  const held = await realmDelete(A.io, A.char);
  assert.deepEqual([held.ok, held.error], [false, 'guild-master-leaves'], 'a guildmaster with members hands the guild over first');
  s.env.DB._raw.prepare("DELETE FROM guild_members WHERE char_id = 'x-char-0001'").run();
  assert.equal((await realmDelete(A.io, A.char)).ok, true);
  const left = (table) => s.env.DB._raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE char_id = ?`).get(A.char).n;
  assert.deepEqual([left('homes'), left('guild_members'), left('renown_tracks')], [0, 0, 0], 'nothing stands under the deleted id');
  assert.equal((await B.homes.claim({ mapId: 7, buildingKey: 9, region: 17, character: B.char, price: 1_000, realm: { id: B.char, lease: B.lease, seq: 1 } })).ok, true, 'the house is for sale again');
});

test('AUDIT REALM L3-F8: a loan already due at the join is settled as an overdue one - customs\' unpaid call defaults, never kept as the Empire\'s one loan in good standing', () => {
  const accounts = createBankAccounts();
  Object.assign(accounts[5], { loanTotal: 4_900, loanDueDate: 1_000 });   // customs' unpaid remainder, due at the save's minute (carried to now)
  const entity = { level: 10, goldPieces: 0, items: [], bankAccounts: accounts };
  empireJoin({ entity, nowMinutes: 1_000 });
  assert.deepEqual([accounts[5].hasDefaulted, accounts[5].loanTotal > 0], [true, true], 'defaulted - the Empire keeps no loan for a newcomer');
  assert.ok(entity.legalRep[5] < 0, 'and the region\'s reputation fell');
  // a loan not yet due is the Empire's one loan, as REALM P0.3 keeps it
  const good = createBankAccounts();
  Object.assign(good[5], { loanTotal: 4_900, loanDueDate: 5_000 });
  empireJoin({ entity: { level: 10, goldPieces: 0, items: [], bankAccounts: good }, nowMinutes: 1_000 });
  assert.deepEqual([good[5].hasDefaulted, good[5].loanTotal], [false, 4_900]);
});

// ---- lane 2: the session writes over nothing it does not hold -----------------------------------------------------------

test('AUDIT REALM L1-F2 / L2-F1: the checkpoint drain takes the service one ahead as its own only when a put of its own is in doubt - any other move of the record ends the session, never a checkpoint over it', { timeout: 60_000 }, async () => {
  const r = await realm();
  const P = await r.player();
  const made = (await realmCreate(P.io, 'Nystul')).data;
  assert.equal((await realmPut(P.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave()))).ok, true);   // AUDIT REALM2 S1
  // its own put lands and its answer is lost: the next checkpoint adopts it and goes on
  const storage = P.storage;
  let loseNext = false;
  const io = realmIo({ fetch: async (url, init) => { const res = await worker.fetch(new Request(url, init), r.env); if (loseNext) { loseNext = false; throw new TypeError('lost'); } return res; }, storage });
  const s = createRealmSession({ io, id: made.id, lease: made.lease, seq: 1 });
  loseNext = true;
  assert.equal((await s.checkpoint('{"v":2}')).error, 'offline');
  assert.deepEqual(await s.checkpoint('{"v":3}'), { ok: true, seq: 3 }, 'its own landed put adopted');
  // the record moved by something this session never sent: the next checkpoint does not write over it
  assert.equal((await realmPut(P.io, made.id, { lease: made.lease, seq: 4 }, '{"elsewhere":1}')).ok, true);
  const said = [];
  const t = createRealmSession({ io, id: made.id, lease: made.lease, seq: 3, onLost: (w) => said.push(w) });
  assert.deepEqual(await t.checkpoint('{"v":4}'), { ok: false, error: 'seq' });
  assert.deepEqual([said, (await realmFetch(P.io, made.id)).text], [['seq'], '{"elsewhere":1}'], 'lost, and the record as the other write left it');
});

test('AUDIT REALM L2-F6: the realm\'s escrow abandons by ending the session - once, to the door, as a lost answer does', () => {
  const lost = [];
  const session = createRealmSession({ io: null, id: 'r' + '0'.repeat(20), lease: 'a'.repeat(32), seq: 3, onLost: (why) => lost.push(why) });
  const ticket = realmTradeEscrow({ session, checkpoint: () => {} }).hold();
  ticket.abandon();
  ticket.abandon();
  assert.deepEqual([session.lost, lost], ['unknown', ['unknown']]);
});

test('AUDIT REALM L2-F6 / L5-F6: a settle whose goods this game refuses (a sender\'s record carrying what its offer never showed) ends the realm session - never a pack given only the gold and checkpointed over the record', () => {
  let abandoned = 0;
  const reserved = [];
  const pack = {
    offerable: () => null, wire: (e) => e.map((x) => x.item), picks: (e) => e.map((_, i) => i), fits: () => true, gold: () => 100,
    take: (entries) => { reserved.push(...entries); return { taken: entries }; }, restore: () => { throw new Error('a settled trade restores nothing'); },
    unwire: () => null, give: () => { throw new Error('nothing is given'); },
  };
  const s = new TradeSession({ sid: 'sidunw01', me: 'peerAAAA', peer: 'peerBBBB', pack, send: () => true, escrow: { hold: () => ({ settle: () => Promise.resolve(), release: () => {}, abandon: () => { abandoned++; } }) } });
  s.mine = { entries: [{ item: { templateIndex: 113 }, count: 1 }], gold: 0 };
  s._settle();
  s._settled({ ok: true, items: [{ ...sigilStone() }], gold: 5 });
  assert.deepEqual([abandoned, s.phase], [1, 'done']);
  assert.match(s.lastMessage, /join again/);
});
