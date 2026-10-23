// REALM P2.2b (2026-09-28; bible/06-Systems/Realm-Arc.md section 3, Mac: "eliminate duping"): A HOME'S AND ITS DECOR'S
// GOLD MOVES ON THE REALM CHARACTER'S RECORD. "Homes, decor, stations and guild founding. The service debits the
// character's gold at claim time." The law (net/homeLaw.js homeSaleRefund, server-account/src/decor.js decorGoldDelta,
// pinned to the client's own arithmetic), the service (homes.js, decor.js over realm.js prepareRealmRecord) through the
// REAL Worker, and the client - systems/online/onlineHomes.js's buy and sale and scenes/decor/decorTool.js's four changes - over
// systems/realmSaves.js realmGoldAct.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { decorGoldDelta } from '../../server-account/src/decor.js';
import { SESSION_KEY, accountHomes, accountDecor } from '../../src/net/accountClient.js';
import { HOME_SALE_SHARE, homeSaleRefund, HOME_PRICE_MIN } from '../../src/net/homeLaw.js';
import { DECOR_STATION_FEES, decorRescale, decorRefund } from '../../src/net/decorLaw.js';
import { DEED_SELL_MULT } from '../../src/systems/banking.js';
import { createOnlineHomes, buyOnlineHome, sellOnlineHome, homeRefund } from '../../src/systems/online/onlineHomes.js';
import { realmIo, realmCreate, realmPut, realmFetch, createRealmSession, realmGoldAct } from '../../src/systems/realmSaves.js';
import { freshSave, layRecord } from '../realmSeat.mjs';   // AUDIT REALM2 S1: a first save is a new character's
import { settle, toolRig, placeFrom, all, one, rows } from '../decorFakes.mjs';
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
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
    async get(key) { const v = m.get(key); return v === undefined ? null : { key, size: v.byteLength, body: v, async text() { return new TextDecoder().decode(v); } }; },
    async delete(key) { m.delete(key); },
    async list({ prefix = '' } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
function fakeStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
const MAP = 1234, KEY = 77, REGION = 17;

/** One service; a registered account playing a realm character with a first save. */
async function stand() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  async function player(handle, save) {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const reg = await worker.fetch(new Request('https://accounts.invalid/v1/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: g.secret, handle, password: 'a good long one', ...ACCEPTED }),
    }), env);
    assert.equal(reg.status, 200);
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    const door = { before: null };
    const fetch = async (url, init) => { if (door.before) await door.before(String(url)); return worker.fetch(new Request(url, init), env); };
    const io = realmIo({ fetch, storage });
    const made = (await realmCreate(io, handle)).data;
    // AUDIT REALM2 S1: the first save a new character's (the service reads it); the record the pins count from laid over it
    assert.equal((await realmPut(io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: handle })))).ok, true);
    layRecord(env, made.id, save);
    return { id: g.id, io, door, char: made.id, lease: made.lease, homes: accountHomes({ fetch, storage }), decor: accountDecor({ fetch, storage }), at: (seq) => ({ id: made.id, lease: made.lease, seq }) };
  }
  const record = async (P) => { const r = await realmFetch(P.io, P.char); return { seq: r.seq, save: JSON.parse(r.text) }; };
  return { env, player, record };
}
const bank = (region, gold) => { const a = []; for (let i = 0; i <= region; i++) a.push({ accountGold: 0 }); a[region].accountGold = gold; return a; };
const piece = (id, paid, over = {}) => ({ id, model: 41000, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid, ...over });

// ---- the law ---------------------------------------------------------------------------------------------------------

