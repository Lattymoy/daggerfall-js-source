// REALM P1 (2026-09-28, Mac: "A true separation while allowing people to still play offline"; asked where an online
// character's save lives: "Account service"): THE REALM'S CHARACTERS, SERVICE SIDE (server-account/src/realm.js,
// migration 0018 - 0016 on its branch). These pins drive the REAL Worker over the REAL migrations (node:sqlite behind a D1-shaped face and
// R2's three calls, as test/cloudsaves.test.js does): a realm character is minted by the service, joined under a lease
// that takes it from any other tab, checkpointed only under that lease at the next sequence, left, deleted, copied
// back, and brought in once from offline through customs when it has played online before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { ROUTES, realmPathOf, ACCOUNT_VERSION } from '../server-account/src/service.js';
import {
  REALM_CHARACTERS_MAX, REALM_ID_RE, LEASE_RE, REALM_MAX_BYTES, REALM_PLAYING_S, realmObjectKey, realmPrefix, realmSummaryOf, realmNameOf,
} from '../server-account/src/realm.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { freshSave } from './realmSeat.mjs';   // AUDIT REALM2 S1: a first save is a new character's
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
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
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    // D1's batch is one transaction (test/realm4.test.js's face): all of it, or none - AUDIT REALM's delete and customs ride one
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
    async list({ prefix = '' } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },   // R2's prefix listing
  };
}

async function stand() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: 'https://daggerfalljs.dev' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A checkpoint: the save raw, the lease, the sequence and the tile in headers. */
  const put = async (id, bytes, bearer, { lease, seq, summary = null }) => {
    const headers = { authorization: `Bearer ${bearer}`, 'x-realm-lease': lease ?? '', 'x-realm-seq': String(seq) };
    if (summary) headers['x-realm-summary'] = JSON.stringify(summary);
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, { method: 'PUT', headers, body: bytes }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const get = async (id, bearer) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, { method: 'GET', headers: { authorization: `Bearer ${bearer}` } }), env);
    const ct = res.headers.get('content-type') ?? '';
    return {
      status: res.status, seq: res.headers.get('x-realm-seq'), expose: res.headers.get('access-control-expose-headers'),
      json: ct.includes('json') ? await res.json().catch(() => null) : null,
      bytes: ct.includes('json') ? null : new Uint8Array(await res.arrayBuffer()),
    };
  };
  const guest = async () => (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  return { env, call, put, get, guest };
}
const save = (text) => new TextEncoder().encode(text);
/** AUDIT REALM2 S1: a first save the realm takes - a new character's, as chargen makes one - as text. */
const FIRST = JSON.stringify(freshSave({ name: 'Nystul' }));

