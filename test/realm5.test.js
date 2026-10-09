// REALM P2.2a (2026-09-28; bible/06-Systems/Realm-Arc.md section 3, Mac: "eliminate duping"): A REALM CHARACTER'S GOLD
// MOVES ON ITS RECORD WITH THE GUILD'S OWN WRITE. "One D1 transaction debits the character and credits the treasury. A
// withdrawal is the reverse." The law (src/net/realmGoldLaw.js, pinned equal to the client's wallet), the service
// (server-account/src/realm.js prepareRealmRecord, guilds.js) through the REAL Worker over the REAL migrations, and the
// client (net/guildBook.js over systems/realmSaves.js realmGoldAct) - founding, deposit and withdrawal, both or neither.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { SESSION_KEY, accountGuilds } from '../src/net/accountClient.js';
import { payFromSave, creditSave, payableOf, REALM_LETTER_TEMPLATE } from '../src/net/realmGoldLaw.js';
import { GUILD_FOUND_GOLD, GUILD_FOUND_RENOWN, GUILD_TREASURY_MAX } from '../src/net/guildLaw.js';
import { renownXpFor } from '../src/net/renown.js';
import { deductGold } from '../src/systems/court.js';
import { LETTER_OF_CREDIT_TEMPLATE as INV_LETTER } from '../src/systems/inventory.js';
import { GuildBook } from '../src/net/guildBook.js';
import { realmIo, realmCreate, realmPut, realmFetch, createRealmSession, realmGoldAct } from '../src/systems/realmSaves.js';
import { freshSave, layRecord } from './realmSeat.mjs';   // AUDIT REALM2 S1: a first save is a new character's
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const { subtle } = webcrypto;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
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
const T0 = 1_790_000_000;
const letter = (value) => ({ templateIndex: REALM_LETTER_TEMPLATE, group: 'MiscItems', value });

/** One service, and registered accounts on it - each playing a realm character with a first save, seated at Renown. */
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const fetchOf = (door) => async (url, init) => {
    door.inits.push({ url: String(url), body: init?.body });
    if (door.before) await door.before(String(url));
    const res = await worker.fetch(new Request(url, init), env);
    if (door.loseNext && String(url).includes(door.loseNext)) { door.loseNext = null; throw new TypeError('the answer was lost'); }
    return res;
  };
  async function player(handle, save, { renown = GUILD_FOUND_RENOWN } = {}) {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const reg = await worker.fetch(new Request('https://accounts.invalid/v1/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: g.secret, handle, password: 'a good long one', ...ACCEPTED }),
    }), env);
    assert.equal(reg.status, 200, `${handle} registers`);
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    const door = { inits: [], before: null, loseNext: null };
    const fetch = fetchOf(door);
    const io = realmIo({ fetch, storage });
    const made = (await realmCreate(io, handle)).data;
    // AUDIT REALM2 S1: the first save a new character's (the service reads it); the record the pins count from laid over it
    assert.equal((await realmPut(io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: handle })))).ok, true);
    layRecord(env, made.id, save);
    if (renown > 1) {
      env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(g.id, made.id, handle, renownXpFor(renown), T0, T0);
    }
    const guilds = accountGuilds({ fetch, storage });
    return { id: g.id, handle, io, door, guilds, char: made.id, lease: made.lease, seq: 1, at: () => ({ id: made.id, lease: made.lease, seq: 1 }) };
  }
  const record = async (P) => { const r = await realmFetch(P.io, P.char); return { seq: r.seq, save: JSON.parse(r.text) }; };
  const treasury = (guildId) => env.DB._raw.prepare('SELECT treasury FROM guilds WHERE id = ?').get(guildId)?.treasury;
  return { env, player, record, treasury };
}

// ---- the law ---------------------------------------------------------------------------------------------------------

