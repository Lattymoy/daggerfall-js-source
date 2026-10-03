// ARENA4b (2026-10-03): THE `cl` CLAIM AT THE MINT - a realm character's own level, off its tile's summary
// (server-account/src/realm.js realmLevelOf), signed into the identity token beside `rc` by /v1/auth/token
// (server-account/src/index.js), for the relay to read. Driven through the real Worker over node:sqlite
// (test/accountDb.mjs); the claim's own law in src/net/identityToken.js claimsValid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { verifyToken, claimsValid, mintToken } from '../src/net/identityToken.js';
import { REALM_LEVEL_CLAIM_MAX, realmLevelOf } from '../server-account/src/realm.js';

const { subtle } = globalThis.crypto;

test('ARENA4b the mint signs a realm character\'s level as `cl` - its tile\'s, as its checkpoint last said; none for another character, none named, a tile with no level or one out of bounds (mutants: `cl` minted for an offline character; the summary\'s level unread; the bound dropped; another account\'s character read)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const who = await S.registered('Aldric');
  const R = await seatRealm(S.env, who.secret, 'Aldric', { name: 'Aldric', level: 12, goldPieces: 100, items: [] });
  const claimsOf = async (body) => {
    const r = await S.call('/v1/auth/token', body, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await verifyToken(r.body.token, S.identityPublic, { subtle, nowS: T0 });
    assert.ok(v.ok, v.why);
    return v.claims;
  };
  const tile = (summary) => raw.prepare('UPDATE realm_characters SET summary = ? WHERE id = ?').run(summary == null ? null : JSON.stringify(summary), R.id);
  tile({ level: 12, className: 'Knight', race: 'Breton', gender: 'male', face: 3, region: 'Daggerfall' });
  const c = await claimsOf({ character: R.id });
  assert.deepEqual([c.rc, c.cl], [1, 12], 'the realm character\'s own level, beside its `rc`');
  assert.equal('cl' in (await claimsOf({ character: 'char-aldric' })), false, 'an offline character\'s: none');
  assert.equal('cl' in (await claimsOf({})), false, 'none named: none');
  tile(null);
  assert.equal('cl' in (await claimsOf({ character: R.id })), false, 'a tile with no summary yet');
  tile({ level: 0 });
  assert.equal('cl' in (await claimsOf({ character: R.id })), false, 'a level under one');
  tile({ level: REALM_LEVEL_CLAIM_MAX });
  assert.equal((await claimsOf({ character: R.id })).cl, 1000, 'the top of the bound');
  tile({ level: 1001 });
  assert.equal('cl' in (await claimsOf({ character: R.id })), false, 'past the bound');
  // the checkpoint's own word moves it
  const put = await S.fetch(`https://accounts.invalid/v1/realm/${R.id}/data`, {
    method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': R.lease, 'x-realm-seq': String(R.at().seq + 1), 'x-realm-summary': JSON.stringify({ level: 14 }) },
    body: JSON.stringify({ name: 'Aldric', level: 14, goldPieces: 100, items: [] }),
  });
  assert.equal(put.status, 200);
  assert.equal((await claimsOf({ character: R.id })).cl, 14, 'as the last checkpoint\'s tile says');
  const B = await S.registered('Bran');
  const other = await S.call('/v1/auth/token', { character: R.id }, B.secret);
  const ov = await verifyToken(other.body.token, S.identityPublic, { subtle, nowS: T0 });
  assert.equal('cl' in ov.claims, false, 'another account naming it: none');
  // the read itself is the account's own - never another's character, whatever the mint asks before it
  assert.equal(await realmLevelOf({ db: S.env.DB }, B.id, R.id), null, 'another account\'s character: no level');
  assert.equal(await realmLevelOf({ db: S.env.DB }, who.id, R.id), 14, 'its own account\'s: its tile\'s');
});

test('ARENA4b the claim\'s law: optional, a whole number from 1 to 1000, refused present and wrong at the minter (mutants: 0 admitted; a fraction admitted; a string admitted)', async () => {
  const base = { s: 'acct-1234', n: 'Aldric', k: 'linked', i: 100, e: 200 };
  assert.equal(claimsValid(base), true, 'absent');
  for (const cl of [1, 12, 1000]) assert.equal(claimsValid({ ...base, cl }), true, `${cl}`);
  for (const cl of [0, 1001, 1.5, '12', null, -3]) assert.equal(claimsValid({ ...base, cl }), false, `${JSON.stringify(cl)} refused`);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-1234', n: 'Aldric', k: 'linked', cl: 7 }, kp.privateKey, { subtle, nowS: 100 });
  const v = await verifyToken(tok, kp.publicKey, { subtle, nowS: 100 });
  assert.equal(v.claims.cl, 7, 'minted and verified');
  await assert.rejects(mintToken({ s: 'acct-1234', n: 'Aldric', k: 'linked', cl: 0 }, kp.privateKey, { subtle, nowS: 100 }), /refused/);
});