test('REALM P1: the routes are the service\'s, behind a session and never open - a guest holds realm characters too; acct17 and the toml in step', async () => {
  for (const r of ['/v1/realm', '/v1/realm/create', '/v1/realm/customs', '/v1/realm/join', '/v1/realm/leave', '/v1/realm/delete']) assert.ok(ROUTES.has(r), r);
  assert.deepEqual(realmPathOf('/v1/realm/r0123456789abcdef0123/data'), { id: 'r0123456789abcdef0123' });
  assert.equal(realmPathOf('/v1/realm/c0ffee00-1111/data'), null, 'a client\'s id is no realm id');
  assert.equal(realmPathOf('/v1/realm/r0123456789abcdef0123/shot'), null);
  assert.equal(ACCOUNT_VERSION, 'acct82');   // AUDIT ARENA-LADDER moved it on last (acct82: /v1/arena/attempt and migration 0082, the ladder attempt ticket - acct79 on its branch, renumbered past GLOBAL-MARKET, SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (acct81: DEVELOPER_HANDLES grants the Seraph Wings - DEVELOPER_AURA); SHADOW-CLOAK moved it on (acct80: SHADOW_FANG_HANDLES grants the Holo Shadow Cloak with the title - acct78 on its branch, renumbered past SERPENT1 and GLOBAL-MARKET at the merges); GLOBAL-MARKET moved it on (acct79: buy orders the Bay's - the Orders view reads every board's, and a fill from another region pays its courier out of its pay; no migration); SERPENT1 moved it on (acct78: /v1/serpent/claim and the serpents slain on the cards, migration 0081 - acct75, acct76 then acct77 on its branch, renumbered past HOME-PRICE (acct75), PRIMARCH and FOUNDER4 (acct76) and KNIGHT-HOUSE (acct77) at the merges); FIELD BUGS 2026-10-04d KNIGHT-HOUSE moved it on (acct77: a deed the realm gave, held off the record - /v1/homes/deed and the release of a hold, migration 0079); PRIMARCH and FOUNDER4 moved it on (acct76: PRIMARCH_HANDLES grants the Primarch's title, glyph and aura; migration 0078 links an account to a row it shares a character with, for Founder - acct75 on its branch, which HOME-PRICE took first); HOME-PRICE moved it on (acct75: a home's price held to the online range, the town's sale refund; before it, BAG1 and GUILD2's acct74: the Materials Bag carried count and /v1/stores/deposit, migration 0076; a guild new name and its vault, /v1/guilds/rename and /v1/guilds/vault*, migration 0077); AEGIS moved it on (acct73: AEGIS_HANDLES grants the Aegis of Oblivion's title, glyph and aura); ARENA4, ARENA4b and WD3 moved it on (acct72 - acct66 on the arena branch, renumbered past PROF-541's acct70 and SILVER-WAYS' acct71 at its merges onto main: the arena records and the online homes it displaced - migrations 0074 and 0075 - and the layout a home was bought in - 0073); SILVER-WAYS and PROF2b before it (acct71: a raid's silver under the day's combat cap, guild deeds and guild contracts, the Motherlodes - migrations 0071 and 0072 - acct66 on its branch, renumbered past PROF-541's acct66-acct70 at the merge); AUDIT PROF-541 before it (acct70: the Alchemy audit's fixes, the hall door set by rank alone - hallEntry; a jewel's first craft its piece and base's; no migration); PROF12 before it (acct69: Alchemy's brew, the Apothecaries' counter, a Transmuter's transmutations, Disenchanting, the Apothecary opened; migration 0070); PROF10 before it (acct68: the jeweller's bench's pieces and the jeweller's hand, a Lapidary's cracked gem; no migration); PROF9 before it (acct67: the fire's dishes and a dish's cook's hand, migration 0069; acct67 past another branch's acct66); GUILD-YARD before it (acct65: a guild hall's outside and yard, its keepers'; no migration); AUDIT 529 before it (acct64: SIEGE-VOID's route and migration 0067, STANDING-TREND's standing rows, the void's audit); GLYPH-WEAR before it (acct63: a player shows or hides each glyph, migration 0068); WB12d moved it on (acct62: a receipt's rite and the rite's own receipt, the rows' embers - migration 0066 - main's part four and the Seats arc took acct46-acct61 first); before it SEAT2b part two moved it on (acct61: the works at peace); AUDIT-SEATS, PROF11 and SEAT2b before it (acct60: the audit, Masonry and the works - the Seats arc's fourteen renumbered past main's PATREON-LINK and part four (acct45, acct46) at the merge); SEASON1 part three before it (acct59: the Hall of Records); SEASON1 part two, the banner ribbon before it (acct58: the banner ribbon); SEASON1 part two, the client's before it (acct57: the Orc Raids and the stormy sea); SEASON1 part two, the economy before it (acct56: the economy's Tides); SEASON1 part two before it (acct55: the Tides); SEASON1 part one before it (acct54: the Seasons); CROWN2 before it (acct53: fealty and Pacts); CROWN1 part two before it (acct52: the Royal Tourney); CROWN1 before it (acct51: the crown Edicts); SEAT2a part three before it (acct50: the siege's pass and result); SEAT2a before it (acct49: the battles' week - the holder's window, the schedule, the sides and their Sellswords; migration 0052); SEAT1d before it (acct48: holding a seat - the upkeep, the Tithe, the Edicts; migration 0051); GUILD1d, GUILD1e and SEAT1a before it (acct47: the guild hall, its heraldry, the guild's own board and the seats' registry - migrations 0046, 0047 and 0048; acct42, then acct43, then acct44, then acct45, on their branch, renumbered past main's REALM-GZIP, SCALE1, MARKET-ANY and PATREON-LINK at the merges); FIELD BUGS 2026-10-01 part four before it (acct46: ANY-HOUR and HERB-XP - no hour refused, a herb at the rank's tier; acct45 on its branch, past PATREON-LINK at the merge); PATREON-LINK before it (acct45: a patron's own Patreon linked, its tier's title held by the pledge - migration 0045); MARKET-ANY before it (acct44: FIELD BUGS 2026-10-01 - a piece from the pack listed for gold, migration 0044); SCALE1 before it (acct43: the scaling audit's service half - metrics, indexes, fewer writes); REALM-GZIP before it (acct42: a realm save rides gzipped); PROF8 before it (acct41: Fishing with the net - migration 0042); GOLD-MARKET before it (acct40: the market in gold or Drakes - migration 0041); PINE-SHARE before it (acct39: Pine in every forest); WB9g before it (acct38: the Broker's insignia - a title and an aura bought, recorded on the row (0040) and paid for by the account's closed gates; the aura worn and signed (`au`)); HOUSING before it (acct37: HOME-RENT's rooms, HOME-LOOK's outside, HOME-YARD's yards - migrations 0037-0039); the PROF7 merge before it (acct36: past main's FIELD BUGS 2026-09-30, acct33, and the branch's acct33-acct35 never deployed); AUDIT 32 S1 before it (acct35: the Weavers' cloth alone lays on no first-craft XP); AUDIT 32 before it (acct34); PROF7 before it (acct33: Hunting, the Skinning Knife and Outfitting); PROF-DELETE before it (acct32: a deleted character's professions go with it); before it RENOWN-CHAR moved it on (acct31: Renown a character's again, migration 0035); before it MERGE 2 moved it on (acct30: the professions branch - Marks, the Notice Board, the professions, the market and its auctions, the guild writs - acct22 to acct29 on its branch, never deployed, its migrations 0025-0034 behind main's 0018-0024); before it HOUSE-LOSS and RESTORE moved it on (acct23 - acct20, then acct21 and acct22, on their branch, which TERMS1, PENITENT and REALM-DOOR took first); before it REALM-DOOR and CUSTOMS-PASS moved it on (acct22: the mint signs whether the named character is the realm's, and a developer's customs pass); before it PENITENT's title and glyph and a fifth Disciple (acct21); before it TERMS1 moved it on (acct20); REALM's acct19 - acct17 on its branch - main's RAID4 and AUDIT RAID took acct17 and acct18 first
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct82"/);
  const { call, guest } = await stand();
  assert.equal((await call('GET', '/v1/realm')).status, 401, 'no secret, no characters');
  const g = await guest();
  const listed = await call('GET', '/v1/realm', undefined, g.secret);
  assert.deepEqual([listed.status, listed.body], [200, { characters: [], max: REALM_CHARACTERS_MAX }]);
  assert.equal((await call('GET', '/v1/realm/create', undefined, g.secret)).status, 405);
});