test('REALM P2.2 law: the record pays exactly as the client\'s wallet pays - deductGold\'s coins-then-letters order, and the shortfall off the region\'s account; what it cannot pay changes nothing', () => {
  assert.equal(REALM_LETTER_TEMPLATE, INV_LETTER);
  const cases = [
    { gold: 500, letters: [], bank: 0, pay: 200 },                  // the coins cover it
    { gold: 100, letters: [300], bank: 0, pay: 250 },               // a letter first, not the coins
    { gold: 100, letters: [100, 100], bank: 0, pay: 250 },          // two letters, then the coins
    { gold: 50, letters: [100], bank: 1000, pay: 400 },             // then the region's account
    { gold: 0, letters: [], bank: 1000, pay: 1000 },                // the account alone
  ];
  for (const c of cases) {
    const make = () => ({ goldPieces: c.gold, items: c.letters.map(letter), bankAccounts: [{ accountGold: 0 }, { accountGold: c.bank }] });
    const save = make(), live = make();
    assert.equal(payFromSave(save, c.pay, 1), true, JSON.stringify(c));
    // the client's wallet: court.js deductGold, then the region's account for the shortfall (scenes/world.js)
    const short = deductGold(live, c.pay);
    if (short > 0) live.bankAccounts[1].accountGold -= short;
    assert.deepEqual(save, live, `the record and the wallet agree: ${JSON.stringify(c)}`);
    assert.equal(payableOf(make(), 1) - payableOf(save, 1), c.pay);
  }
  const poor = { goldPieces: 10, items: [letter(20)], bankAccounts: [{ accountGold: 5 }] };
  const before = JSON.stringify(poor);
  assert.equal(payFromSave(poor, 36, 0), false);
  assert.equal(payFromSave(poor, 31, 1), false, 'a region with no account of its own and no Empire account pays from the purse alone');
  assert.equal(JSON.stringify(poor), before, 'nothing changed');
  assert.equal(payFromSave(poor, 35, 0), true);
  const c = { goldPieces: 5, bankAccounts: [{ accountGold: 7 }] };
  creditSave(c, 10);
  creditSave(c, 3, { bank: 0 });
  creditSave(c, 4, { bank: 9 });   // no such account: the purse keeps it
  assert.deepEqual(c, { goldPieces: 19, bankAccounts: [{ accountGold: 10 }] });
  assert.equal(creditSave(c, -1), false);
});

// ---- the service -----------------------------------------------------------------------------------------------------

test('REALM P2.2: a realm character founds, deposits and withdraws on its record - the guild\'s write and the record\'s gold in one batch, each one sequence on', async () => {
  const { player, record, treasury } = await stand();
  const A = await player('Aldric', { name: 'Aldric', goldPieces: 12_000, items: [letter(500)], bankAccounts: [{ accountGold: 0 }, { accountGold: 2_000 }] });
  const found = await A.guilds.found({ character: A.char, name: 'The Iron Oath', tag: 'IRON', realm: A.at(), region: 1 });
  assert.equal(found.ok, true, JSON.stringify(found));
  assert.equal(found.data.realm.seq, 2);
  let r = await record(A);
  assert.deepEqual([r.seq, r.save.goldPieces, r.save.items.length, r.save.name], [2, 2_000, 1, 'Aldric'], 'the founding\'s 10,000 from the coins (they cover it); the letter and the rest of the save untouched');
  const guildId = found.data.guild.id;
  // a deposit: the record pays, the treasury holds it
  const dep = await A.guilds.deposit(A.char, 3_000, { id: A.char, lease: A.lease, seq: 2 }, 1);
  assert.deepEqual([dep.ok, dep.data.treasury, dep.data.realm.seq], [true, 3_000, 3]);
  r = await record(A);
  assert.deepEqual([r.seq, r.save.goldPieces, r.save.items.length, r.save.bankAccounts[1].accountGold], [3, 0, 0, 1_500], 'the letter first (500), then the coins (2,000), then the region\'s account (500)');
  // a withdrawal: the treasury gives, the record's purse takes
  const wd = await A.guilds.withdraw(A.char, 1_000, { id: A.char, lease: A.lease, seq: 3 });
  assert.deepEqual([wd.ok, wd.data.treasury, wd.data.realm.seq], [true, 2_000, 4]);
  r = await record(A);
  assert.deepEqual([r.seq, r.save.goldPieces], [4, 1_000]);
  assert.equal(treasury(guildId), 2_000);
});

