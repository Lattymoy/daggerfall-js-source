// REALM-GZIP (2026-09-30, the field: Thoryn's tile said "This character's save is too big for the realm to take. The
// realm keeps the last save it took."): A REALM SAVE RIDES PACKED. The save is the snapshot's JSON, a long life's grew
// past the request's 4 MiB (REALM_MAX_BYTES), and every checkpoint after it was refused for good.
//
// Pinned here, through the REAL Worker over the REAL migrations and the client's own calls:
//   - the law (src/net/realm/realmSaveCodec.js): packed and opened byte for byte, told apart by its first bytes, and every
//     opening bounded;
//   - the service: a packed checkpoint past 4 MiB of text lands; a first save is measured packed as plain (AUDIT
//     REALM2 S1 holds); the text's own bound is kept on the request (the trailer) and at every opening (a trailer that
//     lies buys nothing); a gold act and a trade read a packed record and write one past 4 MiB of text;
//   - both ends older than the other: a tab asks for the save as stored and opens it, a build from before is answered
//     the text; a tab packs only when the service's join, create or customs answer said `gzip`;
//   - the hosts hand that word on (world.js's session and birth, the door's customs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../server-account/src/index.js';
import { prepareRealmRecord, REALM_MAX_BYTES } from '../../server-account/src/realm.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import {
  REALM_TEXT_MAX_BYTES, isGzip, gzipSizeOf, gzipText, gunzipText, saveTextOf,
} from '../../src/net/realm/realmSaveCodec.js';
import {
  realmIo, realmCreate, realmPut, realmJoin, realmFetch, realmTradeCall, openRealmBoot, createRealmSession,
} from '../../src/systems/realmSaves.js';
import { createTradePack } from '../../src/systems/tradePack.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { d1 } from '../accountDb.mjs';
import { r2, freshSave } from '../realmSeat.mjs';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MiB = 1024 * 1024;
const enc = (s) => new TextEncoder().encode(s);

/** A LONG LIFE's save: a real save's shape - records of varied numbers and names - past `bytes` of JSON. JSON like this
 *  packs several times over, and not the thousandfold a run of one letter does. */
function longLife(bytes, extra = {}) {
  const items = [];
  const save = { v: 1, name: 'Thoryn', level: 6, goldPieces: 120, items, ...extra };
  for (let i = 0; JSON.stringify(save).length < bytes; i += 1) {
    for (let k = 0; k < 500; k += 1, i += 1) {
      items.push({ templateIndex: (i * 37) % 300, name: `Record ${i}`, value: (i * 7919) % 10007, condition: (i * 31) % 100, flags: i % 7, dyeColor: (i * 13) % 64 });
    }
  }
  return save;
}

function fakeStorage() {
  const m = new Map();
  return { _map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}

/** One service, and `player()` - a signed-in account on its own device, every request it sends logged (`urls`, `bodies`).
 *  `older` makes that device's service one from before REALM-GZIP in the one way a tab can see: its answers never say
 *  `gzip`. */
async function realm() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  async function player({ older = false } = {}) {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    const door = { urls: [], bodies: [] };
    const fetch = async (url, init) => {
      door.urls.push(`${init?.method ?? 'GET'} ${url}`);
      door.bodies.push(init?.body);
      const res = await worker.fetch(new Request(url, init), env);
      if (!older || !(res.headers.get('content-type') ?? '').includes('json')) return res;
      const { gzip, ...rest } = await res.json();
      return new Response(JSON.stringify(rest), { status: res.status, headers: res.headers });
    };
    return { g, door, env, io: realmIo({ fetch, storage }) };
  }
  return { env, player };
}

/** A realm character made through the client's calls, its first save a new one's. Answers `{ id, lease, gzip }`. */
async function born(P, name = 'Thoryn') {
  const made = await realmCreate(P.io, name);
  assert.equal(made.ok, true);
  const put = await realmPut(P.io, made.data.id, { lease: made.data.lease, seq: 1 }, JSON.stringify(freshSave({ name })), { gzip: made.data.gzip === true });
  assert.equal(put.ok, true, `${name}'s first save lands`);
  return { id: made.data.id, lease: made.data.lease, gzip: made.data.gzip };
}