test('REALM P2.2b law: the service pays a home back as the client does, and prices a piece\'s change as the client\'s wallet pays it - placed, grown, shrunk, a station made or changed (never given back), removed', () => {
  assert.equal(HOME_SALE_SHARE, DEED_SELL_MULT);
  for (const price of [1, 7, 42_000, 1_234_567, 10_000_000]) assert.equal(homeSaleRefund(price), homeRefund(price), `price ${price}`);
  assert.equal(homeSaleRefund(-5), 0);
  assert.equal(decorGoldDelta(null, { paid: 120 }), -120, 'placed: what it cost');
  const grow = decorRescale(0.8, 120, 1.5), shrink = decorRescale(0.8, 120, 0.5);
  assert.equal(decorGoldDelta({ paid: 120 }, { paid: grow.paid }), -grow.pay, 'grown: the difference, as decorRescale says');
  assert.equal(decorGoldDelta({ paid: 120 }, { paid: shrink.paid }), shrink.refund, 'shrunk: half the difference back');
  assert.equal(decorGoldDelta({ paid: 120 }, { paid: 120, station: 'spells' }), -DECOR_STATION_FEES.spells, 'a station made: its licence');
  assert.equal(decorGoldDelta({ paid: 120, station: 'spells' }, { paid: 120, station: 'enchant' }), -DECOR_STATION_FEES.enchant, 'changed: the new one\'s');
  assert.equal(decorGoldDelta({ paid: 120, station: 'spells' }, { paid: 120 }), 0, 'unmade: nothing back');
  assert.equal(decorGoldDelta({ paid: 121 }, null), decorRefund(121), 'removed: half, truncated');
});

// ---- the service -----------------------------------------------------------------------------------------------------

test('REALM P2.2b: a realm character buys a home on its record and sells it back into the region\'s account - each one sequence on; a second press pays nothing; a sale names the record', async () => {
  const { player, record } = await stand();
  const A = await player('Aldric', { goldPieces: 30_000, items: [], bankAccounts: bank(REGION, 20_000) });
  const claim = (seq, over = {}) => A.homes.claim({ mapId: MAP, buildingKey: KEY, region: REGION, character: A.char, price: 42_000, realm: A.at(seq), ...over });
  assert.equal((await A.homes.claim({ mapId: MAP, buildingKey: KEY, region: REGION, character: A.char, price: 42_000 })).error, 'realm-needed');
  const got = await claim(1);
  assert.deepEqual([got.ok, got.data.realm.seq], [true, 2]);
  let r = await record(A);
  assert.deepEqual([r.seq, r.save.goldPieces, r.save.bankAccounts[REGION].accountGold], [2, 0, 8_000], 'the coins, then the region\'s account');
  const again = await claim(2);
  assert.deepEqual([again.ok, again.data.repeat, again.data.realm.seq], [true, true, 2], 'a second press: answered as the claim, nothing paid');
  assert.deepEqual((await record(A)).seq, 2);
  // a lost answer, asked again with the same record: the record one on is the claim, landed
  const lost = await claim(1);
  assert.deepEqual([lost.error, lost.seq], ['seq', 2]);
  // the sale: 85% of what it cost, into the account of its region
  assert.equal((await A.homes.release(MAP, KEY)).error, 'realm-needed', 'a realm character\'s home pays back into a record');
  const sold = await A.homes.release(MAP, KEY, A.at(2));
  assert.deepEqual([sold.ok, sold.data.price, sold.data.realm.seq], [true, 42_000, 3]);
  r = await record(A);
  assert.deepEqual([r.seq, r.save.bankAccounts[REGION].accountGold], [3, 8_000 + homeSaleRefund(42_000)]);
});

