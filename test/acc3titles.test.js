// ACC3 — PLAYER TITLES AND NAME GLYPHS (2026-09-22).
//
// Mac: "Player titles appear above a player name. We will develop 2
// titles to start out. 1st title is Founder with a gold color, 2nd
// title is Developer with a red color. All current players should be
// granted the founder title." And beside the name: "Sprouting green
// plant. Attached to new accounts for 2 weeks. Developer glyph
// specifically for developers."
//
// ═══ WHAT THESE PINS ARE FOR ═══════════════════════════════════════
//
// THE GRANTS ARE DERIVED AND NOT A COLUMN, and that is the claim worth
// pinning, because it is the one a later slice will be tempted to
// undo. A `grants` table would pass a test that only asked "does a
// founder get the founder title?" - so these pins drive the things a
// stored grant CANNOT do: a sprout that expires because time passed
// with nothing running, a developer who stops being one the moment the
// config drops them, a founder granted to a row inserted long after the
// migration ran.
//
// AND THE BADGE IS SIGNED, NEVER ASSERTED. ACC1g shut this hole on the
// name one slice ago; a title is the stronger claim of the two, so the
// relay half is driven through a REAL Room with a REAL Ed25519 key:
// a hello that types a title gets nothing, and a hello that carries a
// signed one is badged on the welcome, the join, the channel roster
// and the `who` answer alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { register } from '../server-account/src/accounts.js';
import {
  FOUNDER_UNTIL, SPROUT_S, developerHandles, isDeveloper,
  titlesHeld, glyphsOf, titleWorn, equipRefusal, wardrobeOf,
} from '../server-account/src/titles.js';
import {
  TITLES, GLYPHS, GLYPHS_MAX, mintToken, verifyToken, importPublicKeyB64, claimsValid,
} from '../src/net/identityToken.js';
import { badged, rosterFor } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);

// A moment AFTER the founder cutoff, so "registered before it" and
// "registered after it" are both reachable from one clock.
const NOW = FOUNDER_UNTIL + 90 * 24 * 60 * 60;

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url))
  .filter((f) => f.endsWith('.sql')).sort();

/** The same D1-shaped face the other account pins use: D1's whole
 *  surface and nothing more, over the REAL migrations - 0004 included,
 *  because the walk picks up every file in the folder. */
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
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}

// ── THE GRANTS, derived ─────────────────────────────────────────────

test('ACC3: the founder title is a CUTOFF, so a row inserted long after any migration ran still answers correctly (mutant: a `granted` column, written once by a walk over the table)', () => {
  // Mac asked that "all current players should be granted the founder
  // title". The obvious migration walks every row and writes one - and
  // a walk is a fact recorded at a moment nobody can re-derive. THIS is
  // the difference, and it is the whole design: a row that did not
  // exist when anybody ran anything is still judged correctly.
  const early = { registered_at: FOUNDER_UNTIL - 1, created_at: 1 };
  const onTheDot = { registered_at: FOUNDER_UNTIL, created_at: 1 };
  const late = { registered_at: FOUNDER_UNTIL + 1, created_at: 1 };
  assert.deepEqual(titlesHeld(early, {}), ['founder']);
  assert.deepEqual(titlesHeld(onTheDot, {}), ['founder'], 'the cutoff is inclusive - the day Mac asked counts');
  assert.deepEqual(titlesHeld(late, {}), []);

  // AND A GUEST HOLDS NOTHING, which is Mac's own call when asked
  // whether guests count ("Registered accounts only"). A guest row has
  // no `registered_at` at all, so there is nothing to compare - and
  // that is the right refusal rather than a coincidence: a founding
  // title on a row one storage clear from gone was never anybody's.
  assert.deepEqual(titlesHeld({ created_at: 1, registered_at: null }, {}), []);
  assert.deepEqual(titlesHeld({ created_at: 1 }, {}), []);

  // The cutoff is a real date and not a number somebody typed: the end
  // of the day Mac asked for this - asked again (FOUNDER2), so the later day.
  assert.equal(new Date(FOUNDER_UNTIL * 1000).toISOString(), '2026-09-25T00:00:00.000Z');
});

