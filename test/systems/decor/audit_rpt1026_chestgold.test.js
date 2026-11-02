// AUDIT RPT1026 lane B (CHESTGOLD; bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md, RPT1026-CHESTGOLD): the shared
// chest's settle law and both skins' chest window, read cold. Everything here is the real thing: the account worker over
// SQLite, the realm session over it (systems/realmSaves.js createRealmSession, its checkpoint the realm's own PUT), the
// host's door (decorGrants.js bindDecorHouseFrom), the classic window (NativeInventoryWindow) and the enhanced pack
// (mountEnhancedInventory over a DOM just real enough) over the chest's own spec, the host's doors under it.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../../server-account/src/index.js';
import { _resetKeyForTests } from '../../../server-account/src/signing.js';
import { ACCEPTED } from '../../../src/net/legalLaw.js';
import { r2, seatRealm, recordOf, realmAt } from '../../realmSeat.mjs';
import { bindDecorHouseFrom, noteDecorBin, openSharedChest } from '../../../src/systems/decor/decorGrants.js';
import { realmGoldAct, realmIo, createRealmSession } from '../../../src/systems/realmSaves.js';
import { accountRefusalText, SESSION_KEY } from '../../../src/net/accountClient.js';
import { createPotion, validLootList, MAP_TEMPLATE_INDEX } from '../../../src/systems/loot/loot.js';
import { NativeInventoryWindow } from '../../../src/ui/native/nativeInventory.js';
import { mountEnhancedInventory } from '../../../src/ui/enhanced/enhancedInventory.js';
import { fakeDom } from '../../invdrag.mjs';
import { _resetForTests as resetUiPrefs, setPref } from '../../../src/systems/uiPrefs.js';
import { applyRarity, LOOT_RARITY_KEY } from '../../../src/systems/loot/lootRarity.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { welkyndShards, sigilStone } from '../../../src/systems/gate/gateSpoils.js';
import { brokerStock, dismantleStones } from '../../../src/systems/sigil/sigilBroker.js';
import { salvageShards } from '../../../src/systems/reforge.js';
import { applyTransfer } from '../../../src/systems/item/itemTransfer.js';
import { goldStack } from '../../../src/systems/inventory.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** D1 over SQLite (rpt1026_chestgold.test.js's). */
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
      db.exec('BEGIN');
      try { const res = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return res; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
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
  const ids = new Map();
  const registered = async (handle) => {
    const guest = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    assert.equal((await call('POST', '/v1/auth/register', { secret: guest.secret, handle, password: 'a good long one', ...ACCEPTED })).status, 200);
    ids.set(guest.secret, guest.id);
    return guest.secret;
  };
  return { env, call, registered, ids };
}
const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
const PURSE = 1_000;
const SAVE = (name, items = [], gold = PURSE) => ({ name, level: 9, goldPieces: gold, items, stats: { strength: 60 }, bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const chestPiece = { id: 'p1', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 180 };
const binRows = (env) => env.DB._raw.prepare('SELECT uid, item FROM decor_bin').all().map((r) => ({ uid: r.uid, ...JSON.parse(r.item) }));
const layBin = (env, item) => env.DB._raw.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').run(HOME.mapId, HOME.buildingKey, 'p1', item.uid, JSON.stringify(item));
const use = (t, secret, body) => t.call('POST', '/v1/homes/decor/use', { ...HOME, id: 'p1', ...body }, secret);

/** The owner's home with one chest, shared with the guest by name. */
async function sharedChest(t) {
  const { env, call, registered } = t;
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', SAVE('Aldric', [], 100_000));
  const M = await seatRealm(env, mara, 'Mara', SAVE('Mara'));
  assert.equal((await call('POST', '/v1/homes/claim', { ...HOME, region: 17, character: A.id, price: 42000, layout: null, realm: A.at() }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: chestPiece }, aldric)).status, 200);
  const shared = await use(t, aldric, { character: A.id, realm: realmAt(env, A.id), op: 'set', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] });
  assert.equal(shared.status, 200, JSON.stringify(shared.body));
  return { aldric, mara, A, M };
}

/**
 * A REALM CHARACTER'S GAME, as far as a chest reaches: its entity, the realm session over the worker (its checkpoint the
 * save composed from the entity - every timer's and every act's), the host's door, the chest's spec as the host hands it
 * to an inventory window. `drop` loses the answer of the first settle that landed - the service moved it, the window heard
 * a transport failure (accountClient.js call's `offline`).
 */