test('REALM P2.2b: a refusal moves nothing - a purse that cannot pay, a house another holds, a record that moved under the claim', async () => {
  const { env, player, record } = await stand();
  // HOME-PRICE (PIN MOVED): the purse and the account hold the range's floor, a hundred short of the price asked (a home's
  // price is whole hundreds, AUDIT HOME-PRICE L2), where they were 1,000 + 500 against 1,501
  const A = await player('Aldric', { goldPieces: HOME_PRICE_MIN - 500, items: [], bankAccounts: bank(REGION, 500) });
  const B = await player('Brisienna', { goldPieces: 90_000, items: [] });
  assert.equal((await A.homes.claim({ mapId: MAP, buildingKey: KEY, region: REGION, character: A.char, price: HOME_PRICE_MIN + 100, realm: A.at(1) })).error, 'realm-gold');
  assert.equal((await B.homes.claim({ mapId: MAP, buildingKey: KEY, region: 0, character: B.char, price: HOME_PRICE_MIN, realm: B.at(1) })).ok, true);
  assert.equal((await A.homes.claim({ mapId: MAP, buildingKey: KEY, region: REGION, character: A.char, price: HOME_PRICE_MIN, realm: A.at(1) })).error, 'home-taken');
  assert.deepEqual(await record(A), { seq: 1, save: { goldPieces: HOME_PRICE_MIN - 500, items: [], bankAccounts: bank(REGION, 500) } });
  // a checkpoint landing mid-batch: the claim rolls back with it
  const realBatch = env.DB.batch.bind(env.DB);
  let raced = false;
  env.DB.batch = async (list) => {
    if (!raced) { raced = true; assert.equal((await realmPut(A.io, A.char, { lease: A.lease, seq: 2 }, '{"goldPieces":1000,"mid":1}')).ok, true); }
    return realBatch(list);
  };
  const r = await A.homes.claim({ mapId: MAP, buildingKey: KEY + 1, region: REGION, character: A.char, price: HOME_PRICE_MIN, realm: A.at(1) });   // HOME-PRICE (PIN MOVED): a price inside the online range, where it was 900
  assert.deepEqual([r.error, r.seq], ['seq', 2]);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM homes WHERE building_key = ?').get(KEY + 1).n, 0, 'no house without its payment');
});

test('REALM P2.2b: a realm character\'s decor moves the record\'s gold with the piece - placed, grown, shrunk, a station made, removed; a free write names no record; a paid one without it is refused', async () => {
  const { player, record } = await stand();
  const A = await player('Aldric', { goldPieces: 300_000, items: [], bankAccounts: bank(REGION, 0) });
  assert.equal((await A.homes.claim({ mapId: MAP, buildingKey: KEY, region: REGION, character: A.char, price: HOME_PRICE_MIN, realm: A.at(1) })).ok, true);   // HOME-PRICE (PIN MOVED): a price inside the online range, where it was 1,000
  const where = { mapId: MAP, buildingKey: KEY, character: A.char };
  let seq = 2;
  const gold = async () => (await record(A)).save.goldPieces;
  let g = await gold();
  assert.equal((await A.decor.place({ ...where, piece: piece('chair01', 120) })).error, 'realm-needed');
  const placed = await A.decor.place({ ...where, piece: piece('chair01', 120), realm: A.at(seq) });
  assert.deepEqual([placed.ok, placed.data.realm.seq], [true, ++seq]);
  assert.equal(await gold(), g - 120); g -= 120;
  // grown: the difference
  const grown = await A.decor.move({ ...where, id: 'chair01', place: { ...piece('chair01', 180), id: undefined, model: undefined }, realm: A.at(seq) });
  assert.deepEqual([grown.ok, grown.data.realm.seq], [true, ++seq], JSON.stringify(grown));
  assert.equal(await gold(), g - 60); g -= 60;
  // shrunk: half the difference back
  assert.equal((await A.decor.move({ ...where, id: 'chair01', place: { ...piece('chair01', 100), id: undefined, model: undefined }, realm: A.at(seq++) })).ok, true);
  assert.equal(await gold(), g + 40); g += 40;
  // moved and no bigger: free, and names no record
  const free = await A.decor.move({ ...where, id: 'chair01', place: { ...piece('chair01', 100, { pos: [2, 0, 2] }), id: undefined, model: undefined } });
  assert.deepEqual([free.ok, free.data.realm], [true, undefined]);
  // a station: its licence
  assert.equal((await A.decor.move({ ...where, id: 'chair01', place: { ...piece('chair01', 100, { station: 'alchemy' }), id: undefined, model: undefined }, realm: A.at(seq++) })).ok, true);
  assert.equal(await gold(), g - DECOR_STATION_FEES.alchemy); g -= DECOR_STATION_FEES.alchemy;
  // removed: half of what it cost, into the purse
  assert.equal((await A.decor.remove({ ...where, id: 'chair01' })).error, 'realm-needed', 'a paid piece\'s half goes into a record');
  const gone = await A.decor.remove({ ...where, id: 'chair01', realm: A.at(seq) });
  assert.deepEqual([gone.ok, gone.data.realm.seq, gone.data.piece.paid], [true, seq + 1, 100]);
  assert.equal(await gold(), g + 50);
  assert.equal((await record(A)).seq, seq + 1);
});