const rowOf = (env, id) => env.DB._raw.prepare('SELECT seq, bytes, obj, lease FROM realm_characters WHERE id = ?').get(id);
const storedOf = (env, id) => env.SAVES._map.get(rowOf(env, id).obj);
/** THE RECORD A PIN COUNTS FROM, laid over the character's current save PACKED (realmSeat.mjs layRecord's, gzipped). */
async function layPacked(env, id, save) {
  const packed = await gzipText(JSON.stringify(save));
  env.SAVES._map.set(rowOf(env, id).obj, packed);
  env.DB._raw.prepare('UPDATE realm_characters SET bytes = ? WHERE id = ?').run(packed.byteLength, id);
}
/** A read as a build from before REALM-GZIP asks it: no `?enc=gzip`. */
const olderRead = async (P, id) => worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, { headers: { authorization: `Bearer ${P.g.secret}` } }), P.env);
const rawPut = (P, id, lease, seq, body) => worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
  method: 'PUT', headers: { authorization: `Bearer ${P.g.secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) }, body,
}), P.env);
/** A GZIP WHOSE TRAILER LIES: two members, the text's all but its last two bytes and then those two - gzip opens them as
 *  one text, and the trailer at the end is the second member's, which says two bytes. (One member with its trailer bent
 *  opens to nothing at all: the length is checked at its end.) */
async function lyingGzip(text) {
  const head = await gzipText(text.slice(0, -2)), tail = await gzipText(text.slice(-2));
  const both = new Uint8Array(head.byteLength + tail.byteLength);
  both.set(head);
  both.set(tail, head.byteLength);
  return both;
}

// ═══ THE LAW ══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('REALM-GZIP law: a save packs and opens byte for byte (past ASCII too); its first bytes say which it is - no JSON text begins as gzip does; the trailer says its size; every opening is bounded, and a gzip cut short or bent opens to nothing (mutants: the bound never kept; plain text read past its bound)', async () => {
  const text = JSON.stringify(longLife(2 * MiB, { race: 'Łowca ✓ Маг' }));
  const packed = await gzipText(text);
  assert.equal(isGzip(packed), true);
  assert.ok(packed.byteLength * 3 < text.length, `a save's JSON packs several times over (${packed.byteLength} of ${text.length})`);
  assert.equal(gzipSizeOf(packed), enc(text).byteLength, 'the trailer says the text\'s bytes');
  assert.equal(await gunzipText(packed), text, 'opened byte for byte');
  assert.equal(await saveTextOf(packed), text);
  for (const first of ['{', '[', ' ', '\t', '\n', '\r', '"', 'n', '1']) assert.equal(isGzip(enc(`${first}${'x'.repeat(40)}`)), false, `JSON starting ${JSON.stringify(first)} is no gzip`);
  assert.equal(await saveTextOf(enc('{"v":1}')), '{"v":1}', 'a plain save reads as it stands');
  // bounded, every way in
  assert.equal(await gunzipText(packed, 1024), null, 'opening past the bound stops at it');
  assert.equal(await saveTextOf(packed, 1024), null);
  assert.equal(await saveTextOf(enc('{"v":1}'), 3), null, 'plain text past the bound is no save either');
  assert.equal(await gunzipText(packed.slice(0, packed.byteLength - 12)), null, 'a gzip cut short');
  const bent = new Uint8Array(packed); bent[60] ^= 0xff; bent[61] ^= 0xff;
  assert.equal(await gunzipText(bent), null, 'a gzip bent on the way');
  assert.equal(REALM_TEXT_MAX_BYTES, 16 * MiB);
  assert.equal(REALM_MAX_BYTES, 4 * MiB, 'the request\'s bound stands');
});

// ═══ THE SERVICE AND THE TAB ══════════════════════════════════════════════════════════════════════════════════════════

