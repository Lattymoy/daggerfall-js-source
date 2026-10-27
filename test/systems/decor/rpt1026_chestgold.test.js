// RPT1026-CHESTGOLD (two private reports): a shared chest's gold, taken, was the purse's at the click and the bin's still
// when the close was refused - a hold run out (180 s), or the owner setting the chest private under a guest's window.
// The window here is the real one's moves (itemTransfer.js applyTransfer, as both inventory windows end a transfer), its
// door the host's (decorGrants.js bindDecorHouseFrom), its act the realm's (realmSaves.js realmGoldAct) over a session
// whose checkpoint is the realm's own PUT, and the service the account worker over SQLite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../../server-account/src/index.js';
import { _resetKeyForTests } from '../../../server-account/src/signing.js';
import { ACCEPTED } from '../../../src/net/legalLaw.js';
import { r2, seatRealm, recordOf, realmAt } from '../../realmSeat.mjs';
import { bindDecorHouseFrom, noteDecorBin, openSharedChest, DECOR_HOLD_KEEP_MS } from '../../../src/systems/decor/decorGrants.js';
import { applyTransfer } from '../../../src/systems/item/itemTransfer.js';
import { realmGoldAct } from '../../../src/systems/realmSaves.js';
import { goldStack, ARROW_TEMPLATE } from '../../../src/systems/inventory.js';
import { accountRefusalText } from '../../../src/net/accountClient.js';
import { validLootList } from '../../../src/systems/loot/loot.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { NativeInventoryWindow } from '../../../src/ui/native/nativeInventory.js';
import { planWagonToggle, planBagToggle, SMALL_CART_TEMPLATE } from '../../../src/systems/inventorySession.js';
import { BAG_TEMPLATE } from '../../../src/net/bagLaw.js';
import { isEquipped } from '../../../src/systems/equip.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** D1 over SQLite - decoraccess.test.js's, with a hook a pin sets to land a write between a route's read and its batch. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  const out = {
    _raw: db,
    /** @type {((list: any[]) => void) | null} */
    beforeBatch: null,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        _sql: sql,
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      const hook = out.beforeBatch;
      if (hook) hook(list);
      db.exec('BEGIN');
      try { const res = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return res; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  return out;
}
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null, headers = {}) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method, headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
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
const PURSE = 1_000;
const SAVE = (name, items = [], gold = PURSE) => ({ name, level: 9, goldPieces: gold, items, stats: { strength: 60 }, bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const chestPiece = { id: 'p1', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 180 };
const binRows = (env) => env.DB._raw.prepare('SELECT uid, item FROM decor_bin').all().map((r) => ({ uid: r.uid, ...JSON.parse(r.item) }));
const binGold = (env) => binRows(env).filter((it) => it.group === 'Currency').reduce((n, it) => n + it.stackCount, 0);
/** A pile of gold as the game mints one (inventory.js goldStack), marked as a chest's row is. */
const coinRow = (n, uid = 'c0c0c0c0c0c0c0c0') => ({ ...goldStack(n), uid });
const layBin = (env, item) => env.DB._raw.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').run(HOME.mapId, HOME.buildingKey, 'p1', item.uid, JSON.stringify(item));

/** The owner's home with one chest, shared with the guest by name. */
async function sharedChest(t) {
  const { env, call, registered } = t;
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', SAVE('Aldric', [], 100_000));   // the owner buys the house
  const M = await seatRealm(env, mara, 'Mara', SAVE('Mara'));
  assert.equal((await call('POST', '/v1/homes/claim', { ...HOME, region: 17, character: A.id, price: 42000, layout: null, realm: A.at() }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: chestPiece }, aldric)).status, 200);
  const shared = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] }, aldric);
  assert.equal(shared.status, 200, JSON.stringify(shared.body));
  return { aldric, mara, A, M };
}

/**
 * A REALM CHARACTER'S GAME, as far as a chest reaches: its entity (the record's purse and pack), the realm session's
 * checkpoint (the save composed from the entity, PUT at the record's next sequence - every timer's and every act's), the
 * host's door (bindDecorHouseFrom over the service's `use`), and the window's moves.
 */