// ---- the client ------------------------------------------------------------------------------------------------------

test('REALM P2.2b end to end: onlineHomes buys and sells for a realm character - the purse and the record alike; the sale\'s refund is the service\'s price, and a sale whose answer was lost ends the session rather than guess', async () => {
  const { player, record } = await stand();
  const entity = { goldPieces: 50_000, items: [], bankAccounts: bank(REGION, 0) };
  const A = await player('Aldric', JSON.parse(JSON.stringify(entity)));
  const lost = [];
  const session = createRealmSession({ io: A.io, id: A.char, lease: A.lease, seq: 1, onLost: (why) => lost.push(why) });
  // the last checkpoint an act asked for: the outcome's, which realmGoldAct sends and never waits on (nor does the host)
  let saved = Promise.resolve();
  const act = (o) => realmGoldAct({ session, checkpoint: () => (saved = session.checkpoint(JSON.stringify(entity))), wait: () => Promise.resolve(), ...o });
  const homes = createOnlineHomes({ api: A.homes, character: () => A.char });
  const buy = await buyOnlineHome(homes, {
    mapId: MAP, buildingKey: KEY, region: REGION, price: 42_000,
    afford: (n) => n <= entity.goldPieces, pay: (n) => { entity.goldPieces -= n; }, refund: (n) => { entity.goldPieces += n; }, realm: { act },
  });
  assert.equal(buy.ok, true, JSON.stringify(buy));
  // THE FLAKE FIELD BUGS 2026-09-29 NOTED AND COULD NOT EXPLAIN (2026-09-29b): the outcome's checkpoint is sent and not
  // waited on, so on a loaded machine its answer came after this line read the sequence (3, never 4). The pin waits for it.
  await saved;
  assert.deepEqual([entity.goldPieces, (await record(A)).save.goldPieces, session.seq], [8_000, 8_000, 4], 'checkpoint 2, the claim 3, the outcome 4');
  const sold = await sellOnlineHome(homes, { mapId: MAP, buildingKey: KEY, credit: (n) => { entity.bankAccounts[REGION].accountGold += n; }, realm: { act } });
  assert.deepEqual([sold.ok, sold.refund], [true, homeSaleRefund(42_000)]);
  assert.equal((await record(A)).save.bankAccounts[REGION].accountGold, homeSaleRefund(42_000));
  // a refused buy gives the price back
  const B = await player('Bran', { goldPieces: 50_000, items: [] });
  await B.homes.claim({ mapId: MAP, buildingKey: KEY + 5, region: 0, character: B.char, price: HOME_PRICE_MIN, realm: B.at(1) });   // HOME-PRICE (PIN MOVED): a price inside the online range, where it was 1,000
  const taken = await buyOnlineHome(homes, {
    mapId: MAP, buildingKey: KEY + 5, region: REGION, price: HOME_PRICE_MIN,
    afford: (n) => n <= entity.goldPieces, pay: (n) => { entity.goldPieces -= n; }, refund: (n) => { entity.goldPieces += n; }, realm: { act },
  });
  assert.deepEqual([taken.ok, taken.error, entity.goldPieces], [false, 'home-taken', 8_000]);
  // a sale that landed and whose answer never came: the refund is the service's to say - the session ends
  await buyOnlineHome(homes, { mapId: MAP, buildingKey: KEY + 9, region: REGION, price: HOME_PRICE_MIN, afford: () => true, pay: (n) => { entity.goldPieces -= n; }, realm: { act } });
  let landedOnce = false;
  A.door.before = async (url) => {
    if (url.endsWith('/v1/homes/release') && !landedOnce) { landedOnce = true; return; }
    if (url.endsWith('/v1/homes/release')) return;
  };
  const realFetch = A.homes.release;
  let first = true;
  A.homes.release = async (...a) => { const r = await realFetch(...a); if (first) { first = false; return { ok: false, error: 'offline' }; } return r; };
  const s2 = await sellOnlineHome(homes, { mapId: MAP, buildingKey: KEY + 9, credit: () => { throw new Error('never credited on a guess'); }, realm: { act } });
  assert.equal(s2.ok, false);
  assert.deepEqual(lost, ['unknown']);
});