test('ACC3: the sprout EXPIRES because time passed - nothing runs, nothing is cleared (mutant: a stored glyph and a cron to remove it)', () => {
  const born = 1_000_000;
  const player = { created_at: born, registered_at: 1 };
  assert.deepEqual(glyphsOf(player, {}, born), ['sprout'], 'on the day the account is made');
  assert.deepEqual(glyphsOf(player, {}, born + SPROUT_S - 1), ['sprout'], 'the last second of the fortnight');
  // ONE SECOND LATER IT IS GONE, and the row was not touched. AUDIT-ACC
  // F9 settled this one system over: a cron is a thing that can stop
  // running while everything looks fine, and a stored glyph with an
  // expiry needs one.
  assert.deepEqual(glyphsOf(player, {}, born + SPROUT_S), []);
  assert.equal(SPROUT_S, 14 * 24 * 60 * 60, 'two weeks, as Mac wrote it');
});

test('ACC3: a developer is a handle in CONFIG, so taking the handle off takes the title and the glyph with it', () => {
  const env = { DEVELOPER_HANDLES: 'mack, Someone_Else' };
  assert.deepEqual([...developerHandles(env)], ['mack', 'someone_else'], 'trimmed and case-folded - handle_lc is what uniqueness is really on');
  const dev = { handle: 'MacK', registered_at: FOUNDER_UNTIL + 1, created_at: 0 };
  assert.ok(isDeveloper(dev, env));
  assert.deepEqual(titlesHeld(dev, env), ['developer']);
  assert.deepEqual(glyphsOf(dev, env, NOW), ['dev'], 'the glyph rides the same list as the title - one grant, two faces');

  // THE REMOVAL IS THE POINT. Nothing is written anywhere, so dropping
  // the handle from the config is the whole of revoking it.
  assert.deepEqual(titlesHeld(dev, { DEVELOPER_HANDLES: '' }), []);
  assert.deepEqual(glyphsOf(dev, { DEVELOPER_HANDLES: '' }, NOW), []);
  assert.deepEqual(titlesHeld(dev, {}), [], 'a service with no list at all grants nobody');

  // A GUEST HAS NO HANDLE, so a guest can never be in a list of
  // handles - the list names people and a guest row is a device.
  assert.equal(isDeveloper({ handle: null }, env), false);
  assert.equal(isDeveloper({ handle: '' }, env), false);
});

test('ACC3: HOLDING IS NOT WEARING - a stored title stops being worn the moment the grant behind it lapses', () => {
  const env = { DEVELOPER_HANDLES: 'mack' };
  const dev = { handle: 'mack', registered_at: FOUNDER_UNTIL - 1, created_at: 0, title: 'developer' };
  assert.deepEqual(titlesHeld(dev, env), ['founder', 'developer'], 'both, in the order they are offered');
  assert.equal(titleWorn(dev, env), 'developer');

  // OFF THE LIST, AND THE COLUMN STILL SAYS `developer`. Nothing
  // rewrote the row and nothing had to: a grant is a fact checked now.
  assert.equal(titleWorn(dev, {}), undefined);
  assert.equal(wardrobeOf(dev, {}, NOW).title, null, 'the wardrobe says null rather than a title nobody holds');

  assert.equal(titleWorn({ ...dev, title: null }, env), undefined);
  assert.equal(titleWorn({ ...dev, title: 'emperor' }, env), undefined, 'a column somebody edited by hand is not a grant');
});

test('ACC3: equip refuses what is not held and what is not a title, and taking it off is always allowed', () => {
  const env = { DEVELOPER_HANDLES: 'mack' };
  const founder = { handle: 'notmack', registered_at: FOUNDER_UNTIL - 1, created_at: 0 };
  assert.equal(equipRefusal('founder', founder, env), null);
  assert.equal(equipRefusal('developer', founder, env), 'not-held');
  assert.equal(equipRefusal('emperor', founder, env), 'no-title');
  assert.equal(equipRefusal('', founder, env), 'no-title');
  assert.equal(equipRefusal(null, founder, env), null, 'a player may always wear nothing');
  // THE TWO REFUSALS ARE DIFFERENT WORDS because they are different
  // situations: one is "no such title exists" and the other is "it
  // exists and it is not yours", and the Worker answers 400 and 403.
  assert.notEqual(equipRefusal('emperor', founder, env), equipRefusal('developer', founder, env));
});

// ── THE TOKEN ───────────────────────────────────────────────────────