function gameOf(t, secret, id) {
  const { env, call } = t;
  const rec = recordOf(env, id);
  const entity = { name: rec.name, goldPieces: rec.goldPieces, items: [...(rec.items ?? [])], stats: { ...rec.stats }, activeEffects: [] };
  let saving = Promise.resolve();
  const served = [];   // the record's purse as each checkpoint found it - what the service left there
  const putSave = async () => {
    const at = realmAt(env, id);
    served.push(recordOf(env, id).goldPieces);
    const save = { ...recordOf(env, id), goldPieces: entity.goldPieces, items: entity.items };
    const r = await call('PUT', `/v1/realm/${id}/data`, JSON.stringify(save), secret, { 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) });
    assert.equal(r.status, 200, `the checkpoint lands: ${JSON.stringify(r.body)}`);
  };
  const checkpoint = () => { saving = saving.then(putSave); return saving; };
  const session = { transact: async (fn) => { await saving; return fn(realmAt(env, id)); } };
  const use = async (body) => {
    const r = await call('POST', '/v1/homes/decor/use', body, secret);
    return r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error, ...(Number.isSafeInteger(r.body?.seq) ? { seq: r.body.seq } : {}) };
  };
  const said = [];
  const asked = [];
  const inflight = [];
  let spec = null;
  const host = {
    homeDecor: { use: (body) => { asked.push(body.op); const r = use(body); inflight.push(r); return r; } },
    realmAct: (o) => realmGoldAct({ ...o, session, checkpoint, wait: () => Promise.resolve() }),
    decorCharacter: () => id,
  };
  const bind = () => bindDecorHouseFrom(host, entity, (l) => said.push(l), accountRefusalText, HOME.mapId, HOME.buildingKey, (s) => { spec = s; });
  const chest = () => spec.loot.items();
  const pack = () => spec.items();
  return {
    entity, said, asked, served, checkpoint, bind,
    /** every ask of the service out so far, answered */
    heard: () => Promise.all(inflight),
    async open() { bind(); noteDecorBin('p1', null); spec = null; assert.equal(await openSharedChest('p1'), true); return spec; },
    chest, pack,
    // the window's take and put: enhancedInventory.js take()/stow(), DoTransferItem's door with the pack as `to` or `from`
    take: (row, n = row.stackCount ?? 1) => spec.loot.commit('take', row, n, () => applyTransfer(row, { amount: n }, chest(), pack(), { entity, toPlayer: true })),
    put: (it, n = it.stackCount ?? 1) => spec.loot.commit('put', it, n, () => applyTransfer(it, { amount: n }, pack(), chest(), { entity, fromLocal: true })),
    close: async () => { await spec.loot.finish(); await saving; },
    /** the window's own spec, as the host hands it to an inventory window (worldModes.js interiorInventory) */
    spec: () => spec,
    saved: () => saving,
  };
}

test('RPT1026-CHESTGOLD a chest left open past its hold moves nothing - the gold taken is in the chest, never in the purse as well', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  layBin(t.env, coinRow(500));
  const g = gameOf(t, mara, M.id);
  await g.open();
  const pile = g.chest().find((it) => it.group === 'Currency');
  assert.equal(await g.take(pile), true);
  assert.equal(g.entity.goldPieces, PURSE, 'the click pays no purse');
  assert.ok(g.pack().includes(pile), 'the pile stands in the window\'s pack as itself');
  await g.checkpoint();   // a timer's checkpoint while the window is open
  assert.equal(recordOf(t.env, M.id).goldPieces, PURSE, 'and no checkpoint carries it');
  t.env.DB._raw.prepare('UPDATE decor_hold SET until = 0').run();   // the 180 s run out, as the report's three minutes
  await g.close();
  assert.ok(g.said.includes('The chest was left open too long, so nothing in it moved. Open it again.'), `the close says why nothing moved: ${g.said}`);
  assert.equal(g.entity.goldPieces, PURSE);
  assert.equal(recordOf(t.env, M.id).goldPieces, PURSE);
  assert.equal(binGold(t.env), 500, 'the gold stayed in the chest - once, there alone');
  // open again, take a handful and close at once: the settle lands, and the handful is the purse's alone
  await g.open();
  assert.equal(await g.take(g.chest().find((it) => it.group === 'Currency'), 200), true);
  assert.equal(g.entity.goldPieces, PURSE);
  await g.close();
  assert.equal(g.served.at(-1), PURSE + 200, 'the service paid the record before the checkpoint after the act');
  assert.equal(g.entity.goldPieces, PURSE + 200);
  assert.equal(recordOf(t.env, M.id).goldPieces, PURSE + 200, 'the service paid the record in the settle\'s batch');
  assert.equal(binGold(t.env), 300);
  assert.equal(recordOf(t.env, M.id).items.some((it) => it.group === 'Currency'), false, 'no pile of it in the pack');
});