test('REALM-GZIP: Thoryn\'s save - past the request\'s 4 MiB of text - lands packed and reads back byte for byte; the service keeps it as sent; the same text sent plain is refused as before (mutants: the tab never packs; the join never says gzip; the read never opened)', { timeout: 120_000 }, async () => {
  const r = await realm();
  const P = await r.player();
  const c = await born(P);
  assert.equal(c.gzip, true, 'the create answer says the service opens a packed save');
  const boot = await openRealmBoot({ io: P.io, id: c.id });
  assert.deepEqual([boot.ok, boot.gzip], [true, true], 'and the join, which the boot hands on');
  const lost = [];
  const session = createRealmSession({ io: P.io, id: c.id, lease: boot.lease, seq: boot.seq, gzip: boot.gzip, onLost: (why) => lost.push(why) });
  const text = JSON.stringify(longLife(REALM_MAX_BYTES + MiB));
  assert.ok(enc(text).byteLength > REALM_MAX_BYTES, 'past the request\'s bound as text');
  assert.deepEqual(await session.checkpoint(text), { ok: true, seq: 2 }, 'it lands');
  assert.deepEqual(lost, []);
  const stored = storedOf(r.env, c.id);
  assert.equal(isGzip(stored), true, 'kept as sent: packed');
  assert.equal(rowOf(r.env, c.id).bytes, stored.byteLength, 'the row counts the bytes it keeps');
  assert.ok(stored.byteLength < REALM_MAX_BYTES);
  // the tab reads it as stored and opens it
  const got = await realmFetch(P.io, c.id);
  assert.deepEqual([got.ok, got.seq, got.text === text], [true, 2, true], 'read back byte for byte');
  assert.match(P.door.urls.at(-1), /\/data\?enc=gzip$/, 'asked for as stored');
  // a build from before: answered the text it always read
  const older = await olderRead(P, c.id);
  assert.equal(older.status, 200);
  assert.equal(await older.text(), text, 'a build from before reads the text');
  // the same text plain - what a build from before sends - meets the request's bound, as it always did
  const plain = createRealmSession({ io: P.io, id: c.id, lease: boot.lease, seq: 2, gzip: false });
  assert.deepEqual(await plain.checkpoint(text), { ok: false, error: 'too-large' });
  assert.equal((await realmFetch(P.io, c.id)).text, text, 'and the realm keeps the last save it took');
});

test('REALM-GZIP: the text\'s own bound - a packed save whose trailer says past 16 MiB is refused at the door and ends the session, told once; a trailer that lies buys nothing: a first save that will not open within the bound is no save (S1), and a build from before is told no-data rather than handed it (mutants: the trailer unread; the first save read unopened, or opened unbounded; an older build\'s read opened unbounded)', { timeout: 120_000 }, async () => {
  const r = await realm();
  const P = await r.player();
  const c = await born(P);
  const boot = await openRealmBoot({ io: P.io, id: c.id });
  const lost = [];
  const session = createRealmSession({ io: P.io, id: c.id, lease: boot.lease, seq: boot.seq, gzip: true, onLost: (why) => lost.push(why) });
  const huge = JSON.stringify({ v: 1, automap: 'x'.repeat(REALM_TEXT_MAX_BYTES + 10) });
  assert.ok((await gzipText(huge)).byteLength < REALM_MAX_BYTES, 'it packs small: only its trailer says how big it is');
  assert.deepEqual(await session.checkpoint(huge), { ok: false, error: 'too-large' });
  assert.deepEqual([session.lost, lost], ['too-large', ['too-large']], 'the session ends, the host told once');
  assert.equal(rowOf(r.env, c.id).seq, 1, 'nothing landed');
  // a trailer that lies: the first save is opened within the bound, and one that will not open is no new character's
  const Q = await r.player();
  const made = (await realmCreate(Q.io, 'Liar')).data;
  const liar = await lyingGzip(JSON.stringify(freshSave({ name: 'Liar', pad: 'x'.repeat(REALM_TEXT_MAX_BYTES) })));
  assert.equal(gzipSizeOf(liar), 2, 'its trailer says two bytes');
  assert.equal(await gunzipText(liar), null, 'and it opens past the bound');
  const first = await rawPut(Q, made.id, made.lease, 1, liar);
  assert.deepEqual([first.status, (await first.json()).error], [403, 'realm-birth'], 'refused as a save that is no new character\'s');
  assert.equal(rowOf(r.env, made.id).bytes, 0, 'the row waits unsaved');
  // ...and a later checkpoint that lies lands (the service does not open a save on its every checkpoint), but every
  // opening keeps the bound: a build from before is told there is no save, never handed sixteen megabytes and more
  assert.equal((await rawPut(P, c.id, (await realmJoin(P.io, c.id)).data.lease, 2, liar)).status, 200);
  const older = await olderRead(P, c.id);
  assert.deepEqual([older.status, (await older.json()).error], [404, 'no-data']);
});