test('REALM P1: a new character is the service\'s - its id and lease minted there, at sequence 0 with no save; six an account, the seventh refused and nothing deleted', async () => {
  const { call, guest } = await stand();
  const g = await guest();
  const made = await call('POST', '/v1/realm/create', { name: '  Nystul  ', summary: { level: 1, className: 'Spellsword', race: 'Breton', gender: 'male', face: 3, secret: 'x' } }, g.secret);
  assert.equal(made.status, 200);
  assert.match(made.body.id, REALM_ID_RE);
  assert.match(made.body.lease, LEASE_RE);
  assert.equal(made.body.seq, 0);
  const [row] = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.equal(row.id, made.body.id);
  assert.equal(row.name, 'Nystul', 'trimmed');
  assert.deepEqual(row.summary, { level: 1, className: 'Spellsword', race: 'Breton', gender: 'male', face: 3, region: null }, 'the tile\'s fields and nothing else');
  assert.deepEqual([row.seq, row.bytes, row.playing, row.customs], [0, 0, true, false]);
  assert.equal('lease' in row, false, 'the lease is never listed');
  assert.equal((await call('POST', '/v1/realm/create', { name: '' }, g.secret)).status, 400);
  assert.equal((await call('POST', '/v1/realm/create', { name: 'Bad\u0007' }, g.secret)).status, 400);
  for (let i = 1; i < REALM_CHARACTERS_MAX; i++) assert.equal((await call('POST', '/v1/realm/create', { name: `Alt ${i}` }, g.secret)).status, 200);
  const over = await call('POST', '/v1/realm/create', { name: 'One Too Many' }, g.secret);
  assert.deepEqual([over.status, over.body], [409, { error: 'too-many-characters' }]);
  assert.equal((await call('GET', '/v1/realm', undefined, g.secret)).body.characters.length, REALM_CHARACTERS_MAX);
});