// PIN MOVED (AUDIT RPT1026 B2): the owner's change is never refused by a guest's open window (a guest who kept the hold
// shut the owner out for good) - the guest's gold is the owner's chest's, poured, and the guest's close moves nothing.
test('RPT1026-CHESTGOLD the owner sets the chest private under a guest\'s open window: the gold is in the owner\'s chest once, never the guest\'s purse as well', async () => {
  const t = await stand();
  const { aldric, mara, A, M } = await sharedChest(t);
  layBin(t.env, coinRow(700));
  const g = gameOf(t, mara, M.id);
  await g.open();
  assert.equal(await g.take(g.chest().find((it) => it.group === 'Currency')), true);
  const owner = recordOf(t.env, A.id).goldPieces;
  const shut = await t.call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(t.env, A.id), op: 'set', id: 'p1', kind: 'storage', mode: 'private' }, aldric);
  assert.equal(shut.status, 200, JSON.stringify(shut.body));
  assert.deepEqual((shut.body.restored ?? []).map((it) => it.stackCount), [700], 'the pile goes home to the owner\'s chest');
  assert.equal(binGold(t.env), 0);
  await g.close();
  assert.ok(g.said.includes('You cannot use that.'), `the guest's close is refused: ${g.said}`);
  assert.equal(g.entity.goldPieces, PURSE, 'the guest\'s purse never took it');
  assert.equal(recordOf(t.env, M.id).goldPieces, PURSE);
  assert.equal(recordOf(t.env, A.id).goldPieces, owner, 'the owner\'s purse never moved - the gold is a pile in the owner\'s chest');
  const poured = (recordOf(t.env, A.id).sceneCache?.scenes ?? []).flatMap((s) => s?.decorItems?.p1 ?? []);
  assert.deepEqual(poured.filter((it) => it.group === 'Currency').map((it) => it.stackCount), [700], 'once');
});

test('RPT1026-CHESTGOLD a pour reads the bin it empties: a settle landing between the read and the batch refuses it', async () => {
  const t = await stand();
  const { aldric, A } = await sharedChest(t);
  const row = coinRow(900);
  layBin(t.env, row);
  const raw = t.env.DB._raw;
  // no window holds the chest: between the owner's read and its batch, a guest's settle lands (its own batch) - a handful
  // cut off the pile, the pile taken whole, a piece put in
  const between = [
    () => raw.prepare('UPDATE decor_bin SET item = ? WHERE uid = ?').run(JSON.stringify({ ...row, stackCount: 400 }), row.uid),
    () => raw.prepare('DELETE FROM decor_bin WHERE uid = ?').run(row.uid),
    () => layBin(t.env, { ...coinRow(5, 'c2c2c2c2c2c2c2c2') }),
  ];
  for (const land of between) {
    t.env.DB.beforeBatch = (list) => {
      if (!list.some((st) => /^DELETE FROM decor_bin/.test(st._sql))) return;
      t.env.DB.beforeBatch = null;
      land();
    };
    const shut = await t.call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(t.env, A.id), op: 'set', id: 'p1', kind: 'storage', mode: 'private' }, aldric);
    assert.equal(shut.body?.error, 'decor-busy', JSON.stringify(shut.body));
    assert.equal(t.env.DB.beforeBatch, null, 'the owner\'s pour was the batch it landed beside');
    const scenes = recordOf(t.env, A.id).sceneCache?.scenes ?? [];
    assert.equal(scenes.some((s) => (s?.decorItems?.p1 ?? []).length), false, 'nothing the guest moved is poured into the owner\'s chest as well');
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM decor_access').get().n, 1, 'and the chest stays shared');
    if (!binRows(t.env).length) layBin(t.env, row);
  }
});

test('RPT1026-CHESTGOLD a piece taken out and put back is the chest\'s alone', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const blade = { ...validLootList([createWeapon(113, 1, seededRng(1))])[0], uid: 'abcdef0123456789' };
  layBin(t.env, blade);
  const g = gameOf(t, mara, M.id);
  await g.open();
  const row = g.chest().find((it) => it.uid === blade.uid);
  assert.equal(await g.take(row), true);
  assert.equal(await g.put(row), true);
  assert.equal(g.entity.items.some((it) => it?.uid === blade.uid), false, 'the pack never took it');
  await g.close();
  assert.equal(g.asked.includes('settle'), false, 'nothing to settle');
  assert.equal(g.entity.items.some((it) => it?.uid === blade.uid), false);
  await g.checkpoint();
  assert.equal(recordOf(t.env, M.id).items.some((it) => it?.uid === blade.uid), false, 'and no checkpoint carries it out of the chest');
  assert.deepEqual(binRows(t.env).map((it) => it.uid), [blade.uid]);
});