function gameOf(t, secret, id, { drop = false } = {}) {
  const { env, call } = t;
  const rec = recordOf(env, id);
  const entity = { name: rec.name, goldPieces: rec.goldPieces, items: [...(rec.items ?? [])], stats: { ...rec.stats }, activeEffects: [] };
  const kept = new Map([[SESSION_KEY, JSON.stringify({ id: t.ids.get(secret), secret })]]);
  const storage = { get length() { return kept.size; }, key: (i) => [...kept.keys()][i] ?? null, getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
  const at = realmAt(env, id);
  const session = createRealmSession({ io: realmIo({ fetch: (u, i) => worker.fetch(new Request(u, i), env), storage }), id: at.id, lease: at.lease, seq: at.seq });
  const checkpoint = () => session.checkpoint(JSON.stringify({ ...recordOf(env, id), goldPieces: entity.goldPieces, items: entity.items }));
  const said = [];
  const asked = [];
  let dropped = false;
  let spec = null;
  const host = {
    homeDecor: {
      use: async (body) => {
        asked.push(body.op);
        const r = await call('POST', '/v1/homes/decor/use', body, secret);
        if (drop && !dropped && body.op === 'settle' && r.status === 200) { dropped = true; return { ok: false, error: 'offline' }; }
        return r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error, ...(Number.isSafeInteger(r.body?.seq) ? { seq: r.body.seq } : {}) };
      },
    },
    realmAct: (o) => realmGoldAct({ ...o, session, checkpoint, wait: () => Promise.resolve() }),
    decorCharacter: () => id,
  };
  return {
    entity, said, asked, session, checkpoint, dropped: () => dropped,
    async open() {
      bindDecorHouseFrom(host, entity, (l) => said.push(l), accountRefusalText, HOME.mapId, HOME.buildingKey, (s) => { spec = s; });
      noteDecorBin('p1', null);
      spec = null;
      assert.equal(await openSharedChest('p1'), true);
      return spec;
    },
    /** the window shut, its settle answered, and the record's checkpoint after it landed */
    close: async () => { await spec.loot.finish(); await checkpoint(); },
  };
}

/** The classic window over the host's spec (rpt1026_chestgold.test.js classicOver's): the host's doors, the chest's over them. */
const classicOver = (spec, entity, hostDoors = {}) => new NativeInventoryWindow({
  ...hostDoors, ...spec, entity, icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
});
const settled = () => new Promise((r) => { setTimeout(r, 0); });
/** The classic window's tab for a piece, as the player turns to it. */
const tabFor = (win, it) => { for (const tab of ['weapons', 'magic', 'clothing', 'ingredients']) { win.tab = tab; if (win._filtered().includes(it)) return win._filtered().indexOf(it); } return -1; };
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
/** invdrag.mjs withDom's, held while a move through the chest's door finishes (heldThen runs it once the chest answers). */
async function withDomAwaited(fn) {
  const dom = fakeDom();
  const saved = { doc: globalThis.document, hadDoc: 'document' in globalThis, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame, iw: globalThis.innerWidth, ih: globalThis.innerHeight };
  Object.assign(globalThis, { document: dom.doc, addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener, requestAnimationFrame: () => 0, innerWidth: dom.w, innerHeight: dom.h });
  try { return await fn(dom); } finally {
    if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    Object.assign(globalThis, { addEventListener: saved.add, removeEventListener: saved.rem, requestAnimationFrame: saved.raf, innerWidth: saved.iw, innerHeight: saved.ih });
  }
}
/** The enhanced pack over the host's spec, driven by its own rows and buttons (worldModes.js interiorInventory's spread);
 *  it stays up until every move it began has run. */