test('ACC3: the token carries the badge, and a body edited to claim one that is not in the vocabulary will not verify', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(
    Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'),
    { subtle },
  );
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-1', n: 'Mack', k: 'linked', t: 'founder', g: ['sprout', 'dev'] }, kp.privateKey, { subtle, nowS });
  const r = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'founder');
  assert.deepEqual(r.claims.g, ['sprout', 'dev']);

  // A TOKEN WITHOUT A BADGE IS THE COMMON CASE and carries neither key
  // - absent, not null, exactly as the wire rows are.
  const bare = await mintToken({ s: 'acct-1', n: 'Mack', k: 'linked' }, kp.privateKey, { subtle, nowS: nowS - 1 });
  const b = await verifyToken(bare, pub, { subtle, nowS });
  assert.ok(b.ok);
  assert.equal('t' in b.claims, false);
  assert.equal('g' in b.claims, false);

  // AND THE VOCABULARY IS CLOSED. These run through `claimsValid`,
  // which is what `verifyToken` asks before it says ok - so an
  // unknown badge cannot have been signed for, and the relay never
  // has to re-check one.
  const base = { v: 1, s: 'acct-1', n: 'Mack', k: 'linked', i: nowS, e: nowS + 60 };
  assert.equal(claimsValid({ ...base, t: 'founder' }), true);
  assert.equal(claimsValid({ ...base, t: 'emperor' }), false);
  assert.equal(claimsValid({ ...base, t: 42 }), false);
  assert.equal(claimsValid({ ...base, g: ['sprout'] }), true);
  assert.equal(claimsValid({ ...base, g: ['sprout', 'sprout'] }), false, 'a repeated glyph is a minter that got greedy');
  assert.equal(claimsValid({ ...base, g: ['nope'] }), false);
  assert.equal(claimsValid({ ...base, g: 'sprout' }), false, 'a string is not a list of glyphs');
  assert.equal(claimsValid({ ...base, g: [...GLYPHS, 'sprout'] }), false, 'more slots than there are glyphs');
  assert.equal(GLYPHS_MAX, GLYPHS.length, 'the bound is the vocabulary\'s own size, not a number somebody picked');
  assert.deepEqual([...TITLES], ['founder', 'developer', 'dungeonmaster', 'disciple', 'apostle', 'hierophant', 'shadowfang'], 'Mac\'s two, then TITLE-N\'s Dungeon Master and the Patreon tiers lowest first, then SHADOW-FANG\'s');
  assert.deepEqual([...GLYPHS], ['sprout', 'dev', 'mod', 'dm', 'disciple', 'apostle', 'hierophant', 'shadowfang'], 'MOD1 added the moderator shield, TITLE-N a glyph per new title, SHADOW-FANG the wolf, each last - the order is the order a name draws them in');
});

// ── THE SERVICE, end to end ─────────────────────────────────────────