test('REALM P1: a checkpoint lands only under the current lease at the next sequence; each is a new object and the one before survives (REALM P2.1); the tile rides along', async () => {
  const { env, call, put, get, guest } = await stand();
  const g = await guest();
  const { id, lease } = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  assert.deepEqual((await get(id, g.secret)).json, { error: 'no-data' }, 'no save before the first checkpoint');
  const one = await put(id, save(FIRST), g.secret, { lease, seq: 1, summary: { level: 2, className: 'Spellsword' } });
  assert.deepEqual([one.status, one.body], [200, { ok: true, seq: 1 }]);
  const read = await get(id, g.secret);
  assert.deepEqual([read.status, read.seq, new TextDecoder().decode(read.bytes)], [200, '1', FIRST]);
  assert.equal(read.expose, 'x-realm-seq', 'the browser may read the sequence');
  assert.deepEqual((await put(id, save('again'), g.secret, { lease, seq: 1 })).body, { error: 'seq', seq: 1 }, 'a replay - told the service\'s own');
  assert.deepEqual((await put(id, save('ahead'), g.secret, { lease, seq: 3 })).body, { error: 'seq', seq: 1 }, 'a skip');
  assert.equal((await put(id, save('ahead'), g.secret, { lease, seq: 3 })).status, 409);
  const realPut = env.SAVES.put.bind(env.SAVES);
  let puts = 0;
  env.SAVES.put = (k, b) => { puts++; return realPut(k, b); };
  assert.deepEqual((await put(id, save('forged'), g.secret, { lease: 'f'.repeat(32), seq: 2 })).body, { error: 'lease' });
  assert.equal(puts, 0, 'the stale lease is refused before a byte lands - not written and dropped');
  env.SAVES.put = realPut;
  assert.equal((await put(id, save('shapeless'), g.secret, { lease: 'nope', seq: 2 })).status, 400);
  assert.equal((await put(id, new Uint8Array(0), g.secret, { lease, seq: 2 })).status, 400, 'an empty save');
  assert.equal((await put(id, new Uint8Array(REALM_MAX_BYTES + 1), g.secret, { lease, seq: 2 })).status, 413);
  const first = [...env.SAVES._map.keys()];
  assert.equal(first.length, 1, 'a refused checkpoint writes nothing - the stale lease is refused before a byte lands');
  assert.match(first[0], new RegExp(`^realm/${encodeURIComponent(g.id)}/${id}/1-[0-9a-f]{8}$`), 'the player first, then the character, then the sequence and a tag of its own');
  assert.equal(realmObjectKey(g.id, id, 1, 'abcd0123'), `${realmPrefix(g.id)}${id}/1-abcd0123`);
  assert.equal((await put(id, save('save two'), g.secret, { lease, seq: 2 })).status, 200);
  const keys = [...env.SAVES._map.keys()].sort();
  assert.equal(keys.length, 2, 'the save and the one before it');
  assert.ok(keys.every((k) => k.startsWith(realmPrefix(g.id))), 'under the account\'s prefix');
  assert.equal(new TextDecoder().decode(env.SAVES._map.get(first[0])), FIRST, 'the one before survives');
  assert.equal((await put(id, save('save three'), g.secret, { lease, seq: 3 })).status, 200);
  assert.equal(env.SAVES._map.size, 2, 'two back goes');
  assert.ok(!env.SAVES._map.has(first[0]), 'the first save is gone');
  assert.deepEqual([...env.SAVES._map.values()].map((v) => new TextDecoder().decode(v)).sort(), ['save three', 'save two']);
  const [row] = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.deepEqual([row.seq, row.bytes, row.summary.level], [3, 10, 2], 'a checkpoint without a tile keeps the last one');
});