function enhancedOver(spec, entity, hostDoors, fn) {
  globalThis.location = { search: '?skin=enhanced' };
  return withDomAwaited(async (dom) => {
    const node = dom.mk('div');
    dom.body.append(node);
    const view = mountEnhancedInventory(node, { onExit: () => {}, ...hostDoors, ...spec, entity });
    const buttons = (root = node) => [...root.querySelectorAll('button')];
    const press = (label) => { const b = buttons().find((x) => x.textContent === label); assert.ok(b, `the card has ${label}`); b.onclick({ stopPropagation() {} }); };
    /** the question's own yes (the dimmed box on the page's body), pressed when one was asked */
    const answer = (label) => { const b = buttons(dom.body).find((x) => x.textContent === label && x.className.includes('primary') && x.closest('.inv-dismantle')); b?.onclick({ detail: 1, stopPropagation() {} }); return !!b; };
    const pick = (item, from = 'local') => {
      for (const label of buttons().filter((b) => b.className.includes('packtab')).map((b) => b.textContent)) {
        buttons().find((b) => b.className.includes('packtab') && b.textContent === label).onclick();
        const row = [...node.querySelectorAll('.itemrow')].find((r) => r._padItem === item && r._padFrom === from);
        if (row) { row.onclick({}); return; }
      }
      assert.fail(`the pack shows ${item.name ?? item.templateIndex}`);
    };
    try {
      const out = fn({ press, answer, pick, text: () => textOf(dom.body) });
      await settled();
      await settled();
      return out;
    } finally { view.unmount(); }
  });
}
const potion = (uid) => ({ ...createPotion(5), uid });
const blade = (uid, seed = 1) => ({ ...validLootList([createWeapon(113, 1, seededRng(seed))])[0], uid });
const rareBlade = (uid, seed) => ({ ...applyRarity(validLootList([createWeapon(113, 1, seededRng(seed))])[0], 'rare', seededRng(seed + 7)), uid });
const map = (uid) => ({ ...validLootList([{ group: 'MiscItems', templateIndex: MAP_TEMPLATE_INDEX, stackCount: 1 }])[0], uid });
const REFUSED = 'Shut the chest before you do that.';

test('AUDIT RPT1026 B1 the classic chest window uses nothing: a potion of the pack and one in the chest stay undrunk, once each - and a window over anything else drinks', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const own = potion('1111111111111111');
  const theirs = potion('2222222222222222');
  layBin(t.env, theirs);
  const g = gameOf(t, mara, M.id);
  g.entity.items.push(own);
  await g.checkpoint();
  const spec = await g.open();
  const drunk = [];
  const win = classicOver(spec, g.entity, { drinkPotion: (k) => { drunk.push(k); return 'Potion'; } });
  win.mode = 'use';
  win._pick(tabFor(win, own));
  assert.equal(win.boxes[0]?.rows?.[0]?.text, REFUSED);
  win.boxes = [];
  win._pickRemote(spec.loot.items().findIndex((it) => it.uid === theirs.uid));
  assert.equal(win.boxes[0]?.rows?.[0]?.text, REFUSED, 'and off the chest\'s own list');
  await settled();
  win._close();
  await g.close();
  assert.deepEqual(drunk, [], 'nothing drunk');
  assert.equal(g.entity.items.filter((it) => it.uid === own.uid).length, 1, 'the pack\'s potion once - drunk, it stood in the pack still');
  assert.equal(recordOf(t.env, M.id).items.filter((it) => it.uid === own.uid).length, 1);
  assert.deepEqual(binRows(t.env).map((it) => it.uid), [theirs.uid], 'the chest\'s once - drunk, it stood in the chest still');
  assert.equal(g.asked.includes('settle'), false);
  // any other window drinks, as DFU's UseItem does
  const plain = { entity: { items: [potion('3333333333333333')], stats: {} }, drunk: [] };
  const other = new NativeInventoryWindow({ items: () => plain.entity.items, entity: plain.entity, drinkPotion: (k) => { plain.drunk.push(k); return 'Potion'; }, icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() } });
  other.mode = 'use';
  other._pick(tabFor(other, plain.entity.items[0]));
  assert.deepEqual([plain.drunk.length, plain.entity.items.length], [1, 0]);
});