test('REALM-GZIP: a first save packed is measured as a plain one - a new character\'s lands, a rich one is refused all the same (AUDIT REALM2 S1 holds packed)', async () => {
  const r = await realm();
  const P = await r.player();
  const made = (await realmCreate(P.io, 'Rich')).data;
  const rich = await realmPut(P.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: 'Rich', goldPieces: 10_000_000 })), { gzip: true });
  assert.deepEqual([rich.ok, rich.error], [false, 'realm-birth']);
  const honest = await realmPut(P.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: 'Rich' })), { gzip: true });
  assert.equal(honest.ok, true);
  assert.equal(isGzip(storedOf(r.env, made.id)), true, 'the packed first save is the one kept');
});

test('REALM-GZIP: a gold act reads a packed record and writes one past the request\'s 4 MiB of text; the tab reads it back (mutants: the record read unopened; the written text held to the request\'s bound)', { timeout: 120_000 }, async () => {
  const r = await realm();
  const P = await r.player();
  const c = await born(P);
  const life = longLife(REALM_MAX_BYTES + MiB);
  await layPacked(r.env, c.id, life);
  const lease = (await realmJoin(P.io, c.id)).data.lease;
  const ctx = { db: r.env.DB, bucket: r.env.SAVES, rand: (b) => crypto.getRandomValues(b), nowS: Math.floor(Date.now() / 1000) };
  const prep = await prepareRealmRecord(ctx, P.g.id, { id: c.id, lease, seq: 1 }, (save) => { save.goldPieces -= 20; return null; });
  assert.equal(prep.error, undefined, 'the packed record opened and changed');
  await r.env.DB.batch(prep.steps);
  const got = await realmFetch(P.io, c.id);
  const save = JSON.parse(got.text);
  assert.deepEqual([got.seq, save.goldPieces, save.items.length], [2, 100, life.items.length], 'paid, and the rest of the save rides untouched');
  assert.ok(enc(got.text).byteLength > REALM_MAX_BYTES);
});

test('REALM-GZIP: a trade settles over two packed records, one of them past the request\'s 4 MiB of text - both move one on, each reads back what it holds (mutants: a record read unopened; the written text held to the request\'s bound)', { timeout: 120_000 }, async () => {
  const r = await realm();
  const A = await r.player(), B = await r.player();
  const d = createWeapon(113, 9, () => 0.5), a = { ...createWeapon(131, 0, () => 0.5), stackCount: 10 };
  A.char = await born(A, 'Arthago');
  B.char = await born(B, 'Brisienna');
  const pad = longLife(REALM_MAX_BYTES + MiB).items.map((i) => ({ ...i, name: `${i.name} kept` }));
  await layPacked(r.env, A.char.id, { name: 'Arthago', items: [d], goldPieces: 50, bookOfDays: pad });
  await layPacked(r.env, B.char.id, { name: 'Brisienna', items: [a], goldPieces: 5 });
  const wireOf = (items, entries) => createTradePack({ items }).wire(entries);
  const giveA = { items: wireOf([d], [{ item: d, count: 1 }]), gold: 20 }, giveB = { items: wireOf([a], [{ item: a, count: 4 }]), gold: 0 };
  const ask = (P, give, get) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: 1, sid: 'gzipsid1', give, get, pick: give.items.map((_, i) => i) });
  assert.deepEqual((await ask(A, giveA, giveB)).data, { state: 'waiting' });
  const b = await ask(B, giveB, giveA);
  assert.deepEqual([b.data?.state, b.data?.seq, b.data?.gold], ['done', 2, 20], `settled (${b.error ?? b.data?.why ?? ''})`);
  const ra = JSON.parse((await realmFetch(A.io, A.char.id)).text), rb = JSON.parse((await realmFetch(B.io, B.char.id)).text);
  assert.deepEqual([ra.goldPieces, ra.items.map((i) => [i.templateIndex, i.stackCount])], [30, [[131, 4]]]);
  assert.deepEqual([rb.goldPieces, rb.items.map((i) => [i.templateIndex, i.stackCount ?? 1])], [25, [[131, 6], [113, 1]]]);
  assert.equal(ra.bookOfDays.length, pad.length, 'the rest of the save rides untouched');
});

