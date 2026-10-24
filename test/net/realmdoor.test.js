// REALM-DOOR (2026-09-29, the field - bible/01-Overview/bugs/Field-Bugs-2026-09-29b.md). Gryphoth, on the Discord, to Mac:
// "I was playing online on a new character, went to trade with someone and it said my client was outdated. So I logged
// out, updated and when I logged back in my character was no longer online, and when I go to bring him online it says
// he has no renown or guilds and cant be brought online."
//
// THE ROOT CAUSE. The realm (REALM P1, on main at f4dc60ce, 2026-09-28 23:38:54 UTC) was the NEW BUILD's law alone: its
// boot refuses to take a local slot online (world.js `realmRefused`) and its Online door lists realm characters only.
// Neither server ever asked. The account service minted an identity token for whatever character a client named, and
// the relay admitted any token it could verify - it did not change at all (world124 before and after). So a build from
// before the realm - a tab left open, or the desktop app's portable exe and macOS copies, which never update themselves -
// went on playing online exactly as before, a character made after the census froze included, and nothing told its
// player until a realm-era peer refused a trade ("They are playing an older version."). Everything that character did
// online lives in a local slot the realm cannot admit: the census is frozen at the realm's start (AUDIT REALM L1-F5),
// so customs answers `customs-never-online`, as the census law says it must.
//
// THE FIX. The door asks the realm. The service signs whether the character a mint names is one of the account's realm
// characters (`rc`: 1, else 0 - net/identityToken.js), and the relay refuses a hello whose token says 0 with
// REALM_DOOR_WORD (net/wire.js), which a build from before the realm prints on its HUD and under its chat as it is, and
// stops retrying on. A token with no `rc` is a service from before this slice - the two Workers deploy on their own - and
// is admitted as it was. A realm-era tab names the realm character it joined, and one the door refuses anyway (its
// character deleted, its account changed under it) goes to the Online door with the realm's word.
//
// The real account Worker over the real migrations (node:sqlite behind a D1-shaped face, as test/server/fb0929_customs.test.js
// drives it) and the real relay Room (test/fakeRoom.mjs), under ONE key pair: the tokens the relay reads are the ones the
// service minted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { r2, freshSave } from '../realmSeat.mjs';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { REALM_DOOR_WORD, CLOSE_POLICY, SOCIAL_ROOM } from '../../src/net/wire.js';
import { claimsValid, mintToken, _b64url } from '../../src/net/identityToken.js';
import { OnlineSession } from '../../src/net/online.js';
import { realmDoorShut } from '../../src/systems/realmSaves.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** A build from before the realm names its character by CHARID1's id - crypto.randomUUID. */
const OFFLINE_ID = 'c3f0e7a2-5b1d-4e8f-9a6c-2d4b8e1f7a90';
/** The places a player's sockets stand: a place room and the hub (the World channel every online tab holds). */
const ROOMS = ['world:3,12', SOCIAL_ROOM];

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