test('AUDIT RPT1026 B1 the enhanced chest window uses, salvages and dismantles nothing: no free potion, no shards or embers out of nothing', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  resetUiPrefs();
  setPref(LOOT_RARITY_KEY, true);
  const own = potion('4444444444444444');
  const graded = rareBlade('5555555555555555', 1);
  const graded2 = rareBlade('5555555555555556', 2);
  const ware = { ...brokerStock(9)[0].item, uid: '6666666666666666' };
  const shards = { ...welkyndShards(4), uid: '7777777777777777' };
  const stones = Object.assign(sigilStone(), { stackCount: 10, uid: '8888888888888888' });
  assert.ok(salvageShards(graded) > 0 && dismantleStones(ware) > 0, 'a graded piece breaks into shards, the Broker\'s ware into embers');
  const g = gameOf(t, mara, M.id);
  g.entity.items.push(own, graded, graded2, ware, shards, stones);
  await g.checkpoint();
  const spec = await g.open();
  const drunk = [];
  const asked = await enhancedOver(spec, g.entity, { drinkPotion: (k) => { drunk.push(k); return 'Potion'; } }, ({ press, answer, pick, text }) => {
    pick(own); press('Use');
    assert.ok(text().includes(REFUSED), 'the Use says why');
    pick(graded); press('Salvage');
    const salvaged = answer('Salvage');
    pick(ware); press('Dismantle');
    const dismantled = answer('Dismantle');
    press('Batch salvage');
    pick(graded2);
    press('Salvage 1');
    const batched = answer('Salvage');
    return [salvaged, dismantled, batched];
  });
  assert.deepEqual(asked, [false, false, false], 'no question is asked - the salvage, the dismantle and the batch are refused');
  await g.close();
  const rec = recordOf(t.env, M.id);
  const count = (list, uid) => list.filter((it) => it.uid === uid).reduce((n, it) => n + (it.stackCount ?? 1), 0);
  assert.deepEqual(drunk, []);
  for (const list of [g.entity.items, rec.items]) {
    assert.deepEqual([own, graded, graded2, ware].map((it) => count(list, it.uid)), [1, 1, 1, 1], 'every piece kept, once');
    assert.equal(count(list, shards.uid), 4, 'the shards as they were - a salvage had put its own onto the pack\'s stack and kept the piece');
    assert.equal(count(list, stones.uid), 10, 'the embers as they were');
  }
});

test('AUDIT RPT1026 B4 a piece taken this window is not worn from the pack, on either skin - the character\'s own is', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const taken = blade('9999999999999999', 1);
  const takenToo = blade('9999999999999998', 3);
  const mine = blade('aaaaaaaaaaaaaaaa', 2);
  layBin(t.env, taken);
  layBin(t.env, takenToo);
  const g = gameOf(t, mara, M.id);
  g.entity.items.push(mine);
  await g.checkpoint();
  const spec = await g.open();
  const win = classicOver(spec, g.entity);
  win.mode = 'remove';
  win._pickRemote(spec.loot.items().findIndex((it) => it.uid === taken.uid));
  win._pickRemote(spec.loot.items().findIndex((it) => it.uid === takenToo.uid));
  await settled();
  const row = spec.items().find((it) => it.uid === taken.uid);
  const rowToo = spec.items().find((it) => it.uid === takenToo.uid);
  win._pick(tabFor(win, row), 'equip');
  assert.equal(row.equipSlot, undefined, 'the classic window does not wear the chest\'s piece');
  assert.equal(win.boxes[0]?.rows?.[0]?.text, REFUSED);
  win.boxes = [];
  win._pick(tabFor(win, mine), 'equip');
  assert.notEqual(mine.equipSlot, undefined, 'the character\'s own is worn');
  await enhancedOver(spec, g.entity, {}, ({ press, pick }) => { pick(rowToo); press('Wear'); });
  assert.equal(rowToo.equipSlot, undefined, 'nor does the enhanced pack');
  t.env.DB._raw.prepare('UPDATE decor_hold SET until = 0').run();   // the close refused (a hold run out): nothing moved
  win._close();
  await g.close();
  assert.ok(g.said.some((l) => /left open too long/.test(l)));
  assert.equal(g.entity.items.some((it) => it.uid === taken.uid || it.uid === takenToo.uid), false);
  assert.deepEqual(binRows(t.env).map((it) => it.uid).sort(), [taken.uid, takenToo.uid].sort(), 'the chest holds both - and the doll wears neither');
});

test('AUDIT RPT1026 B5 a map comes out of the chest and goes into it as a piece, never read on the way: the chest and the pack each hold it once', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  const theirs = map('bbbbbbbbbbbbbbbb');
  const mine = map('cccccccccccccccc');
  const viaPlus = map('dddddddddddddddd');
  const mineViaPlus = map('cccccccccccccccd');
  layBin(t.env, theirs);
  layBin(t.env, viaPlus);
  const g = gameOf(t, mara, M.id);
  g.entity.items.push(mine, mineViaPlus);
  await g.checkpoint();
  const spec = await g.open();
  const read = [];
  const doors = { revealMap: () => { read.push(1); return 'Somewhere'; } };
  const win = classicOver(spec, g.entity, doors);
  win.mode = 'remove';
  win._pickRemote(spec.loot.items().findIndex((it) => it.uid === theirs.uid));
  win._pick(tabFor(win, mine));
  await settled();
  await enhancedOver(spec, g.entity, doors, ({ pick, press }) => {
    pick(spec.loot.items().find((it) => it.uid === viaPlus.uid), 'remote');
    pick(mineViaPlus);
    press('Store');
  });
  await settled();
  win._close();
  await g.close();
  assert.deepEqual(read, [], 'no map read - read on the way, it stood where it came from still');
  assert.deepEqual(binRows(t.env).map((it) => it.uid).sort(), [mine.uid, mineViaPlus.uid].sort(), 'the chest holds the maps put in');
  for (const list of [g.entity.items, recordOf(t.env, M.id).items]) {
    assert.deepEqual(list.filter((it) => it.templateIndex === MAP_TEMPLATE_INDEX).map((it) => it.uid).sort(), [theirs.uid, viaPlus.uid].sort(), 'the pack the two taken out');
  }
});