test('RPT1026-CHESTGOLD a part taken and put back makes the stack whole again, and a pile of gold the same', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const arrows = { ...validLootList([{ ...createWeapon(ARROW_TEMPLATE, 0, () => 0), stackCount: 40 }])[0], uid: '0a0a0a0a0a0a0a0a' };
  layBin(t.env, arrows);
  layBin(t.env, coinRow(300));
  const g = gameOf(t, mara, M.id);
  await g.open();
  const quiver = g.chest().find((it) => it.uid === arrows.uid);
  const coin = g.chest().find((it) => it.group === 'Currency');
  assert.equal(await g.take(quiver, 15), true);
  assert.equal(await g.take(coin, 120), true);
  const half = g.pack().find((it) => it.templateIndex === ARROW_TEMPLATE);
  const handful = g.pack().find((it) => it.group === 'Currency');
  assert.equal(half.stackCount, 15);
  assert.equal(handful.stackCount, 120);
  assert.equal(g.entity.goldPieces, PURSE, 'a handful is a pile in the window, not the purse');
  assert.equal(await g.put(half, 5), false, 'a part of what the window took goes back after the close');
  assert.equal(await g.put(half), true);
  assert.equal(await g.put(handful), true);
  assert.equal(quiver.stackCount, 40, 'the stack is whole');
  assert.equal(coin.stackCount, 300);
  assert.equal(g.chest().length, 2, 'one row each, as the bin holds them');
  await g.close();
  assert.equal(g.asked.includes('settle'), false, 'nothing to settle');
  assert.equal(g.entity.goldPieces, PURSE);
  assert.equal(g.entity.items.length, 0);
  assert.equal(binRows(t.env).find((it) => it.uid === arrows.uid).stackCount, 40);
  assert.equal(binGold(t.env), 300);
});

test('RPT1026-CHESTGOLD part of a stack put in, taken back, stays the pack\'s: the rest goes in and nothing is lost', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const own = { ...validLootList([{ ...createWeapon(ARROW_TEMPLATE, 0, () => 0), stackCount: 10 }])[0], uid: '0b0b0b0b0b0b0b0b' };
  const g = gameOf(t, mara, M.id);
  g.entity.items.push(own);
  await g.checkpoint();
  await g.open();
  const mine = g.pack().find((it) => it.uid === own.uid);
  assert.equal(await g.put(mine), true);
  assert.equal(await g.take(mine, 3), true);
  await g.close();
  const arrowsIn = (list) => list.filter((it) => it?.templateIndex === ARROW_TEMPLATE).reduce((n, it) => n + it.stackCount, 0);
  assert.equal(arrowsIn(g.entity.items), 3, 'the three taken back are in the pack');
  assert.equal(arrowsIn(recordOf(t.env, M.id).items), 3, 'and in the record');
  assert.equal(arrowsIn(binRows(t.env)), 7, 'the rest in the chest - ten in all');
});

test('RPT1026-CHESTGOLD the service pays the coins it is told, refuses a count the bin does not hold, and an older window is not paid twice', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const { env, call } = t;
  const row = coinRow(250);
  layBin(env, row);
  const list = async () => (await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'list', id: 'p1', hold: true }, mara)).body;
  const settle = (extra) => call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', take: [row.uid], ...extra }, mara);
  assert.equal((await list()).ok, true);
  const wrong = await settle({ purse: 249 });
  assert.equal(wrong.body?.error, 'no-item', 'a count the bin does not hold');
  assert.equal(binGold(env), 250);
  assert.equal(recordOf(env, M.id).goldPieces, PURSE);
  assert.equal((await settle({ purse: -1 })).body?.error, 'decor-busy', 'the refusal let the chest go');
  assert.equal((await list()).ok, true);
  assert.equal((await settle({ purse: 2.5 })).body?.error, 'bad-item');
  assert.equal((await list()).ok, true);
  const cutRow = coinRow(100, 'c3c3c3c3c3c3c3c3');
  layBin(env, cutRow);
  const cut = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', take: [], cut: [{ uid: cutRow.uid, leave: 40 }], purse: 60 }, mara);
  assert.equal(cut.status, 200, JSON.stringify(cut.body));
  assert.equal(recordOf(env, M.id).goldPieces, PURSE + 60, 'a handful cut off a pile is paid as a handful');
  assert.equal(binGold(env), 250 + 40);
  assert.equal((await list()).ok, true);
  const witnessed = env.DB._raw.prepare('SELECT witnessed FROM realm_characters WHERE id = ?').get(M.id).witnessed;
  const paid = await settle({ purse: 250 });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(recordOf(env, M.id).goldPieces, PURSE + 60 + 250);
  assert.equal(env.DB._raw.prepare('SELECT witnessed FROM realm_characters WHERE id = ?').get(M.id).witnessed, witnessed + 250, 'the service\'s own gain is witnessed (INT5)');
  // a window from before: its click paid the purse, and it says no `purse` - the coins are not paid again
  const older = coinRow(80, 'c1c1c1c1c1c1c1c1');
  layBin(env, older);
  assert.equal((await list()).ok, true);
  const before = recordOf(env, M.id).goldPieces;
  const old = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'settle', id: 'p1', take: [older.uid] }, mara);
  assert.equal(old.status, 200, JSON.stringify(old.body));
  assert.equal(recordOf(env, M.id).goldPieces, before);
  assert.equal(binGold(env), 40);
});