test('REALM P1: a join takes the character from any other tab, and one account plays one character - the tab that lost the lease can never write again', async () => {
  const { call, put, guest } = await stand();
  const g = await guest();
  const a = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  assert.equal((await put(a.id, save(FIRST), g.secret, { lease: a.lease, seq: 1 })).status, 200);
  const second = await call('POST', '/v1/realm/join', { id: a.id }, g.secret);
  assert.deepEqual([second.status, second.body.seq, second.body.bytes], [200, 1, FIRST.length]);
  assert.notEqual(second.body.lease, a.lease, 'a new lease');
  const out = await put(a.id, save('old tab'), g.secret, { lease: a.lease, seq: 2 });
  assert.deepEqual([out.status, out.body], [409, { error: 'lease' }], 'the old tab is out');
  assert.equal((await put(a.id, save('new tab'), g.secret, { lease: second.body.lease, seq: 2 })).status, 200);
  // a second character of the same account frees the first
  const b = (await call('POST', '/v1/realm/create', { name: 'Alt' }, g.secret)).body;
  assert.deepEqual((await put(a.id, save('a3'), g.secret, { lease: second.body.lease, seq: 3 })).body, { error: 'lease' }, 'one character in play an account');
  const rows = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.deepEqual(rows.map((r) => [r.name, r.playing]).sort(), [['Alt', true], ['Nystul', false]]);
  // and a join frees the account's other character as a creation does
  const back = await call('POST', '/v1/realm/join', { id: a.id }, g.secret);
  assert.equal((await put(b.id, save('b1'), g.secret, { lease: b.lease, seq: 1 })).status, 409, 'the alt is out');
  assert.equal((await put(a.id, save('a3'), g.secret, { lease: back.body.lease, seq: 3 })).status, 200);
  assert.equal((await call('POST', '/v1/realm/join', { id: 'r' + '0'.repeat(20) }, g.secret)).status, 404);
  assert.equal((await call('POST', '/v1/realm/join', { id: 'c0ffee00' }, g.secret)).status, 400);
  assert.ok(b.id);
});