test('AUDIT RPT1026 B2 a guest who keeps the hold never shuts the owner out: the owner\'s Private lands at any time, and the guest\'s window moves nothing after', async () => {
  const t = await stand();
  const { aldric, mara, A, M } = await sharedChest(t);
  layBin(t.env, potion('eeeeeeeeeeeeeeee'));
  const g = gameOf(t, mara, M.id);
  const spec = await g.open();
  const pile = spec.loot.items()[0];
  assert.equal(await spec.loot.commit('take', pile, 1, () => applyTransfer(pile, { amount: 1 }, spec.loot.items(), spec.items(), { entity: g.entity, toPlayer: true })), true);
  // a client that asks to keep the hold every 170 s, for half an hour
  for (let i = 0; i < 10; i++) {
    t.env.DB._raw.prepare('UPDATE decor_hold SET until = until - 170').run();
    assert.equal((await use(t, mara, { character: M.id, op: 'hold' })).body?.ok, true, 'the guest\'s hold is kept');
  }
  assert.equal((await use(t, aldric, { character: A.id, op: 'list', hold: true })).body?.error, 'decor-busy', 'the owner waits for the window to open the chest');
  const shut = await use(t, aldric, { character: A.id, realm: realmAt(t.env, A.id), op: 'set', kind: 'storage', mode: 'private' });
  assert.equal(shut.status, 200, `the owner's own change lands: ${JSON.stringify(shut.body)}`);
  assert.deepEqual((shut.body.restored ?? []).map((it) => it.uid), [pile.uid], 'the chest\'s goods home to the owner');
  assert.equal((await use(t, mara, { character: M.id, op: 'hold' })).body?.error, 'decor-shut', 'and the guest keeps the hold no more');
  await g.close();
  assert.ok(g.said.includes('You cannot use that.'), `the guest's close is refused: ${g.said}`);
  assert.equal(g.entity.items.some((it) => it.uid === pile.uid), false, 'and moves nothing');
  assert.equal(recordOf(t.env, M.id).items.some((it) => it.uid === pile.uid), false);
  const poured = (recordOf(t.env, A.id).sceneCache?.scenes ?? []).flatMap((s) => s?.decorItems?.p1 ?? []);
  assert.deepEqual(poured.map((it) => it.uid), [pile.uid], 'the piece is the owner\'s chest\'s, once');
});

test('AUDIT RPT1026 B3 a settle that landed, its answer lost, is the settle landed: the purse paid once, the record\'s next checkpoint lands, nothing said of anyone else', async () => {
  const t = await stand();
  const { mara, M } = await sharedChest(t);
  layBin(t.env, { ...goldStack(250), uid: 'ffffffffffffffff' });
  const g = gameOf(t, mara, M.id, { drop: true });
  const spec = await g.open();
  const pile = spec.loot.items()[0];
  assert.equal(await spec.loot.commit('take', pile, 250, () => applyTransfer(pile, { amount: 250 }, spec.loot.items(), spec.items(), { entity: g.entity, toPlayer: true })), true);
  await spec.loot.finish();
  assert.equal(g.dropped(), true, 'the settle landed and its answer was lost');
  assert.deepEqual(g.asked.filter((op) => op === 'settle').length, 2, 'and it was sent again');
  assert.equal(g.entity.goldPieces, PURSE + 250, 'the purse takes the coins the service paid');
  const next = await g.checkpoint();
  assert.equal(next.ok, true, `the next checkpoint lands on the record the settle moved: ${JSON.stringify(next)}`);
  assert.equal(g.session.lost, null, 'the session stands');
  assert.equal(recordOf(t.env, M.id).goldPieces, PURSE + 250, 'paid once');
  assert.deepEqual(g.said, [], 'nobody else was using the chest');
  assert.equal(binRows(t.env).length, 0);
});