async function stand(vars = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pubB64 = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', ...vars };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A REGISTERED account, because Founder is for registered accounts
   *  (Mac's call) - a guest is one storage clear from gone. `register`
   *  stamps `registered_at` off the ctx clock, so the clock chooses
   *  which side of the cutoff the account lands on. */
  const account = async (handle, { registeredAt = FOUNDER_UNTIL - 1, createdAt = null } = {}) => {
    const guest = (await call('POST', '/v1/auth/guest', {})).body;
    await register({ db: env.DB, subtle, rand, nowS: registeredAt }, guest.id, { handle, password: 'a-long-enough-password' });
    if (createdAt !== null) await env.DB.prepare('UPDATE players SET created_at = ? WHERE id = ?').bind(createdAt, guest.id).run();
    return guest;
  };
  return { env, call, pubB64, account };
}

test('ACC3: /v1/account carries the wardrobe, and /v1/account/title equips one of it', async () => {
  const { call, account } = await stand({ DEVELOPER_HANDLES: 'mack' });
  const me = await account('mack');

  const seen = (await call('GET', '/v1/account', undefined, me.secret)).body;
  assert.deepEqual(seen.wardrobe.titles, ['founder', 'developer']);
  assert.equal(seen.wardrobe.title, null, 'nothing is worn until it is equipped - null is a perfectly good answer and is what every existing row gets');
  assert.ok(seen.wardrobe.glyphs.includes('dev'));
  assert.equal('title' in seen.account, false, 'the wardrobe is its own field: an account view is the ROW, a wardrobe is the row read against config and a clock');

  const on = await call('POST', '/v1/account/title', { title: 'developer' }, me.secret);
  assert.equal(on.status, 200);
  assert.equal(on.body.title, 'developer');
  assert.deepEqual(on.body.titles, ['founder', 'developer'], 'the answer describes the row AFTER the write, so nothing has to re-read');

  const again = (await call('GET', '/v1/account', undefined, me.secret)).body;
  assert.equal(again.wardrobe.title, 'developer', 'and it stuck - the WORN title is the one thing that is stored, because it is the only thing that is a choice');

  const off = await call('POST', '/v1/account/title', { title: null }, me.secret);
  assert.equal(off.status, 200);
  assert.equal(off.body.title, null);
  assert.equal((await call('POST', '/v1/account/title', {}, me.secret)).status, 200, 'an absent title is "take it off" too');
});

test('ACC3: a title nobody granted cannot be equipped by a client that asks nicely', async () => {
  const { call, account } = await stand({ DEVELOPER_HANDLES: 'someone-else' });
  const me = await account('mack');
  // 403 AND NOT 401: the credential is GOOD and the title is simply
  // not theirs - the same reading the save wall takes.
  const no = await call('POST', '/v1/account/title', { title: 'developer' }, me.secret);
  assert.equal(no.status, 403);
  assert.equal(no.body.error, 'not-held');
  const nope = await call('POST', '/v1/account/title', { title: 'emperor' }, me.secret);
  assert.equal(nope.status, 400);
  assert.equal(nope.body.error, 'no-title');
  // AND NOTHING WAS WRITTEN. A refusal that half-lands is worse than
  // one that does not land at all.
  assert.equal((await call('GET', '/v1/account', undefined, me.secret)).body.wardrobe.title, null);
  // The route needs a credential like every other one behind the door.
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' })).status, 401);
});

test('ACC3: the minted token carries what the service DERIVED, not what the caller asked for', async () => {
  const { call, account, pubB64, env } = await stand({ DEVELOPER_HANDLES: 'mack' });
  // OLD ENOUGH TO HAVE LOST THE SPROUT, so the only glyph in play
  // here is the developer's and the assertion below means what it says.
  const me = await account('mack', { createdAt: 1 });
  await call('POST', '/v1/account/title', { title: 'founder' }, me.secret);

  const pub = await importPublicKeyB64(pubB64, { subtle });
  const got = await call('POST', '/v1/auth/token', { secret: me.secret, title: 'developer', glyphs: ['dev'] });
  assert.equal(got.status, 200);
  assert.equal(got.body.title, 'founder', 'the token route reads the WORN title off the row - a `title` in the body is not a request anybody answers');
  const r = await verifyToken(got.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'founder');
  assert.ok(r.claims.g.includes('dev'));

  // THE BADGE LAPSES ON THE NEXT TOKEN, with no cron and no column to
  // clear: take the handle off the list and both halves of the
  // developer grant are gone from what gets signed. The worn title
  // survives in the column and simply stops being worn.
  await call('POST', '/v1/account/title', { title: 'developer' }, me.secret);
  env.DEVELOPER_HANDLES = '';
  const after = await call('POST', '/v1/auth/token', { secret: me.secret });
  assert.equal(after.body.title, null);
  assert.deepEqual(after.body.glyphs, [], 'the dev glyph went with the grant');
  const r2 = await verifyToken(after.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.ok(r2.ok);
  assert.equal('t' in r2.claims, false, 'a badge nobody holds is not signed for at all');
});

test('ACC3: a guest gets a token and no badge - the wall for a title is the same one the saves have', async () => {
  const { call } = await stand({ DEVELOPER_HANDLES: 'mack' });
  const guest = (await call('POST', '/v1/auth/guest', {})).body;
  const seen = (await call('GET', '/v1/account', undefined, guest.secret)).body;
  assert.deepEqual(seen.wardrobe.titles, [], 'Founder is for registered accounts (Mac)');
  // ...BUT THE SPROUT IS NOT A TITLE. It is true of a new account, and
  // a guest account is as new as any other, so it is there.
  assert.deepEqual(seen.wardrobe.glyphs, ['sprout']);
  const got = await call('POST', '/v1/auth/token', { secret: guest.secret });
  assert.equal(got.body.title, null);
  assert.deepEqual(got.body.glyphs, ['sprout']);
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, guest.secret)).status, 403);
});