test('REALM-GZIP: both ends older than the other - a service whose answers never say gzip is sent the text; a session whose join came from one packs from the next join that says so (mutants: the rejoin never learns it; the read never asks as stored)', { timeout: 120_000 }, async () => {
  const r = await realm();
  const P = await r.player({ older: true });
  const c = await born(P);
  assert.equal(c.gzip, undefined, 'the older service\'s create answer says nothing');
  assert.equal(isGzip(storedOf(r.env, c.id)), false, 'so the first save went as text');
  const boot = await openRealmBoot({ io: P.io, id: c.id });
  assert.deepEqual([boot.ok, boot.gzip], [true, false]);
  const session = createRealmSession({ io: P.io, id: c.id, lease: boot.lease, seq: boot.seq, gzip: boot.gzip });
  assert.deepEqual(await session.checkpoint('{"v":2}'), { ok: true, seq: 2 });
  assert.equal(new TextDecoder().decode(storedOf(r.env, c.id)), '{"v":2}', 'text, as every save rode before');
  // the page put away and shown again: joined anew - and this join's service says it opens a packed save
  const Q = await r.player();
  const d = await born(Q, 'Dwarfblood');
  const dBoot = await openRealmBoot({ io: Q.io, id: d.id });
  const dSession = createRealmSession({ io: Q.io, id: d.id, lease: dBoot.lease, seq: dBoot.seq, gzip: false });
  await dSession.leave({ keepalive: true });
  assert.deepEqual(await dSession.rejoin(), { ok: true, seq: 1 });
  const text = JSON.stringify(longLife(64 * 1024));
  assert.deepEqual(await dSession.checkpoint(text), { ok: true, seq: 2 });
  assert.equal(isGzip(storedOf(r.env, d.id)), true, 'packed from the join that said so');
  assert.equal(isGzip(Q.door.bodies.at(-1)), true, 'and packed on the wire');
  const got = await realmFetch(Q.io, d.id);
  assert.equal(got.text, text);
  assert.match(Q.door.urls.at(-1), /\?enc=gzip$/, 'the read asks for the save as stored');
});

// ═══ THE HOSTS ════════════════════════════════════════════════════════════════════════════════════════════════════════

test('REALM-GZIP by source: every host that sends a realm save hands on the service\'s word - the playing session (the boot\'s join), a character born online (its create) and one brought in (its customs) (mutants: each dropped)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /createRealmSession\(\{ io: realmIoNow\(\), id: params\.get\('realm'\), lease: realmBoot\.lease, seq: realmBoot\.seq, gzip: realmBoot\.gzip, onLost:/);
  assert.match(world, /realmPut\(io, made\.data\.id, \{ lease: made\.data\.lease, seq: 1, summary: realmSummaryOf\(playerEntity\) \}, text, \{ gzip: made\.data\.gzip === true \}\)/);
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /realmPut\(io, made\.data\.id, \{ lease: made\.data\.lease, seq: 1, summary: realmSummaryOf\(copy\) \}, JSON\.stringify\(copy\), \{ gzip: made\.data\.gzip === true \}\)/);
  // and the Worker bundles the law: the deploy fires on it
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/realm\/realmSaveCodec\.js"/);
});