test('RPT1026-CHESTGOLD an open window keeps its hold while it is used, and a hold run out is never its again', async () => {
  const t = await stand();
  const { aldric, mara, A, M } = await sharedChest(t);
  const { env, call } = t;
  const use = (secret, body) => call('POST', '/v1/homes/decor/use', { ...HOME, id: 'p1', ...body }, secret);
  const until = () => env.DB._raw.prepare('SELECT until FROM decor_hold').get()?.until;
  assert.equal((await use(mara, { character: M.id, op: 'list', hold: true })).body.ok, true);
  env.DB._raw.prepare('UPDATE decor_hold SET until = until - 170').run();
  const kept = await use(mara, { character: M.id, op: 'hold' });
  assert.equal(kept.body?.ok, true, JSON.stringify(kept.body));
  assert.ok(until() >= Math.floor(Date.now() / 1000) + 170, 'kept another hold\'s life');
  assert.equal((await use(aldric, { character: A.id, op: 'hold' })).body?.error, 'decor-busy', 'another\'s hold is not kept');
  assert.equal((await use(aldric, { character: A.id, op: 'list', hold: true })).body?.error, 'decor-busy');
  env.DB._raw.prepare('UPDATE decor_hold SET until = 0').run();
  assert.equal((await use(mara, { character: M.id, op: 'hold' })).body?.error, 'decor-lapsed', 'a hold run out is not taken back by keeping it');
  assert.equal((await use(mara, { character: M.id, realm: realmAt(env, M.id), op: 'settle', take: [] })).body?.error, 'decor-lapsed');
  // the window asks the service once the keep is due, and stops moving once it is told no
  layBin(env, coinRow(60));
  const g = gameOf(t, mara, M.id);
  await g.open();
  const pile = g.chest().find((it) => it.group === 'Currency');
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + DECOR_HOLD_KEEP_MS;
    env.DB._raw.prepare('UPDATE decor_hold SET until = 0').run();
    assert.equal(await g.take(pile), true);
    await g.heard();
    assert.equal(g.asked.filter((op) => op === 'hold').length, 1, 'the keep was asked');
    assert.equal(await g.put(pile), false, 'told the hold is gone, the window moves nothing more');
  } finally { Date.now = realNow; }
  await g.close();
  assert.equal(g.entity.goldPieces, PURSE);
  assert.equal(binGold(env), 60);
});

/** The classic window over the host's spec (inventoryDoor.js createInventoryWindow's other arm), the host's own doors
 *  first and the chest's spec over them, as worldModes.js interiorInventory spreads it. */
const classicOver = (spec, entity, hostDoors = {}) => new NativeInventoryWindow({
  ...hostDoors, ...spec, entity, icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
});
const settled = () => new Promise((r) => { setTimeout(r, 0); });