/** The decor tool in an online home, for a realm character: a fake account service that moves a fake record, and the
 *  real realmGoldAct over a fake session. */
function decorRig({ gold = 100_000 } = {}) {
  const calls = [];
  const rec = { gold: 10_000, seq: 5 };
  const svc = {
    answer: null,
    async place(a) { calls.push(['place', a]); return svc.answer?.('place', a) ?? { ok: true, data: { piece: a.piece, ...(a.realm ? { realm: { seq: ++rec.seq } } : {}) } }; },
    // AUDIT REALM L1-F3: the service answers the gold the record moved (`gold`), as server-account/src/decor.js does
    async move(a) {
      calls.push(['move', a]);
      const was = rig.standing.find((p) => p.id === a.id), now = { ...was, ...a.place };
      return svc.answer?.('move', a) ?? { ok: true, data: { piece: now, ...(a.realm ? { gold: decorGoldDelta(was, now), realm: { seq: ++rec.seq } } : {}) } };
    },
    async remove(a) { calls.push(['remove', a]); return svc.answer?.('remove', a) ?? { ok: true, data: { piece: { ...rig.standing.find((p) => p.id === a.id), paid: 200 }, ...(a.realm ? { gold: decorRefund(200), realm: { seq: ++rec.seq } } : {}) } }; },
  };
  const session = { seq: 5, async transact(call) { const r = await call({ id: 'r' + '0'.repeat(20), lease: 'a'.repeat(32), seq: session.seq }); if (r?.ok && r.seq > session.seq) session.seq = r.seq; return r; } };
  const checkpoints = [];
  const act = (o) => realmGoldAct({ session, checkpoint: () => checkpoints.push(rig.w.gold), wait: () => Promise.resolve(), ...o });
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold, realm: act });
  return { rig, svc, calls, session, checkpoints };
}
const decorKey = (rig, code) => rig.win.fire('keydown', { code, target: rig.doc.body });
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
function roomPress(rig, id, label) {
  const root = panelOf(rig);
  if (one(root, 'dfdecor-card').dataset.mode !== 'room') all(root, 'dfdecor-chip').find((c) => /^In this room/.test(c.textContent)).fire('click');
  rows(root).find((r) => r.dataset.key === id).fire('click');
  all(root, 'dfdecor-btn').find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent))).fire('click');
}