test('REALM P1: a leave gives the lease up - only the tab that holds it; another account can neither read, join, write nor delete my character', async () => {
  const { call, put, get, guest } = await stand();
  const g = await guest();
  const other = await guest();
  const a = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  assert.equal((await put(a.id, save(FIRST), g.secret, { lease: a.lease, seq: 1 })).status, 200);
  assert.deepEqual((await call('POST', '/v1/realm/leave', { id: a.id, lease: 'e'.repeat(32) }, g.secret)).body, { ok: true, released: false });
  assert.deepEqual((await call('POST', '/v1/realm/leave', { id: a.id, lease: a.lease }, g.secret)).body, { ok: true, released: true });
  assert.deepEqual((await put(a.id, save('after'), g.secret, { lease: a.lease, seq: 2 })).body, { error: 'lease' }, 'a left character takes no checkpoint');
  assert.equal((await get(a.id, other.secret)).status, 404);
  assert.equal((await call('POST', '/v1/realm/join', { id: a.id }, other.secret)).status, 404);
  assert.equal((await put(a.id, save('theirs'), other.secret, { lease: a.lease, seq: 2 })).status, 404);
  assert.equal((await call('POST', '/v1/realm/delete', { id: a.id }, other.secret)).status, 404);
  assert.equal(new TextDecoder().decode((await get(a.id, g.secret)).bytes), FIRST, 'untouched');
});

test('REALM P1: the player\'s own delete takes its objects and the row', async () => {
  const { env, call, put, guest } = await stand();
  const g = await guest();
  const a = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  await put(a.id, save(FIRST), g.secret, { lease: a.lease, seq: 1 });
  await put(a.id, save('2'), g.secret, { lease: a.lease, seq: 2 });
  assert.equal(env.SAVES._map.size, 2);
  env.SAVES._map.set(`${realmPrefix(g.id)}${a.id}/9-deadbeef`, new Uint8Array(1));   // REALM P2.1: a lost write's object whose drop failed
  assert.deepEqual((await call('POST', '/v1/realm/delete', { id: a.id }, g.secret)).body, { ok: true });
  assert.equal(env.SAVES._map.size, 0, 'the two the row names, and the walk of its prefix');
  assert.deepEqual((await call('GET', '/v1/realm', undefined, g.secret)).body.characters, []);
});

test('REALM P1: customs brings an offline character in ONCE, and only one that played online before the realm (its Renown track in the census the realm took at its start - AUDIT REALM L1-F5); a realm id is no origin', async () => {
  const { env, call, put, guest } = await stand();
  const g = await guest();
  const origin = 'c0ffee00-1111-2222-3333-444455556666';
  const never = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, g.secret);
  assert.deepEqual([never.status, never.body], [403, { error: 'customs-never-online' }]);
  env.DB._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(g.id, origin, 'Nystul', 500, 1, 1);
  const late = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, g.secret);
  assert.deepEqual([late.status, late.body], [403, { error: 'customs-never-online' }], 'a track written after the realm began is no proof (AUDIT REALM L1-F5)');
  // as migration 0020 counted it at the realm's start - here, and on a second account a copy of it played online from
  const copied = await guest();
  for (const who of [g, copied]) env.DB._raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(who.id, origin);
  env.DB._raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (1, 2, ?, ?, 'Nystul', 17, 'private', 1000, 1)").run(g.id, origin);
  env.DB._raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Order', 'the order', 'ORD', '[]', 0, 1)").run();
  env.DB._raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, 'g1', 5, 'Nystul', 1)").run(g.id, origin);
  const came = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul', summary: { level: 12 } }, g.secret);
  assert.equal(came.status, 200);
  assert.match(came.body.id, REALM_ID_RE);
  assert.notEqual(came.body.id, origin, 'the service mints its own id');
  // its Renown track comes in with it, under the realm's id now - CUSTOMS-CARRY (Mac 2026-09-29, "Carry them"): and its
  // home and its guild place, what stood before the realm (AUDIT REALM2 S2 had left them with the offline id)
  assert.deepEqual(env.DB._raw.prepare('SELECT char_id, xp FROM renown_tracks WHERE player = ?').all(g.id).map((r) => ({ ...r })), [{ char_id: came.body.id, xp: 500 }]);
  assert.deepEqual(env.DB._raw.prepare('SELECT char_id FROM homes WHERE player = ?').all(g.id).map((r) => r.char_id), [came.body.id]);
  assert.deepEqual(env.DB._raw.prepare('SELECT char_id, rank FROM guild_members WHERE player = ?').all(g.id).map((r) => ({ ...r })), [{ char_id: came.body.id, rank: 5 }], 'and its guild place');
  // AUDIT REALM L3-F3: a customs whose first save never landed is taken up again - the same row, a new lease - and once
  // its first save lands, the character is in and customs is spent
  const again = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, g.secret);
  assert.deepEqual([again.status, again.body.id, again.body.resumed, again.body.seq], [200, came.body.id, true, 0], 'resumed, never a second character');
  assert.notEqual(again.body.lease, came.body.lease, 'under a new lease');
  const first = await put(came.body.id, '{"v":1}', g.secret, { lease: again.body.lease, seq: 1 });
  assert.equal(first.status, 200, 'its first save lands');
  const spent = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, g.secret);
  assert.deepEqual([spent.status, spent.body], [409, { error: 'customs-already' }]);
  assert.equal((await call('POST', '/v1/realm/customs', { origin: came.body.id, name: 'X' }, g.secret)).status, 400, 'a realm id is no offline character');
  const [row] = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.equal(row.customs, true);
  // another account's track is not mine - and a character in once is in once, on every account (AUDIT REALM L3-F2): a
  // copy of it counted on a second account before the realm finds it already in; a deleted realm character never lets
  // its origin in again
  const other = await guest();
  // CUSTOMS-ELSEWHERE (FIELD BUGS 2026-09-30, PIN MOVED): a character the census counted on other accounts and already
  // brought in is `customs-already` here too - customs no longer answers "no record" of one the realm counted
  assert.deepEqual((await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, other.secret)).body, { error: 'customs-already' });
  assert.deepEqual((await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, copied.secret)).body, { error: 'customs-already' });
  assert.equal((await call('POST', '/v1/realm/delete', { id: came.body.id }, g.secret)).status, 200);
  for (const who of [g, copied]) {
    assert.deepEqual((await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, who.secret)).body, { error: 'customs-already' }, 'spent on every account');
  }
});