test('RPT1026-CHESTGOLD the classic skin\'s window settles through the chest\'s door: what it takes and puts lands once, the gold with the settle', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const blade = { ...validLootList([createWeapon(113, 1, seededRng(1))])[0], uid: 'abcdef0123456789' };
  const mine = { ...validLootList([createWeapon(114, 1, seededRng(2))])[0], uid: '9876543210fedcba' };
  layBin(t.env, coinRow(400));
  layBin(t.env, blade);
  const g = gameOf(t, mara, M.id);
  g.entity.items.push(mine);
  await g.checkpoint();
  const spec = await g.open();
  const win = classicOver(spec, g.entity);
  win.mode = 'remove';
  win._pickRemote(spec.loot.items().findIndex((it) => it.group === 'Currency'));
  await settled();
  assert.equal(spec.items().find((it) => it.group === 'Currency')?.stackCount, 400, 'the pile stands in the window\'s pack');
  assert.equal(g.entity.goldPieces, PURSE, 'the click pays no purse');
  const row = spec.loot.items().find((it) => it.uid === blade.uid);
  win._pickRemote(spec.loot.items().indexOf(row), 'equip');   // Equip mode takes, and would wear it
  await settled();
  assert.equal(isEquipped(row), false, 'a piece still the chest\'s until the close is taken, not worn');
  win._pick(win._filtered().findIndex((it) => it.uid === mine.uid));
  await settled();
  assert.equal(g.entity.items.some((it) => it.uid === blade.uid), false, 'nothing reaches the pack before the close');
  win._close();
  await spec.loot.finish();
  await g.saved();
  assert.ok(g.asked.includes('settle'), 'the close settled what the window moved');
  assert.equal(g.entity.goldPieces, PURSE + 400);
  assert.equal(recordOf(t.env, M.id).goldPieces, PURSE + 400);
  assert.equal(g.entity.items.some((it) => it.uid === blade.uid), true, 'the blade taken is the pack\'s');
  assert.equal(g.entity.items.some((it) => it.uid === mine.uid), false, 'the piece put in left it');
  assert.equal(recordOf(t.env, M.id).items.some((it) => it.uid === blade.uid), true);
  assert.deepEqual(binRows(t.env).map((it) => it.uid), [mine.uid], 'the chest holds the piece put in, and nothing taken');
});

test('RPT1026-CHESTGOLD the classic skin drops no gold into the chest, as the enhanced pack does not', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const g = gameOf(t, mara, M.id);
  const spec = await g.open();
  const win = classicOver(spec, g.entity);
  win._dropGold();
  assert.equal(win.inputBox, null, 'no gold field over a chest that settles its own pieces');
  win._close();
  await spec.loot.finish();
  assert.equal(g.entity.goldPieces, PURSE);
});

test('RPT1026-CHESTGOLD a chest window shows the chest alone: no wagon, no bag, no piece shift-dropped on the floor', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const g = gameOf(t, mara, M.id);
  const mine = { ...validLootList([createWeapon(114, 1, seededRng(2))])[0], uid: '9876543210fedcba' };
  g.entity.items.push(mine, { group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, name: 'Small cart', stackCount: 1 },
    { group: 'UselessItems2', templateIndex: BAG_TEMPLATE, name: 'Materials Bag', stackCount: 1 });
  g.entity.wagonItems = [];
  g.entity.bagItems = [];
  const spec = await g.open();
  // the host's own doors (world.js makeInventoryWindow, worldModes.js interiorInventory): the real wagon, bag and floor
  const dropped = [];
  const hostDoors = {
    wagonItems: () => g.entity.wagonItems, bagItems: () => g.entity.bagItems,
    physicalDropOn: () => true, physicalDrop: (list) => { dropped.push(...list); }, dropRefusal: () => null,
  };
  const deps = { ...hostDoors, ...spec };
  // the one ladder both skins' toggles run (the enhanced pack's toggleWagon/toggleBag, the classic's _wagon)
  assert.equal(planWagonToggle(deps, {}).refusal?.reason, 'chestAlone', 'the wagon stays shut while the chest is open');
  assert.equal(planBagToggle(deps, {}).refusal?.reason, 'chestAlone', 'and the bag');
  assert.equal(planWagonToggle({ ...hostDoors, items: () => g.entity.items }, {}).ok, true, 'any other window opens the wagon');
  const win = classicOver(spec, g.entity, hostDoors);
  win._wagon();
  assert.equal(win.usingWagon, false);
  assert.match(win.boxes[0]?.rows?.[0]?.text ?? '', /Shut the chest before you open your wagon or your bag/);
  win.boxes = [];
  win._physicalDrop(win._filtered().findIndex((it) => it.uid === mine.uid));
  assert.deepEqual(dropped, [], 'nothing laid on the floor');
  assert.match(win.boxes[0]?.rows?.[0]?.text ?? '', /Shut the chest before you drop that/);
  assert.ok(spec.items().includes(mine), 'the window\'s pack keeps it');
  assert.ok(g.entity.items.includes(mine), 'and the character\'s - once');
  win._close();
  await spec.loot.finish();
});
