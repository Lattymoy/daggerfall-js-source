// REALM P1.2 (2026-09-28; bible/06-Systems/Realm-Arc.md section 2): THE REALM'S CHARACTERS, CLIENT SIDE
// (src/systems/realmSaves.js) - the calls and the playing tab's session, driven against the REAL Worker over the REAL
// migrations through a fetch-shaped door (test/server/cloudsaves.test.js's fetchOf). A session checkpoints in order at the
// next sequence, the newest save replacing an older one that never left; it resyncs a checkpoint whose answer was
// lost; it keeps the newest save through a network failure; and it ends - once, said to the host - when another tab
// joins the character.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import {
  realmIo, realmList, realmCreate, realmJoin, realmFetch, realmDelete, realmCustoms, createRealmSession, REALM_LOST,
} from '../../src/systems/realmSaves.js';
import { freshSave } from '../realmSeat.mjs';   // AUDIT REALM2 S1: a first save is a new character's
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** AUDIT REALM2 S1: a first save the realm takes, `tag` to tell two apart. */
const first = (tag) => JSON.stringify(freshSave({ name: 'Nystul', tag }));
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
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    // D1's batch is one transaction (test/net/realm4.test.js's face): all of it, or none - AUDIT REALM's delete and customs ride one
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
    async get(key) { const v = m.get(key); return v === undefined ? null : { key, size: v.byteLength, body: v }; },
    async delete(key) { m.delete(key); },
  };
}
function fakeStorage() {
  const m = new Map();
  return { _map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
/** A signed-in guest on a device, the Worker behind its fetch - and a door that can fail on purpose. */
async function device() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  const storage = fakeStorage();
  storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
  const door = { mode: 'ok', inits: [] };
  const fetch = async (url, init) => {
    door.inits.push(init);
    if (door.mode === 'offline') throw new TypeError('network');
    const res = await worker.fetch(new Request(url, init), env);
    if (door.mode === 'lose-answer') { door.mode = 'ok'; throw new TypeError('the answer was lost'); }
    return res;
  };
  return { env, storage, door, io: realmIo({ fetch, storage }), g };
}

test('REALM P1.2: signed out is not an error - no io, and every call says so', async () => {
  assert.equal(realmIo({ fetch: async () => { throw new Error('never'); }, storage: fakeStorage() }), null);
  for (const r of [await realmList(null), await realmJoin(null, 'r'), await realmFetch(null, 'r')]) assert.deepEqual(r, { ok: false, error: 'signed-out' });
  assert.ok(REALM_LOST.includes('lease') && REALM_LOST.includes('no-realm-character') && REALM_LOST.includes('auth'));
});

test('REALM P1.2: made, joined, checkpointed and read back - the save is the text a slot holds, the sequence the service\'s', async () => {
  const { io } = await device();
  const made = await realmCreate(io, 'Nystul', { level: 1 });
  assert.equal(made.ok, true);
  const { id, lease, seq } = made.data;
  assert.deepEqual((await realmFetch(io, id)), { ok: false, error: 'no-data', status: 404 });
  const s = createRealmSession({ io, id, lease, seq });
  assert.deepEqual(await s.checkpoint(first('v1'), { level: 2 }), { ok: true, seq: 1 });
  assert.equal(s.seq, 1);
  const back = await realmFetch(io, id);
  assert.deepEqual([back.ok, back.text, back.seq], [true, first('v1'), 1]);
  const listed = await realmList(io);
  assert.deepEqual([listed.characters.length, listed.characters[0].summary.level, listed.max], [1, 2, 6]);
  assert.equal((await realmCustoms(io, 'c0ffee00-1111', 'X')).error, 'customs-never-online');
  assert.equal((await realmDelete(io, id)).ok, true);
  assert.deepEqual((await realmList(io)).characters, []);
});

test('REALM P1.2: checkpoints go one at a time, in order - one asked while another is in flight waits, and the newest replaces an older one that never left', async () => {
  const { io } = await device();
  const { id, lease, seq } = (await realmCreate(io, 'Nystul')).data;
  const s = createRealmSession({ io, id, lease, seq });
  const a = s.checkpoint(first('a'));
  const b = s.checkpoint('b');
  const c = s.checkpoint('c');
  // AUDIT REALM2 C4: each answered by the put that carried its save - "b", replaced before it left, by "c"'s
  assert.deepEqual([await a, await b, await c], [{ ok: true, seq: 1 }, { ok: true, seq: 2 }, { ok: true, seq: 2 }], '"a" at 1, then the newest - "c" - at 2; "b" never left');
  assert.equal((await realmFetch(io, id)).text, 'c');
});

test('REALM P1.2: a checkpoint whose answer was lost is resynced - the service one ahead is our own write, adopted, and the next save sent after it', async () => {
  const { io, door } = await device();
  const { id, lease, seq } = (await realmCreate(io, 'Nystul')).data;
  const s = createRealmSession({ io, id, lease, seq });
  door.mode = 'lose-answer';
  const landed = await s.checkpoint(first('landed'));
  assert.deepEqual([landed.ok, landed.error, s.seq, s.waiting], [false, 'offline', 0, true], 'it landed; this tab could not know');
  assert.deepEqual(await s.checkpoint('next'), { ok: true, seq: 2 }, 'told seq 1, adopted, sent at 2');
  assert.equal((await realmFetch(io, id)).text, 'next');
  assert.equal(s.lost, null, 'a resync is not a loss');
});

test('REALM P1.2: offline keeps the newest save for the next checkpoint; nothing throws', async () => {
  const { io, door } = await device();
  const { id, lease, seq } = (await realmCreate(io, 'Nystul')).data;
  const s = createRealmSession({ io, id, lease, seq });
  door.mode = 'offline';
  assert.deepEqual(await s.checkpoint('while away'), { ok: false, error: 'offline' });
  assert.equal(s.waiting, true);
  door.mode = 'ok';
  assert.deepEqual(await s.checkpoint(first('back')), { ok: true, seq: 1 }, 'the newest goes');
  assert.equal((await realmFetch(io, id)).text, first('back'));
});

test('REALM P1.2: another tab\'s join ends this session - said once, and no checkpoint of it is ever sent again; a leave gives the lease up', async () => {
  const { io, door } = await device();
  const { id, lease, seq } = (await realmCreate(io, 'Nystul')).data;
  const said = [];
  const s = createRealmSession({ io, id, lease, seq, onLost: (why) => said.push(why) });
  assert.equal((await s.checkpoint(first('mine'))).ok, true);
  const other = await realmJoin(io, id);   // another tab
  assert.equal(other.ok, true);
  assert.deepEqual(await s.checkpoint('stale'), { ok: false, error: 'lease' });
  assert.deepEqual(said, ['lease']);
  const before = door.inits.length;
  assert.deepEqual(await s.checkpoint('again'), { ok: false, error: 'lease' });
  assert.deepEqual(await s.checkpoint('and again'), { ok: false, error: 'lease' }, 'every one after, answered at once (AUDIT REALM2 C4: none left waiting on a drain)');
  assert.equal(door.inits.length, before, 'nothing sent');
  assert.deepEqual(said, ['lease'], 'said once');
  assert.equal((await realmFetch(io, id)).text, first('mine'));
  // the other tab's session leaves, sending what waits first
  const t = createRealmSession({ io, id, lease: other.data.lease, seq: other.data.seq });
  t.checkpoint('theirs');
  const left = await t.leave();
  assert.deepEqual(left.data, { ok: true, released: true });
  assert.equal((await realmFetch(io, id)).text, 'theirs', 'what waited went first');
  assert.deepEqual(await t.checkpoint('after'), { ok: false, error: 'left' });
  // a leave as the page goes asks the browser to finish it - the leave alone
  const u = createRealmSession({ io, id, lease: (await realmJoin(io, id)).data.lease, seq: 2 });
  await u.leave({ keepalive: true });
  assert.equal(door.inits.at(-1).keepalive, true);
  assert.match(door.inits.at(-1).body, /"lease"/);
});

test('REALM P1.2: a secret the service no longer honours is forgotten - accountClient.js\'s one exception - and a session told `auth` ends', async () => {
  const { env, storage } = await device();
  storage.setItem(SESSION_KEY, JSON.stringify({ id: 'nobody', secret: 'not-a-secret-the-service-holds' }));
  const io = realmIo({ fetch: (url, init) => worker.fetch(new Request(url, init), env), storage });
  const r = await realmList(io);
  assert.deepEqual([r.ok, r.error, r.status], [false, 'auth', 401]);
  assert.equal(storage.getItem(SESSION_KEY), null, 'signed out');
  const said = [];
  const s = createRealmSession({ io, id: 'r0123456789abcdef0123', lease: 'a'.repeat(32), seq: 0, onLost: (why) => said.push(why) });
  assert.deepEqual(await s.checkpoint('x'), { ok: false, error: 'auth' });
  assert.deepEqual(said, ['auth']);
});

test('REALM P1.2: a leave sends the save that waited through a failure before it gives the lease up', async () => {
  const { io, door } = await device();
  const { id, lease, seq } = (await realmCreate(io, 'Nystul')).data;
  const s = createRealmSession({ io, id, lease, seq });
  door.mode = 'offline';
  await s.checkpoint(first('waited'));
  assert.equal(s.waiting, true);
  door.mode = 'ok';
  const left = await s.leave();
  assert.equal(left.data.released, true);
  assert.equal((await realmFetch(io, id)).text, first('waited'), 'the waiting save went before the leave');
});