/** The service, standing, with the public half of its key as the relay holds it. */
async function stand() {
  _resetKeyForTests();
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const publicKey = _b64url.encode(new Uint8Array(await webcrypto.subtle.exportKey('raw', kp.publicKey)));
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
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
  /** A guest - a guest plays online, and its characters are its account's. */
  const account = async () => (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  /** A realm character born online, its first save landed. */
  const born = async (who, name = 'Born') => {
    const made = await call('/v1/realm/create', { name, summary: { level: 1 } }, who.secret);
    assert.equal(made.status, 200, 'a realm character is made');
    assert.equal((await put(made.body.id, JSON.stringify(freshSave({ name })), who.secret, { lease: made.body.lease, seq: 1 })).status, 200);
    return made.body.id;
  };
  /** The claims the service signed, read off the token as the relay reads them (after its signature, which the relay checks). */
  const mint = async (who, body) => {
    const r = await call('/v1/auth/token', body, who.secret);
    assert.equal(r.status, 200, `the mint answers: ${JSON.stringify(r.body)}`);
    return { token: r.body.token, claims: JSON.parse(new TextDecoder().decode(_b64url.decode(r.body.token.split('.')[1]))) };
  };
  return { env, call, put, account, born, mint, publicKey };
}

/** A relay room holding the service's public key - the deploy's own check keeps the two halves one pair. */
const roomOf = (s, key) => { const r = fakeRoom(key); r.env.IDENTITY_PUBLIC_KEY = s.publicKey; return r; };

test('REALM-DOOR, the field reproduced: a build from before the realm names its offline character at the mint, and the relay no longer takes it online - refused in every room with words that build prints, nothing written; the character itself customs still refuses (the census stands, L1-F5)', async () => {
  const s = await stand();
  const gryphoth = await s.account();
  // the old build's mint: RENOWN1 onward names the character it brings online, and asks for the guild (GUILD1c)
  const { token, claims } = await s.mint(gryphoth, { character: OFFLINE_ID, guild: true });
  assert.equal(claims.rc, 0, 'the service says the character it was named is none of the realm\'s');
  for (const key of ROOMS) {
    const r = roomOf(s, key);
    const ws = r.connect();
    await r.hello(ws, 'pgryphoth001', null, { tok: token });
    assert.deepEqual(ws.sent, [{ t: 'error', m: REALM_DOOR_WORD }], `${key}: refused, and said why - the old build shows exactly this`);
    assert.deepEqual(ws.closed, { code: CLOSE_POLICY, reason: REALM_DOOR_WORD }, `${key}: closed as a refusal, which that build does not retry`);
    assert.equal(r.store.has('secret:pgryphoth001'), false, `${key}: and nothing written - no secret held for the id`);
    assert.equal(r.store.has('look:pgryphoth001'), false, `${key}: nor a look`);
  }
  // after the update: the character is an offline one, and the realm never saw it before it began - customs' own answer
  const came = await s.call('/v1/realm/customs', { origin: OFFLINE_ID, name: 'Gryphoth', summary: { level: 3 } }, gryphoth.secret);
  assert.deepEqual([came.status, came.body], [403, { error: 'customs-never-online' }], 'the census is frozen at the realm\'s start - its law, unchanged');
});

test('REALM-DOOR, the service: a mint signs `rc` 1 only for a realm character of the caller\'s own account - an offline id, a realm id of another account\'s, one nobody holds, one deleted, and no character at all are 0 (mutants: rc for any realm-shaped id; rc for another account\'s character; rc left off a mint)', async () => {
  const s = await stand();
  const A = await s.account(), B = await s.account();
  const mine = await s.born(A, 'Mine');
  const theirs = await s.born(B, 'Theirs');
  assert.equal((await s.mint(A, { character: mine, guild: true })).claims.rc, 1, 'my realm character: the door opens');
  assert.equal((await s.mint(A, { character: theirs, guild: true })).claims.rc, 0, 'another account\'s realm character is not mine to bring online');
  assert.equal((await s.mint(A, { character: OFFLINE_ID, guild: true })).claims.rc, 0, 'an offline character (a build from before the realm)');
  assert.equal((await s.mint(A, { character: `r${'0'.repeat(20)}`, guild: true })).claims.rc, 0, 'a realm-shaped id nobody holds');
  assert.equal((await s.mint(A, {})).claims.rc, 0, 'a mint naming no character (a build from before RENOWN1)');
  assert.equal((await s.call('/v1/realm/delete', { id: mine }, A.secret)).status, 200, 'the character is deleted');
  assert.equal((await s.mint(A, { character: mine, guild: true })).claims.rc, 0, 'a realm character deleted is no longer the realm\'s');
});

test('REALM-DOOR, the relay: a token saying the character is the realm\'s is welcomed, one from a service before this slice (no `rc`) is welcomed as it always was, and one saying it is not is refused before anything is written (mutants: the check dropped; a missing rc refused - the deploy\'s order is not fixed; the refusal after the id\'s secret is written)', async () => {
  for (const key of ROOMS) {
    const r = fakeRoom(key);
    const realm = r.connect(), older = r.connect(), stale = r.connect();
    await r.hello(realm, 'prealm00001', null, { rc: 1 });
    assert.equal(realm.sent[0]?.t, 'welcome', `${key}: a realm character's tab is in`);
    await r.hello(older, 'polder00001');   // the harness mints no `rc`: a token from a service before REALM-DOOR
    assert.equal(older.sent[0]?.t, 'welcome', `${key}: a token from a service before this slice is in, as it was`);
    await r.hello(stale, 'pstale00001', null, { rc: 0 });
    assert.equal(stale.sent.at(-1)?.m, REALM_DOOR_WORD, `${key}: a character the service found none of the realm's is refused`);
    assert.equal(stale.closed?.code, CLOSE_POLICY, `${key}: with the refusal's close`);
    assert.equal(r.store.has('secret:pstale00001'), false, `${key}: and the refused hello wrote no secret for its id`);
    assert.equal(realm.sent.some((f) => f.t === 'join' && f.id === 'pstale00001'), false, `${key}: nobody in the room heard it join`);
  }
});

test('REALM-DOOR, the token law: `rc` is 0 or 1 or absent - a minter writes it only when told, a verifier refuses any other value, and a token without it mints the bytes it always did (mutants: a truthy rc accepted; rc dropped by the minter)', async () => {
  const base = { s: 'acct-abcdef123456', n: 'Nystul', k: 'linked', i: 1_790_000_000, e: 1_790_000_300 };
  assert.equal(claimsValid(base), true, 'absent: a service from before this slice');
  for (const rc of [0, 1]) assert.equal(claimsValid({ ...base, rc }), true, `rc ${rc}`);
  for (const rc of ['1', true, 2, -1, null, 0.5, '']) assert.equal(claimsValid({ ...base, rc }), false, `rc ${JSON.stringify(rc)} is no claim the service makes`);
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const who = { s: base.s, n: base.n, k: base.k };
  const claimsOf = (t) => JSON.parse(new TextDecoder().decode(_b64url.decode(t.split('.')[1])));
  assert.equal(claimsOf(await mintToken({ ...who, rc: 0 }, kp.privateKey, { subtle: webcrypto.subtle, nowS: base.i })).rc, 0, 'a 0 is said, never dropped as falsy');
  assert.equal(claimsOf(await mintToken({ ...who, rc: 1 }, kp.privateKey, { subtle: webcrypto.subtle, nowS: base.i })).rc, 1);
  assert.equal('rc' in claimsOf(await mintToken(who, kp.privateKey, { subtle: webcrypto.subtle, nowS: base.i })), false, 'not told, not written');
  await assert.rejects(mintToken({ ...who, rc: 'yes' }, kp.privateKey, { subtle: webcrypto.subtle, nowS: base.i }), /refused a claim set/, 'the minter refuses a claim the verifier would');
});

test('REALM-DOOR, the words: the refusal fits a WebSocket close reason and asks for the update, and a session refused with it says it on the HUD as it is and stops asking - the path a build from before the realm reads it by (mutants: the words past 123 bytes, which the runtime refuses to close with)', async () => {
  assert.ok(new TextEncoder().encode(REALM_DOOR_WORD).length <= 123, 'a close reason is at most 123 bytes of UTF-8 - past it close() throws and the socket stays open');
  assert.match(REALM_DOOR_WORD, /out of date/, 'it says what is wrong');
  assert.match(REALM_DOOR_WORD, /[Uu]pdate/, 'and what to do');
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() {}
  }
  const session = new OnlineSession({ url: 'wss://relay.test', name: 'Gryphoth', id: 'pgryphoth001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => 1_700_000_000_000, mintToken: async () => 'v1.aaaa.bbbb' });
  session.join('world:3,12');
  const ws = sockets[0];
  ws.onopen?.();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  ws.onmessage?.({ data: JSON.stringify({ t: 'error', m: REALM_DOOR_WORD }) });
  ws.onclose?.({ code: CLOSE_POLICY, reason: REALM_DOOR_WORD });
  assert.equal(session.terminal, true, 'a refusal is not retried');
  assert.equal(session.statusLine(), `online: ${REALM_DOOR_WORD}`, 'the HUD line is the relay\'s own words');
  assert.equal(realmDoorShut(session), true, 'and a realm-era tab knows the words for what they are');
  assert.equal(realmDoorShut({ terminal: true, error: 'sign in to play online' }), false, 'another refusal is not the realm\'s');
  assert.equal(realmDoorShut({ terminal: false, error: REALM_DOOR_WORD }), false, 'an error frame alone, the socket not yet closed for good');
  assert.equal(realmDoorShut(null), false, 'no session');
});

test('REALM-DOOR, the realm-era tab: its minter names the realm character it joined, and a door shut on it takes the player to the Online door with the realm\'s word before anything else the frame does (mutants: the minter back on the save\'s own id; the frame\'s check dropped)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /accountTokenMinter\(\{[^}]*character: \(\) => \(onlineOn \? realmSession\?\.id \?\? null : null\)/, 'the character this tab brings online is the one the realm joined - never an id the save or characterIdOf mints');
  const frame = world.slice(world.indexOf('  const onlineFrame = (now, dt) => {'));
  const shut = frame.indexOf("if (realmSession && !realmSession.lost && realmDoorShut(online)) { realmLost('no-realm-character'); return; }");
  assert.ok(shut > 0, 'the online frame asks whether the relay shut the realm\'s door on this tab');
  assert.ok(shut < frame.indexOf('if (seatOut()) {'), 'first - before the seat\'s own law draws its notice over it');
});