// ── THE WIRE, and the relay ─────────────────────────────────────────

test('ACC3: `badged` OMITS what is not there rather than nulling it, at every row the relay builds', () => {
  assert.deepEqual(badged({ id: 'a' }, {}), { id: 'a' });
  assert.deepEqual(badged({ id: 'a' }, { title: null, glyphs: [] }), { id: 'a' }, 'an empty list is no badge, not an empty badge');
  assert.deepEqual(badged({ id: 'a' }, { title: 'founder', glyphs: ['sprout'] }), { id: 'a', title: 'founder', glyphs: ['sprout'] });
  // MOST PLAYERS WEAR NOTHING, so `"title":null` on every row of a
  // 64-peer welcome is bytes paid for saying nothing - and a reader
  // that must tell "no title" from "this build has no such key" has
  // two answers where one will do.
  const roster = rosterFor([
    { id: 'peer-0001', name: 'One', look: {}, pose: null, title: 'founder', glyphs: ['dev'] },
    { id: 'peer-0002', name: 'Two', look: {}, pose: null },
  ], 'me');
  assert.equal(roster[0].title, 'founder');
  assert.deepEqual(roster[0].glyphs, ['dev']);
  assert.equal('title' in roster[1], false);
  assert.equal('glyphs' in roster[1], false);
});

test('ACC3: the relay reads the badge OUT of the verified token - a hello that types one gets nothing (mutant: the frame\'s own field believed)', async () => {
  const r = fakeRoom('town:m9');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'peer-0001', null, { title: 'founder', glyphs: ['sprout'] });
  await r.hello(b, 'peer-0002');

  // b's welcome names a, badged.
  const welcome = b.sent.find((m) => m.t === 'welcome');
  const seen = welcome.peers.find((p) => p.id === 'peer-0001');
  assert.equal(seen.title, 'founder');
  assert.deepEqual(seen.glyphs, ['sprout']);
  // ...and b, who minted no badge, is on a's join with neither key.
  const join = a.sent.find((m) => m.t === 'join' && m.id === 'peer-0002');
  assert.equal('title' in join, false);
  assert.equal('glyphs' in join, false);

  // THE FRAME'S OWN FIELD IS NOT A BADGE. This hello signs nothing and
  // types both - which is the whole attack, and it is the one ACC1g
  // shut on the name one slice ago.
  const c = r.connect();
  await r.hello(c, 'peer-0003', null, { tok: await r.token('peer-0003', { n: 'peer-0003' }) });
  await r.room.webSocketMessage(c, JSON.stringify({ t: 'pose', p: null }));
  const liar = a.sent.find((m) => m.t === 'join' && m.id === 'peer-0003');
  assert.equal('title' in liar, false, 'a client never asserts a title - it is read out of the signature or it is not there');
});

test('ACC3: the badge rides the channel roster and the `who` answer too - the one peer that arrived unbadged while everybody else was badged is the shape ACC1d-MARK was retired for', async () => {
  const chat = fakeRoom('chat:world');
  const a = chat.connect(), b = chat.connect();
  await chat.hello(a, 'peer-0001', null, { title: 'developer', glyphs: ['dev'] });
  await chat.hello(b, 'peer-0002');
  const named = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.equal(named.title, 'developer');
  assert.deepEqual(named.glyphs, ['dev']);
  const cj = a.sent.find((m) => m.t === 'join' && m.id === 'peer-0002');
  assert.equal('title' in cj, false);

  // THE `who` ANSWER: a stranger beyond the welcome's roster, asked
  // for by name, arrives as a join - and it is built by hand rather
  // than by `rosterFor`, which is exactly how one row comes to be the
  // only unbadged one in the room.
  const place = fakeRoom('town:m11');
  const x = place.connect(), y = place.connect();
  await place.hello(x, 'peer-0011', null, { title: 'founder' });
  await place.hello(y, 'peer-0012');
  y.sent.length = 0;
  await place.room.webSocketMessage(y, JSON.stringify({ t: 'who', id: 'peer-0011' }));
  const answer = y.sent.find((m) => m.t === 'join' && m.id === 'peer-0011');
  assert.ok(answer, 'the room answered');
  assert.equal(answer.title, 'founder');
});