test('AUDIT REALM L3-F2: customs holds the account\'s bound in its one write - a seventh character is refused and spends no census', async () => {
  const { env, call, guest } = await stand();
  const g = await guest();
  for (let i = 0; i < REALM_CHARACTERS_MAX; i++) assert.equal((await call('POST', '/v1/realm/create', { name: `N${i}` }, g.secret)).status, 200);
  const origin = 'c0ffee00-1111-2222-3333-444455556666';
  env.DB._raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(g.id, origin);
  assert.deepEqual((await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, g.secret)).body, { error: 'too-many-characters' });
  assert.equal(env.DB._raw.prepare('SELECT spent FROM realm_census WHERE char_id = ?').get(origin).spent, 0, 'still to come in');
});

test('REALM P1: the shapes - a summary projected and bounded, a name trimmed and printable, the CORS door open to the realm headers', async () => {
  assert.equal(realmSummaryOf(null), null);
  assert.equal(realmSummaryOf([1]), null);
  assert.deepEqual(JSON.parse(realmSummaryOf({ level: -1, className: 7, race: 'Nord', face: 1.5 })), { level: null, className: null, race: 'Nord', gender: null, face: null, region: null });
  assert.equal(realmNameOf('x'.repeat(50)).length, 32);
  assert.equal(realmNameOf('   '), null);
  assert.equal(REALM_PLAYING_S, 300, 'a tile says "playing" for five minutes past the last checkpoint (they come every two)');
  const { env } = await stand();
  const res = await worker.fetch(new Request('https://accounts.invalid/v1/realm', { method: 'OPTIONS' }), env);
  assert.match(res.headers.get('access-control-allow-headers'), /x-realm-lease, x-realm-seq, x-realm-summary/);
  assert.match(src('server-account/migrations/0018_realm_characters.sql'), /CREATE UNIQUE INDEX IF NOT EXISTS realm_characters_origin ON realm_characters \(player, origin_id\) WHERE origin_id IS NOT NULL;/);
});