test('REALM P2.2: nothing moves on a refusal - a realm character that names no record, a purse that cannot pay, a treasury at its cap, a record that moved, a lease another tab took; and no other character may carry a record', async () => {
  const { env, player, record, treasury } = await stand();
  const A = await player('Aldric', { goldPieces: 12_000 });
  assert.equal((await A.guilds.found({ character: A.char, name: 'The Iron Oath', tag: 'IRON' })).error, 'realm-needed', 'a realm character must say where its record stands');
  const found = await A.guilds.found({ character: A.char, name: 'The Iron Oath', tag: 'IRON', realm: A.at() });
  const guildId = found.data.guild.id;
  const at = (seq) => ({ id: A.char, lease: A.lease, seq });
  const before = await record(A);
  // a purse that cannot pay
  assert.equal((await A.guilds.deposit(A.char, 2_001, at(2))).error, 'realm-gold');
  // a treasury at its cap: the record's move rolls back with it
  const setTreasury = (n) => env.DB._raw.prepare('UPDATE guilds SET treasury = ?, moved_by = ?, moved_at = ? WHERE id = ?').run(n, 'test', T0, guildId);   // the ledger's trigger names a mover
  setTreasury(GUILD_TREASURY_MAX - 10);
  assert.equal((await A.guilds.deposit(A.char, 100, at(2))).error, 'guild-treasury-full');
  assert.deepEqual(await record(A), before, 'the record never moved');
  // more than the treasury holds
  setTreasury(50);
  assert.equal((await A.guilds.withdraw(A.char, 100, at(2))).error, 'guild-treasury-short');
  assert.deepEqual(await record(A), before);
  // a record that moved on: told the service's own sequence
  const stale = await A.guilds.deposit(A.char, 10, at(1));
  assert.deepEqual([stale.error, stale.seq], ['seq', 2]);
  // an id not the record's
  assert.equal((await A.guilds.deposit(A.char, 10, { ...at(2), id: 'r' + 'a'.repeat(20) })).error, 'realm-needed');
  // a lease another tab took
  assert.equal((await A.guilds.deposit(A.char, 10, { ...at(2), lease: 'f'.repeat(32) })).error, 'lease');
  assert.deepEqual([await record(A), treasury(guildId)], [before, 50], 'nothing moved, anywhere');
  // no other character may carry a record: a deposit asks before anything else - and a founding (AUDIT REALM2 S2) is a
  // realm character's alone, so any other is refused before its record is even read
  const ask = async (path, body) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${JSON.parse(A.io.storage.getItem(SESSION_KEY)).secret}` },
      body: JSON.stringify(body),
    }), env);
    return [res.status, (await res.json()).error];
  };
  assert.deepEqual(await ask('/v1/guilds/deposit', { character: 'char-offline', gold: 10, realm: at(2) }), [400, 'body']);
  assert.deepEqual(await ask('/v1/guilds/found', { character: 'char-offline', name: 'The Salt Road', tag: 'SALT', realm: at(2) }), [400, 'realm-only']);
});

test('REALM P2.2: a record that moves under the batch rolls the guild\'s write back with it - the treasury never holds gold the record kept', async () => {
  const { env, player, record, treasury } = await stand();
  const A = await player('Aldric', { goldPieces: 12_000 });
  const guildId = (await A.guilds.found({ character: A.char, name: 'The Iron Oath', tag: 'IRON', realm: A.at() })).data.guild.id;
  const realBatch = env.DB.batch.bind(env.DB);
  let raced = false;
  env.DB.batch = async (list) => {
    if (!raced) { raced = true; assert.equal((await realmPut(A.io, A.char, { lease: A.lease, seq: 3 }, '{"goldPieces":2000,"mid":1}')).ok, true); }
    return realBatch(list);
  };
  const r = await A.guilds.deposit(A.char, 500, { id: A.char, lease: A.lease, seq: 2 });
  assert.deepEqual([r.error, r.seq], ['seq', 3], 'the record moved: the act did not land');
  assert.equal(treasury(guildId), 0, 'the treasury never took it');
  assert.deepEqual((await record(A)).save, { goldPieces: 2000, mid: 1 }, 'the checkpoint that landed stands');
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM guild_ledger').first()).n, 0, 'no ledger line for gold that never moved');
});

// ---- the client ------------------------------------------------------------------------------------------------------

/** A Guild book over a real session: a plain entity's purse, its checkpoint its JSON. INT2 (PIN MOVED): each entity carries
 *  its level, as every save does - the judge holds the trade of a checkpoint that is no character (judge.js). */
async function book(s, handle, entity) {
  const P = await s.player(handle, JSON.parse(JSON.stringify(entity)));
  P.session = createRealmSession({ io: P.io, id: P.char, lease: P.lease, seq: 1 });
  const checkpoint = () => P.session.checkpoint(JSON.stringify(entity));
  P.book = new GuildBook({
    door: P.guilds,
    character: () => P.char,
    wallet: () => ({
      gold: () => (entity.goldPieces ?? 0) + (entity.bankAccounts?.[1]?.accountGold ?? 0),
      pay: (n) => { const short = deductGold(entity, n); if (short > 0) entity.bankAccounts[1].accountGold -= short; },
      credit: (n) => { entity.goldPieces += n; },
      region: () => 1,
    }),
    realm: { act: (o) => realmGoldAct({ session: P.session, checkpoint, wait: () => Promise.resolve(), ...o }) },
  });
  P.entity = entity;
  return P;
}

test('REALM P2.2 end to end: the Guild book founds, deposits and withdraws for a realm character - the purse and the record move alike, each act one sequence on, and a refusal gives the gold back', async () => {
  const s = await stand();
  const entity = { name: 'Aldric', level: 1, goldPieces: 11_000, items: [], bankAccounts: [{ accountGold: 0 }, { accountGold: 3_000 }] };
  const P = await book(s, 'Aldric', entity);
  const found = await P.book.found('The Iron Oath', 'IRON');
  assert.equal(found.ok, true, JSON.stringify(found));
  assert.deepEqual([entity.goldPieces, entity.bankAccounts[1].accountGold, P.session.seq], [1_000, 3_000, 4], 'checkpoint at 2, the founding at 3, the outcome at 4');
  let r = await s.record(P);
  assert.deepEqual([r.seq, r.save.goldPieces], [4, 1_000]);
  // gold picked up since the last checkpoint: only the checkpoint the act makes first lets the record pay with it
  entity.goldPieces += 5_000;
  assert.equal((await P.book.deposit(5_500)).ok, true);
  assert.deepEqual([entity.goldPieces, entity.bankAccounts[1].accountGold], [500, 3_000], 'the coins cover it');
  r = await s.record(P);
  assert.deepEqual([r.save.goldPieces, r.save.bankAccounts[1].accountGold, P.book.guild.treasury], [500, 3_000, 5_500]);
  // and one that reaches the region's account
  assert.equal((await P.book.deposit(1_000)).ok, true);
  assert.deepEqual([entity.goldPieces, entity.bankAccounts[1].accountGold, (await s.record(P)).save.bankAccounts[1].accountGold], [0, 2_500, 2_500]);
  assert.equal((await P.book.withdraw(700)).ok, true);
  assert.deepEqual([entity.goldPieces, (await s.record(P)).save.goldPieces, P.book.guild.treasury], [700, 700, 5_800]);
  // a refusal: the treasury cannot hold it - the purse gets it back and the record never moved
  s.env.DB._raw.prepare('UPDATE guilds SET treasury = ?, moved_by = ?, moved_at = ? WHERE id = ?').run(GUILD_TREASURY_MAX - 1, 'test', T0, P.book.guild.id);
  const seqBefore = P.session.seq;
  const full = await P.book.deposit(500);
  assert.deepEqual([full.ok, full.error], [false, 'guild-treasury-full']);
  assert.deepEqual([entity.goldPieces, entity.bankAccounts[1].accountGold], [700, 2_500], 'the coins paid out at once came back');
  assert.equal((await s.record(P)).save.goldPieces, 700, 'the outcome\'s checkpoint says so');
  assert.equal(P.session.seq, seqBefore + 2, 'the checkpoint before, the outcome after - the act itself never landed');
});

test('REALM P2.2: an answer that was lost is asked again - the record one ahead is the act, landed, never paid twice; still lost, the session ends with the gold where it is', async () => {
  const s = await stand();
  const entity = { name: 'Aldric', level: 1, goldPieces: 11_000, items: [], bankAccounts: [{ accountGold: 0 }, { accountGold: 0 }] };
  const P = await book(s, 'Aldric', entity);
  assert.equal((await P.book.found('The Iron Oath', 'IRON')).ok, true);
  P.door.loseNext = '/v1/guilds/deposit';   // the deposit lands; its answer never comes back
  const r = await P.book.deposit(400);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([entity.goldPieces, P.book.guild.treasury, (await s.record(P)).save.goldPieces], [600, 400, 600], 'paid once, held once');
  // no answer at all: the session ends, the purse as the act left it
  const lost = [];
  const Q = await book(s, 'Bran', { name: 'Bran', level: 1, goldPieces: 11_000, items: [], bankAccounts: [{ accountGold: 0 }, { accountGold: 0 }] });
  Q.session = createRealmSession({ io: Q.io, id: Q.char, lease: Q.lease, seq: 1, onLost: (why) => lost.push(why) });
  Q.book.realm = { act: (o) => realmGoldAct({ session: Q.session, checkpoint: () => Q.session.checkpoint(JSON.stringify(Q.entity)), wait: () => Promise.resolve(), ...o }) };
  Q.door.before = async (url) => { if (url.endsWith('/v1/guilds/found')) throw new TypeError('network'); };
  const f = await Q.book.found('The Salt Road', 'SALT');
  assert.equal(f.ok, false);
  assert.deepEqual([lost, Q.entity.goldPieces], [['unknown'], 1_000], 'the fee stays out: giving it back could be the duplication');
});

test('REALM P2.2 by source: the world host\'s Guild book acts on the record for a realm character, its wallet naming the region the record pays from', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /realm: realmSession \? \{ act: \(o\) => realmGoldAct\(\{ session: realmSession, checkpoint: \(\) => onlineCheckpoint\(\), \.\.\.o \}\), abandon: \(why\) => realmSession\.abandon\(why\) \} : null,/);   // PIN MOVED (AUDIT2 GUILD2 K1): and `abandon`, where a vault take's answer is lost
  assert.match(w, /region: \(\) => _questRegionIndex\(\) \?\? 0,   \/\/ REALM P2\.2/);
  const g = src('server-account/src/guilds.js');
  // AUDIT REALM L1-F2: each asks where the record stands FIRST (realm.js realmActFirst) - before the rate, the rank and the membership
  assert.equal((g.match(/const side = await realmActFirst\(db, player\.id, character, realm\);/g) ?? []).length, 3, 'the founding, the deposit and the withdrawal each ask');
});