test('REALM P2.2b the decor tool for a realm character: a piece placed pays at once and is given back on a refusal; a resize pays or is paid on the answer; a removal\'s half comes back once; a station\'s licence pays at once - every one a realm act carrying the record, and a free change none', async () => {
  const { rig, svc, calls, checkpoints } = decorRig();
  // placed: paid at once, the call carrying the record
  await placeFrom(rig, 'm41000');
  rig.frame();
  const price = rig.tool.ghost().paid;
  assert.equal(await rig.tool.commit(), true);
  assert.deepEqual([calls.at(-1)[0], !!calls.at(-1)[1].realm, rig.w.paid.at(-1), rig.w.credited.length], ['place', true, price, 0]);
  assert.equal(checkpoints.length, 2, 'the purse checkpointed before and after');
  const chair = rig.standing.at(-1);
  // refused: the price comes back
  svc.answer = (k) => (k === 'place' ? { ok: false, error: 'decor-cap' } : null);
  rig.frame();
  assert.equal(await rig.tool.commit(), false);
  assert.deepEqual([rig.w.paid.at(-1), rig.w.credited.at(-1)], [price, price], 'paid at once, given back');
  svc.answer = null;
  rig.tool.back();
  // removed: half of what the SERVICE says it cost, once
  const creditedBefore = rig.w.credited.length;
  roomPress(rig, chair.id, 'Remove');
  await settle(); await settle();
  assert.deepEqual([calls.at(-1)[0], !!calls.at(-1)[1].realm], ['remove', true]);
  assert.deepEqual(rig.w.credited.slice(creditedBefore), [decorRefund(200)], 'the service\'s half, credited once');
  // a removal whose answer was lost after it landed: the half is the service's to say, so nothing is guessed - the act
  // answers unknown and the session ends (AUDIT REALM L1-F3); a second piece from the catalogue
  const root = panelOf(rig);
  all(root, 'dfdecor-chip').find((c) => c.textContent === 'Catalog').fire('click');   // PIN MOVED (VOICE2): Catalog, American spelling
  rows(root).find((r) => r.dataset.key === 'm41000').fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame(); await settle(); rig.frame();
  assert.equal(await rig.tool.commit(), true);
  const second = rig.standing.at(-1);
  rig.tool.back();
  let asked = 0;
  svc.answer = (k, a) => (k !== 'remove' ? null : ++asked === 1 ? { ok: false, error: 'offline' } : { ok: false, error: 'seq', seq: a.realm.seq + 1 });
  const before = rig.w.credited.length;
  roomPress(rig, second.id, 'Remove');
  await settle(); await settle(); await settle();
  assert.deepEqual([asked, rig.w.credited.slice(before)], [2, []], 'landed with its answer lost: nothing guessed, never twice');
  svc.answer = null;
  // a third piece, grown and shrunk: the difference paid at once, the shrink's half on the answer
  const root2 = panelOf(rig);
  all(root2, 'dfdecor-chip').find((c) => c.textContent === 'Catalog').fire('click');   // PIN MOVED (VOICE2): Catalog, American spelling
  rows(root2).find((r) => r.dataset.key === 'm41000').fire('click');
  all(root2, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame(); await settle(); rig.frame();
  assert.equal(await rig.tool.commit(), true);
  const third = rig.standing.at(-1);
  rig.tool.back();
  const moving = async () => { roomPress(rig, third.id, 'Move'); rig.frame(); await settle(); rig.frame(); };
  await moving();
  decorKey(rig, 'Equal'); rig.frame();
  const grow = decorRescale(0.8, third.paid, rig.tool.ghost().scale);
  const paidBefore = rig.w.paid.length;
  decorKey(rig, 'KeyE');
  await settle(); await settle();
  assert.deepEqual([calls.at(-1)[0], !!calls.at(-1)[1].realm, rig.w.paid.slice(paidBefore)], ['move', true, [grow.pay]], 'grown: the difference, paid at once');
  const grown = rig.standing.find((p) => p.id === third.id);
  await moving();
  for (let i = 0; i < 4; i++) decorKey(rig, 'Minus');
  rig.frame();
  const shrink = decorRescale(0.8, grown.paid, rig.tool.ghost().scale);
  const credBefore = rig.w.credited.length;
  decorKey(rig, 'KeyE');
  await settle(); await settle();
  assert.deepEqual([!!calls.at(-1)[1].realm, rig.w.credited.slice(credBefore)], [true, [shrink.refund]], 'shrunk: half the difference, on the answer');
  // a station: its licence, paid at once
  const feeBefore = rig.w.paid.length;
  roomPress(rig, third.id, /^Make station/);
  await settle(); await settle();
  assert.deepEqual([calls.at(-1)[0], calls.at(-1)[1].place.station, !!calls.at(-1)[1].realm, rig.w.paid.slice(feeBefore)], ['move', 'alchemy', true, [DECOR_STATION_FEES.alchemy]]);
});

test('AUDIT REALM L1-F3: the decor tool takes what the SERVICE paid the record - a placement answered `repeat` gives its price back, a shrink or a removal the service pays nothing for credits nothing, and one whose answer was lost guesses nothing and checkpoints no guess', async () => {
  const { rig, svc, checkpoints } = decorRig();
  await placeFrom(rig, 'm41000');
  rig.frame();
  const price = rig.tool.ghost().paid;
  // the piece already standing (the service's `repeat`): no gold moved on the record, so none stays out of the purse
  svc.answer = (k, a) => (k === 'place' ? { ok: true, data: { repeat: true, piece: a.piece, realm: { seq: a.realm.seq } } } : null);
  assert.equal(await rig.tool.commit(), true);
  assert.deepEqual([rig.w.paid.at(-1), rig.w.credited.at(-1)], [price, price], 'paid at once, given back on the repeat');
  svc.answer = null;
  const piece = rig.standing.at(-1);
  rig.tool.back();
  const moving = async () => { roomPress(rig, piece.id, 'Move'); rig.frame(); await settle(); rig.frame(); };
  await moving();
  for (let i = 0; i < 4; i++) decorKey(rig, 'Equal');
  rig.frame();
  decorKey(rig, 'KeyE');
  await settle(); await settle();
  // shrunk, and the service says the record was paid nothing (a piece from before the realm): the purse takes nothing
  svc.answer = (k, a) => (k === 'move' ? { ok: true, data: { piece: { ...rig.standing.find((p) => p.id === a.id), ...a.place }, gold: 0, realm: { seq: a.realm.seq + 1 } } } : null);
  await moving();
  decorKey(rig, 'Minus'); rig.frame();
  const before = rig.w.credited.length;
  decorKey(rig, 'KeyE');
  await settle(); await settle();
  assert.deepEqual([rig.w.credited.slice(before)], [[]], 'the service\'s gold, not this client\'s half');
  // shrunk, landed, its answer lost: the half is the service's to say - nothing guessed, and no checkpoint of a purse
  // without it (it would write over the record that holds it): the act is unknown, and only a join reads it
  let asked = 0;
  svc.answer = (k, a) => (k !== 'move' ? null : ++asked === 1 ? { ok: false, error: 'offline' } : { ok: false, error: 'seq', seq: a.realm.seq + 1 });
  await moving();
  decorKey(rig, 'Minus'); rig.frame();
  const marks = checkpoints.length;
  decorKey(rig, 'KeyE');
  await settle(); await settle(); await settle();
  assert.deepEqual([asked, rig.w.credited.slice(before), checkpoints.length - marks], [2, [], 1], 'asked again, unknown - the checkpoint before it, none after');
  // removed, and the service names no gold (a piece no record paid for): nothing back
  svc.answer = (k, a) => (k === 'remove' ? { ok: true, data: { piece: { ...rig.standing.find((p) => p.id === a.id) } } } : null);
  rig.tool.back();
  roomPress(rig, piece.id, 'Remove');
  await settle(); await settle();
  assert.deepEqual(rig.w.credited.slice(before), [], 'the service\'s gold - none');
  // removed, landed, its answer lost: as the shrink - nothing guessed, no checkpoint after
  svc.answer = null;
  const root = panelOf(rig);
  all(root, 'dfdecor-chip').find((c) => c.textContent === 'Catalog').fire('click');   // PIN MOVED (VOICE2): Catalog, American spelling
  rows(root).find((r) => r.dataset.key === 'm41000').fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame(); await settle(); rig.frame();
  assert.equal(await rig.tool.commit(), true);
  const last = rig.standing.at(-1);
  rig.tool.back();
  let askedR = 0;
  svc.answer = (k, a) => (k !== 'remove' ? null : ++askedR === 1 ? { ok: false, error: 'offline' } : { ok: false, error: 'seq', seq: a.realm.seq + 1 });
  const creditedR = rig.w.credited.length, marksR = checkpoints.length;
  roomPress(rig, last.id, 'Remove');
  await settle(); await settle(); await settle();
  assert.deepEqual([askedR, rig.w.credited.slice(creditedR), checkpoints.length - marksR], [2, [], 1]);
});

test('REALM P2.2b by source: the world host hands the realm act to the homes and the decor; the sale needs the service\'s answer', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /realm: \(\) => host\.realmAct \?\? null,   \/\/ REALM P2\.2b/);
  assert.equal((m.match(/realm: host\.realmAct \? \{ act: host\.realmAct \} : null,/g) ?? []).length, 4, 'the buy and the sale - HOME-RENT: and a room rented, and its rent collected');
  const w = src('src/scenes/world.js');
  assert.match(w, /realmAct: realmSession \? \(o\) => realmGoldAct\(\{ session: realmSession, checkpoint: \(\) => onlineCheckpoint\(\), \.\.\.o \}\) : null,/);
  assert.match(src('src/systems/online/onlineHomes.js'), /needsAnswer: true,/);
});
